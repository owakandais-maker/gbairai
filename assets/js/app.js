/**
 * app.js — bootstrap: shell, hash router, theme engine, keyboard shortcuts,
 * PWA install, and the action bus every view calls into.
 */

import { h, icon, render, $, $$, observeReveals, debounce, paintImageFallback } from './dom.js';
import { t, localise, setLocale, detectLocale, getLocale, meta, LOCALES, num } from './i18n.js';
import * as store from './store.js';
import { toast, modal, drawer, videoModal, commandPalette, popover, closeAllLayers } from './ui.js';
import {
  JOBS, CANDIDATES, SEED_ADS, SEED_WALLET, SEED_CHAT, ME,
} from './data.js';
import {
  homePage, seekerPage, employerPage, walletPage, studioPage,
  jobDrawer, candidateDrawer, resetFilters, filterJobs, refreshFavouriteButtons,
} from './views.js';
import {
  mountChat, mountAI, mountAdStage, openPanel, closePanel, togglePanel, isPanelOpen,
  pushMessage, paintChat, pushAI, setAIValue, setMicState, aiEmpty,
  openPitchForm, openOfferForm, openAdsManager, openAlertsManager,
  openNotifications, pushNotification, stopCarousel,
} from './features.js';
import {
  speak, stopSpeaking, createListener, recognitionSupported, parseIntent, speechSupported,
} from './ai.js';

/* ------------------------------------------------------------- routing */

const ROUTES = ['home', 'jobs', 'recruit', 'wallet', 'studio'];
const DEFAULT_ROUTE = 'home';

/**
 * Routes are plain `#jobs` hashes. A leading slash from older links is still
 * accepted, and some embedding contexts only propagate `#name` form.
 */
function routeFromHash() {
  const raw = decodeURIComponent(location.hash.replace(/^#\/?/, '')).split(/[?&]/)[0].trim();
  return ROUTES.includes(raw) ? raw : DEFAULT_ROUTE;
}

/* --------------------------------------------------------------- theme */

const systemDark = window.matchMedia?.('(prefers-color-scheme: dark)');

function resolveTheme(pref) {
  if (pref === 'light' || pref === 'dark') return pref;
  return systemDark?.matches ? 'dark' : 'light';
}

function applyTheme() {
  const pref = store.get().theme;
  const effective = resolveTheme(pref);
  document.documentElement.dataset.theme = effective;
  document.querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', effective === 'dark' ? '#070b16' : '#f6f7fb');

  const btn = $('#theme-btn');
  if (btn) {
    const iconName = pref === 'system'
      ? 'fa-solid fa-circle-half-stroke'
      : effective === 'dark' ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
    render(btn, icon(iconName));
    btn.setAttribute('aria-label', `${t('a11y.theme')} — ${t(`theme.${pref}`)}`);
    btn.title = t(`theme.${pref}`);
  }
}

systemDark?.addEventListener?.('change', () => {
  if (store.get().theme === 'system') applyTheme();
});

/* ------------------------------------------------------------ actions */

let listener = null;

const actions = {
  go(route, { force = false, push = true } = {}) {
    const next = ROUTES.includes(route) ? route : DEFAULT_ROUTE;
    if (next === store.get().route && !force) return;
    if (next === 'jobs' || next === 'recruit') {
      store.set({ role: next === 'jobs' ? 'seeker' : 'employer' });
    }
    store.set({ route: next });
    if (push) {
      const target = `#${next}`;
      if (location.hash !== target) {
        // replaceState/pushState can be refused in sandboxed frames; the hash
        // assignment below is the fallback that always works.
        try { history.pushState(null, '', target); }
        catch { location.hash = next; }
      }
    }
    paintRoute();
  },

  openJob(id) {
    const job = JOBS.find((j) => j.id === id);
    if (!job) return;
    drawer({ build: (ctx) => jobDrawer(job, ctx, actions) });
  },

  openCandidate(id) {
    const cand = CANDIDATES.find((c) => c.id === id);
    if (!cand) return;
    drawer({ build: (ctx) => candidateDrawer(cand, ctx, actions) });
  },

  playCandidate(id) {
    const cand = CANDIDATES.find((c) => c.id === id);
    if (!cand) return;
    videoModal({ title: cand.name, subtitle: `${cand.role} — ${cand.location}`, poster: cand.cover });
  },

  playVideo(title, subtitle) { videoModal({ title, subtitle, poster: ME.avatar }); },

  toggleFavourite(id) {
    const favourites = store.get().favourites;
    const i = favourites.indexOf(id);
    const adding = i < 0;
    const next = adding ? [...favourites, id] : favourites.filter((x) => x !== id);
    store.set({ favourites: next });
    toast(adding ? t('job.fav.add') : t('job.fav.remove'), '', 'info', { duration: 1900 });
    // Repaint only when the favourites-only filter changes which cards belong.
    if (refreshFavouriteButtons() && store.get().route === 'jobs') paintRoute();
    return adding;
  },

  toggleSavedCandidate(id) {
    const saved = store.get().savedCandidates;
    const adding = !saved.includes(id);
    store.set({ savedCandidates: adding ? [...saved, id] : saved.filter((x) => x !== id) });
    toast(t('cand.saved'), '', 'info', { duration: 1900 });
    return adding;
  },

  applyToJob(job) {
    toast(t('job.applied'), t('job.applied.desc'), 'success');
    pushNotification(t('job.applied'), `${job.title} — ${job.company}`);
  },

  contactCandidate(cand) {
    toast(t('cand.sent'), t('cand.sent.desc'), 'success');
    pushNotification(t('cand.sent'), cand.name);
  },

  addComment(key, text) {
    const comments = store.get().comments;
    if (!comments[key]) comments[key] = [];
    comments[key].push({
      id: `c${Date.now().toString(36)}`, author: t('chat.you'),
      text: String(text).slice(0, 500), locale: getLocale(), at: Date.now(), shownLocale: null,
    });
    store.touch('comments');
  },

  walletAction(kind) {
    const labels = { topup: t('wallet.topup'), send: t('wallet.send'), tickets: t('wallet.tickets') };
    modal({
      title: labels[kind] || t('wallet.title'), small: true,
      body: h('p.text-muted', { text: t('common.loading') }),
      actions: [{ label: t('common.close'), kind: 'btn-ghost' }],
    });
  },

  toggleLive() {
    const on = !store.get().liveOn;
    store.set({ liveOn: on });
    toast(on ? t('studio.started') : t('studio.stopped'), on ? t('studio.started.desc') : '', on ? 'success' : 'info');
  },

  openAds()    { openAdsManager(() => { refreshAdStage(); if (['wallet', 'studio'].includes(store.get().route)) paintRoute(); }); },
  openAlerts() { openAlertsManager(); },
  openPitch()  { openPitchForm(); },
  openOffer()  { openOfferForm(); },
  openChat()   { openPanel('chat-panel'); },
  openAI()     { openAIPanel(); },
  openNotifs() { openNotifications(); const d = $('#notif-dot'); if (d) d.hidden = true; },

  setLocale(code) {
    const applied = setLocale(code);
    store.set({ locale: applied });
    stopSpeaking();
    rebuildShell();
    toast(meta(applied).label, '', 'info', { duration: 1800 });
  },

  cycleTheme() {
    const order = ['system', 'light', 'dark'];
    const next = order[(order.indexOf(store.get().theme) + 1) % order.length];
    store.set({ theme: next });
    applyTheme();
    toast(t('a11y.theme'), t(`theme.${next}`), 'info', { duration: 1800 });
  },

  toggleCreator() {
    const on = !store.get().creator;
    store.set({ creator: on });
    document.body.classList.toggle('is-creator', on);
    toast(on ? t('creator.on') : t('creator.off'), '', on ? 'success' : 'info');
    paintRoute();
  },

  openPalette() { commandPalette(buildCommands()); },
};

/* ---------------------------------------------------------- AI panel */

function openAIPanel() {
  const first = aiEmpty();
  togglePanel('ai-panel');
  if (first && isPanelOpen('ai-panel')) pushAI('assistant', t('ai.hint'));
}

function handleAI(utterance) {
  pushAI('user', utterance);
  const { intent, query } = parseIntent(utterance);
  const reply = runIntent(intent, query);
  setTimeout(() => pushAI('assistant', reply), 260);
}

function runIntent(intent, query) {
  const f = store.get().filters;

  switch (intent) {
    case 'jobs':    actions.go('jobs');    return t('nav.jobs');
    case 'recruit': actions.go('recruit'); return t('nav.recruit');
    case 'home':    actions.go('home');    return t('nav.home');
    case 'wallet':  actions.go('wallet');  return `${t('wallet.balance')}: ${num(store.get().wallet.balance)} TARO`;
    case 'studio':  actions.go('studio');  return t('studio.title');
    case 'pitch':   actions.openPitch();   return t('upload.title');
    case 'offer':   actions.openOffer();   return t('offer.title');
    case 'chat':    openPanel('chat-panel'); return t('chat.title');
    case 'ads':     actions.openAds();     return t('ads.title');
    case 'alerts':  actions.openAlerts();  return `${t('alert.list')}: ${store.get().alerts.length}`;
    case 'install': promptInstall();       return t('install.cta');
    case 'theme':   actions.cycleTheme();  return t(`theme.${store.get().theme}`);

    case 'favs': {
      f.favOnly = true;
      actions.go('jobs', { force: true });
      return `${t('seeker.favonly')}: ${store.get().favourites.length}`;
    }
    case 'remote': {
      f.remote = true;
      actions.go('jobs', { force: true });
      return `${t('seeker.remote')} — ${t('seeker.results', { n: filterJobs().length })}`;
    }
    case 'reset': {
      resetFilters();
      actions.go('jobs', { force: true });
      return t('seeker.clear');
    }
    case 'reco': {
      actions.go('jobs', { force: true });
      document.getElementById('reco-box')?.scrollIntoView({ block: 'center' });
      return t('seeker.reco');
    }
    case 'translate': {
      openPanel('chat-panel');
      return t('chat.translate');
    }
    case 'search': {
      f.text = query;
      f.favOnly = false;
      actions.go('jobs', { force: true });
      return `${query} — ${t('seeker.results', { n: filterJobs().length })}`;
    }
    case 'help':
    default:
      return t('ai.hint');
  }
}

/* ---------------------------------------------------- command palette */

function buildCommands() {
  const nav = [
    ['home', 'nav.home', 'fa-solid fa-house'],
    ['jobs', 'nav.jobs', 'fa-solid fa-magnifying-glass'],
    ['recruit', 'nav.recruit', 'fa-solid fa-briefcase'],
    ['wallet', 'nav.wallet', 'fa-solid fa-wallet'],
    ['studio', 'nav.studio', 'fa-solid fa-tower-broadcast'],
  ].map(([route, key, ic]) => ({
    group: t('cmdk.pages'), label: t(key), icon: ic, run: () => actions.go(route),
  }));

  const acts = [
    { label: t('seeker.pitch'), icon: 'fa-solid fa-video', run: actions.openPitch },
    { label: t('employer.offer'), icon: 'fa-solid fa-plus', run: actions.openOffer },
    { label: t('ads.title'), icon: 'fa-solid fa-sliders', run: actions.openAds },
    { label: t('alert.list'), icon: 'fa-solid fa-bell', run: actions.openAlerts },
    { label: t('chat.title'), icon: 'fa-regular fa-comments', run: () => openPanel('chat-panel') },
    { label: t('ai.title'), icon: 'fa-solid fa-robot', run: openAIPanel },
    { label: `${t('a11y.theme')} — ${t(`theme.${store.get().theme}`)}`, icon: 'fa-solid fa-circle-half-stroke', run: actions.cycleTheme },
    { label: t('a11y.creator'), icon: 'fa-solid fa-crown', run: actions.toggleCreator },
    { label: t('seeker.clear'), icon: 'fa-solid fa-rotate-left', run: () => { resetFilters(); actions.go('jobs', { force: true }); } },
    { label: t('install.cta'), icon: 'fa-solid fa-download', run: promptInstall },
  ].map((c) => ({ ...c, group: t('cmdk.actions') }));

  const langs = LOCALES.map((l) => ({
    group: t('a11y.lang'), label: `${l.flag} ${l.label}`, icon: 'fa-solid fa-globe',
    run: () => actions.setLocale(l.code),
  }));

  const jobs = JOBS.map((job) => ({
    group: t('cmdk.jobs'), label: job.title, hint: `${job.company} • ${job.location}`,
    icon: 'fa-solid fa-briefcase', run: () => actions.openJob(job.id),
  }));

  return [...nav, ...acts, ...langs, ...jobs];
}

/* ---------------------------------------------------------------- PWA */

let installPrompt = null;

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  installPrompt = e;
  $('#install-btn')?.removeAttribute('hidden');
});

window.addEventListener('appinstalled', () => {
  installPrompt = null;
  $('#install-btn')?.setAttribute('hidden', '');
  toast(t('install.done'), '', 'success');
});

function promptInstall() {
  if (!installPrompt) {
    toast(t('install.cta'), t('common.offline.desc'), 'info');
    return;
  }
  installPrompt.prompt();
  installPrompt.userChoice?.finally(() => { installPrompt = null; });
}

async function registerServiceWorker() {
  if (!('serviceWorker' in navigator) || location.protocol === 'file:') return;
  try { await navigator.serviceWorker.register('./sw.js', { scope: './' }); }
  catch { /* offline support is optional; the app works without it */ }
}

/* -------------------------------------------------------------- shell */

function navLink(route, key) {
  return h('a.nav-link', {
    href: `#${route}`, dataset: { route },
    'aria-current': store.get().route === route ? 'page' : null,
    text: t(key),
    on: { click: (e) => { e.preventDefault(); actions.go(route); } },
  });
}

function tabLink(route, key, iconName) {
  return h('a.tab', {
    href: `#${route}`, dataset: { route },
    'aria-current': store.get().route === route ? 'page' : null,
    on: { click: (e) => { e.preventDefault(); actions.go(route); } },
  }, [icon(iconName), h('span', { text: t(key) })]);
}

function buildNav() {
  const langBtn = h('button.icon-btn', {
    type: 'button', id: 'lang-btn', 'aria-haspopup': 'true', 'aria-expanded': 'false',
    dataset: { tool: 'secondary' },
    'aria-label': t('a11y.lang'), title: t('a11y.lang'),
  }, icon('fa-solid fa-globe'));

  langBtn.addEventListener('click', () => {
    popover(langBtn, (close) => LOCALES.map((l) => h('button.menu-item', {
      type: 'button', role: 'menuitemradio',
      'aria-checked': l.code === getLocale() ? 'true' : 'false',
      on: { click: () => { close(); actions.setLocale(l.code); } },
    }, [
      h('span', { text: l.flag }),
      h('span.grow', { text: l.label }),
      l.code === getLocale() ? icon('fa-solid fa-check', 'check') : null,
    ])));
  });

  const moreBtn = h('button.icon-btn', {
    type: 'button', id: 'nav-more', 'aria-haspopup': 'true', 'aria-expanded': 'false',
    'aria-label': t('a11y.menu'), title: t('a11y.menu'),
  }, icon('fa-solid fa-ellipsis'));

  // The tools hidden by the narrow-screen media query stay reachable here.
  moreBtn.addEventListener('click', () => {
    popover(moreBtn, (close) => {
      const item = (label, iconName, run, extra = {}) => h('button.menu-item', {
        type: 'button', role: 'menuitem', ...extra,
        on: { click: () => { close(); run(); } },
      }, [icon(iconName), h('span.grow', { text: label })]);

      const rows = [
        h('p.menu-head', { text: t('a11y.lang') }),
        ...LOCALES.map((l) => h('button.menu-item', {
          type: 'button', role: 'menuitemradio',
          'aria-checked': l.code === getLocale() ? 'true' : 'false',
          on: { click: () => { close(); actions.setLocale(l.code); } },
        }, [h('span', { text: l.flag }), h('span.grow', { text: l.label })])),
        h('div.menu-sep'),
        item(t('a11y.chat'), 'fa-regular fa-comments', () => togglePanel('chat-panel')),
        item(t('a11y.creator'), 'fa-solid fa-crown', actions.toggleCreator,
          { 'aria-checked': store.get().creator ? 'true' : 'false', role: 'menuitemcheckbox' }),
      ];
      if (installPrompt) rows.push(item(t('install.cta'), 'fa-solid fa-download', promptInstall));
      return rows;
    });
  });

  return h('header.nav.glass', { id: 'navbar' }, h('div.shell.nav-inner', null, [
    h('a.brand', {
      href: '#home', 'aria-label': t('app.name'),
      on: { click: (e) => { e.preventDefault(); actions.go('home'); } },
    }, [
      h('span.brand-mark', { text: 'G', 'aria-hidden': 'true' }),
      h('span.brand-name.gradient-text', { text: 'GBAIRAI TRAVAIL' }),
    ]),

    h('nav.nav-links', { 'aria-label': t('a11y.menu') }, [
      navLink('home', 'nav.home'),
      navLink('jobs', 'nav.seeker'),
      navLink('recruit', 'nav.employer'),
      navLink('wallet', 'nav.wallet'),
      navLink('studio', 'nav.studio'),
    ]),

    h('div.nav-tools', null, [
      h('button.icon-btn', {
        type: 'button', id: 'cmdk-btn', 'aria-label': t('a11y.cmdk'), title: `${t('a11y.cmdk')} (Ctrl+K)`,
        on: { click: actions.openPalette },
      }, icon('fa-solid fa-magnifying-glass')),

      h('button.icon-btn', {
        type: 'button', id: 'install-btn', hidden: true, dataset: { tool: 'secondary' },
        'aria-label': t('install.cta'), title: t('install.cta'),
        on: { click: promptInstall },
      }, icon('fa-solid fa-download')),

      langBtn,

      h('button.icon-btn', {
        type: 'button', id: 'theme-btn', on: { click: actions.cycleTheme },
      }, icon('fa-solid fa-moon')),

      h('button.icon-btn', {
        type: 'button', id: 'creator-btn', dataset: { tool: 'secondary' },
        'aria-pressed': store.get().creator ? 'true' : 'false',
        'aria-label': t('a11y.creator'), title: t('a11y.creator'),
        on: { click: (e) => { actions.toggleCreator(); e.currentTarget.setAttribute('aria-pressed', store.get().creator ? 'true' : 'false'); } },
      }, icon('fa-solid fa-crown')),

      h('button.icon-btn', {
        type: 'button', dataset: { tool: 'secondary' },
        'aria-label': t('a11y.chat'), title: t('a11y.chat'),
        on: { click: () => togglePanel('chat-panel') },
      }, [icon('fa-regular fa-comments'), h('span.badge-dot.live', { 'aria-hidden': 'true' })]),

      moreBtn,

      h('button.icon-btn', {
        type: 'button', 'aria-label': t('a11y.notifs'), title: t('a11y.notifs'),
        on: { click: actions.openNotifs },
      }, [
        icon('fa-regular fa-bell'),
        h('span.badge-dot.alert', {
          id: 'notif-dot', 'aria-hidden': 'true',
          hidden: store.get().notifications.length === 0,
        }),
      ]),

      h('button.icon-btn', {
        type: 'button', 'aria-label': t('a11y.profile'), title: ME.name,
        style: 'width:38px;height:38px;padding:0;overflow:hidden;border-radius:50%',
        on: { click: actions.openPitch },
      }, h('img.avatar', {
        src: ME.avatar, alt: '', width: '38', height: '38',
        style: 'width:38px;height:38px', loading: 'lazy', decoding: 'async',
        on: { error: (e) => paintImageFallback(e.currentTarget, ME.name) },
      })),
    ]),
  ]));
}

function buildTabbar() {
  return h('nav.tabbar', { 'aria-label': t('a11y.menu') }, [
    tabLink('home', 'nav.home', 'fa-solid fa-house'),
    tabLink('jobs', 'nav.jobs', 'fa-solid fa-magnifying-glass'),
    h('div.tab-fab', null, h('button.fab', {
      type: 'button',
      'aria-label': store.get().role === 'seeker' ? t('seeker.pitch') : t('employer.offer'),
      on: { click: () => (store.get().role === 'seeker' ? actions.openPitch() : actions.openOffer()) },
    }, icon('fa-solid fa-plus'))),
    tabLink('recruit', 'nav.recruit', 'fa-solid fa-briefcase'),
    tabLink('wallet', 'nav.wallet', 'fa-solid fa-wallet'),
  ]);
}

function buildDock() {
  return h('div.dock', null, [
    h('button.dock-fab', {
      type: 'button', id: 'dock-ai', 'aria-label': t('a11y.ai'), title: t('ai.title'),
      on: { click: openAIPanel },
    }, [
      icon('fa-solid fa-robot'),
      h('span.badge-dot.live', { 'aria-hidden': 'true' }),
    ]),
  ]);
}

/* ------------------------------------------------------------ painting */

const PAGES = {
  home: homePage,
  jobs: seekerPage,
  recruit: employerPage,
  wallet: walletPage,
  studio: studioPage,
};

function paintRoute() {
  const route = store.get().route;
  const main = $('#main');
  if (!main) return;

  stopCarousel();
  const build = PAGES[route] || PAGES.home;
  render(main, h('div.shell', null, build(actions)));

  $$('[data-route]').forEach((el) => {
    const active = el.dataset.route === route
      || (route === 'jobs' && el.dataset.route === 'jobs')
      || (route === 'recruit' && el.dataset.route === 'recruit');
    active ? el.setAttribute('aria-current', 'page') : el.removeAttribute('aria-current');
  });

  if (route === 'home') refreshAdStage();

  document.title = `${t(route === 'home' ? 'nav.home' : routeTitleKey(route))} — GBAIRAI TRAVAIL`;
  observeReveals(main);
  main.scrollIntoView({ block: 'start', behavior: 'auto' });
}

function routeTitleKey(route) {
  return { jobs: 'nav.jobs', recruit: 'nav.recruit', wallet: 'nav.wallet', studio: 'nav.studio' }[route] || 'nav.home';
}

function refreshAdStage() {
  mountAdStage($('#ad-stage-host'), { onManage: actions.openAds });
}

/** Rebuild chrome + page after a locale change (text direction included). */
function rebuildShell() {
  const openChat = isPanelOpen('chat-panel');
  const openAi = isPanelOpen('ai-panel');
  closeAllLayers();

  $('#navbar')?.remove();
  $('.tabbar')?.remove();
  $('.dock')?.remove();
  $('#chat-panel')?.remove();
  $('#ai-panel')?.remove();

  document.body.prepend(buildNav());
  document.body.append(buildTabbar(), buildDock());
  mountChat(document.body);
  mountAI(document.body, { onSubmit: handleAI, onToggleMic: toggleMic });

  localise(document);
  applyTheme();
  paintRoute();

  if (openChat) openPanel('chat-panel');
  if (openAi) openPanel('ai-panel');
}

/* ----------------------------------------------------------------- mic */

function toggleMic() {
  if (!recognitionSupported()) {
    toast(t('ai.title'), t('ai.unsupported'), 'warn');
    return;
  }
  if (!listener) {
    listener = createListener({
      onStart: () => { store.set({ listening: true }); setMicState(true); pushAI('assistant', t('ai.listening')); },
      onEnd:   () => { store.set({ listening: false }); setMicState(false); },
      onResult: (text) => { setAIValue(''); handleAI(text); },
      onError: (code) => {
        const msg = code === 'not-allowed' || code === 'service-not-allowed'
          ? t('ai.unsupported')
          : code === 'no-speech' ? t('ai.listening') : t('common.offline.desc');
        toast(t('ai.title'), msg, 'warn', { duration: 3200 });
      },
    });
  }
  listener.toggle();
}

/* ---------------------------------------------------------- shortcuts */

function bindShortcuts() {
  document.addEventListener('keydown', (e) => {
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target?.tagName)
      || e.target?.isContentEditable;

    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      actions.openPalette();
      return;
    }
    if (typing) return;

    if (e.key === '/') { e.preventDefault(); actions.openPalette(); return; }
    if (e.key === '?') { e.preventDefault(); showShortcuts(); return; }

    const map = { g: null, h: 'home', j: 'jobs', r: 'recruit', w: 'wallet', s: 'studio' };
    if (!e.ctrlKey && !e.metaKey && !e.altKey && map[e.key.toLowerCase()]) {
      actions.go(map[e.key.toLowerCase()]);
    }
  });
}

function showShortcuts() {
  const rows = [
    ['Ctrl / ⌘ + K', t('a11y.cmdk')],
    ['/', t('common.search')],
    ['H', t('nav.home')], ['J', t('nav.jobs')], ['R', t('nav.recruit')],
    ['W', t('nav.wallet')], ['S', t('nav.studio')],
    ['Esc', t('common.close')],
  ];
  modal({
    title: `${t('a11y.cmdk')} — ?`, small: true,
    body: h('div.stack.gap-2', null, rows.map(([keys, label]) =>
      h('div.row.between.gap-4', null, [
        h('span', { text: label, style: 'font-size:.86rem' }),
        h('span.kbd', { text: keys }),
      ]))),
    actions: [{ label: t('common.close'), kind: 'btn-ghost' }],
  });
}

/* ------------------------------------------------------- connectivity */

function bindConnectivity() {
  const sync = () => {
    const online = navigator.onLine;
    if (online === store.get().online) return;
    store.set({ online });
    toast(online ? t('common.online') : t('common.offline'),
      online ? '' : t('common.offline.desc'),
      online ? 'success' : 'warn');
  };
  window.addEventListener('online', sync);
  window.addEventListener('offline', sync);
}

/* -------------------------------------------------------------- boot */

function seedOnce() {
  const s = store.get();
  if (!s.ads) store.set({ ads: SEED_ADS.slice() });
  if (!s.wallet) store.set({ wallet: structuredClone(SEED_WALLET) });
  if (!Array.isArray(s.chat) || !s.chat.length) {
    store.set({ chat: SEED_CHAT.map((m) => ({ ...m, kind: 'user', mine: false })) });
  }
}

function boot() {
  // Locale first: text direction affects every subsequent measurement.
  const locale = detectLocale(store.get().locale);
  setLocale(locale);
  store.set({ locale });

  seedOnce();
  document.body.classList.toggle('is-creator', store.get().creator);

  // Deep link + creator flag via query string (?creator=1).
  const params = new URLSearchParams(location.search);
  if (params.get('creator') === '1' && !store.get().creator) {
    store.set({ creator: true });
    document.body.classList.add('is-creator');
  }
  store.set({ route: routeFromHash() });

  document.body.prepend(buildNav());
  document.body.append(buildTabbar(), buildDock());
  mountChat(document.body);
  mountAI(document.body, { onSubmit: handleAI, onToggleMic: toggleMic });

  localise(document);
  applyTheme();
  paintRoute();
  bindShortcuts();
  bindConnectivity();
  registerServiceWorker();

  window.addEventListener('hashchange', () => actions.go(routeFromHash(), { push: false }));
  window.addEventListener('popstate', () => actions.go(routeFromHash(), { push: false }));

  // Re-run reveal observation after resize-driven reflows.
  window.addEventListener('resize', debounce(() => observeReveals(document), 260));

  // Sticky-nav shadow.
  const nav = $('#navbar');
  window.addEventListener('scroll', () => {
    nav?.classList.toggle('is-stuck', window.scrollY > 8);
  }, { passive: true });

  // A single demo notification, well after first paint.
  setTimeout(() => {
    pushNotification(t('notifs.match'), t('notifs.match.desc'));
    toast(t('notifs.match'), t('notifs.match.desc'), 'match');
    pushMessage({ author: t('chat.system'), text: t('notifs.match.desc'), kind: 'system' });
  }, 6500);

  if (!speechSupported()) {
    // Voice controls stay visible but inert; no need to alarm the user.
    $('#ai-panel')?.querySelectorAll('.quick-row .chip').forEach((c) => c.setAttribute('aria-disabled', 'true'));
  }

  // Expose a small, intentional surface for debugging and for the AI panel.
  window.GBAIRAI = { actions, store, t, speak, paintChat, version: '2.0.0' };
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
  boot();
}
