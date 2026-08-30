# What a finger can and cannot do — findings from the pointer migration

Slice 3 of the pointer-event board. The rule for this slice was: **do not
redesign hover-dependent flows — file what you find, and fix only what hard
BLOCKS drawing a wall / outline / bone press by touch.** So this is a list, not
a diff. Two things were fixed (both in slice 1, both hard blocks); everything
else below is recorded for the boards that should own it.

Findings come from driving the app on a real touchscreen — Playwright with
`hasTouch`, taps and drags through the browser's own touch pipeline — not from
reading the code and guessing.

## Fixed, because they blocked drawing outright

**A finger had no cursor.** A mouse arrives at a point by moving there, and the
move handler is what computes the snapped cursor (`_snapPt`) that the drawing
tools commit. A tap arrives out of nowhere: the press read a cursor from
wherever the pointer last was — on the first tap of a session, nowhere at all —
and drew nothing. A non-mouse press now runs the move for its own coordinates
before the press. This is the single line that turns "the iPad doesn't work"
into "the iPad draws".

**A captured pointer overshot the canvas.** Capture keeps delivering moves that
happen outside the canvas, where plain `mousemove` stopped at the edge. The
canvas move handler is bounds-gated now and fires the leave that capture
swallows, so the crosshair and the rubber band behave on a desk exactly as they
did before the migration.

## Works by touch, and is pinned by `tests/touch-affordances.spec.js`

- Tracing an outline, and the tour's FOUNDATION step running off it.
- The tour popup — the escorted path's only control — takes a tap.
- Placing a wall; dragging a node (the captured-pointer half).
- The tool rail, the level cards, the layer views.
- Pressing the bone.
- A second finger landing mid-stroke does not steal the stroke.

## Hover-gated: works on a desk, unreachable by finger

None of these block drawing. None were touched.

**Polar-origin dwell.** `_dwellPolarOrigin` arms after the cursor RESTS on a
node for 350ms (`POLAR_DWELL_MS`) without pressing. A finger cannot hover, so
polar tracking can never arm by touch. (It cannot arm accidentally either: the
press cancels the dwell.) An explicit "set polar origin" affordance would be
the fix, and that is a design decision, not a migration one.

> The same feature turned up a real bug on the DESK, and that one is fixed —
> see the commit "The polar origin stays lit when the cursor sits exactly on
> it". `mousemove` rounds the cursor to whole pixels and `pointermove` does
> not, so dragging a node onto another node now lands dead on it instead of a
> pixel off — and dead on was the one position where the origin's glow had no
> path to fire. Not a touch issue at all; the migration simply reads more
> precise coordinates than the app ever got before, and that found it.

**Magnet highlights and hover cursors.** The magnet/snap highlight and every
hover-only cue are computed on the move path. A finger sees them only during a
drag, never before the press — so a touch drafter commits a point without the
confirmation a desk drafter gets first. Worth a board of its own: what the
snap feedback should look like when the press IS the hover.

**`title` tooltips.** Standard, and standard-broken on touch. Nothing to do
here unless the labels move on-screen.

## Reachable only from a keyboard — the real remaining gap

An iPad shows a keyboard only while a text field has focus, so anything that
needs a keypress is out of reach at the permit counter.

- **Ending a chain.** Every spec in the suite presses Enter. The other ending
  is a double click, and the browser makes one out of two quick taps —
  `touch-affordances.spec.js` pins that a double tap commits a wall run, so a
  finger can draw one with no keyboard at all. Enter remains the discoverable
  way, and a visible FINISH control would be better than a gesture nobody is
  told about.
- **UNDO is keyboard-only.** There is no on-screen undo anywhere in MODEL —
  which is precisely the sibling board already scoped to fix it. Flagging it
  here only to confirm it from the touch side: without that board, a touch
  drafter cannot undo at all.
- **Escape** (cancel a pending note, leave the tour) has the same problem.

## Pan and zoom: a definition-of-done item this board cannot meet

The board's DoD asks that a touch drafter can "pan and wheel-zoom (pinch
optional)". As things stand a finger can do **neither**:

- Zoom is `wheel` only. There is no wheel on a touchscreen and no on-screen
  zoom control anywhere in MODEL.
- Pan is middle-drag or alt+left-drag. A touchscreen has no middle button and
  no alt key.

Two-finger pan/zoom is explicitly a follow-up board, and the slice-3 rule says
not to redesign, so nothing was built. Stating it plainly: **the iPad can draw
now, but it cannot navigate the drawing.** For a permit-counter device that is
the next thing to fix, and there are two ways to go:

1. The follow-up gesture board — two-finger pan and pinch-zoom. The right
   answer, and it is a real piece of work: the first-pointer-wins policy this
   board installed is the thing it has to renegotiate.
2. A small on-screen cluster — zoom in / zoom out / fit, and a hand-tool
   toggle that makes a one-finger drag pan. Cheap, discoverable, useful on a
   desk too, and it does not touch the gesture policy at all.

Recommend 2 now and 1 when the gesture board comes up; they do not conflict.
That call is Devon's, not mine, which is why this is a note and not a commit.
