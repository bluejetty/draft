# PLAN — the first house, and the button that does not disappear

Movie's order, 2 Sep. The sequence a person sees the very first time they open
Rough Drafter, from the logo to a house on the paper.

---

## The sequence

```
ENTRY        the logo, and nothing else. (Movie, 4 Sep: nobody sees a
             bone until they are in model space. The big bone used to sit
             under the logo here; the logo is now the one way in.)

press   →    MODEL SPACE loads. THE BIG BONE IS THERE --
             dead centre, the first bone anyone sees.

~1s     →    the screen tints behind it. No text. No arrows.

press   →    anywhere. The bone, the tint, anywhere at all.

             a house SHAPE is generated, and BUILD HOUSE builds it.
```

Then the big bone has done its job and goes. The small bone in the top bar
stays where it has always been, for every house after this one.

## What was wrong before, and it is one thing

The entry coach was close. It tinted the screen and it took a press anywhere.
**The big button was not there.** So it had to point at the small one in the
top bar with arrows and the words PRESS BUTTON TO BUILD HOUSE PLAN.

The bone on the entry page is `287x275` in the middle of the screen. The build
button in the top bar is `44px` — `36px` on a phone. Same picture, a sixth the
size, somewhere else. Perceptually it is not the same button, which is exactly
why something had to explain where it went.

**Keep the big bone on screen and the explanation is not needed.** You press
the thing you already pressed. Arrows and text come out.

*Amended 4 Sep.* The entry page no longer shows the bone, so "the thing you
already pressed" is no longer literally true: the big bone in model space is
the first bone anyone sees. The rest of the argument stands -- a 287px bone
dead centre with the screen tinted behind it needs no arrow -- and nothing
above about model space changes. What the entry page kept is the image: it
preloads `btn-bone.png` so the big bone still paints without a blink.

---

## What already exists

| step | state |
|---|---|
| logo on entry | `index.html`; the bone came off it 4 Sep, and the page preloads `btn-bone.png` so the model-space bone still paints from cache |
| the tint | the coach's `rgba(29,31,32,0.62)`, 420ms fade-in |
| press anywhere | the coach is `position:fixed; inset:0` with a click handler |
| build a house from an outline | `build-house.js` — walls, slab, roof, footings |

Three of the four steps are built and tested. They are wired to the wrong
thing, not missing.

## What is new

**1. The big bone in model space.** Plain HTML placed before `<x-dc>` in
`MODEL.dc.html`, fixed and centred. It paints on first paint, before React and
the DC runtime boot, and the image is already in the browser cache from the
entry page — so there is no blink between the two pages. Dead centre of the
viewport is also the one position that matches across two pages without
depending on anything else being laid out first.

**2. `starter-shape.js` — a house-shaped outline.** The genuinely new piece.
The only `Math.random` in this repository is in `bone-sound.js` making audio
noise; there is no starter outline and no default outline, and every outline in
the app's history has been drawn by hand.

Pure: no arguments it cannot state, points out, no DOM. Node-testable, in the
`build-house.js` mould that sits next to it. `build-house.js` takes it from
there unchanged.

**It is portable by construction**, so it is built once and works on today's
MODEL and on the new MODEL page without a line changing. That is rule 5 in
`BRANCHING.md` doing its job rather than being quoted at people.

## What is deleted

The arrows, the words, and the dismiss-on-click. The overlay itself stays —
it was never the problem.

---

## Ruled

**Three shapes: a rectangle, an L and a T.** All three at **~1500 sq ft**, all
on whole feet, because the app quantises to whole feet and a starter house that
arrives on a half-inch is a starter house that argues with its own rules.

```
RECTANGLE   1500 sq ft   50' x 30'   4 corners
L           1500 sq ft   40' x 45'   6 corners
T           1500 sq ft   46' x 45'   8 corners
```

Pick one at random, then vary the proportions a little within it so the same
shape twice is not the same house twice. The corner counts matter as much as
the areas: four, six and eight corners exercise three different amounts of the
wall-joining and roof code on a beginner's very first press, which is where a
generated house is most likely to expose something.

**No text and no arrows.** Movie: *"the user can figure it out."* The tint and
a button that has not moved are the whole instruction.

### One thing to confirm

**1500 sq ft is the outline — the footprint.** `gruff-interview.js` defaults to
**two storeys**, so that is a ~3000 sq ft house, which is large. If 1500 is
meant to be the finished house rather than the ground it covers, the footprint
wants to be about 750 sq ft and every dimension above comes down by roughly a
third.

Cheap either way -- the numbers live in one table in `starter-shape.js` -- but
worth answering before anyone measures a starter house and finds it enormous.

## Ruled: the big bone shows once, ever

It uses the gate that already exists -- `draft-entry-coach-seen` in
localStorage, which is what makes today's coach show a single time. Once you
have built your first house on a machine, the big bone does not return there.

**Correction to an earlier draft of this file**, which said model space opens
empty every time. It does not. Drawings persist in IndexedDB under the bucket
`model-drawing`, and `_loadDrawing()` runs on startup:

```js
const MODEL_STORAGE_BUCKET = 'model-drawing';
const at = await window.SharedFileStore.loadSharedFileAt(MODEL_STORAGE_BUCKET);
```

I had read `_init()`, found it setting up only canvas, camera and WebGL, and
concluded there was no restore. The restore is further along the boot chain.
Movie caught it the way it should be caught: *"i was opening it and getting my
old houses showing."*

**LAYOUT and PROJECT read the same bucket**, so a drawing is already shared
live across three pages. That is not an argument for same-origin -- it is the
existing architecture, and a new page joins it by reading the same store.

Writes are guarded and a new page must respect that:

```js
await store.saveSharedFile(file, MODEL_STORAGE_BUCKET, { ifRev: at.rev });
```

Optimistic concurrency -- a write landing on a revision it did not read is
refused and merged rather than clobbering LAYOUT's. Reading is free; writing
without `ifRev` would quietly overwrite another page's work.

The gate is still needed, for the plain reason: **the first house is the first
house.** Somebody returning to a drawing they already built does not want the
screen tinted at them again.

---

## Why this one first

It is the first thing anybody sees, it is where a beginner is lost or not, and
it is nearly assembled already. One new pure module, one block of plain HTML,
and three deletions.
