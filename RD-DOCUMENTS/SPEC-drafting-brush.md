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

## The keystroke is `I`, and it joins a system that already exists

**Corrected from an earlier draft of this file, which said the bone had no
letter shortcuts and that adding one meant inventing the system.** That was
wrong twice over. `profile-manager.js:103` holds `DEFAULT_KEYBINDINGS`, every
binding is user-remappable, and nearly every tool already has a letter:

    S select   L line    N node   W wall    F floor   E fenestration
    A shape    U outline O roof   D dimension        Q trim
    T tsquare  P compass C cut    Y group   X extend  K copy
    R freezeLength       B background

The mistake was a bad search, not a bad memory: bindings run through
`eventMatchesBinding(e, state.keybindings[command])`, so grepping for inline
`e.key === 'x'` finds nothing and looks conclusive. Worth recording, because the
wrong answer changed a design decision -- it argued for a click-only tool on
grounds that did not exist.

**B is taken** (background). Free letters are H, I, J, M, V, Z; G is in
RESERVED_KEYS because retired bindings can still sit on it.

**`I`, because Photoshop's eyedropper is `I` and this is an eyedropper.** `D`
would suit "dusting" and belongs to the dimension tool.

So the brush toggles like every other tool: `I` or the chip turns it on, `I` or
the chip turns it off. Add `brush: 'I'` to DEFAULT_KEYBINDINGS and it inherits
remapping, the profile round-trip, and `keyBindingLabel` in the help text for
free.

## Three states, and two levels of Escape

    OFF  <->  ON, EMPTY  <->  ON, LOADED

- The chip or `I` toggles OFF and ON. Pressing it while loaded turns the tool
  off and drops what it held.
- `Escape` steps back one level: loaded becomes empty, empty turns the tool off.
  That is how Escape behaves everywhere else in the bone, and it gives a way to
  drop the load WITHOUT leaving the tool -- which the chip alone cannot do.

## Refusals say why

The same rule the zone panel follows when it turns down a grade. Two cases will
arrive immediately:

- **Wrong class.** A wall's properties dusted onto a door. Refuse, and say so.
- **Won't fit.** A window BECOMING a garage door cannot land in a 3'-0" bay.
  **It is refused; the place does not happen.** Movie, 5 Sep: *"maybe don't
  allow to place in that case."* Skipper put the reason for it best -- growing
  the wall to make room would be software moving geometry the drafter never
  touched. Refusing and saying why is the same contract the zone panel keeps
  when it turns down a grade.

## Still to settle

- **Become, or resize?** Does dusting a window with garage-door properties make
  it a garage door, or only make it that size? Movie's wording reads as
  *become*, which matches the syringe carrying an object type — and *become* is
  what needs the fit rule above, since it can ask for something the wall cannot
  hold. **Needs Movie.**
- **The name.** The chip's title says DRAFTING BRUSH; Movie says *dusting
  brush*. Write down whichever he actually says out loud, then use only that.

## A note on how to build it, when it is built

If the answer is *become*, hold a RECIPE on the brush and make applying it the
same code path that creates a new opening — aimed at an existing one instead of
a bare wall. One builder, two targets. Two builders that agree today would stop
agreeing the first time either moved.
