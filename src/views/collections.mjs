/**
 * Collections: study sets with import (CSV/JSON/plain text) and export.
 *
 * The import rule: nothing that fails to parse is thrown away. Unparsed
 * items stay in the collection with their raw content until you fix them.
 * Parsed items can be promoted into the vocabulary (they then join the
 * shared knowledge state like any entry).
 */

import { icon, esc, toast, modal, spinner, emptyState } from '../ui/components.mjs';
import { getState } from '../core/store.mjs';
import { navigate } from '../core/router.mjs';
import { api } from '../core/api.mjs';
import { loadCollections } from '../core/data.mjs';
import { parseImport, toCsv, toJson } from '../shared/parsers.mjs';
import { getCachedCollectionItems, cacheCollectionItems } from '../core/idb.mjs';
import { languageName } from '../core/store.mjs';

export async function renderCollections(container, params) {
  if (params?.id) return renderCollectionDetail(container, params.id);
  container.innerHTML = `${spinner('Loading collections')}`;

  if (!(getState().collections ?? []).length) {
    await loadCollections();
  }

  const draw = () => {
    const s = getState();
    container.innerHTML = `
      <section class="page-head">
        <div>
          <h1>${icon('library')}Collections</h1>
          <p class="muted">Word lists and phrase books. Import CSV, JSON or plain text; export any time. Nothing you import is lost for being unparseable.</p>
        </div>
        <button class="btn primary" id="btn-new">${icon('plus')}New collection</button>
      </section>

      <section class="panel">
        ${(s.collections ?? []).length === 0
          ? emptyState({
              iconName: 'library',
              title: 'No collections yet',
              message: 'Create one and paste a word list, or drop in a CSV/JSON export from another tool.',
            })
          : `<div class="coll-rows">${(s.collections ?? []).map(collRowHtml).join('')}</div>`}
      </section>
    `;
    container.querySelector('#btn-new')?.addEventListener('click', openNew);
    container.querySelectorAll('[data-coll]').forEach((row) =>
      row.addEventListener('click', (e) => {
        if (e.target.closest('button')) return;
        navigate(`#/collections/${row.dataset.coll}`);
      }),
    );
    container.querySelectorAll('[data-delete-coll]').forEach((btn) =>
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (!confirm('Delete this collection and all its items?')) return;
        try {
          await api('/api/collections', { method: 'DELETE', params: { id: btn.dataset.deleteColl } });
          await loadCollections();
          draw();
          toast('Collection deleted.', 'pos');
        } catch (err) {
          toast(err.message ?? 'Delete failed.', 'neg');
        }
      }),
    );
  };

  const openNew = () => {
    const s = getState();
    const langOptions = (s.languages ?? [])
      .map((l) => `<option value="${esc(l.code)}" ${l.code === (s.activeLanguage ?? 'en') ? 'selected' : ''}>${esc(l.name)}</option>`)
      .join('');
    const m = modal({
      title: 'New collection',
      bodyHtml: `
        <form class="stack">
          <label>Name <input id="c-name" required maxlength="200" placeholder="e.g. Toki Pona core words"></label>
          <label>Language <select id="c-language">${langOptions}</select></label>
          <label>Description <input id="c-desc" maxlength="2000" placeholder="Optional"></label>
          <label>Source URL <input id="c-source" type="url" maxlength="1000" placeholder="If the list comes from somewhere (optional)"></label>
        </form>`,
      actionsHtml: `<button class="btn subtle" data-close>Cancel</button><button class="btn primary" id="c-save">Create</button>`,
    });
    m.el.querySelector('[data-close]').addEventListener('click', m.close);
    m.el.querySelector('#c-save').addEventListener('click', async () => {
      const g = (id) => m.el.querySelector(`#${id}`).value.trim();
      if (!g('c-name')) {
        toast('A name is required.', 'warn');
        return;
      }
      try {
        await api('/api/collections', {
          method: 'POST',
          body: {
            name: g('c-name'),
            language_code: g('c-language'),
            description: g('c-desc') || null,
            source_url: g('c-source') || null,
          },
        });
        await loadCollections();
        m.close();
        draw();
        toast('Collection created.', 'pos');
      } catch (err) {
        toast(err.message ?? 'Could not create it.', 'neg');
      }
    });
  };

  draw();
  return () => {};
}

function collRowHtml(c) {
  return `
  <div class="coll-row" data-coll="${esc(c.id)}">
    <div class="coll-main">
      <strong>${esc(c.name)}</strong>
      <span class="muted small">${esc(languageName(getState().languages, c.language_code))} - ${c.item_count ?? 0} items${c.unparsed_count ? ` (${c.unparsed_count} need attention)` : ''}</span>
    </div>
    <div class="coll-side">
      <button class="icon-btn" data-import-coll="${esc(c.id)}" title="Import into this collection">${icon('upload')}</button>
      <button class="icon-btn" data-delete-coll="${esc(c.id)}" title="Delete collection">${icon('trash')}</button>
    </div>
  </div>`;
}

async function renderCollectionDetail(container, id) {
  container.innerHTML = `${spinner('Loading the collection')}`;

  let collection = null;
  let items = [];
  try {
    const data = await api('/api/collections', { params: { id } });
    collection = data.collection;
    items = data.items ?? [];
    await cacheCollectionItems(id, items);
  } catch (err) {
    collection = (getState().collections ?? []).find((c) => c.id === id);
    items = await getCachedCollectionItems(id);
  }
  if (!collection) {
    container.innerHTML =
      '<section class="panel error-panel"><h2>Collection unavailable</h2><p class="muted">It could not be loaded and is not in the offline cache.</p><a class="btn" href="#/collections">Back</a></section>';
    return;
  }

  const draw = () => {
    const parsed = items.filter((i) => i.parsed);
    const unparsed = items.filter((i) => !i.parsed);

    container.innerHTML = `
      <section class="page-head">
        <div>
          <a class="crumb" href="#/collections">${icon('chevron')}Collections</a>
          <h1>${esc(collection.name)}</h1>
          <p class="muted">${esc(languageName(getState().languages, collection.language_code))} - ${items.length} items${unparsed.length ? ` - ${unparsed.length} unparsed (kept)` : ''}${collection.description ? ` - ${esc(collection.description)}` : ''}</p>
        </div>
        <div class="coll-tools">
          <button class="btn primary" id="btn-import">${icon('upload')}Import</button>
          <button class="btn subtle" id="btn-export-csv">${icon('download')}CSV</button>
          <button class="btn subtle" id="btn-export-json">${icon('download')}JSON</button>
        </div>
      </section>

      ${
        unparsed.length
          ? `<section class="panel warn-panel">
              <div class="panel-head"><h2>${icon('alert')}Needs attention (${unparsed.length})</h2>
              <span class="muted small">kept, not lost - fix them here</span></div>
              <div class="unparsed-rows">${unparsed.map(unparsedRowHtml).join('')}</div>
            </section>`
          : ''
      }

      <section class="panel">
        <div class="panel-head"><h2>Items (${parsed.length})</h2></div>
        ${
          parsed.length === 0
            ? emptyState({
                iconName: 'upload',
                title: 'No parsed items yet',
                message: 'Import a word list (CSV, JSON or plain text) to fill this collection.',
              })
            : `<table class="table">
                <thead><tr><th>#</th><th>Term</th><th>Definition</th><th></th></tr></thead>
                <tbody>${parsed.map(itemRowHtml).join('')}</tbody>
              </table>`
        }
      </section>
    `;

    container.querySelector('#btn-import').addEventListener('click', () => openImport(collection));
    container.querySelector('#btn-export-csv').addEventListener('click', () => {
      downloadFile(`${collection.name}.csv`, 'text/csv', toCsv(items));
    });
    container.querySelector('#btn-export-json').addEventListener('click', () => {
      downloadFile(`${collection.name}.json`, 'application/json', toJson({ ...collection, items }));
    });

    container.querySelectorAll('[data-promote]').forEach((btn) =>
      btn.addEventListener('click', () => promoteItem(items.find((i) => i.id === btn.dataset.promote))),
    );
    container.querySelectorAll('[data-fix]').forEach((row) =>
      row.querySelector('button[data-fix-save]')?.addEventListener('click', () =>
        fixUnparsed(row, unparsed.find((i) => i.id === row.dataset.fix)),
      ),
    );
    container.querySelectorAll('[data-delete-item]').forEach((btn) =>
      btn.addEventListener('click', async () => {
        try {
          await api('/api/collection-items', { method: 'DELETE', params: { id: btn.dataset.deleteItem } });
          items = items.filter((i) => i.id !== btn.dataset.deleteItem);
          draw();
          toast('Item removed.', 'pos');
        } catch (err) {
          toast(err.message ?? 'Could not delete item.', 'neg');
        }
      }),
    );
  };

  const unparsedRowHtml = (item) => `
    <div class="unparsed-row" data-fix="${esc(item.id)}">
      <code class="raw-chunk">${esc(item.raw)}</code>
      <span class="muted small">${esc(item.reason ?? 'Could not be parsed')}</span>
      <div class="fix-row">
        <input placeholder="term" maxlength="300">
        <input placeholder="definition (optional)" maxlength="2000">
        <button class="btn small primary" data-fix-save>Fix</button>
      </div>
    </div>`;

  const itemRowHtml = (item) => `
    <tr>
      <td class="muted">${item.position}</td>
      <td class="mono">${esc(item.term)}</td>
      <td class="muted">${esc((item.definition ?? '').slice(0, 90))}</td>
      <td>
        <button class="btn subtle small" data-promote="${esc(item.id)}" title="Add to your vocabulary">${icon('plus')}Keep</button>
        <button class="icon-btn" data-delete-item="${esc(item.id)}" title="Remove">${icon('trash')}</button>
      </td>
    </tr>`;

  const fixUnparsed = async (row, item) => {
    const [termInput, defInput] = row.querySelectorAll('input');
    const term = termInput.value.trim();
    if (!term) {
      toast('Enter the term to fix this item.', 'warn');
      return;
    }
    try {
      await api('/api/collection-items', {
        method: 'PUT',
        body: { id: item.id, term, definition: defInput.value.trim() || null, parsed: true },
      });
      items = items.map((i) => (i.id === item.id ? { ...i, term, definition: defInput.value.trim() || null, parsed: true } : i));
      draw();
      toast('Item fixed.', 'pos');
    } catch (err) {
      toast(err.message ?? 'Could not fix the item.', 'neg');
    }
  };

  const promoteItem = async (item) => {
    if (!item) return;
    try {
      const { existing } = await api('/api/entries', {
        method: 'POST',
        body: {
          language_code: collection.language_code,
          term: item.term,
          definition: item.definition ?? '',
          reading: item.extra?.reading ?? null,
          part_of_speech: item.extra?.part_of_speech ?? null,
          example: item.extra?.example ?? null,
          notes: item.extra?.notes ?? null,
          source_type: 'user-imported',
          source_ref: `Collection: ${collection.name}`,
          collection_id: collection.id,
        },
      });
      toast(existing ? 'Already in your vocabulary.' : `"${item.term}" added to your vocabulary.`, existing ? 'info' : 'pos');
    } catch (err) {
      toast(err.message ?? 'Could not add the item.', 'neg');
    }
  };

  const openImport = (coll) => {
    const m = modal({
      title: `Import into "${coll.name}"`,
      bodyHtml: `
        <div class="stack">
          <label>Format
            <select id="i-format">
              <option value="">Auto-detect</option>
              <option value="csv">CSV</option>
              <option value="json">JSON</option>
              <option value="txt">Plain text</option>
            </select>
          </label>
          <label>Content
            <textarea id="i-text" rows="10" placeholder="Paste CSV, JSON or plain text here, or load a file below.&#10;&#10;Plain text: one item per line, optionally "term - definition".&#10;CSV: columns like term,definition,reading,...&#10;JSON: an array of objects with a term field."></textarea>
          </label>
          <label class="file-label">Or load a file <input id="i-file" type="file" accept=".csv,.json,.txt,.tsv,text/csv,application/json,text/plain"></label>
          <div id="i-preview"></div>
        </div>`,
      actionsHtml: `<button class="btn subtle" data-close>Cancel</button><button class="btn primary" id="i-import">Import</button>`,
    });
    m.el.querySelector('[data-close]').addEventListener('click', m.close);

    const preview = () => {
      const text = m.el.querySelector('#i-text').value;
      const fmt = m.el.querySelector('#i-format').value || null;
      if (!text.trim()) {
        m.el.querySelector('#i-preview').innerHTML = '';
        return;
      }
      const result = parseImport(text, fmt);
      m.el.querySelector('#i-preview').innerHTML = `
        <p class="muted small">Detected: <strong>${esc(result.format)}</strong> - ${result.items.filter((i) => i.parsed).length} parsed, ${result.unparsedCount} unparsed (they will be kept, not lost).</p>`;
    };
    m.el.querySelector('#i-text').addEventListener('input', preview);
    m.el.querySelector('#i-format').addEventListener('change', preview);
    m.el.querySelector('#i-file').addEventListener('change', async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      m.el.querySelector('#i-text').value = await file.text();
      preview();
    });

    m.el.querySelector('#i-import').addEventListener('click', async () => {
      const text = m.el.querySelector('#i-text').value;
      if (!text.trim()) {
        toast('Paste or load something first.', 'warn');
        return;
      }
      const fmt = m.el.querySelector('#i-format').value || null;
      const result = parseImport(text, fmt);
      if (result.items.length === 0) {
        toast('Nothing recognizable was found in that content.', 'warn');
        return;
      }
      try {
        const res = await api('/api/collection-items', {
          method: 'POST',
          body: { collection_id: coll.id, items: result.items },
        });
        m.close();
        toast(
          `Imported ${res.inserted} items${res.unparsed_count ? ` - ${res.unparsed_count} unparsed kept for review` : ''}.`,
          'pos',
        );
        const data = await api('/api/collections', { params: { id: coll.id } });
        collection = data.collection;
        items = data.items ?? [];
        draw();
      } catch (err) {
        toast(err.message ?? 'Import failed.', 'neg');
      }
    });
  };

  draw();
  return () => {};
}

function downloadFile(name, type, content) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
