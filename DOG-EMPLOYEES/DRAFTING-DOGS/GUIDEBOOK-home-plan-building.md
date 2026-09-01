# HOME PLAN BUILDING GUIDEBOOK

**Rough Drafter — back of house**
Rev 2, 31 Aug 2026. Extracted from the working code, not from memory.

---

## 0. What this book is

The order comes through the window as a **program** — rooms wanted, storeys,
entry side, and where the client would like things. This book is what turns
that into a house that stands up.

It does not ask the client anything. That's the *Drive-Thru Window Operator
Guidebook*. The two books meet at the program and nowhere else — which is what
lets you put a different dog on the window without touching how houses get
built, and change a rule in here without rewriting the interview.

**Who reads this book:**

- **the drafting dogs**, arranging rooms from the order
- **TOY MODE**, to keep a beginner inside buildable geometry
- **RABBIT**, later, generating several plans that all have to be valid
- **the drafter**, when they want to know why the machine did that

Four readers, one book. That's the reason it's written as tables the code
loads rather than prose someone implements — a rule in a document gets built
once and then drifts; a rule in a table is the thing actually running.

---

## 1. Two kinds of rule

Every rule in this book is one of two things, and the difference decides who
is allowed to touch it.

**MAIN RESTRICTIONS (§3)** — the house standing up. Not opinions. No dog
varies them, no personality overrides them, and a plan that breaks one is
wrong rather than unusual. If you can't imagine two competent drafters
disagreeing about it, it belongs here.

**PERSONALITY RESTRICTIONS (§4)** — real choices with room in them. Two good
drafters would answer differently and both be right. Each one carries a
**range** and the **house default**, and a dog is a named position inside
those ranges.

### The one rule about the two kinds

> **A dog may narrow. A dog may never widen.**

A fussy dog who wants 10'-0" bedrooms is welcome to them — the book's floor is
9'-8" and he's tighter than it, so his houses are valid by construction and
nobody has to check his work. What he may not do is 9'-0". Narrowing cannot
produce a bad house; widening is just editing §3 with extra steps.

Same for leanings. "Prefers the kitchen at the back" is a weight on a choice
this book already permits both ways. If a dog's lean makes him pick something
§3 forbids, that isn't a lean, that's a widening.

### How a dog gets checked

Because every row in §4 carries its range, a dog's file can be verified without
looking at a single plan: **every setting sits inside its range, or the dog
doesn't go on shift.** That's the whole test. It's also what makes bench dogs
safe — a dog being tried out can't produce an invalid house, only a differently
opinionated one.

### When a dog thinks a MAIN restriction is wrong

That is not an exemption and it does not go in his file. It's a proposal to
change this book, and it gets recorded the way §2 records everything else: as a
dispute against the rule, with the reason. Settled once, for everyone. A rule
that only some dogs follow is not a rule, it's a rumour.

---

## 2. How a rule is written down

`stair-rules.js` already does this properly and it's the model for the whole
book. Every row carries:

- the **number**
- its **source**, cited to a document that rides with the repo
- a **confidence** — HIGH, MEDIUM, LOW
- a **band** rather than a single figure where sources disagree, because the
  spread between them is information and averaging it away would be a lie
- any **dispute**, preserved rather than resolved
- `verified: false`, kept until someone works it against the actual IRC/NBC
  text

That last flag is the honesty of the whole system. **Nothing in this book is a
code approval.** These are the office's numbers and sound practice. A permit
set needs someone who knows the local code to sign it.

Those bands are also where §4 comes from. Where the sources genuinely
disagreed, the spread between them is exactly the room a dog is allowed to
move in — the band was already telling us which rules had slack.

US and Canadian packs stay fully separate and are never blended.

---

## 3. MAIN RESTRICTIONS

Every dog. Every time. Extracted from the running code.

### 3.0 Three kinds of MAIN restriction

Every rule below is one of three things, and the difference is not cosmetic:

- **CODE** — a building code or municipal requirement. Not ours. We can be
  wrong about it, and if we are, the code wins. Every CODE row wants a
  citation someone can go and read; §3.11 is where they live.
- **OFFICE** — how this office does it. A convention we hold to so drawings
  agree with each other. Ours to set, and a client may reasonably decline one.
- **RUFFDRAFTER** — good house building. Not required by anybody; it is simply
  the better house. The closet on the shared wall is one of these — no
  authority asks for it, it is just right, and knowing why is the whole job.

The three fail differently, which is the reason for splitting them. Break a
CODE rule and the house doesn't get built. Break an OFFICE rule and the
drawings disagree. Break a RUFFDRAFTER rule and you get a legal, consistent,
slightly worse house — which is the kind of wrong nobody catches.

How §3 currently splits:

| § | Class | Cited? |
|---|-------|--------|
| 3.1 room minimum floors | mixed — bedroom is NBC-derived, the rest RUFFDRAFTER | bedroom only, loosely |
| 3.2 circulation minimums | mixed — the 3'-0" hall is code-derived | no |
| 3.3 stair geometry | CODE | `docs/stair-database-compiled.md` |
| 3.4 private room on the stair | RUFFDRAFTER | n/a |
| 3.5 window siting | RUFFDRAFTER, over a code floor for bedroom egress | no |
| 3.6 wall assemblies | OFFICE | n/a |
| 3.7 areas | OFFICE convention | n/a |
| 3.8 the compass | OFFICE | n/a |
| 3.10 closet placement | RUFFDRAFTER | n/a |

**Anything uncited is not CODE until it is cited.** That is the safe direction
to be wrong in — we never tell someone the code requires a thing we can't show
them. The table is therefore also the to-do list.

**Municipality is not a column.** Setbacks, height limits, lot coverage,
secondary suites and garage rules vary town by town, and this book has nowhere
to hold "depends where you are." Every one of those sits outside the book
entirely today. Unsolved, and flagged so it isn't discovered late.

### 3.1 Room minimum floors — `room-standards.js`

| Room | Min area | Least dimension | Source |
|------|----------|-----------------|--------|
| Bedroom | 97 sq ft | 9'-8" | NBC-style habitable-room default |
| Kitchen | 40 sq ft | 5'-0" | the engine's own auto-kitchen envelope |
| Living | 145 sq ft | 10'-0" | office default |
| WC / bath | 18 sq ft | 3'-0" | office default, 3' clear width |
| Laundry | 15 sq ft | 4'-6" | a washer+dryer pair wants 4'-6" clear |
| DZ / mud room | 33 sq ft | 5'-6" | bench-with-lockers 2'-6"×6'-0" plus a 36" circulation strip |

These are **floors, not targets**. What a dog aims for above them is §4.1.

The DZ row has the best provenance in the table — derived from an actual unit
against a wall plus the strip you walk down, credited to Jerry's House Design.
That's the standard every other row should be brought up to.

**These are office preference, not a code engine.** A flag is feedback the
drafter may ignore. And a category the detector can't identify never flags at
all — a flag must never fire on a guess.

### 3.2 Circulation minimums — `room-grow.js`

- The hall spine is **3'-0" clear**. Nothing narrower, ever.
- A usable stretch of room beside the spine is **4'-0"** minimum.
- The spine runs only where the footprint gives it full width — on an L it
  stops at the notch rather than sailing through it. On a U it comes back in
  pieces, and says so rather than silently joining them.
- The corridor may **slide off the stair's centre** to give a mandatory room
  the depth it needs, but it must still touch the stair well. The slide is
  bounded; the bound is not negotiable. *How eagerly a dog slides it, and
  which side he favours, is §4.2.*

That sliding rule is the most sophisticated thing in the current engine and it
is documented nowhere but in the code. It belongs in this book.

### 3.3 The stair, as geometry — `auto-stair.js`

- A stair well is **born legal** — inflated by half the finish allowance, kept
  inside the interior ring, holding a 2" gap off any beam centreline.
- Winders are a last resort, never a first choice.
- A stair that cannot be placed legally is a failure to report, not a stair to
  place illegally.

### 3.4 A private room may not open onto the stair — **NEW, not yet built**

A room whose door lands directly on the stair — no landing, no hall between —
may only be a room you walk through.

**Allowed:** living, kitchen, entry, hallway, dining, DZ.
**Never:** bedrooms, bathrooms of any kind, storage, closets.

Raised by Movie 31 Aug from a generated plan with a bedroom in front of the
stair. Board written: `work-order-stair-landing-rooms.md`.

This is a MAIN restriction and no dog gets a lean on it. A bedroom door onto a
stair is not a style.

> **Live collision.** The drive-thru currently *defaults* storage, the main
> bath, laundry and the drop zone to "by the stairs." Two of those four are on
> the forbidden list. The window is ordering what the kitchen must refuse —
> the seam behaving correctly, but the defaults need changing too.

### 3.5 Window siting — `auto-windows.js`

- 3'-0" clear between opening **edges**; never crowd.
- 2'-0" clear of a corner.
- A **WC window is set high** — the point is daylight without a sightline, so
  privacy is the rule and the sill is what delivers it.
- A window that can't sit where it wants **slides to the nearest spot that
  clears** rather than being dropped. A room pushed two feet along its own
  frontage still reads as its window.
- Everything the machine places is ordinary fenestration marked `auto`. **The
  drafter's own openings always outrank it.**

*How many windows a dog likes is §4.4.*

### 3.6 Wall assemblies — `wall-types.js`

2×4 (3½"), 2×6 (5½"), insulated basement wall (6½"), 8" concrete, ICF (11¼"
and 13¼"), 2×8 PT wood foundation (8").

Structural assemblies are offered on the **foundation layer set only**; every
other context offers stud and insulated walls. Retired types in old drawings
map to their closest current assembly. *Which permitted assembly a dog reaches
for first is §4.5.*

### 3.7 Areas — `areas.js`

Areas are **as built**: a floor opening, stair rough openings included, is
deducted from the level it's cut from. The building total is the sum of the
level nets, so a stairwell counts exactly once — at the level with solid floor
beneath it.

Stated in the code, printed in the dialog, and repeated here because a permit
application is exactly where an undocumented convention becomes an argument.
**No dog varies how area is counted.** A number that means different things on
different sheets is worse than no number.

### 3.8 The compass

E1 front (+z), E2 left (−x), E3 back (−z), E4 right (+x).

One mapping, defined once, so a client saying "front", a stamp placed at the
front, and the E1 elevation are the same thing. Both the interview and the
window siting read it. **Never let a second copy of this exist.**

### 3.9 Coming, and MAIN when they land

From the TOY MODE spec and the turtle path — settled in conversation, not yet
written as data:

- **Whole feet.** Toy geometry moves in whole-foot increments; everything is
  orthogonal by construction.
- **Cantilevers.** Up to 2'-0" silently fine. 2'-0"–4'-6" possible but poor
  practice, hard-blocked in toy mode. Beyond 4'-6", move the foundation and
  add piles — drafting mode allows it with advice.
- **Minimum interior room sizes on a drag** — the §3.1 floors applied live
  rather than as an after-the-fact flag.
- **Openings carry their wall** when it moves.
- **Non-orthogonal geometry is refused** in toy mode, not silently rounded.

And the one that has no home yet: **the constraint function**,
`allowedMove(wall, proposedDelta, context) -> { delta, reason? }`. That's the
seam every rule above gets applied through when the user is dragging rather
than generating. It's step 1 of the turtle path and it's blocked on rulings,
not on code.

### 3.10 Where a closet goes in a bedroom — **NEW, not yet built**

The default position, and it is a default because it is derived rather than
chosen:

- **On the wall shared with the next room**, not on an exterior wall — an
  exterior wall is where the window goes, and a closet backing onto a
  neighbouring room is the cheapest wall in the house to build.
- **One end tight to the exterior wall**, so the closet starts in the corner
  rather than floating and leaving a dead pocket beside it. Which end depends
  on which side of the room the door is.
- **The other end returns to the shared interior wall**, closing the closet
  with a short return rather than a second full wall.
- **At least 3'-4" clear** between that return and the bedroom/hall wall the
  bedroom door is framed in. Clear between finished faces, not a rough
  opening — this is the strip the door needs to be framed and to swing, and it
  is the dimension the whole arrangement is really built around.

The closet **length is the user's**. Everything above is where it sits; how
deep into the room it runs is a thing the turtle may drag, bounded by the
3'-4" and by §3.1 leaving a legal bedroom behind.

Which makes this the first rule that is also a **weld**: the return is welded
to the shared wall and travels with it, and the free end is the grip. Raised
by Movie 1 Sep. No dog gets a lean on the 3'-4"; where a dog may differ is how
much closet he gives a bedroom that didn't ask.

Open: whether 3'-4" is a floor or the actual target, and whether a bedroom
whose geometry can't produce this arrangement gets a closet somewhere else or
reports that it couldn't.

### 3.11 References

Every source we can point a person at, kept here whether or not a rule cites
it yet. Add to it whenever one turns up — a link found and not written down is
a link found twice.

| What | Where |
|------|-------|
| National Building Code of Canada 2020, free electronic editions | https://nrc.canada.ca/en/certifications-evaluations-standards/codes-canada/codes-canada-publications |
| Illustrated User's Guide, NBC 2020 Part 9 — Housing and Small Buildings, the part that actually governs a house | same page, listed under 2020 |
| Stair rules — nine reconciled syntheses, disputes preserved | `docs/stair-database-compiled.md` |

Wanted and missing: the specific NBC Part 9 article numbers behind the bedroom
floor area, the hall width and bedroom egress windows — each is a §3 row
claiming code without proving it. And the **provincial** code that actually
applies, since the NBC is a model the provinces adopt with amendments rather
than a code in force on its own.

RUFFDRAFTER rules don't get citations, because there is nobody to cite. What
they get instead is a **reason**, written next to them. A rule of good practice
with no reason attached is indistinguishable from a habit.

---

## 4. PERSONALITY RESTRICTIONS

Real choices. A dog picks a position in each range; the house default is what
Gruff uses today, taken from the current code.

### 4.0 The footprint — size and shape

The two biggest dials, and the two you can pick out of a lineup fastest. Both
were missing from the first cut of this section, which listed room-level
preferences and no whole-house ones — caught by three dogs that turned out not
to fit it.

| Choice | Range | House default |
|--------|-------|---------------|
| Total area | no cap → a hard ceiling | no cap |
| Aspect ratio | as near square as the order allows → 4:1 and beyond | balanced |
| Jogs | none unless forced → freely | as the plan wants |

A cap is a narrowing, so it can never produce an invalid house. It can produce
**no house at all** — a dog capped at 1200 sq ft cannot take a five-bedroom
order without going under the §3.1 floors, which he may never do.

So a dog needs a way to say **"not my kind of house"**, and it has to go back
out through the window rather than quietly shrinking bedrooms. That case is
unhandled in both books today; see `chad-the-chihuahua.md`.

### 4.1 Room targets — how much above the floor

A dog aims for a size, and §3.1 is the floor he can never go under.

| Room | Range | House default | The disagreement |
|------|-------|---------------|------------------|
| Bedroom | floor → 12'-0" least dim | floor | secondary bedrooms: adequate, or generous? |
| Kitchen | floor → 180 sq ft | floor | is the kitchen the centre of the house or a work room? |
| Living | floor → 260 sq ft | floor | one big room, or living plus a second smaller space? |
| WC | floor → 30 sq ft | floor | a powder room can be tiny or it can be pleasant |
| DZ | floor → 60 sq ft | floor | how much of the coat-and-boot problem gets solved |

A dog who raises a target is narrowing — his houses satisfy §3.1 by a wider
margin. Watch the interaction, though: raising every target on a small
footprint means fewer rooms fit, and that's a real trade the dog is making,
not a free preference.

### 4.2 Circulation generosity

| Choice | Range | House default |
|--------|-------|---------------|
| Hall width | 3'-0" → 4'-0" | 3'-0" |
| Corridor slide | how far off centre before he'd rather shrink a room | bounded, takes the slide |
| Which side gets the depth | bedrooms first / public rooms first | mandatory rooms first |

Wide halls are the clearest personality signal in a plan and cost the most
floor area. A dog at 4'-0" is saying something.

### 4.3 Stair leanings — `stair-rules.js` + `auto-stair.js`

The shape ladder every source agrees on, with the priors:

| Shape | Prior share | Confidence | Generated today |
|-------|-------------|------------|-----------------|
| Straight | 35–50% | HIGH | yes |
| L | 25–35% | HIGH | yes |
| U / switchback | 15–25% | MEDIUM | yes |
| Straight w/ mid-landing | 2–8% | LOW | no |

These are **tie-breakers, not quotas**, and a dog is allowed a favourite
within them.

The placement weights are all personality — each one is a preference the
engine scores, not a rule it enforces:

| Weight | Range | House default | What it means |
|--------|-------|---------------|---------------|
| Bedroom repel radius | 4'-0" → 8'-0" | 6'-0" | how hard bedrooms push the stair away |
| Entry / foyer pull | mild → strong | strong (entry L beats a nearer straight) | breaking the door-to-bedrooms sightline |
| Exterior wall push | none → strong | soft | a stair on an outside wall wastes the best glazing |
| Basement stacking | 0'-0" → 12'-0" radius | 12'-0" | how much he wants the lower stair under the upper |
| Steps from entry | how much fewer steps is worth | moderate | steps should be need-driven |

The stacking prior is 0.7–0.9 and the sources don't agree on what "stacking"
even means, so the engine models the middle reading: proximity of well
centres. Recorded here so nobody mistakes it for a measured fact.

### 4.4 Window habit — `auto-windows.js`

| Choice | Range | House default |
|--------|-------|---------------|
| Front | 2 → 5 | maximised, up to 5 |
| Sides | 2 → 3, up to 5 on a wall over 40'-0" | 2–3 |
| Back | 2 → 5 per floor | 2 |
| WC sill height | 4'-0" → 5'-0" | 4'-6", 24×24 unit |

Clearances in §3.5 always win. A dog who wants five across the back gets as
many as clear the 3'-0" rule and no more — the habit is a wish, the spacing is
a rule.

### 4.5 Assembly and drawing habits

| Choice | Range | House default |
|--------|-------|---------------|
| Default exterior stud wall | 2×4 / 2×6 | 2×6 |
| Foundation preference | concrete / ICF / PT wood, where all are permitted | concrete |
| Lettering, dimension style, north arrow | free | house style |
| Note wording | free | plain |
| Titleblock signature | free | none |

The bottom three touch nothing structural — they're how you tell who drew a
sheet by looking at it, which is exactly true of real offices. They're also
the safest quirks in the whole system, because no arrangement of lettering has
ever moved a wall.

### 4.6 What may never become a personality

Listed because someone will eventually ask:

- anything in §3
- how area is counted
- the compass
- clearances of any kind
- whether a private room may open onto the stair

A dog whose quirk is a 7'-6" bedroom isn't a character. He's a defect with a
name.

---

## 5. What this book is honest about

**Angles are not fixed.** Snapping to sixteenths makes orthogonal work exact.
A wall at 37° between two perfect nodes still has an irrational length. That's
arithmetic, not a bug — and it's the strongest argument for toy mode staying
at 90°.

**The shares are priors, not a census.** No public census of North American
plan catalogues exists. Every share in §4.3 is a model-synthesised estimate
reconciled from nine research syntheses. They are tie-breakers. They must
never become hard constraints.

**The §4 ranges are proposals.** The MAIN restrictions came out of the running
code and are real. The ranges around them are a first cut at where the slack
lies, written before any dog exists so the line got drawn on the merits rather
than to justify somebody's quirk. Expect to argue with them.

**Nothing here is verified against code text.** Every dimension carries
`verified: false` until someone works the checklist against the actual IRC and
NBC.

---

## 6. Open for ruling

1. **Laundry on the stair** — allowed or not? Blocking both books.
2. **Office/den on the stair** — same question.
3. **Interior walls: bones, or move whole rooms?** The largest open fork —
   decides whether grip tabs are a wall thing or a room thing, and everything
   in the turtle path is shaped by it.
4. **Blocked drag** — does it do nothing, resist, or explain?
5. **Old non-foot walls** — snap to the nearest foot, or move by whole-foot
   deltas from where they are?
6. **Do the §4 defaults stay Gruff's, or does the house default become a
   separate thing every dog varies from?** Matters the day there are two dogs
   and someone asks which one is "normal".
