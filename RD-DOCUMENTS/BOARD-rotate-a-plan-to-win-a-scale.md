# BOARD — rotating a plan to win a rung of scale

**Movie, 21 Sep 2026**, looking at a long plan running off an 11×17 sheet:

> *"i'm wondering based on drawing size (length) we might also want to rotate a
> plan so it fits better on a page with a better scale, what do you think"*

and, on how exact it has to be:

> *"it doesn't have to be perfect the user will always need to check it and
> make sure everything is where they would like it positioned"*

Status: **CLOSED — NOT DOING IT FOR AUTO-PLACEMENT.** Movie, 21 Sep, after the
measurement below:

> *"you're right rotation for autoplace isn't necessary"*

**And the measurement is why it is a comfortable no.** The ladder already picks
**1/8" and it FITS** on the house that prompted the question. Rotation was
buying a nicer scale, not rescuing a broken sheet — an enhancement, not a fix.
The composer's job is to deal a workable hand that the drafter then checks, and
it already does that.

The board is kept rather than deleted for two reasons: the arithmetic is done,
so anyone revisiting it starts from numbers rather than from scratch; and the
NORTH ARROW COUPLING recorded below is a real constraint on board #289 whether
or not rotation is ever built. New ground either way — Movie confirms
MODEL.dc.html had no rotation of any kind, so nothing was being ported.

---

## It wins exactly one rung, and that is measured

`_autoScaleFor` walks `AUTO_SCALE_PREFS = [1/4, 3/16, 1/8, 3/32]`, largest
first, and takes the first rung that fits. On `repro-2storey-garage.draft`'s
MAIN FL, 11×17 landscape with the right-hand titleblock strip:

    drawable region                                14.85" × 10.00"
    MAIN FL as drawn (incl. dimension strings)     43.5 ft × 73.5 ft

    as drawn      1/4"  10.88 × 18.68  no     3/16"  8.16 × 14.08  no
                  1/8"   5.44 ×  9.49  FITS   ← chosen today

    rotated 90°   1/4"  18.38 × 11.18  no     3/16" 13.78 ×  8.46  FITS  ←
                  1/8"   9.19 ×  5.74  FITS

**3/16" instead of 1/8" — a 50% larger drawing on the sheet that goes to
site.** The ladder has four rungs, so one rung is the most any single trick
buys; it is worth having and it is not worth two.

**And it only pays on a LONG plan.** A square-ish footprint gains nothing,
because rotating a square is a square. The trigger is the aspect ratio of what
is drawn against the aspect ratio of the region, and on this house it is 43.5 ×
73.5 against 14.85 × 10.00 — the drawing is portrait and the paper is
landscape, which is the whole of it.

## What it costs — and Movie cut the cost in half before it was built

The first version of this board said the work was keeping the lettering
upright: text is drawn at angles computed from the geometry it annotates, so
rotating the world rotates it too, and the painters would need to know the
sheet's rotation to decide which way each string reads — never upside down.
That is real work and it is spread across every text path.

**Movie, 21 Sep, removed it:**

> *"when the viewport rotates the texts and dimensions should stay fixed where
> they are does this make sense? make it easier?"*

It makes sense and it makes it much easier. **The ANCHOR rotates; the GLYPHS
do not.** A label's position has to travel with the drawing or it detaches
from the thing it labels — but its baseline angle need not follow. Put the
anchor point through the rotated transform, then draw the text unrotated.

That deletes the expensive half. There is no per-string "which way does this
read, do I flip it" decision left to make, because the answer is always the
same one: `fillText` at angle zero. What remains is plumbing a rotation
through `toS` and leaving the text calls alone.

**ONE CONSEQUENCE, NAMED SO IT IS A CHOICE AND NOT A SURPRISE.** A dimension
running along a rotated wall gets horizontal text rather than text following
the line. That is UNIDIRECTIONAL dimensioning — every string reads one way —
against the ALIGNED style where text follows its line. Both are real
conventions; mechanical drafting is unidirectional as standard and
architectural tends to aligned. At 90° it reads cleanly either way, and
unidirectional is the one that falls out of this rule for free.

## Rulings attached to it

**THE NORTH ARROW STAYS THE DRAFTER'S CHOICE.** I proposed forcing it on for
any rotated sheet, on the grounds that a rotated plan without one misleads.
**Movie ruled otherwise, 21 Sep:**

> *"the North Arrow should always be as it is now the user can decide (i only
> use it on site plan, but other users might put it on a regular floor plan)"*

So `NORTH ARROW · OFF` remains one of the titleblock options and rotation does
not touch its ON/OFF. Recorded rather than argued again.

**AND THE ARROW GETS A DIRECTION — WHICH IS ALREADY BOARD #289.** Movie, same
breath:

> *"and they can rotate the arrow based on the house position"*

Today it cannot. `northArrow` is a **boolean** in `LAYOUT.dc.html`'s state and
in the saved layout, and `titleblock.js:76` draws "the needle flying up the
sheet" — the needle is hard-coded, `moveTo(cx, cy + tail)` to `cy - tail`, with
no angle anywhere. The page already knows this is unfinished and names the
board twice in its own comments:

    LAYOUT.dc.html:1385   "The real plumbing — true north placed in model
                           space, construction north derived — is board #289"
    LAYOUT.dc.html:1616   "auto-setup from a model-space true north is
                           board #289"

So Movie's ask is that board, not a new one. What is new is the COUPLING
below.

**AND THE TWO FEATURES MULTIPLY.** If a sheet can rotate the plan AND the
arrow carries a real bearing, the drawn arrow must be `true north + the
sheet's rotation` — not either one alone. Build them in the wrong order and
the second silently invalidates the first: a plan rotated 90° with an arrow
still pointing up the sheet is worse than no arrow at all, because it is
confidently wrong rather than absent. **Whichever of the two lands first, the
other has to be written down as owing it**, and this paragraph is that debt
recorded from both ends.

**ONE ORIENTATION PER SET, NOT PER VIEWPORT.** A foundation plan rotated and a
main-floor plan not is a builder mentally rotating between two sheets of one
set. `_composeDefaultSet` already deals the whole hand in a single pass, so it
is the place to pick one orientation for all the plans in it.

**ELEVATIONS NEVER ROTATE.** They have gravity. Plans only.

**IT DOES NOT HAVE TO BE PERFECT**, which is Movie's own framing and it lowers
the bar usefully: the composer picks the orientation that wins a rung, and a
drafter who disagrees turns it back. That is the same bargain the auto-scale
ladder already makes — nobody expects the dealt hand to be final.

## Where it would go

`_autoScaleFor(views, region, axis)` returns the best `pif` for a set of views
in a region. The natural shape is for it to return an orientation alongside the
scale — try each rung both ways and take the first that fits, preferring
unrotated on a tie — since the chooser already has both numbers in hand and
nothing else has to learn anything.

`_viewFootprintFt` is the one function the scale chooser, the frame and the
painter all ask (its own comment says so), so a rotation that is honoured there
is honoured everywhere by construction.

## Not checked

- **Whether any spec pins an unrotated composition.** `_composeDefaultSet`
  deals thirteen sheets in a fixed order and something almost certainly
  asserts where they land.
- **The titleblock's own orientation.** It is drawn in paper space, not
  drawing space, so it should be unaffected — but that is an assumption, not a
  measurement.
