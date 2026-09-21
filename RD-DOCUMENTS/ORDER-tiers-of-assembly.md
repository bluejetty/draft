# WORK ORDER — tiers of assembly

**Movie, 21 Sep 2026**, across five messages while looking at the washroom and
kitchen on a construction sheet:

> *"don't induce a WALL with the kitchen"*
>
> *"for the bedroom i think i will only want a wall with a door and a closet
> that can be moved ... but don't worry just place a closet down and a small
> peice of wall with a door so they can copy and past the interior door or wall
> to make their bedrooms"*
>
> *"the kitchen and bathroom should be 'ASSEBLY' or maybe a higher up 'maybe a
> different name' version of an ASSEMBLY"*
>
> *"a Cabinet within the kitchen will also be an assembly"*
>
> *"and a sink withint the cabinet will also be a 'assebly that can be style
> switched between cabinets"*
>
> *"i think we should have tiers of assembly, lets make a special TYPE of
> assebly for WC and a seperate one for WC — basically w should allow NAMING of
> assebmlies so they can be refered to easily"*
>
> *"and certain names will be DEFAULT, and they will be able to change new
> ones, we will need to iron this out"*
>
> *"likw WC and KITCHEN will be DEFAULT and NOT changeable also STAIRS will be
> default NOT CHANGEABLE"* — *"(the name not changeable)"*

Status: **SPECIFIED, not started.** No code has been written against this
order. It exists so the design can be checked before a 24,000-line page is
opened.

**ONE TYPO READ RATHER THAN GUESSED AT SILENTLY.** The last message names WC
twice — *"a special TYPE of assebly for WC and a seperate one for WC"*. Every
other message in the run is about the kitchen and the washroom together, so it
is read here as **WC and KITCHEN**. If it meant something else, this order is
wrong at its centre and wants correcting before anything is built.

---

## THE FORK IS SETTLED — Movie, 21 Sep

`BOARD-xrefs-blocks-and-what-an-assembly-is.md` raised the one question that
had to be answered before Stage 1: is an assembly AutoCAD's GROUP (a bundle of
specific items) or its BLOCK (a definition with instances)? Movie answered it
while working out the AutoCAD vocabulary:

> *"ah ya my KITCH and BATHROOM would be BLOCK/Library Part and the GROUP
> would be when the user selects and assembles them"*

**It is BOTH, and which one depends on who made it.**

    made by the APP      WC, KITCHEN, CABINET, SINK, STAIRS
                         a DEFINITION with instances        = BLOCK
    made by the DRAFTER  whatever they selected and bundled
                         a bundle of real items             = GROUP

**AND THIS IS THE SAME RULE HE ALREADY GAVE, SEEN FROM THE OTHER SIDE.** The
name lock said: app-made names are locked, drafter-made names are theirs. The
split says: app-made things are definitions, drafter-made things are bundles.
**One line divides both** — who made it — so there is no second flag to keep in
step with the first. A thing with a locked name is a definition; a thing you
can rename is a bundle.

**WHICH MEANS `ASSEMBLY` KEEPS ITS CURRENT MEANING AND NOTHING MIGRATES.**
Today's assembly is already the drafter's own bundle of real items — it is
already the GROUP. No saved drawing is rewritten, no button is renamed, and
Stage 1's question ("what is a member?") is answered for the group case by
what is already there.

### The words — Movie, 21 Sep

> *"hmm we should also use GROUP and the user selected stuff and use ASSEMBLY
> for KITCHEN and WC (Object Library/Block)"*

    GROUP      what the drafter selects and bundles          = AutoCAD GROUP
    ASSEMBLY   WC, KITCHEN, CABINET, SINK, STAIRS            = BLOCK /
               a definition the app owns, placed as instances  Library Part

**So `ASSEMBLY` MOVES UP A TIER** — it names the definition, not the bundle —
and `GROUP` takes the meaning today's ASSEMBLY button has. That reads as a
rename with migration behind it. It is much less than that, for two reasons.

**1. THE CODE ALREADY SAYS GROUP. ONLY THE UI SAYS ASSEMBLY.** The record is
`groups`, the array is `this._groups` (23 references), the lookups are
`_groupForItem` and `_groupItems`, the state is `groupNameInput` and
`groupDialogOpen`, and **the teardown button already reads UNGROUP** beside a
create button reading ASSEMBLY. The rename does not introduce an
inconsistency; it ENDS one that is in the UI today.

**2. THE DISCRIMINATOR IS ALREADY IN SAVED DRAWINGS.** `dealt: true`
(MODEL.dc.html:3503) is written onto a group the bone placed, and its own
comment says what it means: *"THE BONE PLACED THIS, NOT THE DRAFTER."* That is
exactly the line this whole design divides on — app-made against drafter-made
— and it is already a persisted field. `proto/repro-washroom-bungalow.draft`
carries `dealt: true` on both WASHROOM groups, so **Movie's own file already
declares which of its bundles are assemblies and which would be groups.**

**ONE WART, NAMED SO IT IS NOT A SURPRISE.** Existing drawings carry groups
whose stored name defaults to `ASSEMBLY 1`, `ASSEMBLY 2` (MODEL.dc.html:6101).
After the rename those read like the other tier. They are drafter-facing names
on drafter-made bundles, and the standing rule is that a drawing nobody asked
to have edited is not rewritten — so they stay as they are, and only the
DEFAULT for new ones becomes `GROUP n`.

## The one-line shape

**An assembly is a named, typed bundle that can contain other assemblies.**
A sink is an assembly, inside a cabinet assembly, inside a kitchen assembly.
A WC is an assembly of a type that knows it is a WC.

**SUPERSEDED IN PART, 21 Sep.** This section first argued that one word covers
every tier and a second noun was unnecessary. The fork above overtakes it: a
definition and a bundle are genuinely different things, not two sizes of one
thing, so they get two words. What survives is the reason — `type` still
carries what distinguishes a WC from a KITCHEN, and the select / drag / copy /
delete rules still want one home. The split is between DEFINITION and BUNDLE,
not between big assemblies and small ones.

---

## What is true today, measured before anything was designed

    WASHROOM   4 walls + a group, fixed + rigid, name "WASHROOM"   an ASSEMBLY
    KITCHEN    ~7 fixtures, no walls, NO GROUP                     not one
    CABINET    one fixture                                         not one
    SINK       one fixture                                         not one
    CLOSET     one fixture                                         not one

**The kitchen already induces no wall, so that ask is already satisfied.**
`_dropKitchenL` (MODEL.dc.html:15510) pushes to `this._fixtures` and never
touches `this._walls`. The walls around the kitchen on the sheet Movie saw were
a test room, not the preset's doing. Recorded so it is not "fixed" later by
someone who did not check.

### Four limits stand between today and the order

**1. AN ASSEMBLY CANNOT HOLD A FIXTURE.** `_itemForMember` (MODEL.dc.html:17534)
resolves exactly three member types:

    member.type === 'line'  → this._lines
    member.type === 'wall'  → this._walls
    member.type === 'floor' → this._floors
    anything else           → []

So a cabinet cannot be an assembly and a kitchen cannot be one, because both
are made only of fixtures. **This is the single biggest item in the order** and
everything else waits behind it.

**2. AN ASSEMBLY CANNOT HOLD AN ASSEMBLY.** Groups are flat: `members` are
`{type, id}` pairs pointing at drawing items, never at another group. A cabinet
assembly inside a kitchen assembly has nowhere to live today.

**3. THERE IS NO TYPE — THERE IS ONE BOLTED-ON SPECIAL CASE.** A group carries
`name` (free text, upper-cased) and, for exactly one kind of group,
`washroomLevelId`. That field is the evidence the type is wanted: the deal
needed to ask "is this group a WC, and whose floor is it on", the model had no
way to say so, and a bespoke field was added to the record for that one answer.
A second such feature would add a second such field.

**4. A FIXTURE CANNOT BE COPIED.** `_captureCopyWindow` (MODEL.dc.html:18578)
captures lines, walls, floors, dimensions and columns. `_cloneItemsShifted`
clones the same five and carries fenestrations along on a copied wall — so
**copying a wall DOES bring its door** — but no path touches `this._fixtures`.
A closet, a cabinet or a sink cannot be copied at all.

That last one is why the bedroom ask is not a five-minute job: *"so they can
copy and past the interior door or wall to make their bedrooms"* works for the
door-wall today and does **not** work for the closet.

---

## Naming already exists

Stated plainly because the order asks for it as if it were missing. *"basically
w should allow NAMING of assebmlies"* — they can be named today:

    MODEL.dc.html:1115   the CREATE ASSEMBLY dialog, with a name input
    MODEL.dc.html:18068  the typed name is stored, upper-cased, on the group
    MODEL.dc.html:1203   the selected assembly's name shows in the rail
    drawing-format.js    the name round-trips through save and load

**What is missing is the second half of the sentence — *"so they can be refered
to easily"*.** There is no list of the assemblies in a drawing, no way to find
one by name, and no way to select one except by clicking a member on the
canvas. A drawing with four bedroom closets and two WCs has six assemblies the
drafter can only reach by hunting for them. **That is the real ask** and it is
recorded as its own stage below.

### And the name is not always the drafter's to change

**Movie, same run:**

> *"certain names will be DEFAULT, and they will be able to change new ones"*
> — *"likw WC and KITCHEN will be DEFAULT and NOT changeable also STAIRS will
> be default NOT CHANGEABLE"* — *"(the name not changeable)"*

The rule in one line: **an assembly the APP made carries a locked name; an
assembly the DRAFTER made carries a default name they may change.**

    WC        made by the deal         name locked
    KITCHEN   made by the preset       name locked
    STAIRS    made by the stair tool   name locked
    (any)     made by the ASSEMBLY button   defaults to "ASSEMBLY n", editable

**WHY IT IS THE RIGHT WAY ROUND**, so nobody re-opens it: a locked name is what
makes a type findable. "Show me the WCs" is answerable only while every WC is
called WC. The moment a drafter renames one to `BATH 2`, the name stops being a
handle and becomes a caption. The drafter keeps naming rights over everything
they bundled themselves, which is every case where the name is theirs to mean
something by.

**IT ALSO MAKES THE TYPE VISIBLE WITHOUT A TYPE FIELD BEING SHOWN.** A locked
WC is legible as a WC from its name alone, so Stage 4's `type` can stay a
record field the drafter never has to see.

**MOVIE HAS FLAGGED THIS AS UNFINISHED** — *"we will need to iron this out"* —
so the following are open rather than settled:

- **Does a locked name mean the assembly is locked?** Ungrouping a WC, adding a
  wall to it, deleting one of its members: none of those is a rename, and the
  name rule says nothing about them.
- **What happens to a drafter-named assembly the app later recognises?** If a
  drafter bundles four walls, calls it `POWDER RM`, and a future deal would
  have made it a WC, does it become one?
- **Whether a locked name may still be DISAMBIGUATED.** Two WCs on one floor
  are both called WC, which is exactly the hunting problem Stage 5 exists to
  end. `WC` plus the level, or `WC 1` / `WC 2`, keeps the handle while telling
  them apart — but that is a suffix the app owns, not a rename the drafter
  makes.

**A NOTE ON STAIRS, because it is not shaped like the other two.** A stair is
its own record type (`this._stairs`) and is not a group member at all today —
`_itemForMember` does not resolve `stair`, the same way it does not resolve
`fixture`. So "STAIRS is a default, unchangeable name" is a statement about an
assembly that does not exist yet, and Stage 1's work on fixtures is the same
work a stair would need. Recorded rather than assumed away.

---

## The tiers, as Movie described them

    KITCHEN      type: kitchen     contains cabinet assemblies, fixtures
      CABINET    type: cabinet     contains a sink assembly, fixtures
        SINK     type: sink        one fixture
    WC           type: wc          contains walls, fixtures
    BEDROOM      type: bedroom     contains a closet assembly, a door-wall

**No depth cap is written into this order.** A cap would have to be defended
and nothing in the ask defends one; the tiers above are three deep already and
a FLOOR PLAN assembly holding kitchens is the obvious fourth.

### The one genuinely new behaviour: style switching

> *"a sink ... that can be style switched between cabinets"*

**This is re-hosting, and it is not the same as moving.** A sink dragged across
the room is still that cabinet's sink at a new coordinate. A sink *switched* to
another cabinet leaves one parent's member list and joins another's, and its
position derives from the new parent rather than being kept.

Two things it needs that nothing in the app has yet:

- **A parent to switch INTO**, found by hit-testing the cabinets rather than by
  coordinate — which is why it waits on nesting rather than being buildable now.
- **A rule for what the child keeps.** A sink has an `offset` along its host
  wall. Re-hosted, does it keep the offset, take the new cabinet's centre, or
  keep its world position and re-derive? **Unanswered, and it is a question for
  Movie**, not one to guess: all three are defensible and they look different
  on a drawing.

---

## The order of work

### Stage 1 — a fixture can be an assembly member

Teach `_itemForMember` the `fixture` type, and every function that walks a
group's members. This is the load-bearing change; nothing after it is
interesting until it lands.

**What must not break:** the WASHROOM assembly and its WC STACK level lock.
`proto/repro-washroom-bungalow.draft` is the fixture — two WC groups of four
walls each, locked across levels — and it must open and behave unchanged.

### Stage 2 — a fixture can be copied

`_captureCopyWindow` and `_cloneItemsShifted` learn fixtures, the way they
already know columns. A fixture is hosted on a wall, so a copied fixture whose
host wall also copied must ride the NEW wall — which is exactly the rule
fenestrations already follow at MODEL.dc.html:18693, so the shape is there to
copy. **What a copied fixture does when its host wall did NOT copy is a
question**: refuse it, or re-host it onto whatever wall is under the
destination? Refusing is the safer default and is what this order assumes
unless Movie says otherwise.

This stage alone unblocks the bedroom ask.

### Stage 3 — assemblies nest

`members` learn a `group` type. Then: selection (does clicking a sink select
the sink, the cabinet, or the kitchen?), drag (a fixed parent moves the whole
tree), delete, and copy all need a walk rather than a single level.

**Selection is the one with a real UI decision in it** — the usual answer is
that a click selects the OUTERMOST assembly and a second click descends a
tier, which is how every drawing program does it, but Movie should see it
before it is settled.

### Stage 4 — assemblies carry a TYPE

Add `type` to the group record, retire `washroomLevelId` into
`type: 'wc'` plus the level it sits on. Types named so far: `wc`, `kitchen`,
`cabinet`, `sink`, `closet`, `bedroom`, and a plain untyped assembly for
everything a drafter bundles by hand.

**Saved drawings must migrate**: an existing group with `washroomLevelId` reads
back as a WC-typed assembly, and one without stays untyped. No drawing is
rewritten on load — the same rule the window-head ruling settled.

**And the type decides the name lock**, which is the rule above made
mechanical: a typed assembly's name comes from its type and the rename path
refuses it; an untyped one keeps `ASSEMBLY n` and the drafter may change it.
So the lock is not a second flag to keep in step with the type — it IS the
type, read a different way.

### Stage 5 — assemblies can be referred to

The half of the naming ask that does not exist: a list of the drawing's
assemblies, by name and type, that selects one when picked. This is where
*"refered to easily"* actually lands.

### Stage 6 — the bedroom kit, and the kitchen as an assembly

Only now is Movie's smallest-sounding ask cheap. One closet assembly and one
short interior wall with a door, placed so a drafter can copy them; the kitchen
preset wrapped as a KITCHEN assembly of CABINET assemblies.

**Where the bedroom pieces come from is unanswered.** Dealt by the bone
alongside the washroom, matching the WC precedent; or a palette button beside
the KITCHEN L PRESET; or both. Movie's *"just place a closet down"* reads as
the first, but it is his call and it is not worth guessing.

---

## What is not yet known

- **Whether "a seperate one for WC" meant KITCHEN.** Read that way throughout.
  The centre of the order depends on it.
- ~~**What the definition tier is CALLED.**~~ **ANSWERED, 21 Sep**: ASSEMBLY
  is the definition, GROUP is the drafter's bundle.
- **What a re-hosted sink keeps** — offset, centre, or world position.
- **What a click on a nested assembly selects**, and how a drafter descends.
- **Whether a copied fixture may re-host onto a different wall**, or is refused.
- **Where the bedroom pieces come from.**
- **Everything under "the name is not always the drafter's to change"**, which
  Movie has already marked *"we will need to iron this out"*: whether a locked
  name locks the assembly, what happens to a hand-named assembly the app would
  have typed, and whether two WCs may be told apart by a suffix.
- **Whether a stair becomes an assembly**, given it is not a group member type
  today any more than a fixture is.
- **Whether any spec pins the three member types.** `_itemForMember`'s
  three-way ladder is the kind of thing a test asserts by exhaustion, and
  Stage 1 adds a fourth arm to it.


---

## THE THIRD WORD: FIT-OUT — Movie, 21 Sep

> *"a CABINET would be an ASSEMBLY.. an ASSEMBLY of ASSEMBLE should be given a
> different name maybe. the KITCHEN is a higher level ASSEMBLY or ASSEMBLYs, do
> you have a name idea"* — *"ok FIT-OUT lets do it"*

    GROUP      what the drafter selects and bundles
    ASSEMBLY   ONE INSTALLED THING -- a cabinet, a sink, a WC pan. It has a
               model number.
    FIT-OUT    A ROOM'S WORTH OF THEM -- a kitchen, a bathroom. It has a
               LAYOUT.

### The rule is what a thing IS, not how deep it nests

The question arrived as *"an assembly of assemblies should be given a
different name"*, and **that rule does not divide its own examples.** A sink
sits inside a cabinet and both are assemblies — so a cabinet is already an
assembly of assemblies, and by that rule it would need the new word too. But
a cabinet is plainly an ASSEMBLY and a kitchen is plainly the other thing.

So the line is drawn on KIND rather than on DEPTH: one installed thing against
a room's worth of them. That survives nesting at any depth, which "contains
assemblies" does not, and it is why a CABINET stays an ASSEMBLY no matter how
many assemblies end up inside it.

### SUITE was the better word and it is taken

`SUITE` means exactly this in the trade — a bathroom suite is the WC, basin
and bath together. It is ruled out on evidence: **`ENSUITE` is already in this
app**, meaning a ROOM TYPE. `SUITE` for a bundle of fittings standing beside
`ENSUITE` for the bathroom off a bedroom would be two close words meaning
unrelated things.

`KIT` was considered and dropped: every `KITCHEN` in the codebase contains the
substring, which makes both reading and searching worse. `MODULE` is
ArchiCAD's word and would be familiar, but it is abstract for a tool that
otherwise says plain trade words.

### The hyphen: FIT-OUT in the label, `fitout` in the file

Not a compromise — the convention the codebase already follows:

    GRADE BEAM              'gradebeam'
    THICKENED-EDGE SLAB     'thickened'
    FIT-OUT                 'fitout'

`THICKENED-EDGE SLAB` is already a hyphenated uppercase label, so `FIT-OUT`
reads as native there. And `GRADE BEAM -> 'gradebeam'` shows a stored value
already dropping the punctuation its label carries. Identifiers take `fitOut`,
a hyphen not being available to them.

### One thing this does NOT settle

Whether a FIT-OUT is a DEFINITION with instances or a BUNDLE of real items —
the fork recorded above, still open. Naming the tier does not answer whether
twelve kitchens follow one definition. Nor does it answer how a drafter ENTERS
a nested assembly to edit the sink inside the cabinet; ArchiCAD's Suspend
Groups is the proven answer and this app has nothing like it.


---

## THE FORK IS CLOSED, AND THE HARD QUESTION DISSOLVED — Movie, 21 Sep

Three messages, and between them they settle both things this order had left
open:

> *"yes the fit out will be ASSEMBLIES placed together in a specific
> arrangement"*
>
> *"we should allow the user to select a different KITCHEN FIT-OUT or break it
> and rearrange the cabinets withint it (not longer a FIT-OUT at that point"*
>
> *"could resave as a 'special' FIT-OUT"*

### 1. A FIT-OUT IS A DEFINITION

*"select a different KITCHEN FIT-OUT"* only makes sense if there is a SET of
them to select from. So a fit-out is a named layout the app owns — KITCHEN A,
KITCHEN B — and what lands in the drawing is a placement of one. That closes
the definition-against-bundle fork for this tier, and it closes it the way
the earlier ruling already pointed: app-made is a definition, drafter-made is
a bundle.

### 2. YOU NEVER ENTER A FIT-OUT, AND THAT DELETES THE HARDEST PROBLEM

This order has been carrying an unanswered question with real teeth: *how does
a drafter get inside a nested assembly to edit the sink in the cabinet?*
ArchiCAD answers it with Suspend Groups, this app has nothing like it, and
building one is a substantial feature on its own.

**Movie's answer removes the question instead of answering it.** There are
exactly two things you may do to a placed fit-out:

    SWAP    pick a different KITCHEN FIT-OUT -- the whole layout is replaced
    BREAK   it stops being a FIT-OUT and becomes loose assemblies you arrange

There is no third door, so **there is nothing to enter.** A fit-out is intact
or it is gone.

**THIS IS THE SAME MOVE AS THE NEIGHBOURHOOD RULING** — *"they can't draw a
new house"* — and it is worth naming, because it is the second time the
cheaper design has come from taking a capability away rather than adding an
enforcement mechanism. There a placed house could not be edited because there
was no wall tool to edit it with; here a fit-out cannot be edited in place
because editing it is what breaking it means.

### 3. AND IT DELETES A SECOND PROBLEM NOBODY HAD NAMED YET

Every definition-with-instances design has to answer: **what happens when
somebody edits one instance?** AutoCAD, ArchiCAD and every other tool carries
machinery for it — the instance diverges from its definition, or it is
"exploded", or the definition is redefined and everything else jumps.

**Here the question cannot arise.** A placed fit-out can never differ from its
definition, because the only edit is a break, and a broken one is no longer a
fit-out. So:

- there is no live link to maintain, and no rule for what a stale one does
- a placement is just `(which fit-out, where, which way round)` — the same
  shape as `siteRegistration`, which already exists and is already tested
- swapping is genuinely cheap: change the id and re-derive the arrangement
- twelve placed KITCHEN A fit-outs are identical by construction, not by a
  synchronisation that has to be kept honest

### 4. RESAVE CLOSES THE LOOP, AND IT IS THE NAME LOCK AGAIN

*"could resave as a 'special' FIT-OUT"* — so the drafter who broke a kitchen
and rearranged it can make their arrangement into a fit-out of their own. The
full lifecycle:

    place    a KITCHEN FIT-OUT from the app's set
    swap     for a different one, any time, while it is still intact
    break    -> loose ASSEMBLIES, no longer a FIT-OUT
    arrange  the cabinets, freely, because they are just assemblies now
    resave   as a new "special" FIT-OUT -- the drafter's own

**And "special" is exactly the line this order already divides on.** An
app-made fit-out carries a locked name (KITCHEN); a drafter's resaved one is
theirs to name. That is the same rule as the assembly name lock, and the same
rule as `dealt: true`, which is already a persisted field in saved drawings.
**One discriminator, now serving three features** — nothing new to keep in
step.

### What is STILL not settled

- **Where a drafter's resaved fit-out lives.** `dealt: true` says who made a
  thing, but a definition has to be stored somewhere to be placed again, and
  the drawing format has no library section. In this drawing only, or across
  drawings? Across drawings is a storage question, not a drawing-format one.
- **Whether a swap keeps the drafter's changes to size.** A kitchen fitted to
  a 12 ft wall, swapped for a layout that wants 14 ft — refuse, stretch, or
  place it and let it overhang?
- **Whether BREAK is reversible** by anything other than undo.

### And none of it can start yet — the blocker is BIGGER than Stage 1 says

Stage 1 was written as "teach the member resolver the fixture type". Measured
on 21 Sep, that is the *second* problem. A kitchen is roughly seven FIXTURES
and a cabinet is one, and:

                              MODEL.dc.html      MODEL.html  (LIVE -- the
                              (old, unlinked)    logo links here)
    draws fixtures            yes                yes
    a tool to PLACE one       yes                NO TOOL AT ALL
    slide one along its wall  yes (press-drag)   no
    SELECT one                no                 no
    groups exist              yes                yes
    a group can HOLD one      no                 no

**A fixture cannot be SELECTED on either page.** The old page's press on a
fixture starts `_fixtureDrag` (:11100) -- a slide along its host wall -- and
never puts it in `selection`. The new page has no fixture code path at all:
`fixtureDrag`, `fixtureAt` and `'fixture'` as a tool return nothing.

MODEL.html:7075 says so itself, and says it was deliberate:

> *"The old page's chain also tests fenestrations, fixtures, surface openings,
> dimensions and roofs. None of those five is in the OBJECT TYPE vocabulary
> ... and none of them has a tool on this page yet. Selecting is not saving
> -- the file keeps every one of them untouched."*

So the ladder needs a fourth arm AND a fixture needs to be selectable AND, on
the live page, placeable. **You cannot bundle what you cannot pick.**

**AND THIS IS ALREADY ON THE BOOKS AS MOVIE'S DECISION.**
`PARITY-model-html-vs-dc.md:320` lists the fixture tool among seven that are
*"absent -- unreachable, measured"* and marks the row
**"? Movie's call, not mine"**. FIT-OUT is the first feature that forces the
question, so the answer decides where this order's work goes:

    port the seven tools to MODEL.html   fit-outs are built where drafters are
    build FIT-OUT on MODEL.dc.html       built on a page nothing links to
    port only the FIXTURE tool           narrow, and unblocks exactly this

Until that is answered, every ruling above describes something with nowhere to
live.
