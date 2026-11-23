/**
 * GET /api/lexicon?language_code=xx&term=yy - shared community lexicon
 * lookup for one term.
 *
 * GET /api/lexicon?language_code=xx&mode=dictionary - the full term list
 * (term + reading) for one language. The client builds the SEGMENTATION
 * DICTIONARY from it: Japanese/Chinese reading texts are tokenized into
 * words by matching against this dictionary plus the learner's own
 * vocabulary (see src/shared/tokenizer.mjs). Cached offline in IndexedDB.
 *
 * The shared lexicon is community-maintained knowledge (provenance
 * 'community', never 'verified'): consulted by the Knowledge view next to
 * the user's own entries, the online dictionary chain and AI enrichment,
 * always clearly labelled. The match is exact (case-insensitive, NFC) -
 * this is a lookup, not a search engine.
 */

import { handler, json, query, requireString, HttpError } from './lib/http.mjs';
import { requireUser } from './lib/identity.mjs';
import { sql } from './lib/db.mjs';

export default handler({
  GET: async (req) => {
    const user = await requireUser();
    const q = query(req);
    const language = requireString(q, 'language_code', { max: 16 });

    // Dictionary mode: term + reading list for segmentation (and ruby).
    if (q.mode === 'dictionary') {
      const rows = await sql()`
        SELECT term, reading, part_of_speech, definition, provenance
        FROM knowledge.lexicon
        WHERE language_code = ${language}
        ORDER BY char_length(term) DESC, term
        LIMIT 5000`;
      return json({
        language_code: language,
        count: rows.length,
        note: 'Shared lexicon terms for segmentation and ruby readings. Community-maintained, unverified.',
        dictionary: rows,
      });
    }

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
