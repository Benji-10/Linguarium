/**
 * Community content pipeline (phase 3).
 *
 *   GET  /api/contribute               - the user's own submissions + status
 *   GET  /api/contribute?pending=1     - (admin, x-admin-key) the pending queue
 *   POST /api/contribute               - submit a text / grammar structure /
 *                                        lexicon entry for moderation
 *   PUT  /api/contribute               - (admin, x-admin-key) approve or reject
 *
 * Nothing a user submits reaches the shared knowledge tables directly:
 * every submission lands in knowledge.contribution_queue with mandatory
 * provenance fields (license, source) and waits for moderation. Approval
 * inserts into knowledge.shared_texts / grammar_structures / lexicon with
 * provenance 'community' - never 'verified' - exactly like the seed data.
 *
 * Moderation is keyed by the ADMIN_KEY environment variable (same guard as
 * /api/admin-seed): without the key the moderation routes answer 404, and
 * the key is compared in constant time.
 */

import { createHash, timingSafeEqual } from 'node:crypto';
import { handler, json, body, query, requireString, HttpError } from './lib/http.mjs';
import { requireUser, ensureUserRow } from './lib/identity.mjs';
import { sql } from './lib/db.mjs';
import { consumeDailyQuota } from './lib/ratelimit.mjs';
import { validateContribution } from './lib/contribute-validate.mjs';

const DAILY_SUBMIT_LIMIT = 20;

function authorizeAdmin(req) {
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

function shapeRow(r) {
  return {
    id: r.id,
    kind: r.kind,
    language_code: r.language_code,
    title: r.title,
    payload: typeof r.payload === 'string' ? JSON.parse(r.payload) : r.payload,
    submitted_at: r.submitted_at,
    status: r.status,
    moderated_at: r.moderated_at,
    moderator_note: r.moderator_note,
    license: r.license,
    source_url: r.source_url,
  };
}

/** Insert an approved contribution into its shared knowledge table (idempotently). */
async function applyApproved(c) {
  const p = c.payload ?? {};
  if (c.kind === 'text') {
    await sql()`
      INSERT INTO knowledge.shared_texts (language_code, title, body, author, source_url, license, adaptation_note, provenance, source_ref, topic)
      VALUES (${c.language_code}, ${c.title ?? p.title}, ${p.body}, ${p.author ?? null}, ${c.source_url ?? null}, ${c.license},
              ${p.adaptation_note ?? null}, 'community',
              ${'Community contribution, moderated. Submitted via /api/contribute; check the source before relying on it.'},
              ${p.topic ?? null})
      ON CONFLICT (language_code, title) DO NOTHING`;
  } else if (c.kind === 'grammar') {
    await sql()`
      INSERT INTO knowledge.grammar_structures (language_code, name, summary, explanation, examples, provenance, source_ref)
      VALUES (${c.language_code}, ${p.name}, ${p.summary ?? null}, ${p.explanation}, ${JSON.stringify(p.examples ?? [])}::jsonb,
              'community',
              ${'Community contribution, moderated. Submitted via /api/contribute; verify before relying on it.'})
      ON CONFLICT (language_code, name) DO NOTHING`;
  } else if (c.kind === 'lexicon') {
    await sql()`
      INSERT INTO knowledge.lexicon (language_code, term, reading, part_of_speech, definition, gloss_language, provenance, source_url, license, source_ref)
      VALUES (${c.language_code}, ${p.term}, ${p.reading ?? null}, ${p.part_of_speech ?? null}, ${p.definition}, ${p.gloss_language ?? 'en'},
              'community', ${c.source_url ?? null}, ${c.license},
              ${'Community contribution, moderated. Verify before relying on it.'})
      ON CONFLICT (language_code, term) DO NOTHING`;
  } else {
    throw new HttpError(400, 'invalid-kind', `Unknown contribution kind "${c.kind}".`);
  }
}

export default handler({
  GET: async (req) => {
    const q = query(req);

    // Admin view: the pending queue (with payloads).
    if (q.pending !== undefined) {
      await authorizeAdmin(req);
      const status = ['pending', 'approved', 'rejected'].includes(String(q.pending)) ? String(q.pending) : 'pending';
      const rows = await sql()`
        SELECT * FROM knowledge.contribution_queue
        WHERE status = ${status}
        ORDER BY submitted_at ASC
        LIMIT 200`;
      return json({ contributions: rows.map(shapeRow) });
    }

    const user = await requireUser();
    const rows = await sql()`
      SELECT * FROM knowledge.contribution_queue
      WHERE submitted_by = ${user.id}
      ORDER BY submitted_at DESC
      LIMIT 100`;
    return json({ contributions: rows.map(shapeRow) });
  },

  POST: async (req) => {
    const user = await requireUser();
    await ensureUserRow(user);
    const data = await body(req);

    const result = validateContribution(data);
    if (!result.ok) {
      throw new HttpError(400, 'invalid-contribution', result.errors.join(' '));
    }

    // The language must exist (custom languages only for their creator).
    const langRows = await sql()`
      SELECT code FROM knowledge.languages
      WHERE code = ${result.language_code} AND (created_by IS NULL OR created_by = ${user.id})`;
    if (langRows.length === 0) {
      throw new HttpError(404, 'language-not-found', 'Unknown language code.');
    }

    const used = await consumeDailyQuota(user.id, 'contribute');
    if (used > DAILY_SUBMIT_LIMIT) {
      throw new HttpError(
        429,
        'rate-limited',
        `Daily contribution limit reached (${DAILY_SUBMIT_LIMIT}). The limit resets tomorrow.`,
      );
    }

    const rows = await sql()`
      INSERT INTO knowledge.contribution_queue
        (kind, language_code, title, payload, submitted_by, license, source_url)
      VALUES
        (${result.kind}, ${result.language_code}, ${result.title}, ${JSON.stringify(result.payload)}::jsonb,
         ${user.id}, ${result.license}, ${result.source_url})
      RETURNING *`;
    return json(
      {
        contribution: shapeRow(rows[0]),
        note: 'Submitted for moderation. It appears in the shared library only after approval, and it keeps your name out of the shared tables (privacy: only the submission row references your id).',
      },
      201,
    );
  },

  PUT: async (req) => {
    await authorizeAdmin(req);
    const data = await body(req);
    const id = requireString(data, 'id', { max: 64 });
    const action = requireString(data, 'action', { max: 12 });
    if (!['approve', 'reject'].includes(action)) {
      throw new HttpError(400, 'invalid-field', 'Field "action" must be "approve" or "reject".');
    }
    const note = requireString(data, 'note', { max: 1000, optional: true });

    const rows = await sql()`
      SELECT * FROM knowledge.contribution_queue WHERE id = ${id} AND status = 'pending'`;
    if (rows.length === 0) {
      throw new HttpError(404, 'not-found', 'No pending contribution with that id.');
    }
    const c = shapeRow(rows[0]);

    if (action === 'approve') {
      await applyApproved(c);
    }

    await sql()`
      UPDATE knowledge.contribution_queue SET
        status = ${action === 'approve' ? 'approved' : 'rejected'},
        moderated_at = now(),
        moderator_note = ${note}
      WHERE id = ${id}`;

    return json({
      moderated: true,
      action,
      id,
      note: note ?? null,
      applied: action === 'approve',
    });
  },
});

export const config = { path: '/api/contribute' };
