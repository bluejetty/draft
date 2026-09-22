# BOARD — three reports off the elevations, 21 Sep

**Movie**, looking at E1 FRONT and E4 RIGHT on `draft.bluejetty.ca`, in three
messages:

> *"the window should be about 4\" over the roof line and the garage roof has
> 2 lines"*
>
> *"also where the garage hooks into the house the foundation, main floor and
> 2nd floor should connect all the same (1ft in from corner)"*

Status: **TWO MEASURED, ONE NOT STARTED.** No product code has been written
against any of them. His own drawing is in the tree as
`proto/repro-movie-garage-2storey.draft`, so every number below comes from
the file he was looking at rather than from a repro that resembles it.

---

## 1. THE GARAGE ROOF'S SECOND LINE — measured, and NOT a regression

**The first thing checked was whether the fascia-end fix (`2822e0b`, PR #450)
caused it**, because that change altered what the silhouette pass contributes
and a doubled band is exactly the shape a broken subtraction makes. It did
not. The same probe run against `2822e0b~1` and against current `main`, on
Movie's own file:

    BEFORE   E1  w 1 at 0.00" above the roof line   u -6.0 .. -4.0
    AFTER    E1  w 1 at 0.00" above the roof line   u -6.0 .. -4.0

Identical, and identical on all four repro drawings too (11/11, 10/10, 16/16
paired-line counts unchanged). **Pre-existing.**

### What the extra line IS

The fascia is drawn as a BAND of two deliberate lines, and that is not the
defect:

    fascia TOP      w 1      rgba(29,31,32,0.6)   at base + 5.5"
    fascia SHADOW   w 2.25   #1d1f20              at base

The defect is a THIRD stroke: a `w 1` line at **base** -- the shadow's own
height, not 5.5" above it -- over a two-foot stub at the end of the band:

    E1   band u -6.0 .. 22.0      stub  u -6.0 .. -4.0
    E3   band u -22.0 .. 6.0      stub  u -22.0 .. -20.0   (repro-2storey-garage)

So a light line lies along the heavy one for two feet at the band's end.

### Where it comes from, and what is NOT yet established

An eave is banded TWICE by design -- a silhouette pass, then a face-edge pass
that subtracts what the silhouette already drew (`drawnFascia`). The face
pass strokes the fascia BOTTOM at `eaveTop - ROOF_FASCIA_IN/12`, which is
`base`, at width 1 -- which matches the stub exactly.

**So the reading is that the subtraction is missing two feet at the end.**
NOT established: WHY. The obvious candidate is that the stub belongs to the
OTHER roof -- this drawing has two, and the subtraction is gated on the bases
matching within 0.05 ft -- so a second roof whose eave sits at the same height
over that stretch would be banded without anything of its own to subtract.
That is a hypothesis and it has not been measured. **Three hypotheses about
this same band have already died** (see `BOARD-fascia-shows-its-edge.md`), so
the next step is to instrument the subtraction and watch it, not to reason
about it further.

---

## 2. A WINDOW WANTS 4" OVER THE ROOF LINE — a rule, not a preference

> *"the window should be about 4\" over the roof line"*

**This is the answer to the fork this board's predecessor could not resolve.**
It was unclear whether *"smaller window"* meant "shrink the default window" or
"the roof-through-window problem". It is the second, and it arrives with a
number: the clearance between a roof line and the window above it is about
4 inches.

`BOARD-a-roof-through-a-window.md` has the diagnosis: **`auto-windows.js` has
no knowledge of roofs at all.** On `repro-2storey-garage` the garage ridge
sits at `x = 8` and the window spans `x 6..10`, so the roof comes up through
the middle of it. Nothing in the dealer can see that, because roofs are not
among the things it reads.

**WHAT IS STILL OPEN IS WHICH WAY THE WINDOW MOVES.** Four inches of clearance
can be got by raising the sill, by shortening the window from the bottom, or
by moving it sideways out of the roof's way, and they look different on a
drawing:

    RAISE the sill      keeps the size, changes the head height with it
    SHORTEN from below  keeps the head, makes this window shorter than its row
    MOVE sideways       keeps size and head, breaks the spacing of the row

A row of windows that no longer line up is worse on an elevation than one
window that is short, which argues for the second -- but that is a drafting
convention and Movie's call, not this board's.

---

## 3. THE GARAGE-TO-HOUSE JUNCTION — not started

> *"where the garage hooks into the house the foundation, main floor and 2nd
> floor should connect all the same (1ft in from corner)"*

Read as: the point at which the garage meets the house must be the SAME plan
position on all three levels, and that position is **1 ft in from the
corner**.

**Nothing has been measured for this yet.** What it plainly needs first is the
junction's actual position per level in Movie's own file -- foundation, MAIN
FL and 2ND FL -- because "they should all be the same" is a claim that they
currently are not, and the size of the disagreement decides whether this is a
builder bug or a rule that was never written.

Worth noting rather than assumed: `levelLocks` already exists for exactly this
SHAPE of problem -- *"a lock joins assemblies that must hold the same plan
position on different storeys"* (`drawing-format.js:102`) -- but it locks
GROUPS, and the garage junction is not a group. Whether that tier is the right
home here is unexamined.


---

## 1 (CONTINUED) — MEASURED, 21 Sep: THE HIP IS WEARING A RAKE'S FASCIA

**Movie marked it green in GIMP and named it in trade terms**, which is what
turned this from a hunt into a measurement:

> *"the front garage roof looks like you can see the top and bottom chords,
> but you shouldn't see the bottom of the top choard in the front elevation
> (its a cottage roof nor a gable roof)"*

**The earlier probe missed it because it was looking level and this line
SLOPES.** Both readings of "2 lines" offered on the board above were wrong:
it is neither the 2 ft stub nor the horizontal band. Measured on his own file,
E1 FRONT:

    gap 5.40"   slope  0.335   u  -6.0 ..  4.0    fascia top & fascia shadow
    gap 5.40"   slope -0.335   u  12.0 .. 22.0    fascia top & fascia shadow

**0.335 is the roof pitch** (4/12 = 0.333), and 5.40" is the fascia band's own
depth. So the garage roof's two SLOPING ends each carry a full fascia band --
a top line and a bottom line, parallel, one board apart, running up the slope.
That pair is exactly what Movie is reading as a top and a bottom chord.

The garage roof's plan is a hip: a band from `u -6..22` with 10 ft of slope at
each end and a flat ridge between them at `u 4..12`.

### Why that is wrong, in his words made mechanical

    A RAKE  (gable end)   IS a board on edge. It has a top and a bottom, and
                          an elevation showing that face shows both.
    A HIP   (cottage)     is where two roof PLANES meet. There is no board
                          there at all, so there is one line and no second.

`cut-view.js` already knows the distinction exists -- it carries an explicit
*"A rake wears its fascia too: the sloped board along the..."* branch. **What
has not been checked is what that branch tests**, and that is the next step:
whether it asks "is this edge sloped" (which a hip also satisfies) or "is this
edge a GABLE" (which only a rake does). The drawing's own record says
`roof-69` carries `edges: ["gable","eave","eave","eave"]`, so the data to tell
them apart is present and stored.

**No fix is proposed here yet** and that is deliberate: three hypotheses about
this band have already died on the neighbouring board, and a fourth guess is
worth less than reading the branch.

---

## 4. SIDE WALLS SEEN THROUGH THE ROOF — reported, NOT reproduced

> *"also i could see the sidewalls through the roof (also painted them green
> so you can see them"*

**Two probes found nothing on E1**, which is the elevation he is looking at:

    wall ink ABOVE the roof's outer profile        E1: 0 segments
    wall ink INSIDE the roof's shape (eave..top)   E1: 0 segments

E2 and E4 report 151 ft of wall ink "inside the roof's shape", and **that is
the probe being wrong rather than a defect**: on a side elevation the whole
house body legitimately stands under its own roof, and the probe's region --
max roof profile over ALL roofs, down to the lowest eave -- swallows it.

### REPRODUCED AND DIAGNOSED, once Movie said where to look

> *"there are 2 walls they are in line with the exterior wall, i covered them
> in green they go up and down at the exterior wall"* -- *"it looks like the
> roof can be seen through"* -- *"transparent"*

**"In line with the exterior wall" was the missing word.** Both probes above
searched the roof's interior; the lines are at the GARAGE'S OWN SIDE WALLS,
one 2 ft overhang in from each roof edge. On his file, E1 FRONT:

    u  -4.0   w 1.25   e -0.923 .. 8.102     below the eave -- CORRECT, the
                                             garage's wall corner
    u  -4.0   w 1.25   e  8.077 .. 9.177     ABOVE it -- the defect
    u  20.0   w 1.25   e  8.077 .. 9.177     and its twin

The garage eave sits at `e 8.102`, so **about 13" of vertical stands above the
roof line at each exterior wall**, inside the roof. That is the transparency.

`e 8.077 .. 9.177` is a FLOOR SANDWICH, not a wall: 1.1 ft between one
storey's plate and the next storey's floor. So what shows through is the
house's 2ND-FLOOR RIM BAND, and the vertical is one of the band's own edges.

### The line that draws it, and the test it is missing

`cut-view.js:1574`:

    const edgeVisible = (u, depth) => !houseSpans.some(other =>
      other.depth > depth + 1e-6 && other.lo < u - 0.05 && other.hi > u + 0.05);

**It asks whether a nearer WALL FACE hides the edge. It never asks about
roofs.** Three lines below it the file handles the opposite case and says so:

> *"The rim bands are part of the opaque house face, so the roof pass reads
> them alongside the walls ... a roof behind the house at exactly that height
> would otherwise show through the joist band."*

That is **roof behind, band in front** -- already solved. Movie's case is
**roof in front, band behind**, and nothing covers it. A garage roof standing
in front of the house at rim-band height leaves the band's edges drawn over
it.

**Why the two probes missed it.** The first took the maximum roof profile over
ALL roofs at each `u`; the HOUSE roof is far higher than the garage's, so
9.177 sat comfortably under it and nothing registered. The occluder is the
GARAGE roof specifically, so the test has to be per-roof, which is the same
distinction `edgeVisible` itself is missing. Both probes were wrong the same
way the code is.


---

## FIXED, 21 Sep — two of them, and the third is narrowed to a question

### The roof is no longer transparent

`edgeVisible` now asks about roofs. The roof half of `hidden` is lifted out as
`behindRoof(pt, elev)` so both passes share one definition -- `hidden` itself
could not move, because its OTHER half reads `rimBands`, which is what the
rim-band pass builds.

**AND ONE OF THE TWO VERTICALS SURVIVED THAT FIRST FIX**, which is worth
recording. Gating the interior edges removed `u -4` and left `u 20`. The
reason: a run's own ENDS are added unconditionally --

    edges.add(run.lo); edges.add(run.hi);

-- and `u 20` was a run end, so it never reached `edgeVisible` at all. That is
defensible for the wall test (by construction nothing nearer covers a band's
end; that is what makes it an end) and wrong for the roof test, which was not
being asked there at all. The ends are now gated on `behindRoof`, casting from
the nearest face that reaches that `u`.

### The ridge is one line again

`onGable` asks whether both ends of an edge lie on a gable plan edge, and a
RIDGE terminating at that edge passes. So the flat top of the gable end wore a
fascia board. A rake SLOPES, by definition, so the branch now requires slope.

Measured before: three runs banded on roof-69's gable edge -- `u -6..4`
rising, `u 4..12` FLAT at 11.902, `u 12..22` falling. After: the flat one is a
single `w 1.5` silhouette line and nothing else.

### And the geometry that reframes the rest

The probe settled what neither of us could see from a screenshot. E1's
`dirVec` is `{x: 0, z: 1}`, so **larger z is farther**, and roof-69's gable
edge sits at `z = 38` -- the NEAR edge, facing the viewer. `behindRoof` says
`false` for all three runs and is right: nothing is showing through. **This
was never an occlusion problem.**

What remains is a classification one, and the saved file is explicit:

    roof-69   points  x -6..22, z 38..48
              edges   ["gable", "eave", "eave", "eave"]
                        ^ z = 38, the edge AGAINST THE HOUSE

Three eaves and one gable. The painter is doing exactly what the record says:
banding a gable edge's rakes. **The two sloping bands are still drawn**, and
on the rake the light top line coincides with the roof silhouette, so what
Movie reads as a top and a bottom chord is the silhouette plus the shadow
5.5" under it.

### THE QUESTION THIS LEAVES, and it is Movie's

His words were *"its a cottage roof nor a gable roof"*. Two readings, and they
are different work:

    THE DATA IS WRONG      that z=38 edge should be an EAVE, not a gable, and
                           then the painter draws it right with no change at
                           all. A tool or builder question.
    THE RULE IS MISSING    a gable edge BURIED against another body is not an
                           exposed rake -- no board, no soffit return -- and
                           `roof-68` does cover z 22..40 at x -6..22, so this
                           one is buried. A painter change with real reach.

**The second would also take the last artifact**, which is recorded in
`proto/fascia-end-harness.js` as explicitly unguarded: a solid `w 1` line
still runs level at `ridge - 5.5"` over `u 4..6`. That is the BOXED-RAKE
SOFFIT return, a separate painter from the band, and it goes with the rake
treatment rather than with the band.

### Guarded

`proto/fascia-end-harness.js`, 21 checks. Both fixes are mutation-run:
reverting the ridge fix and reverting the roof-occlusion fix each turn it red.

**THE SECOND GUARD WAS WORTHLESS ON ITS FIRST WRITING** and only the mutation
run found it. It required the stray vertical to START above the eave -- and
the thing it exists to catch begins 0.3" BELOW it (the rim band spans
8.077..9.177 against an eave at 8.102), so its own precondition threw out its
own subject. With the fix reverted it passed. It now tests the vertical's TOP:
inside the roof means covered, poking above the ridge means partly in open air
and legitimately drawn. **A guard that excludes its subject is worse than
none** -- it reports the fix is held when nothing is holding it.

---

## 1 (SETTLED, 22 Sep) — BOTH READINGS ABOVE WERE WRONG, AND IT WAS THE RIDGE

Movie, asked which of the two readings to take: *"what do you think data or
painter?"* Painter — but **not the painter change described above**, and the
reasoning that got there is worth keeping because the board had talked itself
into a much larger change than the defect needed.

### THE DATA IS RIGHT, and it is Movie's own ruling written down

`geometry-2d.js:602`, the straight-skeleton roof generator:

```js
const speeds = kinds.map(kind => (kind === 'gable' ? 0 : 1));
```

**`gable` is a GEOMETRY word here, not a trim word.** A gable edge has speed
**0** — it does not move, and the roof plane ends vertically on it. An eave
edge has speed **1** — it retreats inward and a plane slopes up off it.

So "the data is wrong, that edge should be an EAVE" was never a relabelling.
It would make the edge retreat and **put a hip on the house end** — the
cottage Movie ruled against on 20 Sep:

> *"when the main floor garage roof connects to the house that has 2 storey it
> should be gabled on the house end (not cottage)"*

`roof-69: edges ['gable','eave','eave','eave']` is that ruling, recorded
correctly. **The first reading is struck.**

### AND THE SECOND READING WAS A THEORY THE INK DID NOT SUPPORT

"A gable edge buried against another body gets no rake treatment" is a rule
with real reach, and it was proposed from geometry — `roof-68` does cover
`z 22..40` at `x -6..22`, so `roof-69`'s gable edge at `z=38` is buried by two
feet — without measuring which stroke was actually wrong. Measured on E1:

```
e  8.10208   w 1    solid   u  -6.. -4     soffit return, LEFT rake's low end
e  8.10208   w 1    solid   u  20.. 22     soffit return, RIGHT rake's low end
e 11.45208   w 1    solid   u   4..  6     soffit return off the RIDGE   <<<
e 11.90208   w 1.5  solid   u   4.. 12     the ridge itself
```

**Only the third is wrong**, and burial has nothing to do with it. The two at
`e 8.102` sit on the eave over genuinely open corners; they are what a soffit
return is *for*, and the buried-gable rule would have deleted all three.

### IT WAS THE SAME DEFECT AS THE RIDGE BAND, MISSED BY THE SAME FIX

`rake` asked only `onGable`, and the flat top of a gable end lies on a gable
plan edge as squarely as its sloped sides do. The 21 Sep fix added the slope
test **to the fascia-band branch alone**, leaving the other reader of `rake` —
the soffit return sixty lines below — still calling the ridge a rake.

So the test belongs to the **word**, not to one painter of it:

```js
const rake = !eave && onGable(a, b) && Math.abs(eb - ea) > 0.05;
```

**A fix written on the branch instead of on the definition fixes the symptom
you are looking at and leaves the others.** That is the lesson, and it cost a
second sitting on the same three lines of ink.

### NOT AT `ridge - 5.5"`, which nearly made the guard worthless

The unguarded-line note said 5.5" — read off `ROOF_FASCIA_IN`, not measured.
It is **5.40"**: `11.90208` against `11.45208`, because the face-edge pass
puts the peak 0.1" above where the silhouette pass puts it. A guard written as
an equality on the constant would have passed with the line still on the
drawing. The check is a band one board deep, not a value.

### Guarded

`proto/fascia-end-harness.js`, 23 checks, and the new pair brackets the fix
from both sides — mutation-run, each caught by its own check and neither by
the other's:

```
rake forgets it must slope    ->  nothing returns a soffit off the ridge
no rake returns any soffit    ->  each rake still returns its soffit at the eave
```

The second exists because the buried-gable rule *would* have passed the first
completely. **Zero is as wrong as two**, the same rule this harness already
states for the ridge line itself.

And the first draft of the first check keyed on `w 1` **and** solid ink, which
left it sifting a population of two — the legitimate returns at the eave — so
the zone came out empty whatever the painter did at the ridge. The elevation
is what does the work, so the elevation is the only filter.

---

## 1 (CLOSED, 22 Sep) — A RAKE WEARS ITS BOARD ONLY WHERE ITS GABLE FACES

Movie, with the ridge fixed and the two sloping bands still on the drawing,
marking them green in GIMP:

> *"i can still see the 'lower' line of the top chord (except in the middle
> where the window is) the side lines are gone now so thats good"*

The middle was the ridge, fixed that morning. The sides are the gable end's
rakes, and **they are genuinely rakes** — `roof-69`'s faces say so:

```
face 0   (-6,38) (4,38) (-6,48)
face 1   (4,38) (12,38) (22,48) (-6,48)
face 2   (12,38) (22,38) (22,48)
```

`(-6,38)->(4,38)` and `(12,38)->(22,38)` lie flat in plan on the gable line
and rise in elevation from eave to ridge: the sloping top edges of the gable
end wall. A real rake is a board on edge and shows a top and a bottom.

### But E1 is not the side that gable faces

E1's cut sits at `z = 48` with `dirVec {x:0,z:1}`, and the sign is not a thing
to remember — `behindRoof` states it in the same file:

```js
const near = { x: pt.x + dir.x * 0.05, z: pt.z + dir.z * 0.05 };
```

**+dir reaches the NEAR point, so larger z is nearer.** The gable end at
`z = 38` faces `-z`, away. What the drafter sees is the HIP in front of it —
`(4,38)->(-6,48)` — which projects onto exactly the same line, because both
run between the same two points in elevation. A hip is where two planes meet:
one line, no board.

**THE BOARD ABOVE SAID THIS WAS "NEVER OCCLUSION" AND HAD THE DIRECTION
BACKWARDS.** It read larger z as farther, concluded the gable faced the
viewer, and closed the question — which is why the 22 Sep entry then went
looking at the soffit return instead and called the buried-gable rule a theory
the ink did not support. The ink was fine. The reading of the axis was not.

### The rule

A gable segment now carries which way it faces, and `onGable` asks:

```js
const onGable = (p, q) => gableSegs.some(s => s.toward > 0.01
  && distToSegment(p, s.a, s.b) < 0.1 && distToSegment(q, s.a, s.b) < 0.1);
```

Outward is decided by the RING — a probe off the mid-point either lands inside
the footprint or it does not — never by its winding.

**The whole family goes together**, band and soffit return: the return lies in
the same `z = 38` plane and is behind the same hip. That retires the check
written this morning demanding the returns survive; it was right about the
ridge fix, and the facing rule makes its subject invisible from E1, so it moved
to E3 rather than being deleted.

### Guarded, 26 checks, bracketed from both sides

```
the facing test is inverted     -> E3's band and return both vanish
no facing test at all           -> E1's bands and returns come back
the outward normal never flips  -> E3's band and return both vanish
```

E1 must show none of it and E3 must show it: without the second pair,
`toward > 0.01` written backwards silences every rake in the drawing and every
other check still passes.

---

## 4 (NEW, 22 Sep) — THE FOUNDATION STEPPED A FOOT FROM WHERE THE CONCRETE DOES

Movie, on E4 of a 2 STOREY + GARAGE + ROOM OVER he had just built:

> *"the 2nd floor is lined up but foundation off kilter still"*

**The walls were already right**, which is why this turned out to be an ink
problem and not a geometry one. Measured on that build, the tie is identical
on every level — exactly what ruling (a) asked for and got:

```
FOUNDATION  (16,19) -> (20,19)   body=garage
MAIN FL     (16,19) -> (20,19)   body=garage
2ND FL      (16,19) -> (20,19)
```

### What was off was the elevation

Two exposed foundation tops overlapped for exactly one foot — the tie's foot:

```
e -1.048   u -46.00..-19.00    the GARAGE's concrete, z 19..46
e -1.173   u -20.00.. 20.00    the HOUSE's concrete,  z -20..20
```

1.5" apart in height and stepping a foot apart in plan, so the drawing put the
step a foot from where the concrete actually steps.

`cut-view.js`'s `fdnHidden` demanded **total** cover:

```js
&& o.lo <= g.lo + 0.05 && o.hi >= g.hi - 0.05
```

The garage's face covers one foot of the house's twenty-eight, so it hid none
of it and the house's line ran on underneath. Subtracting the stretch instead
asks the same question per foot rather than per face, and a face a nearer one
swallows whole yields no runs at all — the old all-or-nothing answer kept as a
special case of the general one.

### "No two tops may overlap" is NOT the rule, and four elevations said so

The harness asserted it first. A face standing **behind** a shorter one shows
its top over the top of the one in front — a taller building seen past a lower
one, and both lines belong on the drawing. **Ink alone cannot tell that from
the defect**: in both cases two tops at different heights cover the same
stretch, and what separates them is which is nearer, which the strokes do not
carry.

So the sweep was deleted rather than weakened, and the report is pinned
exactly instead: on Movie's own drawing the two tops must **meet**, and meet
**on the tie**. Meeting alone is not enough — hiding the garage's foot instead
of the house's leaves them meeting perfectly and puts the step at z = 20,
which is the same defect wearing the other shoe.

### Measured and NOT fixed

A far face that is **taller** than a nearer one still paints its **bottom**
line over the stretch the nearer one covers —
`repro-bungalow-garage-roofs` E3, `e -2.196 u -16..4` against
`e -2.196 u -16..16`, twenty feet shared.

Same question one axis over, and this fix does not reach it: `behindFdn` asks
`o.topE >= g.topE`, so a nearer face that is SHORTER hides nothing, when what
it should hide is everything below its own top. Answering that makes a face's
visible region a POLYGON rather than a set of u-runs — a real change to that
painter, and not what was reported.

**It shows as nothing today**: both bottoms sit on the grade line, already
stroked the full width at w2, so the spare ink lands on ink that belongs
there. Which is why it has never been reported — and why it is written down
rather than silently left. The day a face's base rises off grade it will show.

### Guarded

`proto/foundation-face-harness.js`, 3 checks, mutation-run:

```
back to all-or-nothing        -> they meet at -19.000 against -20.000   <- the report
the subtraction keeps one end -> only one top on E4
nearness read backwards       -> three tops on E4
```

The first reproduces Movie's foot exactly.
