# DEFINITIONS — what our words mean here

Started 2 Sep 2026, because three terms slipped in one evening and each one
cost real time to untangle.

This is a dictionary of words we use **in a particular way**, not a glossary of
architecture. If a word means what it means everywhere else, it is not in here.

**How to use it.** When a word below appears in a board, a work order or a
commit message, it means the thing written here and nothing else. If you need
the other meaning, use the other word — every entry that collides names its
neighbour so you can pick deliberately.

**How to add to it.** A term earns an entry when someone has already been
confused by it. Not before — a dictionary of words nobody misuses is a
dictionary nobody reads.

---

## The overloaded ones — read these first

### BONE

**Five different things carry this name in the code today.** It is our worst
collision by a distance, and the one most worth fixing.

| what it is | in code | say instead |
|---|---|---|
| the currency a build costs | `bone-wallet.js`, `COSTS.buildHouse: 1` | **bone** — this one keeps the name |
| the BUILD HOUSE button | `data-build-house` | **the bone button** |
| the big button on the entry page | `index.html`, `.enter-bone` | **the entry bone** |
| a wall's movable unit in TOY MODE | `toy-constraints.js` — *"a wall has a bone"* | **weld group** (see below) |
| the boneyard's master geometry | `_boneyardOutlines` | **the master wireframe** (see below) |

The first three are the same idea — a bone is what you spend and the button is
what you spend it on — so they can share the word. The last two are unrelated
to it and to each other, and **those are the two to rename.**

Note also `boneDrawing()` in `tests/sheet-fit.spec.js` and
`tests/layout-compose.spec.js`: a drawing made by pressing the bone. Harmless
in a test helper, but do not let it out into the app.

### SPEC / SPECIFICATION

Two unrelated meanings, and they are one careless tidy-up away from being
merged:

- **a software spec** — how the program should behave. `SPEC-electric-plan.md`,
  `IMPORTANT-WORK-ORDERS/SPEC-toy-mode-constraints.md`.
- **a specification** — *the written half of a drawing set*. The office master
  text a job ships with, on the SPECS page. `SPECIFICATIONS/`,
  `spec-master.js`, `spec-pages.js`, `SPECS.html`.

**Proposed:** software specs become `RULES-*.md`. A drawing set has
specifications; the program has rules. Nothing in the product is called a rule
already, so the word is free.

### NODE

**A node is for lines.** A vertex in the pool, shared between the walls that
meet there. Moving one moves everything linked to it — that is the whole point
of the pool.

**An object is not placed at a node.** A window, a toilet, a closet stores a
`wallId`, an `offset` to its **centre**, and its own `width`/`depth`/`side`.
Its position is *derived* at paint time, which is why it rides a wall for free
when the wall moves. It looks like it is pinned to a point; it is not.

> Movie's ruling: **node for lines, object placement for objects.** Say
> "object" or "object placement" and never "the toilet's node".

### LEVEL / STOREY / FLOOR

- **level** — the app's stack of drawable planes, each with an `elev`. Includes
  things that are not storeys at all: FOUNDATION, BASEMENT, ROOF. `levels`,
  `levelId`, `_floorLevels()`.
- **storey** — a habitable floor of the house, as a *count*. What Gruff asks
  for and the generator builds to. `storeys: 2`.
- **floor** — the surface you stand on, or loosely a storey in conversation.

Two storeys is not two levels. A two-storey house has a foundation, a
basement, two floor levels and a roof.

**Prefer "level" in code and "storey" in anything a client reads.**

---

## The boneyard and its geometry

### BONEYARD

**The area** — the level layer under the level stack, never printing. It is the
place, not the thing in it. Holds the master wireframe on its shelves.

### MASTER WIREFRAME

**The thing in it** — the whole skeleton the building hangs off. Every level's
outline takes a **copy** from it, and each of its points has a stable
`pointId`.

*"The boneyard wireframe"* and *"the master wireframe"* are the same thing.
Prefer **master wireframe**: it says what the thing is rather than where it is kept, and
it still reads correctly once the boneyard is not the only place you can see
it.

Ruled 2 Sep. "Bone" is dropped from geometry entirely and keeps only its own
meaning — what you spend, and the button you spend it on. Nothing is lost,
because "bone" never said anything about the geometry that "frame" does not
say better.

### <LEVEL> WIREFRAME

One level's lines within the master wireframe: **MAIN FLOOR WIREFRAME**,
**FOUNDATION WIREFRAME**, **ROOF WIREFRAME**, and so on.

So the whole family is `<qualifier> WIREFRAME` — master, or a level name.

**Never "frame" on its own, and never "frame" as the short form.** Ruled 2 Sep
after briefly adopting it: `frame` is taken twice over in this codebase — a
render frame in the draw loop over a thousand times, and a building element
(`MODEL.dc.html:6655`, *"2\"-wide frame blocks at each jamb"*, and the same in
`layout-plan.js`). Qualifying it works, but only while everyone remembers to,
and the whole purpose of this file is to remove words that need remembering.

`wireframe` needs no such care — every use of it in the repository is inside
`vendor/` — and it says what the thing is to someone who has never read this
page. Two extra syllables for a word that cannot be got wrong.

**"Frame" is also worth keeping free.** A house is *framed* — studs, joists,
headers — and that is a building word we will want later and should not spend
now.

### WIREFRAME

> Movie: *"the wireframe will be the 'structural' lines in the model that can
> be manipulated in the ways we discuss"*

**The structural lines, and the ones the move rules act on.** Not a drawing
style — the name comes from how it is shown in the boneyard's left window
(edges only, a colour per level), but it refers to the lines themselves.

Which makes it a **scope**, and that is the useful part: it says what the
boneyard's rules can move and what they cannot. A wall is wireframe. A
dimension, a room tag, a note and a hatch are not — they are drawn *from* the
model, and they follow whatever they are attached to rather than being pushed
themselves.

> Skipper's note, and it is a correction of my own from ten minutes earlier: I
> had written that the frame is the geometry and the wireframe is a view of
> it. That is wrong. They are the same lines, seen from two angles — the
> **master frame** is that line set as a thing the building hangs off, and the
> **wireframe** is that line set as a thing you may take hold of.

### COPY

A level's own outline, linked to a master point by `srcId`. Move the master and
every copy's common points move (`_propagateMasterOutline`).

### OVERRIDE

A copy's point that has been adjusted locally, listed in `overriddenSrcIds`
with its `offX`/`offZ`. It is **not** detached: it still rides its master point
at that measured offset. "Overridden" means *adjusted*, never *disconnected*.

### SHELF

A storage slot in the boneyard. Every drawing has at least one. Lets the same
spot hold different geometry without overlap.

---

## TOY MODE

### TOY MODE

A capability layer over the same model and the same file — **not a second
application**. Reached today by `?toy=1`, which is temporary.

### WELD / WELD GROUP

Walls whose **ends** touch within an inch are welded and move as one, so a
room boundary can never be left with a gap. A partition that Ts into the
*middle* of a wall does not weld, and is the thing that flexes alone.

**This is what "a wall's bone" was trying to say. Use "weld group".**

### INERT

A wall the toy has no opinion about — non-orthogonal, or touching something
that is. It gets no grip tab at all, because silence is the honest way to say
"no opinion", and inertness spreads by contact.

### GRIP TAB

The handle on a wall the toy may move. **One per weld group**, never one per
wall.

### ASSIST LEVEL / PACE

DOG, TURTLE, RABBIT — how much the program does for you.
`_pressAssistLevel(pace)`. Not a skill level, not a mode.

---

## Structure

Two numbers were confused for each other for a week. These are the words that
keep them apart.

### JOIST SPAN vs REACH

- **joist span** — distance between two supports. Maximum **19'-0"**
  (`beamAtFt`). Governs *inside* the house.
- **reach** — how far the floor extends past the wall below. Maximum
  **20'-0"**. Governs *outside*.

They are different measurements. Neither is "the 18" — see below.

### CANTILEVER vs OVERHANG

- **cantilever** — floor with **nothing under it**. Free to **2'-0"**.
- **overhang** — floor projecting past the wall below, *whether or not it is
  supported*. An overhang is legal at **2'-0" or less, or 4'-6" or more**,
  never between: the gap is where a pile cannot go and a cantilever cannot
  reach.

Every cantilever is an overhang. Not every overhang is a cantilever.

### PILE vs COLUMN

- **pile** — outside, carrying an overhang *and the storey above it*. First
  line 4'-6" to 8'-0" out, second up to 10'-0" beyond that — **18'-0"** to the
  outer beam, plus 2'-0" of joist past it = the 20'-0" reach.
- **column** — inside, under a mid-span beam, splitting a run at `maxSpanFt`
  = **12'-0"**.

Piles sit closer than columns because a pile carries the floor above as well.

### INLINE vs HANGING

How a level above responds when the wall below moves. **Inline** sits flush
over the wall and travels with it. **Hanging** projects past it, and an
outward move eats the projection instead.

---

## Gruff's window

### ORDER / PROGRAM

What the drive-thru hands to the back of house. Stamps, storeys, entry,
windows, and every **defaulted** answer named. Never a house — a house is what
the kitchen builds from it.

### ZONE

**Exactly five words: front, back, left, right, by the stairs.** The client's
entire spatial vocabulary. They never give a dimension and never point at the
drawing. Do not add a sixth without a very good reason.

### STAMP

A room's name and resolved position on the plan. A stamp is a decision about
where a room goes; it is not the room, and it is not a label.

### DEFAULTED

An answer nobody gave, filled from the standing defaults **and named in the
order**. A default that is not disclosed is a decision taken behind someone's
back.

---

## Drawing

### refLine

Which line of a wall its stored geometry represents — `'left'`, `'right'` or
`'center'`. The reason "12 feet" can mean a 12'-0" room or an 11'-6½" one. The
turtle walks the **inside face** precisely so the number typed is the room you
get.

---

## Proposed renames

Nothing here is done yet. Each is a rename, not a behaviour change.

| now | proposed | why |
|---|---|---|
| "a wall's bone" (toy) | **weld group** | already the real name for it; "bone" is the currency |
| `_boneyardOutlines` | **`_masterWireframe`** (in memory only — see below) | it is the skeleton, not a bone; and "boneyard" is the place it is kept, not the thing |
| `SPEC-*.md` | **`RULES-*.md`** | frees "specification" for the drawing-set meaning |
| "node" for an object | **object placement** | Movie's ruling, already agreed |

## The one rename that must stop short

`_boneyardOutlines` may be renamed **in memory only.** `boneyardOutlines` and
`boneyardShelves` are **persisted keys** in the saved drawing —
`drawing-format.js:561` and `:979`, written by the serializer at
`MODEL.dc.html:3025`. Rename those and every drawing ever saved stops opening,
against the standing rule that old drawings open forever.

So the rename stops at the serialization boundary: `this._masterWireframe` in
the code we read daily, still written as `boneyardOutlines` in the JSON nobody
reads, with a comment at the seam saying why the two differ.

**The suite already catches this, which I first said it did not.** Twenty spec
files read `saved.boneyardOutlines` off the drawing pulled back out of
IndexedDB by `h.savedDrawing(page)` — `garage.spec.js`, `build-links.spec.js`
and eighteen others. A rename that leaked into the format turns them red at
once. The silent empty list cannot reach a merge.

Worth knowing that they guard it **by accident**: they are testing garages and
build links and happen to name the key. A short spec asserting the format's
key names *on purpose*, with a header saying why, would turn that accident
into a guarantee — and would survive the day somebody rewrites
`garage.spec.js`.

## Still to settle

- Is a roof **eave** an overhang for the purpose of the rules above? It is
  geometry that projects, but it has a designed width.
- ~~**"Bone" for the 3D skeleton in the boneyard.**~~ **Settled 2 Sep:** the
  boneyard is the area, the master wireframe is the geometry, and a single level's
  outline is a `<LEVEL> WIREFRAME`. Which also names the merge in advance — if the
  bone and the foundation wireframe become one thing, it is the FOUNDATION
  WIREFRAME of the master wireframe, and there is nothing left to decide.
