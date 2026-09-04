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

**How specific.** Movie, 3 Sep: *"should be specific as possible to our
stuff."* An entry earns its place by naming OUR things — the identifier, the
file, the count, the ruling and its date. Four tests, and an entry that fails
any of them is not finished:

1. **Does it name real identifiers?** `_floorLevels` (23) and `_activeFloors`
   (12), not "the level function and the floor function".
2. **Is the claim measured?** A count, a line number, a grep. "Used in a few
   places" is not an entry, it is a memory.
3. **Would it read the same in any other drafting app?** Then delete it. "A
   layer groups drawing elements" is true of AutoCAD and tells our reader
   nothing. "A layer set is carried on every item as `view`, and each layer in
   it is showing-and-usable, background-only, or off" is ours.
4. **Does it end in something you can do?** The `say instead` column, or a
   ruling. A word explained but not decided will be argued about again.

The counter-example worth keeping in mind: `stair` appears in 54 methods of
MODEL.dc.html and does **not** belong here. One busy topic is not a collision.
FLOOR belongs here because `_floorLevels()` returns storeys while
`_activeFloors()` returns slabs — one word, two kinds of thing. Frequency is
not the test; two referents is.

---

## How a rename lands

**Movie's plan, 3 Sep:** *"figure out all the names we use and if there are
double or confusion we can rename stuff in the dc file before we put it into
the new website"* — **and the new name goes into this dictionary.** So an entry
is not a description of a mess; it is the record of a decision, written
`old → new`, dated, with who ruled it.

The migration is what makes the timing matter. Every name still in
MODEL.dc.html when a painter is extracted is a name the new site inherits.

**Three tiers, by what a rename actually costs:**

1. **Free.** Internal methods and local variables — nothing persisted, nothing
   a drafter reads. `_floorLevels` → `_storeys`, 24 sites. The acceptance test
   is unusually crisp: the suite total must be **exactly** unchanged and all
   green, because a pure rename that moves one test outcome was not a rename.
2. **Free, and easier after extraction than before.** Names inside a painter
   that has already moved to a module. A pure module is a few dozen lines, has
   a node harness, and now has coverage — cheaper to rename than the same code
   buried in a 22,000-line monolith. **So nobody should stop extracting in
   order to rename first.** The window does not close when a painter moves; it
   closes when MODEL.dc.html is deleted.
3. **Constrained — needs a seam, not a find-and-replace.** Anything written
   into the saved drawing: `view`, `levelId`, `layer`, and
   `structure: 'floor' | 'slab'`. **Old drawings must keep opening** (BOARDS
   standing rule), so the stored key stays and the code name changes, with one
   translation on load and one on save.

**The seam for tier 3 has a hole in it, measured 3 Sep.**
`drawing-format.js` normalises more than thirty item types — `shapes`,
`roofs`, `fixtures`, `stairs`, `outlines`, `underlays` and the rest — but
**not `walls`, `lines` or `floors`**. Those three are inflated inline in
MODEL.dc.html (5241, 5255, 5270) with an `Array.isArray` check and no
validation. They are also the only three item types that carry `view`.

So a `view` rename has nowhere to live until walls, lines and floors get
normalisers of their own. That is worth doing regardless of any rename — the
three most-used types in the format are the three with no validation on load —
and it is the first job of any tier-3 rename, not an afterthought to it.

---

## Which fix a collision needs

Movie, 3 Sep: *"there is 3 meanings that all use the same word quite often…
quite often share characteristics though."*

That second half is the test. **Do the senses share characteristics?** And in
this codebase the answer is almost always yes — which means the fix is almost
never a rename.

### These are not homonyms

A homonym is two unrelated things that happen to share a sound. Our overloaded
words are not that. They are **one concept applied to different subjects**,
which is exactly why the word keeps getting reused: it genuinely fits every
time.

| word | the one concept | its subjects |
|---|---|---|
| LAYOUT | arranging elements in a bounded area | views on a sheet · joists in a floor · icons on a page |
| VIEW | a chosen way of looking at the model | through a camera · through a layer set · as a particular drawing |
| FRAME / FRAMING | members assembled into a structural surround | a window frame · a framed wall |

**So renaming is the wrong tool.** You cannot pick a better word for one of
them, because the word is correct in all of them — any replacement is worse.
That is why "framing" felt right to whoever wrote `locked framing`, and why
Movie reached for "layout" to describe joists without hesitating.

### The fix is a qualifier, not a new word

    sheet layout   ·  floor layout  ·  print layout
    camera view    ·  layer view    ·  drawing view
    window frame   ·  wall framing

Cheaper than renaming, and it keeps the word that actually fits. It also
explains the tier-2a bug exactly: `(floor.view || 'floor')` carries **no
qualifier**, so two of view's three subjects met in one expression with
nothing to tell them apart.

> **An entry for a word of this shape does not say "use X instead". It says
> "this word has three subjects — always say which."**

### When a sense does give up the word

Only when **a better, unambiguous word already exists** for it. That is the
FLOOR ruling: FLOOR stops meaning a storey not because the senses are
unrelated — a storey is named after the surface you stand on, so they share
plenty — but because LEVEL and STOREY are already sitting there, precise and
unused. A qualifier is the default; handing the word over needs a ready
replacement that is strictly better.

### Rank by what shares, not by site count

Earlier today we agreed to rank candidates by sites × senses. **That is
wrong.** Site count measures what a rename would cost — and we have just
established that renaming is mostly the wrong tool, so it measures the cost of
the thing we are not going to do. It says nothing about how likely a word is
to mislead.

Rank by **how close the senses sit**, because near-misses are what get
substituted for each other. Nobody confuses a camera with a layer set; the
subjects are far apart and context sorts it out. But the layer-set
*selection* and an item's layer-set *membership* are both truthfully "the
layer view" — adjacent subjects, one concept, no qualifier — and that is the
pair that shipped a bug past a review and past a spec written longhand to
catch it.

**In proportion:** one collision in one expression caused one bug, and it is
fixed. What this file is doing now is preventing the next one, and a page of
qualifiers does that as well as a month of renaming would. The honest state of
the whole worry: FLOOR needed a ruling and has one, VIEW needs a label,
FRAMING is four comments, and LAYOUT needs one sentence saying which subject
we mean. That is an afternoon, and most of it is already written.

---

## Candidates — measured, not yet ruled

Movie's purpose for this file, 3 Sep: *"agreed terms so we can talk clearly to
each other… mostly for me or whoever is talking to you to use the correct
terms, but also to not double anything up."* **The primary audience is the
person talking to the agents, not the agents.** Coding is the secondary use.
So an entry is finished when a human can read it and pick the right word —
identifiers are evidence for that, not the point of it.

Movie flagged WALL, PLAN and LAYOUT on sight. Measured 3 Sep, not yet ruled:

**LAYOUT** — Movie's own word for how the joists and beams sit, and Movie's own
doubt about it: *"layout is also a computer term so maybe bad choice."* The
doubt is right, and it is worse than a generic-word worry:

| sense | where |
|---|---|
| the drawing-sheet page | **`LAYOUT.dc.html`** — an entire page |
| the sheet layout in the saved format | `layout` normaliser, `drawing-format.js` |
| how the floor structure sits | `FLOOR LAYOUT (FLOOR)`, a layer-set label |

**PLAN** — Movie's word for how the walls are arranged.

| sense | count |
|---|---|
| a layer-set id / `view` value | `'plan'` ×150 in MODEL.dc.html |
| how walls are arranged | `FLOOR PLAN (WALLS)` label |
| a sheet type, against elevation and section | `ROOF PLAN` ×3 |
| the Model Space canvas element | `id="plan"` in MODEL.html — mine, and the easiest to rename |

**WALL** — `this._walls` ×93 (the items), `WALL_TYPES` ×37 and `wallType` ×53
(the assembly, a different kind of thing from a wall).

### The reframe these three suggest

The layer-set labels **already speak Movie's language**: `FLOOR PLAN (WALLS)`
is how walls are arranged, `FLOOR LAYOUT (FLOOR)` is how the floor structure
sits. The product's words and the owner's words agree.

So the fix is not to rename the labels. It is that those same two words are
*also* doing unrelated jobs elsewhere — a page called LAYOUT, a canvas called
`plan`, a format field called `layout`. **Rename the other uses, keep the
labels.** That is the cheap direction and it is the one that leaves the
drafter-facing vocabulary alone.

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

### 1/16" — TWO OF THEM, and they are not related

Movie, 3 Sep, reading a ruling about paper scales: *"he's talking about the
layouts ok i was thinking th 1/16" snap."* Both readings are correct English and
they are different quantities.

| written | what it is | where it lives |
|---|---|---|
| **1/16"** | a sixteenth of an inch **of building** — the finest increment a node can land on | `_gridStepFt()` = `1/192` ft, `formatters.js` `SIXTEENTH_IN` |
| **1/16" = 1'-0"** | a sixteenth of an inch **of paper** standing for one foot of building | `LAYOUT.dc.html` `SCALES`, `AUTO_SCALE_PREFS` |

Say **the sixteenth grid** or **the modelling floor** for the first, and always
write the second in full — `1/16" = 1'-0"`, never bare. The scale is a ratio and
the snap is a length; the only thing they share is the notation.

**Why this one is dangerous despite the senses being far apart.** Everything
else in this file collides because two meanings sit *close* together. These two
sit nowhere near each other — a building dimension against a paper ratio — and
are confused anyway, because the written form is identical and both are inches
inside a drafting program. Context does not separate them: a sentence about
scale and a sentence about snapping both read as "sixteenths of an inch".

> **A second axis for ranking candidates.** Adjacent senses of one word are one
> hazard. **Identical notation for unrelated quantities is another, and
> proximity ranking cannot see it** — these two would rank as no risk at all.
> When the same string means two things measured in the same unit, it belongs
> here however far apart the concepts are.

For the record, the automatic ladder holds no 1/16" at all: `AUTO_SCALE_PREFS`
stops at 3/32" and `AUTO_SCALE_LAST_RESORT` is also 3/32". `1/16" = 1'-0"` is a
manual pick, deliberately — it reads too small to draft from when dealt
silently.

### VIEW

**Our worst collision by site count — 137, in three senses.** Measured 3 Sep
across MODEL.dc.html:

| sense | what it means | example | sites |
|---|---|---|---|
| the camera | which way the 3D scene is pointed | `activeView === 'top'` | ~52 |
| the layer-set **selection** | which layer set you are looking at | `defaultLayerViewId(3)` → `'plan'` | ~60 |
| the layer-set **membership** | which layer set an item belongs to | `view: 'stair'` | ~25 |

Nothing about senses 2 and 3 is a view, a camera or a viewport. See LAYER /
LAYER SET / LEVEL. Say **layer set** in prose and read `view` as its storage
name; renaming the field would break every saved drawing.

**Senses 2 and 3 each have a default, and they are different defaults.** This
is the sharp edge, and it is where the tier-2a floors bug lived:

- selection default — `defaultLayerViewId(levelId)`: `plan` on MAIN FL and
  2ND FL, `foundation` on FOUNDATION, `null` on ROOF and SITE.
- membership default — `(item.view || …)`: `floor` for floors, `plan` for
  everything else.

Both are legitimately "the default view". Tier 2a used the **selection**
default as the **membership** default — `(floor.view || 'plan')` where the old
page reads `(floor.view || 'floor')` — and that is a natural mistake precisely
because one word names both. The two never agree for a floor: `plan` vs
`floor` on MAIN FL, `foundation` vs `floor` on FOUNDATION.

It stayed invisible because no fixture exercises either default — the old page
always writes `view` explicitly on a floor, so the fallback is dead code until
an older saved drawing turns up. `tests/model-html-floors.spec.js` builds that
drawing by hand.

### FLOOR

**Not a level and not a storey** — see the ruling under LEVEL / STOREY below.
What is left is four things, and they collide inside single expressions:

| what it is | in code | say |
|---|---|---|
| the assembly you stand on: joists, sheathing, finish | `assembly`, `DEFAULT_FLOOR_ASSEMBLY` (8 uses) | **floor assembly** |
| framed-vs-concrete, as the drafter's choice | `floorStructure` (11 uses) | **floor structure** |
| framed-vs-concrete, as one item's own fact | `structure: 'floor' \| 'slab'` (6 uses) | **framed floor** / **slab** |
| a drawn floor outline, the item | `floors[]`, `drawFloor2D` | **floor outline**, or **slab** where it is concrete |
| the FLOOR LAYOUT (FLOOR) layer set | `view: 'floor'` | **the FLOOR layer set** |

**This collision has already cost a bug.** The tier-2a view filter read
`(floor.view || 'plan')` where the old page reads `(floor.view || 'floor')`.
The correct expression has three unrelated FLOORs in it: an item of type
floor, a field named `view`, and the value `'floor'` naming a layer set. Nobody
reviewing that line saw the wrong default, twice, including the spec written
longhand to catch exactly that.

### LEVEL / STOREY / FLOOR

- **level** — the app's stack of drawable planes, each with an `elev`. Includes
  things that are not storeys at all: FOUNDATION, BASEMENT, ROOF. `levels`,
  `levelId`.
- **storey** — a habitable level of the house, as a *count*. What Gruff asks
  for and the generator builds to. `storeys: 2`.

Two storeys is not two levels. A two-storey house has a foundation, a
basement, two habitable levels and a roof.

**Use "level" in code and "storey" in anything a client reads.**

> **Movie's ruling, 3 Sep: never use FLOOR to mean a level or a storey.**
> FLOOR is taken — it is the floor *structure*, the thing you stand on and its
> build-up. See FLOOR below. This entry previously allowed "floor — loosely a
> storey in conversation"; that is withdrawn.

**The code does not obey this yet, and the collision is symmetrical.** One
word, two opposite meanings, both in MODEL.dc.html — measured 3 Sep:

| FLOOR = storey | | FLOOR = slab | |
|---|---|---|---|
| `_floorLevels` | 23 | `this._floors` | 40 |
| `floorLevels` | 1 | `_activeFloors` | 12 |
| | | `_drawFloor2D` | 7 |

`_floorLevels()` returns storeys and `_activeFloors()` returns slabs. Two
methods, one word, and nothing in either name says which. 24 sites sit on the
wrong side of the ruling.

**Agreed remedy, not yet done:** rename `_floorLevels` → `_storeys` (24 sites,
mechanical), and **leave `MAIN FL` / `2ND FL` alone** (29 label uses). Those
labels are drafter-facing and `MAIN FL` is conventional on a real drawing
sheet; the ruling is about code clarity, and what a builder reads is a separate
question. The rename wants its own PR — a pure rename is the cheapest thing
there is to review, and folding it into other work destroys that property. Its
acceptance test is unusually crisp: the suite total must be **exactly**
unchanged and every test green, because a rename that moves one test outcome
was not a rename.

Counting note: `grep -c` counts matching *lines*; these are occurrences via
`grep -o | wc -l`. The two differ by 2 on `this._floors` alone.

### LAYER / LAYER SET / LEVEL

**Three tiers, not two.** Nesting outward to inward:

- **level** — a storey-or-not plane of the building. SITE, ROOF, 2ND FL,
  MAIN FL, FOUNDATION; ids 8, 7, 5, 3, 1. See LEVEL / STOREY / FLOOR above.
  Carried on every item as `levelId`.
- **layer set** — a named working context *within one level*. On MAIN FL:
  ELECTRIC, FLOOR PLAN (WALLS), FLOOR LAYOUT (FLOOR), STAIR. FOUNDATION has
  its own three: ELECTRIC, BASEMENT (WALLS), FOUNDATION. Carried on every item
  as **`view`**, and listed by `layerViewsForLevelId(levelId)`.
- **layer** — the CAD layer a single item sits on. `A-WALL-EXT`, `A-FL`,
  `S-SLAB`, `E-POWER`, `PLAN DIMENSION`. A layer set's `contents` is a *list of
  these*.

So a layer set is a named selection of layers, scoped to a level. "The floor is
on FOUNDATION" is ambiguous on its own — FOUNDATION is both a level (id 1) and
a layer set (on level 1). Name which.

**`view` in code means LAYER SET.** It is the worst-named field in the drawing
format: nothing about it is a view, a camera or a viewport. `item.view ===
'plan'` reads as "this is the plan view" and means "this belongs to the FLOOR
PLAN (WALLS) layer set of its level". Say **layer set** in prose and read
`view` as its storage name. Renaming the field would break every saved
drawing, so the name stays and this entry exists instead.

**The fallback differs by item type.** Floors default to the `floor` layer set;
every other item type defaults to `plan`. Tier 2a of MODEL.html defaulted
everything to `plan` and no fixture could catch it, because the old page always
writes the field explicitly.

**A layer set's `contents` does not decide what gets drawn.** Membership is
`item.view` alone. The `contents` list names layers for the layer panel — and
most of those names appear nowhere else in the app: `A-FL` and `A-WALL-EXT`
have zero references in MODEL.dc.html. `layersFor()` is exported by
`layer-views.js` and called by nothing. So reasoning like "the plan set lists
`A-FL`, therefore floors show on the plan set" is invalid twice over: the
contents list is not a filter, and nothing is assigned to `A-FL` in the first
place.

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

### JOIN, and its four kinds

How two walls meet at a shared vertex, and what `drawWallSeg2D` does with the
ends. The kind arrives in `joins`, a Map keyed by the **shared point object** —
identity, not coordinates, so two walls at the same spot with separate point
objects are not joined at all.

| kind | emitted by `_wallJoins` | what it means | what is drawn |
|---|---|---|---|
| `miter` | yes | two walls meeting at an angle | ends **mitred** to the intersection; no cap |
| `tee` | yes | a stem running into a host that carries on through | host untouched; the stem clipped to the host's face |
| `continuation` | yes | one wall carrying on into the next, **collinear** | no cap; a face transition only where profiles differ |
| `multi` | yes | a crossing, four or more arms | as `continuation` — square at the vertex, no cap |
| `none` | **no** | a join recorded as deliberately not one | capped, exactly as an unjoined end |

**`miter` is the name, not `corner`.** An earlier version of this entry said
`corner`, which is a kind nothing produces. It reads as correct because
`drawWallSeg2D` branches explicitly on `tee`, `continuation`, `multi` and
`none` and lets EVERYTHING ELSE fall through to the mitring path — so an
invented type works, silently, until someone tightens that fallback. The
producer is the authority on the name; the painter's tolerance is not a
licence to use another.

`none` is the opposite case: the painter honours it, no producer emits it. It
is a defensive branch, not a fifth kind, and a caller building joins by hand
is the only thing that would ever set it.

**CONTINUATION MEANS COLLINEAR.** This is the entry's reason for existing: it
reads like "the wall continues round the corner", and it does not. A
perpendicular pair is a `corner`. Written the wrong way round it produces a
fixture that is not a join of any kind, and the painter is then blamed for the
result — which is how this entry was earned, 3 Sep, building the join checks in
`proto/render-2d-harness.js`.

### MITRE LIMIT

The point past which a mitre is refused and the end is capped square instead.
Two nearly-collinear walls meeting at a shallow angle put the intersection of
their faces a long way from the vertex, and drawn faithfully that is a spear
sticking out of the corner. The painter allows eight times the thicker
assembly and falls back to a cap beyond it.

Not to be confused with the canvas `miterLimit` property, which is the same
idea applied to a stroked path by the browser. Ours is computed in world feet
before anything is stroked.

### CAPPED vs MITRED

A **capped** end is closed with a straight line across the assembly — what an
unjoined wall gets. A **mitred** end has no cap: the layer boundaries run
through the vertex and form the corner themselves. A cap is suppressed only
when the join resolves for **both** faces of the assembly; a half-resolved
join stays capped, because a cap through one face and open at the other is
worse than a butt joint.

---

### OUTLINE — the object, and the word four other things borrow

Earned the hard way. Skipper said the next painter to wire was `drawOutlines2D`
and Movie read it as the outline of a fixture: *"if you are asking if the
fixtures like toilets have outlines i don't think so."* He is right that they
don't — and the misreading is the entry, because it is the obvious reading.

An **OUTLINE** is one specific object: the closed footprint of the house or a
garage, mastered on the BONEYARD and copied down to each level (`masterId`,
`srcId` per point). It carries fenestration `marks`, a `garage` field of
`attached` / `detached` / absent, and it is what `drawOutlines2D` paints. 60
uses of `outlines` in MODEL.dc.html.

The trouble is that "outline" is also plain English for *any closed run of
points*, and the codebase uses it that way for four other things — every one of
which has its own real name already:

| said as | is actually | its own name |
|---|---|---|
| "closed construction outlines" (5 sites) | the drafter's scratch geometry | **SHAPE** |
| "free-form closed outlines cut from a host floor" (2 sites) | a hole in a slab | **surface opening** |
| "closed outlines owned by a whole level" | the roof's plan extent | **roof footprint** |
| "the slab outline and its corner handles" (`palette.js:53`) | a floor's own edge | **slab edge** |

So this is not a homonym fight and renaming is the wrong tool, exactly as with
LAYOUT and VIEW. OUTLINE is a real named type with a painter, a normaliser and
a master/copy relationship; the other four are English descriptions that
happened to reach for the same noun.

**Ruling: nobody keeps the word. The object becomes a BONEFRAME.**

Skipper's first answer was that the object should keep "outline" and the other
four should stop borrowing it. Movie's was better and it is worth saying why,
because it generalises: asking *which of five senses keeps the contested word*
accepts a premise it should have rejected. Every one of the other four already
has a real name. So does the object, now. Nobody needs "outline" at all, and a
word nobody needs is a word that cannot be misread.

- The object is a **BONEFRAME** — the closed footprint of the house or a
  garage, mastered on the BONEYARD and copied to each level.
- The four borrowings say **shape**, **surface opening**, **roof footprint**
  and **slab edge**. All four already exist as terms; this costs only the
  habit.

### BONEFRAME is the object; WIREFRAME is a view of it

Skipper's first draft of this entry rejected WIREFRAME and the argument was
wrong. It said the two collide because "both senses describe the same building,
so context never separates them." They describe the same building because
**they are the same object.** `HOW-THE-BONEYARD-WORKS.md:42` says the ISO
window shows "each floor level's **outline** in its own colour" — the wireframe
is the boneframes, drawn standing up. One thing and a view of it is not a
collision, and demanding two unrelated words for them would have been the
error.

So the split is the one this dictionary already draws for LAYER and VIEW:

- **BONEFRAME** — the *object*. A closed footprint: one MASTER BONEFRAME on the
  BONEYARD, one copy per level, each copy's points linked back by `srcId`.
- **WIREFRAME** — a *view* of them. The ISO 3D window, the stack seen standing
  up, edges only. A camera angle and a render pass, not a stored thing.

Qualify the object by scope, which is what Movie was reaching for with "MAIN
WIREFRAME" and what `DEEP-CLEANUP-ITEMS.md:78` already proposed as MASTER
WIREFRAME / MAIN FLOOR WIREFRAME: say **MASTER BONEFRAME** and **MAIN FLOOR
BONEFRAME**. The qualifier names the scope; the noun names the thing.

The one word that goes away is **frame** on its own, and **outline** with it.
BONEFRAME is unused anywhere in the repo, so it cannot be misread; and it keeps
the bone vocabulary SPEC-skins §6 holds in the code permanently. A frame of
bones, on the boneyard.

Movie's reason for wanting a distinct word, 3 Sep: *"makes it easy not to
messup."* That is the whole test. A term earns its keep by being hard to say
wrong, not by being precise on paper.

### MASTER means controlling, not lowest

Asked within a minute of agreeing the name, which is how fast a good term can
still be misread: *"is the master boneframe the one under the foundation of the
main floor boneframe"* — then, immediately, the right answer: *"i thought the
master was the one that controls the other boneframes most."*

The second is correct. **MASTER is an inheritance word, not a position word.**

- A BONEYARD shelf is `{ id, name }` and nothing else (`drawing-format.js`,
  `boneyardShelves`). **There is no elevation field**, so there is nothing for
  "under" to refer to. The BONEYARD is storage, not a storey.
- Every level holds a copy. Each copy's points carry `srcId` back to the master
  point they came from.
- Edit the MASTER and the linked points move **on every level**. Edit a level
  copy and it stays local — that point takes an `offX`/`offZ` offset from its
  master. The app says this itself when an outline closes
  (`MODEL.dc.html:11142`).

So a MASTER BONEFRAME sits nowhere. It is not below the foundation, not above
the roof, not in the stack at all.

Which raises the next question, and Movie asked it: *"its alot like the
foundation boneframe — we might not even need the one in the boneyard but why
not."* They do look alike; a master and a level copy are the same shape. They
differ in **lifetime and authority**, and both differences bite:

- **A level can be deleted.** `_deleteLevel` guards only `levels.length <= 1`
  — nothing protects FOUNDATION in particular. A master living on a level is
  one that can be deleted out from under every other level. This is already
  settled in the code: `_boneyardOutlines` is deliberately exempted from level
  deletion, where fenestrations, fixtures, stairs, notes and roomTags are not,
  with the reason stated — *"the BONEYARD master is storage, not a level."*
- **Two gestures must stay distinguishable.** "Edit the master, move it
  everywhere" and "edit this level, stay here" are only different operations
  while the master is outside the stack. Make it the foundation's copy and
  editing the foundation silently moves every floor — the local edit is gone,
  and it is the more common one.

So the BONEYARD master is not redundancy. It is the thing that makes a local
edit safe.

**And the file gives the wrong impression, in as many words.** Two comments
disagree:

| `MODEL.dc.html:1736` | "never-printing shelf storage **snug under the level stack**" |
| `MODEL.dc.html:13469` | "shelf storage **outside the level stack**" |

13469 is right; 1736 is the one that produced the question above. It should
lose "snug under the level stack" for "outside the level stack — a shelf has no
elevation". Left for whoever is next in that file for another reason; it is a
comment, and MODEL.dc.html is under a lock.

This is worth more than a comment fix, because it is the general shape: **a
term can be exactly right and still mislead through a neighbouring sentence.**
The dictionary settles what a word means. It cannot settle what a stale comment
implies, and the comment is what people read first.

### What this rename can and cannot touch

`boneyardOutlines` is a **persisted key**, serialized at `MODEL.dc.html:3108`,
and old drawings open forever. So the saved file keeps `outlines` and
`boneyardOutlines` under those names regardless of what anything else calls
them.

That splits the work, and the cheap half is the half that matters:

1. **Speech and prose — now, free.** This is what the dictionary is for:
   Movie, 3 Sep, on why it exists at all — *"mostly for me or whoever is
   talking to you to use the correct terms."*
2. **Identifiers — later, in memory only**, stopping at the serializer with a
   comment at the seam. Already logged as DEEP-CLEANUP item 7, to be done by
   whoever is next in that code for another reason. On its own it is a large
   diff that changes no behaviour.

(Item 7 proposed `_masterWireframe`. Corrected to `_masterBoneframe` — it had
not measured the WIREFRAME collision above.)

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

## The T-SQUARE is DOWN by default, and `t` puts it AWAY

Counterintuitive enough that it has cost two agents an hour between them, and
worth writing where the next person looks.

The T-square is **on when the app opens**. Pressing `t` does not enable it —
it **stows** it. While it is down it squares every segment-drawing tool to 90°:
`line`, `wall`, `floor`, `outline`, `shape`, `stair`, `cut`, `dimension`,
`extend` and `copy` are all in `ORTHO_LOCK_TOOLS`.

**Why it matters beyond a keystroke.** It silently changes what a drafter can
draw, so a probe that never presses `t` measures a different app. Clicking a
diagonal with it down gives `|dx| > |dz|`, so the segment snaps horizontal and
the intended shape never exists. That is how a self-intersecting outline looked
unreachable for an hour on 2 Sep: two agents each measured with the lock on,
one concluded "the clicked route is closed", and the control — the same four
clicks one keystroke apart — showed it wide open.

Any measurement of what a drafter *can* draw states which way the T-square was
pointing, or it is describing half the app.

## Still to settle

- Is a roof **eave** an overhang for the purpose of the rules above? It is
  geometry that projects, but it has a designed width.
- ~~**"Bone" for the 3D skeleton in the boneyard.**~~ **Settled 2 Sep:** the
  boneyard is the area, the master wireframe is the geometry, and a single level's
  outline is a `<LEVEL> WIREFRAME`. Which also names the merge in advance — if the
  bone and the foundation wireframe become one thing, it is the FOUNDATION
  WIREFRAME of the master wireframe, and there is nothing left to decide.
