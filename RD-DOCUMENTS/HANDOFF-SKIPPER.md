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
  merge is a deploy, and the person merging owns watching the shards.
- **Lane discipline** (Devin, 4 Sep): one agent per file, confirm the lane
  before pushing. `proto/` and `.github/workflows/test.yml` are Skipper's.
  `MODEL.html`, `MODEL.dc.html`, `geometry-2d.js` and the specs under `tests/`
  for them are Gilligan's. A new file in the other's lane is fine; editing an
  existing one is not, without a word first.

  **THERE ARE TWO LANE MAPS IN THIS REPO AND THEY DISAGREE.** Found 23 Sep.
  `HANDOFF-GILLIGAN.md` carries a later one, agreed between the two agents on
  5 Sep, which says of itself: *"ratified by nobody yet — Movie or Devin still
  owe a word on it."* Nobody gave that word, and this file was never updated,
  so both have been live for eighteen days:

  ```
                     this file (Devin, 4 Sep)   HANDOFF-GILLIGAN.md (5 Sep)
  MODEL.dc.html      Gilligan's                 SKIPPER'S
  geometry-2d.js     Gilligan's                 SHARED — announce first
  cut-view.js        (unlisted)                 SHARED — announce first
  drawing-format.js  (unlisted)                 SHARED — announce first
  ```

  Neither agent can settle this; it needs Movie or Devin. Until then, read
  BOTH before touching any file in the table above, and take the stricter
  reading. **The mechanism that actually worked was never the list** — the
  5 Sep doc says so itself: *"announce-first is what actually protected us all
  day, not the list."*

  **AND MOVIE OVERRODE IT ON 22 SEP**, for that session: asked to confirm the
  lane before pushing into `.github/workflows/test.yml`, he answered *"you
  have both lanes"* and then *"all lanes"*. That is the most recent word from
  the person who owns the project, it is why the work listed below reaches
  deep into Gilligan's files, and it was said for one session rather than as a
  standing change. Ask again rather than assuming it carries.

  **AND IT IS DORMANT, NOT URGENT — Movie, 23 Sep:** *"i'm going to take it
  slow for a bit and go one at a time so we won't need to worry about lanes
  for a while."* One agent at a time is the condition under which none of the
  above can bite: a lane map only decides who wins a collision, and there is
  nothing to collide with. So this is recorded rather than escalated, and the
  ratification is still owed whenever two agents next run together.
- Repository scope is `bluejetty/draft` only.

## State of main as of bb1d508 — 23 Sep

Six PRs merged on 22 Sep, five of them reaching into Gilligan's lane under
Movie's "all lanes" word above. Written for him, since he was not in the room
for any of it.

```
#453  nine dead mutation anchors in premade-plans-harness.js -- they matched
      nothing and had been reporting clean kills for it
#454  a ridge is not a rake; a window clears the roof under it by 4"
#455  a rake wears its board only where its gable faces; a nearer foundation
      face hides the part it covers rather than all or nothing
#456  THE WINDOW HEAD IS 7'-0", and windows already drawn move there;
      elevations are drawn in the white the side menus leave them
#457  six shards, and the divisor is derived from the matrix
#458  a window is a SINGLE or a DOUBLE CASEMENT, and the double wears a
      mullion
```

**What of that is yours to know about:**

- **`geometry-2d.js` grew three exports** — `DEFAULT_WINDOW_HEAD_FT` (7),
  `SUPERSEDED_WINDOW_HEADS_FT`, and `CASEMENT_SIZES_FT`, a table of window
  sizes KEYED BY the vocabulary in `drawing-format.js`. Keyed rather than
  listed on purpose: the two cannot disagree about which casements exist
  without `proto/casement-harness.js` going red, and there is no second list
  to forget. `RULING-the-window-head-is-the-datum.md` is now **BUILT**.
- **`drawing-format.js` gained a persisted per-opening key, `casement`**
  (`'single' | 'double'`, and `null` on a door). No version bump: the stored
  shape only GAINS an optional key, and an older reader still has a valid
  window. It also gained a MIGRATION — a window still sitting at an old
  default head moves to 7'-0" on load, keeping its size, and a head somebody
  typed is left alone.
- **`MODEL.dc.html` was dropping that key on save, and it is fixed.** Its
  `_serializeDrawing` builds each opening from a twelve-key literal with no
  spread; the reader had started returning thirteen. A double casement drawn
  on MODEL.html loaded here fine, painted fine, and came back a single the
  first time anyone edited the drawing. Measured, not argued. Guarded now by
  `proto/opening-round-trip-harness.js`, which compares the two lists and
  goes red if the serializer is renamed rather than quietly checking nothing.
  **`tests/persisted-format.spec.js` did not catch it and could not**: it
  pins the TOP-LEVEL key set and says nothing about fields inside a record.
  The same exposure exists for every other collection in that serializer and
  is NOT guarded — one collection parsed exactly beat six parsed loosely.
- **`cut-view.js` takes a `margins` option now.** MODEL.html measures its two
  rails and passes what they cover, so an elevation is drawn in the white
  they leave it. The painter's own defaults are a floor and an external fit
  (LAYOUT's sheets) still takes none. MODEL.dc.html has no rails and needs
  nothing.
- **Two board headers were corrected** — `BOARD-a-roof-through-a-window.md`
  and `BOARD-three-from-the-elevations.md` both said NOT FIXED while their
  own bodies described the fix. Third instance of that shape this week.

**Still open, both waiting on Movie:**

- *"(one side would open)"* — the casement models the unit and its panes, not
  which pane is operable. That wants a hinge-swing on the elevation and a
  stored side.
- The ordinary window's size. He said *"the window still too big"* on the
  20th and has not given a number; `DEFAULT_WINDOW_WIDTH_FT` is 4'-0".

---

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
