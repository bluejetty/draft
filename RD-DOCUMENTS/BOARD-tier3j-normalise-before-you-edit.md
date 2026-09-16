# BOARD — a tool that edits a collection makes that collection normalisable

**Movie, 16 Sep:** *"i'd like all the drafting tools to work"*

Status: **BUILT, 16 Sep.** The rung below is done: beams, columns, shapes and
fixtures are normalised in MODEL.html's load block and re-emitted on save.
`notes` is NOT — see THE RUNG. Originally filed as **MEASURED, not built**. This is the measure-first gate on
tier 3j (the seven small tools — beam, column, trim, shape, node, annotation,
fixture) reporting what it found, and the rung it defines.

---

## What was measured

MODEL.html's load block (`drawing = { ...parsed, ... }`) normalises **four
collections and three scalars**, and nothing else:

    walls   lines   floors   dimensions
    board   boardPromptSeen   autoDimFirstOffsetFt

Everything else rides through on `...parsed` exactly as the file wrote it.
That includes `beams`, `columns`, `shapes`, `fixtures` and `notes` -- four of
which are the storable half of 3j's seven.

`drawing-format.js` already EXPORTS a normaliser for every one of them.
`F.beams`, `F.columns`, `F.shapes`, `F.fixtures` and `F.notes` are public and
never called by this page.

## THIS IS NOT AN OVERSIGHT, AND THAT IS THE WHOLE POINT

The load block states the rule it is following, two lines above the first call:

> Round-tripping junk is the Write Tier's job for GEOMETRY it cannot
> understand; a scalar the page acts on gets normalised on the way in.

So geometry the page does not act on is carried through UNEXAMINED ON PURPOSE.
A beam MODEL.html can neither draw nor edit is not its business to validate,
and re-emitting it byte for byte is how a page that understands half a drawing
avoids destroying the other half.

**Tier 3j is the moment that stops being true.** The instant a tool can place
or move a beam, the page is acting on beams, and the page's own rule says a
collection it acts on is normalised on the way in. The rule does not change;
3j walks the collections across the line the rule already draws.

## WHAT IT COSTS TO CROSS THAT LINE WITHOUT NOTICING

The `lines` normaliser records the exact failure, and it is a SILENT one:

> passing `{}` here read fine -- a flattened layer still paints -- but the
> Write Tier re-emits what it loaded, so a save through this page would have
> quietly moved every A-DOOR and A-GLAZ line to draft.

Nothing went red. The drawing still painted. The damage was written to the
file on the next save and would have been discovered by a drafter, not by a
test. An edit gesture on an un-normalised collection has that same shape: the
first malformed record is carried in, acted on, and written back out.

## THE RUNG — BUILT

**Wire the four existing normalisers into the load block, before any palette.**
Smaller and better defined than "build seven tools", and it is the precondition
for the rest: `F.beams`, `F.columns`, `F.shapes`, `F.fixtures` -- with their
`drops` arrays, as `walls`, `lines`, `floors` and `dimensions` already do, so a
refused record is reported rather than vanishing.

`notes` rides with them if the annotation tool is in scope; it is painted today
(`drawNoteScreen2D`, off `drawing.notes`) and equally un-normalised. **It was
NOT wired**: the rung took the four collections a small tool will PLACE, and
annotation was not among them. The harness keeps that gap named.

### WHAT THE BOARD GOT WRONG, AND IT MATTERED

This said the four normalisers already took `drops` "as `walls`, `lines`,
`floors` and `dimensions` already do". They did not. `beams`, `columns`,
`shapes` and `fixtures` were TWO-parameter functions with no sink at all, so
wiring them in as written would have made a refused record vanish -- worse than
the state it replaced, where a malformed beam was at least carried through
intact.

So the rung grew a first half: those four now take `env = {}` and route their
mapped array through `collectRefusals`, the helper `dimensions` already used.
That is what makes the second half safe. `withRefused()` puts a refused record
back on save, so refusing is DECLINING TO ACT ON a drafter's geometry rather
than deleting it from the file -- proved end to end by
`tests/model-small-tools-refusals.spec.js`, watched failing with the save's
`withRefused('beams', ...)` removed.

## WHAT IS STILL UNMEASURED

**Preserved and linked, per tool.** Whether a beam survives a save/reload with
its fields and its host intact is a ROUND-TRIP claim, and no reading of the
source settles it. That wants a `proto/` harness that pushes one of each tool
through the real format, saves, reloads, and reports what survived and what
kept its host -- asserting on what the format PUBLISHES rather than on values
the harness re-derives.

Two greps were thrown away getting this far, and they are the argument for the
harness rather than more reading:

  - `trim` appeared 47 times in `drawing-format.js`. Every one was
    `String.trim()`.
  - "annotation has no collection" was wrong. `drawing.notes` exists, is
    painted, and was missed by the pattern that listed the collections.

## WHAT IS NOT IN DISPUTE

Of the roster's 19 tools, MODEL.html branches on FOUR: `wall` (six branches),
`fenestration`, `column`, `beam`. The other fifteen set `activeTool` and
nothing reads it -- which the page says out loud and on purpose:

> what a tool does -- pressing a key sets `activeTool` and that is all -- so a
> tool whose gesture is not written yet still lights, still says what it would
> do, and still puts the previous one down. A key that did nothing at all
> would be worse than no key: it would look like a working tool.

The roster agrees from its own side: `annotation`, `column`, `beam` and
`fixture` all carry `command: null`.
