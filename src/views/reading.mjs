/**
 * Reading library: your texts plus the shared starter library.
 * Adding a text requires source information (author, source URL, license),
 * because provenance is a first-class concern - real content keeps its
 * attribution, adaptations keep the original work's information.
 */

import { icon, esc, toast, modal, emptyState, provenanceBadge, spinner } from '../ui/components.mjs';
import { getState, setState } from '../core/store.mjs';
import { navigate } from '../core/router.mjs';
import { api } from '../core/api.mjs';
import { loadTexts } from '../core/data.mjs';
import { scoreText } from '../shared/difficulty.mjs';
import { tokenizerFor, languageName } from '../core/store.mjs';
import { deriveStatus } from '../shared/status.mjs';
import { LICENSE_OPTIONS } from '../shared/constants.mjs';

export async function renderReading(container) {
  const state = getState();
  container.innerHTML = `${spinner('Loading your library')}`;
  if (!state.textsLoaded) {
    await loadTexts();
    setState({ textsLoaded: true });
  }

  const draw = () => {
    const s = getState();
    container.innerHTML = `
      <section class="page-head">
        <div>
          <h1>${icon('book')}Reading</h1>
          <p class="muted">Paste or upload a text, keep its source information, then read it actively: click words to keep them.</p>
        </div>
        <button class="btn primary" id="btn-add-text">${icon('plus')}Add a text</button>
      </section>

      <section class="panel">
        <div class="panel-head"><h2>Your texts</h2><span class="muted small">${(s.texts ?? []).length}</span></div>
        ${(s.texts ?? []).length === 0
          ? emptyState({
              iconName: 'book',
              title: 'No texts yet',
              message: 'Paste or upload a text with its source details. Everything you add is yours and exportable.',
            })
          : textRowsHtml(s.texts, 'user')}
      </section>

      <section class="panel">
        <div class="panel-head"><h2>Shared starter library</h2>
          <span class="muted small">public-domain classics and demo content</span></div>
        ${textRowsHtml(s.sharedTexts ?? [], 'shared')}
      </section>
    `;
    container.querySelector('#btn-add-text')?.addEventListener('click', openAddText);
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
  };

  const openAddText = () => {
    const s = getState();
    const langOptions = (s.languages ?? [])
      .filter((l) => l.kind === 'preset' || l.code === 'en')
      .map((l) => `<option value="${esc(l.code)}">${esc(l.name)}</option>`)
      .join('');
    const licenseOptions = LICENSE_OPTIONS.map(
      (o) => `<option value="${esc(o.value)}">${esc(o.label)}</option>`,
    ).join('');

    const bodyHtml = `
      <form id="add-text-form" class="stack">
        <label>Title <input id="t-title" required maxlength="300" placeholder="e.g. Hansel and Gretel (opening)"></label>
        <label>Language <select id="t-language">${langOptions}</select></label>
        <label>Text
          <textarea id="t-body" rows="9" required placeholder="Paste the text here, or choose a .txt file below."></textarea>
        </label>
        <label class="file-label">Or upload a .txt file <input id="t-file" type="file" accept=".txt,text/plain"></label>
        <details class="source-details" open>
          <summary>Source and license <span class="muted small">(required for honest provenance)</span></summary>
          <label>Author / original creator <input id="t-author" maxlength="300" placeholder="e.g. Brüder Grimm"></label>
          <label>Source URL <input id="t-source" type="url" maxlength="1000" placeholder="https://... (if it came from the web)"></label>
          <label>License
            <select id="t-license">${licenseOptions}</select>
          </label>
          <label>Adaptation note <input id="t-adaptation" maxlength="2000" placeholder="Only if you adapted or simplified the original - describe what changed"></label>
        </details>
      </form>`;

    const m = modal({
      title: 'Add a text',
      bodyHtml,
      actionsHtml: `<button class="btn subtle" data-close>Cancel</button><button class="btn primary" id="t-save">Add text</button>`,
    });

    m.el.querySelector('[data-close]').addEventListener('click', m.close);
    m.el.querySelector('#t-file').addEventListener('change', async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const text = await file.text();
      m.el.querySelector('#t-body').value = text;
      if (!m.el.querySelector('#t-title').value) {
        m.el.querySelector('#t-title').value = file.name.replace(/\.txt$/i, '');
      }
      toast('File loaded - check the source details before saving.', 'info');
    });
    m.el.querySelector('#t-save').addEventListener('click', async () => {
      const g = (id) => m.el.querySelector(`#${id}`).value.trim();
      const body = m.el.querySelector('#t-body').value;
      if (!g('t-title') || !body) {
        toast('A title and the text body are required.', 'warn');
        return;
      }
      try {
        const { text } = await api('/api/texts', {
          method: 'POST',
          body: {
            language_code: g('t-language'),
            title: g('t-title'),
            body,
            author: g('t-author') || null,
            source_url: g('t-source') || null,
            license: g('t-license') || 'unspecified',
            adaptation_note: g('t-adaptation') || null,
          },
        });
        await loadTexts();
        m.close();
        toast('Text added. Happy reading.', 'pos');
        navigate(`#/read/user/${text.id}`);
      } catch (err) {
        toast(err.message ?? 'Could not save the text.', 'neg');
      }
    });
  };

  draw();
  return () => {};
}

function textRowsHtml(texts, kind) {
  const state = getState();
  const activeLang = kind === 'user' ? state.activeLanguage : null;
  const rows = texts
    .filter((t) => !activeLang || t.language_code === activeLang)
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
    return `<p class="muted small" style="margin:8px 0">No texts for the active language. Add one above.</p>`;
  }
  return `<div class="text-rows" data-kind="${kind}">${rows}</div>`;
}

function fmtLen(n) {
  const words = Math.max(0, Math.round(Number(n) / 6));
  if (words > 1000) return `${Math.round(words / 100) / 10}k words`;
  return `${words} words`;
}

