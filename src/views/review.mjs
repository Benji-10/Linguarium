/**
 * Review: the FSRS spaced repetition session.
 *
 * Three ability dimensions are tracked with independent memory states:
 *   recognition - see the term, recall the meaning (self-check reveal)
 *   recall      - see the meaning, recall the term (self-check reveal)
 *   production  - see the meaning, type the term (checked input)
 *
 * The scheduler runs locally (src/shared/fsrs.mjs) so sessions work
 * offline; events are queued and synced idempotently. Nothing is marked
 * mastered without demonstrated performance.
 */

import { icon, esc, toast, spinner, emptyState } from '../ui/components.mjs';
import { getState, setState, tokenizerFor, languageName } from '../core/store.mjs';
import { navigate } from '../core/router.mjs';
import { api } from '../core/api.mjs';
import { review as fsrsReview, memoryRetrievability, DESIRED_RETENTION } from '../shared/fsrs.mjs';
import { deriveStatus } from '../shared/status.mjs';
import { RATINGS, DIMENSIONS } from '../shared/constants.mjs';
import { enqueue, upsertCachedEntry } from '../core/idb.mjs';
import { refreshQueueCount } from '../core/sync.mjs';

export async function renderReview(container) {
  const url = new URLSearchParams((location.hash.split('?')[1] ?? ''));
  const state = getState();
  const language = url.get('language') || state.activeLanguage;
  let dimension = url.get('dimension');
  if (!DIMENSIONS[dimension]) dimension = 'recognition';

  let queue = [];
  let index = 0;
  let revealed = false;
  let sessionStats = { done: 0, again: 0, hard: 0, good: 0, easy: 0 };
  let currentMemory = null;

  container.innerHTML = `${spinner('Building the review queue')}`;

  const load = async () => {
    let data = null;
    try {
      data = await api('/api/reviews', {
        params: { language: language ?? undefined, dimension, limit: 60, new: 20 },
      });
    } catch (err) {
      // Offline: derive the queue from the cached entries.
      const entries = getState().entries.filter((e) => !language || e.language_code === language);
      const due = [];
      const fresh = [];
      for (const e of entries) {
        const m = e.memories?.[dimension];
        if (!m || m.reps === 0) {
          fresh.push({ ...e, memory: null });
        } else if (new Date(m.due).getTime() <= Date.now()) {
          due.push({ ...e, memory: { ...m, last_review: m.last_review, due: m.due } });
        }
      }
      due.sort((a, b) => new Date(a.memory.due) - new Date(b.memory.due));
      data = { dimension, due, new: fresh.slice(0, 20) };
    }
    queue = [...data.new, ...data.due];
    return data;
  };

  const data = await load();
  const dueCount = (data.due ?? []).length;
  const newCount = (data.new ?? []).length;

  const draw = () => {
    if (queue.length === 0) {
      container.innerHTML = `
        <section class="page-head"><div><h1>${icon('review')}Review</h1></div></section>
        <section class="panel">
          ${emptyState({
            iconName: 'check',
            title: 'Nothing due in this dimension',
            message: 'For this language everything is scheduled in the future, or your queue is empty. Try another dimension, add words while reading, or come back later.',
          })}
          <div class="dim-grid">
            ${['recognition', 'recall', 'production']
              .map((d) => `<a class="dim-card" href="#/review?dimension=${d}${language ? `&language=${language}` : ''}">
                <div class="dim-head">${DIMENSIONS[d].label}<span class="count-pill"></span></div>
                <div class="muted small">${DIMENSIONS[d].description}</div></a>`)
              .join('')}
          </div>
        </section>`;
      return;
    }

    const card = queue[index];
    if (!card) {
      drawSummary();
      return;
    }

    const isRecall = dimension === 'recall';
    const isProduction = dimension === 'production';
    const front = isRecall || isProduction ? card.definition || '(no definition recorded)' : card.term;
    const back = isRecall || isProduction ? card.term : card.definition || '(no definition recorded)';

    container.innerHTML = `
      <section class="page-head review-head">
        <div><h1>${icon('review')}Review - ${DIMENSIONS[dimension].label}</h1>
        <p class="muted">${language ? esc(languageName(state.languages, language)) + ' - ' : ''}${queue.length - index} cards in this session (${dueCount} due, ${newCount} new)</p></div>
        <div class="dim-tabs">
          ${['recognition', 'recall', 'production']
            .map(
              (d) =>
                `<a class="chip ${d === dimension ? 'active' : ''}" href="#/review?dimension=${d}${language ? `&language=${language}` : ''}">${DIMENSIONS[d].label}</a>`,
            )
            .join('')}
        </div>
      </section>

      <section class="review-stage panel">
        <div class="card-front ${isRecall ? 'term-hidden' : ''}">
          <div class="card-lang muted small">${esc(card.language_code)}${card.part_of_speech ? ` - ${esc(card.part_of_speech)}` : ''}</div>
          <div class="card-term">${esc(front)}</div>
          ${card.reading && !isRecall && !isProduction ? `<div class="card-reading muted">${esc(card.reading)}</div>` : ''}
          ${card.example && (isRecall || isProduction) ? `<div class="card-reading muted small">"${esc(card.example)}"</div>` : ''}
        </div>

        ${isProduction ? productionInputHtml() : ''}

        <div class="card-back ${revealed ? 'revealed' : 'hidden'}" id="card-back">
          <div class="card-term small">${esc(back)}</div>
          ${card.example && !isRecall && !isProduction ? `<div class="muted small">"${esc(card.example)}"</div>` : ''}
          <div class="card-meta muted small" id="card-meta"></div>
        </div>

        <div class="rating-row" id="rating-row">
          ${
            revealed || isProduction
              ? RATINGS_HTML
              : `<button class="btn primary wide" id="btn-reveal">Show answer</button>`
          }
        </div>
      </section>

      <section class="panel session-note">
        <span class="muted small">Target retention ${Math.round(DESIRED_RETENTION * 100)}% (FSRS-5). ${
          getState().online ? '' : `${icon('offline').toString()} Working offline - results sync when you reconnect.`
        }</span>
      </section>
    `;

    currentMemory = card.memory ?? null;

    if (revealed || isProduction) {
      renderMeta(card);
    }

    container.querySelector('#btn-reveal')?.addEventListener('click', () => {
      revealed = true;
      draw();
    });

    if (isProduction) {
      const input = container.querySelector('#prod-input');
      input?.focus();
      input?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          const val = (input.value ?? '').trim();
          if (!val) return;
          gradeProduction(card, val);
        }
      });
      container.querySelector('#prod-check')?.addEventListener('click', () => {
        const val = (input.value ?? '').trim();
        if (!val) return;
        gradeProduction(card, val);
      });
    }

    container.querySelectorAll('[data-rating]').forEach((btn) =>
      btn.addEventListener('click', () => rate(card, Number(btn.dataset.rating))),
    );
  };

  const productionInputHtml = () => `
    <div class="prod-input-row">
      <input id="prod-input" type="text" placeholder="Type the term..." autocomplete="off" spellcheck="false">
      <button class="btn subtle" id="prod-check">${icon('check')}Check</button>
    </div>`;

  const gradeProduction = (card, value) => {
    const tokenizer = tokenizerFor(getState().languages, card.language_code) ?? {};
    const norm = (s) =>
      s
        .trim()
        .normalize('NFC')
        .toLowerCase();
    const target = card.normalized || norm(card.term);
    const typed = norm(value);
    const back = container.querySelector('#card-back');
    const ok = typed === target;
    if (back) {
      back.classList.remove('hidden');
      back.classList.add('revealed');
      back.insertAdjacentHTML(
        'afterbegin',
        `<div class="prod-result ${ok ? 'pos' : 'neg'}">${ok ? 'Correct.' : `You typed: ${esc(value)}`}</div>`,
      );
    }
    rate(card, ok ? 3 : 1, { auto: true });
  };

  const renderMeta = (card) => {
    const meta = container.querySelector('#card-meta');
    if (!meta) return;
    const m = card.memory;
    if (m && m.reps > 0) {
      const r = memoryRetrievability(
        { stability: m.stability, lastReview: new Date(m.last_review).getTime() },
        Date.now(),
      );
      meta.textContent = `Stability ${Math.round(m.stability * 10) / 10} days - difficulty ${Math.round(m.difficulty * 10) / 10} - ${m.reps} reviews - predicted recall ${Math.round(r * 100)}%`;
    } else {
      meta.textContent = 'First review.';
    }
  };

  const rate = async (card, rating, opts = {}) => {
    const result = fsrsReview(card.memory ?? null, rating, Date.now());
    const event = {
      id: crypto.randomUUID(),
      entry_id: card.id,
      dimension,
      rating,
      reviewed_at: result.log.reviewedAt,
      elapsed_days: result.log.elapsedDays,
      memory: { ...result.memory },
    };

    // Update local cache first (offline-first).
    const updated = {
      ...card,
      memories: { ...(card.memories ?? {}), [dimension]: { ...result.memory } },
      updated_at: new Date().toISOString(),
    };
    await upsertCachedEntry(updated);
    const { entries } = getState();
    setState({ entries: entries.map((e) => (e.id === card.id ? updated : e)) });

    try {
      if (getState().online) {
        await api('/api/reviews', { method: 'POST', body: { events: [event] } });
      } else {
        throw new Error('offline');
      }
    } catch {
      await enqueue({ type: 'review', payload: event });
      await refreshQueueCount();
    }

    sessionStats.done += 1;
    sessionStats[RATINGS[rating].label.toLowerCase()] += 1;
    if (rating === 1) {
      // A lapse returns the card later in this same session.
      queue.push({ ...updated, memory: updated.memories[dimension] });
    }
    index += 1;
    revealed = false;
    draw();
  };

  const drawSummary = () => {
    container.innerHTML = `
      <section class="page-head"><div><h1>${icon('check')}Session complete</h1></div></section>
      <section class="panel summary-panel">
        <h2>${sessionStats.done} cards reviewed</h2>
        <div class="summary-grid">
          <div class="badge neg">Again ${sessionStats.again}</div>
          <div class="badge warn">Hard ${sessionStats.hard}</div>
          <div class="badge pos">Good ${sessionStats.good}</div>
          <div class="badge info">Easy ${sessionStats.easy}</div>
        </div>
        <p class="muted small">Again cards were re-queued in this session. Every rating trains the FSRS memory state for this dimension only - recognition, recall and production progress separately.</p>
        <div class="wp-actions">
          <a class="btn primary" href="#/">Back to dashboard</a>
          <a class="btn subtle" href="#/review?dimension=${dimension}${language ? `&language=${language}` : ''}">More</a>
        </div>
      </section>`;
  };

  draw();
  return () => {};
}

const RATINGS_HTML = `
  <div class="rating-buttons">
    <button class="btn rate neg" data-rating="1">Again <small>&lt;10m</small></button>
    <button class="btn rate warn" data-rating="2">Hard</button>
    <button class="btn rate pos" data-rating="3">Good</button>
    <button class="btn rate info" data-rating="4">Easy</button>
  </div>`;
