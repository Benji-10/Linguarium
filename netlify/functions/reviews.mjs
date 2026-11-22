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

    const newRows =
      newLimit > 0
        ? await s`
          SELECT ${s.unsafe(ENTRY_SELECT)}
          FROM user_data.vocab_entries e
          WHERE e.user_id = ${user.id} AND e.deleted_at IS NULL
            AND NOT EXISTS (SELECT 1 FROM user_data.fsrs_memory m WHERE m.entry_id = e.id AND m.dimension = ${dimension})
            AND (${language === null} OR e.language_code = ${language})
          ORDER BY e.created_at ASC
          LIMIT ${newLimit}`
        : [];

    return json({
      dimension,
      due: dueRows.map((r) => ({ ...entryBase(r), memory: memoryOf(r) })),
      new: newRows.map((r) => ({ ...entryBase(r), memory: null })),
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
