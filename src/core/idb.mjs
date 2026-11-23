/**
 * IndexedDB: the offline data layer.
 *
 * The app is offline-first: entries, FSRS states, texts, collections and
 * the review queue are cached locally so reading, reviewing and practicing
 * work without a network. A queue accumulates review events and edits made
 * offline and flushes through /api/sync (never overwriting learning
 * progress - see netlify/functions/sync.mjs for the rules).
 */

const DB_NAME = 'linguarium';
const DB_VERSION = 1;
let dbPromise = null;

function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv');
      if (!db.objectStoreNames.contains('entries')) {
        const s = db.createObjectStore('entries', { keyPath: 'id' });
        s.createIndex('language', 'language_code', { unique: false });
      }
      if (!db.objectStoreNames.contains('texts')) {
        const s = db.createObjectStore('texts', { keyPath: 'key' });
        s.createIndex('language', 'language_code', { unique: false });
      }
      if (!db.objectStoreNames.contains('collections')) db.createObjectStore('collections', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('collectionItems')) {
        const s = db.createObjectStore('collectionItems', { keyPath: 'id' });
        s.createIndex('collection', 'collection_id', { unique: false });
      }
      if (!db.objectStoreNames.contains('enrichments')) db.createObjectStore('enrichments', { keyPath: 'key' });
      if (!db.objectStoreNames.contains('queue')) {
        db.createObjectStore('queue', { keyPath: 'id', autoIncrement: true });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB unavailable'));
  });
  return dbPromise;
}

function tx(store, mode, fn) {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const t = db.transaction(store, mode);
        const s = t.objectStore(store);
        const out = fn(s);
        t.oncomplete = () => resolve(out.result ?? out);
        t.onerror = () => reject(t.error);
      }),
  );
}

async function safe(fn, fallback = null) {
  try {
    return await fn();
  } catch (err) {
    console.warn('[idb] operation failed (private mode?)', err);
    return fallback;
  }
}

// ---------------------------------------------------------------- kv

export async function putKV(key, value) {
  return safe(() => tx('kv', 'readwrite', (s) => s.put(value, key)));
}

export async function getKV(key, fallback = null) {
  return safe(
    () =>
      new Promise(async (resolve) => {
        const db = await openDb();
        const t = db.transaction('kv', 'readonly');
        const req = t.objectStore('kv').get(key);
        req.onsuccess = () => resolve(req.result ?? fallback);
        req.onerror = () => resolve(fallback);
      }),
    fallback,
  );
}

// ---------------------------------------------------------------- entries

export async function cacheEntries(entries) {
  return safe(async () => {
    const db = await openDb();
    const t = db.transaction('entries', 'readwrite');
    const s = t.objectStore('entries');
    for (const e of entries) s.put(e);
    return entries.length;
  });
}

export async function getCachedEntries(language = null) {
  return safe(
    () =>
      new Promise(async (resolve) => {
        const db = await openDb();
        const t = db.transaction('entries', 'readonly');
        const s = t.objectStore('entries');
        const req = language ? s.index('language').getAll(language) : s.getAll();
        req.onsuccess = () => resolve(req.result ?? []);
        req.onerror = () => resolve([]);
      }),
    [],
  );
}

export async function upsertCachedEntry(entry) {
  return safe(async () => {
    const db = await openDb();
    const t = db.transaction('entries', 'readwrite');
    t.objectStore('entries').put(entry);
  });
}

// ---------------------------------------------------------------- texts

/** Cache texts. User texts keyed by id; shared texts by "shared:<id>". */
export async function cacheTexts({ texts = [], shared = [] }) {
  return safe(async () => {
    const db = await openDb();
    const t = db.transaction('texts', 'readwrite');
    const s = t.objectStore('texts');
    for (const item of texts) s.put({ ...item, kind: 'user', key: item.id });
    for (const item of shared) s.put({ ...item, kind: 'shared', key: `shared:${item.id}` });
  });
}

export async function getCachedTexts() {
  return safe(
    () =>
      new Promise(async (resolve) => {
        const db = await openDb();
        const t = db.transaction('texts', 'readonly');
        const req = t.objectStore('texts').getAll();
        req.onsuccess = () => resolve(req.result ?? []);
        req.onerror = () => resolve([]);
      }),
    [],
  );
}

export async function getCachedText(kind, id) {
  const key = kind === 'shared' ? `shared:${id}` : id;
  return safe(
    () =>
      new Promise(async (resolve) => {
        const db = await openDb();
        const t = db.transaction('texts', 'readonly');
        const req = t.objectStore('texts').get(key);
        req.onsuccess = () => resolve(req.result ?? null);
        req.onerror = () => resolve(null);
      }),
    null,
  );
}

export async function putCachedText(text) {
  return cacheTexts({ texts: [text] });
}

// ---------------------------------------------------------------- collections

export async function cacheCollections(collections) {
  return safe(async () => {
    const db = await openDb();
    const t = db.transaction('collections', 'readwrite');
    for (const c of collections) t.objectStore('collections').put(c);
  });
}

export async function getCachedCollections() {
  return safe(
    () =>
      new Promise(async (resolve) => {
        const db = await openDb();
        const req = db.transaction('collections', 'readonly').objectStore('collections').getAll();
        req.onsuccess = () => resolve(req.result ?? []);
        req.onerror = () => resolve([]);
      }),
    [],
  );
}

export async function cacheCollectionItems(collectionId, items) {
  return safe(async () => {
    const db = await openDb();
    const t = db.transaction('collectionItems', 'readwrite');
    const s = t.objectStore('collectionItems');
    // Replace the collection's items wholesale.
    const old = await new Promise((resolve) => {
      const r = s.index('collection').getAll(collectionId);
      r.onsuccess = () => resolve(r.result ?? []);
      r.onerror = () => resolve([]);
    });
    for (const item of old) s.delete(item.id);
    for (const item of items) s.put({ ...item, collection_id: collectionId });
  });
}

export async function getCachedCollectionItems(collectionId) {
  return safe(
    () =>
      new Promise(async (resolve) => {
        const db = await openDb();
        const req = db
          .transaction('collectionItems', 'readonly')
          .objectStore('collectionItems')
          .index('collection')
          .getAll(collectionId);
        req.onsuccess = () => resolve(req.result ?? []);
        req.onerror = () => resolve([]);
      }),
    [],
  );
}

// ---------------------------------------------------------------- enrichments

export async function cacheEnrichment(language, term, payload) {
  return safe(async () => {
    const db = await openDb();
    const t = db.transaction('enrichments', 'readwrite');
    t.objectStore('enrichments').put({
      key: `${language}::${term}`,
      language,
      term,
      payload,
      cached_at: Date.now(),
    });
  });
}

export async function getEnrichment(language, term) {
  return safe(
    () =>
      new Promise(async (resolve) => {
        const db = await openDb();
        const req = db.transaction('enrichments', 'readonly').objectStore('enrichments').get(`${language}::${term}`);
        req.onsuccess = () => resolve(req.result ?? null);
        req.onerror = () => resolve(null);
      }),
    null,
  );
}

// ---------------------------------------------------------------- queue

export async function enqueue(op) {
  const result = await safe(async () => {
    const db = await openDb();
    const t = db.transaction('queue', 'readwrite');
    t.objectStore('queue').add({ ...op, queued_at: Date.now() });
  });
  // Ask the service worker for a Background Sync slot (phase 2): when the
  // browser regains connectivity, the SW messages us to flush the queue -
  // even if that happens before the user revisits the app.
  try {
    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator && 'SyncManager' in window) {
      const reg = await navigator.serviceWorker.getRegistration();
      await reg?.sync?.register('linguarium-flush');
    }
  } catch {
    /* Background Sync unavailable - the 'online' listener still flushes. */
  }
  return result;
}

export async function getQueue() {
  return safe(
    () =>
      new Promise(async (resolve) => {
        const db = await openDb();
        const req = db.transaction('queue', 'readonly').objectStore('queue').getAll();
        req.onsuccess = () => resolve(req.result ?? []);
        req.onerror = () => resolve([]);
      }),
    [],
  );
}

export async function removeFromQueue(ids) {
  return safe(async () => {
    const db = await openDb();
    const t = db.transaction('queue', 'readwrite');
    const s = t.objectStore('queue');
    for (const id of ids) s.delete(id);
  });
}

export async function clearAll() {
  return safe(async () => {
    const db = await openDb();
    const t = db.transaction(['kv', 'entries', 'texts', 'collections', 'collectionItems', 'enrichments', 'queue'], 'readwrite');
    for (const name of t.objectStoreNames) {
      if (name !== 'kv') t.objectStore(name).clear();
    }
    localStorage.removeItem('linguarium.activeLanguage');
  });
}
