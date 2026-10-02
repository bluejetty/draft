// THE TAG IS THE CONTROL: CLICK IT, TYPE A SIZE, THE WINDOW CHANGES.
//
// Movie, 28 Sep: *"yes i want to change the window tags when you click on them
// and that will also change the actual window soze"*, with the two rules that
// decide where the glass goes: *"center dimension line stays in same place
// enlarge outward from that point"*, and the head stays put while the sill
// drops.
//
// WHY IT FINDS THE TAG THE HARD WAY. MODEL.html keeps a list of where it put
// each tag, and the press is tested against that list -- so a spec that ASKED
// that list where to click would click wherever the list said, agree with
// itself, and pass just as happily if every tag were recorded in the wrong
// place. This watches the real `fillText` and takes the position off the
// context's own transform, which is where the ink actually went.
//
// WHY A SPEC AND NOT A HARNESS. Every part is browser: a press in CSS pixels
// against a rotated box, an input that must take the keystrokes the canvas
// would otherwise read as tool shortcuts, and a record that has to survive a
// save.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const h = require('./helpers');

const REPRO = JSON.parse(fs.readFileSync(
  path.join(__dirname, '..', 'proto', 'repro-movie-bands.draft'), 'utf8'));
const SIZE = /^W \d+ X \d+$/;

// The tape: every string the canvas is asked to paint, WITH where the context
// was standing when it was asked. labelAlongLine2D translates to the tag's
// centre and then rotates, so the transform's e/f IS that centre -- in device
// pixels, which is why the reader divides by the ratio to get back to the CSS
// pixels a press arrives in.
async function openTagged(page) {
  await h.suppressEntryCoach(page);
  await page.goto('/MODEL.html');
  await page.waitForFunction(() => !!window.SharedFileStore, null, { timeout: 15000 });
  await page.evaluate(async ({ bucket, saved }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(saved)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: h.STORAGE_BUCKET, saved: REPRO });
  await page.goto('/MODEL.html');
  await page.evaluate(() => {
    window.__tags = [];
    const orig = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function (text, x, y) {
      const at = this.getTransform();
      window.__tags.push({ text: String(text), e: at.e, f: at.f,
        cv: (this.canvas && this.canvas.id) || '' });
      return orig.call(this, text, x, y);
    };
  });
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 15000 });
  // A REPAINT OF THE SHEET ITSELF, forced, because the first one can be over
  // before the hook is installed -- and what keeps painting afterwards is the
  // RAIL THUMBNAILS, which run the same painter into little canvases of their
  // own. Sampled without this, every tag on the tape came from a thumbnail,
  // and a press at a thumbnail's coordinates lands on empty sheet.
  await page.setViewportSize({ width: 1360, height: 764 });
  await page.waitForFunction(
    () => (window.__tags || []).some(t => t.cv === 'plan' && /^W \d+ X \d+$/.test(t.text)),
    null, { timeout: 15000 });
}

// ON THE SHEET, NOT ON A THUMBNAIL. The id is checked rather than assumed:
// this page paints the same plan into the rail's little canvases too, and
// those tags are real ink at coordinates no press will ever arrive at.
const tagsNow = page => page.evaluate(() => {
  const dpr = window.devicePixelRatio || 1;
  return (window.__tags || [])
    .filter(t => t.cv === 'plan' && /^W \d+ X \d+$/.test(t.text))
    .map(t => ({ text: t.text, x: t.e / dpr, y: t.f / dpr }));
});

// THE LABEL ON THE WINDOW AT THIS POINT, not "is this label anywhere on the
// sheet". The fixture carries several windows of the SAME size, so a check
// that searched the whole sheet could be satisfied by a neighbour's tag while
// the window under test read something else entirely -- which is exactly what
// let a half-finished undo through once. The centre is the anchor because the
// centre is the one thing a resize is required not to move.
async function labelNear(page, pt) {
  const tags = await tagsNow(page);
  let best = null, bestD = Infinity;
  tags.forEach(t => {
    const d = Math.hypot(t.x - pt.x, t.y - pt.y);
    if (d < bestD) { bestD = d; best = t; }
  });
  return best && bestD < 6 ? best.text : null;
}

// Presses the LAST tag painted, which is the one on top where two overlap --
// the same end of the list the page's own pick runs from.
async function clickLastTag(page) {
  const tags = await tagsNow(page);
  expect(tags.length, 'a window tag was painted ON THE SHEET to press on')
    .toBeGreaterThan(0);
  const tag = tags[tags.length - 1];
  const box = await page.locator('#plan').boundingBox();
  await page.evaluate(() => { window.__tags = []; });
  await page.mouse.click(box.x + tag.x, box.y + tag.y);
  return tag;
}

test('a press on the tag opens a box holding that window\'s size', async ({ page }) => {
  await openTagged(page);
  const tag = await clickLastTag(page);
  const entry = page.locator('[data-window-size-entry]');
  await expect(entry).toBeVisible();
  // THE SIZE IT ALREADY IS, not an empty box: the drafter is restating a
  // dimension, and a blank would make him read the drawing to refill it.
  await expect(entry).toHaveValue(tag.text);
});

test('the size typed there resizes the window: centred on width, down from the head',
  async ({ page }) => {
    await openTagged(page);
    const before = await clickLastTag(page);
    const entry = page.locator('[data-window-size-entry]');
    await expect(entry).toBeVisible();
    const id = await entry.getAttribute('data-window-size-entry');

    // THE FIXTURE'S OWN REACH, asked before anything is read off it: the
    // window must not already be this size, or "it changed" is the state it
    // started in.
    expect(before.text, 'the window starts at some other size').not.toBe('W 24 X 36');

    await entry.fill('W 24 X 36');
    await entry.press('Enter');
    await page.waitForFunction(() => (window.__tags || []).some(t => t.text === 'W 24 X 36'),
      null, { timeout: 10000 });

    // THE CENTRE LINE DID NOT MOVE -- Movie's own rule. `offset` is the
    // centre, so a width change that leaves it alone is already centred; this
    // is what catches a future "helpful" nudge that re-seats the opening.
    const after = (await tagsNow(page)).filter(t => t.text === 'W 24 X 36').pop();
    expect(after, 'the retagged window is on the sheet').toBeTruthy();
    expect(Math.hypot(after.x - before.x, after.y - before.y),
      'the window grew about its centre, it did not slide').toBeLessThan(2);

    // AND THE RECORD SAYS SO, through a save -- a resize that lives only in
    // the paint is a drawing that loses it on the next open.
    await page.locator('#save').click();
    await h.waitForSaved(page);
    const saved = await h.savedDrawing(page);
    const win = (saved.fenestrations || []).find(f => String(f.id) === String(id));
    expect(win, 'the window that was retyped is in the saved file').toBeTruthy();
    expect(win.width, '24 inches wide').toBeCloseTo(2, 5);
    // THE HEAD IS THE DATUM. This is the assertion that separates the rule
    // asked for from its mirror image: a build that kept the SILL and raised
    // the head would draw a 36" window too, and only this line would notice.
    const original = (REPRO.fenestrations || []).find(f => String(f.id) === String(id));
    expect(win.headHeight, 'the head stayed where it was').toBeCloseTo(original.headHeight, 5);
    expect(win.headHeight - win.sillHeight, '36 inches tall').toBeCloseTo(3, 5);
  });

test('a mistyped size can be taken back with one Ctrl+Z', async ({ page }) => {
  // A RESIZE IS A GESTURE, so it owes the drafter an undo like every other
  // gesture on this sheet -- and a size is the easiest thing here to get
  // wrong, because it is typed rather than drawn.
  await openTagged(page);
  const before = await clickLastTag(page);
  const entry = page.locator('[data-window-size-entry]');
  await expect(entry).toBeVisible();
  await entry.fill('W 24 X 36');
  await entry.press('Enter');
  await page.waitForFunction(() => (window.__tags || []).some(t => t.text === 'W 24 X 36'),
    null, { timeout: 10000 });

  await page.evaluate(() => { window.__tags = []; });
  await page.keyboard.press('Control+z');
  await page.waitForFunction(t => (window.__tags || []).some(x => x.text === t),
    before.text, { timeout: 10000 });

  // BOTH NUMBERS CAME BACK. The label carries width AND height, so a step
  // that restored only the width would leave the tag reading a size that was
  // never on this window -- which is why the whole label is compared rather
  // than a number out of it.
  expect(await labelNear(page, before),
    'THIS window is the size it was before the typing').toBe(before.text);
});

test('zooming closes the box rather than leaving it over another window',
  async ({ page }) => {
    // THE BOX IS PLACED ONCE, in page coordinates, and a zoom moves every tag
    // under it. Left open it would sit over a DIFFERENT window while still
    // writing to the one it was opened on -- the drafter aims at one window
    // and resizes another, which no message afterwards could explain.
    await openTagged(page);
    const tag = await clickLastTag(page);
    const entry = page.locator('[data-window-size-entry]');
    await expect(entry).toBeVisible();
    const sheet = await page.locator('#plan').boundingBox();
    await page.mouse.move(sheet.x + tag.x, sheet.y + tag.y);
    await page.mouse.wheel(0, -240);
    await expect(entry).toHaveCount(0);
  });

test('a size that cannot be read is refused, and nothing moves', async ({ page }) => {
  await openTagged(page);
  const before = await clickLastTag(page);
  const entry = page.locator('[data-window-size-entry]');
  await expect(entry).toBeVisible();
  // The sheet's own box, kept so the tag can be pressed a second time: a
  // refusal does not repaint -- rightly, there is nothing new to draw -- so
  // re-reading the tape to find the tag again would find an empty tape.
  const sheet = await page.locator('#plan').boundingBox();
  const pressTagAgain = async () => {
    await page.mouse.click(sheet.x + before.x, sheet.y + before.y);
    await expect(entry).toBeVisible();
  };

  // A LONE NUMBER FIRST, because it is the one a drafter actually types: he
  // means the WIDTH and stops. Read generously that becomes a 36 x 36 window
  // -- a square hole nobody asked for, in a drawing somebody builds from --
  // and it is the reading no message would ever explain. `biggish` below is
  // the easy half; this is the half that had to be refused on purpose.
  await entry.fill('36');
  await entry.press('Enter');
  await expect(page.locator('[data-strip-message]'))
    .toContainText('not a size', { timeout: 5000 });

  await pressTagAgain();
  await entry.fill('biggish');
  await entry.press('Enter');
  await expect(entry).toHaveCount(0);

  // AND THE DRAFTER IS TOLD. A refusal nobody can see is a click that did
  // nothing, which is the reading this whole feature has to avoid.
  await expect(page.locator('[data-strip-message]'))
    .toContainText('not a size', { timeout: 5000 });

  // THE OLD SIZE IS STILL WHAT IS PAINTED. A refusal that quietly wrote a
  // zero, or a NaN, would also close the box -- so the test is what the
  // drawing says afterwards, not that the box went away.
  //
  // REPAINTED ON PURPOSE, for the reason given above -- and by ONE PIXEL,
  // which matters. A bigger resize repaints just as well but re-centres the
  // sheet, moving every tag; the check below looks for this window at the
  // point it was already at, and would then find nothing there and call a
  // working refusal a failure. One pixel shifts a tag by half of one.
  await page.evaluate(() => { window.__tags = []; });
  await page.setViewportSize({ width: 1361, height: 764 });
  await page.waitForFunction(() => (window.__tags || []).some(t => t.cv === 'plan'),
    null, { timeout: 10000 });
  expect(await labelNear(page, before),
    'THIS window still reads the size it was').toBe(before.text);
  expect((await tagsNow(page)).map(t => t.text).join(' '),
    'nothing on the sheet became a nonsense size')
    .not.toMatch(/NaN|undefined|\b0 X|X 0\b/);
});
