# THE FOOT LIGHT — foot-rounding as a DRAFTING instrument

Ruled by Movie, 14 Sep:

> *"i think i'd like to set up the 1 foot constraint so it can be set up with
> the DRAFTING mode too using one of the unused lights on the bottom panel"*

and, asked whether the light governs drawing only or drawing and dragging:

> *"so it can be turned on and off with that light"* — **one light, both.**

## 1. What it is

The foot-rounding TOY does is already written and already lives in one place:
the page computes a landing distance and passes it through `stepFt`, and
`toy-constraints.js` quantises the **delta** (`round(d/step)*step`). This order
adds **a switch**, not a second implementation. If you find yourself writing
rounding code, stop — you are in the wrong function.

**On:** every point the drafter lands and every wall he drags lands on the
foot, in DRAFTING, exactly as it does in TOY.

**Off:** DRAFTING behaves precisely as it does today. Nothing moved, nothing
rounded, no half-inch surrendered.

## 2. Which light

The strip has five `dormant` chips: COMPASS, TRIANGLE, BRUSH, SCALE and
ERASING SHIELD (`MODEL.html:706-774`). Take **SCALE** —
`[data-mode-scale]`, `MODEL.html:761` — the three-sided architect's rule.
It is the instrument on that strip whose whole job is measuring in feet, so
the icon already says what the light does.

It stops being `dormant`, becomes a `<button>` like T-SQUARE beside it
(`:743`), and lights with the same `classList.toggle('lit', …)` T-SQUARE uses
(`:4473`). Follow that control exactly — it is the nearest neighbour and the
drafter already knows how it behaves.

Title text while lit and unlit should say what it does, not what it is:
*"FOOT — every point and every drag lands on the whole foot"*.

## 3. The rule that must not bend

**The light governs DRAFTING only. TOY is rounded because it is TOY.**

Turning the light off must not loosen TOY, and turning it on must not be the
thing TOY depends on. Today `board === 'toy' ? toyWallDelta(…) : …` is the
seam; after this order it is board **or** light, and the board arm must not be
reachable from the switch.

This is not fussiness. §3's gate already carries a mutant named *"TOY LEAKS:
every board goes through the constraint path"*, because a drafter finding his
DRAFTING plan quietly squared and rounded is the worst failure this app has.
The reverse leak — a light that can unround TOY — is the same defect wearing
the other coat. **Both directions need a check.**

## 4. State

The light is a **page setting, not drawing data**. It rides with the T-SQUARE:
same store, same restore-on-load, and it is **off by default**. A drafter who
has never touched it must never find his plan on the grid.

Do not write it into the drawing file. A drawing that carries "the foot light
was on" would arrive in someone else's session and start rounding his walls.

## 5. Acceptance

Red first, every one of them, and run the gate afterwards.

1. With the light **off**, a DRAFTING wall drawn to an odd length commits at
   that odd length, and a DRAFTING wall dragged an odd distance lands at the
   odd distance. Assert the committed numbers, not the cursor.
2. With the light **on**, the same two gestures land on the whole foot.
   Assert the committed number equals the displayed one — the §1 rule applies
   here too, and the strip's readout is the thing the drafter believes.
3. The light **survives reload** and is **off on a page that has never seen
   it**.
4. **TOY ignores it.** With the light off, a TOY wall still lands on the foot.
   Assert it — this is the leak, and it is the check most likely to be
   skipped.
5. The light is **not in the saved drawing**: save with it on, reload into a
   page where it is off, and the light is still off.
6. Whatever the light's state, **DRAFTING's other freedoms are untouched** —
   off-axis is still allowed. The foot light rounds distance; it is not the
   T-SQUARE and must not square anything.

## 6. Not in this order

- No second light for the T-SQUARE's job, no "TOY mode in DRAFTING" bundle.
  One switch, one behaviour.
- The other four dormant chips stay dormant.
