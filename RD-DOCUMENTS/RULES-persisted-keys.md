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
