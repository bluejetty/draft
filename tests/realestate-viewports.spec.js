// VIEWPORTS THE DRAFTER PLACES ON THE REAL ESTATE PLAN (jb, 28 Nov 2026:
// "can we make these viewports so the user can place them and add or delete
// more. also would like to double click the floor plans to change scale and
// layers"; "allow the user to place and move around a logo and maybe a text
// box ... company name and or address / phone number"; "hug"; "undo good
// idea and redo").
//
// Read through window.__rpSheet(), the arrangement as the page holds it, and
// through the drawing in browser storage, which is what a saved file carries.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const h = require('./helpers');

const HOUSE = JSON.parse(fs.readFileSync(
  path.join(__dirname, '..', 'proto', 'repro-timberhouse-jog-fascia.draft'), 'utf8'));

async function openSheet(page, saved = HOUSE, { standards = null, viewer = false } = {}) {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  // No 3D pictures unless asked: most of these are about the sheet.
  if (!viewer) await page.route('**/viewer/**', route => route.fulfill({ status: 404, body: 'not here' }));
  await h.suppressEntryCoach(page);
  await page.setViewportSize({ width: 1360, height: 820 });
  await page.goto('/REALESTATEPLAN.html');
  await page.waitForFunction(() => !!window.SharedFileStore, null, { timeout: 15000 });
  await page.evaluate(async ({ bucket, saved, standards }) => {
    localStorage.removeItem('draft-realestate-3d');
    localStorage.removeItem('draft-active-package:standards');
    if (standards) localStorage.setItem('draft-active-package:standards', JSON.stringify(standards));
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(saved)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: h.STORAGE_BUCKET, saved, standards });
  await page.goto('/REALESTATEPLAN.html');
  await page.waitForFunction(() => typeof window.__rpSheet === 'function' && window.__rpSheet().geom);
  return errors;
}
const sheetNow = page => page.evaluate(() => window.__rpSheet());
const stored = page => page.evaluate(async bucket => {
  const file = await window.SharedFileStore.loadSharedFile(bucket);
  return JSON.parse(await file.text());
}, h.STORAGE_BUCKET);
const saved = page => page.waitForFunction(() => document.body.dataset.rpSaveDirty === '0');

// Paper inches to page pixels, off the page's own geometry.
async function pagePt(page, xIn, yIn) {
  const s = await sheetNow(page);
  const box = await page.locator('#sheet').boundingBox();
  const cv = await page.evaluate(() => { const c = document.getElementById('sheet'); return { w: c.width, h: c.height }; });
  return { x: box.x + (s.geom.x + xIn * s.geom.k) * box.width / cv.w, y: box.y + (s.geom.y + yIn * s.geom.k) * box.height / cv.h };
}
const boxOf = (s, id) => s.boxes.find(b => b.id === id);
async function centreOf(page, id) {
  const b = boxOf(await sheetNow(page), id);
  return pagePt(page, b.x + b.w / 2, b.y + b.h / 2);
}
async function dragBy(page, from, dxIn, dyIn) {
  const s = await sheetNow(page);
  const box = await page.locator('#sheet').boundingBox();
  const cvw = await page.evaluate(() => document.getElementById('sheet').width);
  const k = s.geom.k * box.width / cvw;
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + dxIn * k / 2, from.y + dyIn * k / 2, { steps: 4 });
  await page.mouse.move(from.x + dxIn * k, from.y + dyIn * k, { steps: 4 });
  await page.mouse.up();
}

test('an old drawing opens as it always did, and nothing is written until the sheet is arranged', async ({ page }) => {
  const errors = await openSheet(page);
  const s = await sheetNow(page);
  expect(s.arranged).toBe(false);
  expect(s.items.map(it => it.label)).toEqual(['FRONT 3D VIEW', 'REAR 3D VIEW', 'MAIN FL', '2ND FL', 'FLOOR AREAS']);
  // A tick re-flows the rest, as before, and is not written into the drawing.
  await page.locator('.seat', { hasText: 'REAR 3D VIEW' }).locator('input').uncheck();
  expect((await sheetNow(page)).arranged).toBe(false);
  expect((await stored(page)).realEstatePlan).toBeUndefined();
  expect(errors).toEqual([]);
});

test('drag a viewport: it moves, the sheet becomes the drafter\'s, and it opens there again', async ({ page }) => {
  const errors = await openSheet(page);
  const before = boxOf(await sheetNow(page), 'plan-3');
  await dragBy(page, await centreOf(page, 'plan-3'), 1, -0.5);
  await saved(page);
  const after = boxOf(await sheetNow(page), 'plan-3');
  expect((await sheetNow(page)).arranged).toBe(true);
  expect(Math.abs(after.x - (before.x + 1))).toBeLessThan(0.15);
  expect(after.y).toBeLessThan(before.y - 0.3);
  const rec = (await stored(page)).realEstatePlan;
  expect(rec.items.find(it => it.id === 'plan-3').x).toBeCloseTo(after.x, 3);
  await page.reload();
  await page.waitForFunction(() => window.__rpSheet?.().geom);
  expect(boxOf(await sheetNow(page), 'plan-3').x).toBeCloseTo(after.x, 3);
  expect(errors).toEqual([]);
});

test('a corner grip sizes it, and the edges snap to the margin', async ({ page }) => {
  await openSheet(page);
  const plan = await centreOf(page, 'plan-3');
  await page.mouse.click(plan.x, plan.y);
  const b = boxOf(await sheetNow(page), 'plan-3');
  // Pull the bottom-right corner most of the way to the margin's corner:
  // it snaps the last bit.
  const grip = await pagePt(page, b.x + b.w, b.y + b.h);
  await dragBy(page, grip, -1, 0);
  const sized = boxOf(await sheetNow(page), 'plan-3');
  expect(sized.w).toBeLessThan(b.w - 0.5);
  expect(sized.x).toBeCloseTo(b.x, 3);
  // Back right to a hair off the margin's right edge: it lands on it.
  const s = await sheetNow(page);
  const right = s.paper === 'letter-land' ? 10.5 : 8;
  const g2 = await pagePt(page, sized.x + sized.w, sized.y + sized.h);
  await dragBy(page, g2, right - (sized.x + sized.w) - 0.03, 0);
  const snapped = boxOf(await sheetNow(page), 'plan-3');
  expect(snapped.x + snapped.w).toBeCloseTo(right, 3);
});

test('+ ADD puts on another plan; × and Delete take them off; UNDO and REDO step back and forth', async ({ page }) => {
  const errors = await openSheet(page);
  await page.locator('#rp-add').click();
  await page.locator('#rp-menu [data-menu-item="add-plan-3"]').click();
  let s = await sheetNow(page);
  const added = s.items[s.items.length - 1];
  expect(added).toMatchObject({ kind: 'plan', levelId: 3, label: 'MAIN FL', on: true });
  expect(s.selectedId).toBe(added.id);
  await page.keyboard.press('Delete');
  s = await sheetNow(page);
  expect(s.items.some(it => it.id === added.id)).toBe(false);
  await page.locator('.seat', { hasText: 'REAR 3D VIEW' }).locator('.seat-del').click();
  expect((await sheetNow(page)).items.map(it => it.label)).toEqual(['FRONT 3D VIEW', 'MAIN FL', '2ND FL', 'FLOOR AREAS']);
  await page.locator('#rp-undo').click();
  expect((await sheetNow(page)).items.map(it => it.id)).toContain('back');
  await page.locator('#rp-undo').click();
  expect((await sheetNow(page)).items.map(it => it.id)).toContain(added.id);
  await page.keyboard.press('Control+y');
  expect((await sheetNow(page)).items.map(it => it.id)).not.toContain(added.id);
  await saved(page);
  expect((await stored(page)).realEstatePlan.items.map(it => it.id)).not.toContain(added.id);
  expect(errors).toEqual([]);
});

test('double-click a floor plan: a scale makes the box hug the plan, and a layer goes off in that one only', async ({ page }) => {
  const errors = await openSheet(page);
  const at = await centreOf(page, 'plan-3');
  await page.mouse.dblclick(at.x, at.y);
  await expect(page.locator('#rp-card')).toBeVisible();
  await page.locator('[data-scale-list]').selectOption({ label: '1/8" = 1\'-0"' });
  let s = await sheetNow(page);
  const item = s.items.find(it => it.id === 'plan-3');
  expect(item.pif).toBe(1 / 8);
  // HUG: the box is the plan's own extent at 1/8", plus its pad and title.
  const box = boxOf(s, 'plan-3');
  const extent = await page.evaluate(async bucket => {
    const file = await window.SharedFileStore.loadSharedFile(bucket);
    const raw = JSON.parse(await file.text());
    const F = window.DraftDrawingFormat, WT = window.DraftWallTypes;
    const levels = F.levels(raw.levels);
    const drawing = { ...raw, walls: F.walls(raw.walls, new Set(levels.map(l => l.id)), {
      wallTypes: WT.WALL_TYPES, legacyWallTypes: WT.LEGACY_WALL_TYPES,
      finishIds: WT.EXTERIOR_FINISHES.map(f => f.id), legacyFinishes: WT.LEGACY_FINISH_IDS,
      finishAnchors: WT.FINISH_ANCHORS, defaultWallTopFt: 8 }) };
    const b = window.DraftLayoutPlan.planBounds(drawing, 3);
    return { x: b.maxX - b.minX, z: b.maxZ - b.minZ };
  }, h.STORAGE_BUCKET);
  expect(box.w).toBeCloseTo(extent.x / 8 + 0.24, 3);
  expect(box.h).toBeCloseTo(extent.z / 8 + 0.24 + 0.22, 3);
  // A typed scale works the same.
  await page.locator('[data-scale-text]').fill('3/16');
  await page.locator('[data-scale-text]').press('Enter');
  s = await sheetNow(page);
  expect(s.items.find(it => it.id === 'plan-3').pif).toBe(3 / 16);
  // WALLS off here and nowhere else.
  await page.locator('#rp-card [data-layer-group="walls"]').click();
  s = await sheetNow(page);
  expect(s.items.find(it => it.id === 'plan-3').layersOff).toEqual(expect.arrayContaining(['A-WALL-EXT', 'A-WALL-INT']));
  expect(s.items.find(it => it.id === 'plan-5').layersOff).toBeUndefined();
  await expect(page.locator('#rp-card [data-layer-group="walls"]')).toHaveAttribute('data-state', 'OFF');
  await page.locator('#rp-card [data-layers-reset]').click();
  expect((await sheetNow(page)).items.find(it => it.id === 'plan-3').layersOff).toBeUndefined();
  // FIT puts the box back to sizing by hand.
  await page.locator('[data-scale-list]').selectOption('0');
  expect((await sheetNow(page)).items.find(it => it.id === 'plan-3').pif).toBe(null);
  expect(errors).toEqual([]);
});

test('the walls really go: a plan with WALLS off draws less ink than with them on', async ({ page }) => {
  await openSheet(page);
  // Only MAIN FL on, so the ink counted is that plan's.
  for (const name of ['FRONT 3D VIEW', 'REAR 3D VIEW', '2ND FL']) {
    await page.locator('.seat', { hasText: name }).locator('input').uncheck();
  }
  // Dark pixels on the PAPER only: the desk round it is dark in a night skin.
  const ink = () => page.evaluate(() => {
    const cv = document.getElementById('sheet');
    const { geom, paper } = window.__rpSheet();
    const w = paper === 'letter-land' ? 11 : 8.5, hh = paper === 'letter-land' ? 8.5 : 11;
    const d = cv.getContext('2d').getImageData(Math.round(geom.x) + 2, Math.round(geom.y) + 2,
      Math.round(w * geom.k) - 4, Math.round(hh * geom.k) - 4).data;
    let n = 0;
    for (let i = 0; i < d.length; i += 4) if (d[i] < 90 && d[i + 1] < 90 && d[i + 2] < 90) n += 1;
    return n;
  });
  const on = await ink();
  const at = await centreOf(page, 'plan-3');
  await page.mouse.dblclick(at.x, at.y);
  await page.locator('#rp-card [data-layer-group="walls"]').click();
  const off = await ink();
  expect(off).toBeLessThan(on * 0.6);
});

test('a LOGO and the COMPANY box: placed, picked, typed, and the company lines kept in COMPANY STANDARDS', async ({ page }) => {
  const errors = await openSheet(page);
  await page.locator('#rp-add').click();
  await page.locator('#rp-menu [data-menu-item="add-logo"]').click();
  let s = await sheetNow(page);
  const logo = s.items[s.items.length - 1];
  // This drawing's construction sheets wear BLUEJETTY, so the logo does too.
  expect(logo).toMatchObject({ kind: 'logo', markId: 'bluejetty' });
  // Moved like anything else.
  await dragBy(page, await centreOf(page, logo.id), -2, 1);
  expect(boxOf(await sheetNow(page), logo.id).x).toBeLessThan(logo.x - 1.5);
  // Double-click: the logo list, and another pick.
  const lc = await centreOf(page, logo.id);
  await page.mouse.dblclick(lc.x, lc.y);
  await page.locator('#rp-card [data-mark-id="roughdrafter"]').click();
  expect((await sheetNow(page)).items.find(it => it.id === logo.id).markId).toBe('roughdrafter');
  await page.keyboard.press('Escape');

  await page.locator('#rp-add').click();
  await page.locator('#rp-menu [data-menu-item="add-text"]').click();
  s = await sheetNow(page);
  const text = s.items[s.items.length - 1];
  expect(text.lines.map(l => l.role)).toEqual(['name', 'address', 'phone']);
  const tc = await centreOf(page, text.id);
  await page.mouse.dblclick(tc.x, tc.y);
  await page.locator('[data-line-text="0"]').fill('BLUEJETTY DESIGN');
  await page.locator('[data-line-text="0"]').press('Enter');
  await page.locator('[data-line-text="1"]').fill('12 HARBOUR RD');
  await page.locator('[data-line-text="1"]').press('Tab');
  await page.locator('[data-line-text="2"]').fill('705-555-0134');
  await page.locator('[data-line-text="2"]').press('Tab');
  // The address off the sheet, kept in the box.
  await page.locator('[data-line-on="1"]').uncheck();
  s = await sheetNow(page);
  expect(s.items.find(it => it.id === text.id).lines).toEqual([
    { role: 'name', text: 'BLUEJETTY DESIGN', on: true },
    { role: 'address', text: '12 HARBOUR RD', on: false },
    { role: 'phone', text: '705-555-0134', on: true },
  ]);
  const info = await page.evaluate(() => JSON.parse(localStorage.getItem('draft-active-package:standards')).content.model.companyInfo);
  expect(info).toEqual({ name: 'BLUEJETTY DESIGN', address: '12 HARBOUR RD', phone: '705-555-0134' });
  // The ink on the sheet: name and phone, no address.
  const inked = await page.evaluate(() => {
    const seen = [];
    const P = CanvasRenderingContext2D.prototype, f = P.fillText;
    P.fillText = function (t) { seen.push(String(t)); return f.apply(this, arguments); };
    window.dispatchEvent(new Event('resize'));
    P.fillText = f;
    return seen;
  });
  expect(inked).toEqual(expect.arrayContaining(['BLUEJETTY DESIGN', '705-555-0134']));
  expect(inked).not.toContain('12 HARBOUR RD');
  expect(errors).toEqual([]);
});

test('a new COMPANY box starts with what COMPANY STANDARDS already holds', async ({ page }) => {
  const standards = { format: 'draft-profile-package', version: 1, kind: 'standards', name: 'MINE',
    content: { model: { companyInfo: { name: 'ACME HOMES', address: '1 MAIN ST', phone: '555-0100' } } } };
  await openSheet(page, HOUSE, { standards });
  await page.locator('#rp-add').click();
  await page.locator('#rp-menu [data-menu-item="add-text"]').click();
  const s = await sheetNow(page);
  expect(s.items[s.items.length - 1].lines.map(l => l.text)).toEqual(['ACME HOMES', '1 MAIN ST', '555-0100']);
});

test('right-click: the item\'s commands, or + ADD at that spot on the paper', async ({ page }) => {
  const errors = await openSheet(page);
  const at = await centreOf(page, 'plan-5');
  await page.mouse.click(at.x, at.y, { button: 'right' });
  await expect(page.locator('#rp-menu [data-menu-item="scale-layers"]')).toBeVisible();
  await page.locator('#rp-menu [data-menu-item="to-back"]').click();
  expect((await sheetNow(page)).items[0].id).toBe('plan-5');
  // Empty paper: the add menu, the new item centred where it was asked for.
  const spot = await pagePt(page, 0.3, 0.3);
  await page.mouse.click(spot.x, spot.y, { button: 'right' });
  await page.locator('#rp-menu [data-menu-item="add-areas"]').click();
  const s = await sheetNow(page);
  const areas = s.items[s.items.length - 1];
  expect(areas.kind).toBe('areas');
  expect(areas.x).toBeCloseTo(0, 3);
  expect(errors).toEqual([]);
});

test('another paper keeps the arrangement, stretched to fit', async ({ page }) => {
  await openSheet(page);
  await dragBy(page, await centreOf(page, 'plan-3'), 0.5, 0);
  await page.selectOption('#paper', 'tabloid-land');
  const s = await sheetNow(page);
  expect(s.paper).toBe('tabloid-land');
  const b = boxOf(s, 'plan-3');
  expect(b.x + b.w).toBeLessThanOrEqual(17);
  expect(b.w).toBeGreaterThan(5);
  await saved(page);
  expect((await stored(page)).realEstatePlan.paper).toBe('tabloid-land');
});

test('on an arranged sheet a turned 3D view is kept in the drawing, and RESET puts it back', async ({ page }) => {
  const errors = await openSheet(page, HOUSE, { viewer: true });
  await page.waitForFunction(() => (document.body.dataset.view3dDrawn || '').split(' ').length === 2, null, { timeout: 30000 });
  // Arrange it: the 2ND FL nudged right.
  const p5 = await centreOf(page, 'plan-5');
  await page.mouse.click(p5.x, p5.y);
  await page.keyboard.press('Shift+ArrowRight');
  expect((await sheetNow(page)).arranged).toBe(true);
  const at = await centreOf(page, 'front');
  await page.mouse.dblclick(at.x, at.y);
  const inside = page.frameLocator('[data-view3d-frame]');
  await expect(inside.locator('#embed-bar')).toBeVisible({ timeout: 20000 });
  await inside.locator('[data-preset="back"]').click();
  await inside.locator('#embed-done').click();
  await expect.poll(async () => (await sheetNow(page)).items.find(it => it.id === 'front').camera).not.toBe(null);
  await saved(page);
  expect((await stored(page)).realEstatePlan.items.find(it => it.id === 'front').camera).toBeTruthy();
  await expect(page.locator('#view3d-reset')).toBeVisible();
  await page.locator('#view3d-reset').click();
  expect((await sheetNow(page)).items.find(it => it.id === 'front').camera).toBe(null);
  await expect(page.locator('#view3d-reset')).toBeHidden();
  // One UNDO brings the turned view back.
  await page.locator('#rp-undo').click();
  expect((await sheetNow(page)).items.find(it => it.id === 'front').camera).toBeTruthy();
  expect(errors).toEqual([]);
});
