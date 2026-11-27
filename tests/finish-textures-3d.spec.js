// FINISH TEXTURES IN 3D (jb, 27 Nov 2026), step 3 of 3.
//
// jb: *"maybe also have TEXTURES on the shapes for 3D like the brick joints
// and siding [laps] etc"* -- *"you think you'll have bricks with lines in
// it?"*. The surface of each finish skin is shaded from the same numbers the
// elevation hatch uses (viewer/finish-texture.js), in both painters; the
// TEXTURES chip turns them off for the view, and a finish's own TEXTURE IN
// 3D tick (step 1) turns that finish off for good.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const HOUSE = JSON.parse(fs.readFileSync(path.join(ROOT, 'proto', 'repro-movie-2storey-garage.draft'), 'utf8'));
const clad = () => {
  const d = JSON.parse(JSON.stringify(HOUSE));
  d.walls.forEach(w => {
    if ((w.view || 'plan') !== 'plan' || !(w.levelId > 1)) return;
    w.finish = Math.abs(w.start.x - w.end.x) < 0.01 && w.levelId === 3 ? 'brick' : 'siding_h';
  });
  return d;
};

test('a brick is lit in its middle and dark in its joint, at the house\'s own sizes', async ({ page }) => {
  await page.goto('/viewer/index.html?painter=plain');
  await page.waitForSelector('body[data-ready="1"]');
  const r = await page.evaluate(() => {
    const T = window.DraftFinishTexture, WT = window.DraftWallTypes;
    WT.adoptFinishSettings({});
    const brick = WT.finishById('brick');
    // Modular brick: 7 5/8 x 2 1/4 in a 3/8 joint, so a course is 2 5/8".
    const course = 2.625 / 12, joint = 0.375 / 12;
    const close = 0.002;   // a pixel covers a fiftieth of an inch: right up close
    const inBrick = T.shadeAt(brick, 2 / 12, course * 0.6, close);
    const inBedJoint = T.shadeAt(brick, 2 / 12, joint / 2, close);
    const farAway = T.shadeAt(brick, 2 / 12, joint / 2, 0.2);   // a pixel is 2.4": no joints
    const lap = T.shadeAt(WT.finishById('siding_h'), 1, 0.01, close);
    const midBoard = T.shadeAt(WT.finishById('siding_h'), 1, 2 / 12, close);
    WT.adoptFinishSettings({ finishSettings: { brick: { texture: false } } });
    const off = T.shadeAt(WT.finishById('brick'), 2 / 12, joint / 2, close);
    WT.adoptFinishSettings({});
    return { inBrick, inBedJoint, farAway, lap, midBoard, off };
  });
  expect(r.inBrick).toBeGreaterThan(0.85);
  expect(r.inBedJoint).toBeLessThan(r.inBrick - 0.25);
  expect(r.farAway, 'a joint finer than a pixel fades out').toBeGreaterThan(0.95);
  expect(r.lap, 'each siding course throws its lap shadow').toBeLessThan(r.midBoard - 0.2);
  expect(r.off, 'TEXTURE IN 3D off: plain').toBe(1);
});

test('the skins carry texture co-ordinates, and the TEXTURES chip changes the picture', async ({ page }) => {
  await page.goto('/viewer/index.html?painter=plain');
  await page.waitForSelector('body[data-ready="1"]');
  const r = await page.evaluate(saved => {
    const M = window.DraftHouseMesh;
    const faces = M.build(saved).faces.filter(f => f.kind === 'finish');
    const walls = faces.filter(f => f.tex);
    const ledges = faces.filter(f => !f.tex && f.pts.every(p => Math.abs(p.y - f.pts[0].y) < 1e-6));
    const off = M.build({ ...saved, finishSettings: { brick: { texture: false } } }).faces
      .filter(f => f.kind === 'finish' && f.finish === 'brick' && f.tex);
    return { walls: walls.length, brick: walls.filter(f => f.finish === 'brick').length, ledges: ledges.length, off: off.length };
  }, clad());
  expect(r.walls).toBeGreaterThan(20);
  expect(r.brick).toBeGreaterThan(4);
  expect(r.ledges, 'a top or underside takes no pattern').toBeGreaterThan(0);
  expect(r.off, 'a finish turned off has none').toBe(0);

  const file = path.join(test.info().outputDir, 'clad.draft');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(clad()));
  await page.setInputFiles('#file', file);
  await page.waitForFunction(() => Number(document.body.dataset.loaded) > 0);
  // The viewer paints on the next animation frame, so the picture is read
  // two frames after the camera is set.
  const grab = () => page.evaluate(() => new Promise(done => {
    const s = window.DraftViewer.state;
    s.camera = { ...s.camera, target: { x: -31, y: 1.5, z: 28 }, yaw: -40, pitch: 8, dist: 16 };
    window.DraftViewer.redraw();
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const c = document.getElementById('plain');
      const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
      let sum = 0;
      for (let i = 0; i < d.length; i += 4) sum += d[i] + d[i + 1] + d[i + 2];
      done(sum / (d.length / 4));
    }));
  }));
  await grab();   // the first frame after a load settles the canvas size
  const on = await grab();
  await page.locator('#textures').click();
  await expect(page.locator('#textures')).not.toHaveClass(/lit/);
  await grab();
  const plain = await grab();
  expect(plain, 'joints and laps darken the picture').toBeGreaterThan(on);
});

// A finish with no pattern to repeat (here jb's TIMBERHOUSE) must not stop
// the WebGL painter: the sheet's 3D views are drawn through it.
test('a finish with nothing to repeat is drawn plain in WebGL', async ({ page }) => {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('/viewer/index.html?painter=webgl');
  await page.waitForSelector('body[data-ready="1"]');
  const saved = JSON.parse(fs.readFileSync(path.join(ROOT, 'proto', 'repro-timberhouse-jog-fascia.draft'), 'utf8'));
  const r = await page.evaluate(d => {
    try { window.DraftViewer.loadDrawing(d, 'timber'); window.DraftViewer.redraw(); return 'ok'; } catch (e) { return String(e); }
  }, saved);
  expect(r).toBe('ok');
  expect(errors).toEqual([]);
});
