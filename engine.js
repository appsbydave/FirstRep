/* FIRST REP — training engine
 * Pure. No DOM, no storage, no randomness, no clock reads.
 * Everything here is a function of (events, date). See tests/engine.test.mjs.
 *
 * Source of truth: "Pull-up App Training Engine — Research Briefing", 11 Aug 2026.
 * Section references in comments point at that document.
 */

/* ── Hard limits (§7.2, §9.4) ─────────────────────────────────────────────── */
export const LIMITS = {
  SESSION_PULL_REPS: 30,      // app ceiling, well below NSW
  WEEK_PULL_REPS_EARLY: 75,   // first 6 months
  NSW_DAY: 50,                // never exceeded at any stage
  NSW_WEEK: 250
};

export const TRAINING_DAYS = [1, 3, 5];          // Mon / Wed / Fri, fixed dates
export const GRIPS = ['neutral', 'pronated', 'supinated'];

/* ── What ended the hang (§7.3 by extension) ──────────────────────────────────
 * Asked once, after the daily hang. Grip failing first is not a small detail:
 * it means the shoulder never reached the dose the session prescribed, and in
 * phase 0 it is half the exit criterion. Two of the last three answers being
 * grip switches on carries and wrist work; it switches off the same way. */
export const LIMITERS = [
  { v: 'grip',   l: 'My hands slipped or my forearms gave out' },
  { v: 'lats',   l: 'My back and shoulders gave out' },
  { v: 'skin',   l: 'My hands hurt' },
  { v: 'target', l: 'I let go with something left' }
];

export function hangAdvice(s) {
  const last = s.hangLimiters[s.hangLimiters.length - 1];
  if (last === 'grip') return 'Liquid chalk, thumb wrapped, and set the bar across the base of your fingers rather than deep in the palm. We have added carries to your sessions.';
  if (last === 'skin') return 'Skin catches up slower than muscle. Shorter holds more often beat one long one, and file any raised callus flat.';
  if (last === 'lats') return 'That is the hang doing its job. Shoulders down and away from the ears the whole time.';
  if (last === 'target') return 'Good. Stopping with something left is how this is meant to go.';
  return null;
}

/* ── Phases (§9.2) ────────────────────────────────────────────────────────── */
export const PHASES = [
  { n: 0, name: 'Foundations',      blurb: 'Hangs, scapular pulls, incline press-ups.' },
  { n: 1, name: 'Building the pull', blurb: 'Rows, band pull-ups and negatives, run together.' },
  { n: 2, name: 'The first rep',     blurb: 'Single-rep attempts, spread out, never to failure.' },
  { n: 3, name: 'Reps',              blurb: 'Easy volume at half your max. Practice, not punishment.' },
  { n: 4, name: 'Ten',               blurb: 'Ladders and clusters. Added load on the low-rep work.' },
  { n: 5, name: 'Twenty',            blurb: 'Two tracks: heavy and low, plus density work.' },
  { n: 6, name: 'Endgame',           blurb: 'Undated. Density, EMOMs, endurance.' }
];

export const RUNGS = [
  { id: 0, label: '60-second hang',  test: s => s.levels.hang.bestSec >= 60 },
  { id: 1, label: 'One clean rep',   test: s => s.levels.pull.maxReps >= 1 },
  { id: 2, label: 'Five reps',       test: s => s.levels.pull.maxReps >= 5 },
  { id: 3, label: 'Ten reps',        test: s => s.levels.pull.maxReps >= 10 },
  { id: 4, label: 'Twenty reps',     test: s => s.levels.pull.maxReps >= 20 },
  { id: 5, label: 'Fifty reps',      test: s => s.levels.pull.maxReps >= 50 }
];

export const PUSH_STAGES = [
  'Wall press-up', 'Incline press-up (counter)', 'Incline press-up (chair)',
  'Knee press-up', 'Full press-up', 'Close-grip press-up', 'Archer press-up', 'Decline press-up'
];

/* ── Small date helpers (local dates, no timezone drift) ──────────────────── */
export const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const parseISO = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const dayDiff = (a, b) => Math.round((parseISO(a) - parseISO(b)) / 86400000);
const mondayOf = d => { const x = new Date(d); const off = (x.getDay() + 6) % 7; x.setDate(x.getDate() - off); return x; };
const clamp01 = v => Math.max(0, Math.min(1, v || 0));

/* ── Initial state ────────────────────────────────────────────────────────── */
export function initialState(planStartISO = null) {
  return {
    planStartISO,
    phase: 0,
    levels: {
      hang: { bestSec: 0, targetSec: 10, sets: 3 },
      scap: { reps: 3, sets: 3 },
      row:  { angleDeg: 60, reps: 6, sets: 3 },   // 60° = easy, 30° = exit criterion
      band: { assist: 5, reps: 3, sets: 4 },      // 5 = heaviest help, 1 = lightest, 0 = none
      neg:  { sec: 2, reps: 2, sets: 3 },
      cluster: { attempts: 5 },
      pull: { maxReps: 0, bestSetSinceTest: 0 },
      push: { stage: 2, reps: 8, sets: 3 },
      grip: { carrySec: 20, sets: 3 }
    },
    pain: { shoulder: false, elbow: false, wrist: false },
    /* What stopped the last three daily hangs. If grip is the answer, the hang
     * you programmed is not the hang you got — the lats are being under-dosed. */
    hangLimiters: [],
    gripFocus: false,
    gripSessions: 0,
    ledger: { repsBanked: 0, sessionsCompleted: 0, weeksCompleted: 0, hangSeconds: 0 },
    hangStreak: 0,
    lastHangISO: null,
    sessionIndex: 0,
    goodRun: 0,
    failRun: 0,
    progressions: 0,
    lastChange: { week: -1, kind: null },   // never volume + difficulty in the same week
    lastTest: null,
    testHistory: [],
    sessionsSinceTest: 0,
    capabilityFloor: 0,
    milestones: [],
    history: []                              // {dateISO, capability, pullReps}
  };
}

/* ── Capability: the continuous score (§8.4, the whole point) ─────────────── */
export function capabilityParts(s) {
  const L = s.levels;
  return {
    hang: { w: 0.30, v: clamp01(L.hang.bestSec / 60),                   label: 'Hang',       detail: `${L.hang.bestSec}s of 60s` },
    scap: { w: 0.15, v: clamp01((L.scap.sets * L.scap.reps) / 24),      label: 'Scap pulls', detail: `${L.scap.sets}×${L.scap.reps} of 3×8` },
    row:  { w: 0.20, v: clamp01((60 - L.row.angleDeg) / 30),            label: 'Row angle',  detail: `${L.row.angleDeg}° of 30°` },
    band: { w: 0.20, v: clamp01((5 - L.band.assist) / 4),               label: 'Assistance', detail: `A${L.band.assist} of A1` },
    neg:  { w: 0.15, v: clamp01((L.neg.sec * L.neg.reps) / 15),         label: 'Negatives',  detail: `${L.neg.reps}×${L.neg.sec}s of 3×5s` }
  };
}

export function capability(s) {
  const L = s.levels;
  let raw;
  if (L.pull.maxReps >= 1) {
    // Verified reps, plus partial credit that always moves with practice.
    const beat = L.pull.bestSetSinceTest > L.pull.maxReps ? 0.55 : 0;
    const practice = 0.44 * clamp01(s.sessionsSinceTest / 12);
    raw = Math.min(50, L.pull.maxReps + Math.min(0.99, beat + practice));
  } else {
    const p = capabilityParts(s);
    raw = Math.min(0.99, Object.values(p).reduce((t, x) => t + x.w * x.v, 0));
  }
  // Monotonic within a phase: a bad day never subtracts (§8.3).
  return Math.max(raw, s.capabilityFloor);
}

/** What the user is currently chasing, in their own units. */
export function gapLabel(s) {
  const L = s.levels;
  if (L.pull.maxReps >= 1) return `${L.pull.maxReps + 1} reps next`;
  const p = capabilityParts(s);
  const weakest = Object.entries(p).sort((a, b) => (a[1].v - b[1].v))[0];
  switch (weakest[0]) {
    case 'hang': return `${Math.max(0, 60 - L.hang.bestSec)}s to go`;
    case 'scap': return `${Math.max(0, 8 - L.scap.reps)} more scap reps`;
    case 'row':  return `${Math.max(0, L.row.angleDeg - 30)}° to go`;
    case 'band': return L.band.assist > 1 ? 'one band lighter' : 'lightest band';
    default:     return `${Math.max(0, 5 - L.neg.sec)}s slower descent`;
  }
}

/* ── Week / calendar (§9.1 fixed dates, floating content) ─────────────────── */
export function weekIndex(s, dateISO) {
  if (!s.planStartISO) return 0;
  const start = mondayOf(parseISO(s.planStartISO));
  return Math.max(0, Math.floor((parseISO(dateISO) - start) / 604800000));
}
export const isDeloadWeek = w => (w + 1) % 5 === 0;                       // every 5th week, 50% sets
export const isTrainingDay = dateISO => TRAINING_DAYS.includes(parseISO(dateISO).getDay());
/** Test = Friday of a deload week, i.e. every 5 weeks — satisfies "every 4 weeks, never more often". */
export const isTestDay = (s, dateISO) => isDeloadWeek(weekIndex(s, dateISO)) && parseISO(dateISO).getDay() === 5;

/* ── Session generation ───────────────────────────────────────────────────── */
function pullBlock(s, grip, deload) {
  const L = s.levels;
  const half = n => deload ? Math.max(1, Math.round(n / 2)) : n;
  switch (s.phase) {
    case 0: return { track: 'hang', name: 'Active hang', sets: half(L.hang.sets), unit: 's',
                     target: L.hang.targetSec, rest: 90, perSet: 0,
                     cue: 'Shoulders down and back, ribs tucked. Stop the set with a few seconds left in you.' };
    case 1: return { track: 'band', name: `Band pull-ups · assist A${L.band.assist}`, sets: half(L.band.sets),
                     unit: 'reps', target: L.band.reps, rest: 120, perSet: L.band.reps,
                     cue: `${grip} grip. Full range. Leave 2–3 reps in the tank on every set.` };
    case 2: return { track: 'cluster', name: 'Single-rep attempts', sets: half(L.cluster.attempts),
                     unit: 'attempt', target: 1, rest: 90, pullReps: half(L.cluster.attempts),
                     cue: 'One honest attempt, then rest. Chin-up or neutral grip — whichever gets you there first.' };
    case 3: return { track: 'pull', name: 'Easy sets', sets: half(5), unit: 'reps',
                     target: Math.max(1, Math.round(L.pull.maxReps * 0.45)), rest: 120,
                     perSet: Math.max(1, Math.round(L.pull.maxReps * 0.45)),
                     cue: 'Well short of failure. This is practice, not a test.' };
    case 4: return { track: 'pull', name: 'Ladder', sets: half(4), unit: 'reps',
                     target: Math.max(2, Math.round(L.pull.maxReps * 0.6)), rest: 150,
                     perSet: Math.max(2, Math.round(L.pull.maxReps * 0.6)),
                     cue: 'Descending ladder. Add a backpack on the first two sets if these feel easy.' };
    default: return { track: 'pull', name: 'Density sets', sets: half(5), unit: 'reps',
                      target: Math.max(3, Math.round(L.pull.maxReps * 0.5)), rest: 90,
                      perSet: Math.max(3, Math.round(L.pull.maxReps * 0.5)),
                      cue: 'Short rests. Stop every set with three in reserve.' };
  }
}

export const SESSION_CAP = Math.min(LIMITS.SESSION_PULL_REPS, Math.floor(LIMITS.WEEK_PULL_REPS_EARLY / TRAINING_DAYS.length));

export function nextSession(state, dateISO) {
  const s = state;
  const w = weekIndex(s, dateISO);
  const deload = isDeloadWeek(w);
  const test = isTestDay(s, dateISO);
  const half = n => deload ? Math.max(1, Math.round(n / 2)) : n;

  // Grip rotates on a schedule (§7.3). A shoulder or elbow flag forces neutral.
  let grip = GRIPS[s.sessionIndex % GRIPS.length];
  const modified = s.pain.shoulder ? 'shoulder' : s.pain.elbow ? 'elbow' : s.pain.wrist ? 'wrist' : null;
  if (modified) grip = 'neutral';

  const blocks = [];
  blocks.push({ track: 'warmup', name: 'Warm-up', sets: 1, unit: 'min', target: 5, rest: 0, perSet: 0,
                cue: 'Arm circles, band pull-aparts, two 15-second hangs, five incline press-ups.' });

  if (test) {
    // From phase 2 the user is attempting reps, so the test is a rep attempt even at a max of zero.
    blocks.push((s.phase >= 2 || s.levels.pull.maxReps >= 1)
      ? { track: 'test', name: 'Test: max reps', sets: 1, unit: 'reps', target: Math.max(1, s.levels.pull.maxReps + 1),
          rest: 0, perSet: Math.min(SESSION_CAP, s.levels.pull.maxReps + 3), isTest: true,
          cue: 'One honest set. Strict, dead hang, chin over the bar, controlled down.' }
      : { track: 'test', name: 'Test: max hang', sets: 1, unit: 's', target: s.levels.hang.bestSec + 5,
          rest: 0, perSet: 0, isTest: true,
          cue: 'Hang until your grip genuinely goes. Shoulders stay active.' });
  } else {
    const main = pullBlock(s, grip, deload);
    if (modified === 'shoulder') { main.cue += ' Neutral grip only, and stop short of a full dead hang for now.'; main.sets = Math.max(1, Math.round(main.sets / 2)); }
    if (modified === 'elbow')    { main.cue += ' Neutral grip, half volume, slow and controlled.'; main.sets = Math.max(1, Math.round(main.sets / 2)); }
    blocks.push(main);

    if (s.phase === 0) blocks.push({ track: 'scap', name: 'Scapular pulls', sets: half(s.levels.scap.sets), unit: 'reps',
      target: s.levels.scap.reps, rest: 90, perSet: 0, cue: 'Arms stay straight. Two-second hold at the top.' });
    if (s.phase === 1) blocks.push({ track: 'neg', name: `Negatives · ${s.levels.neg.sec}s down`, sets: half(s.levels.neg.sets),
      unit: 'reps', target: s.levels.neg.reps, rest: 150, perSet: s.levels.neg.reps,
      cue: 'Step or jump to the top, then fight it down. No dropping in the last third.' });
  }

  // Horizontal pulling is kept at every phase, never just a regression (§7.3).
  blocks.push({ track: 'row', name: `Rows · ${s.levels.row.angleDeg}° from horizontal`, sets: half(s.levels.row.sets),
    unit: 'reps', target: s.levels.row.reps, rest: 90, perSet: 0,
    cue: 'Under a low bar or a sturdy table. Body straight, chest to the bar.' });

  blocks.push({ track: 'legs', name: 'Squats and lunges', sets: 2, unit: 'reps', target: 12, rest: 60, perSet: 0,
    cue: 'Lower body only, on purpose — it stays out of the way of your pulling recovery.' });
  blocks.push({ track: 'core', name: 'Plank', sets: 2, unit: 's', target: 30, rest: 45, perSet: 0, cue: 'Ribs down, glutes on.' });

  /* Grip work carries perSet 0, so it is invisible to the pull ceilings below —
   * correct, because a carry is not a pull rep. It appears and disappears on the
   * limiter answers alone and never touches the phase dials. */
  if (s.gripFocus && !test) {
    blocks.push({ track: 'carry', name: "Farmer's carry", sets: half(s.levels.grip.sets), unit: 's',
      target: s.levels.grip.carrySec, rest: 60, perSet: 0,
      cue: 'Something heavy in each hand. Stand tall and walk. Put them down while you still have grip left.' });
    blocks.push({ track: 'wrist', name: 'Band wrist extensions', sets: 2, unit: 'reps', target: 15, rest: 45, perSet: 0,
      cue: 'Light. Back of the hand leads, slow both ways. This is insurance against elbow pain, not a strength set.' });
  }

  blocks.push({ track: 'cooldown', name: 'Cool-down hang', sets: 1, unit: 's', target: 30, rest: 0, perSet: 0,
    cue: 'Relaxed, easy. Then the one-tap check.' });

  // Hard ceiling, enforced by trimming whole sets — never by trusting the caller (§9.4).
  const PULL_TRACKS = ['band', 'cluster', 'pull', 'neg', 'test'];
  const totalPull = () => blocks.reduce((t, b) => t + b.sets * (b.perSet || 0), 0);
  let guard = 0;
  while (totalPull() > SESSION_CAP && guard++ < 200) {
    const biggest = blocks.filter(b => b.perSet > 0 && b.sets > 1).sort((a, b) => b.sets * b.perSet - a.sets * a.perSet)[0];
    if (!biggest) break;
    biggest.sets -= 1;
  }

  // A single set can still exceed the cap at high rep counts: shrink the set itself.
  if (totalPull() > SESSION_CAP) {
    const b = blocks.filter(x => x.perSet > 0).sort((a, c) => c.perSet - a.perSet)[0];
    if (b) { const others = totalPull() - b.sets * b.perSet;
             b.perSet = Math.max(1, Math.floor((SESSION_CAP - others) / b.sets));
             b.target = Math.min(b.target, b.perSet); }
  }

  // Push volume never exceeds pull volume (§7.3, §9.1) — clamped after trimming.
  const pullSets = blocks.filter(b => PULL_TRACKS.includes(b.track) || b.track === 'hang').reduce((t, b) => t + b.sets, 0);
  const pushSets = Math.min(half(s.levels.push.sets), pullSets);
  if (pushSets > 0) blocks.splice(blocks.findIndex(b => b.track === 'legs'), 0,
    { track: 'push', name: PUSH_STAGES[s.levels.push.stage], sets: pushSets, unit: 'reps',
      target: s.levels.push.reps, rest: 90, perSet: 0, cue: 'Straight line from head to heels. Chest to fist depth.' });

  blocks.forEach(b => { b.pullReps = b.sets * (b.perSet || 0); });
  const total = totalPull();

  return {
    dateISO, week: w + 1, phase: s.phase, phaseName: PHASES[s.phase].name,
    grip, deload, isTest: test, modified,
    minutes: (test ? 20 : deload ? 18 : 28) + (s.gripFocus && !test ? 5 : 0),
    blocks, plannedPullReps: total,
    title: test ? 'Test day' : deload ? `${PHASES[s.phase].name} · lighter week` : PHASES[s.phase].name
  };
}

/* ── Progression, regression, phase transitions (§9.4) ────────────────────── */
const DIALS = {
  0: [
    { kind: 'volume',     can: L => L.hang.targetSec < 60, apply: L => { L.hang.targetSec = Math.min(60, L.hang.targetSec + 5); } },
    { kind: 'difficulty', can: L => L.scap.reps < 8,       apply: L => { L.scap.reps += 1; } }
  ],
  1: [
    { kind: 'volume',     can: L => L.band.reps < 5 || L.neg.reps < 3,
      apply: L => { L.band.reps = Math.min(5, L.band.reps + 1); L.neg.reps = Math.min(3, L.neg.reps + 1); } },
    { kind: 'difficulty', can: L => L.band.assist > 1 || L.neg.sec < 5,
      apply: L => { if (L.band.reps >= 5 && L.band.assist > 1) { L.band.assist -= 1; L.band.reps = 3; }
                    else { L.neg.sec = Math.min(5, L.neg.sec + 1); } } }
  ],
  2: [
    { kind: 'volume',     can: L => L.cluster.attempts < 8, apply: L => { L.cluster.attempts += 1; } },
    { kind: 'difficulty', can: L => L.band.assist > 0,      apply: L => { L.band.assist -= 1; } }
  ]
};
const defaultDials = [
  { kind: 'volume',     can: L => L.row.reps < 12,      apply: L => { L.row.reps += 1; } },
  { kind: 'difficulty', can: L => L.row.angleDeg > 20,  apply: L => { L.row.angleDeg -= 5; } }
];

function progressOne(s, w) {
  const dials = DIALS[s.phase] || defaultDials;
  // Rotate on progression count, not session count — session parity is constant
  // at progression points and would pin us to a single dial forever.
  for (let i = 0; i < dials.length; i++) {
    const d = dials[(s.progressions + i) % dials.length];
    if (!d.can(s.levels)) continue;                                   // saturated dial, try the other
    if (s.lastChange.week === w && s.lastChange.kind !== d.kind) continue;  // never both in one week (§7.2)
    d.apply(s.levels);
    s.lastChange = { week: w, kind: d.kind };
    s.progressions += 1;
    return;
  }
}

function regressOne(s) {
  const L = s.levels;
  switch (s.phase) {
    case 0: L.hang.targetSec = Math.max(5, L.hang.targetSec - 5); break;
    case 1: if (L.band.assist < 5) L.band.assist += 1; else L.band.reps = Math.max(2, L.band.reps - 1);
            L.neg.sec = Math.max(2, L.neg.sec - 1); break;
    case 2: L.cluster.attempts = Math.max(3, L.cluster.attempts - 1); break;
    default: L.row.angleDeg = Math.min(60, L.row.angleDeg + 5);
  }
  s.levels.row.reps = Math.max(6, s.levels.row.reps - 1);
}

function checkPhase(s) {
  const L = s.levels;
  const exits = [
    () => (L.hang.bestSec >= 30 && L.scap.reps >= 8) || L.pull.maxReps >= 1,
    () => (L.band.assist <= 1 && L.band.reps >= 5 && L.neg.sec >= 5 && L.neg.reps >= 3) || L.pull.maxReps >= 1,
    () => L.pull.maxReps >= 1,
    () => L.pull.maxReps >= 5,
    () => L.pull.maxReps >= 10,
    () => L.pull.maxReps >= 20
  ];
  while (s.phase < 6 && exits[s.phase] && exits[s.phase]()) {
    s.phase += 1;
    s.capabilityFloor = 0;            // re-baseline the floor on entering a new phase
    s.goodRun = 0; s.failRun = 0;
  }
}

function checkMilestones(s, dateISO) {
  RUNGS.forEach(r => {
    if (!s.milestones.some(m => m.id === r.id) && r.test(s)) s.milestones.push({ id: r.id, label: r.label, dateISO });
  });
}

/* ── The fold: events → state. Derived state is never persisted. ──────────── */
export function deriveState(events) {
  const s = initialState();
  for (const e of events) {
    switch (e.type) {
      case 'PLAN_STARTED': {
        s.planStartISO = e.payload.startISO;
        const L = e.payload.levels || {};
        Object.keys(L).forEach(k => { if (s.levels[k]) Object.assign(s.levels[k], L[k]); });
        break;
      }
      case 'HANG_LOGGED': {
        const sec = e.payload.seconds;
        s.levels.hang.bestSec = Math.max(s.levels.hang.bestSec, sec);
        s.ledger.hangSeconds += sec;
        const d = e.payload.dateISO;
        if (s.lastHangISO === null) s.hangStreak = 1;
        else if (d === s.lastHangISO) { /* same day, no change */ }
        else s.hangStreak = dayDiff(d, s.lastHangISO) === 1 ? s.hangStreak + 1 : 1;
        s.lastHangISO = d;
        // Optional field. Events logged before this existed fold exactly as before.
        if (e.payload.limiter) {
          s.hangLimiters.push(e.payload.limiter);
          if (s.hangLimiters.length > 3) s.hangLimiters.shift();
          s.gripFocus = s.hangLimiters.filter(l => l === 'grip').length >= 2;
        }
        break;
      }
      case 'SESSION_COMPLETED': {
        const p = e.payload;
        const w = weekIndex(s, p.dateISO);
        s.sessionIndex += 1;
        s.sessionsSinceTest += 1;
        s.ledger.sessionsCompleted += 1;
        s.ledger.repsBanked += (p.totalReps ?? p.pullReps) || 0;   // every rep counts, not just bar reps
        s.ledger.weeksCompleted = Math.max(s.ledger.weeksCompleted, w + 1);

        if (p.tracks) {
          const t = p.tracks;
          if (t.hang?.bestSec) s.levels.hang.bestSec = Math.max(s.levels.hang.bestSec, t.hang.bestSec);
          if (t.pull?.bestSet) s.levels.pull.bestSetSinceTest = Math.max(s.levels.pull.bestSetSinceTest, t.pull.bestSet);
          if (t.push?.completed && s.levels.push.reps >= 12 && s.levels.push.stage < PUSH_STAGES.length - 1) {
            s.levels.push.stage += 1; s.levels.push.reps = 8;
          } else if (t.push?.completed) s.levels.push.reps = Math.min(12, s.levels.push.reps + 1);
        }

        const completed = p.completedAsPrescribed !== false;
        const rir = p.minRir ?? 2;
        if (completed && rir >= 2) { s.goodRun += 1; s.failRun = 0; }
        else if (completed)        { s.goodRun = 0; }
        else                       { s.failRun += 1; s.goodRun = 0; }

        if (s.goodRun >= 2) { progressOne(s, w); s.goodRun = 0; }
        if (s.failRun >= 3) { regressOne(s); s.failRun = 0; }

        /* Grip runs on its own counter so it can never combine with a phase dial
         * and break the one-change-per-week invariant. Carries are low-risk and
         * are not pull volume, so they progress on completion alone. */
        if (s.gripFocus && completed) {
          s.gripSessions += 1;
          if (s.gripSessions % 3 === 0) s.levels.grip.carrySec = Math.min(45, s.levels.grip.carrySec + 5);
        }

        checkPhase(s);
        checkMilestones(s, p.dateISO);
        s.capabilityFloor = Math.max(s.capabilityFloor, capability(s));
        s.history.push({ dateISO: p.dateISO, capability: capability(s), pullReps: p.pullReps || 0 });
        break;
      }
      case 'TEST_RESULT': {
        const p = e.payload;
        if (typeof p.maxReps === 'number') {
          const prev = s.levels.pull.maxReps;
          s.levels.pull.maxReps = Math.max(prev, p.maxReps);
          s.testHistory.push({ dateISO: p.dateISO, maxReps: p.maxReps });
          // Two consecutive tests down → forced reduced week (§9.4)
          const h = s.testHistory;
          if (h.length >= 3 && h[h.length - 1].maxReps < h[h.length - 2].maxReps
              && h[h.length - 2].maxReps < h[h.length - 3].maxReps) regressOne(s);
        }
        if (typeof p.hangSec === 'number') {
          s.levels.hang.bestSec = Math.max(s.levels.hang.bestSec, p.hangSec);
          s.testHistory.push({ dateISO: p.dateISO, hangSec: p.hangSec });
        }
        s.levels.pull.bestSetSinceTest = 0;
        s.sessionsSinceTest = 0;
        s.lastTest = p.dateISO;
        checkPhase(s);
        checkMilestones(s, p.dateISO);
        s.capabilityFloor = Math.max(s.capabilityFloor, capability(s));
        s.history.push({ dateISO: p.dateISO, capability: capability(s), pullReps: p.maxReps || 0 });
        break;
      }
      case 'PAIN_FLAG': {
        s.pain[e.payload.region] = true;
        regressOne(s);
        s.goodRun = 0;
        break;
      }
      case 'PAIN_CLEARED': { s.pain[e.payload.region] = false; break; }
      default: break;
    }
  }
  return s;
}

/* ── Weekly volume accounting (§7.2 ceilings) ─────────────────────────────── */
export function weekPullReps(events, dateISO) {
  const monday = iso(mondayOf(parseISO(dateISO)));
  return events.filter(e =>
    (e.type === 'SESSION_COMPLETED' || e.type === 'TEST_RESULT') &&
    e.payload.dateISO >= monday && dayDiff(e.payload.dateISO, monday) < 7
  ).reduce((t, e) => t + (e.payload.pullReps || e.payload.maxReps || 0), 0);
}

/** Total hang seconds in the calendar week. Grip adapts on accumulated time
 *  under tension, not on best single hold — so this moves in the weeks when
 *  bestSec is stuck, which is exactly when the user needs something to move. */
export function weekHangSeconds(events, dateISO) {
  const monday = iso(mondayOf(parseISO(dateISO)));
  return events.filter(e => e.type === 'HANG_LOGGED' &&
    e.payload.dateISO >= monday && dayDiff(e.payload.dateISO, monday) < 7
  ).reduce((t, e) => t + (e.payload.seconds || 0), 0);
}

/* ── Missed-session handling (§8.3) ───────────────────────────────────────── */
export function missPolicy(daysSinceLastSession) {
  if (daysSinceLastSession <= 4)  return { action: 'none',     message: null };
  if (daysSinceLastSession <= 8)  return { action: 'resume',   message: 'Picking up where you left off.' };
  if (daysSinceLastSession <= 22) return { action: 'backup',   message: "We've backed you up one week so this session feels good." };
  return { action: 'retest', message: "It's been a while. One quick test and we'll put you back in the right place." };
}

/* ── Screening (§7.4) ─────────────────────────────────────────────────────── */
export function evaluateScreening(a) {
  const medical = ['q1', 'q2', 'q3', 'q5', 'q6', 'q7'].some(k => a[k] === 'yes');
  const jointFlag = a.q4 === 'yes';
  const shoulderHistory = a.q8 === 'yes' || a.q10 === 'yes';
  const currentPain = a.q9 === 'yes';
  const elbowHistory = a.q11 === 'yes';
  const neuro = a.q12 === 'yes';
  const barRated = a.q14 === 'yes';
  const edFlag = a.q20 === 'yes';

  const gates = [];
  if (medical) gates.push({ id: 'medical', level: 'stop', text: 'Get cleared by a doctor before you start training.' });
  if (currentPain || neuro) gates.push({ id: 'pain', level: 'stop', text: 'See a clinician about that pain before you hang from a bar.' });
  if (!barRated) gates.push({ id: 'equipment', level: 'stop', text: "We won't programme hanging work until your bar's weight rating is confirmed." });
  if (jointFlag || shoulderHistory || elbowHistory) gates.push({ id: 'modified', level: 'modify', text: 'You start on the modified track: neutral grip, longer row and isometric phases.' });

  const blocking = gates.filter(g => g.level === 'stop');
  return {
    cleared: blocking.length === 0,
    gates,
    track: gates.some(g => g.id === 'modified') ? 'modified' : 'standard',
    floorTrack: !barRated && !medical && !currentPain,   // rows and floor work still available
    suppressBody: edFlag,
    fatLoss: a.q21 === 'fatloss' || a.q21 === 'both',
    entry: entryLevels(a)
  };
}

function entryLevels(a) {
  const L = {};
  const hang = { '0': 0, '<10': 5, '10-30': 15, '>30': 35 }[a.q16] ?? 0;
  L.hang = { bestSec: hang, targetSec: Math.max(10, Math.round(hang / 5) * 5 || 10) };
  const reps = { '0': 0, '1-2': 1, '3-5': 3, '6-10': 6, '11+': 11 }[a.q17] ?? 0;
  L.pull = { maxReps: reps };
  const push = { '0': 1, '1-5': 3, '6-15': 4, '16+': 5 }[a.q18] ?? 1;
  L.push = { stage: push, reps: 8 };
  return L;
}

export function entryPhase(levels) {
  const s = initialState();
  Object.keys(levels).forEach(k => { if (s.levels[k]) Object.assign(s.levels[k], levels[k]); });
  checkPhase(s);
  return s.phase;
}
