# BOARD — the fascia board shows its thickness in elevation

**Movie, 20 Sep 2026**, looking at E3 BACK on `draft.bluejetty.ca`:

> *"on the left side fascias looks like you can soo the 2x6 fascia boards, but
> shouldn't see it"*

and, explicitly:

> *"don't do this now, reference it for later"*

Status: **RECORDED, NOT INVESTIGATED.** Nothing below is a diagnosis. It is
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
