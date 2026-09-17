# Running the harnesses

The Node harnesses under `proto/`. For the Playwright suite see
[README.md](../README.md#running-the-tests) — different tool, different rules,
and nothing here applies to it.

Everything below was run on 17 Sep 2026 on a Linux container with **no
`node_modules` present**. Where a number is quoted it was measured
then, not remembered.

## The one command

```sh
node proto/areas-harness.js        # one harness
```

No install, no server, no browser. A harness reads `fs`, `path`, `vm` and
files in this checkout, and nothing else — which is why the CI job that runs
all of them finishes in seconds while the suite is still installing Chromium.

All of them, the way CI does it:

```sh
for h in proto/*-harness.js; do node "$h" >/dev/null 2>&1 \
  && echo "ok    $h" || echo "FAIL  $h ($?)"; done
```

42 harnesses, 3.1 s wall clock, all green.

## Exit codes

| | |
|---|---|
| `0` | the checks passed |
| `1` | the checks failed — a real finding |
| `2` | **you typed it wrong** — an argument the harness does not accept |

The 2 is load-bearing and `proto/harness-args.js` explains why: a step that
cannot tell "you typed it wrong" from "the code is broken" will eventually
report the first as the second.

The exception is a **bad file path in a positional argument**, which arrives
as an uncaught `ENOENT` and therefore exits **1**, not 2. A harness that dies
in a stack trace ending in `path: '…'` is telling you about your command line,
not about the code.

## Flags

Three shapes, and which one a harness has is not guesswork — it is the line it
calls from `proto/harness-args.js`:

- `noFlags()` — takes nothing at all. `--mutate` here is exit 2, deliberately:
  accepting a flag the file has no code to act on prints a green run for a mode
  that never happened.
- `mutationMode()` — accepts `--mutate` or `--coverage`, which are the same
  mode spelled two ways. This is the marker that makes a file an *engine*.
- `optionalPositional()` — takes one optional file and no flags, flags
  rejected first so a flag can never be read as a filename.

The engines, derived rather than listed:

```sh
for h in proto/*-harness.js; do
  grep -qF "harness-args.js').mutationMode()" "$h" && node "$h" --mutate
done
```

11 of the 42 on the day this was written. CI derives the same list the same
way and then checks it still contains four engines it names by hand — a floor,
so that a rename or a moved `require` goes red instead of silently dropping an
engine from a green run.

**`render-2d-harness.js --mutate` gates on two things at once.** It exits
non-zero when a mutant survives *and* when a painter has no checks, so a red
from that line may be a coverage failure wearing a mutation failure's clothes.
Read the `painters have checks` line before the mutation rows.

## Working directory and file paths

**Every harness resolves its subject from `__dirname`, never from
`process.cwd()`.** All three of these are the same run:

```sh
node proto/areas-harness.js                 # from the repo root
cd tests && node ../proto/areas-harness.js  # from anywhere in the tree
node /somewhere/draft/proto/areas-harness.js # from /tmp, absolute
```

Verified by running them. There is no `cd` step to remember and no
`DRAFT_ROOT` to set.

That rule is written down because it was once broken. Two harnesses required
their subjects by absolute path — `/home/user/draft/palette.js` — which
resolves on exactly one machine. CI checks out to
`/home/runner/work/draft/draft`, so both would have failed there with
`MODULE_NOT_FOUND` on the first run. Both are fixed;
`.github/workflows/test.yml` keeps the record. **Do not write an absolute path
in `proto/`.** `path.join(__dirname, '..')` is the repo root, and the fixtures
sit beside the harnesses at `path.join(__dirname, 'repro-L-house.draft')`.

The **one** cwd-relative path in `proto/` is the optional positional argument,
because it is something you typed:

```sh
node proto/elevation-harness.js proto/repro-L-house.draft        # ok from the root
cd tests && node ../proto/elevation-harness.js proto/repro-…     # ENOENT, exit 1
```

**A harness never writes to disk.** No `*-harness.js` calls `writeFileSync`,
`mkdirSync` or `execSync`, and `git status --porcelain` is empty after a full
plain run plus every engine's `--mutate`. The mutation engines apply their
mutants to source text held in memory, so a harness run cannot cost you your
working tree. The `*-mutants.js` drivers are the opposite case — see below.

## Where local and CI differ

For the harness job: **almost nowhere, by construction.** No harness reads a
single environment variable, so nothing CI sets — `CI`, the runner's paths,
anything — can change a harness result. Two differences are real:

- **Node version.** CI pins **Node 20** (`setup-node`, deliberately held there
  as the version this code is tested against). Your machine is whatever you
  have; this container is v22.22.2. Nothing in `proto/` is version-sensitive
  today, but a failure that reproduces on only one of the two is worth
  re-running under 20 before it is filed.
- **The empty-glob check.** CI fails the job when `proto/*-harness.js` matches
  nothing, because a loop that matches nothing passes. The hand-rolled loop
  above does not, so if you rename the files it will cheerfully print nothing
  and look fine.

The hyphen in `*-harness.js` is the membership test: `proto/harness-args.js`
is a module, not a harness, and running it directly exits 0 having asserted
nothing. That is why it is excluded by its name rather than by a list someone
has to maintain.

## The scripts CI never runs

Everything in `proto/` that is *not* `*-harness.js` is outside both CI steps,
and each one asks more of you than a harness does:

| | what it needs |
|---|---|
| `*-mutants.js` (16 of them) | `npm ci`, Chromium, and a **clean working tree** |
| `perf-bungalow-*.js`, `tool-column-occlusion.js` | `npm ci`, Chromium, and **a server you started yourself** |
| `w0-census.js` | nothing — read-only, like a harness |
| `w0-census-diff.js` | nothing, but takes two `w0-census.js --json` outputs as arguments |

One harness does look at the drivers: `mutant-anchors-harness.js` reads their
mutation tables as data and checks that every anchor still occurs in its
subject exactly once, that each `with` differs from its `find`, and that each
`test` grep still matches a title. It never runs a mutation, so it stays in
the cheap CI job — but it means a dead anchor now goes red on a push rather
than waiting for someone to run the expensive gate by hand.

**The `*-mutants.js` drivers edit your real files.** Each one writes a mutant
into a source file on disk, shells out to `npx playwright test`, and restores
with `git checkout -- <file>`. That restores **HEAD**, not your working state:
uncommitted work in a mutated file is gone, without a prompt.

All 16 refuse to start against a dirty tree for that reason:

```
REFUSING TO RUN: uncommitted changes; this restores from HEAD.
```

Three of them — `corner-glow-mutants.js`, `level-lock-port-mutants.js` and
`units-stack-mutants.js` — did not, until 17 Sep 2026. They restored from HEAD
like the others and checked nothing first, and each already printed a
`REFUSING TO RUN:` line for a *different* guard (the spec was red before any
mutant ran), so they read as protected when they were not.

The guard goes **before** each driver's baseline run, not after. The baseline
is a full Playwright pass of the spec — minutes — so a guard behind it lets
you walk away believing the gate is running when it has already refused.

Commit before you run one anyway. The README's four rules for reading a mutation run
([README.md](../README.md#running-the-tests)) apply to these, not to the
in-memory engines above.

**The measurement scripts do not start a server.** They read
`BASE_URL` and default to `http://localhost:4173`, so serve the repo root
first:

```sh
python3 -m http.server 4173 &
node proto/perf-bungalow-paint.js
```

Note that `BASE_URL` and the suite's `DRAFT_TEST_PORT` are **separate knobs**.
Setting `DRAFT_TEST_PORT` moves the Playwright suite's server and leaves these
scripts pointed at 4173. Three of the mutants drivers pin their own
`DRAFT_TEST_PORT` (4321, 4344, 4345) so that they always get a server of their
own rather than attaching to whichever checkout happens to hold 4173 — the
failure `playwright.config.js` opens by describing.

These scripts also **write their results into the repo**
(`proto/perf-bungalow-paint.json` and its sibling), so a run leaves a diff.
That is intended — the numbers are committed next to the prose in
[MEASURE-perf-bungalow-paint.md](MEASURE-perf-bungalow-paint.md) — but check
before you commit it that you meant to re-measure.
