/**
 * Tiny observable app store (state container).
 * The active language is UI state (not learning data) and lives in
 * localStorage so it survives reloads offline.
 */

const LS_KEY = 'linguarium.activeLanguage';

const state = {
  user: null,
  recoveryPending: false,
  authEvent: null,
  booting: true,
  languages: [],
  profiles: [],
  activeLanguage: null,
  aiStatus: { available: false, model: null, daily_limit: 0, used_today: 0 },
  entries: [],
  texts: [],
  sharedTexts: [],
  collections: [],
  progress: null,
  queueCount: 0,
  online: typeof navigator !== 'undefined' ? navigator.onLine : true,
  syncing: false,
  lastSync: null,
  theme: localStorage.getItem('linguarium.theme') || 'auto',
};

const listeners = new Set();

export function getState() {
  return state;
}

export function setState(patch) {
  Object.assign(state, patch);
  for (const fn of listeners) {
    try {
      fn(state);
    } catch (err) {
      console.error('[store listener]', err);
    }
  }
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function setActiveLanguage(code) {
  localStorage.setItem(LS_KEY, code);
  // Language-scoped session caches (texts list) become stale the moment the
  // active language changes: drop them so the next view render reloads.
  setState({ activeLanguage: code, textsLoaded: false });
}

export function restoreActiveLanguage() {
  const saved = localStorage.getItem(LS_KEY) || null;
  if (saved && saved !== state.activeLanguage) {
    setState({ activeLanguage: saved });
  }
  return state.activeLanguage;
}

/** Tokenizer config for the active (or given) language. The language code
 *  rides along as `code` so char-level languages (ja, zh, th...) segment
 *  with the right ICU dictionary via Intl.Segmenter; every other consumer
 *  of the config ignores the extra key. */
export function tokenizerFor(languages, code) {
  const lang = (languages ?? []).find((l) => l.code === code);
  return { ...(lang?.tokenizer ?? {}), code };
}

export function languageName(languages, code) {
  const lang = (languages ?? []).find((l) => l.code === code);
  return lang?.name ?? code;
}

export function isRightToLeft(languages, code) {
  const lang = (languages ?? []).find((l) => l.code === code);
  return lang?.direction === 'rtl';
}
