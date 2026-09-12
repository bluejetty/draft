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

**RE-RUN AT `2da04b5`, 11 SEP: SEVEN OF THE TEN DIMENSIONS HAD MOVED.** The
document was two days stale and looked exactly as trustworthy as it had on the
day it was written — which is the failure it opens by naming, arriving to the
person who named it. Nobody was wrong; nobody re-ran it. Measured, not recalled
— `node proto/w0-census-diff.js` between `3a7be51` and `2da04b5`, the current
tool reading both trees:

    root serializer chars: 13601 -> 14722  CHANGED by 1121

| dimension | before | after | delta |
|---|---|---|---|
| `persistedFields` | 29 | 31 | +`_levelLocks` +`_nextLevelLockId` |
| `literalKeys` | 65 | 67 | +`levelLocks` +`nextLevelLockId` |
| `spreads` | 17 | 21 | +4 per-entity optional |
| `nestedConditionalKeys` | 14 | 18 | +`dealt` +`minDimensionFt` +`roomCategory` +`washroomLevelId` |
| `componentFields` | **10** | **0** | all ten of Finding A's |
| `methods` | 21 | 21 | +`_ensureSerializerCollections` +`_serializerEnv` −`_ensureDrawingCollections` −`_stairShapeSplit` |
| `stateKeys` · `conditionalKeys` · `transitiveOnly` · `unresolved` | | | unchanged |

The `methods` row is the one to look at twice: **21 before and 21 after, with
four changes inside it.** A reader checking the total sees a dimension that
never moved. That is this document's own defect class — a count whose broken
state looks identical to its passing state — and the only reason it is visible
here is that the diff names members rather than counting them.

Everything below is re-derived from that run. Two findings were closed by other
hands, and neither closure was written down here:
`83dba6f` *(W1 step 1)* split the initialiser Finding A named, `01226e3`
*(W1 step 2)* gave the save path an explicit environment, and `16a9b60` guarded
the `specs` passthrough Finding C named. **Finding B is still open**, which is
the one W1 has to decide rather than repair.

**THE EXCEPTION: rung #375 touched `_serializeDrawing`, deliberately.** The gate
duty phrases its answer as *"this rung never touched the old serializer"*, and
for #375 that answer is **no** — correctly. It changed one line,
`wallType: wall.legacyWallType || wall.wallType`, under
`RULING-substitution-is-not-a-save`: a wall whose retired assembly this app
cannot draw is painted as the nearest surviving one and **saved as itself**.
The whole change is +154 chars of serializer text and it moves nothing else —
literal keys, spreads, state keys and persisted fields are all identical across
the merge. So the honest reading is not "the serializer is frozen" but
**"the serializer is touched only with a ruling behind it, and the format did
not move"**, and that distinction is why the diff reports `chars` separately
from every key dimension.

---

## THE SHAPE

    _serializeDrawing  MODEL.dc.html:3248-3588  14722 chars

**341 lines**, brace-matched by a scanner that skips strings, template
literals, comments and regex literals. The care is not decorative: this
serializer builds objects inside template strings, and a naive depth count
would let a `}` in one of them close the function early — silently shortening
every count below and leaving a census that looks complete.

Following every `this.<name>(` call transitively gives a closure of
**21 methods**. Twenty of them are between 1 and 22 lines.

**No line-number column, on purpose.** The first version of this table carried
one, and so did the diff tool's spread labels — where it was a live defect:
identified by line, all 21 conditional spreads read as added and removed across
#375 because two comment lines were inserted above them. A method's identity is
its name; where it sits is a fact about today's file. Names and lengths below,
re-derived by `node proto/w0-census.js`:

| method | length | bucket |
|---|---|---|
| `_serializeDrawing` | 341L | root |
| `_ensureSerializerCollections` | 22L | pure |
| `_activeLayerViewId` | 9L | impure-input |
| `_stairLevels` | 8L | pure |
| `_activeLineLayer` | 7L | impure-input |
| `_serializerEnv` | 6L | impure-input |
| `_contextLineLayer` | 5L | impure-input |
| `_layerStandard` | 5L | impure-input |
| `_activeLevelId` | 5L | impure-input |
| `_pointForStorage` | 3L | pure |
| `_roofHeelIn` | 3L | pure |
| `_stairCurrentLayout` | 3L | pure |
| `_stairEndFor` | 3L | pure |
| `_lineLayerConfig` | 3L | impure-input |
| `_floorLevels` | 3L | pure |
| `_levelAssembly` | 3L | pure |
| `_levelFloorFt` | 3L | pure |
| `_levelWallTopFt` | 3L | pure |
| `_layerViewsForLevel` | 3L | impure-input |
| `_boneyardLevelId` | 1L | pure |
| `_activeLevel` | 1L | pure |

Two membership changes since 6 Sep, and the count of 21 hides both:
`_stairShapeSplit` left the closure and `_serializerEnv` joined it, so a reader
checking only the total sees a table that never moved.
`_ensureDrawingCollections` is here as `_ensureSerializerCollections` — the
rename is Finding A being fixed, below.

So the extractable surface is one large function plus **99 lines** of small
accessors across twenty methods. That is better news than it looks: the accessors are where the
component coupling hides, and they are small enough to read in full.

**Zero non-arrow `function` declarations across all 21 bodies.** Every `this`
in the closure is the component; there is no nested rebinding to trace.

The walk also reads each method's **signature**, not just its braces.
`_roofHeelIn` and `_stairEndFor` both read `this.state` in default-parameter
expressions, outside the body — counting braces alone would have missed them.

---

## THE REFERENCES

**52 distinct `this.<ident>`** across the closure — 31 fields, 20 methods
(the root is never referenced by name), plus `state`. It was 60 on 6 Sep, and
the net −8 is two movements, not one: **Finding A's ten component fields left**
and level locks brought two persisted ones in (`_levelLocks`,
`_nextLevelLockId`). **Every field the closure still reaches is persisted** —
`componentFields` is now empty. Every call resolved to a
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

    ...(this._layoutData ? { layout: this._layoutData } : {}),   MODEL.dc.html:3565
    ...(this._specsData ? { specs: this._specsData } : {}),      MODEL.dc.html:3568

The output shape is therefore **not fixed**. A deep-compare acceptance for the
Write Tier has to expect two keys that legitimately appear and vanish.

And the same hazard exists one level down, which the first pass of this census
missed. **Nineteen per-entity conditional spreads** write optional keys inside
the mapped objects — 18 distinct names:

    auto  base  claimedNo  closetDeclined  companionOf  dealt  dir  endWallId
    minDimensionFt  padIn  pullLevelId  pullSrcId  roomCategory  splitTreads
    stairId  standoff  switchId  washroomLevelId

(15 sites and 14 names on 6 Sep. The four added since — `dealt`,
`minDimensionFt`, `roomCategory`, `washroomLevelId` — arrived without anyone
re-running the census, which is how a number in prose goes wrong while every
test stays green.)

A wall with `auto` unset and a wall with `auto: false` are different objects in
the file. Any comparison that walks entities key-by-key has to treat an absent
optional and a falsy one as the same thing, or it will report differences that
are not there.

One of the nineteen is not optional at all and is worth separating.
One site **branches on shape**: a wall-hosted electric device
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

`_ensureSerializerCollections`, `_pointForStorage`, `_roofHeelIn`,
`_stairCurrentLayout`, `_stairEndFor`, `_stairLevels`, `_floorLevels`,
`_levelAssembly`, `_levelFloorFt`, `_levelWallTopFt`, `_activeLevel`,
`_boneyardLevelId`

Everything they reach is persisted state or their own arguments. These move to
a shared module unchanged. `_levelAssembly` is here on purpose — the role-aware
reader added on 6 Sep asks `level-assembly.js` and holds nothing itself.

**Still 12, and two of the names changed.** `_stairShapeSplit` left the closure;
`_ensureSerializerCollections` is the split half of the initialiser Finding A
named, and it is *pure* now — which is the finding being closed rather than the
bucket coincidentally holding.

### reachable persisted state — 20 collections + 9 counters + 2 passthroughs

Twenty collections the serializer reads and `_ensureSerializerCollections`
initialises (`_lines`, `_walls`, `_floors`, `_shapes`, `_roofs`,
`_fenestrations`, `_electricDevices`, `_fixtures`, `_surfaceOpenings`,
`_dimensions`, `_columns`, `_beams`, `_stairs`, `_notes`, `_roomTags`,
`_outlines`, `_boneyardOutlines`, `_groups`, `_underlays`, `_levelLocks`), nine
`_next*Id` counters the serializer reads and ensure does not touch, and the two
passthrough holders `_layoutData` and `_specsData`. **31 fields, all persisted.**

(19 + 8 on 6 Sep; level locks added one of each.)

### component-only — **0 methods, 0 fields**

Empty. It held one method and ten fields when this census was written, and that
was Finding A.

---

## FINDING A — the ensure call is the widener — **CLOSED, `83dba6f`**

**Fixed by W1 step 1, *"split the initialiser by who needs it"*, and confirmed
by re-run: `componentFields` is 0 and the serializer's closure now reaches
nothing but persisted state.** The finding is left standing below rather than
deleted — it is the reason the split happened, and a closed finding with its
evidence intact is worth more than a gap. `01226e3` (W1 step 2) followed it by
handing the save path an explicit environment, which is where `_serializerEnv`
in the method table came from.

The state it described, as measured on 6 Sep:

`_serializeDrawing`'s first statement was `this._ensureDrawingCollections()`.
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

That is exactly what `83dba6f` did.

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

## FINDING C — `specs` is `layout`'s unguarded twin — **CLOSED, `16a9b60`**

**Guarded, at `tests/persisted-format.spec.js:188`, and the guard asserts the
load-bearing half** — that MODEL *carries* the sections through, not merely that
the key survives. `PASSTHROUGH = ['layout', 'specs']` also replaced the
`k !== 'layout'` exclusion the finding named. Left standing below for the same
reason as Finding A.

The state it described, as measured on 6 Sep:

`tests/persisted-format.spec.js` opened by naming the layout passthrough as
the failure that "can cost a drafter real work": delete it and MODEL still
passes every test it has, while silently deleting the drafter's entire sheet
set on the next save. It then guards it properly, with a dedicated round-trip
test that injects a `layout` key and asserts it survives a MODEL save.

`specs` had the identical three-site shape (line numbers as of 6 Sep — they have
all moved, which is the point the method table above makes):

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

- One **341-line** function and **99 lines** of accessors, of which **12 methods
  move unchanged**.
- A format whose keys are all named explicitly — **no `this.state` spread** —
  so the census can be re-run rather than re-derived.
- **67 fixed keys plus 2 conditional ones**, and **19 per-entity conditional
  spreads** below them, one of which branches on shape rather than presence;
  the output shape is not constant at either level.
- ~~**One initialiser to split**, not port (Finding A).~~ **Done, `83dba6f`.**
- **One key that cannot be computed from the drawing alone** (Finding B). **The
  only one still open**, and it is a decision rather than a repair: a shared
  serializer handed the drawing alone cannot produce `activeLineLayer` at all.
- ~~**One passthrough to guard before anything is moved** (Finding C)~~ **Done,
  `16a9b60`.**

Order of operations that followed from the above: guard `specs`, then split
`_ensureDrawingCollections`, then decide how `activeLineLayer` is supplied,
then move the twelve pure methods. **The first two are done and in that order.**
What is left is the `activeLineLayer` decision, then the move.

---

## RE-RUNNING THIS DOCUMENT

    node proto/w0-census.js                          the counts quoted above
    node proto/w0-census.js --json > after.json      the full index
    node proto/w0-census-diff.js before.json after.json

The diff is the gate's tool, and it answers *"did this rung touch the old
serializer"* by naming what moved rather than counting it. **It identifies an
entry by what it writes — key-set, tier, branching — never by line number.** It
used to label by line, and across #375 that printed all 21 spreads as added and
removed for two inserted comment lines. Twenty-one false rows standing next to
one true one is worse than silence: it is the row that teaches a reader to skip
the row.

An unreadable or unrecognised input exits 2 and says `UNREADABLE`. It never
reports "no change", because **"nothing moved" is the answer a broken tool gives
too** — which is the same sentence this document opens with, and the reason
both the census and its diff exist as tools rather than as prose.
