// THE LANDSCAPE PROGRAM (jb, 27 Nov 2026) -- landscape/index.html, RUFF
// LANDSCAPE / ROUGH LANDSCAPE, a separate program for grading the lot.
//
// Three promises are held here.
//
// 1. THE 2D DRAFTER NEVER LOADS IT. Like RUFF 3D: deleting landscape/ leaves
//    every 2D page working, because no 2D page asks for anything in it.
// 2. THE HOUSE IS NOT TOUCHED. The program writes the drawing's `landscape`
//    key and nothing else, and the drafter carries that key through its own
//    load and save without reading it.
// 3. THE GRADING ARITHMETIC IS RIGHT: a plane gives the heights a plane
//    gives, the contours fall where they should, and the drainage checks
//    catch ground that runs at the house.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const WITH_LOT = path.join(ROOT, 'proto', 'repro-detached-2storey-frostwall.draft');
const NO_LOT = path.join(ROOT, 'proto', 'repro-L-house.draft');
const TWO_D_PAGES = fs.readdirSync(ROOT).filter(name => name.endsWith('.html')).sort();
const isLandscape = url => /\/landscape\//i.test(url);

test('no 2D page names landscape/ in its source', () => {
  expect(TWO_D_PAGES).toContain('MODEL.html');
  const offenders = TWO_D_PAGES.filter(name => {
    const html = fs.readFileSync(path.join(ROOT, name), 'utf8');
    return /<(script|link)[^>]+(src|href)=["'][^"']*landscape\//i.test(html);
  });
  expect(offenders).toEqual([]);
});

for (const page of ['MODEL.html', 'LAYOUT.html', 'index.html']) {
  test(`${page} loads without asking for any landscape file`, async ({ page: p }) => {
    const asked = [];
    p.on('request', req => { if (isLandscape(req.url())) asked.push(req.url()); });
    await p.goto(`/${page}`);
    await p.waitForLoadState('load');
    expect(asked).toEqual([]);
    expect(await p.evaluate(() => typeof window.DraftGrading)).toBe('undefined');
  });
}

async function openLandscape(p, file) {
  const errors = [];
  p.on('pageerror', e => errors.push(String(e)));
  await p.goto('/landscape/index.html');
  if (file) {
    await p.setInputFiles('#file', file);
    await p.waitForFunction(() => document.body.dataset.loaded === '1');
  }
  return errors;
}

// ── THE ARITHMETIC ───────────────────────────────────────────────────────

test('a plane through four corners: heights, contours and slope are the plane\'s', async ({ page: p }) => {
  await openLandscape(p);
  const got = await p.evaluate(() => {
    const G = window.DraftGrading;
    // y = -0.05 x : falls 5% to the east, flat north-south.
    const pts = [[0, 0], [40, 0], [40, 30], [0, 30], [20, 15]].map(([x, z]) => ({ x, z, y: -0.05 * x }));
    const s = G.buildSurface(pts);
    const lines = G.contours(s, 0.5, 0);
    return {
      tris: s.tris.length,
      mid: G.heightAt(s, { x: 10, z: 7 }),
      off: G.heightAt(s, { x: 50, z: 7 }),
      slopes: s.tris.map(t => Math.round(t.slopePct * 1000) / 1000),
      downs: s.tris.map(t => Math.round(t.down.x * 1000) / 1000),
      levels: lines.map(l => l.shown),
      // Every piece of the -1.00 line stands at x = 20.
      at20: lines.find(l => l.shown === -1).segs.flat().every(q => Math.abs(q.x - 20) < 1e-6),
      majors: lines.filter(l => l.major).map(l => l.shown),
      datum100: G.contours(s, 1, 100).map(l => l.shown),
    };
  });
  expect(got.tris).toBe(4);
  expect(got.mid).toBeCloseTo(-0.5, 6);
  expect(got.off).toBeNull();
  got.slopes.forEach(v => expect(v).toBeCloseTo(5, 3));
  got.downs.forEach(v => expect(v).toBeCloseTo(1, 3));          // downhill is +x
  expect(got.levels).toEqual([-2, -1.5, -1, -0.5, 0]);
  expect(got.at20).toBe(true);
  expect(got.majors).toEqual([0]);                                // every fifth line: 2.5' apart at 6"
  expect(got.datum100).toEqual([98, 99, 100]);                    // shown numbers fall on the datum's feet
});

test('the fall check passes 6" in 10\' away from a house and fails ground running at it', async ({ page: p }) => {
  await openLandscape(p);
  const got = await p.evaluate(() => {
    const G = window.DraftGrading;
    const house = [[{ x: 0, z: 0 }, { x: 20, z: 0 }, { x: 20, z: 20 }, { x: 0, z: 20 }]];
    const lot = [{ x: -40, z: -40 }, { x: 60, z: -40 }, { x: 60, z: 60 }, { x: -40, z: 60 }];
    const corners = house[0].map(q => ({ ...q, y: 0 }));
    const good = G.buildSurface(corners.concat(G.ringSpots(house, lot, 0)).concat(
      lot.map(q => ({ ...q, y: G.defaultCornerHeight(0, G.distToPolys(q, house)) }))), { holes: house });
    // The same, with the lot's east side ABOVE the house: water runs at it.
    const bad = G.buildSurface(corners.concat(lot.map(q => ({ ...q, y: q.x > 30 ? 2 : -2 }))), { holes: house });
    return {
      ring: G.ringSpots(house, lot, 0).length,
      good: G.fallChecks(good, house, lot),
      badFails: G.fallChecks(bad, house, lot).fails.map(f => f.at.x),
      goodSlopes: G.slopeWarnings(good),
    };
  });
  expect(got.ring).toBe(12);                                      // 2 wall ends + a diagonal per corner
  expect(got.good.checked).toBeGreaterThan(10);
  expect(got.good.fails).toEqual([]);
  expect(got.goodSlopes.steep.length + got.goodSlopes.flat.length).toBe(0);
  expect(got.badFails.length).toBeGreaterThan(0);
  expect(got.badFails.some(x => x > 19)).toBe(true);              // the east wall fails
});

test('heights type as decimals or feet and inches', async ({ page: p }) => {
  await openLandscape(p);
  const got = await p.evaluate(() => ['99.5', "100'-6\"", "-1'-2 1/2\"", '6"', '  ', 'abc'].map(window.DraftGrading.parseFeet));
  expect(got[0]).toBe(99.5);
  expect(got[1]).toBeCloseTo(100.5, 6);
  expect(got[2]).toBeCloseTo(-(1 + 2.5 / 12), 6);
  expect(got[3]).toBeCloseTo(0.5, 6);
  expect(got[4]).toBeNull();
  expect(got[5]).toBeNull();
});

// ── THE PAGE ─────────────────────────────────────────────────────────────

test('a drawing with a lot opens graded away from the house, with contours and no warnings', async ({ page: p }) => {
  const errors = await openLandscape(p, WITH_LOT);
  const s = await p.evaluate(() => {
    const st = DraftLandscape.state;
    return {
      lotCorners: st.land.spots.filter(x => x.lotCorner).length,
      spots: st.land.spots.length,
      grade: st.houseGrade,
      house: st.house.length,
      ds: { ...document.body.dataset },
      brand: document.getElementById('brand').textContent,
    };
  });
  expect(errors).toEqual([]);
  expect(s.brand).toBe('RUFF LANDSCAPE');
  expect(s.house).toBe(1);
  expect(s.lotCorners).toBe(4);
  expect(s.spots).toBeGreaterThan(4);
  expect(Number.isFinite(s.grade)).toBe(true);
  expect(Number(s.ds.contours)).toBeGreaterThan(0);
  expect(Number(s.ds.arrows)).toBeGreaterThan(0);
  expect(s.ds.fallFails).toBe('0');
  expect(s.ds.steep).toBe('0');
});

test('the ROUGH skin names it ROUGH LANDSCAPE', async ({ page: p }) => {
  await p.goto('/landscape/index.html?theme=rough');
  await expect(p.locator('#brand')).toHaveText('ROUGH LANDSCAPE');
});

test('a drawing with no lot grades a box round the house and says so', async ({ page: p }) => {
  await openLandscape(p, NO_LOT);
  await expect(p.locator('#status')).toContainText('no lot drawn on SITE');
  const n = await p.evaluate(() => DraftLandscape.state.land.spots.filter(x => x.lotCorner).length);
  expect(n).toBe(4);
});

test('a spot typed above the house warns, UNDO takes it back, and SAVE changes only the landscape', async ({ page: p }) => {
  await openLandscape(p, WITH_LOT);
  // Pick a spot of the ring 10 ft out and raise it a foot over the house.
  const id = await p.evaluate(() => DraftLandscape.state.land.spots.find(x => !x.lotCorner).id);
  await p.evaluate(id => DraftLandscape.pick({ kind: 'spot', id }), id);
  await expect(p.locator('#spot-panel')).toBeVisible();
  const raised = await p.evaluate(() => (DraftLandscape.state.houseGrade + 1).toFixed(2));
  await p.fill('#spot-elev', raised);
  await p.press('#spot-elev', 'Enter');
  await expect.poll(() => p.evaluate(() => Number(document.body.dataset.fallFails))).toBeGreaterThan(0);
  await expect(p.locator('#check-list')).toContainText('does not fall 6"');
  await p.click('#undo');
  await expect.poll(() => p.evaluate(() => document.body.dataset.fallFails)).toBe('0');

  // A new finished spot by clicking the lot, at the ground's own height.
  await p.click('[data-tool="fg"]');
  const before = await p.evaluate(() => DraftLandscape.state.land.spots.length);
  const at = await p.evaluate(() => {
    const st = DraftLandscape.state;
    const lot = st.lot;
    const g = { x: (lot[0].x * 3 + lot[2].x) / 4, z: (lot[0].z + lot[2].z) / 2 };
    const s = DraftLandscape.toS(g);
    const r = document.getElementById('plan').getBoundingClientRect();
    const k = window.devicePixelRatio || 1;
    return { x: r.left + s.x / k, y: r.top + s.y / k };
  });
  await p.mouse.click(at.x, at.y);
  expect(await p.evaluate(() => DraftLandscape.state.land.spots.length)).toBe(before + 1);
  await expect(p.locator('#spot-title')).toHaveText('FINISHED SPOT');

  const original = JSON.parse(fs.readFileSync(WITH_LOT, 'utf8'));
  const written = JSON.parse(await p.evaluate(() => DraftLandscape.fileText()));
  const { landscape, ...rest } = written;
  expect(rest).toEqual(original);
  expect(landscape.spots.length).toBe(before + 1);
  expect(landscape.version).toBe(1);
});

test('OPEN LANDSCAPE on the drafter: the grading comes back and survives the drafter\'s own saves', async ({ page: p }) => {
  const h = require('./helpers');
  await h.openModel(p);
  await h.selectTool(p, 'Outline');
  for (const [x, z] of [[-12, -9], [12, -9], [12, 9], [-12, 9]]) await h.clickWorld(p, x, z);
  await p.keyboard.press('Enter');
  await h.waitForSaved(p);
  await h.climbTourToMain(p);
  await p.locator('[data-build-house]').click();
  await h.waitForSaved(p);
  await p.goto('/MODEL.html?right=1&left=1&level=3');
  const chip = p.locator('#strip-landscape');
  await expect(chip).toBeVisible();
  // Stacked over OPEN IN 3D, the same size.
  const [land, cube] = await Promise.all([chip.boundingBox(), p.locator('#strip-3d').boundingBox()]);
  expect(Math.abs(land.x - cube.x)).toBeLessThanOrEqual(1);
  expect(land.y + land.height).toBeLessThanOrEqual(cube.y);
  expect(Math.abs(land.width - cube.width)).toBeLessThanOrEqual(1);
  expect(await p.evaluate(() => typeof window.DraftGrading)).toBe('undefined');

  const [tab] = await Promise.all([p.waitForEvent('popup'), chip.click()]);
  await tab.waitForLoadState('domcontentloaded');
  await tab.waitForFunction(() => document.body.dataset.loaded === '1', null, { timeout: 15000 });
  expect(await tab.evaluate(() => DraftLandscape.state.house.length)).toBeGreaterThanOrEqual(1);
  // A new drawing's starting grading is handed back at once, and the
  // drafter's page is UNSAVED: its own SAVE keeps it.
  await expect.poll(() => p.evaluate(() => drawing.landscape?.spots?.length || 0), { timeout: 8000 }).toBeGreaterThan(0);
  expect(await p.evaluate(() => document.body.dataset.saveDirty)).toBe('1');
  // Then a typed height.
  await tab.evaluate(() => DraftLandscape.pick({ kind: 'spot', id: DraftLandscape.state.land.spots[0].id }));
  await tab.fill('#spot-elev', '-7.25');
  await tab.press('#spot-elev', 'Enter');
  await expect.poll(() => p.evaluate(() => drawing.landscape.spots[0].y), { timeout: 8000 }).toBe(-7.25);
  await tab.close();
  await p.locator('#save').click();
  await h.waitForSaved(p);
  expect((await h.savedDrawing(p)).landscape.spots[0].y).toBe(-7.25);

  // The drafter reopens the drawing (the key rides through its load) and
  // turns the house: the grading's spots turn with it, heights unchanged,
  // and the drafter's own SAVE keeps them.
  await p.goto('/MODEL.html?right=1&left=1&level=3');
  await expect(chip).toBeVisible();
  const kept = await p.evaluate(() => drawing.landscape);
  expect(kept.spots[0].y).toBe(-7.25);
  await p.locator('#strip-rotate').click();
  await p.locator('#save').click();
  await h.waitForSaved(p);
  const after = (await h.savedDrawing(p)).landscape;
  expect(after.spots.map(x => x.y)).toEqual(kept.spots.map(x => x.y));
  expect(after.spots.some((x, i) => Math.abs(x.x - kept.spots[i].x) > 0.5 || Math.abs(x.z - kept.spots[i].z) > 0.5)).toBe(true);
  expect(after.houseCorners).toEqual(kept.houseCorners);
});

test('the entry page links it under REFERENCES, below INTERNET LINKS and above RUFF 3D, named by the skin', async ({ page: p }) => {
  await p.goto('/index.html');
  const link = p.locator('a[data-landscape-link]');
  await expect(link).toHaveText('RUFF LANDSCAPE');
  await expect(link).toHaveAttribute('href', 'landscape/');
  const [land, links, three] = await Promise.all([link.boundingBox(),
    p.locator('a[href="LINKS.html"]').boundingBox(), p.locator('a[data-viewer-link]').boundingBox()]);
  expect(land.y).toBeGreaterThanOrEqual(links.y + links.height - 1);
  expect(land.y + land.height).toBeLessThanOrEqual(three.y);
  expect(Math.abs((land.x + land.width / 2) - (links.x + links.width / 2))).toBeLessThanOrEqual(2);
  // The page still does not scroll to show a way in.
  expect(await p.evaluate(() => document.documentElement.scrollHeight <= window.innerHeight + 1)).toBe(true);
  await p.evaluate(() => localStorage.setItem('draft-skin', JSON.stringify({ theme: 'rough' })));
  await p.reload();
  await expect(link).toHaveText('ROUGH LANDSCAPE');
  await link.click();
  await expect(p.locator('#brand')).toHaveText('ROUGH LANDSCAPE');
});
