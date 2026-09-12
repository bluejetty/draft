# RULING — paint the substitute, never persist it

**Ruled by Movie, 11 Sep**, on the first finding the round-trip gate produced.
**Applies to:** `MODEL.html`, and to every page that becomes a writer after it.

## The finding

`LEGACY_WALL_TYPES` is `{ concrete_12: 'concrete_8' }` (`wall-types.js:19`) —
a retired 12" concrete foundation mapped to *"their closest current
assembly"*, which is four inches thinner. `MODEL.html` applies that mapping on
load, and its serializer re-emits what it loaded. So a no-op round trip through
the new page rewrites the drafter's 12" foundation walls to 8" and saves it, on
a press the drafter believes changed nothing. Measured, not argued:
`wall-13.wallType was "concrete_12" now "concrete_8"`, revision moved.

## The ruling

**A substitution made to paint is not a fact about the drawing.**

- The page **may** substitute in order to paint. It has no 12" assembly; drawing
  nothing is worse than drawing 8".
- The page **must not** write the substitute back. The file keeps
  `concrete_12`.
- The drafter should be able to find out. A count in the readout, in the same
  voice the dropped-item count already uses — this page says what it could not
  do rather than looking like it did it.

## Why it is a ruling and not a preference

The mapping is not lossy-and-recoverable, it is **lossy and one-way**. Nothing
in the saved file records that a wall was ever 12". Thicker wall types are
coming back — they are one row each in the `WALL_TYPES` table, so the loss is
not permanent for the *app* — but a drawing that has already been round-tripped
does not come back with them. Every day the substitution is persisted is a day
of old files quietly losing four inches of foundation that no later feature can
restore.

## What this generalises to, and it is the larger half

This is the same shape as §3.1 of the round-trip order, which is still awaiting
its own ruling: the new page **drops** items its normalisers reject, and then
writes the dropped version back. Same defect, different field — *the reading
page's accommodation is being persisted over the drafter's record.*

The general rule this establishes, for the ruling on §3.1 to be measured
against: **a page may show less than the file contains; it may not save less
than the file contains.** Substitution and rejection are both accommodations
made to get something on screen. Neither is a fact, and the file is where the
facts live.

## Scope

Implementation is not this note's to specify, and the round-trip gate is the
wrong PR to hide it in. The likely shape is that the load path keeps the
original id beside the substituted one and the serializer re-emits the
original — but that is a design question with its own test surface, and it is
one of the two rulings the gate has produced rather than part of the gate.

Widening continues; this comes out as its own lane.
