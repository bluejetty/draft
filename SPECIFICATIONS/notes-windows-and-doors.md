# Standard notes — windows and doors

Notes that go on the sheet. Each one is here because the drawing cannot
guarantee the thing it describes.

## Note W1 — rough openings

> The framer shall verify all rough opening sizes against a confirmed window
> and door order prior to framing.

**Why.** The RO is a consequence of a product that has not been bought when the
plan is drawn. The drawing carries a nominal size so the plan can be built and
scheduled; the built size is whatever the confirmed order requires.

**Consequence for the app.** A window's dimension is **nominal until
confirmed**. Nothing downstream should treat it as the built size.

## Note W2 — bedroom egress openings

> Windows serving bedrooms shall provide an unobstructed openable area
> conforming to NBC 9.9.10.1. The supplier shall confirm the clear opening of
> the specified unit meets this requirement.

**The requirement** (NBC 2020, Division B, 9.9.10.1.):

- Each bedroom needs at least one outside window **or exterior door**, openable
  from inside without keys, tools or special knowledge, and without removing
  sashes or hardware. Not required where the suite is sprinklered.
- A window used for this shall give an unobstructed opening of not less than
  **0.35 m²** with **no dimension less than 380 mm**, and shall hold that
  opening in an emergency without additional support.
- Where it opens into a window well, **760 mm** clearance in front of the
  window.

**Why the note.** The 0.35 m² is the hole a person climbs through — not the
rough opening, not the glass. Frame and sash take roughly 3" a side, and how
much of the unit actually opens depends entirely on its type:

| Unit | Clear opening |
| --- | --- |
| Casement | most of the unit, less about 3" a side |
| Slider | roughly half the width |
| Awning | reduced by the sash angle |

So the same 2'-6" x 2'-6" unit passes as a casement (about 2'-0" x 2'-0" clear,
0.372 m²) and fails as a slider. Since the drawing does not know which product
is bought, the supplier confirms.

**Working shorthand for the drafter.** 2'-0" x 2'-0" clear satisfies both the
area and the minimum dimension. 2'-6" square is the smallest casement that gets
there, with nothing spare — 3'-0" square is where it stops being marginal.

**Consequence for the app.** A window carries two numbers: the unit size that
is drawn and scheduled, and the clear openable opening derived from it by type
and frame allowance. The egress test reads the second. A marginal result is a
**warning to the drafter**, not a guarantee to the inspector — the note is what
carries the obligation.

## Related

- NBC 2020 9.5.1.2., Combination Rooms — where a bedroom is a dependent area,
  direct passage is required so the escape window keeps its function.
