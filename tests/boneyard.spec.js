// THE BONEYARD / WIREFRAME PAGE, PR 1: the bones in 3D, and the tab.
//
// Movie, 1 Oct: a 3D wireframe of "only the exterior-wall outline of each
// level ... house and garage both", "FOUNDATION purple, MAIN FLOOR red, 2ND FL
// green, ROOF orange", isometric, turned in 15-degree steps; "tap a loop and
// the 2D window switches to that level". 2 Oct: "only 1 loops per floor and
// one for the roof which will be at highest floor ceiling (none for ceiling)".
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const empty = () => ({
  version: 1, planTurn: 0,
  levels: [{ id: 8, name: 'SITE', elev: 0 }, { id: 7, name: 'ROOF', elev: 0 },
    { id: 5, name: '2ND FL', elev: 9 }, { id: 3, name: 'MAIN FL', elev: 0 },
    { id: 1, name: 'FOUNDATION', elev: -8 }],
  activeLevelIdx: 3,
  walls: [], lines: [], floors: [], roofs: [], fenestrations: [], dimensions: [],
  outlines: [], shapes: [], surfaceOpenings: [], stairs: [], notes: [],
  roomTags: [], columns: [], beams: [], boneyardOutlines: [],
  groups: [], levelLocks: [], underlays: [],
});

async function seed(page, drawing) {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, f }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, f: drawing });
}

// A 2 STOREY + GARAGE off the drive-thru, saved, then the boneyard opened on it.
async function boneyardOfTwoStorey(page) {
  await seed(page, empty());
  await page.goto('/MODEL.html');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  await h.openDriveThru(page);
  await page.locator('#dt-tiles [data-build-family="bungalow"]').click();
  await page.locator('#dt-tiles [data-build-entry="twoStorey-garage"]').click();
  await page.locator('#dt-bone').click();
  await page.waitForTimeout(500);
  await page.keyboard.press('Escape');
  await page.locator('#save').click();
  await h.waitForSaved(page);
  await page.goto('/BONEYARD.html');
  await expect(page.locator('body')).toHaveAttribute('data-boneyard-ready', '1', { timeout: 10000 });
}

const bones = async page => JSON.parse(await page.locator('#bones3d').getAttribute('data-bones'));

test('one loop per floor, the foundation under them and the roof at the top ceiling',
  async ({ page }) => {
    await boneyardOfTwoStorey(page);
    const b = await bones(page);
    expect(b.map(l => l.name), 'bottom to top').toEqual(['FOUNDATION', 'MAIN FL', '2ND FL', 'ROOF']);
    expect(b.map(l => l.color), 'purple, red, green, orange')
      .toEqual(['#9b6bd6', '#e0453a', '#3fae5a', '#ff8c1a']);
    const [fdn, main, second, roof] = b;
    expect(fdn.elev, 'the foundation loop sits at the bottom of the foundation wall').toBeLessThan(-7);
    expect(main.elev).toBeLessThan(second.elev);
    expect(roof.elev - second.elev, 'the roof at the 2ND FL ceiling, a wall height above its floor')
      .toBeGreaterThan(7);
    expect(main.loops, 'MAIN FL carries the house and the garage').toBe(2);
    expect(fdn.loops, 'the foundation carries the house only').toBe(1);
    expect(roof.loops, 'and so does the roof').toBe(1);
  });

test('it turns in 15-degree steps, and a full turn is where it started', async ({ page }) => {
  await boneyardOfTwoStorey(page);
  const start = await bones(page);
  await expect(page.locator('#bones3d')).toHaveAttribute('data-angle', '45');
  await page.locator('#turn-right').click();
  await expect(page.locator('#bones3d')).toHaveAttribute('data-angle', '60');
  expect((await bones(page))[1].at, 'the picture moved').not.toEqual(start[1].at);
  await page.locator('#turn-left').click();
  await page.locator('#turn-left').click();
  await expect(page.locator('#bones3d')).toHaveAttribute('data-angle', '30');
  for (let i = 0; i < 24; i += 1) await page.locator('#turn-right').click();
  await expect(page.locator('#bones3d')).toHaveAttribute('data-angle', '30');
});

test('a tap on a loop shows that level flat on the right', async ({ page }) => {
  await boneyardOfTwoStorey(page);
  await expect(page.locator('#bones2d')).toHaveAttribute('data-level', 'MAIN FL');
  const roof = (await bones(page)).find(l => l.name === 'ROOF');
  const box = await page.locator('#bones3d').boundingBox();
  await page.mouse.click(box.x + roof.at[0], box.y + roof.at[1]);
  await expect(page.locator('#bones2d'), 'the roof loop was tapped').toHaveAttribute('data-level', 'ROOF');
  await page.locator('[data-bone-level="2ND FL"]').click();
  await expect(page.locator('#bones2d')).toHaveAttribute('data-level', '2ND FL');
  await expect(page.locator('#level-title')).toHaveText('2ND FL');
});

test('an empty boneyard says so', async ({ page }) => {
  await seed(page, empty());
  await page.goto('/BONEYARD.html');
  await expect(page.locator('body')).toHaveAttribute('data-boneyard-ready', '1', { timeout: 10000 });
  await expect(page.locator('#status')).toContainText('Nothing in the boneyard yet');
  expect(await bones(page)).toEqual([]);
});

test('the tab sits between MODEL and EXT. FINISH, named for the skin', async ({ page }) => {
  await seed(page, empty());
  await page.goto('/MODEL.html');
  const row = page.locator('#page-row [data-page]');
  await expect(row).toHaveCount(4);
  expect(await row.evaluateAll(els => els.map(e => e.dataset.page)))
    .toEqual(['project', 'model', 'boneyard', 'ext-finish']);
  await expect(page.locator('[data-page="boneyard"]')).toHaveText('BONEYARD', { useInnerText: true });
  await page.goto('/MODEL.html?theme=rough');
  await expect(page.locator('[data-page="boneyard"]')).toHaveText('WIREFRAME', { useInnerText: true });
  await page.locator('[data-page="boneyard"]').click();
  await expect(page).toHaveURL(/BONEYARD\.html/);
});
