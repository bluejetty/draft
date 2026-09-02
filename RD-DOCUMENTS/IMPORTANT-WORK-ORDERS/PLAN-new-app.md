# PLAN — the new app, one page at a time

Movie's order: **entry first, then bring MODEL over piece by piece, and the
boneyard after that.** This document is that order and the reasoning for it.

Not a rewrite and not a migration project. One page at a time, each shipping
on its own, with the old app running untouched the whole way.

---

## The one decision, and it is to decide nothing new

**No new framework.** Pages are built the way `index.html` and `STANDARDS.html`
already are: plain HTML, `<script src>` tags, one inline `<style>`, and every
piece of thinking in a `window.Draft*` module.

Six pages already work this way — `index`, `PROJECT`, `SPECS`, `STANDARDS`,
`SETTINGS`, and the plain half of the site — 2,597 lines of it, in production.
So this is not a new pattern being introduced. **It is the pattern the site
already has**, being used on purpose.

The comparison that mattered was never DC against React. It was DC against the
pages here that already do without it.

### And no home-made framework either

That is how you get a second DC: an in-house thing with no documentation that
one person understands. If a page ever genuinely needs templating, take a
public one. So far none of them do — `index.html` manages 214 lines without.

---

## Nothing comes over unexamined

**This is the rule that makes the whole thing worth doing.**

Movie's framing, and it is the right one: **it is moving house.** Every box gets
opened as it is carried, and it is kept or tossed right then. Nobody empties the
whole house onto the lawn to sort it — which is why a "two week deep clean" of
22,467 lines never starts. Carrying one module on the day the new page needs it
is a job that finishes.

Every module is *good* code. It is also code written under a deadline, against
a board, with decisions taken in the moment and never revisited because it
worked. Copying it across unread would rebuild the same app with a different
chassis, and there would be no point.

So before any module is referenced by a new page, it is read, with one of three
verdicts:

| verdict | what happens |
|---|---|
| **Right as it is** | reference it, note it was reviewed, move on |
| **Right but unclear** | improve the comment or the naming, its own commit |
| **Wrong** | fix it properly — **in the old app first**, because that is where it is running today |

That third row is why the review pays twice.

---

## Two rules that come from two things writing one file

Both were raised by Gilligan and both are day-one, not polish.

### `ifRev` is not optional

Drawings live in IndexedDB under `model-drawing`, and **LAYOUT and PROJECT read
the same bucket.** Writes are guarded:

```js
await store.saveSharedFile(file, MODEL_STORAGE_BUCKET, { ifRev: at.rev });
```

Optimistic concurrency: a write landing on a revision it did not read is
refused and merged rather than clobbering. **A new page that writes without
`ifRev` silently overwrites whatever LAYOUT just did.** Reading is free.
Any new page inherits that obligation the day it first writes.

### What "better" means, in four clauses

The plan says *old pages run untouched until their replacement is better* a
dozen times. That sentence is load-bearing and had no owner and no test, which
Gilligan caught. It means:

1. The new page does everything the old one does **for the tasks it claims** --
   not all tasks.
2. Its specs cover that scope.
3. Movie has drawn a real house with it and preferred it.
4. **The old page still opens a drawing the new page has written, without
   loss** -- checked by a spec, not by hand, for as long as both exist.

The fourth is the one I had missed, and it is the one that makes the rest
safe. Both pages are live on the same bucket during the changeover, so if the
new page writes a key the old one chokes on -- or drops one it needs -- then
falling back does not restore anything. It strands the drafter's file. A
rollback is not a rollback unless the old page can still open what the new one
wrote.

When all four hold, `index.html` repoints. The old page stays two weeks,
unlinked and reachable by URL, then goes.

---

## Step 1 — ENTRY

**The first thing anyone sees, and half of it is already built.**

### What is there now

`index.html` is 214 lines of plain HTML loading two modules. Press the bone and:

```js
window.DraftBoneSound.crunch({ big: true });
setTimeout(() => { window.location.href = bone.href; }, 420);   // → MODEL.dc.html
```

Crunch, 420ms, model space. **That is the whole entry sequence today**, and it
is why the ceremony appears to be missing: it was never wired in.

### What is already written

`first-run.js` — 151 lines, frozen, pinned by `proto/first-run-harness.js`,
**loaded by no page**:

```js
window.DraftFirstRun = Object.freeze({
  STAGE, WAYS, QUESTION,
  start, advance, line, asking, skippable, wayFor, clamp,
});
```

A complete headless ceremony. `start()` opens it, `advance(state, action)`
steps it, `line(state)` returns what Gruff says — and **the words are already
written**. `gruff-interview.js` (519 lines) supplies the defaults, so a skipped
question takes the value the bone would have used anyway.

Two rules are already enforced in code, with tests asking for them:

- **Never more than one question on screen** — `asking(state)` is true only at ASK.
- **Every stage is skippable** — `skippable(state)` is true everywhere but DONE.

### What is left to build

The markup and styling for four stages, and the wiring from the bone press into
`advance()` instead of straight to `MODEL.dc.html`. Roughly forty lines of glue.

**2–3 days.** It fixes a real complaint, it is the piece where "spotless"
matters most, and it needs no canvas, no drawing format, no painters.

### Nothing is blocking it

An earlier draft of this plan said the ENTRY page waited on a default house
size per bedroom count. **It does not.** The ceremony carries a bedroom count
and a chosen way; it never sizes a house. `QUESTION.fallback` reads
`interview.DEFAULTS.bedrooms` (3) and `clamp` bounds it 1..6, and the sizing is
`build-house.js`'s job downstream, exactly as it is today.

The width bands Movie has affect how good the bone's house is -- an existing
question about MODEL -- not whether this page can be built. **ENTRY can start
now.**

---

## Step 2 onward — MODEL, a piece at a time

**The most important part, which is why it is not first.** ENTRY proves the
pattern on something small; MODEL is where the pattern has to hold.

The first piece is smaller than it sounds, because the painters already left
MODEL:

```js
window.DraftRender2D = Object.freeze({
  drawWallSeg2D, drawRoof2D, drawShape2D, drawFixture2D
});
```

*"canvas context, world→screen transform, the thing to draw, and an env object
naming every outside dependency — no component state, no THREE, no DOM beyond
the ctx."* And `layout-plan.js` already calls them, so they have a second
consumer and are proven outside MODEL.

**2a. Read and draw, nothing else.** A page that loads a saved drawing through
`drawing-format.js` and paints it with the real painters. Pan and zoom. Nothing
editable. **2–3 days.**

It draws the actual house, with MODEL's actual code, on a page with no
framework. If that is wrong, it is wrong on day three.

**2b onward, in whatever order the work demands:** the level rail, selection,
then one tool at a time. Each is a piece carried across and reviewed on the way.
Each ships.

The 15,904 stateful lines — tools, keyboard, live event handling — are the long
part and stay in the old MODEL until their replacement works better. That is
months, not weeks, and it is not committed to here.

---

## Step 3 — the level rules (BONEYARD may not survive as a place)

**Open, and Movie's call: the boneyard may be deleted entirely and become a
LEVEL.** That follows from his earlier ruling that the bone and the foundation
wireframe may become the same thing. If it is a level, it needs no card, no
page and no special case -- it is the bottom of the stack.

**The rules survive that; only the place is in question.**
`HOW-THE-BONEYARD-WORKS.md` is not really about a boneyard. It is about how
levels relate: move one and everything above responds, outward eats overhang,
inward carries everything with it, the cantilever ladder walked backwards, the
dead band. Those hold whether the thing being dragged is called BONEYARD or
FOUNDATION, so `wireframe-move.js` is the same module either way.

So this step does not wait on the decision. Build the rules; decide where they
are reached from afterwards.

### The old shape, for reference

After MODEL space exists, because the boneyard manipulates what MODEL draws.

Note it is **not a page today** — it is a card in the level rail
(`boneyardActive: false — BONEYARD card selected instead of a level`). Whether
it becomes a page or stays a mode is undecided, and does not need deciding yet:

The three modules it needs — `wireframe-model.js`, `wireframe-iso.js`,
`wireframe-move.js` — are pure. A drawing in, a level stack out; a stack in,
lines out; a move in, a verdict out. They can be built and tested in node
before anyone decides where the pixels go, and `wireframe-move.js` (the
movement rules from `HOW-THE-BONEYARD-WORKS.md`) is the real work either way.

---

## Naming — no `.dc.` on anything new

**New pages carry no `.dc.`**, because they are not DC pages and the suffix
would be a lie:

```
ENTRY.html      MODEL.html      LAYOUT.html      BONEYARD.html
```

**Old pages keep `.dc.html` until they are deleted.** Do not rename them.
`MODEL.dc.html` is linked from six pages, bookmarked, and named in twenty spec
files; renaming it to tidy a name on a file that is being deleted anyway buys
nothing and breaks all three.

This gives the state away for free: **`.dc.` in a filename means the old app.**
No tracker needed to know which one you are looking at, and the day the last
`.dc.` disappears is the day DC is gone.

It also settles deep-clean item 8, which wanted these renamed. The rename
happens by replacement instead.

---

## Where the pages live — one repo, and it is this one

**`bluejetty/draft`, at the root, beside every other page. There is no new
repository and no new domain.** Everything stays on `draft.bluejetty.ca`, and
`roughdrafter.com` keeps mirroring it hourly as it already does.

New pages arrive as NEW FILES. Nothing existing is edited, moved or deleted:

```
MODEL.dc.html    untouched, still the app
LAYOUT.dc.html   untouched
index.html       untouched until the new entry is ready to take over
support.js       untouched -- DC keeps running what it runs

ENTRY.html       new
first-run.js     already here, finally loaded
```

**A separate repository would break this before it started.** GitHub Pages
gives one domain per repository, and `localStorage` and IndexedDB are
per-domain. A new page on a different domain could not read the bone wallet,
and a new MODEL page could not open a drawing the old MODEL saved. Not awkward
-- forbidden by the browser, with no bridge but exporting a file by hand.

Building on the same lot is what makes the old house habitable while the new
one goes up. Once the new app is complete and self-sufficient, splitting it
into its own repository is a day's work and can be done then. Same origin, which is not cosmetic:
`localStorage` and IndexedDB are per-domain, and a new page that cannot read
the drawing MODEL saves cannot do its job.

**Not `bluejetty/RoughDrafter`.** That repo is an `rsync --delete` mirror of
this one, running at `:17` every hour. Anything added there is wiped within the
hour. It is a deploy target, not a second workspace — and it means a new page
at this root reaches `roughdrafter.com` with no new pipeline.

---

## What this plan does not do

- **It does not touch the old app** except where the review finds a real bug,
  which is fixed there on purpose.
- **It does not migrate LAYOUT.** Half that work is already in plain modules
  (`spec-master`, `titleblock`, `layout-plan`, `spec-pages` — 1,419 lines) and
  would survive any move. It is not moving yet.
- **It does not remove DC.** DC keeps running MODEL and LAYOUT for as long as
  they exist. Nothing is deleted until its replacement is better.
- **It adds no dependency.** Three.js and React are already vendored. Nothing
  new is installed.

## The rule that keeps it clean

`BRANCHING.md` rule 5 — **new logic starts in a module** — is why the layout
work is portable, why the painters could be reused, and why `first-run.js` was
sitting ready to be picked up. Applied from line one instead of retrofitted,
it is the whole difference between the new pages and the old ones.

Not the framework. The discipline.
