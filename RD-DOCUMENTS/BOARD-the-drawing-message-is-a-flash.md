# BOARD — the drawing message is a flash, and polling a flash is a flake

**Found 13 Sep 2026**, tracing the 3.75% red Gilligan measured on merged main
(3 failures in 80 serial runs) in `tests/model-change-broadcast.spec.js`, the
test *a dirty old page holding a refused write re-reads nothing*. Fixed in the
same pass; this file is the measurement, because the shape is general.

The one-line version:

> **`toContainText` on a message that is replaced 70 ms later is a race with
> the poll scheduler, not an assertion.**

---

## What the test was waiting for

The old page is deliberately behind: another page has written, this page is
holding a refused write, and the test presses `Control+z` to prove the local
edit and its history survived. It then read the message element:

```js
await page.keyboard.press('Control+z');
await expect(page.locator('[data-model-drawing-message]'))
  .toContainText('Undone.', { timeout: 4000 });
```

Nothing in that path is slow. Measured on `76ab2e0` with a `MutationObserver`
recording every change of the element's text, six runs, all six the same shape
(times in ms from the keypress):

```
  0    "Another page saved this drawing. Nothing was written — …"
 18–34  ""
 21–36  "Undone."
 81–117 "Another page saved this drawing. Nothing was written — …"
```

**`Undone.` is on screen for 60–81 ms.** `_undo` restores the snapshot,
`_restoreSnapshot` ends in `_markUnsaved()`, that queues a write, and the write
is refused again — because this page is *still* behind — so the conflict
handler sets `drawingMessage` in its turn and overwrites the word the test came
to see. That is correct product behaviour: the undo happened, and the page is
still holding an unsaved edit against a newer file. Both statements are true
and only one of them fits in one element.

So the assertion usually catches it on its first poll, and when the scheduler
puts that first poll 100 ms late it never catches it at all — and then spends
its whole 4-second budget looking at the banner that replaced it. The 4 s
budget is why it looks like slowness. It is not slowness; the window is 70 ms
wide and the test arrived after it closed.

## The fix: record the transitions, assert against the record

```js
await recordDrawingMessages(page);   // MutationObserver → window.__drawingMessages
await page.keyboard.press('Control+z');
await sawDrawingMessage(page, 'Undone', '…');   // did it EVER say it
```

This waits on the event rather than on the DOM happening to still show it, and
it says the same thing the original meant to say. The mutation it exists to
catch — the page re-reading the newer file and losing the drafter's line — is
caught exactly as before: with no history to restore there is no `Undone.` in
the record either.

## The gate

A fix that cannot be shown turning a red into a green is a story. Since the
failure is intermittent by construction, the window was forced instead of
waited for: the same gesture with the first poll deliberately 200 ms late.

| form of the assertion | first poll | result |
| --- | --- | --- |
| `toContainText('Undone')` | +200 ms | **3 failed / 3** |
| recorded transitions | +200 ms | **3 passed / 3** |

Then the repaired test at its natural timing, 40 serial repeats: see the PR.

## The general shape, for the next reader

**A message element is a channel, not a state.** Three different writers use
`drawingMessage` — the undo, the save, the conflict handler — and the last one
wins. Any test that asserts on what one of them wrote is racing the other two,
and the race is invisible while the machine is quick. Two ways out, and the
first is better:

1. assert on the **state** the message describes — this same test still checks
   `data-model-status` reads `UNSAVED` and that the store never took the line;
2. if the wording itself is the thing under test, **record the channel** and
   assert the value appeared, never that it is still there.

What is *not* a way out is raising the timeout. The old assertion would fail
the same way with a 40-second budget, and the only thing a longer budget buys
is a slower red.
