# PRE-TIER 3 — what lands before the Write Tier starts

**Skipper, 6 Sep 2026**, at Movie's ask. A sequencing list, not a plan: each
item has or needs its own board or order. Devin rules the order; this says what
is on the table and why each one is cheaper now than later.

**STATE AT END OF 6 SEP — three of five are done.**

| | | |
|---|---|---|
| 1 | Underlays in MODEL.html | **DONE** (`8b1a991`) — tier 2 is complete |
| 2 | Capture the race reproduction | **DONE** — `BOARD-test-budget.md`, and #314 raised the budget to the measured value |
| 3 | The build row loses the rabbit | **DONE** (#312) |
| 4 | The storey over the garage | **DONE** (`5f6afba`) — designed and built the same day |
| 5 | Two rulings with Devin | **OPEN**, both |

**So what stands between here and the Write Tier is ONE RULING** --
`autoDimFirstOffsetFt`, a persisted key on shared ground. The other, a board
number for the build-type board, is not blocking.

**The principle underneath all five.** Devin's Write Tier acceptance is a
DEEP-COMPARE — the old page saves a drawing, the new page saves the same
drawing, and every key must match. From the moment that work starts, every
change to the old page is one more thing that has to be equal on both sides,
and every change to the suite is one more thing that can make a mismatch look
like a bug. Things that are free today are not free then.

---

## 1. Underlays in MODEL.html — the last tier 2 item

**DONE, 6 Sep — `8b1a991`, "Tier 2n: MODEL.html paints underlays, and says
what it cannot draw".** All three parts landed, the notice included. **Tier 2
is complete**, which is the gate Devin's review opens from.

The only painter left. Tier 2 is not finished without it, and Devin's tier-2
review is the gate the Write Tier opens from.

Measured already (Gilligan, task #16): the env is cheap — `activeLevel` for its
`id`, `isPrinting`, and `underlays` straight off the drawing. The work is the
raster loader, about 15 lines and **zero new dependencies**.
**PDF underlays stay out**: pdf.js is 312 KB plus a 1,061 KB worker, which more
than doubles this page's payload for a tracing image.

Three parts, not two: the loader, the painter call, and **an on-page notice for
any PDF underlay on the level** — with the notice getting its own test. The page
already refuses to draw nothing silently (`model-html-tier1.spec.js:229` pins
that an empty drawing says so), and a missing tracing image is the same
situation: the drafter opens their drawing, the thing they were tracing is gone,
and nothing on screen says why.

## 2. Capture the race reproduction — BEFORE underlays, not after

**DONE, and it turned out not to be a race.** `BOARD-test-budget.md` records
the measurement: the heavy specs passed with no margin against a 90-second
timeout, and #314 raised it to the 180 that was measured rather than guessed.
Written down before underlays touched the store, which is what this item asked
for.

See `RD-DOCUMENTS/BOARD-test-budget.md`. It reproduces today with one command on one machine.

**Underlays is the change most likely to take that away.** Its loader is
`SharedFileStore.loadNamedFile` — the same store the race hypothesis points at —
and it would be the first painter to go back to the store at paint time. That
either masks the race further or makes it much worse, and either way the
reproduction gets harder.

So the order matters: **write the repro down while it still works.** A bug that
stops reproducing is a bug that stops getting fixed.

## 3. The build row loses the rabbit

**DONE, #312**, both surfaces — the build row and `first-run.js`.

Its own work order (`RD-DOCUMENTS/ORDER-build-row.md`). Movie's ruling, 6 Sep. Cancels a
planned feature rather than removing working code — RABBIT was never built.
Moves no geometry, stores no key, so it is free today and pure noise inside a
deep-compare later.

## 4. The storey over the garage — waits on Movie

The one piece of NEW-5's board with real work in it. A bilevel's garage sits at
ENTRY, a half storey down, so a storey standing on it lands below one standing
on MAIN — too far for a ceiling to absorb, so they stay two levels. An ordinary
level card is one elevation across the whole building and cannot say that.

**DESIGNED AND BUILT, 6 Sep — `5f6afba`, five specs green.** The LEVELS panel
offers ENTRY on any BILEVEL and OVER GARAGE on a MODIFIED BILEVEL; ADD creates
the level at its own constant id, and the counter is never touched. A slot is a
ROW, never an entry in `levels`, so a drawing saved with one on screen is
byte-identical to one saved without it -- which is what let this land before a
Write Tier whose acceptance is a deep-compare.

Every ruling made the work smaller than the day before.
`RD-DOCUMENTS/ORDER-inbetween-levels.md` now carries every ruling, and each one
made the work SMALLER than the day before:

- **The id collision is gone.** Slots are switched on, not allocated, so 2 and
  4 stay constants.
- **The build type decides who gets them**, and the menu narrows it further:
  ENTRY comes with all three BILEVEL entries, OVER GARAGE with MODIFIED
  BILEVEL alone. One entry, not a family test.
- **The floor package is ruled** — 19 1/4" joists + 3/4", deck anchored, the
  garage wall derived, and the door head the drafter designs around.
- **The stairs are nothing.** Movie corrected U to *"2 short runs"*: the entry
  landing is a floor you walk off, so neither run needs a shape or a landing.
- **The bone places the core** — garage, front door, entry **and the stairs**
  — and the drafter moves it. Four things placed, the entry deciding where;
  nothing keeps a standing dependency after the press.

What remains is the gate, a create-at-a-given-id handler, and the specs.

It is listed here because it changes the DRAWING FORMAT, and a persisted-key
change during the Write Tier is the most expensive kind of change there is —
the new serializer would be chasing a moving target.

## 5. Two rulings still with Devin

- **`autoDimFirstOffsetFt` lives nowhere.** The bone keeps it for the session
  and never saves it, so the viewer draws a slightly different gap after a
  mid-session change. The house pattern already fits: a persisted key,
  `positive`, null means derive 1.5 — the same `stored ?? derived()` contract as
  ROOF HEEL. It is a `drawing-format.js` change on shared ground, which is
  exactly why neither agent should just add it. **A persisted key is far cheaper
  before the Write Tier than during it.**
- **The build-type options board.** Written up and merged as a board; needs a
  number and a ruling. Not blocking, but it is the entry flow, and the entry
  flow is what a drafter meets first.

---

## What is NOT on this list, and why

- **The skins.** `palette.js` says its own night values are provisional. They
  clear contrast and nothing breaks if they are never ruled on. That is a taste
  decision for whenever Movie wants it, not a gate.
- **The chrome inventory.** Worth doing for whoever plans the dashboard tier,
  but it is preparation for that tier rather than something that must precede
  the Write Tier.
- **The race FIX.** Only its reproduction is on this list. Fixing it needs an
  owner and real debugging time, and holding the Write Tier for it would be
  trading a known, documented, reproducible defect for a schedule slip.
