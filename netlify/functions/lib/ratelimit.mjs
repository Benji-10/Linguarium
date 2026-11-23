/**
 * Simple per-user daily quota stored in the database, so limits survive
 * across function invocations (serverless instances are not shared state).
 */

import { sql } from './db.mjs';

/**
 * Increment today's counter for (user, action) and return the new count.
 */
export async function consumeDailyQuota(userId, action) {
  const rows = await sql()`
    INSERT INTO user_data.rate_limits (user_id, window_day, action, count)
    VALUES (${userId}, CURRENT_DATE, ${action}, 1)
    ON CONFLICT (user_id, window_day, action)
      DO UPDATE SET count = user_data.rate_limits.count + 1
    RETURNING count`;
  return rows[0]?.count ?? 1;
}

/** Today's count without incrementing. */
export async function readDailyQuota(userId, action) {
  const rows = await sql()`
    SELECT count FROM user_data.rate_limits
    WHERE user_id = ${userId} AND window_day = CURRENT_DATE AND action = ${action}`;
  return rows[0]?.count ?? 0;
}
