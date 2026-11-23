/**
 * GET /api/catalog - search the open content sources for importable texts.
 *
 *   ?language=ja&q=neko&provider=gutenberg|wikisource|wikipedia|wikinews|news
 *
 * Every provider is keyless, free and honestly labelled with its license
 * situation (see lib/sources.mjs). Without `provider` the endpoint returns
 * the provider catalog itself so the UI can render the tabs.
 *
 * Cross-contamination rule: the client restricts the language to the active
 * learning language; the server validates that the language exists at all.
 */

import { handler, json, query, requireString, HttpError } from './lib/http.mjs';
import { requireUser } from './lib/identity.mjs';
import { sql } from './lib/db.mjs';
import {
  PROVIDERS,
  NEWS_FEEDS,
  GUTENDEX_SEARCH_URL,
  MW_SEARCH_URL,
  mapGutendex,
  mapMediawikiSearch,
  parseRss,
  fetchJson,
  fetchText,
} from './lib/sources.mjs';

const PROVIDER_LICENSES = {
  wikipedia: 'cc-by-sa-4.0',
  wikinews: 'cc-by-2.5',
  wikisource: 'unspecified (varies per work - check the work page)',
};

const PROVIDER_PROJECTS = {
  wikisource: 'wikisource',
  wikipedia: 'wikipedia',
  wikinews: 'wikinews',
};

export default handler({
  GET: async (req) => {
    const user = await requireUser();
    const q = query(req);

    // Provider catalog (UI tabs).
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
        ...meta,
        // News feeds exist only for the curated languages.
        languages: id === 'news' ? NEWS_FEEDS.map((f) => f.language) : null,
      }));
      return json({ providers });
    }

    const provider = requireString(q, 'provider', { max: 16 });
    const language = requireString(q, 'language', { max: 16 });
    const search = q.q ? String(q.q).slice(0, 200) : '';

    const langRows = await sql()`SELECT code FROM knowledge.languages WHERE code = ${language}`;
    if (langRows.length === 0) {
      throw new HttpError(404, 'language-not-found', 'Unknown language code.');
    }

    if (provider === 'gutenberg') {
      // Gutendex search; results already carry per-book language codes.
      const url = GUTENDEX_SEARCH_URL(search, language);
      const data = await fetchJson(url, { timeoutMs: 20000 });
      let items = mapGutendex(data);
      items = items.filter((it) => it.language === language);
      return json({ provider, language, query: search, items });
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
