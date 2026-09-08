# THE AUDIT RULE — a check must be able to fail, and you must have seen it fail

Devin, 7 Sep. Boarded from Skipper's wrap-up the same day; Movie asked where
the rule lives. It lives here.

The one-line version:

> **A check that cannot fail is not a check. Prove each check can fail
> before you believe anything it passes.**

Twelve same-shape instances were caught on 7 Sep alone, across three of us,
in product code, in probes, in test tooling, and in a planning board. Not one
was caught by reading harder. Every one was caught by measuring — or by the
check finally failing for real.

---

## The shape

All twelve are one defect wearing four coats:

| coat | what it looks like | why it survives |
| --- | --- | --- |
| **the inert check** | a verifier exists, is correct, and never runs on the path that matters | green comes from silence, not from checking |
| **the empty filter** | a lookup that always returns nothing, so the loop that checks each item checks zero items | absence of findings reads as absence of faults |
| **the self-satisfying probe** | a measurement whose instrument matches itself, or asks a question the answer can't distinguish | broken and working produce the same output |
| **the uncounted claim** | a list or board written from memory and never measured | wrong in both directions, quoted as fact |

The common failure is not a wrong answer. It is **no answer, presented as a
pass.**

## The day's catalogue

The stair/beam lane (Skipper, landed as #335):

1. `_stairFloorBeams` filtered `view:'floor'` on the stair's own level while
   BUILD HOUSE stores its beams at `view:'foundation'` on level 1. The filter
   was always empty, so the nudger and the verifier both exited having
   checked **nothing**. Every house that passed, passed by geometry — never
   because anything checked. *(empty filter, product code)*
2. `_stairPlacementLegal` existed and was right, but the path that cuts the
   floor opening never consulted it where it mattered. *(inert check)*
3. `_stairAutoFit` returns inches moved. "Fit found" and "budget exhausted,
   still on the beam" return the same kind of number. The caller could not
   tell success from failure because the return value can't say. *(probe
   shape in product code)*
4. The first red-case probe searched three test houses and found **zero
   beams** — all three were under the 19' span threshold, so no beams were
   ever generated. "No violation found" from a world with nothing to
   violate. *(empty filter, probe)*
5. The second probe measured endpoint-to-segment distances and reported
   12.5" of clearance while the beam ran straight **through** the well —
   two segments can cross while all four endpoints sit far apart. The app's
   own `_stairBeamGapFt` does true segment intersection and returns 0.
   *(self-satisfying probe)*

The timing lane (Gilligan, landed as #336):

6. A 20-minute timing run with `--reporter=line` exited clean, 64/64 — and
   produced **zero timing data**, because that reporter prints durations
   only for failures. The measurement could not answer the question it was
   run to answer, and it looked done. *(self-satisfying probe)*
7. A waiter used `pgrep -f "playwright test"` and matched **its own command
   line** — seven "still running" reports about a run that never started
   (`cost.json` stayed at 0 bytes for 30 minutes). *(self-satisfying probe)*
8. The probe used to check that waiter had the identical flaw. Broken and
   working were indistinguishable at **both** layers. *(self-satisfying
   probe, squared)*
9. The test-budget board named `cuts` and `joins` as the heavy specs.
   Measured, `joins` was the **cheapest** file in the group (4.7s) and
   `model-html-origin` — never on the board — was the second worst. The
   list was written from memory and quoted as fact. *(uncounted claim)*

And three more from the same afternoon, after the rule was already named:

10. Beam re-derivation existed, was correct, and ran only during the guided
    tour — right machinery, unreachable from the path every post-tour
    drafter takes. Machinery you cannot reach is machinery you do not have.
    *(inert check, at the feature scale)*
11. A favicon added to nine pages with no guard would have been the next
    one: page ten arrives and quietly misses it. The guard that landed was
    written to **scan**, not to carry a list — and was proven by breaking
    it three ways and watching it name each break. That is this rule,
    practiced. *(the fix, done right)*
12. Found live while writing that guard, verified against the tree:
    `tests/no-third-party.spec.js` carries a hand-kept `PAGES` list of
    seven while ten pages sit on disk — `MODEL.html`, `Notepad.dc.html`
    and `SaveBox.dc.html` were never enrolled. "No page requests a
    third-party host" has been asserting about seven of ten and reading
    identically to asserting about all of them, green all along. Same
    fix shape as the favicon guard: **scan, don't carry a list.**
    *(uncounted claim, in a green spec)*

## The rule, as practice

Before trusting any check, probe, or measurement — new or existing:

1. **Make it fail on purpose.** Break the thing it guards and watch it go
   red, naming the right cause. If you cannot construct the failure, you do
   not know what the check checks. (Gilligan's favicon guard: broken three
   ways, three clean failures, then committed.)
2. **Count what the filter returned.** Before believing a loop found no
   violations, print how many items it examined. Zero examined is not zero
   violations — it is zero information. (Instances 1 and 4.)
3. **Ask what the return value can say.** If success and failure come back
   as the same type with no way to tell them apart, the caller is not
   checking anything. (Instance 3.)
4. **Never let an instrument measure itself.** A waiter that can match its
   own process, a reporter that only speaks on failure when you need the
   passing numbers — verify the instrument against a signal it cannot
   produce: file bytes growing, timestamps, the harness's own completion
   notice. (Instances 6–8.)
5. **Boards are claims, not measurements.** Anything load-bearing that was
   written from memory gets counted before it is quoted. (Instance 9.)
6. **A verifier is only as good as its call sites.** When you find a
   correct check, trace who calls it and when. Correct-but-inert is the
   most durable form of wrong, because nothing ever contradicts it.
   (Instances 2 and 10.)

## The substring day — 8 September

Sixteen instrument failures in one day between two crews. **Zero code
failures among them.** Every real defect that day was found by a check
someone had first proven could fail; every wrong answer came from a tool.

The centrepiece is a matched pair — the same bug, opposite polarity, and the
identical fix:

- **False pass (the expensive direction) — Skipper.**
  `stale-merge-refusal.spec.js` asserted the output did not contain
  `"SAVED"`. But `"UNSAVED"` contains `"SAVED"`. The assertion could never
  fail, and passed vacuously until a real edit plus a store-revision proof
  replaced it.
- **False alarm — Gilligan.** A failure detector grepped for `"failed"` and
  matched `"0 failed"` — and test names besides — reporting six failures
  from a clean run.

One direction hides a break, the other invents one. Both are the same
mistake: **a substring match answers a question you did not ask.** Match the
whole word.

The day's other instruments failed the same way in different clothes: a red
test that could never go green (its room's category had no row in the table,
and a category without a row always passes, so nothing about it could ever
be flagged); a `pkill -f` pattern that matched its own command line and
killed the shell running it; an exit code of 1 that came from `grep -c`
finding zero failures rather than from the suite; and a companion assertion
that read a file on disk when the thing it meant to measure had only
happened in memory.

The lesson is not "be careful with strings". It is that **an instrument is
code, and untested code is untested code** — including the code that decides
whether your other code is broken.

## Where this sits

`MODULE-REVIEW-GATE.md` already carries the sibling rule for module
verdicts: *no verdict without something run.* This file is the general form,
for checks and probes anywhere — product code, test helpers, shell one-offs,
and boards alike. The two rules are one discipline: **reading alone produces
confident wrongness; only a thing that ran, and could have failed, and
didn't, is evidence.**
