# HANDOVER — 16 Oct 2026

Written at the end of a session that ran out of room, for whoever picks the
work up next. Everything Movie asked for on 16 Oct is in here, in his own
words, with the decisions already taken and the questions still open marked as
such. Nothing below is a guess dressed up as a ruling: where I decided
something myself, it says so and says why.

`main` is at **7410dd1**. Nothing is open on GitHub.

---

## 1. Where the work is, and how it is done

**The app is `bluejetty/draft` — Rough Drafter**, a browser-based residential
architectural drafting app. `MODEL.html` (~27k lines) is the live editor.
`MODEL.dc.html` is the OLD page and is only a module host for
`tests/geometry-2d.spec.js` — do not edit it as if it were live.

**Standing orders from Movie, which hold whatever else a task says:**

- **Confirm the repo and branch before pushing.** He owns two GitHub accounts
  (`bluejetty` and `dzmarkup`) with several repos between them, so a change can
  look right and still land in the wrong place.
- **Push to a branch and let him merge the PR. Never push to `main`.**
- **Hand over a backup zip with the work** when handing work over outside a
  PR: the changed files at their real paths, plus a `git bundle` of any
  unpushed commits.
- **Do not ask him about beams, columns or the engineered OWJ.** His words:
  *"don't ask the user about placing beams and columns or the engineered owj,
  just make the decision based on spans don't ask the user, they can adjust it
  later if they need too."* Decide, state what you decided, move on.
- He reads screenshots and marks them up in GIMP. Red/purple/blue circles in
  his images are the spec — read them as carefully as the words.

**Test and gate conventions** (they are the house style, not optional):

- Specs live in `tests/*.spec.js` and are written as prose about the rule,
  quoting his own words, with the reasoning for every non-obvious assertion.
- Every feature gets a **mutation gate** in `proto/<name>-mutants.js`: a list
  of defects that still render, each applied to a real file, with the spec run
  against it. A gate **refuses to run on a dirty tree** (it restores with
  `git checkout -- <file>`) and **runs the baseline first** — a spec that is
  already red kills every mutant and prints a perfect sheet over broken code.
- A mutant that cannot be demonstrated is **removed with a written reason**,
  never softened. A `SKIPPED` mutant counts as AMBIGUOUS and fails the sheet.
- CI runs `proto/*-harness.js` plus Playwright in **6 shards**. The mutation
  gates are local-only. Each run needs its own `DRAFT_TEST_PORT`.
- **Never run Playwright with `--workers=2`.** The config refuses it: parallel
  workers on one machine wipe each other's `localStorage` and IndexedDB
  mid-test. Shard instead.

**A trick worth keeping:** to work two branches at once without disturbing a
running gate, use a git worktree and symlink `node_modules` into it:

```
git worktree add --detach /tmp/claude-0/work <sha>
ln -s /home/user/draft/node_modules /tmp/claude-0/work/node_modules
cd /tmp/claude-0/work && DRAFT_TEST_PORT=4490 npx playwright test --shard=4/6 --workers=1
```

The machine has 4 cores. Two concurrent suites is fine; three makes timing
tests flake (see §5, the 2.50 ms reading).

---

## 2. What shipped on 16 Oct

| PR | what |
|---|---|
| #744 | DRAW OUTLINE seeds the first corner on the bullseye |
| #745 | the 7 ft rule at a stair — move it to the wall, or frame the open side |
| #746 | **TOY is a light, not a button** |
| #747 | a spike in a traced loop was cancelling the roof's junction rule |
| #748 | the SITE card says OK |
| #749 | the BONEYARD's levels stand between the two windows |
| #750 | the roof's own lines, and a BG button on every level |

**#746 is the one with the longest reach.** TOY is no longer a board that
refuses tools — it is a lamp that says how fine the numbers are. Every drawing
**starts on TOY**, every tool is available on every board, and the first number
a whole foot cannot hold moves the drawing to DRAFTING by itself. The drafter
never chooses; he is told. Consequences that bit five separate specs:

- A fixture that names no `board` is on **TOY**, not DRAFTING. Several specs
  said "no press, so this must be TOY" while their fixture carried
  `board: 'drafting'` — read the fixture, not the comment.
- There is **no press onto DRAFTING any more**. A check that needs that board
  must name it in the saved file.
- **TOY §1 refuses a new run while one is unfinished.** Arming the tool again
  *is* the new run it refuses, and Escape cancels a run rather than committing
  it. Two perf samples drew three or four separate two-tap wall runs and had to
  move to `board: 'drafting'` in the fixture.
- The lamp reads `TOY` / `1 FT · 90°` or `DRAFTING` / `ANY LENGTH`, and it is
  the fourth control in the mode corner where a `TOY DRAFTING` pair used to be.

---

## 3. The queue

Ordered as he gave them. Every quotation is his.

### 3.1 — TOY cabinets on a 6" grain

> *"in the TOY mode we should be able to add CABINETS right? but maybe they all
> need to be sized to the nearest foot. or how about for the CABINETS we allow
> those to shift extra to 6" scale so we could have 1ft, 18" 24" 30" 36" 42"
> 48" etc"* … *"a little more accuracy we should allow for cabinets"*

Cabinet runs get a 6" grain of their own, and **a half-foot there must not turn
the TOY light off** the way a finer number elsewhere does.

The machinery is already there: `toy-constraints.js` has `HALF_FOOT_FT = 0.5`
as "the one exception to the foot" (added for exterior walls), and
`quantiseFeet(delta, stepFt)` already takes a per-object step with
`stepFor(wall)` reading `wall.stepFt`. The CABINET fixture is
`fixture-kinds.js` (`id: 'cabinet'`, `widthFt: 3`, `run: true`).

`toyCouldMakeLength` in MODEL.html is what decides whether a typed number
promotes; it asks `quantiseFeet`, so the grain and the promotion rule stay one
thing. Cabinets need that question asked with their own step.

### 3.2 — TOY interior walls on a 6" grid off the exterior corners

Four messages, and the order of the rules matters:

**(a) The grid is anchored on the exterior corners of the house.**

> *"this 6" spacing should be based on the 1ft exterior grid … if the line
> isn't connected to a CORNER, the GRID used for the interior 6" snap grid will
> be based on the 1ft exterior house wall corners"*

and, correcting an earlier wording of mine:

> *"its not measure off inside face - the 6" grid is based on the ext corners
> of the house (1ft grid)"*

The outline's own 1 ft grid, halved. **Not** the inside faces, **not** a
per-room datum, **not** the world origin.

**(b) The inside faces are hard snaps, and they beat the grid.**

> *"the interior walls allows the connection at the 5.5" corner (usually
> default) rather than the 6" so it lines up and the stair opening is a similar
> line-up method which deviates from the 6" grid (in most cases)"*

> *"if the interior face of exterior wall is the connection point i think that
> will solve problems for us"*

**Why this must be written into the code:** 5.5" and 6" are half an inch apart
and indistinguishable by eye. If the grid won, every interior wall meeting an
exterior corner would miss the inside face by ½" — a drawing that looks right
and builds wrong. So the face must be **preferred** wherever both are in reach,
and the snap tolerance must be comfortably more than that half inch or the grid
steals it.

The edge of a floor or stair opening is the other hard snap of the same kind:

> *"then the edge of the floor / stair openings will need to be the other
> location maybe off the GRID SNAP where the int walls will need to align"*

It lands at 14½" on the lowest floor and 5½" above — off-grid in most cases,
exactly as he says.

**(c) The offset at a hard snap is read off the wall type, never a constant.**

> *"at the corners the int walls will just move to the req 1/2" for 5.5" wall
> or whatever in need for the thicker (probably the foundation wall) or thinner
> wall (maybe 2x4 wall ext sometimes)"*

`WALL_TYPES.totalIn` is the number: `stud_2x6` 5.5, `stud_2x4` 3.5,
`concrete_8` 8, `insulation_6` 6.5, `icf` 11.25 / 13.25. **Walls stay 5.5"** —
sheathing lives outside the perimeter line and is not in the assembly
(*"don't worry about that, leave the walls at 5.5""*).

The stair opening edge is derived the same way: `stairOpeningSetbackFt` is
`max(planIn, concrete_8 + insulation_6)` = 14.5" on the lowest floor, 5.5"
above.

**(d) The wall body is placed against the line by justification.**

> *"allow the user to select the 'LEFT SIDE' CENTERLINE or 'RIGHT SIDE' for
> placement of the actual wall, based on where the LINE is positioned"*

LEFT/RIGHT are relative to the line's direction of travel (first point to
second), shown live as a ghost body while drawing — "left" means nothing
otherwise. Sticky between walls; CENTERLINE the default.

**At a hard snap the side is not the drafter's to get wrong:** the snap
justifies away from what it caught — into the room off an exterior face, away
from the hole off an opening edge — so a stair opening keeps its clear size and
a room keeps its clear dimension.

**Storage:** one enum, `justify`, beside the existing centreline. The reference
line is the centreline offset by ±t/2, so nothing downstream needs a new
geometry field. On a wall-type change, recompute the centreline so the
**justified side** stays put — the room keeps its clear dimension instead of
the wall silently shifting.

**Where:** `MODEL.html`'s `offGridBy` / `landingStep` (~24894) measure against
the world — `pos - Math.floor(pos)` with `FOOT = 1`. They are what generalise
to `(pos - datum) % step`, with MODEL supplying the datum the way it already
supplies which walls are exterior. `toy-constraints.js` quantises the MOVE and
never the position, deliberately (31 Aug: the toy never silently corrects what
it did not create) — a wall being **created** now is the toy's own, so the toy
may place it on its own grain; an old wall nobody touched is never re-gridded.

**A 6" position must not turn the TOY light off**, and neither may a snap to an
interior face or an opening edge: those offsets come from wall thickness, not
from typed precision.

**Decided, not asked:** the foundation's inside face is 8" in while MAIN's is
5.5", so a wall snapped to each level's own face does **not** stack between
floors. Default to the level's own face (true rooms on each floor) and offer
the wall below as a reference line, so stacking is a snap he can take rather
than one he is given.

### 3.3 — The garage square: nothing stands where the car goes

> *"on a 2 storey garage the stairs can't overlap where the garage door / car
> will be or the landing area for the man door (42"x42" landing. the garage
> square should be sized according to the garage door width and height (match
> plus add 1ft on top and to each side)"*

then, after the parking research, and these supersede the figures above:

> *"lets go 20ft total 'height (length) for square"* … *"(not +4) just 20"*
> … *"actually on the sides only make it increase by 6" so the colms can know
> they can be placed between the 2 doors"*
> … *"so the stairs of other stuff to interfer with the vehicle shouldn't
> locate there"* … *"no columns in that area either"*

**THE SQUARE, one per overhead door:**

- **width** = the door's own width **+ 6" each side** (his 6'8" doors → **7'-8"**)
- **depth** = **20'-0" total** from the inside face of the door wall, into the
  garage. 20 is the whole number — the earlier "+1 ft on top" and "+4 ft on
  top" are folded into it, **not added**.
- capped at the garage's own depth, so the rule always has an answer.

**The 6" is not a clearance guess.** It is what leaves the pier between two
doors free so a column may stand there. A foot each side closed that gap and
left nowhere legal to carry the floor over a two-bay garage.

**It is a floor keep-out for everything, not a stair rule.** Nothing that
stands on the garage floor may be inside it: the stair and its well, a column
or pile, a fixture, an interior wall. **Overhead is a different question and is
allowed** — a beam crossing the bay is how a garage is framed.

**The other keep-out:** a **42" × 42" landing** in front of the man door, same
rule.

**Consequence worth saying out loud in the app:** his garage is about 20 ft
door wall to back wall, so a 20 ft square takes the whole depth. What is left
is the pier between the doors and the width beside the bays. Better for the app
to say "this garage needs more depth" than to quietly stand a stair, or a post,
in front of a car.

**The research behind 20 ft** (so nobody redoes it): no national standard,
every municipality sets its own, but they cluster — Calgary 5.9 m (**19'-4"**)
for a garage stall serving a dwelling; Burlington ON 6.0 m (**19'-8"**)
interior, 5.5 m (18'-0") unobstructed; another ON bylaw 3.0 m × 6.0 m;
Wainwright AB 6.5 m (**21'-4"**). Vehicles: sedan ≈ 15–16 ft, mid-size SUV ≈
15–16.5 ft, full-size crew-cab pickup ≈ **19–20.5 ft**.

**Where:** `stairPlacementLegal` (MODEL.html ~17995) is the predicate for the
stair — it already asks "every well corner inside the interior ring" and "the
well clear of the carrying beams", and the square is a third question of the
same shape. `stairAutoFit` scores candidates and must prefer a legal one. The
auto column / pile pass is the other caller that has to ask, and it should
**prefer** the pier between the doors rather than merely tolerate it. Door
sizes come off the fenestration records, so the square is derived, never typed.

No car pad or garage square exists in the code today (grepped: no
`carPad` / `garageSquare` / `CAR_*`), so this is a new derived object.

**Knock-on, flagged to him and accepted:** if a bay is wide enough to want a
post under the floor above and the square forbids one, that span is carried by
a beam to the walls either side instead — a longer, deeper beam rather than a
post in the middle. That is the engineered-beam path the garage already uses
past its span limit; it will just get used more often.

### 3.4 — A beam may not land over an opening

> *"the beam cant rest over the garage opening or door opening either, they
> should have a solid support column built into the wall below where the beam
> rests (can't be opening)"*

and, of the beam in his own screenshot: *"i think that beam actually hits the
wall"* … *"which is good"* — so this is a rule to enforce so it cannot drift,
not a bug report.

**Two halves, one rule:**

1. **Refusal** — a beam's bearing point may not fall inside any opening on the
   wall it lands on: a garage door, a door, a window. A point load landed
   mid-span on a lintel is the defect.
2. **What replaces it** — a solid support column built **into** the wall below
   the bearing, carried down. Not a column standing beside the wall: a post
   inside the wall assembly, which is how the load actually reaches the footing.

The test is not "is the point inside the opening" but "is there room for the
post **and** its bearing clear of the opening". `_clampOpeningToWall` already
reserves lintel bearing on the same principle — see
`tests/opening-bearing.spec.js`: NBC Table 9.23.12.3.-A note (4) gives 1½" up
to 3 m of span and 3" over, plus Movie's own *"measured from inside of exterior
wall (5.5" typ)"* and *"use a 6x6 post"* where no wall stands there.

**Ties to §3.3:** on a two-bay garage the pier between the doors is the one
piece of that wall both rules allow — no car square over it, and solid wall for
a post. That is where a beam crossing the bays should want to land, and the 6"
side figure exists to keep it available.

### 3.5 — Stair end beams: only parallel, and only past 10 ft

> *"when the stairs are alligned perp to the main beam like in ths photo above,
> we don't need beams on the short ends of the stairs, only when it is ll and
> there is 10ft or more span of floor until the next beam or ext. wall"*

**Both conditions must hold before a short-end beam is placed:**

1. the well runs **parallel** to the main beam (perpendicular → no end beams at
   all)
2. **10 ft or more** of floor span from the well to the next beam or exterior
   wall

**Why it is the right shape** (worth keeping so nobody "fixes" it): joists span
perpendicular to the beam. A well set perpendicular to the beam runs **with**
the joists — it interrupts few, the trimmers down its long sides carry what it
does, and the short ends are headers with almost nothing on them. A well set
parallel cuts **across** the joists along its whole length, so each short-end
header gathers every cut joist, and past 10 ft of remaining span that header is
a beam.

**Not the same as the open-side beam shipped in #745**, which frames the long
side the mid-span beam does not already carry. This is the short ends, and it
is a refusal more often than a placement.

**Read rather than asked, correct it if wrong:** "the main beam" where a floor
carries several means the one carrying that bay; the 10 ft is measured from the
**well's end** to the next support, not from the stair's centre.

**Where:** the stair framing pass in MODEL.html (`stairOpenSideFraming` /
`placeStairSideFraming`, added for #745) and `build-house.js`'s
`garageStairHeader`, which already picks an edge off `{ axis, supports }` — the
axis test it needs is exactly "is the well parallel to the beam".

### 3.6 — The long side of a stair well

> *"when long side is exposed to 10ft or more floor span it should have a
> column on each end of the opening and a flush beam along the opening (edge of
> beam alligned with edge of opening (center a few inches inside the floor)"*

- **trigger** — the well's long side is exposed to 10 ft or more of floor span
- **beam** — flush, along the opening, with its **edge on the opening's edge**,
  so its **centreline** sits half a beam width inside the floor
- **columns** — one at each end of the opening

**This restates what #745 shipped, in two ways, and both are changes:**

1. **The offset is derived, not a constant.** #745 set the centreline
   `STAIR_BEAM_CLEAR_IN = 2"` off the well edge. His rule makes the offset half
   the beam's own width, so the **face** lands exactly on the opening edge
   whatever the beam is. The two agree closely by accident on a 3½" beam — a 2"
   centre puts the face ¼" inside — which is why the flat 2" looked right.
   `tests/model-html-auto-stair` pins the 2" rule and moves with this.
2. **The threshold is 10 ft, not 7.**

**Reading I gave him, to build unless he says otherwise** — the two rules
measure the same strip and answer different questions, so they stack:

| strip beside the well | what happens |
|---|---|
| under 7 ft | move the stair to the wall *(unchanged, #745)* |
| 7 – 10 ft | a room, but a span the joists carry alone: nothing added |
| 10 ft and up | the flush beam on a column at each end |

No gap, no contradiction, and 7–10 ft of joist span needing no beam is
ordinary. He has not objected; if he wants the beam from 7 ft, collapse the
middle row.

### 3.7 — Type straight into LENGTH, TAB to ANGLE

> *"when they get to this position and they are pointed a direction, can we
> allow them to start entering numbers and it will start entering into the
> LENGTH texbox without having to click on the texbox, just put it straight in
> there, unless they press A where they will … enter the ANGLE textbox and
> enter and angle"*

While a run is live and a direction is taken, a digit (or `.` `'` `"` `-`)
typed anywhere goes into the LENGTH box as if typed there — focus follows the
first keystroke. Enter commits the segment; Escape cancels the run, as now.

**Not `A`.** `A` is SHAPE in the default profile (`profile-manager.js`:
`shape: 'A'`) and `P` on the office profile, so pressing it mid-run would arm a
tool rather than move a caret. **Recommended TAB** — what AutoCAD and Revit
dynamic input both use, already the "next field" idiom, and not a tool letter
in any profile. `<` is free as a dedicated second key and is literally the
angle symbol (`@10<45`). *He has not answered this yet.*

**What the number may look like:**

> *"if they type 14 (it would be interpreted as 14ft) if they type 14.5
> (14'-6") if they type 14-6 or 14 6 or 14'6 or 14'6" or 14'-6" all interpreted
> as 14'-6""*

**Measured against `formatters.js` `parseArchitecturalLength` — five of the six
already work:**

| typed | reads as |
|---|---|
| `14` | 14'-0" ✓ |
| `14.5` | 14'-6" ✓ |
| `14-6` | 14'-6" ✓ |
| `14'6` | 14'-6" ✓ |
| `14'6"` | 14'-6" ✓ |
| `14'-6"` | 14'-6" ✓ |
| **`14 6`** | **error** — the only gap |

The parser has branches for the foot mark, the hyphen, a trailing inch mark and
a bare number, and none for "number space number". One branch to add.

**Decided, say it when it lands:** the same branch makes `14 1/2` parse, and it
reads as **14 feet and half an inch** — consistent with this field's rule that
a bare number is feet, and with `14 6` meaning 14'-6". AutoCAD reads `14 1/2`
as 14½ **inches** in an architectural field, so this is a deliberate
difference, not an oversight.

**Watch:** the typed number is what turns the TOY light off
(`promoteForNumber` on the length box, #746). Typing straight in must go
through the same path, or TOY would keep its light on while an off-foot length
is typed — the exact hole #746 was built to close. And the keystroke must not
reach the tool-letter handler on the way: the page's keys mean something
different while a run is live, and the key handler has to **state** that rather
than discover it.

### 3.8 — DRIVE-THRU: two banners with arrows, on both skins

> *"i'd like to make the options more obvious by adding them once the user
> selects the house type, for those 2 banners and arrows (red and white) to pop
> up down below. I circled the stuff on the left - when they click that stuff
> BONE / or the BANNER on the left it will DRAW the AUTOHOUSE at prespecified
> dimensions. if they click the stuff circled in green (arrow or the other
> banner on the right) they will get to DRAW the HOUSE OUTLINE"*
> … *"leave the other links up top beside the dog too"*

LEFT banner + arrow at the BONE → the autohouse at preset dimensions
(`#dt-build-now`). RIGHT banner + arrow → the outline trace (`#dt-outline`).
Both appear only once an entry is chosen — the same moment the sign's two text
links are offered today (`paintSign`'s `canTrace`). **The two text links beside
Gruff stay**: four doors to two verbs, which is what he asked for.

**Both skins, and the second is not a copy of the first:**

> *"on the ROUGH - drivethru version can you do it similar to the change on the
> Ruff version"*

He drew it as one row under the tiles:

```
[ DRAW HOUSE ]  →  (house)  →  [ DRAW HOUSE OUTLINE ]
```

**The ROUGH skin has no bone to point at.** MODEL.html hides both `#dt-screen`
and `#dt-bone` under `html[data-theme="rough"]` and gives `#dt-tiles` the whole
sheet (left 6%, top 13%, 88% × 72%). So on paper the arrows point at the HOUSE
press in the middle of the row, and the banners sit under the tiles rather than
beside a bone. Same verbs, same handlers, same "only once an entry is picked".

**And the press wears its number:**

> *"add the extra HOUSE BUTTON above in the popup area with the NUMBER on it
> (and also add the number to the one in the RUFF Drive-thru version"*

The number is the **bone wallet's balance**. `shell-bars.js`'s `BONE` markup
carries `<span id="bone-balance" data-bone-balance>` on the **bottom-bar**
press, and under ROUGH that press's art is a house rather than a bone — which
is why he calls it the house button. The press **inside** the sign
(`#dt-bone`) has the art and no balance today. So: ROUGH's house press in the
new row carries the balance, and RUFF's `#dt-bone` gets it too. **One wallet
read in two places, not a second counter.**

The two verbs exist and are tested (`model-outline-draw.spec.js`) — this is
presentation. The banner on the left and the bone (or the house press on
paper) are the same press, so they share a handler.

---

## 4. Older carry-overs

Still open, from before 16 Oct.

**BONEYARD: beams, columns and wall corners on the frame.** *"can you show the
columns and beams being produced onto the BONEYARD frame, i'd like to see the
beam and columns in here too"*, then *"i think it had wall corners before too,
that would also be nice it looksed good"*. The beams and columns are in the
drawing; nothing in BONEYARD.html reads them. For the wall corners, **find what
drew them in git history** rather than inventing a different mark.

**The upper floor over the garage has an EXT wall and door it should not.**
*"the upper floor doesn't need the 'ext' wall and door"* — the wall down the
left side of the room over the garage, where it meets the house, drawn as
exterior with a door in it. Needs: which wall record, and which rule raises it
(`placeBilevelFraming` / the fill walls in the overlap / the entry deck walls).

**AUTO DIMS must not string anything at an angle.** *"don't put any autodims at
angles - in angled houses, the drafter should add those angled dimensions
himself"*. Every auto string orthogonal; an angled wall still gets its
orthogonal extents strung. `auto-dims.js`. He added *"its not too bad though,
getting there"* — a refinement, not a breakage. **Blocks the foundation rows
below.**

**LAYOUT: a SCALE picker in the Edit in Model Space dialog.** A SCALE row under
the Y/N row; collapsed it shows the viewport's current scale highlighted,
clicking opens the full architectural ladder smallest to biggest, scrollable.

**FOUNDATION plan: the four exterior dimension rows, in order** (blocked by the
angle rule above). Innermost to outermost: **BEAM** (from each corner of that
wall to where a beam lands on it) · **FENS** (openings / grade-beam door bucks)
· **EXT CORNERS** · **FULL WIDTH**. Two refusals: *"leave those 2 out BEAM/FENS
if those aren't on that side of the building"* and *"don't show any INTERIOR
wall measurements or wall thicknesses."* Already right and must not regress:
*"those piles on the main house from the inside corner to the back are perfect
marked nicely too with colm dimensioned properly."* Not this job: *"the front
area landing colms and beams i will need to fix later."*

**Elevations: hidden-line removal.** Long diagonals run clear past the building
and the garage roof's rake paints over the house wall behind it; E4 reads as a
flat top with a step instead of a slope. **The geometry is right** — the plan
and roof plan agree — the elevation painter draws every body's edges with no
hidden-line removal. Flagged after a roof reshape turned out to be answering a
drawing fault with a building change.

**The lower roof is cut gable wherever it runs along a 2nd-storey wall.**
*"the main rule for that connection should be the roof should be designed in a
way (usually using gable design) to slope the main roof AWAY or to the SIDES of
the 2nd storey wall lines"* and *"the rest of the roofs not involved in the
connection to the second floor can be drawn as a normal HIP style roof that the
user can change to gable if they desire"*. #747 fixed the spike that was
cancelling the rule; **the partial-overlap split is still unbuilt** —
`raiseRoofOver`'s `against` only gables an edge shared END TO END with the upper
loop, so an edge that runs along the wall for *part* of its length stays an eave
and slopes into the junction. Also: a roof corner must be an outline corner, no
bevels.

**Dormers on a sloped roof.** *"i will need an option to add a dormer on a
sloped roof too"*. Nothing exists. Needs placement on a face, the face cut
around it, its own ridge and valleys in the roof skeleton, and the elevation
drawing it. **Ask him which kinds (gable, shed, hip) and what sizes before
building.**

**Gable corner eave detail.** One popup, four answers — 1 NORMAL GABLE EAVE
(soffit triangle flush with wall) · 2 NORMAL GABLE EAVE 2 (flush with the end
of the roof overhang) · 3 porkchop · 4 full front RAKE — raised from two doors:
the first gable on the ROOF PLAN, and clicking the eave triangle on EXT FINISH.
Plus: clicking a roof face on EXT FINISH toggles that end hip↔gable and raises
the same popup. What exists: `profile-manager.js` `GABLE_CORNER_STYLES =
flat | return | porkchop | boxed`; `roof-types.js` `cornerStyleOf`;
`geometry-2d` halves the gable-edge overhang for porkchop/boxed; MODEL's ROOF
tool already flips an edge hip↔gable. What is new: the popups, the toggle **on
EXT FINISH**, and **per-corner** rather than per-roof storage.

**Other standing items:** municipal bylaws; more eBay book links for the entry
shelf (affiliate URLs must be stored exactly as sent — campid/customid/toolid/
mkrid/mkevt intact); retiring BLUEJETTY after the logo test.

---

## 5. Questions waiting on him

1. **TAB or `<`** for the angle field (§3.7). TAB recommended; `A` is taken.
2. **The stair long-side threshold** (§3.6): is 7–10 ft really "nothing
   added", or should the flush beam start at 7?
3. **Gable corner detail #2** (§4): is "soffit triangle flush with the end of
   the overhang" the existing `return`, or a fifth detail?
4. **Dormer kinds and sizes** (§4).
5. **The two remaining 45s on his traced house** — the crickets at open inside
   corners. He looked at the roof plan on 16 Oct and said *"looks good
   though"*, so they stay unless he says otherwise. Note that the **hips** at
   45° from every outside corner are not a defect: two eaves meeting at 90°
   with equal pitch always bisect at 45°. The chamfer at the **inside** corner
   is `cricketRing` cutting the reflex corner back 2 ft each way, from his own
   ruling *"the valley 2ft from the corner so 2ft of extra watershed rather
   than valley running into the corner"*.

---

## 6. Facts measured this session, so they are not re-derived

- **`parseArchitecturalLength` handles five of his six length forms** (§3.7).
  Only `14 6` fails.
- **`WALL_TYPES.totalIn`**: `stud_2x4` 3.5, `stud_2x6` 5.5, `insulation_6` 6.5,
  `concrete_8` 8, `icf` 11.25, `icf_13` 13.25, `pt_wood_fdn` 8.
- **`A` is SHAPE** in the default key profile, `P` on the office profile.
- **Parking**: Calgary 5.9 m, Burlington 6.0 m, Wainwright 6.5 m; crew-cab
  pickup 19–20.5 ft. (§3.3)
- **`roofSkeleton(roof)`** in `geometry-2d.js` returns the hip/valley/ridge
  arcs as `{ a: {x,z}, b: {x,z} }` — used by #750 for the boneyard's thin
  lines, and the roof plan draws the same ones.
- **`BL.layout(levels, deg, w, h, margin = 30)`** fits the bone to its box and
  centres it, so a narrower pane *is* a smaller model.
- **A timing test will flake under load.** `model-html-cut-views`'s section
  budget read **2.50** against a limit of 2.5 with three suites running; alone
  it reads **2.00**. Check for contention before believing a perf red.
- **`model-html-gestures` counts every control on the page** and holds the
  parity table against that list. Any new button or link needs a line there,
  with a note saying which absence row it touches (usually none).

---

## 7. If you are the new session reading this

The work is in `bluejetty/draft`. Start by reading `CLAUDE.md` in that repo if
one is present, then this file, then the section of §3 you are about to build.

Do not start any of §3 by guessing at the numbers — every one of them is his,
and every one was revised at least once in conversation before it settled. The
figures in this document are the settled ones.
