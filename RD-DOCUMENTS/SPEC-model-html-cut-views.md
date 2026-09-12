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
| `walls()` | `this._walls` | **yes** — `walls()` at `:429` |
| `floors()` | `this._floors` | **yes** — `floors()` at `:433` |
| `roofs()` | `this._roofs` | **yes** — `roofs()` at `:438` |
| `masterPointById()` | `this._masterPointById` | **yes** — `:1605` |
| `levelAssembly()` | `this._levelAssembly` | **one line** — `LA.normaliseLevelAssembly`, already called at `:1175` |
| `levelFloorFt()` | `this._levelFloorFt` | **one line** — `LA.levelFloorFt`, already called at `:1182` |
| `levelWallTopFt()` | `this._levelWallTopFt` | **one line** — `LA.levelWallTopFt`, module exposes it |
| `footingWidthIn()` | `this._footingWidthIn` | **one line** — `LA.footingWidthIn`, module exposes it |
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
2. **View state** — `activeView` / `activeCutId`, and the plan/cut branch in the
   main canvas (`MODEL.dc.html:7402-7408` is the old page's).
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
