// THE ORDERED GARAGE BUILDS ITSELF (Movie, 15 Sep): "now i need the garage
// to be AUTOBUILT ... it should make a rectangle outline of that size and
// then build it with the project data".
//
// This is the first listener the order seam has ever had. Until now a
// press recorded a type and a size and drew nothing, so every check here
// is about the step between the order and the drawing: the loop, the four
// walls off it, where it stands, and what one Ctrl+Z takes back.
//
// READ OFF THE SAVED FILE, not off the page's variables. MODEL.html
// exposes no state object, and the file is the stronger witness anyway:
// geometry that is only in memory is geometry the drafter loses.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const REPRO = JSON.parse(fs.readFileSync(
  path.join(__dirname, '..', 'proto', 'repro-garage-house.draft'), 'utf8'));

async function openPage(page) {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, saved }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(saved)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, saved: REPRO });
  await page.goto('/MODEL.html?mode=night');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
}

const orderGarage = async (page, sizeId) => {
  await h.openDriveThru(page);
  await page.locator('#dt-tiles [data-build-family="detachedGarage"]').click();
  await page.locator('#dt-tiles [data-build-entry="detached-thickened"]').click();
  await page.locator(`#size-stock [data-build-size="${sizeId}"]`).click();
  await page.locator('#dt-bone').click();
};

const box = points => ({
  w: Math.max(...points.map(p => p.x)) - Math.min(...points.map(p => p.x)),
  d: Math.max(...points.map(p => p.z)) - Math.min(...points.map(p => p.z)),
  minX: Math.min(...points.map(p => p.x)),
});

// SAVED AND READ BACK. This page writes on the SAVE press rather than
// behind the drafter, so the file is only current once it is asked for --
// and the sign is shut first, because a board still up is over the button.
const fileNow = async page => {
  if (await page.locator('#drivethru').getAttribute('data-shut') === null) {
    await page.keyboard.press('Escape');
  }
  await page.locator('[data-model-save]').click();
  await expect(page.locator('[data-model-save]')).toHaveText(/saved/i, { timeout: 6000 });
  return h.savedDrawing(page);
};

const state = async page => {
  const file = await fileNow(page);
  const garages = (file.outlines || []).filter(o => o.garage);
  return {
    walls: (file.walls || []).length,
    outlines: (file.outlines || []).length,
    garages: garages.map(o => ({
      detached: o.detached === true,
      foundation: o.foundation,
      corners: o.points.length,
      ...box(o.points),
    })),
    // How far east anything on the sheet reaches, which is what the
    // garage has to clear.
    east: Math.max(
      ...(file.outlines || []).flatMap(o => o.points.map(p => p.x)),
      ...(file.walls || []).flatMap(w => [w.start.x, w.end.x]),
    ),
  };
};

test('an ordered garage arrives as a loop of the size that was ordered',
  async ({ page }) => {
    await openPage(page);
    const before = await state(page);
    await orderGarage(page, '24x26');
    const after = await state(page);

    expect(after.garages.length - before.garages.length,
      'the order drew no garage').toBe(1);
    const built = after.garages[after.garages.length - 1];
    // WIDTH ACROSS THE DOOR WALL, depth back from it -- a 24x26 laid out
    // as a 26x24 is a different building.
    expect({ w: built.w, d: built.d }).toEqual({ w: 24, d: 26 });
    expect(built.corners, 'a rectangle is four corners').toBe(4);
    // THE FOUR WALLS COME WITH IT. An outline on its own is a footprint
    // nobody can build off.
    expect(after.walls - before.walls,
      'the loop was laid and nothing was built on it').toBe(4);
    // AND IT SAYS WHAT IT IS, on the record: building-bodies.js counts the
    // flag, not the tile that was pressed.
    expect({ detached: built.detached, foundation: built.foundation })
      .toEqual({ detached: true, foundation: 'thickened' });
  });

test('the walls are the project\'s walls, not defaults invented at the order',
  async ({ page }) => {
    // SETTINGS THE ORDER CANNOT GUESS, in the file before the press: a
    // garage built to hard-coded 0/8 stud_2x6 would pass a check written
    // against the fallbacks and fail this one.
    await h.openModel(page, { webgl: false });
    await page.evaluate(async ({ bucket, saved }) => {
      await window.SharedFileStore.saveSharedFile(
        new File([JSON.stringify(saved)], 'drawing.json', { type: 'application/json' }), bucket);
    }, {
      bucket: BUCKET,
      saved: {
        ...REPRO,
        wallBaseHeight: 1, wallTopHeight: 11, wallRefLine: 'centre',
      },
    });
    await page.goto('/MODEL.html?mode=night');
    await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
    const before = await state(page);
    await orderGarage(page, '16x24');
    const after = await fileNow(page);
    const fresh = (after.walls || []).slice(before.walls);

    expect(fresh.length).toBe(4);
    // THE PROJECT'S FIGURES, on all four -- and 'centre' folded to
    // 'center' on the way out, the same repair the traced wall gets.
    fresh.forEach(wall => expect({
      base: wall.baseHeight, top: wall.topHeight, ref: wall.refLine,
    }).toEqual({ base: 1, top: 11, ref: 'center' }));
    expect(new Set(fresh.map(w => w.wallType)).size,
      'the four walls of one garage are not one assembly').toBe(1);
  });

test('it stands beside what is already built, not through it', async ({ page }) => {
  await openPage(page);
  const before = await state(page);
  await orderGarage(page, '16x24');
  const built = (await state(page)).garages.pop();

  expect(Number.isFinite(before.east),
    'the fixture was empty, so standing clear of it proves nothing')
    .toBe(true);
  expect(built.minX, 'the garage was laid over the house')
    .toBeGreaterThan(before.east);
});

test('the board gets out of the way once it has built the thing',
  async ({ page }) => {
    await openPage(page);
    await orderGarage(page, '24x26');
    await expect(page.locator('#drivethru'),
      'the sign stayed up over the garage it just built')
      .toHaveAttribute('data-shut', '');
    // AND THE CHOICE IS SPENT with the order. A tile that stays pressed
    // after its garage lands makes the next foot-bone press a re-build
    // instead of a menu -- the page's own word for it is chosen().
    expect(await page.evaluate(() => window.ModelBuild.chosen()),
      'the served order is still on the board').toBeNull();
  });

test('one press of undo takes the whole order back, and only it',
  async ({ page }) => {
    await openPage(page);
    const before = await state(page);
    // A WALL DRAWN BY HAND FIRST, and it is the whole instrument here: an
    // order that left four spent steps behind the merged one would still
    // clear the garage on the first press, and then swallow the next four
    // presses on walls that are already gone -- so this hand-drawn wall
    // would survive an undo the drafter believes he spent on it.
    const box = await page.locator('#plan').boundingBox();
    const c = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    await h.armWall(page);
    await page.mouse.click(c.x - 160, c.y - 120);
    await page.mouse.click(c.x - 160, c.y - 40);
    await page.keyboard.press('Escape');
    await h.disarmWall(page);
    const drawn = await state(page);
    expect(drawn.walls - before.walls, 'the hand-drawn wall never landed').toBe(1);

    await orderGarage(page, '24x26');
    await page.keyboard.press('Control+z');   // the garage, whole
    await page.keyboard.press('Control+z');   // and then the drawn wall
    const after = await state(page);

    // FIVE RECORDS, ONE GESTURE. Undoing wall by wall would also leave
    // three walls standing inside a garage-flagged loop -- a state no
    // other gesture on this page can produce.
    expect({ walls: after.walls, outlines: after.outlines })
      .toEqual({ walls: before.walls, outlines: before.outlines });
  });

test('a second detached garage cannot even be ordered', async ({ page }) => {
  // THE CAP IS THE DOOR, not the counter. With the house standing and one
  // detached garage built the project is full, and Movie's rule for the
  // bone is "it will do nothing once both house and garage both made" --
  // so the board never rises and there is no tile to spend twice. The
  // "YOU'VE GOT ONE ALREADY" refusal at the order stays behind this as
  // the deeper guard, for any future door that opens on a full project.
  await openPage(page);
  await orderGarage(page, '16x24');
  const afterFirst = await state(page);
  // DETACHED ones only for the precondition: the fixture's attached garage
  // rides the house outline onto every level, so `garages` starts at five.
  expect(afterFirst.garages.filter(g => g.detached).length,
    'the first garage never landed').toBe(1);

  await page.locator('#bone').click();
  await page.waitForTimeout(3000);   // past the sign's 2s rise-glow
  await expect(page.locator('#drivethru'),
    'the board rose over a full project')
    .toHaveAttribute('data-shut', '');
  const afterSecond = await state(page);
  expect(afterSecond.garages.length,
    'the cap of one detached garage was spent twice')
    .toBe(afterFirst.garages.length);
});

test('the garage is in the file, not only on the screen', async ({ page }) => {
  await openPage(page);
  await orderGarage(page, '25x25');
  const built = await state(page);

  await page.reload();
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  const back = await state(page);
  // THE SAME DRAWING CAME BACK. A record the reader drops would show up
  // here as a garage that survived the save and not the load.
  expect({ walls: back.walls, garages: back.garages.length })
    .toEqual({ walls: built.walls, garages: built.garages.length });
  expect(back.garages.some(g => g.detached
    && Math.round(g.w) === 25 && Math.round(g.d) === 25),
  'the 25x25 did not come back off the file').toBe(true);
});
