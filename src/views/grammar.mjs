/**
 * Grammar: structures as first-class citizens of the learning model.
 *
 * A structure lives independently of any vocabulary entry and progresses
 * through four layers: encountered -> recognized -> understood ->
 * independent use.
 *
 * Phase 2 adds generated PRACTICE on top of the structures:
 *   - cloze exercises built from the structure's own example sentences,
 *     auto-checked with the language's normalizer (labelled for what they
 *     are: generated exercises, automated checking);
 *   - a produce-the-sentence round with honest self-assessment for
 *     examples that cannot be auto-checked.
 * A correct cloze or an honest "produced it" advances the structure's
 * stage through the same saved progression as the manual buttons.
 */

import { icon, esc, toast, spinner, emptyState, provenanceBadge } from '../ui/components.mjs';
import { getState, tokenizerFor } from '../core/store.mjs';
import { api } from '../core/api.mjs';
import { GRAMMAR_STAGES, GRAMMAR_STAGE_LABELS } from '../shared/constants.mjs';
import { tokenize, normalizeTerm } from '../shared/tokenizer.mjs';
import { saveGrammarStage } from '../shared/grammar-save.mjs';

export async function renderGrammar(container) {
  const state = getState();
  container.innerHTML = `${spinner('Loading grammar structures')}`;

  let structures = [];
  let language = state.activeLanguage ?? null;
  try {
    const data = await api('/api/grammar', { params: { language: language ?? undefined } });
    structures = data.structures ?? [];
  } catch {
    structures = [];
  }

  const draw = () => {
    container.innerHTML = `
      <section class="page-head">
        <div>
          <h1>${icon('brain')}Grammar</h1>
          <p class="muted">Structures progress on their own four-layer track: encountered, recognized, understood, independent use - and now practise them with generated cloze exercises from their own example sentences.</p>
        </div>
      </section>

      ${
        structures.length === 0
          ? `<section class="panel">${emptyState({
              iconName: 'brain',
              title: 'No structures for this language yet',
              message:
                language
                  ? 'The starter library seeds structures for several languages (Korean, Chinese, Toki Pona, Latin, English, German and more). None exist for this language yet.'
                  : 'The starter library seeds structures for several languages (Korean, Chinese, Toki Pona, Latin, English, German and more).',
            })}</section>`
          : `<section class="panel">
              <div class="panel-head"><h2>Structures (${structures.length})</h2>
                <span class="muted small">stage tracking and practice work offline when cached</span></div>
              <div class="grammar-rows">${structureListHtml(structures)}</div>
            </section>`
      }
    `;

    container.querySelectorAll('[data-stage]').forEach((btn) =>
      btn.addEventListener('click', async () => {
        const { structure, stage } = btn.dataset;
        try {
          await saveGrammarStage(structure, stage);
          structures = structures.map((s) => (s.id === structure ? { ...s, stage } : s));
          draw();
        } catch (err) {
          toast(err.message ?? 'Could not save the stage.', 'neg');
        }
      }),
    );

    container.querySelectorAll('[data-practise]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const s = structures.find((x) => x.id === btn.dataset.practise);
        if (s) openExercise(container, s, () => draw());
      });
    });
  };

  const structureListHtml = (rows) =>
    rows
      .map((s) => {
        const stage = s.stage ?? 'encountered';
        const stageIndex = GRAMMAR_STAGES.indexOf(stage);
        const practisable = (s.examples ?? []).some((ex) => (ex.text ?? '').trim().length > 0);
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
              `<button class="chip stage ${i <= stageIndex ? 'done' : ''} ${stage === st ? 'active' : ''}" data-stage="${esc(st)}" data-structure="${esc(s.id)}" title="Mark as ${esc(GRAMMAR_STAGE_LABELS[st])}">${esc(GRAMMAR_STAGE_LABELS[st])}</button>`,
          ).join('')}
        </div>
        <div class="grammar-actions">
          ${
            practisable
              ? `<button class="btn subtle small" data-practise="${esc(s.id)}">${icon('pencil')}Practise this structure</button>`
              : '<span class="muted small">No examples to practise yet</span>'
          }
        </div>
        ${s.source_ref ? `<p class="muted small">${esc(s.source_ref)}</p>` : ''}
      </article>`;
      })
      .join('');

  function languageNameSafe(code) {
    const l = getState().languages.find((x) => x.code === code);
    return l?.name ?? code;
  }

  draw();
  return () => {};
}

/**
 * Exercise session for one structure: one round per example sentence.
 * Cloze when a blankable word exists (auto-checked with the language's
 * normalizer); otherwise a translation-recall round with self-assessment.
 */
function openExercise(container, structure, redraw) {
  const s = getState();
  const tokenizer = tokenizerFor(s.languages, structure.language_code) ?? {};

  const examples = (structure.examples ?? []).filter((ex) => (ex.text ?? '').trim().length > 0);
  if (examples.length === 0) {
    toast('This structure has no examples to practise yet.', 'warn');
    return;
  }

  const items = examples.map((ex) => {
    const tokens = tokenize(ex.text, tokenizer).filter((t) => t.text.trim().length >= 2);
    // A blankable word: a real word (not single punctuation) with a
    // reasonable length. Char-level languages fall back to recall rounds.
    const blankable = tokens.filter((t) => /[\p{L}\p{N}]/u.test(t.text) && (tokenizer.charLevel ? t.text.length >= 1 : t.text.length >= 3));
    const target = blankable.length > 0 ? blankable[Math.floor(Math.random() * blankable.length)] : null;
    if (target) {
      const before = ex.text.slice(0, target.start);
      const after = ex.text.slice(target.end);
      return {
        kind: 'cloze',
        sentence: ex.text,
        translation: ex.translation ?? null,
        before,
        after,
        answer: target.text,
        norm: normalizeTerm(target.text, tokenizer),
      };
    }
    return { kind: 'recall', sentence: ex.text, translation: ex.translation ?? null };
  });

  let index = 0;
  const host = document.createElement('div');
  host.className = 'modal-overlay';
  document.body.appendChild(host);

  const close = () => {
    host.remove();
    redraw();
  };

  const drawItem = () => {
    const item = items[index];
    const done = index >= items.length;
    host.innerHTML = `
      <div class="modal grammar-exercise">
        <header>
          <h3>${esc(structure.name)} - practice</h3>
          <button class="icon-btn modal-close" aria-label="Close">${icon('x')}</button>
        </header>
        <div class="modal-body">
          <p class="muted small">Exercise ${Math.min(index + 1, items.length)} of ${items.length} - generated from this structure's own example sentences (automated exercise, auto-checked with the language's normalizer). A correct answer advances the structure's stage.</p>
          ${
            done
              ? `<div class="exercise-done">${icon('check')}<p>Round complete. ${esc(structure.name)} now sits at <strong>${esc(GRAMMAR_STAGE_LABELS[structure.stage ?? 'encountered'])}</strong>.</p></div>`
              : item.kind === 'cloze'
                ? `
            <p class="exercise-sentence" lang="${esc(structure.language_code)}">${esc(item.before)}<span class="cloze-blank" data-fill>______</span>${esc(item.after)}</p>
            ${item.translation ? `<p class="muted small">${esc(item.translation)}</p>` : ''}
            <div class="exercise-input">
              <input id="cloze-answer" placeholder="the missing word…" lang="${esc(structure.language_code)}" autocomplete="off">
              <button class="btn primary small" id="cloze-check">Check</button>
            </div>
            <div id="cloze-feedback"></div>`
                : `
            <p class="muted small">Produce this sentence in ${esc(structure.language_code)} from its meaning, then reveal and assess yourself honestly:</p>
            <p class="exercise-sentence">${esc(item.translation ?? '(no translation recorded - read the original and try again)')}</p>
            <div id="recall-reveal"><button class="btn subtle small" id="btn-reveal">${icon('eye')}Reveal the original</button></div>`
          }
        </div>
        <footer>
          <button class="btn subtle" data-close>Close</button>
        </footer>
      </div>`;

    host.querySelector('.modal-close').addEventListener('click', close);
    host.querySelector('[data-close]').addEventListener('click', close);
    host.addEventListener('click', (e) => {
      if (e.target === host) close();
    });

    if (done) return;

    if (item.kind === 'cloze') {
      const input = host.querySelector('#cloze-answer');
      const check = () => {
        const value = normalizeTerm(input.value, tokenizer);
        const correct = value.length > 0 && value === item.norm;
        const fb = host.querySelector('#cloze-feedback');
        fb.innerHTML = `
          <div class="exercise-feedback ${correct ? 'pos' : 'neg'}">
            ${correct ? icon('check') : icon('x')}
            <span>${correct ? 'Correct.' : 'Not quite - the original was:'} <strong lang="${esc(structure.language_code)}">${esc(item.answer)}</strong></span>
          </div>`;
        if (correct) {
          void advanceStructure(structure);
          setTimeout(next, 900);
        } else {
          setTimeout(next, 1600);
        }
      };
      host.querySelector('#cloze-check').addEventListener('click', check);
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') check();
      });
      input.focus();
    } else {
      host.querySelector('#btn-reveal')?.addEventListener('click', () => {
        const reveal = host.querySelector('#recall-reveal');
        reveal.innerHTML = `
          <p class="exercise-sentence" lang="${esc(structure.language_code)}">${esc(item.sentence)}</p>
          <p class="muted small">Could you produce this yourself?</p>
          <div class="practice-rate">
            <button class="btn danger small" data-rate="0">${icon('x')}Not yet</button>
            <button class="btn small" data-rate="1">${icon('check')}Recognized it</button>
            <button class="btn primary small" data-rate="2">${icon('flash')}Produced it</button>
          </div>`;
        reveal.querySelectorAll('[data-rate]').forEach((btn) => {
          btn.addEventListener('click', async () => {
            const rate = Number(btn.dataset.rate);
            if (rate === 2) await advanceStructure(structure, true);
            else if (rate === 1 && GRAMMAR_STAGES.indexOf(structure.stage ?? 'encountered') < 1) {
              await saveGrammarStage(structure.id, 'recognized');
              structure.stage = 'recognized';
            }
            next();
          });
        });
      });
    }
  };

  const next = () => {
    index += 1;
    drawItem();
  };

  drawItem();
}

async function advanceStructure(structure) {
  const order = GRAMMAR_STAGES;
  const current = order.indexOf(structure.stage ?? 'encountered');
  const reached = Math.min(current + 1, order.length - 1);
  if (reached > current) {
    await saveGrammarStage(structure.id, order[reached]);
    structure.stage = order[reached];
  }
}
