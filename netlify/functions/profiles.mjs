/**
 * GET    /api/profiles             - the user's language profiles
 * PUT    /api/profiles              - upsert a profile (language, difficulty mode,
 *                                     gloss language, self-declared level, and
 *                                     phase-3 scheduling preferences: per-dimension
 *                                     target retention and optional daily caps)
 * DELETE /api/profiles?language=xx  - remove a profile
 *
 * A profile is the user's relationship with a language. It stores the
 * difficulty mode (comfortable/stretch/challenge), the language the
 * definitions should be written in (gloss language - the platform is
 * language-agnostic and never assumes English glosses), the self-declared
 * proficiency LEVEL ("complete beginner in Korean, fluent in French" - a
 * starting point statement, never a CEFR sticker; difficulty estimates stay
 * computed from the learner's own knowledge state), and since phase 3:
 *   - retention_recognition / retention_recall / retention_production:
 *     the FSRS target retention per ability dimension (intervals are chosen
 *     so predicted recall stays above it; 0.7-0.97, default 0.9)
 *   - daily_new_limit / daily_review_limit: optional daily caps for the
 *     review queue (NULL = no cap)
 */

import { handler, json, body, query, requireString, HttpError } from './lib/http.mjs';
import { requireUser, ensureUserRow } from './lib/identity.mjs';
import { sql } from './lib/db.mjs';
import { DIFFICULTY_MODES } from './lib/util.mjs';

const PROFILE_SELECT =
  'id, language_code, difficulty_mode, gloss_language, level, active, ' +
  'retention_recognition, retention_recall, retention_production, daily_new_limit, daily_review_limit, ' +
  'created_at, updated_at';

const LEVELS = ['complete-beginner', 'beginner', 'intermediate', 'advanced', 'fluent'];

/** Parse the self-declared level; undefined = keep current, null/'' = unset. */
function parseLevel(v) {
  if (v === undefined) return undefined;
  if (v == null || v === '') return null;
  if (!LEVELS.includes(v)) {
    throw new HttpError(400, 'invalid-field', `Field "level" must be one of ${LEVELS.join(', ')} (or empty to unset).`);
  }
  return v;
}

/** Parse a target retention (0.70-0.97); null means "not provided, keep current". */
function parseRetention(v) {
  if (v == null || v === '') return null;
  const n = Number(v);
  if (!Number.isFinite(n)) throw new HttpError(400, 'invalid-field', 'Retention values must be numbers between 0.70 and 0.97.');
  return Math.min(0.97, Math.max(0.7, n));
}

/** Parse a daily limit (1-999); null/empty means "no cap". */
function parseLimit(v) {
  if (v == null || v === '') return null;
  const n = Number(v);
  if (!Number.isInteger(n) || n < 1 || n > 999) {
    throw new HttpError(400, 'invalid-field', 'Daily limits must be whole numbers between 1 and 999 (or empty for no cap).');
  }
  return n;
}

export default handler({
  GET: async (req) => {
    const user = await requireUser();
    const s = sql();
    const rows = await s`
      SELECT ${s.unsafe(PROFILE_SELECT)}
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
    const level = parseLevel(data.level);
    const active = data.active === false ? false : true;

    const languageExists = await sql()`
      SELECT code FROM knowledge.languages
      WHERE code = ${language} AND (created_by IS NULL OR created_by = ${user.id})`;
    if (languageExists.length === 0) {
      throw new HttpError(404, 'language-not-found', 'Add the language first (GET /api/languages).');
    }

    // Phase-3 scheduling preferences. Absent fields keep their current values
    // (the settings UI always sends the whole row, but partial updates must
    // not wipe a learner's tuning).
    const retentionRecognition = parseRetention(data.retention_recognition);
    const retentionRecall = parseRetention(data.retention_recall);
    const retentionProduction = parseRetention(data.retention_production);
    const dailyNewLimit = parseLimit(data.daily_new_limit);
    const dailyReviewLimit = parseLimit(data.daily_review_limit);

    const existing = await sql()`
      SELECT retention_recognition, retention_recall, retention_production, daily_new_limit, daily_review_limit, level
      FROM user_data.language_profiles WHERE user_id = ${user.id} AND language_code = ${language}`;
    const prev = existing[0] ?? {
      retention_recognition: 0.9,
      retention_recall: 0.9,
      retention_production: 0.9,
      daily_new_limit: null,
      daily_review_limit: null,
      level: null,
    };
    const rr = retentionRecognition ?? prev.retention_recognition ?? 0.9;
    const rrc = retentionRecall ?? prev.retention_recall ?? 0.9;
    const rp = retentionProduction ?? prev.retention_production ?? 0.9;
    const dnl = data.daily_new_limit === undefined ? (prev.daily_new_limit ?? null) : dailyNewLimit;
    const drl = data.daily_review_limit === undefined ? (prev.daily_review_limit ?? null) : dailyReviewLimit;
    const lvl = level === undefined ? (prev.level ?? null) : level;

    const s = sql();
    const rows = await s`
      INSERT INTO user_data.language_profiles
        (user_id, language_code, difficulty_mode, gloss_language, level, active,
         retention_recognition, retention_recall, retention_production, daily_new_limit, daily_review_limit)
      VALUES
        (${user.id}, ${language}, ${difficultyMode}, ${glossLanguage}, ${lvl}, ${active}, ${rr}, ${rrc}, ${rp}, ${dnl}, ${drl})
      ON CONFLICT (user_id, language_code) DO UPDATE SET
        difficulty_mode = EXCLUDED.difficulty_mode,
        gloss_language = EXCLUDED.gloss_language,
        level = EXCLUDED.level,
        active = EXCLUDED.active,
        retention_recognition = EXCLUDED.retention_recognition,
        retention_recall = EXCLUDED.retention_recall,
        retention_production = EXCLUDED.retention_production,
        daily_new_limit = EXCLUDED.daily_new_limit,
        daily_review_limit = EXCLUDED.daily_review_limit,
        updated_at = now()
      RETURNING ${s.unsafe(PROFILE_SELECT)}`;
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
