# How the boneyard works

Written 2 Sep 2026, from Movie's own explanation, because this was carried in
somebody's head and the head went home. Anything below that reads as a rule is
his; anything marked OPEN is a question I have not asked yet.

---

## What the code already does

Not the idea — just what is true in the repo today, so the explanation has
something to correct rather than a blank page.

- **The boneyard is shelf storage that never prints.** `MODEL.dc.html:1642`,
  sitting under the level stack. Shelves can be added; every drawing has at
  least one, and drawings saved before the boneyard existed load with one.
- **Master outlines live on a shelf.** `drawing-format.js:548`. Each point of a
  master carries a stable id.
- **Levels get copies, and the copies remember.** `_outlineCopyForLevel(master,
  level)` makes a level's outline from the master, and a point can carry its
  BUILD HOUSE link back to the master point it came from
  (`drawing-format.js:35`).

So the skeleton store already exists: one master, many copies, and each copy
knows its parent point.

- **Both cameras are already wired.** `MODEL.dc.html:5795-5804` has an
  orthographic camera and a perspective one with OrbitControls. An isometric
  wireframe is a camera angle and an edges-only pass, not a new renderer.

---

## The idea

<!-- Movie explaining. Being filled in as he goes. -->

