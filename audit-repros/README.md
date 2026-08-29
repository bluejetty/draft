# audit-repros

Repro specs for the audit reports at the repo root. **Not part of the shipped
suite** — `playwright.config.js` has `testDir: './tests'`, so nothing here runs
in CI.

Run them against a static server on :4180 (the suite owns :4173):

```sh
python3 -m http.server 4180 --bind 127.0.0.1 &
npx playwright test -c audit-repros/pw.config.js
```

Several of these **fail on purpose**: they assert the behaviour the product
should have, so they are red until the defect is fixed. That makes them
regression tests as-is.

| spec | finding | expected today |
|---|---|---|
| `r1-layout-clobber.spec.js` | C3 LAYOUT overwrites the drawing | **fails** (9 lines → 8) |
| `r2-idempotence.spec.js` | generator idempotence | passes — BUILD HOUSE is byte-identical |
| `r4-undo-race.spec.js` | undo under key repeat | passes — no race found |
| `r6-level-delete.spec.js` | M5 orphans after a level delete | **fails** (1 orphan fenestration) |
| `r7-coordinate-corruption.spec.js` | M4 `num()` coerces null/""/false to 0 | **fails** (wall relocates to x=0) |
| `r8-error-containment.spec.js` | §6 no error boundary | passes, prints the evidence |
| `r9-offset.spec.js` | M6 offsetOutline degeneracies | passes, prints the rings |
| `r10-dim-sum.spec.js` | C1 through the UI | passes on this footprint, prints the strings |
| `r10b-dim-sum-pure.spec.js` | C1 through the production builder | passes, prints 39.5% mismatch |
| `r11-unicode.spec.js` | §5.2 smart punctuation | passes, prints the refusals |
| `r12-section-band-gap.spec.js` | C5 section band, detached garage | passes the gap check by luck of the gap detector — read the printed runs and `evidence/section-house-garage.png` |
| `r13-section-band-attached.spec.js` | C5 section band, attached garage | **fails** (main-floor band 597 px vs the storey above at 340 px) |
| `r14-level-model.spec.js` | §4.1 dynamic levels | passes — prints what a third storey and a deleted 2ND FL actually do |
| `r15-real-defaults.spec.js` | checklist 14, all defaults ON | passes — no interaction bug found |
| `r16-referential.spec.js` | checklist 11, orphans on delete | passes — cascades and refusals are correct |
| `r17-elevation-attached.spec.js` | renders an attached-garage E1 for inspection | passes |
| `r18-tour-abandon.spec.js` | checklist 5, tour abandonment | passes — prints the state each exit leaves |
| `r19-save-failure.spec.js` | §1.2 write failures | passes — MODEL recovers, LAYOUT loses the sheet silently |
| `r20-diagonal-cut.spec.js` | C6, first sighting | passes, prints roof-zone ink per angle |
| `r21-cut-angle-sweep.spec.js` | C6, angle sweep in the app | passes |
| `r22-cut-viewer.spec.js` | C6, rules out the viewer-side click | passes |
| `r23-roof-profile.spec.js` | C6, rules out `roofProfile` | passes |
| `r24-roof-drop.spec.js` | C6, the exact drift that drops the point | passes, prints the 1.58e-06 vs 1e-6 comparison |
| `r25-envelope-sweep.spec.js` | C6, 401 angles | passes, prints 58% / 29% / 13% |
| `r26-jog-merge.spec.js` | M7, the averaged jog coordinate | passes, prints 12'-0 3/4" between walls at 12'-0" and 12'-1 1/2" |
| `r27-dim-sum-app.spec.js` | C1 end to end in the app | passes, prints a live 1/16" mismatch on 1 of 4 traced houses |
| `p1`,`p3`,`p5`,`p6`,`p7`,`p8`,`p9`,`p10`,`p11`,`p12`,`p13`,`p14` | AUDIT-PERF measurements | pass, print numbers |

`evidence/` holds the two sections the app actually drew for C5:
`section-attached.png` (framed floor + label `11 7/8" TJI + 3/4" SHTG` across a
slab-on-grade attached garage, open storey drawn beneath it) and
`section-house-garage.png` (one continuous floor band from the house across six
feet of open ground to a detached garage). For C6 it holds
`diagonal-section-no-roof.png` and `diagonal-section-roof-ok.png` — the same
house, two cuts 0.9 degrees apart.
