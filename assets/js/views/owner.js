/* ==========================================================================
   owner.js — console du concepteur
   Visible du seul titulaire du compte concepteur, verrouillée par un code
   (CALEB3011 au départ, modifiable par lui seul). On y gère les campagnes du
   panneau publicitaire, les billets à vendre et les statistiques.
   ========================================================================== */

import { h, mount, clear, uid } from '../core/dom.js';
import { icon } from '../core/icons.js';
import { t, money, nfmt, ago, dateFmt } from '../core/i18n.js';
import * as store from '../core/store.js';
import * as router from '../core/router.js';
import {
  toast, empty, row, switchCtl, segmented, confirm, prompt, sheet, modal, kpi,
  img as safeImg, avatar,
} from '../core/ui.js';
import { pickFile, toMedia, editMedia, mediaEl } from '../core/media.js';
import { viewHead } from '../features/parts.js';
import { changeOwnerCode } from './settings.js';

const LOCK_MS = 15 * 60 * 1000;   // le verrou se remet de lui-même

export function render(ctx, host) {
  // Verrou d'accès : personne d'autre que le concepteur ne voit cette section.
  if (!store.isOwner()) {
    mount(host, h('div.stack.gap-4',
      viewHead({ title: t('owner.title') }),
      h('div.card.pad',
        h('div.lock',
          icon('shield'),
          h('h2', t('owner.locked')),
          h('p.sm.mut', t('owner.only')),
          h('a.btn.ghost', { href: '#/' }, icon('home'), t('nav.home')),
        ),
      ),
    ));
    return {};
  }

  const sess = store.session();
  const unlocked = sess.ownerUnlocked && (Date.now() - (sess.ownerUnlockedAt || 0) < LOCK_MS);

  if (!unlocked) {
    mount(host, h('div.stack.gap-4', viewHead({ title: t('owner.title') }), lockScreen()));
    return {};
  }

  const tab = ctx.query.tab || 'ads';
  const body = h('div.stack.gap-4');
  if (tab === 'tickets') body.appendChild(ticketsPane());
  else if (tab === 'stats') body.appendChild(statsPane());
  else if (tab === 'security') body.appendChild(securityPane());
  else body.appendChild(adsPane());

  mount(host, h('div.stack.gap-4',
    viewHead({
      title: t('owner.title'),
      badge: h('span.chip.taro', icon('shield'), t('owner.only')),
      tabsItems: [
        { id: 'ads', label: t('owner.ads') },
        { id: 'tickets', label: t('owner.tickets') },
        { id: 'stats', label: t('owner.stats') },
        { id: 'security', label: t('set.security') },
      ],
      activeTab: tab,
      onTab: (id) => router.replaceQuery({ tab: id === 'ads' ? null : id }),
      tools: [
        h('button.icon-btn', {
          type: 'button', 'aria-label': t('owner.lock'), title: t('owner.lock'),
          onclick: () => { store.setSession({ ownerUnlocked: false, ownerUnlockedAt: 0 }); toast(t('owner.lock'), 'ok'); router.render(); },
        }, icon('lock')),
      ],
    }),
    body,
  ));
  return {};
}

/* -------------------------------- verrou -------------------------------- */

function lockScreen() {
  const digits = Array.from({ length: 9 }, (_, i) => h('input', {
    type: 'password', inputmode: 'text', maxlength: '1', 'aria-label': 'Code ' + (i + 1),
    autocomplete: 'off', spellcheck: 'false',
  }));
  const err = h('p.xs', { style: { color: 'var(--bad)', 'min-height': '18px' } });

  digits.forEach((d, i) => {
    d.addEventListener('input', () => {
      if (d.value && i < digits.length - 1) digits[i + 1].focus();
      if (digits.every((x) => x.value)) submit();
    });
    d.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace' && !d.value && i > 0) digits[i - 1].focus();
      if (e.key === 'Enter') submit();
    });
    d.addEventListener('paste', (e) => {
      const txt = (e.clipboardData || window.clipboardData).getData('text') || '';
      e.preventDefault();
      txt.trim().slice(0, digits.length).split('').forEach((ch, k) => { digits[k].value = ch; });
      if (digits.every((x) => x.value)) submit();
    });
  });

  function submit() {
    const code = digits.map((d) => d.value).join('');
    const expected = (store.data().owner || {}).code || 'CALEB3011';
    if (code.toUpperCase() === String(expected).toUpperCase()) {
      store.setSession({ ownerUnlocked: true, ownerUnlockedAt: Date.now() });
      toast(t('owner.enter') + ' ✓', 'ok');
      router.render();
    } else {
      err.textContent = t('owner.wrong');
      for (const d of digits) d.value = '';
      digits[0].focus();
    }
  }

  requestAnimationFrame(() => digits[0].focus());

  return h('div.card.pad',
    h('div.lock',
      icon('lock'),
      h('h2', t('owner.title')),
      h('p.sm.mut', t('owner.hint')),
      h('div.pin', digits),
      err,
      h('button.btn.primary', { type: 'button', onclick: submit }, icon('key'), t('owner.enter')),
      h('p.xs.mut-3', t('owner.only')),
    ),
  );
}

/* ----------------------------- campagnes panneau ------------------------ */

function adsPane() {
  const ads = store.data().ads || [];
  return h('div.stack.gap-3',
    h('div.row.wrap.gap-2',
      h('button.btn.primary', { type: 'button', onclick: () => adSheet() }, icon('plus'), t('owner.addAd')),
      h('a.btn.ghost', { href: '#/' }, icon('eye'), t('a.preview')),
    ),
    ads.length
      ? h('div.stack.gap-3', ads.map((ad) => h('div.card.pad.stack.gap-3',
        h('div.row.gap-3',
          h('div', { style: { width: '140px', 'flex': 'none', 'border-radius': 'var(--r-sm)', overflow: 'hidden', 'aspect-ratio': '16/9', background: 'var(--surface-2)' } },
            ad.kind === 'video' && ad.ref
              ? (() => { const v = mediaEl({ kind: 'video', ref: ad.ref, fit: ad.fit }, { muted: true, loop: true, autoplay: true }); if (v) { v.style.width = '100%'; v.style.height = '100%'; v.style.objectFit = 'cover'; } return v; })()
              : (() => { const im = safeImg(ad.ref, { label: ad.label || ad.title, alt: '', seed: ad.id }); im.style.width = '100%'; im.style.height = '100%'; im.style.objectFit = 'cover'; return im; })(),
          ),
          h('div.stack.grow.gap-1',
            h('span.b', ad.title),
            h('span.xs.mut-3.clamp-2', ad.sub || ''),
            h('div.row.wrap.gap-2',
              h('span.chip', { class: ad.active !== false ? 'ok' : '' }, icon(ad.active !== false ? 'check' : 'eyeOff'), ad.active !== false ? t('owner.active') : t('a.hide')),
              h('span.chip', icon('eye'), nfmt(ad.impressions || 0)),
              h('span.chip', icon('zap'), nfmt(ad.clicks || 0)),
              h('span.chip', icon('clock'), (ad.slot || 7) + ' s'),
            ),
          ),
        ),
        h('div.row.wrap.gap-2',
          h('button.btn.sm.soft', { type: 'button', onclick: () => adSheet(ad) }, icon('edit'), t('a.edit')),
          h('button.btn.sm.ghost', {
            type: 'button',
            onclick: () => { store.update('ads', ad.id, { active: ad.active === false }); toast(t('toast.saved'), 'ok'); router.render(); },
          }, icon(ad.active !== false ? 'eyeOff' : 'eye'), ad.active !== false ? t('a.hide') : t('owner.active')),
          h('button.btn.sm.danger', {
            type: 'button',
            onclick: async () => {
              const ok = await confirm({ title: t('a.delete'), message: ad.title, danger: true, okLabel: t('a.delete') });
              if (!ok) return;
              store.remove('ads', ad.id);
              toast(t('toast.deleted'), 'ok');
              router.render();
            },
          }, icon('trash'), t('a.delete')),
        ),
      )))
      : empty('image', t('empty.generic'),
        h('button.btn.primary', { type: 'button', onclick: () => adSheet() }, icon('plus'), t('owner.addAd'))),
  );
}

function adSheet(existing) {
  const draft = existing
    ? Object.assign({}, existing)
    : { title: '', sub: '', kind: 'image', ref: null, fit: null, cta: t('a.open'), ctaUrl: '#/', active: true, slot: 7, label: '' };

  const preview = h('div', { style: { 'border-radius': 'var(--r-md)', overflow: 'hidden', 'aspect-ratio': '21/9', background: '#05070e' } });
  function paintPreview() {
    clear(preview);
    const el = draft.kind === 'video' && draft.ref
      ? mediaEl({ kind: 'video', ref: draft.ref, fit: draft.fit }, { muted: true, loop: true, autoplay: true })
      : safeImg(draft.ref, { label: draft.title || t('bb.title'), alt: '', seed: draft.title });
    if (el) { el.style.width = '100%'; el.style.height = '100%'; el.style.objectFit = 'cover'; preview.appendChild(el); }
    preview.appendChild(h('div.bb-shade',
      h('div.t', draft.title || t('bb.title')),
      draft.sub ? h('div.s', draft.sub) : null,
      draft.cta ? h('div.acts', h('span.btn.sm.primary', draft.cta)) : null,
    ));
  }
  paintPreview();

  const titleIn = h('input.input', { type: 'text', value: draft.title, maxlength: 90 });
  const subIn = h('textarea.textarea', { maxlength: 220 });
  subIn.value = draft.sub || '';
  const ctaIn = h('input.input', { type: 'text', value: draft.cta || '', maxlength: 32 });
  const urlIn = h('input.input', { type: 'text', value: draft.ctaUrl || '#/', maxlength: 160 });
  const slotIn = h('input', { type: 'range', min: '3', max: '20', step: '1', value: String(draft.slot || 7) });
  const slotOut = h('span.v', (draft.slot || 7) + ' s');
  const activeIn = switchCtl(draft.active !== false, (v) => { draft.active = v; }, t('owner.active'));

  titleIn.addEventListener('input', () => { draft.title = titleIn.value; paintPreview(); });
  subIn.addEventListener('input', () => { draft.sub = subIn.value; paintPreview(); });
  ctaIn.addEventListener('input', () => { draft.cta = ctaIn.value; paintPreview(); });
  slotIn.addEventListener('input', () => { draft.slot = Number(slotIn.value); slotOut.textContent = draft.slot + ' s'; });

  async function pick(kind) {
    const files = await pickFile({ accept: kind === 'video' ? 'video/*' : 'image/*' });
    if (!files.length) return;
    const md = await toMedia(files[0]);
    if (!md) return;
    const edited = await editMedia(md, { ratio: '21:9', title: t('owner.kind'), asSheet: true });
    const final = edited || md;
    draft.ref = final.ref;
    draft.fit = final.fit;
    draft.kind = kind;
    paintPreview();
  }

  const m = sheet({
    title: existing ? t('a.edit') : t('owner.addAd'),
    size: 'wide',
    body: h('div.stack.gap-4',
      preview,
      h('div.row.wrap.gap-2',
        h('button.btn.sm.soft', { type: 'button', onclick: () => pick('image') }, icon('image'), t('stories.photo')),
        h('button.btn.sm.soft', { type: 'button', onclick: () => pick('video') }, icon('film'), t('stories.videoKind')),
        draft.ref ? h('button.btn.sm.ghost', { type: 'button', onclick: () => { draft.ref = null; paintPreview(); } }, icon('trash'), t('a.remove')) : null,
      ),
      h('div.field', h('label', t('profile.name')), titleIn),
      h('div.field', h('label', t('profile.bio')), subIn),
      h('div.grid-2',
        h('div.field', h('label', t('owner.cta')), ctaIn),
        h('div.field', h('label', t('owner.ctaUrl')), urlIn),
      ),
      h('div.ed-slider', h('span', t('owner.slot')), slotIn, slotOut),
      h('div.set-grp', row(t('owner.active'), t('owner.rotation'), activeIn)),
      h('p.xs.mut-3', t('profile.manualHint')),
    ),
    foot: [
      h('button.btn.ghost', { type: 'button', onclick: () => m.close() }, t('a.cancel')),
      h('button.btn.primary', {
        type: 'button',
        onclick: () => {
          const payload = {
            title: titleIn.value.trim() || t('bb.title'),
            sub: subIn.value.trim(),
            kind: draft.kind, ref: draft.ref, fit: draft.fit,
            cta: ctaIn.value.trim(), ctaUrl: urlIn.value.trim() || '#/',
            slot: draft.slot || 7, active: draft.active !== false,
            label: titleIn.value.trim(),
          };
          if (existing) store.update('ads', existing.id, payload);
          else store.add('ads', Object.assign({ id: uid('ad'), impressions: 0, clicks: 0 }, payload));
          toast(t('toast.saved'), 'ok');
          m.close();
          router.render();
        },
      }, icon('check'), t('a.save')),
    ],
  });
}

/* ---------------------------------- billets ----------------------------- */

function ticketsPane() {
  const tickets = (store.data().products || []).filter((p) => p.isTicket);
  return h('div.stack.gap-3',
    h('div.row.wrap.gap-2',
      h('button.btn.primary', { type: 'button', onclick: () => ticketSheet() }, icon('ticket'), t('owner.addTicket')),
      h('a.btn.ghost', { href: '#/shop' }, icon('shop'), t('nav.shop')),
    ),
    tickets.length
      ? h('div.grid-auto', tickets.map((p) => h('div.card.pad.stack.gap-2',
        h('div.row.gap-2', icon('ticket'), h('span.b.grow.trunc', p.title)),
        h('span.b', { style: { color: 'var(--taro)' } }, money(p.price, p.currency)),
        h('div.row.wrap.gap-2',
          h('span.chip', icon('box'), (p.stock || 0) + ' / ' + ((p.stock || 0) + (p.sold || 0))),
          h('span.chip', icon('chart'), nfmt(p.sold || 0) + ' ' + t('shop.sold').toLowerCase()),
        ),
        h('div.row.wrap.gap-2',
          h('button.btn.sm.soft', { type: 'button', onclick: () => ticketSheet(p) }, icon('edit'), t('a.edit')),
          h('button.btn.sm.danger', {
            type: 'button',
            onclick: async () => {
              const ok = await confirm({ title: t('a.delete'), message: p.title, danger: true, okLabel: t('a.delete') });
              if (!ok) return;
              store.remove('products', p.id);
              toast(t('toast.deleted'), 'ok');
              router.render();
            },
          }, icon('trash'), t('a.delete')),
        ),
      )))
      : empty('ticket', t('empty.generic'),
        h('button.btn.primary', { type: 'button', onclick: () => ticketSheet() }, icon('plus'), t('owner.addTicket'))),
  );
}

function ticketSheet(existing) {
  const draft = existing ? Object.assign({}, existing) : { title: '', price: 10000, stock: 100, desc: '', ref: null };
  const titleIn = h('input.input', { type: 'text', value: draft.title, maxlength: 90 });
  const priceIn = h('input.input', { type: 'number', value: String(draft.price || 0), min: '0', step: '500' });
  const stockIn = h('input.input', { type: 'number', value: String(draft.stock || 0), min: '0', step: '1' });
  const descIn = h('textarea.textarea');
  descIn.value = draft.desc || '';

  const m = sheet({
    title: existing ? t('a.edit') : t('owner.addTicket'),
    body: h('div.stack.gap-3',
      h('div.field', h('label', t('profile.name')), titleIn),
      h('div.grid-2',
        h('div.field', h('label', t('owner.price')), priceIn),
        h('div.field', h('label', t('owner.qty')), stockIn),
      ),
      h('div.field', h('label', t('profile.bio')), descIn),
      h('button.btn.sm.soft', {
        type: 'button',
        onclick: async () => {
          const files = await pickFile({ accept: 'image/*' });
          if (!files.length) return;
          const md = await toMedia(files[0]);
          if (!md) return;
          const edited = await editMedia(md, { ratio: '4:3', title: t('media.editor'), asSheet: true });
          draft.ref = (edited || md).ref;
          toast(t('toast.saved'), 'ok');
        },
      }, icon('image'), t('media.pick')),
    ),
    foot: [
      h('button.btn.ghost', { type: 'button', onclick: () => m.close() }, t('a.cancel')),
      h('button.btn.primary', {
        type: 'button',
        onclick: () => {
          const payload = {
            title: titleIn.value.trim() || t('shop.ticket'),
            price: Number(priceIn.value) || 0,
            stock: Number(stockIn.value) || 0,
            desc: descIn.value.trim(), ref: draft.ref,
            isTicket: true, escrow: true, negotiable: false,
            category: 'Évènement', currency: 'XOF',
          };
          if (existing) store.update('products', existing.id, payload);
          else store.add('products', Object.assign({ id: uid('pr'), userId: store.session().meId, rating: 0, sold: 0, tags: ['billet'] }, payload));
          toast(t('toast.saved'), 'ok');
          m.close();
          router.render();
        },
      }, icon('check'), t('a.save')),
    ],
  });
}

/* ------------------------------ statistiques ---------------------------- */

function statsPane() {
  const d = store.data();
  const ads = d.ads || [];
  const impressions = ads.reduce((n, a) => n + (a.impressions || 0), 0);
  const clicks = ads.reduce((n, a) => n + (a.clicks || 0), 0);
  const ctr = impressions ? Math.round((clicks / impressions) * 1000) / 10 : 0;
  const tickets = (d.products || []).filter((p) => p.isTicket);
  const revenue = tickets.reduce((n, p) => n + (p.price || 0) * (p.sold || 0), 0);

  // courbe simple des 14 derniers jours, dérivée du contenu réel
  const days = Array.from({ length: 14 }, (_, i) => {
    const from = Date.now() - (13 - i) * 86400e3;
    const to = from + 86400e3;
    const n = d.posts.filter((p) => p.at >= from && p.at < to).length
      + d.shorts.filter((v) => v.at >= from && v.at < to).length;
    return n;
  });
  const max = Math.max(1, ...days);

  return h('div.stack.gap-4',
    h('div.grid-auto',
      kpi(nfmt(impressions), t('owner.stats') + ' · ' + t('feed.views')),
      kpi(nfmt(clicks), t('a.open')),
      kpi(ctr + ' %', 'CTR'),
      kpi(money(revenue), t('owner.tickets')),
    ),
    h('div.card.pad.stack.gap-3',
      h('h3', t('owner.stats')),
      h('div.bars', days.map((n) => h('i', { style: { height: Math.max(3, (n / max) * 100) + '%' }, title: String(n) }))),
      h('div.row.between.xs.mut-3', h('span', dateFmt(Date.now() - 13 * 86400e3, { day: '2-digit', month: 'short' })), h('span', dateFmt(Date.now(), { day: '2-digit', month: 'short' }))),
    ),
    h('div.card.pad.stack.gap-2',
      h('h3', t('owner.ads')),
      ads.length ? h('div.stack.gap-1', ads.map((a) => h('div.set-row',
        h('div.t', h('div.n', a.title), h('div.d', nfmt(a.impressions || 0) + ' ' + t('feed.views') + ' · ' + nfmt(a.clicks || 0) + ' ' + t('a.open'))),
        h('div.ctl', h('span.chip', (a.impressions ? Math.round((a.clicks || 0) / a.impressions * 1000) / 10 : 0) + ' %')),
      ))) : empty('chart', t('empty.generic')),
    ),
    h('div.card.pad.stack.gap-2',
      h('h3', t('nav.sections')),
      h('div.grid-auto',
        kpi(String(d.users.length), t('search.people')),
        kpi(String(d.posts.length), t('search.posts')),
        kpi(String(d.shorts.length), t('nav.shorts')),
        kpi(String((d.orders || []).length), t('shop.orders')),
      ),
    ),
  );
}

/* --------------------------------- sécurité ----------------------------- */

function securityPane() {
  const owner = store.data().owner || {};
  return h('div.stack.gap-3',
    h('div.set-grp',
      row(t('owner.code'), owner.codeChangedAt ? t('a.edit') + ' · ' + ago(owner.codeChangedAt) : 'CALEB3011', h('span.chip', icon('key'), '••••••••')),
      row(t('owner.lock'), '15 min', h('button.btn.sm.ghost', {
        type: 'button',
        onclick: () => { store.setSession({ ownerUnlocked: false, ownerUnlockedAt: 0 }); router.render(); },
      }, icon('lock'), t('owner.lock'))),
    ),
    h('div.card.pad.stack.gap-2',
      h('h3', t('owner.changeCode')),
      h('p.sm.mut', t('owner.only')),
      h('button.btn.soft', { type: 'button', onclick: () => changeOwnerCode() }, icon('key'), t('owner.changeCode')),
    ),
    h('div.card.pad.stack.gap-2',
      h('h3', t('owner.only')),
      h('p.sm.mut', 'Cette section n\'apparaît ni dans le menu, ni dans la recherche, ni dans les '
        + 'paramètres des autres comptes. Le bouton de réglage du panneau n\'est rendu que pour le compte concepteur.'),
    ),
  );
}
