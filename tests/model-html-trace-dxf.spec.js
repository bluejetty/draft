// TRACE: A DXF UNDER THE PLAN, ON MODEL.html.
//
// Movie, 9 Oct: "how about the ability to view DXF", then "do viewing first".
// A DXF comes in through the same TRACE card as a photo or a PDF, but full
// size -- no scale, no width, no CALIBRATE -- and is drawn as its own lines in
// its own colours. Its layers switch off and on from the TRACE card, one UNDO
// each. The reader itself is checked in proto/dxf-reader-harness.js.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const BLANK = {
  version: 1, board: 'drafting', planTurn: 0,
  levels: [{ id: 8, name: 'SITE', elev: 0 }, { id: 7, name: 'ROOF', elev: 0 },
    { id: 5, name: '2ND FL', elev: 9 }, { id: 3, name: 'MAIN FL', elev: 0 },
    { id: 1, name: 'FOUNDATION', elev: -8 }],
  activeLevelIdx: 3,
  walls: [], lines: [], floors: [], roofs: [], fenestrations: [], dimensions: [],
  outlines: [], shapes: [], surfaceOpenings: [], stairs: [], notes: [],
  roomTags: [], columns: [], beams: [], boneyardOutlines: [],
  groups: [], levelLocks: [], underlays: [],
};

// A DXF written out by hand: a 20' x 10' rectangle in red on WALLS, a green
// line across it on FURN, drawn in inches -- or with no unit at all.
function dxf({ units = 1 } = {}) {
  const pairs = [
    0, 'SECTION', 2, 'HEADER',
    ...(units === null ? [] : [9, '$INSUNITS', 70, units]),
    0, 'ENDSEC',
    0, 'SECTION', 2, 'TABLES', 0, 'TABLE', 2, 'LAYER',
    0, 'LAYER', 2, 'WALLS', 70, 0, 62, 1,
    0, 'LAYER', 2, 'FURN', 70, 0, 62, 3,
    0, 'ENDTAB', 0, 'ENDSEC',
    0, 'SECTION', 2, 'ENTITIES',
    0, 'LWPOLYLINE', 8, 'WALLS', 90, 4, 70, 1,
    10, 0, 20, 0, 10, 240, 20, 0, 10, 240, 20, 120, 10, 0, 20, 120,
    0, 'LINE', 8, 'FURN', 10, 0, 20, 0, 11, 240, 21, 120,
    0, 'ENDSEC', 0, 'EOF',
  ];
  const lines = [];
  for (let i = 0; i < pairs.length; i += 2) lines.push(String(pairs[i]), String(pairs[i + 1]));
  return Buffer.from(`${lines.join('\r\n')}\r\n`, 'latin1');
}

async function open(page) {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, f }) => {
    try { localStorage.removeItem('draft.trace.on'); } catch { /* fine */ }
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, f: BLANK });
  await page.goto('/MODEL.html?level=3');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
}
const chip = page => page.locator('[data-mode-trace]');
const card = page => page.locator('#trace-insert');
const pick = async (page, name, buffer) => {
  await chip(page).click();
  await page.locator('[data-trace-upload]').click();
  await page.locator('[data-trace-file]').setInputFiles({ name, mimeType: 'application/octet-stream', buffer });
};
const savedUnderlays = async page => {
  await page.locator('#save').click();
  await h.waitForSaved(page);
  return (await h.savedDrawing(page)).underlays || [];
};
// How many plan pixels are the file's red, and how many its green.
const inks = page => page.evaluate(() => {
  const c = document.getElementById('plan');
  const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
  let red = 0, green = 0;
  for (let i = 0; i < d.length; i += 4) {
    // Reddish and greenish rather than pure: a one-pixel line lands across
    // two pixels at part strength.
    if (d[i] - Math.max(d[i + 1], d[i + 2]) > 50) red += 1;
    if (d[i + 1] - Math.max(d[i], d[i + 2]) > 50) green += 1;
  }
  return { red, green };
});

test('a DXF comes in full size, in its own colours, with nothing to scale', async ({ page }) => {
  await open(page);
  await pick(page, 'plan.dxf', dxf());
  await expect(card(page).locator('[data-trace-go]')).toBeVisible({ timeout: 10000 });
  await expect(card(page).locator('[data-trace-verdict]')).toContainText('DXF');
  await expect(card(page).locator('[data-trace-unit="in"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(card(page).locator('[data-trace-size]')).toContainText(`20'-0" × 10'-0" (the file says so)`);
  await expect(card(page).locator('[data-trace-width-row]')).toBeHidden();
  await expect(card(page).locator('[data-trace-scale-row]')).toBeHidden();
  await expect(card(page).locator('[data-trace-calibrate]')).toBeHidden();
  await card(page).locator('[data-trace-go]').click();
  await expect(card(page)).toBeHidden();

  const u = await savedUnderlays(page);
  expect(u).toHaveLength(1);
  expect(u[0]).toMatchObject({ kind: 'dxf', dxfUnits: 'in', hiddenLayers: [], name: 'plan.dxf' });
  expect(Math.round(u[0].widthFt * 100) / 100).toBe(20);
  expect(Math.round(u[0].heightFt * 100) / 100).toBe(10);
  await expect.poll(async () => (await inks(page)).red, 'the WALLS rectangle draws red').toBeGreaterThan(50);
  expect((await inks(page)).green, 'and FURN its green line').toBeGreaterThan(20);

  // And again after a reload: the file comes back out of the store.
  await page.reload();
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  await expect.poll(async () => (await inks(page)).red, 'read back from the store').toBeGreaterThan(50);
});

test('a layer switches off and on from the TRACE card, one UNDO each', async ({ page }) => {
  await open(page);
  await pick(page, 'plan.dxf', dxf());
  await card(page).locator('[data-trace-go]').click();
  await expect.poll(async () => (await inks(page)).green).toBeGreaterThan(20);

  // TRACE off and on again opens the card listing what is on the level.
  await chip(page).click();
  await chip(page).click();
  const furn = page.locator('#trace-ask [data-trace-layer="FURN"]');
  await expect(furn).toHaveAttribute('aria-pressed', 'true');
  await furn.click();
  await expect(furn).toHaveAttribute('aria-pressed', 'false');
  await expect.poll(async () => (await inks(page)).green, 'FURN is off').toBe(0);
  expect((await inks(page)).red, 'and WALLS still shows').toBeGreaterThan(50);
  await page.locator('[data-trace-later]').click();
  expect((await savedUnderlays(page))[0].hiddenLayers).toEqual(['FURN']);

  await page.locator('#model-undo').click();
  await expect.poll(async () => (await inks(page)).green, 'UNDO brings it back').toBeGreaterThan(20);
});

test('a file that does not say its unit is asked about, and the pick sizes it', async ({ page }) => {
  await open(page);
  await pick(page, 'nounits.dxf', dxf({ units: null }));
  await expect(card(page).locator('[data-trace-size]')).toContainText('the file does not say');
  await card(page).locator('[data-trace-unit="ft"]').click();
  await expect(card(page).locator('[data-trace-size]')).toContainText(`240'-0" × 120'-0"`);
  await card(page).locator('[data-trace-go]').click();
  const [u] = await savedUnderlays(page);
  expect(u.dxfUnits).toBe('ft');
  expect(Math.round(u.widthFt)).toBe(240);
});

test('a DWG is refused by name, with what to do instead', async ({ page }) => {
  await open(page);
  await pick(page, 'plan.dwg', Buffer.from('AC1032'));
  await expect(card(page).locator('[data-trace-status]')).toContainText('save it as a DXF');
  await expect(card(page).locator('[data-trace-go]')).toBeHidden();
});
