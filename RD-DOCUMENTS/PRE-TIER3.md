# PRE-TIER 3 — what lands before the Write Tier starts

**Skipper, 6 Sep 2026**, at Movie's ask, rewritten at the end of the day. A
sequencing list, not a plan: each item has or needs its own board or order.
Devin rules the order; this says what is on the table and why each one is
cheaper now than later.

## FIVE OF FIVE ARE DONE — THE GATE IS CLEAR

| | | |
|---|---|---|
| 1 | Underlays in MODEL.html | **DONE** `8b1a991` — tier 2 is complete |
| 2 | Capture the race reproduction | **DONE** — and it was a budget, not a race |
| 3 | The build row loses the rabbit | **DONE** #312 |
| 4 | The storey over the garage | **DONE** `5f6afba` — designed and built the same day |
| 5 | Two rulings with Devin | **DONE** — ruled 6 Sep, landed in #319/#320 and board #333 |

**Nothing stands between here and the Write Tier.** The census (W0) is the
next authorized work, per the standing work orders.

**Swept 9 Sep, and one of the two flagged lines was already right.**
`HANDOFF-to-devin-7sep.md:127` says this file *"still says one ruling blocks
it, `autoDimFirstOffsetFt`"* — it does not, and has not since `6c7d2d2` the
same day; item 5 below reads *"this no longer blocks anything"*. The handoff
was written before that commit and describes the file it was handing over,
not the file on main. The other flagged line was genuinely stale and is
corrected at the bottom of this page. **The Write Tier is not waiting on
anything, and tier 3 has since started and put four rungs down** — see the
ladder in `SPEC-model-html-tiers.md`.

**The principle underneath all five.** Devin's Write Tier acceptance is a
DEEP-COMPARE — the old page saves a drawing, the new page saves the same
drawing, and every key must match. From the moment that work starts, every
change to the old page is one more thing that has to be equal on both sides,
and every change to the suite is one more thing that can make a mismatch look
like a bug. Things that are free today are not free then.

---

## 1. Underlays in MODEL.html — DONE

`8b1a991`, *"Tier 2n: MODEL.html paints underlays, and says what it cannot
draw"*. All three parts landed: the raster loader, the painter call, and the
on-page notice for a PDF underlay, with its own test.

**PDF underlays stayed out** — pdf.js is 312 KB plus a 1,061 KB worker, which
more than doubles this page's payload for a tracing image. The notice exists
because the page already refuses to draw nothing silently
(`model-html-tier1.spec.js:229`), and a missing tracing image is that same
situation: the drafter opens their drawing, the thing they were tracing is
gone, and nothing on screen says why.

**Tier 2 is complete**, which is the gate Devin's review opens from.

## 2. Capture the race reproduction — DONE, and there was no race

`RD-DOCUMENTS/BOARD-test-budget.md`. The measurement:

    base 3223d79 @  90s  ->  2 failed, 2 failed, 1 failed
    base 3223d79 @ 180s  ->  0 failed, 0 failed, 0 failed

The heavy MODEL.html specs passed with no margin against a 90-second timeout,
so latency or contention tipped them over and the failing set rotated while the
cause stayed fixed. **It was never a race. It was a queue.** #314 raised the
budget to the number that was measured rather than guessed.

Writing it down first was the right order for a reason that stopped mattering:
underlays' loader is `SharedFileStore.loadNamedFile`, the same store the race
hypothesis pointed at, and it would have been the first painter to go back to
the store at paint time. A bug that stops reproducing is a bug that stops
getting fixed — but this one turned out to be a number, not a bug.

## 3. The build row loses the rabbit — DONE

#312, both surfaces: the build row and `first-run.js`. Its own work order,
`RD-DOCUMENTS/ORDER-build-row.md`. Movie's ruling, 6 Sep. It cancelled a
planned feature rather than removing working code — RABBIT was never built —
so it moved no geometry and stored no key.

## 4. The storey over the garage — DONE

`5f6afba`, five specs green. The one piece of NEW-5's board with real work in
it, designed and built the same day.

**Why it needed a level rather than a card.** A bilevel's garage sits at ENTRY,
half a storey down, so a floor standing on it lands below one standing on MAIN
— too far for a ceiling to absorb. An ordinary level card is one elevation
across the whole building and cannot say that. The sheathing is the test: where
one deck can run it is one level; where it cannot it is two.

**Every ruling made the work smaller than the day before:**

- **The id collision stopped existing.** Slots are switched on, not allocated,
  so 2 and 4 stay constants and `nextLevelId` is never touched.
- **The build type decides who gets them**, and Movie's menu narrowed it
  further: ENTRY on any BILEVEL, OVER GARAGE on MODIFIED BILEVEL alone.
- **The floor package is ruled** — 19 1/4" joists + 3/4" sheathing, the deck
  anchored, the garage wall derived from it, and the door head at 27 7/8" a
  limit the drafter designs around rather than a clamp.
- **The stairs are nothing.** Movie corrected U to *"2 short runs"*: the entry
  landing is a floor you walk off, not a turn you walk through, so neither run
  needs a shape, a landing, or a switchback rule.
- **The bone will place the core** — garage, front door, entry and stairs — and
  the drafter moves it.

**A slot is a ROW, never an entry in `levels`**, so a drawing saved with one on
screen is byte-identical to one saved without it. That is what let a
drawing-format-adjacent change land before a Write Tier whose acceptance is a
deep-compare.

Full design: `RD-DOCUMENTS/ORDER-inbetween-levels.md`. **Still to build, and
not on this list:** the bone actually pouring a bilevel, which needs the level
that now exists.

## 5. Two rulings with Devin — BOTH RULED, 6 Sep

- **`autoDimFirstOffsetFt` is a persisted key now.** Ruled as proposed:
  `positive`, null means derive 1.5, the `stored ?? derived()` contract.
  Landed in #319 (`drawing-format.js` + the old page's setter and dirty
  flag) and #320 (MODEL.html reads the offset off the drawing, closing
  tier 2's last acknowledged infidelity). This no longer blocks anything.
- **The build-type options board is board #333.** Movie's three-item menu
  (BUNGALOW / BILEVEL / DETACHED GARAGE) approved as revised; existing
  stored leaves keep their names, storey-over-garage derives from geometry
  — no new persisted key.

---

## What is NOT on this list, and why

- **The skins.** `palette.js` says its own night values are provisional. They
  clear contrast and nothing breaks if they are never ruled on. A taste
  decision, not a gate.
- **The chrome inventory.** Preparation for the dashboard tier rather than
  something that must precede the Write Tier.
- **The build row covering the top bar below 900px.** Found and mostly fixed
  6 Sep: the row now flows in the bar instead of floating over it, and every
  width from 1024 up is clear. Below 900 the bar genuinely runs out of room.
  Real, measured, and not a Write Tier gate.
- **A press-and-flag mechanism.** ~~Wants an owner.~~ **BUILT AND WIRED —
  corrected 9 Sep.** Three things wanted the same mechanism: a stair whose
  rise re-derives while nothing re-checks it still fits, the 27 7/8" door
  head, and pressing BUNGALOW on a drawing that has a built OVER GARAGE. Each
  is a case where the geometry correctly does not move and the page says
  nothing. `design-notices.js` owns it — built in #318 with 27 checks and 18
  mutations — and **it has callers**: `a824547` (PR #334) wired
  `garageDoorHeadNotice` into `PROJECT.html` and `stairRefitNotice` into
  `MODEL.dc.html`, with `tests/design-notices-wired.spec.js` asserting
  absence as well as presence, because a banner that appears once and never
  leaves is the bug a presence-only test passes on. **The third case is not
  in the module and that is deliberate**: it is board #333, its build row is
  not on main, and a function returning null until it lands would pass the
  harness for the wrong reason. It never gated the Write Tier, and now it
  gates nothing at all.

  *Kept as a corrected line rather than deleted: `HANDOFF-to-devin-7sep.md`
  hands this on as unwired open work, and a reader who finds only silence
  here would take the handoff's word for it.*
