# repro-2storey-garage.draft

Movie's own drawing, saved off the live site 20 Sep 2026 at 19:32
(`b060153f-20260920T1932.draft`). Two storeys over a foundation with an
attached garage, and it is the richest fixture in the repo:

    walls          20        levels          5
    fenestrations  21        dimensions     76
    roofs           2        outlines        3
    floors          4

**Why it was kept.** Two reasons, and the second is the one that will outlive
the first.

1. **The 76 dimensions.** `repro-garage-house.draft` has none, so nothing in
   the suite could see whether a drawing's dimension strings reach a
   construction sheet. This one can: the exterior strings are in the file as
   ordinary records carrying `auto: true`, because `_placeAutoDims` PLACES
   them rather than painting them.

2. **The gable, and a window under it.** Movie, 20 Sep, looking at E1 FRONT:
   *"something wrong with the gable/roof area, maybe due to the connection to
   the house"* and *"we should avoid locating a window where a roof will
   interfere with it"*. On this drawing the garage roof runs up into the house
   wall and crosses a second-storey window. Both are open and neither is
   diagnosed; see RD-DOCUMENTS/BOARD-garage-roof-meets-the-house.md.
