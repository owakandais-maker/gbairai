/* ==========================================================================
   globe.js — globe terrestre réaliste sur canvas
   · Projection orthographique, continents et frontières indicatives.
   · Couleurs naturelles : océan bleu profond, terres vertes et ocre.
   · Le soleil suit l'heure réelle (UTC) et la saison : point subsolaire
     calculé, terminateur jour/nuit dégradé, astre qui tourne autour du globe.
   · L'heure GMT s'affiche sous le globe.
   ========================================================================== */

import { LAND, BORDERS, CITIES } from '../data/world.js';
import { clockGMT } from '../core/i18n.js';

const RAD = Math.PI / 180;
const TILT = 16;                 // inclinaison du point de vue, en degrés
const SPIN_MS = 150_000;         // une rotation complète : calme, pas une toupie

const instances = new Set();
let rafId = 0;
let lastFrame = 0;

/* ------------------------- astronomie, version utile -------------------- */

/** Déclinaison solaire approchée (±0.3°), suffisante pour l'ombre. */
function declination(date) {
  const start = Date.UTC(date.getUTCFullYear(), 0, 0);
  const day = Math.floor((date.getTime() - start) / 86_400_000);
  return -23.44 * Math.cos(RAD * (360 / 365.24) * (day + 10));
}

/** Point subsolaire : longitude depuis l'heure UTC, latitude = déclinaison. */
export function subsolar(date) {
  const d = date || new Date();
  const utcHours = d.getUTCHours() + d.getUTCMinutes() / 60 + d.getUTCSeconds() / 3600;
  return { lon: -(utcHours - 12) * 15, lat: declination(d) };
}

/* ------------------------------- projection ----------------------------- */

function project(lon, lat, lon0, lat0) {
  const dl = (lon - lon0) * RAD;
  const p = lat * RAD, p0 = lat0 * RAD;
  const cosP = Math.cos(p), sinP = Math.sin(p);
  const cosP0 = Math.cos(p0), sinP0 = Math.sin(p0);
  const cosDl = Math.cos(dl);
  const z = sinP0 * sinP + cosP0 * cosP * cosDl;
  if (z <= 0) return null;
  return { x: cosP * Math.sin(dl), y: cosP0 * sinP - sinP0 * cosP * cosDl, z };
}

/* --------------------------- couche d'ombrage --------------------------- */

const SHADE = 64;   // résolution de la carte d'ombre (suffisant, très lisse)

function buildShade(lon0, lat0, sun) {
  const cv = document.createElement('canvas');
  cv.width = SHADE; cv.height = SHADE;
  const cx = cv.getContext('2d');
  if (!cx) return null;
  const img = cx.createImageData(SHADE, SHADE);
  const px = img.data;
  const p0 = lat0 * RAD, sinP0 = Math.sin(p0), cosP0 = Math.cos(p0);
  const sLat = sun.lat * RAD, sLon = sun.lon * RAD;
  const sinSl = Math.sin(sLat), cosSl = Math.cos(sLat);

  for (let j = 0; j < SHADE; j++) {
    const y = 1 - (2 * (j + 0.5)) / SHADE;
    for (let i = 0; i < SHADE; i++) {
      const x = (2 * (i + 0.5)) / SHADE - 1;
      const o = (j * SHADE + i) * 4;
      const r2 = x * x + y * y;
      if (r2 > 1) { px[o + 3] = 0; continue; }
      const z = Math.sqrt(1 - r2);
      const sinLat = z * sinP0 + y * cosP0;
      const lat = Math.asin(Math.max(-1, Math.min(1, sinLat)));
      const lon = lon0 * RAD + Math.atan2(x, z * cosP0 - y * sinP0);
      const dot = Math.sin(lat) * sinSl + Math.cos(lat) * cosSl * Math.cos(lon - sLon);
      // crépuscule adouci entre -0.18 et +0.12
      let night = (0.12 - dot) / 0.3;
      night = night < 0 ? 0 : night > 1 ? 1 : night;
      px[o] = 4; px[o + 1] = 7; px[o + 2] = 20;
      px[o + 3] = Math.round(night * 214);
    }
  }
  cx.putImageData(img, 0, 0);
  return cv;
}

/* --------------------------------- rendu -------------------------------- */

function paint(inst, time) {
  const { cv, cx, opts } = inst;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const size = opts.size || cv.clientWidth || 44;
  if (cv.width !== Math.round(size * dpr)) {
    cv.width = Math.round(size * dpr);
    cv.height = Math.round(size * dpr);
    inst.shade = null;
  }
  const W = cv.width, H = cv.height;
  const detailed = size >= 90;
  // Le globe laisse de la place à l'orbite du soleil tout autour.
  const R = (W / 2) * (detailed ? 0.63 : 0.64);
  const CXp = W / 2, CYp = H / 2;

  const sun = subsolar(new Date());
  const lon0 = inst.manualLon != null
    ? inst.manualLon
    : (((time % SPIN_MS) / SPIN_MS) * 360 - 180 + (opts.lonOffset || 0));
  const lat0 = inst.manualLat != null ? inst.manualLat : TILT;
  inst.lon0 = lon0; inst.lat0 = lat0; inst.sun = sun;

  cx.clearRect(0, 0, W, H);

  /* ---------------------------------------------------------------------
     Position du soleil sur son orbite autour du globe.
     L'angle vient de l'heure réelle : midi solaire sur le méridien regardé
     place l'astre au plus haut, minuit au plus bas. Il passe derrière le
     globe sur la moitié basse de sa course.
     --------------------------------------------------------------------- */
  const hourAngle = ((sun.lon - lon0 + 540) % 360 - 180) * RAD;   // −π..π
  // Orbite à peine aplatie : le soleil reste toujours hors du disque, il ne
  // se superpose jamais à la planète.
  const orbitR = R * 1.26;
  const tiltY = 0.95;
  const sunX = CXp + Math.sin(hourAngle) * orbitR;
  const sunY = CYp - Math.cos(hourAngle) * orbitR * tiltY;
  const sunBehind = Math.cos(hourAngle) < 0;
  const sunR = Math.max(1.8, R * (detailed ? 0.12 : 0.14));

  function drawSun() {
    cx.save();
    cx.globalAlpha = sunBehind ? 0.55 : 1;
    const halo = sunR * (detailed ? 2.6 : 1.9);
    const g = cx.createRadialGradient(sunX, sunY, 0, sunX, sunY, halo);
    g.addColorStop(0, 'rgba(255,250,222,1)');
    g.addColorStop(0.3, 'rgba(255,208,96,.92)');
    g.addColorStop(1, 'rgba(255,160,40,0)');
    cx.fillStyle = g;
    cx.beginPath(); cx.arc(sunX, sunY, halo, 0, Math.PI * 2); cx.fill();
    cx.fillStyle = '#fff8d4';
    cx.beginPath(); cx.arc(sunX, sunY, sunR, 0, Math.PI * 2); cx.fill();
    cx.restore();
  }

  /* trace de l'orbite, pour rendre la course lisible */
  if (detailed) {
    cx.save();
    cx.strokeStyle = 'rgba(255,214,140,.16)';
    cx.lineWidth = Math.max(0.6, R / 150);
    cx.setLineDash([R / 18, R / 12]);
    cx.beginPath();
    cx.ellipse(CXp, CYp, orbitR, orbitR * tiltY, 0, 0, Math.PI * 2);
    cx.stroke();
    cx.restore();
  }

  // derrière le globe : on le dessine avant, il sera masqué par la planète
  if (sunBehind) drawSun();

  /* halo atmosphérique */
  const halo = cx.createRadialGradient(CXp, CYp, R * 0.92, CXp, CYp, R * 1.1);
  halo.addColorStop(0, 'rgba(120,180,255,.30)');
  halo.addColorStop(1, 'rgba(120,180,255,0)');
  cx.fillStyle = halo;
  cx.beginPath(); cx.arc(CXp, CYp, R * 1.1, 0, Math.PI * 2); cx.fill();

  /* océan */
  cx.save();
  cx.beginPath(); cx.arc(CXp, CYp, R, 0, Math.PI * 2); cx.clip();
  const ocean = cx.createRadialGradient(CXp - R * 0.3, CYp - R * 0.35, R * 0.1, CXp, CYp, R);
  ocean.addColorStop(0, '#3e8fdd');
  ocean.addColorStop(0.55, '#1f61b4');
  ocean.addColorStop(1, '#0a2f63');
  cx.fillStyle = ocean;
  cx.fillRect(0, 0, W, H);

  /* terres */
  const drawPoly = (poly, fill, stroke, lw) => {
    let started = false;
    cx.beginPath();
    for (const [lon, lat] of poly) {
      const p = project(lon, lat, lon0, lat0);
      if (!p) { started = false; continue; }
      const sx = CXp + p.x * R, sy = CYp - p.y * R;
      if (!started) { cx.moveTo(sx, sy); started = true; } else cx.lineTo(sx, sy);
    }
    if (fill) { cx.fillStyle = fill; cx.fill(); }
    if (stroke) { cx.strokeStyle = stroke; cx.lineWidth = lw || 1; cx.stroke(); }
  };

  for (let i = 0; i < LAND.length; i++) {
    const isIce = i === LAND.length - 1;
    drawPoly(LAND[i], isIce ? '#e8f1f8' : (i === 0 || i === 1 ? '#5a9d4e' : '#4f9350'),
      isIce ? 'rgba(255,255,255,.7)' : 'rgba(24,58,30,.55)', Math.max(0.6, R / 90));
  }
  /* nuance ocre sur les zones arides, pour un rendu naturel */
  cx.save();
  cx.globalAlpha = 0.5;
  drawPoly([[-17, 14], [-5, 16], [10, 15], [25, 18], [34, 22], [32, 31], [10, 37], [-6, 32], [-17, 14]], '#c8a96a');
  drawPoly([[38, 24], [52, 24], [60, 25], [70, 24], [73, 19], [60, 18], [48, 18], [38, 24]], '#c8a96a');
  drawPoly([[117, -21], [134, -20], [141, -24], [138, -32], [124, -33], [116, -28], [117, -21]], '#c49a63');
  drawPoly([[-114, 32], [-105, 32], [-103, 38], [-112, 40], [-114, 32]], '#c0a070');
  cx.restore();

  if (detailed) {
    /* graticule */
    cx.strokeStyle = 'rgba(255,255,255,.12)';
    cx.lineWidth = Math.max(0.5, R / 220);
    for (let lat = -60; lat <= 60; lat += 30) {
      cx.beginPath();
      let started = false;
      for (let lon = -180; lon <= 180; lon += 4) {
        const p = project(lon, lat, lon0, lat0);
        if (!p) { started = false; continue; }
        const sx = CXp + p.x * R, sy = CYp - p.y * R;
        if (!started) { cx.moveTo(sx, sy); started = true; } else cx.lineTo(sx, sy);
      }
      cx.stroke();
    }
    for (let lon = -180; lon < 180; lon += 30) {
      cx.beginPath();
      let started = false;
      for (let lat = -90; lat <= 90; lat += 4) {
        const p = project(lon, lat, lon0, lat0);
        if (!p) { started = false; continue; }
        const sx = CXp + p.x * R, sy = CYp - p.y * R;
        if (!started) { cx.moveTo(sx, sy); started = true; } else cx.lineTo(sx, sy);
      }
      cx.stroke();
    }
    /* frontières */
    cx.strokeStyle = 'rgba(255,255,255,.34)';
    cx.lineWidth = Math.max(0.5, R / 200);
    for (const line of BORDERS) {
      cx.beginPath();
      let started = false;
      for (const [lon, lat] of line) {
        const p = project(lon, lat, lon0, lat0);
        if (!p) { started = false; continue; }
        const sx = CXp + p.x * R, sy = CYp - p.y * R;
        if (!started) { cx.moveTo(sx, sy); started = true; } else cx.lineTo(sx, sy);
      }
      cx.stroke();
    }
  }

  /* ombre de la nuit, calée sur l'heure réelle */
  if (!inst.shade || time - inst.shadeAt > 240 || inst.shadeLon !== Math.round(lon0)) {
    inst.shade = buildShade(lon0, lat0, sun);
    inst.shadeAt = time;
    inst.shadeLon = Math.round(lon0);
  }
  if (inst.shade) {
    cx.save();
    cx.imageSmoothingEnabled = true;
    cx.drawImage(inst.shade, CXp - R, CYp - R, R * 2, R * 2);
    cx.restore();
  }

  /* lumières des villes côté nuit */
  if (detailed) {
    for (const c of CITIES) {
      const p = project(c.lon, c.lat, lon0, lat0);
      if (!p) continue;
      const dot = Math.sin(c.lat * RAD) * Math.sin(sun.lat * RAD)
        + Math.cos(c.lat * RAD) * Math.cos(sun.lat * RAD) * Math.cos((c.lon - sun.lon) * RAD);
      const sx = CXp + p.x * R, sy = CYp - p.y * R;
      const night = dot < 0.05;
      const r = c.hub ? R / 36 : R / 62;
      cx.beginPath();
      cx.arc(sx, sy, r, 0, Math.PI * 2);
      cx.fillStyle = night ? 'rgba(255,214,140,.95)' : 'rgba(255,255,255,.55)';
      cx.fill();
      if (c.hub) {
        cx.beginPath();
        cx.arc(sx, sy, r * 2.4, 0, Math.PI * 2);
        cx.strokeStyle = 'rgba(255,214,140,.5)';
        cx.lineWidth = Math.max(0.6, R / 140);
        cx.stroke();
      }
    }
  }

  /* reflet vitreux */
  const gloss = cx.createRadialGradient(CXp - R * 0.42, CYp - R * 0.48, R * 0.05, CXp - R * 0.3, CYp - R * 0.35, R * 1.05);
  gloss.addColorStop(0, 'rgba(255,255,255,.26)');
  gloss.addColorStop(0.45, 'rgba(255,255,255,.04)');
  gloss.addColorStop(1, 'rgba(0,0,0,.30)');
  cx.fillStyle = gloss;
  cx.fillRect(0, 0, W, H);
  cx.restore();

  /* liseré */
  cx.beginPath();
  cx.arc(CXp, CYp, R, 0, Math.PI * 2);
  cx.strokeStyle = 'rgba(176,214,255,.45)';
  cx.lineWidth = Math.max(0.8, R / 60);
  cx.stroke();

  // devant le globe : on le dessine après la planète
  if (!sunBehind) drawSun();

  /* heure GMT sous le globe */
  if (inst.timeEl) {
    const txt = clockGMT();
    if (inst.timeEl.textContent !== txt) inst.timeEl.textContent = txt;
  }
}

/* ------------------------------ cycle de vie ---------------------------- */

function loop(ts) {
  rafId = requestAnimationFrame(loop);
  const now = ts || performance.now();
  // 24 images par seconde suffisent : rotation calme, batterie préservée
  if (now - lastFrame < 40) return;
  lastFrame = now;
  for (const inst of instances) {
    if (!inst.cv.isConnected) { instances.delete(inst); continue; }
    if (inst.paused) continue;
    const r = inst.cv.getBoundingClientRect();
    if (r.bottom < -80 || r.top > innerHeight + 80) continue;   // hors écran : on saute
    try { paint(inst, now); } catch (e) { instances.delete(inst); }
  }
  if (!instances.size) { cancelAnimationFrame(rafId); rafId = 0; }
}

/**
 * createGlobe(canvas, { size, timeEl, interactive, lonOffset })
 * Renvoie une poignée { destroy, setPaused, coordsAt }.
 */
export function createGlobe(canvas, opts = {}) {
  const cx = canvas.getContext('2d');
  if (!cx) return { destroy() {}, setPaused() {} };
  const inst = { cv: canvas, cx, opts, shade: null, shadeAt: 0, shadeLon: null, paused: false, manualLon: null, manualLat: null };
  instances.add(inst);

  if (opts.interactive) {
    let dragging = false, lastX = 0, lastY = 0;
    const down = (e) => { dragging = true; lastX = e.clientX; lastY = e.clientY; inst.manualLon = inst.lon0; inst.manualLat = inst.lat0; canvas.setPointerCapture && canvas.setPointerCapture(e.pointerId); };
    const move = (e) => {
      if (!dragging) return;
      inst.manualLon = (inst.manualLon || 0) - (e.clientX - lastX) * 0.4;
      inst.manualLat = Math.max(-80, Math.min(80, (inst.manualLat || 0) + (e.clientY - lastY) * 0.3));
      lastX = e.clientX; lastY = e.clientY;
      inst.shade = null;
    };
    const up = () => { dragging = false; };
    canvas.addEventListener('pointerdown', down);
    canvas.addEventListener('pointermove', move);
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', up);
    canvas.addEventListener('dblclick', () => { inst.manualLon = null; inst.manualLat = null; inst.shade = null; });
    inst.cleanup = () => {
      canvas.removeEventListener('pointerdown', down);
      canvas.removeEventListener('pointermove', move);
      canvas.removeEventListener('pointerup', up);
      canvas.removeEventListener('pointercancel', up);
    };
  }

  if (opts.timeEl) inst.timeEl = opts.timeEl;
  if (!rafId) rafId = requestAnimationFrame(loop);
  try { paint(inst, performance.now()); } catch (e) { /* premier rendu best effort */ }

  return {
    destroy() { instances.delete(inst); if (inst.cleanup) inst.cleanup(); },
    setPaused(v) { inst.paused = !!v; },
    state() { return { lon: inst.lon0, lat: inst.lat0, sun: inst.sun }; },
  };
}

/** Vignette fixe du globe, pour un favicon ou une image de repli. */
export function globeSnapshot(size = 96) {
  const cv = document.createElement('canvas');
  cv.width = size; cv.height = size;
  const cx = cv.getContext('2d');
  if (!cx) return null;
  const inst = { cv, cx, opts: { size }, shade: null, shadeAt: 0, shadeLon: null };
  try { paint(inst, performance.now()); return cv.toDataURL('image/png'); } catch (e) { return null; }
}
