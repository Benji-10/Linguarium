/**
 * FSRS-5 spaced repetition scheduler.
 *
 * Formulas and default parameters follow the community specification:
 *   https://github.com/open-spaced-repetition/awesome-fsrs/wiki/The-Algorithm
 * (FSRS-5 section; recall/lapse stability formulas are the FSRS-4.5 ones
 * with FSRS-5's trained parameters).
 *
 * The scheduler is pure: it never touches the network or storage, so it can
 * run identically in the browser (including fully offline) and in tests.
 * A memory state is a plain JSON object:
 *
 *   { stability, difficulty, reps, lapses, lastReview, due }  // ms epochs
 *
 * One state exists per (entry, ability dimension): recognition, recall,
 * production progress independently.
 */

export const FSRS_VERSION = 'FSRS-5';

/** Default FSRS-5 parameters (19 weights). */
export const DEFAULT_W = [
  0.40255, 1.18385, 3.173, 15.69105, 7.1949, 0.5345, 1.4604, 0.0046,
  1.54575, 0.1192, 1.01925, 1.9395, 0.11, 0.29605, 2.2698, 0.2315,
  2.9898, 0.51655, 0.6621,
];

/** Forgetting curve constants (FSRS-4.5 and later). */
export const DECAY = -0.5;
export const FACTOR = 19 / 81; // 0.9^(-1/DECAY) - 1, so R(S days, S) = 0.9

/** Target retention. The interval is chosen so predicted recall is >= 90%. */
export const DESIRED_RETENTION = 0.9;

export const MAX_INTERVAL_DAYS = 36500;
export const MIN_INTERVAL_DAYS = 1;

/** Re-review delay after a lapse: the card returns within the same session. */
export const AGAIN_RETRY_MS = 10 * 60 * 1000; // 10 minutes

export const DAY_MS = 24 * 60 * 60 * 1000;

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/**
 * Retrievability: predicted probability of recall after t days since the
 * last review, given stability S.
 *   R(t, S) = (1 + FACTOR * t / S) ^ DECAY
 * By construction R(S, S) = 0.9.
 */
export function retrievability(elapsedDays, stability) {
  const S = Math.max(stability, 0.01);
  const t = Math.max(elapsedDays, 0);
  return clamp(Math.pow(1 + (FACTOR * t) / S, DECAY), 0, 1);
}

/** Retrievability for a memory state at a given time. */
export function memoryRetrievability(memory, now = Date.now()) {
  if (!memory || memory.lastReview == null) return null;
  const elapsedDays = (now - memory.lastReview) / DAY_MS;
  return retrievability(elapsedDays, memory.stability);
}

/**
 * Interval that brings predicted recall down to the requested retention.
 *   I(r, S) = (S / FACTOR) * (r^(1/DECAY) - 1)
 * By construction I(0.9, S) = S.
 */
export function intervalForRetention(retention, stability) {
  const S = Math.max(stability, 0.01);
  const r = clamp(retention, 0.01, 0.99);
  return (S / FACTOR) * (Math.pow(r, 1 / DECAY) - 1);
}

/** Scheduled interval (whole days) for the next review of a stability value. */
export function nextIntervalDays(stability) {
  const interval = intervalForRetention(DESIRED_RETENTION, stability);
  return clamp(Math.round(interval), MIN_INTERVAL_DAYS, MAX_INTERVAL_DAYS);
}

/** Initial difficulty after the first rating (FSRS-5). */
export function initialDifficulty(rating) {
  const w = DEFAULT_W;
  return clamp(w[4] - Math.exp(w[5]) * (rating - 1) + 1, 1, 10);
}

/** New memory state after the very first review. */
export function newMemory(rating, now = Date.now()) {
  const S0 = DEFAULT_W[rating - 1];
  let due;
  if (rating === 1) {
    due = now + AGAIN_RETRY_MS; // retry within the session
  } else {
    due = now + nextIntervalDays(S0) * DAY_MS;
  }
  return {
    stability: S0,
    difficulty: initialDifficulty(rating),
    reps: 1,
    lapses: rating === 1 ? 1 : 0,
    lastReview: now,
    due,
  };
}

/**
 * Difficulty update after a later review (FSRS-5):
 *   deltaD  = -w6 * (G - 3)
 *   D'     = D + deltaD * (10 - D) / 9          (linear damping)
 *   D''    = w7 * D0(4) + (1 - w7) * D'        (mean reversion toward D0(4))
 */
export function nextDifficulty(difficulty, rating) {
  const w = DEFAULT_W;
  const deltaD = -w[6] * (rating - 3);
  const d1 = difficulty + (deltaD * (10 - difficulty)) / 9;
  const d2 = w[7] * initialDifficulty(4) + (1 - w[7]) * d1;
  return clamp(d2, 1, 10);
}

/**
 * Stability after a successful (recalled) review (FSRS-4.5 formula,
 * FSRS-5 parameters):
 *   S' = S * ( e^(w8 (11-D) S^-w9) * (e^(w10 (1-R)) - 1) * [w15 if G=2] * [w16 if G=4] + 1 )
 * and after a same-day review (FSRS-5):
 *   S' = S * e^(w17 (G - 3 + w18))
 */
export function successStability(S, D, R, rating, elapsedDays) {
  const w = DEFAULT_W;
  if (elapsedDays < 1) {
    // Same-day review: short-term update.
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

/**
 * Post-lapse stability (FSRS-4.5 formula, FSRS-5 parameters):
 *   S'f = w11 * D^-w12 * ((S + 1)^w13 - 1) * e^(w14 (1 - R))
 */
export function lapseStability(S, D, R) {
  const w = DEFAULT_W;
  return w[11] * Math.pow(D, -w[12]) * (Math.pow(S + 1, w[13]) - 1) * Math.exp(w[14] * (1 - R));
}

/**
 * Apply one review to a memory state.
 *
 * @param {object|null} memory prior state, or null for the first review
 * @param {1|2|3|4} rating
 * @param {number} now review time (ms epoch)
 * @returns {{memory: object, log: object}} new state and a review-log record
 */
export function review(memory, rating, now = Date.now()) {
  if (memory == null) {
    const m = newMemory(rating, now);
    return {
      memory: m,
      log: {
        rating,
        stability: m.stability,
        difficulty: m.difficulty,
        elapsedDays: 0,
        nextDue: m.due,
        reviewedAt: now,
        firstReview: true,
      },
    };
  }

  const elapsedDays = Math.max(0, (now - memory.lastReview) / DAY_MS);
  const R = retrievability(elapsedDays, memory.stability);

  let stability;
  let due;
  if (rating === 1) {
    stability = lapseStability(memory.stability, memory.difficulty, R);
    due = now + AGAIN_RETRY_MS;
  } else {
    stability = successStability(memory.stability, memory.difficulty, R, rating, elapsedDays);
    stability = Math.max(stability, 0.01);
    due = now + nextIntervalDays(stability) * DAY_MS;
  }

  const next = {
    stability,
    difficulty: nextDifficulty(memory.difficulty, rating),
    reps: memory.reps + 1,
    lapses: memory.lapses + (rating === 1 ? 1 : 0),
    lastReview: now,
    due,
  };

  return {
    memory: next,
    log: {
      rating,
      stability,
      difficulty: next.difficulty,
      elapsedDays: Math.round(elapsedDays * 1000) / 1000,
      nextDue: due,
      reviewedAt: now,
      firstReview: false,
    },
  };
}

/** Whether a memory state is due at the given time. */
export function isDue(memory, now = Date.now()) {
  return memory != null && memory.due != null && memory.due <= now;
}

/** Human-readable summary of a state, for tooltips and stats. */
export function memorySummary(memory, now = Date.now()) {
  if (!memory) return { reps: 0, lapses: 0, stability: null, difficulty: null, retrievability: null };
  return {
    reps: memory.reps,
    lapses: memory.lapses,
    stability: memory.stability,
    difficulty: memory.difficulty,
    retrievability: memoryRetrievability(memory, now),
  };
}
