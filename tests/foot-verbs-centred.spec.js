// UNDO, DELETE, COPY AND PASTE STAND IN THE GAP LEFT OF THE BONE (Movie, 14
// Oct): "when the UNDO / COPY or other buttons show up in this location can we
// put them centered between the BONE and the RIGHT HAND Layout stuff", then,
// over a markup of where they sat, "too close to the bone and also it should
// be centered UP/DOWN same as the bone please", on two at once: "when there
// are 2 center them both out with consideration for the larger area they
// cover", and finally "actually can these UNDO etc buttons go on the LEFT side
// of the bone, there is more space because the button text on that side isn't
// as long".
//
// WHAT THIS FILE WATCHES is a measurement, not a rule. The old arrangement was
// a fixed padding on #dt-bar, which reserved room for the trio and let the
// verbs land wherever that left them -- the "too close" in his report -- and
// it looked right on the window it was tuned on. So every check here reads the
// two edges the group is meant to sit between and does the arithmetic, rather
// than naming a number that would need retuning the next time a chip gains a
// word.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const MAIN_FL = 3;
const TOL = 1.5;

const wall = (id, x0, z0, x1, z1) => ({
  id, levelId: MAIN_FL, view: 'plan', wallType: 'stud_2x6', refLine: 'center',
  baseHeight: 0, topHeight: 8, start: { x: x0, y: 0, z: z0 }, end: { x: x1, y: 0, z: z1 },
});
const HOUSE = {
  format: 'draft-drawing', version: 1,
  levels: [
    { id: 8, name: 'SITE', elev: 0 }, { id: 7, name: 'ROOF', elev: 18 },
    { id: 5, name: '2ND FL', elev: 9 }, { id: MAIN_FL, name: 'MAIN FL', elev: 0 },
    { id: 1, name: 'FOUNDATION', elev: -10 },
  ],
  walls: [wall('w-n', -10, -8, 10, -8), wall('w-e', 10, -8, 10, 8),
    wall('w-s', 10, 8, -10, 8), wall('w-w', -10, 8, -10, -8)],
  board: 'drafting',
};

async function open(page) {
  await page.goto('/MODEL.dc.html');
  await page.waitForFunction(() => !!window.SharedFileStore, null, { timeout: 10000 });
  await page.evaluate(async ({ bucket, saved }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(saved)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, saved: HOUSE });
  await page.goto(`/MODEL.html?mode=night&level=${MAIN_FL}`);
  await expect(page.locator('#readout')).toContainText('scale', { timeout: 10000 });
}

// The readout publishes the scale, and every level is centred on the origin,
// so world (0,0) is the canvas centre -- the same arithmetic the note and
// room-tag specs use to press on something that is drawn.
async function pressWorld(page, x, z) {
  const hit = (await page.locator('#readout').textContent()).match(/scale ([\d.]+) px\/ft/);
  expect(hit, 'the readout publishes the scale').toBeTruthy();
  const scale = Number(hit[1]);
  const box = await page.locator('#plan').boundingBox();
  await page.mouse.click(box.x + box.width / 2 + x * scale, box.y + box.height / 2 + z * scale);
  await page.waitForTimeout(80);
}

// WHERE EVERYTHING IS, IN ONE READ: the rectangles taken in the same frame,
// because reading them across four calls lets a repaint move one of them.
const measure = page => page.evaluate(() => {
  const box = id => {
    const el = document.getElementById(id);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return {
      left: r.left, right: r.right, width: r.width,
      mid: r.left + r.width / 2, midY: r.top + r.height / 2,
    };
  };
  const verbs = document.getElementById('dt-verbs');
  return {
    verbs: box('dt-verbs'), trio: box('dt-trio'), bone: box('bone'), pages: box('page-row'),
    showing: [...(verbs ? verbs.children : [])].filter(el => !el.hidden).map(el => el.id),
  };
});

// A WALL PICKED AND DELETED leaves UNDO standing on its own, which is the
// one-verb case; the pick itself is the several-verb case, and the two are
// one gesture apart on purpose -- a drafter sees both within a second.
async function undoAlone(page) {
  await pressWorld(page, 0, -8);
  await expect(page.locator('#delete')).toBeVisible();
  await page.keyboard.press('Delete');
  await expect(page.locator('#delete')).toBeHidden();
  await expect(page.locator('#model-undo')).toBeVisible();
}

test('one verb sits in the middle of the gap, on the bone\'s own line', async ({ page }) => {
  await open(page);
  await undoAlone(page);
  const at = await measure(page);
  expect(at.showing, 'this is the one-verb case').toEqual(['model-undo']);
  // LEFT OF THE TRIO, the side he settled on and the side with the room: the
  // page row's four short chips end far sooner than the sheet row's
  // CONSTRUCTION LAYOUT and SPECIFICATIONS begin.
  expect(at.verbs.right, 'the verbs are on the wrong side of the bone')
    .toBeLessThan(at.trio.left);
  // AND CENTRED IN IT. Not "clear of the bone", which the old padding already
  // managed: the claim is that the two gaps either side of the group match.
  const gapLeft = at.verbs.left - at.pages.right;
  const gapRight = at.trio.left - at.verbs.right;
  expect(Math.abs(gapLeft - gapRight),
    `not centred in the gap (${gapLeft.toFixed(1)} left, ${gapRight.toFixed(1)} right)`)
    .toBeLessThan(TOL);
  // AND ON THE BONE'S LINE UP AND DOWN, the second half of the report and
  // never true before: the verbs rode #dt-bar's middle, and the bone sits half
  // the browser lane below that.
  expect(Math.abs(at.verbs.midY - at.bone.midY),
    'the verbs do not share the bone\'s middle').toBeLessThan(TOL);
});

test('more verbs widen the group about the same middle', async ({ page }) => {
  await open(page);
  await undoAlone(page);
  const one = await measure(page);
  // SOMETHING SELECTED brings DELETE and COPY up beside UNDO, which is the
  // case he drew two buttons for.
  await pressWorld(page, 10, 0);
  await expect(page.locator('#delete')).toBeVisible();
  const many = await measure(page);
  expect(many.showing.length, 'the selection brought no second verb up')
    .toBeGreaterThan(one.showing.length);
  expect(many.verbs.width, 'the box did not grow with them')
    .toBeGreaterThan(one.verbs.width);

  // THE GROUP IS WHAT IS CENTRED -- "center them both out with consideration
  // for the larger area they cover". The extra width goes both ways: the
  // middle stays where it was, and UNDO moves LEFT rather than standing still
  // while DELETE is added to its right.
  const gapLeft = many.verbs.left - many.pages.right;
  const gapRight = many.trio.left - many.verbs.right;
  expect(Math.abs(gapLeft - gapRight), 'the group is not centred as a group')
    .toBeLessThan(TOL);
  expect(Math.abs(many.verbs.mid - one.verbs.mid),
    'the middle moved when the second verb arrived').toBeLessThan(TOL);
  expect(many.verbs.left, 'the first verb did not make room for the second')
    .toBeLessThan(one.verbs.left);
});

test('and it never climbs onto either neighbour when the window narrows', async ({ page }) => {
  await open(page);
  await undoAlone(page);
  // THE GAP CLOSES ON A SMALL WINDOW, and a group centred in a gap narrower
  // than itself would sit on the bone or on EXT. FINISH. The seat clamps; what
  // is checked here is that it has not simply ignored one edge.
  await page.setViewportSize({ width: 900, height: 700 });
  await page.waitForTimeout(250);
  const at = await measure(page);
  expect(at.verbs.right, 'the verbs are standing on the trio')
    .toBeLessThanOrEqual(at.trio.left + 0.5);
  expect(at.verbs.left, 'the verbs are standing on the page row')
    .toBeGreaterThanOrEqual(at.pages.right - 0.5);
});
