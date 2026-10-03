# How the boneyard works

Written 2 Sep 2026, from Movie's own explanation, because this was carried in
somebody's head and the head went home. Anything below that reads as a rule is
his; anything marked OPEN is a question I have not asked yet.

---

## What the code already does

Not the idea — just what is true in the repo today, so the explanation has
something to correct rather than a blank page.

- **The boneyard is shelf storage that never prints.** `MODEL.dc.html:1642`,
  sitting under the level stack. Shelves can be added; every drawing has at
  least one, and drawings saved before the boneyard existed load with one.
- **Master outlines live on a shelf.** `drawing-format.js:548`. Each point of a
  master carries a stable id.
- **Levels get copies, and the copies remember.** `_outlineCopyForLevel(master,
  level)` makes a level's outline from the master, and a point can carry its
  BUILD HOUSE link back to the master point it came from
  (`drawing-format.js:35`).

So the skeleton store already exists: one master, many copies, and each copy
knows its parent point.

- **Both cameras are already wired.** `MODEL.dc.html:5795-5804` has an
  orthographic camera and a perspective one with OrbitControls. An isometric
  wireframe is a camera angle and an edges-only pass, not a new renderer.

---

## The idea

<!-- Movie explaining. Being filled in as he goes. -->

### Two windows, side by side

The boneyard becomes **two windows sitting side by side** rather than the one
shelf strip it is today.

### Left window — the ISO 3D wireframe

An **isometric 3D wireframe** of the building, with **each floor level's
outline in its own colour**. The bone, standing up, with the levels readable
apart at a glance.

**It rotates by arrows, and it rotates in chunks.** Not a smooth orbit --
each press turns it to the next view and stops there. Movie's reason, in his
words: *simpler*.

> Skipper's note, not Movie's: that is the same instinct as everywhere else
> in the toy. The turtle turns in quarters, walls move in whole feet, the
> iPad nudge moves in six inches. A stepped view is one a beginner cannot
> land in a bad place, and it needs no drag handling -- so it is also less
> to build than an orbit, not more.

OPEN: how big is a chunk? Four views (90 degrees) or eight (45)? Eight reads
the corners of an L, four is fewer presses to get anywhere.

### Right window — the 2D area

The other half is the **2D area**, and it is where the work happens.

### How the two are joined

**Click a floor in the 3D wireframe -- by its colour -- and the 2D window
moves to that floor.** You then manipulate that floor in 2D, and the 3D
wireframe changes to match.

**The 3D is never edited directly. That is the rule.**

> Movie: *"no changing the 3D model in boneyard"*.

Which makes the left window two small things instead of one large one: a
**picker** (which level did you click) and a **mirror** (draw the current
state). No gizmos, no drag handling, no hit-testing against edges or faces,
no undo of its own -- every edit has exactly one home, and it is the 2D side.

> Skipper's note: this is what makes the whole idea tractable. An editable
> 3D view is a project; a stepped wireframe that picks a level and redraws
> when the level changes is a view. The rule is not a limitation someone
> will want lifted later -- it is the thing that keeps the two windows from
> disagreeing about what the building is.

ANSWERED by the movement rules further down, at least in part: an edit to a
floor propagates **upward only** -- everything above responds, the floors
below do nothing. So it is neither "just this level" nor "every level".

> Skipper's note, and it matters for the estimate: **this is new machinery,
> not the existing master mechanism.** `_propagateMasterOutline`
> (`MODEL.dc.html:11235`) walks every outline whose `masterId` matches and
> moves them all equally -- it has no notion of *above*, because it was built
> for one master shared by copies rather than a stack with an order. The
> boneyard rule needs levels sorted by elevation and a propagation that stops
> at the moved one. The override machinery (`overriddenSrcIds`, `offX`/`offZ`)
> is probably still the right way to carry a level that has been adjusted
> locally, but the walk itself is a different walk.

OPEN: does the wireframe follow a drag live, or redraw when the edit is
committed? Live is nicer and costs a redraw per frame; on-commit matches how
the stepped rotation already refuses to be continuous.

---

## Moving a foundation or boneyard wall

**The foundation wall and the boneyard wall behave the same way.** Move either
one outward and **the upper floors extend outward with it, and so does the
roof.**

**Unless a floor above already overhangs.** Then the move is *eaten into the
overhang* instead. The floor's outer edge does not move -- the base catches up
to it.

Movie's own example:

```
before    upper floor cantilevered   20'-0"  past the foundation
move      foundation out             10'-0"
after     upper floor cantilevered   10'-0"  past the foundation

the upper floor's outer edge has not moved. the overhang absorbed it.
```

So the rule in one line: **outward movement spends overhang first, and only
carries the floor once the overhang is gone.**

> Skipper's note: this is the same number as the pile ladder, arrived at from
> the other direction. The maximum overhang is 20'-0" -- 18'-0" to the outer
> beam plus the 2'-0" of joist past it. So a foundation wall moving outward
> spends a budget that has a hard ceiling of 20'-0", and the toy already has
> to know that ceiling to refuse the nudge. One number, two features.

~~INFERRED: moving inward should *create or grow* an overhang by the same
arithmetic.~~ **Wrong, and corrected below.** Movie has since said what inward
does, and it is not the mirror of outward: everything above comes in together
and the overhang keeps its width. See "Inward: everything above comes with it".
The guess was reasonable and it was still a guess; leaving the strike-through
because the wrong symmetry is the obvious thing to assume and the next person
will assume it too.

### An overhang cannot be any width it likes

> Movie: *"there shouldn't be a 4ft overhang it should only be 2ft max
> cantilever or next step to a pile at 4'6"*

My worked example used a 4'-0" overhang, which cannot exist. The legal widths
come in two ranges with a dead band between them, and they are already the
constants in `toy-constraints.js`:

```
0'-0" .. 2'-0"     free cantilever, nothing under it     CANTILEVER_FREE_FT
2'-0" .. 4'-6"     ILLEGAL as an overhang -- bump the    CANTILEVER_PILES_FT
                   foundation out to meet it instead
4'-6" .. 20'-0"    carried on piles
```

So an overhang is either **2'-0" or less**, or **4'-6" or more**. Never
between.

### Which makes the real question the dead band, not the remainder

An outward push shrinks the overhang, so it can walk it straight into the
illegal band. There is nothing hypothetical about this -- it happens on
ordinary numbers:

```
overhang    10'-0"   (legal, on piles)
push out     7'-0"
would leave  3'-0"   ILLEGAL
```

**RULED 2 Sep.** Movie:

> *"once they get to past the 4'6 make it go straight to 2ft reduced on the
> upper floors (remove 2'6 from upstairs floors)"*

The overhang **jumps the band**, and it does it by **trimming the floor
above** rather than by moving the wall further or refusing the press:

```
overhang reaches   4'-6"     last legal piled width
push continues
upstairs floors    -2'-6"    their outer edge retreats
overhang becomes   2'-0"     free cantilever, no piles
```

`4'-6" - 2'-0" = 2'-6"`, which is exactly the strip removed. The wall does not
overshoot, is not short-changed and is never refused -- it keeps travelling
the distance asked for. What absorbs the illegal band is **2'-6" of upstairs
floor, taken off that edge.**

Below 2'-0" the ordinary rule resumes: the free cantilever is eaten normally,
and at zero the level goes flush and travels out with the wall.

> Skipper's note: this is the only one of the four candidates where the finger
> and the wall never disagree, which is why it fits a toy whose whole claim is
> that it cannot show you an invalid house. The other three all either move
> the wall somewhere it was not asked to go, or stop it somewhere it was.

**The piles come out too.** At 2'-0" the overhang is a free cantilever, so
whatever was carrying the old 4'-6" is no longer needed. Worth stating because
it means one press deletes structure, not just floor.

**ANSWERED -- they watch it happen and decide.** Movie:

> *"they should visually see it and decide at that point what to do (see on
> 3dISO)"*

So the 2'-6" coming off the upstairs floors is not announced in a line of text
and not buried in the result. It happens **on the left window, in front of
them**, and the decision of whether to accept it is theirs at that moment.

> Skipper's note: that is the third distinct job the 3D iso is doing, and the
> three together are the case for it. It **picks** a level to edit. It
> **mirrors** the state so the two windows agree. And it is where a
> consequence you did not ask for becomes visible before you live with it.
> A warning dialog would do the third job worse -- nobody reads "this will
> remove 2'-6" from the floor above", and everybody sees a floor get shorter.

### It is the cantilever ladder, walked backwards

> Movie: *"it will be like backwards going out with cantilever and piles
> kindof hey"*

Which removes a rule rather than adding one. Going **out** from the wall the
ladder is: free cantilever to 2'-0", nothing until 4'-6", then piles out to
20'-0". An overhang shrinking under an outward push walks **the same ladder in
reverse** -- piled, down to 4'-6", then the drop to 2'-0" free.

So there is no separate "dead band" rule to implement. There is **one ladder,
and the overhang always sits on a rung of it.** The 2'-6" trim is not a
special case; it is what "always on a rung" costs when the rung below is
2'-0".

> Skipper's note, for whoever builds it: this means the constraint module
> needs one function, not two. The same rungs that decide whether an outward
> nudge is legal decide where a shrinking overhang is allowed to land. Two
> features, one table -- and the pile ladder Movie gave earlier (8'-0" then
> 10'-0", 18'-0" to the outer beam, 2'-0" past it) is that table's upper half.


### It is not a foundation rule. It is a "lower floor" rule

Answered while writing the above, and it generalises the whole section:

> Movie: *"any wireframe above should be affected by outward push of any lower
> floor (including the roof)"*

So **nothing above a pushed floor is left untouched** -- not the floor
directly above, not the top storey, not the roof. And "affected" covers both
outcomes already described: either the thing above extends with the push, or
its overhang absorbs it. Those are the two ways a level can respond, and every
level above responds one way or the other.

Which means the foundation is not special. It is simply the lowest floor, so
pushing it affects the most. Push a middle floor and everything above *it*
responds by the same rule; the floors below do nothing.

OPEN: does a roof **eave** count as an overhang to be eaten? An eave is an
overhang, and `geometry-2d.js` models eave edges as a real thing with the
straight-skeleton wavefront. But an eave has a designed width for shedding
water, so having it silently shrink because someone pushed a wall out is a
different proposition from a floor cantilever shrinking. Not assumed either
way.

---

## Growing and shrinking are not symmetric

> Movie: *"the only way they can reduce footprint is in the boneyard using the
> bone or foundation"*

So the two directions have different rules and different doors:

| | where it can be done | what it affects |
|---|---|---|
| **push out** | any lower floor | everything above -- extends, or spends overhang |
| **reduce footprint** | **only in the boneyard**, via the bone or the foundation | -- |

Growing is available anywhere and is safe: things above follow, and the
overhang rule absorbs what it can. Shrinking is gated to one place.

> Skipper's note: and this is the argument for the whole feature, not a
> restriction bolted onto it. Shrinking is the destructive direction -- pull
> the base in and something above it can be left standing on nothing. It is
> the one move where you need to see the whole building before you commit,
> and the left window is exactly that: every level in its own colour, stacked,
> with the thing you are about to cut visible. The 3D iso is not decoration on
> the boneyard. It is what makes the boneyard the right place to keep the
> destructive verb.

### The bone and the foundation

> Movie: *"the bone and foundation wireframe may become the same thing in the
> future"*

Recorded because it changes how this should be built, not just what it will
look like later. They already share their rules -- move either outward and the
same thing happens (see above), and both are named as the doors to shrinking.
So they should not be built as two mechanisms that happen to agree; they
should be **one mechanism with two names**, and the day they merge is a rename
rather than a rewrite.

---

## Inward: everything above comes with it

> Movie: *"if it is moved **inward** whatever is hooked up inline above also
> changes and the stuff hanging over the edge is brought inward the exact same
> amount"*

For an inward move of `d`, **everything above moves in by `d`** -- both what
sits flush on the wall and what hangs past it. An overhang **keeps its width**
and is carried along; its outer edge comes in by `d` like everything else.

So inward is a translation. Nothing is absorbed, nothing is spent, and the
whole building above the moved wall shifts as one.

### Which is why inward is the only way to shrink

This is what rule *"the only way they can reduce footprint is in the boneyard
using the bone or foundation"* is actually made of, and the two directions
turn out to be genuinely different operations rather than one operation with a
sign:

| | flush above | overhanging above | outermost edge of the building |
|---|---|---|---|
| **outward** `d` | moves out by `d` | overhang **shrinks** by `d`, outer edge stays | **unchanged**, until an overhang runs out |
| **inward** `d` | moves in by `d` | overhang **keeps its width**, outer edge moves in by `d` | **moves in by `d`** |

Outward never reaches past where the building already reached -- it fills in
underneath the overhang it already has. Inward moves the outer edge itself.
That is the whole asymmetry, and it is why only one of the two reduces a
footprint.

<!-- next: -->

---

## The BONEYARD / WIREFRAME page — Movie, 1 Oct 2026

The two-window idea above, given its own page. Recorded as he described
it; nothing is built yet, and it is queued after the LAYOUT sheets and
SELECT.

### The tab
- New page tab between MODEL and EXT. FINISH.
- Label: **BONEYARD** on the RUFF skin, **WIREFRAME** on the ROUGH skin
  (OUTLINE is an acceptable alternative name).
- Queue position: last, after LAYOUT sheets and SELECT.

### Left window: 3D iso wireframe
- Only the exterior-wall outline of each level: 4-5 lines per loop. House
  and garage both.
- Colours: FOUNDATION purple, MAIN FLOOR red, 2ND FL green, ROOF orange.
  Bi-level lower levels blue (MOD BILEVEL is still to be designed).
- Heights: foundation at the bottom of the foundation wall; floors at the
  top of the sheathing; roof at the top of the ceiling. (OPEN: one loop per
  level plus a top ceiling loop? Suggested, not yet confirmed.)
- Rotation: any direction, but STEPPED. Each step is 15 degrees and draws
  one still frame, with no animation in between (to save processing).
- While editing, the 3D window only picks the view and level: tap a loop
  and the 2D window switches to that level.

### Right window: 2D, current level only
- Shows the selected level's outline.
- Editing uses the TOY tools: move walls in and out, whole feet, square
  corners. To be tuned after testing.
- A new plan entered through BONEYARD walks the normal process in this
  window. (OPEN: the tracing steps are suggested; not yet confirmed.)

### What moves what
- FOUNDATION: moving it moves everything above it (main fl, 2nd fl, roof).
- MAIN FLOOR and 2ND FLOOR move individually, by the floor-pull ladder
  (tour.js floorPullLadder): 0-2 ft cantilever with no pile; 2 ft to 4'-6"
  forbidden (snaps); a pile from 4'-6"; spans of 8 ft max; 18 ft ceiling.
- ROOF follows the 2ND FL outline by default, but can also be pulled out on
  its own (front entry, covered back deck), by the same ladder: a pile at
  4'-6" minimum, then about every 8 ft.
- The 8 ft pile spacing is a safe DEFAULT, not a fixed rule: the user can
  change it (an office setting, likely on STANDARDS).

---

## PR 2: editing the bones (built 3 Oct 2026)

Movie, 3 Oct, choosing between options: a moved bone takes the house with it
("walls, floors, roof follow"); an edge moves by "drag or arrow keys, whole
feet"; PR 2 carries "all of them" of the moving rules, piles included; the
tracing steps wait for the OUTLINE rework in PR 3. And, while it was being
built: "also need to 'break' the outline (per foot)".

### What the right window does
- **Pick** a level (a loop on the left, or its button), then **tap an edge**
  on the right. It lights up with its length.
- **Push** it: drag it, or the arrow keys (left/right for an edge running
  front to back, up/down for one running side to side). Whole feet, square
  to itself, corners stay square. With no edge picked, left/right still
  turn the 3D.
- **BREAK** (or `B`): tap an edge and a corner goes on the nearest foot
  mark, at least a foot in from either end. Then each part pushes alone,
  and a push of one part makes a jog.
- **UNDO** (or Ctrl+Z) takes the last change back. Every change is saved as
  it is made.
- The page edits under the same lease as MODEL. With MODEL open for editing
  in another tab it shows the bones and says why it will not change them.

### How the house follows (`boneyard-edit.js`)
A premade house has no master outline, so nothing is linked to the bone by
id. Every built house's walls, decks, slabs and footings stand ON the
outline, so a push moves every point on the pushed line inside the pushed
span, on that body's records:
- The walls along the line travel; walls meeting it stretch; where only
  part of an edge moves, the wall is cut and a short wall (a copy of the
  moved one) closes the jog. Windows and doors keep their place on the wall.
- The foundation's bone is its concrete, chained wall to wall. While it
  runs the same loop as the floor over it, that floor's loop is drawn.
- A garage edge takes the garage's own concrete, slab and piles with it.
  The edge a garage shares with the house does not move: BREAK it where
  they part and push the free part.
- The roof's eave is the same edge one overhang out. Past a corner that
  turns in it goes out by the overhang, past one that turns out it comes in,
  and a bump out widens it by the overhang each side.
- Dimension strings with an end on the pushed wall, or standing just
  outside it, ride with it.

### The moving rules, as built
- **Outward**, any floor or the foundation: every level above responds,
  bottom up. Flush: it goes out too. Overhanging: the overhang is spent
  first. An overhang that would end between 2'-0" and 4'-6" is trimmed to
  2'-0" (the floor above loses the difference, its piles come out) and
  the status line says so.
- **Inward**: everything hooked above (flush or overhanging) comes in the
  same amount; an overhang keeps its width.
- **A floor's own pull** walks the ladder against the level under it. A
  press that would land in the gap jumps it: from 2'-0" the next press out
  is 4'-6", and from 4'-6" the next press in is 2'-0".
- **The roof** can be pulled on its own (its bone is its eave brought back in
  by its overhang), by the same ladder, never in past its wall.
- **Piles** under an overhang stand in the ladder's rows, at most 8'-0"
  apart along the edge. They are 10" piles marked P1 and are not `auto`, so
  AUTO PILES (which re-places only its own) leaves them.

### Not in PR 2
- The 8'-0" spacing is a constant here; making it an office setting on
  STANDARDS is still to do.
- A garage's own pile spacing is not re-worked when its walls lengthen.
  Press AUTO PILES on MODEL after a big garage change.
- AUTO DIMS and AUTO BEAM are not re-run; press them on MODEL after a big
  change. The stair and its opening do not move.
- OPEN, still: whether a roof eave counts as an overhang to be eaten. As
  built, the eave keeps its width and follows the wall.
- Bilevels: the foundation bone is the concrete loop, but the half levels
  have not been tried against the rules above.

## The grow, and PR 3a: drawing the outline (built 3 Oct 2026)

### The grow
"show the 3d ISO bone grow first and then flip to model space and show the
front elevation grow". A bone press that builds (with BONE REVEAL on) saves,
opens the BONEYARD, raises the bones bottom first in the 3D window, then goes
back to MODEL, which plays the E1 rising reveal. A tap skips to E1.

### The OUTLINE tool draws like EXT WALL
- Every corner after the first is square off the last one (90-degree
  corners) and a whole number of feet along, on every board.
- The rubber band, the LENGTH box and the strip show the corner the next
  press will put down. A typed length must be whole feet. A typed angle
  must be a multiple of 90.
- The orange rays come from every corner, as before.
- It closes on the first corner. The edge home must be square: a press near
  the first corner from a corner that does not line up with it is refused
  and the strip says to follow the first corner's orange line.
- A crossed loop is still refused.

### The drive-thru
- Once a type is picked the sign reads "PRESS BUTTON to build now -or-" with
  "CLICK HERE to draw house OUTLINE" under it ("garage OUTLINE" for the
  detached garage). It is offered for every type. On ROUGH, which has no
  screen, the same press sits under the selections.
- The press shuts the sign and arms the OUTLINE tool for that type. A garage
  traced this way is saved as a garage outline (`garage: true`).
- An empty BONEYARD reached from another page of the app sends the drafter
  to MODEL and the sign rises. Opened on its own (a bookmark, a typed
  address) it stays, says it is empty, and offers PICK A HOUSE AT THE
  DRIVE-THRU.

## PR 3b: the bone builds the traced house (built 3 Oct 2026)

### The steps
1. CLICK HERE to draw house OUTLINE (or pick a type, which arms the trace).
2. Trace the main floor.
3. If the type hangs a garage on the house (the + GARAGE types, ROOM OVER,
   MODIFIED BILEVEL), the strip says "Now trace the garage" and the OUTLINE
   tool stays armed for it.
4. The strip says "Press the bone to build your ...". The bone's BUILD
   builds the whole house like a premade one: walls, floors, concrete,
   piles, roofs, beams and columns, stairs, dims, windows and doors, then the
   bones grow and E1 grows.
5. The traced loops come off the drawing with the build (the built outlines
   stand in their place); one Ctrl+Z takes the house and puts them back.

traced-plans.js turns the loops into the plan buildPremadePlan already
reads, so there is one builder.

### His rulings (3 Oct)
- **Roofs:** a bungalow + garage, and a 2 STOREY with the room over the
  garage, are ONE roof round both bodies. A garage on a lower plate (2 STOREY
  + garage, the bilevels) keeps its own lower roof.
- **The bilevel's entry** (12 x 6) is placed for him: straddling the garage
  line on the front wall, as the premade does (the street half takes the
  front door and the stair UP, the garage half the door from the garage and
  the stair DOWN). A garage on the other side turns it left for right. With
  no garage it is centred on the front wall.
- **Room over the garage:** 18 ft of the garage at the house end; the rest
  keeps its own lower roof.
- **Windows and doors:** auto-windows.js's rules as they are -- a front door
  in the widest stretch of front wall the garage leaves, windows dealt by the
  module (one side wall may stay bare), the overhead door on the street face
  (opposite the wall the garage hangs off the house by) and a man door.

### A detached garage
Traced as a garage outline and built on its own loop: walls, concrete, roof,
overhead door and man door.

### Refusals (said on the strip, nothing built)
- A garage type with no garage traced.
- A bilevel whose front wall has no straight 12 ft for the landing.
- A room over a garage that is not a rectangle against the house.

## Doors and windows in the bone (built 3 Oct 2026)

Movie, 3 Oct: "is it possible to show the doors and window as openings in the
outline with a dot where their center position is" — in the bone, in the
BONEYARD's 2D and 3D windows both.

- **A gap the opening's width** in the loop's line, and **a dot at its
  centre**: magenta for a door (garage overhead doors included), blue for a
  window — neither is a level's colour.
- **Which loop edge.** An opening is a fenestration in a wall; the wall's
  level says which floor's bone it is in (not the record's own `levelId`), and
  the edge is the one the wall runs along — parallel, with the opening's
  centre within 1 ft of it (`OPENING_TOL_FT`) and between its corners.
- **The foundation and the roof are solid.** Only floor loops carry openings.
- **Pure.** `boneyard-loops.js` finds them (`openingsOn`, kept on each loop as
  `openings: [{edge, at, from, to, type}]` in feet along the edge) and cuts the
  loop into runs and dots (`runsOf`); `layout` projects both as `cut`. The page
  only strokes the runs and fills the dots, in the grow too.
- Specs read `#bones3d[data-openings]` and `#bones2d[data-openings]`.
