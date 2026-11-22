/**
 * GET    /api/collection-items?collection= - list items
 * POST   /api/collection-items            - bulk import items (parsed or retained-unparsed)
 * PUT    /api/collection-items            - update/repair one item
 * DELETE /api/collection-items?id=        - remove one item
 *
 * Import rule from the specification: entries that cannot be parsed are
 * kept with "parsed": false and their raw content, never dropped.
 */

import { handler, json, body, query, requireString, HttpError, clampNumber } from './lib/http.mjs';
import { requireUser } from './lib/identity.mjs';
import { sql } from './lib/db.mjs';
import { sanitizeExtra } from './lib/util.mjs';

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

async function ownedCollection(userId, collectionId) {
  const rows = await sql()`
    SELECT id, language_code FROM user_data.collections
    WHERE id = ${collectionId} AND user_id = ${userId}`;
  if (rows.length === 0) {
    throw new HttpError(404, 'collection-not-found', 'Collection not found for this user.');
  }
  return rows[0];
}

export default handler({
  GET: async (req) => {
    const user = await requireUser();
    const q = query(req);
    const collectionId = q.collection;
    if (!collectionId) throw new HttpError(400, 'missing-param', 'Query parameter "collection" is required.');
    await ownedCollection(user.id, collectionId);
    const limit = clampNumber(q.limit, 1, 5000, 2000);
    const offset = clampNumber(q.offset, 0, 1000000, 0);
    const items = await sql()`
      SELECT id, collection_id, position, raw, parsed, term, definition, extra, created_at, updated_at
      FROM user_data.collection_items
      WHERE collection_id = ${collectionId}
      ORDER BY position, created_at
      LIMIT ${limit} OFFSET ${offset}`;
    return json({ items: items.map((i) => ({ ...i, extra: parseJson(i.extra) })) });
  },

  POST: async (req) => {
    const user = await requireUser();
    const data = await body(req);
    const collectionId = requireString(data, 'collection_id', { max: 64 });
    await ownedCollection(user.id, collectionId);

    const items = Array.isArray(data.items) ? data.items.slice(0, 2000) : [];
    if (items.length === 0) {
      throw new HttpError(400, 'missing-items', 'Body must contain an "items" array.');
    }

    const maxPos = await sql()`
      SELECT COALESCE(MAX(position), 0)::int AS p FROM user_data.collection_items
      WHERE collection_id = ${collectionId}`;
    let position = maxPos[0]?.p ?? 0;

    // Build a dynamic multi-row insert via sql.query with numbered parameters.
    const params = [];
    const valuesRows = [];
    for (const item of items) {
      position += 1;
      const parsed = item?.parsed === true;
      const raw = String(item?.raw ?? item?.term ?? '').slice(0, 2000);
      const term = parsed ? String(item.term ?? '').slice(0, 300).trim() : null;
      const definition = parsed && item.definition != null ? String(item.definition).slice(0, 2000) : null;
      const extra = sanitizeExtra(item?.extra);
      const base = params.length;
      params.push(collectionId, position, raw, parsed, term, definition, JSON.stringify(extra));
      valuesRows.push(`($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7}::jsonb)`);
    }

    await sql().query(
      `INSERT INTO user_data.collection_items
         (collection_id, position, raw, parsed, term, definition, extra)
       VALUES ${valuesRows.join(', ')}`,
      params,
    );

    const total = await sql()`
      SELECT count(*)::int AS count, count(*) FILTER (WHERE parsed = false)::int AS unparsed
      FROM user_data.collection_items WHERE collection_id = ${collectionId}`;
    return json(
      {
        inserted: items.length,
        item_count: total[0]?.count ?? 0,
        unparsed_count: total[0]?.unparsed ?? 0,
      },
      201,
    );
  },

  PUT: async (req) => {
    const user = await requireUser();
    const data = await body(req);
    const id = requireString(data, 'id', { max: 64 });
    const rows = await sql()`
      UPDATE user_data.collection_items i SET
        term = ${requireString(data, 'term', { max: 300, optional: true })},
        definition = ${requireString(data, 'definition', { max: 2000, optional: true })},
        parsed = ${data.parsed === true},
        updated_at = now()
      FROM user_data.collections c
      WHERE i.collection_id = c.id AND c.user_id = ${user.id} AND i.id = ${id}
      RETURNING i.id`;
    if (rows.length === 0) throw new HttpError(404, 'not-found', 'Item not found.');
    return json({ updated: true });
  },

  DELETE: async (req) => {
    const user = await requireUser();
    const { id } = query(req);
    if (!id) throw new HttpError(400, 'missing-param', 'Query parameter "id" is required.');
    const rows = await sql()`
      DELETE FROM user_data.collection_items i
      USING user_data.collections c
      WHERE i.collection_id = c.id AND c.user_id = ${user.id} AND i.id = ${id}
      RETURNING i.id`;
    if (rows.length === 0) throw new HttpError(404, 'not-found', 'Item not found.');
    return json({ deleted: true });
  },
});

export const config = { path: '/api/collection-items' };
