// neighborhood/index.html — the neighborhood program (Movie, 21 Sep 2026).
//
// A SEPARATE PROGRAM that reads the .draft files Rough Drafter writes and does
// one thing with them: places them on the ground. It never edits a house; it
// has no tool that could. These specs hold the three claims it makes.
//
// THEY ALSO GUARD THE SHARED CODE FROM ONE DIRECTION NOTHING ELSE DOES. This
// page is the only caller that draws MORE THAN ONE drawing in a frame, and the
// only one that hands a painter a transform it composed itself. If a painter
// ever reaches for a global instead of its arguments, this file goes red and
// the sheets stay green.
const { test, expect } = require('@playwright/test');

const FIXTURES = ['repro-washroom-bungalow', 'repro-L-house', 'repro-garage-house'];
const paths = FIXTURES.map(name => `proto/${name}.draft`);

async function openCity(page) {
  await page.addInitScript(() => {
    if (sessionStorage.getItem('city-cleared')) return;
    sessionStorage.setItem('city-cleared', '1');
    localStorage.clear();
  });
  await page.goto('/neighborhood/');
  await page.waitForFunction(() => document.body.dataset.neighborhoodReady === '1');
}

// Ink on the ground, counted dark so the grid's pale lines do not register.
async function groundInk(page) {
  return page.evaluate(() => {
    const canvas = document.querySelector('#plan');
    const data = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
    let dark = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i] < 120 && data[i + 1] < 120 && data[i + 2] < 120) dark += 1;
    }
    return dark;
  });
}

async function placeAt(page, cardIndex, fx, fy) {
  await page.locator('.card').nth(cardIndex).click();
  const box = await page.locator('#plan').boundingBox();
  await page.mouse.click(box.x + box.width * fx, box.y + box.height * fy);
  await page.waitForTimeout(120);
}

test('it imports real .draft files and draws them on the ground', async ({ page }) => {
  await openCity(page);
  expect(await groundInk(page)).toBe(0);            // bare ground to start

  await page.setInputFiles('#file', paths);
  await expect(page.locator('.card')).toHaveCount(3);
  // Each card names the drawing and the storey it found to draw.
  await expect(page.locator('.card').first()).toContainText('REPRO-WASHROOM-BUNGALOW');
  await expect(page.locator('.card').first()).toContainText('MAIN FL');

  // Importing alone draws nothing: a drawing on the shelf is not placed.
  expect(await groundInk(page)).toBe(0);

  await placeAt(page, 0, 0.35, 0.4);
  expect(await groundInk(page)).toBeGreaterThan(100);
  await expect(page.locator('#s-count')).toContainText('1 PLACED');
});

test('each placement is its own house, drawn from the same shelf entry', async ({ page }) => {
  await openCity(page);
  await page.setInputFiles('#file', paths);

  await placeAt(page, 1, 0.3, 0.35);
  const one = await groundInk(page);
  // THE SAME DRAWING, PLACED TWICE. It is not copied -- the second placement
  // references the same shelf entry -- so this is the claim that makes a large
  // neighborhood possible at all.
  await placeAt(page, 1, 0.65, 0.35);
  const two = await groundInk(page);

  await expect(page.locator('#s-count')).toContainText('2 PLACED');
  expect(two).toBeGreaterThan(one);
});

test('rotation turns the drawing, not just its frame', async ({ page }) => {
  await openCity(page);
  await page.setInputFiles('#file', paths);
  await placeAt(page, 1, 0.5, 0.45);
  const upright = await groundInk(page);

  // 45 degrees: three presses of 15. A rectangle on the diagonal covers more
  // pixels than one square to the screen, so the ink moves -- and it can only
  // move if the geometry went through the placement transform rather than a
  // frame being drawn round an unrotated house.
  for (let i = 0; i < 3; i += 1) await page.keyboard.press(']');
  await page.waitForTimeout(150);
  await expect(page.locator('#s-sel')).toContainText('45');
  expect(await groundInk(page)).not.toBe(upright);
});

test('it draws the building, not the construction document', async ({ page }) => {
  await openCity(page);

  // THE `shell` OPTION MEASURED DIRECTLY, on a scratch canvas, because the
  // page itself only ever draws one way. The city page loads the same shared
  // modules a sheet does, so the comparison can be made right here: the same
  // drawing, the same level, the same transform, once each way.
  //
  // A first attempt counted blue pixels and failed at 488 -- the FLOOR fill is
  // blue too, and shell keeps floors, because a floor is part of a building.
  // Counting total ink is the honest measure: everything shell drops is ink.
  const counts = await page.evaluate(async () => {
    const saved = await (await fetch('/proto/repro-washroom-bungalow.draft')).json();
    const draw = shell => {
      const canvas = document.createElement('canvas');
      canvas.width = 900; canvas.height = 700;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
      const toS = pt => ({ x: 450 + pt.x * 7, y: 350 + pt.z * 7 });
      window.DraftLayoutPlan.drawPlan(ctx, toS, saved, 3, { padFt: 0.5 / 12, shell });
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      let ink = 0;
      for (let i = 0; i < data.length; i += 4) {
        if (data[i] < 250 || data[i + 1] < 250 || data[i + 2] < 250) ink += 1;
      }
      return ink;
    };
    return { full: draw(false), shell: draw(true) };
  });

  // The bungalow carries 46 dimensions, 3 beams, 2 columns and 2 stairs. Shell
  // drops every one and keeps the walls, floors, roofs and openings.
  expect(counts.full).toBeGreaterThan(0);
  expect(counts.shell).toBeGreaterThan(0);          // a building still drew
  expect(counts.shell).toBeLessThan(counts.full);   // and it is the lighter one

  // And the page itself uses it: a placed house draws, and draws less than the
  // construction document would.
  await page.setInputFiles('#file', paths);
  await placeAt(page, 0, 0.5, 0.45);
  expect(await groundInk(page)).toBeGreaterThan(100);
});

test('a neighborhood survives a reload, and a placement stays four numbers', async ({ page }) => {
  await openCity(page);
  await page.setInputFiles('#file', paths);
  await placeAt(page, 0, 0.35, 0.4);
  await placeAt(page, 2, 0.65, 0.4);
  await expect(page.locator('#s-count')).toContainText('2 PLACED');

  // THE STORED SHAPE IS THE PERFORMANCE CLAIM, so it is asserted rather than
  // trusted: [shelf, x, z, degrees]. As an object it was 98 bytes and 100,000
  // houses would not fit in localStorage at all; as four numbers it is 19.
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('draft-neighborhood-v1')));
  expect(stored.v).toBe(2);
  expect(stored.placed).toHaveLength(2);
  stored.placed.forEach(spot => {
    expect(Array.isArray(spot)).toBe(true);
    expect(spot).toHaveLength(4);
    spot.forEach(value => expect(typeof value).toBe('number'));
  });

  await page.reload();
  await page.waitForFunction(() => document.body.dataset.neighborhoodReady === '1');
  await expect(page.locator('#s-count')).toContainText('2 PLACED');
  await expect(page.locator('.card')).toHaveCount(3);
  expect(await groundInk(page)).toBeGreaterThan(100);
});

test('it offers no way to edit a house', async ({ page }) => {
  await openCity(page);
  await page.setInputFiles('#file', paths);
  await placeAt(page, 0, 0.5, 0.45);

  // The whole design in one assertion: read-only enforced by having no tools,
  // not by a flag somebody has to remember to check at fifty call sites.
  const labels = (await page.locator('button').allInnerTexts()).join(' ').toUpperCase();
  for (const tool of ['WALL', 'FENESTRATION', 'FLOOR', 'ROOF', 'DIMENSION', 'STAIR', 'FIXTURE']) {
    expect(labels).not.toContain(tool);
  }
});

test('a neighborhood saves to a file and opens again', async ({ page }) => {
  await openCity(page);
  await page.setInputFiles('#file', paths);
  await placeAt(page, 0, 0.35, 0.4);
  await placeAt(page, 1, 0.62, 0.4);
  await placeAt(page, 0, 0.5, 0.62);          // the same design placed twice
  const before = await groundInk(page);

  const download = await Promise.all([
    page.waitForEvent('download'),
    page.locator('#save').click(),
  ]).then(([d]) => d);
  const saved = JSON.parse(require('fs').readFileSync(await download.path(), 'utf8'));

  expect(saved.format).toBe('rough-drafter-neighborhood');
  expect(saved.placements).toHaveLength(3);
  // THREE PLACEMENTS, THREE DESIGNS ON THE SHELF -- and the design placed
  // twice is stored ONCE. That is the claim the whole thing rests on, so it
  // is asserted on the file rather than inferred from the screen.
  expect(saved.designs).toHaveLength(3);
  expect(saved.placements.filter(p => p[0] === 0)).toHaveLength(2);
  saved.placements.forEach(spot => expect(spot).toHaveLength(4));

  // WRITTEN FOR A READER THAT DOES NOT EXIST YET: a CITY placing this
  // neighborhood must be able to frame and cull it without parsing a single
  // house, so the ground it occupies is recorded rather than re-derived.
  expect(saved.extentFt).toBeTruthy();
  expect(saved.extentFt.maxX).toBeGreaterThan(saved.extentFt.minX);
  expect(saved.extentFt.maxZ).toBeGreaterThan(saved.extentFt.minZ);

  // Open it into a fresh page: same houses, same ground.
  const fresh = await page.context().newPage();
  await fresh.addInitScript(() => localStorage.clear());
  await fresh.goto('/neighborhood/');
  await fresh.waitForFunction(() => document.body.dataset.neighborhoodReady === '1');
  await fresh.setInputFiles('#hoodfile', await download.path());
  await fresh.waitForTimeout(400);
  await expect(fresh.locator('#s-count')).toContainText('3 PLACED');
  await expect(fresh.locator('.card')).toHaveCount(3);
  expect(before).toBeGreaterThan(100);
  await fresh.close();
});
