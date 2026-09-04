// The live LENGTH readout, while a tool is mid-draw.
//
// This box had no behavioural coverage at all -- sticky-ruler.spec.js asserts
// the element EXISTS on the instrument strip and never reads it -- which is
// how two separate defects lived in it at once:
//
//   line     set the length, then had it wiped on the same mousemove, because
//            the clear at the end of _onMouseMove re-enumerated the tools that
//            were allowed to keep theirs and `line` had never been added
//   outline  never called _setLen at all, so tracing a house showed nothing
//            even though the tool accepts a typed length perfectly well
//
// Every assertion here is paired with a control, because "the box has text" is
// satisfied by a box that was never cleared, and "the box is empty" is
// satisfied by a readout that is simply broken. Only the pair says the value
// tracks what the drafter is doing.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const lenText = page => page.locator('[data-model-len]').innerText();

test.describe('the live LENGTH readout', () => {
  test('the line tool shows a length while drawing, and clears when it stops', async ({ page }) => {
    await h.openModel(page);
    await h.selectTool(page, 'line');

    // Nothing started yet: the box is empty. This is the control for the
    // assertion below -- without it, a box that always reads "10'-0"" passes.
    await h.moveTo(page, 4, 4);
    expect((await lenText(page)).trim()).toBe('');

    await h.clickWorld(page, 0, 0);
    await h.moveTo(page, 10, 0);
    const drawing = (await lenText(page)).trim();
    expect(drawing).not.toBe('');
    expect(drawing).toMatch(/↔/);
  });

  test('the outline tool shows a length while tracing', async ({ page }) => {
    await h.openModel(page);
    await h.selectTool(page, 'outline');

    await h.moveTo(page, 4, 4);
    expect((await lenText(page)).trim()).toBe('');

    await h.clickWorld(page, -8, -6);
    await h.moveTo(page, 8, -6);
    const tracing = (await lenText(page)).trim();
    expect(tracing).not.toBe('');
    expect(tracing).toMatch(/↔/);
  });

  // The cut tool's HOLD, which is the one exception the guard keeps. While the
  // drafter is choosing the direction nothing recomputes the length, and the
  // distance they just placed is exactly what they still need to see -- so the
  // clear must not fire even though no tool wrote this frame.
  //
  // Before this, that exception was a correct behaviour protected by a comment
  // and nothing else: delete `holdingCutLength` and every test still passed.
  // That is the shape both defects above lived in, so leaving it untested in
  // the very change that removes the shape would have been the same mistake
  // one layer along. (Skipper's catch, on this PR.)
  //
  // Stated as a differential, because "the length holds" is satisfied by a
  // readout that never updated in the first place. It must TRACK the pointer
  // while placing, and then STOP tracking once the end is down.
  test('the cut tool holds its length while the direction is being chosen', async ({ page }) => {
    await h.openModel(page);
    // CUT has no button matching its name -- it is armed by its keybinding,
    // 'C' (profile-manager.js). selectTool() special-cases outline the same
    // way; this is the second tool that needs it.
    await page.evaluate(() => {
      if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur();
    });
    await page.keyboard.press('c');

    await h.moveTo(page, 4, 4);
    expect((await lenText(page)).trim()).toBe('');

    // Phase 1 -> placing. The readout tracks the pointer: two different
    // positions must give two different readings, or "holds" below proves
    // nothing.
    await h.clickWorld(page, 0, 0);
    await h.moveTo(page, 10, 0);
    const atTen = (await lenText(page)).trim();
    expect(atTen).not.toBe('');
    await h.moveTo(page, 20, 0);
    const atTwenty = (await lenText(page)).trim();
    expect(atTwenty).not.toBe(atTen);

    // Phase 2 -> choosing. The end is placed; the length must now hold, and
    // keep holding wherever the pointer goes.
    await h.clickWorld(page, 20, 0);
    await h.moveTo(page, 20, 12);
    expect((await lenText(page)).trim()).toBe(atTwenty);
    await h.moveTo(page, -5, -5);
    expect((await lenText(page)).trim()).toBe(atTwenty);
  });

  // The tool that always worked, kept as the reference: if this one breaks the
  // failure is in _setLen or the strip, not in the guard.
  test('the wall tool still shows a length while drawing', async ({ page }) => {
    await h.openModel(page);
    await h.selectTool(page, 'wall');
    await h.clickWorld(page, 0, 0);
    await h.moveTo(page, 12, 0);
    expect((await lenText(page)).trim()).toMatch(/↔/);
  });

  // And the clear still clears. The guard was inverted, not deleted: a tool
  // that is NOT mid-draw must leave the box blank, or the readout becomes a
  // stale number the drafter has no reason to distrust.
  test('a tool that is not drawing leaves the box empty', async ({ page }) => {
    await h.openModel(page);
    await h.selectTool(page, 'line');
    await h.clickWorld(page, 0, 0);
    await h.moveTo(page, 10, 0);
    expect((await lenText(page)).trim()).not.toBe('');

    await page.keyboard.press('Escape');
    await h.moveTo(page, 3, 7);
    expect((await lenText(page)).trim()).toBe('');
  });
});
