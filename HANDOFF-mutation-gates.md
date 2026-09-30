# Handoff — the 303 mutation gates nothing runs

Written 2026-09-30. **This supersedes the version pushed to
`claude/relaxed-darwin-w9843d` earlier, which said 139 rows measured.** That
figure was written while a container restart had hidden most of the log; the
log survived and the real count is below.

## Read this first if you are the session picking this up

**ALL 303 ROWS ARE MEASURED. Do not re-measure.** Every one of the 25 gates
has been run; the per-gate table is below and it is complete.

**292 killed, 11 survivors — a 96.4% kill rate.** The work that remains is
fixing the 11, not finding them.

## Where the repo stands

- Branch `claude/relaxed-darwin-w9843d` sits on `main` at the **#561 merge**.
  Seven PRs merged that session: #555–#561.
- If `git status` shows a one-line change to a source file, it is a mutation
  gate's leftover sabotage from a container restart mid-row. Throw it away
  with `git checkout -- .` — it is not work.

## The finding

`proto/*-mutants.js` — **25 files, 303 rows.** Each row bends ONE line of a
real source file, runs the check that should notice, restores the line, and
reports KILLED or SURVIVED.

**CI runs none of them.** No workflow mentions `mutants`. The only thing that
reads them is `proto/mutant-anchors-harness.js`, and it only confirms their
anchors still MATCH — it never asks whether they still KILL. So 303
carefully written gates are write-only, and the kills they claim were true
the day each was written and unverified since.

Several were demonstrably run by hand exactly once.
`proto/edge-on-loop-harness.js` has two checks whose comments say so;
`proto/areas-harness.js` has one; `proto/auto-stair-mutants.js` carries
*"THIS READ `const pool = bodies` AND IT SURVIVED"*. Real work, run once,
re-run never. Drift is the expected failure mode and it grows with age.

## Results: 303 of 303 rows, 292 killed, 11 survivors (3.6%)

| gate | rows | killed | time | driver |
|---|---|---|---|---|
| `auto-beam` | 22 | 22 | 541s | playwright |
| **`auto-piles`** | 26 | **24** | 215s | playwright |
| **`auto-stair`** | 15 | **11** | 273s | playwright |
| `board-zones` | 6 | 6 | 41s | playwright |
| `boneyard` | 11 | 11 | 241s | playwright |
| `corner-glow` | 4 | 4 | 33s | playwright |
| `drafting-brush` | 18 | 18 | 159s | playwright |
| `foot-light` | 9 | 9 | 48s | playwright |
| `layout-record` | 12 | 12 | **1s** | harness |
| `layout-record-spec` | 7 | 7 | 227s | playwright |
| `level-lock-port` | 9 | 9 | 65s | playwright |
| **`pad-footing`** | 7 | **3** | 186s | playwright |
| `shared-shell` | 11 | 11 | **8s** | harness |
| `structure-place` | 11 | 11 | 80s | playwright |
| `tool-assembly` | 12 | 12 | 76s | playwright |
| **`tool-boards`** | 23 | **22** | 134s | playwright |
| `tool-column` | 6 | 6 | 32s | playwright |
| `tool-select` | 17 | 17 | 108s | playwright |
| `toy-board` | 17 | 17 | 107s | playwright |
| `toy-bone` | 10 | 10 | 76s | playwright |
| `toy-break` | 13 | 13 | 75s | playwright |
| `toy-drag` | 15 | 15 | 393s | playwright |
| `toy-draw` | 9 | 9 | 80s | playwright |
| `toy-roof` | 8 | 8 | 52s | playwright |
| `units-stack` | 5 | 5 | 39s | playwright |

**Total: 303 rows, 292 killed, 11 survivors.** Whole set took about 55
minutes of Playwright plus 9 seconds of harness. Rate is ~12-26s per
Playwright row; `toy-drag` is the slowest gate at 393s for 15 rows and is NOT
hanging, which is worth knowing because it looks like it is.

## The 11 survivors — this is the job

### `pad-footing-mutants.js` — 3/7, the worst gate found

- *the buried pad is drawn on every plan, not just the foundation*
- *piles get pads too, so every hole grows a rectangle*
- ***THE DEFECT THIS FIXED**: every pile back to one hard-coded diameter*
- *an unknown footing resolves to a pile rather than the standard pad*

### `auto-stair-mutants.js` — 11/15

- *the upper flight is placed free instead of over the one below*
- *the well is never nudged off the beams carrying the floor*
- *dc's own defect restored: only the level's OWN floor view is searched, so
  the generated beams are invisible and the check passes on an empty list*
- *the hole is cut out of a poured slab*

Note: the first three rows of this gate were re-aimed in #560 (dead anchors
that edited nothing) and all three now come back KILLED. That work stands.
These four are the pre-existing survivors flagged at the time.

### `auto-piles-mutants.js` — 24/26

- *the close pair is merged but the survivor keeps one corner instead of
  standing between them*
- *no dedup, so every corner is piled twice (the one the harness caught)*

### `tool-boards-mutants.js` — 22/23

- ***THE BUG ITSELF**: a board change rebuilds the slot and wipes its
  neighbours*

## How to approach the fixes

**Check first whether the row is aimed at the wrong instrument.** The
`auto-piles` dedup row names itself: *"(the one the harness caught)"* — the
author's own parenthetical says a HARNESS catches it, while the row points
its `test` field at a Playwright spec. That is a misaimed row, not a coverage
hole, and re-pointing it is the whole fix. Check all 11 for this shape before
writing a single new test.

**Notice the pattern in the names.** Two survivors are marked by their
authors as the specific defect the feature exists to prevent — *"THE DEFECT
THIS FIXED"* in `pad-footing`, *"THE BUG ITSELF"* in `tool-boards`. Those are
the rows that matter most: the gate has lost hold of the exact bug it was
written for.

**If a row is genuinely uncaught,** strengthen the check it points at rather
than weakening the row. Never re-aim a row at a check that already passes for
another reason — that is how a gate becomes green while measuring nothing,
which is the failure this whole exercise is about.

## The runner

Save outside the repo and run. **Resumable**: a gate whose `===== name` line
is already in the log is skipped, so a container restart costs one gate
rather than the whole run. This matters — it happened twice.

```bash
#!/bin/bash
# Run every *-mutants.js gate not already recorded in the log, one at a time.
#
# THEY EDIT REAL SOURCE FILES and restore with `git checkout --`, so they
# cannot overlap, and a dirty tree between gates means the previous one did
# not clean up -- which is what a restart mid-row leaves behind. That is a
# stop, not something to work around: the leftover is a deliberate sabotage
# and every row run against it would measure a poisoned tree.
cd /home/user/draft
LOG="$1"
touch "$LOG"
for f in proto/*-mutants.js; do
  base=$(basename "$f" -mutants.js)
  grep -q "^===== $base " "$LOG" && continue
  dirty=$(git status --porcelain)
  if [ -n "$dirty" ]; then
    echo "!!! STOPPING before $base: tree is dirty" >> "$LOG"
    echo "$dirty" >> "$LOG"
    exit 1
  fi
  s=$SECONDS
  out=$(node "$f" 2>&1); code=$?
  score=$(echo "$out" | grep -oE "[0-9]+/[0-9]+ killed" | tail -1)
  echo "===== $base  [$score]  exit=$code  $((SECONDS-s))s =====" >> "$LOG"
  echo "$out" | grep -E "SURVIVED|AMBIGUOUS|SKIPPED|baseline.*fail" >> "$LOG"
  echo >> "$LOG"
done
echo "ALL DONE" >> "$LOG"
```

Operational notes, all learned the hard way:

- **`npm ci` first.** A fresh container has no `node_modules` and the
  Playwright-driven gates fail instantly without it.
- **Do not touch any repo file while it runs.** The runner stops on a dirty
  tree, and the gates' `git checkout --` would clobber your edits.
- **The stop hook fires every turn** saying there are uncommitted changes.
  That is the live sabotage. **Do not commit it** — it would poison the
  baseline for every remaining row.
- **Do not edit `~/.claude/stop-hook-git-check.sh` while a run is live.**
  Doing so trips a self-modification classifier that then blocks ordinary
  `git status` calls for several turns. If you want the guard, add it before
  starting. It does not survive a container restart anyway, since it is
  outside the repo.

## The free win: two gates are cheap enough for CI today

Of the 25, **23 drive Playwright (280 rows, ~55 min)** and **2 drive a
harness (23 rows, 9 seconds combined — measured)**:
`layout-record-mutants.js` (12 rows, 1s) and `shared-shell-mutants.js`
(11 rows, 8s). Both came back perfect.

`shared-shell-mutants.js` says so in its own header:

> IT RUNS THE HARNESS, NOT A SPEC, so the whole gate is seconds rather than
> minutes. That is worth saying because the other mutation engines in this
> directory drive Playwright and take long enough that nobody runs them
> casually. **This one has no excuse.**

Wiring those two into CI is not a new idea — the code asks for it. Drafted
and never applied, because a live gate run locks the tree. Goes in
`.github/workflows/test.yml` inside the `harnesses` job, after the existing
engine step:

```yaml
      - name: Run the mutation gates that drive a harness
        run: |
          # TWENTY-FIVE GATES EXIST AND THIS JOB RAN NONE OF THEM. Each
          # proto/*-mutants.js file bends one line of a real source file, runs
          # the check that should notice, and restores -- 303 rows in all. Only
          # mutant-anchors-harness read them, and only to confirm their anchors
          # still MATCH; nothing ever asked whether they still KILL. Measured
          # 30 Sep over 266 rows: 11 survivors, worst is pad-footing at 3/7.
          #
          # TWO OF THE TWENTY-FIVE DRIVE A HARNESS AND NOT A SPEC, and those
          # two are what this step runs. shared-shell-mutants.js says why in
          # its own header -- "the whole gate is seconds rather than minutes...
          # THIS ONE HAS NO EXCUSE." Measured: 23 rows, 9 seconds for both.
          # The other 23 files are 280 Playwright rows and roughly 55 minutes,
          # which is a scheduling decision and not this step's business.
          #
          # DERIVED, NOT LISTED, on the one fact that makes a gate cheap: it
          # does not shell out to Playwright. A gate that grows a spec drops
          # out of this step by construction rather than timing the job out.
          shopt -s nullglob
          gates=()
          for g in proto/*-mutants.js; do
            grep -q "playwright test" "$g" || gates+=("$g")
          done

          # A LOOP THAT MATCHES NOTHING PASSES -- the same trap this job names
          # above for the harnesses themselves, and the more likely one here:
          # the grep is a NEGATIVE test, so a rename that breaks the glob and a
          # Playwright call that changes shape both read as "no cheap gates".
          if [ ${#gates[@]} -eq 0 ]; then
            echo "no harness-driven gate matched proto/*-mutants.js -- nothing ran"
            exit 1
          fi

          # A FLOOR, NOT AN INVENTORY, as with the engine list above. These two
          # were the cheap ones when this was written; a third is picked up by
          # the loop without touching this list, and the list goes stale only
          # in the safe direction.
          failed=0
          for must in proto/layout-record-mutants.js \
                      proto/shared-shell-mutants.js; do
            printf '%s\n' "${gates[@]}" | grep -qxF "$must" || {
              failed=$((failed + 1))
              printf 'FAIL  %s is a known harness-driven gate and the loop did not select it\n' "$must"
            }
          done

          echo "${#gates[@]} harness-driven gates"
          for g in "${gates[@]}"; do
            out=$(node "$g" 2>&1) && code=0 || code=$?
            if [ "$code" -ne 0 ]; then
              failed=$((failed + 1))
              printf 'FAIL  %s  (exit %s)\n' "$g" "$code"
              echo "$out" | tail -30 | sed 's/^/      /'
            else
              printf 'ok    %s  %s\n' "$g" "$(echo "$out" | grep -oE '[0-9]+/[0-9]+ killed' | tail -1)"
            fi
          done
          [ "$failed" -eq 0 ]
```

## The open policy question

The 280 Playwright rows still need a home. In the order I would consider
them:

1. **Changed-file targeting** — run only the gates whose `file:` targets
   appear in the diff. Cheapest per push, and the gates' own structure
   supports it since every row names its file. My pick.
2. A nightly or weekly scheduled workflow.
3. Leave them manual and accept the drift — but then the 21 specs they drive
   have no standing proof they still catch anything.

That is a cost decision for Movie, not one to take unilaterally.

## Other items on the board

- **Mutation engines for harnesses (Devin's item 2), remaining:** 58 of 85
  harnesses carry an engine; **24 do not** (`mutant-anchors-harness` is the
  guard, not a subject). `elevation-harness.js` at 2,295 lines is a tranche
  of its own; the rest are small.
- **The unification, now unblocked.** Three copies of point-in-polygon
  (`geometry-2d.js` two private at ~:834 and ~:909, plus `building-bodies.js`
  `pointInLoop`), three of "which way is out" (build-house winding,
  `geometry-2d` probe, `cut-view` `outwardOf`), and `const side = (a, b, p)
  => …` written **byte-identically twice** in `geometry-2d.js` — once in
  `selfIntersects`, once in `ringInsideRing`. #561 established BY
  MEASUREMENT that the three point-in-polygon copies agree (12,996 samples,
  zero disagreements), which was the blocker the code's own comment named.
- **Devin's item 4:** two unverified browser-pass items — MODEL's narrow rail
  scrolling sideways at 1366 wide, and the PROJECT info drawer covering its
  own controls.
- **Electric plan:** parked by Movie's own call.
- **`HOVER_RING`** in `MODEL.html` wants its own `draw-hover` palette role.
