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
| | kitchen | |

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
