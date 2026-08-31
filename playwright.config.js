// @ts-check
const { defineConfig, devices } = require('@playwright/test');

const path = require('path');

// THE SUITE COULD TEST THE WRONG CHECKOUT AND PASS. Worth understanding before
// changing anything below.
//
// The web server is a plain static file server rooted in whichever directory
// it was launched from. With a fixed port and `reuseExistingServer` on, a
// suite started in checkout B finds the port already held by checkout A's
// server, attaches to it, and runs B's specs against A's FILES. It passes.
// Nothing in the output names the tree that was served, so that green is
// indistinguishable from a real one. Found while rebasing two branches in a
// second worktree: a fix under test was never loaded and the run reported
// success.
//
// A second worktree sets DRAFT_TEST_PORT and the collision is gone.
const PORT = Number(process.env.DRAFT_TEST_PORT) || 4173;

// NARROWING RATHER THAN VERIFYING, and this was a real choice.
//
// The tempting fix is to check the running server before reusing it — fetch a
// known file, compare it with the checkout. It does not hold up. Two worktrees
// of the same repo at the same commit serve byte-identical files, so a content
// check cannot tell them apart; it answers "same tree, safe to reuse" most
// confidently in precisely the situation it exists to catch — a second
// checkout, moments before someone edits it. A guard that is correct only
// until the first edit is worse than none, because it earns trust it will
// later betray.
//
// Nor can the server be asked what it is serving: `python3 -m http.server`
// reports its root nowhere over HTTP. Identifying the listening process and
// reading its working directory does work, but only on Linux with /proc, and a
// guard that silently degrades on a Mac is the same disease wearing a hat.
//
// So the rule is narrow and total: anyone who asks for their own port always
// gets their own server. The ordinary single-checkout habit is untouched, and
// reuse survives for the case it was added for — re-running one spec against
// an already-warm server.
const OWN_PORT = Boolean(process.env.DRAFT_TEST_PORT);

// AND SAY IT OUT LOUD. The whole failure was silent; one line ends that. It
// names the port and the directory this run intends to serve, and — when reuse
// is still on — says so, because with reuse on that intent is not a guarantee.
// Deliberately not a warning: Playwright's own server lingers between runs by
// design, so "port busy" is the normal case, and a guard that fires on the
// normal case is one people learn to skip past.
const REUSE = !process.env.CI && !OWN_PORT;

// Once per process. Playwright reads this config several times, and a
// module-level flag is per-load, so the guard has to outlive the module —
// hence the global symbol. It cannot dedupe further than that: the runner and
// the worker are separate processes and share no globals, so the line appears
// once from each. Two is tolerable; the dozen it would otherwise be is not.
const ANNOUNCED = Symbol.for('draft.testPortAnnounced');
if (!globalThis[ANNOUNCED]) {
  globalThis[ANNOUNCED] = true;
  console.log(`[draft] serving ${path.resolve(__dirname)} on http://127.0.0.1:${PORT}`
    + (REUSE
      ? ' — may reuse a server already on this port; set DRAFT_TEST_PORT for your own'
      : ' (own server)'));
}

module.exports = defineConfig({
  testDir: './tests',
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  // Stated, not inherited. Playwright's 30s default was set for an app that
  // waited on fonts.googleapis.com before it painted (audit M2, fixed by
  // self-hosting) — without that stall a spec that drives a whole house is
  // comfortably inside 30s, but the heaviest ones (a full BUILD HOUSE, a
  // save-and-reload, a section sweep) are not, and a slow CI box needs room
  // besides. 90s is that room; it is not a licence for a spec to sit and
  // wait, and a spec that needs more is a spec to look at, not to raise this
  // for.
  timeout: 90_000,
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    viewport: { width: 1280, height: 900 },
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: `python3 -m http.server ${PORT} --bind 127.0.0.1`,
    url: `http://127.0.0.1:${PORT}/index.html`,
    reuseExistingServer: REUSE,
  },
});
