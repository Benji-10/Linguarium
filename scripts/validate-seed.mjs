// Local validation: run schema.sql + seed.sql through PGlite (embedded Postgres)
// to prove the phase-2 batch applies cleanly and the data is really there.
import { PGlite } from '@electric-sql/pglite'
import { readFile } from 'node:fs/promises'
import { splitSql } from '../netlify/functions/lib/sqlsplit.mjs'

const db = new PGlite()

async function apply(file) {
  const text = await readFile(new URL(`../sql/${file}`, import.meta.url), 'utf8')
  const stmts = splitSql(text)
  for (const stmt of stmts) {
    try {
      await db.exec(stmt)
    } catch (err) {
      throw new Error(`${file}: statement failed: ${err.message}\n${stmt.slice(0, 160)}`)
    }
  }
  console.log(`${file}: ${stmts.length} statements OK`)
}

await apply('schema.sql')
await apply('seed.sql')
await apply('seed.sql') // re-run to prove idempotency

const texts = await db.query(
  "SELECT language_code, title, topic FROM knowledge.shared_texts ORDER BY language_code, title",
)
console.log(`\nTEXTS (${texts.rows.length}):`)
for (const r of texts.rows) console.log(`  ${r.language_code.padEnd(4)} ${r.topic ?? '-'.padEnd(9)} ${r.title}`)

const noTopic = texts.rows.filter((r) => !r.topic)
console.log(noTopic.length === 0 ? '\nAll texts have topics.' : `\nMISSING TOPICS: ${noTopic.map((r) => r.title).join(', ')}`)

const grammar = await db.query(
  "SELECT language_code, name FROM knowledge.grammar_structures ORDER BY language_code, name",
)
const byLang = {}
for (const r of grammar.rows) byLang[r.language_code] = (byLang[r.language_code] ?? 0) + 1
console.log('\nGRAMMAR PER LANGUAGE:', JSON.stringify(byLang))

const koGrammar = (await db.query(
  "SELECT name, examples FROM knowledge.grammar_structures WHERE language_code = 'ko'",
)).rows ?? []
for (const r of koGrammar) {
  const ex = typeof r.examples === 'string' ? JSON.parse(r.examples) : r.examples
  console.log(`  ko: ${r.name} (${ex?.length ?? 0} examples)`)
}

const cols = await db.query(
  "SELECT column_name FROM information_schema.columns WHERE table_schema='user_data' AND table_name='texts'",
)
console.log('\nuser_data.texts columns:', cols.rows.map((r) => r.column_name).join(', '))
const cols2 = await db.query(
  "SELECT column_name FROM information_schema.columns WHERE table_schema='knowledge' AND table_name='shared_texts'",
)
console.log('knowledge.shared_texts columns:', cols2.rows.map((r) => r.column_name).join(', '))
