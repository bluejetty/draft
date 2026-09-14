# Work order — TOY MODE: the board that edits bones

For Gilligan. Written 13 Sep 2026 by Kevin, from Movie's rulings of today.
**This supersedes the TOY-MODE-WORKORDER draft of this morning**, which had a
typed-length exception Movie has since replaced with something better.

You get this one because the hard half is *"no other tools"*, and the tool
register that has to answer that question is yours. Anyone else would be
adding guards around your work instead of a rule inside it.

---

## Read these first, and read them as history

Three documents already describe TOY. None of them is wrong; two are older
than today.

- `RD-DOCUMENTS/IMPORTANT-WORK-ORDERS/SPEC-toy-mode-constraints.md` — 31 Aug.
  The rounding rule, the seam, grip tabs, the cantilever bands. **Still law**,
  except that the turtle is no longer how a house gets drawn.
- `RD-DOCUMENTS/IMPORTANT-WORK-ORDERS/TOY-MODE.md` — 2 Sep, Skipper's status.
  What is built and what proves it.
- `RD-DOCUMENTS/IMPORTANT-WORK-ORDERS/HOW-THE-BONEYARD-WORKS.md` — the bone,
  the master, upward-only propagation, the cantilever ladder. **Movie says the
  bone ideas are still moving.** Take the bone as a destination in this order
  and nothing more. Do not build against its open questions.

Where this order and those disagree, this one is newer. Where they are silent
and this one is silent, ask rather than invent.

---

## The rule, in one sentence

**TOY has no tools, draws at 90° only, lands on whole feet, edits only through
bones — and the moment a drafter needs an inch, the drawing is not in TOY any
more.**

## Why the constraints are the feature

A plan on the foot is still a proposal: slide a wall a foot and everything
else still works. The moment one wall is at 12'-7 3/8" it is an answer, and
every other wall has to negotiate with it. Permit output follows from the same
place — whole feet and right angles give clean dimension strings and areas
that land on whole numbers rather than fractions that read like measurement
error.

Movie's older rule states it exactly, and it survives intact:

> **Everything adjustable is to the nearest foot. Everything the material
> dictates keeps its real dimension.**

A wall the drafter moves goes in whole feet. The wall is still 5½" thick.

---

## 1. Drawing the outline

TOY is the default board, and the outline is drawn on it.

First press sets the point. Then **either drag, or press again and drag** —
both must work; a drafter who lifts his finger has not cancelled anything.

**The lift places the line.** Ruled 13 Sep: *"when the pointer lifts place the
line"*. Today `drawPress` is wired to `pointerdown` only and nothing listens
for `pointerup`, so the drag gesture has never committed anything — the check
named for it taps twice. Build the `pointerup` commit, and make the check
perform the gesture whose name it carries.

**A live length readout follows the draw.** Ruled 13 Sep: *"show the line
length on screen to the user during the line drawing when their finger on
screen for ipad"*. Whole feet in TOY. Two conditions:

- It reads the **same number `commitWall` will receive**, not the cursor
  measured separately — two readings of one distance drift, and the drafter
  believes the one he can see.
- It sits **by the cursor on PC, clear of the finger on touch**. Same number,
  different placement: on a touch screen the thing being read is exactly the
  thing the hand is covering.

**PC keeps the normal gesture.** Ruled 13 Sep: *"for PC the line creation will
be normal pc method"* — click to set the start, move with the line rubber-
banding and the length live, click to place. Touch gets the press-drag-lift.
The two are the same wall by the time it reaches `commitWall`; that is
acceptance #2, and it is the reason the commit must not live in either
handler.

- **Four directions only**, +X/−X/+Z/−Z from the start point. Ruled again
  today: *"lets just leave them both 90's for now, i'll take care of angles
  later."* Angles are Movie's, not this order's.
- **Whole feet.** The number that reaches `commitWall`, not the cursor
  rounded for display.
- Not "snap to the nearest of four" as a suggestion a corner snap may pull
  off. `drawPoint` (`MODEL.html:3970`) already shows the shape: square first,
  and a snap may only move the point **along the axis it is already on**.

This governs the outline, the garage, the entry level — everything the house's
shape is made of.

## 2. The outline becomes a bone, and bones are the only handle

When the outline is made, the drafter sees the **BONE outline**.

### Where the bone comes from — ruled 13 Sep

Asked whether a hand-drawn TOY house gets a bone at all, or whether bones only
ever arrive from BONE / the boneyard, Movie ruled:

> *"yes the toy house will have the bones and those will be what TOY can
> manipulate"*

So **the TOY draw gesture creates the level outline, and the outline makes the
bone** — one gesture, walls and bone together. There is no such thing as a TOY
house without a bone, because there would be nothing to edit it with.

This is a change to §1, and you found it: today `commitWall` pushes to
`drawing.walls` and touches nothing else, and the only place `MODEL.html`
creates a level outline is adding a level, copying from `boneyardOutlines`
(`MODEL.html:2919`). Drawing in TOY must now write the outline too. The
outline is the house's shape; the walls are what that shape is built from.

### A disconnected run is a second bone — ruled 13 Sep

You found that the bone accumulates along the chain, so a second run started
away from the house joins the same outline and closes a polygon nobody drew —
house to garage across the yard. Put to Movie, who ruled **(a)**:

**A run that does not connect to an existing outline starts a new outline and
a new bone on that level.** One level may hold several. A house and a detached
garage are two footprints and two bones, each grabbed on its own — which is
what §1 already implied by naming the garage among the things the gesture
makes.

So §4's break-the-bone keeps its assumption: **a bone is a real loop**. It is
just that a level may have more than one.

### An unfinished run refuses the next one — ruled 14 Sep

You recorded the pending-bone slot as a limit rather than a rule: start a
disconnected run while the previous run holds only two taps and those two taps
vanish. Nothing is lost from the file — a two-point run was never a shape — but
the drafter's hand did something the screen forgot, and that is the shape of
fault this whole order exists to refuse. Put to Movie, who ruled:

**The new run is refused, out loud, while a run is unfinished.** Say which —
"finish or cancel the run you started" — and leave the two taps where they are.
Never drop them silently.

Acceptance: two taps down, a tap started away from them **makes nothing new and
loses nothing**, and the page says why.

**And the way out — ruled 14 Sep.** You saw the consequence and named it: with
the refusal in, a run once started cannot be abandoned. Movie ruled **(a)**:

- **Escape cancels the pending run.**
- ~~Putting the tool down cancels it too.~~ **Withdrawn 14 Sep** — see below.

**The two rulings cancelled each other — corrected 14 Sep.** You measured
before building and found that `drawStart` is already cleared on tool change,
so a tool-down cancel makes `pendingBone` unreachable and **the refusal can
never fire**. That is a message nobody can ever see: the dead-guard shape this
order keeps digging out. Put back to Movie, who ruled **(a)**:

**Keep the refusal. Escape is the way out. Putting the tool down is not.**

So the refusal fires exactly where the original complaint was — tool put down
mid-run, press somewhere else — and Escape is the exit that keeps it from
being a trap.

### The bone is the only handle

> Movie: *"they will only use the BONES for editing"*

- **Each floor has its own bone.** One per level.
- **A level's bone drives that level's FLOOR and WALL nodes.** Move the bone
  and the floor and the walls move with it — the bone is not a separate
  drawing that happens to look like the plan.
- There is a **master bone in the boneyard** that controls the others.
  Context, not scope: build the per-level bone and leave the master's
  behaviour alone. Movie is still working it out.

The file format already carries this and you should not invent a second one:
a level outline has a `masterId`, each point carries `srcId` — the master
point it came from — plus `offX`/`offZ`, and the outline keeps
`overriddenSrcIds`, the points adjusted locally
(`drawing-format.js:893-929`). "Locked to the original node except where it
was moved, and it remembers by how much" is already the storage.

## 3. Moving a bone

Dragging a bone wall is the move `toy-constraints.js` already decides:
`allowedMove` rounds, welds, refuses and explains. **Do not write a second
constraint path.** What is new is that the thing being dragged is a bone and
the floor comes with it.

- **The dragged wall moves perpendicular to itself.** The **side walls
  stretch** to follow. That is the bodily drag with end-wall stretch already
  described in the module's result.
- **Distance in TOY is unlimited but on the foot.** What keeps TOY safe is the
  cantilever cap below, not a limit on how far a wall slides.
- **A blocked drag stops dead and the blocker says why.** Never elastic. This
  is ruled and has a whole section of the 31 Aug spec behind it; do not soften
  it.

### The wall that is not on the grid — ruled 13 Sep

A plan drawn in DRAFTING has walls at odd places. Put one at 12'-0½", nudge it
a foot in TOY: 13'-0½" (a foot from where it sat) or 13'-0" (the grid)?
Offered both, Movie answered with a third and better one:

> *"make the first point land on a ft point how about so we don't have that
> problem"*

confirmed as: **the first nudge lands the wall on the nearest foot mark, and
every move after that is a whole foot.** 12'-0½" → 13'-0", then 14'-0",
15'-0".

The half-inch is given up **once, on the wall the drafter deliberately moved**.
That is what keeps it inside the 31 Aug rule rather than breaking it: TOY never
touches a wall nobody touched. Opening an old plan in TOY moves nothing.

A house born in TOY is already on the grid, so this rule is invisible there —
which means **the check has to be written on an imported off-grid wall**, or it
asserts nothing. Assert the landing foot mark, and assert that the other walls
in the same drawing did not move.

### The 2'-0" cap belongs to the floor, not to the board

Movie, in order, and the second message corrects the first — keep the
correction, it is the better rule:

> *"the canilevers only go 2 ft out so upper floors will only go 2 ft out (for
> now)"* … *"the foundation and bone in boneyard can go further than 2'"* …
> **"only main and upper floors limit is 2ft (for now)"**

So it is not "TOY caps at 2 feet". It is **a main or upper floor cantilevers
2'-0" and no further, on any board**, because of what is holding it up. The
way past the cap is to bring the foundation or the boneyard bone out
underneath it — which is available, and is not capped.

The numbers exist: `CANTILEVER_FREE_FT = 2`, `CANTILEVER_PILES_FT = 4.5`
(`toy-constraints.js:39`). This order adds **which mover may climb which
rung**, not new numbers. The piled rungs above 4'-6" stay in the module and
come back when Movie lifts the "for now".

## 3b. THE DIAGONAL TOY COULD DRAW — found while sizing §4

Probing what a §4 break would produce, before building it: a run already split
into two collinear walls sharing a corner. Dragging one half gave

    n2: (0,-11) -> (10,-10)        a diagonal, in TOY, strip empty

No §4 needed to reach it. Any drawing with two collinear walls sharing a
corner did this, and §3 shipped with it.

**Two faults, one symptom.**

1. **The page never told the module what moves.** `weldGroup` welds any two
   walls whose ends touch, so a closed room is ONE group and `allowedMove` was
   being asked "may I pick the whole house up and set it down a foot away" --
   always yes. Measured on the plain square: `group [n,e,s,w]`, `stretches []`,
   `reason null`. Meanwhile the page moves one wall and stretches its
   neighbours: a different operation from the one approved.

   So every room minimum, cantilever band, clearance and beam-span rule in
   `toy-constraints.js` was **unreachable from MODEL.html**. The only refusal
   §3 ever demonstrated was `inertReason` -- the dragged wall being itself
   diagonal -- which fires before any of that machinery.

   Fix: the page passes `welds: [[wall.id]]`, the module's own override. The
   group is the dragged wall; its corner neighbours are stretches, which is
   what the page actually does to them.

2. **Nothing checked the shape after the move.** `configAfterMove` advances
   declared numbers -- room dimensions, spans, cantilevers -- and never moves a
   vertex, so `isLegal` judges a configuration carrying the ORIGINAL geometry.
   The module computed the neighbour stretching `10.00 -> 10.05` -- which is
   the diagonal, sqrt(10^2 + 1^2) -- and returned ok.

   Fix: `wouldAngle`, beside `endStretches` where the moved corners already
   are, and a `WOULD_ANGLE_NEIGHBOUR` reason. TOY only -- DRAFTING's freedom is
   that a wall may sit off-axis, and a rule forbidding a move for angling
   something is the foot light's leak wearing a third coat.

   `describeBlocker` also had to stop rewriting it to `GROUP_MEMBER_BLOCKED`.
   That code means "a wall travelling WITH you is blocked"; a neighbour left on
   an angle is standing still with one end dragged, and naming it a distance
   problem points the drafter at the wrong thing.

**Why no gate caught it.** Every fixture was the square, where a wall's
neighbours are PERPENDICULAR -- they lengthen and stay square. Collinear
neighbours were never in a fixture. Same blind spot as the -z-only nudge and
the along-x-only wall: *the fixture in front of me exercised one side.* Third
time in one session, which makes it the habit to design against rather than a
run of bad luck.

**What it does to §4.** A joint is not enough. Break a run, drag one half, and
the other half swings -- so "the two halves move independently" cannot be
delivered by inserting a corner. The break must split the shared corner and
the drag must create the connector wall: that connector IS the side of the
bump-out, which is what §4 says the break is for.

## 4. Breaking the bone

> Movie: *"they will be allowed to 'BREAK the bone' every foot if they want to
> by clicking on it"*

This is the move that lets TOY draw a real house: break the bone and the two
halves move independently, so an L, a bump-out and a garage offset are all
reachable without leaving 90° and whole feet.

- Clicking a bone offers **break here** or **move this wall**.
- The break lands on **the foot mark that was clicked** — "every foot" is a
  set of break points to choose from, not a bone pre-chopped into foot
  segments. Same result, one decision at a time, and no bone made of forty
  segments before anybody has touched it.
- After a break the two halves are independent bones and each obeys §3.

## 5. The roof follows the top storey

> Movie: *"the highest floor story bone (2nd floor, or sometimes main floor)
> will also adjust the ROOF bone and ROOF shape"*

The **roof bone is a dependent of the topmost storey's bone**, whichever
storey that is — 2nd floor on a two-storey, main floor on a ranch. Consistent
with the boneyard rule that propagation runs upward only: the roof is simply
the last thing above.

**The roof *shape* re-derivation is not yours.** Whether ridge, hips and pitch
rebuild from the new outline is the geometry Movie has said several times he
will solve himself, and it gates the 3D. Move the roof bone; leave the shape
alone and report what you find.

### A roof belongs to whatever is uncovered — ruled 14 Sep

Movie, asked again:

> *"the highest floor bone should also control the roof bone so the roof will
> change, additionally, if a main floor is added a roof should be added on it
> at the lower level if the 2nd floor doesn't cover it, or also if the 2nd
> floor is pulled back a main floor roof should cover the open ceiling"*

So §5 is **not one roof on the top storey**. It is:

**Every part of a floor that nothing sits on gets a roof over it.**

Two cases, and they are the same case:

- Add a main floor wider than the storey above — the part sticking out is
  uncovered, so it takes a roof at its own level.
- Pull the 2nd storey back — the main floor it just uncovered now has open
  ceiling, so a main-floor roof grows to cover it.

That makes the roof a **function of the difference between one storey's
footprint and the one above it**, recomputed when either bone moves — not a
thing attached to the topmost bone. A ranch is the degenerate case: nothing
above, so the whole floor is uncovered and takes one roof.

**What is still not yours: the shape.** Pitch and ridge direction are
Movie's. (Where the lower roof meets the upper wall is now ruled — see
"The lower roof dies into the wall" below.) Your job is
**which areas are uncovered and therefore need a roof**, and keeping that
answer true as bones move. Produce the region; leave what is built on it alone
and report what you find.

**Measure before building this one.** Whether the format can even hold a roof
per level, and whether a roof is stored as an outline or derived at paint
time, decides how big this is — and §4 has already been re-read once tonight
for exactly that reason. If it turns out to need a format change, stop and say
so rather than inventing a field: an older page that drops a roof record
silently is the worst failure this format has.

### Cottage by default, gable on request — ruled 14 Sep

> Movie: *"make the roofs cottage default and switchable to gable"*

So the shape is no longer entirely withheld. **A roof comes up hipped —
every edge sloping, no gable ends — and the drafter can switch it to gable.**

**Measure this before writing a line of it, because the format already does
most of it.** `drawing-format.js` stores a roof as a closed footprint whose
**every edge carries a kind, `eave` or `gable`**, alongside `overhang`
(default 2, clamped 0–6) and `pitch` (default 4, clamped 0–24). And the
default is already the one Movie just asked for: an edge is `gable` only if it
says so, **otherwise it is `eave`**. A roof built with no edge kinds set is
hipped. Cottage-by-default is not a feature to add; it is the behaviour to
**not break**.

There is a second seam already cut for you: **roof INTENT** (board #238) —
"the tour's roof pause edits intent, not geometry; the bone consumes it when
it builds the roof", keyed by **master outline point ids** so it survives
outline edits. That is the same bone, the same master, and the same
propagation problem as §5a. **Read it before inventing a switch.** If intent
is where a gable choice belongs, put it there.

What that leaves you:

- The uncovered region from §5 becomes a roof footprint whose edges default
  to `eave`.
- Switching an edge — or the roof — to gable sets edge kinds and nothing else
  moves.
- **Pitch and ridge placement are still Movie's.** Cottage-vs-gable is a kind
  per edge, not a geometry engine. Do not build a ridge solver because a
  default arrived.

### The lower roof dies into the wall — ruled 14 Sep

> Movie: *"the roof should terminate where it meets the upper storey wall like
> a garage roof that is dropped"*

So the collision case is closed, and it is the simple answer: **where an
uncovered region runs up against the storey above, the roof stops at that
wall.** It slopes up from its eave and **terminates** against the upper wall —
it does not ridge there, does not turn a hip back down, does not pass through
or notch the wall above. A dropped garage roof leaning on the house: exactly
that, and for the same reason — the wall above is already a wall, so the roof
has nothing to close off.

That makes a shared edge **a third kind of edge**, and it is not `eave` and it
is not `gable`:

- an **eave** edge carries the roof's low side and its overhang;
- a **gable** edge closes a slope with a vertical end;
- a **terminated** edge is where the roof simply ends against the building
  above it — no overhang, no fascia, no rake.

**Measure this before you build it, because the format has no such kind.**
`drawing-format.js` reads an edge as `gable` if it says so and **`eave`
otherwise** — there is no third value, in the footprint edges or in roof
INTENT's `kind`, which validates against exactly `['eave', 'gable']`. So a
terminated edge written today **reads back as an eave**, and an eave is the
one thing it must not be: it would grow a 2' overhang straight into the storey
above.

So: **measure, then stop and say so.** Either

- the kind widens to a third value — say what an older page does when it reads
  it, because it will read `eave` and hang an overhang inside the house; or
- the terminated edges are **derived**, not stored: an edge shared with the
  footprint above is terminated by definition, and nothing new is written.

The second is cheaper and has no older-reader problem, and it is probably
right — but it is a measurement, not my ruling. **Do not add a third kind on
your own authority.**

## 5a. The master bone, the frozen corner, and the level lock — ruled 14 Sep

This was the last thing left open on the master. It is now closed, in two
parts, and they are **two different ways off the master — per corner and per
floor**. Do not collapse them into one.

Movie:

> *"should be in a 'frozen' position compared to how the master bone is
> moved. but i think we should make a 'level lock' that can be turned off so
> the master bone wouldn't control the ones without the level lock"*

**A hand-moved corner freezes.** Move a level's point by hand and it stays
exactly where it was put. The master then moves everything else around it and
that point does not budge. Note this is **not** the offset behaviour the
format's `offX`/`offZ` suggests — offsets carry a point along with the master
keeping its distance; freezing does not. The recorded offset becomes a record
of where it was left, not a rule for where it goes next. Measure which one the
code does today before changing anything, and say so if they differ.

`overriddenSrcIds` is already the list of hand-moved points. That is the flag;
do not add a second one.

**A level lock is per floor, and it is on by default.** Locked, a level copy
follows its master. Unlock the level and the master stops controlling it
entirely — it keeps what it has and goes its own way. New levels arrive
locked, because inheriting the master is the whole point of a copy.

**`levelLocks` already exists in the format** and is saved and reloaded with
no verb anywhere to make or break one — `tests/model-html-gestures.spec.js`
asserts exactly that, that locks *come back untouched*. Today's lock holds
groups. Yours holds a level to its master. **Widen the existing key; do not
add a parallel one** — and if widening it would change what an older page
reads back, stop and say so, because that test is the one that will catch you
and it is right to.

## 6. No other tools

The seventeen-key column, the selection filters, the assembly verbs — none of
them operate in TOY. DRAFTING has everything.

**Not seventeen `if (board === 'toy') return;` guards.** One place decides
whether a tool is available on a board and every surface reads that one
answer; the register is where the question already lives. A key that is
unavailable must **look** unavailable, for the same reason the dormant strip
chips are dark: a control that lights and does nothing is a worse lie than one
that is plainly down.

## 7. The promotion, and the popup

**Entering an exact length anywhere promotes the drawing to DRAFTING.**

### The trigger is both constraints, not one — ruled 14 Sep

> Movie: *"once angle or not 1ft contraints only drafting more"*

So this is not two rules. **TOY holds exactly two constraints — cardinal
direction and whole feet — and asking to leave either one is the same event:
the drawing promotes to DRAFTING.**

- ask for a **length that is not a whole foot** → promote;
- ask for an **angle** → promote.

Both raise the same confirm below, with the same two answers, and the wording
follows what was asked for rather than always saying "length". **Stay in TOY**
refuses it and changes nothing — no wall, no angle, no partial application.
This is the other half of *no angles in TOY*: TOY never bends, and the way to
get an angle is to leave.

**The promotion is one-way, and that is deliberate.** Once a drawing holds a
diagonal or a 7'-4" wall, there is no route back to TOY, because TOY cannot
represent that geometry — "return to TOY" could only mean silently squaring
and rounding the drafter's building. Do not build a demote. If a board
selector would let someone pick TOY on a promoted drawing, it must be refused
with the reason visible, not honoured quietly.

Movie ruled this against my own earlier suggestion that TOY keep a
typed-length exception, and his version is better: TOY then has one law with
no exceptions, and the promotion is visible instead of being a hidden mode
flip. *"i think the toy part should be as simple as possible, once they enter
a more specific length anywhere switch to drafting mode."*

The LENGTH box on the instrument strip is the surface that does it today
(`commitTypedLength`, `MODEL.html:4100`).

**Ask before promoting, not after:**

> Entering an exact length switches this drawing to DRAFTING.
> [ Continue ] [ Stay in TOY ]

- **Continue** promotes the board and commits the typed length.
- **Stay in TOY** commits nothing and changes nothing — no wall, no mode
  change, no half-application.
- **It asks once per drawing, then remembers.** A confirm on every typed
  length is a dialog people learn to click through without reading, which
  teaches the opposite of what it is for.
- Where "once per drawing" is remembered is a real decision: it belongs to
  **the drawing**, not the browser, or the same drafter meets it on every file
  while a second drafter never sees it at all.
- The drafter may switch back to TOY afterwards. Promotion is not a one-way
  door.

## 8. The switch already exists

`MODEL.html:4156` holds `BOARDS = ['toy', 'drafting']`, defaults to `toy`,
writes `body[data-board]`, remembers the choice, and every button carries the
title *"remembered, but nothing is constrained by it yet"*. **Delete that
title when the constraints land.** A control that describes itself as inert
after it stops being inert is the same lie as a chip that lights and does
nothing.

---

## What this order does not decide

- ~~**Angles.** Movie's, later.~~ **Closed 14 Sep: there are no angles in
  TOY.** Movie: *"no angles in toy"*. This is not deferred and it is not a
  gap to be filled later — it is the board. Every TOY wall is cardinal and
  every TOY length is a whole foot, and a drawing that wants an angle is a
  drawing that wants DRAFTING (§7). Do not build an angle affordance, a
  diagonal snap, or a "hold a key to go off-axis" escape hatch; a diagonal
  reaching a TOY drawing by any route is the §3 defect, not a feature.
- **The UI for the level lock.** Where the switch lives and what it looks
  like is Skipper's rail, not yours. The behaviour is §5a; the control is not.
- **Roof pitch and ridge direction.** Movie's, and they gate 3D. The
  hipped default, the gable switch and the terminated edge where a lower roof
  meets the storey above are ruled — see §5. Everything else about the shape
  is not.
- **The piled rungs above 4'-6".** In the module, out of TOY, "for now".
- **Which DRAFTING tool comes first.** Not this order.
- **The iPad.** APPLE/IPAD is a platform, not a board, and not a third button.
- **Interior walls — half ruled, 14 Sep.** Movie: *"make interior walls as
  bones but we will need to figure those out more maybe"*. So the 31 Aug
  question *do interior walls have bones, or does the user move rooms?* is
  answered — **bones** — and nothing else about them is. **Do not build one
  in this order.** Two things make an interior bone a different animal, and
  both are open:
  - **It has a room on each side.** Drag an exterior wall and the house grows.
    Drag an interior one and one room grows exactly as much as its neighbour
    shrinks — so the room-minimum rule in `allowedMove` has to answer for
    **both** sides of the same drag, and refuse when either side would go
    under. Today it answers for one.
  - **It is not on the master.** The boneyard master is the house's outline,
    and an interior wall is not on it — so either the master grows an interior
    or interior bones are per-level and never follow the master at all.
    Unruled. Do not pick one by building it.

---

## Acceptance

1. In TOY, a press-drag-release ending off-axis and off-foot commits a wall
   that is exactly axis-aligned and a whole number of feet. Assert the
   committed geometry, not the cursor.
2. Press-again-and-drag reaches the same wall as press-drag-release, and the
   check performs each gesture rather than naming one and tapping twice.
   A length reads on screen while the line is being drawn, in whole feet in
   TOY, and it is the number that reaches `commitWall` — assert them equal,
   not merely both present.
2b. A house drawn by hand in TOY has a **level outline and a bone** when the
    gesture finishes — not walls alone. Assert the outline exists in the
    saved drawing, reload, and assert the bone is there to grab.
2c. An **imported off-grid wall** nudged once in TOY lands on the nearest foot
    mark; nudged again it moves a whole foot. Assert both, and assert the
    walls nobody touched did not move. Written on an imported drawing — on a
    TOY-born house this check asserts nothing.
2d. A second run drawn **not touching** the first, on the same level, makes a
    **second outline and a second bone** — not one polygon joining the two.
    Assert two bones after reload, and assert dragging one leaves the other
    where it was.
2e. With a run unfinished (two taps down), a tap started away from it creates
    **nothing** and **loses nothing** — the two taps are still there — and the
    page says the run is unfinished. Assert all three; the silent drop passes
    a check that only counts bones.
2f. Escape with a run pending clears it, and a new run then starts freely and
    is not refused. Putting the tool down does **not** clear it — that is the
    state the refusal exists for, so assert the refusal is reachable.
3. In TOY, an unavailable tool cannot be armed and is visibly down.
4. In DRAFTING the same gestures commit the off-axis, off-foot wall they
   commit today. **TOY must not leak.**
5. Dragging a level's bone moves that level's floor and wall nodes together;
   the perpendicular walls stretch rather than detach.
6. A main or upper floor stops at 2'-0" of cantilever and the stop says why;
   moving the foundation or boneyard bone out underneath it is not capped
   there.
7. Clicking a bone offers break/move; a break lands on the clicked foot mark;
   the two halves then move independently.
8. Moving the topmost storey's bone moves the roof bone with it.
8a. **Pull the top storey back** and the main floor area it uncovers has a
    roof over it — assert the covered region, not that a roof record exists.
    Push it back out and that roof goes again.
8b. **A floor wider than the one above it** carries a roof over the part that
    sticks out, at its own level. Assert on a two-storey where the storeys
    genuinely differ; on a plan where they match, the check asserts nothing
    and is the sixth green-and-hollow check of the week.
8c. **Move a level point by hand, then move the master.** The hand-moved point
    is exactly where it was left; every other point on that level moved.
    Assert both halves — a check that only looks at the frozen point passes an
    implementation where the master moves nothing at all.
8d. **Unlock a level, then move the master.** Nothing on that level moves.
    Re-lock it and the master governs it again. A level added while the master
    exists arrives **locked** — assert the default, not just the toggle.
8e. The lock survives save and reload, and a page that does not know about
    level locks still reads the drawing back with its locks intact.
8f. A roof TOY builds comes up **hipped** — assert every edge reads `eave`,
    not that a roof exists. Switch it to gable and assert **which** edges
    changed and that the footprint did not move.
8g. The gable choice survives save and reload, and a roof saved with no edge
    kinds at all still reloads hipped.
8h. A roof on a floor partly covered by the storey above: the edge it shares
    with the upper footprint is **terminated** — assert it carries **no
    overhang** and does not extend under or into the storey above, while the
    free edges still carry theirs. Then move the upper bone back a foot and
    assert the terminated edge moved with it and is still terminated.
8i. Mutate the terminated-edge rule to treat that edge as an ordinary eave.
    The check must go red on the overhang, not on the edge count.
9. Typing a length in TOY raises the confirm. **Stay in TOY** leaves wall
   count and board unchanged; **Continue** sets `body[data-board]` to
   `drafting` and commits the wall.
9b. **Asking for an angle raises the same confirm.** Stay in TOY leaves the
    geometry cardinal and the board unchanged — assert the wall is still
    axis-aligned, not merely that nothing crashed; Continue promotes and takes
    the angle.
9c. **There is no way back.** A promoted drawing offered TOY refuses, with the
    reason visible on the page, and the geometry is untouched afterwards —
    assert the diagonal is still diagonal, because the failure this guards
    against is a silent squaring.
10. The confirm does not appear twice on one drawing, and does appear on a
    different one.
11. Board survives reload; a promoted drawing reloads as DRAFTING.
12. **Round trip.** A TOY drawing and a DRAFTING drawing are one format.
    *A page may show less than the file contains; it may not save less.*
    Nothing here adds a board-shaped field an older page would drop.

Mutate each check once and watch it fail before believing it. An aimed mutant
that survives means either nothing can see this or it was aimed at the wrong
check — and from here those look identical.

---

## Two standing instructions

**The diagnosis above is a reading, not a fact.** Line numbers and claims
about `toy-constraints.js` were read while writing this and the file changes.
Four times on TOY already a measurement has contradicted a work order and the
measurement was right. If this order says something the code disagrees with,
the code wins and I want to hear about it.

**Movie will test this and add more.** Build the described thing, not the
anticipated one; he has said plainly that more is coming.
