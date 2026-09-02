# Spec — the electric plan

Repo `bluejetty/draft`. Draft 1, 1 Sep 2026. Written by Kevin (Port Admiral)
from Movie's rulings and from sheet 14 of the SHARMA plan set, which is the
reference drawing for every symbol below.

**This is a specification, not a work order.** Nobody implements from it until
Movie has read it back. Board B in `BOARD-structural-electric-gap.md` is the
work this feeds.

---

## Why this one is different

Every other sheet in the set paints geometry the app already holds. Sheet 14
paints geometry that **does not exist anywhere in the drawing format** — not
untagged, absent. There is no outlet, switch, fixture-on-a-circuit, panel or
home run in the model.

So this is not a painter board. It is, in order:

1. what an electrical device **is** and how it is stored,
2. how the drafter **places** one,
3. the painter,
4. and only then the sheet.

Fold those together and the sheet will be right until somebody moves a wall.

---

## The taxonomy

Same three buckets as the guidebooks. Keep them apart.

| Bucket | Means |
| --- | --- |
| **CODE** | External legal requirement, with a citation. |
| **OFFICE** | Rough Drafter's own convention. Ours to change. |
| **RUFFDRAFTER** | Good practice. Advice, not a refusal. |

> **Anything uncited is not CODE until it is cited.**

Nothing in the CODE section below carries a citation yet. It is therefore
listed as **CANDIDATE CODE** and must be cited against the NBC and the
Canadian Electrical Code — with the Saskatchewan amendments, since the
reference plan is Saskatoon — before a single rule refuses anything. Until
then they are advisory at most.

---

## OFFICE — the drawing conventions

Read off sheet 14. These are settled, because they are what Movie's plans
already look like and what his inspectors already accept.

**Everything electrical is red**, over the plan in its normal colours. The
plan below is context, not the subject.

| Device | Symbol on sheet 14 |
| --- | --- |
| Pot light | small circle, X through it |
| Ceiling fan | five-blade fan, hub on a circle |
| Chandelier / shower light / vanity light | plain circle, named in text beside it |
| Smoke detector | plain circle, `SMOKE DET.` |
| Combination detector | plain circle, `CO/ SMOKE DET.` |
| Outlet | two-prong tick sitting on the wall line |
| Switch | `$` — and a gang is a repeat: `$$`, `$$$` |
| Stove | four-burner symbol, drawn in red over the range |

**The dashed red curve is the switch leg**, drawn from a switch to every
fixture it controls — i.e. to every light in its bank, so a bank of four draws
four curves from the one switch.

Two devices are **not** on sheet 14 and are Movie's addition, 1 Sep:

| Device | Symbol |
| --- | --- |
| Floor outlet | the wall-outlet mark, same size, with a square around it, labelled `FLR` |
| Ceiling outlet | the wall-outlet mark, same size, with a square around it, labelled `CEIL` |

Movie's description, 1 Sep: the circle with its two lines, **the same size as
the wall outlet**, a square drawn around it, and the text `CEIL` or `FLR` above,
below or beside it. The mark is identical for both; only the text differs.

They are the only outlets deliberately off the wall — they sit out in the field
of a floor or a ceiling, which is the point of them. So they host on the room
the way a pot light does, and they are what forces the ceiling-host storage
question below to be answered rather than deferred.

**Settled, Movie's ruling 1 Sep: two separate kinds, and nothing converts
between them.** Not one device with a surface field, and no floor-to-ceiling
flip — a floor outlet and a ceiling outlet are placed as different devices, and
a drafter who wants the other one deletes this one and places that one. Which
is the plainer model: the plane is not a setting on a device, it is which
device you placed.

They share one mark, so **the label is the only thing that distinguishes them,
anywhere.** `CEIL` and `FLR` are not annotation on this device, they are the
device's identity as drawn — which is the same trick sheet 14 uses to tell a
chandelier from a vanity, two devices that are also the same circle. So the
label is not optional, must not be truncated, and must not drop out at small
scale: an unlabelled square is a box the builder has to guess at.

### Placement — where the devices actually go

Movie's own rules, given 1 Sep, plus what sheet 14 measures out at. The
rulings are settled; the measurements are **approximate and want his eye on
them** before anything enforces a number.

**The light goes in the middle.** A room with one light fixture centres it in
the room. Movie's ruling, and it is the cheap one to implement — a single
fixture takes the room centroid and nothing else has to be decided. Pot lights
are the separate case: several fixtures in one room, laid out rather than
centred.

**One switch per light bank.** Movie's ruling, 1 Sep, and it is the unit the
whole thing is built on: a **bank** is the set of lights that go on and off
together, and it takes exactly **one switch**. Not one switch per light — four
pot lights over a kitchen counter that come on together are one bank on one
switch. A switch controls a bank; a bank answers to one switch; the light
belongs to a bank. Nothing else.

The bank is a way of reading the model, not a record in it — see below.

No three-way switching yet — Movie's instruction. So "one switch" is literally
one, and the second switch at the far door is a later board, not an exception
to build room for now.

**Switches gang at the entry.** Movie's ruling: the switches sit beside the
door you come in by, and everything in the room switches from there. Two words
that are easy to run together, so keep them apart: a **bank** is lights, a
**gang** is switches — the gang at the door holds one switch per bank. So a switch is not
placed device by device — the room gets *one gang at its entry*, and the gang
count is **the number of light banks in the room**, one `$` each. `$`, `$$`,
`$$$` on the sheet is that count, drawn — which means the count is derived and
nobody maintains it: add a bank and the gang grows on its own.

**A light joins the bank it is entered from.** Movie's ruling, and the one
that makes the switch legs derivable rather than drawn:

> Pick the switch by **direction** — the bank on the side the light is
> approached from — not the switch that happens to be nearest in a straight
> line.

That matters because nearest-by-distance gets it wrong exactly where it is most
visible: a light near a party wall is often closest to the *next room's* bank.
Direction from the entry is what a drafter is actually doing, so it is what the
app should propose. The drafter overrides; the app is never the authority.

**Measured off sheet 14** — 8,076 red strokes, blobbed into symbols, scaled at
the sheet's 3/32" = 1'-0":

| What | Measured | Reading |
| --- | --- | --- |
| Outlet to the wall line | median 0.29 ft, 90th 0.31 ft | Outlets sit **on the wall face**, not offset into the room. Confirms wall-hosting. |
| Outlet to next outlet | clusters at ~1 ft, then a spread over 4–8 ft | The 1 ft pairs are ganged or split devices; the real spacing along a wall is the 4–8 ft band. |
| Light to next light | 4–7 ft typical (median 6.6 main, 5.0 second, 5.9 basement) | Multi-fixture rooms space at roughly **5 to 7 feet**. |

Three cautions on those numbers, so nobody quotes them as law:

- The symbol classifier is size-based and imperfect — 37 circles and 77 outlets
  were classified confidently out of 690 blobs, so these are a **sample**, not
  a census of the sheet.
- "Distance to nearest wall" measures the nearest *blue line*, which includes
  cabinets and fixtures, not only walls. The outlet number survives that
  (outlets sit on walls either way); a light-to-wall setback does not, so no
  setback rule is proposed here.
- Nothing above establishes a **pot light grid**. The 5–7 ft band is consistent
  with one, but spacing alone cannot tell a grid from a row, and the rule Movie
  would want — how a grid is fitted to a room, and how close to the walls it
  starts — is not derivable from this sheet without his say-so. Left open.

### The curve is the drawing

The dashes are what make sheet 14 an electrical plan rather than a scatter of
dots — they are the only thing on it that says *which switch runs which
lights*. So:

> **A fixture stores what switches it. The painter draws the curve from that,
> and the bank is what you get by grouping fixtures on that switch.**

Never the other way round. If the drafter routes curves by hand, the drawing
can say a switch controls a light when the model disagrees, and nobody will
ever find out. Stored relationship, derived line.

The bank is **derived, never stored** — Gilligan's call, 1 Sep. The reason is
**orphaning**, and it is worth stating exactly, because the wrong reason would
mislead whoever revisits this: a stored bank can outlive its lights. Delete the
last light in a bank and a record sits there attached to a switch and holding
nothing, waiting for someone to sweep it. That is precisely the failure the
leg rule already forbids — *a leg is never left pointing at nothing* — and a
bank record, being a thing in its own right, inherits it. Group the lights on
their switch instead and the last deletion makes the bank stop existing,
because it was never a thing to begin with.

(Not drift. `light.bankId` + `bank.switchId` duplicates no fact and could not
fall out of sync; an earlier draft of this spec said otherwise and was wrong.)

With the bank grouped, one switch per bank is true by definition and the gang
count is the distinct switches in the room, counted.

**Revisit when three-ways arrive.** That is the trigger, and it is stated so it
is a condition rather than folklore: a light answering to more than one switch
stops `switchId` being a single value, and the bank becomes a real entity —
cheap at that point, because the grouping already names the seam.

One honest note on where this came from. I tried to recover the pairings by
tracing the dashes out of the PDF — chain the segments end to end, then match
each chain's two ends to a switch and a fixture. It did not work: 4,538 dash
candidates chained into 140 runs, several of them spanning most of a plan,
because proximity-and-collinearity merges unrelated dashes wherever two legs
cross. **No switch-to-fixture pairing in this spec was read off the geometry.**
The pairing rule above is Movie's own account of what he does, which is the
better source anyway — the drawing is the output of the rule, not the rule.

### What the sheet lets you touch

Movie's ruling, 1 Sep: on the electric plan the drafter can **move a symbol,
delete one, or add one. Nothing else — and only electric things.**

The consequences, all load-bearing:

**No line drawing on the sheet.** There is no tool for it. That is what keeps
the rule above from being a wish: if a leg cannot be drawn by hand, the only
way to change what a switch runs is to move or delete a device, so the drawing
cannot disagree with the model.

**Three verbs and no fourth.** Gilligan raised whether editing a property of a
selected device belonged on the list, because the floor/ceiling outlet was
briefly one device with a switchable surface. Movie's later ruling — two
separate devices, no conversion — removes the case that asked for it, so the
list stays closed at move, delete, add. Nothing on the electric sheet edits a
property in place.

**A symbol we did not anticipate is made in the Boneyard, not drawn on the
plan.** Movie's ruling, 1 Sep, and it is what makes the restriction survivable:
the drafter is never stuck, he just makes a custom electric object and places
it. So the escape hatch produces a *device* — hosted, movable with its wall,
checkable, exportable — where freehand linework would produce the one electric
thing on the sheet that nothing can reason about.

**The leg is attached at both ends.** Drag a light and its curve follows it;
delete a switch and its legs go with it. A leg is never left pointing at
nothing, because it is not a thing in its own right — it is the picture of a
relationship, redrawn from the two devices it joins.

**Everything not electric is locked.** Walls, doors, fixtures, dimensions and
room tags are the background you draw on: visible, not selectable. A drafter
cannot nudge a wall while placing outlets along it.

Which is the toy's philosophy arriving in the professional mode, and worth
naming as such: what is restricted is not the drafter's judgement about the
electric plan, only his ability to damage the building while he is thinking
about lights.

**Adding magnets to the preferred positions.** Movie's ruling: a device being
added snaps to where the rules would have put it — room centre for a light,
the entry-side bank for a switch, the outlet stations along a wall. Which is
the same rule table read a third way. Generate asks *what goes here*, the
magnet asks *where would it have gone*, and a later check asks *what is
missing* — three questions, one answer, so a plan the drafter adds to cannot
drift from a plan the build wrote. It should use the drafter's existing snap
zone (`profile-manager.js` 223), not a private radius of its own.

**Switches and outlets stick to walls.** Movie's ruling, and already true by
construction: a wall-hosted device is an offset along a wall, so there is no
way to store one floating in a room. Dragging one slides it along its host and
hops it to a nearer wall; it never leaves the walls. So the two hosts drag
differently, and should — **wall devices slide, ceiling devices float.**

The floor outlet and the ceiling outlet are the deliberate exceptions: outlets
that float, because being off the wall is what they are for.

### Hosting

Two hosts, and every device has exactly one:

- **Ceiling-hosted** — pot lights, fans, chandeliers, detectors. A point on a
  level, inside a room.
- **Wall-hosted** — outlets, switches, vanity lights. An offset along a wall,
  a side, and a height.

Wall-hosted devices should be stored the way fixtures already are
(`drawing-format.js` 142–183): `wallId`, `offset` along the wall from its
start, `side`, and **no stored geometry** — the position redraws from the
current wall, so a device rides a wall edit instead of being orphaned by it.
That is an existing, working pattern in this repo. Use it rather than
inventing a second one.

Ceiling-hosted devices have no such precedent and need a decision: a point on
the level, or a point relative to the room that holds it. Prefer the room if
TOY MODE is ever to place them, because a room can be asked how big it is and
a bare coordinate cannot.

### Layers

`E-POWER` exists and is pinned by `tests/layer-standards.spec.js`. It is also
one of only three layer names that survive a reload — see the whitelist
hazard below.

**Life safety gets its own layer, and it is `E-SAFETY`.** Movie's ruling, 1
Sep: smoke and CO detectors must be a layer that is always on, so a drafter
turning electric off to work on something else cannot make them vanish. There
is no such name in the tested vocabulary yet; the board adds one. The name
matches the `A-` / `S-` / `E-` prefixes the standards table already uses, and
it is cheap to change right up until a saved drawing contains one. This also
buys a life-safety only print for the inspector, later, for free.

---

## CANDIDATE CODE — uncited, do not enforce yet

These are the things on an electrical plan that a building official actually
looks for. Each needs a citation before it becomes a rule, and each is written
here so the citing is a research job rather than a memory test.

- Smoke alarms: required rooms, required storeys, interconnection,
  power source.
- Combination CO alarms: which rooms, and their relationship to fuel-burning
  appliances and attached garages.
- Receptacle spacing along a wall, and the wall width at which one is
  required at all.
- Kitchen counter receptacles, and split or GFCI requirements at counters.
- GFCI/AFCI protection at bathrooms, exteriors, garages and unfinished
  basements.
- Required lighting at stairs, exits and service rooms, and switching at both
  ends of a stair.
- Bathroom exhaust fan requirement and its venting.
- Dedicated circuits: range, dryer.

**Two of these are worth more than the rest** because they are the ones a
machine can check honestly and a human forgets: smoke/CO placement, and
receptacle spacing. If only two rules ever get cited, cite those.

---

## RUFFDRAFTER — practice, not law

- Ceiling fans are optional. Movie does not always draw them. Nothing should
  place one uninvited.
- A chandelier, a shower light and a vanity light are the same entity wearing
  different names. The name is the label, not a type.
- Gang the switches at the door you actually walk in through.

---

## The hazard this board inherits

`MODEL.dc.html` 4930–4938 restores a line's layer through a hand-kept
whitelist. `no-draft`, `S-FOOTING` and `E-POWER` survive a reload; **every
other layer name silently becomes `draft`.**

So the new life-safety layer will serialise correctly, look right in the saved
file, and be flattened the next time the drawing opens — with nothing logged
and nothing failing. The sheet is right until reload and wrong after it, which
is the worst shape of bug there is.

**Fix the whitelist before adding the layer**, so a layer name is a table
entry checked against the tested vocabulary rather than a fourth branch
somebody forgets. That fix is already board A's first step; this board must
not race it.

---

## The answered question

**Generate.** Movie's ruling, 1 Sep: *"place everything auto on house build as
best as you can, we will refine."* The build lays in the whole electric plan
and the drafter corrects it; he never starts from an empty sheet.

Checking is not dropped, only deferred — it is the same rule table read the
other way, asking "what is missing?" instead of "what goes here?". Which is
why the rules must live in a pure module rather than inside the generator: written
into the generator, the check gets written a second time and the two drift.

The cost of generating is one thing, and it is the thing to get right: a
rebuild must not wipe the drafter's corrections. The repo already solved this
for the bone's windows with an `auto` flag (`drawing-format.js` 138), and
electric devices should copy it.

Three smaller ones still open, all Movie's:

1. **The pot light grid.** Sheet 14 spaces multi-fixture rooms at 5–7 ft, but
   how a grid is fitted to a room — how many rows, and how far it starts off
   the walls — is his rule, not something the sheet gives up.
2. **Does centring apply to anything but the light?** The ruling was for the
   bedroom *light*. Whether a fan, or a single basement fixture, centres the
   same way is unstated, and the safe reading is that it is not.
3. **Is a bathroom exhaust fan its own device?** No distinct symbol for one was
   found on sheet 14, so either it shares the ceiling-fan symbol or it needs a
   new one.

---

## What is deliberately not here

- Circuits, panels, breaker schedules, load calculations. A switch leg is not
  a circuit, and sheet 14 does not draw one.
- The electric pairing rule for sheet layout ("two floor plans per page unless
  big house"). Unbuildable until devices exist; deliberately absent rather
  than stubbed.
- A legend block. Sheet 14 has none, the symbols are unambiguous, and adding
  one is a later, separate, easy job.
