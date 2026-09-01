# Scoping note — the two site targets (board NEW-5, part 3)

**From:** Skipper, 1 Sep, part 3 of board NEW-5
**Status:** scoping only, plus one format field. The targets were not built.

## What was asked

> *"there should also be a red target like the green one added to the site plan
> (one target will identify a location on the site plan (registration mark) and
> the other target registration point for the house)"* — and the reason:
> *"then they can be moved easy without messing with anything else"*.

Green is the house's own datum. Red is where on the lot that datum sits. Line
them up and the building is placed.

## What landed

`siteRegistration` — `{ x, z, angleRad }`, or `null` for unregistered — in the
drawing format, normalised on load and round-tripped through save. No UI reads
or writes it yet.

It is here now because it is the one piece that gets expensive later: every
drawing saved between today and the day the targets exist would otherwise have
no field, and adding one then means migrating them. The angle is in for the
same reason — a building set at an angle to the street is ordinary, and a
rotation added after drawings exist is a migration rather than a number.

## Why the targets did not land

Not because SITE is missing. SITE is a real level (id 8) and already a
whole-level drafting context — *"Levels without layer sets (ROOF, SITE) are one
whole-level drafting context where every command is available"* — so it can hold
geometry today. Two markers on it would be a small job.

The blocker is that **nothing renders the house positioned on the lot.** There
is no site painter: the only `setback` in `MODEL.dc.html` is the stair-opening
kind. So a red target would be a circle that moves nothing, and the drag —
which is the entire point of the pair — would look broken rather than
unfinished. Building it now would also bank a data shape before anything reads
it, which is the expensive kind of guess.

## What it would take

1. **A site painter.** Draw the house's plan onto SITE, positioned by
   `siteRegistration` and rotated by its angle. This is the real work: it needs
   the plan's own geometry transformed into site space at draw time, and the
   house must go on storing only its own numbers — the transform belongs to the
   painter, never to the walls.
2. **Two markers and their drag.** Cheap once (1) exists: green reads
   `drawingOrigin`, red reads `siteRegistration`, and dragging red writes the
   registration back. `_drawOrigin2D` is already the shape for both.
3. **A rotation handle,** or the angle stays a stored number nothing sets.
4. **The green target's move.** It sits at the datum in model space today, which
   is where board NEW-5 part 2 left it deliberately: the origin still has hold
   of the cursor, and an unseen snap target is worse than a marker on a node the
   drafter placed. When SITE can show it, model space can stop.

## The order that suggests

(1) is a board on its own and gates the rest. (2) and (3) are one small board
after it. Nothing here is urgent — the format is what had a deadline, and it has
landed.
