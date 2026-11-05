/* ==========================================================================
   messages.js — LA ZONE DISCUSSION et les appels
   · Titre « LA ZONE DISCUSSION », grand, centré et traduit dans la langue
     choisie dans l'application.
   · Flèche de retour sur la liste comme dans une conversation.
   · Le partage de contenu de l'application se fait pendant l'appel, et
     nulle part ailleurs.
   ========================================================================== */

import { h, mount, clear, uid, isPhone, trapFocus } from '../core/dom.js';
import { icon } from '../core/icons.js';
import { t, ago, nfmt, dur } from '../core/i18n.js';
import * as store from '../core/store.js';
import * as router from '../core/router.js';
import {
  toast, avatar, empty, sheet, modal, confirm, menu, searchbox, img as safeImg,
} from '../core/ui.js';
import { pickFile, toMedia, editMedia, mediaEl, download } from '../core/media.js';
import { viewHead, scopedSearch, postCard, openLightbox } from '../features/parts.js';
import { demoRef, posterFor } from '../data/demoMedia.js';
import * as agent from '../features/agent.js';

/* ------------------------------ liste + fil ----------------------------- */

export function render(ctx, host) {
  const threadId = ctx.params.id || null;
  const d = store.data();
  const meId = store.session().meId;
  const threads = (d.threads || []).slice().sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || b.at - a.at);

  const head = viewHead({
    title: null,
    scope: 'messages',
    tools: [
      h('button.icon-btn', {
        type: 'button', 'aria-label': t('msg.new'), title: t('msg.new'),
        onclick: newThreadSheet,
      }, icon('plus')),
    ],
  });

  const zoneTitle = h('h1', {
    style: {
      'text-align': 'center', 'letter-spacing': '.14em', 'font-weight': '800',
      'text-transform': 'uppercase', 'font-size': 'clamp(1.1rem, .9rem + 1.4vw, 1.9rem)',
      background: 'linear-gradient(90deg, var(--accent), var(--live), var(--taro))',
      '-webkit-background-clip': 'text', 'background-clip': 'text',
      '-webkit-text-fill-color': 'transparent', padding: '2px 0 6px',
    },
  }, t('msg.title'));

  const listPane = h('aside.msg-list');
  const chatPane = h('div.chat');
  const searchHost = h('div', { style: { position: 'relative' } });

  const searchToggle = h('button.icon-btn.sm', { type: 'button', 'aria-label': t('a.search') }, icon('search'));
  searchToggle.addEventListener('click', () => {
    if (searchHost.firstChild) { clear(searchHost); searchToggle.classList.remove('on'); return; }
    searchToggle.classList.add('on');
    mount(searchHost, scopedSearch('messages', { onClose: () => { clear(searchHost); searchToggle.classList.remove('on'); } }));
  });

  mount(listPane,
    h('div.hd',
      h('h2', t('msg.list')),
      searchToggle,
      h('button.icon-btn.sm', { type: 'button', 'aria-label': t('msg.new'), onclick: newThreadSheet }, icon('plus')),
    ),
    searchHost,
    h('div.msg-items', threads.length
      ? threads.map((th) => threadRow(th, threadId))
      : empty('comment', t('msg.empty'))),
  );

  if (threadId) {
    const th = store.byId('threads', threadId);
    if (th) {
      mount(chatPane, chatView(th));
      if (th.unread) store.update('threads', th.id, { unread: 0 });
    } else {
      mount(chatPane, empty('comment', t('msg.empty')));
    }
  } else {
    mount(chatPane, empty('comment', t('msg.empty'),
      h('button.btn.primary', { type: 'button', onclick: newThreadSheet }, icon('plus'), t('msg.new'))));
  }

  // sur téléphone, on n'affiche qu'un panneau à la fois
  const wrap = h('div.msg-wrap');
  if (isPhone()) {
    wrap.appendChild(threadId ? chatPane : listPane);
  } else {
    wrap.appendChild(listPane);
    wrap.appendChild(chatPane);
  }

  mount(host, h('div.stack.gap-3', head, zoneTitle, wrap));
  return {};
}

function threadRow(th, activeId) {
  const meId = store.session().meId;
  const other = (th.members || []).find((m) => m !== meId);
  const u = store.user(other);
  const msgs = (store.data().messages || []).filter((m) => m.threadId === th.id).sort((a, b) => a.at - b.at);
  const last = msgs[msgs.length - 1];
  return h('a.msg-item', {
    href: '#/messages/' + th.id,
    class: th.id === activeId ? 'on' : '',
  },
    avatar(u, 44),
    h('div.b',
      h('div.nm', u ? u.name : (th.title || t('msg.list')),
        u && u.verified ? icon('verified') : null,
        h('span.t', last ? ago(last.at) : ago(th.at))),
      h('div.pv.trunc', last ? (last.userId === meId ? '· ' : '') + (last.text || '') : t('msg.write')),
    ),
    th.unread ? h('span.unread', { 'aria-label': t('notif.unread') }) : null,
  );
}

/* ------------------------------ conversation ---------------------------- */

function chatView(th) {
  const meId = store.session().meId;
  const other = (th.members || []).find((m) => m !== meId);
  const u = store.user(other);
  const body = h('div.chat-body');
  const input = h('textarea.textarea', { placeholder: t('msg.write'), rows: 1, 'aria-label': t('msg.write') });
  let attachment = null;
  const attachStrip = h('div.row.wrap.gap-2');

  function paint() {
    const msgs = (store.data().messages || []).filter((m) => m.threadId === th.id).sort((a, b) => a.at - b.at);
    clear(body);
    if (!msgs.length) body.appendChild(h('p.center.xs.mut-3', t('msg.write')));
    for (const m of msgs) body.appendChild(bubble(m, meId));
    requestAnimationFrame(() => { body.scrollTop = body.scrollHeight; });
  }

  function send() {
    const text = input.value.trim();
    if (!text && !attachment) { toast(t('toast.nothing'), 'bad'); return; }
    store.add('messages', {
      id: uid('m'), threadId: th.id, userId: meId, at: Date.now(),
      text, media: attachment || null,
    });
    store.update('threads', th.id, { at: Date.now() });
    input.value = '';
    input.style.height = 'auto';
    attachment = null;
    clear(attachStrip);
    paint();
  }

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  });
  input.addEventListener('input', () => {
    input.style.height = 'auto';
    input.style.height = Math.min(120, input.scrollHeight) + 'px';
  });

  async function attach(accept, kind) {
    const files = await pickFile({ accept });
    if (!files.length) return;
    const md = await toMedia(files[0]);
    if (!md) return;
    const edited = await editMedia(md, { title: t('media.editor'), asSheet: true });
    attachment = edited || md;
    mount(attachStrip, h('div.row.gap-2.chip',
      icon(attachment.kind === 'video' ? 'film' : 'image'),
      h('span.trunc', { style: { 'max-width': '160px' } }, attachment.name || t('profile.media')),
      h('button.icon-btn.sm', { type: 'button', 'aria-label': t('a.remove'), onclick: () => { attachment = null; clear(attachStrip); } }, icon('close')),
    ));
  }

  paint();

  return h('div.chat',
    h('div.chat-hd',
      isPhone()
        ? h('button.icon-btn', { type: 'button', 'aria-label': t('a.back'), onclick: () => router.go('#/messages') }, icon('back'))
        : null,
      h('a', { href: u ? '#/u/' + u.handle : '#/' }, avatar(u, 40)),
      h('a.who-t', { href: u ? '#/u/' + u.handle : '#/' },
        h('div.nm', u ? u.name : th.title, u && u.verified ? icon('verified') : null),
        h('div.st', t('msg.online')),
      ),
      // icône déplacée à droite, comme demandé
      h('button.icon-btn', { type: 'button', 'aria-label': t('msg.callAudio'), title: t('msg.callAudio'), onclick: () => startCall([other], 'audio') }, icon('phone')),
      h('button.icon-btn', { type: 'button', 'aria-label': t('msg.callVideo'), title: t('msg.callVideo'), onclick: () => startCall([other], 'video') }, icon('video')),
      h('button.icon-btn', {
        type: 'button', 'aria-label': t('a.more'),
        onclick: (e) => menu(e.currentTarget, [
          { icon: 'users', label: t('call.group'), fn: () => groupCallSheet(th) },
          { icon: 'pin', label: t('a.pin'), fn: () => { store.update('threads', th.id, { pinned: !th.pinned }); router.render(); } },
          { icon: 'sparkles', label: agent.agentName(), fn: () => agent.openPanel() },
          { sep: true },
          {
            icon: 'trash', label: t('a.delete'), fn: async () => {
              const ok = await confirm({ title: t('a.delete'), message: u ? u.name : '', danger: true, okLabel: t('a.delete') });
              if (!ok) return;
              for (const m of (store.data().messages || []).filter((x) => x.threadId === th.id)) store.remove('messages', m.id);
              store.remove('threads', th.id);
              toast(t('toast.deleted'), 'ok');
              router.go('#/messages');
            },
          },
        ]),
      }, icon('more')),
    ),
    body,
    h('div.stack.gap-2', { style: { padding: '0 11px' } }, attachStrip),
    h('div.chat-ft',
      h('button.icon-btn', {
        type: 'button', 'aria-label': t('msg.attach'),
        onclick: (e) => menu(e.currentTarget, [
          { icon: 'image', label: t('stories.photo'), fn: () => attach('image/*', 'image') },
          { icon: 'film', label: t('stories.videoKind'), fn: () => attach('video/*', 'video') },
        ], { align: 'start' }),
      }, icon('plus')),
      input,
      h('button.icon-btn', { type: 'button', 'aria-label': t('a.send'), onclick: send }, icon('send')),
    ),
  );
}

function bubble(m, meId) {
  const mine = m.userId === meId;
  const u = store.user(m.userId);
  const bb = h('div.bb');
  if (m.media) {
    const el = mediaEl(m.media, { controls: m.media.kind === 'video', muted: true });
    if (el) {
      el.style.maxWidth = '240px';
      el.style.cursor = 'zoom-in';
      el.addEventListener('click', () => openLightbox([m.media], 0, { title: u ? u.name : '' }));
      bb.appendChild(el);
    }
  }
  if (m.text) bb.appendChild(h('div', m.text));
  if (m.shared) {
    bb.appendChild(h('a.chip', { href: m.text && m.text.includes('#/') ? m.text.slice(m.text.indexOf('#/')) : '#/' },
      icon('link'), t('a.open')));
  }
  return h('div.bub-row', { class: mine ? 'me' : '' },
    mine ? null : avatar(u, 28),
    bb,
    h('span.tm', ago(m.at)),
  );
}

/* ----------------------------- nouvelle zone ---------------------------- */

export function newThreadSheet() {
  const meId = store.session().meId;
  const users = store.data().users.filter((u) => u.id !== meId);
  const listHost = h('div.stack.gap-1');

  function paint(q) {
    const needle = (q || '').toLowerCase();
    const list = users.filter((u) => !needle || u.name.toLowerCase().includes(needle) || u.handle.toLowerCase().includes(needle));
    mount(listHost, list.length
      ? list.map((u) => h('button.msg-item', {
        type: 'button',
        onclick: () => {
          let th = store.data().threads.find((x) => (x.members || []).includes(u.id) && (x.members || []).includes(meId));
          if (!th) {
            th = { id: uid('th'), members: [meId, u.id], at: Date.now(), unread: 0 };
            store.add('threads', th);
          }
          m.close();
          router.go('#/messages/' + th.id);
        },
      }, avatar(u, 40), h('div.b', h('div.nm', u.name, u.verified ? icon('verified') : null), h('div.pv', '@' + u.handle))))
      : empty('users', t('empty.generic')));
  }

  const box = searchbox({ placeholder: t('msg.searchHint'), onInput: paint, autofocus: true });
  paint('');

  const m = sheet({
    title: t('msg.title'),
    body: h('div.stack.gap-3',
      h('p.center.b', {
        style: {
          'letter-spacing': '.12em', 'text-transform': 'uppercase', 'font-size': '1.05rem',
          background: 'linear-gradient(90deg, var(--accent), var(--live))',
          '-webkit-background-clip': 'text', 'background-clip': 'text', '-webkit-text-fill-color': 'transparent',
        },
      }, t('msg.title')),
      box.el,
      listHost,
    ),
  });
}

/* ================================ appels =============================== */

let callState = null;

export function startCall(memberIds, kind) {
  if (callState) return;
  const ids = [].concat(memberIds).filter(Boolean);
  const members = ids.map((id) => store.user(id)).filter(Boolean);
  if (!members.length) { toast(t('toast.notAllowed'), 'bad'); return; }

  const started = Date.now();
  let localStream = null;
  let camOn = kind === 'video';
  let micOn = true;
  let sharing = null;

  const timeEl = h('span.tm', '00:00');
  const stage = h('div.call-stage', { class: members.length > 1 ? 'grid-2x' : '' });
  const shareHost = h('div');

  const meTile = h('div.call-tile.me', h('span.nm', store.me().name));
  const localVideo = h('video', { playsinline: true, muted: true, autoplay: true });

  function paintStage() {
    clear(stage);
    for (const u of members) {
      const tile = h('div.call-tile',
        kind === 'video'
          ? h('div', { style: { position: 'absolute', inset: '0', display: 'grid', 'place-items': 'center', background: 'radial-gradient(60% 60% at 50% 35%, var(--a-soft), #080b16)' } }, avatar(u, 72))
          : avatar(u, 72),
        h('span.nm', u.name),
      );
      stage.appendChild(tile);
    }
    if (kind === 'video') {
      clear(meTile);
      meTile.appendChild(localVideo);
      meTile.appendChild(h('span.nm', store.me().name));
      stage.appendChild(meTile);
    }
    stage.appendChild(shareHost);
  }
  paintStage();

  /* ----- le partage de contenu : uniquement pendant l'appel ----- */
  function openSharePicker() {
    const d = store.data();
    const m = sheet({
      title: t('call.share'),
      body: h('div.stack.gap-3',
        h('p.xs.mut-3', t('call.shareHint')),
        h('div.stack.gap-2',
          h('span.lbl', t('nav.shorts')),
          h('div.row.wrap.gap-2', d.shorts.slice(0, 6).map((v) => h('button.chip.btn-like', {
            type: 'button', onclick: () => { share({ kind: 'short', id: v.id }); m.close(); },
          }, icon('shorts'), h('span.trunc', { style: { 'max-width': '150px' } }, v.caption || v.id)))),
        ),
        h('div.stack.gap-2',
          h('span.lbl', t('search.posts')),
          h('div.row.wrap.gap-2', d.posts.slice(0, 6).map((p) => h('button.chip.btn-like', {
            type: 'button', onclick: () => { share({ kind: 'post', id: p.id }); m.close(); },
          }, icon('comment'), h('span.trunc', { style: { 'max-width': '150px' } }, (p.text || '').slice(0, 40))))),
        ),
        h('div.stack.gap-2',
          h('span.lbl', t('nav.shop')),
          h('div.row.wrap.gap-2', d.products.slice(0, 6).map((p) => h('button.chip.btn-like', {
            type: 'button', onclick: () => { share({ kind: 'product', id: p.id }); m.close(); },
          }, icon('shop'), h('span.trunc', { style: { 'max-width': '150px' } }, p.title)))),
        ),
        h('div.row.wrap.gap-2',
          h('button.btn.sm.soft', { type: 'button', onclick: () => { shareScreen(); m.close(); } }, icon('screen'), t('call.screen')),
        ),
      ),
    });
  }

  function share(target) {
    sharing = target;
    const content = h('div.bd');
    if (target.kind === 'short') {
      const v = store.byId('shorts', target.id);
      const ref = v && (v.ref || demoRef(v.demo));
      const el = ref ? mediaEl({ kind: 'video', ref, fit: v.fit }, { controls: true, autoplay: true, muted: false, loop: true }) : null;
      if (el) { el.style.maxHeight = '52dvh'; el.style.margin = 'auto'; content.appendChild(el); }
      else content.appendChild(h('img', { src: posterFor(v && v.demo), alt: '' }));
      content.appendChild(h('p.sm', { style: { color: '#fff', 'margin-top': '8px' } }, v ? v.caption : ''));
    } else if (target.kind === 'post') {
      const p = store.byId('posts', target.id);
      if (p) content.appendChild(postCard(p));
    } else if (target.kind === 'product') {
      const p = store.byId('products', target.id);
      if (p) {
        content.appendChild(h('div.stack.gap-2',
          safeImg(p.ref, { label: p.title, alt: p.title }),
          h('div.b', { style: { color: '#fff' } }, p.title),
          h('div.sm', { style: { color: 'rgba(255,255,255,.75)' } }, p.desc || ''),
        ));
      }
    }
    mount(shareHost, h('div.call-share',
      h('div.hd',
        icon('share'),
        h('span.t', t('call.sharing')),
        h('button.icon-btn.sm', { type: 'button', style: { color: '#fff' }, 'aria-label': t('call.stopShare'), onclick: stopShare }, icon('close')),
      ),
      content,
    ));
    toast(t('call.sharing'), 'ok');
  }

  async function shareScreen() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
      toast(t('live.noDevice'), 'bad');
      return;
    }
    try {
      const s = await navigator.mediaDevices.getDisplayMedia({ video: true });
      const v = h('video', { playsinline: true, autoplay: true, muted: true, style: { width: '100%', height: '100%', 'object-fit': 'contain' } });
      v.srcObject = s;
      sharing = { kind: 'screen', stream: s };
      mount(shareHost, h('div.call-share',
        h('div.hd', icon('screen'), h('span.t', t('call.screen')),
          h('button.icon-btn.sm', { type: 'button', style: { color: '#fff' }, onclick: stopShare, 'aria-label': t('call.stopShare') }, icon('close'))),
        h('div.bd', { style: { padding: '0' } }, v),
      ));
      s.getVideoTracks()[0].addEventListener('ended', stopShare);
    } catch (e) {
      toast(t('toast.notAllowed'), 'bad');
    }
  }

  function stopShare() {
    if (sharing && sharing.stream) { for (const tr of sharing.stream.getTracks()) tr.stop(); }
    sharing = null;
    clear(shareHost);
  }

  /* ----- contrôles ----- */
  const micBtn = h('button.icon-btn', { type: 'button', 'aria-label': t('a.mute') }, icon('mic'));
  micBtn.addEventListener('click', () => {
    micOn = !micOn;
    micBtn.classList.toggle('off', !micOn);
    mount(micBtn, icon(micOn ? 'mic' : 'micOff'));
    if (localStream) for (const tr of localStream.getAudioTracks()) tr.enabled = micOn;
  });

  const camBtn = h('button.icon-btn', { type: 'button', 'aria-label': t('a.video'), class: kind === 'video' ? '' : 'off' }, icon(kind === 'video' ? 'video' : 'videoOff'));
  camBtn.addEventListener('click', async () => {
    camOn = !camOn;
    camBtn.classList.toggle('off', !camOn);
    mount(camBtn, icon(camOn ? 'video' : 'videoOff'));
    if (camOn) await openMedia(true);
    else if (localStream) for (const tr of localStream.getVideoTracks()) tr.enabled = false;
  });

  const root = h('div.call', { role: 'dialog', 'aria-modal': 'true', 'aria-label': kind === 'video' ? t('call.video') : t('call.audio') },
    h('div.call-hd',
      h('button.icon-btn', { type: 'button', style: { color: '#fff' }, 'aria-label': t('a.back'), onclick: end }, icon('back')),
      h('div.stack.grow',
        h('span.nm', members.map((u) => u.name).join(', ')),
        h('span.st.xs', { style: { opacity: '.7' } }, t('call.inCall')),
      ),
      timeEl,
    ),
    stage,
    h('div.call-ft',
      h('div.call-ctrls',
        micBtn,
        camBtn,
        h('button.icon-btn', { type: 'button', 'aria-label': t('call.share'), title: t('call.share'), onclick: openSharePicker }, icon('share')),
        h('button.icon-btn', { type: 'button', 'aria-label': t('call.screen'), title: t('call.screen'), onclick: shareScreen }, icon('screen')),
        h('button.icon-btn', { type: 'button', 'aria-label': t('call.addPeople'), title: t('call.addPeople'), onclick: () => addPeople() }, icon('userPlus')),
        h('button.icon-btn', { type: 'button', 'aria-label': agent.agentName(), title: agent.agentName(), onclick: () => agent.openPanel() }, icon('sparkles')),
        h('button.icon-btn.hang', { type: 'button', 'aria-label': t('call.hangup'), onclick: end }, icon('phoneOff')),
      ),
      h('p.xs', { style: { opacity: '.6' } }, t('call.shareHint')),
    ),
  );

  document.body.appendChild(root);
  document.body.classList.add('no-scroll');
  const release = trapFocus(root);

  async function openMedia(video) {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return;
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: true, video: !!video });
      if (localStream) for (const tr of localStream.getTracks()) tr.stop();
      localStream = s;
      localVideo.srcObject = s;
      for (const tr of s.getAudioTracks()) tr.enabled = micOn;
    } catch (e) {
      toast(t('live.noDevice'), 'info');
      camOn = false;
      camBtn.classList.add('off');
      mount(camBtn, icon('videoOff'));
    }
  }
  openMedia(kind === 'video');

  function addPeople() {
    const others = store.data().users.filter((u) => u.id !== store.session().meId && !ids.includes(u.id));
    const m = sheet({
      title: t('call.addPeople'),
      body: h('div.stack.gap-1', others.map((u) => h('button.msg-item', {
        type: 'button',
        onclick: () => {
          ids.push(u.id);
          members.push(u);
          stage.classList.add('grid-2x');
          paintStage();
          m.close();
          toast(t('call.group'), 'ok');
        },
      }, avatar(u, 40), h('div.b', h('div.nm', u.name), h('div.pv', '@' + u.handle))))),
    });
  }

  const timer = setInterval(() => {
    const s = Math.floor((Date.now() - started) / 1000);
    timeEl.textContent = String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
  }, 1000);

  function end() {
    clearInterval(timer);
    stopShare();
    if (localStream) for (const tr of localStream.getTracks()) tr.stop();
    release();
    root.remove();
    document.body.classList.remove('no-scroll');
    document.removeEventListener('keydown', onKey, true);
    callState = null;
    const secs = Math.floor((Date.now() - started) / 1000);
    toast(t('call.hangup') + ' · ' + dur(secs), 'info');
  }
  const onKey = (e) => { if (e.key === 'Escape') end(); };
  document.addEventListener('keydown', onKey, true);
  callState = { end };
}

function groupCallSheet(th) {
  const others = store.data().users.filter((u) => u.id !== store.session().meId);
  const chosen = new Set((th.members || []).filter((m) => m !== store.session().meId));
  const list = h('div.stack.gap-1', others.map((u) => {
    const cb = h('input', { type: 'checkbox', checked: chosen.has(u.id) ? true : null });
    cb.addEventListener('change', () => { if (cb.checked) chosen.add(u.id); else chosen.delete(u.id); });
    return h('label.msg-item', cb, avatar(u, 40), h('div.b', h('div.nm', u.name), h('div.pv', '@' + u.handle)));
  }));
  const m = sheet({
    title: t('call.group'),
    body: list,
    foot: [
      h('button.btn.ghost', { type: 'button', onclick: () => m.close() }, t('a.cancel')),
      h('button.btn.primary', {
        type: 'button',
        onclick: () => { m.close(); startCall(Array.from(chosen), 'video'); },
      }, icon('video'), t('call.group')),
    ],
  });
}

/** Route #/call/:handle?kind=audio|video */
export function renderCall(ctx, host) {
  const u = store.user(ctx.params.handle);
  mount(host, h('div.stack.gap-4',
    viewHead({ title: u ? u.name : t('call.audio') }),
    empty('phone', t('call.connecting')),
  ));
  if (u) requestAnimationFrame(() => startCall([u.id], ctx.query.kind === 'video' ? 'video' : 'audio'));
  return {};
}
