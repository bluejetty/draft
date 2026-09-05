# SPEC — lintels and the head of an opening

Worked out with Movie on 5 Sep, from his practice and the National Building
Code sitting in `RD-DOCUMENTS/BUILDING-CODES/`. **Nothing here is built yet.**

It started as one question — how far below the top plate should a head sit —
and the answer turned out to be a stack, a threshold, and one finding that says
the office default garage cannot be built as drawn.

## The office rule, in two lines

Movie:

> *"Anything under 6 ft span is a 2 ply 2x10 lintel; anything over is 11 7/8"
> engineered LVL."*

| span | lintel | depth |
|---|---|---|
| <= 6'-0" | 2-ply 2x10 | 9 1/4" |
| > 6'-0" | 11 7/8" LVL | 11 7/8" |

**The 6 ft threshold is where the code's sawn table runs out.** NBC Table
9.23.12.3.-A, roof + ceiling + 1 storey, gives a 2-38x235 (2-ply 2x10) about
2.04 m -- 6'-8". Past that there is no sawn answer in the table, which is
exactly where the office switches to engineered. His rule of thumb and the
table's edge are the same line.

## The head stack

Top of wall downward:

    2 TOP PLATES        3"        two, not one -- see below
    LINTEL              9 1/4" or 11 7/8"
    RO PLATE            1 1/2"    the rough-opening plate under the beam
    ------------------------------
    <= 6 ft             1'-1 3/4"
    >  6 ft             1'-4 3/8"

**The default is 1'-4 1/2" for everything.** Movie: *"we should make the deep
1'-4 1/2" lintel default... will cause less problems."* That is the deep stack
rounded up an eighth, applied to every opening rather than branching on span.
One number, slack in the safe direction, and a drawing that never asks the
framer to work it out.

    head = wall height - 1'-4 1/2"

On the 8'-1 1/8" precut that puts the head at 6'-8 5/8", so a 6'-8" door clears
by 5/8".

## Two top plates, and it was tried the other way

`PLATE_STACK_IN` is `1.5 * 3` because the top plate is doubled so the second
laps the joints in the first. Over an opening, Movie tried letting the lintel
do that lapping job and carry a single plate:

> *"I tried to put one top plate over a lintel (with lintel acting as bottom
> plate for the security lapping) but the building inspector wants 2 top plates
> so let's go 2 to be safe."*

Recorded because it will be tried again -- it is cheaper and it looks
sufficient. The file should say it was tried and refused, not merely that the
rule is two.

## Bearing is 1 1/2" or 3", by span

NBC note (4) to Table 9.23.12.3.-A:

> *"For ends of lintels fully supported by walls, provide minimum 38 mm bearing
> for lintel spans up to 3 m, or minimum 76 mm bearing for lintel spans greater
> than 3 m."*

**76 mm is 3"** -- Movie's own bearing figure, arrived at independently. But it
is not flat: 1 1/2" under 3 m (9'-10"), 3" over. A 16'-0" garage door is over.

That refines the corner rule discussed the same day. At an interior corner the
opening must stay back by the intersecting wall's thickness plus the bearing:
**8 1/2"** for a 2x6 wall on a long span, **7"** on a short one, and 16 1/4"
against an ICF wall (`icf_13`, 13 1/4").

`_clampOpeningToWall` already reserves a jamb at each end and already returns
null when the wall is too short. Its `JAMB_FT` is 0.01 -- an eighth of an inch,
effectively nothing. The bearing rule goes there, and all ten of its callers
inherit it. **It re-clamps on load** (`MODEL.dc.html:5356`, `:13985`), so
raising it slides existing openings inward and drops any on a wall shorter than
`width + 2 x bearing`. Correct, but it changes drawings people already made.

## THE FINDING: the garage wall cannot be the house's

    garage wall (8'-1 1/8" precut)     97 1/8"
    7'-0" garage door head             84"
    room above the head                13 1/8"
    needs 2 plates + 11 7/8" LVL       14 7/8"
    SHORT BY                            1 3/4"

`SECTION_TABLE_DEFAULTS.attachedGarage` sets `fdnWallHeightFt` and
`slabThicknessIn` and nothing else, so `mainWallHeightFt` falls through to
HOUSE. The schedule reads "Garage wall height 8'-1 1/8"", and **a 7'-0" garage
door cannot be built under it.**

This is the FOURTH garage row to take a house number for want of one of its
own, after the 3" slab, the basement wall under a garage, and the 11 7/8"
joists that should be 20". They keep arriving because the fallback is silent: no
default means HOUSE, and HOUSE is always plausible.

Movie: *"good thing the garage is usually taller walls than the house."* So the
default is simply wrong, not merely missing. The 9'-1 1/8" precut gives a
7'-8 5/8" head -- 8 5/8" of cripples over a 7'-0" door.

**Three independent reasons now point at a taller garage wall**: this one, the
storey-over-the-garage deck needing 10'-5 5/8", and *"lots of bungalows have
extra space there."*

## The beam in the roof, where the roof allows

Movie: *"the LVL can be built into the roof, especially if it's a gable roof."*

With the beam up in the gable rather than under the plates, the wall keeps its
8'-1 1/8" and the head can reach 7'-8 5/8" -- a 7'-0" door with 8 5/8" of
cripples.

**Only on a gable end.** On an eave wall the trusses bear on that plate and
there is nowhere for the beam to go.

Movie, on the mechanism: *"if it's a gable wall they could put the last truss
behind the 2x6 gable wall and they could build the lintel into it."* The end
truss shifts inboard, the gable wall stands proud of it, and the beam occupies
the space that leaves. Not being built -- *"let's not worry about it now"* --
written down because it is the difference between "the beam goes in the roof
somehow" and a thing somebody could draw. The bone knows which face a garage door is
on (`garageDoorPlan` takes a face list), so it could tell the difference, but
that is real work. Default to the arrangement that always works and let the
drafter raise the beam where the roof allows -- the same shape as ROOF HEEL.

## Under the lintel: a little wall, or nothing

Movie: *"put the extra little wall below if there is extra, or the 2x6 stud if
there is no extra."*

With the beam drawn tight under the floor above (his choice: *"we should draw
them all under the floor above"*), what is left between the lintel and the head
is filled:

| | gap below the lintel | what goes there |
|---|---|---|
| window, 6'-8" head, 2-2x6 | 8 5/8" | a little stud wall |
| man door, 6'-8" head, 2-2x8 | 6 7/8" | a little stud wall |
| garage door, 7'-0" head, 2-2x10 | 7/8" | nothing fits, not even a 2x6 flat |

Worth noticing that his two constructions -- beam under the floor above, and
beam sitting on the door -- **converge on a garage door**, because there is
under an inch between them. Which is why drawing them all one way costs nothing:
it is a drawing convention, not a structural choice, and it buys one rule (the
lintel's top is always 3" below the top of the wall) instead of asking which
contractor is on the job.

## Why this is worth the app's attention at all

Movie, on whether a drawing of his ever shipped with this clash:

> *"I think I might have caused this problem for somebody but they never told me
> about it if it did happen."*

Probably nobody did. A framer who finds the head 3/4" tight drops the door,
raises the plate, or slides the beam into the gable and carries on; it is a
field adjustment, not a callback. And on the specific case of the LVL, Movie's
own answer is likely the right one: *"maybe the roof engineer caught it, since
the lintel is engineered they could have moved it up."*

Which is the useful principle. **The engineered member gets a second pair of
eyes by definition; the ordinary ones do not.** Nobody stamps the bearing at a
corner, the doubled top plate, or the head height on a stock door. That is
where a quiet drawing costs somebody something, and that is where this app
should spend its carefulness -- not replacing the engineer, but handing him a
drawing that is already consistent.

## Still to settle

- **The RO plate at 1 1/2"** is read here as a 2x laid flat. Confirm.
- **Whether any row should inherit a wall height at all**, given four garage
  defaults have now gone wrong the same way.
- **Floor-carrying spans.** Everything above is roof and ceiling. A garage door
  under the storey over the garage carries a floor, and the NBC sawn table has
  no 16 ft answer for that at any depth -- it is engineered by necessity, and
  whether 11 7/8" is enough there is a manufacturer's question, not this file's.
