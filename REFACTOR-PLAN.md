# MODEL.dc.html split — plan only

Per the work order: this is a proposal document. **Zero code moves before
#116 lands**, and nothing here is a commitment — it's the safest order we
could find if/when the split starts.

## What the DC framework allows

The runtime evaluates exactly one `class Component extends DCLogic` from
the page's `data-dc-script` block — the class itself cannot be split
across files. What *can* move is everything the class delegates to:
plain `<script src>` modules attaching a `window.*` global, loaded before
the component script. This is already the proven house pattern —
`geometry-2d.js`, `drawing-format.js`, `profile-manager.js`,
`shared-file-store.js` are exactly this shape, each guarded with
`if (!window.X)` and exporting a frozen object of functions.

So "splitting MODEL" concretely means: move **pure logic** into such
modules; the class keeps thin methods that call them with explicit
arguments. Methods that read/write component state stay put. The class
shrinks; it doesn't fragment.

## Extraction order (safest first)

Each step is one PR, suite green, and provably a delegation — the module
function takes explicit inputs and returns values; the class method
becomes a one-liner calling it. No behavior change, no test edits.

1. **Formatters** (`── Formatters ──`, ~15,130): feet/inch string
   formatting. Pure string-in/string-out, zero state. → `formatters.js`.
   Lowest possible risk; a warm-up that establishes the PR shape.
2. **2D painters** (roof plan ~11,070; wall cross-section ~11,250; shape
   ~11,500; cuts ~5,660; stair panes ~5,180–5,750): already written as
   `(ctx, toS, data)` painters that read collections handed to them. →
   `render-2d.js`, with the data they currently pluck off `this` passed
   as one explicit argument object. The pixel-assertion tests
   (overlayPixels checks) pin these hard, which is what makes the move
   verifiable.
3. **Auto-dims** (`── Line drawing ──` neighborhood, `_placeAutoDims` +
   `facingOf`/`mergeJogs`/string-stacking, ~13,050–13,390): a
   self-contained algorithm over `(outlines, roofs, walls, fenestrations,
   settings)` returning dimension entries. Three spec files pin it
   (auto-dims, roof-dims, auto-footings). → `auto-dims.js`.
4. **BUILD HOUSE generation** (~8,590–9,270): outline → walls/slab/roof
   generation; feeds on assemblies and outlines, returns geometry. Pinned
   by auto-house, build-links, garage specs.
5. **Vertex pool** (~11,790+): stateful (owns `_vertices` identity and
   the srcId master-link semantics) — extract only behind a deliberate
   interface, late, if ever.
6. **Tool state machines and keyboard** (mouse/tool sections, keyboard at
   ~14,880): these *are* the component — they read and write live state
   on every event. Leave in the class. If 3D pressure demands it, the
   template here is a context-object interface designed then, not now.

Persistence (`buildSave`/`_applyDrawingData`) stays in the class in all
phases: the four-place rule (collections init, serializer, applier,
drawing-format validator) is easiest to honor when three of the four
places live together next to the format module.

## Risks

- **`this` entanglement is the whole game.** MODEL methods read dozens of
  instance fields; a missed field in an explicit-args refactor becomes
  `undefined` and often fails *silently* (a wrong draw, not a crash).
  Mitigation: extract only functions whose inputs can be enumerated
  completely, and let the pixel/JSON assertions in the suite be the
  verifier — which is why painters and auto-dims go early (dense
  coverage) and tools go last (event-driven, hard to pin).
- **Draw order is behavior.** The overlay painters run in a specific
  sequence; pixel tests will catch reordering, but only where they look.
  Extract without reordering calls.
- **Script tag order matters.** New modules must load before the
  component script and after their dependencies; there's no bundler to
  save you. Keep the module count small (the six above, not sixty).
- **GitHub Pages caching.** New/renamed .js files change URLs; a stale
  cached MODEL.dc.html referencing a not-yet-cached module 404s. Adding
  the script tags and the module in the same commit is sufficient; avoid
  renaming existing modules.
- **renderVals keys and template strings are load-bearing.** The split
  must never rename a renderVals key or a state field — templates
  reference them by string and no tool will catch a typo statically.
- **#116 lands first, always.** Sections/elevations will touch cuts,
  renderers, and level heights; splitting under Devon's feet would force
  him to rebase across a reorganization. The plan waits.

## What "done" looks like

MODEL.dc.html keeps: the template, the component class with state,
lifecycle, tools, keyboard, persistence, and thin delegations. Alongside
it: `formatters.js`, `render-2d.js`, `auto-dims.js`, `build-house.js`
in the geometry-2d mold — pure, unit-testable, and individually
reviewable. Rough arithmetic: those four sections are ~3,500–4,000 lines
of today's ~16,500, taking the main file under ~13,000 with zero
behavior change.
