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

## The front wall is a different condition, and it is a TALL WALL

**The front wall, with the entry door, sits on the 2x10 entry floor** -- it
bears on the floor, not on the foundation. So a bilevel has at least two
typical exterior wall details, and one section cannot be captioned as
covering both.

**It is also over 12'-0", so it is engineered.** Movie, 5 Sep: *"the bilevel
near the entry wall will probably need a TALL WALL."* Every number in it was
already pinned, so this is arithmetic rather than a judgement:

| | |
|---|---|
| wood fill wall | 4'-2 3/4" |
| + MAIN FL package | 1'-0 5/8" |
| - ENTRY package | 0'-10" |
| **= ENTRY sits below MAIN FL** | **4'-5 3/8"** |
| + MAIN FL wall (the 9'-1 1/8" precut) | 9'-1 1/8" |
| **= FRONT ENTRY WALL** | **13'-6 1/2"**, stud 13'-2" |

Over the threshold by 1'-6 1/2", and structural -- it carries the main floor's
top plate and the roof over it. Both halves of the definition, so it needs an
engineer. See DEFINITIONS.md, TALL WALL.

**The assumption to check is not the heights, it is the interruption.** The
figure above runs the wall unbroken from the entry floor to the main floor's
top plate, which is what makes a bilevel foyer open to above and what puts the
tall window in the front elevation. Stopping it at the main floor deck instead
gives 4'-5 3/8" and something entirely ordinary. So nothing here is unusually
tall; the wall is simply never cut.

**This is routine, and the first draft of this entry got that wrong.** It said
our defaults "produce an engineered wall" as though that were a problem the
numbers had backed us into. Movie: *"they will just need an engineer and get
engineered wood studs that are straighter, and the tall walls will be
straight."*

So the outcome is a better wall, not a worse one. Engineered studs come out
straighter than sawn lumber, and that matters here more than anywhere else on
the house: a foyer wall is long, flat, uninterrupted and lit sideways by the
window in it, which is exactly the condition that shows a bow. The height that
forces the engineer also gets you the stud that makes the wall worth looking
at.

What stays true is only the flat fact: **every modified bilevel on our
defaults has one.** Not an exotic plan or a big house. Unlike the garage
ceiling, which stays under 12'-0" by choosing to, this cannot be chosen away
short of interrupting the wall -- and interrupting it is what you would be
giving up the open foyer to do.

**What the engineer stamps is the OPENING, not just the wall.** Movie: *"the
engineer will stamp the construction method for the opening."* Which puts the
interesting part exactly where this wall's whole reason for existing is -- it
holds the entry door and the tall window above it, and a large opening in a
13'-6 1/2" structural wall is the condition that needs designing. Header,
jambs, how the load gets around the hole: that method comes back stamped
rather than out of our details.

So this is the one place in the section where **we draw the hole and somebody
else specifies how it is framed.** Everywhere else on the drawing the two are
the same job.

**The app draws it like any other wall today**, and that is fine, because the
gap does not get closed by the section. Movie: *"I can make some generic tall
wall notes later that an engineer can modify to his reqs."*

That is the right shape and it settles what was left open here. The drawing
does not have to know the threshold or derive anything -- it carries a
boilerplate note block that says what a tall wall is and how its opening is
built, and the engineer edits it to his requirements and stamps it. Ours is a
starting point for somebody else's document, which is the same relationship as
a DEFAULT and a drafter's TYPICAL, one step further out.

**And the tall wall gets a SECTION of its own.** Movie: *"there will need to
be a separate section for a tall wall in the plan, in the section area... it
will be a section they can make and add an annotation."* So it is not a
condition band 2 has to fold into the typical wall section -- it is another
drawing, made by the drafter in the section area, carrying the note block.
That is consistent with the front wall being a second exterior condition
anyway: one section cannot be captioned as covering both, and this says which
way the split goes.

**That section shows STUDS AND BEAMS, which no view we have draws.** Movie:
*"the engineer usually likes to see the studs and beams drawn into that -- I
might have to figure something out later."* Worth writing down now because it
is a different KIND of drawing, not a variant of one we already make. Our
typical section is a cut: it shows what a saw would pass through, once, and
every stud in the wall collapses to the one the cut happens to hit. An
engineer checking a tall wall wants the members themselves -- each stud, the
header over the opening, the beams -- which is an elevation of the framing,
laid out along the wall rather than across it.

So the framing is not hiding in the section waiting to be turned on. Nothing
in the app currently knows where an individual stud is.

**Owner: Movie, later.** Not the typical section's problem, not blocking
band 2.

## The wall between ENTRY and MAIN is derived, not chosen

This was on the "still unknown" list. It should not have been: the stack
already fixes it, because **the fill wall and the entry joists land on the same
sill plate and both reach the main floor's bearing line.**

    ENTRY -> MAIN wall  =  wood fill wall  -  ENTRY floor package
                        =  4'-2 3/4"  -  0'-10"
                        =  3'-4 3/4"

It checks out against the drop computed the other way: 3'-4 3/4" plus the main
floor's 1'-0 5/8" package is 4'-5 3/8", which is where the entry floor sits
below MAIN FL.

**3'-4 3/4" is not a ceiling height, and reading it as one is the trap.** It
looked absurd at first -- no habitable storey has a 3'-4 3/4" wall -- which is
what kept it on the unknown list. But ENTRY is a LANDING, not a storey. You
come in the front door onto it, then go up half a flight to MAIN or down half
a flight to the lower level, and 4'-5 3/8" is exactly that half flight. The
number is the exterior wall segment BETWEEN two floor packages, which is the
"two floor packages with a wall between them" this file already describes at
the exterior wall.

Above the landing there is no ceiling at all: the foyer is open to the main
floor. That is the same fact as the front wall running unbroken to 13'-6 1/2",
seen from the inside.

### The PDF wins this one, measured

The derivation above is WRONG, and the drawing says so. Written out rather than
quietly corrected, because the mistake in it is instructive and because the
right answer arrived by measurement rather than by asking.

His section dimensions this wall 5'-1 1/8"; the derivation says 3'-4 3/4". That
was left open on the grounds that the sheet carries a known bad dimension
elsewhere. It does not cover this one -- that error runs the other way and is
1'-2 3/4", a different number -- so the PDF's vector geometry was read directly.

**Scale, from four dimensions that agree to 0.3%:**

| dimension | measured | implies |
|---|---|---|
| 8'-1 1/8" wall | 88.4 pt | 0.9102 pt/in |
| 1'-0 5/8" floor | 11.5 pt | 0.9109 pt/in |
| 2'-8" | 29.2 pt | 0.9125 pt/in |
| 2'-4" | 25.5 pt | 0.9107 pt/in |

**The 5'-1 1/8" text is where it claims to be.** At 0.9109 pt/in it should span
55.7 pt, and the gap between the two lines it sits between measures 55.7 pt. Its
own text centres at y=314.5; that span's midpoint is y=314.15. And the span sits
directly under the 1'-0 5/8" main floor package, which sits directly under the
8'-1 1/8" main floor wall. It is the ENTRY -> MAIN wall, drawn to scale, and it
means it.

**Why the derivation failed, and it is one word.** Movie: *"the entry floor
9 1/4" joists sit on the FROST WALL sill plate."* That was read as the sill the
fill wall stands on -- the house foundation. A frost wall is a different, deeper
wall. Take the PDF's number and the arithmetic says so outright:

    ENTRY bears at  -(12 5/8" + 5'-1 1/8" + 10")  =  -6'-11 3/4" from MAIN
    fill wall base                                =  -5'-3 3/8" from MAIN
    entry bearing is 1'-8 3/8" BELOW the fill wall base

Which is exactly the disputed gap, arrived at from the other end. The two floors
do not share a sill; the entry floor bears 1'-8 3/8" lower, on its own frost
wall. The PDF agrees -- below the entry floor it dimensions 2'-8" and then
2'-4", a frost wall and its footing.

So Movie was right, his drawing was right, and the sentence was right. The
reading of it was wrong.

**Band 2 still draws 3'-4 3/4", knowingly.** `buildWallSection` stacks each floor
on the wall below it and has no way to say "this floor bears on a different wall
that goes deeper." Feeding it 5'-1 1/8" today would draw the entry floor
floating 1'-8 3/8" under the fill wall's base -- a correct number in a broken
picture, which is worse than a wrong number in a coherent one. The frost wall
has to exist in the model first. The card on the page says so, and the test
pinning 3'-4 3/4" is there to fail loudly on the day it changes.

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

## Types that do not exist yet, and when a garage storey needs its own level

Movie, 5 Sep: *"later on we should actually make a 2 storey bilevel and also
a 2 storey bungalow with a 2nd floor over the garage."* Neither is being
built.

| type | levels |
|---|---|
| modified bilevel | FOUNDATION · ENTRY · MAIN · 2ND FL |
| bungalow, storey over the garage | FOUNDATION · MAIN · 2ND FL |
| **modified bilevel with a 2nd floor** | FOUNDATION · ENTRY · MAIN · **OVER GARAGE** · **2ND FLOOR** |

**The test is whether the garage storey can reach the house's second floor.**
Movie: on a bungalow *"[it] would be called 2nd floor because they would line
up"*; on the bilevel *"the modified bilevel with 2nd floor needs OVER GARAGE
and 2ND FLOOR"*.

And he confirmed it directly rather than leaving it to be inferred: *"the
2ND FLOOR won't line up with the lower down 2nd floor in the bilevel."* The
reason is the garage's own height -- a bilevel's garage sits at the ENTRY
level, a half-storey down, so a storey standing on it lands below a storey
standing on MAIN.

**On a bungalow they are MADE to line up, which is not the same as lining up.**
Movie: *"a bungalow is usually deeper so the second floor higher... or the
garage ceiling will need to get higher to fill in the extra"*, *"the garage
ceiling higher in the bungalow, so it will align the 2nd floor."*

The chain runs from the pour. *"The bungalow foundation is 8ft deep, the
bilevel is 5ft, determining grade depth."* Two things come off that one
number:

- **Grade.** Grade sits a fixed distance below the top of the concrete
  (GRADE_BELOW_CONCRETE_IN, 1'-2"), so a deeper pour buries more wall. A
  bungalow's 8 ft puts the whole basement under ground. A bilevel's 5 ft
  leaves the wood fill wall standing above it -- which is exactly where the
  lower level gets its windows, and why the fill wall exists at all.
- **How high the second floor lands.** The bungalow's floors start on top of
  8 ft of concrete rather than 5, so its second floor ends up above where a
  storey on a standard-height garage reaches. The garage ceiling is raised
  until the two meet.

**The test of "lining up" is the sheathing, not the elevation.** Movie: *"the
3/4" ply floor will be continuous through the bungalow -- 2nd floor over the
garage and over the main floor areas."* One deck runs across both. That is
what makes them one floor and not two floors at a similar height, and it is
falsifiable in a way "close enough" is not: if a single sheet cannot run
across, they are separate levels no matter how near they sit.

**So the garage ceiling is derived, not typed.** An earlier draft of this
paragraph said the drafter "has a number to set". That is backwards. On a
bungalow with a storey over the garage there is exactly one ceiling height
that lands the deck flat, and the app knows it -- the same `stored ??
derived()` contract as ROOF HEEL. Derive it so the ply is continuous; let it
be overridden by someone who wants otherwise.

On a bilevel the same gap is a half-storey, too much for a ceiling to absorb,
so the two floors stay apart and keep levels of their own -- with more stairs
between OVER GARAGE and 2ND FLOOR. Movie, naming it: *"2ND FLOOR only for the
bungalow; OVER GARAGE and more stairs up to 2ND FLOOR in a bilevel."* Where
one deck can run it is one level; where it cannot it is two.

A plain modified bilevel needs only 2ND FL, because its garage storey is its
only upper floor -- nothing for it to fail to line up with.

### OVER GARAGE: 20" joists, and a ceiling height that falls out of them

Movie, 5 Sep: *"the joist depth over the garage we should make 20" deep...
default... and allow them to adjust."*

A house floor lands on an interior wall every dozen feet. A garage has none to
land on, so the 11 7/8" that works over a bedroom will not cross a double bay.
This is the third garage row that would have silently taken a house number if
nobody named one -- after the 3" slab and the basement wall under a garage --
and it is the worst of the three, because 11 7/8" over a garage draws
perfectly and does not stand up.

With the 20" joist named, the garage ceiling stops being a guess. Everything
in the chain is already known, so there is one height that lands the deck:

| | |
|---|---|
| MAIN FL wall (bungalow precut) | 8'-1 1/8" |
| house 2nd floor package | 1'-0 5/8" |
| **top of 2nd floor sheathing** | **9'-1 3/4"** |
| garage floor (house sill, less the 2'-0" drop) | -3'-0 5/8" |
| garage floor to that deck | 12'-2 3/8" |
| OVER GARAGE package (20" + 3/4") | 1'-8 3/4" |
| **=> GARAGE WALL** | **10'-5 5/8"** (stud 10'-1 1/8") |

**The raise is 2'-4 1/2".** A garage on the ordinary 8'-1 1/8" wall would put
its deck at 6'-9 1/4", well under the house's 9'-1 3/4". That gap is what
Movie means by *"fill in the extra"*, and part of it is the deep joist paying
for its own span.

**The height is the point, not a symptom.** 10'-5 5/8" was put to Movie as
the thing to check first, on the grounds that its 10'-1 1/8" stud is past the
tallest precut we carry (9'-8 5/8"). He took it the other way: *"10 garage
wall nice... even more is nice too... lots of bungalows have extra space
there."* A garage under a storey is a garage people store things in, and the
height is wanted. So the stud being ordered rather than pulled off the pile
is a cost of the type, not evidence the arithmetic is wrong -- and nothing
here should clamp the ceiling to a precut.

**It is not a TALL WALL, and that phrase was used loosely here before Movie
caught it.** A tall wall is a specific thing: a STRUCTURAL wall over 12'-0", which needs an
engineer. This one qualifies on the structural half -- it carries a floor and a
roof -- and fails on the height, which is the only reason it is ordinary. At
10'-5 5/8" this one is under the threshold and framed like any other. But
*"even more is nice too"* points straight at that line, so a drafter raising
this ceiling past 12'-0" leaves what the app knows how to draw. See
DEFINITIONS.md, TALL WALL.

**This entry was rewritten three times.** It proposed OVER GARAGE for the
bungalow (wrong -- named for what it stands on rather than where it sits),
then abolished it entirely (wrong -- over-corrected, and the bilevel case
does need it). The rule underneath survived all three: **a level exists when
two things need different heights.** What kept changing was which types
actually produce that, and the answer is one of them.

And the stair varies separately from any of this. Movie: *"the bilevel will
have more stairs up to the higher up 2nd floor"* -- the flight starts from a
lower entry, so it takes more risers to reach the same floor.

## Still unknown

- ~~The height of the wall between the entry floor and the main floor.~~
  ANSWERED by measuring the PDF: **5'-1 1/8"**, and the entry floor bears
  1'-8 3/8" below the fill wall on its own FROST WALL. Band 2 still draws the
  old derived 3'-4 3/4" because the section has no frost wall to bear on yet --
  see "The PDF wins this one, measured".
- **NEW, and it blocks the number above:** the entry floor's frost wall. The
  PDF dimensions 2'-8" and 2'-4" below the entry floor. Whether those are the
  wall and its footing, and how the wall relates to the house foundation beside
  it, is not established.
- Where the stringer starts and lands. Drawn on his section as two parallel
  diagonals with a small foot, no treads.
- ~~Which of the two exterior wall conditions band 2 should show.~~ ANSWERED
  5 Sep: the typical section shows the fill-wall condition, and the front wall
  gets a section of its own that the drafter makes and annotates.

