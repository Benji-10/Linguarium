/**
 * GET /api/grammar?language=xx - grammar structures with the user's stage
 * PUT /api/grammar            - set the user's stage for a structure
 *
 * Grammar is a first-class citizen: structures are stored independently of
 * vocabulary and progress through four layers:
 *   encountered -> recognized -> understood -> independent use
 *
 * Phase 1 provides the structures and progression tracking; practice
 * generation on top of them arrives in phase 2 (see docs/ROADMAP.md).
 */

import { handler, json, body, query, requireString, HttpError } from './lib/http.mjs';
import { requireUser, ensureUserRow } from './lib/identity.mjs';
import { sql } from './lib/db.mjs';
import { GRAMMAR_STAGES } from './lib/util.mjs';

function parseExamples(v) {
  if (v == null) return [];
  if (typeof v === 'string') {
    try {
      return JSON.parse(v);
    } catch {
      return [];
    }
  }
  return Array.isArray(v) ? v : [];
}

export default handler({
  GET: async (req) => {
    const user = await requireUser();
    const q = query(req);
    const language = q.language ? String(q.language).slice(0, 16) : null;
    const rows = await sql()`
      SELECT g.id, g.language_code, g.name, g.summary, g.explanation, g.examples, g.provenance, g.source_ref,
             p.stage
      FROM knowledge.grammar_structures g
      LEFT JOIN user_data.grammar_progress p ON p.structure_id = g.id AND p.user_id = ${user.id}
      WHERE (${language === null} OR g.language_code = ${language})
      ORDER BY g.language_code, g.name`;
    return json({
      structures: rows.map((r) => ({ ...r, examples: parseExamples(r.examples) })),
    });
  },

  PUT: async (req) => {
    const user = await requireUser();
    await ensureUserRow(user);
    const data = await body(req);
    const structureId = requireString(data, 'structure_id', { max: 64 });
    const stage = requireString(data, 'stage', { max: 32 });
    if (!GRAMMAR_STAGES.includes(stage)) {
      throw new HttpError(400, 'invalid-stage', `Stage must be one of: ${GRAMMAR_STAGES.join(', ')}.`);
    }
    const exists = await sql()`
      SELECT id FROM knowledge.grammar_structures WHERE id = ${structureId}`;
    if (exists.length === 0) throw new HttpError(404, 'not-found', 'Grammar structure not found.');

    await sql()`
      INSERT INTO user_data.grammar_progress (user_id, structure_id, stage, updated_at)
      VALUES (${user.id}, ${structureId}, ${stage}, now())
      ON CONFLICT (user_id, structure_id) DO UPDATE SET
        stage = EXCLUDED.stage,
        updated_at = now()`;
    return json({ saved: true });
  },
});

export const config = { path: '/api/grammar' };
