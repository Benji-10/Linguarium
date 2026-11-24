/**
 * GET /api/catalog - search the open content sources for importable texts.
 *
 *   ?language=ja&q=neko&provider=aozora|gutenberg|classics|wikisource|wikipedia|wikibooks|wikinews|news
 *   &page=2                     (Gutenberg pagination, served from the snapshot)
 *   &topic=fiction              (Gutenberg genre filter, validated allowlist)
 *   &wiki=mi                    (custom-edition wiki code for wikipedia/wikisource)
 *
 * Every provider is keyless, free and honestly labelled with its license
 * situation (see lib/sources.mjs). Without `provider` the endpoint returns
 * the provider catalog itself so the UI can render the tabs: with a
 * `language`, each provider is marked whether it actually serves that
 * language (the sources differ per language - Japanese leads with Aozora
 * Bunko, Korean with the Classic literature shelf, Gutenberg only where the
 * bundled catalogue snapshot has a shelf). Sources that do NOT serve the
 * language are omitted entirely rather than greyed out - a disabled tab
 * reads as a broken tab.
 *
 * Gutenberg browsing/search is INSTANT: it reads the committed catalogue
 * snapshot (lib/gutenberg-shelves.mjs) with no upstream call at all. The
 * flaky live Gutendex API is consulted only as a supplement when an English
 * search finds nothing in the snapshot (books beyond its 20,000 English
 * cap), and its failure degrades to an honest note, never an error.
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
import { gutenbergShelf } from './lib/gutenberg-shelves.mjs';
import {
  PROVIDERS,
  GUTENBERG_LANGUAGES,
  GUTENBERG_TOPICS,
  CLASSICS_LANGUAGES,
  NEWS_FEEDS,
  GUTENDEX_SEARCH_URL,
  MW_SEARCH_URL,
  MW_MOSTVIEWED_URL,
  MW_ALLPAGES_URL,
  providersForLanguage,
  validWikiCode,
  wikiEditionExists,
  aozoraCatalogItems,
  classicsCatalogItems,
  filterGutenbergRows,
  paginateRows,
  mapGutenbergRows,
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

    if (provider === 'classics') {
      // Curated famous-work shelf (Korean pansori and novels, Chekhov and
      // Pushkin, the Chinese canon...), served locally like Aozora: no
      // network, no rate limit. The import fetches the exact page from the
      // language's own Wikisource edition.
      if (!CLASSICS_LANGUAGES.includes(language)) {
        throw new HttpError(400, 'not-for-language', 'The classic literature shelf is only curated for Korean, Russian and Chinese so far - use Wikisource to browse everything else.');
      }
      const items = classicsCatalogItems(language, search);
      return json({
        provider,
        language,
        query: search,
        items,
        note: `${items.length} famous public-domain ${language === 'ko' ? 'Korean' : language === 'ru' ? 'Russian' : 'Chinese'} works, hand-picked and hosted on ${language}.wikisource.org - imported through the Wikisource text pipeline (license varies per work; each source page is authoritative).`,
      });
    }

    if (provider === 'gutenberg') {
      // Gutenberg is only offered where the bundled catalogue snapshot
      // actually has a shelf (the old live Gutendex route HUNG on languages
      // with no books, and gutenberg.org itself throttles datacenter
      // traffic). The honest answer is "no shelf here, use X instead".
      if (!GUTENBERG_LANGUAGES.includes(language)) {
        const alternatives = providersForLanguage(language).filter((p) => p.id !== 'gutenberg');
        return json({
          provider,
          language,
          query: search,
          items: [],
          note: `Project Gutenberg's catalogue has no meaningful shelf for this language. For ${language}, try: ${alternatives.map((p) => p.label).join(', ') || 'the wiki sources'}.`,
        });
      }
      // Snapshot-first browsing: the committed pg_catalog snapshot answers
      // instantly (title/author search and topic filtering run locally), so
      // the flaky live API is never on the critical path. The ONE thing the
      // snapshot cannot know is English books beyond its 20,000-book cap and
      // brand-new uploads, so an English search with no local hits gets one
      // short best-effort live attempt; its failure degrades to a note.
      const page = Math.min(10000, Math.max(1, Number(q.page) || 1));
      const topic = GUTENBERG_TOPICS.includes(String(q.topic ?? '')) ? String(q.topic) : null;
      const shelf = gutenbergShelf(language);
      let filtered = filterGutenbergRows(shelf, { query: search, topic });
      let note = search
        ? `${filtered.length} match${filtered.length === 1 ? '' : 'es'} in the bundled Project Gutenberg catalogue (${shelf.length} ${language} books in total, newest uploads not yet included).`
        : `The bundled Project Gutenberg catalogue: all ${shelf.length} ${language} books it stocks, in catalogue order. Search filters titles and authors; topic filters use the catalogue's own subject tags.`;

      if (search && filtered.length === 0 && language === 'en') {
        // Live supplement (English only): books outside the snapshot. Every
        // call is memo-cached; Gutendex rate-limits bursts aggressively and
        // 403-refuses datacenter traffic at times, so a failure here is
        // EXPECTED and only costs the user a note, never a 502.
        const url = GUTENDEX_SEARCH_URL(search, language, Math.min(100, page));
        const key = `gutendex:${url}`;
        try {
          const data = await memoJson(key, 10 * 60 * 1000, () =>
            fetchJsonRetry(url, { timeoutMs: 4000, attempts: 2, backoffMs: 250, maxBytes: 2 * 1024 * 1024 }),
          );
          const items = mapGutendex(data);
          if (items.length > 0) {
            return json({
              provider,
              language,
              query: search,
              page,
              pages: gutendexPageInfo(data),
              note: 'From the live catalogue search (these books are newer than the bundled snapshot).',
              topic,
              items,
            });
          }
        } catch {
          const cached = memoJsonStale(key);
          if (cached) {
            const items = mapGutendex(cached);
            if (items.length > 0) {
              return json({
                provider,
                language,
                query: search,
                page,
                pages: gutendexPageInfo(cached),
                note: 'From the last successful live catalogue search - the catalogue was slow just now.',
                topic,
                items,
              });
            }
          }
          note =
            `No match in the bundled catalogue (it carries the first 20,000 English books). ` +
            'The live catalogue search did not answer in time - it rate-limits bursts; try again in a few seconds.';
        }
      }

      const { items: pageRows, pages } = paginateRows(filtered, page, 32);
      return json({
        provider,
        language,
        query: search,
        page,
        pages,
        note,
        topic,
        items: mapGutenbergRows(pageRows, language),
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
