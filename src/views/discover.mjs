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
import { api } from '../core/api.mjs';
import { loadTexts } from '../core/data.mjs';
import { scoreText } from '../shared/difficulty.mjs';
import { DIFFICULTY_MODES } from '../shared/constants.mjs';

const TOPIC_FILTER = { value: null };
const RESOURCES_CACHE = { lang: null, rows: null };

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

  // Extended language resources (phase 3): a curated, license-labelled
  // catalog for the ACTIVE language. Cached per language for this session.
  let resources = null;
  if (activeLang) {
    if (RESOURCES_CACHE.lang === activeLang) {
      resources = RESOURCES_CACHE.rows;
    } else {
      try {
        const data = await api('/api/resources', { params: { language: activeLang } });
        resources = data.resources ?? [];
        RESOURCES_CACHE.lang = activeLang;
        RESOURCES_CACHE.rows = resources;
      } catch {
        resources = null; // offline or not seeded: the panel says so honestly
      }
    }
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

    ${
      activeLang
        ? `<section class="panel">
      <div class="panel-head"><h2>${icon('library')}Language resources for ${esc(languageName(state.languages, activeLang))}</h2>
        <span class="muted small">open frequency lists, pronunciation references, corpora and dictionaries</span></div>
      ${
        resources == null
          ? '<p class="muted small">The resource catalog is unavailable right now (offline, or the database is not seeded yet).</p>'
          : resources.length === 0
            ? '<p class="muted small">No cataloged resources for this language yet - the community pipeline can add them.</p>'
            : `<div class="resource-rows">${resources.map(resourceRowHtml).join('')}</div>`
      }
      <p class="muted small">Every entry links to the source with its license - the data itself is never copied into this deployment. Provenance: curated catalog entries, community-maintained; verify licenses at the source before redistributing.</p>
    </section>`
        : ''
    }

    <section class="panel roadmap-note">
      <h2>${icon('info')}Where this grows next</h2>
      <p class="muted small">The shared library now grows through the <a href="#/contribute">community content pipeline</a> (moderated contributions with mandatory provenance), texts can be <strong>adapted to your level</strong> from the reader, and frequency data improves the familiarity estimates once ingested. The same knowledge state also powers <a href="#/listening">listening</a>, <a href="#/practice">writing practice</a> and <a href="#/grammar">grammar exercises</a>.</p>
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

/** One row of the language-resources catalog (phase 3). */
function resourceRowHtml(r) {
  const kindLabels = {
    frequency_list: 'frequency list',
    pronunciation: 'pronunciation',
    corpus: 'corpus',
    dictionary: 'dictionary',
  };
  return `
  <div class="resource-row">
    <a class="resource-main" href="${esc(r.source_url)}" target="_blank" rel="noopener noreferrer">
      <strong>${esc(r.name)}</strong>
      <span class="muted small">${esc(r.description ?? '')}</span>
    </a>
    <div class="resource-side">
      <span class="badge outline">${esc(kindLabels[r.kind] ?? r.kind)}</span>
      <span class="badge neutral" title="${esc(r.source_ref ?? '')}">${esc(r.license)}</span>
      ${provenanceBadge(r.provenance, { withLabel: false })}
    </div>
  </div>`;
}
