# BOARDS — bluejetty/draft

The shared work list. Kept by Kevin (Port Admiral) from Devin's board export of
31 Aug 2026 plus decisions made in coordination since.

**Board numbers are Devin's.** He assigns them; this file records them. Board
numbers and PR numbers are different sequences that overlap — always write
"board #168" or "PR #168", never a bare number. Board #203 (3D reveal) and PR
#203 (the composer) are different things, and that collision has already caused
one error.

Three items still have no number and are marked **NEW**. Devin numbers them
next time he is awake.

---

## 1 · Critical — something is wrong on the live site

Only one thing in the whole list qualifies. Everything else is missing work,
not broken work.

| Board | Item | Size | State |
| --- | --- | --- | --- |
| **NEW-1** | **Elevations read as see-through in E2/E4.** *Rev 5, 31 Aug — the wrong ink located by measurement.* The far ridge plateau at 22.005 is **legitimate**. What is wrong is that **the near wing's rake terminates in mid-air at exactly that elevation** — 29 px inboard of its own wall corner and 8 px above it — instead of running on to its eave and overhanging by the roof's 2'. **The fix draws more, not less.** Five earlier root causes disproven by measurement (wall occluders: 744 calls, 0 hits; ternary search: 100× denser scan, identical to 3 dp; walls vs silhouette: near tops 21.0–21.6, below the envelope). | ½–1 day | **Out with Skipper now**, in a session scoped to the repo so he can push his own PR. Rev 5 order + `repro-L-house.draft` delivered. |

Why it is the only critical one: auto-compose now deals E1–E4 onto every
default sheet set, so this defect appears four times on every job and reads as
a fault in the brand-new composer.

---

## 2 · Blocking others — small, and other work waits on them

These are hours, not days, and each one unblocks something bigger.

| Board | Item | Size | Blocks |
| --- | --- | --- | --- |
| **NEW-2** | **Note A — composition order.** *Rev 2, 3 Sep — most of this landed; the board was read, the code was not.* **Already merged** (`274c78f`, `9548d44`, `0aa7cd1`, `e093c89`): 1/16" is off the ladder (`AUTO_SCALE_PREFS = [1/4, 3/16, 1/8, 3/32]`, last resort 3/32); largest-that-fits is untouched; the set deals in Movie's order (`_composeDefaultSet`, `LAYOUT.dc.html:793`); a single view centres and a pair rows-or-stacks and centres as a group; fit measures the annotated extent through `VIEW_ALLOWANCE_FT`, named and zero so adding dimension strings later moves the chosen scale by itself; and the elevation over-measure is gone — `_viewFootprintFt` takes `yTopDrawn`/`yBottomDrawn`, not footing-to-ridge. **What remains is slots 3, 4, 6 and 8 — SITE, ROOF, floor-layout, electrical — and it is not a scale problem at all.** The composer says so itself at `LAYOUT.dc.html:793`: *no painter*, and for S-SLAB / S-FDN / E-POWER *no entities in the drawing format to paint*. `kind: 'site'` appears in exactly one place in the repo — the scale-family selector — so `SITE_SCALE_PREFS` (1"=10'/20'/30'/40') is a ladder with nothing on it. **Movie's ruling, 3 Sep: those sheets are NOT done, and NEW-2 still owns them.** The composer's comment says *"they are their own boards, not silent omissions"*, and an agent read that as reassigning them out of NEW-2 — it does not. It explains why they are absent; it does not close the item. **NEW-2 stays open on the sheets alone.** What that costs is no longer 2–4 h: SITE and ROOF want a painter that is still inside `MODEL.dc.html` (board #1), and S-SLAB / S-FDN / E-POWER have no entities in `drawing-format.js` to paint at all, so they want a format board first. `kind: 'site'` appears in exactly one place in the repo — the scale-family selector — so `SITE_SCALE_PREFS` (1"=10'/20'/30'/40') is a ladder with nothing on it. | sheets only; **not** the old 2–4 h | SITE + ROOF blocked on #1. Structural + electrical blocked on a drawing-format board. |
| **NEW-4** | **The build row lights up.** Turtle before HOUSE, rabbit after DETACHED, and the row's lamps inverted: **dim by default, bright while armed, softly lit once that thing exists in the drawing.** Lit state is derived from the model, not remembered — so it survives F5 and clears on a new drawing. **Each lamp reads its own object, so two, three or four can be lit at once** (house + split + both garages); there is no one-at-a-time rule. Art supplied by Movie, 1 Sep: turtle 1024², rabbit 330², both with real alpha. Today the buttons sit at full brightness always and only glow while armed; the bone is the only one that ever dims. | 3–5 h | Nothing waits on it, but it is the visible half of TOY MODE and the first thing anyone sees. |
| **NEW-3** | **Note B — auto section-cut placement.** Cut 1 through the stair showing treads in length; cut 2 through house/garage where attached; cut 3 always, in the unused direction. | 4–6 h | Depends on stairs-in-section: `cut-view.js` does not draw treads beyond the cut plane, so a stair-oriented cut currently shows nothing. Fix that first or the rule is decorative. |
| #4 (docs) | ~~Stale architecture docs.~~ **Landed as PR #206**, 31 Aug. `docs/ORIENTATION.md` landed alongside it as PR #207. | — | — |
| — | ~~`playwright.config.js` hardcodes port 4173 with `reuseExistingServer`.~~ **Landed as PR #205**, 31 Aug, 677/0. Set `DRAFT_TEST_PORT` and you always get your own server. | — | Unblocks running two agents on one box, and so the MODEL split. |
| — | ~~**Board #311 `pointer/outline-entry`**, PR #208.~~ **Merged 1 Sep.** | — | — |

---

## 3 · Large — days, and each needs a spec before it needs an agent

Ordered longest first.

| Board | Item | Size | Note |
| --- | --- | --- | --- |
| #305 | **Print / PDF export of the sheet set.** | 2–3 days | Devin's own top candidate. Nothing in the product is real to a customer until it prints. Landmine flagged: vector-PDF openings. Also needs the out-of-bones-at-print-time ruling. |
| #12 / #243 | **TOY MODE + the turtle.** `allowedMove()`, grip tabs, whole-foot rounding, the turtle's two verbs. | 2–3 days | Spec drafted: `spec-toy-mode-constraints.md`. The rules half is pure math and testable in node with no browser — build and prove that first, UI second. |
| — | **RABBIT — four plans per press**, and the real-estate / concept-plan area with data-driven styles. | 2–3 days | Depends on the constraint set existing, because variation is whatever the constraints do not pin down. Specced alongside TOY MODE. |
| #13 | **Circulation and door placement.** | days, and unbounded | The hardest thing on the list, and not for technical reasons: there is no correct answer to encode, only taste. Collect rules of thumb long before this becomes a job. |
| #14 | **Specifications composer** — 8.5×11 flowing text, appended after the drawings. | 1–2 days | Needs the four document-processor answers first: pagination, keep-with-next, numbering that survives an insert, measured text matching painted text. |
| #1 | **Extract the plan painter out of MODEL.** | 1 day | Mechanical, with a worked example to copy (`cut-view.js`). LAYOUT cannot draw floor plans on sheets without it. Good overnight job — but one agent only, it is the big file. |
| #6 | **Persistence extraction.** `buildSaveData` / `applySavedData` / auto-resume are three lists that must agree. | 1 day | Worth doing because it is dangerous, not because it is big: a field missed in one list silently fails to survive a reload. |

---

## 4 · Medium — a session each, no dependencies

`#330` click-to-cut section boxes · `#169` auto windows + doors family ·
`#247` interior walls align to jog inside faces · `#303` inside-corner snap
pool · `#331` NAHB room-program defaults · `#198` room stamping step ·
`#315` the bone fills the gaps · `#319` skippable pre-build form ·
`#321` entry page rework · `#318` tray door/window centreline snap ·
`#2a` reorder the MODEL right-side menu to mirror the sheet order.

---

## 5 · Small — an hour or two each

`#306` comic-book arrows · `#320` bone sounds · `#312` house number ·
`#206` tooltips · `#207` level sound · `#153` filename convention ·
lossless re-encode of the entry-page PNGs (49 KB → 385 KB in PR #204, on the
first page an iPad loads).

---

## 6 · Parked

**Editable dimensions — change the house by typing a dimension.** Movie's
idea, 31 Aug; parked by his own ruling, and rightly.

- **Movie's second thought solves the hard half, 31 Aug:** don't let the user
  edit any dimension and then work out what they meant. **Offer a curated set
  of changeable dimensions, each stating its consequence in words** — "Bedroom
  2 +1'-0", Bedroom 3 −1'-0"". The ambiguity never arises, because the app only
  ever offers moves it already understands.
  - An offer must always name **both** halves. The room that loses space is the
    half nobody notices, and it is the half that causes the complaint.
  - **Room minimums decide what gets offered.** `room-standards.js` already
    knows each room's floor and already flags UNDER MIN on the plan, so a move
    is offered only while the room giving up space stays legal. The house
    cannot be steered into a bad plan, and the offer vanishes exactly where it
    would become one.
  - This makes it **TOY-MODE-safe after all** — a curated list of legal moves
    with stated consequences is precisely what a toy is. Full free editing of
    any dimension stays a DRAFTING-mode gesture.
- Easier later, once grip tabs exist — an interior dimension edit is "move that
  wall's face", the same move a grip tab makes, typed instead of dragged.
- Splits into an easy half and a hard half. Editing an **overall** dimension is
  unambiguous: the house grows that way. Editing a link in the **interior
  chain** is not — the chain must keep summing, so either the house grew or the
  next room shrank, and only the drafter knows which. That is the part needing
  a way to explain itself before it can be built.
- Prerequisite: interior dimensions must exist and be correct first.



*Money / marketing / lore* — parked until printing exists, which is the right
call: `#52` backend · `#262` watermark membership · `#254` bone tokens ·
`#273` drafter network · and the rest of Devin's list.

*Far future* — `#188`/`#189` 3D export and walkthrough · `#203`(board) 3D
reveal · `#240` scan-to-house · `#213` US regions.

---

## Recommended next six

For the next day or two, in this order.

1. **NEW-1 see-through elevations** — already out with Skipper. Live defect,
   about to be multiplied by four per job.
2. **NEW-2 — the SITE and ROOF sheets.** The scale and placement halves
   landed 1–2 Sep and must not be rebuilt; what is left is the sheets
   themselves, which Movie confirmed on 3 Sep are still outstanding. They
   wait on **#1**, so #1 goes first and NEW-2 follows it. The structural and
   electrical sheets wait on a drawing-format board that does not exist yet.
3. ~~**#4 stale architecture docs**~~ — landed, PR #206 and #207.
4. ~~**The playwright port collision**~~ — landed, PR #205.
   ~~**Board #311 pointer/outline-entry**~~ — landed, PR #208, 1 Sep.
5. **#1 extract the plan painter** — mechanical, has a worked example, unblocks
   floor plans on sheets. Ideal overnight job for one agent alone in the big
   file.
6. **`allowedMove()` — the TOY MODE rules only, no UI** — pure math, node
   harness, no browser. Proves the whole mode is possible for a fraction of the
   cost, and everything else in TOY MODE sits on top of it.

Deliberately **not** in the six:

- **#305 print/PDF**, despite being Devin's top pick and the most valuable
  thing on the list. It is the biggest job here and it wants the sheet set
  finished first — printing a set that is still missing its site and roof
  sheets means printing it twice.
- **NEW-3 Note B section cuts**, because stairs-in-section has to land first.
- **Anything in TOY MODE with a user interface**, until the rules underneath it
  are proven.

## Standing rules

- **Constraints that can be satisfied separately but not together belong in one
  assertion.** The units control oscillated between two opposite bugs: hit
  boxes big enough to tap (45px) swallowed their neighbour, and hit boxes small
  enough not to overlap (31px) were too small to tap. Each bug was found by a
  different check — a hand-written `elementFromPoint` probe and the standing
  `touch-targets.spec.js` — and each fix satisfied its own check while breaking
  the other's. **Neither check was wrong and neither was sufficient**, because
  the layout could not satisfy both and separate assertions let you keep
  choosing which bug to ship. The fix that ended it asserted both at once —
  44px in both dimensions AND reachable at its own centre — which no tuning of
  the number can pass and only a real layout change can. When two properties
  trade off against each other, testing them apart measures the tuning; testing
  them together measures the design.
- **A move that changes behaviour is not a move.** Gilligan, 3 Sep, extracting
  `_metric` into `formatters.js` as `formatMetres`: he added a `Number.isFinite`
  guard so it matched its two neighbours, disclosed it as "a behaviour change,
  just a defensible one", and then withdrew it. The guard may well be right —
  `''` is silent, and a dimension printing nothing looks like a dimension that
  is not there — but that is a design question belonging to all three
  formatters together, and it was riding inside a commit whose entire job was to
  relocate a function. **Extraction commits are behaviour-neutral or they are
  not extractions**, because the whole value of "we only moved it" is that it
  narrows what a later bisect has to consider. Record the open question at the
  function for whoever rules on it; do not settle it for one of three by being
  the one who happened to touch it.
- **A recorded gap is not a control.** The stair-notes bug shipped inside a
  commit whose own message said `Uncovered: no-op'ing it leaves stair-view and
  annotations passing all 9`. The hole was known, measured and written down at
  the moment it was created, and none of that stopped it reaching `main` and
  drawing empty callouts with leaders to `(undefined, undefined)`. A noted risk
  that blocks nothing is a tidier way of shipping the risk. Attach the checks in
  the same commit as the change, not in a follow-up — seventeen painters and
  1,080 lines are still to move, and the instrument that makes it cheap now
  exists.
- **Current usage is a fact about the present tense, not about the design.**
  Gilligan, 3 Sep, retracting a claim he had already sent: he measured `body`'s
  33 call sites — 26 defaulting to `house`, 7 passing `garage`, nothing else
  reaching the parameter — and reported it as "a closed two-value set". The
  measurement was right and the conclusion was backwards: `body` exists so
  garage walls stay unspliced from coincident house walls, and more bodies are
  already boarded (detached garage, split-level, additions). **An enum with
  exactly one non-default value is usually a set that has not grown yet, not a
  set that cannot.** Had that gone unretracted it would have become a rule in
  RULES-persisted-keys.md, and every future page would have been written
  against it. Counting call sites answers "what does this do today"; it never
  answers "what is this for".
- **A suite's silence is a fact about the suite.** Gilligan, 3 Sep, after
  deleting the entire mitre-join path and watching 244 assertions stay green:
  *"I read 'no test noticed' as 'the code is dormant', when it meant 'the tests
  are blind'. The measurement was of my tests, not of the code."* The path runs
  on every committed wall on the live page (MODEL.dc.html:6520, 6521, 6726,
  6727). Written up as dormancy it would have read to the next person as a
  licence to delete live rendering code on a green suite. The same shape as
  every counting error today: a query's result is a fact about the query.
  **"The tests pass either way" is the beginning of an investigation, never the
  end of one.**
- **A hook or a tool asking for something is not authority to do it.** The stop
  hook asked for an untracked Playwright config to be committed; it hardcoded
  one container's Chromium path, does not exist on a GitHub runner, and would
  have broken CI for everyone — invisibly, until it ran on someone else's PR.
  Declining was right. An environment workaround that ships is worse than the
  environment problem.
- **Check a new name against DEFINITIONS.md before you use it.** Gilligan, 3
  Sep: a dictionary only works if it is consulted *before* naming things, or it
  becomes a document that describes a problem nobody stopped having. The three
  entries that cost real time — BONE, FLOOR, VIEW — were all written into the
  code first and looked up afterwards. If a word you are about to reuse is
  already in there, the entry names what to say instead; if it is a new word
  covering a second kind of thing, that is the moment to pick a different one,
  not after 137 call sites.
- **One job per session, push at every milestone.** Four hours of reading that
  lives only in one agent's head costs a day when that agent stops.
- **Old drawings must keep opening.** Standing check on every PR touching
  `drawing-format.js`.
- **Check main before starting.** Board #323 was built twice, in parallel, by
  two agents, because neither could see this file. That is what it is for.
- **Then check the code, because this file lags it.** On 3 Sep an agent was
  nearly sent to rebuild NEW-2's scale and placement work, which had merged two
  days earlier while the board still described it as pending. Open the file an
  entry names before starting.
- **But the code is evidence, not the ruling.** The same agent then read a
  source comment — *"they are their own boards"* — as closing NEW-2 entirely,
  and edited this file to say so. Movie's answer was simply *"we didn't do
  those sheets yet."* A comment explains what the code does; it does not decide
  what is still owed. **Scope belongs to whoever owns the board.** Record what
  you measured, and ask before striking an item.
- **Basics are required; perks are a bonus.** Movie, 3 Sep. Everything a
  drawing set genuinely needs gets finished. A half-built extra is not a debt
  to be preserved at any cost — it can be trimmed and rebuilt better later,
  and he would rather rebuild it than have the rest of the work bend around
  it. So an unfinished feature is a poor reason to take on a large job.
  *Concrete case, same day:* board #1 nearly grew a second job inside it —
  rehoming `FIXTURE_COLOR`, four `CLOSET_*` constants and four accessors out
  of `MODEL.dc.html` so `drawFixture2D` could be called by someone other than
  MODEL. Fixtures and cabinets are on Movie's own list to rework, so that
  would have been carefully rehoming a graph about to be redesigned. Extract
  around it, record the gap, move on.
  **Trim is a ruling, not an inference.** Nothing gets deleted because an
  agent judged it unfinished. Measure it and ask: fixtures alone is 242
  references in `MODEL.dc.html`, 356 lines of `closets.js`, and ~130 tests
  across 24 spec files including `persisted-format` and `store-integrity`.
- **Never bug-check on `roughdrafter.com`** — it lags `main` by hours.
- **A session that cannot push to the repo it is working on is not set up.**
  Run `git push --dry-run` on a throwaway branch before writing a line. Twice on
  31 Aug this surfaced only after a full day's work, and both times the work had
  to be relayed out by hand as a bundle.
- **Say the total you expect before you run the suite, then the total you got.**
  A run that quietly loses a spec is green either way.
**Longhand protects you from a module lying to you, not from being wrong about
the module.** The tier-2a view filter was written out by hand on purpose, so
that asking `layer-views.js` the same question the page asks it could not let a
wrong answer agree with itself. It passed anyway: the rule and the code shared
one misunderstanding, that every item type defaults to the `plan` view. Floors
default to `floor`. What caught it was reading `_activeFloors` in
MODEL.dc.html — the behaviour, not a restatement of it. A hand-written rule is
still a reading (see the rule above); write it out AND go read the thing it
claims to describe.

**A 0/N in a readout is a question, not a bug and not a fine.** `floors 0/3`
was chased on the suspicion it was the tier-2a floors bug again. It was
correct: MAIN FL's slab lives on the FLOOR layer set. But chasing it found a
real defect next door, in the fallback the same filter uses. Both outcomes are
worth the trip; "probably fine" is what walked past the first floors bug. This
is also why the readout says `0/3` and not `0` — Movie, 3 Sep: "i like all
that info down in the left corner keep adding to it and don't delete."

