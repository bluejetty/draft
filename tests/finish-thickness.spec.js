// FINISH THICKNESS AND TEXTURE (jb, 27 Nov 2026), step 1 of 3.
//
// jb: *"sometimes some finishes have different thicknesses. once its drawn
// (flush) on the EXT FINISH plan can it be shown on the ELEVATION /
// Construction layouts and 3D with a thicker finish like BRICK would be few
// inches thicker than siding"*, and then: *"add a section in the OBJ PROP to
// allow the user to change the thickness and texture. but place the textures
// and thicknesses to appropriate thickness and texture"*.
//
// Step 1 is the record, the section that edits it, and the 3D:
//
// - Every finish starts at its catalogue row (wall-types.js): brick 4 5/8"
//   (3 5/8" brick on a 1" air gap), stone 2", shake 1", siding and stucco
//   1/2". A drawing keeps only what the drafter CHANGED, per finish, for the
//   whole house (`drawing.finishSettings`), so a file nobody touched gains no
//   key.
// - The section is on the EXT. FINISH panel for the picked wall and in
//   MODEL's wall properties (the same box OBJ / PROP shows).
// - In 3D the finish is a SKIN standing its thickness OUT from the wall: the
//   framing stays where it was drawn, the brick band is a slab proud of the
//   siding above it.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const ROOT = path.join(__dirname, '..');
const REPRO = JSON.parse(fs.readFileSync(path.join(ROOT, 'proto', 'repro-garage-house.draft'), 'utf8'));
const HOUSE = JSON.parse(fs.readFileSync(path.join(ROOT, 'proto', 'repro-movie-2storey-garage.draft'), 'utf8'));

const seed = (page, saved) => page.evaluate(async ({ bucket, saved: s }) => {
  await window.SharedFileStore.saveSharedFile(
    new File([JSON.stringify(s)], 'drawing.json', { type: 'application/json' }), bucket);
}, { bucket: BUCKET, saved });
const stored = page => page.evaluate(async bucket => {
  const file = await window.SharedFileStore.loadSharedFile(bucket);
  return JSON.parse(await file.text());
}, BUCKET);

// ── THE RECORD ─────────────────────────────────────────────────────────
test('the catalogue gives each finish its own thickness, and a house may change it', async ({ page }) => {
  await page.goto('/EXTFINISH.html');
  await page.waitForFunction(() => !!window.DraftWallTypes);
  const r = await page.evaluate(() => {
    const WT = window.DraftWallTypes;
    const th = id => WT.finishById(id).thicknessIn;
    const before = { brick: th('brick'), ledgestone: th('ledgestone'), shake: th('shake'),
      siding_h: th('siding_h'), stucco: th('stucco') };
    const house = { finishSettings: { brick: { thicknessIn: 3.625, params: { jointIn: 0.5 } } } };
    WT.adoptFinishSettings(house);
    const brick = WT.finishById('brick');
    const after = { th: brick.thicknessIn, joint: brick.params.find(p => p.key === 'jointIn').in,
      long: brick.params.find(p => p.key === 'brickLongIn').in, stucco: th('stucco') };
    // Held BY REFERENCE: an edit in place is read on the next ask.
    house.finishSettings.brick = { thicknessIn: 2 };
    const live = th('brick');
    // A record keeps departures only: the default typed back stores nothing.
    const same = WT.finishSettingRecord('brick', { thicknessIn: 4.625, params: { jointIn: 0.375 } });
    const junk = WT.normalizeFinishSettings({ brick: { thicknessIn: -1 }, nope: { thicknessIn: 2 }, siding_v: { thicknessIn: 0.75 } });
    WT.adoptFinishSettings({});
    return { before, after, live, same, junk, reset: th('brick') };
  });
  expect(r.before).toEqual({ brick: 4.625, ledgestone: 2, shake: 1, siding_h: 0.5, stucco: 0.5 });
  expect(r.after).toEqual({ th: 3.625, joint: 0.5, long: 7.625, stucco: 0.5 });
  expect(r.live).toBe(2);
  expect(r.same, 'the default stored back is no record at all').toBeNull();
  expect(r.junk, 'a negative thickness and an unknown finish are refused; a retired id is mapped')
    .toEqual({ siding_v_bb: { thicknessIn: 0.75 } });
  expect(r.reset, 'a drawing with no settings is the catalogue again').toBe(4.625);
});

// ── EXT. FINISH ───────────────────────────────────────────────────────
test('EXT. FINISH shows the picked wall\'s finishes with their thickness and texture, and stores a change', async ({ page }) => {
  await h.suppressEntryCoach(page);
  await page.goto('/EXTFINISH.html');
  await page.waitForFunction(() => !!window.SharedFileStore, null, { timeout: 10000 });
  await seed(page, REPRO);
  await page.goto('/EXTFINISH.html');
  await page.waitForSelector('#elev-list [data-elev]', { timeout: 10000 });
  const box = await page.locator('#elev').boundingBox();
  await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.6);
  await expect(page.locator('#wall-props')).toBeVisible();
  await page.locator('#band-finish').selectOption('brick');
  await page.locator('#band-add').click();

  const brick = page.locator('#finish-settings-box [data-finish-set="brick"]');
  await expect(brick).toBeVisible();
  await expect(brick.locator('[data-fin-thick]')).toHaveValue('4 5/8"');
  await expect(brick.locator('[data-fin-param="brickLongIn"]')).toHaveValue('7 5/8"');
  await expect(brick.locator('[data-fin-texture]')).toBeChecked();
  // The base finish is there too (stucco until clad), with no texture tick:
  // a blank finish has nothing to paint.
  await expect(page.locator('#finish-settings-box [data-finish-set="stucco"] [data-fin-texture]')).toHaveCount(0);

  await brick.locator('[data-fin-thick]').fill('3 5/8');
  await brick.locator('[data-fin-thick]').press('Enter');
  await page.waitForFunction(async bucket => {
    const s = JSON.parse(await (await window.SharedFileStore.loadSharedFile(bucket)).text());
    return s.finishSettings?.brick?.thicknessIn === 3.625;
  }, BUCKET, { timeout: 5000 });
  await expect(brick.locator('.finish-set-default').first()).toContainText('default 4 5/8"');

  await brick.locator('[data-fin-texture]').uncheck();
  await brick.locator('[data-fin-param="jointIn"]').fill('1/2');
  await brick.locator('[data-fin-param="jointIn"]').press('Enter');
  await page.waitForFunction(async bucket => {
    const s = JSON.parse(await (await window.SharedFileStore.loadSharedFile(bucket)).text());
    return s.finishSettings?.brick?.params?.jointIn === 0.5 && s.finishSettings.brick.texture === false;
  }, BUCKET, { timeout: 5000 });
  expect((await stored(page)).walls.length, 'the walls went back with it').toBe(REPRO.walls.length);

  // A nonsense number is refused and explained, not stored.
  await brick.locator('[data-fin-thick]').fill('lots');
  await brick.locator('[data-fin-thick]').press('Enter');
  await expect(page.locator('#status')).toContainText('THICKNESS');
  await expect(brick.locator('[data-fin-thick]')).toHaveValue('3 5/8"');

  await brick.locator('[data-fin-reset]').click();
  await page.waitForFunction(async bucket => {
    const s = JSON.parse(await (await window.SharedFileStore.loadSharedFile(bucket)).text());
    return !s.finishSettings?.brick;
  }, BUCKET, { timeout: 5000 });
  await expect(brick.locator('[data-fin-thick]')).toHaveValue('4 5/8"');
});

// ── MODEL: the wall's properties (and so OBJ / PROP) ───────────────────
test('MODEL shows the section for a picked wall, and UNDO puts a change back', async ({ page }) => {
  await h.openModel(page, { webgl: false, rails: false, entryCoach: true });
  await expect(page.locator('[data-entry-coach]')).toBeVisible({ timeout: 4000 });
  await page.locator('[data-first-bone-press]').click();
  await h.waitForSaved(page);
  await page.evaluate(async bucket => {
    const file = await window.SharedFileStore.loadSharedFile(bucket);
    const d = JSON.parse(await file.text());
    d.walls = [{ id: 'a', start: { x: -12, z: 0 }, end: { x: 12, z: 0 }, levelId: 3, view: 'plan',
      wallType: 'stud_2x6', baseHeight: 0, topHeight: 8, refLine: 'center', finish: 'siding_h',
      finishBands: [{ finishId: 'brick', lowFt: 0, highFt: 3 }] }];
    d.lines = []; d.floors = []; d.dimensions = []; d.roofs = []; d.shapes = [];
    d.columns = []; d.beams = []; d.fixtures = [];
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(d)], 'drawing.json', { type: 'application/json' }), bucket);
  }, BUCKET);
  await page.goto('/MODEL.html?mode=night&left=1');
  await expect(page.locator('#readout')).toContainText('walls 1/1', { timeout: 6000 });
  const frame = await h.planFrame(page);
  const [cx, cy] = frame.at(0, 0);
  await page.mouse.click(cx, cy);
  const section = page.locator('#props-slot [data-finish-settings]');
  await expect(section).toBeVisible();
  await expect(section.locator('[data-finish-set]')).toHaveCount(2);
  await expect(section.locator('[data-finish-set="siding_h"] [data-fin-param="exposureIn"]')).toHaveValue('4"');
  const thick = section.locator('[data-finish-set="brick"] [data-fin-thick]');
  await thick.fill('2');
  await thick.press('Enter');
  expect(await page.evaluate(() => [drawing.finishSettings?.brick?.thicknessIn,
    window.DraftWallTypes.finishById('brick').thicknessIn])).toEqual([2, 2]);
  await page.keyboard.press('Control+z');
  expect(await page.evaluate(() => [drawing.finishSettings?.brick || null,
    window.DraftWallTypes.finishById('brick').thicknessIn])).toEqual([null, 4.625]);
});

// ── 3D: THE SKIN STANDS OUT ───────────────────────────────────────────
test('in 3D a brick band stands its thickness out from the wall, proud of the siding over it', async ({ page }) => {
  await page.goto('/viewer/index.html?painter=plain');
  await page.waitForSelector('body[data-ready="1"]');
  const house = JSON.parse(JSON.stringify(HOUSE));
  house.walls.forEach(w => {
    if ((w.view || 'plan') !== 'plan' || !(w.levelId > 1)) return;
    w.finish = 'siding_h';
    if (w.id === 'wall-2') w.finishBands = [{ finishId: 'brick', lowFt: 0, highFt: 3 }];
  });
  const r = await page.evaluate(saved => {
    const M = window.DraftHouseMesh;
    // wall-2 runs x = -31 from z 31 to z -1, its outside to the WEST (-x).
    const proud = s => {
      const faces = M.build(s).faces.filter(f => f.kind === 'finish');
      // Only the faces on that wall's line (a skin is a box: its six faces).
      const onWall = f => f.pts.every(p => p.x > -31.6 && p.x < -30.9);
      const westOf = id => Math.min(...faces.filter(f => f.finish === id && onWall(f))
        .flatMap(f => f.pts).map(p => p.x));
      return { brick: westOf('brick'), siding: westOf('siding_h'),
        brickTop: Math.max(...faces.filter(f => f.finish === 'brick' && onWall(f)).flatMap(f => f.pts).map(p => p.y)) };
    };
    const plain = proud(saved);
    const thin = proud({ ...saved, finishSettings: { brick: { thicknessIn: 1 } } });
    const wallWest = Math.min(...M.build(saved).faces.filter(f => f.kind === 'wall'
      && f.pts.every(p => p.x > -31.6 && p.x < -30.5)).flatMap(f => f.pts).map(p => p.x));
    return { plain, thin, wallWest };
  }, house);
  // The framing did not move: the wall's own west face is still the line
  // jb drew (a face-line wall at x = -31).
  expect(r.wallWest).toBeCloseTo(-31, 3);
  expect(r.plain.brick - r.wallWest, 'brick stands 4 5/8" off the wall').toBeCloseTo(-4.625 / 12, 3);
  expect(r.plain.siding - r.wallWest, 'siding stands 1/2" off it').toBeCloseTo(-0.5 / 12, 3);
  expect(r.thin.brick - r.wallWest, 'the house\'s own number wins').toBeCloseTo(-1 / 12, 3);
  expect(r.plain.brickTop, 'the band stops where EXT. FINISH stopped it, three feet up off the sill').toBeLessThan(4);
});
