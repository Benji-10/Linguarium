/**
 * Phase 3 personalization tests: configurable FSRS weights and per-dimension
 * target retention.
 *
 * These run against the client scheduler (src/shared/fsrs.mjs) and the server
 * fitting module (netlify/functions/lib/fsrs-opt.mjs is covered separately
 * in fsrs-opt.test.mjs).
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_W,
  DESIRED_RETENTION,
  configureWeights,
  resetWeights,
  activeWeights,
  usingCustomWeights,
  retentionFor,
  nextIntervalDays,
  review,
} from '../src/shared/fsrs.mjs';

const DAY = 24 * 60 * 60 * 1000;

test('configureWeights accepts a valid 19-vector and swaps it in', () => {
  const w = DEFAULT_W.map((x) => x * 1.5);
  configureWeights(w);
  assert.equal(usingCustomWeights(), true);
  assert.deepEqual(activeWeights(), w);
  resetWeights();
});

test('configureWeights rejects malformed vectors: defaults stay in effect', () => {
  resetWeights();
  configureWeights(null);
  configureWeights('nope');
  configureWeights([1, 2, 3]);
  configureWeights([...DEFAULT_W.slice(0, 18), -1]); // negative weight: rejected
  configureWeights([...DEFAULT_W.slice(0, 18), NaN]); // NaN: rejected
  configureWeights([...DEFAULT_W.slice(0, 18), 'x']); // non-number: rejected
  assert.equal(usingCustomWeights(), false);
  assert.deepEqual(activeWeights(), DEFAULT_W);
  resetWeights();
});

test('with custom weights the stability formulas actually use them', () => {
  // S0 = w[rating-1] for a first review: doubling all weights doubles S0.
  resetWeights();
  const now = 1234567890;
  const a = review(null, 3, now).memory.stability;
  configureWeights(DEFAULT_W.map((x) => x * 2));
  const b = review(null, 3, now).memory.stability;
  assert.ok(Math.abs(b / a - 2) < 1e-9, `S0 scaling (got ${b / a})`);
  resetWeights();
});

test('higher target retention schedules a shorter interval', () => {
  const S = 10;
  assert.ok(nextIntervalDays(S, 0.95) < nextIntervalDays(S, 0.9));
  assert.ok(nextIntervalDays(S, 0.9) < nextIntervalDays(S, 0.8));
  // The calibration identity still holds at the default retention.
  assert.ok(Math.abs(nextIntervalDays(S, DESIRED_RETENTION) - S) <= 1);
});

test('review() applies the per-dimension retention to the due date', () => {
  resetWeights();
  const now = 1700000000000;
  const memory = { stability: 5, difficulty: 5, reps: 2, lapses: 0, lastReview: now, due: now + 5 * DAY };
  const soon = review(memory, 3, now + 10 * DAY, { retention: 0.95 });
  const later = review(memory, 3, now + 10 * DAY, { retention: 0.8 });
  assert.ok(soon.memory.due < later.memory.due, 'higher retention -> earlier due');
  // Clamped when out of range: 0.99 behaves like 0.97.
  const clampedHigh = review(memory, 3, now + 10 * DAY, { retention: 0.99 });
  const cap = review(memory, 3, now + 10 * DAY, { retention: 0.97 });
  assert.equal(clampedHigh.memory.due, cap.memory.due);
});

test('retentionFor reads the profile fields with clamping and fallback', () => {
  const profile = { retention_recognition: 0.95, retention_recall: null, retention_production: 'x' };
  assert.equal(retentionFor(profile, 'recognition'), 0.95);
  assert.equal(retentionFor(profile, 'recall'), 0.9);
  assert.equal(retentionFor(profile, 'production'), 0.9);
  assert.equal(retentionFor(null, 'recognition'), 0.9);
  assert.equal(retentionFor({ retention_recognition: 1.2 }, 'recognition'), 0.97);
  assert.equal(retentionFor({ retention_recognition: 0.5 }, 'recognition'), 0.7);
});

test('a lapse is unaffected by retention (immediate retry), as before', () => {
  const now = 1700000000000;
  const memory = { stability: 5, difficulty: 5, reps: 2, lapses: 0, lastReview: now, due: now + 5 * DAY };
  const a = review(memory, 1, now + 10 * DAY, { retention: 0.95 });
  const b = review(memory, 1, now + 10 * DAY, { retention: 0.8 });
  assert.equal(a.memory.due, b.memory.due);
});
