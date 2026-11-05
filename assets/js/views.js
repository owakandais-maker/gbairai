/**
 * views.js — page renderers and the cards they are built from.
 * Every node comes from `h()`, so record text is never parsed as HTML.
 */

import { h, icon, render, safeUrl, countTo, observeReveals, paintImageFallback } from './dom.js';
import { t, num, ago, getLocale } from './i18n.js';
import * as store from './store.js';
import {
  JOBS, CANDIDATES, CONTRACTS, ME,
  scoreJobForMe, scoreMatch, bestJobFor, sharedSkills, norm,
} from './data.js';

/* ------------------------------------------------------------- helpers */

const salaryLabel = (job) => `${job.salaryMin}k–${job.salaryMax}k ${job.currency}`;

function initials(text) {
  return String(text || '?').trim().charAt(0).toUpperCase() || '?';
}

/** Lazy, non-blocking image with a stable box so cards never jump. */
function img(src, alt, { className = '', eager = false } = {}) {
  return h('img', {
    src, alt,
    class: className || null,
    loading: eager ? 'eager' : 'lazy',
    decoding: 'async',
    ...(eager ? { fetchpriority: 'high' } : {}),
    on: {
      error: (e) => paintImageFallback(e.currentTarget, alt || src),
    },
  });
}

function matchRing(value) {
  return h('div.match-ring', {
    style: { '--val': String(value) },
    role: 'img', 'aria-label': `${t('cand.match')} ${value}%`,
  }, h('span', { text: `${value}%` }));
}

function statTile({ label, value, trend, trendDir }) {
  return h('div.stat', null, [
    h('span.stat-label', { text: label }),
    h('span.stat-value', { text: value }),
    trend ? h('span', { class: `stat-trend ${trendDir || 'up'}`, text: trend }) : null,
  ]);
}

/* --------------------------------------------------------- job card */

export function jobCard(job, { onOpen, onToggleFav, isFav }) {
  const score = scoreJobForMe(job);
  const fav = isFav(job.id);

  const card = h('article.job-card', { 'data-reveal': '' }, [
    h('div.job-media', null, [
      img(job.image, '', { className: '' }),
      h('span.job-media-tag', { text: job.contract }),
      h('button.fav-btn', {
        type: 'button', dataset: { favFor: job.id },
        'aria-pressed': fav ? 'true' : 'false',
        'aria-label': fav ? t('job.fav.remove') : t('job.fav.add'),
        title: fav ? t('job.fav.remove') : t('job.fav.add'),
        on: {
          click: (e) => { e.stopPropagation(); onToggleFav(job.id); },
        },
      }, icon(fav ? 'fa-solid fa-heart' : 'fa-regular fa-heart')),
    ]),
    h('div.job-body', null, [
      h('div.job-title-row', null, [
        h('div.grow', null, [
          h('h3', { text: job.title }),
          h('p.job-company', null, [icon('fa-solid fa-building', 'fa-xs'), ' ', job.company]),
        ]),
        matchRing(score),
      ]),
      h('div.job-tags', null, job.tags.slice(0, 4).map((tag) => h('span.tag', { text: tag }))),
      h('div.job-meta', null, [
        h('span', null, [icon('fa-solid fa-wallet'), salaryLabel(job)]),
        h('span', null, [icon('fa-solid fa-location-dot'), job.location]),
        h('span', { style: 'margin-inline-start:auto', class: 'text-faint', text: ago(job.postedAt) }),
      ]),
      h('button.btn.btn-dark.btn-block', {
        type: 'button', text: t('job.details'),
        on: { click: () => onOpen(job.id) },
      }),
    ]),
  ]);

  // Whole-card activation, keyboard included, without nesting interactive elements.
  card.tabIndex = 0;
  card.setAttribute('role', 'link');
  card.setAttribute('aria-label', `${job.title} — ${job.company}`);
  card.addEventListener('click', (e) => {
    if (e.target.closest('button')) return;
    onOpen(job.id);
  });
  card.addEventListener('keydown', (e) => {
    if ((e.key === 'Enter' || e.key === ' ') && !e.target.closest('button')) {
      e.preventDefault();
      onOpen(job.id);
    }
  });

  return card;
}

/* --------------------------------------------------- candidate card */

export function candidateCard(cand, { onOpen, onPlay }) {
  const { score } = bestJobFor(cand);

  const card = h('article.cand-card', { 'data-reveal': '' }, [
    img(cand.cover, '', { className: 'cand-bg' }),
    h('div.cand-scrim'),
    h('div.cand-top', null, [
      h('span.cand-match', null, [icon('fa-solid fa-bolt'), `${score}%`]),
    ]),
    h('button.cand-play', {
      type: 'button', 'aria-label': `${t('cand.play')} — ${cand.name}`,
      on: { click: (e) => { e.stopPropagation(); onPlay(cand.id); } },
    }, icon('fa-solid fa-play')),
    h('div.cand-body', null, [
      h('div.cand-id', null, [
        img(cand.avatar, '', { className: 'avatar' }),
        h('div', null, [
          h('h3', { text: cand.name }),
          h('p', { text: `${cand.role} • ${cand.location}` }),
        ]),
      ]),
      h('div.cand-reveal', null, [
        h('div.row.wrap.gap-1', null, cand.tags.slice(0, 3).map((x) => h('span.tag-glass', { text: x }))),
        h('button.btn.btn-primary.btn-sm.btn-block', {
          type: 'button', text: t('cand.profile'),
          on: { click: () => onOpen(cand.id) },
        }),
      ]),
    ]),
  ]);

  card.querySelector('.avatar')?.style.setProperty('width', '38px');
  card.querySelector('.avatar')?.style.setProperty('height', '38px');
  card.querySelector('.avatar')?.style.setProperty('border', '2px solid #fff');

  card.tabIndex = 0;
  card.setAttribute('role', 'link');
  card.setAttribute('aria-label', `${cand.name} — ${cand.role}`);
  card.addEventListener('click', (e) => { if (!e.target.closest('button')) onOpen(cand.id); });
  card.addEventListener('keydown', (e) => {
    if ((e.key === 'Enter' || e.key === ' ') && !e.target.closest('button')) {
      e.preventDefault(); onOpen(cand.id);
    }
  });

  return card;
}

/* -------------------------------------------------------------- home */

export function homePage(actions) {
  const adSection = h('section.card.card-pad.adzone', { 'data-reveal': '', id: 'ad-zone' }, [
    h('div.section-head', null, [
      h('div', null, [
        h('h2', { text: t('ad.title') }),
        h('p', { text: t('ad.desc') }),
      ]),
      h('button.btn.btn-primary.btn-sm', {
        type: 'button', 'data-creator-only': '',
        on: { click: actions.openAds },
      }, [icon('fa-solid fa-sliders'), t('ad.manage')]),
    ]),
    h('div', { id: 'ad-stage-host' }),
  ]);

  const page = h('div.page.stack.gap-8', null, [
    h('section.hero', null, [
      h('div.hero-copy', null, [
        h('span.chip.chip-brand', { text: t('hero.badge') }),
        h('h1', null, [
          t('hero.title.a'), ' ',
          h('span.gradient-text', { text: t('hero.title.b') }), '.',
        ]),
        h('p.lead', { text: t('hero.lead') }),
        h('div.hero-cta'),
        h('div.hero-stats', null, [
          heroStat(JOBS.length * 37 + 118, t('hero.stat.jobs')),
          heroStat(CANDIDATES.length * 214 + 46, t('hero.stat.talents')),
          heroStat(94, t('hero.stat.match'), '%'),
        ]),
      ]),
      h('div.hero-visual', null, [
        h('div.hero-glow', { 'aria-hidden': 'true' }),
        h('div.hero-card', null, [
          img(ME.avatar, '', { eager: true }),
          h('div.hero-card-body', null, [
            h('h3', { text: 'Alice Martin' }),
            h('p', { text: 'Product Manager — Paris' }),
            h('button.btn.btn-on-dark.btn-block', {
              type: 'button',
              on: { click: () => actions.playVideo('Alice Martin', 'Product Manager — Paris') },
            }, [icon('fa-solid fa-play'), t('hero.watch')]),
          ]),
        ]),
      ]),
    ]),

    adSection,

    h('div.grid', { style: 'grid-template-columns:repeat(auto-fit,minmax(290px,1fr))', 'data-reveal': '' }, [
      h('div.card.card-pad', {
        style: 'background:linear-gradient(120deg,var(--brand-600),var(--accent-600));border:0;color:#fff',
      }, [
        h('h3', { text: t('home.ai.title'), style: 'font-size:1.15rem' }),
        h('p', { text: t('home.ai.desc'), style: 'opacity:.9;font-size:.88rem;margin:8px 0 16px' }),
        h('button.btn.btn-on-dark', { type: 'button', text: t('home.ai.cta'), on: { click: actions.openAI } }),
      ]),
      h('div.card.card-pad', null, [
        h('h3', { text: t('home.chat.title'), style: 'font-size:1.15rem' }),
        h('p.text-muted', { text: t('home.chat.desc'), style: 'font-size:.88rem;margin:8px 0 16px' }),
        h('button.btn.btn-primary', { type: 'button', text: t('home.chat.cta'), on: { click: actions.openChat } }),
      ]),
      h('div.card.card-pad', null, [
        h('h3', { text: t('seeker.reco'), style: 'font-size:1.15rem' }),
        h('p.text-muted', { text: t('ai.hint'), style: 'font-size:.88rem;margin:8px 0 16px' }),
        h('button.btn.btn-ghost', {
          type: 'button', text: t('hero.cta.seeker'),
          on: { click: () => actions.go('jobs') },
        }),
      ]),
    ]),
  ]);

  // The hero CTA row needs real handlers, so it is filled after construction.
  render(page.querySelector('.hero-cta'), [
    h('button.btn.btn-dark.btn-lg', {
      type: 'button', on: { click: () => actions.go('jobs') },
    }, [icon('fa-solid fa-magnifying-glass'), t('hero.cta.seeker')]),
    h('button.btn.btn-ghost.btn-lg', {
      type: 'button', on: { click: () => actions.go('recruit') },
    }, [icon('fa-solid fa-briefcase'), t('hero.cta.employer')]),
  ]);

  return page;
}

function heroStat(value, label, suffix = '') {
  const strong = h('strong', { text: '0' });
  const node = h('div.hero-stat', null, [strong, h('span', { text: label })]);
  requestAnimationFrame(() =>
    countTo(strong, value, { format: (v) => num(v) + suffix }));
  return node;
}

/* ------------------------------------------------------------ seeker */

export function seekerPage(actions) {
  const page = h('div.page.stack.gap-6');
  const f = store.get().filters;

  const countEl = h('span.result-count');
  const feed = h('div.grid.grid-cards', { id: 'job-feed', role: 'list' });
  const recoBox = h('div.stack.gap-2', { id: 'reco-box' });

  const apply = () => {
    const list = filterJobs();
    countEl.textContent = t('seeker.results', { n: list.length });
    renderJobFeed(feed, list, actions);
  };

  const onText = (key) => (e) => { f[key] = e.target.value; apply(); };

  render(page, [
    h('div.section-head', null, [
      h('div', null, [
        h('h1', { text: t('seeker.greeting', { name: ME.name }) }),
        h('p', { text: t('seeker.sub', { n: JOBS.length }) }),
      ]),
      h('div.row.gap-2', null, [
        h('button.btn.btn-ghost.btn-sm', {
          type: 'button', on: { click: actions.openAlerts },
        }, [icon('fa-solid fa-bell'), t('seeker.alert')]),
        h('button.btn.btn-grad.btn-sm', {
          type: 'button', on: { click: actions.openPitch },
        }, [icon('fa-solid fa-video'), t('seeker.pitch')]),
      ]),
    ]),

    h('div.filterbar', { role: 'search' }, [
      h('div.filter-row', null, [
        labelled(t('common.search'), h('div.input-icon', null, [
          icon('fa-solid fa-magnifying-glass'),
          h('input.input', {
            type: 'search', value: f.text, placeholder: t('seeker.search'),
            'aria-label': t('seeker.search'), on: { input: onText('text') },
          }),
        ])),
        labelled(t('job.location'), h('div.input-icon', null, [
          icon('fa-solid fa-location-dot'),
          h('input.input', {
            type: 'search', value: f.location, placeholder: t('seeker.location'),
            'aria-label': t('seeker.location'), on: { input: onText('location') },
          }),
        ])),
        labelled(t('offer.contract'), h('select.select', {
          'aria-label': t('offer.contract'),
          on: { change: (e) => { f.contract = e.target.value; apply(); } },
        }, [
          h('option', { value: 'all', text: t('common.all'), selected: f.contract === 'all' }),
          ...CONTRACTS.map((c) => h('option', { value: c, text: c, selected: f.contract === c })),
        ])),
        labelled(t('seeker.sort'), h('select.select', {
          'aria-label': t('seeker.sort'),
          on: { change: (e) => { f.sort = e.target.value; apply(); } },
        }, [
          ['match', 'sort.match'], ['recent', 'sort.recent'],
          ['salary', 'sort.salary'], ['az', 'sort.az'],
        ].map(([v, key]) => h('option', { value: v, text: t(key), selected: f.sort === v })))),
      ]),

      h('div.filter-row', { style: 'grid-template-columns:1fr' }, [
        labelled(
          `${t('seeker.salary')} — ${f.minSalary}k ${'€'}`,
          h('input.range', {
            type: 'range', min: '0', max: '100', step: '5', value: String(f.minSalary),
            'aria-label': t('seeker.salary'),
            on: {
              input: (e) => {
                f.minSalary = Number(e.target.value);
                e.target.closest('.field').querySelector('.label').textContent =
                  `${t('seeker.salary')} — ${f.minSalary}k €`;
                apply();
              },
            },
          })
        ),
      ]),

      h('div.filter-pills', null, [
        toggleChip(t('seeker.remote'), f.remote, (on) => { f.remote = on; apply(); }, 'fa-solid fa-house-laptop'),
        toggleChip(t('seeker.favonly'), f.favOnly, (on) => { f.favOnly = on; apply(); }, 'fa-solid fa-heart'),
        h('button.btn.btn-quiet.btn-sm', {
          type: 'button', on: { click: () => { resetFilters(); actions.go('jobs', { force: true }); } },
        }, [icon('fa-solid fa-rotate-left'), t('seeker.clear')]),
        h('span.grow'),
        countEl,
      ]),
    ]),

    feed,

    h('section.card.card-pad', { 'data-reveal': '' }, [
      h('div.section-head', null, [
        h('h2', { style: 'font-size:1.2rem' }, [
          icon('fa-solid fa-wand-magic-sparkles', 'gradient-text'), ' ', t('seeker.reco'),
        ]),
      ]),
      recoBox,
    ]),
  ]);

  apply();
  renderRecommendations(recoBox, actions);
  observeReveals(page);
  return page;
}

function labelled(label, control) {
  return h('div.field', null, [h('span.label', { text: label }), control]);
}

function toggleChip(label, on, onChange, iconName) {
  const btn = h('button.chip', {
    type: 'button', 'aria-pressed': on ? 'true' : 'false',
  }, [iconName ? icon(iconName) : null, label]);
  btn.addEventListener('click', () => {
    const next = btn.getAttribute('aria-pressed') !== 'true';
    btn.setAttribute('aria-pressed', next ? 'true' : 'false');
    onChange(next);
  });
  return btn;
}

export function resetFilters() {
  Object.assign(store.get().filters, {
    text: '', location: '', minSalary: 0, contract: 'all', remote: false, favOnly: false, sort: 'match',
  });
}

/** Apply the active filter set. Exported so the AI assistant can reuse it. */
export function filterJobs() {
  const { filters, favourites } = store.get();
  const needle = norm(filters.text);
  const place = norm(filters.location);

  let list = JOBS.filter((job) => {
    if (filters.favOnly && !favourites.includes(job.id)) return false;
    if (filters.remote && !job.remote) return false;
    if (filters.contract !== 'all' && job.contract !== filters.contract) return false;
    if (filters.minSalary && job.salaryMax < filters.minSalary) return false;

    if (place) {
      const remoteWord = /remote|teletravail|distancia|远程|عن بعد/.test(place);
      const matchPlace = norm(job.location).includes(place) || (remoteWord && job.remote);
      if (!matchPlace) return false;
    }

    if (needle) {
      const haystack = norm([job.title, job.company, job.location, job.contract, ...job.tags].join(' '));
      if (!haystack.includes(needle)) return false;
    }
    return true;
  });

  const sorters = {
    match:  (a, b) => scoreJobForMe(b) - scoreJobForMe(a),
    recent: (a, b) => b.postedAt - a.postedAt,
    salary: (a, b) => b.salaryMax - a.salaryMax,
    az:     (a, b) => a.title.localeCompare(b.title, getLocale()),
  };
  list = list.slice().sort(sorters[filters.sort] || sorters.match);
  return list;
}

function renderJobFeed(host, list, actions) {
  if (!list.length) {
    render(host, h('div.empty', { style: 'grid-column:1/-1' }, [
      icon('fa-regular fa-folder-open'),
      h('h3', { text: t('cmdk.none') }),
      h('p', { text: t('seeker.clear') }),
    ]));
    return;
  }
  render(host, list.map((job) =>
    h('div', { role: 'listitem' }, jobCard(job, {
      onOpen: actions.openJob,
      onToggleFav: actions.toggleFavourite,
      isFav: (id) => store.get().favourites.includes(id),
    }))));
  observeReveals(host);
}

export function renderRecommendations(host, actions) {
  const top = JOBS
    .map((job) => ({ job, score: scoreJobForMe(job) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  render(host, top.map(({ job, score }) => {
    const row = h('button.cmdk-item', { type: 'button', on: { click: () => actions.openJob(job.id) } }, [
      h('span.logo-sq', { style: { background: job.logoColor }, text: initials(job.company) }),
      h('span.grow', null, [
        h('strong', { text: job.title }),
        h('small', { text: `${job.company} • ${salaryLabel(job)} • ${job.location}` }),
      ]),
      h('span.chip.chip-ok', { text: `${score}%` }),
    ]);
    return row;
  }));
}

/* ---------------------------------------------------------- employer */

export function employerPage(actions) {
  const cf = store.get().candFilters;
  const feed = h('div.grid.grid-tiles', { id: 'cand-feed', role: 'list' });
  const countEl = h('span.result-count');

  const apply = () => {
    const list = filterCandidates();
    countEl.textContent = t('seeker.results', { n: list.length });
    render(feed, [
      h('div', { role: 'listitem' }, h('button.ghost-card', {
        type: 'button', on: { click: actions.openOffer },
      }, [
        h('span.orb', null, icon('fa-solid fa-plus')),
        h('h3', { text: t('employer.ghost.title') }),
        h('p', { style: 'font-size:.82rem;max-width:22ch', text: t('employer.ghost.desc') }),
      ])),
      ...list.map((c) => h('div', { role: 'listitem' }, candidateCard(c, {
        onOpen: actions.openCandidate,
        onPlay: actions.playCandidate,
      }))),
    ]);
    observeReveals(feed);
  };

  const page = h('div.page.stack.gap-6', null, [
    h('div.section-head', null, [
      h('div', null, [
        h('h1', { text: t('employer.greeting') }),
        h('p', { text: t('employer.sub') }),
      ]),
      h('button.btn.btn-primary.btn-sm', {
        type: 'button', on: { click: actions.openOffer },
      }, [icon('fa-solid fa-plus'), t('employer.offer')]),
    ]),

    h('div.grid.grid-stats', null, [
      statTile({ label: t('employer.kpi.talents'), value: num(CANDIDATES.length * 214 + 46), trend: '+12 %' }),
      statTile({ label: t('employer.kpi.match'), value: '94 %', trend: '+3 pts' }),
      statTile({ label: t('employer.kpi.posted'), value: num(JOBS.length), trend: '+2' }),
      statTile({ label: t('employer.kpi.views'), value: num(1480), trend: '+18 %' }),
    ]),

    h('div.filterbar', { role: 'search' }, [
      h('div.filter-row', null, [
        labelled(t('common.search'), h('div.input-icon', null, [
          icon('fa-solid fa-user'),
          h('input.input', {
            type: 'search', value: cf.text, placeholder: t('employer.search'),
            'aria-label': t('employer.search'),
            on: { input: (e) => { cf.text = e.target.value; apply(); } },
          }),
        ])),
        labelled(t('job.location'), h('div.input-icon', null, [
          icon('fa-solid fa-map-pin'),
          h('input.input', {
            type: 'search', value: cf.location, placeholder: t('employer.location'),
            'aria-label': t('employer.location'),
            on: { input: (e) => { cf.location = e.target.value; apply(); } },
          }),
        ])),
        h('div.field', null, [h('span.label', { text: ' ' }), h('div.row', null, countEl)]),
      ]),
    ]),

    feed,
  ]);

  apply();
  observeReveals(page);
  return page;
}

export function filterCandidates() {
  const { candFilters } = store.get();
  const needle = norm(candFilters.text);
  const place = norm(candFilters.location);

  return CANDIDATES.filter((c) => {
    if (place) {
      const remoteWord = /remote|teletravail|distancia|远程|عن بعد/.test(place);
      if (!norm(c.location).includes(place) && !(remoteWord && c.remote)) return false;
    }
    if (needle) {
      const haystack = norm([c.name, c.role, c.location, ...(c.skills || []), ...(c.tags || [])].join(' '));
      if (!haystack.includes(needle)) return false;
    }
    return true;
  }).sort((a, b) => bestJobFor(b).score - bestJobFor(a).score);
}

/* ------------------------------------------------------------ wallet */

export function walletPage(actions) {
  const { wallet, ads } = store.get();
  const topAd = ads?.[0];
  const bgUrl = topAd ? safeUrl(topAd.url) : null;

  const monthIn = wallet.transactions.filter((x) => x.amount > 0).reduce((a, b) => a + b.amount, 0);
  const monthOut = wallet.transactions.filter((x) => x.amount < 0).reduce((a, b) => a + Math.abs(b.amount), 0);

  const amountEl = h('span', { text: '0' });

  const page = h('div.page.stack.gap-6', null, [
    h('section.wallet-hero', null, [
      bgUrl && topAd.type === 'image' ? img(bgUrl, '', { className: 'bg' }) : null,
      h('div.veil', { 'aria-hidden': 'true' }),
      h('h1.wallet-eyebrow', { text: t('wallet.title'), style: 'font-size:.72rem' }),
      h('p.wallet-amount', null, [amountEl, ' ', h('small', { text: 'TARO' })]),
      h('p', { text: t('wallet.balance'), style: 'font-size:.78rem;opacity:.85' }),
      h('div.row.gap-2.wrap', { style: 'margin-top:12px' }, [
        h('button.btn.btn-on-dark.btn-sm', { type: 'button', on: { click: () => actions.walletAction('topup') } },
          [icon('fa-solid fa-plus'), t('wallet.topup')]),
        h('button.btn.btn-on-dark.btn-sm', { type: 'button', on: { click: () => actions.walletAction('send') } },
          [icon('fa-solid fa-paper-plane'), t('wallet.send')]),
        h('button.btn.btn-on-dark.btn-sm', { type: 'button', on: { click: () => actions.walletAction('tickets') } },
          [icon('fa-solid fa-ticket'), t('wallet.tickets')]),
      ]),
    ]),

    h('div.grid.grid-stats', null, [
      statTile({ label: t('wallet.in'), value: `+${num(monthIn)}`, trend: t('wallet.month'), trendDir: 'up' }),
      statTile({ label: t('wallet.out'), value: `−${num(monthOut)}`, trend: t('wallet.month'), trendDir: 'down' }),
      statTile({ label: t('wallet.pending'), value: num(0) }),
      statTile({ label: t('wallet.trend'), value: `${num(wallet.trend.at(-1))}` }),
    ]),

    h('section.card.card-pad', null, [
      h('h2', { text: t('wallet.trend'), style: 'font-size:1.1rem;margin-bottom:12px' }),
      sparkline(wallet.trend),
    ]),

    h('section.card.card-pad', null, [
      h('h2', { text: t('wallet.tx'), style: 'font-size:1.1rem;margin-bottom:8px' }),
      wallet.transactions.length
        ? h('div', null, wallet.transactions.map(txRow))
        : h('p.empty', { text: t('wallet.notx') }),
    ]),
  ]);

  requestAnimationFrame(() => countTo(amountEl, wallet.balance, { format: (v) => num(v) }));
  return page;
}

const TX_ICON = {
  salary: ['fa-solid fa-briefcase', 'ok'],
  ticket: ['fa-solid fa-ticket', 'hot'],
  bonus:  ['fa-solid fa-gift', 'brand'],
  course: ['fa-solid fa-graduation-cap', 'warn'],
};

function txRow(tx) {
  const [iconName] = TX_ICON[tx.kind] || ['fa-solid fa-receipt'];
  const inbound = tx.amount > 0;
  return h('div.tx', null, [
    h('span.tx-ic', {
      style: {
        background: inbound ? 'var(--ok-bg)' : 'var(--err-bg)',
        color: inbound ? 'var(--ok-fg)' : 'var(--err-fg)',
      },
    }, icon(iconName)),
    h('div.grow', null, [
      h('p', { text: tx.label, style: 'font-size:.88rem;font-weight:600' }),
      h('p.text-faint', { text: ago(tx.at), style: 'font-size:.74rem' }),
    ]),
    h('span', {
      class: `tx-amt ${inbound ? 'in' : 'out'}`,
      text: `${inbound ? '+' : '−'}${num(Math.abs(tx.amount))}`,
    }),
  ]);
}

/** Inline SVG sparkline — no chart library, works offline, theme-aware. */
function sparkline(series) {
  const W = 600, H = 62, pad = 2;
  const min = Math.min(...series), max = Math.max(...series);
  const span = max - min || 1;
  const pts = series.map((v, i) => {
    const x = pad + (i / (series.length - 1)) * (W - pad * 2);
    const y = H - pad - ((v - min) / span) * (H - pad * 2);
    return [Number(x.toFixed(2)), Number(y.toFixed(2))];
  });

  const line = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x} ${y}`).join(' ');
  const area = `${line} L${pts.at(-1)[0]} ${H} L${pts[0][0]} ${H} Z`;

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.setAttribute('class', 'spark');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', `${t('wallet.trend')}: ${num(min)} → ${num(max)} TARO`);
  svg.setAttribute('preserveAspectRatio', 'none');
  svg.innerHTML =
    `<defs><linearGradient id="sparkFill" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0%" stop-color="var(--brand-500)" stop-opacity=".34"/>` +
    `<stop offset="100%" stop-color="var(--brand-500)" stop-opacity="0"/>` +
    `</linearGradient></defs>` +
    `<path d="${area}" fill="url(#sparkFill)"/>` +
    `<path d="${line}" fill="none" stroke="var(--brand-600)" stroke-width="2" ` +
    `stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>`;
  return svg;
}

/* ------------------------------------------------------------ studio */

export function studioPage(actions) {
  const { ads, liveOn } = store.get();
  const topAd = ads?.[0];
  const bgUrl = topAd && topAd.type === 'image' ? safeUrl(topAd.url) : null;

  const liveBtn = h('button.btn.btn-lg', {
    type: 'button',
    class: liveOn ? 'btn-danger' : 'btn-primary',
    style: liveOn ? '' : 'background:var(--err-solid);color:#fff',
    on: {
      click: () => { actions.toggleLive(); actions.go('studio', { force: true }); },
    },
  }, [icon(liveOn ? 'fa-solid fa-stop' : 'fa-solid fa-tower-broadcast'),
      liveOn ? t('studio.stop') : t('studio.start')]);

  const features = [
    ['studio.f1', 'fa-solid fa-layer-group'], ['studio.f2', 'fa-solid fa-sliders'],
    ['studio.f3', 'fa-solid fa-tower-broadcast'], ['studio.f4', 'fa-solid fa-users'],
    ['studio.f5', 'fa-solid fa-record-vinyl'], ['studio.f6', 'fa-solid fa-closed-captioning'],
  ];

  return h('div.page.stack.gap-6', null, [
    h('section.studio-hero', null, [
      bgUrl ? img(bgUrl, '', { className: 'bg' }) : null,
      h('div.veil', { 'aria-hidden': 'true' }),
      liveOn
        ? h('span.live-pill', null, [h('span.pulse'), 'LIVE'])
        : h('span.chip', { text: t('studio.scenes'), style: 'background:rgba(255,255,255,.16);color:#fff;border-color:transparent' }),
      h('h1', { text: t('studio.title') }),
      h('p', { text: t('studio.desc') }),
      h('div.row.gap-3.wrap.center', null, [
        liveBtn,
        h('button.btn.btn-on-dark.btn-lg', { type: 'button', text: t('studio.scenes') }),
      ]),
    ]),

    liveOn
      ? h('div.grid.grid-stats', null, [
          statTile({ label: t('studio.viewers'), value: num(1284), trend: '+128/min' }),
          statTile({ label: t('studio.bitrate'), value: '8 400 kbps' }),
          statTile({ label: t('studio.uptime'), value: '00:14:22' }),
          h('div.stat', null, [
            h('span.stat-label', { text: t('studio.monitor') }),
            h('div.meter', { 'aria-hidden': 'true' },
              Array.from({ length: 14 }, () => h('i'))),
          ]),
        ])
      : null,

    h('div.grid.grid-cards', null, features.map(([key, iconName]) =>
      h('div.feature', { 'data-reveal': '' }, [
        h('span.ic', null, icon(iconName)),
        h('h3', { text: t(`${key}.t`) }),
        h('p', { text: t(`${key}.d`) }),
      ]))),
  ]);
}

/* ------------------------------------------- detail drawer contents */

export function jobDrawer(job, { close, titleId }, actions) {
  const score = scoreJobForMe(job);
  const shared = sharedSkills(ME, job);
  const fav = store.get().favourites.includes(job.id);

  const favBtn = h('button.btn.btn-ghost', {
    type: 'button', 'aria-pressed': fav ? 'true' : 'false',
    on: {
      click: (e) => {
        actions.toggleFavourite(job.id);
        const on = store.get().favourites.includes(job.id);
        e.currentTarget.setAttribute('aria-pressed', on ? 'true' : 'false');
        render(e.currentTarget, [
          icon(on ? 'fa-solid fa-heart' : 'fa-regular fa-heart'),
          on ? t('job.fav.remove') : t('job.fav.add'),
        ]);
      },
    },
  }, [icon(fav ? 'fa-solid fa-heart' : 'fa-regular fa-heart'), fav ? t('job.fav.remove') : t('job.fav.add')]);

  return [
    h('div.drawer-hero', null, [
      img(job.image, '', { eager: true }),
      h('div.scrim', { 'aria-hidden': 'true' }),
      h('div.drawer-hero-body', null, [
        h('span.logo-sq', {
          style: { background: job.logoColor, width: '52px', height: '52px', 'font-size': '1.4rem' },
          text: initials(job.company),
        }),
        h('div', null, [
          h('h2', { id: titleId, text: job.title }),
          h('p', { text: `${job.company} • ${job.location}` }),
        ]),
      ]),
    ]),

    h('div.drawer-body.scroll-y', null, [
      h('dl.kv-grid', null, [
        kv(t('job.salary'), salaryLabel(job)),
        kv(t('job.location'), job.remote ? `${job.location} • Remote` : job.location),
        kv(t('job.contract'), job.contract),
        kv(t('job.posted'), ago(job.postedAt)),
      ]),

      h('div.card.card-pad', { style: 'display:flex;gap:16px;align-items:center' }, [
        matchRing(score),
        h('div.grow', null, [
          h('p', { text: t('match.why'), style: 'font-weight:700;font-size:.9rem' }),
          h('p.text-muted', {
            style: 'font-size:.82rem',
            text: shared.length
              ? shared.join(' · ')
              : `${ME.years} ${t('cand.exp').toLowerCase()} • ${ME.location}`,
          }),
        ]),
      ]),

      h('div.prose', null, [
        h('h3', { text: t('job.about') }),
        h('p', { text: job.description }),
      ]),

      job.about ? h('div.prose', null, [
        h('h3', { text: t('job.company') }),
        h('p.quote', { text: job.about }),
      ]) : null,

      h('div', null, [
        h('h3', { text: t('job.skills'), style: 'font-size:1.05rem;margin-bottom:12px' }),
        h('div.row.wrap.gap-2', null, job.tags.map((x) => h('span.chip.chip-brand', { text: x }))),
      ]),

      job.perks?.length ? h('div', null, [
        h('h3', { text: t('job.perks'), style: 'font-size:1.05rem;margin-bottom:12px' }),
        h('div.row.wrap.gap-2', null, job.perks.map((x) =>
          h('span.chip.chip-ok', null, [icon('fa-solid fa-check'), x]))),
      ]) : null,

      commentsBlock(`job:${job.id}`, actions),
    ]),

    h('div.drawer-foot', null, [
      favBtn,
      h('button.btn.btn-dark.grow', {
        type: 'button',
        on: { click: () => { actions.applyToJob(job); close(); } },
      }, [t('job.apply'), icon('fa-solid fa-paper-plane')]),
    ]),
  ];
}

export function candidateDrawer(cand, { close, titleId }, actions) {
  const { job, score } = bestJobFor(cand);
  const saved = store.get().savedCandidates.includes(cand.id);

  return [
    h('div.drawer-hero', null, [
      img(cand.cover, '', { eager: true }),
      h('div.scrim', { 'aria-hidden': 'true' }),
      h('div.drawer-hero-body', null, [
        img(cand.avatar, '', { className: 'avatar' }),
        h('div', null, [
          h('h2', { id: titleId, text: cand.name }),
          h('p', { text: `${cand.role} • ${cand.location}` }),
        ]),
      ]),
    ]),

    h('div.drawer-body.scroll-y', null, [
      h('dl.kv-grid', null, [
        kv(t('cand.exp'), `${cand.years} ${getLocale() === 'fr' ? 'ans' : ''}`.trim()),
        kv(t('cand.edu'), cand.education),
        kv(t('cand.avail'), cand.availability),
        kv(t('cand.match'), `${score}%`),
      ]),

      job ? h('div.card.card-pad', null, [
        h('p', { text: t('match.why'), style: 'font-weight:700;font-size:.9rem;margin-bottom:6px' }),
        h('p.text-muted', {
          style: 'font-size:.84rem',
          text: `${job.title} — ${job.company} · ${sharedSkills(cand, job).join(' · ') || cand.role}`,
        }),
      ]) : null,

      h('div.prose', null, [
        h('h3', { text: t('cand.bio') }),
        h('p.quote', { text: cand.bio }),
      ]),

      h('div', null, [
        h('h3', { text: t('cand.skills'), style: 'font-size:1.05rem;margin-bottom:12px' }),
        h('div.row.wrap.gap-2', null, (cand.skills || []).map((x) => h('span.chip.chip-brand', { text: x }))),
      ]),

      h('div', null, [
        h('h3', { text: t('cand.langs'), style: 'font-size:1.05rem;margin-bottom:12px' }),
        h('div.row.wrap.gap-2', null, (cand.languages || []).map((x) => h('span.chip', { text: x }))),
      ]),

      h('button.btn.btn-ghost.btn-block', {
        type: 'button', on: { click: () => actions.playCandidate(cand.id) },
      }, [icon('fa-solid fa-play'), t('cand.play')]),

      commentsBlock(`cand:${cand.id}`, actions),
    ]),

    h('div.drawer-foot', null, [
      h('button.btn.btn-ghost', {
        type: 'button', 'aria-pressed': saved ? 'true' : 'false',
        on: {
          click: (e) => {
            const on = actions.toggleSavedCandidate(cand.id);
            e.currentTarget.setAttribute('aria-pressed', on ? 'true' : 'false');
          },
        },
      }, [icon('fa-regular fa-bookmark'), t('cand.save')]),
      h('button.btn.btn-primary.grow', {
        type: 'button',
        on: { click: () => { actions.contactCandidate(cand); close(); } },
      }, [t('cand.contact'), icon('fa-solid fa-paper-plane')]),
    ]),
  ];
}

function kv(label, value) {
  return h('div.kv', null, [h('dt', { text: label }), h('dd', { text: String(value ?? '—') })]);
}

/* -------------------------------------------------------- comments */

export function commentsBlock(key, actions) {
  const list = h('div.stack.gap-2');
  const input = h('input.input', {
    type: 'text', placeholder: t('comments.add'), 'aria-label': t('comments.add'),
    maxlength: '500',
    on: {
      keydown: (e) => { if (e.key === 'Enter') { e.preventDefault(); submit(); } },
    },
  });

  function paint() { render(list, commentRows(key, paint)); }

  function submit() {
    const text = input.value.trim();
    if (!text) return;
    actions.addComment(key, text);
    input.value = '';
    paint();
  }

  paint();

  return h('section', null, [
    h('h3', { style: 'font-size:1.05rem;margin-bottom:12px' }, [
      icon('fa-regular fa-comments'), ' ', t('comments.title'),
    ]),
    list,
    h('div.row.gap-2', { style: 'margin-top:12px' }, [
      input,
      h('button.btn.btn-primary', { type: 'button', text: t('comments.post'), on: { click: submit } }),
    ]),
  ]);
}

function commentRows(key, repaint) {
  const all = store.get().comments[key] || [];
  if (!all.length) return h('p.text-faint', { text: t('comments.none'), style: 'font-size:.82rem' });

  return all.map((c) => h('div.card', { style: 'padding:12px 14px' }, [
    h('div.row.between.gap-2', null, [
      h('strong', { text: c.author, style: 'font-size:.78rem;color:var(--brand-600)' }),
      h('span.text-faint', { text: ago(c.at), style: 'font-size:.68rem' }),
      h('button.icon-btn', {
        type: 'button', class: 'icon-btn-sm',
        'aria-label': t('comments.translate'), title: t('comments.translate'),
        on: {
          click: () => {
            c.shownLocale = c.shownLocale === getLocale() ? null : getLocale();
            store.touch('comments');
            repaint();
          },
        },
      }, icon('fa-solid fa-language', 'fa-xs')),
    ]),
    h('p', { text: c.text, style: 'font-size:.86rem;margin-top:4px' }),
    c.shownLocale
      ? h('p.text-faint', {
          style: 'font-size:.74rem;margin-top:6px;padding-top:6px;border-top:1px dashed var(--line)',
          text: `[${c.shownLocale.toUpperCase()}] ${c.text}`,
        })
      : null,
  ]));
}

export { salaryLabel, initials, img, statTile, labelled };

/**
 * Update every visible favourite button without re-rendering the page, so the
 * scroll position, focus and filter inputs survive a heart click.
 * Returns true when a full feed repaint is still needed (favourites-only view).
 */
export function refreshFavouriteButtons() {
  const { favourites, filters } = store.get();
  document.querySelectorAll('[data-fav-for]').forEach((btn) => {
    const on = favourites.includes(btn.dataset.favFor);
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    btn.setAttribute('aria-label', on ? t('job.fav.remove') : t('job.fav.add'));
    btn.title = btn.getAttribute('aria-label');
    render(btn, icon(on ? 'fa-solid fa-heart' : 'fa-regular fa-heart'));
  });
  return Boolean(filters.favOnly);
}
