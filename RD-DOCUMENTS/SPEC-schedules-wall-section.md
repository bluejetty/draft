# SPEC — door and window schedules, and the typical wall section

What jb asked for on 9 Nov 2026, from his draftsman's review of the base
set, and the rulings he gave while it was being scoped. Nothing here is in
the code's own words; this is the page to read before changing any of it.

## What he said

- *"Window and door schedules and a wall section cut in the base set. we
  should work on these."*
- *"will you put the window schedules in the ESTIMATES section? ... and
  doors"* — so the schedule rows and the estimate's 8-A / 8-B rows are ONE
  grouping, in `schedules.js`, and ESTIMATES prints the mark beside each
  item.
- On the section: *"so the wall section is basically taken from the PROJECT
  information right"* — yes. It is built by PROJECT's own
  `buildWallSection` from the saved drawing's level cards, foundation, roof
  and wall type (`wall-section.js` mirrors `detailValues()` line for line
  and names what it copies). Edited on PROJECT, printed on LAYOUT. ESTIMATES
  carries no drawing.
- On details: *"when i do details i usually show where the exterior walls
  meet the floor, and where it meets the roof and also the footing"* — so
  the WALL SECTION sheet carries the whole section plus EAVE, FLOOR and
  FOOTING details, each a 4 1/2 x 3 1/2 ft window onto the same drawing at
  a bigger scale. They cannot disagree with the section because they are
  it.
- Offered the choice, he took: identical openings grouped into one row with
  a QTY, and marks numbered per schedule (W1.., D1.., G1..), not per level.

## The schedules

| column | door schedule | window schedule |
|---|---|---|
| MARK | D1.. exterior first, then interior, each from the narrowest; G1.. overhead | W1.. from the narrowest, then the shortest |
| QTY | identical openings counted | identical openings counted |
| SIZE (W x H) | inches; a garage door in feet (16'-0" x 7'-0"); metric in mm to 5 | inches / mm |
| TYPE | EXTERIOR / INTERIOR / OVERHEAD | SINGLE / DOUBLE casement |
| STYLE / SILL HT | single, French, pocket, barn, sliding, bypass, garden, w/ sidelight, sectional | the LOWEST sill of the group |
| LEVEL | every level the row stands on, highest first | same |
| REMARKS | the sidelight's width and side | HEIGHT NOT SET when a window has none |

A door groups by kind, style and width (8-A's rule since 23 Oct; the height
is carried, not keyed). A window groups by width AND height. The row keys
are the estimate's own and did not change, so a typed unit price survives.

## On the sheet

Two viewport kinds joined plan, elevation and section:

- `schedule` (`table: 'door' | 'window'`) — a table in paper inches, 7.4"
  wide, pif 1 whatever the sheet's ladder says; no scale in its caption and
  NTS on a titleblock that holds nothing else.
- `detail` (`detail: 'wallsection' | 'eave' | 'floor' | 'footing'`) — the
  section no bigger than 1/2" = 1'-0", a detail no bigger than 1" = 1'-0",
  each stepping down the ladder 1, 3/4, 1/2, 3/8, 1/4 ... until it fits.
  On 11x17 that lands at 1/4" and 3/4"; on ARCH D at 1/2" and 1".

The deal: WALL SECTION right after the SECTIONS (the section in the left
56% of the region, the three details stacked down the right), SCHEDULES
after the BASEMENT PLAN and before ELECTRIC (door over window, each only
when it has a row; the sheet by name either way). Both are also under
+ ADD VIEWPORT, in groups SCHEDULES and DETAILS. EDIT IN MODEL on a detail
opens PROJECT.

## Known limits

- A split (bilevel / modified bilevel) sections its stored stack without
  the wood fill wall PROJECT's band 2 draws from the section table.
- The plan tags still read the size alone (36 X 42); the mark is not yet on
  the tag. The schedule's SIZE column matches a tag by size.

## Where it is held

`tests/schedules-wall-section.spec.js`, `proto/schedules-harness.js`
(`--mutate`, rows on `schedules.js` and `wall-section.js`),
`proto/schedules-wall-section-mutants.js` (the page side), and the
estimates gate's three door/window rows now aimed at `schedules.js`.
