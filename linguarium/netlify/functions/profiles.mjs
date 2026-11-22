/**
 * GET    /api/profiles             - the user's language profiles
 * PUT    /api/profiles              - upsert a profile (language, difficulty mode, gloss language)
 * DELETE /api/profiles?language=xx  - remove a profile
 *
 * A profile is the user's relationship with a language. It stores the
 * difficulty mode (comfortable/stretch/challenge) and the language the
 * definitions should be written in (gloss language) - the platform is
 * language-agnostic and never assumes English glosses.
 */

import { handler, json, body, query, requireString, HttpError } from './lib/http.mjs';
import { requireUser, ensureUserRow } from './lib/identity.mjs';
import { sql } from './lib/db.mjs';
import { DIFFICULTY_MODES } from './lib/util.mjs';

export default handler({
  GET: async (req) => {
    const user = await requireUser();
    const rows = await sql()`
      SELECT id, language_code, difficulty_mode, gloss_language, active, created_at, updated_at
      FROM user_data.language_profiles
      WHERE user_id = ${user.id}
      ORDER BY created_at`;
    return json({ profiles: rows });
  },

  PUT: async (req) => {
    const user = await requireUser();
    await ensureUserRow(user);
    const data = await body(req);

    const language = requireString(data, 'language_code', { max: 16 });
    const difficultyMode = DIFFICULTY_MODES.includes(data.difficulty_mode) ? data.difficulty_mode : 'stretch';
    const glossLanguage = requireString(data, 'gloss_language', { max: 16, optional: true }) ?? 'en';
    const active = data.active === false ? false : true;

    const languageExists = await sql()`
      SELECT code FROM knowledge.languages
      WHERE code = ${language} AND (created_by IS NULL OR created_by = ${user.id})`;
    if (languageExists.length === 0) {
      throw new HttpError(404, 'language-not-found', 'Add the language first (GET /api/languages).');
    }

    const rows = await sql()`
      INSERT INTO user_data.language_profiles (user_id, language_code, difficulty_mode, gloss_language, active)
      VALUES (${user.id}, ${language}, ${difficultyMode}, ${glossLanguage}, ${active})
      ON CONFLICT (user_id, language_code) DO UPDATE SET
        difficulty_mode = EXCLUDED.difficulty_mode,
        gloss_language = EXCLUDED.gloss_language,
        active = EXCLUDED.active,
        updated_at = now()
      RETURNING id, language_code, difficulty_mode, gloss_language, active, created_at, updated_at`;
    return json({ profile: rows[0] });
  },

  DELETE: async (req) => {
    const user = await requireUser();
    const { language } = query(req);
    if (!language) {
      throw new HttpError(400, 'missing-param', 'Query parameter "language" is required.');
    }
    await sql()`
      DELETE FROM user_data.language_profiles
      WHERE user_id = ${user.id} AND language_code = ${language}`;
    return json({ deleted: true });
  },
});

export const config = { path: '/api/profiles' };
