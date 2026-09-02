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
precondition shared by every path that accepts a drafted outline. Whether a
drafter can actually draw one remains unproven — the same INFERRED that M6
carried, and the right next measurement rather than the right next assumption.

**Recommended, not done here:** `areas.js` has a spec but no harness, and its
spec costs 92 seconds in a browser to prove arithmetic that node settles in
milliseconds. A harness of the table above is the cheaper guard.

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
