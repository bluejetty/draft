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
