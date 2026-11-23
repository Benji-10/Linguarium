/**
 * Phase 3 tests: the FSRS-5 parameter fitter (netlify/functions/lib/fsrs-opt.mjs).
 *
 * The fitter is a deterministic hill climber over the recall-likelihood loss.
 * These tests pin down:
 *   - sequence building from review-log-shaped rows,
 *   - the loss being finite and worse for wrong parameters,
 *   - the optimizer improving the fit on data generated with known
 *     non-default parameters, and never returning something worse than the
 *     defaults,
 *   - honest refusal (improved=false) when the defaults already fit.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_W, buildSequences, lossOf, optimizeWeights, MIN_TERMS } from '../netlify/functions/lib/fsrs-opt.mjs';

/** Deterministic pseudo-random generator (mulberry32) so tests are stable. */
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Generate review-log-shaped rows by SIMULATING with the given weights. */
function syntheticHistory(weights, { entries = 40, reviewsPer = 12, seed = 7 } = {}) {
  const rand = rng(seed);
  const rows = [];
  // local FSRS-5 simulation with the given weights (mirrors fsrs-opt formulas)
  const R = (t, S) => Math.min(1, Math.max(0, Math.pow(1 + (19 / 81) * (t / Math.max(S, 0.01)), -0.5)));
  for (let e = 0; e < entries; e++) {
    const dimension = ['recognition', 'recall', 'production'][e % 3];
    let S = 0;
    let D = 5;
    let t = 0;
    for (let i = 0; i < reviewsPer; i++) {
      const elapsed = i === 0 ? 0 : Math.max(1, Math.round(S * (0.8 + 0.4 * rand())));
      t += elapsed;
      const r = R(elapsed, S);
      // the learner answers honestly according to predicted recall
      const u = rand();
      const rating = u < r ? (u < r * 0.8 ? 3 : 4) : 1;
      rows.push({ entry_id: `e${e}`, dimension, rating, elapsed_days: elapsed, reviewed_at: t });
      // advance the state with the generator weights
      if (i === 0) {
        S = weights[rating - 1];
        D = Math.min(10, Math.max(1, weights[4] - Math.exp(weights[5]) * (rating - 1) + 1));
      } else if (rating === 1) {
        S = weights[11] * Math.pow(D, -weights[12]) * (Math.pow(S + 1, weights[13]) - 1) * Math.exp(weights[14] * (1 - r));
      } else {
        const inc =
          Math.exp(weights[8] * (11 - D) * Math.pow(S, -weights[9])) *
          (Math.exp(weights[10] * (1 - r)) - 1) *
          (rating === 2 ? weights[15] : 1) *
          (rating === 4 ? weights[16] : 1);
        S = S * (1 + inc);
      }
      S = Math.max(0.01, S);
    }
  }
  return rows;
}

test('buildSequences groups rows per (entry, dimension) in order', () => {
  const rows = [
    { entry_id: 'a', dimension: 'recognition', rating: 3, elapsed_days: 0, reviewed_at: 1 },
    { entry_id: 'b', dimension: 'recognition', rating: 4, elapsed_days: 0, reviewed_at: 2 },
    { entry_id: 'a', dimension: 'recognition', rating: 1, elapsed_days: 5, reviewed_at: 6 },
    { entry_id: 'a', dimension: 'recall', rating: 3, elapsed_days: 0, reviewed_at: 8 },
    { entry_id: 'a', dimension: 'recall', rating: 4, elapsed_days: 2, reviewed_at: 10 },
  ];
  const seqs = buildSequences(rows);
  // 'b|recognition' has a single review: dropped (nothing to fit).
  assert.equal(seqs.length, 2);
  assert.deepEqual(seqs[0], [
    { rating: 3, elapsedDays: 0 },
    { rating: 1, elapsedDays: 5 },
  ]);
  assert.deepEqual(seqs[1], [
    { rating: 3, elapsedDays: 0 },
    { rating: 4, elapsedDays: 2 },
  ]);
});

test('single-review entries are dropped (nothing to fit from one point)', () => {
  const seqs = buildSequences([{ entry_id: 'solo', dimension: 'recognition', rating: 3, elapsed_days: 0, reviewed_at: 1 }]);
  assert.equal(seqs.length, 0);
});

test('garbage ratings are skipped without crashing', () => {
  const seqs = buildSequences([
    { entry_id: 'g', dimension: 'recognition', rating: 9, elapsed_days: 0, reviewed_at: 1 },
    { entry_id: 'g', dimension: 'recognition', rating: 'x', elapsed_days: 3, reviewed_at: 4 },
  ]);
  assert.equal(seqs.length, 0);
});

test('lossOf is finite for sensible data and lower loss means better fit', () => {
  const rows = syntheticHistory(DEFAULT_W, { entries: 30, reviewsPer: 10 });
  const seqs = buildSequences(rows);
  const lossDefault = lossOf(DEFAULT_W, seqs);
  assert.ok(Number.isFinite(lossDefault));
  const badW = DEFAULT_W.map((x, i) => (i < 4 ? x * 4 : x));
  const lossBad = lossOf(badW, seqs);
  assert.ok(lossBad > lossDefault, `bad weights should score worse (${lossBad} vs ${lossDefault})`);
});

test('the optimizer improves the fit on data generated with other weights', () => {
  // Data generated with clearly different initial-stability weights.
  const truth = DEFAULT_W.slice();
  truth[0] = 0.9;
  truth[1] = 2.0;
  truth[2] = 4.6;
  truth[3] = 20.0;
  const rows = syntheticHistory(truth, { entries: 60, reviewsPer: 12, seed: 11 });
  const seqs = buildSequences(rows);
  const result = optimizeWeights(seqs, { maxSweeps: 6 });
  assert.equal(result.improved, true);
  assert.ok(result.loss_optimized < result.loss_default, 'fitted loss must beat the default loss');
  assert.ok(result.weights.every((x) => Number.isFinite(x) && x > 0));
  assert.equal(result.weights.length, 19);
  // The fit should move the best-constrained initial-stability weights
  // (rating 3 and 4 first reviews dominate this dataset) toward the truth.
  assert.ok(Math.abs(result.weights[2] - truth[2]) < Math.abs(DEFAULT_W[2] - truth[2]), 'w[2] moved toward the truth');
  assert.ok(Math.abs(result.weights[3] - truth[3]) < Math.abs(DEFAULT_W[3] - truth[3]), 'w[3] moved toward the truth');
});

test('the optimizer never returns a weight vector that scores worse than defaults', () => {
  const rows = syntheticHistory(DEFAULT_W, { entries: 50, reviewsPer: 10, seed: 3 });
  const seqs = buildSequences(rows);
  const result = optimizeWeights(seqs);
  if (!result.improved) {
    // honest refusal path
    assert.deepEqual(result.weights, DEFAULT_W);
    assert.equal(result.loss_optimized, result.loss_default);
  } else {
    assert.ok(result.loss_optimized <= result.loss_default);
  }
});

test('MIN_TERMS is a meaningful bar (>= 300)', () => {
  assert.ok(MIN_TERMS >= 300);
});
