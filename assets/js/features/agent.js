/* ==========================================================================
   agent.js — OWAK, l'agent unique de GBAIRAI ZONE
   · Un seul agent pour toute l'application, joignable depuis chaque option.
   · Panneau compact posé dans la page : jamais plein écran, jamais devant le
     contenu, et visible du seul titulaire du compte.
   · Polymorphe : photo et nom libres, voix modulable, appel audio ou vidéo.
   · Autonome : il exécute de vraies actions via le registre d'actions.
   ========================================================================== */

import { h, $, mount, clear, uid, isPhone } from '../core/dom.js';
import { icon } from '../core/icons.js';
import { t, locale } from '../core/i18n.js';
import * as store from '../core/store.js';
import * as actions from '../core/actions.js';
import * as router from '../core/router.js';
import { toast, modal, sheet, confirm, avatar, fallbackAvatar, mediaSrc, hydrate, switchCtl, row } from '../core/ui.js';
import { pickFile, toMedia, editMedia } from '../core/media.js';

/* ------------------------------ voix de l'agent ------------------------- */

export const VOICES = [
  { id: 'calme-f', label: 'Femme · calme', gender: 'female', rate: 0.96, pitch: 1.06 },
  { id: 'douce-f', label: 'Femme · douce', gender: 'female', rate: 0.9, pitch: 1.18 },
  { id: 'dynamique-f', label: 'Femme · dynamique', gender: 'female', rate: 1.14, pitch: 1.1 },
  { id: 'grave-f', label: 'Femme · grave', gender: 'female', rate: 0.94, pitch: 0.88 },
  { id: 'calme-h', label: 'Homme · calme', gender: 'male', rate: 0.95, pitch: 0.92 },
  { id: 'grave-h', label: 'Homme · grave', gender: 'male', rate: 0.88, pitch: 0.74 },
  { id: 'dynamique-h', label: 'Homme · dynamique', gender: 'male', rate: 1.16, pitch: 0.98 },
  { id: 'jeune', label: 'Jeune · vif', gender: 'female', rate: 1.2, pitch: 1.3 },
  { id: 'age', label: 'Posé · âgé', gender: 'male', rate: 0.82, pitch: 0.8 },
  { id: 'neutre', label: 'Neutre', gender: 'neutral', rate: 1, pitch: 1 },
];

const LANG_TAG = { fr: 'fr-FR', nouchi: 'fr-FR', en: 'en-US', es: 'es-ES', pt: 'pt-BR', ar: 'ar-SA', zh: 'zh-CN' };

let voicesCache = [];
function loadVoices() {
  if (!('speechSynthesis' in window)) return [];
  voicesCache = window.speechSynthesis.getVoices() || [];
  return voicesCache;
}
if ('speechSynthesis' in window) {
  loadVoices();
  window.speechSynthesis.addEventListener('voiceschanged', loadVoices);
}

function pickSystemVoice(preset) {
  const want = LANG_TAG[locale()] || 'fr-FR';
  const list = voicesCache.length ? voicesCache : loadVoices();
  if (!list.length) return null;
  const sameLang = list.filter((v) => v.lang && v.lang.toLowerCase().startsWith(want.slice(0, 2)));
  const pool = sameLang.length ? sameLang : list;
  if (preset && preset.gender !== 'neutral') {
    const hint = preset.gender === 'female'
      ? /female|femme|amelie|audrey|zira|google français|siri.*f|samantha|monica/i
      : /male|homme|thomas|david|paul|google.*m|daniel|jorge/i;
    const found = pool.find((v) => hint.test(v.name || ''));
    if (found) return found;
  }
  return pool[0];
}

export function speak(text, opts = {}) {
  if (!('speechSynthesis' in window)) return false;
  const s = store.settings();
  if (!opts.force && !s.agentVoiceReply) return false;
  try {
    const preset = VOICES.find((v) => v.id === s.agentVoice) || VOICES[0];
    const u = new SpeechSynthesisUtterance(String(text).slice(0, 420));
    u.lang = LANG_TAG[locale()] || 'fr-FR';
    u.rate = Math.max(0.5, Math.min(2, preset.rate * (Number(s.agentRate) || 1)));
    u.pitch = Math.max(0, Math.min(2, preset.pitch * (Number(s.agentPitch) || 1)));
    const sv = pickSystemVoice(preset);
    if (sv) u.voice = sv;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
    return true;
  } catch (e) { return false; }
}

export function stopSpeaking() {
  if ('speechSynthesis' in window) { try { window.speechSynthesis.cancel(); } catch (e) { /* ignore */ } }
}

/* ------------------------------- identité ------------------------------- */

export function agentName() { return store.settings().agentName || 'OWAK'; }

export function agentFace() {
  const s = store.settings();
  if (s.agentAvatar) return mediaSrc(s.agentAvatar) || null;
  return null;
}

function agentAvatarEl(size) {
  const s = store.settings();
  if (s.agentAvatar) {
    const el = h('img', { class: 'av av-' + size + ' sq', width: size, height: size, alt: agentName() });
    const src = mediaSrc(s.agentAvatar);
    el.src = src || fallbackAvatar({ name: agentName() });
    if (!src) hydrate(el, s.agentAvatar);
    return el;
  }
  return h('span.av.av-' + size + '.sq', {
    style: {
      display: 'grid', 'place-items': 'center',
      background: 'linear-gradient(135deg, var(--accent), #ff3b5c)',
    },
  }, icon('bot'));
}

/* ------------------------------- cerveau -------------------------------- */

/** Contexte courant, pour que « enregistre ça » sache de quoi on parle. */
function liveContext() {
  const c = router.ctx() || {};
  const q = c.query || {};
  return {
    hash: c.hash, path: c.path, params: c.params || {}, query: q,
    currentPostId: c.path === '/post' ? (c.params || {}).id : (q.post || null),
    currentShortId: c.path === '/shorts' ? q.id : null,
  };
}

const SMALL_TALK = [
  { kw: ['bonjour', 'salut', 'bonsoir', 'hello', 'hi', 'yo', 'coucou'], say: () => t('agent.hello', { name: agentName() }) },
  { kw: ['merci', 'thanks', 'thank you'], say: () => 'Avec plaisir. Autre chose ?' },
  { kw: ['qui es tu', 'tu es qui', 'who are you', 'ton nom'], say: () => t('agent.hello', { name: agentName() }) },
  { kw: ['que peux tu faire', 'tes capacites', 'what can you do', 'aide', 'help'],
    say: () => 'Je navigue, publie, enregistre, cherche, règle l\'application, gère la boutique, '
      + 'la messagerie et les appels. Dis-le simplement : « ouvre la boutique », '
      + '« publie "bonjour la zone" », « passe en mode clair », « cherche sauce graine ».' },
];

function smallTalk(phrase) {
  const q = phrase.toLowerCase();
  for (const s of SMALL_TALK) if (s.kw.some((k) => q.includes(k))) return s.say();
  return null;
}

/**
 * ask(phrase) → { say, done, hash }
 * Repère l'intention, exécute l'action réelle, rend compte.
 */
export async function ask(phrase) {
  const text = String(phrase || '').trim();
  if (!text) return { say: t('agent.cantDo'), done: false };

  const hits = actions.matchIntent(text);
  const top = hits[0];

  if (!top) {
    const chat = smallTalk(text);
    if (chat) return { say: chat, done: false };
    const v = actions.viewFor(text);
    if (v) {
      const r = await actions.run('navigate', { view: v }, Object.assign({ phrase: text }, liveContext()));
      return { say: r.say, done: r.ok, hash: r.hash };
    }
    return { say: t('agent.cantDo'), done: false };
  }

  const def = top.def;
  const ctx = Object.assign({ phrase: text }, liveContext());

  if (def.danger && store.settings().agentAutonomy === 'confirm') {
    const ok = await confirm({
      title: def.label || t('a.confirm'),
      message: t('agent.autoConfirm') + ' — ' + text,
      okLabel: t('a.confirm'),
      danger: true,
    });
    if (!ok) return { say: t('a.cancel'), done: false };
  }

  const res = await actions.run(def.id, {}, ctx);
  if (!res.ok && hits[1]) {
    const alt = await actions.run(hits[1].def.id, {}, ctx);
    if (alt.ok) return { say: alt.say, done: true, hash: alt.hash };
  }
  return { say: res.say || (res.ok ? t('agent.done') : t('agent.cantDo')), done: !!res.ok, hash: res.hash };
}

/* ------------------------------- panneau -------------------------------- */

let panelOpen = false;
let fabEl = null;
let panelEl = null;

function logAppend(entry) {
  store.commit('agentLog', (c) => {
    if (!c.data.agentLog) c.data.agentLog = [];
    c.data.agentLog.push(entry);
    if (c.data.agentLog.length > 60) c.data.agentLog.splice(0, c.data.agentLog.length - 60);
    c.touch('data');
  });
}

const SUGGESTIONS = () => [
  { label: t('nav.shorts'), phrase: 'ouvre les shorts' },
  { label: t('nav.shop'), phrase: 'ouvre la boutique' },
  { label: t('set.theme'), phrase: 'change le theme' },
  { label: t('owner.stats'), phrase: 'etat de la zone' },
  { label: t('nav.saved'), phrase: 'ouvre mes enregistrements' },
  { label: t('live.studio'), phrase: 'ouvre le studio' },
];

export function openPanel(seedPhrase) {
  const root = $('#agent-root');
  if (!root) return;
  if (panelOpen) { if (seedPhrase) submit(seedPhrase); return; }
  panelOpen = true;
  root.classList.add('on');

  const body = h('div.ag-body');
  const input = h('textarea.textarea', {
    rows: 1, placeholder: t('agent.placeholder'), 'aria-label': t('agent.placeholder'),
  });

  const chips = h('div.ag-chips', SUGGESTIONS().map((s) => h('button.chip.btn-like', {
    type: 'button', onclick: () => submit(s.phrase),
  }, s.label)));

  const panel = h('div.ag-panel', { role: 'dialog', 'aria-label': agentName() },
    h('div.ag-hd',
      agentAvatarEl(34),
      h('div.who-t',
        h('div.nm', agentName(), h('span.chip.ok', { style: { padding: '1px 7px', 'font-size': '.6rem' } }, t('agent.private'))),
        h('div.st', t('agent.sub')),
      ),
      h('button.icon-btn.sm', { type: 'button', 'aria-label': t('agent.call'), title: t('agent.call'), onclick: () => startCall('audio') }, icon('phone')),
      h('button.icon-btn.sm', { type: 'button', 'aria-label': t('agent.videoCall'), title: t('agent.videoCall'), onclick: () => startCall('video') }, icon('video')),
      h('button.icon-btn.sm', { type: 'button', 'aria-label': t('agent.identity'), title: t('agent.identity'), onclick: identitySheet }, icon('sliders')),
      h('button.icon-btn.sm', { type: 'button', 'aria-label': t('a.close'), onclick: closePanel }, icon('close')),
    ),
    body,
    h('div.ag-ft',
      input,
      h('button.icon-btn', { type: 'button', 'aria-label': t('a.send'), onclick: () => submit(input.value) }, icon('send')),
    ),
  );
  panel.insertBefore(chips, panel.lastChild);
  mount(root, panel);
  panelEl = panel;

  const log = store.data().agentLog || [];
  if (!log.length) {
    push('a', t('agent.hello', { name: agentName() }));
  } else {
    for (const e of log.slice(-12)) push(e.who, e.text, e.done, true);
  }

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(input.value); }
  });
  input.addEventListener('input', () => {
    input.style.height = 'auto';
    input.style.height = Math.min(96, input.scrollHeight) + 'px';
  });
  requestAnimationFrame(() => input.focus());

  function push(who, text, done, quiet) {
    const msg = h('div.ag-msg', { class: who },
      h('div', text),
      done ? h('div.act-done', icon('check'), t('agent.done')) : null,
    );
    body.appendChild(msg);
    body.scrollTop = body.scrollHeight;
    if (!quiet) logAppend({ who, text, done: !!done, at: Date.now() });
    return msg;
  }

  async function submit(phrase) {
    const text = String(phrase || '').trim();
    if (!text) return;
    input.value = '';
    input.style.height = 'auto';
    push('u', text);
    const thinking = h('div.ag-msg.a', h('div.ag-think', h('i'), h('i'), h('i')));
    body.appendChild(thinking);
    body.scrollTop = body.scrollHeight;
    if (fabEl) fabEl.classList.add('busy');
    const res = await ask(text);
    thinking.remove();
    if (fabEl) fabEl.classList.remove('busy');
    push('a', res.say, res.done);
    speak(res.say);
  }

  if (seedPhrase) submit(seedPhrase);
  panel._submit = submit;
}

export function closePanel() {
  panelOpen = false;
  const root = $('#agent-root');
  if (root) { clear(root); root.classList.remove('on'); }
  panelEl = null;
  stopSpeaking();
}

export function togglePanel() { if (panelOpen) closePanel(); else openPanel(); }

export function submit(phrase) {
  if (!panelOpen) openPanel(phrase);
  else if (panelEl && panelEl._submit) panelEl._submit(phrase);
}

/* ---------------------------- bouton flottant --------------------------- */

export function mountFab() {
  const existing = $('.ag-fab');
  if (existing) existing.remove();
  const btn = h('button.ag-fab', {
    type: 'button', 'aria-label': agentName() + ' — ' + t('agent.sub'), title: agentName(),
    onclick: togglePanel,
  }, agentAvatarEl(54), h('span.dot'));
  document.body.appendChild(btn);
  fabEl = btn;
  return btn;
}

export function refreshFab() { if (fabEl) mountFab(); }

/* -------------------------- apparence et voix --------------------------- */

export function identitySheet() {
  const s = store.settings();
  const draft = {
    agentName: s.agentName || 'OWAK',
    agentAvatar: s.agentAvatar || null,
    agentVoice: s.agentVoice || 'calme-f',
    agentRate: Number(s.agentRate) || 1,
    agentPitch: Number(s.agentPitch) || 1,
    agentAutonomy: s.agentAutonomy || 'confirm',
    agentVoiceReply: !!s.agentVoiceReply,
  };

  const preview = h('div.row.gap-3');
  const renderPreview = () => {
    const el = draft.agentAvatar
      ? (() => {
        const i = h('img.av.av-56.sq', { alt: draft.agentName, width: 56, height: 56 });
        const src = mediaSrc(draft.agentAvatar);
        i.src = src || fallbackAvatar({ name: draft.agentName });
        if (!src) hydrate(i, draft.agentAvatar);
        return i;
      })()
      : h('span.av.av-56.sq', { style: { display: 'grid', 'place-items': 'center', background: 'linear-gradient(135deg, var(--accent), #ff3b5c)' } }, icon('bot'));
    mount(preview, el, h('div.stack',
      h('div.b', draft.agentName),
      h('div.xs.mut-3', (VOICES.find((v) => v.id === draft.agentVoice) || VOICES[0]).label),
    ));
  };
  renderPreview();

  const nameIn = h('input.input', { type: 'text', value: draft.agentName, maxlength: 24 });
  nameIn.addEventListener('input', () => { draft.agentName = nameIn.value.trim() || 'OWAK'; renderPreview(); });

  const voiceSel = h('select.select', VOICES.map((v) => h('option', { value: v.id, selected: v.id === draft.agentVoice ? true : null }, v.label)));
  voiceSel.addEventListener('change', () => { draft.agentVoice = voiceSel.value; renderPreview(); });

  const rate = h('input', { type: 'range', min: '0.6', max: '1.6', step: '0.02', value: String(draft.agentRate) });
  const rateOut = h('span.v', Math.round(draft.agentRate * 100) + '%');
  rate.addEventListener('input', () => { draft.agentRate = Number(rate.value); rateOut.textContent = Math.round(draft.agentRate * 100) + '%'; });

  const pitch = h('input', { type: 'range', min: '0.6', max: '1.6', step: '0.02', value: String(draft.agentPitch) });
  const pitchOut = h('span.v', Math.round(draft.agentPitch * 100) + '%');
  pitch.addEventListener('input', () => { draft.agentPitch = Number(pitch.value); pitchOut.textContent = Math.round(draft.agentPitch * 100) + '%'; });

  const autoSel = h('select.select',
    h('option', { value: 'confirm', selected: draft.agentAutonomy === 'confirm' ? true : null }, t('agent.autoConfirm')),
    h('option', { value: 'full', selected: draft.agentAutonomy === 'full' ? true : null }, t('agent.autoFull')),
  );
  autoSel.addEventListener('change', () => { draft.agentAutonomy = autoSel.value; });

  const m = sheet({
    title: t('agent.identity'),
    body: h('div.stack.gap-4',
      preview,
      h('div.row.wrap.gap-2',
        h('button.btn.sm.soft', {
          type: 'button',
          onclick: async () => {
            const files = await pickFile({ accept: 'image/*' });
            if (!files.length) return;
            const md = await toMedia(files[0]);
            if (!md) return;
            const edited = await editMedia(md, { ratio: '1:1', title: t('agent.yourPhoto'), asSheet: false });
            if (!edited) return;
            draft.agentAvatar = edited.ref;
            renderPreview();
          },
        }, icon('image'), t('agent.yourPhoto')),
        draft.agentAvatar || s.agentAvatar
          ? h('button.btn.sm.ghost', { type: 'button', onclick: () => { draft.agentAvatar = null; renderPreview(); } }, icon('trash'), t('a.remove'))
          : null,
      ),
      h('div.field', h('label', t('agent.yourName')), nameIn),
      h('div.field', h('label', t('agent.voice')), voiceSel),
      h('div.ed-slider', h('span', t('agent.rate')), rate, rateOut),
      h('div.ed-slider', h('span', t('agent.pitch')), pitch, pitchOut),
      h('div.row.gap-2',
        h('button.btn.sm.ghost', {
          type: 'button',
          onclick: () => {
            const prev = store.settings();
            store.setSettings({ agentVoice: draft.agentVoice, agentRate: draft.agentRate, agentPitch: draft.agentPitch });
            const ok = speak('Je suis ' + draft.agentName + ', ' + t('agent.sub') + '.', { force: true });
            store.setSettings({ agentVoice: prev.agentVoice, agentRate: prev.agentRate, agentPitch: prev.agentPitch });
            if (!ok) toast(t('search.noVoice'), 'bad');
          },
        }, icon('volume'), t('agent.test')),
      ),
      h('div.set-grp',
        row(t('agent.autonomy'), t('agent.autoConfirm') + ' / ' + t('agent.autoFull'), autoSel),
        row(t('agent.voice'), t('agent.test'), switchCtl(draft.agentVoiceReply, (v) => { draft.agentVoiceReply = v; }, t('agent.voice'))),
      ),
      h('p.xs.mut-3', t('agent.private')),
    ),
    foot: [
      h('button.btn.ghost', { type: 'button', onclick: () => m.close() }, t('a.cancel')),
      h('button.btn.primary', {
        type: 'button',
        onclick: () => {
          store.setSettings(draft);
          refreshFab();
          if (panelOpen) { closePanel(); openPanel(); }
          toast(t('toast.saved'), 'ok');
          m.close();
        },
      }, icon('check'), t('a.save')),
    ],
  });
}

/* --------------------------------- appels ------------------------------- */

let callTimer = 0;

export function startCall(kind) {
  const root = $('#agent-root');
  if (!root) return;
  panelOpen = true;
  root.classList.add('on');
  stopSpeaking();

  const started = Date.now();
  const timeEl = h('div.xs.mut-3', '00:00');
  const wave = h('div.wave', Array.from({ length: 9 }, (_, i) => h('i', { style: { 'animation-delay': (i * 0.08) + 's' } })));

  let muted = false;
  let camOn = kind === 'video';
  const stage = h('div.vid', agentAvatarEl(96), wave);

  const muteBtn = h('button.icon-btn', { type: 'button', 'aria-label': t('a.mute') }, icon('mic'));
  muteBtn.addEventListener('click', () => {
    muted = !muted;
    muteBtn.classList.toggle('off', muted);
    mount(muteBtn, icon(muted ? 'micOff' : 'mic'));
    toast(muted ? t('a.mute') : t('a.unmute'), 'info');
  });

  const camBtn = kind === 'video'
    ? h('button.icon-btn', { type: 'button', 'aria-label': t('a.video') }, icon('video'))
    : null;
  if (camBtn) {
    camBtn.addEventListener('click', () => {
      camOn = !camOn;
      camBtn.classList.toggle('off', !camOn);
      mount(camBtn, icon(camOn ? 'video' : 'videoOff'));
      stage.style.filter = camOn ? '' : 'grayscale(1) brightness(.5)';
    });
  }

  const panel = h('div.ag-call', { role: 'dialog', 'aria-label': kind === 'video' ? t('agent.videoCall') : t('agent.call') },
    stage,
    h('div.bd',
      h('div.b', agentName()),
      timeEl,
      h('div.row.gap-2',
        muteBtn,
        camBtn,
        h('button.icon-btn', { type: 'button', 'aria-label': t('agent.identity'), onclick: identitySheet }, icon('sliders')),
        h('button.icon-btn', {
          type: 'button', 'aria-label': t('call.hangup'),
          style: { background: 'var(--bad)', color: '#fff' },
          onclick: end,
        }, icon('phoneOff')),
      ),
      h('p.xs.mut-3.center', t('agent.private')),
    ),
  );
  mount(root, panel);

  speak(t('agent.hello', { name: agentName() }), { force: true });

  callTimer = setInterval(() => {
    const s = Math.floor((Date.now() - started) / 1000);
    timeEl.textContent = String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
  }, 1000);

  function end() {
    clearInterval(callTimer);
    stopSpeaking();
    closePanel();
  }
}

/* --------------------------- raccourci clavier -------------------------- */

export function bindShortcuts() {
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      togglePanel();
    }
  });
}
