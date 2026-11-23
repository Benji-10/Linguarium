/**
 * Reading library: your texts plus the shared starter library.
 *
 * One language at a time, deliberately: everything on this page is filtered to
 * the ACTIVE learning language - there is no "all languages" view, because
 * cross-language material is confusion, not immersion. Counts of texts in
 * other languages are shown as a hint only.
 *
 * The import center covers the platform's import vision:
 *   - paste a text (keep its source information: author, URL, license)
 *   - upload .txt / .html / .epub (parsed in the browser, ruby-aware)
 *   - import from a URL (fetched server-side, previewed, you confirm metadata)
 *   - the open library: Project Gutenberg, Wikisource, Wikipedia, Wikinews
 *     and curated news feeds - searched by API in the active language
 *   - AI-generated texts (Gemini, optional, provenance 'ai')
 * Provenance is a first-class concern: real content keeps its attribution,
 * adaptations keep the original work's information, AI content says so.
 */

import { icon, esc, toast, modal, emptyState, provenanceBadge, spinner } from '../ui/components.mjs';
import { getState, setState, languageName } from '../core/store.mjs';
import { navigate } from '../core/router.mjs';
import { api } from '../core/api.mjs';
import { loadTexts } from '../core/data.mjs';
import { LICENSE_OPTIONS, DIFFICULTY_MODES, PROFICIENCY_LEVELS } from '../shared/constants.mjs';
import { extractFromFile } from '../shared/filetext.mjs';

export async function renderReading(container) {
  const state = getState();
  container.innerHTML = `${spinner('Loading your library')}`;
  if (!state.textsLoaded) {
    await loadTexts();
    setState({ textsLoaded: true });
  }

  // PWA share target: another app shared a passage with Linguarium; the
  // import center opens with the paste tab prefilled with it.
  let sharePayload = null;
  try {
    const raw = sessionStorage.getItem('linguarium.sharePayload');
    if (raw) {
      sessionStorage.removeItem('linguarium.sharePayload');
      sharePayload = JSON.parse(raw);
    }
  } catch {
    /* malformed payload: ignored */
  }

  const draw = () => {
    const s = getState();
    const activeLang = s.activeLanguage;
    const langLabel = activeLang ? languageName(s.languages, activeLang) : null;

    // One language at a time - the whole page is the active language.
    const myTexts = (s.texts ?? []).filter((t) => !activeLang || t.language_code === activeLang);
    const myHidden = (s.texts ?? []).length - myTexts.length;
    const sharedForLang = (s.sharedTexts ?? []).filter(
      (t) => !activeLang || t.language_code === activeLang,
    );
    const sharedHidden = (s.sharedTexts ?? []).length - sharedForLang.length;

    container.innerHTML = `
      <section class="page-head">
        <div>
          <h1>${icon('book')}Reading</h1>
          <p class="muted">${
            activeLang
              ? `Your ${esc(langLabel)} library - import, paste or generate texts, then read them actively: click words to keep them.`
              : 'Pick an active language in the sidebar to focus your library.'
          }</p>
        </div>
        <button class="btn primary" id="btn-add-text">${icon('plus')}Import a text</button>
      </section>

      <section class="panel">
        <div class="panel-head">
          <h2>Your texts</h2>
          <span class="muted small">${esc(langLabel ?? 'no language')} · ${myTexts.length}</span>
        </div>
        ${
          myTexts.length === 0
            ? emptyState({
                iconName: 'book',
                title: activeLang ? `No ${esc(langLabel)} texts yet` : 'No texts yet',
                message: 'Paste one, upload a file, import from the open library or generate one with AI. Everything you add is yours and exportable.',
              })
            : textRowsHtml(myTexts, 'user')
        }
        ${myHidden > 0 ? `<p class="muted small">${myHidden} text${myHidden === 1 ? '' : 's'} in other languages ${myHidden === 1 ? 'is' : 'are'} hidden while you study ${esc(langLabel ?? 'this language')}.</p>` : ''}
      </section>

      <section class="panel">
        <div class="panel-head">
          <h2>Shared starter library</h2>
          <span class="muted small">${esc(langLabel ?? '')} · ${sharedForLang.length} of ${(s.sharedTexts ?? []).length}</span>
        </div>
        ${textRowsHtml(sharedForLang, 'shared')}
        ${sharedHidden > 0 ? `<p class="muted small">${sharedHidden} shared text${sharedHidden === 1 ? '' : 's'} in other languages ${sharedHidden === 1 ? 'is' : 'are'} hidden - switching the active language switches the shelf.</p>` : ''}
      </section>
    `;
    container.querySelector('#btn-add-text')?.addEventListener('click', () => openImportCenter(activeLang));
    container.querySelectorAll('[data-delete]').forEach((btn) =>
      btn.addEventListener('click', async () => {
        const id = btn.dataset.delete;
        if (!confirm('Delete this text? Reading progress for it is also removed.')) return;
        try {
          await api('/api/texts', { method: 'DELETE', params: { id } });
          await loadTexts();
          draw();
          toast('Text deleted.', 'pos');
        } catch (err) {
          toast(err.message ?? 'Could not delete.', 'neg');
        }
      }),
    );
    // The share payload (from another app's share sheet) pre-opens the
    // import center with the shared passage.
    if (sharePayload) {
      const payload = sharePayload;
      if (activeLang) {
        sharePayload = null;
        openImportCenter(activeLang, { prefilled: payload });
      } else {
        // No active language yet: keep the payload for after the user picks one.
        try {
          sessionStorage.setItem('linguarium.sharePayload', JSON.stringify(payload));
        } catch {
          /* storage unavailable */
        }
        toast('Pick an active language first - then "Import a text" will hold the shared passage.', 'info');
      }
    }
  };

  draw();
  return () => {};
}

function textRowsHtml(texts, kind) {
  const state = getState();
  const rows = texts
    .map((t) => {
      const langName = languageName(state.languages, t.language_code);
      return `
      <div class="text-row">
        <a class="text-main" href="#/read/${kind}/${esc(t.id)}">
          <strong>${esc(t.title)}</strong>
          <span class="muted small">${esc(langName)}${t.author ? ` - ${esc(t.author)}` : ''} - ${fmtLen(t.body_length ?? t.body?.length ?? 0)}</span>
        </a>
        <div class="text-side">
          ${provenanceBadge(t.provenance)}
          ${kind === 'user' ? `<button class="icon-btn text-delete" data-delete="${esc(t.id)}" title="Delete this text">${icon('trash')}</button>` : ''}
        </div>
      </div>`;
    })
    .join('');
  if (!rows) {
    return `<p class="muted small" style="margin:8px 0">No ${kind === 'user' ? '' : 'shared '}texts for this language. ${kind === 'user' ? 'Import one above.' : 'Import your own from the open library - the seeded shelf is deliberately small.'}</p>`;
  }
  return `<div class="text-rows" data-kind="${kind}">${rows}</div>`;
}

function fmtLen(n) {
  const words = Math.max(0, Math.round(Number(n) / 6));
  if (words > 1000) return `${Math.round(words / 100) / 10}k words`;
  return `${words} words`;
}

// -----------------------------------------------------------------------
// The import center: one modal, six ways to bring a text in.
// -----------------------------------------------------------------------

const TABS = [
  { id: 'paste', label: 'Paste', hint: 'Text you have on hand - keep its source details.' },
  { id: 'upload', label: 'Upload', hint: 'A .txt, .html or .epub file from your device.' },
  { id: 'url', label: 'URL', hint: 'An article or story on the web, fetched for you.' },
  { id: 'library', label: 'Open library', hint: 'Project Gutenberg, Wikisource, Wikipedia, Wikinews, news feeds.' },
  { id: 'ai', label: 'Generate (AI)', hint: 'A new text written for you by the optional AI.' },
];

function openImportCenter(languageCode, { prefilled = null } = {}) {
  if (!languageCode) {
    toast('Pick an active language first - texts are imported per language.', 'info');
    return;
  }
  const s = getState();
  const langLabel = languageName(s.languages, languageCode);
  const ai = s.aiStatus ?? { available: false };
  const tabs = TABS.filter((t) => (t.id === 'ai' ? ai.available : true));

  const m = modal({
    title: `Import a ${esc(langLabel)} text`,
    bodyHtml: `
      <div class="import-tabs" role="tablist">
        ${tabs
          .map(
            (t, i) =>
              `<button class="btn subtle small import-tab ${i === 0 ? 'active' : ''}" data-tab="${t.id}" role="tab">${esc(t.label)}</button>`,
          )
          .join('')}
      </div>
      <p class="muted small" id="import-hint">${esc(tabs[0]?.hint ?? '')}</p>
      <div id="import-panel"></div>
    `,
    actionsHtml: `<button class="btn subtle" data-close>Close</button>`,
  });
  m.el.querySelector('[data-close]').addEventListener('click', m.close);

  const panel = m.el.querySelector('#import-panel');
  const hint = m.el.querySelector('#import-hint');
  const renderers = {
    paste: renderPasteTab,
    upload: renderUploadTab,
    url: renderUrlTab,
    library: renderLibraryTab,
    ai: renderGenerateTab,
  };
  const switchTab = (id) => {
    m.el.querySelectorAll('.import-tab').forEach((b) => b.classList.toggle('active', b.dataset.tab === id));
    const tab = tabs.find((t) => t.id === id);
    hint.textContent = tab?.hint ?? '';
    panel.innerHTML = '';
    renderers[id]?.(panel, m, languageCode, { prefilled });
  };
  m.el.querySelectorAll('.import-tab').forEach((b) =>
    b.addEventListener('click', () => switchTab(b.dataset.tab)),
  );
  switchTab(tabs[0]?.id ?? 'paste');
}

function sourceFieldsHtml(prefix, { withPaste = false } = {}) {
  const licenseOptions = LICENSE_OPTIONS.map(
    (o) => `<option value="${esc(o.value)}">${esc(o.label)}</option>`,
  ).join('');
  return `
    <label>Title <input id="${prefix}-title" required maxlength="300" placeholder="e.g. Hansel and Gretel (opening)"></label>
    ${withPaste ? `<label>Text <textarea id="${prefix}-body" rows="9" required placeholder="Paste the text here, or pick a file in the Upload tab."></textarea></label>` : ''}
    <label class="file-label">Or upload a .txt / .html / .epub file <input id="${prefix}-file" type="file" accept=".txt,.html,.htm,.epub,text/plain,text/html,application/epub+zip"></label>
    <details class="source-details" open>
      <summary>Source and license <span class="muted small">(required for honest provenance)</span></summary>
      <label>Author / original creator <input id="${prefix}-author" maxlength="300" placeholder="e.g. Brüder Grimm"></label>
      <label>Source URL <input id="${prefix}-source" type="url" maxlength="1000" placeholder="https://... (if it came from the web)"></label>
      <label>License
        <select id="${prefix}-license">${licenseOptions}</select>
      </label>
      <label>Adaptation note <input id="${prefix}-adaptation" maxlength="2000" placeholder="Only if you adapted or simplified the original - describe what changed"></label>
    </details>`;
}

function saveText(body, { navigateToReader = true } = {}) {
  return api('/api/texts', { method: 'POST', body }).then(async (data) => {
    await loadTexts();
    toast('Text added. Happy reading.', 'pos');
    if (navigateToReader) navigate(`#/read/user/${data.text.id}`);
    return data.text;
  });
}

// ---- Paste tab -----------------------------------------------------------------

function renderPasteTab(panel, modalRef, languageCode, { prefilled = null } = {}) {
  panel.innerHTML = `
    <form class="stack" id="paste-form">
      ${sourceFieldsHtml('t', { withPaste: true })}
      <button class="btn primary" id="t-save" type="button">${icon('check')}Add text</button>
    </form>`;
  const el = (id) => panel.querySelector(`#${id}`);

  // Prefill from another app's share sheet (Web Share Target).
  if (prefilled) {
    if (prefilled.text) el('t-body').value = String(prefilled.text).slice(0, 200000);
    if (prefilled.title) el('t-title').value = String(prefilled.title).slice(0, 300);
    if (prefilled.url) el('t-source').value = String(prefilled.url).slice(0, 1000);
    if (!prefilled.title && prefilled.url) {
      toast('Shared from another app - check the source details before saving.', 'info');
    }
  }

  el('t-file').addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const extracted = await extractFromFile(file);
      el('t-body').value = extracted.text.slice(0, 200000);
      if (!el('t-title').value) el('t-title').value = extracted.title ?? file.name;
      if (extracted.chapters > 1) toast(`Loaded ${extracted.chapters} chapters from the EPUB.`, 'info');
      if (extracted.truncated) toast('The file is longer than the import limit - only the first part is loaded.', 'warn');
    } catch (err) {
      toast(err.message ?? 'Could not read that file.', 'neg');
    }
  });

  el('t-save').addEventListener('click', async () => {
    const g = (id) => el(id)?.value?.trim();
    const body = el('t-body').value;
    if (!g('t-title') || !body) {
      toast('A title and the text body are required.', 'warn');
      return;
    }
    try {
      await saveText({
        language_code: languageCode,
        title: g('t-title'),
        body,
        author: g('t-author') || null,
        source_url: g('t-source') || null,
        license: g('t-license') || 'unspecified',
        adaptation_note: g('t-adaptation') || null,
      });
      modalRef.close();
    } catch (err) {
      toast(err.message ?? 'Could not save the text.', 'neg');
    }
  });
}

// ---- Upload tab ----------------------------------------------------------------

function renderUploadTab(panel, modalRef, languageCode) {
  panel.innerHTML = `
    <form class="stack" id="upload-form">
      <label class="file-label">Choose a file (.txt, .html, .epub) <input id="u-file" type="file" accept=".txt,.html,.htm,.epub,text/plain,text/html,application/epub+zip"></label>
      <div id="u-preview" class="import-preview" hidden>
        <p class="muted small" id="u-meta"></p>
        <textarea id="u-body" rows="8" aria-label="Extracted text - edit before saving"></textarea>
      </div>
      ${sourceFieldsHtml('u')}
      <button class="btn primary" id="u-save" type="button" disabled>${icon('check')}Add text</button>
    </form>`;
  const el = (id) => panel.querySelector(`#${id}`);
  let extracted = null;

  el('u-file').addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      extracted = await extractFromFile(file);
      el('u-body').value = extracted.text.slice(0, 200000);
      el('u-preview').hidden = false;
      el('u-save').disabled = false;
      el('u-meta').textContent =
        extracted.kind === 'epub'
          ? `EPUB - ${extracted.chapters} chapter${extracted.chapters === 1 ? '' : 's'}${extracted.title ? ` - "${extracted.title}"` : ''}${extracted.truncated ? ' (first part only - the book is longer)' : ''}. Check and edit the text and the source details before saving.`
          : `${extracted.kind.toUpperCase()} file${extracted.title ? ` - "${extracted.title}"` : ''}. Check the text and the source details before saving.`;
      if (!el('u-title').value) el('u-title').value = extracted.title ?? file.name.replace(/\.[a-z]+$/i, '');
      if (extracted.truncated) toast('The file is longer than the import limit - only the first part is loaded.', 'warn');
    } catch (err) {
      toast(err.message ?? 'Could not read that file.', 'neg');
    }
  });

  el('u-save').addEventListener('click', async () => {
    const g = (id) => el(id)?.value?.trim();
    const body = el('u-body').value;
    if (!g('u-title') || !body) {
      toast('A title and the text body are required.', 'warn');
      return;
    }
    try {
      await saveText({
        language_code: languageCode,
        title: g('u-title'),
        body,
        author: g('u-author') || null,
        source_url: g('u-source') || null,
        license: g('u-license') || 'unspecified',
        adaptation_note: g('u-adaptation') || (extracted?.kind === 'epub' ? `Imported from the EPUB file "${el('u-file').files?.[0]?.name ?? ''}".` : null),
      });
      modalRef.close();
    } catch (err) {
      toast(err.message ?? 'Could not save the text.', 'neg');
    }
  });
}

// ---- URL tab -------------------------------------------------------------------

function renderUrlTab(panel, modalRef, languageCode) {
  panel.innerHTML = `
    <form class="stack" id="url-form">
      <label>URL <input id="w-url" type="url" required maxlength="1000" placeholder="https://... article, story or wikisource page"></label>
      <button class="btn primary" id="w-fetch" type="button">${icon('download')}Fetch and preview</button>
      <div id="w-result" hidden>
        <p class="muted small" id="w-meta"></p>
        <textarea id="w-body" rows="8" aria-label="Fetched text - edit before saving"></textarea>
        ${sourceFieldsHtml('w')}
        <button class="btn primary" id="w-save" type="button">${icon('check')}Add text</button>
      </div>
    </form>`;
  const el = (id) => panel.querySelector(`#${id}`);

  el('w-fetch').addEventListener('click', async () => {
    const url = el('w-url').value.trim();
    if (!url) {
      toast('Paste the URL first.', 'warn');
      return;
    }
    el('w-fetch').disabled = true;
    el('w-fetch').innerHTML = `${icon('download').toString()}Fetching...`;
    try {
      const data = await api('/api/import-source', {
        method: 'POST',
        body: { mode: 'url', url, language_code: languageCode },
      });
      el('w-result').hidden = false;
      el('w-body').value = data.text.slice(0, 200000);
      el('w-meta').textContent = data.truncated
        ? `${data.truncated_note ?? 'Truncated.'}`
        : 'Fetched below - review it, then check the source details and save.';
      if (!el('w-title').value) el('w-title').value = data.title ?? url.split('/').filter(Boolean).pop() ?? '';
      if (!el('w-source').value) el('w-source').value = url;
      if (!el('w-author').value) el('w-author').value = '';
    } catch (err) {
      toast(err.message ?? 'That URL could not be fetched.', 'neg');
    } finally {
      el('w-fetch').disabled = false;
      el('w-fetch').innerHTML = `${icon('download').toString()}Fetch and preview`;
    }
  });

  el('w-save').addEventListener('click', async () => {
    const g = (id) => el(id)?.value?.trim();
    const body = el('w-body').value;
    if (!g('w-title') || !body) {
      toast('A title and the text body are required.', 'warn');
      return;
    }
    try {
      await saveText({
        language_code: languageCode,
        title: g('w-title'),
        body,
        author: g('w-author') || null,
        source_url: g('w-source') || el('w-url').value.trim() || null,
        license: g('w-license') || 'unspecified',
        adaptation_note: g('w-adaptation') || null,
      });
      modalRef.close();
    } catch (err) {
      toast(err.message ?? 'Could not save the text.', 'neg');
    }
  });
}

// ---- Open library tab ----------------------------------------------------------

const LIBRARY_PROVIDERS = [
  { id: 'gutenberg', label: 'Project Gutenberg', license: 'public domain' },
  { id: 'wikisource', label: 'Wikisource', license: 'varies per work' },
  { id: 'wikipedia', label: 'Wikipedia', license: 'CC BY-SA' },
  { id: 'wikinews', label: 'Wikinews', license: 'CC BY 2.5' },
  { id: 'news', label: 'News feeds', license: 'check the article' },
];

function renderLibraryTab(panel, modalRef, languageCode) {
  panel.innerHTML = `
    <div class="stack">
      <div class="library-controls">
        <select id="l-provider" aria-label="Source">
          ${LIBRARY_PROVIDERS.map((p) => `<option value="${p.id}">${esc(p.label)} - ${esc(p.license)}</option>`).join('')}
        </select>
        <input id="l-query" maxlength="200" placeholder="Search (title, topic, author...) - leave empty to browse the language shelf">
        <button class="btn primary small" id="l-search">${icon('compass')}Search</button>
      </div>
      <p class="muted small" id="l-note">Free, keyless sources in your active language only - importing keeps the source's license and attribution.</p>
      <div id="l-results"></div>
    </div>`;
  const el = (id) => panel.querySelector(`#${id}`);
  const results = el('l-results');
  // Page cursor for providers that paginate (Project Gutenberg).
  let currentPage = 1;

  const itemRowsHtml = (items) =>
    `<div class="stack">${items
      .map(
        (it) => `
        <div class="library-item">
          <div class="library-item-main">
            <strong>${esc(it.title)}</strong>
            <span class="muted small">${esc(it.author ?? 'unattributed')}${it.description ? ` - ${esc(it.description)}` : ''}</span>
            <span class="muted small">${esc(it.license ?? '')}${it.source_url ? ` - <a href="${esc(it.source_url)}" target="_blank" rel="noopener noreferrer">source</a>` : ''}</span>
          </div>
          <button class="btn subtle small" data-import-ref="${esc(it.ref)}" data-import-provider="${esc(it.provider)}" data-import-title="${esc(it.title)}">${icon('download')}Import</button>
        </div>`,
      )
      .join('')}</div>`;

  const pagerHtml = (data) => {
    if (!data?.pages) return '';
    const pager = [];
    if (data.pages.previous && currentPage > 1) pager.push(`<button class="btn subtle small" data-page="${currentPage - 1}">${icon('chevron')}Previous page</button>`);
    if (data.pages.count != null) pager.push(`<span class="muted small">page ${currentPage} of ${Math.ceil(data.pages.count / 32)} - ${data.pages.count} books in this language</span>`);
    if (data.pages.next) pager.push(`<button class="btn subtle small" data-page="${currentPage + 1}">Next page${icon('chevron')}</button>`);
    return pager.length ? `<div class="library-controls" style="margin-top:10px">${pager.join(' ')}</div>` : '';
  };

  const search = async (page = 1) => {
    const provider = el('l-provider').value;
    const q = el('l-query').value.trim();
    currentPage = page;
    results.innerHTML = `${spinner(page > 1 ? 'Loading page ' + page : 'Searching')}`;
    try {
      const data = await api('/api/catalog', { params: { provider, language: languageCode, q, page } });
      el('l-note').textContent =
        data.note ??
        (data.failed_feeds?.length ? `Feed unavailable: ${data.failed_feeds.join(', ')} - try again later.` : "Free, keyless sources in your active language only - importing keeps the source's license and attribution.");
      if ((data.items ?? []).length === 0) {
        results.innerHTML =
          '<p class="muted small">No results. Try another provider or another search - the open sources are unevenly stocked per language.</p>';
        return;
      }
      results.innerHTML = itemRowsHtml(data.items) + pagerHtml(data);
    } catch (err) {
      // The open catalogue can refuse (rate limit, Cloudflare, a slow
      // upstream) - that is an expected condition, not a crash: offer a
      // retry and the other providers instead of a dead end.
      results.innerHTML = `
        <div class="import-preview" style="padding:12px">
          <p class="muted small" style="margin:0 0 8px">${esc(err.message ?? 'The catalogue did not respond.')}</p>
          <button class="btn subtle small" id="l-retry">${icon('review')}Retry</button>
        </div>`;
      results.querySelector('#l-retry')?.addEventListener('click', () => search(1));
      return;
    }
    results.querySelectorAll('[data-page]').forEach((btn) =>
      btn.addEventListener('click', () => search(Number(btn.dataset.page))),
    );
    results.querySelectorAll('[data-import-ref]').forEach((btn) =>
      btn.addEventListener('click', async () => {
        btn.disabled = true;
        btn.innerHTML = `${icon('download').toString()}Importing...`;
        try {
          const data = await api('/api/import-source', {
            method: 'POST',
            body: {
              mode: 'provider',
              provider: btn.dataset.importProvider,
              ref: btn.dataset.importRef,
              language_code: languageCode,
            },
          });
          if (data.truncated) toast('The source is longer than the import limit - the first part was imported (the text says so).', 'info');
          await loadTexts();
          toast('Imported into your library.', 'pos');
          modalRef.close();
          navigate(`#/read/user/${data.text.id}`);
        } catch (err) {
          btn.disabled = false;
          btn.innerHTML = `${icon('download').toString()}Import`;
          toast(err.message ?? 'The import failed.', 'neg');
        }
      }),
    );
  };

  el('l-search').addEventListener('click', () => search(1));
  el('l-query').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') search(1);
  });
  // Opening the tab browses the language shelf immediately (the fast route
  // per provider); failures above render a retry instead of raw errors.
  search(1);
}

// ---- AI generate tab -----------------------------------------------------------

const GENERATE_KINDS = ['story', 'news', 'essay', 'dialogue', 'letter'];
const GENERATE_LENGTHS = [
  { value: 'short', label: 'Short - 200-350 words' },
  { value: 'medium', label: 'Medium - 450-700 words' },
  { value: 'long', label: 'Long - 1000-1500 words' },
];
const GENERATE_BANDS = ['comfortable', 'stretch', 'challenge'];

/** Default difficulty band for the generator: the declared level says more
 *  than the difficulty mode does ("complete beginner in Korean, fluent in
 *  French") - the mode stays for material recommendations. */
function bandForProfile(profile) {
  if (profile?.level) {
    const found = PROFICIENCY_LEVELS.find((l) => l.value === profile.level);
    if (found) return found.band;
  }
  return profile?.difficulty_mode ?? 'stretch';
}

function renderGenerateTab(panel, modalRef, languageCode) {
  const s = getState();
  const profile = (s.profiles ?? []).find((p) => p.language_code === languageCode);
  const langLabel = languageName(s.languages, languageCode);
  const defaultBand = bandForProfile(profile);
  panel.innerHTML = `
    <form class="stack" id="gen-form">
      <label>Topic or idea <span class="muted small">(optional - leave empty and the server picks a fresh one for you, never repeating a topic you already generated)</span>
        <input id="g-topic" maxlength="300" placeholder="e.g. an old lighthouse keeper who finds a message in a bottle - or leave empty for a surprise">
      </label>
      <label>Kind
        <select id="g-kind">${GENERATE_KINDS.map((k) => `<option value="${k}">${k}</option>`).join('')}</select>
      </label>
      <label>Length
        <select id="g-length">${GENERATE_LENGTHS.map((l) => `<option value="${l.value}" ${l.value === 'medium' ? 'selected' : ''}>${esc(l.label)}</option>`).join('')}</select>
      </label>
      <label>Difficulty
        <select id="g-band">${GENERATE_BANDS.map((b) => `<option value="${b}" ${b === defaultBand ? 'selected' : ''}>${b}</option>`).join('')}</select>
      </label>
      <p class="muted small">Written by gemini-3.1-flash-lite for you in ${esc(langLabel)}, personalized with your own vocabulary. The prompt bans the usual AI register (no clichés, no rule-of-three, no moralizing close). The saved text is provenance <span class="badge warn">ai</span> and says exactly how it was made.${profile?.level ? ` Difficulty starts from your declared level (${esc(PROFICIENCY_LEVELS.find((l) => l.value === profile.level)?.label ?? profile.level)}) - change it in Settings.` : ''}</p>
      <button class="btn primary" id="g-go" type="button">${icon('wand')}Generate</button>
    </form>`;
  const el = (id) => panel.querySelector(`#${id}`);

  el('g-go').addEventListener('click', async () => {
    const topic = el('g-topic').value.trim();
    // Personalization: the learner's own known and in-learning terms for this
    // language feed the prompt (the server caps and validates them again).
    const entries = (getState().entries ?? []).filter((e) => e.language_code === languageCode);
    const knownTerms = entries.slice(0, 120).map((e) => e.term);
    const unknownTerms = entries.slice(120, 160).map((e) => e.term);
    const btn = el('g-go');
    btn.disabled = true;
    btn.innerHTML = `${icon('wand').toString()}Writing...`;
    try {
      const data = await api('/api/generate-text', {
        method: 'POST',
        body: {
          language_code: languageCode,
          topic,
          kind: el('g-kind').value,
          length: el('g-length').value,
          target_band: el('g-band').value,
          gloss_language: profile?.gloss_language ?? 'en',
          known_terms: knownTerms,
          unknown_terms: unknownTerms,
        },
      });
      await loadTexts();
      const gen = data.generation ?? {};
      if (gen.auto_topic) {
        toast(`Topic picked for you: "${gen.topic}"${gen.pool_reset ? ' (the pool restarted - every theme has been used once)' : ''}. Generated and saved.`, 'pos');
      } else {
        toast('Generated and saved to your library.', 'pos');
      }
      modalRef.close();
      navigate(`#/read/user/${data.text.id}`);
    } catch (err) {
      btn.disabled = false;
      btn.innerHTML = `${icon('wand').toString()}Generate`;
      toast(err.message ?? 'The generation failed.', 'neg');
    }
  });
}
