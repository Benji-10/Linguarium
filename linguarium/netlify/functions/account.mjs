/**
 * DELETE /api/account?mode=data|full - delete the user's data.
 *
 * mode=data - purge every user_data row (learning data, history, backups).
 *             The login itself stays, so the account is empty but usable.
 * mode=full - also delete the Netlify Identity account via the admin API.
 *
 * Confirmation is required: the body must contain { "confirm": "DELETE" }.
 * See docs/PRIVACY.md for the data lifecycle.
 */

import { handler, json, body, query, HttpError } from './lib/http.mjs';
import { requireUser } from './lib/identity.mjs';
import { sql } from './lib/db.mjs';

export default handler({
  DELETE: async (req) => {
    const user = await requireUser();
    const q = query(req);
    const mode = q.mode === 'full' ? 'full' : 'data';

    const data = await body(req);
    if (data.confirm !== 'DELETE') {
      throw new HttpError(400, 'confirmation-required', 'Send { "confirm": "DELETE" } to confirm deletion.');
    }
    const uid = user.id;

    const counts = {};
    async function purge(name, statement) {
      const rows = await statement();
      counts[name] = rows.length;
    }

    await purge('rate_limits', () => sql()`DELETE FROM user_data.rate_limits WHERE user_id = ${uid} RETURNING user_id`);
    await purge('review_log', () => sql()`DELETE FROM user_data.review_log WHERE user_id = ${uid} RETURNING id`);
    await purge('fsrs_memory', () => sql()`DELETE FROM user_data.fsrs_memory WHERE user_id = ${uid} RETURNING id`);
    await purge('encounters', () => sql()`DELETE FROM user_data.encounters WHERE user_id = ${uid} RETURNING id`);
    await purge('reading_progress', () => sql()`DELETE FROM user_data.reading_progress WHERE user_id = ${uid} RETURNING text_id`);
    await purge('grammar_progress', () => sql()`DELETE FROM user_data.grammar_progress WHERE user_id = ${uid} RETURNING structure_id`);
    await purge('collection_items', () => sql()`
      DELETE FROM user_data.collection_items i USING user_data.collections c
      WHERE i.collection_id = c.id AND c.user_id = ${uid} RETURNING i.id`);
    await purge('collections', () => sql()`DELETE FROM user_data.collections WHERE user_id = ${uid} RETURNING id`);
    await purge('entries', () => sql()`DELETE FROM user_data.vocab_entries WHERE user_id = ${uid} RETURNING id`);
    await purge('texts', () => sql()`DELETE FROM user_data.texts WHERE user_id = ${uid} RETURNING id`);
    await purge('profiles', () => sql()`DELETE FROM user_data.language_profiles WHERE user_id = ${uid} RETURNING id`);
    await purge('users', () => sql()`DELETE FROM user_data.users WHERE id = ${uid} RETURNING id`);

    let identityDeleted = false;
    if (mode === 'full') {
      try {
        const { admin } = await import('@netlify/identity');
        await admin.deleteUser(user.id);
        identityDeleted = true;
      } catch (err) {
        console.error('[account] identity deletion failed', err);
      }
    }

    return json({ mode, purged: counts, identity_deleted: identityDeleted });
  },
});

export const config = { path: '/api/account' };
