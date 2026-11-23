/**
 * GET    /api/texts            - user texts (meta) plus the shared library
 * GET    /api/texts?id=&kind=  - single text with full body
 * POST   /api/texts            - add a text (paste or upload), with source metadata
 * PUT    /api/texts            - update body/title
 * DELETE /api/texts?id=        - soft delete
 *
 * Provenance is mandatory: real texts keep author/source/license; adapted
 * texts keep the original work's information plus an adaptation note; the
 * provenance of everything a user adds is 'user-imported' (they assert the
 * licensing themselves).
 */

import { handler, json, body, query, requireString, HttpError } from './lib/http.mjs';
import { requireUser, ensureUserRow } from './lib/identity.mjs';
import { sql } from './lib/db.mjs';

const MAX_BODY_CHARS = 200000;

export default handler({
  GET: async (req) => {
    const user = await requireUser();
    const q = query(req);

    if (q.id && (q.kind === 'user' || q.kind === 'shared')) {
      if (q.kind === 'user') {
        const rows = await sql()`
          SELECT id, user_id, language_code, title, body, author, source_url, license, adaptation_note, provenance, topic, audio_url, created_at, updated_at
          FROM user_data.texts
          WHERE id = ${q.id} AND user_id = ${user.id} AND deleted_at IS NULL`;
        if (rows.length === 0) throw new HttpError(404, 'not-found', 'Text not found.');
        return json({ text: rows[0] });
      }
      const rows = await sql()`
        SELECT id, language_code, title, body, author, source_url, license, adaptation_note, provenance, source_ref, topic, created_at
        FROM knowledge.shared_texts
        WHERE id = ${q.id}`;
      if (rows.length === 0) throw new HttpError(404, 'not-found', 'Shared text not found.');
      return json({ text: rows[0] });
    }

    const mine = await sql()`
      SELECT id, language_code, title, author, source_url, license, adaptation_note, provenance, topic, audio_url,
             length(body)::int AS body_length, created_at, updated_at
      FROM user_data.texts
      WHERE user_id = ${user.id} AND deleted_at IS NULL
      ORDER BY updated_at DESC`;
    const shared = await sql()`
      SELECT id, language_code, title, author, source_url, license, adaptation_note, provenance, source_ref, topic,
             length(body)::int AS body_length, created_at
      FROM knowledge.shared_texts
      ORDER BY created_at`;
    return json({ texts: mine, shared });
  },

  POST: async (req) => {
    const user = await requireUser();
    await ensureUserRow(user);
    const data = await body(req);

    const language = requireString(data, 'language_code', { max: 16 });
    const title = requireString(data, 'title', { max: 300 });
    const textBody = requireString(data, 'body', { max: MAX_BODY_CHARS });
    const author = requireString(data, 'author', { max: 300, optional: true });
    const sourceUrl = requireString(data, 'source_url', { max: 1000, optional: true });
    const license = requireString(data, 'license', { max: 40, optional: true }) ?? 'unspecified';
    const adaptationNote = requireString(data, 'adaptation_note', { max: 2000, optional: true });
    const topic = requireString(data, 'topic', { max: 40, optional: true });
    // Listening environment: audio stays a REFERENCE (URL + its own licensing,
    // user-asserted) - never a binary blob in the database.
    const audioUrl = requireString(data, 'audio_url', { max: 1000, optional: true });
    if (audioUrl && !/^https:\/\//.test(audioUrl)) {
      throw new HttpError(400, 'invalid-param', 'audio_url must be an absolute https URL.');
    }

    const langExists = await sql()`
      SELECT code FROM knowledge.languages
      WHERE code = ${language} AND (created_by IS NULL OR created_by = ${user.id})`;
    if (langExists.length === 0) {
      throw new HttpError(404, 'language-not-found', 'Unknown language code.');
    }

    const rows = await sql()`
      INSERT INTO user_data.texts
        (user_id, language_code, title, body, author, source_url, license, adaptation_note, provenance, topic, audio_url)
      VALUES
        (${user.id}, ${language}, ${title}, ${textBody}, ${author}, ${sourceUrl}, ${license}, ${adaptationNote}, 'user-imported', ${topic}, ${audioUrl})
      RETURNING id, user_id, language_code, title, body, author, source_url, license, adaptation_note, provenance, topic, audio_url, created_at, updated_at`;
    return json({ text: rows[0] }, 201);
  },

  PUT: async (req) => {
    const user = await requireUser();
    const data = await body(req);
    const id = requireString(data, 'id', { max: 64 });
    const title = requireString(data, 'title', { max: 300, optional: true });
    const textBody = requireString(data, 'body', { max: MAX_BODY_CHARS, optional: true });
    const rows = await sql()`
      UPDATE user_data.texts SET
        title = COALESCE(${title}, title),
        body = COALESCE(${textBody}, body),
        updated_at = now()
      WHERE id = ${id} AND user_id = ${user.id} AND deleted_at IS NULL
      RETURNING id`;
    if (rows.length === 0) throw new HttpError(404, 'not-found', 'Text not found.');
    return json({ updated: true });
  },

  DELETE: async (req) => {
    const user = await requireUser();
    const { id } = query(req);
    if (!id) throw new HttpError(400, 'missing-param', 'Query parameter "id" is required.');
    const rows = await sql()`
      UPDATE user_data.texts SET deleted_at = now(), updated_at = now()
      WHERE id = ${id} AND user_id = ${user.id} AND deleted_at IS NULL
      RETURNING id`;
    if (rows.length === 0) throw new HttpError(404, 'not-found', 'Text not found.');
    return json({ deleted: true });
  },
});

export const config = { path: '/api/texts' };
