// THE WALKTHROUGH (jb, 28 Nov 2026) -- viewer/walk.js.
//
// "the user camera is placed on about 6ft above groundlevel and he can
// 'walk' through the house and rise up using the staircase". The fixture
// is the two-storey with the garage: main floor at 0, the second at
// 9.146 ft, a straight stair along z = 16.7 rising toward -x from x = -5.5
// to x = -16.4, the garage-to-house door in the wall at x = 8.8, z = 22.5.
const { test, expect } = require('@playwright/test');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const FIXTURE = path.join(ROOT, 'proto', 'repro-movie-2storey-garage.draft');
const SECOND = 9.145833333333334;

async function viewer(p) {
  const errors = [];
  p.on('pageerror', e => errors.push(String(e)));
  await p.goto('/viewer/index.html?painter=plain');
  await p.waitForSelector('body[data-ready="1"]');
  await expect(p.locator('#walk')).toBeDisabled();
  await p.setInputFiles('#file', FIXTURE);
  await p.waitForFunction(() => Number(document.body.dataset.loaded) > 0);
  return errors;
}

// Walk with the clock in the spec's hands: `secs` of a key held.
const walkFor = (p, from, yaw, secs, key = 'fwd') => p.evaluate(([from, yaw, secs, key]) => {
  const W = DraftViewerWalk;
  if (!W.walker.on) W.start();
  W.standAt(from.x, from.y, from.z, from.kind, from.group);
  W.walker.yaw = yaw;
  W.keys.clear();
  W.keys.add(key);
  for (let t = 0; t < secs; t += 0.05) W.step(0.05);
  W.keys.clear();
  for (let t = 0; t < 1; t += 0.05) W.step(0.05);   // settle onto the floor
  const w = W.walker;
  return { x: w.x, z: w.z, feet: w.feet, kind: w.kind, group: w.group };
}, [from, yaw, secs, key]);

// The screen spot of a point in the house, for the click that picks it.
const screenOf = (p, pt) => p.evaluate(pt => {
  const st = document.getElementById('stage'), r = st.getBoundingClientRect();
  const cam = DraftViewer.state.camera, b = DraftViewerCamera.basis(cam);
  const q = b.toCamera(pt), focal = (st.clientHeight / 2) / Math.tan(cam.fov * Math.PI / 360);
  return { x: r.left + st.clientWidth / 2 + q.x * focal / q.z, y: r.top + st.clientHeight / 2 - q.y * focal / q.z };
}, pt);

test('WALK, then a click on the ground: you stand there with your eye 5\'-6" up, and Esc puts the house back', async ({ page: p }) => {
  const errors = await viewer(p);
  const orbit = await p.evaluate(() => DraftViewer.state.camera);
  await p.locator('#walk').click();
  await expect(p.locator('body')).toHaveAttribute('data-walking', 'pick');
  await expect(p.locator('#status')).toContainText('click a spot on a floor');
  // A wall is not somewhere to stand.
  const wall = await screenOf(p, { x: 9, y: 5, z: 31 });
  // The ground in front of the house.
  const spot = { x: 20, y: -2.34375, z: 40 };
  const at = await screenOf(p, spot);
  await p.mouse.click(at.x, at.y);
  await expect(p.locator('body')).toHaveAttribute('data-walking', '1');
  await expect(p.locator('#walk-pad')).toBeVisible();
  const w = await p.evaluate(() => ({ ...DraftViewerWalk.walker, eye: DraftViewerCamera.eyeOf(DraftViewer.state.camera) }));
  expect(Math.abs(w.x - spot.x)).toBeLessThan(0.5);
  expect(Math.abs(w.z - spot.z)).toBeLessThan(0.5);
  expect(w.kind).toBe('ground');
  expect(w.eye.y).toBeCloseTo(spot.y + 5.5, 2);
  await expect(p.locator('#status')).toContainText('WALKING outside');
  await p.keyboard.press('Escape');
  await expect(p.locator('body')).toHaveAttribute('data-walking', '');
  expect(await p.evaluate(() => DraftViewer.state.camera)).toEqual(orbit);
  // And a click on a wall while picking is refused in words.
  await p.locator('#walk').click();
  await p.mouse.click(wall.x, wall.y);
  await expect(p.locator('#status')).toContainText('not something to stand on');
  await expect(p.locator('body')).toHaveAttribute('data-walking', 'pick');
  expect(errors).toEqual([]);
});

test('the keys walk you, a drag looks round, and the plain painter draws half size while you move', async ({ page: p }) => {
  await viewer(p);
  await p.evaluate(() => { DraftViewerWalk.start(); DraftViewerWalk.standAt(0, 0, 5, 'floor', 'L3'); DraftViewerWalk.walker.yaw = 0; });
  const full = await p.evaluate(() => document.getElementById('plain').width);
  await p.keyboard.down('w');
  await p.waitForTimeout(400);
  const mid = await p.evaluate(() => ({ z: DraftViewerWalk.walker.z, w: document.getElementById('plain').width }));
  await p.keyboard.up('w');
  expect(mid.z).toBeLessThan(5 - 0.5);        // yaw 0 looks along -z
  expect(mid.w).toBeLessThan(full * 0.6);     // the quick picture
  await p.waitForFunction(full => document.getElementById('plain').width === full, full);
  // The arrows turn you; they do not turn the house.
  await p.keyboard.down('ArrowLeft');
  await p.waitForTimeout(300);
  await p.keyboard.up('ArrowLeft');
  expect(await p.evaluate(() => DraftViewerWalk.walker.yaw)).toBeGreaterThan(10);
  // A drag up looks up.
  const box = await p.locator('#stage').boundingBox();
  await p.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await p.mouse.down();
  await p.mouse.move(box.x + box.width / 2, box.y + box.height / 2 - 100, { steps: 5 });
  await p.mouse.up();
  expect(await p.evaluate(() => DraftViewerWalk.walker.pitch)).toBeLessThan(-15);
});

test('walls and windows stop you; a doorway lets you through and up into the house', async ({ page: p }) => {
  await viewer(p);
  // Upstairs, walking north into the outside wall: stopped a little short of it.
  const wall = await walkFor(p, { x: 0, y: SECOND, z: 5, kind: 'floor', group: 'L5' }, 0, 6);
  expect(wall.z).toBeGreaterThan(-1.2);
  expect(wall.z).toBeLessThan(1);
  expect(wall.feet).toBeCloseTo(SECOND, 3);
  // From the garage side, through the door at z 22.5 and up into the house.
  const door = await walkFor(p, { x: 13, y: -2.34375, z: 22.5, kind: 'ground', group: 'ground' }, 90, 4);
  expect(door.x).toBeLessThan(5);
  expect(door.feet).toBeCloseTo(0, 3);
  expect(door).toMatchObject({ kind: 'floor', group: 'L3' });
  // Two feet along the same wall there is no door: you stay out.
  const shut = await walkFor(p, { x: 13, y: -2.34375, z: 26.5, kind: 'ground', group: 'ground' }, 90, 4);
  expect(shut.x).toBeGreaterThan(8.8);
});

test('the stairs carry you up a tread at a time to the second floor, and back down', async ({ page: p }) => {
  await viewer(p);
  const heights = await p.evaluate(() => {
    const W = DraftViewerWalk;
    W.start(); W.standAt(-3, 0, 16.7, 'floor', 'L3'); W.walker.yaw = 90;
    W.keys.add('fwd');
    const seen = [];
    for (let t = 0; t < 4; t += 0.05) { W.step(0.05); seen.push(W.walker.feet); }
    W.keys.clear();
    return seen;
  });
  // Never a jump bigger than a riser in one frame, and always climbing.
  for (let i = 1; i < heights.length; i += 1) {
    expect(heights[i] - heights[i - 1]).toBeLessThan(0.7);
    expect(heights[i]).toBeGreaterThanOrEqual(heights[i - 1] - 1e-9);
  }
  const up = await walkFor(p, { x: -3, y: 0, z: 16.7, kind: 'floor', group: 'L3' }, 90, 5);
  expect(up).toMatchObject({ kind: 'floor', group: 'L5' });
  expect(up.feet).toBeCloseTo(SECOND, 3);
  const down = await walkFor(p, { x: -25, y: SECOND, z: 16.7, kind: 'floor', group: 'L5' }, 270, 6);
  expect(down).toMatchObject({ kind: 'floor', group: 'L3' });
  expect(down.feet).toBeCloseTo(0, 3);
  await expect(p.locator('#status')).toContainText('MAIN FL');
});

test('standing in a room, the walls beside you are drawn, cut at the eye rather than left out', async ({ page: p }) => {
  await viewer(p);
  await p.evaluate(() => { DraftViewerWalk.start(); DraftViewerWalk.standAt(-3, 0, 16.7, 'floor', 'L3'); DraftViewerWalk.walker.yaw = 90; DraftViewerWalk.step(0); });
  await p.evaluate(() => { DraftViewerWalk.keys.add('turnL'); DraftViewerWalk.step(0); DraftViewerWalk.keys.clear(); });
  await p.waitForTimeout(300);
  // The left and right edges of the picture are wall, not the stage colour
  // the old painter left where a wall ran back past the eye.
  const edges = await p.evaluate(() => {
    DraftViewer.state.painter.render(DraftViewer.state.camera, DraftViewer.LOOK);
    const c = document.getElementById('plain'), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    const bg = [0xdf, 0xe6, 0xee];
    const isBg = (x, y) => { const i = (y * c.width + x) * 4; return Math.abs(d[i] - bg[0]) + Math.abs(d[i + 1] - bg[1]) + Math.abs(d[i + 2] - bg[2]) < 12; };
    let bgCount = 0, n = 0;
    for (let y = Math.round(c.height * 0.3); y < c.height * 0.7; y += 5) { n += 2; if (isBg(2, y)) bgCount++; if (isBg(c.width - 3, y)) bgCount++; }
    return { bgCount, n };
  });
  expect(edges.bgCount).toBe(0);
});

// THE GLASS IS A MIRROR (jb, 28 Nov 2026): "when the guy is doing walkthrough
// looking up he should mostly see sky and cloud reflection", and "make it so
// when the user walks by the reflections will change based on his angle".
// The front windows of the fixture are at z = 30.8: the main floor's centred
// 4.9 ft up, the second floor's at 14.1.
test('a window reflects what lies along your line of sight: it slides as you walk by, and is sky when you look up', async ({ page: p }) => {
  await viewer(p);
  const r = await p.evaluate(() => {
    const G = DraftGlassReflection, M = DraftHouseMesh, st = DraftViewer.state;
    const centre = f => f.pts.reduce((a, q) => ({ x: a.x + q.x / f.pts.length, y: a.y + q.y / f.pts.length, z: a.z + q.z / f.pts.length }), { x: 0, y: 0, z: 0 });
    const pane = (group, y) => st.faces.find(f => f.kind === 'glass' && f.group === group
      && Math.abs(centre(f).x + 3) < 0.5 && Math.abs(centre(f).z - 30.8) < 0.5 && Math.abs(centre(f).y - y) < 0.5);
    const low = pane('L3', 4.9), high = pane('L5', 14.1);
    const at = (f, eye) => G.seenFrom(f.refl, M.normalOf(f.pts), f.pts[0], eye)(centre(f));
    // Standing on the ground in front of the house, eye 5'-6" up.
    const eye = { x: -3, y: -2.34375 + 5.5, z: 40 };
    const lowH = G.ease(at(low, eye)[1]), highH = G.ease(at(high, eye)[1]);
    // Five feet along the front: the same spot on the glass shows another part of the picture.
    const slid = at(low, { ...eye, x: 2 })[0] - at(low, eye)[0];
    // The colour up there, averaged along the picture.
    const sum = [0, 0, 0];
    for (let s = 0; s < G.FT_W; s += 0.5) G.at(s, highH).forEach((v, i) => { sum[i] += v; });

    // AND THE PAINTER USES IT: the upper pane alone on the stage, aimed at
    // from two sides. With the reflection off the glass is one flat colour
    // from both; with it on, the two views see different things in it.
    const painter = st.painter;
    painter.setFaces([high]);
    const C = centre(high);
    const px = (cam, look) => {
      painter.render({ target: C, dist: 12, fov: 65, ...cam }, { ...DraftViewer.LOOK, ...look }, { W: 200, H: 200 });
      const d = document.getElementById('plain').getContext('2d').getImageData(95, 95, 10, 10).data;
      const m = [0, 0, 0];
      for (let i = 0; i < d.length; i += 4) { m[0] += d[i] / 100; m[1] += d[i + 1] / 100; m[2] += d[i + 2] / 100; }
      return m;
    };
    const left = px({ yaw: -25, pitch: -5 }), right = px({ yaw: 25, pitch: -5 });
    const leftOff = px({ yaw: -25, pitch: -5 }, { textures: false }), rightOff = px({ yaw: 25, pitch: -5 }, { textures: false });
    const lookUp = px({ yaw: 0, pitch: -45 });
    painter.setFaces(st.faces);
    DraftViewer.redraw();
    return { lowH, highH, slid, sky: sum.map(v => v / (G.FT_W * 2)), left, right, leftOff, rightOff, lookUp };
  });
  // Looking straight across at the main-floor window: trees and shrubs.
  expect(r.lowH).toBeLessThan(18);
  // Looking up at the second-floor window from the ground: well up in the sky.
  expect(r.highH).toBeGreaterThan(30);
  expect(r.sky[2]).toBeGreaterThan(r.sky[1]);
  // Walking 5 ft along shifts the picture in the glass by far more than 5 ft.
  expect(Math.abs(r.slid)).toBeGreaterThan(10);
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  expect(dist(r.leftOff, r.rightOff)).toBeLessThan(2);
  expect(dist(r.left, r.right)).toBeGreaterThan(4);
  // From below, the pane is sky: blue leads green.
  expect(r.lookUp[2]).toBeGreaterThan(r.lookUp[1]);
});
