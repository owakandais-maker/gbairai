/* ==========================================================================
   demoMedia.js — fabrique de médias de démonstration, hors ligne
   Les vidéos sont réellement encodées dans le navigateur (canvas +
   MediaRecorder) puis rangées en IndexedDB. Du coup la vitesse de lecture,
   le son, le volume, la boucle, le saut et le téléchargement agissent sur de
   vrais fichiers, pas sur une image fixe.
   ========================================================================== */

import { putBlob } from '../core/idb.js';
import * as store from '../core/store.js';

const RECIPES = {
  short1: { w: 540, h: 960, secs: 3, a: '#6c5cff', b: '#131a3a', title: 'POV : la zone', sub: '@kaito' },
  short2: { w: 540, h: 960, secs: 3, a: '#ff7a3d', b: '#2a1206', title: 'Attiéké braisé', sub: '@awa.cuisine' },
  short3: { w: 540, h: 960, secs: 3, a: '#ff3b5c', b: '#2a0710', title: 'Régie ZA PROD', sub: '@zaprod' },
  short4: { w: 540, h: 960, secs: 3, a: '#f7c948', b: '#2a2206', title: 'Zone Royale', sub: '@fatou.style' },
  wide1: { w: 960, h: 540, secs: 3, a: '#2f7fe0', b: '#06142e', title: 'GBAIRAI ZONE', sub: 'La zone où tout se passe' },
};

export const RECIPE_IDS = Object.keys(RECIPES);

function supported() {
  return !!(typeof MediaRecorder !== 'undefined'
    && typeof HTMLCanvasElement !== 'undefined'
    && HTMLCanvasElement.prototype.captureStream);
}

function pickMime() {
  if (typeof MediaRecorder === 'undefined') return null;
  const list = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm', 'video/mp4'];
  for (const m of list) {
    try { if (MediaRecorder.isTypeSupported(m)) return m; } catch (e) { /* ignore */ }
  }
  return null;
}

/** Dessine une image animée : dégradé mouvant, titre, minuterie, barres. */
function paint(cx, r, tnorm) {
  const { w, h } = r;
  const g = cx.createLinearGradient(0, 0, w, h);
  const shift = (Math.sin(tnorm * Math.PI * 2) + 1) / 2;
  g.addColorStop(0, r.a);
  g.addColorStop(Math.min(0.95, 0.35 + shift * 0.4), r.b);
  g.addColorStop(1, '#04060d');
  cx.fillStyle = g;
  cx.fillRect(0, 0, w, h);

  // cercles en mouvement
  cx.save();
  cx.globalAlpha = 0.16;
  cx.fillStyle = '#ffffff';
  for (let i = 0; i < 5; i++) {
    const p = (tnorm + i / 5) % 1;
    const rad = (0.12 + 0.1 * i) * w;
    const x = w * (0.2 + 0.6 * ((Math.sin((p + i) * Math.PI * 2) + 1) / 2));
    const y = h * p;
    cx.beginPath();
    cx.arc(x, y, rad, 0, Math.PI * 2);
    cx.fill();
  }
  cx.restore();

  // bande de progression
  cx.fillStyle = 'rgba(255,255,255,.22)';
  cx.fillRect(0, h - 10, w, 4);
  cx.fillStyle = '#ffffff';
  cx.fillRect(0, h - 10, w * tnorm, 4);

  // titre
  cx.fillStyle = '#ffffff';
  cx.textAlign = 'center';
  cx.font = '700 ' + Math.round(w * 0.085) + 'px Sora, Arial, sans-serif';
  cx.fillText(r.title, w / 2, h * 0.47);
  cx.globalAlpha = 0.8;
  cx.font = '600 ' + Math.round(w * 0.05) + 'px Sora, Arial, sans-serif';
  cx.fillText(r.sub, w / 2, h * 0.47 + w * 0.09);
  cx.globalAlpha = 1;

  // minuterie, pour voir que la lecture avance vraiment
  cx.font = '700 ' + Math.round(w * 0.055) + 'px Sora, Arial, sans-serif';
  cx.textAlign = 'left';
  cx.fillText((tnorm * r.secs).toFixed(1) + 's', w * 0.06, h * 0.1);

  // barres façon spectre audio
  const bars = 18;
  const bw = (w * 0.5) / bars;
  for (let i = 0; i < bars; i++) {
    const amp = Math.abs(Math.sin(tnorm * Math.PI * 6 + i * 0.6));
    const bh = h * 0.02 + amp * h * 0.08;
    cx.fillStyle = 'rgba(255,255,255,' + (0.35 + amp * 0.5) + ')';
    cx.fillRect(w * 0.25 + i * bw, h * 0.84 - bh, bw * 0.6, bh);
  }
}

/** Encode une recette en WebM. Renvoie un Blob ou null. */
function record(id) {
  return new Promise((resolve) => {
    const r = RECIPES[id];
    if (!r || !supported()) { resolve(null); return; }
    const mime = pickMime();
    if (!mime) { resolve(null); return; }

    const cv = document.createElement('canvas');
    cv.width = r.w; cv.height = r.h;
    const cx = cv.getContext('2d');
    if (!cx) { resolve(null); return; }

    let stream;
    try { stream = cv.captureStream(25); } catch (e) { resolve(null); return; }

    // piste audio synthétique : le réglage du volume et la coupure du son
    // agissent alors sur un vrai flux.
    let audioCtx = null;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) {
        audioCtx = new AC();
        const dest = audioCtx.createMediaStreamDestination();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        const lfo = audioCtx.createOscillator();
        const lfoGain = audioCtx.createGain();
        osc.type = 'triangle';
        osc.frequency.value = 196;
        lfo.frequency.value = 0.8;
        lfoGain.gain.value = 40;
        lfo.connect(lfoGain).connect(osc.frequency);
        gain.gain.value = 0.05;
        osc.connect(gain).connect(dest);
        osc.start(); lfo.start();
        for (const tr of dest.stream.getAudioTracks()) stream.addTrack(tr);
      }
    } catch (e) { audioCtx = null; }

    let rec;
    try { rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 500_000 }); }
    catch (e) {
      try { rec = new MediaRecorder(stream); } catch (e2) { resolve(null); return; }
    }

    const chunks = [];
    rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      try { for (const tr of stream.getTracks()) tr.stop(); } catch (e) { /* ignore */ }
      if (audioCtx) { try { audioCtx.close(); } catch (e) { /* ignore */ } }
      resolve(chunks.length ? new Blob(chunks, { type: mime.split(';')[0] }) : null);
    };
    rec.onstop = finish;
    rec.onerror = finish;

    const t0 = performance.now();
    const total = r.secs * 1000;
    let raf = 0;
    const tick = () => {
      const el = performance.now() - t0;
      paint(cx, r, Math.min(1, el / total));
      if (el < total) raf = requestAnimationFrame(tick);
      else {
        cancelAnimationFrame(raf);
        try { rec.stop(); } catch (e) { finish(); }
      }
    };

    try { rec.start(); } catch (e) { finish(); return; }
    tick();
    // filet de sécurité : on ne bloque jamais plus que nécessaire
    setTimeout(() => { if (!finished) { try { rec.stop(); } catch (e) { finish(); } } }, total + 2500);
  });
}

/** Affiche de repli pour une vidéo : image fixe générée (jamais de carré vide). */
export function posterFor(id) {
  const r = RECIPES[id] || RECIPES.wide1;
  const cv = document.createElement('canvas');
  cv.width = r.w; cv.height = r.h;
  const cx = cv.getContext('2d');
  if (cx) paint(cx, r, 0.25);
  try { return cv.toDataURL('image/webp', 0.8); } catch (e) { return null; }
}

let building = null;

/**
 * Prépare les médias de démonstration au premier lancement et renseigne
 * data.demoMedia = { short1: 'idb:…', … }. Idempotent et non bloquant.
 */
export function ensureDemoMedia(opts = {}) {
  if (building) return building;
  const existing = store.data().demoMedia || {};
  const missing = RECIPE_IDS.filter((id) => !existing[id]);
  if (!missing.length) return Promise.resolve(existing);

  building = (async () => {
    const made = {};
    // Encodage en parallèle : chaque recette a son canvas, donc quelques
    // secondes au total plutôt que la somme des durées.
    await Promise.all(missing.map(async (id) => {
      let blob = null;
      try { blob = await record(id); } catch (e) { blob = null; }
      if (blob && blob.size > 1024) {
        try { made[id] = await putBlob(blob, { name: 'demo-' + id + '.webm', type: blob.type }); }
        catch (e) { made[id] = null; }
      } else {
        made[id] = null;   // repli affiche fixe
      }
      if (opts.onStep) opts.onStep(id, made[id]);
    }));
    store.commit('demoMedia', (c) => {
      c.data.demoMedia = Object.assign({}, c.data.demoMedia || {}, made);
      // on branche les références sur les shorts et les stories
      for (const v of c.data.shorts) if (v.demo && !v.ref && c.data.demoMedia[v.demo]) v.ref = c.data.demoMedia[v.demo];
      for (const s of c.data.stories) if (s.demo && !s.ref && c.data.demoMedia[s.demo]) s.ref = c.data.demoMedia[s.demo];
      c.touch('data');
    });
    building = null;
    return store.data().demoMedia;
  })();

  return building;
}

/** Référence de média de démonstration déjà disponible, sinon null. */
export function demoRef(id) {
  const m = store.data().demoMedia || {};
  return m[id] || null;
}
