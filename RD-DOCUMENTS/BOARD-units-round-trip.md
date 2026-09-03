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

## A correction that was itself wrong — read this before "fixing" the above

On 3 Sep this board was edited to say the worked example above could not
happen, on the grounds that nothing in the app prints millimetres. **That edit
was wrong and has been reverted.** The example is correct as written.

The error was a one-polarity grep. Searching `units === 'metric'` finds four
sites — save, load, `_gridStepFt()`, LAYOUT's load — and none of them formats
anything, which reads as "there is no metric display". **The display branches
test the other side:**

```js
this.state.units === 'imperial' ? this._ftIn(value) : this._metric(value)
```

Seven such sites, all invisible to that grep. And:

```js
_metric(feet) { return (feet * 0.3048).toFixed(3) + ' m'; }
```

Metres to three decimals **is** millimetre precision — the app prints `3.658 m`
where this board says `3658 mm`. Same number, different label.

Two things follow, and both matter:

- **Metric mode is not half-built.** The snap grid is 1 mm and the display
  resolves to 1 mm. They agree.
- **A grep for one side of a boolean is not a search for the concept.** A
  fall-through branch is invisible to it, and an absence found that way is a
  fact about the query. Caught by Gilligan reading the branch sites rather than
  accepting the claim.

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

## CURRENT RULING — Devin, 3 Sep (amends board #313)

**The toggle re-snaps.** Movie's ask supersedes #313's soft-switch behaviour.
The recommendation in this board stands; what follows below it is the history of
how it got here, kept because the reasoning matters.

Devin's reasoning, so the amendment does not read as a whim:

- **#313's "never automatic" was aimed at SOFTWARE-initiated geometry movement.**
  A drawing must never re-snap because it was opened, loaded or re-derived. A
  drafter pressing the toggle is a deliberate act. The two were fused because
  the re-snap was assumed to be a walk that accumulates.
- **The measurements killed that assumption**: one settle under 1 mm, idempotent
  both directions afterwards (0 of 7,681 points moved on the imperial round
  trip), worst single move 0.79 mm against a framer's ±3 mm — which is the
  "≤1/32", invisible" bar #313 itself set for the hard re-snap.
- **The soft switch's safety was partly illusory.** Its justification was
  "always safe", but it prints partials that do not sum to their overall with
  no indication anything is approximate. *A display that quietly lies about sums
  is less safe than a settle nobody can see.*

### The illustration in this board was wrong; the requirement was right

Measured by Gilligan, 3 Sep, building it: re-snapping **each node from the
datum** yields segments of **3658, 3657, 3658 mm — summing to 10973, which *is*
the overall.** The goal is met *exactly*, not approximately.

This board illustrated it as 3658 × 3 = 10974 matching an overall of 10974.
That is not what the fix does, and the difference matters:

- **Snapping positions telescopes.** The overall is the difference between the
  first and last snapped node, so the partials sum to it *by construction*.
  There is no residual error to argue about.
- **Getting three equal 3658s would mean accumulating snapped LENGTHS**, which
  is a different algorithm, is not requirement 1, and would drift the far end of
  a long run.

**The real cost is not a leftover millimetre in the sum. It is that three walls
a drafter drew equal no longer print equal** — 3.658 / 3.657 / 3.658. That is
the trade being made, and it is the one to put in the CONVERT confirmation,
because it is the thing a drafter will notice.

### Three constraints kept from #313

1. **`_resnapToUnits()` stays a pure, standalone function.** The toggle calls
   it; it remains its own seam and could still become a separate command.
2. **Load never re-snaps.** Opening a drawing, in either mode, moves nothing.
   The drafter's toggle press is the only trigger. **Pin it with a spec.**
3. **Record the amendment on #313 itself** — "toggle performs the re-snap
   (Movie's ask, measured invisible-on-paper, 3 Sep); soft-only display retired"
   — so the retired ruling does not become folklore that contradicts the code.

> The distinction that survives is not *automatic vs commanded* but
> **software-initiated vs drafter-initiated**. A load, a re-derive or an import
> must never move geometry. A press may.

---

## Superseded: the soft-switch ruling this board was rewritten for

**The toggle is a soft switch.** Board #313 / audit Q2 rules it display-only: it
re-prints the drawing in the other system and does not touch geometry. A hard
re-snap is a **separate, deliberate command** — never automatic, never a side
effect of switching.

That overrules this board's central recommendation, which was to re-snap on the
toggle. It is the better design and for a reason I did not have: **a drafter who
switches units to read something is not asking to have their drawing altered.**
Announcing the change, which is what I proposed instead, is a worse answer to
that than simply not making it.

**What survives, unchanged:**

- The problem is real. An imperial drawing read in metric shows partials that
  do not sum to their overall — 3.658 × 3 against 10.973. A drafter sees it.
- The measurements below stand: the two grids do not divide each other, worst
  single re-snap is 0.79375 mm, and round-tripping is stable (imperial exactly,
  metric settling once within 1 mm).

**What changes:** those numbers now describe **what the deliberate command
costs**, not what a toggle does behind the drafter's back. They are the answer
to "what happens if I run CONVERT TO METRIC", which is a question a drafter is
entitled to ask before pressing it — so they belong in that command's
confirmation, not in a notice after the fact.

> Worth recording plainly: every measurement on this board held up under
> challenge, and both of its design opinions were wrong — first the direction,
> then the trigger. Measurement lives in the code and can be checked. Intent
> lives in the head of whoever designed it, and guessing at it produced a
> confident, well-evidenced, wrong proposal twice running. **Ask the designer
> before proposing; measure before believing.**

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
