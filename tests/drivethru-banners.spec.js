// THE TWO BANNERS WITH ARROWS, ON BOTH SKINS.
//
// Movie, 16 Oct: "i'd like to make the options more obvious by adding them
// once the user selects the house type, for those 2 banners and arrows (red
// and white) to pop up down below. I circled the stuff on the left - when
// they click that stuff BONE / or the BANNER on the left it will DRAW the
// AUTOHOUSE at prespecified dimensions. if they click the stuff circled in
// green (arrow or the other banner on the right) they will get to DRAW the
// HOUSE OUTLINE" ... "leave the other links up top beside the dog too".
//
// "on the ROUGH - drivethru version can you do it similar to the change on
// the Ruff version" -- drawn as [ DRAW HOUSE ] -> (house) -> [ DRAW HOUSE
// OUTLINE ] under the tiles.
//
// "add the extra HOUSE BUTTON above in the popup area with the NUMBER on it
// (and also add the number to the one in the RUFF Drive-thru version".
//
// proto/drivethru-banners-mutants.js is this spec's gate.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const empty = () => ({
  version: 1, board: 'drafting',
  levels: [{ id: 3, name: 'MAIN FL', elev: 0 }],
  activeLevelIdx: 0,
  walls: [], lines: [], floors: [], roofs: [], fenestrations: [], dimensions: [],
  outlines: [], shapes: [], surfaceOpenings: [], stairs: [], notes: [],
  roomTags: [], columns: [], beams: [], boneyardOutlines: [],
  groups: [], levelLocks: [], underlays: [],
});
async function open(page, theme = null) {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, f }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, f: empty() });
  await page.goto(theme ? `/MODEL.html?theme=${theme}` : '/MODEL.html');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  await h.openDriveThru(page);
}
// A family's card toggles its entries, so an open family is not pressed again.
const pick = async (page, family, entry) => {
  const card = page.locator(`[data-build-entry="${entry}"]`);
  if (!(await card.isVisible().catch(() => false))) {
    await page.locator(`[data-build-family="${family}"]`).click();
  }
  await card.click();
};
const box = async (page, sel) => page.locator(sel).boundingBox();
const centreY = b => b.y + b.height / 2;

// THE ROW READS LEFT TO RIGHT: banner, arrow, the press, arrow, banner -- both
// arrows pointing right (Movie: "see that right arrow should also point
// right"), meeting the press on its own line, on either skin.
async function expectRowAroundPress(page, pressSel) {
  const left = await box(page, '#dt-banner-build');
  const right = await box(page, '#dt-banner-outline');
  const press = await box(page, pressSel);
  const arrows = await page.locator('#dt-banners button.dt-arrow').all();
  const [toRight, toLeft] = await Promise.all(arrows.map(a => a.boundingBox()));
  expect(left.x + left.width, 'the left banner stops before its arrow').toBeLessThanOrEqual(toRight.x + 1);
  expect(toRight.x + toRight.width, 'the arrow reaches the press').toBeLessThanOrEqual(press.x + 2);
  expect(press.x + press.width, 'the press stands before the second arrow').toBeLessThanOrEqual(toLeft.x + 2);
  expect(toLeft.x + toLeft.width, 'which stops at the right banner').toBeLessThanOrEqual(right.x + 1);
  [left, right, toRight, toLeft].forEach(part => {
    expect(Math.abs(centreY(part) - centreY(press)), 'on the press\'s own line').toBeLessThan(press.height / 2);
  });
  // AND THE ARROWS MEET IT FROM EITHER SIDE ALIKE: the same air between the
  // first arrow's head and the press as between the press and the second's
  // tail. A row packed to one end keeps its order and loses this.
  const mid = press.x + press.width / 2;
  const before = mid - (toRight.x + toRight.width);
  const after = toLeft.x - mid;
  expect(Math.abs(before - after), 'the press stands midway between its arrows').toBeLessThan(8);
}

test('on the sign the banners rise with the order, say the short words, and the arrows meet the bone',
  async ({ page }) => {
    await open(page);
    const row = page.locator('#dt-banners');
    await expect(row, 'nothing picked, no banners').toBeHidden();
    await pick(page, 'bungalow', 'bungalow');
    await expect(row).toBeVisible();
    await expect(page.locator('#dt-banner-build')).toHaveText('DRAW HOUSE');
    await expect(page.locator('#dt-banner-outline')).toHaveText('DRAW HOUSE OUTLINE');
    // "leave the other links up top beside the dog too"
    await expect(page.locator('#dt-build-now')).toHaveText('PRESS TO DRAW HOUSE WITHOUT drawing OUTLINE');
    await expect(page.locator('#dt-outline')).toHaveText('CLICK HERE to draw house OUTLINE');
    await expectRowAroundPress(page, '#dt-bone');
    // The garage says garage.
    await pick(page, 'detachedGarage', 'detached-thickened');
    await expect(page.locator('#dt-banner-build')).toHaveText('DRAW GARAGE');
    await expect(page.locator('#dt-banner-outline')).toHaveText('DRAW GARAGE OUTLINE');
  });

test('the right arrow draws the outline', async ({ page }) => {
  await open(page);
  await pick(page, 'bungalow', 'bungalow');
  // "that arrow and the RIGHT box go to DRAW the outline": the arrow first.
  await page.locator('#dt-banners button.dt-arrow[data-drivethru-outline]').click();
  await expect(page.locator('#drivethru'), 'the sign goes down').toHaveAttribute('data-shut', '');
  await expect(page.locator('#strip-message')).toContainText('Trace your 1 STOREY');
});

test('the right banner draws the outline too', async ({ page }) => {
  await open(page);
  await pick(page, 'bungalow', 'bungalow');
  await page.locator('#dt-banner-outline').click();
  await expect(page.locator('#drivethru'), 'the sign goes down').toHaveAttribute('data-shut', '');
  await expect(page.locator('#strip-message')).toContainText('Trace your 1 STOREY');
});

test('the left banner builds the house, as the bone does', async ({ page }) => {
  await open(page);
  await pick(page, 'bungalow', 'bungalow');
  // "the BONE and the left box and arrow DRAW AUTOBUILD with the existing
  // project infor and default sizes": the banner here, the arrow on ROUGH.
  await page.locator('#dt-banner-build').click();
  await expect(page.locator('#drivethru')).toHaveAttribute('data-shut', '');
  await page.locator('#save').click();
  await h.waitForSaved(page);
  const d = await h.savedDrawing(page);
  expect(d.walls.filter(w => Number(w.levelId) === 3).length, 'the house is built').toBeGreaterThan(0);
  expect(d.boneyardOutlines, 'and nothing was traced').toEqual([]);
});

test('the sign\'s bone wears the wallet\'s number, the same one the foot shows', async ({ page }) => {
  await open(page);
  const foot = page.locator('#bone-balance');
  const sign = page.locator('#dt-bone-balance');
  await expect(foot).not.toHaveText('');
  await expect(sign).toHaveText(await foot.textContent());
  await expect(sign).toBeVisible();
});

test('on ROUGH the house press stands between the banners, under the tiles, wearing the number',
  async ({ page }) => {
    await open(page, 'rough');
    await expect(page.locator('#dt-banners')).toBeHidden();
    await pick(page, 'bungalow', 'bungalow');
    await expect(page.locator('#dt-banners')).toBeVisible();
    const press = page.locator('#dt-bone');
    await expect(press, 'the sign\'s press is the row\'s house').toBeVisible();
    await expectRowAroundPress(page, '#dt-bone');
    const tiles = await box(page, '#dt-tiles');
    const row = await box(page, '#dt-banners');
    expect(tiles.y + tiles.height, 'the row sits under the tiles').toBeLessThanOrEqual(row.y + 1);
    // The sheet's text links keep their place under the row.
    const now = await box(page, '#dt-build-now-shelf');
    expect(now.y, 'the text links are below the row').toBeGreaterThanOrEqual(row.y + row.height - 1);
    await expect(page.locator('#dt-bone-balance')).toHaveText(await page.locator('#bone-balance').textContent());
    // AND THE LEFT ARROW BUILDS, the way the press between them does.
    await page.locator('#dt-banners button.dt-arrow[data-drivethru-build-now]').click();
    await expect(page.locator('#drivethru')).toHaveAttribute('data-shut', '');
    await page.locator('#save').click();
    await h.waitForSaved(page);
    const d = await h.savedDrawing(page);
    expect(d.walls.filter(w => Number(w.levelId) === 3).length, 'the house is built').toBeGreaterThan(0);
  });
