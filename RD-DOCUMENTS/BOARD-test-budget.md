# BOARD — the suite's heaviest specs sit on a 90-second cliff

**Found 6 Sep 2026** by Gilligan and Skipper, over about six hours, while
attributing seven failures on the stairs branch. Needs a board number and a
decision. **The diagnosis is complete; the fix is not chosen.**

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

**Recommendation: 1 now, 3 later.** Raise the timeout today so Tier 3 does not
push PRs through a suite that is partly luck, and put the real reduction on the
board as its own piece of work. Option 2 is the one to avoid — it spreads the
cost around without lowering it.

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
