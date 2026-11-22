/**
 * HTTP helpers for Netlify Functions (modern API).
 *
 * Every API response is JSON with Cache-Control: no-store, because most
 * responses contain per-user data and must never be cached by any layer.
 */

export class HttpError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Cache-Control': 'no-store',
      'Content-Type': 'application/json; charset=utf-8',
      ...headers,
    },
  });
}

export function fail(status, code, message) {
  return json({ error: { code, message } }, status);
}

/**
 * Wrap a routes map (method -> handler) into a v2 function default export.
 * HttpErrors become structured responses; anything else is a 500 and is
 * logged server-side only.
 */
export function handler(routes) {
  return async (req, context) => {
    try {
      const fn = routes[req.method];
      if (!fn) {
        return fail(405, 'method-not-allowed', `Method ${req.method} is not supported on this endpoint.`);
      }
      return await fn(req, context);
    } catch (err) {
      if (err instanceof HttpError) {
        return fail(err.status, err.code, err.message);
      }
      console.error('[api]', err);
      return fail(500, 'internal-error', 'The server hit an unexpected error. Please try again.');
    }
  };
}

/** Parse a JSON request body (empty body -> {}). */
export async function body(req) {
  try {
    const text = await req.text();
    if (!text) return {};
    const data = JSON.parse(text);
    if (data == null || typeof data !== 'object') {
      throw new HttpError(400, 'invalid-body', 'Request body must be a JSON object.');
    }
    return data;
  } catch (err) {
    if (err instanceof HttpError) throw err;
    throw new HttpError(400, 'invalid-json', 'Request body is not valid JSON.');
  }
}

/** Read query parameters. */
export function query(req) {
  return Object.fromEntries(new URL(req.url).searchParams.entries());
}

/** Require a non-empty string field. */
export function requireString(obj, field, { max = 500, optional = false } = {}) {
  const v = obj?.[field];
  if (v == null || v === '') {
    if (optional) return null;
    throw new HttpError(400, 'missing-field', `Field "${field}" is required.`);
  }
  if (typeof v !== 'string' || v.length > max) {
    throw new HttpError(400, 'invalid-field', `Field "${field}" must be a string of at most ${max} characters.`);
  }
  return v.trim();
}

/** Clamp helper. */
export function clampNumber(v, lo, hi, fallback) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(hi, Math.max(lo, n));
}
