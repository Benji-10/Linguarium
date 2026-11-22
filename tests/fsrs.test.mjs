/**
 * FSRS-5 scheduler tests.
 *
 * These test mathematical identities that follow directly from the
 * published formulas (see src/shared/fsrs.mjs for the citation), plus
 * behavioral properties that must hold for any sane scheduler.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_W,
  DESIRED_RETENTION,
  FACTOR,
  DECAY,
  intervalForRetention,
  retrievability,
  initialDifficulty,
  newMemory,
  nextDifficulty,
  successStability,
  lapseStability,
  review,
  isDue,
  memoryRetrievability,
} from '../src/shared/fsrs.mjs';

const DAY = 24 * 60 * 60 * 1000;

test('default parameter vector has 19 weights (FSRS-5)', () => {
  assert.equal(DEFAULT_W.length, 19);
});

test('calibration identity: R(S days elapsed, S) = 0.9', () => {
  for (const S of [0.5, 1, 3.173, 15.69, 100, 1000]) {
    assert.ok(Math.abs(retrievability(S, S) - 0.9) < 1e-9, `R(S,S) for S=${S}`);
  }
});

test('calibration identity: I(0.9, S) = S', () => {
  for (const S of [1, 3.173, 15.69, 100]) {
    assert.ok(Math.abs(intervalForRetention(0.9, S) - S) < 1e-9, `I(0.9,S) for S=${S}`);
  }
});

test('higher retention requests produce shorter intervals', () => {
  const S = 10;
  assert.ok(intervalForRetention(0.95, S) < intervalForRetention(0.9, S));
  assert.ok(intervalForRetention(0.9, S) < intervalForRetention(0.8, S));
});

test('retrievability decays with time and saturates', () => {
  const S = 10;
  assert.ok(retrievability(0, S) === 1);
  assert.ok(retrievability(5, S) > retrievability(10, S));
  // FSRS power curves flatten: at t=100 (10x S) recall is still ~55%.
  assert.ok(retrievability(100, S) < 1 && retrievability(100, S) > 0.5);
  assert.ok(retrievability(100000, S) < 0.05);
  assert.ok(retrievability(1000000, S) >= 0);
});

test('initial difficulty is ordered by first rating and clamped', () => {
  assert.ok(initialDifficulty(1) > initialDifficulty(2));
  assert.ok(initialDifficulty(2) > initialDifficulty(3));
  assert.ok(initialDifficulty(3) > initialDifficulty(4));
  for (const g of [1, 2, 3, 4]) {
    assert.ok(initialDifficulty(g) >= 1 && initialDifficulty(g) <= 10);
  }
});

test('initial stability comes from the first four weights', () => {
  const m = newMemory(1);
  assert.equal(m.stability, DEFAULT_W[0]);
  const m4 = newMemory(4);
  assert.equal(m4.stability, DEFAULT_W[3]);
});

test('first review "again" schedules a same-session retry', () => {
  const now = Date.now();
  const m = newMemory(1, now);
  assert.equal(m.due, now + 10 * 60 * 1000);
  assert.equal(m.lapses, 1);
});

test('first review "good" schedules roughly S0 days out (target retention 90%)', () => {
  const now = Date.now();
  const m = newMemory(3, now);
  const days = (m.due - now) / DAY;
  assert.ok(Math.abs(days - DEFAULT_W[2]) <= 1, `interval days=${days} vs S0=${DEFAULT_W[2]}`);
});

test('successful reviews grow stability (spacing effect preserved)', () => {
  let m = newMemory(3);
  for (let i = 0; i < 10; i++) {
    const elapsed = 1; // days
    const R = retrievability(elapsed, m.stability);
    const s2 = successStability(m.stability, m.difficulty, R, 3, elapsed);
    assert.ok(s2 > m.stability, `stability must grow on good, iteration ${i}`);
    m = { ...m, stability: s2 };
  }
});

test('lapse stability drops well below prior stability for established memories', () => {
  // For a barely-seen card, FSRS-5 can allow a small post-lapse gain;
  // that is published behaviour, not a bug. Established memories must drop.
  const D = 5;
  for (const S of [2, 5, 10, 50, 500]) {
    const R = retrievability(10, S);
    const sf = lapseStability(S, D, R);
    assert.ok(sf < S, `post-lapse stability must be below S for S=${S}`);
  }
});

test('difficulty stays within [1,10] across many reviews', () => {
  let D = initialDifficulty(3);
  const ratings = [1, 1, 4, 2, 3, 1, 4, 4, 1, 2, 3, 3, 4, 1, 2, 3, 4, 2, 2, 3];
  for (const g of ratings) {
    D = nextDifficulty(D, g);
    assert.ok(D >= 1 && D <= 10);
  }
});

test('same-day success formula grows stability slightly, again shrinks it', () => {
  const S = 10;
  const D = 5;
  const g = successStability(S, D, 1, 3, 0.5);
  const a = successStability(S, D, 1, 1, 0.5);
  assert.ok(g > S);
  assert.ok(a < S);
});

test('review() full cycle: again then good then overdue good', () => {
  let state = null;
  const now = Date.now();

  const r1 = review(state, 1, now);
  state = r1.memory;
  assert.equal(state.reps, 1);
  assert.equal(state.lapses, 1);

  const r2 = review(state, 3, now + 10 * 60 * 1000); // retry after 10 min
  state = r2.memory;
  assert.equal(state.reps, 2);
  assert.equal(state.lapses, 1);

  const r3 = review(state, 3, now + 3 * DAY); // three days later
  state = r3.memory;
  assert.equal(state.reps, 3);
  assert.ok(state.stability > 0);
  assert.ok(state.due > now + 3 * DAY);

  // overdue review: elapsed much larger than stability
  const r4 = review(state, 3, now + 3 * DAY + state.stability * 2 * DAY);
  state = r4.memory;
  assert.ok(state.stability > 0);
});

test('review log records carry the state for idempotent sync', () => {
  const now = Date.now();
  const r = review(null, 3, now);
  assert.equal(r.log.rating, 3);
  assert.equal(r.log.firstReview, true);
  assert.equal(r.log.stability, r.memory.stability);
  assert.equal(Math.round(r.log.reviewedAt), Math.round(now));
});

test('isDue and memoryRetrievability behave sanely', () => {
  const now = Date.now();
  const m = { stability: 5, lastReview: now - 10 * DAY, due: now - 1 * DAY, reps: 2 };
  assert.equal(isDue(m, now), true);
  const m2 = { ...m, due: now + 5 * DAY };
  assert.equal(isDue(m2, now), false);
  const r = memoryRetrievability(m, now);
  assert.ok(r !== null && r > 0 && r < 1);
});

test('deterministic: same inputs give the same outputs', () => {
  const t = 1700000000000;
  const a = review(newMemory(3, t), 2, t + 5 * DAY);
  const b = review(newMemory(3, t), 2, t + 5 * DAY);
  assert.deepEqual(a.memory, b.memory);
});
