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

Re-snapped to the mm grid: 3658 × 3 = 10974 = the overall. Zero discrepancy.
Total geometry movement: **1.20 mm over 36 feet.**

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
