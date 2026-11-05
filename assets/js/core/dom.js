/* ==========================================================================
   dom.js — fabrique d'éléments, échappement et petits utilitaires DOM
   ========================================================================== */

const SVG_NS = 'http://www.w3.org/2000/svg';
const SVG_TAGS = new Set(['svg', 'path', 'g', 'circle', 'rect', 'line', 'polyline', 'polygon',
  'ellipse', 'defs', 'linearGradient', 'radialGradient', 'stop', 'clipPath', 'use', 'text', 'tspan', 'mask']);

/**
 * h('div.card#id', {attrs}, ...children)
 * Les enfants acceptent : Node, chaîne, nombre, tableau, null/undefined/false (ignorés).
 */
export function h(spec, attrs, ...kids) {
  let tag = 'div', id = '';
  const cls = [];
  const m = String(spec).match(/^([a-zA-Z][\w-]*)?([.#][^\s]*)?$/);
  if (m) {
    if (m[1]) tag = m[1];
    (m[2] || '').split(/(?=[.#])/).forEach((tok) => {
      if (!tok) return;
      if (tok[0] === '#') id = tok.slice(1);
      else if (tok[0] === '.') cls.push(tok.slice(1));
    });
  } else tag = String(spec);

  const el = SVG_TAGS.has(tag) ? document.createElementNS(SVG_NS, tag) : document.createElement(tag);
  if (id) el.id = id;
  if (cls.length) el.setAttribute('class', cls.join(' '));

  if (attrs && (attrs.nodeType || Array.isArray(attrs) || typeof attrs !== 'object')) {
    kids.unshift(attrs); attrs = null;
  }
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === 'class' || k === 'className') {
        const extra = String(v).trim();
        if (extra) el.setAttribute('class', cls.concat(extra).join(' '));
      } else if (k === 'style' && typeof v === 'object') {
        for (const [p, pv] of Object.entries(v)) if (pv != null) el.style.setProperty(p, String(pv));
      } else if (k === 'dataset') {
        for (const [p, pv] of Object.entries(v)) if (pv != null) el.dataset[p] = String(pv);
      } else if (k === 'html') {
        el.innerHTML = String(v);
      } else if (k.startsWith('on') && typeof v === 'function') {
        el.addEventListener(k.slice(2).toLowerCase(), v);
      } else if (k === 'ref' && typeof v === 'function') {
        v(el);
      } else if (v === true) {
        el.setAttribute(k, '');
      } else {
        el.setAttribute(k, String(v));
      }
    }
  }
  append(el, kids);
  return el;
}

export function append(el, kids) {
  for (const k of kids.flat(Infinity)) {
    if (k == null || k === false || k === '') continue;
    el.appendChild(k.nodeType ? k : document.createTextNode(String(k)));
  }
  return el;
}

export const frag = (...kids) => append(document.createDocumentFragment(), kids);
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

export function clear(el) { while (el && el.firstChild) el.removeChild(el.firstChild); return el; }
export function mount(el, ...kids) { clear(el); return append(el, kids); }

const ESC_MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ESC_MAP[c]);
}

/** Transforme #tags, @mentions et liens http(s) en HTML sûr. */
export function richText(s) {
  let out = esc(s);
  out = out.replace(/(https?:\/\/[^\s<]+)/g, (u) => {
    const label = u.replace(/^https?:\/\//, '');
    return '<a href="' + u + '" target="_blank" rel="noopener noreferrer">' + label + '</a>';
  });
  out = out.replace(/(^|[\s(])#([\p{L}\p{N}_]{2,40})/gu,
    (_, p, t) => p + '<a class="tag" href="#/search?q=%23' + encodeURIComponent(t) + '">#' + t + '</a>');
  out = out.replace(/(^|[\s(])@([a-zA-Z0-9_.]{2,30})/g,
    (_, p, t) => p + '<a class="tag" href="#/u/' + t + '">@' + t + '</a>');
  return out;
}

export function on(el, ev, fn, opts) {
  el.addEventListener(ev, fn, opts);
  return () => el.removeEventListener(ev, fn, opts);
}

/** Délégation d'évènement : delegate(root,'click','.sel',fn) */
export function delegate(root, ev, sel, fn) {
  const handler = (e) => {
    const t = e.target && e.target.closest ? e.target.closest(sel) : null;
    if (t && root.contains(t)) fn(e, t);
  };
  root.addEventListener(ev, handler);
  return () => root.removeEventListener(ev, handler);
}

export function debounce(fn, ms = 220) {
  let t;
  const f = (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
  f.cancel = () => clearTimeout(t);
  return f;
}

export function throttle(fn, ms = 120) {
  let last = 0, timer;
  return (...a) => {
    const now = Date.now();
    if (now - last >= ms) { last = now; fn(...a); }
    else { clearTimeout(timer); timer = setTimeout(() => { last = Date.now(); fn(...a); }, ms - (now - last)); }
  };
}

export const uid = (p = 'id') => p + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),'
  + 'textarea:not([disabled]),[tabindex]:not([tabindex="-1"]),summary,video[controls]';

/** Piège le focus dans un conteneur (modales, visionneuses). */
export function trapFocus(container) {
  const prev = document.activeElement;
  const onKey = (e) => {
    if (e.key !== 'Tab') return;
    const items = $$(FOCUSABLE, container).filter((n) => n.offsetParent !== null || n === document.activeElement);
    if (!items.length) return;
    const first = items[0], last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  };
  container.addEventListener('keydown', onKey);
  const auto = $$(FOCUSABLE, container).find((n) => !n.hasAttribute('data-no-autofocus'));
  if (auto) requestAnimationFrame(() => auto.focus({ preventScroll: true }));
  return () => {
    container.removeEventListener('keydown', onKey);
    if (prev && prev.isConnected && typeof prev.focus === 'function') prev.focus({ preventScroll: true });
  };
}

/** Geste de déplacement unifié doigt + souris. */
export function drag(el, opts = {}) {
  let id = null, sx = 0, sy = 0;
  const down = (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    id = e.pointerId; sx = e.clientX; sy = e.clientY;
    if (el.setPointerCapture) el.setPointerCapture(id);
    if (opts.onStart) opts.onStart({ x: sx, y: sy, e });
    e.preventDefault();
  };
  const move = (e) => {
    if (e.pointerId !== id) return;
    if (opts.onMove) opts.onMove({ dx: e.clientX - sx, dy: e.clientY - sy, x: e.clientX, y: e.clientY, e });
  };
  const up = (e) => {
    if (e.pointerId !== id) return;
    id = null;
    if (opts.onEnd) opts.onEnd({ e });
  };
  el.addEventListener('pointerdown', down);
  el.addEventListener('pointermove', move);
  el.addEventListener('pointerup', up);
  el.addEventListener('pointercancel', up);
  return () => {
    el.removeEventListener('pointerdown', down);
    el.removeEventListener('pointermove', move);
    el.removeEventListener('pointerup', up);
    el.removeEventListener('pointercancel', up);
  };
}

export const isPhone = () => matchMedia('(max-width: 699px)').matches;
export const isTablet = () => matchMedia('(min-width: 700px) and (max-width: 1099px)').matches;
export const isDesktop = () => matchMedia('(min-width: 1100px)').matches;
export const isTouch = () => matchMedia('(hover: none) and (pointer: coarse)').matches;
