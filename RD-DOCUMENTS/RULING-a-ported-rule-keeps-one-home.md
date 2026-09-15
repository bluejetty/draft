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

- **It does not say a second copy is always drift.** This is the exception, and
  it has its own section below because getting it wrong deletes real design.
- **It does not say port by copying the code across.** Port against the
  module's own contract — its exports and its harness — which is how the
  level-lock order was written after the first attempt drifted into asserting a
  description instead.
- **It does not override `MODULE-REVIEW-GATE.md`.** A wrong module is still
  fixed in the old app first, where it is running. This rule is about what
  happens after the verdict, not instead of it.

## THE EXCEPTION — a second table that answers a different question

**The test is not "does this look like the module's table". It is: asked the
same question, with the same inputs, would the two have to agree?** If yes, one
of them is a copy and it goes. If no, it is not a copy at all, and deleting it
as tidy-up loses information nothing else in the app holds.

The worked example, and it was nearly deleted as drift:

> **IT IS NOT A DUPLICATE TO DELETE.** `PROJECT.html:310` is a fourth copy of
> the defaults table — the three that `level-assembly.js` was extracted to end
> were MODEL's, LAYOUT's and the elevation harness's, and #316 called the
> harness's "the last copy" without counting this one. But this copy carries
> **per-level** defaults the shared module has no vocabulary for: a foundation
> wall at 8'-0" against the house's 8'-1 1/8", ENTRY's 9 1/4" joists, OVER
> GARAGE's 19 1/4". Those are not drift. **They are the design.**
> — `ORDER-inbetween-levels.md:558`

Read that against the LAYOUT case above and the difference is the whole rule:
LAYOUT's copy answered the module's own question with six fields instead of
eight — same question, worse answer, so it went. PROJECT's answers a question
the module cannot be asked at all — *per level*, not *per building*.

So when you find a second table:

1. **Name the question each one answers.** If you cannot say them differently,
   they are the same question.
2. **Feed both the same inputs.** Disagreement proves copy-and-drift;
   agreement proves nothing yet, which is why step 3 exists.
3. **Ask what the second one knows that the first cannot be told.** If the
   answer is "nothing", it is a copy. If it is a real field — a per-level
   value, a per-page override the module has no vocabulary for — the honest
   fix is either to widen the module's vocabulary or to leave the table alone
   and *write down why it stays*. The one thing that is never right is
   deleting it because the count of copies looked wrong.
4. **If it stays, say so where it lives.** An unexplained second table is
   indistinguishable from drift to the next reader, who will delete it.

And a fourth copy is proof that counting copies does not work: #316 counted
three and was wrong. The count is not the instrument; the question is.

## How it is enforced

The port's own acceptance carries a check that the page reaches the module for
each export, so the page cannot quietly grow its own copy the day the module
changes. That is cheap to write at port time and near-impossible to add later,
once the copy exists and passes.

## Two rules that travel with this one

Both were ruled in conversation more than once before being written down, which
is the same failure this document exists to stop.

**A ported function ships with its caller, in the same commit.** A function
with no caller is dead code, and a test that calls it directly proves the code
runs, not that the feature happens. Ruled for the propagation port and again
for the level-lock port, where the caller is a rigid-assembly drag — and that
second one found the real gap: `MODEL.html` *writes* `rigid` and
`stretchBehavior` and nothing reads them, which a caller-less port would have
left unfound.

**No verdict without something run.** `MODULE-REVIEW-GATE.md` states this for
module verdicts; it holds for any claim about how the code behaves. *"Reading
alone produces confident wrongness — three of us proved that repeatedly on 1–2
Sep, and every one of those was caught by measuring rather than by reasoning
harder."* Two more since: a live-drag answer for the level lock given from a
comment near the call site, when the code applies the delta on release from
total displacement; and a red CI shard read as a stale green. Both were caught
by someone opening the file.

