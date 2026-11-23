/**
 * Writing practice (phase 2).
 *
 * Prompts are built from what the learner is actually learning:
 *   - vocabulary entries (priority: terms whose production memory is due or
 *     weakest, otherwise anything not mastered),
 *   - grammar structures for the language (with their stage, so practice
 *     targets structures at recognized/understood, not untouched ones).
 *
 * Answers are free text with honest SELF-ASSESSMENT - the learner knows
 * whether they could produce the word, an algorithm does not. The
 * self-assessment feeds the production dimension of FSRS through the same
 * review pipeline as everything else (one connected knowledge state).
 * Optional AI feedback is available when the deployment has a
 * GEMINI_API_KEY, clearly labelled as unverified AI analysis.
 */

import { icon, esc, toast, spinner, emptyState, provenanceBadge } from '../ui/components.mjs';
import { getState, tokenizerFor, languageName } from '../core/store.mjs';
import { navigate } from '../core/router.mjs';
import { api } from '../core/api.mjs';
import { deriveStatus } from '../shared/status.mjs';

export async function renderPractice(container) {
  container.innerHTML = `${spinner('Preparing writing practice')}`;
  const s = getState();
  const lang = s.activeLanguage;
  const langLabel = languageName(s.languages, lang);

  const entries = (s.entries ?? []).filter((e) => !lang || e.language_code === lang);

  if (entries.length === 0) {
    container.innerHTML = `
      <section class="page-head"><div><h1>${icon('pencil')}Writing practice</h1></div></section>
      ${emptyState({
        iconName: 'pencil',
        title: 'Nothing to write about yet',
        message: 'Writing prompts come from the words you are actually learning. Save words while reading (click them), or import a collection first.',
        actionHtml: '<a class="btn" href="#/reading">Read and click words</a>',
      })}`;
    return () => {};
  }

  // Grammar structures for the language (stage-aware: prefer ones in progress).
  let structures = [];
  try {
    const data = await api('/api/grammar', { params: { language: lang } });
    structures = data.structures ?? [];
  } catch {
    structures = []; // offline or none seeded - prompts fall back to vocabulary only
  }

  // Pick the target entry: production memory due first, then weakest.
  const prodDue = entries.filter((e) => {
    const m = e.memories?.production;
    return m && (!m.due || new Date(m.due) <= new Date());
  });
  const noProd = entries.filter((e) => !e.memories?.production);
  const pool = prodDue.length > 0 ? prodDue : noProd.length > 0 ? noProd : entries;
  const entry = pool[Math.floor(Math.random() * pool.length)];

  const inProgress = structures.filter((st) => st.stage === 'recognized' || st.stage === 'understood');
  const structurePool = inProgress.length > 0 ? inProgress : structures;
  const structure = structurePool.length > 0 ? structurePool[Math.floor(Math.random() * structurePool.length)] : null;

  const meaning = entry.definition || entry.translation || entry.gloss || '';
  const promptText = structure
    ? `Write a short sentence or two in ${langLabel} using “${entry.term}”${meaning ? ` (${meaning})` : ''} — and the structure “${structure.name}”.`
    : `Write a short sentence or two in ${langLabel} using “${entry.term}”${meaning ? ` (${meaning})` : ''}.`;

  const aiConfigured = Boolean(s.aiStatus?.available);

  container.innerHTML = `
    <section class="page-head">
      <div>
        <h1>${icon('pencil')}Writing practice</h1>
        <p class="muted">Prompts from your own vocabulary${structure ? ' and the grammar you are progressing through' : ''}. Free-text writing with honest self-assessment - it feeds the <strong>production</strong> side of your memory schedule.</p>
      </div>
      <button class="btn subtle" id="btn-another">${icon('review')}Another prompt</button>
    </section>

    <section class="panel">
      <div class="panel-head"><h2>Your prompt</h2>${structure ? provenanceBadge(structure.provenance) : ''}</div>
      <p class="practice-prompt">${esc(promptText)}</p>
      ${
        structure
          ? `<details class="structure-hint">
              <summary>Remind me how “${esc(structure.name)}” works</summary>
              <p>${esc(structure.explanation ?? structure.summary ?? '')}</p>
              <ul class="structure-examples">${(structure.examples ?? [])
                .map((ex) => `<li>${esc(ex.text)}<br><span class="muted small">${esc(ex.translation ?? '')}</span></li>`)
                .join('')}</ul>
            </details>`
          : ''
      }
      <textarea id="practice-answer" rows="5" placeholder="Write your answer here… (in ${esc(langLabel)})"></textarea>
      <div class="practice-actions">
        <button class="btn primary" id="btn-submit" disabled>${icon('check')}Done writing - assess me</button>
        ${aiConfigured ? `<button class="btn subtle" id="btn-ai" title="Optional, labelled unverified">${icon('flash')}AI feedback</button>` : ''}
      </div>
      <p class="muted small">${
        aiConfigured
          ? 'AI feedback uses gemini-3.1-flash-lite and is labelled unverified everywhere. Your own self-assessment is what updates your schedule.'
          : 'AI feedback is not configured on this deployment (no GEMINI_API_KEY) - self-assessment is the full experience here.'
      }</p>
    </section>

    <div id="practice-result"></div>
  `;

  const answerEl = container.querySelector('#practice-answer');
  const submitBtn = container.querySelector('#btn-submit');
  answerEl.addEventListener('input', () => {
    submitBtn.disabled = answerEl.value.trim().length < 2;
  });

  container.querySelector('#btn-another')?.addEventListener('click', () => {
    renderPractice(container);
  });

  submitBtn.addEventListener('click', () => {
    const result = container.querySelector('#practice-result');
    result.innerHTML = `
      <section class="panel">
        <div class="panel-head"><h2>How did writing it go?</h2>
          <span class="muted small">be honest - the scheduler works better on truth</span></div>
        <p class="practice-answer-echo" lang="${esc(lang)}">${esc(answerEl.value.trim())}</p>
        <div class="practice-rate">
          <button class="btn danger" data-rate="1">${icon('x')}Could not produce it</button>
          <button class="btn" data-rate="2">${icon('alert')}Struggled</button>
          <button class="btn" data-rate="3">${icon('check')}Produced it, imperfectly</button>
          <button class="btn subtle" data-rate="4">${icon('flash')}Easy</button>
        </div>
        ${
          entry.example
            ? `<details class="structure-hint"><summary>Model sentence using this term</summary><p class="muted small">${esc(entry.example)}</p></details>`
            : ''
        }
        ${structure ? `<details class="structure-hint"><summary>Model sentences for “${esc(structure.name)}”</summary><ul class="structure-examples">${(structure.examples ?? []).map((ex) => `<li>${esc(ex.text)}<br><span class="muted small">${esc(ex.translation ?? '')}</span></li>`).join('')}</ul></details>` : ''}
      </section>`;
    result.querySelectorAll('[data-rate]').forEach((btn) => {
      btn.addEventListener('click', () => submitSelfAssessment(Number(btn.dataset.rate), entry, structure));
    });
    result.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  });

  container.querySelector('#btn-ai')?.addEventListener('click', async () => {
    const btn = container.querySelector('#btn-ai');
    const answer = answerEl.value.trim();
    if (answer.length < 2) {
      toast('Write something first.', 'warn');
      return;
    }
    btn.disabled = true;
    btn.innerHTML = `${icon('clock')}Checking…`;
    try {
      const data = await api('/api/ai-check', {
        method: 'POST',
        body: {
          language_code: lang,
          prompt: promptText,
          answer,
          terms: [entry.term],
          gloss_language: (s.profiles ?? []).find((p) => p.language_code === lang)?.gloss_language ?? 'en',
        },
      });
      renderAiFeedback(container.querySelector('#practice-result'), data);
    } catch (err) {
      toast(err.message ?? 'AI feedback failed.', 'neg');
      btn.disabled = false;
      btn.innerHTML = `${icon('flash')}AI feedback`;
    }
  });

  return () => {};
}

async function submitSelfAssessment(rating, entry, structure) {
  // Production memory through the same pipeline as every other review.
  const { review } = await import('../shared/fsrs.mjs');
  const { enqueue, upsertCachedEntry } = await import('../core/idb.mjs');
  const memory = entry.memories?.production ?? null;
  const result = review(memory, rating, Date.now());
  const updated = {
    ...entry,
    memories: { ...(entry.memories ?? {}), production: { ...result.memory } },
    updated_at: new Date().toISOString(),
  };
  await upsertCachedEntry(updated);
  const event = {
    id: crypto.randomUUID(),
    entry_id: entry.id,
    dimension: 'production',
    rating,
    reviewed_at: result.log.reviewedAt,
    elapsed_days: result.log.elapsedDays,
    memory: { ...result.memory },
  };
  try {
    if (getState().online) {
      await api('/api/reviews', { method: 'POST', body: { events: [event] } });
    } else {
      throw new Error('offline');
    }
  } catch {
    await enqueue({ type: 'review', payload: event });
  }
  const { refreshQueueCount } = await import('../core/sync.mjs');
  await refreshQueueCount();

  // Grammar progression: writing with a structure is independent use.
  if (structure) {
    const order = ['encountered', 'recognized', 'understood', 'independent_use'];
    const current = order.indexOf(structure.stage ?? 'encountered');
    const reached = rating >= 3 ? 3 : rating === 2 ? Math.max(current, 1) : current;
    if (reached > current) {
      try {
        if (getState().online) {
          await api('/api/grammar', {
            method: 'PUT',
            body: { structure_id: structure.id, stage: order[reached] },
          });
        } else {
          await enqueue({ type: 'grammarStage', payload: { structure_id: structure.id, stage: order[reached] } });
        }
      } catch {
        /* progression metadata is low-stakes; retry next time */
      }
    }
  }

  toast(`Saved to the production dimension - next practice scheduled by FSRS.`, 'pos');
}

function renderAiFeedback(host, data) {
  const p = data.payload ?? {};
  const corrections = (p.corrections ?? [])
    .map(
      (c) => `
      <div class="correction">
        <div class="corr-head">${esc(c.issue)}${c.original ? `<code>${esc(c.original)}</code>` : ''}</div>
        <div class="corr-fix">${icon('check')}<code>${esc(c.suggestion)}</code></div>
        ${c.explanation ? `<p class="muted small">${esc(c.explanation)}</p>` : ''}
      </div>`,
    )
    .join('');
  host.innerHTML = `
    <section class="panel ai-feedback">
      <div class="panel-head"><h2>${icon('flash')}AI feedback</h2>
        <span class="muted small">${provenanceBadge('ai')} ${esc(data.model ?? '')} - unverified machine analysis</span></div>
      ${p.naturalness ? `<p>Reading as: <strong>${esc(p.naturalness)}</strong></p>` : ''}
      ${corrections || '<p class="muted">No specific issues found.</p>'}
      ${p.did_use_terms?.length ? `<p class="muted small">Used the requested term: ${p.did_use_terms.map((t) => esc(t)).join(', ')}</p>` : ''}
      ${p.translation ? `<p class="muted small">Translation of your answer: ${esc(p.translation)}</p>` : ''}
      ${p.note ? `<p>${esc(p.note)}</p>` : ''}
    </section>`;
  host.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}
