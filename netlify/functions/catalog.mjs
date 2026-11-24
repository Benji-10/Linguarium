/**
 * GET /api/catalog - search the open content sources for importable texts.
 *
 *   ?language=ja&q=neko&provider=aozora|gutenberg|wikisource|wikipedia|wikibooks|wikinews|news
 *   &page=2                     (Gutenberg pagination)
 *   &topic=fiction              (Gutenberg genre filter, validated allowlist)
 *   &wiki=mi                    (custom-edition wiki code for wikipedia/wikisource)
 *
 * Every provider is keyless, free and honestly labelled with its license
 * situation (see lib/sources.mjs). Without `provider` the endpoint returns
 * the provider catalog itself so the UI can render the tabs: with a
 * `language`, each provider is marked whether it actually serves that
 * language (the sources differ per language - Japanese leads with Aozora
 * Bunko, Korean gets the wiki family plus the Hankyoreh feed, Gutenberg only
 * where a shelf exists). Sources that do NOT serve the language are omitted
 * entirely rather than greyed out - a disabled tab reads as a broken tab.
 *
 * Custom languages: a language whose code is not in the built-in wiki lists
 * gets its own code probed once (memoized) - Maori "mi" lights up
 * mi.wikipedia.org on its own - and every language additionally gets the
 * custom-edition providers, where the user types any wiki language code.
 *
 * Cross-contamination rule: the client restricts the language to the active
 * learning language; the server validates that the language exists at all.
 */

import { handler, json, query, requireString, HttpError } from './lib/http.mjs';
import { requireUser } from './lib/identity.mjs';
import { sql } from './lib/db.mjs';
import {
  PROVIDERS,
  GUTENBERG_LANGUAGES,
  GUTENBERG_TOPICS,
  NEWS_FEEDS,
  GUTENDEX_SEARCH_URL,
  GUTENDEX_BROWSE_URL,
  MW_SEARCH_URL,
  MW_MOSTVIEWED_URL,
  MW_ALLPAGES_URL,
  providersForLanguage,
  validWikiCode,
  wikiEditionExists,
  aozoraCatalogItems,
  mapGutendex,
  gutendexPageInfo,
  mapMediawikiSearch,
  mapMwMostviewed,
  mapMwAllpages,
  parseRss,
  fetchJson,
  fetchWikiJson,
  fetchJsonRetry,
  fetchText,
  memoJson,
  memoJsonStale,
} from './lib/sources.mjs';

const PROVIDER_LICENSES = {
  wikipedia: 'cc-by-sa-4.0',
  wikibooks: 'cc-by-sa-4.0',
  wikinews: 'cc-by-2.5',
  wikisource: 'unspecified (varies per work - check the work page)',
  wikivoyage: 'cc-by-sa-4.0',
};

const PROVIDER_PROJECTS = {
  wikisource: 'wikisource',
  wikipedia: 'wikipedia',
  wikibooks: 'wikibooks',
  wikinews: 'wikinews',
  wikivoyage: 'wikivoyage',
};

/** project for a provider id, accepting the custom-edition bridge. */
function projectForProvider(provider) {
  if (PROVIDER_PROJECTS[provider]) return { project: PROVIDER_PROJECTS[provider], custom: false };
  if (provider === 'wikipedia-custom') return { project: 'wikipedia', custom: true };
  if (provider === 'wikisource-custom') return { project: 'wikisource', custom: true };
  return null;
}

export default handler({
  GET: async (req) => {
    const user = await requireUser();
    const q = query(req);

    // ---------------------------------------------------------------- provider list
    if (!q.provider) {
      const language = q.language ? String(q.language).slice(0, 16) : null;
      let sourceEdition = null;
      if (language) {
        const rows = await sql()`SELECT code, source_edition FROM knowledge.languages WHERE code = ${language}`;
        if (rows.length === 0) {
          throw new HttpError(404, 'language-not-found', 'Unknown language code.');
        }
        sourceEdition = validWikiCode(rows[0].source_edition);
      }

      // Custom/unknown language: probe its own code against the live wikis
      // once (memoized 15 min). Maori "mi" then simply gets Wikipedia.
      // With a SOURCE EDITION defined in Settings, that edition is probed
      // too - the built-in providers then serve the language through it
      // and the custom-edition "type a code" bridge stays out of the way.
      let probed = null;
      if (language && !PROVIDERS.wikipedia.languages.includes(language)) {
        probed = await memoJson(`probe:${language}:${sourceEdition ?? ''}`, 15 * 60 * 1000, async () => ({
          wikipedia: await Promise.all(
            [language.length <= 8 ? language : null, sourceEdition].filter(Boolean).map((c) => wikiEditionExists(c, 'wikipedia')),
          ).then((rs) => rs.some(Boolean)),
          wikisource: await Promise.all(
            [language.length <= 8 ? language : null, sourceEdition].filter(Boolean).map((c) => wikiEditionExists(c, 'wikisource')),
          ).then((rs) => rs.some(Boolean)),
        }));
      }

      // Only sources that actually serve the language are listed - no greyed
      // out entries (they read as broken). The custom-edition bridge is
      // appended whenever the built-in edition of that project is missing,
      // so a custom language always has something to try.
      const providers = [];
      for (const [id, meta] of Object.entries(PROVIDERS)) {
        if (meta.needsCode) {
          // Custom-edition bridge: offered only when the built-in edition of
          // that project is missing for this language.
          const project = id.split('-')[0];
          const builtinServes = (PROVIDERS[project]?.languages ?? []).includes(language ?? '');
          if (language && !builtinServes) {
            providers.push({
              id,
              label: meta.label,
              blurb: sourceEdition ? `Any wiki edition by its language code - your saved edition "${sourceEdition}" is already used by the sources above.` : meta.blurb,
              priority: meta.priority ?? 99,
              needs_code: true,
              available: true,
            });
          }
          continue;
        }
        const available =
          !language ||
          (id === 'news'
            ? NEWS_FEEDS.some((f) => f.language === language)
            : probed && id in probed
              ? probed[id]
              : (meta.languages ?? []).includes(language));
        if (!available) continue;
        providers.push({
          id,
          label: meta.label,
          blurb: probed && id in probed && probed[id] ? `${meta.blurb} (reading the ${sourceEdition ?? language} edition for this language)` : meta.blurb,
          priority: meta.priority ?? 99,
          available: true,
        });
      }
      providers.sort((a, b) => (a.priority ?? 99) - (b.priority ?? 99));
      const recommended = language ? providersForLanguage(language).map((p) => p.id) : [];
      return json({ providers, recommended, source_edition: sourceEdition });
    }

    // ---------------------------------------------------------------- search
    const provider = requireString(q, 'provider', { max: 20 });
    const language = requireString(q, 'language', { max: 16 });
    const search = q.q ? String(q.q).slice(0, 200) : '';

    const langRows = await sql()`SELECT code, source_edition FROM knowledge.languages WHERE code = ${language}`;
    if (langRows.length === 0) {
      throw new HttpError(404, 'language-not-found', 'Unknown language code.');
    }
    const sourceEdition = validWikiCode(langRows[0].source_edition);

    // Aozora Bunko (Japanese): the curated shelf lives in sources.mjs; the
    // search is a local filter, so it is instant and never rate-limited.
    if (provider === 'aozora') {
      if (language !== 'ja') {
        throw new HttpError(400, 'not-for-language', 'Aozora Bunko serves Japanese only.');
      }
      const items = aozoraCatalogItems(search);
      return json({
        provider,
        language,
        query: search,
        items,
        note:
          'Aozora Bunko (青空文庫) - the canonical Japanese free library. This is a curated shelf of famous public-domain works; importing keeps Aozora as the source of record and the furigana annotations from the work itself.',
      });
    }

    if (provider === 'gutenberg') {
      // Gutenberg is only offered where the catalogue actually has a shelf:
      // Gutendex HANGS (minutes) on languages with no books, and gutenberg.org
      // itself throttles datacenter traffic - a doomed query looks like a dead
      // API to the user. The honest answer is "no shelf here, use X instead".
      if (!GUTENBERG_LANGUAGES.includes(language)) {
        const alternatives = providersForLanguage(language).filter((p) => p.id !== 'gutenberg');
        return json({
          provider,
          language,
          query: search,
          items: [],
          note: `Project Gutenberg has no meaningful shelf for this language - it is only offered for languages it stocks. For ${language}, try: ${alternatives.map((p) => p.label).join(', ') || 'the wiki sources'}.`,
        });
      }
      // Gutendex routes: browsing by language (/books/?languages=xx&page=N)
      // is fast and reliable; free-text search is NOT (it can stall the
      // upstream for minutes - reproduced 2026-11), so it gets a short
      // timeout and falls back to a filtered browse of the language shelf.
      // Every upstream call is memo-cached for 10 minutes: Gutendex
      // rate-limits bursts aggressively (also reproduced 2026-11).
      //
      // TIME BUDGET (2026-11 fix): the function dies at ~10 s. Retries used
      // to stack 3 x 12 s attempts and the client saw "page 2 always times
      // out; a refresh sometimes fixes it" (the refresh hit the memo cache a
      // slow first attempt had populated in the background). Now: 2 attempts
      // x 4 s fit the budget, a failure serves the last cached page (stale
      // beats error), and a cold miss answers with a friendly retry note
      // instead of a 502.
      const page = Math.min(100, Math.max(1, Number(q.page) || 1));
      const topic = GUTENBERG_TOPICS.includes(String(q.topic ?? '')) ? String(q.topic) : null;
      const cacheKey = (url) => `gutendex:${url}`;
      const fetchGutendex = async (key, url) => {
        try {
          return {
            data: await memoJson(key, 10 * 60 * 1000, () =>
              fetchJsonRetry(url, { timeoutMs: 4000, attempts: 2, backoffMs: 250, maxBytes: 2 * 1024 * 1024 }),
            ),
            stale: false,
          };
        } catch {
          const cached = memoJsonStale(key);
          if (cached) return { data: cached, stale: true };
          return { data: null, stale: false };
        }
      };
      let note = null;
      let result;
      if (search) {
        result = await fetchGutendex(
          cacheKey(GUTENDEX_SEARCH_URL(search, language, page)),
          GUTENDEX_SEARCH_URL(search, language, page),
        );
        if (!result.data) {
          result = await fetchGutendex(
            cacheKey(GUTENDEX_BROWSE_URL(language, 1, topic)),
            GUTENDEX_BROWSE_URL(language, 1, topic),
          );
          if (result.data) {
            note =
              "Project Gutenberg's search is slow right now - showing the " +
              `${language} public-domain shelf instead; the filter below applied your words to titles and authors on it.`;
          }
        }
      } else {
        result = await fetchGutendex(
          cacheKey(GUTENDEX_BROWSE_URL(language, page, topic)),
          GUTENDEX_BROWSE_URL(language, page, topic),
        );
      }
      if (!result.data) {
        // Cold miss on a slow upstream: an honest, actionable answer rather
        // than a 502. The next attempt usually lands (Gutendex throttles
        // bursts, and successful pages stay memo-cached for 10 minutes).
        return json({
          provider,
          language,
          query: search,
          page,
          pages: null,
          note: "Project Gutenberg's catalogue did not answer in time (it rate-limits bursts). Press Search or Next again in a few seconds - pages that have loaded once stay cached for ten minutes.",
          topic,
          items: [],
        });
      }
      if (result.stale) {
        note =
          (note ? `${note} ` : '') +
          'Showing the last successfully loaded version of this page - the catalogue was slow just now.';
      }
      let items = mapGutendex(result.data);
      if (note && search) {
        const needle = search.toLowerCase();
        items = items.filter(
          (it) =>
            (it.title ?? '').toLowerCase().includes(needle) ||
            (it.author ?? '').toLowerCase().includes(needle),
        );
      }
      // The shelf itself may mix languages; the active language wins.
      const activeLang = language === 'nb' ? 'no' : language;
      items = items.filter((it) => it.language === activeLang);
      const pageInfo = gutendexPageInfo(result.data);
      return json({
        provider,
        language,
        query: search,
        page,
        pages: pageInfo,
        note,
        topic,
        items,
      });
    }

    // ---------------------------------------------------------------- wikis
    const wikiRoute = projectForProvider(provider);
    if (wikiRoute) {
      const { project, custom } = wikiRoute;

      // The wiki code to actually fetch, in priority order: a user-supplied
      // code for the custom-edition providers (required there), an explicit
      // override for the built-in ones, then the SOURCE EDITION the user
      // defined once in Settings, then the language's own code.
      let urlLang = language;
      if (custom) {
        const code = validWikiCode(q.wiki);
        if (!code) {
          throw new HttpError(
            400,
            'wiki-code-required',
            'This source needs a wiki language code - type one like "mi" (Maori), "scn" (Sicilian), "simple" (Simple English).',
          );
        }
        urlLang = code;
      } else {
        const override = validWikiCode(q.wiki);
        if (override) urlLang = override;
        else if (sourceEdition) urlLang = sourceEdition;
      }

      // With a query: full search. Without one: the edition's own shelf -
      // most-viewed articles for Wikipedia (what people actually read),
      // the main-namespace page list for the other projects. The old default
      // searched the literal word "recommended", which matches nothing on
      // non-Latin wikis (Persian Wikisource looked empty for that reason).
      let items = [];
      let note = null;
      if (search) {
        const data = await fetchWikiJson(MW_SEARCH_URL(project, urlLang, search), { timeoutMs: 20000, maxBytes: 2 * 1024 * 1024 });
        items = mapMediawikiSearch(data, project, language, PROVIDER_LICENSES[project], urlLang);
      } else if (project === 'wikipedia') {
        let data = null;
        try {
          data = await memoJson(`mv:${project}:${urlLang}`, 30 * 60 * 1000, () =>
            fetchWikiJson(MW_MOSTVIEWED_URL(project, urlLang), { timeoutMs: 15000, maxBytes: 1024 * 1024 }),
          );
        } catch {
          /* fall through to allpages below */
        }
        items = mapMwMostviewed(data, project, language, PROVIDER_LICENSES[project], urlLang);
        if (items.length === 0) {
          const data2 = await fetchWikiJson(MW_ALLPAGES_URL(project, urlLang), { timeoutMs: 20000 });
          items = mapMwAllpages(data2, project, language, PROVIDER_LICENSES[project], urlLang);
        }
        note = 'Most-read articles on this Wikipedia edition right now - or search for any topic above.';
      } else {
        const data = await fetchWikiJson(MW_ALLPAGES_URL(project, urlLang), { timeoutMs: 20000 });
        items = mapMwAllpages(data, project, language, PROVIDER_LICENSES[project], urlLang);
        note = 'The main-namespace shelf of this edition, alphabetically - or search for any topic above.';
      }

      // The edition code rides along on every item whenever it differs from
      // the saved language: the import endpoint fetches {wiki}.{project}.org
      // for these refs, so a Maori learner browsing mi.wikipedia.org under a
      // differently-coded language still imports from the edition they saw.
      if (urlLang !== language) {
        for (const it of items) it.wiki = urlLang;
      }

      if (custom) {
        note = `${note ?? ''} Reading the ${urlLang} edition; texts are saved under your active language.`.trim();
      }
      return json({ provider, language, wiki: urlLang, query: search, note, items });
    }

    // ---------------------------------------------------------------- news
    if (provider === 'news') {
      const feeds = NEWS_FEEDS.filter((f) => f.language === language);
      if (feeds.length === 0) {
        return json({
          provider,
          language,
          query: search,
          items: [],
          note: 'No curated news feed for this language yet - use Wikinews or a URL import instead.',
        });
      }
      const results = [];
      const failures = [];
      for (const feed of feeds) {
        try {
          const xml = await fetchText(feed.url, { timeoutMs: 15000, maxBytes: 1024 * 1024 });
          for (const item of parseRss(xml)) {
            results.push({ ...item, provider: 'news', language, feed: feed.name });
          }
        } catch {
          failures.push(feed.name);
        }
      }
      const filtered = search
        ? results.filter(
            (r) =>
              (r.title ?? '').toLowerCase().includes(search.toLowerCase()) ||
              (r.description ?? '').toLowerCase().includes(search.toLowerCase()),
          )
        : results;
      return json({ provider, language, query: search, items: filtered.slice(0, 30), failed_feeds: failures });
    }

    throw new HttpError(400, 'invalid-provider', `Unknown provider "${provider}".`);
  },
});

export const config = { path: '/api/catalog' };
