# PAPER RULES

The settled paper and sheet rules for the printed set. Three places cited this
file before it existed (`MODEL.dc.html:1750`, `MODEL.dc.html:22070`,
`tests/rail-order.spec.js:6` — deep-clean item 4); this writes down what they
were citing. The rules were settled with Movie one at a time on the boards
(#168, NEW-2); this file gathers them so nobody has to re-derive them from
test comments.

Where a rule is enforced, the enforcement is named. A rule with no named
enforcement is office convention: real, but only prose guards it so far.

## Paper

- **11×17 landscape (Ledger) is the standard construction sheet.** Everything
  in the permit set prints on it.
- **8.5×11 (Letter)** serves the real-estate plan, drafter preference, and the
  SPECIFICATIONS document.
- **No larger ARCH formats are offered.** No 18×24, no 24×36. The product's
  houses fit 11×17 at real drafting scales, and a second paper family would
  double every layout decision for nothing.

`PAPER_SIZES` in `LAYOUT.dc.html` is the whole list, deliberately.

## Scale

Every scale on a sheet is a real drafting scale — a value from the `SCALES`
list a drafter could set on a physical scale ruler. Nothing ever prints at a
computed best-fit ratio.

**The automatic ladder steps down only, never up.** The composer starts at the
normal working plan scale and walks down until the view fits:

    3/16" = 1'-0"  →  1/8"  →  3/32"

- 3/32" is the automatic floor. A view too big for even that rung still
  prints, clipped — too big is self-evident on the sheet; silently dealing a
  scale too small to read is not.
- **1/16" is never dealt automatically.** It left the auto ladder in
  `274c78f`; it stays on the manual `SCALES` list for a drafter who wants it.
- **Stepping UP to a larger scale is never automatic.** A blow-up (a stair
  detail, the same plan at two scales) is a deliberate drafting choice.
- Site plans walk their own engineer's ladder (1"=10' → 20' → 30' → 40'),
  because 1/8" on a site plan is nonsense.

The chooser is `_autoScaleFor` in `LAYOUT.dc.html`; the ladders are
`AUTO_SCALE_PREFS` and `SITE_SCALE_PREFS`. One alignment is still owed: the
board ruling starts the ladder at 3/16", and `AUTO_SCALE_PREFS` still tries
1/4" first — that change is its own PR, since it touches every auto-composed
sheet.

## Viewports and numbering

- A sheet holds **multiple viewports, each with its own scale**. The sheet's
  titleblock prints the scale only when every viewport agrees; otherwise AS
  NOTED, and each viewport's label carries its own.
- **Drawing numbers restart at 1 on every sheet.** Drawing 3 of sheet 2 is
  "3/2", never "7". Office convention — no painter numbers drawings yet.
- **Sheet numbers are plain integers.** 1, 2, 3. No A-101, no discipline
  prefixes, no decimal insertions. Sheet 1 is the first dealt.

## The default set

A successful BUILD HOUSE raises `layout.auto`, and LAYOUT answers the flag by
dealing the default hand: every plan with walls, every drawn section, the four
standard elevations — each at the largest ladder scale that fits, and **never
a blank sheet** (a bungalow has no 2ND FL sheet; a drawing with no concrete
has no FOUNDATION sheet).

Movie's set order (settled 31 Aug 2026, board NEW-2 part 2), which is also
the order the MODEL rail lists views in — a drafter who knows the set never
learns a second order for the screen (`tests/rail-order.spec.js`):

     1  Elevations E1 + E2      (one sheet)
     2  Elevations E3 + E4      (the next)
     3  Site plan
     4  Roof plan
     5  2nd floor plan (walls), repeated for 3rd and up, top storey first
     6  2nd floor layout
     7  Main floor plan (walls)
     8  Main floor layout
     9  Foundation
    10  Basement plan
    11  Sections, one sheet per cut
    12  Electric plan (very small scale)

Basement and electric ARE dealt automatically where they have content — they
reuse the level-plan machinery, deleting an unwanted sheet is one click and
creating a missing one is many. Generous where the extra is harmless.

SITE, ROOF, the floor-layout sheets and ELECTRIC are absent from today's
composer on purpose — no painter yet, and for S-SLAB / S-FDN / E-POWER no
entities in the format to paint. They are their own boards, not silent
omissions (`_composeDefaultSet` says the same in place). One more delta owed:
the composer currently deals the basement AFTER the sections; the settled
order puts it before them (10 then 11).

**Elevations keep their own pages: E1+E2 on one, E3+E4 on the next.**
Squeezing all four onto one page is a manual move. Pinned at
`tests/defaults.spec.js` (the grouping) — note the composition contract lives
across TWO spec files; see below.

## Whose sheets they are

The composition is a dealt hand, not a cage:

1. **BUILD HOUSE raises `layout.auto`** — the sheets are the composer's.
2. **Any manual touch takes them over.** Moving, rescaling, adding or deleting
   a viewport clears the flag; from then on the sheets are the drafter's.
3. **A drawing arranged by hand loads exactly as saved.** The composer never
   re-deals a hand-arranged drawing on open.

Pinned across two files, on purpose named here because either alone reads as
three quarters of the contract: `tests/layout-compose.spec.js` (raise, clear,
load-as-saved) and `tests/defaults.spec.js` (the E1+E2 / E3+E4 grouping).

## Specifications

SPECIFICATIONS are a **flowing 8.5×11 document, not a viewport type**. They
paginate like text, print from their own page, and never occupy a seat on a
construction sheet. The written half of the drawing set lives in
`SPECIFICATIONS/` and the SPECS page; the drawn half lives here.
