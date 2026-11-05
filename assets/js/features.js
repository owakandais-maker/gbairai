/**
 * features.js — chat panel, AI panel, ad carousel, and the three forms
 * (video pitch, job offer, ad campaign) with real client-side validation.
 */

import { h, icon, render, $, safeUrl, debounce, paintImageFallback } from './dom.js';
import { t, clock, getLocale, LOCALES } from './i18n.js';
import * as store from './store.js';
import { modal, toast, confirm } from './ui.js';
import { speak, smallTalk, pseudoTranslate } from './ai.js';
import { CONTRACTS } from './data.js';

let uid = 0;
const nextId = (prefix) => `${prefix}${Date.now().toString(36)}${(++uid).toString(36)}`;

/* =============================================================== panels */

/** A dock panel (chat / AI) with one shared open-close contract. */
function buildPanel({ id, titleKey, iconName, bodyHost, foot, extraHeader }) {
  return h('section.panel', {
    id, role: 'dialog', 'aria-modal': 'false',
    'aria-label': t(titleKey), 'aria-hidden': 'true',
  }, [
    h('header.panel-head', null, [
      icon(iconName),
      h('h2', { text: t(titleKey) }),
      ...(extraHeader || []),
      h('button.icon-btn', {
        type: 'button', 'aria-label': t('common.close'),
        on: { click: () => closePanel(id) },
      }, icon('fa-solid fa-xmark')),
    ]),
    bodyHost,
    foot,
  ]);
}

export function openPanel(id) {
  const el = $(`#${id}`);
  if (!el) return;
  // Only one dock panel at a time — they share the same corner.
  document.querySelectorAll('.panel.is-open').forEach((p) => { if (p !== el) closePanel(p.id); });
  el.classList.add('is-open');
  el.setAttribute('aria-hidden', 'false');
  (el.querySelector('.panel-foot input, .panel-foot textarea') || el).focus?.();
}

export function closePanel(id) {
  const el = $(`#${id}`);
  if (!el) return;
  el.classList.remove('is-open');
  el.setAttribute('aria-hidden', 'true');
}

export function togglePanel(id) {
  const el = $(`#${id}`);
  if (!el) return;
  el.classList.contains('is-open') ? closePanel(id) : openPanel(id);
}

export const isPanelOpen = (id) => Boolean($(`#${id}`)?.classList.contains('is-open'));

/* ================================================================= chat */

let chatList;

export function mountChat(root) {
  chatList = h('div.panel-body.scroll-y', { id: 'chat-list', role: 'log', 'aria-live': 'polite' });

  const input = h('input.input', {
    type: 'text', id: 'chat-input', maxlength: '500',
    placeholder: t('chat.placeholder'), 'aria-label': t('chat.placeholder'),
    on: { keydown: (e) => { if (e.key === 'Enter') { e.preventDefault(); send(); } } },
  });

  function send() {
    const text = input.value.trim();
    if (!text) return;
    pushMessage({ author: t('chat.you'), text, locale: getLocale(), mine: true });
    input.value = '';
    showTyping();
    setTimeout(() => {
      hideTyping();
      pushMessage({ author: t('chat.mod'), text: smallTalk(), locale: getLocale(), kind: 'bot' });
    }, 900);
  }

  const foot = h('div.panel-foot', null, [
    h('div.composer', null, [
      input,
      h('button.btn.btn-primary', {
        type: 'button', 'aria-label': t('chat.send'), on: { click: send },
      }, icon('fa-solid fa-paper-plane')),
    ]),
    h('div.row.gap-1', null, [
      h('button.panel-link', {
        type: 'button',
        on: { click: translateAll },
      }, [icon('fa-solid fa-language'), ' ', t('chat.translate')]),
      h('button.panel-link.quiet', {
        type: 'button',
        on: {
          click: async () => {
            const ok = await confirm({
              title: t('chat.clear'), message: t('chat.cleared'),
              confirmLabel: t('common.delete'), danger: true,
            });
            if (!ok) return;
            store.set({ chat: [] });
            paintChat();
            toast(t('chat.cleared'), '', 'info');
          },
        },
      }, [icon('fa-solid fa-trash'), ' ', t('chat.clear')]),
    ]),
  ]);

  root.append(buildPanel({
    id: 'chat-panel', titleKey: 'chat.title', iconName: 'fa-regular fa-comments',
    bodyHost: chatList, foot,
  }));

  paintChat();
}

export function pushMessage({ author, text, locale, mine = false, kind = 'user' }) {
  const chat = store.get().chat;
  chat.push({ id: nextId('m'), author, text, locale: locale || getLocale(), at: Date.now(), mine, kind });
  while (chat.length > 200) chat.shift();
  store.touch('chat');
  paintChat();
}

export function paintChat() {
  if (!chatList) return;
  const { chat } = store.get();

  if (!chat.length) {
    render(chatList, h('p.empty', { text: t('chat.empty'), style: 'font-size:.84rem' }));
    return;
  }

  render(chatList, chat.map((m) => h('div', {
    class: `msg${m.mine ? ' me' : ''}${m.kind === 'system' ? ' msg-sys' : ''}`,
  }, [
    h('div.msg-bubble', null, [
      h('div.msg-head', null, [
        h('span.msg-author', { text: m.author }),
        h('span.msg-time', { text: clock(m.at) }),
      ]),
      h('span', { text: m.text }),
      m.translated
        ? h('div.msg-trans', { text: `[${m.translated.label}] ${m.translated.text}` })
        : null,
    ]),
  ])));

  chatList.scrollTop = chatList.scrollHeight;
}

function translateAll() {
  const target = getLocale();
  const chat = store.get().chat;
  let changed = 0;
  chat.forEach((m) => {
    if (m.locale === target) { m.translated = null; return; }
    m.translated = pseudoTranslate(m.text, target);
    changed += 1;
  });
  store.touch('chat');
  paintChat();
  toast(t('chat.translated'), `${changed} / ${chat.length}`, 'info');
}

let typingNode = null;
function showTyping() {
  if (!chatList || typingNode) return;
  typingNode = h('div.msg', null, h('div.msg-bubble', null,
    h('span.typing', { 'aria-label': t('common.loading') }, [h('i'), h('i'), h('i')])));
  chatList.append(typingNode);
  chatList.scrollTop = chatList.scrollHeight;
}
function hideTyping() { typingNode?.remove(); typingNode = null; }

/* =================================================================== AI */

let aiList, aiInput, aiMicBtn;

export function mountAI(root, { onSubmit, onToggleMic }) {
  aiList = h('div.panel-body.scroll-y', { id: 'ai-list', role: 'log', 'aria-live': 'polite' });

  aiInput = h('input.input', {
    type: 'text', id: 'ai-input', maxlength: '300',
    placeholder: t('ai.placeholder'), 'aria-label': t('ai.placeholder'),
    on: { keydown: (e) => { if (e.key === 'Enter') { e.preventDefault(); submit(); } } },
  });

  function submit() {
    const text = aiInput.value.trim();
    if (!text) return;
    aiInput.value = '';
    onSubmit(text);
  }

  aiMicBtn = h('button.btn.btn-ghost', {
    type: 'button', id: 'ai-mic', 'aria-pressed': 'false',
    'aria-label': t('ai.mic'), title: t('ai.mic'),
    on: { click: onToggleMic },
  }, icon('fa-solid fa-microphone'));

  const speakToggle = h('button.icon-btn', {
    type: 'button', 'aria-pressed': store.get().speakReplies ? 'true' : 'false',
    'aria-label': t('ai.voice'), title: t('ai.voice'),
    on: {
      click: (e) => {
        const on = !store.get().speakReplies;
        store.set({ speakReplies: on });
        e.currentTarget.setAttribute('aria-pressed', on ? 'true' : 'false');
        render(e.currentTarget, icon(on ? 'fa-solid fa-volume-high' : 'fa-solid fa-volume-xmark'));
        toast(on ? t('ai.speak.on') : t('ai.speak.off'), '', 'info', { duration: 2200 });
      },
    },
  }, icon(store.get().speakReplies ? 'fa-solid fa-volume-high' : 'fa-solid fa-volume-xmark'));

  const voices = [
    ['male', 'adult', 'voice.m.adult'], ['female', 'adult', 'voice.f.adult'],
    ['male', 'child', 'voice.m.child'], ['female', 'child', 'voice.f.child'],
    ['male', 'elder', 'voice.m.elder'], ['female', 'elder', 'voice.f.elder'],
  ];

  const foot = h('div.panel-foot', null, [
    h('div.composer', null, [aiInput, aiMicBtn,
      h('button.btn.btn-primary', {
        type: 'button', 'aria-label': t('chat.send'), on: { click: submit },
      }, icon('fa-solid fa-paper-plane')),
    ]),
    h('div.quick-row.no-scrollbar', { role: 'group', 'aria-label': t('ai.voice') },
      voices.map(([gender, age, key]) => {
        const cur = store.get().voice;
        const on = cur.gender === gender && cur.age === age;
        return h('button.chip', {
          type: 'button', text: t(key), 'aria-pressed': on ? 'true' : 'false',
          dataset: { gender, age },
          on: {
            click: (e) => {
              store.set({ voice: { gender, age } });
              e.currentTarget.closest('.quick-row')
                .querySelectorAll('.chip')
                .forEach((c) => c.setAttribute('aria-pressed', c === e.currentTarget ? 'true' : 'false'));
              speak(t(key), { ...store.get().voice, enabled: true });
            },
          },
        });
      })),
    h('p.text-faint', { text: t('ai.hint'), style: 'font-size:.68rem;line-height:1.4' }),
  ]);

  root.append(buildPanel({
    id: 'ai-panel', titleKey: 'ai.title', iconName: 'fa-solid fa-robot',
    bodyHost: aiList, foot, extraHeader: [speakToggle],
  }));
}

export function pushAI(role, text) {
  if (!aiList) return;
  aiList.append(h('div', { class: `msg${role === 'user' ? ' me' : ''}` },
    h('div.msg-bubble', null, h('span', { text }))));
  aiList.scrollTop = aiList.scrollHeight;
  if (role === 'assistant') {
    const { voice, speakReplies } = store.get();
    speak(text, { ...voice, enabled: speakReplies });
  }
}

export function setAIValue(text) { if (aiInput) aiInput.value = text; }

export function setMicState(listening) {
  if (!aiMicBtn) return;
  aiMicBtn.setAttribute('aria-pressed', listening ? 'true' : 'false');
  aiMicBtn.setAttribute('aria-label', listening ? t('ai.mic.stop') : t('ai.mic'));
  aiMicBtn.classList.toggle('btn-danger', listening);
  aiMicBtn.classList.toggle('btn-ghost', !listening);
  render(aiMicBtn, icon(listening ? 'fa-solid fa-stop' : 'fa-solid fa-microphone'));
  $('#dock-ai')?.classList.toggle('is-listening', listening);
}

export const aiEmpty = () => !aiList || aiList.children.length === 0;

/* ========================================================= ad carousel */

let carouselTimer = null;
let carouselIndex = 0;

export function mountAdStage(host, { onManage }) {
  if (!host) return;
  const ads = store.get().ads || [];

  if (!ads.length) {
    render(host, h('div.empty', null, [
      icon('fa-regular fa-image'),
      h('h3', { text: t('ad.empty') }),
      h('button.btn.btn-primary.btn-sm', {
        type: 'button', 'data-creator-only': '', text: t('ad.manage'),
        on: { click: onManage },
      }),
    ]));
    return;
  }

  carouselIndex = Math.min(carouselIndex, ads.length - 1);

  const slides = ads.map((ad, i) => {
    const url = safeUrl(ad.url);
    const media = !url ? h('div.ad-media', { style: 'background:var(--surface-3)' })
      : ad.type === 'video'
        ? h('video.ad-media', {
            src: url, autoplay: true, muted: true, loop: true, playsinline: true,
            'aria-hidden': 'true', preload: 'metadata',
          })
        : h('img.ad-media', {
            src: url, alt: ad.title || '',
            loading: i === 0 ? 'eager' : 'lazy', decoding: 'async',
            on: { error: (e) => paintImageFallback(e.currentTarget, ad.title || url) },
          });

    const actions = [
      ...(safeUrl(ad.link) ? [h('a.btn.btn-on-dark', {
        href: safeUrl(ad.link), target: '_blank', rel: 'noopener noreferrer nofollow',
        text: ad.cta || t('common.more'),
      })] : []),
      ...(ad.buttons || []).filter((b) => safeUrl(b.link)).map((b) =>
        h('a.btn.btn-primary', {
          href: safeUrl(b.link), target: '_blank', rel: 'noopener noreferrer nofollow',
          text: b.label,
        })),
    ];

    return h('div', {
      class: `ad-slide${i === carouselIndex ? ' is-active' : ''}`,
      dataset: { index: i }, 'aria-hidden': i === carouselIndex ? 'false' : 'true',
    }, [
      media,
      h('div.ad-scrim', { 'aria-hidden': 'true' }),
      h('span.ad-kicker', { text: ad.kicker || t('ad.sponsored') }),
      h('div.ad-body', null, [
        h('div', null, [
          h('h3', { text: ad.title || '' }),
          h('p', { text: t('ad.desc') }),
        ]),
        actions.length ? h('div.ad-actions', null, actions) : null,
      ]),
    ]);
  });

  const dots = h('div.ad-dots', { role: 'tablist', 'aria-label': t('ad.title') },
    ads.map((_, i) => h('button.ad-dot', {
      type: 'button', role: 'tab',
      'aria-current': i === carouselIndex ? 'true' : 'false',
      'aria-label': t('ad.goto', { n: i + 1 }),
      on: { click: () => goTo(i) },
    })));

  const stage = h('div.ad-stage', { id: 'ad-stage' }, [
    ...slides,
    ads.length > 1 ? dots : null,
  ]);

  function goTo(i) {
    carouselIndex = (i + ads.length) % ads.length;
    stage.querySelectorAll('.ad-slide').forEach((s, idx) => {
      const on = idx === carouselIndex;
      s.classList.toggle('is-active', on);
      s.setAttribute('aria-hidden', on ? 'false' : 'true');
    });
    dots.querySelectorAll('.ad-dot').forEach((d, idx) =>
      d.setAttribute('aria-current', idx === carouselIndex ? 'true' : 'false'));
  }

  render(host, [
    stage,
    h('div.row.wrap.gap-2', null, [
      ...ads.map((ad, i) => h('button.chip', {
        type: 'button', text: ad.title || `#${i + 1}`,
        on: { click: () => goTo(i) },
      })),
      h('button.chip', {
        type: 'button', 'data-creator-only': '',
        on: { click: onManage },
      }, [icon('fa-solid fa-plus'), t('ad.manage')]),
      h('span.grow'),
      autoplaySwitch(() => startCarousel(goTo, ads.length), stopCarousel),
    ]),
  ]);

  stopCarousel();
  if (store.get().adAutoplay && ads.length > 1) startCarousel(goTo, ads.length);

  // Pause while the pointer rests on the stage, and while the tab is hidden.
  stage.addEventListener('pointerenter', stopCarousel);
  stage.addEventListener('pointerleave', () => {
    if (store.get().adAutoplay && ads.length > 1) startCarousel(goTo, ads.length);
  });
}

function autoplaySwitch(start, stop) {
  const input = h('input', {
    type: 'checkbox', checked: store.get().adAutoplay,
    on: {
      change: (e) => {
        store.set({ adAutoplay: e.target.checked });
        e.target.checked ? start() : stop();
      },
    },
  });
  return h('label.switch', null, [
    input, h('span.switch-track', { 'aria-hidden': 'true' }),
    h('span', { text: t('ads.autoplay'), style: 'font-size:.76rem;color:var(--fg-muted)' }),
  ]);
}

function startCarousel(goTo, count) {
  stopCarousel();
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
  carouselTimer = setInterval(() => {
    if (document.hidden) return;
    goTo(carouselIndex + 1);
  }, 6000);
  void count;
}

export function stopCarousel() {
  if (carouselTimer) { clearInterval(carouselTimer); carouselTimer = null; }
}

document.addEventListener('visibilitychange', () => { if (document.hidden) stopCarousel(); });

/* ================================================================ forms */

function formField({ label, name, type = 'text', placeholder, required, value = '', options, rows, hint, span }) {
  const id = `f-${name}-${++uid}`;
  const errorId = `${id}-err`;

  let control;
  if (options) {
    control = h('select.select', { id, name, required: required || null },
      options.map((o) => h('option', {
        value: o.value ?? o, text: o.label ?? o, selected: (o.value ?? o) === value,
      })));
  } else if (type === 'textarea') {
    control = h('textarea.textarea', {
      id, name, placeholder, required: required || null, rows: String(rows || 4), maxlength: '1200',
    }, value);
  } else {
    control = h('input.input', {
      id, name, type, placeholder, value, required: required || null,
      maxlength: '240', autocomplete: 'off',
    });
  }

  control.setAttribute('aria-describedby', errorId);

  return h(`div.field${span ? '.span-2' : ''}`, null, [
    h('label.label', { for: id, text: required ? `${label} *` : label }),
    control,
    hint ? h('span.text-faint', { text: hint, style: 'font-size:.7rem' }) : null,
    h('span.field-error', { id: errorId, role: 'alert', hidden: true }),
  ]);
}

/** Validate a form built from `formField`. Returns data or null. */
function readForm(formEl) {
  let ok = true;
  const data = {};

  formEl.querySelectorAll('input,select,textarea').forEach((el) => {
    if (!el.name) return;
    const value = String(el.value ?? '').trim();
    const errEl = formEl.querySelector(`#${el.id}-err`);
    const fail = (msg) => {
      ok = false;
      el.setAttribute('aria-invalid', 'true');
      if (errEl) { errEl.textContent = msg; errEl.hidden = false; }
    };

    el.removeAttribute('aria-invalid');
    if (errEl) { errEl.hidden = true; errEl.textContent = ''; }

    if (el.required && !value) { fail(t('common.required')); return; }
    if (el.type === 'url' && value && !safeUrl(value)) { fail(t('common.invalidUrl')); return; }

    data[el.name] = value;
  });

  return ok ? data : null;
}

/** Wrap fields in a <form> that validates before `onSubmit`. */
function formModal({ title, fields, submitLabel, onSubmit, extra }) {
  const form = h('form.form-grid', {
    novalidate: true,
    on: { submit: (e) => e.preventDefault() },
  }, fields);

  const body = extra ? h('div.stack.gap-5', null, [form, extra]) : form;

  modal({
    title, body,
    actions: [
      { label: t('common.cancel'), kind: 'btn-ghost' },
      {
        label: submitLabel, kind: 'btn-primary',
        onClick: (close) => {
          const data = readForm(form);
          if (!data) {
            form.querySelector('[aria-invalid="true"]')?.focus();
            return false; // keep the dialog open
          }
          onSubmit(data, close);
          return true;
        },
      },
    ],
  });

  return form;
}

/* ---------------------------------------------------------- pitch form */

export function openPitchForm() {
  const zone = h('button.dropzone', { type: 'button' }, [
    icon('fa-solid fa-video', 'big'),
    h('strong', { text: t('upload.record') }),
    h('span.text-faint', { text: t('upload.formats'), style: 'font-size:.74rem' }),
  ]);

  const bar = h('span.progress', { hidden: true }, h('i'));

  let busy = false;
  zone.addEventListener('click', () => {
    if (busy) return;
    busy = true;
    bar.hidden = false;
    render(zone, [
      icon('fa-solid fa-circle-notch', 'big fa-spin'),
      h('strong', { text: t('upload.processing') }),
    ]);

    let pct = 0;
    const tick = setInterval(() => {
      pct = Math.min(100, pct + 9 + Math.random() * 11);
      bar.firstElementChild.style.width = `${pct}%`;
      if (pct < 100) return;
      clearInterval(tick);
      zone.classList.add('is-done');
      render(zone, [
        icon('fa-solid fa-circle-check', 'big'),
        h('strong', { text: t('upload.done') }),
      ]);
      busy = false;
    }, 220);
  });

  formModal({
    title: t('upload.title'),
    submitLabel: t('common.save'),
    extra: h('div.stack.gap-2', null, [
      h('span.label', { text: t('upload.video') }), zone, bar,
    ]),
    fields: [
      formField({ label: t('upload.jobtitle'), name: 'role', placeholder: 'UX Designer', required: true }),
      formField({ label: t('upload.skills'), name: 'skills', placeholder: 'Figma, React, Agile' }),
      formField({ label: t('upload.bio'), name: 'bio', type: 'textarea', span: true, placeholder: t('upload.bio') }),
    ],
    onSubmit: () => toast(t('upload.saved'), t('upload.saved.desc'), 'success'),
  });
}

/* ---------------------------------------------------------- offer form */

export function openOfferForm(onCreated) {
  formModal({
    title: t('offer.title'),
    submitLabel: t('offer.publish'),
    fields: [
      formField({ label: t('offer.jobtitle'), name: 'title', required: true, placeholder: 'Marketing Manager' }),
      formField({ label: t('offer.company'), name: 'company', required: true, placeholder: 'GBAIRAI' }),
      formField({ label: t('offer.salary'), name: 'salary', placeholder: '45k - 55k €' }),
      formField({ label: t('offer.location'), name: 'location', required: true, placeholder: 'Abidjan' }),
      formField({ label: t('offer.contract'), name: 'contract', options: CONTRACTS, value: 'CDI' }),
      formField({ label: t('offer.skills'), name: 'skills', placeholder: 'React, Node, SQL' }),
      formField({ label: t('offer.desc'), name: 'description', type: 'textarea', span: true }),
    ],
    onSubmit: (data) => {
      onCreated?.(data);
      toast(t('offer.published'), t('offer.published.desc'), 'success');
    },
  });
}

/* ------------------------------------------------------------ ad form */

export function openAdsManager(onChange) {
  const list = h('div.stack.gap-2');

  function paint() {
    const ads = store.get().ads || [];
    render(list, ads.length
      ? ads.map((ad, i) => h('div.row.gap-3', {
          style: 'padding:10px 12px;background:var(--surface-2);border:1px solid var(--line);border-radius:var(--r-md)',
        }, [
          icon(ad.type === 'video' ? 'fa-solid fa-film' : 'fa-solid fa-image'),
          h('span.grow', { text: ad.title || `#${i + 1}`, style: 'font-size:.86rem;font-weight:600' }),
          h('button.icon-btn', {
            type: 'button', class: 'icon-btn-sm', style: 'color:var(--err-fg)',
            'aria-label': `${t('common.delete')} — ${ad.title || i + 1}`,
            on: {
              click: async () => {
                const ok = await confirm({
                  title: t('common.delete'), message: ad.title || '',
                  confirmLabel: t('common.delete'), danger: true,
                });
                if (!ok) return;
                const next = (store.get().ads || []).filter((x) => x.id !== ad.id);
                store.set({ ads: next });
                paint();
                onChange?.();
                toast(t('ads.removed'), '', 'info');
              },
            },
          }, icon('fa-solid fa-trash', 'fa-xs')),
        ]))
      : h('p.text-faint', { text: t('ads.none'), style: 'font-size:.82rem' }));
  }

  paint();

  formModal({
    title: t('ads.title'),
    submitLabel: t('ads.add'),
    extra: h('div.stack.gap-2', null, [
      h('h3', { text: t('ads.current'), style: 'font-size:.95rem' }), list,
    ]),
    fields: [
      formField({
        label: t('ads.type'), name: 'type', value: 'image',
        options: [{ value: 'image', label: t('ads.type.image') }, { value: 'video', label: t('ads.type.video') }],
      }),
      formField({ label: t('ads.kicker'), name: 'kicker', placeholder: t('ad.sponsored') }),
      formField({ label: t('ads.url'), name: 'url', type: 'url', required: true, placeholder: 'https://…', span: true }),
      formField({ label: t('ads.label'), name: 'title', required: true, placeholder: 'Concert Live 2026' }),
      formField({ label: t('ads.cta'), name: 'cta', placeholder: t('ad.manage') }),
      formField({ label: t('ads.link'), name: 'link', type: 'url', placeholder: 'https://…' }),
      formField({
        label: t('ads.extra'), name: 'extras', span: true,
        placeholder: 'Réserver|https://… ; Partager|https://…',
        hint: t('ads.extra.hint'),
      }),
    ],
    onSubmit: (data) => {
      const buttons = (data.extras || '')
        .split(';')
        .map((pair) => {
          const [label, link] = pair.split('|').map((x) => (x || '').trim());
          return label && safeUrl(link) ? { label, link: safeUrl(link) } : null;
        })
        .filter(Boolean);

      const ads = [...(store.get().ads || []), {
        id: nextId('a'),
        type: data.type === 'video' ? 'video' : 'image',
        url: safeUrl(data.url),
        title: data.title,
        kicker: data.kicker || t('ad.sponsored'),
        cta: data.cta || t('common.more'),
        link: safeUrl(data.link) || '',
        buttons,
      }];

      store.set({ ads });
      paint();
      onChange?.();
      toast(t('ads.added'), data.title, 'success');
    },
  });
}

/* --------------------------------------------------------- alert form */

export function openAlertsManager() {
  const list = h('div.stack.gap-2');

  function paint() {
    const { alerts } = store.get();
    render(list, alerts.length
      ? alerts.map((a) => h('div.row.gap-3', {
          style: 'padding:10px 12px;background:var(--surface-2);border:1px solid var(--line);border-radius:var(--r-md)',
        }, [
          icon('fa-solid fa-bell'),
          h('span.grow', null, [
            h('strong', { text: a.keyword, style: 'font-size:.86rem' }),
            a.location ? h('small.text-faint', { text: ` — ${a.location}`, style: 'font-size:.76rem' }) : null,
          ]),
          h('button.icon-btn', {
            type: 'button', class: 'icon-btn-sm', style: 'color:var(--err-fg)',
            'aria-label': `${t('common.delete')} — ${a.keyword}`,
            on: {
              click: () => {
                store.set({ alerts: store.get().alerts.filter((x) => x.id !== a.id) });
                paint();
                toast(t('alert.removed'), a.keyword, 'info');
              },
            },
          }, icon('fa-solid fa-trash', 'fa-xs')),
        ]))
      : h('p.text-faint', { text: t('alert.none'), style: 'font-size:.82rem' }));
  }

  paint();

  formModal({
    title: t('alert.title'),
    submitLabel: t('alert.create'),
    extra: h('div.stack.gap-2', null, [
      h('h3', { text: t('alert.list'), style: 'font-size:.95rem' }), list,
    ]),
    fields: [
      formField({ label: t('alert.keyword'), name: 'keyword', required: true, placeholder: 'React, SRE…' }),
      formField({ label: t('alert.location'), name: 'location', placeholder: 'Paris, Remote…' }),
    ],
    onSubmit: (data) => {
      const alerts = [...store.get().alerts, {
        id: nextId('al'), keyword: data.keyword, location: data.location || '', at: Date.now(),
      }];
      store.set({ alerts });
      paint();
      toast(t('alert.created'), t('alert.created.desc', { kw: data.keyword }), 'success');
    },
  });
}

/* ------------------------------------------------------- notifications */

export function openNotifications() {
  const { notifications } = store.get();

  modal({
    title: t('notifs.title'), small: true,
    body: notifications.length
      ? h('div.stack.gap-2', null, notifications.map((n) => h('div.row.gap-3', {
          style: 'padding:10px 0;border-bottom:1px solid var(--line)',
        }, [
          h('span.toast-ic.match', null, icon('fa-solid fa-fire')),
          h('div.grow', null, [
            h('strong', { text: n.title, style: 'font-size:.86rem' }),
            h('p.text-muted', { text: n.body, style: 'font-size:.78rem' }),
          ]),
        ])))
      : h('p.empty', { text: t('notifs.none') }),
    actions: notifications.length
      ? [{ label: t('notifs.read'), kind: 'btn-primary', onClick: () => store.set({ notifications: [] }) }]
      : [{ label: t('common.close'), kind: 'btn-ghost' }],
  });
}

export function pushNotification(title, body) {
  const notifications = [{ id: nextId('n'), title, body, at: Date.now() }, ...store.get().notifications].slice(0, 30);
  store.set({ notifications });
  const dot = $('#notif-dot');
  if (dot) dot.hidden = false;
}

export { LOCALES, debounce };
