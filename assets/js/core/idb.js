/* ==========================================================================
   idb.js — coffre média (IndexedDB)
   Les photos et vidéos ajoutées par l'utilisateur sont volumineuses : les
   garder dans localStorage ferait sauter le quota. On les range donc en
   IndexedDB et l'état ne conserve qu'une référence « idb:<id> ».
   ========================================================================== */

const DB_NAME = 'gbzn-media';
const STORE = 'blobs';
const VERSION = 1;

let dbPromise = null;
const urlCache = new Map();   // id -> objectURL
const pending = new Map();    // id -> Promise<string|null>

function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') { resolve(null); return; }
    let req;
    try { req = indexedDB.open(DB_NAME, VERSION); } catch (e) { resolve(null); return; }
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
    req.onblocked = () => resolve(null);
  }).catch(() => null);
  return dbPromise;
}

function tx(mode) {
  return openDb().then((db) => {
    if (!db) return null;
    try { return db.transaction(STORE, mode).objectStore(STORE); } catch (e) { return null; }
  });
}

const wrap = (req) => new Promise((resolve) => {
  if (!req) { resolve(null); return; }
  req.onsuccess = () => resolve(req.result);
  req.onerror = () => resolve(null);
});

export const isRef = (v) => typeof v === 'string' && v.startsWith('idb:');
export const refId = (v) => (isRef(v) ? v.slice(4) : null);

/** Enregistre un Blob/File et renvoie la référence « idb:<id> ». */
export async function putBlob(blob, meta = {}) {
  const id = 'm' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const store = await tx('readwrite');
  if (!store) {
    // Repli : data URL en mémoire pour la session en cours.
    const url = URL.createObjectURL(blob);
    urlCache.set(id, url);
    return 'idb:' + id;
  }
  await wrap(store.put({ id, blob, type: blob.type || meta.type || '', name: meta.name || '', at: Date.now() }));
  urlCache.set(id, URL.createObjectURL(blob));
  return 'idb:' + id;
}

/** Résout une référence en URL utilisable dans src. Renvoie null si absente. */
export function blobUrl(ref) {
  if (!isRef(ref)) return ref || null;
  const id = refId(ref);
  if (urlCache.has(id)) return urlCache.get(id);
  return null;
}

/** Version asynchrone : charge depuis IndexedDB si pas encore en cache. */
export async function resolve(ref) {
  if (!isRef(ref)) return ref || null;
  const id = refId(ref);
  if (urlCache.has(id)) return urlCache.get(id);
  if (pending.has(id)) return pending.get(id);
  const p = (async () => {
    const store = await tx('readonly');
    if (!store) return null;
    const rec = await wrap(store.get(id));
    if (!rec || !rec.blob) return null;
    const url = URL.createObjectURL(rec.blob);
    urlCache.set(id, url);
    return url;
  })();
  pending.set(id, p);
  const url = await p;
  pending.delete(id);
  return url;
}

/** Récupère le Blob brut (téléchargement, re-encodage). */
export async function getBlob(ref) {
  if (!isRef(ref)) {
    if (!ref) return null;
    try { const r = await fetch(ref); return await r.blob(); } catch (e) { return null; }
  }
  const store = await tx('readonly');
  if (!store) return null;
  const rec = await wrap(store.get(refId(ref)));
  return rec ? rec.blob : null;
}

export async function delBlob(ref) {
  const id = refId(ref);
  if (!id) return;
  const url = urlCache.get(id);
  if (url) { URL.revokeObjectURL(url); urlCache.delete(id); }
  const store = await tx('readwrite');
  if (store) await wrap(store.delete(id));
}

/** Pré-charge toutes les références présentes dans l'état pour un rendu direct. */
export async function warm(refs) {
  const list = Array.from(new Set(refs.filter(isRef)));
  await Promise.all(list.map((r) => resolve(r)));
}

export async function usage() {
  const store = await tx('readonly');
  if (!store) return { count: 0, bytes: 0 };
  const all = await wrap(store.getAll());
  const items = all || [];
  return { count: items.length, bytes: items.reduce((n, r) => n + ((r.blob && r.blob.size) || 0), 0) };
}

export async function clearAll() {
  for (const [id, url] of urlCache) { URL.revokeObjectURL(url); urlCache.delete(id); }
  const store = await tx('readwrite');
  if (store) await wrap(store.clear());
}
