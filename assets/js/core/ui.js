/* ==========================================================================
   ui.js — briques d'interface : notifications, modales, menus, avatars,
   flèche de retour, barres de recherche, visionneuse
   ========================================================================== */

import { h, $, mount, clear, trapFocus, uid, on as listen } from './dom.js';
import { icon } from './icons.js';
import { t } from './i18n.js';
import * as router from './router.js';
import * as store from './store.js';
import { blobUrl, resolve as resolveBlob } from './idb.js';

/* ------------------------------ notifications --------------------------- */

const ICONS = { ok: 'check', bad: 'warn', info: 'info' };

export function toast(msg, kind = 'ok', action) {
  const root = $('#toast-root');
  if (!root) return;
  const el = h('div.toast', { class: kind, role: 'status' },
    icon(ICONS[kind] || 'info'),
    h('span.grow', msg),
    action ? h('button', { type: 'button', onclick: () => { close(); action.fn(); } }, action.label) : null,
  );
  let done = false;
  function close() {
    if (done) return;
    done = true;
    el.classList.add('out');
    setTimeout(() => el.remove(), 220);
  }
  root.appendChild(el);
  setTimeout(close, action ? 6000 : 3200);
  while (root.children.length > 3) root.firstChild.remove();
  return close;
}

/* --------------------------------- modales ------------------------------ */

const openStack = [];

function lockScroll(lock) {
  document.body.classList.toggle('no-scroll', lock);
}

/**
 * modal({ title, body, foot, size, onClose, root })
 * Renvoie { el, close } — la fermeture est toujours possible (Échap, fond, croix).
 */
export function modal(opts = {}) {
  const rootEl = $(opts.rootId || '#modal-root');
  const id = uid('m');
  const titleId = id + '-t';

  const closeBtn = h('button.icon-btn', {
    type: 'button', 'aria-label': t('a.close'), onclick: () => close(),
  }, icon('close'));

  const box = h('div.modal', {
    class: opts.size || '', role: 'dialog', 'aria-modal': 'true',
    'aria-labelledby': opts.title ? titleId : null,
    'aria-label': opts.title ? null : (opts.label || t('a.open')),
  },
    opts.bare ? null : h('div.m-head',
      opts.onBack ? h('button.icon-btn', { type: 'button', 'aria-label': t('a.back'), onclick: opts.onBack }, icon('back')) : null,
      h('h3', { id: titleId }, opts.title || ''),
      opts.headExtra || null,
      closeBtn,
    ),
    h('div.m-body', opts.body || null),
    opts.foot ? h('div.m-foot', opts.foot) : null,
  );

  const scrim = h('div.scrim', { onclick: () => { if (!opts.sticky) close(); } });
  const wrap = h('div', { dataset: { modal: id } }, scrim, box);

  rootEl.appendChild(wrap);
  rootEl.classList.add('on');
  lockScroll(true);
  const release = trapFocus(box);

  const onKey = (e) => {
    if (e.key === 'Escape' && !opts.sticky) { e.stopPropagation(); close(); }
  };
  document.addEventListener('keydown', onKey, true);

  let closed = false;
  function close(result) {
    if (closed) return;
    closed = true;
    document.removeEventListener('keydown', onKey, true);
    release();
    wrap.remove();
    const i = openStack.indexOf(close);
    if (i >= 0) openStack.splice(i, 1);
    if (!rootEl.children.length) rootEl.classList.remove('on');
    if (!$('#modal-root').children.length && !$('#sheet-root').children.length) lockScroll(false);
    if (opts.onClose) opts.onClose(result);
  }
  openStack.push(close);
  return { el: box, body: box.querySelector('.m-body'), close };
}

export function closeTopModal() {
  const fn = openStack[openStack.length - 1];
  if (fn) fn();
  return !!fn;
}

/** Feuille montante (empilable au-dessus d'une modale). */
export function sheet(opts = {}) {
  return modal(Object.assign({}, opts, { rootId: '#sheet-root' }));
}

export function confirm(opts = {}) {
  return new Promise((resolve) => {
    let settled = false;
    const done = (v) => { if (!settled) { settled = true; resolve(v); } };
    const m = modal({
      title: opts.title || t('a.confirm'),
      size: 'slim',
      body: h('div.stack.gap-3',
        h('p.mut', opts.message || ''),
        opts.extra || null,
      ),
      foot: [
        h('button.btn.ghost', { type: 'button', onclick: () => { done(false); m.close(); } }, opts.cancelLabel || t('a.cancel')),
        h('button.btn', {
          type: 'button', class: opts.danger ? 'danger' : 'primary',
          onclick: () => { done(true); m.close(); },
        }, opts.okLabel || t('a.confirm')),
      ],
      onClose: () => done(false),
    });
  });
}

export function prompt(opts = {}) {
  return new Promise((resolve) => {
    let settled = false;
    const done = (v) => { if (!settled) { settled = true; resolve(v); } };
    const input = h(opts.multiline ? 'textarea.textarea' : 'input.input', {
      type: opts.type || 'text',
      value: opts.value || '',
      placeholder: opts.placeholder || '',
      maxlength: opts.maxlength || null,
    });
    const m = modal({
      title: opts.title || '',
      size: 'slim',
      body: h('div.field',
        opts.label ? h('label', opts.label) : null,
        input,
        opts.hint ? h('p.hint', opts.hint) : null,
      ),
      foot: [
        h('button.btn.ghost', { type: 'button', onclick: () => { done(null); m.close(); } }, t('a.cancel')),
        h('button.btn.primary', { type: 'button', onclick: () => { done(input.value); m.close(); } }, opts.okLabel || t('a.save')),
      ],
      onClose: () => done(null),
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !opts.multiline) { e.preventDefault(); done(input.value); m.close(); }
    });
  });
}

/* ---------------------------- menu contextuel --------------------------- */

export function menu(anchor, items, opts = {}) {
  const pop = h('div.menu-pop', h('div.dl-menu',
    items.filter(Boolean).map((it) => (it.sep
      ? h('div.sb-sep')
      : h('button', {
        type: 'button',
        onclick: () => { close(); if (it.fn) it.fn(); },
        'aria-disabled': it.disabled ? 'true' : null,
        style: it.disabled ? { opacity: '.45', 'pointer-events': 'none' } : null,
      }, it.icon ? icon(it.icon) : null, h('span.grow', it.label), it.right ? h('span.xs.mut-3', it.right) : null))),
  ));
  document.body.appendChild(pop);

  const r = anchor.getBoundingClientRect();
  const pw = pop.offsetWidth, ph = pop.offsetHeight;
  let left = opts.align === 'start' ? r.left : r.right - pw;
  let top = r.bottom + 6;
  if (left < 8) left = 8;
  if (left + pw > innerWidth - 8) left = innerWidth - pw - 8;
  if (top + ph > innerHeight - 8) top = Math.max(8, r.top - ph - 6);
  pop.style.left = left + 'px';
  pop.style.top = top + 'px';

  const offDown = listen(document, 'pointerdown', (e) => {
    if (!pop.contains(e.target) && e.target !== anchor) close();
  }, true);
  const offKey = listen(document, 'keydown', (e) => { if (e.key === 'Escape') close(); }, true);
  const offScroll = listen(window, 'scroll', () => close(), true);

  let closed = false;
  function close() {
    if (closed) return;
    closed = true;
    offDown(); offKey(); offScroll();
    pop.remove();
  }
  const release = trapFocus(pop);
  const origClose = close;
  close = () => { release(); origClose(); };
  return { close };
}

/* --------------------------------- avatars ------------------------------ */

export function avatar(u, size = 40, opts = {}) {
  const shape = opts.shape || (store.settings().gridShape === 'round' ? '' : 'sq');
  const cls = 'av av-' + size + (shape === 'sq' || (u && u.avatarShape === 'square') ? ' sq' : '');
  const src = mediaSrc(u && (u.avatar || u.photo));
  const img = h('img', {
    class: cls, width: size, height: size, loading: 'lazy', decoding: 'async',
    alt: u ? (u.name || u.handle || '') : '',
    src: src || fallbackAvatar(u),
  });
  img.addEventListener('error', () => { img.src = fallbackAvatar(u); }, { once: true });
  if (u && (u.avatar || u.photo)) hydrate(img, u.avatar || u.photo);
  if (opts.ring) {
    return h('span.av-ring', { class: (opts.seen ? 'seen' : '') + (cls.includes('sq') ? ' sq' : '') }, img);
  }
  return img;
}

const AV_COLORS = ['#6c5cff', '#ff3b5c', '#f7c948', '#2fbf71', '#2f7fe0', '#b45cff', '#ff7a3d'];

export function fallbackAvatar(u) {
  const name = (u && (u.name || u.handle)) || '?';
  const initials = name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  const c = AV_COLORS[hash % AV_COLORS.length];
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96">'
    + '<rect width="96" height="96" fill="' + c + '"/>'
    + '<text x="48" y="48" text-anchor="middle" dominant-baseline="central" '
    + 'font-family="Sora,Arial,sans-serif" font-size="38" font-weight="700" fill="#fff">'
    + initials + '</text></svg>';
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}

/** Vignette de repli pour une image manquante (aucune requête réseau). */
export function fallbackTile(label, seedStr) {
  let hash = 0;
  const s = String(seedStr || label || 'gbzn');
  for (let i = 0; i < s.length; i++) hash = (hash * 37 + s.charCodeAt(i)) >>> 0;
  const a = AV_COLORS[hash % AV_COLORS.length];
  const b = AV_COLORS[(hash >> 3) % AV_COLORS.length];
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 400">'
    + '<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">'
    + '<stop offset="0%" stop-color="' + a + '"/><stop offset="100%" stop-color="' + b + '"/>'
    + '</linearGradient></defs><rect width="640" height="400" fill="url(#g)"/>'
    + '<circle cx="520" cy="80" r="120" fill="#fff" fill-opacity=".10"/>'
    + '<circle cx="90" cy="330" r="150" fill="#000" fill-opacity=".12"/>'
    + (label ? '<text x="320" y="210" text-anchor="middle" font-family="Sora,Arial,sans-serif" '
      + 'font-size="34" font-weight="700" fill="#fff" fill-opacity=".92">'
      + String(label).slice(0, 28).replace(/[<>&]/g, '') + '</text>' : '')
    + '</svg>';
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}

/** Source immédiate d'un média (référence IndexedDB, data URL ou URL). */
export function mediaSrc(ref) {
  if (!ref) return null;
  if (typeof ref !== 'string') return null;
  if (ref.startsWith('idb:')) return blobUrl(ref);
  return ref;
}

/** Complète la source une fois le blob chargé depuis IndexedDB. */
export function hydrate(el, ref) {
  if (typeof ref !== 'string' || !ref.startsWith('idb:')) return;
  if (blobUrl(ref)) { el.src = blobUrl(ref); return; }
  resolveBlob(ref).then((url) => { if (url && el.isConnected) el.src = url; });
}

/** Image robuste : repli automatique, jamais de case cassée. */
export function img(ref, opts = {}) {
  const el = h('img', {
    alt: opts.alt || '', loading: opts.eager ? 'eager' : 'lazy', decoding: 'async',
    class: opts.class || '', width: opts.width || null, height: opts.height || null,
    style: opts.style || null,
  });
  const fb = opts.fallback || fallbackTile(opts.label, opts.seed || ref);
  const src = mediaSrc(ref);
  el.src = src || fb;
  el.addEventListener('error', () => { if (el.src !== fb) el.src = fb; }, { once: true });
  if (!src) hydrate(el, ref);
  return el;
}

/* ----------------------------- flèche de retour ------------------------- */

/** Flèche collée au bord, présente partout sauf sur l'accueil. */
export function backBar(label) {
  const target = router.previous();
  const btn = h('button.backbtn', {
    type: 'button',
    'aria-label': t('a.back'),
    title: target ? t('a.back') : t('a.back'),
    onclick: (e) => { e.preventDefault(); router.back(); },
  }, icon('back'), h('span', label || t('a.back')));
  return btn;
}

/* ---------------------------- barre de recherche ------------------------ */

let recognition = null;

export function voiceSupported() {
  return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
}

/**
 * searchbox({ placeholder, value, onInput, onSubmit, autofocus })
 * Micro intégré : dictée si le navigateur la gère, message clair sinon.
 */
export function searchbox(opts = {}) {
  const input = h('input', {
    type: 'search', value: opts.value || '',
    placeholder: opts.placeholder || t('a.search'),
    'aria-label': opts.placeholder || t('a.search'),
    enterkeyhint: 'search', autocomplete: 'off', spellcheck: 'false',
  });
  const mic = h('button.icon-btn.sm.mic', {
    type: 'button', 'aria-label': t('a.voice'), title: t('a.voice'),
  }, icon('mic'));

  const form = h('form.searchbox', {
    role: 'search', class: opts.class || '',
    onsubmit: (e) => { e.preventDefault(); if (opts.onSubmit) opts.onSubmit(input.value.trim()); },
  }, icon('search'), input, mic,
    opts.onClose ? h('button.icon-btn.sm', { type: 'button', 'aria-label': t('a.close'), onclick: opts.onClose }, icon('close')) : null,
  );

  if (opts.onInput) input.addEventListener('input', () => opts.onInput(input.value.trim()));
  if (opts.autofocus) requestAnimationFrame(() => input.focus());

  mic.addEventListener('click', () => {
    const Rec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Rec) { toast(t('search.noVoice'), 'bad'); return; }
    if (recognition) { try { recognition.stop(); } catch (e) { /* ignore */ } recognition = null; mic.classList.remove('rec'); return; }
    try {
      recognition = new Rec();
      recognition.lang = document.documentElement.lang || 'fr-FR';
      recognition.interimResults = true;
      recognition.continuous = false;
      mic.classList.add('rec');
      toast(t('search.listening'), 'info');
      recognition.onresult = (ev) => {
        let txt = '';
        for (let i = ev.resultIndex; i < ev.results.length; i++) txt += ev.results[i][0].transcript;
        input.value = txt.trim();
        if (opts.onInput) opts.onInput(input.value.trim());
        if (ev.results[ev.results.length - 1].isFinal && opts.onSubmit) opts.onSubmit(input.value.trim());
      };
      recognition.onerror = () => { mic.classList.remove('rec'); recognition = null; };
      recognition.onend = () => { mic.classList.remove('rec'); recognition = null; };
      recognition.start();
    } catch (e) {
      mic.classList.remove('rec'); recognition = null;
      toast(t('search.noVoice'), 'bad');
    }
  });

  return { el: form, input, focus: () => input.focus() };
}

/* ------------------------------- onglets -------------------------------- */

export function tabs(items, activeId, onPick, opts = {}) {
  const wrap = h('div.tabs', { role: 'tablist', class: opts.class || '' });
  for (const it of items) {
    const b = h('button', {
      type: 'button', role: 'tab',
      'aria-selected': it.id === activeId ? 'true' : 'false',
      onclick: () => onPick(it.id),
    }, it.label);
    wrap.appendChild(b);
  }
  return wrap;
}

export function segmented(items, activeId, onPick) {
  return h('div.seg', items.map((it) => h('button', {
    type: 'button', 'aria-pressed': it.id === activeId ? 'true' : 'false',
    onclick: () => onPick(it.id),
  }, it.label)));
}

/* -------------------------------- divers -------------------------------- */

export function empty(iconName, msg, action) {
  return h('div.empty', icon(iconName || 'info'), h('p', msg || t('empty.generic')), action || null);
}

export function row(title, desc, control) {
  return h('div.set-row',
    h('div.t', h('div.n', title), desc ? h('div.d', desc) : null),
    h('div.ctl', control),
  );
}

export function switchCtl(checked, onChange, label) {
  const input = h('input', { type: 'checkbox', checked: !!checked, 'aria-label': label || '' });
  input.addEventListener('change', () => onChange(input.checked));
  return h('label.switch', input, h('span'));
}

export function spinner() { return h('div.ag-think', h('i'), h('i'), h('i')); }

export function skeletonList(n = 3, height = 160) {
  return h('div.stack.gap-3', Array.from({ length: n }, () => h('div.skeleton', { style: { height: height + 'px' } })));
}

export function kpi(n, label) { return h('div.kpi', h('div.n', n), h('div.l', label)); }

export function copyLink(path) {
  const url = location.origin + location.pathname + (path || location.hash);
  const done = () => toast(t('toast.copied'), 'ok');
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(url).then(done, () => fallbackCopy(url, done));
  } else fallbackCopy(url, done);
}

function fallbackCopy(text, done) {
  const ta = h('textarea', { style: { position: 'fixed', opacity: '0', top: '0' } });
  ta.value = text;
  document.body.appendChild(ta);
  ta.select();
  try { document.execCommand('copy'); done(); } catch (e) { toast(text, 'info'); }
  ta.remove();
}

export { mount, clear };
