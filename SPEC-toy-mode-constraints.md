# Spec — TOY MODE: the constraint function

Repo `bluejetty/draft`. Draft 1, 31 Aug 2026. Written by Kevin (Port Admiral)
from Movie's rulings. **This is a specification, not a work order** — no board
number yet, and nobody should implement from it until it has been read back.

---

## What TOY MODE is

A restricted way to manipulate a house that cannot produce an invalid building.
The target user is a beginner or a non-drafter on an iPad. The same document,
opened in DRAFTING MODE on a PC, is unrestricted CAD.

Both modes read and write the same model and the same saved file. TOY MODE is
a *capability layer*, not a second application and not a second file format.

Characters (Gruff and the others) are a separate layer again. Gruff is a
teacher who explains things; he is not a mode. Do not couple them.

---

## The three buttons — TURTLE / DOG / RABBIT

Not three characters. **A ladder of how much the machine does for you**, over
one house model:

| Button | What a press does |
| --- | --- |
| **TURTLE** | You draw it, one wall at a time. |
| **DOG** | It draws one house — the existing auto-house. |
| **RABBIT** | It draws four (or more) plans and you pick one. |

Two of the three are not built yet. TURTLE is specified below; RABBIT and the
real-estate area follow it.

**TURTLE** is a Logo turtle. A turtle appears on screen and draws walls by
walking. Selecting it also switches a PC into the iPad interaction set — big
targets, press and drag, no hover, no keyboard requirement.

The turtle has exactly two verbs:

1. **Turn** — left 90°, right 90°, or straight on. Nothing else.
2. **Go** — a distance, typed in whole feet.

Two verbs is the reason this works. Resist every request to add a third.

Because the turtle can only turn 90°, everything it draws is orthogonal by
construction. That matches the generator, which is also orthogonal, so TOY
output is TOY-editable by definition.

---

## The rounding rule

> **Everything adjustable is to the nearest foot. Everything the material
> dictates keeps its real dimension.**

— Movie, 31 Aug.

This is the spine of the mode. Stated precisely:

- Any quantity the user can *change* — a wall length, a room dimension, how far
  a grip tab moves something — resolves to a whole number of feet.
- Any quantity that comes from the *construction* — wall thickness (a 2×6 wall
  is 5½"), plate height, fascia depth, roof pitch, tread rise — is untouched
  and keeps its true value.

The user types 12. The room is 12'-0" clear. The wall is still 5½" thick, and
the framing lands wherever the framing lands.

### Consequence: the turtle walks a face, not a centreline

This is forced, not chosen. If the turtle walks the wall centreline, the user
types 12 and the finished room measures 11'-6½" — every dimension on the
drawing then contradicts the number they entered, which is precisely the
confusion a toy exists to prevent.

So the turtle walks the **inside face**, and thickness is added outward.

The model already carries this concept: walls have `refLine`, and the repro
file uses `refLine: "right"`. This is a setting to be applied consistently, not
new machinery to be invented.

### Consequence: units are feet, and inches never appear

No fractions in the TOY input path. No inch entry. No dimension string parsing.
If a jog genuinely cannot be expressed, allow half-feet before allowing inches —
and treat needing that as a signal the shape wants DRAFTING MODE.

Note what is *not* affected: doors and windows come in real sizes (2'-8",
3'-0") but they are objects dropped into a wall, not lines the turtle draws.
Stairs are generated. Pitch is a ratio. The whole-foot rule governs the things
the turtle and the grip tabs move, and nothing else.

---

## Existing drawings that are not on the foot

**Open question — Kevin's recommendation, awaiting Movie's ruling.**

Saved drawings predate this rule and are not on whole feet. The repro file has
a wall at `x = -1.386`. When a TOY grip tab touches such a wall there are two
possible behaviours:

1. **Snap to the nearest foot.** Tidy, and afterwards everything obeys the
   rule — but it silently moves a wall the drafter placed deliberately.
2. **Move by whole feet from where it is.** The odd offset persists forever;
   the wall goes 1'-0" from −1.386' to −0.386'.

**Recommend (2): the toy never changes what it did not create.** A beginner
cannot be blamed for a wall shifting 4½" that they never asked to move, and
compatibility with old drawings is a standing constraint on this project.

Whichever is chosen, it must be the same answer everywhere, and it must be
stated in the spec header of the test file.

---

## The seam

One function, and every TOY manipulation goes through it:

```
allowedMove(wall, proposedDelta, context) -> { delta, reason? }
```

It returns the movement that is actually permitted, which may be zero, together
with an optional reason code for anything the UI wants to explain.

It is responsible for:

- Rounding to the whole foot (above).
- Exterior movement limits.
- Interior minimum room sizes.
- Carrying openings with the wall they live in.
- Refusing to move walls attached to unsupported or non-orthogonal geometry.
- Refusing structurally inadvisable moves (see cantilevers).

Everything else — grip tabs, live preview, undo grouping — is presentation
sitting on top of this one function. Get the function right first; it is
testable in node with no browser, which is how it should be written.

---

## Grip tabs

A wall can be manipulated **only** through a grip tab. There is no drafting
tool in TOY MODE.

A grip tab appears only where a move is possible:

- Straight, orthogonal walls get a tab.
- An angled or curved wall gets **no** tab.
- A wall *touching* angled or curved geometry gets **no** tab.

So an old drawing with unusual geometry stays viewable and partly editable, and
the parts the toy cannot reason about are simply inert rather than broken.

Dragging a tab moves a bone through `allowedMove`. Live preview shows the
constrained result, not the finger position — the user should see the rule, not
fight it.

---

## Cantilevers — the worked example of "advise, don't forbid"

Settled values, from Movie:

- **Up to 2'** — a normal cantilever. Allowed silently.
- **2' to 4'6"** — possible, but economically and structurally poor practice.
- **4'6" and beyond** — the right answer is to bump the foundation out and add
  piles as needed, not to cantilever further.

TOY MODE hard-blocks the middle band and steers toward bumping out the
foundation. DRAFTING MODE permits it with advice.

These are sound-practice numbers, not code minimums. If they ever appear in a
permit set they need auditing by someone who knows the local code — the same
provenance problem already flagged against `room-standards.js`.

---

## RABBIT — four plans per press

The market for this is production home builders: they want **one plan they have
costed, offered in several versions** so a street does not look like a
barracks.

**Variation is whatever the restrictions do not pin down.** There is no
"how random" slider. Press it with nothing set and you get four different
houses; set the footprint, the garage side and the budget and you get four
versions of your house. The user controls diversity by controlling constraints,
which is how a real client brief works.

This gives the constraint set a second job. It is not only validation for
grip-tab moves — it is the generator's input. Build it that way from the start
rather than bolting the generator on afterwards.

Choosing one of four means discarding three, and discarding must be
recoverable: a beginner will bin the good one. That is the BONEYARD, which the
saved format already carries.

Open: does a rabbit press cost one bone or four?

## The real-estate / concept-plan area

A separate left-hand area, and a separate job from rabbit. Rabbit varies the
**plan**; this area **dresses the plan the user picked**.

- Document type is the 8.5×11 real-estate/concept sheet already settled in the
  paper rules. Not a new sheet type.
- The user changes the face and the gable ends here.
- Preset **styles** — Colonial, Craftsman, Contemporary, Mediterranean, and
  more — each supplying its own exterior treatments.

### A dressing is real geometry, not a costume

Gables are geometry, so choosing a style changes the house. When the builder
picks a style, the construction set already knows about it; nobody draws it
twice, which is where errors get into permit sets.

It is also cheaper than it sounds, because the machinery exists. Roof edges
already carry `kind: "eave" | "gable"` in `roofIntent`, and the roof is
generated from footprint plus per-edge data, so a style hands the generator a
different pitch, overhang and set of gable ends and it rebuilds.

### Styles change the roof and the face — never the footprint

Movie's ruling. The plan the builder costed survives the dressing. A style that
moved the footprint would silently invalidate the priced plan and force it back
for re-checking.

### Styles must be data, not code

A style is a named bundle: which ends are gables, pitch, overhang, porch,
cladding, trim. Put it in a file a drafter can copy and edit, and the four
shipped styles become examples while users add their own regional ones. Put it
in JavaScript and every new style becomes a board, and the feature quietly
dies.

Same argument as the room minimums in `room-standards.js`.

## A blocked drag stops dead, and the thing that stopped it says why

Movie's ruling, 1 Sep. Never elastic.

Rubber-banding is the one option that is wrong rather than merely weaker: it is
precisely *showing the finger position*, which the rounding section above
forbids. It puts a wall on screen in a position the model has already refused
and holds it there while the finger is down, so a mode whose entire
justification is that it cannot produce an invalid building spends the length
of every blocked drag displaying one. On a touchscreen it reads as *push
harder*, which is fighting the rule rather than seeing it.

Stopping silently fails the other way. On an iPad "nothing happened" reads as
"it didn't take my touch", and the next thing the user does is try again
harder. Silence is indistinguishable from a bug.

So the wall stops at the permitted position — the one `allowedMove` already
returns — and the stop is made legible:

- **The blocker highlights, not the wall under the finger.** This is what
  `blockedBy` is for; in a welded group the wall that stops you is usually not
  the one you grabbed.
- **The line is in the room's words**, built from the reason code plus the room
  and the minimum it hit: "BEDROOM 2 would be under 9'-8"", never `MIN_ROOM`.
  A beginner who reads that has learned the rule, which is the mode's actual
  product.
- **Non-modal, self-clearing, once per rule per drag.** Nothing to dismiss
  mid-drag, and no chattering while you lean on the same wall.
- **Gruff stays out of it.** Characters are a separate layer; this is chrome,
  not a teacher.
- **A `BUMP_FOUNDATION` block steers rather than refuses** — "bump the
  foundation out instead" — because that rule has a recommended alternative
  and a minimum-room block does not.

This needs nothing added to `toy-constraints.js`: `reason`, `blockedBy`,
`underlying`, `roomId` and `band` are already on the verdict, which is the
proof the seam was drawn in the right place.

Left to step 2 to tune by feel: whether the line appears the instant the wall
stops or after a short hold, so a fast drag that grazes a limit doesn't flash
text at someone who never noticed.

## Still open

- Does BONE LOCK default on?
- Is detachment per storey or per wall?
- Do interior walls have bones, or does the user move *rooms* instead?
- What are DOG and RABBIT?
