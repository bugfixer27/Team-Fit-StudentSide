// Boot → load the roster (read-only) → render hero, teams, events, directory → wire search & drawer.
import { loadRoster } from './api.js';
import { buildModel, TEAMS, TEAM_KEYS, gradeLabel } from './data.js';
import * as fx from './fx.js';

const $ = id => document.getElementById(id);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const h = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };

let model = null;
let gallery = null;
let eventFilter = 'all';
const field = fx.constellation($('field'));
fx.spotlight($('spotlight'));

/* ------------------------------------------------------------------ loader */
const MESSAGES = [
  'Opening the roster…',
  'Waking up the spreadsheet — the first visit of the day can take up to a minute…',
  'Counting heads…',
  'Sorting maroon from gold from beige…',
  'Matching every name to every event…',
  'Almost there — polishing the medals…'
];
let msgTimer = 0, msgIdx = 0;
function setMsg(text) {
  const el = $('loader-msg');
  el.classList.add('is-swapping');
  setTimeout(() => { el.textContent = text; el.classList.remove('is-swapping'); }, 300);
}
function startMessages() {
  msgIdx = 0; $('loader-msg').textContent = MESSAGES[0];
  clearInterval(msgTimer);
  msgTimer = setInterval(() => { msgIdx = Math.min(msgIdx + 1, MESSAGES.length - 1); setMsg(MESSAGES[msgIdx]); }, 5000);
}

async function boot() {
  document.body.classList.add('is-loading');
  fx.splitWord(document.querySelector('.word[data-word="TEAM"]'), 'TEAM');
  const fit = document.querySelector('.word[data-word="FIT"]'); fit.dataset.offset = '4'; fx.splitWord(fit, 'FIT');

  let attempt = 0;
  for (;;) {
    attempt++;
    startMessages();
    $('loader').classList.remove('is-error');
    $('loader-sub').textContent = attempt > 1 ? `attempt ${attempt}` : '';
    const t0 = performance.now();
    try {
      const data = await loadRoster();
      clearInterval(msgTimer);
      $('loader-sub').textContent = `${data.responses.length} students · v${data.version} · ${((performance.now() - t0) / 1000).toFixed(1)}s`;
      setMsg('Here we go.');
      model = buildModel(data);
      render();
      await new Promise(r => setTimeout(r, 700));
      $('loader').classList.add('is-done');
      document.body.classList.remove('is-loading');
      document.body.classList.add('is-ready');
      requestAnimationFrame(() => { gallery && gallery.layout(); });
      return;
    } catch (err) {
      clearInterval(msgTimer);
      $('loader').classList.add('is-error');
      setMsg('Couldn’t reach the roster.');
      // Auto-retry with a visible countdown; there is deliberately no button.
      const wait = Math.min(60, 10 * attempt);
      for (let s = wait; s > 0; s--) {
        $('loader-sub').textContent = `${err.message} — retrying in ${s}s`;
        await new Promise(r => setTimeout(r, 1000));
      }
    }
  }
}

/* ------------------------------------------------------------------ render */
function render() {
  renderHero();
  renderTeams();
  renderEvents();
  renderDirectory();
  fx.observeAll();
  fx.tilt(document.body, '.card');
  fx.navigation($('nav'), $('nav-progress'), [...document.querySelectorAll('.nav-links a')]);
  gallery = fx.horizontalGallery($('events'), $('events-track'), $('events-rail-fill'));
  field.setPeople(model.people);
  const when = model.updatedAt ? new Date(model.updatedAt) : null;
  const stamp = when && !isNaN(when) ? when.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '';
  $('version').textContent = `roster v${model.version}${stamp ? ' · updated ' + stamp : ''}`;
  $('foot-meta').textContent = `Live from the leaders’ roster · v${model.version}${stamp ? ' · ' + stamp : ''}`;
}

function renderHero() {
  const slots = TEAM_KEYS.reduce((n, t) => n + model.stats[t].slotsFilled, 0);
  const heroStats = document.querySelector('.hero-stats');
  const io = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) { io.disconnect();
    fx.countUp($('stat-people'), model.totals.placed); fx.countUp($('stat-events'), model.totals.events, 1300); fx.countUp($('stat-slots'), slots, 1900); } });
  io.observe(heroStats);
  const wrap = $('hero-teams'); wrap.innerHTML = '';
  for (const t of TEAM_KEYS) {
    const T = TEAMS[t];
    wrap.appendChild(h(`<a class="pill" href="#team-${T.slug}" style="--c:${T.glow}"><i></i>${T.name} <b>${model.stats[t].members}</b></a>`));
  }
}

function personCard(p, i) {
  const T = p.team ? TEAMS[p.team] : null;
  return h(`<button class="card" type="button" data-email="${esc(p.email)}" style="--i:${i}">
    <span class="card-name">${esc(p.name)}</span>
    <span class="card-grade">${esc(gradeLabel(p.grade))}</span>
    <span class="card-meta"><span class="ev">${p.events.length} event${p.events.length === 1 ? '' : 's'}</span><span class="em">${esc(p.email)}</span></span>
    <span class="card-events">${p.events.map(e => `<span class="tag" data-ev="${esc(e.name)}">${esc(e.name)}</span>`).join('')}${T ? '' : ''}</span>
  </button>`);
}

function renderTeams() {
  const grid = $('team-grid'); grid.innerHTML = '';
  TEAM_KEYS.forEach((t, ti) => {
    const T = TEAMS[t], S = model.stats[t], ppl = model.byTeam[t];
    const maxG = Math.max(1, ...Object.values(S.grades));
    const el = h(`<article class="team team-${T.slug[0]}" id="team-${T.slug}" style="--i:${ti}">
      <div class="team-top">
        <div><h3 class="team-name">${T.name}</h3><p class="team-sub">${T.tagline} · ${S.slotsFilled}/${S.slotsTotal} seats</p></div>
        <div class="team-count">${S.members}<small>members</small></div>
      </div>
      <div class="team-meter"><i style="--p:${S.slotsTotal ? S.slotsFilled / S.slotsTotal : 0}"></i></div>
      <div class="team-grades">${[9, 10, 11, 12].map(g => `<div class="gbar"><i style="--p:${S.grades[g] / maxG}"></i><span><b>${S.grades[g]}</b> · ${g}th</span></div>`).join('')}</div>
      <div class="members"></div>
    </article>`);
    const list = el.querySelector('.members');
    if (!ppl.length) list.appendChild(h('<p class="who-empty">No one placed yet.</p>'));
    ppl.forEach((p, i) => list.appendChild(personCard(p, i)));
    grid.appendChild(el);
    fx.observe(el, ti);
  });
  const un = $('unplaced');
  if (model.byTeam.none.length) {
    un.hidden = false;
    un.innerHTML = `<h3>Not placed yet</h3><p>${model.byTeam.none.length} student${model.byTeam.none.length === 1 ? '' : 's'} on the roster without a team so far.</p><div class="members"></div>`;
    const list = un.querySelector('.members');
    model.byTeam.none.forEach((p, i) => list.appendChild(personCard(p, i)));
    un.classList.add('team'); fx.observe(un, 3);
  } else un.hidden = true;
}

function renderEvents() {
  const track = $('events-track'); track.innerHTML = '';
  model.events.forEach((ev, i) => {
    const rows = TEAM_KEYS.map(t => {
      const T = TEAMS[t];
      const names = ev.teams[t].length
        ? ev.teams[t].map(p => `<button class="who" type="button" data-email="${esc(p.email)}">${esc(p.name)}</button>`).join('')
        : `<span class="who-empty">open</span>`;
      return `<div class="erow erow-${T.slug[0]}" data-team="${t}"><span class="erow-team">${T.short}</span><span class="erow-names">${names}</span></div>`;
    }).join('');
    track.appendChild(h(`<article class="ecard type-${esc(ev.type)}" data-event="${esc(ev.name)}" data-i="${i}">
      <span class="ecard-idx">${String(i + 1).padStart(2, '0')} / ${model.events.length}</span>
      <h3 class="ecard-name">${esc(ev.name)}</h3>
      <span class="ecard-type">${esc(ev.type)} · ${ev.slots} per team</span>
      <span class="ecard-big" aria-hidden="true">${String(i + 1).padStart(2, '0')}</span>
      <span class="ecard-seats" aria-hidden="true" title="seats filled">${TEAM_KEYS.map(t => Array.from({ length: ev.slots }, (_, k) => `<i class="${k < ev.teams[t].length ? 'f-' + t : ''}"></i>`).join('')).join('')}</span>
      <div class="erows">${rows}</div>
    </article>`));
  });
  document.querySelectorAll('.filters .chip').forEach(btn => btn.addEventListener('click', () => {
    eventFilter = btn.dataset.team;
    document.querySelectorAll('.filters .chip').forEach(b => b.classList.toggle('is-on', b === btn));
    document.querySelectorAll('.erow').forEach(r => r.classList.toggle('is-off', eventFilter !== 'all' && r.dataset.team !== eventFilter));
  }));
}

function renderDirectory() {
  const ol = $('dir-list'); ol.innerHTML = '';
  model.people.forEach((p, i) => {
    const T = p.team ? TEAMS[p.team] : null;
    const li = h(`<li class="dir-row" data-email="${esc(p.email)}" style="--i:${i % 12};${T ? `--c:${T.glow}` : ''}" tabindex="0" role="button">
      <span class="dir-name"><i></i><span class="txt">${esc(p.name)}</span></span>
      <span class="dir-grade">${esc(gradeLabel(p.grade))}</span>
      <span class="dir-team"><b>${T ? T.short : '—'}</b></span>
      <span class="dir-events">${p.events.length ? p.events.map(e => `<span class="tag" data-ev="${esc(e.name)}">${esc(e.name)}</span>`).join('') : '<span class="who-empty">no events yet</span>'}</span>
      <a class="dir-email" href="mailto:${esc(p.email)}" onclick="event.stopPropagation()">${esc(p.email)}</a>
    </li>`);
    ol.appendChild(li); fx.observe(li, i % 12);
  });
}

/* ------------------------------------------------------------------ drawer */
function openPerson(email) {
  const p = model.people.find(x => x.email === email); if (!p) return;
  const T = p.team ? TEAMS[p.team] : null;
  const panel = document.querySelector('.drawer-panel');
  panel.className = 'drawer-panel' + (T ? ' t-' + T.key : '');
  $('drawer-body').innerHTML = `
    <span class="dr-team"><i></i>${T ? `${T.name} · ${T.tagline}` : 'Not placed yet'}</span>
    <h2 class="dr-name">${esc(p.name)}</h2>
    <p class="dr-sub">${esc(gradeLabel(p.grade))}</p>
    <a class="dr-email" href="mailto:${esc(p.email)}">${esc(p.email)}</a>
    <p class="dr-h"><span>Events</span><span>${p.events.length}</span></p>
    ${p.events.length ? `<ul class="dr-events">${p.events.map((e, i) => {
      const ev = model.events.find(x => x.name === e.name);
      const mates = ev ? ev.teams[e.team].filter(x => x.email !== p.email).map(x => x.name) : [];
      return `<li style="--i:${i}"><button class="dr-ev" type="button" data-goto="${esc(e.name)}"><b>${esc(e.name)}</b><small>${esc(e.type)}</small><span>${mates.length ? 'with ' + esc(mates.join(', ')) : 'solo so far'}</span></button></li>`;
    }).join('')}</ul>` : '<p class="dr-none">No events assigned yet.</p>'}`;
  $('drawer').classList.add('is-open'); $('drawer').setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
  setTimeout(() => $('drawer-close').focus(), 400);
}
function closeDrawer() {
  $('drawer').classList.remove('is-open'); $('drawer').setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
}
function gotoEvent(name) {
  closeDrawer();
  const i = model.events.findIndex(e => e.name === name); if (i < 0) return;
  setTimeout(() => {
    gallery.scrollToCard(i);
    const card = document.querySelector(`.ecard[data-event="${CSS.escape(name)}"]`);
    if (card) { card.style.borderColor = 'var(--c)'; setTimeout(() => card.style.borderColor = '', 2400); }
  }, 250);
}

document.addEventListener('click', e => {
  const goto = e.target.closest('[data-goto]'); if (goto) return gotoEvent(goto.dataset.goto);
  const who = e.target.closest('.card, .who, .dir-row'); if (who && who.dataset.email) return openPerson(who.dataset.email);
});
document.addEventListener('keydown', e => {
  const row = e.target.closest && e.target.closest('.dir-row');
  if (row && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); openPerson(row.dataset.email); }
  if (e.key === 'Escape') { if ($('drawer').classList.contains('is-open')) closeDrawer(); else if (document.activeElement === $('search-input')) { $('search-input').value = ''; applySearch(''); $('search-input').blur(); } }
  if (e.key === '/' && !/input|textarea/i.test(e.target.tagName)) { e.preventDefault(); $('search-input').focus(); }
});
$('drawer-close').addEventListener('click', closeDrawer);
$('drawer-scrim').addEventListener('click', closeDrawer);

/* ------------------------------------------------------------------ search */
function matches(p, q) {
  if (!q) return { hit: true, self: true, events: [] };
  const evs = p.events.filter(e => e.name.toLowerCase().includes(q)).map(e => e.name);
  const T = p.team ? TEAMS[p.team] : null;
  const hay = [p.name, p.email, String(p.grade || ''), gradeLabel(p.grade), T ? T.name : '', T ? T.tagline : ''].join(' ').toLowerCase();
  const self = hay.includes(q);
  return { hit: self || evs.length > 0, self, events: evs };
}
function applySearch(raw) {
  const q = raw.trim().toLowerCase();
  const hits = new Map(model.people.map(p => [p.email, matches(p, q)]));
  document.querySelectorAll('.card').forEach(c => {
    const m = hits.get(c.dataset.email); c.classList.toggle('is-hidden', !m.hit);
    c.querySelectorAll('.tag').forEach(t => t.classList.toggle('hit', m.events.includes(t.dataset.ev)));
  });
  document.querySelectorAll('.ecard').forEach(c => {
    const evHit = !!q && c.dataset.event.toLowerCase().includes(q);
    let any = false;
    c.querySelectorAll('.who').forEach(w => { const on = evHit || hits.get(w.dataset.email).self; any = any || on; w.classList.toggle('hit', !!q && on); w.classList.toggle('is-dim', !!q && !on); });
    c.classList.toggle('is-dim', !!q && !evHit && !any);
  });
  let shown = 0;
  document.querySelectorAll('.dir-row').forEach(r => { const m = hits.get(r.dataset.email); r.classList.toggle('is-hidden', !m.hit); if (m.hit) shown++; r.querySelectorAll('.tag').forEach(t => t.classList.toggle('hit', m.events.includes(t.dataset.ev))); });
  $('dir-empty').hidden = shown > 0;
  requestAnimationFrame(() => gallery && gallery.layout());
}
let searchTimer = 0;
$('search-input').addEventListener('input', e => { clearTimeout(searchTimer); searchTimer = setTimeout(() => applySearch(e.target.value), 80); });

boot();
