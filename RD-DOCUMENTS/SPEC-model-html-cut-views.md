# SPEC — cut views on MODEL.html: what is missing, measured

**Written by Skipper, 12 Sep**, against `main` at `2da04b5`.
**Status:** reading only. No product code was changed to produce this.

Movie asked when the right-hand preview screens — the elevations and sections —
come over to `MODEL.html`. Nobody had measured the gap. This is the measurement.

**The headline: the gap is not the section maths, and it is smaller than the
file sizes suggest.** `MODEL.html` mentions elevations six times against the old
page's 138, which reads like a chasm. It is not. The painter is shared and
already loaded, and of the eighteen accessors it reads through, **four are
already built, four more are one-line calls into a module the page already
loads and already wires, and two that look like page state are persisted
drawing data.** What is genuinely absent is a *host*: a place to put a
generated drawing and a state saying which one you are looking at.

> **CORRECTED BY THE BUILD — the sentence above is wrong twice, and the table
> below is corrected in place. Both errors have the same cause: I established
> that a NAME existed and recorded that as the answer to a question about
> BEHAVIOUR.** Read §0.1 before costing anything from this document. The
> "host" conclusion itself survived the build unchanged.

---

## 0.1 Correction: two rows of the table below were wrong, and why

Written after building the host. Both errors survived into code and were
caught by measurement rather than by review, so they are recorded here rather
than quietly edited out.

**`footingWidthIn` — "one line, module exposes it". It does not.**
`footingWidthIn` is a nullable FIELD on the normalised level assembly, not a
function on `DraftLevelAssembly`; `level-assembly.js`'s export list does not
contain it. Null there means *derive from the foundation wall type* — ICF on
24", everything else on 20" — so the row both named a function that does not
exist and, had it existed, would have dropped a derivation. The page swallowed
the resulting `TypeError` into `painter failed`.

The cause is exact and worth naming: **I counted occurrences of the name and
recorded that as "the module exposes it".** Counting a name is not confirming
an export. Every module call in the built `cutEnv` is now checked against its
module's export block.

**`walls()`, `floors()`, `roofs()` — "yes, already built". They exist, and
they answer a different question.** Those are `MODEL.html`'s ON-SCREEN
accessors: each filters to the active level *and* the active layer view. A
section cuts through every level at once — that is what a section is — so they
are the wrong list by definition, and under a cut view they filter to nothing
at all, because no item's `view` is ever `cut:S1`.

Handing the painter that empty world did not fail loudly. `drawCutView` falls
back to an **elevation** when the cut crosses no walls, so the page drew a
believable picture from nothing and every test passed: `ink > 0` is true of an
elevation, and no assertion said *section*. It was found by running the same
cut through `proto/elevation-harness.js`'s env in node — 8 crossings there, 0
in the page.

**The general form, for the next inventory of this kind.** An accessor
contract can be met name-by-name and still be met with the wrong answers
behind it. A row saying "the page can answer this today" is a claim about
behaviour, and only running it proves it. The third implementation of the
contract existing is what made the disagreement visible; that is an argument
for keeping the harness, not a coincidence.

---

## 0. A note on line numbers

Every line number in the work order that commissioned this spec is stale by
roughly thirty lines, because PR #375 added to `MODEL.dc.html` earlier the same
evening. `_cutViewEnv` is at `:10094`, not `:10061`; the three leave paths are
at `:9810`, `:10008`, `:10146`, not `:9777`, `:9975`, `:10107`.

Nothing was wrong with the order — the file moved under it. Every line cited
below was re-read on `2da04b5` at the time of writing, and anyone acting on this
spec after another merge into `MODEL.dc.html` should assume the same drift and
re-check rather than trust these.

---

## 1. The env gap, accessor by accessor

`drawCutView(env, ctx, w, h, cut, opts)` lives at `cut-view.js:473`. It reads
its world through **eighteen** `env.*` accessors and nothing else: there is no
destructuring of `env` anywhere in the file, so the list below is the whole
contract, not a sample. The old page's `_cutViewEnv()` (`MODEL.dc.html:10094`)
supplies exactly those eighteen — the two ends agree, which is worth stating
because it means neither side carries a spare.

| accessor | old page supplies it from | can `MODEL.html` answer it today? |
|---|---|---|
| `walls()` | `this._walls` | **NO — see the correction below.** `walls()` at `:429` exists and answers a different question |
| `floors()` | `this._floors` | **NO — see the correction below.** Same as `walls()` |
| `roofs()` | `this._roofs` | **NO — see the correction below.** Same as `walls()` |
| `masterPointById()` | `this._masterPointById` | **yes** — `:1605` |
| `levelAssembly()` | `this._levelAssembly` | **one line** — `LA.normaliseLevelAssembly`, already called at `:1175` |
| `levelFloorFt()` | `this._levelFloorFt` | **one line** — `LA.levelFloorFt`, already called at `:1182` |
| `levelWallTopFt()` | `this._levelWallTopFt` | **one line** — `LA.levelWallTopFt`, module exposes it |
| `footingWidthIn()` | `this._footingWidthIn` | **NO — the module does not expose it.** See the correction below |
| `buildType()` | `this.state.buildType` | **from the drawing** — see §1.1 |
| `elevationDatum()` | `this.state.elevationDatum` | **from the drawing** — see §1.1 |
| `floorLevels()` | `this._floorLevels()` | **close** — `stairLevels()` `:1166-1190` builds the same shape |
| `fenestrations()` | `this._fenestrations` | **probably** — three references; I did not confirm an accessor |
| `garageOutlines()` | `this._garageOutlines` | **no** |
| `garageFoundation()` | `this._garageFoundation` | **no** |
| `edgeOnOutline()` | `this._edgeOnOutline` | **no** |
| `gableCornerStyle()` | `this._gableCornerStyle` | **no** |
| `elevLabel()` | `this._elevLabel` | **no** |
| `ftIn()` | `this._ftIn` | **no** |

Four built, four a line each, two persisted, one close, one unconfirmed, six
absent.

**`fenestrations` is the one row I am not certain of** and I am saying so rather
than rounding it up: `MODEL.html` references the word three times and I did not
open each to confirm a callable accessor exists. Check it before costing.

### 1.1 The question that decides small-versus-large

The order asks, per accessor, whether it is drawing data or page state, because
a persisted key is a one-line read and a `this.state` value is a design
decision. Two accessors look like page state on the old page:

```
buildType:      () => this.state.buildType
elevationDatum: () => this.state.elevationDatum
```

**Both are persisted keys.** `tests/persisted-format.spec.js` lists `buildType`
at `:47` and `elevationDatum` at `:55` in `PERSISTED_KEYS`. They live on
`this.state` in the old page as a cache of what the file holds, not as page
state in the sense that matters here.

So the derive-versus-store question that caught the stairs **does not bite
here**. Both resolve to *store*, both are already stored, and on `MODEL.html`
they are reads from `drawing`.

One consequence worth carrying: the same spec's writer map (`:70-81`) records
`elevationDatum: ['LAYOUT']` and `cuts: ['LAYOUT']` — LAYOUT writes them, the
model pages read them. A cut-view host on `MODEL.html` is a **reader** of both.
It should not grow a writer for either, and if a later rung wants one, that is a
new ruling and not a detail of this build.

---

## 2. What a card is

The old page's cards paint a live thumbnail through the same painter
(`paint: (ctx, w, h) => this._drawCutWorkspace2D(...)`, `MODEL.dc.html:7228`
onward). The question is whether parity needs that or whether a label-only seat
is enough for the first rung.

**I did not measure `drawCutView`, and I am not going to guess at a number.**
The honest reason: `helpers.js` opens with "the page keeps no test hook on the
component", so a spec cannot call `_drawCutWorkspace2D` on a real house, and a
synthetic `env` would time my stub rather than a Bone house. The two ways to get
a real figure both break this rung's read-only rule — a temporary
`performance.mark` around the painter, or a test hook — so the measurement
belongs to whoever builds the host, on the day they can take it legitimately.

What can be said without a number: **the cost scales with cards on screen and
with every repaint**, six seats is the old page's own layout (E1-E4, S1-S2), and
a section paint walks the whole level stack. That is a real per-frame cost and
it is why the question is worth asking at all rather than assuming thumbnails.

**My recommendation is label-only for the first rung**, and it is an argument,
not a measurement: the drafter's job at the rail is *choose a view*, and a
legible label does that. A thumbnail helps you tell two similar sections apart —
which matters at four elevations, and matters less when the alternative is
having no preview at all. Ship the seat, measure the painter with a real hook,
then decide. Reversing that order means paying an unmeasured per-frame cost to
answer a question we could have asked first.

### SETTLED, 12 Sep — and the first measurement was wrong

**The ruling (Devin): sections live, elevations labelled.** The decider is the
argument above rather than the cost: *a thumbnail earns its keep where the name
does not identify the view.* `S1` and `S2` tell a drafter nothing about which
section is which, so only a picture separates them. `E1 FRONT` and `E3 BACK`
already do the job a picture would.

**The measurement nearly settled it the other way, because it measured one
thing and reported another.** `proto/cut-view-timing.js` printed 0.14–0.30 ms a
card, and I quoted that here and in two pull requests as grounds to reverse the
recommendation above. Its own header read *"HOW LONG ONE SECTION TAKES TO
PAINT"* and its last line printed *"six cards at the median"* — one sample
multiplied by six, reported as a population it had never sampled. **Four of the
six seats are elevations.** Per seat, 232×152, `repro-garage-house`:

| E1 | E2 | E3 | E4 | S1 |
|---|---|---|---|---|
| 46.8 ms | 43.2 ms | 47.6 ms | 43.7 ms | **0.32 ms** |

About 100×, holding across all three repro houses, and identical at 232×152 and
900×600 — so it is the painter's hidden-line geometry, not rasterisation.
Measured in the browser before the fix, four live elevations cost **148 ms per
wall drawn**. The rail as built costs **1.0 ms**.

So §2's original recommendation was closer to right than the number that
overturned it, and the paragraph above stands rather than being edited to look
prescient. The tool is rewritten to time every seat separately, with the error
recorded in its header; a tool that averages a cheap case with an expensive one
hides the thing the question turns on.

**The deferral in §3 is unchanged, and the seat shape is kept deliberately.**
Seat, canvas and epoch are identical for both kinds — an elevation simply draws
its name where its picture would go — so a faster elevation painter becomes a
thumbnail without moving a seat.

---

## 3. The empty seats

`emptyCard` (`MODEL.dc.html:7256`) is not decoration. The rail shows E1-E4 and
S1-S2 whether or not those views exist, and tapping an empty **section** seat
calls `_cutFromRailSeat(name)` (`:7285-7287`) — a creation gesture living in the
rail. Elevation seats take `onClick = null` by default (`:7263`): an absent
elevation is a chair, not a button.

**Deferred, and the drafter is not stranded.** Cutting a section already has a
home on the plan — that is what the cut tool is — so a missing rail gesture
costs a shortcut, not a capability. Shipping the rail as *seating* first also
keeps the first rung honestly scoped: a host that can show what exists is a
smaller and more testable claim than a host that can also bring views into being.

What the deferral must not do is leave the seats looking pressable. If E1-E4 and
S1-S2 are shown as empty chairs, an empty chair must not invite a press that
does nothing — the old page's `onClick = null` default is the right shape to
copy on day one.

---

## 4. The leave paths

Three places drop the old page out of a cut view, each re-read on `2da04b5`:

| where | line | guard |
|---|---|---|
| `_switchLevel(idx)` (declared `:9807`) | `:9810` | `if (this.state.activeView === 'cut') this._setView('top')` |
| `_deleteLevel(idx)` (declared `:9962`) | `:10008` | `if (activeCutId === null && this.state.activeView === 'cut')` |
| `_deleteCut(id, e)` (declared `:10140`) | `:10146` | same shape as above |

(The file has other `_setView('top')` calls — `:4137`, `:6410`, `:9379`,
`:9838` — but those are `if (this._orthoCam)` camera resets and are not cut-view
exits. Counting by the string alone would have found seven and reported the
wrong four.)

`MODEL.html` must answer all three, and the shapes differ:

1. **Switching level** — a cut belongs to the level it was cut on, so the view
   must close. Unconditional on level change while a cut is open.
2. **Deleting the cut you are looking at** — close, and do it in the same commit
   that removes the cut, not on the next repaint. A host that paints one frame
   of a deleted cut is drawing from a drawing that no longer says so.
3. **Deleting a level** — close if the open cut belonged to it. The old page's
   guard is written as "no cut is active any more", which is the same thing
   arrived at from the other side.

**A host that can be entered and not left is the defect this section exists to
prevent**, and it is the one I would write the tests for first — before the
painter renders anything, a host should be provably escapable.

---

## 5. Decomposition, and no estimate without one

Named items, in the order I would build them:

1. `cutEnv()` — the eighteen accessors. Four exist, four are one-liners through
   `DraftLevelAssembly`, two are drawing reads, `floorLevels` adapts
   `stairLevels`, and six are new: `garageOutlines`, `garageFoundation`,
   `edgeOnOutline`, `gableCornerStyle`, `elevLabel`, `ftIn`. **The six are the
   real work in this item**, and each needs its old-page implementation read
   before it is costed — I have not done that reading, so I am not costing it.
2. **View state** — and **this page already has some**, which the first version
   of this spec missed by describing the gap in the old page's vocabulary
   (`activeView` / `activeCutId`) rather than looking for this page's own.
   `MODEL.html` keys a view through `?view=` in the URL, with `view-pick` in the
   chrome bar filled from `DraftLayerViews.layerViewsForLevelId`, and
   `goToLevel` already drops a `?view=` the new level does not have.

   Those are **layer** views — plan, floor layout — and cut views are not among
   them, so the conclusion above stands. But the host should **extend that
   mechanism rather than invent a second one**: a cut view reached by `?view=`
   is shareable, survives a reload, and inherits the level-change handling that
   already exists. A parallel `activeCutId` in page state would be a second
   source of truth for "what am I looking at", which is the shape of defect this
   project has spent the week removing.

   The plan/cut branch in the main canvas is still needed
   (`MODEL.dc.html:7402-7408` is the old page's).
3. **The rail** — seats for E1-E4 and S1-S2, labels only per §2, non-pressable
   when empty per §3.
4. **The three leave paths** per §4, with tests first.
5. **Parity check** — one drawing, both pages, same cut, compared.

**I am not giving a session count.** Item 1's six new accessors are unread, and
item 5 is the only one whose size I would trust today. A number now would be a
feeling with a decimal point on it, and the order rightly forbids that.

What I *can* say: **items 2, 3 and 4 are small and independent of Gilligan's
file.** Item 1 is where the cost lives, and the next honest piece of work is
reading those six accessors on the old page and adding a column to the table in
§1 saying what each depends on.

---

## 6. What this does not cover

- I did not confirm `fenestrations` (§1).
- I did not measure the painter (§2).
- I did not read the six absent accessors' implementations (§5).
- Nothing here touches the 3D side. `_enterCutView` (`:10056`) is mostly camera
  work for a renderer `MODEL.html` does not have, and a 2D host does not need it.
