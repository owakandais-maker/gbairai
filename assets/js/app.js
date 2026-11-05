/* ==========================================================================
   app.js — assemblage de GBAIRAI ZONE
   · Barre du haut : globe réaliste (heure GMT dessous) + « GBAIRAI ZONE ».
   · Clic sur le globe : les options s'affichent en surcouche transparente,
     l'accueil reste visible derrière, et la sélection ferme le menu en
     menant directement à l'option demandée.
   · Le rail des tendances n'apparaît que sur l'accueil.
   · Barre du bas inchangée : Accueil, Shorts, +, Direct, Messages.
   ========================================================================== */

import { h, $, mount, clear, isPhone, isTablet, trapFocus, on as listen } from './core/dom.js';
import { icon } from './core/icons.js';
import { t, syncFromSettings, clockGMT, nfmt } from './core/i18n.js';
import * as store from './core/store.js';
import * as router from './core/router.js';
import * as actions from './core/actions.js';
import { toast, avatar, empty } from './core/ui.js';
import { warm as warmBlobs } from './core/idb.js';
import { createGlobe } from './features/globe.js';
import * as agent from './features/agent.js';
import { composerModal } from './views/home.js';
import { ensureDemoMedia } from './data/demoMedia.js';
import { apply as applySettings } from './views/settings.js';

import * as HomeView from './views/home.js';
import * as ShortsView from './views/shorts.js';
import * as ProfileView from './views/profile.js';
import * as MessagesView from './views/messages.js';
import * as LiveView from './views/live.js';
import * as ShopView from './views/shop.js';
import * as MiscView from './views/misc.js';
import * as SettingsView from './views/settings.js';
import * as OwnerView from './views/owner.js';

/* ------------------------------ initialisation -------------------------- */

store.init();
syncFromSettings();
applySettings();
actions.registerCore();

let currentCleanup = null;
let globeHandle = null;

/* --------------------------------- routes ------------------------------- */

router.on('/', (ctx, host) => HomeView.render(ctx, host), { rail: true });
router.on('/shorts', (ctx, host) => ShortsView.render(ctx, host));
router.on('/sound/:id', (ctx, host) => ShortsView.renderSound(ctx, host));
router.on('/shop', (ctx, host) => ShopView.render(ctx, host));
router.on('/live', (ctx, host) => LiveView.render(ctx, host));
router.on('/live/studio', (ctx, host) => LiveView.renderStudio(ctx, host));
router.on('/messages', (ctx, host) => MessagesView.render(ctx, host));
router.on('/messages/:id', (ctx, host) => MessagesView.render(ctx, host));
router.on('/call/:handle', (ctx, host) => MessagesView.renderCall(ctx, host));
router.on('/me', (ctx, host) => ProfileView.render(ctx, host));
router.on('/u/:handle', (ctx, host) => ProfileView.render(ctx, host));
router.on('/post/:id', (ctx, host) => MiscView.renderPost(ctx, host));
router.on('/notifications', (ctx, host) => MiscView.renderNotifications(ctx, host));
router.on('/saved', (ctx, host) => MiscView.renderSaved(ctx, host));
router.on('/wallet', (ctx, host) => MiscView.renderWallet(ctx, host));
router.on('/jobs', (ctx, host) => MiscView.renderJobs(ctx, host));
router.on('/groups', (ctx, host) => MiscView.renderGroups(ctx, host));
router.on('/events', (ctx, host) => MiscView.renderEvents(ctx, host));
router.on('/explore', (ctx, host) => MiscView.renderExplore(ctx, host));
router.on('/search', (ctx, host) => MiscView.renderSearch(ctx, host));
router.on('/settings', (ctx, host) => SettingsView.render(ctx, host));
router.on('/settings/:tab', (ctx, host) => SettingsView.render(ctx, host));
router.on('/owner', (ctx, host) => OwnerView.render(ctx, host));
router.on('/404', (ctx, host) => MiscView.renderNotFound(ctx, host));

/* -------------------------------- barre haute --------------------------- */

function buildTopbar() {
  const bar = $('#topbar');
  if (!bar) return;

  const canvas = h('canvas.globe', { width: 50, height: 50, 'aria-hidden': 'true' });
  const timeEl = h('span.gtime', clockGMT());
  const globeBtn = h('button.brand-globe', {
    type: 'button',
    'aria-label': t('nav.menu'),
    'aria-expanded': 'false',
    title: t('nav.menu') + ' · ' + clockGMT(),
    onclick: toggleMenu,
  }, canvas, timeEl);

  if (globeHandle) globeHandle.destroy();
  globeHandle = createGlobe(canvas, { size: 50, timeEl });

  const unread = (store.data().notifications || []).filter((n) => !n.read).length;
  const cart = (store.data().cart || []).reduce((n, l) => n + l.qty, 0);

  mount(bar,
    h('div.brand', globeBtn,
      h('a.brand-name', { href: '#/', 'aria-label': t('app.name') }, 'GBZN', h('small', 'ZONE')),
    ),
    h('div.zone-title', { 'aria-hidden': 'true' }, t('app.zone')),
    h('div.row.gap-1',
      h('a.icon-btn', { href: '#/search', 'aria-label': t('a.search'), title: t('a.search') }, icon('search')),
      h('a.icon-btn', {
        href: '#/notifications', 'aria-label': t('nav.notifications'), title: t('nav.notifications'),
        class: unread ? 'on' : '',
      }, icon('bell')),
      h('a.icon-btn.hide-sm', {
        href: '#/shop?tab=cart', 'aria-label': t('shop.cart'), title: t('shop.cart'),
        class: cart ? 'on' : '',
      }, icon('cart')),
      h('a', { href: '#/me', 'aria-label': t('nav.profile'), title: t('nav.profile') }, avatar(store.me(), 34)),
    ),
  );
}

/* ------------------------- menu d'options (globe) ----------------------- */

const MENU = () => [
  { kind: 'title', label: t('nav.sections') },
  { hash: '#/shorts', label: t('nav.shorts'), icon: 'shorts' },
  { hash: '#/shop', label: t('nav.shop'), icon: 'shop' },
  { hash: '#/live', label: t('nav.live'), icon: 'live' },
  { hash: '#/live/studio', label: t('live.studio'), icon: 'cut' },
  { hash: '#/messages', label: t('nav.messages'), icon: 'comment' },
  { hash: '#/me', label: t('nav.profile'), icon: 'user' },
  { kind: 'sep' },
  { kind: 'title', label: t('nav.more') },
  { hash: '#/explore', label: t('nav.explore'), icon: 'flame' },
  { hash: '#/notifications', label: t('nav.notifications'), icon: 'bell' },
  { hash: '#/saved', label: t('nav.saved'), icon: 'bookmark' },
  { hash: '#/wallet', label: t('nav.wallet'), icon: 'wallet' },
  { hash: '#/jobs', label: t('nav.jobs'), icon: 'brief' },
  { hash: '#/groups', label: t('nav.groups'), icon: 'users' },
  { hash: '#/events', label: t('nav.events'), icon: 'calendar' },
  { hash: '#/search', label: t('a.search'), icon: 'search' },
  { kind: 'sep' },
  { hash: '#/settings', label: t('nav.settings'), icon: 'settings' },
  store.isOwner() ? { hash: '#/owner', label: t('nav.owner'), icon: 'shield' } : null,
].filter(Boolean);

let menuRelease = null;

function openMenu() {
  const sb = $('#sidebar');
  if (!sb) return;
  const here = (router.ctx() || {}).hash || '#/';
  const nav = h('nav.sb-nav', { 'aria-label': t('nav.menu') });

  for (const item of MENU()) {
    if (item.kind === 'sep') { nav.appendChild(h('div.sb-sep')); continue; }
    if (item.kind === 'title') { nav.appendChild(h('div.sb-title', item.label)); continue; }
    const active = here === item.hash || (item.hash !== '#/' && here.startsWith(item.hash));
    nav.appendChild(h('a', {
      href: item.hash,
      class: active ? 'on' : '',
      // la sélection mène directement à l'option et referme le menu
      onclick: () => { closeMenu(); },
    }, icon(item.icon), h('span.grow', item.label)));
  }

  // bouton de l'agent, joignable depuis le menu aussi
  nav.appendChild(h('div.sb-sep'));
  nav.appendChild(h('a', {
    href: '#', onclick: (e) => { e.preventDefault(); closeMenu(); agent.openPanel(); },
  }, icon('sparkles'), h('span.grow', agent.agentName()), h('span.kbd', 'Ctrl K')));

  mount(sb, nav);
  sb.hidden = false;
  const btn = $('.brand-globe');
  if (btn) btn.setAttribute('aria-expanded', 'true');

  // le fond reste transparent : l'accueil se voit derrière
  sb.addEventListener('click', onScrim);
  document.addEventListener('keydown', onKey, true);
  menuRelease = trapFocus(nav);
}

function onScrim(e) {
  const sb = $('#sidebar');
  if (e.target === sb) closeMenu();
}
function onKey(e) { if (e.key === 'Escape') closeMenu(); }

function closeMenu() {
  const sb = $('#sidebar');
  if (!sb || sb.hidden) return;
  sb.hidden = true;
  clear(sb);
  sb.removeEventListener('click', onScrim);
  document.removeEventListener('keydown', onKey, true);
  if (menuRelease) { menuRelease(); menuRelease = null; }
  const btn = $('.brand-globe');
  if (btn) btn.setAttribute('aria-expanded', 'false');
}

function toggleMenu() {
  const sb = $('#sidebar');
  if (!sb) return;
  if (sb.hidden) openMenu(); else closeMenu();
}

/* -------------------------------- barre basse --------------------------- */

function buildTabbar() {
  const bar = $('#tabbar');
  if (!bar) return;
  const here = (router.ctx() || {}).hash || '#/';
  const items = [
    { hash: '#/', label: t('nav.home'), icon: 'home' },
    { hash: '#/shorts', label: t('nav.shorts'), icon: 'shorts' },
    { compose: true, label: t('nav.create'), icon: 'plus' },
    { hash: '#/live', label: t('nav.live'), icon: 'video' },
    { hash: '#/messages', label: t('nav.messages'), icon: 'comment' },
  ];
  mount(bar, items.map((it) => {
    if (it.compose) {
      return h('a.compose', {
        href: '#', 'aria-label': it.label,
        onclick: (e) => { e.preventDefault(); createSheet(); },
      }, icon(it.icon), h('span', it.label));
    }
    const active = it.hash === '#/' ? (here === '#/' || here === '') : here.startsWith(it.hash);
    return h('a', {
      href: it.hash, 'aria-current': active ? 'page' : null, 'aria-label': it.label,
    }, icon(it.icon), h('span', it.label));
  }));
}

function createSheet() {
  import('./core/ui.js').then(({ sheet }) => {
    const m = sheet({
      title: t('nav.create'),
      body: h('div.grid-auto',
        tile('comment', t('feed.publish'), () => { m.close(); composerModal(); }),
        tile('shorts', t('shorts.create'), () => { m.close(); ShortsView.createShort(); }),
        tile('sparkles', t('stories.add'), () => { m.close(); import('./features/parts.js').then((p) => p.storyComposer()); }),
        tile('live', t('live.goLive'), () => { m.close(); router.go('#/live/studio'); }),
        tile('shop', t('shop.sell'), () => { m.close(); ShopView.sellSheet(); }),
        tile('brief', t('jobs.post'), () => { m.close(); router.go('#/jobs'); }),
        tile('users', t('groups.create'), () => { m.close(); router.go('#/groups'); }),
        tile('calendar', t('events.create'), () => { m.close(); router.go('#/events'); }),
      ),
    });
  });
}

function tile(ic, label, fn) {
  return h('button.card.pad.hover', {
    type: 'button', onclick: fn,
    style: { display: 'grid', gap: '8px', 'justify-items': 'center', 'text-align': 'center' },
  }, icon(ic), h('span.sm.b', label));
}

/* ---------------------------------- rendu ------------------------------- */

let lastRenderedHash = null;

router.setRenderer((ctx, handler) => {
  // On ne referme le menu que lors d'une vraie navigation : un rafraîchissement
  // de fond (vidéos de démonstration prêtes, réglage modifié) ne doit pas le
  // faire disparaître sous les doigts.
  if (ctx.hash !== lastRenderedHash) closeMenu();
  lastRenderedHash = ctx.hash;
  if (currentCleanup) { try { currentCleanup(); } catch (e) { /* ignore */ } currentCleanup = null; }

  const view = $('#view');
  const rail = $('#rail');
  const main = $('#main');
  if (!view) return;

  // On détache proprement les médias de la vue quittée : sans cela, les
  // chargements en cours sont avortés et le navigateur signale des requêtes
  // en échec dans la console.
  releaseMedia(view);
  releaseMedia(rail);

  store.setSession({ lastView: ctx.hash });

  let result = null;
  try {
    result = handler ? handler(ctx, view) : MiscView.renderNotFound(ctx, view);
  } catch (e) {
    console.error('[gbzn] vue en erreur', e);
    mount(view, h('div.stack.gap-4',
      h('h1', t('err.title')),
      empty('warn', t('err.view'),
        h('div.row.gap-2',
          h('button.btn.primary', { type: 'button', onclick: () => router.render() }, icon('refresh'), t('err.reload')),
          h('a.btn.ghost', { href: '#/' }, icon('home'), t('nav.home')),
        )),
    ));
  }
  if (result && result.cleanup) currentCleanup = result.cleanup;

  // Le rail n'existe que sur l'accueil : partout ailleurs la vue prend
  // toute la largeur, comme demandé.
  const isHome = ctx.path === '/' || ctx.path === '';
  const railNode = isHome && result && result.rail ? result.rail : null;
  if (rail && main) {
    if (railNode) {
      mount(rail, railNode);
      rail.hidden = false;
      main.classList.add('has-rail');
    } else {
      clear(rail);
      rail.hidden = true;
      main.classList.remove('has-rail');
    }
  }

  buildTopbar();
  buildTabbar();
  document.title = titleFor(ctx) + ' — ' + t('app.name');
});

/** Arrête et détache tous les médias d'un conteneur avant de le remplacer. */
function releaseMedia(root) {
  if (!root) return;
  const list = root.querySelectorAll ? root.querySelectorAll('video, audio') : [];
  for (const el of list) {
    try {
      el.pause();
      if (el.srcObject) {
        for (const tr of el.srcObject.getTracks ? el.srcObject.getTracks() : []) tr.stop();
        el.srcObject = null;
      }
      el.removeAttribute('src');
      while (el.firstChild) el.removeChild(el.firstChild);
      el.load();
    } catch (e) { /* élément déjà détaché */ }
  }
}

function titleFor(ctx) {
  const map = {
    '/': t('nav.home'), '/shorts': t('nav.shorts'), '/shop': t('nav.shop'),
    '/live': t('nav.live'), '/live/studio': t('live.studio'), '/messages': t('nav.messages'),
    '/me': t('nav.profile'), '/notifications': t('nav.notifications'), '/saved': t('nav.saved'),
    '/wallet': t('nav.wallet'), '/jobs': t('nav.jobs'), '/groups': t('nav.groups'),
    '/events': t('nav.events'), '/explore': t('nav.explore'), '/search': t('search.title'),
    '/settings': t('set.title'), '/owner': t('owner.title'),
  };
  return map[ctx.path] || t('app.zone');
}

/* --------------------------- réactions globales ------------------------- */

store.subscribe((label) => {
  if (label === 'settings') { applySettings(); }
  if (label === 'settings' || label === 'import' || label === 'reset') {
    buildTopbar();
    buildTabbar();
    agent.refreshFab();
  }
});

// Changement de largeur : certaines vues s'organisent autrement.
let lastClass = widthClass();
function widthClass() { return isPhone() ? 'p' : (isTablet() ? 't' : 'd'); }
window.addEventListener('resize', () => {
  const c = widthClass();
  if (c !== lastClass) { lastClass = c; router.render(); }
});

// Thème système
try {
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (store.settings().theme === 'system') applySettings();
  });
} catch (e) { /* navigateur ancien */ }

// État réseau
window.addEventListener('offline', () => toast(t('toast.offline'), 'info'));
window.addEventListener('online', () => toast(t('toast.online'), 'ok'));

// Sauvegarde garantie avant fermeture
window.addEventListener('pagehide', () => store.flushNow());
window.addEventListener('beforeunload', () => store.flushNow());

// Filet de sécurité : une erreur isolée ne doit pas figer l'application
window.addEventListener('error', (e) => {
  if (e && e.message && /ResizeObserver|Script error/.test(e.message)) return;
  console.error('[gbzn]', e.message || e);
});
window.addEventListener('unhandledrejection', (e) => {
  console.error('[gbzn] promesse rejetée', e.reason);
  e.preventDefault();
});

/* -------------------------------- démarrage ----------------------------- */

function warmMedia() {
  const d = store.data();
  const refs = [];
  for (const u of d.users) { if (u.avatar) refs.push(u.avatar); if (u.banner) refs.push(u.banner); }
  for (const p of d.posts) for (const md of p.media || []) if (md.ref) refs.push(md.ref);
  for (const v of d.shorts) if (v.ref) refs.push(v.ref);
  for (const s of d.stories) if (s.ref) refs.push(s.ref);
  for (const p of d.products) if (p.ref) refs.push(p.ref);
  for (const a of d.ads || []) if (a.ref) refs.push(a.ref);
  if (store.settings().agentAvatar) refs.push(store.settings().agentAvatar);
  return warmBlobs(refs);
}

async function boot() {
  buildTopbar();
  buildTabbar();
  agent.mountFab();
  agent.bindShortcuts();

  // Première route : réglage « écran de démarrage » respecté si on arrive à la racine.
  if (!location.hash || location.hash === '#' || location.hash === '#/') {
    const start = store.settings().startView;
    if (start && start !== 'home') {
      const map = { shorts: '#/shorts', shop: '#/shop', messages: '#/messages' };
      if (map[start]) { try { location.hash = map[start]; } catch (e) { /* cadre restreint */ } }
    }
  }

  router.start();

  await warmMedia();
  router.render();

  // Vidéos de démonstration réelles, pour que le lecteur ait de la matière.
  ensureDemoMedia().then(() => {
    const p = (router.ctx() || {}).path;
    if (p === '/shorts' || p === '/' || p === '/explore' || p === '/live') router.render();
  }).catch(() => { /* repli affiche fixe */ });

  // Service worker : fonctionnement hors ligne. Inutile dans un cadre
  // intégré, où il est de toute façon refusé.
  const standalone = (() => { try { return window.top === window.self; } catch (e) { return false; } })();
  if (standalone && 'serviceWorker' in navigator && location.protocol !== 'file:') {
    try { await navigator.serviceWorker.register('./sw.js', { scope: './' }); }
    catch (e) { /* hors ligne non disponible, l'application reste utilisable */ }
  }
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
else boot();

/* --------------------- actions supplémentaires d'OWAK ------------------- */

actions.register({
  id: 'openMenu', label: t('nav.menu'),
  keywords: ['ouvre le menu', 'affiche les options', 'menu de la zone', 'open menu'],
  run: () => { openMenu(); return { say: t('nav.menu') }; },
});

actions.register({
  id: 'createContent', label: t('nav.create'),
  keywords: ['cree', 'creer', 'nouveau contenu', 'create'],
  run: () => { createSheet(); return { say: t('nav.create') }; },
});

actions.register({
  id: 'callAgent', label: t('agent.call'),
  keywords: ['appelle moi', 'appel vocal avec toi', 'appelle owak', 'call you'],
  run: (args, ctx) => {
    const video = /video|vidéo/i.test(ctx.phrase || '');
    agent.startCall(video ? 'video' : 'audio');
    return { say: video ? t('agent.videoCall') : t('agent.call') };
  },
});

actions.register({
  id: 'changeAgentLook', label: t('agent.identity'),
  keywords: ['change ton apparence', 'change ta voix', 'change de visage', 'change ton nom',
    'ton avatar', 'ta photo', 'change your voice', 'change your look'],
  run: () => { agent.identitySheet(); return { say: t('agent.identity') }; },
});
