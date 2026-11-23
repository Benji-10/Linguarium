/**
 * Validate the phase-3 SQL additions on an embedded Postgres (pglite):
 *   - the new tables exist with the expected columns,
 *   - the lexicon seeds are present,
 *   - the resources catalog is populated for every preset language
 *     (dictionary + corpus where applicable),
 *   - the profile personalization columns exist,
 *   - re-running the seed is idempotent (no duplicates).
 *
 * No external database needed.
 */

import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { splitSql } from '../netlify/functions/lib/sqlsplit.mjs';

const schemaSql = await readFile(new URL('../sql/schema.sql', import.meta.url), 'utf8');
const seedSql = await readFile(new URL('../sql/seed.sql', import.meta.url), 'utf8');

const db = new PGlite();

for (const [name, sqlText] of [
  ['schema.sql', schemaSql],
  ['seed.sql', seedSql],
  ['seed.sql (again, idempotency)', seedSql],
]) {
  for (const stmt of splitSql(sqlText)) {
    await db.exec(stmt);
  }
  console.log(`${name}: OK`);
}

// --- new tables and columns ---
const cols = async (table) => (await db.query(`SELECT column_name FROM information_schema.columns WHERE table_schema || '.' || table_name = '${table}'`)).rows.map((r) => r.column_name);

const profileCols = await cols('user_data.language_profiles');
for (const c of ['retention_recognition', 'retention_recall', 'retention_production', 'daily_new_limit', 'daily_review_limit']) {
  if (!profileCols.includes(c)) throw new Error(`language_profiles missing ${c}`);
}
console.log('language_profiles personalization columns: OK');

for (const table of ['user_data.fsrs_weights', 'knowledge.contribution_queue', 'knowledge.lexicon', 'knowledge.resources']) {
  const rows = await db.query(`SELECT 1 FROM information_schema.tables WHERE table_schema || '.' || table_name = '${table}'`);
  if (rows.rows.length === 0) throw new Error(`${table} missing`);
}
console.log('fsrs_weights / contribution_queue / lexicon / resources tables: OK');

// --- lexicon seeds ---
const lex = (await db.query('SELECT language_code, count(*)::int AS n FROM knowledge.lexicon GROUP BY language_code ORDER BY language_code')).rows;
console.log('LEXICON PER LANGUAGE:', JSON.stringify(Object.fromEntries(lex.map((r) => [r.language_code, r.n]))));
if (!(lex.find((r) => r.language_code === 'tok')?.n >= 20)) throw new Error('tok lexicon seed too small');
if (!(lex.find((r) => r.language_code === 'eo')?.n >= 10)) throw new Error('eo lexicon seed too small');
if (!(lex.find((r) => r.language_code === 'la')?.n >= 5)) throw new Error('la lexicon seed too small');

// --- resources catalog ---
const langs = (await db.query('SELECT count(*)::int AS n FROM knowledge.languages')).rows[0].n;
const res = (await db.query('SELECT kind, count(*)::int AS n FROM knowledge.resources GROUP BY kind ORDER BY kind')).rows;
console.log(`languages: ${langs}, RESOURCES BY KIND:`, JSON.stringify(Object.fromEntries(res.map((r) => [r.kind, r.n]))));
const perLang = (await db.query('SELECT count(DISTINCT language_code)::int AS n FROM knowledge.resources')).rows[0].n;
console.log(`languages covered by the catalog: ${perLang}`);
// every preset language must have at least the Wiktionary dictionary entry
const uncovered = (await db.query(`
  SELECT l.code FROM knowledge.languages l
  WHERE NOT EXISTS (SELECT 1 FROM knowledge.resources r WHERE r.language_code = l.code AND r.name = 'Wiktionary')
`)).rows.map((r) => r.code);
if (uncovered.length > 0) throw new Error(`languages without a dictionary entry: ${uncovered.join(', ')}`);
// Wikipedia corpus for everything except tok (no edition) and nb maps to no.wikipedia
const withoutCorpus = (await db.query(`
  SELECT l.code FROM knowledge.languages l
  WHERE l.code <> 'tok' AND NOT EXISTS (SELECT 1 FROM knowledge.resources r WHERE r.language_code = l.code AND r.name = 'Wikipedia')
`)).rows.map((r) => r.code);
if (withoutCorpus.length > 0) throw new Error(`languages without a corpus entry: ${withoutCorpus.join(', ')}`);

// resource URLs must be https and well-formed
const bad = (await db.query(`SELECT name, source_url FROM knowledge.resources WHERE source_url NOT LIKE 'https://%'`)).rows;
if (bad.length > 0) throw new Error(`non-https resource URLs: ${JSON.stringify(bad)}`);

// --- idempotency: no duplicate (language, term) in lexicon, no duplicate resources ---
const dupLex = (await db.query(`SELECT count(*)::int AS n FROM (SELECT language_code, term, count(*) c FROM knowledge.lexicon GROUP BY 1,2 HAVING count(*) > 1) d`)).rows[0].n;
if (dupLex > 0) throw new Error('duplicate lexicon rows after re-seed');
const dupRes = (await db.query(`SELECT count(*)::int AS n FROM (SELECT language_code, name, count(*) c FROM knowledge.resources GROUP BY 1,2 HAVING count(*) > 1) d`)).rows[0].n;
if (dupRes > 0) throw new Error('duplicate resource rows after re-seed');

console.log('phase 3 SQL validation: ALL OK');
