// A SECTION LOOKING INTO A BATHROOM DRAWS ITS FIXTURES, ON BOTH PAGES.
//
// The painter is proto/section-fixtures-harness.js's subject; what only a page
// can show is the WIRING: that MODEL and LAYOUT load fixture-profiles.js and
// fixture-geometry.js, and that the env a section is painted from carries the
// drawing's fixtures. Without any one of them cut-view draws no fixture --
// silently -- which is exactly what this checks for, as a difference against
// the same drawing with the fixtures taken out.
const { test, expect } = require('@playwright/test');

// THE PERF BUNGALOW'S OWN DEALT WASHROOM (proto/perf-bungalow.draft): the
// 2x6 wet wall is wall-40, along z = -31.2, the room on +z. A vanity and a
// toilet go on it; the section stands inside the room looking at it.
const FIXTURES = [
  { id: 'f1', wallId: 'wall-40', levelId: 3, view: 'plan', kind: 'vanity', layer: 'A-FIXT', offset: 1.5, width: 2.5, depth: 2, side: 1 },
  { id: 'f2', wallId: 'wall-40', levelId: 3, view: 'plan', kind: 'toilet', layer: 'A-FIXT', offset: 4.25, width: 5 / 3, depth: 7 / 3, side: 1 },
];
const CUT = { id: 9, name: 'S9', startPt: { x: -34, z: -25.5 }, endPt: { x: -24, z: -25.5 }, dirVec: { x: 0, z: 1 }, levelId: 3 };

// Strokes a section of `saved` lays down, through the page's own modules.
const strokesOn = (page, fixtures) => page.evaluate(async ({ fixtures: fx, cut }) => {
  const s = { ...(await (await fetch('/proto/perf-bungalow.draft')).json()), fixtures: fx };
  const env = window.DraftCutViewEnv.buildCutViewEnv(s, s.levels);
  const canvas = document.createElement('canvas');
  canvas.width = 1600; canvas.height = 1000;
  const ctx = canvas.getContext('2d');
  let strokes = 0;
  const stroke = ctx.stroke.bind(ctx);
  ctx.stroke = (...a) => { strokes += 1; return stroke(...a); };
  window.DraftCutView.drawCutView(env, ctx, 1600, 1000, cut, { pxPerFt: 40 });
  return strokes;
}, { fixtures, cut: CUT });

for (const pageName of ['MODEL.html', 'LAYOUT.html']) {
  test(`${pageName}: a section into the bathroom draws the vanity and the toilet`, async ({ page }) => {
    await page.goto(`/${pageName}`);
    await page.waitForFunction(() => window.DraftCutView && window.DraftCutViewEnv);
    expect(await page.evaluate(() => Boolean(window.DraftFixtureProfiles && window.DraftFixtureGeometry))).toBe(true);
    const withFixtures = await strokesOn(page, FIXTURES);
    const without = await strokesOn(page, []);
    expect(without).toBeGreaterThan(0);
    expect(withFixtures - without).toBe(2);
  });
}

// AND MODEL'S OWN SECTION VIEW, which paints from the page's own env rather
// than cut-view-env.js: the cut saved on the drawing, opened by its view id.
test('MODEL.html: the section view itself draws the fixtures', async ({ page }) => {
  await page.addInitScript(() => {
    window.__strokes = 0;
    const proto = CanvasRenderingContext2D.prototype;
    const stroke = proto.stroke;
    proto.stroke = function (...a) { window.__strokes += 1; return stroke.apply(this, a); };
  });
  const strokesInView = async fixtures => {
    await page.goto('/MODEL.html');
    await page.waitForFunction(() => window.SharedFileStore && window.DraftCutView);
    await page.evaluate(async ({ fx, cut }) => {
      const saved = { ...(await (await fetch('/proto/perf-bungalow.draft')).json()),
        fixtures: fx, cuts: [{ ...cut, elev: 4 }] };
      await window.SharedFileStore.saveSharedFile(
        new File([JSON.stringify(saved)], 'drawing.json', { type: 'application/json' }), 'model-drawing');
    }, { fx: fixtures, cut: CUT });
    await page.goto('/MODEL.html?view=cut:9');
    await expect(page.locator('#readout')).toContainText('walls', { timeout: 6000 });
    await page.waitForTimeout(500);
    await page.evaluate(() => { window.__strokes = 0; window.dispatchEvent(new Event('resize')); });
    await page.waitForTimeout(500);
    return page.evaluate(() => window.__strokes);
  };
  const without = await strokesInView([]);
  const withFixtures = await strokesInView(FIXTURES);
  expect(without).toBeGreaterThan(0);
  expect(withFixtures).toBeGreaterThan(without);
});
