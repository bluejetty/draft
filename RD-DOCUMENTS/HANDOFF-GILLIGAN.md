# Gilligan handoff — 5 Sep 2026

The reciprocal of `HANDOFF-SKIPPER.md`. That one has existed since 4 Sep and
this one has not, so for a day the project could survive losing Skipper's
context and not mine. Read `HANDOFF-SKIPPER.md` first — the **Who** and
**Standing constraints** sections there are the house rules and are not
repeated here. Written mid-round on purpose: an agent running out of context is
the worst-placed one to write a careful handoff.

## Lane

`PROJECT.html`, `project-page.js`, `MODEL.html`, `geometry-2d.js`, and the
specs under `tests/` for them. `MODEL.dc.html` is Skipper's; Movie opened it to
me twice today while Skipper was out, and both times it was for a change small
enough to name in a sentence. Branch `claude/gilligan-greeting-ls9w2n`, reset
onto `main` under the same name after each merge.

## Merged today

```
#288  band 2, the MODIFIED BILEVEL row on the PROJECT page
#290  floorOffsetFt -> sillOffsetFt: it was never the floor, the slab sits
      5 1/2" below. Plus the empty-box defect -- repaint had two exits and
      only one wrote the value
#292  the garage sill row, and a derived garage floor row beneath it
#293  the garage's own wall height, and SPEC-lintels.md
#294  an opening keeps NBC bearing back from the end of its wall --
      1 1/2" under 3 m, 3" over, ten callers share the clamp
```

## Open, with the measuring already done

1. **Tier 2 — five painters, not eight.** `SPEC-model-html-tiers.md` § Tier 2i
   has the triage, the per-painter cost taken from call sites, and the
   transitive purity of all six env suppliers. Nothing in any closure reads
   interaction state. Order cheapest first: notes, fixtures, cut marks,
   stairs, underlays. **Underlays is the trap** — four env keys, but `imageFor`
   reads a decoded-bitmap cache and MODEL.html has no loader, so four keys is
   not four keys of work.
2. **The drafting brush** — designed and specced in `SPEC-drafting-brush.md`,
   not started. Key `I`; chip and key both toggle; Escape steps one level;
   the brush carries what a thing IS, never where it is; the target decides
   the verb. It lives in `MODEL.dc.html`, so it is chrome in Skipper's lane
   and it is parked until tier 2 is closed.
3. **Awaiting a word from Movie**: the brush's name (DRAFTING BRUSH vs dusting
   brush); whether the rough-opening plate is a 2x flat at 1 1/2"; whether any
   zone row should inherit a wall height at all, after #293 found the garage
   inheriting an unbuildable one.

## Traps this session actually hit

- **A span measured correctly tells you its length and nothing about what it
  is.** I measured the entry wall off Movie's PDF to a good scale, concluded
  the entry floor bore on its own deeper frost wall, and was wrong: the
  2'-8"/2'-4" was the garage grade beam coming in from the side. The
  arithmetic was sound and the attribution was invented. Retracted in
  `SPEC-bilevel-section.md`.
- **A line range is not a function body.** Twice in one day. `_wallCross` was
  reported impure because the range ran past its closing brace and swallowed
  `_activeFixtures`; `drawUnderlays2D` was costed at sixteen env keys the same
  way, when its call site passes four. **Brace-match, or read the call site.**
  Never subtract two declaration line numbers.
- **A rotted mutation anchor is invisible in plain mode.** Adding one field to
  a frozen object literal broke a mutation that matched the whole literal, and
  CI went red with `1 mutation(s) never applied`. My local reproduction swept
  every harness by exit code in **plain mode** and came back clean. Sweep
  `--mutate` across all of `proto/`. Third occurrence of this shape.
- **Anchor a mutation on the fields it flips**, not on the object around them.
  The anchor that rotted matched a whole `Object.freeze({...})`; the
  replacement matches `label: 'BILEVEL', reserved: true` and survives any
  field added beside it.
- **The check-runs endpoint serves stale reads.** Twice today a shard read
  `in_progress` long after it had finished — once for twenty minutes, once
  right up to the merge event. I nearly re-ran a job and would have discarded
  four green shards. Compare `completed_at` across calls; a repeated identical
  response is not evidence of a stall.
- **The suite will not survive `--workers=4`.** 860 passed / 8 failed became 30
  passed on a serial re-run of the same seven files. The specs share one
  origin and one localStorage. CI's own comment says `workers: 1` is not
  timidity.
- **I reported "zero failures" seven times from a grep for a marker the `line`
  reporter never emits.** An absence in a log is not a pass. Read the
  reporter's actual summary line.
- **A differential that always holds proves nothing.** Band 2's first test
  asserted its canvas differed from band 1's. Band 1 contains the garage, so
  they always differ — handing band 2 an exact second bungalow **passed**.
  Assert the contract, and put an inequality beside a differential.
- **Check persistence in `tests/persisted-format.spec.js`, not
  `drawing-format.js`.** Four keys absent from the format module looked
  transient and are persisted; MODEL.dc.html serialises `levelAssemblies` and
  `elevationMarkOffsets` itself. Wrong module, confident answer.
- **A changed signature with an unchanged call site.** `fillBilevel` gained a
  parameter, repaint threw, and both bands lost every label. No test caught
  it; a screenshot did.

## The habit

Every one of the above was found by comparing two things, or would have been.
The ones that cost the most were the ones where a real measurement was made and
then asked to answer a question it was never about.
