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

// AND THE SAME CLASS OF FAILURE, FROM THE OTHER DIRECTION: A RED THAT ISN'T
// REAL. `workers: 1` below is not timidity, and the reasons are already
// written down twice — test.yml:226 and README.md:51. Every spec shares one
// origin, so every spec shares one localStorage and one IndexedDB, and
// helpers.openModel clears BOTH on the way into every test. Two workers on
// one machine therefore delete each other's storage mid-test.
//
// MEASURED, on 9 Sep 2026, because a whole day went into it. A suite run at
// --workers=4 produced seven distinct red names across two machines. Every
// one of them was the clobber, in one of two shapes:
//
//   indexedDB.deleteDatabase  -> savedDrawing() reads null, or the pre-edit
//                                value from a store recreated behind it
//   localStorage.clear()      -> `draft-entry-coach-seen` is wiped mid-test,
//                                the dismissed coach returns, and it eats
//                                every click until the 180s budget is gone
//
// The same suite, same tree, at the configured default: 979 tests, ZERO
// failures. Not one of the seven was a defect. Three boards were opened on
// that evidence and all three closed void, and a product change to four
// pages was one step from being written to fix a race that did not exist.
//
// A THROW, NOT A WARNING. The whole cost of that day was that the failures
// looked exactly like real ones and nothing said otherwise. A warning scrolls
// past in a log nobody reads until something is already wrong; this has to
// stop the run in the first second, before anyone has a red suite to explain.
//
// SHARDING IS THE SUPPORTED WAY TO GO PARALLEL, and it is untouched: a shard
// gets its own runner and therefore its own origin, which is the only way to
// have both. CI's `--shard=N/6` inherits workers: 1 and never reaches this.
const workerOverride = (() => {
  const argv = process.argv;
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    const value = arg === '--workers' || arg === '-j' ? argv[i + 1]
      : arg.startsWith('--workers=') ? arg.slice('--workers='.length)
      : arg.startsWith('-j=') ? arg.slice('-j='.length)
      : null;
    if (value == null) continue;
    // Playwright takes a count or a percentage of the machine's cores. Resolve
    // both to the number of workers that would actually run, because "50%" on
    // a four-core box is the same mistake spelt differently.
    const percent = /^(\d+(?:\.\d+)?)%$/.exec(String(value).trim());
    const resolved = percent
      ? Math.max(1, Math.floor(require('os').cpus().length * Number(percent[1]) / 100))
      : Math.floor(Number(value));
    if (Number.isFinite(resolved) && resolved > 1) return { asked: String(value), resolved };
  }
  return null;
})();
if (workerOverride) {
  throw new Error(
    `[draft] REFUSING --workers=${workerOverride.asked} (${workerOverride.resolved} workers).\n`
    + '\n'
    + 'This suite is serial on purpose. Every spec shares one origin, and\n'
    + "helpers.openModel clears localStorage and deletes the shared IndexedDB on\n"
    + 'the way into each test — so parallel workers on one machine wipe each\n'
    + "other's storage mid-test. The failures that produces look like real bugs:\n"
    + 'null or stale reads from savedDrawing(), and a dismissed entry coach that\n'
    + 'comes back and swallows every click. On 9 Sep 2026 that cost a day and\n'
    + 'three boards, and the same suite passed 979/979 serially.\n'
    + '\n'
    + 'See test.yml:226 and README.md:51.\n'
    + '\n'
    + 'To go parallel, shard instead — a shard gets its own runner and its own\n'
    + 'origin, which is the only way to have both:\n'
    + '\n'
    + '    npx playwright test --shard=1/6\n');
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
  // besides.
  //
  // IT WAS 90s AND 90s WAS NOT ENOUGH. The old comment said "a spec that needs
  // more is a spec to look at, not to raise this for", so it was looked at
  // (BOARD-test-budget.md, 6 Sep) and the finding was that the heaviest
  // MODEL.html specs pass with no margin rather than by a comfortable amount.
  // Two independent things then push them over: added latency on a slower
  // machine, and contention when the shards share one box. Neither is the
  // spec's fault and neither is fixable by looking at it harder.
  //
  // THE MEASUREMENT, one line changed and nothing else:
  //
  //   base 3223d79 @  90s  ->  2 failed, 2 failed, 1 failed
  //   base 3223d79 @ 180s  ->  0 failed, 0 failed, 0 failed
  //
  // Same tree, same box, same worker count, three runs each way, and every
  // 180s run finished at CLEAN-RUN DURATION -- nothing crept in at 170, which
  // is what a merely-slow suite would look like. A delay has a length; a wedge
  // does not. This one had a length.
  //
  // 180s BECAUSE IT IS THE VALUE THAT WAS MEASURED. Somewhere between 90 and
  // 180 is the real line and nobody has found it; picking 120 would be a guess
  // wearing a number. The cost of the larger ceiling is small and one-sided --
  // a PASSING test does not consume its timeout, so this only changes how long
  // a genuinely broken one takes to report.
  //
  // WHAT IT IS STILL NOT. Not a licence for a spec to sit and wait. The real
  // fix is to make the heavy specs cheaper -- they each rebuild the same house
  // -- and that stays on the board. This stops the suite failing honest work
  // in the meantime: CI failed a spec on #313 that that PR's diff could not
  // reach, which cost a comment, a re-run, and twenty minutes of doubt.
  timeout: 180_000,

  // THE RUN REPORTS EVEN WHEN IT OVERRUNS. Ruled by Movie, 15 Sep: "a hung
  // test must fail by name, under the job limit, not cancel the shard".
  //
  // WHAT HAPPENED, because the mechanism is not the obvious one. On 14 Sep CI
  // shard 3 was CANCELLED at its 40-minute job cap on two consecutive runs and
  // reported no failure text at all -- a grey badge, which I twice read as
  // inconclusive. Behind it were fifteen tests waiting on controls that §6
  // correctly puts away on a TOY board, and twenty real failures in total.
  //
  // THE PER-TEST TIMEOUT WAS NOT THE FAULT and is not touched here. Each of
  // those fifteen DID fail by name at 180s, exactly as designed. What broke is
  // that fifteen times 180s is forty-five minutes, so the RUNNER killed
  // Playwright before the reporter could say any of it. A cancelled job
  // reports nothing, which is why nothing on the PR named a cause.
  //
  // Lowering `timeout` would be the wrong fix twice over: it is the value
  // measured in BOARD-test-budget.md (90s gave 2/2/1 failures across three
  // runs, 180s gave zero), and it would trade a silent overrun for false reds
  // on honest work -- the "a red that isn't real" failure this file already
  // spends forty lines guarding against.
  //
  // So the ceiling goes on the RUN instead. Playwright stops itself at
  // globalTimeout and prints what it has, with names; the job cap (raised to
  // 45m in test.yml) now sits above that, so the runner never takes the
  // reporter down mid-sentence. Red and legible beats grey and silent.
  //
  // 35 MINUTES, AGAINST MEASURED DURATIONS rather than a round number. The
  // slowest honest shard is shard 1 at 26.5m (14 Sep) and 27m (15 Sep), on
  // CI's own boxes. 35 leaves eight minutes over the worst real run and still
  // ends ten minutes inside the job cap. Raising `timeout` or adding heavy
  // specs eats that margin, so the two numbers are stated together and move
  // together.
  //
  // AND ON 22 SEP ADDING SPECS ATE IT, exactly as that sentence says. Shard 1
  // of four hit this ceiling twice in one day -- once with 368 passed and 23
  // never run -- after climbing 26.5m, 27m, 33.6m. THIS NUMBER WAS NOT THE ONE
  // THAT MOVED: lifting it would have bought green by making a hung run take
  // longer to speak, which is the property Movie ruled on and the whole reason
  // it is here. The WORK came down instead -- test.yml went from four shards
  // to six, and the arithmetic is written out there. 35 is left where it was
  // measured, and it is still the thing that will say so next time the margin
  // goes.
  globalTimeout: 35 * 60_000,

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
