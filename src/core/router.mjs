/**
 * Hash-based router. No server rewrites needed, which keeps the static
 * deployment simple and works identically offline (PWA).
 */

const routes = [];
let currentCleanup = null;

export function route(pattern, view, options = {}) {
  // Pattern like '#/read/:kind/:id' -> matcher with named segments.
  // The leading '#' is stripped so it matches the parsed location path.
  const segments = pattern.replace(/^#/, '').split('/').filter(Boolean);
  routes.push({ pattern, segments, view, options });
}

function match(hash) {
  const path = (hash || '#/').replace(/^#/, '');
  const parts = path.split('/').filter(Boolean);
  for (const r of routes) {
    if (r.segments.length !== parts.length) continue;
    const params = {};
    let ok = true;
    for (let i = 0; i < r.segments.length; i++) {
      const seg = r.segments[i];
      if (seg.startsWith(':')) {
        params[seg.slice(1)] = decodeURIComponent(parts[i]);
      } else if (seg !== parts[i]) {
        ok = false;
        break;
      }
    }
    if (ok) return { route: r, params };
  }
  return null;
}

export function navigate(hash) {
  if (location.hash === hash) {
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  } else {
    location.hash = hash;
  }
}

/** Re-render the current route from scratch (used when UI state that a view
 * depends on changes, e.g. the active language switch in the sidebar). */
export function rerender() {
  return render();
}

async function render() {
  const { getState } = await import('./store.mjs');
  const state = getState();
  const found = match(location.hash);
  const target = found ?? match('#/');
  const container = document.getElementById('view');
  if (!container) return;

  if (currentCleanup) {
    try {
      currentCleanup();
    } catch (err) {
      console.warn('[router] cleanup failed', err);
    }
    currentCleanup = null;
  }

  if (!target) {
    container.innerHTML = '<section class="panel"><h1>Page not found</h1><p>That page does not exist.</p></section>';
    return;
  }

  if (!state.user && !target.route.options.public) {
    const { renderAuth } = await import('../views/auth.mjs');
    currentCleanup = renderAuth(container) ?? null;
    return;
  }

  container.className = `view view-${target.route.segments[0]?.replace(':', '') || 'home'}`;
  try {
    currentCleanup = (await target.route.view(container, target.params)) ?? null;
  } catch (err) {
    console.error('[router] view failed', err);
    container.innerHTML =
      '<section class="panel error-panel"><h2>Something went wrong</h2>' +
      `<p class="muted">${escapeHtml(err?.message ?? 'The view could not be rendered.')}</p>` +
      '<button class="btn" onclick="location.hash=\'#/\'">Go to the dashboard</button></section>';
  }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function startRouter() {
  window.addEventListener('hashchange', render);
  render();
}
