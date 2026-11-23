/**
 * GET    /api/fsrs-optimize - the user's current fitted FSRS-5 weights (or null)
 * POST   /api/fsrs-optimize - fit the 19 FSRS-5 parameters to the user's own
 *                             review history (append-only review_log)
 * DELETE /api/fsrs-optimize - drop the fitted weights (back to defaults)
 *
 * The fitting itself runs in lib/fsrs-opt.mjs (pure, deterministic, tested).
 * It is honest about what it is: an automated curve fit to the user's own
 * history, with the loss before/after and the review count stored and shown.
 * Nothing is silently replaced: the client applies the fitted weights only
 * after the user chooses to, and can revert at any time.
 *
 * Requires a meaningful history before it will run (MIN_TERMS scored pairs);
 * otherwise the endpoint refuses with a clear message instead of returning
 * an overfitted vector.
 */

import { handler, json, HttpError } from './lib/http.mjs';
import { requireUser, ensureUserRow } from './lib/identity.mjs';
import { sql } from './lib/db.mjs';
import { buildSequences, optimizeWeights, MIN_TERMS } from './lib/fsrs-opt.mjs';

const MAX_ROWS = 5000;

export default handler({
  GET: async (req) => {
    const user = await requireUser();
    const rows = await sql()`
      SELECT weights, trained_at, review_count, loss_default, loss_optimized
      FROM user_data.fsrs_weights WHERE user_id = ${user.id}`;
    if (rows.length === 0) {
      return json({ weights: null, trained_at: null, review_count: 0, loss_default: null, loss_optimized: null, provenance: 'automated' });
    }
    const r = rows[0];
    return json({
      weights: typeof r.weights === 'string' ? JSON.parse(r.weights) : r.weights,
      trained_at: r.trained_at,
      review_count: r.review_count,
      loss_default: r.loss_default,
      loss_optimized: r.loss_optimized,
      provenance: 'automated',
    });
  },

  POST: async (req) => {
    const user = await requireUser();
    await ensureUserRow(user);

    // The whole usable history, oldest first, capped to keep the fit fast.
    const rows = await sql()`
      SELECT entry_id, dimension, rating, elapsed_days, reviewed_at
      FROM user_data.review_log
      WHERE user_id = ${user.id}
      ORDER BY reviewed_at ASC
      LIMIT ${MAX_ROWS}`;
    if (rows.length < 10) {
      throw new HttpError(
        400,
        'not-enough-history',
        'Not enough review history yet: review more first, then optimize.',
      );
    }

    const sequences = buildSequences(rows);
    let terms = 0;
    for (const seq of sequences) terms += Math.max(0, seq.length - 1);
    if (terms < MIN_TERMS) {
      throw new HttpError(
        400,
        'not-enough-history',
        `Your review history has ${terms} scored intervals; at least ${MIN_TERMS} are needed for a fit that means anything. Keep reviewing.`,
      );
    }

    const result = optimizeWeights(sequences);

    if (!result.improved) {
      // Honest refusal: the defaults already fit at least as well.
      return json({
        fitted: false,
        reason: 'The default FSRS-5 parameters already fit your history at least as well as any candidate the optimizer tried. Your fitted weights (if any) were left unchanged.',
        review_count: terms,
        loss_default: result.loss_default,
        loss_optimized: result.loss_optimized,
      });
    }

    await sql()`
      INSERT INTO user_data.fsrs_weights (user_id, weights, trained_at, review_count, loss_default, loss_optimized)
      VALUES (${user.id}, ${JSON.stringify(result.weights)}::jsonb, now(), ${terms}, ${result.loss_default}, ${result.loss_optimized})
      ON CONFLICT (user_id) DO UPDATE SET
        weights = EXCLUDED.weights,
        trained_at = now(),
        review_count = EXCLUDED.review_count,
        loss_default = EXCLUDED.loss_default,
        loss_optimized = EXCLUDED.loss_optimized`;

    return json({
      fitted: true,
      weights: result.weights,
      trained_at: new Date().toISOString(),
      review_count: terms,
      sequences: result.sequences,
      sweeps: result.sweeps,
      loss_default: result.loss_default,
      loss_optimized: result.loss_optimized,
      provenance: 'automated',
    });
  },

  DELETE: async (req) => {
    const user = await requireUser();
    await sql()`DELETE FROM user_data.fsrs_weights WHERE user_id = ${user.id}`;
    return json({ reset: true });
  },
});

export const config = { path: '/api/fsrs-optimize' };
