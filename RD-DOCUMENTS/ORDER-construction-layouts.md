# WORK ORDER — the construction layouts come off the DC framework

**Movie, 20 Sep 2026**, from the live app:

> *"would it be possible to set up the layouts area so they display the
> drawings as it was set up in model.dc"*

and, narrowing it:

> *"i meant the LAYOUT.html — it is actually still has the DC in the name"*
> *"it is CONSTRUCTION LAYOUTS - there will also be a REAL ESTATE LAYOUTS page"*
> *"the dc was set up to bring the drawings already into the construction
> layout area and we had the scales figured out mostly"*

Status: **STAGE 1 IN FLIGHT.** `plan-composition.js` exists and
`LAYOUT.dc.html` draws its plan viewports through it. Stage 2 is untouched.
Progress is logged at the foot of this document, under *Stage 1 as built*.

---

## What is already true, measured before anything was planned

The last sentence of the ask is correct and it is the most important fact in
this document: **the construction layout page works.** It was opened with
`proto/repro-garage-house.draft` in the shared store and it brought the drawing
in by itself — no import step, no second copy of the file.

What it already carries:

    sheets            SHEET 1..5 and + SHEET
    paper             11x17 (LEDGER), 8.5x11 (LETTER), LAND / PORT
    viewport scale    1/16" 3/32" 1/8" 3/16" 1/4" 3/8" 1/2" 3/4" 1" = 1'-0"
    plan level        2ND FL / MAIN FL / FOUNDATION
    titleblock        BLUEJETTY / ROUGH DRAFTER, each with a BAND variant,
                      NORTH ARROW on/off, and a filled block — revision,
                      date, scale, draft by, sheet number
    viewports         + ADD VIEWPORT, placed by pressing the sheet
    history           undo / redo on the status bar
    the link in       MODEL.html's foot row, `data-page="construction"`,
                      already points at it

E1 and E2 placed on sheet 1 at 1/8" = 1'-0", labelled `ELEVATION E1 · 1/8" =
1'-0"` under each viewport, with the titleblock's SCALE field agreeing. **The
scales are not a thing to build. They are a thing to carry.**

So this order is not "make the layouts work". It is two narrower things.

---

## The DC framework: yes, it goes — and what that actually costs

Movie asked directly: *"we will get rid of the dc framework right?"*

That is the established direction and the repo already says so in a test name —
`model-html-tier1.spec.js` asserts **"no framework is present: React and the DC
runtime never load"**, and keeps an EXACT list of MODEL.html's scripts so a
dependency cannot arrive unnoticed. MODEL.html is the finished half of that
migration. What is left:

| page | lines | on DC |
|---|---|---|
| `MODEL.dc.html` | 24,249 | React 18 + `support.js` + `<x-dc>` |
| `LAYOUT.dc.html` | 1,705 | React 18 + `support.js` + `<x-dc>` |
| `Notepad.dc.html` | 120 | React 18 + `support.js` + `<x-dc>` |
| `SaveBox.dc.html` | 60 | React 18 + `support.js` + `<x-dc>` |

Free of it already: `MODEL.html`, `PROJECT.html`, `SETTINGS.html`,
`SPECS.html`, `STANDARDS.html`, `index.html`.

**Two measurements that decide the order of the whole job.**

1. **`MODEL.dc.html` is the page the test suite drives.** `helpers.openModel`
   navigates to `/MODEL.dc.html`, and **228 of the 237 spec files** reference
   that page or call that helper. Retiring it is not rewriting a page; it is
   re-pointing the suite, and that is where the risk lives.

2. **`MODEL.html` cannot replace it yet.** `PARITY-model-html-vs-dc.md` is the
   standing tally and it still lists, as absent on the new page: place a
   dimension, place a stair, draw a line, redo, the T-square, the INSERT
   underlay, the boneyard, 3D, and seven tools besides.

**Therefore `LAYOUT.dc.html` comes off DC FIRST, and on its own.** It is 14
times smaller than the model page, no spec drives it through a shared helper,
and it depends on the model only through the saved file — which is a file, not
a framework. Retiring `support.js` from the tree waits for `MODEL.dc.html`;
retiring it from the LAYOUT page does not.

---

## The second thing: a construction sheet is missing its annotation

`LAYOUT.dc.html:1279` paints a plan viewport through
`window.DraftLayoutPlan.drawPlan` — `layout-plan.js`, 278 lines. Its own header
is honest about what it is: *"the wall painter is the shared DraftRender2D
one"*. Walls, and that is the whole of it.

Cuts are fine and always were: `:1295` calls `DraftCutView.drawCutView`, the
same painter the model uses, which is why the elevations on sheet 1 look right.

Counted across the three pages:

| | `drawFloor2D` calls | fen labels | auto-dims | cut marks | closets | fixtures |
|---|---|---|---|---|---|---|
| `MODEL.dc.html` | 8 | 5 | 3 | 6 | 10 | 6 |
| `MODEL.html` | 8 | **0** | 1 | 2 | 1 | 1 |
| `layout-plan.js` | **0** | **0** | **0** | **0** | **0** | **0** |

So a plan placed on a construction sheet today has no dimension strings, no
window or door tags, no fixtures, no closet swings and no cut marks. **That is
not a sheet that goes to site**, which is exactly what the page's own link
title promises: *"the construction layout: the sheet that goes to site"*.

**And there are already three plan compositions in this app**, which is the
finding that shapes the fix. A fourth, written into the layout page to make the
sheet read right, is the defect this codebase refuses by name everywhere else —
`cut-view.js`'s own comment calls it *"a second, smaller renderer that could
drift"*. The fix is not to write the annotation again. It is to have one
composition and two callers.

---

## The order of work

**Stage 1 goes first even though Stage 2 is the headline**, and the reason is
mechanical: if the page is ported first, the simple painter is ported with it
and the annotation work is then done twice. If the composition is extracted
first, into a module, the port carries it across and only the call site moves.

### Stage 1 — one plan composition, two callers

Extract the model's plan drawing into a module — working name
`plan-composition.js` — that takes a drawing, a level, a view and a transform,
and puts ink on a context. Everything it needs is already extracted and pure:
`render-2d.js`, `auto-dims.js`, `fen-labels.js`, `fixture-geometry.js`,
`closets.js`, `cut-marks.js`. **What is not extracted is the composition** —
the order they are drawn in and the env they are drawn against — and that is
the work.

Acceptance is a round trip, not a screenshot: the same drawing, the same level,
drawn through the module and through the page it came out of, must agree.
`proto/` is where that harness belongs, beside the other engines.

**Open question for Movie, and it needs answering before this starts.**
`MODEL.dc.html` draws a fuller plan than `MODEL.html` does — the table above.
Which one is the construction sheet's drawing? The old page's is more complete;
the new page's is the one that will still exist in six months. My reading is
that the module should be built to `MODEL.dc.html`'s composition, because that
is what a construction sheet needs and the new page will want it too — but it
means the module is ahead of `MODEL.html` on the day it lands, and that is a
thing to say out loud rather than discover.

### Stage 2 — `LAYOUT.dc.html` becomes `LAYOUT.html`

Off React, off `support.js`, off `<x-dc>`, the way the model page went. The
behaviour is not being redesigned: sheets, paper sizes, orientation, the scale
list, plan level, titleblocks, the north arrow, viewport placement, undo and
redo all exist and all work. This is a port.

**What must not break, and each of these is a check rather than an intention:**

- **Saved sheets keep loading.** Whatever layout records exist in the shared
  store were written by the DC page and must open unchanged in the new one.
  This is the single highest risk in Stage 2 and it wants a fixture in
  `proto/` before a line is written.
- **The scales stay exactly as measured.** Movie's words are *"we had the
  scales figured out mostly"*. The architectural scale list and the paper-inch
  per model-foot arithmetic are carried, not re-derived.
- **The titleblock keeps its variants.** Four of them plus the north arrow
  toggle, and `titleblock.js` is already a shared module.
- **The link from MODEL.html.** `data-page="construction"` points at
  `./LAYOUT.dc.html` today and moves with the file.
- **The cut painter stays shared.** No second elevation renderer, ever.

### AUTO-GENERATED SHEETS — AND THE FIRST VERSION OF THIS SECTION WAS WRONG

**Movie, 21 Sep**, looking at an empty sheet with a drawing loaded:

> *"the layouts aren't autogenerating views, i thought you already did that"*

**HE HAD ALREADY HAD IT BUILT, and I told him twice it never was.** This
section first read *"auto-generation was never built"* and explained at length
why the expectation was understandable but mistaken. That was false, and it
went into a merged pull request body as well. The correction, stated plainly
because the claim was stated plainly:

`LAYOUT.dc.html:855`, **`_composeDefaultSet`**, deals the whole set — two
sheets of elevations (E1+E2, then E3+E4), a plan per floor with walls, top
storey first, the foundation, every drawn section, the basement — skipping any
sheet nothing would put ink on, and choosing each sheet's scale by walking the
ladder down until its views fit. `tests/layout-compose.spec.js` had **nine**
specs on it before this change, including the deal order and the empty-sheet
rule.

**WHAT WAS ACTUALLY MISSING WAS A VERB.** The composer had exactly one
trigger, and the spec's own header names it: *"a successful BUILD HOUSE raises
layout.auto, and LAYOUT answers the flag"*. So:

    a fresh bone press            -> the set is dealt
    any other drawing            -> nothing, ever
    a set touched by hand        -> the flag comes off and never goes back on

Movie's own file carries **no `layout` key at all**, so `auto` read false and
the composer never ran. Nothing on the page would run it.

So `DEAL SHEETS` / `RE-DEAL SHEETS` sits under `+ ADD VIEWPORT` and calls the
composer that was already there. **Off a button rather than on load**: dealing
on open would rewrite viewports on a drawing nobody asked to have edited, and
a drafter who has arranged sheets by hand must not lose them to a page visit.
It confirms before replacing a hand-placed set and does not confirm over an
empty one, since a dialog with one sensible answer is friction rather than
safety.

**HOW THE WRONG CLAIM SURVIVED TWO TELLINGS.** I read the order's own Stage 1
log — every line of which says *"a hand-placed viewport..."* — and treated the
absence of a row as the absence of the feature. The log was describing what
STAGE 1 built, not what the page can do; the composer predates it. Reading a
progress log as an inventory is what made an absent row into an absent
feature.

**AND A PANEL BUG MADE IT LOOK BROKEN RATHER THAN MERELY ABSENT.** Measured at
his window size -- a 188px column with about 660px of usable height:

    + ADD VIEWPORT   top 980px
    window                660px
    panel hides           396px, overflow-y: auto

The one button that MAKES something sat 320px below the fold, behind nine
scale buttons and two more sections, in a column that scrolls with nothing on
screen to say so. **An empty sheet plus no visible verb reads exactly like a
page that should have filled itself in.** Fixed by pinning the VIEWPORT block
to the foot of the panel -- sticky rather than hoisted, because the panel's
order is the drafter's order (paper, orientation, sheet, scale, level, then
place it) and moving the verb above the settings it depends on would trade one
confusion for another. Pinned by `tests/layout-viewports.spec.js`, at a height
the bug reproduces at: the project viewport is 900px tall and nothing shows at
900.

**THE THREE QUESTIONS I PUT TO HIM WERE ALSO ALREADY ANSWERED**, in the
composer, with reasons — which is the same mistake as the paragraph above and
worth keeping visible:

- **which views** — elevations paired two to a sheet, a plan per floor with
  walls, the foundation, the drawn sections, the basement. SITE and ROOF are
  out because they have no painter, and the floor-layout and electrical sheets
  because the drawing format has no entities for them. `_composeDefaultSet`
  says so at its own comment: *"They are their own boards, not silent
  omissions."*
- **one view per sheet, or packed** — one, except the elevations, which pair.
  A single view centres on its sheet; a pair stacks and centres as a block.
- **when** — this one genuinely was open, and it is the only thing that
  changed: it was the bone's flag alone, and it is now also a button.

### Not in this order

- **REAL ESTATE LAYOUTS.** Movie has named it and MODEL.html already carries
  the disabled button with its reason — *"a drawing OF the model rather than a
  sheet off it"*. It is a separate page and a separate order. Stage 1's module
  is what it will draw with, which is one more reason Stage 1 goes first.
- **Retiring `support.js` from the tree.** That waits on `MODEL.dc.html`, which
  waits on the parity list.
- **`Notepad.dc.html` and `SaveBox.dc.html`.** 180 lines between them; they can
  follow whenever, and neither blocks anything.

---

## What is not yet known

Stated so nobody reads this order as more settled than it is.

- **The saved-layout record has not been read.** I have seen the page render
  and I have not opened its stored shape. Stage 2 cannot be costed until it is.
- **Whether a `MODEL.html`-authored drawing differs from a `MODEL.dc.html` one
  in any way `layout-plan.js` mishandles.** The store is shared and the
  elevations came through; the plan path has not been driven end to end.
- **How many sheets a real job has.** The page offers five and a `+ SHEET`;
  nobody has said what the working number is, and it decides whether sheet
  navigation is a list or something else.

---

## Stage 1 as built

Logged as it lands, newest last. Movie's own running order for the stages,
21 Sep: *"we still need the beams columns, and then the stairs and then
washrooms those should be completed soon and then we can do the kitchen after
those"*.

| | stage | commit |
|---|---|---|
| ✔ | the module, and LAYOUT's plan viewports drawn through it | `87ca1f3` |
| ✔ | beams and columns | `3100c3c` |
| ✔ | the logo carries its own wordmark | `de64ff2` |
| ✔ | a hand-placed viewport walks the scale ladder down until it fits | `c24efed` |
| ✔ | stairs | `4863369` |
| ✔ | washrooms — which turned out to be fixtures | `9c94a3c` |
| | kitchen — already drawn, being the same fixture record | `66fa5bf` |
| | **STAIR SECTIONS — not on a sheet, see below** | |

### Two things the work changed about this order's own assumptions

**A STAIR IS NOT A STORED SHAPE.** It re-derives its risers from the storey
heights every time it is drawn, so `stairCurrentLayout` takes the level
readings as a second argument and a caller that cannot supply them cannot draw
a stair at all. The sheet reads them off the saved JSON through the same pure
functions MODEL.dc.html's own accessors wrap. Stage 1's acceptance test for
that was arithmetic rather than pixels: the descent re-derived from the file
matches the `riseFt` the model wrote onto each stair record digit for digit.

**"WASHROOMS" WAS NOT A STAGE.** There is no washroom painter to port. The
dealt WC is four walls and a group and nothing else — `proto/README-repro-
washroom-bungalow.md` has the measurement — and those walls already drew. The
gap the item was really naming was **fixtures**, which `layout-plan.js` had
never built an env for, so the sheet was dropping every tub, toilet, basin,
cabinet, island and closet in the drawing without a word. That is also most of
what the KITCHEN item will want, since a kitchen is the same record.

The lesson for the remaining stages is worth stating: **check what the thing IS
before costing the port.** Two of the six items so far were not shaped the way
their names suggested.

---

## STAIR SECTIONS — drawn in the model, and they cannot reach a sheet

**Movie, 21 Sep**, with a screenshot of the STAIR layer view:

> *"also you might already have this done: STAIR sections"*

**Half done. The section exists and it is good** — his screenshot shows
`SECTION — 14R @ 7 13/16" · TREADS FULL 2x12 · RISERS 3/4" PLY FACE @ 11"`,
the raking section with every tread and riser, EDGE OF STAIR OPENING, LANDS ON
THE MAIN FL SUBFLOOR, the plan below it, and the site note about adjusting
risers down only. **It cannot get onto a construction sheet**, for three
reasons, each measured.

### 1. The section is GENERATED, not stored

Nothing in a saved drawing is a stair section. Checked on
`proto/repro-washroom-bungalow.draft`, which carries two stairs:

    walls    plan/L3 8   plan/L5 8   foundation/L1 4
    lines    foundation/L1 8
    stairs   plan/L3 1   plan/L5 1
    notes    (none)

**No entity anywhere is on the `stair` view.** The STAIR set is a locked
generated workspace, exactly like the cut view was before `cut-view.js` was
extracted: MODEL.dc.html derives the whole drawing from the one stair record
every time it paints.

### 2. Its painter is local to MODEL.dc.html — 624 lines of it

    _stairWorkspaceActive     8476   5 lines
    _stairWorkspaceFrame      8522  75
    _drawStairWorkspace2D     8566  31
    _drawStairSectionPane     8597 170
    _drawStairPlanPane        8767 343
                                  ---
                                   624

None of it is a shared module. **This is the same shape of work `cut-view.js`
already went through** and it is the honest cost of the item: an extraction,
not a wiring job like beams, stairs-on-plan or fixtures were.

### 3. Two gates would refuse it even once it were shared

- `_composeDefaultSet` deals elevations, floor plans, the foundation, sections
  and the basement. **There is no STAIR sheet in the set** and no UI to ask
  for one.
- `planSheet(levelId, view)` gates on `planWalls(...).length`, and `drawPlan`
  bails with `if (!walls.length) return false`. **A stair view has no walls**
  — its contents are `A-STR`, `A-FL-OPNG`, `STAIR SECTION`, `A-ANNO-NOTE`
  (`layer-views.js:24`) — so a hand-placed STAIR viewport would draw nothing
  even today. The walls gate is a reasonable rule for a floor plan and a wrong
  one for every generated view.

### What it would take

1. Lift the 624 lines into `stair-section.js` the way `cut-view.js` was lifted,
   reading the model through an env of plain accessors. `stair-geometry.js`
   already owns the arithmetic, so what moves is the drafting.
2. Give a viewport a `kind: 'stair'` beside `plan`, `elevation` and `section`.
3. Replace the walls gate with "would this view put ink on the sheet", which
   the generated views need and the floor plans keep satisfying.
4. Deal a STAIR sheet per stair in `_composeDefaultSet`.

**A stair section is a sheet a framer actually reads on site**, so this is not
a nice-to-have — but it is a bigger item than the five before it, and it is
recorded at its real size rather than folded into the running list.
