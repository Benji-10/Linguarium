/**
 * GET /api/lexicon?language_code=xx&term=yy - shared community lexicon
 * lookup for one term.
 *
 * The shared lexicon is community-maintained knowledge (provenance
 * 'community', never 'verified'): consulted by the Knowledge view next to
 * the user's own entries and AI enrichment, always clearly labelled.
 * The match is exact (case-insensitive, NFC) - this is a lookup, not a
 * search engine.
 */

import { handler, json, query, requireString, HttpError } from './lib/http.mjs';
import { requireUser } from './lib/identity.mjs';
import { sql } from './lib/db.mjs';

export default handler({
  GET: async (req) => {
    const user = await requireUser();
    const q = query(req);
    const language = requireString(q, 'language_code', { max: 16 });
    const term = requireString(q, 'term', { max: 300 });

    const rows = await sql()`
      SELECT id, language_code, term, reading, part_of_speech, definition, gloss_language,
             provenance, source_url, license, source_ref
      FROM knowledge.lexicon
      WHERE language_code = ${language} AND lower(term) = lower(${term})
      ORDER BY created_at
      LIMIT 10`;
    return json({ entries: rows });
  },
});

export const config = { path: '/api/lexicon' };
