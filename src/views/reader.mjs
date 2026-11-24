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

import { icon, raw, esc, toast, modal, spinner, provenanceBadge, statusBadge } from '../ui/components.mjs';
import { getState, setState, tokenizerFor, languageName, isRightToLeft } from '../core/store.mjs';
import { api } from '../core/api.mjs';
import { navigate } from '../core/router.mjs';
import { tokenize, normalizeTerm } from '../shared/tokenizer.mjs';
import { parseRuby, readingMapFor } from '../shared/ruby.mjs';
import { conjugatedReading, surfaceReadingFromDict, inflectionMatch, indexByHead } from '../shared/flection.mjs';
import { paginate } from '../shared/parsers.mjs';
import { segmentDictionaryFor } from '../core/data.mjs';
import { scoreText } from '../shared/difficulty.mjs';
import { deriveStatus } from '../shared/status.mjs';
import { DIFFICULTY_MODES } from '../shared/constants.mjs';
import { getCachedText, putCachedText, cacheEnrichment, getEnrichment, getCachedLookup, cacheLookup } from '../core/idb.mjs';
import { attachListenBar } from '../shared/listen.mjs';

const RUBY_MODE_KEY = (lang) => `linguarium.ruby.${lang}`;

/** A token only earns furigana/pinyin when it actually contains Han
 *  characters (Kanji for Japanese, Hanzi for Chinese). */
const HAN_SCRIPT_RE = /\p{Script=Han}/u;

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

  // Ruby annotations: inline parenthetical readings (furigana/pinyin) are
  // parsed out of the text so it stays clean and screen readers are not
  // fed the readings as sentence content; they render as real <ruby>.
  const { clean, marks } = parseRuby(text.body ?? '');
  const rubyBases = marks.map((m) => m.base);

  // Dictionary segmentation: shared lexicon + own vocabulary + this text's
  // ruby bases. Japanese/Chinese words emerge instead of single characters.
  const segDict = tokenizer.charLevel ? await segmentDictionaryFor(language, rubyBases) : { dictionary: null, readings: new Map() };
  const dictionary = segDict.dictionary;

  // Vocabulary readings for ruby on words the text does not annotate.
  const vocabReadings = readingMapFor(
    (state.entries ?? []).filter((e) => e.language_code === language),
    tokenizer,
  );
  for (const [term, reading] of segDict.readings ?? []) vocabReadings.set(term, reading);

  // Knowledge classification for highlighting. Inflected Japanese forms
  // (眠っている) count as known/learning when the dictionary form (眠る) is:
  // the inflection matcher (shared/flection.mjs) resolves the surface back
  // to its base word using auditable grammar tables.
  const entriesByNorm = new Map();
  for (const e of state.entries.filter((e) => e.language_code === language)) {
    entriesByNorm.set(e.normalized, e);
  }
  const entriesByHead = indexByHead(
    state.entries
      .filter((e) => e.language_code === language)
      .flatMap((e) => [[e.term, e], ...(e.normalized && e.normalized !== e.term ? [[e.normalized, e]] : [])]),
  );
  const classify = (norm, raw) => {
    let entry = entriesByNorm.get(norm);
    if (!entry && raw) {
      const m = inflectionMatch(raw, entriesByHead);
      if (m) entry = m.value;
    }
    if (!entry) return 'unknown';
    const { tier } = deriveStatus(entry, entry.memories ?? {});
    if (tier === 'mastered' || tier === 'reliably_recalled') return 'known';
    if (tier === 'recognized' || tier === 'learning' || tier === 'unencountered') return 'learning';
    return 'unknown';
  };

  // Difficulty estimate (automated provenance) - computed on the cleaned
  // text with the same segmentation the reader displays.
  const tokens = tokenize(clean, tokenizer, dictionary);
  const knownSet = new Set(
    state.entries
      .filter((e) => e.language_code === language)
      .map((e) => e.normalized),
  );
  const difficulty = scoreText({ text: clean, tokenizer, knownSet, dictionary });

  // ---- Pagination for long texts (Apple-Books-style pages) -----------------------
  // Gutenberg books run to hundreds of thousands of characters: rendering one
  // page at a time keeps layout fast, reading comfortable (a real page turn,
  // not an endless scroll), and the position saveable per page. Short texts
  // produce a single page and render exactly as before.
  const cjkLike = Boolean(tokenizer.charLevel) || /\p{Script=Han}|\p{Script=Hiragana}|\p{Script=Katakana}/u.test(clean.slice(0, 400));
  const pages = paginate(clean, cjkLike ? 700 : 1800);

  // Ruby display toggle (per language, persisted). Annotations are parsed
  // out of the text either way; the toggle only hides/shows the ruby text.
  const langHasRuby = marks.length > 0 || language === 'ja' || language === 'zh';
  let showRuby = localStorage.getItem(RUBY_MODE_KEY(language));
  if (showRuby === null) showRuby = marks.length > 0 ? '1' : '0';
  const rubyLabel = language === 'zh' ? 'Pinyin' : 'Furigana';

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
        ${langHasRuby ? `<button class="btn subtle ${showRuby === '1' ? '' : 'toggled-off'}" id="btn-ruby" title="Show or hide ${rubyLabel.toLowerCase()} readings above the words">${icon('sound')}${rubyLabel}${showRuby === '1' ? ' on' : ' off'}</button>` : ''}
        <button class="btn subtle" id="btn-share" title="Share this text with other apps">${icon('share')}Share</button>
        <button class="btn subtle" id="btn-adapt" title="Adapt this text to your level (AI, optional)">${icon('wand')}Adapt</button>
        <a class="btn subtle" href="#/reading">${icon('x')}Close</a>
      </div>
    </section>

    <div class="reader-body ${rtl ? 'rtl' : ''}" id="reader-body" dir="${rtl ? 'rtl' : 'ltr'}" lang="${esc(language)}"></div>

    <div class="reader-pager" id="reader-pager" hidden>
      <button class="btn subtle small" id="pg-prev" title="Previous page (left arrow)">${icon('chevronLeft')}Previous</button>
      <span class="pager-info" id="pg-info"></span>
      <button class="btn subtle small" id="pg-next" title="Next page (right arrow)">Next${icon('chevron')}</button>
    </div>
    <p class="muted small" id="pg-hint" style="text-align:center" hidden></p>

    <div class="listen-bar" id="listen-bar" hidden>
      <button class="btn subtle small" id="listen-play">${icon('headphones')}Listen</button>
      <button class="icon-btn" id="listen-prev" title="Previous sentence">${icon('chevronLeft')}</button>
      <button class="icon-btn" id="listen-next" title="Next sentence">${icon('chevron')}</button>
      <span class="muted small" id="listen-note"></span>
    </div>
    <div id="listen-audio"></div>

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

    <div class="selection-bar" id="selection-bar" hidden role="toolbar" aria-label="Actions for the selected text">
      <button class="btn subtle small" data-sel-lookup title="Open the word panel for the selection">${icon('globe')}Look up</button>
      <button class="btn subtle small" data-sel-passage title="Save the selected sentences as a new short text">${icon('plus')}Save passage</button>
      <button class="btn subtle small" data-sel-deck title="Add the selection to one of your collections">${icon('library')}Add to deck</button>
    </div>
  `;

  const body = container.querySelector('#reader-body');
  const pager = container.querySelector('#reader-pager');
  const pagerInfo = container.querySelector('#pg-info');
  const pagerHint = container.querySelector('#pg-hint');

  // Reading-session reading sources, declared before renderBody so a
  // re-render (page turn, ruby toggle) can merge what reading has learned.
  const lookups = new Map(); // norm -> dictionary lookup payload (may carry readings)
  const enrichments = new Map(); // norm -> AI enrichment payload (may carry readings)

  // Effective ruby readings: vocabulary + segmentation dictionary (computed
  // once above) MERGED with anything the reading session has since learned -
  // dictionary lookups and AI analyses carry readings, so a word looked up
  // once gets furigana immediately (that is what makes the furigana toggle
  // visibly do something on texts that carry no inline annotations).
  // Readings are stored under the DICTIONARY term (jisho returns 眠る for a
  // clicked 眠っている), and the render pass derives the inflected surface
  // reading from them - the old behaviour stamped ねむる over 眠っている.
  const effectiveReadings = () => {
    const merged = new Map(vocabReadings);
    for (const [norm, enr] of enrichments) {
      const reading = enr?.payload?.reading;
      if (typeof reading !== 'string' || !reading) continue;
      const derived = surfaceReadingFromDict(norm, reading);
      merged.set(norm, derived ?? reading);
    }
    for (const [norm, lk] of lookups) {
      for (const e of lk?.entries ?? []) {
        if (typeof e?.reading !== 'string' || !e.reading) continue;
        // Readings attach to the ENTRY's own headword when it has one
        // (jisho returns 眠る for a clicked 眠っている); Wiktionary entries
        // carry no term field - they were fetched FOR the looked-up word, so
        // that word is the headword.
        const key = typeof e?.term === 'string' && e.term ? normalizeTerm(e.term, tokenizer) : norm;
        merged.set(key, e.reading);
      }
    }
    return merged;
  };

  // Reading progress restore: pages first (new format), then the legacy
  // scroll-position format (page 1 + scrollTo).
  let currentPage = 1;
  if (Number.isFinite(Number(savedPosition.page))) {
    currentPage = Math.min(pages.length, Math.max(1, Number(savedPosition.page) || 1));
  }

  let rubyHintShown = false;
  const renderBody = () => {
    const page = pages[currentPage - 1];
    const readings = showRuby === '1' ? effectiveReadings() : null;
    renderTokens(body, clean, tokenizer, classify, rtl, {
      dictionary,
      rubyMarks: marks,
      vocabReadings: readings,
      showRuby: showRuby === '1',
      pageStart: page.start,
      pageEnd: page.end,
    });

    // Pager: hidden for one-page texts (the old experience, unchanged).
    if (pager) {
      pager.hidden = pages.length <= 1;
      if (!pager.hidden) {
        const percent = Math.round((page.end / Math.max(1, clean.length)) * 100);
        pagerInfo.textContent = `page ${currentPage} of ${pages.length} · ${percent}% · ${fmtLen2(clean.length)} characters`;
        container.querySelector('#pg-prev').disabled = currentPage <= 1;
        container.querySelector('#pg-next').disabled = currentPage >= pages.length;
      }
    }
    // Honest note when ruby is on but this text has no readings to show yet
    // (no inline annotations, nothing in vocabulary/lexicon/lookups): the
    // toggle is not broken - it has nothing to render, and it will light up
    // as words gain readings while reading.
    if (pagerHint) {
      const noReadings =
        showRuby === '1' && marks.length === 0 && (readings?.size ?? 0) === 0 && body.querySelectorAll('ruby').length === 0;
      pagerHint.hidden = !noReadings;
      if (noReadings) {
        pagerHint.textContent =
          `${rubyLabel} is on, but no readings are known for this text yet - readings come from your vocabulary, the shared lexicon, dictionary lookups and AI analyses done while reading; words you look up gain readings immediately.`;
      }
      if (noReadings && !rubyHintShown) {
        rubyHintShown = true;
        toast(
          `${rubyLabel}: nothing to annotate yet in this text. Look words up while reading (Look up in dictionaries) - their readings appear here instantly.`,
          'info',
        );
      }
    }
  };
  renderBody();

  const goToPage = (next) => {
    const target = Math.min(pages.length, Math.max(1, next));
    if (target === currentPage) return;
    currentPage = target;
    renderBody();
    const y = (body.getBoundingClientRect().top ?? 0) + window.scrollY - 70;
    window.scrollTo({ top: Math.max(0, y), behavior: 'smooth' });
    savePosition();
  };
  container.querySelector('#pg-prev')?.addEventListener('click', () => goToPage(currentPage - 1));
  container.querySelector('#pg-next')?.addEventListener('click', () => goToPage(currentPage + 1));
  const onKey = (e) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return;
    if (!container.isConnected) return;
    if (e.key === 'ArrowLeft') goToPage(currentPage - 1);
    if (e.key === 'ArrowRight') goToPage(currentPage + 1);
  };
  document.addEventListener('keydown', onKey);

  // Ruby toggle: hides/shows the <rt> readings. The annotation text stays
  // parsed out of the body either way - the inline parenthetical form is
  // never rendered.
  container.querySelector('#btn-ruby')?.addEventListener('click', (e) => {
    showRuby = showRuby === '1' ? '0' : '1';
    localStorage.setItem(RUBY_MODE_KEY(language), showRuby);
    const btn = e.currentTarget;
    btn.classList.toggle('toggled-off', showRuby !== '1');
    btn.innerHTML = `${icon('sound')}${rubyLabel}${showRuby === '1' ? ' on' : ' off'}`;
    renderBody();
  });

  // Share the text with other apps via the Web Share API (no-op on desktop
  // browsers without it - the button reports that honestly).
  container.querySelector('#btn-share')?.addEventListener('click', async () => {
    const shareData = { title: text.title, text: clean.slice(0, 4000), url: text.source_url ?? undefined };
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share(shareData);
      } catch {
        /* user dismissed the sheet */
      }
    } else {
      try {
        await navigator.clipboard.writeText(clean.slice(0, 4000));
        toast('Sharing is not available in this browser - the text was copied to the clipboard instead.', 'info');
      } catch {
        toast('Sharing is not available in this browser.', 'warn');
      }
    }
  });

  // Automatic adaptation (phase 3): re-level THIS text toward a target band
  // computed against the learner's own knowledge state. The result is stored
  // as a new ADAPTED user text that keeps the original work's metadata and
  // carries an honest adaptation note; provenance 'ai', never 'verified'.
  container.querySelector('#btn-adapt')?.addEventListener('click', () => openAdaptModal());

  const openAdaptModal = () => {
    const ai = getState().aiStatus ?? { available: false };
    const bands = ['comfortable', 'stretch', 'challenge'];
    // Suggest one band easier than the current estimate by default.
    const suggest = bands[Math.max(0, bands.indexOf(difficulty.band) - 1)] ?? 'comfortable';
    if (!ai.available) {
      modal({
        title: 'Text adaptation is not configured',
        bodyHtml: `
          <p>This deployment has no <code>GEMINI_API_KEY</code>, so the optional AI adapter is disabled - reading, review and everything else work exactly as before.</p>
          <p class="muted small">Adaptation is an optional feature by design (see Settings - Privacy / the AI policy): it needs a configured key and is always provenance-labelled 'ai'.</p>`,
        actionsHtml: '<button class="btn subtle" data-close>Close</button>',
      });
      return;
    }
    const m = modal({
      title: 'Adapt this text',
      bodyHtml: `
        <p>Simplify or re-level <strong>${esc(text.title)}</strong> toward a target difficulty band, computed against <strong>your</strong> current knowledge state (currently ${Math.round(difficulty.familiarity * 100)}% familiar, estimated ${DIFFICULTY_MODES[difficulty.band]?.label ?? difficulty.band}).</p>
        <p class="muted small">The adaptation is written by <code>gemini-3.1-flash-lite</code> and stored as a NEW text in your library: provenance <span class="badge warn">ai</span>, the original's author, source and license stay attached, and an adaptation note describes what changed. The original text is never modified.</p>
        <label>Target band
          <select id="adapt-band">
            ${bands
              .map((b) => `<option value="${b}" ${b === suggest ? 'selected' : ''}>${DIFFICULTY_MODES[b].label} - ${DIFFICULTY_MODES[b].description.toLowerCase()}</option>`)
              .join('')}
          </select>
        </label>
        <p class="muted small">Long texts (over 12,000 characters) are too long for one adaptation pass - split them first if needed.</p>`,
      actionsHtml: `<button class="btn subtle" data-close>Cancel</button><button class="btn primary" id="adapt-go">${icon('wand')}Adapt this text</button>`,
    });
    m.el.querySelector('[data-close]').addEventListener('click', m.close);
    m.el.querySelector('#adapt-go').addEventListener('click', async (e) => {
      const btn = e.currentTarget;
      btn.disabled = true;
      btn.innerHTML = `${icon('wand')}Adapting...`;
      // Hints computed from THIS text against the learner's known terms: the
      // model keeps known terms and works around the unknown ones.
      const freq = new Map();
      for (const t of tokens) {
        const norm = normalizeTerm(t.text, tokenizer);
        if (!norm) continue;
        freq.set(norm, (freq.get(norm) ?? 0) + 1);
      }
      const ranked = [...freq.entries()].sort((a, b) => b[1] - a[1]);
      const knownTerms = ranked.filter(([t]) => knownSet.has(t)).slice(0, 150).map(([t]) => t);
      const unknownTerms = ranked.filter(([t]) => !knownSet.has(t)).slice(0, 150).map(([t]) => t);
      try {
        const data = await api('/api/adapt', {
          method: 'POST',
          body: {
            text_id: id,
            kind,
            target_band: m.el.querySelector('#adapt-band').value,
            known_terms: knownTerms,
            unknown_terms: unknownTerms,
            familiarity: difficulty.familiarity,
          },
        });
        m.close();
        toast('Adapted copy saved to your library - compare it with the original any time.', 'pos');
        navigate(`#/read/user/${data.text.id}`);
      } catch (err) {
        btn.disabled = false;
        btn.innerHTML = `${icon('wand')}Adapt this text`;
        toast(err.message ?? 'The adaptation failed. The original text is untouched.', 'neg');
      }
    });
  };

  // Listening environment (phase 2) --------------------------------------------------
  // Audio referenced by URL plays through a plain <audio> element (never
  // stored as a binary blob); texts without audio are read aloud by the
  // browser's speech system, sentence by sentence, following the transcript.
  // Terms stay clickable while listening - clicking one pauses playback so
  // it can be inspected.
  let stopListen = null;
  {
    const audioUrl = text.audio_url ?? null;
    if (audioUrl) {
      const host = container.querySelector('#listen-audio');
      host.innerHTML = `
        <div class="listen-note-panel">
          <div><strong>Audio for this text</strong> ${icon('headphones')}</div>
          <p class="muted small">Played straight from its source URL - the file is never copied into the database. Sentence highlighting is not synced to the recording; the transcript below stays clickable.</p>
          <audio controls preload="none" src="${esc(audioUrl)}" style="width:100%; margin-top:8px"></audio>
        </div>`;
      container.querySelector('#listen-bar').hidden = true;
    } else {
      const listen = attachListenBar({ container, language, langLabel });
      stopListen = listen.destroy;
      // Pausing on term click keeps the word panel readable while listening.
      body.addEventListener('click', (e) => {
        if (e.target.closest('.tok') && listen.isPlaying()) listen.pause();
      }, { capture: true });
      // Auto-start when opened from the Listening page.
      try {
        if (sessionStorage.getItem('linguarium.autolisten') === '1') {
          sessionStorage.removeItem('linguarium.autolisten');
          setTimeout(() => listen.play(), 400);
        }
      } catch { /* storage unavailable - just no autoplay */ }
    }
  }

  // Position restore + autosave -------------------------------------------------
  // New format restores the page (and scrolls within it); the legacy
  // scroll-only format is honored for old saves by scrolling on page 1.
  if (savedPosition.scrollTop && currentPage === 1) {
    requestAnimationFrame(() => window.scrollTo({ top: savedPosition.scrollTop }));
  } else if (pages.length > 1) {
    // Arriving on a saved page: put the top of the text at a comfortable
    // position instead of the top of the document.
    const y = (body.getBoundingClientRect().top ?? 0) + window.scrollY - 70;
    if (currentPage > 1) requestAnimationFrame(() => window.scrollTo({ top: Math.max(0, y) }));
  }

  const savePosition = async () => {
    const page = pages[currentPage - 1] ?? { start: 0, end: clean.length };
    const position = {
      page: currentPage,
      pages: pages.length,
      percent: Math.round((page.end / Math.max(1, clean.length)) * 100),
      scrollTop: Math.round(window.scrollY || 0),
    };
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
  const onBeforeUnload = () => savePosition();
  const onVisibility = () => {
    if (document.visibilityState === 'hidden') savePosition();
  };
  window.addEventListener('beforeunload', onBeforeUnload);
  document.addEventListener('visibilitychange', onVisibility);

  const sessionEncounters = new Map(); // norm -> {raw, entryId}
  const pendingEncounters = [];

  // Word panel -------------------------------------------------------------------
  const panel = container.querySelector('#word-panel');

  const openPanel = async (termRaw) => {
    const norm = normalizeTerm(termRaw, tokenizer);
    let entry = entriesByNorm.get(norm);
    // Inflected surface (眠っている): the panel reflects the base word's
    // (眠る) status, so knowledge highlighting and the panel agree.
    if (!entry) {
      const m = inflectionMatch(termRaw, entriesByHead);
      if (m) entry = m.value;
    }
    sessionEncounters.set(norm, { raw: termRaw, entryId: entry?.id ?? null });
    panel.hidden = false;
    panel.classList.add('open');
    container.querySelector('#wp-term').textContent = termRaw;
    const { status } = deriveStatus(entry, entry?.memories ?? {});
    container.querySelector('#wp-badges').innerHTML =
      `${statusBadge(status)}${entry ? provenanceBadge(entry.source_type) : ''}`;
    renderPanelContent(entry, termRaw, norm);
    // Clicking a word IS a lookup request: the dictionary chain (offline
    // cache first, then the online dictionaries) starts on its own. Short
    // words and selections only - a whole dragged passage is not a term.
    if (termRaw.length <= 40 && !lookups.has(norm)) doLookup(termRaw, norm);
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
    const lookup = lookups.get(norm);

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
        lookup
          ? renderLookup(lookup)
          : `<div class="wp-actions"><button class="btn subtle small" data-lookup title="Shared lexicon first, then Wiktionary / free dictionaries - attributed, cached offline">${icon('globe')}Look up in dictionaries</button></div>`
      }

      ${
        enrichment
          ? renderEnrichment(enrichment)
          : ai.available
            ? `<div class="wp-actions"><button class="btn subtle small" data-enrich>${icon('flash')}AI analysis</button></div>`
            : `<p class="muted small ai-off">${icon('info').toString()}AI enrichment is not configured on this deployment. Dictionary lookups still work.</p>`
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
    content.querySelectorAll('[data-lookup]').forEach((b) =>
      b.addEventListener('click', () => doLookup(termRaw, norm)),
    );
  };

  // Dictionary lookup chain: shared lexicon -> online dictionaries
  // (Wiktionary et al, attributed and cached) -> AI stays a separate,
  // explicit action below.
  // (Declared above renderBody so a re-render after a lookup can merge the
  // discovered readings into the ruby layer.)
  const doLookup = async (termRaw, norm) => {
    const content = container.querySelector('#wp-content');
    const btn = content?.querySelector('[data-lookup]');
    btn?.setAttribute('disabled', 'disabled');
    if (btn) btn.innerHTML = `${icon('globe').toString()}Looking up...`;
    let cached = lookups.get(norm);
    if (!cached) {
      cached = await getCachedLookup(language, norm);
    }
    if (cached) {
      lookups.set(norm, cached);
      renderPanelContent(entriesByNorm.get(norm), termRaw, norm);
      // A lookup can carry a reading: re-render the page so furigana shows it.
      renderBody();
      return;
    }
    try {
      const data = await api('/api/lookup', {
        method: 'POST',
        body: { language_code: language, term: termRaw },
      });
      lookups.set(norm, data);
      await cacheLookup(language, norm, data);
      renderPanelContent(entriesByNorm.get(norm), termRaw, norm);
      renderBody();
    } catch (err) {
      toast(err.message ?? 'The lookup failed (offline?).', 'neg');
      if (btn) {
        btn.removeAttribute('disabled');
        btn.innerHTML = `${icon('globe').toString()}Look up in dictionaries`;
      }
    }
  };

  const renderLookup = (data) => {
    const entries = data?.entries ?? [];
    if (entries.length === 0) {
      return `
        <div class="lookup-box">
          <div class="lookup-head">${icon('globe')}<strong>Dictionaries</strong>
            <span class="muted small">${esc(data?.online_cached ? 'cached' : 'no entry')}</span></div>
          <p class="muted small">No dictionary entry for this term yet.${
            data?.ai_fallback_available
              ? ' The explicit AI fallback below can still analyze it (labelled unverified).'
              : ''
          }</p>
        </div>`;
    }
    const rows = entries
      .slice(0, 6)
      .map(
        (e) => `
        <div class="lookup-row">
          <div class="lookup-def">${esc(e.definition)}${e.part_of_speech ? ` <span class="muted small">(${esc(e.part_of_speech)})</span>` : ''}</div>
          ${e.examples?.length ? `<div class="muted small">${e.examples.slice(0, 2).map((x) => esc(x)).join(' - ')}</div>` : ''}
          ${
            e.source === 'lexicon'
              ? '<span class="badge neutral">shared lexicon</span>'
              : `<a class="badge neutral" href="${esc(e.source_url ?? '#')}" target="_blank" rel="noopener noreferrer" title="${esc(e.attribution ?? '')}">${esc(e.attribution ?? e.source)}</a>`
          }
        </div>`,
      )
      .join('');
    return `
      <div class="lookup-box">
        <div class="lookup-head">${icon('globe')}<strong>Dictionaries</strong>
          <span class="muted small">${data?.online_cached ? 'cached' : ''}</span></div>
        ${rows}
      </div>`;
  };

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
      renderBody();
      renderPanelContent(entriesByNorm.get(norm), termRaw, norm);
    } catch (err) {
      toast(err.message ?? 'Could not add the word (offline?). It will not be lost.', 'warn');
    }
  };

  const selfAssess = async (termRaw, norm, entry, rating) => {
    // An honest first review: a self-assessment of existing knowledge,
    // logged as a normal review event (nothing is ever silently "mastered").
    const { review, retentionFor } = await import('../shared/fsrs.mjs');
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
    // Phase 3: the recognition-dimension target retention of this language profile.
    const profile = (getState().profiles ?? []).find((p) => p.language_code === language);
    const result = review(memory, rating, Date.now(), { retention: retentionFor(profile, 'recognition') });
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
    renderBody();
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
      // An AI analysis carries a reading: re-render so furigana shows it.
      renderBody();
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
      renderBody();
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

  // Selection actions (agglutinative / no-space languages + passages) ----
  const selectionBar = container.querySelector('#selection-bar');
  const currentSelection = () => {
    const sel = window.getSelection();
    const str = sel?.toString()?.trim() ?? '';
    return str && selContains(body, sel) ? str : null;
  };
  const onSelectionChange = () => {
    const str = currentSelection();
    if (!str || str.length > 400) {
      selectionBar.hidden = true;
      return;
    }
    selectionBar.hidden = false;
  };
  document.addEventListener('selectionchange', onSelectionChange);
  selectionBar.querySelector('[data-sel-lookup]').addEventListener('click', () => {
    const str = currentSelection();
    if (str) openPanel(str);
    selectionBar.hidden = true;
  });
  // Save the selected passage as a new short text with the parent's provenance.
  selectionBar.querySelector('[data-sel-passage]').addEventListener('click', async () => {
    const str = currentSelection();
    selectionBar.hidden = true;
    if (!str || str.length < 5) {
      toast('Select a few words first.', 'info');
      return;
    }
    try {
      const { text: saved } = await api('/api/texts', {
        method: 'POST',
        body: {
          language_code: language,
          title: `Passage - ${text.title}`.slice(0, 300),
          body: str,
          author: text.author ?? null,
          source_url: text.source_url ?? null,
          license: text.license ?? 'unspecified',
          adaptation_note: `Passage saved while reading "${text.title}" (provenance ${text.provenance ?? 'unknown'}).`,
        },
      });
      toast('Passage saved to your library.', 'pos');
      const { loadTexts } = await import('../core/data.mjs');
      await loadTexts();
      navigate(`#/read/user/${saved.id}`);
    } catch (err) {
      toast(err.message ?? 'Could not save the passage (offline?).', 'warn');
    }
  });
  // Add the selected word/phrase to one of your collections (decks).
  selectionBar.querySelector('[data-sel-deck]').addEventListener('click', async () => {
    const str = currentSelection();
    selectionBar.hidden = true;
    if (!str) return;
    await openAddToDeck(str);
  });

  const openAddToDeck = async (term) => {
    if (!(getState().collections ?? []).length) {
      const { loadCollections } = await import('../core/data.mjs');
      await loadCollections().catch(() => {});
    }
    const collections = (getState().collections ?? []).filter((c) => c.language_code === language);
    const rows = collections
      .map((c) => `<button class="btn subtle small deck-pick" data-deck="${esc(c.id)}">${icon('library')}${esc(c.name)} <span class="muted small">${(c.item_count ?? '')}</span></button>`)
      .join('');
    const m = modal({
      title: 'Add to a collection',
      bodyHtml: `
        <p>Add <strong class="mono">${esc(term)}</strong> to:</p>
        <div class="stack">${rows || '<p class="muted small">No collections for this language yet.</p>'}</div>
        <label>New collection <input id="deck-new-name" maxlength="200" placeholder="e.g. From ${esc(languageName(getState().languages, language))} reading"></label>`,
      actionsHtml: `<button class="btn subtle" data-close>Cancel</button>`,
    });
    m.el.querySelector('[data-close]').addEventListener('click', m.close);
    m.el.querySelectorAll('[data-deck]').forEach((btn) =>
      btn.addEventListener('click', () => addToDeck(m, term, btn.dataset.deck, null)),
    );
    m.el.querySelector('#deck-new-name')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') addToDeck(m, term, null, e.target.value.trim());
    });
  };

  const addToDeck = async (m, term, collectionId, newName) => {
    try {
      if (!collectionId) {
        if (!newName) {
          toast('Name the new collection first.', 'warn');
          return;
        }
        const created = await api('/api/collections', {
          method: 'POST',
          body: { language_code: language, name: newName, description: 'Kept while reading.' },
        });
        collectionId = created.collection.id;
      }
      await api('/api/collection-items', {
        method: 'POST',
        body: { collection_id: collectionId, items: [{ raw: term, parsed: true, term }] },
      });
      m.close();
      toast('Added to the collection - open Collections to study it.', 'pos');
    } catch (err) {
      toast(err.message ?? 'Could not add it (offline?).', 'warn');
    }
  };

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
    // The overlay fades in via .in (an opacity transition). Without this
    // class it stays opacity:0 - invisible but covering the whole page,
    // which reads as a frozen screen that no longer responds to clicks.
    requestAnimationFrame(() => modal.classList.add('in'));
  });

  return () => {
    // Leave nothing behind: the reader adds document/window-level listeners
    // (keyboard paging, autosave, selection bar) that MUST go when the view
    // is left - a second text open would otherwise stack another set.
    clearInterval(interval);
    savePosition();
    if (stopListen) stopListen();
    document.removeEventListener('keydown', onKey);
    document.removeEventListener('selectionchange', onSelectionChange);
    window.removeEventListener('beforeunload', onBeforeUnload);
    document.removeEventListener('visibilitychange', onVisibility);
  };
}

function renderTokens(
  body,
  text,
  tokenizer,
  classify,
  rtl,
  { dictionary = null, rubyMarks = [], vocabReadings = null, showRuby = false, pageStart = 0, pageEnd = null } = {},
) {
  const frag = document.createDocumentFragment();
  // Marks sorted by offset; lookup of the mark covering a token position.
  // Offsets are GLOBAL (into the whole cleaned text): the page slice is
  // shifted back into global coordinates so annotated readings survive
  // pagination.
  const marksByStart = [...rubyMarks].sort((a, b) => a.baseStart - b.baseStart);
  const markAt = (pos) => marksByStart.find((m) => pos >= m.baseStart && pos < m.baseEnd) ?? null;

  const pageText = text.slice(pageStart, pageEnd == null ? text.length : pageEnd);

  // Sentences are wrapped so listening mode can highlight and scroll to one.
  for (const b of sentenceBounds(pageText)) {
    const sent = document.createElement('span');
    sent.className = 'sent';
    let last = b.start;
    const tokens = tokenize(pageText.slice(b.start, b.end), tokenizer, dictionary);
    let i = 0;
    while (i < tokens.length) {
      const tok = tokens[i];
      const absStart = pageStart + b.start + tok.start;
      const absEnd = pageStart + b.start + tok.end;
      const sentStart = b.start + tok.start;
      const sentEnd = b.start + tok.end;
      if (sentStart > last) sent.appendChild(document.createTextNode(pageText.slice(last, sentStart)));

      const mark = markAt(absStart);
      if (mark && absEnd <= mark.baseEnd) {
        // Ruby annotation from the text itself: consecutive tokens inside the
        // base range share one <ruby> with the parsed reading above them.
        const ruby = document.createElement('ruby');
        ruby.className = 'rb rb-annotated';
        let j = i;
        let end = sentEnd;
        while (j < tokens.length) {
          const t = tokens[j];
          const s = pageStart + b.start + t.start;
          const e = pageStart + b.start + t.end;
          if (s >= mark.baseEnd) break;
          ruby.appendChild(tokenSpan(t, tokenizer, classify));
          end = Math.max(end, Math.min(b.start + t.end, pageText.length));
          j += 1;
        }
        const rt = document.createElement('rt');
        rt.textContent = mark.reading;
        if (!showRuby) rt.className = 'rt-hidden';
        ruby.appendChild(rt);
        sent.appendChild(ruby);
        last = end;
        i = j;
        continue;
      }

      // Vocabulary ruby: a reading the learner's data (or a lookup / AI
      // analysis cached this session) already carries. Only tokens that
      // CONTAIN Kanji/Han get furigana or pinyin - annotating a pure-kana
      // word with its own reading is noise ("ここ（ここ）" helps nobody).
      // Inflected forms derive their reading from the dictionary form's
      // reading: 眠っている + 眠る(ねむる) -> ねむっている.
      const norm = normalizeTerm(tok.text, tokenizer);
      const reading =
        showRuby && vocabReadings && HAN_SCRIPT_RE.test(tok.text)
          ? vocabReadings.get(norm) ??
            vocabReadings.get(tok.text) ??
            conjugatedReading(tok.text, (term) => vocabReadings.get(term) ?? vocabReadings.get(normalizeTerm(term, tokenizer)))
          : null;
      if (reading) {
        const ruby = document.createElement('ruby');
        ruby.className = 'rb rb-vocab';
        ruby.appendChild(tokenSpan(tok, tokenizer, classify));
        const rt = document.createElement('rt');
        rt.textContent = reading;
        ruby.appendChild(rt);
        sent.appendChild(ruby);
      } else {
        sent.appendChild(tokenSpan(tok, tokenizer, classify));
      }
      last = sentEnd;
      i += 1;
    }
    if (last < b.end) sent.appendChild(document.createTextNode(pageText.slice(last, b.end)));
    frag.appendChild(sent);
  }
  body.replaceChildren(frag);
}

function fmtLen2(chars) {
  const n = Math.max(0, Number(chars) || 0);
  if (n >= 100000) return `${Math.round(n / 1000)}k`;
  if (n >= 1000) return `${(Math.round(n / 100) / 10).toFixed(1)}k`;
  return String(n);
}

function tokenSpan(tok, tokenizer, classify) {
  const span = document.createElement('span');
  span.className = `tok ${classify(normalizeTerm(tok.text, tokenizer), tok.text)}`;
  span.dataset.raw = tok.text;
  span.textContent = tok.text;
  return span;
}

/** Contiguous sentence ranges: end at . ! ? … 。！？ ؟ or a newline. */
function sentenceBounds(text) {
  const out = [];
  const re = /[.!?…。！？؟\n]/gu;
  let cursor = 0;
  let m;
  while ((m = re.exec(text))) {
    const end = m.index + m[0].length;
    out.push({ start: cursor, end });
    cursor = end;
  }
  if (cursor < text.length) out.push({ start: cursor, end: text.length });
  return out.filter((b) => b.end > b.start);
}

function licenseLabel(license) {
  const map = {
    'public-domain': 'public domain',
    'cc-by-4.0': 'CC BY 4.0',
    'cc-by-sa-4.0': 'CC BY-SA 4.0',
  };
  return map[license] ?? license ?? 'unspecified';
}
