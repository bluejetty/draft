# RULING — a window's HEAD is the datum, and the sill moves

**Movie, 21 Sep 2026:**

> *"on windows the top of the window should be default located 7ft high from
> the current level floor level (if the window changes size the bottom
> changes)"*

Status: **BUILT, 22 Sep** -- see the foot of this file. Recorded the moment it was said, because it
inverts an assumption that is currently written into two catalogue entries and
every window in every fixture.

---

## The rule, in one line

**Head = 7'-0" above the CURRENT LEVEL'S floor. Height is the variable. The
sill is derived, never chosen.**

So a window is described by its head (fixed) and its height, and
`sill = head − height`. Today it is described by its sill and its head, with
height falling out — which is the same three numbers related the other way
round, and gives a different answer the moment a window is resized.

**Why it is the right way round**, stated so nobody re-opens it: heads line up
across a wall and sills do not. A row of windows of different heights reads as
a row when their tops agree and as a mess when their bottoms do. That is also
how they are actually built — the header is set by the framing, and the
opening grows downward from it.

## What it changes

### The two catalogue entries, both of which name a sill

    auto-windows.js:16   DEFAULT_WINDOW  sillFt: 3,    headFt: 3 + 42/12   = 6.5
    auto-windows.js:21   WC_WINDOW       sillFt: 4.5,  headFt: 4.5 + 24/12 = 6.5

Both sit at a **6.5 ft** head today. The ruling puts them at **7.0**, and
turns each entry inside out: `{ widthFt, heightFt }` with the head coming from
the rule rather than from the entry. `DEFAULT_WINDOW` is a 42-inch window, so
it becomes sill 3.5; `WC_WINDOW` is 24-inch, so it becomes sill 5.0 — which is
half a foot higher than it is now, and for a WC that is a move in the right
direction anyway.

### Every window already drawn

The heads in `proto/repro-2storey-garage.draft` are `headHeight: 6.667`
(6'-8"), not 6.5 and not 7.0 — so drawings in the wild carry at least a third
value, and **this ruling is about the DEFAULT, not a migration.** A window
already placed carries its own `sillHeight` and `headHeight` on the record and
must keep them: re-seating existing windows because the default moved would
edit drawings nobody asked to have edited.

### Garage doors are not windows and are untouched

`GARAGE.HEAD_FT` (`auto-windows.js:268`) is its own number for its own reason.

## The one place it settles an open question

`BOARD-a-roof-through-a-window.md` proposes a reduced-height window where the
garage ridge crosses the glass, and asked whether to raise the sill or move
the window sideways. **This ruling answers it**: the head stays put and the
sill rises, which is exactly the shape of the fix that board sketched. With a
7.0 ft head on that 2ND FL wall:

    2ND FL floor                     9.00 ft
    head at 7.0 above it            16.00 ft
    garage ridge                    12.76 ft
    sill must clear it, + margin   ~13.0 ft  →  4.0 ft above the floor
    resulting window                ~3.0 ft tall

which is a taller window than the 2.6–2.8 ft the board estimated against the
6.667 head, and a better one.

## What has to be decided before it is built

1. **Does the catalogue change shape, or just its numbers?** Writing
   `headFt: 7` beside an unchanged `sillFt` keeps today's structure and
   satisfies the rule for the default case only — the moment a window is
   resized the sill would have to be recomputed by whoever resizes it, in
   however many places that is. Turning the entries into
   `{ widthFt, heightFt }` puts the rule in one place. The second is more
   work and is the one that actually holds.
2. **Who owns "7"?** It is a company standard, and `STANDARDS.html` /
   `room-standards.js` is where standards live — not a literal in a placer.
3. **The fixtures.** Every `.draft` under `proto/` carries windows at the old
   heads. They must NOT be rewritten (see above), which means the specs that
   assert head and sill values need to distinguish "what this drawing says"
   from "what a new window would get".

---

## BUILT, 22 Sep — and he answered the question this file left open

The three things this file said had to be decided:

### 1. "Does the catalogue change shape, or just its numbers?" — shape

`auto-windows.js`'s two entries now name **what a window IS** and nothing
about where it sits:

```js
const DEFAULT_WINDOW = { kind: 'default', widthFt: 30 / 12, heightFt: 42 / 12 };
const WC_WINDOW      = { kind: 'wc',      widthFt: 24 / 12, heightFt: 24 / 12 };
```

The head comes from the rule at deal time and the sill is derived. The WC ends
up on a 5'-0" sill **by arithmetic** rather than by being told to — which is
the half-foot rise this file predicted, and for a WC a move in the right
direction anyway.

### 2. "Who owns 7?" — `geometry-2d.js`, which already owns the others

It holds what an opening is when nobody has said, and the comment there
already explains why: those numbers were in three places and about to be in a
fourth. `DEFAULT_WINDOW_HEAD_FT` joins them. A door keeps 6'-8", because a
door stands on the floor and its head IS its height.

**`drawing-format.js` carries a second copy on purpose**, because it may not
read anything off `window` — its own rule, and the reason every page loads it
first. `proto/window-head-harness.js` is the price of that copy: it fails if
the two drift. The `ROOF_FASCIA_IN` lesson, a third time.

### 3. "The fixtures" — and Movie overruled this file

This file said existing windows **must not** be rewritten. Asked directly, he
said **"move to 7ft"**.

So they do — and the instruction that guards the drafter is his other
sentence, *"use can change window height"*. Both are only true at once if what
moves is **what nobody chose**: a window still sitting at a superseded default
(6'-8" or 6'-6") moves; a head typed by hand is left alone. Otherwise the
migration drags an 8'-0" head back to 7'-0" every time the file is opened.

**The size is what survives, not the sill.** A window moved to the new head is
the same window, higher — which is his rule the other way up: resizing moves
the bottom, so moving the top moves the bottom with it. Measured across every
committed fixture:

```
repro-movie-garage-2storey    21 windows, 21 moved, sizes kept
repro-2storey-garage          18 windows, 18 moved, sizes kept
repro-L-house                 20 windows, 20 moved, sizes kept
perf-bungalow                 16 windows, 16 moved, sizes kept
repro-washroom-bungalow       12 windows, 12 moved, sizes kept
repro-bungalow-garage-roofs    8 windows,  8 moved, sizes kept
```

### No version bump, and that is load-bearing

The stored **shape** does not change — `sillHeight` and `headHeight` are both
still written — so the migration needs none. Which is just as well:
`checkEnvelope` reads an older version as `'invalid'`, not as something to
upgrade, and there is no upgrade path in that module. **A bump would refuse
every existing file outright.**

It lives in `fenestrations()` because that is the one gate every reader goes
through — MODEL.dc.html, LAYOUT.dc.html and `proto/elevation-harness.js` all
call it — so no page has to remember to apply it. And it is idempotent, which
is what lets it live in a reader at all: run twice, the second pass finds
every window at 7'-0" and matches nothing, so no flag on the record is needed
to say it has run.

### Guarded

`proto/window-head-harness.js`, 18 checks, mutation-run:

```
the reader's copy of 7 drifts            -> the two modules disagree
every window migrates, hand-set included -> a head the drafter set is left alone
the migration keeps the SILL not the size -> keeps the size it had
doors are migrated too                    -> a door does not move
```
