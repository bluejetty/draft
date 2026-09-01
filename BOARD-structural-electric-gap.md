# Scoping note — the sheets part 2 could not deal, and what they would take

**From:** Gilligan, 1 Sep, closing board NEW-2 part 2
**Status:** scoping only. Nothing here was built.

Part 2 deals Movie's order for every sheet that has ink. Five of his fourteen
do not, and they fail for two different reasons that want two different
boards. This note separates them, because the smaller one is much closer to
done than it looks from the outside.

---

## What is actually missing

The layer table in `layer-views.js` names the contents of each view. Audited
against `drawing-format.js`, entity by entity:

| Layer | Entity in the saved format? |
| --- | --- |
| `S-BEAM` | yes |
| `S-COL-FOOTING` | yes |
| `A-FL-OPNG` | yes |
| `A-STR` | yes |
| `S-SLAB` | **no** |
| `S-FDN` | **no** |
| `S-FOOTING` | **no** |
| `E-POWER` | **no** |

That table is the whole story, and it is easy to read the wrong lesson off
it. The obvious reading is "four painters are missing." That is wrong for
three of the four rows.

## Board A — the structural sheets: the geometry exists, the labels do not

Sheets 6, 8 (floor layouts) and the structural half of 9.

**MODEL already builds this geometry.** `_buildHouseFootings` pushes footings
into `this._lines`. `_buildGarageSlab` works in `this._floors`. Beams and pad
footings already carry `S-BEAM` and `S-COL-FOOTING` and are real entities.

What is missing is not the drawing — it is that **`lines` and `floors` carry
no `layer` field at all** (confirmed: no layer key in either normaliser). A
footing is a line indistinguishable from any other line, so nothing can ask
for "the footings" and get them.

So the job is:

1. Give `lines` and `floors` a `layer`, defaulted so old drawings load
   unchanged — the same additive shape as `auto` on fenestrations (#169) and
   on room tags (#323).
2. Tag them where they are built: footings `S-FOOTING`, slabs `S-SLAB`,
   foundation walls' own layer `S-FDN`.
3. `drawPlan` already filters; extend it to draw lines and floors whose layer
   is in the view's `contents`. It draws walls and openings today, and
   `render2D` has no line or floor painter — but these are polylines and
   polygons, not new symbol families.

**Size:** one session, most of it in the tagging and its migration, not the
painting. **Risk:** a `layer` field on two more entity kinds touches the save
format, so the three-places rule applies and old drawings are the test.

## Board B — electric: there is nothing to draw

Sheet 14.

`E-POWER` has no entity anywhere. There are no outlets, switches, fixtures on
circuits, panels, or home runs in the drawing format — not untagged, absent.
An electrical sheet is not a painter board at all; it is:

1. What an electrical entity IS (symbol, host wall or ceiling, circuit id).
2. How the drafter places one.
3. Then a painter, and only then the sheet.

**Size:** several sessions, and the first one is a design conversation, not
code. **Do not fold this into a sheet board.**

Note also that part 2's electric pairing rule ("two floor plans per page
unless big house") is unbuildable until B exists, and is deliberately absent
from part 2 rather than stubbed.

## Board C — SITE and ROOF

Sheets 3 and 4, already scoped separately as part 3. ROOF is close — level 7
holds real roof geometry and `DraftRender2D.drawRoof2D` exists. SITE is close
to empty. Not restated here.

---

## The one-line summary for Movie

Of the five sheets that did not deal: **three are a labelling job on geometry
the app already builds** (board A, one session), **one is a whole feature that
does not exist yet** (board B, electric), and **two are part 3**. The
structural sheets are much nearer than the electrical one, and lumping them
together would have hidden that.
