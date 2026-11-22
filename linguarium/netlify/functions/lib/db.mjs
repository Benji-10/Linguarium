/**
 * Neon PostgreSQL access.
 *
 * The Neon serverless driver runs in HTTP mode, which is designed exactly
 * for per-request serverless functions: no connection pooling state to
 * manage, no WebSockets. The connection string never leaves the server
 * (DATABASE_URL is a Netlify environment variable).
 */

import { neon } from '@neondatabase/serverless';
import { HttpError } from './http.mjs';

let cached = null;

/** The tagged-template query function for this deployment. */
export function sql() {
  if (!cached) {
    const url = process.env.DATABASE_URL;
    if (!url) {
      throw new HttpError(
        503,
        'database-not-configured',
        'DATABASE_URL is not set. Configure it in the Netlify site settings (see README).',
      );
    }
    cached = neon(url);
  }
  return cached;
}

/** Convert a JS object to a JSON string for a ::jsonb cast. */
export function jsonb(value) {
  return JSON.stringify(value ?? {});
}
