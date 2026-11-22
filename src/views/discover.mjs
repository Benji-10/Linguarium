/**
 * Discover: the reading library with per-user difficulty estimation.
 *
 * Every text shows its provenance badge and an estimated band computed
 * from YOUR knowledge state (automated analysis, transparently explained),
 * so material choice is never driven by a CEFR sticker on the text.
 * The phase 2 content pipeline (real content ingestion, community feeds)
 * is documented in docs/ROADMAP.md.
 */

import { icon, esc, spinner, emptyState, provenanceBadge, bandBadge } from '../ui/components.mjs';
import { getState, setState, tokenizerFor, languageName } from '../core/store.mjs';
import { loadTexts } from '../core/data.mjs';
import { scoreText } from '../shared/difficulty.mjs';
import { DIFFICULTY_MODES } from '../shared/constants.mjs';

export async function renderDiscover(container) {
  container.innerHTML = `${spinner('Loading the library')}`;
  const state = getState();

  if (!state.textsLoaded) {
    await loadTexts();
    setState({ textsLoaded: true });
  }

  const activeLang = state.activeLanguage;
  const profile = (state.profiles ?? []).find((p) => p.language_code === activeLang);
  const mode = profile?.difficulty_mode ?? 'stretch';

  const knownSet = new Set(
    (state.entries ?? []).filter((e) => !activeLang || e.language_code === activeLang).map((e) => e.normalized),
  );


  // Shared texts carry a body in the detail fetch; for the list we estimate
  // from cached bodies when available (fetch shared bodies lazily below).
  const sharedWithBodies = [];
  for (const t of state.sharedTexts ?? []) {
    let body = t.body;
    if (!body) {
      try {
        const data = await import('../core/api.mjs').then((m) =>
          m.api('/api/texts', { params: { id: t.id, kind: 'shared' } }),
        );
        body = data.text?.body;
      } catch {
        body = '';
      }
    }
    sharedWithBodies.push({ ...t, body: body ?? '' });
  }

  const userTexts = (state.texts ?? []).filter((t) => !activeLang || t.language_code === activeLang);

  const row = (t, kind) => {
    const tok = tokenizerFor(state.languages, t.language_code) ?? {};
    const d = scoreText({ text: t.body ?? '', tokenizer: tok, knownSet });
    const matches = d.band === mode;
    return `
    <div class="discover-row ${matches ? 'match' : ''}">
      <a class="discover-main" href="#/read/${kind}/${esc(t.id)}">
        <strong>${esc(t.title)}</strong>
        <span class="muted small">${esc(languageName(state.languages, t.language_code))}${t.author ? ` - ${esc(t.author)}` : ''}</span>
      </a>
      <div class="discover-side">
        ${provenanceBadge(t.provenance)}
        ${bandBadge(d.band)}
        <span class="muted small">${Math.round(d.familiarity * 100)}% familiar</span>
        ${matches ? '<span class="badge pos">fits your mode</span>' : ''}
      </div>
    </div>`;
  };

  container.innerHTML = `
    <section class="page-head">
      <div>
        <h1>${icon('compass')}Discover</h1>
        <p class="muted">Material scored against <strong>your</strong> knowledge state${
          activeLang ? ` - ${esc(languageName(state.languages, activeLang))}, ${esc(DIFFICULTY_MODES[mode].label)} mode` : ''
        }. Estimates are automated analysis, not facts about the texts.</p>
      </div>
      <a class="btn primary" href="#/reading">${icon('plus')}Add your own text</a>
    </section>

    <section class="panel">
      <div class="panel-head"><h2>Recommended for your mode</h2>
        <span class="muted small">${esc(DIFFICULTY_MODES[mode].description)}</span></div>
      ${
        sharedWithBodies.length + userTexts.length === 0
          ? emptyState({
              iconName: 'compass',
              title: 'The library is empty',
              message: 'Add texts in Reading to build your library. The shared starter set appears once the database is seeded.',
            })
          : `<div class="discover-rows">${sharedWithBodies
              .filter((t) => !activeLang || t.language_code === activeLang)
              .map((t) => row(t, 'shared'))
              .join('')}${userTexts.map((t) => row(t, 'user')).join('')}</div>`
      }
    </section>

    <section class="panel roadmap-note">
      <h2>${icon('info')}What arrives in phase 2</h2>
      <p class="muted small">Community content feeds, frequency-based familiarity scoring, subject-tag filtering and automated adaptation of texts you choose - see docs/ROADMAP.md. The scoring hooks for frequency and subject familiarity are already in place (src/shared/difficulty.mjs).</p>
    </section>
  `;

  return () => {};
}
