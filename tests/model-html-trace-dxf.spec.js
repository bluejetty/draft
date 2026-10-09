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
// line across it on FURN, drawn in inches -- or with no unit at all -- and
// whatever else a check adds.
function dxf({ units = 1, more = [] } = {}) {
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
    ...more,
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
const saved = async page => {
  await page.locator('#save').click();
  await h.waitForSaved(page);
  return h.savedDrawing(page);
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

// ── EDITABLE (Movie, 9 Oct): "when they load it ask them if they want
// EDITABLE or NON-EDITABLE" -- "they will need to reload if they change
// their mind". ─────────────────────────────────────────────────────────────

test('EDITABLE brings the lit layers in as lines, one group, one UNDO', async ({ page }) => {
  await open(page);
  await pick(page, 'plan.dxf', dxf());
  await expect(card(page).locator('[data-trace-go]')).toHaveText('NON-EDITABLE');
  // FURN off on the card: only the WALLS rectangle comes in.
  await card(page).locator('[data-trace-card-layer="FURN"]').click();
  await expect(card(page).locator('[data-trace-card-layer="FURN"]')).toHaveAttribute('aria-pressed', 'false');
  await card(page).locator('[data-trace-editable]').click();
  await expect(card(page)).toBeHidden();

  const d = await saved(page);
  expect(d.underlays || [], 'nothing locked was laid').toHaveLength(0);
  const lines = d.lines.filter(l => l.importedFrom === 'plan.dxf');
  expect(lines, 'the four sides of the rectangle').toHaveLength(4);
  expect([...new Set(lines.map(l => l.layer))], 'on the layer the file gave them').toEqual(['WALLS']);
  // Full size: 240" by 120" is 20' by 10'.
  const xs = lines.flatMap(l => [l.start.x, l.end.x]), zs = lines.flatMap(l => [l.start.z, l.end.z]);
  expect(Math.round((Math.max(...xs) - Math.min(...xs)) * 100) / 100).toBe(20);
  expect(Math.round((Math.max(...zs) - Math.min(...zs)) * 100) / 100).toBe(10);
  expect(lines.every(l => Number(l.levelId) === 3), 'on the level it was loaded on').toBe(true);
  const group = (d.groups || []).find(g => g.name === 'plan');
  expect(group, 'one group named for the file').toBeTruthy();
  expect(group.members.map(m => m.id).sort()).toEqual(lines.map(l => l.id).sort());

  await page.locator('#model-undo').click();
  const back = await saved(page);
  expect(back.lines.filter(l => l.importedFrom), 'UNDO takes every line out').toHaveLength(0);
  expect((back.groups || []).filter(g => g.name === 'plan'), 'and the group').toHaveLength(0);
});

test('a circle comes in as eight curved lines that bend true', async ({ page }) => {
  await open(page);
  // A 12" circle on CIRC, well away from the rectangle.
  await pick(page, 'circle.dxf', dxf({ more: [0, 'CIRCLE', 8, 'CIRC', 10, 400, 20, 60, 40, 12] }));
  await card(page).locator('[data-trace-card-layer="WALLS"]').click();
  await card(page).locator('[data-trace-card-layer="FURN"]').click();
  await card(page).locator('[data-trace-editable]').click();
  const lines = (await saved(page)).lines.filter(l => l.layer === 'CIRC');
  expect(lines).toHaveLength(8);
  // Every curve's halfway point -- the quadratic through its control point,
  // the plan's own -- sits on the circle: 1' from the centre.
  const xs = lines.flatMap(l => [l.start.x, l.end.x]), zs = lines.flatMap(l => [l.start.z, l.end.z]);
  const c = { x: (Math.max(...xs) + Math.min(...xs)) / 2, z: (Math.max(...zs) + Math.min(...zs)) / 2 };
  lines.forEach(l => {
    const dx = l.end.x - l.start.x, dz = l.end.z - l.start.z, len = Math.hypot(dx, dz);
    const mid = { x: (l.start.x + l.end.x) / 2 + (-dz / len) * l.bulge / 2,
      z: (l.start.z + l.end.z) / 2 + (dx / len) * l.bulge / 2 };
    expect(Math.abs(Math.hypot(mid.x - c.x, mid.z - c.z) - 1)).toBeLessThan(0.001);
  });
  // AND THE PLAN DRAWS THEM CURVED: MODEL drew every line as its chord
  // until this came in, so a curve in the record was a straight stroke.
  const curves = await page.evaluate(() => {
    let n = 0;
    const real = CanvasRenderingContext2D.prototype.quadraticCurveTo;
    CanvasRenderingContext2D.prototype.quadraticCurveTo = function count(...args) {
      n += 1;
      return real.apply(this, args);
    };
    window.dispatchEvent(new Event('resize'));
    return new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => {
      CanvasRenderingContext2D.prototype.quadraticCurveTo = real;
      resolve(n);
    })));
  });
  expect(curves, 'each of the eight drawn as a curve').toBeGreaterThanOrEqual(8);
});

test('NON-EDITABLE keeps the layers the card switched off, off', async ({ page }) => {
  await open(page);
  await pick(page, 'plan.dxf', dxf());
  await card(page).locator('[data-trace-card-layer="FURN"]').click();
  await card(page).locator('[data-trace-go]').click();
  const [u] = await savedUnderlays(page);
  expect(u.kind).toBe('dxf');
  expect(u.hiddenLayers).toEqual(['FURN']);
});

test('the file\'s words are listed on the card to copy out', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await open(page);
  await pick(page, 'plan.dxf', dxf({ more: [
    0, 'TEXT', 8, 'NOTES', 10, 20, 20, 20, 40, 6, 1, 'KITCHEN',
    0, 'MTEXT', 8, 'NOTES', 10, 60, 20, 20, 40, 6, 1, '{\\fArial|b0;BATH A}',
    0, 'TEXT', 8, 'NOTES', 10, 90, 20, 20, 40, 6, 1, 'KITCHEN',
  ] }));
  const list = card(page).locator('[data-trace-text]');
  await list.locator('summary').click();
  await expect(list.locator('summary')).toContainText('TEXT IN THE FILE (2)');
  await expect(list.locator('[data-trace-copy]')).toHaveCount(2);
  await list.locator('[data-trace-copy="BATH A"]').click();
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe('BATH A');
  await list.locator('[data-trace-copy-all]').click();
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe('KITCHEN\nBATH A');
});

test('a big file says how many lines first, and the second press brings them in', async ({ page }) => {
  await open(page);
  const more = [];
  for (let i = 0; i < 5001; i += 1) more.push(0, 'LINE', 8, 'MANY', 10, i, 20, 200, 11, i, 21, 210);
  await pick(page, 'big.dxf', dxf({ more }));
  await card(page).locator('[data-trace-card-layer="WALLS"]').click();
  await card(page).locator('[data-trace-card-layer="FURN"]').click();
  await card(page).locator('[data-trace-editable]').click();
  await expect(card(page).locator('[data-trace-status]')).toContainText('5,001 lines');
  await expect(card(page)).toBeVisible();
  await card(page).locator('[data-trace-editable]').click();
  await expect(card(page)).toBeHidden({ timeout: 15000 });
  expect((await saved(page)).lines.filter(l => l.layer === 'MANY')).toHaveLength(5001);
});
