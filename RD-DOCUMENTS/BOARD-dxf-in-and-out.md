# DXF in and out

Movie, 9 Oct: *"after we get caught up, can you check to see if we can save
our files as DXF"*, then *"how about the ability to view DXF"*, *"can we try
to allow editing of the lines too"* and *"do viewing first"*.

## The order

1. **View** (#655). TRACE takes a `.DXF` as its third kind beside a PDF
   page and a photo.
2. **Edit** (#656). Movie: *"when they load it ask them if they want
   EDITABLE or NON-EDITABLE"* -- *"they will need to reload if they change
   their mind"* -- no BREAK later.
3. **Save as DXF** (this PR), after PRINT (#657). The `.draft` stays the
   master: a DXF holds lines, not walls.

## 1. Viewing

- `dxf-reader.js` reads an ASCII DXF, with no library and no service:
  LINE, LWPOLYLINE and POLYLINE with bulges, ARC, CIRCLE, ELLIPSE, SPLINE,
  SOLID, 3DFACE, LEADER, TEXT, MTEXT and ATTRIBs. Blocks are opened up:
  scaled, turned, mirrored, nested and arrayed INSERTs, and the picture a
  DIMENSION saved. Layer 0 and BYBLOCK inside a block follow the INSERT, the
  CAD rule.
- **Left out, and counted:** HATCH and WIPEOUT fills, points, images, 3D
  meshes, paper space. A binary DXF and a DWG are refused by name, with what
  to do instead (save an ASCII DXF).
- **Checked against ezdxf when written.** Movie's `1._Story.DXF`,
  `KITCHENITEMS1/2.DXF` and `WC_PLAN_2.DXF` gave the same extents to the
  hundredth of an inch. So did a stress file of bulges, mirrored arcs and
  scaled, turned, nested and arrayed blocks, layer by layer.
- **TRACE card:** no SCALE, no WIDTH, no CALIBRATE, because a DXF is full
  size. It asks only which unit the numbers are in, with the file's own
  `$INSUNITS` picked. A file that does not say is assumed inches, and the
  card says so next to the size it comes to.
- **On the plan:** drawn by `render-2d.js` as lines at any zoom, never as a
  picture. It uses the file's colours, with colour 7 ("white on black, black
  on white") in the page's ink. There is one stroke per colour, and anything
  off the screen or too small to see is skipped.
- **Layers:** each layer that draws something gets a chip under the file's
  row on the TRACE card. A press switches the layer off or on, one UNDO each.
  Layers the file itself has off come in off.
- **Stored:** the file goes in the `underlays` bucket like any other.
  `drawing-format.js` keeps `kind: 'dxf'`, `dxfUnits` and `hiddenLayers`.

## 2. Editable

- **The card asks once.** NON-EDITABLE lays it locked, as in 1. EDITABLE
  brings it in as the drafter's own LINEs. The layer chips on the card pick
  what comes in either way; the locked one keeps the rest switched off.
- **Placed where NON-EDITABLE would lay it:** centred where the drafter is
  looking, full size, file up, on the level the card names.
- **Curves stay curves.** The reader hands back `segments` on request:
  straight pieces, and arcs (ARC, CIRCLE, bulged polylines) cut at 45
  degrees with each piece's true midpoint. `piecesToLines` turns them into
  LINE records whose `bulge` puts the plan's quadratic through that
  midpoint, which matches an arc of 45 degrees to well under 1/32". A circle
  is eight lines. Ellipses and splines come as short straight runs.
- **One ASSEMBLY named for the file**, so the whole drawing moves as one.
  UNGROUP to work on single lines. One UNDO takes everything out.
- **Layers kept.** A line with `importedFrom` keeps the layer the file gave
  it through a save (`drawing-format.js`), ready for the DXF export. Every
  other line still falls to `draft` on an unknown layer. Switching those
  layers on and off on the plan is not here yet.
- **Big files ask first:** over 5,000 lines, the card says how many and
  waits for a second press.
- **Text is not brought in** (Movie agreed, 9 Oct): MODEL cannot select,
  edit or group a note yet, so the words would be left behind when the
  group moved. Instead, **TEXT IN THE FILE** on the card lists every
  distinct piece of text with a COPY each and COPY ALL (Movie: *"can i
  'copy' the text from the DXF and past it in my format?"*). The same list
  is on a locked DXF's row on the TRACE card. Editable notes are a PR of
  their own.
- **Found on the way:** MODEL drew every LINE straight from end to end, so a
  curved line drew as its chord. Lines with a `bulge` are drawn through
  render-2d's `strokeSegPath2D` now, and the selection halo follows the
  curve. Separately, an UNDO of a press that added lines left them selected.
  It now clears what it took away.

## 3. Saving as DXF

Movie, 9 Oct: *"exactly for engineers to have autocad version to manipulate
as they need too"*, *"put all as individual autocad files with each
layout"*, *"all the layers that show on the specific layer should show"*
and *"leave out the TB"*.

- **SAVE DXF (AUTOCAD)** on LAYOUT's panel saves one ZIP named for the
  project. It holds one DXF per sheet that has a drawing on it, numbered and
  named for the sheet (`05 MAIN FL PLAN.dxf`).
- **The sheet itself, recorded.** `dxf-writer.js`'s recorder stands in for
  the canvas, and `_drawViewport` draws each viewport onto it exactly as it
  prints, at PRINT's 72 to the paper inch, so text is the size it prints.
  What is stroked and lettered is kept:
  - circular arcs as ARC and CIRCLE
  - the rest as LINE and POLYLINE
  - text as TEXT, at its capital height and turn
  - dashed lines as DASHED
  - small dark marks (arrowheads, dots) as SOLID or CIRCLE
  - each viewport clipped to its window

  Fills are left out (poché, tints, knock-outs), and so are pictures.
- **Full size.** An inch in the file is an inch of house. A plan keeps the
  drawing's own coordinates (x east, y north), so every plan sheet of one
  drawing lines up over the others in AutoCAD. Sections, elevations and a
  second plan on one sheet stand beside it, 10'-0" apart. Each drawing's
  title and scale sit under it, on A-ANNO-TITL. There is no titleblock and
  no border.
- **CAD layers.** `plan-composition.js` names the layer each piece is drawn
  on, through `ctx.dxfLayer`, which a real canvas never has:
  - walls go on A-WALL-EXT, or A-WALL-INT for a 2x4 or thinner, with their
    hatch on A-WALL-PATT
  - doors on A-DOOR and windows on A-GLAZ, with their size tags on
    A-DIMS-WIN and A-DIMS-DOOR
  - fixtures, floors, roofs, stairs, dimensions, notes, room tags, beams and
    columns go on the layers their records carry
  - lines brought in from a DXF go on the DXF's own layers
  - the existing house goes on A-EXST
  - sections and elevations go on A-SECT and A-ELEV, which is one layer per
    drawing for now

  Each layer takes the usual AutoCAD colour for its family: walls white,
  doors green, glazing cyan, fixtures magenta, dimensions red, notes yellow.
- **AutoCAD R12 ASCII**, in architectural units (`$LUNITS` 4). It is the
  plainest dialect: every AutoCAD opens it, and SAVE AS DWG works from
  there. The files were opened in ezdxf with no audit errors, and the plan
  of a 36' house is 36'-0" across at its own coordinates.

## Found on the way

UNDO of a tracing image's MOVE, and of any hologram edit, put back `x` and
`z` and deleted the rest of the record (its id, level, kind). The page's
`'props'` UNDO restores a record to exactly the copy it was handed, and these
handed it a partial one. They now keep a whole copy. The TRACE spec now
checks the whole record comes back.
