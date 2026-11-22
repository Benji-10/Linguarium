/**
 * Grammar: structures as first-class citizens of the learning model.
 *
 * A structure lives independently of any vocabulary entry and progresses
 * through four layers: encountered -> recognized -> understood ->
 * independent use. Phase 1 ships the structures and the progression
 * tracking (with provenance on every structure); generated practice
 * exercises arrive in phase 2 (see docs/ROADMAP.md).
 */

import { icon, esc, toast, spinner, emptyState, provenanceBadge } from '../ui/components.mjs';
import { getState } from '../core/store.mjs';
import { api } from '../core/api.mjs';
import { GRAMMAR_STAGES, GRAMMAR_STAGE_LABELS } from '../shared/constants.mjs';

export async function renderGrammar(container) {
  const state = getState();
  container.innerHTML = `${spinner('Loading grammar structures')}`;

  let structures = [];
  let language = state.activeLanguage ?? null;
  try {
    const data = await api('/api/grammar', { params: { language: language ?? undefined } });
    structures = data.structures ?? [];
  } catch (err) {
    structures = [];
  }

  const draw = () => {
    const languagesWithStructures = [...new Set(structures.map((s) => s.language_code))];
    container.innerHTML = `
      <section class="page-head">
        <div>
          <h1>${icon('brain')}Grammar</h1>
          <p class="muted">Structures progress on their own four-layer track: encountered, recognized, understood, independent use. Vocabulary never substitutes for grammar.</p>
        </div>
      </section>

      ${
        structures.length === 0
          ? `<section class="panel">${emptyState({
              iconName: 'brain',
              title: 'No structures for this language yet',
              message:
                'The starter library seeds a handful of structures for Toki Pona, Latin, English and German. The phase 2 content pipeline (docs/ROADMAP.md) will grow per-language structure sets.',
            })}</section>`
          : structureListHtml(structures)
      }
    `;

    container.querySelectorAll('[data-stage]').forEach((btn) =>
      btn.addEventListener('click', async () => {
        const { structure, stage } = btn.dataset;
        try {
          await api('/api/grammar', {
            method: 'PUT',
            body: { structure_id: structure, stage },
          });
          structures = structures.map((s) => (s.id === structure ? { ...s, stage } : s));
          draw();
        } catch (err) {
          toast(err.message ?? 'Could not save the stage.', 'neg');
        }
      }),
    );
  };

  const structureListHtml = (rows) => `
    <section class="panel">
      <div class="panel-head"><h2>Structures (${rows.length})</h2>
        <span class="muted small">stage tracking works offline when cached</span></div>
      <div class="grammar-rows">
        ${rows
          .map((s) => {
            const stageIndex = GRAMMAR_STAGES.indexOf(s.stage ?? 'encountered');
            return `
          <article class="grammar-card">
            <header>
              <h3>${esc(s.name)}</h3>
              <span class="muted small">${esc(languageNameSafe(s.language_code))}</span>
              ${provenanceBadge(s.provenance)}
            </header>
            <p class="grammar-summary">${esc(s.summary ?? '')}</p>
            ${s.explanation ? `<details><summary>Explanation</summary><p>${esc(s.explanation)}</p></details>` : ''}
            ${
              (s.examples ?? []).length
                ? `<div class="grammar-examples">${s.examples
                    .map((ex) => `<p class="mono">${esc(ex.text ?? '')}</p>${ex.translation ? `<p class="muted small">${esc(ex.translation)}</p>` : ''}`)
                    .join('')}</div>`
                : ''
            }
            <div class="stage-track">
              ${GRAMMAR_STAGES.map(
                (st, i) =>
                  `<button class="chip stage ${i <= stageIndex ? 'done' : ''} ${s.stage === st ? 'active' : ''}" data-stage="${esc(st)}" data-structure="${esc(s.id)}" title="Mark as ${esc(GRAMMAR_STAGE_LABELS[st])}">${esc(GRAMMAR_STAGE_LABELS[st])}</button>`,
              ).join('')}
            </div>
            ${s.source_ref ? `<p class="muted small">${esc(s.source_ref)}</p>` : ''}
          </article>`;
          })
          .join('')}
      </div>
    </section>`;

  function languageNameSafe(code) {
    const l = getState().languages.find((x) => x.code === code);
    return l?.name ?? code;
  }

  draw();
  return () => {};
}
