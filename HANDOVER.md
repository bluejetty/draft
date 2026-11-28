# HANDOVER — brought up to date 27 Nov 2026 (first written 16 Oct)

For whoever picks the work up next. **Read "Start here" and §1 first**: they
describe the program as it is on `main` today and hold the owner's standing
orders. §0 records the TOY MODE removal. §2 to §6 are the 16 Oct handover,
kept as written (in the owner's own words, with the decisions taken then);
§3 now opens with a note on which of those items have since been built.

**Who is who.** The owner is **jb** (GitHub `bluejetty`). Documents and code
comments written before November call him **Movie**; it is the same person,
and every quotation signed either way is his.

---

## Start here — the program on 27 Nov 2026

`main` was at the merge of **#1149** (27 Nov 2026) when this was written. PRs
merge most days, so check `git log` for anything newer.

**What it is.** Rough Drafter: a house-drafting program that runs entirely in
the browser (static files, no server, no build step). Two skins over one
program, RUFF DRAFTER and ROUGH DRAFTER. Live at roughdrafter.com (GitHub
Pages) and ruffdrafter.com (Cloudflare Pages); both deploy from `main` on
every merge, so **a merge is a release**.

**Where things are** (full map in `RD-DOCUMENTS/ARCHITECTURE.md`):

- **`MODEL.html` is the editor jb uses**, about 1,600 lines of markup; its
  script is the 22 numbered parts in `model/` (about 55,000 lines), which
  share one name space.
- `MODEL.dc.html` is the **old** editor. Nothing in the app links to it, but
  the test helper `helpers.openModel` still opens it, and about 140 spec
  files test only through it. Don't build features there.
- Other screens read the same drawing: `LAYOUT.html` (sheets), `PROJECT.html`,
  `EXTFINISH.html`, `BONEYARD.html`, `REALESTATEPLAN.html`, `ESTIMATES.html`,
  `SPECS.html`, `CODES.html`.
- Separate programs in folders, each removable without breaking the 2D pages:
  `viewer/` (**RUFF 3D / ROUGH 3D**, the 3D house viewer with exports and
  PRINT MODEL), `landscape/` (**RUFF / ROUGH LANDSCAPE**, lot grading),
  `neighborhood/`, `DXF/` (DWG to DXF converter).
- The shared rules live in plain-JS modules at the repo root
  (`geometry-2d.js`, `wall-types.js`, `cut-view.js`, `drawing-format.js`...).
  A rule lives in one module and every page reads it from there.

**How work lands** (the standing orders in §1 are the rules; this is the
routine around them):

- One thread or task, one branch, one PR. jb reviews and merges every PR
  himself. Feature work comes with a spec in `tests/` and, where it fits, a
  mutation gate in `proto/`.
- For big or unclear work, jb wants a plan first and says "go" before
  building. Ask in plain language: he is a draftsman, not a programmer, and
  reads screenshots (marked up in GIMP) more readily than code.
- The day-to-day record of what was asked, decided and merged is the
  **project memory** kept by the Claude project (one note per feature),
  not this repo. Git history and PR descriptions are the other record.

**Checks (CI).** `.github/workflows/test.yml` runs two jobs on every PR:

- `harnesses`: every `proto/*-harness.js`, the mutation engines, and the
  mutation gates that drive a harness (45 minute cap). The mutation gates
  that drive Playwright specs are run locally, not in CI.
- `playwright`: the full suite (about 3,700 tests on 27 Nov, growing by
  roughly 250 to 300 a week), split into parallel shards with a 35 minute
  limit each. The shard count lives only in the job's `matrix`. When a shard
  goes red with **no failing test**, it ran out of time; read the log before
  hunting for a bug.

**What changed since the last update (10 Nov to 27 Nov, roughly #950 to
#1155).** The detail of each is in its PR and in project memory:

- **Roofs:** AUTO ROOF / HAND ROOF, BUST ROOF into hand pieces, ROOF PIECE
  tool, HIP ROOF card, hip or gable per piece, MAIN ROOF / SPECIAL CASE per
  piece, two gables on a stepped end, the small gable over a hip, zero
  overhang, fascia that grows down and its finish/seam rules.
- **Walls and structure:** CREATE WALL TYPE (slices with hatch, on floors and
  the foundation), MAIN WALLS / SPECIAL CASE, wall OFFSET, JOIST DEPTH picks
  from span, beams (FLUSH/DROPPED per span, pockets, cut to one span),
  columns (round/square posts, pile caps, copy a whole stack, ride their
  beam), LEVEL LOCK.
- **Stairs:** flights, landings and winders, stacked stairs moving as one,
  CHANGE BOTH FLIGHTS, stairs on every level, EXT. WALL leg widths, REDUCE
  BASEMENT, STAIR SECTION, stair corners as snap nodes.
- **Elevations and sections:** draw over them (LINE, SHAPE, DIMENSION),
  deck bands, footing outlines, columns and beams in sections, EXT. FINISH
  hatches shown on MODEL and printed on LAYOUT, finish thickness.
- **EXT. FINISH:** gable as its own area, fascia finish, siding fill rules,
  SPECIAL finish shapes, wheel zoom / pan / FIT.
- **Details and sheets:** DETAILS LIBRARY (its own file, board of cards,
  detail windows, crop), DETAILS strip in a house, details placed on LAYOUT,
  bring layout windows in from another file, viewport LOCK across sheets,
  right-click viewport menu, PROJECT INFO drop-down, PDF written by the app.
- **Holograms:** a third shelf save kind; holograms-only master plans drawn
  on elevations, rail seats and LAYOUT.
- **Fixtures:** cabinets that stand on their side, double-cabinet handles,
  SINK chip (cabinet, apron, laundry, mop), vanity width mark, FIREPLACE,
  DOUBLE and TRIPLE windows, DECK floor type and deck post footings.
- **Drafting tools:** OFFSET / MIRROR / ROTATE / FILLET / ARRAY, arcs and
  circles in LINE / SHAPE / FLOOR, TURTLE (draw as wall, trace), NOTE and
  ROOM TAG properties, dimension UNITS and divide snaps, type a dimension to
  move a window or door, Ctrl/Shift box selects all levels, COPY / PASTE
  carrying notes, beams and posts.
- **Files and shell:** SAVE AS ZIP, SAVE AS / prints / exports cost bones,
  the deploy build stamp, REPORT A PROBLEM, phones/tablets PC MODE.
- **New programs:** RUFF 3D (`viewer/`, phases 1 to 6) and RUFF LANDSCAPE
  (`landscape/`, phases 1 and 2), with OPEN IN 3D / OPEN LANDSCAPE chips in
  MODEL and 3D tiles on the sheet pages.

**Care notes for the code.**

- `cut-view.js` (the elevation/section painter, about 10,500 lines) is the
  most-changed and most fragile file. It decides "these two points are the
  same" with several different tolerances; small notches on elevations
  usually come from that. Check a change against the test houses in
  `proto/*.draft` (TIMBERHOUSE among them), not just the one in the report.
- A new saved field needs a reader in `drawing-format.js`, or it vanishes on
  the next load. Old drawings must always open.
- No 2D page may load `viewer/` code or three.js (`tests/viewer.spec.js`).
- Any new page needs the build-stamp head lines (`<meta name="draft-build"
  content="dev">` then `<script src="./build-id.js">`) or the stamp harness
  fails.

---

## 0. TOY MODE is gone — 9 Nov 2026

Read this before anything below that says TOY, board, lamp, bone or promotion.

jb: *"i would like to completely remove TOY MODE from our project it causes
more problems, we can have those features like TSQUARE and 1FT engaged so that
it will be kindof like toy mode, but he can turn it off easy."* And on the
half-started game split: *"we don't need it in our program at all."*

So on 9 Nov 2026 (branch `claude/project-thread-ag9sk3`):

- There is **no board**. `board` is not read from or written to a drawing
  file (an old file that still says `board: 'toy'` loads fine and saves
  without the word). No lamp in the mode corner, no promotion on a typed
  number, no bone card (BREAK HERE / MOVE THIS WALL), no bones at all.
- **T-SQUARE and the 1 FT light start ON** in a fresh browser. One press on
  either chip turns it off, and the page remembers the choice per browser in
  `draft-skin` (`tsquare`, `footLight`, beside `snapLight` / `trackLight`).
  A typed length is honoured whatever the lights say.
- Deleted: `game/`, `toy-constraints.js`, `toy-context.js`, the toy specs
  and `proto/toy-*` gates, and the three TOY work orders in
  `RD-DOCUMENTS/IMPORTANT-WORK-ORDERS/` (a short retired note stands in
  their place: `TOY-MODE-RETIRED.md`).
- The Playwright suite drafts with **both lights off** (`tests/helpers.js`
  seeds `draft-skin` right after it clears storage), so fixtures that draw
  off-foot or off-square keep meaning what they meant. A spec that needs the
  lights on seeds them itself: see `tests/lights-on-by-default.spec.js`.
- Queue items **3.1 and 3.2 below are moot**: a 6" grain was a TOY rule.
  Section 2's "#746 TOY is a light" and the TOY sentences in 3.7 describe
  history, not the page.

Never reintroduce a second board or mode. If a "toy-like" feel is wanted, it
is the two lights, nothing more.

---

## 1. Where the work is, and how it is done

**The app is `bluejetty/draft` — Rough Drafter**, a browser-based residential
architectural drafting app. `MODEL.html` (with its script in `model/`) is the
live editor. `MODEL.dc.html` is the OLD page: tests still open it, but do not
edit it as if it were live. (Updated 27 Nov; see "Start here".)

**Standing orders from Movie, which hold whatever else a task says:**

- **Confirm the repo and branch before pushing.** He owns two GitHub accounts
  (`bluejetty` and `dzmarkup`) with several repos between them, so a change can
  look right and still land in the wrong place.
- **Push to a branch and let him merge the PR. Never push to `main`.**
- **Hand over a backup zip with the work** when handing work over outside a
  PR: the changed files at their real paths, plus a `git bundle` of any
  unpushed commits.
- **Do not ask him about beams, columns or the engineered OWJ.** His words:
  *"don't ask the user about placing beams and columns or the engineered owj,
  just make the decision based on spans don't ask the user, they can adjust it
  later if they need too."* Decide, state what you decided, move on.
- He reads screenshots and marks them up in GIMP. Red/purple/blue circles in
  his images are the spec — read them as carefully as the words.

**Test and gate conventions** (they are the house style, not optional):

- Specs live in `tests/*.spec.js` and are written as prose about the rule,
  quoting his own words, with the reasoning for every non-obvious assertion.
- Every feature gets a **mutation gate** in `proto/<name>-mutants.js`: a list
  of defects that still render, each applied to a real file, with the spec run
  against it. A gate **refuses to run on a dirty tree** (it restores with
  `git checkout -- <file>`) and **runs the baseline first** — a spec that is
  already red kills every mutant and prints a perfect sheet over broken code.
- A mutant that cannot be demonstrated is **removed with a written reason**,
  never softened. A `SKIPPED` mutant counts as AMBIGUOUS and fails the sheet.
- CI runs `proto/*-harness.js`, the mutation engines and the harness-driven
  mutation gates in one job, and Playwright in parallel shards (the count is
  in the `matrix` in `.github/workflows/test.yml`). The Playwright-driven
  mutation gates are local-only. Each local run needs its own
  `DRAFT_TEST_PORT`.
- **Never run Playwright with `--workers=2`.** The config refuses it: parallel
  workers on one machine wipe each other's `localStorage` and IndexedDB
  mid-test. Shard instead.

**A trick worth keeping:** to work two branches at once without disturbing a
running gate, use a git worktree and symlink `node_modules` into it:

```
git worktree add --detach /tmp/claude-0/work <sha>
ln -s /home/user/draft/node_modules /tmp/claude-0/work/node_modules
cd /tmp/claude-0/work && DRAFT_TEST_PORT=4490 npx playwright test --shard=4/6 --workers=1
```

The machine has 4 cores. Two concurrent suites is fine; three makes timing
tests flake (see §5, the 2.50 ms reading).

---

## 2. What shipped on 16 Oct

*History. For what has shipped since, see "Start here" and `git log`.*

| PR | what |
|---|---|
| #744 | DRAW OUTLINE seeds the first corner on the bullseye |
| #745 | the 7 ft rule at a stair — move it to the wall, or frame the open side |
| #746 | **TOY is a light, not a button** |
| #747 | a spike in a traced loop was cancelling the roof's junction rule |
| #748 | the SITE card says OK |
| #749 | the BONEYARD's levels stand between the two windows |
| #750 | the roof's own lines, and a BG button on every level |

**#746 is the one with the longest reach.** TOY is no longer a board that
refuses tools — it is a lamp that says how fine the numbers are. Every drawing
**starts on TOY**, every tool is available on every board, and the first number
a whole foot cannot hold moves the drawing to DRAFTING by itself. The drafter
never chooses; he is told. Consequences that bit five separate specs:

- A fixture that names no `board` is on **TOY**, not DRAFTING. Several specs
  said "no press, so this must be TOY" while their fixture carried
  `board: 'drafting'` — read the fixture, not the comment.
- There is **no press onto DRAFTING any more**. A check that needs that board
  must name it in the saved file.
- **TOY §1 refuses a new run while one is unfinished.** Arming the tool again
  *is* the new run it refuses, and Escape cancels a run rather than committing
  it. Two perf samples drew three or four separate two-tap wall runs and had to
  move to `board: 'drafting'` in the fixture.
- The lamp reads `TOY` / `1 FT · 90°` or `DRAFTING` / `ANY LENGTH`, and it is
  the fourth control in the mode corner where a `TOY DRAFTING` pair used to be.

---

## 3. The queue (from 16 Oct)

**Status checked 27 Nov 2026, from the code and the specs, not with jb.**
Much of this queue has since been built. Before starting any item, check the
code and ask jb whether it still stands; his rulings may have moved on.

| item | status on 27 Nov |
|---|---|
| 3.1, 3.2 (TOY grains) | moot: TOY MODE was removed (§0). 3.2(d) wall justification exists (`tests/model-wall-justify.spec.js`). |
| 3.3 garage square | built (`tests/garage-square.spec.js`) |
| 3.4 beam over an opening | bearing rules exist (`tests/opening-bearing.spec.js`); not checked against every point here |
| 3.5, 3.6 stair beams | not checked |
| 3.7 type into LENGTH, TAB to ANGLE | built: TAB moves to the angle box, and `14 6` now parses as 14'-6" |
| 3.8 DRIVE-THRU banners | built (`tests/drivethru-banners.spec.js`); the drive-thru has changed again since |
| 3.9 LAYOUT text at print size | built (the `Math.max(9, …)` floors are gone from `LAYOUT.html`) |
| §4 BONEYARD beams/columns | built (`tests/boneyard-beams.spec.js`) |
| §4 dormers | exist (`tests/model-html-dormer.spec.js`, `tests/ext-finish-dormer.spec.js`) |
| §4 roof against a 2nd-storey wall | work exists (`tests/roof-against-wall.spec.js`); partial-overlap case not checked |
| rest of §4, §5 | not checked |

Ordered as he gave them. Every quotation is his.

### 3.1 — TOY cabinets on a 6" grain

> *"in the TOY mode we should be able to add CABINETS right? but maybe they all
> need to be sized to the nearest foot. or how about for the CABINETS we allow
> those to shift extra to 6" scale so we could have 1ft, 18" 24" 30" 36" 42"
> 48" etc"* … *"a little more accuracy we should allow for cabinets"*

Cabinet runs get a 6" grain of their own, and **a half-foot there must not turn
the TOY light off** the way a finer number elsewhere does.

The machinery is already there: `toy-constraints.js` has `HALF_FOOT_FT = 0.5`
as "the one exception to the foot" (added for exterior walls), and
`quantiseFeet(delta, stepFt)` already takes a per-object step with
`stepFor(wall)` reading `wall.stepFt`. The CABINET fixture is
`fixture-kinds.js` (`id: 'cabinet'`, `widthFt: 3`, `run: true`).

`toyCouldMakeLength` in MODEL.html is what decides whether a typed number
promotes; it asks `quantiseFeet`, so the grain and the promotion rule stay one
thing. Cabinets need that question asked with their own step.

### 3.2 — TOY interior walls on a 6" grid off the exterior corners

Four messages, and the order of the rules matters:

**(a) The grid is anchored on the exterior corners of the house.**

> *"this 6" spacing should be based on the 1ft exterior grid … if the line
> isn't connected to a CORNER, the GRID used for the interior 6" snap grid will
> be based on the 1ft exterior house wall corners"*

and, correcting an earlier wording of mine:

> *"its not measure off inside face - the 6" grid is based on the ext corners
> of the house (1ft grid)"*

The outline's own 1 ft grid, halved. **Not** the inside faces, **not** a
per-room datum, **not** the world origin.

**(b) The inside faces are hard snaps, and they beat the grid.**

> *"the interior walls allows the connection at the 5.5" corner (usually
> default) rather than the 6" so it lines up and the stair opening is a similar
> line-up method which deviates from the 6" grid (in most cases)"*

> *"if the interior face of exterior wall is the connection point i think that
> will solve problems for us"*

**Why this must be written into the code:** 5.5" and 6" are half an inch apart
and indistinguishable by eye. If the grid won, every interior wall meeting an
exterior corner would miss the inside face by ½" — a drawing that looks right
and builds wrong. So the face must be **preferred** wherever both are in reach,
and the snap tolerance must be comfortably more than that half inch or the grid
steals it.

The edge of a floor or stair opening is the other hard snap of the same kind:

> *"then the edge of the floor / stair openings will need to be the other
> location maybe off the GRID SNAP where the int walls will need to align"*

It lands at 14½" on the lowest floor and 5½" above — off-grid in most cases,
exactly as he says.

**(c) The offset at a hard snap is read off the wall type, never a constant.**

> *"at the corners the int walls will just move to the req 1/2" for 5.5" wall
> or whatever in need for the thicker (probably the foundation wall) or thinner
> wall (maybe 2x4 wall ext sometimes)"*

`WALL_TYPES.totalIn` is the number: `stud_2x6` 5.5, `stud_2x4` 3.5,
`concrete_8` 8, `insulation_6` 6.5, `icf` 11.25 / 13.25. **Walls stay 5.5"** —
sheathing lives outside the perimeter line and is not in the assembly
(*"don't worry about that, leave the walls at 5.5""*).

The stair opening edge is derived the same way: `stairOpeningSetbackFt` is
`max(planIn, concrete_8 + insulation_6)` = 14.5" on the lowest floor, 5.5"
above.

**(d) The wall body is placed against the line by justification.**

> *"allow the user to select the 'LEFT SIDE' CENTERLINE or 'RIGHT SIDE' for
> placement of the actual wall, based on where the LINE is positioned"*

LEFT/RIGHT are relative to the line's direction of travel (first point to
second), shown live as a ghost body while drawing — "left" means nothing
otherwise. Sticky between walls; CENTERLINE the default.

**At a hard snap the side is not the drafter's to get wrong:** the snap
justifies away from what it caught — into the room off an exterior face, away
from the hole off an opening edge — so a stair opening keeps its clear size and
a room keeps its clear dimension.

**Storage:** one enum, `justify`, beside the existing centreline. The reference
line is the centreline offset by ±t/2, so nothing downstream needs a new
geometry field. On a wall-type change, recompute the centreline so the
**justified side** stays put — the room keeps its clear dimension instead of
the wall silently shifting.

**Where:** `MODEL.html`'s `offGridBy` / `landingStep` (~24894) measure against
the world — `pos - Math.floor(pos)` with `FOOT = 1`. They are what generalise
to `(pos - datum) % step`, with MODEL supplying the datum the way it already
supplies which walls are exterior. `toy-constraints.js` quantises the MOVE and
never the position, deliberately (31 Aug: the toy never silently corrects what
it did not create) — a wall being **created** now is the toy's own, so the toy
may place it on its own grain; an old wall nobody touched is never re-gridded.

**A 6" position must not turn the TOY light off**, and neither may a snap to an
interior face or an opening edge: those offsets come from wall thickness, not
from typed precision.

**Decided, not asked:** the foundation's inside face is 8" in while MAIN's is
5.5", so a wall snapped to each level's own face does **not** stack between
floors. Default to the level's own face (true rooms on each floor) and offer
the wall below as a reference line, so stacking is a snap he can take rather
than one he is given.

### 3.3 — The garage square: nothing stands where the car goes

> *"on a 2 storey garage the stairs can't overlap where the garage door / car
> will be or the landing area for the man door (42"x42" landing. the garage
> square should be sized according to the garage door width and height (match
> plus add 1ft on top and to each side)"*

then, after the parking research, and these supersede the figures above:

> *"lets go 20ft total 'height (length) for square"* … *"(not +4) just 20"*
> … *"actually on the sides only make it increase by 6" so the colms can know
> they can be placed between the 2 doors"*
> … *"so the stairs of other stuff to interfer with the vehicle shouldn't
> locate there"* … *"no columns in that area either"*

**THE SQUARE, one per overhead door:**

- **width** = the door's own width **+ 6" each side** (his 6'8" doors → **7'-8"**)
- **depth** = **20'-0" total** from the inside face of the door wall, into the
  garage. 20 is the whole number — the earlier "+1 ft on top" and "+4 ft on
  top" are folded into it, **not added**.
- capped at the garage's own depth, so the rule always has an answer.

**The 6" is not a clearance guess.** It is what leaves the pier between two
doors free so a column may stand there. A foot each side closed that gap and
left nowhere legal to carry the floor over a two-bay garage.

**It is a floor keep-out for everything, not a stair rule.** Nothing that
stands on the garage floor may be inside it: the stair and its well, a column
or pile, a fixture, an interior wall. **Overhead is a different question and is
allowed** — a beam crossing the bay is how a garage is framed.

**The other keep-out:** a **42" × 42" landing** in front of the man door, same
rule.

**Consequence worth saying out loud in the app:** his garage is about 20 ft
door wall to back wall, so a 20 ft square takes the whole depth. What is left
is the pier between the doors and the width beside the bays. Better for the app
to say "this garage needs more depth" than to quietly stand a stair, or a post,
in front of a car.

**The research behind 20 ft** (so nobody redoes it): no national standard,
every municipality sets its own, but they cluster — Calgary 5.9 m (**19'-4"**)
for a garage stall serving a dwelling; Burlington ON 6.0 m (**19'-8"**)
interior, 5.5 m (18'-0") unobstructed; another ON bylaw 3.0 m × 6.0 m;
Wainwright AB 6.5 m (**21'-4"**). Vehicles: sedan ≈ 15–16 ft, mid-size SUV ≈
15–16.5 ft, full-size crew-cab pickup ≈ **19–20.5 ft**.

**Where:** `stairPlacementLegal` (MODEL.html ~17995) is the predicate for the
stair — it already asks "every well corner inside the interior ring" and "the
well clear of the carrying beams", and the square is a third question of the
same shape. `stairAutoFit` scores candidates and must prefer a legal one. The
auto column / pile pass is the other caller that has to ask, and it should
**prefer** the pier between the doors rather than merely tolerate it. Door
sizes come off the fenestration records, so the square is derived, never typed.

No car pad or garage square exists in the code today (grepped: no
`carPad` / `garageSquare` / `CAR_*`), so this is a new derived object.

**Knock-on, flagged to him and accepted:** if a bay is wide enough to want a
post under the floor above and the square forbids one, that span is carried by
a beam to the walls either side instead — a longer, deeper beam rather than a
post in the middle. That is the engineered-beam path the garage already uses
past its span limit; it will just get used more often.

### 3.4 — A beam may not land over an opening

> *"the beam cant rest over the garage opening or door opening either, they
> should have a solid support column built into the wall below where the beam
> rests (can't be opening)"*

and, of the beam in his own screenshot: *"i think that beam actually hits the
wall"* … *"which is good"* — so this is a rule to enforce so it cannot drift,
not a bug report.

**Two halves, one rule:**

1. **Refusal** — a beam's bearing point may not fall inside any opening on the
   wall it lands on: a garage door, a door, a window. A point load landed
   mid-span on a lintel is the defect.
2. **What replaces it** — a solid support column built **into** the wall below
   the bearing, carried down. Not a column standing beside the wall: a post
   inside the wall assembly, which is how the load actually reaches the footing.

The test is not "is the point inside the opening" but "is there room for the
post **and** its bearing clear of the opening". `_clampOpeningToWall` already
reserves lintel bearing on the same principle — see
`tests/opening-bearing.spec.js`: NBC Table 9.23.12.3.-A note (4) gives 1½" up
to 3 m of span and 3" over, plus Movie's own *"measured from inside of exterior
wall (5.5" typ)"* and *"use a 6x6 post"* where no wall stands there.

**Ties to §3.3:** on a two-bay garage the pier between the doors is the one
piece of that wall both rules allow — no car square over it, and solid wall for
a post. That is where a beam crossing the bays should want to land, and the 6"
side figure exists to keep it available.

### 3.5 — Stair end beams: only parallel, and only past 10 ft

> *"when the stairs are alligned perp to the main beam like in ths photo above,
> we don't need beams on the short ends of the stairs, only when it is ll and
> there is 10ft or more span of floor until the next beam or ext. wall"*

**Both conditions must hold before a short-end beam is placed:**

1. the well runs **parallel** to the main beam (perpendicular → no end beams at
   all)
2. **10 ft or more** of floor span from the well to the next beam or exterior
   wall

**Why it is the right shape** (worth keeping so nobody "fixes" it): joists span
perpendicular to the beam. A well set perpendicular to the beam runs **with**
the joists — it interrupts few, the trimmers down its long sides carry what it
does, and the short ends are headers with almost nothing on them. A well set
parallel cuts **across** the joists along its whole length, so each short-end
header gathers every cut joist, and past 10 ft of remaining span that header is
a beam.

**Not the same as the open-side beam shipped in #745**, which frames the long
side the mid-span beam does not already carry. This is the short ends, and it
is a refusal more often than a placement.

**Read rather than asked, correct it if wrong:** "the main beam" where a floor
carries several means the one carrying that bay; the 10 ft is measured from the
**well's end** to the next support, not from the stair's centre.

**Where:** the stair framing pass in MODEL.html (`stairOpenSideFraming` /
`placeStairSideFraming`, added for #745) and `build-house.js`'s
`garageStairHeader`, which already picks an edge off `{ axis, supports }` — the
axis test it needs is exactly "is the well parallel to the beam".

### 3.6 — The long side of a stair well

> *"when long side is exposed to 10ft or more floor span it should have a
> column on each end of the opening and a flush beam along the opening (edge of
> beam alligned with edge of opening (center a few inches inside the floor)"*

- **trigger** — the well's long side is exposed to 10 ft or more of floor span
- **beam** — flush, along the opening, with its **edge on the opening's edge**,
  so its **centreline** sits half a beam width inside the floor
- **columns** — one at each end of the opening

**This restates what #745 shipped, in two ways, and both are changes:**

1. **The offset is derived, not a constant.** #745 set the centreline
   `STAIR_BEAM_CLEAR_IN = 2"` off the well edge. His rule makes the offset half
   the beam's own width, so the **face** lands exactly on the opening edge
   whatever the beam is. The two agree closely by accident on a 3½" beam — a 2"
   centre puts the face ¼" inside — which is why the flat 2" looked right.
   `tests/model-html-auto-stair` pins the 2" rule and moves with this.
2. **The threshold is 10 ft, not 7.**

**Reading I gave him, to build unless he says otherwise** — the two rules
measure the same strip and answer different questions, so they stack:

| strip beside the well | what happens |
|---|---|
| under 7 ft | move the stair to the wall *(unchanged, #745)* |
| 7 – 10 ft | a room, but a span the joists carry alone: nothing added |
| 10 ft and up | the flush beam on a column at each end |

No gap, no contradiction, and 7–10 ft of joist span needing no beam is
ordinary. He has not objected; if he wants the beam from 7 ft, collapse the
middle row.

### 3.7 — Type straight into LENGTH, TAB to ANGLE

> *"when they get to this position and they are pointed a direction, can we
> allow them to start entering numbers and it will start entering into the
> LENGTH texbox without having to click on the texbox, just put it straight in
> there, unless they press A where they will … enter the ANGLE textbox and
> enter and angle"*

While a run is live and a direction is taken, a digit (or `.` `'` `"` `-`)
typed anywhere goes into the LENGTH box as if typed there — focus follows the
first keystroke. Enter commits the segment; Escape cancels the run, as now.

**Not `A`.** `A` is SHAPE in the default profile (`profile-manager.js`:
`shape: 'A'`) and `P` on the office profile, so pressing it mid-run would arm a
tool rather than move a caret. **Recommended TAB** — what AutoCAD and Revit
dynamic input both use, already the "next field" idiom, and not a tool letter
in any profile. `<` is free as a dedicated second key and is literally the
angle symbol (`@10<45`). *He has not answered this yet.*

**What the number may look like:**

> *"if they type 14 (it would be interpreted as 14ft) if they type 14.5
> (14'-6") if they type 14-6 or 14 6 or 14'6 or 14'6" or 14'-6" all interpreted
> as 14'-6""*

**Measured against `formatters.js` `parseArchitecturalLength` — five of the six
already work:**

| typed | reads as |
|---|---|
| `14` | 14'-0" ✓ |
| `14.5` | 14'-6" ✓ |
| `14-6` | 14'-6" ✓ |
| `14'6` | 14'-6" ✓ |
| `14'6"` | 14'-6" ✓ |
| `14'-6"` | 14'-6" ✓ |
| **`14 6`** | **error** — the only gap |

The parser has branches for the foot mark, the hyphen, a trailing inch mark and
a bare number, and none for "number space number". One branch to add.

**Decided, say it when it lands:** the same branch makes `14 1/2` parse, and it
reads as **14 feet and half an inch** — consistent with this field's rule that
a bare number is feet, and with `14 6` meaning 14'-6". AutoCAD reads `14 1/2`
as 14½ **inches** in an architectural field, so this is a deliberate
difference, not an oversight.

**Watch:** the typed number is what turns the TOY light off
(`promoteForNumber` on the length box, #746). Typing straight in must go
through the same path, or TOY would keep its light on while an off-foot length
is typed — the exact hole #746 was built to close. And the keystroke must not
reach the tool-letter handler on the way: the page's keys mean something
different while a run is live, and the key handler has to **state** that rather
than discover it.

### 3.8 — DRIVE-THRU: two banners with arrows, on both skins

> *"i'd like to make the options more obvious by adding them once the user
> selects the house type, for those 2 banners and arrows (red and white) to pop
> up down below. I circled the stuff on the left - when they click that stuff
> BONE / or the BANNER on the left it will DRAW the AUTOHOUSE at prespecified
> dimensions. if they click the stuff circled in green (arrow or the other
> banner on the right) they will get to DRAW the HOUSE OUTLINE"*
> … *"leave the other links up top beside the dog too"*

LEFT banner + arrow at the BONE → the autohouse at preset dimensions
(`#dt-build-now`). RIGHT banner + arrow → the outline trace (`#dt-outline`).
Both appear only once an entry is chosen — the same moment the sign's two text
links are offered today (`paintSign`'s `canTrace`). **The two text links beside
Gruff stay**: four doors to two verbs, which is what he asked for.

**Both skins, and the second is not a copy of the first:**

> *"on the ROUGH - drivethru version can you do it similar to the change on the
> Ruff version"*

He drew it as one row under the tiles:

```
[ DRAW HOUSE ]  →  (house)  →  [ DRAW HOUSE OUTLINE ]
```

**The ROUGH skin has no bone to point at.** MODEL.html hides both `#dt-screen`
and `#dt-bone` under `html[data-theme="rough"]` and gives `#dt-tiles` the whole
sheet (left 6%, top 13%, 88% × 72%). So on paper the arrows point at the HOUSE
press in the middle of the row, and the banners sit under the tiles rather than
beside a bone. Same verbs, same handlers, same "only once an entry is picked".

**And the press wears its number:**

> *"add the extra HOUSE BUTTON above in the popup area with the NUMBER on it
> (and also add the number to the one in the RUFF Drive-thru version"*

The number is the **bone wallet's balance**. `shell-bars.js`'s `BONE` markup
carries `<span id="bone-balance" data-bone-balance>` on the **bottom-bar**
press, and under ROUGH that press's art is a house rather than a bone — which
is why he calls it the house button. The press **inside** the sign
(`#dt-bone`) has the art and no balance today. So: ROUGH's house press in the
new row carries the balance, and RUFF's `#dt-bone` gets it too. **One wallet
read in two places, not a second counter.**

The two verbs exist and are tested (`model-outline-draw.spec.js`) — this is
presentation. The banner on the left and the bone (or the house press on
paper) are the same press, so they share a handler.

### 3.9 — LAYOUT: text at its true printed size at every zoom

> *"i notice the text sizes on the title of the viewport and the elvation
> within the viewports changes when i zoom in and out, can you put it at the
> exact size that it will PRINT when the layout is PRINTED so the user can
> adjust it if they need too"*

**The cause, found:** `LAYOUT.html`'s `zoom` is **pixels per inch of paper**
(clamped 10–300 at ~2819), and the text sizes are already in paper inches — so
they would preview correctly. Each is wrapped in a legibility floor that breaks
it:

```
2449:  ctx.font = `${Math.max(9, zoom * 0.3)}px ...`      // title block placeholder
2615:  ctx.font = `600 ${Math.max(9, zoom * 0.14)}px ...` // viewport title
2643:  ctx.font = `600 ${Math.max(9, zoom * 0.14)}px ...` // viewport title, second call site
```

0.14" is about 10 pt. **The floor bites below roughly 64 px/inch** — about
where a whole 11×17 sheet sits fitted to the window — so at the zoom he
actually works at, the text has stopped scaling with the sheet and reads
oversized; zoom in past that and it starts scaling again. That is exactly "the
size changes when I zoom in and out".

**The fix:** drop the floor on anything previewing print, so the size is
`zoom × <paper inches>` at every zoom. If a minimum is wanted for a thumbnail,
gate it on the `thumb` flag already passed around rather than on the live
sheet.

**Also check the text INSIDE the viewports.** The elevation labels, level tags
and dimension strings in his screenshot come from the plan/elevation painters
drawn into the viewport, not from those three lines. Look for the same
`Math.max` floor in `render-2d.js` / `cut-view.js` before calling it done — he
named both: *"the title of the viewport AND the elevation within the
viewports"*.

*"so the user can adjust it if they need too"* reads as: seeing the true size
is what lets him judge whether to change it. If he wants a text-size **control**
as well, that is a second job — ask before building one.

---

## 4. Older carry-overs

Still open, from before 16 Oct.

**BONEYARD: beams, columns and wall corners on the frame.** *"can you show the
columns and beams being produced onto the BONEYARD frame, i'd like to see the
beam and columns in here too"*, then *"i think it had wall corners before too,
that would also be nice it looksed good"*. The beams and columns are in the
drawing; nothing in BONEYARD.html reads them. For the wall corners, **find what
drew them in git history** rather than inventing a different mark.

**The upper floor over the garage has an EXT wall and door it should not.**
*"the upper floor doesn't need the 'ext' wall and door"* — the wall down the
left side of the room over the garage, where it meets the house, drawn as
exterior with a door in it. Needs: which wall record, and which rule raises it
(`placeBilevelFraming` / the fill walls in the overlap / the entry deck walls).

**AUTO DIMS must not string anything at an angle.** *"don't put any autodims at
angles - in angled houses, the drafter should add those angled dimensions
himself"*. Every auto string orthogonal; an angled wall still gets its
orthogonal extents strung. `auto-dims.js`. He added *"its not too bad though,
getting there"* — a refinement, not a breakage. **Blocks the foundation rows
below.**

**LAYOUT: a SCALE picker in the Edit in Model Space dialog.** A SCALE row under
the Y/N row; collapsed it shows the viewport's current scale highlighted,
clicking opens the full architectural ladder smallest to biggest, scrollable.

**FOUNDATION plan: the four exterior dimension rows, in order** (blocked by the
angle rule above). Innermost to outermost: **BEAM** (from each corner of that
wall to where a beam lands on it) · **FENS** (openings / grade-beam door bucks)
· **EXT CORNERS** · **FULL WIDTH**. Two refusals: *"leave those 2 out BEAM/FENS
if those aren't on that side of the building"* and *"don't show any INTERIOR
wall measurements or wall thicknesses."* Already right and must not regress:
*"those piles on the main house from the inside corner to the back are perfect
marked nicely too with colm dimensioned properly."* Not this job: *"the front
area landing colms and beams i will need to fix later."*

**Elevations: hidden-line removal.** Long diagonals run clear past the building
and the garage roof's rake paints over the house wall behind it; E4 reads as a
flat top with a step instead of a slope. **The geometry is right** — the plan
and roof plan agree — the elevation painter draws every body's edges with no
hidden-line removal. Flagged after a roof reshape turned out to be answering a
drawing fault with a building change.

**The lower roof is cut gable wherever it runs along a 2nd-storey wall.**
*"the main rule for that connection should be the roof should be designed in a
way (usually using gable design) to slope the main roof AWAY or to the SIDES of
the 2nd storey wall lines"* and *"the rest of the roofs not involved in the
connection to the second floor can be drawn as a normal HIP style roof that the
user can change to gable if they desire"*. #747 fixed the spike that was
cancelling the rule; **the partial-overlap split is still unbuilt** —
`raiseRoofOver`'s `against` only gables an edge shared END TO END with the upper
loop, so an edge that runs along the wall for *part* of its length stays an eave
and slopes into the junction. Also: a roof corner must be an outline corner, no
bevels.

**Dormers on a sloped roof.** *"i will need an option to add a dormer on a
sloped roof too"*. Nothing exists. Needs placement on a face, the face cut
around it, its own ridge and valleys in the roof skeleton, and the elevation
drawing it. **Ask him which kinds (gable, shed, hip) and what sizes before
building.**

**Gable corner eave detail.** One popup, four answers — 1 NORMAL GABLE EAVE
(soffit triangle flush with wall) · 2 NORMAL GABLE EAVE 2 (flush with the end
of the roof overhang) · 3 porkchop · 4 full front RAKE — raised from two doors:
the first gable on the ROOF PLAN, and clicking the eave triangle on EXT FINISH.
Plus: clicking a roof face on EXT FINISH toggles that end hip↔gable and raises
the same popup. What exists: `profile-manager.js` `GABLE_CORNER_STYLES =
flat | return | porkchop | boxed`; `roof-types.js` `cornerStyleOf`;
`geometry-2d` halves the gable-edge overhang for porkchop/boxed; MODEL's ROOF
tool already flips an edge hip↔gable. What is new: the popups, the toggle **on
EXT FINISH**, and **per-corner** rather than per-roof storage.

**Other standing items:** municipal bylaws; more eBay book links for the entry
shelf (affiliate URLs must be stored exactly as sent — campid/customid/toolid/
mkrid/mkevt intact); retiring BLUEJETTY after the logo test.

---

## 5. Questions waiting on him

1. **TAB or `<`** for the angle field (§3.7). TAB recommended; `A` is taken.
2. **The stair long-side threshold** (§3.6): is 7–10 ft really "nothing
   added", or should the flush beam start at 7?
3. **Gable corner detail #2** (§4): is "soffit triangle flush with the end of
   the overhang" the existing `return`, or a fifth detail?
4. **Dormer kinds and sizes** (§4).
5. **The two remaining 45s on his traced house** — the crickets at open inside
   corners. He looked at the roof plan on 16 Oct and said *"looks good
   though"*, so they stay unless he says otherwise. Note that the **hips** at
   45° from every outside corner are not a defect: two eaves meeting at 90°
   with equal pitch always bisect at 45°. The chamfer at the **inside** corner
   is `cricketRing` cutting the reflex corner back 2 ft each way, from his own
   ruling *"the valley 2ft from the corner so 2ft of extra watershed rather
   than valley running into the corner"*.
6. **The REPORT DESK address** (6 Nov). The problem-report card
   (`error-report.js`: ROUGH-DRAFTER HIT A PROBLEM on an uncaught error, and
   REPORT A PROBLEM in the foot lane) mails reports through the backup-email
   worker to `REPORT_TO` at the top of that file. It shipped EMPTY (*"not
   sure of the email i should use yet"*); on 10 Nov he picked
   **roughdrafter.com@gmail.com** and `REPORT_TO` holds it, so every report
   goes to the desk, plus a copy to the drafter if they type an address.
   With the desk empty and no copy address the button says SAVE REPORT FILE
   and the report lands on the drafter's computer instead. To change the
   desk, change `REPORT_TO`; nothing else changes.

---

## 6. Facts measured this session, so they are not re-derived

- **`parseArchitecturalLength` handles five of his six length forms** (§3.7).
  Only `14 6` fails.
- **`WALL_TYPES.totalIn`**: `stud_2x4` 3.5, `stud_2x6` 5.5, `insulation_6` 6.5,
  `concrete_8` 8, `icf` 11.25, `icf_13` 13.25, `pt_wood_fdn` 8.
- **`A` is SHAPE** in the default key profile, `P` on the office profile.
- **Parking**: Calgary 5.9 m, Burlington 6.0 m, Wainwright 6.5 m; crew-cab
  pickup 19–20.5 ft. (§3.3)
- **`roofSkeleton(roof)`** in `geometry-2d.js` returns the hip/valley/ridge
  arcs as `{ a: {x,z}, b: {x,z} }` — used by #750 for the boneyard's thin
  lines, and the roof plan draws the same ones.
- **`BL.layout(levels, deg, w, h, margin = 30)`** fits the bone to its box and
  centres it, so a narrower pane *is* a smaller model.
- **A timing test will flake under load.** `model-html-cut-views`'s section
  budget read **2.50** against a limit of 2.5 with three suites running; alone
  it reads **2.00**. Check for contention before believing a perf red.
- **`model-html-gestures` counts every control on the page** and holds the
  parity table against that list. Any new button or link needs a line there,
  with a note saying which absence row it touches (usually none).

---

## 7. If you are the new session reading this

The work is in `bluejetty/draft`. Start by reading `CLAUDE.md` in that repo if
one is present, then this file, then the section of §3 you are about to build.

Do not start any of §3 by guessing at the numbers — every one of them is his,
and every one was revised at least once in conversation before it settled. The
figures in this document are the settled ones.
