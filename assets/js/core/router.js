/* ==========================================================================
   router.js — routage par hash avec pile d'historique
   La flèche de retour ramène exactement là où l'on était (vue + position de
   défilement), et jamais vers une vue au hasard.
   ========================================================================== */

const routes = [];
let current = null;
let onRender = null;
const stack = [];          // [{ hash, scroll, at }]
let navLock = false;
let virtual = null;          // routage interne quand le cadre bloque le hash
const SKEY = 'gbzn.v1.navstack';

/** Hash courant : celui de la barre d'adresse, ou le nôtre si elle est figée. */
function hashNow() { return virtual || location.hash || '#/'; }

/** Écrit l'adresse quand c'est permis, sans jamais lever d'exception. */
function writeUrl(target) {
  try {
    history.replaceState(history.state, '', location.pathname + location.search + target);
    return true;
  } catch (e) { return false; }
}

/* ------------------------------ déclaration ----------------------------- */

/** on('/u/:handle', handler) — les segments :nom deviennent params. */
export function on(pattern, handler, meta) {
  const keys = [];
  const rx = new RegExp('^' + pattern
    .replace(/\/+$/, '')
    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    .replace(/\/:(\w+)/g, (_, k) => { keys.push(k); return '/([^/?]+)'; })
    + '/?$');
  routes.push({ rx, keys, handler, meta: meta || {}, pattern });
  return { on };
}

export function setRenderer(fn) { onRender = fn; }

/* -------------------------------- parsing ------------------------------- */

export function parse(hash) {
  let raw = String(hash || hashNow()).replace(/^#/, '');
  if (!raw.startsWith('/')) raw = '/' + raw;
  const qi = raw.indexOf('?');
  const path = qi >= 0 ? raw.slice(0, qi) : raw;
  const query = {};
  if (qi >= 0) {
    for (const [k, v] of new URLSearchParams(raw.slice(qi + 1))) query[k] = v;
  }
  return { raw, path: path.replace(/\/+$/, '') || '/', query };
}

function match(path) {
  for (const r of routes) {
    const m = r.rx.exec(path);
    if (!m) continue;
    const params = {};
    r.keys.forEach((k, i) => { params[k] = decodeURIComponent(m[i + 1]); });
    return { route: r, params };
  }
  return null;
}

/* ---------------------------------- pile -------------------------------- */

function loadStack() {
  try {
    const raw = sessionStorage.getItem(SKEY);
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) stack.push.apply(stack, arr.slice(-40));
    }
  } catch (e) { /* session indisponible */ }
}

function persistStack() {
  try { sessionStorage.setItem(SKEY, JSON.stringify(stack.slice(-40))); } catch (e) { /* ignore */ }
}

function scrollEl() { return document.scrollingElement || document.documentElement; }

function rememberScroll() {
  if (!stack.length) return;
  stack[stack.length - 1].scroll = scrollEl().scrollTop || 0;
  persistStack();
}

/** Position de défilement mémorisée pour le hash courant, si on y revient. */
function restoreScroll(hash) {
  const entry = stack[stack.length - 1];
  const y = entry && entry.hash === hash ? entry.scroll || 0 : 0;
  requestAnimationFrame(() => {
    requestAnimationFrame(() => { scrollEl().scrollTop = y; });
  });
}

export function depth() { return stack.length; }
export function canBack() { return stack.length > 1; }
export function previous() { return stack.length > 1 ? stack[stack.length - 2].hash : null; }

/** Parent logique d'une route, utilisé quand la pile est vide. */
export function parentOf(hash) {
  const { path, query } = parse(hash);
  if (path === '/' || path === '') return null;
  if (query.id && (path === '/shorts' || path === '/post')) return '#' + path;
  const parts = path.split('/').filter(Boolean);
  if (parts.length <= 1) return '#/';
  parts.pop();
  return '#/' + parts.join('/');
}

/* ------------------------------- navigation ----------------------------- */

export function go(hash, opts) {
  const o = opts || {};
  const target = String(hash).startsWith('#') ? hash : '#' + hash;
  if (target === hashNow()) { render(); return; }
  rememberScroll();
  navLock = o.replace ? 'replace' : 'push';
  if (o.replace) {
    virtual = writeUrl(target) ? null : target;
    handle();
    return;
  }
  try { location.hash = target; } catch (e) { /* cadre restreint */ }
  // Si le cadre refuse d'écrire le hash, on route nous-mêmes.
  if (location.hash !== target) {
    virtual = target;
    handle();
  } else {
    virtual = null;
  }
}

export function back() {
  if (stack.length > 1) {
    rememberScroll();
    stack.pop();                 // la vue quittée
    const to = stack[stack.length - 1];
    persistStack();
    navLock = 'back';
    const target = to.hash;
    if (target === hashNow()) { render(); }
    else {
      virtual = writeUrl(target) ? null : target;
      handle();
    }
    return;
  }
  const parent = parentOf(location.hash);
  go(parent || '#/', { replace: true });
}

export function replaceQuery(patch) {
  const { path, query } = parse(hashNow());
  const q = Object.assign({}, query, patch);
  for (const k of Object.keys(q)) if (q[k] == null || q[k] === '') delete q[k];
  const qs = new URLSearchParams(q).toString();
  go('#' + path + (qs ? '?' + qs : ''), { replace: true });
}

/* --------------------------------- rendu -------------------------------- */

function pushEntry(hash) {
  const mode = navLock;
  navLock = false;
  if (mode === 'back') return;
  if (mode === 'replace' && stack.length) {
    stack[stack.length - 1] = { hash, scroll: 0, at: Date.now() };
  } else {
    const last = stack[stack.length - 1];
    if (last && last.hash === hash) return;
    stack.push({ hash, scroll: 0, at: Date.now() });
    if (stack.length > 60) stack.splice(0, stack.length - 60);
  }
  persistStack();
}

function handle() {
  const hash = hashNow();
  const wasBack = navLock === 'back';
  pushEntry(hash);
  render();
  if (wasBack) restoreScroll(hash);
  else requestAnimationFrame(() => { scrollEl().scrollTop = 0; });
}

export function render() {
  const { raw, path, query } = parse(hashNow());
  const found = match(path) || match('/404');
  const ctx = {
    hash: hashNow(),
    raw, path, query,
    params: found ? found.params : {},
    meta: found ? found.route.meta : {},
    pattern: found ? found.route.pattern : null,
  };
  current = ctx;
  if (onRender) onRender(ctx, found ? found.route.handler : null);
}

export function ctx() { return current; }

export function start() {
  loadStack();
  if (!location.hash) writeUrl('#/');
  window.addEventListener('hashchange', () => {
    virtual = null;
    if (!navLock) navLock = 'push';
    handle();
  });
  window.addEventListener('beforeunload', rememberScroll);
  // Première entrée : on repart de la pile si elle correspond, sinon on la remet à zéro.
  const hash = hashNow();
  const last = stack[stack.length - 1];
  if (!last || last.hash !== hash) { stack.length = 0; stack.push({ hash, scroll: 0, at: Date.now() }); persistStack(); }
  render();
}

export function resetStack(hash) {
  stack.length = 0;
  stack.push({ hash: hash || hashNow(), scroll: 0, at: Date.now() });
  persistStack();
}
