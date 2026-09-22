# BOARD — the garage roof comes up through a second-storey window

**Movie, 20 Sep 2026**, from the live app, looking at E1 FRONT:

> *"something weong with the gable.roof area, maybe due to the connection to
> the house"*

and, in the same breath, the thing that turned out to be the actual defect:

> *"also we should avoid locating a window where a roof will interfere with
> it"*

and then his own answer to it:

> *"it could be a reduced height window in that location"*

Status: **DIAGNOSED, NOT FIXED.** Fixture kept as
`proto/repro-2storey-garage.draft` — his own drawing, saved off the site at
19:32. Re-checked on `draft.bluejetty.ca` at 19:47 and it reproduces, so this
is not the `roughdrafter.com` mirror lagging (`BOARDS.md:1003`).

---

## It is not the gable, and it is not the connection

Both of those were the honest first guess and both are wrong, which is worth
recording so nobody re-opens them.

`E_MARK_SIDES.E1` is `{ side: 'S', axis: 'z', sign: 1 }` — **the front
elevation looks from `+z` toward `−z`.** The garage sits at `z 20..48` and the
house at `z −22..22`, so the garage is **between the viewer and the house** and
is supposed to be drawn over it. It is.

And the gable is doing exactly what `c4e169e` ruled it should. The garage
roof's edges are `['gable', 'eave', 'eave', 'eave']` with the gable on the
`z = 20` edge, and the house's second-floor wall stands at `z = 20`. **The
gable is flush with the house wall**, which is that commit's own sentence:
"the garage roof meets the house on a gable, cut flush at that line".

## What is actually wrong: the ridge lands on the middle of a window

Every number below is off the fixture.

    garage roof footprint      x  −6 .. 22          (28 ft wide)
    its ridge, centred         x  =  8
    2ND FL window on z = 20    x   6 .. 10          (4 ft wide)

**The ridge is dead centre of that window.** Then the heights:

    garage plate height              8.09 ft
    pitch 4/12 over a 14 ft half-span  +4.67 ft
    ridge elevation                 12.76 ft

    2ND FL level elevation           9.00 ft
    sillHeight 2.5, off the record   11.50 ft
    headHeight 6.667, off the record 15.67 ft

**Corrected 21 Sep.** The first version of this board read those two off
`auto-windows.js`'s `DEFAULT_WINDOW` (sill 3.0, head 6.5) rather than off the
drawing. The records carry their own — `sillHeight: 2.5`, `headHeight:
6.667` — so the window is 11.50 to 15.67 ft, not 12.00 to 15.50. **The
conclusion did not move and the margin got worse**, which is the only reason
the error was survivable: the ridge clears the sill by 1.26 ft rather than
0.75.

So the roof surface crosses the window **15 inches above its sill at the
ridge**, and it falls only 0.67 ft over the 2 ft to each window edge — 12.09 ft
against an 11.50 ft sill — so it clips the bottom of the window across the
**whole** 4 ft of it, not just at one corner. That is precisely the line Movie
can see running through the glass.

## The root cause is one sentence

**`auto-windows.js` does not know roofs exist.** 304 lines, and `grep -n
"roof\|Roof"` returns nothing. It deals windows onto the exterior faces on
spacing rules alone — `MIN_GAP_FT`, `MIN_CORNER_FT`, `FRONT_MIN` — and the
symmetry shows: the `z = 20` face got windows at `x −10..−6`, `−2..2`, `6..10`,
which is the `z = −20` face mirrored exactly. The far face has no garage in
front of it, so the same three positions are right there and wrong here.

Nothing in the roof code is at fault. The roof is where it should be; the
window was dealt into it.

## The fix Movie named, and what it needs

> *"it could be a reduced height window in that location"*

Better than refusing the position, because the room behind still wants
daylight and the wall still wants a window in that bay. Raising the sill until
it clears the roof, head unchanged, is the whole of it:

    ridge at                    12.76 ft
    sill needed, + clearance    ~12.9–13.1 ft  → 3.9–4.1 ft above the floor
    head stays                  15.67 ft
    resulting window            ~2.6–2.8 ft tall, against 4.17 ft

That is close to what `WC_WINDOW` already is — sill 4.5, 2.0 ft tall — so the
app already has the vocabulary for a short high window and this is a third
entry beside `DEFAULT_WINDOW` and `WC_WINDOW` rather than a new mechanism.

**And the sill is a per-opening record, not only a catalogue default.** Every
fenestration in this drawing carries its own `sillHeight` and `headHeight`, so
a placer that wanted to raise one window has somewhere to write the answer
without touching the catalogue.

**What has to be decided before it is built:**

1. **Where the roof profile comes from.** `dealWindows` takes faces and
   spacing; it would now need the roof surfaces standing in front of each
   face, sampled across the opening's width. That is a new input to a module
   that currently takes none, and it is the whole cost of this board.
2. ~~**Raise the sill, or slide the window sideways?**~~ **ANSWERED, 21 Sep**,
   by `RULING-the-window-head-is-the-datum.md`: *"the top of the window should
   be default located 7ft high ... if the window changes size the bottom
   changes"*. The head is the datum and the sill is what moves, which is the
   sill fix and not the slide. It also makes the resulting window TALLER than
   this board estimated — a 7.0 ft head against a 13.0 ft sill is ~3.0 ft of
   glass, not the 2.6–2.8 computed off the 6.667 head this drawing carries.
3. **Which roofs count.** Only a roof in FRONT of the face on that elevation
   interferes. A roof behind it is hidden and irrelevant.

## Not checked

- **Whether the elevation occludes correctly.** The window is drawn whole with
  the roof lines crossing it. If the garage roof is in front, it should be
  hiding the bottom of that window rather than being drawn over it — but a
  window that should not be there in the first place makes that the second
  question, not the first.
- **Whether a house rebuilt from the drive-thru today still does it.**
  `c4e169e` changed `premade-plans.js`, which is what the bone builds from, so
  a drawing made before it keeps the geometry it was built with. The window
  placement is not premade-plans' though — it is `auto-windows.js` — so a
  rebuild is not expected to fix this.

---

## CORRECTION, 22 Sep — "the root cause is one sentence" was the wrong sentence

**The window Movie is looking at was not dealt by `auto-windows.js`.** It is
`premade-plans.js`'s `upperOpenings()`, and the fixture proves it outright:

```
proto/repro-2storey-garage.draft   18 windows,  0 of them auto: true
```

Every record matches the module's output byte for byte — `sillFt: 2.5`,
`headFt: 6.666666666666667`, `widthFt: 4`, offsets `8, 16, 24` on the front
and back edges and `12, 28` on the sides — against `auto-windows.js`'s
`DEFAULT_WINDOW` of sill 3.0, head 6.5, width 2.5. Three numbers, none of
them shared.

The front wall runs `(16,20) -> (-16,20)`, so **offset 8 is `x = 8`**, which
is the garage ridge to the foot. That is the window in the elevation.

### The evidence that misled it was real, and pointed the other way

> *"the symmetry shows: the `z = 20` face got windows at `x −10..−6`, `−2..2`,
> `6..10`, which is the `z = −20` face mirrored exactly"*

True, and read as the density fill's signature — even spacing is what `fill()`
does. But `upperOpenings()` deals `8, 16, 24` on **both** edges 0 and 2 from a
fixed list, which produces the identical symmetry from a completely different
mechanism. **A symmetry is not a fingerprint.** The one fact that would have
settled it, `auto === true`, was never read, and it takes a single line.

And the board had the disproof in its own hands. It corrected itself once
already — *"The first version of this board read those two off
`auto-windows.js`'s `DEFAULT_WINDOW` (sill 3.0, head 6.5) rather than off the
drawing"* — and recorded the numbers disagreeing without asking why a module
would place a window carrying neither of its own two sizes.

### What this does and does not change

`auto-windows.js` genuinely did not know roofs exist, that is genuinely a
defect, and it is **fixed and guarded** (22 Sep): `face.roofFt` in, sill
raised to `roof + 4"` with the head fixed, the window dropped when less glass
than the smallest unit in the ladder is left. Seven mutations, each caught by
its own check. Verified end to end on this very fixture with the hand-placed
windows stripped so the faces were not blocked:

```
roof-59  plate 0        the house roof   -> correctly IGNORED
roof-60  plate 8.09375  the garage roof  -> the one in front of the wall

front wall (16,20)->(-16,20), 2ND FL
  offset  4.75   sill 3.000 -> 3.281
  offset 10.33   sill 3.000 -> 3.587
  offset 16.00   sill 3.000        (x = 0, roof only 1.1 ft up: no lift needed)
left wall, no roof in front         all three untouched
```

**That the house roof is ignored is the whole of the wiring.** Every exterior
wall has its own roof's overhang reaching two feet past it, with the eave at
the plate — above every window head on the storey. Counted, it would lift
every sill above its own head and the dealer would drop all thirteen. The test
is what a roof BEARS on: below this wall's top it is a lower body's roof in
front of the window; at the top it is the roof over the drafter's head.

**What it does not fix is Movie's drawing**, because that window comes from
the other module, on the other page — `premade-plans.js` through
`MODEL.html:10755`, where `auto-windows.js` does not run at all.

### What the premade path needs, and why it is not the same fix

`premade-plans.js` is pure and knows no elevations: plate heights come from
`level-assembly.js` and floor heights from the level stack, neither of which
it reads. It knows the garage's PLAN — enough to know a window at `x = 8`
sits on the ridge — but not how high that ridge is, which is the number the
clearance is made of.

So it is a placement question, and Movie has already answered the shape of it
twice: the head is the datum, the sill moves. **Open: where the arithmetic
lives** — a post-pass in the page once the roofs exist and the elevations are
known, or an argument handed into `premade-plans.js`. That is a decision with
reach and it is his.

---

## FIXED, 22 Sep — on the path it was actually on

Movie, asked where the arithmetic should live: *"pick one"*. It is a **post-
pass on the page**, run once the roofs stand, and it calls the rule that
already exists rather than writing it a second time.

### Why not into `premade-plans.js`

That module is pure and knows no elevations: plate heights come from
`level-assembly.js` and floor heights from the level stack, neither of which
it reads. Handing them in grows its signature by four numbers from two other
modules, makes every caller supply them, and — worse — has it computing roof
surface heights that `cut-view.js`'s `sectionRoofHeightAt` already computes.
**A second answer to "how high is the roof here" is the thing this repo keeps
getting burned by**, and it would be the third.

### What the page does, and what it does not

```
MODEL.html:clearOpeningsOverRoofs   the roof records, their bearing, and the
                                    surface height over a plan point
auto-windows.js:roofProfileAlong    which roofs count, which side of the wall,
                                    what the heights are measured FROM
auto-windows.js:clearRoofUnder      the 4 inches, the peak under the window,
                                    the head held, the no-glass drop
```

Only the first line is the page's, because only that reaches for things a
pure module may not. **`auto-windows.js` is now loaded by MODEL.html** — not
for the dealer, which that page does not run, but for those two rules. It is
declared in `model-html-tier1.spec.js`'s script inventory with that reason.

The pass runs on **this press's own openings only**. `raiseLoop` hands back
the records it made, so the set is exact: nothing the drafter placed and
nothing from an earlier press is touched.

### Measured on both designs, and it answers them differently

```
2 STOREY + GARAGE        x = 8, dead on the garage ridge   sill 2.500 -> 3.948
                         every other window                untouched

2 STOREY + GARAGE + ROOM OVER
                         x = 8, front wall                 untouched
                         room's far wall, x = 8            sill 2.500 -> 2.598
```

**The second is the interesting one.** With a room over the garage the front
window does not move, and that is correct: the room stands where the roof
was, so `garageRoofLoop` starts at `z = 38` and the stub never reaches the
house's front wall. What the stub DOES reach is the room's own far wall, and
the window there moves by the 1.2 inches the stub stands in front of it.

`3.615 ft` of roof under that first window, plus 4", is `3.948`. To the inch.

### Guarded

`tests/premade-window-over-roof.spec.js`, mutation-run three ways:

```
the pass is never called            -> 6 windows still at the design sill
the sill is computed, never written -> the same
every roof counts, the house's too  -> EVERY upper window vanishes
```

**The third is the one worth having**, and it fails differently from the other
two. Counting the roof this wall holds up lifts every sill above its own head
and the whole storey is dropped for having no glass — an empty second floor,
shipped. That is the failure the bearing test exists to prevent and the reason
it is written as `roofBaseElev < wallTop` rather than as a list of roof ids.
