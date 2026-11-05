/* ==========================================================================
   store.js — état unique, persistant et observable
   · Tout passe par commit() : rien n'est écrit « tout seul ».
   · Les écritures sont groupées puis sauvegardées (localStorage) hors du
     chemin de rendu, avec garde-fou de quota.
   ========================================================================== */

import { seed } from '../data/seed.js';

const NS = 'gbzn.v1.';
const KEYS = { settings: NS + 'settings', data: NS + 'data', session: NS + 'session' };

const DEFAULT_SETTINGS = {
  theme: 'dark',
  accent: '#6c5cff',
  locale: 'fr',
  currency: 'XOF',
  fontScale: 1,
  density: 'cosy',
  contrast: false,
  reduceMotion: false,
  // lecture
  autoplay: true,
  defaultMuted: true,
  loopShorts: true,
  dataSaver: false,
  preferredQuality: 'auto',
  captions: false,
  // confidentialité
  privateAccount: false,
  whoCanMessage: 'all',
  whoCanComment: 'all',
  showActivity: true,
  allowDownloads: true,
  readReceipts: true,
  // notifications
  notifyLikes: true,
  notifyComments: true,
  notifyFollows: true,
  notifyLive: true,
  notifyOrders: true,
  quietHours: false,
  // agent
  agentName: 'OWAK',
  agentAvatar: null,
  agentVoice: 'calme-f',
  agentRate: 1,
  agentPitch: 1,
  agentAutonomy: 'confirm',
  agentVoiceReply: false,
  // divers
  gridShape: 'square',
  showTrends: true,
  startView: 'home',
};

const DEFAULT_SESSION = {
  meId: 'me',
  ownerUnlocked: false,
  lastView: '#/',
  seenStories: [],
  searchHistory: {},
  onboarded: false,
};

let state = null;
const subs = new Set();
let saveTimer = null;
let dirty = { settings: false, data: false, session: false };
let quotaWarned = false;

/* ------------------------------ persistance ----------------------------- */

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (raw == null) return fallback;
    const v = JSON.parse(raw);
    return v == null ? fallback : v;
  } catch (e) { return fallback; }
}

function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (e) {
    if (!quotaWarned) {
      quotaWarned = true;
      console.warn('[gbzn] stockage local saturé : les médias restent en base IndexedDB.');
    }
    return false;
  }
}

function flush() {
  saveTimer = null;
  if (dirty.settings) { write(KEYS.settings, state.settings); dirty.settings = false; }
  if (dirty.session) { write(KEYS.session, state.session); dirty.session = false; }
  if (dirty.data) { write(KEYS.data, state.data); dirty.data = false; }
}

function scheduleSave(parts) {
  for (const p of parts) dirty[p] = true;
  if (saveTimer) return;
  saveTimer = setTimeout(flush, 120);
}

/** Force l'écriture immédiate (avant déchargement de la page). */
export function flushNow() { if (saveTimer) clearTimeout(saveTimer); flush(); }

/* --------------------------------- init --------------------------------- */

function mergeDefaults(saved, defaults) {
  const out = Object.assign({}, defaults);
  if (saved && typeof saved === 'object') {
    for (const k of Object.keys(saved)) if (k in defaults || saved[k] != null) out[k] = saved[k];
  }
  return out;
}

export function init() {
  const base = seed();
  const savedData = read(KEYS.data, null);
  const data = savedData ? mergeData(base, savedData) : base;
  state = {
    settings: mergeDefaults(read(KEYS.settings, null), DEFAULT_SETTINGS),
    session: mergeDefaults(read(KEYS.session, null), DEFAULT_SESSION),
    data,
  };
  if (!state.data.users.some((u) => u.id === state.session.meId)) state.session.meId = 'me';
  return state;
}

/** Fusion état sauvegardé / graine : on garde les démos et on ajoute l'existant. */
function mergeData(base, saved) {
  const out = Object.assign({}, base);
  for (const key of Object.keys(base)) {
    const sv = saved[key];
    if (sv == null) continue;
    if (Array.isArray(base[key]) && Array.isArray(sv)) {
      const byId = new Map();
      for (const item of base[key]) if (item && item.id != null) byId.set(item.id, item);
      for (const item of sv) {
        if (!item || item.id == null) continue;
        byId.set(item.id, byId.has(item.id) ? Object.assign({}, byId.get(item.id), item) : item);
      }
      const removed = new Set(saved.__removed && saved.__removed[key] ? saved.__removed[key] : []);
      out[key] = Array.from(byId.values()).filter((it) => !removed.has(it.id));
    } else if (base[key] && typeof base[key] === 'object' && typeof sv === 'object') {
      out[key] = Object.assign({}, base[key], sv);
    } else {
      out[key] = sv;
    }
  }
  out.__removed = Object.assign({}, saved.__removed || {});
  for (const key of Object.keys(saved)) if (!(key in out)) out[key] = saved[key];
  return out;
}

/* ------------------------------- lecture -------------------------------- */

export const get = () => state;
export const settings = () => state.settings;
export const session = () => state.session;
export const data = () => state.data;
export const me = () => state.data.users.find((u) => u.id === state.session.meId) || state.data.users[0];
export const isOwner = () => !!(me() && me().owner);

export function user(id) {
  if (!id) return null;
  return state.data.users.find((u) => u.id === id || u.handle === id) || null;
}

export function coll(name) { return state.data[name] || []; }
export function byId(name, id) { return coll(name).find((x) => x.id === id) || null; }

/* ------------------------------ mutations ------------------------------- */

/**
 * commit(label, mutator) — le seul chemin d'écriture.
 * mutator reçoit { data, settings, session } et modifie en place.
 */
export function commit(label, mutator) {
  const touched = new Set();
  const ctx = {
    data: state.data,
    settings: state.settings,
    session: state.session,
    touch: (p) => touched.add(p),
  };
  const res = mutator ? mutator(ctx) : undefined;
  if (!touched.size) { touched.add('data'); touched.add('settings'); touched.add('session'); }
  scheduleSave(Array.from(touched));
  notify(label);
  return res;
}

export function setSettings(patch) {
  return commit('settings', (c) => {
    Object.assign(c.settings, patch);
    c.touch('settings');
  });
}

export function setSession(patch) {
  return commit('session', (c) => {
    Object.assign(c.session, patch);
    c.touch('session');
  });
}

export function add(collection, item) {
  return commit('add:' + collection, (c) => {
    if (!c.data[collection]) c.data[collection] = [];
    c.data[collection].unshift(item);
    c.touch('data');
    return item;
  });
}

export function update(collection, id, patch) {
  return commit('update:' + collection, (c) => {
    const list = c.data[collection] || [];
    const i = list.findIndex((x) => x.id === id);
    if (i < 0) return null;
    list[i] = Object.assign({}, list[i], typeof patch === 'function' ? patch(list[i]) : patch);
    c.touch('data');
    return list[i];
  });
}

export function remove(collection, id) {
  return commit('remove:' + collection, (c) => {
    const list = c.data[collection] || [];
    const i = list.findIndex((x) => x.id === id);
    if (i < 0) return false;
    list.splice(i, 1);
    if (!c.data.__removed) c.data.__removed = {};
    if (!c.data.__removed[collection]) c.data.__removed[collection] = [];
    if (!c.data.__removed[collection].includes(id)) c.data.__removed[collection].push(id);
    c.touch('data');
    return true;
  });
}

/* ------------------------------ observation ----------------------------- */

export function subscribe(fn) { subs.add(fn); return () => subs.delete(fn); }

export function notify(label) {
  for (const fn of Array.from(subs)) {
    try { fn(label, state); } catch (e) { console.error('[gbzn] abonné en erreur', e); }
  }
}

/* --------------------------- export / import ---------------------------- */

export function exportAll() {
  return JSON.stringify({
    app: 'GBAIRAI ZONE', version: 1, at: new Date().toISOString(),
    settings: state.settings, session: state.session, data: state.data,
  }, null, 2);
}

export function importAll(json) {
  const parsed = typeof json === 'string' ? JSON.parse(json) : json;
  if (!parsed || !parsed.data) throw new Error('Sauvegarde illisible');
  state.settings = mergeDefaults(parsed.settings, DEFAULT_SETTINGS);
  state.session = mergeDefaults(parsed.session, DEFAULT_SESSION);
  state.data = mergeData(seed(), parsed.data);
  scheduleSave(['settings', 'session', 'data']);
  flushNow();
  notify('import');
}

export function resetAll() {
  try { for (const k of Object.values(KEYS)) localStorage.removeItem(k); } catch (e) { /* ignore */ }
  init();
  notify('reset');
}

export function storageInfo() {
  let bytes = 0;
  try {
    for (const k of Object.values(KEYS)) {
      const v = localStorage.getItem(k);
      if (v) bytes += v.length * 2;
    }
  } catch (e) { /* ignore */ }
  return { bytes };
}

export { DEFAULT_SETTINGS };
