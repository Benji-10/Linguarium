/**
 * Theme engine (phase 3).
 *
 * Two independent axes:
 *   - mode: auto / light / dark (as before, `data-theme` on <html>)
 *   - skin: the accent palette (teal / ocean / forest / rose / amber / violet,
 *     `data-skin` on <html>), chosen per device, works with both modes.
 *
 * Both persist in localStorage (UI preference, not learning data). The
 * PWA <meta name="theme-color"> is kept in sync with the active skin.
 *
 * The Netlify badge (the `#nl-badge-frame` iframe Netlify injects into the
 * served HTML when the site badge is enabled) is hidden defensively by CSS
 * in styles.css AND removed at runtime here if present - plus a MutationObserver
 * that removes it if it is injected later. It is also possible (and cleaner)
 * to disable the badge in the Netlify UI; see the README.
 */

export const SKINS = [
  { id: 'teal', label: 'Teal', light: '#0f766e', dark: '#4cc4b7' },
  { id: 'ocean', label: 'Ocean', light: '#1d5fbf', dark: '#7aa7f0' },
  { id: 'forest', label: 'Forest', light: '#2f7d3f', dark: '#6fcf8f' },
  { id: 'rose', label: 'Rose', light: '#c2185b', dark: '#f48fb1' },
  { id: 'amber', label: 'Amber', light: '#b45309', dark: '#e5a04a' },
  { id: 'violet', label: 'Violet', light: '#6d28d9', dark: '#a78bfa' },
];

const MODE_KEY = 'linguarium.theme';
const SKIN_KEY = 'linguarium.skin';

export function currentMode() {
  return localStorage.getItem(MODE_KEY) || 'auto';
}

export function currentSkin() {
  const saved = localStorage.getItem(SKIN_KEY) || 'teal';
  return SKINS.some((s) => s.id === saved) ? saved : 'teal';
}

/** The mode that is actually on screen right now ('light' | 'dark'). */
export function effectiveMode(mode = currentMode()) {
  if (mode === 'light' || mode === 'dark') return mode;
  return typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
}

function updateMetaColor(skin, mode) {
  const meta = document.querySelector('meta[name="theme-color"]');
  if (!meta) return;
  const def = SKINS.find((s) => s.id === skin) ?? SKINS[0];
  meta.setAttribute('content', mode === 'dark' ? def.dark : def.light);
}

/** Apply the current (or given) mode + skin to the document. */
export function applyTheme({ mode = currentMode(), skin = currentSkin() } = {}) {
  document.documentElement.dataset.theme = mode;
  document.documentElement.dataset.skin = skin;
  updateMetaColor(skin, effectiveMode(mode));
}

/** Set the mode explicitly; persists and applies. */
export function setMode(mode) {
  localStorage.setItem(MODE_KEY, mode);
  applyTheme({ mode });
}

/** Set the skin; persists and applies. */
export function setSkin(skin) {
  const id = SKINS.some((s) => s.id === skin) ? skin : 'teal';
  localStorage.setItem(SKIN_KEY, id);
  applyTheme({ skin: id });
}

/** Quick toggle used by the topbar button: flips light <-> dark. */
export function toggleMode() {
  const next = effectiveMode() === 'dark' ? 'light' : 'dark';
  setMode(next);
  return next;
}

/**
 * Follow the system when in auto mode, and hide the injected Netlify badge
 * frame if one appears. Call once at boot.
 */
export function initTheme() {
  applyTheme();
  if (typeof matchMedia === 'function') {
    try {
      matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
        if (currentMode() === 'auto') applyTheme();
      });
    } catch {
      /* older browsers: no listener */
    }
  }
  removeNetlifyBadge();
  const bodyObserver = new MutationObserver(removeNetlifyBadge);
  bodyObserver.observe(document.body, { childList: true, subtree: false });
  const htmlObserver = new MutationObserver(removeNetlifyBadge);
  htmlObserver.observe(document.documentElement, { childList: true, subtree: false });
}

/** Remove the "powered by Netlify" badge iframe if the host injected one. */
export function removeNetlifyBadge() {
  for (const el of document.querySelectorAll('#nl-badge-frame, #netlify-badge, .netlify-badge-frame')) {
    el.remove();
  }
}
