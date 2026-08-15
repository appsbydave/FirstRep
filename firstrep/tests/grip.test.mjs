/* FIRST REP — invariants for grip work and the exercise reference.
 * Same contract as engine.test.mjs: these are build-failing tests, not intentions.
 *
 *   node --test tests/grip.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  deriveState, nextSession, initialState, weekHangSeconds,
  LIMITS, LIMITERS, SESSION_CAP, PUSH_STAGES
} from '../js/engine.js';
import { EXERCISES, PUSH, exerciseFor, referenceHTML, diagramHTML } from '../js/exercises.js';

const START = '2026-08-03';                      // a Monday
const plan = () => [{ type: 'PLAN_STARTED', payload: { startISO: START, levels: {} } }];
const hang = (dateISO, seconds, limiter) =>
  ({ type: 'HANG_LOGGED', payload: limiter ? { dateISO, seconds, limiter } : { dateISO, seconds } });
const session = (dateISO, extra = {}) =>
  ({ type: 'SESSION_COMPLETED', payload: { dateISO, pullReps: 0, minRir: 3, ...extra } });

/** Every phase crossed with every plausible strength level. */
function* allStates({ gripFocus = false } = {}) {
  for (let phase = 0; phase <= 6; phase++) {
    for (let maxReps = 0; maxReps <= 50; maxReps++) {
      const s = deriveState(plan());
      s.phase = phase; s.levels.pull.maxReps = maxReps;
      s.gripFocus = gripFocus; s.levels.grip.carrySec = 45;
      yield s;
    }
  }
}
const PULL_TRACKS = ['band', 'cluster', 'pull', 'neg', 'test'];

/* ── 14. The limiter field is additive ─────────────────────────────────────── */
test('a hang logged without a limiter folds exactly as it did before', () => {
  const legacy = deriveState([...plan(), hang('2026-08-03', 18), hang('2026-08-04', 24)]);
  assert.equal(legacy.levels.hang.bestSec, 24);
  assert.equal(legacy.hangStreak, 2);
  assert.equal(legacy.ledger.hangSeconds, 42);
  assert.equal(legacy.gripFocus, false);
  assert.deepEqual(legacy.hangLimiters, []);
});

/* ── 15. Grip work switches itself on, and off again ──────────────────────── */
test('two grip answers in the last three switch grip work on', () => {
  const s = deriveState([...plan(), hang('2026-08-03', 20, 'lats'), hang('2026-08-04', 18, 'grip'), hang('2026-08-05', 17, 'grip')]);
  assert.equal(s.gripFocus, true);
});

test('one grip answer in the last three does not', () => {
  const s = deriveState([...plan(), hang('2026-08-03', 20, 'grip'), hang('2026-08-04', 22, 'lats'), hang('2026-08-05', 24, 'target')]);
  assert.equal(s.gripFocus, false);
});

test('grip work tapers off once grip stops being the limiter', () => {
  const on = [...plan(), hang('2026-08-03', 18, 'grip'), hang('2026-08-04', 18, 'grip')];
  assert.equal(deriveState(on).gripFocus, true);
  const off = [...on, hang('2026-08-05', 26, 'lats'), hang('2026-08-06', 30, 'lats')];
  assert.equal(deriveState(off).gripFocus, false);
});

test('the window never grows past three answers', () => {
  const evs = [...plan()];
  for (let i = 3; i <= 9; i++) evs.push(hang(`2026-08-0${i}`, 20, 'grip'));
  assert.equal(deriveState(evs).hangLimiters.length, 3);
});

test('every limiter option the UI offers is a value the engine accepts', () => {
  for (const { v } of LIMITERS) {
    const s = deriveState([...plan(), hang('2026-08-03', 20, v)]);
    assert.deepEqual(s.hangLimiters, [v], `limiter ${v} was not recorded`);
  }
});

/* ── 16. Grip work is not pull volume ─────────────────────────────────────── */
test('carries and wrist work never add a single pull rep', () => {
  for (const s of allStates({ gripFocus: true })) {
    for (const day of ['2026-08-03', '2026-08-05', '2026-09-04']) {
      for (const b of nextSession(s, day).blocks) {
        if (['carry', 'wrist'].includes(b.track)) {
          assert.equal(b.perSet || 0, 0, `${b.track} declared perSet in phase ${s.phase}`);
          assert.equal(b.pullReps, 0, `${b.track} counted pull reps in phase ${s.phase}`);
        }
      }
    }
  }
});

test('the session and week ceilings hold with grip work switched on', () => {
  let worstSession = 0, worstWeek = 0;
  for (const s of allStates({ gripFocus: true })) {
    let week = 0;
    for (const day of ['2026-08-03', '2026-08-05', '2026-08-07']) {
      const sess = nextSession(s, day);
      worstSession = Math.max(worstSession, sess.plannedPullReps);
      week += sess.plannedPullReps;
    }
    worstWeek = Math.max(worstWeek, week);
  }
  assert.ok(worstSession <= SESSION_CAP, `session ${worstSession} > cap ${SESSION_CAP}`);
  assert.ok(worstSession <= LIMITS.NSW_DAY);
  assert.ok(worstWeek <= LIMITS.WEEK_PULL_REPS_EARLY, `week ${worstWeek}`);
  assert.ok(worstWeek <= LIMITS.NSW_WEEK);
});

test('push sets still never exceed pull sets with grip work switched on', () => {
  for (const s of allStates({ gripFocus: true })) {
    const sess = nextSession(s, '2026-08-05');
    const pull = sess.blocks.filter(b => PULL_TRACKS.includes(b.track) || b.track === 'hang')
      .reduce((t, b) => t + b.sets, 0);
    const push = sess.blocks.filter(b => b.track === 'push').reduce((t, b) => t + b.sets, 0);
    assert.ok(push <= pull, `phase ${s.phase}: push ${push} > pull ${pull}`);
  }
});

/* ── 17. Grip progression cannot collide with a phase dial ────────────────── */
test('carry progression never touches lastChange, so it cannot break the one-change-per-week rule', () => {
  const evs = [...plan(), hang('2026-08-03', 18, 'grip'), hang('2026-08-04', 18, 'grip')];
  for (let i = 0; i < 12; i++) evs.push(session('2026-08-05'));
  const s = deriveState(evs);
  const fresh = initialState();
  assert.ok(s.levels.grip.carrySec > fresh.levels.grip.carrySec, 'carries never progressed');
  // lastChange is owned solely by progressOne; grip must not be recorded there
  assert.ok(s.lastChange.kind === null || ['volume', 'difficulty'].includes(s.lastChange.kind));
});

test('carry duration is capped', () => {
  const evs = [...plan(), hang('2026-08-03', 18, 'grip'), hang('2026-08-04', 18, 'grip')];
  for (let i = 0; i < 200; i++) evs.push(session('2026-08-05'));
  assert.ok(deriveState(evs).levels.grip.carrySec <= 45);
});

test('a failed session does not progress the carries', () => {
  const base = [...plan(), hang('2026-08-03', 18, 'grip'), hang('2026-08-04', 18, 'grip')];
  const evs = [...base];
  for (let i = 0; i < 9; i++) evs.push(session('2026-08-05', { completedAsPrescribed: false }));
  assert.equal(deriveState(evs).gripSessions, 0);
  assert.equal(deriveState(evs).levels.grip.carrySec, initialState().levels.grip.carrySec);
});

test('grip work is dropped on test days', () => {
  const s = deriveState([...plan(), hang('2026-08-03', 18, 'grip'), hang('2026-08-04', 18, 'grip')]);
  const testDay = '2026-09-04';                     // Friday of week 5, a deload week
  const sess = nextSession(s, testDay);
  assert.ok(sess.isTest, 'expected a test day');
  assert.ok(!sess.blocks.some(b => ['carry', 'wrist'].includes(b.track)));
});

test('nextSession is still pure with grip work switched on', () => {
  const s = deriveState([...plan(), hang('2026-08-03', 18, 'grip'), hang('2026-08-04', 18, 'grip')]);
  const before = JSON.stringify(s);
  nextSession(s, '2026-08-05');
  assert.equal(JSON.stringify(s), before);
});

/* ── 18. Weekly hang volume ───────────────────────────────────────────────── */
test('weekly hang seconds counts the calendar week and nothing outside it', () => {
  const evs = [hang('2026-08-02', 100), hang('2026-08-03', 20), hang('2026-08-09', 30), hang('2026-08-10', 999)];
  assert.equal(weekHangSeconds(evs, '2026-08-05'), 50);   // Sun 2nd and Mon 10th both excluded
});

/* ── 19. Every prescribed block has a diagram and a full reference ────────── */
test('every block the engine can emit resolves to a diagram', () => {
  const seen = new Set(), missing = new Set();
  for (const s of allStates({ gripFocus: true })) {
    for (const day of ['2026-08-03', '2026-08-05', '2026-09-04']) {
      for (const b of nextSession(s, day).blocks) {
        seen.add(b.track);
        if (!exerciseFor(b, s)) missing.add(b.track);
        if (!diagramHTML(b, s).includes('<svg')) missing.add(`${b.track}:no-svg`);
      }
    }
  }
  assert.deepEqual([...missing], [], 'unresolved tracks');
  // guard against a new track being added to the engine without a diagram
  assert.ok(seen.size >= 14, `only ${seen.size} tracks exercised`);
});

test('every reference page carries a name, a why, cues, a mistake and a feel', () => {
  for (const s of allStates({ gripFocus: true })) {
    if (s.levels.pull.maxReps % 17) continue;                   // sample; the shape is per-track
    for (const day of ['2026-08-03', '2026-09-04']) {
      for (const b of nextSession(s, day).blocks) {
        const h = referenceHTML(b, s);
        for (const need of ['<svg', 'fr-h', 'fr-why', 'fr-cues', 'Most common mistake', 'It should feel like']) {
          assert.ok(h.includes(need), `${b.track} reference missing ${need}`);
        }
      }
    }
  }
});

test('the press-up reference stays in lockstep with PUSH_STAGES', () => {
  assert.equal(PUSH.length, PUSH_STAGES.length);
  PUSH_STAGES.forEach((name, i) => {
    assert.equal(PUSH[i].name, name, `stage ${i} name drifted`);
    const e = exerciseFor({ track: 'push' }, { levels: { push: { stage: i } } });
    assert.equal(e.key, `push:${i}`);
    assert.ok(e.svg().includes('<svg'));
  });
});

test('an out-of-range push stage still resolves rather than throwing', () => {
  for (const stage of [-1, 99, undefined]) {
    const e = exerciseFor({ track: 'push' }, { levels: { push: { stage } } });
    assert.ok(e && e.svg().includes('<svg'), `stage ${stage} failed`);
  }
});

test('the test block splits into a hang and a rep version', () => {
  const s = deriveState(plan());
  assert.match(exerciseFor({ track: 'test', unit: 's' }, s).name, /hang/i);
  assert.match(exerciseFor({ track: 'test', unit: 'reps' }, s).name, /reps/i);
  assert.notEqual(exerciseFor({ track: 'test', unit: 's' }, s).key,
                  exerciseFor({ track: 'test', unit: 'reps' }, s).key);
});

test('the row and band diagrams actually change with the level', () => {
  const at = (path, value) => { const s = deriveState(plan()); path(s, value); return s; };
  const rowA = diagramHTML({ track: 'row' }, at((s, v) => s.levels.row.angleDeg = v, 60));
  const rowB = diagramHTML({ track: 'row' }, at((s, v) => s.levels.row.angleDeg = v, 20));
  assert.notEqual(rowA, rowB, 'row diagram ignored the angle');
  const bandA = diagramHTML({ track: 'band' }, at((s, v) => s.levels.band.assist = v, 5));
  const bandB = diagramHTML({ track: 'band' }, at((s, v) => s.levels.band.assist = v, 1));
  assert.notEqual(bandA, bandB, 'band diagram ignored the assistance level');
});

/* ── 20. Red is reserved, and so is amber ─────────────────────────────────── */
test('no diagram reaches for --crest or --stop, or hard-codes a colour', () => {
  const s = deriveState(plan());
  s.gripFocus = true;
  const all = [
    ...Object.keys(EXERCISES).map(track => diagramHTML({ track, unit: 'reps' }, s)),
    ...PUSH.map(p => p.svg())
  ].join('');
  assert.ok(!all.includes('crest'), 'amber is milestones only');
  assert.ok(!all.includes('--stop'), 'red is pain flags and hard gates only');
  assert.ok(!/#[0-9a-fA-F]{3,6}\b/.test(all), 'a colour was hard-coded instead of tokenised');
});
