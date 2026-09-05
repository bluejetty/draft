# Gilligan handoff — 5 Sep 2026

The reciprocal of `HANDOFF-SKIPPER.md`. That one has existed since 4 Sep and
this one has not, so for a day the project could survive losing Skipper's
context and not mine. Read `HANDOFF-SKIPPER.md` first — the **Who** and
**Standing constraints** sections there are the house rules and are not
repeated here. Written mid-round on purpose: an agent running out of context is
the worst-placed one to write a careful handoff.

## Lane

AGREED WITH SKIPPER 5 SEP, ratified by nobody yet — Movie or Devin still owe a
word on it. It amends Devin's 4 Sep ruling in two places, because that ruling
had `MODEL.dc.html` with Gilligan and `proto/` entire with Skipper, and both of
us had been working the other way round all day without noticing:

```
Skipper   proto/ (less section-table-harness.js), test.yml, MODEL.dc.html
Gilligan  MODEL.html, PROJECT.html, project-page.js,
          proto/section-table-harness.js
SHARED    cut-view.js, drawing-format.js, geometry-2d.js -- announce first
```

**Specs follow the file they exercise** (Skipper's amendment, and the better
half of it): detached-garage, garage, garage-callout, garage-piles,
garage-elevation-occlusion, garage-roof-drop and section-view with
`MODEL.dc.html`; project-bilevel, project-info, project-page, project-detached
and section-table with the PROJECT page.

**A list is checkable and a feature is a judgement call every time** — that is
why we kept the list after trying to redraw it by feature. But announce-first
is what actually protected us all day, not the list, so the list is a
convenience and the announcement is the mechanism.

Branch `claude/gilligan-greeting-ls9w2n`, reset onto `main` under the same name
after each merge. Prune the remote ref when Movie deletes the branch, or the
stop hook reports the merge commit as unpushed.

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
#295  the tier 2i measurement, and this document
#296  the DETACHED GARAGE defaults row; every garage foundation 1'-2" above
      grade; the thickened edge's 10" exception; SPEC-garage-foundations.md
#297  the opening clamp measures from the ADJACENT wall's inside face, not
      from the endpoint -- 5 1/2" + 3" = 8 1/2", and a 6x6 post where nothing
      stands. Restore keeps the old rule: load repairs damaged files, it does
      not re-rule sound ones (Skipper's point, and he was right)
#298  band 3 -- the detached garage section and the three foundations at one
      scale
#299  GARAGE_DEPTH_FT = 24, the fall composed from it, and the strip captioned
      with its station
```

Skipper merged #286, #289, #291 and #300 the same day.

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
3. **Awaiting a word from Movie**, in the order they block work:

   - **THE PALETTE PASS, and it blocks all five tier 2 painters.** See
     SPEC-model-html-tiers.md § Tier 2j. Notes and fixtures need a colour that
     is not the night page's own background; stairs, cut marks and underlays
     need keys that do not exist. Candidates are measured there. Nothing about
     tier 2 proceeds without this, and it is one decision rather than five.
   - **Should grade keep deriving from the attached garage?**
     `derivedGradeOffsetFt` computes a SITE fact from a BUILDING. It works, and
     it is the only path by which the house reaches the detached garage.
   - **Ratify the lane map**, agreed between Skipper and Gilligan and official
     from neither. Recorded in HANDOFF-SKIPPER.md.
   - **The brush's name**: DRAFTING BRUSH or dusting brush.

   ANSWERED 5 SEP, kept here because the reasoning outlived the question: the
   rough-opening plate is a 2x flat and 1 1/2" is a MINIMUM ("can't be less");
   and no zone row should inherit a wall height -- every row states its own,
   which is what #296 did for the detached garage after #293 did it for the
   attached one.

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
- **GREY TEXT IN A SCREENSHOT IS AUTOCORRECT. BLACK TEXT IS MOVIE.** My own
  earlier note here said "unsent text in a screenshot is not a message", which
  is the weaker version and did not save me: it distinguishes sent from unsent
  and says nothing about text the phone invented. On 5 Sep I read "do the
  strip" off Movie's input box and built the strip. He had never typed it —
  autocorrect had. Movie, 5 Sep: *"no that's autocorrect its grey text"*,
  *"only follow black text"*. **Follow black only.**
- **A check that reads the thing it is checking cannot fail.** The foundation
  row's order check compared the row against `GARAGE_FOUNDATIONS.detachedGarage`
  — the array the row is built from — so reordering it moved the result and the
  expectation together. It read green. `--mutate` reported `*** NOTHING ***`,
  which is the only reason it is not still sitting there looking fine. Assert
  the contract, spelt out; never derive the expectation from the subject.

## The habit

Every one of the above was found by comparing two things, or would have been.
The ones that cost the most were the ones where a real measurement was made and
then asked to answer a question it was never about.
