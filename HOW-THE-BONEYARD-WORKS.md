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

RULED 2 Sep: what happens on an **outward** move when the overhang is
*smaller* than the move. The overhang is eaten to zero, the level stops
hanging and becomes flush, and the remainder carries its edge out with the
wall. So a 4'-0" overhang under a 10'-0" push absorbs 4'-0" and the edge then
moves the other 6'-0". One move that changes behaviour halfway through, rather
than a move that stops when the overhang is spent.

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

