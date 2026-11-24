/**
 * GET  /api/languages - list language presets plus the user's custom languages
 * POST /api/languages - create a custom language definition
 * PUT  /api/languages - update the SOURCE EDITION of a custom language the
 *                       user owns (the wiki code the open library reads for
 *                       a language whose own code is not a wiki edition).
 *
 * Languages are data, not code: any language (including constructed
 * languages like Toki Pona, or a user's own custom language) is described
 * by a tokenizer configuration and works everywhere in the app. The
 * optional source_edition (e.g. "mi", "simple") is defined ONCE here - in
 * Settings, at creation or later - and every source-browsing surface
 * (catalog search, import, the library tab) then uses it without asking
 * again.
 */

import { handler, json, body, requireString, HttpError } from './lib/http.mjs';
import { requireUser, ensureUserRow } from './lib/identity.mjs';
import { sql, jsonb } from './lib/db.mjs';

function normalizeTokenizer(raw) {
  const t = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const bool = (v, dflt) => (typeof v === 'boolean' ? v : dflt);
  return {
    charLevel: bool(t.charLevel, false),
    caseFold: bool(t.caseFold, true),
    innerApostrophe: bool(t.innerApostrophe, false),
    innerHyphen: bool(t.innerHyphen, false),
  };
}

function parseTokenizer(v) {
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

/** Wiki-edition-shaped code: 2-12 chars, letter first, letters/digits/hyphens
 *  (same shape validWikiCode enforces in sources.mjs, checked here so the
 *  column never carries a host-injection payload). */
const EDITION_RE = /^[a-z][a-z0-9-]{1,11}$/;

function normalizeEdition(raw) {
  if (raw == null || raw === '') return null;
  const code = String(raw).trim().toLowerCase();
  if (!EDITION_RE.test(code)) {
    throw new HttpError(400, 'invalid-edition', 'The source edition must be a wiki language code like "mi", "scn" or "simple" (2-12 chars: letters, digits, hyphens).');
  }
  return code;
}

export default handler({
  GET: async (req) => {
    const user = await requireUser();
    const rows = await sql()`
      SELECT code, name, native_name, script, direction, tokenizer, kind, source_edition
      FROM knowledge.languages
      WHERE created_by IS NULL OR created_by = ${user.id}
      ORDER BY kind, name`;
    return json({
      languages: rows.map((r) => ({ ...r, tokenizer: parseTokenizer(r.tokenizer) })),
    });
  },

  POST: async (req) => {
    const user = await requireUser();
    await ensureUserRow(user);
    const data = await body(req);

    const code = requireString(data, 'code', { max: 16 }).toLowerCase();
    if (!/^[a-z][a-z0-9-]{1,15}$/.test(code)) {
      throw new HttpError(400, 'invalid-code', 'Language code must be 2-16 chars: letters, digits, hyphens.');
    }
    const name = requireString(data, 'name', { max: 80 });
    const nativeName = requireString(data, 'native_name', { max: 80, optional: true });
    const direction = data.direction === 'rtl' ? 'rtl' : 'ltr';
    const tokenizer = normalizeTokenizer(data.tokenizer);
    const sourceEdition = normalizeEdition(data.source_edition);

    const inserted = await sql()`
      INSERT INTO knowledge.languages (code, name, native_name, script, direction, tokenizer, kind, source_edition, created_by)
      VALUES (${code}, ${name}, ${nativeName}, ${data.script ?? 'custom'}, ${direction}, ${jsonb(tokenizer)}::jsonb, 'custom', ${sourceEdition}, ${user.id})
      ON CONFLICT (code) DO NOTHING
      RETURNING code, name, native_name, script, direction, tokenizer, kind, source_edition`;
    if (inserted.length === 0) {
      throw new HttpError(409, 'code-taken', `The language code "${code}" is already in use.`);
    }
    return json({ language: { ...inserted[0], tokenizer: parseTokenizer(inserted[0].tokenizer) } }, 201);
  },

  PUT: async (req) => {
    const user = await requireUser();
    const data = await body(req);
    const code = requireString(data, 'code', { max: 16 }).toLowerCase();
    const sourceEdition = normalizeEdition(data.source_edition); // null clears it

    // Only the creator may edit their custom language; preset languages
    // (created_by IS NULL) are shared and read-only here.
    const updated = await sql()`
      UPDATE knowledge.languages
      SET source_edition = ${sourceEdition}
      WHERE code = ${code} AND created_by = ${user.id}
      RETURNING code, name, native_name, script, direction, tokenizer, kind, source_edition`;
    if (updated.length === 0) {
      throw new HttpError(
        404,
        'language-not-found',
        'No custom language with that code belongs to you (built-in languages cannot be edited).',
      );
    }
    return json({ language: { ...updated[0], tokenizer: parseTokenizer(updated[0].tokenizer) } });
  },
});

export const config = { path: '/api/languages' };
