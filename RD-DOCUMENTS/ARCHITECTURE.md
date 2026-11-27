# Draft — Architecture

How the app is put together and where data flows. Written for a session
about to add a feature, which needs to know which file owns what before
touching anything.

Brought up to date on **27 Nov 2026** (main at the merge of #1149). The
previous version described `MODEL.dc.html` as the drafting workspace; that
stopped being true in October. If something here disagrees with the code,
the code wins, and this file should be fixed in the same PR.

## The short version

- The app is **Rough Drafter**: a house-drafting program that runs entirely
  in the browser. No server, no build step, no install. What is in the repo
  is what runs, served as static files.
- It wears two skins: **RUFF DRAFTER** (dark, cartoon) and **ROUGH DRAFTER**
  (paper). Same program, same files; `palette.js` and the skin code in
  `model/01-skin-view.js` pick the look.
- **The editor is `MODEL.html`** plus its 22 parts in `model/`. It reads and
  writes one drawing (a `.draft` file, JSON) through `drawing-format.js`.
- Every other screen (LAYOUT sheets, PROJECT, EXT. FINISH, BONEYARD, the 3D
  viewer, LANDSCAPE...) reads that same drawing and shares the same plain-JS
  modules at the repo root, so a rule lives in one place.
- `MODEL.dc.html` is the **old** editor, built on the DC framework. Nothing
  in the app links to it any more, but most of the test suite's helpers still
  open it (see Testing). Do not build features in it.

## Page map

Static HTML pages at the repo root. Each has a `<meta name="draft-build">`
line and loads `build-id.js` first (the deploy build stamp; see Deploy).

| Page | What it is |
| --- | --- |
| `index.html` | The entry page: the drive-thru, links into the editor, RUFF 3D, LANDSCAPE, CODES, LINKS, the DXF converter and the PDF tool (pdf.bluejetty.ca). |
| `MODEL.html` | **The editor (model space).** About 1,600 lines of markup and styles; the script is the 22 files in `model/`. |
| `LAYOUT.html` | Sheets: CONSTRUCTION LAYOUT, viewports at scale, titleblock, print / SAVE PDF (written by `pdf-writer.js`), DXF out, details on sheets, 3D tiles. |
| `PROJECT.html` | PROJECT page: project info, wall/floor build-ups, the typical wall section. |
| `EXTFINISH.html` | EXT. FINISH: the elevations with siding/stucco/brick areas, fascia finish, SPECIAL finish shapes, zoom and pan. |
| `BONEYARD.html` | The BONEYARD frame: the house's loops per floor, beams and columns. |
| `REALESTATEPLAN.html` | REAL ESTATE PLAN sheet: two 3D views on top, plans below. |
| `ESTIMATES.html` | Quantities laid out for pricing (`estimates.js`). |
| `SPECS.html` | The written specification (`spec-master.js`, `spec-pages.js`). |
| `CODES.html`, `LINKS.html` | Building-code / span-table catalogue and favourite links. |
| `SETTINGS.html`, `STANDARDS.html` | Keyboard profiles and company standard layers. |
| `MODEL.dc.html` | The OLD editor (DC framework, ~23,000 lines). Kept because tests use it. Not linked from the app. |
| `Notepad.dc.html`, `SaveBox.dc.html` | Old DC components, linked from nothing. |

### Separate programs in folders

Each lives in its own folder, loads the shared root modules with `../`, and
can be deleted without breaking the 2D pages.

| Folder | What it is |
| --- | --- |
| `viewer/` | **RUFF 3D / ROUGH 3D**: opens a `.draft` or a SAVE AS ZIP and builds the house in 3D. Two painters: a plain canvas painter with its own depth buffer (works on a PC with no graphics card, jb's case) and a WebGL painter (three.js 0.128 from `vendor/`). Section, level chips, finishes and textures, EXPORT in ten open formats (glTF/GLB, OBJ, STL, 3MF, PLY, DAE, X3D, VRML, DXF), PRINT MODEL for 3D printing. Files: `house-mesh.js` (drawing to faces), `paint-canvas.js`, `paint-webgl.js`, `viewer-camera.js`, `finish-texture.js`, `export-writers.js`, `print-model.js`, `viewer.js`. |
| `landscape/` | **RUFF / ROUGH LANDSCAPE**: lot grading. The house is read-only; the user sets spot elevations, the program draws contours, slope arrows and warnings. Stores an optional `landscape` block inside the `.draft`, which `drawing-format.js` passes through untouched. See `landscape/README.md`. |
| `neighborhood/` | Places several `.draft` files on one plan, display only. See `neighborhood/README.md`. |
| `DXF/` | The DWG-to-DXF converter page the DWG card opens. |

How the editor hands a drawing to these: MODEL's OPEN IN 3D and OPEN
LANDSCAPE chips open the program in a new tab and send the drawing by
`postMessage` (`draft-viewer-drawing`, `draft-landscape-drawing`; code in
`model/13-suites-trim-follow.js`). The sheet pages' 3D tiles
(`view3d-host.js`) show `viewer/` in a frame. **No 2D page loads
`viewer/` code or three.js**; `tests/viewer.spec.js` scans every root page
to hold that line.

## MODEL.html and its parts

`MODEL.html` was one ~27,000-line page until late October, when it was cut
at its own section headings into numbered parts (jb, 24 Oct: "how can we
reduce the MODEL.html size in a nice organized way"). The parts are plain
`<script src>` files loaded in order, and **they share one name space**: a
function declared in part 3 is visible in part 15. That makes a duplicate
name anywhere a page-breaking bug, so `proto/model-parts-harness.js` checks
for it. (Parts 1 to 17 still say "part N of 17" in their header; there are
22.)

| Part | Holds |
| --- | --- |
| `01-skin-view.js` | skin, zoom and pan, world-to-screen, boneyard state, photo underlay, room tag shape, ZOOM TO FILL |
| `02-holograms-tags.js` | holograms, DEMO, super nodes, window size tags |
| `03-plan-paint.js` | plan painting: which way is out, the bones, garage doors, the rail, the foot bar |
| `04-levels-notes-bars.js` | level and view switchers, NOTES pad, left rail, build bar, GRUFF's sign |
| `05-props-shelves-rail.js` | per-tool properties slot, shelves saved as suites, view rail |
| `06-selection-pick.js` | selection, hit testing, window drag, assemblies, anchor nodes, dimensions |
| `07-walls-magnet.js` | moving corners and walls, room corner card, the magnet, garage order |
| `08-structure-roof.js` | STRUCTURE (beams, columns, piles), ROOF, DELETE |
| `09-draw-move-stretch.js` | the draw gesture, ROTATE/FLIP, RESCALE, MOVE, STRETCH, BREAK ROOF |
| `10-tracking-garage.js` | hovered nodes, tracking rays, attached garage, CONNECT AT CORNER, house off the trace, the lot |
| `11-floor-openings-fixtures.js` | FLOOR tool, windows and doors, washrooms, fixtures and kitchens, premade designs |
| `12-garage-storeys-stairs.js` | grade beam, rooms over garages, storeys, AUTO STAIR, framing |
| `13-suites-trim-follow.js` | suites, + CUT, TRIM/EXTEND, MOVE and DELETE, turning the house, OPEN IN 3D / LANDSCAPE hand-off |
| `14-promotion-tools.js` | typed lengths (TAB to angle), switches, the tool column, ASSEMBLY / UNGROUP |
| `15-panels.js` | OBJ / PROP and the tool panels (wall, floor, line, roof, dimension, beam, fixture) |
| `16-gestures-undo.js` | pan/zoom gestures, half-finished gestures, UNDO / REDO |
| `17-boot-save.js` | boot, save, NEW, orders from PROJECT, the edit lease |
| `18-draft-commands.js` | OFFSET, MIRROR, ROTATE about a point, FILLET, ARRAY |
| `19-line-arcs.js` | arcs and circles inside LINE (and SHAPE/FLOOR) |
| `20-wall-type-card.js` | CREATE WALL TYPE (walls built from slices) |
| `21-details-library.js` | the DETAILS LIBRARY file and DETAIL windows |
| `22-details-strip.js` | the DETAILS strip inside a house file |

The page keeps its working drawing in a plain object (`drawing`) with
helpers such as `selection` and `lines()`; tests reach these through
`page.evaluate`. Painting is 2D canvas only (no three.js on this page).
Elevations and sections are drawn by `cut-view.js`, the same painter LAYOUT
uses, so a fix there shows on both screens.

### Saving

MODEL.html saves when the drafter presses SAVE (and SAVE AS / SAVE AS ZIP
to the computer); it warns before closing with unsaved work. There is no
autosave on this page yet (see `RULING-autosave-two-writers.md`). Two tabs
cannot edit at once: an **edit lease** gives one tab the right to edit, and
TAKE OVER DRAWING moves it.

## Shared modules at the root

Plain JS, one global each (`window.DraftSomething`), each guarded by
`if (!window.X)` so loading twice is harmless. Nearly all are **pure** (plain
data in, plain data out, no DOM), which is why the Node harnesses in
`proto/` can test them with no browser. A page that uses one reaches it for
every rule in it and keeps no copy of its own
(`RULING-a-ported-rule-keeps-one-home.md`).

**Load order matters.** Some modules capture another at load time
(`const geo = window.DraftGeometry2D;`), so the dependency must be loaded
first. Copy the order in `MODEL.html` when adding a page.

The list below names the main ones by job. Every module opens with a header
comment saying what it is; read that before editing.

**Drawing file and storage**

| File | Role |
| --- | --- |
| `drawing-format.js` | The `.draft` format: version number and a reader per collection. Every load goes through it. |
| `shared-file-store.js` | IndexedDB wrapper (`SharedFileStore`), buckets with revision checks. The working drawing is bucket `model-drawing`. |
| `zip-bundle.js` | SAVE AS ZIP (drawing plus folders of attached files) and opening a zip back. |
| `backup-email.js`, `error-report.js` | BACKUP FILE email and the problem-report card; both send through jb's Cloudflare mail worker. Reports go to `REPORT_TO` in `error-report.js`. |
| `profile-manager.js` | Personal settings / company standards packages, key bindings. |
| `build-id.js` | The deploy build stamp and its one fresh reload. |
| `traffic-counter.js` | The one deliberate off-site request (`tests/no-third-party.spec.js` allows only it). |

**Geometry and painting**

| File | Role |
| --- | --- |
| `geometry-2d.js` | Plan math: snap, trim, distances, roof skeleton and roof faces. |
| `formatters.js` | Feet-and-inches parsing and formatting (also metric suffixes). |
| `render-2d.js` | 2D plan painters (canvas + transform + env in, ink out). |
| `cut-view.js`, `cut-view-env.js` | The section / elevation painter, shared by MODEL, LAYOUT and EXT. FINISH. About 10,500 lines and the most-changed file; see HANDOVER for care notes. |
| `elev-snap.js`, `cut-marks.js` | Snap points on elevations; where section marks land on the plan. |
| `layout-plan.js`, `plan-composition.js`, `titleblock.js` | Plans on LAYOUT viewports, composed once; the titleblock. |
| `line-styles.js`, `pen-table.js`, `layer-views.js` | Line weights/dashes, pen per CAD layer, which drawing of a level is shown. |
| `finish-patterns.js`, `roof-patterns.js`, `finish-settings-panel.js` | Exterior finish and roofing hatches; finish thickness and texture settings. |
| `plan-rotate.js`, `north.js` | Turning the house a quarter; construction vs true north. |
| `dxf-reader.js`, `dxf-writer.js`, `pdf-writer.js`, `pdf-scan.js` | DXF in and out, PDF of the sheets, PDF/photo underlays. |
| `detail-snapshot.js`, `wall-section.js`, `stair-section.js` | Detail snapshots, the typical wall section, the stair section. |

**Building parts and rules**

| File | Role |
| --- | --- |
| `wall-types.js` | Wall assemblies (`totalIn` = full width), stock and made (CREATE WALL TYPE) types. Authoritative on wall thickness. |
| `level-assembly.js`, `level-lock.js` | What one level is made of (wall height, floor build-up); LEVEL LOCK grouping. |
| `build-house.js`, `outline-master.js`, `traced-plans.js`, `premade-plans.js`, `starter-shape.js` | The autohouse: outline to walls, floors, slab and footings. |
| `garage-roofs.js`, `garage-site.js`, `door-bucks.js` | Garages: roofs, detached placement, door bucks. |
| `roof-types.js` | Roofing materials and gable corner styles. |
| `joist-spans.js`, `beam-pockets.js`, `footing-outline.js`, `overhead-lines.js` | Joist picks by span, beam pockets, strip footing outline, what hangs over a floor. |
| `stair-geometry.js`, `stair-place.js`, `stair-rules.js`, `auto-stair.js` | Stairs: riser math and plan parts, placing by hand, the rulebook, auto placement. |
| `fixture-kinds.js`, `fixture-geometry.js`, `fixture-profiles.js`, `closets.js`, `washroom.js`, `washroom-presets.js`, `kitchen-presets.js` | Fixtures (cabinets, sinks, fireplace, baths...), closets, preset washrooms and kitchens. |
| `auto-windows.js`, `auto-dims.js`, `fen-labels.js`, `schedules.js` | Window siting, AUTO DIMS, opening names, door/window schedules. |
| `hologram.js` | HOLOGRAMS: another `.draft` shown under this one (suites compiled into one plan). |
| `turtle-path.js`, `turtle.js`, `trim-extend.js`, `calc-engine.js` | TURTLE (direction + distance table), TRIM/EXTEND, the construction calculator. |
| `areas.js`, `room-standards.js`, `room-numbers.js`, `electric-rules.js`, `electric-symbols.js` | Areas for permits, room minimums and numbering, electrical devices. |
| `estimates.js`, `spec-master.js`, `spec-pages.js`, `codes-catalog.js` | Estimates, specification, codes catalogue. |

**Shell, skins and guided flows**

| File | Role |
| --- | --- |
| `palette.js`, `shell-bars.js`, `shell-bars.css`, `model.css` | Colours for both skins; the bars every page wears. |
| `bone-wallet.js`, `bone-sound.js` | The bone economy (prints, exports and saves cost bones) and its sound. |
| `gruff-interview.js`, `gruff-drivethru.js`, `build-menu.js`, `lot-sizes.js`, `first-run.js`, `tour.js` | The drive-thru, house types, lot card, first run, tour. |
| `orientation-guard.js`, `touch-device.js` | Landscape lock; the phone/tablet note and PC MODE. |
| `view3d-host.js` | 3D tiles on sheet pages (frames `viewer/`). |
| `support.js` | The DC runtime for the old `.dc.html` pages. Generated; do not edit. |

Vendored libraries live in `vendor/` (React for the old DC pages, three.js
0.128 + OrbitControls for `viewer/`, pdf.js 3.11.174 + its matching worker,
fonts). Nothing is fetched from a CDN. Upgrade pdf.js and its worker in the
same commit or PDF parsing fails.

## Data and persistence

```
drafter's press in MODEL.html
  -> tool code changes `drawing`, marks the page unsaved
    -> SAVE: drawing JSON -> drawing-format.js -> SharedFileStore 'model-drawing'
                          -> or a .draft / .zip file on the computer
other pages (LAYOUT, PROJECT, EXT. FINISH, 3D...) read the same bucket or file
```

- A drawing is **one JSON document**, versioned with
  `DraftDrawingFormat.VERSION`, holding metadata and geometry only.
  **Binaries never go in it** (no base64): underlay files are separate
  records keyed by id, or folders inside a SAVE AS ZIP.
- **Loading always goes through the readers in `drawing-format.js`**: a
  newer format is refused outright, types are coerced, broken entries are
  dropped and reported, missing fields get defaults, legacy shapes are
  remapped. The standing rule: **old drawings open forever**. Format changes
  add fields with defaults; they never break.
- **A new saved field needs a reader in `drawing-format.js`**, or the reader
  drops it on the next load and it silently vanishes. (A block the 2D pages
  do not own, like `landscape`, is passed through untouched on purpose.)
  `RD-DOCUMENTS/RULES-persisted-keys.md` says what the saved key names mean, and
  `tests/persisted-format.spec.js` pins them.
- Storage is per web address, so roughdrafter.com and ruffdrafter.com keep
  separate drawings, settings and bone wallets in the same browser.

## Levels, shelves and holograms

Levels have fixed ids for the stock ones (FOUNDATION / BASEMENT, MAIN FL,
2ND FL, ROOF, SITE); added levels get new ids. Floor levels have layer views
(walls plan, FLOOR LAYOUT, electric...) from `layer-views.js`. The BONEYARD
holds shelves outside the level stack; the master outline lives there and
its edits flow to each level's linked copy (`outline-master.js`).

A shelf can be saved as a SUITE, a SHELF or a **HOLOGRAM** (another `.draft`
shown on a level or the SITE plan). A plan made only of holograms is a
supported case (jb compiles suites into one master plan this way), and the
elevations, rail seats and LAYOUT draw them.

## Deploy

- `main` is what is live. A merge to `main` deploys; there is no staging
  site.
- **roughdrafter.com** is GitHub Pages. `.github/workflows/pages.yml` copies
  the site, stamps the commit id into every page and script address
  (`tools/stamp-build.js`), and publishes the copy, so a cached old page
  can't run new scripts. The stamp only happens when the repo's Pages
  source is set to "GitHub Actions"; otherwise the workflow stops green and
  Pages serves `main` as-is. GitHub Pages can time out and cancel a
  deploy, so a merge occasionally needs the deploy re-run.
- **ruffdrafter.com** is a Cloudflare Pages project ("ruffdrafter") that
  builds from `main` with the same stamp script. Its build command lives in
  the Cloudflare dashboard, not the repo, so if `tools/stamp-build.js`
  changes its arguments that command must change too.
- The repo itself is never stamped: locally and under tests every page says
  `dev`.

## Testing

Two kinds of check, both in `.github/workflows/test.yml`:

1. **Node harnesses and mutation gates** (`proto/`): fast, no browser.
   `proto/*-harness.js` test the pure modules; `proto/*-mutants.js` break a
   line on purpose and prove a spec notices. CI runs them in the
   `harnesses` job. See `RUNNING-THE-HARNESSES.md`.
2. **Playwright** (`tests/*.spec.js`): drives the real pages in Chromium
   over a plain HTTP server. About 670 spec files and 3,700 tests (27 Nov),
   growing by roughly 250 to 300 a week. Serial on one worker; CI splits it
   into parallel shards. The number of shards is set only in the `matrix`
   in `test.yml` (the run step reads it back), so change it there.

Things a new session gets wrong:

- **`helpers.openModel` opens the OLD page** (`MODEL.dc.html`). About 140
  spec files only ever test through it. To test the real editor, seed a
  drawing into the `model-drawing` bucket and open `/MODEL.html` (see
  `tests/stack-cycle.spec.js` or `tests/model-tool-select.spec.js`, and
  `h.planFrame(page).at(x, z)` for world-to-screen).
- **Assert against the saved drawing**, not the DOM.
- **Never run with `--workers=2`**; the config refuses it, because parallel
  workers on one machine wipe each other's storage. Shard instead.
- Each spec opens with a prose header saying what it pins, usually quoting
  jb. Read it before changing a test.

## The old DC framework (MODEL.dc.html only)

Kept here for whoever has to touch the old page or the two orphan
components. A `.dc.html` page is one component: an HTML template inside
`<x-dc>…</x-dc>` (with `{{ name }}` interpolation, `<sc-for>`, `<sc-if>` and
`sc-camel-*` attributes) plus one `class Component extends DCLogic` in a
`<script type="text/x-dc" data-dc-script>` block, run by `support.js`.
`renderVals()` is the only bridge from logic to markup. Geometry lives in
instance fields (`this._walls`, `this._roofs`...), not React state; a new
saved collection there had to be added in four places
(`_ensureDrawingCollections`, the serialiser, `_applyDrawingData`,
`drawing-format.js`). New work does not go here.
