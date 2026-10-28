// REGISTRATION: SETBACK AND SIDEYARD, TYPED (Movie, 28 Oct: "in the lower
// right where it says 'drag to pan wheel to zoom' i'd like to have a little
// box with the 2 targets gold and green and the word REGISTRATION. and then
// it will have setback as one textbox and sideyard as the other for
// ft-inches (or metric if they have it set that way)"). On SITE only; the
// numbers are the gap between the green target and the gold one, and typing
// one slides the LOT -- the house never moves.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const SITE = 8;
const wall = (id, sx, sz, ex, ez) => ({ id, levelId: 3, view: 'plan', wallType: 'stud_2x6',
  refLine: 'left', baseHeight: 0, topHeight: 8, start: { x: sx, y: 0, z: sz }, end: { x: ex, y: 0, z: ez } });
const LOT = [[-30, -140], [30, -140], [30, 33], [-30, 33]];
const file = units => ({
  version: 1, planTurn: 0, board: 'drafting', ...(units ? { units } : {}),
  levels: [{ id: SITE, name: 'SITE', elev: 0 }, { id: 7, name: 'ROOF', elev: 0 },
    { id: 3, name: 'MAIN FL', elev: 0 }, { id: 1, name: 'FOUNDATION', elev: -8 }],
  activeLevelIdx: 2,
  walls: [wall(1, -20, -13, 20, -13), wall(2, 20, -13, 20, 13), wall(3, 20, 13, -20, 13), wall(4, -20, 13, -20, -13)],
  lines: [], floors: [], roofs: [], fenestrations: [], dimensions: [],
  outlines: [{ id: 'lot', levelId: SITE, site: true, closed: true, points: LOT.map(([x, z]) => ({ x, y: 0, z })) }],
  lot: { widthFt: 60, depthFt: 173, tier: null },
  shapes: [], surfaceOpenings: [], stairs: [], notes: [],
  roomTags: [], columns: [], beams: [], boneyardOutlines: [],
  groups: [], levelLocks: [], underlays: [],
});
async function open(page, level, units) {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, drawing }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(drawing)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, drawing: file(units) });
  await page.goto(`/MODEL.html?level=${level}`);
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
}
const box = page => page.locator('#registration');
const lotNow = page => page.evaluate(() => {
  const lot = globalThis.eval('drawing').outlines.find(o => o.site);
  return { x: Math.min(...lot.points.map(p => p.x)), z: Math.max(...lot.points.map(p => p.z)) };
});
const gap = page => page.evaluate(() => {
  const d = globalThis.eval('drawing');
  const lot = d.outlines.find(o => o.site);
  const green = window.DraftLotSizes.siteDatumOf(lot, 0);
  const gold = globalThis.eval('siteDatumNow()');
  return { setback: green.z - gold.z, sideyard: gold.x - green.x, gold };
});

test('on SITE the box shows both targets, REGISTRATION, and the gap between them in feet and inches', async ({ page }) => {
  await open(page, SITE);
  await expect(box(page)).toBeVisible();
  await expect(box(page)).toContainText('REGISTRATION');
  await expect(box(page).locator('svg')).toHaveCount(2);
  const g = await gap(page);
  const ftIn = v => page.evaluate(f => window.DraftFormatters.formatArchitecturalInches(Math.round(f * 192) / 16), v);
  await expect(box(page).locator('[data-reg-setback]')).toHaveValue(await ftIn(g.setback));
  await expect(box(page).locator('[data-reg-sideyard]')).toHaveValue(await ftIn(g.sideyard));
});

test('not on a floor plan: MAIN FL keeps only the pan hint', async ({ page }) => {
  await open(page, 3);
  await expect(box(page)).toBeHidden();
  await expect(page.locator('#hint')).toBeVisible();
});

test('typing a SETBACK slides the lot forward, a SIDEYARD slides it out; the house stays; one UNDO each', async ({ page }) => {
  await open(page, SITE);
  const g0 = await gap(page), lot0 = await lotNow(page);
  const steps = () => page.evaluate(() => globalThis.eval('undoStack').length);
  const steps0 = await steps();
  await box(page).locator('[data-reg-setback]').fill("40'");
  await box(page).locator('[data-reg-setback]').press('Enter');
  expect(await steps(), 'one UNDO step for the setback').toBe(steps0 + 1);
  const g1 = await gap(page), lot1 = await lotNow(page);
  expect(g1.setback).toBeCloseTo(40, 6);
  expect(lot1.z - lot0.z).toBeCloseTo(40 - g0.setback, 6);
  expect(lot1.x).toBeCloseTo(lot0.x, 6);
  expect(g1.gold).toEqual(g0.gold);
  await box(page).locator('[data-reg-sideyard]').fill('12-6');
  await box(page).locator('[data-reg-sideyard]').press('Enter');
  const g2 = await gap(page);
  expect(g2.sideyard).toBeCloseTo(12.5, 6);
  expect(g2.setback).toBeCloseTo(40, 6);
  await expect(box(page).locator('[data-reg-sideyard]')).toHaveValue("12'-6\"");
  expect(await steps(), 'and one for the sideyard').toBe(steps0 + 2);
  await page.keyboard.press('Control+z');
  expect((await gap(page)).sideyard).toBeCloseTo(g0.sideyard, 6);
  await page.keyboard.press('Control+z');
  expect(await lotNow(page)).toEqual(lot0);
});

test('metric drawings read and take metres', async ({ page }) => {
  await open(page, SITE, 'metric');
  await expect(box(page).locator('[data-reg-setback]')).toHaveValue(/ m$/);
  await box(page).locator('[data-reg-setback]').fill('6.096');
  await box(page).locator('[data-reg-setback]').press('Enter');
  expect((await gap(page)).setback).toBeCloseTo(20, 4);
});

// "i will need to add a 2nd exact site plan for the PHASE 2 as PHASE 1, but
// will only want to show the PHASE 2 site (no double lines)" -- "in the
// registration box show the different site plans on which holograms / file
// and they can checkbox the one they want to use".
const withPhase1 = () => {
  const d = file();
  const phase1 = { ...file(), walls: [wall(11, 30, -13, 50, -13)], holograms: [] };
  d.outlines = [];
  delete d.lot;
  d.holograms = [{ id: 'hologram-1', name: 'PHASE 1', x: 5, z: -2, angleDeg: 0, pivotX: 0, pivotZ: 0, source: phase1 }];
  return d;
};
async function openWith(page, drawing) {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, drawing }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(drawing)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, drawing });
  await page.goto(`/MODEL.html?level=${SITE}`);
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
}

test('a hologram\'s lot is listed with its box; USE copies it in exactly where it lies, turns its line off, and one UNDO takes it back', async ({ page }) => {
  await openWith(page, withPhase1());
  await page.locator('#lot-pick [data-lot-pick-skip]').click().catch(() => {});
  await expect(box(page)).toBeVisible();
  const row = box(page).locator('[data-reg-site="hologram-1"]');
  await expect(row).toBeChecked();
  await expect(box(page).locator('[data-reg-setback]')).toBeHidden();
  // The hologram's lot line, as the SITE plan paints it, while its box is on.
  const holoInk = () => page.evaluate(() => {
    const c = document.createElement('canvas'); c.width = 400; c.height = 400;
    const ctx = c.getContext('2d');
    window.DraftHologram.paint(ctx, p => ({ x: 200 + p.x, y: 200 + p.z }), globalThis.eval('drawing'), 8, {});
    const px = ctx.getImageData(0, 0, 400, 400).data;
    let n = 0; for (let i = 3; i < px.length; i += 4) if (px[i] > 0) n += 1;
    return n;
  });
  const before = await holoInk();
  expect(before).toBeGreaterThan(100);
  await box(page).locator('[data-reg-use="hologram-1"]').click();
  expect(await holoInk(), 'its line is off: one lot line, not two').toBeLessThan(before * 0.2);
  const own = await page.evaluate(() => globalThis.eval('drawing').outlines.find(o => o.site).points.map(p => [p.x, p.z]));
  expect(own).toEqual([[-25, -142], [35, -142], [35, 31], [-25, 31]]);
  await expect(box(page).locator('[data-reg-site="own"]')).toBeChecked();
  await expect(box(page).locator('[data-reg-site="hologram-1"]')).not.toBeChecked();
  await expect(box(page).locator('[data-reg-setback]')).toBeVisible();
  const lots = await page.evaluate(() => window.DraftHologram.siteLots(globalThis.eval('drawing')).map(l => [l.key, l.shown]));
  expect(lots).toEqual([['own', true], ['hologram-1', false]]);
  await page.locator('#save').click();
  await h.waitForSaved(page);
  expect((await h.savedDrawing(page)).siteLots).toEqual({ own: true, 'hologram-1': false });
  await page.keyboard.press('Control+z');
  expect(await page.evaluate(() => globalThis.eval('drawing').outlines.filter(o => o.site).length)).toBe(0);
});

test('the own box off takes this file\'s lot line off the site plan, the sheet\'s too', async ({ page }) => {
  await open(page, SITE);
  const d = { ...file(), siteLots: { own: false } };
  const drew = saved => page.evaluate(s => window.DraftLayoutPlan.drawSitePlan(
    document.createElement('canvas').getContext('2d'), p => p, s), saved);
  expect(await drew(file())).toBe(true);
  expect(await drew(d)).toBe(false);
});

// "when a user brings in another plan (which also has a site plan and a
// green target) have a button that says ALIGN SITE PLAN GREEN REGISTRATION
// MARKS" -- "and then align those all on that green target if they pick
// that" (Movie, 28 Oct).
test('ALIGN SITE PLAN GREEN REGISTRATION MARKS slides each hologram so its green mark sits on this file\'s; one UNDO', async ({ page }) => {
  const d = withPhase1();
  d.outlines = file().outlines;
  d.holograms.push({ ...d.holograms[0], id: 'hologram-2', name: 'PHASE 0', x: -7, z: 11 });
  await openWith(page, d);
  const align = box(page).locator('[data-reg-align]');
  await expect(align).toBeVisible();
  await expect(align).toHaveText('ALIGN SITE PLAN GREEN REGISTRATION MARKS');
  const greens = () => page.evaluate(() => {
    const dr = globalThis.eval('drawing');
    const LS = window.DraftLotSizes;
    return window.DraftHologram.siteLots(dr).map(l => (l.key === 'own'
      ? LS.siteDatumOf(LS.siteOutlineOf(dr.outlines), 0) : LS.siteDatumOf({ points: l.points }, 0)));
  });
  const before = await greens();
  expect(before[1]).not.toEqual(before[0]);
  const ownWalls = await page.evaluate(() => JSON.stringify(globalThis.eval('drawing').walls));
  await align.click();
  const after = await greens();
  after.slice(1).forEach(g => { expect(g.x).toBeCloseTo(after[0].x, 6); expect(g.z).toBeCloseTo(after[0].z, 6); });
  expect(after[0]).toEqual(before[0]);
  expect(await page.evaluate(() => JSON.stringify(globalThis.eval('drawing').walls)), 'nothing of this file moved').toBe(ownWalls);
  await page.keyboard.press('Control+z');
  expect(await greens()).toEqual(before);
});

test('with no lot of its own, ALIGN lines the holograms up on the checked site plan', async ({ page }) => {
  const d = withPhase1();
  d.holograms.push({ ...d.holograms[0], id: 'hologram-2', name: 'PHASE 0', x: -7, z: 11 });
  d.siteLots = { 'hologram-1': false, 'hologram-2': true };
  await openWith(page, d);
  const p2 = await page.evaluate(() => ({ ...globalThis.eval('drawing').holograms[1] }));
  await box(page).locator('[data-reg-align]').click();
  const hs = await page.evaluate(() => globalThis.eval('drawing').holograms.map(h => [h.x, h.z]));
  expect(hs[1], 'the checked one is the mark, and stays').toEqual([p2.x, p2.z]);
  expect(hs[0]).toEqual([p2.x, p2.z]);
});

// "the suites i don't want aligned that way, so this button should only be
// for some" -- "will need to be in each hologram card actually" -- "add the
// list of hologram TYPES (1 per suite and 1 per phase) and then allow the
// user to checkbox which he wants aligned in addition to be able to do it on
// the card area for the holograms" (Movie, 28 Oct).
const withSuite = () => {
  const d = withPhase1();
  d.outlines = file().outlines;
  const suiteSrc = { ...d.holograms[0].source, suiteKind: 'residential' };
  d.holograms.push({ id: 'suite-1', name: 'SUITE A', mode: 'suite', x: 3, z: 4, angleDeg: 0, pivotX: 0, pivotZ: 0, source: suiteSrc });
  return d;
};
const xz = page => page.evaluate(() => globalThis.eval('drawing').holograms.map(h => [h.id, h.x, h.z]));
test('the TYPES list: a phase box on, a suite box off; ALIGN leaves the suite where it is until its box is on', async ({ page }) => {
  await openWith(page, withSuite());
  await expect(box(page).locator('[data-reg-align-type="PHASE 1"]')).toBeChecked();
  await expect(box(page).locator('[data-reg-align-type="SUITE A"]')).not.toBeChecked();
  const before = await xz(page);
  await box(page).locator('[data-reg-align]').click();
  const once = await xz(page);
  expect(once[0]).not.toEqual(before[0]);
  expect(once[1], 'the suite stays').toEqual(before[1]);
  await box(page).locator('[data-reg-align-type="SUITE A"]').check();
  await box(page).locator('[data-reg-align]').click();
  expect((await xz(page))[1], 'checked, it aligns').not.toEqual(before[1]);
  await page.locator('#save').click();
  await h.waitForSaved(page);
  expect((await h.savedDrawing(page)).alignTypes).toEqual({ 'SUITE A': true });
});

test('a hologram card\'s ALIGN lines up that file alone, box or no box', async ({ page }) => {
  await openWith(page, withSuite());
  const before = await xz(page);
  await page.locator('[data-mode-hologram]').click();
  await page.locator('[data-hologram-align="SUITE A"]').click();
  const after = await xz(page);
  expect(after[1]).not.toEqual(before[1]);
  expect(after[0], 'PHASE 1 untouched').toEqual(before[0]);
});

test('the box sits ON TOP of the open right panel and its tabs, not beside them', async ({ page }) => {
  await openWith(page, withSuite());
  await page.goto(`/MODEL.html?level=${SITE}&right=1&pane=levels`);
  await expect(box(page)).toBeVisible({ timeout: 10000 });
  const r = await box(page).boundingBox();
  const vw = page.viewportSize().width;
  expect(vw - (r.x + r.width), 'in the corner').toBeLessThan(20);
  const top = await page.evaluate(([x, y]) => document.elementFromPoint(x, y)?.closest('#registration') !== null,
    [r.x + r.width - 6, r.y + 6]);
  expect(top, 'nothing over it').toBe(true);
});

// "as a secondary method to align the site plans, can the corners of the
// site plan (and the lower right corner with the green target) all have snap
// nodes on the hologram site plan" (Movie, 28 Oct).
test('on SITE a hologram is picked by its lot line, taken by its green corner, and dropped exactly on this file\'s', async ({ page }) => {
  const d = withPhase1();
  d.outlines = file().outlines;
  Object.assign(d.holograms[0], { x: 40, z: -25 });
  // Its box ticked, so its lot line shows to be taken hold of.
  d.siteLots = { 'hologram-1': true };
  await openWith(page, d);
  await page.keyboard.press('0');
  await page.waitForTimeout(200);
  const { at, scale } = await h.planFrame(page);
  const g = await page.evaluate(() => {
    const dr = globalThis.eval('drawing');
    const LS = window.DraftLotSizes;
    const [own, holo] = window.DraftHologram.siteLots(dr);
    return { own: LS.siteDatumOf(LS.siteOutlineOf(dr.outlines), 0), holo: LS.siteDatumOf({ points: holo.points }, 0),
      edge: holo.points.slice(1, 3) };
  });
  // A click on the hologram's lot line picks the hologram.
  const mid = { x: (g.edge[0].x + g.edge[1].x) / 2, z: (g.edge[0].z + g.edge[1].z) / 2 };
  await page.mouse.click(...at(mid.x, mid.z));
  expect(await page.evaluate(() => selection.map(s => s.type))).toEqual(['hologram']);
  await page.evaluate(() => document.activeElement?.blur?.());
  await page.keyboard.press('m');
  const off = 2 / scale;
  await page.mouse.move(...at(g.holo.x + off, g.holo.z - off), { steps: 3 });
  await page.waitForTimeout(100);
  const grab = JSON.parse(await page.locator('#plan').getAttribute('data-move-grab') || 'null');
  expect(grab, 'the circle is on its green corner').toEqual([Number(g.holo.x.toFixed(4)), Number(g.holo.z.toFixed(4))]);
  await page.mouse.down();
  await page.mouse.move(...at(g.own.x + off, g.own.z + off), { steps: 10 });
  await page.waitForTimeout(100);
  await page.mouse.up();
  await page.waitForTimeout(150);
  const now = await page.evaluate(() => {
    const dr = globalThis.eval('drawing');
    return window.DraftLotSizes.siteDatumOf({ points: window.DraftHologram.siteLots(dr)[1].points }, 0);
  });
  expect(now.x, 'on the green mark, across').toBeCloseTo(g.own.x, 6);
  expect(now.z, 'and down').toBeCloseTo(g.own.z, 6);
});
