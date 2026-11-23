/**
 * GET  /api/reviews?language=&dimension=&limit= - due queue and never-reviewed entries
 * POST /api/reviews - append review events (idempotent by event UUID)
 *
 * The FSRS scheduler runs in the shared client module; the server records
 * the resulting states and validates that events belong to the verified
 * user. Events are append-only, which makes offline replay safe.
 */

import { handler, json, body, query, HttpError, clampNumber } from './lib/http.mjs';
import { requireUser, ensureUserRow } from './lib/identity.mjs';
import { sql } from './lib/db.mjs';
import { validDimension } from './lib/util.mjs';
import { applyReviewEvent } from './lib/sync-core.mjs';

const ENTRY_SELECT =
  'e.id, e.language_code, e.term, e.normalized, e.reading, e.part_of_speech, e.definition, ' +
  'e.gloss_language, e.example, e.notes, e.collection_id, e.created_at, e.updated_at';

function memoryOf(row) {
  if (!row.dimension) return null;
  return {
    stability: row.stability,
    difficulty: row.difficulty,
    reps: row.reps,
    lapses: row.lapses,
    last_review: row.last_review,
    due: row.due,
  };
}

export default handler({
  GET: async (req) => {
    const user = await requireUser();
    const s = sql();
    const q = query(req);
    const dimension = q.dimension || 'recognition';
    if (!validDimension(dimension)) throw new HttpError(400, 'invalid-param', 'Unknown dimension.');
    const language = q.language ? String(q.language).slice(0, 16) : null;
    const limit = clampNumber(q.limit, 1, 200, 50);
    const newLimit = clampNumber(q.new, 0, 200, 20);

    const dueRows = await s`
      SELECT ${s.unsafe(ENTRY_SELECT)}, m.dimension, m.stability, m.difficulty, m.reps, m.lapses, m.last_review, m.due
      FROM user_data.fsrs_memory m
      JOIN user_data.vocab_entries e ON e.id = m.entry_id AND e.deleted_at IS NULL
      WHERE m.user_id = ${user.id} AND m.dimension = ${dimension} AND m.due <= now()
        AND (${language === null} OR e.language_code = ${language})
      ORDER BY m.due ASC
      LIMIT ${limit}`;

    let newRows = newLimit > 0
      ? await s`
          SELECT ${s.unsafe(ENTRY_SELECT)}
          FROM user_data.vocab_entries e
          WHERE e.user_id = ${user.id} AND e.deleted_at IS NULL
            AND NOT EXISTS (SELECT 1 FROM user_data.fsrs_memory m WHERE m.entry_id = e.id AND m.dimension = ${dimension})
            AND (${language === null} OR e.language_code = ${language})
          ORDER BY e.created_at ASC
          LIMIT ${newLimit}`
      : [];

    // Phase 3: scheduling preferences per language profile, enforced honestly.
    // The daily caps apply to today's totals (any dimension) for this language;
    // the response reports the numbers so the client can explain what happened.
    let scheduling = null;
    if (language) {
      const [profileRows, todayRows, newTodayRows] = await Promise.all([
        s`
          SELECT retention_recognition, retention_recall, retention_production, daily_new_limit, daily_review_limit
          FROM user_data.language_profiles
          WHERE user_id = ${user.id} AND language_code = ${language}`,
        s`
          SELECT count(*)::int AS reviews
          FROM user_data.review_log r
          JOIN user_data.vocab_entries e ON e.id = r.entry_id
          WHERE r.user_id = ${user.id} AND r.reviewed_at >= CURRENT_DATE
            AND (${language === null} OR e.language_code = ${language})`,
        s`
          SELECT count(*)::int AS new_cards
          FROM user_data.vocab_entries e
          WHERE e.user_id = ${user.id} AND e.deleted_at IS NULL AND e.language_code = ${language}
            AND EXISTS (SELECT 1 FROM user_data.review_log r WHERE r.entry_id = e.id AND r.reviewed_at >= CURRENT_DATE)
            AND NOT EXISTS (SELECT 1 FROM user_data.review_log r WHERE r.entry_id = e.id AND r.reviewed_at < CURRENT_DATE)`,
      ]);
      const profile = profileRows[0] ?? null;
      const reviewsToday = todayRows[0]?.reviews ?? 0;
      const newToday = newTodayRows[0]?.new_cards ?? 0;
      const reviewLimit = profile?.daily_review_limit ?? null;
      const newLimitPref = profile?.daily_new_limit ?? null;
      scheduling = {
        retention: {
          recognition: profile?.retention_recognition ?? 0.9,
          recall: profile?.retention_recall ?? 0.9,
          production: profile?.retention_production ?? 0.9,
        },
        daily_review_limit: reviewLimit,
        daily_new_limit: newLimitPref,
        reviews_today: reviewsToday,
        new_today: newToday,
      };

      // Enforce the caps: never hide cards silently - the numbers above let
      // the client say exactly why the session is smaller than the queue.
      if (reviewLimit != null) {
        const remaining = Math.max(0, reviewLimit - reviewsToday);
        if (remaining < dueRows.length) dueRows.length = remaining;
      }
      if (newLimitPref != null) {
        const remaining = Math.max(0, newLimitPref - newToday);
        if (remaining < newRows.length) newRows = newRows.slice(0, remaining);
      }
    }

    return json({
      dimension,
      due: dueRows.map((r) => ({ ...entryBase(r), memory: memoryOf(r) })),
      new: newRows.map((r) => ({ ...entryBase(r), memory: null })),
      scheduling,
    });
  },

  POST: async (req) => {
    const user = await requireUser();
    await ensureUserRow(user);
    const data = await body(req);
    const events = Array.isArray(data.events) ? data.events.slice(0, 500) : [];
    if (events.length === 0) {
      throw new HttpError(400, 'missing-events', 'Body must contain an "events" array.');
    }
    let applied = 0;
    let duplicates = 0;
    for (const event of events) {
      const result = await applyReviewEvent(user.id, event);
      if (result === 'applied') applied += 1;
      else duplicates += 1;
    }
    return json({ applied, duplicates });
  },
});

function entryBase(row) {
  return {
    id: row.id,
    language_code: row.language_code,
    term: row.term,
    normalized: row.normalized,
    reading: row.reading,
    part_of_speech: row.part_of_speech,
    definition: row.definition,
    gloss_language: row.gloss_language,
    example: row.example,
    notes: row.notes,
    collection_id: row.collection_id,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export const config = { path: '/api/reviews' };
