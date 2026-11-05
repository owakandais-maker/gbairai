/* ==========================================================================
   media.js — choix de fichier, éditeur de recadrage/taille, découpe vidéo,
   téléchargement universel
   · Images : le recadrage est réellement appliqué (nouveau blob via canvas).
   · Vidéos : le cadrage et la découpe sont conservés en métadonnées et
     appliqués partout où la vidéo est rendue (pas de ré-encodage navigateur).
   ========================================================================== */

import { h, clamp, drag, uid } from './dom.js';
import { icon } from './icons.js';
import { t } from './i18n.js';
import { modal, sheet, toast } from './ui.js';
import { putBlob, getBlob, resolve as resolveBlob, isRef } from './idb.js';

export const MAX_BYTES = 60 * 1024 * 1024;
export const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif', 'image/svg+xml'];
export const VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime', 'video/ogg', 'video/x-matroska'];

export const RATIOS = [
  { id: 'free', label: 'media.free', v: 0 },
  { id: '1:1', label: '1:1', v: 1 },
  { id: '4:5', label: '4:5', v: 4 / 5 },
  { id: '3:4', label: '3:4', v: 3 / 4 },
  { id: '9:16', label: '9:16', v: 9 / 16 },
  { id: '16:9', label: '16:9', v: 16 / 9 },
  { id: '4:3', label: '4:3', v: 4 / 3 },
  { id: '21:9', label: '21:9', v: 21 / 9 },
];

/* ------------------------------ choix fichier --------------------------- */

export function pickFile(opts = {}) {
  return new Promise((resolve) => {
    const input = h('input', {
      type: 'file',
      accept: opts.accept || 'image/*,video/*',
      multiple: opts.multiple ? true : null,
      style: { position: 'fixed', left: '-9999px', opacity: '0' },
    });
    let settled = false;
    const finish = (files) => { if (!settled) { settled = true; input.remove(); resolve(files); } };
    input.addEventListener('change', () => finish(Array.from(input.files || [])));
    input.addEventListener('cancel', () => finish([]));
    document.body.appendChild(input);
    input.click();
    // Garde-fou : si l'évènement cancel n'existe pas, on libère au retour de focus.
    const onFocus = () => setTimeout(() => { if (!input.files || !input.files.length) finish([]); }, 500);
    window.addEventListener('focus', onFocus, { once: true });
  });
}

export function kindOf(file) {
  const type = (file && file.type) || '';
  if (IMAGE_TYPES.includes(type) || type.startsWith('image/')) return 'image';
  if (VIDEO_TYPES.includes(type) || type.startsWith('video/')) return 'video';
  return null;
}

export function validate(file) {
  const kind = kindOf(file);
  if (!kind) return { ok: false, msg: t('media.kind') };
  if (file.size > MAX_BYTES) return { ok: false, msg: t('media.tooBig', { n: Math.round(file.size / 1048576) }) };
  return { ok: true, kind };
}

/** Transforme un File en objet média de l'application. */
export async function toMedia(file) {
  const v = validate(file);
  if (!v.ok) { toast(v.msg, 'bad'); return null; }
  const ref = await putBlob(file, { name: file.name, type: file.type });
  const base = { id: uid('md'), kind: v.kind, ref, name: file.name, size: file.size, type: file.type };
  if (v.kind === 'image') {
    const dim = await imageSize(ref);
    return Object.assign(base, dim, { fit: defaultFit() });
  }
  const meta = await videoMeta(ref);
  return Object.assign(base, meta, { fit: defaultFit(), trim: { from: 0, to: meta.duration || 0 }, muted: false });
}

const defaultFit = () => ({ ratio: 'free', zoom: 1, x: 0, y: 0, rotate: 0, flipH: false, flipV: false });

export function imageSize(ref) {
  return new Promise((resolve) => {
    resolveBlob(ref).then((url) => {
      if (!url) { resolve({ w: 0, h: 0 }); return; }
      const im = new Image();
      im.onload = () => resolve({ w: im.naturalWidth, h: im.naturalHeight });
      im.onerror = () => resolve({ w: 0, h: 0 });
      im.src = url;
    });
  });
}

export function videoMeta(ref) {
  return new Promise((resolve) => {
    resolveBlob(ref).then((url) => {
      if (!url) { resolve({ w: 0, h: 0, duration: 0 }); return; }
      const vd = document.createElement('video');
      vd.preload = 'metadata';
      vd.muted = true;
      const done = () => resolve({
        w: vd.videoWidth || 0, h: vd.videoHeight || 0,
        duration: Number.isFinite(vd.duration) ? vd.duration : 0,
      });
      vd.onloadedmetadata = done;
      vd.onerror = () => resolve({ w: 0, h: 0, duration: 0 });
      setTimeout(done, 2500);
      vd.src = url;
    });
  });
}

/* ------------------------- application du cadrage ----------------------- */

/** Style CSS traduisant un objet fit, pour rendre le cadrage partout. */
export function fitStyle(fit) {
  const f = Object.assign({}, defaultFit(), fit || {});
  const parts = [];
  parts.push('translate(' + (f.x || 0) + '%, ' + (f.y || 0) + '%)');
  parts.push('scale(' + (f.flipH ? -1 : 1) * (f.zoom || 1) + ',' + (f.flipV ? -1 : 1) * (f.zoom || 1) + ')');
  if (f.rotate) parts.push('rotate(' + f.rotate + 'deg)');
  return { transform: parts.join(' '), 'transform-origin': 'center' };
}

export function ratioValue(id) {
  const r = RATIOS.find((x) => x.id === id);
  return r ? r.v : 0;
}

/* ------------------------------- éditeur -------------------------------- */

/**
 * editMedia(media, { ratio, title }) → Promise<media|null>
 * Recadrage, zoom, rotation, miroir, format et (pour la vidéo) découpe.
 * Rien n'est appliqué tant que l'utilisateur n'a pas validé.
 */
export function editMedia(media, opts = {}) {
  return new Promise((resolve) => {
    const work = JSON.parse(JSON.stringify(Object.assign({ fit: defaultFit() }, media)));
    work.fit = Object.assign(defaultFit(), work.fit);
    if (opts.ratio) work.fit.ratio = opts.ratio;

    const frame = h('div.frame');
    const grid = h('div.ed-grid', { hidden: true });
    const stage = h('div.ed-stage', frame, grid);
    const mediaEl = work.kind === 'video'
      ? h('video', { playsinline: true, muted: true, loop: true, preload: 'metadata' })
      : h('img', { alt: '' });
    frame.appendChild(mediaEl);

    resolveBlob(work.ref).then((url) => {
      if (!url) return;
      mediaEl.src = url;
      if (work.kind === 'video') { mediaEl.play().catch(() => {}); }
    });

    let natural = { w: work.w || 0, h: work.h || 0 };
    const sizeReady = () => {
      natural = work.kind === 'video'
        ? { w: mediaEl.videoWidth || natural.w, h: mediaEl.videoHeight || natural.h }
        : { w: mediaEl.naturalWidth || natural.w, h: mediaEl.naturalHeight || natural.h };
      layout();
    };
    mediaEl.addEventListener(work.kind === 'video' ? 'loadedmetadata' : 'load', sizeReady);

    function frameBox() {
      const sw = stage.clientWidth - 24;
      const sh = Math.min(stage.clientHeight - 24, 420);
      const ar = ratioValue(work.fit.ratio) || (natural.w && natural.h ? natural.w / natural.h : 1);
      let fw = sw, fh = sw / ar;
      if (fh > sh) { fh = sh; fw = sh * ar; }
      return { w: Math.max(80, fw), h: Math.max(80, fh), ar };
    }

    function layout() {
      const box = frameBox();
      frame.style.width = box.w + 'px';
      frame.style.height = box.h + 'px';
      // couverture : le média remplit toujours le cadre
      const nAr = natural.w && natural.h ? natural.w / natural.h : box.ar;
      let mw, mh;
      if (nAr > box.ar) { mh = box.h; mw = box.h * nAr; }
      else { mw = box.w; mh = box.w / nAr; }
      mediaEl.style.width = mw + 'px';
      mediaEl.style.height = mh + 'px';
      mediaEl.style.left = ((box.w - mw) / 2) + 'px';
      mediaEl.style.top = ((box.h - mh) / 2) + 'px';
      const st = fitStyle(work.fit);
      mediaEl.style.transform = st.transform;
      mediaEl.style.transformOrigin = 'center';
      zoomIn.value = String(work.fit.zoom);
      zoomOut.textContent = Math.round(work.fit.zoom * 100) + '%';
      rotIn.value = String(work.fit.rotate);
      rotOut.textContent = work.fit.rotate + '°';
    }

    drag(stage, {
      onMove: ({ dx, dy }) => {
        const box = frameBox();
        work.fit.x = clamp(work.fit.x + (dx / box.w) * 100 * 0.12, -60, 60);
        work.fit.y = clamp(work.fit.y + (dy / box.h) * 100 * 0.12, -60, 60);
        layout();
      },
    });
    stage.addEventListener('wheel', (e) => {
      e.preventDefault();
      work.fit.zoom = clamp(work.fit.zoom + (e.deltaY < 0 ? 0.06 : -0.06), 1, 4);
      layout();
    }, { passive: false });

    const ratioRow = h('div.ed-ratios', RATIOS.map((r) => h('button.chip.btn-like', {
      type: 'button',
      'aria-pressed': work.fit.ratio === r.id ? 'true' : 'false',
      onclick: (e) => {
        work.fit.ratio = r.id;
        ratioRow.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', 'false'));
        e.currentTarget.setAttribute('aria-pressed', 'true');
        ratioRow.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.getAttribute('aria-pressed') === 'true'));
        layout();
      },
      class: work.fit.ratio === r.id ? 'on' : '',
    }, r.id === 'free' ? t('media.free') : r.label)));

    const zoomIn = h('input', { type: 'range', min: '1', max: '4', step: '0.02', value: String(work.fit.zoom) });
    const zoomOut = h('span.v', '100%');
    zoomIn.addEventListener('input', () => { work.fit.zoom = Number(zoomIn.value); layout(); });

    const rotIn = h('input', { type: 'range', min: '-180', max: '180', step: '1', value: String(work.fit.rotate) });
    const rotOut = h('span.v', '0°');
    rotIn.addEventListener('input', () => { work.fit.rotate = Number(rotIn.value); layout(); });

    const trimRow = [];
    if (work.kind === 'video' && (work.duration || 0) > 0) {
      const from = h('input', { type: 'range', min: '0', max: String(work.duration.toFixed(2)), step: '0.1', value: String(work.trim ? work.trim.from : 0) });
      const to = h('input', { type: 'range', min: '0', max: String(work.duration.toFixed(2)), step: '0.1', value: String(work.trim ? work.trim.to : work.duration) });
      const fo = h('span.v', '0s');
      const to2 = h('span.v', Math.round(work.duration) + 's');
      const sync = () => {
        let a = Number(from.value), b = Number(to.value);
        if (a > b - 0.5) a = Math.max(0, b - 0.5);
        from.value = String(a);
        work.trim = { from: a, to: b };
        fo.textContent = a.toFixed(1) + 's';
        to2.textContent = b.toFixed(1) + 's';
        try { mediaEl.currentTime = a; } catch (e) { /* ignore */ }
      };
      from.addEventListener('input', sync);
      to.addEventListener('input', sync);
      trimRow.push(
        h('div.ed-slider', h('span', t('media.from')), from, fo),
        h('div.ed-slider', h('span', t('media.to')), to, to2),
      );
      mediaEl.addEventListener('timeupdate', () => {
        if (!work.trim) return;
        if (mediaEl.currentTime > work.trim.to) mediaEl.currentTime = work.trim.from;
      });
    }

    const ctrls = h('div.ed-ctrls',
      h('div.field', h('span.lbl', t('media.ratio')), ratioRow),
      h('div.ed-slider', h('span', t('media.zoom')), zoomIn, zoomOut),
      h('div.ed-slider', h('span', t('media.rotate')), rotIn, rotOut),
      trimRow.length ? h('div.field', h('span.lbl', t('media.trim')), h('div.stack.gap-2', trimRow)) : null,
      h('div.row.wrap.gap-2',
        h('button.btn.sm.ghost', { type: 'button', onclick: () => { work.fit.flipH = !work.fit.flipH; layout(); } }, icon('flip'), t('media.rotate') + ' ⇄'),
        h('button.btn.sm.ghost', { type: 'button', onclick: () => { work.fit.rotate = (work.fit.rotate + 90) % 360; layout(); } }, icon('rotate'), '90°'),
        h('button.btn.sm.ghost', { type: 'button', onclick: () => { grid.hidden = !grid.hidden; } }, icon('grid'), t('media.grid')),
        h('button.btn.sm.ghost', { type: 'button', onclick: () => { work.fit = defaultFit(); work.fit.ratio = opts.ratio || 'free'; layout(); } }, icon('refresh'), t('media.reset')),
      ),
    );

    let settled = false;
    const done = (v) => { if (!settled) { settled = true; resolve(v); } };

    const m = (opts.asSheet ? sheet : modal)({
      title: opts.title || t('media.editor'),
      size: 'wide',
      body: h('div.stack.gap-4', stage, ctrls),
      foot: [
        h('button.btn.ghost', { type: 'button', onclick: () => { done(null); m.close(); } }, t('a.cancel')),
        h('button.btn.primary', {
          type: 'button',
          onclick: async () => {
            const btn = m.el.querySelector('.btn.primary');
            btn.setAttribute('aria-disabled', 'true');
            const out = work.kind === 'image' ? await bakeImage(work) : work;
            done(out);
            m.close();
          },
        }, icon('check'), t('media.apply')),
      ],
      onClose: () => done(null),
    });

    requestAnimationFrame(layout);
    window.addEventListener('resize', layout);
    const mo = new MutationObserver(() => { if (!stage.isConnected) { window.removeEventListener('resize', layout); mo.disconnect(); } });
    mo.observe(document.body, { childList: true, subtree: true });
  });
}

/** Grave réellement le recadrage d'une image dans un nouveau blob. */
async function bakeImage(media) {
  try {
    const url = await resolveBlob(media.ref);
    if (!url) return media;
    const im = await new Promise((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = rej;
      i.src = url;
    });
    const f = media.fit || defaultFit();
    const ar = ratioValue(f.ratio) || (im.naturalWidth / im.naturalHeight);
    const outW = Math.min(1600, im.naturalWidth);
    const outH = Math.round(outW / ar);
    const cv = document.createElement('canvas');
    cv.width = outW; cv.height = outH;
    const cx = cv.getContext('2d');
    if (!cx) return media;
    cx.imageSmoothingQuality = 'high';
    cx.save();
    cx.translate(outW / 2 + (f.x / 100) * outW, outH / 2 + (f.y / 100) * outH);
    if (f.rotate) cx.rotate((f.rotate * Math.PI) / 180);
    cx.scale((f.flipH ? -1 : 1) * f.zoom, (f.flipV ? -1 : 1) * f.zoom);
    // couverture du cadre
    const nAr = im.naturalWidth / im.naturalHeight;
    let dw, dh;
    if (nAr > ar) { dh = outH; dw = outH * nAr; } else { dw = outW; dh = outW / nAr; }
    cx.drawImage(im, -dw / 2, -dh / 2, dw, dh);
    cx.restore();
    const blob = await new Promise((res) => cv.toBlob(res, 'image/webp', 0.92));
    if (!blob) return media;
    const ref = await putBlob(blob, { name: (media.name || 'image') + '.webp', type: 'image/webp' });
    return Object.assign({}, media, { ref, w: outW, h: outH, type: 'image/webp', size: blob.size, fit: defaultFit(), baked: true });
  } catch (e) {
    console.warn('[gbzn] recadrage image impossible, média conservé tel quel', e);
    return media;
  }
}

/* ----------------------------- téléchargement --------------------------- */

/** Téléchargement universel : fonctionne pour un blob IndexedDB ou une URL. */
export async function download(ref, filename) {
  try {
    let blob = null;
    if (isRef(ref)) blob = await getBlob(ref);
    else if (typeof ref === 'string' && ref.startsWith('data:')) {
      const r = await fetch(ref); blob = await r.blob();
    } else if (typeof ref === 'string') {
      try { const r = await fetch(ref); blob = await r.blob(); } catch (e) { blob = null; }
    }
    if (!blob) {
      // Dernier recours : ouvrir la ressource, l'utilisateur enregistre lui-même.
      if (typeof ref === 'string') { window.open(ref, '_blank', 'noopener'); return true; }
      toast(t('empty.generic'), 'bad');
      return false;
    }
    const url = URL.createObjectURL(blob);
    const a = h('a', { href: url, download: filename || guessName(blob.type) });
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    // Dans une page intégrée, le navigateur refuse les téléchargements : on le
    // dit plutôt que d'annoncer un succès qui n'a pas eu lieu.
    let embedded = false;
    try { embedded = window.top !== window.self; } catch (e) { embedded = true; }
    toast(embedded ? t('media.embedded') : t('toast.downloaded'), embedded ? 'info' : 'ok');
    return true;
  } catch (e) {
    toast(t('empty.generic'), 'bad');
    return false;
  }
}

function guessName(type) {
  const ext = type && type.includes('/') ? type.split('/')[1].split(';')[0] : 'bin';
  return 'gbzn-' + Date.now() + '.' + (ext === 'quicktime' ? 'mov' : ext);
}

/** Partage natif si disponible, copie du lien sinon. */
export async function shareNative(payload) {
  if (navigator.share) {
    try { await navigator.share(payload); return true; } catch (e) { return false; }
  }
  return false;
}

/* ---------------------------- rendu d'un média -------------------------- */

/**
 * Élément prêt à l'affichage, cadrage appliqué, avec repli propre.
 * mediaEl(media, { class, controls, autoplay, muted, poster })
 */
export function mediaEl(media, opts = {}) {
  if (!media) return null;
  const inner = media.kind === 'video'
    ? h('video', {
      class: opts.class || '', playsinline: true, preload: opts.preload || 'metadata',
      muted: opts.muted !== false, loop: opts.loop !== false,
      controls: opts.controls ? true : null, autoplay: opts.autoplay ? true : null,
      'aria-label': media.name || '',
    })
    : h('img', { class: opts.class || '', alt: opts.alt || media.name || '', loading: 'lazy', decoding: 'async' });

  const st = fitStyle(media.fit);
  if (media.fit && !media.baked) {
    inner.style.transform = st.transform;
    inner.style.transformOrigin = 'center';
  }
  resolveBlob(media.ref).then((url) => {
    if (!url || !inner.isConnected) return;
    inner.src = url;
    if (media.kind === 'video' && media.trim) {
      inner.addEventListener('loadedmetadata', () => { try { inner.currentTime = media.trim.from || 0; } catch (e) { /* ignore */ } });
      inner.addEventListener('timeupdate', () => {
        if (media.trim && inner.currentTime > media.trim.to) inner.currentTime = media.trim.from || 0;
      });
    }
  });
  return inner;
}
