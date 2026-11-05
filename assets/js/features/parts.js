/* ==========================================================================
   parts.js — briques communes à toutes les vues
   · En-tête avec flèche de retour (partout sauf l'accueil) et moteur de
     recherche à la demande, cloisonné par option, qui recouvre les onglets.
   · Carte de publication, commentaires, rail de stories, visionneuse média,
     partage et téléchargement — disponibles pour chaque contenu.
   ========================================================================== */

import { h, mount, clear, richText, delegate, uid, isPhone, trapFocus } from '../core/dom.js';
import { icon, iconFilled } from '../core/icons.js';
import { t, ago, nfmt, money, dateFmt } from '../core/i18n.js';
import * as store from '../core/store.js';
import * as router from '../core/router.js';
import * as searchEngine from '../core/search.js';
import {
  toast, modal, sheet, confirm, menu, avatar, img as safeImg, fallbackTile,
  backBar, searchbox, tabs as tabsCtl, empty, copyLink, mediaSrc, hydrate,
} from '../core/ui.js';
import { download, mediaEl, pickFile, toMedia, editMedia } from '../core/media.js';
import { demoRef, posterFor } from '../data/demoMedia.js';
import * as agent from './agent.js';

/* ============================== en-tête de vue ========================== */

/**
 * viewHead({ title, scope, scopeArg, tabsItems, activeTab, onTab, tools, hint })
 * La flèche de retour n'apparaît jamais sur l'accueil : ailleurs, toujours.
 */
export function viewHead(opts = {}) {
  const path = (router.ctx() || {}).path || '/';
  const isHome = path === '/' || path === '';
  const wrap = h('div.vhead');

  if (!isHome && opts.back !== false) wrap.appendChild(backBar(opts.backLabel));

  const tools = h('div.vtools');
  const searchSlot = h('div', { style: { position: 'relative' } });

  if (opts.scope) {
    const btn = h('button.icon-btn', {
      type: 'button', 'aria-label': t('a.search'), title: t('a.search') + ' — ' + searchEngine.scopeLabel(opts.scope),
    }, icon('search'));
    btn.addEventListener('click', () => {
      if (searchSlot.firstChild) { clear(searchSlot); btn.classList.remove('on'); return; }
      btn.classList.add('on');
      mount(searchSlot, scopedSearch(opts.scope, {
        userId: opts.scopeArg,
        onClose: () => { clear(searchSlot); btn.classList.remove('on'); },
      }));
    });
    tools.appendChild(btn);
  }

  if (opts.tools) for (const tool of [].concat(opts.tools).filter(Boolean)) tools.appendChild(tool);

  tools.appendChild(h('button.icon-btn', {
    type: 'button', 'aria-label': agent.agentName(), title: agent.agentName() + ' — ' + t('agent.sub'),
    onclick: () => agent.togglePanel(),
  }, icon('sparkles')));

  const titleRow = h('div.vhead-row',
    opts.title ? h('h1', opts.title) : null,
    opts.badge || null,
    tools,
  );
  wrap.appendChild(titleRow);
  if (opts.hint) wrap.appendChild(h('p.sm.mut', opts.hint));

  if (opts.tabsItems && opts.tabsItems.length) {
    const bar = h('div', { style: { position: 'relative' } },
      tabsCtl(opts.tabsItems, opts.activeTab, opts.onTab),
      searchSlot,
    );
    wrap.appendChild(bar);
  } else {
    wrap.appendChild(searchSlot);
  }
  return wrap;
}

/** Moteur de recherche cloisonné, rendu en surcouche des options du haut. */
export function scopedSearch(scope, opts = {}) {
  const res = h('div.s-res');
  const box = searchbox({
    placeholder: searchEngine.scopeHint(scope),
    autofocus: true,
    onInput: (q) => render(q),
    onSubmit: (q) => { if (q) searchEngine.remember(scope, q); render(q); },
    onClose: opts.onClose,
  });
  const scopeNote = h('p.xs.mut-3', t('search.scope', { scope: searchEngine.scopeLabel(scope) }));
  const wrap = h('div.search-overlay', box.el, scopeNote, res);

  function render(q) {
    clear(res);
    if (!q || q.length < 2) {
      const hist = searchEngine.recent(scope);
      if (!hist.length) { res.appendChild(h('p.xs.mut-3', { style: { padding: '8px 11px' } }, searchEngine.scopeHint(scope))); return; }
      res.appendChild(h('div.row.between', { style: { padding: '4px 11px' } },
        h('span.xs.mut-3', t('search.recent')),
        h('button.xs', { type: 'button', style: { color: 'var(--a-text)' }, onclick: () => { searchEngine.clearHistory(scope); render(''); } }, t('search.clear')),
      ));
      for (const item of hist) {
        res.appendChild(h('button', { type: 'button', onclick: () => { box.input.value = item; render(item); } },
          icon('clock'), h('span.grow.trunc', item)));
      }
      return;
    }
    const hits = searchEngine.search(scope, q, { userId: opts.userId, limit: 24 });
    if (!hits.length) { res.appendChild(h('p.xs.mut-3', { style: { padding: '10px 11px' } }, t('search.empty', { q }))); return; }
    for (const hit of hits) {
      const title = h('span.grow.trunc');
      for (const part of searchEngine.highlight(hit.title, q)) {
        title.appendChild(part && part.hi ? h('mark.s-hi', part.hi) : document.createTextNode(String(part)));
      }
      res.appendChild(h('a', {
        href: hit.hash,
        onclick: () => { searchEngine.remember(scope, q); if (opts.onClose) opts.onClose(); },
      }, icon(hit.icon || 'search'), title,
        hit.sub ? h('span.xs.mut-3.trunc', { style: { 'max-width': '34%' } }, hit.sub) : null,
        h('span.k', t('search.' + (hit.kind === 'user' ? 'people' : 'all')) === t('search.all') ? hit.kind : t('search.people')),
      ));
    }
  }
  render('');
  return wrap;
}

/* ============================ panneau publicitaire ===================== */

export function billboard() {
  const ads = (store.data().ads || []).filter((a) => a.active !== false);
  if (!ads.length) return null;
  let i = 0;
  const slide = h('div.bb-slide');
  const dots = h('div.bb-dots', ads.map((_, k) => h('button', {
    type: 'button', 'aria-label': 'Visuel ' + (k + 1), 'aria-current': k === 0 ? 'true' : 'false',
    onclick: () => { i = k; paint(); },
  })));

  const wrap = h('div.billboard', { id: 'billboard' },
    slide,
    ads.length > 1 ? dots : null,
    store.isOwner()
      ? h('div.bb-admin', h('button.icon-btn.solid.sm', {
        type: 'button', 'aria-label': t('bb.admin'), title: t('bb.admin'),
        onclick: () => router.go('#/owner'),
      }, icon('settings')))
      : null,
  );

  function paint() {
    const ad = ads[i % ads.length];
    const visual = ad.kind === 'video' && ad.ref
      ? mediaEl({ kind: 'video', ref: ad.ref, fit: ad.fit }, { autoplay: true, muted: true, loop: true })
      : safeImg(ad.ref, { label: ad.label || ad.title, alt: ad.title, eager: true });
    mount(slide, visual, h('div.bb-shade',
      h('div.t', ad.title),
      ad.sub ? h('div.s', ad.sub) : null,
      h('div.acts',
        ad.cta ? h('a.btn.sm.primary', {
          href: ad.ctaUrl || '#/',
          onclick: () => store.update('ads', ad.id, (a) => ({ clicks: (a.clicks || 0) + 1 })),
        }, ad.cta) : null,
        h('button.btn.sm.ghost', { type: 'button', onclick: () => shareSheet({ kind: 'ad', id: ad.id, title: ad.title }) }, icon('share'), t('a.share')),
      ),
    ));
    for (const [k, d] of Array.from(dots.children).entries()) d.setAttribute('aria-current', k === (i % ads.length) ? 'true' : 'false');
    store.update('ads', ad.id, (a) => ({ impressions: (a.impressions || 0) + 1 }));
  }
  paint();

  if (ads.length > 1) {
    const slot = Math.max(3, Number(ads[0].slot) || 7) * 1000;
    const timer = setInterval(() => {
      if (!wrap.isConnected) { clearInterval(timer); return; }
      i = (i + 1) % ads.length;
      paint();
    }, slot);
  }
  return wrap;
}

/* ================================ stories ============================== */

export function storiesRail(opts = {}) {
  const all = (store.data().stories || []).filter((s) => (s.at + (s.ttl || 24 * 3600e3)) > Date.now());
  const meId = store.session().meId;
  const seen = new Set(store.session().seenStories || []);
  const byUser = new Map();
  for (const s of all) {
    if (!byUser.has(s.userId)) byUser.set(s.userId, []);
    byUser.get(s.userId).push(s);
  }
  const mine = byUser.get(meId) || [];
  const others = Array.from(byUser.entries()).filter(([uid2]) => uid2 !== meId);

  const rail = h('div.stories', { id: 'stories' });

  rail.appendChild(h('button.st-item.st-add', {
    type: 'button', onclick: () => storyComposer(),
    'aria-label': mine.length ? t('stories.yours') : t('stories.add'),
  },
    h('span', { style: { position: 'relative', display: 'inline-grid' } },
      avatar(store.me(), 56, { ring: mine.length > 0 }),
      mine.length ? null : h('span.plus', icon('plus')),
    ),
    h('span.lb', mine.length ? t('stories.yours') : t('stories.add')),
  ));
  if (mine.length) {
    rail.lastChild.addEventListener('click', (e) => { e.stopPropagation(); openStories(meId); }, true);
  }

  for (const [userId, list] of others) {
    const u = store.user(userId);
    if (!u) continue;
    const allSeen = list.every((s) => seen.has(s.id));
    rail.appendChild(h('button.st-item', {
      type: 'button', onclick: () => openStories(userId),
      'aria-label': u.name,
    },
      avatar(u, 56, { ring: true, seen: allSeen }),
      h('span.lb', u.name.split(' ')[0]),
    ));
  }
  if (others.length === 0 && !mine.length && opts.hideIfEmpty) return null;
  return rail;
}

/** Composeur de story : texte, photo ou vidéo, durée du clip et de la publication. */
export function storyComposer(existing) {
  const draft = existing
    ? Object.assign({}, existing)
    : { kind: 'text', text: '', ref: null, clipLen: 10, ttlHours: 24, allowDownload: true, bg: 'linear-gradient(135deg,#6c5cff,#ff3b5c)' };
  let media = existing && existing.ref ? { kind: existing.kind, ref: existing.ref, fit: existing.fit } : null;

  const preview = h('div', {
    style: {
      'border-radius': 'var(--r-md)', overflow: 'hidden', 'min-height': '180px',
      display: 'grid', 'place-items': 'center', background: draft.bg, position: 'relative',
    },
  });

  const textIn = h('textarea.textarea', { placeholder: t('stories.text'), maxlength: 220 }, draft.text || '');
  textIn.value = draft.text || '';
  textIn.addEventListener('input', () => { draft.text = textIn.value; paintPreview(); });

  const clipIn = h('select.select',
    [5, 8, 10, 15, 20, 30, 60].map((n) => h('option', { value: String(n), selected: n === draft.clipLen ? true : null }, n + ' s')));
  clipIn.addEventListener('change', () => { draft.clipLen = Number(clipIn.value); });

  const ttlIn = h('select.select',
    [1, 3, 6, 12, 24, 48, 72].map((n) => h('option', { value: String(n), selected: n === draft.ttlHours ? true : null }, t('stories.hours', { n }))));
  ttlIn.addEventListener('change', () => { draft.ttlHours = Number(ttlIn.value); });

  const dlIn = h('input', { type: 'checkbox', checked: draft.allowDownload ? true : null });

  function paintPreview() {
    clear(preview);
    preview.style.background = media ? '#05070e' : draft.bg;
    if (media) {
      const el = mediaEl(media, { class: '', autoplay: true, muted: true, loop: true });
      if (el) { el.style.maxHeight = '280px'; el.style.width = '100%'; el.style.objectFit = 'cover'; preview.appendChild(el); }
    }
    if (draft.text) {
      preview.appendChild(h('div', {
        style: {
          position: media ? 'absolute' : 'static', inset: media ? '0' : 'auto',
          display: 'grid', 'place-items': 'center', padding: '22px', 'text-align': 'center',
          color: '#fff', 'font-weight': '700', 'font-size': '1.15rem',
          'text-shadow': media ? '0 2px 12px rgba(0,0,0,.7)' : 'none',
        },
      }, draft.text));
    }
    if (!media && !draft.text) preview.appendChild(h('p.xs.mut-3', t('media.dropHint')));
  }
  paintPreview();

  const kindBar = h('div.row.wrap.gap-2',
    h('button.btn.sm.ghost', {
      type: 'button',
      onclick: () => { media = null; draft.kind = 'text'; paintPreview(); },
    }, icon('edit'), t('stories.text')),
    h('button.btn.sm.ghost', {
      type: 'button',
      onclick: async () => {
        const files = await pickFile({ accept: 'image/*' });
        if (!files.length) return;
        const md = await toMedia(files[0]);
        if (!md) return;
        const edited = await editMedia(md, { ratio: '9:16', title: t('stories.photo'), asSheet: true });
        if (!edited) return;
        media = edited; draft.kind = 'image'; paintPreview();
      },
    }, icon('image'), t('stories.photo')),
    h('button.btn.sm.ghost', {
      type: 'button',
      onclick: async () => {
        const files = await pickFile({ accept: 'video/*' });
        if (!files.length) return;
        const md = await toMedia(files[0]);
        if (!md) return;
        const edited = await editMedia(md, { ratio: '9:16', title: t('stories.videoKind'), asSheet: true });
        if (!edited) return;
        media = edited; draft.kind = 'video'; paintPreview();
      },
    }, icon('film'), t('stories.videoKind')),
  );

  const palette = ['linear-gradient(135deg,#6c5cff,#ff3b5c)', 'linear-gradient(135deg,#ff7a3d,#f7c948)',
    'linear-gradient(135deg,#2fbf71,#2f7fe0)', 'linear-gradient(135deg,#111729,#28314f)'];

  const m = sheet({
    title: existing ? t('stories.editMedia') : t('stories.add'),
    body: h('div.stack.gap-4',
      preview,
      kindBar,
      h('div.field', h('label', t('stories.text')), textIn),
      media ? null : h('div.field', h('span.lbl', t('set.accent')), h('div.swatches', palette.map((p) => h('button.swatch', {
        type: 'button', style: { background: p }, 'aria-label': 'Fond',
        onclick: () => { draft.bg = p; paintPreview(); },
      })))),
      h('div.grid-2',
        draft.kind === 'video' || (media && media.kind === 'video')
          ? h('div.field', h('label', t('stories.clipLen')), clipIn) : null,
        h('div.field', h('label', t('stories.liveFor')), ttlIn),
      ),
      h('label.row.gap-2', dlIn, h('span.sm', t('set.allowDl'))),
      h('p.xs.mut-3', t('profile.manualHint')),
    ),
    foot: [
      existing ? h('button.btn.danger', {
        type: 'button',
        onclick: async () => {
          const ok = await confirm({ title: t('a.delete'), message: existing.text || t('stories.title'), danger: true, okLabel: t('a.delete') });
          if (!ok) return;
          store.remove('stories', existing.id);
          toast(t('toast.deleted'), 'ok');
          m.close();
          router.render();
        },
      }, icon('trash'), t('a.delete')) : null,
      h('span.grow'),
      h('button.btn.ghost', { type: 'button', onclick: () => m.close() }, t('a.cancel')),
      h('button.btn.primary', {
        type: 'button',
        onclick: () => {
          if (!media && !String(draft.text || '').trim()) { toast(t('toast.nothing'), 'bad'); return; }
          const payload = {
            kind: media ? media.kind : 'text',
            ref: media ? media.ref : null,
            fit: media ? media.fit : null,
            trim: media && media.trim ? media.trim : null,
            text: draft.text || '',
            bg: draft.bg,
            clipLen: draft.clipLen,
            ttl: draft.ttlHours * 3600e3,
            allowDownload: !!dlIn.checked,
          };
          if (existing) {
            store.update('stories', existing.id, payload);
          } else {
            store.add('stories', Object.assign({
              id: uid('st'), userId: store.session().meId, at: Date.now(), viewers: [],
            }, payload));
          }
          toast(t('toast.saved'), 'ok');
          m.close();
          router.render();
        },
      }, icon('check'), existing ? t('a.save') : t('stories.share')),
    ],
  });
}

/** Visionneuse de stories : barres de progression, vues, édition, partage. */
export function openStories(userId, startId) {
  const list = (store.data().stories || [])
    .filter((s) => s.userId === userId && (s.at + (s.ttl || 24 * 3600e3)) > Date.now())
    .sort((a, b) => a.at - b.at);
  if (!list.length) { toast(t('stories.expired'), 'info'); return; }
  const u = store.user(userId);
  const isMine = userId === store.session().meId;
  let idx = Math.max(0, startId ? list.findIndex((s) => s.id === startId) : 0);

  const bars = h('div.st-bars', list.map(() => h('i', h('b'))));
  const stage = h('div.st-stage');
  const side = h('div.st-side');
  const foot = h('div.st-foot');
  const topInfo = h('div.who-t');

  const root = h('div.st-viewer', { role: 'dialog', 'aria-modal': 'true', 'aria-label': t('stories.title') },
    h('div', bars,
      h('div.st-top',
        avatar(u, 40),
        topInfo,
        h('button.icon-btn', { type: 'button', 'aria-label': t('a.close'), onclick: close }, icon('close')),
      ),
    ),
    stage,
    foot,
  );
  stage.appendChild(side);
  document.body.appendChild(root);
  document.body.classList.add('no-scroll');
  const release = trapFocus(root);

  let timer = 0;
  let raf = 0;
  let startedAt = 0;

  function paint() {
    const s = list[idx];
    if (!s) { close(); return; }
    // mémorise la vue
    const seen = new Set(store.session().seenStories || []);
    if (!seen.has(s.id)) {
      seen.add(s.id);
      store.setSession({ seenStories: Array.from(seen).slice(-200) });
      if (!isMine) {
        store.update('stories', s.id, (st) => {
          const v = (st.viewers || []).slice();
          if (!v.some((x) => x.userId === store.session().meId)) v.push({ userId: store.session().meId, at: Date.now() });
          return { viewers: v };
        });
      }
    }

    mount(topInfo, h('div.nm', u ? u.name : ''), h('div.mt', ago(s.at)));

    clear(stage);
    stage.appendChild(side);
    const dur = (s.kind === 'video' ? (s.clipLen || 10) : 6) * 1000;

    if (s.kind === 'text' || (!s.ref && !s.demo)) {
      stage.style.background = s.bg || '#111729';
      stage.appendChild(h('div.txt', s.text || ''));
    } else {
      stage.style.background = '#000';
      const ref = s.ref || demoRef(s.demo);
      if (s.kind === 'video') {
        const v = mediaEl({ kind: 'video', ref, fit: s.fit, trim: s.trim }, { autoplay: true, muted: false, loop: true });
        if (v) { v.style.maxHeight = '100%'; stage.appendChild(v); v.play().catch(() => {}); }
        if (!ref) stage.appendChild(h('img', { src: posterFor(s.demo) || fallbackTile(s.label, s.id), alt: s.label || '', style: { 'max-height': '100%' } }));
      } else {
        stage.appendChild(safeImg(ref, { label: s.label, alt: s.text || '', eager: true, style: { 'max-height': '100%', 'object-fit': 'contain' } }));
      }
      if (s.text) stage.appendChild(h('div.txt', { style: { position: 'absolute', inset: 'auto 0 12% 0' } }, s.text));
    }

    // navigation par moitié d'écran
    stage.appendChild(h('div.st-nav',
      h('button', { type: 'button', 'aria-label': t('a.back'), onclick: prev }),
      h('button', { type: 'button', 'aria-label': t('a.more'), onclick: next }),
    ));

    // actions latérales
    mount(side,
      h('button.icon-btn', { type: 'button', 'aria-label': t('a.share'), onclick: () => shareSheet({ kind: 'story', id: s.id, title: s.text || t('stories.title') }) }, icon('share')),
      s.allowDownload !== false
        ? h('button.icon-btn', { type: 'button', 'aria-label': t('a.download'), onclick: () => download(s.ref || demoRef(s.demo), 'story-' + s.id) }, icon('download'))
        : null,
      isMine ? h('button.icon-btn', { type: 'button', 'aria-label': t('a.edit'), onclick: () => { pause(); storyComposer(s); } }, icon('edit')) : null,
      isMine ? h('button.icon-btn', {
        type: 'button', 'aria-label': t('stories.viewers'),
        onclick: () => { pause(); viewersSheet(s); },
      }, icon('eye'), h('span.lb', nfmt((s.viewers || []).length))) : null,
    );

    // pied : réponse ou statistiques
    mount(foot, isMine
      ? h('div.row.gap-3.grow',
        h('span.chip', icon('eye'), nfmt((s.viewers || []).length) + ' ' + t('stories.viewers')),
        h('span.grow'),
        h('button.btn.sm.soft', { type: 'button', onclick: () => { pause(); storyComposer(s); } }, icon('edit'), t('a.edit')),
      )
      : (() => {
        const box = searchbox({ placeholder: t('stories.replyTo'), onSubmit: (txt) => {
          if (!txt) return;
          replyToStory(userId, txt);
          toast(t('msg.sent'), 'ok');
        } });
        return box.el;
      })());

    // progression
    Array.from(bars.children).forEach((b, k) => {
      b.classList.toggle('done', k < idx);
      b.firstChild.style.width = k < idx ? '100%' : '0';
    });
    startedAt = performance.now();
    cancelAnimationFrame(raf);
    const tickBar = () => {
      const p = Math.min(1, (performance.now() - startedAt) / dur);
      if (bars.children[idx]) bars.children[idx].firstChild.style.width = (p * 100) + '%';
      if (p < 1 && !paused) raf = requestAnimationFrame(tickBar);
    };
    raf = requestAnimationFrame(tickBar);
    clearTimeout(timer);
    timer = setTimeout(next, dur);
  }

  let paused = false;
  function pause() { paused = true; clearTimeout(timer); cancelAnimationFrame(raf); }
  function next() { if (idx < list.length - 1) { idx++; paused = false; paint(); } else close(); }
  function prev() { if (idx > 0) { idx--; paused = false; paint(); } }
  function close() {
    clearTimeout(timer);
    cancelAnimationFrame(raf);
    release();
    root.remove();
    document.body.classList.remove('no-scroll');
    document.removeEventListener('keydown', onKey, true);
    router.render();
  }
  const onKey = (e) => {
    if (e.key === 'Escape') close();
    else if (e.key === 'ArrowRight') next();
    else if (e.key === 'ArrowLeft') prev();
  };
  document.addEventListener('keydown', onKey, true);
  paint();
}

function viewersSheet(story) {
  const list = (story.viewers || []).slice().sort((a, b) => b.at - a.at);
  sheet({
    title: t('stories.viewers') + ' · ' + list.length,
    body: list.length
      ? h('div.viewers', list.map((v) => {
        const u = store.user(v.userId);
        return h('a.v', { href: u ? '#/u/' + u.handle : '#/' },
          avatar(u, 34),
          h('div.stack', h('span.sm.b', u ? u.name : v.userId), h('span.xs.mut-3', u ? '@' + u.handle : '')),
          h('span.t', ago(v.at)),
        );
      }))
      : empty('eye', t('stories.noViewer')),
  });
}

function replyToStory(userId, text) {
  const meId = store.session().meId;
  let th = store.data().threads.find((x) => (x.members || []).includes(userId) && (x.members || []).includes(meId));
  if (!th) {
    th = { id: uid('th'), members: [meId, userId], at: Date.now(), unread: 0 };
    store.add('threads', th);
  }
  store.add('messages', { id: uid('m'), threadId: th.id, userId: meId, at: Date.now(), text });
  store.update('threads', th.id, { at: Date.now() });
}

/* ============================ carte publication ======================== */

export function postCard(post, opts = {}) {
  const au = store.user(post.userId);
  const liked = new Set(store.data().likes.posts || []).has(post.id);
  const saved = new Set((store.me().saved) || []).has(post.id);
  const cmts = (store.data().comments || []).filter((c) => c.postId === post.id);
  const isMine = post.userId === store.session().meId;

  const media = (post.media || []).filter(Boolean);
  const mediaWrap = media.length
    ? h('div.post-media', { class: 'n' + Math.min(4, media.length) }, media.slice(0, 4).map((md, k) => {
      const tile = h('div.mtile', { class: media.length > 1 ? '' : (md.kind === 'video' ? 'tall' : '') });
      if (md.kind === 'video') {
        const ref = md.ref || demoRef(md.demo);
        const v = mediaEl({ kind: 'video', ref, fit: md.fit, trim: md.trim }, { muted: true, loop: true, preload: 'metadata' });
        if (v) tile.appendChild(v);
        tile.appendChild(h('div.play', h('span', icon('play'))));
      } else {
        tile.appendChild(safeImg(md.ref, { label: md.label, alt: md.label || post.text.slice(0, 40), seed: md.id }));
      }
      if (post.allowDownload !== false) {
        tile.appendChild(h('div.mdl', h('button.icon-btn.solid.sm', {
          type: 'button', 'aria-label': t('a.download'), title: t('a.download'),
          onclick: (e) => { e.stopPropagation(); download(md.ref || demoRef(md.demo), 'gbzn-' + md.id); },
        }, icon('download'))));
      }
      tile.addEventListener('click', () => openLightbox(media, k, { post }));
      return tile;
    }))
    : null;

  const likeBtn = h('button.act', { class: liked ? 'on' : '', type: 'button', 'aria-pressed': liked ? 'true' : 'false' },
    liked ? iconFilled('heart') : icon('heart'), h('span', nfmt((post.likes || 0) + (liked ? 1 : 0))));
  likeBtn.addEventListener('click', () => {
    const set = new Set(store.data().likes.posts || []);
    if (set.has(post.id)) set.delete(post.id); else set.add(post.id);
    store.commit('like', (c) => { c.data.likes.posts = Array.from(set); c.touch('data'); });
    const on = set.has(post.id);
    likeBtn.classList.toggle('on', on);
    likeBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
    mount(likeBtn, on ? iconFilled('heart') : icon('heart'), h('span', nfmt((post.likes || 0) + (on ? 1 : 0))));
  });

  const saveBtn = h('button.act.sv', { class: saved ? 'on' : '', type: 'button', 'aria-label': t('a.save'), 'aria-pressed': saved ? 'true' : 'false' },
    saved ? iconFilled('bookmark') : icon('bookmark'));
  saveBtn.addEventListener('click', () => {
    const me = store.me();
    const set = new Set(me.saved || []);
    if (set.has(post.id)) set.delete(post.id); else set.add(post.id);
    store.update('users', me.id, { saved: Array.from(set) });
    const on = set.has(post.id);
    saveBtn.classList.toggle('on', on);
    saveBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
    mount(saveBtn, on ? iconFilled('bookmark') : icon('bookmark'));
    toast(on ? t('a.saved') : t('a.remove'), 'ok');
  });

  const cmtHost = h('div');
  const cmtBtn = h('button.act', { type: 'button' }, icon('comment'), h('span', nfmt(cmts.length)));
  cmtBtn.addEventListener('click', () => {
    if (cmtHost.firstChild) { clear(cmtHost); return; }
    mount(cmtHost, commentsBlock(post));
  });

  const card = h('article.card.post', { dataset: { post: post.id } },
    h('div.post-head',
      h('a', { href: au ? '#/u/' + au.handle : '#/' }, avatar(au, 44)),
      h('div.who-t.grow',
        h('a.nm', { href: au ? '#/u/' + au.handle : '#/' }, au ? au.name : '', au && au.verified ? icon('verified') : null),
        h('div.mt', (au ? '@' + au.handle : '') + ' · ' + ago(post.at)
          + (post.byAgent ? ' · ' + agent.agentName() : '')),
      ),
      post.pinned ? h('span.chip', icon('pin'), t('a.pin')) : null,
      h('button.icon-btn.sm', {
        type: 'button', 'aria-label': t('a.more'),
        onclick: (e) => postMenu(e.currentTarget, post, isMine),
      }, icon('more')),
    ),
    post.text ? h('div.post-body', { html: richText(post.text) }) : null,
    mediaWrap,
    h('div.row.gap-3.xs.mut-3', h('span', nfmt(post.views || 0) + ' ' + t('feed.views')),
      post.shares ? h('span', nfmt(post.shares) + ' ' + t('a.share').toLowerCase()) : null),
    h('div.post-acts',
      likeBtn, cmtBtn,
      h('button.act', { type: 'button', onclick: () => shareSheet({ kind: 'post', id: post.id, title: post.text }) }, icon('share'), h('span.hide-sm', t('a.share'))),
      h('span.act.spacer'),
      post.allowDownload !== false && media.length
        ? h('button.act', { type: 'button', 'aria-label': t('a.download'), onclick: () => downloadMenu(media, post) }, icon('download'))
        : null,
      saveBtn,
    ),
    cmtHost,
  );

  if (opts.openComments) mount(cmtHost, commentsBlock(post));
  return card;
}

function postMenu(anchor, post, isMine) {
  menu(anchor, [
    { icon: 'link', label: t('a.copy'), fn: () => copyLink('#/post/' + post.id) },
    { icon: 'share', label: t('a.share'), fn: () => shareSheet({ kind: 'post', id: post.id, title: post.text }) },
    (post.media || []).length && post.allowDownload !== false
      ? { icon: 'download', label: t('a.download'), fn: () => downloadMenu(post.media, post) } : null,
    { sep: true },
    isMine ? { icon: 'edit', label: t('a.edit'), fn: () => editPost(post) } : null,
    isMine ? {
      icon: 'trash', label: t('a.delete'), fn: async () => {
        const ok = await confirm({ title: t('a.delete'), message: (post.text || '').slice(0, 120), danger: true, okLabel: t('a.delete') });
        if (!ok) return;
        store.remove('posts', post.id);
        toast(t('toast.deleted'), 'ok');
        router.render();
      },
    } : null,
    !isMine ? { icon: 'eyeOff', label: t('a.hide'), fn: () => { store.remove('posts', post.id); toast(t('a.hide'), 'ok'); router.render(); } } : null,
    !isMine ? { icon: 'warn', label: t('a.report'), fn: () => toast(t('a.report') + ' ✓', 'ok') } : null,
  ].filter(Boolean));
}

function editPost(post) {
  const ta = h('textarea.textarea', { style: { 'min-height': '140px' } });
  ta.value = post.text || '';
  const dl = h('input', { type: 'checkbox', checked: post.allowDownload !== false ? true : null });
  const m = modal({
    title: t('a.edit'),
    body: h('div.stack.gap-3', ta, h('label.row.gap-2', dl, h('span.sm', t('set.allowDl'))), h('p.xs.mut-3', t('profile.manualHint'))),
    foot: [
      h('button.btn.ghost', { type: 'button', onclick: () => m.close() }, t('a.cancel')),
      h('button.btn.primary', {
        type: 'button',
        onclick: () => {
          const text = ta.value.trim();
          const tags = (text.match(/#([\p{L}\p{N}_]{2,40})/gu) || []).map((s) => s.slice(1));
          store.update('posts', post.id, { text, tags, allowDownload: !!dl.checked, editedAt: Date.now() });
          toast(t('toast.saved'), 'ok');
          m.close();
          router.render();
        },
      }, icon('check'), t('a.save')),
    ],
  });
}

/* ============================== commentaires =========================== */

export function commentsBlock(post, opts = {}) {
  const host = h('div.stack.gap-2', { style: { 'border-top': '1px solid var(--line-soft)', 'padding-top': '10px' } });

  function render() {
    const list = (store.data().comments || [])
      .filter((c) => c.postId === post.id)
      .sort((a, b) => (b.viral ? 1 : 0) - (a.viral ? 1 : 0) || b.at - a.at);
    clear(host);
    host.appendChild(h('div.row.between', h('span.xs.mut-3', t('feed.comments') + ' · ' + list.length)));
    if (!list.length) host.appendChild(h('p.xs.mut-3', t('feed.noComment')));
    for (const c of list.slice(0, opts.limit || 20)) host.appendChild(commentRow(c, render));
    const box = searchbox({
      placeholder: t('feed.addComment'),
      onSubmit: (txt) => {
        if (!txt) return;
        store.add('comments', { id: uid('c'), postId: post.id, userId: store.session().meId, at: Date.now(), text: txt, likes: 0 });
        render();
      },
    });
    box.el.classList.remove('searchbox');
    box.el.classList.add('searchbox');
    host.appendChild(box.el);
  }
  render();
  return host;
}

function commentRow(c, rerender) {
  const u = store.user(c.userId);
  const liked = new Set(store.data().likes.comments || []).has(c.id);
  const isMine = c.userId === store.session().meId;
  return h('div.cmt', { class: c.viral ? 'viral' : '' },
    avatar(u, 34),
    h('div.cmt-b',
      h('div.bub',
        h('div.nm', u ? u.name : '', c.viral ? h('span.chip.taro', { style: { 'margin-inline-start': '6px', padding: '0 7px', 'font-size': '.6rem' } }, icon('flame'), t('feed.viral')) : null),
        h('div', { html: richText(c.text || '') }),
      ),
      h('div.mt',
        h('span', ago(c.at)),
        h('button', {
          type: 'button',
          onclick: () => {
            const set = new Set(store.data().likes.comments || []);
            if (set.has(c.id)) set.delete(c.id); else set.add(c.id);
            store.commit('likeC', (ctx) => { ctx.data.likes.comments = Array.from(set); ctx.touch('data'); });
            rerender();
          },
        }, (liked ? '♥ ' : '') + t('a.like') + ' · ' + nfmt((c.likes || 0) + (liked ? 1 : 0))),
        c.relatedTo ? h('button', {
          type: 'button',
          onclick: () => openRelated(c.relatedTo),
        }, t('shorts.related')) : null,
        isMine ? h('button', {
          type: 'button',
          onclick: async () => {
            const ok = await confirm({ title: t('a.delete'), message: c.text, danger: true, okLabel: t('a.delete') });
            if (!ok) return;
            store.remove('comments', c.id);
            rerender();
          },
        }, t('a.delete')) : null,
      ),
    ),
  );
}

/** Un commentaire viral renvoie vers le contenu dont il parle. */
export function openRelated(target) {
  const ref = String(target || '');
  if (ref.startsWith('user:')) { const u = store.user(ref.slice(5)); router.go(u ? '#/u/' + u.handle : '#/'); return; }
  if (ref.startsWith('sound:')) { router.go('#/sound/' + ref.slice(6)); return; }
  if (store.byId('shorts', ref)) { router.go('#/shorts?id=' + ref); return; }
  if (store.byId('posts', ref)) { router.go('#/post/' + ref); return; }
  router.go('#/search?q=' + encodeURIComponent(ref));
}

/* ============================== visionneuse ============================ */

export function openLightbox(mediaList, index, opts = {}) {
  const list = [].concat(mediaList).filter(Boolean);
  if (!list.length) return;
  let i = Math.max(0, Math.min(list.length - 1, index || 0));

  const stage = h('div.lb-stage');
  const acts = h('div.lb-acts');
  const cmts = h('div.lb-cmts', { hidden: true });
  const caption = h('div.sm.mut');

  const root = h('div.lightbox', { role: 'dialog', 'aria-modal': 'true', 'aria-label': t('profile.media') },
    h('div.lb-top',
      h('button.icon-btn', { type: 'button', 'aria-label': t('a.back'), onclick: close }, icon('back')),
      h('div.grow.sm', opts.title || (opts.post ? (store.user(opts.post.userId) || {}).name : '') || ''),
      list.length > 1 ? h('span.chip', (i + 1) + ' / ' + list.length) : null,
      h('button.icon-btn', { type: 'button', 'aria-label': t('a.close'), onclick: close }, icon('close')),
    ),
    stage,
    h('div.lb-foot', caption, acts, cmts),
  );
  document.body.appendChild(root);
  document.body.classList.add('no-scroll');
  const release = trapFocus(root);

  function paint() {
    const md = list[i];
    clear(stage);
    if (md.kind === 'video') {
      const ref = md.ref || demoRef(md.demo);
      const v = mediaEl({ kind: 'video', ref, fit: md.fit, trim: md.trim }, { controls: true, autoplay: true, muted: false, loop: true });
      if (v) stage.appendChild(v);
      else stage.appendChild(h('img', { src: posterFor(md.demo) || fallbackTile(md.label, md.id), alt: '' }));
    } else {
      stage.appendChild(safeImg(md.ref, { label: md.label, alt: md.label || '', eager: true }));
    }
    if (list.length > 1) {
      stage.appendChild(h('div', { style: { position: 'absolute', inset: 'auto 0 50% 0', display: 'flex', 'justify-content': 'space-between', padding: '0 8px', 'pointer-events': 'none' } },
        h('button.icon-btn.solid', { type: 'button', style: { 'pointer-events': 'auto' }, 'aria-label': t('a.back'), onclick: () => { i = (i - 1 + list.length) % list.length; paint(); } }, icon('left')),
        h('button.icon-btn.solid', { type: 'button', style: { 'pointer-events': 'auto' }, 'aria-label': t('a.more'), onclick: () => { i = (i + 1) % list.length; paint(); } }, icon('right')),
      ));
    }
    caption.textContent = md.label || (opts.post ? (opts.post.text || '').slice(0, 140) : '');

    // actions : j'aime, commenter, partager, télécharger — comme sur le profil
    const target = opts.post || null;
    const likeKey = target ? target.id : md.id;
    const likedSet = new Set(store.data().likes.posts || []);
    const liked = likedSet.has(likeKey);
    mount(acts,
      h('button.act', { class: liked ? 'on' : '', type: 'button', onclick: () => {
        const set = new Set(store.data().likes.posts || []);
        if (set.has(likeKey)) set.delete(likeKey); else set.add(likeKey);
        store.commit('like', (c) => { c.data.likes.posts = Array.from(set); c.touch('data'); });
        paint();
      } }, liked ? iconFilled('heart') : icon('heart'), h('span', t('a.like'))),
      target ? h('button.act', { type: 'button', onclick: () => {
        cmts.hidden = !cmts.hidden;
        if (!cmts.hidden) mount(cmts, commentsBlock(target, { limit: 30 }));
      } }, icon('comment'), h('span', t('a.comment'))) : null,
      h('button.act', { type: 'button', onclick: () => shareSheet({ kind: 'media', id: md.id, title: md.label || '' }) }, icon('share'), h('span', t('a.share'))),
      (opts.post ? opts.post.allowDownload !== false : true)
        ? h('button.act', { type: 'button', onclick: () => download(md.ref || demoRef(md.demo), 'gbzn-' + md.id) }, icon('download'), h('span', t('a.download')))
        : null,
      opts.onEdit ? h('button.act', { type: 'button', onclick: () => { close(); opts.onEdit(); } }, icon('edit'), h('span', t('a.edit'))) : null,
    );
  }

  function close() {
    release();
    root.remove();
    document.body.classList.remove('no-scroll');
    document.removeEventListener('keydown', onKey, true);
  }
  const onKey = (e) => {
    if (e.key === 'Escape') close();
    else if (e.key === 'ArrowRight' && list.length > 1) { i = (i + 1) % list.length; paint(); }
    else if (e.key === 'ArrowLeft' && list.length > 1) { i = (i - 1 + list.length) % list.length; paint(); }
  };
  document.addEventListener('keydown', onKey, true);
  paint();
}

/* ================================ partage ============================== */

export function shareSheet(target) {
  const url = location.origin + location.pathname + hashFor(target);
  const m = sheet({
    title: t('a.share'),
    body: h('div.stack.gap-3',
      h('p.sm.mut.clamp-2', target.title || ''),
      h('div.grid-auto',
        shareTile('link', t('a.copy'), () => { copyLink(hashFor(target)); m.close(); }),
        shareTile('comment', t('nav.messages'), () => { m.close(); shareToThread(target); }),
        shareTile('phone', t('call.share'), () => { m.close(); toast(t('call.shareHint'), 'info'); router.go('#/messages'); }),
        shareTile('bookmark', t('a.save'), () => {
          const me = store.me();
          const set = new Set(me.saved || []);
          set.add(target.id);
          store.update('users', me.id, { saved: Array.from(set) });
          toast(t('a.saved'), 'ok');
          m.close();
        }),
        navigator.share ? shareTile('share', 'Système', async () => {
          try { await navigator.share({ title: 'GBAIRAI ZONE', text: target.title || '', url }); m.close(); }
          catch (e) { /* annulé */ }
        }) : null,
      ),
      h('div.field', h('span.lbl', t('a.copy')), h('input.input', { value: url, readonly: true, onclick: (e) => e.currentTarget.select() })),
    ),
  });
}

function shareTile(ic, label, fn) {
  return h('button.card.pad.hover', { type: 'button', onclick: fn, style: { display: 'grid', gap: '7px', 'justify-items': 'center', 'text-align': 'center' } },
    icon(ic), h('span.xs', label));
}

function hashFor(target) {
  switch (target.kind) {
    case 'post': return '#/post/' + target.id;
    case 'short': return '#/shorts?id=' + target.id;
    case 'product': return '#/shop?id=' + target.id;
    case 'story': return '#/';
    default: return location.hash;
  }
}

function shareToThread(target) {
  const threads = store.data().threads || [];
  const m = sheet({
    title: t('nav.messages'),
    body: h('div.stack.gap-1', threads.map((th) => {
      const other = (th.members || []).find((x) => x !== store.session().meId);
      const u = store.user(other);
      return h('button.msg-item', {
        type: 'button',
        onclick: () => {
          store.add('messages', {
            id: uid('m'), threadId: th.id, userId: store.session().meId, at: Date.now(),
            text: (target.title || t('a.share')) + ' — ' + hashFor(target), shared: target,
          });
          store.update('threads', th.id, { at: Date.now() });
          toast(t('msg.sent'), 'ok');
          m.close();
          router.go('#/messages/' + th.id);
        },
      }, avatar(u, 40), h('div.b', h('div.nm', u ? u.name : th.title), h('div.pv', u ? '@' + u.handle : '')));
    })),
  });
}

/* ============================ téléchargement =========================== */

export function downloadMenu(mediaList, post) {
  const list = [].concat(mediaList).filter(Boolean);
  if (list.length === 1) { download(list[0].ref || demoRef(list[0].demo), 'gbzn-' + list[0].id); return; }
  const m = sheet({
    title: t('a.download'),
    body: h('div.stack.gap-1', list.map((md, k) => h('button.msg-item', {
      type: 'button',
      onclick: () => { download(md.ref || demoRef(md.demo), 'gbzn-' + md.id); m.close(); },
    }, icon(md.kind === 'video' ? 'film' : 'image'), h('div.b', h('div.nm', (md.label || (t('profile.media') + ' ' + (k + 1))))))) ),
  });
}

/* ============================== rail latéral =========================== */

/** Tendances + suggestions : seulement sur l'accueil, jamais ailleurs. */
export function homeRail() {
  const trends = searchEngine.trendingTags(6);
  const me = store.me();
  const follows = new Set(store.data().follows || []);
  const suggestions = store.data().users
    .filter((u) => u.id !== me.id && !follows.has(u.id))
    .slice(0, 4);
  const live = (store.data().streams || []).filter((s) => s.live).slice(0, 3);

  return h('div.rail-stack',
    live.length ? h('div.rail-card',
      h('h3', t('live.title')),
      h('div.stack.gap-2', live.map((s) => {
        const u = store.user(s.userId);
        return h('a.who', { href: '#/live?id=' + s.id },
          avatar(u, 34),
          h('div.stack.grow', h('span.sm.b.trunc', s.title), h('span.xs.mut-3', nfmt(s.viewers) + ' ' + t('live.viewers'))),
          h('span.chip.live', icon('live'), 'LIVE'),
        );
      })),
    ) : null,
    trends.length ? h('div.rail-card',
      h('h3', t('feed.trending')),
      h('div.stack', trends.map(([tag, n], k) => h('button.trend', {
        type: 'button', onclick: () => router.go('#/search?q=%23' + encodeURIComponent(tag)),
      },
        h('span.n', String(k + 1)),
        h('div.stack.grow', h('span.t', '#' + tag), h('span.xs.mut-3', nfmt(n) + ' ' + t('search.posts').toLowerCase())),
      ))),
    ) : null,
    suggestions.length ? h('div.rail-card',
      h('h3', t('search.people')),
      h('div.stack', suggestions.map((u) => h('div.who',
        h('a', { href: '#/u/' + u.handle }, avatar(u, 34)),
        h('a.stack.grow', { href: '#/u/' + u.handle }, h('span.sm.b.trunc', u.name), h('span.xs.mut-3.trunc', '@' + u.handle)),
        h('button.btn.sm.soft', {
          type: 'button',
          onclick: (e) => {
            const list = new Set(store.data().follows || []);
            list.add(u.id);
            store.commit('follow', (c) => { c.data.follows = Array.from(list); c.touch('data'); });
            e.currentTarget.replaceWith(h('span.chip.ok', icon('check'), t('a.following')));
          },
        }, t('a.follow')),
      ))),
    ) : null,
    h('div.rail-card',
      h('h3', agent.agentName()),
      h('p.xs.mut', t('agent.sub') + ' · ' + t('agent.private')),
      h('button.btn.sm.soft.block', { type: 'button', style: { 'margin-top': '8px' }, onclick: () => agent.openPanel() },
        icon('sparkles'), t('agent.placeholder').slice(0, 24) + '…'),
    ),
  );
}
