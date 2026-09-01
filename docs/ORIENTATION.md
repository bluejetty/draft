# Orientation — Rough Drafter

**Answering:** Kevin's questionnaire, 2026-08-31, against `main` at `f9faf7c`.
**From:** Skipper. Gilligan is answering separately and we did not compare notes.

Where I am **remembering** work I did, I say so plainly. Where I am **inferring**
from reading the repo just now, it is marked `[inferred]`. Where I have no
living memory at all, it says so — Kevin asked for that specifically, and it is
the honest signal for "this area has nobody watching it."

`ARCHITECTURE.md` already exists and covers the page map, the DC framework, the
MODEL anatomy, persistence and the BONEYARD flow. **I have not repeated it
here.** This document is the part that is not in the code: why things are the
way they are, what looks wrong and isn't, and where the bodies are.

---

## 1. The product

**1. Who is the user?**

A working residential drafter — the person who produces a permit set for a
house. Not a homeowner sketching, not a builder pricing. The evidence is in the
vocabulary the app refuses to simplify: layer names are AIA-style
(`A-WALL-EXT`, `S-COL-FOOTING`), walls carry real stud types, the room rules
speak in code minimums. A homeowner would not know what a heel height is; this
app asks.

The stated target device is an **iPad at a permit counter**, which is why four
boards this week were about touch. That is a real constraint, not a nice-to-have.

What works end to end today, well: trace an outline → BUILD HOUSE → a whole
shell with walls, floors, slab, footings, roof, auto-dimensions and auto-placed
stairs → LAYOUT sheets with a titleblock → print. That path is genuinely good
and it is the thing to protect.

**2. The golden path, and what is finished.**

`index.html` → MODEL → trace on the BONEYARD → the guided tour escorts you
foundation → main → second → rooms → roof → press the bone → the reveal →
LAYOUT → sheets → print.

- **Finished:** the outline/BUILD HOUSE path, levels, walls and openings, the
  roof pipeline, areas, auto-dims, LAYOUT sheets, titleblocks, printing, undo,
  the tour.
- **Half-built:** the interview (`#323`, both slices in flight this week —
  mine is the window, Gilligan's is the engine). Room growing landed recently
  and has already had a review-fixes PR (`#197`), so it is young.
- **Intention only:** the 3D phase. `ARCHITECTURE.md` has a "ground rules
  already decided" section for it and no code.

**3. The bone.**

The bone is the button that turns a traced outline into a whole house. The
metaphor is the dog: you give the dog a bone, the dog fetches you a house.

It is **mostly product with a play skin**, and the split matters:

- `build-house.js` — the actual generator. Pure, and the most valuable code in
  the repo. Entirely product.
- `bone-wallet.js` — you get 3 bones on a new browser, a press costs 1, they
  drip back over time. This is play *and* a real product decision: it stops a
  client mashing the button instead of thinking. Note the ruling encoded in
  `_pressBuildHouse`: a true no-op press is **free**, only a press that builds
  spends.
- **The reveal** — a successful press jumps the view to the E1 elevation and
  grows the house on screen. Pure theatre, and it is switchable off in
  settings (`boneReveal`), which is why anything that must happen on a build
  should key off the build result and *not* off the reveal. I learned that
  building `#323`.
- **The boneyard** — the scratch shelf where master outlines live, above and
  outside the levels. Product: it is how one edit ripples through every floor.

**4. `LORE/` and `ADVERTISEMENT/`.**

I grepped: **nothing in the code references either directory.** They are
creative, not load-bearing. `[inferred, but the grep is conclusive]`

They do constrain *tone*, though, and there is one hard rule that came at me as
a board number rather than a document: **`#195` — no borrowed trademarks, no
near-misses.** It applies to UI copy. When I wrote the drive-thru menu panel I
wrote original fast-food-shaped lines for exactly that reason. Treat `#195` as
binding on any user-visible string with a brand flavour.

**5. Non-goals — things already rejected.**

These cost someone real work to learn, so proposing them again is expensive:

- **A server.** Everything is client-side, offline, vendored. See Q23.
- **Cloud or AI at runtime.** `#323`'s order says it in as many words: the
  voice is the browser's built-in synthesizer, "no cloud, no AI, no network."
- **Randomness.** Deterministic everything. Any "random" flavour must be seeded.
- **PDF *import*** is built, works, and is deliberately unadvertised —
  different app, same ruling. `[inferred from the DZDocu sibling project's
  notes; treat as a soft memory]`
- **Voice command entry** — deferred to a later board (`#172`), explicitly out
  of scope on `#323`.
- **Strip redesign** — `#259` stands; do not rearrange the bottom strip.

---

## 2. Architecture

**6. A map of `MODEL.dc.html` (21,381 lines).**

The file has section banner comments (`// ─── Name ───`) and they are accurate.
`grep -n "^  // ───" MODEL.dc.html` prints the whole table of contents in one
go — do that rather than trusting this list to stay current. As of `f9faf7c`:

| lines | what |
|---|---|
| 1–1668 | markup: the template, all `sc-if`/`sc-for` |
| 1669–2399 | constants (tunables live here, above the class) |
| 2400–2853 | lifecycle + local persistence |
| 2854–3427 | INSERT photo/PDF underlays |
| 3428–5257 | settings and company-standards packages |
| 5258–5442 | **undo history** |
| 5443–7260 | init (Three.js, renderer, canvases) |
| 7261–8055 | STAIR workspace |
| 8056–8936 | levels, nested views, views |
| 8937–10165 | **generated sections and elevations** |
| 10166–10486 | world position / mouse |
| 10487–10753 | **pointer ownership** (one pointer at a time) |
| 10754–11029 | universal node grab |
| 11030–13431 | drawing tools (wall, floor, shape…) |
| 13432–14924 | areas, fenestration, fixtures, openings |
| 14925–15530 | roof tool and 2D renderers |
| 15531–15823 | inside-face corners, snap helpers, vertex pool |
| 15824–17205 | select/copy/trim/projection, chain endings, view nav |
| 17206–18842 | lines, columns/beams, auto-stairs, annotations, room tags |
| 18843–19192 | room growing |
| 19193–19775 | frozen-length ruler, cut drawing |
| 19776–20215 | keyboard, formatters |
| 20216–end | **`renderVals`** — the whole template binding |

The two places you will spend most of your time are `renderVals` (everything
the template can see) and the constants block (everything tunable).

**7. The DC runtime.**

`support.js` (1,911 lines). A `.dc.html` file is markup plus one
`<script type="text/x-dc">` block defining `class Component extends DCLogic`.
The runtime walks the markup, resolves `{{ }}` bindings from whatever
`renderVals()` returns, and handles `sc-if` / `sc-for` as control flow
(`support.js:487`, `DECK_CONTROL_FLOW_RE`).

Rules, and what breaks:

- **The class name is not negotiable.** `support.js:1708` errors with
  "must define `class Component extends DCLogic`". Rename it and the page is
  blank.
- **`renderVals()` throwing kills the render**, and the runtime reports it as
  `<name>.renderVals(): <message>` (`support.js:1088`). If a page goes blank
  after your change, look there first — a `?.` you forgot is the usual cause.
- **`sc-if` wants a `hint-placeholder-val`.** 103 of the 104 in MODEL carry a
  boolean. I shipped the one that carried a string and then changed it back —
  match the convention, it is not worth being the exception.
- **Camel-case event attributes** go through `sc-camel-*` (`support.js:297`),
  which is why you see `sc-camel-on-mouse-down` in some places.

I have written a lot *inside* this runtime and read very little *of* it. Treat
my account of support.js internals as `[inferred]`.

**8. Which modules are pure.**

I measured this rather than remembering it. Of the 20 top-level modules, **all
but two touch no DOM at all**:

- **Pure, node-loadable, safe to unit test:** `geometry-2d.js`, `formatters.js`,
  `room-grow.js`, `auto-stair.js`, `auto-dims.js`, `layout-plan.js`, `areas.js`,
  `build-house.js`, `drawing-format.js`, `room-standards.js`, `wall-types.js`,
  `fen-labels.js`, `titleblock.js`, `tour.js`, `project-page.js`.
- **Pure logic but needs a canvas 2D context passed in:** `render-2d.js`. Not
  DOM-dependent; it draws into whatever context you hand it.
- **Needs the page:** `pdf-scan.js` (2 DOM references), `profile-manager.js`
  (1, plus `localStorage`), `shared-file-store.js` (IndexedDB),
  `bone-wallet.js` (`localStorage`).

The convention is uniform and worth preserving: each module guards with
`if (!window.DraftXxx)`, wraps in an IIFE, and exports one frozen object. That
guard is what let me make `#323`'s stub stand aside for the real engine — it is
a genuinely useful property, not decoration.

**9. State and flow.**

`ARCHITECTURE.md` has "State vs. instance collections" and it is correct: the
drawing lives in **instance arrays** (`this._walls`, `this._floors`,
`this._roofs`, `this._lines`…), *not* in React state. `state` is for UI. This
trips people because it looks like a React app and the drawing is deliberately
outside React.

Everything that mutates the drawing funnels through **`_markUnsaved()`**. That
is the single most useful fact in this section: it is the autosave point, the
undo record point, and the thing to call after any new mutation.

MODEL and LAYOUT agree because they both read the same IndexedDB bucket through
`shared-file-store.js`. They do not talk to each other directly.

**10. Undo.**

**I did not build this and I have no memory of it** — PRs `#182`/`#184` are on
branches named `claude/undo-*` so a Claude did, but it was not this thread.
What follows is from reading `MODEL.dc.html:5258–5442` just now `[inferred]`:

It is **snapshots, not command objects**. `_recordHistory()` serialises the
whole drawing (`JSON.stringify(this._serializeDrawing())`) and pushes the
*previous* snapshot onto `_history.past`. It is called from `_markUnsaved`, so:

> **The rule for making a new action undoable is to route its mutation through
> `_markUnsaved()`. There is nothing else to do.** That is the whole contract.

Two guards you must not break: `_restoringHistory` (stops a restore recording
itself as a new change) and the identical-snapshot early return. Trimming is by
count (`HISTORY_LIMIT`) *and* by total characters (`HISTORY_MAX_CHARS`), which
tells me somebody hit a memory ceiling.

The Extend tool keeps its **own** single-step undo (`_undoExtend`) used only
when shared history is empty. That is an oddity, not a pattern to copy.

**11. Persistence.**

- **Format:** `drawing-format.js`, `VERSION = 1`. A drawing of any other
  version is **refused**, with `reason: 'version'` only if it is *newer* and
  `'invalid'` otherwise. There is no migration machinery — a bump means writing
  one.
- **Where:** IndexedDB, database `pdf-img-mgr-shared`, through
  `shared-file-store.js`. Records live in **buckets** (default `'active'`), and
  each bucket carries a **revision** under `` `${bucket}::rev` `` so a
  whole-bucket write can detect a concurrent change (`StaleWriteError`). I
  added that revision layer; before it, two writers silently clobbered.
- **localStorage** holds only preferences: `draft-bone-wallet` and
  `draft-active-package:<kind>` (settings/standards packages).

**The rule for adding a field:** add a reader in `drawing-format.js` that
tolerates its absence and returns a default. Old files simply lack it. The
matching trap is Q19 #3 below — there is a *third* field list you must also
update, and forgetting it is silent.

`num()` in `drawing-format.js` is worth reading (line ~14). It is strict on
purpose: `Number(value)` turned `null`, `''`, `[]` and `false` all into `0`, so
a damaged coordinate quietly became the origin and the entity loaded in the
wrong place. Now it rejects the entity into `skipped` and the load message says
so. **Do not loosen it.**

**12. `proto/`.**

Currently one file: `proto/room-grow-harness.js`. Kevin mentions a
gruff-interview harness — **not on `main` at `f9faf7c`**; that is Gilligan's
and still in flight.

**Yes, encourage this pattern, emphatically.** It is the answer to your 45-minute
problem. The harness fakes `global.window = {}`, `eval`s the pure modules in
order, and asserts against real geometry in node — no browser, no server. It
runs in under a second. Its own header states the division correctly: the
harness pins the *math*, the Playwright spec pins the *commit layer*.

Every pure module in Q8 could have one. Most don't.

---

## 3. Drawing and geometry

**13. Units and axes.**

- **World units are FEET**, as floats.
- **User-facing input and display is architectural inches** (`8'-1 1/8"`),
  converted at the edges by `formatters.js` —
  `parseArchitecturalLength` in, `formatArchitecturalInches` out.
- The plan is the **X/Z** plane; **Y is up** (Three.js convention). Screen-y
  increases downward and maps to +z in the top-down view.

Where it bites: **`* 12` and `/ 12` scattered at call sites.** You will see
`formatArchitecturalInches(this.state.wallBaseHeight * 12)` all over. Every one
of those is a chance to be off by a factor of twelve, and the compiler cannot
help you. When I built the entry ruler I kept everything in feet until the
final format call, and that is the habit to copy.

**14. The roof pipeline. Devin is right — confirmed, with a nuance.**

outline → skeleton → faces → plan → sections → elevations.

- **Sections are EXACT.** `MODEL.dc.html:9091`: each roof's face polygons are
  clipped by the cut segment, breakpoints only, straight between them, roofs
  merged as an upper envelope. The comment says "No sampling, so a diagonal cut
  is as clean as an axis-aligned one."
- **Elevations are SAMPLED** — `_drawElevationWorkspace2D` (~line 9370) walks
  `depthSteps` samples through `elevAt(k)`.

The nuance Devin's summary leaves out: the elevation sampler does **not** just
take the coarse best. It then **ternary-searches the bracket** around the best
sample (24 iterations, ~line 9455) because "the true peak (a ridge or hip)
usually falls between the coarse samples." So elevations are sampled but the
ridge height is recovered to near-exactness. If you ever see a silhouette
clipping a ridge, that search is where to look, not the step count.

**15. Snapping.**

The pool is built by `_collectActiveVertices()` (`MODEL.dc.html:15660`) and it
is a plain list: outline points, line/wall ends, pending chain points, floor,
shape, roof, surface-opening and outline points, beam ends, column and pile
centres, fenestration centres — plus, since `#189`/`#303`, **inside-face
corners of wall jogs**, minted fresh on every call.

Priority order lives in `_findPolarSnap` and the magnet code, not in the
collector.

**Known fragile,** and I hit this one personally: `_findPolarSnap` returns
`null` at **zero distance**, and the magnet deliberately excludes the vertex
being dragged. Together those meant a polar origin sitting exactly on the
dragged node vanished — the fix was an explicit `onOrigin` check comparing
against `_polarOrigin` within 0.001. If a snap "works everywhere except right
on top of the thing," that is the shape of the bug.

The fresh-minting of inside-face corners on every call is a performance smell
`[inferred]` — it is correct, but it is O(walls) inside a per-frame path.

**16. Walls, types, layers, standards — who wins.**

My reading `[inferred; I worked on `room-standards.js` and `fen-labels.js` but
never had to arbitrate between all four]`:

- `wall-types.js` — the catalogue of stud types and their real thicknesses.
  Authoritative on **geometry**.
- `room-standards.js` — room minimums and the room tray. Authoritative on
  **code compliance**.
- `fen-labels.js` — how an opening is *labelled*. Authoritative on **text**.
- `STANDARDS.html` — the editor UI over the company package, not a source of
  truth in itself.

They mostly do not overlap, which is why the question has no crisp answer. If
two ever disagree, the one the drawing *persists* wins by default, because
that is what old files carry.

**17. Auto-generation, and where each is known to be wrong.**

- **`build-house.js`** — outline → walls, floors, slab, footings. The mature
  one. I extracted it into a pure module and it survived that intact.
- **`room-grow.js`** — stamps → partition walls and room claims, plus the
  `#276` numbering ladder (BEDROOM and WC run house-wide, everything else
  per-floor). **Youngest and least settled** — it took a review-fixes PR
  (`#197`) the same week it landed. The harness in `proto/` exists because the
  math needed watching.
- **`auto-stair.js`** — places a stair that fits. Its own failure mode is
  honest: when nothing fits it says so and lets the build proceed rather than
  trapping the bone.
- **`auto-dims.js`** — dimension strings off the plan. On the roof level it
  strings the roof footprint for the truss designer.

**18. Where the real drafting knowledge lives.**

`room-standards.js` (minimums), `wall-types.js` (assemblies), `fen-labels.js`
(labelling conventions), and the layer names.

**Researched vs guessed: I cannot tell you, and that worries me.** I wrote the
room-minimums feature to a work order that gave me the numbers; I did not
source them, and nothing in the repo cites a code edition. If a real permit set
ever goes out on these, somebody who knows the local code needs to audit
`room-standards.js` against it. **That is the single most product-dangerous
unknown I am aware of.**

---

## 4. Traps

**19. What has actually bitten me — ranked.**

This is the answer Kevin asked to be longest, so it is.

**1. A new persisted field needs adding to THREE lists, and the third is
silent.** `buildSaveData`, `applySavedData`, and the auto-resume field list are
separate explicit enumerations. Add a field to the first two only and it
survives save-and-reopen but **vanishes on a plain reload**, with no error.
This is the trap I would bet money on catching the next person.

**2. Inserting a page/level anywhere but the end shifts everyone's content.**
Content lives in the DOM keyed by position while the list renders positionally,
so splicing hands each node to its neighbour and the last one falls off the
end. Anything inserting mid-list must snapshot `innerHTML` **by id** before the
`setState` and pour it back after.

**3. An overlay with `pointer-events:auto` over the canvas is a hole in the
app.** This one cost me seven red specs on `#323` two hours ago. The board
covered 720×435 and swallowed every press underneath — a dialog button, a node
drag, a pile copy. **Any new overlay must be `pointer-events:none` with only
its controls opting back in.** The suite caught it, but it was a product bug: a
real drafter would have been just as stuck.

**4. Custom properties do not fall back like ordinary properties.** The
redeclare trick — hex first, `color-mix()` second, trusting an old browser to
drop the second — **does not work for `--x` properties**. Their grammar accepts
almost anything, so the `color-mix()` line always wins the cascade and only
fails when something `var()`s it. Gate `color-mix()` behind
`@supports (color: color-mix(in srgb, red 50%, blue))`. This shipped broken to
a Windows 7 user.

**5. A finger has no hover, and half the app assumed hover.** The mouse
computes the snapped cursor on *move*; a tap has no move, so the first tap of a
session drew nothing. Fixed by running the move for a non-mouse press before
the press. Anything reading `_snapPt` inherits this.

**6. `speechSynthesis` is a read-only accessor on `Window`.** Assigning a stub
fails **silently** outside strict mode, so a test measures the real synthesizer,
counts zero, and reads as "the app never spoke." Use `Object.defineProperty`.
Same class of trap as any read-only web API you try to fake.

**7. Verify drag-and-drop with a REAL drag.** CDP `Input.dispatchDragEvent`
does genuine hit-testing; a synthetic `new DragEvent('drop')` dispatched at an
element bypasses it entirely and will pass while real drags fail.

**8. Click-away dismissal must check where the press STARTED.** A `click`'s
target is the common ancestor of mousedown and mouseup, so drag-selecting text
in a panel and releasing slightly outside closes it. Pair the click handler
with a mousedown guard. Reported as a box "closing randomly."

**9. The bone reveal can be switched off in settings.** Anything that must
happen on a successful build keys off the build result, never off the reveal.

**20. Load-bearing strings that can never be renamed.**

Beyond `roughdrafter` / `roughdrafter-band`:

- **Layer names**, persisted on every entity: `A-WALL-EXT`, `A-WALL-INT`,
  `A-DOOR`, `A-GLAZ`, `A-FL`, `A-FL-DECK`, `A-FL-FLOORING`, `A-FL-OPNG`,
  `A-ROOF`, `A-ROOF-OPNG`, `A-STR`, `A-STR-DECK`, `A-FIXT`, `A-CASE`,
  `A-ANNO-NOTE`, `S-BEAM`, `S-COL-FOOTING`, `S-FOOTING`, `S-FDN`, `S-SLAB`,
  `E-POWER`, `X-WALL-CUSTOM`.
- **Titleblock ids:** `bluejetty`, `roughdrafter`, `bluejetty-band`,
  `roughdrafter-band` (`drawing-format.js:731`).
- **Storage keys:** `draft-bone-wallet`, `draft-active-package:<kind>`, the
  IndexedDB database name `pdf-img-mgr-shared`, the bucket `active`, and the
  `::rev` suffix.
- **The profile package format string** `draft-profile-package`.
- **Footing ids** like `pile10`, and **view names** like `foundation`, which
  appear inside saved column records.
- **`version: 1`** in the drawing envelope.

**21. Specs I distrust.**

Honestly: **none, on flakiness.** I have run this suite perhaps a dozen times
end to end this week and I have not seen a flake — every red I have had was a
real defect or a genuinely wrong assertion of mine. That is unusually good and
worth saying out loud.

What is *slow* rather than flaky: `areas.spec.js`, `defaults.spec.js` and
`detached-garage.spec.js` each build whole houses and run 1.5–2 minutes. When
they fail it is usually a timeout, and the timeout is usually a symptom of
something blocking a click rather than of slowness.

`defaults.spec.js` deserves special mention as the **most valuable spec in the
suite**: it opts into nothing and walks the shipping configuration, which is
the only configuration no other spec runs.

**22. Currently broken or taped.**

- **`#323` ships without its art.** `assets/gruff-drivethru-board.png` is not
  committed — it has never reached me as a file. The board renders on coloured
  zones instead. Blocking, known, and mine.
- **The room-minimums provenance** (Q18). The most serious one.
- **`_collectActiveVertices` mints inside-face corners every call** `[inferred
  performance concern, not a known bug]`.
- **`EARLY_REVIEW.md` and `HANDOVER_FOR_DEVON.md` sit untracked in the repo
  root** in my working copies. Check whether they should be in `.gitignore` or
  committed; right now they are neither.

**23. `no-third-party.spec.js`.**

The rule: **the app must run with no network beyond the host it was served
from.** Everything is vendored — React, Three.js, pdf.js, mammoth, **and the
fonts**. The spec fails if any page requests any other host.

What forced it: **fonts**. The app waited on `fonts.googleapis.com` before it
painted (audit M2). That one dependency took the full suite from ~40 minutes to
**2.8 hours**. Self-hosting the fonts fixed both the offline story and the
suite. The spec exists so nobody reintroduces a CDN link for convenience.

Note `#193` recently dropped vendored `jspdf`/`pdf-lib` as unused — vendoring is
not a licence to accumulate.

---

## 5. Testing and the merge train

**24. The shape of a good test.**

Read `tests/helpers.js` first; it is the vocabulary. The important convention:

> **Assert against `savedDrawing(page)` — the drawing JSON read back out of
> IndexedDB — not against the DOM.**

A ruler that displays `12'-0"` and commits `11'-9"` passes every UI assertion
and fails the only thing that matters. Measure world coordinates.

The other conventions:

- Every file opens with a **prose header stating the behaviour it pins**. Read
  it before editing a test. Write one for a new file.
- `openModel()` seeds a 999-bone wallet and turns the newest default-ON
  features **off** so older specs still test what they were written to test.
  **A new default-on feature must be added to that list and opt back in from
  its own spec** — and `defaults.spec.js` is what covers the combination.
- Wait on **conditions**, not sleeps. If you need to know when an animation
  finished, publish the finished value in a data attribute and poll it — that
  is what `data-drivethru-line` is for on the board I just built.

**25. Is serial execution real?**

`README.md:30` says the config is deliberate and asks you not to add parallelism
without verifying repeatedly. Digging further: `workers: 1` came in with PR
`#50` ("quick wins") and I found no recorded incident behind it `[inferred]`.

My read of the actual risk, having just run four full suites:

- **Storage is not shared.** Each test gets a fresh browser context, and
  `openModel` clears IndexedDB and localStorage on the way in. Not a blocker.
- **The web server is a static file server.** Not a blocker.
- **The real constraint is CPU.** I measured this by accident: two suites in
  parallel on this box ran **105 specs each in ~35 minutes**, against **627 in
  46 minutes** running alone — parallel was **2.3× slower in aggregate**. If
  your CI box is similarly constrained, sharding will not buy what you expect;
  if it has real cores, it will.

**So: shard it, but shard across machines/containers rather than raising
`--workers` on one box, and measure before and after.** And there is one live
landmine: `playwright.config.js` hardcodes `PORT = 4173` with
`reuseExistingServer: !CI`. Two checkouts on one machine will **silently share
one server and test the wrong tree** — passing, against code you did not build.
Give each shard its own port.

**26. The merge bar.**

Full green, always, and the number stated *before* the run. The practice I was
taught here and now use unprompted: **predict the total (baseline + new specs)
out loud, then quote the actual line.** Landing on the predicted number is the
point — it proves nothing was displaced. A targeted run is fine while iterating
and never fine as the gate.

**27. Long-lived branches as `main` moves.**

The working method, not the theory, because I did exactly this today:

1. **Do not rebase early.** Finish the board on the base you started from and
   get it green there.
2. When `main` moves, find what is *actually* in it. My `pointer/ipad-polish`
   content landed under **Devin's** shas, not mine — so `git merge-base
   --is-ancestor` said "not in main" while the code plainly was.
3. Rebase with **`--onto`**, naming the old base explicitly, so only your own
   commits replay and already-landed work is skipped:
   `git rebase --onto origin/main <old-base> <branch>`.
4. **Verify the rebase was faithful rather than trusting it.** Diff the old
   commit's diff against the new one; they should differ only in line offsets
   and new context. This is cheap and it caught nothing today, which is how you
   want it.
5. **Re-run the full suite on each branch** and confirm your specs by name, not
   just the total — a matching total does not prove a spec was not dropped.

---

## 6. Process

**28. Where does the board list live? — `BOARDS.md`, in the repo root.**

This answer was "I don't know" when this document was written, which was the
honest answer at the time and the reason the file now exists. Read it before
starting anything: board #323 was built twice, in parallel, by two agents who
could not see each other.

What it is: the shared work list, ranked by urgency and by what blocks what,
with the recommended next few at the bottom and the standing rules after that.
Work orders still reach agents as uploaded markdown files relayed by a human;
`BOARDS.md` is the index those orders are cut from.

One thing that has already caused a mistake:

- **Board numbers and PR numbers are different sequences and they overlap.**
  Write "board #168" or "PR #168", never a bare number. Board #116 was the
  semantic cut views; PR #116 was the entry logo, unrelated — and a stale
  BRANCHING rule gated all restructuring on the wrong one of the two for
  months. There are **no GitHub issues on the repo**; board numbers are Devin's
  and only `BOARDS.md` resolves them.

**29. What makes a work order good.**

Yours are already good. Concretely, the things that help most:

- **A shape, then gates.** `#323` gave me six numbered parts and then a list of
  what the specs must cover. I could self-check against it.
- **Naming what is out of scope.** Genuinely saves work.
- **Naming the seam when another agent owns the other half** — "the engine is
  `window.DraftGruffInterview`, agree with Gilligan's order, don't improvise"
  is exactly right, and it let two agents build against each other blind.
- **Standing to resolve conflicts.** Devin gave me explicit standing to resolve
  order-vs-spec collisions by following reasoned intent and flagging it. That
  is the single most useful sentence anyone has put in an order, because the
  alternative is stalling or silently guessing.

What is noise: restating the repo's conventions I can read, and prescribing
implementation where the outcome is what matters.

**What was missing from `#323`:** the art it said shipped with it. And one
genuine ambiguity — "filling 70–80% of the upper screen" was unresolvable
between "of the viewport" and "of the band above the keyboard" until Devin
ruled. A sentence naming the denominator would have saved a round trip.

**30. In flight on my side.**

Nothing merged; everything below is committed locally and handed over as
bundles, **nothing pushed**:

- `pointer/touch-gestures` — two-finger pan/pinch + landscape lock. Rebased
  onto `f9faf7c`'s predecessor, **626 passed / 0 failed**.
- `pointer/outline-entry` — guided outline entry by finger (`#311`), stacked on
  the above. **633 / 0**.
- `gruff/drivethru-board` — `#323` UI slice. **623 / 0**, missing its PNG.

**You would collide with me in `MODEL.dc.html`**, specifically the pointer
plumbing, `renderVals`, and the overlay markup block. Devin is in `#168`
extracting the section/elevation painter into `cut-view.js` — that is the
9,000–10,000 line region, and it is the biggest pending collision in the repo.

**31. Things said once, never written down.**

- **Never push without an explicit yes**, and confirm the repo *and* branch
  first — there are two GitHub accounts (`bluejetty`, `dzmarkup`) with similar
  repos, and work has nearly landed in the wrong one.
- **Hand over a backup zip, not loose files**: changed files at their real
  paths plus a `git bundle` of unpushed commits.
- **Push to a branch; let the human merge the PR.** Never to `main`.
- **Never put a model identifier** in a commit message, PR body, code comment
  or anything else pushed to a repo.
- **`#195`** (no borrowed trademarks) and **`#259`** (strip stays as designed) —
  both reached me as bare board numbers with no document behind them.
- **`#161`'s type-ahead ruler is the canonical entry path.** Anything new that
  takes a length feeds it rather than parsing its own.

---

## 7. Five things for a competent stranger

**1. The drawing is not in React state, and everything that changes it goes
through `_markUnsaved()`.** Learn that one function and you have the spine of
the app: it is the autosave, the undo record, and the place your new mutation
must call.

**2. Assert against the saved JSON, never the DOM.** This is a drafting tool;
being *displayed* right and being *right* are different properties, and only
one of them is what a builder builds from.

**3. Anything you add on top of the canvas is `pointer-events:none` until
proven otherwise.** Overlays are how this app hurts itself. Mine cost seven
specs; it would have cost a drafter their AREAS dialog.

**4. Predict the suite number before you run it.** Baseline plus your new
specs, stated out loud, then quote the real line. It takes ten seconds and it
converts "the tests passed" into "nothing was displaced" — which is a different
and much stronger claim.

**5. The comments are load-bearing; read them before you tidy anything.** This
codebase records *why* at the point of the decision — why the ruler must not
take focus, why multicol was pulled, why the fonts are vendored, why `num()` is
strict. Nearly every trap in Q19 is already written down somewhere near the
code that contains it. The failure mode here is not ignorance, it is
confidence.

---

*Skipper, 2026-08-31, against `f9faf7c`. Corrections welcome — particularly on
Q10 (undo) and Q16 (standards precedence), where I am reading rather than
remembering, and on Q28, where I am simply in the dark.*
