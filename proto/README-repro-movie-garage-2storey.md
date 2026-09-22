# proto/repro-movie-garage-2storey.draft

Movie's own drawing, saved off the live site 21 Sep 2026 at 17:58
(`e7cb90ae-20260921T1758.draft`) and kept byte-for-byte as uploaded. It is the
drawing in the screenshots behind `BOARD-three-from-the-elevations.md`, so the
elevations a probe paints from it are the ones he was looking at.

## What it is

    levels         5      SITE, ROOF, 2ND FL, MAIN FL, FOUNDATION
    walls         24      roofs      2      floors    5
    fenestrations 24      outlines   4      dimensions 92
    fixtures       0      groups     0      stairs     0

Two storeys over a foundation with an attached garage. **Roof 68 has eight
edges, all eave** (the house, an L or a T in plan); **roof 69 has four, one
gable** (the garage). That gable is worth knowing about: `extendRunsToEaves`
grows a run only against an EAVE edge, so nothing about the fascia-end fix
touches roof 69's gable end by construction.

## Why it was kept

It carries all three of the 21 Sep elevation reports in one file, so they can
be measured against the drawing that produced them rather than against a
repro that merely resembles it:

1. **A second line on the garage roof line.** E1, at the left end of the
   garage band: a `w 1` stroke at the SHADOW's height (0.00" above it, not the
   5.5" the fascia top sits at) running `u -6.0..-4.0` -- a two-foot stub
   lying on top of the heavy roof line. Measured identical on this file
   before and after the fascia-end fix (`2822e0b`), so it is **pre-existing
   and not a regression from it**.

2. **A window too close to the roof line.** Movie: *"the window should be
   about 4\" over the roof line"*.

3. **The garage-to-house junction.** Movie: *"where the garage hooks into the
   house the foundation, main floor and 2nd floor should connect all the same
   (1ft in from corner)"*.

## The garage band, per elevation, as painted today

    E1   u  -6.0 ..   4.0    base e 8.102
    E2   u  38.0 ..  48.0    base e 8.102
    E3   u -22.0 .. -20.6    base e 8.577      <- 1.4 ft, and at a DIFFERENT base
    E4   u -48.0 .. -38.0    base e 8.102

**E3's band is the odd one and no defect is claimed for it here** -- it is a
1.4 ft sliver at a base 5.7" above the other three, which is what the garage
seen nearly edge-on could legitimately look like. Recorded so the next reader
starts from the measurement rather than from the screenshot.
