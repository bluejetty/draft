# WORK ORDER — the half-levels are always on the panel, fuzzed until you add one

**Movie, 6 Sep**, over four exchanges, with Gilligan settling where the slots
live. **PRE-TIER 3.** Nothing here is built.

This is the piece the build-type board called *"the one with real work in it"*
and it has been waiting on Movie's sketch since 5 Sep. The sketch arrived as
one sentence and it dissolved the problem rather than solving it.

---

## The house it draws

A storey over the garage on a bilevel is a level, and it sits **between MAIN
and 2ND FL** -- exactly the way ENTRY sits between FOUNDATION and MAIN.

> *"the OVER THE GARAGE is a storey in between main and second floor level.
> like the ENTRY is between the main and foundation levels. but those are only
> added for BILEVEL and MODIFIED BILEVEL"*

Why it needs its own level rather than an ordinary card: a bilevel's garage
sits at ENTRY, half a storey down, so a floor standing on it lands below one
standing on MAIN -- too far for a ceiling to absorb. On a BUNGALOW or 2 STOREY
the garage ceiling is raised until the deck runs continuous with the floor over
the main area, and one ordinary 2ND FL card serves. **The sheathing is the
test**: where one deck can run it is one level, where it cannot it is two.

## The numbering already had room

`SPEC-bilevel-section.md:58` -- *"ENTRY slots into id 2, between FOUNDATION and
MAIN FL."* The defaults are odd on purpose:

    1  FOUNDATION
    2  ENTRY          <- half-level slot
    3  MAIN FL
    4  OVER GARAGE    <- half-level slot
    5  2ND FL
    7  ROOF     8  SITE

Floors on odd, half-levels on even. The gap for OVER GARAGE has been sitting
empty since the numbering was chosen.

## The problem that made this hard, and why it is now gone

**The ids are load-bearing.** `PROJECT.html:287` hardcodes
`ENTRY_LEVEL_ID = 2` and builds its section row from it. But
`MODEL.dc.html:8984` hands out `this.state.nextLevelId`, which starts at **9**:

    const id = this.state.nextLevelId;   // 9, then 10, 11, 12...

So a drafter who pressed + ADD and typed ENTRY would get **id 9**. The Model
Space would draw it perfectly; PROJECT would look for id 2, find nothing, and
show no ENTRY row. Two pages disagreeing about one drawing -- the exact failure
the persisted-format rules exist to prevent.

**Movie's answer removes the allocation entirely:**

> *"we should have those on the page even when not used but have them fuzzed
> out"* ... *"and then a little ADD in the corner of the fuzzed ones"*

The slots are not created, they are **switched on**. So nothing ever allocates
2 or 4; they are constants. The id problem does not get solved, it stops
existing.

## Where a fuzzed slot lives: THE PANEL, NOT THE DRAWING

**Gilligan's question, and it is the one that decides whether this is cheap.**

| | |
|---|---|
| **Only in the panel** | the `levels` list is unchanged; the panel renders two extra rows from a constant; pressing ADD creates a real level at the fixed id. **No format change.** |
| **In the data** | every drawing gains two records that are not levels yet -- and `visible: true` is hardcoded at `drawing-format.js`, so there is no field to carry "fuzzed". A persisted-key change. |

**Panel only.** Three reasons, and the third is the one that matters right now:

1. It is truer to what Movie said. A slot that is not created should not be in
   the file.
2. It keeps the property that makes the design good: ENTRY is *always* 2 and
   OVER GARAGE *always* 4, whether or not they exist. A constant in the panel,
   not a record in the drawing.
3. **A drawing saved before this change and one saved after are byte-identical
   unless a drafter presses ADD.** The serializer never sees a fuzzed slot, so
   it cannot emit one. That makes this safe to land DURING the Write Tier,
   whose entire acceptance is a deep-compare between two serializers. Almost
   nothing else on the pre-tier-3 list has that property.

**And one consequence either way, from Gilligan:** an unbuilt slot must never
reach `_floorLevels()`. That list is what stairs use to work out what descends
to what. A phantom level in it would put a stair between two floors that do not
both exist. Panel-only makes that impossible by construction rather than by a
guard someone has to remember.

### A SECOND reason the fixed id matters, and it is structural

`stairDescent` finds a level's index in the floor list and takes
`floors[idx - 1]` -- **the next floor down, whatever that currently is.** So the
id is not only how PROJECT finds its row; it is what puts the level in the
right place in the stack.

At **id 4**, OVER GARAGE sorts between MAIN (3) and 2ND (5) and a stair
descending from 2ND lands on it correctly. At **id 9** from the counter, it
would sort *after* 2ND and the stair would descend to the wrong floor entirely.
The fuzzed-slot design gets that right by construction; a counter cannot.

### Switching a slot on RE-DERIVES every stair above it

Insert OVER GARAGE and a stair on 2ND stops descending to MAIN and starts
descending to OVER GARAGE: shorter rise, fewer risers, shorter run. **The stair
redraws itself the moment the level appears.**

**That is correct behaviour, not a defect** -- the same mechanism that makes a
stair follow a wall-height change, and what a drafter would want. But it is
VISIBLE: press ADD on one row and a stair somewhere else in the drawing changes
shape, with no other press.

**And it is board #31 again.** The riser maths re-derives fine. What does not
re-run is the check that the stair still FITS. A stair that gets *shorter* is
safe on its own terms, but the one now landing on OVER GARAGE may not line up
with the floor opening that was cut for a full-storey run -- and nothing asks.
Same shape as a floor-height change: flag it, do not silently move it.

## How a drafter gets one

> *"the drafter will need to draw it in at that point if they didn't autohouse
> it from the start"*

**Two paths, and only one of them is this order.**

- **AUTOHOUSE.** Press BILEVEL and the bone builds the entry level in as part
  of the house, populated. **Movie, 6 Sep: that version still needs real work.**
  Not this order -- its own board.
- **By hand.** The fuzzed row is always there. Press its ADD, the level comes
  into existence **empty at its fixed id**, and the drafter draws the walls on
  it themselves.

No auto-insertion after the fact and no guessing what a drafter meant. The bone
builds houses; everything else is drawn. That is the division the app already
has.

**Build the manual path FIRST, and it is not a stopgap.** The autohouse will
end up doing exactly what the ADD button does, without a drafter pressing it --
same slot, same fixed id, same level coming into existence. Building this first
gives the bone something to CALL rather than something to duplicate, and lets
the bilevel autohouse be tested against a level that already works instead of
debugging both halves at once.

## The panel, before and after

    LEVELS                          [DATUM] [+ ADD]
      | 2ND FL
      | OVER GARAGE       fuzzed             [ADD]
      | MAIN FL
      | ENTRY             fuzzed             [ADD]
      | FOUNDATION

The header's `+ ADD` is unchanged -- it still adds an ordinary floor on top,
through `_addLevel()` and the counter. The two new ADDs are per-slot and use
the slot's own id.

## What it touches

| | |
|---|---|
| the `levels` render list | two synthetic rows, in stack order, when the slot is not in the drawing |
| a dim row class | the panel has no dim vocabulary today -- the build row's lamps are the nearest precedent |
| one handler | create a level at a GIVEN id rather than at `nextLevelId` |
| `_addLevel()` | unchanged. A floor on top is still a floor on top |
| a spec | a fuzzed row is not a level: it must not reach `_floorLevels()`, must not appear in a section table, and must not change a saved file |

## The floor package over the garage

**Movie, 6 Sep**, over five exchanges. Joists **19 1/4"**, sheathing **3/4"** --
**20" total**, and that is a DEFAULT: *"they can change after"*, and *"those
joists will likey change depth se we need to make them adjustable because
those will be sized by the engineer"*.

    garage wall   9'-1 1/8"    109.125"   <- DERIVED, not typed
    package                   + 20"
    deck                        129.125"  = 10'-9 1/8"

This SUPERSEDES the `10'-5 5/8"` in `project-page.js:240`, which named this
same deck off a **16 1/2"** floor before the package was ruled. The comment
there is not wrong about why the garage wall went up a precut rung -- a 7'-0"
overhead door needs `OPENING_HEAD_DROP_IN` above its head either way -- only
about where the deck lands.

### Which end is anchored

> *"the bottom will need to go deeper it if goes from 19.25" to 23.25""* ...
> *"and the garage ceiling gets less height"*

**The deck is the stored fact and the garage wall is derived from it.** The
floor above stays put, the joists grow downward, the garage ceiling loses
the height.

Which puts a value on the wrong side of the line today. `GARAGE_WALL_FT`
(`project-page.js:249`) is a 9' precut measured UP FROM THE SLAB, and
`PROJECT.html:1355` gives the drafter a cell to type it into. Under this rule
a garage carrying an OVER GARAGE level must not read that cell: it is
`deck - package`, recomputed, every time. Keep it stored and an engineer's
depth change leaves a number on the page that contradicts the drawing --
the same shape as the stair's stale `riseFt` and the detached offset that is
stored and never read.

The door head needs no wiring at all. `PROJECT.html:747` already derives it:

    get: v => v.garage.wallHeightFt - projectPage.OPENING_HEAD_DROP_IN / 12

so it follows the wall down on its own.

### The limit is the door, and the drafter designs around it

> *"the user will need to take the door limitation height into consideration
> for thier design"*

An engineer's 23 1/4":

    deck             129.125"
    23 1/4" + 3/4"  -  24"
    garage wall      105.125"  = 8'-9 1/8"   (no longer a precut)
    door head        - 16 1/2"
                      88.625"  = 7'-4 5/8"   clears 7'-0" by 4 5/8"

At a **27 7/8"** joist the head lands exactly on 7'-0" and a 7'-0" overhead
door stops fitting. That is a LIMIT THE PAGE SHOWS, not a clamp it applies:
house rule #313 -- software never moves geometry, only a drafter's press may.
`proto/section-table-harness.js:306` already makes this check against the
DEFAULT wall; the sibling that does not exist yet is the same check against a
wall derived from a deck.

### The two levers, when they cross it

> *"they will need to move the grade beam or frost wall top down (and grade)
> move the house up"*

**Drop the garage foundation.** `zoneHeights.zones.attachedGarage.offsetFt` is
the typed cell and `MODEL.dc.html:11971` reads it, so one number moves the
concrete top; grade follows without a second entry, since every garage
foundation tops out 14" above grade (`cut-view.js:64`, `:71`, `:77` -- three
constants, one fact). Recovering the 4" lost at 23 1/4" puts the wall back at
9'-1 1/8" and the head at 7'-8 5/8", and takes the garage floor AND the grade
at the garage down 4" with it -- an apron and a driveway, which is site work
rather than a drawing change.

The two options named are the only two that exist:
`GARAGE_FOUNDATIONS.attachedGarage` is `['gradebeam', 'frostwall']`. A
thickened edge is detached-only.

**Or move the house up**, spending the same 4" on the house's own grade
instead. Which is cheaper is a question about the LOT, so the drafter picks.

`GARAGE_SILL_BELOW_HOUSE_FT = 2` is what that cell derives from, and its
comment is what makes this land without new plumbing: measured *"sill to
sill, not floor to floor, so it holds when the floor package changes"*.

### The rest of the storey

**The front 4 ft of the garage stays out of it**, with a lower roof over the
strip -- so the level's outline is the garage footprint less a 4 ft band at
the door end, not the footprint.

**The adjustable depth needs no new joist type.** `level-assembly.js:41`
already carries `{ id: 'owj', label: 'OWJ', depthIn: null }` -- the open-web
joist whose depth is entered by hand, which is exactly the engineer's case.

## Open, and both are Movie's

- **What "fuzzed" looks like.** Opacity, or the lamp treatment the build row
  uses for a thing that can exist but does not yet. A taste question.
- **Whether a half-level can be added where its type does not apply** -- an
  ENTRY on a bungalow, say. The panel-only design permits it; nothing says
  whether it should. Not blocking: the answer can be a guard added later
  without moving anything.
