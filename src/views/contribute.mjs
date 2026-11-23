/**
 * Contribute: the community content pipeline (phase 3).
 *
 * Users submit texts, grammar structures and lexicon entries for the shared
 * knowledge base. Every submission carries MANDATORY provenance fields
 * (license, source: an author or a source URL) - the same rules the seed
 * data follows. Nothing goes live directly: submissions wait in the
 * moderation queue; an admin (x-admin-key, see README) approves or rejects,
 * and approved items enter the shared tables with provenance 'community',
 * never 'verified'.
 *
 * Privacy: your submissions reference your account (so you can see their
 * status); the shared tables never do.
 */

import { icon, esc, toast, modal, spinner, emptyState, provenanceBadge } from '../ui/components.mjs';
import { getState } from '../core/store.mjs';
import { api } from '../core/api.mjs';
import { loadProfiles } from '../core/data.mjs';
import { LICENSE_OPTIONS } from '../shared/constants.mjs';

const KIND_TABS = [
  { id: 'text', label: 'Text', hint: 'A reading text for the shared library.' },
  { id: 'grammar', label: 'Grammar structure', hint: 'A structure with explanation and examples.' },
  { id: 'lexicon', label: 'Lexicon entry', hint: 'A community definition for a term.' },
];

let activeKind = 'text';

export async function renderContribute(container) {
  container.innerHTML = `${spinner('Loading contributions')}`;
  const state = getState();
  await loadProfiles();

  let mine = null;
  try {
    const data = await api('/api/contribute');
    mine = data.contributions ?? [];
  } catch {
    mine = null;
  }

  const draw = () => {
    const s = getState();
    const langOptions = (s.languages ?? [])
      .map((l) => `<option value="${esc(l.code)}" ${l.code === s.activeLanguage ? 'selected' : ''}>${esc(l.name)}</option>`)
      .join('');
    const licenseOptions = LICENSE_OPTIONS.filter((o) => o.value !== 'unspecified')
      .map((o) => `<option value="${esc(o.value)}">${esc(o.label)}</option>`)
      .join('');

    container.innerHTML = `
      <section class="page-head">
        <div>
          <h1>${icon('users')}Contribute</h1>
          <p class="muted">Grow the shared library: texts, grammar structures and lexicon entries - moderated, licensed, provenance-labelled.</p>
        </div>
      </section>

      <section class="panel">
        <div class="panel-head"><h2>How this works</h2></div>
        <ol class="contribute-steps muted small">
          <li>You submit content with its <strong>license and source</strong> (an author or a source URL - provenance must be traceable; "unspecified" is rejected).</li>
          <li>The submission waits in the moderation queue. You see its status here; nothing appears in the app until it is approved.</li>
          <li>A site admin reviews it (license and provenance checks) and approves or rejects with a note.</li>
          <li>Approved items enter the shared tables labelled <strong>community</strong> - never "verified" - and appear in Discover, Grammar and Knowledge for everyone.</li>
        </ol>
        <p class="muted small">Etymology and grammar rules must not be invented: submit only what you can trace to a source. Rate-limited (20 submissions per day). See docs/CONTENT.md for the content policy this enforces.</p>
      </section>

      <section class="panel">
        <div class="panel-head"><h2>Submit a contribution</h2>
          <div class="dim-tabs">
            ${KIND_TABS.map((t) => `<button class="chip ${t.id === activeKind ? 'active' : ''}" data-kind-tab="${t.id}">${t.label}</button>`).join('')}
          </div>
        </div>
        <p class="muted small">${KIND_TABS.find((t) => t.id === activeKind)?.hint ?? ''}</p>
        ${contributionFormHtml(activeKind, langOptions, licenseOptions)}
      </section>

      <section class="panel">
        <div class="panel-head"><h2>My submissions</h2><span class="muted small">${mine == null ? 'unavailable' : `${mine.length} total`}</span></div>
        ${
          mine == null
            ? '<p class="muted small">Your submissions could not be loaded (offline?). Reload the page when online.</p>'
            : mine.length === 0
              ? emptyState({ iconName: 'users', title: 'Nothing submitted yet', message: 'Your submissions and their moderation status will appear here.' })
              : `<div class="contribute-rows">${mine.map(submissionRowHtml).join('')}</div>`
        }
      </section>
    `;

    container.querySelectorAll('[data-kind-tab]').forEach((btn) =>
      btn.addEventListener('click', () => {
        activeKind = btn.dataset.kindTab;
        draw();
      }),
    );
    container.querySelector('#c-submit')?.addEventListener('click', () => submitContribution(container, activeKind));
  };

  const submitContribution = async (root, kind) => {
    const g = (id) => {
      const el = root.querySelector(`#${id}`);
      return el ? el.value.trim() : '';
    };
    const language = g('c-language');
    const license = g('c-license');
    const sourceUrl = g('c-source') || null;

    let payload;
    if (kind === 'text') {
      payload = {
        title: g('c-title'),
        body: root.querySelector('#c-body')?.value ?? '',
        author: g('c-author') || null,
        topic: g('c-topic') || null,
        adaptation_note: g('c-adaptation') || null,
      };
    } else if (kind === 'grammar') {
      payload = {
        name: g('c-name'),
        summary: g('c-summary') || null,
        explanation: root.querySelector('#c-explanation')?.value ?? '',
        examples: parseExamples(root.querySelector('#c-examples')?.value ?? ''),
      };
    } else {
      payload = {
        term: g('c-term'),
        definition: root.querySelector('#c-definition')?.value ?? '',
        reading: g('c-reading') || null,
        part_of_speech: g('c-pos') || null,
        gloss_language: g('c-gloss') || 'en',
      };
    }

    try {
      const result = await api('/api/contribute', {
        method: 'POST',
        body: { kind, language_code: language, license, source_url: sourceUrl, payload },
      });
      toast('Submitted for moderation. Thank you.', 'pos');
      mine = (await api('/api/contribute')).contributions ?? [];
      draw();
      if (result?.contribution?.title) {
        toast(`"${result.contribution.title}" is now pending review.`, 'info');
      }
    } catch (err) {
      toast(err.message ?? 'The submission was rejected by validation.', 'neg');
    }
  };

  draw();
  return () => {};
}

/** "text (tab) - translation" lines from the textarea, one example per line. */
function parseExamples(raw) {
  return raw
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const sep = line.lastIndexOf(' - ');
      if (sep > 0) {
        return { text: line.slice(0, sep).trim(), translation: line.slice(sep + 3).trim() };
      }
      return { text: line };
    })
    .slice(0, 12);
}

function contributionFormHtml(kind, langOptions, licenseOptions) {
  const langSelect = `<label>Language <select id="c-language">${langOptions}</select></label>`;
  const sourceBlock = `
      <div class="contribute-source-grid">
        <label>License (mandatory) <select id="c-license">${licenseOptions}</select></label>
        <label>Source URL <input id="c-source" type="url" maxlength="1000" placeholder="https://..."></label>
      </div>`;

  if (kind === 'text') {
    return `
      <form class="stack contribute-form" id="c-form">
        ${langSelect}
        <label>Title <input id="c-title" maxlength="300" placeholder="e.g. The North Wind and the Sun (Esperanto)"></label>
        <label>The full text
          <textarea id="c-body" rows="9" placeholder="Paste the complete text. Public-domain classics or your own writing with a stated license - see docs/CONTENT.md."></textarea>
        </label>
        <div class="contribute-source-grid">
          <label>Author / original creator <input id="c-author" maxlength="300" placeholder="e.g. Aesop / your name"></label>
          <label>Topic tag (optional) <input id="c-topic" maxlength="40" placeholder="e.g. fable, daily-life"></label>
        </div>
        <label>Adaptation note (if you adapted or simplified an original) <input id="c-adaptation" maxlength="2000" placeholder="Describe what changed"></label>
        ${sourceBlock}
        <p class="muted small">A text needs an author or a source URL; without one of the two the submission is rejected - provenance must be traceable.</p>
        <button class="btn primary" id="c-submit">${icon('upload')}Submit for moderation</button>
      </form>`;
  }
  if (kind === 'grammar') {
    return `
      <form class="stack contribute-form" id="c-form">
        ${langSelect}
        <label>Structure name <input id="c-name" maxlength="300" placeholder="e.g. The て-form in Japanese"></label>
        <label>One-line summary <input id="c-summary" maxlength="600" placeholder="What it does, in one line"></label>
        <label>Explanation
          <textarea id="c-explanation" rows="6" placeholder="How the structure works. Only grammar you can trace to a source - no inventions."></textarea>
        </label>
        <label>Examples (one per line: sentence - translation)
          <textarea id="c-examples" rows="4" placeholder="私はりんごを食べます。 - I eat an apple."></textarea>
        </label>
        ${sourceBlock}
        <p class="muted small">At least one example sentence using the structure is required. Cite where your explanation comes from (a textbook page, a reference site) in the source URL when you can.</p>
        <button class="btn primary" id="c-submit">${icon('upload')}Submit for moderation</button>
      </form>`;
  }
  return `
      <form class="stack contribute-form" id="c-form">
        ${langSelect}
        <label>Term <input id="c-term" maxlength="300" placeholder="e.g. kovilo"></label>
        <label>Definition <textarea id="c-definition" rows="3" placeholder="A concise community definition of the term."></textarea></label>
        <div class="contribute-source-grid">
          <label>Reading (optional) <input id="c-reading" maxlength="200" placeholder="e.g. ko.vi.lo"></label>
          <label>Part of speech (optional) <input id="c-pos" maxlength="40" placeholder="e.g. noun"></label>
          <label>Gloss language <select id="c-gloss"><option value="en">en</option><option value="zh">zh</option><option value="es">es</option><option value="fr">fr</option><option value="de">de</option><option value="ja">ja</option><option value="ko">ko</option><option value="ru">ru</option></select></label>
        </div>
        ${sourceBlock}
        <p class="muted small">Definitions must be traceable to a dictionary or reference - link it in the source URL. AI-sounding or invented etymology is rejected in moderation.</p>
        <button class="btn primary" id="c-submit">${icon('upload')}Submit for moderation</button>
      </form>`;
}

function submissionRowHtml(c) {
  const statusBadge =
    c.status === 'approved'
      ? '<span class="badge pos">approved</span>'
      : c.status === 'rejected'
        ? '<span class="badge neg">rejected</span>'
        : '<span class="badge warn">pending review</span>';
  const kindLabels = { text: 'text', grammar: 'grammar structure', lexicon: 'lexicon entry' };
  return `
  <div class="contribute-row">
    <div class="contribute-main">
      <strong>${esc(c.title ?? c.payload?.term ?? c.payload?.name ?? '(untitled)')}</strong>
      <span class="muted small">${esc(kindLabels[c.kind] ?? c.kind)} - ${esc(c.language_code)} - ${esc(c.license)}</span>
      ${c.moderator_note ? `<span class="muted small">Moderator note: ${esc(c.moderator_note)}</span>` : ''}
    </div>
    <div class="contribute-side">${statusBadge}${provenanceBadge('community', { withLabel: false })}</div>
  </div>`;
}
