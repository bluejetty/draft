# AUDIT-PERF.md — measurements

Environment for every number below: Chromium 1194 headless, `--no-sandbox`, one
worker, static server on 127.0.0.1. Desktop-class container CPU. Where I
extrapolate to an iPad I say so and I say the multiplier; everything else is
measured. Repro specs are in `audit-repros/`.

---

## 1. Startup: 12.9 s, of which 12.5 s is one `<link>` — the biggest single win

`audit-repros/p11-font-block.spec.js`:

```
model-ready as shipped      : 12936 ms
model-ready with fonts cut  :   395 ms
```

`audit-repros/p8-startup-breakdown.spec.js` (navigation timing, ms from
navigationStart):

```
responseEnd            8      <- the 1 MB document itself
lastScriptDownloaded  76      <- every vendor + module script is in
domInteractive     12585
domContentLoaded   12628
```

`audit-repros/p10-profile.spec.js` (CDP sampling profiler across the same 12.9 s):

```
profile span 12923 ms, 11530 samples
  96.5%  (idle)
   1.6%  (program)
   0.1%  parseDcText        support.js:38
   0.1%  evalDcLogic        support.js:842
```

**It is not work, it is waiting.** `MODEL.dc.html:35` (and the head of every
other page) carries a render-blocking
`https://fonts.googleapis.com/css2?family=Barlow…`. With that host unreachable —
an offline job site, an airplane, a corporate DNS block, a jobsite iPad on no
signal — the parser stalls for the full connection timeout before the app paints.

I also checked whether the 887 KB inline `text/x-dc` script or the 1 MB document
is the cost: it is not. A copy of MODEL with the entire inline script removed
(1050 KB → 163 KB) still took 12516 ms; a head-only page with all the vendor
scripts and none of the template took **158 ms**
(`audit-repros/p9-probe.spec.js`). So neither the no-build architecture nor the
document size is the startup problem. One `<link>` is.

**Fix (quick win, one hour):** vendor the two font families into `vendor/` the way
React, three.js and pdf.js already are, or load the stylesheet non-blocking
(`media="print" onload="this.media='all'"`) behind a system-font stack.
**Expected: 12.9 s → 0.4 s cold, on the worst network. 33×.**

### The same line is most of the Playwright suite's runtime

The suite is 564 tests, `fullyParallel: false`, one worker, and nearly every test
loads MODEL at least once. My full run finished at **550 passed, 14 failed, 2.8
hours** — and at ~12.5 s of font stall per load, **≈2.0 of those 2.8 hours were
spent waiting on a font that never arrives**. All 14 failures are timeouts caused
by that stall (AUDIT-FULL §7.1), not by the product.

**Fix (quick win, ten minutes):** add to `tests/helpers.js` `openModel`:
```js
await page.route('**fonts.googleapis.com**', r => r.abort());
await page.route('**fonts.gstatic.com**', r => r.abort());
```
That alone should take the suite from 2.8 h to well under an hour without
weakening a single assertion — measured the same way from the other end, blocking
the font at the browser (`--no-proxy-server`, so the request fails instead of
hanging) takes one spec from 21.6 s to 9.1 s. Self-hosting the fonts fixes it for tests *and* users at once, and is
the right fix.

Second-order suite win, not measured: the specs are almost all full-app
integration tests. `tests/formatters.spec.js` exercises six pure functions and
still costs 78 s because each test navigates to MODEL. Six pure-function specs
could run in a node context in under a second.

---

## 2. Frame cost: fine on the plan, degraded in elevation/section

`audit-repros/p3-perf-elevation.spec.js`, real BUILD HOUSE (36'×24', one roof),
90 frames each, ms per frame (16.7 = vsync-bound, i.e. free):

```
PLAN idle      : median 16.7  p95 16.9  max 17.0
PLAN mousemove : median 16.7  p95 18.7  max 20.9
E1   idle      : median 16.7  p95 17.9  max 19.9
E1   mousemove : median 17.5  p95 25.8  max 32.2
```

The elevation view costs ~+38% at p95 and +54% at max with **one** roof. The
cause is at `MODEL.dc.html:8968-8992`: `_drawElevationWorkspace2D` samples a
241 × 41 grid — **9,881 probes per repaint** — and each probe iterates every roof
calling `_sectionRoofHeightAt` (point-in-face over the roof's faces). That runs
inside `_redrawOverlay`, on every invalidated frame, i.e. on every mouse move.

An attached garage doubles the roof loop; an L-shaped roof multiplies the face
count. Extrapolating to an A14-class iPad (≈3-4× slower single-thread on this
kind of scalar JS), E1 mousemove p95 lands around **75-100 ms** — visible,
sticky lag on the view the bone reveal jumps you into.

The thumbnail versions of the same drawing are already cached by epoch
(`MODEL.dc.html:5514`: "Repaints only when the model changes … never on mouse
traffic"). The full-size path is the one that was not.

**Fix (structural, half a day):** cache the silhouette per `(cut, viewRailEpoch,
size)` exactly as the thumbnails do, and invalidate it on model change rather
than on pointer traffic. Expected: E1 frames back to plan-view cost.

Second, cheaper: `_syncViewRails()` (`MODEL.dc.html:5527-5541`) runs on **every**
rAF tick even when nothing needs redrawing (`_animate` calls it before the
`_needsRedraw` early-out, `:5504-5505`). It does four `document.querySelector`
calls, rebuilds the elevation cut list via `_autoElevationCuts()`, walks the
thumbnail cards, and writes `style.display` on two elements — 60×/s, forever. It
did not show up in my measurements (idle frames stayed at 16.7 ms with an empty
cut list), but it is unconditional work in the hot loop and it writes layout
properties.

---

## 2b. Every edit repaints every thumbnail through the full generator

`_markUnsaved` bumps the view-rail epoch, and `_syncThumbColumn` then re-runs
`_drawCutWorkspace2D` for every card whose epoch is stale
(`MODEL.dc.html:5566-5572`). That is the *full* section/elevation generator per
thumbnail — including the 241 × 41 silhouette sampler, whose cost is fixed by the
sample count, not by the 232 × 152 thumbnail it is drawing into. Four auto
elevations mean four full runs on every committed edit.

Measured (`audit-repros/p14-thumb-repaint.spec.js`, worst frame in the 1.2 s
after a committed edit):

```
empty drawing, no cuts        : worst frame 18.9 ms   (9 thumbnails, all plans)
house + 4 auto elevations     : worst frame 41.5 ms   (12 thumbnails)
house + 4 elevations + 3 cuts : worst frame 45.3 ms   (15 thumbnails)
```

+22.6 ms per edit for the four elevation thumbnails; the three extra *sections*
add only 3.8 ms, which isolates the cost squarely in the elevation silhouette
sampler (§2), not in thumbnail drawing generally. On an A-series iPad
(3-4× slower) that is **70-90 ms of hitch on every click that commits
geometry** — one dropped frame minimum, on the device the product is aimed at.

Same fix as §2: cache the silhouette per (cut, epoch) so the four elevations do
not each re-derive it, and consider repainting thumbnails on an idle callback
rather than inside the frame that services the edit.

---

## 3. Plan interaction at scale: acceptable, with one spike

`audit-repros/p1-perf.spec.js`, 300 walls across three levels, 120 synthetic
mousemoves each followed by a frame:

```
IDLE empty   : median 16.7  p95 16.9  max 16.9
IDLE 300w    : median 16.7  p95 16.9  max 17.2
MOUSEMOVE 300w run 1: median 16.7  p95 21.4  max  31.6
MOUSEMOVE 300w run 2: median 16.6  p95 17.3  max 269.8
```

Median is vsync-bound: the plan render path is not the bottleneck at 300 walls.
The 269.8 ms outlier in run 2 is a single frame; I did not chase it, but the
likely candidate is a GC pause from the per-edit history snapshots (§4) — worth
one profiling session before shipping to tablets.

On an iPad, p95 of ~21 ms becomes ~70 ms. That is the edge of "feels laggy" but
not broken.

---

## 4. Per-edit commit cost: flat to 55 KB, +18% at 530 KB

Every mutation runs `_markUnsaved` (`MODEL.dc.html:5096`), which serialises the
**entire** drawing twice — once for the history snapshot (`_recordHistory`,
`:5009`) and once for the file — then writes the whole document to IndexedDB.

`audit-repros/p12-save-latency.spec.js` (time from the committing click to
`data-save-dirty="0"`, so it includes ~450 ms of harness round trip in every row):

```
drawing   1,949 bytes : 489 ms
drawing  54,654 bytes : 486 ms
drawing 529,547 bytes : 577 ms
```

So the serialize + write adds ~90 ms at half a megabyte and nothing measurable
below that. Not urgent; it is O(document) per keystroke-scale edit and will
matter on a real permit set on a tablet (~300 ms per edit extrapolated). Worth
knowing, not worth fixing yet.

---

## 5. Long session: no leak found

`audit-repros/p13-long-session.spec.js`, 120 committed edits back to back
(111 s wall clock):

```
after  20 edits: heap 20 MB, commit 916 ms, drawing  5,310 bytes
after  40 edits: heap 18 MB, commit 917 ms, drawing  8,841 bytes
after  60 edits: heap 24 MB, commit 899 ms, drawing 12,372 bytes
after  80 edits: heap 15 MB, commit 903 ms, drawing 15,903 bytes
after 100 edits: heap 16 MB, commit 934 ms, drawing 19,456 bytes
after 120 edits: heap 25 MB, commit 950 ms, drawing 23,027 bytes
heap after a 3 s idle: 16 MB
```

Heap oscillates 15-25 MB with no trend; commit latency is flat. The undo history
is correctly bounded by both count and bytes (`HISTORY_LIMIT = 60`,
`HISTORY_MAX_CHARS = 8e6`, `_trimHistory` at `MODEL.dc.html:5019`). I found no
unbounded growth in a 120-edit session. This is one of the healthier parts of the
codebase and I am reporting it as such.

Not covered: listener count over a session (I had no cheap way to count DOM
listeners from the page), and multi-hour sessions with view switching, which is
where the imperatively-managed thumbnail cards (`_syncThumbColumn` creates and
removes DOM nodes with `addEventListener('click', …)` closures at `:5545-5553`)
would show up if they leak.

---

## 6. Startup payload

```
total transferred: 1,863 KB over 30 requests, plus a 1,034 KB document
heaviest: three-0.128.0.min.js 590 KB
          pdf-3.11.174.min.js  313 KB
          react-dom            129 KB
          five button PNGs     415 KB combined (79-95 KB each)
JS heap after model-ready: 13 MB
```

Two observations, neither urgent:

- **pdf.js (313 KB) and three.js (590 KB) load on every MODEL open**, before
  first interaction, for features most sessions never touch (PDF underlay, 3D
  view). Both are `<script src>` in the head. Deferring them behind their first
  use would cut ~900 KB and some parse time from every cold start. The pdf.js
  *worker* (1,087 KB) is correctly lazy — it is only fetched when a PDF is
  opened.
- **The five toolbar button PNGs are 415 KB combined** for images displayed at
  roughly 40×40 CSS px. They are decorative bitmaps of the HOUSE/SPLIT/BONE/
  GARAGE buttons. At the displayed size these should be ~4 KB each.

## What I did not examine

- Real iPad Safari. Every extrapolation above uses a 3-4× single-thread factor
  and should be replaced with hardware numbers before anyone acts on §2.
- Safari's maximum canvas area. The overlay is sized in CSS pixels (see M1 in
  AUDIT-CRITICAL.md) so it is nowhere near the limit today — but fixing M1 by
  multiplying by DPR is exactly the change that could hit it on a 12.9" iPad Pro
  at DPR 2 (2732×2048 = 5.6 Mpx, still safe; worth a check anyway).
- Memory under iOS pressure / tab discarding.
- The 269.8 ms frame outlier in §3.
- Zoom and pan smoothness — unmeasurable on touch because neither exists (C2),
  and I did not profile the wheel path.
- Whether `_syncViewRails` costs anything with many section cuts present; my
  drawings had at most the four auto elevations.
