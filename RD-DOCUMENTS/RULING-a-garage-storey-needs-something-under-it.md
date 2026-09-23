# RULING — a storey over a detached garage needs a foundation that can carry it

**Movie, 23 Sep 2026:**

> *"when the detached garage has grade beam or frost wall a 2nd floor should
> be offered (with stairs). a 'thickened edge' doesn't allow for 2nd floor"*

Status: **RULED, NOT BUILT.** Recorded the moment it was said, because it adds
a combination rule to a menu that currently offers three foundations with no
opinion about what stands on them.

---

## The rule, in one line

**A DETACHED GARAGE MAY TAKE A SECOND FLOOR ON A GRADE BEAM OR A FROST WALL,
AND NEVER ON A THICKENED EDGE.** The second floor comes with a stair.

| foundation | second floor | why |
| --- | --- | --- |
| thickened edge | **no** | a floating slab, 1'-0" at the edge, monolithic on gravel |
| grade beam | **yes** | 32" perimeter member **on piles** — the piles carry it |
| frost wall | **yes** | 8" concrete on a strip footing, to the house's footing depth |

## Why, from this repo's own numbers rather than from first principles

`SPEC-garage-foundations.md` already carries the three sections, and the
answer falls out of them.

**The frost wall is the easy yes.** It is *"to the house's footing depth, 8"
concrete on a strip footing"* — the same kind of foundation a house sits on.
A storey adds load, so the footing gets sized for it; nothing about the KIND
of foundation objects.

**The grade beam is a yes about the PILES, not about the beam.** PROJECT.html
says it outright: *"a grade beam on piles has no spread footing."* The beam
does not carry the storey to the ground — it spans between piles, and the
piles do. So the combination is sound exactly when the pile schedule is sized
for the load, which is an engineer's number and not a default this app may
assume.

**The thickened edge is the no, and the app already half-says it.** Movie
ruled on 4 Sep that an ATTACHED garage cannot take one: *"it will move / the
house foundation is solid and will cause cracking."* A floating slab fastened
to something that does not float cracks at the joint. A storey standing on
that slab is the same objection carrying more load.

## Where the rule belongs: the FORMAT, not the menu

There is a precedent in the tree and it should be followed rather than
re-invented. `GARAGE_FOUNDATIONS` in `project-page.js` lists which foundations
each garage may take, and `SPEC-garage-foundations.md` says exactly what that
list is:

> **`drawing-format.js` refuses to store it, so the list above is the
> drafter's view of a rule rather than the rule itself.**

So "detached garage + second floor" must be refused for a thickened edge in
`drawing-format.js`, and the menu's job is only to keep a drafter from asking.
A rule enforced in the menu alone is a rule a saved file can contradict.

## What the stair costs, which is the part that is not free

*"(with stairs)"* is the expensive word. A detached garage today is a loop, a
slab and a roof on ONE level. A second floor means:

- a second level on a building that has never had one
- a stair between them, which wants a run, a landing and a floor opening
- headroom over that run, which is what decides whether the roof can stay the
  shape it is
- a floor assembly over the garage — and `level-assembly.js` already owns
  what a floor is made of

None of that is decided here. This ruling says WHICH foundations may carry a
storey, and nothing about how it is drawn.

## Not decided, and worth asking before anything is built

1. **Living space or storage?** It changes the load, and it changes whether
   the space wants a frost-protected foundation for comfort as well as
   strength.
2. **Does the stair go inside the garage footprint or into a bump-out?**
   Inside costs parking; outside costs a loop that is no longer a rectangle.
3. **What sizes the piles and the footing?** An engineer. The app can offer
   the combination and draw it; it cannot size it, and
   `ADVERTISEMENT/STANDARD-ENDCARD.md` already says so in public.
