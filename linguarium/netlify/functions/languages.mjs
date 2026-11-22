/**
 * GET  /api/languages - list language presets plus the user's custom languages
 * POST /api/languages - create a custom language definition
 *
 * Languages are data, not code: any language (including constructed
 * languages like Toki Pona, or a user's own custom language) is described
 * by a tokenizer configuration and works everywhere in the app.
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

export default handler({
  GET: async (req) => {
    const user = await requireUser();
    const rows = await sql()`
      SELECT code, name, native_name, script, direction, tokenizer, kind
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

    const inserted = await sql()`
      INSERT INTO knowledge.languages (code, name, native_name, script, direction, tokenizer, kind, created_by)
      VALUES (${code}, ${name}, ${nativeName}, ${data.script ?? 'custom'}, ${direction}, ${jsonb(tokenizer)}::jsonb, 'custom', ${user.id})
      ON CONFLICT (code) DO NOTHING
      RETURNING code, name, native_name, script, direction, tokenizer, kind`;
    if (inserted.length === 0) {
      throw new HttpError(409, 'code-taken', `The language code "${code}" is already in use.`);
    }
    return json({ language: { ...inserted[0], tokenizer: parseTokenizer(inserted[0].tokenizer) } }, 201);
  },
});

export const config = { path: '/api/languages' };
