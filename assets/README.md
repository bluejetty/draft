# assets — and the five nobody references

Art the pages fetch by literal `src`. There is no bundler and no manifest, so
a file is "in use" exactly when some page names it, and **an unreferenced file
here looks identical to a forgotten one.** This note is the difference.

To check the state of any of these:

    grep -rl "btn-rabbit.png" --include=*.html --include=*.js .

## Kept deliberately, referenced by nothing

Five files, from two decisions. None of them is dead weight by accident, and
none should be deleted as a tidy-up without re-reading the reason:

| file | why it stopped being used |
|---|---|
| `btn-house.png`, `houseout.png` | **NEW-5.** The single HOUSE lamp became four text buttons — BUNGALOW / 2 STOREY / BILEVEL / MODIFIED BILEVEL. Movie: *"make it easier to understand for the user."* Text rather than lamp art, because the words are the point and a label carries no image to fetch. |
| `btn-split.png`, `splitout.png` | **NEW-5**, same change. SPLIT became BILEVEL, one of the four. |
| `btn-rabbit.png` | **Cancelled 6 Sep.** Movie removed the rabbit from the build row and the first-run ladder. The feature is not coming back; see `RD-DOCUMENTS/ORDER-build-row.md`. |

**Why keep them at all.** Deleting artwork is a separate decision from removing
the thing that used it, and the two want separating: a button can come back
under a different name, and 8 KB costs nothing next to redrawing a lamp. The
rabbit is the clearest case — the feature is cancelled outright, so its art is
the one with the weakest claim, and it is kept only so that the removal is one
decision rather than two taken in the same hour.

**If you are here to clean up**, that is a fine reason to delete them — but
delete them because you decided to, not because they looked abandoned. The
difference is the whole point of this file.

## The pairs

`btn-*.png` and `*out.png` are the same button lit and dark. Off is DRAWN
rather than approximated with a CSS filter, so a dark lamp keeps the colour
that says which lamp it is. That is why they come in twos and why a leftover
pair is two files rather than one.
