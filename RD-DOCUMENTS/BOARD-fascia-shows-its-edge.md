# BOARD — the fascia board shows its thickness in elevation

**Movie, 20 Sep 2026**, looking at E3 BACK on `draft.bluejetty.ca`:

> *"on the left side fascias looks like you can soo the 2x6 fascia boards, but
> shouldn't see it"*

and, explicitly:

> *"don't do this now, reference it for later"*

Status: **CLOSED — FIXED, AND FOUR OF THE FIVE READINGS BELOW ARE WRONG.**
Read the foot first. The sections are kept in the order they were written so
the dead ends stay visible, but only the last one is the answer; the four
before it are a record of being confidently wrong in four different
directions, twice about a garage that had nothing to do with it and once
about a line that turned out to be invisible.

---

## What is on screen

E3 BACK. `E_MARK_SIDES.E3` is `{ side: 'N', axis: 'z', sign: -1 }`, so the back
elevation looks from `−z` toward `+z`. The garage sits at `z 20..48`, which
puts it **behind** the house on this view — the far side, not the near one.

The house is `x −18..18` and the garage `x −6..22`, so the only part of the
garage that clears the house is the 4 ft from `x 18` to `x 22`. On a view
looking the other way that 4 ft reads on the **left**, which is where Movie is
pointing: the thin sloping sliver of garage roof standing out past the house
wall.

**That the sliver is visible at all is correct.** What is wrong is that its
fascia is drawn showing the board's THICKNESS — a 2x6 seen on edge — where
from this angle it should not be read as a solid board at all.

## The three facts to hand

    ROOF_FASCIA_IN        5.5        cut-view.js:101
    both roofs' `fascia`  5.5        carried on the record, not derived
    drawn at              six sites  cut-view.js:563, 630, 1113, 1444, 1667

`fascia` is a stored property on each roof and it agrees with the constant on
this drawing, so nothing here is a stale or drifted value — the number is
right and what is in question is how it is PAINTED on a face seen obliquely.

## Not looked at

- Which of those six sites draws the sliver.
- Whether the same thing happens on E1 FRONT, where the garage is the NEAR
  body rather than the far one — the near case may be correct and only the far
  case wrong, or both.
- Whether this is the same hidden-line question left open in
  `BOARD-a-roof-through-a-window.md`, which noted the front elevation draws a
  window whole with roof lines crossing it rather than occluding it. Two
  reports about what an elevation hides, a day apart, may be one defect.


---

## CORRECTED, 21 Sep — it is not about the garage sliver

**Movie, seeing it again on `roughdrafter.com`, on a PLAIN DETACHED GARAGE
with no house on the drawing at all:**

> *"also notice on the roof there is usually always an extra line where the
> fascia is on one side about 1.5" inwards that should NOT be showing"*

**THIS BOARD'S WHOLE FRAMING WAS WRONG** and it is worth saying so plainly
rather than quietly re-scoping. Everything above reasons about E3 BACK, the
garage standing behind the house, and the 4 ft sliver clearing the house wall
— it treats the defect as something about ONE BODY SEEN PAST ANOTHER, and
wonders whether it is the same hidden-line question as the roof-through-a-
window board.

It is not. The new sighting has **no house in the drawing**, so there is
nothing to be occluded by, and *"usually always"* says it is the normal case
rather than an oblique one. Two of the three "not looked at" questions at the
end of this board are therefore asking about a situation that is not the
defect.

### The one new fact, and what it rules out

**1.5 INCHES IS NOT A FASCIA DIMENSION.** `ROOF_FASCIA_IN = 5.5`
(`cut-view.js:101`) — a 2x6's depth — and both roofs on the earlier fixture
carry `fascia: 5.5` on the record. 1.5" is a 2x's **thickness**, which is a
different measurement entirely.

Checked: **`cut-view.js` has no 1.5" fascia thickness anywhere.** Its only
1.5s are `GARAGE_BEAM_PLATE_IN` (the grade-beam sill plate, nothing to do with
a roof) and two `ctx.lineWidth = 1.5` settings. So the extra line is not a
board thickness this file draws on purpose, and "1.5 inches" is Movie's
estimate off the screen rather than a number to grep for.

### Where it actually has to be looked for

The fascia is drawn as a BAND, not a line — `cut-view.js:116`, *"THE FASCIA IS
BANDED ONCE, OVER THE EAVE'S TRUE LENGTH"* — so it has a top edge and a bottom
edge by construction, and a third line near it is the thing to explain. The
candidates, in the order worth checking:

- **`cut-view.js:863`**, `moveTo(X(s.u), Y(s.elev - fasciaFt))`, commented
  "fascia drop at the edge" — a drop drawn per segment end. On a roof whose
  profile is sampled, a drop at a sample that is not the true eave end would
  put a short line just inside the eave.
- **Whether the band and the profile both draw the same edge.** :850 draws
  "the sampled top chord plus fascia drops" and :1444 bands the fascia again.
  Two writers on one edge is the shape that produces a doubled line.
- **Why ONE side.** Movie says one side, and a symmetric roof drawn by
  symmetric code should fail symmetrically. Whatever is asymmetric here is
  probably the defect itself.

**Still not investigated** — this is a corrected observation, not a diagnosis.
What has changed is that the next person starts from a plain garage with no
house rather than from a two-body occlusion that has nothing to do with it.


---

## MEASURED, 21 Sep — two hypotheses dead, three numbers, one candidate

Fixture: `proto/repro-bungalow-garage-roofs.draft`, all four elevations,
probed by recording every canvas segment with its ink and width and filtering
to the DRAWING canvas (`#plan`) rather than the preview thumbnails.

### Both of the obvious hypotheses are wrong, and both were mine

**1. THE TWO-PASS SUBTRACTION IS NOT DOUBLING THE BAND.** An eave is banded by
a silhouette pass and again by a face-edge pass, the second subtracting what
the first drew, gated on `Math.abs(f.base + ROOF_FASCIA_IN/12 - eaveTop) <
0.05` — a 0.6" tolerance. A disagreement wider than that would skip the
subtraction and draw twice. **Measured: 20 comparisons across four
elevations, zero unmatched.** The subtraction works.

**2. THERE IS NO SECOND BAND AT ALL.** The band is deliberately two lines — a
light top at `eaveTop` (`rgba(29,31,32,0.6)` w1) and a heavy shadow 5.5" under
it (`#1d1f20` w2.25). Counting those signatures per elevation: **1–2 tops,
1–2 shadows, zero doubled pairs.** Nothing draws an eave twice.

### What IS near the fascia, exactly

    2ND FL datum      9.1458 ft    +7.12" ABOVE the eave   faint, 926 px
    eave top          8.5521 ft    the fascia top line            1512 px
    wall-top datum    8.0938 ft    exactly -5.50"          faint, 926 px

**THE FASCIA'S SHADOW LANDS EXACTLY ON A DATUM LINE.** `ROOF_FASCIA_IN` is
5.5 and the wall-top datum is 5.50" under the eave to the hundredth — so the
heavy shadow and a faint rule are drawn at the same y and read as one line.
That coincidence is exact, not lucky: the eave top IS the wall top plus the
fascia depth.

**The candidate is the OTHER one**: the 9.1458 datum, 7.12" above the eave,
drawn by `mark()` at `cut-view.js:1174` in `rgba(29,31,32,0.25)` at width
0.75.

### Why it would be "on one side", and "usually always"

`cut-view.js:1185`, immediately under the painter: *"House level lines stop at
the house face — a garage hangs off grade and never carries the house datums
across its front."* The datum runs 926 px and stops; the fascia runs 1512.
**So the faint line covers part of the eave and not the rest** — which is what
one side looks like. And every drawing has level datums, which is what
"usually always" looks like.

### NOT CONFIRMED, and this is why the board is still open

Movie's report says *"about 1.5 inches inwards"*, and this candidate is 7.12"
above the eave. Those do not match. Either the estimate is loose — it was read
off a zoomed screenshot — or **this is the wrong line and the real one has not
been found yet.** He is sending a screenshot with the line highlighted; the
next reader should start from that rather than from this candidate.

If it IS this line, the fix is not to delete level datums — they are how a
drafter reads heights — but to stop a datum rule short of the roof rather than
letting it run through the eave.


---

## “FOUND”, 21 Sep — the fascia crease at `cut-view.js:1966` (WRONG — see below)

Movie marked the line green on a 2-storey elevation: a short VERTICAL at the
end of the upper roof's fascia band. Not a horizontal, which is what the
candidate above assumed, and not a datum.

    // The fascia creases at every plan corner: where the roof edge
    // changes direction (an outside corner, or a valley landing on a
    // re-entrant one) a thin vertical seam crosses the 5.5" band.

It draws `moveTo(X(u), Y(eaveTop))` to `Y(eaveTop - ROOF_FASCIA_IN/12)` — a
vertical exactly the depth of the board, in INK at width 1.25.

**AT A CORNER IN THE MIDDLE OF A RUN THAT IS RIGHT**: a fascia really does
mitre where it turns, and the seam is visible. **At a corner that falls at the
END of the visible run it reads as the board's END** — a 2x6 seen on edge,
which is what Movie has been reporting since 20 Sep in exactly those words.

### How it was found, after three wrong answers

Three hypotheses were tested and killed, all mine:

1. the two-pass subtraction doubling the band — 20 comparisons, 0 unmatched
2. two fascia bands on one edge — 1-2 tops, 1-2 shadows, 0 doubled pairs
3. the silhouette's closing riser at `:1637` — suppressed it, the verticals
   stayed

**The technique that worked** is worth keeping. Seven sites in this file set
`lineWidth = 1.25`, so each was given a unique width — 1.210001, 1.220001, …
— visually identical and individually identifiable in a recorded canvas tape.
The probe then named the source outright instead of being narrowed by
guesswork.

Also measured, and not yet explained: **the crease is drawn TWICE at each
end** — two identical segments at the same x. Harmless on screen (they
overlap) but it says something is visiting the corner twice.

### What is NOT decided

Whether to suppress the crease, and on what rule. "Never draw creases" would
lose the legitimate mitre in the middle of a run. "Not at a run's end" is
specific and defensible, but it is a drafting convention and Movie's call, not
this board's. **And he has already named the next one**: *"the lower garage
roof is your next job"* — the same elevation shows it again on the garage
roof below.


---

## CLOSED, 21 Sep — it is the SILHOUETTE'S END RISER, not the crease

**The section above is wrong, and it was the fourth wrong answer in this
board rather than the first right one.** Recording it as "FOUND" was the
mistake: the crease at `:1966` was identified by a lineWidth tag as *a* line
near the fascia and then promoted to *the* line without measuring where it
sits. Measured afterwards, across four elevations of
`proto/repro-2storey-garage.draft`:

    every crease lands 0.000" from a fascia run's end

Exactly at the end, under the outline's own riser, where it is invisible. The
crease was never the extra line, and the "drawn TWICE at each end" puzzle at
the foot of that section has a dull answer: **a rectangle's four plan corners
project onto two u values in an elevation**, so the near and far corners of
each end draw the same vertical twice, on top of each other.

### What it actually was

    E1  u 17.825  w1.5  e 17.252..17.777   2.10" inside band -18.00..18.00
    E1  u 21.825  w1.5  e  8.102.. 8.627   2.10" inside band  -6.00..22.00
    E2  u 21.750  w1.5  e 17.252..17.802   3.00" inside band -22.00..22.00
    E3  u -17.850 w1.5  e 17.252..17.777   1.80" inside band -18.00..18.00
    E4  u -47.725 w1.5  e  8.102.. 8.652   3.30" inside band -48.00..-20.00

**`w1.5` is the roof SILHOUETTE's own width**, and the riser spans the fascia
band almost exactly. `cut-view.js` grows each fascia run out to the eave's
true end — `extendRunsToEaves`, whose header already explains that the
silhouette is sampled and stops short of a roof's outer corner — but it did
that **after** drawing the outline. So the band reached the roof's real
corner while the outline's end riser still stood at the last sample, leaving a
spare vertical a couple of inches inboard with the band running on past it.

**Movie's three observations were all correct, including the one that read
like a guess.** *"About 1.5 inches"* measured 1.8"–3.6": one sampling step,
every time. *"On one side"*: one end of a run happens to land on a sample and
the other does not. *"Usually always"*: **12 of 17 elevations** across the
four repro drawings were carrying it.

### And a second defect underneath it

Fixing the order left two elevations still stranding a riser, which is what
turned up the real surprise. E3 and E4 look back along their axis, so `u`
DESCENDS as the silhouette is sampled, and a run came out of that loop with
its ends reversed:

    repro-bungalow-garage-roofs E4    runs [u0 22, u1 -47.708]

Every test downstream reads those as an interval. An inverted run therefore
overlapped no eave, grew by nothing, and was then discarded by
`u1 - u0 > 0.5` before it could be banded at all. **The band still appeared**,
because the face-edge pass draws it exactly and had nothing of the
silhouette's to subtract — which is precisely why this hid: the only visible
symptom was the stranded riser, and the silhouette's missing band showed up
as nothing.

### The fix, and what it does not touch

The run ends are worked out **before** the outline is drawn, and the outline's
risers use them; inverted runs are normalised. At a grown end the riser is
exactly the fascia board — at a roof's outer corner the surface top IS the
fascia top — so the outline runs out to the true edge and drops 5.5".

**A gable end is untouched by construction.** `extendRunsToEaves` only grows a
run against an EAVE edge, and a rake is not one, so a gable's outline stays
exactly where it was. Nothing here decides a drafting convention, which is
what the previous section wrongly thought was left to decide: this was a
defect with a measurable right answer, not a choice about mitres.

### Pinned

`proto/fascia-end-harness.js` — no silhouette-weight vertical may stand within
6" inside a fascia band's end. The threshold is not a round number picked for
comfort: artifacts measured 1.8"–3.6", and the nearest LEGITIMATE vertical in
the same band was 19.2" away and 7.35 ft tall (a roof-takeover edge where a
garage roof dies into a house wall). Run against both broken states it exits
1 — 12 failures with the fix reverted, 2 with only the inversion restored —
so the one check pins both defects.

**Still open, and it is Movie's own next item**: *"the lower garage roof is
your next job"*. That elevation's garage roof should be looked at again now
this is out of the way, in case what remains there is a different thing.
