/**
 * Offline sync merge rules (pure part).
 *
 * The rules, enforced server-side in netlify/functions/lib/sync-core.mjs and
 * mirrored here for the client UI:
 *
 *  1. Review events are append-only and carry a client-generated UUID.
 *     Replaying an event is a no-op, so offline reviews can never
 *     duplicate or overwrite learning progress.
 *  2. Mutable rows (entries, notes, profiles) apply only when the client's
 *     version is strictly newer than the server's (updated_at guard).
 *     Otherwise the server version wins and a conflict is REPORTED -
 *     learning progress is never silently overwritten.
 *  3. Deletions are tombstones, so a delayed sync can never resurrect data.
 */

/** Filter events the server has not seen yet (idempotent replay safety). */
export function eventsToSend(localEvents, knownServerIds) {
  const known = new Set(knownServerIds);
  return localEvents.filter((e) => e && e.id && !known.has(e.id));
}

/** Explain what a mutable upsert will do, given timestamps. */
export function upsertOutcome(clientUpdatedAt, serverUpdatedAt) {
  const c = Date.parse(clientUpdatedAt) || 0;
  const s = Date.parse(serverUpdatedAt) || 0;
  if (Number.isNaN(Date.parse(serverUpdatedAt))) return { action: 'apply', reason: 'no-server-version' };
  if (c > s) return { action: 'apply', reason: 'client-newer' };
  return { action: 'keep-server', reason: 'server-newer-or-equal' };
}
