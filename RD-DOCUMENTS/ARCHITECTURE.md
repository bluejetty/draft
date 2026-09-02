# Draft — Architecture

How the app is put together, how the DC framework works, and where data
flows. Written for someone about to add a feature (the 3D phase included)
who needs to know which file owns what before touching anything.

## Page map

Draft is a set of static HTML pages served from the repo root — GitHub
Pages in production, `python3 -m http.server` under test. No build step,
no bundler: what is in the repo is what runs.

| File | Role |
| --- | --- |
| `index.html` | Entry hub: plain HTML, links into the workspaces. |
| `MODEL.dc.html` | The drafting workspace — most application logic still lives here, though several modules have been extracted out of it (see `REFACTOR-PLAN.md`). |
| `LAYOUT.dc.html` | Sheet layout workspace. |
| `SETTINGS.html` | Keyboard bindings and preferences UI. |
| `STANDARDS.html` | Company Standard Layers reference. |
| `Notepad.dc.html`, `SaveBox.dc.html` | Small DC components; `SaveBox` is the minimal worked example of the component pattern. |

Shared plain-JS modules, each loaded with an ordinary `<script src>` tag
and each guarded by `if (!window.X)` so double-loading is harmless. That
guard earns its keep beyond tidiness: it is what lets a stand-in module be
displaced by the real one, simply by loading the real one first.

Nearly all of these are **pure** — no DOM, no component state, plain data in
and plain data out — which is what makes them testable in node without a
browser (see `proto/`). The handful that reach for the platform say so.

**Platform and storage**

| File | Global | Role |
| --- | --- | --- |
| `support.js` | `DCLogic` etc. | The DC runtime. **Generated** from `dc-runtime/src/*.ts` — do not edit by hand (header says how to rebuild). |
| `drawing-format.js` | `DraftDrawingFormat` | Stored-drawing readers: format version + one validator per collection. |
| `shared-file-store.js` | `SharedFileStore` | **IndexedDB.** Wrapper over db `pdf-img-mgr-shared`, store `files`. Buckets of records, each carrying a revision so a concurrent whole-bucket write is caught rather than silently clobbering. |
| `profile-manager.js` | `DraftProfileManager` | **localStorage.** Personal-settings / company-standards packages. JSON data only; imported packages never execute code. Owns `DEFAULT_KEYBINDINGS`. |
| `orientation-guard.js` | `DraftOrientationGuard` | **DOM.** Holds every working screen in landscape on a coarse pointer; ENTRY is exempt. |
| `traffic-counter.js` | — | The one deliberate off-site request in the app, and the single exception `tests/no-third-party.spec.js` knows about. |

**Geometry and painting**

| File | Global | Role |
| --- | --- | --- |
| `geometry-2d.js` | `DraftGeometry2D` | Plan-view math (snap, trim, distances, roof skeleton and faces) on plain `{x,y,z}` objects — no THREE, no state. |
| `formatters.js` | `DraftFormatters` | Architectural length parsing and formatting: the one place feet-and-inches becomes a number and back. |
| `wall-types.js` | `DraftWallTypes` | Wall assembly definitions; `totalIn` is the full assembly width. Authoritative on wall geometry. |
| `render-2d.js` | `DraftRender2D` | The 2D overlay painters: a canvas context and a world→screen transform in, ink out. |
| `cut-view.js` | `DraftCutView` | The generated section / elevation painter, shared by MODEL and the LAYOUT sheets — so one fix heals both screens, and one bug shows on both. |
| `layout-plan.js` | `DraftLayoutPlan` | Turns a saved drawing's plan-level entities into ink on a LAYOUT viewport. |
| `titleblock.js` | `DraftTitleblock` | The company strip on a LAYOUT sheet. |

**Generation — the machinery behind the bone**

| File | Global | Role |
| --- | --- | --- |
| `build-house.js` | `DraftBuildHouse` | BUILD HOUSE itself: measure the outline, return walls, floors, slab and footings as plain data. |
| `room-grow.js` | `DraftRoomGrow` | Stamp programs in, partition walls and room claims out, plus the house-wide BEDROOM / WC numbering ladder. |
| `auto-stair.js` | `DraftAutoStair` | Where a stair fits, derived from the outline, beam lines and stamps. |
| `stair-rules.js` | `DraftStairRules` | The rulebook `auto-stair.js` reads, so the numbers are an office standard rather than constants in a tool. |
| `auto-windows.js` | `DraftAutoWindows` | The office's window-siting ruleset: faces and room claims in, openings out. |
| `auto-dims.js` | `DraftAutoDims` | AUTO DIMS string computation. |
| `areas.js` | `DraftAreas` | Per-level and building areas for permit applications. |

**Office standards — where the drafting knowledge lives**

| File | Global | Role |
| --- | --- | --- |
| `room-standards.js` | `DraftRoomStandards` | Preferred room minimum sizes, and the ROOM TRAY list. |
| `fen-labels.js` | `DraftFenLabels` | The fenestration naming ladder and its stock tables. Authoritative on what an opening is *called*. |

**Guided flows and secondary pages**

| File | Global | Role |
| --- | --- | --- |
| `tour.js` | `DraftTour` | The guided tour's rules: plain data in, verdicts and geometry out. |
| `gruff-interview.js` | `DraftGruffInterview` | The interview engine — the question tree Gruff works through. Deterministic: no network, no AI, seeded flavour only. |
| `gruff-drivethru.js` | `DraftGruffDrivethru` | The drive-thru window's pure half. |
| `bone-wallet.js` | `DraftBoneWallet` | **localStorage.** The bone economy: seed grant, cost per build, drip and cap. |
| `project-page.js` | `DraftProjectPage` | The PROJECT page's typical wall-section detail. |
| `pdf-scan.js` | `DraftPdfScan` | **DOM.** PDF / photo scan-and-convert for the INSERT flow. |

Vendored libraries live in `vendor/` (React 18.3.1, Three.js 0.128,
OrbitControls, pdf.js 3.11.174 + its matching worker). Nothing is fetched
from a CDN; the app runs with no network. The pdf.js worker must always
come from the same `pdfjs-dist` build as the main library — upgrade both
in the same commit or PDF parsing dies with a version-mismatch error.

## The DC framework

A `.dc.html` page is one self-contained component: an HTML template plus a
logic class, evaluated at load time by `support.js`.

### Template

The markup inside `<x-dc>…</x-dc>` is the template. It is real HTML with
four extensions:

- `{{ name }}` — interpolation. Values come from the flat object
  `renderVals()` returns (merged over `props`). Works in text and in
  attribute values, including inside `style="…"`.
- `<sc-for list="{{ items }}" as="item">…</sc-for>` — repeat the body per
  array element; bindings inside use `{{ item.field }}`.
- `<sc-if value="{{ cond }}">…</sc-if>` — conditional render.
- `sc-camel-*` attributes — React props that need a capital letter
  (`sc-camel-on-mouse-down="{{ handler }}"` → `onMouseDown`), since HTML
  attributes are case-insensitive.

`hint-placeholder-count` / `hint-placeholder-val` on `sc-for`/`sc-if` size
the skeleton placeholders drawn before the logic finishes booting; they
have no effect after mount.

### Logic

The `<script type="text/x-dc" data-dc-script>` block defines exactly one
`class Component extends DCLogic`. The runtime instantiates it and wires
it to a React wrapper. The contract:

- `this.props` — inputs, defaults declared in the script tag's
  `data-props` JSON attribute (`default`, `tsType` per prop).
- `this.state` + `this.setState(update, cb)` — same semantics as React
  class state.
- Lifecycle: `componentDidMount`, `componentDidUpdate(prevProps)`,
  `componentWillUnmount`.
- `renderVals()` — returns the flat object the template renders against.
  This is the single choke point between logic and markup: the template
  never reads state directly, so anything the markup shows must be shaped
  here.

There is no JSX and no virtual-DOM authoring in app code; React is an
implementation detail of the runtime. Handlers are plain methods passed
through `renderVals()` into `onClick="{{ handler }}"`-style bindings.

### Adding a component

Copy the `SaveBox.dc.html` shape:

1. `<head>` loads `vendor/react…`, `vendor/react-dom…`, `support.js`
   (plus any shared modules the component needs).
2. `<x-dc>` holds the template.
3. `<script type="text/x-dc" data-dc-script data-props="…">` holds
   `class Component extends DCLogic` with `renderVals()`.

That's the whole pattern. The page is immediately servable and testable —
no registration, no build.

## MODEL.dc.html anatomy

One file, deliberately (see the split plan below before "fixing" that).
Internal layout:

- **Constants** from ~line 1170: tuning values, layer names,
  `LEVEL_BUTTON_NAMES`, `LEVEL_LAYER_VIEWS`, joist/footing defaults.
  Retune here, not in the code that consumes them.
- **One `Component extends DCLogic`** containing everything, organised by
  `// ─── Section ───` banner comments: Lifecycle, Local drawing
  persistence, INSERT PHOTO/PDF underlays, Undo history, Init (Three.js
  scene), STAIR workspace, Levels, Views, Mouse, the per-tool drawing
  sections (Wall/Floor/Shape/Roof/Line/Cut/…), the 2D renderers, Snap
  helpers, Selection/groups, Keyboard, Formatters, and `renderVals()` at
  the end. Grep for `── ` to get the live table of contents.

### State vs. instance collections

React state (`this.state`) holds UI state: active tool, active level,
phases, panel visibility, `cuts`, `dimensions` counts, etc. The heavy
geometry collections live as **instance fields**, not state:
`this._walls`, `this._floors`, `this._shapes`, `this._roofs`,
`this._outlines`, `this._dimensions`, `this._vertices`, `this._groups`,
`this._underlays`, … (see `_ensureDrawingCollections()` for the full
list). Mutating them does not re-render; the canvas renderers read them
directly each frame, and `setState`/`_redrawOverlay` trigger repaints.
New persisted collections must be added in `_ensureDrawingCollections()`,
the save serialiser, `_applyDrawingData`, **and** `drawing-format.js` —
all four, or the field silently vanishes on some path.

### Rendering

Two renderers share the viewport:

- A **Three.js scene** (vendored 0.128) for the model: walls, roofs, cut
  lines/arrows, the 3D orbit views. The plan view is an orthographic
  camera looking down.
- A **2D overlay canvas** for plan-view ink: dimensions, underlays, roof
  plans, stair workspace panes, snap markers.

WebGL is optional: with it unavailable the overlay canvas is the only
renderer and must still draw everything the plan needs
(`tests/cut-fallback.spec.js` pins this for cuts). New visible features
need a 2D representation, not just meshes.

## Data flow and persistence

```
input (mouse/keyboard)
  → tool handler mutates instance collections / setState
    → _markUnsaved()
      → autosave: drawing JSON → SharedFileStore bucket 'model-drawing'
```

- The saved drawing is **one JSON document** (versioned with
  `DraftDrawingFormat.VERSION`) holding metadata and geometry only.
  **Binaries never go in it** — no base64. Underlay files live as
  separate records in the `underlays` bucket, keyed by underlay id;
  the JSON holds placement metadata pointing at them.
- The INSERT PHOTO/PDF card classifies a picked PDF page into four tiers
  by inspecting its operator list: **VECTOR** (paths + live text, no
  images), **HYBRID** (real vector geometry with embedded images),
  **OCR** (a scan wearing an invisible searchable text layer — text
  rendering mode 3 gives it away), **IMAGE** (just pixels). Vector and
  hybrid keep their original bytes; OCR and image convert once to a
  capped-size quality-0.8 WebP. Titleblock scale notations are read off
  the page text where present; CALIBRATE (mark a known distance)
  computes the scale when they aren't.
- **Loading** goes through `_applyDrawingData`, which runs every
  collection through its `drawing-format.js` validator: version checked
  up front (a newer format is refused outright, never partly applied),
  types coerced, broken entries dropped and reported, missing optional
  fields defaulted. Legacy shapes are remapped, not discarded
  (`LEGACY_LEVEL_ID_REMAP`). The standing rule: **old drawings open
  forever** — format changes are additive with defaults, never breaking.
- The validators also normalise on the way in (e.g. a cut's `dirVec` is
  re-normalised to unit length), so downstream code can trust invariants
  instead of re-checking them.

## Levels and layers

Levels have fixed ids: `1` FOUNDATION, `3` MAIN FL, `5` 2ND FL, `7` ROOF,
`8` SITE; `+ ADD` levels get new ids and the standard floor layer sets.
ROOF and SITE are whole-level contexts; floor levels carry layer-set views
(ELECTRIC / PLAN / FLOOR / STAIR, FOUNDATION on level 1) defined by
`LEVEL_LAYER_VIEWS`. The BONEYARD is shelf storage outside the level
stack; the master outline lives there and propagates edits to each
level's linked points (`srcId` links on stored vertices).

Per-level construction data is queryable and is what a section/elevation
generator should read: `_levelAssembly(levelId)` (wall height, joists,
sheathing, slab, footing), `_levelFloorFt`, `_levelBorderHeights`
(datum-aware stacked heights), `_foundationHeights`, and roof geometry
validated with per-edge `eave|gable`, clamped `overhang` and `pitch`.

## The BONEYARD → OUTLINE → BUILD HOUSE flow

The footprint pipeline that most other geometry hangs off:

1. **OUTLINE** — the never-printing footprint guide (`OUTLINE_LAYER`).
   The first outline completed on the active BONEYARD shelf becomes that
   shelf's **master** and copies to every level. Master edits flow to
   each level copy's common points (via `srcId` links); per-level local
   adjustments survive later master edits. Additional outlines stay
   local to their level.
2. **BONEYARD shelves** — shelf storage outside the level stack. Each
   shelf keeps its own master; shelves are isolated from each other and
   from levels. Marks placed on the master (FENESTRATION on the
   BONEYARD) annotate the footprint for generation.
3. **BUILD HOUSE** — reads the master outline + marks + level
   assemblies and generates the building: exterior walls per level,
   slab/foundation, doors and windows cut where marked, roof from the
   footprint plus overhang, and the auto-dimension stacks on every level
   it builds. Re-running regenerates instead of doubling. Attached
   garages marked on the outline generate their own walls, doors, and
   grade beam.

Auto-dims (`_placeAutoDims`) reads the same outlines/roofs and strings
each footprint's own stack per side; dimension ends carry `srcId` links
so master edits move the strings with the footprint.

## Testing

Playwright drives the real pages over a plain HTTP server (config in
`playwright.config.js`; the suite starts `python3 -m http.server 4173`
itself). One worker, deliberately serial. See the README for setup.

Conventions the suite relies on:

- **Assert against the saved drawing**, not the DOM: `h.savedDrawing()`
  reads the JSON back out of the `model-drawing` bucket, so a test proves
  what persists, not what happened to render.
- `h.waitForSaved()` requires SAVED to hold across two looks, because an
  edit flips the status a render late and a single early poll can read
  the previous save.
- Real interactions: `h.clickWorld()` converts world feet to client
  pixels and clicks; drags use real mouse moves. Pixel-level checks read
  the overlay canvas (`h.overlayPixels` / `h.countColor`).
- WebGL-off coverage: `h.openModel(page, { webgl: false })` boots the 2D
  fallback path.

Every PR lands with the full suite green. Tests are the spec: the header
comment of each `*.spec.js` states the behaviour contract in prose.

## The 3D phase — ground rules already decided

- Three.js is already vendored and initialised; 3D work extends the
  existing scene, it does not introduce a new stack.
- **Extend `drawing-format.js`** for anything new that persists — no
  separate schema, and old 2D drawings must open forever.
- Binaries stay in IndexedDB buckets; the drawing JSON stays
  metadata-only.
- **No structural reorganisation of MODEL.dc.html until #116 lands.**
  The eventual split (tools, panels, renderers into separate files) is
  planned, not started — plan against the `── Section ──` banners, which
  are the natural seams.
- Small PRs, each with tests, suite green before merge.
