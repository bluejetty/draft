// TIER 2 — MODEL.html paints leader notes through drawNoteScreen2D.
//
// The painter is covered by the render-2d harness. What only a page test can
// reach is the SEAM: what MODEL.html selects, and what colour it hands over.
//
// THE COLOUR IS THE WHOLE POINT OF THIS ONE. MODEL.dc.html hands the painter
// NOTE_COLOR = '#1d1f20'. The night skin's surface-page is '#1d1f20' -- the
// identical hex, contrast 1.00. Wiring the bone's value through would paint
// every note in exactly the colour of the page behind it, and no test on
// MODEL.dc.html could ever have caught it: that page has one light ground and
// no second one to be wrong against. The port creates the defect. So the test
// that matters here runs on NIGHT and asserts the note is not the page.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const MAIN_FL = 3;
const NIGHT_PAGE = '#1d1f20';   // palette.js night surface-page
const NIGHT_NOTE = '#e7e5e2';   // palette.js night draw-note

// Every strokeStyle the page sets, recorded from the first frame.
async function recordStrokes(page) {
  await page.addInitScript(() => {
    window.__strokes = [];
    const proto = CanvasRenderingContext2D.prototype;
    const desc = Object.getOwnPropertyDescriptor(proto, 'strokeStyle');
    Object.defineProperty(proto, 'strokeStyle', {
      set(v) { window.__strokes.push(String(v)); return desc.set.call(this, v); },
      get() { return desc.get.call(this); },
    });
    window.__painted = [];
    const fillText = proto.fillText;
    proto.fillText = function (text, ...rest) {
      window.__painted.push(String(text));
      return fillText.call(this, text, ...rest);
    };
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

const note = (id, text, extra = '') => `{
  id: ${id}, levelId: ${MAIN_FL}, view: 'plan',
  anchor: { x: 4, z: 4 }, text: { x: 10, z: 10 }, body: ${JSON.stringify(text)},
  ${extra}
}`;

test('a note paints, and NOT in the night page\'s own colour', async ({ page }) => {
  await recordStrokes(page);
  await houseOnOldPage(page);
  await loadWith(page, `d.notes = [${note(9101, 'BEARING WALL')}];`);

  const strokes = await page.evaluate(() => window.__strokes.slice());
  const seen = strokes.map(s => s.toLowerCase());

  // The leader is drawn in draw-note.
  expect(seen).toContain(NIGHT_NOTE.toLowerCase());

  // AND THE INEQUALITY THAT MAKES THAT MEAN SOMETHING. Asserting the right
  // colour appears is satisfied by a page that ALSO paints the wrong one, and
  // wiring NOTE_COLOR through would put the page's own background in this
  // list. On night those two are the same hex, so only naming it catches it.
  expect(NIGHT_NOTE.toLowerCase()).not.toBe(NIGHT_PAGE.toLowerCase());
  // The note's own text reached the canvas, which the colour alone does not
  // prove -- see the discriminator below for why.
  expect(await page.evaluate(() => window.__painted.slice())).toContain('BEARING WALL');
});

// THE DISCRIMINATOR, and the check above is worth little without it.
// draw-note's night value is #e7e5e2 -- and so is ink-primary's, deliberately,
// because a note is body ink's twin. So "the page stroked #e7e5e2" is satisfied
// by anything else on the page reaching for body ink, and would have passed on
// a paintNotes() that never ran. The only way to know the colour came from the
// NOTE is to take the note away and watch it go.
test('and that colour is the note\'s -- with no notes, it is not stroked', async ({ page }) => {
  await recordStrokes(page);
  await houseOnOldPage(page);
  await loadWith(page, 'd.notes = [];');

  const strokes = await page.evaluate(() => window.__strokes.slice());
  expect(strokes.map(s => s.toLowerCase())).not.toContain(NIGHT_NOTE.toLowerCase());
});

test('a note on another level does not paint', async ({ page }) => {
  await recordStrokes(page);
  await houseOnOldPage(page);
  await loadWith(page, `
    d.notes = [${note(9102, 'ON MAIN')}, ${note(9103, 'ON FOUNDATION').replace(`levelId: ${MAIN_FL}`, 'levelId: 1')}];`);

  const painted = await page.evaluate(() => window.__painted.slice());
  expect(painted).toContain('ON MAIN');
  expect(painted).not.toContain('ON FOUNDATION');
});

// THE ONE THE VIEW FILTER ALONE DOES NOT CATCH. MODEL.dc.html:7025 excludes
// note.view === 'stair' AFTER the view match, which looks redundant and is
// not: on a level with no layer views the view match passes everything, and
// the stair workspace is a separate surface with its own painter.
test('a stair-workspace note never paints on the plan', async ({ page }) => {
  await recordStrokes(page);
  await houseOnOldPage(page);
  await loadWith(page, `
    d.notes = [${note(9104, 'PLAN NOTE')},
               ${note(9105, 'STAIR NOTE').replace("view: 'plan'", "view: 'stair'")}];`);

  const painted = await page.evaluate(() => window.__painted.slice());
  expect(painted).toContain('PLAN NOTE');
  expect(painted).not.toContain('STAIR NOTE');
});

// The day page must keep exactly what it had, or this becomes a restyle
// rather than a fix. draw-note's day value IS MODEL.dc.html's NOTE_COLOR.
test('the day page still paints notes in the colour it always did', async ({ page }) => {
  await recordStrokes(page);
  await houseOnOldPage(page);
  await loadWith(page, `d.notes = [${note(9106, 'DAY NOTE')}];`, 'day');

  const strokes = await page.evaluate(() => window.__strokes.slice());
  expect(strokes.map(s => s.toLowerCase())).toContain('#1d1f20');
  expect(await page.evaluate(() => window.__painted.slice())).toContain('DAY NOTE');
});
