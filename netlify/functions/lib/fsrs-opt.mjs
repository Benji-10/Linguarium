/**
 * FSRS-5 parameter fitting from a learner's own review history (phase 3).
 *
 * This module is deliberately PURE (no network, no database, deterministic)
 * so it can be unit-tested and reasoned about; the /api/fsrs-optimize
 * function feeds it rows from user_data.review_log.
 *
 * What it does, honestly:
 *   - It re-simulates every (entry, dimension) review sequence with a
 *     candidate weight vector w and scores the outcome prediction with
 *     binary cross entropy: every review with rating > 1 is a recall, every
 *     rating 1 is a lapse; the predicted recall probability is the FSRS
 *     forgetting curve R(t, S) with the stability the candidate parameters
 *     would have produced.
 *   - It optimizes by coordinate-wise hill climbing: for each of the 19
 *     weights it tries /-steps around the current value, keeps any
 *     improvement, shrinks the steps when a full sweep brings none, and
 *     stops after a fixed number of sweeps. No randomness, no hidden
 *     state: the same review log always yields the same weights.
 *   - It never claims more than it is: this is a curve fit to the user's
 *     own history (provenance "automated analysis"), not a guarantee. The
 *     loss before and after, and the review count, are returned and shown
 *     in the UI. The stability-consistency term of the full research
 *     optimizer is NOT used here; only the recall-likelihood term is.
 *
 * Formulas follow the same FSRS-5 specification as src/shared/fsrs.mjs
 * (kept separate because functions do not import browser bundle code).
 */

export const DEFAULT_W = [
  0.40255, 1.18385, 3.173, 15.69105, 7.1949, 0.5345, 1.4604, 0.0046,
  1.54575, 0.1192, 1.01925, 1.9395, 0.11, 0.29605, 2.2698, 0.2315,
  2.9898, 0.51655, 0.6621,
];

const DECAY = -0.5;
const FACTOR = 19 / 81;
const DAY_MS = 24 * 60 * 60 * 1000;
const EPS = 1e-6;

// Bounds and per-weight step sizes (same order as the weight vector).
// Bounds are intentionally generous but finite; the step sizes reflect how
// sensitive the loss is to each weight in practice (initial-stability and
// growth weights move fast, difficulty weights slowly).
const BOUNDS = [
  [0.01, 4], [0.1, 10], [0.5, 15], [1, 25],
  [1, 12], [0.1, 6], [0.1, 6], [0.001, 1.5],
  [0.1, 8], [0.01, 1.5], [0.01, 4],
  [0.1, 12], [0.01, 1.5], [0.01, 2], [0.1, 6],
  [0.1, 8], [0.1, 12],
  [0.1, 2], [0.01, 1.5],
];
const STEPS = [
  0.05, 0.1, 0.2, 0.5,
  0.15, 0.05, 0.05, 0.002,
  0.1, 0.01, 0.05,
  0.1, 0.01, 0.05, 0.05,
  0.1, 0.2,
  0.05, 0.02,
];

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

function retrievability(elapsedDays, stability) {
  const S = Math.max(stability, 0.01);
  const t = Math.max(elapsedDays, 0);
  return clamp(Math.pow(1 + (FACTOR * t) / S, DECAY), 0, 1);
}

function initialDifficulty(w, rating) {
  return clamp(w[4] - Math.exp(w[5]) * (rating - 1) + 1, 1, 10);
}

function nextDifficulty(w, difficulty, rating) {
  const deltaD = -w[6] * (rating - 3);
  const d1 = difficulty + (deltaD * (10 - difficulty)) / 9;
  const d2 = w[7] * initialDifficulty(w, 4) + (1 - w[7]) * d1;
  return clamp(d2, 1, 10);
}

function successStability(w, S, D, R, rating, elapsedDays) {
  if (elapsedDays < 1) {
    return S * Math.exp(w[17] * (rating - 3 + w[18]));
  }
  const hardPenalty = rating === 2 ? w[15] : 1;
  const easyBonus = rating === 4 ? w[16] : 1;
  const inc =
    Math.exp(w[8] * (11 - D) * Math.pow(S, -w[9])) *
    (Math.exp(w[10] * (1 - R)) - 1) *
    hardPenalty *
    easyBonus;
  return S * (1 + inc);
}

function lapseStability(w, S, D, R) {
  return w[11] * Math.pow(D, -w[12]) * (Math.pow(S + 1, w[13]) - 1) * Math.exp(w[14] * (1 - R));
}

/**
 * Build per-(entry, dimension) chronological sequences from review-log rows.
 *
 * Row shape expected: { entry_id, dimension, rating, elapsed_days,
 * reviewed_at (ISO or epoch ms) }, ordered ASC by reviewed_at.
 * Each sequence keeps the elapsed-days gaps between consecutive reviews.
 */
export function buildSequences(rows) {
  const byKey = new Map();
  for (const r of rows ?? []) {
    const rating = Number(r.rating);
    if (!Number.isInteger(rating) || rating < 1 || rating > 4) continue;
    const key = `${r.entry_id}|${r.dimension}`;
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key).push({ rating, elapsedDays: Math.max(0, Number(r.elapsed_days) || 0) });
  }
  return [...byKey.values()].filter((seq) => seq.length >= 2);
}

/** Binary-cross-entropy loss of a weight vector over the sequences. */
export function lossOf(w, sequences) {
  let total = 0;
  let terms = 0;
  for (const seq of sequences) {
    let S = w[seq[0].rating - 1];
    let D = initialDifficulty(w, seq[0].rating);
    for (let i = 1; i < seq.length; i++) {
      const { rating, elapsedDays } = seq[i];
      const R = retrievability(elapsedDays, S);
      // rating 1 = lapse (forgot), anything else = recalled.
      const p = rating === 1 ? 1 - R : R;
      total -= Math.log(Math.max(p, EPS));
      terms += 1;
      // advance the simulated state with the candidate weights
      if (rating === 1) {
        S = Math.max(lapseStability(w, S, D, R), 0.01);
      } else {
        S = Math.max(successStability(w, S, D, R, rating, elapsedDays), 0.01);
      }
      D = nextDifficulty(w, D, rating);
    }
  }
  // mean per-term loss (a NaN-safe guard keeps garbage data harmless)
  if (!Number.isFinite(total) || terms === 0) return Number.POSITIVE_INFINITY;
  return total / terms;
}

/**
 * Coordinate-wise hill climbing over the 19 weights.
 * Deterministic: the same sequences always produce the same result.
 *
 * @returns {{weights: number[], loss_default: number, loss_optimized: number,
 *            sweeps: number, sequences: number, terms: number, improved: boolean}}
 */
export function optimizeWeights(sequences, { maxSweeps = 8 } = {}) {
  const defaultLoss = lossOf(DEFAULT_W, sequences);
  if (!Number.isFinite(defaultLoss)) {
    return {
      weights: [...DEFAULT_W],
      loss_default: null,
      loss_optimized: null,
      sweeps: 0,
      sequences: sequences.length,
      terms: 0,
      improved: false,
    };
  }

  let w = [...DEFAULT_W];
  let loss = defaultLoss;
  let terms = 0;
  for (const seq of sequences) terms += Math.max(0, seq.length - 1);

  let steps = [...STEPS];
  let sweeps = 0;
  for (let sweep = 0; sweep < maxSweeps; sweep++) {
    sweeps += 1;
    let improvedThisSweep = false;
    for (let i = 0; i < w.length; i++) {
      const [lo, hi] = BOUNDS[i];
      let best = w[i];
      let bestLoss = loss;
      for (const candidate of [w[i] + steps[i], w[i] - steps[i], w[i] + steps[i] / 2, w[i] - steps[i] / 2]) {
        const c = clamp(candidate, lo, hi);
        if (c === w[i]) continue;
        const trial = [...w];
        trial[i] = c;
        const l = lossOf(trial, sequences);
        if (l < bestLoss - 1e-9) {
          bestLoss = l;
          best = c;
        }
      }
      if (best !== w[i]) {
        w[i] = best;
        loss = bestLoss;
        improvedThisSweep = true;
      }
    }
    if (!improvedThisSweep) {
      // halve every step size and do one more careful sweep
      steps = steps.map((s) => s / 2);
      if (sweep >= 2) break;
    }
  }

  // Safety: only return weights that are finite, bounded and no worse than
  // the default parameters. Otherwise the caller keeps the defaults.
  const valid =
    Number.isFinite(loss) &&
    w.every((x) => Number.isFinite(x) && x > 0) &&
    w.length === DEFAULT_W.length;
  if (!valid || loss >= defaultLoss) {
    return {
      weights: [...DEFAULT_W],
      loss_default: defaultLoss,
      loss_optimized: defaultLoss,
      sweeps,
      sequences: sequences.length,
      terms,
      improved: false,
    };
  }
  return {
    weights: w.map((x) => Math.round(x * 1e6) / 1e6),
    loss_default: defaultLoss,
    loss_optimized: loss,
    sweeps,
    sequences: sequences.length,
    terms,
    improved: loss < defaultLoss - 1e-9,
  };
}

/** Minimum number of scored review pairs before fitting is meaningful. */
export const MIN_TERMS = 300;
