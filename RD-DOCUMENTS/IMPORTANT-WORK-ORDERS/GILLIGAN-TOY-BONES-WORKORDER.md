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

When the outline is made, the drafter sees the **BONE outline**. From then on:

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

- **Angles.** Movie's, later.
- **The master bone's behaviour.** Still moving.
- **Roof shape re-derivation.** Movie's, and it gates 3D.
- **The piled rungs above 4'-6".** In the module, out of TOY, "for now".
- **Which DRAFTING tool comes first.** Not this order.
- **The iPad.** APPLE/IPAD is a platform, not a board, and not a third button.
- **Interior walls.** The 31 Aug spec still lists *do interior walls have
  bones, or does the user move rooms?* as open. It is still open.

---

## Acceptance

1. In TOY, a press-drag-release ending off-axis and off-foot commits a wall
   that is exactly axis-aligned and a whole number of feet. Assert the
   committed geometry, not the cursor.
2. Press-again-and-drag reaches the same wall as press-drag-release.
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
9. Typing a length in TOY raises the confirm. **Stay in TOY** leaves wall
   count and board unchanged; **Continue** sets `body[data-board]` to
   `drafting` and commits the wall.
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
