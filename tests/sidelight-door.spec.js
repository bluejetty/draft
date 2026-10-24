// THE SIDELIGHT DOOR (Movie, 24 Oct): "maybe if there is a double door or
// sidelight we mark both sizes (eg looks like a 36 door / 30 or 24 sidelight
// in this photo". Asked how: "One or two, picked", "36" door + 14" light",
// and on the plan "Like a window beside the leaf".
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const P = (x, z) => ({ x, y: 0, z });
const door = more => ({ id: 'd', wallId: 'n', levelId: 3, view: 'plan', type: 'door',
  layer: 'A-DOOR', offset: 10, width: 50 / 12, sillHeight: 0, headHeight: 80 / 12,
  garage: false, doorType: 'ext', doorStyle: 'sidelight', auto: false, ...more });
const drawing = (more = {}) => ({
  version: 1, board: 'drafting',
  levels: [{ id: 3, name: 'MAIN FL', elev: 0 }],
  activeLevelIdx: 0, nextDrawingItemId: 50,
  walls: [{ id: 'n', start: P(0, 0), end: P(20, 0), levelId: 3, view: 'plan',
    wallType: 'stud_2x6', refLine: 'center', baseHeight: 0, topHeight: 8 }],
  fenestrations: [door(more)],
  lines: [], fixtures: [], dimensions: [], floors: [], roofs: [], outlines: [], shapes: [],
  surfaceOpenings: [], notes: [], stairs: [], roomTags: [], columns: [], beams: [],
  boneyardOutlines: [], groups: [], levelLocks: [], underlays: [],
});
async function open(page, f = drawing(), url = '/MODEL.html') {
  page.__errors = [];
  page.on('pageerror', err => page.__errors.push(String(err)));
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, f }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, f });
  await page.goto(url);
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  await page.keyboard.press('0');
  await page.waitForTimeout(200);
  return h.planFrame(page);
}
test.afterEach(async ({ page }) => { expect(page.__errors || [], 'no page errors').toEqual([]); });
const saved = async page => {
  await page.locator('#save').click();
  await h.waitForSaved(page);
  return h.savedDrawing(page);
};
const r2 = n => Math.round(n * 100) / 100;

test('its panels: a 36" leaf and a 14" light at the latch side, the hinge side, or one each side', async ({ page }) => {
  await open(page);
  const got = await page.evaluate(() => {
    const G = window.DraftGeometry2D;
    const inches = o => G.sidelightPanelsFt(o).panels.map(p => `${p.kind}:${Math.round(p.s0 * 12)}-${Math.round(p.s1 * 12)}`).join(' ');
    return {
      latch: inches({ width: 50 / 12 }),
      hinge: inches({ width: 50 / 12, sidelightSides: 'hinge' }),
      both: inches({ width: 64 / 12, sidelightSides: 'both' }),
      // A light that would leave less than a foot of leaf is read as 14".
      tooWide: inches({ width: 50 / 12, sidelightWidth: 45 / 12 }),
      catalog: G.DOOR_CATALOG.find(e => e.style === 'sidelight')?.defaultFt * 12,
    };
  });
  expect(got).toEqual({
    latch: 'door:0-36 light:36-50', hinge: 'light:0-14 door:14-50',
    both: 'light:0-14 door:14-50 light:50-64', tooWide: 'door:0-36 light:36-50', catalog: 50,
  });
});

test('its mark says both: D36/14, and D14/36/14 with a light each side', async ({ page }) => {
  await open(page);
  const labels = await page.evaluate(() => {
    const FL = window.DraftFenLabels;
    const d = o => FL.fenLabelForOpening({ type: 'door', doorStyle: 'sidelight', width: 50 / 12, headHeight: 80 / 12, ...o });
    return [d({}), d({ sidelightSides: 'hinge' }), d({ width: 64 / 12, sidelightSides: 'both' }), d({ width: 48 / 12, sidelightWidth: 1 })];
  });
  expect(labels).toEqual(['D36/14', 'D36/14', 'D14/36/14', 'D36/12']);
});

test('the file keeps a sidelight\'s sides and light width; another door carries neither', async ({ page }) => {
  await open(page);
  const out = await page.evaluate(() => {
    const F = window.DraftDrawingFormat;
    const ids = new Set([3]);
    const base = { wallId: 'n', levelId: 3, type: 'door', offset: 5, width: 64 / 12, sillHeight: 0, headHeight: 80 / 12 };
    const [a, b, c] = F.fenestrations([
      { ...base, id: 'a', doorStyle: 'sidelight', sidelightSides: 'both', sidelightWidth: 1 },
      { ...base, id: 'b', doorStyle: 'sidelight', sidelightSides: 'sideways' },
      { ...base, id: 'c', doorStyle: 'single', sidelightSides: 'both' },
    ], ids);
    return [[a.doorStyle, a.sidelightSides, a.sidelightWidth], [b.sidelightSides, b.sidelightWidth],
      ['sidelightSides' in c, 'sidelightWidth' in c]];
  });
  expect(out).toEqual([['sidelight', 'both', 1], ['latch', 14 / 12], [false, false]]);
});

test('PROPERTIES: SIDELIGHT BOTH SIDES widens the unit by a light and keeps the leaf; LIGHT WIDTH 12 sets both lights', async ({ page }) => {
  const { at } = await open(page, drawing(), '/MODEL.html?left=1&lpane=build');
  await page.mouse.click(...at(10, 0));
  const sides = page.locator('#props-slot [data-prop-select="sidelight"]');
  await expect(sides).toBeVisible();
  await expect(sides).toHaveValue('latch');
  await sides.selectOption('both');
  let d = (await saved(page)).fenestrations[0];
  expect(d.sidelightSides).toBe('both');
  expect(r2(d.width * 12), '36 + 14 + 14').toBe(64);
  expect(d.offset, 'about its centre').toBe(10);
  // The leaf is typed too.
  await expect(page.locator('#props-slot [data-prop-field="door width"]')).toBeVisible();
  const light = page.locator('#props-slot [data-prop-field="light width"]');
  await expect(light).toBeVisible();
  await light.fill('12"');
  await light.press('Enter');
  d = (await saved(page)).fenestrations[0];
  expect(r2(d.width * 12), '36 + 12 + 12').toBe(60);
  expect(r2(d.sidelightWidth * 12)).toBe(12);
});

test('picked from the DOOR list, EXT – SIDELIGHT is a sidelight door, drawn without a throw', async ({ page }) => {
  const { at } = await open(page, drawing({ doorStyle: 'single', width: 3 }), '/MODEL.html?left=1&lpane=build');
  await page.mouse.click(...at(10, 0));
  const kind = page.locator('#props-slot [data-prop-select="door"]');
  await expect(kind).toBeVisible();
  await kind.selectOption('ext-sidelight');
  const d = (await saved(page)).fenestrations[0];
  expect(d.doorStyle).toBe('sidelight');
  await expect(page.locator('#props-slot [data-prop-select="sidelight"]')).toBeVisible();
});
