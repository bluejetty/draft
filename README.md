# Draft

A browser-based architectural drafting tool. No installs, no uploads — everything runs locally in the browser.

Built on the DC framework. Hosted on GitHub Pages.

See [ARCHITECTURE.md](RD-DOCUMENTS/ARCHITECTURE.md) for how the app is put together and [BRANCHING.md](RD-DOCUMENTS/BRANCHING.md) for the branch/merge rules.

## Where the documentation is

**Everything written lives in [`RD-DOCUMENTS/`](RD-DOCUMENTS/).** The repository root is kept for the site itself — the pages, the modules, and the folders they need — because GitHub Pages serves it directly with no build step, so anything at root is live. This README is the one document that stays, since GitHub shows it as the front page.

| | |
|---|---|
| [`DEEP-CLEANUP-ITEMS.md`](RD-DOCUMENTS/DEEP-CLEANUP-ITEMS.md) | work deliberately left for a deep clean, with the traps already mapped |
| [`DEFINITIONS.md`](RD-DOCUMENTS/DEFINITIONS.md) | **what our words mean here** — the terms we use in a particular way, and the ones that collide |
| [`IMPORTANT-WORK-ORDERS/`](RD-DOCUMENTS/IMPORTANT-WORK-ORDERS/) | what is being built now — TOY MODE's status, the turtle path, how the boneyard works |
| [`ARCHITECTURE.md`](RD-DOCUMENTS/ARCHITECTURE.md) · [`BRANCHING.md`](RD-DOCUMENTS/BRANCHING.md) · [`REFACTOR-PLAN.md`](RD-DOCUMENTS/REFACTOR-PLAN.md) | how the app is put together, how work lands, and why `MODEL.dc.html` is the shape it is |
| [`BOARDS.md`](RD-DOCUMENTS/BOARDS.md) and the `BOARD-*` files | the shared work list, and the boards written up in full |
| [`HANDOFF-SKIPPER.md`](RD-DOCUMENTS/HANDOFF-SKIPPER.md) | who is who, the standing constraints, and the traps a session actually hit — read before the boards |
| [`SPECIFICATIONS/`](RD-DOCUMENTS/SPECIFICATIONS/) | the written half of a *drawing set* — product content, not software specs |
| [`BUILDING-CODES/`](RD-DOCUMENTS/BUILDING-CODES/) | the national code PDFs the rules are drawn from |
| [`DOG-EMPLOYEES/`](RD-DOCUMENTS/DOG-EMPLOYEES/) · [`LORE/`](RD-DOCUMENTS/LORE/) · [`ADVERTISEMENT/`](RD-DOCUMENTS/ADVERTISEMENT/) | the dogs, the history, and the advertising |

Nothing in the app loads a document at runtime — no `fetch`, no `src`, no `href` points at one — so documents can be reorganised without touching the site. Where code names a document it is in a comment, and those are repointed when a file moves.

Copyright (c) 2026 bluejetty. All rights reserved. This code is publicly viewable but proprietary — see [LICENSE](LICENSE).

## Running the tests

The suite is end-to-end Playwright: it serves the repo over plain HTTP and drives the real pages in Chromium. There is no unit-test layer and no build step.

```sh
npm install                       # @playwright/test (pinned in package.json)
npx playwright install chromium   # once per machine, downloads the browser
npm test                          # full suite (784 tests, one worker, serial)
```

Requirements:

- **Node 18+** and **Python 3** — the Playwright config starts `python3 -m http.server 4173` itself as its web server (it reuses an already-running server locally; in CI, when `CI` is set, it always starts its own).
- **Chromium via Playwright** — the pinned `@playwright/test` version wants its matching browser build, hence `npx playwright install chromium`. On CI images with browsers pre-provisioned, set `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1` and point `PLAYWRIGHT_BROWSERS_PATH` at them instead.
- **Headless-capable Linux needs Chromium's system deps** (`npx playwright install-deps chromium` on Debian/Ubuntu). No display server is required.
- No network beyond localhost: all libraries **and the fonts** are vendored in `vendor/`, so tests run fully offline once the browser is installed. `tests/no-third-party.spec.js` holds that line — it fails if any page requests a host other than the one it was served from.

Run one file with `npx playwright test tests/underlays.spec.js`; add `--headed` to watch it. Traces are kept on failure (`trace: 'retain-on-failure'`) — open with `npx playwright show-trace`.

The suite is configured **serial on one worker** (`fullyParallel: false, workers: 1`), and the config **refuses** a `--workers` override outright — a throw, not a warning. Every spec shares one origin, and `helpers.openModel` clears `localStorage` and deletes the shared IndexedDB on the way into each test, so parallel workers on one machine wipe each other's storage mid-test. The failures that produces look like real bugs — null or stale reads from `savedDrawing()`, a dismissed entry coach that comes back and swallows every click — and on 9 Sep 2026 they cost a day and three boards. To go parallel, **shard** instead (`npx playwright test --shard=1/4`): a shard gets its own runner and therefore its own origin, which is the only way to have both.

**Resolve, push, then run.** The suite is serial and takes about an hour. A branch that exists only in a session container for that hour is one restart from gone — a worktree was already lost to a box restart. Pushing first costs seconds, turns a restart into a re-run rather than a loss, and lets the diff be reviewed while the suite is still running instead of after it.

Pushing is not merging. The PR still waits on a green run.

**A mutation run measures the tree you handed it, not the tree you meant.** Breaking a line on purpose to watch a test go red is the only way to know a check *can* fail, and it is the standing evidence for any claim that a test pins something. But every harness fault found here so far has been the same fault wearing a different face — not a wrong mutation, but the tree under test not being the tree you think — and each one ends the same way: the run completes, prints a plausible number, and the number is about a tree nobody intended. Four ends to hold shut:

- **Commit before each run.** `git checkout -- FILE` restores HEAD, not your working state, so it silently drops the very fix the mutants were meant to be probing. A hand-rolled backup fails from the other side: on 10 Sep 2026 a `cp /tmp/geo.bak geo` wrote to a new file literally named `geo`, the mutation never reverted, and the next mutant stacked on the last — the tell was failure counts that climbed instead of repeating.
- **Assert the anchor matches exactly one site, and fail loudly when it doesn't.** A four-space anchor also matches a six-space line that contains it as a substring. On 10 Sep 2026 that made a stair mutant report SURVIVED when the substitution had in fact raised and never applied; the suite had run on clean code.
- **Verify the mutation is present in the file before running the tests.** This is the cheap check that catches both faults above and any future member of the family — read the line back and confirm it changed. A survivor you cannot prove was ever applied is not a survivor.
- **A mutation that deletes rather than moves is somebody else's mutant.** Deleting a call when you meant to relocate it usually reproduces an earlier mutation exactly, so two rows of the table describe one experiment run twice, and the behaviour you thought you covered was never touched.

Both crews on this repo hit the first two of these independently on 10 Sep 2026 — different harnesses, different files, the same two faults within an afternoon of each other. That is the argument for the note living here rather than in either harness.

A surviving mutant is a finding only once these four hold. Until then it is a report about the harness.

`tests/helpers.js` is the suite's vocabulary: `openModel` (boot + storage reset, optional `{ webgl: false }` for the 2D fallback), `worldToClient`/`clickWorld`/`moveTo` (world-feet in, real mouse events out), `selectTool`, `waitForSaved` (autosave settle), `savedDrawing` (reads the drawing JSON back out of IndexedDB — assert against this, not the DOM), and `overlayPixels`/`countColor` (pixel assertions on the overlay canvas).

To poke at the app by hand, serve the repo root with any static server — `python3 -m http.server 8000` — and open `/MODEL.dc.html`. (The suite runs its own server on port 4173; the two don't conflict.)

Every PR lands with the full suite green. Test files open with a prose header stating the behaviour they pin — read that before editing a test.

### A new default-on feature ships with its combination test

`helpers.openModel` seeds the suite a fat bone wallet and turns the newest
default-ON features OFF — the bone reveal and stair suggestions — so that
specs written before them still test what they were written to test. It is a
fair accommodation, and it means most of the suite runs a configuration no
user has: a feature that misbehaves only *alongside* another one has nothing
watching for it.

`tests/defaults.spec.js` is what watches. It opts into nothing, seeds nothing,
and walks one drafter's path through the shipping configuration — trace →
foundation → the suggested stair → rooms → roof → the bone → a LAYOUT sheet.

**So: when a feature lands ON by default, give it its place on that path in
the same PR.** If it changes what the drafter sees there, it belongs in that
spec; if adding it there turns out to be awkward, that awkwardness is the
finding — write it up rather than working around it.
