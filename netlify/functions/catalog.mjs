/**
 * GET /api/catalog - search the open content sources for importable texts.
 *
 *   ?language=ja&q=neko&provider=aozora|gutenberg|wikisource|wikipedia|wikibooks|wikinews|news
 *
 * Every provider is keyless, free and honestly labelled with its license
 * situation (see lib/sources.mjs). Without `provider` the endpoint returns
 * the provider catalog itself so the UI can render the tabs: with a
 * `language`, each provider is marked whether it actually serves that
 * language (the sources differ per language - Japanese leads with Aozora
 * Bunko, Korean has the wiki family, Gutenberg only where a shelf exists).
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
  NEWS_FEEDS,
  GUTENDEX_SEARCH_URL,
  GUTENDEX_BROWSE_URL,
  MW_SEARCH_URL,
  providersForLanguage,
  aozoraCatalogItems,
  mapGutendex,
  gutendexPageInfo,
  mapMediawikiSearch,
  parseRss,
  fetchJson,
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

export default handler({
  GET: async (req) => {
    const user = await requireUser();
    const q = query(req);

    // Provider catalog (UI tabs): which source serves which language is part
    // of the data now, not a client-side guess.
    if (!q.provider) {
      const language = q.language ? String(q.language).slice(0, 16) : null;
      let languages = [];
      if (language) {
        const rows = await sql()`SELECT code FROM knowledge.languages WHERE code = ${language}`;
        if (rows.length === 0) {
          throw new HttpError(404, 'language-not-found', 'Unknown language code.');
        }
        languages = [language];
      }
      const providers = Object.entries(PROVIDERS).map(([id, meta]) => ({
        id,
        label: meta.label,
        blurb: meta.blurb,
        priority: meta.priority ?? 99,
        // null = serves all/unknown, array = the languages it actually has.
        languages: id === 'news' ? NEWS_FEEDS.map((f) => f.language) : meta.languages ?? null,
        available: !language || (meta.languages ?? []).includes(language) || (id === 'news' && NEWS_FEEDS.some((f) => f.language === language)),
      }));
      const recommended = language ? providersForLanguage(language).map((p) => p.id) : [];
      return json({ providers, recommended });
    }

    const provider = requireString(q, 'provider', { max: 16 });
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
            cacheKey(GUTENDEX_BROWSE_URL(language, 1)),
            10 * 60 * 1000,
            () => fetchJsonRetry(GUTENDEX_BROWSE_URL(language, 1), { timeoutMs: 12000, maxBytes: 2 * 1024 * 1024 }),
          );
          note =
            "Project Gutenberg's search is slow right now - showing the " +
            `${language} public-domain shelf instead; the filter below applied your words to titles and authors on it.`;
        }
      } else {
        data = await memoJson(
          cacheKey(GUTENDEX_BROWSE_URL(language, page)),
          30 * 60 * 1000,
          () => fetchJsonRetry(GUTENDEX_BROWSE_URL(language, page), { timeoutMs: 12000, maxBytes: 2 * 1024 * 1024 }),
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
        items,
      });
    }

    if (PROVIDER_PROJECTS[provider]) {
      const project = PROVIDER_PROJECTS[provider];
      const url = MW_SEARCH_URL(project, language, search || 'recommended');
      const data = await fetchJson(url, { timeoutMs: 20000 });
      const items = mapMediawikiSearch(data, project, language, PROVIDER_LICENSES[provider]);
      return json({ provider, language, query: search, items });
    }

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
