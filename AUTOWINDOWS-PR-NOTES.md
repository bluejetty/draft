# BUILD HOUSE auto windows — board #169

The bone stops leaving walls bare. BUILD HOUSE now deals windows onto the
exterior walls by the office siting ruleset, and picks the garage-door face
when the run is ambiguous. Everything it places is an ordinary fenestration —
editable, deletable, labelled by the #141 ladder. The bone deals the first
hand, never the last.

## What is here

**`auto-windows.js`** — the siting ruleset as a pure module (`window`-guarded,
frozen, DOM-free, node-loadable). Faces, room claims and existing openings in;
a list of window placements plus a `report` out. `dealWindows` and
`garageDoorPlan` are the two entry points; `faceOrientation` is the single
place the E1-E4 mapping lives, so this board and the section marks cannot
drift apart.

**`MODEL.dc.html`** — gathers the real geometry (`_autoWindowFaces`,
`_autoWindowRooms`), commits the result (`_dealAutoWindows`), and calls it from
`_buildHouse` after the rooms are grown, because the grown claims are the
bedroom-access oracle the rules read. Script tag added in this same commit.

**`drawing-format.js`** — one additive field: `auto` on fenestrations. Old
drawings have no flag and validate unchanged as the drafter's.

**`SETTINGS.html` + the settings package** — an `autoWindows` toggle, default
ON, same medicine as #260/#275.

**`tests/helpers.js`** — the seeder gains an `autoWindows` opt-in, seeded OFF
so every legacy spec builds exactly the house it built before.

## The rules, as implemented

- **Front and back maximized** — at least 2 per floor on each, more as the run
  allows (front caps at 5).
- **Sides serve bedrooms first** — a stamped BEDROOM whose claim touches no
  front or back face is *trapped*; the side it does touch rescues it and
  becomes the window side.
- **No trapped bedroom → one side only.** Deterministically LEFT (E2) until
  the site plan lands (#43/#212). One wall of the house ends up bare. That is
  the rule, not a bug, and the deal says so in its report.
- **Trapped on both sides → both sides work.**
- **Never crowd** — 3'-0" between opening edges, 2'-0" off a corner, enforced
  against the drafter's existing openings as well as our own.
- **Default W 30x42, centred on the room's frontage**; a room without a stamp
  centres on the face segment. WC/BATH/ENSUITE takes the small W 24x24 set
  HIGH — the point is daylight without a sightline, so the sill moves, not
  just the size.
- **Deference** — a face carrying a drafter opening or a BONEYARD-mark opening
  is skipped whole. A re-press re-deals only its own untouched windows.
- **Garage door face** — the street face when the garage steps back, otherwise
  the face opposite the man-door connection; two 8'-0" singles instead of one
  double when the run fits, spaced by the same 3'-0" rule.

## Judgement calls worth your eye

1. **"two singles G 8x7"** — the #141 ladder reads garage doors HEIGHT x WIDTH
   in feet, which would make `G 8x7` an 8'-high, 7'-wide door. The existing
   machinery has `GARAGE_OVERHEAD_HEAD_FT = 7` and `GARAGE_OVERHEAD_DOOR_FT =
   16`, i.e. a 16'-wide, 7'-high double. I read the order's "8x7" as the
   common 8'-wide, 7'-high single and followed the CODE rather than the label
   order, since the order says to reuse the machinery. If you meant a 7'-wide
   door, it is one constant (`GARAGE.SINGLE_FT`).
2. **The garage face logic is gated behind `autoWindows`.** Refining where the
   door lands changes existing behaviour, and the legacy garage specs are
   correct about the old rule. With the board off, the old longest-leg pick and
   the old man-door pick both stand untouched; with it on, the office rules
   apply. That keeps `detached-garage.spec.js` honest instead of rewritten.
3. **The bone deals on `plan` floors only** — the foundation is not glazed.

## Not built, deliberately

- No eyedropper / fenestration property painter — later slice of #169.
- No site-plan road awareness — deterministic LEFT stands in.
- No new ladder sizes beyond W 30x42 and the W 24x24 WC unit.
- No elevation/3D styling changes; existing rendering draws them.
- **The walk-the-face tap gesture is NOT built.** The rules that decide the
  door face are, and they are pinned; the SELECT-mode tap to re-deal the door
  onto another face is a pointer-board affordance and I left the seam rather
  than half-fitting one. `garageDoorPlan` takes a face list, so a tap handler
  only has to pass the tapped index.

## One thing I could not pin, and did not paper over

A deleted auto window is declined for the session — the code records it
(`_declinedAutoWindows`, keyed to wall + spot) and a re-press honours it. I
could **not** get a spec to drive that path: clicking an auto window on a
built house never selects it in the harness, while a hand-placed window on a
hand-drawn wall selects and deletes at the equivalent point every time. I did
not root-cause the difference, so I am not claiming it is an app defect — but
it is worth someone's eye, because if it reproduces by hand it means auto
windows are harder to grab than hand-placed ones, and "editable, deletable" is
the whole promise of this board. The decline logic ships; its spec does not.

## Gates

- `node proto/auto-windows-harness.js` — **45 checks passed, 0 failed**.
  The harness caught a real bug in my own module on the way: two singles
  centred at thirds sit 8'-0" apart on a 24' run, which cuts the pier between
  them to nothing. They are centred as a group now.
- `tests/auto-windows.spec.js` — **8 passed**.
- Pinning specs untouched and green: `fenestration`, `fen-labels`,
  `fenestration-detail`, `drawing-format`, `store-integrity`, `auto-house`,
  `boneyard-marks`, `house-tour`, `tour-rooms`, `room-grow`,
  `detached-garage`, `settings` — **103 passed** across the focused runs.
- Full suite: CI's to run. Baseline for the arithmetic, measured rather than
  assumed: `main` at `4b0d7dd` carries **602** spec declarations and this
  branch **610** — the +8 being `auto-windows.spec.js` and nothing else, since
  it is the only spec file this branch adds or changes. A green run should
  report **610 passed**; any other number means something moved that should
  not have.
