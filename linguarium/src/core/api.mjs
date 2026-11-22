/**
 * API client.
 *
 * All calls are same-origin: the authenticated Netlify Identity session
 * cookie (nf_jwt) rides along automatically and the server verifies it.
 * User ids are never sent - the server derives them from the session.
 */

export class ApiError extends Error {
  constructor(status, code, message) {
    super(message || 'Request failed.');
    this.status = status;
    this.code = code || 'error';
  }
}

/** True when fetch failed at the network level (offline / DNS). */
export function isNetworkError(err) {
  return err instanceof TypeError;
}

export async function api(path, { method = 'GET', body, params } = {}) {
  let url = path;
  if (params) {
    const search = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null && v !== '') search.set(k, String(v));
    }
    const qs = search.toString();
    if (qs) url += (url.includes('?') ? '&' : '?') + qs;
  }

  let res;
  try {
    res = await fetch(url, {
      method,
      headers: body !== undefined ? { 'Content-Type': 'application/json' } : {},
      body: body !== undefined ? JSON.stringify(body) : undefined,
      credentials: 'same-origin',
    });
  } catch (err) {
    throw new ApiError(0, 'network', 'You appear to be offline. The action was not performed.');
  }

  let data = {};
  try {
    data = await res.json();
  } catch {
    /* empty body */
  }

  if (!res.ok) {
    throw new ApiError(res.status, data?.error?.code ?? 'error', data?.error?.message ?? `Request failed (${res.status}).`);
  }
  return data;
}

/** Download helper for /api/export (browser save dialog). */
export async function downloadExport() {
  const res = await fetch('/api/export', { credentials: 'same-origin' });
  if (!res.ok) {
    throw new ApiError(res.status, 'export-failed', 'Could not build the backup file.');
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `linguarium-backup-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  return true;
}
