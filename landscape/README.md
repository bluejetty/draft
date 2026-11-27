# landscape/ — RUFF LANDSCAPE / ROUGH LANDSCAPE

**jb, 27 Nov 2026:** *"it would be nice to be able to have an area where the house
stays as it is and the user can manipulate the landscape for the lot grading"*,
and *"i don't think it needs to be 3D program"*.

A separate program for grading the lot, the same way `viewer/` (RUFF 3D) is
separate. No 2D page loads anything in this folder, so deleting it leaves the
drafter working (`tests/landscape.spec.js` checks this). The OPEN LANDSCAPE
chip on MODEL only opens a tab.

## What it does (phases 1 and 2)

- **Opens** a `.draft` or a SAVE AS ZIP, or takes the drawing from MODEL's OPEN
  LANDSCAPE chip (`?from=drafter`).
- **Shows the SITE plan** with the drafter's own painter (`layout-plan.js`
  `drawPlan`): lot, footprint, setback rows. The house can't be edited, because
  there are no tools for it.
- **Spot elevations**: FINISHED (what the ground will be) and EXISTING (what it
  is now). Click to place one, then type its height (`99.5` or `99'-6"`). Drag a
  spot to move it, Delete to remove it, Ctrl+Z to undo.
- **House corners** stand at the drafter's grade (the elevations' grade line,
  `cut-view.js` foundation grade). Pick a corner and type a height to set that
  corner on its own.
- **A new drawing starts graded**: a spot on each lot corner, and a ring 10 ft
  out from the house at 6" below it. Where the lot line is closer than 10 ft,
  the ring spot is pulled in to the lot line, still at 5%.
- **The surface** is a TIN (Delaunay triangles, straight-line between spots),
  as a grading plan is drawn by hand. It gives contours at 6" / 1' / 2' / 5',
  heavier every fifth line and labelled. Each triangle gets a slope arrow with
  its %. Existing grade shows as dashed contours once there are 3 existing
  spots.
- **Checks**:
  - The ground falls 6" in the first 10' from the house (IRC R401.3). This is
    asked over a shorter run near the lot line, where a swale is needed.
  - Nothing is steeper than 3:1 (33%).
  - Nothing is flatter than 2%.
- **DATUM 0 / 100**: heights are shown with the main floor at 0 or at 100.00.
  It changes the display only.

## Where the grading lives

The drawing's `landscape` key:

    { version: 1,
      spots: [{ id, x, z, y, kind: 'fg' | 'eg', lotCorner? }],
      houseCorners: { '<outlineId>:<index>': y },   // only corners set on their own
      interval: 1, datum: 0 | 100 }

`x`/`z` are plan feet, as the `.draft` stores them. `y` is feet with MAIN FL at
0, the frame that levels and cut-view use.

The drafter never reads this key. It carries it through its load and save
(`model/17-boot-save.js` spreads the file), and HOUSE turn turns the spots with
the house (`plan-rotate.js`).

From the drafter, every change is handed straight back to the drafter's tab,
and its own SAVE keeps it. A file opened directly is saved with **SAVE .draft**:
the same drawing, with only `landscape` changed.

## Files

- `index.html`: the page, which loads the shared modules from `../`.
- `grading.js`: the arithmetic (`window.DraftGrading`). It has no page and no
  canvas, so the spec questions it directly.
- `landscape.js`: the page's behaviour (`window.DraftLandscape`).

## Next (not built)

- Phase 3, things on the lot:
  - driveway (with a slope check), walks, patio
  - retaining walls, swales, fences, trees and shrubs
  - grass, gravel and rock hatches
- Phase 4, outputs: a LOT GRADING PLAN sheet, and RUFF 3D showing the shaped
  ground.
