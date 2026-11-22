/**
 * GET  /api/reading - reading positions (resume where you left off)
 * POST /api/reading - save position and log term encounters
 *
 * Encounters are the first layer of the learning progression: seeing a
 * term in context. They are recorded per term (deduplicated client-side
 * per reading session).
 */

import { handler, json, body, HttpError } from './lib/http.mjs';
import { requireUser } from './lib/identity.mjs';
import { sql } from './lib/db.mjs';

export default handler({
  GET: async (req) => {
    const user = await requireUser();
    const rows = await sql()`
      SELECT p.text_kind, p.text_id, p.position, p.last_read_at,
             COALESCE(t.title, s.title) AS title,
             COALESCE(t.language_code, s.language_code) AS language_code
      FROM user_data.reading_progress p
      LEFT JOIN user_data.texts t
        ON t.id = p.text_id AND p.text_kind = 'user' AND t.user_id = ${user.id} AND t.deleted_at IS NULL
      LEFT JOIN knowledge.shared_texts s
        ON s.id = p.text_id AND p.text_kind = 'shared'
      WHERE p.user_id = ${user.id}
      ORDER BY p.last_read_at DESC
      LIMIT 50`;
    return json({ progress: rows });
  },

  POST: async (req) => {
    const user = await requireUser();
    const data = await body(req);

    const textKind = data.text_kind === 'shared' ? 'shared' : data.text_kind === 'user' ? 'user' : null;
    if (!textKind) throw new HttpError(400, 'invalid-field', 'text_kind must be "user" or "shared".');
    const textId = typeof data.text_id === 'string' ? data.text_id : null;
    if (!textId) throw new HttpError(400, 'missing-field', 'Field "text_id" is required.');

    const position = data.position && typeof data.position === 'object' ? JSON.stringify(data.position) : '{}';

    await sql()`
      INSERT INTO user_data.reading_progress (user_id, text_kind, text_id, position, last_read_at)
      VALUES (${user.id}, ${textKind}, ${textId}, ${position}::jsonb, now())
      ON CONFLICT (user_id, text_kind, text_id) DO UPDATE SET
        position = EXCLUDED.position,
        last_read_at = now()`;

    const encounters = Array.isArray(data.encounters) ? data.encounters.slice(0, 200) : [];
    if (encounters.length > 0) {
      const params = [];
      const values = [];
      for (const enc of encounters) {
        if (enc == null || typeof enc !== 'object') continue;
        const term = String(enc.term ?? '').slice(0, 300);
        if (!term) continue;
        const entryId = typeof enc.entry_id === 'string' ? enc.entry_id : null;
        const base = params.length;
        params.push(user.id, entryId, term, textKind, textId);
        values.push(`($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5})`);
      }
      if (values.length > 0) {
        await sql().query(
          `INSERT INTO user_data.encounters (user_id, entry_id, term_raw, text_kind, text_id)
           VALUES ${values.join(', ')}`,
          params,
        );
      }
    }

    return json({ saved: true });
  },
});

export const config = { path: '/api/reading' };
