// Dumps the seeded shared_texts + grammar as API-shaped JSON for browser
// route mocking (simulates the user's post-phase-2 database).
import { PGlite } from '@electric-sql/pglite'
import { readFile } from 'node:fs/promises'
import { splitSql } from '../netlify/functions/lib/sqlsplit.mjs'

const db = new PGlite()
for (const file of ['schema.sql', 'seed.sql']) {
  const text = await readFile(new URL(`../sql/${file}`, import.meta.url), 'utf8')
  for (const stmt of splitSql(text)) await db.exec(stmt)
}

const texts = (await db.query(
  'SELECT id, language_code, title, author, source_url, license, adaptation_note, provenance, source_ref, topic, length(body)::int AS body_length, created_at FROM knowledge.shared_texts ORDER BY created_at',
)).rows

const koDetail = (await db.query(
  "SELECT id, language_code, title, body, author, source_url, license, adaptation_note, provenance, source_ref, topic, created_at FROM knowledge.shared_texts WHERE language_code = 'ko' AND title LIKE '%일요일%'",
)).rows[0]

const grammar = (await db.query(
  "SELECT id, language_code, name, summary, explanation, examples, provenance, source_ref, NULL AS stage FROM knowledge.grammar_structures WHERE language_code = 'ko' ORDER BY name",
)).rows

const payload = {
  '/api/texts': { texts: [], shared: texts },
  '/api/texts-detail-ko': { text: koDetail },
  '/api/grammar': { structures: grammar },
}

const fs = await import('node:fs')
fs.writeFileSync('/tmp/render/mock-api.json', JSON.stringify(payload, null, 1))
console.log('texts:', texts.length, '| ko texts:', texts.filter((t) => t.language_code === 'ko').length, '| ko grammar:', grammar.length)
