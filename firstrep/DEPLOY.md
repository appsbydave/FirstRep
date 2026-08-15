# Deploying this set

## Read this before you upload

This bundle is **not the whole repository.** Three things exist in your repo that
have never been on my side, and they are all binary or were never shared:

    fonts/archivo-exp.woff2      fonts/plex-sans-400.woff2
    fonts/plex-sans-600.woff2    fonts/plex-mono-500.woff2
    icons/icon-192.png           icons/icon-512.png
    icons/icon-maskable-512.png
    tests/engine.test.mjs

**Add these files on top of your repo. Do not replace the repo with them.**
If `fonts/` and `icons/` disappear, `index.html` preloads two fonts that 404 and
the app falls back to system faces — it still runs, but it stops looking like
First Rep. `tests/engine.test.mjs` holds invariants 1–13; losing it means losing
the tests that catch training-engine regressions.

## What changed

    js/exercises.js   NEW   every exercise: diagram, cues, mistake, feel
    tests/grip.test.mjs NEW 22 tests — invariants 14 to 20
    js/app.js         EDIT  diagrams in the player, tappable block list,
                            post-hang limiter question, You -> Version
    js/engine.js      EDIT  grip level, limiter fold, carries + wrist work
    styles.css        EDIT  diagram tokens, reference sheet, block list
    sw.js             EDIT  cache firstrep-v3, exercises.js added,
                            fonts and icons now best-effort
    README.md         EDIT  new invariants and design notes
    DEPLOY.md         NEW   this file

    js/db.js  js/screening.js  index.html  manifest.webmanifest  vercel.json
                            unchanged — included so the set is coherent,
                            safe to overwrite with identical content

## After Vercel reports the deploy

1. Open `/js/exercises.js` directly in a browser. JavaScript means the files
   landed. A 404 means the deploy did not include them and nothing below matters.
2. **Purge the Cloudflare cache** (Caching -> Configuration -> Purge Everything).
   `vercel.json` sets `no-cache` on `/sw.js`, but that instructs the *browser*.
   Cloudflare's edge can still serve the old `sw.js` bytes, in which case Chrome
   byte-compares the worker, finds it unchanged, and never installs the update.
   This is the single most likely reason a correct deploy does not reach a phone.
3. Reload the app twice. The first reload installs the new worker, the second
   serves the new assets — a page already running from the old cache keeps the
   assets it started with.
4. Open **You -> Version**. It should read build 3 and `firstrep-v3`.
   If it says `firstrep-v2`, the old worker is still in charge: go back to 2.

Finish any session in progress first. Nothing is written until the session ends,
so a reload part-way through drops those sets silently.

## Your training data

Nothing here touches it. The service worker only clears Cache Storage; your
history is in IndexedDB, a different store the worker cannot reach. Derived
state is never persisted, so the new engine re-folds your existing events and
the new fields default cleanly — that is invariant 14, and it is tested.

Export from **You -> Export everything** first anyway. Note that export has no
matching import yet, so it is a readable backup rather than a restorable one.

One real risk: **IndexedDB is scoped per origin.** History recorded on
`first-rep-gilt.vercel.app` is invisible to `firstrep.appsbydave.com`. If your
weeks-completed looks low after switching domains, the data is not gone — it is
on the other origin, and it needs the import function to come across.
