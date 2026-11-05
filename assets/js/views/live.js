/* ==========================================================================
   live.js — direct et régie ZA PROD
   Rangements demandés : chaque famille de réglages est pliée dans son propre
   panneau, ouvert à la demande, sans doublon. Pas de fond vert, pas de bouton
   « IA » dans la régie : l'agent reste joignable par son bouton unique.
   ========================================================================== */

import { h, mount, clear, uid, clamp } from '../core/dom.js';
import { icon } from '../core/icons.js';
import { t, nfmt, ago, clockGMT, dur } from '../core/i18n.js';
import * as store from '../core/store.js';
import * as router from '../core/router.js';
import { toast, avatar, empty, sheet, confirm, switchCtl, segmented, img as safeImg } from '../core/ui.js';
import { viewHead } from '../features/parts.js';
import { demoRef, posterFor } from '../data/demoMedia.js';
import { mediaEl } from '../core/media.js';

/* ------------------------------ liste directs --------------------------- */

export function render(ctx, host) {
  const d = store.data();
  const live = (d.streams || []).filter((s) => s.live);
  const past = (d.streams || []).filter((s) => !s.live);

  const head = viewHead({
    title: t('live.title'),
    scope: 'live',
    tools: [
      h('button.icon-btn', {
        type: 'button', 'aria-label': t('live.studio'), title: t('live.studio'),
        onclick: () => router.go('#/live/studio'),
      }, icon('cut')),
    ],
  });

  const hero = h('div.hero',
    h('h1', t('live.studio')),
    h('p', t('live.title') + ' · ' + t('live.cut') + ' · ' + t('live.transitions') + ' · ' + t('live.lower3') + ' · ' + t('live.autopilot')),
    h('div.acts',
      h('button.btn.primary', { type: 'button', onclick: () => router.go('#/live/studio') }, icon('cut'), t('live.open')),
      h('button.btn.ghost', { type: 'button', onclick: () => newStreamSheet() }, icon('broadcast'), t('live.goLive')),
    ),
  );

  const grid = h('div.grid-2',
    live.map((s) => streamCard(s)),
  );

  mount(host, h('div.stack.gap-4', head, hero,
    live.length ? h('div.sec-head', h('h2', t('live.title')), h('span.chip.live', icon('live'), nfmt(live.reduce((n, s) => n + (s.viewers || 0), 0)))) : null,
    live.length ? grid : empty('live', t('empty.generic')),
    past.length ? h('div.sec-head', h('h2', t('feed.trending'))) : null,
    past.length ? h('div.grid-2', past.map((s) => streamCard(s))) : null,
  ));
  return {};
}

function streamCard(s) {
  const u = store.user(s.userId);
  const ref = demoRef('wide1');
  return h('article.card.hover', { style: { overflow: 'hidden' } },
    h('div', { style: { position: 'relative', 'aspect-ratio': '16/9', background: '#05070e' } },
      ref
        ? (() => { const v = mediaEl({ kind: 'video', ref }, { muted: true, loop: true, autoplay: s.live }); if (v) { v.style.width = '100%'; v.style.height = '100%'; v.style.objectFit = 'cover'; } return v; })()
        : h('img', { src: posterFor('wide1') || '', alt: s.title, style: { width: '100%', height: '100%', 'object-fit': 'cover' } }),
      s.live ? h('span.chip.live', { style: { position: 'absolute', top: '9px', left: '9px' } }, icon('live'), 'LIVE') : null,
      h('span.chip', { style: { position: 'absolute', top: '9px', right: '9px' } }, icon('eye'), nfmt(s.viewers || 0)),
    ),
    h('div.pad.stack.gap-2',
      h('div.row.gap-2', avatar(u, 34), h('div.stack.grow', h('span.b.trunc', s.title), h('span.xs.mut-3', (u ? '@' + u.handle : '') + ' · ' + (s.category || '')))),
      h('div.row.wrap.gap-2',
        h('button.btn.sm.primary', { type: 'button', onclick: () => watchSheet(s) }, icon('play'), s.live ? t('a.open') : t('a.preview')),
        h('button.btn.sm.ghost', { type: 'button', onclick: () => router.go('#/live/studio') }, icon('cut'), t('live.studio')),
      ),
    ),
  );
}

function watchSheet(s) {
  const u = store.user(s.userId);
  const ref = demoRef('wide1');
  const chat = h('div.stack.gap-2', { style: { 'max-height': '28dvh', overflow: 'auto' } });
  const msgs = ['Grand plateau ce soir !', 'Le bandeau est propre', 'On veut la suite', 'Salut depuis Yopougon'];
  for (const m of msgs) {
    const au = store.data().users[Math.floor(Math.random() * store.data().users.length)];
    chat.appendChild(h('div.row.gap-2', avatar(au, 28), h('span.sm', h('b', au.name.split(' ')[0] + ' '), m)));
  }
  sheet({
    title: s.title,
    size: 'wide',
    body: h('div.stack.gap-3',
      h('div', { style: { 'border-radius': 'var(--r-md)', overflow: 'hidden', background: '#000', 'aspect-ratio': '16/9' } },
        ref
          ? (() => { const v = mediaEl({ kind: 'video', ref }, { controls: true, autoplay: true, muted: false, loop: true }); if (v) { v.style.width = '100%'; v.style.height = '100%'; } return v; })()
          : h('img', { src: posterFor('wide1') || '', alt: '' })),
      h('div.row.gap-2', avatar(u, 40), h('div.stack.grow', h('span.b', u ? u.name : ''), h('span.xs.mut-3', nfmt(s.viewers || 0) + ' ' + t('live.viewers')))),
      h('div.stack.gap-2', h('span.lbl', t('live.chat')), chat),
    ),
  });
}

function newStreamSheet() {
  const title = h('input.input', { type: 'text', placeholder: t('live.title'), maxlength: 80 });
  const cat = h('input.input', { type: 'text', placeholder: 'Débat, Musique, Cuisine…', maxlength: 40 });
  const m = sheet({
    title: t('live.goLive'),
    body: h('div.stack.gap-3',
      h('div.field', h('label', t('live.title')), title),
      h('div.field', h('label', t('search.tags')), cat),
      h('p.xs.mut-3', t('live.noDevice')),
    ),
    foot: [
      h('button.btn.ghost', { type: 'button', onclick: () => m.close() }, t('a.cancel')),
      h('button.btn.primary', {
        type: 'button',
        onclick: () => {
          const id = uid('ls');
          store.add('streams', {
            id, userId: store.session().meId, title: title.value.trim() || t('live.title'),
            category: cat.value.trim() || 'Zone', viewers: 1, live: true, at: Date.now(),
          });
          toast(t('live.goLive') + ' ✓', 'ok');
          m.close();
          router.go('#/live/studio');
        },
      }, icon('broadcast'), t('live.goLive')),
    ],
  });
}

/* ================================ régie ================================ */

const TRANSITIONS = [
  { id: 'cut', label: 'CUT' },
  { id: 'fade', label: 'Fondu' },
  { id: 'ftb', label: 'Fondu au noir' },
  { id: 'slide', label: 'Glissé' },
  { id: 'wipe', label: 'Volet' },
  { id: 'zoom', label: 'Zoom' },
];

const SOURCES = [
  { id: 'cam', label: 'Caméra', icon: 'camera' },
  { id: 'screen', label: 'Écran', icon: 'screen' },
  { id: 'clip', label: 'Clip', icon: 'film' },
  { id: 'bars', label: 'Mire', icon: 'grid' },
  { id: 'slate', label: 'Carton', icon: 'image' },
];

export function renderStudio(ctx, host) {
  const state = {
    preview: 'bars', program: 'bars', transition: 'cut', transMs: 400,
    lower3: { on: false, t1: 'La zone parle', t2: 'Plateau du soir · ZA PROD' },
    ticker: { on: false, text: 'GBAIRAI ZONE · le direct de la zone · ' },
    clock: { on: true },
    watermark: { on: true, text: 'GBZN' },
    grade: { bright: 100, contrast: 100, sat: 100, warm: 0 },
    countdown: { on: false, secs: 10, left: 0 },
    autopilot: { on: false, everyMs: 8000 },
    audio: { master: 80, mic: 70, music: 35, duck: true },
    recording: false, onAir: false, startedAt: 0,
  };

  let camStream = null;
  let screenStream = null;
  let autoTimer = 0;
  let cdTimer = 0;

  const head = viewHead({
    title: t('live.studio'),
    scope: 'live',
    badge: h('span.chip', icon('clock'), clockGMT()),
  });

  /* --------------------------- moniteurs ---------------------------- */
  const pvInner = h('div', { style: { position: 'absolute', inset: '0' } });
  const pgInner = h('div', { style: { position: 'absolute', inset: '0' } });
  const pvMon = h('div.mon', pvInner, h('span.tag', 'APERÇU'));
  const pgMon = h('div.mon.pgm', pgInner, h('span.tag', 'PROGRAMME'));
  const overlays = h('div.st-ovl');
  pgMon.appendChild(overlays);

  const onAirChip = h('span.chip', icon('broadcast'), t('live.goLive'));
  const timeChip = h('span.chip', icon('clock'), '00:00');

  function sourceNode(kind) {
    if (kind === 'cam') {
      const v = h('video', { playsinline: true, autoplay: true, muted: true, style: { width: '100%', height: '100%', 'object-fit': 'cover' } });
      if (camStream) v.srcObject = camStream;
      else return h('div.ph', icon('camOff'), h('p', t('live.noDevice')));
      return v;
    }
    if (kind === 'screen') {
      if (!screenStream) return h('div.ph', icon('screen'), h('p', t('call.screen')));
      const v = h('video', { playsinline: true, autoplay: true, muted: true, style: { width: '100%', height: '100%', 'object-fit': 'contain', background: '#000' } });
      v.srcObject = screenStream;
      return v;
    }
    if (kind === 'clip') {
      const ref = demoRef('wide1');
      if (ref) {
        const v = mediaEl({ kind: 'video', ref }, { autoplay: true, muted: true, loop: true });
        if (v) { v.style.width = '100%'; v.style.height = '100%'; v.style.objectFit = 'cover'; return v; }
      }
      return h('img', { src: posterFor('wide1') || '', alt: '', style: { width: '100%', height: '100%', 'object-fit': 'cover' } });
    }
    if (kind === 'slate') {
      return h('div', { style: { position: 'absolute', inset: '0', display: 'grid', 'place-items': 'center', background: 'linear-gradient(135deg,var(--accent),#ff3b5c)', color: '#fff', 'font-weight': '800', 'font-size': '1.4rem' } }, 'GBAIRAI ZONE');
    }
    return barsCanvas();
  }

  function barsCanvas() {
    const cv = h('canvas', { width: 320, height: 180, style: { width: '100%', height: '100%', 'object-fit': 'cover' } });
    const cx = cv.getContext('2d');
    if (cx) {
      const cols = ['#c0c0c0', '#c0c000', '#00c0c0', '#00c000', '#c000c0', '#c00000', '#0000c0', '#101010'];
      const w = cv.width / cols.length;
      cols.forEach((c, i) => { cx.fillStyle = c; cx.fillRect(i * w, 0, w, cv.height * 0.75); });
      cx.fillStyle = '#000'; cx.fillRect(0, cv.height * 0.75, cv.width, cv.height * 0.25);
      cx.fillStyle = '#fff'; cx.font = '700 16px Sora, Arial'; cx.textAlign = 'center';
      cx.fillText('GBZN · MIRE', cv.width / 2, cv.height * 0.9);
    }
    return cv;
  }

  function paintMon() {
    mount(pvInner, sourceNode(state.preview));
    mount(pgInner, sourceNode(state.program));
    pgInner.style.filter = 'brightness(' + state.grade.bright + '%) contrast(' + state.grade.contrast + '%) saturate(' + state.grade.sat + '%)'
      + (state.grade.warm ? ' sepia(' + Math.abs(state.grade.warm) / 100 * 0.35 + ')' : '');
    paintOverlays();
  }

  function paintOverlays() {
    clear(overlays);
    if (state.lower3.on) {
      overlays.appendChild(h('div.lower3', h('div.t1', state.lower3.t1), state.lower3.t2 ? h('div.t2', state.lower3.t2) : null));
    }
    if (state.watermark.on) {
      overlays.appendChild(h('div', {
        style: { position: 'absolute', top: '9px', left: '9px', 'font-weight': '800', 'font-size': '.8rem', color: 'rgba(255,255,255,.85)', 'text-shadow': '0 1px 6px #000' },
      }, state.watermark.text));
    }
    if (state.clock.on) overlays.appendChild(h('div.clockw', clockGMT()));
    if (state.ticker.on) overlays.appendChild(h('div.ticker', h('span', state.ticker.text.repeat(3))));
    if (state.countdown.on && state.countdown.left > 0) {
      overlays.appendChild(h('div.cdown', String(state.countdown.left)));
    }
  }
  paintMon();

  /* ----------------------------- bus source ------------------------- */
  const pvBus = h('div.st-bus', SOURCES.map((s) => {
    const b = h('button', { type: 'button', 'aria-pressed': state.preview === s.id ? 'true' : 'false' }, s.label);
    b.addEventListener('click', async () => {
      if (s.id === 'cam' && !camStream) await openCam();
      if (s.id === 'screen' && !screenStream) await openScreen();
      state.preview = s.id;
      for (const x of pvBus.children) x.setAttribute('aria-pressed', 'false');
      b.setAttribute('aria-pressed', 'true');
      paintMon();
    });
    return b;
  }));

  const cutBtn = h('button.st-cut', { type: 'button' }, t('live.cut'));
  cutBtn.addEventListener('click', doCut);

  function doCut() {
    const from = state.program;
    state.program = state.preview;
    state.preview = from;
    for (const [i, x] of Array.from(pvBus.children).entries()) {
      x.setAttribute('aria-pressed', SOURCES[i].id === state.preview ? 'true' : 'false');
    }
    if (state.transition !== 'cut') {
      pgInner.style.transition = 'opacity ' + state.transMs + 'ms var(--ease), transform ' + state.transMs + 'ms var(--ease)';
      pgInner.style.opacity = '0';
      if (state.transition === 'slide') pgInner.style.transform = 'translateX(8%)';
      if (state.transition === 'zoom') pgInner.style.transform = 'scale(1.06)';
      setTimeout(() => {
        paintMon();
        pgInner.style.opacity = '1';
        pgInner.style.transform = 'none';
      }, state.transMs);
    } else {
      paintMon();
    }
  }

  async function openCam() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { toast(t('live.noDevice'), 'info'); return; }
    try { camStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true }); }
    catch (e) { camStream = null; toast(t('live.noDevice'), 'info'); }
  }
  async function openScreen() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) { toast(t('live.noDevice'), 'info'); return; }
    try {
      screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      screenStream.getVideoTracks()[0].addEventListener('ended', () => { screenStream = null; if (state.program === 'screen') { state.program = 'bars'; } paintMon(); });
    } catch (e) { screenStream = null; toast(t('toast.notAllowed'), 'info'); }
  }

  /* ------------------------- panneaux à la demande ------------------- */

  const pane = (iconName, title, ...body) => h('details.st-pane',
    h('summary', icon(iconName), title),
    h('div.bd', body),
  );

  const sidePanes = h('div.stu-side',
    pane('broadcast', t('live.goLive'),
      h('div.row.wrap.gap-2', onAirChip, timeChip),
      h('div.row.wrap.gap-2',
        h('button.btn.sm.primary', {
          type: 'button',
          onclick: (e) => {
            state.onAir = !state.onAir;
            state.startedAt = state.onAir ? Date.now() : 0;
            e.currentTarget.textContent = state.onAir ? t('live.stopLive') : t('live.goLive');
            onAirChip.className = 'chip' + (state.onAir ? ' live' : '');
            toast(state.onAir ? t('live.goLive') : t('live.stopLive'), 'ok');
          },
        }, t('live.goLive')),
        h('button.btn.sm.ghost', {
          type: 'button',
          onclick: (e) => {
            state.recording = !state.recording;
            e.currentTarget.classList.toggle('danger', state.recording);
            toast(state.recording ? t('live.record') : t('a.ok'), 'info');
          },
        }, icon('live'), t('live.record')),
      ),
    ),
    pane('layers', t('live.transitions'),
      h('div.pr-opts', TRANSITIONS.map((tr) => {
        const b = h('button', { type: 'button', 'aria-pressed': state.transition === tr.id ? 'true' : 'false' }, tr.label);
        b.addEventListener('click', () => {
          state.transition = tr.id;
          for (const x of b.parentNode.children) x.setAttribute('aria-pressed', 'false');
          b.setAttribute('aria-pressed', 'true');
        });
        return b;
      })),
      slider(t('speed'), 100, 2000, 50, state.transMs, (v) => { state.transMs = v; }, (v) => v + ' ms'),
    ),
    pane('edit', t('live.lower3'),
      h('div.row.between', h('span.sm', t('live.lower3')), switchCtl(state.lower3.on, (v) => { state.lower3.on = v; paintOverlays(); }, t('live.lower3'))),
      field(t('profile.name'), state.lower3.t1, (v) => { state.lower3.t1 = v; paintOverlays(); }),
      field(t('profile.bio'), state.lower3.t2, (v) => { state.lower3.t2 = v; paintOverlays(); }),
      h('div.row.between', h('span.sm', 'Texte défilant'), switchCtl(state.ticker.on, (v) => { state.ticker.on = v; paintOverlays(); }, 'Texte défilant')),
      field('Bandeau défilant', state.ticker.text, (v) => { state.ticker.text = v; paintOverlays(); }),
    ),
    pane('image', t('live.watermark'),
      h('div.row.between', h('span.sm', t('live.watermark')), switchCtl(state.watermark.on, (v) => { state.watermark.on = v; paintOverlays(); }, t('live.watermark'))),
      field('Filigrane', state.watermark.text, (v) => { state.watermark.text = v; paintOverlays(); }),
      h('div.row.between', h('span.sm', t('clock')), switchCtl(state.clock.on, (v) => { state.clock.on = v; paintOverlays(); }, 'Horloge')),
    ),
    pane('sliders', t('live.grade'),
      slider('Luminosité', 50, 150, 1, state.grade.bright, (v) => { state.grade.bright = v; paintMon(); }, (v) => v + '%'),
      slider('Contraste', 50, 150, 1, state.grade.contrast, (v) => { state.grade.contrast = v; paintMon(); }, (v) => v + '%'),
      slider('Saturation', 0, 200, 1, state.grade.sat, (v) => { state.grade.sat = v; paintMon(); }, (v) => v + '%'),
      slider('Chaleur', -100, 100, 1, state.grade.warm, (v) => { state.grade.warm = v; paintMon(); }, (v) => v + ''),
      h('button.btn.sm.ghost', {
        type: 'button',
        onclick: () => { state.grade = { bright: 100, contrast: 100, sat: 100, warm: 0 }; paintMon(); router.render(); },
      }, icon('refresh'), t('a.reset')),
    ),
    pane('clock', t('live.countdown'),
      h('div.row.between', h('span.sm', t('live.countdown')), switchCtl(state.countdown.on, (v) => { state.countdown.on = v; paintOverlays(); }, t('live.countdown'))),
      slider('Secondes', 3, 120, 1, state.countdown.secs, (v) => { state.countdown.secs = v; }, (v) => v + ' s'),
      h('button.btn.sm.soft', {
        type: 'button',
        onclick: () => {
          state.countdown.on = true;
          state.countdown.left = state.countdown.secs;
          clearInterval(cdTimer);
          paintOverlays();
          cdTimer = setInterval(() => {
            state.countdown.left -= 1;
            if (state.countdown.left <= 0) { clearInterval(cdTimer); state.countdown.left = 0; state.countdown.on = false; doCut(); }
            paintOverlays();
          }, 1000);
        },
      }, icon('play'), t('live.countdown')),
    ),
    pane('volume', t('live.audio'),
      slider('Général', 0, 100, 1, state.audio.master, (v) => { state.audio.master = v; applyAudio(); }, (v) => v + '%'),
      slider('Micro', 0, 100, 1, state.audio.mic, (v) => { state.audio.mic = v; applyAudio(); }, (v) => v + '%'),
      slider('Musique', 0, 100, 1, state.audio.music, (v) => { state.audio.music = v; applyAudio(); }, (v) => v + '%'),
      h('div.row.between', h('span.sm', 'Atténuation auto'), switchCtl(state.audio.duck, (v) => { state.audio.duck = v; }, 'Atténuation')),
    ),
    pane('zap', t('live.autopilot'),
      h('div.row.between', h('span.sm', t('live.autopilot')), switchCtl(state.autopilot.on, (v) => {
        state.autopilot.on = v;
        clearInterval(autoTimer);
        if (v) autoTimer = setInterval(() => { if (!pgMon.isConnected) { clearInterval(autoTimer); return; } doCut(); }, state.autopilot.everyMs);
      }, t('live.autopilot'))),
      slider('Intervalle', 3000, 30000, 500, state.autopilot.everyMs, (v) => {
        state.autopilot.everyMs = v;
        if (state.autopilot.on) { clearInterval(autoTimer); autoTimer = setInterval(doCut, v); }
      }, (v) => (v / 1000) + ' s'),
      h('p.xs.mut-3', t('live.autopilot') + ' : ' + t('live.cut') + ' automatique entre aperçu et programme.'),
    ),
  );

  function applyAudio() {
    const g = (state.audio.master / 100) * (state.audio.mic / 100);
    if (camStream) for (const tr of camStream.getAudioTracks()) tr.enabled = g > 0.02;
  }

  const monTimer = setInterval(() => {
    if (!pgMon.isConnected) { clearInterval(monTimer); clearInterval(autoTimer); clearInterval(cdTimer); return; }
    if (state.clock.on) paintOverlays();
    if (state.onAir) {
      const s = Math.floor((Date.now() - state.startedAt) / 1000);
      timeChip.textContent = dur(s);
    }
  }, 1000);

  mount(host, h('div.stack.gap-4', head,
    h('div.st-wrap',
      h('div.stack.gap-3',
        h('div.st-mon', pvMon, pgMon),
        h('div.stack.gap-2',
          h('span.lbl', t('live.sources')),
          pvBus,
          cutBtn,
        ),
      ),
      sidePanes,
    ),
  ));

  return {
    cleanup() {
      clearInterval(monTimer); clearInterval(autoTimer); clearInterval(cdTimer);
      if (camStream) for (const tr of camStream.getTracks()) tr.stop();
      if (screenStream) for (const tr of screenStream.getTracks()) tr.stop();
    },
  };
}

/* ------------------------------- utilitaires ---------------------------- */

function slider(label, min, max, step, value, onChange, fmt) {
  const out = h('span.v', fmt ? fmt(value) : String(value));
  const input = h('input', { type: 'range', min: String(min), max: String(max), step: String(step), value: String(value) });
  input.addEventListener('input', () => {
    const v = Number(input.value);
    out.textContent = fmt ? fmt(v) : String(v);
    onChange(v);
  });
  return h('div.ed-slider', h('span', label), input, out);
}

function field(label, value, onChange) {
  const input = h('input.input', { type: 'text', value: value || '' });
  input.addEventListener('input', () => onChange(input.value));
  return h('div.field', h('span.lbl', label), input);
}
