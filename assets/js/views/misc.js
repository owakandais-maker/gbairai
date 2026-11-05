/* ==========================================================================
   misc.js — portefeuille, emploi, groupes, évènements, notifications,
   enregistrements, recherche globale, explorer, publication détaillée
   Chaque vue a sa flèche de retour, son moteur de recherche cloisonné, et
   occupe toute la largeur : le rail des tendances reste sur l'accueil.
   ========================================================================== */

import { h, mount, clear, uid } from '../core/dom.js';
import { icon, iconFilled } from '../core/icons.js';
import { t, money, nfmt, ago, dateFmt } from '../core/i18n.js';
import * as store from '../core/store.js';
import * as router from '../core/router.js';
import * as searchEngine from '../core/search.js';
import { toast, avatar, empty, sheet, modal, confirm, menu, searchbox, img as safeImg, switchCtl, kpi, copyLink } from '../core/ui.js';
import { viewHead, postCard, scopedSearch, shareSheet, billboard } from '../features/parts.js';
import { posterFor, demoRef } from '../data/demoMedia.js';
import * as agent from '../features/agent.js';

/* ============================== portefeuille ========================== */

export function renderWallet(ctx, host) {
  const me = store.me();
  const txs = (store.data().transactions || []).slice().sort((a, b) => b.at - a.at);
  const held = txs.filter((x) => x.held).reduce((n, x) => n + Math.abs(x.amount), 0);

  mount(host, h('div.stack.gap-4',
    viewHead({ title: t('wallet.title'), scope: 'wallet' }),
    h('div.wallet-card',
      h('div.lb', t('wallet.balance')),
      h('div.bal', nfmt(me.taro || 0) + ' TARO'),
      h('div.row.gap-2', { style: { 'margin-top': '10px' } },
        h('button.btn.sm', { type: 'button', style: { background: 'rgba(0,0,0,.18)', color: '#06080f', border: '0' }, onclick: () => topUp() }, icon('plus'), t('wallet.topup')),
        h('button.btn.sm', { type: 'button', style: { background: 'rgba(0,0,0,.18)', color: '#06080f', border: '0' }, onclick: () => sendTaro() }, icon('send'), t('wallet.send')),
      ),
    ),
    h('div.grid-auto',
      kpi(nfmt(held), t('wallet.escrowHeld')),
      kpi(nfmt(txs.filter((x) => x.dir === 'in').reduce((n, x) => n + x.amount, 0)), t('notif.gift')),
      kpi(String(txs.length), t('wallet.history')),
    ),
    h('div.card.pad.stack.gap-2',
      h('h3', t('wallet.history')),
      txs.length
        ? h('div.stack', txs.map((x) => h('div.tx',
          h('span.ic-w', icon(x.dir === 'in' ? 'download' : 'upload')),
          h('div.stack.grow', h('span.sm.b', x.label), h('span.xs.mut-3', (x.kind || '') + ' · ' + ago(x.at))),
          h('span.amt', { class: x.dir === 'in' ? 'in' : 'out' }, (x.dir === 'in' ? '+' : '') + nfmt(x.amount) + ' TARO'),
        )))
        : empty('coin', t('wallet.empty')),
    ),
  ));
  return {};
}

function topUp() {
  const amounts = [5000, 10000, 25000, 50000];
  const m = sheet({
    title: t('wallet.topup'),
    size: 'slim',
    body: h('div.grid-auto', amounts.map((a) => h('button.card.pad.hover', {
      type: 'button', style: { display: 'grid', 'justify-items': 'center', gap: '5px' },
      onclick: () => {
        const me = store.me();
        store.update('users', me.id, { taro: (me.taro || 0) + a });
        store.add('transactions', { id: uid('tx'), at: Date.now(), label: t('wallet.topup'), kind: 'recharge', amount: a, dir: 'in' });
        toast(t('toast.saved'), 'ok');
        m.close();
        router.render();
      },
    }, icon('coin'), h('span.b', nfmt(a)), h('span.xs.mut-3', 'TARO')))),
  });
}

function sendTaro() {
  const users = store.data().users.filter((u) => u.id !== store.session().meId);
  const sel = h('select.select', users.map((u) => h('option', { value: u.id }, u.name + ' (@' + u.handle + ')')));
  const amt = h('input.input', { type: 'number', value: '1000', min: '100', step: '100' });
  const m = sheet({
    title: t('wallet.send'),
    size: 'slim',
    body: h('div.stack.gap-3',
      h('div.field', h('label', t('search.people')), sel),
      h('div.field', h('label', t('owner.price')), amt),
      h('p.xs.mut-3', t('wallet.balance') + ' : ' + nfmt(store.me().taro || 0) + ' TARO'),
    ),
    foot: [
      h('button.btn.ghost', { type: 'button', onclick: () => m.close() }, t('a.cancel')),
      h('button.btn.primary', {
        type: 'button',
        onclick: () => {
          const me = store.me();
          const v = Number(amt.value) || 0;
          if (v <= 0 || (me.taro || 0) < v) { toast(t('toast.notAllowed'), 'bad'); return; }
          const to = store.user(sel.value);
          store.update('users', me.id, { taro: (me.taro || 0) - v });
          if (to) store.update('users', to.id, { taro: (to.taro || 0) + v });
          store.add('transactions', { id: uid('tx'), at: Date.now(), label: t('wallet.send') + ' → @' + (to ? to.handle : ''), kind: 'transfert', amount: -v, dir: 'out' });
          toast(t('toast.saved'), 'ok');
          m.close();
          router.render();
        },
      }, icon('send'), t('wallet.send')),
    ],
  });
}

/* ================================ emploi =============================== */

export function renderJobs(ctx, host) {
  const jobs = (store.data().jobs || []).slice().sort((a, b) => (b.match || 0) - (a.match || 0));
  const apps = new Set((store.data().applications || []).map((a) => a.jobId));

  if (ctx.query.id) {
    const j = store.byId('jobs', ctx.query.id);
    if (j) { mount(host, h('div.stack.gap-4', viewHead({ title: j.title, scope: 'jobs' }), jobDetail(j, apps))); return {}; }
  }

  mount(host, h('div.stack.gap-4',
    viewHead({
      title: t('jobs.title'),
      scope: 'jobs',
      tools: [h('button.icon-btn', { type: 'button', 'aria-label': t('jobs.post'), onclick: () => postJob() }, icon('plus'))],
    }),
    h('div.grid-2', jobs.length ? jobs.map((j) => jobCard(j, apps)) : empty('brief', t('empty.generic'))),
  ));
  return {};
}

function jobCard(j, apps) {
  const applied = apps.has(j.id);
  return h('article.card.jcard.hover',
    h('div.row.gap-3',
      h('span.match', { style: { '--p': String(j.match || 0) } }, h('span', (j.match || 0) + '%')),
      h('div.stack.grow',
        h('a.b', { href: '#/jobs?id=' + j.id }, j.title),
        h('span.xs.mut-3', j.company + ' · ' + j.city + ' · ' + j.type),
      ),
    ),
    h('p.sm.mut.clamp-2', j.desc || ''),
    h('div.mt', (j.skills || []).map((s) => h('span.chip', s))),
    h('div.row.between.xs.mut-3', h('span', j.salary || ''), h('span', ago(j.at))),
    h('div.row.wrap.gap-2',
      applied
        ? h('span.chip.ok', icon('check'), t('jobs.applied'))
        : h('button.btn.sm.primary', { type: 'button', onclick: () => applyJob(j) }, icon('send'), t('jobs.apply')),
      h('button.btn.sm.ghost', { type: 'button', onclick: () => letterSheet(j) }, icon('edit'), t('jobs.letter')),
      h('button.btn.sm.ghost', { type: 'button', onclick: () => coachSheet(j) }, icon('bot'), t('jobs.coach')),
    ),
  );
}

function jobDetail(j, apps) {
  return h('div.stack.gap-4',
    h('div.card.pad.stack.gap-3',
      h('div.row.gap-3', h('span.match', { style: { '--p': String(j.match || 0) } }, h('span', (j.match || 0) + '%')),
        h('div.stack.grow', h('h2', j.title), h('span.sm.mut', j.company + ' · ' + j.city + ' · ' + j.type))),
      h('p.sm', j.desc || ''),
      h('div.row.wrap.gap-2', (j.skills || []).map((s) => h('span.chip', icon('check'), s))),
      h('div.set-grp',
        h('div.set-row', h('div.t', h('div.n', t('jobs.salary'))), h('div.ctl', h('span.sm', j.salary || '—'))),
        h('div.set-row', h('div.t', h('div.n', t('jobs.match'))), h('div.ctl', h('span.sm', (j.match || 0) + '%'))),
      ),
      h('div.row.wrap.gap-2',
        apps.has(j.id)
          ? h('span.chip.ok', icon('check'), t('jobs.applied'))
          : h('button.btn.primary', { type: 'button', onclick: () => applyJob(j) }, icon('send'), t('jobs.apply')),
        h('button.btn.soft', { type: 'button', onclick: () => letterSheet(j) }, icon('edit'), t('jobs.letter')),
        h('button.btn.ghost', { type: 'button', onclick: () => coachSheet(j) }, icon('bot'), t('jobs.coach')),
        h('button.btn.ghost', { type: 'button', onclick: () => copyLink('#/jobs?id=' + j.id) }, icon('link'), t('a.copy')),
      ),
    ),
  );
}

function applyJob(j) {
  store.add('applications', { id: uid('ap'), jobId: j.id, userId: store.session().meId, at: Date.now(), status: 'envoyée' });
  store.add('notifications', { id: uid('n'), kind: 'order', userId: store.session().meId, at: Date.now(), text: t('jobs.applied') + ' · ' + j.title, hash: '#/jobs?id=' + j.id, read: false });
  toast(t('jobs.applied'), 'ok');
  router.render();
}

function letterSheet(j) {
  const me = store.me();
  const text = [
    'Madame, Monsieur,', '',
    'Le poste de ' + j.title + ' chez ' + j.company + ' correspond précisément à ce que je construis depuis '
    + 'plusieurs années : ' + (me.bio || 'un travail soigné, livré dans les délais') + '.', '',
    'Mes points d\'appui pour ce poste : ' + (j.skills || []).join(', ') + '.', '',
    'Je suis disponible pour un entretien à votre convenance, à ' + (j.city || me.city || 'Abidjan') + ' ou à distance.', '',
    'Cordialement,', me.name,
  ].join('\n');
  const ta = h('textarea.textarea', { style: { 'min-height': '260px' } });
  ta.value = text;
  const m = sheet({
    title: t('jobs.letter'),
    size: 'wide',
    body: h('div.stack.gap-3', ta, h('p.xs.mut-3', agent.agentName() + ' · ' + t('agent.sub'))),
    foot: [
      h('button.btn.ghost', { type: 'button', onclick: () => m.close() }, t('a.cancel')),
      h('button.btn.soft', { type: 'button', onclick: () => { copyLink('#/jobs?id=' + j.id); } }, icon('copy'), t('a.copy')),
      h('button.btn.primary', {
        type: 'button',
        onclick: () => {
          const blob = new Blob([ta.value], { type: 'text/plain;charset=utf-8' });
          const url = URL.createObjectURL(blob);
          const a = h('a', { href: url, download: 'lettre-' + j.company.toLowerCase().replace(/\s+/g, '-') + '.txt' });
          document.body.appendChild(a); a.click(); a.remove();
          setTimeout(() => URL.revokeObjectURL(url), 3000);
          toast(t('toast.downloaded'), 'ok');
          m.close();
        },
      }, icon('download'), t('a.download')),
    ],
  });
}

function coachSheet(j) {
  const qs = [
    'Présentez-vous en une minute, sans réciter votre CV.',
    'Pourquoi ' + j.company + ' et pourquoi maintenant ?',
    'Racontez un projet où tout a failli échouer. Qu\'avez-vous changé ?',
    'Comment mesurez-vous la réussite sur un poste de ' + j.title + ' ?',
    'Quelle est votre prétention salariale et sur quoi l\'appuyez-vous ?',
  ];
  sheet({
    title: t('jobs.coach') + ' · ' + j.title,
    body: h('div.stack.gap-3', qs.map((q, i) => h('div.card.pad.stack.gap-2',
      h('span.xs.mut-3', 'Question ' + (i + 1)),
      h('p.sm.b', q),
      h('textarea.textarea', { placeholder: t('feed.addComment') }),
    ))),
  });
}

function postJob() {
  const titleIn = h('input.input', { type: 'text', maxlength: 80 });
  const compIn = h('input.input', { type: 'text', maxlength: 60 });
  const cityIn = h('input.input', { type: 'text', maxlength: 40 });
  const salIn = h('input.input', { type: 'text', maxlength: 60 });
  const descIn = h('textarea.textarea');
  const skillsIn = h('input.input', { type: 'text', placeholder: 'JavaScript, CSS, Montage' });
  const m = sheet({
    title: t('jobs.post'),
    body: h('div.stack.gap-3',
      h('div.field', h('label', t('profile.name')), titleIn),
      h('div.grid-2', h('div.field', h('label', 'Entreprise'), compIn), h('div.field', h('label', t('profile.city')), cityIn)),
      h('div.field', h('label', t('jobs.salary')), salIn),
      h('div.field', h('label', 'Compétences'), skillsIn),
      h('div.field', h('label', t('profile.bio')), descIn),
    ),
    foot: [
      h('button.btn.ghost', { type: 'button', onclick: () => m.close() }, t('a.cancel')),
      h('button.btn.primary', {
        type: 'button',
        onclick: () => {
          if (!titleIn.value.trim()) { toast(t('toast.nothing'), 'bad'); return; }
          store.add('jobs', {
            id: uid('j'), userId: store.session().meId, title: titleIn.value.trim(),
            company: compIn.value.trim() || store.me().name, city: cityIn.value.trim() || 'Abidjan',
            type: 'CDI', salary: salIn.value.trim(), desc: descIn.value.trim(),
            skills: skillsIn.value.split(',').map((s) => s.trim()).filter(Boolean),
            at: Date.now(), match: 70,
          });
          toast(t('toast.saved'), 'ok');
          m.close();
          router.render();
        },
      }, icon('check'), t('a.publish')),
    ],
  });
}

/* ================================ groupes ============================== */

export function renderGroups(ctx, host) {
  const groups = store.data().groups || [];
  mount(host, h('div.stack.gap-4',
    viewHead({
      title: t('groups.title'), scope: 'groups',
      tools: [h('button.icon-btn', { type: 'button', 'aria-label': t('groups.create'), onclick: () => createGroup() }, icon('plus'))],
    }),
    h('div.grid-2', groups.length ? groups.map((g) => h('article.card.gcard.hover',
      h('div.cv'),
      h('div.bd',
        h('div.row.gap-2',
          h('span.av.av-48.sq', { style: { display: 'grid', 'place-items': 'center', background: 'var(--surface-3)' } }, icon('users')),
          h('div.stack.grow', h('span.b.trunc', g.name), h('span.xs.mut-3', nfmt(g.members || 0) + ' ' + t('groups.members'))),
        ),
        h('p.sm.mut.clamp-2', g.desc || ''),
        h('div.row.wrap.gap-2',
          g.topic ? h('span.chip', g.topic) : null,
          g.private ? h('span.chip', icon('lock'), 'Privé') : null,
        ),
        h('div.row.wrap.gap-2',
          g.joined
            ? h('button.btn.sm.ghost', {
              type: 'button',
              onclick: () => { store.update('groups', g.id, { joined: false, members: Math.max(0, (g.members || 1) - 1) }); router.render(); },
            }, icon('check'), t('groups.joined'))
            : h('button.btn.sm.primary', {
              type: 'button',
              onclick: () => { store.update('groups', g.id, { joined: true, members: (g.members || 0) + 1 }); toast(t('groups.joined'), 'ok'); router.render(); },
            }, icon('userPlus'), t('groups.join')),
          h('button.btn.sm.ghost', { type: 'button', onclick: () => shareSheet({ kind: 'group', id: g.id, title: g.name }) }, icon('share')),
        ),
      ),
    )) : empty('users', t('empty.generic'))),
  ));
  return {};
}

function createGroup() {
  const nameIn = h('input.input', { type: 'text', maxlength: 60 });
  const topicIn = h('input.input', { type: 'text', maxlength: 40 });
  const descIn = h('textarea.textarea');
  const privIn = h('input', { type: 'checkbox' });
  const m = sheet({
    title: t('groups.create'),
    body: h('div.stack.gap-3',
      h('div.field', h('label', t('profile.name')), nameIn),
      h('div.field', h('label', t('search.tags')), topicIn),
      h('div.field', h('label', t('profile.bio')), descIn),
      h('label.row.gap-2', privIn, h('span.sm', 'Groupe privé')),
    ),
    foot: [
      h('button.btn.ghost', { type: 'button', onclick: () => m.close() }, t('a.cancel')),
      h('button.btn.primary', {
        type: 'button',
        onclick: () => {
          if (!nameIn.value.trim()) { toast(t('toast.nothing'), 'bad'); return; }
          store.add('groups', { id: uid('g'), name: nameIn.value.trim(), topic: topicIn.value.trim(), desc: descIn.value.trim(), members: 1, joined: true, private: !!privIn.checked });
          toast(t('toast.saved'), 'ok');
          m.close();
          router.render();
        },
      }, icon('check'), t('a.save')),
    ],
  });
}

/* =============================== évènements ============================ */

export function renderEvents(ctx, host) {
  const events = (store.data().events || []).slice().sort((a, b) => a.at - b.at);
  mount(host, h('div.stack.gap-4',
    viewHead({
      title: t('events.title'), scope: 'events',
      tools: [h('button.icon-btn', { type: 'button', 'aria-label': t('events.create'), onclick: () => createEvent() }, icon('plus'))],
    }),
    h('div.stack.gap-3', events.length ? events.map((e) => {
      const d = new Date(e.at);
      return h('article.card.pad.row.gap-3.hover',
        h('div.ev-date', h('span.d', String(d.getDate())), h('span.m', dateFmt(e.at, { month: 'short' }))),
        h('div.stack.grow.gap-1',
          h('span.b', e.title),
          h('span.xs.mut-3', e.place + ' · ' + dateFmt(e.at, { weekday: 'long', hour: '2-digit', minute: '2-digit' })),
          h('p.sm.mut.clamp-2', e.desc || ''),
          h('div.row.wrap.gap-2',
            h('span.chip', icon('users'), nfmt(e.attendees || 0)),
            e.going
              ? h('button.btn.sm.ok', { type: 'button', onclick: () => { store.update('events', e.id, { going: false, attendees: Math.max(0, (e.attendees || 1) - 1) }); router.render(); } }, icon('check'), t('events.going'))
              : h('button.btn.sm.primary', { type: 'button', onclick: () => { store.update('events', e.id, { going: true, interested: false, attendees: (e.attendees || 0) + 1 }); toast(t('events.going'), 'ok'); router.render(); } }, icon('calendar'), t('events.going')),
            h('button.btn.sm.ghost', { type: 'button', onclick: () => { store.update('events', e.id, { interested: !e.interested }); router.render(); } }, icon(e.interested ? 'star' : 'star'), t('events.interested')),
            h('button.icon-btn.sm', { type: 'button', 'aria-label': t('a.share'), onclick: () => shareSheet({ kind: 'event', id: e.id, title: e.title }) }, icon('share')),
          ),
        ),
      );
    }) : empty('calendar', t('empty.generic'))),
  ));
  return {};
}

function createEvent() {
  const titleIn = h('input.input', { type: 'text', maxlength: 80 });
  const placeIn = h('input.input', { type: 'text', maxlength: 80 });
  const dateIn = h('input.input', { type: 'datetime-local' });
  const descIn = h('textarea.textarea');
  const m = sheet({
    title: t('events.create'),
    body: h('div.stack.gap-3',
      h('div.field', h('label', t('profile.name')), titleIn),
      h('div.field', h('label', t('profile.city')), placeIn),
      h('div.field', h('label', t('nav.events')), dateIn),
      h('div.field', h('label', t('profile.bio')), descIn),
    ),
    foot: [
      h('button.btn.ghost', { type: 'button', onclick: () => m.close() }, t('a.cancel')),
      h('button.btn.primary', {
        type: 'button',
        onclick: () => {
          if (!titleIn.value.trim()) { toast(t('toast.nothing'), 'bad'); return; }
          store.add('events', {
            id: uid('e'), title: titleIn.value.trim(), place: placeIn.value.trim(),
            at: dateIn.value ? new Date(dateIn.value).getTime() : Date.now() + 86400e3,
            desc: descIn.value.trim(), going: true, interested: false, attendees: 1,
          });
          toast(t('toast.saved'), 'ok');
          m.close();
          router.render();
        },
      }, icon('check'), t('a.save')),
    ],
  });
}

/* ============================= notifications =========================== */

export function renderNotifications(ctx, host) {
  const tab = ctx.query.tab || 'all';
  let list = (store.data().notifications || []).slice().sort((a, b) => b.at - a.at);
  if (tab === 'unread') list = list.filter((n) => !n.read);

  const ICONS = { like: 'heart', comment: 'comment', follow: 'userPlus', live: 'live', order: 'box', gift: 'gift' };

  mount(host, h('div.stack.gap-4',
    viewHead({
      title: t('notif.title'), scope: 'notifications',
      tabsItems: [{ id: 'all', label: t('notif.all') }, { id: 'unread', label: t('notif.unread') }],
      activeTab: tab,
      onTab: (id) => router.replaceQuery({ tab: id === 'all' ? null : id }),
      tools: [h('button.icon-btn', {
        type: 'button', 'aria-label': t('notif.markAll'), title: t('notif.markAll'),
        onclick: () => {
          store.commit('notif', (c) => { for (const n of c.data.notifications || []) n.read = true; c.touch('data'); });
          toast(t('notif.markAll'), 'ok');
          router.render();
        },
      }, icon('check'))],
    }),
    h('div.card.pad.stack.gap-1', list.length ? list.map((n) => {
      const u = store.user(n.userId);
      return h('a.notif', { class: n.read ? '' : 'unread', href: n.hash || '#/', onclick: () => store.update('notifications', n.id, { read: true }) },
        h('span.ic-w', icon(ICONS[n.kind] || 'bell')),
        h('div.stack.grow.gap-1', h('span.sm', n.text), h('span.xs.mut-3', ago(n.at))),
        u ? avatar(u, 34) : null,
      );
    }) : empty('bell', t('notif.empty'))),
  ));
  return {};
}

/* ============================ enregistrements ========================== */

export function renderSaved(ctx, host) {
  const me = store.me();
  const saved = new Set(me.saved || []);
  const posts = store.data().posts.filter((p) => saved.has(p.id));
  const shorts = store.data().shorts.filter((v) => saved.has(v.id));
  const products = store.data().products.filter((p) => saved.has(p.id));
  const tab = ctx.query.tab || 'posts';

  const body = h('div.stack.gap-3');
  if (tab === 'shorts') {
    body.appendChild(shorts.length ? h('div.pf-grid', shorts.map((v) => {
      const cell = h('a.pf-cell', { href: '#/shorts?id=' + v.id });
      const poster = posterFor(v.demo);
      cell.appendChild(poster ? h('img', { src: poster, alt: '', loading: 'lazy' }) : h('div.sh-ph', icon('film')));
      cell.appendChild(h('div.ov', icon('play'), h('span', nfmt(v.views || 0))));
      return cell;
    })) : empty('bookmark', t('saved.empty')));
  } else if (tab === 'products') {
    body.appendChild(products.length ? h('div.grid-auto', products.map((p) => h('a.card.pad.hover.stack.gap-2', { href: '#/shop?id=' + p.id },
      safeImg(p.ref, { label: p.title, alt: p.title, seed: p.id }),
      h('span.b.trunc', p.title),
      h('span.sm', { style: { color: 'var(--taro)' } }, money(p.price, p.currency)),
    ))) : empty('bookmark', t('saved.empty')));
  } else {
    body.appendChild(posts.length ? h('div.stack.gap-3', posts.map((p) => postCard(p))) : empty('bookmark', t('saved.empty')));
  }

  mount(host, h('div.stack.gap-4',
    viewHead({
      title: t('saved.title'), scope: 'saved',
      tabsItems: [
        { id: 'posts', label: t('search.posts') + ' · ' + posts.length },
        { id: 'shorts', label: t('nav.shorts') + ' · ' + shorts.length },
        { id: 'products', label: t('search.products') + ' · ' + products.length },
      ],
      activeTab: tab,
      onTab: (id) => router.replaceQuery({ tab: id === 'posts' ? null : id }),
    }),
    body,
  ));
  return {};
}

/* ============================ recherche globale ======================== */

export function renderSearch(ctx, host) {
  const q0 = ctx.query.q || '';
  const kindTab = ctx.query.k || 'all';
  const resHost = h('div.stack.gap-3');

  const box = searchbox({
    placeholder: t('a.search'),
    value: q0,
    autofocus: !q0,
    onSubmit: (q) => { searchEngine.remember('home', q); router.replaceQuery({ q: q || null }); },
    onInput: (q) => paint(q),
  });

  const KINDS = [
    { id: 'all', label: t('search.all') },
    { id: 'user', label: t('search.people') },
    { id: 'post', label: t('search.posts') },
    { id: 'short', label: t('nav.shorts') },
    { id: 'product', label: t('search.products') },
    { id: 'tag', label: t('search.tags') },
  ];

  function paint(q) {
    const query = q != null ? q : q0;
    clear(resHost);
    if (!query || query.length < 2) {
      const hist = searchEngine.recent('home');
      resHost.appendChild(h('div.card.pad.stack.gap-2',
        h('div.row.between', h('h3', t('search.recent')),
          hist.length ? h('button.xs', { type: 'button', style: { color: 'var(--a-text)' }, onclick: () => { searchEngine.clearHistory('home'); paint(query); } }, t('search.clear')) : null),
        hist.length
          ? h('div.row.wrap.gap-2', hist.map((x) => h('button.chip.btn-like', { type: 'button', onclick: () => { box.input.value = x; router.replaceQuery({ q: x }); } }, icon('clock'), x)))
          : h('p.xs.mut-3', t('feed.searchHint')),
      ));
      const trends = searchEngine.trendingTags(10);
      resHost.appendChild(h('div.card.pad.stack.gap-2',
        h('h3', t('feed.trending')),
        h('div.row.wrap.gap-2', trends.map(([tag, n]) => h('button.chip.btn-like', {
          type: 'button', onclick: () => { box.input.value = '#' + tag; router.replaceQuery({ q: '#' + tag }); },
        }, icon('hash'), tag, h('span.xs.mut-3', nfmt(n))))),
      ));
      return;
    }
    let hits = searchEngine.search('all', query, { limit: 60 });
    if (kindTab !== 'all') hits = hits.filter((x) => x.kind === kindTab);
    if (!hits.length) { resHost.appendChild(empty('search', t('search.empty', { q: query }))); return; }
    resHost.appendChild(h('div.card.pad.stack.gap-1', hits.map((hit) => h('a.msg-item', { href: hit.hash },
      h('span.ic-w', icon(hit.icon || 'search')),
      h('div.b', h('div.nm.trunc', hit.title), h('div.pv.trunc', hit.sub || '')),
    ))));
  }

  mount(host, h('div.stack.gap-4',
    viewHead({
      title: t('search.title'),
      tabsItems: KINDS,
      activeTab: kindTab,
      onTab: (id) => router.replaceQuery({ k: id === 'all' ? null : id }),
    }),
    box.el,
    resHost,
  ));
  paint(q0);
  return {};
}

/* ================================ explorer ============================= */

export function renderExplore(ctx, host) {
  const d = store.data();
  const trends = searchEngine.trendingTags(12);
  const topShorts = d.shorts.slice().sort((a, b) => (b.views || 0) - (a.views || 0)).slice(0, 8);
  const topPosts = d.posts.slice().sort((a, b) => (b.likes || 0) - (a.likes || 0)).slice(0, 4);
  const people = d.users.filter((u) => u.id !== store.session().meId).slice(0, 6);

  mount(host, h('div.stack.gap-4',
    viewHead({ title: t('nav.explore'), scope: 'explore' }),
    billboard(),
    h('div.card.pad.stack.gap-3',
      h('h3', t('feed.trending')),
      h('div.row.wrap.gap-2', trends.map(([tag, n]) => h('a.chip', { href: '#/search?q=%23' + encodeURIComponent(tag) }, icon('hash'), tag, h('span.xs.mut-3', nfmt(n))))),
    ),
    h('div.sec-head', h('h2', t('nav.shorts')), h('a.btn.sm.ghost', { href: '#/shorts' }, t('a.more'))),
    h('div.pf-grid', topShorts.map((v) => {
      const cell = h('a.pf-cell', { href: '#/shorts?id=' + v.id });
      const poster = posterFor(v.demo);
      cell.appendChild(poster ? h('img', { src: poster, alt: '', loading: 'lazy' }) : h('div.sh-ph', icon('film')));
      cell.appendChild(h('div.ov', icon('play'), h('span', nfmt(v.views || 0))));
      return cell;
    })),
    h('div.sec-head', h('h2', t('search.people'))),
    h('div.grid-auto', people.map((u) => h('a.card.pad.hover.stack.gap-2', { href: '#/u/' + u.handle, style: { 'justify-items': 'center', 'text-align': 'center' } },
      avatar(u, 56), h('span.b.trunc', u.name), h('span.xs.mut-3.trunc', '@' + u.handle),
      h('span.xs.mut-3', nfmt(u.followers || 0) + ' ' + t('profile.followers').toLowerCase()),
    ))),
    h('div.sec-head', h('h2', t('feed.foryou'))),
    h('div.stack.gap-3', topPosts.map((p) => postCard(p))),
  ));
  return {};
}

/* ========================== publication détaillée ====================== */

export function renderPost(ctx, host) {
  const p = store.byId('posts', ctx.params.id);
  if (!p) {
    mount(host, h('div.stack.gap-4', viewHead({ title: t('err.title') }), empty('comment', t('err.view'))));
    return {};
  }
  store.update('posts', p.id, (x) => ({ views: (x.views || 0) + 1 }));
  const au = store.user(p.userId);
  mount(host, h('div.stack.gap-4',
    viewHead({ title: au ? au.name : t('search.posts'), scope: 'home' }),
    postCard(p, { openComments: true }),
  ));
  return {};
}

/* ============================== page absente =========================== */

export function renderNotFound(ctx, host) {
  mount(host, h('div.stack.gap-4',
    viewHead({ title: t('err.title') }),
    empty('help', t('err.view'),
      h('div.row.gap-2',
        h('a.btn.primary', { href: '#/' }, icon('home'), t('nav.home')),
        h('button.btn.ghost', { type: 'button', onclick: () => router.back() }, icon('back'), t('a.back')),
      )),
  ));
  return {};
}
