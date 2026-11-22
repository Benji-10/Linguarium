/**
 * Offline sync merge rule tests (pure part).
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { eventsToSend, upsertOutcome } from '../src/shared/merge.mjs';

test('events already known to the server are filtered out (idempotent replay)', () => {
  const local = [
    { id: 'a' },
    { id: 'b' },
    { id: 'c' },
  ];
  const toSend = eventsToSend(local, ['a', 'b']);
  assert.deepEqual(
    toSend.map((e) => e.id),
    ['c'],
  );
});

test('events without ids are dropped defensively', () => {
  const toSend = eventsToSend([{ id: 'a' }, { rating: 3 }, null], []);
  assert.equal(toSend.length, 1);
});

test('client-newer upserts apply; server-newer report a conflict', () => {
  assert.equal(upsertOutcome('2026-01-02T00:00:00Z', '2026-01-01T00:00:00Z').action, 'apply');
  assert.equal(upsertOutcome('2026-01-02T00:00:00Z', '2026-01-03T00:00:00Z').action, 'keep-server');
  assert.equal(upsertOutcome('2026-01-02T00:00:00Z', '2026-01-02T00:00:00Z').action, 'keep-server');
  // An unusable client timestamp is treated as epoch: the server wins and
  // the conflict is reported (never a silent overwrite).
  assert.equal(upsertOutcome('garbage', '2026-01-01T00:00:00Z').action, 'keep-server');
});

test('missing server version means first sync: apply', () => {
  assert.equal(upsertOutcome('2026-01-02T00:00:00Z', null).action, 'apply');
});
