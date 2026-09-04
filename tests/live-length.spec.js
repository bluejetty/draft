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
