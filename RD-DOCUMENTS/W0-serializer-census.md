# W0 — the serializer census

Ordered by Commander Devin, 6 Sep, as the groundwork for W1: before a shared
serializer can be extracted from `MODEL.dc.html`, somebody has to say exactly
what the existing one touches. This is that list.

Read-and-tally only. Nothing here moved a line of code. Every count below came
from `proto/w0-census.js`, committed alongside this file so the next hand can
**re-run** the census rather than trust it — which matters, because a census
that has gone stale looks exactly like a census that is right.

    node proto/w0-census.js          the summary counts quoted here
    node proto/w0-census.js --json   the full index, for diffing two revisions

That tool is not a harness and its name says so: CI globs
`proto/*-harness.js` (`.github/workflows/test.yml:112`), so the hyphenated
suffix is the membership test and this file sits outside the loop by
construction. The harness count is unchanged. It asserts nothing and exits 0
whatever it finds — a census reports, a harness judges.

First measured against `main` at `c341798`, with #326 (the foundation ruling)
and #327 (the PRE-TIER3 gate note) still in flight. Both have since landed, and
the census was re-run at `3a7be51`: **every count above is unchanged**. That is
the tool paying for itself on its first day — the claim that neither PR touched
the serializer is now a measurement rather than an expectation.

---

## THE SHAPE

    _serializeDrawing  MODEL.dc.html:3134-3456  13601 chars

**323 lines**, brace-matched by a scanner that skips strings, template
literals, comments and regex literals. The care is not decorative: this
serializer builds objects inside template strings, and a naive depth count
would let a `}` in one of them close the function early — silently shortening
every count below and leaving a census that looks complete.

Following every `this.<name>(` call transitively gives a closure of
**21 methods**. Twenty of them are between 1 and 11 lines:

| method | lines | length |
|---|---|---|
| `_serializeDrawing` | 3134 | 323L |
| `_ensureDrawingCollections` | 3084 | 33L |
| `_stairEndFor` | 18778 | 11L |
| `_stairLevels` | 18461 | 8L |
| `_activeLayerViewId` | 8582 | 8L |
| `_pointForStorage` | 3124 | 9L |
| `_activeLineLayer` | 8960 | 6L |
| `_floorLevels` | 8575 | 6L |
| `_levelWallTopFt` | 21449 | 6L |
| `_contextLineLayer` | 8810 | 4L |
| `_layerStandard` | 8815 | 4L |
| `_levelFloorFt` | 21471 | 4L |
| `_activeLevelId` | 8564 | 4L |
| `_roofHeelIn` | 15728 | 3L |
| `_stairCurrentLayout` | 18481 | 3L |
| `_stairShapeSplit` | 18486 | 3L |
| `_lineLayerConfig` | 8804 | 3L |
| `_levelAssembly` | 21468 | 3L |
| `_layerViewsForLevel` | 8569 | 3L |
| `_activeLevel` | 8558 | 1L |
| `_boneyardLevelId` | 8562 | 1L |

So the extractable surface is one large function plus **123 lines** of small
accessors across twenty methods. That is better news than it looks: the accessors are where the
component coupling hides, and they are small enough to read in full.

**Zero non-arrow `function` declarations across all 21 bodies.** Every `this`
in the closure is the component; there is no nested rebinding to trace.

The walk also reads each method's **signature**, not just its braces.
`_roofHeelIn` and `_stairEndFor` both read `this.state` in default-parameter
expressions, outside the body — counting braces alone would have missed them.

---

## THE REFERENCES

**60 distinct `this.<ident>`** across the closure — 39 fields, 20 methods
(the root is never referenced by name), plus `state`. Every call resolved to a
class method; nothing in the closure calls through a field.

**Zero bare `this.state`** — no spread, no destructure, no dynamic index. Every persisted key is named
explicitly at its use site. This is the single fact that makes an exact census
possible at all, and W1 should treat it as a property worth keeping: the moment
the serializer spreads `this.state`, nobody can enumerate the format again
without running it.

### State keys

**39 reachable.** 36 read directly by `_serializeDrawing`; 3 reached only
through the accessors — `activeLineLayer`, `boneyardActive`, `layerStandards`.
The last two are Finding B.

### Output surface

**67 literal top-level keys, plus 2 conditional** — `layout` and `specs`, both
emitted by spread and both absent when the page holds no such payload:

    ...(this._layoutData ? { layout: this._layoutData } : {}),   MODEL.dc.html:3433
    ...(this._specsData  ? { specs:  this._specsData  } : {}),   MODEL.dc.html:3436

The output shape is therefore **not fixed**. A deep-compare acceptance for the
Write Tier has to expect two keys that legitimately appear and vanish.

And the same hazard exists one level down, which the first pass of this census
missed. **Fifteen per-entity conditional spreads** write optional keys inside
the mapped objects — 14 distinct names:

    auto  base  claimedNo  closetDeclined  companionOf  dir  endWallId
    padIn  pullLevelId  pullSrcId  splitTreads  stairId  standoff  switchId

A wall with `auto` unset and a wall with `auto: false` are different objects in
the file. Any comparison that walks entities key-by-key has to treat an absent
optional and a falsy one as the same thing, or it will report differences that
are not there.

One of the fifteen is not optional at all and is worth separating.
`MODEL.dc.html:3221` **branches on shape**: a wall-hosted electric device
writes `wallId`/`offset`/`side`, a point-hosted one writes `at: {x,y,z}`. Both
alternates are non-empty, so nothing is ever absent — what changes is which
shape arrived. Presence is the wrong question to ask of that key, and a
comparison built only around optionality will ask it anyway.

(Counting these took three tries. A regex gave 13, then 7, then 20, because six
of the spreads wrap onto a second line and `[...(outline.overriddenSrcIds ||
[])]` is an array spread that looks like a conditional from the outside. The
committed tool scans to the matching paren instead, which is the only reading
that does not depend on how the source happens to be wrapped. The three wrong
counts are recorded here because a number that changes when you look again is
the one thing a census must not quietly settle.)

The 67 literal keys were diffed against `PERSISTED_KEYS` in
`tests/persisted-format.spec.js`:

    spec PERSISTED_KEYS: 67   dupes: 0
    serializer literal keys: 67
    in serializer, NOT in spec: (none)
    in spec, NOT in serializer literal: (none)

**65 UNTIL 11 SEP, and the two additions are `levelLocks` and `nextLevelLockId`
— level locks.** Serializer and spec still agree exactly: nothing
written-but-undeclared, nothing declared-but-unwritten. This was documentation
drift, not a persistence hole, and it is corrected here from a re-run of
`node proto/w0-census.js` on the merged tree rather than by editing the prose to
taste. A census nobody re-ran is the failure this document exists to remove.

**Exact match, no drift.** That list is currently honest.

---

## THE CLASSIFICATION

Devin asked for three buckets. The classifier walks each method's transitive
state-and-field closure and asks whether anything in it fails to travel with
the drawing.

### pure — 12

`_pointForStorage`, `_roofHeelIn`, `_stairCurrentLayout`, `_stairEndFor`,
`_stairLevels`, `_stairShapeSplit`, `_floorLevels`, `_levelAssembly`,
`_levelFloorFt`, `_levelWallTopFt`, `_activeLevel`, `_boneyardLevelId`

Everything they reach is persisted state or their own arguments. These move to
a shared module unchanged. `_levelAssembly` is here on purpose — the role-aware
reader added on 6 Sep asks `level-assembly.js` and holds nothing itself.

### reachable persisted state — 19 collections + 8 counters + 2 passthroughs

Nineteen collections the serializer reads and `_ensureDrawingCollections`
initialises (`_lines`, `_walls`, `_floors`, `_shapes`, `_roofs`,
`_fenestrations`, `_electricDevices`, `_fixtures`, `_surfaceOpenings`,
`_dimensions`, `_columns`, `_beams`, `_stairs`, `_notes`, `_roomTags`,
`_outlines`, `_boneyardOutlines`, `_groups`, `_underlays`), eight
`_next*Id` counters the serializer reads and ensure does not touch, and the two
passthrough holders `_layoutData` and `_specsData`.

### component-only — 1 method, 10 fields

`_ensureDrawingCollections` is the only member of this bucket, and it is the
census's first real finding.

---

## FINDING A — the ensure call is the widener

`_serializeDrawing`'s first statement is `this._ensureDrawingCollections()`.
That method touches **ten fields the serializer never reads**:

    _courtesyFloorIds        _selectedFenestrations   _underlayImages
    _courtesyWallIds         _selectedFixtures        _vertices
    _selectedDimensions      _selectedOutlines
    _selectedRoofs           _selectedSurfaceOpenings

Selection sets, courtesy id sets, decoded underlay image data, and the vertex
cache. None of it is persisted; all of it is dragged into the closure purely
because the serializer opens by calling the initialiser.

For W1 this is the thing to split, not port. A shared serializer that inherits
`_ensureDrawingCollections` as written takes a dependency on the host page's
**selection state and image blobs** — which is how a module that was supposed
to know only about the saved format ends up unable to run outside the page it
came from. The initialisation the serializer actually needs is the nineteen
collections; the other ten belong to whoever owns the canvas.

---

## FINDING B — a persisted key computed from unpersisted state

This is the one that will bite the deep-compare acceptance.

`activeLineLayer` is a top-level persisted key. It is not read from
`this.state.activeLineLayer` and written out. It is computed:

    activeLineLayer: this._activeLineLayer()

and that call reaches, transitively:

    _activeLineLayer
      → _contextLineLayer → _activeLayerViewId → _activeLevelId
                                                   → state.boneyardActive     NOT PERSISTED
      → _lineLayerConfig  → _layerStandard      → state.layerStandards        NOT PERSISTED

Two branches make it consequential rather than academic:

1. `_activeLevelId()` returns a **negative pseudo level id** when
   `boneyardActive` is true, which changes `_activeLayerViewId()`, which is what
   decides whether a `draft` line is rewritten to `E-POWER`.
2. `_activeLineLayer()` checks whether the requested layer is *visible* under
   the office standard and, if not, **writes a different layer than the one the
   drafter chose**.

So the same drawing, saved twice by the same code, writes a different
`activeLineLayer` depending on whether the boneyard happened to be open and
what `layerStandards` says — neither of which is in the file.

**What this means for the Write Tier.** Devin's acceptance is a deep compare:
old page saves, new page saves the same drawing, every key must match. This key
can differ with neither page being wrong. The comparison has to pin
`boneyardActive` and `layerStandards` on both sides, or it will spend a day
chasing a difference that is not a bug. And a shared serializer handed only the
persisted drawing **cannot produce this key at all** — it needs those two
values passed in, or the computed layer passed in already resolved.

That is a design question for W1, not something to settle here. It is written
down so it is settled deliberately rather than discovered.

---

## FINDING C — `specs` is `layout`'s unguarded twin

`tests/persisted-format.spec.js` opens by naming the layout passthrough as
the failure that "can cost a drafter real work": delete it and MODEL still
passes every test it has, while silently deleting the drafter's entire sheet
set on the next save. It then guards it properly, with a dedicated round-trip
test that injects a `layout` key and asserts it survives a MODEL save.

`specs` has the identical three-site shape:

    MODEL.dc.html:5402   this._specsData = saved.specs ? format.specs(saved.specs) : null;
    MODEL.dc.html:6135   if (stored && typeof stored.specs === 'object') this._specsData = stored.specs;
    MODEL.dc.html:3436   ...(this._specsData ? { specs: this._specsData } : {}),

and no guard anywhere:

    grep -n "layout\|specs" tests/persisted-format.spec.js
    → 14 hits, all `layout`. Zero for `specs`.

It is invisible to the spec in both directions. There is no presence assertion,
and the added-key check at line 101 excludes only `layout`
(`k !== 'layout'`) — so `specs` stays green solely because that test's flow
never loads SPECS data and the key is never emitted. Populate it and the same
spec goes red for the wrong reason.

Deleting the `specs` line would drop the drafter's spec sheet on the next
MODEL save, and nothing in the repo would go red. That is the exact contract
the spec file was written to name, applied to the key it did not cover.

---

## WHAT W1 INHERITS

- One 323-line function and ~115 lines of accessors, of which **12 methods move
  unchanged**.
- A format whose keys are all named explicitly — **no `this.state` spread** —
  so the census can be re-run rather than re-derived.
- **67 fixed keys plus 2 conditional ones**, and **15 per-entity conditional
  spreads** below them, one of which branches on shape rather than presence;
  the output shape is not constant at either level.
- **One initialiser to split**, not port (Finding A).
- **One key that cannot be computed from the drawing alone** (Finding B).
- **One passthrough to guard before anything is moved** (Finding C) — moving
  code past an unguarded passthrough is how it gets dropped.

Order of operations that follows from the above: guard `specs`, then split
`_ensureDrawingCollections`, then decide how `activeLineLayer` is supplied,
then move the twelve pure methods. Nothing before the guard.
