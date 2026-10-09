# DXF in and out

Movie, 9 Oct: *"after we get caught up, can you check to see if we can save
our files as DXF"*, then *"how about the ability to view DXF"*, *"can we try
to allow editing of the lines too"* and *"do viewing first"*.

## The order

1. **View** (this PR). TRACE takes a `.DXF` as its third kind beside a PDF
   page and a photo.
2. **Edit.** The DXF's lines become the drawing's own LINE items (select,
   delete, drag an end, UNDO), grouped as one ASSEMBLY to place it and
   UNGROUP to work on it, on the DXF's own layer names.
3. **Save as DXF.** Every line the plan paints, written out full size in
   inches on the drawing's AIA layer names. The `.draft` stays the master:
   a DXF holds lines, not walls.

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

## Found on the way

UNDO of a tracing image's MOVE, and of any hologram edit, put back `x` and
`z` and deleted the rest of the record (its id, level, kind). The page's
`'props'` UNDO restores a record to exactly the copy it was handed, and these
handed it a partial one. They now keep a whole copy. The TRACE spec now
checks the whole record comes back.
