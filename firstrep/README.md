# First Rep

Couch to your first pull-up. An installable PWA that runs entirely offline, with multiple people per device.

Built from *Pull-up App Training Engine — Research Briefing* (11 Aug 2026). Section references throughout the code point back at it.

**About 185 KB total. No build step, no dependencies, no backend, no network calls.**

---

## Get it onto a phone

**Fastest route (about two minutes):**

1. Unzip the folder.
2. Go to <https://app.netlify.com/drop> or <https://vercel.com/new> and drag the whole folder in.
3. Open the URL it gives you on your phone.
4. **iPhone:** Share → Add to Home Screen. **Android:** the install prompt appears by itself.

It then runs full screen with no browser bar, and works in airplane mode.

**Run it locally instead:**

```bash
cd firstrep
python3 -m http.server 8000     # or: npx serve .
```

Then open `http://localhost:8000`. A service worker needs `http://` or `https://` — opening `index.html` as a file will not register it.

**Run the tests:**

```bash
node --test tests/                     # 42 tests, all passing
```

---

## What's in it

| File | What it does |
|---|---|
| `js/engine.js` | The training engine. Pure — no DOM, no storage, no clock, no randomness. |
| `js/db.js` | IndexedDB. Per-profile partitions, append-only event log. |
| `js/screening.js` | The 21 screening questions, in five chapters. |
| `js/exercises.js` | Every exercise: diagram, cues, the common mistake, what it should feel like. Diagrams are inline SVG built from one pose primitive — no image assets. |
| `js/app.js` | Router, screens, session player, milestone flow. |
| `styles.css` | Design tokens and every component. |
| `sw.js` | Precaches the whole app. There is no runtime caching because no training path touches the network. Core files must cache or the install fails; fonts and icons are best-effort, so one missing asset can no longer strand you on an old build. |
| `fonts/` | Archivo (pinned to Expanded) and IBM Plex, subset to the glyphs the app uses. 50 KB for all four. |
| `tests/` | The invariants below, as build-failing tests. |

---

## The invariants, enforced in code

These are tests, not intentions. Break one and the suite fails.

1. Never more than 25 pull-pattern reps in a session, at any phase, at any max — verified across every phase × 21 strength levels.
2. A full week of generated sessions stays under 75 reps, and under the Naval Special Warfare ceilings (50/day, 250/week) at every stage.
3. Push sets never exceed pull sets, even when push volume is deliberately over-provisioned.
4. Every 5th week is reduced volume — half the sets at the same difficulty, never complete rest (Coleman 2024).
5. Tests fall on the Friday of a deload week and never less than 28 days apart.
6. Missing one session changes no state and produces no message.
7. Capability rises across ten sessions in which zero pull-ups are performed, and a failed session never reduces it.
8. A pain flag forces neutral grip and halves volume on the very next session, with no user input.
9. An unrated bar blocks clearance, and no combination of other answers unlocks it.
10. An eating-disorder answer suppresses body metrics but never blocks access.
11. Volume and difficulty never both increase in the same week.
12. Phases advance on exit criteria only — 40 completed sessions with no criterion met leaves you in phase 0.
13. `nextSession` does not mutate its input, and `deriveState` is deterministic.
14. A hang logged without a limiter folds to exactly the state it did before limiters existed.
15. Grip work switches on at two grip answers in the last three, and off again the same way.
16. Carries and wrist work add zero pull reps, and the session and week ceilings hold with them switched on.
17. Carry progression never writes `lastChange`, so it cannot collide with the one-change-per-week rule.
18. Every block the engine can emit, at every phase × 51 strength levels, resolves to a diagram and a complete reference page.
19. The press-up reference stays in lockstep with `PUSH_STAGES` — a renamed or reordered stage fails the build.
20. No diagram references `--crest` or `--stop`, or hard-codes a hex value.

---

## Design decisions worth knowing

**Capability is the product.** A single continuous 0.00–20.00 score. Below one rep it is a published weighted blend — hang 30%, row angle 20%, band assistance 20%, negatives 15%, scapular pulls 15% — so a user four months from their first rep still watches the number move every session. Above one rep it is verified max plus credit for practice since the last test. It is monotonic within a phase: a bad day never subtracts. The formula is printed in the app, under **You → How the number works**.

**The Bar is the constant.** A 3px steel rule under the header on every screen. You are the variable rising toward it. The bar in every exercise diagram is drawn in the same token at the same weight, for the same reason.

**Nobody should have to look up an exercise mid-set.** Every block is tappable from the Today card *before* the session starts, and again from inside the player between sets. Each opens a diagram, why the exercise exists, two or three cues, the most common mistake, and what it should feel like — plus the names it goes by elsewhere, because "scapular pulls" and "scap pulls" and "hanging scapular retractions" are the same thing and only one of them is in the prescription.

**Diagrams are drawn, not photographed.** Schematic figures read at arm's length on a phone; a rendered photograph does not. Two of them are drawn from live state: the row angle steepens from 60° to 20° as you progress, and the assistance band visibly thins from A5 to none. Colour carries meaning — steel for the body, signal for the one part the exercise is actually about, a dashed ghost for where you started.

**Movements that differ by an inch get two panels, not an animation.** Scapular pulls, negatives and pull-ups are all drawn as a start and a finish side by side, against a shared reference line. A looping animation next to a running rest clock competes with the clock, and superimposed figures at phone size read as a muddle.

**Grip is measured, then trained if it needs to be.** One tap after the daily hang records what made you let go. If grip is the answer twice in three days, the engine adds farmer's carries and light wrist-extensor work by itself, and removes them once it stops being the answer. Grip failing first is not a detail — it means the shoulder never reached the dose the session prescribed, and in phase 0 a 30-second hang is half the exit criterion.

**Grip is not folded into capability.** The hang term is already 30% of the score, and the phase-0 test is explicitly a hang to grip failure — so capability is substantially a grip measure already. Adding a sixth component would double-count it and force renormalising weights that currently sum to exactly 1.00, silently redrawing every historical point. Weekly hang seconds is surfaced separately instead: grip adapts on accumulated time under tension, so that number moves in the weeks when your best single hang is stuck.

**Derived state is never stored.** Everything is a fold over the event log, so an engine fix is retroactive across a user's whole history, and any future sync is a set union with no conflict resolution.

**Timers read the wall clock.** `startedAt` plus `Date.now()`, never accumulated ticks — so locking the screen mid-rest loses nothing. A `WakeLock` is requested where supported.

**The equipment gate is per person, not per device.** The bar's rating lives on the device; bodyweight lives on the profile. A doorway bar rated 100 kg clears one household member and blocks another, and the gate is re-checked on every profile switch.

**Streaks apply only to the daily hang.** Weeks completed and reps banked are cumulative and cannot be lost. A broken streak on something you do three times a week is a punishment for having a life.

**The running build is readable, not deducible.** `BUILD` in `js/app.js` and `CACHE` in `sw.js` are bumped together, and **You → Version** prints the build string alongside the cache the service worker is actually serving from. An HTML page can be fresh while an old worker still hands out old JavaScript, so the stamp alone is not enough — the cache name is the honest answer.

**Red is reserved.** `--stop` appears on pain flags, hard gates, and destructive confirmations. Nothing else. A missed session renders in neutral grey.

---

## Known gaps

- **Sync is not built.** The event log is shaped for it (uuid v7 keys, idempotent, per-profile streams) but there is no server. The app is complete without one.
- **Audio cues are generated tones**, not voice. Bundling short spoken cues would be better and costs about 40 KB.
- **The wrist-extension diagram is the weakest of the set.** The others read cleanly at phone size; that one took three passes and is only adequate.
- **The warm-up and legs blocks are compound** — four movements and two movements respectively, in a single cue string. They get multi-panel diagrams, but splitting them into real blocks would be better.
- **Pain during the daily hang has no route in.** The morning-after check catches pain from sessions; someone whose shoulder hurts on a rest-day hang has nowhere to say so.
- **The PIN option on profiles** is in the data model but has no UI yet.
- **Notifications** for the next-morning pain check are not scheduled; the check appears when the app is next opened. Real local notifications need a push subscription on Android and are unavailable in iOS PWAs.
- **Milestone share cards** render on screen but have no share action.
- The **capability weights are a hypothesis.** They should be replaced with the app's own cohort data as soon as there is any — which, per the briefing, would be the best evidence in this field.
