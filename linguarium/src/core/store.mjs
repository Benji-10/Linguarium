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
  setState({ activeLanguage: code });
}

export function restoreActiveLanguage() {
  const saved = localStorage.getItem(LS_KEY) || null;
  if (saved && saved !== state.activeLanguage) {
    setState({ activeLanguage: saved });
  }
  return state.activeLanguage;
}

/** Tokenizer config for the active (or given) language. */
export function tokenizerFor(languages, code) {
  const lang = (languages ?? []).find((l) => l.code === code);
  return lang?.tokenizer ?? {};
}

export function languageName(languages, code) {
  const lang = (languages ?? []).find((l) => l.code === code);
  return lang?.name ?? code;
}

export function isRightToLeft(languages, code) {
  const lang = (languages ?? []).find((l) => l.code === code);
  return lang?.direction === 'rtl';
}
