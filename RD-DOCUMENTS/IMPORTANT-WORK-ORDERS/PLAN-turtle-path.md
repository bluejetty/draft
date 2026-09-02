# The turtle path — every job from here to a working TURTLE

Written 31 Aug 2026 for Movie. This is the route, not an order: each numbered
step becomes its own board when it's reached. Read the rulings section first —
three of the six jobs can't be written until those are answered.

---

## What exists today

More than the specs assume, and it's worth knowing before anyone estimates:

- **The TURTLE button is already on the build row** — `MODEL.dc.html` line 278,
  wired to `_pressAssistLevel('turtle')` at 20557. Pressing it today prints
  "TURTLE pace is coming soon". There's even a test asserting that message.
  So the entry point exists and the shape of the row is settled.
- **`refLine` exists** — 33 references in MODEL. The turtle walking an inside
  face is a setting to apply, not machinery to invent.
- **The generator is orthogonal already**, so anything DOG draws, the turtle can
  in principle edit.

What does **not** exist: grip tabs (no matches anywhere), `allowedMove`, bone
lock, and any iPad interaction set.

---

## Step 0 — the rulings. An hour with you, and it blocks three jobs

Nothing below can be written honestly until these are answered. They're all
product calls, not technical ones, which is why they're yours and not a
delegate's.

1. **Old walls not on the foot.** ~~A grip tab touches a wall at −1.386'. Does
   it snap to the nearest foot, or move a whole foot from where it sits?~~
   **Ruled 1 Sep:** moves a whole foot from where it sits. The toy never
   changes what it didn't create.
2. **Do interior walls have bones, or does the user move rooms?** ~~This one
   decides whether grip tabs are a wall feature or a room feature.~~ **Ruled
   1 Sep:** a wall has a bone, but bones weld into groups. Some hold together,
   some adjust; the grouping itself still needs refining.
3. **What does a blocked drag do** — nothing, resist, or explain? **Ruled
   1 Sep:** it stops dead and the blocker says why. Never elastic. Written up
   in `spec-toy-mode-constraints.md`.
4. **Does BONE LOCK default on?**
5. **Is detachment per storey or per wall?**

1–3 are answered and the path is unblocked; 4 and 5 can wait for step 4.

---

## Step 1 — `allowedMove`, the constraint function

`allowedMove(wall, proposedDelta, context) -> { delta, reason? }`

Every toy manipulation goes through it. Rounding to the whole foot, exterior
limits, interior minimum rooms, openings carried with their wall, refusal on
non-orthogonal geometry, the cantilever bands (silent to 2', hard-blocked 2' to
4'6", bump the foundation beyond).

**No UI, no browser.** It's a node-testable pure function and it should be
written that way — that's what makes the rest of the path fast, because every
rule gets proved once here and never re-argued in a painter.

Blocked by rulings 1 and 2. One session.

## Step 2 — grip tabs

A tab appears only where a move is possible: straight orthogonal walls yes,
angled or curved walls no, walls *touching* angled geometry no. Drag runs
through `allowedMove` and the live preview shows the constrained result, not
the finger.

Blocked by step 1. One session.

## Step 3 — the turtle itself

Two verbs. Turn left 90°, right 90°, straight on; go a whole number of feet.
Walks the inside face, thickness added outward. A turtle on screen doing the
walking.

Blocked by step 1, not by step 2 — **steps 2 and 3 can run in parallel** on two
agents once the constraint function has landed, since one is a manipulation
surface and the other is a drawing surface. One session each.

## Step 4 — the iPad interaction set

Big targets, press and drag, no hover, no keyboard. This is the one people
underestimate: it's a pass over the whole toy surface, not a turtle feature, and
it's where the mode either feels like a toy or feels like CAD with big buttons.

Do it after 2 and 3 exist, so it's applied to something real. One session,
possibly two.

## Step 5 — TOY MODE as a capability layer, and the switch

Wiring the above into one mode that can be turned off. Same model, same file —
a capability layer, not a second application. This is small *if* steps 1–4 were
built behind the seam, and a rewrite if they weren't. Half a session.

## Step 6 — the dashboard

`spec-toy-dashboard.md` is its own spec and its own job — Gruff's
drive-thru, the question order, the width bands. It's independent of the turtle
and can be slotted anywhere after step 5.

---

## The few days, honestly

Six jobs, of which four are a session each and two are half. Run serially
that's four to five working sessions. Run steps 2 and 3 in parallel and it's
three or four — but only two of the six parallelise, because everything else
either blocks on the constraint function or touches the same surface.

So: **a few days is realistic**, provided step 0 happens tonight or tomorrow.
The path's critical constraint isn't build time, it's that five of six jobs sit
behind one hour of your rulings.

## What is deliberately not in this path

- **RABBIT.** Four plans per press. It reuses the same constraint set as the
  generator's input, which is the argument for building step 1 properly, but
  it's a separate route.
- **The real-estate / concept-plan area.** Dresses a chosen plan; separate job
  again.
- **Gruff.** He's a teacher, not a mode. Don't couple them.
