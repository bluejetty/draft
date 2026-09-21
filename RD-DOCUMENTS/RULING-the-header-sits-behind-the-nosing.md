# RULING — the header sits behind the nosing

**Movie, 21 Sep 2026**, reading a stair section on the live app:

> *"i just noticed on the stair section the nosing of the stair shouldn't be
> part of the floor opening (it should be moved in by 2" to allow for 1.5" of
> material if needed for stair backing and then 1/2" for the stair nosing. the
> floor opening should be behind the 2""*
>
> *"(will effect headroom slightly"*
>
> *"should start at 0 + 2 for the nosing and then keep going (nosing and 2" is
> part of the opening area)"*

Status: **RULED AND BUILT**, 21 Sep.

---

## The rule

**The rough opening's TOP edge sits `STAIR_OPENING_NOSING_MIN_IN` behind the
top nosing**, and the strip between them is floor:

    1/2"    the nosing itself          STAIR_NOSING_IN
    1 1/2"  the backing behind it      STAIR_NOSING_BACKING_IN
    -----
    2"      minimum                    STAIR_OPENING_NOSING_MIN_IN

**A MINIMUM, NOT A FIGURE.** Movie: *"could be more"*. Nothing may round it
down; a thicker nosing or deeper backing only ever grows it.

## What was wrong

`u = 0` is the top nosing — `drawing-format.js:598`, *"start is the
upper-floor nosing"* — and `_stairOpeningFootprint` started the hole there.
**The nosing line and the cut line were one line.** Cut at the nosing and the
backing that carries it has no floor to fasten to.

## Only ONE end moved, and that is the whole of it

The far end is set by headroom — how far down the flight the walking line
travels before a head clears the floor — and it stays that way. Movie:
*"the opening above is effected by headroom as well on that end"*.

**AND THE OTHER RULE IS A DIFFERENT HOLE.** He also said *"at bottom it is
opposite nosing goes over the opening min. 2""*, which reads like the far end
of this opening and is not:

> *"i meant if there is an opening for the stairs below"* — *"but those aren't
> opposite ends of the same opening"* — *"top nosing ... bottom nosing 1 level
> down"*

So the bottom rule governs the NEXT opening down, where the same stair passes
through the floor below. **NOT BUILT** — recorded here so it is not mistaken
for done, and not guessed at.

## Where it landed

    MODEL.dc.html   STAIR_NOSING_BACKING_IN / STAIR_NOSING_IN / ..._MIN_IN
    _stairOpeningFootprint   10 top-edge points, all three shapes
    _drawStairSectionPane    the cut drawn where it is cut, plus a tick and a
                             "2" MIN NOSING + BACKING" call-out
    _drawStairPlanPane       the same edge, same place

**THE TWO PANES DISAGREEING IS WHAT THE SUITE CAUGHT.** Moving the section's
edge and leaving the plan's put them 4 px apart;
`stair-view.spec.js:98` allows 2 and went red. That is the spec doing its job
on a bug introduced by this ruling, not an expectation needing a nudge — the
plan pane was fixed instead.

Two expectations in `build-stair-openings.spec.js` DID need updating: both
pinned `box.minX` at the nosing, and both moved by exactly 0.16667 ft. 43
stair specs green.
