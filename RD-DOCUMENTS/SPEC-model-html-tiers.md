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

**All five levels currently stack on top of each other.** The readout says
`levels 5` and every one of them is painted at once. That is the first job,
and everything else waits behind it, because the filter changes what the
accessors return and every painter reads through them.

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

1. **Level filter.** Accessors take the active level id; default MAIN FL.
2. **Roofs and shapes.** `render-2d.js` already exports `drawRoof2D` and
   `drawShape2D` — no extraction needed.
3. **Floors, properly.** Tier 1 hand-rolls a polygon wash; the real painter is
   `_drawFloor2D`, still inside `MODEL.dc.html`.
4. **Mitred wall joins.** `drawWallSeg2D` takes `joins`, and tier 1 passes
   `null` (capped ends). Real mitring needs MODEL's `_wallJoins()`.

Steps 1-2 need nothing from board #1. Steps 3-4 do, and that is the seam where
tier 2 naturally pauses for the painter extraction.

**A level switcher is chrome, and chrome is tier 3.** Tier 2 picks a level and
paints it correctly; it does not grow a UI to change it.

---

## Tier 3 — the dashboard

Chrome, interaction, and the skins from `SPEC-skins.md`. Not specced here
beyond that, because tier 2 will change what it should say.
