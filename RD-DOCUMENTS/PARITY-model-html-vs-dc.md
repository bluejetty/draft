# PARITY — what `MODEL.dc.html` can do that `MODEL.html` cannot

**Written by Skipper, 12 Sep**, against `main` at `5493b29`. **Read-only**: no
product file was opened for writing to produce this.

---

## The first thing, because it changes the shape of the job

The order asked me to check whether `MODEL.html` has any drawing tools at all,
and to say **zero** if the answer is zero.

**The answer is not zero, and the comment that says it is has gone stale.**

`MODEL.html` carries `// this page has no draw tool` (in the wall-colour env
comment, near the `drawWallSeg2D` split). It also carries `drawPress`, armed by
a `draw-wall` button, which commits a wall on the second tap and then **chains**
— "the old page's habit: the next wall starts where this one ended, so a room is
four taps and not eight." The corner is shared by object identity, and the
gesture refuses a zero-length wall because the format would drop it on load.

So the honest statement is two-part, and both halves matter:

- **Zero of the nineteen `activeTool` identities can be entered.** There is no
  tool state machine on this page. Its three `activeTool` mentions are a painter
  interface answered honestly with `null`, plus a comment *describing the old
  page's* Escape behaviour.
- **One drawing gesture exists anyway** — wall, armed by a button rather than
  selected from a palette.

This is not a missing drafting surface. It is a drafting surface with **one**
tool on it, reached by a different gesture than the old page uses, and a comment
that stopped being true when someone added it.

---

## What I walked

Tools; editing an existing thing; undo/redo; levels; assemblies; the rail and
right-hand cards (cited from `SPEC-model-html-cut-views.md` rather than
re-derived); underlays; keyboard; boneyard.

**What I did not walk**, said plainly: I did not drive either page in a browser
for this document. Every row below is read from source on `5493b29` or cited
from a spec that did measure. Rows marked `?` say what would settle them.

---

## DRIVEN, 12 Sep — `tests/model-html-gestures.spec.js`

**Gilligan, against `main` at `71f031c`.** The verdict column below is now
measured by opening `MODEL.html` in a browser and attempting the gesture. 11
tests, all green; no product file was touched.

**The rule every verdict is held to: a gesture counts as `present` only if its
effect survives a reload.** Placed, saved, reopened, still there. Where a
gesture has no persisted consequence — Escape, fit, T-square — the visible state
is asserted instead and the row says so.

**Reading and driving disagreed on two rows**, and that list is the product of
this pass:

| row | read | driven |
|---|---|---|
| Select a thing | `present` — "walls only, as far as I read" | **`partial`** — a wall answers a click; a floor and a dimension do not, measured by clicking each and pressing Delete |
| Switch layer view | `present` — "hides itself on ROOF and SITE" | `present`, **and the hiding is real** — but the hidden picker keeps the previous level's options, and it refills correctly when it returns |

Nothing else moved. **Every other `present` row survived being driven**, which
is worth as much as the two that did not: the source reads were right nine times
out of eleven.

**THE MUTATION.** `drawPress` made a no-op: **DRAW A WALL fails on the reload
assertion** (the wall is not in the file) and UNDO fails with it, while **all
eight absence rows stay green**. Both halves matter — the spec can tell a
working gesture from a missing one, and the absences are not passing because the
page is broken.

**Two measurements retracted before they were reported**, both caught by a
control rather than by review:

1. *Nothing selects, walls included.* The one-item fixtures were parked on
   `levels[0]`, which is not the level the page shows, so every click landed on
   empty canvas. Fixed by putting the fixture where the house is and asserting
   the readout paints it `1/1` before clicking.
2. *The layer-view picker never comes back once hidden.* The "return" leg picked
   an arbitrary other level, which also had no layer views. Returning to the
   level the page started on — proved to have a picker first — shows it comes
   back correctly.

**Still not driven, and named rather than glossed:** the both-pages comparison
for stacked washrooms / source links. The keys are shown to round-trip untouched
through `MODEL.html`; the old page was not run on the same fixture.

### Re-run against `30de120`, after the cut-view rail landed

This pass was written against `71f031c`. **#386 landed under it while it was
open, and two of its eleven checks went red on the merge — both correctly.**

- **The control enumeration named six buttons it had never seen** — `E1 · FRONT`,
  `E2 · LEFT`, `E3 · BACK`, `E4 · RIGHT`, `S1`, `S2`. That is the check doing
  precisely the job it was written for: a control that no parity row mentions
  means a row is wrong. Two rows added above.
- **The layer-view picker stopped hiding on ROOF and SITE** — not because the
  hiding broke, but because those levels stopped being empty. The seats put the
  four elevations on every level. The check now guards the two properties that
  do not depend on which levels happen to be bare: a visible picker is never
  empty, and it never shows a view belonging to the level before it.

**Nothing was found wrong with the clicks**, which is what everyone including me
expected to break: the rail sits top-right and this spec's gestures land within
80 px of the canvas centre. That is luck of geometry rather than design, and it
is worth knowing that a click landing on chrome fails in exactly the voice of a
gesture that does not work.

### Re-run after the chrome shell, #389

**It happened a second time, on the same check and for the same reason.** The
shell put six more controls on the page — `left-tab`, `right-tab`, `BUNGALOW`,
`BILEVEL`, `DETACHED GARAGE`, `bone` — and the enumeration went red on CI
naming every one of them. **Four rows above were wrong**, two of them because
they describe the control surface by *listing* it, which is a note that goes
stale the moment a button is added anywhere on the page.

The row worth arguing about is **Draw an outline**. A reader who saw BUNGALOW
on the page would reasonably conclude BUILD HOUSE had arrived, and it has not:
the old page's `_pressBuildType` records a type *and* arms the outline tool,
and only the first half came across, because this page has no outline tool to
arm. That is a claim a test has to hold rather than a note, so
`model-html-topbar.spec.js` asserts the wall count does not move across a
family press, an entry press or BONE.

**The luck of geometry ran out and was replaced by a measurement.** The clicks
still land, but not by accident now: the rail is inside a sidebar that starts
shut, and the chrome-on-chrome check asserts every pair of chrome boxes is
disjoint in both panel states. Four collisions were caught that way, each of
which had first surfaced somewhere else entirely — as a 180-second timeout, or
as a tap guard naming `level-pick`.

---

## The table

| gesture | old page | new page | verdict | note |
|---|---|---|---|---|
| Draw a wall | wall tool | **present** — survives a reload | must-have | **driven**; the mutation row: `drawPress` no-op makes this fail |
| Draw a line | line tool | absent | must-have | |
| Draw a floor | floor tool | absent | must-have | it paints floors it cannot create |
| Draw an outline | outline tool | absent | must-have | BUILD HOUSE reads outlines. **#389 put the house-type buttons and BONE on the page and this row did not move**: the old page's `_pressBuildType` also arms the outline tool, and that half was deliberately left behind — there is no outline tool to arm. The bar records a choice; `model-html-topbar.spec.js` holds the wall count across every press |
| Place a roof | roof tool | absent | must-have | paints, cannot place |
| Place a stair | stair tool | absent | must-have | paints, cannot place |
| Place fenestration | fenestration tool | absent | must-have | |
| Place a dimension | dimension tool | absent | must-have | paints, cannot place |
| Beam / column / trim / shape / node / annotation / fixture | seven tools | **absent — unreachable, measured** | ? **Movie's call, not mine** | **driven**: the page's entire DRAWING surface is `draw-wall`, `delete-wall`, `save`, `take-over`, `level-pick`, `view-pick` and zero inputs. #389 added chrome around it — two sidebar tabs, three house-type families and BONE — and none of those is a tool: the tabs open panels, and the build bar is on the far side of a seam that draws nothing. The left panel is the slot those seven will land in. Whether their absence blocks a day's work is still not a measurement |
| Cut a section | cut tool | absent | must-have | and no viewer either — see cut-view spec |
| Select a thing | select tool | **partial** — a wall answers a click, a floor and a dimension do not | must-have | **driven**: click each, press Delete; only the wall goes. Read as `present` |
| Drag an endpoint | corner drag | **present** — pointer drag, undo captures `move` | must-have | |
| Delete a thing | delete | **present** — button, `Delete`, `Backspace` | must-have | |
| Change a wall's type | wall-type picker on a group | **absent** | must-have | #377 established there is no change-type verb at all |
| Undo | undo stack | **present** — one press per gesture, **counted** | must-have | **driven**: three walls drawn, one press takes back one, three take back all three |
| **Redo** | redo | **absent** | must-have | the handler excludes `shiftKey`; there is no `redo` in the file |
| **Switch level** | level rail | **present** — and the choice survives a reload | must-have | **driven** through `level-pick`; keyed by `?level=`, not by an index |
| Switch layer view within a level | layer view rail | **present**, and the picker belongs to the level it is on | must-have | **driven** on every level. The old note said it hides on ROOF and SITE; **#386 ended that** — the four elevations are on every level now, so no level is empty and the picker always shows. Guarded instead: a visible picker is never empty, and never shows a view carried over from the level before |
| Add / delete / insert a level | level rail | **present** — `+ ADD` and a delete on each card in the LEVELS / LAYERS panel | must-have | **driven**: ADD carries the old page's `_addLevel` (name, an elevation suggested from the assembly BELOW plus its floor sandwich, BONEYARD masters copied on, spliced above the top floor); delete carries `_deleteLevel` — confirms, refuses on the last level, and cascades through the same seventeen level-owned collections. INSERT (the half-level slot rows) is still absent and is out of that order's scope |
| Level locks | lock toggles | **absent — no verb; the key is carried untouched** | **settled** | **driven**: no control on the page is a lock — not the four drawing buttons, not the seat, tab and build-bar chrome #389 added, not the LEVELS / LAYERS panel, and not the tool column's own ASSEMBLY, which makes a group and never a lock; a seeded lock and its `nextLevelLockId` come back byte-identical after a save |
| ASSEMBLY / group / ungroup | assembly rail | **present** — ASSEMBLY and UNGROUP in the left tool column, with the FIXED / NOT FIXED dialog | must-have | **driven**: a selection becomes a named assembly recorded by TYPE AND ID (`_createGroup :17940`) and read back out of the saved file, not off the panel — a grouping held by object reference looks right on screen and is gone after a load. FIXED gives `stretchBehavior: 'rigid'`, NOT FIXED `'item-geometry'`. An item belongs to one assembly: taking it into a new one removes it from its old, and an emptied assembly is dropped. Clicking one member takes the whole assembly, on a click and in a window. UNGROUP releases without deleting — asserted both ways. **One inherited oddity, ported deliberately**: Escape in the name field CREATES a NOT FIXED assembly rather than cancelling (`onGroupNameKey :23685-23687`). Ruled to keep by Devin, 13 Sep |
| Stacked washrooms, source links | boneyard/assembly work | **absent on this page; keys carried untouched** | **partly settled** | **driven** one-sided only: the keys round-trip through `MODEL.html`. The old page was NOT run on the same fixture — that comparison is still owed |
| Elevation / section previews | right-hand cards | absent | must-have | `SPEC-model-html-cut-views.md` — 18 accessors, 6 absent |
| INSERT PHOTO+PDF underlay | INSERT | **partial — paints, cannot insert** | **settled** | **driven**: a seeded underlay is carried and painted; the page has **no `input` element of any type**, so there is nowhere to choose a file |
| T-square | down by default, `t` stows | **absent** | **settled** | **driven**: `t` and `T` pressed; neither the readout nor the file changes by one byte |
| Boneyard | shelves, unplaced geometry | **absent, deliberately** | **settled** | **driven**: the old page reaches it through a negative pseudo-level id; the level picker offers no negative option and every option is a real level |
| Pan / zoom / fit | mouse, `0` | **present** | must-have | |
| Escape cancels and clears selection | one press, tool survives | **present** | must-have | measured from the old page and documented in the new one |
| Save | press | **present** — press, plus the rung-4 hide-save | must-have | |
| Cut-view seats and plan seats | right-hand cards, twelve on the bungalow | **present** — the seating chart is DERIVED from `drawing.levels`, not listed | must-have | fourteen seats on `perf-bungalow` — twelve filled and two empty section chairs — in the old page's own order and pairing, `FOUNDATION \| BASEMENT (WALLS)` included. **Driven**: add a level in the panel and two named seats appear without a reload; delete it and they leave. Plan seats go through this page's own painters, so a thumbnail cannot drift from the plan it shows |
| LEVELS / LAYERS panel | right-edge panel, `:1850-1955` | **present** — a third pane in the right-edge tab group | must-have | a card per level with its layer rows from `layerViewsForLevelId`, the active one lit, and the DATUM read off `elevationDatum`. It is the RAIL'S EDITOR: the rows are the same objects as the seats |
| SECTIONS list | cuts, with `Press [C] to cut a view` | **partial — listed and deletable, not cuttable** | **settled** | the hint is **deliberately not carried**: there is no `[C]` handler and no cut tool on this page, so the empty state says sections are cut in LAYOUT. Driven: `c` is pressed and neither the page nor the file changes |
| BONEYARD shelves | shelves, `+ SHELF` | **listed, not editable** | **settled** | consistent with the boneyard row above — the level picker offers no way to reach one, so a `+ SHELF` would write a shelf this page can never open |
| 3D VIEW | `⬡ 3D` button | **absent — a chair, not a button** | ? **Movie's call** | Movie: "we are leaving 3D to last once everything else is perfect". There is no WebGL, three.js or perspective camera in `MODEL.html` at all, so the row is disabled rather than wired to nothing |
| Chrome over the drawing area | `#save` / `#chrome` / `#readout` overlay as **strips**, plus pull-out tabs on both edges | **present, and now measured** — #389 moved the rail into a collapsible right sidebar and added a left one, both shut by default | ? **Movie's call** | the block in the corner is gone, so the difference this row recorded no longer holds. It IS a measurement now. Re-measured when the chart grew to fourteen seats: collapsed is capped at two rows and scrolls, at **4.3%** of the drawing — better than the 5.4% the shell shipped at, with more than twice the seats. Uncapped it was 13.2%, worse than the full-height version #389 rejected. What is still a look-at-it decision is whether that is too much |

---

## The three that are real work

1. **The cut views**, already specified and costed as far as honesty allows.
2. **The tool palette itself.** Eighteen of the nineteen tools are absent, and
   the one that exists arrives by a different gesture. Whatever is built next,
   the question "button or palette?" is answered once and then eighteen times.
3. **Adding and deleting levels.** A drafter can move between the levels a
   drawing has; they cannot make one. Re-derived in this page's vocabulary
   rather than by searching for the old page's.

## The row nobody has mentioned

**I offered one and it was wrong** — see the correction below. The honest
position is that this pass did not find a new must-have the conversation had
missed. It found that one of the ones we thought was missing is already built.

The nearest thing to a new row is a small one: **the page can switch layer views
within a level** (`view-pick`), which nobody had mentioned either, and which
matters mainly because the cut-view host should reuse that mechanism rather than
invent its own.

---

## Correction — the level-switching row was wrong in the merged version

The version of this document merged as #381 said level switching was **absent**,
ranked it the top piece of real work, and offered it as the row nobody had
mentioned. **All three were wrong.** `MODEL.html` has had a level picker the
whole time: `level-pick` in the chrome bar, a `change` handler, and `goToLevel`,
which sets `?level=`, drops a `?view=` the new level does not have, re-syncs the
URL, rebuilds the chrome and repaints.

**The search error, which is the reusable part: I grepped this page for
`activeLevelIdx` — the OTHER page's name.** It is `MODEL.dc.html`'s state, an
*index* into the level list. The new page keys levels by **id** through the URL
deliberately, and the comment above its switcher explains why: an index agrees
with the id on a default drawing and disagrees the moment a level is inserted,
so a switcher carrying an index would pass every test and paint the wrong floor
on a real house. All three of my hits were comments *about the old page*, in a
file that deliberately has no such variable.

**When a grep for a name comes back empty, the next question is whether the name
belongs to this page.** Twice this week it did not.

The two neighbouring rows were re-derived from this page's own vocabulary rather
than left standing on the same evidence, and both survive as absent — but now
for reasons read off the chrome bar, the URL parameters and the serializer,
instead of off a missing identifier.

**The same faulty justification appears in `SPEC-model-html-cut-views.md`**,
which says of the viewing side "grep those names in `MODEL.html` and you get
nothing" — `activeView` and `activeCutId` being, again, the old page's names.
**That spec's conclusion survives**: `?view=` selects *layer* views from
`DraftLayerViews.layerViewsForLevelId`, and cut views are not among them. But
the reasoning was the same kind, and the spec deserves a one-line fix in a later
pass — noted here rather than edited, because this pass's writes are scoped to
this file.

## Defects found, not fixed

Per the order, these are named and left alone.

1. **A stale comment claiming the page has no draw tool.** It does have one. The
   comment is the fifth stale-claim incident this week and the second inside a
   comment rather than a line number. Whoever adds the next tool should delete
   the sentence rather than qualify it.
2. **`redo` is absent, and the undo handler's `!e.shiftKey` makes that
   deliberate-looking.** I did not establish whether that is a decision or an
   omission; the comment above it does not say. Worth a sentence from whoever
   wrote it.

---

## Not checked, and what would settle each

- **Anything driven in a browser.** Rows marked present are read from source. A
  spec that opens `MODEL.html` and attempts each gesture would settle every row
  in the table, and is the natural next pass.
- **Whether select reaches anything but walls.** `selectedSeg` is the only
  selection state I found.
- **Underlay insertion.** The page paints and filters underlays; I did not find
  a gesture that adds one, and did not prove there is none.
- **Which of the seven small tools a day's work needs.** That is Movie's call,
  not a measurement — I have marked them `?` rather than guessing, because a
  guessed verdict is the thing this week has been about.

**No estimates appear in this document, per the order.**
