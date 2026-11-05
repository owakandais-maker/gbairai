/**
 * ai.js — voice I/O + intent routing for the assistant.
 *
 * Fixes carried over from the previous build:
 *  - voices are resolved lazily (getVoices() is empty on first call in Chrome,
 *    so the old code always fell back to the default voice);
 *  - the recogniser's language follows the UI locale instead of being frozen at
 *    construction time;
 *  - recognition errors (`not-allowed`, `no-speech`, `network`) are handled, so
 *    the mic button can no longer get stuck in the listening state;
 *  - intents are matched per locale, not only against French keywords.
 */

import { t, meta, getLocale, LOCALES } from './i18n.js';

/* ----------------------------------------------------------- synthesis */

const synth = typeof window !== 'undefined' ? window.speechSynthesis : null;
let voices = [];

function refreshVoices() { voices = synth ? synth.getVoices() : []; }
if (synth) {
  refreshVoices();
  synth.addEventListener?.('voiceschanged', refreshVoices);
  if (!voices.length) setTimeout(refreshVoices, 350);
}

export const speechSupported = () => Boolean(synth);

const FEMALE_HINT = /female|woman|femme|mujer|mulher|frau|girl|zira|hazel|susan|karen|samantha|victoria|amelie|amélie|virginie|hortense|monica|luciana|paulina|anna|mei|ting|xiaoxiao|salma|hoda|google.*female/i;
const MALE_HINT   = /male|man|homme|hombre|homem|mann|boy|david|mark|thomas|daniel|diego|jorge|ricardo|yunjian|kangkang|maged|google.*male/i;

function pickVoice(gender) {
  if (!voices.length) refreshVoices();
  if (!voices.length) return null;

  const base = getLocale();
  const exact = meta().speech.toLowerCase();

  const tiers = [
    voices.filter((v) => (v.lang || '').toLowerCase() === exact),
    voices.filter((v) => (v.lang || '').toLowerCase().startsWith(base)),
    voices,
  ];

  for (const tier of tiers) {
    if (!tier.length) continue;
    const named = tier.find((v) =>
      gender === 'female' ? FEMALE_HINT.test(v.name) : MALE_HINT.test(v.name));
    if (named) return named;
  }
  // No gendered name available in this locale: take the first locale match.
  return tiers.find((tier) => tier.length)?.[0] || null;
}

/** Pitch/rate presets per persona. Browsers clamp pitch to 0–2, rate to 0.1–10. */
const PERSONA = {
  'male:adult':   { pitch: 0.90, rate: 1.00 },
  'female:adult': { pitch: 1.05, rate: 1.00 },
  'male:child':   { pitch: 1.70, rate: 1.14 },
  'female:child': { pitch: 1.85, rate: 1.16 },
  'male:elder':   { pitch: 0.70, rate: 0.84 },
  'female:elder': { pitch: 0.88, rate: 0.86 },
};

/** Speak `text`. Returns false when synthesis is unavailable or muted. */
export function speak(text, { gender = 'female', age = 'adult', enabled = true } = {}) {
  if (!synth || !enabled || !text) return false;
  try {
    synth.cancel();
    const u = new SpeechSynthesisUtterance(String(text).slice(0, 600));
    const voice = pickVoice(gender);
    if (voice) u.voice = voice;
    u.lang = meta().speech;
    const p = PERSONA[`${gender}:${age}`] || PERSONA['female:adult'];
    u.pitch = p.pitch;
    u.rate = p.rate;
    u.volume = 1;
    synth.speak(u);
    return true;
  } catch { return false; }
}

export function stopSpeaking() { try { synth?.cancel(); } catch { /* ignore */ } }

/* --------------------------------------------------------- recognition */

const SR = typeof window !== 'undefined'
  ? (window.SpeechRecognition || window.webkitSpeechRecognition)
  : null;

export const recognitionSupported = () => Boolean(SR);

/**
 * One recogniser instance, recreated on each start so the language always
 * matches the current locale (changing `.lang` mid-session is unreliable).
 */
export function createListener({ onResult, onStart, onEnd, onError }) {
  let rec = null;
  let active = false;

  function start() {
    if (!SR || active) return false;
    try {
      rec = new SR();
      rec.lang = meta().speech;
      rec.continuous = false;
      rec.interimResults = false;
      rec.maxAlternatives = 1;

      rec.onstart = () => { active = true; onStart?.(); };
      rec.onresult = (e) => {
        const transcript = e.results?.[0]?.[0]?.transcript?.trim();
        if (transcript) onResult?.(transcript);
      };
      rec.onerror = (e) => {
        active = false;
        const code = e?.error || 'unknown';
        onError?.(code);
        onEnd?.();
      };
      rec.onend = () => { active = false; onEnd?.(); };

      rec.start();
      return true;
    } catch {
      active = false;
      onError?.('start-failed');
      onEnd?.();
      return false;
    }
  }

  function stop() {
    if (!rec) return;
    try { rec.stop(); } catch { /* ignore */ }
    active = false;
  }

  return { start, stop, isActive: () => active, toggle: () => (active ? (stop(), false) : start()) };
}

/* -------------------------------------------------------------- intents */

/**
 * Keyword sets per intent, across all seven locales. Matching strips accents so
 * "créer" and "creer" both hit.
 */
const INTENTS = [
  { id: 'jobs',     words: ['emploi', 'offre', 'job', 'cherche', 'poste', 'vacante', 'vaga', 'stelle', 'arbeit', 'وظيف', 'عمل', '工作', '职位', 'empleo'] },
  { id: 'recruit',  words: ['recrut', 'talent', 'candidat', 'employer', 'hiring', 'hire', 'einstell', 'توظيف', 'مرشح', '招聘', '人才'] },
  { id: 'home',     words: ['accueil', 'home', 'inicio', 'start', 'início', 'الرئيسية', '首页'] },
  { id: 'wallet',   words: ['portefeuille', 'wallet', 'taro', 'solde', 'cartera', 'carteira', 'geldborse', 'geldbörse', 'محفظة', 'رصيد', '钱包', '余额'] },
  { id: 'studio',   words: ['studio', 'live', 'direct', 'stream', 'estudio', 'estúdio', 'بث', '直播'] },
  { id: 'pitch',    words: ['pitch', 'profil', 'video', 'vidéo', 'upload', 'perfil', 'profile', 'ملف', '档案', '视频'] },
  { id: 'offer',    words: ['publier', 'nouvelle offre', 'creer une offre', 'créer une offre', 'post a job', 'publish', 'publicar', 'veroffentlich', 'veröffentlich', 'نشر', '发布'] },
  { id: 'chat',     words: ['chat', 'discussion', 'message', 'commentaire', 'comment', 'دردشة', '聊天'] },
  { id: 'ads',      words: ['pub', 'publicit', 'billet', 'annonce', 'campagne', 'advert', 'ticket', 'entrada', 'bilhete', 'werbung', 'إعلان', 'تذكرة', '广告', '门票'] },
  { id: 'favs',     words: ['favori', 'favourite', 'favorite', 'bookmark', 'guardado', 'favorito', 'مفضل', '收藏'] },
  { id: 'alerts',   words: ['alerte', 'alert', 'notification', 'alarm', 'aviso', 'تنبيه', '提醒'] },
  { id: 'reco',     words: ['recommand', 'recommend', 'suggestion', 'empfehl', 'recomend', 'توصي', '推荐'] },
  { id: 'translate',words: ['tradui', 'translat', 'traduc', 'ubersetz', 'übersetz', 'ترجم', '翻译'] },
  { id: 'theme',    words: ['theme', 'thème', 'sombre', 'dark', 'clair', 'light', 'oscuro', 'dunkel', 'مظهر', '深色', '主题'] },
  { id: 'remote',   words: ['remote', 'teletravail', 'télétravail', 'distancia', 'عن بعد', '远程'] },
  { id: 'reset',    words: ['reinitialis', 'réinitialis', 'reset', 'clear filter', 'effacer les filtres', 'restablecer', 'zurucksetz', 'zurücksetz', 'إعادة', '重置'] },
  { id: 'install',  words: ['install', 'installer', 'pwa', 'instalar', 'تثبيت', '安装'] },
  { id: 'help',     words: ['aide', 'help', 'ayuda', 'ajuda', 'hilfe', 'مساعدة', '帮助'] },
];

const strip = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/**
 * Resolve an utterance to `{ intent, query }`.
 * `query` carries a free-text search term when one was dictated
 * ("cherche React", "search for designer", "busca diseñador"...).
 */
export function parseIntent(utterance) {
  const text = strip(utterance);

  const searchRe = /(?:recherche|cherche|search(?: for)?|find|busca|buscar|procura|procurar|suche|ابحث|搜索|查找)\s+(.{2,60})$/;
  const found = text.match(searchRe);
  const query = found ? found[1].trim() : null;

  let best = null, bestLen = 0;
  for (const intent of INTENTS) {
    for (const word of intent.words) {
      const w = strip(word);
      if (w.length > bestLen && text.includes(w)) { best = intent.id; bestLen = w.length; }
    }
  }

  if (query && (!best || best === 'jobs')) return { intent: 'search', query };
  return { intent: best || 'unknown', query };
}

/** Short conversational acknowledgement for the chat moderator bot. */
export function smallTalk() {
  const pool = {
    fr: ['Bien noté !', 'Intéressant, merci du partage.', "Besoin d'aide pour postuler ?", 'Je transmets à la communauté.'],
    en: ['Noted!', 'Interesting, thanks for sharing.', 'Need help applying?', "I'll pass it on to the community."],
    es: ['¡Anotado!', 'Interesante, gracias por compartir.', '¿Necesitas ayuda para postular?', 'Lo comparto con la comunidad.'],
    pt: ['Anotado!', 'Interessante, obrigado por partilhar.', 'Precisa de ajuda para se candidatar?', 'Vou partilhar com a comunidade.'],
    de: ['Notiert!', 'Interessant, danke fürs Teilen.', 'Brauchst du Hilfe bei der Bewerbung?', 'Ich gebe es an die Community weiter.'],
    ar: ['تم التسجيل!', 'مثير للاهتمام، شكراً للمشاركة.', 'تحتاج مساعدة في التقديم؟', 'سأنقلها إلى المجتمع.'],
    zh: ['已记录！', '很有意思，感谢分享。', '需要帮助申请吗？', '我会转达给社区。'],
  };
  const list = pool[getLocale()] || pool.fr;
  return list[Math.floor(Math.random() * list.length)];
}

/**
 * Stand-in for a translation backend. It tags the target locale and leaves the
 * source text intact rather than pretending to have translated it — the old
 * build prefixed "[EN]" onto already-prefixed strings on every click, so a
 * message could end up as "[EN] [EN] [FR] hello".
 */
export function pseudoTranslate(text, targetLocale = getLocale()) {
  const label = LOCALES.find((l) => l.code === targetLocale)?.code.toUpperCase() || 'FR';
  return { label, text: String(text) };
}

export const helpText = () => t('ai.hint');
