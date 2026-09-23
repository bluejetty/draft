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

**The colour is a solved problem waiting to be used.** `palette.js` carries
named roles across two themes and two modes. MODEL runs on it: 279 `var(--…)`
uses against 85 stray literals. PROJECT has **54 hex literals and zero
tokens**, in 143 lines of CSS. NIGHT/DAY and RUFF/ROUGH come free with the
swap, because they are the palette's own axes.

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
