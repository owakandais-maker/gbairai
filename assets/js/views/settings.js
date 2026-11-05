/* ==========================================================================
   settings.js — centre de réglages
   Chaque interrupteur agit pour de vrai : thème, accent, langue et sens de
   lecture, devise, confidentialité, notifications, lecture et données,
   accessibilité, agent, sécurité, export et effacement.
   ========================================================================== */

import { h, mount, clear } from '../core/dom.js';
import { icon } from '../core/icons.js';
import { t, LOCALES, CURRENCIES, setLocale, money, nfmt, dateFmt } from '../core/i18n.js';
import * as store from '../core/store.js';
import * as router from '../core/router.js';
import { toast, empty, row, switchCtl, segmented, confirm, prompt, modal, sheet, kpi } from '../core/ui.js';
import { usage as idbUsage, clearAll as idbClear } from '../core/idb.js';
import { viewHead } from '../features/parts.js';
import * as agent from '../features/agent.js';
import { VOICES } from '../features/agent.js';

const ACCENTS = ['#6c5cff', '#2f7fe0', '#2fbf71', '#f7c948', '#ff7a3d', '#ff3b5c', '#b45cff', '#00c2b8'];

const SECTIONS = () => [
  { id: 'look', label: t('set.look'), icon: 'palette' },
  { id: 'lang', label: t('set.lang'), icon: 'lang' },
  { id: 'privacy', label: t('set.privacy'), icon: 'shield' },
  { id: 'notif', label: t('set.notif'), icon: 'bell' },
  { id: 'play', label: t('set.play'), icon: 'play' },
  { id: 'access', label: t('set.access'), icon: 'eye' },
  { id: 'agent', label: t('set.agent'), icon: 'bot' },
  { id: 'security', label: t('set.security'), icon: 'lock' },
  { id: 'data', label: t('set.data'), icon: 'database' },
  { id: 'about', label: t('set.about'), icon: 'info' },
];

export function render(ctx, host) {
  const tab = ctx.params.tab || ctx.query.tab || 'look';
  const body = h('div.stack.gap-3');

  const nav = h('div.set-nav', SECTIONS().map((s) => h('button', {
    type: 'button',
    'aria-current': s.id === tab ? 'true' : 'false',
    onclick: () => router.go('#/settings/' + s.id),
  }, icon(s.icon), h('span.grow', s.label))));

  mount(body, sectionFor(tab));

  mount(host, h('div.stack.gap-4',
    viewHead({ title: t('set.title'), scope: 'settings' }),
    h('div.set-wrap', nav, body),
  ));
  return {};
}

function sectionFor(tab) {
  switch (tab) {
    case 'lang': return langSection();
    case 'privacy': return privacySection();
    case 'notif': return notifSection();
    case 'play': return playSection();
    case 'access': return accessSection();
    case 'agent': return agentSection();
    case 'security': return securitySection();
    case 'data': return dataSection();
    case 'about': return aboutSection();
    default: return lookSection();
  }
}

const S = () => store.settings();
const set = (patch) => { store.setSettings(patch); apply(); };

/** Applique les réglages au document : c'est ici que tout devient réel. */
export function apply() {
  const s = S();
  const r = document.documentElement;
  const dark = s.theme === 'dark' || (s.theme === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
  r.dataset.theme = dark ? 'dark' : 'light';
  const tc = document.querySelector('meta[name="theme-color"]');
  if (tc) tc.setAttribute('content', dark ? '#06080f' : '#f4f6fb');
  r.style.setProperty('--accent', s.accent || '#6c5cff');
  r.style.setProperty('--font-scale', String(s.fontScale || 1));
  if (s.contrast) r.dataset.contrast = 'high'; else delete r.dataset.contrast;
  if (s.reduceMotion) r.dataset.motion = 'reduced'; else delete r.dataset.motion;
  if (s.density && s.density !== 'cosy') r.dataset.density = s.density; else delete r.dataset.density;
  setLocale(s.locale || 'fr');
}

/* ------------------------------- apparence ------------------------------ */

function lookSection() {
  const s = S();
  const swatches = h('div.swatches', ACCENTS.map((c) => {
    const b = h('button.swatch', {
      type: 'button', style: { background: c }, 'aria-label': c,
      'aria-pressed': s.accent === c ? 'true' : 'false',
    });
    b.addEventListener('click', () => {
      set({ accent: c });
      for (const x of swatches.children) x.setAttribute('aria-pressed', 'false');
      b.setAttribute('aria-pressed', 'true');
    });
    return b;
  }));

  const scale = h('input', { type: 'range', min: '0.85', max: '1.4', step: '0.05', value: String(s.fontScale || 1) });
  const scaleOut = h('span.v', Math.round((s.fontScale || 1) * 100) + '%');
  scale.addEventListener('input', () => {
    scaleOut.textContent = Math.round(Number(scale.value) * 100) + '%';
    set({ fontScale: Number(scale.value) });
  });

  return h('div.stack.gap-3',
    h('div.set-grp',
      row(t('set.theme'), null, segmented([
        { id: 'dark', label: t('set.themeDark') },
        { id: 'light', label: t('set.themeLight') },
        { id: 'system', label: t('set.themeSystem') },
      ], s.theme, (id) => { set({ theme: id }); router.render(); })),
      row(t('set.accent'), null, swatches),
      row(t('set.density'), null, segmented([
        { id: 'cosy', label: t('set.cosy') },
        { id: 'compact', label: t('set.compact') },
      ], s.density || 'cosy', (id) => { set({ density: id }); router.render(); })),
      row(t('set.fontScale'), null, h('div.row.gap-2', scale, scaleOut)),
      row(t('set.gridShape'), null, segmented([
        { id: 'square', label: t('profile.square') },
        { id: 'round', label: t('profile.round') },
      ], s.gridShape || 'square', (id) => { set({ gridShape: id }); router.render(); })),
      row(t('set.showTrends'), t('feed.trending'), switchCtl(s.showTrends !== false, (v) => { set({ showTrends: v }); router.render(); }, t('set.showTrends'))),
      row(t('set.startView'), null, (() => {
        const sel = h('select.select', [
          { id: 'home', l: t('nav.home') }, { id: 'shorts', l: t('nav.shorts') },
          { id: 'shop', l: t('nav.shop') }, { id: 'messages', l: t('nav.messages') },
        ].map((o) => h('option', { value: o.id, selected: (s.startView || 'home') === o.id ? true : null }, o.l)));
        sel.addEventListener('change', () => set({ startView: sel.value }));
        return sel;
      })()),
    ),
  );
}

/* --------------------------------- langue ------------------------------- */

function langSection() {
  const s = S();
  const locSel = h('select.select', LOCALES.map((l) => h('option', { value: l.id, selected: s.locale === l.id ? true : null }, l.label + ' (' + l.flag + ')')));
  locSel.addEventListener('change', () => { set({ locale: locSel.value }); router.render(); });

  const curSel = h('select.select', CURRENCIES.map((c) => h('option', { value: c, selected: s.currency === c ? true : null }, c)));
  curSel.addEventListener('change', () => { set({ currency: curSel.value }); router.render(); });

  return h('div.stack.gap-3',
    h('div.set-grp',
      row(t('set.locale'), LOCALES.map((l) => l.flag).join(' · '), locSel),
      row(t('set.currency'), money(12500), curSel),
      row('Sens de lecture', document.documentElement.dir === 'rtl' ? 'RTL' : 'LTR', h('span.chip', document.documentElement.dir.toUpperCase())),
      row('Fuseau de référence', 'GMT', h('span.chip', icon('clock'), 'GMT')),
    ),
    h('div.card.pad.stack.gap-2',
      h('h3', t('set.lang')),
      h('div.row.wrap.gap-2', LOCALES.map((l) => h('button.chip.btn-like', {
        type: 'button', class: s.locale === l.id ? 'on' : '',
        onclick: () => { set({ locale: l.id }); router.render(); },
      }, l.flag, ' ', l.label))),
    ),
  );
}

/* ----------------------------- confidentialité -------------------------- */

function privacySection() {
  const s = S();
  const who = (value, onChange) => {
    const sel = h('select.select',
      h('option', { value: 'all', selected: value === 'all' ? true : null }, t('set.everyone')),
      h('option', { value: 'followers', selected: value === 'followers' ? true : null }, t('set.followers')),
      h('option', { value: 'none', selected: value === 'none' ? true : null }, t('set.nobody')),
    );
    sel.addEventListener('change', () => onChange(sel.value));
    return sel;
  };
  return h('div.stack.gap-3',
    h('div.set-grp',
      row(t('set.private'), null, switchCtl(s.privateAccount, (v) => set({ privateAccount: v }), t('set.private'))),
      row(t('set.whoMsg'), null, who(s.whoCanMessage, (v) => set({ whoCanMessage: v }))),
      row(t('set.whoCmt'), null, who(s.whoCanComment, (v) => set({ whoCanComment: v }))),
      row(t('set.activity'), null, switchCtl(s.showActivity, (v) => set({ showActivity: v }), t('set.activity'))),
      row(t('set.allowDl'), null, switchCtl(s.allowDownloads, (v) => set({ allowDownloads: v }), t('set.allowDl'))),
      row(t('set.receipts'), null, switchCtl(s.readReceipts, (v) => set({ readReceipts: v }), t('set.receipts'))),
    ),
    h('div.card.pad.stack.gap-2',
      h('h3', t('search.clear')),
      h('p.sm.mut', t('search.recent')),
      h('button.btn.sm.danger', {
        type: 'button',
        onclick: async () => {
          const ok = await confirm({ title: t('search.clear'), message: t('search.recent'), danger: true, okLabel: t('a.delete') });
          if (!ok) return;
          store.setSession({ searchHistory: {} });
          toast(t('toast.deleted'), 'ok');
        },
      }, icon('trash'), t('search.clear')),
    ),
  );
}

/* ------------------------------ notifications --------------------------- */

function notifSection() {
  const s = S();
  return h('div.stack.gap-3',
    h('div.set-grp',
      row(t('notif.like'), null, switchCtl(s.notifyLikes, (v) => set({ notifyLikes: v }), t('notif.like'))),
      row(t('notif.comment'), null, switchCtl(s.notifyComments, (v) => set({ notifyComments: v }), t('notif.comment'))),
      row(t('notif.follow'), null, switchCtl(s.notifyFollows, (v) => set({ notifyFollows: v }), t('notif.follow'))),
      row(t('notif.live'), null, switchCtl(s.notifyLive, (v) => set({ notifyLive: v }), t('notif.live'))),
      row(t('notif.order'), null, switchCtl(s.notifyOrders, (v) => set({ notifyOrders: v }), t('notif.order'))),
      row(t('set.quiet'), '22:00 → 07:00', switchCtl(s.quietHours, (v) => set({ quietHours: v }), t('set.quiet'))),
    ),
    h('div.card.pad.stack.gap-2',
      h('h3', t('notif.title')),
      h('button.btn.sm.soft', {
        type: 'button',
        onclick: async () => {
          if (!('Notification' in window)) { toast(t('search.noVoice'), 'bad'); return; }
          try {
            const p = await Notification.requestPermission();
            toast(p === 'granted' ? t('toast.saved') : t('toast.notAllowed'), p === 'granted' ? 'ok' : 'bad');
          } catch (e) { toast(t('toast.notAllowed'), 'bad'); }
        },
      }, icon('bell'), t('notif.title')),
    ),
  );
}

/* --------------------------- lecture et données ------------------------- */

function playSection() {
  const s = S();
  const qSel = h('select.select', ['auto', '1080p', '720p', '480p', '360p'].map((q) => h('option', { value: q, selected: s.preferredQuality === q ? true : null }, q)));
  qSel.addEventListener('change', () => set({ preferredQuality: qSel.value }));
  return h('div.stack.gap-3',
    h('div.set-grp',
      row(t('set.autoplay'), null, switchCtl(s.autoplay, (v) => set({ autoplay: v }), t('set.autoplay'))),
      row(t('set.muted'), null, switchCtl(s.defaultMuted, (v) => set({ defaultMuted: v }), t('set.muted'))),
      row(t('shorts.loop'), null, switchCtl(s.loopShorts, (v) => set({ loopShorts: v }), t('shorts.loop'))),
      row(t('set.captions'), null, switchCtl(s.captions, (v) => set({ captions: v }), t('set.captions'))),
      row(t('set.saver'), null, switchCtl(s.dataSaver, (v) => set({ dataSaver: v }), t('set.saver'))),
      row(t('set.quality'), null, qSel),
    ),
  );
}

/* ----------------------------- accessibilité ---------------------------- */

function accessSection() {
  const s = S();
  const scale = h('input', { type: 'range', min: '0.85', max: '1.4', step: '0.05', value: String(s.fontScale || 1) });
  const out = h('span.v', Math.round((s.fontScale || 1) * 100) + '%');
  scale.addEventListener('input', () => { out.textContent = Math.round(Number(scale.value) * 100) + '%'; set({ fontScale: Number(scale.value) }); });
  return h('div.stack.gap-3',
    h('div.set-grp',
      row(t('set.fontScale'), null, h('div.row.gap-2', scale, out)),
      row(t('set.contrast'), null, switchCtl(s.contrast, (v) => { set({ contrast: v }); }, t('set.contrast'))),
      row(t('set.motion'), null, switchCtl(s.reduceMotion, (v) => { set({ reduceMotion: v }); }, t('set.motion'))),
      row(t('set.density'), null, segmented([
        { id: 'cosy', label: t('set.cosy') }, { id: 'compact', label: t('set.compact') },
      ], s.density || 'cosy', (id) => { set({ density: id }); router.render(); })),
    ),
    h('div.card.pad.stack.gap-2',
      h('h3', t('set.access')),
      h('p.sm.mut', 'Navigation complète au clavier : Tab pour parcourir, Échap pour fermer, '
        + 'Ctrl+K pour appeler ' + agent.agentName() + ', flèches haut et bas dans les shorts.'),
    ),
  );
}

/* --------------------------------- agent -------------------------------- */

function agentSection() {
  const s = S();
  const voiceSel = h('select.select', VOICES.map((v) => h('option', { value: v.id, selected: s.agentVoice === v.id ? true : null }, v.label)));
  voiceSel.addEventListener('change', () => set({ agentVoice: voiceSel.value }));

  const nameIn = h('input.input', { type: 'text', value: s.agentName || 'OWAK', maxlength: 24 });
  nameIn.addEventListener('change', () => { set({ agentName: nameIn.value.trim() || 'OWAK' }); agent.refreshFab(); });

  const autoSel = h('select.select',
    h('option', { value: 'confirm', selected: s.agentAutonomy === 'confirm' ? true : null }, t('agent.autoConfirm')),
    h('option', { value: 'full', selected: s.agentAutonomy === 'full' ? true : null }, t('agent.autoFull')),
  );
  autoSel.addEventListener('change', () => set({ agentAutonomy: autoSel.value }));

  return h('div.stack.gap-3',
    h('div.set-grp',
      row(t('agent.yourName'), t('agent.private'), nameIn),
      row(t('agent.voice'), null, voiceSel),
      row(t('agent.autonomy'), null, autoSel),
      row(t('agent.voice') + ' — réponse parlée', null, switchCtl(s.agentVoiceReply, (v) => set({ agentVoiceReply: v }), t('agent.voice'))),
    ),
    h('div.card.pad.stack.gap-2',
      h('h3', agent.agentName()),
      h('p.sm.mut', t('agent.sub') + ' · ' + t('agent.private')),
      h('div.row.wrap.gap-2',
        h('button.btn.sm.soft', { type: 'button', onclick: () => agent.identitySheet() }, icon('sliders'), t('agent.identity')),
        h('button.btn.sm.ghost', { type: 'button', onclick: () => agent.openPanel() }, icon('sparkles'), t('agent.placeholder').slice(0, 20) + '…'),
        h('button.btn.sm.ghost', { type: 'button', onclick: () => agent.startCall('audio') }, icon('phone'), t('agent.call')),
        h('button.btn.sm.ghost', { type: 'button', onclick: () => agent.startCall('video') }, icon('video'), t('agent.videoCall')),
      ),
    ),
    h('div.card.pad.stack.gap-2',
      h('h3', t('agent.suggest')),
      h('div.row.wrap.gap-2', [
        'ouvre la boutique', 'passe en mode clair', 'cherche sauce graine',
        'publie "bonjour la zone"', 'etat de la zone', 'vide le panier',
      ].map((p) => h('button.chip.btn-like', { type: 'button', onclick: () => agent.submit(p) }, icon('sparkles'), p))),
    ),
  );
}

/* -------------------------------- sécurité ------------------------------ */

function securitySection() {
  const me = store.me();
  const isOwner = store.isOwner();
  return h('div.stack.gap-3',
    h('div.set-grp',
      row(t('set.sessions'), navigator.platform || 'Navigateur', h('span.chip.ok', icon('check'), t('msg.online'))),
      row('Stockage local', t('set.storage'), h('span.chip', icon('database'), Math.round(store.storageInfo().bytes / 1024) + ' Ko')),
      isOwner ? row(t('owner.title'), t('owner.only'), h('a.btn.sm.soft', { href: '#/owner' }, icon('shield'), t('owner.enter'))) : null,
    ),
    isOwner ? h('div.card.pad.stack.gap-2',
      h('h3', t('owner.changeCode')),
      h('p.sm.mut', t('owner.only')),
      h('button.btn.sm.soft', { type: 'button', onclick: () => changeOwnerCode() }, icon('key'), t('owner.changeCode')),
    ) : null,
    h('div.card.pad.stack.gap-2',
      h('h3', t('a.block')),
      h('p.sm.mut', t('empty.generic')),
    ),
  );
}

export async function changeOwnerCode() {
  if (!store.isOwner()) { toast(t('toast.notAllowed'), 'bad'); return; }
  const current = await prompt({ title: t('owner.code'), label: t('owner.code'), type: 'password', okLabel: t('owner.enter') });
  if (current == null) return;
  if (current !== (store.data().owner || {}).code) { toast(t('owner.wrong'), 'bad'); return; }
  const next = await prompt({ title: t('owner.newCode'), label: t('owner.newCode'), type: 'password', hint: '4 caractères minimum', okLabel: t('a.save') });
  if (next == null) return;
  if (String(next).trim().length < 4) { toast(t('toast.nothing'), 'bad'); return; }
  store.commit('ownerCode', (c) => {
    c.data.owner = Object.assign({}, c.data.owner, { code: String(next).trim(), codeChangedAt: Date.now() });
    c.touch('data');
  });
  toast(t('toast.saved'), 'ok');
}

/* ------------------------------- mes données ---------------------------- */

function dataSection() {
  const info = store.storageInfo();
  const mediaInfo = h('span.chip', icon('database'), '…');
  idbUsage().then((u) => { mediaInfo.textContent = ''; mediaInfo.appendChild(icon('database')); mediaInfo.appendChild(document.createTextNode(u.count + ' · ' + Math.round(u.bytes / 1048576 * 10) / 10 + ' Mo')); });

  const d = store.data();
  return h('div.stack.gap-3',
    h('div.grid-auto',
      kpi(String(d.posts.length), t('search.posts')),
      kpi(String(d.shorts.length), t('nav.shorts')),
      kpi(String((d.messages || []).length), t('nav.messages')),
      kpi(String((d.products || []).length), t('search.products')),
    ),
    h('div.set-grp',
      row(t('set.storage'), 'localStorage', h('span.chip', icon('database'), Math.round(info.bytes / 1024) + ' Ko')),
      row(t('profile.media'), 'IndexedDB', mediaInfo),
      row(t('set.export'), null, h('button.btn.sm.soft', { type: 'button', onclick: exportData }, icon('download'), t('a.export'))),
      row(t('set.import'), null, h('button.btn.sm.soft', { type: 'button', onclick: importData }, icon('upload'), t('a.import'))),
    ),
    h('div.card.pad.stack.gap-2',
      h('h3', t('set.wipe')),
      h('p.sm.mut', t('set.wipeWarn')),
      h('button.btn.danger', {
        type: 'button',
        onclick: async () => {
          const ok = await confirm({ title: t('set.wipe'), message: t('set.wipeWarn'), danger: true, okLabel: t('a.delete') });
          if (!ok) return;
          const again = await confirm({ title: t('a.confirm'), message: t('set.wipe') + ' ?', danger: true, okLabel: t('a.delete') });
          if (!again) return;
          await idbClear();
          store.resetAll();
          toast(t('toast.deleted'), 'ok');
          location.hash = '#/';
          location.reload();
        },
      }, icon('trash'), t('set.wipe')),
    ),
  );
}

function exportData() {
  const json = store.exportAll();
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = h('a', { href: url, download: 'gbairai-zone-' + new Date().toISOString().slice(0, 10) + '.json' });
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  toast(t('toast.downloaded'), 'ok');
}

function importData() {
  const input = h('input', { type: 'file', accept: 'application/json', style: { position: 'fixed', left: '-9999px' } });
  input.addEventListener('change', async () => {
    const f = (input.files || [])[0];
    input.remove();
    if (!f) return;
    try {
      const text = await f.text();
      store.importAll(text);
      apply();
      toast(t('toast.saved'), 'ok');
      router.render();
    } catch (e) {
      toast(t('err.view'), 'bad');
    }
  });
  document.body.appendChild(input);
  input.click();
}

/* --------------------------------- à propos ----------------------------- */

function aboutSection() {
  return h('div.stack.gap-3',
    h('div.card.pad.stack.gap-3',
      h('h2', t('app.name')),
      h('p.sm.mut', t('app.tagline')),
      h('div.set-grp',
        row(t('set.version'), 'GBZN', h('span.chip', '1.0.0')),
        row('Agent', t('agent.sub'), h('span.chip', icon('bot'), agent.agentName())),
        row('Hors ligne', 'Service worker', h('span.chip.ok', icon('check'), t('a.ok'))),
        row('Fuseau', 'GMT', h('span.chip', icon('clock'), 'GMT')),
      ),
      h('p.xs.mut-3', 'Toutes les données de cette application restent sur cet appareil : '
        + 'localStorage pour les réglages et le contenu, IndexedDB pour les photos et les vidéos. '
        + 'Aucune donnée ne part vers un serveur.'),
    ),
    h('div.card.pad.stack.gap-2',
      h('h3', t('nav.sections')),
      h('div.row.wrap.gap-2', [
        ['#/', t('nav.home')], ['#/shorts', t('nav.shorts')], ['#/shop', t('nav.shop')],
        ['#/live', t('nav.live')], ['#/messages', t('nav.messages')], ['#/me', t('nav.profile')],
        ['#/wallet', t('nav.wallet')], ['#/jobs', t('nav.jobs')], ['#/groups', t('nav.groups')],
        ['#/events', t('nav.events')], ['#/explore', t('nav.explore')], ['#/saved', t('nav.saved')],
        ['#/notifications', t('nav.notifications')],
      ].map(([href, label]) => h('a.chip', { href }, label))),
    ),
  );
}
