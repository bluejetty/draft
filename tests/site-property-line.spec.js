// THE PROPERTY LINE (Movie, 14 Oct): "site plan is working better now, can we
// make the SITE OUTLINE for the property THICK BLACK LINES on the layout for
// contruction plan and on the NIGHT make them bright thick white and make the
// long DASH and THICK DOT - LONG DASH - THICK DOT repeated over and over".
//
// THE LOT IS DRAWN TWICE, in two files, and that is what this watches. The
// SHEET draws it in layout-plan.js's drawSitePlan; the SCREEN draws it in
// render-2d.js's drawOutlines2D, where it is also draggable. Two painters for
// one boundary is how the sheet and the screen come to disagree -- so both are
// asked here, and each is asked for all three things he named: the weight, the
// ink, and the dash-dot.
//
// MEASURED OFF THE CANVAS CONTEXT, not off the pixels. A dash pattern is the
// one thing a pixel count cannot tell you: a dotted line and a thin solid one
// put similar ink on a canvas, and no sampling of a 2px stroke distinguishes
// [14,8,0,8] from [9,5]. So both painters are run against a recording stub
// that keeps every state change and every call, which is the only way to say
// "it asked for a round cap" out loud.
const { test, expect } = require('@playwright/test');

const LOT = {
  id: 'lot-1', site: true, levelId: 8,
  points: [{ x: 50, z: -40 }, { x: -50, z: -40 }, { x: -50, z: 40 }, { x: 50, z: 40 }],
};

// A CONTEXT THAT REMEMBERS. Only what the painters actually set: the stroke
// calls each carry the state in force when they were made, so a later reset
// cannot make an earlier stroke look like something it was not.
const RECORDER = `
  const strokes = [];
  const ctx = {
    _dash: [], _cap: 'butt',
    lineWidth: 1, strokeStyle: '', fillStyle: '', font: '', textAlign: '', textBaseline: '',
    globalAlpha: 1,
    set lineCap(v) { this._cap = v; }, get lineCap() { return this._cap; },
    setLineDash(d) { this._dash = d.slice(); },
    getLineDash() { return this._dash.slice(); },
    save() {}, restore() {}, beginPath() {}, closePath() {},
    moveTo() {}, lineTo() {}, quadraticCurveTo() {}, arc() {}, rect() {},
    fill() {}, fillRect() {}, fillText() {}, clip() {}, translate() {}, scale() {},
    measureText() { return { width: 10 }; },
    stroke() {
      strokes.push({ width: this.lineWidth, ink: String(this.strokeStyle),
        dash: this._dash.slice(), cap: this._cap });
    },
  };
`;

// THE HEAVIEST STROKE IS THE LOT'S. Every other line on a site plan -- the
// eave, the wall tops, the footprint -- is lighter than the boundary by
// design, which is the convention this feature is about, so "the thickest
// stroke" picks the property line without the test having to know the order
// the painter draws in.
const heaviest = strokes => strokes.reduce((best, one) => (
  !best || one.width > best.width ? one : best), null);

const DASH_DOT = ([a, b, c, d]) => a > 0 && b > 0 && c === 0 && d > 0;

test('the sheet draws the lot thick, black, and dash-dot', async ({ page }) => {
  await page.goto('/LAYOUT.html');
  await page.waitForFunction(() => document.body.dataset.layoutReady === '1');
  const drawn = await page.evaluate(`(() => {
    ${RECORDER}
    const toS = pt => ({ x: pt.x * 2 + 400, y: pt.z * 2 + 300 });
    window.DraftLayoutPlan.drawSitePlan(ctx, toS, { outlines: [${JSON.stringify(LOT)}] }, {});
    return strokes;
  })()`);
  expect(drawn.length, 'the sheet drew no lot at all').toBeGreaterThan(0);
  const lot = heaviest(drawn);
  expect(lot.width, 'the property line is not thick').toBeGreaterThanOrEqual(3);
  // BLACK, not the page's grey-black: "THICK BLACK LINES on the layout for
  // contruction plan", and a construction set prints on white paper.
  expect(lot.ink.toLowerCase(), 'the sheet line is not black').toBe('#000000');
  expect(DASH_DOT(lot.dash),
    `the pattern is not long-dash / dot (${lot.dash.join(',')})`).toBe(true);
  // AND THE DOT IS A DOT. A zero-length dash only paints under a round cap --
  // under the default butt cap it paints nothing at all, and the line would
  // come out as plain long dashes with wide gaps.
  expect(lot.cap, 'a zero-length dash under a butt cap draws nothing').toBe('round');
});

test('and the screen draws the same line in the night skin\'s white', async ({ page }) => {
  await page.goto('/MODEL.html?mode=night');
  // THE MODULES, NOT THE DRAWING: this calls the painter directly, so what has
  // to be there is render-2d and the palette -- and #readout stays hidden
  // until a drawing exists, which this page has no need of.
  await page.waitForFunction(
    () => !!(window.DraftRender2D && window.DraftPalette), null, { timeout: 10000 });
  const drawn = await page.evaluate(`(() => {
    ${RECORDER}
    const toS = pt => ({ x: pt.x * 2 + 400, y: pt.z * 2 + 300 });
    const lot = ${JSON.stringify(LOT)};
    const skin = window.DraftPalette.resolve('ruff', 'night');
    window.DraftRender2D.drawOutlines2D(ctx, toS, {
      boneyardActive: false, outlines: [lot], boneyardOutlines: [],
      showHandles: false, isSelected: () => false,
      segmentCount: o => o.points.length,
      segment: (o, i) => ({ start: o.points[i], end: o.points[(i + 1) % o.points.length] }),
      controlPoint: () => ({ x: 0, z: 0 }),
      outlineDrawing: false, outlinePoints: [], snapPt: null, activeTool: 'select',
      colors: { boneyard: '#c86876', level: '#5980a6', garageBoneyard: '#cf7a1f',
        garageLevel: '#7d5ba6', siteLine: skin['draw-site-line'] },
    });
    return { strokes, ink: skin['draw-site-line'] };
  })()`);
  expect(drawn.strokes.length, 'the screen drew no lot at all').toBeGreaterThan(0);
  const lot = heaviest(drawn.strokes);
  // BRIGHT WHITE, and read from the skin rather than typed here: the claim is
  // that the painter uses the role, and a literal in this file would pass
  // just as well with the role unwired.
  expect(drawn.ink.toLowerCase(), 'the night role is not bright white').toBe('#ffffff');
  expect(lot.ink, 'the screen line is not the skin\'s property-line ink')
    .toBe(drawn.ink);
  expect(lot.width, 'the property line is not thick on screen').toBeGreaterThanOrEqual(3);
  expect(DASH_DOT(lot.dash),
    `the pattern is not long-dash / dot (${lot.dash.join(',')})`).toBe(true);
  expect(lot.cap, 'a zero-length dash under a butt cap draws nothing').toBe('round');
});

test('a house outline beside it is left alone', async ({ page }) => {
  // THE BRANCH IS ON `site`, so this is the half that says it is a branch and
  // not a new default: an ordinary traced outline keeps the trace look it has
  // had since the boneyard landed -- lighter, its own dashes, its scope
  // colour -- or every house on screen just became a property line.
  await page.goto('/MODEL.html?mode=night');
  // THE MODULES, NOT THE DRAWING: this calls the painter directly, so what has
  // to be there is render-2d and the palette -- and #readout stays hidden
  // until a drawing exists, which this page has no need of.
  await page.waitForFunction(
    () => !!(window.DraftRender2D && window.DraftPalette), null, { timeout: 10000 });
  const drawn = await page.evaluate(`(() => {
    ${RECORDER}
    const toS = pt => ({ x: pt.x * 2 + 400, y: pt.z * 2 + 300 });
    const house = { id: 'h', levelId: 3, points: [
      { x: 10, z: -8 }, { x: -10, z: -8 }, { x: -10, z: 8 }, { x: 10, z: 8 }] };
    window.DraftRender2D.drawOutlines2D(ctx, toS, {
      boneyardActive: false, outlines: [house], boneyardOutlines: [],
      showHandles: false, isSelected: () => false,
      segmentCount: o => o.points.length,
      segment: (o, i) => ({ start: o.points[i], end: o.points[(i + 1) % o.points.length] }),
      controlPoint: () => ({ x: 0, z: 0 }),
      outlineDrawing: false, outlinePoints: [], snapPt: null, activeTool: 'select',
      colors: { boneyard: '#c86876', level: '#5980a6', garageBoneyard: '#cf7a1f',
        garageLevel: '#7d5ba6', siteLine: '#ffffff' },
    });
    return strokes;
  })()`);
  const house = heaviest(drawn);
  expect(house.ink, 'a house outline took the property line\'s ink').not.toBe('#ffffff');
  expect(house.width, 'a house outline took the property line\'s weight').toBeLessThan(3);
  expect(DASH_DOT(house.dash), 'a house outline took the property line\'s pattern')
    .toBe(false);
});
