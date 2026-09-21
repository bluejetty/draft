# BOARD — xrefs, blocks, and which one an assembly is

**Movie, 21 Sep 2026**, mid-way through ironing out the assembly tiers:

> *"in Autocad there is a feature to bring in a second plan and you can't edit
> that plan it is just like a hologram image of the plan you can place into
> another DWG and you could place multiples to make a cityscape or something of
> building for example (probably wouldn't work in Autocad though because too
> much memory problems)"*
>
> *"i think you save it as something other than DWG or the file is brought is
> as an X-REF i think it iwas called"*

Status: **OPEN — and it holds a fork in
`ORDER-tiers-of-assembly.md` that has to be settled before that order's
Stage 1.** Raised as a question, kept as a board because the answer changes a
data model.

---

## He named it right, and there are two features in the description

**XREF** — `XATTACH`. A link to another DWG. It draws, it cannot be edited in
the host, and it reloads when the source file changes.

**BLOCK** — a named collection stored INSIDE the drawing and inserted as
instances. One definition, many references; edit the definition and every
instance follows.

*"place multiples to make a cityscape"* is the BLOCK case, not the xref case,
and that distinction is the whole of the memory question below.

## The memory worry is half right, and the half that is right is the xref half

    BLOCK   one copy of the geometry + N instances, each a transform.
            A hundred identical buildings ≈ one building.
    XREF    each attachment loads the referenced drawing's whole database.
            A hundred xrefs ≈ a hundred drawings open at once.

Which is why AutoCAD grew XCLIP and demand loading — they exist to fight
exactly the cost Movie remembers.

**AND IT MOSTLY DOES NOT APPLY HERE.** Measured off this repo's own fixtures:

    proto/repro-bungalow-garage-roofs.draft      9.8 KB
    proto/repro-2storey-garage.draft            23.3 KB
    proto/repro-courtyard-house.draft           32.8 KB
    proto/repro-washroom-bungalow.draft         34.2 KB
    proto/perf-bungalow.draft                   36.2 KB
    proto/repro-L-house.draft                   44.9 KB

Fifty houses is about 1.7 MB of JSON. The ceiling in a browser is not memory;
it is canvas draw calls per frame, and `proto/perf-bungalow-canvas-sweep.js`
already exists to measure that. So the feature is not blocked by the thing that
blocked it in AutoCAD — which is worth saying, because "AutoCAD couldn't" is a
reason people stop thinking.

## What the app already has: the display half

**BACKGROUND** is the hologram, already built and already non-editable:

    MODEL.dc.html:9696   _visibleBackgroundReference
    two slots             backgroundMode 'blue' | 'red' | 'none'
    blue                  rgba(82,151,218,0.58)
    red                   rgba(221,101,104,0.58)
    each slot holds       a level id + optionally ONE layer view of it
    cycled by             the `background` shortcut

A tinted ghost of another plan, behind the one being drawn, that cannot be
touched. **What it cannot do is source from another DRAWING** — both slots take
a level of the drawing you already have open.

**UNDERLAYS** are the other neighbour: PDF and image, scale-registered for
tracing (`drawing-format.js:967`). Raster, not geometry — so they are the
"scan of a plan" case, not the "another model" case.

So an xref here is not a new renderer. It is a new SOURCE for a painter that
exists.

## The fork this board actually holds

**A ROUGH DRAFTER ASSEMBLY IS AUTOCAD'S *GROUP*, NOT ITS *BLOCK*.** Members
point at specific walls and floors in this drawing:

    members: [{ type: 'wall', id: 'wall-37' }, ...]

There is **no definition separate from its instances**. Every assembly is its
own one-off bundle of real items.

`ORDER-tiers-of-assembly.md` describes a sink inside a cabinet inside a
kitchen, which is the shape of a nested BLOCK — and the order as written
delivers nested GROUPS. The two look identical on screen and differ completely
the first time somebody wants to change all the cabinets at once:

| | group (the order as written) | block (a definition + instances) |
|---|---|---|
| twelve cabinets | twelve independent bundles | one definition, twelve instances |
| fix one cabinet | eleven still wrong | all twelve follow |
| one cabinet must differ | just change it | detach it, or override |
| cost | nesting only | a definition store, an instance record, and a rule for local edits |

**THIS HAS TO BE ANSWERED BEFORE STAGE 1**, not after, because Stage 1 is the
one that teaches `_itemForMember` what a member is — and "a member is an item"
and "a member is an item OR a nested instance of a definition" are different
answers to that question.

**No recommendation is offered here**, deliberately. The order is Movie's to
iron out, he has said so, and this board exists to put the choice in front of
him rather than to make it quietly in a data model.

## Not checked

- **Whether the BACKGROUND painter would take a foreign drawing unchanged.** It
  filters `this._lines` / `this._walls` by level id; a second drawing's
  entities are not in those arrays, so something has to give. It looks like a
  small change and it has not been measured.
- **What a cross-drawing reference does about LEVELS.** A referenced house has
  its own MAIN FL at its own elevation. Placed in a site plan, whose datum
  wins?
- **Whether the shared file store can hold more than one drawing.** Everything
  so far reads and writes the one `model-drawing` bucket.
