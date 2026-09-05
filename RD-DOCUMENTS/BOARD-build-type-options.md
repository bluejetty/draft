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
stylistic — see the grid below: as buttons, the five become eight.

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
| MODIFIED BILEVEL 2 STOREY | split | two | yes |

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

Where the extra levels come from is the LEVEL CARDS, which already vary
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
  storey over it, so neither is asked. The one free answer is the second
  floor over the main area. Off is a modified bilevel; on is a
  MODIFIED BILEVEL 2 STOREY. Movie: *"won't have the attached garage option
  because it needs a garage… but the 2nd floor over main area would be
  optional."*
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

`_garageRoofDrops()` in MODEL.dc.html is where that lands. It reads the
stored type today: a BILEVEL always drops, everything else follows the floor
count. Under this proposal it reads the storey-over-garage answer as well,
and MODIFIED BILEVEL 2 STOREY drops where a plain MODIFIED BILEVEL does not.

---

## What it costs

- **A persisted answer**, or two — the garage question and the storey
  question — which means new keys, a line in RULES-persisted-keys.md, and
  readers that normalise rather than guess. Same shape as `buildType`.
- **A fifth build type**, `modifiedBilevel2Storey`, if the names stay on the
  buttons. `BUILD_TYPES` grows by one, the section table grows a row, and
  `upperFloorForBuildType` answers true for it.
- **A change to the entry flow**, which is the part that wants Devin rather
  than a lane: it is the first thing a drafter meets.

## Open

- **The button name.** MODIFIED BILEVEL 2 STOREY is long beside BUNGALOW.
  Movie has said the words; whether they fit the row is a layout question
  nobody has measured.
- **Whether the storey-over-garage answer is stored on its own key or
  derived from the type.** Derived is fewer keys and cannot disagree with
  itself; stored is what makes it an option on a 2 STOREY at all. Probably
  stored, but it is the kind of thing that reads obvious and is not.
- **Whether a BUNGALOW may have a storey over its garage.** The grid says
  yes and Movie has said garage height matters to him — *"10 garage wall
  nice… lots of bungalows have extra space there"* — but a storey over a
  bungalow's garage is a house taller than the house, and nobody has said
  whether that is drawn or refused.
