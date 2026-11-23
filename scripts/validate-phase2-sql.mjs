// Validate the NEW SQL statements from phase 2 (import.mjs, sync.mjs grammar
// stage, texts.mjs topic/audio) against embedded Postgres. Prevents the
// "reserved keyword / syntax error only on a real database" class of bug.
import { PGlite } from '@electric-sql/pglite'
import { readFile } from 'node:fs/promises'
import { splitSql } from '../netlify/functions/lib/sqlsplit.mjs'

const db = new PGlite()
for (const file of ['schema.sql', 'seed.sql']) {
  const text = await readFile(new URL(`../sql/${file}`, import.meta.url), 'utf8')
  for (const stmt of splitSql(text)) await db.exec(stmt)
}

const USER = '00000000-0000-4000-8000-000000000001'
const uid = await db.query(`SELECT id FROM user_data.users WHERE id = '${USER}'`)
if (uid.rows.length === 0) await db.query(`INSERT INTO user_data.users (id) VALUES ('${USER}')`)

// texts.mjs POST with topic + audio_url
await db.query(
  `INSERT INTO user_data.texts
     (user_id, language_code, title, body, author, source_url, license, adaptation_note, provenance, topic, audio_url)
   VALUES ($1, 'ko', 'audio test', 'body', NULL, NULL, 'unspecified', NULL, 'user-imported', 'daily-life', 'https://example.com/a.mp3')`,
  [USER],
)
console.log('texts INSERT with topic+audio_url OK')

// sync.mjs grammar stage replay
const struct = await db.query(`INSERT INTO knowledge.grammar_structures (language_code, name, examples, provenance)
  VALUES ('ko', 'test structure', '[]', 'community') RETURNING id`)
const sid = struct.rows[0].id
await db.query(
  `INSERT INTO user_data.grammar_progress (user_id, structure_id, stage, updated_at)
   VALUES ($1, $2, 'understood', now())
   ON CONFLICT (user_id, structure_id) DO UPDATE SET stage = EXCLUDED.stage, updated_at = now()`,
  [USER, sid],
)
await db.query(
  `INSERT INTO user_data.grammar_progress (user_id, structure_id, stage)
   VALUES ($1, $2, 'recognized')
   ON CONFLICT (user_id, structure_id) DO UPDATE SET stage = EXCLUDED.stage, updated_at = now()
   WHERE user_data.grammar_progress.stage = 'encountered' AND EXCLUDED.stage <> 'encountered'`,
  [USER, sid],
)
const gp = await db.query(`SELECT stage FROM user_data.grammar_progress WHERE structure_id = $1`, [sid])
console.log('grammar upserts OK, stage =', gp.rows[0].stage, '(expected understood: the guarded update must NOT regress)')

// import.mjs: profiles
await db.query(
  `INSERT INTO user_data.language_profiles (user_id, language_code, difficulty_mode, gloss_language)
   VALUES ($1, 'ko', 'stretch', 'en')
   ON CONFLICT (user_id, language_code) DO NOTHING RETURNING id`,
  [USER],
)
const prof2 = await db.query(
  `INSERT INTO user_data.language_profiles (user_id, language_code, difficulty_mode, gloss_language)
   VALUES ($1, 'ko', 'challenge', 'fr')
   ON CONFLICT (user_id, language_code) DO NOTHING RETURNING id`,
  [USER],
)
console.log('profiles ON CONFLICT OK, re-insert returned', prof2.rows.length, 'rows (expected 0)')

// import.mjs: entries + memories
const ins = await db.query(
  `INSERT INTO user_data.vocab_entries
     (user_id, language_code, term, normalized, definition, source_type, created_at, updated_at)
   VALUES ($1, 'ko', '아침', '아침', 'morning', 'user', now(), now())
   ON CONFLICT (user_id, language_code, normalized) WHERE deleted_at IS NULL DO NOTHING
   RETURNING id`,
  [USER],
)
const entryId = ins.rows[0].id
await db.query(
  `INSERT INTO user_data.fsrs_memory
     (user_id, entry_id, dimension, stability, difficulty, reps, lapses, last_review, due)
   VALUES ($1, $2, 'production', 3.2, 5.5, 2, 0, NULL, NULL)
   ON CONFLICT (entry_id, dimension) DO NOTHING`,
  [USER, entryId],
)
console.log('entries + fsrs_memory INSERT OK')

// import.mjs: collections + items
const coll = await db.query(
  `INSERT INTO user_data.collections (user_id, language_code, name, description, source_type, license)
   VALUES ($1, 'ko', 'my words', NULL, 'user', 'unspecified') RETURNING id`,
  [USER],
)
await db.query(
  `INSERT INTO user_data.collection_items (collection_id, position, raw, parsed, term, definition)
   VALUES ($1, 0, '아침,morning', false, NULL, NULL)`,
  [coll.rows[0].id],
)
console.log('collections + items INSERT OK')

// rate_limits window_day fix
await db.query(
  `INSERT INTO user_data.rate_limits (user_id, window_day, action, count)
   VALUES ($1, CURRENT_DATE, 'check', 1)
   ON CONFLICT (user_id, window_day, action) DO UPDATE SET count = user_data.rate_limits.count + 1`,
  [USER],
)
console.log('rate_limits window_day INSERT OK')

console.log('\nAll phase-2 SQL validated against real Postgres.')
