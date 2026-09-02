# MIGRATION STATUS — where every page and module stands

The inventory for the move. **One table to answer "where are we?"** without
reading the repo.

Two apps share this repository during the build — see `PLAN-new-app.md` for the
order and the reasoning. That is workable but it is not self-evident, so this
file exists to make the state legible at a glance.

**Update it in the same PR as the change it describes.** A status here that is
a week stale is worse than no file, because someone will trust it.

Taken from the repository on 2 Sep 2026. Regenerate the counts rather than
editing them by hand.

---

## Pages

| page | built with | lines | status |
|---|---|---|---|
| `LAYOUT.dc.html` | DC | 1,683 | `OLD` — to be replaced |
| `MODEL.dc.html` | DC | 22,467 | `OLD` — to be replaced |
| `Notepad.dc.html` | DC | 119 | `ORPHAN` — linked from nothing |
| `PROJECT.html` | plain | 923 | `KEEP` — already built the new way |
| `SETTINGS.html` | plain | 400 | `KEEP` — already built the new way |
| `SPECS.html` | plain | 594 | `KEEP` — already built the new way |
| `STANDARDS.html` | plain | 467 | `KEEP` — already built the new way |
| `SaveBox.dc.html` | DC | 59 | `ORPHAN` — linked from nothing |
| `index.html` | plain | 214 | `KEEP` — already built the new way |

`MODEL.dc.html` is linked from six pages and is the app. `LAYOUT.dc.html` from
one. The two orphans are the last of the original Replit scaffold and are
item 9 on the deep-clean list — investigate, do not delete: a page reached by
bookmark is not an orphan.

---

## Modules

**`PORTABLE`** — already loaded by at least one plain page, so it is proven to
work outside DC. Nothing to prove; it just gets referenced by a new page too.

**`MOVES`** — only DC pages use it today. Not a problem with the module, just
untested outside. These are the ones the review gate is really for.

| module | lines | used by | status |
|---|---|---|---|
| `areas.js` | 127 | MODEL | `MOVES` — only DC pages use it |
| `auto-dims.js` | 326 | MODEL | `MOVES` — only DC pages use it |
| `auto-stair.js` | 567 | MODEL | `MOVES` — only DC pages use it |
| `auto-windows.js` | 304 | MODEL | `MOVES` — only DC pages use it |
| `bone-sound.js` | 120 | MODEL, index | `PORTABLE` — a plain page already uses it |
| `bone-wallet.js` | 110 | MODEL | `MOVES` — only DC pages use it |
| `build-house.js` | 300 | MODEL | `MOVES` — only DC pages use it |
| `closets.js` | 356 | MODEL | `MOVES` — only DC pages use it |
| `cut-view.js` | 1,444 | LAYOUT, MODEL | `MOVES` — only DC pages use it |
| `drawing-format.js` | 997 | LAYOUT, MODEL, PROJECT, SPECS | `PORTABLE` — a plain page already uses it |
| `electric-rules.js` | 179 | MODEL | `MOVES` — only DC pages use it |
| `electric-symbols.js` | 111 | MODEL, SPECS | `PORTABLE` — a plain page already uses it |
| `fen-labels.js` | 103 | MODEL, STANDARDS | `PORTABLE` — a plain page already uses it |
| `first-run.js` | 151 | **nothing** | `READY` — written, tested, never wired |
| `formatters.js` | 130 | LAYOUT, MODEL, PROJECT | `PORTABLE` — a plain page already uses it |
| `geometry-2d.js` | 756 | LAYOUT, MODEL | `MOVES` — only DC pages use it |
| `gruff-drivethru.js` | 156 | MODEL | `MOVES` — only DC pages use it |
| `gruff-interview.js` | 519 | MODEL | `MOVES` — only DC pages use it |
| `layer-views.js` | 66 | LAYOUT, MODEL | `MOVES` — only DC pages use it |
| `layout-plan.js` | 278 | LAYOUT | `MOVES` — only DC pages use it |
| `orientation-guard.js` | 98 | LAYOUT, MODEL, PROJECT, SETTINGS, SPECS, STANDARDS | `PORTABLE` — a plain page already uses it |
| `pdf-scan.js` | 185 | MODEL | `MOVES` — only DC pages use it |
| `profile-manager.js` | 483 | LAYOUT, MODEL, SETTINGS, STANDARDS | `PORTABLE` — a plain page already uses it |
| `project-page.js` | 245 | PROJECT | `PORTABLE` — a plain page already uses it |
| `render-2d.js` | 591 | LAYOUT, MODEL | `MOVES` — only DC pages use it |
| `room-grow.js` | 517 | MODEL | `MOVES` — only DC pages use it |
| `room-standards.js` | 129 | MODEL, STANDARDS | `PORTABLE` — a plain page already uses it |
| `shared-file-store.js` | 190 | LAYOUT, MODEL, PROJECT, SPECS | `PORTABLE` — a plain page already uses it |
| `spec-master.js` | 706 | SPECS | `PORTABLE` — a plain page already uses it |
| `spec-pages.js` | 72 | SPECS | `PORTABLE` — a plain page already uses it |
| `stair-rules.js` | 395 | MODEL | `MOVES` — only DC pages use it |
| `support.js` | 1,911 | *the DC runtime* | `LAST` — deleted when the last `.dc.html` goes |
| `titleblock.js` | 363 | LAYOUT | `MOVES` — only DC pages use it |
| `tour.js` | 216 | MODEL, SETTINGS | `PORTABLE` — a plain page already uses it |
| `toy-constraints.js` | 525 | MODEL | `MOVES` — only DC pages use it |
| `toy-context.js` | 199 | MODEL | `MOVES` — only DC pages use it |
| `traffic-counter.js` | 63 | LAYOUT, MODEL, PROJECT, SETTINGS, SPECS, STANDARDS, index | `PORTABLE` — a plain page already uses it |
| `turtle.js` | 149 | MODEL | `MOVES` — only DC pages use it |
| `wall-types.js` | 30 | LAYOUT, MODEL | `MOVES` — only DC pages use it |

---

## Review status

**Nothing has been reviewed yet.** Under the moving-house rule in
`PLAN-new-app.md`, a module is read before a new page references it, and gets
one of three verdicts: *right as it is*, *right but unclear*, or *wrong* — and
a wrong one is fixed in the **old** app first, because that is where it runs.

Record each verdict here as it happens, with the PR that did it:

| module | verdict | PR | note |
|---|---|---|---|
| — | — | — | nothing reviewed yet |

---

## What is waiting on what

| | |
|---|---|
| **ENTRY page** | **nothing.** The ceremony carries a bedroom count, not a size — `gruff-interview.js` already supplies the defaults. It can start now. |
| **new MODEL page** | nothing — `render-2d.js` and `drawing-format.js` are both `PORTABLE` and ready |
| **BONEYARD** | MODEL space existing first; page-or-mode is undecided and does not block the three pure modules |
| **`dc-runtime/` source** | the Replit project. Not urgent — `support.js` is readable and has never needed a change in 782 commits. |

---

## The one number that matters

`MODEL.dc.html` is **22,467 lines**, of which the class is 20,007 and 80% of
that is live-state code — tools and keyboard, which stay together in any
framework. That is the long part, and it is the last part.

Everything above it in this document is smaller than it looks.

---

## TIER 1 IS BUILT — and the page half finally has a number

`MODEL.html` exists at root, **329 lines**, and it does exactly one thing: it
reads the drawing `MODEL.dc.html` saved and paints the walls with the same
`render-2d.js` painters, with React and the DC runtime absent. It reads and
never writes, so it cannot cost anyone a drawing. `index.html` still points at
the old page and nothing about the live site has changed.

Four specs in `tests/model-html-tier1.spec.js`, all green, and the ink
assertion is mutation-proven in both directions.

### What tier 1 cost, against what was guessed

The page half of the 6–10 week estimate had **no measurement behind it at all**
— fifteen thousand stateful lines nobody had tried to move. It now has one data
point, and the point is smaller than feared:

| | |
|---|---|
| estimated for tier 1 | 2–3 days |
| actual | one sitting |
| dependencies needed | **four** — `shared-file-store`, `wall-types`, `drawing-format`, `render-2d` |
| three.js needed | **none** |

The reason is one fact worth generalising: **`render-2d.js` reaches for zero
globals.** Every outside thing it needs arrives in an `env` object, so the wall
painter cost exactly one dependency (`wall-types.js`) rather than dragging the
component behind it. `MODEL.dc.html` calls those four painters from only **four
sites in 22,467 lines**.

The one real substitution: MODEL's live `_toScreen` projects through a
**three.js camera**, and tier 1 does not. The painters take `toS` as a
parameter and never ask where it came from, so plain arithmetic pan/zoom
satisfies them completely. Whether the 3D views can make the same substitution
is untested and is NOT implied by this result.

**This does not yet shorten the estimate.** Walls are the friendliest thing on
the page. Tools, keyboard and live state are the 80%, and none of it is
touched. What tier 1 establishes is only that the pure modules cross over
cleanly — which was the optimistic assumption, now checked once instead of
hoped.

### LOAD ORDER IS LOAD-BEARING — read before writing any new page

**Corrected 2 Sep, twice.** The first version of this section said *eight files,
eleven captures*. My own sweep had actually produced **seven files and ten**, and
I overstated it; then Gilligan swept independently, and checking his numbers
against mine exposed a second, larger error — my pattern matched only
`const X = window.Y` and was blind to **destructuring**, which missed a whole
file. Two mistakes pointing opposite ways, which is why the wrong total looked
plausible. The measured answer:

**8 files, 13 captures — 10 plain, 3 destructured.**

| file | plain | destructured | depends on |
|---|---|---|---|
| `auto-stair.js` | 1 | — | geometry-2d |
| `build-house.js` | 1 | — | geometry-2d |
| `cut-view.js` | 1 | 2 | geometry-2d, wall-types, formatters |
| `first-run.js` | 1 | — | gruff-interview |
| `layout-plan.js` | — | 1 | wall-types |
| `room-grow.js` | 1 | — | geometry-2d |
| `toy-constraints.js` | 3 | — | geometry-2d, wall-types, room-standards |
| `toy-context.js` | 2 | — | geometry-2d, toy-constraints |

**The two shapes fail differently, and the difference matters:**

```
const { WALL_TYPES } = window.DraftWallTypes;   throws AT LOAD --
                                                 "Cannot destructure property
                                                 'WALL_TYPES' ... is undefined",
                                                 naming the property and file

const geo = window.DraftGeometry2D;             SILENT at load. geo is
                                                 undefined; the module loads
                                                 fine, exports fine, and throws
                                                 later at a call site that looks
                                                 unrelated
```

So the destructured three are the **safer** pattern despite being on this list.
The ten plain ones are the hazard, because the error surfaces far from its cause.

**A false positive worth naming, so nobody re-files it:** `room-grow.js:108` is
`window.DraftRoomStandards ? ... : null` **inside** `seedFor` — resolved at call
time and guarded. Exemplary, not a hazard. `room-grow.js:7` is the real capture.

### Verified against both live pages — all 15 edges ok

Neither `MODEL.dc.html` nor `LAYOUT.dc.html` is broken today. But both are by
growth rather than design, and there are **two one-line near-misses**:

| page | consumer | needs | gap |
|---|---|---|---|
| `MODEL.dc.html` | `toy-context.js` (16) | `toy-constraints.js` (15) | **adjacent** |
| `LAYOUT.dc.html` | `cut-view.js` (11) | `formatters.js` (10) | **adjacent** |

**Any new page must load these first:**

```
geometry-2d.js, wall-types.js, room-standards.js, formatters.js   BEFORE
  auto-stair, build-house, cut-view, room-grow, toy-constraints, layout-plan
toy-constraints.js    BEFORE  toy-context.js
gruff-interview.js    BEFORE  first-run.js
```

None of tier 1's four modules is on this list — checked with the corrected
pattern, not assumed.

The durable fix is to resolve these lazily inside the functions instead of at
module scope. That is a change to the **old** app and belongs to the review
gate, not to the new page.

---

## THE SCOPE SEAM — the most-shared modules are the least-reviewed

Found 2 Sep while reconciling two independent capture sweeps that disagreed.
The disagreement turned out not to be an error on either side: we were counting
in **different scopes**, and both numbers were right for their own question.

| scope | files | captures |
|---|---:|---:|
| the gate's seventeen | 6 | 9 |
| repo-wide, plain `const X = window.Y` only | 7 | 10 |
| **repo-wide, all shapes (incl. destructuring)** | **8** | **13** |

The review gate's rule is *"loaded by `MODEL.dc.html` and by nothing else"* — a
sound criterion, and chosen for a good reason: nothing outside MODEL has ever
exercised those modules, so they carry the highest risk of untested drift.
`cut-view.js` (MODEL **and** LAYOUT) and `layout-plan.js` (LAYOUT only) are
correctly outside it. Neither is an oversight.

**But the inverse of that criterion is the seam.** Of 38 modules at root:

| | count | reviewed by the gate |
|---|---:|---|
| loaded by exactly 1 page | 22 | 17 of them |
| **loaded by 2+ pages** | **14** | **none — by definition** |
| loaded by no page | 2 | `first-run.js` only |

The fourteen shared modules are the load-bearing ones:

```
shared-file-store.js   5 pages      formatters.js        3 pages
drawing-format.js      5 pages      render-2d.js         3 pages
profile-manager.js     4 pages      wall-types.js        3 pages
cut-view.js, geometry-2d.js, tour.js, layer-views.js,
room-standards.js, bone-sound.js, electric-symbols.js,
fen-labels.js                       2 pages each
```

A defect in any of these hurts more pages than a defect in any of the
seventeen, and none of them has a gate.

### And this is not abstract: tier 1 is built entirely on the ungated half

| tier 1 dependency | pages | in the gate |
|---|---:|---|
| `shared-file-store.js` | 5 | **no** |
| `drawing-format.js` | 5 | **no** |
| `render-2d.js` | 3 | **no** |
| `wall-types.js` | 3 | **no** |

Four for four. `MODEL.html` reads and never writes, so nothing here is urgent —
but every later tier writes, and `shared-file-store.js` is the module a write
goes through on five pages.

**Suggested, not decided:** the natural next gate batch is those four, in that
order. They are the shared core, they are what the new page runs on, and
`render-2d.js` is already known to reach for zero globals — which is the
strongest evidence yet that a *reviewed* shared module carries across cleanly.

The four captures outside the gate (`cut-view.js` ×3, `layout-plan.js` ×1) are
recorded above and belong to whoever reviews the shared fourteen.
