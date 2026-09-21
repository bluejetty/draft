# BOARD — rotating a plan to win a rung of scale

**Movie, 21 Sep 2026**, looking at a long plan running off an 11×17 sheet:

> *"i'm wondering based on drawing size (length) we might also want to rotate a
> plan so it fits better on a page with a better scale, what do you think"*

and, on how exact it has to be:

> *"it doesn't have to be perfect the user will always need to check it and
> make sure everything is where they would like it positioned"*

Status: **PROPOSED, NOT BUILT.** New ground — Movie confirms MODEL.dc.html had
no rotation of any kind, so nothing is being ported here.

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

## What it actually costs: the text, not the geometry

Rotating the drawing is one change to `toS` and is nearly free. **The work is
keeping the lettering upright.**

Dimension text and room labels are drawn at angles computed from the geometry
they annotate, so rotating the world rotates them with it and half the sheet
comes out sideways or upside down. The drafting rule is that text reads from
the bottom of the sheet or from the right edge, never upside down — so the
painters have to know the sheet's rotation to decide which way each string
sits. That lands in `render-2d.js`'s text paths (`drawDimension2D`, and room
tags wherever they end up) and it is the scope of this board.

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
