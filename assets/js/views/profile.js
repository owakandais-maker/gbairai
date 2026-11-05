/* ==========================================================================
   profile.js — profil, bannière, grille de contenus, édition
   · La bannière s'ouvre comme un média : j'aime, commentaire, partage,
     téléchargement — exactement comme la photo de profil.
   · Photo carrée par défaut, ronde au choix.
   · Mise en page téléphone soignée sous la bannière.
   · La recherche du profil ne trouve que ce que ce profil a publié.
   · Rien n'est enregistré avant la validation : ni texte, ni lien, ni image.
   ========================================================================== */

import { h, mount, clear, uid, isPhone } from '../core/dom.js';
import { icon, iconFilled } from '../core/icons.js';
import { t, nfmt, ago, dateFmt } from '../core/i18n.js';
import * as store from '../core/store.js';
import * as router from '../core/router.js';
import {
  toast, avatar, img as safeImg, empty, sheet, modal, confirm, menu, copyLink,
  switchCtl, segmented, fallbackTile,
} from '../core/ui.js';
import { pickFile, toMedia, editMedia, mediaEl, download } from '../core/media.js';
import { viewHead, postCard, openLightbox, shareSheet, storiesRail, openStories } from '../features/parts.js';
import { demoRef, posterFor } from '../data/demoMedia.js';
import * as agent from '../features/agent.js';

const TABS = () => [
  { id: 'posts', label: t('profile.posts') },
  { id: 'shorts', label: t('profile.shorts') },
  { id: 'media', label: t('profile.media') },
  { id: 'about', label: t('profile.about') },
];

export function render(ctx, host) {
  const handle = ctx.params.handle || null;
  const u = handle ? store.user(handle) : store.me();
  if (!u) {
    mount(host, h('div.stack.gap-4', viewHead({ title: t('err.title') }), empty('user', t('profile.empty'))));
    return {};
  }
  const isMine = u.id === store.session().meId;
  const tab = ctx.query.tab || 'posts';
  const follows = new Set(store.data().follows || []);
  const following = follows.has(u.id);

  const head = viewHead({
    title: null,
    scope: 'profile',
    scopeArg: u.id,
    tabsItems: TABS(),
    activeTab: tab,
    onTab: (id) => router.replaceQuery({ tab: id === 'posts' ? null : id }),
    tools: [
      h('button.icon-btn', {
        type: 'button', 'aria-label': t('a.more'),
        onclick: (e) => menu(e.currentTarget, [
          { icon: 'link', label: t('a.copy'), fn: () => copyLink('#/u/' + u.handle) },
          { icon: 'share', label: t('a.share'), fn: () => shareSheet({ kind: 'user', id: u.id, title: u.name }) },
          isMine ? { icon: 'edit', label: t('profile.edit'), fn: () => editProfile(u) } : null,
          isMine ? { icon: 'settings', label: t('nav.settings'), fn: () => router.go('#/settings') } : null,
          !isMine ? { icon: 'eyeOff', label: t('a.block'), fn: () => toast(t('a.block') + ' ✓', 'ok') } : null,
          !isMine ? { icon: 'warn', label: t('a.report'), fn: () => toast(t('a.report') + ' ✓', 'ok') } : null,
        ].filter(Boolean)),
      }, icon('more')),
    ],
  });

  /* ------------------------------ bannière ----------------------------- */
  const bannerMedia = u.banner
    ? { id: 'bn_' + u.id, kind: u.bannerKind || 'image', ref: u.banner, fit: u.bannerFit, label: u.name }
    : { id: 'bn_' + u.id, kind: 'image', ref: null, label: u.name };

  const banner = h('div.pf-banner');
  if (u.banner && (u.bannerKind || 'image') === 'video') {
    const v = mediaEl(bannerMedia, { autoplay: true, muted: true, loop: true });
    if (v) banner.appendChild(v);
  } else {
    banner.appendChild(safeImg(u.banner, { label: u.name, alt: t('profile.banner') + ' ' + u.name, eager: true, seed: u.id }));
  }
  banner.appendChild(h('div.tools',
    h('button.icon-btn.solid.sm', {
      type: 'button', 'aria-label': t('a.open'), title: t('profile.banner'),
      onclick: () => openLightbox([bannerMedia], 0, {
        title: t('profile.banner') + ' · ' + u.name,
        post: { id: 'bn_' + u.id, userId: u.id, text: t('profile.banner') + ' · ' + u.name, allowDownload: true },
        onEdit: isMine ? () => editProfile(u) : null,
      }),
    }, icon('expand')),
    isMine ? h('button.icon-btn.solid.sm', {
      type: 'button', 'aria-label': t('a.edit'), title: t('profile.banner'),
      onclick: () => editProfile(u),
    }, icon('camera')) : null,
  ));

  /* ------------------------------- identité ---------------------------- */
  const avShape = (u.avatarShape || 'square') === 'square' ? 'sq' : '';
  const avEl = (() => {
    const el = avatar(u, 118, { shape: avShape });
    el.classList.add('pf-av');
    if (avShape !== 'sq') el.classList.remove('sq');
    el.style.cursor = 'zoom-in';
    el.addEventListener('click', () => openLightbox(
      [{ id: 'av_' + u.id, kind: 'image', ref: u.avatar, label: u.name }], 0,
      {
        title: t('profile.avatar') + ' · ' + u.name,
        post: { id: 'av_' + u.id, userId: u.id, text: t('profile.avatar') + ' · ' + u.name, allowDownload: true },
        onEdit: isMine ? () => editProfile(u) : null,
      },
    ));
    return el;
  })();

  const actions = h('div.pf-acts',
    isMine
      ? h('button.btn.soft', { type: 'button', onclick: () => editProfile(u) }, icon('edit'), t('profile.edit'))
      : h('button.btn', {
        type: 'button', class: following ? 'ghost' : 'primary',
        onclick: (e) => {
          const list = new Set(store.data().follows || []);
          if (list.has(u.id)) list.delete(u.id); else list.add(u.id);
          store.commit('follow', (c) => { c.data.follows = Array.from(list); c.touch('data'); });
          router.render();
        },
      }, icon(following ? 'check' : 'userPlus'), following ? t('a.following') : t('a.follow')),
    !isMine ? h('button.btn.ghost', { type: 'button', onclick: () => openThread(u) }, icon('comment'), t('a.message')) : null,
    !isMine ? h('button.btn.ghost', { type: 'button', onclick: () => router.go('#/call/' + u.handle + '?kind=audio') }, icon('phone'), t('a.call')) : null,
    !isMine ? h('button.btn.ghost', { type: 'button', onclick: () => router.go('#/call/' + u.handle + '?kind=video') }, icon('video'), t('a.video')) : null,
    isMine ? h('button.btn.ghost', { type: 'button', onclick: () => agent.openPanel() }, icon('sparkles'), agent.agentName()) : null,
    h('button.btn.ghost', { type: 'button', onclick: () => shareSheet({ kind: 'user', id: u.id, title: u.name }) }, icon('share'), t('a.share')),
  );

  const myStories = (store.data().stories || []).filter((s) => s.userId === u.id && (s.at + (s.ttl || 24 * 3600e3)) > Date.now());

  const identity = h('div.pf-id',
    h('div.pf-id-row',
      myStories.length
        ? h('button', { type: 'button', style: { padding: '0', border: '0', background: 'none' }, onclick: () => openStories(u.id), 'aria-label': t('stories.title') }, avEl)
        : avEl,
      actions,
    ),
    h('div.pf-info.stack.gap-2',
      h('div.pf-name', u.name, u.verified ? icon('verified') : null,
        u.owner ? h('span.chip.taro', icon('shield'), u.role || 'Concepteur') : null),
      h('div.pf-handle', '@' + u.handle, u.city ? ' · ' + u.city : ''),
      u.bio ? h('p.pf-bio', u.bio) : null,
      h('div.row.wrap.gap-3.xs.mut-3',
        u.link ? h('a.row.gap-1', { href: 'https://' + String(u.link).replace(/^https?:\/\//, ''), target: '_blank', rel: 'noopener noreferrer' }, icon('link'), u.link) : null,
        h('span.row.gap-1', icon('calendar'), dateFmt(u.joined || Date.now(), { month: 'long', year: 'numeric' })),
      ),
      h('div.pf-stats',
        statBtn(nfmt(store.data().posts.filter((p) => p.userId === u.id).length), t('profile.posts'), () => router.replaceQuery({ tab: null })),
        statBtn(nfmt(u.followers || 0), t('profile.followers'), () => followersSheet(u, 'followers')),
        statBtn(nfmt(u.following || 0), t('profile.following'), () => followersSheet(u, 'following')),
        statBtn(nfmt(u.likes || 0), t('profile.likes')),
      ),
    ),
  );

  /* ------------------------------- contenus ---------------------------- */
  const body = h('div.stack.gap-3');

  function paintBody() {
    const d = store.data();
    clear(body);
    if (tab === 'posts') {
      const list = d.posts.filter((p) => p.userId === u.id).sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || b.at - a.at);
      if (!list.length) { body.appendChild(empty('comment', t('profile.empty'))); return; }
      for (const p of list) body.appendChild(postCard(p));
    } else if (tab === 'shorts') {
      const list = d.shorts.filter((v) => v.userId === u.id);
      if (!list.length) { body.appendChild(empty('shorts', t('profile.empty'))); return; }
      body.appendChild(h('div.pf-grid', list.map((v) => {
        const cell = h('a.pf-cell', { href: '#/shorts?id=' + v.id, 'aria-label': v.caption || t('nav.shorts') });
        const poster = posterFor(v.demo);
        cell.appendChild(poster ? h('img', { src: poster, alt: '', loading: 'lazy' }) : h('div.sh-ph', icon('film')));
        cell.appendChild(h('div.ov', icon('play'), h('span', nfmt(v.views || 0))));
        return cell;
      })));
    } else if (tab === 'media') {
      const all = [];
      for (const p of d.posts.filter((x) => x.userId === u.id)) {
        for (const md of p.media || []) all.push({ md, post: p });
      }
      if (!all.length) { body.appendChild(empty('image', t('profile.empty'))); return; }
      body.appendChild(h('div.pf-grid', all.map((item, k) => {
        const cell = h('button.pf-cell', { type: 'button', 'aria-label': item.md.label || t('profile.media') });
        if (item.md.kind === 'video') {
          const poster = posterFor(item.md.demo);
          cell.appendChild(poster ? h('img', { src: poster, alt: '', loading: 'lazy' }) : h('div.sh-ph', icon('film')));
          cell.appendChild(h('div.ov', icon('play')));
        } else {
          cell.appendChild(safeImg(item.md.ref, { label: item.md.label, alt: '', seed: item.md.id }));
        }
        cell.addEventListener('click', () => openLightbox(all.map((x) => x.md), k, { post: item.post, title: u.name }));
        return cell;
      })));
    } else {
      body.appendChild(h('div.card.pad.stack.gap-3',
        h('h3', t('profile.about')),
        h('div.set-grp',
          infoRow(t('profile.name'), u.name),
          infoRow('@', u.handle),
          u.bio ? infoRow(t('profile.bio'), u.bio) : null,
          u.city ? infoRow(t('profile.city'), u.city) : null,
          u.link ? infoRow(t('profile.link'), u.link) : null,
          infoRow(t('profile.verified'), u.verified ? t('a.ok') : '—'),
          infoRow(t('wallet.title'), nfmt(u.taro || 0) + ' TARO'),
          infoRow(t('profile.followers'), nfmt(u.followers || 0)),
        ),
      ));
    }
  }
  paintBody();

  mount(host, h('div.stack.gap-4', head, banner, identity,
    isMine && myStories.length ? storiesRail({ hideIfEmpty: true }) : null, body));
  return {};
}

function statBtn(n, label, fn) {
  return h('button', { type: 'button', onclick: fn || null, style: { display: 'grid' } },
    h('span.n', n), h('span.l', label));
}

function infoRow(k, v) {
  return h('div.set-row', h('div.t', h('div.n', k)), h('div.ctl', h('span.sm.mut', v)));
}

function openThread(u) {
  const meId = store.session().meId;
  let th = store.data().threads.find((x) => (x.members || []).includes(u.id) && (x.members || []).includes(meId));
  if (!th) {
    th = { id: uid('th'), members: [meId, u.id], at: Date.now(), unread: 0 };
    store.add('threads', th);
  }
  router.go('#/messages/' + th.id);
}

function followersSheet(u, kind) {
  const follows = new Set(store.data().follows || []);
  const list = kind === 'following'
    ? store.data().users.filter((x) => follows.has(x.id))
    : store.data().users.filter((x) => x.id !== u.id).slice(0, 8);
  sheet({
    title: kind === 'following' ? t('profile.following') : t('profile.followers'),
    body: list.length
      ? h('div.stack.gap-1', list.map((x) => h('a.msg-item', { href: '#/u/' + x.handle },
        avatar(x, 40),
        h('div.b', h('div.nm', x.name, x.verified ? icon('verified') : null), h('div.pv', '@' + x.handle)),
      )))
      : empty('users', t('empty.generic')),
  });
}

/* ----------------------------- édition profil --------------------------- */

export function editProfile(u) {
  // Brouillon : aucune écriture avant le clic sur Enregistrer.
  const draft = {
    name: u.name || '', bio: u.bio || '', city: u.city || '', link: u.link || '',
    avatar: u.avatar || null, avatarShape: u.avatarShape || 'square',
    banner: u.banner || null, bannerKind: u.bannerKind || 'image',
    bannerFit: u.bannerFit || null, avatarFit: u.avatarFit || null,
  };
  let dirty = false;
  const markDirty = () => { dirty = true; };

  const avPreview = h('div.row.gap-3');
  const bnPreview = h('div', { style: { 'border-radius': 'var(--r-md)', overflow: 'hidden', height: '120px', background: 'var(--surface-2)' } });

  function paintAvatar() {
    const fake = Object.assign({}, u, { avatar: draft.avatar, avatarShape: draft.avatarShape, name: draft.name });
    const el = avatar(fake, 72, { shape: draft.avatarShape === 'square' ? 'sq' : '' });
    if (draft.avatarShape !== 'square') el.classList.remove('sq');
    mount(avPreview, el, h('div.stack.gap-2',
      h('div.row.wrap.gap-2',
        h('button.btn.sm.soft', { type: 'button', onclick: () => pickAvatar() }, icon('image'), t('profile.avatar')),
        draft.avatar ? h('button.btn.sm.ghost', { type: 'button', onclick: () => { draft.avatar = null; markDirty(); paintAvatar(); } }, icon('trash'), t('a.remove')) : null,
      ),
      segmented([
        { id: 'square', label: t('profile.square') },
        { id: 'round', label: t('profile.round') },
      ], draft.avatarShape, (id) => { draft.avatarShape = id; markDirty(); paintAvatar(); }),
    ));
  }

  function paintBanner() {
    clear(bnPreview);
    if (draft.banner && draft.bannerKind === 'video') {
      const v = mediaEl({ kind: 'video', ref: draft.banner, fit: draft.bannerFit }, { autoplay: true, muted: true, loop: true });
      if (v) { v.style.width = '100%'; v.style.height = '100%'; v.style.objectFit = 'cover'; bnPreview.appendChild(v); }
    } else {
      const im = safeImg(draft.banner, { label: draft.name || u.name, alt: '', seed: u.id });
      im.style.width = '100%'; im.style.height = '100%'; im.style.objectFit = 'cover';
      bnPreview.appendChild(im);
    }
  }

  async function pickAvatar() {
    const files = await pickFile({ accept: 'image/*' });
    if (!files.length) return;
    const md = await toMedia(files[0]);
    if (!md) return;
    const edited = await editMedia(md, { ratio: '1:1', title: t('profile.avatar'), asSheet: true });
    if (!edited) return;
    draft.avatar = edited.ref;
    draft.avatarFit = edited.fit;
    markDirty();
    paintAvatar();
  }

  async function pickBanner(accept, kind) {
    const files = await pickFile({ accept });
    if (!files.length) return;
    const md = await toMedia(files[0]);
    if (!md) return;
    if (kind === 'video' && (md.duration || 0) > 60) toast(t('profile.bannerHint'), 'info');
    const edited = await editMedia(md, { ratio: '21:9', title: t('profile.banner'), asSheet: true });
    const final = edited || md;
    draft.banner = final.ref;
    draft.bannerKind = kind;
    draft.bannerFit = final.fit;
    markDirty();
    paintBanner();
  }

  paintAvatar();
  paintBanner();

  const nameIn = h('input.input', { type: 'text', value: draft.name, maxlength: 40 });
  const bioIn = h('textarea.textarea', { maxlength: 220 });
  bioIn.value = draft.bio;
  const cityIn = h('input.input', { type: 'text', value: draft.city, maxlength: 40 });
  const linkIn = h('input.input', { type: 'text', value: draft.link, maxlength: 80, placeholder: 'exemple.ci' });
  for (const [el, key] of [[nameIn, 'name'], [bioIn, 'bio'], [cityIn, 'city'], [linkIn, 'link']]) {
    el.addEventListener('input', () => { draft[key] = el.value; markDirty(); if (key === 'name') paintAvatar(); });
  }

  const m = modal({
    title: t('profile.edit'),
    size: 'wide',
    body: h('div.stack.gap-4',
      h('div.field', h('span.lbl', t('profile.banner') + ' · ' + t('profile.bannerHint')),
        bnPreview,
        h('div.row.wrap.gap-2', { style: { 'margin-top': '8px' } },
          h('button.btn.sm.soft', { type: 'button', onclick: () => pickBanner('image/*', 'image') }, icon('image'), t('stories.photo')),
          h('button.btn.sm.soft', { type: 'button', onclick: () => pickBanner('video/*', 'video') }, icon('film'), t('stories.videoKind')),
          draft.banner ? h('button.btn.sm.ghost', { type: 'button', onclick: () => { draft.banner = null; markDirty(); paintBanner(); } }, icon('trash'), t('a.remove')) : null,
        ),
      ),
      h('div.field', h('span.lbl', t('profile.avatar') + ' · ' + t('profile.shape')), avPreview),
      h('div.grid-2',
        h('div.field', h('label', t('profile.name')), nameIn),
        h('div.field', h('label', t('profile.city')), cityIn),
      ),
      h('div.field', h('label', t('profile.bio')), bioIn),
      h('div.field', h('label', t('profile.link')), linkIn),
      h('p.xs.mut-3', icon('info'), ' ', t('profile.manualHint')),
    ),
    foot: [
      h('button.btn.ghost', {
        type: 'button',
        onclick: async () => {
          if (dirty) {
            const ok = await confirm({ title: t('a.cancel'), message: t('profile.manualHint'), okLabel: t('a.cancel'), cancelLabel: t('a.edit'), danger: true });
            if (!ok) return;
          }
          m.close();
        },
      }, t('a.cancel')),
      h('button.btn.primary', {
        type: 'button',
        onclick: () => {
          store.update('users', u.id, {
            name: draft.name.trim() || u.name,
            bio: draft.bio.trim(),
            city: draft.city.trim(),
            link: draft.link.trim(),
            avatar: draft.avatar,
            avatarFit: draft.avatarFit,
            avatarShape: draft.avatarShape,
            banner: draft.banner,
            bannerKind: draft.bannerKind,
            bannerFit: draft.bannerFit,
          });
          toast(t('toast.saved'), 'ok');
          m.close();
          router.render();
        },
      }, icon('check'), t('a.save')),
    ],
  });
}
