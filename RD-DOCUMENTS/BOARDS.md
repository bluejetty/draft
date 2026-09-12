# BOARDS — bluejetty/draft

The shared work list. Kept by Kevin (Port Admiral) from Devin's board export of
31 Aug 2026 plus decisions made in coordination since.

**Board numbers are Devin's.** He assigns them; this file records them. Board
numbers and PR numbers are different sequences that overlap — always write
"board #168" or "PR #168", never a bare number. Board #203 (3D reveal) and PR
#203 (the composer) are different things, and that collision has already caused
one error.

Items with no number are marked **NEW**, and Devin numbers them next time he
is awake. **There are five of them now — NEW-2 through NEW-6** (NEW-1 is
closed); the line here used to say "three", which was true when it was
written and had stopped being true without anyone editing it. A count in
prose has no test, so nothing fails when it goes wrong — the same failure
`SPEC-model-html-tiers.md` records against its own fixture-env paragraph.

---

## 1 · Critical — something is wrong on the live site

**Nothing. NEW-1 closed 4 Sep** — see below. Everything else on this board is
missing work, not broken work, and that is now literally true rather than
nearly true.

| Board | Item | Size | State |
| --- | --- | --- | --- |
| ~~**NEW-1**~~ | ~~**Elevations read as see-through in E2/E4.**~~ **DONE — and the entry was stale for three days.** The Rev 5 fix was in the tree by the 1 Sep squash merge and this board was never updated. Measured 4 Sep, not inferred: `proto/elevation-harness.js` pins the exact Rev 5 order — *"E4: the near wing's left rake runs ridge to eave, past its wall corner"* (to u = −4.15, past the corner at −2.14, the 2' overhang the board said was missing), the right rake likewise, and the far wing's ridge across the plateau. 21 checks green, and green on every CI run. **A rake that stopped in mid-air would fail the first of those by name.** The entry said *"out with Skipper now"* long after the session that owned it had ended — which is how a closed item reads as an open one: nobody lies, the note simply outlives the work. | — | Closed. |

Why it is the only critical one: auto-compose now deals E1–E4 onto every
default sheet set, so this defect appears four times on every job and reads as
a fault in the brand-new composer.

---

## 2 · Blocking others — small, and other work waits on them

These are hours, not days, and each one unblocks something bigger.

| Board | Item | Size | Blocks |
| --- | --- | --- | --- |
| **NEW-2** | **Note A — composition order.** *Rev 2, 3 Sep — most of this landed; the board was read, the code was not.* **Already merged** (`274c78f`, `9548d44`, `0aa7cd1`, `e093c89`): 1/16" is off the ladder (`AUTO_SCALE_PREFS = [1/4, 3/16, 1/8, 3/32]`, last resort 3/32); largest-that-fits is untouched; the set deals in Movie's order (`_composeDefaultSet`, `LAYOUT.dc.html:793`); a single view centres and a pair rows-or-stacks and centres as a group; fit measures the annotated extent through `VIEW_ALLOWANCE_FT`, named and zero so adding dimension strings later moves the chosen scale by itself; and the elevation over-measure is gone — `_viewFootprintFt` takes `yTopDrawn`/`yBottomDrawn`, not footing-to-ridge. **What remains is slots 3, 4, 6 and 8 — SITE, ROOF, floor-layout, electrical — and it is not a scale problem at all.** The composer says so itself at `LAYOUT.dc.html:793`: *no painter*, and for S-SLAB / S-FDN / E-POWER *no entities in the drawing format to paint*. `kind: 'site'` appears in exactly one place in the repo — the scale-family selector — so `SITE_SCALE_PREFS` (1"=10'/20'/30'/40') is a ladder with nothing on it. **Movie's ruling, 3 Sep: those sheets are NOT done, and NEW-2 still owns them.** The composer's comment says *"they are their own boards, not silent omissions"*, and an agent read that as reassigning them out of NEW-2 — it does not. It explains why they are absent; it does not close the item. **NEW-2 stays open on the sheets alone.** What that costs is no longer 2–4 h: SITE and ROOF want a painter that is still inside `MODEL.dc.html` (board #1), and S-SLAB / S-FDN / E-POWER have no entities in `drawing-format.js` to paint at all, so they want a format board first. `kind: 'site'` appears in exactly one place in the repo — the scale-family selector — so `SITE_SCALE_PREFS` (1"=10'/20'/30'/40') is a ladder with nothing on it. | sheets only; **not** the old 2–4 h | SITE + ROOF blocked on #1. Structural + electrical blocked on a drawing-format board. |
| **NEW-4** | **The build row lights up.** Turtle before the types, the garages before the bone, and the row's lamps inverted: **dim by default, bright while armed, softly lit once that thing exists in the drawing.** Lit state is derived from the model, not remembered — so it survives F5 and clears on a new drawing. **Each lamp reads its own object, so two, three or four can be lit at once** (house + split + both garages); there is no one-at-a-time rule. Art supplied by Movie, 1 Sep: turtle 1024², rabbit 330², both with real alpha. Today the buttons sit at full brightness always and only glow while armed; the bone is the only one that ever dims. | 3–5 h | Nothing waits on it, but it is the visible half of TOY MODE and the first thing anyone sees. |
| **NEW-5** | **The build row names the build, and the build type becomes real.** *Movie via Skipper, 4 Sep.* The row beside the bone becomes, in this order and all visible from the start: **BUNGALOW / 2 STOREY / BILEVEL / MODIFIED BILEVEL / DETACHED GARAGE**, with **ATTACHED GARAGE** appearing once a house exists, gated as it is today. Four visible house buttons, **no menu** — a drafter knows what a two-storey house or a bilevel is; nobody knows what "SPLIT LEVEL" means in this app, and a menu hides the first choice behind a click. **The button sets the build type up front, so the tour stops asking climb-or-roof** — one decision, made at the start, never asked again. `BUNGALOW` and `2 STOREY` is the pairing the repo already uses: bungalow means one storey in `tests/dynamic-levels.spec.js:27` and `project-page.js:24`, so nothing needs rewording and nobody should "fix" it later. **WHY IT IS HERE AND NOT JUST A RENAME.** The PROJECT page's section table **drives nothing**: `sectionTable` appears 11 times in the repo — 5 in `PROJECT.html`, 3 in `MODEL.dc.html` (all `format.sectionTable`: init, save, load), 2 in `drawing-format.js` — and **nothing outside `PROJECT.html` reads its rows**. Five of its six rows save with the drawing and change nothing that gets built. HOUSE is the exception, and only because it is `live: true` and writes the real assembly. The cause is not a missing wire: **BUILD HOUSE has no idea which build type it is building**, because there is no build type to read. A type chosen on the button is therefore not a cost of the rename, it is the missing input — it makes the other five rows mean something for the first time. New persisted key (`buildType` on the drawing) → a line in `RULES-persisted-keys.md` and an entry in `drawing-format.js`, same shape as the wall `position` field. **A bungalow is a 2 STOREY with the upper floor deleted** — that is already how `dynamic-levels.spec.js` makes one — so the button needs no new geometry, only to say which one it is. That is why this is a day and not a week. Changes the same row as NEW-4, which changes its **lamps**; this changes its **names and meaning**. They do not conflict and can land in either order. | 1–1.5 d | The PROJECT page's section table becoming real; bands 2 and 3 of the wall sections meaning anything |
| **NEW-3** | **Note B — auto section-cut placement.** Cut 1 through the stair showing treads in length; cut 2 through house/garage where attached; cut 3 always, in the unused direction. | 4–6 h | Depends on stairs-in-section: `cut-view.js` does not draw treads beyond the cut plane, so a stair-oriented cut currently shows nothing. Fix that first or the rule is decorative. |
| #4 (docs) | ~~Stale architecture docs.~~ **Landed as PR #206**, 31 Aug. `docs/ORIENTATION.md` landed alongside it as PR #207. | — | — |
| — | ~~`playwright.config.js` hardcodes port 4173 with `reuseExistingServer`.~~ **Landed as PR #205**, 31 Aug, 677/0. Set `DRAFT_TEST_PORT` and you always get your own server. | — | Unblocks running two agents on one box, and so the MODEL split. |
| — | ~~**Board #311 `pointer/outline-entry`**, PR #208.~~ **Merged 1 Sep.** | — | — |

---

## 3 · Large — days, and each needs a spec before it needs an agent

Ordered longest first.

| Board | Item | Size | Note |
| --- | --- | --- | --- |
| #305 | **Print / PDF export of the sheet set.** | 2–3 days | Devin's own top candidate. Nothing in the product is real to a customer until it prints. Landmine flagged: vector-PDF openings. Also needs the out-of-bones-at-print-time ruling. |
| #12 / #243 | **TOY MODE + the turtle.** `allowedMove()`, grip tabs, whole-foot rounding, the turtle's two verbs. | 2–3 days | Spec drafted: `spec-toy-mode-constraints.md`. The rules half is pure math and testable in node with no browser — build and prove that first, UI second. |
| — | ~~**RABBIT — four plans per press**~~ **CANCELLED 6 Sep**, Movie: *"we aren't doing the rabbit in any way"*. The real-estate / concept-plan area with data-driven styles survives it and is now its own row. | — | Kept as a line rather than deleted: it was 2–3 days of scoped work with a market case, and the constraint set no longer has to be built as a generator's input. |
| #13 | **Circulation and door placement.** | days, and unbounded | The hardest thing on the list, and not for technical reasons: there is no correct answer to encode, only taste. Collect rules of thumb long before this becomes a job. |
| #14 | **Specifications composer** — 8.5×11 flowing text, appended after the drawings. | 1–2 days | Needs the four document-processor answers first: pagination, keep-with-next, numbering that survives an insert, measured text matching painted text. |
| #1 | **Extract the plan painter out of MODEL.** | 1 day | Mechanical, with a worked example to copy (`cut-view.js`). LAYOUT cannot draw floor plans on sheets without it. Good overnight job — but one agent only, it is the big file. |
| #6 | **Persistence extraction.** `buildSaveData` / `applySavedData` / auto-resume are three lists that must agree. | 1 day | Worth doing because it is dangerous, not because it is big: a field missed in one list silently fails to survive a reload. |
| **NEW-6** | **MODEL.html tier 3 — the page becomes a drafting surface.** The ladder, and it is the live one: **3a is DONE, four rungs of four** (select `ec993b3`, corner `4e2be48`, save `75cc4ac` + close guard `be01325`, whole wall `a0c3841`, PRs #346 / #347), plus the store rung it forced on the old page (`8992ad9`, the stale write becomes a refusal instead of an eat). **3b** — the level switcher chrome — is Gilligan's and ordered. **3c** — draw and delete a wall — is Gilligan's and queued behind it. **The ladder lives in `SPEC-model-html-tiers.md`, not here, and the rule there is one entry per rung as it lands, with the commit.** This row exists so the board says tier 3 is running at all: it ran for five days while the spec's entire tier-3 section read *"not specced here"* and this file said nothing. **Do not plan a switcher off `activeLevelIdx`** — it is an index, `MAIN_FLOOR_LEVEL_ID` is an id, and they agree on every default drawing and disagree the moment a level is inserted. | 3b + 3c: a session each | Nothing waits on it. It is the tier that decides whether the new page replaces the old one or stays a viewer. |

---

## 4 · Medium — a session each, no dependencies

`#330` click-to-cut section boxes · `#169` auto windows + doors family ·
`#247` interior walls align to jog inside faces · `#303` inside-corner snap
pool · `#331` NAHB room-program defaults · `#198` room stamping step ·
`#315` the bone fills the gaps · `#319` skippable pre-build form ·
`#321` entry page rework · `#318` tray door/window centreline snap ·
`#2a` reorder the MODEL right-side menu to mirror the sheet order.

### CI runs the harnesses now — in plain mode, and 17 of 21 still take flags they ignore

**Done 4 Sep**, as a separate `harnesses` job in `test.yml`. Kept here rather
than deleted, because what it does NOT cover is the part someone will assume.

The entry below stood when nothing ran them at all. Three details of the
one-line fix it proposed turned out to be wrong, and each was found by trying
it rather than reading it:

    - run: for f in proto/*harness*.js; do node "$f" || exit 1; done

- **`*harness*` matches `proto/harness-args.js`**, which is a module, not a
  harness. Run directly it defines its exports and exits 0 — a permanent false
  pass sitting in the list. `*-harness.js`, with the hyphen, excludes it by
  construction rather than by a name someone has to maintain.
- **`|| exit 1` stops at the first failure**, so three broken harnesses look
  like one. Same reasoning as `fail-fast: false` on the shards: three green and
  one red is a diagnosis.
- **A glob that matches nothing runs nothing and exits 0.** Rename the files
  and every run afterwards is green having executed no code. The empty case is
  now an explicit error — this job's own instance of rule 0, and the one thing
  it is least able to notice about itself.

**Two harnesses could not have run here at all.** `load-order-harness.js` and
`palette-harness.js` required their subjects by absolute path —
`/home/user/draft/palette.js` — which resolves on exactly one machine. Pointed
at a root that does not exist, as CI's would be, both exit 1 with
MODULE_NOT_FOUND. They passed for a year because the only thing that ever ran
them was standing in the right directory. That is precisely the decay this
entry predicted, found the moment something other than a person ran them.

**What is still open, and it is not small:**

- **The mutation engines are not exercised.** Plain mode asks "do the checks
  pass?"; it never asks "can these checks fail?" A mutation engine that stopped
  mutating would sail through this job forever.
- **Seventeen of the twenty-one accept flags they do not honour.** Four carry
  the guard lifted into `proto/harness-args.js`. The rest take `--mutate`,
  ignore it, and print a green run — so a CI loop passing that flag would
  report seventeen passes for a mode that never ran. That is this entry's own
  failure mode, one level in, and it is why the job passes no flags.
- **`palette-harness.js` never reads `argv` at all.** `--total-nonsense` exits
  0 with a full green run. And the obvious fix is wrong in a subtler way, which
  is Gilligan's catch: `mutationMode()` accepts `--mutate` because it is in
  `FLAGS`, and the palette harness has no mutation mode to run, so it would
  take the flag and ignore it. **A harness with no mutation mode must reject
  all flags, not just unknown ones.**

The order matters: make the guard universal first, then a CI loop can pass
`--mutate` and mean it.

### The drawing does not obey the skin — 13 colours with no role, down from 18

Found 3 Sep while wiring `drawOrigin2D`, which hardcoded its green. It is not
one painter. Five of them carry colour literals no caller can override:

**Recounted on merged main, 4 Sep, and the recount separates two things the
first count did not.** A literal sitting behind a role read — `wallColors.wall
|| '#ffffff'` — is a *default*: a caller who supplies the role overrides it,
and the harness proves the role is read. A literal with no role at all cannot
be overridden by anyone. Only the second kind is the defect, and counting them
together made the problem look larger and less tractable than it is.

| painter | fallback behind a role | no role at all |
|---|---|---|
| `drawWallSeg2D` | 4 | 4 — the underlay tints, computed alpha |
| `drawRoof2D` | 2 | 0 — **fixed 4 Sep**, `draw-roof` + `draw-roof-guide` |
| `drawShape2D` | 0 | 1 — a white label back |
| `drawFixture2D` | 0 | 2 |
| `drawOrigin2D` | 1 | 0 — fixed 3 Sep |
| `cutChoiceMark` | 0 | 2 |
| `drawCutMarks2D` | 0 | 2 |
| `drawCutPreview2D` | 0 | 2 |
| **total** | **7** | **13** |

**What is left is thirteen, and none of it is a refactor.** Each needs a night
AND a day value *chosen* — the cut-mark family (`#ff3366`, `#994466`,
`#b04060`), the underlay tints, the white label backs. That is Movie's call,
not an agent's, which is why they have sat: the code change is trivial and the
decision is not.

**The rule the roof taught, worth having before picking any of them:** a colour
can stay ONE value if it is mid-tone — `draw-floor-edge` (#5980a6, 3.99 night /
3.71 day) and `draw-roof-guide` (#a3703f, 3.90 / 3.79) both clear the floor on
either ground, which is why neither ever needed a twin. A colour near either
end needs a pair. `#7a4a21` was dark, worked on day, and was 2.23 on night —
one shade too dark to serve both, and that was the entire bug.

**And drafter-chosen colours was considered and DROPPED, 4 Sep.** The palette
is not a preference: `draw-wall` is deliberately quiet at 1.30/1.12 because *a
plan does not shout its walls with fill*, the three grid weights must read in
order, and the roof guides must stay under the roof. A contrast validator
enforces the floor; it cannot stop someone picking a bright poche and a dim
edge, which is a legible drawing made illegible by taste. If the real need
appears it is a designed colourblind-safe skin — one table, validated by the
harness — not twenty-two pickers.

MODEL.html defaults to `mode=night`, so this is its default view. Measured
against the skins' own `surface-page`:

| painter | what | colour | night | day |
|---|---|---|---|---|
| `drawWallSeg2D` | wall stroke | `#1d1f20` | **1.00** | 14.79 |
| `drawWallSeg2D` | wall fill | `#ffffff` | 16.55 | **1.12** |
| `drawRoof2D` | roof stroke | `#7a4a21` | **2.23** | 6.64 |

`#1d1f20` **is** `surface-page` on night. The wall outline is painted in
exactly the colour of the page it sits on. And the mirror case is just as
real: the white fill scores 1.12 on the day page. `drawWallSeg2D` is built for
a light sheet — white paper, black ink — and half-fails on each skin, in
opposite halves.

**Why nothing caught it.** Every MODEL.html spec asserts geometry, counts, or
grid colours; none asserts wall ink. On night the walls still appear, because
the white fill is loud — only the edge that separates a wall from the page is
gone. A page that looks populated is not a page that is right, and the suite
was measuring the half that works.

SPEC-skins promises "the chrome and the drawing move together and neither can
drift from the other". Today the chrome moves and the drawing does not.

**Not fixed here, deliberately, and it is two decisions not one:**

1. **Which roles** — a wall needs a fill and a stroke, a roof needs its two
   browns, a fixture its ink. Four or five new roles, mechanical once named.
2. **What colours** — and SPEC-skins §9 lists "the actual colours of any of the
   four skins" as explicitly undecided. Night is not a recolour of day: a wall
   on a black sheet is not white paper with a black line around it, and
   choosing what it *is* is Movie's, not a measurement.

Do (1) blind and you invent (2) by accident, which is how `#557a46` came to be
the datum's colour on a skin nobody had checked it against.

---

## 5 · Small — an hour or two each

`#306` comic-book arrows · `#320` bone sounds · `#312` house number ·
`#206` tooltips · `#207` level sound · `#153` filename convention ·
lossless re-encode of the entry-page PNGs (49 KB → 385 KB in PR #204, on the
first page an iPad loads).

### The SPLIT row can never be the live one

Found 5 Sep while checking Skipper's NEW-5 build-type mapping. `SPLIT` is a
complete section-table row -- visible (`project-page.js:51`), in `HOUSE_LIKE`
and `SPLIT_TYPES` so it has a WOOD FILL cell, carrying its own `SPLIT_BASE`
defaults, and **storable** (`drawing-format.js:986`). A drafter can type
numbers into it and they persist.

Nothing will ever read them. A drawing is ONE building, and once the build
type picks the live row there is no build type called SPLIT -- Movie, 4 Sep:
*"a SPLIT is either a MODIFIED BILEVEL or BILEVEL"*. Skipper's
`sectionRowForBuildType` returns `bilevel`, `modifiedBilevel`, `house` or
null, and correctly never returns `split`.

Two ways out. **A:** SPLIT stops being a row and stays a defaults holder --
`SPLIT_BASE` feeds BILEVEL and MOD BILEVEL exactly as now. **B:** it stays
visible but read-only, a reference row. A is recommended: B leaves a row on
screen whose only content is numbers already shown on the two rows below it,
and it would be the table's only read-only row. Five references in
`project-page.js` and `drawing-format.js`, plus the harness's `SPLIT_FAMILY`
and two mutations. **Movie's call, not made yet.**

### `roof.heel` does not know the heel can be overridden

`MODEL.dc.html:_roofHeelIn` derives fascia + overhang × pitch per roof plane
and serialises it as `heel:` on every save. Since #283 the PROJECT page can
override the heel, and that override is building-level -- so a raised heel
shows on the page while the saved `roof.heel` keeps the derived number.

Not dead code, and this entry exists partly to correct a claim that it was:
`tests/roof.spec.js:55` and `:81` read it, and `drawing-format.js:361` clamps
overhang and pitch *"so the stored heel is always derivable"*. The field is
deliberate.

The open question is whether the two are allowed to differ -- per roof plane
against the building's typical -- or whether the override should reach the
planes. Low impact today, since the only reader is a spec. It crosses
`MODEL.dc.html` and `PROJECT.html`, so it wants deciding before either side
grows a second copy of the arithmetic.

### #351 · Four distance functions, and they disagree where nothing looks

Found by Skipper 8 Sep, reading ahead of Gilligan's `_distToLineSeg` collapse
rather than after it. Verified against all four sources before being written
down, and recorded in `proto/outline-accessors-harness.js` beside the
asymmetry note.

**Line references measured against merged main at `8804ca5`, not against a
working tree.** The first draft of this entry cited `:4872`/`:4905`/`:4952`,
read correctly before the fold-in PR added ~90 lines to `MODEL.dc.html` above
them — true when taken, stale by thirteen lines when quoted. The other three
files were untouched and their numbers held.

The repo measures point-to-segment distance in four places. They agree on
every segment a drafter draws and disagree on the one nobody does — a
**zero-length** segment:

**SIX copies, not four, and three distinct mechanisms.** The first version of
this entry listed four; `cut-view.js` and `closets.js` were missed.

| function | where | degenerate mechanism | answer |
| --- | --- | --- | --- |
| `pointToSegment` / `_distToLineSeg` | `geometry-2d.js` (shared export) | `len2 < 0.0001` | `Infinity` |
| ~~`distToSegment`~~ | ~~`MODEL.dc.html:4885`~~ | ~~`\|\| 1`~~ | **collapsed — see progress** |
| `distToSegment` | `cut-view.js:1135` | `\|\| 1` | distance to `a` |
| `distPtSeg` | `auto-stair.js:101` | `len2 > 0 ? … : 0` | distance to `a` |
| `distToSeg` | `proto/elevation-harness.js:141` | `len2 ? … : 0` | distance to `a` |
| `pointToSegment` | `closets.js:118` | **explicit `len2 < 1e-12`** | distance to `a` |

`closets.js` is not a sixth copy of the same accident: its guard is deliberate
and commented. And the thresholds differ by ten orders of magnitude — the
shared export's floor is `0.01 ft`, a real length of about ⅛", while closets'
`1e-12` is a true numerical-zero guard. **A 0.005 ft segment is degenerate to
the shared export and perfectly ordinary to closets.** They disagree about
*when* the rule applies, not only what it answers.

So a degenerate segment reads as **"right here"** to three of them and
**"infinitely far"** to the one PR #349 collapsed onto.

**Why this is a trap and not a tidy-up.** `distToSegment`'s two callers are
proximity tests at `<= 0.6` (`:4918`, the roof E/G tag reach) and `<= 0.8` (`:4965`), and the
elevation harness uses its variant as an on-boundary `<= eps` (`:180`). A
degenerate edge currently lands **inside** those thresholds; under the shared
export it lands outside. The tag simply stops being assigned and on-boundary
becomes permanently false. **No error is raised**, and no existing fixture
would catch it — a zero-length edge is not something anyone draws on purpose,
so it is absent from every test drawing. It arrives from an import or a
collapsed corner, which is to say: on a real job, not on ours.

**The order of work is the whole point.** Write the failing test first — a
zero-length edge inside a 0.6 threshold, proven to flip — then collapse. A
collapse done the other way round is green on the way in and wrong on a
drawing nobody has yet opened.

Nothing is broken today; all four are correct where they sit. This is a
standing note against a future tidy-up, not a defect. Whether the three
should adopt the `Infinity` rule or the shared export should grow a caller-
chosen degenerate answer is the open question, and it wants deciding before
somebody collapses them on instinct.

### It is a CHAIN, not a function — and the 0.6 site's reprieve was imaginary

Measured while doing the MODEL.dc.html half. Three `|| 1` guards compose, each
prudent-looking on its own line:

| # | site | effect on a collapsed edge |
| --- | --- | --- |
| 1 | `len = Math.hypot(dx, dz) \|\| 1` (`MODEL.dc.html:4750`) | `ux, uz = 0` — and `edge.len` reports **1 ft for a 0 ft edge** |
| 2 | `nlen = Math.hypot(nx, nz) \|\| 1` (`:4768`) | the normal becomes the **zero vector** |
| 3 | `len2 = dx*dx + dz*dz \|\| 1` (`:4887`) | masks the zero-length segment |

The 0.6 call site builds its segment as `cWall + n·(overhang + 1)`, so the
obvious reading is that the `+1` floor keeps it at least a foot long and it can
never see a degenerate segment. **It can.** `offsetOutlineVariable` leaves a
coincident point exactly where it was, so guard 2 hands the edge a zero-length
normal and the stub collapses to a point for any overhang. The route is the
normal, not the overhang.

Guard 1's lie — a zero-length edge reporting `len` as 1 ft — feeds the gable
splitter. Recorded as fact; nobody's order yet.

**Nobody can draw this input.** The tracer refuses a repeat click within
0.01 ft (`MODEL.dc.html:12706`, `:12906`), which is why no test drawing in the
repo contains a collapsed corner and why the behaviour is only reachable from
an import.

### Progress (this is also the board #346 note — #346 has no entry in this file)

**Done:** the `MODEL.dc.html` copy is collapsed onto the shared export with an
explicit distance-to-`a` fallback local to `_handleTourRoofPress`. Exact on a
truly zero-length segment; differs from the old formula only for segments
shorter than the 0.01 ft floor but not zero, and there by at most the segment's
own length — measured worst case 0.0099 ft, about ⅛", against thresholds of 0.6
and 0.8 ft.

Both call sites had **no behavioural coverage at all** before this; the
sound-edge regression guard was written first.

**Remaining — SKIPPER'S LANE:** `auto-stair.js`, `cut-view.js`, `closets.js`,
`proto/elevation-harness.js`. (In flight as board #346's outboard half.)

### Board #346, the MODEL half: closed as ALREADY DONE, and made permanent

Censused twice independently, by Gilligan and by Devin with different probes,
against merged main `0eb2178`. **Zero private point-to-segment copies remain in
`MODEL.dc.html`:** PR #349 turned `_distToLineSeg` into a forwarder and PR #352
collapsed the last one, the tour roof's `distToSegment`, leaving a documented
adapter that calls the shared export on the next line. `_edgeOnOutline` holds no
copy either — it goes through the forwarder. The board entry was simply dated.

A negative claim wants better evidence than one search, which is why it was run
twice by two people looking for different things.

So the MODEL half produced a **standing guard** rather than a rewrite —
`proto/no-inline-distance-harness.js`. The one-time cleanup is now a property:
the next inlined copy is caught the day it lands, not in a survey six weeks
later, which is how ~10 copies accumulated to begin with.

**The obvious guard would have been wrong, and measurably so.** Squared length
(`X * X + Y * Y`) appears **14 times** in live code here — screen distances,
drag thresholds, honest arithmetic with nothing to do with segments — so
guarding on it would cry wolf until someone deleted the guard. The real
discriminator is the **clamp**, `Math.max(0, Math.min(1, …))`: the step that
turns a distance-to-a-point into a distance-to-a-segment. Zero occurrences
today. Measuring the candidate patterns before writing the guard is what bought
that.

**Size:** the remaining outboard sweep, 2–3 h including its tests. **Blocks
nothing.** The degenerate rule, its mutation coverage and the full chain are
pinned in `proto/outline-accessors-harness.js` and
`proto/degenerate-chain-harness.js`.

### Board #346: CLOSED WHOLE — and the three boards its verification opened, closed void

The outboard half landed in PR #359: `LAYOUT.dc.html`'s `edgeOnOutline`
collapsed onto the shared export, `build-house.js` kept its own copy with the
reason written down (its divergence is the 1e-6-to-0.01 ft floor gap, reachable
because `offsetOutline` emits 0.001 ft edges from ordinary geometry), and
`tests/section-garage-slab.spec.js` added as the observable the collapse had
been missing — breaking `pointToSegment` outright had left all sixteen layout
specs green.

**Three boards, #360 / #361 / #362, were opened out of that PR's suite run.
All three are void, and all three are now CLOSED** — reconciled 9 Sep against
the merge rather than against the intention:

| board | state | evidence on main |
|---|---|---|
| **#360** `savedDrawing` wait | **closed void** | no race; the 662 call sites need nothing |
| **#361** entry-coach overlay | **closed void** | the coach is not a defect; a neighbouring worker was wiping `draft-entry-coach-seen` |
| **#362** worker right-sizing | **closed, aimed the wrong way** | the default was already correct; the guard is the outcome |
| — the guard | **MERGED**, PR #361 (`53c03e2`, merge `3ed8f1e`) | `playwright.config.js` throws at config load on a resolved override above 1 |

**PR #361 and board #361 are different things and both appear above** — the
collision this file's own header warns about, landing for the second time.
The merged PR is the guard; the void board is the coach.

Their evidence was manufactured by the run that found it.

**What happened.** The 9 Sep suite runs were invoked with `--workers=4`. The
config sets `workers: 1`, `README.md:48` warns against overriding it, and
`test.yml:224` explains why: every spec shares one origin, so every spec shares
one `localStorage` and one IndexedDB, and `helpers.openModel` clears both on the
way into every test. Two workers on one machine therefore delete each other's
storage mid-test. Seven distinct red names came out of that across two machines,
in two shapes, both of which read exactly like product defects:

| wiped by | what the test sees | names |
|---|---|---|
| `indexedDB.deleteDatabase` | `savedDrawing()` returns `null`, or the pre-edit value from a store recreated behind it | `project-page:64`, `project-page:100`, `defaults:50` |
| `localStorage.clear()` | `draft-entry-coach-seen` wiped mid-test; the dismissed coach returns and eats every click until the 180 s budget is gone | `design-notices-wired:65`, `perf-notice:35`, `perf-notice:62` |

`perf-notice` holds no storage key of its own — measured, not assumed — so both
its failures route through the coach flag like the rest.

**The control settles it.** The same suite, same tree, at the configured
default: **zero failures**, with the seven dormant `room-grow` specs skipping by
design. Every one of the seven suspects ran and passed, including
`perf-notice:35`, which had been the single strongest case — the only failure
ever seen on two different machines.

So: **#360** (a `savedDrawing` wait) is void — there is no race, and the 662
call sites need nothing. **#361** (the entry-coach overlay) is void — the coach
is not a defect, a neighbouring worker was wiping its dismissal flag. **#362**
(worker right-sizing) was aimed the wrong way: the default is already correct
and what was missing was a guard against overriding it.

**What this cost, recorded because the shape is the lesson.** A day of two
crews' time; three boards written on false evidence; and a product change — save
beacons added to `PROJECT.html`, `STANDARDS.html`, `SETTINGS.html` and
`SPECS.html` — ruled and about to be written to fix a race that does not exist.
That change would have "worked", because removing the flag removes the clobber
whether or not a beacon is there. It would have gone green and been believed.

The error was caught by reading `playwright.config.js` and `test.yml` — the
sources that had said so in writing the whole time — rather than by any further
measurement of the failures themselves. Nine measuring mistakes were made that
day against zero code defects; the last was the expensive one.

**The one honest outcome is the guard**, in `playwright.config.js`, and it is
on main: `53c03e2`, merged as PR #361 in `3ed8f1e`. A worker
override resolving above 1 throws at config load, naming the reason. A throw and
not a warning, deliberately — the entire cost of that day was that the failures
looked real and nothing said otherwise, and a warning scrolls past. Percentages
resolve before the check (`--workers=50%` on a four-core box is the same mistake
spelt differently). Sharding is untouched and remains the supported way to go
parallel: a shard gets its own runner and therefore its own origin, and CI's
`--shard=N/4` inherits `workers: 1` and never reaches the guard.

**PR #359's body is wrong about this and has been corrected in a comment on the
merged PR.** It describes its three suite failures as characterised repo flakes
caused by `--workers=4` oversubscribing a four-core box, and recommends a board
line to that effect. The conclusion — that the diff did not cause them — holds,
and holds better than when it was written; the mechanism given is wrong, and the
recommendation is close to the opposite of the real lesson. Left in place with
the correction attached rather than quietly superseded.

### Adoption check, 9 Sep: `design-notices.js` HAS callers, and no board is needed

Checked because two documents still say otherwise —
`HANDOFF-to-devin-7sep.md:104` (*"has no callers… nothing renders it"*) and
`PRE-TIER3.md`'s press-and-flag line (*"wants an owner"*). **Both are stale,
and the wiring landed the same day the handoff was written**: `a824547`, PR
#334, *"design-notices.js gets its callers"*.

| export | caller on main |
|---|---|
| `garageDoorHeadNotice` | `PROJECT.html:1544` — the garage door head against the wall height |
| `garageDoorHeadLimitIn` | `PROJECT.html:1556` — the tallest door that clears |
| `stairRefitNotice` | `MODEL.dc.html:22766` — a stair drawn at a rise the level no longer has |

`tests/design-notices-wired.spec.js` covers the half the module's own harness
could not: that a drafter sees it. **It asserts absence as well as presence**,
which is the half that matters — a banner that appears once and never leaves
is a bug a presence-only test passes on.

**Two counting traps on the way to that table, either of which gives the
opposite answer.** A direct grep for `DraftDesignNotices.<fn>(` reports **zero**
for `MODEL.dc.html`: the call goes through a `const N = window.DraftDesignNotices`
alias, so the module reads as unused exactly where it is used. And an export list
built by *shape* (`grep -E '^\s+[a-zA-Z]+,'`) picks up object-literal keys and
local consts — it reported `placedRiseFt` as an export when it is a local inside
`stairRefitNotice` and a field of its return value. The real surface is the frozen
object at `design-notices.js:167`, and two of its five entries (`formatFtIn`,
`formatIn`) are harness-only, which the module says in its own comment. Read the
export statement, not something that resembles one.

**`MODEL.html` references it zero times**, which is the number Tier 3 watches:
when a rung makes the new page reach for this module, that is a
module-review-gate event, not an adoption one.

**So there is no adoption board to open.** The one case still unwired is
deliberate, not forgotten: pressing BUNGALOW on a drawing with a built OVER
GARAGE belongs to board #333, whose build row is not on main, and the module
says in its own header why a function returning null until then would pass its
harness for the wrong reason. Both stale sentences are corrected in place.

---

### The serializer gate: #375 is the first legitimate exception, and the diff tool was labelling by line

**Gate duty for a Tier 3 rung is `node proto/w0-census.js --json` at main before
and after, diffed by `proto/w0-census-diff.js`**, so *"this rung never touched
the old serializer"* is a measurement rather than a claim. That duty had no
entry in this file: the paragraph that carried it was folded away on 9 Sep when
two design-notices entries were collapsed into one, and since then the
assumption has lived only in a tool header. Written down here so the next hand
finds it where they look.

**THE EXCEPTION. #375 touched `_serializeDrawing`, deliberately, with a ruling
behind it.** One line —

    wallType: wall.legacyWallType || wall.wallType

— under `RULING-substitution-is-not-a-save`: a wall whose retired assembly this
app cannot draw is **painted** as the nearest surviving one and **saved as
itself**. +154 chars of serializer text, and **no key dimension moves** —
literal keys, spreads, state keys and persisted fields are byte-identical across
the merge.

So the standing sentence is not *"nothing touches the old serializer"*. It is:

> **The old serializer is touched only with a ruling behind it, and a touch that
> moves the format is a different event from one that does not.**

That is why the diff prints `chars` on its own line, above every key dimension.
Anyone re-deriving the frozen-serializer assumption from a green gate run will
get it wrong in the direction that matters — silently permitting a format change
because the last exception was benign.

**AND THE TOOL WAS CRYING WOLF.** Across #375 the diff reported all 21
conditional spreads as simultaneously added and removed. Nothing about them
changed; the rung inserted two comment lines above them and the label was
`line 26 keys=auto`. **A line number is not an identity** — any insertion
anywhere above re-labels every entry, so the dimension that exists to answer
*"did the format move"* answers yes to edits that cannot move it. The verdict
that day was still correct, which is the worst way for the noise to arrive: the
row that cried wolf was standing next to the row that was right.

Fixed in `6a1730b`. An entry is identified by **what it writes** — key-set, tier,
branching — and labels are **counted, not deduped**: three separate spreads write
`auto`, so a Set of key-sets reports a 21-entry list as 19 and calls a deleted
spread untouched. That is measured, not assumed — the naive variant scores *no
change* on the mutant that removes one of the three. Five mutants run, five
killed; the identical pair still reports untouched; unreadable input still exits
2 rather than saying "no change".

**The re-run this prompted found the census document seven dimensions stale**
(`5a1cee7`) — including a `methods` row that reads 21 before and 21 after with
four members changed. It also found **W0's Findings A and C already closed** by
`83dba6f` and `16a9b60`, with neither closure written down. **Finding B is the
only one still open**, and it is a decision for W1 rather than a repair.

---

### FINDING — the stair tool tests the CENTRE of an opening, in two places

Found while fixing `areas.js` (verdict 2, `308941d`). **Written up, not patched:
it is old-page interaction and a different lane.**

`_commitSurfaceOpening` carries a written refusal to wire `ringInsideRing`,
because doing so *"turns three stair-opening specs red"*, with the captured
geometry:

```
opening  [[2, 0.4583], [12.4167, 0.4583], [12.4167, 3.5417], [2, 3.5417]]
host     [[-10, 0],    [10, 0],           [10, 12],          [-10, 12]]
```

and closes: *"Either that footprint is wrong and the specs pin a defect, or the
scenario is artificial. That is a ruling."* **It is a defect, and it sits in the
stair tool rather than in the arithmetic.**

`_handleStairOpeningClick` does check containment before committing — and checks
**the centre of the rectangle and nothing else**:

```js
const centre = { x: (points[0].x + points[2].x) / 2, z: (points[0].z + points[2].z) / 2 };
const floor = this._floors.find(f => ... && this._pointInOutline(f.points, centre));
```

The opening is 10'-5" long, anchored at `x=2` on a floor ending at `x=10`, so
the centre sits at ~7.2 — comfortably inside — while the far end is 2'-5" past
the slab. The tool's own refusal says *"The opening must land inside this
level's floor"* and means it; the test it uses cannot deliver it. All three red
specs are the same click pair copy-pasted.

**It is in TWO places, not one.** The order that surfaced this named
`_handleStairOpeningClick`; `_buildStairOpenings` — BUILD HOUSE's automatic
openings — repeats the same centroid-only test:

| site | method |
|---|---|
| `MODEL.dc.html:15861` | `_handleStairOpeningClick()` — the drafter's click |
| `MODEL.dc.html:15900` | `_buildStairOpenings()` — BUILD HOUSE, automatic |

So it is not a one-line fix. Both want the same `ringInsideRing(points,
f.points)` in place of the centre test, and a fix landing on only the first
leaves every automatically-cut opening unguarded. (`:13133` also tests a centre
but is the garage-slab coverage check, a different question — left alone.)

**Not artificial, and not legitimate either.** It is a placement a drafter
reaches honestly — the stair does not fit between the click and the far wall —
which the tool accepts and the arithmetic then charged for, silently, from the
opposite end. When the guard lands, those three specs move their anchor click to
where the opening fits and go green on their own terms. Moving the clicks
*before* the fix would be editing tests to pass.

**A comment at the second site cites an authority that refutes it.**
`_buildStairOpenings` explains itself with:

> *"NOT GUARDED HERE, and deliberately so. The manual path checks the whole
> opening against its host (see `_commitSurfaceOpening`)"*

`_commitSurfaceOpening`'s own comment, ~270 lines away, opens *"NOT GUARDED
YET"*. Neither half of the claim is true — the manual path checks the centre,
and the function it points at checks nothing — and the false half is
load-bearing, since it is the stated reason the automatic path goes unguarded.
Sweep that sentence with the fix.

**The same comment raised a second question, and I got that one wrong too.** It
said:

> *"the opening is keyed to the wall FACE; the floor may be drawn to the
> centreline. That relation is unmeasured, so no guard goes here until it is."*

I read that as a real precondition and wrote here that measuring it was the
fix's first task. **It was already measured, in the repository, by an assertion.**
`tests/stair-opening.spec.js:69` states the offset as a constant —
`WALL_IN_FACE_Z = 5.5 / 12` — and line 126 asserts the opening's near edge lands
on it. The interior face is 5½" INSIDE the wall's drawn line, so keying to the
face pushes the opening further into the floor, never out of it; `_stairAutoFit`
nudges the generated footprint inward as well. The relation resolves in the safe
direction on both paths and gates nothing.

So my line here was the same failure as the comment it was describing: it sent
the next reader off to derive something the specs already assert, which is worse
than silence. The three specs were red for **arithmetic** — a 10'-5" opening
anchored at x=2 on a floor whose right edge is x=10 overhangs by 2'-5". The
fixture was artificial in placement, not in dimension.

**Ruled (Devin, 9 Sep): it does not block the `areas.js` repair, and the
direction is worth stating because it is the reassuring one.** Work the two
cases through:

| how the floor is drawn | where a face-keyed opening sits |
|---|---|
| to the wall **centreline** | **strictly inside** the floor ring, by half a wall thickness — the centreline polygon is the larger one |
| to the **interior face** | exactly **on** the ring, and boundary counts as inside |

So neither case puts a correctly-placed opening outside, and no tolerance is
needed for the arithmetic. (The ruling as first written said such an opening
"lands on the ring"; that describes the second row only. The first row is
strictly inside, which is a stronger result, not a weaker one.)

What it *does* block is a tolerance-free pass/fail in the **stair tool's**
future guard: an opening over by an inch and one over by four feet must not
report the same, so that guard should carry the measured overhang rather than a
bare boolean, and the half-a-wall-thickness case wants naming in its harness
with the measurement attached. If floors turn out to be drawn to centreline
systematically, that is a wall-thickness offset applied once at the comparison —
never a change to `ringInsideRing`, which is the shared containment primitive
and has its own harness.

**Until it lands, the AREAS dialog line is what the drafter sees**, and on those
drawings it is telling the truth about a real overhang.

---

---

## 6 · Parked

**Editable dimensions — change the house by typing a dimension.** Movie's
idea, 31 Aug; parked by his own ruling, and rightly.

- **Movie's second thought solves the hard half, 31 Aug:** don't let the user
  edit any dimension and then work out what they meant. **Offer a curated set
  of changeable dimensions, each stating its consequence in words** — "Bedroom
  2 +1'-0", Bedroom 3 −1'-0"". The ambiguity never arises, because the app only
  ever offers moves it already understands.
  - An offer must always name **both** halves. The room that loses space is the
    half nobody notices, and it is the half that causes the complaint.
  - **Room minimums decide what gets offered.** `room-standards.js` already
    knows each room's floor and already flags UNDER MIN on the plan, so a move
    is offered only while the room giving up space stays legal. The house
    cannot be steered into a bad plan, and the offer vanishes exactly where it
    would become one.
  - This makes it **TOY-MODE-safe after all** — a curated list of legal moves
    with stated consequences is precisely what a toy is. Full free editing of
    any dimension stays a DRAFTING-mode gesture.
- Easier later, once grip tabs exist — an interior dimension edit is "move that
  wall's face", the same move a grip tab makes, typed instead of dragged.
- Splits into an easy half and a hard half. Editing an **overall** dimension is
  unambiguous: the house grows that way. Editing a link in the **interior
  chain** is not — the chain must keep summing, so either the house grew or the
  next room shrank, and only the drafter knows which. That is the part needing
  a way to explain itself before it can be built.
- Prerequisite: interior dimensions must exist and be correct first.



*Money / marketing / lore* — parked until printing exists, which is the right
call: `#52` backend · `#262` watermark membership · `#254` bone tokens ·
`#273` drafter network · and the rest of Devin's list.

*Far future* — `#188`/`#189` 3D export and walkthrough · `#203`(board) 3D
reveal · `#240` scan-to-house · `#213` US regions.

---

## Recommended next six

For the next day or two, in this order.

1. ~~**NEW-1 see-through elevations**~~ — **done**, in the tree since the
   1 Sep squash and pinned by `proto/elevation-harness.js`. Confirmed by
   measurement 4 Sep, after the entry had read *"out with Skipper now"* for
   three days past the end of that session.
2. **NEW-2 — the SITE and ROOF sheets.** The scale and placement halves
   landed 1–2 Sep and must not be rebuilt; what is left is the sheets
   themselves, which Movie confirmed on 3 Sep are still outstanding. They
   wait on **#1**, so #1 goes first and NEW-2 follows it. The structural and
   electrical sheets wait on a drawing-format board that does not exist yet.
3. ~~**#4 stale architecture docs**~~ — landed, PR #206 and #207.
4. ~~**The playwright port collision**~~ — landed, PR #205.
   ~~**Board #311 pointer/outline-entry**~~ — landed, PR #208, 1 Sep.
5. **#1 extract the plan painter** — mechanical, has a worked example, unblocks
   floor plans on sheets. Ideal overnight job for one agent alone in the big
   file.
6. **`allowedMove()` — the TOY MODE rules only, no UI** — pure math, node
   harness, no browser. Proves the whole mode is possible for a fraction of the
   cost, and everything else in TOY MODE sits on top of it.

Deliberately **not** in the six:

- **#305 print/PDF**, despite being Devin's top pick and the most valuable
  thing on the list. It is the biggest job here and it wants the sheet set
  finished first — printing a set that is still missing its site and roof
  sheets means printing it twice.
- **NEW-3 Note B section cuts**, because stairs-in-section has to land first.
- **Anything in TOY MODE with a user interface**, until the rules underneath it
  are proven.

## Standing rules

### 0 · Before believing a measurement, make it come out wrong on purpose

Gilligan's, 4 Sep. It is first because it is the general form of several of the
rules below.

**It covers half of the evening's eight instances and not the other half, and
the split matters because the two halves need opposite responses.** The first
draft of this entry claimed all eight — written ten minutes after the rule
requiring a re-read, and corrected by one.

- **A measurement that cannot come out wrong** — this rule. A `10/10` from a
  harness with no mutation engine, `stall === shower` where both sides are
  `''`, refusals with no control, a `< 6` threshold that `0` satisfies, a
  `--mutate` flag silently ignored, an `exit=$?` reading a pipe. The instrument
  was never able to report failure.
- **A value that went stale silently** — rule 2, not this one. Superseded CI
  webhooks, a forty-minute-old merge dry-run, deleted branches' tracking refs.
  The instrument was fine and the subject moved underneath it.

Both present as *a green result you should not trust*, which is why they blur.
But staleness is fixed by asking again, and blindness is not: **a second look
at a blind instrument returns the same answer with more confidence.** Advice
that merges them tells you to re-read at exactly the cases where re-reading is
useless.

The structural reason they cluster: **verification code has no verifier.** You
check the subject with the harness and you check the harness with nothing. The
regress stops there — and it stops precisely at the code written fastest,
because by the time you are writing it the interesting problem feels solved.

So make the instrument produce a failure once, deliberately, and watch it say
so. Mutation testing is this rule applied to a test suite. A control beside a
refusal is this rule applied to a fixture. Re-reading a rule against the figure
it cites is this rule applied to prose. Each is the same move: **manufacture
the negative, because a passing run never demonstrates that failing was
possible.**

Two worked examples from the night it was written, both found within minutes of
each other:

- A harness summary line that read `5/5` was fed a deliberately inert mutation
  and dropped to `5/6`, exit 1. Without that, `5/5` and "the summary is
  hardcoded" are the same output.
- An `exit=$?` written after a pipe reported `0` on a **deliberately broken**
  harness, because it was reading `tail`'s status. Unpiped, the same harness
  reported `1`. The check was written in the act of verifying a fix for an
  earlier instance of this rule.

Cheap, and it is the only thing on this page that reliably catches the others
before they ship.

A third example, from later the same night, in the work of the person who had
just written the two above:

- A spec asserting that MODEL.html paints walls **through the skin** passed.
  Then the page was broken on purpose — `paintWalls` made to stop supplying the
  colours, which is the exact regression the spec exists to catch — and it
  passed again. Both tests. The statistic counted pixels at 240-or-brighter and
  called them "the wall body", but **the day page is `#f2f2f3` — 242 on every
  channel** — so it was counting nine hundred thousand pixels of paper. Against
  a number that large, `night < day` is true whatever night does: an unskinned
  night canvas scored 12106 against 897487 and satisfied it.

Rule 8's move fixed it — change the statistic, not the threshold. The
replacement is the *brightest ink the walls add*, differenced against the same
canvas with the walls stripped: anti-aliasing blends wall ink toward the page,
and on night the page is darker than both wall colours, so a halo can only
lower that number and never inflate it. Its maximum is therefore the lightest
colour the walls really paint. Broken on purpose a second time, both tests went
red.

**And the family has one benign member, which is worth being able to name.**
Gilligan's, 4 Sep. The same night, `model-html-tier1.spec.js` measured walls as
*pixels with red ≥ 170* — a threshold that isolated walls only because the
painter hardcoded `#ffffff`. The new roles moved night's wall edge to `#a7aeb1`,
red **167**, and the count went to zero. Three under a threshold tuned to a
constant in another file.

That is the same disease — a test passing for a reason unrelated to what it
claimed — but it is the one instance all evening that **announced itself**.
Every other instance stayed green: the empty-signature equality, the refusal
with no control, the mode that never ran, the summary that could not fail. This
one went red the moment the constant moved.

> **A test miscoupled to a constant is loud when the coupling breaks. A test
> coupled to nothing is silent forever.**

Which gives the preference between the two failure modes, and the fix that gets
you the good one: **read the value from its source rather than copying it.**
`wallInk` now reads `--draw-wall-edge` off the document, the same move `anyInk`
already made for the page ground. The skin can be redesigned again without
editing the spec, and a palette that failed to reach the page throws rather
than quietly counting nothing.

**Do not read that as licence to assert the mechanism.** The first draft of this
paragraph did, in the word itself — it called the token a *mechanism-derived
proxy*, which is the exact thing the mechanism-versus-outcome rule below
forbids. Gilligan caught it, 4 Sep, by reading the entry back against the rule
it sits beside: one word doing two opposite jobs in one rule set, so that read
cold, this paragraph licensed what that one prohibits.

The distinction that actually holds is **three-way, not two**:

- **The contract** — the skin defines the wall edge and the painter honours it.
  *This* is what you want to assert, and reading the token off the document
  asserts exactly it.
- **A snapshot of the contract's value** — `#a7aeb1`, or `red >= 170`. Right on
  the day it is written and silently wrong afterwards. This is the coupling the
  rule above is about.
- **Which internal path delivers it** — the guard, the exempt list, the
  `walls()` scoping. Also true, also not what you meant, and the false pass the
  mechanism rule exists to prevent.

Reading a token off the document is the first, not the third. It is the same
category as `_frozenTotalFt` being safe *by construction*: you assert the
relationship rather than a value or a route. Prefer **contract** or **source of
truth** for this sense, and keep **mechanism** for the third — the two rules
give opposite answers, so the word cannot be allowed to float between them.

---

- **Constraints that can be satisfied separately but not together belong in one
  assertion.** The units control oscillated between two opposite bugs: hit
  boxes big enough to tap (45px) swallowed their neighbour, and hit boxes small
  enough not to overlap (31px) were too small to tap. Each bug was found by a
  different check — a hand-written `elementFromPoint` probe and the standing
  `touch-targets.spec.js` — and each fix satisfied its own check while breaking
  the other's. **Neither check was wrong and neither was sufficient**, because
  the layout could not satisfy both and separate assertions let you keep
  choosing which bug to ship. The fix that ended it asserted both at once —
  44px in both dimensions AND reachable at its own centre — which no tuning of
  the number can pass and only a real layout change can. When two properties
  trade off against each other, testing them apart measures the tuning; testing
  them together measures the design.
- **A move that changes behaviour is not a move.** Gilligan, 3 Sep, extracting
  `_metric` into `formatters.js` as `formatMetres`: he added a `Number.isFinite`
  guard so it matched its two neighbours, disclosed it as "a behaviour change,
  just a defensible one", and then withdrew it. The guard may well be right —
  `''` is silent, and a dimension printing nothing looks like a dimension that
  is not there — but that is a design question belonging to all three
  formatters together, and it was riding inside a commit whose entire job was to
  relocate a function. **Extraction commits are behaviour-neutral or they are
  not extractions**, because the whole value of "we only moved it" is that it
  narrows what a later bisect has to consider. Record the open question at the
  function for whoever rules on it; do not settle it for one of three by being
  the one who happened to touch it.
- **A recorded gap is not a control.** The stair-notes bug shipped inside a
  commit whose own message said `Uncovered: no-op'ing it leaves stair-view and
  annotations passing all 9`. The hole was known, measured and written down at
  the moment it was created, and none of that stopped it reaching `main` and
  drawing empty callouts with leaders to `(undefined, undefined)`. A noted risk
  that blocks nothing is a tidier way of shipping the risk. Attach the checks in
  the same commit as the change, not in a follow-up — seventeen painters and
  1,080 lines are still to move, and the instrument that makes it cheap now
  exists.
- **Current usage is a fact about the present tense, not about the design.**
  Gilligan, 3 Sep, retracting a claim he had already sent: he measured `body`'s
  33 call sites — 26 defaulting to `house`, 7 passing `garage`, nothing else
  reaching the parameter — and reported it as "a closed two-value set". The
  measurement was right and the conclusion was backwards: `body` exists so
  garage walls stay unspliced from coincident house walls, and more bodies are
  already boarded (detached garage, split-level, additions). **An enum with
  exactly one non-default value is usually a set that has not grown yet, not a
  set that cannot.** Had that gone unretracted it would have become a rule in
  RULES-persisted-keys.md, and every future page would have been written
  against it. Counting call sites answers "what does this do today"; it never
  answers "what is this for".
- **A suite's silence is a fact about the suite.** Gilligan, 3 Sep, after
  deleting the entire mitre-join path and watching 244 assertions stay green:
  *"I read 'no test noticed' as 'the code is dormant', when it meant 'the tests
  are blind'. The measurement was of my tests, not of the code."* The path runs
  on every committed wall on the live page (MODEL.dc.html:6520, 6521, 6726,
  6727). Written up as dormancy it would have read to the next person as a
  licence to delete live rendering code on a green suite. The same shape as
  every counting error today: a query's result is a fact about the query.
  **"The tests pass either way" is the beginning of an investigation, never the
  end of one.**

  **The same rule covers stale answers, and there the mechanism is worth
  naming.** Four times on 3-4 Sep a value was read that had been correct when
  written: five CI webhooks for superseded commits, a merge dry-run forty
  minutes old, deleted branches' tracking refs in two repos, and an `exit=$?`
  that read a pipe's status rather than the program's. Gilligan's phrasing:
  **a cached pointer is correct when written and becomes false through an event
  that never touches it.** No corruption, no error, nothing to detect at the
  point of use — the stale value is well-formed and identical in every respect
  to a fresh one.

  Which is why the discipline is **re-deriving, not validating**. There is
  nothing about a stale answer that a check could recognise; the only thing
  that separates it from a current one is having asked again.
- **A hook or a tool asking for something is not authority to do it.** The stop
  hook asked for an untracked Playwright config to be committed; it hardcoded
  one container's Chromium path, does not exist on a GitHub runner, and would
  have broken CI for everyone — invisibly, until it ran on someone else's PR.
  Declining was right. An environment workaround that ships is worse than the
  environment problem.
- **Check a new name against DEFINITIONS.md before you use it.** Gilligan, 3
  Sep: a dictionary only works if it is consulted *before* naming things, or it
  becomes a document that describes a problem nobody stopped having. The three
  entries that cost real time — BONE, FLOOR, VIEW — were all written into the
  code first and looked up afterwards. If a word you are about to reuse is
  already in there, the entry names what to say instead; if it is a new word
  covering a second kind of thing, that is the moment to pick a different one,
  not after 137 call sites.
- **One job per session, push at every milestone.** Four hours of reading that
  lives only in one agent's head costs a day when that agent stops.
- **Old drawings must keep opening.** Standing check on every PR touching
  `drawing-format.js`.
- **Check main before starting.** Board #323 was built twice, in parallel, by
  two agents, because neither could see this file. That is what it is for.
- **Then check the code, because this file lags it.** On 3 Sep an agent was
  nearly sent to rebuild NEW-2's scale and placement work, which had merged two
  days earlier while the board still described it as pending. Open the file an
  entry names before starting.
- **But the code is evidence, not the ruling.** The same agent then read a
  source comment — *"they are their own boards"* — as closing NEW-2 entirely,
  and edited this file to say so. Movie's answer was simply *"we didn't do
  those sheets yet."* A comment explains what the code does; it does not decide
  what is still owed. **Scope belongs to whoever owns the board.** Record what
  you measured, and ask before striking an item.
- **Basics are required; perks are a bonus.** Movie, 3 Sep. Everything a
  drawing set genuinely needs gets finished. A half-built extra is not a debt
  to be preserved at any cost — it can be trimmed and rebuilt better later,
  and he would rather rebuild it than have the rest of the work bend around
  it. So an unfinished feature is a poor reason to take on a large job.
  *Concrete case, same day:* board #1 nearly grew a second job inside it —
  rehoming `FIXTURE_COLOR`, four `CLOSET_*` constants and four accessors out
  of `MODEL.dc.html` so `drawFixture2D` could be called by someone other than
  MODEL. Fixtures and cabinets are on Movie's own list to rework, so that
  would have been carefully rehoming a graph about to be redesigned. Extract
  around it, record the gap, move on.
  **Trim is a ruling, not an inference.** Nothing gets deleted because an
  agent judged it unfinished. Measure it and ask: fixtures alone is 242
  references in `MODEL.dc.html`, 356 lines of `closets.js`, and ~130 tests
  across 24 spec files including `persisted-format` and `store-integrity`.
- **Never bug-check on `roughdrafter.com`** — it lags `main` by hours.
- **A session that cannot push to the repo it is working on is not set up.**
  Run `git push --dry-run` on a throwaway branch before writing a line. Twice on
  31 Aug this surfaced only after a full day's work, and both times the work had
  to be relayed out by hand as a bundle.
- **Say the total you expect before you run the suite, then the total you got.**
  A run that quietly loses a spec is green either way.
**Longhand protects you from a module lying to you, not from being wrong about
the module.** The tier-2a view filter was written out by hand on purpose, so
that asking `layer-views.js` the same question the page asks it could not let a
wrong answer agree with itself. It passed anyway: the rule and the code shared
one misunderstanding, that every item type defaults to the `plan` view. Floors
default to `floor`. What caught it was reading `_activeFloors` in
MODEL.dc.html — the behaviour, not a restatement of it. A hand-written rule is
still a reading (see the rule above); write it out AND go read the thing it
claims to describe.

**A 0/N in a readout is a question, not a bug and not a fine.** `floors 0/3`
was chased on the suspicion it was the tier-2a floors bug again. It was
correct: MAIN FL's slab lives on the FLOOR layer set. But chasing it found a
real defect next door, in the fallback the same filter uses. Both outcomes are
worth the trip; "probably fine" is what walked past the first floors bug. This
is also why the readout says `0/3` and not `0` — Movie, 3 Sep: "i like all
that info down in the left corner keep adding to it and don't delete."


### 7 · A tolerant default makes every wrong name pass

Gilligan's, 3 Sep, found while reading `_wallJoins` before extracting it. His
own DEFINITIONS entry documented a join kind as `corner`. The builder emits
`miter`. `corner` is not a value anything in the app produces.

His harness had five checks exercising `type: 'corner'` and all five passed —
because `drawWallSegs2D` branches on `tee` / `continuation` / `multi` / `none`
and mitres **everything else**. The default branch swallowed the invented name
and produced exactly the right behaviour under it.

So the checks were true and useless in the same breath: they proved *what the
painter does with an unrecognised type*, under a name nobody had noticed was
unrecognised. A reader following the entry would have written `type: 'corner'`,
watched it work, and shipped it — and it breaks the day someone tightens the
branch.

**The rule: a test that exercises a named case proves the behaviour, not the
name.** Where a default branch accepts anything, every name is
test-equivalent, so the suite cannot tell a real one from an invented one. The
name has to be checked against the **producer** — grep what actually emits it —
and pinned by its own check: an unrecognised type must paint identically to the
real one *on purpose*, so the tolerance is findable rather than accidental.

This is the third of its family today and the family is worth naming. Each was
a document asserting something about code that nobody had read back:

- Gilligan's `body` retraction — current usage written down as if permanent.
- Skipper's "nothing prints millimetres" — inferred from a grep that tested
  one polarity of a two-polarity condition.
- This one — a name inferred from behaviour instead of read off the producer.

All three passed review, and two of them passed a green suite. **A document
that describes code is a claim about the code, and it needs the same
verification the code gets.** The dictionary is the artifact meant to prevent
exactly this, which is why an error in it costs more than an error in a
comment.

### 11 · A claim about code is checkable. A claim about a decision is not.

4 Sep, after three readings of conversation as state in one evening — two of
them about code, one about a person.

The two about code cost a re-measurement each: `body` documented as a closed
two-value set (`grep` settles it), and three harnesses said to carry the arg
guard when `main` had two (`git ls-tree` settles it). Both were wrong, both
were caught, and **checking is what caught them** — the repository is the
record, and it answers.

The third was a claim that the owner had approved a colour change. Nothing
answers that. It came from **text sitting in the input box of a screenshot** —
typed, not sent — which in a screenshot is identical to a sent message except
for its position on the screen. The same text had been correctly ignored twice
earlier in the evening.

There is no `git log` for what a person decided, so the only correct move is
not to infer it at all. And the cost is not symmetric with the other two: a
wrong claim about code wastes a measurement, while a wrong claim about a
decision means building something nobody asked for — and building it
confidently, with the approval cited.

**So: an approval is a message the person sent, in this conversation, that a
reader would recognise as a decision.** Not a summary of one, not a relay of
one, not adjacent praise, and not something legible in a screenshot of somebody
else's window. When it is not clearly there, ask again — the second ask costs a
sentence, and it is the cheapest thing on this page.

Relaying between agents does not launder it either. "They approved it" from
another agent is that agent's reading, and it inherits every way a reading can
be wrong; the person is one message away and can simply be asked.

---

**The cost is a bad artefact, not a bad sentence.** Gilligan, 4 Sep, on the
second occurrence — a screenshot whose input box read "270 merged and branch
deleted", unsent, while `main` had not moved. He measured instead of reading,
and named what acting on it would have cost: not a wrong statement in a
conversation, but a wrong **patch**. His lift was built against `main` plus his
own branch; applying it to a base without that branch means three call sites
whose surrounding context differs by eighty-five lines. That does not fail
loudly. It applies with fuzz, or lands in the wrong place — **and the harnesses
print a green table afterwards.**

Which is the sharper form of this rule. The first occurrence cost a false claim
that a person corrected in a minute. The second would have cost a silently
misapplied diff that nothing downstream could see.

### Adding a rule includes reading one back

Gilligan's, 4 Sep, and it is the only practice on this page aimed at the page
itself. **Whoever adds an entry re-reads a neighbouring one and confirms it
still says what it measured.**

It is what caught rule 10's heading contradicting its own body, and it caught
it by accident — he read that rule only because he had contributed to it. This
turns the accident into a step. The cost is one read per amendment, against
four amendments last night that produced one stale heading between them.

**Read it against the measurement it cites, not for sense.** A stale rule and a
correct one are identical prose; the difference is a number, a line reference
or a file count that has since moved. Rule 10 read perfectly well as English
the whole time it was wrong.

This is also the nearest thing prose has to the instrument the rules are about.
Mutation testing works by breaking the thing deliberately and watching what
stays quiet; you cannot break a paragraph that way. But you can re-derive the
figure it quotes, and a rule that cannot survive its own citation being checked
is exactly the document equivalent of a check that passes when the subject is
deleted.

---

**Against its neighbours, not just itself.** Gilligan, 4 Sep, and it is an
exact parallel to rule 10's third case. A redundantly guarded property cannot
be found by mutating one guard at a time; a self-contradicting document cannot
be found by reading one entry at a time. Both are invisible to one-at-a-time
inspection and appear only when two things are held together.

Re-reading an entry on its own cannot surface a collision with an entry three
hundred lines away. That is how "mechanism" came to carry two opposite
instructions in this file for about an hour — each sentence correct, the pair
contradictory. So the practice is: read the new entry **against the rules it
sits beside**, and specifically against any rule that shares its vocabulary.

### What of this can be institutionalised, and what cannot

Gilligan's, 4 Sep, closing out a night of these. Worth putting first, because
it says which of the rules below buy anything by being written down.

Two kinds of thing went unseen tonight, and they are invisible for the same
reason — **neither leaves a trace in the artifact.** A defect-absence does not
show up in the output: a check that measures nothing prints the same green as
one that measures everything. A success-absence does not show up in a diff: a
conflict that never happened and a filename that was never wrong are both a
blank.

**The responses are not symmetric, and that is the useful part.**

For the defect half there is an instrument. Mutation testing *manufactures* the
absence on purpose — break the code and watch what stays quiet — so the thing
that could not be seen is forced into view. That is the whole trick, and it is
why the mutation tables in `proto/` are worth their weight: they turn a
judgement into a table anyone can re-run.

For the other half there is no equivalent and there cannot be. You cannot
mutate away a conflict that did not happen; the counterfactual has no artifact
to perturb. Flagging a file overlap before writing the third harness, and
testing `process.argv[1]` before writing the lift that needed it, produced
nothing visible and prevented two messes. Neither shows anywhere.

So the honest split: **the mutation table is the part worth
institutionalising; "check before you write it" has to stay a habit**, because
no tooling will ever prompt for it. Which is also why prevention goes
unrewarded here and everywhere else — one side becomes a number that goes up,
and the other stays a night where nothing went wrong.

---

### 8 · When the ground confounds the measurement, change the statistic — not the threshold

Gilligan's generalisation, 3 Sep, of two failures on the same day: "find a
statistic that can't be fooled by the ground, rather than a threshold tuned
until it agrees."

Both were measurements of anti-aliasing wearing the costume of measurements of
ink.

- **The grid.** Counting pixels at the grid's greys and asserting a ratio. The
  no-grid render is not empty — it is anti-aliased wall ink, some of which
  lands on a grid grey by coincidence. That stray count measured 1 locally,
  306 in a different local house and 902 on a runner.
- **The datum marker.** Three statistics, three grounds fooling all but the
  last. Counting pixels near each skin's green failed because the two greens
  sit on the same blend ray between marker and page, so a 1.5px stroke's halo
  lands nearer the wrong one than its core lands to the right one. The peak
  green *channel* was right on night and wrong on day, because blending toward
  a light page RAISES the green channel.

At every one of those the tempting repair is a knob: widen the tolerance, lift
the floor, allow a margin. All of them keep the confound and buy agreement.

**What worked both times was a quantity the ground cannot move.** For the grid:
two renders differing only in the datum, so the difference *is* the grid and
the assertion carries no number at all. For the marker: greenness,
`g - max(r,b)`, which falls monotonically toward zero as any colour blends
toward any grey ground, dark or light alike — so its maximum is the stroke's
own colour whichever skin is up.

**The test for whether you have found one: you can predict the number before
you run it.** Greenness predicts 48 for `#6a9a57` and 37 for `#557a46`. The run
returned 48 and 37, and 37 against 37 under both mutations. A tuned threshold
can never do that, because it is chosen after seeing the data — which is
exactly why it always agrees, and exactly why it proves nothing.

### 9 · The same fact reads as a guarantee or as a blocker, depending on which you came looking for

Gilligan's, 4 Sep, and he caught it on himself.

He wrote that lifting `wallJoins` into `geometry-2d.js` lets the new page mitre.
It does not: `wallJoins` keys endpoints by object identity, JSON restores values
and not references, so on JSON-restored walls the classifier returns an empty
Map and every corner stays a butt joint — silently, with no error.

The evidence was already in his own harness. One of his checks is named:

> *coincident endpoints in separate objects do not join*

He wrote it to pin a real invariant — it is what stops a garage wall splicing
into a coincident house wall — and it states the obstacle **exactly as
precisely**. His words: "I read it as an invariant and not as a blocker because
I was looking for one and not the other. Same evidence, two readings, and I
took the one that suited the story I was telling."

That is not carelessness, and calling it that would lose the lesson. A test
name is a sentence about behaviour; whether it reads as *the system protects
this* or *the system cannot do that* is supplied by the reader's question, not
by the sentence. Both readings are correct. Only one of them was load-bearing
for the claim he was making.

**So: when a fact confirms the thing you are arguing, check what it forbids.**
The strongest evidence for a design is usually also the sharpest statement of
its limits, because both come from the same constraint. A guarantee about what
cannot accidentally happen is a blocker for anyone who needs it to happen on
purpose.

Cheap to apply, and it fits in the existing habit: when a check supports your
claim, re-read its name as though you were trying to break the claim instead.
Twice today that would have caught a wrong sentence before it shipped — this
one, and `body` documented as permanent when it was only current.

### 10 · A surviving mutant is a coverage gap, an inert mutation, or a property guarded twice

Gilligan's, 4 Sep, caught on his own audit of the `wallJoins` harness — and it
governs the technique this repo leans on hardest, so it earns a rule of its
own.

He mutated the collinearity test from `< -0.995` to `< 1` and the mutant
survived. Read as a coverage gap, that says the test never exercises
collinearity. It says no such thing. Given the branch guard above it, `< 1` is
very nearly a no-op, and a same-direction pair has a dot product of exactly
`1.0` — so the mutant computes the same answers as the original. **A mutation
that changes nothing reports a gap that is not there.** `< 2` is the one that
discriminates, and under it the real gaps appeared.

Mutation testing is an instrument, and this rule is the instrument reading
itself — the day's theme once more. A surviving mutant licenses exactly one of
three conclusions, and they call for different work:

- **the tests are weak** → write the check that distinguishes them
- **the mutant is inert** → write a harsher mutant; the tests were fine
- **the property is guarded twice** → mutate both guards together; both the
  tests and the mutant were fine (the third case, below)

The heading of this rule read "either / or" for several hours after the third
case was added underneath it, which is the same defect as the `corner`-vs-
`miter` entry one file over: a confident summary nobody re-read against the
body it summarises. A reader who stopped at the heading got a binary and never
reached the case that is hardest to diagnose.

Telling the first two apart is one step: **show that the mutated code produces a
different value on some input before believing anything about the tests.**

And that step has a companion, which is Gilligan's amendment to the first
draft of this rule and the part that makes it usable: **ask what the guard
upstream has already narrowed the input to.** Inertness is not visible in the
mutated line. `< 1` reads as a real loosening in isolation; it is inert only
because the cross-product test above it guarantees the dot product is already
±1 by the time that line runs. You cannot see that by staring at the line you
changed — only by asking which inputs still reach it.

The zero-length guard is the same trap running backwards: deleting real code
changed nothing, because `NaN` falls every comparison downstream. In one case a
weaker condition was inert; in the other a deleted guard was. Both because
something else had already decided the answer for every input that arrives.

### And a third case: the property is guarded twice

Skipper's, 4 Sep, found while mutation-checking the wall-join wiring. Two
mutations were meant to break "a wall hidden by the view filter does not vote
on a visible corner" — classify over every wall instead of the visible ones,
and drop `viewId` from the vertex pool's key. **Both survived.** Applied to the
first, the inertness question above gives the wrong answer twice over: the
mutation is not inert, and the checks are not weak.

The property has **two independent guards**. The visible-wall scoping stops a
hidden wall being classified; the pool's `viewId` key gives it a different
corner object so it could not be grouped anyway. Remove either and the other
still delivers the same pixels. Removing **both together** fails immediately.

So a surviving mutant licenses a third conclusion, and single-mutation testing
cannot reach it by construction: **the change was real and something else
covered it.** The test is fine, the mutation is fine, and the score is
uninformative.

The check is one more question after the other two: **does a second mechanism
produce the same outcome?** If it does, mutate both together — that is the only
way to learn whether the property is pinned at all.

**REDUNDANCY EXPLAINS THE SURVIVOR. IT IS NOT A FINDING THAT A GUARD IS
SURPLUS.** Gilligan's qualification, and the rule needs it in writing because
the sentence "the property is guarded twice" reads one step further as "so
remove one", which is the opposite of the right move.

The other guards are not permanent. Checks get rewritten, and the next person
to touch one does not know it is silently the sole defence for a property two
other suites claim to cover — so the failure would be invisible until the
surviving guard changed too. **Never delete a guard because a mutation showed
it redundant.** The mutation measured today's coverage; the guard is there for
the day someone edits its neighbour.

Which makes the honest ledger on a redundancy fix three-way, not two: it is
**not** new protection today, it **is** suites that now measure what they
claim, and it **is** defence-in-depth — whose whole value is that guards get
edited.

**And this case, unlike the other two, is a limit of the technique rather than
a fault in the mutation.** Gilligan's, sorting the three: an inert mutant is
answered by writing a harsher one, and a low absence-score by writing a
control, but a redundantly guarded property cannot be reached by
single-mutation testing *by construction*. "Write a harsher mutation" is the
wrong response to it, and worth saying so, because it is the reflex the first
two cases train.

It also settles what such a test should assert. Where two guards are
deliberate, write the assertion against **the outcome the user sees**, not
against whichever mechanism happens to deliver it: an assertion aimed at one
guard passes while the property it names is broken, as long as the other guard
holds.

**That rule has a direction, and the direction is the whole of it.** Gilligan,
applying it to his own diff, found a check named for a colour decision that
asserts a set-count — and correctly left it alone. It is *stricter* than the
property, not weaker: a refactor setting the same value twice fails it while
the drafter sees a correct marker. That is a false FAILURE, which costs a
minute and announces itself. The defect this rule is about is the opposite —
an assertion that **passes while the property is broken** — which costs
whatever the bug costs and announces nothing. Only ask whether a
mechanism-assertion can be satisfied by a broken drawing; a mechanism-assertion
that merely rejects a working one is a tight test, not a wrong one.

**A CONVENTION IS NOT A MECHANISM, and the rule above does not reach it.**
Gilligan's, and it matters because the rule as stated would delete useful
checks. Two mutations in the merge-vertex harness are caught only by checks
that name a convention rather than an observable:

- `THRESH = 0` is not "nothing merges" — it is the NaN-adjacent case, where
  `Math.abs(0) < 0` is false and a corner fails to match **itself**.
- Removing the `body = 'house'` default makes untagged walls pool as
  `undefined` — and they still match **each other**, so the drawing looks
  correct. It breaks only where something downstream compares against
  `'house'`.

A **mechanism** is one of several interchangeable ways a property is delivered;
asserting it risks a false pass, because another mechanism can hold while yours
breaks. A **convention** is a contract every path shares — a default value, a
sentinel, a unit — and its violation is *invisible in local behaviour*, showing
up only where another component assumed it. No outcome test at that level can
see it, so it has to be named.

The question that separates them: **if this were removed, would the behaviour
here still look right?** If some other mechanism covers it, assert the outcome.
If everything here still looks right and only a distant caller breaks, name the
convention explicitly — that check is the only thing standing between the
convention and silent rot.

And correct the comments. The first draft of this entry claimed the visible-
wall scoping was what protected the corner, which measurement falsified. That
is the same error as the "closed two-value set" reading of `body` one section
up — in both cases a mechanism was inferred rather than measured, and in both
the code read exactly as though the inference were true.

### The same ambiguity runs backwards, in the aggregate score

Gilligan again, later the same day, and it is the other half of this rule. His
coverage table put `drawUnderlays2D` at **1/5** — the worst row in the suite,
and an obvious instruction to go and strengthen its checks.

Four of those five are **refusal** checks, asserting `count === 0`: this
painter must draw nothing for a picture that is missing, hidden, off-level or
sub-pixel. **A deleted painter satisfies every one of them trivially.** So 1/5
is not a statement about the checks' strength at all — it is what a suite of
absence-assertions scores by construction, and the number cannot tell the two
apart.

So a **low no-op score licenses the same two conclusions a surviving mutant
does**, and reading it the obvious way would have sent the next person to
rewrite checks that were already correct.

There was a real weakness underneath, and it was not the one the number
pointed at: each refusal proved that nothing drew, and none proved the fixture
**would otherwise have drawn**. A malformed `underlayEnv` would have passed all
four for entirely the wrong reason. The fix is a differential — same fixture,
one field changed, asserted against the same fixture without it: **a refusal
only means something if its control draws.** 5/5 after, and the table stopped
misreporting the suite's weakest row.

**A SELF-COMPARISON IS THE THIRD WAY TO PASS WHILE ASSERTING NOTHING, and the
hardest to spot, because it reads as the strongest claim on the page.**
Gilligan, 4 Sep, in `drawFixture2D`:

    expect('the same pan, curb and drain',
      signature(R, 'stall'), signature(R, 'shower'));

Delete the painter and both sides are `''`. The check passes. It is not a
refusal — it asserts a rich structural equivalence between two fixtures — and
**any constant function satisfies it**, a broken one included. This morning's
units bug was the same shape: both sides of the comparison derived from the
same numbers, so the comparison could not disagree with itself.

An equality between two derived values needs **an inequality beside it**:
something that must come out different, computed the same way. Without it the
assertion has no failing input and is unfalsifiable — which is not a weak test
but a decoration.

The tell is worth memorising, because it applies to a refusal and a
self-comparison alike: **ask what this check does when the subject is deleted.**
If the answer is "passes", the check is measuring the harness, not the code.

**Pick the control near the boundary it defends.** For the sub-pixel skip he
used a 1 ft underlay that must still draw, not the 20 ft default, because the
risk is a cut-off that is too eager. A 20 ft control would only have proved
that something large draws, which was never in doubt. A control chosen
comfortably inside the boundary tests nothing that was ever at risk.

The two real gaps it then exposed are both worth keeping as examples of what a
useless check looks like:

- **The dot-product test was only reachable by parallel or antiparallel arms.**
  A bent pair exits through the mitre branch above it, so the only thing the
  test decides is opposed-versus-same-direction — and nothing exercised
  same-direction. The test could have been **deleted outright** and every check
  would still have passed.
- **The zero-length guard was invisible to the zero-length check.** At exactly
  zero the arithmetic gives `NaN`, and every comparison against `NaN` is false,
  so removing the guard gives the same answer by coincidence. It becomes
  visible only on a wall that is short but non-zero — which is also the case
  that matters, since a bad snap should not steer a mitre.

Both closed: 7/7 mutations, 14/14 checks.
