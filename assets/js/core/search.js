/* ==========================================================================
   search.js — moteurs de recherche cloisonnés
   Chaque option a son propre moteur : la recherche du profil ne trouve que
   ce qui est publié sur ce profil, celle de la boutique que des articles,
   etc. Rien ne fuit d'une portée à l'autre.
   ========================================================================== */

import * as store from './store.js';
import { t } from './i18n.js';

/* -------------------------------- normalise ----------------------------- */

export function norm(s) {
  return String(s == null ? '' : s)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\p{L}\p{N}\s#@._-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const tokens = (q) => norm(q).split(' ').filter(Boolean);

/** Score simple : préfixe > mot entier > sous-chaîne. 0 = pas de match. */
function score(hay, toks) {
  const H = norm(hay);
  if (!H) return 0;
  let s = 0;
  for (const tk of toks) {
    if (H === tk) s += 12;
    else if (H.startsWith(tk)) s += 8;
    else if (H.includes(' ' + tk)) s += 6;
    else if (H.includes(tk)) s += 3;
    else return 0;
  }
  return s;
}

function best(fields, toks) {
  let s = 0;
  for (const [text, weight] of fields) {
    const v = score(text, toks);
    if (v) s = Math.max(s, v * (weight || 1));
  }
  return s;
}

/* -------------------------------- portées ------------------------------- */

export const SCOPES = {
  home:    { label: 'nav.home',    hint: 'feed.searchHint' },
  explore: { label: 'nav.explore', hint: 'feed.searchHint' },
  shorts:  { label: 'nav.shorts',  hint: 'shorts.searchHint' },
  profile: { label: 'nav.profile', hint: 'profile.searchHint' },
  shop:    { label: 'nav.shop',    hint: 'shop.searchHint' },
  jobs:    { label: 'nav.jobs',    hint: 'jobs.searchHint' },
  groups:  { label: 'nav.groups',  hint: 'groups.searchHint' },
  events:  { label: 'nav.events',  hint: 'events.searchHint' },
  saved:   { label: 'nav.saved',   hint: 'saved.searchHint' },
  messages:{ label: 'nav.messages',hint: 'msg.searchHint' },
  live:    { label: 'nav.live',    hint: 'feed.searchHint' },
  wallet:  { label: 'nav.wallet',  hint: 'wallet.history' },
  notifications: { label: 'nav.notifications', hint: 'notif.title' },
  settings:{ label: 'nav.settings',hint: 'set.title' },
};

export function scopeLabel(id) {
  const s = SCOPES[id];
  return s ? t(s.label) : t('search.all');
}
export function scopeHint(id) {
  const s = SCOPES[id];
  return s ? t(s.hint) : t('a.search');
}

/* ------------------------------- recherche ------------------------------ */

/**
 * search(scope, query, opts) → [{ kind, id, title, sub, hash, icon, score }]
 * opts.userId limite la portée « profile ».
 */
export function search(scope, query, opts = {}) {
  const toks = tokens(query);
  if (!toks.length) return [];
  const d = store.data();
  const out = [];
  const limit = opts.limit || 30;

  const pushPost = (p, weight = 1) => {
    const au = store.user(p.userId);
    const s = best([[p.text, 1], [(p.tags || []).join(' '), 0.9], [au ? au.name : '', 0.6], [au ? au.handle : '', 0.6]], toks);
    if (s) out.push({ kind: 'post', id: p.id, title: (p.text || '').slice(0, 90) || t('search.posts'), sub: au ? '@' + au.handle : '', hash: '#/post/' + p.id, icon: 'comment', score: s * weight });
  };
  const pushUser = (u, weight = 1) => {
    const s = best([[u.name, 1], [u.handle, 1], [u.bio, 0.5], [u.city, 0.4]], toks);
    if (s) out.push({ kind: 'user', id: u.id, title: u.name, sub: '@' + u.handle, hash: '#/u/' + u.handle, icon: 'user', score: s * weight });
  };
  const pushShort = (v, weight = 1) => {
    const au = store.user(v.userId);
    const s = best([[v.caption, 1], [(v.tags || []).join(' '), 0.9], [v.soundTitle, 0.8], [v.soundArtist, 0.8], [au ? au.handle : '', 0.6]], toks);
    if (s) out.push({ kind: 'short', id: v.id, title: (v.caption || '').slice(0, 90) || t('nav.shorts'), sub: v.soundTitle || (au ? '@' + au.handle : ''), hash: '#/shorts?id=' + v.id, icon: 'shorts', score: s * weight });
  };
  const pushProduct = (p, weight = 1) => {
    const s = best([[p.title, 1], [p.desc, 0.6], [p.category, 0.7], [(p.tags || []).join(' '), 0.7]], toks);
    if (s) out.push({ kind: 'product', id: p.id, title: p.title, sub: p.category || '', hash: '#/shop?id=' + p.id, icon: 'shop', score: s * weight });
  };
  const pushTag = (tag, n, weight = 1) => {
    const s = best([[tag, 1]], toks);
    if (s) out.push({ kind: 'tag', id: tag, title: '#' + tag, sub: n + ' ' + t('search.posts').toLowerCase(), hash: '#/search?q=%23' + encodeURIComponent(tag), icon: 'hash', score: s * weight });
  };
  const pushSound = (v, weight = 1) => {
    const s = best([[v.soundTitle, 1], [v.soundArtist, 0.9]], toks);
    if (s) out.push({ kind: 'sound', id: v.soundId || v.id, title: v.soundTitle || '', sub: v.soundArtist || '', hash: '#/sound/' + (v.soundId || v.id), icon: 'music', score: s * weight });
  };

  switch (scope) {
    case 'profile': {
      const uid = opts.userId;
      if (!uid) break;
      for (const p of d.posts) if (p.userId === uid) pushPost(p, 1.2);
      for (const v of d.shorts) if (v.userId === uid) pushShort(v, 1.2);
      for (const p of d.products) if (p.userId === uid) pushProduct(p, 1);
      for (const s of d.stories) if (s.userId === uid) {
        const sc = best([[s.text, 1]], toks);
        if (sc) out.push({ kind: 'story', id: s.id, title: s.text || t('stories.title'), sub: t('stories.title'), hash: '#/u/' + (store.user(uid) || {}).handle, icon: 'image', score: sc });
      }
      const u = store.user(uid);
      if (u) pushUser(u, 0.8);
      break;
    }
    case 'shorts': {
      for (const v of d.shorts) { pushShort(v); pushSound(v, 0.8); }
      break;
    }
    case 'shop': {
      for (const p of d.products) pushProduct(p);
      for (const o of d.orders || []) {
        const sc = best([[o.id, 1], [o.status, 0.6]], toks);
        if (sc) out.push({ kind: 'order', id: o.id, title: t('shop.orders') + ' ' + o.id.slice(-6), sub: o.status, hash: '#/shop?tab=orders', icon: 'box', score: sc });
      }
      break;
    }
    case 'jobs': {
      for (const j of d.jobs) {
        const sc = best([[j.title, 1], [j.company, 0.9], [j.city, 0.6], [(j.skills || []).join(' '), 0.7], [j.desc, 0.4]], toks);
        if (sc) out.push({ kind: 'job', id: j.id, title: j.title, sub: j.company + ' · ' + j.city, hash: '#/jobs?id=' + j.id, icon: 'brief', score: sc });
      }
      break;
    }
    case 'groups': {
      for (const g of d.groups) {
        const sc = best([[g.name, 1], [g.desc, 0.6], [g.topic, 0.7]], toks);
        if (sc) out.push({ kind: 'group', id: g.id, title: g.name, sub: g.topic || '', hash: '#/groups?id=' + g.id, icon: 'users', score: sc });
      }
      break;
    }
    case 'events': {
      for (const e of d.events) {
        const sc = best([[e.title, 1], [e.place, 0.7], [e.desc, 0.5]], toks);
        if (sc) out.push({ kind: 'event', id: e.id, title: e.title, sub: e.place || '', hash: '#/events?id=' + e.id, icon: 'calendar', score: sc });
      }
      break;
    }
    case 'saved': {
      const me = store.me();
      const saved = new Set(me ? me.saved || [] : []);
      for (const p of d.posts) if (saved.has(p.id)) pushPost(p, 1.2);
      for (const v of d.shorts) if (saved.has(v.id)) pushShort(v, 1.2);
      for (const p of d.products) if (saved.has(p.id)) pushProduct(p, 1.1);
      break;
    }
    case 'messages': {
      for (const th of d.threads) {
        const other = (th.members || []).find((m) => m !== store.session().meId);
        const u = store.user(other);
        const msgs = (d.messages || []).filter((m) => m.threadId === th.id);
        const hitMsg = msgs.find((m) => score(m.text || '', toks));
        const sc = best([[u ? u.name : th.title, 1], [u ? u.handle : '', 0.8], [hitMsg ? hitMsg.text : '', 0.9]], toks);
        if (sc) out.push({ kind: 'thread', id: th.id, title: (u ? u.name : th.title) || t('msg.list'), sub: hitMsg ? (hitMsg.text || '').slice(0, 60) : '', hash: '#/messages/' + th.id, icon: 'comment', score: sc });
      }
      break;
    }
    case 'wallet': {
      for (const x of d.transactions || []) {
        const sc = best([[x.label, 1], [x.kind, 0.6]], toks);
        if (sc) out.push({ kind: 'tx', id: x.id, title: x.label, sub: x.kind, hash: '#/wallet', icon: 'coin', score: sc });
      }
      break;
    }
    case 'notifications': {
      for (const n of d.notifications || []) {
        const u = store.user(n.userId);
        const sc = best([[n.text, 1], [u ? u.name : '', 0.7]], toks);
        if (sc) out.push({ kind: 'notif', id: n.id, title: n.text || '', sub: u ? '@' + u.handle : '', hash: n.hash || '#/notifications', icon: 'bell', score: sc });
      }
      break;
    }
    case 'live': {
      for (const s of d.streams || []) {
        const u = store.user(s.userId);
        const sc = best([[s.title, 1], [u ? u.name : '', 0.7], [s.category, 0.6]], toks);
        if (sc) out.push({ kind: 'stream', id: s.id, title: s.title, sub: u ? '@' + u.handle : '', hash: '#/live?id=' + s.id, icon: 'live', score: sc });
      }
      break;
    }
    case 'settings': {
      for (const row of settingsIndex()) {
        const sc = best([[row.title, 1], [row.sub, 0.6]], toks);
        if (sc) out.push({ kind: 'setting', id: row.id, title: row.title, sub: row.sub, hash: '#/settings/' + row.tab, icon: 'settings', score: sc });
      }
      break;
    }
    default: {
      // accueil / explorer / recherche globale
      for (const u of d.users) pushUser(u);
      for (const p of d.posts) pushPost(p);
      for (const v of d.shorts) pushShort(v, 0.9);
      for (const p of d.products) pushProduct(p, 0.8);
      for (const [tag, n] of trendingTags()) pushTag(tag, n, 0.9);
      for (const j of d.jobs) {
        const sc = best([[j.title, 1], [j.company, 0.8]], toks);
        if (sc) out.push({ kind: 'job', id: j.id, title: j.title, sub: j.company, hash: '#/jobs?id=' + j.id, icon: 'brief', score: sc * 0.7 });
      }
    }
  }

  out.sort((a, b) => b.score - a.score);
  return out.slice(0, limit);
}

/* ------------------------------- tendances ------------------------------ */

export function trendingTags(limit = 12) {
  const counts = new Map();
  const d = store.data();
  const bump = (tag, n) => counts.set(tag, (counts.get(tag) || 0) + n);
  for (const p of d.posts) for (const tg of p.tags || []) bump(tg, 1 + Math.min(5, Math.round((p.likes || 0) / 40)));
  for (const v of d.shorts) for (const tg of v.tags || []) bump(tg, 1 + Math.min(6, Math.round((v.likes || 0) / 60)));
  return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).slice(0, limit);
}

/* ------------------------------ historique ------------------------------ */

export function recent(scope) {
  const hist = store.session().searchHistory || {};
  return (hist[scope] || []).slice(0, 8);
}

export function remember(scope, q) {
  const query = String(q || '').trim();
  if (query.length < 2) return;
  const hist = Object.assign({}, store.session().searchHistory || {});
  const list = (hist[scope] || []).filter((x) => norm(x) !== norm(query));
  list.unshift(query);
  hist[scope] = list.slice(0, 12);
  store.setSession({ searchHistory: hist });
}

export function clearHistory(scope) {
  const hist = Object.assign({}, store.session().searchHistory || {});
  if (scope) delete hist[scope]; else Object.keys(hist).forEach((k) => delete hist[k]);
  store.setSession({ searchHistory: hist });
}

/* --------------------------- index des réglages ------------------------- */

function settingsIndex() {
  return [
    { id: 'theme', tab: 'look', title: t('set.theme'), sub: t('set.look') },
    { id: 'accent', tab: 'look', title: t('set.accent'), sub: t('set.look') },
    { id: 'density', tab: 'look', title: t('set.density'), sub: t('set.look') },
    { id: 'locale', tab: 'lang', title: t('set.locale'), sub: t('set.lang') },
    { id: 'currency', tab: 'lang', title: t('set.currency'), sub: t('set.lang') },
    { id: 'private', tab: 'privacy', title: t('set.private'), sub: t('set.privacy') },
    { id: 'whoMsg', tab: 'privacy', title: t('set.whoMsg'), sub: t('set.privacy') },
    { id: 'allowDl', tab: 'privacy', title: t('set.allowDl'), sub: t('set.privacy') },
    { id: 'autoplay', tab: 'play', title: t('set.autoplay'), sub: t('set.play') },
    { id: 'saver', tab: 'play', title: t('set.saver'), sub: t('set.play') },
    { id: 'fontScale', tab: 'access', title: t('set.fontScale'), sub: t('set.access') },
    { id: 'contrast', tab: 'access', title: t('set.contrast'), sub: t('set.access') },
    { id: 'motion', tab: 'access', title: t('set.motion'), sub: t('set.access') },
    { id: 'agentName', tab: 'agent', title: t('agent.yourName'), sub: t('set.agent') },
    { id: 'agentVoice', tab: 'agent', title: t('agent.voice'), sub: t('set.agent') },
    { id: 'export', tab: 'data', title: t('set.export'), sub: t('set.data') },
    { id: 'wipe', tab: 'data', title: t('set.wipe'), sub: t('set.data') },
  ];
}

/** Surligne les tokens trouvés dans un libellé (sortie texte + <mark>). */
export function highlight(text, query) {
  const toks = tokens(query);
  if (!toks.length) return [String(text || '')];
  const src = String(text || '');
  const lower = norm(src);
  let cut = 0;
  const parts = [];
  for (const tk of toks) {
    const i = lower.indexOf(tk, cut);
    if (i < 0) continue;
    if (i > cut) parts.push(src.slice(cut, i));
    parts.push({ hi: src.slice(i, i + tk.length) });
    cut = i + tk.length;
  }
  if (cut < src.length) parts.push(src.slice(cut));
  return parts.length ? parts : [src];
}
