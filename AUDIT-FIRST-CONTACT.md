# AUDIT-FIRST-CONTACT.md — the naive pass

Written before reading any source. Emulated iPad: 1024x768 CSS, `hasTouch`, DPR 2,
iPad Safari UA, driven by touch taps and CDP touch events only — no mouse, no keys.
Chromium (Playwright), served from a static server at the repo root.
Time-boxed. Notes are in the order they happened; nothing removed after the fact.

---

## 00:00 — index.html

Splash: a blueprint roll, the words ROUGH DRAFTER, nothing else. No button, no
"start", no spinner. I waited 7 seconds to see if it would move on by itself. It
did not. `document.body.innerText` is literally the two words "ROUGH DRAFTER".

I tapped the middle of the screen on a guess and landed in MODEL. So the splash
*is* the button — the whole page is. Nothing tells you that. A first-timer taps
the logo (works), or waits (nothing), or reloads (nothing), or leaves.

**Confusion #1: the entry screen has no affordance.** One line of "tap anywhere to
start" fixes it.

## 00:03 — MODEL, first paint

A modal from PROFESSOR GRUFF: "CLOSE ALL OTHER BROWSER WINDOWS AND TABS FOR OPTIMAL
PERFORMANCE." Button: **GOT IT (ENTER)**.

Two things at once. First, the very first sentence the product says to a beginner is
an apology about performance. Second, the button is labelled with a key an iPad does
not have. This repeats: every dialog I met was labelled with keys —
"KEEP GOING — DEFAULTS (ENTER)", "PROJECT (ESC)", "CLIMB — ENTER / SPACE / TAP".
Only the last one admits a tap works.

**Confusion #2: keyboard labels on a touch-first product.**

## 00:04 — where are the tools?

The screen is a grid with a crosshair, a top bar, a right-hand stack of level cards
(SITE / ROOF / 2ND FL / MAIN FL / FOUNDATION), and two vertical text strips on the
far left and right: "ROUGHDRAFTER - LITE - DRAFTING TOOLS" and "LEVELS - LAYERS".

There are no drawing tools on screen. I enumerated everything tappable: 22 controls,
none of them a tool. The vertical strip on the left is a 33px-wide button; tapping it
slides out the palette. There is no chevron, no arrow, no hint that a sideways word is
a drawer handle.

**Confusion #3: the entire tool palette is behind an unmarked 33px strip.**

Once open, the palette eats 355 of my 1024 px — 35% of the screen — and it does not
overlay, it *pushes*. (This has a consequence I only understood later; see 00:35.)

## 00:06 — touch target audit, unprompted

I did not go looking for this; it was unavoidable while trying to hit things.
Measured, live, at 1024x768:

| control | size |
|---|---|
| SETTINGS / STANDARDS / IMPERIAL / METRIC / AREAS / INSERT | 80x16, 66x16, 64x16 |
| every drawing tool (SELECT, WALL, STAIR, ...) | 39x39 |
| OBJECT TYPE filter chips (ALL/LINE/WALL/OUTLINE/FLOOR) | 31x24 |
| bottom-bar icons (9 of them) | 15x15 |
| MODEL / LAYOUT / PROJECT page links | 65x20 |

Apple's minimum is 44x44. Nothing in this app meets it. The 15x15 bottom-bar icons
are a quarter of the required area and have no labels; I have no idea what any of
them do and tapping to find out is a coin flip on a tablet. I missed the LAYOUT link
on my first attempt by 8 pixels and thought the button was broken.

**Confusion #4: I could not reliably hit the controls.**

## 00:10 — drawing the house, attempt 1 (wrong)

The palette has SHAPE, whose panel says **"CAPTURE WALL OUTLINE — Closed construction
outline on SHAPE"**. That is exactly the thing I was told to draw. I tapped four
corners and closed on the first. A green dashed rectangle appeared, the panel offered
me FLOORING (393.8 SQ FT) — so it understood I had drawn a room.

I pressed the red bone. It said:

> "Nothing to build yet — press HOUSE (or a GARAGE button), trace the outline, then
> press the bone."

So the tool literally named "CAPTURE WALL OUTLINE" does not make the outline the bone
wants. There is a *mode* (the HOUSE button in the top bar) that must be armed first,
and the outline you trace in that mode is a different thing from the outline the
outline tool draws.

**Confusion #5 — the one I'd have quit on.** Nothing on screen distinguishes the two.
The error message is good; the fact that it is needed is the bug. Worse: my
mis-drawn SHAPE stayed in the drawing. It is still there now. It has flooring
assigned. Nothing ever told me it was junk.

## 00:14 — drawing the house, attempt 2 (right)

HOUSE → modal ("Automatically using the default project settings ... trace away!") →
trace four corners → close on the first.

The status line was genuinely helpful here: "HOUSE — trace the outline corner to
corner and close it on the first point (or press Enter), then press the bone to grow
the shell."

Then, unprompted, a card: **"FOUNDATION DONE, GOING TO MAIN FLOOR — Every span is
under 19' — no mid-span beam needed."** I had not asked for a tour and did not know
one had started. I also did not know what it wanted; I tapped it away.

**Confusion #6: the tour starts itself and looks like an error card.**

## 00:16 — the bone

Pressed the bone. ~2 s later the whole screen changed to an *elevation* (E1) I had
not asked for. The plan I was working on was gone. It took me a while to work out
that the level cards on the right are also the way back — tapping MAIN FL returns to
plan.

The house itself is impressive: walls, roof, foundation, four elevation marks
(E1-E4), auto dimensions, a stair with "DN — 14R @ 7 5/8"". For one press that is a
lot of drawing. This is the good part of the product and it is very good.

But at 1024 px wide with both drawers open there is almost no canvas left, and the
elevation it jumped to was clipped behind the level-card strip on the right. The
first thing I saw of my house was a cut-off picture of it.

## 00:19 — the number that made me stop

My house is **21'-8 7/8" x 18'-1 3/8"**.

I did not ask for that. I tapped four points on a grid. There is a LENGTH box in the
bottom bar, greyed, and the palette mentions typing lengths, but as a beginner
tracing with a fingertip I got a house whose every dimension is a fraction. Nothing
offered to round it, and I could not find how to fix it after the fact without a
keyboard. Every real house starts at round feet.

**Confusion #7: freehand tracing produces sixteenth-inch house dimensions and there
is no touch path to "make this 24'-0"".**

## 00:22 — undo

There is none.

I searched the entire DOM for an undo or redo control: `title`, `aria-label`, or text
matching /undo|redo/. **Zero matches.** There is a DEL button in the bottom bar and
that is all. On a tablet with no keyboard, every action I take is permanent. I drew a
junk rectangle in the first five minutes and I still cannot remove it except by
selecting it and using DEL — which I had to guess at.

**Confusion #8, and the single worst thing for the stated user: an iPad user cannot
undo.**

## 00:26 — pan and zoom

One-finger drag on empty canvas: nothing moved. Two-finger pinch: nothing moved.
Pixel-identical screenshots before and after both gestures.

I verified the events actually reached the page (`pointerdown:touch`,
`pointermove:touch`, `touchstart`, `touchmove` all fired on window). They arrive; the
app ignores them. I could not find any way to move or scale the drawing by touch. My
house is where the app put it and that is that.

I also noticed the drawing canvas has `touch-action: auto`. On a real iPad that means
Safari itself claims one-finger drags and pinches for page scroll/zoom — so on real
hardware I expect this to be *worse* than what I saw here, not better: the gesture
gets eaten by the browser before the app sees it.

**Confusion #9: no pan, no zoom, by touch.** For a drafting app this is close to
disqualifying on the stated device.

## 00:31 — save

The top bar has SAVE, and next to it the word **SAVED** in green. It said SAVED when
the document was empty. It said SAVED after I drew a rectangle. It said SAVED after I
built an entire house. It never changed.

I assumed my work was not being kept, closed the tab, and reopened MODEL — and the
house *was* there. So it does persist (I later found it in IndexedDB). Good. But the
indicator told me nothing either way, and there is no "last saved" time, no dirty
state, and no warning if you close mid-edit. I spent ten minutes believing I had lost
a house I had not lost.

**Confusion #10: the save indicator is a decoration.** It reads SAVED at all times,
including times when nothing has ever been saved.

## 00:35 — the thing that moved my house

The junk rectangle from 00:10 is now sitting ~7 feet to the left of my house,
overlapping it. I drew it in the same screen position as the house outline, so it
should be on top of it.

I think I understand why, and it is not reassuring: the tool drawer *pushes* the
canvas instead of overlaying it. Open the drawer and the canvas is 355 px narrower,
so the same fingertip position is a different point in the model. I drew the
rectangle with the drawer open and the house with it closed, and they landed 7 feet
apart.

I cannot prove that from the outside, but from a beginner's chair the fact stands:
**the same tap lands in a different place in my house depending on whether a panel is
open**, and nothing on screen says so.

## 00:41 — LAYOUT

Tapped LAYOUT (missed twice; 65x20 target). The sheet page is the calmest, clearest
screen in the product: paper size, orientation, scale, plan level, titleblock, a
drawn 17x11 sheet with a real titleblock, date, sheet number.

The sheet is **empty**. My house is not on it. There is an "+ ADD VIEWPORT" button,
which I assume is the answer, but the sheet already shows "17" x 11" · 1/4" = 1'-0""
in two places as though a viewport were configured. PLAN LEVEL was preset to 2ND FL,
not to the floor I was working on.

**Confusion #11: LAYOUT presents itself as configured and renders nothing.**

## 00:47 — things I never found

- Any way to add a room name / room tag. No such button exists after the build.
- Any way to start the tour deliberately, or restart it after I dismissed it.
- What the nine 15x15 icons in the bottom bar do.
- What "ASSEMBLY [Y]" is.
- The BONEYARD. It appears as a card in the levels stack after a build, and the
  pitch says it is where the master lives, but I never found a reason to go there.
- Any help, any "?" anywhere.

## Where a real person quits

1. **00:22, no undo.** They mis-tap once, the drawing is wrong, and there is no way
   back. This is the one.
2. **00:26, no pan/zoom.** They cannot look at their own drawing.
3. **00:10, SHAPE vs HOUSE.** They draw the outline with the tool named "capture wall
   outline", the bone refuses, and they conclude the bone is broken.
4. **00:00, the splash.** A small number never get past a screen with no button.

## What is genuinely good (one line each, then I stop)

The bone actually works — one press produced a coherent, dimensioned, multi-level
house with elevations. The status line writes in plain English. The LAYOUT page is
well organised. The error message at 00:10 was the best-written sentence in the app.

## What I did not examine in this pass

Rooms/room tags (never found the control), the roof editor, sections S1/S2, the
PROJECT / SETTINGS / STANDARDS pages beyond glancing at them, printing, the 3D
button, garages, importing a PDF underlay, and the tour past its first card. I did
not test on real iPad Safari — only a Chromium emulation of one, which is more
forgiving about touch than the real thing.
