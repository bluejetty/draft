# PLAN — the first house, and the button that does not disappear

Movie's order, 2 Sep. The sequence a person sees the very first time they open
Rough Drafter, from the logo to a house on the paper.

---

## The sequence

```
ENTRY        the logo, and the big bone under it

press   →    MODEL SPACE loads. THE BIG BONE IS STILL THERE --
             same size, same place on the screen.

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

---

## What already exists

| step | state |
|---|---|
| logo and big bone on entry | `index.html`, `287x275`, centred |
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

## Open

**What shapes?** A plain rectangle is safe and will look identical every visit,
which undercuts "generated". A rectangle, an L and a T with varied proportions
would read as different houses without the generator needing to be clever.

There is a size to aim at without asking anybody: `gruff-interview.js` already
defaults to a 3-bedroom, 2-storey house, and `room-standards.js` holds the
minimums a room has to satisfy. A shape that cannot hold three bedrooms is the
wrong shape however random it is.

**Does the big bone come back?** Decided: it is for the first house. Whether it
returns on a later visit with an empty drawing, or only ever appears once, is
not settled.

---

## Why this one first

It is the first thing anybody sees, it is where a beginner is lost or not, and
it is nearly assembled already. One new pure module, one block of plain HTML,
and three deletions.
