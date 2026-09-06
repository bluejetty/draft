# assets — and the four nobody references

Art the pages fetch by literal `src`. There is no bundler and no manifest, so
a file is "in use" exactly when some page names it, and **an unreferenced file
here looks identical to a forgotten one.** This note is the difference.

To check the state of any of these:

    grep -rl "btn-rabbit.png" --include=*.html --include=*.js .

## Kept deliberately, referenced by nothing

Four files, from one decision. Neither pair is dead weight by accident, and
neither should be deleted as a tidy-up without re-reading the reason:

| file | why it stopped being used |
|---|---|
| `btn-house.png`, `houseout.png` | **NEW-5.** The single HOUSE lamp became four text buttons — BUNGALOW / 2 STOREY / BILEVEL / MODIFIED BILEVEL. Movie: *"make it easier to understand for the user."* Text rather than lamp art, because the words are the point and a label carries no image to fetch. |
| `btn-split.png`, `splitout.png` | **NEW-5**, same change. SPLIT became BILEVEL, one of the four. |

**Why keep them at all.** Deleting artwork is a separate decision from removing
the thing that used it, and the two want separating: a button can come back
under a different name. **The cost is 386 KB across the four**, which is not
nothing — measured, because an unmeasured "it's only a few KB" is how this
kind of thing accumulates. It is still small against redrawing a lamp pair from
scratch, and the four are two matched pairs rather than four separate losses.

HOUSE and SPLIT are exactly the come-back case — the houses they stood for are
still drawn, just through four text buttons instead of two lamps.

**`btn-rabbit.png` WAS here and is not.** It was kept on the same reasoning for
about an hour, until Movie ruled the feature dead outright — *"we aren't doing
the rabbit in any way"* — at which point the art had nothing left to come back
for. That is the distinction this file is about: it went because someone
decided, not because it looked abandoned.

**If you are here to clean up**, that is a fine reason to delete them — but
delete them because you decided to, not because they looked abandoned. The
difference is the whole point of this file.

## The pairs

`btn-*.png` and `*out.png` are the same button lit and dark. Off is DRAWN
rather than approximated with a CSS filter, so a dark lamp keeps the colour
that says which lamp it is. That is why they come in twos and why a leftover
pair is two files rather than one.
