# SPEC — the bilevel and modified bilevel section

Everything Movie said about how a split is built, on the evening of 5 Sep,
while band 2 of the PROJECT page was being scoped. Written down because none
of it exists anywhere else: not in the code, not in the boards, and not
reliably in his ArchiCAD drawings, which he warned are "probably different
than what we want" and carry at least two lines that are not to scale.

**The rule for reading his PDF, in his words: the drawing is the SHAPE, our
numbers are the SIZES.** Two dimensions on it are wrong -- the wall fill is
drawn 3'-0" when it should be 4'-2 3/4", and the error carries up the stack.
Measured against the linework, the footing (8"), the pour and sill
(5'-1 1/2") and both floor packages (1'-0 5/8") land exactly on our numbers,
so the parts that are to scale confirm each other.

---

## The stack, bottom-up

```
footing
5'-0"      CONCRETE POUR          SPLIT_BASE.fdnWallHeightFt
1 1/2"     SILL PLATE             SILL_PLATE_IN
4'-2 3/4"  WOOD FILL WALL         HALF_STUD_IN + PLATE_STACK_IN
9 1/4"+3/4"  ENTRY FLOOR          2x10 and ply -- NOT the main floor's package
           (wall)
11 7/8"+3/4" MAIN FLOOR           the house's own assembly
9'-1 1/8"  MAIN FL WALL           SPLIT_WALL_FT, the precut above the bungalow's
```

The pour is short and the wall makes up the difference: 5'-0" of concrete plus
4'-2 3/4" of studs reaches the same bearing line a bungalow reaches with
8'-0" of pour. That is the whole difference between the two sections, and it
is why `buildWallSection` grew a fill wall rather than the page growing a
second painter.

## ENTRY is a LEVEL, and it gets a card

**A bilevel's levels are FOUNDATION, ENTRY, MAIN FLOOR. A modified bilevel
adds 2ND FLOOR.** Movie, 5 Sep. Each gets a card in the Model Space sidebar
the same as any storey.

This entry is written twice because it was wrong the first time, and the
wrong version is worth keeping. Movie also said *"the entry floor should be
on the 'main level' on the floor plan but will actually be dropped that
amount on the elevation"*, and that was read here as making it a ZONE -- an
area of the main level sitting lower, like the garage. It is not. That
sentence describes where it is DRAWN, which is a sheet convention, not what
it is. A garage is genuinely a patch of the main level: no rooms, no stairs,
an attached box. An entry level has rooms, people live on it, and a flight
runs up out of it.

The proof is in the level ids, which were spaced before any of this came up:

    8 SITE   7 ROOF   5 2ND FL   3 MAIN FL   1 FOUNDATION

The gaps at 6, 4 and 2 leave room for levels between the ones that exist,
and ENTRY slots into **id 2**, between FOUNDATION and MAIN FL.

Said carefully, because the satisfying version is not checkable: those ids
landed on 27 Aug in PR #139, nine days before any of this came up. Whether
they were spaced deliberately for insertions or numbered in twos out of habit
is a claim about a decision, and the boards' own rule is that those cannot be
verified. What IS checkable is that the gap exists and ENTRY fits it.

**id 4 is OVER GARAGE** (Movie, 5 Sep), for the case he raised of a two-storey
bilevel wanting both a storey over the garage and one over the house. Named
for what it sits on rather than as a variant of the floor above it, because
what it sits on is what makes it lower.

Two things follow, and they agree with the rest of the app. A plain BILEVEL
has no 2ND FLOOR, which `upperStud` and `upperJoists` already say by being
typed to `['house', 'modifiedBilevel']` only. And a MODIFIED BILEVEL's 2ND
FLOOR is the storey over the garage, which is why it sits LOWER than a
house's second floor: it stacks on a dropped garage rather than on the main
floor.

Its joists **bear on the frost wall's sill plate**. Its package is 2x10 plus
3/4" ply, deliberately not the main floor's 11 7/8" I-joist -- sharing that
field would draw it 2 5/8" too deep and look entirely plausible.

## Where the two floors overlap, and where they do not

**They overlap 3 1/2" at the edges**, and the overlap is structural: either
the wall in it carries both floors, or it conceals a beam carrying the upper
one. A butt joint at the zone edge draws cleanly and is wrong -- Movie:
*"it might be one that nobody would notice."*

**They overlap under the exterior wall too.** This is what makes a wall
section of a bilevel look the way it does: cut at the exterior wall, BOTH
floors land on it at their two heights. Two floor packages with a wall
between them, which is exactly what his PDF shows and what was misread here
as a storey below the datum.

**There is no overlap at the stairs.** That is the opening the flight passes
through, so the overlap is an edge condition interrupted by the stairwell --
which means a section cut through the stairs shows no overlap and a section
cut beside it does. Band 2 has to pick one and say which.

## The front wall is a different condition

**The front wall, with the entry door, sits on the 2x10 entry floor** -- it
bears on the floor, not on the foundation. So a bilevel has at least two
typical exterior wall details, and one section cannot be captioned as
covering both.

## What sits above

The MODIFIED BILEVEL's storey over the garage is **lower than a true second
floor would be**, because it stacks on a dropped zone: the garage floor is
down, so everything above it starts lower. That falls out of the zone offset
rather than needing a rule.

In plan, **the second-floor balcony and the storey over the garage are dashed
on the main floor and drawn solid on the second** -- the ordinary convention
for what is above you.

## Why the garage lines up

On a bilevel the garage sill is **level with the house sill** (Movie, 4 Sep,
"95% inline"; on a bungalow, "95% not inline"). The reason surfaced on 5 Sep:
**the entry level is the level you walk into the garage from.** They line up
because you step across rather than up or down.

Note the datum trap in that sentence: sill-to-sill level does NOT mean
floor-to-floor level. The garage slab sits 4" below the top of its concrete,
which is 5 1/2" below the top of its sill, while the entry floor sits ABOVE
the same sill. Level sills, floors about 15 1/2" apart.

## Types that do not exist yet, and the level they do NOT need

Movie, 5 Sep: *"later on we should actually make a 2 storey bilevel and also
a 2 storey bungalow with a 2nd floor over the garage."* Neither is being
built. They are recorded because working out what they need took three
attempts here, and the answer is: nothing new.

| type | levels |
|---|---|
| modified bilevel | FOUNDATION · ENTRY · MAIN · 2ND FL |
| two-storey bilevel | FOUNDATION · ENTRY · MAIN · 2ND FL |
| bungalow, storey over the garage | FOUNDATION · MAIN · 2ND FL |

**One upper level, called 2ND FL, in every case.** A storey over the garage
lines up with the storey over the house -- Movie: *"the 2nd floor has to line
up with the over garage floor in that situation"*, and on a bungalow
*"[it] would be called 2nd floor because they would line up"*. Things that
line up are one level.

This file proposed a separate OVER GARAGE level at id 4 twice before landing
here, and both times for the same reason: naming a level after **what it
stands on** rather than **where it sits**. The garage storey stands on the
garage and sits at the second floor. Where it sits is what a level is.

So the rule is short: **a level exists when two things need different
heights.** None of the three types produces that above MAIN FL.

What DOES change is the stair. Movie: *"the bilevel will have more stairs up
to the higher up 2nd floor"* -- the flight starts from a lower entry, so it
takes more risers to reach the same 2ND FL. A bilevel's difference is
entirely below MAIN FL: the shorter pour, the fill wall, the entry level.
Above it, only the stair.

## Still unknown

- The height of the wall between the entry floor and the main floor. His PDF
  says 5'-1 1/8" but the fill wall below it is drawn short, so the number
  above it cannot be trusted. **Needs Movie.**
- Where the stringer starts and lands. Drawn on his section as two parallel
  diagonals with a small foot, no treads.
- Which of the two exterior wall conditions band 2 should show.

