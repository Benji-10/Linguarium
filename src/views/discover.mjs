/**
 * Discover: the reading library with per-user difficulty estimation.
 *
 * Every text shows its provenance badge and an estimated band computed
 * from YOUR knowledge state (automated analysis, transparently explained),
 * so material choice is never driven by a CEFR sticker on the text.
 * The phase 2 content additions: subject-tag filtering of the library and
 * links into the same-knowledge-state practice environments.
 *
 * Rendering contract (the phase 3 latency fix): the page skeleton paints
 * SYNCHRONOUSLY on navigation - no spinner, no blank gap, no waiting on the
 * network. Data panels fill in as their fetches resolve; if the user has
 * already navigated away, the router has swapped the container and these
 * late writes land in a detached node (harmless by design).
 */

import { icon, esc, emptyState, provenanceBadge, bandBadge } from '../ui/components.mjs';
import { getState, setState, tokenizerFor, languageName } from '../core/store.mjs';
import { api } from '../core/api.mjs';
import { loadTexts } from '../core/data.mjs';
import { scoreText } from '../shared/difficulty.mjs';
import { DIFFICULTY_MODES } from '../shared/constants.mjs';

const TOPIC_FILTER = { value: null };
const RESOURCES_CACHE = { lang: null, rows: null };
// Body samples for difficulty estimation, one fetch per language per session
// (with_bodies=1: the server sends the first 12k chars per text, shared and
// the user's own - one call instead of an N+1 waterfall over detail fetches).
const BODY_SAMPLES_CACHE = { lang: null, data: null };

export async function renderDiscover(container) {
  const state = getState();
  const activeLang = state.activeLanguage;
  const langLabel = activeLang ? languageName(state.languages, activeLang) : null;

  // ---- 1. Immediate paint: the full page skeleton, no awaits above this line.
  container.innerHTML = `
    <section class="page-head">
      <div>
        <h1>${icon('compass')}Discover</h1>
        <p class="muted">Material scored against <strong>your</strong> knowledge state${
          activeLang ? ` - ${esc(langLabel)} (loading your mode...)` : ''
        }. Estimates are automated analysis, not facts about the texts.</p>
      </div>
      <a class="btn primary" href="#/reading">${icon('plus')}Add your own text</a>
    </section>

    <section class="panel">
      <div class="panel-head"><h2>Recommended for your mode</h2>
        <span class="muted small" id="disc-mode-label">loading your library...</span></div>
      <div class="discover-rows" id="disc-rows">
        ${Array.from({ length: 4 })
          .map(
            (_, i) => `
        <div class="discover-row skel">
          <div class="discover-main">
            <span class="skeleton-bar" style="width:${58 - i * 7}%"></span>
            <span class="skeleton-bar short" style="width:${34 - i * 4}%"></span>
          </div>
          <div class="discover-side"><span class="skeleton-bar chip"></span><span class="skeleton-bar chip"></span></div>
        </div>`,
          )
          .join('')}
      </div>
    </section>

    ${
      activeLang
        ? `<section class="panel">
      <div class="panel-head"><h2>${icon('library')}Language resources for ${esc(langLabel)}</h2>
        <span class="muted small">open frequency lists, pronunciation references, corpora and dictionaries</span></div>
      <p class="muted small" id="disc-resources">Loading the resource catalog...</p>
    </section>`
        : ''
    }

    <section class="panel roadmap-note">
      <h2>${icon('info')}Where this grows next</h2>
      <p class="muted small">The shared library now grows through the <a href="#/contribute">community content pipeline</a> (moderated contributions with mandatory provenance), texts can be <strong>adapted to your level</strong> from the reader, and frequency data improves the familiarity estimates once ingested. The same knowledge state also powers <a href="#/listening">listening</a>, <a href="#/practice">writing practice</a> and <a href="#/grammar">grammar exercises</a>.</p>
    </section>
  `;

  const rowsHost = () => container.querySelector('#disc-rows');
  const modeLabel = () => container.querySelector('#disc-mode-label');
  const resourcesHost = () => container.querySelector('#disc-resources');

  // ---- 2. Data, panel by panel. Everything below is best-effort: a failed
  // fetch degrades that panel to an honest note, never to a blank page.
  if (!state.textsLoaded) {
    await loadTexts().catch(() => {});
    setState({ textsLoaded: true });
  }
  await fillLibrary(container);
  fillResources(activeLang, resourcesHost());

  const cleanup = () => {};
  return cleanup;

  async function fillLibrary(view) {
    const s = getState();
    const active = s.activeLanguage;
    const profile = (s.profiles ?? []).find((p) => p.language_code === active);
    const mode = profile?.difficulty_mode ?? 'stretch';
    if (modeLabel()) modeLabel().textContent = DIFFICULTY_MODES[mode].description;

    const knownSet = new Set(
      (s.entries ?? []).filter((e) => !active || e.language_code === active).map((e) => e.normalized),
    );

    // Body samples (shared + own) for this language: one call, cached per
    // session; offline falls back to whatever the text list already carries.
    let samples = { shared: [], user: [] };
    if (active) {
      if (BODY_SAMPLES_CACHE.lang === active) {
        samples = BODY_SAMPLES_CACHE.data;
      } else {
        try {
          const data = await api('/api/texts', { params: { with_bodies: 1, language: active } });
          samples = { shared: data.score_bodies?.shared ?? [], user: data.score_bodies?.user ?? [] };
          BODY_SAMPLES_CACHE.lang = active;
          BODY_SAMPLES_CACHE.data = samples;
        } catch {
          samples = { shared: [], user: [] }; // offline / not seeded: honest zeros
        }
      }
    }
    const bodyById = new Map();
    for (const r of samples.shared) bodyById.set(`s:${r.id}`, r.body);
    for (const r of samples.user) bodyById.set(`u:${r.id}`, r.body);

    const shared = (s.sharedTexts ?? []).filter((t) => !active || t.language_code === active);
    const userTexts = (s.texts ?? []).filter((t) => !active || t.language_code === active);

    const topics = [...new Set([...shared, ...userTexts].map((t) => t.topic).filter(Boolean))];
    const topicFilter = TOPIC_FILTER.value;

    const row = (t, kind) => {
      if (topicFilter && t.topic !== topicFilter) return '';
      const tok = tokenizerFor(s.languages, t.language_code) ?? {};
      const body = t.body || bodyById.get(`${kind === 'user' ? 'u' : 's'}:${t.id}`) || '';
      const d = scoreText({ text: body, tokenizer: tok, knownSet });
      const matches = d.band === mode;
      return `
      <div class="discover-row ${matches ? 'match' : ''}">
        <a class="discover-main" href="#/read/${kind}/${esc(t.id)}">
          <strong>${esc(t.title)}</strong>
          <span class="muted small">${esc(languageName(s.languages, t.language_code))}${t.author ? ` - ${esc(t.author)}` : ''}</span>
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

    const host = rowsHost();
    if (!host) return; // the user has already navigated away
    const total = shared.length + userTexts.length;
    host.innerHTML =
      total === 0
        ? emptyState({
            iconName: 'compass',
            title: 'The library is empty',
            message: 'Add texts in Reading to build your library. The shared starter set appears once the database is seeded.',
          })
        : `<div class="discover-rows">${
            topics.length > 0
              ? `<div class="topic-chips">
                  <button class="chip topic ${topicFilter === null ? 'active' : ''}" data-topic="">all topics</button>
                  ${topics.map((t) => `<button class="chip topic ${topicFilter === t ? 'active' : ''}" data-topic="${esc(t)}">${esc(t)}</button>`).join('')}
                </div>`
              : ''
          }${shared.map((t) => row(t, 'shared')).join('')}${userTexts.map((t) => row(t, 'user')).join('')}</div>`;

    view.querySelectorAll('[data-topic]').forEach((btn) => {
      btn.addEventListener('click', () => {
        TOPIC_FILTER.value = btn.dataset.topic || null;
        renderDiscover(container);
      });
    });
  }

  async function fillResources(active, host) {
    if (!host) return;
    if (!active) {
      host.textContent = '';
      return;
    }
    let resources = null;
    if (RESOURCES_CACHE.lang === active) {
      resources = RESOURCES_CACHE.rows;
    } else {
      try {
        const data = await api('/api/resources', { params: { language: active } });
        resources = data.resources ?? [];
        RESOURCES_CACHE.lang = active;
        RESOURCES_CACHE.rows = resources;
      } catch {
        resources = null;
      }
    }
    if (!host.isConnected) return; // navigated away
    if (resources == null) {
      host.outerHTML =
        '<p class="muted small">The resource catalog is unavailable right now (offline, or the database is not seeded yet).</p>';
      return;
    }
    if (resources.length === 0) {
      host.outerHTML = '<p class="muted small">No cataloged resources for this language yet - the community pipeline can add them.</p>';
      return;
    }
    const kindLabels = {
      frequency_list: 'frequency list',
      pronunciation: 'pronunciation',
      corpus: 'corpus',
      dictionary: 'dictionary',
    };
    host.outerHTML = `<div class="resource-rows">${resources
      .map(
        (r) => `
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
      </div>`,
      )
      .join('')}</div>
    <p class="muted small">Every entry links to the source with its license - the data itself is never copied into this deployment. Provenance: curated catalog entries, community-maintained; verify licenses at the source before redistributing.</p>`;
  }
}
