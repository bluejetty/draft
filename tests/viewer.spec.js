// THE 3D VIEWER (jb, 25 Nov 2026) -- viewer/index.html, a separate program.
//
// Two promises are held here.
//
// 1. THE 2D DRAFTER NEVER LOADS 3D. jb: "if i just delete it all the 2d stuff
//    will still work?" -- yes, because no 2D page asks for anything in
//    viewer/ or for three.js. The pages are read off the disk (as
//    no-third-party.spec.js does), so a page added tomorrow is covered.
//    MODEL.dc.html is the one exception: the OLD editor has always loaded
//    three.js for its own wireframe, and it is not the page jb draws on.
//
// 2. THE VIEWER BUILDS THE HOUSE from a .draft and from a SAVE AS ZIP, with
//    the plain-canvas painter jb's own PC (no graphics card, no WebGL) uses.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const FIXTURE = path.join(ROOT, 'proto', 'repro-movie-2storey-garage.draft');
const OLD_EDITOR_WITH_ITS_OWN_THREE = new Set(['MODEL.dc.html']);
const TWO_D_PAGES = fs.readdirSync(ROOT)
  .filter(name => name.endsWith('.html') && !OLD_EDITOR_WITH_ITS_OWN_THREE.has(name))
  .sort();
const is3D = url => /\/viewer\/|three-[\d.]+(\.min)?\.js|orbitcontrols/i.test(url);

test('the scan finds the 2D pages, MODEL.html among them', () => {
  expect(TWO_D_PAGES.length).toBeGreaterThan(5);
  expect(TWO_D_PAGES).toContain('MODEL.html');
});

test('no 2D page names the viewer or three.js in its source', () => {
  const offenders = TWO_D_PAGES.filter(name => {
    const html = fs.readFileSync(path.join(ROOT, name), 'utf8');
    return /<script[^>]+src=["'][^"']*(viewer\/|three-[\d.]+)/i.test(html);
  });
  expect(offenders).toEqual([]);
});

for (const page of ['MODEL.html', 'LAYOUT.html', 'index.html']) {
  test(`${page} loads without asking for any 3D file`, async ({ page: p }) => {
    const asked = [];
    p.on('request', req => { if (is3D(req.url())) asked.push(req.url()); });
    await p.goto(`/${page}`);
    await p.waitForLoadState('load');
    expect(asked).toEqual([]);
    expect(await p.evaluate(() => typeof window.THREE)).toBe('undefined');
  });
}

async function openViewer(p, painter = 'plain') {
  const errors = [];
  const urls = [];
  p.on('pageerror', e => errors.push(String(e)));
  p.on('request', req => urls.push(req.url()));
  await p.goto(`/viewer/index.html?painter=${painter}`);
  await p.waitForSelector('body[data-ready="1"]');
  const origin = new URL(p.url()).origin;
  // Read when asked, so requests made after this call count too.
  const offSite = { toJSON: () => urls.filter(u => /^https?:/i.test(u) && !u.startsWith(origin)) };
  return { errors, offSite, offSiteNow: () => offSite.toJSON() };
}

// Pixels on the plain canvas that are not the stage colour.
const inkedPixels = p => p.evaluate(() => {
  const c = document.getElementById('plain');
  const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
  let n = 0;
  for (let i = 0; i < d.length; i += 16) {
    if (Math.abs(d[i] - 0xdf) + Math.abs(d[i + 1] - 0xe6) + Math.abs(d[i + 2] - 0xee) > 30) n += 1;
  }
  return n;
});

test('the viewer opens a .draft and builds the house on the plain canvas', async ({ page: p }) => {
  const { errors, offSiteNow } = await openViewer(p, 'plain');
  expect(await p.evaluate(() => document.body.dataset.painter)).toBe('plain');
  await p.setInputFiles('#file', FIXTURE);
  await p.waitForFunction(() => document.body.dataset.loaded && Number(document.body.dataset.frames) > 0);
  const s = await p.evaluate(() => ({ counts: DraftViewer.state.counts, faces: DraftViewer.state.faces.length,
    kinds: [...new Set(DraftViewer.state.faces.map(f => f.kind))].sort(), drawn: DraftViewer.state.lastDrawn }));
  // 8 house walls a storey on two storeys, 4 garage walls, 8 foundation walls.
  expect(s.counts.walls).toBe(12 + 4);
  expect(s.counts.foundationWalls).toBe(8);
  expect(s.counts.roofs).toBeGreaterThan(0);
  expect(s.kinds).toEqual(expect.arrayContaining(['wall', 'garageWall', 'foundation', 'footing', 'floor', 'slab', 'roof']));
  expect(s.drawn).toBeGreaterThan(20);
  expect(await inkedPixels(p)).toBeGreaterThan(2000);
  expect(errors).toEqual([]);
  expect(offSiteNow()).toEqual([]);
});

test('the heights are the level stack the elevations use', async ({ page: p }) => {
  await openViewer(p, 'plain');
  await p.setInputFiles('#file', FIXTURE);
  await p.waitForFunction(() => document.body.dataset.loaded);
  const r = await p.evaluate(() => {
    const saved = DraftViewer.state;   // faces already built
    const top = kind => Math.max(...saved.faces.filter(f => f.kind === kind).flatMap(f => f.pts.map(q => q.y)));
    const low = kind => Math.min(...saved.faces.filter(f => f.kind === kind).flatMap(f => f.pts.map(q => q.y)));
    return { wallTop: top('wall'), fdnTop: top('foundation'), footingLow: low('footing'), roofLow: low('roof') };
  });
  // 2ND FL: main deck at 0, 8'-1 1/8" walls, a 12 5/8" TJI deck, 8' walls on it.
  expect(r.wallTop).toBeGreaterThan(17);
  expect(r.wallTop).toBeLessThan(17.3);
  // The concrete stops a plate under the main floor's bearing line.
  expect(r.fdnTop).toBeCloseTo(-1.177, 2);
  expect(r.footingLow).toBeLessThan(-9.5);
  // The roof's eave is above the garage's own plate, not on the ground.
  expect(r.roofLow).toBeGreaterThan(8);
});

test('the viewer opens a SAVE AS ZIP and finds the drawing inside it', async ({ page: p }) => {
  const { errors } = await openViewer(p, 'plain');
  const text = fs.readFileSync(FIXTURE, 'utf8');
  const built = await p.evaluate(async drawingText => {
    const blob = await DraftZipBundle.writeZip([
      { name: 'house.draft', data: drawingText },
      { name: 'holograms/', data: '' },
      { name: 'notes/house NOTES.txt', data: 'CALL THE ENGINEER' },
    ]);
    const file = new File([blob], 'house.zip', { type: 'application/zip' });
    const result = await DraftViewer.openFile(file);
    return { faces: result ? result.faces.length : 0, name: DraftViewer.state.name };
  }, text);
  expect(built.name).toBe('house.draft');
  expect(built.faces).toBeGreaterThan(100);
  expect(errors).toEqual([]);
});

test('a file that is not a drawing says so instead of breaking', async ({ page: p }) => {
  const { errors } = await openViewer(p, 'plain');
  await p.setInputFiles('#file', { name: 'junk.draft', mimeType: 'application/json', buffer: Buffer.from('not json') });
  await p.waitForFunction(() => document.body.dataset.loaded === 'error');
  await expect(p.locator('#status')).toContainText('Could not open junk.draft');
  expect(errors).toEqual([]);
});

test('the mouse turns and zooms the house, and FIT brings it back', async ({ page: p }) => {
  await openViewer(p, 'plain');
  await p.setInputFiles('#file', FIXTURE);
  await p.waitForFunction(() => document.body.dataset.loaded);
  const cam = () => p.evaluate(() => ({ ...DraftViewer.state.camera }));
  const before = await cam();
  const box = await p.locator('#stage').boundingBox();
  await p.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await p.mouse.down();
  await p.mouse.move(box.x + box.width / 2 + 100, box.y + box.height / 2 + 40, { steps: 5 });
  await p.mouse.up();
  const turned = await cam();
  expect(turned.yaw).not.toBeCloseTo(before.yaw, 1);
  expect(turned.pitch).not.toBeCloseTo(before.pitch, 1);
  await p.mouse.wheel(0, 400);
  expect((await cam()).dist).toBeGreaterThan(turned.dist);
  await p.keyboard.press('ArrowLeft');
  await p.click('#fit');
  const back = await cam();
  expect(back.yaw).toBeCloseTo(before.yaw, 5);
  expect(back.dist).toBeCloseTo(before.dist, 5);
});

test('WEBGL is used when the browser has it, and PLAIN can always be picked', async ({ page: p }) => {
  const { errors } = await openViewer(p, 'auto');
  const ok = await p.evaluate(() => DraftViewer.state.webglOk);
  expect(await p.evaluate(() => document.body.dataset.painter)).toBe(ok ? 'webgl' : 'plain');
  await p.setInputFiles('#file', FIXTURE);
  await p.waitForFunction(() => document.body.dataset.loaded);
  await p.click('[data-painter="plain"]');
  await p.waitForFunction(() => document.body.dataset.painter === 'plain');
  await p.waitForFunction(() => DraftViewer.state.lastDrawn > 20);
  expect(await inkedPixels(p)).toBeGreaterThan(2000);
  expect(errors).toEqual([]);
});

test('with no WebGL at all the viewer falls back to the plain canvas', async ({ page: p }) => {
  // What jb's PC does: no context to be had.
  await p.addInitScript(() => {
    const real = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (kind, ...rest) {
      if (/webgl/i.test(kind)) return null;
      return real.call(this, kind, ...rest);
    };
  });
  const { errors } = await openViewer(p, 'auto');
  expect(await p.evaluate(() => DraftViewer.state.webglOk)).toBe(false);
  expect(await p.evaluate(() => document.body.dataset.painter)).toBe('plain');
  await expect(p.locator('#painter-note')).toContainText('no WebGL');
  await expect(p.locator('[data-painter="webgl"]')).toBeDisabled();
  await p.setInputFiles('#file', FIXTURE);
  await p.waitForFunction(() => document.body.dataset.loaded && DraftViewer.state.lastDrawn > 20);
  expect(await inkedPixels(p)).toBeGreaterThan(2000);
  expect(errors).toEqual([]);
});

// ── PHASE 2: GABLE ENDS AND FASCIA ───────────────────────────────────────
const WINGS = path.join(ROOT, 'proto', 'repro-movie-roof-wings.draft');
const HOOD = path.join(ROOT, 'proto', 'repro-movie-roofplan-hood.draft');

async function built(p, file) {
  await openViewer(p, 'plain');
  await p.setInputFiles('#file', file);
  await p.waitForFunction(() => document.body.dataset.loaded);
  return p.evaluate(() => {
    const s = DraftViewer.state;
    const ys = kind => s.faces.filter(f => f.kind === kind).flatMap(f => f.pts.map(q => q.y));
    return {
      counts: s.counts,
      gableTop: Math.max(...ys('gable')), gableLow: Math.min(...ys('gable')),
      roofTop: Math.max(...ys('roof')), fasciaLow: Math.min(...ys('fascia')), roofLow: Math.min(...ys('roof')),
    };
  });
}

test('a gable end is filled from the plate up to the roof', async ({ page: p }) => {
  const r = await built(p, WINGS);
  // roof-108's three gables that stand clear of the main roof.
  expect(r.counts.gables).toBe(3);
  // From the plate the roof bears on (cut-view.js roofBaseElev, 9.094 on
  // this file) up to just under the ridge.
  expect(r.gableLow).toBeCloseTo(9.094, 2);
  expect(r.gableTop).toBeGreaterThan(r.gableLow + 3);
  expect(r.gableTop).toBeLessThan(r.roofTop);
});

test('every open eave and rake wears a fascia board hung under the roof', async ({ page: p }) => {
  const r = await built(p, WINGS);
  expect(r.counts.fascia).toBeGreaterThan(10);
  // 5 1/2" board: the lowest board edge is that far under the lowest eave.
  expect(r.fasciaLow).toBeCloseTo(r.roofLow - 5.5 / 12, 2);
});

test('a gable that butts into a bigger roof gets no wall and no fascia', async ({ page: p }) => {
  // Every gable on this file is a wing's end dying into the main roof
  // (overhang 0, the main roof's surface carrying on just outside it), as
  // the elevations draw it: hidden.
  const r = await built(p, HOOD);
  expect(r.counts.gables).toBe(0);
  expect(r.counts.fascia).toBeGreaterThan(0);
});

test('the plain painter hides what is behind, whatever order the faces come in', async ({ page: p }) => {
  await openViewer(p, 'plain');
  // Two squares, the near one listed FIRST: a far-to-near sort by list order
  // or a bad middle would paint the far red one over the near green one.
  const centre = await p.evaluate(() => {
    const sq = (z, colour) => ({ kind: 'test', colour, twoSided: true,
      pts: [{ x: -5, y: -5, z }, { x: 5, y: -5, z }, { x: 5, y: 5, z }, { x: -5, y: 5, z }] });
    const s = DraftViewer.state;
    s.faces = [sq(4, [0, 200, 0]), { ...sq(-4, [200, 0, 0]), pts: [{ x: -40, y: -40, z: -4 }, { x: 40, y: -40, z: -4 }, { x: 40, y: 40, z: -4 }, { x: -40, y: 40, z: -4 }] }];
    s.painter.setFaces(s.faces);
    s.camera = { target: { x: 0, y: 0, z: 0 }, yaw: 0, pitch: 0, dist: 60, fov: 40 };
    s.painter.render(s.camera, { background: '#dfe6ee', ambient: 1, edges: false });
    const c = document.getElementById('plain');
    const d = c.getContext('2d').getImageData(Math.floor(c.width / 2), Math.floor(c.height / 2), 1, 1).data;
    return [d[0], d[1], d[2]];
  });
  expect(centre).toEqual([0, 200, 0]);
});

// ── PHASE 3: OPENINGS, STAIRS, DECKS, HOLOGRAMS (jb, 26 Nov 2026) ─────────
//
// Built straight from the parsed drawing in the page, so a test can change
// the drawing first (a deck, a hologram) without a file of its own.
async function build3(p, change = null) {
  await openViewer(p, 'plain');
  const saved = JSON.parse(fs.readFileSync(FIXTURE, 'utf8'));
  return p.evaluate(([s, src]) => {
    if (src) s = (new Function('s', src))(s) || s;
    const built = DraftViewer.loadDrawing(s, 'test');
    const levels = {};
    built.stack.floors.forEach(l => { levels[l.id] = l.floorTop; });
    // The fill (glass or door slab) standing in an opening: the one whose
    // middle is nearest the opening's centre on its wall.
    const fill = id => {
      const f = s.fenestrations.find(o => o.id === id);
      const w = s.walls.find(x => x.id === f.wallId);
      const len = Math.hypot(w.end.x - w.start.x, w.end.z - w.start.z);
      const c = { x: w.start.x + (w.end.x - w.start.x) * f.offset / len, z: w.start.z + (w.end.z - w.start.z) * f.offset / len };
      const mid = face => ({ x: face.pts.reduce((a, q) => a + q.x, 0) / 4, z: face.pts.reduce((a, q) => a + q.z, 0) / 4 });
      const near = built.faces.filter(face => ['glass', 'door', 'overhead'].includes(face.kind) && !face.hologram)
        .map(face => ({ face, d: Math.hypot(mid(face).x - c.x, mid(face).z - c.z) }))
        .filter(o => o.d < 0.6)
        .sort((a, b) => Math.min(...a.face.pts.map(q => q.y)) - Math.min(...b.face.pts.map(q => q.y)));
      if (!near.length) return null;
      const face = near[0].face;
      return { kind: face.kind, y0: Math.min(...face.pts.map(q => q.y)), y1: Math.max(...face.pts.map(q => q.y)),
        // Measured along the wall: the pane stands mid-thickness, off the line.
        wide: (() => { const t = face.pts.map(q => ((q.x - w.start.x) * (w.end.x - w.start.x) + (q.z - w.start.z) * (w.end.z - w.start.z)) / len);
          return Math.max(...t) - Math.min(...t); })() };
    };
    const ys = kind => built.faces.filter(f => f.kind === kind && !f.hologram).flatMap(f => f.pts.map(q => q.y));
    const xs = pred => built.faces.filter(pred).flatMap(f => f.pts.map(q => q.x));
    return {
      counts: built.counts, levels, slabTop: built.stack.foundation.slabTop,
      win7: fill('fenestration-7'), win20: fill('fenestration-20'), door6: fill('fenestration-6'), garage36: fill('fenestration-36'),
      seams: built.faces.filter(f => f.seams).length,
      stairTop: Math.max(...ys('stair')), stairLow: Math.min(...ys('stair')),
      deckTop: ys('deck').length ? Math.max(...ys('deck')) : null, deckLow: ys('deck').length ? Math.min(...ys('deck')) : null,
      holoFaces: built.faces.filter(f => f.hologram).length,
      holoColour: (built.faces.find(f => f.hologram && f.kind === 'wall') || {}).colour || null,
      houseX: [Math.min(...xs(f => !f.hologram)), Math.max(...xs(f => !f.hologram))],
      holoX: built.faces.some(f => f.hologram) ? [Math.min(...xs(f => f.hologram)), Math.max(...xs(f => f.hologram))] : null,
      status: document.getElementById('status').textContent,
    };
  }, [saved, change]);
}

test('every door and window is cut through its wall at the elevation heights', async ({ page: p }) => {
  const r = await build3(p);
  // The 24 openings on this file: 21 windows, 2 doors and the overhead.
  expect(r.counts.windows).toBe(21);
  expect(r.counts.doors).toBe(3);
  expect(r.status).toContain('21 windows, 3 doors');
  // MAIN FL window: sill 2'-10", head 7'-0", 4' wide, glass in it.
  expect(r.win7.kind).toBe('glass');
  expect(r.win7.y0).toBeCloseTo(r.levels[3] + 2.8333, 3);
  expect(r.win7.y1).toBeCloseTo(r.levels[3] + 7, 3);
  expect(r.win7.wide).toBeCloseTo(4, 2);
  // 2ND FL window stands on the 2ND FL.
  expect(r.win20.y0).toBeCloseTo(r.levels[5] + 2.8333, 3);
  // A house door on its 1/2" threshold, up to its 6'-8" head.
  expect(r.door6.kind).toBe('door');
  expect(r.door6.y0).toBeCloseTo(r.levels[3] + 0.5 / 12, 3);
  expect(r.door6.y1).toBeCloseTo(r.levels[3] + 6.6667, 3);
  // The overhead door seals to the garage slab: well under the house floor.
  expect(r.garage36.kind).toBe('overhead');
  expect(r.garage36.y0).toBeLessThan(r.levels[3] - 0.5);
  // The wall faces round each opening are joined at seams, never inked.
  expect(r.seams).toBeGreaterThan(48);
});

test('a stair steps down one riser a tread from its floor to the one below', async ({ page: p }) => {
  const r = await build3(p);
  expect(r.counts.stairs).toBe(2);
  // MAIN FL -> slab, 2ND FL -> MAIN FL: the top tread one riser under the
  // 2ND FL, the lowest one riser over the slab.
  const riserUp = (r.levels[5] - r.levels[3]) / 14;
  expect(r.stairTop).toBeCloseTo(r.levels[5] - riserUp, 1);
  expect(r.stairTop).toBeLessThan(r.levels[5]);
  expect(r.stairLow).toBeGreaterThan(r.slabTop - 0.01);
  expect(r.stairLow).toBeLessThan(r.slabTop + 1);
});

test('a deck stands under its floor by its drop, 2x10 + 3/4" deep', async ({ page: p }) => {
  const r = await build3(p, `
    s.floors.push({ id: 'deck-t', levelId: 3, view: 'plan', deck: true,
      points: [{ x: 40, y: 0, z: 0 }, { x: 50, y: 0, z: 0 }, { x: 50, y: 0, z: 10 }, { x: 40, y: 0, z: 10 }] });
    return s;`);
  expect(r.counts.decks).toBe(1);
  expect(r.deckTop).toBeCloseTo(r.levels[3] - 2 / 12, 3);
  expect(r.deckLow).toBeCloseTo(r.deckTop - 10 / 12, 3);
});

test('a hologram is built where the plan puts it, in its file colour', async ({ page: p }) => {
  const r = await build3(p, `
    const copy = JSON.parse(JSON.stringify(s));
    s.holograms = [{ id: 'h1', name: 'NEXT DOOR', x: 100, z: 0, angleDeg: 0, pivotX: 0, pivotZ: 0, source: copy }];
    return s;`);
  expect(r.counts.holograms).toBe(1);
  expect(r.holoFaces).toBeGreaterThan(500);
  // Slid 100 ft along x, the same width as the house.
  expect(r.holoX[0]).toBeCloseTo(r.houseX[0] + 100, 1);
  expect(r.holoX[1]).toBeCloseTo(r.houseX[1] + 100, 1);
  // Mixed toward the first file's blue.
  expect(r.holoColour[2]).toBeGreaterThan(r.holoColour[0]);
});

test('the name follows the skin: RUFF 3D on RUFF, ROUGH 3D on ROUGH', async ({ page: p }) => {
  await p.goto('/viewer/index.html?theme=rough');
  await p.waitForSelector('body[data-ready="1"]');
  await expect(p.locator('#brand')).toHaveText('ROUGH 3D');
  await expect(p).toHaveTitle('ROUGH 3D');
  await p.goto('/viewer/index.html?theme=ruff');
  await p.waitForSelector('body[data-ready="1"]');
  await expect(p.locator('#brand')).toHaveText('RUFF 3D');
  // A desk (localhost) with nothing chosen is RUFF, as MODEL is.
  await p.goto('/viewer/index.html');
  await p.waitForSelector('body[data-ready="1"]');
  await expect(p.locator('#brand')).toHaveText('RUFF 3D');
});
