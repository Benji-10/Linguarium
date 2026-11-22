/**
 * Shared logic for applying review events (used by /api/reviews and /api/sync).
 *
 * Review events are append-only and idempotent: each carries a
 * client-generated UUID. Re-applying the same event is a no-op, which is
 * what makes offline sync safe for learning progress.
 */

import { sql } from './db.mjs';
import { HttpError } from './http.mjs';
import { validDimension, validRating, parseTimestamp } from './util.mjs';

/**
 * Validate one event and apply it:
 *   - append to review_log (ON CONFLICT DO NOTHING)
 *   - if newly inserted, upsert the fsrs_memory state for (entry, dimension)
 *
 * Entries must belong to the authenticated user.
 */
export async function applyReviewEvent(userId, event) {
  if (event == null || typeof event !== 'object') {
    throw new HttpError(400, 'invalid-event', 'Review events must be objects.');
  }
  const { id, entry_id: entryId, dimension, rating } = event;
  const memory = event.memory ?? {};
  if (typeof id !== 'string' || !/^[0-9a-f-]{16,64}$/i.test(id)) {
    throw new HttpError(400, 'invalid-event', 'Event "id" must be a UUID string.');
  }
  if (typeof entryId !== 'string') {
    throw new HttpError(400, 'invalid-event', 'Event "entry_id" must be a string.');
  }
  if (!validDimension(dimension)) {
    throw new HttpError(400, 'invalid-event', 'Unknown ability dimension.');
  }
  if (!validRating(rating)) {
    throw new HttpError(400, 'invalid-event', 'Rating must be 1-4 (again/hard/good/easy).');
  }
  const stability = Number(memory.stability);
  const difficulty = Number(memory.difficulty);
  if (!Number.isFinite(stability) || stability <= 0 || stability > 100000) {
    throw new HttpError(400, 'invalid-event', 'Memory "stability" out of range.');
  }
  if (!Number.isFinite(difficulty) || difficulty < 1 || difficulty > 10) {
    throw new HttpError(400, 'invalid-event', 'Memory "difficulty" out of range (1-10).');
  }
  const reps = Number.isFinite(Number(memory.reps)) ? Math.max(0, Math.min(100000, Math.round(Number(memory.reps)))) : 1;
  const lapses = Number.isFinite(Number(memory.lapses)) ? Math.max(0, Math.min(100000, Math.round(Number(memory.lapses)))) : 0;
  const reviewedAt = parseTimestamp(event.reviewed_at, 'reviewed_at');
  const due = parseTimestamp(memory.due, 'memory.due');

  // Ownership: the entry must belong to the authenticated user. The client's
  // asserted user id (if any) is deliberately ignored.
  const owner = await sql()`
    SELECT id FROM user_data.vocab_entries
    WHERE id = ${entryId} AND user_id = ${userId}`;
  if (owner.length === 0) {
    throw new HttpError(404, 'entry-not-found', 'Review event references an entry that does not exist for this user.');
  }

  const inserted = await sql()`
    INSERT INTO user_data.review_log
      (id, user_id, entry_id, dimension, rating, stability, difficulty, elapsed_days, next_due, reviewed_at)
    VALUES
      (${id}, ${userId}, ${entryId}, ${dimension}, ${rating}, ${stability}, ${difficulty},
       ${Number.isFinite(Number(event.elapsed_days)) ? Number(event.elapsed_days) : null},
       ${due.toISOString()}, ${reviewedAt.toISOString()})
    ON CONFLICT (id) DO NOTHING
    RETURNING id`;

  if (inserted.length === 0) {
    return 'duplicate'; // already synced - safe replay
  }

  await sql()`
    INSERT INTO user_data.fsrs_memory
      (user_id, entry_id, dimension, stability, difficulty, reps, lapses, last_review, due)
    VALUES
      (${userId}, ${entryId}, ${dimension}, ${stability}, ${difficulty}, ${reps}, ${lapses},
       ${reviewedAt.toISOString()}, ${due.toISOString()})
    ON CONFLICT (entry_id, dimension) DO UPDATE SET
      stability = EXCLUDED.stability,
      difficulty = EXCLUDED.difficulty,
      reps = EXCLUDED.reps,
      lapses = EXCLUDED.lapses,
      last_review = EXCLUDED.last_review,
      due = EXCLUDED.due`;

  return 'applied';
}
