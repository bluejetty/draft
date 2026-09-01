# Scoping note — the sheets part 2 could not deal, and what they would take

**From:** Gilligan, 1 Sep, closing board NEW-2 part 2
**Status:** scoping only. Nothing here was built.

Part 2 deals Movie's order for every sheet that has ink. Five of his fourteen
do not, and they fail for two different reasons that want two different
boards. This note separates them, because the smaller one is much closer to
done than it looks from the outside.

---

## Correction (1 Sep, after Devin checked it)

**The first version of this note was wrong, and wrong in the direction that
makes the work look bigger than it is.** It claimed lines and floors carry no
`layer` field, from a check of `drawing-format.js`'s normaliser alone. That
does not follow, and the code says otherwise:

- `_buildHouseFootings` sets `layer: 'S-FOOTING'`, and MODEL serialises
  `layer: line.layer || 'draft'`. **Footings persist with their real AIA
  layer.**
- All 22 AIA names exist and are guarded by `tests/layer-standards.spec.js` —
  `S-SLAB`, `S-FDN` and `E-POWER` among them. They are a tested standard, not
  an aspiration.

## What is actually missing

The gap is narrower than "no layers" and different in kind.

**Some entities store their layer; some are identified structurally instead.**
A slab is not stored as `S-SLAB` — it is a floor with `view:'foundation'` and
`structure:'slab'`. So anything asking "give me the `S-SLAB` entities" gets
nothing, even though the geometry is right there and the app labels it S-SLAB
on screen.

| Entity | How its layer is known |
| --- | --- |
| footings (lines) | stored: `layer: 'S-FOOTING'` |
| beams, pad footings | stored: `S-BEAM`, `S-COL-FOOTING` |
| openings, fixtures, notes, tags | stored |
| **slabs (floors)** | **derived: `view` + `structure`, no layer string** |
| **foundation walls** | **derived: `wall.view === 'foundation'`** |

## Board A — one mapping function, not per-sheet filters

Sheets 6, 8 and the structural half of 9.

The job is a **mapping**, not a tagging pass: `(kind, view, structure)` to an
AIA layer name, for the kinds that derive theirs rather than store it. Then
`drawPlan` filters on the mapped name exactly as it filters walls today.

Write it as one function because **the DXF export needs the same mapping**.
A layer name is what a DXF layer IS, so a per-sheet filter here would have to
be re-derived there, and the two would drift. One function, two callers.

**Size:** smaller than a session. **Risk:** low — nothing is stored
differently, so no save-format change and no migration. The existing
`layer-standards.spec.js` already pins the vocabulary the mapping must
produce.

## The hazard board A must handle first (found by Devin, verified here)

`MODEL.dc.html:4930-4938` restores a line's layer through a **whitelist**:

```js
layer: line?.layer === 'no-draft' ? 'no-draft'
     : line?.layer === 'S-FOOTING' ? 'S-FOOTING'
     : (line?.layer === 'E-POWER' || view === 'e-power') ? 'E-POWER' : 'draft',
```

Three names survive a reload on a line. **Every other layer name collapses to
`draft`**, silently, with nothing logged and nothing failing.

So a mapping that writes `S-FDN` onto a line would serialise correctly, look
right in the saved JSON, and be flattened the next time the drawing opens.
The sheet would be right until reload and wrong after it — the worst shape of
bug to find from a customer rather than a test.

Board A therefore starts here: make the layer restore validate against the
`layer-standards.spec.js` vocabulary instead of a hand-kept ternary, so a new
layer name is a table entry rather than a fourth branch somebody forgets. Do
this BEFORE the mapping, or the mapping's output will not survive a round
trip.

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
