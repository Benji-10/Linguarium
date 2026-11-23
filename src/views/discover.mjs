/**
 * Discover: the reading library with per-user difficulty estimation.
 *
 * Every text shows its provenance badge and an estimated band computed
 * from YOUR knowledge state (automated analysis, transparently explained),
 * so material choice is never driven by a CEFR sticker on the text.
 * The phase 2 content additions: subject-tag filtering of the library and
 * links into the same-knowledge-state practice environments.
 */

import { icon, esc, spinner, emptyState, provenanceBadge, bandBadge } from '../ui/components.mjs';
import { getState, setState, tokenizerFor, languageName } from '../core/store.mjs';
import { loadTexts } from '../core/data.mjs';
import { scoreText } from '../shared/difficulty.mjs';
import { DIFFICULTY_MODES } from '../shared/constants.mjs';

const TOPIC_FILTER = { value: null };

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

  // Topic filter (phase 2): subject tags on the seeded material + your own.
  // The selection lives module-level so it survives re-renders.
  const topics = [...new Set([...state.sharedTexts ?? [], ...state.texts ?? []]
    .filter((t) => !activeLang || t.language_code === activeLang)
    .map((t) => t.topic)
    .filter(Boolean))];
  const topicFilter = TOPIC_FILTER.value;

  const row = (t, kind) => {
    if (topicFilter && t.topic !== topicFilter) return '';
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
        ${t.topic ? `<span class="badge neutral">${esc(t.topic)}</span>` : ''}
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
        topics.length > 0
          ? `<div class="topic-chips">
              <button class="chip topic ${topicFilter === null ? 'active' : ''}" data-topic="">all topics</button>
              ${topics.map((t) => `<button class="chip topic ${topicFilter === t ? 'active' : ''}" data-topic="${esc(t)}">${esc(t)}</button>`).join('')}
            </div>`
          : ''
      }
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
      <h2>${icon('info')}Where this grows next</h2>
      <p class="muted small">The shared library grows through the community content pipeline (phase 3); frequency-based familiarity is already scored when frequency data is present. Meanwhile the same knowledge state also powers <a href="#/listening">listening</a>, <a href="#/practice">writing practice</a> and <a href="#/grammar">grammar exercises</a>.</p>
    </section>
  `;

  container.querySelectorAll('[data-topic]').forEach((btn) => {
    btn.addEventListener('click', () => {
      TOPIC_FILTER.value = btn.dataset.topic || null;
      renderDiscover(container);
    });
  });

  return () => {};
}
