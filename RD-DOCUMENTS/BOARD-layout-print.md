# PRINT on LAYOUT: the package

Movie, 9 Oct: *"we should do the PRINT function for LAYOUT for PDF and actual
printing too"*, and on order: PRINT before the DXF export. Then: *"allow the
user to select which layouts to print in their 'package'"* and *"300 DPi
good"*.

## What it does

- **The bone opens PRINT** (it said *PRINTING A SHEET IS NOT WIRED YET*).
  The dialog lists every sheet in the set by number and title, all ticked,
  with ALL and NONE. PRINT counts the ticked sheets and is off when there
  are none. A second opening keeps the last pick.
- **PRINT draws each ticked sheet as it prints**, `_paintSheet` in print
  mode. It drops what belongs to the desk: the desk, the shadow, the
  paper-size label, the dashed margin guide, the TITLE BLOCK placeholder
  word, and every viewport's frame and grips. It keeps the border, the
  titleblock and the drawings, with each drawing's caption (title and scale)
  in ink.
- **300 dpi, drawn at 72.** The painters size lines and lettering in pixels,
  for the desk. A sheet is drawn at 72 pixels to the paper inch and the
  canvas is scaled to 300, so 9px lettering prints 1/8" tall and a 1px line
  is a fine pen, only sharper. Drawn straight at 300, the lettering would
  print a quarter size. An 11 x 17 sheet is 5100 x 3300.
- **One document, a sheet to a page**, at the paper's own size with no
  margin (`@page`), handed to the browser's print window. That window is
  both the printer and the PDF: "Save as PDF" is one of its destinations, as
  it is for MODEL's PRINTSCREEN.
- `PRINT_PX_PER_IN` (72) is the size a sheet is *meant* to be read at. The
  DXF export uses it too, so the text in a DXF is the size it prints.

## Checked

`tests/layout-print.spec.js` takes the package through
`window.__draftPrintCapture` instead of a printer, because no script can
drive the browser's print window. The checks:

- every sheet is ticked by default, and unticking one leaves it out
- pages come in sheet order at 5100 x 3300 under `@page{size:17in 11in;margin:0}`
- the paper is white to the edge, with no desk
- drawn sheets carry their drawings
- the print page is cleared away afterwards
- NONE disables PRINT and ALL puts every sheet back
