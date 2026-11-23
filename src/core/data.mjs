/**
 * Data loaders: fetch from the API, cache into IndexedDB, update the store.
 * Offline: fall back to the cache so the app keeps working.
 */

import { api } from './api.mjs';
import {
  cacheEntries,
  getCachedEntries,
  cacheTexts,
  getCachedTexts,
  cacheCollections,
  getCachedCollections,
  putKV,
  getKV,
} from './idb.mjs';
import { setState, getState } from './store.mjs';

export async function loadLanguages() {
  try {
    const { languages } = await api('/api/languages');
    setState({ languages });
    await putKV('languages', languages);
    return languages;
  } catch (err) {
    const cached = await kvGet('languages', []);
    if (cached.length > 0) setState({ languages: cached });
    return cached;
  }
}

function kvGet(key, fallback) {
  return import('./idb.mjs').then((m) => m.getKV(key, fallback));
}

// ------------------------------------------------------------------
// Segmentation dictionary (Japanese / Chinese / other no-space scripts).
// The lexicon part is fetched once per language per session and cached in
// IndexedDB; the learner's own vocabulary (state.entries) is merged in at
// build time, so segmentation improves as they learn.
// ------------------------------------------------------------------

const lexiconDictCache = new Map(); // language -> Promise<rows>

async function fetchLexiconDictionary(language) {
  if (lexiconDictCache.has(language)) return lexiconDictCache.get(language);
  const promise = (async () => {
    try {
      const data = await api('/api/lexicon', { params: { language_code: language, mode: 'dictionary' } });
      const rows = data.dictionary ?? [];
      putKV(`segdict:${language}`, rows).catch(() => {});
      return rows;
    } catch (err) {
      const cached = await getKV(`segdict:${language}`, []);
      return cached ?? [];
    }
  })();
  lexiconDictCache.set(language, promise);
  return promise;
}

/**
 * Build the segmentation dictionary for one language:
 * { dictionary: Set<string>, readings: Map<term, reading> }.
 * Ruby bases and other extra terms are merged by the caller.
 */
export async function segmentDictionaryFor(language, extraTerms = []) {
  if (!language) return { dictionary: new Set(), readings: new Map() };
  const [rows, entries] = await Promise.all([fetchLexiconDictionary(language), Promise.resolve(getState().entries)]);
  const dictionary = new Set();
  const readings = new Map();
  for (const row of rows ?? []) {
    if (row?.term) {
      dictionary.add(row.term);
      if (row.reading) readings.set(row.term, row.reading);
    }
  }
  for (const e of entries ?? []) {
    if (e?.language_code === language && e?.term) {
      dictionary.add(e.term);
      if (e?.normalized) dictionary.add(e.normalized);
      if (e?.reading) readings.set(e.term, e.reading);
    }
  }
  for (const t of extraTerms ?? []) {
    if (typeof t === 'string' && t) dictionary.add(t);
  }
  return { dictionary, readings };
}

export async function loadProfiles() {
  try {
    const { profiles } = await api('/api/profiles');
    setState({ profiles });
    return profiles;
  } catch (err) {
    return getState().profiles;
  }
}

export async function loadAiStatus() {
  try {
    const status = await api('/api/ai-status');
    setState({ aiStatus: status });
    return status;
  } catch (err) {
    return getState().aiStatus;
  }
}

export async function loadEntries() {
  try {
    const { entries } = await api('/api/entries', { params: { limit: 500 } });
    setState({ entries });
    await cacheEntries(entries);
    return entries;
  } catch (err) {
    const cached = await getCachedEntries();
    setState({ entries: cached });
    return cached;
  }
}

export async function loadTexts() {
  try {
    const data = await api('/api/texts');
    setState({ texts: data.texts ?? [], sharedTexts: data.shared ?? [] });
    await cacheTexts({ texts: data.texts ?? [], shared: data.shared ?? [] });
    return data;
  } catch (err) {
    const cached = await getCachedTexts();
    const texts = cached.filter((t) => t.kind === 'user').map(({ key, kind, ...t }) => t);
    const shared = cached.filter((t) => t.kind === 'shared').map(({ key, kind, ...t }) => t);
    setState({ texts, sharedTexts: shared });
    return { texts, shared };
  }
}

export async function loadCollections() {
  try {
    const { collections } = await api('/api/collections');
    setState({ collections });
    await cacheCollections(collections);
    return collections;
  } catch (err) {
    const cached = await getCachedCollections();
    setState({ collections: cached });
    return cached;
  }
}

export async function loadProgress() {
  try {
    const progress = await api('/api/progress');
    setState({ progress });
    await putKV('progress', progress);
    return progress;
  } catch (err) {
    const cached = await kvGet('progress', null);
    if (cached) setState({ progress: cached });
    return cached;
  }
}

export async function refreshAll() {
  await Promise.all([loadLanguages(), loadProfiles(), loadAiStatus()]);
  await Promise.all([loadEntries(), loadTexts(), loadCollections(), loadProgress()]);
}

/** Today's due counts summed per dimension for a language (or all). */
export function dueSummary(progress, language = null) {
  const rows = (progress?.due ?? []).filter((r) => !language || r.language === language);
  const out = { recognition: 0, recall: 0, production: 0 };
  for (const r of rows) out[r.dimension] = (out[r.dimension] ?? 0) + r.count;
  out.total = rows.reduce((acc, r) => acc + r.count, 0);
  return out;
}

/** Consecutive review days ending today (or yesterday, if you have not reviewed yet today). */
export function computeStreak(reviewDays) {
  if (!Array.isArray(reviewDays) || reviewDays.length === 0) return 0;
  const days = new Set(reviewDays.map((r) => String(r.day).slice(0, 10)));
  const today = new Date();
  const iso = (d) => d.toISOString().slice(0, 10);
  let streak = 0;
  let cursor = new Date(today);
  if (!days.has(iso(cursor))) {
    cursor.setDate(cursor.getDate() - 1);
  }
  while (days.has(iso(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

/** Status distribution over cached entries (uses the shared status model). */
export async function statusDistribution(language = null) {
  const { deriveStatus } = await import('../shared/status.mjs');
  const entries = getState().entries.filter((e) => !language || e.language_code === language);
  const counts = {
    unencountered: 0,
    learning: 0,
    recognized: 0,
    reliably_recalled: 0,
    mastered: 0,
    due: 0,
  };
  for (const e of entries) {
    const { status } = deriveStatus(e, e.memories ?? {}, { now: Date.now() });
    counts[status] = (counts[status] ?? 0) + 1;
  }
  return { counts, total: entries.length };
}
