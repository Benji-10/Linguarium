/**
 * Identity guard.
 *
 * The authenticated user is ALWAYS resolved server-side from the request's
 * verified Netlify Identity session (the nf_jwt cookie verified by the
 * Netlify runtime / @netlify/identity). A user id sent by the client in a
 * body or query string is never trusted for anything.
 */

import { getUser } from '@netlify/identity';
import { HttpError } from './http.mjs';
import { sql } from './db.mjs';

/** Require a signed-in user; throws 401 otherwise. */
export async function requireUser() {
  const user = await getUser();
  if (!user || !user.id) {
    throw new HttpError(401, 'unauthorized', 'Sign in to use this endpoint.');
  }
  return user;
}

/** Upsert the user row and refresh last_seen. Returns the display name. */
export async function ensureUserRow(user) {
  const name = user.name || user.email?.split('@')[0] || null;
  const rows = await sql()`
    INSERT INTO user_data.users (id, display_name, last_seen)
    VALUES (${user.id}, ${name}, now())
    ON CONFLICT (id) DO UPDATE SET last_seen = now()
    RETURNING display_name`;
  return rows[0]?.display_name ?? name;
}

/** Fetch the tokenizer config, direction and source edition for a code. */
export async function languageFor(code) {
  const rows = await sql()`
    SELECT code, name, direction, tokenizer, source_edition FROM knowledge.languages
    WHERE code = ${code}`;
  return rows[0] ?? null;
}
