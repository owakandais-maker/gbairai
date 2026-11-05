/**
 * icons.js — inline SVG icon set on a 24×24 grid.
 *
 * Replaces the Font Awesome CDN stylesheet + webfonts. Three reasons:
 *  1. offline: an icon font served from a CDN disappears the moment the network
 *     does, which left the whole UI unlabelled in offline tests;
 *  2. weight: ~100 KB of CSS and font files for ~50 glyphs;
 *  3. no FOIT/FOUT and no render-blocking third-party request.
 *
 * Keys keep the familiar `fa-*` names so call sites read the same.
 * `d` is one or more sub-paths; icons listed in FILLED render solid.
 */

export const ICONS = {
  // Navigation & structure
  'house': 'M4 10.8 12 4l8 6.8V20a1 1 0 0 1-1 1h-4.5v-6h-5v6H5a1 1 0 0 1-1-1z',
  'magnifying-glass': 'M10.5 17.5a7 7 0 1 1 0-14 7 7 0 0 1 0 14m5 .5L21 21',
  'briefcase': 'M3 8.5h18V19a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 19zM8.5 8.5V6A1.5 1.5 0 0 1 10 4.5h4A1.5 1.5 0 0 1 15.5 6v2.5M3 13.5h18',
  'wallet': 'M3 8.5A2 2 0 0 1 5 6.5h13A1.5 1.5 0 0 1 19.5 8v1.5M3 8.5V18a2 2 0 0 0 2 2h14a1.5 1.5 0 0 0 1.5-1.5v-7A1.5 1.5 0 0 0 19 10H5a2 2 0 0 1-2-1.5M16.5 15h1',
  'tower-broadcast': 'M12 11.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3M12 12.5V21M8.6 6.6a5 5 0 0 0 0 6.8M15.4 6.6a5 5 0 0 1 0 6.8M6 4a8.5 8.5 0 0 0 0 12M18 4a8.5 8.5 0 0 1 0 12',
  'layer-group': 'M12 3 3.5 7.2 12 11.4l8.5-4.2zM3.5 12 12 16.2l8.5-4.2M3.5 16.3 12 20.5l8.5-4.2',
  'arrow-right': 'M5 12h13.5M13 6.5 19 12l-6 5.5',
  'building': 'M5.5 21V4.8A1.3 1.3 0 0 1 6.8 3.5h6.4a1.3 1.3 0 0 1 1.3 1.3V21M14.5 10h3.7A1.3 1.3 0 0 1 19.5 11.3V21M3 21h18M8.8 7h2.4M8.8 11h2.4M8.8 15h2.4',

  // Actions
  'plus': 'M12 5.2v13.6M5.2 12h13.6',
  'xmark': 'M6.4 6.4l11.2 11.2M17.6 6.4 6.4 17.6',
  'check': 'M5.2 12.8l4.6 4.6L18.8 7',
  'trash': 'M4.5 7h15M9.5 7V4.9h5V7M6.6 7l.9 12.9h9L17.4 7M10.4 11v5.6M13.6 11v5.6',
  'download': 'M12 3.6v10.9M7.6 10.5 12 14.9l4.4-4.4M4.5 20.4h15',
  'paper-plane': 'M21.2 3 2.9 10.3l6.6 2.6 2.6 6.6zM9.5 12.9l5.3-5.3',
  'rotate-left': 'M4.2 9.6V4.9M4.2 9.6h4.7M4.8 9.1a7.9 7.9 0 1 1-.5 6',
  'sliders': 'M3.5 7h10.4M17.4 7h3.1M3.5 12h3.4M10.4 12h10.1M3.5 17h8.4M15.4 17h5.1M15.6 5.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3M8.6 10.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3M13.6 15.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3',
  'stop': 'M6.2 6.2h11.6v11.6H6.2z',
  'play': 'M8 5.3v13.4L19 12z',
  'circle-play': 'M12 20.8a8.8 8.8 0 1 0 0-17.6 8.8 8.8 0 0 0 0 17.6M10.3 8.6v6.8L15.7 12z',

  // Status
  'circle-check': 'M12 20.8a8.8 8.8 0 1 0 0-17.6 8.8 8.8 0 0 0 0 17.6M8.1 12.2l2.8 2.8 5.1-5.6',
  'circle-info': 'M12 20.8a8.8 8.8 0 1 0 0-17.6 8.8 8.8 0 0 0 0 17.6M12 11v5.2M12 7.7h.01',
  'circle-exclamation': 'M12 20.8a8.8 8.8 0 1 0 0-17.6 8.8 8.8 0 0 0 0 17.6M12 7.8V13M12 16.3h.01',
  'triangle-exclamation': 'M10.6 4.2 2.8 17.7A1.6 1.6 0 0 0 4.2 20.2h15.6a1.6 1.6 0 0 0 1.4-2.5L13.4 4.2a1.6 1.6 0 0 0-2.8 0zM12 9.3v4.1M12 16.8h.01',
  'circle-notch': 'M20.8 12A8.8 8.8 0 1 1 16.4 4.4',
  'bolt': 'M13.6 2.2 4.9 13.9h5.2l-1 7.9 9.9-11.7h-5.1z',
  'fire': 'M12 2.4S9.2 6.2 9.2 9c0 1.7-1 2.4-2 3.4a5.5 5.5 0 0 0-1.7 3.9 6.5 6.5 0 0 0 13 0c0-2.9-1.4-4.8-2.9-6.3S12 5.2 12 2.4z',

  // Content
  'heart': 'M12 20.3 4.8 13.1a4.7 4.7 0 0 1 6.6-6.7l.6.6.6-.6a4.7 4.7 0 0 1 6.6 6.7z',
  'bookmark': 'M6.2 4.6h11.6v16.1L12 16.1l-5.8 4.6z',
  'bell': 'M18 10.2a6 6 0 1 0-12 0c0 4.8-2 5.9-2 5.9h16s-2-1.1-2-5.9M10.3 19.6a2 2 0 0 0 3.4 0',
  'comments': 'M8.2 13.4H6.1a2.9 2.9 0 0 1-2.9-2.9V6.9A2.9 2.9 0 0 1 6.1 4h7.1A2.9 2.9 0 0 1 16.1 6.9v.6M20.8 13.3a2.9 2.9 0 0 0-2.9-2.9h-5.6a2.9 2.9 0 0 0-2.9 2.9v2.4a2.9 2.9 0 0 0 2.9 2.9h.5l3.1 2.4v-2.4h2a2.9 2.9 0 0 0 2.9-2.9z',
  'image': 'M3.6 5.6h16.8v12.8H3.6zM8.2 11.1a1.6 1.6 0 1 0 0-3.2 1.6 1.6 0 0 0 0 3.2M4 16.8l4.6-4.5 3.9 3.9 3-2.5 4.5 4.2',
  'film': 'M3.2 5.2h17.6v13.6H3.2zM7.2 5.2v13.6M16.8 5.2v13.6M3.2 9.6h4M3.2 14.4h4M16.8 9.6h4M16.8 14.4h4',
  'video': 'M3 7.6A1.5 1.5 0 0 1 4.5 6.1h8A1.5 1.5 0 0 1 14 7.6v8.8a1.5 1.5 0 0 1-1.5 1.5h-8A1.5 1.5 0 0 1 3 16.4zM14 11.1l6.5-3.6v9l-6.5-3.6',
  'folder-open': 'M3.2 9.4V6.6A1.5 1.5 0 0 1 4.7 5.1h3.8l2 2.6h6.8a1.5 1.5 0 0 1 1.5 1.5v.2M3.2 10.4h17.6l-2 8.4a1.5 1.5 0 0 1-1.5 1.1H5.6a1.5 1.5 0 0 1-1.5-1.2z',
  'ticket': 'M3.2 9.6V7.1a1 1 0 0 1 1-1h15.6a1 1 0 0 1 1 1v2.5a2.4 2.4 0 0 0 0 4.8v2.5a1 1 0 0 1-1 1H4.2a1 1 0 0 1-1-1v-2.5a2.4 2.4 0 0 0 0-4.8M9.6 6.1v11.8',
  'receipt': 'M5.4 3.2h13.2v17.6l-2.9-1.9-2.1 1.9-2.1-1.9-2.1 1.9-2.1-1.9-1.9 1.3zM9 8.2h6M9 12h6M9 15.8h4',
  'gift': 'M3.4 10.6h17.2V20.4H3.4zM3.4 7.6h17.2v3H3.4zM12 7.6v12.8M8.6 7.6a2.4 2.4 0 1 1 3.4-2.2 2.4 2.4 0 1 1 3.4 2.2',
  'graduation-cap': 'M12 4.2 2.6 8.4 12 12.6l9.4-4.2zM6.4 10.5v5.1c0 1.6 2.5 2.9 5.6 2.9s5.6-1.3 5.6-2.9v-5.1',

  // People
  'user': 'M12 12.1a3.9 3.9 0 1 0 0-7.8 3.9 3.9 0 0 0 0 7.8M4.8 20.4a7.2 7.2 0 0 1 14.4 0',
  'users': 'M9.6 11.6a3.7 3.7 0 1 0 0-7.4 3.7 3.7 0 0 0 0 7.4M2.8 20a6.8 6.8 0 0 1 13.6 0M16.6 11a3.4 3.4 0 0 0 0-6.8M18.2 20h3.2a5.4 5.4 0 0 0-3.4-5',
  'crown': 'M3.2 8.2 7.4 11.3 12 4.8l4.6 6.5 4.2-3.1-2.1 10.8H5.3z',

  // Location
  'location-dot': 'M12 20.8s6.9-6.1 6.9-10.8a6.9 6.9 0 1 0-13.8 0C5.1 14.7 12 20.8 12 20.8M12 12.6a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5',
  'map-pin': 'M12 20.8v-6.6M12 14.2a5 5 0 1 0 0-10 5 5 0 0 0 0 10',
  'globe': 'M12 20.8a8.8 8.8 0 1 0 0-17.6 8.8 8.8 0 0 0 0 17.6M3.4 12h17.2M12 3.2c2.4 2.4 3.7 5.4 3.7 8.8S14.4 18.4 12 20.8c-2.4-2.4-3.7-5.4-3.7-8.8S9.6 5.6 12 3.2',

  // Theme
  'moon': 'M20.2 14.6A8.6 8.6 0 0 1 9.4 3.8a8.6 8.6 0 1 0 10.8 10.8',
  'sun': 'M12 16.8a4.8 4.8 0 1 0 0-9.6 4.8 4.8 0 0 0 0 9.6M12 2.4v2M12 19.6v2M4.4 4.4l1.4 1.4M18.2 18.2l1.4 1.4M2.4 12h2M19.6 12h2M4.4 19.6l1.4-1.4M18.2 5.8l1.4-1.4',
  'circle-half-stroke': 'M12 20.8a8.8 8.8 0 1 0 0-17.6 8.8 8.8 0 0 0 0 17.6M12 3.2v17.6',

  // Audio / video production
  'microphone': 'M12 14.9a3.4 3.4 0 0 0 3.4-3.4V6a3.4 3.4 0 0 0-6.8 0v5.5A3.4 3.4 0 0 0 12 14.9M6.2 11.4a5.8 5.8 0 0 0 11.6 0M12 18.3v2.4M9.4 20.7h5.2',
  'volume-high': 'M3.6 9.4h3.2L12 5.1v13.8l-5.2-4.3H3.6zM15.8 9.2a4 4 0 0 1 0 5.6M18.6 6.4a8 8 0 0 1 0 11.2',
  'volume-xmark': 'M3.6 9.4h3.2L12 5.1v13.8l-5.2-4.3H3.6zM16.2 9.8l4.4 4.4M20.6 9.8l-4.4 4.4',
  'record-vinyl': 'M12 20.8a8.8 8.8 0 1 0 0-17.6 8.8 8.8 0 0 0 0 17.6M12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4',
  'closed-captioning': 'M3.2 5.6h17.6v12.8H3.2zM10.2 10.2a2.6 2.6 0 1 0 0 3.6M17 10.2a2.6 2.6 0 1 0 0 3.6',
  'house-laptop': 'M5.2 6.8h13.6v8.8H5.2zM3 18.6h18M9.6 6.8 12 4.2l2.4 2.6',

  // Misc
  'language': 'M3.6 6.2h9.2M8.4 6.2c0 4.8-1.9 7.8-4.8 9.4M5.8 10.4c1.2 2.5 3.2 4.3 5.8 5M13.4 20.4l3.9-9.8 3.9 9.8M15 17.2h4.6',
  'wand-magic-sparkles': 'M13.9 7.3 4.3 16.9l2.9 2.9 9.6-9.6zM17.6 2.6l.9 2 2 .9-2 .9-.9 2-.9-2-2-.9 2-.9zM6.1 3.1l.6 1.4 1.4.6-1.4.6-.6 1.4-.6-1.4-1.4-.6 1.4-.6zM19.6 14.9l.5 1.2 1.2.5-1.2.5-.5 1.2-.5-1.2-1.2-.5 1.2-.5z',
  'ellipsis': 'M7.3 10.6a1.4 1.4 0 1 0 0 2.8 1.4 1.4 0 0 0 0-2.8M12 10.6a1.4 1.4 0 1 0 0 2.8 1.4 1.4 0 0 0 0-2.8M16.7 10.6a1.4 1.4 0 1 0 0 2.8 1.4 1.4 0 0 0 0-2.8',
  'robot': 'M5.4 9.4h13.2v9.6H5.4zM12 9.4V6.6M12 4.1a1.3 1.3 0 1 0 0 2.6 1.3 1.3 0 0 0 0-2.6M9.4 13.2h.01M14.6 13.2h.01M9.9 16.4h4.2M2.6 12.2v3.6M21.4 12.2v3.6',
};

/** Icons that read better filled; `fa-solid` picks the filled form. */
export const FILLED = new Set(['heart', 'bookmark', 'play', 'bolt', 'fire', 'stop', 'crown', 'ellipsis']);

/** Sub-paths that must stay stroked even in a filled icon. */
export const ALWAYS_STROKE = new Set([]);

/** Resolve `"fa-solid fa-house"` → `{ key, solid }`. */
export function parseIconName(spec) {
  const parts = String(spec || '').trim().split(/\s+/);
  let key = null;
  let solid = false;
  for (const part of parts) {
    if (part === 'fa-solid' || part === 'fas') solid = true;
    else if (part === 'fa-regular' || part === 'far') solid = false;
    else if (part.startsWith('fa-')) {
      const candidate = part.slice(3);
      if (ICONS[candidate]) key = candidate;
    }
  }
  return { key, solid };
}
