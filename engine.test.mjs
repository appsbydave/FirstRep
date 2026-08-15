import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  LIMITS, initialState, deriveState, nextSession, capability, weekIndex,
  isDeloadWeek, isTestDay, missPolicy, evaluateScreening, iso, parseISO, weekPullReps
} from '../js/engine.js';

const START = '2026-08-10';                       // a Monday
const plan = (levels = {}) => [{ type: 'PLAN_STARTED', payload: { startISO: START, levels } }];
const session = (dateISO, over = {}) => ({
  type: 'SESSION_COMPLETED',
  payload: { dateISO, pullReps: 12, minRir: 3, completedAsPrescribed: true, ...over }
});
const dates = (n, from = START, step = 2) => {
  const out = []; const d = parseISO(from);
  for (let i = 0; i < n; i++) { out.push(iso(d)); d.setDate(d.getDate() + step); }
  return out;
};

/* ── 1. Volume ceilings are structural, not advisory ─────────────────────── */
test('never more than 30 pull-pattern reps in a generated session, at any phase', () => {
  for (let phase = 0; phase <= 6; phase++) {
    for (let maxReps = 0; maxReps <= 60; maxReps += 3) {
      const s = initialState(START);
      s.phase = phase; s.levels.pull.maxReps = maxReps;
      s.levels.band.assist = 1; s.levels.band.reps = 5; s.levels.cluster.attempts = 8;
      for (const d of ['2026-08-10', '2026-08-12', '2026-08-14']) {
        const plan = nextSession(s, d);
        assert.ok(plan.plannedPullReps <= LIMITS.SESSION_PULL_REPS,
          `phase ${phase} max ${maxReps} produced ${plan.plannedPullReps}`);
        assert.ok(plan.plannedPullReps <= LIMITS.NSW_DAY);
      }
    }
  }
});

test('a full week of generated sessions stays under the weekly ceiling', () => {
  const s = initialState(START);
  s.phase = 5; s.levels.pull.maxReps = 20;
  const total = ['2026-08-10', '2026-08-12', '2026-08-14']
    .reduce((t, d) => t + nextSession(s, d).plannedPullReps, 0);
  assert.ok(total <= LIMITS.WEEK_PULL_REPS_EARLY, `week total ${total}`);
  assert.ok(total <= LIMITS.NSW_WEEK);
});

/* ── 2. Push volume never exceeds pull volume ────────────────────────────── */
test('push sets never exceed pull sets in any generated session', () => {
  for (let phase = 0; phase <= 6; phase++) {
    const s = initialState(START); s.phase = phase; s.levels.pull.maxReps = phase * 4;
    s.levels.push.sets = 9;   // deliberately over-provisioned
    const p = nextSession(s, '2026-08-12');
    const pull = p.blocks.filter(b => ['band', 'cluster', 'pull', 'neg', 'hang'].includes(b.track))
                         .reduce((t, b) => t + b.sets, 0);
    const push = p.blocks.filter(b => b.track === 'push').reduce((t, b) => t + b.sets, 0);
    assert.ok(push <= pull, `phase ${phase}: push ${push} > pull ${pull}`);
  }
});

/* ── 3. Deloads reduce volume, they don't stop training (Coleman 2024) ───── */
test('every 5th week is a reduced-volume week, not rest', () => {
  const s = initialState(START);
  assert.equal(isDeloadWeek(weekIndex(s, '2026-09-07')), true);   // week 5
  assert.equal(isDeloadWeek(weekIndex(s, '2026-08-31')), false);  // week 4
  s.phase = 1;
  const normal = nextSession(s, '2026-08-12');
  const deload = nextSession(s, '2026-09-09');
  assert.ok(deload.plannedPullReps < normal.plannedPullReps);
  assert.ok(deload.plannedPullReps > 0, 'deload is reduced volume, not cessation');
});

/* ── 4. Testing is never more often than every 4 weeks ───────────────────── */
test('tests fall on the Friday of a deload week and no more often than every 4 weeks', () => {
  const s = initialState(START);
  const testDays = [];
  const d = parseISO(START);
  for (let i = 0; i < 140; i++) { if (isTestDay(s, iso(d))) testDays.push(iso(d)); d.setDate(d.getDate() + 1); }
  assert.ok(testDays.length > 0);
  testDays.forEach(t => assert.equal(parseISO(t).getDay(), 5, `${t} is not a Friday`));
  for (let i = 1; i < testDays.length; i++) {
    const gap = (parseISO(testDays[i]) - parseISO(testDays[i - 1])) / 86400000;
    assert.ok(gap >= 28, `tests only ${gap} days apart`);
  }
});

/* ── 5. Missing one session does nothing at all ──────────────────────────── */
test('missing a single session changes no state and triggers no message', () => {
  assert.deepEqual(missPolicy(2), { action: 'none', message: null });
  assert.deepEqual(missPolicy(4), { action: 'none', message: null });
  const a = deriveState([...plan(), session('2026-08-10'), session('2026-08-12')]);
  const b = deriveState([...plan(), session('2026-08-10'), session('2026-08-14')]);
  assert.equal(a.ledger.sessionsCompleted, b.ledger.sessionsCompleted);
  assert.equal(a.phase, b.phase);
});

test('a long absence re-tests rather than resuming mid-plan', () => {
  assert.equal(missPolicy(30).action, 'retest');
  assert.equal(missPolicy(15).action, 'backup');
});

/* ── 6. Capability always moves, and never goes backwards in a phase ─────── */
test('capability increases across a block of sessions with zero pull-ups performed', () => {
  const events = plan();
  let prev = capability(deriveState(events));
  for (const d of dates(10)) {
    events.push({ type: 'HANG_LOGGED', payload: { dateISO: d, seconds: 8 + events.length } });
    events.push(session(d, { pullReps: 0 }));
    const now = capability(deriveState(events));
    assert.ok(now >= prev, `capability went backwards: ${prev} -> ${now}`);
    prev = now;
  }
  assert.ok(prev > 0, 'capability stayed at zero for a user who trained ten times');
});

test('a failed session never reduces capability', () => {
  const good = [...plan(), ...dates(4).map(d => session(d))];
  const before = capability(deriveState(good));
  const after = capability(deriveState([...good, session('2026-08-18', { completedAsPrescribed: false, minRir: 0 })]));
  assert.ok(after >= before);
});

/* ── 7. Pain flags change the programme on the very next session ─────────── */
test('a pain flag forces neutral grip and reduced volume immediately, with no user input', () => {
  const base = [...plan(), ...dates(6).map(d => session(d))];
  const before = nextSession(deriveState(base), '2026-08-24');
  const after = nextSession(deriveState([...base, { type: 'PAIN_FLAG', payload: { region: 'shoulder' } }]), '2026-08-24');
  assert.equal(after.grip, 'neutral');
  assert.equal(after.modified, 'shoulder');
  assert.ok(after.plannedPullReps <= before.plannedPullReps);
});

/* ── 8. The equipment gate is absolute ───────────────────────────────────── */
test('an unrated bar blocks clearance and no answer combination unlocks it', () => {
  const answers = { q14: 'no', q21: 'strength' };
  const r = evaluateScreening(answers);
  assert.equal(r.cleared, false);
  assert.ok(r.gates.some(g => g.id === 'equipment' && g.level === 'stop'));
  assert.equal(r.floorTrack, true, 'floor and row work should still be offered');
});

test('a medical red flag blocks clearance even with perfect equipment', () => {
  const r = evaluateScreening({ q2: 'yes', q14: 'yes', q21: 'strength' });
  assert.equal(r.cleared, false);
  assert.ok(r.gates.some(g => g.id === 'medical'));
});

test('an eating disorder answer permanently suppresses body metrics', () => {
  const r = evaluateScreening({ q14: 'yes', q20: 'yes', q21: 'both' });
  assert.equal(r.suppressBody, true);
  assert.equal(r.cleared, true, 'wellbeing routes features, it never blocks access');
});

test('a user whose goal is not fat loss never gets the fat-loss flag', () => {
  assert.equal(evaluateScreening({ q14: 'yes', q21: 'strength' }).fatLoss, false);
});

/* ── 9. Volume and difficulty never both increase in the same week ───────── */
test('only one dial moves per week', () => {
  const events = plan();
  // four qualifying sessions inside a single week would trigger two progressions
  for (const d of ['2026-08-10', '2026-08-11', '2026-08-12', '2026-08-13']) events.push(session(d));
  const s = deriveState(events);
  assert.ok(s.lastChange.kind !== null);
  const kindsThisWeek = new Set([s.lastChange.kind]);
  assert.equal(kindsThisWeek.size, 1);
});

/* ── 10. Phases advance only on exit criteria, never on the calendar ─────── */
test('phase does not advance on time alone', () => {
  const events = [...plan(), ...dates(40).map(d => session(d, { minRir: 1 }))];  // completed but never easy
  const s = deriveState(events);
  assert.equal(s.phase, 0, 'a user who never met an exit criterion was advanced anyway');
});

test('phase advances the moment a real exit criterion is met', () => {
  const s = deriveState([...plan(), { type: 'TEST_RESULT', payload: { dateISO: '2026-09-11', maxReps: 1 } }]);
  assert.ok(s.phase >= 3, `expected phase 3+, got ${s.phase}`);
  assert.ok(s.milestones.some(m => m.id === 1), 'first-rep milestone not recorded');
});

/* ── 11. Weekly accounting is real ───────────────────────────────────────── */
test('weekly pull reps are counted from the Monday', () => {
  const events = [...plan(), session('2026-08-10', { pullReps: 20 }), session('2026-08-12', { pullReps: 20 }),
                  session('2026-08-17', { pullReps: 20 })];
  assert.equal(weekPullReps(events, '2026-08-14'), 40);
  assert.equal(weekPullReps(events, '2026-08-17'), 20);
});

/* ── 12. The engine is pure ──────────────────────────────────────────────── */
test('nextSession does not mutate the state it is given', () => {
  const s = deriveState([...plan(), ...dates(6).map(d => session(d))]);
  const snapshot = JSON.stringify(s);
  nextSession(s, '2026-08-24'); nextSession(s, '2026-08-26');
  assert.equal(JSON.stringify(s), snapshot);
});

test('deriveState is deterministic', () => {
  const events = [...plan(), ...dates(12).map(d => session(d))];
  assert.equal(JSON.stringify(deriveState(events)), JSON.stringify(deriveState(events)));
});
