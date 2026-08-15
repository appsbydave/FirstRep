/* FIRST REP — interface.
 * Vanilla, no framework, no build step, no network. */

import * as db from './db.js';
import { CHAPTERS, ALL_QUESTIONS } from './screening.js';
import {
  deriveState, nextSession, capability, capabilityParts, gapLabel, weekIndex,
  isTrainingDay, isTestDay, missPolicy, evaluateScreening, entryPhase, hangAdvice,
  weekHangSeconds, PHASES, RUNGS, LIMITS, LIMITERS, SESSION_CAP, iso, parseISO
} from './engine.js';
import { diagramHTML, referenceHTML, exerciseFor } from './exercises.js';

/* Bump this and CACHE in sw.js together. Shown under You, so which build is
 * actually running on a phone is a thing you can read rather than deduce. */
export const BUILD = '3 — exercise diagrams, grip work';

const $ = sel => document.querySelector(sel);
const view = $('#view'), tabbar = $('#tabbar'), overlay = $('#overlay'), topright = $('#topright');
const todayISO = () => iso(new Date());
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

let A = {                       // app state
  profiles: [], profile: null, events: [], s: null, device: null,
  tab: 'today', screen: 'boot', qi: 0, answers: {}, animateCap: true,
  installEvent: null, milestoneQueue: []
};

/* ── boot ─────────────────────────────────────────────────────────────────── */
async function boot() {
  const theme = await db.getKV('theme', null);
  if (theme) document.documentElement.dataset.theme = theme;

  A.device = await db.getDevice();
  A.profiles = await db.profiles();
  const activeId = await db.getKV('activeProfileId');
  A.profile = A.profiles.find(p => p.id === activeId) || A.profiles[0] || null;

  if (!A.profile) A.screen = 'welcome';
  else if (!A.profile.screening) { A.screen = 'screening'; A.qi = 0; A.answers = {}; }
  else { A.screen = 'main'; await loadProfile(); }
  render();

  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); A.installEvent = e; });
  window.addEventListener('online', render);
  window.addEventListener('offline', render);
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
}

async function loadProfile() {
  A.events = await db.eventsFor(A.profile.id);
  A.s = deriveState(A.events.map(e => ({ type: e.type, payload: e.payload })));
}

async function emit(type, payload) {
  await db.append(A.profile.id, type, payload);
  await loadProfile();
}

/** Wrap one or more emits so a milestone triggered by the first isn't swallowed by the second. */
async function commit(fn) {
  const before = new Set((A.s?.milestones || []).map(m => m.id));
  await fn();
  A.milestoneQueue = A.s.milestones.filter(m => !before.has(m.id));
}

/* ── render ───────────────────────────────────────────────────────────────── */
function render() {
  tabbar.hidden = A.screen !== 'main';
  topright.innerHTML = A.screen === 'main' && A.profile
    ? `<button class="avatar-btn" data-act="people" aria-label="Switch person"><span class="av on">${esc(A.profile.initials)}</span></button>`
    : '';
  if (A.screen === 'welcome') return void (view.innerHTML = welcomeView());
  if (A.screen === 'newProfile') return void (view.innerHTML = newProfileView());
  if (A.screen === 'screening') return void (view.innerHTML = screeningView());
  if (A.screen === 'result') return void (view.innerHTML = resultView());
  if (A.screen === 'main') {
    view.innerHTML = { today: todayView, plan: planView, progress: progressView, you: youView }[A.tab]();
    document.querySelectorAll('.tab').forEach(t =>
      t.setAttribute('aria-current', t.dataset.tab === A.tab ? 'page' : 'false'));
    if (A.tab === 'today') paintCapability();
    if (A.tab === 'you') reportCache();
  }
  if (A.milestoneQueue.length) showMilestone(A.milestoneQueue[0]);
}

/* ── welcome / profiles ───────────────────────────────────────────────────── */
const welcomeView = () => `
  <h1 class="screen">Couch to your first pull-up.</h1>
  <p class="lede">Most people start at zero. This is built for zero.</p>
  <div class="card">
    <h3>What this is</h3>
    <p>Three sessions a week, about 28 minutes each, plus a one-minute hang every day. Fixed days. The content adjusts to you.</p>
  </div>
  <div class="card">
    <h3>What we won’t do</h3>
    <p>No calorie counting. No before-and-after photos. No streak you can break by having a life. We won’t tell you to push through pain.</p>
  </div>
  <div class="card">
    <h3>The honest number</h3>
    <p>Twenty strict reps is the finish line here — that’s the practical goal in the Naval Special Warfare guide and near a top score on the USMC test. Almost nobody reaches fifty. We’re not going to promise you fifty.</p>
  </div>
  <button class="btn" data-act="start">Set up your profile</button>`;

const newProfileView = () => `
  <h1 class="screen">Who’s training?</h1>
  <p class="lede">One bar, several people is normal. Everyone gets their own screening and their own plan.</p>
  <input type="text" id="pname" placeholder="First name" autocomplete="given-name" maxlength="24">
  <button class="btn" data-act="createProfile">Continue</button>
  ${A.profiles.length ? `<button class="btn quiet" data-act="cancelProfile">Back</button>` : ''}`;

/* ── screening ────────────────────────────────────────────────────────────── */
function screeningView() {
  const q = ALL_QUESTIONS[A.qi];
  const ch = CHAPTERS.find(c => c.id === q.chapter);
  const first = ALL_QUESTIONS.findIndex(x => x.chapter === q.chapter) === A.qi;
  return `
    <div class="mono muted">${esc(ch.title)} · ${A.qi + 1} of ${ALL_QUESTIONS.length}</div>
    <div class="rule"><i style="width:${((A.qi) / ALL_QUESTIONS.length) * 100}%"></i></div>
    ${first ? `<p class="lede" style="margin-top:18px">${esc(ch.note)}</p>` : ''}
    <h1 class="screen">${esc(q.text)}</h1>
    ${q.hint ? `<p class="hint">${esc(q.hint)}</p>` : ''}
    <div class="opts">
      ${q.options.map(o => `<button class="opt${A.answers[q.id] === o.v ? ' sel' : ''}" data-act="answer" data-q="${q.id}" data-v="${o.v}">${esc(o.l)}</button>`).join('')}
    </div>
    ${A.qi > 0 ? `<button class="btn quiet" data-act="back">Back</button>` : ''}`;
}

async function finishScreening() {
  const r = evaluateScreening(A.answers);
  const phase = entryPhase(r.entry);
  A.profile.screening = { answers: A.answers, result: r, at: new Date().toISOString() };
  A.profile.suppressBody = r.suppressBody;
  A.profile.fatLoss = r.fatLoss && !r.suppressBody;
  A.profile.track = r.track;
  await db.put('profiles', A.profile);
  await db.setDevice({ barType: A.answers.q13, barRatingKg: A.answers.q14 === 'yes', spaceOk: A.answers.q15 === 'yes' });
  A.device = await db.getDevice();
  await loadProfile();
  if (!A.events.length) {
    await db.append(A.profile.id, 'PLAN_STARTED', { startISO: todayISO(), levels: r.entry, phase });
    await loadProfile();
  }
  A.screen = 'result'; render();
}

function resultView() {
  const r = A.profile.screening.result;
  const stops = r.gates.filter(g => g.level === 'stop');
  return `
    <h1 class="screen">${stops.length ? 'A couple of things first' : 'You’re set'}</h1>
    <p class="lede">${stops.length
      ? 'These aren’t a no. They’re the order we do things in.'
      : `Starting in ${esc(PHASES[A.s.phase].name.toLowerCase())}. Sessions land on Monday, Wednesday and Friday.`}</p>
    ${r.gates.map(g => `<div class="gate ${g.level === 'modify' ? 'modify' : ''}">
        <b>${g.level === 'stop' ? 'Before you start' : 'Your plan is adjusted'}</b>
        <span>${esc(g.text)}</span></div>`).join('')}
    ${stops.length && r.floorTrack ? `<div class="card"><h3>You can still train today</h3>
      <p>Rows, press-ups and lower-body work need no bar and carry none of the hanging risk. We’ll open the bar work the moment the gate clears.</p></div>` : ''}
    ${r.suppressBody ? `<div class="card"><h3>Body metrics are off</h3>
      <p>Permanently, for this profile. We won’t ask you about it again.</p></div>` : ''}
    <button class="btn" data-act="toMain">${stops.length ? 'Continue' : 'Start'}</button>`;
}

/* ── today ────────────────────────────────────────────────────────────────── */
/* One definition of what the equipment gate removes, used by both the preview
 * and the player, so the card can never promise a block the session won't run. */
const GATED_TRACKS = ['hang', 'band', 'cluster', 'pull', 'neg', 'test', 'cooldown'];
const liveBlocks = sess =>
  sess.blocks.filter(b => !(!A.device?.barRatingKg && GATED_TRACKS.includes(b.track)));

const qty = b => {
  const u = b.unit === 's' ? 's' : b.unit === 'min' ? ' min' : b.unit === 'attempt' ? '' : '';
  return b.sets > 1 ? `${b.sets} × ${b.target}${u}` : `${b.target}${u}`;
};

function pendingPainCheck() {
  const last = [...A.events].reverse().find(e => e.type === 'SESSION_COMPLETED');
  if (!last) return null;
  const d = last.payload.dateISO;
  if (d >= todayISO()) return null;
  const answered = A.events.some(e => e.type === 'PAIN_CHECK' && e.payload.forDate === d);
  return answered ? null : d;
}

function todayView() {
  const s = A.s, t = todayISO(), cap = capability(s);
  const training = isTrainingDay(t);
  const done = A.events.some(e => e.type === 'SESSION_COMPLETED' && e.payload.dateISO === t);
  const hung = A.events.some(e => e.type === 'HANG_LOGGED' && e.payload.dateISO === t);
  const sess = training ? nextSession(s, t) : null;
  const gated = !A.device?.barRatingKg;
  const pain = pendingPainCheck();
  const lastSess = [...A.events].reverse().find(e => e.type === 'SESSION_COMPLETED');
  const gapDays = lastSess ? Math.round((parseISO(t) - parseISO(lastSess.payload.dateISO)) / 86400000) : 0;
  const miss = lastSess ? missPolicy(gapDays) : { action: 'none', message: null };

  return `
    ${!navigator.onLine ? `<div class="offline mono">Offline · everything here still works</div>` : ''}
    ${pain ? `<div class="card">
        <h3>How does it feel this morning?</h3>
        <p>Asked once, the morning after a session. Pain that’s gone by now is fine. Pain that isn’t means the load was too high.</p>
        <div class="opts">
          <button class="opt" data-act="pain" data-v="fine" data-d="${pain}">Fine</button>
          <button class="opt" data-act="pain" data-v="settled" data-d="${pain}">Was sore, settled overnight</button>
          <button class="opt alert" data-act="pain" data-v="hurts" data-d="${pain}">Still hurts</button>
        </div>
      </div>` : ''}

    <div class="sig">
      <div class="colwrap">
        <div class="column"><div class="fill" id="fill"></div></div>
        <div class="gapchip mono" id="chip">${esc(gapLabel(s))}</div>
      </div>
      <div>
        <div class="mono muted">Capability</div>
        <span class="capnum" id="capnum">0.00</span>
        <div class="mono muted captarget">${s.levels.pull.maxReps >= 1 ? 'Next rung ' + nextRung(s) : 'Target 1.00 · first clean rep'}</div>
      </div>
    </div>

    ${miss.message ? `<div class="card"><p style="color:var(--steel-900);font-size:15px">${esc(miss.message)}</p></div>` : ''}

    ${training ? `<div class="card">
        <div class="row">
          <h3>${esc(sess.title)}</h3>
          <span class="mono muted">Week ${sess.week}${sess.deload ? ' · lighter' : ''}</span>
        </div>
        <p>${sess.minutes} min · ${esc(sess.grip)} grip · ${liveBlocks(sess).length} blocks</p>
        <ul class="blocklist">
          ${liveBlocks(sess).map((b, i) => `<li><button class="blockrow" data-act="ref" data-bi="${i}">
            <span class="bt">${esc(b.name)}</span>
            <span class="bq">${esc(qty(b))}</span>
            <span class="bi" aria-label="What is this?">?</span></button></li>`).join('')}
        </ul>
        ${gated && sess.blocks.some(b => GATED_TRACKS.includes(b.track))
          ? `<div class="gate"><b>Bar not confirmed</b><span>We’ve dropped the hanging work. Rows, press-ups and legs are ready to go.</span></div>` : ''}
        ${done ? `<p class="pill" style="margin-top:14px">Done today</p>`
               : `<button class="btn" data-act="startSession">Start session</button>`}
      </div>`
      : `<div class="card"><h3>Rest day</h3>
          <p>Your tendons adapt slower than your muscles. The 48 hours between sessions is for them.</p></div>`}

    <div class="card">
      <div class="row">
        <div>
          <div class="mono muted">Daily hang</div>
          <div class="stat">
            <div><span class="v">${s.hangStreak}</span><span class="mono muted">day${s.hangStreak === 1 ? '' : 's'}</span></div>
            <div><span class="v">${weekHangSeconds(A.events, t)}</span><span class="mono muted">s this week</span></div>
            <div><span class="v">${s.levels.hang.bestSec}</span><span class="mono muted">s best</span></div>
          </div>
        </div>
        ${hung ? `<span class="pill">Done</span>`
               : `<button class="btn small" data-act="hang" ${gated ? 'disabled' : ''}>Hang</button>`}
      </div>
      <p>Two minutes, every day. It’s real training, and it’s the only streak here.</p>
      ${hangAdvice(s) ? `<p style="margin-top:10px">${esc(hangAdvice(s))}</p>` : ''}
    </div>`;
}

const nextRung = s => {
  const r = RUNGS.find(r => !s.milestones.some(m => m.id === r.id));
  return r ? r.label.toLowerCase() : 'endgame';
};

function paintCapability() {
  const fill = $('#fill'), chip = $('#chip'), num = $('#capnum');
  if (!fill) return;
  const cap = capability(A.s);
  const pct = Math.max(2, Math.min(100, (cap >= 1 ? (cap % 1 || 0.999) : cap) * 100));
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const place = p => { fill.style.height = p + '%'; chip.style.bottom = `calc(${p}% - 12px)`; };
  if (reduce || !A.animateCap) { place(pct); num.textContent = cap.toFixed(2); A.animateCap = false; return; }
  A.animateCap = false;
  place(0); num.textContent = '0.00';
  requestAnimationFrame(() => requestAnimationFrame(() => {
    place(pct);
    const t0 = performance.now();
    const step = now => {
      const p = Math.min((now - t0) / 900, 1), e = 1 - Math.pow(1 - p, 3);
      num.textContent = (cap * e).toFixed(2);
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }));
}

/* ── plan ─────────────────────────────────────────────────────────────────── */
function planView() {
  const s = A.s, w = weekIndex(s, todayISO()) + 1;
  const upcoming = [];
  const d = parseISO(todayISO());
  for (let i = 0; i < 21 && upcoming.length < 6; i++) {
    const day = iso(d);
    if (isTrainingDay(day)) upcoming.push({ day, sess: nextSession(s, day) });
    d.setDate(d.getDate() + 1);
  }
  const fmt = x => parseISO(x).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
  return `
    <h1 class="screen">${esc(PHASES[s.phase].name)}</h1>
    <p class="lede">Phase ${s.phase} of 6 · week ${w}. ${esc(PHASES[s.phase].blurb)}</p>
    <div class="card">
      <h3>What ends this phase</h3>
      <p>${esc(exitText(s))}</p>
    </div>
    <div class="card">
      <h3>Next sessions</h3>
      <ul class="list">
        ${upcoming.map(u => `<li><span>${fmt(u.day)}</span>
          <span class="mono muted">${u.sess.isTest ? 'Test' : u.sess.deload ? 'Lighter' : u.sess.grip}</span></li>`).join('')}
      </ul>
      <p>Dates never move. What happens inside a session does.</p>
    </div>
    <div class="card">
      <h3>Your ceilings</h3>
      <ul class="list">
        <li><span>Per session</span><span class="mono">${SESSION_CAP} reps</span></li>
        <li><span>Per week</span><span class="mono">${LIMITS.WEEK_PULL_REPS_EARLY} reps</span></li>
        <li><span>Rest between sessions</span><span class="mono">48 h</span></li>
      </ul>
      <p>Taken from the Naval Special Warfare guide, then cut well below it. These are enforced, not suggested.</p>
    </div>`;
}

function exitText(s) {
  const L = s.levels;
  switch (s.phase) {
    case 0: return `A 30-second active hang and 3 × 8 scapular pulls. You’re at ${L.hang.bestSec}s and 3 × ${L.scap.reps}.`;
    case 1: return `3 × 5 on the lightest band and 3 × 3 five-second negatives. You’re on A${L.band.assist} and ${L.neg.sec}s.`;
    case 2: return 'One clean rep from a dead hang. Chin-up or neutral grip counts.';
    case 3: return `Five clean strict reps. You’re at ${L.pull.maxReps}.`;
    case 4: return `Ten clean strict reps. You’re at ${L.pull.maxReps}.`;
    case 5: return `Twenty reps — the finish line. You’re at ${L.pull.maxReps}.`;
    default: return 'Nothing. This phase is undated and open-ended.';
  }
}

/* ── progress ─────────────────────────────────────────────────────────────── */
function progressView() {
  const s = A.s;
  const pts = s.history.slice(-30);
  const parts = capabilityParts(s);
  return `
    <h1 class="screen">Progress</h1>
    <p class="lede">Everything here is cumulative. None of it can be lost.</p>
    <div class="card">
      <div class="mono muted">Capability</div>
      ${pts.length > 1 ? chart(pts) : `<p>Your first session goes here. It takes about 28 minutes.</p>`}
    </div>
    <div class="card">
      <h3>Ledger</h3>
      <div class="stat">
        <div><span class="v">${s.ledger.repsBanked}</span><span class="mono muted">reps banked</span></div>
        <div><span class="v">${s.ledger.weeksCompleted}</span><span class="mono muted">weeks</span></div>
        <div><span class="v">${Math.round(s.ledger.hangSeconds / 60)}</span><span class="mono muted">min hanging</span></div>
      </div>
    </div>
    <div class="card">
      <h3>The ladder</h3>
      <ul class="ladder">
        ${RUNGS.map((r, i) => { const hit = s.milestones.some(m => m.id === r.id);
          return `<li class="rung${hit ? ' hit' : ''}"><span class="pip">${hit ? '✓' : i}</span>
            <b>${esc(r.label)}</b>${r.id === 4 ? `<span class="mono muted" style="margin-left:auto">finish</span>` : ''}</li>`;
        }).join('')}
      </ul>
    </div>
    ${s.levels.pull.maxReps < 1 ? `<div class="card">
      <h3>What makes up your score</h3>
      <ul class="list">
        ${Object.values(parts).map(p => `<li><span>${esc(p.label)}</span><span class="mono muted">${esc(p.detail)}</span></li>`).join('')}
      </ul>
      <p>Weighted, published, and yours to check. Nothing here is a black box.</p>
    </div>` : ''}`;
}

function chart(pts) {
  const w = 460, h = 150, pad = 8;
  const ys = pts.map(p => p.capability);
  const max = Math.max(...ys, 1) * 1.15, min = 0;
  const x = i => pad + (i / Math.max(1, pts.length - 1)) * (w - pad * 2);
  const y = v => h - pad - ((v - min) / (max - min)) * (h - pad * 2);
  const line = pts.map((p, i) => `${x(i).toFixed(1)},${y(p.capability).toFixed(1)}`).join(' ');
  return `<svg class="chart" viewBox="0 0 ${w} ${h}" role="img"
      aria-label="Capability rising from ${ys[0].toFixed(2)} to ${ys[ys.length - 1].toFixed(2)}">
      <polyline points="${line}" fill="none" stroke="var(--signal)" stroke-width="3"
        stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="${x(pts.length - 1).toFixed(1)}" cy="${y(ys[ys.length - 1]).toFixed(1)}" r="5" fill="var(--signal)"/>
    </svg>
    <div class="row" style="margin-top:6px"><span class="mono muted">${pts.length} sessions</span>
      <span class="mono">${ys[ys.length - 1].toFixed(2)}</span></div>`;
}

/* ── you ──────────────────────────────────────────────────────────────────── */
function youView() {
  const dark = document.documentElement.dataset.theme === 'dark';
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  return `
    <h1 class="screen">You</h1>
    <div class="card">
      <h3>Who’s training</h3>
      <div class="people">
        ${A.profiles.map(p => `<button class="who" data-act="switch" data-id="${p.id}">
            <span class="av${p.id === A.profile.id ? ' on' : ''}">${esc(p.initials)}</span>${esc(p.name)}</button>`).join('')}
        <button class="who" data-act="addProfile"><span class="av add">+</span>Add</button>
      </div>
      <p>Each person answers their own screening. Your bar’s weight rating is checked against each person’s bodyweight, not just the first one.</p>
    </div>
    ${!standalone ? `<div class="card">
      <h3>Put it on your home screen</h3>
      <p>${ios ? 'Tap the Share button in Safari, then “Add to Home Screen”. It then runs like an app, with no browser bar and no internet.'
                : 'Install it and it runs offline, full screen, like any other app.'}</p>
      ${!ios ? `<button class="btn ghost" data-act="install">Install</button>` : ''}
    </div>` : ''}
    <div class="card">
      <h3>Your data</h3>
      <p>All of it lives on this device. There is no account and nothing is uploaded.</p>
      <button class="btn ghost" data-act="export">Export everything (JSON)</button>
      <button class="btn quiet" data-act="persist">Ask the browser to keep it</button>
    </div>
    <div class="card">
      <h3>Appearance</h3>
      <button class="btn quiet" data-act="theme">${dark ? 'Switch to daylight' : 'Switch to night bar'}</button>
    </div>
    <div class="card">
      <h3>How the number works</h3>
      <p>Below one rep, capability is a weighted blend: hang 30%, row angle 20%, band assistance 20%, negatives 15%, scapular pulls 15%. Above one rep it is your verified max plus credit for practice since your last test. It never goes down within a phase.</p>
    </div>
    <div class="card">
      <h3>What this app won’t claim</h3>
      <p>Training burns roughly 150–280 kcal a session and about half of exercisers unconsciously eat it back. Diet is the lever for fat loss; training is what keeps the weight you lose from being muscle. That’s the whole honest story, and it’s why there’s no calorie counter here.</p>
    </div>
    <div class="card">
      <h3>Version</h3>
      <p>Build ${esc(BUILD)}</p>
      <p class="mono muted" id="swstate">checking the offline cache…</p>
    </div>
    ${A.profiles.length > 1 ? `<button class="btn danger" data-act="deleteProfile">Delete ${esc(A.profile.name)}’s profile</button>` : ''}`;
}

/** Which cache is actually serving this session. A build stamp alone can lie:
 *  the HTML can be fresh while an old service worker still hands out old JS. */
async function reportCache() {
  const el = document.getElementById('swstate');
  if (!el) return;
  try {
    const names = (await caches.keys()).filter(n => n.startsWith('firstrep-'));
    const ready = navigator.serviceWorker?.controller ? 'serving offline' : 'not yet offline-ready';
    el.textContent = names.length ? `${names.join(', ')} · ${ready}` : `no offline cache · ${ready}`;
  } catch { el.textContent = 'offline cache unavailable'; }
}

/* ── people sheet ─────────────────────────────────────────────────────────── */
function peopleSheet() {
  overlay.innerHTML = `<div class="sheet" data-act="closeSheet"><div class="sheetbody">
    <div class="mono muted">Who’s training?</div>
    <div class="people">
      ${A.profiles.map(p => `<button class="who" data-act="switch" data-id="${p.id}">
        <span class="av${p.id === A.profile.id ? ' on' : ''}">${esc(p.initials)}</span>${esc(p.name)}</button>`).join('')}
      <button class="who" data-act="addProfile"><span class="av add">+</span>Add</button>
    </div>
  </div></div>`;
}

/* ── session player ───────────────────────────────────────────────────────── */
let P = null, ticker = null, wakeLock = null;

function startSession() {
  const sess = nextSession(A.s, todayISO());
  const blocks = liveBlocks(sess);
  P = { sess, blocks, bi: 0, si: 0, mode: 'work', endsAt: 0, remaining: 0, ref: null,
        result: { pullReps: 0, minRir: 3, completed: true, bestHang: 0, bestSet: 0, testValue: null } };
  requestWakeLock();
  ticker = setInterval(paintPlayer, 200);
  paintPlayer();
}

async function requestWakeLock() {
  try { wakeLock = await navigator.wakeLock?.request('screen'); } catch { wakeLock = null; }
}

function endSession(save) {
  clearInterval(ticker); ticker = null;
  wakeLock?.release?.().catch(() => {}); wakeLock = null;
  overlay.innerHTML = '';
  const r = P.result, sess = P.sess; P = null;
  if (!save) return void render();
  commit(async () => {
    if (sess.isTest) {
      await emit('TEST_RESULT', sess.blocks.some(b => b.track === 'test' && b.unit === 's')
        ? { dateISO: todayISO(), hangSec: r.testValue || 0 }
        : { dateISO: todayISO(), maxReps: r.testValue || 0, pullReps: r.testValue || 0 });
    }
    await emit('SESSION_COMPLETED', {
      dateISO: todayISO(), pullReps: r.pullReps, minRir: r.minRir,
      completedAsPrescribed: r.completed,
      tracks: { hang: { bestSec: r.bestHang }, pull: { bestSet: r.bestSet }, push: { completed: true } }
    });
    A.animateCap = true; A.tab = 'today';
  }).then(render);
}

function paintPlayer() {
  if (!P) return;
  const b = P.blocks[P.bi];
  if (!b) return endSession(true);
  const timed = b.unit === 's' || b.unit === 'min';
  const total = P.blocks.length;

  if (P.mode === 'rest' || (P.mode === 'work' && timed && P.endsAt)) {
    P.remaining = Math.max(0, Math.ceil((P.endsAt - Date.now()) / 1000));
    if (P.remaining === 0) { beep(); nextStep(); return; }
  }

  /* The diagram belongs where there is time to look at it: before a set, and
   * during rest. Never while a timed set is running — you are on the bar. */
  const fig = diagramHTML(b, A.s, 'compact');
  const whatis = `<button class="whatis" data-act="ref" data-bi="${P.bi}">What is ${esc(b.name.toLowerCase())}?</button>`;

  const bodyHTML = P.ref !== null && P.ref !== undefined
    ? `${referenceHTML(P.blocks[P.ref] || b, A.s)}
       <div class="grow"></div>
       <button class="btn quiet" data-act="closeRef">Back to the session</button>`
    : P.mode === 'rest'
    ? `<div class="mono resting">Rest</div>
       <div class="bigtime resting">${fmtTime(P.remaining)}</div>
       <p class="cue">Next: ${esc(b.name)} · set ${P.si + 1} of ${b.sets}</p>
       ${fig}
       <div class="grow"></div>
       <button class="btn ghost" data-act="skipRest">Skip rest</button>`
    : timed && P.endsAt
      ? `<div class="mono muted">Set ${P.si + 1} of ${b.sets}</div>
         <h2 class="blocktitle">${esc(b.name)}</h2>
         <div class="bigtime">${fmtTime(P.remaining)}</div>
         <p class="cue">${esc(b.cue)}</p>
         <div class="grow"></div>
         <button class="btn ghost" data-act="stopEarly">Stop this set early</button>`
      : `<div class="mono muted">Set ${P.si + 1} of ${b.sets} · block ${P.bi + 1} of ${total}</div>
         <h2 class="blocktitle">${esc(b.name)}</h2>
         ${fig}
         <div class="bigtime">${b.target}${b.unit === 'reps' ? '' : b.unit === 's' ? 's' : ''}</div>
         <p class="cue">${esc(b.cue)}</p>
         ${whatis}
         <div class="dots">${Array.from({ length: b.sets }, (_, i) =>
            `<span class="dot${i < P.si ? ' done' : ''}"></span>`).join('')}</div>
         <div class="grow"></div>
         ${timed ? `<button class="btn" data-act="beginTimed">Start ${b.target}${b.unit === 's' ? ' seconds' : ' minutes'}</button>`
                 : `<button class="btn" data-act="setDone">Set done</button>
                    <button class="btn quiet" data-act="setShort">Couldn’t finish it</button>`}`;

  overlay.innerHTML = `<div class="player"><div class="inner">
    <div class="row">
      <span class="mono muted">${esc(P.sess.title)}${P.sess.deload ? ' · lighter' : ''}</span>
      <button class="btn small quiet" data-act="quit">Pause</button>
    </div>
    <div class="rule"><i style="width:${(P.bi / total) * 100}%"></i></div>
    <div style="height:18px"></div>
    ${bodyHTML}
  </div></div>`;
}

function nextStep() {
  P.ref = null;
  const b = P.blocks[P.bi];
  if (P.mode === 'work' && P.endsAt && (b.unit === 's')) recordTimed(b, b.target);   // ran the full set
  P.endsAt = 0;
  if (P.mode === 'rest') { P.mode = 'work'; return paintPlayer(); }
  P.si += 1;
  if (P.si >= b.sets) {
    if (['band', 'cluster', 'pull', 'neg'].includes(b.track)) return askRIR(b);
    return advanceBlock();
  }
  if (b.rest > 0) { P.mode = 'rest'; P.endsAt = Date.now() + b.rest * 1000; }
  paintPlayer();
}

function recordTimed(b, seconds) {
  if (['hang', 'cooldown', 'test'].includes(b.track)) P.result.bestHang = Math.max(P.result.bestHang, seconds);
  if (b.isTest) P.result.testValue = Math.max(P.result.testValue || 0, seconds);
}

function advanceBlock() {
  P.bi += 1; P.si = 0; P.mode = 'work'; P.endsAt = 0; P.ref = null;
  if (P.bi >= P.blocks.length) return endSession(true);
  paintPlayer();
}

function askRIR(b) {
  overlay.innerHTML = `<div class="player"><div class="inner">
    <div class="mono muted">${esc(b.name)}</div>
    <h2 class="blocktitle" style="margin-top:8px">How much did you have left on that last set?</h2>
    <div class="opts">
      <button class="opt" data-act="rir" data-v="3">Could have done 3 or more</button>
      <button class="opt" data-act="rir" data-v="2">1 or 2 more</button>
      <button class="opt" data-act="rir" data-v="0">Nothing left</button>
    </div>
    <p class="cue">Programmed sets should stop two or three short. If you’re hitting zero, the prescription is wrong — not you.</p>
  </div></div>`;
}

function fmtTime(sec) {
  const m = Math.floor(sec / 60), s = sec % 60;
  return m > 0 ? `${m}:${String(s).padStart(2, '0')}` : String(s);
}

/* ── audio + haptics (generated, so nothing to download) ──────────────────── */
let ac = null;
function beep(freq = 660, ms = 160) {
  try {
    ac = ac || new (window.AudioContext || window.webkitAudioContext)();
    const o = ac.createOscillator(), g = ac.createGain();
    o.frequency.value = freq; o.type = 'sine';
    g.gain.setValueAtTime(0.0001, ac.currentTime);
    g.gain.exponentialRampToValueAtTime(0.25, ac.currentTime + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + ms / 1000);
    o.connect(g); g.connect(ac.destination); o.start(); o.stop(ac.currentTime + ms / 1000 + 0.02);
  } catch {}
  navigator.vibrate?.(120);
}

/* ── the daily hang: two minutes, every day, the only streak here ─────────── */
let H = null, hangTick = null;
function openHangTimer() { H = null; paintHang(); }
function paintHang() {
  const secs = H ? Math.round((Date.now() - H.startedAt) / 1000) : 0;
  if (H && secs > 0 && secs % 15 === 0 && secs !== H.lastBeep) { H.lastBeep = secs; beep(760, 90); }
  overlay.innerHTML = `<div class="player"><div class="inner">
    <div class="row"><span class="mono muted">Daily hang</span>
      <button class="btn small quiet" data-act="hangCancel">Close</button></div>
    <div style="height:24px"></div>
    <h2 class="blocktitle">${H ? 'Hanging' : 'Hang for as long as you comfortably can'}</h2>
    <div class="bigtime">${fmtTime(secs)}</div>
    <p class="cue">${H ? 'Shoulders down and back, not shrugged up by your ears. Let go before your grip fails completely.'
      : 'Sixty seconds is the first rung. It counts even if you get nowhere near it today.'}</p>
    <div class="grow"></div>
    ${H ? `<button class="btn" data-act="hangStop">I'm down</button>`
        : `<button class="btn" data-act="hangStart">Start</button>`}
  </div></div>`;
}

/* ── exercise reference ───────────────────────────────────────────────────────
 * Inside a running session this renders through paintPlayer rather than into a
 * sheet of its own — the player repaints the overlay every 200ms and would
 * wipe anything else drawn there, and the rest clock must keep running. */
function referenceSheet(bi) {
  const t = todayISO();
  if (!isTrainingDay(t)) return;
  const b = liveBlocks(nextSession(A.s, t))[bi];
  if (!b) return;
  overlay.innerHTML = `<div class="sheet" data-act="closeSheet"><div class="sheetbody">
    ${referenceHTML(b, A.s)}
    <button class="btn quiet" data-act="closeRef">Close</button>
  </div></div>`;
}

/* ── what ended the hang ─────────────────────────────────────────────────────
 * One tap, asked once, straight after the hang. If grip is the answer twice in
 * three days the engine adds carries by itself and removes them the same way. */
function askLimiter(secs) {
  overlay.innerHTML = `<div class="player"><div class="inner">
    <div class="mono muted">${secs} seconds</div>
    <h2 class="blocktitle" style="margin-top:8px">What made you let go?</h2>
    <div class="opts">
      ${LIMITERS.map(o => `<button class="opt" data-act="limiter" data-v="${o.v}" data-secs="${secs}">${esc(o.l)}</button>`).join('')}
    </div>
    <p class="cue">If your grip goes before your back does, you never reached the dose we asked for. Worth knowing.</p>
  </div></div>`;
}

/* ── milestones ───────────────────────────────────────────────────────────── */
function showMilestone(m) {
  const s = A.s;
  overlay.innerHTML = `<div class="milestone">
    <div class="mono">Rung ${m.id + 1} of ${RUNGS.length}</div>
    <div class="big">${esc(m.label)}</div>
    <p>${m.id === 4 ? 'This was the finish line. Twenty strict reps is the practical goal for special-forces candidates and close to a top score on the Marine Corps test.'
        : `${s.ledger.weeksCompleted} weeks. ${s.ledger.repsBanked} reps banked getting here.`}</p>
    <div class="grow"></div>
    <button class="btn" data-act="closeMilestone">Keep going</button>
  </div>`;
}

/* ── events ───────────────────────────────────────────────────────────────── */
document.addEventListener('click', async ev => {
  const el = ev.target.closest('[data-act]'); if (!el) return;
  const act = el.dataset.act;

  if (act === 'start' || act === 'addProfile') { overlay.innerHTML = ''; A.screen = 'newProfile'; return render(); }
  if (act === 'cancelProfile') { A.screen = 'main'; return render(); }
  if (act === 'createProfile') {
    const name = $('#pname')?.value?.trim(); if (!name) return;
    A.profile = await db.createProfile(name);
    await db.setKV('activeProfileId', A.profile.id);
    A.profiles = await db.profiles();
    A.screen = 'screening'; A.qi = 0; A.answers = {}; return render();
  }
  if (act === 'answer') {
    A.answers[el.dataset.q] = el.dataset.v;
    if (A.qi >= ALL_QUESTIONS.length - 1) return finishScreening();
    A.qi += 1; return render();
  }
  if (act === 'back') { A.qi = Math.max(0, A.qi - 1); return render(); }
  if (act === 'toMain') { A.screen = 'main'; A.tab = 'today'; A.animateCap = true; return render(); }
  if (act === 'people') { return peopleSheet(); }
  if (act === 'closeSheet' && ev.target.classList.contains('sheet')) { overlay.innerHTML = ''; return; }
  if (act === 'switch') {
    overlay.innerHTML = '';
    A.profile = A.profiles.find(p => p.id === el.dataset.id);
    await db.setKV('activeProfileId', A.profile.id);
    if (!A.profile.screening) { A.screen = 'screening'; A.qi = 0; A.answers = {}; return render(); }
    await loadProfile(); A.screen = 'main'; A.tab = 'today'; A.animateCap = true; return render();
  }
  if (act === 'deleteProfile') {
    if (!confirm(`Delete ${A.profile.name}’s profile and all their history? This cannot be undone.`)) return;
    await db.deleteProfile(A.profile.id);
    A.profiles = await db.profiles(); A.profile = A.profiles[0];
    await db.setKV('activeProfileId', A.profile.id);
    await loadProfile(); A.tab = 'today'; return render();
  }
  if (act === 'startSession') { return startSession(); }
  if (act === 'hang') { return openHangTimer(); }
  if (act === 'hangStart') { H = { startedAt: Date.now() }; hangTick = setInterval(paintHang, 100); return paintHang(); }
  if (act === 'hangStop') {
    clearInterval(hangTick); hangTick = null;
    const secs = Math.round((Date.now() - H.startedAt) / 1000);
    H = null;
    if (secs < 3) { overlay.innerHTML = ''; return render(); }
    return askLimiter(Math.min(600, secs));
  }
  if (act === 'limiter') {
    const secs = parseInt(el.dataset.secs, 10);
    overlay.innerHTML = '';
    await commit(() => emit('HANG_LOGGED', { dateISO: todayISO(), seconds: secs, limiter: el.dataset.v }));
    A.animateCap = true;
    return render();
  }
  if (act === 'ref') {
    const bi = parseInt(el.dataset.bi, 10);
    if (P) { P.ref = bi; return paintPlayer(); }
    return referenceSheet(bi);
  }
  if (act === 'closeRef') {
    if (P) { P.ref = null; return paintPlayer(); }
    overlay.innerHTML = ''; return;
  }
  if (act === 'hangCancel') { clearInterval(hangTick); hangTick = null; H = null; overlay.innerHTML = ''; return; }
  if (act === 'pain') {
    const v = el.dataset.v;
    await emit('PAIN_CHECK', { forDate: el.dataset.d, answer: v });
    if (v === 'hurts') {
      const region = prompt('Where? Type shoulder, elbow or wrist.')?.toLowerCase().trim();
      if (['shoulder', 'elbow', 'wrist'].includes(region)) await emit('PAIN_FLAG', { region });
    }
    return render();
  }
  if (act === 'theme') {
    const dark = document.documentElement.dataset.theme === 'dark';
    document.documentElement.dataset.theme = dark ? 'light' : 'dark';
    await db.setKV('theme', dark ? 'light' : 'dark'); return render();
  }
  if (act === 'export') {
    const data = await db.exportAll();
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    const a = document.createElement('a'); a.href = url; a.download = `first-rep-${todayISO()}.json`; a.click();
    URL.revokeObjectURL(url); return;
  }
  if (act === 'persist') {
    const r = await db.requestPersistence();
    alert(r.granted ? 'Your data is marked as persistent. The browser won’t clear it to free space.'
      : r.supported ? 'The browser declined for now. Export a copy to be safe — it often grants this once you’ve used the app a few times.'
      : 'This browser doesn’t support persistent storage. Export a copy regularly.');
    return;
  }
  if (act === 'install') { A.installEvent?.prompt(); A.installEvent = null; return; }
  if (act === 'closeMilestone') { A.milestoneQueue.shift(); overlay.innerHTML = ''; return render(); }

  // player
  if (act === 'beginTimed') {
    const b = P.blocks[P.bi];
    P.endsAt = Date.now() + b.target * (b.unit === 'min' ? 60000 : 1000);
    beep(880, 120); return paintPlayer();
  }
  if (act === 'stopEarly') {
    const b = P.blocks[P.bi];
    const elapsed = Math.max(0, Math.round(b.target - Math.max(0, (P.endsAt - Date.now()) / 1000)));
    recordTimed(b, elapsed);
    if (elapsed < b.target * 0.8) P.result.completed = false;
    P.endsAt = 0; P.si += 1;
    if (P.si >= b.sets) return advanceBlock();
    if (b.rest > 0) { P.mode = 'rest'; P.endsAt = Date.now() + b.rest * 1000; }
    return paintPlayer();
  }
  if (act === 'setDone') {
    const b = P.blocks[P.bi];
    P.result.pullReps += b.perSet || 0;
    if (['band', 'cluster', 'pull'].includes(b.track)) P.result.bestSet = Math.max(P.result.bestSet, b.target);
    if (b.isTest) {
      const n = parseInt(prompt('How many strict reps?'), 10);
      P.result.testValue = isNaN(n) ? 0 : n; P.result.bestSet = Math.max(P.result.bestSet, P.result.testValue);
      P.result.pullReps += P.result.testValue;
    }
    return nextStep();
  }
  if (act === 'setShort') { P.result.completed = false; return nextStep(); }
  if (act === 'skipRest') { P.endsAt = 0; P.mode = 'work'; return paintPlayer(); }
  if (act === 'rir') {
    P.result.minRir = Math.min(P.result.minRir, parseInt(el.dataset.v, 10));
    return advanceBlock();
  }
  if (act === 'quit') {
    if (confirm('Pause and leave this session? Nothing is recorded, and nothing is held against you.')) endSession(false);
    return;
  }
});

document.addEventListener('click', ev => {
  const t = ev.target.closest('.tab'); if (!t) return;
  A.tab = t.dataset.tab; A.animateCap = A.tab === 'today'; render();
});

/* Timers survive a locked screen because they read the clock, not a tick count. */
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) { if (P) paintPlayer(); if (wakeLock === null && P) requestWakeLock(); }
});

boot();
