# BOARD — a neighbourhood is its own kind of drawing

**Movie, 21 Sep 2026**, after turning down XREF, Hotlinked Module and every
name offered for them:

> *"i'm kindof thinking we should make a seperate filetype for a
> 'neighbourhood' or cityscape, where they can't draw a new house, they can
> make the city streets, site plans and drop in the houses"*

Status: **CLOSED — it is a different program. See the ruling at the foot.**

---

## Why this is the stronger idea, stated plainly

**IT MAKES READ-ONLY STRUCTURAL INSTEAD OF A FLAG.** Every version of the xref
idea so far had the same weak point: "you can't edit this" has to be enforced
at every call site that could edit something — select, drag, delete, trim,
extend, the wall tool, the stretch handles. Miss one and the promise is
broken quietly.

*"they can't draw a new house"* removes the enforcement problem instead of
solving it. **A neighbourhood drawing has no wall tool**, so a placed house
cannot be edited by construction rather than by permission. That is the
difference between a lock and a door that was never built.

**AND IT DISSOLVES THE NAMING PROBLEM.** Four rounds went into finding a word
for the placed thing — REFERENCE, CUTOUT, GUEST, PROXY, MODULE, HOTLINK. On a
neighbourhood plan the placed thing is **A HOUSE**. There is nothing to name,
because the document says what its contents are. A generic "reference any
drawing into any drawing" needs an abstract noun; this needs none.

**AND IT BOUNDS THE SCOPE.** The general feature carries questions with no
obvious answers: whose levels win, whose datum, what happens to a reference
inside a reference, what a referenced elevation even means. *"Place houses on a
street"* answers all of them by not asking. **The general case can still be
built later** — this is a first customer for it, not a replacement.

---

## Three things are already in the tree for this

Not built for a neighbourhood, but built for site work, and it is the same
ground.

**1. THE ENGINEER'S SCALE LADDER IS ALREADY WRITTEN, AND ALREADY KEYED ON A
VIEW KIND THAT DOES NOT EXIST YET.** `LAYOUT.dc.html:266`:

    const SITE_SCALE_PREFS = [1/120, 1/240, 1/360, 1/480];   // 1"=10',20',30',40'
    const SCALE_FAMILIES = { architect: {...}, site: {...} };
    const scaleFamilyFor = view => (view && view.kind === 'site' ? 'site' : 'architect');

**No view has `kind: 'site'` today.** Somebody wrote the ladder, wrote the
family lookup, and wrote the comment explaining why — *"A site plan at 1/8" is
nonsense — it wants an engineer's scale"* — for a view kind that has never been
constructed. The scale half of this board is done before it started.

**2. `siteRegistration` IS ALREADY THE RECORD A NEIGHBOURHOOD NEEDS.**
`{ x, z, angleRad }` — where a house sits and which way it faces, persisted
(`drawing-format.js`, `MODEL.dc.html:2828`, covered by
`tests/registration-grid.spec.js`). **That is exactly a placement**: position
plus rotation. A neighbourhood is, in one sentence, a list of those.

**3. SITE IS ALREADY A WHOLE-LEVEL DRAFTING CONTEXT** (`layer-views.js:35`),
alongside ROOF. So "a drawing whose subject is the ground" is a shape the app
already knows.

---

## What has to be decided

**WHAT A DROPPED HOUSE IS MADE OF.** Looking down at a street you see **roofs**,
not floor plans. The candidates, and they are not equivalent:

    the ROOF plan       what a neighbourhood actually looks like from above
    the FOOTPRINT       the outline only -- cheapest, reads as a site plan
    the FULL model      everything, filtered at draw time -- heaviest

The roof plan is the honest answer for a cityscape and the footprint is the
honest answer for a site plan showing setbacks. **Both may be wanted, per
placement.**

**WHETHER IT IS A FILE OR A MODE.** Movie said *"filetype"*. Today there is one
shared drawing in one `model-drawing` bucket, and every page is a view of it.
A neighbourhood holds MANY houses, so it is genuinely a second document — and
that is a change to the storage story, not just a new page. It is the largest
unknown in this board.

**WHETHER A PLACED HOUSE IS LIVE OR A SNAPSHOT.** The same question this whole
thread has circled, but now with an obvious answer: a neighbourhood is exactly
where *"I revised the house, the street plan follows"* is worth having. Which
argues live — and live is affordable here, since these fixtures run 9.8 to
44.9 KB and fifty of them is under 2 MB.

**WHETHER A NEIGHBOURHOOD HAS LEVELS.** Probably not — it has grade. If so, a
great deal of the model's machinery simply does not apply, which makes the
document smaller than it first sounds.

## Not checked

- **Whether the shared file store can hold a second drawing at all.**
  Everything so far reads and writes one bucket.
- **What a neighbourhood's own entities are.** Streets, lot lines, setbacks,
  north — the drawing format has `lines`, `outlines` and `dimensions` already,
  and whether those are enough has not been measured.
- **Whether `_autoScaleFor` actually walks the site ladder correctly**, given
  nothing has ever asked it to.

---

## CLOSED — it is a different program, 21 Sep

**Movie:**

> *"ya i think for XREF / Modules, we will need to make a completely new
> program oriented to CIVIL ENGINEERING"*

**Agreed, and the line it draws is a good one.** Referencing whole drawings
into one another, placed many times, is civil and planning work: parcels,
streets, grading, utilities, stationing, legal survey. Those are a different
discipline with different conventions, and Rough Drafter is a tool for drawing
ONE HOUSE. Bolting a second discipline onto it would cost the clarity that
makes it worth using.

So: **no XREF, no MODULE, no CUTOUT, no reference of any kind in this
product.** The naming hunt is closed with no name chosen, which is the right
outcome — four rounds of it were four rounds of trying to name something that
did not belong here.

### ONE THING DOES NOT GO WITH IT, and it would be easy to park by accident

**A SINGLE-LOT SITE PLAN IS NOT CIVIL ENGINEERING. IT IS PART OF A PERMIT SET**
— this house, on its lot, with setbacks, the driveway and north — and it is
drawn by whoever drew the house. It is already half-built here:

    layer-views.js:35     SITE is a whole-level drafting context
    MODEL.dc.html:2828    siteRegistration {x, z, angleRad}, persisted + tested
    LAYOUT.dc.html:266    SITE_SCALE_PREFS 1"=10'/20'/30'/40', with
                          scaleFamilyFor switching on view.kind === 'site'
    LAYOUT.dc.html:856    "Sheets 3 and 4 (SITE, ROOF) ... absent on purpose:
                          no painter ... They are their own boards, not silent
                          omissions."

**That last line is the point.** The SITE sheet is already a named, deliberate
gap in `ORDER-construction-layouts.md`, waiting on a painter. It stays in this
product, and it is one house on one lot. What goes to the civil program is
MANY lots — the neighbourhood, the cityscape, the street.

The difference is not the drawing. It is how many buildings are in it.

### What survives from this thread, and is still live

The assembly work is untouched by this ruling and is the real pending change:

- `GROUP` for the drafter's bundle, `ASSEMBLY` for the app's definition
- the name lock, which is the same rule seen from the other side
- fixtures as assembly members, and fixtures copyable
- nesting, and a way to enter a nested assembly

All of that is about ONE drawing and belongs here.

---

## AND IT READS OUR FILE — which changes something here

**Movie, in the same breath as the ruling:**

> *"that new program can upload the regular DRAFT file and just display them
> and position them properly within that file"*

**So `.draft` stops being an internal file and becomes a PUBLISHED INTERFACE.**
A second program, written later and separately, will load a drawing this one
wrote and draw it correctly without being this one. That is a contract, and
`drawing-format.js` is where it lives.

**THE PROOF THAT IT WORKS IS ALREADY IN THIS REPO, AND IT IS LAYOUT.dc.html.**
That page draws a full house — walls, openings, floors, roofs, stairs,
fixtures, dimensions, elevations, sections — off a saved `.draft` it did not
create, and it does not load MODEL.dc.html at all. It needs exactly this:

    shared-file-store.js   drawing-format.js    wall-types.js
    level-assembly.js      render-2d.js         geometry-2d.js
    layer-views.js         stair-geometry.js    closets.js
    fixture-geometry.js    plan-composition.js  layout-plan.js
    formatters.js          cut-view.js          titleblock.js

**That list is the civil program's shopping list.** It is not a plan; it is a
working page in this repo today. A neighbourhood program is LAYOUT's trick
pointed at many files instead of one.

### Which quietly raises the value of two jobs already on the books

`ORDER-construction-layouts.md` carries two unfinished items whose whole
purpose is to get painters OUT of MODEL.dc.html and into shared modules:

- lift the room-tag painter, the last one MODEL.dc.html holds as local code
- switch MODEL.dc.html itself to call `plan-composition.js`

Before this, those were tidiness with one beneficiary. **Now every painter
still trapped in MODEL.dc.html is a painter the civil program cannot have** —
and `_drawStairWorkspace2D` and its 624 lines are the clearest case, since a
stair section is exactly the sort of thing a second program would want and
cannot reach.

The extraction work already done has a second customer. That is worth knowing
before anyone decides it was over-engineering.
