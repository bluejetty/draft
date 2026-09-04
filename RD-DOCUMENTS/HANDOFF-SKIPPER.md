# Skipper handoff — 4 Sep 2026

Written at the end of a thirteen-hour session, for whoever picks this up next,
and brought up to date the same evening by the session that did. Read
`BOARDS.md` for the work; this is the part that isn't in it.

## Who

- **Movie** (GitHub `bluejetty`) — owns the project and every merge. He opens
  and merges PRs himself; you don't unless he explicitly asks. He is also the
  only channel between the agents.
- **Gilligan** — a second agent working in parallel, usually in `MODEL.html`,
  `MODEL.dc.html` and `geometry-2d.js`. **His messages reach you only as
  screenshots Movie relays**, and yours reach him the same way. You cannot
  talk to him directly. Write anything meant for him as a short block Movie
  can paste. Movie has said to confirm with Gilligan before anything that
  reaches into a shared file or the repo's shape.
- **Devin** (Commander Devin) — rules on scope and lanes. His rulings arrive
  as screenshots too. He assigns board numbers; **Kevin** keeps `BOARDS.md`.
- **Skipper** — you.

## Standing constraints

- Develop on `claude/new-session-od1p8t`. Never push elsewhere without Movie
  saying so. After a PR from it merges, reset it onto `main` under the same
  name (`git checkout -B <branch> origin/main`) and carry on; that is the
  house's "fresh branch". Movie deletes the remote branch on merge, so prune
  the stale remote ref rather than re-pushing an empty branch.
- **Do not open a PR unless asked.** Movie asks when he wants one, or relays
  Gilligan's ruling that one should be opened.
- `main` IS production — GitHub Pages serves it directly, no build step. A
  merge is a deploy, and the person merging owns watching the four shards.
- **Lane discipline** (Devin, 4 Sep): one agent per file, confirm the lane
  before pushing. `proto/` and `.github/workflows/test.yml` are Skipper's.
  `MODEL.html`, `MODEL.dc.html`, `geometry-2d.js` and the specs under `tests/`
  for them are Gilligan's. A new file in the other's lane is fine; editing an
  existing one is not, without a word first.
- Repository scope is `bluejetty/draft` only.

## State of main as of a188813

Fourteen PRs today, #261 through #277. The evening's three:

```
#275   tier 2 outlines through the real painter; three accessors lifted to
       geometry-2d.js; outline-accessors-harness.js, the fourth mutation
       engine (Gilligan)
#276   CI runs the mutation engines by name, and the comment that said it
       could not be done is corrected; wall-joins and merge-vertex stop
       counting a broken or absent mutation as caught; sixteen harnesses
       reject flags they never honoured
#277   elevation-harness.js, the last unguarded one, rejects flags BEFORE it
       reads its positional; CI derives the engine list by grepping for the
       call form require('./harness-args.js').mutationMode(), with a floor
       of the four known engines (a minimum, not an inventory), an empty
       list fatal, and each engine required to print its table
```

So: **22 harnesses, all guarded.** Four carry a mutation engine and CI runs
all four in mutation mode on every PR. `main`'s own run after #275 was the
first mutation-gated CI on a production change in this repo, green on all
five checks. The earlier items from the thirteen-hour session — tier 2g, the
LENGTH readout, the night wall colours, the runner bump — are all in.

## Open work

1. **`drawRoof2D`'s `#7a4a21`** — contrast **2.23** on the night page, under
   the 3.0 non-text floor. The last genuinely broken colour. Needs a colour
   call from Movie; bring measured candidates, don't guess a brown.
   Unchanged since the morning.
2. **The stamp** — Gilligan's, in progress. Movie's ruling on which area each
   level shows turned out to be what `areas.js` already computes. The shape:
   a **signed** shoelace primitive in `geometry-2d.js` with `polygonArea` as
   its absolute value and the centroid built on the signed one, because five
   private copies exist there and three of them read the sign to drop outer
   faces — consolidating onto the exported `Math.abs` one would break them
   silently. Rows-from-env in `drawShape2D`, not a second noun in the
   painter. Anything that adds a painter or a branch to `render-2d.js` lands
   with its checks in `proto/render-2d-harness.js` in the same PR, or the
   mutation step goes red.
3. **Fixtures** — the last item in tier 2, Gilligan's. Three MODEL-only
   methods and two literals, not the eleven env keys the spec claimed.
4. **NEW-2, the SITE and ROOF sheets** — the board's own top live item, and
   the one that deserves a fresh session rather than a tail end.
5. **A standing rule for `BOARDS.md`**, proposed, not written: *a grep finds
   the word, not the function; count the occurrences and read what each one
   does.* Three instances tonight, one per agent — see the traps.

## Traps this session actually hit

- **The PR page's green tick can be stale.** GitHub tests `refs/pull/N/merge`
  when the run fires and never recomputes it when `main` advances. Nothing on
  the page changes to say so. Matters when two PRs are open at once. Merge
  `main` into the branch before the final push and the tick is earned against
  the real tree.
- **It is five checks now, not four.** The `harnesses` job joined the four
  shards on 4 Sep. A PR showing "4 successful checks" is missing one.
- **`mergeable_state: unstable` means checks running, not a conflict.**
- **`get_status` reports `pending` over zero statuses** — this repo publishes
  check runs, not legacy statuses. Read check runs.
- **Unsent text in a screenshot is not a message.** It appeared six times
  today. Acting on it once would have applied a patch to the wrong base.
- **Branch names get reused across PRs.** Deleting "the branch from #272"
  would have closed #274, which lived on the same branch. The reset-to-main
  under the same name above is safe only because the merge has already
  happened when you do it.
- **A grep finds the word, not the function.** `mutationMode()` matched
  twenty files because sixteen guard comments explain why they *don't* call
  it — the call form with the `require` in front was the discriminator.
  `polygonArea` matched five private copies, three of which cannot use the
  shared one. A hand-typed `MUTATIONS` would have missed `render-2d`'s
  `BRANCH_MUTATIONS`. Count the occurrences, then read each one.
- **A count in a comment is a claim about the present that nothing
  enforces.** "Four of the twenty-one" was stale two commits later on the
  same branch, and "twenty-one files" was wrong the moment a sibling branch
  merged. Write the reason in a form that stays true at any count.
- **A green table can prove nothing.** Three shapes of it in one night: an
  engine with an empty mutation list printed `0/0` and exited 0; a mutation
  whose anchor no longer matched threw, was caught, and was counted as
  *caught by a check*; a harness that took `--mutate`, ran plain mode and
  printed green. Every one was found by forcing the failure on purpose and
  reading the exit AND the text. An exit code alone was wrong twice.
- **Subscription tooling can fail, silently to your partner.** The PR watch
  failed twice on one session while the other believed it had been handed
  off, so for a while nobody held the PR. Say so the moment a watch fails.

## The one habit worth keeping

Every real defect this session was found by comparing two things, never by
inspecting one. Measure it, break it on purpose, and check that the number
you have answers the question you asked -- the three failure modes are in
`BOARDS.md` rule 0, and the third one (a precise measurement of something
adjacent to the claim) caught both agents on the same night, and all three
of us the next.
