// THE FIREPLACE (jb, 27 Nov 2026): "i need a 'fireplace' ... i will need it
// to 'attach' itself to a 2x4 or 2x6 wall so the front will show the opening
// and frame / glass and small threshold and allow the user to change the
// dimensions in the 'OBJ' PROP/ area".
//
// A FIREPLACE chip under LIVING on the BUILD pane; one press onto a wall
// lands it tight against that wall's room face (no half inch: it is framed
// in), front to the room; plan draws the box, frame, glass, firebox, hearth
// and "GAS FP"; OBJ / PROP edits WIDTH, DEPTH, OPENING and THRESHOLD.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
// Two walls along z: a 2x6 along z = 0 and a 2x4 along z = -12, both 20'.
const W = (id, a, b, wallType) => ({ id, start: { x: a[0], y: 0, z: a[1] }, end: { x: b[0], y: 0, z: b[1] },
  levelId: 3, view: 'plan', wallType, refLine: 'center', baseHeight: 0, topHeight: 8 });
const drawing = fixtures => ({
  version: 1, board: 'drafting', planTurn: 0,
  levels: [{ id: 8, name: 'SITE', elev: 0 }, { id: 7, name: 'ROOF', elev: 0 },
    { id: 5, name: '2ND FL', elev: 9 }, { id: 3, name: 'MAIN FL', elev: 0 },
    { id: 1, name: 'FOUNDATION', elev: -8 }],
  activeLevelIdx: 3, nextDrawingItemId: 20,
  walls: [W('six', [-10, 0], [10, 0], 'stud_2x6'), W('four', [-10, -12], [10, -12], 'stud_2x4')],
  fixtures,
  lines: [], floors: [], roofs: [], fenestrations: [], dimensions: [],
  outlines: [], shapes: [], surfaceOpenings: [], notes: [], stairs: [],
  roomTags: [], columns: [], beams: [], boneyardOutlines: [], groups: [], levelLocks: [], underlays: [],
});
const FP = (extra = {}) => ({ id: 'fp', wallId: 'six', levelId: 3, view: 'plan', kind: 'fireplace', layer: 'A-FIXT',
  offset: 10, width: 5, depth: 19 / 12, side: 1, ...extra });

async function open(page, fixtures, pane = 'drafting') {
  await page.addInitScript(() => {
    window.__texts = [];
    const proto = CanvasRenderingContext2D.prototype;
    const orig = proto.fillText;
    proto.fillText = function (text, ...rest) { window.__texts.push(String(text)); return orig.call(this, text, ...rest); };
  });
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, f }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, f: drawing(fixtures) });
  await page.goto(`/MODEL.html?left=1&lpane=${pane}&level=3`);
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  await page.waitForTimeout(200);
  return h.planFrame(page);
}
async function saved(page) {
  await page.locator('#save').click();
  await h.waitForSaved(page);
  return h.savedDrawing(page);
}
const fx = (d, id) => d.fixtures.find(f => f.id === id);
const r3 = n => Math.round(n * 1000) / 1000;

for (const [wallId, z, faceIn] of [['six', 0, 2.75], ['four', -12, 1.75]]) {
  test(`FIREPLACE presses onto a ${wallId === 'six' ? '2x6' : '2x4'} wall, tight to its room face`, async ({ page }) => {
    const { at } = await open(page, [], 'build');
    const chip = page.locator('[data-fixture-kind="fireplace"]');
    await expect(page.locator('[data-tool-group="fixture-living"]')).toContainText('LIVING');
    await expect(chip).toHaveText('FIREPLACE');
    await chip.click();
    await expect(chip).toHaveAttribute('aria-pressed', 'true');
    const [x, y] = at(2, z + 1);
    await page.mouse.move(x, y);
    await page.mouse.click(x, y);
    const d = await saved(page);
    expect(d.fixtures).toHaveLength(1);
    const f = d.fixtures[0];
    expect([f.kind, f.wallId, f.side, r3(f.width), r3(f.depth)]).toEqual(['fireplace', wallId, 1, 5, r3(19 / 12)]);
    // TIGHT TO THE FRAMING: its back on the wall's face, no half inch.
    const back = await page.evaluate(id => {
      const FG = window.DraftFixtureGeometry;
      const f = drawing.fixtures.find(fx => fx.kind === 'fireplace');
      const g = FG.fixtureGeometry(drawing.walls, f);
      return [g.backOff, FG.wallGapOf(f), id];
    }, wallId);
    expect(r3(back[0])).toBe(r3(faceIn / 12));
    expect(back[1]).toBe(0);
  });
}

test('it paints its GAS FP mark and its hearth in front of the box', async ({ page }) => {
  await open(page, [FP()]);
  const texts = await page.evaluate(() => window.__texts);
  expect(texts).toContain('GAS FP');
  const FGparts = await page.evaluate(() => window.DraftFixtureGeometry.fireplaceParts({ width: 5, depth: 19 / 12 }));
  expect([FGparts.opening, r3(FGparts.hearth), r3(FGparts.maxOpening)]).toEqual([3, r3(4 / 12), 4.5]);
});

test('OBJ / PROP edits WIDTH, DEPTH, OPENING and THRESHOLD; a too-wide opening is refused; the file keeps them', async ({ page }) => {
  const { at } = await open(page, [FP()]);
  const selectKey = page.locator('[data-tool-key="select"]');
  if (await selectKey.getAttribute('aria-pressed') !== 'true') await h.armFromRail(page, 'select');
  await page.mouse.click(...at(0, 0.9));
  await expect(page.locator('#delete')).toBeVisible();
  const box = name => page.locator(`#props-slot [data-prop-field="${name}"]`);
  await expect(box('width')).toHaveValue('5\'-0"');
  await expect(box('depth')).toHaveValue('1\'-7"');
  await expect(box('opening')).toHaveValue('3\'-0"');
  await expect(box('threshold')).toHaveValue('0\'-4"');

  await box('opening').fill('3-6');
  await box('opening').press('Enter');
  await box('threshold').fill('0-6');
  await box('threshold').press('Enter');
  let d = await saved(page);
  expect([fx(d, 'fp').opening, r3(fx(d, 'fp').hearth)]).toEqual([3.5, 0.5]);

  // WIDER THAN THE BOX LESS ITS FRAME: refused, the file unchanged.
  await box('opening').fill('4-8');
  await box('opening').press('Enter');
  await expect(page.locator('#strip-message')).toContainText(/wider than the fireplace/i);
  await box('threshold').fill('0');
  await box('threshold').press('Enter');
  await box('width').fill('6');
  await box('width').press('Enter');
  d = await saved(page);
  expect([fx(d, 'fp').opening, fx(d, 'fp').hearth, fx(d, 'fp').width]).toEqual([3.5, 0, 6]);

  // A RELOAD KEEPS THEM: the format carries opening and hearth.
  await page.reload();
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  d = await saved(page);
  expect([fx(d, 'fp').opening, fx(d, 'fp').hearth]).toEqual([3.5, 0]);
});
