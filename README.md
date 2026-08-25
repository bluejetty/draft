# Draft

A browser-based architectural drafting tool. No installs, no uploads — everything runs locally in the browser.

Built on the DC framework. Hosted on GitHub Pages.

See [ARCHITECTURE.md](ARCHITECTURE.md) for how the app is put together and [BRANCHING.md](BRANCHING.md) for the branch/merge rules.

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
- No network beyond localhost: all libraries are vendored in `vendor/`, so tests run fully offline once the browser is installed.

Run one file with `npx playwright test tests/underlays.spec.js`; add `--headed` to watch it. Traces are kept on failure (`trace: 'retain-on-failure'`) — open with `npx playwright show-trace`.

The suite is configured **serial on one worker** (`fullyParallel: false, workers: 1`). Each test clears its own storage on the way in (`helpers.openModel`), but the config is deliberate — don't add `--workers` parallelism without verifying the whole suite still passes repeatedly.

Every PR lands with the full suite green. Test files open with a prose header stating the behaviour they pin — read that before editing a test.
