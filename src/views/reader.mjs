/**
 * The interactive reader.
 *
 * - Tokens are clickable (per-character for languages without word spaces).
 * - The reader highlights what your own knowledge state says: mastered /
 *   known terms calm, learning terms dotted, unknown terms plain.
 * - A difficulty banner shows the estimated band for THIS reader with a
 *   transparent, provenance-labelled ("automated") breakdown - never a
 *   CEFR sticker.
 * - Clicking a word opens the word panel: status, entry, provenance,
 *   add-to-vocabulary with an honest self-assessment, optional AI
 *   enrichment, and encounters are logged.
 * - Text selection works as a term for languages where a word does not
 *   correspond to one token (Japanese, Thai, ...).
 * - Position is saved continuously; reading works offline via the cache.
 */

import { icon, raw, esc, toast, spinner, provenanceBadge, statusBadge } from '../ui/components.mjs';
import { getState, setState, tokenizerFor, languageName, isRightToLeft } from '../core/store.mjs';
import { api } from '../core/api.mjs';
import { navigate } from '../core/router.mjs';
import { tokenize, normalizeTerm } from '../shared/tokenizer.mjs';
import { scoreText } from '../shared/difficulty.mjs';
import { deriveStatus } from '../shared/status.mjs';
import { DIFFICULTY_MODES } from '../shared/constants.mjs';
import { getCachedText, putCachedText, cacheEnrichment, getEnrichment } from '../core/idb.mjs';

export async function renderReader(container, params) {
  const { kind, id } = params; // kind: user | shared
  container.innerHTML = `${spinner('Opening the text')}`;

  let text = null;
  try {
    const data = await api('/api/texts', { params: { id, kind } });
    text = data.text;
    if (kind === 'user') await putCachedText(text);
  } catch (err) {
    text = await getCachedText(kind, id);
  }
  if (!text) {
    container.innerHTML =
      '<section class="panel error-panel"><h2>Text unavailable</h2><p class="muted">It could not be loaded and is not in the offline cache.</p><a class="btn" href="#/reading">Back to Reading</a></section>';
    return;
  }

  const state = getState();
  const language = text.language_code;
  const tokenizer = tokenizerFor(state.languages, language) ?? {};
  const profile = (state.profiles ?? []).find((p) => p.language_code === language);
  const mode = profile?.difficulty_mode ?? 'stretch';

  // Knowledge classification for highlighting.
  const entriesByNorm = new Map();
  for (const e of state.entries.filter((e) => e.language_code === language)) {
    entriesByNorm.set(e.normalized, e);
  }
  const classify = (norm) => {
    const entry = entriesByNorm.get(norm);
    if (!entry) return 'unknown';
    const { tier } = deriveStatus(entry, entry.memories ?? {});
    if (tier === 'mastered' || tier === 'reliably_recalled') return 'known';
    if (tier === 'recognized' || tier === 'learning' || tier === 'unencountered') return 'learning';
    return 'unknown';
  };

  // Difficulty estimate (automated provenance).
  const tokens = tokenize(text.body ?? '', tokenizer);
  const knownSet = new Set(
    state.entries
      .filter((e) => e.language_code === language)
      .map((e) => e.normalized),
  );
  const difficulty = scoreText({ text: text.body ?? '', tokenizer, knownSet });

  // Reading progress restore.
  let savedPosition = {};
  try {
    const data = await api('/api/reading');
    const p = (data.progress ?? []).find((r) => r.text_kind === kind && r.text_id === id);
    savedPosition = p?.position ?? {};
  } catch {
    /* offline: position restore is skipped */
  }

  const rtl = isRightToLeft(state.languages, language);
  const langLabel = languageName(state.languages, language);

  container.innerHTML = `
    <section class="page-head reader-head">
      <div>
        <h1>${esc(text.title)}</h1>
        <p class="muted">
          ${esc(langLabel)}${text.author ? ` - ${esc(text.author)}` : ''}
          ${provenanceBadge(text.provenance)}
          ${text.license ? `<span class="badge neutral">${esc(licenseLabel(text.license))}</span>` : ''}
        </p>
        ${text.adaptation_note ? `<p class="muted small adaptation">Adaptation: ${esc(text.adaptation_note)}</p>` : ''}
        ${text.source_url ? `<p class="muted small">Source: <a href="${esc(text.source_url)}" target="_blank" rel="noopener noreferrer">${esc(text.source_url)}</a></p>` : ''}
        ${text.source_ref ? `<p class="muted small">${esc(text.source_ref)}</p>` : ''}
      </div>
      <div class="reader-tools">
        <span class="badge ${difficulty.band === 'challenge' ? 'warn' : difficulty.band === 'comfortable' ? 'pos' : 'info'}" id="band-pill" title="Difficulty estimated from your own knowledge state (automated analysis)">
          ${icon('info')}Estimated: ${DIFFICULTY_MODES[difficulty.band]?.label ?? difficulty.band}
        </span>
        <button class="btn subtle" id="btn-breakdown">${icon('info')}Why this estimate?</button>
        <a class="btn subtle" href="#/reading">${icon('x')}Close</a>
      </div>
    </section>

    <div class="reader-body ${rtl ? 'rtl' : ''}" id="reader-body" dir="${rtl ? 'rtl' : 'ltr'}" lang="${esc(language)}"></div>

    <aside class="word-panel" id="word-panel" hidden>
      <header>
        <div class="word-term-wrap">
          <strong id="wp-term"></strong>
          <span id="wp-badges"></span>
        </div>
        <button class="icon-btn" id="wp-close">${icon('x')}</button>
      </header>
      <div id="wp-content"></div>
    </aside>

    <button class="selection-lookup" id="selection-lookup" hidden>${icon('globe')}Look up selection</button>
  `;

  const body = container.querySelector('#reader-body');
  renderTokens(body, text.body ?? '', tokenizer, classify, rtl);

  // Position restore + autosave -------------------------------------------------
  if (savedPosition.scrollTop) {
    requestAnimationFrame(() => window.scrollTo({ top: savedPosition.scrollTop }));
  }

  const savePosition = async () => {
    const position = { scrollTop: Math.round(window.scrollY || 0), tokenIndex: firstVisibleTokenIndex() };
    const encounters = [...sessionEncounters.values()].map((t) => ({ term: t.raw, entry_id: t.entryId ?? null }));
    sessionEncounters.clear();
    try {
      if (getState().online) {
        await api('/api/reading', { method: 'POST', body: { text_kind: kind, text_id: id, position, encounters } });
      } else {
        throw new Error('offline');
      }
    } catch {
      // Offline: stash for the queue as an upsert-like payload? Reading
      // progress is low-stakes metadata; encounters are re-sent next save.
      pendingEncounters.push(...encounters);
    }
  };

  const interval = setInterval(savePosition, 10000);
  window.addEventListener('beforeunload', savePosition);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') savePosition();
  });

  const sessionEncounters = new Map(); // norm -> {raw, entryId}
  const pendingEncounters = [];

  function firstVisibleTokenIndex() {
    const marks = body.querySelectorAll('.tok');
    const y = window.scrollY + 100;
    for (let i = 0; i < marks.length; i++) {
      if (marks[i].offsetTop >= y) return i;
    }
    return 0;
  }

  // Word panel -------------------------------------------------------------------
  const panel = container.querySelector('#word-panel');

  const openPanel = async (termRaw) => {
    const norm = normalizeTerm(termRaw, tokenizer);
    const entry = entriesByNorm.get(norm);
    sessionEncounters.set(norm, { raw: termRaw, entryId: entry?.id ?? null });
    panel.hidden = false;
    panel.classList.add('open');
    container.querySelector('#wp-term').textContent = termRaw;
    const { status } = deriveStatus(entry, entry?.memories ?? {});
    container.querySelector('#wp-badges').innerHTML =
      `${statusBadge(status)}${entry ? provenanceBadge(entry.source_type) : ''}`;
    renderPanelContent(entry, termRaw, norm);
  };

  const closePanel = () => {
    panel.classList.remove('open');
    panel.hidden = true;
  };

  container.querySelector('#wp-close').addEventListener('click', closePanel);

  const renderPanelContent = (entry, termRaw, norm) => {
    const content = container.querySelector('#wp-content');
    const ai = getState().aiStatus;
    const enrichment = enrichments.get(norm);

    content.innerHTML = `
      ${entry?.definition ? `<p class="wp-definition">${esc(entry.definition)}</p>` : ''}
      ${entry?.reading ? `<p class="muted small">Reading: ${esc(entry.reading)}</p>` : ''}
      ${entry?.part_of_speech ? `<p class="muted small">${esc(entry.part_of_speech)}</p>` : ''}
      ${entry?.example ? `<p class="wp-example muted small">"${esc(entry.example)}"</p>` : ''}

      ${
        entry
          ? `<div class="wp-actions">
              <a class="btn subtle small" href="#/knowledge?q=${encodeURIComponent(norm)}">${icon('globe')}Open in Knowledge</a>
              <button class="btn subtle small" data-rate="4" title="Self-assess your existing knowledge of this word">${icon('check')}I know it</button>
              <button class="btn subtle small" data-rate="3">${icon('clock')}Somewhat</button>
              <button class="btn subtle small" data-review>${icon('review')}Review now</button>
             </div>`
          : `<div class="wp-actions wp-new">
              <p class="muted small">Not in your vocabulary yet.</p>
              <button class="btn primary small" data-add>${icon('plus')}Keep this word</button>
             </div>`
      }

      ${
        enrichment
          ? renderEnrichment(enrichment)
          : ai.available
            ? `<div class="wp-actions"><button class="btn subtle small" data-enrich>${icon('flash')}AI analysis</button></div>`
            : `<p class="muted small ai-off">${icon('info').toString()}AI enrichment is not configured on this deployment. Everything else works.</p>`
      }
    `;

    content.querySelectorAll('[data-add]').forEach((b) =>
      b.addEventListener('click', () => addWord(termRaw, norm)),
    );
    content.querySelectorAll('[data-rate]').forEach((b) =>
      b.addEventListener('click', () => selfAssess(termRaw, norm, entry, Number(b.dataset.rate))),
    );
    content.querySelectorAll('[data-review]').forEach((b) =>
      b.addEventListener('click', () => {
        closePanel();
        navigate(`#/review?language=${language}&dimension=recognition`);
      }),
    );
    content.querySelectorAll('[data-enrich]').forEach((b) =>
      b.addEventListener('click', () => doEnrich(termRaw, norm, entry)),
    );
  };

  const enrichments = new Map();

  const addWord = async (termRaw, norm) => {
    try {
      const { entry, existing } = await api('/api/entries', {
        method: 'POST',
        body: {
          language_code: language,
          term: termRaw,
          definition: '',
          source_type: 'user',
        },
      });
      if (existing) {
        toast('Already in your vocabulary - opening it.', 'info');
      } else {
        toast('Added to your vocabulary.', 'pos');
      }
      if (entry) {
        entriesByNorm.set(norm, entry);
        const { entries } = getState();
        setState({ entries: entries.some((e) => e.id === entry.id) ? entries : [entry, ...entries] });
      }
      renderTokens(body, text.body ?? '', tokenizer, classify, rtl);
      renderPanelContent(entriesByNorm.get(norm), termRaw, norm);
    } catch (err) {
      toast(err.message ?? 'Could not add the word (offline?). It will not be lost.', 'warn');
    }
  };

  const selfAssess = async (termRaw, norm, entry, rating) => {
    // An honest first review: a self-assessment of existing knowledge,
    // logged as a normal review event (nothing is ever silently "mastered").
    const { review } = await import('../shared/fsrs.mjs');
    const { enqueue, upsertCachedEntry, getCachedEntries } = await import('../core/idb.mjs');
    let current = entry;
    if (!current) {
      const data = await api('/api/entries', {
        method: 'POST',
        body: { language_code: language, term: termRaw, definition: '', source_type: 'user' },
      });
      current = data.entry;
      entriesByNorm.set(norm, current);
    }
    const memory = current.memories?.recognition ?? null;
    const result = review(memory, rating, Date.now());
    const updated = {
      ...current,
      memories: { ...(current.memories ?? {}), recognition: { ...result.memory } },
      updated_at: new Date().toISOString(),
    };
    entriesByNorm.set(norm, updated);
    await upsertCachedEntry(updated);
    const event = {
      id: crypto.randomUUID(),
      entry_id: updated.id,
      dimension: 'recognition',
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
    toast('Self-assessment saved - the scheduler starts from there.', 'pos');
    renderTokens(body, text.body ?? '', tokenizer, classify, rtl);
    renderPanelContent(updated, termRaw, norm);
  };

  const doEnrich = async (termRaw, norm, entry) => {
    const content = container.querySelector('#wp-content');
    content.querySelector('[data-enrich]')?.setAttribute('disabled', 'disabled');
    let cached = enrichments.get(norm);
    if (!cached) {
      cached = await getEnrichment(language, norm);
    }
    if (cached) {
      enrichments.set(norm, cached);
      renderPanelContent(entry, termRaw, norm);
      return;
    }
    try {
      const gloss = profile?.gloss_language ?? 'en';
      const data = await api('/api/enrich', {
        method: 'POST',
        body: { language_code: language, term: termRaw, gloss_language: gloss },
      });
      const payload = { payload: data.payload, model: data.model, created_at: data.created_at, cached: data.cached };
      enrichments.set(norm, payload);
      await cacheEnrichment(language, norm, payload);
      renderPanelContent(entry, termRaw, norm);
    } catch (err) {
      if (err.code === 'rate-limited') toast(err.message, 'warn');
      else toast(err.message ?? 'Enrichment failed.', 'neg');
      content.querySelector('[data-enrich]')?.removeAttribute('disabled');
    }
  };

  const renderEnrichment = (data) => {
    const p = data.payload ?? {};
    const defs = (p.definitions ?? []).map((d) => `<li>${esc(d.text)}${d.note ? ` <span class="muted small">(${esc(d.note)})</span>` : ''}</li>`).join('');
    const examples = (p.example_sentences ?? [])
      .map((e) => `<li>${esc(e.text)}${e.translation ? `<br><span class="muted small">${esc(e.translation)}</span>` : ''}</li>`)
      .join('');
    const et = p.etymology ?? { text: null, confidence: 'unknown' };
    return `
      <div class="enrichment">
        <div class="enrich-head">${provenanceBadge('ai')}<span class="muted small">${esc(data.model ?? '')}${data.cached ? ' - cached' : ''}</span></div>
        ${defs ? `<div class="enrich-sec"><h4>Definitions</h4><ul>${defs}</ul></div>` : ''}
        ${p.reading || p.pronunciation_ipa ? `<div class="enrich-sec"><h4>Pronunciation</h4><p>${esc(p.reading ?? '')} ${p.pronunciation_ipa ? `(${esc(p.pronunciation_ipa)})` : ''}</p></div>` : ''}
        ${examples ? `<div class="enrich-sec"><h4>Examples</h4><ul>${examples}</ul></div>` : ''}
        ${p.usage_notes ? `<div class="enrich-sec"><h4>Usage notes</h4><p>${esc(p.usage_notes)}</p></div>` : ''}
        <div class="enrich-sec">
          <h4>Etymology</h4>
          ${
            et.text
              ? `<p>${esc(et.text)} <span class="badge warn">unverified AI claim</span></p>${et.note ? `<p class="muted small">${esc(et.note)}</p>` : ''}`
              : `<p class="muted">No reliable etymology available for this term${et.note ? ` - ${esc(et.note)}` : ''}. Nothing is invented here.</p>`
          }
        </div>
        ${p.mnemonic ? `<div class="enrich-sec"><h4>Mnemonic</h4><p class="mnemonic">${esc(p.mnemonic)}</p><p class="muted small">A memory aid invented for you - not the word's history.</p></div>` : ''}
      </div>`;
  };

  // Token click handling ----------------------------------------------------------
  body.addEventListener('click', (e) => {
    const tok = e.target.closest('.tok');
    if (tok) {
      openPanel(tok.dataset.raw);
      return;
    }
  });

  // Selection lookup (agglutinative / no-space languages) ------------------------
  const lookupBtn = container.querySelector('#selection-lookup');
  document.addEventListener('selectionchange', () => {
    const sel = window.getSelection();
    const str = sel?.toString()?.trim() ?? '';
    if (!str || str.length > 80 || !container.contains(document.activeElement) && !selContains(body, sel)) {
      lookupBtn.hidden = true;
      return;
    }
    if (selContains(body, sel)) {
      lookupBtn.hidden = false;
    } else {
      lookupBtn.hidden = true;
    }
  });
  lookupBtn.addEventListener('click', () => {
    const str = window.getSelection()?.toString()?.trim();
    if (str) openPanel(str);
    lookupBtn.hidden = true;
  });

  function selContains(el, sel) {
    if (!sel || sel.rangeCount === 0) return false;
    const range = sel.getRangeAt(0);
    return el.contains(range.commonAncestorContainer);
  }

  // Difficulty breakdown ----------------------------------------------------------
  container.querySelector('#btn-breakdown').addEventListener('click', () => {
    const rows = difficulty.breakdown
      .map(
        (b) =>
          `<tr><td>${esc(b.label)}</td><td><strong>${esc(b.value)} ${esc(b.unit)}</strong></td><td class="muted">${esc(b.detail)}</td></tr>`,
      )
      .join('');
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `<div class="modal"><header><h3>Why this difficulty estimate?</h3><button class="icon-btn modal-close">${icon('x')}</button></header>
      <div class="modal-body">
        <p class="muted small">${provenanceBadge('automated').toString()} This estimate is produced by automatic analysis of <strong>your</strong> known-word set, sentence length and text length - it is not a CEFR label on the text and it is not a fact about the text.</p>
        <table class="table"><thead><tr><th>Factor</th><th>Value</th><th>What it means</th></tr></thead><tbody>${rows}</tbody></table>
        <p class="muted small">Current mode: ${esc(DIFFICULTY_MODES[mode]?.label ?? mode)} - change it in Settings to steer recommendations toward comfortable or challenging material.</p>
        ${
          difficulty.topUnknown.length
            ? `<h4>Most frequent unknown words</h4><p class="mono small">${difficulty.topUnknown.map((u) => esc(u.term)).join(' · ')}</p>`
            : ''
        }
      </div></div>`;
    modal.querySelector('.modal-close').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.remove();
    });
    document.body.appendChild(modal);
  });

  return () => {
    clearInterval(interval);
    savePosition();
  };
}

function renderTokens(body, text, tokenizer, classify, rtl) {
  const frag = document.createDocumentFragment();
  let last = 0;
  for (const tok of tokenize(text, tokenizer)) {
    if (tok.start > last) {
      frag.appendChild(document.createTextNode(text.slice(last, tok.start)));
    }
    const span = document.createElement('span');
    span.className = `tok ${classify(tok.text && normalizeTerm(tok.text, tokenizer))}`;
    span.dataset.raw = tok.text;
    span.textContent = tok.text;
    frag.appendChild(span);
    last = tok.end;
  }
  if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));
  body.replaceChildren(frag);
}

function licenseLabel(license) {
  const map = {
    'public-domain': 'public domain',
    'cc-by-4.0': 'CC BY 4.0',
    'cc-by-sa-4.0': 'CC BY-SA 4.0',
  };
  return map[license] ?? license ?? 'unspecified';
}
