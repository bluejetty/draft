// TIER 2 — MODEL.html paints fixtures through drawFixture2D.
//
// The painter itself is covered by proto/render-2d-harness.js, and the
// geometry it asks for by proto/fixture-geometry-harness.js. What only a page
// test can reach is the SEAM: which fixtures this page selects, and the two
// colours it hands over.
//
// TWO COLOURS, AND THE SECOND ONE IS THE DEFECT. drawFixture2D strokes in
// env.FIXTURE_COLOR -- which the bone sets to '#1d1f20' -- and until this
// change it FILLED the body with a literal 'rgba(255,255,255,0.65)' baked into
// the painter. Both are wrong here in opposite directions: on the night skin
// the linework wants '#e7e5e2', and a translucent white body under near-white
// lines is the fixture erased. MODEL.dc.html could never have caught either --
// one light ground, nothing to be wrong against. The port creates the defect,
// so the tests that matter run on NIGHT.
//
// NOTHING REGRESSES ON THE DAY PAGE, and that is a weaker claim here than it
// was for notes: MODEL.html painted NO fixtures at all before this, so there
// is no previous appearance to preserve. MODEL.dc.html keeps its exact literal
// (it names it in the env now instead of the painter baking it), which is
// where "no pixel moves" actually applies.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const MAIN_FL = 3;
const NIGHT_INK = '#e7e5e2';        // palette.js night draw-fixture
const NIGHT_FILL = '#1d1f20a6';     // night surface-page at 0.65
const DAY_INK = '#1d1f20';          // palette.js day draw-fixture
const DAY_FILL = '#f2f2f3a6';       // day surface-page at 0.65
const OLD_LITERAL = 'rgba(255,255,255,0.65)';

// Every strokeStyle and fillStyle the page sets, from the first frame.
async function recordPaint(page) {
  await page.addInitScript(() => {
    window.__strokes = [];
    window.__fills = [];
    const proto = CanvasRenderingContext2D.prototype;
    for (const [prop, sink] of [['strokeStyle', '__strokes'], ['fillStyle', '__fills']]) {
      const desc = Object.getOwnPropertyDescriptor(proto, prop);
      Object.defineProperty(proto, prop, {
        set(v) { window[sink].push(String(v)); return desc.set.call(this, v); },
        get() { return desc.get.call(this); },
      });
    }
  });
}

async function houseOnOldPage(page) {
  await h.openModel(page, { webgl: false, rails: false, entryCoach: true });
  await expect(page.locator('[data-entry-coach]')).toBeVisible({ timeout: 4000 });
  await page.locator('[data-first-bone-press]').click();
  await h.waitForSaved(page);
}

async function loadWith(page, src, mode = 'night') {
  await page.evaluate(async ({ bucket, src: s }) => {
    const file = await window.SharedFileStore.loadSharedFile(bucket);
    const drawing = JSON.parse(await file.text());
    // eslint-disable-next-line no-new-func
    const out = new Function('d', s)(drawing) || drawing;
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(out)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, src });
  await page.goto(`/MODEL.html?mode=${mode}`);
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 6000 });
}

// The host wall is chosen from the drawing rather than hardcoded: the bone's
// first press is free to change what it builds, and a spec that names a wall
// id breaks on a house that is still perfectly correct.
const HOST = `
  const plan = d.walls.filter(w => Number(w.levelId) === ${MAIN_FL} && (w.view || 'plan') === 'plan');
  const len = w => Math.hypot(w.end.x - w.start.x, w.end.z - w.start.z);
  const host = plan.sort((a, b) => len(b) - len(a))[0];
`;
const sink = ({ id, wallId = 'host.id', levelId = MAIN_FL }) => `{
  id: '${id}', wallId: ${wallId}, levelId: ${levelId}, kind: 'sink',
  offset: len(host) / 2, width: 2, depth: 2, side: 1
}`;

const lower = a => a.map(v => v.toLowerCase());

test('a fixture paints, in neither the night page\'s ink nor its old white', async ({ page }) => {
  await recordPaint(page);
  await houseOnOldPage(page);
  await loadWith(page, `${HOST} d.fixtures = [${sink({ id: 'fx-1' })}];`);

  const strokes = lower(await page.evaluate(() => window.__strokes.slice()));
  const fills = lower(await page.evaluate(() => window.__fills.slice()));

  expect(strokes).toContain(NIGHT_INK);
  expect(fills).toContain(NIGHT_FILL);

  // THE INEQUALITY THAT MAKES THAT MEAN SOMETHING. Asserting the right colour
  // appears is satisfied by a page that ALSO paints the wrong one, and the
  // literal the painter used to carry is exactly the wrong one -- a white blob
  // on a #1d1f20 ground. It must be absent, not merely outnumbered.
  expect(fills).not.toContain(OLD_LITERAL);
  expect(NIGHT_INK).not.toBe(NIGHT_FILL);
});

// THE DISCRIMINATOR. draw-fixture's night value is '#e7e5e2', and so is
// draw-note's and ink-primary's -- a fixture is drawn in body ink like
// everything else on the sheet. So "the page stroked #e7e5e2" would pass on a
// paintFixtures() that never ran. The FILL is the one colour nothing else on
// this page reaches for, so take the fixture away and watch it go.
test('and that fill is the fixture\'s -- with no fixtures, it is never set', async ({ page }) => {
  await recordPaint(page);
  await houseOnOldPage(page);
  await loadWith(page, 'd.fixtures = [];');

  const fills = lower(await page.evaluate(() => window.__fills.slice()));
  expect(fills).not.toContain(NIGHT_FILL);
});

test('a fixture on another level does not paint', async ({ page }) => {
  await recordPaint(page);
  await houseOnOldPage(page);
  await loadWith(page, `${HOST} d.fixtures = [${sink({ id: 'fx-2', levelId: 1 })}];`);

  const fills = lower(await page.evaluate(() => window.__fills.slice()));
  expect(fills).not.toContain(NIGHT_FILL);
});

// THE INHERITANCE, WHICH IS THE WHOLE SELECTION RULE. A fixture carries no
// view of its own -- drawing-format.js:179 stamps every one 'plan' regardless
// of what was saved -- so filtering on fixture.view would be filtering on a
// constant and would show a fixture whose host wall is hidden. The rule is
// that a fixture shows when ITS WALL shows, and this is the case that tells
// the two apart: a wall on the FOUNDATION layer set, on the level being
// viewed, holding a fixture stamped 'plan'.
test('a fixture on a wall this view does not show stays hidden', async ({ page }) => {
  await recordPaint(page);
  await houseOnOldPage(page);
  await loadWith(page, `
    ${HOST}
    const buried = JSON.parse(JSON.stringify(host));
    buried.id = 'w-buried';
    buried.view = 'foundation';
    d.walls.push(buried);
    d.fixtures = [${sink({ id: 'fx-3', wallId: "'w-buried'" })}];
  `);

  const fills = lower(await page.evaluate(() => window.__fills.slice()));
  expect(fills).not.toContain(NIGHT_FILL);
});

// The alcove path, which is the half of fixture-geometry.js the simple cases
// never reach: a tub asks for a second wall, scans for what closes the alcove,
// stretches to fit and decks the remainder. If any of the four functions had
// not come across, this is where it shows.
test('a tub fills its alcove, so the whole geometry closure came across', async ({ page }) => {
  await recordPaint(page);
  await houseOnOldPage(page);
  await loadWith(page, `
    ${HOST}
    // A faucet wall crossing the host near one end, so there is an alcove to fill.
    const ux = (host.end.x - host.start.x) / len(host);
    const uz = (host.end.z - host.start.z) / len(host);
    const at = t => ({ x: host.start.x + ux * t, y: host.start.y || 0, z: host.start.z + uz * t });
    const cross = (id, t) => ({
      id, levelId: ${MAIN_FL}, view: 'plan', wallType: 'stud_2x4', refLine: 'center',
      start: { ...at(t), x: at(t).x - uz * 6, z: at(t).z + ux * 6 },
      end: { ...at(t), x: at(t).x + uz * 6, z: at(t).z - ux * 6 },
    });
    d.walls.push(cross('w-faucet', 1), cross('w-far', 7));
    d.fixtures = [{
      id: 'fx-tub', wallId: host.id, levelId: ${MAIN_FL}, kind: 'tub',
      endWallId: 'w-faucet', dir: 1, offset: 0, width: 5, depth: 2.5, side: 1,
    }];
  `);

  const fills = lower(await page.evaluate(() => window.__fills.slice()));
  expect(fills).toContain(NIGHT_FILL);
});

// The day page gets its own ground, not the night one and not the painter's
// old white. This is the pair that proves the colours are READ rather than
// picked: the same drawing, two modes, two answers.
test('the day page paints them in the day ground and the day ink', async ({ page }) => {
  await recordPaint(page);
  await houseOnOldPage(page);
  await loadWith(page, `${HOST} d.fixtures = [${sink({ id: 'fx-4' })}];`, 'day');

  const strokes = lower(await page.evaluate(() => window.__strokes.slice()));
  const fills = lower(await page.evaluate(() => window.__fills.slice()));
  expect(strokes).toContain(DAY_INK);
  expect(fills).toContain(DAY_FILL);
  expect(fills).not.toContain(NIGHT_FILL);
  expect(fills).not.toContain(OLD_LITERAL);
});
