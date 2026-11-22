/**
 * Knowledge: vocabulary lookup and the entry detail view.
 *
 * One place to see everything known about a term:
 *   - the entry itself (user data),
 *   - FSRS memory per dimension,
 *   - verified etymology when the source provides it (never invented),
 *   - AI analysis clearly labelled 'ai' and kept separate from etymology,
 *   - your own notes.
 */

import { icon, esc, toast, modal, spinner, emptyState, provenanceBadge, statusBadge } from '../ui/components.mjs';
import { getState, setState } from '../core/store.mjs';
import { navigate } from '../core/router.mjs';
import { api } from '../core/api.mjs';
import { deriveStatus, dimensionProgress } from '../shared/status.mjs';
import { memoryRetrievability } from '../shared/fsrs.mjs';
import { DIMENSIONS } from '../shared/constants.mjs';
import { loadEntries } from '../core/data.mjs';
import { cacheEnrichment } from '../core/idb.mjs';

export async function renderKnowledge(container, params) {
  const state = getState();
  container.innerHTML = `${spinner('Loading vocabulary')}`;

  const url = new URLSearchParams((location.hash.split('?')[1] ?? ''));
  const initialQuery = params?.q ?? url.get('q') ?? '';
  let query = initialQuery;
  let language = state.activeLanguage ?? null;
  let statusFilter = 'all';

  if (!getState().entriesLoaded) {
    await loadEntries();
    setState({ entriesLoaded: true });
  }

  const draw = () => {
    const s = getState();
    const all = s.entries ?? [];
    const filtered = all
      .filter((e) => !language || e.language_code === language)
      .filter((e) => !query || e.term.toLowerCase().includes(query.toLowerCase()) || (e.normalized ?? '').includes(query.toLowerCase()) || (e.definition ?? '').toLowerCase().includes(query.toLowerCase()))
      .filter((e) => {
        if (statusFilter === 'all') return true;
        const { status } = deriveStatus(e, e.memories ?? {});
        return status === statusFilter;
      });

    container.innerHTML = `
      <section class="page-head">
        <div>
          <h1>${icon('globe')}Knowledge</h1>
          <p class="muted">Everything known about the words you keep - one shared state for reading, review and collections.</p>
        </div>
        <button class="btn primary" id="btn-add-entry">${icon('plus')}Add an entry</button>
      </section>

      <section class="panel">
        <div class="toolbar">
          <input id="k-search" type="search" placeholder="Search terms, definitions..." value="${esc(query)}">
          <select id="k-language">
            <option value="">All languages</option>
            ${(s.languages ?? [])
              .filter((l) => l.kind === 'preset' || (l.created_by ?? null))
              .map((l) => `<option value="${esc(l.code)}" ${l.code === language ? 'selected' : ''}>${esc(l.name)}</option>`)
              .join('')}
          </select>
          <select id="k-status">
            <option value="all">Any status</option>
            ${['unencountered', 'learning', 'recognized', 'reliably_recalled', 'mastered', 'due']
              .map((st) => `<option value="${st}" ${st === statusFilter ? 'selected' : ''}>${esc(st.replace('_', ' '))}</option>`)
              .join('')}
          </select>
        </div>
        ${
          filtered.length === 0
            ? emptyState({
                iconName: 'globe',
                title: query ? 'No matches' : 'No entries yet',
                message: query
                  ? 'Nothing matched this search. Try a shorter query or another language.'
                  : 'Add entries here, import a collection, or click words while reading - it all lands in one knowledge base.',
              })
            : `<div class="entry-rows">${filtered.slice(0, 300).map(entryRowHtml).join('')}</div>`
        }
        ${filtered.length > 300 ? `<p class="muted small">Showing the first 300 of ${filtered.length}. Narrow the search to see more.</p>` : ''}
      </section>
    `;

    const search = container.querySelector('#k-search');
    search.addEventListener('input', () => {
      query = search.value;
      draw();
    });
    container.querySelector('#k-language').addEventListener('change', (e) => {
      language = e.target.value || null;
      setState({ activeLanguage: language });
      draw();
    });
    container.querySelector('#k-status').addEventListener('change', (e) => {
      statusFilter = e.target.value;
      draw();
    });
    container.querySelector('#btn-add-entry').addEventListener('click', () => openAddEntry(language));

    container.querySelectorAll('[data-entry]').forEach((row) =>
      row.addEventListener('click', () => {
        const entry = (getState().entries ?? []).find((e) => e.id === row.dataset.entry);
        if (entry) openEntryDetail(entry);
      }),
    );
  };

  const entryRowHtml = (e) => {
    const { status } = deriveStatus(e, e.memories ?? {});
    return `<div class="entry-row" data-entry="${esc(e.id)}">
      <div class="entry-term mono">${esc(e.term)}</div>
      <div class="entry-def muted">${esc((e.definition ?? '').slice(0, 120))}</div>
      <div class="entry-side">${statusBadge(status)}${provenanceBadge(e.source_type)}</div>
    </div>`;
  };

  const openEntryDetail = (entry) => {
    const { status, tier } = deriveStatus(entry, entry.memories ?? {});
    const memories = entry.memories ?? {};

    const dimRows = Object.keys(DIMENSIONS)
      .map((dim) => {
        const m = memories[dim];
        const prog = dimensionProgress(m);
        if (!prog.started) {
          return `<tr><td>${DIMENSIONS[dim].label}</td><td colspan="4" class="muted">No reviews yet</td></tr>`;
        }
        const r = memoryRetrievability({ stability: m.stability, lastReview: new Date(m.last_review).getTime() }, Date.now());
        return `<tr>
          <td>${DIMENSIONS[dim].label}</td>
          <td>${Math.round(m.stability * 10) / 10} d stability</td>
          <td>${Math.round(m.difficulty * 10) / 10} difficulty</td>
          <td>${m.reps} reviews${m.lapses ? `, ${m.lapses} lapses` : ''}</td>
          <td>${Math.round(r * 100)}% recall now</td>
        </tr>`;
      })
      .join('');

    const m = modal({
      title: entry.term,
      bodyHtml: `
        <div class="detail-badges">${statusBadge(status)}${provenanceBadge(entry.source_type)}${entry.part_of_speech ? `<span class="badge outline">${esc(entry.part_of_speech)}</span>` : ''}</div>
        ${entry.reading ? `<p class="muted small">Reading: ${esc(entry.reading)}</p>` : ''}
        ${entry.definition ? `<p class="wp-definition">${esc(entry.definition)}</p>` : `<p class="muted">No definition recorded yet.</p>`}
        ${entry.example ? `<p class="wp-example muted small">"${esc(entry.example)}"</p>` : ''}
        ${entry.source_ref ? `<p class="muted small">Source: ${esc(entry.source_ref)}</p>` : ''}

        <h4>Memory state (FSRS-5)</h4>
        <table class="table small"><thead><tr><th>Dimension</th><th>Stability</th><th>Difficulty</th><th>Reps</th><th>Recall</th></tr></thead><tbody>${dimRows}</tbody></table>
        <p class="muted small">${esc(deriveStatus(entry, memories).detail)}</p>

        <h4>Your notes</h4>
        <textarea id="d-notes" rows="3" maxlength="4000" placeholder="Your own notes about this term...">${esc(entry.notes ?? '')}</textarea>

        <div id="d-enrichment">
          <h4>AI analysis <span class="muted small">(optional, always unverified)</span></h4>
          <div id="d-enrich-body">${enrichPlaceholderHtml(entry)}</div>
        </div>

        <div class="detail-actions">
          <button class="btn subtle small" id="d-review">${icon('review')}Review</button>
          <button class="btn subtle small" id="d-edit">${icon('pencil')}Edit</button>
          <button class="btn subtle small danger" id="d-delete">${icon('trash')}Delete</button>
        </div>
      `,
      onClose: () => saveNotes(entry),
    });

    m.el.querySelector('#d-review').addEventListener('click', () => {
      m.close();
      navigate(`#/review?language=${entry.language_code}&dimension=recognition`);
    });
    m.el.querySelector('#d-edit').addEventListener('click', () => {
      m.close();
      openEditEntry(entry);
    });
    m.el.querySelector('#d-delete').addEventListener('click', async () => {
      if (!confirm(`Delete "${entry.term}"? Its review history stays in your backup export until purged.`)) return;
      try {
        await api('/api/entries', { method: 'DELETE', params: { id: entry.id } });
        await loadEntries();
        m.close();
        draw();
        toast('Entry deleted.', 'pos');
      } catch (err) {
        toast(err.message ?? 'Delete failed.', 'neg');
      }
    });
    m.el.querySelector('[data-enrich]')?.addEventListener('click', () => doEnrich(entry, m));

    async function saveNotes(entryRef) {
      const area = m.el.querySelector('#d-notes');
      if (!area || area.value === (entryRef.notes ?? '')) return;
      try {
        await api('/api/entries', {
          method: 'PUT',
          body: { id: entryRef.id, notes: area.value },
        });
        await loadEntries();
        toast('Notes saved.', 'pos');
      } catch (err) {
        toast('Notes not saved - kept in the form. Try again online.', 'warn');
      }
    }
  };

  const enrichPlaceholderHtml = (entry) => {
    const ai = getState().aiStatus;
    const lang = getState().profiles.find((p) => p.language_code === entry.language_code);
    if (!ai.available) {
      return `<p class="muted small ai-off">${icon('info').toString()} AI enrichment is not configured on this deployment (no GEMINI_API_KEY). Everything else works.</p>`;
    }
    return `<button class="btn subtle small" data-enrich>${icon('flash')}Request AI analysis</button>
      <p class="muted small">Uses Gemini (gemini-3.1-flash-lite), ${ai.daily_limit}/day, cached for everyone. Result is labelled AI-generated and is never presented as verified etymology.</p>`;
  };

  const doEnrich = async (entry, m) => {
    const body = m.el.querySelector('#d-enrich-body');
    body.innerHTML = `${spinner('Asking the model')}`;
    try {
      const profile = getState().profiles.find((p) => p.language_code === entry.language_code);
      const data = await api('/api/enrich', {
        method: 'POST',
        body: {
          language_code: entry.language_code,
          term: entry.term,
          gloss_language: profile?.gloss_language ?? 'en',
        },
      });
      await cacheEnrichment(entry.language_code, entry.normalized, data);
      body.innerHTML = renderEnrichmentBody(data);
      toast('AI analysis added. It is labelled and kept separate from verified fields.', 'info');
    } catch (err) {
      body.innerHTML = enrichPlaceholderHtml(entry);
      toast(err.message ?? 'Enrichment failed.', err.code === 'rate-limited' ? 'warn' : 'neg');
    }
  };

  const renderEnrichmentBody = (data) => {
    const p = data.payload ?? {};
    const defs = (p.definitions ?? []).map((d) => `<li>${esc(d.text)}</li>`).join('');
    const et = p.etymology ?? {};
    return `
      <div class="enrichment">
        <div class="enrich-head">${provenanceBadge('ai')}<span class="muted small">${esc(data.model ?? '')}${data.cached ? ' - cached' : ''}</span></div>
        ${defs ? `<h4>Definitions</h4><ul>${defs}</ul>` : '<p class="muted small">The model did not reliably know this term - no definitions returned.</p>'}
        ${
          et.text
            ? `<h4>Etymology (unverified AI claim)</h4><p>${esc(et.text)} <span class="badge warn">unverified</span></p>${et.note ? `<p class="muted small">${esc(et.note)}</p>` : ''}`
            : `<h4>Etymology</h4><p class="muted">No reliable etymological source available. Nothing is invented.</p>`
        }
        ${p.mnemonic ? `<h4>Mnemonic</h4><p class="mnemonic">${esc(p.mnemonic)}</p><p class="muted small">A memory aid - not the word's history.</p>` : ''}
        ${p.usage_notes ? `<h4>Usage notes</h4><p>${esc(p.usage_notes)}</p>` : ''}
      </div>`;
  };

  const openEditEntry = (entry) => {
    const bodyHtml = `
      <form class="stack">
        <label>Term <input id="e-term" value="${esc(entry.term)}" maxlength="300"></label>
        <label>Reading <input id="e-reading" value="${esc(entry.reading ?? '')}" maxlength="300"></label>
        <label>Definition <textarea id="e-def" rows="3" maxlength="2000">${esc(entry.definition ?? '')}</textarea></label>
        <label>Part of speech <input id="e-pos" value="${esc(entry.part_of_speech ?? '')}" maxlength="40"></label>
        <label>Example <input id="e-example" value="${esc(entry.example ?? '')}" maxlength="1000"></label>
      </form>`;
    const m = modal({
      title: `Edit: ${entry.term}`,
      bodyHtml,
      actionsHtml: `<button class="btn subtle" data-close>Cancel</button><button class="btn primary" id="e-save">Save</button>`,
    });
    m.el.querySelector('[data-close]').addEventListener('click', m.close);
    m.el.querySelector('#e-save').addEventListener('click', async () => {
      const g = (id) => m.el.querySelector(`#${id}`).value.trim();
      try {
        await api('/api/entries', {
          method: 'PUT',
          body: {
            id: entry.id,
            term: g('e-term'),
            reading: g('e-reading') || null,
            definition: g('e-def') || null,
            part_of_speech: g('e-pos') || null,
            example: g('e-example') || null,
          },
        });
        await loadEntries();
        m.close();
        draw();
        toast('Entry updated.', 'pos');
      } catch (err) {
        toast(err.message ?? 'Update failed.', 'neg');
      }
    });
  };

  const openAddEntry = (lang) => {
    const s = getState();
    const langOptions = (s.languages ?? [])
      .filter((l) => l.kind === 'preset' || l.created_by)
      .map((l) => `<option value="${esc(l.code)}" ${l.code === (lang ?? s.activeLanguage ?? 'en') ? 'selected' : ''}>${esc(l.name)}</option>`)
      .join('');
    const bodyHtml = `
      <form class="stack">
        <label>Language <select id="n-language">${langOptions}</select></label>
        <label>Term <input id="n-term" required maxlength="300" placeholder="The word or phrase"></label>
        <label>Definition / meaning <input id="n-def" maxlength="2000" placeholder="In your gloss language"></label>
        <label>Reading / romanization <input id="n-reading" maxlength="300" placeholder="Optional"></label>
        <label>Part of speech <input id="n-pos" maxlength="40" placeholder="Optional"></label>
        <label>Example <input id="n-example" maxlength="1000" placeholder="Optional sentence using the term"></label>
        <label>Source reference <input id="n-source" maxlength="1000" placeholder="Where the definition comes from, if any"></label>
      </form>`;
    const m = modal({
      title: 'Add a vocabulary entry',
      bodyHtml,
      actionsHtml: `<button class="btn subtle" data-close>Cancel</button><button class="btn primary" id="n-save">Add</button>`,
    });
    m.el.querySelector('[data-close]').addEventListener('click', m.close);
    m.el.querySelector('#n-save').addEventListener('click', async () => {
      const g = (id) => m.el.querySelector(`#${id}`).value.trim();
      if (!g('n-term')) {
        toast('A term is required.', 'warn');
        return;
      }
      try {
        const { entry, existing } = await api('/api/entries', {
          method: 'POST',
          body: {
            language_code: g('n-language'),
            term: g('n-term'),
            definition: g('n-def') || null,
            reading: g('n-reading') || null,
            part_of_speech: g('n-pos') || null,
            example: g('n-example') || null,
            source_type: 'user',
            source_ref: g('n-source') || null,
          },
        });
        await loadEntries();
        m.close();
        draw();
        toast(existing ? 'That entry already exists.' : 'Entry added.', existing ? 'info' : 'pos');
      } catch (err) {
        toast(err.message ?? 'Could not add the entry.', 'neg');
      }
    });
  };

  draw();
  return () => {};
}
