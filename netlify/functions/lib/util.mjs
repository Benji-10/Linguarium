/**
 * Server-side utilities.
 *
 * normalizeTerm mirrors src/shared/tokenizer.mjs (same rules: NFC, trim,
 * optional case folding). It is intentionally kept in one small place here
 * so functions do not need to import browser bundle code; when editing one,
 * edit the other.
 */

import { HttpError } from './http.mjs';

export function normalizeTerm(term, caseFold) {
  let s = String(term ?? '').trim().normalize('NFC');
  if (caseFold) s = s.toLowerCase();
  return s;
}

export const DIMENSIONS = ['recognition', 'recall', 'production'];

export function validDimension(dim) {
  return DIMENSIONS.includes(dim);
}

export function validRating(rating) {
  return Number.isInteger(rating) && rating >= 1 && rating <= 4;
}

/** Parse an ISO timestamp into a Date, throwing a clean 400 on garbage. */
export function parseTimestamp(value, field) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    throw new HttpError(400, 'invalid-field', `Field "${field}" is not a valid timestamp.`);
  }
  return d;
}

/** Sanitize an object to a shallow plain object with string/number/bool/array values. */
export function sanitizeExtra(extra) {
  if (extra == null || typeof extra !== 'object' || Array.isArray(extra)) return {};
  const out = {};
  for (const [k, v] of Object.entries(extra).slice(0, 30)) {
    if (typeof k !== 'string' || k.length > 60) continue;
    if (typeof v === 'string' && v.length <= 2000) out[k] = v.slice(0, 2000);
    else if (typeof v === 'number' && Number.isFinite(v)) out[k] = v;
    else if (typeof v === 'boolean') out[k] = v;
    else if (Array.isArray(v) && v.length <= 50) out[k] = v.filter((x) => typeof x === 'string').slice(0, 50);
  }
  return out;
}

export const PROVENANCES = ['verified', 'community', 'automated', 'ai', 'user', 'user-imported'];
export const DIFFICULTY_MODES = ['comfortable', 'stretch', 'challenge'];
export const GRAMMAR_STAGES = ['encountered', 'recognized', 'understood', 'independent_use'];
