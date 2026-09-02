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

**Ten of seventeen reviewed.** Under the moving-house rule in
`PLAN-new-app.md`, a module is read before a new page references it, and gets
one of three verdicts: *right as it is*, *right but unclear*, or *wrong* — and
a wrong one is fixed in the **old** app first, because that is where it runs.

This table is the **index**. The reasoning, the measurements and the controls
behind each verdict live in `RD-DOCUMENTS/MODULE-REVIEW-GATE.md` — one record,
two levels, not two homes.

| module | verdict | note |
|---|---|---|
| `auto-dims.js` | right as it is | names its caller's duty in its own header |
| `stair-rules.js` | right as it is | labels every number's provenance; §9 checklist still unworked |
| `pdf-scan.js` | right but unclear | negative-scale guard lives in `MODEL.dc.html:3335`; harness added |
| `areas.js` | right but unclear | returns 0 for a crossing outline; audit M6, now CONFIRMED reachable |
| `build-house.js` | right but unclear | load-order capture — **fixed**, resolves at call time |
| `auto-stair.js` | right but unclear | load-order capture — **fixed** |
| `room-grow.js` | right but unclear | capture was dead — **removed** |
| `toy-constraints.js` | right but unclear | three load-order captures — **fixed** |
| `toy-context.js` | right but unclear | two captures — **fixed**; was one line from breaking |
| `first-run.js` | right but unclear | capture — **fixed**; script-tagged nowhere, so it armed on first use |
| `auto-windows.js` | not read | |
| `bone-wallet.js` | not read | no harness yet |
| `closets.js` | not read | |
| `electric-rules.js` | not read | |
| `gruff-drivethru.js` | not read | no harness yet |
| `gruff-interview.js` | not read | |
| `turtle.js` | not read | |

**The gate's finding so far:** eight of ten are *unclear* for one reason —
correct in the app, and held up by something outside the module that the module
does not mention. That is the answer to "can this cross over as-is": mostly
yes, but not on its own.

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
