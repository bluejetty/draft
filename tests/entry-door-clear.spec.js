// THE FRONT DOOR STANDS CLEAR OF THE GARAGE (Movie, 17 Oct, on his traced
// MOD BILEVEL, the plan beside its E1):
//
//   "The front Door can't bump into the garage like that it needs at least
//    4-6 from the edge of the garage wall to the side of the entry area, so
//    the entry area needs to be increased in this situation to acommodate
//    the door to have full 4'6 space so the door fits plus extra 9" approx on
//    each side"
//
// His garage, as traced, stood a foot over the house line -- the tie jog --
// so it touched the house's front line only at its corner. traced-plans.js
// read the garage line there, the clamp dragged it six feet in, and the
// garage's side wall then stood four feet inside the landing's street half:
// two feet of entry beside the garage, the door across the garage wall.
//
// So the garage line is read off the garage's reach along the front (its
// footprint at or forward of the front line, a jog behind it allowed for),
// which is where its side wall really stands; the landing straddles that
// with its full six feet of street half; and the street door stands centred
// in the street half, a foot and a quarter off the garage wall and off the
// entry's side, in a 5'-1" clear that is over his 4'-6". Traced here the
// way he traced it, built by the bone, read back off the saved file.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const empty = () => ({
  version: 1, planTurn: 3, board: 'drafting',
  levels: [{ id: 8, name: 'SITE', elev: 0 }, { id: 7, name: 'ROOF', elev: 18 },
    { id: 5, name: '2ND FL', elev: 9 }, { id: 4, name: 'OVER GARAGE', elev: 6 },
    { id: 3, name: 'MAIN FL', elev: 0 }, { id: 2, name: 'ENTRY', elev: -4 },
    { id: 1, name: 'FOUNDATION', elev: -10 }],
  activeLevelIdx: 4,
  walls: [], lines: [], floors: [], roofs: [], fenestrations: [], dimensions: [],
  outlines: [], shapes: [], surfaceOpenings: [], stairs: [], notes: [],
  roomTags: [], columns: [], beams: [], boneyardOutlines: [],
  groups: [], levelLocks: [], underlays: [],
});
// His loops (saved 17 Oct 12:27, planTurn 3): a 46 x 23 house and a garage
// whose wall along the house stands at x = -1, a foot over the house's x = 0.
const HOUSE = [[0, 0], [0, -23], [-46, -23], [-46, 0]];
const GARAGE = [[0, -1], [-1, -1], [-1, -10], [25, -10], [25, 15], [-1, 15], [-1, 0], [0, 0]];

async function traceModBilevel(page, house = HOUSE, garage = GARAGE, { foot = false } = {}) {
  await h.openModel(page, { webgl: false });
  // THE 1' LIGHT, for a trace with a one-foot jog: each press on the foot,
  // as he draws it, rather than caught by the corner a foot away.
  if (foot) {
    await page.evaluate(() => {
      const keep = JSON.parse(localStorage.getItem('draft-skin') || '{}');
      localStorage.setItem('draft-skin', JSON.stringify({ ...keep, footLight: true }));
    });
  }
  await page.evaluate(async ({ bucket, f }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, f: empty() });
  await page.goto('/MODEL.html');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  await h.openDriveThru(page);
  await page.locator('[data-build-family="bilevel"]').click();
  await page.locator('[data-build-entry="modifiedBilevel"]').click();
  await page.locator('#dt-banner-outline').click();
  await expect(page.locator('#drivethru')).toBeHidden();
  await h.dropSeededCorner(page);
  const { at } = await h.planFrame(page);
  const walk = async corners => {
    for (const [x, z] of [...corners, corners[0]]) {
      await page.mouse.click(...at(x, z));
      await page.waitForTimeout(60);
    }
    await page.waitForTimeout(600);
    for (const sel of ['#garage-lesson', '#corner-join']) {
      if (await page.locator(sel).isVisible().catch(() => false)) {
        await page.keyboard.press('Enter');
        await page.waitForTimeout(250);
      }
    }
  };
  await walk(house);
  await walk(garage);
  await page.waitForTimeout(600);
  await page.locator('#bone').click();
  await page.waitForTimeout(2500);
  const choice = page.locator('#build-choice');
  if (await choice.isVisible().catch(() => false)) {
    await choice.getByRole('button', { name: /build it/i }).click();
    await page.waitForTimeout(2500);
  }
  if (await page.locator('#lot-pick').isVisible().catch(() => false)) {
    await page.locator('#lot-pick [data-lot-pick-skip]').click();
  }
  await page.waitForTimeout(600);
  await page.locator('#save').click();
  await h.waitForSaved(page);
  return h.savedDrawing(page);
}

const span = pts => {
  const xs = pts.map(p => p.x), zs = pts.map(p => p.z);
  return [Math.min(...xs), Math.max(...xs), Math.min(...zs), Math.max(...zs)];
};

test('his jogged garage: the landing straddles the garage\'s real side wall and the front door stands clear of it',
  async ({ page }) => {
    const d = await traceModBilevel(page);
    const walls = d.walls;
    const byId = Object.fromEntries(walls.map(w => [w.id, w]));

    // THE LANDING: six feet under the garage (z -10..-4) and six feet of
    // street (z -16..-10), not the two feet beside the garage it had.
    const entry = d.outlines.find(o => Number(o.levelId) === 2);
    expect(entry, 'an ENTRY body').toBeTruthy();
    expect(span(entry.points)).toEqual([-6, 0, -16, -4]);

    // THE GARAGE WALL IT STRADDLES is still where he traced it, at z = -10.
    const garageEnd = walls.find(w => w.body === 'garage' && Number(w.levelId) === 3
      && Math.abs(w.start.z + 10) < 1e-6 && Math.abs(w.end.z + 10) < 1e-6);
    expect(garageEnd, 'the garage\'s wall along z = -10').toBeTruthy();

    // THE STREET DOOR: on the entry's front (x = 0), wholly in the street
    // half, nine inches and more off the garage wall and off the entry's
    // side -- centred, so a foot and a quarter each way.
    const entryFront = walls.filter(w => Number(w.levelId) === 2
      && Math.abs(w.start.x) < 1e-6 && Math.abs(w.end.x) < 1e-6);
    const doors = d.fenestrations.filter(f => f.type === 'door' && entryFront.some(w => w.id === f.wallId));
    const placed = doors.map(f => {
      const w = byId[f.wallId];
      const dir = Math.sign(w.end.z - w.start.z);
      const a = w.start.z + dir * f.offset, b = a + dir * f.width;
      return { lo: Math.min(a, b), hi: Math.max(a, b), width: f.width };
    });
    const street = placed.filter(p => p.hi <= -10 + 1e-6);
    expect(street, 'one door in the street half').toHaveLength(1);
    const [door] = street;
    expect(door.width).toBe(3);
    expect(-10 - door.hi, 'clear of the garage wall').toBeGreaterThanOrEqual(0.75);
    expect(door.lo - -16, 'clear of the entry\'s side').toBeGreaterThanOrEqual(0.75);
    expect((door.lo + door.hi) / 2).toBeCloseTo(-13, 3);
    // AND THE OTHER DOOR is the one into the garage, in the garage half.
    expect(placed.filter(p => p.lo >= -10 - 1e-6).length, 'the door in from the garage').toBe(1);
  });

// ── THE HOUSE FRONT STEPS BACK A FOOT WHERE THE GARAGE MEETS IT (22 Oct) ──
// Movie, on his MOD BILEVEL (saved 1118): "for MODIFIED bilevel the 2 EXT
// doors NEED to STRADDLE the GARAGE WALL - if you need to increase the size
// of the ENTRY DO IT"; "the little jog confused you i think". Here it is the
// HOUSE that jogs: its front stands at x = 0 beside the garage and a foot
// behind, at x = -1, along the garage's back wall. The landing was held to
// the forward stretch and slid five feet off the garage's side wall (z = 1),
// both doors on the street. It straddles that wall now: its garage half
// stands back to the garage's wall, with the door into the garage in it.
const HOUSE_JOG = [[0, 0], [-1, 0], [-1, -38], [-23, -38], [-23, 30], [0, 30]];
const GARAGE_JOG = [[0, 0], [0, 1], [14, 1], [14, -21], [-1, -21], [-1, 0]];

test('his house jogging back at the garage: the landing straddles the garage wall, a door each side of it',
  async ({ page }) => {
    const d = await traceModBilevel(page, HOUSE_JOG, GARAGE_JOG, { foot: true });
    const walls = d.walls;
    const byId = Object.fromEntries(walls.map(w => [w.id, w]));
    const entry = d.outlines.find(o => Number(o.levelId) === 2);
    expect(entry, 'an ENTRY body').toBeTruthy();
    // SIX FEET EACH SIDE OF THE GARAGE WALL AT z = 1, six deep.
    expect(span(entry.points)).toEqual([-6, 0, -5, 7]);
    // THE GARAGE HALF STANDS BACK TO THE GARAGE'S WALL, x = -1.
    expect(entry.points.some(p => Math.abs(p.x + 1) < 1e-6 && p.z < 1)).toBe(true);
    // ONE DOOR ON THE STREET, the other on the wall shared with the garage.
    const doors = d.fenestrations.filter(f => f.type === 'door' && Number(f.levelId) === 2).map(f => {
      const w = byId[f.wallId];
      const len = Math.hypot(w.end.x - w.start.x, w.end.z - w.start.z);
      const t = s => ({ x: w.start.x + (w.end.x - w.start.x) * s / len, z: w.start.z + (w.end.z - w.start.z) * s / len });
      return [t(f.offset), t(f.offset + f.width)];
    });
    expect(doors, 'two doors into the landing').toHaveLength(2);
    const street = doors.filter(([a, b]) => Math.abs(a.x) < 1e-6 && Math.abs(b.x) < 1e-6);
    const garage = doors.filter(([a, b]) => Math.abs(a.x + 1) < 1e-6 && Math.abs(b.x + 1) < 1e-6);
    expect(street, 'the street door on the front').toHaveLength(1);
    expect(garage, 'the door into the garage on its wall').toHaveLength(1);
    expect(Math.min(street[0][0].z, street[0][1].z), 'the street door wholly past the garage wall').toBeGreaterThanOrEqual(1);
    expect(Math.max(garage[0][0].z, garage[0][1].z), 'the garage door wholly behind it').toBeLessThanOrEqual(1 + 1e-6);
    if (process.env.DRAFT_LOOK) {
      await page.screenshot({ path: `${process.env.DRAFT_LOOK}/plan.png` });
      await h.openModelRail(page);
      await page.locator('.seat[data-seat="E1"]').click();
      await page.waitForTimeout(1500);
      await page.screenshot({ path: `${process.env.DRAFT_LOOK}/e1.png` });
    }
  });
