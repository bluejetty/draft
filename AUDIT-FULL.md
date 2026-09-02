# AUDIT-FULL.md — MINOR and NIT findings, by area

CRITICAL/MAJOR live in `AUDIT-CRITICAL.md`; measurements in `AUDIT-PERF.md`.
Anything I checked and found sound is stated in one line and dropped.

---

## 1. Data integrity and persistence

**1.1 `shared-file-store.js` read-modify-write is not atomic — MINOR, INFERRED**
`shared-file-store.js:62-67`, `:92-97`, `:105-108`. `addSharedFile`,
`saveNamedFile` and `removeNamedFile` each do `readRecords()` (one transaction),
mutate the array in JS, then `writeRecords()` (a second transaction). Two calls in
flight — dropping two underlay files at once, or one page adding while another
removes — both read the same array and the second write erases the first's
record. Fix: do the read and the put inside one `readwrite` transaction.

**1.2 LAYOUT discards sheet work silently when a write fails — MAJOR, CONFIRMED**
Promoted to `AUDIT-CRITICAL.md` M10.

**1.3 Correction to my own first-contact log — no finding**
I recorded that the SAVED indicator never changes. It does: `_markUnsaved`
(`MODEL.dc.html:5096-5104`) sets `persistenceStatus: 'UNSAVED'` synchronously and
the queue flips it back to `SAVED` when the IndexedDB write lands. My sampling
was coarser than the write. The app autosaves on **every** mutation and the
drawing survives a tab close. Recorded here because the naive log is submitted
unedited and this is where it was wrong.

**1.4 localStorage keys — enumeration, no collision found**
Three, all namespaced: `draft-bone-wallet` (`bone-wallet.js:23`),
`draft-active-package:settings` and `draft-active-package:standards`
(`profile-manager.js:7,37`). Plus the test-only `draft-test-storage-cleared` in
`tests/helpers.js`. No unprefixed keys, no schema versioning on any of them — a
future shape change to a package will be read as-is by an old tab. The drawing
itself lives in IndexedDB `pdf-img-mgr-shared` / store `files` / key
`model-drawing`, which is a confusing name for the record that holds all of the
user's work (the DB name is from the PDF-underlay tool it was borrowed from).

**1.5 Two tabs on the same drawing — see C3.** Beyond the LAYOUT clobber: two
MODEL tabs have no coordination either. Neither listens for `storage` events or
IndexedDB changes, so the second tab's next edit writes its stale document over
the first tab's work. Same fix (a revision on the record) covers both.

**1.6 Wallet in private browsing grants infinite bones — MINOR, by design**
`bone-wallet.js:60-63` swallows `setItem` failures, so in a storage-denied
context every `read()` re-seeds 3 bones and every spend is forgotten. The file's
header calls the honour system deliberate, so this is noted, not filed.

**1.7 Undo/redo stack integrity under key repeat — checked, sound**
`_undo()` is async and called fire-and-forget from the keydown handler
(`MODEL.dc.html:18800`), which looked like a race. It is not, in practice: four
undo keydowns dispatched inside one frame land on the correct state and four
redos retrace it exactly (`audit-repros/r4-undo-race.spec.js`). History is also
correctly bounded by count and bytes. I could not break it.

---

## 2. Schema and id allocation

**2.1 Duplicate level ids are not deduped — MINOR, INFERRED**
`drawing-format.js:52-60`. `levels()` filters on `Number.isFinite(id)` and maps;
nothing rejects a repeat. A file with two levels of id 3 loads both into the
level rail, while `levelIds` (a Set) holds one and `levels.find(l => l.id === 3)`
always resolves the first. Every piece of geometry on level 3 then belongs to
both cards. Fix: `seen` set, as `cuts()` and `dimensions()` already do.

**2.2 Fixtures are left out of the item-id recovery — MINOR, INFERRED**
`MODEL.dc.html:4859`. `numericItemIds` spreads lines, walls, floors,
fenestrations, surfaceOpenings, shapes, roofs, outlines, boneyard outlines and
marks — but not `this._fixtures`, which mint ids from the same shared counter
(`_newDrawingItemId('fixture')`, `:2354`). Saved files carry
`nextDrawingItemId` so the counter is normally right; a legacy or hand-edited
file without it, whose highest ids belong to fixtures (a kitchen preset drops
many at once), will re-mint ids that already exist. Two fixtures then share an
id and delete/select act on the wrong one.

**2.3 Zero-length walls survive the schema gate — MINOR, CONFIRMED**
`audit-repros/r7-coordinate-corruption.spec.js` case 2 loads a wall whose start
and end both coerce to (0,12) and keeps it. `dimensions()` rejects degenerate
ends (`drawing-format.js:94`); `walls()` does not. Downstream painters bail on
`len < 0.001` so nothing crashes, but the corners join the auto-dim corner list
and the wall-join index.

**2.4 Ids near `MAX_SAFE_INTEGER` — NIT, INFERRED**
`_nextColumnId = Math.max(1, ...columns.map(c => c.id + 1), …)`
(`MODEL.dc.html:4719`, and the same shape for beams/stairs/notes/roomTags).
At `2**53 - 1`, `id + 1` is not distinguishable from `id`, so the next entity
collides. Hand-edited files only.

---

## 3. Geometry

**3.1 auto-dims drops sub-0.6" partials silently — NIT, INFERRED**
`auto-dims.js:242`: `if (b - a < 0.05) continue;`. A partial shorter than 0.05 ft
is skipped, leaving a gap in the string that the remaining partials do not
account for. In practice the 2" jog merge (`AUTO_DIM_JOG_MERGE_FT`) collapses
most candidates first, so I could not produce one from the UI; the opening-centre
string is not merged and is the reachable path (a window centre less than 0.6"
from a corner — physically impossible for a real window).

**3.2 `wallBounds` pads by a full wall thickness on each side — NIT**
`layout-plan.js:121-133` uses `reach = def.totalIn / 12` (the whole assembly) as
the outward pad on both sides of each endpoint, where half is the true reach. A
viewport frame is therefore about one wall thickness larger than the plan in each
direction, and viewport centring is off by up to half that. Cosmetic today,
sizing math tomorrow.

**3.3 `_metric` prints millimetres against a sixteenth-inch model — NIT**
`MODEL.dc.html:19083`: `(feet * 0.3048).toFixed(3) + ' m'`. Imperial rounds to
1/16" (1.6 mm) while metric prints to 1 mm, so the metric readout implies a
precision the model does not carry — and metric mode inherits C1's summation
problem with a finer grid.

**3.4 `formatArchitecturalInches(-0.01)` prints `-0'-0"` — NIT**
`formatters.js:15-29`. Sign is taken from the raw value, magnitude from the
rounded one, so any tiny negative prints a signed zero.

**3.5 Opening geometry is consistent between MODEL and LAYOUT — checked, sound**
`_clampOpeningToWall` (`MODEL.dc.html:12975`) and `openingGeometry`
(`layout-plan.js:137-173`) use the same `JAMB_FT = 0.01` and the same clamp, so a
door sits in the same place on the sheet as on the screen. Only the gap-fill pad
differs (zoom-derived vs a fixed 0.02 ft), which is invisible.

**3.6 Stair riser derivation — checked, sound**
`MODEL.dc.html:16779-16785`: `risers = ceil(riseIn / 7.875)`, `riserIn = riseIn /
risers`, `treads = risers - 1`, `run = treads × 10"`. Always at or under the
7 7/8" maximum, evenly divided, with the upper floor as the top tread. The
printed label (`DN — 14R @ 7 5/8"`, `:6879`) is the exact riser rounded to 1/16",
which is trade-normal. I did not audit headroom, L/U landings, or auto-placement.

---

## 3b. Areas (the number on the permit application)

**3b.1 The garage is inside the level net and the building total — MINOR, INFERRED, reaches paper**
`areas.js:53-91`. `garageSqFt` is accumulated per level and reported, but it is
never subtracted: `netSqFt = max(0, grossSqFt - openingsSqFt)`, and
`totalSqFt = Σ netSqFt` (`:105-107`). The per-level row discloses it —
`garageLabel: "incl. garage 240 sq ft"` (`MODEL.dc.html:4323`) — but the total
line carries no such note (`:4330`), and the stated convention text
(`areas.js:20-23`) talks only about floor openings. A drafter reading
"TOTAL 2,440 sq ft" off the AREAS dialog onto a permit application is reporting
the garage as floor area. Whether that is intended is Q16 in AUDIT-QUESTIONS.

**3b.2 Overlapping floor shapes double-count — NIT, INFERRED**
`areas.js:57-64` sums every floor polygon on a level with no union. Two floor
shapes that overlap (a garage slab drawn over the main floor, a re-drawn floor
left on top of the old one) count their overlap twice, in both the level net and
the building total. Nothing in the UI prevents overlapping floors.

## 4. The level model

**4.1 Level ids 3, 5 and 7 are literals in at least a dozen places — MINOR, CONFIRMED (narrower than it looks)**
Only `BASEMENT_LEVEL_ID = 1` is named (`MODEL.dc.html:1937`). The rest are bare:

```
3519  tour 'main'  : this._stairs.some(s => s.levelId === 3)
3520  tour 'second': this._stairs.some(s => s.levelId === 5)
3550  below stairs : this._stairs.filter(s => s.levelId === 3)
3587  const below = levelId === 5 ? [3, BASEMENT_LEVEL_ID] : [BASEMENT_LEVEL_ID]
3754  tour beam    : this._stairs.filter(s => s.levelId === 3)
3797  tour gate    : this._activeLevelId() === 7
12326 roof exists  : this._roofs.some(r => r.levelId === 7 && !r.garage)
12475 garage roof  : r.levelId === 7 && r.garage
12766 roof present : this._roofs.some(r => r.levelId === 7)
13867 slab check   : this._floors.some(f => f.levelId === 1 …)
16443 ROOF dims    : const roofs = levelId === 7 ? … : []
17263 tour 'second': this._activeLevelId() === 5
17322 tour 'main'  : this._activeLevelId() === 3
19630 dim hint     : this._activeLevelId() === 7
```

I drove this instead of assuming (`audit-repros/r14-level-model.spec.js`), and the
core is healthier than the greps suggest:

```
factory level ids : 8:SITE 7:ROOF 5:2ND FL 3:MAIN FL 1:FOUNDATION
after + ADD       : 8:SITE 7:ROOF 9:3RD FL 5:2ND FL 3:MAIN FL 1:FOUNDATION
bone on the new storey: "House built from the outline: 3RD FL walls, 3RD FL floor, 32 auto dims."
3RD FL at 18' with 8'-1 1/8" walls -> top of wall 26.09'
```
and the E1 elevation puts the roof correctly on top of the new stack, because
`_roofBaseElev` reads the live `stack.bearing` rather than a stored elevation.
BUILD HOUSE fills the new level; AUTO DIMS runs on it; deleting the 2ND FL and
pressing the bone correctly reports "Every level already has its shell" instead of
resurrecting it. Screenshot: `audit-repros/evidence/` is not needed — the roof
lands where it should.

What *is* hard-wired, and does silently stop working off the factory ids:

- **ROOF-level auto dimensions** (`:16443`): the truss-span string only exists for
  `levelId === 7`. Delete ROOF, add your own, and AUTO DIMS strings it as an
  ordinary plan with no bearing-line break.
- **The whole tour** (`:3519`, `:3520`, `:3797`, `:17263`, `:17322`): its steps
  test for ids 3, 5 and 7 by number. On a project whose levels were rebuilt, the
  escort silently does nothing at the steps it cannot recognise.
- **`_rederiveTourBeam`** (`:3754`) re-lands the mid-span beam around stairs on
  level 3 only — correct while it is tour-scoped, dead for a stair on any other
  floor.
- **Roof presence checks** (`:12326`, `:12475`, `:12766`) gate garage-roof
  splicing and rebuild decisions on `levelId === 7`.

None of it crashes; it all quietly stops firing, which is the expensive kind.
Renaming MAIN is safe — behaviour follows the id, not the name — and that is
worth stating somewhere a maintainer will see it.

**4.1b "the PLAN plan" — NIT**
AUTO DIMS on a user-added level reports: *"AUTO DIMS placed 4 dimensions around
the PLAN plan — re-run after edits to refresh them."* `_draftingContextLabel`
returns "PLAN" and the sentence appends "plan" (`MODEL.dc.html:16424`).

**4.2 `_addLevel` collects geometry through `window.prompt` — MINOR**
`MODEL.dc.html:8355-8373`: two blocking `prompt()` calls, then
`parseFloat(elevRaw)` — which accepts `12abc` as 12 and `1e9` as a billion-foot
elevation. `window.confirm` guards deletion (`:8398`) and `window.alert` reports
the last-level case (`:8397`). These are the only native dialogs in an app that
otherwise has a designed dialog system, and on iOS they are modal system sheets.

---

## 5. Touch and beginner UI (see C2/C4 for the input-layer defects)

**5.1 Nothing meets the 44 px minimum touch target — MINOR, CONFIRMED**
Measured live at 1024×768:

| control | size (CSS px) |
|---|---|
| SETTINGS / STANDARDS | 80 × 16 |
| IMPERIAL / METRIC | 66 × 16 |
| AREAS / INSERT | 64 × 16 |
| every drawing tool (SELECT, WALL, STAIR…) | 39 × 39 |
| OBJECT TYPE filter chips | 31 × 24 |
| bottom-strip icons (9, unlabelled) | 15 × 15 |
| MODEL / LAYOUT / PROJECT nav links | 65 × 20 |

The 15 × 15 icons are 1/9 of the recommended area and carry no visible label.

**5.2 iOS smart punctuation defeats the typed-length grammar — MINOR, CONFIRMED**
`formatters.js:78-113` accepts only ASCII `'` and `"`. iOS turns those into `’`
and `”` in text inputs by default. `audit-repros/r11-unicode.spec.js`:

```
"12'-6\""  -> {ok:true, inches:150}
"12’-6”"   -> {ok:false, error:"Use 15 for feet, or specify inches as 0-5 or 5\"."}
"12′-6″"   -> {ok:false, …}
"8’11 1/2”"-> {ok:false, …}
```
`12-6` and `12` still parse, so the user is not locked out — but the error
message tells them to type a character their keyboard will not produce. One
`.replace(/[‘’′]/g, "'").replace(/[“”″]/g, '"')`
fixes it.

**5.3 The status line truncates to 24vw — MINOR**
`MODEL.dc.html:1457`: `max-width:24vw; text-overflow:ellipsis; white-space:nowrap`.
At 1024 px that is 246 px, so the app's main teaching channel clips mid-word —
first contact saw `SHAPE — CLICK T` where the message was "SHAPE — CLICK TO DRAW
A CLOSED OUTLINE · OR PRESS CAPTURE IN THE PANEL". The messages are good; they
are the best-written text in the product; they are cut in half on the target
device.

**5.4 Dialog buttons are labelled with keys that do not exist on a tablet — NIT**
`GOT IT (ENTER)`, `KEEP GOING — DEFAULTS (ENTER)`, `PROJECT (ESC)`. Only
`CLIMB — ENTER / SPACE / TAP` admits a tap.

**5.5 The tool palette pushes the canvas instead of overlaying it — MINOR**
At 1024 px the open palette is 355 px, 35% of the width, and the level rail takes
more on the right. Both open leaves roughly a third of the screen for the drawing.
Because it pushes, the model↔screen mapping changes when a panel opens, so the
same fingertip position is a different point in the house before and after — see
the first-contact log §00:35 for what that looks like to a beginner.

**5.6 Generated views are painted underneath the floating level cards — MINOR, CONFIRMED**
The elevation and section workspaces size themselves to the full canvas
(`_drawCutWorkspace2D(ctx, w, h, cut)` with `w = this._canvas.clientWidth`,
`MODEL.dc.html:5723`), but the level-card column and the view rails are absolute
elements floating over that canvas. So the right-hand edge of every generated
elevation and section is drawn *behind* the cards. Visible in
`audit-repros/evidence/section-attached.png` (the main-floor band runs on under
the MAIN FL card) and in an attached-garage E1, where the garage roof disappears
behind the card column. At 1024 px — the stated device — the covered strip is
about 12% of the drawing width. The generated view should be laid out in the free
area, not under the furniture.

**5.7 No favicon on the app pages — NIT**
Every MODEL/LAYOUT load takes a 404 on `/favicon.ico`; only `index.html`
declares one.

---

## 5b. The tour

**5b.1 Abandonment is handled well — checked, sound**
`audit-repros/r18-tour-abandon.spec.js` drives every exit I could find. The step
is serialized with the drawing (`tour: {...this.state.tour}`,
`MODEL.dc.html:2557`), so it survives a reload, an Escape, a level switch, and a
round trip through LAYOUT — and the popup comes back each time:

```
tour after the outline closes : {"step":"foundation"}
after a reload                : {"step":"foundation"}   popup visible: true
after Escape                  : {"step":"foundation"}   popup visible: true
after switching to ROOF       : {"step":"foundation"}   popup visible: true
after a round trip to LAYOUT  : {"step":"foundation"}   popup visible: true
```
A bone press from any of those states clears the tour and builds. No stuck
states, no half-tours.

**5b.2 Overriding the tour builds a two-storey house with no stair, and says nothing — MINOR, CONFIRMED**
A mid-tour bone press is a deliberate override (`MODEL.dc.html:12582-12588`), and
it skips the tour's stair step. What the drafter gets:

```
after the bone: tour {"step":null} | walls 12 | stairs 0 | roofs 1
message: "House built from the outline: MAIN FL walls, MAIN FL floor,
          2ND FL walls, 2ND FL floor, FOUNDATION walls, slab"
```

Two storeys, no stair, no floor opening — and the message enumerates everything
it built without mentioning the one thing it skipped. Pressing the bone again
does not help: "Every level already has its shell." The house is now missing its
means of egress and the only way to add it is by hand. Note that the *default*
configuration would have caught this — stair suggestions park the first press —
but only outside the tour; inside it, the override wins silently. One clause in
the message ("— no stair; place one with the STAIR tool") would close it.

## 6. Error containment

**6.1 No error boundary anywhere, but the loop survives — MINOR, CONFIRMED**
`audit-repros/r8-error-containment.spec.js` throws from inside the 2D paint
(`CanvasRenderingContext2D.prototype.fillText`) on a built house:

```
paint attempts after the break: 1
overlay pixels drawn while broken: 287,046   (the stale frame stays up)
save queue: saved | lines now: 9 | walls still 12
status bar says: ""
```

The rAF chain survives because `_animate` schedules the next frame *before* doing
any work (`MODEL.dc.html:5500`) — accidental or not, it is the right shape. The
save queue survives; no data is lost. What the drafter gets is a canvas frozen
part-way through a repaint with **no message of any kind**, and a `ctx` whose
`save()`/`restore()` pairing was interrupted. React is vendored but no component
declares `componentDidCatch`, so a throw in `render` would blank the app instead.

---

## 7. Test suite

**7.1 Every failure in this environment is a timeout with one root cause — no product defect**
The full suite finished: **550 passed, 14 failed, 2.8 hours** (chromium, one
worker, no egress to fonts.googleapis.com). Every one of the 14 took 30.1-32.9 s
— the default per-test timeout — and every one is in a spec that navigates two or
three times:

```
auto-elevations.spec.js:171   turning the standard off in COMPANY STANDARDS removes the marks
auto-elevations.spec.js:206   GABLE CORNER treatments add their metal linework to the E4 corners
auto-footings.spec.js:125     S-FOOTING lines are locked until the standards allow freeform editing
auto-stair.spec.js:156        an ENTRY stamp near the front wall wins the entry L
bone-wallet.spec.js:139       the digit ladder keeps 3- and 5-digit balances inside the bone
cut-bubbles.spec.js:38        marks render in both office styles
layout-titleblock.spec.js:156 the NORTH ARROW toggle inks the arrow cell
layout-titleblock.spec.js:178 picking BLUEJETTY persists on the drawing
layout-titleblock.spec.js:199 project and drafter words flow into the strip
layout-viewports.spec.js:224  paper size and orientation persist onto the drawing
perf-notice.spec.js:48        don't show this again survives a reload
project-info.spec.js:86       NEW clears the project information with the drawing
roof.spec.js:252              PORK CHOP builds gable edges at half the eave overhang
room-standards.spec.js:86     an under-min bedroom wears the quiet flag
```

`tests/auto-footings.spec.js:125` re-run alone with the timeout raised to 120 s
**passes in 40.3 s**. It does three page loads (MODEL → STANDARDS → MODEL); at
~12.5 s of Google-Fonts stall per navigation (AUDIT-PERF §1) it cannot fit in
30 s. Confirmed from the other end too: launching Chromium with
`--no-proxy-server`, so the font request fails immediately instead of hanging on
this sandbox's proxy, takes a room-grow spec from 21.6 s to 9.1 s.

The finding is the fragility, not the failures: `playwright.config.js` sets no
`timeout`, so the suite runs with 40-75% of every test's budget consumed by a
third-party font request that is not part of the test. Any CI without egress to
fonts.googleapis.com reports fourteen product failures that are not product
failures — and a reviewer's first instinct on seeing red is to distrust the
change, not the network.

**7.2 The suite runs a configuration no user will ever have — MINOR, by construction (and I could not break it)**
`tests/helpers.js:11-52` seeds, for every spec that does not opt out:
`boneWallet: 999`, `boneReveal: false`, `suggestStairs: false`. So the shipped
defaults — a 3-bone wallet, the bone jumping to the E1 elevation after a build,
and the first bone press *parking* to suggest stairs instead of building — are
exercised only by `bone-reveal.spec.js` and `auto-stair.spec.js`, each in
isolation. Any interaction *between* those defaults and a third feature is
invisible to the suite by construction. Concretely: no spec anywhere presses the
bone with stair suggestions ON and then does anything else; the first press
parks, and every legacy spec would have broken, which is exactly why the seed
exists. That is a reasonable engineering choice with an unreasonable consequence
— the default flow has one test each and no combinations. My own first-contact
run hit both defaults inside five minutes.

**7.2b Wrong tests: I did not find one — but one spec's title defends behaviour the code does not have**
I went looking specifically, because the work order scores a wrong test above a
bug. Every assertion I read is accurate about what the code does. The closest
case is `tests/auto-dims.spec.js:209`, titled *"an inch-scale jog strings
straight: merged into the neighbouring corner"*. The code does not merge into a
neighbouring corner; it replaces an interior cluster with its arithmetic mean
(M7, now measured: two walls at 12'-0" and 12'-1 1/2" print as 12'-0 3/4").
The spec passes because its assertions only check the overall length and the
string's stand-off — never the merged coordinate. So it is not a wrong test, but
it reads like coverage of exactly the case that is broken, and it would stop a
reviewer from looking. Renaming it, or asserting the merged coordinate, would
have surfaced M7 years earlier.

**7.3 High-risk modules with no focused spec**
`shared-file-store.js` (the only thing standing between the user and their work):
no spec. `layout-plan.js` scale math against paper inches: no spec (the layout
specs assert viewport placement and titleblock text, not measured scale).
`titleblock.js` content: covered indirectly by `layout-titleblock.spec.js`.
`_loadDrawing`'s failure paths (`version` / `invalid` / partial-skip messages):
`import-safety.spec.js` covers import; I did not find coverage for the stored-copy
variants. Also uncovered, and each one is a confirmed defect: a section cutting
through **two bodies** (C5 — the garage specs all cut through the garage alone),
a **non-orthogonal section** through a roof (C6 — the one angled-cut spec is an
elevation), the **printed text** of any dimension (C1 — every dim spec asserts
segment geometry, never the label), and any AREAS case **with a garage** (§3b.1).

**7.4 Flake sources — light**
Fixed `waitForTimeout(300)` settles appear in several specs
(`auto-dims.spec.js:25`, `boneyard-tools.spec.js:10`, `room-tags.spec.js` …),
but the important waits are condition-based (`data-model-ready`,
`data-save-dirty`, `data-layout-ready`) and the beacons are set imperatively for
exactly that reason. That is better discipline than most suites this size. I saw
no order dependence, but I did not run the suite in a shuffled order, which is
the only way to know.

---

## 8. Security and robustness

**8.1 A local-first app makes a third-party request on every page load — MINOR**
`https://fonts.googleapis.com` in the head of all six pages. Availability cost is
in AUDIT-PERF §1; the other cost is that every drafter's IP and page load is
visible to Google, in a proprietary product whose pitch is that nothing leaves
the machine.

**8.2 `innerHTML` sinks — checked, no user-string path found**
The DC engine's own uses (`support.js:470`, `:480`, `:776`) operate on template
source, not data. Data interpolation — every `{{ }}` in the templates — is
compiled by `walkText` (`support.js:569-584`) into React children
(`h(Fragment, …, resolve(vals, p))`), and React escapes text children, so project
names, note bodies and level names cannot inject markup through a template.
The hand-written pages build markup with template literals
(`SETTINGS.html:202`, `:342`, `STANDARDS.html:256`, `PROJECT.html:537`, `:570`),
but everything interpolated there is static config — command labels, key labels,
layout names, zone labels. The one user-typed value on the SETTINGS page, the
package name, is never interpolated into markup (`packageName` reaches only
`manager.createPackage`), and the drafter fields are written with `input.value`.
I did not read all 1,911 lines of `support.js`, so this is "no path found in what
I read", not a proof.

**8.3 Nothing secret in the repo**
`LICENSE` is proprietary; no keys, tokens, or personal data in the tracked files.
Drawing files carry `projectInfo` (name, client, address) and the drafter's name
and phone from the settings package (`LAYOUT.dc.html:614-624`) — that is intended
titleblock content, but worth knowing that a shared `.draft` file carries the
drafter's phone number.

**8.4 `pdf-scan.js`: the PDF rasterizer caps width only — MINOR, INFERRED**
`pdf-scan.js:60-71`:

```js
const scale = Math.min(2.6, 2200 / viewport1.width);
const viewport = page.getViewport({ scale });
canvas.width  = Math.round(viewport.width);
canvas.height = Math.round(viewport.height);
```

The cap is on the *width*. The photo path two functions down gets it right —
`shrink = Math.min(1, cap / Math.max(bitmap.width, bitmap.height))`
(`:81`) — so the asymmetry looks accidental. A tall page (a scanned strip, a
rolled site plan, a hostile PDF) blows past every canvas budget: a 200 × 20000 pt
page takes `scale = min(2.6, 11) = 2.6` and asks for a 520 × 52,000 canvas =
**27 Mpx**, above iOS Safari's ~16.7 Mpx area limit. Safari then hands back an
unusable canvas rather than throwing, and unlike the photo path
(`if (!blob) throw`, `:88`) the PDF path assigns `scan.convertedBlob = blob`
(`:69`) with no null check — so a silently blank underlay is stored as the
converted output. Fix: cap on `Math.max(width, height)` like the photo path, and
null-check the blob.

Also unaudited in that file: `getOperatorList()` is parsed in the worker but its
`fnArray` is iterated on the main thread (`:35-47`), so a PDF with millions of
operators freezes the UI for the length of that loop. And `detectScalesInText`
(`:97`) already accepts typographic primes (`\u2019`, `\u201d`) — which is worth
noting next to §5.2, where the length parser does not.

---

## Things I checked and found sound (one line each, no further words)

- **BUILD HOUSE is genuinely idempotent.** Two presses, no edits between:
  byte-identical saved drawings, 21,685 bytes both times
  (`audit-repros/r2-idempotence.spec.js`).
- **AUTO DIMS and ROOM TAGS are geometrically idempotent** — identical segment
  and tag geometry on a second run; only the id counters advance
  (`nextDimensionId` 33 → 37), which is id churn, not growth.
- **The undo history is bounded** by count and by bytes, and holds under key
  repeat (§1.7).
- **No memory growth** over 120 back-to-back edits (AUDIT-PERF §5).
- **`bone-wallet.js` handles clock skew correctly** — a future `lastDripAt`
  clamps to now (`:38`, `:50`), the cap parks the clock, and `spend()` re-reads
  storage so two tabs cannot both spend the last bone.
- **Wall reference-line handling is consistent** across MODEL's in-memory
  default, `drawing-format`'s load default, and LAYOUT's — all resolve to `left`.
- **`_animate` reschedules before it works**, so a paint exception cannot kill
  the render loop.
- **MODEL survives a failing store.** With every IndexedDB write rejecting, the
  status pill goes UNSAVED, the dirty beacon stays set, editing continues, and
  the first successful write afterwards persists everything that accumulated
  (`audit-repros/r19-save-failure.spec.js`). No work is lost and the user is
  told. This is the right shape; §1.2 is the page that did not get it.
- **`build-house.js`'s mid-span beam rule is careful.** The trigger reads the
  bounding-box short span, which would over-trigger on an L, but `trimRun` /
  `localSpanAt` (`build-house.js:102-121`) then keep the beam only over the
  stretches whose *local* joist span actually exceeds the trigger. I went looking
  for a false positive and the code had already handled it.
- **Referential integrity on entity deletes is right** — deleting a wall takes its
  fenestration with it (0 left, 0 orphaned), and deleting a BONEYARD master under
  built geometry is refused with "This outline carries built geometry — walls,
  slab, or roof are anchored to it. Delete the built pieces first."
  (`audit-repros/r16-referential.spec.js`). That makes M5 the exception rather
  than the rule: the *entity* delete paths cascade; the *level* delete path
  forgot five collections.
- **The shipped default configuration builds cleanly.** Driven with
  `boneReveal: true`, `autoStairs: true` and the real 3-bone wallet — the
  combination no spec runs — the first bone press builds walls, a stair and a
  roof, spends one bone, and reveals E1; the three presses after it are free
  no-ops with the correct message and no page errors
  (`audit-repros/r15-real-defaults.spec.js`). I did not find an interaction bug
  between the new defaults, which is the answer to checklist 14 even though it is
  not the answer I expected.

---

## What I did not examine

Same list as `AUDIT-CRITICAL.md`, plus: `areas.js`, `room-standards.js`,
`fen-labels.js`, `build-house.js` beyond `houseWallRuns`, `tour.js` (read only the
reveal helper), the group/assembly system, background references, the polar
ruler / T-square / protractor tools, copy and extend flows, and every one of the
~95 spec files except the eight I read to learn the idioms.
