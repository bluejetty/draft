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
| `p1`,`p3`,`p5`,`p6`,`p7`,`p8`,`p9`,`p10`,`p11`,`p12`,`p13` | AUDIT-PERF measurements | pass, print numbers |
