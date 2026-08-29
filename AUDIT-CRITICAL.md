# AUDIT-CRITICAL.md — CRITICAL and MAJOR findings

Target: `main` @ `75a3cd6`. Repro specs referenced below are committed under
`audit-repros/` and run against a static server on :4180 with
`npx playwright test -c audit-repros/pw.config.js`.

---

## Executive summary — the three worst things

1. **The drawings lie, in three independent ways, and all three reach paper.**
   (a) **Dimensions do not add up.** Every dimension is rounded to 1/16"
   independently at paint time, so a string of partials and the overall above it
   are rounded separately: **158 of 400 (39.5%)** hand-traced footprints print a
   string that does not sum to its own overall, worst case 1/8". (b) **Sections
   lose their roof.** A `toFixed(5)` quantisation (±5e-6) measured against a 1e-6
   containment tolerance in `profileEnvelope` drops profile points: over 401 cut
   angles through a plain hip roof, **13% render no roof at all** and another
   **29% render it short** — a finished-looking sheet with the eaves missing.
   A cut rotated 0.9° flips it. (c) **Section floor bands cross buildings.** A
   section through a house with a garage draws the main-floor framed-floor
   assembly — labelled `11 7/8" TJI + 3/4" SHTG` — straight across the garage,
   which is a 4" slab on grade, and leaves the space beneath drawn as an open
   basement storey; with a detached garage the same band spans the open ground
   between the two buildings. A plan examiner fails any of these on sight.

2. **Nothing in this app listens to touch.** `MODEL.dc.html:5398-5410` binds
   `mousemove`/`mousedown`/`dblclick`/`contextmenu`/`wheel`; `LAYOUT.dc.html:231-235`
   the same. There is no `pointerdown` or `touchstart` anywhere in the repo. What
   works on an iPad works only because Safari synthesises a click from a tap, so
   taps work and **every drag fails**: no pan, no zoom, no node drag, no window
   select, no viewport placement. There is also no undo control in the DOM at all
   (zero matches for /undo|redo/ across text, `title` and `aria-label`) — undo is
   Ctrl+Z only. The stated benchmark is "mom and dad build a house on an iPad".
   They cannot pan, zoom, or undo.

3. **LAYOUT silently deletes work done in MODEL.** `LAYOUT.dc.html:317-335`
   writes back the whole drawing as it looked when LAYOUT loaded, on any sheet
   change. Reproduced: 9 lines before, 8 after. No warning, no conflict check, no
   re-read.

Everything under those three is repairable in a sprint. Those three are the
product: the drawing disagrees with the building, the target device cannot drive
it, and the sheet page eats the model.

---

## Top 10 by damage × likelihood

| # | Finding | Damage | Likelihood | Score |
|---|---|---|---|---|
| 1 | C1 Dimension strings do not sum to their overall (39.5% of strings) | 5 | 5 | **25** |
| 2 | C5 Section floor bands cross body boundaries — a framed floor over the garage slab, a basement under the garage, a floor band through open ground | 5 | 4 | **20** |
| 3 | C2 No touch input path — every drag, pan and zoom is unreachable on iPad | 4 | 5 | **20** |
| 4 | C3 LAYOUT overwrites the drawing with a stale snapshot | 5 | 4 | **20** |
| 5 | C4 No undo/redo control exists outside the keyboard | 4 | 5 | **20** |
| 6 | C6 A rounding-tolerance mismatch deletes the roof from 42% of non-orthogonal sections | 5 | 3 | **15** |
| 7 | M1 The 2D overlay renders at 1× on every Retina screen | 3 | 5 | **15** |
| 8 | M2 Render-blocking Google Fonts link: 12.9 s → 0.4 s startup | 3 | 4 | **12** |
| 9 | M3 A placed viewport's scale can never be changed; the footer reports the selection anyway | 3 | 4 | **12** |
| 10 | M7 The 2" jog merge dimensions to a coordinate where no wall stands | 4 | 3 | **12** |

Just below: M4 `num()` coerces `null`/`""`/`false`/`[]` to 0 (5 × 2 = 10),
M5 deleting a level orphans five collections (3 × 3 = 9), M6 `offsetOutline`
degeneracies (4 × 2 = 8), M10 LAYOUT loses the sheet on a failed write
(4 × 2 = 8).

Damage 1-5: 1 cosmetic, 3 rework, 5 wrong paper or lost work.
Likelihood 1-5: 1 needs a hand-edited file, 5 happens in the default flow.

Why this order: the work order says anything that reaches paper outranks
everything, so the two defects that put a wrong number or a wrong assembly on a
stamped sheet lead — C1 above C5 only because C1 needs no garage and no section,
it happens on every drawing. C2/C4 come next because the stated user is on a
device the input layer was never written for: that is not "usability", it is
"the product does not run for this customer". C3 is the only silent-data-loss
path I could reproduce, but it needs two tabs, so it sits below the ones that
need nothing. M1 outranks M2 because it is permanent — it goes onto the sheet —
while M2 is one line of HTML.

---

# CRITICAL

## C1 — Auto-dimension strings do not add up to the overall dimension
**Severity: CRITICAL · Confidence: CONFIRMED · Reaches paper**
`MODEL.dc.html:7334` (label = `this._ftIn(value)`), `MODEL.dc.html:19080-19082`,
`formatters.js:15-29`, `auto-dims.js:237-256`.

**What breaks.** Every dimension label is computed independently at paint time as
`formatArchitecturalInches(distance * 12)`, which rounds to the nearest 1/16".
`computeAutoDimStrings` emits a string of partials (`[lo, opening centres…, hi]`)
and, separately, the overall (`[lo, hi]`). The partials are exact in model space —
they do sum — but each is *printed* rounded on its own. Independent rounding of
k partials against one rounding of the whole does not commute.

Model coordinates are free-running reals: a traced corner is
`(clientX − centre) / pixelsPerFoot`, never on the 1/16 grid. So the mismatch is
the normal case, not the corner case.

**Measured** (`audit-repros/r10b-dim-sum-pure.spec.js`, driving the shipped
`window.DraftAutoDims.computeAutoDimStrings` and `window.DraftFormatters`,
400 hand-traced rectangles with three openings each):

```
158 of 400 auto-dim strings print partials that do not add to the printed overall (39.5%)
worst drift 2/16" = 0.1250"
worst case: overall 36'-5 5/8" | partials 7'-3 1/2" + 9'-1 3/8" + 9'-10 1/8" + 10'-2 1/2"
```
7'-3 1/2" + 9'-1 3/8" + 9'-10 1/8" + 10'-2 1/2" = 36'-5 1/2". The sheet says
36'-5 5/8" one line above it.

**And end to end in the app** (`audit-repros/r27-dim-sum-app.spec.js` — trace,
BUILD HOUSE, place three windows, press AUTO DIMS, then read the dimension
records back out of the store and print them exactly as the sheet does). Four
hand-traced houses, one sheet already wrong:

```
MISMATCH: 5'-0" + 8'-9 15/16" + 8'-9 15/16" + 5'-0"  =  27'-7 7/8"   vs overall 27'-7 15/16"   DRIFT 1/16"
adds up : 5'-0" + 8'-0 1/4"  + 8'-0 1/4"  + 5'-0"  =  26'-0 1/2"  vs overall 26'-0 1/2"
adds up : 5'-0" + 8'-6"      + 8'-6"      + 5'-0"  =  27'-0"      vs overall 27'-0"
adds up : 5'-0" + 8'-3"      + 8'-3"      + 5'-0"  =  26'-6"      vs overall 26'-6"
```

That first line is a permit sheet whose window string is 1/16" short of the
overall printed directly above it.

**Repro:** run either spec. Or trace any house with a finger, place three
windows on one wall, press AUTO DIMS, and add the string up by hand.

**Falsification attempt.** The way this is *not* a bug is if committed
geometry is quantised to 1/16", because then every partial is an exact multiple
of 1/16 and the sums are exact. I looked for that quantisation and it is not
there: `formatters.normalizeArchitecturalInches` snaps only values that come
back from `parseArchitecturalLength` (typed lengths), and
`_pointForStorage` (`MODEL.dc.html:2359`) stores `point.x` raw. A live readback
of a traced house gives a true span of 331.92" — 5310.72 sixteenths. I also
checked the suite: `tests/auto-dims.spec.js` asserts segment *geometry*
(`toBeCloseTo(16, 1)`) and never compares printed strings, so nothing defends
this today. It is not asserted anywhere, and it is not prevented anywhere.

**Shape of the fix.** Dimension text must be derived from a single quantisation
pass over the whole string: round the *coordinates* to the display grid once
(per string, at generation), then print differences of rounded coordinates.
Every partial then sums to the overall by construction, and the drawn geometry
matches the printed number. Snapping committed points to 1/16" at commit time
would fix it more thoroughly and fixes the beginner's "21'-8 7/8" house" at the
same time.

---

## C2 — There is no touch input path; every drag interaction is unreachable on the target device
**Severity: CRITICAL · Confidence: CONFIRMED**
`MODEL.dc.html:5398-5410`, `LAYOUT.dc.html:229-235`.

**What breaks.** The only input listeners in the app are mouse ones:

```js
canvas.addEventListener('mousemove',  …)   // MODEL.dc.html:5398
canvas.addEventListener('mousedown',  …)   // :5399
canvas.addEventListener('dblclick',   …)   // :5400
canvas.addEventListener('contextmenu',…)   // :5401
canvas.addEventListener('wheel',      …)   // :5402
window.addEventListener('mousemove',  …)   // :5404
window.addEventListener('mouseup',    …)   // :5405
```

`grep -c "pointerdown\|pointermove\|touchstart\|touchmove"` returns **0** for
`MODEL.dc.html`, `LAYOUT.dc.html`, `PROJECT.html`, `SETTINGS.html`,
`STANDARDS.html` and `index.html`. The only hits in the repo are the DC engine's
attribute→prop name table (`support.js:336-348`, unused by any template) and
`Notepad.dc.html:62-68`, a small side page that *does* bind
`touchmove`/`touchend` — so the pattern exists in the codebase, one file over
from the drafting surface.
Mobile Safari emits a synthetic mousedown/mouseup pair for a *tap*, which is why
tools can be selected and points placed. It does **not** emit mousemove for a
moving finger — the browser takes that gesture for scrolling — and it emits no
`wheel` and no `contextmenu` at all.

Consequences on an iPad, all confirmed against an emulated iPad (1024×768,
`hasTouch`, DPR 2, CDP touch events):

- One-finger drag on the canvas: pixel-identical screenshot before and after.
- Two-finger pinch: pixel-identical screenshot before and after.
  (Events *do* arrive — I logged `pointerdown:touch`, `pointermove:touch`,
  `touchstart`, `touchmove` on window — the app has nothing bound to them.)
- Therefore: **no pan and no zoom**. `_panning2D` (`MODEL.dc.html:10186`) is set
  only from a mousedown; `_onWheel` (`:10427`) is the only zoom path.
- Therefore: no node drag, no wall drag, no window/crossing selection, no arc
  drag, no fixture drag, no room-tag drag, no roof pull, and on LAYOUT no
  viewport drag.
- `contextmenu` → `_onRightClick()` is dead code on iOS.
- The drawing canvas has `touch-action: auto` (computed), so on real Safari the
  browser claims the gesture before the app could see it even if it were bound.

**Repro:** emulate any touch device, build a house, then attempt to pan or
zoom. Nothing moves. (Driver used: `/tmp/fc/drive.js`; steps in
`AUDIT-FIRST-CONTACT.md` §00:26.)

**Falsification attempt.** This is not a bug if the app deliberately ships
desktop-only for now. I looked for evidence of that intent: none in
`README.md`, `ARCHITECTURE.md`, or `REFACTOR-PLAN.md`; the opposite is stated in
the product brief ("Target users include complete beginners on iPads"). I also
checked whether a synthesised mousemove might arrive during a touch drag in
Chromium — it does not; only `pointermove` with `pointerType:'touch'` arrives,
and nothing is bound to it.

**Shape of the fix.** Bind `pointerdown/move/up` instead of the mouse trio (they
cover mouse, pen and touch in one), add a two-pointer pinch/pan gesture on the
canvas, and set `touch-action: none` on the drawing surfaces.

---

## C3 — LAYOUT writes a stale whole-drawing snapshot over MODEL's work
**Severity: CRITICAL · Confidence: CONFIRMED · Silent data loss**
`LAYOUT.dc.html:317-335` (`_persistLayout`), `LAYOUT.dc.html:244-257`
(`_loadDrawing`), `MODEL.dc.html:5096-5125` (`_markUnsaved`),
`shared-file-store.js:53-60`.

**What breaks.** LAYOUT parses the whole drawing into `this._saved` once, at page
load. `_persistLayout` then does:

```js
this._saved.layout = { …sheet state… };
const file = new File([JSON.stringify(this._saved)], 'model-drawing.json', …);
… SharedFileStore.saveSharedFile(file, MODEL_STORAGE_BUCKET)
```

It never re-reads the store, never compares versions, and writes the *entire*
document, not just `layout`. The store is a single-record bucket
(`saveSharedFiles` replaces the record wholesale). So every MODEL edit made
after LAYOUT loaded is destroyed the first time the sheet changes.

The mirror case exists too: MODEL's `_markUnsaved` also serialises and writes the
whole drawing, so a LAYOUT change made after MODEL loaded is destroyed by the
next MODEL edit. MODEL at least carries `layout` through (`:2639`), so it only
loses changes made in the other tab, not the concept.

**Repro** — `audit-repros/r1-layout-clobber.spec.js`, run and failing today:

```
lines at layout open: 8   after MODEL edit: 9
lines before layout write: 9   after: 8
```

```js
await openModel(page); /* trace + BUILD HOUSE */
const layout = await context.newPage();
await layout.goto('/LAYOUT.dc.html');
await layout.waitForFunction(() => document.body.dataset.layoutReady === '1');
await page.bringToFront();            // draw one more line in MODEL, autosaved
await layout.bringToFront();
await layout.getByRole('button', { name: /8\.5 × 11/i }).click();   // any sheet change
// the line is gone from the stored drawing
```

**Falsification attempt.** This is not a bug if two tabs are impossible or if
some guard re-reads before writing. Neither holds: MODEL and LAYOUT link to each
other with plain `<a href>` (`MODEL.dc.html:1554`), which a long-press or a
middle-click opens in a second tab; the app's own first-run notice ("CLOSE ALL
OTHER BROWSER WINDOWS AND TABS") is evidence that users *do* have several open.
I grepped LAYOUT for `visibilitychange`, `focus`, and `storage` listeners to see
if it refreshes `_saved` when re-focused — there are none (only mousemove,
mouseup, keydown, wheel). And `shared-file-store.writeRecords` is a blind `put`,
with no read-modify-write and no version field to conflict on.

**Shape of the fix.** LAYOUT should re-read the record inside the save queue and
merge only its `layout` key (read-modify-write in one IndexedDB transaction), and
the record should carry a monotonic revision so a stale write is refused rather
than applied.

---

## C4 — Undo and redo exist only on the keyboard
**Severity: CRITICAL (for the stated user) · Confidence: CONFIRMED**
`MODEL.dc.html:18795-18802`, `profile-manager.js:129-130`.

**What breaks.** Undo is reachable only through `matches('undo')` in the keydown
handler, bound to `Ctrl+Z`. A DOM-wide search for any control whose text,
`title`, or `aria-label` matches /undo|redo/ returns **zero elements**. On a
tablet with no keyboard every action is permanent; the only recovery is select +
DEL, and selection itself needs a drag for anything but a single item (see C2).

**Repro:** open MODEL, run
`[...document.querySelectorAll('*')].filter(e => /undo|redo/i.test((e.getAttribute('title')||'')+(e.getAttribute('aria-label')||'')+e.textContent)).length`
→ `0`.

**Falsification attempt.** A hidden gesture would falsify this — a two-finger
tap, a shake, a swipe. I bound listeners for every touch and pointer event on
window and drove taps, drags and pinches; nothing in the app responds to any of
them (C2). There is no gesture layer to hide an undo in.

**Shape of the fix.** Two buttons in the bottom strip, ≥44 px, wired to the same
`_undo()` / `_redo()`.

---

## C5 — Section floor bands span every wall the cut crosses, regardless of which building it belongs to
**Severity: CRITICAL · Confidence: CONFIRMED · Reaches paper**
`MODEL.dc.html:8709-8712` (`levelSpan`), `:8789-8800` (the band draw),
`MODEL.dc.html:8558-8582` (`_sectionWallCrossings`).

**What breaks.** The generated section draws one floor-assembly band per level:

```js
const levelSpan = levelId => {
  const us = crossings.filter(c => c.wall.levelId === levelId).map(c => c.u);
  return us.length ? { min: Math.min(...us), max: Math.max(...us) } : null;
};
…
const span = levelSpan(level.id) || fdnSpan;
ctx.fillRect(x, Y(level.floorTop), wid, depth);   // one rectangle, min → max
```

`_sectionWallCrossings` walks `this._walls` with **no filter at all** — every
level, every view, garage-body walls included (and BONEYARD shelf walls, which
carry negative level ids). Garage walls are stored on the same level as the house
walls, so `levelSpan(MAIN)` runs from the house's outermost crossed wall to the
garage's outermost crossed wall and the band is drawn as a single unbroken
rectangle between them.

**What the drafter gets, measured on the rendered section** (both screenshots
attached to the reproductions, both taken from the app):

*Attached garage* (`audit-repros/r13-section-band-attached.spec.js`) — the common
case. Band spans on the section canvas:

```
2ND FL band : rows 336-356, x 150..489  (340 px)   ← house only, correct
MAIN FL band: rows 532-545, x 150..746  (597 px)   ← house + garage
```
The main-floor band is 76% wider than the storey above it and carries the label
`11 7/8" TJI + 3/4" SHTG` across a garage that is a **4" slab on grade**. The
space under that band inside the garage is drawn as an open storey — the section
tells a plan examiner there is a basement under the garage. No garage slab is
drawn at all in this cut: the slab/gravel detail at `:8748-8776` needs
`beamCrossings.length > 1`, and a cut through one grade-beam leg gives one.

*Detached garage* (`audit-repros/r12-section-band-gap.spec.js`) — same code, worse
picture:

```
widest floor-band run: 656 px, x 142..797, in ONE unbroken run
band runs on that row: [[142,797]]
```
One framed floor, drawn continuously from the house across six feet of open
ground to a garage twenty feet away.

**Repro.** Run either spec; each writes the section it produced to
`/tmp/fc/section-attached.png` / `/tmp/fc/section-house-garage.png`. By hand:
build a house, mark an attached garage, BUILD HOUSE, press `c` and cut a line
through both, open S1.

**Falsification attempt.** This is not a bug if garage walls are meant to sit on
their own level, or if something downstream masks the band over the garage. I
checked both. Garage walls are pushed with the level being built and only a
`body: 'garage'` marker (`MODEL.dc.html:12006`, `:12181`), so they share
`levelId` with the house walls; `levelSpan` filters on `levelId` alone and never
looks at `body` or at the garage outline. And nothing masks it — the band is a
single `fillRect`/`strokeRect` pair with no clipping, and the rendered pixels
above show it unbroken. I also checked the suite: `tests/section-view.spec.js`
covers a cut through the garage *only* (`:178`, `:238`) and a house+garage
**elevation** (`:365`, which asserts `gapFaint < 10` — no level line across the
gap, and that path is correct). There is no spec for a section cutting through
both bodies. Not a wrong test; a missing one, over the exact case.

**Shape of the fix.** Band by body, not by level: group the crossings into
contiguous runs (garage outline membership is already computable —
`_edgeOnOutline` against `_garageOutlines(levelId)`, used at `:8921-8926` in the
elevation path) and draw one band per run at that body's own floor elevation, or
none where the body is slab-on-grade. The elevation path already does this
grouping; the section path never got it.


---

## C6 — A rounding tolerance mismatch silently deletes the roof from a section
**Severity: CRITICAL · Confidence: CONFIRMED · Reaches paper**
`geometry-2d.js:683` and `geometry-2d.js:703` (`profileEnvelope`), consumed at
`MODEL.dc.html:8666-8677` and gated at `:8811` (`if (lit.length > 1)`).

**What breaks.** `profileEnvelope` collects the u-coordinates of every profile
breakpoint into a Set, quantised to five decimals:

```js
const events = new Set(profiles.flat().map(p => +p.u.toFixed(5)));   // :683
```

and then evaluates each event against the profile with a **1e-6** containment
tolerance:

```js
if (u >= a.u - 1e-6 && u <= b.u + 1e-6 && b.u - a.u > 1e-9) { …interpolate… }
return null;                                                          // :703-707
```

`toFixed(5)` moves a value by up to **5e-6** — five times the tolerance. When a
profile endpoint's rounded u lands more than 1e-6 outside the segment it came
from, `valueAt` returns null, the point is filtered out (`:715`), and the
envelope comes back shorter than the profile it was handed. The section then
does `const lit = roofSamples.filter(s => s.elev != null); if (lit.length > 1)` —
with one sample left, **no roof is drawn at all**, and `yTop` falls back to
`stack.bearing + 4`, so the sheet is a house with an open top and no ridge, no
rafters, no fascia. No message, no console warning.

**Measured, two neighbouring cuts through the same house** (`audit-repros/r24-roof-drop.spec.js`,
running the section's own pipeline on the app's own cut records):

```
S1  cut (-16,-13)→(16,13)   profile 3 points → envelope 1 lit    <-- no roof drawn
      u=-17.443908416  rounded=-17.443910000  drift=1.58e-06  > 1e-6  DROPPED
      u= -0.000000000  rounded= 0.000000000   drift=2.80e-14         kept
      u= 17.443908416  rounded= 17.443910000  drift=1.58e-06  > 1e-6  DROPPED

S2  cut (-16,-13.4)→(16,13.4) profile 3 points → envelope 3 lit   <-- roof drawn
      u=±17.132150519  rounded=±17.132150000  drift=5.19e-07  < 1e-6  kept
```

A cut rotated by **0.9°** is the difference between a section with a roof and a
section without one.

**How often** (`audit-repros/r25-envelope-sweep.spec.js`, 401 cut angles across a
plain hip roof, using the shipped `roofProfile` + `profileEnvelope`):

```
401 cut angles across a hip roof:
  intact profile                                 : 233  (58%)
  endpoint(s) dropped, roof drawn but short      : 117  (29%)   e.g. 14.1deg 5->3
  collapsed to <2 samples, NO ROOF DRAWN         :  51  (13%)   e.g. 38.3deg 3->1
```

**42% of non-orthogonal section cuts render the roof wrong**, and the 29% case is
the more dangerous one: the roof is still drawn, just missing breakpoints, so the
sheet looks finished and is not.

**Repro.** Build any house, press `c`, cut corner to corner —
`(-16,-13) → (16,13)`, viewer below — and open S1. Screenshot:
`audit-repros/evidence/diagonal-section-no-roof.png`. Then repeat with the cut
0.9° steeper; the roof comes back.

**Falsification attempt.** This could be a `roofProfile` failure rather than an
envelope failure, or an artefact of my synthetic roof. I ruled both out: called
`roofProfile` directly with the **app's own saved roof record** and the **app's
own axis** (`axis = { x: dir.z, z: -dir.x }`, matching `MODEL.dc.html:8624`) and
got a valid 3-point profile in both the working and the failing case — the
profiles are identical in shape and differ only in the sixth decimal of u. The
loss happens strictly inside `profileEnvelope`, and the drift figures above show
exactly which comparison rejects the point. I also checked that the viewer-side
click is not the variable: `_finalizeCut` stores an exact perpendicular
(`MODEL.dc.html:18578-18600`), so `axis` is always parallel to the cut line, and
all three viewer choices on the failing cut produce the same missing roof. And I
grepped the suite: `tests/section-view.spec.js:295` covers an angled cut, but it
asserts the *silhouette is smooth* on an **elevation** (a cut standing outside
the house), not the roof profile of a section cutting through it. Nothing
defends this.

**Shape of the fix.** One line: make the containment tolerance larger than the
quantisation (`1e-6` → `1e-4`), or stop rounding the events and dedupe with a
tolerance instead. Then assert `envelope.length >= profile.length` for every
profile fed in.


---

# MAJOR

## M1 — The 2D overlay is rendered at 1× on every high-DPI screen
**Severity: MAJOR · Confidence: CONFIRMED · Reaches paper**
`MODEL.dc.html:5723-5724`.

```js
const w = this._canvas.clientWidth, h = this._canvas.clientHeight;
if (oc.width !== w || oc.height !== h) { oc.width = w; oc.height = h; }
```

The overlay backing store is sized in **CSS pixels**. Every piece of drafting ink
— walls, dimensions and their text, sections, elevations, room tags, notes —
lives on this canvas and is therefore rasterised at 1× and upscaled by the
browser. Measured on an emulated iPad at DPR 2: WebGL canvas `2048×1380` backing
for `1024×690` CSS (it *does* scale — `_renderer.setPixelRatio(min(dpr,2))`,
`:5188`), overlay `1024×690` backing for the same box.

The view-rail thumbnails are explicitly drawn at 2× ("2x the CSS size, crisp
lines", `:5553`, `:5599`), so the author knows about DPI; the main drawing
surface is the one place it was not applied. When printing lands, this canvas is
the print source: a permit sheet rasterised at 96 dpi.

**Repro:** open MODEL on any DPR≥2 device;
`document.querySelector('[data-model-overlay]').width` equals its CSS width.

**Shape of the fix.** Size the backing store to `clientWidth * dpr`, scale the
context by `dpr`, keep all drawing code in CSS units.

---

## M2 — Every page blocks first paint on a third-party font stylesheet
**Severity: MAJOR · Confidence: CONFIRMED**
`MODEL.dc.html:35`, `LAYOUT.dc.html:20`, `PROJECT.html:11`, `SETTINGS.html:9`,
`STANDARDS.html:10`, `index.html:15`.

A render-blocking `<link rel="stylesheet" href="https://fonts.googleapis.com/…">`
sits in the head of every page of an app whose own first-run dialog says "the
drafting engine runs entirely on your machine". When that host is slow or
unreachable, the parser stalls until the connection gives up.

**Measured** (`audit-repros/p11-font-block.spec.js`, network to Google blocked as
it would be on a job site with no signal):

```
model-ready as shipped     : 12936 ms
model-ready with fonts cut :   395 ms
```

A CPU profile of that 12.9 s (`audit-repros/p10-profile.spec.js`) is **96.5%
idle** — it is pure waiting, not work. `domInteractive` 12585 ms while the last
script finished downloading at 76 ms (`p8`).

This is also where the Playwright suite's runtime goes: 564 tests × ~12.5 s of
font stall ≈ **2 of the ~3 hours**. See AUDIT-PERF.md.

**Shape of the fix.** Self-host the two families in `vendor/` (the repo already
vendors React, three.js and pdf.js for exactly this reason), or at minimum load
them non-blocking with a system-font fallback.

---

## M3 — A placed viewport's scale can never be changed, and the status bar reports the selection anyway
**Severity: MAJOR · Confidence: CONFIRMED · Print foundation**
`LAYOUT.dc.html:795` (`_setScale`), `:762` (new viewport takes the scale),
`:896` (`scaleLabel: SCALES[activeScale].label`), `:147` (footer template).

`_setScale(idx)` only writes `activeScale` into state. Nothing walks the placed
viewports. A viewport's `pif` is fixed at creation, and there is no UI to edit it
— the only way to rescale a sheet is to delete the viewport and add a new one,
which no affordance suggests.

Meanwhile the sheet footer prints `SCALES[activeScale].label`, so it changes to
the scale you picked while the drawing on the sheet stays at the old one.

**Repro** — `audit-repros/p6-scale-select.spec.js`:

```
after placing at 1/4: {"pifs":[0.25],"footer":"1/4\" = 1'-0\""}
after clicking 1/8 : {"pifs":[0.25],"footer":"1/8\" = 1'-0\""}
```

Mitigation that stops this being CRITICAL: the *titleblock* SCALE cell derives
from the viewports' own `pif` (`LAYOUT.dc.html:615-618`), so the printed sheet
stays self-consistent — it is the app chrome that lies, not the paper. Verified
by reading `_titleblockInfo`.

**Shape of the fix.** Apply the scale to the selected viewport (and show the
selection), or disable the scale buttons while a viewport is selected and offer a
per-viewport scale control.

---

## M4 — `num()` coerces `null`, `""`, `false` and `[]` to 0: geometry silently relocates on load
**Severity: MAJOR · Confidence: CONFIRMED · Silent corruption**
`drawing-format.js:9`, `drawing-format.js:30-44` (`point`), `MODEL.dc.html:2359`
(`_pointForStorage`).

```js
const num = value => (Number.isFinite(Number(value)) ? Number(value) : null);
```

`Number(null)`, `Number("")`, `Number(false)` and `Number([])` are all `0` and
all finite. The schema gate therefore accepts them as a coordinate of zero. It
never refuses the file and never reports the entity as skipped.

This matters because `_pointForStorage` writes `x` raw, and `JSON.stringify(NaN)`
is `null`. Any coordinate that ever goes NaN is written as `null` and comes back
as **0** — the geometry moves to the origin and, on the next autosave, the
original is overwritten with the corrupted value.

**Repro** — `audit-repros/r7-coordinate-corruption.spec.js`:

```
seeded  : wall-1 (10,10) → (null,10)          [what a NaN serialises to]
loaded  : wall-1 (10,10) → (0,10)             [silently relocated, then re-saved]

seeded  : x:"" , x:false , x:[]
loaded  : all three become x:0 — 2 walls kept, one of them zero-length
```

**Shape of the fix.** `const num = v => (typeof v === 'number' && Number.isFinite(v) ? v : null)`,
and reject the entity (count it in `skipped`) rather than defaulting a
coordinate. Also reject zero-length walls, which currently survive the gate.

---

## M5 — Deleting a level orphans five collections, then blames the user's file for it
**Severity: MAJOR · Confidence: CONFIRMED**
`MODEL.dc.html:8395-8443` (`_deleteLevel`), `drawing-format.js:46-49`
(`levelId`), `MODEL.dc.html:4962-4966` (the "incomplete" message).

`_deleteLevel` filters `_lines`, `_walls`, `_floors`, `_shapes`, `_roofs`,
`_outlines`, `_surfaceOpenings`, `_dimensions`, `_columns`, `_beams`. It does
**not** filter `_fenestrations`, `_fixtures`, `_stairs`, `_notes`, or `_roomTags`.
Those records keep a `levelId` for a level that no longer exists and a `wallId`
for a wall that was just deleted, and they are written to the saved file.

On the next load, `levelId(value, levelIds)` returns null for them, they are
dropped, and the count lands in `skipped`, which renders as:

> "Saved drawing loaded — 1 item was incomplete and could not be loaded."

The user deleted a floor. The app tells them their drawing was damaged.

**Repro** — `audit-repros/r6-level-delete.spec.js`:

```
2ND FL owns before delete: {"walls":4,"fenestrations":1,…,"dimensions":4}
2ND FL owns after delete : {"walls":0,"fenestrations":1,…,"dimensions":0}
message after reload     : "Saved drawing loaded — 1 item was incomplete and could not be loaded."
```

**Shape of the fix.** Add the five collections to the filter list; better, derive
the delete from one list of level-owned collections so the next collection added
cannot be forgotten.

---

## M6 — `offsetOutline` has no self-intersection cleanup and no zero-length-edge guard
**Severity: MAJOR · Confidence: CONFIRMED (function) / INFERRED (reachability) · Reaches paper**
`geometry-2d.js:297-322`, consumers at `MODEL.dc.html:12506` (roof footprint),
`MODEL.dc.html:14508`, `auto-dims.js:67` (bearing line for the ROOF-level truss
dimensions), `MODEL.dc.html:14835` (thickened-edge slab ring).

It is a plain miter offset: each edge is displaced, adjacent edges are
intersected, done. Two failure modes, both measured by calling the shipped
function (`audit-repros/r9-offset.spec.js`):

**(a) Narrow features invert.** A 3'-wide neck offset inward by a 2' overhang:

```
narrow-neck footprint area 230.00 -> inward 2ft area 86.00
offset ring: (2,2) (18,2) (18,8) (9.50,18) (10.50,18) (10.50,8) (2,8)
```
The neck's two sides have swapped places — the ring self-intersects. `auto-dims`
uses exactly this inward offset to find the bearing-wall corners that break the
ROOF-level truss string, so the printed truss dimensions on such a plan are
taken from a crossed polygon.

**(b) A duplicated point kills the overhang at that corner.**

```
square + duplicate corner, offset outward 2ft:
  ring : (-2,-2) (22,-2) (20,20) (20,22) (-2,22)   area 550
  clean: (-2,-2) (22,-2) (22,22) (-2,22)           area 576
```
The doubled corner does not move outward at all (`const len = Math.hypot(dx,dz) || 1`
gives a zero normal for the degenerate edge), so the roof footprint loses its
overhang at that corner — visible on the roof plan and in every elevation.

**Reachability (why INFERRED, and how to settle it).** Consecutive duplicates are
guarded while tracing (`MODEL.dc.html:10763-10770` treats a repeat click as a
close). What I did not test is dragging one master outline node onto its
neighbour, which would leave two coincident points in a committed outline; that
is the experiment that would make (b) CONFIRMED end-to-end. (a) needs no
degenerate input at all — any house with a wing narrower than twice the roof
overhang reaches it.

**Shape of the fix.** Drop zero-length edges before offsetting, and run a
self-intersection removal pass (or a proper polygon-offset routine) on the result.

---

## M7 — `mergeJogs` prints a dimension to a coordinate where no wall stands
**Severity: MAJOR · Confidence: CONFIRMED · Reaches paper**
`auto-dims.js:91-104`, tuning at `MODEL.dc.html:1618`
(`AUTO_DIM_JOG_MERGE_FT = 2/12`).

Corners within 2" of each other are strung as one coordinate. End clusters keep
the true extreme, so overalls stay honest — but a **middle** cluster is replaced
by the arithmetic mean of its members:

```js
return cluster.reduce((sum, value) => sum + value, 0) / cluster.length;
```

**Measured** (`audit-repros/r26-jog-merge.spec.js`, through the shipped
`computeAutoDimStrings`): a north wall that steps 1.5" at x = 2, so the two real
wall faces stand at 2.000 ft and 2.125 ft — 12'-0" and 12'-1 1/2" from the west
wall.

```
the two real wall faces sit at x = [2, 2.125]
coordinates the strings actually use: [-10, 2.0625, 10]
printed distance from the west wall to the jog: "12'-0 3/4""
```

The sheet dimensions the jog to **12'-0 3/4"** — 3/4" from one wall and 3/4" from
the other, a position where nothing is built. The overall still adds up, so
arithmetic checking cannot catch it; a framer measuring from the string lands
3/4" out on both faces.

`tests/auto-dims.spec.js:209` covers a jog on the *perpendicular* axis (the
string's stand-off), not the averaging of an interior coordinate, so nothing
asserts this either way. Whether a 2" fabrication is acceptable on a permit set
is a policy call, not a code call — see `AUDIT-QUESTIONS.md` Q3. Note also that
the code comment says "merged into the neighbouring corner" while the code
averages; whichever is intended, one of the two is wrong.

## M8 — LAYOUT cannot be operated by touch at all
**Severity: MAJOR · Confidence: CONFIRMED**
`LAYOUT.dc.html:229-235`.

A subset of C2 worth its own work order because the fix is separate: LAYOUT binds
`wheel`, `mousedown`, `mousemove`, `mouseup`, `keydown` — nothing else. Placing a
viewport by tap may survive on Safari's synthetic click; **dragging one to
position cannot**, and the sheet cannot be panned or zoomed. The sheet page is
the print foundation and is currently desktop-only.

---

## M9 — The elevation/section silhouette is recomputed from scratch every frame
**Severity: MAJOR (perf) · Confidence: CONFIRMED**
`MODEL.dc.html:8968-8992`.

`_drawElevationWorkspace2D` samples a 241 × 41 grid — **9,881 probes per
repaint** — and each probe loops every roof calling `_sectionRoofHeightAt`
(point-in-face across the roof's faces). It runs inside `_redrawOverlay`, which
runs on every invalidated frame, i.e. on every mouse move. The thumbnails next to
it are explicitly cached by epoch ("Repaints only when the model changes … never
on mouse traffic", `:5514`); the full-size view is not.

Measured with one roof on a desktop-class CPU (`audit-repros/p3-perf-elevation.spec.js`):

```
PLAN mousemove : median 16.7 ms  p95 18.7  max 20.9
E1   mousemove : median 17.5 ms  p95 25.8  max 32.2
```
p95 is +38% and max +54% with a single roof; a house with an attached garage
doubles the roof loop. Numbers and the iPad extrapolation are in AUDIT-PERF.md.

---

## M10 — LAYOUT discards sheet work silently when the store rejects a write
**Severity: MAJOR · Confidence: CONFIRMED · Silent data loss**
`LAYOUT.dc.html:334` vs `MODEL.dc.html:5119-5124`.

```js
// LAYOUT
.catch(error => console.warn('Unable to save the layout:', error));
```

Driven with every `saveSharedFile` rejecting, the way a full quota, a private
window, or an iPad Safari storage eviction does
(`audit-repros/r19-save-failure.spec.js`):

```
MODEL : status pill "UNSAVED", data-save-dirty stays 1, editing continues, and
        the next successful write persists everything (3 of 3 lines recovered)
LAYOUT: nothing surfaced anywhere in the DOM, layoutSaveSeq stays 0, and after
        a reload the viewport just placed is gone (0 viewports)
```

A drafter can compose an entire sheet and lose all of it on the next page load
with no signal. MODEL's handling of the identical failure is correct and is the
shape to copy: surface the state, keep the dirty flag, let a later write recover.

Damage 4 × Likelihood 2 = 8 — below the top ten only because it needs the store
to fail; when it does, the loss is total and silent.

---

## What I did not examine

- **Sections (S1/S2) beyond the two families I proved.** I found and proved the
  floor-band case (C5) and the roof-profile dropout (C6), and read the
  foundation, grade-beam, slab, grade and wall-standing code around them. I did
  **not** audit: doubled linework at shared corners, layering/draw order, the
  bottom-chord ceiling lines on multi-roof houses, the window and door details in
  `_drawSectionWall`, or what happens when a cut crosses a BONEYARD shelf wall
  (`_sectionWallCrossings` filters nothing, so shelf geometry is in the crossing
  list and stretches the grade line — I saw the code path but never built the
  case). Two of the first three things I looked at in this family were wrong; I
  would expect more here, and this remains the largest hole in the report.
- **`auto-stair.js` (496 lines) end to end.** I checked the riser derivation
  (`_stairLayout`, `MODEL.dc.html:16779-16785`) — `ceil(rise / 7.875)` with an
  even divide, which is correct — and the L/U landing split only by reading. No
  headroom or auto-placement testing.
- **`pdf-scan.js` and underlay ingestion.** Not opened beyond confirming the
  pdf.js worker is configured (`MODEL.dc.html:30`). Hostile-PDF handling is
  untested.
- **`support.js` (1,911 lines)** — the DC template engine everything renders
  through. Two `innerHTML` sinks at `:470` and `:480` feed on template text; I did
  not audit whether user strings (project name, level name from `window.prompt`,
  note bodies) can reach them.
- **PROJECT / SETTINGS / STANDARDS pages** beyond enumerating their
  `innerHTML` uses.
- **The 3D view**, garages (attached and detached), split levels, and the
  fenestration detail views.
- **Real iPad Safari.** Everything device-related here is Chromium emulating a
  touch device, which is more forgiving than the real thing. Every touch finding
  should reproduce worse on hardware, not better.
- **The full suite result.** It was still running when I wrote this. See
  AUDIT-FULL.md §7.1 for the failures and the proof that they are environmental.
