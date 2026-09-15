// THE FOOT LIGHT — foot-rounding as a DRAFTING instrument.
//
// Work order: FOOT-LIGHT-WORKORDER.md, ruled by Movie 14 Sep:
//   "i think i'd like to set up the 1 foot constraint so it can be set up with
//    the DRAFTING mode too using one of the unused lights on the bottom panel"
// and, asked whether it governs drawing only or drawing and dragging:
//   "so it can be turned on and off with that light" — ONE LIGHT, BOTH.
//
// THE SWITCH IS NOT A SECOND IMPLEMENTATION. The rounding already exists in
// two places and this order adds no third: `onTheFoot` rounds a drawn run's
// LENGTH along its own direction, and toy-constraints.js exports
// `quantiseFeet` for a delta. Both are reached through a widened condition,
// never a copy.
//
// WHAT THE LIGHT IS NOT. It is not the T-SQUARE. It rounds DISTANCE and
// squares nothing, so an off-axis wall stays off-axis with the light lit —
// that is acceptance 6 and it is the one a "make DRAFTING behave like TOY"
// shortcut would fail.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const V = (x, z) => ({ x, y: 0, z });

// SYMMETRIC ABOUT THE ORIGIN so fit()'s centre is exactly (0,0) and
// `screen = centre + world * scale` holds — the same coordinate trap
// model-tool-select.spec.js documents at length. A 20ft square, and the
// drawn/dragged geometry stays well inside it.
const base = extra => ({
  version: 1,
  levels: [{ id: 3, name: 'MAIN FL', elev: 0 }],
  activeLevelIdx: 0,
  walls: [
    ['n', V(-10, -10), V(10, -10)], ['e', V(10, -10), V(10, 10)],
    ['s', V(10, 10), V(-10, 10)], ['w', V(-10, 10), V(-10, -10)],
  ].map(([id, start, end]) => ({
    id, start, end, levelId: 3, view: 'plan',
    wallType: 'stud_2x6', baseHeight: 0, topHeight: 8, refLine: 'left',
  })),
  lines: [], floors: [], roofs: [], fenestrations: [], dimensions: [],
  outlines: [], shapes: [], surfaceOpenings: [], stairs: [], notes: [],
  roomTags: [], columns: [], beams: [], boneyardOutlines: [], boneyardShelves: [],
  groups: [], levelLocks: [], underlays: [],
  nextDrawingItemId: 20,
  ...extra,
});

async function open(page, file) {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, f }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json',
        { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, f: file });
  await page.goto('/MODEL.html');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
}

const light = page => page.locator('[data-mode-scale]');
const lit = page => light(page).evaluate(el => el.classList.contains('lit'));

const frame = async page => {
  const box = await page.locator('#plan').boundingBox();
  const scale = await page.evaluate(() => Number(
    /scale ([\d.]+) px\/ft/.exec(document.getElementById('readout').textContent)[1]));
  return (x, z) => [box.x + box.width / 2 + x * scale, box.y + box.height / 2 + z * scale];
};

const saveAndRead = async page => {
  await page.locator('[data-model-save]').click();
  await expect(page.locator('[data-model-save]')).toHaveText(/saved/i, { timeout: 6000 });
  return page.evaluate(async bucket => {
    const f = await window.SharedFileStore.loadSharedFile(bucket);
    return JSON.parse(await f.text());
  }, BUCKET);
};

// The wall the gestures below make or move, found by exclusion: the fixture's
// four are named, so anything else is the one under test.
const FIXTURE_IDS = ['n', 'e', 's', 'w'];
const drawnWall = saved => (saved.walls || []).find(w => !FIXTURE_IDS.includes(w.id));

// A DELIBERATELY ODD RUN: 6.4 ft across and 0 down, so the length is 6.4 and
// the nearest foot is 6. Not 6.5, which rounds either way depending on the
// tie-break and would make a half-foot bug look like a pass.
const ODD = 6.4;

test('light OFF: a DRAFTING run commits the odd length the hand gave it',
  async ({ page }) => {
    await open(page, base({ board: 'drafting' }));
    const at = await frame(page);
    expect(await lit(page), 'the light is off on a page that has never seen it')
      .toBe(false);

    await h.armWall(page);
    await page.mouse.click(...at(-3, 0));
    await page.waitForTimeout(60);
    await page.mouse.click(...at(-3 + ODD, 0));
    await page.waitForTimeout(60);

    const drawn = drawnWall(await saveAndRead(page));
    expect(drawn, 'the wall reached the file').toBeTruthy();
    const len = Math.hypot(drawn.end.x - drawn.start.x, drawn.end.z - drawn.start.z);
    expect(len, 'DRAFTING with the light off surrenders no half-inch')
      .toBeCloseTo(ODD, 2);
  });

test('light ON: the same DRAFTING run lands on the whole foot',
  async ({ page }) => {
    await open(page, base({ board: 'drafting' }));
    const at = await frame(page);
    await light(page).click();
    expect(await lit(page), 'the chip lights like the T-SQUARE beside it').toBe(true);

    await h.armWall(page);
    await page.mouse.click(...at(-3, 0));
    await page.waitForTimeout(60);
    await page.mouse.click(...at(-3 + ODD, 0));
    await page.waitForTimeout(60);

    const drawn = drawnWall(await saveAndRead(page));
    expect(drawn, 'the wall reached the file').toBeTruthy();
    const len = Math.hypot(drawn.end.x - drawn.start.x, drawn.end.z - drawn.start.z);
    expect(len, 'the light rounds the run to the foot').toBeCloseTo(6, 6);
  });

test('light ON: a DRAFTING drag moves a whole number of feet',
  async ({ page }) => {
    await open(page, base({ board: 'drafting' }));
    const at = await frame(page);
    await light(page).click();

    // Select the north wall, then drag its body an odd distance.
    await page.mouse.click(...at(0, -10));
    await page.waitForTimeout(80);
    const from = at(0, -10);
    const to = at(0, -10 + 2.4);
    await page.mouse.move(...from);
    await page.mouse.down();
    await page.mouse.move(...to, { steps: 8 });
    await page.mouse.up();
    await page.waitForTimeout(120);

    const saved = await saveAndRead(page);
    const n = saved.walls.find(w => w.id === 'n');
    expect(n.start.z, 'a 2.4ft drag lands 2ft away, on the foot')
      .toBeCloseTo(-8, 6);
    expect(n.end.z, 'and both ends travelled the same whole foot')
      .toBeCloseTo(-8, 6);
  });

test('light OFF: the same drag keeps the odd distance', async ({ page }) => {
  await open(page, base({ board: 'drafting' }));
  const at = await frame(page);

  await page.mouse.click(...at(0, -10));
  await page.waitForTimeout(80);
  const from = at(0, -10);
  const to = at(0, -10 + 2.4);
  await page.mouse.move(...from);
  await page.mouse.down();
  await page.mouse.move(...to, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(120);

  const saved = await saveAndRead(page);
  const n = saved.walls.find(w => w.id === 'n');
  expect(Math.abs(n.start.z - (-8)),
    'DRAFTING with the light off does not round the drag').toBeGreaterThan(0.1);
});

test('the light survives a reload, and is off on a page that never saw it',
  async ({ page }) => {
    await open(page, base({ board: 'drafting' }));
    expect(await lit(page), 'off by default').toBe(false);
    await light(page).click();
    expect(await lit(page)).toBe(true);

    await page.reload();
    await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
    expect(await lit(page), 'the light outlives the tab').toBe(true);
  });

test('THE LEAK, BOTH WAYS: the light cannot unround TOY, and TOY does not arm it',
  async ({ page }) => {
    // §3's gate already carries "TOY LEAKS: every board goes through the
    // constraint path". This is the same defect wearing the other coat: a
    // switch that can reach the TOY arm would let a drafter unround TOY.
    await open(page, base({ board: 'toy' }));
    const at = await frame(page);
    expect(await lit(page), 'opening TOY does not arm the DRAFTING light')
      .toBe(false);

    await h.armWall(page);
    await page.mouse.click(...at(-3, 0));
    await page.waitForTimeout(60);
    await page.mouse.click(...at(-3 + ODD, 0));
    await page.waitForTimeout(60);

    const drawn = drawnWall(await saveAndRead(page));
    expect(drawn, 'the wall reached the file').toBeTruthy();
    const len = Math.hypot(drawn.end.x - drawn.start.x, drawn.end.z - drawn.start.z);
    expect(len, 'TOY is rounded because it is TOY, light or no light')
      .toBeCloseTo(6, 6);
  });

test('the light is a page setting, not drawing data', async ({ page }) => {
  await open(page, base({ board: 'drafting' }));
  await light(page).click();
  expect(await lit(page)).toBe(true);

  const saved = await saveAndRead(page);
  // A drawing carrying "the foot light was on" would arrive in someone else's
  // session and start rounding his walls. ABSENT, not false -- the same
  // absent-vs-null distinction the board keys cost a day of red CI.
  const keys = Object.keys(saved).filter(k => /foot|scale/i.test(k));
  expect(keys, 'no foot-light key reached the file').toEqual([]);
});

test('ACCEPTANCE 6: the light rounds distance and squares nothing',
  async ({ page }) => {
    // THE CHECK A "MAKE DRAFTING BEHAVE LIKE TOY" SHORTCUT FAILS. Routing the
    // light through the TOY path would square this run as a side effect and
    // every other check here would still pass.
    await open(page, base({ board: 'drafting' }));
    const at = await frame(page);
    await light(page).click();

    await h.armWall(page);
    await page.mouse.click(...at(-4, -4));
    await page.waitForTimeout(60);
    await page.mouse.click(...at(0, -1));       // 4 across, 3 down: a 5ft diagonal
    await page.waitForTimeout(60);

    const drawn = drawnWall(await saveAndRead(page));
    expect(drawn, 'the wall reached the file').toBeTruthy();
    const dx = Math.abs(drawn.end.x - drawn.start.x);
    const dz = Math.abs(drawn.end.z - drawn.start.z);
    expect(Math.min(dx, dz),
      'the run is still off-axis: the foot light is not the T-SQUARE')
      .toBeGreaterThan(0.5);
  });
