# The interior survey — tasks 24 / 25 / 26

Ordered by Commander Devin, 7 Sep, as the read-only step before any interior
implementation: *what stairs/beams/columns machinery exists, what the room
scheme needs, where the seams are.* Same discipline as W1 — the map is ratified
before a line moves.

**Read-only. No product code was touched.** Measured against `main` at
`ce63cc2`.

The task, from the 7 Sep handoff: *"empty the interior to stairs, beams and
columns; then the room scheme; then the predesigned washroom."*

---

## THE HEADLINE: less is missing than the task implies

Two of the three tasks are further along than "not started". The interior is
not empty ground — it is ground with foundations already poured in the right
places, and the survey's main value is saying which.

| | module machinery | page methods | verdict |
|---|---|---|---|
| stairs | 1,230 lines across 3 files | 55 | built, deep |
| beams / columns | in `build-house.js` | 17 | geometry done, interaction on the page |
| room scheme | 781 lines across 3 files | 10 | partition exists, "blessed v1" |
| washroom | vocabulary only | 0 | the naming exists, the UNIT does not |

---

## 24 — STAIRS, BEAMS, COLUMNS

### Stairs are the most finished thing in the interior

    stair-geometry.js   261 lines   16 exports   dependency-free
    auto-stair.js       574 lines    7 exports
    stair-rules.js      395 lines    1 export

Plus 55 methods on MODEL.dc.html. W1 moved `stairEndFor` into
`stair-geometry.js` and left `_stairLevels` on the page deliberately: that file
takes NO Draft dependencies, asking its caller for what it cannot work out, and
building the levels adapter needs both `layer-views` and `level-assembly`.

**That property is the constraint on any interior work touching stairs.** It is
what lets MODEL.html draw a stair at all. Anything that adds a module import to
`stair-geometry.js` costs the second board its stairs.

### Beams and columns already have their geometry in a module

`build-house.js` (307 lines) computes them from the outline and returns plain
data — `midSpanBeams(points, {beamAtFt, maxSpanFt, holes, bearsAt})` gives back
`{ beams, columns }`, and it already reasons about re-entrant corners, joist
spans and free ends.

The 17 page methods are **not** duplicate geometry. Reading them:

    _handleBeamClick    _handleColumnClick   _cancelBeam
    _deleteLastBeam     _deleteLastColumn    _snapPointToBeams
    _snapPointToColumns _centreColumnsOnBeam _activeBeams
    _activeColumns      _syncRailColumn      _rederiveTourBeam
    _stairFloorBeams    _stairBeamGapFt      _stairNudgeOffBeams
    _buildGarageGradeBeam                    _foundationWallsForBeam

Every one is interaction, selection, or a stair↔beam interaction. **The seam is
already clean**: `build-house.js` owns where a beam goes, the page owns how a
drafter touches one. That is the shape W1 spent three PRs producing elsewhere,
and here it exists already.

Three of them — `_stairFloorBeams`, `_stairBeamGapFt`, `_stairNudgeOffBeams` —
are the stair/beam interaction, and they are where task 24 will actually live:
a stair that must clear the beams carrying the floor it cuts through.

---

## 25 — THE ROOM SCHEME

    room-grow.js       516 lines   assignStampNumbers, primaryAllowed,
                                   wcSuffix, growRooms
    room-standards.js  129 lines
    areas.js           136 lines

`room-grow.js` carries a partition its own comment labels **"blessed v1:
slice-packing off the corridor spine"**. So the scheme is not a blank page: it
has a chosen algorithm, a seeding step, and minimums.

The page's ten methods are the tag lifecycle — `_generateRoomTags`,
`_placeRoomTags`, `_growStampedRooms`, `_writeRoomCountsFromTags`,
`_clearRoomTags`, `_toggleRoomAreas`, `_handleRoomTrayPress`, `_activeRoomTags`,
`_autoWindowRooms`, `_toyRoomName`.

`room-standards.js` knows a fixed vocabulary:

    BATH  BEDROOM  CLOSET  DINING  DZ  ENSUITE  HALL  KITCHEN
    LAUNDRY  LIVING  LIVING ROOM  PANTRY  STORAGE  WC

**The open question for 25 is not "how do we partition" — it is answered. It is
what the drafter's input to the partition is**, and that is a design question
for Movie, not a code question.

---

## 26 — THE PREDESIGNED WASHROOM

The first pass of this survey recorded "0 methods, 0 modules, greenfield". That
was wrong and worth recording as wrong: grepping for `washroom` finds exactly
one file in the repo, the handoff naming the task — but the machinery is filed
under other words.

**What already exists:**

- `room-standards.js` knows `BATH`, `ENSUITE` and `WC` as room kinds.
- `room-grow.js` has `wcSuffix(kinds)`, which reads the FIXTURES in a room and
  names it accordingly: `TUB` and `SHOWER`/`STALL` give `/BS`, tub alone `/B`,
  shower alone `/S`. The convention a drafter expects on a plan is implemented.
- `fixture-geometry.js` (170 lines) places fixtures.
- `closets.js` (356 lines) is a worked example of exactly the thing task 26
  asks for — a predesigned interior unit with its own rules.

**What does not exist:** a washroom as a PLACED UNIT — fixtures arranged in a
known layout, dropped as one thing. The naming, the standards and the fixture
placement are all there; nothing composes them.

So 26 is the smallest of the three, not the largest, and `closets.js` is the
pattern to follow rather than a blank sheet.

---

## THE SEAMS, NAMED

1. **`stair-geometry.js` must stay dependency-free.** It is what lets
   MODEL.html draw stairs. Adding an import costs the second board.
2. **`build-house.js` owns beam and column PLACEMENT; the page owns
   INTERACTION.** Do not move interaction into the module or geometry onto the
   page — the split is already correct.
3. **Stair↔beam is the live interaction** and the three methods holding it are
   where task 24's real work is.
4. **The room partition is chosen** ("blessed v1"). Re-opening the algorithm is
   a different, larger task than 25 asks for.
5. **The washroom's vocabulary is filed under WC/BATH/ENSUITE**, not
   "washroom". Anyone grepping the obvious word finds nothing and concludes
   greenfield. This survey did, for its first ten minutes.

---

## WHAT THIS SURVEY DOES NOT ANSWER

One thing, and it is the one that decides task 24's shape: **what "empty the
interior to stairs, beams and columns" means as an instruction.**

It reads two ways — that BUILD HOUSE should place only those three and leave the
rest to the drafter, or that an existing interior should be strippable back to
them. The machinery differs completely between those readings, and nothing in
the code settles it.

That is Movie's to say, and it should be said before anything is built.
