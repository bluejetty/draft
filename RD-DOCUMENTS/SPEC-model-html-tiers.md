# SPEC — MODEL.html, tier by tier

The framework-free rebuild of the Model Space. Tier 1 is merged and live;
this note says what the tiers are, because until 3 Sep they existed only in
one agent's head and nobody else could see the plan.

`index.html` still points at `MODEL.dc.html`. Nothing here changes that. The
swap, when it comes, is two hrefs.

---

## Tier 1 — read the real drawing, paint it with the real painters *(done)*

`MODEL.html` opens the drawing `MODEL.dc.html` saved, from the same origin's
IndexedDB, and paints its walls through `render-2d.js`. React and the DC
runtime are absent and a spec asserts they stay absent.

Five scripts, and the list is the finding rather than a formality:

    palette.js · shared-file-store.js · wall-types.js
    drawing-format.js · render-2d.js

It **reads and never writes**. There is no save path, so a tier-1 bug cannot
cost anyone a drawing.

---

## Tier 2 — the level filter first, then the rest of the plan

*Tiers 2a and 2b are merged (PR #252). What follows records what they did and
where the tier stopped, which is a seam worth understanding rather than a
to-do list.*

### The filter is NOT `levelId === active`

Measured from `MODEL.dc.html:6505-6513`, which is the closest thing the old
page has to what this needs. There are **five rules, not one**:

```js
const planOnly = this._layerViewsForLevel(levelId).length > 0;
const onPlan   = item => !planOnly || (item.view || 'plan') === viewId;

walls    → levelId === active && onPlan(x)
lines    → levelId === active && onPlan(x) && lineLayerConfig(x.layer).visible
floors   → levelId === active && onPlan(x)
roofs    → levelId === active                    // NO view filter
outlines → levelId === active                    // NO view filter
```

Three things here would each have cost an iteration to discover by building:

- **Roofs and outlines do not filter by view at all.** Only walls, lines and
  floors do.
- **`planOnly` is conditional.** A level with no layer views — ROOF, SITE —
  shows everything it holds. The view filter switches itself off there.
- **Floors default to `view: 'floor'`, not `'plan'`** (`MODEL.dc.html:2905`,
  `view: floor.view || 'floor'`). A filter written as `view === 'plan'` hides
  every floor in the drawing and looks like a painter bug.

### Levels, and an index/id collision to not fall into

```
id 8  SITE         elev   0
id 7  ROOF         elev  18
id 5  2ND FL       elev   9
id 3  MAIN FL      elev   0
id 1  FOUNDATION   elev -10
```

`state.activeLevelIdx: 3` is an **index into that array**; `MAIN_FLOOR_LEVEL_ID
= 3` is an **id**. For the default list they coincide, and they stop coinciding
the moment a level is inserted. MODEL.html should carry the **id**, never the
index, and default to `MAIN_FLOOR_LEVEL_ID`.

The saved drawing carries its own `levels` (`drawing-format.js` exports it), so
read that rather than assuming `DEFAULT_LEVELS`.

### Order of work

1. **Level filter** — *done, 2a.* Accessors take the active level id; MAIN FL
   by default, `?level=` to switch.
2. **Roofs and shapes** — *done, 2b.* No extraction needed; both painters were
   already in `render-2d.js`.
3. **Floors, properly.** Tier 1 hand-rolls a polygon wash; the real painter is
   `_drawFloor2D`, still inside `MODEL.dc.html`.
4. **Mitred wall joins.** `drawWallSeg2D` takes `joins`, and tier 2 passes
   `null` (capped ends). Real mitring needs MODEL's `_wallJoins()`.
5. **Outlines, dimensions, fixtures.** Dimensions *done*. Outlines *done, 2h*
   — the block was three `this._` methods, not the painter: `_outlineSegment`,
   `_outlineSegmentCount` and `_lineControlPoint`, nineteen lines between them
   and pure. They are `outlineSegment` / `outlineSegmentCount` /
   `lineControlPoint` in `geometry-2d.js` now, with checks
   (`proto/outline-accessors-harness.js`) they had never had, and MODEL.html
   paints outlines through the real painter. **Fixtures remain**, and are
   cheaper than the paragraph below said — see the correction there.

---

## THE SECOND TEST: WHO DERIVES IT, AND WHO STORES IT

Added 6 Sep, from tier 2m, and aimed at the Write Tier rather than at this
page — it is the hazard that the reachability test above cannot see.

**For every field two boards both touch, ask which one DERIVES it and which
one STORES it.** A field can be present, correct, shared, and reachable, and
still make the two pages disagree.

Stairs is the worked example. A stair record carries `riseFt`. It looks like
the truth and it is not: `_stairCurrentLayout` re-derives the rise from the
level heights on every paint, and falls back to the stored number only *"if
its level goes away"*. Nothing ever writes the derived value back — all four
writes to `riseFt` happen at stair creation. So the stored number is correct
exactly until someone edits a wall height, and then it is silently stale
forever.

The old page never notices, because it never reads the stored value while a
level exists. A second page that trusted it would have drawn a different
riser count for the same drawing, and **no test on either page alone could
catch that** — the divergence does not exist inside one page. It exists in
the file they exchange.

That is why `level-assembly.js` came out with the stairs rather than after
them: reading `stair.riseFt` was the cheap path and it was WRONG, not merely
worse.

**The write side is the same hazard mirrored** — a value the old page derives
and the new page stores, or a value the new page writes that the old page
expects to re-derive. Both directions pass every single-page test. This is
the reader-side twin of the round-trip rule.

**The standing check:** name the deriver, name the storer, and make the two
boards exchange a file in a test. If a field has two derivers, that is a
merge conflict waiting in the data. If it has two storers, one of them is
stale and nobody will find out until a drafter does.

### THE COROLLARY: ONE DERIVER IS NOT ENOUGH IF THE CALLERS ASK IT DIFFERENT QUESTIONS

Added 7 Sep, from the thing that actually went wrong.

Pulling three copies of the level assembly table into `level-assembly.js`
removed the drift **between the tables**. It left the drift **between the
callers**, and that turned out to be the same defect one level up.

On 6 Sep the module became role-aware (PR #323): OVER GARAGE spans a double
bay on a 19¼" joist, ENTRY frames on 2x10s, and the level's role is derived
from its id inside the module. Two callers were updated to pass the role.
Three were not — `MODEL.html`, `LAYOUT.dc.html` and the elevation harness kept
calling `normaliseLevelAssembly(assemblies[id])` with no second argument, so on
those three every level framed like a plain floor. Measured through the real
stair geometry:

```
stair up to OVER GARAGE   role-aware   117 1/8" rise, 15 risers, 11'-8" run
                          role-less    109 3/4" rise, 14 risers, 10'-10" run
```

One riser and a whole tread, same drawing, between the page that serves users
and the page written to replace it. ENTRY diverges too (104⅛" against 106¾")
and lands on the same riser count, so it draws the same run at slightly wrong
riser heights — real, and invisible.

**One deriver with an optional argument is two derivers.** `defaultLevelAssembly
(role = 'floor')` was written with a default so every existing caller kept the
answer it had, which is exactly what made the omission silent: a role-less call
is not an error, it is a different building. The kindness in the signature is
where the divergence lives.

**Why nothing caught it for a day.** Three of the module's eight fields —
`joistType`, `joistSpacingIn`, `slabThicknessIn` — had no check anywhere in the
repo. Measured: each set to a different value and every harness in `proto/`
re-run — 27 of them at the time — all
green on all three. The vocabulary could move underneath them because nothing
was holding them still.

**The standing check, extended:** a shared deriver needs a check that every
caller asks it the same question. `proto/level-role-harness.js` does it by
scanning rather than by anchoring — it walks each caller file and requires
every call to pass a role, so a fourth caller added tomorrow fails without
anyone remembering to add it. An anchored check per known call site would have
passed, because the sites that were wrong were the ones nobody thought to
anchor.

## THE TEST OF A FINISHED EXTRACTION

Steps 3-5 are blocked, and measuring *why* produced the most useful thing
either agent found on this job. It is recorded here because it applies to
board #1 far more than it applies to this page.

**Moving a painter into `render-2d.js` does not make it shared. Its `env` has
to be reachable too.** Who can actually call each export today:

```
drawWallSeg2D    layout-plan.js   MODEL.dc.html   MODEL.html
drawRoof2D                        MODEL.dc.html   MODEL.html
drawShape2D                       MODEL.dc.html   MODEL.html
drawFixture2D                     MODEL.dc.html                 ← one caller
```

Three are callable anywhere because their env comes from modules — `wallTypes`
from `wall-types.js`, `roofSkeleton` / `offsetOutline` from `geometry-2d.js`,
`flooringTypes` from `drawing-format.js`.

`drawFixture2D` is callable by nobody else, and not because of the function.
Its env keys resolve on `MODEL.dc.html` — but **not all eleven live there, and
the original claim on this line that they did was wrong.** Measured 4 Sep:

```
CLOSET_WALL_FT      = window.DraftClosets.WALL_FT          already shared
CLOSET_ROD_FT       = window.DraftClosets.RAIL_FT           already shared
CLOSET_SHELF_FT     = window.DraftClosets.SHELF_FT          already shared
CLOSET_CLOTHES_FT   = window.DraftClosets.CLOTHES_FT        already shared
closetDoorFor       = window.DraftClosets.doorFor(…)        already shared
COUNTER_OVERHANG_FT = 1 / 12                                MODEL literal
FIXTURE_COLOR       = '#1d1f20'                             MODEL literal
fixtureGeometry     → this._fixtureGeometry                 MODEL method
wallCross           → this._wallCross                       MODEL method
wallFrame           → this._wallFrame                       MODEL method
walls               → this._walls.map(…)                    state; MODEL.html has it
```

Five of the eleven are one-line aliases over `window.DraftClosets`, which
`closets.js` froze and exported before this page existed —
`MODEL.dc.html:2294` says so in its own comment. The genuine MODEL-only set is
**three methods and two literals**, and the missing piece for another page is a
`<script src="./closets.js">` tag.

That correction is the point rather than the arithmetic: the sentence was
accurate when written and was falsified by a later change to `closets.js` that
never touched this file. A number in prose has no test, so nothing failed when
it stopped being true — and for months it was the number that made this job
look too big to start.

So the criterion is not *"the function moved"* — it is **"someone else can call
it."** `drawFixture2D` has passed the first test since before this session
started and still fails the second. It moved house without changing address.

**This is a scope question board #1 has to answer, not a defect** — but it is a
smaller question than it was. Making the fixture painter genuinely shared means
moving two literals and deciding whether three single-caller methods are worth
extracting at all; "extracting code for a hypothetical second caller" is its own
way for a shared module to rot, and the honest trigger is the tier that needs
them, measured against the old painter. It should be
decided out loud rather than drifted into. The honest interim is what is being
done: extract with real envs, and record which keys are MODEL-only so the gap
is visible rather than assumed closed.

---

## HOW MANY PAINTERS THERE ARE

**31, not 28.** The 28 came from `grep -o "_draw[A-Za-z]*2D"` and was handed
around as a measurement. It is a fact about the pattern.

Counting by behaviour instead — any method whose first argument is `ctx` —
finds three more:

```
_drawStairPlanPane        no 2D suffix
_drawStairSectionPane     no 2D suffix
_stairPaneHeader          does not even start with _draw
```

All three are in the stair-workspace cluster, so the miss was not harmless:
it hid a dependency between painters that were being moved as a group.

**Inventory by behaviour, not by name.** `first argument is ctx` cannot be
defeated by someone naming a function `Pane`.

**A level switcher is chrome, and chrome is tier 3.** Tier 2 picks a level and
paints it correctly; it does not grow a UI to change it.

---

## Tier 3 — the ladder *(written down 9 Sep, after four rungs had already landed)*

Chrome, interaction, and the skins from `SPEC-skins.md`. The sentence above
this one used to be the whole section — *"not specced here beyond that,
because tier 2 will change what it should say"* — and it stayed that way for
five days after tier 3 started. **That is the same doc failure tier 2 had
before 3 Sep**: the plan existed, it existed in one agent's head, and nobody
else could see the order of the work or tell a finished rung from an
unstarted one. Written down here for the same reason, and kept the same way.

**The standing rule for this section: one entry per rung, as it lands, with
the commit.** A rung with no commit beside it has not landed, whatever the
prose says.

| rung | what it is | who | state |
|---|---|---|---|
| **3a** | **MODEL.html becomes a writer** — select, move a corner, save, guard the close, move a whole wall | Devin's crew | **four of four DONE**, PRs #346 / #347 |
| **3b** | **The level switcher** — chrome on the page for the level tier 2a already filters by | Gilligan | ordered, not started |
| **3c** | **Draw and delete a wall** — the two verbs that make the page a drafting surface rather than an editor of walls that already exist | Gilligan | queued behind 3b |
| **3d** | **The rest of the autosave ruling** — rungs 2–5: the change broadcast, then the named edit lease. Its first job is done: the ruling is written down, `RULING-autosave-two-writers.md` | unassigned | **PLANNED**, spec in hand |
| **3e…** | **One old-page verb per rung**, never a batch, in whatever order a real drafter reaches for them | unassigned | **PLANNED**, 19 tool states to go |
| **gate** | **The swap** — two `href`s in `index.html`, its own PR, nothing sooner | Movie rules | **PLANNED** |

Skins are not a rung on this ladder. `palette.js` calls its own night values
provisional and `PRE-TIER3.md` ruled them *"a taste decision, not a gate"*;
they land when Movie rules on them, in any order relative to the rungs.

**3b carries a hazard that is already written down twice in this file and is
worth a third mention here, because a switcher is exactly where it bites.**
`MAIN_FLOOR_LEVEL_ID = 3` is an **id**; `state.activeLevelIdx: 3` is an
**index**. They coincide on a default drawing and stop coinciding the moment a
level is inserted — and the half-storey work means insertion is now a thing
the product does. A switcher built on the index passes every test that uses a
default drawing and paints the wrong level on a real one. The spec for 3b
should name a drawing with an inserted level, not a default one.

### Tier 3a — the four rungs, and the store rung it forced

**Rung one — selection.** `ec993b3`, *"MODEL.html's first editing tool — click
a wall, it lights up"*. 85 lines on the page and a 185-line spec. Nothing is
written to the drawing: selection is the rung that proves the page can hear a
press at all, and it was cheap because `95e7a0b` had already given
`geometry-2d.js` the point-to-segment distance the hit test needed.

**Rung two — the corner drag.** `4e2be48`. The mechanism is the corner pool,
not a search: load rebuilds reference equality at shared corners, so writing
`x`/`z` on one endpoint moves every wall that meets there without anything
iterating the neighbours. **The numbers are the old page's, read rather than
chosen** — 30px to grab a corner, 4px to snap to another, 4px of travel to arm
the drag, all off `MODEL.dc.html`'s shipped defaults; they have names now
rather than being literals (board #347, `d96cda6` / `39b8d40`). **And the
master link survives**: a BUILD HOUSE corner rides a BONEYARD master point
through `srcId`/`offX`/`offZ`, and the drag keeps the `srcId` and re-measures
the offset, which is what `_relinkVertex` does on the old page. The trap
recorded with it is the one that would have been silent: a master point's id
is `id` in the file and only the old page's loader renames it `pointId` in
memory, so reading `pointId` here resolves nothing, on every corner, quietly.

**Rung three — the edit survives the page.** `75cc4ac`, plus `be01325` for the
close guard. SAVE is a press, not an autosave, and the button carries three
true words — SAVE, UNSAVED, SAVED — where **a refused write stays UNSAVED,
because it is**. An undo is an edit. Selecting, panning, and a tap on a handle
that never moved are not. The close guard is *the honest minimum, not the
answer*: saving on a press is right for a second writer on one file, and it is
also what puts a drafter one stray Ctrl+W away from a corner that never
landed.

**Rung four — the whole wall.** `a0c3841`. **The first gesture on this page
with nothing to copy** — the old page's SELECT drag grabs a vertex, and a
press on a wall body away from a corner moves nothing at all there. So it is a
ruling rather than a measurement, and the conservative one: both endpoints are
pooled corners shared with the neighbours, the drag moves both, and the
outline deforms around the wall. A wall that detached from its corners instead
would be unhooked from the pool — the same failure shape as a dropped `srcId`,
and just as invisible until much later. A true detach, if it is ever wanted,
gets its own name. Consequence stated rather than discovered later: the corner
zone is 30px and the body zone 12, so a wall shorter than about 60px on screen
has no body to grab until you zoom in.

**The store rung 3a forced.** `8992ad9`, on `MODEL.dc.html` rather than on this
page. `MODEL.dc.html`'s stale-write path merged unconditionally on a stated
assumption — *every key in this file is the Model Space's own except
`layout`* — which was true while LAYOUT was the only other writer and **rung
three made it false**. The consequence was live and had no race in it: move a
corner here and save, then edit in a still-open old tab, and the old tab is
correctly refused, re-reads, keeps its own stale walls, writes again, and
reports SAVED over your corner. The merge is now narrowed to the case it was
written for; anything else is a refusal the drafter can see. This is rung 1 of
the five-rung autosave ruling (Kevin, 8 Sep), now written down at
`RULING-autosave-two-writers.md`. *(Corrected 9 Sep: this paragraph used to
say the ruling's terms were "quoted in `8992ad9`'s message, the only copy on
main". Measured — they are not. That message argues rung 1 and mentions the
others only to say it took "nothing from rungs 2-5", and for a day the repo
held the fix with none of its reasoning. The ruling landed here later the same
day, carrying the two implementation choices rung 1 made that the ruling had
not — the sorted-key compare of persisted forms, and the baseline read from
the written file.)*

**What 3a deliberately did not do:** autosave. The `ifRev` refusal in `save()`
is one half of a story whose other half is a named edit lease and a change
broadcast, and that is rungs 2–5 of the autosave ruling, not something to take
on the way past a corner drag.

### The ladder ahead — PLANNED *(drafted by Devin 9 Sep, checked against the repo the same day)*

**Nothing below has landed. No commits, by the rule at the top of this
section.** Written down anyway, because the cost of tier 3's first five days
was a plan that existed only in one agent's head. Three of the plan's factual
premises were checked against the repo before it went in here; **two were
wrong, and both are corrected below rather than repeated.**

**3b — the level switcher.** Gilligan, in flight. Ids never indexes, and the
spec names a drawing with an inserted level. The hazard is stated above.

**3c — draw and delete a wall.** Gilligan, queued. New endpoints join the
corner pool or the page loses the property rung two is built on; the default
wall type comes from `_contextWallType()` on the old page rather than a
constant chosen here (`MODEL.dc.html:9016` — the FOUNDATION set and the
stud/insul set are different lists, and picking wrong is silent); saves go
through `ifRev`; the deliverable is an old-page round-trip spec, and every
field written names its deriver and its storer. **A note on the delete half:
the old page has no DELETE BUTTON for a wall.** Delete is the `delete`
keybinding (`profile-manager.js:128`, default `Delete`) over a SELECT-tool
selection (`MODEL.dc.html:22209`, refusal at `:22196`), and it is a multi-kind
operation there — walls, floors, roofs, fenestrations, dimensions, fixtures
and outline nodes all answer the same key, with a *"this corner carries built
geometry"* refusal in front of it. 3c takes the wall case only, and should
say so out loud, since the drafter presses the same key for all of them.

**3d — the rest of the autosave ruling.** Its first job was writing the ruling
down, because rungs 2–5 existed nowhere in this repository — measured, not
assumed: `git log --all -i --grep=lease` found no commit carrying them, and
`edit lease` appeared in no file on main but this one. **Done on 9 Sep:
`RULING-autosave-two-writers.md`.** The rungs now have a spec to be tested
against, and it is the spec — not this table — that the work is measured by:

- **Rung 2, the broadcast.** `onBucketChanged`, post-commit, both pages. A
  clean page re-reads; a dirty page never does. Cheapest rung in the design,
  and it also retires the bug where one LAYOUT sheet edit refuses every save
  from `MODEL.html` until reload.
- **Rung 3, the lease.** Own-keyed so heartbeats never bump the revision,
  with a TTL, a takeover generation, and a **silent resume** for a holder that
  was frozen rather than replaced. **Both model pages convert in the same
  slice** — a lease the old page does not respect is theatre, and a slice
  converting only `MODEL.html` should not be merged.
- **Rung 4, hide-save**, best-effort: a `pagehide` write was measured *not*
  landing on a tab reload in desktop Chrome, so nothing may depend on it.
- **Rung 5, autosave**, only once `MODEL.html` is the sole model writer.

Rung 3 does not wait on the iPad TTL measurement: the resume path is correct
under every outcome, and the constant is tuned afterwards.

**3e onward — one verb per rung, and the inventory is bigger than the plan
said.** The plan sketched *"fenestration, stairs, fixtures, outline/BONEYARD,
the bone"* — five. **Measured from the old page's own dispatch, the gap is 19
tool states**, and a count of toolbar buttons would have found neither the
right number nor the right names, so each is cited. Two crews measured this
independently and converged on the same 19 — across `activeTool === 'x'`,
`[...].includes(activeTool)` and `setActiveTool('x')`, cross-checked against
`POLAR_RULER_TOOLS` / `POLAR_TRACKING_TOOLS` / `ORTHO_LOCK_TOOLS`, which add
nothing new:

| verb | dispatch | verb | dispatch |
|---|---|---|---|
| `annotation` | `MODEL.dc.html:10219` | `line` | `:22720` |
| `beam` | `:22723` | `node` | `:22572` |
| `column` | `:22722` | `outline` | `:11744` |
| `copy` | `:7778` | `roof` | `:7314` |
| `cut` | `:22566` | `select` | `:6869` |
| `dimension` | `:22569` | `shape` | `:21390` |
| `extend` | `:7712` | `stair` | `:22759` |
| `fenestration` | `:7507` | `trim` | `:7622` |
| `fixture` | `:15366` | `wall` | `:22567` |
| `floor` | `:21386` | | |

**`select` counts as a nineteenth, and the number is misleading in the other
direction too: `MODEL.html` implements *none* of the 19 as tools.**
`MODEL.html:764` is `activeTool: null` and stays null; its selection is a hit
test, not a tool, and its whole write surface is two paths — a move-drag
commit and an undo, both ending at `markDirty()` (`MODEL.html:1615`, `:1679`).
No create, no delete. That is the real baseline 3c builds on.

**"The bone itself" is not a verb**, so the plan's five-item sketch had a
category error in it as well as a shortfall. `boneyardActive` is an orthogonal
mode flag (38 references in the old page, plus 11 for `activeBoneyardShelfId`)
that *composes* with the tools — fenestration's ghost is
`boneyardActive && activeTool === 'fenestration'`. A bone rung multiplies the
other rungs rather than sitting beside them; counting it as one of them is
3e's ladder wrong before it starts.

**Neither of the old page's own lists of itself is complete**, which is why
the count had to come from dispatch. `_contextToolLabel`'s `names` map
(`MODEL.dc.html:8997`) knows 14 of the 19 and has no entry for `trim`, `cut`,
`extend`, `copy` or `select`; `profile-manager.js`'s `DEFAULT_KEYBINDINGS`
binds those four and also `group`, `ungroup`, `delete`, `background`,
`tsquare`, `compass` and `freezeLength` — commands the label map never heard
of — while COLUMN, BEAM, STAIR, FIXTURE and ANNOTATION have no shortcut at
all. **Whoever orders 3e should take the union of the two, not either one**,
and the count in this table is of tool states, not of everything a drafter
can do: BUILD HOUSE, ROOM TAGS, AUTO DIMS, SHAPE CAPTURE, TURTLE, GRUFF and
the per-object deletes are buttons (`onBuildHouse`, `onRoomTags`,
`onAutoDims`, `onShapeCapture`, `onTurtleGo`, `onGruffOpen`, `onRoofDelete`
and its siblings), and they are a second inventory nobody has taken yet.

**One gap inside a rung already called done.** `MODEL.html` has undo — one
press, one undo, over the drag's own capture — and **it has no redo**: `redo`
appears nowhere in the file, while the old page binds `Ctrl+Shift+Z` and puts
a button on the strip for it (`MODEL.dc.html:2096`, `_redo()` at `:6296`) —
and the iPad drafter has no keyboard at all. An undo that cannot be taken
back is the more dangerous half to ship alone. Small, and it belongs to
whoever opens 3b, not to a board.

**The exit gate — when tier 3 is done.** `MODEL.html` does everything
`MODEL.dc.html` does *for the tasks it claims*; Movie draws a real house with
it and prefers it; and the old page still opens what the new one saved, with
no loss. Then the swap is two `href`s in `index.html` — a deliberate act, its
own PR, nothing sooner. **The round-trip half of that gate is the one with
teeth**, and it is testable today rather than at the end: every rung from 3c
on owes an old-page round-trip spec, and the gate is just the last one of
them.

### After MODEL — and one premise of that plan was already false

**`LAYOUT.dc.html` has already adopted `level-assembly.js`.** The plan
proposed that adoption as LAYOUT's natural tier 1; it landed on 6 Sep in
`c420e80` (PR #313), *"LAYOUT adopts level-assembly.js, and it had already
drifted"* — and the copy was not merely duplicated but **wrong**, answering
six fields where the module answers eight, with both pages handing the result
to `cut-view.js`. The adoption was proved by a differential over 8002
comparisons with seven mutations. `LAYOUT.dc.html:296-302` destructures the
module today and holds no table of its own.

**The stale sentence is `level-assembly.js:21`** — *"LAYOUT.dc.html still
holds its own copy; adopting this there is a separate change with its own test
surface"* — left standing in the module's header three days after the
adoption, and it is what the plan was read off. **Flagged, not fixed: it is
product code and this pass is docs.** It is one comment line and it belongs in
the next PR that touches that file.

So LAYOUT's ladder starts where MODEL's did — read the real drawing, paint it
with the real painters — with `layout-plan.js`, `wall-types.js` and
`level-assembly.js` already banked, and its own tier 1 still to be specced.
The rest of the order after that is unchanged and is not this file's to hold:
module review closes out through `MODULE-REVIEW-GATE.md`, the rename pass is
board #317, and the swap is the gate above. **There is no tier 4.**

## Tier 2c — floors through the real painter (3 Sep)

`paintFloors` now calls `drawFloor2D` instead of filling the outline by hand.
Cost: two more scripts, `formatters.js` and `cut-view.js`, because the painter
reads `env.formatInchesOnly` and the two garage-slab standards and those are
the modules that own them. Nine scripts now, and **the order is asserted**:
`cut-view.js:28-29` destructures `window.DraftWallTypes` and
`window.DraftFormatters` at module scope, so it throws while loading if either
follows it, and a head that throws paints nothing at all.

### The five filter rules were four rules and a wrong one

Tier 2a wrote the view filter as `(item.view || 'plan') === viewId` for every
item type. Measured against MODEL.dc.html, **floors default to `'floor'`**
(2905, 9029, 9089, 9098, 9162, 17025); every other type — wall, line, stair,
opening, fixture, device, seg — defaults to `'plan'`. A floor outline's home
layer set is FLOOR, or FOUNDATION where it is a concrete slab. It was never a
plan-set item.

Why no test caught it: the old page always writes an explicit `view` on a
floor, so **no fixture can produce the failing case**. It shows only on an
older saved drawing whose floors predate the field — precisely the drawings
that have to keep opening. `tests/model-html-floors.spec.js` builds that
drawing by rewriting the stored JSON, because waiting for one to turn up is
not a test.

The tier-2a spec asserted the rule longhand, deliberately not calling
`layer-views.js`, so that a wrong answer could not agree with itself. It
still passed: the rule and the implementation shared one misunderstanding.
**Longhand protects against a module lying to you, not against being wrong
about the module.** The thing that caught this was reading MODEL.dc.html's
`_activeFloors` directly.

### What `floors 0/3` on the default view means

Correct, and chased as a bug before that was established. MAIN FL's slab lives
on the FLOOR layer set, so the FLOOR PLAN (WALLS) set shows none of it — the
same answer `_activeFloors` gives.

What made it look wrong was that the `plan` layer set's `contents` lists
`A-FL`. **That reasoning is invalid, and the first version of this document got
it wrong twice over.** `contents` is not a filter: drawing membership is
`item.view` alone, and `contents` names layers for the layer panel. And nothing
is assigned to `A-FL` anyway — the string has zero references in MODEL.dc.html,
as does `A-WALL-EXT`; `layersFor()` is exported by `layer-views.js` and called
by nothing. The correct statement is that the contents list has no bearing on
what any painter draws. See DEFINITIONS.md, LAYER / LAYER SET / LEVEL.

The conclusion held only because it came from reading `_activeFloors` directly.
The explanation attached to it was reconstructed afterwards and was wrong — a
right answer with an invented reason behind it, which is worse than it looks,
because the reason is what the next person reuses.

`_courtesyFloorIds` — MODEL.dc.html's rule for showing a floor outside its
home view — is deliberately **not** implemented here. A courtesy floor is one
drawn from another layer set during a session; the Set is runtime-only and
never reaches the saved JSON, so a page that reads saved drawings has none to
honour. Verified against the serialiser rather than assumed.

### drawFloor2D's first coverage, and what is still uncovered

Before this file, `drawFloor2D` had none: the existing floor specs assert the
saved model — a slab exists, it has a thickness — and never that anything is
painted from it. Three of the six painters extracted on 3 Sep were in that
state.

The assertion measures `draw-floor-edge` ink on the canvas: the slab
**outline**, which only the real painter draws. The tier-2a wash filled and
never stroked, so the test fails both if the painter stops painting and if
someone quietly puts the wash back. Measured 0.002345 of the canvas with the
painter, 0.000000 with it no-op'd — presence against absence, not a tuned
constant.

Still unreachable from the default fixture, and recorded rather than implied:
the garage branch (pour note, dashed thickened-edge ring), floor openings cut
even-odd as holes, `preview`, and `selected`. All four env keys those need are
supplied anyway — an interface satisfied for the fixture is not an interface
satisfied, which is the tier-2b lesson — but nothing exercises them here.

## Tier 2d — the grid, and what a datum is (3 Sep)

`paintGrid` now calls `drawGrid2D`. Tier 1's version drew a grid ALWAYS,
aligned to world 0,0. That was a divergence from the product, and it took
three separate measurements to establish rather than to assume.

### The datum is the drafter's zero

MODEL.dc.html sets `state.drawingOrigin` from the drafter's **first click**
(MODEL.dc.html:10360). Movie, 3 Sep: *"that way he always first clicks on
0,0."* The grid is anchored there, and with no datum `drawGrid2D` returns
before drawing anything.

That is deliberate and already had a test — on the old page:
`registration-grid.spec.js`, *"an untouched model space draws no grid, and the
first node sets the datum"*.

**The generated house has no datum.** It is never clicked into place, so it
saves `drawingOrigin: null` and correctly gets no grid. Verified by pixels
before it was believed: the old page's plan canvas measures 29.68% ink and
0.00% grid grey, and the same detector finds grid grey on the sheet
thumbnails, which use `_drawPlanThumb2D`. So the zero is a real absence, not a
broken colour match.

### ABSENT and NULL again

The third time this shape has appeared, after the floors `view` fallback.
MODEL.dc.html:5160:

```js
drawingOrigin: 'drawingOrigin' in saved
  ? normaliseDrawingOrigin(saved.drawingOrigin)
  : { x: 0, z: 0 }
```

Absent = a drawing made before the datum existed. It was drawn on the world
grid, so `0,0` leaves every coordinate where it is. Explicit `null` = "no
origin yet", which is where NEW starts. `drawing.drawingOrigin || null`
collapses them and strips the grid from every pre-datum drawing — and no
fixture can catch it, because the old page always writes the key now. The spec
builds that drawing by deleting the key.

### The readout says which

`datum 4.00,-7.00` · `datum 0.00,0.00 (world, back-filled)` · `datum none — no
grid`. An absent grid should read as a fact about the drawing rather than a
broken page. Movie, 3 Sep: *"i like all that info down in the left corner keep
adding to it and don't delete."*

### Three grid weights, so three palette roles

`drawGrid2D` draws 1ft fine, 10ft major and 100ft coarse; the palette had two.
`draw-grid-coarse` makes sixteen roles. The harness asserts the three **read**
as three, in order — checking each against the ground separately would pass
with all three identical. Measured 1.13 < 1.40 < 1.84 night, 1.17 < 1.42 <
1.88 day.

### The assertion took three attempts, and the failures are the lesson

The skins spec asserted *"the grid should be visible but quiet"* — `faint >
50,000`. With the grid correctly gone it measures 28. **That assertion was
pinning a divergence I had introduced**, which is what a test written against
your own output does when the output is wrong.

Two replacements failed before one worked:

1. **`faint` as a ratio.** Rejected: it differs EIGHT-FOLD between skins —
   0.00143 night against 0.01109 day — because dark ink anti-aliasing onto a
   light ground leaves far more intermediate pixels than the reverse. No
   threshold has a wide answer between those. The attempt picked 0.01, which
   sits between them.
2. **Counting grid-grey pixels.** Rejected: night ink anti-aliasing onto the
   night ground passes THROUGH the grid greys, so the no-grid render scored
   1 px in one house and 306 in another. A colour count cannot tell a
   manufactured grey from a painted one.

What landed is a **ratio against the same scene**: measure the page, add a
datum, measure again — 6,418 against 1–306, so 21x at worst and 6,000x at
best. Same walls, same fit, same anti-aliasing on both sides of the
comparison, so the noise cancels instead of having to be thresholded.

> The general form, now three times over in this file: **when an absolute
> measurement has no wide answer, measure the same thing twice and compare.**
> A control is cheaper than a constant, and it does not rot.

### Where the extraction actually stands

Measured 3 Sep by brace-matching every painter-shaped method in
MODEL.dc.html and checking whether its body delegates:

| | count | |
|---|---|---|
| delegated to `render-2d.js` | 14 | wrappers of 4–33 lines |
| still carrying their own body | **17** | **1,080 lines** |

The moved half is the leaves. What remains holds `_drawCuts2D` (246 lines),
`_drawStairSectionPane` (163), `_drawStructure2D` (135),
`_drawStairPlanPane` (119) and `_drawTourRoof2D` (98).

---

## Tier 2i — what is actually left, measured (5 Sep)

MODEL.html calls **8 of the 16** painters in `render-2d.js`. The other eight
were an undifferentiated list; they are not an undifferentiated list.

### The criterion

**Does the painter draw saved drawing content, or something that only exists
while a tool is mid-gesture?** Saved content is the plan, and tier 2 is the
plan. Gesture state is interaction, and interaction is tier 3.

| painter | tier | why |
| --- | --- | --- |
| `drawStairs2D` | **2** | `stairs` is persisted |
| `drawCutMarks2D` | **2** | `cuts` is persisted; section marks print |
| `drawNoteScreen2D` | **2** | `notes` is persisted |
| `drawUnderlays2D` | **2** | `underlays` is persisted — it is what you trace |
| `drawFixture2D` | **2** | `fixtures` is persisted |
| `drawStairNotes2D` | 3 | serves `_drawStairWorkspace2D` only — a separate pane |
| `drawBoneyardMark2D` | 3 | gated on `boneyardActive` — a separate workspace |
| `drawCutPreview2D` | 3 | `cutStart` / `phase` / `hoverSide` — pure gesture state |

Five to go, not eight.

### Cost, from the call sites — NOT from the function bodies

The first pass extracted each painter's env by taking a line range between one
declaration and the next and grepping it for `env.`. It gave `drawUnderlays2D`
sixteen keys including grid spacing and camera position. The range had run past
the end of the function into the next one. **The call site is the truth**; the
function body's line range is arithmetic, and arithmetic run past a closing
brace is how `_wallCross` was reported impure earlier the same day.

```
drawUnderlays2D    MODEL.dc.html:3619   4 keys
drawStairs2D       MODEL.dc.html:7663   9 keys
drawNoteScreen2D   MODEL.dc.html:8130   2 keys   (two colours)
drawCutMarks2D     MODEL.dc.html:8173   4 keys
```

### The six env suppliers, transitively

Brace-matched whole bodies, then the closure of every `this.` reference:

```
_wallFrame            0 methods    PURE
_wallCross            0 methods    PURE
_stairPlanParts       2 methods    PURE
_fixtureGeometry      3 methods    _walls
_cutLineSpan          2 methods    _walls, state.autoDimFirstOffsetFt
_stairCurrentLayout   6 methods    _walls, state.{levels, levelAssemblies}
_autoElevationCuts    4 methods    _walls, _dimensions,
                                   state.{elevationMarkOffsets, structureStandards}
```

`_walls` and `_dimensions` are not obstacles — MODEL.html holds both already
and the shipped painters take them as env. The state keys are the question, and
`tests/persisted-format.spec.js:41` answers it authoritatively — better than
grepping `drawing-format.js`, which lists none of them and made them look
transient:

- `levels`, `levelAssemblies`, `elevationMarkOffsets` — **persisted per drawing**
- `structureStandards` — a **Company Standard**, normalised in
  `profile-manager.js:366`, edited by STANDARDS.html. Already shared.
- `autoDimFirstOffsetFt` — **not persisted**: a UI preference, default `1.5`,
  set from a menu at `MODEL.dc.html:21688`. MODEL.html takes the default and is
  correct for any drawing whose author never opened that menu.

**Nothing in the closure reads interaction state.** The blocker THE TEST OF A
FINISHED EXTRACTION worried about — "its env has to be reachable too" — is
real, and smaller than it has looked since that section was written.

### A seam worth naming

`levelAssemblies` and `elevationMarkOffsets` are persisted, but MODEL.dc.html
serialises and restores them itself (`:3191`, `:5240`) rather than through
`drawing-format.js`. A second page reading them reads raw saved JSON with no
normaliser in front of it. That is not tier 2's job to fix, but it is the
reason those two keys are absent from the format module and looked like session
state on the first check.

### Order, cheapest first

1. `drawNoteScreen2D` — two colours. The work is the filter, which the level
   filter already does.
2. `drawFixture2D` — two pure methods, one `_walls` method, two literals, and a
   `closets.js` script tag. Task #12.
3. `drawCutMarks2D` — one `_walls` method, one preference with a default.
4. `drawStairs2D` — `_stairPlanParts` is pure; `_stairCurrentLayout` needs
   levels and assemblies, both of which MODEL.html reads already.
5. `drawUnderlays2D` — four keys, but `imageFor` reads a decoded-bitmap cache
   and MODEL.html has no loader. Four keys is not four keys of work. Measure
   the loader before committing to it.

---

## Tier 2j — the five painters share one blocker, and it is colour (5 Sep)

Tier 2i costed the five remaining painters from their call sites and found the
env reachable in every case. That was true and it was not the whole story.

**None of the five is skin-aware, and four of them fail the night page.**
Measured against `palette.js`'s two skins:

```
painter     how the colour is reached          hex        night    day
notes       env, NOTE_COLOR                    #1d1f20      1.00  14.79   under 3.0
fixtures    env, FIXTURE_COLOR                 #1d1f20      1.00  14.79   under 3.0
            AND A SECOND COLOUR THIS ROW MISSED -- see Tier 2k
stairs      env, STAIR_COLOR                   #5d4a8a      2.22   6.68   under 3.0
cut marks   BARE LITERAL in the painter        #b04060      2.95   5.01   under 3.0
underlays   env.colors.origin, literal fallback #557a46     3.36   4.41
```

**The underlays row said "hardcoded IN the painter" until it was checked
properly, and that was wrong.** `render-2d.js:728` reads
`(env.colors && env.colors.origin) || '#557a46'` — env-driven already, the
literal only a fallback, under a comment that explains the whole design:
*"MODEL.dc.html has no skins and its ground is always light, so this value IS
correct for that page… a caller that supplies colours gets its own; the one
that does not keeps exactly what it painted before."* Somebody had already
solved it.

The error came from grepping the function's line range for a hex and reading
its PRESENCE rather than its POSITION — the same shape as costing a painter's
env by line range instead of by call site, two sections up. A literal inside a
painter is not evidence of a hardcode; the line it sits on is.

**So one painter needs changing, not two.** Only cut marks
(`render-2d.js:1469-1470`) assigns `ctx.strokeStyle` and `ctx.fillStyle`
without consulting env at all.

> **That sentence was wrong, and Tier 2k is where it was found.** It counted
> one colour per painter. `drawFixture2D` sets two — the linework from
> `env.FIXTURE_COLOR`, and a body fill that was a bare
> `rgba(255,255,255,0.65)`. The row above is right about the colour it
> looked at and silent about the one it did not. Two painters needed
> changing.

Underlays has a different defect, and a more interesting one: it reads
`env.colors.origin` — **the origin marker's key** — so a tracing underlay and
the drawing origin are one colour by wiring, not by coincidence. Move the
origin and every underlay moves. That is exactly the shared-key coupling the
five separate keys exist to prevent, already live in the code, and it is why
`draw-underlay` is a re-point rather than a rescue.

`1.00` is not a rounding of "poor". The night skin's `surface-page` is
`#1d1f20` and `NOTE_COLOR` is `#1d1f20` — **the identical hex**. A note would
be painted in exactly the colour of the page behind it.

### Why nothing is broken today

`MODEL.dc.html` has no skins. It is one light page, every one of these reads
fine on it, and no check could have caught otherwise because there is no second
ground to test against. MODEL.html **is** skinned, so the defect is created by
the port rather than found by it — which is the same shape as `drawRoof2D`'s
`#7a4a21`, right down to the fix: that brown moved out of the painter into
`env.colors.roof` and got a value per skin.

### One of them cannot be fixed from the call site

`stairs` and `notes` and `fixtures` take their colour through `env`, so a
caller can pass whatever the skin says and the painter never changes.

`cut marks` takes no colour from env at all, so it needs the painter changed —
and under the harness's own rule that means a `render-2d-harness.js` check in
the same PR or the mutation step goes red.

`underlays` needs no painter change. It needs its caller to stop passing the
ORIGIN colour and start passing `draw-underlay`.

### So the order in Tier 2i is right and its costing was low

Notes still goes first — it is two env keys — but the "two colour keys, nearly
free" line assumed a colour existed to pass. It does not. **The real first step
is one palette decision**, and it unblocks all five at once rather than being
five separate problems:

- `ink-primary` (13.16 night / 14.79 day) for notes and fixtures, if annotation
  should read as text. Already in both skins; needs no new key.
- `draw-dim` (5.15 / 6.05) if annotation should sit in a visibly different
  family from body text.
- New keys for stairs, cut marks and underlays either way, since none of those
  maps onto an existing role — and underlays most of all, because it is
  currently borrowing one.

**Bring measured candidates, do not guess a colour.** The `drawRoof2D` entry in
`HANDOFF-SKIPPER.md` has said so since 4 Sep and it applies to all five.


## Tier 2k — fixtures, and the four functions that had to come with them (5 Sep)

Fixtures is the painter tier 2i costed as expensive, and it was: two new
script tags where the walls cost one, and a new module. It is also the one
that removes code rather than adding it — `MODEL.dc.html` is 86 lines shorter
than it was.

### Why a module and not a call

`drawFixture2D` is the only painter here that **does not know where its
subject is**. Every other one takes geometry and draws it; this one takes a
fixture and asks its caller three questions — `fixtureGeometry`, `wallFrame`,
`wallCross` — because a fixture is stored as an offset along a wall and has to
be resolved against that wall's assembly before anything can be drawn.

Those answers were methods on `MODEL.dc.html`'s component, so they were
reachable from exactly one page. That, and not the painter, is why this page
drew no fixtures through two tiers.

**It is four methods, not three.** `_fixtureGeometry` hands the tub case to
`_tubGeometry`, which needs the other two to find the end of the alcove. The
four are a closure; splitting any one out moves the dependency rather than
removing it.

`fixture-geometry.js` is those four as pure functions over a `walls` array.
`MODEL.dc.html` keeps its method names and delegates in one line each.

### The measurement that made it a module rather than a copy

All four are pure — the only `this` inside their own bodies is each other and
`this._walls`.

**And that is the third time a line range has lied about a function here.** A
grep over `_fixtureGeometry`'s neighbourhood reports `this._canvas`,
`this._orthoHalfH`, `this._activeWalls` and `this._distToLineSeg`, which would
have made it component-bound and unextractable. All four are in the *next*
method, past the closing brace. Brace-match before believing a range; the rule
is in Tier 2j and it needed applying again the same day.

### The extraction was proved, once, and the proof is not kept

Before `MODEL.dc.html` was touched, a differential ran the module against the
live methods while both copies existed: **8421 comparisons across 2994
fixtures — every wall type, every `refLine`, both sides, standoffs, degenerate
walls, and tubs at every alcove length — identical.**

It caught a real defect on its first run. `_tubGeometry`'s return carries a
`corners:` line and the transcription dropped it: the method had been read
through two windows that did not meet, and one line fell in the gap. Every
number beside it was right, so a tub would have painted its two decks and no
body.

**A function read through two windows is not read until the windows are proved
to touch.** Same family as the line-range trap, and it is the reason the
differential existed rather than a spot check.

That differential is **recorded here and deliberately not committed**.
`MODEL.dc.html` delegates now, so the same comparison would be the module
against itself, and a check that reads the thing it is checking cannot fail.
What is committed instead is `proto/fixture-geometry-harness.js` — the
contract, 52 checks, 27 mutations, all caught — including `a tub returns four
corners`, which is the dropped line turned into a standing check.

### The colour, and the row Tier 2j got wrong

Tier 2j read one colour per painter and cleared fixtures on that basis:
`FIXTURE_COLOR` comes through env, so no painter change. Brace-matching
`drawFixture2D` (`render-2d.js:419-628`) finds two colour literals in it:

```
:449  ctx.fillStyle = 'rgba(255,255,255,0.65)'   the body fill, EVERY fixture
:624  ctx.strokeStyle = '#5980a6'                the selection stroke
```

The second is inside `if (options.selected)` and this page has no selection,
so it never fires here. The first fires on every fixture, and it is the same
defect as the leader note one layer in: a translucent white body on a
`#1d1f20` ground, under `#e7e5e2` linework. The fixture is erased.

So it becomes `env.fixtureFill`, **with no fallback**. A
`|| 'rgba(255,255,255,0.65)'` would let a caller keep the literal by saying
nothing, which is the drift the change exists to remove. `MODEL.dc.html` now
names the white it has always drawn — no pixel moves there — and MODEL.html
passes its own ground at the same 0.65, spelled as an appended hex alpha byte
(`#1d1f20` + `a6`), guarded by the shape of the value so a skin that ever
returns an `rgba()` falls through opaque instead of producing nonsense.

### The selection rule is inheritance, and it has to be

A fixture **carries no view of its own**: `drawing-format.js:179` stamps every
one `'plan'` whatever was saved. So filtering on `fixture.view` would be
filtering on a constant, and a fixture on a hidden wall would come back.

The bone's rule (`_activeFixtures`, with the note above it saying so in as
many words) is that a fixture inherits its host wall's visibility. MODEL.html
keys off its own `walls()` for exactly that reason, which gives the same rule
against a smaller set — this page paints no shared-context walls yet, and
follows them with no edit when it does.

`tests/model-html-fixtures.spec.js` pins the case that tells the two apart: a
wall on the FOUNDATION layer set, on the level being viewed, holding a fixture
stamped `plan`.

### The bill

| | |
|---|---|
| new module | `fixture-geometry.js`, four functions plus the tub and counter specs |
| `MODEL.dc.html` | **-86 lines**, four one-line delegations, two constants re-pointed |
| painter | one line, `env.fixtureFill`, no fallback |
| script tags | `fixture-geometry.js`, `closets.js` — the tier-1 exact list goes 9 to 11 |
| checks | 52 + 27 mutations (module), 1 + discriminator (painter), 6 page tests |

Two of the five painters are done. Stairs, cut marks and underlays remain, and
cut marks is the only one left that still needs the painter itself changed.


## Tier 2l — cut marks, the last painter that needed changing (6 Sep)

The third of five, and the one Tier 2j singled out as the only genuine painter
change left. That was right about the painter and wrong about the count.

### Two colours again, and the same audit missed both times

Tier 2j listed cut marks as one hardcode at `render-2d.js:1469-1470`. Two
things were wrong with that line. The numbers had drifted — it is 1481-1482
now — and there is a **second colour**:

```
:1452  ctx.fillStyle = '#fff'          the bubble interior
:1481  ctx.strokeStyle = '#b04060'     the ink
:1482  ctx.fillStyle   = '#b04060'
```

Identical species to the fixture body fill, found the same way, and missed the
same way. **The rule this establishes: every painter that fills a symbol has an
interior, and an audit that counts one colour per painter cannot see it.** The
env-supplied ink is what hides it — the painter looks wired because the colour
you thought to check comes through `env`.

Both go through env with **no fallback**, for the reason fixtures did. Note
`const ink = ctx.strokeStyle` reads back whatever `:1481` set, so one key
carries the triangles and the lettering too; a third key would be wrong.

`#b04060` **is** the day value of `draw-cut`, so the light page does not move.

### drawCutPreview2D is a third site, and is deliberately left alone

`drawCutPreview2D` (`render-2d.js:1489-1509`) hardcodes `#994466` — the
in-progress rubber-band line while a cut is being placed. It is **not the same
colour**: the preview is deliberately duller than the committed cut, so
"fixing" it by reusing `draw-cut` would change MODEL.dc.html's pixels rather
than preserve them.

It stays hardcoded because it cannot be exercised: its only caller is
MODEL.dc.html, which has no skins, and MODEL.html has no cut tool so it cannot
call the preview at all. Routing it through env would add a key with one
caller, one possible value, and no night path to test on.

**And here is what that night path will find when it exists.** Skipper
measured `#994466` with `palette.js`'s own `contrast()` against both grounds:

```
              ground     #994466
day    (both themes)     #f2f2f3      5.56
night  (both themes)     #1d1f20      2.66
```

Fine where it runs, and **2.66 is under the 3.0 floor for a line**. So this is
not a tidy-up deferred, it is a defect with a date on it: the first cut tool on
a skinned page inherits it. Recorded here with the number so whoever adds that
tool is not re-measuring from scratch.

It also settles the shape of the eventual fix. `draw-cut-preview` wants to be
its own palette role with two values, NOT a tint derived from `draw-cut`: a
derived tint would inherit the same failure the literal has, and the two
colours are not related by lightness anyway (`#b04060` to `#994466` is a hue
and saturation move, not a step).

### Four inputs from three places, and one from nowhere

This painter's seam is the widest of the five:

| input | where it lives | |
|---|---|---|
| `cuts` | the drawing | persisted, read like walls |
| `elevationMarkOffsets` | the drawing | persisted |
| `structureStandards` | the **profile** | localStorage, not the drawing |
| `autoDimFirstOffsetFt` | nowhere | session state on the old page |

`structureStandards` — is the auto-elevation ring on, which bubble style — is
the drafter's OFFICE STANDARD, read with `DraftProfileManager.getActive`. So
**profile-manager.js is in MODEL.html's head**, the first dependency there that
is not about drawing the drawing. The cheaper option was office defaults, and
it was rejected on what it would look like: a drafter who had switched the ring
off opens the viewer and finds four elevation marks round the house.
`tests/model-html-cuts.spec.js` has the check that earns the dependency — flip
the profile, watch the ring go — and it is the only test in that file that can
tell the two designs apart.

`autoDimFirstOffsetFt` has no home. It is a menu setting the bone keeps for the
session and never saves, so MODEL.html uses `1.5'`, the value MODEL.dc.html
starts every session with. **A drafter who changed it mid-session sees a
slightly different gap here.** That is the one place this page cannot be
faithful, and it is stated rather than hidden.

Two globals, not one: the reader is `DraftProfileManager`, the normaliser is
`DraftStructureStandards` (`profile-manager.js:479`). The first attempt reached
for `PM.normaliseStructureStandards`, which is undefined — the name was grepped
out of an export list and the wrong object assumed around it. The page caught
the throw and said "painter failed", which is the notice doing its job.

### The extraction, and what its own guard missed

Five methods, 80 lines out of `MODEL.dc.html`, pure over walls + dimensions
plus three settings passed in. `_autoElevationsOn` and `_cutMarkGapFt` stay on
the component: two-line state reads with no geometry, and dragging state access
into a pure module to save four lines is the trade backwards.

Proved by a differential run while both copies existed: **32256 comparisons —
six wall sets, six dimension sets, seven offset maps including `null`, `NaN`,
`Infinity` and a string, both auto-elevation states, four gap values, eight ray
directions — identical.**

That differential carried a guard asserting each extracted window starts with
the method it claims and closes at depth zero. **`_autoElevationsOn` was left
off the guard's list and was the one window that was wrong.** A guard only
covers what it is pointed at.

A second slip in the same edit, the reverse of the tub's: the `_eMarkDimEdges`
replacement sliced to the comment above `_autoElevationCuts` and **swallowed
`_eMarkClearFt`, which sat between them.** Nothing called it any more, so it
would have gone unnoticed. It is restored as a delegation — removing a method
from that page is a different change from moving its body, and only the second
was agreed.

### Five mutations survived the first harness, and one of them was the house rule

`proto/cut-marks-harness.js` measured 48 checks / 20 of 25 mutations before the
gaps were closed. Worth listing, because the first is the failure this repo
names most often and it was made here anyway:

- **Two checks read the constant back off the module** — `expect(clearance ===
  G.E_MARK_CLEAR_FT)`. Mutate the constant and both sides move. *A check that
  reads the thing it is checking cannot fail.* Now pinned at 2' and 6'.
- **The corridor-pad case sat inside the corridor**, so it pushed the edge
  either way. The real case is a string in *neither* corridor.
- **The miss-the-house case left by the wrong door** — a cut at (100,100) never
  travels the z slab and exits at `!sx || !sz`. The guarded overlap test needs
  a diagonal that grazes the corner.
- **One mutation was removed rather than caught.** `!Number.isFinite(tMin)` is
  unreachable: a slab returns infinities only when the ray is parallel to it,
  and a unit vector cannot be parallel to both axes. The guard is kept (this
  was an extraction, not a cleanup) and the mutation dropped with the reason
  written down — a mutation nothing *can* catch reads as a coverage gap when it
  is really dead code.

Final: **52 checks, 24 mutations, all caught.**

### Two page checks were wrong before they were right

Both worth keeping, because both looked correct:

- **The discriminator proved the wrong thing.** "With no cuts the ink is never
  stroked" *failed* — `drawCutMarks2D` sets `strokeStyle` before it iterates,
  so the colour is set whether or not anything is drawn. Stroking draw-cut only
  ever proved the painter RAN. The lettering is what discriminates: every cut
  writes its own name inside its bubble.
- **The bubble-style check compared a tally.** `window.__fills.length` came to
  54 for both styles — equal by coincidence, so the check passed nothing
  through. It compares the drawing operations now.

### The bill

| | |
|---|---|
| new module | `cut-marks.js`, five functions |
| `MODEL.dc.html` | **-80 lines**, five delegations, three constants re-pointed |
| painter | two lines, `env.cutColor` and `env.bubbleFill`, no fallback |
| script tags | `cut-marks.js`, `profile-manager.js` — the exact list goes 11 to 13 |
| checks | 52 + 24 mutations, 2 painter checks + discriminators, 6 page tests |

**Three of five painters done. Stairs and underlays remain, and neither needs
the painter touched** — measured by brace-matching both bodies: zero hardcoded
colours in either. Stairs is the larger extraction of the two (13 methods, 167
lines, all level data, all persisted); underlays is a caller re-point plus an
image loader MODEL.html does not have yet.


## Tier 2m — stairs, and the module that had to come first (6 Sep)

The fourth of five, and the first where the painter was never the problem.
`drawStairs2D` has no hardcoded colour and needed no edit — Tier 2l's
brace-match was right about that. What it cost instead was a **second module
nobody had costed**, and the reason is worth reading before Tier 3 is planned.

### The closure was 13 methods and only 6 of them were stairs

Measured by brace-matching, not by reading a line range:

```
_stairPlanParts     92 lines    _floorLevels        6    reads this.state
_stairShapeSplit    17          _levelWallTopFt     6
_stairDescent       15          _activeLevelId      4    reads this.state
_stairLayout         7          _levelFloorFt       4
_stairLandFt         5          _levelAssembly      3    reads this.state
_stairCurrentLayout  4          _activeLevel        2    reads this.state
                                _boneyardLevelId    2    reads this.state
```

The right-hand column is the app's **level spine**, not stair geometry, and the
call counts settle it: `_activeLevelId` has **66 callers** on the component,
`_floorLevels` 21, `_levelAssembly` 17. Moving those into a stair module would
make the stair module the owner of the level model. So six functions moved and
the seventh question — *what is this level made of* — is passed in through a
`levels` accessor that can be handed an object literal in a test.

### The constants could not move, and that is not a weaker extraction

`cut-marks.js` and `fixture-geometry.js` took their constants outright;
`CUT_BUBBLE_PUSH_FT` appears **zero** times in `MODEL.dc.html` today. Stairs
cannot do that. `STAIR_TREAD_RUN_IN` is named **17 times** and only 6 are in the
closure — the STAIR SECTION drawing measures its own treads with it, and so do
the auto-placer and the stair schedule.

So the module owns the value and the page **binds** to it:

```js
const STAIR_TREAD_RUN_IN = window.DraftStairGeometry.STAIR_TREAD_RUN_IN;
```

One source of truth either way; the seventeen uses do not change. Four
constants that turned out to be closure-only (`STAIR_MAX_RISER_IN`,
`STAIR_LANDING_MIN_FT`, `STAIR_LANDING_DRYWALL_IN`, `STAIR_RAIL_INSET_FT`) left
outright and are now at zero references.

### THE FINDING: the stored rise is a fallback, and trusting it is a real defect

This is the part that cost the extra module, and the part Tier 3 should learn
from.

A stair stores `riseFt`. It is tempting — and it was the cheap path — to have
`MODEL.html` read it and skip the level model entirely. It is **wrong**, and
not marginally:

- `_stairCurrentLayout` re-derives the rise from the level heights on **every
  paint**, and uses the stored value only *"if its level goes away"*.
- Nothing ever writes the derived rise back. All four writes to `riseFt` are at
  stair **creation**.
- So edit a wall height or a joist depth, save, and the stored rise is stale
  while the bone keeps drawing the derived one.

Two boards would then have drawn **the same drawing with different riser
counts**, and no test on `MODEL.dc.html` could ever have caught it — that page
never reads the stored value while a level exists. Same family as the note
painted in the night page's own colour: *the second page creates the defect, so
the second page is where the test lives.*

That forced `level-assembly.js`, which was overdue on its own: the defaults
table saying what a level is made of existed in **three copies** —
`MODEL.dc.html`, `LAYOUT.dc.html`, and `proto/elevation-harness.js`, whose
comment already admitted it *"mirrors LAYOUT.dc.html's normaliseLevelAssembly
exactly"*. This change adopts it in `MODEL.dc.html` only; **LAYOUT.dc.html still
holds its own copy** and adopting it there is a separate change with its own
test surface.

### How the extraction was proved

The differential ran while both copies existed, and it does not survive into
the repo — `MODEL.dc.html` delegates now, so the same comparison would be the
module against itself. It sliced the **live method text straight out of
`MODEL.dc.html`** (constants included) and raced it against the module over
random stairs:

| | comparisons | mutations caught |
|---|---|---|
| `stair-geometry.js` | 24000 / 24000 identical | 12 of 12 |
| `level-assembly.js` | 6007 / 6007 identical | 10 of 10 |

Before that, a **textual** diff of every extracted body against its original:
`_stairPlanParts` came out at 76 code lines each with the single difference
being `}` versus `};`. That check exists because a function read through two
windows that do not touch is a function with a missing line, and one of those
shipped a tub with no body earlier in this tier.

### What the sweep caught that the tests did not

The page tests were mutated too, and one mutation went **green**: routing
`stairs()` through the page's ordinary `onPlan()` helper. Stairs filter
strictly on `view` — `stair.view === view`, no `|| 'plan'` fallback, unlike
every wall and fixture beside them — and the three stairs in the test all
carried an explicit view, so nothing could tell the two rules apart. A stair
with **no view field** is the only input they disagree about. It is in the test
now. The comment claiming the strictness mattered had been there the whole
time; the assertion had not.

### The bill

| | |
|---|---|
| new modules | `stair-geometry.js` (6 functions), `level-assembly.js` (3 + the defaults table) |
| `MODEL.dc.html` | **-166 lines**, 6 stair delegations + `_stairLevels`, 2 functions and 11 constants bound |
| painter | **untouched** — no hardcoded colour, `env.stairColor` already reads through |
| script tags | `level-assembly.js`, `stair-geometry.js` — the exact list goes 13 to 15 |
| checks | 30007 differential comparisons, 22 module mutations, 3 page tests, 4 page mutations |

**Four of five painters done. Underlays is the last one, and it is the one that
could still stop short of the definition** — `imageFor` reads a decoded-bitmap
cache and `MODEL.html` has no loader. That is a loader to measure before
committing to it, not a re-point.

### Why a store fix rides in the stairs change (6 Sep)

`shared-file-store.js` is in this diff and it has nothing to do with stairs.
It is here because verifying the stairs work found it, and the finding is
worth more than the tidiness of a narrow PR.

Verifying tier 2m meant running the full suite, which surfaced seven failures.
Attributing them took a second checkout at `3223d79` and a second machine, and
produced a table nobody expected:

| | base `3223d79` | stairs |
|---|---|---|
| one container, idle ×3 | **2, 2, 1 rotating** | 0, 0, 0 |
| another container, idle ×3 | 0, 0, 0 | 0, 0, 0 |

Six of the seven were **already failing on main**. The suite was not green
before this change and is not made worse by it. But two facts refused to sit
together: one machine lost the race every run and another never did, and on
the machine that lost it, adding two `<script>` tags to MODEL.html — nothing
else — made it stop. A change that alters nothing but page weight should not
fix a bug.

It doesn't. `openDb` wired `onupgradeneeded`, `onsuccess` and `onerror`, and
`indexedDB.open` has a fourth outcome: **blocked**, which fires when a
`deleteDatabase` is still pending. While blocked, neither success nor error
fires — and because the promise is cached in `dbPromise`, and `forget()` is
reachable only from the handlers that never ran, one blocked open wedges every
later read for the life of the page.

Eleven spec files call `deleteDatabase('pdf-img-mgr-shared')` in their init
scripts. That string is `DB_NAME`.

So both observations were one defect seen from opposite ends: **anything that
delays the open past the delete hides it.** Two script tags did. So did a
faster machine. That is why the stairs branch appeared to "fix" the race, and
why banking that would have been the worst outcome available — a bug that
stops reproducing is a bug that stops getting fixed.

**The rule this leaves.** A pre-existing failure is not attributed until it has
been run on a second tree AND a second machine. One clean run on the box you
happen to have proves that box, not the code. Every conclusion in the table
above changed at least once before the sixth run.


## Tier 2n — underlays, and the honest half of a cheap decision (6 Sep)

The last of the five. The painter needed nothing — twenty lines, no hardcoded
colour, four env keys. What it needed was a **loader**, and the loader forced a
decision that is only defensible if it is said out loud.

### The painter refuses four ways and every refusal draws nothing

```
env.isPrinting                     -> return
no underlays, or no activeLevel    -> return
underlay.levelId !== activeLevel.id-> skip
imageFor(id) falsy                 -> skip          <- the one that matters
width or height under 1px          -> skip
```

That silence is deliberate and correct: an underlay is a photograph or a PDF
page and it arrives with its own colours, so the painter puts no ink of its own
on the page (palette.js says the same about `draw-underlay`). No placeholder,
no outline, not even for image-not-loaded.

**Correct in the bone, dangerous here.** MODEL.dc.html always has the image,
because it decoded it. This page might not — and a viewer that silently omits
the thing the drafter was tracing is indistinguishable from a broken viewer.

### RASTER ONLY, and the cost of the alternative

MODEL.dc.html's loader decodes two kinds: images straight from the blob, PDF
pages re-rendered through pdf.js. Carrying pdf.js here costs **1.37 MB**
(`vendor/pdf-3.11.174.min.js` 312 KB plus its 1061 KB worker) on a page whose
entire claim is a short, exact dependency list that a test pins.

So this page decodes rasters — seven lines, `loadNamedFile` +
`createImageBitmap`, **no new dependency, the script list stays at 15** — and
says so about the rest.

The bone's loader already contains the identical refusal
(`if (!window.pdfjsLib) continue;`). The difference is not the behaviour, it is
that this page admits it on screen.

### Where the admission goes, and why not a dialog

`#notice` is a full-screen overlay for fatal states — wrong for "one image of
four is missing while the drawing is fine". The readout already speaks in
shown-of-total AND already carries this exact rule for dropped geometry:
*"Malformed geometry is dropped on load. Say how much, so a thinner drawing is
a fact rather than a mystery."*

So the counter joins it, on the same rule:

```
underlays 1/2   ...   1 PDF underlay not drawn (needs pdf.js)
```

### THE TEST FOUND A BUG IN THE COUNTER

The loader decodes every underlay in the drawing, not just the active level's,
so switching level is instant — the bone does the same. The counter's numerator
was `underlayImages.size`, which counts images the drafter cannot currently
see. Against a level-scoped denominator it printed **`underlays 1/0`**.

A ratio above one is not a fact, it is a bug, and it would have shipped: it
only appears when an underlay on ANOTHER level has decoded. Both sides are
level-scoped now.

### And a mutation survived the first sweep, for the second time this tier

Deleting the `|| underlay.kind === 'pdf'` guard from the loader left all three
page tests green. The PDF fixture had no stored file, so the loader bailed one
line earlier at `loadNamedFile` and the guard was never reached — the test
could not tell the guard from its absence.

The fixture now stores a **decodable PNG under a `kind: 'pdf'` record**, so the
guard is the only thing stopping it, and `underlays 0/1` becomes a statement
about the guard rather than about a missing file. Same shape as tier 2m's
`onPlan` gap: *a test that cannot reach the branch is not testing the branch.*

### The bill

| | |
|---|---|
| new modules | **none** |
| `MODEL.html` | +1 painter, +1 loader, +1 selector, readout counter and PDF notice |
| painter | **untouched** |
| script tags | **unchanged — still 15** |
| checks | 3 page tests, 5 / 5 page mutations |

**TIER 2 IS COMPLETE — all five remaining painters land.**

Counted rather than claimed: render-2d has **17 exports and MODEL.html calls
13**. The four it does not call are not gaps in this tier:

| not called | why |
|---|---|
| `drawCutPreview2D` | the cut TOOL's rubber band; this page has no tools (and it holds the one hardcode left, measured at 2.66 against night in tier 2l) |
| `drawStairNotes2D` | the STAIR workspace, a drafting surface rather than a plan |
| `drawBoneyardMark2D` | the boneyard shelf, likewise |
| `strokeSegPath2D` | a helper the other painters call, not a painter |

So every painter that draws the DRAWING is now shared. The three unreached
painters are bound to editing surfaces this page deliberately does not have,
which is a statement about the viewer's scope rather than about the extraction.

The one thing this page still cannot do that the bone can is decode a PDF
underlay, and it says so on screen.
