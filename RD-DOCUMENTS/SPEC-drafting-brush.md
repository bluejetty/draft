# SPEC — the drafting brush

The dimmed chip at `MODEL.dc.html:1839` has been in the instrument strip with
no handler and no click for as long as it has existed. `AUTOWINDOWS-PR-NOTES.md`
names what it is waiting for and says it was left out on purpose:

> No eyedropper / fenestration property painter — later slice of #169.

This is that slice, designed with Movie on 5 Sep. Nothing is built yet.

## What it is

A properties picker, the way ArchiCAD's eyedropper and syringe work. Movie:

> *"if I choose the dusting brush and I dust a garage door I can either go to
> another window or door and 'dust' the properties so that window or door will
> change to the other garage door properties (or for wall properties etc) — or,
> once he dusts something and it picks up the properties, he can either dust
> another item or use the properties and create the new thing he just copied."*

## The rule that settles the edge cases

**The brush carries what a thing IS, never where it is.**

Kind, size, head height, sill height, swing — yes. Position along the wall,
which wall, which storey — never. Dust is a finish you lift off a surface; it
is not the surface.

## Two states, and the chip wears them

| state | chip |
|---|---|
| empty | dim, `rgba(29,31,32,0.18)` — exactly as it sits today |
| loaded | lit, and labelled with what is on it: `GARAGE DOOR 16'-0"×7'-0"` |

**The icon does not change.** Movie, 5 Sep: *"the icon looks nice keep that for
sure."* Its two paths stay as drawn — a curved ferrule over four bristles. Only
the colour moves between the states, so "loaded" is visible without the drawing
becoming something else.

This is the whole defence against the usual modal-tool failure, where the next
click does something you forgot you had armed. The brush always says what it
will do before you do it.

## The target decides the verb

Movie asked whether the drafter picks between dusting another item and creating
a new one. He should not have to: the thing under the cursor already knows.

| a loaded brush clicks… | what happens |
|---|---|
| an existing door or window | it becomes what is on the brush |
| a bare wall | a new one is created there |
| empty space, no wall | nothing — an opening needs a wall |

One gesture, no modifier, no mode toggle. This is what makes the feature need
no keyboard at all.

## No new keystrokes, and the reason is measured

Every key comparison in `MODEL.dc.html` is `Enter`, `Escape`, `Space`,
`Backspace`, `Shift`, `Control`, or `y`/`n` for confirms. **No tool in the bone
has a letter shortcut.** There is no shortcut system to be consistent with, so
adding "B for brush" means inventing one — a bigger change than it sounds, and
a separate decision.

So the brush ships click-only. Letters are a later convenience, decided once for
every tool rather than invented for this one.

Getting back to empty: click the chip, which is already a chip and should be its
own off switch, or `Escape`, which the bone uses for cancel everywhere else.

## Refusals say why

The same rule the zone panel follows when it turns down a grade. Two cases will
arrive immediately:

- **Wrong class.** A wall's properties dusted onto a door. Refuse, and say so.
- **Won't fit.** A window BECOMING a garage door cannot land in a 3'-0" bay.

## Still to settle

- **Become, or resize?** Does dusting a window with garage-door properties make
  it a garage door, or only make it that size? Movie's wording reads as
  *become*, which matches the syringe carrying an object type — and *become* is
  what needs the fit rule above, since it can ask for something the wall cannot
  hold. **Needs Movie.**
- **What "won't fit" does.** Refuse, or grow the wall? **Needs Movie.**
- **The name.** The chip's title says DRAFTING BRUSH; Movie says *dusting
  brush*. Write down whichever he actually says out loud, then use only that.

## A note on how to build it, when it is built

If the answer is *become*, hold a RECIPE on the brush and make applying it the
same code path that creates a new opening — aimed at an existing one instead of
a bare wall. One builder, two targets. Two builders that agree today would stop
agreeing the first time either moved.
