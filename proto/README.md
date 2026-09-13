# The fixtures

Saved drawings the specs and harnesses open. They are **inputs to tests**, not
worked examples of how a house should be drawn.

| file | what it is |
|---|---|
| `repro-garage-house.draft` | 24 walls, 60 dimensions, an attached garage. The default house for the cut-view, seat, shell and top-bar specs. |
| `repro-L-house.draft` | 18 walls, an L footprint. Used where a non-rectangular outline matters. |
| `repro-courtyard-house.draft` | 24 walls around a courtyard — an outline with a hole in it. |
| `perf-bungalow.draft` | **A timing fixture. See below.** |

## `perf-bungalow.draft` — what it is and what it is not

A dealt BUNGALOW saved off Movie's own machine, kept because its shape is
unlike the other three and because the timing questions need a real drawing
rather than a convenient one.

**Test fixture only. Never shown on the site, never offered as a sample plan
or a reference for any house type. Replaceable on request.** Movie's condition,
in his words:

> "its not the sample house, but they can use it if they need it for coding,
> not to be used as an example bilevel"

> "the bungalow draft file is only for testing but not for display on the
> website they can save it if they want too or i can get them another whenever
> they need it"

The authored HOME PLANS are drawn separately. Do not cite this file as how a
bungalow is laid out, and do not build a house template from it.

What makes it useful for timing, each counted from the file rather than
described from memory:

- **50 dimensions against 20 walls** — 2.50 per wall. No other fixture comes
  near that ratio, and the dimension pass is a real share of a plan paint.
- **4 beams and 3 columns.** `MODEL.html` has no `drawBeam2D` or
  `drawColumn2D` call today, so seven pieces of structure in this file are
  stored and not painted. That is an acceptance case sitting in the repo.
- **16 fenestrations and 2 stairs**, where the other fixtures are mostly bare
  walls.
- **Two non-orthogonal `lines`** (`line-1`, `line-2`, level 3, `draft` layer)
  that were not meant to be drawn. They are lines, not walls — the walls are
  all orthogonal — and they are kept rather than tidied, because a fixture
  that only contains what someone meant to draw is not a fixture.
- **2 groups, 1 level lock, 2 surface openings** — none of which the other
  fixtures carry, and each one a code path that otherwise only runs on
  hand-built test data.
- `fixtures: 0`, `roomTags: 0`. It is a dimensioned shell, not a full house.
  Worth knowing before anyone calls it a complete drawing.

### The reason it exists at all

This file is what proved the page was not the problem. Measured on it:

| | plan paint | rail |
|---|---|---|
| here | 1.6 ms | 21 ms |
| Movie's machine | 33 ms | 122 ms |

Same file, same code. Rasterisation is ~20x slower there and JS geometry only
~5.8x — which is canvas 2D on the CPU, not anything this repo can fix. An
empty sheet costs that machine 21 ms to paint and costs this one 0.4 ms.

**A frame budget measured on one machine is not a frame budget.** Every
long-task and frame-budget check in `tests/` is calibrated against a machine
that paints for nearly free, and this fixture is the record of how far that is
from a drafter's.
