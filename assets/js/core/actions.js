/* ==========================================================================
   actions.js — registre des actions de l'application
   C'est la table d'appel de fonctions d'OWAK : chaque action est une vraie
   opération de l'application, déclarée une seule fois et réutilisée par
   l'agent, les raccourcis clavier et la recherche.
   ========================================================================== */

import * as store from './store.js';
import * as router from './router.js';
import { t, LOCALES, CURRENCIES, setLocale } from './i18n.js';
import { toast } from './ui.js';
import { norm } from './search.js';

const registry = new Map();

/**
 * register({ id, label, keywords, args, danger, run })
 * run(args, ctx) peut être asynchrone et renvoie { ok, say, hash }.
 */
export function register(def) {
  if (!def || !def.id) return;
  registry.set(def.id, Object.assign({ keywords: [], args: [], danger: false }, def));
}

export function all() { return Array.from(registry.values()); }
export function byId(id) { return registry.get(id) || null; }

export async function run(id, args, ctx) {
  const def = registry.get(id);
  if (!def) return { ok: false, say: t('agent.cantDo') };
  try {
    const res = await def.run(args || {}, ctx || {});
    return Object.assign({ ok: true }, res || {});
  } catch (e) {
    console.error('[gbzn] action en échec : ' + id, e);
    return { ok: false, say: t('err.view') };
  }
}

/* ------------------------- reconnaissance d'intention ------------------- */

/** Score d'une action face à une phrase libre (français, nouchi, anglais). */
export function matchIntent(phrase) {
  const q = norm(phrase);
  if (!q) return [];
  const words = q.split(' ').filter(Boolean);
  const out = [];
  for (const def of registry.values()) {
    let s = 0;
    for (const kw of def.keywords) {
      const k = norm(kw);
      if (!k) continue;
      if (q === k) s = Math.max(s, 100);
      else if (q.includes(k)) s = Math.max(s, 40 + k.length);
      else if (k.split(' ').every((part) => words.includes(part))) s = Math.max(s, 30 + k.length);
    }
    if (s) out.push({ def, score: s });
  }
  out.sort((a, b) => b.score - a.score);
  return out;
}

/* ------------------------- extraction d'arguments ----------------------- */

export function extractQuoted(phrase) {
  const m = String(phrase).match(/[«"']([^»"']{2,})[»"']/);
  return m ? m[1].trim() : null;
}

export function extractAfter(phrase, markers) {
  const src = String(phrase);
  for (const mk of markers) {
    const i = norm(src).indexOf(norm(mk));
    if (i >= 0) {
      const tail = src.slice(i + mk.length).trim().replace(/^[:,\s]+/, '');
      if (tail.length > 1) return tail;
    }
  }
  return null;
}

export function extractHandle(phrase) {
  const m = String(phrase).match(/@([a-zA-Z0-9_.]{2,30})/);
  if (m) return m[1];
  const q = norm(phrase);
  for (const u of store.data().users) {
    if (u.id === store.session().meId) continue;
    if (q.includes(norm(u.handle)) || q.includes(norm(u.name))) return u.handle;
  }
  return null;
}

export function extractNumber(phrase) {
  const m = String(phrase).match(/(-?\d+(?:[.,]\d+)?)/);
  return m ? Number(m[1].replace(',', '.')) : null;
}

/* ------------------------------ vues connues ---------------------------- */

export const VIEWS = [
  { id: 'home', hash: '#/', label: 'nav.home', kw: ['accueil', 'home', 'fil', 'feed', 'page principale'] },
  { id: 'shorts', hash: '#/shorts', label: 'nav.shorts', kw: ['shorts', 'short', 'videos courtes', 'reels'] },
  { id: 'shop', hash: '#/shop', label: 'nav.shop', kw: ['boutique', 'shop', 'marche', 'magasin', 'articles'] },
  { id: 'live', hash: '#/live', label: 'nav.live', kw: ['direct', 'live', 'streaming', 'en direct'] },
  { id: 'studio', hash: '#/live/studio', label: 'live.studio', kw: ['studio', 'regie', 'za prod'] },
  { id: 'messages', hash: '#/messages', label: 'nav.messages', kw: ['messages', 'messagerie', 'discussion', 'causerie', 'chat'] },
  { id: 'profile', hash: '#/me', label: 'nav.profile', kw: ['profil', 'mon profil', 'profile', 'mon compte'] },
  { id: 'notifications', hash: '#/notifications', label: 'nav.notifications', kw: ['notifications', 'alertes'] },
  { id: 'saved', hash: '#/saved', label: 'nav.saved', kw: ['enregistrements', 'enregistres', 'favoris', 'sauvegardes'] },
  { id: 'wallet', hash: '#/wallet', label: 'nav.wallet', kw: ['portefeuille', 'taro', 'solde', 'wallet', 'argent'] },
  { id: 'jobs', hash: '#/jobs', label: 'nav.jobs', kw: ['emploi', 'travail', 'jobs', 'djobe', 'offres'] },
  { id: 'groups', hash: '#/groups', label: 'nav.groups', kw: ['groupes', 'groups', 'communautes'] },
  { id: 'events', hash: '#/events', label: 'nav.events', kw: ['evenements', 'events', 'agenda'] },
  { id: 'explore', hash: '#/explore', label: 'nav.explore', kw: ['explorer', 'explore', 'decouvrir', 'tendances'] },
  { id: 'settings', hash: '#/settings', label: 'nav.settings', kw: ['parametres', 'reglages', 'settings', 'preferences'] },
  { id: 'owner', hash: '#/owner', label: 'nav.owner', kw: ['console', 'concepteur', 'panneau publicitaire', 'admin'] },
];

export function viewFor(phrase) {
  const q = norm(phrase);
  let best = null;
  for (const v of VIEWS) {
    for (const k of v.kw) {
      const kk = norm(k);
      if (q.includes(kk) && (!best || kk.length > best.len)) best = { v, len: kk.length };
    }
  }
  return best ? best.v : null;
}

/* ------------------------------- actions ------------------------------- */

export function registerCore() {
  register({
    id: 'navigate', label: t('a.open'),
    keywords: ['ouvre', 'ouvrir', 'va sur', 'va a', 'affiche', 'montre', 'amene moi', 'emmene moi',
      'open', 'go to', 'show', 'navigue', 'rends toi'],
    run: (args, ctx) => {
      const v = args.view || viewFor(ctx.phrase || '');
      if (!v) return { ok: false, say: t('agent.cantDo') };
      const hash = typeof v === 'string' ? v : v.hash;
      router.go(hash);
      const label = typeof v === 'string' ? hash : t(v.label);
      return { say: t('a.open') + ' : ' + label, hash };
    },
  });

  register({
    id: 'back', label: t('a.back'),
    keywords: ['retour', 'reviens', 'page precedente', 'back', 'retourne'],
    run: () => { router.back(); return { say: t('a.back') }; },
  });

  register({
    id: 'publishPost', label: t('feed.publish'),
    keywords: ['publie', 'publier', 'poste', 'poster', 'ecris une publication', 'nouveau post',
      'publish', 'post this', 'fais une publication', 'envoie une publication'],
    args: ['text'],
    run: (args, ctx) => {
      const text = args.text || extractQuoted(ctx.phrase || '')
        || extractAfter(ctx.phrase || '', ['publie', 'poste', 'publication', 'publish', 'post']);
      if (!text || text.length < 2) return { ok: false, say: t('toast.nothing') };
      const tags = (text.match(/#([\p{L}\p{N}_]{2,40})/gu) || []).map((s) => s.slice(1));
      const post = {
        id: 'p_' + Date.now().toString(36), userId: store.session().meId, at: Date.now(),
        text, tags, media: [], likes: 0, shares: 0, views: 1, allowDownload: true, byAgent: true,
      };
      store.add('posts', post);
      router.go('#/post/' + post.id);
      return { say: t('feed.publish') + ' ✓', hash: '#/post/' + post.id };
    },
  });

  register({
    id: 'likePost', label: t('a.like'),
    keywords: ['aime', 'like', 'j aime cette publication', 'mets un like'],
    run: (args, ctx) => {
      const id = args.postId || ctx.currentPostId;
      if (!id) return { ok: false, say: t('agent.cantDo') };
      const likes = store.data().likes;
      const set = new Set(likes.posts || []);
      if (set.has(id)) set.delete(id); else set.add(id);
      store.commit('like', (c) => { c.data.likes.posts = Array.from(set); c.touch('data'); });
      return { say: set.has(id) ? t('a.like') + ' ✓' : t('a.remove') + ' ✓' };
    },
  });

  register({
    id: 'savePost', label: t('a.save'),
    keywords: ['enregistre', 'sauvegarde', 'mets de cote', 'save this', 'bookmark', 'garde ca'],
    run: (args, ctx) => {
      const id = args.itemId || ctx.currentPostId || ctx.currentShortId;
      if (!id) return { ok: false, say: t('agent.cantDo') };
      const me = store.me();
      const set = new Set(me.saved || []);
      if (set.has(id)) set.delete(id); else set.add(id);
      store.update('users', me.id, { saved: Array.from(set) });
      return { say: set.has(id) ? t('a.saved') + ' ✓' : t('a.remove') + ' ✓' };
    },
  });

  register({
    id: 'follow', label: t('a.follow'),
    keywords: ['abonne moi', 'suis', 'suivre', 'follow', 'desabonne', 'unfollow', 'ne suis plus'],
    run: (args, ctx) => {
      const handle = args.handle || extractHandle(ctx.phrase || '');
      const u = handle ? store.user(handle) : null;
      if (!u) return { ok: false, say: t('agent.cantDo') };
      const list = new Set(store.data().follows || []);
      const q = norm(ctx.phrase || '');
      const wantsOff = q.includes('desabonne') || q.includes('unfollow') || q.includes('ne suis plus');
      if (wantsOff || (list.has(u.id) && !q.includes('abonne moi'))) list.delete(u.id); else list.add(u.id);
      store.commit('follow', (c) => { c.data.follows = Array.from(list); c.touch('data'); });
      return { say: (list.has(u.id) ? t('a.following') : t('a.unfollow')) + ' : @' + u.handle, hash: '#/u/' + u.handle };
    },
  });

  register({
    id: 'sendMessage', label: t('a.send'),
    keywords: ['envoie un message', 'ecris a', 'message a', 'send a message', 'dis a', 'previens'],
    run: (args, ctx) => {
      const handle = args.handle || extractHandle(ctx.phrase || '');
      const u = handle ? store.user(handle) : null;
      if (!u) return { ok: false, say: t('agent.cantDo') };
      const text = args.text || extractQuoted(ctx.phrase || '')
        || extractAfter(ctx.phrase || '', ['que ', 'dis lui ', 'message ', ': ']);
      const meId = store.session().meId;
      let th = store.data().threads.find((x) => (x.members || []).includes(u.id) && (x.members || []).includes(meId));
      if (!th) {
        th = { id: 'th_' + Date.now().toString(36), members: [meId, u.id], at: Date.now(), unread: 0 };
        store.add('threads', th);
      }
      if (text && text.length > 1) {
        store.add('messages', {
          id: 'm_' + Date.now().toString(36), threadId: th.id, userId: meId,
          at: Date.now(), text, byAgent: true,
        });
        store.update('threads', th.id, { at: Date.now() });
      }
      router.go('#/messages/' + th.id);
      return { say: text ? t('msg.sent') + ' → @' + u.handle : t('a.open') + ' : @' + u.handle, hash: '#/messages/' + th.id };
    },
  });

  register({
    id: 'setTheme', label: t('set.theme'),
    keywords: ['mode sombre', 'mode clair', 'theme sombre', 'theme clair', 'passe en sombre',
      'passe en clair', 'dark mode', 'light mode', 'change le theme'],
    run: (args, ctx) => {
      const q = norm(ctx.phrase || '');
      let theme = args.theme;
      if (!theme) {
        if (q.includes('clair') || q.includes('light') || q.includes('jour')) theme = 'light';
        else if (q.includes('sombre') || q.includes('dark') || q.includes('nuit')) theme = 'dark';
        else theme = store.settings().theme === 'dark' ? 'light' : 'dark';
      }
      store.setSettings({ theme });
      return { say: t('set.theme') + ' : ' + t(theme === 'dark' ? 'set.themeDark' : 'set.themeLight') };
    },
  });

  register({
    id: 'setLocale', label: t('set.locale'),
    keywords: ['change la langue', 'parle en', 'mets en francais', 'switch to english',
      'en anglais', 'en espagnol', 'en arabe', 'en chinois', 'en portugais', 'en nouchi', 'language'],
    run: (args, ctx) => {
      const q = norm(ctx.phrase || '');
      let id = args.locale;
      if (!id) {
        const map = { francais: 'fr', french: 'fr', nouchi: 'nouchi', anglais: 'en', english: 'en',
          espagnol: 'es', spanish: 'es', portugais: 'pt', portuguese: 'pt',
          arabe: 'ar', arabic: 'ar', chinois: 'zh', chinese: 'zh' };
        for (const [k, v] of Object.entries(map)) if (q.includes(k)) { id = v; break; }
      }
      if (!id || !LOCALES.some((l) => l.id === id)) return { ok: false, say: t('agent.cantDo') };
      store.setSettings({ locale: id });
      setLocale(id);
      return { say: t('set.locale') + ' : ' + (LOCALES.find((l) => l.id === id) || {}).label };
    },
  });

  register({
    id: 'setCurrency', label: t('set.currency'),
    keywords: ['change la devise', 'mets en euro', 'mets en dollar', 'devise', 'currency', 'en fcfa'],
    run: (args, ctx) => {
      const q = norm(ctx.phrase || '');
      let cur = args.currency;
      if (!cur) {
        if (q.includes('euro')) cur = 'EUR';
        else if (q.includes('dollar') || q.includes('usd')) cur = 'USD';
        else if (q.includes('fcfa') || q.includes('xof') || q.includes('cfa')) cur = 'XOF';
        else if (q.includes('taro')) cur = 'TARO';
        else if (q.includes('naira')) cur = 'NGN';
        else if (q.includes('cedi')) cur = 'GHS';
      }
      if (!cur || !CURRENCIES.includes(cur)) return { ok: false, say: t('agent.cantDo') };
      store.setSettings({ currency: cur });
      return { say: t('set.currency') + ' : ' + cur };
    },
  });

  register({
    id: 'setFontScale', label: t('set.fontScale'),
    keywords: ['agrandis le texte', 'reduis le texte', 'texte plus grand', 'texte plus petit',
      'bigger text', 'smaller text', 'taille du texte'],
    run: (args, ctx) => {
      const q = norm(ctx.phrase || '');
      const cur = Number(store.settings().fontScale) || 1;
      const up = q.includes('agrandis') || q.includes('plus grand') || q.includes('bigger') || q.includes('augmente');
      const next = Math.max(0.85, Math.min(1.4, cur + (up ? 0.1 : -0.1)));
      store.setSettings({ fontScale: Number(next.toFixed(2)) });
      return { say: t('set.fontScale') + ' : ' + Math.round(next * 100) + '%' };
    },
  });

  register({
    id: 'toggleTrends', label: t('set.showTrends'),
    keywords: ['cache les tendances', 'affiche les tendances', 'panneau tendances', 'masque le rail'],
    run: (args, ctx) => {
      const q = norm(ctx.phrase || '');
      const want = q.includes('affiche') || q.includes('montre') ? true
        : (q.includes('cache') || q.includes('masque') ? false : !store.settings().showTrends);
      store.setSettings({ showTrends: want });
      return { say: t('set.showTrends') + ' : ' + (want ? t('a.ok') : t('a.hide')) };
    },
  });

  register({
    id: 'addToCart', label: t('shop.add'),
    keywords: ['ajoute au panier', 'mets dans le panier', 'add to cart', 'achete'],
    run: (args, ctx) => {
      const q = norm(ctx.phrase || '');
      let prod = args.productId ? store.byId('products', args.productId) : null;
      if (!prod) prod = store.data().products.find((p) => q.includes(norm(p.title))) || null;
      if (!prod) {
        const words = q.split(' ').filter((w) => w.length > 3);
        prod = store.data().products.find((p) => words.some((w) => norm(p.title).includes(w))) || null;
      }
      if (!prod) return { ok: false, say: t('agent.cantDo') };
      store.commit('cart', (c) => {
        const line = (c.data.cart || []).find((l) => l.productId === prod.id);
        if (line) line.qty += 1;
        else {
          if (!c.data.cart) c.data.cart = [];
          c.data.cart.push({ productId: prod.id, qty: 1 });
        }
        c.touch('data');
      });
      return { say: t('shop.add') + ' : ' + prod.title, hash: '#/shop?tab=cart' };
    },
  });

  register({
    id: 'clearCart', label: t('a.remove'),
    keywords: ['vide le panier', 'vider le panier', 'empty cart', 'enleve tout du panier'],
    danger: true,
    run: () => {
      store.commit('cart', (c) => { c.data.cart = []; c.touch('data'); });
      return { say: t('shop.empty'), hash: '#/shop?tab=cart' };
    },
  });

  register({
    id: 'readNotifications', label: t('notif.markAll'),
    keywords: ['marque les notifications', 'tout lu', 'mark all read', 'vide mes notifications',
      'nettoie mes notifications', 'supprime les spams'],
    run: () => {
      let n = 0;
      store.commit('notif', (c) => {
        for (const x of c.data.notifications || []) if (!x.read) { x.read = true; n++; }
        c.touch('data');
      });
      return { say: t('notif.markAll') + ' (' + n + ')', hash: '#/notifications' };
    },
  });

  register({
    id: 'search', label: t('a.search'),
    keywords: ['cherche', 'recherche', 'trouve', 'search', 'find'],
    run: (args, ctx) => {
      const q = args.q || extractQuoted(ctx.phrase || '')
        || extractAfter(ctx.phrase || '', ['cherche', 'recherche', 'trouve', 'search for', 'search', 'find']);
      if (!q) return { ok: false, say: t('agent.cantDo') };
      const hash = '#/search?q=' + encodeURIComponent(q);
      router.go(hash);
      return { say: t('a.search') + ' : ' + q, hash };
    },
  });

  register({
    id: 'clearSearchHistory', label: t('search.clear'),
    keywords: ['efface mon historique', 'vide l historique de recherche', 'clear search history'],
    danger: true,
    run: () => { store.setSession({ searchHistory: {} }); return { say: t('search.clear') + ' ✓' }; },
  });

  register({
    id: 'createStory', label: t('stories.add'),
    keywords: ['cree une story', 'nouvelle story', 'poste une story', 'add a story'],
    run: (args, ctx) => {
      const text = args.text || extractQuoted(ctx.phrase || '') || extractAfter(ctx.phrase || '', ['story']);
      const st = {
        id: 'st_' + Date.now().toString(36), userId: store.session().meId, at: Date.now(),
        ttl: 24 * 3600e3, kind: 'text', text: text || t('app.tagline'),
        bg: 'linear-gradient(135deg,#6c5cff,#ff3b5c)', viewers: [], allowDownload: true, byAgent: true,
      };
      store.add('stories', st);
      router.go('#/');
      return { say: t('stories.share') + ' ✓' };
    },
  });

  register({
    id: 'joinGroup', label: t('groups.join'),
    keywords: ['rejoins le groupe', 'rejoindre le groupe', 'join the group', 'inscris moi au groupe'],
    run: (args, ctx) => {
      const q = norm(ctx.phrase || '');
      const g = store.data().groups.find((x) => q.includes(norm(x.name)))
        || store.data().groups.find((x) => norm(x.topic || '') && q.includes(norm(x.topic)));
      if (!g) return { ok: false, say: t('agent.cantDo') };
      store.update('groups', g.id, { joined: true, members: (g.members || 0) + (g.joined ? 0 : 1) });
      return { say: t('groups.joined') + ' : ' + g.name, hash: '#/groups?id=' + g.id };
    },
  });

  register({
    id: 'attendEvent', label: t('events.going'),
    keywords: ['je vais a l evenement', 'inscris moi a l evenement', 'attend the event', 'j y vais'],
    run: (args, ctx) => {
      const q = norm(ctx.phrase || '');
      const e = store.data().events.find((x) => q.includes(norm(x.title))) || store.data().events[0];
      if (!e) return { ok: false, say: t('agent.cantDo') };
      store.update('events', e.id, { going: true, attendees: (e.attendees || 0) + (e.going ? 0 : 1) });
      return { say: t('events.going') + ' : ' + e.title, hash: '#/events?id=' + e.id };
    },
  });

  register({
    id: 'applyJob', label: t('jobs.apply'),
    keywords: ['postule', 'postuler', 'candidature', 'apply to', 'envoie ma candidature'],
    run: (args, ctx) => {
      const q = norm(ctx.phrase || '');
      const j = store.data().jobs.find((x) => q.includes(norm(x.title)))
        || store.data().jobs.find((x) => q.includes(norm(x.company)))
        || store.data().jobs.slice().sort((a, b) => (b.match || 0) - (a.match || 0))[0];
      if (!j) return { ok: false, say: t('agent.cantDo') };
      const exists = (store.data().applications || []).some((a) => a.jobId === j.id);
      if (!exists) {
        store.add('applications', {
          id: 'ap_' + Date.now().toString(36), jobId: j.id, userId: store.session().meId,
          at: Date.now(), status: 'envoyée', byAgent: true,
        });
      }
      return { say: t('jobs.applied') + ' : ' + j.title, hash: '#/jobs?id=' + j.id };
    },
  });

  register({
    id: 'exportData', label: t('set.export'),
    keywords: ['exporte mes donnees', 'sauvegarde mes donnees', 'export my data'],
    run: () => {
      const json = store.exportAll();
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'gbairai-zone-' + new Date().toISOString().slice(0, 10) + '.json';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      return { say: t('set.export') + ' ✓' };
    },
  });

  register({
    id: 'stats', label: t('owner.stats'),
    keywords: ['combien', 'statistiques', 'resume', 'how many', 'bilan', 'etat de la zone'],
    run: () => {
      const d = store.data();
      const me = store.me();
      const unread = (d.notifications || []).filter((n) => !n.read).length;
      const cart = (d.cart || []).reduce((n, l) => n + l.qty, 0);
      const say = [
        d.posts.length + ' ' + t('search.posts').toLowerCase(),
        d.shorts.length + ' ' + t('nav.shorts').toLowerCase(),
        (me.saved || []).length + ' ' + t('nav.saved').toLowerCase(),
        unread + ' ' + t('notif.unread').toLowerCase(),
        cart + ' ' + t('shop.cart').toLowerCase(),
      ].join(' · ');
      return { say };
    },
  });
}

/* ---------------------------- actions dynamiques ------------------------ */

/** Les modules de vue ajoutent leurs actions contextuelles ici. */
export function registerView(id, def) {
  register(Object.assign({}, def, { id }));
}

export function unregister(id) { registry.delete(id); }
