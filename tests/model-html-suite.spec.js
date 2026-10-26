// SUITES ON A SHELL (Movie, 18 Oct).
//
// "this is the outer building SHELL - i will start to create the SUITES, that
// i will save as DRAFT file and we will bring in as a HOLOGRAM" -- "can we
// have an option where it is shaded the normal colors but NOT editable from
// the 'SHELL BUILDING' file except to MOVE, COPY or FLIP etc" -- "CUT THE
// HOLES for the WINDOWS in the SUITES in the proper locations on the SHELL"
// -- "as long as it will look normal without having the 2 walls overlapping"
// -- "when they go close to lining them up it snaps".
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const W = (id, a, b, extra = {}) => ({ id, levelId: 3, view: 'plan', wallType: 'stud_2x6', refLine: 'center',
  baseHeight: 0, topHeight: 9, start: { x: a[0], y: 0, z: a[1] }, end: { x: b[0], y: 0, z: b[1] }, ...extra });
const WIN = (id, wallId, offset, width = 4) => ({ id, wallId, levelId: 3, view: 'plan', type: 'window',
  offset, width, sillHeight: 3, headHeight: 6.67 });
const LEVELS = [{ id: 8, name: 'SITE', elev: 0 }, { id: 7, name: 'ROOF', elev: 9 },
  { id: 3, name: 'MAIN FL', elev: 0 }, { id: 1, name: 'FOUNDATION', elev: -8 }];
const EMPTY = { walls: [], lines: [], floors: [], roofs: [], fenestrations: [], dimensions: [],
  outlines: [], shapes: [], surfaceOpenings: [], stairs: [], notes: [], roomTags: [], columns: [],
  beams: [], boneyardOutlines: [], groups: [], levelLocks: [], underlays: [] };
// A 20 x 15 suite in the corner of a 60 x 30 shell: its bottom and left
// walls lie in the shell's, and one window on its bottom wall.
const SUITE = { version: 1, levels: LEVELS, activeLevelIdx: 2, ...EMPTY,
  walls: [W('s1', [0, 0], [20, 0]), W('s2', [20, 0], [20, 15]), W('s3', [20, 15], [0, 15]), W('s4', [0, 15], [0, 0])],
  fenestrations: [WIN('w1', 's1', 8), WIN('w2', 's2', 5)] };
const shell = (holo = {}, fens = []) => ({ version: 1, board: 'drafting', planTurn: 0, levels: LEVELS,
  activeLevelIdx: 2, ...EMPTY,
  walls: [W('a', [0, 0], [60, 0]), W('b', [60, 0], [60, 30]), W('c', [60, 30], [0, 30]), W('d', [0, 30], [0, 0])],
  fenestrations: [WIN('pub', 'a', 40), ...fens],
  holograms: [{ id: 'h1', name: 'suite-a', mode: 'suite', x: 0, z: 0, angleDeg: 0, pivotX: 10, pivotZ: 7.5,
    source: SUITE, ...holo }] });

async function open(page, drawing) {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, f }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, f: drawing });
  await page.goto('/MODEL.html?level=3');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
}
const saved = async page => {
  await page.locator('#save').click();
  await h.waitForSaved(page);
  return h.savedDrawing(page);
};
// What the shell's walls carry from the suites, off the drawing as saved.
const hostOpenings = (page, d) => page.evaluate(d => window.DraftHologram.hostOpenings(d)
  .map(o => [o.wallId, Math.round(o.offset * 100) / 100, o.width, o.id]), d);

test('a SUITE keeps its mode through a save, and its shared wall hands its window to the shell wall', async ({ page }) => {
  await open(page, shell());
  const d = await saved(page);
  expect(d.holograms[0].mode).toBe('suite');
  // w1 (8' along the suite's bottom wall) lands 8' along the shell's bottom
  // wall; w2 is on an inside wall and stays the suite's own.
  expect(await hostOpenings(page, d)).toEqual([['a', 8, 4, 'h1:w1']]);
  // The suite's copies of the two shared walls are not drawn.
  const hidden = await page.evaluate(d => [...(window.DraftHologram.shared(d).hidden.get('h1') || [])].sort(), d);
  expect(hidden).toEqual(['s1', 's4']);
});

test('moved, turned over, the window follows: a mirrored suite in the far corner', async ({ page }) => {
  // Mirrored about its own middle and slid 40' along: the suite's bottom
  // wall still lies in the shell's, from x = 40 to 60, and w1 (centred 8'
  // from the suite's left -- an offset is an opening's MIDDLE) is now centred
  // 8' from its RIGHT: 52' along the shell.
  await open(page, shell({ flip: true, x: 40 }));
  const d = await saved(page);
  expect(await hostOpenings(page, d)).toEqual([['a', 52, 4, 'h1:w1']]);
  // A quarter turn off the walls' line shares nothing.
  expect(await hostOpenings(page, { ...d, holograms: [{ ...d.holograms[0], angleDeg: 45 }] })).toEqual([]);
});

// A FOOT PAST THE CORNER STILL CUTS (Movie, 20 Oct: "if i go past the corner
// a bit it doesn't allow to switch the windows, can we allow it to change the
// windows even if its up to 1ft off (not alligned) at the sides"). Slid 7"
// left, the suite's bottom wall runs 7" past the shell's corner, faces still
// lined up: the window still goes into the shell wall, 7" further along.
// Past a foot, it does not.
test('a suite wall running up to a foot past the shell corner still hands over its window', async ({ page }) => {
  await open(page, shell({ x: -0.6 }));
  const d = await saved(page);
  expect(await hostOpenings(page, d)).toEqual([['a', 7.4, 4, 'h1:w1']]);
  expect(await hostOpenings(page, { ...d, holograms: [{ ...d.holograms[0], x: -1.5 }] }), 'a foot and a half is too far')
    .toEqual([]);
  // AND THE FAR END TOO: 9" past the shell's right corner.
  expect(await hostOpenings(page, { ...d, holograms: [{ ...d.holograms[0], x: 40.75 }] }))
    .toEqual([['a', 48.75, 4, 'h1:w1']]);
});

test('a suite wall that does not line up face for face shares nothing', async ({ page }) => {
  await open(page, shell({ z: 0.25 }));
  const d = await saved(page);
  expect(await hostOpenings(page, d)).toEqual([]);
  // A thinner suite wall with its OUTSIDE face on the shell's outside face
  // -- one face lined up, the other an inch and a half short -- is not the
  // shell's either: both faces, or nothing.
  const thin = JSON.parse(JSON.stringify(d));
  const [t6, t4] = await page.evaluate(() => ['stud_2x6', 'stud_2x4']
    .map(id => window.DraftWallTypes.WALL_TYPES.find(t => t.id === id).totalIn / 12));
  thin.holograms[0].z = -(t6 - t4) / 2;
  thin.holograms[0].source.walls[0].wallType = 'stud_2x4';
  expect(await hostOpenings(page, thin)).toEqual([]);
});

// THREE INCHES now (Movie, 26 Oct, the one snap rule: "both at 3"").
test('a suite dragged within 3" of lining up snaps onto the shell, both ways in a corner', async ({ page }) => {
  await open(page, shell({ x: 0.1, z: -0.15 }));
  const d = await saved(page);
  const got = await page.evaluate(d => window.DraftHologram.suiteSnap(d, d.holograms[0], 3, 0.25), d);
  expect(got.x).toBeCloseTo(-0.1, 6);
  expect(got.z).toBeCloseTo(0.15, 6);
  // Out of reach, nothing.
  const far = await page.evaluate(d => window.DraftHologram.suiteSnap(d,
    { ...d.holograms[0], x: 2, z: 2 }, 3, 0.25), d);
  expect([far.x, far.z]).toEqual([0, 0]);
  // And MOVE on the card drags it there.
  await page.locator('[data-mode-hologram]').click();
  await page.locator('#hologram-ask [data-hologram-move="h1"]').click();
  const { at } = await h.planFrame(page);
  await page.mouse.move(...at(10, 7.5));
  await page.mouse.down();
  await page.mouse.move(...at(10.1, 7.6), { steps: 4 });
  await page.mouse.up();
  const after = (await saved(page)).holograms[0];
  expect(after.x).toBeCloseTo(0, 6);
  expect(after.z).toBeCloseTo(0, 6);
});

test('the HOLOGRAM chip lists what is loaded; a SUITE row has no DEMO and switches back to HOLOGRAM', async ({ page }) => {
  await open(page, shell());
  const chip = page.locator('[data-mode-hologram]');
  await expect(chip).toHaveClass(/lit/);
  await chip.click();
  const card = page.locator('#hologram-ask');
  await expect(card).toBeVisible();
  // ONE CARD PER FILE (Movie, 20 Oct): the file's name on its card, the copy
  // a numbered row under it.
  await expect(card.locator('[data-hologram-file-card="suite-a"] [data-hologram-name]')).toHaveText('suite-a');
  await expect(card.locator('[data-hologram-row="h1"]')).toContainText('#1');
  await expect(card.locator('[data-hologram-mode="h1"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(card.locator('[data-hologram-demo="h1"]')).toHaveCount(0);
  await expect(card.locator('[data-hologram-move="h1"]')).toBeVisible();
  await expect(card.locator('[data-hologram-mirror="h1"]')).toBeVisible();
  await expect(card.locator('[data-hologram-copy="h1"]')).toBeVisible();
  await card.locator('[data-hologram-mode="h1"]').click();
  await expect(card.locator('[data-hologram-demo="h1"]')).toBeVisible();
  await card.locator('[data-hologram-close]').click();
  expect((await saved(page)).holograms[0].mode).toBeUndefined();
});

test('a suite draws in the normal colours, not the hologram blue', async ({ page }) => {
  const blue = () => page.evaluate(holo => {
    const c = document.getElementById('plan');
    const r = c.getBoundingClientRect(), k = c.width / r.width;
    const data = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    // NOT THE CORNER RINGS. A suite's four corners carry super node rings
    // since 20 Oct, and since 23 Oct the rings wear the file's own colour --
    // this suite's is the blue -- so the pixels within a ring's reach of a
    // corner are left out: the question here is the WALLS.
    const [cx, cz, scale] = String(c.dataset.view || '').trim().split(/\s+/).map(Number);
    const corners = (window.DraftHologram.suiteSuperNodes(holo, 3) || []).map(n => ({
      x: (r.width / 2 + (n.point.x - cx) * scale) * k, y: (r.height / 2 + (n.point.z - cz) * scale) * k }));
    const reach = 14 * k;
    // AND NOT ITS END LINES (Movie, 25 Oct): the rings gave way to a line on
    // each end of the suite, 2 ft past its corners, in the same colour.
    const toPx = p => ({ x: (r.width / 2 + (p.x - cx) * scale) * k, y: (r.height / 2 + (p.z - cz) * scale) * k });
    const ends = (window.DraftHologram.suiteEndLines?.(holo, 3) || []).map(L => [toPx(L.ea), toPx(L.eb)]);
    const nearSeg = (x, y, [a, b]) => {
      const dx = b.x - a.x, dy = b.y - a.y;
      const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / (dx * dx + dy * dy || 1)));
      return Math.hypot(x - (a.x + t * dx), y - (a.y + t * dy)) <= 10 * k;
    };
    const onRing = (x, y) => corners.some(q => Math.hypot(q.x - x, q.y - y) <= reach)
      || ends.some(seg => nearSeg(x, y, seg));
    let n = 0;
    // THE HOLOGRAM'S BLUE, not the turquoise of a super node ring: blue well
    // above green.
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 2] > 150 && data[i + 2] - data[i] > 50 && data[i + 2] - data[i + 1] > 30
        && !onRing((i / 4) % c.width, Math.floor(i / 4 / c.width))) n += 1;
    }
    return n;
  }, shell().holograms[0]);
  // Light pixels: the suite's walls in the night page's light ink.
  const light = () => page.evaluate(() => {
    const c = document.getElementById('plan');
    const data = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    let n = 0;
    for (let i = 0; i < data.length; i += 4) if (data[i] > 200 && data[i + 1] > 200 && data[i + 2] > 200) n += 1;
    return n;
  });
  await open(page, shell({ hidden: true }));
  await page.keyboard.press('0');
  await page.waitForTimeout(200);
  const without = await light();
  await open(page, shell());
  await page.keyboard.press('0');
  await page.waitForTimeout(200);
  expect(await blue()).toBeLessThan(50);
  // DRAWN, not merely not blue.
  expect(await light()).toBeGreaterThan(without + 500);
  await open(page, shell({ mode: undefined }));
  await page.keyboard.press('0');
  await page.waitForTimeout(200);
  expect(await blue()).toBeGreaterThan(500);
});

test('a shell window where a suite window lands: both drawn, and the card warns', async ({ page }) => {
  await open(page, shell({}, [WIN('clash', 'a', 9)]));
  const d = await saved(page);
  expect(await page.evaluate(d => window.DraftHologram.clashes(d).length, d)).toBe(1);
  await page.locator('[data-mode-hologram]').click();
  await expect(page.locator('#hologram-ask [data-hologram-count]')).toContainText('1 window clash');
});

test('the elevations and sheets read the suite windows on the shell', async ({ page }) => {
  await open(page, shell());
  const d = await saved(page);
  const fens = await page.evaluate(d => window.DraftCutViewEnv.buildCutViewEnv(d,
    window.DraftDrawingFormat.levels(d.levels)).fenestrations().map(o => o.id).sort(), d);
  expect(fens).toEqual(['h1:w1', 'pub']);
});

// ── FLOOR TO FLOOR (Movie, 18 Oct: "we might want the same suite on different
// floors" -- "make the ability to copy the suite floor to floor easily and
// match up") ─────────────────────────────────────────────────────────────
const LEVELS3 = [{ id: 8, name: 'SITE', elev: 0 }, { id: 7, name: 'ROOF', elev: 27 },
  { id: 9, name: '3RD FL', elev: 18 }, { id: 5, name: '2ND FL', elev: 9 }, { id: 3, name: 'MAIN FL', elev: 0 },
  { id: 1, name: 'FOUNDATION', elev: -8 }];
const ring = (levelId, tag) => [W(`a${tag}`, [0, 0], [60, 0], { levelId }), W(`b${tag}`, [60, 0], [60, 30], { levelId }),
  W(`c${tag}`, [60, 30], [0, 30], { levelId }), W(`d${tag}`, [0, 30], [0, 0], { levelId })];
const shell3 = (source = SUITE) => ({ version: 1, board: 'drafting', planTurn: 0, levels: LEVELS3, activeLevelIdx: 4,
  ...EMPTY, walls: [...ring(3, ''), ...ring(5, '2'), ...ring(9, '3')], fenestrations: [],
  // The suite file is the usual template: an empty 2ND FL rides along.
  holograms: [{ id: 'h1', name: 'suite-a', mode: 'suite', x: 0, z: 0, angleDeg: 0, pivotX: 10, pivotZ: 7.5,
    source: { ...source, levels: SUITE_LEVELS } }] });
const SUITE_LEVELS = [{ id: 8, name: 'SITE', elev: 0 }, { id: 7, name: 'ROOF', elev: 18 },
  { id: 5, name: '2ND FL', elev: 9 }, { id: 3, name: 'MAIN FL', elev: 0 }, { id: 1, name: 'FOUNDATION', elev: -8 }];
const row = (page, id) => page.locator(`#hologram-ask [data-hologram-row="${id}"]`);

test('COPY up puts the suite on the next floor, lined up, its windows in that floor\'s shell wall', async ({ page }) => {
  await open(page, shell3());
  await page.locator('[data-mode-hologram]').click();
  await expect(row(page, 'h1').locator('[data-hologram-floor]')).toContainText('MAIN FL');
  await row(page, 'h1').locator('[data-hologram-copy-up]').click();
  await row(page, 'h1').locator('[data-hologram-copy-up]').click();
  await page.locator('[data-hologram-close]').click();
  const d = await saved(page);
  expect(d.holograms.map(h => [h.levelMap || null, h.x, h.z, h.mode])).toEqual([
    [null, 0, 0, 'suite'], [{ 3: 5 }, 0, 0, 'suite'], [{ 3: 5 }, 0, 0, 'suite']]);
  // One window on each copy's floor: the 2ND FL's wall gets two (two copies
  // pressed from the MAIN FL one land on the same floor -- and clash).
  const got = (await hostOpenings(page, d)).map(([wall, at]) => [wall, at]);
  expect(got).toEqual([['a', 8], ['a2', 8], ['a2', 8]]);
});

test('FLOOR up and down move a suite where it stands; past the top it stays', async ({ page }) => {
  await open(page, shell3());
  await page.locator('[data-mode-hologram]').click();
  const up = row(page, 'h1').locator('[data-hologram-floor-up]');
  await up.click();
  await expect(row(page, 'h1').locator('[data-hologram-floor]')).toContainText('2ND FL');
  await up.click();
  await expect(row(page, 'h1').locator('[data-hologram-floor]')).toContainText('3RD FL');
  await up.click();
  await expect(row(page, 'h1').locator('[data-hologram-floor]')).toContainText('3RD FL');
  await expect(page.locator('#strip-message')).toContainText('no floor above');
  await page.locator('[data-hologram-close]').click();
  let d = await saved(page);
  expect(d.holograms[0].levelMap).toEqual({ 3: 9 });
  expect((await hostOpenings(page, d)).map(([wall]) => wall)).toEqual(['a3']);
  // And the elevation stands it on the 3RD FL's opening list.
  const lv = await page.evaluate(d => window.DraftCutViewEnv.buildCutViewEnv(d,
    window.DraftDrawingFormat.levels(d.levels)).fenestrations().map(o => o.levelId), d);
  expect(lv).toEqual([9]);
  // Down twice is back where it was drawn: no map at all.
  await page.locator('[data-mode-hologram]').click();
  await row(page, 'h1').locator('[data-hologram-floor-down]').click();
  await row(page, 'h1').locator('[data-hologram-floor-down]').click();
  await page.locator('[data-hologram-close]').click();
  d = await saved(page);
  expect(d.holograms[0].levelMap).toBeUndefined();
});

test('a two-storey suite moves as one: its upper floor takes the next floor of the shell', async ({ page }) => {
  const TWO = { ...SUITE, walls: [...SUITE.walls, W('u1', [0, 0], [20, 0], { levelId: 5 }), W('u2', [20, 0], [20, 15], { levelId: 5 })],
    fenestrations: [...SUITE.fenestrations, { ...WIN('wu', 'u1', 2), levelId: 5 }] };
  await open(page, shell3(TWO));
  await page.locator('[data-mode-hologram]').click();
  await row(page, 'h1').locator('[data-hologram-floor-up]').click();
  await row(page, 'h1').locator('[data-hologram-floor-up]').click();   // no room for its upper floor
  await page.locator('[data-hologram-close]').click();
  const d = await saved(page);
  expect(d.holograms[0].levelMap).toEqual({ 3: 5, 5: 9 });
  expect((await hostOpenings(page, d)).map(([wall, at]) => [wall, at]).sort()).toEqual([['a2', 8], ['a3', 2]]);
});

// A DOUBLE-CLICK ON IT OPENS ITS CARD (Movie, 18 Oct: "when a user double
// clicks on a HOLOGRAM can you bring up this menu for him make it easier").
test('a double-click on a hologram opens the HOLOGRAM card; off it, nothing', async ({ page }) => {
  await open(page, shell());
  await page.keyboard.press('0');
  await page.waitForTimeout(200);
  const { at } = await h.planFrame(page);
  await page.mouse.dblclick(...at(40, 20));
  await page.waitForTimeout(150);
  await expect(page.locator('#hologram-ask')).toBeHidden();
  await page.mouse.dblclick(...at(10, 7));
  await page.waitForTimeout(150);
  await expect(page.locator('#hologram-ask')).toBeVisible();
  await expect(page.locator('#hologram-ask [data-hologram-row="h1"]')).toBeVisible();
});

// WHILE IT IS DRAGGED (Movie, 18 Oct: "the wall alignement snap should light
// up the walls when they are close enough for auto snap allignment and then
// show where the windows ard doors are").
const accentPixels = page => page.evaluate(() => {
  const c = document.getElementById('plan');
  const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
  let n = 0;
  for (let i = 0; i < d.length; i += 4) {
    if (Math.max(d[i], d[i + 1], d[i + 2]) - Math.min(d[i], d[i + 1], d[i + 2]) > 90 && d[i] > 150) n += 1;
  }
  return n;
});
async function holdSuite(page, from, to) {
  await page.locator('[data-mode-hologram]').click();
  await page.locator('#hologram-ask [data-hologram-move="h1"]').click();
  const { at } = await h.planFrame(page);
  await page.mouse.move(...at(...from));
  await page.mouse.down();
  await page.mouse.move(...at(...to), { steps: 4 });
  await page.waitForTimeout(150);
}
test('a suite in hand lights the shell wall it lines up with, and the window it will cut', async ({ page }) => {
  await open(page, shell({ z: 3 }));
  await page.keyboard.press('0');
  await page.waitForTimeout(200);
  const before = await accentPixels(page);
  await holdSuite(page, [10, 10], [10, 7.1]);      // 3' up, inside the snap: lined up
  const during = await accentPixels(page);
  expect(during, 'the lit wall and the window it will cut').toBeGreaterThan(before + 300);
  await page.mouse.up();
});
test('a suite wall that is not the shell wall\'s thickness is told so', async ({ page }) => {
  const thin = JSON.parse(JSON.stringify(SUITE));
  thin.walls.forEach(w => { w.wallType = 'stud_2x4'; });
  await open(page, shell({ z: 3, source: thin }));
  await page.keyboard.press('0');
  await page.waitForTimeout(200);
  await holdSuite(page, [10, 10], [10, 7.1]);
  await expect(page.locator('#strip-message')).toContainText('both faces have to line up');
  await page.mouse.up();
});
test('a blue hologram lined up with the shell says to make it a SUITE to snap and cut', async ({ page }) => {
  await open(page, shell({ z: 3, mode: undefined }));
  await page.keyboard.press('0');
  await page.waitForTimeout(200);
  await holdSuite(page, [10, 10], [10, 7.1]);
  await expect(page.locator('#strip-message')).toContainText('Set it to SUITE');
  await page.mouse.up();
});

// A SHELL'S SUITES COME WITH IT INTO THE NEXT PHASE (Movie, 18 Oct: "i put a
// HOLOGRAM of SUITE S into the PHASE 1, and then i saved it and i loaded the
// PHASE 1 into PHASE 2 and the SUITE HOLOGRAMS didn't show. we need those to
// also show as part of the PHASE 1 hologram").
test('PHASE 1 brought in as a hologram draws its suites, their windows in its shell, where PHASE 1 put them', async ({ page }) => {
  const phase1 = shell({ x: 0, z: 0 });
  const phase2 = { version: 1, board: 'drafting', planTurn: 0, levels: LEVELS, activeLevelIdx: 2, ...EMPTY,
    holograms: [{ id: 'p1', name: 'PHASE 1', x: 100, z: 0, angleDeg: 0, pivotX: 30, pivotZ: 15, source: phase1 }] };
  await open(page, phase2);
  const got = await page.evaluate(async bucket => {
    const file = await window.SharedFileStore.loadSharedFile(bucket);
    const d = JSON.parse(await file.text());
    const list = window.DraftHologram.drawn(d);
    const F = window.DraftDrawingFormat;
    return {
      kept: (d.holograms[0].source.holograms || []).map(h => h.id),
      ids: list.map(h => h.id),
      shellWindows: (list[0].source.fenestrations || []).map(o => `${o.wallId}:${o.offset}`),
      suiteWalls: (list[1]?.source.walls || []).map(w => {
        const p = F.hologramPoint(list[1], w.start);
        return `${w.id}@${Math.round(p.x)},${Math.round(p.z)}`;
      }).sort(),
    };
  }, BUCKET);
  // KEPT IN THE FILE, then drawn as part of PHASE 1.
  expect(got.kept).toEqual(['h1']);
  expect(got.ids).toEqual(['p1', 'p1/h1']);
  // THE SHELL WEARS THE SUITE'S WINDOW at 8' along its front wall, beside
  // its own.
  expect(got.shellWindows).toEqual(expect.arrayContaining(['a:40', 'a:8']));
  // THE SUITE WALLS THAT ARE THE SHELL'S ARE LEFT OUT; the other two stand
  // where PHASE 1 put them, moved 100' with it.
  expect(got.suiteWalls).toEqual(['s2@120,0', 's3@120,15']);
});
