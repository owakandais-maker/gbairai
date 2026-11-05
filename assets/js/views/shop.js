/* ==========================================================================
   shop.js — boutique de la zone
   Panier, négociation de prix, paiement sous séquestre TARO, commandes,
   mise en vente. La recherche de la boutique ne trouve que des articles.
   ========================================================================== */

import { h, mount, clear, uid, clamp } from '../core/dom.js';
import { icon } from '../core/icons.js';
import { t, money, nfmt, ago, dateFmt } from '../core/i18n.js';
import * as store from '../core/store.js';
import * as router from '../core/router.js';
import { toast, avatar, empty, sheet, modal, confirm, menu, img as safeImg, switchCtl, segmented } from '../core/ui.js';
import { pickFile, toMedia, editMedia, download } from '../core/media.js';
import { viewHead, shareSheet } from '../features/parts.js';

const TABS = () => [
  { id: 'all', label: t('shop.all') },
  { id: 'cart', label: t('shop.cart') },
  { id: 'orders', label: t('shop.orders') },
  { id: 'mine', label: t('shop.mine') },
];

export function render(ctx, host) {
  const tab = ctx.query.tab || 'all';
  const cartCount = (store.data().cart || []).reduce((n, l) => n + l.qty, 0);

  const head = viewHead({
    title: t('shop.title'),
    scope: 'shop',
    tabsItems: TABS().map((x) => (x.id === 'cart' && cartCount ? { id: x.id, label: x.label + ' · ' + cartCount } : x)),
    activeTab: tab,
    onTab: (id) => router.replaceQuery({ tab: id === 'all' ? null : id, id: null }),
    tools: [
      h('button.icon-btn', { type: 'button', 'aria-label': t('shop.sell'), title: t('shop.sell'), onclick: () => sellSheet() }, icon('plus')),
      h('button.icon-btn', {
        type: 'button', 'aria-label': t('shop.cart'), title: t('shop.cart'),
        class: cartCount ? 'on' : '',
        onclick: () => router.replaceQuery({ tab: 'cart' }),
      }, icon('cart')),
    ],
  });

  const body = h('div.stack.gap-4');

  if (ctx.query.id) {
    const p = store.byId('products', ctx.query.id);
    if (p) { mount(host, h('div.stack.gap-4', head, productDetail(p))); return {}; }
  }

  if (tab === 'cart') body.appendChild(cartView());
  else if (tab === 'orders') body.appendChild(ordersView());
  else if (tab === 'mine') body.appendChild(mineView());
  else body.appendChild(catalogView());

  mount(host, h('div.stack.gap-4', head, body));
  return {};
}

/* -------------------------------- catalogue ----------------------------- */

function catalogView() {
  const products = store.data().products || [];
  const cats = Array.from(new Set(products.map((p) => p.category).filter(Boolean)));
  let cat = null;
  const grid = h('div.grid-auto');

  function paint() {
    const list = cat ? products.filter((p) => p.category === cat) : products;
    mount(grid, list.length ? list.map(productCard) : empty('shop', t('empty.generic')));
  }

  const chips = h('div.row.wrap.gap-2',
    h('button.chip.btn-like.on', { type: 'button', onclick: (e) => { cat = null; setActive(e.currentTarget); paint(); } }, t('shop.all')),
    cats.map((c) => h('button.chip.btn-like', { type: 'button', onclick: (e) => { cat = c; setActive(e.currentTarget); paint(); } }, c)),
  );
  function setActive(btn) {
    for (const b of chips.querySelectorAll('button')) b.classList.remove('on');
    btn.classList.add('on');
  }
  paint();
  return h('div.stack.gap-3', chips, grid);
}

function productCard(p) {
  const seller = store.user(p.userId);
  return h('article.card.pcard.hover',
    h('div.th',
      safeImg(p.ref, { label: p.title, alt: p.title, seed: p.id }),
      h('div.badges',
        p.escrow ? h('span.chip.taro', icon('shield'), 'TARO') : null,
        p.isTicket ? h('span.chip', icon('ticket'), t('shop.ticket')) : null,
        p.oldPrice ? h('span.chip.ok', '-' + Math.round((1 - p.price / p.oldPrice) * 100) + '%') : null,
      ),
    ),
    h('div.bd',
      h('a.nm.clamp-2', { href: '#/shop?id=' + p.id }, p.title),
      h('div.pr', h('span.p', money(p.price, p.currency)), p.oldPrice ? h('span.old', money(p.oldPrice, p.currency)) : null),
      h('div.row.gap-2.xs.mut-3',
        seller ? h('a.row.gap-1', { href: '#/u/' + seller.handle }, avatar(seller, 28), h('span.trunc', seller.name)) : null,
      ),
      h('div.row.gap-2.xs.mut-3',
        h('span.row.gap-1', icon('star'), String(p.rating || '—')),
        h('span', nfmt(p.sold || 0) + ' ' + t('shop.sold').toLowerCase()),
        p.stock > 0 ? h('span.chip.ok', { style: { padding: '0 7px' } }, t('shop.stock')) : h('span.chip', { style: { padding: '0 7px' } }, t('shop.sold')),
      ),
      h('div.acts',
        h('button.btn.sm.primary', { type: 'button', onclick: () => addToCart(p) }, icon('cart'), t('shop.add')),
        p.negotiable ? h('button.btn.sm.ghost', { type: 'button', onclick: () => negotiate(p) }, icon('tag'), t('shop.negotiate')) : null,
        h('button.icon-btn.sm', { type: 'button', 'aria-label': t('a.share'), onclick: () => shareSheet({ kind: 'product', id: p.id, title: p.title }) }, icon('share')),
      ),
    ),
  );
}

function productDetail(p) {
  const seller = store.user(p.userId);
  return h('div.stack.gap-4',
    h('div.grid-2',
      h('div.card', { style: { overflow: 'hidden' } }, safeImg(p.ref, { label: p.title, alt: p.title, eager: true, seed: p.id })),
      h('div.stack.gap-3',
        h('h2', p.title),
        h('div.row.gap-2', h('span.b', { style: { 'font-size': '1.4rem', color: 'var(--taro)' } }, money(p.price, p.currency)),
          p.oldPrice ? h('span.sm.mut-3', { style: { 'text-decoration': 'line-through' } }, money(p.oldPrice, p.currency)) : null),
        p.escrow ? h('span.chip.taro', icon('shield'), t('shop.escrow')) : null,
        h('p.sm.mut', p.desc || ''),
        h('div.row.wrap.gap-2',
          h('span.chip', icon('box'), t('shop.stock') + ' : ' + (p.stock || 0)),
          h('span.chip', icon('star'), String(p.rating || '—')),
          h('span.chip', icon('chart'), nfmt(p.sold || 0) + ' ' + t('shop.sold').toLowerCase()),
        ),
        seller ? h('a.card.pad.row.gap-3.hover', { href: '#/u/' + seller.handle },
          avatar(seller, 44),
          h('div.stack.grow', h('span.b', seller.name), h('span.xs.mut-3', '@' + seller.handle)),
          icon('right'),
        ) : null,
        h('div.row.wrap.gap-2',
          h('button.btn.primary', { type: 'button', onclick: () => addToCart(p) }, icon('cart'), t('shop.add')),
          p.negotiable ? h('button.btn.soft', { type: 'button', onclick: () => negotiate(p) }, icon('tag'), t('shop.negotiate')) : null,
          h('button.btn.ghost', { type: 'button', onclick: () => shareSheet({ kind: 'product', id: p.id, title: p.title }) }, icon('share'), t('a.share')),
        ),
      ),
    ),
    h('div.sec-head', h('h3', t('shop.all'))),
    h('div.grid-auto', (store.data().products || []).filter((x) => x.id !== p.id && x.category === p.category).slice(0, 4).map(productCard)),
  );
}

/* ---------------------------------- panier ------------------------------ */

function addToCart(p, qty) {
  store.commit('cart', (c) => {
    if (!c.data.cart) c.data.cart = [];
    const line = c.data.cart.find((l) => l.productId === p.id);
    if (line) line.qty += (qty || 1);
    else c.data.cart.push({ productId: p.id, qty: qty || 1, price: p.price });
    c.touch('data');
  });
  toast(t('shop.add') + ' : ' + p.title, 'ok', { label: t('shop.cart'), fn: () => router.go('#/shop?tab=cart') });
}

function cartView() {
  const host = h('div.stack.gap-3');

  function paint() {
    const cart = store.data().cart || [];
    clear(host);
    if (!cart.length) {
      host.appendChild(empty('cart', t('shop.empty'),
        h('button.btn.primary', { type: 'button', onclick: () => router.replaceQuery({ tab: null }) }, icon('shop'), t('shop.all'))));
      return;
    }
    let total = 0;
    const lines = h('div.card.pad.stack');
    for (const line of cart) {
      const p = store.byId('products', line.productId);
      if (!p) continue;
      const unit = line.price != null ? line.price : p.price;
      total += unit * line.qty;
      lines.appendChild(h('div.cart-line',
        safeImg(p.ref, { label: p.title, alt: p.title, seed: p.id }),
        h('div.stack.grow',
          h('a.b.trunc', { href: '#/shop?id=' + p.id }, p.title),
          h('span.xs.mut-3', money(unit, p.currency) + (line.price != null && line.price !== p.price ? ' · ' + t('shop.accepted') : '')),
        ),
        h('div.qty',
          h('button', { type: 'button', 'aria-label': '-', onclick: () => { setQty(line.productId, line.qty - 1); paint(); } }, '−'),
          h('span.n', String(line.qty)),
          h('button', { type: 'button', 'aria-label': '+', onclick: () => { setQty(line.productId, line.qty + 1); paint(); } }, '+'),
        ),
        h('button.icon-btn.sm', { type: 'button', 'aria-label': t('a.remove'), onclick: () => { setQty(line.productId, 0); paint(); } }, icon('trash')),
      ));
    }

    const me = store.me();
    host.appendChild(lines);
    host.appendChild(h('div.card.pad.stack.gap-3',
      h('div.row.between', h('span.b', t('shop.total')), h('span.b', { style: { color: 'var(--taro)' } }, money(total))),
      h('div.row.between.xs.mut-3', h('span', t('wallet.balance')), h('span', nfmt(me.taro || 0) + ' TARO')),
      h('span.chip.taro', icon('shield'), t('shop.escrow')),
      h('div.row.wrap.gap-2',
        h('button.btn.primary.grow', { type: 'button', onclick: () => checkout(total) }, icon('coin'), t('shop.checkout')),
        h('button.btn.ghost', {
          type: 'button',
          onclick: async () => {
            const ok = await confirm({ title: t('a.remove'), message: t('shop.empty'), danger: true, okLabel: t('a.remove') });
            if (!ok) return;
            store.commit('cart', (c) => { c.data.cart = []; c.touch('data'); });
            paint();
          },
        }, icon('trash'), t('a.remove')),
      ),
    ));
  }
  paint();
  return host;
}

function setQty(productId, qty) {
  store.commit('cart', (c) => {
    c.data.cart = (c.data.cart || []).map((l) => (l.productId === productId ? Object.assign({}, l, { qty: Math.max(0, qty) }) : l))
      .filter((l) => l.qty > 0);
    c.touch('data');
  });
}

async function checkout(total) {
  const me = store.me();
  if ((me.taro || 0) < total) {
    toast(t('toast.notAllowed') + ' · ' + t('wallet.topup'), 'bad', { label: t('wallet.topup'), fn: () => router.go('#/wallet') });
    return;
  }
  const ok = await confirm({
    title: t('shop.checkout'),
    message: t('shop.escrow') + ' — ' + money(total),
    okLabel: t('a.confirm'),
  });
  if (!ok) return;
  const items = (store.data().cart || []).map((l) => ({ productId: l.productId, qty: l.qty, price: l.price }));
  const orderId = 'or_' + Date.now().toString(36);
  store.add('orders', { id: orderId, userId: me.id, items, total, status: 'Payé · séquestre', at: Date.now(), escrow: 'bloqué' });
  store.add('transactions', { id: uid('tx'), at: Date.now(), label: t('shop.orders') + ' ' + orderId.slice(-6) + ' — ' + t('shop.escrow'), kind: 'séquestre', amount: -total, dir: 'out', held: true });
  store.update('users', me.id, { taro: (me.taro || 0) - total });
  for (const l of items) {
    const p = store.byId('products', l.productId);
    if (p) store.update('products', p.id, { stock: Math.max(0, (p.stock || 0) - l.qty), sold: (p.sold || 0) + l.qty });
  }
  store.commit('cart', (c) => { c.data.cart = []; c.touch('data'); });
  store.add('notifications', { id: uid('n'), kind: 'order', userId: me.id, at: Date.now(), text: t('shop.orders') + ' ' + orderId.slice(-6) + ' · ' + t('shop.escrow'), hash: '#/shop?tab=orders', read: false });
  toast(t('toast.saved'), 'ok');
  router.replaceQuery({ tab: 'orders' });
}

/* -------------------------------- commandes ----------------------------- */

function ordersView() {
  const list = (store.data().orders || []).slice().sort((a, b) => b.at - a.at);
  if (!list.length) return empty('box', t('empty.generic'));
  return h('div.stack.gap-3', list.map((o) => h('div.card.pad.stack.gap-2',
    h('div.row.between',
      h('span.b', t('shop.orders') + ' ' + o.id.slice(-6)),
      h('span.chip', { class: o.escrow === 'libéré' ? 'ok' : 'taro' }, icon('shield'), o.escrow || ''),
    ),
    h('div.stack.gap-1', (o.items || []).map((l) => {
      const p = store.byId('products', l.productId);
      return h('div.row.gap-2.sm', safeImg(p ? p.ref : null, { label: p ? p.title : '', alt: '', class: '', style: { width: '36px', height: '36px', 'border-radius': '8px', 'object-fit': 'cover' }, seed: l.productId }),
        h('span.grow.trunc', p ? p.title : l.productId), h('span.mut-3', '×' + l.qty));
    })),
    h('div.row.between.xs.mut-3', h('span', dateFmt(o.at)), h('span.b', money(o.total))),
    h('div.row.wrap.gap-2',
      h('span.chip', icon('box'), o.status || ''),
      o.escrow === 'bloqué' ? h('button.btn.sm.ok', {
        type: 'button',
        onclick: () => {
          store.update('orders', o.id, { escrow: 'libéré', status: 'Livré' });
          store.add('transactions', { id: uid('tx'), at: Date.now(), label: t('shop.orders') + ' ' + o.id.slice(-6) + ' — ' + t('a.ok'), kind: 'achat', amount: 0, dir: 'out' });
          toast(t('toast.saved'), 'ok');
          router.render();
        },
      }, icon('check'), t('a.confirm')) : null,
    ),
  )));
}

/* ------------------------------- mes ventes ----------------------------- */

function mineView() {
  const mine = (store.data().products || []).filter((p) => p.userId === store.session().meId);
  return h('div.stack.gap-3',
    h('div.row.wrap.gap-2',
      h('button.btn.primary', { type: 'button', onclick: () => sellSheet() }, icon('plus'), t('shop.sell')),
    ),
    mine.length
      ? h('div.grid-auto', mine.map((p) => {
        const card = productCard(p);
        card.querySelector('.acts').appendChild(h('button.icon-btn.sm', {
          type: 'button', 'aria-label': t('a.edit'), onclick: () => sellSheet(p),
        }, icon('edit')));
        card.querySelector('.acts').appendChild(h('button.icon-btn.sm', {
          type: 'button', 'aria-label': t('a.delete'),
          onclick: async () => {
            const ok = await confirm({ title: t('a.delete'), message: p.title, danger: true, okLabel: t('a.delete') });
            if (!ok) return;
            store.remove('products', p.id);
            toast(t('toast.deleted'), 'ok');
            router.render();
          },
        }, icon('trash')));
        return card;
      }))
      : empty('shop', t('empty.generic')),
  );
}

export function sellSheet(existing) {
  const draft = existing
    ? Object.assign({}, existing)
    : { title: '', price: 0, oldPrice: null, currency: 'XOF', category: '', desc: '', stock: 1, negotiable: true, escrow: true, ref: null, isTicket: false };

  const preview = h('div', { style: { 'border-radius': 'var(--r-md)', overflow: 'hidden', height: '150px', background: 'var(--surface-2)' } });
  function paintPreview() {
    const im = safeImg(draft.ref, { label: draft.title || t('shop.sell'), alt: '', seed: draft.title });
    im.style.width = '100%'; im.style.height = '100%'; im.style.objectFit = 'cover';
    mount(preview, im);
  }
  paintPreview();

  const titleIn = h('input.input', { type: 'text', value: draft.title, maxlength: 80 });
  const priceIn = h('input.input', { type: 'number', value: String(draft.price || ''), min: '0', step: '100' });
  const oldIn = h('input.input', { type: 'number', value: draft.oldPrice ? String(draft.oldPrice) : '', min: '0', step: '100' });
  const catIn = h('input.input', { type: 'text', value: draft.category, maxlength: 40 });
  const descIn = h('textarea.textarea');
  descIn.value = draft.desc || '';
  const stockIn = h('input.input', { type: 'number', value: String(draft.stock || 1), min: '0', step: '1' });
  const negIn = h('input', { type: 'checkbox', checked: draft.negotiable ? true : null });
  const escIn = h('input', { type: 'checkbox', checked: draft.escrow ? true : null });
  const tickIn = h('input', { type: 'checkbox', checked: draft.isTicket ? true : null });

  titleIn.addEventListener('input', () => { draft.title = titleIn.value; paintPreview(); });

  const m = sheet({
    title: existing ? t('a.edit') : t('shop.sell'),
    size: 'wide',
    body: h('div.stack.gap-3',
      preview,
      h('button.btn.sm.soft', {
        type: 'button',
        onclick: async () => {
          const files = await pickFile({ accept: 'image/*' });
          if (!files.length) return;
          const md = await toMedia(files[0]);
          if (!md) return;
          const edited = await editMedia(md, { ratio: '4:3', title: t('media.editor'), asSheet: true });
          draft.ref = (edited || md).ref;
          paintPreview();
        },
      }, icon('image'), t('media.pick')),
      h('div.field', h('label', t('profile.name')), titleIn),
      h('div.grid-2',
        h('div.field', h('label', t('owner.price')), priceIn),
        h('div.field', h('label', t('shop.offer')), oldIn),
      ),
      h('div.grid-2',
        h('div.field', h('label', t('search.tags')), catIn),
        h('div.field', h('label', t('owner.qty')), stockIn),
      ),
      h('div.field', h('label', t('profile.bio')), descIn),
      h('div.stack.gap-2',
        h('label.row.gap-2', negIn, h('span.sm', t('shop.negotiate'))),
        h('label.row.gap-2', escIn, h('span.sm', t('shop.escrow'))),
        h('label.row.gap-2', tickIn, h('span.sm', t('shop.ticket'))),
      ),
      h('p.xs.mut-3', t('profile.manualHint')),
    ),
    foot: [
      h('button.btn.ghost', { type: 'button', onclick: () => m.close() }, t('a.cancel')),
      h('button.btn.primary', {
        type: 'button',
        onclick: () => {
          const payload = {
            title: titleIn.value.trim(), price: Number(priceIn.value) || 0,
            oldPrice: oldIn.value ? Number(oldIn.value) : null,
            category: catIn.value.trim(), desc: descIn.value.trim(),
            stock: Number(stockIn.value) || 0,
            negotiable: !!negIn.checked, escrow: !!escIn.checked, isTicket: !!tickIn.checked,
            ref: draft.ref, currency: draft.currency || 'XOF',
          };
          if (!payload.title) { toast(t('toast.nothing'), 'bad'); return; }
          if (existing) store.update('products', existing.id, payload);
          else store.add('products', Object.assign({ id: uid('pr'), userId: store.session().meId, rating: 0, sold: 0, tags: [] }, payload));
          toast(t('toast.saved'), 'ok');
          m.close();
          router.render();
        },
      }, icon('check'), t('a.save')),
    ],
  });
}

/* ------------------------------ négociation ----------------------------- */

function negotiate(p) {
  const steps = [10, 20, 30];
  const offerIn = h('input.input', { type: 'number', value: String(Math.round(p.price * 0.9)), min: '0', step: '100' });
  const out = h('p.sm.mut');
  const paint = () => {
    const v = Number(offerIn.value) || 0;
    const pct = p.price ? Math.round((1 - v / p.price) * 100) : 0;
    out.textContent = money(v, p.currency) + ' · −' + pct + '%';
  };
  offerIn.addEventListener('input', paint);
  paint();

  const m = sheet({
    title: t('shop.negotiate') + ' · ' + p.title,
    size: 'slim',
    body: h('div.stack.gap-3',
      h('p.sm.mut', t('owner.price') + ' : ' + money(p.price, p.currency)),
      h('div.row.wrap.gap-2', steps.map((s) => h('button.chip.btn-like', {
        type: 'button',
        onclick: () => { offerIn.value = String(Math.round(p.price * (1 - s / 100))); paint(); },
      }, '−' + s + '%'))),
      h('div.field', h('label', t('shop.offer')), offerIn),
      out,
      h('span.chip.taro', icon('shield'), t('shop.escrow')),
    ),
    foot: [
      h('button.btn.ghost', { type: 'button', onclick: () => m.close() }, t('a.cancel')),
      h('button.btn.primary', {
        type: 'button',
        onclick: () => {
          const v = Number(offerIn.value) || 0;
          const floor = p.price * 0.7;
          if (v >= floor) {
            store.commit('cart', (c) => {
              if (!c.data.cart) c.data.cart = [];
              const line = c.data.cart.find((l) => l.productId === p.id);
              if (line) { line.qty += 1; line.price = v; }
              else c.data.cart.push({ productId: p.id, qty: 1, price: v });
              c.touch('data');
            });
            toast(t('shop.accepted') + ' · ' + money(v, p.currency), 'ok');
            m.close();
            router.replaceQuery({ tab: 'cart', id: null });
          } else {
            const counter = Math.round(floor);
            offerIn.value = String(counter);
            paint();
            toast(t('shop.offer') + ' : ' + money(counter, p.currency), 'info');
          }
        },
      }, icon('tag'), t('shop.offer')),
    ],
  });
}
