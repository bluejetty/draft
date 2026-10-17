// THE WIREFRAME SHOWS THE STAIRS, AND A DOOR OR WINDOW SLIDES ALONG ITS WALL.
//
// Movie, 16 Oct, on BONEYARD.html: "can you add the stairs to the wireframe
// so i can adjust the openings around the stairs", and "also on the
// wireframe i'd like to be able to select the windows and doors and then
// move them along the wall surface".
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const empty = () => ({
  version: 1, planTurn: 0,
  levels: [{ id: 8, name: 'SITE', elev: 0 }, { id: 7, name: 'ROOF', elev: 0 },
    { id: 5, name: '2ND FL', elev: 9 }, { id: 3, name: 'MAIN FL', elev: 0 },
    { id: 1, name: 'FOUNDATION', elev: -8 }],
  activeLevelIdx: 3,
  walls: [], lines: [], floors: [], roofs: [], fenestrations: [], dimensions: [],
  outlines: [], shapes: [], surfaceOpenings: [], stairs: [], notes: [],
  roomTags: [], columns: [], beams: [], boneyardOutlines: [],
  groups: [], levelLocks: [], underlays: [],
});

async function boneyardOf(page, family, entry) {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, f }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, f: empty() });
  await page.goto('/MODEL.html');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  await h.openDriveThru(page);
  await page.locator(`#dt-tiles [data-build-family="${family}"]`).click();
  await page.locator(`#dt-tiles [data-build-entry="${entry}"]`).click();
  await page.locator('#dt-bone').click();
  await page.waitForTimeout(500);
  await page.keyboard.press('Escape');
  await page.locator('#save').click();
  await h.waitForSaved(page);
  await page.goto('/BONEYARD.html');
  await expect(page.locator('body')).toHaveAttribute('data-boneyard-ready', '1', { timeout: 10000 });
}

const frameOf = async page => {
  const canvas = page.locator('#bones2d');
  const frame = JSON.parse(await canvas.getAttribute('data-frame'));
  const box = await canvas.boundingBox();
  return { frame, box, at: p => [box.x + frame.ox + p.x * frame.s, box.y + frame.oy + p.z * frame.s] };
};
async function dragWorld(page, from, to) {
  const { at } = await frameOf(page);
  await page.mouse.move(...at(from));
  await page.mouse.down();
  await page.mouse.move(...at({ x: (from.x + to.x) / 2, z: (from.z + to.z) / 2 }), { steps: 4 });
  await page.mouse.move(...at(to), { steps: 4 });
  await page.mouse.up();
}
const saved = async (page, n) => {
  await expect(page.locator('body')).toHaveAttribute('data-boneyard-saves', String(n), { timeout: 5000 });
  return h.savedDrawing(page);
};
// Ink that is not the paper, in a box around a canvas point, counted. The
// paper is read off the canvas's own corner, so this holds on either skin.
const inkAround = (page, x, y, r = 6) => page.evaluate(({ x, y, r }) => {
  const c = document.getElementById('bones2d');
  const box = c.getBoundingClientRect();
  const sx = c.width / box.width, sy = c.height / box.height;
  const g = c.getContext('2d');
  const paper = g.getImageData(2, 2, 1, 1).data;
  const { data } = g.getImageData(Math.round(x * sx) - r, Math.round(y * sy) - r, 2 * r, 2 * r);
  let ink = 0;
  for (let i = 0; i < data.length; i += 4) {
    const away = Math.max(Math.abs(data[i] - paper[0]), Math.abs(data[i + 1] - paper[1]), Math.abs(data[i + 2] - paper[2]));
    if (away > 40) ink += 1;
  }
  return ink;
}, { x, y, r });

test('the stairs stand on the wireframe\'s plan, on the level they are on', async ({ page }) => {
  test.setTimeout(90000);
  await boneyardOf(page, 'bungalow', 'twoStorey');
  const d = await h.savedDrawing(page);
  const stair = (d.stairs || []).find(s => Number(s.levelId) === 3 && s.start && s.end);
  expect(stair, 'the 2 STOREY was built with a stair on MAIN FL').toBeTruthy();
  await page.locator('[data-bone-level="MAIN FL"]').click();
  await page.waitForTimeout(300);
  const shown = Number(await page.locator('#bones2d').getAttribute('data-stairs'));
  expect(shown, 'MAIN FL draws its stairs').toBeGreaterThan(0);
  // INK WHERE THE FLIGHT IS: a quarter of the way down it, mid width, which
  // is inside the house and on no bone edge.
  const { frame, box } = await frameOf(page);
  const dx = stair.end.x - stair.start.x, dz = stair.end.z - stair.start.z;
  const len = Math.hypot(dx, dz) || 1;
  const p = { x: stair.start.x + dx / len * 2, z: stair.start.z + dz / len * 2 };
  const sx = frame.ox + p.x * frame.s, sy = frame.oy + p.z * frame.s;
  expect(await inkAround(page, sx, sy, Math.max(6, Math.round(stair.widthFt / 2 * frame.s))),
    'tread lines under the probe').toBeGreaterThan(8);
  // AND NOT ON A LEVEL WITH NO STAIR OF ITS OWN: the ROOF.
  await page.locator('[data-bone-level="ROOF"]').click();
  await page.waitForTimeout(300);
  expect(Number(await page.locator('#bones2d').getAttribute('data-stairs'))).toBe(0);
});

test('a door dot slides along its wall by whole feet, and the house follows', async ({ page }) => {
  test.setTimeout(90000);
  await boneyardOf(page, 'bungalow', 'bungalow');
  await page.locator('[data-bone-level="MAIN FL"]').click();
  await page.waitForTimeout(300);
  const before = await h.savedDrawing(page);
  const { frame } = await frameOf(page);
  const dots = JSON.parse(await page.locator('#bones2d').getAttribute('data-openings'));
  const door = dots.find(o => o.type === 'door');
  expect(door, 'a door on the bone').toBeTruthy();
  // The dot in plan feet, and the edge it sits on.
  const at = { x: (door.at[0] - frame.ox) / frame.s, z: (door.at[1] - frame.oy) / frame.s };
  const loops = JSON.parse(await page.locator('#bones2d').getAttribute('data-loops'));
  let along = null;
  loops.forEach(loop => {
    const pts = loop.map(([x, z]) => ({ x, z }));
    pts.forEach((a, i) => {
      const b = pts[(i + 1) % pts.length];
      const ex = b.x - a.x, ez = b.z - a.z, len = Math.hypot(ex, ez);
      if (!(len > 0)) return;
      const t = ((at.x - a.x) * ex + (at.z - a.z) * ez) / len;
      const off = Math.abs((at.x - a.x) * ez - (at.z - a.z) * ex) / len;
      if (t > -0.1 && t < len + 0.1 && off < 0.5) along = { x: ex / len, z: ez / len };
    });
  });
  expect(along, 'the dot sits on a bone edge').toBeTruthy();
  // THE WAY WITH ROOM: the other dots on this edge, each way, and the
  // corner; the drag goes toward the bigger gap so it lands on nothing.
  const gap = sign => {
    let nearest = Infinity;
    dots.forEach(o => {
      if (o === door) return;
      const w = { x: (o.at[0] - frame.ox) / frame.s, z: (o.at[1] - frame.oy) / frame.s };
      const t = ((w.x - at.x) * along.x + (w.z - at.z) * along.z) * sign;
      const off = Math.abs((w.x - at.x) * along.z - (w.z - at.z) * along.x);
      if (t > 0 && off < 0.5) nearest = Math.min(nearest, t);
    });
    return nearest;
  };
  if (gap(-1) > gap(1)) along = { x: -along.x, z: -along.z };
  const to = { x: at.x + along.x * 3, z: at.z + along.z * 3 };
  await dragWorld(page, at, to);
  const after = await saved(page, 1);
  // ONE OPENING MOVED, BY 3 FT ALONG ITS WALL, AND ONLY ITS OFFSET.
  const centre = (d, f) => {
    const w = d.walls.find(x => String(x.id) === String(f.wallId));
    const wx = w.end.x - w.start.x, wz = w.end.z - w.start.z, wl = Math.hypot(wx, wz);
    return { x: w.start.x + wx * f.offset / wl, z: w.start.z + wz * f.offset / wl };
  };
  const moved = after.fenestrations.filter(f => {
    const was = before.fenestrations.find(g => String(g.id) === String(f.id));
    return was && Math.abs(Number(was.offset) - Number(f.offset)) > 1e-6;
  });
  expect(moved.length, 'exactly one opening moved').toBe(1);
  const was = before.fenestrations.find(g => String(g.id) === String(moved[0].id));
  expect(moved[0].wallId, 'still in its wall').toBe(was.wallId);
  const c0 = centre(before, was), c1 = centre(after, moved[0]);
  expect(Math.hypot(c1.x - c0.x, c1.z - c0.z), 'three feet along the wall').toBeCloseTo(3, 3);
  expect((c1.x - c0.x) * along.x + (c1.z - c0.z) * along.z, 'the way it was dragged').toBeCloseTo(3, 3);
  expect(after.walls.length, 'no wall was touched').toBe(before.walls.length);
  // AND THE DOT ON THE BONE MOVED WITH IT.
  const dotsAfter = JSON.parse(await page.locator('#bones2d').getAttribute('data-openings'));
  const near = dotsAfter.find(o => o.type === 'door'
    && Math.hypot(o.at[0] - (frame.ox + to.x * frame.s), o.at[1] - (frame.oy + to.z * frame.s)) < 2);
  expect(near, 'the door dot stands 3 ft along').toBeTruthy();
  // UNDO takes it back.
  await page.locator('#undo').click();
  const back = await saved(page, 2);
  expect(back.fenestrations.find(g => String(g.id) === String(was.id)).offset).toBeCloseTo(Number(was.offset), 6);
});
