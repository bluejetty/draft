# PRE-TIER 3 — what lands before the Write Tier starts

**Skipper, 6 Sep 2026**, at Movie's ask. A sequencing list, not a plan: each
item has or needs its own board or order. Devin rules the order; this says what
is on the table and why each one is cheaper now than later.

**The principle underneath all five.** Devin's Write Tier acceptance is a
DEEP-COMPARE — the old page saves a drawing, the new page saves the same
drawing, and every key must match. From the moment that work starts, every
change to the old page is one more thing that has to be equal on both sides,
and every change to the suite is one more thing that can make a mismatch look
like a bug. Things that are free today are not free then.

---

## 1. Underlays in MODEL.html — the last tier 2 item

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

See `RD-DOCUMENTS/BOARD-test-budget.md`. It reproduces today with one command on one machine.

**Underlays is the change most likely to take that away.** Its loader is
`SharedFileStore.loadNamedFile` — the same store the race hypothesis points at —
and it would be the first painter to go back to the store at paint time. That
either masks the race further or makes it much worse, and either way the
reproduction gets harder.

So the order matters: **write the repro down while it still works.** A bug that
stops reproducing is a bug that stops getting fixed.

## 3. The build row loses the rabbit

Its own work order (`RD-DOCUMENTS/ORDER-build-row.md`). Movie's ruling, 6 Sep. Cancels a
planned feature rather than removing working code — RABBIT was never built.
Moves no geometry, stores no key, so it is free today and pure noise inside a
deep-compare later.

## 4. The storey over the garage — waits on Movie

The one piece of NEW-5's board with real work in it. A bilevel's garage sits at
ENTRY, a half storey down, so a storey standing on it lands below one standing
on MAIN — too far for a ceiling to absorb, so they stay two levels. An ordinary
level card is one elevation across the whole building and cannot say that.

**Blocked on Movie's sketch**, deliberately: where the OVER GARAGE level comes
from and what the drafter presses. Neither agent should invent that answer.

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
