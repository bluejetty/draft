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
