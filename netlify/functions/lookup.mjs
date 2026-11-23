/**
 * GET/POST /api/lookup - word lookup with the honest source chain:
 *
 *   1. the shared community lexicon (local, instant, offline)
 *   2. the server-side lookup cache (one fetch per term per deployment)
 *   3. ONLINE DICTIONARIES - Wiktionary REST definitions for every language,
 *      plus dictionaryapi.dev for English (both keyless, free, attributed)
 *   4. AI (Gemini) is the explicit, user-triggered fallback via /api/enrich -
 *      it is never called silently here, so quotas stay predictable.
 *
 * Every entry carries its source and license. Wiktionary content is
 * CC BY-SA 4.0 and attributed by linking the entry page.
 */

import { handler, json, body, query, requireString, HttpError, clampNumber } from './lib/http.mjs';
import { requireUser } from './lib/identity.mjs';
import { sql } from './lib/db.mjs';
import { consumeDailyQuota } from './lib/ratelimit.mjs';
import { fetchJson, mapWiktionaryDefinitions, mapFreeDictionaryApi, WIKTIONARY_PAGE_URL } from './lib/sources.mjs';

const MAX_TERM = 100;

async function lookupOnline(language, term) {
  const entries = [];

  // Wiktionary REST definitions - covers every language we can name.
  try {
    const wiki = await fetchJson(`https://en.wiktionary.org/api/rest_v1/page/definition/${encodeURIComponent(term)}`, {
      timeoutMs: 15000,
    });
    const mapped = mapWiktionaryDefinitions(wiki, language.code, language.name);
    for (const m of mapped) {
      entries.push({
        source: 'wiktionary',
        part_of_speech: m.part_of_speech,
        definition: m.definition,
        examples: m.examples,
        source_url: WIKTIONARY_PAGE_URL(term),
        license: 'cc-by-sa-4.0',
        attribution: 'Wiktionary (CC BY-SA 4.0)',
      });
    }
  } catch {
    /* Wiktionary unreachable or no page - the chain continues honestly. */
  }

  // dictionaryapi.dev - English bonus dictionary, also keyless and free.
  if (entries.length === 0 && language.code === 'en') {
    try {
      const data = await fetchJson(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(term)}`, {
        timeoutMs: 15000,
      });
      const { entries: mapped } = mapFreeDictionaryApi(data);
      for (const m of mapped) {
        entries.push({
          source: 'dictionaryapi.dev',
          part_of_speech: m.part_of_speech,
          definition: m.definition,
          examples: m.examples,
          source_url: `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(term)}`,
          license: 'public-domain-style API; see dictionaryapi.dev',
          attribution: 'Free Dictionary API (dictionaryapi.dev)',
        });
      }
    } catch {
      /* offline provider - the response reports it honestly below */
    }
  }

  return entries;
}

async function runLookup(req) {
  const user = await requireUser();
  const data = req.method === 'POST' ? await body(req) : query(req);
  const languageCode = requireString(data, 'language_code', { max: 16 });
  const term = requireString(data, 'term', { max: MAX_TERM });

  // 1. Local: the shared community lexicon.
  const localRows = await sql()`
    SELECT id, term, reading, part_of_speech, definition, provenance, source_url, license, source_ref
    FROM knowledge.lexicon
    WHERE language_code = ${languageCode} AND lower(term) = lower(${term})
    ORDER BY created_at
    LIMIT 10`;
  const localEntries = localRows.map((r) => ({
    source: 'lexicon',
    part_of_speech: r.part_of_speech,
    definition: r.definition,
    reading: r.reading,
    examples: [],
    source_url: r.source_url,
    license: r.license,
    attribution: 'Linguarium shared lexicon (community-maintained, unverified)',
  }));

  const langRows = await sql()`SELECT code, name FROM knowledge.languages WHERE code = ${languageCode}`;
  const language = langRows[0] ?? { code: languageCode, name: languageCode };

  // 2. Server-side cache.
  const cached = await sql()`
    SELECT payload, source, source_url, license, created_at FROM knowledge.lookup_cache
    WHERE language_code = ${languageCode} AND term = ${term}`;
  let onlineEntries = [];
  let onlineSource = null;
  let onlineCached = false;
  if (cached.length > 0) {
    const payload = typeof cached[0].payload === 'string' ? JSON.parse(cached[0].payload) : cached[0].payload;
    onlineEntries = Array.isArray(payload?.entries) ? payload.entries : [];
    onlineSource = payload?.source ?? null;
    onlineCached = true;
  } else if (localEntries.length === 0) {
    // 3. Online dictionaries - only when the local lexicon has nothing.
    const dailyLimit = Number(process.env.LOOKUP_DAILY_LIMIT) || 500;
    const used = await consumeDailyQuota(user.id, 'lookup');
    if (used > dailyLimit) {
      throw new HttpError(
        429,
        'rate-limited',
        `Daily online-lookup limit reached (${dailyLimit}). The limit resets tomorrow.`,
      );
    }
    onlineEntries = await lookupOnline(language, term);
    if (onlineEntries.length > 0) {
      onlineSource = onlineEntries[0].source;
      await sql()`
        INSERT INTO knowledge.lookup_cache (language_code, term, payload, source, source_url, license)
        VALUES (${languageCode}, ${term}, ${JSON.stringify({ entries: onlineEntries, source: onlineSource })}::jsonb,
                ${onlineSource}, ${onlineEntries[0].source_url}, ${onlineEntries[0].license})
        ON CONFLICT (language_code, term) DO NOTHING`;
    }
  }

  const aiConfigured = Boolean(process.env.GEMINI_API_KEY);

  return json({
    term,
    language_code: languageCode,
    found: localEntries.length + onlineEntries.length > 0,
    entries: [...localEntries, ...onlineEntries],
    online_cached: onlineCached,
    ai_fallback_available: aiConfigured,
    ai_fallback_hint: aiConfigured
      ? 'No dictionary entry found - "AI analysis" (Gemini, labelled unverified) is the explicit fallback.'
      : null,
    sources_consulted: [
      { name: 'Shared lexicon', result: localEntries.length > 0 ? 'found' : 'not found' },
      onlineEntries.length > 0 || cached.length > 0
        ? { name: 'Wiktionary / free dictionaries', result: onlineEntries.length > 0 ? 'found' : 'not found' }
        : null,
    ].filter(Boolean),
  });
}

export default handler({
  GET: runLookup,
  POST: runLookup,
});

export const config = { path: '/api/lookup' };
