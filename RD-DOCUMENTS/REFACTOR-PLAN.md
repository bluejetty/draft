# MODEL.dc.html split — plan only

This began as a proposal document, written while the split was still
hypothetical and gated on board #116. That gate is long gone — #116 (the
semantic cut views) landed, and **steps 1 to 4 have all been carried out**,
each as its own reviewed PR, in the order proposed here.

What remains live is steps 5 and 6, and the most useful thing in this
document is now the reasoning for why those two should be approached
differently — or, in the case of step 6, not at all. Read the risks section
before proposing any further extraction; it is the part that has aged best.

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
becomes a one-liner calling it. No behavior change, no test edits. That
rule held for all four completed steps and is the reason none of them
needed a follow-up fix.

**Status against `main` at `c2f4d72`:** steps 1–4 done, 5 and 6 outstanding.

1. ✅ **Done → `formatters.js`.** Feet/inch string
   formatting. Pure string-in/string-out, zero state. Lowest possible
   risk; the warm-up that established the PR shape the rest followed.
2. ✅ **Done → `render-2d.js`.** The 2D painters, already written as
   `(ctx, toS, data)` painters reading collections handed to them, with
   the data they had plucked off `this` passed as one explicit argument
   object. The pixel-assertion tests
   (overlayPixels checks) pin these hard, which is what makes the move
   verifiable.
3. ✅ **Done → `auto-dims.js`.** `_placeAutoDims` and its helpers: a
   self-contained algorithm over `(outlines, roofs, walls, fenestrations,
   settings)` returning dimension entries. Three spec files pin it
   (auto-dims, roof-dims, auto-footings).
4. ✅ **Done → `build-house.js`.** Outline → walls/slab/roof
   generation; feeds on assemblies and outlines, returns geometry. Pinned
   by auto-house, build-links, garage specs.
5. ⏳ **Outstanding — vertex pool.** Stateful (owns `_vertices` identity and
   the srcId master-link semantics) — extract only behind a deliberate
   interface, late, if ever.
6. ⛔ **Deliberately not extracted — tool state machines and keyboard.**
   These *are* the component: they read and write live state on every
   event. Leave them in the class. If 3D pressure ever demands otherwise,
   the template is a context-object interface designed then, not now.

**And one that was never in this plan: `cut-view.js`.** The generated
section / elevation painter came out under board #168, so that the LAYOUT
sheets could seat the same views MODEL draws. It followed the same rule —
its own PR, a pure module, no behavior change — which is why it slotted in
without disturbing the numbered order above. Expect more of these: the plan
lists the extractions worth doing on their own merits, not every extraction
a feature will ever justify.

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
- **~~#116 lands first, always.~~** *Satisfied.* Board #116 — the semantic
  cut views — landed, and the extractions followed it rather than racing
  it. The reasoning is kept because it generalises: an extraction must not
  land under an in-flight feature that touches the same region, or its
  author pays for the reorganisation in rebase conflicts. Substitute
  whatever is in flight today; right now that is the elevation painter.

## What "done" looks like

This is now largely a description rather than a forecast. MODEL.dc.html
keeps the template, the component class with its state, lifecycle, tools,
keyboard, persistence, and thin delegations. Alongside it stand
`formatters.js`, `render-2d.js`, `auto-dims.js`, `build-house.js` and
`cut-view.js`, all in the geometry-2d mold — pure, testable in node, and
individually reviewable.

The file did not shrink the way the original arithmetic predicted, and that
is worth knowing rather than quietly restating: MODEL has grown through the
extractions, because features have been landing faster than logic has been
moving out. The extractions are still worth it — what left is the part that
can be tested without a browser — but nobody should expect the line count to
fall from extraction alone, and a plan that measures success in lines will
keep reporting failure.

That is what rule 5 in BRANCHING.md is for: new logic starts in a module.
Extraction fixes the past one painful PR at a time; the rule stops the file
growing in the first place, which is the cheaper half by a wide margin.
