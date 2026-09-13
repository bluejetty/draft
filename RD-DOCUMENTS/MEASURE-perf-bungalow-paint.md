# The 33 ms, measured on the house it came from

**Gilligan, 13 Sep.** Movie sent his real drawing after the screenshot showing
`paint 33.00 ms   rail 122.00 ms`. Every frame number this project has tuned
against came from `proto/repro-garage-house.draft`, a fixture an order of
magnitude smaller. This is that offer paid off: the real bytes, through the
shipping page.

The file is `proto/perf-bungalow.draft`, which **arrives with #393** —
Skipper committed it there, byte-identical to what is measured below (same md5,
37069 bytes), under the name the tool-column order's acceptance already used.
It is a **test fixture only**, on Movie's own condition: never shown on the
site, never offered as a sample plan. `proto/README.md` carries the condition
in his words. `proto/perf-bungalow-paint.js` and
`proto/perf-bungalow-canvas-sweep.js` read it from that path.

One line in `proto/README.md` this measurement corrects: it says the 2.50
dimensions-per-wall ratio matters because "the dimension pass is a real share
of a plan paint". The ratio is real and the share is real — 0.40 ms of 1.90 ms,
21% — but the total is 1.90 ms, so it is a fifth of nothing. The fixture earns
its keep on the beams, the columns and the washroom stack, not on the dims.

## What the file actually contains

Counted, not eyeballed:

| collection | n | | collection | n |
|---|---|---|---|---|
| walls | 20 | | dimensions | 50 |
| lines | 11 | | fenestrations | 16 |
| floors | 3 | | stairs | 2 |
| roofs | 1 | | surfaceOpenings | 2 |
| **beams** | **4** | | **columns** | **3** |
| outlines | 5 | | boneyardOutlines | 1 |
| groups | 2 | | levelLocks | 1 |
| fixtures | 0 | | notes / roomTags / shapes / electricDevices / underlays / cuts | 0 |

Five levels — SITE, ROOF, 2ND FL, MAIN FL, FOUNDATION — and the file was saved
on MAIN FL.

**The 50 dimensions are not 50 on any one screen.** They are 15 on MAIN FL, 15
on 2ND FL, 16 on ROOF, 4 on FOUNDATION, all auto. `backgroundLevelIds` is
empty, so a paint draws one level. MAIN FL is 37 entities total.

**`fixtures: 0` does not mean the washroom is missing.** Both WASHROOM groups
are present and `dealt: true` — `group-1` on MAIN FL and `group-2` on 2ND FL,
four walls each — bound by `levelLocks: [{ name: "WC STACK" }]`. In this
program a dealt washroom is a rigid group of walls; `fixtures` is plumbing,
which this drawing does not carry. This file **is** the stacked-washroom case
BOARDS.md lists as half-measured.

## Three questions it answers on the way past

**#388's coincident-corner finding, in real data.** One boneyard master,
`outline-4`, four points. All five level outlines carry `masterId:
"outline-4"`. Exactly what the test predicted: the first outline becomes the
master and the rest point at it.

**Beam ends land on column points exactly.** Measured to six decimals:

```
beam 1: start 10.552083 ft from col 1 | end 0.000000 ft from col 1
beam 2: start  0.000000 ft from col 1 | end 0.000000 ft from col 2
beam 3: start  0.000000 ft from col 2 | end 0.000000 ft from col 3
beam 4: start  0.000000 ft from col 3 | end 10.552083 ft from col 3
```

The two loose ends are the foundation wall, not columns. This settles the shape
of the `STRUCT_SNAP_FT = 1` rule still owed on the Group A gesture: the auto
generator produces *exact* coincidence, so the gesture must too. A snap that
lands inside a tolerance but not on the point would produce data unlike the
auto path's, and any test asserting equality would pass on auto data and go red
the moment a human drew the same beam — the failure mode this suite keeps
meeting, arriving from the other direction.

**Seven pieces of structure are stored and not drawn.** The 4 beams and 3
columns are all on FOUNDATION, `view: "foundation"`, `auto: true`, footing
`pad36` — which is the acceptance case in #392, sitting in Movie's own file.

## Where the paint goes

`proto/perf-bungalow-paint.js`. Subtractive: every arm opens the **shipping**
`MODEL.html` and reads its own readout; the arms differ only in the bytes
handed to the page, one collection emptied per arm. Nothing inside the page is
patched, so what is timed is the page Movie runs. Five loads per arm, median.
1600x900, headless Chromium.

```
full house (as Movie saved it, MAIN FL)     paint 1.90 ms   rail 25.00 ms   scale 18.34
  minus dimensions                          paint 1.50 ms   rail 25.20 ms   scale 18.34
  minus fenestrations                       paint 2.00 ms   rail 24.60 ms   scale 18.34
  minus lines                               paint 2.00 ms   rail 24.10 ms   scale 18.34
  minus floors                              paint 2.10 ms   rail 23.40 ms   scale 18.34
  minus stairs                              paint 1.80 ms   rail 22.50 ms   scale 18.34
  minus walls                               paint 1.30 ms   rail  0.50 ms   scale 25.27  <- scale moved
empty shell (every collection zeroed)       paint 0.60 ms   rail  0.50 ms   scale  6     <- scale moved
FOUNDATION level                            paint 2.30 ms   rail 25.30 ms   scale 18.34
```

**The whole plan paint is 1.90 ms.** The largest share any collection holds is
dimensions at **0.40 ms**. The "50 dimensions is what makes it 122" hypothesis
— mine — is **dead on these bytes**: there are 15 dimensions on the painted
level and they cost four tenths of a millisecond.

Two arms re-fit the view to a different zoom when their collection went, and a
different zoom is a different amount of ink for reasons unrelated to the
collection. They are reported and excluded rather than averaged in; that is
what the `scale` column is for.

## So what is 33?

Not the entities: subtraction accounts for the whole 1.90 ms.

Not the pixels either. `proto/perf-bungalow-canvas-sweep.js` sweeps canvas area
and device pixel ratio across **22x** — 1.05 Mpx up to 23.04 Mpx, including
2277x1280 which is Movie's 1366-wide window at his 60% browser zoom:

```
1366x768  dpr1   1.05 Mpx   paint 1.90 ms   rail 26.50 ms
1600x900  dpr1   1.44 Mpx   paint 2.00 ms   rail 26.20 ms
2277x1280 dpr1   2.91 Mpx   paint 2.00 ms   rail 26.20 ms
2277x1280 dpr2  11.66 Mpx   paint 2.40 ms   rail 38.40 ms
3200x1800 dpr1   5.76 Mpx   paint 2.80 ms   rail 27.60 ms
3200x1800 dpr2  23.04 Mpx   paint 2.00 ms   rail 23.20 ms
```

**22x the pixels, 1.1x the paint.** The plan paint is neither fill-bound nor
entity-bound on this house.

What it *is* bound by, at least in part:

```
load 1: paint 10.10 ms   rail 33.30 ms
load 2: paint  2.20 ms   rail 25.30 ms
load 3: paint  1.90 ms   rail 24.40 ms
load 4: paint  1.80 ms   rail 27.20 ms
load 5: paint  2.50 ms   rail 24.20 ms
load 6: paint  2.10 ms   rail 24.50 ms
load 7: paint  2.10 ms   rail 30.10 ms
load 8: paint  2.60 ms   rail 25.00 ms
```

**The first paint after a load costs 5x every paint after it.** Fonts, the
first path, a cold JIT — this does not separate them. What matters is the
consequence:

> **The readout reports the last paint. Right after opening a file, the last
> paint is always the cold one. The number a drafter reads on screen is
> structurally the worst number the page ever produces.**

That is true on any machine and any engine, and it is not an inference from
Movie's screenshot — it is measured above.

## What is left, and what this cannot say

Movie runs **Firefox**. There is no Firefox on the box this ran on
(`/opt/pw-browsers` carries chromium only), so the engine is the one remaining
variable and it is **untested**, not ruled out. A 3x engine difference on
stroke-heavy 2D plus the 5x cold penalty reaches 33 from 2 without anything
else being wrong — but that is arithmetic, not a measurement, and it is written
here as arithmetic.

Two things that would settle it, neither begun:

1. Install Firefox for Playwright and re-run both scripts. Cheap, and it either
   names the engine or clears it.
2. Have Movie reload the page, pan once, and read the readout again. If it
   drops toward 2 ms, it was the cold paint and the fix is to the readout, not
   the painter.

**The rail is the bigger number and it is barely touched here.** 25 ms steady
against 122 on Movie's screen, with four elevation seats and no cuts in this
file. `minus walls` takes it to 0.50 ms, which says the rail cost is the
elevations and the elevations are the walls — consistent with the 148 ms/wall
figure in `tests/model-html-seats.spec.js`. A rail breakdown on this house is
the obvious next measurement and has not been commissioned.
