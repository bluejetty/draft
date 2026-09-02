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

## Finding 1 — `pdf-scan.js` is the only unproven module

185 lines, no harness, no spec file, and no spec anywhere names `DraftPdfScan`.
It also touches the DOM, so it is not node-testable as it stands.

This is the one module that cannot be carried across on evidence, because there
is none. It is not a claim that it is broken — it is a claim that nobody can
say either way, which is the same problem a new page would inherit.

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
