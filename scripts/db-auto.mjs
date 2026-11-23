/**
 * Build-time database synchronization, run from the Netlify build command:
 *
 *   npm run build && node scripts/db-auto.mjs
 *
 * What it does (so nobody has to run db:init by hand after pulling changes
 * that touch sql/schema.sql or sql/seed.sql):
 *   1. Skips silently (exit 0) when DATABASE_URL is not set - the deployment
 *      still builds and every API route reports the database honestly.
 *   2. Hashes schema.sql + seed.sql. When the hashes match what is stored in
 *      knowledge.db_state, nothing runs (a re-deploy of unchanged SQL is a
 *      no-op, which keeps builds fast).
 *   3. When they differ (or the database is fresh), applies schema.sql then
 *      seed.sql - the same idempotent statement runner as db-init.mjs
 *      (IF NOT EXISTS / ON CONFLICT DO NOTHING semantics), then records the
 *      new hashes.
 *   4. A database FAILURE never fails the deploy: the error is printed as a
 *      visible warning in the build log and the build continues. Add
 *      --strict to make failures fatal (useful in local development).
 *
 * Manual overrides:
 *   node scripts/db-auto.mjs --force     # run even when hashes match
 *   node scripts/db-auto.mjs --strict   # exit 1 on database errors
 */

import { neon } from '@neondatabase/serverless';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

const args = process.argv.slice(2);
const force = args.includes('--force');
const strict = args.includes('--strict');

async function loadSql(file) {
  return readFile(new URL(`../sql/${file}`, import.meta.url), 'utf8');
}

function isBenignError(err) {
  return /already exists|duplicate key/i.test(String(err?.message ?? err));
}

/** The same tolerant, idempotent statement runner db-init.mjs uses. */
async function run(sqlText, file, exec) {
  const { splitSql } = await import('../netlify/functions/lib/sqlsplit.mjs');
  const stmts = splitSql(sqlText);
  let applied = 0;
  let skipped = 0;
  for (const stmt of stmts) {
    try {
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
  return { applied, skipped };
}

const STATE_TABLE = `CREATE TABLE IF NOT EXISTS knowledge.db_state (
  key        TEXT PRIMARY KEY,
  hash       TEXT NOT NULL,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
)`;

async function main() {
  if (!process.env.DATABASE_URL) {
    console.log('[db:auto] DATABASE_URL is not set - skipping database sync (the app builds; API routes will report it).');
    return 0;
  }

  const schemaSql = await loadSql('schema.sql');
  const seedSql = await loadSql('seed.sql');
  const hash = createHash('sha256').update(schemaSql).update('\u0000').update(seedSql).digest('hex');

  const exec = neon(process.env.DATABASE_URL);
  await exec.query(STATE_TABLE);
  const rows = await exec.query('SELECT hash FROM knowledge.db_state WHERE key = $1', ['schema+seed']);
  const stored = rows?.rows?.[0]?.hash ?? null;

  if (!force && stored === hash) {
    console.log('[db:auto] schema.sql + seed.sql unchanged since the last run - nothing to do.');
    return 0;
  }

  console.log(
    stored == null
      ? '[db:auto] fresh database (or first run) - applying schema + seed data...'
      : '[db:auto] schema/seed changed since the last run - applying the new sql...',
  );
  const schema = await run(schemaSql, 'schema.sql', exec);
  const seed = await run(seedSql, 'seed.sql', exec);
  await exec.query(
    'INSERT INTO knowledge.db_state (key, hash, applied_at) VALUES ($1, $2, now()) ON CONFLICT (key) DO UPDATE SET hash = EXCLUDED.hash, applied_at = now()',
    ['schema+seed', hash],
  );
  console.log(
    `[db:auto] done: schema ${schema.applied} applied / ${schema.skipped} already present, seed ${seed.applied} applied / ${seed.skipped} already present.`,
  );
  return 0;
}

try {
  process.exitCode = await main();
} catch (err) {
  const msg = `[db:auto] WARNING: database sync failed: ${String(err?.message ?? err)} - the build continues; run 'npm run db:init' locally to apply it by hand.`;
  if (strict) {
    console.error(msg);
    process.exitCode = 1;
  } else {
    console.warn(msg);
    process.exitCode = 0;
  }
}
