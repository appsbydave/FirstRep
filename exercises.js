/* FIRST REP — exercise reference.
 *
 * Every diagram is inline SVG built from one small pose primitive. No image
 * assets, no extra requests, no build step, nothing for the service worker to
 * miss. Figures are schematic on purpose: a stick figure at 300px reads at a
 * glance on a phone held at arm's length mid-set, a rendered photograph does not.
 *
 * Colour discipline (README — "Red is reserved"):
 *   --fr-bar    steel-900, the same value and weight as .thebar. The bar is the constant.
 *   --fr-body   steel-500, the parts of you that are just along for the ride.
 *   --fr-live   signal, and only ever on the thing the exercise is actually about.
 *   --fr-ghost  steel-200, where you started or where you are going.
 * --crest and --stop never appear in a diagram. Milestones and pain own those.
 *
 * `track` is not one-to-one with movement, so resolve through exerciseFor()
 * rather than indexing EXERCISES by track directly:
 *   push    → eight distinct movements, keyed on levels.push.stage
 *   pull    → one movement under three names (Easy sets / Ladder / Density sets)
 *   test    → splits on unit: 's' is a max hang, 'reps' is a max attempt
 *   row     → drawn from levels.row.angleDeg, so the picture steepens as you do
 *   band    → drawn from levels.band.assist, so the band thins as you do
 */

/* ── drawing primitives ───────────────────────────────────────────────────── */
const d = pts => 'M ' + pts.map(p => `${r2(p[0])} ${r2(p[1])}`).join(' L ');
const r2 = n => Math.round(n * 10) / 10;
const ln = (pts, k = 'body') => `<path class="fr-${k}" d="${d(pts)}"/>`;
const hd = ([x, y], k = 'body', rad = 14) => `<circle class="fr-${k} fr-fill" cx="${r2(x)}" cy="${r2(y)}" r="${rad}"/>`;
const bar = (y, x1 = 46, x2 = 254) => `<path class="fr-bar" d="${d([[x1, y], [x2, y]])}"/>`;
const floor = (y = 182, x1 = 20, x2 = 280) => `<path class="fr-floor" d="${d([[x1, y], [x2, y]])}"/>`;
const ref = (y, x1 = 40, x2 = 260) => `<path class="fr-ref" d="${d([[x1, y], [x2, y]])}"/>`;
const rad = deg => (deg * Math.PI) / 180;

const svg = (vb, body) =>
  `<svg class="fr-ex" viewBox="${vb}" role="img" preserveAspectRatio="xMidYMid meet" focusable="false">${body}</svg>`;

/* ── front view, hanging ──────────────────────────────────────────────────────
 * Arms are straight and the hands are fixed, so the shoulder joint cannot move.
 * The change is that the ribcage rises relative to that joint — which is what a
 * scapular pull physically is, and why it looks like almost nothing is happening.
 *
 * Two panels rather than one animated figure. An inch of real travel drawn at
 * phone size needs exaggeration and a fixed reference to be legible at all, and
 * a loop running next to a rest clock competes with the clock. Side by side,
 * against a shared dashed line, the difference reads at a glance and stays put.
 */
const BAR_Y = 32, SH_Y = 112, PANEL = '0 0 300 248';
function hangPanel(cx, rise, live) {
  const t = SH_Y - rise, k = 'body', j = live ? 'live' : 'body';
  return [
    `<path class="fr-bar" d="M ${cx - 56} ${BAR_Y} L ${cx + 56} ${BAR_Y}"/>`,
    ln([[cx - 36, BAR_Y], [cx - 19, SH_Y]], k),          // wide grip, so the head is not boxed in
    ln([[cx + 36, BAR_Y], [cx + 19, SH_Y]], k),
    `<circle class="fr-${k} fr-fill" cx="${cx - 36}" cy="${BAR_Y}" r="5"/>`,
    `<circle class="fr-${k} fr-fill" cx="${cx + 36}" cy="${BAR_Y}" r="5"/>`,
    ln([[cx - 19, SH_Y], [cx, t]], j),                   // trap line — the thing that changes
    ln([[cx + 19, SH_Y], [cx, t]], j),
    ln([[cx, t], [cx, t + 54]], k),
    ln([[cx - 17, t + 54], [cx + 17, t + 54]], k),
    ln([[cx - 17, t + 54], [cx - 19, t + 92], [cx - 23, t + 120]], k),
    ln([[cx + 17, t + 54], [cx + 19, t + 92], [cx + 23, t + 120]], k),
    hd([cx, t - 34], k, 15)
  ].join('');
}
const tick = (x, y1, y2) =>
  `<path class="fr-live fr-arrow" d="M ${x} ${y1} L ${x} ${y2}" marker-end="url(#fr-tip)"/>${TIP}`;
const TIP = `<defs><marker id="fr-tip" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="5" markerHeight="5" orient="auto">
  <path class="fr-solid" d="M 0 0 L 10 5 L 0 10 z"/></marker></defs>`;
const label = (x, t) => `<text class="fr-tag" x="${x}" y="244" text-anchor="middle">${t}</text>`;

const hangSVG = (a, b) => svg(PANEL, [
  ref(SH_Y - 18 - 34 - 15),
  hangPanel(78, 0, false), hangPanel(222, 18, true),
  tick(150, 128, 100), label(78, a), label(222, b)
].join(''));

const activeHang = () => hangSVG('shrugged', 'active');
const scapPull = () => svg(PANEL, [
  ref(SH_Y - 18 - 34 - 15),
  hangPanel(78, 0, false), hangPanel(222, 18, true),
  tick(150, 128, 100), label(78, 'start'), label(222, 'finish'),
  `<text class="fr-tag" x="150" y="16" text-anchor="middle">arms stay straight the whole time</text>`
].join(''));

/* ── front view, pulling ─────────────────────────────────────────────────────*/
const PBAR = 54;
function pullFig(cx, top, k) {
  return top
    ? [ln([[cx - 26, PBAR], [cx - 48, 80], [cx - 18, 74]], k),
       ln([[cx + 26, PBAR], [cx + 48, 80], [cx + 18, 74]], k),
       ln([[cx - 18, 74], [cx, 68], [cx + 18, 74]], k),
       ln([[cx, 68], [cx, 118]], k), ln([[cx - 16, 118], [cx + 16, 118]], k),
       ln([[cx - 16, 118], [cx - 18, 154], [cx - 22, 182]], k),
       ln([[cx + 16, 118], [cx + 18, 154], [cx + 22, 182]], k),
       hd([cx, 38], k, 14)].join('')
    : [ln([[cx - 26, PBAR], [cx - 17, 126]], k), ln([[cx + 26, PBAR], [cx + 17, 126]], k),
       ln([[cx - 17, 126], [cx, 120], [cx + 17, 126]], k),
       ln([[cx, 120], [cx, 170]], k), ln([[cx - 16, 170], [cx + 16, 170]], k),
       ln([[cx - 16, 170], [cx - 18, 206], [cx - 22, 234]], k),
       ln([[cx + 16, 170], [cx + 18, 206], [cx + 22, 234]], k),
       hd([cx, 90], k, 14)].join('');
}
const pullBar = cx => `<path class="fr-bar" d="M ${cx - 56} ${PBAR} L ${cx + 56} ${PBAR}"/>`;

const pullUp = () => svg('0 0 300 248', [
  pullBar(78), pullBar(222),
  pullFig(78, false, 'body'), pullFig(222, true, 'live'),
  tick(150, 168, 120), label(78, 'dead hang'), label(222, 'chin over')
].join(''));

const negative = () => svg('0 0 300 248', [
  pullBar(78), pullBar(222),
  pullFig(78, true, 'body'), pullFig(222, false, 'live'),
  tick(150, 110, 168), label(78, 'step up to here'), label(222, 'lower slowly')
].join(''));

/* Band thickness carries the assistance level, so the picture thins as you do. */
function bandPull(assist = 5) {
  const w = assist <= 0 ? 0 : 3 + assist * 2.8;
  const band = w
    ? `<path class="fr-band" style="stroke-width:${r2(w)}" d="M 150 ${PBAR + 6} C 116 118, 118 162, 141 184 L 159 184 C 182 162, 184 118, 150 ${PBAR + 6} Z"/>`
    : '';
  return svg('0 0 300 248', [pullBar(150), band, pullFig(150, true, 'live'),
    label(150, assist > 0 ? `assist A${assist} — band under the feet` : 'no band')].join(''));
}

/* ── side view ────────────────────────────────────────────────────────────────
 * One rigid body line with a real torso, a head set off it, and an arm that is
 * always drawn last and always in --signal, because in every one of these the
 * arm is the exercise.
 */
const FLOOR_Y = 178;
function sideAthlete({ sh, deg, hand, elbowOff = 26, knees = false, toes = true, k = 'body' }) {
  const c = Math.cos(rad(deg)), s = Math.sin(rad(deg));
  const at = dd => [sh[0] + dd * c, sh[1] - dd * s];
  const head = at(38), neck = at(19), hip = at(-88);
  const out = [ln([neck, hip], k)];
  if (knees) {
    const kn = at(-136);
    out.push(ln([hip, kn], k), ln([kn, [kn[0] + 14, FLOOR_Y]], k));
  } else {
    const ank = at(-178);
    out.push(ln([hip, ank], k));
    if (toes) out.push(ln([ank, [ank[0] - 3, FLOOR_Y]], k));
  }
  out.push(hd(head, k, 14));
  const el = [(sh[0] + hand[0]) / 2 - elbowOff * c, (sh[1] + hand[1]) / 2 + elbowOff * s * 0.4];
  out.push(ln([sh, el, hand], 'live'));
  return { html: out.join(''), head, hip, hand };
}

function pressUp({ deg, sh, handY, surface = null, knees = false, elbowOff = 26, hand = null, tag = null, feetBox = null }) {
  const h = hand || [sh[0] + 14, handY];
  const f = sideAthlete({ sh, deg, hand: h, elbowOff, knees });
  return svg('0 0 300 200', [
    floor(FLOOR_Y, 16, 288),
    surface ? `<path class="fr-bar" d="M ${h[0] - 34} ${handY} L ${h[0] + 46} ${handY}"/>
               <path class="fr-floor" d="M ${h[0] + 38} ${handY} L ${h[0] + 38} ${FLOOR_Y}"/>` : '',
    feetBox ? `<path class="fr-bar" d="M ${feetBox[0] - 40} ${feetBox[1]} L ${feetBox[0] + 34} ${feetBox[1]}"/>
               <path class="fr-floor" d="M ${feetBox[0] - 32} ${feetBox[1]} L ${feetBox[0] - 32} ${FLOOR_Y}"/>` : '',
    f.html,
    tag ? `<text class="fr-tag" x="150" y="196" text-anchor="middle">${tag}</text>` : ''
  ].join(''));
}

const wallPress = () => svg('0 0 300 200', [
  floor(FLOOR_Y, 16, 250), `<path class="fr-bar" d="M 252 22 L 252 ${FLOOR_Y}"/>`,
  ln([[92, FLOOR_Y], [114, 122], [137, 67]]),          // feet, hip, shoulder — one straight lean
  ln([[137, 67], [148, 46]]), hd([150, 34], 'body', 14),
  ln([[137, 67], [178, 90], [246, 72]], 'live'),       // bent arm to the wall
  `<text class="fr-tag" x="150" y="196" text-anchor="middle">walk the feet back until it is hard</text>`
].join(''));

const plank = () => svg('0 0 300 200', [
  floor(FLOOR_Y, 16, 288),
  sideAthlete({ sh: [214, 128], deg: 7, hand: [246, FLOOR_Y], elbowOff: 32 }).html,
  `<path class="fr-live" d="M 214 ${FLOOR_Y} L 250 ${FLOOR_Y}"/>`,
  `<text class="fr-tag" x="150" y="196" text-anchor="middle">elbows under shoulders</text>`
].join(''));

/* Row angle is the exit criterion for every phase past 2, so draw it literally. */
function row(deg = 60) {
  const foot = [46, FLOOR_Y], c = Math.cos(rad(deg)), s = Math.sin(rad(deg));
  const at = dd => [foot[0] + dd * c, foot[1] - dd * s];
  const sh = at(112), barY = Math.max(26, sh[1] - 50), hand = [sh[0] + 16, barY];
  return svg('0 0 300 200', [
    floor(FLOOR_Y, 16, 288),
    `<path class="fr-bar" d="M ${r2(hand[0] - 62)} ${r2(barY)} L ${r2(hand[0] + 62)} ${r2(barY)}"/>`,
    sideAthlete({ sh, deg, hand, elbowOff: 20, toes: false }).html,
    `<path class="fr-ref" d="M ${foot[0]} ${FLOOR_Y} L ${r2(foot[0] + 120)} ${FLOOR_Y}"/>`,
    `<path class="fr-ref" d="M ${foot[0]} ${FLOOR_Y} L ${r2(at(74)[0])} ${r2(at(74)[1])}"/>`,
    `<text class="fr-tag" x="${r2(foot[0] + 44)}" y="${FLOOR_Y - 10}">${deg}°</text>`
  ].join(''));
}

const squat = () => svg('0 0 300 200', [
  floor(FLOOR_Y, 16, 146), floor(FLOOR_Y, 154, 288),
  ln([[76, 66], [70, 112]]), hd([78, 46], 'body', 14),
  ln([[70, 112], [50, 142], [56, FLOOR_Y]], 'live'), ln([[70, 112], [92, 144], [86, FLOOR_Y]], 'live'),
  ln([[74, 82], [108, 96]]),
  `<text class="fr-tag" x="76" y="196" text-anchor="middle">squat</text>`,
  ln([[218, 58], [218, 106]]), hd([218, 38], 'body', 14),
  ln([[218, 106], [258, 134], [258, FLOOR_Y]], 'live'), ln([[218, 106], [188, 146], [178, FLOOR_Y]], 'live'),
  `<text class="fr-tag" x="218" y="196" text-anchor="middle">lunge</text>`
].join(''));

const carry = () => svg('0 0 300 210', [
  floor(192, 44, 256),
  ln([[150, 62], [150, 128]]), hd([150, 42], 'body', 15),
  ln([[150, 70], [116, 126]], 'live'), ln([[150, 70], [184, 126]], 'live'),
  `<rect class="fr-load" x="98" y="126" width="36" height="18" rx="4"/>`,
  `<rect class="fr-load" x="166" y="126" width="36" height="18" rx="4"/>`,
  ln([[150, 128], [136, 160], [134, 192]]), ln([[150, 128], [164, 160], [166, 192]]),
  `<text class="fr-tag" x="150" y="206" text-anchor="middle">walk, don't just stand</text>`
].join(''));

/* Drawn as a whole seated leg rather than a floating thigh: the knee and shin
 * are what make the forearm-resting-on-thigh position read at all. */
const wristExt = () => svg('0 0 300 220', [
  floor(202, 20, 280),
  `<path class="fr-thigh" d="M 50 134 L 174 134"/>`,
  `<path class="fr-thigh" d="M 174 134 L 184 196"/>`,
  ln([[68, 118], [170, 118]], 'body'),                          // forearm resting on the thigh
  `<circle class="fr-body fr-fill" cx="68" cy="118" r="8"/>`,   // elbow
  `<circle class="fr-body fr-fill" cx="170" cy="118" r="7"/>`,  // wrist, at the knee edge
  ln([[170, 118], [204, 146]], 'ghost'),                        // hanging start
  ln([[170, 118], [206, 86]], 'live'),                          // lifted finish
  `<path class="fr-band" style="stroke-width:8" d="M 206 90 C 250 118, 248 168, 202 192"/>`,
  `<text class="fr-tag" x="88" y="166">thigh</text>`,
  `<text class="fr-tag" x="150" y="216" text-anchor="middle">back of the hand leads, slow both ways</text>`
].join(''));

const archerPress = () => svg('0 0 300 200', [
  floor(FLOOR_Y, 16, 288),
  sideAthlete({ sh: [206, 122], deg: 8, hand: [186, FLOOR_Y], elbowOff: 34 }).html,
  ln([[206, 122], [274, FLOOR_Y]], 'ghost'),
  `<text class="fr-tag" x="150" y="196" text-anchor="middle">one side bends, one stays straight</text>`
].join(''));

const warmup = () => svg('0 0 320 128', [
  ln([[38, 44], [38, 82]]), hd([38, 28], 'body', 11),
  `<path class="fr-live" d="M 38 50 m -22 0 a 22 22 0 1 1 44 0 a 22 22 0 1 1 -44 0"/>`,
  `<text class="fr-tag" x="38" y="112" text-anchor="middle">circles</text>`,
  ln([[118, 44], [118, 82]]), hd([118, 28], 'body', 11),
  ln([[92, 50], [144, 50]], 'live'),
  `<path class="fr-band" style="stroke-width:6" d="M 94 50 L 142 50"/>`,
  `<text class="fr-tag" x="118" y="112" text-anchor="middle">pull-aparts</text>`,
  `<path class="fr-bar" d="M 172 16 L 232 16"/>`,
  ln([[188, 16], [194, 50]]), ln([[216, 16], [210, 50]]), ln([[194, 50], [210, 50]]),
  ln([[202, 50], [202, 86]]), hd([202, 34], 'body', 10),
  `<text class="fr-tag" x="202" y="112" text-anchor="middle">2 × 15s hang</text>`,
  `<path class="fr-floor" d="M 250 86 L 314 86"/>`,
  `<path class="fr-bar" d="M 282 52 L 316 52"/>`,
  ln([[254, 86], [292, 58]]), hd([298, 52], 'body', 10),
  ln([[292, 58], [294, 52]], 'live'),
  `<text class="fr-tag" x="282" y="112" text-anchor="middle">5 incline</text>`
].join(''));

/* ── the registry ─────────────────────────────────────────────────────────── */
export const EXERCISES = {
  warmup: {
    name: 'Warm-up', aka: [],
    why: 'Raises tissue temperature and rehearses the pattern, so the first working set is not also the first time your shoulders have moved today.',
    cues: ['Ten arm circles each way, slow.', 'Band pull-aparts until the shoulders feel awake.', 'Two easy 15-second hangs, then five incline press-ups.'],
    mistake: 'Stretching cold instead of moving. Hold the static stretching for after.',
    feel: 'Warm and loose. You should not be out of breath.',
    svg: warmup
  },
  hang: {
    name: 'Active hang', aka: ['dead hang', 'scapular hang'],
    why: 'Builds grip, loads the shoulder in the exact position a pull-up starts from, and is the single biggest component of your capability score.',
    cues: ['Full grip, thumb wrapped around the bar.', 'Shoulders pulled down and away from your ears, not shrugged up.', 'Ribs tucked, legs quiet. Stop with a few seconds still in you.'],
    mistake: 'Hanging fully relaxed with the shoulders up by the ears. It rests on the joint instead of loading the muscle.',
    feel: 'Lats and forearms working. Nothing pinching at the front of the shoulder.',
    svg: activeHang
  },
  scap: {
    name: 'Scapular pulls', aka: ['scap pulls', 'scapular retractions', 'shoulder shrugs on the bar'],
    why: 'Teaches the shoulder blades to move first. Every pull-up starts with this inch, and without it you pull with arms only.',
    cues: ['Arms stay completely straight the whole time.', 'Pull your shoulder blades down and together so your chest rises toward the bar.', 'Two-second hold at the top, then lower under control.'],
    mistake: 'Bending the elbows. The moment the arms bend it is a partial pull-up, not a scapular pull.',
    feel: 'A small, unglamorous inch of movement across the upper back. That is the whole exercise.',
    svg: scapPull
  },
  band: {
    name: 'Band pull-ups', aka: ['assisted pull-ups', 'band-assisted pull-ups'],
    why: 'The full movement at a load you can actually control, so you practise the real pattern instead of a substitute for it.',
    cues: ['Loop the band under both feet or one knee. Step in carefully.', 'Full range: dead hang at the bottom, chin over the bar at the top.', 'Leave two or three reps in the tank on every set.'],
    mistake: 'Letting the band do the top of the rep. The band should help least where you are strongest.',
    feel: 'Hard but controlled. If you are being fired off the bottom, the band is too heavy.',
    svg: s => bandPull(s?.levels?.band?.assist ?? 5)
  },
  neg: {
    name: 'Negatives', aka: ['eccentrics', 'lowering reps', 'negative pull-ups'],
    why: 'You are stronger lowering than lifting, so this is the way to load the top half of a pull-up before you can do one.',
    cues: ['Step or jump to the top position, chin over the bar.', 'Lower as slowly as you can, counting the seconds.', 'No dropping in the last third — that part is the point.'],
    mistake: 'Getting a fast three seconds then falling off. A slow two beats a rushed five.',
    feel: 'Burning across the back and arms by the bottom. Expect real soreness for the first week or two.',
    svg: negative
  },
  cluster: {
    name: 'Single-rep attempts', aka: ['clusters', 'singles'],
    why: 'Spreads your best effort across the session so every attempt is fresh, instead of one good rep followed by four bad ones.',
    cues: ['One honest attempt, then rest fully.', 'Chin-up or neutral grip — whichever gets you there first.', 'A failed attempt still counts. Get off the bar and rest.'],
    mistake: 'Grinding repeated attempts with no rest. That trains fatigue, not strength.',
    feel: 'Every attempt should feel like your first one of the day.',
    svg: pullUp
  },
  pull: {
    name: 'Pull-up', aka: ['chin-up', 'strict pull-up'],
    why: 'The thing itself.',
    cues: ['Dead hang at the bottom, arms straight.', 'Lead with the chest, drive the elbows down toward your hips.', 'Chin clears the bar, then lower under control.'],
    mistake: 'Kipping — swinging the hips to generate momentum. It moves your body without training the pull.',
    feel: 'Smooth. If the last rep is a grind you have gone past the prescription.',
    svg: pullUp
  },
  row: {
    name: 'Rows', aka: ['inverted row', 'bodyweight row', 'Australian pull-up'],
    why: 'Horizontal pulling, kept at every phase. It builds the same muscles at a load you can dose precisely — by changing one angle.',
    cues: ['Under a low bar or a sturdy table, heels on the floor.', 'Body dead straight from head to heels, no sagging hips.', 'Chest touches the bar, then lower all the way to straight arms.'],
    mistake: 'Letting the hips drop. The angle only means something if the body stays rigid.',
    feel: 'Upper back, between the shoulder blades. The lower the angle, the harder it gets.',
    svg: s => row(s?.levels?.row?.angleDeg ?? 60)
  },
  test: {
    name: 'Test', aka: [],
    why: 'One honest measurement every five weeks. Everything else in the app is calibrated from this.',
    cues: ['Strict form only. This number decides your next five weeks.', 'One set. Stop when the rep stops being clean.'],
    mistake: 'Testing on a day you feel wrecked, then treating the result as the truth.',
    feel: 'Hard. This is the one session where the last rep is meant to be a grind.',
    svg: pullUp
  },
  push: { name: 'Press-up', aka: ['push-up'], why: '', cues: [], mistake: '', feel: '', svg: () => pressUp({ deg: 8, sh: [210, 120], handY: FLOOR_Y }) },
  legs: {
    name: 'Squats and lunges', aka: [],
    why: 'Conditioning that stays out of the way. Lower body only, on purpose, so it never competes with your pulling recovery.',
    cues: ['Squat: feet about shoulder width, sit down between your heels.', 'Lunge: long step, back knee toward the floor, torso upright.', 'Steady breathing. This is not meant to be a finisher.'],
    mistake: 'Turning it into a conditioning blowout. If it costs you a pulling session it was too hard.',
    feel: 'Working, but you could hold a conversation.',
    svg: squat
  },
  core: {
    name: 'Plank', aka: ['front plank'],
    why: 'A rigid midsection is what stops your legs swinging on the bar. Half of a clean pull-up is not moving.',
    cues: ['Forearms under the shoulders, elbows directly below.', 'Ribs down, glutes on, one straight line from head to heels.', 'Breathe normally. Stop when the line breaks, not when the clock does.'],
    mistake: 'Hips sagging or riding high. Both make it easier and neither trains anything.',
    feel: 'A deep brace across the whole midsection, not a lower-back ache.',
    svg: plank
  },
  cooldown: {
    name: 'Cool-down hang', aka: ['decompression hang'],
    why: 'Relaxed traction through the shoulders and spine after the work is done.',
    cues: ['Easy grip. Nothing to prove here.', 'Let the shoulders travel up toward the ears — this is the one hang where that is fine.', 'Breathe out slowly. Step off before your grip is properly gone.'],
    mistake: 'Treating it as another working set.',
    feel: 'A pleasant stretch through the armpits and ribs.',
    svg: activeHang
  },
  carry: {
    name: "Farmer's carry", aka: ['loaded carry', 'suitcase carry'],
    why: 'Builds grip endurance under load without adding any pull-pattern volume, so it costs your recovery almost nothing.',
    cues: ['One heavy-ish thing in each hand — shopping bags, kettlebells, water containers.', 'Stand tall, shoulders down and back, and walk.', 'Put them down when your grip is going, not after it has gone.'],
    mistake: 'Standing still holding them. Walking is what makes it a carry.',
    feel: 'Forearms burning, upper back working to stop the shoulders rolling forward.',
    svg: carry
  },
  wrist: {
    name: 'Band wrist extensions', aka: ['wrist extensor work', 'reverse wrist curls'],
    why: 'Prophylactic. Ramping grip volume quickly is a well-worn route into golfer\'s and tennis elbow, and this is the cheapest insurance there is.',
    cues: ['Forearm resting on your thigh, palm facing down, hand hanging off the knee.', 'Light band or no resistance at all. Lift the back of the hand toward you.', 'Slow up, slower down. Fifteen easy reps, never near failure.'],
    mistake: 'Loading it heavily. This is not a strength exercise and treating it as one causes the problem it prevents.',
    feel: 'A mild pump on the top of the forearm. Never sharp, never at the elbow.',
    svg: wristExt
  }
};

/* Press-up stages, matching PUSH_STAGES in engine.js index for index. */
export const PUSH = [
  { name: 'Wall press-up', why: 'The lightest way to load the pattern. Your hands take a fraction of your bodyweight.',
    cues: ['Hands on the wall at chest height, a little wider than your shoulders.', 'Straight line from head to heels — do not bend at the hips.', 'Chest to the wall, then push away.'],
    mistake: 'Standing too close. Walk the feet back until it is actually hard.',
    feel: 'Chest and the back of the arms. It should not feel like nothing.', svg: wallPress },
  { name: 'Incline press-up (counter)', why: 'The same movement, more of your weight on your hands.',
    cues: ['Hands on a kitchen counter, shoulder width or slightly wider.', 'Body rigid, heels back and down.', 'Chest to the counter, elbows about 45° from your sides.'],
    mistake: 'Flaring the elbows straight out to the sides. It stresses the shoulder and shortens the range.',
    feel: 'Chest, front of the shoulder, triceps.', svg: () => pressUp({ deg: 32, sh: [196, 66], handY: 100, surface: true }) },
  { name: 'Incline press-up (chair)', why: 'Lower surface, more load. The last stop before the floor.',
    cues: ['Hands on a chair seat or a low step — make sure it cannot slide.', 'Same rigid line from head to heels.', 'All the way down until the chest touches, all the way up to straight arms.'],
    mistake: 'Cutting the depth as it gets harder. A shorter rep is not an easier rep, it is a different one.',
    feel: 'Noticeably harder than the counter. That is the point.', svg: () => pressUp({ deg: 22, sh: [200, 96], handY: 134, surface: true }) },
  { name: 'Knee press-up', why: 'Floor-level pressing at reduced load, with the shoulder in the full-press-up position.',
    cues: ['Knees on the floor, ankles crossed and lifted.', 'Straight line from head to knees — hips do not pike up.', 'Chest to fist depth, then press.'],
    mistake: 'Letting the hips fold so it becomes a kneeling shoulder press.',
    feel: 'Chest and triceps, with the midsection working to hold the line.', svg: () => pressUp({ deg: 12, sh: [206, 116], handY: FLOOR_Y, knees: true }) },
  { name: 'Full press-up', why: 'The standard. Your whole body, one rigid lever.',
    cues: ['Hands under the shoulders, slightly wider.', 'Head to heels in one line, glutes on.', 'Chest to fist depth, elbows at about 45°.'],
    mistake: 'Head dropping forward to fake the depth.',
    feel: 'Chest, triceps and a hard brace through the middle.', svg: () => pressUp({ deg: 8, sh: [210, 120], handY: FLOOR_Y }) },
  { name: 'Close-grip press-up', why: 'Shifts the work toward the triceps, which is what finishes the top of a pull-up.',
    cues: ['Hands directly under the shoulders or narrower.', 'Elbows stay tucked close to your ribs the whole way down.', 'Same rigid line, same full depth.'],
    mistake: 'Letting the elbows drift out. If they flare, it is just a press-up with the hands close together.',
    feel: 'Back of the arms doing most of the work.', svg: () => pressUp({ deg: 8, sh: [210, 120], handY: FLOOR_Y, elbowOff: 4, tag: 'elbows stay tucked in' }) },
  { name: 'Archer press-up', why: 'Loads one arm at a time. The bridge toward one-arm pressing strength.',
    cues: ['Hands wide. Bend one arm and lower toward that hand.', 'The other arm stays straight, sliding out to the side.', 'Alternate sides each rep.'],
    mistake: 'Twisting the hips to help. Shoulders and hips stay square to the floor.',
    feel: 'Most of your weight on one side. Distinctly harder than a full press-up.', svg: archerPress },
  { name: 'Decline press-up', why: 'Feet elevated, more weight over the hands, more work for the upper chest and shoulders.',
    cues: ['Feet on a chair or step, hands on the floor.', 'Hips do not pike — the line stays straight.', 'Full depth, controlled.'],
    mistake: 'Going so high that it turns into a shoulder press.',
    feel: 'Upper chest and front of the shoulders.', svg: () => pressUp({ deg: -12, sh: [210, 130], handY: FLOOR_Y, feetBox: [58, 93] }) }
];

/* ── resolution ───────────────────────────────────────────────────────────── */

/** Map a session block plus current state onto one exercise entry. */
export function exerciseFor(block, state) {
  if (!block) return null;
  if (block.track === 'push') {
    const i = Math.min(PUSH.length - 1, Math.max(0, state?.levels?.push?.stage ?? 4));
    return { ...PUSH[i], aka: ['push-up'], key: `push:${i}` };
  }
  if (block.track === 'test') {
    const isHang = block.unit === 's';
    const base = isHang ? EXERCISES.hang : EXERCISES.pull;
    return { ...base, ...EXERCISES.test, name: isHang ? 'Test: max hang' : 'Test: max reps',
      cues: [...EXERCISES.test.cues, ...(isHang ? ['Hang until your grip genuinely goes.'] : ['Dead hang to chin over the bar, every rep.'])],
      svg: base.svg, key: isHang ? 'test:hang' : 'test:reps' };
  }
  const e = EXERCISES[block.track];
  return e ? { ...e, key: block.track } : null;
}

/** The diagram on its own, for inline use next to a block title. */
export function diagramHTML(block, state, cls = '') {
  const e = exerciseFor(block, state);
  if (!e) return '';
  return `<div class="fr-figure${cls ? ' ' + cls : ''}">${typeof e.svg === 'function' ? e.svg(state) : e.svg}</div>`;
}

/** The full reference: diagram, why, cues, the common mistake, what it should feel like. */
export function referenceHTML(block, state) {
  const e = exerciseFor(block, state);
  if (!e) return '';
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  return `
    <div class="fr-figure">${typeof e.svg === 'function' ? e.svg(state) : e.svg}</div>
    <h3 class="fr-h">${esc(e.name)}</h3>
    ${e.aka?.length ? `<p class="mono muted fr-aka">also called ${e.aka.map(esc).join(' · ')}</p>` : ''}
    ${e.why ? `<p class="fr-why">${esc(e.why)}</p>` : ''}
    ${e.cues?.length ? `<ul class="fr-cues">${e.cues.map(c => `<li>${esc(c)}</li>`).join('')}</ul>` : ''}
    ${e.mistake ? `<div class="fr-note"><span class="mono muted">Most common mistake</span><p>${esc(e.mistake)}</p></div>` : ''}
    ${e.feel ? `<div class="fr-note"><span class="mono muted">It should feel like</span><p>${esc(e.feel)}</p></div>` : ''}`;
}
