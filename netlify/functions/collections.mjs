/**
 * GET    /api/collections            - list collections with item counts
 * GET    /api/collections?id=        - collection with all items
 * POST   /api/collections            - create
 * PUT    /api/collections            - update
 * DELETE /api/collections?id=        - delete with items
 *
 * Collections are study sets (word lists, phrase books, reader glossaries).
 * Items that failed import parsing are retained ("parsed": false) so that
 * no data is silently dropped.
 */

import { handler, json, body, query, requireString, HttpError } from './lib/http.mjs';
import { requireUser, ensureUserRow } from './lib/identity.mjs';
import { sql } from './lib/db.mjs';

export default handler({
  GET: async (req) => {
    const user = await requireUser();
    const q = query(req);

    if (q.id) {
      const coll = await sql()`
        SELECT id, user_id, language_code, name, description, source_type, source_url, license, created_at, updated_at
        FROM user_data.collections
        WHERE id = ${q.id} AND user_id = ${user.id}`;
      if (coll.length === 0) throw new HttpError(404, 'not-found', 'Collection not found.');
      const items = await sql()`
        SELECT id, collection_id, position, raw, parsed, term, definition, extra, created_at, updated_at
        FROM user_data.collection_items
        WHERE collection_id = ${q.id}
        ORDER BY position, created_at`;
      return json({
        collection: coll[0],
        items: items.map((i) => ({ ...i, extra: parseJson(i.extra) })),
      });
    }

    const rows = await sql()`
      SELECT c.id, c.user_id, c.language_code, c.name, c.description, c.source_type, c.source_url, c.license,
             c.created_at, c.updated_at,
             (SELECT count(*)::int FROM user_data.collection_items i WHERE i.collection_id = c.id) AS item_count,
             (SELECT count(*)::int FROM user_data.collection_items i WHERE i.collection_id = c.id AND i.parsed = false) AS unparsed_count
      FROM user_data.collections c
      WHERE c.user_id = ${user.id}
      ORDER BY c.created_at DESC`;
    return json({ collections: rows });
  },

  POST: async (req) => {
    const user = await requireUser();
    await ensureUserRow(user);
    const data = await body(req);
    const name = requireString(data, 'name', { max: 200 });
    const language = requireString(data, 'language_code', { max: 16 });
    const description = requireString(data, 'description', { max: 2000, optional: true });
    const sourceType = requireString(data, 'source_type', { max: 40, optional: true }) ?? 'user';
    const sourceUrl = requireString(data, 'source_url', { max: 1000, optional: true });
    const license = requireString(data, 'license', { max: 40, optional: true }) ?? 'unspecified';

    const rows = await sql()`
      INSERT INTO user_data.collections (user_id, language_code, name, description, source_type, source_url, license)
      VALUES (${user.id}, ${language}, ${name}, ${description}, ${sourceType}, ${sourceUrl}, ${license})
      RETURNING id, user_id, language_code, name, description, source_type, source_url, license, created_at, updated_at`;
    return json({ collection: { ...rows[0], item_count: 0, unparsed_count: 0 } }, 201);
  },

  PUT: async (req) => {
    const user = await requireUser();
    const data = await body(req);
    const id = requireString(data, 'id', { max: 64 });
    const name = requireString(data, 'name', { max: 200, optional: true });
    const description = requireString(data, 'description', { max: 2000, optional: true });
    const rows = await sql()`
      UPDATE user_data.collections SET
        name = COALESCE(${name}, name),
        description = ${description ?? null},
        updated_at = now()
      WHERE id = ${id} AND user_id = ${user.id}
      RETURNING id, user_id, language_code, name, description, source_type, source_url, license, created_at, updated_at`;
    if (rows.length === 0) throw new HttpError(404, 'not-found', 'Collection not found.');
    return json({ collection: rows[0] });
  },

  DELETE: async (req) => {
    const user = await requireUser();
    const { id } = query(req);
    if (!id) throw new HttpError(400, 'missing-param', 'Query parameter "id" is required.');
    const rows = await sql()`
      DELETE FROM user_data.collections WHERE id = ${id} AND user_id = ${user.id} RETURNING id`;
    if (rows.length === 0) throw new HttpError(404, 'not-found', 'Collection not found.');
    await sql()`DELETE FROM user_data.collection_items WHERE collection_id = ${id}`;
    return json({ deleted: true });
  },
});

function parseJson(v) {
  if (v == null) return {};
  if (typeof v === 'string') {
    try {
      return JSON.parse(v);
    } catch {
      return {};
    }
  }
  return v;
}

export const config = { path: '/api/collections' };
