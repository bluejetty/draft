# BOARD — switching units should re-snap the drawing

**Movie, 3 Sep:** *"the convert back and forth from 1/16" scale to 1mm smallest
scale and just jump the nodes over a tiny tiny bit so the drawing actually
changes in size slightly (under mm)… it actually fixes a drafting problem, it
makes the mm to imperial conversions work better."*

Status: **proposed, measured, not built.** The code lives in MODEL.dc.html.

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

## CORRECTION, same day: the direction was wrong, and the real bug is worse

The first version of this board proved its case with three 12'-0" walls
*shown in mm*: partials printing 3658 each, summing to 10974, against an
overall printing 10973. **That cannot happen, because nothing in this app ever
prints a millimetre.**

Measured: `formatters.js` has eight functions and all are imperial —
architectural inches and sixteenth fractions. Exactly four sites read
`units === 'metric'`: save, load, `_gridStepFt()`, and LAYOUT's load. None of
them formats anything.

**So the METRIC toggle changes where nodes land and nothing about how the
drawing reads.**

### Which produces the mirror bug, live on main today

In METRIC mode a node snaps to 1 mm and then prints rounded to the nearest
sixteenth. Three walls, metric-snapped:

| | |
|---|---|
| segment 1 | 3658 mm → **12'-0"** |
| segment 2 | 3658 mm → **12'-0"** |
| segment 3 | 3658 mm → **12'-0"** |
| overall | 10974 mm → **36'-0 1/16"** |

**The partials print 36'-0". The overall prints 36'-0 1/16".** A sixteenth of
an inch adrift on the sheet, with nothing wrong in the geometry — NEW-5's exact
bug, alive right now, and it needs no unit switch to appear. Being in metric
mode is enough.

### What that does to this board's scope

Re-snapping on a unit switch presumes **two working unit systems** to convert
between. There is one. A drawing made tidy on the millimetre grid is still
displayed in sixteenths, so the tidiness never reaches the sheet.

**The prerequisite is a metric formatter**, not a re-snap. Once metric lengths
print in millimetres, everything below applies unchanged and the re-snap is the
right second step. Until then, metric mode is half-built: the snap grid respects
the units and the display does not.

The measurements below stand — they are about the two grids, not about which
one is displayed.

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
