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
} from './lib/sources.mjs';

const PROVIDER_LICENSES = {
  wikipedia: 'cc-by-sa-4.0',
  wikibooks: 'cc-by-sa-4.0',
  wikinews: 'cc-by-2.5',
  wikisource: 'unspecified (varies per work - check the work page)',
};

const PROVIDER_PROJECTS = {
  wikisource: 'wikisource',
  wikipedia: 'wikipedia',
  wikibooks: 'wikibooks',
  wikinews: 'wikinews',
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
      if (language) {
        const rows = await sql()`SELECT code FROM knowledge.languages WHERE code = ${language}`;
        if (rows.length === 0) {
          throw new HttpError(404, 'language-not-found', 'Unknown language code.');
        }
      }

      // Custom/unknown language: probe its own code against the live wikis
      // once (memoized 15 min). Maori "mi" then simply gets Wikipedia.
      let probed = null;
      if (language && !PROVIDERS.wikipedia.languages.includes(language)) {
        probed = await memoJson(`probe:${language}`, 15 * 60 * 1000, async () => ({
          wikipedia: language.length <= 8 ? await wikiEditionExists(language, 'wikipedia') : false,
          wikisource: language.length <= 8 ? await wikiEditionExists(language, 'wikisource') : false,
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
              blurb: meta.blurb,
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
          blurb: probed && id in probed && probed[id] ? `${meta.blurb} (serving this language code directly)` : meta.blurb,
          priority: meta.priority ?? 99,
          available: true,
        });
      }
      providers.sort((a, b) => (a.priority ?? 99) - (b.priority ?? 99));
      const recommended = language ? providersForLanguage(language).map((p) => p.id) : [];
      return json({ providers, recommended });
    }

    // ---------------------------------------------------------------- search
    const provider = requireString(q, 'provider', { max: 20 });
    const language = requireString(q, 'language', { max: 16 });
    const search = q.q ? String(q.q).slice(0, 200) : '';

    const langRows = await sql()`SELECT code FROM knowledge.languages WHERE code = ${language}`;
    if (langRows.length === 0) {
      throw new HttpError(404, 'language-not-found', 'Unknown language code.');
    }

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
      const page = Math.min(100, Math.max(1, Number(q.page) || 1));
      const topic = GUTENBERG_TOPICS.includes(String(q.topic ?? '')) ? String(q.topic) : null;
      let data = null;
      let note = null;
      const cacheKey = (url) => `gutendex:${url}`;
      if (search) {
        try {
          data = await memoJson(
            cacheKey(GUTENDEX_SEARCH_URL(search, language, page)),
            10 * 60 * 1000,
            () => fetchJsonRetry(GUTENDEX_SEARCH_URL(search, language, page), { timeoutMs: 9000, maxBytes: 2 * 1024 * 1024 }),
          );
        } catch {
          data = await memoJson(
            cacheKey(GUTENDEX_BROWSE_URL(language, 1, topic)),
            10 * 60 * 1000,
            () => fetchJsonRetry(GUTENDEX_BROWSE_URL(language, 1, topic), { timeoutMs: 12000, maxBytes: 2 * 1024 * 1024 }),
          );
          note =
            "Project Gutenberg's search is slow right now - showing the " +
            `${language} public-domain shelf instead; the filter below applied your words to titles and authors on it.`;
        }
      } else {
        data = await memoJson(
          cacheKey(GUTENDEX_BROWSE_URL(language, page, topic)),
          30 * 60 * 1000,
          () => fetchJsonRetry(GUTENDEX_BROWSE_URL(language, page, topic), { timeoutMs: 12000, maxBytes: 2 * 1024 * 1024 }),
        );
      }
      let items = mapGutendex(data);
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
      const pageInfo = gutendexPageInfo(data);
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

      // The wiki code to actually fetch: a user-supplied code for the
      // custom-edition providers (required), or an optional override for the
      // built-in ones (e.g. reading a different edition of the same language).
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
