/* ==========================================================================
   home.js — accueil : panneau, stories, composeur et fil
   L'accueil est la seule vue sans flèche de retour, et la seule qui affiche
   le rail des tendances.
   ========================================================================== */

import { h, mount, clear, uid } from '../core/dom.js';
import { icon } from '../core/icons.js';
import { t, nfmt } from '../core/i18n.js';
import * as store from '../core/store.js';
import * as router from '../core/router.js';
import { toast, avatar, empty, tabs as tabsCtl, modal, switchCtl } from '../core/ui.js';
import { pickFile, toMedia, editMedia, mediaEl } from '../core/media.js';
import { viewHead, billboard, storiesRail, postCard, homeRail } from '../features/parts.js';
import * as agent from '../features/agent.js';

const TABS = () => [
  { id: 'foryou', label: t('feed.foryou') },
  { id: 'following', label: t('feed.following') },
  { id: 'trending', label: t('feed.trending') },
];

export function render(ctx, host) {
  const tab = ctx.query.tab || 'foryou';

  const head = viewHead({
    title: t('nav.home'),
    scope: 'home',
    tabsItems: TABS(),
    activeTab: tab,
    onTab: (id) => router.replaceQuery({ tab: id === 'foryou' ? null : id }),
    back: false,
  });

  const feedHost = h('div.stack.gap-3');
  const wrap = h('div.stack.gap-4',
    head,
    billboard(),
    storiesRail(),
    composer(() => paintFeed()),
    feedHost,
  );

  function paintFeed() {
    const d = store.data();
    const follows = new Set(d.follows || []);
    let list = d.posts.slice();
    if (tab === 'following') list = list.filter((p) => follows.has(p.userId) || p.userId === store.session().meId);
    if (tab === 'trending') list.sort((a, b) => (b.likes + b.shares * 3) - (a.likes + a.shares * 3));
    else list.sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || b.at - a.at);

    clear(feedHost);
    if (!list.length) {
      feedHost.appendChild(empty('comment', t('feed.empty'),
        h('button.btn.primary', { type: 'button', onclick: () => composerModal(() => paintFeed()) }, icon('plus'), t('feed.publish'))));
      return;
    }
    for (const p of list) feedHost.appendChild(postCard(p));
    feedHost.appendChild(h('p.center.xs.mut-3', { style: { padding: '18px 0' } }, nfmt(list.length) + ' · ' + t('search.posts')));
  }
  paintFeed();

  mount(host, wrap);
  return { rail: store.settings().showTrends ? homeRail() : null };
}

/* ------------------------------- composeur ------------------------------ */

export function composer(onDone) {
  const draft = { text: '', media: [], allowDownload: true };
  const ta = h('textarea', { placeholder: t('feed.composer'), 'aria-label': t('feed.composer'), maxlength: 2000 });
  const count = h('span.cm-count', '0 / 2000');
  const mediaStrip = h('div.row.wrap.gap-2');
  const dlSwitch = switchCtl(true, (v) => { draft.allowDownload = v; }, t('set.allowDl'));

  ta.addEventListener('input', () => {
    draft.text = ta.value;
    count.textContent = ta.value.length + ' / 2000';
    ta.style.height = 'auto';
    ta.style.height = Math.min(220, ta.scrollHeight) + 'px';
  });

  function paintStrip() {
    clear(mediaStrip);
    for (const md of draft.media) {
      const thumb = h('div.mtile', { style: { width: '86px', height: '86px', 'border-radius': 'var(--r-sm)', 'aspect-ratio': 'auto' } });
      const el = mediaEl(md, { muted: true, loop: true });
      if (el) thumb.appendChild(el);
      thumb.appendChild(h('div.mdl', { style: { opacity: '1' } },
        h('button.icon-btn.solid.sm', {
          type: 'button', 'aria-label': t('a.remove'),
          onclick: () => { draft.media = draft.media.filter((x) => x.id !== md.id); paintStrip(); },
        }, icon('close'))));
      thumb.addEventListener('click', async () => {
        const edited = await editMedia(md, { title: t('media.editor') });
        if (!edited) return;
        draft.media = draft.media.map((x) => (x.id === md.id ? edited : x));
        paintStrip();
      });
      mediaStrip.appendChild(thumb);
    }
  }

  async function addMedia(accept) {
    const files = await pickFile({ accept, multiple: true });
    if (!files.length) return;
    for (const f of files.slice(0, 4 - draft.media.length)) {
      const md = await toMedia(f);
      if (!md) continue;
      const edited = await editMedia(md, { title: t('media.editor') });
      draft.media.push(edited || md);
    }
    paintStrip();
  }

  const publish = h('button.btn.primary', { type: 'button' }, icon('send'), t('feed.publish'));
  publish.addEventListener('click', () => {
    const text = draft.text.trim();
    if (!text && !draft.media.length) { toast(t('toast.nothing'), 'bad'); return; }
    const tags = (text.match(/#([\p{L}\p{N}_]{2,40})/gu) || []).map((s) => s.slice(1));
    store.add('posts', {
      id: uid('p'), userId: store.session().meId, at: Date.now(),
      text, tags, media: draft.media.slice(), likes: 0, shares: 0, views: 1,
      allowDownload: draft.allowDownload,
    });
    draft.text = ''; draft.media = []; ta.value = ''; count.textContent = '0 / 2000';
    ta.style.height = 'auto';
    paintStrip();
    toast(t('toast.saved'), 'ok');
    if (onDone) onDone();
  });

  return h('div.card.pad.composer',
    h('div.composer-top', avatar(store.me(), 44), h('div.grow', ta)),
    draft.media.length ? mediaStrip : mediaStrip,
    h('div.composer-bar',
      h('button.icon-btn', { type: 'button', 'aria-label': t('stories.photo'), title: t('stories.photo'), onclick: () => addMedia('image/*') }, icon('image')),
      h('button.icon-btn', { type: 'button', 'aria-label': t('stories.videoKind'), title: t('stories.videoKind'), onclick: () => addMedia('video/*') }, icon('film')),
      h('button.icon-btn', { type: 'button', 'aria-label': t('stories.add'), title: t('stories.add'), onclick: () => import('../features/parts.js').then((m) => m.storyComposer()) }, icon('sparkles')),
      h('button.icon-btn', {
        type: 'button', 'aria-label': agent.agentName(), title: agent.agentName(),
        onclick: () => agent.submit(draft.text ? 'publie "' + draft.text.replace(/"/g, '') + '"' : 'aide'),
      }, icon('bot')),
      h('span.grow'),
      h('label.row.gap-2.xs.mut-3', { title: t('set.allowDl') },
        dlSwitch, h('span.hide-sm', t('a.download'))),
      count,
      publish,
    ),
  );
}

export function composerModal(onDone) {
  const m = modal({ title: t('feed.publish'), body: composer(() => { if (onDone) onDone(); m.close(); }) });
}
