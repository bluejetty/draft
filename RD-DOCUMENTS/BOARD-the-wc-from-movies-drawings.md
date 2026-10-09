# The WC, drawn from Movie's own drawings

Movie, 9 Oct: *"improve the WC items (toilet, sink, bathtub) and … make some
'default' washrooms i can select and add to the plan"*, then the drawings to
do it from: five interior sections (`WC_PLAN_2` … `WC_PLAN_6`) and the plan
`1._Story.DXF` with both main baths on it.

## What the drawings say (measured off the DXFs, not read off the labels)

| | Bath A | Bath B |
| --- | --- | --- |
| Inside | 5'-7" × 8'-7" (67" × 103") | 5'-1" × 8'-1" (61" × 97") |
| Tub | 30 × 60, across the end, on the exterior wall | the same |
| Tub foot | a 6" wall, full height, as long as the tub is deep | none — the tub runs wall to wall |
| Door | D32 in the end wall opposite the tub | D32 on the long wall opposite the toilet and vanity |
| Vanity | V36, 24" deep | V30, 24" deep |
| Toilet | 18" wide, 28" from the wall face | the same |
| Ceiling | 8'-1 1/8" (97 1/8") | the same |

The tub was drawn 32" deep and labelled 30X60; Movie: *"can you reduce that
tub to 30" x 60""*. The exterior wall the tub backs onto is magenta in the
sections: *"when the bathroom is against the exterior wall it should join up
like this … when it is in interior that magenta wall should become a int
wall."*

## The plan (three PRs)

1. **The fixtures and the floor, in plan.** The toilet, the basin and the tub
   are Movie's outlines, traced out of `1._Story.DXF` and kept in
   `render-2d.js` as polylines in inches. The toilet draws with no box round
   it; a vanity is 24" deep (it was 21") with Movie's backsplash line instead
   of a counter nosing, and the basin sits centred at its own size in any run;
   the tub's basin is stretched to the tub as placed, drain at the faucet end.
   A room the walls close round a toilet, tub, shower or stall lays 1'-0" tile
   from the finished face of its longest side, in the fixture ink made faint
   (*"the floor in the WC should be 1ft tile, and lighter line at joints"*) —
   MODEL and every LAYOUT plan sheet.
2. **The fixtures in SECTION cuts**, from the five section DXFs. Today a cut
   through a bathroom draws no fixture at all.
3. **The default washrooms A and B**, dropped in like the hologram (move,
   rotate, drop), walls, door, fixtures and tile together; the tub-end wall
   joins a 2x6 exterior wall it is dropped against and is a 3 1/2" interior
   wall anywhere else. `washroom.js` already carries bath A's numbers from 8
   Sep (103" = 30 tub + 36 toilet + 36 sink + 1 finish).

## Status

- PR 1 (#651, merged): Movie's toilet, basin and tub in plan; the 1'-0" tile.
- PR 2: the fixtures in SECTION cuts. `fixture-profiles.js` carries each
  one's FRONT and SIDE elevation, traced from WC_PLAN_2..6, with a filled
  silhouette. `cut-view.js` drawSectionFixtures stands every fixture beyond
  the cut: the front when it faces the cut, the side (mirrored to the wall it
  backs onto) when it is turned a quarter, nothing when a wall stands between
  it and the cut -- which is also what hides one facing away, its own wall
  being that wall. Farthest first, each silhouette covering what is behind it
  (Movie: "the piece 'in front' should cover the stuff 'BEHIND'"). A fixture
  the cut runs through draws at the same weight ("sounds good with your
  recommendation"); a cut fill can come later. The vanity's front stretches
  to its run and the tub's to its alcove; a toilet is its own size. MODEL's
  section view and LAYOUT's section viewports both.
- PR 3: the default washrooms. `washroom-presets.js` lays out BATH A and BATH
  B from 1._Story.DXF in the room's own frame and places them in the world:
  turned a quarter at a time, mirrored (F), the tub end slid flush with an
  exterior wall it is dropped within 18" of -- the house outline's walls, or
  the thick ones on a storey with no outline yet -- in which case the room
  draws no tub wall and the tub sits on the house's wall. MODEL's FIXTURE
  tool carries them on its BATH row: the room follows the cursor
  ([ ] turn, F mirror, Esc), a press drops walls, the D32 (into the room,
  hinged where Movie hung it), tub, toilet and vanity as one undo and one
  ASSEMBLY named for the bath. UNGROUP breaks it into pieces and ASSEMBLY
  makes a new arrangement of them (Movie: "BREAK the kitchen into pieces,
  add new pieces or delete pieces and ASSEMBLY the kitchen in new
  configuration" -- the same holds for a kitchen when its turn comes).
  A room joined to the exterior wall keeps its tub on that wall: moving the
  assembly off the wall later leaves the tub where the wall is.

