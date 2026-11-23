/**
 * Initialize / populate the Neon database.
 *
 * Usage:
 *   DATABASE_URL=postgres://... npm run db:init        # schema + seed data
 *   DATABASE_URL=postgres://... npm run db:seed        # seed data only
 *   node scripts/db-init.mjs --dry-run                 # validate SQL files locally,
 *                                                       # no database needed
 *
 * Statements are split with the shared dollar-quote-aware splitter
 * (netlify/functions/lib/sqlsplit.mjs), so seed bodies may safely contain
 * semicolons. Everything is idempotent (IF NOT EXISTS / ON CONFLICT DO NOTHING),
 * which means re-running on an existing database never duplicates rows.
 */

import { neon } from '@neondatabase/serverless';
import { readFile } from 'node:fs/promises';
import { splitSql } from '../netlify/functions/lib/sqlsplit.mjs';

const args = process.argv.slice(2);
const seedOnly = args.includes('--seed-only');
const dryRun = args.includes('--dry-run');

async function loadSql(file) {
  return readFile(new URL(`../sql/${file}`, import.meta.url).pathname, 'utf8');
}

/** Errors that simply mean "this already exists" on a re-run. */
function isBenignError(err) {
  return /already exists|duplicate key/i.test(String(err?.message ?? err));
}

async function run(sqlText, file, exec) {
  const stmts = splitSql(sqlText);
  let applied = 0;
  let skipped = 0;
  for (const stmt of stmts) {
    try {
      // .query(): a conventional call with a plain statement string (the
      // neon query function itself only works as a tagged template).
      await exec.query(stmt);
      applied += 1;
    } catch (err) {
      if (isBenignError(err)) {
        skipped += 1;
      } else {
        throw new Error(`In ${file}: ${String(err?.message ?? err)}\n  Statement: ${stmt.slice(0, 200)}...`);
      }
    }
  }
  console.log(`  ${file}: ${applied} applied, ${skipped} skipped (already present)`);
  return { applied, skipped };
}

console.log(
  dryRun
    ? 'Validating sql/schema.sql and sql/seed.sql (dry run, no database touched)...'
    : seedOnly
      ? 'Populating Linguarium database (seed data only)...'
      : 'Initializing Linguarium database (schema + seed data)...',
);

const files = seedOnly ? ['seed.sql'] : ['schema.sql', 'seed.sql'];
let totals = { applied: 0, skipped: 0 };

if (dryRun) {
  for (const file of files) {
    const stmts = splitSql(await loadSql(file));
    const bad = stmts.filter((s) => !/^(CREATE|ALTER|INSERT|UPDATE|DELETE|DROP|GRANT|REVOKE|SET|COMMENT|WITH|DO)\b/i.test(s));
    console.log(`  ${file}: ${stmts.length} statements`);
    for (const s of stmts) {
      const first = s.split(/\s+/).slice(0, 6).join(' ');
      console.log(`    - ${first}`);
    }
    if (bad.length > 0) {
      console.error(`  ${file}: ${bad.length} statements have an unexpected leading keyword - inspect manually.`);
      process.exit(1);
    }
  }
  console.log('Dry run OK: every statement starts with a known SQL keyword and splitting looks correct.');
  process.exit(0);
}

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set. Copy .env.example to .env and fill it in.');
  process.exit(1);
}

const exec = neon(process.env.DATABASE_URL);
for (const file of files) {
  const res = await run(await loadSql(file), file, exec);
  totals.applied += res.applied;
  totals.skipped += res.skipped;
}

console.log(
  `Done (${totals.applied} applied, ${totals.skipped} skipped). You can create your account in the app now.`,
);
