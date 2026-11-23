/**
 * GET /api/export - full portable backup of the authenticated user's data.
 *
 * Your data leaves in a documented, plain JSON format (see
 * docs/OFFLINE-AND-SYNC.md) with no lock-in: entries, FSRS states, review
 * history, collections and their items, texts, reading positions, grammar
 * progress and encounter counts.
 */

import { handler } from './lib/http.mjs';
import { requireUser } from './lib/identity.mjs';
import { sql } from './lib/db.mjs';

function parseJson(v, dflt) {
  if (v == null) return dflt;
  if (typeof v === 'string') {
    try {
      return JSON.parse(v);
    } catch {
      return dflt;
    }
  }
  return v;
}

export default handler({
  GET: async (req) => {
    const user = await requireUser();
    const uid = user.id;

    const [profiles, collectionsRaw, texts, grammarProgress, readingProgress, weightsRows] = await Promise.all([
      sql()`SELECT language_code, difficulty_mode, gloss_language, active, created_at, updated_at,
                   retention_recognition, retention_recall, retention_production, daily_new_limit, daily_review_limit
            FROM user_data.language_profiles WHERE user_id = ${uid} ORDER BY created_at`,
      sql()`SELECT id, language_code, name, description, source_type, source_url, license, created_at, updated_at
            FROM user_data.collections WHERE user_id = ${uid} ORDER BY created_at`,
      sql()`SELECT id, language_code, title, body, author, source_url, license, adaptation_note, provenance,
                   created_at, updated_at
            FROM user_data.texts WHERE user_id = ${uid} AND deleted_at IS NULL ORDER BY created_at`,
      sql()`SELECT structure_id, stage, updated_at FROM user_data.grammar_progress WHERE user_id = ${uid}`,
      sql()`SELECT text_kind, text_id, position, last_read_at FROM user_data.reading_progress WHERE user_id = ${uid}`,
      sql()`SELECT weights, trained_at, review_count, loss_default, loss_optimized
            FROM user_data.fsrs_weights WHERE user_id = ${uid}`,
    ]);

    // Collection items for all owned collections.
    const collectionItems =
      collectionsRaw.length > 0
        ? await sql()`
          SELECT i.collection_id, i.position, i.raw, i.parsed, i.term, i.definition, i.extra, i.created_at, i.updated_at
          FROM user_data.collection_items i
          JOIN user_data.collections c ON c.id = i.collection_id AND c.user_id = ${uid}
          ORDER BY i.position, i.created_at`
        : [];

    const itemsByCollection = new Map();
    for (const item of collectionItems) {
      if (!itemsByCollection.has(item.collection_id)) itemsByCollection.set(item.collection_id, []);
      itemsByCollection.get(item.collection_id).push({
        position: item.position,
        raw: item.raw,
        parsed: item.parsed,
        term: item.term,
        definition: item.definition,
        extra: parseJson(item.extra, {}),
        created_at: item.created_at,
        updated_at: item.updated_at,
      });
    }

    // Vocabulary entries with FSRS memory states.
    const entryRows = await sql()`
      SELECT e.id, e.language_code, e.term, e.normalized, e.reading, e.part_of_speech, e.definition,
             e.gloss_language, e.example, e.notes, e.source_type, e.source_ref, e.collection_id,
             e.created_at, e.updated_at,
             m.dimension, m.stability, m.difficulty, m.reps, m.lapses, m.last_review, m.due
      FROM user_data.vocab_entries e
      LEFT JOIN user_data.fsrs_memory m ON m.entry_id = e.id
      WHERE e.user_id = ${uid} AND e.deleted_at IS NULL
      ORDER BY e.created_at`;

    const entriesById = new Map();
    for (const r of entryRows) {
      let entry = entriesById.get(r.id);
      if (!entry) {
        entry = {
          id: r.id,
          language_code: r.language_code,
          term: r.term,
          normalized: r.normalized,
          reading: r.reading,
          part_of_speech: r.part_of_speech,
          definition: r.definition,
          gloss_language: r.gloss_language,
          example: r.example,
          notes: r.notes,
          source_type: r.source_type,
          source_ref: r.source_ref,
          collection_id: r.collection_id,
          created_at: r.created_at,
          updated_at: r.updated_at,
          memories: {},
        };
        entriesById.set(r.id, entry);
      }
      if (r.dimension) {
        entry.memories[r.dimension] = {
          stability: r.stability,
          difficulty: r.difficulty,
          reps: r.reps,
          lapses: r.lapses,
          last_review: r.last_review,
          due: r.due,
        };
      }
    }

    // Review history (capped at the most recent 10,000 events).
    const reviewLog = await sql()`
      SELECT id, entry_id, dimension, rating, stability, difficulty, elapsed_days, next_due, reviewed_at
      FROM user_data.review_log
      WHERE user_id = ${uid}
      ORDER BY reviewed_at DESC
      LIMIT 10000`;

    const encounters = await sql()`
      SELECT count(*)::int AS total,
             count(*) FILTER (WHERE occurred_at > now() - interval '30 days')::int AS last_30_days
      FROM user_data.encounters WHERE user_id = ${uid}`;

    const backup = {
      format: 'linguarium-backup',
      version: 1,
      exported_at: new Date().toISOString(),
      user: { id: user.id, display_name: user.name ?? user.email ?? null },
      profiles,
      collections: collectionsRaw.map((c) => ({
        ...c,
        items: itemsByCollection.get(c.id) ?? [],
      })),
      entries: [...entriesById.values()],
      review_log: reviewLog,
      texts,
      reading_progress: readingProgress.map((p) => ({ ...p, position: parseJson(p.position, {}) })),
      grammar_progress: grammarProgress,
      encounters: encounters[0] ?? { total: 0, last_30_days: 0 },
      fsrs_weights:
        weightsRows.length > 0
          ? {
              weights: parseJson(weightsRows[0].weights, null),
              trained_at: weightsRows[0].trained_at,
              review_count: weightsRows[0].review_count,
              loss_default: weightsRows[0].loss_default,
              loss_optimized: weightsRows[0].loss_optimized,
            }
          : null,
    };

    const stamp = new Date().toISOString().slice(0, 10);
    return new Response(JSON.stringify(backup, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="linguarium-backup-${stamp}.json"`,
        'Cache-Control': 'no-store',
      },
    });
  },
});

export const config = { path: '/api/export' };
