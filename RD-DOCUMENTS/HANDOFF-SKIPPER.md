# Skipper handoff — 4 Sep 2026

Written at the end of a thirteen-hour session, for whoever picks this up next.
Read `BOARDS.md` for the work; this is the part that isn't in it.

## Who

- **Movie** (GitHub `bluejetty`) — owns the project and every merge. He opens
  and merges PRs himself; you don't unless he explicitly asks.
- **Gilligan** — a second agent working in parallel, usually in
  `MODEL.dc.html` and `proto/`. **His messages reach you only as screenshots
  Movie relays.** You cannot talk to him directly.
- **Skipper** — you.

## Standing constraints

- Develop on `claude/new-session-1wmbue`. Never push elsewhere without Movie
  saying so.
- **Do not open a PR unless asked.** Movie asks when he wants one.
- `main` IS production — GitHub Pages serves it directly, no build step. A
  merge is a deploy.
- Repository scope is `bluejetty/draft` only.

## State of main as of d9da587

Everything from the session is in. Eleven PRs, #261 through #274.

```
tier 2g        mitred wall corners; a vertex pool that restores the object
               identity a JSON save destroys; the drawing-format body collapse
LENGTH         the live readout works on every drawing tool (Gilligan)
wall colours   draw-wall #2f3335 / draw-wall-edge #a7aeb1 on night, day
               unchanged. Night walls were white slabs with invisible outlines
               -- the edge literal WAS the page colour, contrast 1.00
harness-args   one argument guard, lifted out of three copies (Gilligan)
harnesses      21 of them now run in CI, plain mode, ~10 seconds
runner bump    checkout/setup-node/upload-artifact all @v7, off the
               deprecated node20 runtime
```

## Open work

1. **`drawRoof2D`'s `#7a4a21`** — contrast **2.23** on the night page, under
   the 3.0 non-text floor. The last genuinely broken colour. Needs a colour
   call from Movie; bring measured candidates, don't guess a brown.
2. **The three-file mutation step in CI.** Only three harnesses have mutation
   engines — `render-2d` (8), `wall-joins` (7), `merge-vertex` (7). All three
   are already guarded. Naming them explicitly in a CI step works today. Both
   agents believed a twenty-one-file cleanup was a prerequisite; it is not,
   and that wrong claim is written in `test.yml`'s comment. Offered to Movie,
   not yet taken.
3. **16 harnesses need `noFlags()`**, one (`elevation-harness.js`) needs a new
   "one optional positional, reject flags" entry point. Gilligan's, classified
   and ready.
4. **NEW-2, the SITE and ROOF sheets** — the board's own top live item, and
   the one that deserves a fresh session rather than a tail end.

## Traps this session actually hit

- **The PR page's green tick can be stale.** GitHub tests `refs/pull/N/merge`
  when the run fires and never recomputes it when `main` advances. Nothing on
  the page changes to say so. Matters when two PRs are open at once.
- **It is five checks now, not four.** The `harnesses` job joined the four
  shards on 4 Sep. A PR showing "4 successful checks" is missing one.
- **`mergeable_state: unstable` means checks running, not a conflict.**
- **`get_status` reports `pending` over zero statuses** — this repo publishes
  check runs, not legacy statuses. Read check runs.
- **Unsent text in a screenshot is not a message.** It appeared four times.
  Acting on it once would have applied a patch to the wrong base.
- **Branch names get reused across PRs.** Deleting "the branch from #272"
  would have closed #274, which lived on the same branch. Cut a fresh branch
  per PR if Movie allows it.

## The one habit worth keeping

Every real defect this session was found by comparing two things, never by
inspecting one. Measure it, break it on purpose, and check that the number
you have answers the question you asked -- the three failure modes are in
`BOARDS.md` rule 0, and the third one (a precise measurement of something
adjacent to the claim) caught both agents on the same night.
