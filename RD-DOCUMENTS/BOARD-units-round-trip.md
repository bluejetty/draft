# BOARD — switching units should re-snap the drawing

**Movie, 3 Sep:** *"the convert back and forth from 1/16" scale to 1mm smallest
scale and just jump the nodes over a tiny tiny bit so the drawing actually
changes in size slightly (under mm)… it actually fixes a drafting problem, it
makes the mm to imperial conversions work better."*

Status: **BUILT, 3 Sep.** The code lives in MODEL.dc.html — `_resnapToUnits()`,
called from `_setUnits()`, covered by `tests/units-resnap.spec.js`.

**Amendment to board #313 / audit Q2, 3 Sep, on Commander Devin's authority.**
#313 ruled the units toggle a SOFT switch — display-only re-print, with any
hard re-snap a separate deliberate command, never automatic. **The toggle now
performs the re-snap.** "Never automatic" was aimed at SOFTWARE-initiated
movement — a drawing must never re-snap because it was opened, loaded or
re-derived — and a drafter pressing the toggle is a deliberate act. The ruling
fused "automatic" with "on the toggle" on the assumption that re-snapping was a
walk that would accumulate; the measurements below killed that assumption.
Soft-only display is retired. Load still never re-snaps, and that is pinned by
a spec.

The old ruling is recorded here so it does not become folklore that contradicts
the code.

---

## The current behaviour, and why its reasoning is inverted

`_gridStepFt()` already picks the grid from the project's units — `1/192` ft
(a sixteenth of an inch) or `0.001/0.3048` ft (a millimetre). The comment above
it (MODEL.dc.html:9328-9338) then rules:

> Units are a property of the project rather than a view toggle: switching later
> re-labels the drawing and leaves the geometry where it is, which reads
> untidily in the new system and is **not silently re-snapped**.

So today: **switching units moves nothing.** That preserves coordinates exactly
and pays for it with numbers that do not agree — which is precisely the trade
board NEW-5 rejected. Its own comment, four lines higher:

> a wall could sit at 12.0001' while its dimension printed 12'-0": the partials
> then failed to sum to the overall, and the only way to make the numbers agree
> was to nudge the wall by a sixty-fourth that existed nowhere on screen.

Leaving geometry alone across a unit switch **recreates that exact bug in the
other system.**

## The proof: three 12'-0" walls, shown in mm

Drawn on the sixteenth grid, relabelled to mm without re-snapping:

| | exact | printed |
|---|---|---|
| each segment | 3657.6 mm | **3658** |
| overall | 10972.8 mm | **10973** |
| partials as printed sum to | | **10974** |

**A 1 mm discrepancy on the sheet, with nothing wrong in the drawing.** The
drafter's only fix is to nudge a wall by an amount that exists nowhere on
screen — NEW-5's bug, verbatim.

Re-snapped to the mm grid, the discrepancy is zero. Total geometry movement:
**1.20 mm over 36 feet.**

**Correction, 3 Sep (Gilligan, measured while building it).** This line first
read "3658 × 3 = 10974 = the overall", and that is not what snapping every node
from the datum produces. The nodes land on 0 / 3658 / 7315 / 10973 mm, so the
segments print **3658, 3657, 3658** — summing to 10973, which IS the overall.
The goal is met exactly; what is not preserved is the three walls being EQUAL.
Getting 3658 × 3 would mean accumulating snapped segment *lengths* rather than
snapping nodes, which is not requirement 1 below and would drift the far end of
a long run. Requirement 1 is right; the illustration under it was wrong.

## The two grids do not divide each other

1/16" = **1.5875 mm** exactly. The finest grid that represents both is
0.0125 mm (1 mm = 80 steps, 1/16" = 127 steps) — far too fine to snap to, which
would be free-real geometry again and is the thing NEW-5 removed. So there is no
shared grid to retreat to: one system or the other must give, and the active
one should win because it is the one being read.

Worst single re-snap:

| | move |
|---|---|
| a mm point onto the sixteenth grid | 0.79375 mm |
| a sixteenth point onto the mm grid | 0.50000 mm |

Below any construction tolerance. A framer works to ±3 mm at best.

## Switching back and forth is stable — measured, not assumed

Ten full round trips, every point re-snapped each way:

| | points moved | worst total drift |
|---|---|---|
| **imperial → metric → imperial**, every 1/16" over 40 ft (7,681 points) | **0** | **0.00 mm** |
| metric → imperial → metric, every mm over 12 m (12,001 points) | 4,441 | **1 mm** |

**An imperial drawing is perfectly stable**: a sixteenth snapped to mm and back
always returns to the same sixteenth, because the return trip moves at most
0.5 mm while the next sixteenth is 1.0875 mm away.

**A metric drawing settles once**, by at most 1 mm, and then never moves again —
ten round trips give the same 1 mm as one. It is a fixed point, not a walk.
That is what makes "change freely back and forth" safe.

## What the build needs

1. **Re-snap every node from the datum** on a unit switch, through the existing
   `_quantise` with the new `_gridStepFt()`. One code path, already written.
2. **Announce it.** The old comment's one good instinct is that geometry must
   not move behind the drafter's back. The answer is to say so — *"re-snapped to
   mm: 42 nodes moved, max 0.79 mm"* — not to refuse to move.
3. **Undoable as a single step.** It is a document-wide edit.
4. **On the toggle only, never on load.** Opening an old drawing must not
   rewrite it, or the standing rule "old drawings must keep opening" quietly
   becomes "old drawings keep changing".

Already in place: `_quantise` counts from the datum, so the grid a node lands on
is the grid the screen draws; and **ROUND THE NODE, NEVER THE DERIVED** means
centrelines, joins, face offsets and dimensions all recompute themselves.

## The comment to correct

MODEL.dc.html:9336-9338. Its facts are right — a millimetre is not a sixteenth
of anything, and a metric drawing on a sixteenth grid steps in 1.5875 mm. Its
conclusion does not follow: it treats moving the geometry as the harm, when the
harm NEW-5 identified is numbers that do not agree. A drawing is instructions to
a builder, and the builder reads the numbers.
