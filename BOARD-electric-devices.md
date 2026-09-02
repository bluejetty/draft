# Work order — the electric plan, placed by the build

**Board:** electric, part 1 of the two named in `BOARD-structural-electric-gap.md`.
**Raised by:** Movie, 1 Sep 2026, from sheet 14 of the SHARMA set.
**Spec:** `SPEC-electric-plan.md`, in this repo beside this board — read it
first. It is where the symbols, the placement rulings and the CODE/OFFICE
split live. This board implements it and is **not allowed to invent a rule
that is not in it**.
**Depends on:** the layer whitelist fix (below) — same board, but first.

---

## The job

**The house build places the electric plan.** Movie's ruling, 1 Sep: *"place
everything auto on house build as best as you can, we will refine."* So a
finished bone comes with its lights, switches, outlets and detectors already
on it, and the drafter corrects what he disagrees with rather than starting
from an empty sheet.

That makes the centre of this board a **pure rules module**, not a painter:

```js
DraftElectricRules.deviceFor(house)   // rooms, walls, doors in
                                      // devices + their switch legs out
```

Pure, node-loadable, frozen export, no DOM — the same shape as
`toy-constraints.js` and `layer-views.js`. It matters that it is pure for a
reason beyond tidiness: **the same function later answers "what is missing?"**
for a drafter placing devices by hand. Generate and check are one rule table
read two ways, and if the rules are written inside the generator, the check
gets written a second time and the two drift. Build the table once.

---

## Do this first: the layer whitelist

`MODEL.dc.html` 4999–5001 restores a saved line's layer through a hand-written
chain:

```js
layer: line?.layer === 'no-draft' ? 'no-draft'
     : line?.layer === 'S-FOOTING' ? 'S-FOOTING'
     : (line?.layer === 'E-POWER' || view === 'e-power') ? 'E-POWER' : 'draft',
```

Three names survive a reload. **Every other layer name silently becomes
`draft`.** That is not a cosmetic bug: `layer-views.js` deals a sheet by layer
name, so a device flattened to `draft` does not come back wrong-looking, it
comes back *missing from the ELECTRIC sheet* — and only after a save and
reopen, which is the shape of bug you hear about from a customer.

**And it is not the only one.** Gilligan's reading, 1 Sep, corrected this
board — **two** places spell out the same three names by hand, not one:

| Where | What it decides | Failure if missed |
| --- | --- | --- |
| `MODEL.dc.html` 5017 | the layer a saved line comes back as | device vanishes from the sheet after a reload |
| `MODEL.dc.html` 8544 | the standard a line is *painted* from | device loads correctly and still draws as `draft` |

Fixing only the first is the trap: the save-reload test then passes and the
device is still wrong on screen. Fix both.

There is a third hardcoding, `normaliseActiveLineLayer` in `profile-manager.js`
272, and **it is not one of these — leave it.** It governs which layer the
drafter may pick to draw on, and `draft` / `no-draft` is the right answer
there. See the sheet-restrictions section below.

The canonical table is **`DEFAULT_LAYER_STANDARDS` in `profile-manager.js`
277** — Gilligan's find, and better than what this board originally said. Drive
both off it, so adding a layer is a table entry rather than a third branch in
two places for somebody to forget.

Prove it with a save-reload round trip on a layer that is *not* one of the
three, **failing on the unfixed code first**. Add a case for the painted
standard too, or the second gate goes unnoticed exactly as it did here.

**The round trip has to go through the app.** Gilligan's catch, 1 Sep, on his
own test: a proof that writes a file and reads it back passes on the unfixed
code, because it never asks the loader anything. Load the saved drawing into
MODEL and re-serialise from there — and check the test fails before the fix,
which is the only thing that tells you it is asking a real question.

Only then add the new layer.

---

## The devices

Two hosts, and every device has exactly one. **Wall-hosted devices copy the
fixture pattern verbatim** — `drawing-format.js` 157–189: `wallId`, `offset`
along the wall from its start, `side`, and **no stored geometry**, so the
device redraws from the current wall and rides a wall edit instead of being
orphaned by it. That pattern is already in the repo and already works. Do not
invent a second one.

| Device | Host | Layer |
| --- | --- | --- |
| Pot light, ceiling fixture, chandelier, fan | ceiling | `E-POWER` |
| Outlet, switch, vanity light | wall | `E-POWER` |
| Stove / dryer outlet | wall | `E-POWER` |
| **Floor outlet**, **ceiling outlet** (two kinds) | room — see below | `E-POWER` |
| Smoke detector, CO/smoke detector | ceiling | **`E-SAFETY`** |

### The floor outlet and the ceiling outlet

Movie's ruling, 1 Sep: a **floor outlet and a ceiling outlet**. An addition to
the sheet-14 set, not something read off it.

The mark, in Movie's words and the same for both: **the circle with its two
lines, the same size as the wall outlet, with a square drawn around it**, and
the text `CEIL` or `FLR` above, below or beside it. Those exact words, no
periods.

They matter out of proportion to their size, because they are the first devices
*deliberately not on a wall* — they sit out in the field of a floor or a
ceiling, which is the whole reason they exist. So they cannot use the wall
pattern and they force the storage question below to be answered rather than
deferred.

**Answered, and superseding the earlier ruling on this board: two separate
kinds, and nothing converts between them.** Movie, 1 Sep. Not one device with a
`surface` field and no floor-to-ceiling flip — build them as two device kinds,
placed separately, and a drafter who wants the other deletes and places the
other. Ignore any earlier wording that had you store a switchable surface; the
plane is not a setting on a device, it is which device was placed.

So the two kinds are two device kinds but **one mark**, and the label is the
only thing that distinguishes them anywhere — not in the drawing and, once
there is no stored surface, not in the model either. `CEIL` and `FLR` are the
device's identity as drawn, not decoration on it. The painter must not treat
them as droppable annotation: no truncation, no vanishing at small scale. An
unlabelled square is a box the builder has to guess at. (Sheet 14 already works
this way — a chandelier and a vanity are the same circle told apart by text.)

**The symbols are drawn — no placeholder needed.** `electric-symbols.js` on
this branch: `wallOutlet`, `floorOutlet`, `ceilingOutlet` off one shared
`outletMark`, plus `drawDevice` for the host rotation. The label is drawn by
the same function as the square, so a caller cannot paint the box and forget
the text, and `MIN_LABEL_PX` is a floor the text will not shrink below.

**Ceiling-hosted storage is an open call and yours to make in the PR.** A point
on a level is the obvious one; a room-relative point survives a room being
resized. Say which you chose and why — it is the one storage decision this
board makes that the spec does not settle.

### The life-safety layer

`E-SAFETY` is new, it is Movie's ruling that it exists, and `E-SAFETY` is the
name he settled on (1 Sep) — it matches the `A-` / `S-` / `E-` prefixes already
in `DEFAULT_LAYER_STANDARDS`. Detectors must be on a layer **that is always
on**, so a drafter switching the electric off to work on something else cannot
make the smokes vanish from a sheet.

Add it to the vocabulary in `tests/layer-standards.spec.js` and to
`layer-views.js` — and note it belongs in the `contents` of the **plan views
too**, not only `e-power`, which is the whole point of it. Nothing else in
that table behaves this way, so say plainly in the PR how "always on" is
enforced rather than merely intended.

---

## The rules to implement

All from the spec; all Movie's. Repeated here only so the board is checkable.

1. **A room with one light centres it** in the room.
2. **One switch per light bank.** Movie's ruling, 1 Sep, and the unit
   everything else is counted in: a **bank** is the lights that go on and off
   together, and it has exactly **one** switch. Four pot lights that come on
   together are one bank on one switch, not four switches. No three-way
   switching yet — his instruction — so one means one.
3. **Switches gang at the entry** — the switches sit beside the door you come
   in by. A **bank** is lights and a **gang** is switches: the gang holds one
   switch per bank, so the gang count is the room's bank count, one `$` each —
   the distinct switches in the room, counted, not a number anyone maintains.
4. **A light joins the bank it is entered from** — pick the switch by
   *direction*, not by shortest straight line. Nearest-by-distance fails
   exactly where it shows: a light near a party wall is often closest to the
   next room's bank.
5. **Outlets sit on the wall face** — measured off sheet 14 at a median 0.29 ft
   from the wall line, which is to say: on it.
6. **Multi-fixture rooms space at roughly 5–7 ft** — measured, medians of 6.6 /
   5.0 / 5.9 ft across the three plans.

Rules 5 and 6 are **measurements, not rulings**. They came from classifying
690 red blobs on one sheet, of which 37 circles and 77 outlets classified
confidently — a sample. Use them as defaults; do not enforce them; and if
implementing shows a number to be wrong, that is a finding for Movie, not a
number to quietly change.

**The pot light grid is deliberately unspecified.** Spacing alone cannot tell a
grid from a row, and how a grid fits a room — rows, and how far off the walls
it starts — is Movie's rule and he has not given it. Place a single centred
fixture where the room wants one light. **Do not invent a grid.**

### The switch leg is derived, never drawn

> **A fixture stores what switches it. The painter draws the curve from that,
> and the bank is what you get by grouping fixtures on that switch.**

**The bank is derived, never stored** — your call, 1 Sep, and your reason, not
the one an earlier draft of this board gave. Not drift: `light.bankId` +
`bank.switchId` duplicates no fact. **Orphaning**: a stored bank outlives its
last light and sits there attached to a switch holding nothing, which is
exactly what the leg rule forbids and exactly what a thing-in-its-own-right
inherits. Grouped, the last deletion makes the bank stop existing.

Nothing new to store, then, and the change is only in how the generator
assigns: lights are grouped into banks and each bank gets one switch, rather
than each light hunting a switch on its own. Gang count is the distinct
switches in the room, counted.

State the revisit condition in the PR: **three-ways**. A light answering to
more than one switch stops `switchId` being a single value and the bank
becomes a real entity — cheap then, because the grouping already names the
seam. Not now; Movie's instruction.

The red dashed curves on sheet 14 are the only thing that says which switch
runs which lights, so they must come out of the stored relationship. If a
drafter can route them by hand, the sheet can say a switch controls a light
that the model does not, and nobody ever finds out.

**The leg is attached at both ends.** Movie's ruling, 1 Sep: drag a light and
its curve follows; delete a switch and its legs go with it. A leg can never be
left behind pointing at nothing, because it is not a thing that exists on its
own — it is the picture of a relationship, redrawn every frame from the two
devices it joins. Nothing stores its geometry.

One warning, from failing at it: I could not recover Movie's pairings by
tracing the dashes out of the PDF — 4,538 dash candidates chained into 140
runs, several spanning most of a plan, because proximity-and-collinearity
merges unrelated legs wherever two cross. **Do not try to validate your
pairings against the PDF geometry.** Validate them against rule 3.

---

## What the drafter can do on the electric sheet

Movie's ruling, 1 Sep: **move, delete, add. Nothing else, and only electric
things.**

- The only tools on that sheet are place a device, move a device, delete a
  device. **No line drawing at all** — which is what keeps the dashed leg
  honest, because the only way to change what a switch runs is to move or
  delete the device itself.
- **Three verbs and no fourth.** You were right that flipping a placed outlet's
  surface was none of move, delete or add. Movie's later ruling — two separate
  outlet kinds, no conversion — removes the case, so the list stays closed and
  nothing on this sheet edits a property in place.
- **A symbol this board does not cover is made in the Boneyard, not drawn on
  the plan.** Movie's ruling, 1 Sep. The escape hatch for a device nobody
  anticipated is to author a custom electric object and then place it — so it
  arrives as a device with a host, and every electric thing on the sheet stays
  something the rules can reason about. Freehand linework would be the one
  electric thing that cannot be checked, cannot ride a wall edit, and cannot
  export. Out of scope to build here; in scope not to foreclose.
- **`E-SAFETY` must never be a drawable active layer.** `normaliseActiveLineLayer`
  (`profile-manager.js` 272) collapses the drafter's layer choice to `draft` or
  `no-draft` and that is deliberate, not an oversight — semantic layers are
  stamped by context and by the build. Leave it alone, and say in the PR that
  you left it alone on purpose: a detector is placed by the build, never drawn
  freehand.
- **Everything that is not electric is locked.** Walls, doors, fixtures,
  dimensions, room tags — visible as the background you draw on, not
  selectable, not draggable. A drafter cannot nudge a wall while he is placing
  outlets on it.

Enforced by the mode, not by the painter: the sheet's hit-testing only ever
returns electric entities. If it is done by making other things merely hard to
grab, it is not done.

### Adding snaps to the preferred positions

Movie's ruling, 1 Sep: **when the drafter adds a device, magnet it to the
positions the rules prefer.**

This is the same `electric-rules.js` read a third way, and that is the whole
point of it:

| Read | Question | Used by |
| --- | --- | --- |
| Generate | what goes here? | the build |
| Snap | where would it have gone? | adding by hand |
| Check *(later)* | what is missing? | drafting mode |

So the module should return **candidate positions**, and generating is
nothing more than accepting all of them. A device added by hand then lands
exactly where the build would have put it, and hand-placed and auto-placed
plans cannot drift apart — which is the real prize, because the drafter is
about to spend his time in a plan the build wrote.

Concretely, dragging a new device offers: the room centre for a light, the
entry-side bank position for a switch, the outlet stations along a wall, and
for a ceiling device in a multi-fixture room the 5–7 ft spacing off its
neighbours. Detectors snap to their room's ceiling point.

**A wall-hosted device sticks to a wall, always.** Movie's ruling, and it is
already the storage model rather than a behaviour to add: a switch or an outlet
is an `offset` along a `wallId`, so there is no representation for one floating
in the middle of a room — it cannot be dropped off a wall because it cannot be
stored off a wall. Dragging one slides it along its host and hops it to another
wall when the cursor is nearer that one; it never leaves the walls. This is
also what makes it ride a wall edit instead of being orphaned by it.

That gives the two hosts different drag behaviour, which is correct and worth
stating so nobody unifies them: **wall devices slide, ceiling devices float.**

Two constraints on it:

- **Use the existing snap zone.** `profile-manager.js` 223 has
  `DEFAULT_SNAP_ZONE = 4` with a user range of 1–60, and the drafter has
  already tuned it. Do not introduce a second, private radius. Note it is a
  **pixel** radius, so the magnet loosens as you zoom out — which is what the
  drafter expects, and is a reason not to reinvent it in feet.
- **A magnet is a suggestion, not a rule** — for ceiling devices, and for
  *where along a wall* a wall device sits. Being on a wall at all is not a
  suggestion. This board restricts *what tools exist*, not where a device may
  sit — the spec's line about limiting damage to the building rather than his
  judgement is exactly this distinction.

This is the same rule as TOY MODE and for the same reason — limit what he can
do so that what he makes stays true. `SPEC-toy-mode-constraints.md` is the
precedent for how a refusal should read; nothing here needs to argue it again.
It lands with #221 and is not on main yet — the precedent is worth reading, but
nothing in this board waits on it.

---

## Auto, and the drafter's corrections

The build places these, and the drafter then moves them. So a re-deal must not
wipe his work — and the repo already solved this once. Board #169 put an
`auto: true` flag on the bone's own windows (`drawing-format.js` 138) precisely
so a re-deal knows which are still its to replace, with old drawings validating
unchanged as the drafter's.

**Copy that.** Auto-placed devices carry the flag; anything the drafter has
touched loses it and survives the next build. Getting this wrong is the failure
that makes the feature worse than nothing: Movie refines the plan, rebuilds,
and loses the refinements.

---

## Proof

- A node harness for `electric-rules.js`, run without a browser, in the shape
  of `proto/toy-constraints-harness.js`. Every rule above gets a case, and
  rule 3 gets the party-wall case that distinguishes it from nearest-by-distance
  — a rule that is only correct in the easy case is not implemented.
- A save-reload round trip proving a non-whitelisted layer survives, **failing
  on the unfixed code first**.
- A round trip proving a drafter-moved device survives a rebuild.
- A case proving a moved light drags its leg with it, and that deleting a
  switch takes its legs — no orphan curve, ever.
- A case proving a wall cannot be selected or moved on the electric sheet.
- A case proving an outlet dragged into open floor lands on a wall, and that a
  wall device follows its wall when the wall moves.
- A case proving a hand-added device with the magnet on lands where the
  generator would have put it — same rule, same answer.
- The full suite, with the total stated before it runs.

## Not in this board

- Circuits, panels, breakers, home runs, load calculations. A switch leg is not
  a circuit and sheet 14 does not draw one.
- The pot light grid. Unspecified above, deliberately.
- A legend block. Sheet 14 has none; separate, easy, later.
- Any CODE enforcement. The spec lists the candidates — smoke placement,
  receptacle spacing, GFCI, stair lighting, bath fan — with **no citations**,
  and uncited is not code. Do not enforce one because it sounds right.
