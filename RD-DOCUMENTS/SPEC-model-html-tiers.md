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

## THE SECOND TEST: WHO DERIVES IT, AND WHO STORES IT

Added 6 Sep, from tier 2m, and aimed at the Write Tier rather than at this
page — it is the hazard that the reachability test above cannot see.

**For every field two boards both touch, ask which one DERIVES it and which
one STORES it.** A field can be present, correct, shared, and reachable, and
still make the two pages disagree.

Stairs is the worked example. A stair record carries `riseFt`. It looks like
the truth and it is not: `_stairCurrentLayout` re-derives the rise from the
level heights on every paint, and falls back to the stored number only *"if
its level goes away"*. Nothing ever writes the derived value back — all four
writes to `riseFt` happen at stair creation. So the stored number is correct
exactly until someone edits a wall height, and then it is silently stale
forever.

The old page never notices, because it never reads the stored value while a
level exists. A second page that trusted it would have drawn a different
riser count for the same drawing, and **no test on either page alone could
catch that** — the divergence does not exist inside one page. It exists in
the file they exchange.

That is why `level-assembly.js` came out with the stairs rather than after
them: reading `stair.riseFt` was the cheap path and it was WRONG, not merely
worse.

**The write side is the same hazard mirrored** — a value the old page derives
and the new page stores, or a value the new page writes that the old page
expects to re-derive. Both directions pass every single-page test. This is
the reader-side twin of the round-trip rule.

**The standing check:** name the deriver, name the storer, and make the two
boards exchange a file in a test. If a field has two derivers, that is a
merge conflict waiting in the data. If it has two storers, one of them is
stale and nobody will find out until a drafter does.

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

---

## Tier 2i — what is actually left, measured (5 Sep)

MODEL.html calls **8 of the 16** painters in `render-2d.js`. The other eight
were an undifferentiated list; they are not an undifferentiated list.

### The criterion

**Does the painter draw saved drawing content, or something that only exists
while a tool is mid-gesture?** Saved content is the plan, and tier 2 is the
plan. Gesture state is interaction, and interaction is tier 3.

| painter | tier | why |
| --- | --- | --- |
| `drawStairs2D` | **2** | `stairs` is persisted |
| `drawCutMarks2D` | **2** | `cuts` is persisted; section marks print |
| `drawNoteScreen2D` | **2** | `notes` is persisted |
| `drawUnderlays2D` | **2** | `underlays` is persisted — it is what you trace |
| `drawFixture2D` | **2** | `fixtures` is persisted |
| `drawStairNotes2D` | 3 | serves `_drawStairWorkspace2D` only — a separate pane |
| `drawBoneyardMark2D` | 3 | gated on `boneyardActive` — a separate workspace |
| `drawCutPreview2D` | 3 | `cutStart` / `phase` / `hoverSide` — pure gesture state |

Five to go, not eight.

### Cost, from the call sites — NOT from the function bodies

The first pass extracted each painter's env by taking a line range between one
declaration and the next and grepping it for `env.`. It gave `drawUnderlays2D`
sixteen keys including grid spacing and camera position. The range had run past
the end of the function into the next one. **The call site is the truth**; the
function body's line range is arithmetic, and arithmetic run past a closing
brace is how `_wallCross` was reported impure earlier the same day.

```
drawUnderlays2D    MODEL.dc.html:3619   4 keys
drawStairs2D       MODEL.dc.html:7663   9 keys
drawNoteScreen2D   MODEL.dc.html:8130   2 keys   (two colours)
drawCutMarks2D     MODEL.dc.html:8173   4 keys
```

### The six env suppliers, transitively

Brace-matched whole bodies, then the closure of every `this.` reference:

```
_wallFrame            0 methods    PURE
_wallCross            0 methods    PURE
_stairPlanParts       2 methods    PURE
_fixtureGeometry      3 methods    _walls
_cutLineSpan          2 methods    _walls, state.autoDimFirstOffsetFt
_stairCurrentLayout   6 methods    _walls, state.{levels, levelAssemblies}
_autoElevationCuts    4 methods    _walls, _dimensions,
                                   state.{elevationMarkOffsets, structureStandards}
```

`_walls` and `_dimensions` are not obstacles — MODEL.html holds both already
and the shipped painters take them as env. The state keys are the question, and
`tests/persisted-format.spec.js:41` answers it authoritatively — better than
grepping `drawing-format.js`, which lists none of them and made them look
transient:

- `levels`, `levelAssemblies`, `elevationMarkOffsets` — **persisted per drawing**
- `structureStandards` — a **Company Standard**, normalised in
  `profile-manager.js:366`, edited by STANDARDS.html. Already shared.
- `autoDimFirstOffsetFt` — **not persisted**: a UI preference, default `1.5`,
  set from a menu at `MODEL.dc.html:21688`. MODEL.html takes the default and is
  correct for any drawing whose author never opened that menu.

**Nothing in the closure reads interaction state.** The blocker THE TEST OF A
FINISHED EXTRACTION worried about — "its env has to be reachable too" — is
real, and smaller than it has looked since that section was written.

### A seam worth naming

`levelAssemblies` and `elevationMarkOffsets` are persisted, but MODEL.dc.html
serialises and restores them itself (`:3191`, `:5240`) rather than through
`drawing-format.js`. A second page reading them reads raw saved JSON with no
normaliser in front of it. That is not tier 2's job to fix, but it is the
reason those two keys are absent from the format module and looked like session
state on the first check.

### Order, cheapest first

1. `drawNoteScreen2D` — two colours. The work is the filter, which the level
   filter already does.
2. `drawFixture2D` — two pure methods, one `_walls` method, two literals, and a
   `closets.js` script tag. Task #12.
3. `drawCutMarks2D` — one `_walls` method, one preference with a default.
4. `drawStairs2D` — `_stairPlanParts` is pure; `_stairCurrentLayout` needs
   levels and assemblies, both of which MODEL.html reads already.
5. `drawUnderlays2D` — four keys, but `imageFor` reads a decoded-bitmap cache
   and MODEL.html has no loader. Four keys is not four keys of work. Measure
   the loader before committing to it.

---

## Tier 2j — the five painters share one blocker, and it is colour (5 Sep)

Tier 2i costed the five remaining painters from their call sites and found the
env reachable in every case. That was true and it was not the whole story.

**None of the five is skin-aware, and four of them fail the night page.**
Measured against `palette.js`'s two skins:

```
painter     how the colour is reached          hex        night    day
notes       env, NOTE_COLOR                    #1d1f20      1.00  14.79   under 3.0
fixtures    env, FIXTURE_COLOR                 #1d1f20      1.00  14.79   under 3.0
            AND A SECOND COLOUR THIS ROW MISSED -- see Tier 2k
stairs      env, STAIR_COLOR                   #5d4a8a      2.22   6.68   under 3.0
cut marks   BARE LITERAL in the painter        #b04060      2.95   5.01   under 3.0
underlays   env.colors.origin, literal fallback #557a46     3.36   4.41
```

**The underlays row said "hardcoded IN the painter" until it was checked
properly, and that was wrong.** `render-2d.js:728` reads
`(env.colors && env.colors.origin) || '#557a46'` — env-driven already, the
literal only a fallback, under a comment that explains the whole design:
*"MODEL.dc.html has no skins and its ground is always light, so this value IS
correct for that page… a caller that supplies colours gets its own; the one
that does not keeps exactly what it painted before."* Somebody had already
solved it.

The error came from grepping the function's line range for a hex and reading
its PRESENCE rather than its POSITION — the same shape as costing a painter's
env by line range instead of by call site, two sections up. A literal inside a
painter is not evidence of a hardcode; the line it sits on is.

**So one painter needs changing, not two.** Only cut marks
(`render-2d.js:1469-1470`) assigns `ctx.strokeStyle` and `ctx.fillStyle`
without consulting env at all.

> **That sentence was wrong, and Tier 2k is where it was found.** It counted
> one colour per painter. `drawFixture2D` sets two — the linework from
> `env.FIXTURE_COLOR`, and a body fill that was a bare
> `rgba(255,255,255,0.65)`. The row above is right about the colour it
> looked at and silent about the one it did not. Two painters needed
> changing.

Underlays has a different defect, and a more interesting one: it reads
`env.colors.origin` — **the origin marker's key** — so a tracing underlay and
the drawing origin are one colour by wiring, not by coincidence. Move the
origin and every underlay moves. That is exactly the shared-key coupling the
five separate keys exist to prevent, already live in the code, and it is why
`draw-underlay` is a re-point rather than a rescue.

`1.00` is not a rounding of "poor". The night skin's `surface-page` is
`#1d1f20` and `NOTE_COLOR` is `#1d1f20` — **the identical hex**. A note would
be painted in exactly the colour of the page behind it.

### Why nothing is broken today

`MODEL.dc.html` has no skins. It is one light page, every one of these reads
fine on it, and no check could have caught otherwise because there is no second
ground to test against. MODEL.html **is** skinned, so the defect is created by
the port rather than found by it — which is the same shape as `drawRoof2D`'s
`#7a4a21`, right down to the fix: that brown moved out of the painter into
`env.colors.roof` and got a value per skin.

### One of them cannot be fixed from the call site

`stairs` and `notes` and `fixtures` take their colour through `env`, so a
caller can pass whatever the skin says and the painter never changes.

`cut marks` takes no colour from env at all, so it needs the painter changed —
and under the harness's own rule that means a `render-2d-harness.js` check in
the same PR or the mutation step goes red.

`underlays` needs no painter change. It needs its caller to stop passing the
ORIGIN colour and start passing `draw-underlay`.

### So the order in Tier 2i is right and its costing was low

Notes still goes first — it is two env keys — but the "two colour keys, nearly
free" line assumed a colour existed to pass. It does not. **The real first step
is one palette decision**, and it unblocks all five at once rather than being
five separate problems:

- `ink-primary` (13.16 night / 14.79 day) for notes and fixtures, if annotation
  should read as text. Already in both skins; needs no new key.
- `draw-dim` (5.15 / 6.05) if annotation should sit in a visibly different
  family from body text.
- New keys for stairs, cut marks and underlays either way, since none of those
  maps onto an existing role — and underlays most of all, because it is
  currently borrowing one.

**Bring measured candidates, do not guess a colour.** The `drawRoof2D` entry in
`HANDOFF-SKIPPER.md` has said so since 4 Sep and it applies to all five.


## Tier 2k — fixtures, and the four functions that had to come with them (5 Sep)

Fixtures is the painter tier 2i costed as expensive, and it was: two new
script tags where the walls cost one, and a new module. It is also the one
that removes code rather than adding it — `MODEL.dc.html` is 86 lines shorter
than it was.

### Why a module and not a call

`drawFixture2D` is the only painter here that **does not know where its
subject is**. Every other one takes geometry and draws it; this one takes a
fixture and asks its caller three questions — `fixtureGeometry`, `wallFrame`,
`wallCross` — because a fixture is stored as an offset along a wall and has to
be resolved against that wall's assembly before anything can be drawn.

Those answers were methods on `MODEL.dc.html`'s component, so they were
reachable from exactly one page. That, and not the painter, is why this page
drew no fixtures through two tiers.

**It is four methods, not three.** `_fixtureGeometry` hands the tub case to
`_tubGeometry`, which needs the other two to find the end of the alcove. The
four are a closure; splitting any one out moves the dependency rather than
removing it.

`fixture-geometry.js` is those four as pure functions over a `walls` array.
`MODEL.dc.html` keeps its method names and delegates in one line each.

### The measurement that made it a module rather than a copy

All four are pure — the only `this` inside their own bodies is each other and
`this._walls`.

**And that is the third time a line range has lied about a function here.** A
grep over `_fixtureGeometry`'s neighbourhood reports `this._canvas`,
`this._orthoHalfH`, `this._activeWalls` and `this._distToLineSeg`, which would
have made it component-bound and unextractable. All four are in the *next*
method, past the closing brace. Brace-match before believing a range; the rule
is in Tier 2j and it needed applying again the same day.

### The extraction was proved, once, and the proof is not kept

Before `MODEL.dc.html` was touched, a differential ran the module against the
live methods while both copies existed: **8421 comparisons across 2994
fixtures — every wall type, every `refLine`, both sides, standoffs, degenerate
walls, and tubs at every alcove length — identical.**

It caught a real defect on its first run. `_tubGeometry`'s return carries a
`corners:` line and the transcription dropped it: the method had been read
through two windows that did not meet, and one line fell in the gap. Every
number beside it was right, so a tub would have painted its two decks and no
body.

**A function read through two windows is not read until the windows are proved
to touch.** Same family as the line-range trap, and it is the reason the
differential existed rather than a spot check.

That differential is **recorded here and deliberately not committed**.
`MODEL.dc.html` delegates now, so the same comparison would be the module
against itself, and a check that reads the thing it is checking cannot fail.
What is committed instead is `proto/fixture-geometry-harness.js` — the
contract, 52 checks, 27 mutations, all caught — including `a tub returns four
corners`, which is the dropped line turned into a standing check.

### The colour, and the row Tier 2j got wrong

Tier 2j read one colour per painter and cleared fixtures on that basis:
`FIXTURE_COLOR` comes through env, so no painter change. Brace-matching
`drawFixture2D` (`render-2d.js:419-628`) finds two colour literals in it:

```
:449  ctx.fillStyle = 'rgba(255,255,255,0.65)'   the body fill, EVERY fixture
:624  ctx.strokeStyle = '#5980a6'                the selection stroke
```

The second is inside `if (options.selected)` and this page has no selection,
so it never fires here. The first fires on every fixture, and it is the same
defect as the leader note one layer in: a translucent white body on a
`#1d1f20` ground, under `#e7e5e2` linework. The fixture is erased.

So it becomes `env.fixtureFill`, **with no fallback**. A
`|| 'rgba(255,255,255,0.65)'` would let a caller keep the literal by saying
nothing, which is the drift the change exists to remove. `MODEL.dc.html` now
names the white it has always drawn — no pixel moves there — and MODEL.html
passes its own ground at the same 0.65, spelled as an appended hex alpha byte
(`#1d1f20` + `a6`), guarded by the shape of the value so a skin that ever
returns an `rgba()` falls through opaque instead of producing nonsense.

### The selection rule is inheritance, and it has to be

A fixture **carries no view of its own**: `drawing-format.js:179` stamps every
one `'plan'` whatever was saved. So filtering on `fixture.view` would be
filtering on a constant, and a fixture on a hidden wall would come back.

The bone's rule (`_activeFixtures`, with the note above it saying so in as
many words) is that a fixture inherits its host wall's visibility. MODEL.html
keys off its own `walls()` for exactly that reason, which gives the same rule
against a smaller set — this page paints no shared-context walls yet, and
follows them with no edit when it does.

`tests/model-html-fixtures.spec.js` pins the case that tells the two apart: a
wall on the FOUNDATION layer set, on the level being viewed, holding a fixture
stamped `plan`.

### The bill

| | |
|---|---|
| new module | `fixture-geometry.js`, four functions plus the tub and counter specs |
| `MODEL.dc.html` | **-86 lines**, four one-line delegations, two constants re-pointed |
| painter | one line, `env.fixtureFill`, no fallback |
| script tags | `fixture-geometry.js`, `closets.js` — the tier-1 exact list goes 9 to 11 |
| checks | 52 + 27 mutations (module), 1 + discriminator (painter), 6 page tests |

Two of the five painters are done. Stairs, cut marks and underlays remain, and
cut marks is the only one left that still needs the painter itself changed.


## Tier 2l — cut marks, the last painter that needed changing (6 Sep)

The third of five, and the one Tier 2j singled out as the only genuine painter
change left. That was right about the painter and wrong about the count.

### Two colours again, and the same audit missed both times

Tier 2j listed cut marks as one hardcode at `render-2d.js:1469-1470`. Two
things were wrong with that line. The numbers had drifted — it is 1481-1482
now — and there is a **second colour**:

```
:1452  ctx.fillStyle = '#fff'          the bubble interior
:1481  ctx.strokeStyle = '#b04060'     the ink
:1482  ctx.fillStyle   = '#b04060'
```

Identical species to the fixture body fill, found the same way, and missed the
same way. **The rule this establishes: every painter that fills a symbol has an
interior, and an audit that counts one colour per painter cannot see it.** The
env-supplied ink is what hides it — the painter looks wired because the colour
you thought to check comes through `env`.

Both go through env with **no fallback**, for the reason fixtures did. Note
`const ink = ctx.strokeStyle` reads back whatever `:1481` set, so one key
carries the triangles and the lettering too; a third key would be wrong.

`#b04060` **is** the day value of `draw-cut`, so the light page does not move.

### drawCutPreview2D is a third site, and is deliberately left alone

`drawCutPreview2D` (`render-2d.js:1489-1509`) hardcodes `#994466` — the
in-progress rubber-band line while a cut is being placed. It is **not the same
colour**: the preview is deliberately duller than the committed cut, so
"fixing" it by reusing `draw-cut` would change MODEL.dc.html's pixels rather
than preserve them.

It stays hardcoded because it cannot be exercised: its only caller is
MODEL.dc.html, which has no skins, and MODEL.html has no cut tool so it cannot
call the preview at all. Routing it through env would add a key with one
caller, one possible value, and no night path to test on.

**And here is what that night path will find when it exists.** Skipper
measured `#994466` with `palette.js`'s own `contrast()` against both grounds:

```
              ground     #994466
day    (both themes)     #f2f2f3      5.56
night  (both themes)     #1d1f20      2.66
```

Fine where it runs, and **2.66 is under the 3.0 floor for a line**. So this is
not a tidy-up deferred, it is a defect with a date on it: the first cut tool on
a skinned page inherits it. Recorded here with the number so whoever adds that
tool is not re-measuring from scratch.

It also settles the shape of the eventual fix. `draw-cut-preview` wants to be
its own palette role with two values, NOT a tint derived from `draw-cut`: a
derived tint would inherit the same failure the literal has, and the two
colours are not related by lightness anyway (`#b04060` to `#994466` is a hue
and saturation move, not a step).

### Four inputs from three places, and one from nowhere

This painter's seam is the widest of the five:

| input | where it lives | |
|---|---|---|
| `cuts` | the drawing | persisted, read like walls |
| `elevationMarkOffsets` | the drawing | persisted |
| `structureStandards` | the **profile** | localStorage, not the drawing |
| `autoDimFirstOffsetFt` | nowhere | session state on the old page |

`structureStandards` — is the auto-elevation ring on, which bubble style — is
the drafter's OFFICE STANDARD, read with `DraftProfileManager.getActive`. So
**profile-manager.js is in MODEL.html's head**, the first dependency there that
is not about drawing the drawing. The cheaper option was office defaults, and
it was rejected on what it would look like: a drafter who had switched the ring
off opens the viewer and finds four elevation marks round the house.
`tests/model-html-cuts.spec.js` has the check that earns the dependency — flip
the profile, watch the ring go — and it is the only test in that file that can
tell the two designs apart.

`autoDimFirstOffsetFt` has no home. It is a menu setting the bone keeps for the
session and never saves, so MODEL.html uses `1.5'`, the value MODEL.dc.html
starts every session with. **A drafter who changed it mid-session sees a
slightly different gap here.** That is the one place this page cannot be
faithful, and it is stated rather than hidden.

Two globals, not one: the reader is `DraftProfileManager`, the normaliser is
`DraftStructureStandards` (`profile-manager.js:479`). The first attempt reached
for `PM.normaliseStructureStandards`, which is undefined — the name was grepped
out of an export list and the wrong object assumed around it. The page caught
the throw and said "painter failed", which is the notice doing its job.

### The extraction, and what its own guard missed

Five methods, 80 lines out of `MODEL.dc.html`, pure over walls + dimensions
plus three settings passed in. `_autoElevationsOn` and `_cutMarkGapFt` stay on
the component: two-line state reads with no geometry, and dragging state access
into a pure module to save four lines is the trade backwards.

Proved by a differential run while both copies existed: **32256 comparisons —
six wall sets, six dimension sets, seven offset maps including `null`, `NaN`,
`Infinity` and a string, both auto-elevation states, four gap values, eight ray
directions — identical.**

That differential carried a guard asserting each extracted window starts with
the method it claims and closes at depth zero. **`_autoElevationsOn` was left
off the guard's list and was the one window that was wrong.** A guard only
covers what it is pointed at.

A second slip in the same edit, the reverse of the tub's: the `_eMarkDimEdges`
replacement sliced to the comment above `_autoElevationCuts` and **swallowed
`_eMarkClearFt`, which sat between them.** Nothing called it any more, so it
would have gone unnoticed. It is restored as a delegation — removing a method
from that page is a different change from moving its body, and only the second
was agreed.

### Five mutations survived the first harness, and one of them was the house rule

`proto/cut-marks-harness.js` measured 48 checks / 20 of 25 mutations before the
gaps were closed. Worth listing, because the first is the failure this repo
names most often and it was made here anyway:

- **Two checks read the constant back off the module** — `expect(clearance ===
  G.E_MARK_CLEAR_FT)`. Mutate the constant and both sides move. *A check that
  reads the thing it is checking cannot fail.* Now pinned at 2' and 6'.
- **The corridor-pad case sat inside the corridor**, so it pushed the edge
  either way. The real case is a string in *neither* corridor.
- **The miss-the-house case left by the wrong door** — a cut at (100,100) never
  travels the z slab and exits at `!sx || !sz`. The guarded overlap test needs
  a diagonal that grazes the corner.
- **One mutation was removed rather than caught.** `!Number.isFinite(tMin)` is
  unreachable: a slab returns infinities only when the ray is parallel to it,
  and a unit vector cannot be parallel to both axes. The guard is kept (this
  was an extraction, not a cleanup) and the mutation dropped with the reason
  written down — a mutation nothing *can* catch reads as a coverage gap when it
  is really dead code.

Final: **52 checks, 24 mutations, all caught.**

### Two page checks were wrong before they were right

Both worth keeping, because both looked correct:

- **The discriminator proved the wrong thing.** "With no cuts the ink is never
  stroked" *failed* — `drawCutMarks2D` sets `strokeStyle` before it iterates,
  so the colour is set whether or not anything is drawn. Stroking draw-cut only
  ever proved the painter RAN. The lettering is what discriminates: every cut
  writes its own name inside its bubble.
- **The bubble-style check compared a tally.** `window.__fills.length` came to
  54 for both styles — equal by coincidence, so the check passed nothing
  through. It compares the drawing operations now.

### The bill

| | |
|---|---|
| new module | `cut-marks.js`, five functions |
| `MODEL.dc.html` | **-80 lines**, five delegations, three constants re-pointed |
| painter | two lines, `env.cutColor` and `env.bubbleFill`, no fallback |
| script tags | `cut-marks.js`, `profile-manager.js` — the exact list goes 11 to 13 |
| checks | 52 + 24 mutations, 2 painter checks + discriminators, 6 page tests |

**Three of five painters done. Stairs and underlays remain, and neither needs
the painter touched** — measured by brace-matching both bodies: zero hardcoded
colours in either. Stairs is the larger extraction of the two (13 methods, 167
lines, all level data, all persisted); underlays is a caller re-point plus an
image loader MODEL.html does not have yet.


## Tier 2m — stairs, and the module that had to come first (6 Sep)

The fourth of five, and the first where the painter was never the problem.
`drawStairs2D` has no hardcoded colour and needed no edit — Tier 2l's
brace-match was right about that. What it cost instead was a **second module
nobody had costed**, and the reason is worth reading before Tier 3 is planned.

### The closure was 13 methods and only 6 of them were stairs

Measured by brace-matching, not by reading a line range:

```
_stairPlanParts     92 lines    _floorLevels        6    reads this.state
_stairShapeSplit    17          _levelWallTopFt     6
_stairDescent       15          _activeLevelId      4    reads this.state
_stairLayout         7          _levelFloorFt       4
_stairLandFt         5          _levelAssembly      3    reads this.state
_stairCurrentLayout  4          _activeLevel        2    reads this.state
                                _boneyardLevelId    2    reads this.state
```

The right-hand column is the app's **level spine**, not stair geometry, and the
call counts settle it: `_activeLevelId` has **66 callers** on the component,
`_floorLevels` 21, `_levelAssembly` 17. Moving those into a stair module would
make the stair module the owner of the level model. So six functions moved and
the seventh question — *what is this level made of* — is passed in through a
`levels` accessor that can be handed an object literal in a test.

### The constants could not move, and that is not a weaker extraction

`cut-marks.js` and `fixture-geometry.js` took their constants outright;
`CUT_BUBBLE_PUSH_FT` appears **zero** times in `MODEL.dc.html` today. Stairs
cannot do that. `STAIR_TREAD_RUN_IN` is named **17 times** and only 6 are in the
closure — the STAIR SECTION drawing measures its own treads with it, and so do
the auto-placer and the stair schedule.

So the module owns the value and the page **binds** to it:

```js
const STAIR_TREAD_RUN_IN = window.DraftStairGeometry.STAIR_TREAD_RUN_IN;
```

One source of truth either way; the seventeen uses do not change. Four
constants that turned out to be closure-only (`STAIR_MAX_RISER_IN`,
`STAIR_LANDING_MIN_FT`, `STAIR_LANDING_DRYWALL_IN`, `STAIR_RAIL_INSET_FT`) left
outright and are now at zero references.

### THE FINDING: the stored rise is a fallback, and trusting it is a real defect

This is the part that cost the extra module, and the part Tier 3 should learn
from.

A stair stores `riseFt`. It is tempting — and it was the cheap path — to have
`MODEL.html` read it and skip the level model entirely. It is **wrong**, and
not marginally:

- `_stairCurrentLayout` re-derives the rise from the level heights on **every
  paint**, and uses the stored value only *"if its level goes away"*.
- Nothing ever writes the derived rise back. All four writes to `riseFt` are at
  stair **creation**.
- So edit a wall height or a joist depth, save, and the stored rise is stale
  while the bone keeps drawing the derived one.

Two boards would then have drawn **the same drawing with different riser
counts**, and no test on `MODEL.dc.html` could ever have caught it — that page
never reads the stored value while a level exists. Same family as the note
painted in the night page's own colour: *the second page creates the defect, so
the second page is where the test lives.*

That forced `level-assembly.js`, which was overdue on its own: the defaults
table saying what a level is made of existed in **three copies** —
`MODEL.dc.html`, `LAYOUT.dc.html`, and `proto/elevation-harness.js`, whose
comment already admitted it *"mirrors LAYOUT.dc.html's normaliseLevelAssembly
exactly"*. This change adopts it in `MODEL.dc.html` only; **LAYOUT.dc.html still
holds its own copy** and adopting it there is a separate change with its own
test surface.

### How the extraction was proved

The differential ran while both copies existed, and it does not survive into
the repo — `MODEL.dc.html` delegates now, so the same comparison would be the
module against itself. It sliced the **live method text straight out of
`MODEL.dc.html`** (constants included) and raced it against the module over
random stairs:

| | comparisons | mutations caught |
|---|---|---|
| `stair-geometry.js` | 24000 / 24000 identical | 12 of 12 |
| `level-assembly.js` | 6007 / 6007 identical | 10 of 10 |

Before that, a **textual** diff of every extracted body against its original:
`_stairPlanParts` came out at 76 code lines each with the single difference
being `}` versus `};`. That check exists because a function read through two
windows that do not touch is a function with a missing line, and one of those
shipped a tub with no body earlier in this tier.

### What the sweep caught that the tests did not

The page tests were mutated too, and one mutation went **green**: routing
`stairs()` through the page's ordinary `onPlan()` helper. Stairs filter
strictly on `view` — `stair.view === view`, no `|| 'plan'` fallback, unlike
every wall and fixture beside them — and the three stairs in the test all
carried an explicit view, so nothing could tell the two rules apart. A stair
with **no view field** is the only input they disagree about. It is in the test
now. The comment claiming the strictness mattered had been there the whole
time; the assertion had not.

### The bill

| | |
|---|---|
| new modules | `stair-geometry.js` (6 functions), `level-assembly.js` (3 + the defaults table) |
| `MODEL.dc.html` | **-166 lines**, 6 stair delegations + `_stairLevels`, 2 functions and 11 constants bound |
| painter | **untouched** — no hardcoded colour, `env.stairColor` already reads through |
| script tags | `level-assembly.js`, `stair-geometry.js` — the exact list goes 13 to 15 |
| checks | 30007 differential comparisons, 22 module mutations, 3 page tests, 4 page mutations |

**Four of five painters done. Underlays is the last one, and it is the one that
could still stop short of the definition** — `imageFor` reads a decoded-bitmap
cache and `MODEL.html` has no loader. That is a loader to measure before
committing to it, not a re-point.

### Why a store fix rides in the stairs change (6 Sep)

`shared-file-store.js` is in this diff and it has nothing to do with stairs.
It is here because verifying the stairs work found it, and the finding is
worth more than the tidiness of a narrow PR.

Verifying tier 2m meant running the full suite, which surfaced seven failures.
Attributing them took a second checkout at `3223d79` and a second machine, and
produced a table nobody expected:

| | base `3223d79` | stairs |
|---|---|---|
| one container, idle ×3 | **2, 2, 1 rotating** | 0, 0, 0 |
| another container, idle ×3 | 0, 0, 0 | 0, 0, 0 |

Six of the seven were **already failing on main**. The suite was not green
before this change and is not made worse by it. But two facts refused to sit
together: one machine lost the race every run and another never did, and on
the machine that lost it, adding two `<script>` tags to MODEL.html — nothing
else — made it stop. A change that alters nothing but page weight should not
fix a bug.

It doesn't. `openDb` wired `onupgradeneeded`, `onsuccess` and `onerror`, and
`indexedDB.open` has a fourth outcome: **blocked**, which fires when a
`deleteDatabase` is still pending. While blocked, neither success nor error
fires — and because the promise is cached in `dbPromise`, and `forget()` is
reachable only from the handlers that never ran, one blocked open wedges every
later read for the life of the page.

Eleven spec files call `deleteDatabase('pdf-img-mgr-shared')` in their init
scripts. That string is `DB_NAME`.

So both observations were one defect seen from opposite ends: **anything that
delays the open past the delete hides it.** Two script tags did. So did a
faster machine. That is why the stairs branch appeared to "fix" the race, and
why banking that would have been the worst outcome available — a bug that
stops reproducing is a bug that stops getting fixed.

**The rule this leaves.** A pre-existing failure is not attributed until it has
been run on a second tree AND a second machine. One clean run on the box you
happen to have proves that box, not the code. Every conclusion in the table
above changed at least once before the sixth run.

