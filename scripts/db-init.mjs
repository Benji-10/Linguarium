/**
 * Initialize the Neon database: run sql/schema.sql then sql/seed.sql.
 *
 * Usage: DATABASE_URL=postgres://... npm run db:init
 *
 * Statements are split on semicolons that end a line (all SQL files in this
 * project follow that convention and never contain ";\n" inside literals).
 */

import { neon } from '@neondatabase/serverless';
import { readFile } from 'node:fs/promises';

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set. Copy .env.example to .env and fill it in.');
  process.exit(1);
}

const sql = neon(process.env.DATABASE_URL);

function statements(sqlText) {
  return sqlText
    .split(/;\s*\n/)
    .map((s) => s.replace(/^\s*--.*$/gm, '').trim())
    .filter((s) => s.length > 0);
}

async function run(file) {
  const text = await readFile(new URL(`../sql/${file}`, import.meta.url).pathname, 'utf8');
  const stmts = statements(text);
  let applied = 0;
  for (const stmt of stmts) {
    try {
      await sql(stmt);
      applied += 1;
    } catch (err) {
      const msg = String(err?.message ?? err);
      if (/already exists|duplicate key/i.test(msg)) {
        console.warn(`  [skip] ${msg.split('\n')[0]}`);
      } else {
        throw err;
      }
    }
  }
  console.log(`  ${file}: ${applied} statements applied`);
}

console.log('Initializing Linguarium database...');
await run('schema.sql');
await run('seed.sql');
console.log('Done. You can create your account in the app now.');
