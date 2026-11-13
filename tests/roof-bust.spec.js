// BUST ROOF (jb, 13 Nov 2026).
//
// "the autoroof is really cool for doing the quick house but unless it is
// nearly perfect at the begining its hard to modify" -- "would it be
// possible to BUST it in to peices right now doesn't seem possible". And:
// "Y for bust yes please".
//
// So: a picked roof, BUST ROOF on its panel (or Y), and the roof becomes one
// roof per solved plane -- the same polygons the elevations already paint,
// each with its ONE eave and every hip, valley and ridge a JOINT edge --
// held together as one FIXED assembly. The pieces are hand roofs from then
// on (`follows: 'none'`), and ONE UNDO joins the roof back, grouping and all.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
// A 60 x 30 house with a 6' jog-out on its front from x = 20 to 40, roofed
// at 8' all round: the eave ring is the wall ring pushed out 8'. Eight
// corners, so the hip roof solves into more planes than a plain box.
const WALL = [[0, 0], [60, 0], [60, 30], [40, 30], [40, 36], [20, 36], [20, 30], [0, 30]];
const EAVE = [[-8, -8], [68, -8], [68, 38], [48, 38], [48, 44], [12, 44], [12, 38], [-8, 38]];
const drawing = () => ({
  version: 1, planTurn: 0,
  levels: [{ id: 8, name: 'SITE', elev: 0 }, { id: 7, name: 'ROOF', elev: 0 },
    { id: 3, name: 'MAIN FL', elev: 0 }, { id: 1, name: 'FOUNDATION', elev: -8 }],
  activeLevelIdx: 1,
  walls: [], lines: [], floors: [], fenestrations: [], dimensions: [],
  outlines: [], shapes: [], surfaceOpenings: [], stairs: [], notes: [],
  roomTags: [], columns: [], beams: [], boneyardOutlines: [],
  groups: [], levelLocks: [], underlays: [],
  roofs: [{ id: 'roof-1', levelId: 7, follows: 'house', pitch: 4, overhang: 8,
    points: EAVE.map(([x, z]) => ({ x, y: 0, z })), edges: EAVE.map(() => 'eave'),
    edgeOverhang: EAVE.map(() => 8), footprint: WALL.map(([x, z]) => ({ x, y: 0, z })) }],
});

async function open(page, search = '?level=7&left=1&lpane=drafting') {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, f }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, f: drawing() });
  await page.goto(`/MODEL.html${search}`);
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  await page.keyboard.press('0');
  await page.waitForTimeout(200);
  return h.planFrame(page);
}
const click = async (page, at, x, z) => { await page.mouse.click(...at(x, z)); await page.waitForTimeout(100); };
// What the page holds: every roof's edges, its grouping, and what is picked.
const state = page => page.evaluate(() => ({
  roofs: (drawing.roofs || []).map(r => ({ id: r.id, edges: r.edges.slice(), follows: r.follows, pitch: r.pitch,
    overhang: r.overhang, corners: r.points.length })),
  groups: (drawing.groups || []).map(g => ({ name: g.name, fixed: g.fixed, members: g.members.map(m => `${m.type}:${m.id}`) })),
  picked: selection.map(e => `${e.type}:${e.item.id}`),
  strip: stripNotice,
}));
const planes = page => page.evaluate(() => {
  const G = window.DraftGeometry2D;
  return G.roofFaces(drawing.roofs[0], G.roofSkeleton(drawing.roofs[0])).length;
});
// The roof's height above its eave at a grid of points, read through
// whichever roof record covers each point -- the whole roof before the
// bust, the pieces after. Null where no roof is.
const rises = page => page.evaluate(() => {
  const G = window.DraftGeometry2D;
  const out = [];
  for (let x = -10; x <= 70; x += 1.9) {
    for (let z = -10; z <= 46; z += 1.7) {
      const found = (drawing.roofs || []).map(r => G.roofRiseAt(r, { x, z })).filter(v => v != null);
      out.push(found.length ? Math.round(Math.min(...found) * 1000) / 1000 : null);
    }
  }
  return out;
});

test('BUST ROOF cuts the jog roof into one piece per plane, held as one assembly', async ({ page }) => {
  const { at } = await open(page);
  const count = await planes(page);
  expect(count).toBeGreaterThanOrEqual(6);
  await click(page, at, 30, 15);
  expect((await state(page)).picked).toEqual(['roof:roof-1']);
  const bust = page.locator('#props-slot [data-roof-bust]');
  await expect(bust).toBeEnabled();
  await bust.click();
  await page.waitForTimeout(150);
  const after = await state(page);
  expect(after.roofs.length).toBe(count);
  expect(after.roofs.map(r => r.id)).not.toContain('roof-1');
  // Each piece is one plane: exactly one EAVE, the rest the lines it shared
  // with its neighbours, and a hand roof from now on at the roof's pitch.
  after.roofs.forEach(r => {
    expect(r.edges.filter(k => k === 'eave').length, `edges ${r.edges}`).toBe(1);
    expect(r.edges.filter(k => k === 'joint').length, `edges ${r.edges}`).toBeGreaterThanOrEqual(2);
    expect(r.follows).toBe('none');
    expect(r.pitch).toBe(4);
    expect(r.overhang).toBe(8);
  });
  // One fixed assembly holds every piece, and the pieces are what is picked.
  expect(after.groups.length).toBe(1);
  expect(after.groups[0].fixed).toBe(false);
  expect(after.groups[0].members.sort()).toEqual(after.roofs.map(r => `roof:${r.id}`).sort());
  expect(after.picked.sort()).toEqual(after.roofs.map(r => `roof:${r.id}`).sort());
  expect(after.strip).toContain(`busted into ${count} pieces`);
  // Each piece is one plane now, so there is nothing more to bust.
  await expect(page.locator('#props-slot [data-roof-bust]')).toBeDisabled();
  // And the file keeps the word JOINT, which the reader must not drop.
  await page.locator('#save').click();
  await h.waitForSaved(page);
  const saved = await h.savedDrawing(page);
  expect(saved.roofs.length).toBe(count);
  expect(saved.roofs.every(r => r.edges.includes('joint'))).toBe(true);
  expect(saved.groups.length).toBe(1);
  // Opened again, the reader keeps the word too.
  await page.goto('/MODEL.html?level=7&left=1&lpane=drafting');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  const reopened = await state(page);
  expect(reopened.roofs.length).toBe(count);
  expect(reopened.roofs.every(r => r.edges.includes('joint'))).toBe(true);
  expect(reopened.groups.length).toBe(1);
});

test('the pieces stand exactly where the roof\'s planes stood', async ({ page }) => {
  const { at } = await open(page);
  const before = await rises(page);
  await click(page, at, 30, 15);
  await page.locator('#props-slot [data-roof-bust]').click();
  await page.waitForTimeout(150);
  const after = await rises(page);
  expect(after.length).toBe(before.length);
  const off = before.map((v, i) => [v, after[i]]).filter(([a, b]) => (a == null) !== (b == null)
    || (a != null && Math.abs(a - b) > 0.01));
  expect(off.length, `points that moved: ${JSON.stringify(off.slice(0, 5))}`).toBe(0);
  expect(before.filter(v => v != null).length).toBeGreaterThan(400);
});

test('UNDO joins the roof back, grouping and all', async ({ page }) => {
  const { at } = await open(page);
  await click(page, at, 30, 15);
  await page.locator('#props-slot [data-roof-bust]').click();
  await page.waitForTimeout(150);
  expect((await state(page)).roofs.length).toBeGreaterThan(1);
  // One step of the fine-grained UNDO, not a jump back through the history
  // versions (which Ctrl+Z falls back to when the stack is empty).
  expect(await page.evaluate(() => undoStack[undoStack.length - 1]?.kind)).toBe('assembly');
  await page.keyboard.press('Control+z');
  await page.waitForTimeout(150);
  const back = await state(page);
  expect(back.roofs.map(r => r.id)).toEqual(['roof-1']);
  expect(back.roofs[0].edges.every(k => k === 'eave')).toBe(true);
  expect(back.groups).toEqual([]);
});

test('Y on a picked roof busts it; Y again busts the assembly it made', async ({ page }) => {
  const { at } = await open(page);
  const count = await planes(page);
  await click(page, at, 30, 15);
  await page.keyboard.press('y');
  await page.waitForTimeout(150);
  const busted = await state(page);
  expect(busted.roofs.length).toBe(count);
  expect(busted.groups.length).toBe(1);
  await page.keyboard.press('y');
  await page.waitForTimeout(150);
  const loose = await state(page);
  expect(loose.roofs.length).toBe(count);
  expect(loose.groups).toEqual([]);
  expect(loose.strip).toContain('busted');
});

test('a ridge corner dragged on one piece takes the same corner of its neighbours along', async ({ page }) => {
  const { at } = await open(page);
  await click(page, at, 30, 15);
  await page.locator('#props-slot [data-roof-bust]').click();
  await page.waitForTimeout(150);
  await page.keyboard.press('Escape');
  // The main ridge's west end: where the west hips and the ridge meet, on
  // three pieces at once.
  const corner = await page.evaluate(() => {
    const spots = new Map();
    drawing.roofs.forEach(r => r.points.forEach(p => {
      const key = `${p.x.toFixed(2)},${p.z.toFixed(2)}`;
      spots.set(key, (spots.get(key) || 0) + 1);
    }));
    const [key, n] = [...spots.entries()].sort((a, b) => b[1] - a[1])[0];
    const [x, z] = key.split(',').map(Number);
    return { x, z, n };
  });
  expect(corner.n).toBeGreaterThanOrEqual(3);
  // Pick one of the pieces that owns that corner (a press inside it), arm
  // MOVE, and drag the corner 4' east.
  const inside = await page.evaluate(({ x, z }) => {
    const r = drawing.roofs.find(rf => rf.points.some(p => Math.abs(p.x - x) < 0.05 && Math.abs(p.z - z) < 0.05));
    const n = r.points.length;
    return { id: r.id, x: r.points.reduce((a, p) => a + p.x, 0) / n, z: r.points.reduce((a, p) => a + p.z, 0) / n };
  }, corner);
  await click(page, at, inside.x, inside.z);
  expect((await state(page)).picked).toEqual([`roof:${inside.id}`]);
  // Every other corner, to be found where it was afterwards: the drag takes
  // ONE corner (and its twins), not the pieces.
  const others = () => page.evaluate(({ x, z }) => drawing.roofs.flatMap(r => r.points
    .filter(p => Math.abs(p.z - z) > 0.05 || (Math.abs(p.x - x) > 0.05 && Math.abs(p.x - (x + 4)) > 0.05))
    .map(p => `${r.id}:${p.x.toFixed(2)},${p.z.toFixed(2)}`)).sort(), corner);
  const othersBefore = await others();
  await page.locator('#model-move').click();
  await expect(page.locator('#model-move')).toHaveAttribute('aria-pressed', 'true');
  await page.mouse.move(...at(corner.x, corner.z));
  await page.mouse.down();
  await page.mouse.move(...at(corner.x + 2, corner.z), { steps: 4 });
  await page.mouse.move(...at(corner.x + 4, corner.z), { steps: 4 });
  await page.mouse.up();
  await page.waitForTimeout(150);
  const moved = await page.evaluate(({ x, z }) => drawing.roofs.filter(r => r.points.some(p =>
    Math.abs(p.x - (x + 4)) < 0.05 && Math.abs(p.z - z) < 0.05)).length, corner);
  const left = await page.evaluate(({ x, z }) => drawing.roofs.filter(r => r.points.some(p =>
    Math.abs(p.x - x) < 0.05 && Math.abs(p.z - z) < 0.05)).length, corner);
  expect(moved, 'pieces whose corner followed the drag').toBe(corner.n);
  expect(left, 'pieces whose corner stayed behind').toBe(0);
  expect(await others(), 'every other corner').toEqual(othersBefore);
  // One UNDO puts every piece's corner back.
  await page.keyboard.press('Control+z');
  await page.waitForTimeout(150);
  const back = await page.evaluate(({ x, z }) => drawing.roofs.filter(r => r.points.some(p =>
    Math.abs(p.x - x) < 0.05 && Math.abs(p.z - z) < 0.05)).length, corner);
  expect(back).toBe(corner.n);
});

test('a piece\'s JOINT edge is named on the panel and a ROOF press does not flip it', async ({ page }) => {
  const { at } = await open(page);
  await click(page, at, 30, 15);
  await page.locator('#props-slot [data-roof-bust]').click();
  await page.waitForTimeout(150);
  // The front piece: its eave is the jog's front (z = 44), its joints run
  // back from the jog's corners. Pick it alone, walk to a JOINT edge.
  await page.keyboard.press('Escape');
  await click(page, at, 30, 42);
  const picked = await state(page);
  expect(picked.picked.length).toBe(1);
  const kinds = await page.evaluate(() => selection[0].item.edges.slice());
  const jointAt = kinds.indexOf('joint');
  expect(jointAt).toBeGreaterThanOrEqual(0);
  for (let i = 0; i <= jointAt; i++) await page.locator('#props-slot [data-roof-edge-step="next"]').click();
  await expect(page.locator('#props-slot [data-roof-edge-label]')).toHaveText(`EDGE ${jointAt + 1} OF ${kinds.length}`);
  await expect(page.locator('#props-slot [data-prop-row="edge"] [aria-pressed="true"]')).toHaveText('JOINT');
  // The ROOF tool's press flips EAVE <-> GABLE; on a JOINT it says why not.
  const mid = await page.evaluate(i => {
    const p = selection[0].item.points, a = p[i], b = p[(i + 1) % p.length];
    return { x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 };
  }, jointAt);
  await h.selectTool(page, 'roof').catch(() => page.keyboard.press('r'));
  await click(page, at, mid.x, mid.z);
  expect(await page.evaluate(i => selection[0]?.item.edges[i] ?? drawing.roofs.map(r => r.edges), jointAt)).toBe('joint');
});

// THE ELEVATIONS DO NOT CHANGE. A MOD BILEVEL with its upper roof pushed out
// over the main roof (proto/repro-modbilevel-roof-hood.draft: hoods, a cut,
// two storeys of walls under the sheets) is busted whole, and E1 / E2 paint
// the same pixels: the pieces are the planes the elevation painter was
// already reading, and a JOINT draws no fascia, rake or gable wall where a
// hip, valley or ridge was -- nor at the line a lower roof meets the upper
// storey's wall (jb, 13 Nov 2026: "it shouldn't make any markings or cuts").
const REPRO = JSON.parse(require('fs').readFileSync(
  require('path').join(__dirname, '..', 'proto', 'repro-modbilevel-roof-hood.draft'), 'utf8'));
for (const cut of ['E1', 'E2']) {
  test(`${cut} paints the busted bilevel as it painted the whole roofs`, async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await h.openModel(page, { webgl: false });
    await page.evaluate(async ({ bucket, saved }) => {
      await window.SharedFileStore.saveSharedFile(
        new File([JSON.stringify(saved)], 'model-drawing.json', { type: 'application/json' }), bucket);
    }, { bucket: BUCKET, saved: REPRO });
    await page.goto(`/MODEL.html?theme=rough&mode=day&pane=previews&right=1&level=7&lpane=build&left=1&view=cut%3A${cut}`);
    await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
    await page.waitForTimeout(1500);
    // The sheet alone: the strip above it says UNSAVED afterwards.
    const shot = () => page.evaluate(() => {
      const c = [...document.querySelectorAll('canvas')]
        .sort((a, b) => b.width * b.height - a.width * a.height)[0];
      const r = c.getBoundingClientRect();
      const sx = c.width / r.width, sy = c.height / r.height;
      return Array.from(c.getContext('2d').getImageData(
        Math.round((260 - r.left) * sx), Math.round((120 - r.top) * sy), Math.round(860 * sx), Math.round(560 * sy)).data);
    });
    const before = await shot();
    const made = await page.evaluate(() => { const n = bustRoofs(drawing.roofs.slice()); setSelection([]); paint(); return n ? n.length : 0; });
    expect(made).toBeGreaterThanOrEqual(6);
    await page.waitForTimeout(800);
    const after = await shot();
    expect(after.length).toBe(before.length);
    let changed = 0;
    for (let i = 0; i < before.length; i += 4) {
      if (Math.abs(before[i] - after[i]) > 40 || Math.abs(before[i + 1] - after[i + 1]) > 40
        || Math.abs(before[i + 2] - after[i + 2]) > 40) changed += 1;
    }
    const pixels = before.length / 4;
        // A few hundred pixels darken where a hip's line is now stroked once per
    // piece instead of once; a plane that moved would change thousands.
    expect(changed, `${changed} of ${pixels} pixels changed`).toBeLessThan(pixels * 0.0015);
  });
}

// A FASCIA OF ITS OWN (jb, 13 Nov 2026, off the 1412 Empress drawings: "see
// on the front elevation how the roof fascia is thicker than the normal roof
// - i will need to add a OBJ / PROP where i can change the fascia height of
// the induvidual roof peices"). FASCIA, IN on the ROOF panel, in inches; the
// record keeps it through a save, and the elevation hangs the deeper board.
test('FASCIA, IN on the ROOF panel sets one roof\'s board and the file keeps it', async ({ page }) => {
  const { at } = await open(page);
  await click(page, at, 30, 15);
  expect((await state(page)).picked).toEqual(['roof:roof-1']);
  const field = page.locator('#props-slot [data-roof-field="fascia, in"]');
  await expect(field).toHaveValue('5.5');
  await field.fill('10');
  await field.press('Enter');
  await page.waitForTimeout(150);
  expect(await page.evaluate(() => [drawing.roofs[0].fascia, drawing.roofs[0].follows])).toEqual([10, 'none']);
  // Out of the drafting limits is refused, not rounded: the box shows what held.
  await field.fill('40');
  await field.press('Enter');
  await page.waitForTimeout(150);
  await expect(page.locator('#props-slot [data-roof-field="fascia, in"]')).toHaveValue('10');
  expect(await page.evaluate(() => drawing.roofs[0].fascia)).toBe(10);
  await page.locator('#save').click();
  await h.waitForSaved(page);
  expect((await h.savedDrawing(page)).roofs[0].fascia).toBe(10);
  await page.reload();
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  expect(await page.evaluate(() => drawing.roofs[0].fascia)).toBe(10);
});

test('E1 hangs a 10" board under the main roof once its fascia is typed', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, saved }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(saved)], 'model-drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, saved: REPRO });
  await page.goto('/MODEL.html?theme=rough&mode=day&pane=previews&right=1&level=7&lpane=build&left=1&view=cut%3AE1');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  await page.waitForTimeout(1500);
  // Rows darker than paper down one screen column through the upper roof's eave, over
  // the 2ND FL window: the band's own depth in pixels, from its top line to
  // its heavy foot. The sheet refits a hair when the ridge rises with the
  // eave, so the band's DEPTH is read, not its place.
  const band = (x, y0, y1) => page.evaluate(({ x, y0, y1 }) => {
    const c = [...document.querySelectorAll('canvas')]
      .sort((a, b) => b.width * b.height - a.width * a.height)[0];
    const r = c.getBoundingClientRect();
    const sx = c.width / r.width, sy = c.height / r.height;
    const g = c.getContext('2d');
    const rows = [];
    for (let y = y0; y < y1; y++) {
      const v = g.getImageData(Math.round((x - r.left) * sx), Math.round((y - r.top) * sy), 1, 1).data[0];
      if (v < 200) rows.push(y);
    }
    return rows;
  }, { x, y0, y1 });
  const main = await page.evaluate(() => {
    const roof = drawing.roofs.slice().sort((a, b) => b.points.length - a.points.length)[0];
    return { id: roof.id, fascia: roof.fascia };
  });
  expect(main.fascia).toBe(5.5);
  const before = await band(790, 270, 330);
  await page.evaluate(id => {
    const roof = drawing.roofs.find(r => r.id === id);
    roof.fascia = 10; roof.follows = 'none';
    paint();
  }, main.id);
  await page.waitForTimeout(800);
  const after = await band(790, 270, 330);
  // 5 1/2" is about 7 px at this fit and 10" about 12: the board's foot
  // drops 4 1/2" further.
  const span = rows => rows.length ? rows[rows.length - 1] - rows[0] : -1;
  expect(before.length, `before ${before}`).toBeGreaterThan(1);
  expect(span(after) - span(before), `after ${after}, before ${before}`).toBeGreaterThanOrEqual(3);
});

// THE READER EVERY SHEET GOES THROUGH. MODEL keeps a roof as it was saved, but
// LAYOUT's elevations and ESTIMATES read the file through drawing-format's
// roofs(), which once wrote the standard board on every roof and knew no
// JOINT. A busted roof with a 10" fascia has to come out of it as it went in;
// a fascia past the drafting limits comes out as the standard board.
test('LAYOUT\'s reader keeps a piece\'s JOINT edges and its typed fascia', async ({ page }) => {
  await page.goto('/LAYOUT.html');
  await page.waitForFunction(() => window.DraftCutViewEnv && window.DraftDrawingFormat);
  const saved = drawing();
  saved.roofs[0].edges = ['eave', 'joint', 'joint', 'gable', 'joint', 'joint', 'joint', 'joint'];
  saved.roofs[0].fascia = 10;
  saved.roofs.push({ ...saved.roofs[0], id: 'roof-2', fascia: 40 });
  const got = await page.evaluate(saved => {
    const env = window.DraftCutViewEnv.buildCutViewEnv(saved, saved.levels.map(l => ({ ...l })));
    return env.roofs().map(r => ({ id: r.id, edges: r.edges, fascia: r.fascia }));
  }, saved);
  expect(got).toEqual([
    { id: 'roof-1', edges: saved.roofs[0].edges, fascia: 10 },
    { id: 'roof-2', edges: saved.roofs[0].edges, fascia: 5.5 },
  ]);
});
