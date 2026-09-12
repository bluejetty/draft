# BOARD — `waitForSaved` means "nothing outstanding right now", not "settled"

**Found 11 Sep 2026** by Gilligan, tracing a `write-tier.spec.js` flake Devin
sent over. Needs a board number.

**The flake it came from is not reproducible on current main, and no fix was
landed.** What is filed here is the measurement, because the hazard is real, it
is shared by 812 call sites, and rung 5 is the rung that makes it common.

The one-line version:

> **`data-save-dirty === '0'` is true while more writes are still coming.**

---

## The measurement

`tests/helpers.js:waitForSaved` waits for `document.body.dataset.saveDirty` to
read `'0'`, on the stated grounds that `_markUnsaved` stamps it synchronously
with the edit and clears it when the write lands. That is accurate for one
write. BUILD HOUSE is not one write.

Traced on `4923e1e` at 100ms intervals from the first bone press, reading the
store rather than the page:

```
   0ms  dirty=0 seq=2 beams=0 walls=26   <- waitForSaved is already satisfied
 100ms  dirty=0 seq=3 beams=7 walls=26   <- the beams arrive in a LATER write
 400ms  dirty=0 seq=4 beams=7 walls=26   <- and another one after that
```

Three write generations land after the page first calls itself saved, and the
dirty flag reads `'0'` at **every** sample in between. So a caller that waits for
`saveDirty === '0'` can legitimately be handed a half-built house, and the
snapshot it takes is indistinguishable from a finished one — the same drawing
shape, fewer items in it.

`waitForSaved` is not wrong. It answers "is a write outstanding". Callers read it
as "has the page finished", and for every page with no deferred second pass those
are the same sentence.

## Scale

```
812 call sites across 152 spec files
```

**This is why nothing was changed.** Altering what `waitForSaved` means to repair
one fixture is a blast radius nobody can price, and the existing meaning is
correct for the large majority of those callers. If the settled-state wait is
wanted, it belongs *beside* it as a new helper that callers opt into, not as a
redefinition of the old one.

## Why this is filed rather than fixed

`tests/write-tier.spec.js` was failing about one run in five. Measured:

| tree | shape of run | result |
| --- | --- | --- |
| `d81e988` (pre-rung-3) | 10 repeats | 4 failed / 20 |
| `bb8872e` (rung 3) | 10 repeats | 4 failed / 20 |
| `4923e1e` (rung 4a) | 10-40 repeats | 0 failed / 120 |
| **`4923e1e` (rung 4a)** | **80 repeats, one process** | **29 failed / 160 (18.1%)** |

**CORRECTED 11 Sep, AND THE FIRST VERSION OF THIS TABLE WAS WRONG.** It ended at
the third row and concluded the flake had stopped reproducing — that something
between `bb8872e` and `4923e1e` had fixed it. It had not. Re-measured at 80
repeats in a single process, current main fails **29 times in 160**.

The rate depends on the SHAPE of the run, not only on the tree. Short runs hide
it: at 18%, twenty cases come back clean about one time in fifty, and two such
runs in a row read as a fix. That is what the 0-in-120 was — three short runs, not
one long one.

**So the flake is not fixed, it is the base's, and it is large.** For comparison,
a branch carrying unrelated changes measured 31 failed / 240 (12.9%) over the
same 80-repeat shape, all of them in the two pre-existing tests. CI does not see
this because it shards four ways, which is exactly the short-run regime where it
hides.

The original error is left visible rather than edited away: a measurement whose
blind spot looks identical to a clean result is the same defect this board is
about, and it caught the person writing the board.

A call-site fix was written (wait for the beams to be present, then for the file
to be unchanged across two reads) and **reverted unpushed**. The gate for the
work was *twenty runs of the repaired test with the original seen red in the same
loop*. The original never went red. A fix that cannot be shown turning a failure
into a pass is a change justified by a story, and the story had a hole in it:

**The first diagnosis was wrong and is recorded here so the next reader does not
repeat it.** The early `savedDrawing` in that fixture feeds only
`saved.levels[0].id`; the drawing actually compared is read later, after the
layout write. So the window traced above is real but is probably not the window
that was failing. The cause of the original 4-in-20 remains unestablished.

## Why it still matters

Rung 5 of `RULING-autosave-two-writers.md` is autosave. A deferred second write
is the exceptional case today and the normal case then, and every one of those
812 call sites is currently green by virtue of not having one. When rung 5 lands,
this stops being a curiosity about BUILD HOUSE.

## What would reopen it

`write-tier.spec.js` going red again, or any spec failing with a snapshot that
holds a correctly shaped drawing with items missing. The measurement above is
done; start from it rather than from the beginning.
