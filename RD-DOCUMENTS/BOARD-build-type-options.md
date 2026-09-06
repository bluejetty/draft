# BOARD — the build row asks what its buttons leave open

**Movie, 5 Sep, in conversation with Skipper.** Proposed, not ruled. Needs a
board number and Devin's word: it adds a persisted answer and changes the
entry flow, so it is not a change to a type, it is a change to how a type is
chosen.

Status: **NOT STARTED.** Nothing in this file is built. NEW-5 built the
vocabulary it stands on (`buildType`, the four-button row, the type driving
the garage roof) and that is all that exists today.

---

## What started it

The row has four buttons — BUNGALOW / 2 STOREY / BILEVEL / MODIFIED BILEVEL
— and Movie named a fifth house it does not cover:

> *"there could also be a modified bilevel 2 storey"*

A modified bilevel with a full second floor over the house as well as the
storey over the garage. Real, and not reachable from any button.

**The trap that was avoided.** Skipper's first answer was to add a fifth
button. Movie's was better:

> *"2 STOREY with 2nd floor over garage should be a option for MODIFIED
> BILEVEL and 2 STOREY"*

An option, not a type. The reason it matters is combinatorial rather than
stylistic — see the grid below: as buttons, the five become eight. And the
grid below narrows it once more: the storey over the GARAGE is the option;
the second floor over the MAIN AREA is a level the drafter adds.

---

## The grid underneath the names

Every house the app draws is three independent answers:

| | |
|---|---|
| **entry** | bilevel (split entry) or not (main floor at grade) |
| **floors over main** | one or two |
| **garage** | none, attached, or attached with a storey over it |

Eight combinations from the first two alone; the trade names are the corners
people actually ask for:

| name | entry | floors over main | storey over garage |
|---|---|---|---|
| BUNGALOW | flat | one | optional |
| 2 STOREY | flat | two | optional |
| BILEVEL | split | one | no — yes makes it a MODIFIED BILEVEL |
| MODIFIED BILEVEL | split | one | **yes, by definition** |

**AND THERE IS NO FIFTH BUTTON.** Movie, 5 Sep: *"leave out the Modified 2
storey they can ADD A LEVEL."* The house that started this board does not
become a type. A drafter who wants a second floor over the main area of a
modified bilevel adds the level, the same way the extra levels of a side or
back split are added. Four buttons, unchanged.

**The names stay on the buttons.** Drafters ask for a bilevel by name, not
for a split entry with one floor over main. The grid is what the code
stores; the names are what the row says.

**SIDE SPLIT AND BACK SPLIT GET NO BUTTONS.** Movie, 5 Sep: *"we can do one
bilevel and they should be able to split it side or back won't matter."*

This section was wrong twice before it was right, and both wrong versions
are worth keeping because they are the two obvious readings.

**First wrong version:** they are the same house drawn a different way,
"same entry, same floors". Gilligan drew the three and killed it: a BILEVEL
splits up and down and is TWO levels; a SIDE SPLIT steps across the front
and a BACK SPLIT steps front to back, and both carry THREE or FOUR, each
half a flight off the one beside it. Which one you call "main" is naming.
They are not orientations of one house.

**Second wrong version, mine:** so the grid is short an axis -- it asks
"one floor over main, or two?" and a four-level back split cannot answer.

**What is actually true, Gilligan's:** the grid needs no extra axis, because
a build type decides only three things -- which section row it reads on the
PROJECT page, whether there is a floor over main, and whether the garage
roof drops. Split DIRECTION changes none of them. The section already
follows the cut line the drafter places, not the type, so a side split cut
the short way just shows what is there. One BILEVEL button. No new type, no
new row, nothing to build.

Movie settled it in his own words, 5 Sep: *"the design the user makes will
determine side or back split house if they want one."* The app offers a
bilevel; the drafter's walls, levels and cut line make it a side or a back
split. Nothing asks, nothing stores it, nothing needs to.

**BUT THE STOREY OVER THE GARAGE IS NOT JUST ANOTHER CARD.** Movie, 5 Sep:
*"modified bilevel it could be ADD a level you're right, the 2nd floor over
garage will need a special one though."*

He had already ruled this and SPEC-bilevel-section.md § "Types that do not
exist yet" carries it; this file was talking past it. The rule there, and
the test that decides it:

| type | levels |
|---|---|
| modified bilevel | FOUNDATION · ENTRY · MAIN · 2ND FL |
| bungalow, storey over the garage | FOUNDATION · MAIN · 2ND FL |
| modified bilevel with a 2nd floor | FOUNDATION · ENTRY · MAIN · **OVER GARAGE** · **2ND FLOOR** |

A bilevel's garage sits at ENTRY, a half storey down, so a storey standing
on it lands below one standing on MAIN -- too far for a ceiling to absorb,
so they stay two levels with stairs between. On a bungalow the garage
ceiling is RAISED until the two meet, so one card serves.

A BUNGALOW GETS ONE TOO. Movie, 5 Sep: *"a bungalow also need the 'floor
over garage'."* It is the easier of the two cases, being one card rather
than two, and it is the one where the ceiling height stops being typed and
starts being derived -- there is exactly one height that lands the ply
flat, so derive it and let it be overridden, the same `stored ?? derived()`
contract as ROOF HEEL.

**The test is the sheathing, not the elevation.** Movie: *"the 3/4" ply
floor will be continuous through the bungalow -- 2nd floor over the garage
and over the main floor areas."* Where one deck can run it is one level;
where it cannot it is two. Falsifiable in a way "close enough" is not.

So an ordinary card does not express it: a card is one elevation across the
whole building, and OVER GARAGE is a floor over part of it at its own
height. That is the special one, and it is the piece of this board with real
work in it.

Where the OTHER extra levels come from is the LEVEL CARDS, which already vary
independently of the type: a BUNGALOW is a 2 STOREY with the 2ND FL card
deleted, which is how `tests/dynamic-levels.spec.js:27` makes one. A
three-level side split is the BILEVEL button plus a level.

The lesson under it, since it caught both of us in opposite directions: a
grid that looks complete invites you to add rows to it. The question worth
asking first is whether the thing being added changes any answer the code
actually reads.

---

## The rule: a button asks only what its own name leaves open

- **MODIFIED BILEVEL** — the name already says there is a garage and a
  storey over it, so neither is asked. **Neither is the second floor over
  the main area**, and this is the one place the board changed its mind.
  Movie's first words were *"won't have the attached garage option because
  it needs a garage… but the 2nd floor over main area would be optional"* —
  an option on the button. His later ruling replaced it: *"leave out the
  Modified 2 storey they can ADD A LEVEL."* Optional is still true; what is
  optional is the LEVEL CARD, not a toggle on the row. So this button asks
  nothing, and MODIFIED BILEVEL 2 STOREY is a modified bilevel with a level
  added — no stored answer distinguishes them.
- **BUNGALOW** and **2 STOREY** — the floors are fixed by the name, so the
  free answers are the garage and what is above it. Movie: *"the 2 STOREY
  can have options: ATTACHED GARAGE ? and 2nd FLOOR OVER GARAGE."* The
  second only appears when the first is yes.
- **BILEVEL** — same two answers, with one catch: yes to a storey over the
  garage IS a modified bilevel. Skipper's proposal is to offer it anyway and
  let the answer change the stored type, since that is what the drafter has
  just described. Devin's call.

---

## Where the questions get asked

Movie: *"when they select each house they should be asked if they would
like an attached garage (the drivethru dog)."*

PROFESSOR GRUFF's drive-thru already exists (`gruff-drivethru.js`), and a
storey over the garage cannot exist without a garage, so the two questions
belong in one place rather than as two controls on the row.

Two constraints on it, both from how the row behaves today:

- **Once per drawing, not once per press.** The type can be changed after a
  build (NEW-5 allows it deliberately), and a prompt on every press is a
  nag. The ATTACHED GARAGE button stays, so the answer is changeable later
  without the prompt.
- **The first house press already fires a callout.** `projectCallout` —
  PROFESSOR GRUFF pointing at PROJECT — opens on the first type press unless
  `buildIntroOff`. Two prompts on one click is one too many; they need
  sequencing or merging.

---

## What the answers do to the geometry, and it is not symmetric

This is the part that decides code rather than wording, and the same four
words mean two different buildings:

- **On a 2 STOREY the floors are level.** A storey over the garage simply
  continues the house's own second floor across it, so house and garage
  share **one roof**.
- **On a MODIFIED BILEVEL the garage storey sits lower**, because it stacks
  on a dropped zone — the garage floor is down, so everything above it
  starts lower (SPEC-bilevel-section.md, "What sits above"). The house
  stands taller, so the garage takes **its own roof**.
- **On a MODIFIED BILEVEL 2 STOREY the second floor is over the main area
  only.** Movie: *"the second floor only over main area in 2 story bilevel
  (the garage 2nd level isn't as high as the area over the main level)."*
  So above the main floor there are two levels at different heights, and
  the garage again takes **its own roof**.

`_garageRoofDrops()` in MODEL.dc.html is where that lands, and with no fifth
type it has to learn the case from somewhere else. Today it reads the stored
type -- a BILEVEL always drops, everything else follows the floor count --
and #291 deliberately left MODIFIED BILEVEL on the floor-count rule rather
than sharing the roof, because a shared roof over a garage with nothing
under it is a hollow.

**That is now the open question with real work behind it.** A plain modified
bilevel and one with a floor added differ by a level card, not by a stored
answer, so the rule reads levels or it reads nothing. Whether "is there a
level above the garage storey" is a question the bone can ask cleanly is not
established, and it is the first thing to settle before any of this is
built.

---

## What it costs

- **A persisted answer**, or two — is there an attached garage, and is
  there a storey OVER THE GARAGE — which means new keys, a line in
  RULES-persisted-keys.md, and readers that normalise rather than guess.
  Same shape as `buildType`. **Not** the second floor over the main area of
  a modified bilevel: that is a level card, and level cards are already
  stored, so it costs no key.
- **No fifth build type.** Ruled out above: `BUILD_TYPES` stays at four, the
  section table grows no row, and nothing in NEW-5's vocabulary moves.
- **A change to the entry flow**, which is the part that wants Devin rather
  than a lane: it is the first thing a drafter meets.

## Open

~~The button name: MODIFIED BILEVEL 2 STOREY is long beside BUNGALOW.~~
**MOOT.** It is not a button, so it needs no room on the row. The name
survives as something drafters say, not as a control.
- **Whether the storey-over-garage answer is stored on its own key or
  derived from the type.** Derived is fewer keys and cannot disagree with
  itself; stored is what makes it an option on a 2 STOREY at all. Probably
  stored, but it is the kind of thing that reads obvious and is not.
~~Whether a BUNGALOW may have a storey over its garage.~~ **ANSWERED**,
Movie, 5 Sep: *"a bungalow also need the 'floor over garage'."* Yes. The
worry written here first -- that it draws a house taller than the house --
was misplaced, and SPEC-bilevel-section.md already had the geometry: on a
bungalow the garage ceiling is RAISED until the deck is continuous with the
floor over the main area, so it is one level, not a tower beside a
bungalow. One card, 2ND FL.

---

# REVISION — THE ROW BECOMES A MENU

**Movie, 6 Sep, in conversation with Skipper.** Still proposed, still needs a
number and Devin's word. This supersedes parts of the board above and says
which.

> *"i had a though about how the house menu operates. how about we just start
> with BUNGALOW, BILEVEL, DETACHED GARAGE. then if they pick each will have
> subcategories"*

## The tree

    BUNGALOW ------- 1 STOREY                    -> buildType 'bungalow'
             \------ 2 STOREY                    -> buildType 'twoStorey'
              then   ATTACHED GARAGE / NO GARAGE
              then   OVER GARAGE

    BILEVEL -------- BILEVEL          (1 STOREY) -> buildType 'bilevel'
              then   ATTACHED GARAGE / NO GARAGE
            \------- MODIFIED BILEVEL (1.5 STOREY) -> 'modifiedBilevel'
              no garage question -- the name already says it has one

    DETACHED GARAGE  -- children not yet named

**Three buttons between the pace button and BUILD HOUSE, where there are five
today.** The row stops implying that four houses are four equal choices.

## It changes no persisted key

`drawing-format.js:899` already groups the four types exactly this way:

    type === 'bungalow' || type === 'twoStorey' ? 'house'
      : SPLIT_BUILD_TYPES.includes(type) ? type : null

BUNGALOW and 2 STOREY have read as one row on the PROJECT page since the key
existed, and SPLIT is Movie's own family name for the other two (4 Sep). **The
menu shows a grouping the format has been storing all along.** `buildType`
keeps storing the LEAF, so the tiers are presentation.

## THE GARAGE ANSWER IS NOT A TYPE

A garage is geometry -- an outline carrying `garage: true`
(`drawing-format.js:737`) -- and any house type can have one or not. So
ATTACHED GARAGE / NO GARAGE is **an instruction to BUILD HOUSE**, not a label
being stored. The DRAWING stays the record of whether a garage exists.

That decides the disagreement case: a drafter answers NO GARAGE and then draws
one. The garage is real. Store the answer as a type instead and the file holds
a label contradicting its own geometry.

## THE GARAGE QUESTION IS SKIPPED FOR MODIFIED BILEVEL ALONE

Movie, 6 Sep: **"no garage q needed"** under BILEVEL -- then, minutes later:

> *"oh ya - the BILEVEL single storey could have either attached or no garage
> i forgot"*

So the skip belongs to **MODIFIED BILEVEL only**, and the board above already
had that right at "a button asks only what its own name leaves open":
*"the name already says there is a garage and a storey over it, so neither is
asked."* A plain BILEVEL asks, like the bungalows do.

**Recorded because the wrong reading was acted on for a few minutes.** Skipper
read the skip as covering the whole branch and reasoned from the building --
a bilevel's garage sits at ENTRY, so the form implies one -- which is a good
argument for a false premise. Bilevels are built without garages. An argument
that explains a fact is not evidence for it.

**What the correct reading costs the half-levels gate.**
`RD-DOCUMENTS/ORDER-inbetween-levels.md` gates the two slots on build type
alone, and that was written believing every split house had a garage. It
splits in two:

- **ENTRY gates on the type, as written.** A bilevel has a split entry whether
  or not a garage is attached; that is the form itself.
- **OVER GARAGE cannot.** It needs a garage to stand on, and a plain bilevel
  may have none. Either it belongs to MODIFIED BILEVEL alone -- where the type
  does imply one -- or it keeps the type gate AND asks the drawing.

That is the open question below, and it now decides code rather than wording.

**One thing the tree does dissolve.** Under the old row, answering yes to a
storey over the garage silently changed the stored type behind the drafter
(the board's "one catch"). Under the tree it is the name they picked:
MODIFIED BILEVEL is the 1.5 storey, and choosing it is choosing the storey.

## OVER GARAGE MEANS TWO DIFFERENT BUILDINGS

> *"the OVER GARAGE for the bungalow should be worked in there too"*

Agreed, and the board's own asymmetry section already says why it cannot be
one mechanism:

- **Under BUNGALOW it is NOT a half-level.** The garage ceiling is raised until
  the deck runs continuous with the floor over the main area, so the storey
  over the garage is the ordinary upper floor CONTINUING ACROSS -- one level,
  one roof, one 2ND FL card.
- **Under BILEVEL it is level id 4**, its own level with its own roof, because
  the garage stacks on a dropped zone and the deck lands too low to join.

**The sheathing is the test** (`ORDER-inbetween-levels.md`): where one deck can
run it is one level; where it cannot it is two. Same two words on the menu,
two mechanisms underneath, and building them as one is the trap.

## Open

- **Does a plain BILEVEL offer the OVER GARAGE row?** Sharper now that a plain
  bilevel may have no garage. By these labels MODIFIED BILEVEL is DEFINED as
  the one that has it -- that is what the 1.5 counts -- so ENTRY belongs to
  both split types and OVER GARAGE to the modified one alone. The alternative
  is to offer it to a plain bilevel that HAS a garage, and accept that adding
  it makes the drawing a modified bilevel while the label still says BILEVEL.
  Movie's call; it decides whether the gate reads the type only or the type
  and the drawing.
- **What sits under DETACHED GARAGE.** `GARAGE_FOUNDATIONS.detachedGarage` is
  `['thickened', 'gradebeam', 'frostwall']`, in the order Movie said a drafter
  should see them, which is the obvious guess and is only a guess.
- **The parent name is narrower than its contents.** BUNGALOW containing
  1 STOREY and 2 STOREY means a drafter wanting a two-storey presses BUNGALOW
  to find it. The format calls that family `house`. Taste, and Movie's.
- **Where the drive-thru fits now.** The section above put the garage question
  in PROFESSOR GRUFF's drive-thru because a row has no room for it. A menu
  has room. Whether the questions still want the dog is open.
