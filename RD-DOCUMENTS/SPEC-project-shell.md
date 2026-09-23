# SPEC — the PROJECT page takes MODEL's shell

**Movie, 23 Sep 2026**, across one conversation. Gathered here because it
arrived in seven messages and none of them is the whole picture.

Status: **SPECCED, NOT BUILT.** The palette half is the only part started.

---

## The brief, in his words

> *"how hard would it be to make the PROJECT page get all the same colors,
> text style etc as the MODEL page, and also the TOP and BOTTOM bars"*
>
> *"should remove the 'intrument panel' that is located top center (don't
> think we will need it in this part PROJECT area)"*
>
> *"the side collapsable areas i think i'd like to use those for the area to
> enter the information in text"*
>
> *"i like how the model page doesn't scroll down"*
>
> *"a smll box for each type DETACHED GARAGE / BUNGALOW / BILEVEL. that will
> open up larger to show more detail of the one you are interested in"*
>
> *"a column of the building parts, with the editable text boxes in there,
> house on right side, and garage info / textboxes on left side collapsable
> sidebar"*
>
> *"the sections will be displayed in the middle"*, in the *"main area"*
>
> *"also a little tab on left for PROJECT INFO"* — *"the site information lot
> legal desctiption etc"* — and its position: *"tab on UPPER left for
> PROJECT"*
>
> and, on what the rails do NOT carry:
>
> *"the sidebars in the PROJECT AREA won't contain the stuff that is there in
> the MODEL area (layout previews, drafting tools etc)"*

## The layout

```
+-- top bar, without the instrument panel --------------------+
| [PROJECT     |                          |   HOUSE          |
|   INFO]      |     the SECTIONS         |  [HOUSE INFO]    |
| [GARAGE      |                          |                  |
|   INFO]      |     (the MAIN AREA)      |                  |
|  left rail,  |                          |   right rail,    |
|  TWO tabs    |                          |   collapsible    |
+-- bottom bar ------------------------------------------------+

      DETACHED GARAGE / BUNGALOW / BILEVEL
      three boxes, one open at a time
```

**THE LEFT RAIL CARRIES TWO TABS**, in this order: **PROJECT INFO** upper and
**GARAGE INFO** beneath it. PROJECT INFO is the site information, lot and legal
description, which is the IDENTITY
block at the top of the page today (project name, contractor, owner, civic
address, block / lot / plan / parcel, and the freeform description).

That is a direct reuse rather than a new mechanism. MODEL's RIGHT rail already
carries two panes exactly this way: `PANES = ['levels', 'previews']`, the
choice keyed in the URL beside `right` so it survives a reload, and edge tabs
marked `data-pane-tab` that swap the pane without shutting the rail. Pressing
the tab that is already up shuts the rail, which is the gesture a drafter
already has. PROJECT's left rail wants the same three behaviours with its own
two names.

**THE RIGHT RAIL IS `HOUSE INFO`**, carrying the building's own column — roof,
2nd floor, main floor, foundation. Whether it grows a second tab is **open**:
Movie, 23 Sep, *"on right HOUSE INFO tab … let me check if we will need other
tabs"*. Built as one pane it must still be built on the two-pane mechanism the
left rail uses, or adding the second one later means rebuilding the rail
rather than naming a tab.

**AND ALL THREE OPEN BY DEFAULT.** Movie, 23 Sep: *"when that page is opened
make those tabs OPEN by DEFAULT (not collapsed)"*. MODEL's rails default SHUT
— `railOpen` reads `params.get(param) === '1'`, so a bare URL has both closed
and `?left=1&right=1` opens them.

**THAT MAKES THE DEFAULT A PER-PAGE PARAMETER, not a constant in the chrome**,
and it is the second argument for passing content in rather than copying
MODEL's bars across. A page that opens on a drawing wants its rails out of the
way; a page that IS a form wants them open, because with them shut there is
nothing on screen but the sections. Same mechanism, opposite default, and the
shell has to take it rather than know it.

Keep the URL as the source of truth either way — a drafter who shuts a rail
and reloads should find it shut. Default open means the absent parameter reads
as open on this page, not that the parameter stops being read.

**PROJECT INFO sits UPPER**, GARAGE INFO below it — Movie: *"tab on UPPER left
for PROJECT"*, *"under PROJECT INFO tab, then a GARAGE INFO tab"*. That mirrors MODEL's right edge, where LEVELS / LAYERS is the upper
tab and LAYOUT PREVIEWS the lower, so the two pages read the same way round
the drawing: the thing you set once at the top, the thing you return to
beneath it.

**NOTHING IS DELETED.** A closed box hides its detail; it does not lose it.
That is the whole reason the accordion is the answer to "no scrolling" rather
than cutting fields.

## What makes it possible, measured rather than assumed

**The rails already scroll inside themselves.** MODEL's carry
`overflow-y:auto; overscroll-behavior:contain`, bounded top and bottom against
`--strip-h` and `--bottom-band`. So the house column — roof, 2nd floor, main
floor, foundation, some fifteen fields — fits a rail on a page that never
scrolls. Without this the no-scroll ruling would have cost content.

**Two of the three families already come from the shared menu.** PROJECT reads
`window.DraftBuildMenu.BUILD_MENU` for its bungalow and bilevel families
(`PROJECT.html:1978` and `:2009`). The three boxes are that list, and the
DETACHED GARAGE band joins it rather than staying separate. **The order comes
from `BUILD_MENU` itself**, which is also the answer to the ordering Movie
asked for on the same day — one list, both pages, nothing to drift.

**The colour was a solved problem waiting to be used, AND IT IS NOW DONE.**
`palette.js` carries named roles across two themes and two modes, and PROJECT
now runs on it: the stylesheet is written in `var(--role)` throughout, the
head applies the skin synchronously before the first frame, and NIGHT/DAY and
RUFF/ROUGH come free because they are the palette's own axes.

The first count published here — "54 hex literals" — **was wrong, and the way
it was wrong is worth keeping**: the regex that produced it counted HTML
entities. `&#8217;`, `&#8242;` and `&#8540;` all match `#[0-9a-f]{3,8}`, and
eighteen of the fifty-four were curly apostrophes and fraction glyphs. The
real figure was thirty-six literals in seven distinct colours. **A pattern
that matches the thing you are looking for will also match anything shaped
like it**; the count was never checked against a single one of the lines it
claimed.

**One choice across the app, not one per page.** The head reads the same
`draft-skin` key and the same `?theme=`/`?mode=` overrides MODEL writes, so
walking from the model space to the project area does not change the lights.
This page only READS it — MODEL owns the switcher, and a second writer would
be two sources for one fact.

**And the section canvases needed the same treatment**, which the CSS pass
alone would have missed: `project-page.js`'s `paintSection` set
`ctx.strokeStyle = '#1d1f20'`, correct on a white page and **invisible on a
night one**. It reads `getComputedStyle(canvas).color` now — `color` is
inherited and body sets it to `--ink-primary`, so the skin reaches the canvas
without threading an argument through eleven call sites. A palette that stops
at the stylesheet is the defect palette.js's own header warns about: 92% of
MODEL's colour is set from JavaScript.

### The drafting blue went to `accent`

Movie, 23 Sep: *"yes finish it"*, and after seeing where the colour actually
lives, *"i can work with that and make updates later"*.

**All 26 uses did ONE job** — card titles, focus rings, hover washes, pressed
buttons, the lit row, the table head: every one of them marks the thing you
can click or the thing that is selected. A colour with one job has a role, and
that role is `accent`.

**It splits by WHAT THE THING IS, which is the rule the palette is built on.**
Lines, rings and washes take `accent`; the small uppercase text — the 13px
card title and the 9px lit tag — takes `accent-mark`, which exists for exactly
that case. On RUFF night the mark is the amber and the accent is the red, so
the titles read gold and only the interactive lines go red. **I had told Movie
the titles would go red**, reading `accent` off the table and never checking
whether small text had a role of its own. It does, and it has since 17 Sep.

The washes keep their own alphas through `color-mix()` — 7/8/10/12/13/22% of
the accent — because the page had a deliberate ladder there: a hover is
fainter than a press.

**What each skin now shows.** ROUGH is the point of the exercise: its accent
IS the drafting blue, AA-lifted (`#6b91b6` night, `#365e86` day), so the page
looks almost exactly as it did — except it is now the theme saying so rather
than a literal. RUFF night is gold titles on red lines. RUFF day is the dark
red (`#c0392b`) for both, and that is the one skin where the change is loud.

### The conversion has a guard: `proto/skinned-page-harness.js`

A colour literal is the quietest regression this page can have. It looks
perfect on whichever skin the author had open and wrong on the other three,
and nobody sees it until Movie flips the lights. So the conversion is pinned:
17 checks, 12 mutations, and CI picks the file up with no workflow edit
because the engine list is derived from the `mutationMode()` call rather than
listed.

**Most of the file checks the INSTRUMENT, not the page.** A scanner that finds
nothing reports the same "0 literals" as a page that has none, so ten checks
feed it fixtures it must find and fixtures it must not, and five mutations
break the scanner on purpose to watch those checks go red. Without that half
the harness is the defect it exists to catch, one layer up.

**The 54-vs-36 bug is frozen as a check.** One mutation drops the `(?<!&)`
guard and the entity fixture goes red — the exact miscount this document
published, now unable to happen twice.

**And the table earned its keep on the first run.** The check for "reads the
skin MODEL writes" was `includes('draft-skin')`, and it SURVIVED the mutation
that changed the code to `'project-skin'` — because the comment four lines
above still named the key. The check was reading the prose that describes the
behaviour instead of the behaviour. It looked like a perfectly good check, and
plain mode would have called it green forever. Every source-shape check reads
decommented source now, the same way the colour scan does.

**Nothing in it writes to the repo.** The subject is file text, so a mutation
swaps the reader, not the file. A harness that edits tracked files to test
them leaves them edited when it dies, and the first person to notice is
whoever commits the mutant.

### Two colours still NOT converted

| literal | where | why it is still open |
|---|---|---|
| `#a06035` + `rgba(160,96,53,.08)` | the `.notice` left border and tint | No role for a warning. Reads at 3.32 on night, 4.45 on day — a 3px border, so it passes as a line either way, and the notice's TEXT is already `--ink-secondary`. |
| `#557a46` | `#status` | No role for a success message. 3.36 on night, 4.41 on day: **under AA both ways, and it already was** before this pass. Transient text, so it is recorded rather than fixed. |

Neither is a regression — both sat at the same contrast on the white page.
What changed is that there is now somewhere for them to go.

## The main area: three small, one big

Movie, 23 Sep: *"we will need the 3 types SMALL on the left in a columns and
depending on which they click on, that one will show up large size to the
right"*, at *"about 20% of the width and leave 80% for the full size
section"*, and *"i need the modified bilevel and detached garage as their own
little version and then click to big"*.

**The rails float OVER this, they do not push it.** Movie, same day: *"when
tabs are open it will cover most of the 3 small sections"*. That is why the
main area is a plain two-column grid of its whole width rather than a
three-column one holding gutters open for the rails — nothing here has to
make room for them, and the small column is the part they are allowed to
cover.

**The miniature is the same drawing, not a picture of it.** Each small canvas
is painted from the SAME builders and the SAME live values as the big one;
`paintSections` fits whatever it is handed to the canvas it is given, so a
300×220 thumbnail costs one more call and nothing else. MODEL's own note on
thumbnails says why this matters: *"a miniature that can disagree with the
plan it claims to show"* is the defect to avoid.

**Repaint AFTER the swap, never before.** Every label on these sections is an
absolutely-positioned element placed from a measured anchor, and a section
that is `hidden` when it is painted measures zero — so its labels all stack
in the top-left corner. Selecting a type therefore shows the section first and
repaints second. A test watches for exactly this: it counts labels sitting on
the wrap's own origin, and expects none.

**The URL is the source of truth**, the same rule the rails follow. The
opening state goes through the picker rather than around it, so the first
paint is produced by the path every later click takes.

### The page got a page wider, and that is temporary

`main` went from 1180px to 1400px. The band inside a section is a fixed 600px
drawing with a schedule column either side and a 1090px max-width; at 80% of
1180 the stage offered 940 and the schedules answered by wrapping every label
into a tower. **Those two schedule columns are the GARAGE INFO and HOUSE INFO
content and they are moving into the rails** — once they do, the stage holds
only the drawing and can be any width. The extra 220px is what keeps them
readable until then, not a design decision.

## What the cull cost, said out loud

Movie, 23 Sep, on the ZONE HEIGHTS and SECTION TABLE cards: *"can we just
delete all that i don't think we need it"*, confirmed against a screenshot he
circled. The drop box moved to the top of PROJECT INFO.

**Neither deletion cost data or a derive.** Grade is still typeable through
`GRADE OFF FDN TOP`, the garage sill through `GARAGE SILL OFF FOUNDATION
SILL`, and five definitions that lived inside the zone block — `houseSillFt`,
`attachedOffsetFt`, `derivedAttachedOffsetFt`, `roofHeelIn`, `gradeOffsetFt`
and their derives — were never the card. They are facts about the building
that the card happened to show, and showing a number is not owning it. They
stayed where the block stood, because every one is a const arrow reached first
by the boot calls below it and hoisting them would be a second change riding
along with a deletion.

**It did cost four guards, and this is the list** so that nobody has to
rediscover it:

| gone | what it held |
|---|---|
| `tests/section-table.spec.js` | the table UI: cell edit, inheritance, the derived notes |
| *zone heights edit both ways against the elevation datum and persist* | the local-elevation / off-MAIN-FL round trip |
| *grade derives from the attached garage beam and drives the detached garage until overridden* | the grade derive **through the UI**, and the override |
| *a zone height edit moves the garage in the drawing, not just in the box* | that a typed zone reaches the section |

`proto/section-table-harness.js` (937 lines, 89 checks, 46 mutations) is
untouched — it reads `project-page.js`, so it guards the NUMBERS and always
did. What went is the UI half. **The grade derive is the real loss**: the rule
still runs and nothing drives it end to end any more.

### A fifth guard, and a behaviour that lost its only surface

Found by CI on the branch, not by the sweep: `tests/wall-type-pickers.spec.js`
asserted that `th[data-section-col="basementClg"]` reads **CRAWL CLG HT**.

Movie, 17 Sep, on a grade beam: *"it will become a 'crawl space' rather than a
'basement'"*. That word had exactly ONE surface — the section table's column
header, through `columnLabel()` — and the table is gone. **The rule is not
wrong; it has nowhere left to be shown.** So the assertion retires with the
table rather than being pointed at something that does not say it, and the
wording wants a home when GARAGE INFO / HOUSE INFO land.

`columnLabel` went with it, along with four more functions the cut left
stranded — `derivedText`, `cellNote`, `unitFormat`, `unitParse`, 71 lines in
all. Every one had `fillTable` as its only caller. They were still in the file
after the first pass because that pass removed the RENDERING and stopped;
finding them meant asking which names still had a reader, not which block they
sat in.

### The sweep that missed three files

Four specs were updated for "one type on screen at a time". The right number
was seven, and CI found the other three. The sweep was scoped to
`tests/project-*.spec.js` — five files — when the question was *which specs
reach PROJECT.html*, which is fourteen. **A filename prefix is not a
dependency.** `tests/wall-type-pickers.spec.js` even carried its own byte-for-
byte copy of the `openProjectPage` helper that had already been fixed
elsewhere.

### And one datum that had to be converted, not swapped

Three surviving tests read the garage sill off `[data-zone-offset]`, which
measured from MAIN FL. The box that survived measures SILL TO SILL, one
main-floor package lower — 12⅝" apart. Two of the three are DIFFERENCES
between two readings, so the datum cancels and they are unchanged. The third
puts the number into a sum, so it converts back explicitly. A silent swap
would have put that deck out by exactly one floor package and still read
green, which is this repo's oldest trap: a span measured correctly tells you
its length and nothing about what it is.

## RULED 23 SEP: what the BONE does, and it is a presentation

Movie: *"for both BONE versions i'd like it to go to the MODEL html, and go to
the FRONT ELEVATIONS view, and 'GROW' the house from bottom to top"*, and
*"make it a nice presentation where it is revealed to the user by the GROW"*.

**Both** BONEs — MODEL's and the one PROJECT is getting — do the same thing.
That is the point of putting one in PROJECT's bottom bar at all: the button
means the same thing wherever it is pressed.

**HALF OF IT IS ALREADY SUPPORTED.** MODEL reads `?view=` from the URL
(`activeCut`, `activeViewId`) and resolves it through `cutForViewId`; the
front elevation is **E1**, from its own seat list — `E1 · FRONT`, `E2 · LEFT`,
`E3 · BACK`, `E4 · RIGHT`. So "go to MODEL and show the front elevation" is a
navigation that works today and needs no new plumbing.

**AND THE REVEAL IS NOT A NEW FEATURE — IT IS BOARD #283, ALREADY BUILT.**
Movie: *"it was like that in the Model.dc version"*, and he is right. The old
page carries it in full:

> *The rising reveal (board #283): every bone press that grows the house jumps
> to the E1 front elevation and the house climbs out of the ground under the
> rising mask — not just the tour finale. BONE REVEAL in SETTINGS turns it off
> for drafters who'd rather stay on the plan.*

`_startBoneReveal()` finds the E1 cut, holds one beat (`REVEAL_HOLD_MS`) while
both rails slide open around the stage, then climbs. It also stands the
drawing tools down, so a stray click in E1 cannot keep placing plan geometry.
The tour's own finale hands off to it: *"The house is ready — press the BONE
and watch it grow."*

**THE MATHS IS ALREADY IN A SHARED MODULE.** `tour.js` owns
`revealClipY(elapsedMs, durationMs, y0, y1)` — *"one eased clip height, shared
by the 2D and 3D"* — with `REVEAL_MS = 2500` and `REVEAL_HOLD_MS = 1000`. Only
five references to the reveal state remain in the dc page, so the page-side
wiring is small and the hard part is lifted already.

**SO THIS IS AN UNRECORDED PARITY GAP**, not a design job. `MODEL.html` does
not load `tour.js` at all (0 references against the dc page's 4), and
`PARITY-model-html-vs-dc.md` does not mention the reveal. The work is: load
the module, jump to E1 on the bone press, run the clip, honour BONE REVEAL.

**AND THE 3D IS ALREADY ANTICIPATED.** Movie: *"in the future when i get the
3D operational i'd like the 3D view to GROW"*. `revealClipY`'s own comment
says it is shared by the 2D **and 3D** — so the easing that drives the
elevation is the one the 3D view will use. Nothing here needs redesigning for
it; the 3D view calls the same function when it exists.

**THE REVEAL STILL SPLITS BY WHICH BONE:**

- **MODEL's BONE** builds from the outline the drafter has drawn, so there IS
  a house to grow. The animation is buildable now.
- **PROJECT's BONE** has no outline — the drafter chose a type and typed its
  numbers, and turning that into geometry is the premade-designs round that
  `build-menu.js` already names: *"WHAT IS NOT HERE, deliberately: the
  generator … the drafter is moving to a premade design per house type in
  place of generated rooms."* Until that lands, PROJECT's BONE can do the
  navigation and nothing more.

**Bottom to top is not decoration.** It is the order a house is built in —
footing, foundation, main floor, upper floor, roof — and the elevation is the
one view that shows that order as a vertical stack. A reveal that grew
left-to-right or faded in would be an animation; this one is the building
going up.

## RULED 23 SEP: one rail, not two

Movie, revising the layout above: *"im thinking maybe the sidebars aren't
needed for the house info, but the PROJECT INFO area with the drop zone should
be on the first tab top left"*, and on HOUSE INFO and GARAGE INFO: *"looks
pretty good right now where it is in the main area"*.

So the rails come down to **ONE tab, upper left: PROJECT INFO**, holding the
identity fields and the drop zone. No right rail, and the schedule columns
stay flanking the section drawing where they already are.

**That retires the interim width note above.** `main` went 1180 → 1400px to
stop the schedules wrapping while they were on their way to the rails. They
are not going to the rails, so 1400 is simply the page width now rather than
a debt.

## THE SHELL IS A MECHANISM, NOT MODEL'S PANELS MOVED OVER

This is the constraint that decides the whole design, and it is Movie's:
PROJECT's rails hold PROJECT's content. So what is shared is

- the rail itself: open, close, the edge tabs, the URL state, and the margin
  behaviour that keeps an open rail off the drawing
- the top bar, less the instrument panel
- the bottom bar

and what is NOT shared is anything inside them. Each page names its own tabs
and supplies its own content. "Share the chrome" would put DRAFTING TOOLS on
the PROJECT page; "share the shell and pass in what goes inside" is the one
that works.

## The open decision: copy or extract

The bars and rails are inline in `MODEL.html` — the strip at `:1906`, the page
row at `:1739`, the rails at `:1662` and `:1708`. Copying them into PROJECT is
about a day and leaves a second copy of the chrome free to drift, which is the
failure this repo keeps a harness genre for. Extracting them into a shared
module is a day or so more and both pages then have one chrome.

**Recommended: extract.** Nine modules are already shared between these pages,
and `palette.js`'s own header is the argument — colour was extracted precisely
because literals scattered across pages stopped being maintainable. Chrome is
the same shape one level up.

**Sequencing note.** Extraction edits `MODEL.html`, which one of the two lane
maps calls Gilligan's. Lanes are dormant while one agent runs, but the PROJECT
sections are his next job, so the two should not run at once from both ends.

## Estimate

| | |
| --- | --- |
| colours and text style | ~half a day, touches no MODEL file |
| three boxes, one open, no scroll | ~a day |
| top and bottom bars, rails | 1–2 days, depending on copy vs extract |
