# BOARD — a neighbourhood is its own kind of drawing

**Movie, 21 Sep 2026**, after turning down XREF, Hotlinked Module and every
name offered for them:

> *"i'm kindof thinking we should make a seperate filetype for a
> 'neighbourhood' or cityscape, where they can't draw a new house, they can
> make the city streets, site plans and drop in the houses"*

Status: **OPEN, and it supersedes the naming hunt rather than continuing it.**

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
