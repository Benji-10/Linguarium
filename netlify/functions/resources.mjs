/**
 * GET /api/resources?language=xx - the curated catalog of open language
 * resources (frequency lists, pronunciation references, learner corpora,
 * dictionaries) for one language, or for all of them.
 *
 * The catalog is shared knowledge seeded with the database (and extended by
 * moderated community contributions). Entries link to the source with its
 * license - the data itself is never copied into this deployment.
 */

import { handler, json, query, HttpError } from './lib/http.mjs';
import { requireUser } from './lib/identity.mjs';
import { sql } from './lib/db.mjs';

const KIND_ORDER = { frequency_list: 0, pronunciation: 1, dictionary: 2, corpus: 3 };

export default handler({
  GET: async (req) => {
    const user = await requireUser();
    const q = query(req);
    const language = q.language ? String(q.language).slice(0, 16) : null;

    let rows;
    if (language) {
      const exists = await sql()`SELECT code FROM knowledge.languages WHERE code = ${language}`;
      if (exists.length === 0) {
        throw new HttpError(404, 'language-not-found', 'Unknown language code.');
      }
      rows = await sql()`
        SELECT id, language_code, kind, name, description, source_url, license, provenance, source_ref
        FROM knowledge.resources
        WHERE language_code = ${language}
        ORDER BY kind, name`;
    } else {
      rows = await sql()`
        SELECT id, language_code, kind, name, description, source_url, license, provenance, source_ref
        FROM knowledge.resources
        ORDER BY language_code, kind, name`;
    }

    // Stable, human-friendly ordering: frequency lists first (most directly
    // useful for difficulty), then pronunciation, dictionaries, corpora.
    const resources = rows.map((r) => ({ ...r, rank: KIND_ORDER[r.kind] ?? 9 }));
    resources.sort((a, b) => (a.rank - b.rank) || String(a.name).localeCompare(String(b.name)));
    for (const r of resources) delete r.rank;
    return json({ resources });
  },
});

export const config = { path: '/api/resources' };
