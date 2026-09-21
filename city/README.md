# city/index.html — the neighbourhood program

**Movie, 21 Sep 2026:**

> *"ya i think for XREF / Modules, we will need to make a completely new
> program oriented to CIVIL ENGINEERING"*
>
> *"that new program can upload the regular DRAFT file and just display them
> and position them properly within that file"*
>
> *"how hard would it be to create a seperate program in the repo - but keep it
> all seperated in a new folder, and make it real simple at first just to allow
> people to import a DRAFT and place them on the plan. no editing"*

A **separate program**, living in this folder, that reads the `.draft` files
Rough Drafter writes and does one thing with them: **place them on a plan.**
It never edits a house. It has no wall tool, so it cannot.

---

## Why it was cheap, which is the only reason it exists yet

Four things were already true when it was written. None was built for this.

**1. THE SHARED MODULES HAVE NO PATH COUPLING.** `render-2d.js`,
`plan-composition.js`, `drawing-format.js` and the rest never `require` or
`import` each other — they publish onto `window.Draft*` and read each other
from there. So a page one folder down loads them with `../` and nothing
objects. Measured before a line was written.

**2. `toS` IS A PLAIN FUNCTION.** Every painter takes a model→screen transform
as an argument:

    const toS = pt => ({ x: ..., y: ... })

So **placing a house is function composition.** Rotate and offset the point,
then hand it to the neighbourhood's own transform. No painter knows it
happened, and not one line of shared drawing code changed for this program.

**3. `drawPlan` TAKES ITS DRAWING AS AN ARGUMENT.**
`drawPlan(ctx, toS, saved, levelId, env)` — `saved` is a parameter, not a
global. **N houses is N calls.** The module was multi-drawing capable before
anybody wanted a second drawing, because it never reached for one.

**4. LAYOUT.dc.html HAD ALREADY PROVED IT.** That page draws a whole house off
a `.draft` it did not create and never loads MODEL.dc.html. This program is
the same trick pointed at many files instead of one.

## What it does

- **IMPORT** one or more `.draft` files. They are parsed, not normalised into
  anything — the file IS the interface.
- **PLACE** a house by picking it and clicking the ground.
- **MOVE** it by dragging. **ROTATE** with `[` and `]`, 15° a press, 1° with
  shift.
- **REMOVE** a placement with Delete. The imported drawing stays on the shelf.
- Pan with the right button or space-drag; zoom on the wheel.
- The neighbourhood persists to `localStorage` — placements only, plus the
  drawings they refer to.

## What it deliberately does NOT do

No editing of any kind. No wall, no dimension, no level, no layer. If you want
to change a house you open it in Rough Drafter and re-import it. That is not a
limitation to be fixed later — **it is the whole design.** "Read-only" enforced
by a flag is one missed call site from being a lie; enforced by having no tools
it cannot be.

## Known and named

- **IT DRAWS A FLOOR PLAN, NOT A ROOF.** Looking down a real street you see
  roofs. `layout-plan.js:207` bails with `if (!walls.length) return false`, and
  a ROOF level has no walls — the same gate that keeps stair sections off a
  construction sheet. So v1 draws the storey you pick, defaulting to the
  busiest one. Fixing the gate serves both boards at once.
- **No streets, no lot lines, no north.** Import and place only, which is what
  was asked for. A neighbourhood's own entities are the next thing.
- **No printing.** `titleblock.js` is right there when it is wanted.

---

## Measured, because "would it handle N" deserves a number

Four real fixtures, placed on a grid, timed over ten forced repaints. The page
repaints on ZOOM, PAN and DRAG — a pointer moving with no button down does
nothing — so these are the frames a person actually waits for.

**Before culling and level-of-detail:**

        N=1      31.9 ms/frame
        N=10     32.7
        N=100    49.9
        N=500   135.3
        N=2000  464.0          ← 0.217 ms per house, every house, every frame

At that rate 100,000 houses is **twenty-two seconds a frame**: a pan would
have crawled forward in twenty-two-second jumps.

**After (`redraw` skips what is off-canvas, and draws a house smaller than
26 px as one filled rectangle):**

        wide — the whole neighbourhood on screen, nothing to cull
        N=100      48.3 ms    0.15 MB
        N=2000     33.2       0.17
        N=20000    33.3       0.44        3515 shown
        N=100000   36.2       1.76        3526 shown

        close — standing in it at a working zoom
        N=100      33.1 ms    0.15 MB       33 shown
        N=2000     32.8       0.17          31 shown
        N=20000    32.6       0.44          33 shown
        N=100000   36.1       1.76          31 shown

**Flat from 100 to 100,000.** The ~33 ms floor is the benchmark's own wheel
dispatch, not drawing.

### Two things made it flat, and neither was an optimisation of the painters

**THE DATA WAS NEVER THE COST.** A placement references the shelf rather than
copying it, so four drawings are 0.14 MB whether placed four times or a
hundred thousand. Every house on the ground was simply being painted whether
or not anyone could see it.

**AND A PLACEMENT IS FOUR NUMBERS.** `{id, shelf, x, z, angleRad}` is 98
bytes — a double like `-21.010416666666668` spends twenty characters on
precision no ground has. `[shelf, x, z, degrees]`, rounded to 1/8" and a whole
degree, is **19 bytes**. That is what decides whether a large neighbourhood
fits at all: 100,000 fat placements is 9.35 MB and a browser refuses a
localStorage write at about five; the same 100,000 lean is 1.81 MB. Measured,
both ways, and the failing write is in the git history.

`tests/city-neighbourhood.spec.js` asserts the stored shape for that reason —
the record IS the performance claim.
