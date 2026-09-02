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

## Verdict 2 — `areas.js`: **right but unclear**

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
