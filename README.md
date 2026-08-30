# Draft

A browser-based architectural drafting tool. No installs, no uploads — everything runs locally in the browser.

Built on the DC framework. Hosted on GitHub Pages.

See [ARCHITECTURE.md](ARCHITECTURE.md) for how the app is put together and [BRANCHING.md](BRANCHING.md) for the branch/merge rules.

Copyright (c) 2026 bluejetty. All rights reserved. This code is publicly viewable but proprietary — see [LICENSE](LICENSE).

## Running the tests

The suite is end-to-end Playwright: it serves the repo over plain HTTP and drives the real pages in Chromium. There is no unit-test layer and no build step.

```sh
npm install                       # @playwright/test (pinned in package.json)
npx playwright install chromium   # once per machine, downloads the browser
npm test                          # full suite (360 tests, one worker, serial)
```

Requirements:

- **Node 18+** and **Python 3** — the Playwright config starts `python3 -m http.server 4173` itself as its web server (it reuses an already-running server locally; in CI, when `CI` is set, it always starts its own).
- **Chromium via Playwright** — the pinned `@playwright/test` version wants its matching browser build, hence `npx playwright install chromium`. On CI images with browsers pre-provisioned, set `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1` and point `PLAYWRIGHT_BROWSERS_PATH` at them instead.
- **Headless-capable Linux needs Chromium's system deps** (`npx playwright install-deps chromium` on Debian/Ubuntu). No display server is required.
- No network beyond localhost: all libraries **and the fonts** are vendored in `vendor/`, so tests run fully offline once the browser is installed. `tests/no-third-party.spec.js` holds that line — it fails if any page requests a host other than the one it was served from.

Run one file with `npx playwright test tests/underlays.spec.js`; add `--headed` to watch it. Traces are kept on failure (`trace: 'retain-on-failure'`) — open with `npx playwright show-trace`.

The suite is configured **serial on one worker** (`fullyParallel: false, workers: 1`). Each test clears its own storage on the way in (`helpers.openModel`), but the config is deliberate — don't add `--workers` parallelism without verifying the whole suite still passes repeatedly.

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
