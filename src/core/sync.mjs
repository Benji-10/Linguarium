/**
 * Offline sync: flush the queue to /api/sync.
 *
 * Everything the user did offline is replayed in order. Review events are
 * idempotent, so a replay is always safe; mutable edits apply only when
 * the client's version is newer, and any skipped change is REPORTED to the
 * user (never a silent overwrite).
 */

import { api } from './api.mjs';
import { getQueue, removeFromQueue, getKV, putKV } from './idb.mjs';
import { setState, getState } from './store.mjs';
import { toast } from '../ui/components.mjs';

export async function flushQueue({ silent = false } = {}) {
  const { syncing, online } = getState();
  if (syncing || !online) return { skipped: true };
  const queue = await getQueue();
  if (queue.length === 0) {
    setState({ queueCount: 0, lastSync: Date.now() });
    await putKV('lastSync', Date.now());
    return { flushed: 0, conflicts: [] };
  }

  setState({ syncing: true });
  try {
    const events = [];
    const entryUpserts = [];
    const deletes = [];
    const grammarStages = [];
    for (const op of queue) {
      if (op.type === 'review') events.push(op.payload);
      else if (op.type === 'entryUpsert') entryUpserts.push(op.payload);
      else if (op.type === 'delete') deletes.push(op.payload);
      else if (op.type === 'grammarStage') grammarStages.push(op.payload);
    }

    const result = await api('/api/sync', { method: 'POST', body: { events, entryUpserts, deletes, grammarStages } });

    // Clear everything that was flushed.
    await removeFromQueue(queue.map((q) => q.id));
    const now = Date.now();
    setState({ queueCount: 0, syncing: false, lastSync: now });
    await putKV('lastSync', now);

    if (!silent && result.conflicts?.length > 0) {
      const parts = result.conflicts
        .map((c) => (c.type === 'entry' ? 'a vocabulary entry' : c.type))
        .join(', ');
      toast(`Synced, but kept newer server versions of ${parts}. Nothing was lost.`, 'warn');
    } else if (!silent && (events.length > 0 || entryUpserts.length > 0 || deletes.length > 0)) {
      toast(`Synced ${events.length} reviews, ${entryUpserts.length} edits, ${deletes.length} deletions.`, 'pos');
    }
    return result;
  } catch (err) {
    setState({ syncing: false });
    if (!silent && err.status !== 0 && err.status !== 401) {
      toast('Sync failed. Your queue is kept and will retry.', 'warn');
    }
    return { error: err };
  }
}

export async function refreshQueueCount() {
  const queue = await getQueue();
  setState({ queueCount: queue.length });
}

export async function lastSyncTime() {
  return (await getKV('lastSync')) ?? null;
}
