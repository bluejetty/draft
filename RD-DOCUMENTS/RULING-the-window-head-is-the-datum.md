# RULING — a window's HEAD is the datum, and the sill moves

**Movie, 21 Sep 2026:**

> *"on windows the top of the window should be default located 7ft high from
> the current level floor level (if the window changes size the bottom
> changes)"*

Status: **RULED, NOT BUILT.** Recorded the moment it was said, because it
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
