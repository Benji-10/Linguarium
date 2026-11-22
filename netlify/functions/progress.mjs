/**
 * GET /api/progress - dashboard aggregates.
 *
 * Returns raw aggregates; the client combines them with its locally cached
 * entries and FSRS states to derive status distributions (the thresholds
 * live in the shared constants module the client already uses).
 */

import { handler, json } from './lib/http.mjs';
import { requireUser } from './lib/identity.mjs';
import { sql } from './lib/db.mjs';

export default handler({
  GET: async (req) => {
    const user = await requireUser();

    const [dueRows, newRows, entriesRows, reviewDays, collectionCount, textCount, encounterCount] =
      await Promise.all([
        sql()`
          SELECT e.language_code AS language, m.dimension, count(*)::int AS count
          FROM user_data.fsrs_memory m
          JOIN user_data.vocab_entries e ON e.id = m.entry_id AND e.deleted_at IS NULL
          WHERE m.user_id = ${user.id} AND m.due <= now()
          GROUP BY 1, 2`,
        sql()`
          SELECT e.language_code AS language, count(*)::int AS count
          FROM user_data.vocab_entries e
          WHERE e.user_id = ${user.id} AND e.deleted_at IS NULL
            AND NOT EXISTS (SELECT 1 FROM user_data.fsrs_memory m WHERE m.entry_id = e.id)
          GROUP BY 1`,
        sql()`
          SELECT language_code AS language, count(*)::int AS count
          FROM user_data.vocab_entries
          WHERE user_id = ${user.id} AND deleted_at IS NULL
          GROUP BY 1`,
        sql()`
          SELECT reviewed_at::date AS day, count(*)::int AS count
          FROM user_data.review_log
          WHERE user_id = ${user.id}
          GROUP BY 1
          ORDER BY 1 DESC
          LIMIT 366`,
        sql()`SELECT count(*)::int AS count FROM user_data.collections WHERE user_id = ${user.id}`,
        sql()`SELECT count(*)::int AS count FROM user_data.texts WHERE user_id = ${user.id} AND deleted_at IS NULL`,
        sql()`SELECT count(*)::int AS count FROM user_data.encounters WHERE user_id = ${user.id}`,
      ]);

    return json({
      due: dueRows,
      newEntries: newRows,
      entries: entriesRows,
      reviewDays,
      collections: collectionCount[0]?.count ?? 0,
      texts: textCount[0]?.count ?? 0,
      encounters: encounterCount[0]?.count ?? 0,
    });
  },
});

export const config = { path: '/api/progress' };
