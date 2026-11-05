/* ==========================================================================
   shorts.js — lecteur vertical
   Points corrigés par rapport aux signalements :
   · le panneau de réglages s'ouvre seul, le compte et les actions passent
     hors écran tant qu'il est ouvert ;
   · coupure et activation du son toujours accessibles ;
   · recherche à la demande en haut à droite, qui recouvre les onglets ;
   · piste musicale cliquable vers l'artiste et les vidéos du même son ;
   · deux commentaires viraux qui mènent au contenu dont ils parlent ;
   · pas de rail de stories sur téléphone ni tablette ;
   · téléchargement proposé si l'auteur l'autorise.
   ========================================================================== */

import { h, mount, clear, isPhone, isTablet, uid } from '../core/dom.js';
import { icon, iconFilled } from '../core/icons.js';
import { t, nfmt, ago } from '../core/i18n.js';
import * as store from '../core/store.js';
import * as router from '../core/router.js';
import { toast, avatar, empty, sheet, menu, copyLink, tabs as tabsCtl, switchCtl } from '../core/ui.js';
import { download, mediaEl, pickFile, toMedia, editMedia, fitStyle } from '../core/media.js';
import { resolve as resolveBlob } from '../core/idb.js';
import { viewHead, scopedSearch, storiesRail, commentsBlock, shareSheet, openRelated } from '../features/parts.js';
import { demoRef, posterFor, ensureDemoMedia } from '../data/demoMedia.js';
import * as agent from '../features/agent.js';

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2, 3];
const SKIPS = [5, 10, 15, 30];
const QUALITIES = ['auto', '1080p', '720p', '480p', '360p'];

const TABS = () => [
  { id: 'foryou', label: t('feed.foryou') },
  { id: 'following', label: t('feed.following') },
  { id: 'trending', label: t('feed.trending') },
];

export function render(ctx, host) {
  const tab = ctx.query.tab || 'foryou';
  const d = store.data();
  const follows = new Set(d.follows || []);

  let list = d.shorts.slice();
  if (tab === 'following') list = list.filter((v) => follows.has(v.userId) || v.userId === store.session().meId);
  if (tab === 'trending') list.sort((a, b) => (b.likes + b.shares * 4) - (a.likes + a.shares * 4));
  else list.sort((a, b) => b.at - a.at);

  if (ctx.query.sound) list = d.shorts.filter((v) => v.soundId === ctx.query.sound);
  if (ctx.query.user) {
    const u = store.user(ctx.query.user);
    if (u) list = d.shorts.filter((v) => v.userId === u.id);
  }

  const head = viewHead({
    title: t('shorts.title'),
    scope: 'shorts',
    tabsItems: TABS(),
    activeTab: tab,
    onTab: (id) => router.replaceQuery({ tab: id === 'foryou' ? null : id, id: null }),
    tools: [
      h('button.icon-btn', {
        type: 'button', 'aria-label': t('shorts.create'), title: t('shorts.create'),
        onclick: createShort,
      }, icon('plus')),
    ],
  });

  const feed = h('div.shorts', { id: 'shorts', tabindex: '0' });
  const aside = h('aside.sh-aside');
  const wrap = h('div.stack.gap-3', head,
    // le rail de stories ne s'affiche pas sur téléphone ni tablette
    (isPhone() || isTablet()) ? null : storiesRail({ hideIfEmpty: true }),
    h('div.sh-layout', feed, aside),
  );

  if (!list.length) {
    mount(host, h('div.stack.gap-3', head, empty('shorts', t('feed.empty'),
      h('button.btn.primary', { type: 'button', onclick: createShort }, icon('plus'), t('shorts.create')))));
    return {};
  }

  const cards = list.map((v) => shortCard(v, { onActive: (cur) => paintAside(aside, cur, list) }));
  for (const c of cards) feed.appendChild(c.el);
  mount(host, wrap);

  // lecture du short visible seulement
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      const card = cards.find((c) => c.el === e.target);
      if (!card) continue;
      if (e.isIntersecting && e.intersectionRatio > 0.6) card.activate();
      else card.deactivate();
    }
  }, { root: feed, threshold: [0, 0.6, 1] });
  for (const c of cards) io.observe(c.el);

  // ouverture directe sur un short précis
  const wanted = ctx.query.id;
  if (wanted) {
    const i = list.findIndex((v) => v.id === wanted);
    if (i >= 0) requestAnimationFrame(() => { feed.scrollTop = cards[i].el.offsetTop - feed.offsetTop; cards[i].activate(); });
  } else if (cards[0]) {
    requestAnimationFrame(() => cards[0].activate());
  }

  feed.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' || e.key === 'PageDown') { e.preventDefault(); feed.scrollBy({ top: feed.clientHeight, behavior: 'smooth' }); }
    if (e.key === 'ArrowUp' || e.key === 'PageUp') { e.preventDefault(); feed.scrollBy({ top: -feed.clientHeight, behavior: 'smooth' }); }
  });

  return { cleanup: () => io.disconnect() };
}

/* ------------------------------ carte short ----------------------------- */

function shortCard(v, cardOpts = {}) {
  const s = store.settings();
  const au = store.user(v.userId);
  const el = h('section.short', { dataset: { short: v.id } });

  // La référence du média peut ne pas encore exister au moment où la carte est
  // construite : elle est résolue à l'affichage, donc la vue n'a jamais besoin
  // d'être reconstruite sous les doigts de l'utilisateur.
  const refNow = () => v.ref || demoRef(v.demo);
  let video = null;
  let srcLoaded = false;
  {
    // Élément créé sans source : le fichier n'est chargé qu'au moment où le
    // short arrive à l'écran. Rien à annuler quand on passe au suivant.
    video = h('video', {
      playsinline: true, preload: 'none',
      muted: s.defaultMuted !== false, loop: s.loopShorts !== false,
      'aria-label': v.caption || t('nav.shorts'),
    });
    if (v.fit) {
      const st = fitStyle(v.fit);
      video.style.transform = st.transform;
      video.style.transformOrigin = 'center';
    }
    if (v.trim) {
      video.addEventListener('loadedmetadata', () => { try { video.currentTime = v.trim.from || 0; } catch (e) { /* ignore */ } });
      video.addEventListener('timeupdate', () => {
        if (v.trim && video.currentTime > v.trim.to) video.currentTime = v.trim.from || 0;
      });
    }
  }
  if (video) {
    el.appendChild(video);
  }
  {
    const poster = posterFor(v.demo);
    const ph = poster
      ? h('img.sh-ph', { src: poster, alt: v.caption || '' })
      : h('div.sh-ph', icon('film'), h('p.xs', v.caption || t('nav.shorts')));
    ph.style.position = 'absolute';
    ph.style.inset = '0';
    el.insertBefore(ph, el.firstChild);
  }
  el.appendChild(h('div.sh-shade'));

  /* ---------------------------- barre du haut --------------------------- */
  const panelHost = h('div');
  const searchHost = h('div');

  const muteBtn = h('button.icon-btn', {
    type: 'button',
    'aria-label': (video && video.muted) !== false ? t('a.unmute') : t('a.mute'),
    title: (video && video.muted) !== false ? t('a.unmute') : t('a.mute'),
  }, icon((video && video.muted) !== false ? 'mute' : 'volume'));
  muteBtn.addEventListener('click', () => {
    if (!video) { toast(t('a.unmute'), 'info'); return; }
    video.muted = !video.muted;
    if (!video.muted && video.volume === 0) video.volume = 0.8;
    mount(muteBtn, icon(video.muted ? 'mute' : 'volume'));
    muteBtn.setAttribute('aria-label', video.muted ? t('a.unmute') : t('a.mute'));
    muteBtn.title = muteBtn.getAttribute('aria-label');
  });

  const searchBtn = h('button.icon-btn', { type: 'button', 'aria-label': t('a.search'), title: t('a.search') }, icon('search'));
  searchBtn.addEventListener('click', () => {
    if (searchHost.firstChild) { clear(searchHost); searchBtn.classList.remove('on'); return; }
    closePanel();
    searchBtn.classList.add('on');
    const box = scopedSearch('shorts', { onClose: () => { clear(searchHost); searchBtn.classList.remove('on'); } });
    box.classList.remove('search-overlay');
    box.classList.add('sh-search');
    mount(searchHost, box);
  });

  const gearBtn = h('button.icon-btn', { type: 'button', 'aria-label': t('shorts.player'), title: t('shorts.player') }, icon('settings'));
  gearBtn.addEventListener('click', () => {
    if (panelHost.firstChild) { closePanel(); return; }
    clear(searchHost); searchBtn.classList.remove('on');
    openPanel();
  });

  el.appendChild(h('div.sh-top',
    h('span.grow'),
    muteBtn,
    searchBtn,
    gearBtn,
    h('button.icon-btn', {
      type: 'button', 'aria-label': t('a.more'),
      onclick: (e) => shortMenu(e.currentTarget, v, video),
    }, icon('more')),
  ));
  el.appendChild(searchHost);
  el.appendChild(panelHost);

  /* ------------------------ informations du compte --------------------- */
  const info = h('div.sh-info',
    h('a.nm', { href: au ? '#/u/' + au.handle : '#/' },
      avatar(au, 34), h('span', au ? '@' + au.handle : ''),
      au && au.verified ? icon('verified') : null,
      followChip(v.userId),
    ),
    h('p.cap.clamp-3', v.caption || ''),
    // piste musicale : mène à l'artiste et aux vidéos du même son
    h('button.sh-music', {
      type: 'button',
      onclick: () => soundSheet(v),
      'aria-label': t('shorts.music') + ' · ' + (v.soundTitle || ''),
    }, icon('music'), h('span.t', (v.soundTitle || t('shorts.music')) + ' · ' + (v.soundArtist || ''))),
    // deux commentaires viraux cliquables
    (v.viral || []).length
      ? h('div.sh-viral', (v.viral || []).slice(0, 2).map((c) => h('button', {
        type: 'button', onclick: () => openRelated(c.to), 'aria-label': t('shorts.related'),
      }, icon('flame'), h('span', c.text))))
      : null,
  );
  el.appendChild(info);

  /* ----------------------------- actions ------------------------------- */
  const likeSet = () => new Set(store.data().likes.shorts || []);
  const savedSet = () => new Set(store.me().saved || []);

  const likeBtn = h('button.a', { type: 'button', class: likeSet().has(v.id) ? 'on' : '', 'aria-label': t('a.like') });
  const paintLike = () => {
    const on = likeSet().has(v.id);
    likeBtn.classList.toggle('on', on);
    mount(likeBtn, on ? iconFilled('heart') : icon('heart'), h('span.n', nfmt((v.likes || 0) + (on ? 1 : 0))));
  };
  likeBtn.addEventListener('click', () => {
    const set = likeSet();
    if (set.has(v.id)) set.delete(v.id); else set.add(v.id);
    store.commit('likeShort', (c) => { c.data.likes.shorts = Array.from(set); c.touch('data'); });
    paintLike();
  });
  paintLike();

  const saveBtn = h('button.a.sv', { type: 'button', class: savedSet().has(v.id) ? 'on' : '', 'aria-label': t('a.save') });
  const paintSave = () => {
    const on = savedSet().has(v.id);
    saveBtn.classList.toggle('on', on);
    mount(saveBtn, on ? iconFilled('bookmark') : icon('bookmark'), h('span.n', t('a.save')));
  };
  saveBtn.addEventListener('click', () => {
    const me = store.me();
    const set = new Set(me.saved || []);
    if (set.has(v.id)) set.delete(v.id); else set.add(v.id);
    store.update('users', me.id, { saved: Array.from(set) });
    paintSave();
    toast(set.has(v.id) ? t('a.saved') : t('a.remove'), 'ok');
  });
  paintSave();

  const acts = h('div.sh-acts',
    likeBtn,
    h('button.a', { type: 'button', 'aria-label': t('a.comment'), onclick: () => commentsSheet(v) },
      icon('comment'), h('span.n', nfmt(v.comments || 0))),
    h('button.a', { type: 'button', 'aria-label': t('a.share'), onclick: () => shareSheet({ kind: 'short', id: v.id, title: v.caption }) },
      icon('share'), h('span.n', nfmt(v.shares || 0))),
    saveBtn,
    v.allowDownload !== false
      ? h('button.a', { type: 'button', 'aria-label': t('a.download'), onclick: () => download(refNow(), 'short-' + v.id + '.webm') },
        icon('download'), h('span.n', t('a.download')))
      : null,
    h('button.a', { type: 'button', 'aria-label': t('a.gift'), onclick: () => giftSheet(v) }, icon('gift'), h('span.n', t('a.gift'))),
    h('button.a', { type: 'button', 'aria-label': agent.agentName(), onclick: () => agent.openPanel() }, icon('bot'), h('span.n', agent.agentName())),
    h('button.a', { type: 'button', onclick: () => soundSheet(v), 'aria-label': t('shorts.music') }, h('span.sh-disc', icon('music'))),
  );
  el.appendChild(acts);

  /* ------------------------ réglages du lecteur ------------------------ */

  function openPanel() {
    el.classList.add('panel-open');       // le compte et les actions disparaissent
    const vol = h('input', { type: 'range', min: '0', max: '1', step: '0.05', value: String(video ? video.volume : 0.8) });
    vol.addEventListener('input', () => {
      if (!video) return;
      video.volume = Number(vol.value);
      if (video.volume > 0 && video.muted) { video.muted = false; mount(muteBtn, icon('volume')); }
    });

    const speedRow = h('div.pr-opts', SPEEDS.map((sp) => {
      const b = h('button', {
        type: 'button', 'aria-pressed': (video ? video.playbackRate : 1) === sp ? 'true' : 'false',
      }, sp + '×');
      b.addEventListener('click', () => {
        if (video) video.playbackRate = sp;
        for (const x of speedRow.children) x.setAttribute('aria-pressed', 'false');
        b.setAttribute('aria-pressed', 'true');
        toast(t('shorts.speed') + ' ' + sp + '×', 'info');
      });
      return b;
    }));

    const skipRow = h('div.pr-opts', SKIPS.map((n) => h('button', {
      type: 'button',
      onclick: () => { if (video) video.currentTime = Math.max(0, video.currentTime + n); toast('+' + n + ' s', 'info'); },
    }, '+' + n + ' s')).concat(SKIPS.map((n) => h('button', {
      type: 'button',
      onclick: () => { if (video) video.currentTime = Math.max(0, video.currentTime - n); toast('−' + n + ' s', 'info'); },
    }, '−' + n + ' s'))));

    const qRow = h('div.pr-opts', QUALITIES.map((q) => {
      const b = h('button', { type: 'button', 'aria-pressed': store.settings().preferredQuality === q ? 'true' : 'false' }, q);
      b.addEventListener('click', () => {
        store.setSettings({ preferredQuality: q });
        for (const x of qRow.children) x.setAttribute('aria-pressed', 'false');
        b.setAttribute('aria-pressed', 'true');
      });
      return b;
    }));

    const panel = h('div.pr-panel', { role: 'dialog', 'aria-label': t('shorts.player') },
      h('div.pr-head',
        icon('settings'),
        h('h3', t('shorts.player')),
        h('button.icon-btn.sm', { type: 'button', 'aria-label': t('a.close'), onclick: closePanel }, icon('close')),
      ),
      h('div.pr-body',
        h('div.pr-grp', h('span.lbl', t('shorts.speed')), speedRow),
        h('div.pr-grp', h('span.lbl', t('shorts.skip')), skipRow),
        h('div.pr-grp', h('span.lbl', t('shorts.volume')),
          h('div.pr-row', icon('volume'), vol,
            h('button.icon-btn.sm', { type: 'button', style: { color: '#fff' }, onclick: () => muteBtn.click() }, icon('mute'))),
        ),
        h('div.pr-grp', h('span.lbl', t('shorts.quality')), qRow),
        h('div.pr-grp', h('span.lbl', t('a.settings')),
          h('div.pr-row', h('span.grow', t('shorts.loop')), switchCtl(store.settings().loopShorts !== false, (x) => {
            store.setSettings({ loopShorts: x });
            if (video) video.loop = x;
          }, t('shorts.loop'))),
          h('div.pr-row', h('span.grow', t('shorts.autoplay')), switchCtl(store.settings().autoplay !== false, (x) => {
            store.setSettings({ autoplay: x });
          }, t('shorts.autoplay'))),
          h('div.pr-row', h('span.grow', t('shorts.captions')), switchCtl(!!store.settings().captions, (x) => {
            store.setSettings({ captions: x });
          }, t('shorts.captions'))),
          h('div.pr-row', h('span.grow', t('set.saver')), switchCtl(!!store.settings().dataSaver, (x) => {
            store.setSettings({ dataSaver: x });
            if (video) video.preload = x ? 'none' : 'metadata';
          }, t('set.saver'))),
        ),
        h('div.pr-grp', h('span.lbl', t('a.download')),
          v.allowDownload !== false
            ? h('button.btn.sm.soft.block', { type: 'button', onclick: () => download(refNow(), 'short-' + v.id + '.webm') }, icon('download'), t('shorts.download'))
            : h('p.xs', { style: { color: 'rgba(255,255,255,.6)' } }, t('shorts.downloadOff')),
        ),
      ),
    );
    mount(panelHost, panel);
  }

  function closePanel() {
    clear(panelHost);
    el.classList.remove('panel-open');
  }

  /* ---------------------------- cycle de vie --------------------------- */

  let activated = false;
  return {
    el,
    activate() {
      if (activated) return;
      activated = true;
      if (video && !srcLoaded) {
        const load = (ref) => {
          if (!ref || srcLoaded) return;
          srcLoaded = true;
          video.preload = store.settings().dataSaver ? 'metadata' : 'auto';
          resolveBlob(ref).then((url) => {
            if (!url || !video.isConnected) return;
            video.src = url;
            if (store.settings().autoplay !== false) video.play().catch(() => { /* geste utilisateur requis */ });
          });
        };
        const ready = refNow();
        if (ready) load(ready);
        // L'encodage des vidéos de démonstration est peut-être en cours :
        // on se raccroche dessus sans reconstruire la vue.
        else ensureDemoMedia().then(() => { if (el.isConnected) load(refNow()); }).catch(() => {});
      } else if (video && store.settings().autoplay !== false) {
        video.play().catch(() => { /* geste utilisateur requis */ });
      }
      store.update('shorts', v.id, (x) => ({ views: (x.views || 0) + 1 }));
      if (cardOpts.onActive) cardOpts.onActive(v);
    },
    deactivate() {
      activated = false;
      if (video) { try { video.pause(); } catch (e) { /* ignore */ } }
      closePanel();
      clear(searchHost);
      searchBtn.classList.remove('on');
    },
  };
}

/* ------------------------- panneau d'accompagnement --------------------- */

/** Remplit les côtés du lecteur : auteur, son, commentaires, vidéos liées. */
function paintAside(host, v, list) {
  if (!host || !host.isConnected) return;
  const au = store.user(v.userId);
  const sameSound = list.filter((x) => x.soundId === v.soundId && x.id !== v.id);
  const others = list.filter((x) => x.id !== v.id).slice(0, 8);
  const cmts = (store.data().comments || []).filter((c) => c.postId === v.id);

  mount(host,
    h('div.card',
      h('div.row.gap-3',
        h('a', { href: au ? '#/u/' + au.handle : '#/' }, avatar(au, 48)),
        h('div.stack.grow',
          h('a.b.trunc', { href: au ? '#/u/' + au.handle : '#/' }, au ? au.name : ''),
          h('span.xs.mut-3', au ? '@' + au.handle : ''),
          h('span.xs.mut-3', nfmt(v.views || 0) + ' ' + t('feed.views') + ' · ' + ago(v.at)),
        ),
        followChip(v.userId),
      ),
      h('p.sm.mut', { style: { 'margin-top': '10px' } }, v.caption || ''),
      h('div.row.wrap.gap-2', { style: { 'margin-top': '8px' } },
        h('button.chip.btn-like', { type: 'button', onclick: () => soundSheet(v) }, icon('music'),
          h('span.trunc', { style: { 'max-width': '170px' } }, (v.soundTitle || '') + ' · ' + (v.soundArtist || ''))),
        (v.tags || []).map((tg) => h('a.chip', { href: '#/search?q=%23' + encodeURIComponent(tg) }, icon('hash'), tg)),
      ),
    ),
    (v.viral || []).length
      ? h('div.card',
        h('h3', t('feed.viral')),
        h('div.stack.gap-2', (v.viral || []).slice(0, 2).map((c) => h('button.card.pad.hover', {
          type: 'button', style: { 'text-align': 'start' }, onclick: () => openRelated(c.to),
        }, h('div.row.gap-2', icon('flame'), h('span.sm.grow', c.text), icon('right'))))),
      )
      : null,
    h('div.card',
      h('h3', t('feed.comments') + ' · ' + nfmt(v.comments || cmts.length)),
      h('button.btn.sm.soft.block', { type: 'button', onclick: () => commentsSheet(v) }, icon('comment'), t('a.comment')),
    ),
    sameSound.length
      ? h('div.card',
        h('h3', t('shorts.sameSound')),
        h('div.sh-rel', sameSound.map((x) => relRow(x))),
      )
      : null,
    others.length
      ? h('div.card',
        h('h3', t('feed.trending')),
        h('div.sh-rel', others.map((x) => relRow(x))),
      )
      : null,
  );
}

function relRow(x) {
  const u = store.user(x.userId);
  const poster = posterFor(x.demo);
  return h('a', { href: '#/shorts?id=' + x.id },
    h('span.th', poster ? h('img', { src: poster, alt: '', loading: 'lazy' }) : icon('film')),
    h('span.stack.grow', { style: { 'min-width': '0' } },
      h('span.sm.b.trunc', x.caption || t('nav.shorts')),
      h('span.xs.mut-3.trunc', (u ? '@' + u.handle : '') + ' · ' + nfmt(x.views || 0) + ' ' + t('feed.views')),
    ),
  );
}

function followChip(userId) {
  if (userId === store.session().meId) return null;
  const follows = new Set(store.data().follows || []);
  const on = follows.has(userId);
  const chip = h('span.chip', { class: on ? 'ok' : '', style: { 'margin-inline-start': '4px' } }, on ? t('a.following') : t('a.follow'));
  chip.addEventListener('click', (e) => {
    e.preventDefault(); e.stopPropagation();
    const list = new Set(store.data().follows || []);
    if (list.has(userId)) list.delete(userId); else list.add(userId);
    store.commit('follow', (c) => { c.data.follows = Array.from(list); c.touch('data'); });
    chip.className = 'chip' + (list.has(userId) ? ' ok' : '');
    chip.textContent = list.has(userId) ? t('a.following') : t('a.follow');
  });
  return chip;
}

/* -------------------------------- feuilles ------------------------------ */

function commentsSheet(v) {
  const pseudoPost = { id: v.id, userId: v.userId, text: v.caption };
  const viral = (v.viral || []).slice(0, 2);
  sheet({
    title: t('feed.comments') + ' · ' + nfmt(v.comments || 0),
    body: h('div.stack.gap-3',
      viral.length ? h('div.stack.gap-2',
        h('span.xs.mut-3', t('feed.viral')),
        viral.map((c) => h('button.card.pad.hover', {
          type: 'button', style: { 'text-align': 'start' }, onclick: () => openRelated(c.to),
        }, h('div.row.gap-2', icon('flame'), h('span.sm.grow', c.text), icon('right')))),
      ) : null,
      commentsBlock(pseudoPost, { limit: 30 }),
    ),
  });
}

function soundSheet(v) {
  const sameSound = store.data().shorts.filter((x) => x.soundId === v.soundId);
  const artist = store.user(v.soundUserId);
  const m = sheet({
    title: t('shorts.music'),
    body: h('div.stack.gap-4',
      h('div.row.gap-3',
        h('span.sh-disc', { style: { width: '54px', height: '54px' } }, icon('music')),
        h('div.stack.grow', h('span.b', v.soundTitle || ''), h('span.sm.mut', v.soundArtist || '')),
      ),
      h('div.row.wrap.gap-2',
        artist ? h('a.btn.sm.soft', { href: '#/u/' + artist.handle, onclick: () => m.close() }, icon('user'), t('shorts.artist')) : null,
        h('button.btn.sm.soft', {
          type: 'button',
          onclick: () => { m.close(); router.go('#/shorts?sound=' + encodeURIComponent(v.soundId)); },
        }, icon('shorts'), t('shorts.sameSound') + ' · ' + sameSound.length),
        h('button.btn.sm.ghost', { type: 'button', onclick: () => copyLink('#/sound/' + v.soundId) }, icon('link'), t('a.copy')),
      ),
      h('div.stack.gap-2',
        h('span.xs.mut-3', t('shorts.sameSound')),
        sameSound.map((x) => {
          const u = store.user(x.userId);
          return h('button.msg-item', {
            type: 'button',
            onclick: () => { m.close(); router.go('#/shorts?id=' + x.id); },
          }, avatar(u, 40), h('div.b',
            h('div.nm', u ? u.name : '', h('span.t', nfmt(x.views || 0) + ' ' + t('feed.views'))),
            h('div.pv.trunc', x.caption || ''),
          ));
        }),
      ),
    ),
  });
}

function giftSheet(v) {
  const au = store.user(v.userId);
  const amounts = [100, 500, 1000, 5000];
  const m = sheet({
    title: t('a.gift') + ' · ' + (au ? au.name : ''),
    size: 'slim',
    body: h('div.stack.gap-3',
      h('p.sm.mut', t('wallet.balance') + ' : ' + nfmt(store.me().taro || 0) + ' TARO'),
      h('div.grid-auto', amounts.map((a) => h('button.card.pad.hover', {
        type: 'button', style: { display: 'grid', 'justify-items': 'center', gap: '5px' },
        onclick: () => {
          const me = store.me();
          if ((me.taro || 0) < a) { toast(t('toast.notAllowed'), 'bad'); return; }
          store.update('users', me.id, { taro: (me.taro || 0) - a });
          if (au) store.update('users', au.id, { taro: (au.taro || 0) + a });
          store.add('transactions', { id: uid('tx'), at: Date.now(), label: t('a.gift') + ' → @' + (au ? au.handle : ''), kind: 'cadeau', amount: -a, dir: 'out' });
          toast(t('a.gift') + ' ' + nfmt(a) + ' TARO', 'ok');
          m.close();
        },
      }, icon('coin'), h('span.b', nfmt(a)), h('span.xs.mut-3', 'TARO')))),
    ),
  });
}

function shortMenu(anchor, v, video) {
  const isMine = v.userId === store.session().meId;
  menu(anchor, [
    { icon: 'link', label: t('a.copy'), fn: () => copyLink('#/shorts?id=' + v.id) },
    { icon: 'share', label: t('a.share'), fn: () => shareSheet({ kind: 'short', id: v.id, title: v.caption }) },
    { icon: 'music', label: t('shorts.music'), fn: () => soundSheet(v) },
    v.allowDownload !== false
      ? { icon: 'download', label: t('shorts.download'), fn: () => download(v.ref || demoRef(v.demo), 'short-' + v.id + '.webm') }
      : { icon: 'download', label: t('shorts.downloadOff'), disabled: true },
    { sep: true },
    isMine ? {
      icon: 'sliders', label: t('set.allowDl') + ' : ' + (v.allowDownload !== false ? t('a.ok') : t('a.remove')),
      fn: () => { store.update('shorts', v.id, { allowDownload: v.allowDownload === false }); toast(t('toast.saved'), 'ok'); router.render(); },
    } : null,
    isMine ? {
      icon: 'trash', label: t('a.delete'),
      fn: () => { store.remove('shorts', v.id); toast(t('toast.deleted'), 'ok'); router.render(); },
    } : null,
    !isMine ? { icon: 'warn', label: t('a.report'), fn: () => toast(t('a.report') + ' ✓', 'ok') } : null,
  ].filter(Boolean));
}

/* ------------------------------ création -------------------------------- */

export async function createShort() {
  const files = await pickFile({ accept: 'video/*' });
  if (!files.length) return;
  const md = await toMedia(files[0]);
  if (!md) return;
  const edited = await editMedia(md, { ratio: '9:16', title: t('shorts.create') });
  const media = edited || md;

  const cap = h('textarea.textarea', { placeholder: t('feed.composer'), maxlength: 300 });
  const soundTitle = h('input.input', { type: 'text', placeholder: t('shorts.music'), value: 'Son original' });
  const dl = h('input', { type: 'checkbox', checked: true });

  const m = sheet({
    title: t('shorts.create'),
    body: h('div.stack.gap-3',
      (() => {
        const prev = h('div', { style: { 'border-radius': 'var(--r-md)', overflow: 'hidden', 'max-height': '260px', background: '#000', display: 'grid', 'place-items': 'center' } });
        const el = mediaEl(media, { autoplay: true, muted: true, loop: true });
        if (el) { el.style.maxHeight = '260px'; prev.appendChild(el); }
        return prev;
      })(),
      h('div.field', h('label', t('feed.composer')), cap),
      h('div.field', h('label', t('shorts.music')), soundTitle),
      h('label.row.gap-2', dl, h('span.sm', t('set.allowDl'))),
      h('p.xs.mut-3', t('profile.manualHint')),
    ),
    foot: [
      h('button.btn.ghost', { type: 'button', onclick: () => m.close() }, t('a.cancel')),
      h('button.btn.primary', {
        type: 'button',
        onclick: () => {
          const me = store.me();
          const text = cap.value.trim();
          const id = uid('v');
          store.add('shorts', {
            id, userId: me.id, at: Date.now(), caption: text,
            tags: (text.match(/#([\p{L}\p{N}_]{2,40})/gu) || []).map((x) => x.slice(1)),
            ref: media.ref, fit: media.fit, trim: media.trim,
            soundId: uid('s'), soundTitle: soundTitle.value.trim() || 'Son original',
            soundArtist: me.name, soundUserId: me.id,
            likes: 0, comments: 0, shares: 0, views: 1,
            allowDownload: !!dl.checked, viral: [],
          });
          toast(t('toast.saved'), 'ok');
          m.close();
          router.go('#/shorts?id=' + id);
        },
      }, icon('check'), t('a.publish')),
    ],
  });
}

/* ---------------------------- page d'un son ----------------------------- */

export function renderSound(ctx, host) {
  const soundId = ctx.params.id;
  const list = store.data().shorts.filter((v) => v.soundId === soundId);
  const first = list[0];
  const artist = first ? store.user(first.soundUserId) : null;

  mount(host, h('div.stack.gap-4',
    viewHead({ title: first ? first.soundTitle : t('shorts.music'), scope: 'shorts' }),
    h('div.card.pad.row.gap-3',
      h('span.sh-disc', { style: { width: '64px', height: '64px' } }, icon('music')),
      h('div.stack.grow',
        h('span.b', first ? first.soundTitle : ''),
        h('span.sm.mut', first ? first.soundArtist : ''),
        h('span.xs.mut-3', list.length + ' ' + t('nav.shorts').toLowerCase()),
      ),
      artist ? h('a.btn.sm.soft', { href: '#/u/' + artist.handle }, icon('user'), t('shorts.artist')) : null,
    ),
    list.length
      ? h('div.pf-grid', list.map((v) => {
        const cell = h('a.pf-cell', { href: '#/shorts?id=' + v.id });
        const poster = posterFor(v.demo);
        cell.appendChild(poster ? h('img', { src: poster, alt: v.caption || '', loading: 'lazy' }) : h('div.sh-ph', icon('film')));
        cell.appendChild(h('div.ov', icon('play'), h('span', nfmt(v.views || 0))));
        return cell;
      }))
      : empty('music', t('empty.generic')),
  ));
  return {};
}
