# Offline behaviour, sync and backups

## Offline scope (phase 1)

| Works offline | Notes |
| --- | --- |
| Reading | cached texts render; tokens, word panel and known-state highlighting all local |
| Review | queue built from the cached entries + memory states; FSRS runs locally |
| Knowledge lookup | cached entries and cached enrichments |
| Discover difficulty estimates | computed locally from cached data |
| Everything else | renders from cache; server actions queue |

The service worker precaches the app shell and deliberately **never caches `/api/*`**
(user data is managed in IndexedDB with explicit staleness rules, not a stale HTTP
cache).

## The change queue

Actions made offline (review events, entry edits, deletions) are queued in IndexedDB
(`src/core/idb.mjs`) and flushed through `/api/sync`:

- automatically when the browser goes online, on app boot, and after sign-in;
- manually via the Sync button (top bar) or Settings → Offline & sync.

## Conflict rules

1. Review events: append-only with client UUIDs — replays are no-ops. **Learning
   progress can never be overwritten by sync.**
2. Entry edits: applied only when the client's `updated_at` is strictly newer;
   otherwise the server version is kept and the skipped change is **reported** ("kept
   newer server versions of …"). Never silent.
3. Deletions are tombstones — a delayed sync can never resurrect deleted data.

## Backup export

Settings → Your data → **Export backup** downloads everything (see the format in
docs/DATABASE.md) as a single documented JSON file. Collection-level CSV/JSON export
lives in each collection. The backup is yours to keep, parse or re-import elsewhere
(Settings → Import backup; the import merges — unknown items are restored, anything
already present keeps its current state, and skipped items are reported):
there is no lock-in.

## Deleting local data

Settings → Offline & sync → **Clear local cache** removes the IndexedDB stores on the
device only (server data untouched; it re-caches on next load).

## Background Sync (phase 2)

Whenever an offline action is queued, the app also registers a Background Sync
tag (`linguarium-flush`) with the service worker where the browser supports it.
When connectivity returns, the service worker wakes the open app and the queue
flushes — even if the window's `online` event was missed (a backgrounded tab, for
example). Where Background Sync is unavailable, the `online` listener and the
Sync button keep working exactly as before. Queue contents never change: the
same events, the same conflict rules.

## Phase 3 notes

- The backup export now also includes **fitted FSRS parameters** (`fsrs_weights`)
  and the per-profile **scheduling preferences** (retention per dimension, daily
  caps). Import restores them only when the target account lacks them — never
  overwriting anything existing.
- Daily caps are enforced server-side while online and reported in the session;
  offline sessions are not capped (there is no honest way to count today's reviews
  offline) — the session note says so.
