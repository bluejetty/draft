# SPEC — MODEL.html, tier by tier

The framework-free rebuild of the Model Space. Tier 1 is merged and live;
this note says what the tiers are, because until 3 Sep they existed only in
one agent's head and nobody else could see the plan.

`index.html` still points at `MODEL.dc.html`. Nothing here changes that. The
swap, when it comes, is two hrefs.

---

## Tier 1 — read the real drawing, paint it with the real painters *(done)*

`MODEL.html` opens the drawing `MODEL.dc.html` saved, from the same origin's
IndexedDB, and paints its walls through `render-2d.js`. React and the DC
runtime are absent and a spec asserts they stay absent.

Five scripts, and the list is the finding rather than a formality:

    palette.js · shared-file-store.js · wall-types.js
    drawing-format.js · render-2d.js

It **reads and never writes**. There is no save path, so a tier-1 bug cannot
cost anyone a drawing.

---

## Tier 2 — the level filter first, then the rest of the plan

*Tiers 2a and 2b are merged (PR #252). What follows records what they did and
where the tier stopped, which is a seam worth understanding rather than a
to-do list.*

### The filter is NOT `levelId === active`

Measured from `MODEL.dc.html:6505-6513`, which is the closest thing the old
page has to what this needs. There are **five rules, not one**:

```js
const planOnly = this._layerViewsForLevel(levelId).length > 0;
const onPlan   = item => !planOnly || (item.view || 'plan') === viewId;

walls    → levelId === active && onPlan(x)
lines    → levelId === active && onPlan(x) && lineLayerConfig(x.layer).visible
floors   → levelId === active && onPlan(x)
roofs    → levelId === active                    // NO view filter
outlines → levelId === active                    // NO view filter
```

Three things here would each have cost an iteration to discover by building:

- **Roofs and outlines do not filter by view at all.** Only walls, lines and
  floors do.
- **`planOnly` is conditional.** A level with no layer views — ROOF, SITE —
  shows everything it holds. The view filter switches itself off there.
- **Floors default to `view: 'floor'`, not `'plan'`** (`MODEL.dc.html:2905`,
  `view: floor.view || 'floor'`). A filter written as `view === 'plan'` hides
  every floor in the drawing and looks like a painter bug.

### Levels, and an index/id collision to not fall into

```
id 8  SITE         elev   0
id 7  ROOF         elev  18
id 5  2ND FL       elev   9
id 3  MAIN FL      elev   0
id 1  FOUNDATION   elev -10
```

`state.activeLevelIdx: 3` is an **index into that array**; `MAIN_FLOOR_LEVEL_ID
= 3` is an **id**. For the default list they coincide, and they stop coinciding
the moment a level is inserted. MODEL.html should carry the **id**, never the
index, and default to `MAIN_FLOOR_LEVEL_ID`.

The saved drawing carries its own `levels` (`drawing-format.js` exports it), so
read that rather than assuming `DEFAULT_LEVELS`.

### Order of work

1. **Level filter** — *done, 2a.* Accessors take the active level id; MAIN FL
   by default, `?level=` to switch.
2. **Roofs and shapes** — *done, 2b.* No extraction needed; both painters were
   already in `render-2d.js`.
3. **Floors, properly.** Tier 1 hand-rolls a polygon wash; the real painter is
   `_drawFloor2D`, still inside `MODEL.dc.html`.
4. **Mitred wall joins.** `drawWallSeg2D` takes `joins`, and tier 2 passes
   `null` (capped ends). Real mitring needs MODEL's `_wallJoins()`.
5. **Outlines, dimensions, fixtures.** Dimensions *done*. Outlines *done, 2h*
   — the block was three `this._` methods, not the painter: `_outlineSegment`,
   `_outlineSegmentCount` and `_lineControlPoint`, nineteen lines between them
   and pure. They are `outlineSegment` / `outlineSegmentCount` /
   `lineControlPoint` in `geometry-2d.js` now, with checks
   (`proto/outline-accessors-harness.js`) they had never had, and MODEL.html
   paints outlines through the real painter. **Fixtures remain**, and are
   cheaper than the paragraph below said — see the correction there.

---

## THE TEST OF A FINISHED EXTRACTION

Steps 3-5 are blocked, and measuring *why* produced the most useful thing
either agent found on this job. It is recorded here because it applies to
board #1 far more than it applies to this page.

**Moving a painter into `render-2d.js` does not make it shared. Its `env` has
to be reachable too.** Who can actually call each export today:

```
drawWallSeg2D    layout-plan.js   MODEL.dc.html   MODEL.html
drawRoof2D                        MODEL.dc.html   MODEL.html
drawShape2D                       MODEL.dc.html   MODEL.html
drawFixture2D                     MODEL.dc.html                 ← one caller
```

Three are callable anywhere because their env comes from modules — `wallTypes`
from `wall-types.js`, `roofSkeleton` / `offsetOutline` from `geometry-2d.js`,
`flooringTypes` from `drawing-format.js`.

`drawFixture2D` is callable by nobody else, and not because of the function.
Its env keys resolve on `MODEL.dc.html` — but **not all eleven live there, and
the original claim on this line that they did was wrong.** Measured 4 Sep:

```
CLOSET_WALL_FT      = window.DraftClosets.WALL_FT          already shared
CLOSET_ROD_FT       = window.DraftClosets.RAIL_FT           already shared
CLOSET_SHELF_FT     = window.DraftClosets.SHELF_FT          already shared
CLOSET_CLOTHES_FT   = window.DraftClosets.CLOTHES_FT        already shared
closetDoorFor       = window.DraftClosets.doorFor(…)        already shared
COUNTER_OVERHANG_FT = 1 / 12                                MODEL literal
FIXTURE_COLOR       = '#1d1f20'                             MODEL literal
fixtureGeometry     → this._fixtureGeometry                 MODEL method
wallCross           → this._wallCross                       MODEL method
wallFrame           → this._wallFrame                       MODEL method
walls               → this._walls.map(…)                    state; MODEL.html has it
```

Five of the eleven are one-line aliases over `window.DraftClosets`, which
`closets.js` froze and exported before this page existed —
`MODEL.dc.html:2294` says so in its own comment. The genuine MODEL-only set is
**three methods and two literals**, and the missing piece for another page is a
`<script src="./closets.js">` tag.

That correction is the point rather than the arithmetic: the sentence was
accurate when written and was falsified by a later change to `closets.js` that
never touched this file. A number in prose has no test, so nothing failed when
it stopped being true — and for months it was the number that made this job
look too big to start.

So the criterion is not *"the function moved"* — it is **"someone else can call
it."** `drawFixture2D` has passed the first test since before this session
started and still fails the second. It moved house without changing address.

**This is a scope question board #1 has to answer, not a defect** — but it is a
smaller question than it was. Making the fixture painter genuinely shared means
moving two literals and deciding whether three single-caller methods are worth
extracting at all; "extracting code for a hypothetical second caller" is its own
way for a shared module to rot, and the honest trigger is the tier that needs
them, measured against the old painter. It should be
decided out loud rather than drifted into. The honest interim is what is being
done: extract with real envs, and record which keys are MODEL-only so the gap
is visible rather than assumed closed.

---

## HOW MANY PAINTERS THERE ARE

**31, not 28.** The 28 came from `grep -o "_draw[A-Za-z]*2D"` and was handed
around as a measurement. It is a fact about the pattern.

Counting by behaviour instead — any method whose first argument is `ctx` —
finds three more:

```
_drawStairPlanPane        no 2D suffix
_drawStairSectionPane     no 2D suffix
_stairPaneHeader          does not even start with _draw
```

All three are in the stair-workspace cluster, so the miss was not harmless:
it hid a dependency between painters that were being moved as a group.

**Inventory by behaviour, not by name.** `first argument is ctx` cannot be
defeated by someone naming a function `Pane`.

**A level switcher is chrome, and chrome is tier 3.** Tier 2 picks a level and
paints it correctly; it does not grow a UI to change it.

---

## Tier 3 — the dashboard

Chrome, interaction, and the skins from `SPEC-skins.md`. Not specced here
beyond that, because tier 2 will change what it should say.

## Tier 2c — floors through the real painter (3 Sep)

`paintFloors` now calls `drawFloor2D` instead of filling the outline by hand.
Cost: two more scripts, `formatters.js` and `cut-view.js`, because the painter
reads `env.formatInchesOnly` and the two garage-slab standards and those are
the modules that own them. Nine scripts now, and **the order is asserted**:
`cut-view.js:28-29` destructures `window.DraftWallTypes` and
`window.DraftFormatters` at module scope, so it throws while loading if either
follows it, and a head that throws paints nothing at all.

### The five filter rules were four rules and a wrong one

Tier 2a wrote the view filter as `(item.view || 'plan') === viewId` for every
item type. Measured against MODEL.dc.html, **floors default to `'floor'`**
(2905, 9029, 9089, 9098, 9162, 17025); every other type — wall, line, stair,
opening, fixture, device, seg — defaults to `'plan'`. A floor outline's home
layer set is FLOOR, or FOUNDATION where it is a concrete slab. It was never a
plan-set item.

Why no test caught it: the old page always writes an explicit `view` on a
floor, so **no fixture can produce the failing case**. It shows only on an
older saved drawing whose floors predate the field — precisely the drawings
that have to keep opening. `tests/model-html-floors.spec.js` builds that
drawing by rewriting the stored JSON, because waiting for one to turn up is
not a test.

The tier-2a spec asserted the rule longhand, deliberately not calling
`layer-views.js`, so that a wrong answer could not agree with itself. It
still passed: the rule and the implementation shared one misunderstanding.
**Longhand protects against a module lying to you, not against being wrong
about the module.** The thing that caught this was reading MODEL.dc.html's
`_activeFloors` directly.

### What `floors 0/3` on the default view means

Correct, and chased as a bug before that was established. MAIN FL's slab lives
on the FLOOR layer set, so the FLOOR PLAN (WALLS) set shows none of it — the
same answer `_activeFloors` gives.

What made it look wrong was that the `plan` layer set's `contents` lists
`A-FL`. **That reasoning is invalid, and the first version of this document got
it wrong twice over.** `contents` is not a filter: drawing membership is
`item.view` alone, and `contents` names layers for the layer panel. And nothing
is assigned to `A-FL` anyway — the string has zero references in MODEL.dc.html,
as does `A-WALL-EXT`; `layersFor()` is exported by `layer-views.js` and called
by nothing. The correct statement is that the contents list has no bearing on
what any painter draws. See DEFINITIONS.md, LAYER / LAYER SET / LEVEL.

The conclusion held only because it came from reading `_activeFloors` directly.
The explanation attached to it was reconstructed afterwards and was wrong — a
right answer with an invented reason behind it, which is worse than it looks,
because the reason is what the next person reuses.

`_courtesyFloorIds` — MODEL.dc.html's rule for showing a floor outside its
home view — is deliberately **not** implemented here. A courtesy floor is one
drawn from another layer set during a session; the Set is runtime-only and
never reaches the saved JSON, so a page that reads saved drawings has none to
honour. Verified against the serialiser rather than assumed.

### drawFloor2D's first coverage, and what is still uncovered

Before this file, `drawFloor2D` had none: the existing floor specs assert the
saved model — a slab exists, it has a thickness — and never that anything is
painted from it. Three of the six painters extracted on 3 Sep were in that
state.

The assertion measures `draw-floor-edge` ink on the canvas: the slab
**outline**, which only the real painter draws. The tier-2a wash filled and
never stroked, so the test fails both if the painter stops painting and if
someone quietly puts the wash back. Measured 0.002345 of the canvas with the
painter, 0.000000 with it no-op'd — presence against absence, not a tuned
constant.

Still unreachable from the default fixture, and recorded rather than implied:
the garage branch (pour note, dashed thickened-edge ring), floor openings cut
even-odd as holes, `preview`, and `selected`. All four env keys those need are
supplied anyway — an interface satisfied for the fixture is not an interface
satisfied, which is the tier-2b lesson — but nothing exercises them here.

## Tier 2d — the grid, and what a datum is (3 Sep)

`paintGrid` now calls `drawGrid2D`. Tier 1's version drew a grid ALWAYS,
aligned to world 0,0. That was a divergence from the product, and it took
three separate measurements to establish rather than to assume.

### The datum is the drafter's zero

MODEL.dc.html sets `state.drawingOrigin` from the drafter's **first click**
(MODEL.dc.html:10360). Movie, 3 Sep: *"that way he always first clicks on
0,0."* The grid is anchored there, and with no datum `drawGrid2D` returns
before drawing anything.

That is deliberate and already had a test — on the old page:
`registration-grid.spec.js`, *"an untouched model space draws no grid, and the
first node sets the datum"*.

**The generated house has no datum.** It is never clicked into place, so it
saves `drawingOrigin: null` and correctly gets no grid. Verified by pixels
before it was believed: the old page's plan canvas measures 29.68% ink and
0.00% grid grey, and the same detector finds grid grey on the sheet
thumbnails, which use `_drawPlanThumb2D`. So the zero is a real absence, not a
broken colour match.

### ABSENT and NULL again

The third time this shape has appeared, after the floors `view` fallback.
MODEL.dc.html:5160:

```js
drawingOrigin: 'drawingOrigin' in saved
  ? normaliseDrawingOrigin(saved.drawingOrigin)
  : { x: 0, z: 0 }
```

Absent = a drawing made before the datum existed. It was drawn on the world
grid, so `0,0` leaves every coordinate where it is. Explicit `null` = "no
origin yet", which is where NEW starts. `drawing.drawingOrigin || null`
collapses them and strips the grid from every pre-datum drawing — and no
fixture can catch it, because the old page always writes the key now. The spec
builds that drawing by deleting the key.

### The readout says which

`datum 4.00,-7.00` · `datum 0.00,0.00 (world, back-filled)` · `datum none — no
grid`. An absent grid should read as a fact about the drawing rather than a
broken page. Movie, 3 Sep: *"i like all that info down in the left corner keep
adding to it and don't delete."*

### Three grid weights, so three palette roles

`drawGrid2D` draws 1ft fine, 10ft major and 100ft coarse; the palette had two.
`draw-grid-coarse` makes sixteen roles. The harness asserts the three **read**
as three, in order — checking each against the ground separately would pass
with all three identical. Measured 1.13 < 1.40 < 1.84 night, 1.17 < 1.42 <
1.88 day.

### The assertion took three attempts, and the failures are the lesson

The skins spec asserted *"the grid should be visible but quiet"* — `faint >
50,000`. With the grid correctly gone it measures 28. **That assertion was
pinning a divergence I had introduced**, which is what a test written against
your own output does when the output is wrong.

Two replacements failed before one worked:

1. **`faint` as a ratio.** Rejected: it differs EIGHT-FOLD between skins —
   0.00143 night against 0.01109 day — because dark ink anti-aliasing onto a
   light ground leaves far more intermediate pixels than the reverse. No
   threshold has a wide answer between those. The attempt picked 0.01, which
   sits between them.
2. **Counting grid-grey pixels.** Rejected: night ink anti-aliasing onto the
   night ground passes THROUGH the grid greys, so the no-grid render scored
   1 px in one house and 306 in another. A colour count cannot tell a
   manufactured grey from a painted one.

What landed is a **ratio against the same scene**: measure the page, add a
datum, measure again — 6,418 against 1–306, so 21x at worst and 6,000x at
best. Same walls, same fit, same anti-aliasing on both sides of the
comparison, so the noise cancels instead of having to be thresholded.

> The general form, now three times over in this file: **when an absolute
> measurement has no wide answer, measure the same thing twice and compare.**
> A control is cheaper than a constant, and it does not rot.

### Where the extraction actually stands

Measured 3 Sep by brace-matching every painter-shaped method in
MODEL.dc.html and checking whether its body delegates:

| | count | |
|---|---|---|
| delegated to `render-2d.js` | 14 | wrappers of 4–33 lines |
| still carrying their own body | **17** | **1,080 lines** |

The moved half is the leaves. What remains holds `_drawCuts2D` (246 lines),
`_drawStairSectionPane` (163), `_drawStructure2D` (135),
`_drawStairPlanPane` (119) and `_drawTourRoof2D` (98).
