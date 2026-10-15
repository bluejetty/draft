// A PILE IS MARKED BY WHAT STANDS OVER IT: P1, P2, P3.
//
// Movie, 15 Oct, on the foundation plan: "rather than noting the piles
// "12" PILE" just make each pile "P1"" -- then the whole rule in a line:
// "anything under 'HOUSE' type outline for any storey will need P3, and thing
// under GARAGE will need P2, and the ext piles for roof and deck P1".
//
// THE RULE ITSELF IS PINNED IN proto/pad-footing-harness.js, where pileMark is
// a pure function and the overlap cases can be asked one at a time. What only
// a page test can reach is the SEAM: that the page gathers the outlines, hands
// them to the rule, and the painter prints the answer instead of the diameter.
// The diameter has not gone anywhere -- it is the schedule's row, which is
// where a mark is a mark OF something.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const FOUNDATION = 1, MAIN_FL = 3, SECOND_FL = 5;

const rect = (x0, x1, z0, z1) => [{ x: x0, y: 0, z: z0 }, { x: x1, y: 0, z: z0 },
  { x: x1, y: 0, z: z1 }, { x: x0, y: 0, z: z1 }];

// A house, a garage beside it, and a room over the BACK HALF of that garage --
// the overlap the long telling of the rule was all about. Four piles, one for
// each answer the rule can give, and the fifth is the lot line's: a pile
// standing inside the LOT but outside every building is still P1.
const HOUSE = rect(-30, 0, -10, 10);
const GARAGE = rect(0, 20, -10, 10);
const ROOM_OVER = rect(0, 10, -10, 10);
const PILES = [
  { id: 1, at: { x: -15, z: 0 }, want: 'P3' },   // inside the house
  { id: 2, at: { x: 5, z: 0 }, want: 'P3' },     // under the room over the garage
  { id: 3, at: { x: 15, z: 0 }, want: 'P2' },    // the garage front, roof only
  { id: 4, at: { x: 30, z: 0 }, want: 'P1' },    // out in the open, a deck pile
];

const file = ({ room = true } = {}) => ({
  version: 1,
  levels: [
    { id: 8, name: 'SITE', elev: 0 }, { id: 7, name: 'ROOF', elev: 0 },
    { id: SECOND_FL, name: '2ND FL', elev: 9 }, { id: MAIN_FL, name: 'MAIN FL', elev: 0 },
    { id: FOUNDATION, name: 'FOUNDATION', elev: -8 },
  ],
  activeLevelIdx: 4,
  outlines: [
    { id: 'house', levelId: MAIN_FL, points: HOUSE },
    { id: 'garage', levelId: MAIN_FL, garage: true, points: GARAGE },
    ...(room ? [{ id: 'room', levelId: SECOND_FL, points: ROOM_OVER }] : []),
    // THE LOT LINE IS NOT A BUILDING, and it is in the fixture on purpose: it
    // wraps every pile, so a page that handed it to the rule would mark the
    // deck pile P3 and nothing else in this file would notice.
    { id: 'lot', levelId: 8, site: true, points: rect(-60, 60, -40, 40) },
  ],
  columns: PILES.map(pile => ({
    id: pile.id, point: { ...pile.at, y: 0 },
    levelId: FOUNDATION, view: 'foundation', footing: 'pile12', auto: true,
  })),
  walls: [], lines: [], floors: [], roofs: [], fenestrations: [], dimensions: [],
  shapes: [], surfaceOpenings: [], stairs: [], notes: [], roomTags: [], beams: [],
  boneyardOutlines: [], boneyardShelves: [], groups: [], levelLocks: [], underlays: [],
});

// EVERY fillText ON #plan, WITH WHERE IT LANDED, and reset at the frame
// boundary (paint() clears the canvas at the top of every frame). The position
// is what makes this a test of WHICH pile got which mark rather than of how
// many of each were painted -- four piles and three answers would otherwise be
// satisfied by handing them out in the wrong order.
async function recordText(page) {
  await page.addInitScript(() => {
    window.__marks = [];
    const onPlan = ctx => ctx.canvas && ctx.canvas.id === 'plan';
    const proto = CanvasRenderingContext2D.prototype;
    const clearRect = proto.clearRect;
    proto.clearRect = function (...args) {
      if (onPlan(this)) window.__marks = [];
      return clearRect.apply(this, args);
    };
    const fillText = proto.fillText;
    proto.fillText = function (text, x, y, ...rest) {
      if (onPlan(this)) window.__marks.push({ text: String(text), x, y });
      return fillText.call(this, text, x, y, ...rest);
    };
  });
}

async function open(page, opts = {}) {
  await recordText(page);
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, f }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, f: file(opts) });
  await page.goto(`/MODEL.html?level=${FOUNDATION}&view=foundation`);
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  await page.waitForTimeout(300);
}

// The mark painted nearest a world point, in screen pixels.
async function markAt(page, world) {
  const { at } = await h.planFrame(page);
  const [x, y] = at(world.x, world.z);
  return page.evaluate(({ x, y }) => {
    const near = (window.__marks || [])
      .filter(m => /^P\d$/.test(m.text))
      .map(m => ({ ...m, d: Math.hypot(m.x - x, m.y - y) }))
      .sort((a, b) => a.d - b.d)[0];
    return near && near.d < 40 ? near.text : null;
  }, { x, y });
}

test('each pile is marked by what stands over it', async ({ page }) => {
  await open(page);
  for (const pile of PILES) {
    expect(await markAt(page, pile.at), `the pile at x=${pile.at.x}`).toBe(pile.want);
  }
});

test('the diameter is off the plan: a pile says P-something, never 12" PILE',
  async ({ page }) => {
    await open(page);
    const painted = await page.evaluate(() => (window.__marks || []).map(m => m.text));
    expect(painted.filter(t => /^P\d$/.test(t)), 'one mark per pile').toHaveLength(PILES.length);
    expect(painted.filter(t => /PILE/i.test(t)), 'and no diameter labels').toHaveLength(0);
  });

test('take the room away and its piles go back to the garage mark',
  async ({ page }) => {
    // THE SAME FOUR PILES, ONE OUTLINE FEWER -- which is the only way to say
    // the mark is read off the outlines rather than off the pile's position in
    // the list or the order they were poured in.
    await open(page, { room: false });
    expect(await markAt(page, PILES[1].at), 'no room over it now').toBe('P2');
    expect(await markAt(page, PILES[0].at), 'the house pile is unmoved').toBe('P3');
    expect(await markAt(page, PILES[3].at), 'and so is the deck pile').toBe('P1');
  });

// ── AND THE SAME MARK ON THE SHEET ────────────────────────────────────────
//
// The Construction Layout draws its own columns through plan-composition, with
// the footing resolved by that page rather than by MODEL.html -- and it used
// to hand the painter the RAW ID, so a foundation sheet printed "pile12" under
// every pile. The same defect MODEL.html carried until the footing table went
// in, surviving here because nothing on this side read the table either.
//
// ITS OWN FIXTURE, because a LAYOUT sheet draws from the saved drawing rather
// than from the Model Space on screen: a garage with a pile inside it and one
// out in the yard, which is the shortest drawing that can tell P2 from P1.
const LAYOUT_DRAWING = {
  version: 1,
  levels: [{ id: 8, name: 'SITE', elev: 0 }, { id: 7, name: 'ROOF', elev: 0 },
    { id: MAIN_FL, name: 'MAIN FL', elev: 0 }, { id: FOUNDATION, name: 'FOUNDATION', elev: -8 }],
  activeLevelIdx: 3,
  walls: [[0, 0, 20, 0], [20, 0, 20, 14], [20, 14, 0, 14], [0, 14, 0, 0]]
    .map(([x0, z0, x1, z1], i) => ({
      id: `w${i}`, levelId: FOUNDATION, view: 'foundation', wallType: 'concrete_8',
      baseHeight: 0, topHeight: 8, start: { x: x0, y: 0, z: z0 }, end: { x: x1, y: 0, z: z1 },
    })),
  outlines: [{ id: 'garage', levelId: MAIN_FL, garage: true, points: rect(0, 20, 0, 14) }],
  columns: [
    { id: 1, point: { x: 5, y: 0, z: 7 }, levelId: FOUNDATION, view: 'foundation', footing: 'pile12' },
    { id: 2, point: { x: 30, y: 0, z: 7 }, levelId: FOUNDATION, view: 'foundation', footing: 'pile12' },
  ],
  lines: [], floors: [], roofs: [], fenestrations: [], dimensions: [], shapes: [],
  surfaceOpenings: [], stairs: [], notes: [], roomTags: [], beams: [],
  boneyardOutlines: [], boneyardShelves: [], groups: [], levelLocks: [], underlays: [],
};

test('the Construction Layout prints the mark too, not the raw id', async ({ page }) => {
  await page.goto('/LAYOUT.html');
  await page.waitForFunction(() => document.body.dataset.layoutReady === '1');
  await page.evaluate(async ({ bucket, saved }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(saved)], 'model-drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, saved: LAYOUT_DRAWING });
  await page.reload();
  await page.waitForFunction(() => document.body.dataset.layoutReady === '1');
  await page.evaluate(() => {
    window.__tags = [];
    const orig = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function (text, x, y) {
      window.__tags.push(String(text));
      return orig.call(this, text, x, y);
    };
  });
  const box = await page.locator('[data-layout-canvas]').boundingBox();
  await page.locator('[data-layout-add-viewport]').click();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForTimeout(900);

  const tags = await page.evaluate(() => (window.__tags || [])
    .filter(t => /^P\d$|pile/i.test(t)));
  expect(tags.sort(), 'the pile in the garage and the one in the yard')
    .toEqual(['P1', 'P2']);
});
