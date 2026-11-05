import { ICONS, FILLED, parseIconName } from './icons.js';

/**
 * dom.js — tiny, dependency-free DOM layer.
 *
 * Everything in the app is built through `h()` with real text nodes, so user
 * input (chat, comments, ad titles, names with apostrophes) can never be
 * parsed as markup. There is no `innerHTML` anywhere in the render path.
 */

/**
 * Create an element.
 * @param {string} tag           tag, optionally "tag.class.class"
 * @param {object} [props]       attributes; `class`, `text`, `html` (trusted
 *                               literals only), `dataset`, `style`, `on` (events),
 *                               `ref` (callback). Null/undefined/false are skipped.
 * @param {Array|Node|string} [kids]
 */
export function h(tag, props = null, kids = null) {
  const [name, ...classes] = String(tag).split('.');
  const el = document.createElement(name || 'div');
  if (classes.length) el.classList.add(...classes);

  if (props) {
    for (const [k, v] of Object.entries(props)) {
      if (v === null || v === undefined || v === false) continue;

      if (k === 'class' || k === 'className') {
        String(v).split(/\s+/).filter(Boolean).forEach((c) => el.classList.add(c));
      } else if (k === 'text') {
        el.textContent = String(v);
      } else if (k === 'html') {
        el.innerHTML = String(v); // only ever called with in-repo literals
      } else if (k === 'dataset') {
        Object.entries(v).forEach(([dk, dv]) => {
          if (dv !== null && dv !== undefined) el.dataset[dk] = String(dv);
        });
      } else if (k === 'style') {
        if (typeof v === 'string') el.style.cssText = v;
        else Object.entries(v).forEach(([sk, sv]) => el.style.setProperty(sk, sv));
      } else if (k === 'on') {
        Object.entries(v).forEach(([type, fn]) => {
          if (typeof fn === 'function') el.addEventListener(type, fn);
        });
      } else if (k === 'ref') {
        if (typeof v === 'function') v(el);
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

export function append(parent, kids) {
  if (kids === null || kids === undefined || kids === false) return parent;
  if (Array.isArray(kids)) { kids.forEach((k) => append(parent, k)); return parent; }
  parent.append(kids instanceof Node ? kids : document.createTextNode(String(kids)));
  return parent;
}

/** Replace all children of `parent` with `kids`. */
export function render(parent, kids) {
  if (!parent) return parent;
  parent.replaceChildren();
  return append(parent, kids);
}

const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * Inline SVG icon. Accepts the same `"fa-solid fa-house"` spec the call sites
 * already use, so switching away from the icon font needed no churn here.
 * Unknown names render nothing rather than an empty box.
 */
export function icon(name, extra = '') {
  const { key, solid } = parseIconName(name);
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('class', `ic ${extra}`.trim());
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');

  const d = key ? ICONS[key] : null;
  if (!d) return svg;

  const filled = solid && FILLED.has(key);
  svg.setAttribute('fill', filled ? 'currentColor' : 'none');
  svg.setAttribute('stroke', filled ? 'none' : 'currentColor');
  if (!filled) {
    svg.setAttribute('stroke-width', '1.7');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
  }

  const path = document.createElementNS(SVG_NS, 'path');
  path.setAttribute('d', d);
  svg.append(path);
  return svg;
}

export const $  = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

/** Focus trap for dialogs: returns a release function. */
const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),' +
  'textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

export function trapFocus(container, { onEscape } = {}) {
  const previous = document.activeElement;

  const list = () => $$(FOCUSABLE, container).filter(
    (el) => el.offsetParent !== null || el === document.activeElement
  );

  const onKey = (e) => {
    if (e.key === 'Escape') { e.stopPropagation(); onEscape?.(); return; }
    if (e.key !== 'Tab') return;
    const items = list();
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  };

  container.addEventListener('keydown', onKey);
  requestAnimationFrame(() => (list()[0] || container).focus?.());

  return () => {
    container.removeEventListener('keydown', onKey);
    if (previous instanceof HTMLElement && document.contains(previous)) previous.focus();
  };
}

/** Lock body scroll without layout shift; reference-counted. */
let locks = 0;
export function lockScroll(on) {
  locks = Math.max(0, locks + (on ? 1 : -1));
  const gap = window.innerWidth - document.documentElement.clientWidth;
  document.body.classList.toggle('is-locked', locks > 0);
  document.body.style.paddingInlineEnd = locks > 0 && gap > 0 ? `${gap}px` : '';
}

export function debounce(fn, wait = 220) {
  let id;
  const wrapped = (...args) => { clearTimeout(id); id = setTimeout(() => fn(...args), wait); };
  wrapped.cancel = () => clearTimeout(id);
  return wrapped;
}

export function throttle(fn, wait = 120) {
  let last = 0, pending = null;
  return (...args) => {
    const now = Date.now();
    if (now - last >= wait) { last = now; fn(...args); }
    else {
      clearTimeout(pending);
      pending = setTimeout(() => { last = Date.now(); fn(...args); }, wait - (now - last));
    }
  };
}

/** Reveal [data-reveal] nodes as they scroll in. No-op when IO is missing. */
let revealObserver = null;
export function observeReveals(root = document) {
  const nodes = $$('[data-reveal]:not(.is-in)', root);
  if (!('IntersectionObserver' in window)) { nodes.forEach((n) => n.classList.add('is-in')); return; }
  if (!revealObserver) {
    revealObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-in');
        revealObserver.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.06 });
  }
  nodes.forEach((n) => revealObserver.observe(n));
}

/** Only http(s) URLs survive; everything else (javascript:, data:) becomes null. */
export function safeUrl(value) {
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    const url = new URL(value.trim(), location.href);
    return (url.protocol === 'http:' || url.protocol === 'https:') ? url.href : null;
  } catch { return null; }
}

/** Count up to a number — skipped entirely under prefers-reduced-motion. */
export function countTo(el, target, { duration = 900, format = (v) => String(v) } = {}) {
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  if (reduce || !Number.isFinite(target)) { el.textContent = format(target); return; }
  const start = performance.now();
  const step = (now) => {
    const p = Math.min(1, (now - start) / duration);
    const eased = 1 - Math.pow(1 - p, 3);
    el.textContent = format(Math.round(target * eased));
    if (p < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

/** Stable 32-bit hash of a string — same input always gives the same colour. */
export function hashString(value) {
  let hash = 2166136261;
  const text = String(value || '');
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash);
}

/**
 * Turn a failed <img> into a designed gradient tile instead of a blank box or a
 * broken-image glyph. Keeps layout intact when images are slow, blocked by a
 * content policy, or unavailable offline.
 */
const BLANK_PIXEL =
  'data:image/svg+xml,%3Csvg xmlns=%22http%3A//www.w3.org/2000/svg%22 width=%221%22 height=%221%22%3E%3C/svg%3E';

export function paintImageFallback(el, seed) {
  if (el.dataset.fallback === 'true') return;
  const hue = hashString(seed || el.currentSrc || el.src || 'gbairai') % 360;
  el.dataset.fallback = 'true';
  // A transparent 1×1 keeps the element a valid image, so the browser draws no
  // broken-image glyph over the gradient.
  el.src = BLANK_PIXEL;
  el.style.background =
    `linear-gradient(135deg, hsl(${hue} 62% 58%), hsl(${(hue + 48) % 360} 64% 44%))`;
  el.style.visibility = 'visible';
  el.style.objectFit = 'cover';
}
