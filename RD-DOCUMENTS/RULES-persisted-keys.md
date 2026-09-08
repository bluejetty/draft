# PERSISTED KEYS — WHAT THE NAMES MEAN

Deep-clean item 6 asked for a spec pinning the saved format's key names.
`tests/persisted-format.spec.js` is that spec: it pins the complete top-level
key set, the keys other pages read, and the layout round trip, mechanically.
This file is the half a test cannot carry — what the contested names MEAN,
which distinctions must never be collapsed, and the rules a page must satisfy
before it may write. **Tier 3 of any replacement page (writing to the shared
bucket) does not begin until its author has read this file and
`persisted-format.spec.js` is green against their page.**

The truth about what is written lives in `_serializeDrawing()`
(`MODEL.dc.html`); the truth about what is read lives in `drawing-format.js`
plus the pages' own loaders. Where this file and the code disagree, measure
the code, then fix whichever is wrong ON PURPOSE.

## The standing rules

1. **Persisted names never change.** `boneyardOutlines` and `boneyardShelves`
   are persisted keys even though the page's memory calls the first
   `_boneyardOutlines`; a rename stops at the serializer. Old drawings open
   forever, so a persisted rename is a broken drawing, not a cleanup.
2. **A new page must not write until compatibility is proven** — clause 4 of
   "better": the OLD page opens a drawing written by the new page without
   loss, demonstrated by spec, not by argument.
3. **Every shared-bucket write carries optimistic concurrency:**
   `store.saveSharedFile(file, bucket, { ifRev: at.rev })`. A page that
   writes without `ifRev` can eat another page's work (audit C3).
4. **Readers normalise, writers don't invent.** Unknown enum values fall to a
   documented default at read (e.g. legacy `wallType` names map through
   `LEGACY_WALL_TYPES`, unknowns to `stud_2x6`); a writer never emits a value
   outside the format. A viewport whose reference is invalid (a `levelId`
   that no longer exists, an `elevId` outside E1–E4) is DROPPED at read,
   never silently converted to another kind.

## The contested names, ruled

### `view` is layer-set membership, not a camera

`view` on a wall, line or floor names which screen the item belongs to —
`plan`, `foundation`, `e-power`, and kin. The word was a bad borrow from the
UI. **Qualify the word in prose (call it the layer view); never migrate the
field.** If a real camera concept ever lands, it gets its own name.

### `drawingOrigin`: absent and null are different drawings

A drawing saved before the origin board has NO `drawingOrigin` key: it was
drawn on the world grid, and read-time back-fills `{x:0, z:0}` so every
coordinate stays put. A blank drawing stores the key **explicitly null**: the
drafter has no datum yet, and NEW must get back to that state rather than
silently adopting 0,0. The loader (`'drawingOrigin' in saved` at
`MODEL.dc.html`) is the enforcement. **Never normalise the two states into
one.** If they are ever reconciled, it is a one-time, versioned migration
that writes `{0,0}` into old drawings deliberately — not a reader shortcut.
(`siteRegistration` is the counter-example: absent and null agree there,
because no older meaning exists to preserve.)

### `body` is an open set, never a two-value enum

`body` arrived with the gap trick: garage walls are their own body,
coincident with the house's and **never spliced across the boundary** — that
invariant is the reason the field exists. More bodies are already on the
board (detached garage, split-level zone, additions). Today the serializer
only preserves `'garage'` (absent means the house), but no reader or tool may
be built on the assumption that two values is all there will be: treat an
unrecognised body as opaque and keep its walls unspliced.

### Two `auto`s, two contracts — do not unify

- **Per-item `auto`** (walls, dims, beams, cuts…) is provenance: the bone
  generated this item, and a re-derive may replace it. The drafter touching
  the item takes ownership. If it is ever renamed, the honest name is
  `generated`.
- **`layout.auto`** is whole-hand ownership of the SHEETS: BUILD HOUSE raises
  it, LAYOUT deals the default set only while it is true, any manual sheet
  edit clears it, and a hand-arranged drawing loads exactly as saved. The
  contract is pinned across TWO spec files — `tests/layout-compose.spec.js`
  (raise / clear / load-as-saved) and `tests/defaults.spec.js` (the E1+E2 /
  E3+E4 grouping) — either alone is three quarters of it.

They are the closest sense-collision in the format's dictionary: same word,
different owner, different scope. Document them separately, forever.

### Cross-page keys are pass-through, not property

`layout` is written by LAYOUT, `specs` by SPECS; MODEL carries both untouched
so a save from MODEL cannot drop them (`_serializeDrawing()` spreads
`this._layoutData` / `this._specsData` back verbatim). `projectInfo` and
`zoneHeights` are shared with PROJECT through the format's readers. A page
writes ONLY its own keys and round-trips the rest — LAYOUT's `_layoutKey()`
comment ("the ONLY key this page may write") is the pattern.

### `layout`'s own vocabulary

`paperKey` (`11x17` | `8.5x11`), `orientation`, `titleblock` (exactly
`roughdrafter`, `roughdrafter-band`, `bluejetty`, `bluejetty-band` — these
identifiers are persisted style keys and never renamed), `northArrow`,
`auto`, `nextViewportId`, and `viewports` — each viewport a `plan`
(`levelId` + layer view), `section` (`cutId`) or `elevation` (`elevId`
E1–E4) with its own `pif` scale and `sheet` integer. Paper and scale rules
live in `paper-rules.md`.

### `buildType`

The build row's lit lamp (NEW-5): exactly `bungalow`, `twoStorey`, `bilevel`
or `modifiedBilevel`, and these identifiers never change. Missing, null, or
anything else reads as "not chosen" -- every drawing older than the key has
no build type, and the reader must not guess one from the geometry. The
writer only ever emits a listed value or null. The type is a label, not a
geometry: BUILD HOUSE pours the outline as drawn whichever lamp is lit, and
the PROJECT page reads it through `sectionRowForBuildType` (a bungalow or
two-storey is the live HOUSE row; a bilevel or modified bilevel is its own
stored row).

### `units`, and null-means-derive

`units` reads as metric only when it says `'metric'`; anything else —
including the missing key on every drawing older than the field — is
imperial, because every drawing before the field existed was imperial.
Loading NEVER re-snaps geometry in either system; only the drafter's own
toggle press may (board #313 as amended — software-initiated movement on
load, import, or re-derive is forbidden).

Elsewhere, null is a meaning, not a missing number: `plateHeightFt` null is
"unset, derive it", `detachedGarage.offsetFt` null is "derive", an outline's
`offX`/`offZ` null is "not stored" while `0` is "explicitly on the master".
`format.number(...)`-style readers preserve these; a normaliser that turns
null into 0 has changed the drawing.

### `autoDimFirstOffsetFt` — a drafter's press that no drawing records

**NOT a persisted key today, and that is the entry.** The drafter sets it,
two things on the drawing move, the file is saved, and both move back. It is
listed here rather than among the ruled names because a key that SHOULD exist
is invisible to a spec pinning the keys that do: `persisted-format.spec.js`
enumerates what is written, and a value written nowhere cannot fail it.

Where it lives now, measured 6 Sep:

    MODEL.dc.html:2685    autoDimFirstOffsetFt: 1.5    component state, not the file
    MODEL.dc.html:21490   onSelect -> setState(...)     the drafter's press
    MODEL.dc.html:17705   firstOffset: <it>             the auto dimension strings
    MODEL.dc.html:8611    _cutMarkGapFt()               HALF of it -- the E1-E4 cut marks
    MODEL.html:982        "autoDimFirstOffsetFt  nowhere"

TWO CONSUMERS, NOT ONE. The name says dimensions and the second reader is the
cut marks, at half the value: the bubbles sit in the middle of the gap between
the walls and the first string. So a drafter who moves the strings also moves
every cut mark, and neither survives the save. The name is why this went
unnoticed -- someone auditing "what does the dimension offset affect" reads the
name, greps `firstOffset`, and never reaches `_cutMarkGapFt`.

THIS IS BOARD #313 FROM THE OTHER SIDE. That rule forbids software moving
geometry without a press. Here a press moves geometry and the move is then
lost, silently, at the next load -- the same invariant failing in the other
direction. Both reduce to: the file decides where things sit, so anything that
moves them belongs in the file.

RULED YES, 6 Sep, Commander Devin, as proposed: the key is added, Skipper
implements, BEFORE Tier 3's first slice. The timing is the ruling's teeth --
it is a top-level key on shared ground, so it is a format change under
standing rules 1 and 2 (the name is permanent once written; the old page must
open a new page's drawing without loss, by spec). Added before the new page
writes, that costs one name. Added during Tier 3, the deep-compare in slice 1
is chasing a target that moves under it.

WHEN IT LANDS, THIS SECTION MOVES UP into the ruled names above and loses the
"not a persisted key" framing -- and its second consumer travels with it. A
future reader auditing "what does the dimension offset affect" must still
reach `_cutMarkGapFt`, which the name will never tell them.

---

## `levelLocks` / `nextLevelLockId` — the second tier of grouping (board #315)

Added 8 Sep. A LEVEL LOCK joins ASSEMBLIES on different floors that must
hold the same PLAN position. The three tiers:

    items      -> an ASSEMBLY  (one floor, rigid: `groups`)
    assemblies -> a LEVEL LOCK (across floors: `levelLocks`)

`levelLocks` is a list of `{ id, name, members }`, where members are GROUP
ids — never item ids. A lock never reaches past the assembly to the walls
inside it; moving a member is the assembly's own rigid move, applied to each
sibling. One tier per question.

**A LOCK OF ONE IS NOT A LOCK.** Two members are the fewest that can
disagree, so `drawing-format.js`'s validator drops a shorter one on load and
`level-lock.js` refuses to create one. A lock that can never do anything
reads — in the file and on screen — exactly like a lock that works.

**MEMBERS ARE VALIDATED AGAINST THE GROUPS THAT SURVIVED THE LOAD**, which
is why the locks are read AFTER the groups. A lock naming a group the loader
threw away would otherwise point at nothing and stop locking silently.

**BREAKING A LOCK REMOVES IT.** There is no persisted "broken" state: a
broken lock and no lock behave identically, and one of them is a state to
carry, migrate and get wrong later. Breaking is an explicit act — a drag
never breaks a lock and neither does distance.

Its first customer is the dealt washroom, whose 2x6 wet wall carries every
supply in the room: stack that wall floor to floor and the drain runs
straight down. Nothing in the schema knows what a washroom is.

### `groups[].washroomLevelId` and `groups[].dealt`

Also board #315, on the existing `groups` entries. `washroomLevelId` names
the floor a dealt washroom belongs to, so a re-press can tell a floor that
HAS one from a floor that is merely silent. `dealt: true` marks a unit the
BONE placed rather than the drafter — the same meaning `auto` carries on a
room tag, and deliberately NOT the `auto` flag on walls, which means "the
build owns this and sweeps it before regenerating" and would delete the
washroom on the next press.

## `roomTags[].minDimensionFt` / `roomTags[].roomCategory` — the facts behind UNDER MIN

A room tag carries a verdict, `underMin`. A verdict is a FINDING, and a finding
in a file goes stale the moment the standard behind it moves. Its inputs are
three: the room's area, its short side, and the office minimums table. Only the
area was ever stored.

So: tighten the minimums in STANDARDS, reopen any drawing, and every UNDER MIN
flag — the ones showing AND the ones hidden — is whatever it was at the last
grow. `evaluateRoom` had exactly one caller on the page and it was the ROOM
TAGS button; nothing re-evaluated on load.

These two keys are the missing facts.

- **`minDimensionFt`** — the room's short side in feet, as measured at the last
  grow. `room-grow.js` has always computed it (`:422`) and emitted it (`:432`);
  the BUILD HOUSE copy-back used to drop it on the floor.
- **`roomCategory`** — the category the room was graded under, lowercased to
  match the table's own ids (`bedroom`, `kitchen`, `living`, `wc`, `laundry`,
  `dz`).

### Why the category has to be stored and cannot be read off the name

A stamp loses its `base` the moment the drafter touches or renames it
(`MODEL.dc.html:20420`, `:20521` — *"renamed — it left the numbering pool,
custom forever"*). From then on the tag-time code falls back to the DETECTOR's
live category, which no file has ever stored. A renamed BEDROOM reads only as
its new name, so grading off the name would grade it wrong on exactly the tags
a drafter has handled most.

### ABSENT IS NOT ZERO

Absence means *"this verdict was valid as of the last grow"*, and such a tag is
left exactly as stored — no re-grade, no touch-on-load write, no migration.
Re-grading a legacy tag with `minDimensionFt` reading 0 would flag every room
in every drawing saved before these keys existed: a false accusation on a file
nobody changed. Old drawings keep their stored answer until the next grow
writes the facts down.

### Where the re-grade runs

Not only on load. STANDARDS is a separate page, so the minimums can change
while a drawing sits open — the drafter edits them in another tab and tabs
back. `_regradeRoomTags()` therefore runs at every point the minimums arrive:
the drawing load, the `visibilitychange` re-read, and both profile-package
apply sites. It returns how many verdicts actually changed, so a re-grade that
did something can be told from one that did not.
