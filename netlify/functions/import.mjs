/**
 * POST /api/import - restore a portable backup (the format exported by
 * /api/export, docs/OFFLINE-AND-SYNC.md).
 *
 * Merge rules (learning progress is NEVER silently overwritten):
 *   - profiles: added when missing; existing settings untouched;
 *   - entries: inserted when unknown; existing entries keep their
 *     current memories, and skipped ones are reported;
 *   - FSRS memories: restored only for newly imported entries;
 *   - collections: re-created when the name is unknown, with their items;
 *   - texts: added when the title is unknown for the language;
 *   - grammar progress: imported only when it moves the stage FORWARD;
 *   - review history: not re-imported (it is append-only and already
 *     reflected in the memory states); this is stated in the response.
 *
 * The server derives the user from the verified session - the backup file
 * never carries authority.
 */

import { handler, json, body, HttpError } from './lib/http.mjs';
import { requireUser, ensureUserRow, languageFor } from './lib/identity.mjs';
import { sql } from './lib/db.mjs';
import { normalizeTerm } from './lib/util.mjs';

const DIMENSIONS = ['recognition', 'recall', 'production'];

const clampRet = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(0.97, Math.max(0.7, n)) : 0.9;
};
const clampLimit = (v) => {
  const n = Number(v);
  return Number.isInteger(n) && n >= 1 && n <= 999 ? n : null;
};

export default handler({
  POST: async (req) => {
    const user = await requireUser();
    await ensureUserRow(user);
    const data = await body(req);

    if (data.format !== 'linguarium-backup' || !Array.isArray(data.entries)) {
      throw new HttpError(400, 'invalid-backup', 'This does not look like a Linguarium backup (format/version check failed).');
    }

    const skipped = { profiles: 0, entries: 0, collections: 0, texts: 0, grammar: 0, memories: 0 };
    const counts = { profiles: 0, entries: 0, memories: 0, collections: 0, texts: 0, grammar: 0 };

    // --- language profiles (merge: never overwrite settings) ---
    for (const p of Array.isArray(data.profiles) ? data.profiles : []) {
      if (typeof p?.language_code !== 'string') continue;
      const lang = await languageFor(p.language_code);
      if (!lang) {
        skipped.profiles += 1;
        continue;
      }
      const res = await sql()`
        INSERT INTO user_data.language_profiles
          (user_id, language_code, difficulty_mode, gloss_language,
           retention_recognition, retention_recall, retention_production, daily_new_limit, daily_review_limit)
        VALUES (${user.id}, ${p.language_code}, ${typeof p.difficulty_mode === 'string' ? p.difficulty_mode : 'stretch'},
                ${typeof p.gloss_language === 'string' ? p.gloss_language.slice(0, 16) : 'en'},
                ${clampRet(p.retention_recognition)}, ${clampRet(p.retention_recall)}, ${clampRet(p.retention_production)},
                ${clampLimit(p.daily_new_limit)}, ${clampLimit(p.daily_review_limit)})
        ON CONFLICT (user_id, language_code) DO NOTHING
        RETURNING id`;
      if (res.length > 0) counts.profiles += 1;
      else skipped.profiles += 1;
    }

    // --- vocabulary entries + memories ---
    for (const e of data.entries ?? []) {
      if (typeof e?.term !== 'string' || typeof e?.language_code !== 'string') continue;
      const lang = await languageFor(e.language_code);
      if (!lang) {
        skipped.entries += 1;
        continue;
      }
      const tok = typeof lang.tokenizer === 'string' ? JSON.parse(lang.tokenizer) : lang.tokenizer ?? {};
      const normalized = normalizeTerm(e.term, tok.caseFold !== false);
      const updated = typeof e.updated_at === 'string' ? e.updated_at : new Date().toISOString();

      const inserted = await sql()`
        INSERT INTO user_data.vocab_entries
          (user_id, language_code, term, normalized, reading, part_of_speech, definition, example, notes,
           source_type, source_ref, created_at, updated_at)
        VALUES
          (${user.id}, ${e.language_code}, ${e.term.slice(0, 300)}, ${normalized},
           ${typeof e.reading === 'string' ? e.reading.slice(0, 200) : null},
           ${typeof e.part_of_speech === 'string' ? e.part_of_speech.slice(0, 40) : null},
           ${typeof e.definition === 'string' ? e.definition.slice(0, 2000) : null},
           ${typeof e.example === 'string' ? e.example.slice(0, 500) : null},
           ${typeof e.notes === 'string' ? e.notes.slice(0, 2000) : null},
           'user',
           ${typeof e.source_ref === 'string' ? e.source_ref.slice(0, 300) : null},
           ${updated}, ${updated})
        ON CONFLICT (user_id, language_code, normalized) WHERE deleted_at IS NULL DO NOTHING
        RETURNING id`;
      if (inserted.length === 0) {
        skipped.entries += 1;
        continue;
      }
      counts.entries += 1;
      const entryId = inserted[0].id;

      // Memories are restored only for newly imported entries: an existing
      // entry keeps its current (possibly newer) state, reported as skipped.
      for (const dim of DIMENSIONS) {
        const m = e.memories?.[dim];
        if (!m || !Number.isFinite(Number(m.stability)) || !Number.isFinite(Number(m.difficulty))) continue;
        await sql()`
          INSERT INTO user_data.fsrs_memory
            (user_id, entry_id, dimension, stability, difficulty, reps, lapses, last_review, due)
          VALUES
            (${user.id}, ${entryId}, ${dim}, ${Number(m.stability)}, ${Number(m.difficulty)},
             ${Number.isFinite(Number(m.reps)) ? Math.max(0, Math.round(Number(m.reps))) : 1},
             ${Number.isFinite(Number(m.lapses)) ? Math.max(0, Math.round(Number(m.lapses))) : 0},
             ${m.last_review ?? null}, ${m.due ?? null})
          ON CONFLICT (entry_id, dimension) DO NOTHING`;
        counts.memories += 1;
      }
    }

    // --- collections (+ items) ---
    for (const c of Array.isArray(data.collections) ? data.collections : []) {
      if (typeof c?.name !== 'string' || typeof c?.language_code !== 'string') continue;
      const lang = await languageFor(c.language_code);
      if (!lang) {
        skipped.collections += 1;
        continue;
      }
      const dup = await sql()`
        SELECT id FROM user_data.collections
        WHERE user_id = ${user.id} AND language_code = ${c.language_code} AND name = ${c.name.slice(0, 200)}`;
      if (dup.length > 0) {
        skipped.collections += 1;
        continue;
      }
      const created = await sql()`
        INSERT INTO user_data.collections (user_id, language_code, name, description, source_type, license)
        VALUES (${user.id}, ${c.language_code}, ${c.name.slice(0, 200)},
                ${typeof c.description === 'string' ? c.description.slice(0, 500) : null}, 'user',
                ${typeof c.license === 'string' ? c.license.slice(0, 40) : 'unspecified'})
        RETURNING id`;
      counts.collections += 1;
      const collId = created[0].id;
      let pos = 0;
      for (const it of Array.isArray(c.items) ? c.items : []) {
        if (typeof it?.raw !== 'string') continue;
        await sql()`
          INSERT INTO user_data.collection_items (collection_id, position, raw, parsed, term, definition)
          VALUES (${collId}, ${pos}, ${it.raw.slice(0, 300)}, ${it.parsed ? true : false},
                  ${typeof it.term === 'string' ? it.term.slice(0, 300) : null},
                  ${typeof it.definition === 'string' ? it.definition.slice(0, 2000) : null})`;
        pos += 1;
      }
    }

    // --- texts ---
    for (const t of Array.isArray(data.texts) ? data.texts : []) {
      if (typeof t?.title !== 'string' || typeof t?.body !== 'string' || typeof t?.language_code !== 'string') continue;
      const lang = await languageFor(t.language_code);
      if (!lang) {
        skipped.texts += 1;
        continue;
      }
      const dup = await sql()`
        SELECT id FROM user_data.texts
        WHERE user_id = ${user.id} AND language_code = ${t.language_code} AND title = ${t.title.slice(0, 300)}`;
      if (dup.length > 0) {
        skipped.texts += 1;
        continue;
      }
      await sql()`
        INSERT INTO user_data.texts
          (user_id, language_code, title, body, author, source_url, license, adaptation_note, provenance, topic, audio_url)
        VALUES
          (${user.id}, ${t.language_code}, ${t.title.slice(0, 300)}, ${t.body.slice(0, 200000)},
           ${typeof t.author === 'string' ? t.author.slice(0, 300) : null},
           ${typeof t.source_url === 'string' ? t.source_url.slice(0, 1000) : null},
           ${typeof t.license === 'string' ? t.license.slice(0, 40) : 'unspecified'},
           ${typeof t.adaptation_note === 'string' ? t.adaptation_note.slice(0, 2000) : null},
           'user-imported',
           ${typeof t.topic === 'string' ? t.topic.slice(0, 40) : null},
           ${typeof t.audio_url === 'string' && t.audio_url.startsWith('https://') ? t.audio_url.slice(0, 1000) : null})`;
      counts.texts += 1;
    }

    // --- grammar progress (only forward) ---
    for (const g of Array.isArray(data.grammar_progress) ? data.grammar_progress : []) {
      if (typeof g?.structure_id !== 'string' || typeof g?.stage !== 'string') continue;
      const exists = await sql()`SELECT id FROM knowledge.grammar_structures WHERE id = ${g.structure_id}`;
      if (exists.length === 0) {
        skipped.grammar += 1;
        continue;
      }
      await sql()`
        INSERT INTO user_data.grammar_progress (user_id, structure_id, stage)
        VALUES (${user.id}, ${g.structure_id}, ${g.stage})
        ON CONFLICT (user_id, structure_id) DO UPDATE SET
          stage = EXCLUDED.stage, updated_at = now()
        WHERE user_data.grammar_progress.stage = 'encountered' AND EXCLUDED.stage <> 'encountered'`;
      counts.grammar += 1;
    }

    // --- fitted FSRS weights (only when this account has none yet) ---
    const w = data.fsrs_weights;
    if (w && Array.isArray(w.weights) && w.weights.length === 19 && w.weights.every((x) => Number.isFinite(x) && x > 0)) {
      await sql()`
        INSERT INTO user_data.fsrs_weights (user_id, weights, trained_at, review_count, loss_default, loss_optimized)
        VALUES (${user.id}, ${JSON.stringify(w.weights.map((x) => Number(x)))}::jsonb,
                ${typeof w.trained_at === 'string' ? w.trained_at : new Date().toISOString()},
                ${Number.isFinite(Number(w.review_count)) ? Math.max(0, Math.round(Number(w.review_count))) : 0},
                ${Number.isFinite(Number(w.loss_default)) ? Number(w.loss_default) : null},
                ${Number.isFinite(Number(w.loss_optimized)) ? Number(w.loss_optimized) : null})
        ON CONFLICT (user_id) DO NOTHING`;
    }

    return json({
      imported: counts,
      skipped,
      review_history: 'not re-imported (append-only log; the memory states carry your scheduling)',
    });
  },
});

export const config = { path: '/api/import' };
