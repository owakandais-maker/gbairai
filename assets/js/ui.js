/**
 * ui.js — overlays, toasts, dialogs, drawers.
 *
 * One registry owns every open layer, so Escape always closes the topmost one
 * and body scroll unlocks exactly once. The old build toggled `hidden` on
 * elements that also carried `display:flex`, so modals stayed visible after
 * "closing"; here visibility is driven by a single class per layer.
 */

import { h, render, icon, trapFocus, lockScroll, $ } from './dom.js';
import { t } from './i18n.js';

const stack = [];
let seq = 0;

function topmost() { return stack[stack.length - 1] || null; }

document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  const layer = topmost();
  if (layer?.dismissible) { e.preventDefault(); layer.close(); }
});

/* ------------------------------------------------------------------ toasts */

function toastHost() {
  let host = $('#toasts');
  if (!host) {
    host = h('div.toasts', { id: 'toasts', role: 'region', 'aria-live': 'polite', 'aria-label': t('notifs.title') });
    document.body.append(host);
  }
  return host;
}

const TOAST_ICON = {
  info: 'fa-solid fa-circle-info',
  success: 'fa-solid fa-circle-check',
  warn: 'fa-solid fa-triangle-exclamation',
  error: 'fa-solid fa-circle-exclamation',
  match: 'fa-solid fa-fire',
};

export function toast(title, message = '', kind = 'info', { duration = 5200 } = {}) {
  const host = toastHost();
  let timer;

  const el = h('div.toast', { role: 'status' }, [
    h(`div.toast-ic.${kind in TOAST_ICON ? kind : 'info'}`, null, icon(TOAST_ICON[kind] || TOAST_ICON.info)),
    h('div.grow', null, [
      h('strong', { text: title }),
      message ? h('p', { text: message }) : null,
    ]),
    h('button.icon-btn.icon-btn-sm', {
      type: 'button', 'aria-label': t('common.close'),
      on: { click: dismiss },
    }, icon('fa-solid fa-xmark')),
  ]);

  function dismiss() {
    clearTimeout(timer);
    el.classList.remove('is-open');
    setTimeout(() => el.remove(), 280);
  }

  host.append(el);
  requestAnimationFrame(() => el.classList.add('is-open'));
  if (duration > 0) timer = setTimeout(dismiss, duration);

  // Never let more than 4 pile up.
  while (host.children.length > 4) host.firstElementChild.remove();
  return dismiss;
}

/* ------------------------------------------------------------------ layers */

function mountLayer({ build, dismissible = true, onClose, labelledBy }) {
  const id = `layer-${++seq}`;
  const overlay = h('div.overlay', { 'data-layer': id, on: { click: () => dismissible && close() } });

  let releaseTrap = null;
  const box = build(() => close());

  const wrap = h('div', {
    'data-layer': id, role: 'dialog', 'aria-modal': 'true',
    ...(labelledBy ? { 'aria-labelledby': labelledBy } : {}),
    class: box.wrapClass,
  }, box.node);

  document.body.append(overlay, wrap);
  lockScroll(true);

  requestAnimationFrame(() => {
    overlay.classList.add('is-open');
    box.node.classList.add('is-open');
    releaseTrap = trapFocus(wrap, { onEscape: () => dismissible && close() });
  });

  let closed = false;
  function close() {
    if (closed) return;
    closed = true;
    const i = stack.findIndex((l) => l.id === id);
    if (i >= 0) stack.splice(i, 1);
    releaseTrap?.();
    overlay.classList.remove('is-open');
    box.node.classList.remove('is-open');
    lockScroll(false);
    setTimeout(() => { overlay.remove(); wrap.remove(); }, 460);
    onClose?.();
  }

  const layer = { id, close, dismissible };
  stack.push(layer);
  return layer;
}

export function closeTopLayer() { topmost()?.close(); }
export function closeAllLayers() { [...stack].reverse().forEach((l) => l.close()); }

/* ------------------------------------------------------------------ modal */

/**
 * @param {object} o
 * @param {string} o.title
 * @param {Node|Node[]} o.body
 * @param {Array<{label:string,kind?:string,onClick?:(close:Function)=>void,close?:boolean}>} [o.actions]
 * @param {boolean} [o.small]
 */
export function modal({ title, body, actions = [], small = false, onClose }) {
  const titleId = `mt-${++seq}`;

  return mountLayer({
    labelledBy: titleId,
    onClose,
    build: (close) => {
      const node = h(`div.modal${small ? '.modal-sm' : ''}`, { tabindex: '-1' }, [
        h('header.modal-head', null, [
          h('h2', { id: titleId, text: title }),
          h('button.icon-btn', {
            type: 'button', 'aria-label': t('common.close'), on: { click: close },
          }, icon('fa-solid fa-xmark')),
        ]),
        h('div.modal-body.scroll-y', null, body),
        actions.length
          ? h('footer.modal-foot', null, actions.map((a) =>
              h(`button.btn.${a.kind || 'btn-ghost'}`, {
                type: 'button', text: a.label,
                on: { click: () => { const keep = a.onClick?.(close); if (a.close !== false && keep !== false) close(); } },
              })))
          : null,
      ]);
      return { node, wrapClass: 'modal-wrap' };
    },
  });
}

/** Confirmation dialog — resolves true/false. */
export function confirm({ title, message, confirmLabel, danger = false }) {
  return new Promise((resolve) => {
    let answer = false;
    modal({
      title, small: true,
      body: h('p.text-muted', { text: message }),
      onClose: () => resolve(answer),
      actions: [
        { label: t('common.cancel'), kind: 'btn-ghost' },
        {
          label: confirmLabel || t('common.save'),
          kind: danger ? 'btn-danger' : 'btn-primary',
          onClick: () => { answer = true; },
        },
      ],
    });
  });
}

/* ------------------------------------------------------------------ drawer */

/** Right-side (or left in RTL) sheet for job / candidate details. */
export function drawer({ title, build, onClose }) {
  const titleId = `dt-${++seq}`;
  return mountLayer({
    labelledBy: titleId,
    onClose,
    build: (close) => {
      const node = h('aside.drawer', { tabindex: '-1' });
      render(node, build({ close, titleId }));
      node.prepend(h('button.drawer-close', {
        type: 'button', 'aria-label': t('common.close'), on: { click: close },
      }, icon('fa-solid fa-xmark')));
      return { node, wrapClass: 'drawer-wrap' };
    },
  });
}

/* ------------------------------------------------------------------ video */

export function videoModal({ title, subtitle, poster }) {
  return mountLayer({
    build: (close) => {
      const node = h('div.video-box', { tabindex: '-1' }, [
        poster ? h('img', {
          src: poster, alt: '',
          style: 'position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:.35',
        }) : null,
        h('div.video-stage', null, [
          h('div', null, [
            icon('fa-regular fa-circle-play', 'fa-3x'),
            h('p', { text: t('common.loading'), style: 'margin-top:12px;opacity:.85' }),
          ]),
        ]),
        h('div.video-caption', null, [
          h('h2', { text: title, style: 'font-size:1.4rem' }),
          subtitle ? h('p', { text: subtitle, style: 'color:#cbd5e1' }) : null,
        ]),
        h('button.drawer-close', {
          type: 'button', 'aria-label': t('common.close'), on: { click: close },
        }, icon('fa-solid fa-xmark')),
      ]);
      return { node, wrapClass: 'video-wrap' };
    },
  });
}

/* ------------------------------------------------------- command palette */

/**
 * @param {Array<{group:string,label:string,hint?:string,icon?:string,run:Function}>} commands
 */
export function commandPalette(commands) {
  let input, list, active = 0, visible = [];

  const layer = mountLayer({
    build: (close) => {
      const paint = () => {
        render(list, visible.length
          ? groupRows(visible, active, (cmd) => { close(); setTimeout(() => cmd.run(), 60); })
          : h('p.empty', { text: t('cmdk.none'), style: 'padding:28px 16px' }));
      };

      const filter = (q) => {
        const needle = q.trim().toLowerCase();
        visible = !needle
          ? commands.slice(0, 12)
          : commands.filter((c) =>
              (c.label + ' ' + (c.hint || '') + ' ' + c.group).toLowerCase().includes(needle)
            ).slice(0, 20);
        active = 0;
        paint();
      };

      input = h('input.cmdk-input', {
        type: 'search', placeholder: t('cmdk.placeholder'),
        'aria-label': t('cmdk.placeholder'), autocomplete: 'off', spellcheck: 'false',
        on: {
          input: (e) => filter(e.target.value),
          keydown: (e) => {
            if (e.key === 'ArrowDown') { e.preventDefault(); active = Math.min(active + 1, visible.length - 1); paint(); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); active = Math.max(active - 1, 0); paint(); }
            else if (e.key === 'Enter') {
              e.preventDefault();
              const cmd = visible[active];
              if (cmd) { close(); setTimeout(() => cmd.run(), 60); }
            }
          },
        },
      });

      list = h('div.cmdk-list.scroll-y');
      filter('');

      const node = h('div.cmdk', { tabindex: '-1' }, [input, list]);
      return { node, wrapClass: 'cmdk-wrap' };
    },
  });

  return layer;
}

function groupRows(items, activeIndex, onPick) {
  const out = [];
  let lastGroup = null;
  items.forEach((cmd, i) => {
    if (cmd.group !== lastGroup) {
      out.push(h('p.menu-head', { text: cmd.group }));
      lastGroup = cmd.group;
    }
    out.push(h(`button.cmdk-item${i === activeIndex ? '.is-active' : ''}`, {
      type: 'button', on: { click: () => onPick(cmd) },
    }, [
      h('span.ic', null, icon(cmd.icon || 'fa-solid fa-arrow-right')),
      h('span.grow', null, [
        h('strong', { text: cmd.label }),
        cmd.hint ? h('small', { text: cmd.hint }) : null,
      ]),
      cmd.keys ? h('span.kbd', { text: cmd.keys }) : null,
    ]));
  });
  return out;
}

/* ------------------------------------------------------------------ popover */

/** Anchored menu that closes on outside click, Escape or scroll. */
export function popover(anchor, buildItems) {
  const existing = anchor.closest('.menu-wrap')?.querySelector('.menu');
  if (existing) { closePopover(existing, anchor); return null; }

  const wrap = anchor.closest('.menu-wrap') || anchor.parentElement;
  const menu = h('div.menu', { role: 'menu' }, buildItems(() => closePopover(menu, anchor)));
  wrap.append(menu);
  anchor.setAttribute('aria-expanded', 'true');

  const onDocDown = (e) => { if (!menu.contains(e.target) && !anchor.contains(e.target)) closePopover(menu, anchor); };
  const onKey = (e) => { if (e.key === 'Escape') { closePopover(menu, anchor); anchor.focus(); } };

  setTimeout(() => {
    document.addEventListener('pointerdown', onDocDown);
    document.addEventListener('keydown', onKey);
  }, 0);

  menu._teardown = () => {
    document.removeEventListener('pointerdown', onDocDown);
    document.removeEventListener('keydown', onKey);
  };

  const first = menu.querySelector('button,a');
  first?.focus();
  return menu;
}

function closePopover(menu, anchor) {
  menu._teardown?.();
  menu.remove();
  anchor?.setAttribute('aria-expanded', 'false');
}
