// ONE DELETE on MODEL.html — the verb, not the button.
//
// Work order: the chrome shell, §7c. "Widen the delete verb, not
// selectedWall()" — the caution that survived the handover, because the
// narrow reader is what the corner handles and the properties slot are built
// on and widening it would move those too.
//
// THE FAULT THIS FILE EXISTS FOR is a page with TWO deletes: a button that
// took a wall and a key that took something else. That is how a drafter comes
// to believe a line cannot be deleted at all — the button vanished, so they
// never pressed the key. So every check below drives BOTH and asserts they
// did the same thing.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const V = (x, z) => ({ x, y: 0, z });
const WALL = 10;

const FIXTURE = {
  version: 1,
  levels: [{ id: 3, name: 'MAIN FL', elev: 0 }],
  activeLevelIdx: 0,
  walls: [
    ['w-n', V(-WALL, -WALL), V(WALL, -WALL)],
    ['w-e', V(WALL, -WALL), V(WALL, WALL)],
    ['w-s', V(WALL, WALL), V(-WALL, WALL)],
    ['w-w', V(-WALL, WALL), V(-WALL, -WALL)],
  ].map(([id, start, end]) => ({
    id, start, end, levelId: 3, view: 'plan',
    wallType: 'stud_2x6', baseHeight: 0, topHeight: 8, refLine: 'left',
  })),
  lines: [
    { id: 'l-a', start: V(-4, 0), end: V(4, 0), levelId: 3, view: 'plan', layer: 'draft', bulge: 0 },
    { id: 'l-b', start: V(-4, 3), end: V(4, 3), levelId: 3, view: 'plan', layer: 'draft', bulge: 0 },
  ],
  floors: [{
    id: 'f-a', levelId: 3, view: 'floor',
    points: [V(-5, -5), V(5, -5), V(5, 5), V(-5, 5)],
  }],
  roofs: [], fenestrations: [], dimensions: [], outlines: [],
  shapes: [], surfaceOpenings: [], stairs: [], notes: [], roomTags: [],
  columns: [], beams: [], boneyardOutlines: [], boneyardShelves: [],
  groups: [], levelLocks: [], underlays: [],
  // §6 puts every tool but WALL away on a TOY board, and the subject here is
  // the verb rather than which board offers a selection.
  board: 'drafting',
};

async function open(page) {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, file }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(file)], 'drawing.json',
        { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, file: FIXTURE });
  await page.goto('/MODEL.html?left=1');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
}

const at = async (page, x, z) => {
  const box = await page.locator('#plan').boundingBox();
  const scale = await page.evaluate(() => Number(
    /scale ([\d.]+) px\/ft/.exec(document.getElementById('readout').textContent)[1]));
  return [box.x + box.width / 2 + x * scale, box.y + box.height / 2 + z * scale];
};

// The readout is the page's own count, in the drafter's own words.
const tally = page => page.evaluate(() => {
  const text = document.getElementById('readout').textContent;
  const of = word => {
    const m = new RegExp(`${word}\\s+\\d+\\/(\\d+)`).exec(text);
    return m ? Number(m[1]) : null;
  };
  return { walls: of('walls'), lines: of('lines'), floors: of('floors') };
});

const click = async (page, x, z) => {
  await page.mouse.click(...await at(page, x, z));
  await page.waitForTimeout(100);
};

test('the button takes a LINE, which the wall-only one never could',
  async ({ page }) => {
    await open(page);
    await click(page, 0, 0);
    await expect(page.locator('[data-delete]')).toBeVisible();
    await page.locator('[data-delete]').click();
    await page.waitForTimeout(120);

    expect(await tally(page)).toMatchObject({ lines: 1, walls: 4, floors: 1 });
    // AND THE BUTTON GOES WITH THE SELECTION. A DELETE left on screen over
    // nothing is a press that does nothing, which reads as a broken page.
    await expect(page.locator('[data-delete]')).toBeHidden();
  });

test('the key and the button are ONE verb, not two that agree today',
  async ({ page }) => {
    await open(page);
    await click(page, 0, 0);
    await page.keyboard.press('Delete');
    await page.waitForTimeout(120);
    const afterKey = await tally(page);

    await click(page, 0, 3);
    await page.locator('[data-delete]').click();
    await page.waitForTimeout(120);
    const afterButton = await tally(page);

    expect(afterKey.lines, 'the key took one line').toBe(1);
    expect(afterButton.lines, 'the button took the other').toBe(0);
    // Backspace is the same press on a keyboard that has no Delete.
    await click(page, 0, -WALL);
    await page.keyboard.press('Backspace');
    await page.waitForTimeout(120);
    expect((await tally(page)).walls, 'Backspace is the same verb').toBe(3);
  });

test('a MIXED selection goes in one press, walls and a line together',
  async ({ page }) => {
    await open(page);
    // TWO WALLS AND A LINE, gathered by hand rather than by a window: the
    // mixture is the subject, and shift-clicking says exactly which kinds are
    // in it. Both halves of the verb are exercised -- a wall goes through
    // deleteWall and its dependency cleanup, a line through the list.
    await click(page, 0, -WALL);
    await page.keyboard.down('Shift');
    await click(page, 0, 0);
    await click(page, 0, WALL);
    await page.keyboard.up('Shift');
    const picked = await page.evaluate(() => {
      const m = /(\d+) selected/.exec(document.getElementById('readout').textContent);
      return m ? Number(m[1]) : 0;
    });
    expect(picked, 'the press must be made over a mixture')
      .toBeGreaterThanOrEqual(3);

    await page.locator('[data-delete]').click();
    await page.waitForTimeout(200);
    const left = await tally(page);
    expect(left.walls, 'both walls went').toBe(2);
    expect(left.lines, 'and the line with them, in the same press').toBe(1);
    await expect(page.locator('[data-delete]')).toBeHidden();
  });

test('undo puts back what one press took', async ({ page }) => {
  await open(page);
  await click(page, 0, 0);
  await page.keyboard.press('Delete');
  await page.waitForTimeout(120);
  expect((await tally(page)).lines).toBe(1);

  await page.keyboard.press('Control+z');
  await page.waitForTimeout(150);
  expect((await tally(page)).lines, 'the line comes back').toBe(2);
});

test('a modal swallows the key — the drawing behind it is not editable',
  async ({ page }) => {
    await open(page);
    await click(page, 0, 0);
    const before = await tally(page);

    // SAVE AS is a modal over the sheet. A Delete that reached through it
    // would delete something the drafter cannot see they have selected.
    await page.locator('#file-save-as').click();
    await expect(page.locator('#save-as')).toBeVisible();
    await page.keyboard.press('Delete');
    await page.waitForTimeout(150);
    await page.locator('[data-save-as-cancel]').click();

    expect(await tally(page), 'nothing goes while a modal is up').toEqual(before);
  });

test('a section view has no DELETE, because there is nothing there to take',
  async ({ page }) => {
    await open(page);
    await click(page, 0, 0);
    await expect(page.locator('[data-delete]')).toBeVisible();

    await page.goto('/MODEL.html?left=1&view=cut:E1');
    await expect(page.locator('#readout')).toContainText('elevation E1');
    await expect(page.locator('[data-delete]')).toBeHidden();
  });
