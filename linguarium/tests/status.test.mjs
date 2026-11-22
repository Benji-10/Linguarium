/**
 * Status model tests: mastery reflects demonstrated performance.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { deriveStatus, dimensionProgress } from '../src/shared/status.mjs';

const DAY = 24 * 60 * 60 * 1000;

function mem(stability, reps = 4, lapses = 0, dueDays = 30) {
  return {
    stability,
    difficulty: 5,
    reps,
    lapses,
    lastReview: Date.now() - 1 * DAY,
    due: Date.now() + dueDays * DAY,
  };
}

test('no reviews and no encounters: unencountered', () => {
  const r = deriveStatus({}, {}, {});
  assert.equal(r.status, 'unencountered');
});

test('encountered in reading but never reviewed: learning', () => {
  const r = deriveStatus({}, {}, { encountered: true });
  assert.equal(r.status, 'learning');
});

test('first review, low stability: learning', () => {
  const r = deriveStatus({}, { recognition: mem(2) }, {});
  assert.equal(r.tier, 'learning');
});

test('recognition stability above threshold: recognized', () => {
  const r = deriveStatus({}, { recognition: mem(8) }, {});
  assert.equal(r.tier, 'recognized');
});

test('recall stability above threshold: reliably recalled', () => {
  const r = deriveStatus({}, { recognition: mem(8), recall: mem(8) }, {});
  assert.equal(r.tier, 'reliably_recalled');
});

test('production mastery requires stability AND repetitions', () => {
  const r = deriveStatus({}, { recognition: mem(8), production: mem(16, 3) }, {});
  assert.equal(r.tier, 'mastered');
  // Without enough repetitions the card falls back to the tier earned by
  // the dimensions that WERE demonstrated (here: recognized).
  const tooFewReps = deriveStatus({}, { recognition: mem(8), production: mem(16, 1) }, {});
  assert.equal(tooFewReps.tier, 'recognized');
});

test('passive mastery: both recognition and recall long stable', () => {
  const r = deriveStatus({}, { recognition: mem(31), recall: mem(31) }, {});
  assert.equal(r.tier, 'mastered');
});

test('due overlays the tier but keeps it in tier', () => {
  const r = deriveStatus({}, { recognition: mem(8, 4, 0, -1) }, {});
  assert.equal(r.status, 'due');
  assert.equal(r.tier, 'recognized');
});

test('dimensionProgress exposes thresholds per dimension', () => {
  const p = dimensionProgress(mem(16, 4));
  assert.equal(p.started, true);
  assert.equal(p.mastered, true);
  assert.equal(p.recognized, true);
  const none = dimensionProgress(null);
  assert.equal(none.started, false);
});
