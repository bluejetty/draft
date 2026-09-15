# A ported rule keeps one home

Devin, 15 Sep. Asked for by Movie while the level-lock port was being written:
*"is there a guideline somewhere about keeping the rules in modules — what's
the alternative that doesn't work?"*

It was scattered across five documents and no single one stated it, so it was
being re-argued in every work order. This is the statement; the documents below
are the evidence, and none of it is new reasoning.

## The rule

**When a page adopts a shared module, the page reaches the module for every
rule in it. It does not keep, copy or re-derive one.** A page method becomes a
one-liner that calls the module with explicit arguments; what stays in the page
is only the half that owns real objects — the point objects, the state, the
undo entry.

This is the rule `REFACTOR-PLAN.md` already held all four completed extractions
to: *"the module function takes explicit inputs and returns values; the class
method becomes a one-liner calling it"* — and the plan notes that is why none
of the four needed a follow-up fix.

## The alternative that does not work

Copy the rule into the page. It is faster, it reads fine, and every test stays
green — which is precisely the problem: **two copies of one rule pass every
test either side runs alone.** They are not discovered by testing harder. They
are discovered when someone fixes one of them.

Measured, not argued:

- **`LAYOUT.dc.html` held its own copy of the level-assembly table.** When it
  finally adopted `level-assembly.js` (`c420e80`, PR #313), the copy was not
  merely duplicated but **wrong** — six fields answered where the module
  answers eight, with both pages handing the result to `cut-view.js`. It took a
  differential over 8,002 comparisons with seven mutations to prove the
  adoption. Nothing short of that differential would have found it.
- **The module's own header then lied about it for three days**
  (`level-assembly.js:21`, "LAYOUT.dc.html still holds its own copy"). A second
  home for a fact grows a third home in the comment describing it.
- **`PROJECT.html:310` is a fourth copy of the defaults table**, and #316 called
  the harness's copy "the last copy" without counting it. Counting copies is
  itself unreliable once there is more than one.
- **`ORDER-inbetween-levels.md` picked the same shape on purpose**: build the
  manual ADD path first so the bone has *"something to CALL rather than
  something to duplicate."*
- **`BOARDS.md` #351 — four distance functions that disagree where nothing
  looks.** The end state of allowing copies.
- **`MIGRATION-STATUS.md` applies it to documents too**: *"one record, and this
  is the index, not a second copy of it."*

## What this does NOT say

- **It does not say a second copy is always drift.** `PROJECT.html`'s per-level
  defaults carry values the shared module has no vocabulary for — a foundation
  wall at 8'-0", ENTRY's 9 1/4" joists. *"Those are not drift. They are the
  design."* The test is whether the copy answers the SAME question; if it
  answers a different one, it is not a copy and deleting it loses information.
- **It does not say port by copying the code across.** Port against the
  module's own contract — its exports and its harness — which is how the
  level-lock order was written after the first attempt drifted into asserting a
  description instead.
- **It does not override `MODULE-REVIEW-GATE.md`.** A wrong module is still
  fixed in the old app first, where it is running. This rule is about what
  happens after the verdict, not instead of it.

## How it is enforced

The port's own acceptance carries a check that the page reaches the module for
each export, so the page cannot quietly grow its own copy the day the module
changes. That is cheap to write at port time and near-impossible to add later,
once the copy exists and passes.
