/**
 * POST /api/admin-seed - populate the site's database without local tooling.
 * GET  /api/admin-seed - a short, human-readable usage description.
 *
 * Runs sql/schema.sql followed by sql/seed.sql (embedded into this function's
 * bundle at build time by scripts/build.mjs) against the Neon database. All
 * statements are idempotent (IF NOT EXISTS / ON CONFLICT DO NOTHING), so this
 * endpoint is safe to call repeatedly - it never duplicates rows and never
 * touches user data (everything it creates lives in the `knowledge` schema,
 * plus the empty `user_data` tables).
 *
 * Guarded by the ADMIN_KEY environment variable (a long random string set in
 * the Netlify UI; see README, "Populate the database"). The request must
 * carry it in the "x-admin-key" header, compared in constant time. If
 * ADMIN_KEY is not configured the endpoint answers 404 exactly like a route
 * that does not exist.
 *
 *   curl -X POST https://<your-site>.netlify.app/api/admin-seed \
 *        -H "x-admin-key: $ADMIN_KEY"
 */

import { createHash, timingSafeEqual } from 'node:crypto';
import { handler, json, HttpError } from './lib/http.mjs';
import { sql } from './lib/db.mjs';
import { splitSql } from './lib/sqlsplit.mjs';
import { SCHEMA_SQL, SEED_SQL } from './lib/seed-bundle.mjs';

function authorize(req) {
  const expected = process.env.ADMIN_KEY ?? '';
  if (!expected) {
    throw new HttpError(404, 'not-found', 'Not found.');
  }
  const given = req.headers.get('x-admin-key') ?? '';
  const digestGiven = createHash('sha256').update(String(given)).digest();
  const digestExpected = createHash('sha256').update(String(expected)).digest();
  if (!timingSafeEqual(digestGiven, digestExpected)) {
    throw new HttpError(401, 'invalid-key', 'Invalid admin key.');
  }
}

const isBenign = (err) => /already exists|duplicate key/i.test(String(err?.message ?? err));

async function runFile(sqlText, file) {
  const stmts = splitSql(sqlText);
  let applied = 0;
  let skipped = 0;
  let mode = 'transaction';

  try {
    // Fast path: the whole file as one atomic, single-round-trip transaction.
    await sql().transaction((txn) => stmts.map((s) => txn.query(s)));
    applied = stmts.length;
  } catch (err) {
    if (err instanceof HttpError) throw err; // e.g. database-not-configured (503)
    if (!isBenign(err)) {
      throw new HttpError(
        500,
        'seed-failed',
        `Populating failed in ${file}: ${String(err?.message ?? err).slice(0, 300)}`,
      );
    }
    // A benign "already exists" means the database is in a state the
    // IF NOT EXISTS guards did not cover (e.g. an older schema version).
    // Fall back to statement-by-statement execution: harmless statements
    // are skipped, the first real problem is reported precisely.
    mode = 'sequential';
    applied = 0;
    for (const stmt of stmts) {
      try {
        await sql().query(stmt);
        applied += 1;
      } catch (err2) {
        if (err2 instanceof HttpError) throw err2;
        if (isBenign(err2)) {
          skipped += 1;
        } else {
          throw new HttpError(
            500,
            'seed-failed',
            `Populating failed in ${file}: ${String(err2?.message ?? err2).slice(0, 300)}`,
          );
        }
      }
    }
  }
  return { file, statements: stmts.length, applied, skipped, mode };
}

export default handler({
  GET: async (req) => {
    await authorize(req);
    return json({
      endpoint: 'admin-seed',
      usage: 'POST this endpoint with an "x-admin-key" header to create the schema and load the seed data.',
      note: 'Idempotent: safe to call repeatedly; never duplicates rows or touches user data.',
    });
  },
  POST: async (req) => {
    await authorize(req);
    const schema = await runFile(SCHEMA_SQL, 'schema.sql');
    const seed = await runFile(SEED_SQL, 'seed.sql');
    return json({ seeded: true, schema, seed });
  },
});

export const config = { path: '/api/admin-seed' };
