/**
 * store.js — observable state with namespaced, quota-safe persistence.
 *
 * Every localStorage access is guarded: private browsing, disabled storage and
 * quota exhaustion degrade to in-memory state instead of throwing (which is
 * what broke the previous build on first load in Safari private mode).
 */

const NS = 'gbairai.v2.';
const memory = new Map();
let available = null;

function storageWorks() {
  if (available !== null) return available;
  try {
    const probe = `${NS}__probe`;
    localStorage.setItem(probe, '1');
    localStorage.removeItem(probe);
    available = true;
  } catch { available = false; }
  return available;
}

export function load(key, fallback) {
  const full = NS + key;
  try {
    if (storageWorks()) {
      const raw = localStorage.getItem(full);
      if (raw !== null) return JSON.parse(raw);
    } else if (memory.has(full)) {
      return memory.get(full);
    }
  } catch { /* corrupt entry — fall through to the default */ }
  return fallback;
}

export function save(key, value) {
  const full = NS + key;
  memory.set(full, value);
  if (!storageWorks()) return false;
  try {
    localStorage.setItem(full, JSON.stringify(value));
    return true;
  } catch {
    return false; // quota exceeded: the in-memory copy still holds
  }
}

export function drop(key) {
  const full = NS + key;
  memory.delete(full);
  try { if (storageWorks()) localStorage.removeItem(full); } catch { /* ignore */ }
}

/** Keys persisted across sessions, and their defaults. */
const PERSISTED = {
  locale: null,
  theme: 'system',
  creator: false,
  role: 'seeker',
  voice: { gender: 'female', age: 'adult' },
  speakReplies: true,
  favourites: [],
  savedCandidates: [],
  alerts: [],
  comments: {},
  chat: [],
  ads: null,
  wallet: null,
  adAutoplay: true,
  notifications: [],
};

function initial() {
  const out = {};
  for (const [k, def] of Object.entries(PERSISTED)) {
    const v = load(k, def);
    out[k] = v === undefined ? def : v;
  }
  return out;
}

const state = {
  ...initial(),
  // Ephemeral (never persisted)
  route: 'home',
  filters: { text: '', location: '', minSalary: 0, contract: 'all', remote: false, favOnly: false, sort: 'match' },
  candFilters: { text: '', location: '' },
  online: navigator.onLine,
  listening: false,
  liveOn: false,
};

const listeners = new Set();

export function get() { return state; }

/** Shallow-merge a patch, persist persisted keys, notify subscribers. */
export function set(patch) {
  const changed = [];
  for (const [k, v] of Object.entries(patch)) {
    if (state[k] === v) continue;
    state[k] = v;
    changed.push(k);
    if (k in PERSISTED) save(k, v);
  }
  if (changed.length) listeners.forEach((fn) => fn(state, changed));
  return state;
}

/** Re-persist a key mutated in place (arrays/objects). */
export function touch(key) {
  if (key in PERSISTED) save(key, state[key]);
  listeners.forEach((fn) => fn(state, [key]));
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Reset every persisted key back to its default. */
export function resetAll() {
  Object.keys(PERSISTED).forEach(drop);
  Object.assign(state, initial());
  listeners.forEach((fn) => fn(state, Object.keys(PERSISTED)));
}

export const storagePersistent = () => storageWorks();
