# The module review gate

Gilligan, 2 Sep. Movie's rule: *it is moving house — every box is opened as it
is carried, kept or tossed right then.*

Seventeen modules are loaded by `MODEL.dc.html` and by nothing else, so nothing
outside MODEL has ever exercised them. Before a new page references one, it gets
read, and it gets one of three verdicts:

| verdict | meaning |
| --- | --- |
| **right as it is** | carry it across unchanged |
| **right but unclear** | behaviour is correct, the reasoning is not written down |
| **wrong** | fixed in the **old** app first, because that is where it is running |

A wrong module is never fixed only in the new page. That would leave the defect
running for every drafter still on the old one, and hide it behind a green new
page.

## The rule this gate runs by

**No verdict without something run.** Reading alone produces confident wrongness
— three of us proved that repeatedly on 1–2 Sep, and every one of those was
caught by measuring rather than by reasoning harder. So each verdict below cites
a harness, a spec, or a probe, and says what it reported.

## Where this sits

`MIGRATION-STATUS.md` already asked for verdicts to be recorded in its own
table, and this file was written without filling it — two homes for one record,
which is a doc bug of my own making. Collapsed: **that table is the index, this
file is the reasoning.** A verdict is a row there and a section here.

## The seventeen, as measured

Sixteen are loaded only by `MODEL.dc.html`; `first-run.js` is loaded by nothing
at all and is included because it is written and waiting.

| module | lines | export | harness | own spec |
| --- | ---: | --- | --- | --- |
| `areas.js` | 127 | `DraftAreas` | – | yes |
| `auto-dims.js` | 326 | `DraftAutoDims` | – | yes |
| `auto-stair.js` | 567 | `DraftAutoStair` | – | yes |
| `auto-windows.js` | 304 | `DraftAutoWindows` | yes | yes |
| `bone-wallet.js` | 110 | `DraftBoneWallet` | – | yes |
| `build-house.js` | 300 | `DraftBuildHouse` | – | – |
| `closets.js` | 356 | `DraftClosets` | yes | – |
| `electric-rules.js` | 179 | `DraftElectricRules` | yes | – |
| `gruff-drivethru.js` | 156 | `DraftGruffDrivethru` | – | yes |
| `gruff-interview.js` | 519 | `DraftGruffInterview` | yes | yes |
| **`pdf-scan.js`** | **185** | `DraftPdfScan` | **–** | **–** |
| `room-grow.js` | 517 | `DraftRoomGrow` | yes | yes |
| `stair-rules.js` | 395 | `DraftStairRules` | – | yes |
| `toy-constraints.js` | 525 | `DraftToyConstraints` | yes | – |
| `toy-context.js` | 199 | `DraftToyContext` | yes | – |
| `turtle.js` | 149 | `DraftTurtle` | yes | – |
| `first-run.js` | 151 | `DraftFirstRun` | yes | – |

**Sixteen of seventeen carry either a node harness or their own spec file.** For
a pure module a harness is the stronger of the two — it runs in milliseconds
without a browser, so it gets run.

## Verdict 1 — `pdf-scan.js`: **right but unclear**

185 lines, and it was the only one of the seventeen with neither a harness nor
a spec. It is also load-bearing: `MODEL.dc.html` calls it at **seven** sites —
`inspectPdf`, `inspectPdfPage`, `inspectImage`, `parseScaleEntry`,
`calibrateScale`, `worldSizeFromScan` ×2 — on the INSERT PHOTO/PDF path. It is
the surviving capability of `PDF-MARKUP.dc.html`, this repo's original app,
retired in `8926c4d`.

**It did not need refactoring to be proven.** The first reading — "touches the
DOM, therefore not node-testable" — was too pessimistic. Its seven exports
split, and the DOM lives entirely in three of them:

| | exports |
| --- | --- |
| browser-bound | `inspectPdf`, `inspectPdfPage`, `inspectImage` |
| **pure** | `detectScalesInText`, `parseScaleEntry`, `calibrateScale`, `worldSizeFromScan` |

The whole file loads under plain `node` with a `window = {}` stub, because the
DOM calls are inside functions a harness never invokes. `proto/pdf-scan-harness.js`
now runs **17 checks**, and a `12` changed to a `10` inside `calibrateScale`
fails it with exit 1.

The pure four are the ones carrying the risk: they turn a scan into real-world
dimensions, and a wrong number there is silently wrong on every measurement
taken off that underlay afterwards. All six standard scales come back right —
`1/8"→96`, `3/16"→64`, `1/4"→48`, `1/2"→24`, `1"→12`, `1:50→50` — and
unparseable text returns `null` rather than guessing.

### Why "unclear" and not "right as it is"

**A precondition is enforced in the caller and written down nowhere.**

`calibrateScale` accepts a zero or negative typed length and returns
`{ ok: true, widthFt: -2 }` — a negative sheet. That cannot happen in the app
today, because `MODEL.dc.html:3335` refuses it first:

```js
if (!parsed.ok || parsed.inches <= 0) { ...'The distance must be positive.'... return; }
```

So it is **not a defect in the shipped app** — and it is **not safe to carry**.
A second page calling `calibrateScale` directly, which is the entire point of
moving these modules, inherits a negative scale and no error unless somebody
remembers to re-implement a guard they cannot see from the module.

**Recorded, not changed.** Making the module self-guard would alter its contract
to suit a page that does not exist yet, and inventing a rule nobody ruled on is
its own failure. The harness pins the behaviour as it *is*, names the line that
really guards it, and says plainly that a new caller must bring its own.

That is what "right but unclear" means: correct where it sits, and correct only
because of something outside it.

## Verdict 2 — `areas.js`: **WRONG** (revised 2 Sep)

Filed first as *right but unclear* for `polygonArea`'s unstated contract, which
still stands and is now documented. But a second measurement, prompted by a
question about stair openings, found a real defect in `computeAreas` — the first
of the seventeen.

### An opening is deducted whether or not it is on the floor

```
floor 20x14 = 280 sq ft

opening 10x4 fully inside        deducts 40   net 240   correct
opening HALF off the edge        deducts 40   net 240   should be net 260
opening ENTIRELY outside         deducts 40   net 240   should be net 280
```

`openingsSqFt += polygonArea(opening.points)` — the full area of every record
whose `hostId` names the floor, with **no clipping to the host**. An opening
floating outside the building still removes its area from the permit figure.

**Why the design made this possible, and why it is still the right design.** An
opening here is not a hole cut into the slab outline: the floor polygon is never
cut, and the level's figure is `gross − openings − garage`, arithmetic rather
than geometry. That is a deliberate and good choice — it is why the slab can
never split in two or pinch itself, and why this app needs none of the sliver of
floor an ArchiCAD drafter leaves between a stair opening and an exterior wall to
keep the slab whole.

The arithmetic simply never asks the question the geometry used to answer for
free: *is this hole actually in that floor?*

**Reachable in exactly the workflow that found it.** Running a stair opening out
to the exterior wall — the move the sliver exists to avoid — and overshooting by
a few inches deducts the overshoot as though it were floor. Silent, and smaller
than the truth, on a number that goes on a permit application.

**Not fixed here — the fix needs a ruling.** Clipping the opening to its host is
geometrically correct but wants a polygon-intersection routine the repo does not
have. Refusing an opening not fully inside its host is far cheaper —
`electric-rules.js` already carries a point-in-polygon `contains` — and matches
the habit the repo already follows in `closets.placeIn()` and `parseScaleEntry`,
which refuse rather than answer wrongly. Which of those, and whether the refusal
lands at draw time or as a flag on the level's figure, is a decision, not a
measurement.

## The original verdict 2 finding — `polygonArea`'s contract

127 lines, four exports, pure shoelace, and it states its convention at the top
where a drafter can read it — areas are as built, an opening is deducted from
the level whose floor it is cut from, so a stairwell counts exactly once. That
much is exemplary.

Measured against known shapes:

```
10x10 square                        100     correct
the same square wound backwards     100     winding-independent, correct
triangle b=10 h=10                   50     correct
two points / one point / empty        0     degenerate, returns 0
BOWTIE (two 5x5 lobes)                0     <-- expected 50
```

**A self-intersecting polygon returns zero.** The two lobes wind oppositely and
cancel exactly. On a permit application that is a silent understatement, and a
shape that plainly has area reports none.

The module is not wrong for its real contract, which is *simple polygon in,
area out* — shoelace has no other meaning. What is missing is that the contract
is written nowhere, and **nothing upstream enforces it**: there is no
`isSimple`, no crossing test, no guard on any outline path in the repo.

### It is the same missing guard the audit already found

`AUDIT-CRITICAL.md` M6 — *`offsetOutline` has no self-intersection cleanup* —
CONFIRMED for the function, INFERRED for reachability, with consumers at the
roof footprint, the ROOF-level truss dimensions and the thickened-edge slab
ring. `areas.js` is a **second consumer of that one absent guard**, and it was
not among M6's list.

That changes M6's shape: it is not a defect in one function, it is a missing
precondition shared by every path that accepts a drafted outline.

### Reachability: CONFIRMED

M6 carried `INFERRED` on reachability. It is now measured, and a drafter **can**
draw one.

The reason it looked unreachable is that the **T-square is down by default**, and
it forces every segment onto an axis — clicking a diagonal from `(10,-8)` to
`(-10,8)` gives `|dx| > |dz|`, so it snaps horizontal and the crossing collapses.
A rectangle survives because its segments are already axial. Stow the T-square
with `t` and the lock is gone:

```
asked for : [[-10,-8],[10,8],[10,-8],[-10,8]]
drew      : [[-10,-8],[10,8],[10,-8],[-10,8]]   <- shape asserted before reading area
area      : 0                                    two 8x10 lobes would be 160
```

So: a drafter presses `t`, draws a crossing outline, and the shipped area
function reports **zero** for a shape with 160 sq ft of floor in it. Nothing
errors and nothing warns.

**M6 moves from INFERRED to CONFIRMED**, and `areas.js` is the consumer where it
surfaces as a number on a permit application rather than a misdrawn line.

Found by two agents in sequence: Skipper diagnosed the snapping that made it
look unreachable, and the T-square's default-down behaviour came from an earlier
board. Neither half would have got there alone.

**Recommended, not done here:** `areas.js` has a spec but no harness, and its
spec costs 92 seconds in a browser to prove arithmetic that node settles in
milliseconds. A harness of the table above is the cheaper guard.

## Where a crossing check can live — measured, and the answer is "not on outlines"

The crossing guard was reverted after it turned `auto-dims.spec.js` red. The
reason is more useful than the revert.

```
COMMIT  n=7 xs=-8,8,8,3,3,3,-8
STORED  lvl 8,7,5,3,1 — all   xs=[-8,8,8,3,3,3,-8]
```

A drafter draws eight corners with a 1 7/16" jog. The **vertex magnet** —
`_magnetRadius() = worldPerPixel × snapZonePx × 5`, reaching 8–12 inches at the
suite's default zoom — swallows a 1.44" gap whole, so `x = 2.88` snaps to `3`,
the coincident pair dedupes, and what is left where the jog was is a
**zero-width spike**: `(3,6) → (3,3) → (3,6)`, out and back along one line.

`selfIntersects` is entirely right to call that a crossing. **And the spike is
stored permanently, on every level.** It is not transient, and `2.88` never
comes back — the spec clicks 2.88 but asserts only about *printed dimension
strings*, never about stored coordinates, and passes because the printed value
is `3`.

**So a crossing check has nowhere safe to live on outlines at all** — not at
commit, not after. Any such check run on stored geometry will flag ordinary
drawings, because "self-intersecting" and "has a magnet-merged corner" are the
same shape. That is not a tolerance to tune.

**Which sharpens the M6 fix rather than abandoning it.** A spike has zero area,
so it cannot corrupt a total; a bowtie has two lobes that cancel, and that is
what produces a permit figure of zero. The question worth asking is therefore
not *does the ring cross itself* but *do its lobes cancel* — the signed area
against the unsigned. Different question, different answer, and not the one I
built.

Five wrong theories died in this thread — four speculative, and one reported as
a negative result from checking a single mechanism. The last was the expensive
one: a confident wrong negative tells everybody to stop looking.

## Verdict 3 — `auto-dims.js`: **right as it is**

326 lines, one export, `computeAutoDimStrings`. The first of the seventeen to
earn the top verdict, and it earns it for one reason: **it names its
preconditions in its own header.**

> *plain data in (filtered walls/outlines/roofs, resolved opening centres,
> tuning numbers), dimension segments out. No THREE, no component state, no
> DOM — **the caller owns filtering, vertex linking, and the dimension
> records**.*

That sentence is the whole difference between this verdict and the two before
it. `pdf-scan.js` and `areas.js` are equally correct in the app and equally
dangerous to carry, because what the caller must guarantee is discoverable only
by reading the caller. Here it is written where the next person looks.

Measured:

```
empty walls/outlines/roofs   -> null    matches the documented "nothing to string"
{}                           -> throws  missing keys, programmer error at the call site
no argument                  -> throws  same
```

`PRINT_GRID_FT = 1 / 192` is the sixteenth-of-an-inch print grid stated as a
named constant with its derivation beside it. That is the arithmetic the
audit's **C1** was about — partials not summing to their overall — and C1 now
measures **0 of 400 strings drifting, worst case 0/16"**. The grid is right and
it is right on purpose.

**No change recommended.** Carry it across as it stands.

## Verdict 4 — `stair-rules.js`: **right as it is** (and the standard to measure the rest against)

395 lines, fifteen exports, and the only module so far that states **the
epistemic status of its own data**. Stairs are code-regulated, so a wrong number
here is a violation rather than a blemish — and this is the module that behaves
as though it knows that.

**It labels every number.** `PROVENANCE AND ITS LIMITS — read before trusting a
number.` Every share and frequency is marked a model-synthesized estimate, not
measured data. The dimensional entries carry it in the data itself:

```
source:  'IRC / NBC (unverified)'    confidence: 'MEDIUM'
code:    'NBC 2020 9.8 (claimed, unverified)'
dispute: 'Sources give 34", 36" and 860mm for the NBC minimum and do not
          agree. VERIFY against the NBC text before this drives any validation.'
```

**It preserves dissent instead of averaging it away.** `DISAGREEMENTS` has seven
entries — *"One source ranks U first at 42%; the other eight put it third at
10–25%. Outlier recorded, not averaged."* `VERIFICATION_CHECKLIST` has nine
items naming what would settle them.

**And the warning is obeyed downstream.** The question that mattered was whether
anything lets unverified numbers drive validation. Nothing does.
`auto-stair.js:452` consumes the pack for **defaults only**, and says so at the
call site: *"and only the DEFAULTS, so a caller passing explicit numbers (MODEL
always passes widthFt) is untouched by it."* Where the two codes disagree it
takes the value valid under both — *"36\" satisfies both IRC and NBC, and
narrowing it would move every stair that leaves landingFt unset."*

**The honesty is itself pinned by a spec.** `tests/stair-rules.spec.js:46`
asserts every value in both packs is still marked unverified. Someone quietly
promoting an estimate to a fact fails the suite.

That is five things right at once: the numbers are labelled, the disagreements
are kept, the consumer treats them as defaults, the tie-break is conservative,
and a test guards the labelling. No other module in this set does more than one
of those.

**One live item, not a defect.** The §9 checklist is unworked, and it now can
be: `RD-DOCUMENTS/BUILDING-CODES/` holds `CanadaNBC2020.pdf` and
`CanadaNBC2020Sec9Illustrated.pdf`. The module asks to be verified against the
NBC text and the NBC text is in the repo. Whoever works that checklist flips
`verified: false` and settles the 34"/36"/860mm dispute — which is a research
task with a citable source, not a judgement call.

## Verdict 5 — `build-house.js`: **right but unclear** (and the trap is aimed at the move)

300 lines, four exports, pure, and its header states ownership as well as
`auto-dims` does: *"The component keeps the commit layer (vertex pool, srcId
links, collection writes); nothing here mints identity."*

What it does not state is a **load-order dependency**. Line 8:

```js
const geo = window.DraftGeometry2D;
```

That binds at **load** time, not at call time. `footingRings` is the only export
that uses it, and geometry-2d arriving later does not repair the binding:

```
build-house loaded BEFORE geometry-2d  ->  footingRings THREW
                                           "Cannot read properties of undefined
                                            (reading 'offsetOutline')"
geometry-2d first (MODEL's order)      ->  2 rings
```

`MODEL.dc.html` gets it right — geometry-2d at line 13, build-house at line 27 —
so this is **not a defect in the shipped app**. It is enforced entirely by the
order of two script tags, seventeen lines apart, in a file the module cannot
see.

### Why this one is worse than verdicts 1 and 2

`pdf-scan`'s missing guard and `areas`'s missing precondition both need a caller
to pass bad data. This needs nothing but a **different script-tag order** — and
writing new pages with their own script tags is precisely what the migration
consists of. The failure is also badly shaped: the module loads without
complaint, reports all four exports present, and throws only when the one
dependent function is called. A smoke test that checks the module loaded would
pass.

Three of the five modules read so far carry a precondition enforced somewhere
else and written nowhere. That is now the gate's main finding, not an incidental
one.

**The fix is one line and behaviour-identical when the order is already right:**
resolve at call time rather than at load —

```js
geo.offsetOutline(...)              ->   window.DraftGeometry2D.offsetOutline(...)
```

Not applied here. It is a change to shipped code that is correct today, and the
gate's rule is that a wrong module gets fixed in the old app first — this one is
not wrong, it is undefended. Worth a ruling, and a cheap one.

## Finding 3 — the load-order trap is a pattern: **13 captures across 8 files**

Verdict 5 found it in one module. It is not one module.

```
auto-stair.js:13      const geo        = window.DraftGeometry2D
build-house.js:7      const geo        = window.DraftGeometry2D
cut-view.js:27        const geo        = window.DraftGeometry2D
first-run.js:26       const interview  = window.DraftGruffInterview
room-grow.js:7        const geo        = window.DraftGeometry2D
toy-constraints.js:17 const geo        = window.DraftGeometry2D
toy-constraints.js:18 const wallTypes  = window.DraftWallTypes
toy-constraints.js:19 const standards  = window.DraftRoomStandards
toy-context.js:21     const geo        = window.DraftGeometry2D
toy-context.js:22     const toy        = window.DraftToyConstraints
```

Each binds at **load** time, so a consumer listed before its dependency gets a
module that loads clean, reports every export present, and throws only when the
one dependent function is called.

### The required order, and the live page against it

```
geometry-2d      must precede  auto-stair, build-house, cut-view, room-grow,
                               toy-constraints, toy-context
wall-types       must precede  toy-constraints
room-standards   must precede  toy-constraints
toy-constraints  must precede  toy-context
gruff-interview  must precede  first-run          (first-run is script-tagged nowhere yet)
```

`MODEL.dc.html` satisfies **all of them**. The trap is real and latent, not
firing.

**The near-miss worth recording:** `toy-constraints` sits at index 14 and
`toy-context` at 15. Adjacent. One line of reordering in that file breaks
`toy-context` with an error naming `geometry-2d` — pointing at the wrong file
entirely.

### Three more, destructured — and they are the SAFER shape

```
cut-view.js:28     const { WALL_TYPES } = window.DraftWallTypes
cut-view.js:29     const { formatInchesOnly } = window.DraftFormatters
layout-plan.js:10  const { WALL_TYPES, LEGACY_WALL_TYPES } = window.DraftWallTypes
```

```
layout-plan without wall-types  ->  THREW AT LOAD
with wall-types first           ->  loaded clean
```

Destructuring cannot bind `undefined`, so it fails **at load, in the file that
is actually wrong**. The plain `const geo = window.DraftGeometry2D` form binds
`undefined` silently and throws much later from a different function. So the
thirteen split into ten hazards and three warnings, and **the three are the
pattern to prefer** — louder, and correctly located.

`layout-plan.js` is the eighth file. It is a LAYOUT module rather than one of
MODEL's seventeen, which is why it belongs on this list: the trap is
repo-wide, not gate-scoped.

### How the count was got wrong three times

The number went 11 → 10 → 13 before it was right, and every step was a
measurement error rather than a disagreement:

- **11** counted `room-grow.js:108` as a capture. It is not: it sits inside
  `seedFor`, resolves at call time, and is guarded —
  `window.DraftRoomStandards ? …stampCategory(b) : null`. That line is the
  *pattern to copy*, not an instance of the problem.
- **10** was mine, and I called it definitive. Two faults partly cancelled:
  the sweep that caught `room-grow` missed six rows of its own because
  `window\.Draft[A-Za-z]+` **does not match the `2` in `DraftGeometry2D`**,
  and the pattern was blind to destructuring entirely.
- **13** is measured, both forms, with `layout-plan.js` proven to throw at load
  and to load clean when `wall-types` precedes it.

A character class that forgot digits nearly cleared six real hazards, and a
confident "definitive" corrected a colleague's number in the wrong direction.

`room-grow` shows the fix for all ten, and it is already in the repo: **resolve
at call time and guard**. One line per capture, behaviour-identical wherever the
order is already right.

## Verdicts 6–10 — the five modules carrying a capture: **right but unclear**

Finding 3 is measured, not inferred, so it decides these five without further
reading. Each one loads clean, reports every export present, and throws only
when the dependent function is called — and none of them says so.

| module | captures | held up by |
| --- | --- | --- |
| `auto-stair.js` | 1 | `geometry-2d` |
| `room-grow.js` | 1 | `geometry-2d` |
| `toy-constraints.js` | 3 | `geometry-2d`, `wall-types`, `room-standards` |
| `toy-context.js` | 2 | `geometry-2d`, `toy-constraints` |
| `first-run.js` | 1 | `gruff-interview` |

All five pass their harnesses where they have one, and all five are correct in
the shipped app, because `MODEL.dc.html` happens to list every dependency first.
That is the whole of what holds them up.

**`first-run.js` is the sharp one.** It is script-tagged *nowhere* — the only
module in the seventeen that no page loads — so its capture cannot fire today.
It fires the moment somebody adds the tag, which is exactly what the next page
is for. A module written and waiting, with a trap that arms on first use.

**`toy-context.js` is the near-miss.** Its dependency `toy-constraints` sits one
line above it in `MODEL.dc.html`. A single reordering breaks it with an error
naming `geometry-2d` — a file that is fine.

**The fix for all ten captures is already in the repo**, in `room-grow.js:108`:
resolve at call time and guard it. One line each, behaviour-identical wherever
the order is right, and it deletes the whole class.

## Verdicts 11–15 — `auto-windows`, `closets`, `electric-rules`, `gruff-interview`, `turtle`: **right as it is**

Five at once, on three measured grounds rather than on reading:

1. **Harnesses pass** — 45, 26, 26, 73 and turtle's own checks, all exit 0.
2. **Zero captures** — none of the five appears in Finding 3's list, so none
   depends on load order.
3. **Empty in, empty out** — every export was called with no argument:

```
turtle.walk()              {"points":[{x:0,z:0}],"legs":[],"heading":0}   a walk that has not moved
turtle.wallsFrom()         []
turtle.closes()            false
closets.autoPlace()        {"placed":[],"refused":[]}
closets.placeIn()          {"refused":"NO_ROOM"}          <- refuses, and names why
electric.candidates()      {"lights":[],"gangs":[],"outlets":[]}
autoWindows.dealWindows()  {"windows":[],"report":[],"sidesByLevel":{}}
```

Not one of them invents an answer. `closets.placeIn()` is the best of them: it
refuses **with a named reason**, which is the shape the whole gate has been
asking for — the opposite of `calibrateScale` returning `{ok: true}` for a
negative sheet.

**One note, on `auto-windows.faceOrientation`.** With a zero or absent normal it
returns `'front'`, because `|z| >= |x|` and `z >= 0` both hold at the origin. It
is the same family as the bowtie — confident on degenerate input — but far
milder, and the module **states its precondition** in the comment directly
above: *"MODEL hands us the outward normal; this is the one place the mapping
lives so the board and the marks can never drift apart."* The caller's duty is
named, which is the whole difference between this verdict and verdicts 1 and 2.
A zero normal means a face with no area, so it is a degenerate input rather than
a reachable one — recorded, not fixed.

**Carry all five across as they stand.**

## Verdicts 16–17 — `bone-wallet.js`, `gruff-drivethru.js`: **right as it is**

The last two, and both needed a harness written before a verdict could be given.
Both now have one.

### `bone-wallet.js` — 12 checks

Nine exports; `read` and `spend` touch localStorage, the rest are pure. The pure
pair carry the whole risk: `normalise` decides what a stored wallet may say and
`applyDrip` decides what an hour is worth. An error in either hands out free
bones or freezes the faucet, and neither shows on screen until somebody
complains.

It handles every hostile case already:

```
mangled record          -> reseeds to 3, does not throw
negative balance        -> floors at 0
fractional balance      -> floors, never rounds up
lastDripAt in the FUTURE-> clamps to now   (clock set back, restored VM)
2.5 hours below the cap -> +2 bones, and the half hour CARRIES
at the cap              -> the clock parks; elapsed time is discarded
100 hours from empty    -> still stops at the cap
```

The carry is the subtle one and the harness pins it: discard the fraction
instead of carrying it and a reload every 59 minutes drips nothing, ever.
Mutation-tested — `lastDripAt = now` in place of the carry fails with the exact
millisecond values.

**The ceiling reading is confirmed, 2 Sep.** "Ten a day" and "a ceiling of ten"
are different rules that agree only for somebody who never spends — measured
before asking: never spends, 24h → 10; spends as they go, 24h → **24**. Put to
the owner: the decision is to **leave the ceiling as built** — hold at most ten,
and a bone spent at nine comes back the next hour — with the allowance reading
considered and not adopted. *"Either will work for now; it is not a big deal how
many bones get sent out."* So this is a deliberate choice rather than a settled
rule, and it is cheap to revisit: the daily version was written and reverted, and
the shape is a third limit in `applyDrip`'s `Math.min` plus two stored fields.

Recorded because the daily-allowance reading is a natural misreading of the same
sentence, and the next person to have it should find the measurement already
done — never spends → 10, spends as they go → 24 — rather than repeat it.

**And its honesty is the reason it passes.** Its header calls it an honour
system by design: localStorage, editable with devtools, real enforcement waiting
on the server ledger (#52). So the harness pins the **arithmetic**, not the
security — which is the claim the module actually makes for itself.

### `gruff-drivethru.js` — 19 checks

Four board zones, stored as percentages because the art scales, but **measured**
off `assets/gruff-drivethru-board.png` at its natural 1250×1050. That is the
fact worth pinning: every zone still resolves to a whole pixel of the source art
on both axes. A percentage that no longer does is a number somebody nudged by
eye, and nudging by eye is how a panel drifts off the drawing beneath it.

Also pinned: no zone runs off the board, the portrait ends before the screen
begins, the answer strip starts below both, the speaker sits below the answer —
and `factsFrom()`, `doorSide()`, `outlineBox()` return `{hasStairs:false}`,
`null`, `null` on no input. It reads a draft; it does not invent one.

## Method note — a mutation that never applied is not a test

The whole-pixel check appeared to survive a nudge of `portrait.left`. It had
not: the source reads `6.720` and the mutation searched for `6.72,`, so the file
was never edited and a green run was reported as evidence the assertion was
worthless.

Re-run with the edit **asserted before the harness runs** — `assert s.count(old)
== 1` — it fails correctly, `[false, true]`, exit 1.

Skipper hit the identical shape in the same few minutes, from the other side: a
spec that passed with its subject deleted. **A mutation test proves nothing
unless the mutation is proven to have happened.** That is the seventh instrument
error of these two days and, like the other six, it was caught before it shipped
— by re-running rather than by reasoning about it.




**No verdict is being given on grep evidence.** A keyword scan of the headers
suggested which of these name their caller's duty, and that is a hint about
where to read, not a finding. The captures decided verdicts 6–10 because they
were *measured*, both directions, with a control.

## Finding 4 — the seam: this gate covers 17 of 37, and the other 19 are the ones already proven

The gate's criterion is *loaded by `MODEL.dc.html` and by nothing else*, chosen
because those modules have never been exercised anywhere but MODEL. Measured
against the whole set:

```
Draft modules at root        37
  MODEL-only (this gate)     17
  shared with another page   19
  loaded by no page           1   (first-run.js)
```

**The exclusions are correct by the stated rule** — `cut-view.js` is loaded by
MODEL *and* LAYOUT, `layout-plan.js` by LAYOUT only, so neither is "MODEL and
nothing else."

But the rule cuts the wrong way for one purpose. A module already used by two
pages is **evidence that it travels** — it has been proven outside MODEL by
running there. So the nineteen outside this gate are, for migration purposes,
the *safest* group, and the seventeen inside it are the ones needing a verdict.
The criterion is right; it just means this document answers half the question by
design, and the better half is already answered by the fact of a second caller.

**Where that stops being true is the captures.** `cut-view.js` carries three and
`layout-plan.js` one, and being shared did not protect them — LAYOUT lists its
scripts in an order that happens to work, exactly as MODEL does. So "proven by a
second page" proves the *logic* travels, not that the *loading* does.

### Three scopes, three right answers

The capture count was argued three ways before it was clear that each question
has its own number:

```
gate scope (the 17)        6 files,  9 captures
repo-wide, plain form      7 files, 10 captures
repo-wide, all shapes      8 files, 13 captures
```

Verdicts 6–10 rest on the first: `auto-stair`, `build-house`, `room-grow`,
`toy-constraints`, `toy-context` — all in scope, all plain, all measured. The
wider numbers change the size of the repo-wide fix, not those verdicts.

## Method note — a quieter failure than a collision

Verdict 2 needed one more measurement: whether a drafter can actually draw a
self-intersecting outline. I wrote that it was "the right next measurement".
Skipper read that as *Gilligan is running it* and stood down to avoid
duplicating the work. Neither of us ran it.

Two agents colliding on one file costs an afternoon and shows up in a diff.
**Two agents each assuming the other has it costs the measurement entirely and
shows up nowhere.** It was recoverable only because he said out loud what he
was standing down from.

The habit that fixes it, and it is cheap: **when you stand down, say what you
are not doing and why you believe it is covered.** Silence reads as coverage.

## Finding 2 — all seventeen load under plain `node`

Checked with `document` explicitly undefined:

```
areas.js            OK DraftAreas          4 exports
auto-dims.js        OK DraftAutoDims       1
auto-stair.js       OK DraftAutoStair      7
bone-wallet.js      OK DraftBoneWallet     9
build-house.js      OK DraftBuildHouse     4
gruff-drivethru.js  OK DraftGruffDrivethru 5
stair-rules.js      OK DraftStairRules    15
```

The other ten already had harnesses, so **every one of the seventeen is
node-loadable**. Where a module touches the browser it does so *inside a
function*, never at module scope — `pdf-scan.js` keeps its DOM in three of
seven exports, `bone-wallet.js` keeps `localStorage` inside two `try` blocks
and says so in its own header.

**What that means for the move:** the 20,000-line page needs a browser. Its
logic does not. A harness is available for every module in this set without
touching any of them, which makes "prove it before a new page references it"
a cheap instruction rather than an aspiration.

It is also the strongest evidence for the plan that I have measured. Rule 5 —
*new logic starts in a module* — was not a style preference; it is the reason
this migration is a re-render rather than a rewrite. That work was already
done, quietly, before anyone called it a strategy.

## Method note — two instrument errors, corrected

The first census of this table was wrong twice, and both are worth recording
because they are the failure this gate exists to catch:

- **Exports.** `grep '^\s*window\.Draft'` reported `electric-rules.js` as
  exporting nothing. It exports on a line beginning `if (...)`. A module was
  nearly filed as broken because of the shape of one line.
- **Coverage.** Grepping spec *contents* for a module's name reported
  `auto-dims.js` as having no specs. `tests/auto-dims.spec.js` exists and runs
  nine tests in 89 seconds. The file was there; the query could not see it.

Neither survived contact with a second look. Neither would have survived a
verdict that cited what it ran.
