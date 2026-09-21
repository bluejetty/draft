# proto/repro-washroom-bungalow.draft

Movie's own drawing, saved off the site 21 Sep 2026 at 06:13 and kept
byte-for-byte as uploaded. He sent it to unblock the washroom work:

> *"ok you want a bathroom from the model.dc"* — *"i'll go get one."*

## What it is

A two-storey bungalow with 20 walls, 12 dealt windows, 3 beams, 2 columns,
2 stairs, 46 dimensions, one roof, and a saved layout.

## What it settles, and it is not what I expected

**A WASHROOM IS NOT A FIXTURE RECORD. IT IS A GROUP OF FOUR WALLS.**

    fixtures  []            <- empty, in a drawing with two bathrooms in it
    roomTags  []
    groups    2             <- both named WASHROOM, both `dealt: true`

    group-1   washroomLevelId 3   wall-37..40
    group-2   washroomLevelId 5   wall-41..44
    levelLocks[0]  "WC STACK"  members [group-1, group-2]

`_dealWashrooms` (MODEL.dc.html:17795) writes walls and a group and nothing
else, and the two units are stacked by a level lock so the 2x6 wet wall lines
up floor to floor and the drain runs straight down. In each unit `wall-37` /
`wall-41` is that 2x6, running the full length; the other three are 2x4s.

So "do the washrooms on the construction layouts" does NOT mean porting a
washroom painter — there isn't one. The four walls already drew. What did not
draw was the **fixtures**, which is what this drawing made obvious by having
none: the tub, toilet and basin are placed by the drafter afterwards as
ordinary wall-hosted fixture records, and the sheet was dropping every one of
them. See `tests/layout-fixtures.spec.js`.

**The empty `fixtures` array is therefore the point of the fixture**, not a
gap in it. Do not "helpfully" add fixtures to this file: a drawing that shows
a dealt washroom carrying no fixture record is exactly the evidence that a
dealt washroom carries no fixture record.

## The washroom's footprint, measured

Centre lines, off group-1's walls:

    x  -21.010417 .. -11.677083     9.333 ft  = 9'-4"   (the wet wall's run)
    z  -10.239583 ..  -4.072917     6.167 ft  = 6'-2"

`washroom.js`'s header computes the unit's stud footprint as 9'-2" x 6'-4"
at the STANDARD size. These are centre lines rather than stud faces and the
deal sizes the unit to its seat (`runsForLength` stretches the basin run up
to `SINK_RUN_MAX_IN`), so the two are not expected to agree digit for digit
and **no defect is claimed here** — recorded only so the next reader starts
from the measurement instead of from the header.

## Also useful in it

- **Two stairs**, one per floor, with `riseFt` 8.895833 (MAIN FL, down to the
  basement slab) and 9.145833 (2ND FL). Re-deriving those from the saved
  levels is what proved the sheet reads the storey heights the same way
  MODEL.dc.html does — see `4863369`.
- **A saved layout** that stacks a plan viewport over an elevation. Harnesses
  that want the page to compose a fresh set should `delete drawing.layout`
  first.
