/**
 * GET    /api/entries            - list/search vocabulary (with FSRS states)
 * GET    /api/entries?id=        - single entry
 * POST   /api/entries            - create an entry
 * PUT    /api/entries            - update an entry
 * DELETE /api/entries?id=        - soft delete (tombstone, sync-safe)
 *
 * The user id always comes from the verified identity, never the request.
 * Entries are user data; enrichments are stored separately (cache) and are
 * always labelled provenance 'ai' when displayed.
 *
 * Note: the Neon tagged template parameterizes every ${} interpolation, so
 * the shared column list is injected with sql.unsafe() (a trusted,
 * hard-coded string, never user input).
 */

import { handler, json, body, query, requireString, HttpError, clampNumber } from './lib/http.mjs';
import { requireUser, ensureUserRow, languageFor } from './lib/identity.mjs';
import { sql } from './lib/db.mjs';
import { normalizeTerm, sanitizeExtra, PROVENANCES } from './lib/util.mjs';

const ENTRY_SELECT =
  'e.id, e.language_code, e.term, e.normalized, e.reading, e.part_of_speech, e.definition, ' +
  'e.gloss_language, e.example, e.notes, e.source_type, e.source_ref, e.collection_id, ' +
  'e.created_at, e.updated_at';

const MEMORY_SELECT =
  'm.dimension, m.stability, m.difficulty, m.reps, m.lapses, m.last_review, m.due';

function fold(rows) {
  const byId = new Map();
  for (const r of rows) {
    let entry = byId.get(r.id);
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
      byId.set(r.id, entry);
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
  return [...byId.values()];
}

export default handler({
  GET: async (req) => {
    const user = await requireUser();
    const s = sql();
    const q = query(req);
    const id = q.id || null;
    const search = q.q ? String(q.q).slice(0, 200) : null;
    const language = q.language ? String(q.language).slice(0, 16) : null;
    const limit = clampNumber(q.limit, 1, 500, 200);
    const offset = clampNumber(q.offset, 0, 100000, 0);

    if (id) {
      const rows = await s`
        SELECT ${s.unsafe(ENTRY_SELECT)}, ${s.unsafe(MEMORY_SELECT)}
        FROM user_data.vocab_entries e
        LEFT JOIN user_data.fsrs_memory m ON m.entry_id = e.id
        WHERE e.id = ${id} AND e.user_id = ${user.id} AND e.deleted_at IS NULL`;
      if (rows.length === 0) throw new HttpError(404, 'not-found', 'Entry not found.');
      return json({ entry: fold(rows)[0] });
    }

    const rows = await s`
      SELECT ${s.unsafe(ENTRY_SELECT)}, ${s.unsafe(MEMORY_SELECT)}
      FROM user_data.vocab_entries e
      LEFT JOIN user_data.fsrs_memory m ON m.entry_id = e.id
      WHERE e.user_id = ${user.id} AND e.deleted_at IS NULL
        AND (${language === null} OR e.language_code = ${language})
        AND (${search === null} OR e.term ILIKE ${'%' + search + '%'} OR e.normalized LIKE ${'%' + String(search).toLowerCase() + '%'})
      ORDER BY e.updated_at DESC
      LIMIT ${limit} OFFSET ${offset}`;
    return json({ entries: fold(rows) });
  },

  POST: async (req) => {
    const user = await requireUser();
    await ensureUserRow(user);
    const s = sql();
    const data = await body(req);

    const language = requireString(data, 'language_code', { max: 16 });
    const term = requireString(data, 'term', { max: 300 });
    const definition = requireString(data, 'definition', { max: 2000, optional: true });
    const reading = requireString(data, 'reading', { max: 300, optional: true });
    const partOfSpeech = requireString(data, 'part_of_speech', { max: 40, optional: true });
    const example = requireString(data, 'example', { max: 1000, optional: true });
    const notes = requireString(data, 'notes', { max: 4000, optional: true });
    const sourceType = PROVENANCES.includes(data.source_type) ? data.source_type : 'user';
    const sourceRef = requireString(data, 'source_ref', { max: 1000, optional: true });
    const extra = sanitizeExtra(data.extra);
    const glossLanguage = requireString(data, 'gloss_language', { max: 16, optional: true }) ?? 'en';
    const collectionId = typeof data.collection_id === 'string' ? data.collection_id : null;

    const lang = await languageFor(language);
    if (!lang) throw new HttpError(404, 'language-not-found', 'Unknown language code.');

    const tok = typeof lang.tokenizer === 'string' ? JSON.parse(lang.tokenizer) : lang.tokenizer ?? {};
    const normalized = normalizeTerm(term, tok.caseFold !== false);
    if (!normalized) throw new HttpError(400, 'invalid-term', 'The term is empty after normalization.');

    if (collectionId) {
      const own = await s`
        SELECT id FROM user_data.collections WHERE id = ${collectionId} AND user_id = ${user.id}`;
      if (own.length === 0) throw new HttpError(404, 'collection-not-found', 'Collection not found.');
    }

    const inserted = await s`
      INSERT INTO user_data.vocab_entries
        (user_id, language_code, term, normalized, reading, part_of_speech, definition,
         gloss_language, example, notes, source_type, source_ref, collection_id)
      VALUES
        (${user.id}, ${language}, ${term}, ${normalized}, ${reading}, ${partOfSpeech}, ${definition},
         ${glossLanguage}, ${example ?? extra.example ?? null}, ${notes ?? extra.notes ?? null},
         ${sourceType}, ${sourceRef}, ${collectionId})
      ON CONFLICT (user_id, language_code, normalized) WHERE deleted_at IS NULL DO NOTHING
      RETURNING id`;
    if (inserted.length === 0) {
      const existing = await s`
        SELECT ${s.unsafe(ENTRY_SELECT)}
        FROM user_data.vocab_entries e
        WHERE e.user_id = ${user.id} AND e.language_code = ${language}
          AND e.normalized = ${normalized} AND e.deleted_at IS NULL`;
      return json({ entry: fold(existing)[0], existing: true });
    }
    const rows = await s`
      SELECT ${s.unsafe(ENTRY_SELECT)}, ${s.unsafe(MEMORY_SELECT)}
      FROM user_data.vocab_entries e LEFT JOIN user_data.fsrs_memory m ON m.entry_id = e.id
      WHERE e.id = ${inserted[0].id}`;
    return json({ entry: fold(rows)[0] }, 201);
  },

  PUT: async (req) => {
    const user = await requireUser();
    const s = sql();
    const data = await body(req);
    const id = requireString(data, 'id', { max: 64 });
    const current = await s`
      SELECT e.id, e.language_code, e.term, e.normalized, e.reading, e.part_of_speech, e.definition,
             e.gloss_language, e.example, e.notes, e.source_type, e.source_ref, e.collection_id
      FROM user_data.vocab_entries e
      WHERE e.id = ${id} AND e.user_id = ${user.id} AND e.deleted_at IS NULL`;
    if (current.length === 0) throw new HttpError(404, 'not-found', 'Entry not found.');
    const cur = current[0];

    const term = requireString(data, 'term', { max: 300, optional: true }) ?? cur.term;
    const definition =
      data.definition === undefined ? cur.definition : requireString(data, 'definition', { max: 2000, optional: true });
    const reading =
      data.reading === undefined ? cur.reading : requireString(data, 'reading', { max: 300, optional: true });
    const partOfSpeech =
      data.part_of_speech === undefined
        ? cur.part_of_speech
        : requireString(data, 'part_of_speech', { max: 40, optional: true });
    const example =
      data.example === undefined ? cur.example : requireString(data, 'example', { max: 1000, optional: true });
    const notes = data.notes === undefined ? cur.notes : requireString(data, 'notes', { max: 4000, optional: true });

    const lang = await languageFor(cur.language_code);
    const tok = lang ? (typeof lang.tokenizer === 'string' ? JSON.parse(lang.tokenizer) : lang.tokenizer ?? {}) : {};
    const normalized = normalizeTerm(term, tok.caseFold !== false);

    if (normalized !== cur.normalized) {
      const clash = await s`
        SELECT id FROM user_data.vocab_entries
        WHERE user_id = ${user.id} AND language_code = ${cur.language_code}
          AND normalized = ${normalized} AND deleted_at IS NULL AND id <> ${id}`;
      if (clash.length > 0) {
        throw new HttpError(409, 'duplicate-entry', 'You already have an entry with this normalized term.');
      }
    }

    await s`
      UPDATE user_data.vocab_entries SET
        term = ${term}, normalized = ${normalized}, reading = ${reading}, part_of_speech = ${partOfSpeech},
        definition = ${definition}, example = ${example}, notes = ${notes}, updated_at = now()
      WHERE id = ${id} AND user_id = ${user.id} AND deleted_at IS NULL`;

    const rows = await s`
      SELECT ${s.unsafe(ENTRY_SELECT)}, ${s.unsafe(MEMORY_SELECT)}
      FROM user_data.vocab_entries e LEFT JOIN user_data.fsrs_memory m ON m.entry_id = e.id
      WHERE e.id = ${id}`;
    return json({ entry: fold(rows)[0] });
  },

  DELETE: async (req) => {
    const user = await requireUser();
    const { id } = query(req);
    if (!id) throw new HttpError(400, 'missing-param', 'Query parameter "id" is required.');
    const rows = await sql()`
      UPDATE user_data.vocab_entries SET deleted_at = now(), updated_at = now()
      WHERE id = ${id} AND user_id = ${user.id} AND deleted_at IS NULL
      RETURNING id`;
    if (rows.length === 0) throw new HttpError(404, 'not-found', 'Entry not found.');
    return json({ deleted: true });
  },
});

export const config = { path: '/api/entries' };
