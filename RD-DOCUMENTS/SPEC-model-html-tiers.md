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
5. **Outlines, dimensions, fixtures.** All three the same story as 3 and 4.

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
**All eleven of its env keys live only in `MODEL.dc.html`**: `fixtureGeometry`,
`closetDoorFor`, `wallCross`, `wallFrame`, `CLOSET_CLOTHES_FT`,
`CLOSET_ROD_FT`, `CLOSET_SHELF_FT`, `CLOSET_WALL_FT`, `COUNTER_OVERHANG_FT`,
`FIXTURE_COLOR`, `walls`.

So the criterion is not *"the function moved"* — it is **"someone else can call
it."** `drawFixture2D` has passed the first test since before this session
started and still fails the second. It moved house without changing address.

**This is a scope question board #1 has to answer, not a defect.** Making the
fixture painter genuinely shared means moving constants and accessors as well
as painters — a second, larger job living inside the first. It should be
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
