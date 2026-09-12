# RULING — a rejected item is still the drafter's

**Movie, 11 Sep.** Binds `MODEL.html`. Deliberately does not bind
`MODEL.dc.html` — see the asymmetry, below, which is a decision and not an
omission.

> A page may show less than the file contains. It may not save less than the
> file contains.

The same sentence that settled the wall types, applied to the other way this
page could quietly lose a drafter's work.

---

## THE CASE

`drawing-format.js` refuses malformed geometry: a zero-length wall, a floor with
two points, a dimension whose id is already taken. That refusal is right, and
the rules exist so the page does not try to draw something it cannot.

`MODEL.html` also **writes**. It built its drawing from the accepted items and
serialised that drawing, so a refused item was gone from the file on the next
SAVE:

    open a drawing with one bad wall  →  change nothing  →  press SAVE
    →  the wall is deleted from the file

**The drafter asked to draw nothing and lost data anyway.** No error, no
message, and no way to notice until the item is needed. A page that opens a
file is not thereby licensed to edit it.

Its twin is `RULING-substitution-is-not-a-save`: there, a wall type this app no
longer carries was re-emitted as the substitute the app painted. Same shape,
different field — an accommodation made for the *screen* leaking into the
*file*.

**The distinction between the two cases is worth keeping**, because it is the
reason the same answer is right twice rather than once:

| | what is wrong | who it is wrong for |
|---|---|---|
| substitution | this app cannot **draw** the wall type | the app's limitation |
| rejection | the item is not valid **drawing data** | the file's defect |

They resolve identically. Neither is a fact about what the drafter wants stored,
and neither is a licence to edit their file on their behalf.

---

## WHAT THE PAGE DOES NOW

1. **Refused items are kept raw**, by index, exactly as they came out of the
   file — including keys nothing in this repo reads.
2. **They are not drawn.** They failed the format's rules; drawing them is what
   those rules prevent.
3. **The serializer puts them back** at the index they came in at, so a load
   followed by an untouched SAVE reproduces the file's own order rather than a
   resemblance of it. The index clamps: after the drafter adds or deletes, the
   recorded slot may be past the end, and the item lands as near its old
   position as the array allows. That is a choice, stated rather than implied.
4. **The readout says how many**, in the voice it already used:
   `4 not drawn, kept in file`. The count is the same count it always
   reported. **The word changed because the behaviour did** — "dropped" is now
   a lie in the direction that matters, and the readout is the only instrument
   on this page.

### The list comes from the rule, not from a comparison

Each normaliser takes a caller-supplied `drops` sink, the pattern `levelLocks`
already established for the same stated reason: *the rules stay in one place
instead of being re-derived at the call site, where they would drift*.

Reconstructing the refusals in `MODEL.html` — diffing raw against accepted —
looks equivalent and is wrong twice:

- **Position.** The map is 1:1 with the input and the filter runs after it, so a
  refusal's index is known inside the module and unrecoverable from the filtered
  array alone.
- **Cross-item state.** `dimensions` refuses a duplicate id through a `seen`
  set. **Re-run on its own, that duplicate passes.** A caller re-deriving
  refusals one item at a time would call it accepted, never record it, and lose
  it on the next save — while looking exactly like a caller that works.

Measured, not argued: `F.dimensions([duplicate], levelIds)` returns it.

---

## THE ASYMMETRY IS DELIBERATE

`MODEL.dc.html` drops refused items too, and **is not being changed.** It is
being retired; hardening a file we intend to delete spends work on the page we
are trying to stop people writing from. So for a while the newer page is the
more careful of the two.

Written down here so it does not read as an oversight to whoever finds it next.
It is not a board and it is not a TODO. If the old page outlives this decision,
this is the paragraph to reopen.

---

## THE TEST

`tests/write-tier.spec.js` — *"an item the format module refuses is not drawn,
and SAVE writes it back unchanged"*.

**A keep-and-re-emit that is not asserted whole is a green that proves
nothing.** So the round trip is `toEqual` on the entire parsed drawing, plus a
named assertion on the refused wall itself.

Four refusals, one per normalised collection, because the four go through four
different rules and a fix applied to walls alone would look identical from the
outside. The wall is planted **in the middle** of the array — order is part of
the comparison, and an item that returns at the end passes a presence check
while still not being the file the drafter had. It carries a `provenance` key
nothing in the repo reads: a page that rebuilt the item out of the fields it
understands would drop that and look entirely correct doing so.

Four mutations run, four killed, and the assertion each one trips is worth
recording because they are not the same assertion:

| mutation | dies on |
|---|---|
| drop `withRefused` from walls | the refused wall is missing from the saved file |
| `withRefused` returns `items` unchanged | same, across all four collections |
| append instead of restoring the index | the whole-file compare, on order alone |
| stop passing `drops` to floors | the readout count — 3, not 4 — before the round trip is even reached |

The last one never gets as far as the save, which is the honest way to report
it: the count assertion is load-bearing rather than decorative.

---

## HOW THIS WAS DECIDED, INCLUDING THE PART THAT WAS WRONG

Devin proposed keep-and-re-emit. **I put the question to Movie and recorded the
answer as "dropping is correct" — the opposite.** Devin caught it before it was
written down, Movie handed the pick back to me, and this is it.

Recorded rather than tidied away, for the same reason as everything else in this
file: the wrong version existed for twenty minutes and a ruling that shows only
its final state cannot be checked by the next person who reads it.

**The dangling citation, found while writing this — and now fixed.**
`RULING-substitution-is-not-a-save` was cited by **five files on main** and
existed in none of them: `MODEL.html`, `MODEL.dc.html`, `BOARDS.md`,
`W0-serializer-census.md`, `tests/legacy-wall-type-round-trip.spec.js`. The
ruling is real and both halves shipped; the document never landed, so the repo
spent a day enforcing a file it did not contain.

I first counted **three**, because I grepped my own branch instead of main. The
two I missed are the two I wrote myself — `cfd644c` and `5a1cee7` on the census
branch. **I cited a document I had never opened, and then reported it missing.**

Movie's original is now committed verbatim rather than reconstructed. Rebuilding
it from the code comments and PR bodies it produced would have given a document
that agrees with everything already written and could not contradict any of it —
which is the whole reason a citation to a missing file is dangerous rather than
merely untidy.
