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

So this one is **recorded and unreproduced**. The honest next step is his
marked image rather than another probe: the screenshot to hand shows the roof
OUTLINE painted green, and which marks are the side walls cannot be read off
it with confidence. Guessing at the region is how the two probes above were
built, and both answered a question nobody asked.
