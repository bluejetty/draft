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

## The table

| gesture | old page | new page | verdict | note |
|---|---|---|---|---|
| Draw a wall | wall tool | **present** — `drawPress`, chaining, shared corners | must-have | armed by a button, not a tool |
| Draw a line | line tool | absent | must-have | |
| Draw a floor | floor tool | absent | must-have | it paints floors it cannot create |
| Draw an outline | outline tool | absent | must-have | BUILD HOUSE reads outlines |
| Place a roof | roof tool | absent | must-have | paints, cannot place |
| Place a stair | stair tool | absent | must-have | paints, cannot place |
| Place fenestration | fenestration tool | absent | must-have | |
| Place a dimension | dimension tool | absent | must-have | paints, cannot place |
| Beam / column / trim / shape / node / annotation / fixture | seven tools | absent | ? | each needs Movie's read on whether a day's work needs it |
| Cut a section | cut tool | absent | must-have | and no viewer either — see cut-view spec |
| Select a thing | select tool | **present** — `selectedSeg` | must-have | walls only, as far as I read |
| Drag an endpoint | corner drag | **present** — pointer drag, undo captures `move` | must-have | |
| Delete a thing | delete | **present** — button, `Delete`, `Backspace` | must-have | |
| Change a wall's type | wall-type picker on a group | **absent** | must-have | #377 established there is no change-type verb at all |
| Undo | undo stack | **present** — `Ctrl/Cmd+Z`, one press per gesture | must-have | covers add, remove, move |
| **Redo** | redo | **absent** | must-have | the handler excludes `shiftKey`; there is no `redo` in the file |
| **Switch level** | level rail | **present** — `level-pick` in the chrome bar, its `change` handler, `goToLevel` | must-have | keyed by `?level=` in the URL, not by an index |
| Switch layer view within a level | layer view rail | **present** — `view-pick`, filled from `DraftLayerViews.layerViewsForLevelId` | must-have | hides itself on ROOF and SITE, which hold no layer views |
| Add / delete / insert a level | level rail | **absent** | must-have | re-derived in this page's own vocabulary: no add/insert/remove verb, and no `levels` mutation. It re-emits the levels it loaded |
| Level locks | lock toggles | **absent** | ? | re-derived the same way: no lock verb in the chrome bar, no URL parameter, no mutation. The persisted key is re-emitted, not honoured |
| ASSEMBLY / group / ungroup | assembly rail | absent | ? | my #375 spec drives it on the old page; nothing here |
| Stacked washrooms, source links | boneyard/assembly work | absent | ? | |
| Elevation / section previews | right-hand cards | absent | must-have | `SPEC-model-html-cut-views.md` — 18 accessors, 6 absent |
| INSERT PHOTO+PDF underlay | INSERT | **partial** — paints underlays, filters by level | ? | it draws them; I did not find an insert gesture |
| T-square | down by default, `t` stows | **absent** | ? | zero references; `DEFINITIONS.md` says down-by-default |
| Boneyard | shelves, unplaced geometry | **absent, deliberately** | ? | the page says so: "No boneyard on this page: it holds no unplaced geometry and offers no way to switch to it" |
| Pan / zoom / fit | mouse, `0` | **present** | must-have | |
| Escape cancels and clears selection | one press, tool survives | **present** | must-have | measured from the old page and documented in the new one |
| Save | press | **present** — press, plus the rung-4 hide-save | must-have | |

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
