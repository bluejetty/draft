# BOARD — the fascia board shows its thickness in elevation

**Movie, 20 Sep 2026**, looking at E3 BACK on `draft.bluejetty.ca`:

> *"on the left side fascias looks like you can soo the 2x6 fascia boards, but
> shouldn't see it"*

and, explicitly:

> *"don't do this now, reference it for later"*

Status: **RECORDED, NOT INVESTIGATED — AND THE FIRST READING BELOW IS WRONG. See the correction at the foot.** Nothing below is a diagnosis. It is
what was on screen and the three facts that were to hand, written down while
they were cheap so the next person does not start from the screenshot.

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
