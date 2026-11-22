/**
 * POST /api/sync - flush the offline queue.
 *
 * The queue contains:
 *   events     - review events (append-only, idempotent by UUID)
 *   entryUpserts - vocabulary entries created/edited offline
 *   deletes    - tombstones (never resurrected)
 *
 * Conflict rules (learning progress is never silently overwritten):
 *   - review events always merge (duplicates are no-ops);
 *   - an entry update applies only when the client version is strictly
 *     newer (updated_at guard); otherwise it is REPORTED as a conflict;
 *   - deletions always win (tombstones).
 */

import { handler, json, body, HttpError } from './lib/http.mjs';
import { requireUser, ensureUserRow, languageFor } from './lib/identity.mjs';
import { sql } from './lib/db.mjs';
import { applyReviewEvent } from './lib/sync-core.mjs';
import { normalizeTerm } from './lib/util.mjs';

async function applyEntryUpsert(userId, upsert) {
  if (upsert == null || typeof upsert !== 'object') {
    throw new HttpError(400, 'invalid-upsert', 'Entry upserts must be objects.');
  }
  const hasId = typeof upsert.id === 'string' && upsert.id.length > 0;
  const term = typeof upsert.term === 'string' ? upsert.term.trim().slice(0, 300) : '';
  const language = typeof upsert.language_code === 'string' ? upsert.language_code.slice(0, 16) : '';
  if (!term || !language) {
    throw new HttpError(400, 'invalid-upsert', 'Entry upserts need "term" and "language_code".');
  }
  const clientUpdatedAt = new Date(upsert.updated_at);
  if (Number.isNaN(clientUpdatedAt.getTime())) {
    throw new HttpError(400, 'invalid-upsert', 'Entry upserts need a valid "updated_at".');
  }

  const lang = await languageFor(language);
  if (!lang) throw new HttpError(404, 'language-not-found', `Unknown language ${language}.`);
  const tok = typeof lang.tokenizer === 'string' ? JSON.parse(lang.tokenizer) : lang.tokenizer ?? {};
  const normalized = normalizeTerm(term, tok.caseFold !== false);

  if (hasId) {
    const existing = await sql()`
      SELECT updated_at, deleted_at FROM user_data.vocab_entries
      WHERE id = ${upsert.id} AND user_id = ${userId}`;
    if (existing.length === 0) {
      return { action: 'conflict', reason: 'missing' };
    }
    const serverUpdated = new Date(existing[0].updated_at);
    if (clientUpdatedAt <= serverUpdated) {
      return { action: 'conflict', reason: 'server-newer-or-equal' };
    }
    await sql()`
      UPDATE user_data.vocab_entries SET
        term = ${term}, normalized = ${normalized},
        definition = ${upsert.definition ?? null}, reading = ${upsert.reading ?? null},
        part_of_speech = ${upsert.part_of_speech ?? null}, example = ${upsert.example ?? null},
        notes = ${upsert.notes ?? null}, updated_at = ${clientUpdatedAt.toISOString()},
        deleted_at = ${existing[0].deleted_at ? existing[0].deleted_at : null}
      WHERE id = ${upsert.id} AND user_id = ${userId}`;
    return { action: 'applied' };
  }

  const inserted = await sql()`
    INSERT INTO user_data.vocab_entries
      (user_id, language_code, term, normalized, definition, reading, part_of_speech, example, notes,
       source_type, source_ref, collection_id, created_at, updated_at)
    VALUES
      (${userId}, ${language}, ${term}, ${normalized},
       ${upsert.definition ?? null}, ${upsert.reading ?? null}, ${upsert.part_of_speech ?? null},
       ${upsert.example ?? null}, ${upsert.notes ?? null},
       'user', ${upsert.source_ref ?? null},
       ${typeof upsert.collection_id === 'string' ? upsert.collection_id : null},
       ${clientUpdatedAt.toISOString()}, ${clientUpdatedAt.toISOString()})
    ON CONFLICT (user_id, language_code, normalized) WHERE deleted_at IS NULL DO NOTHING
    RETURNING id`;
  if (inserted.length === 0) {
    return { action: 'conflict', reason: 'duplicate' };
  }
  return { action: 'applied' };
}

async function applyDelete(userId, del) {
  const type = del?.type;
  const id = del?.id;
  if (typeof id !== 'string' || !['entry', 'text', 'collection'].includes(type)) {
    throw new HttpError(400, 'invalid-delete', 'Deletes need "type" (entry/text/collection) and "id".');
  }
  if (type === 'entry') {
    await sql()`
      UPDATE user_data.vocab_entries SET deleted_at = now()
      WHERE id = ${id} AND user_id = ${userId} AND deleted_at IS NULL`;
  } else if (type === 'text') {
    await sql()`
      UPDATE user_data.texts SET deleted_at = now()
      WHERE id = ${id} AND user_id = ${userId} AND deleted_at IS NULL`;
  } else {
    const rows = await sql()`
      DELETE FROM user_data.collections WHERE id = ${id} AND user_id = ${userId} RETURNING id`;
    if (rows.length > 0) {
      await sql()`DELETE FROM user_data.collection_items WHERE collection_id = ${id}`;
    }
  }
  return { action: 'applied' };
}

export default handler({
  POST: async (req) => {
    const user = await requireUser();
    await ensureUserRow(user);
    const data = await body(req);

    const events = Array.isArray(data.events) ? data.events.slice(0, 500) : [];
    const entryUpserts = Array.isArray(data.entryUpserts) ? data.entryUpserts.slice(0, 500) : [];
    const deletes = Array.isArray(data.deletes) ? data.deletes.slice(0, 500) : [];

    const conflicts = [];
    let eventsApplied = 0;
    let eventsDuplicate = 0;

    for (const event of events) {
      const result = await applyReviewEvent(user.id, event);
      if (result === 'applied') eventsApplied += 1;
      else eventsDuplicate += 1;
    }

    const entryResults = { applied: 0, conflicts: 0 };
    for (const upsert of entryUpserts) {
      const r = await applyEntryUpsert(user.id, upsert);
      if (r.action === 'applied') entryResults.applied += 1;
      else {
        entryResults.conflicts += 1;
        conflicts.push({ type: 'entry', id: upsert.id ?? null, reason: r.reason });
      }
    }

    let deletesApplied = 0;
    for (const del of deletes) {
      await applyDelete(user.id, del);
      deletesApplied += 1;
    }

    return json({
      applied: {
        events: eventsApplied,
        entries: entryResults.applied,
        deletes: deletesApplied,
      },
      duplicates: eventsDuplicate,
      conflicts,
    });
  },
});

export const config = { path: '/api/sync' };
