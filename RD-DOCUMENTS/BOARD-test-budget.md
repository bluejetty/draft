# BOARD — the suite's heaviest specs sit on a 90-second cliff

**Found 6 Sep 2026** by Gilligan and Skipper, over about six hours, while
attributing seven failures on the stairs branch. Needs a board number.
**The diagnosis is complete, and the first fix has landed:** Movie ruled
*"raise the timeout"* on 6 Sep and `playwright.config.js` is now `180_000`.
What that settles and what it does not is the last section.

The one-line version, and it took all night to earn:

> **It was never a race. It was a queue.**

---

## What is actually wrong

`playwright.config.js` gives every test 90 seconds. A handful of MODEL.html
specs need most of that on a good day — a full BUILD HOUSE, five page loads,
five canvas pixel reads each. They pass with no margin.

Anything that adds time tips them over. **Two things do, and they are
independent:**

| | what it adds | who sees it |
|---|---|---|
| **latency** | a blocked `indexedDB.open` costing seconds | a slower machine |
| **contention** | four shards competing for one box | a sharded run |

That is the whole fault. There is no race, no corrupted state, no
non-deterministic code path. Tests that need 85 seconds get 90, and sometimes
90 is not enough.

## The measurement that settles it

Same tree, same box, same worker count, `3223d79`. **Only the clock changed:**

```
base @  90s  →  2 failed, 2 failed, 1 failed
base @ 180s  →  0 failed, 0 failed, 0 failed     (6.8 / 6.7 / 6.9 min)
```

Three for three each way. And every 180-second run finished at **clean-run
duration** — nothing was quietly finishing at 170, which is what you would see
if the tests were merely slow rather than merely close.

A delay has a length. A wedge does not. This one had a length.

## Why it looked like a race for six hours

**Because the failing set rotated.** Different specs failed on different runs,
which reads as non-determinism and sent both of us hunting for shared state.

The budget model explains it exactly. Specs sit at various distances from the
90-second line. Around the boundary, which ones cross on a given run is close
to a coin toss — so the failing list changes while the underlying cause is
completely deterministic. Gilligan's post-fix four-shard run shows the same
thing from the other side:

| spec | pre-fix | post-fix |
|---|---|---|
| `cuts:102` | failed | **passes** — was near the line |
| `joins:108` | failed | still fails — pushed well over |
| `wall-colours:131` / `:149` | failed | still fail — pushed well over |

Removing latency flips the near ones and leaves the far ones. That is a budget,
not a race.

## What the `onblocked` fix does and does not do

`e6ac7b0` (merged in #309) is a **real defect, independently proven**: a
blocked `indexedDB.open` never settled, because `forget()` was reachable from
`onsuccess`, `onerror`, `onversionchange` and `onclose` but not from
`onblocked`. Its spec fails without the handler, as a timeout.

**It removes real seconds from the load path.** On the machine where latency
was the binding constraint it took base from 3/3 failing to 3/3 clean.

**It cannot help where contention is the constraint**, and it does not
"fix the flaky suite". Anyone reading this in six months: those are two
different sentences and only the first one is true.

## The instruments, and why most of them were blind

Three of the five things we measured on could not see the bug at all. Every
one of them looked like evidence at some point.

| instrument | can it see it? | why |
|---|---|---|
| Gilligan's box, idle | **no** | fast enough that nothing crosses the line |
| CI, four shards | **no** | already green on base — run 802 |
| Gilligan's box, 4 shards | yes | contention crosses it |
| Skipper's box, idle | yes | slow enough that latency crosses it |
| Skipper's box, +180s | control | proves the mechanism |

### CI IS NOT SAFELY ON THE FAR SIDE, AND THIS PARAGRAPH SAID IT WAS

**Written wrong first, corrected within the hour, and kept as both.** The
original text read:

> *PR #310 changed nothing but markdown and still ran the full sharded suite —
> clean, four for four. So CI's machine is **not near the line at all**,
> consistent with base run 802.*

Two clean CI runs — base run 802 and a markdown-only PR — and I called it a
position. **Then CI crossed the line.** PR #313, a change confined to
`LAYOUT.dc.html`, failed `model-html-origin.spec.js:135` on shard 2: a
90-second timeout, 232 passed, and a spec whose diff cannot reach it —
MODEL.html never loads LAYOUT.dc.html and the spec names LAYOUT zero times.

So CI is **near enough to cross on a bad draw**, on its own hardware, with no
slow container and no second tree involved.

**Which is the third time in one day that two data points were read as a
trend** — the same error this board already records twice, committed by the
person writing it down. That is worth more than the correction: the pattern is
not carelessness, it is what two matching results *feel* like.

**And it raises the stakes rather than lowering them.** A green check on this
repo is partly luck on CI's own machine, not merely on an unlucky one. Anyone
using "CI is always green" to dismiss a red shard as "must be my change" is
using a claim that has now been falsified.

**A green run only means something from a box that has been shown to go red.**
That sentence would have saved hours. We wrote off three instruments for the
same reason, twice each, before it stuck.

## What has to be decided

Three options, and this is a judgement call rather than a measurement:

1. **Raise the timeout.** One line. Honest about what the specs cost, and buys
   headroom for slower machines. Does nothing about *why* they are expensive,
   and a budget nobody enforces drifts.
2. **Split the heavy specs.** Each does a full house build plus five loads and
   five pixel reads. Split at the seams and each half fits comfortably. More
   files, more setup cost overall, but every test stays well inside its budget.
3. **Reduce what each one does.** The most work and the best outcome — the
   expensive part is rebuilding the same house repeatedly, and some of that is
   reusable across the group.

**Recommendation was 1 now, 3 later. Movie ruled 1 on 6 Sep: "raise the
timeout".**

**WHAT IT DID.** `playwright.config.js` is `180_000` — the value that was
measured, not a guess somewhere between it and 90. Nobody has found the real
line, so picking 120 would have been a number standing in for a measurement.
The config comment carries the before/after, so whoever considers lowering it
can see what happened last time.

The cost is small and one-sided: **a passing test does not consume its
timeout**, so a larger ceiling only changes how long a genuinely broken test
takes to report.

**WHAT IT DID NOT DO.** The heavy specs are still heavy. Each rebuilds the same
house, loads five pages and reads five sets of pixels, and the reason they sat
on the line is that nobody had counted what they cost. **(3) is still the real
fix** and stays on this board: the expensive part is repeated setup, and some
of it is reusable across the group.

So this is a floor raised under a known problem, not the problem solved.
Anything that makes those specs slower will find the new line the way it found
the old one — and the symptom will look identical: a spec failing on a PR whose
diff cannot reach it.

**Option 2 stays the one to avoid.** Splitting the heavy specs spreads the cost
without lowering it, and pays for the same setup twice.

## Method lessons, which are the transferable part

Every one of these cost real time tonight.

- **Two data points are not a line.** Twice, a pattern held for two runs and
  the third undid it. Both times the two-run version was already being acted
  on.
- **`pgrep -f` matches its own command line.** It caught all three of us —
  a `pkill` that killed its own chain, a waiter whose condition could never go
  false, a stale-server check that reported itself. Match on a PID you started,
  or watch for the output you want rather than the absence of a process.
- **A check whose failure mode is silence looks exactly like success.** A grep
  for `✘` against a reporter that never emits it returned zero four times
  running and read as "no failures".
- **Test the sha, not the ref.** `refs/pull/307/head` had moved to the revert;
  three hours of "it passes locally" were measuring reverted code.
- **Verify the enclosing function, not the line.** A colour literal at `:740`
  belonged to a different painter than the one being audited.
- **`retain-on-failure` keeps traces, but the artifacts directory is reused.**
  A trace from two runs ago is already gone.
- **AN EMPTINESS ASSERTION NEEDS A COMPANION THAT THE POPULATION IS NOT
  EMPTY.** 6 Sep. `persisted-format.spec.js` checked that no build-type button
  was lit by filtering `[data-select-build]` and expecting zero. When the build
  row became a menu, that selector stopped matching anything on a closed row --
  and a filter over an empty list is zero whatever the page does. The check
  went on passing while testing nothing.

  It is the same shape as the `grep -c '✘'` above, and the general rule is
  Gilligan's: an assertion of ABSENCE proves nothing without proof of
  PRESENCE. Mechanical enough to grep for, which "a check whose broken state
  looks like its passing state is not a check" never was. He searched the
  suite: **one instance in 127 emptiness assertions**, and the two near-hits
  in `rail-order.spec.js` (`:57`, `:79`) use the count as a SELECTOR and then
  assert something positive, which is fine.

  The fix is one line beside it -- `expect(locator.count()).toBe(3)` -- and it
  is what makes the zero mean something.

