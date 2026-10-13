// DOUBLE-CLICK A VIEWPORT TO GO AND EDIT IT (Movie, 12 Oct): "if a user is in
// LAYOUT area and they DOUBLE CLICK on a VIEWPORT - it POPUP asks: EDIT IN
// MODEL SPACE - Y / N - and if they say Y it will take them to that drawing in
// MODEL SPACE, or if N will just go back to LAYOUT AREA and do nothing".
//
// WHAT MAKES Y CHEAP, and what these specs really pin: the Model Space is
// already addressable. MODEL.html reads `?level=` through `activeLevelId()`
// and `?view=` through `activeViewId()`, and a cut through `cutForViewId()` as
// `cut:<id>`. So the only new thing is the ADDRESS this page builds, and the
// address is what is asserted — a spec that merely watched the page navigate
// would pass against a Y that opened the wrong drawing.
//
// THE NAVIGATION IS NOT FOLLOWED. These read the href the page sets rather
// than letting the browser leave: following it would start the whole Model
// Space for a one-line assertion, and the thing under test is the URL.
//
// THE VIEWPORTS ARE SEEDED, not placed by clicking, so a spec can put a
// SECTION on the sheet — the Add Viewport button only ever makes a plan, and
// `layout.viewports` is the page's own persisted shape (`_layoutKey`).
const { test, expect } = require('@playwright/test');

const BUCKET = 'model-drawing';
const PW = 17;
const PH = 11;
const FIT_MARGIN = 60;

const point = (x, z) => ({ x, y: 0, z });

// A main floor big enough to project. MAIN FL is level 1 here, and that id is
// what the Y address has to carry.
function houseDrawing(viewport, extra = {}) {
  const wall = (id, sx, sz, ex, ez) => ({
    id,
    start: point(sx, sz),
    end: point(ex, ez),
    levelId: 1,
    view: 'plan',
    wallType: 'stud_2x6',
    baseHeight: 0,
    topHeight: 8,
    refLine: 'left',
  });
  return {
    version: 1,
    levels: [
      { id: 0, name: 'FOUNDATION', elev: -8 },
      { id: 1, name: 'MAIN FL', elev: 0 },
    ],
    walls: [
      wall(1, 0, 0, 24, 0),
      wall(2, 24, 0, 24, 16),
      wall(3, 24, 16, 0, 16),
      wall(4, 0, 16, 0, 0),
    ],
    fenestrations: [
      { id: 1, levelId: 1, wallId: 1, type: 'door', offset: 6, width: 3 },
    ],
    // `auto: false` so the composer leaves the seeded hand alone instead of
    // dealing its own over the top.
    layout: {
      paperKey: '11x17', orientation: 'landscape', auto: false,
      viewports: [viewport], sheets: [], nextViewportId: viewport.id + 1,
    },
    ...extra,
  };
}

const PLAN_VIEWPORT = {
  id: 1, kind: 'plan', levelId: 1, pif: 1 / 48,
  xIn: PW / 2, yIn: PH / 2, sheet: 1,
};

async function openLayout(page, drawing) {
  await page.addInitScript(() => {
    if (sessionStorage.getItem('draft-test-storage-cleared')) return;
    sessionStorage.setItem('draft-test-storage-cleared', '1');
    indexedDB.deleteDatabase('pdf-img-mgr-shared');
    localStorage.clear();
  });
  await page.goto('/LAYOUT.html');
  await page.waitForFunction(() => document.body.dataset.layoutReady === '1');
  await page.evaluate(async ({ bucket, saved }) => {
    const file = new File([JSON.stringify(saved)], 'model-drawing.json', { type: 'application/json' });
    await window.SharedFileStore.saveSharedFile(file, bucket);
  }, { bucket: BUCKET, saved: drawing });
  await page.reload();
  await page.waitForFunction(() => document.body.dataset.layoutReady === '1');
  // THE SEED REACHED THE SHEET. Without this the specs below would
  // double-click bare paper and report a pass for a question that never had a
  // viewport to be about.
  await expect(page.locator('[data-layout-canvas]')).toBeVisible();
}

async function sheetPoint(page, xIn, yIn) {
  const box = await page.locator('[data-layout-canvas]').boundingBox();
  const zoom = Math.min((box.width - FIT_MARGIN * 2) / PW, (box.height - FIT_MARGIN * 2) / PH);
  return {
    x: box.x + (box.width - PW * zoom) / 2 + xIn * zoom,
    y: box.y + (box.height - PH * zoom) / 2 + yIn * zoom,
  };
}

// WHERE Y ACTUALLY WENT, read off the browser rather than out of a stub.
//
// THE FIRST VERSION OF THIS DID NOT WORK AND LOOKED LIKE IT DID. It replaced
// `window.location` with a Proxy through `Object.defineProperty` and read the
// href the page assigned. `location` is [LegacyUnforgeable] -- non-
// configurable on `window` -- so the defineProperty throws, nothing was ever
// captured, and every `expect(navigatedTo).toBe(null)` passed because the
// capture was broken rather than because the page stayed. Three checks that
// could not fail.
//
// So the navigation is allowed to HAPPEN and MODEL.html is stubbed out of the
// way: the browser's own URL is then the evidence, the real Model Space is
// never started for a one-line assertion, and "it did not navigate" means the
// page is still LAYOUT.html.
async function stubModelSpace(page) {
  await page.route('**/MODEL.html*', route => route.fulfill({
    status: 200, contentType: 'text/html',
    body: '<!doctype html><title>stub</title><body data-model-stub="1">',
  }));
}

// The stub stamps the body, so "we got there" is a fact about the loaded
// document and not just a string the page set on itself.
const atModelSpace = async page => {
  await page.waitForFunction(() => document.body?.dataset.modelStub === '1',
    null, { timeout: 5000 });
  return new URL(page.url());
};
const stillOnLayout = page => page.url().includes('LAYOUT.html');
const asking = page => page.locator('#lay-edit-scrim').isVisible();
// `[data-delete-viewport]` is hidden exactly when nothing is selected, which
// is the page's own signal for a selection and needs no test-only handle.
const hasSelection = page => page.locator('[data-delete-viewport]').isVisible();
const savedLayout = page => page.evaluate(async bucket => {
  const file = await window.SharedFileStore.loadSharedFile(bucket);
  return file ? (JSON.parse(await file.text()).layout || null) : null;
}, BUCKET);

async function doubleClickViewport(page) {
  const p = await sheetPoint(page, PLAN_VIEWPORT.xIn, PLAN_VIEWPORT.yIn);
  await page.mouse.dblclick(p.x, p.y);
}

test('a double-click on a viewport asks EDIT IN MODEL SPACE, naming the drawing', async ({ page }) => {
  await openLayout(page, houseDrawing(PLAN_VIEWPORT));

  // Bare paper is not a viewport: the question only arrives over a frame.
  const corner = await sheetPoint(page, 0.4, 0.4);
  await page.mouse.dblclick(corner.x, corner.y);
  expect(await asking(page)).toBe(false);

  await doubleClickViewport(page);
  expect(await asking(page)).toBe(true);
  await expect(page.locator('#lay-edit-title')).toHaveText(/edit in model space/i);
  // Y AND N, his two words, and both reachable.
  await expect(page.locator('[data-edit-model-yes]')).toHaveText('Y');
  await expect(page.locator('[data-edit-model-no]')).toHaveText('N');
  await expect(page.locator('[data-edit-model-yes]')).toBeEnabled();
  // THE QUESTION NAMES WHICH DRAWING. A sheet carries several viewports, and
  // "edit in model space" over all of them says nothing about which.
  await expect(page.locator('#lay-edit-description')).toContainText('MAIN FL');
});

test('N goes back to the layout and does nothing', async ({ page }) => {
  await stubModelSpace(page);
  await openLayout(page, houseDrawing(PLAN_VIEWPORT));

  await doubleClickViewport(page);
  expect(await asking(page)).toBe(true);
  await page.locator('[data-edit-model-no]').click();

  expect(await asking(page)).toBe(false);
  expect(stillOnLayout(page)).toBe(true);
  // "and do nothing": the frame the double-click selected is still selected,
  // so a drafter who changes their mind finds it where they left it.
  expect(await hasSelection(page)).toBe(true);
  expect((await savedLayout(page)).viewports).toHaveLength(1);
});

test('Escape and the scrim are both N; Delete cannot land while it is asking', async ({ page }) => {
  await stubModelSpace(page);
  await openLayout(page, houseDrawing(PLAN_VIEWPORT));

  // DELETE IS THE ONE THAT WOULD BITE. The double-click selects the viewport,
  // so without the guard Delete would destroy the drawing the dialog is
  // still naming.
  await doubleClickViewport(page);
  await page.keyboard.press('Delete');
  expect(await asking(page)).toBe(true);
  expect(await hasSelection(page)).toBe(true);

  await page.keyboard.press('Escape');
  expect(await asking(page)).toBe(false);
  // Escape answers the question and stops there — it does not fall through to
  // the clear-the-selection branch below it.
  expect(await hasSelection(page)).toBe(true);

  // The scrim itself dismisses; a press inside the card does not.
  await doubleClickViewport(page);
  expect(await asking(page)).toBe(true);
  await page.locator('#lay-edit-title').click();
  expect(await asking(page)).toBe(true);
  const box = await page.locator('#lay-edit-scrim').boundingBox();
  await page.mouse.click(box.x + 12, box.y + box.height - 12);
  expect(await asking(page)).toBe(false);
  expect(stillOnLayout(page)).toBe(true);
});

test('Y opens that plan at its own level in the Model Space', async ({ page }) => {
  await stubModelSpace(page);
  await openLayout(page, houseDrawing(PLAN_VIEWPORT));

  await doubleClickViewport(page);
  await page.locator('[data-edit-model-yes]').click();

  // THE ADDRESS, NOT JUST THE DEPARTURE. MAIN FL is level 1 in this fixture,
  // and that id is what MODEL.html's activeLevelId() reads.
  const url = await atModelSpace(page);
  expect(url.pathname.endsWith('/MODEL.html')).toBe(true);
  expect(url.searchParams.get('level')).toBe('1');
});

test('a section viewport addresses its cut, and carries no level with it', async ({ page }) => {
  await stubModelSpace(page);
  await openLayout(page, houseDrawing(
    { id: 1, kind: 'section', cutId: 7, pif: 1 / 48, xIn: PW / 2, yIn: PH / 2, sheet: 1 },
    {
      cuts: [{
        id: 7, name: 'A', elev: 0, levelId: null,
        startPt: point(-2, 8), endPt: point(26, 8), dirVec: { x: 0, z: 1 },
      }],
    }));

  await doubleClickViewport(page);
  expect(await asking(page)).toBe(true);
  await expect(page.locator('#lay-edit-description')).toContainText('SECTION A');
  await page.locator('[data-edit-model-yes]').click();

  const url = await atModelSpace(page);
  expect(url.searchParams.get('view')).toBe('cut:7');
  // NO LEVEL ON A CUT. activeViewId() answers a `cut:` id before it consults
  // the level's layer views, so a level sent alongside would be read for its
  // own sake and could move the drafter somewhere they did not ask to be.
  expect(url.searchParams.get('level')).toBe(null);
});

// A VIEWPORT WITH NOWHERE TO GO, AND IT HAS TO BE AN ELEVATION.
//
// The obvious fixture -- a SECTION pointing at a cut the file does not have --
// cannot reach this branch at all: drawing-format.js's `layout()` normaliser
// drops a section viewport whose `cutId` is not in the drawing's own cuts
// (`if (!Number.isInteger(cutId) || !cutIds.has(cutId)) return null`), so it
// never arrives in state to be double-clicked. Written down because that was
// the first fixture tried, and it failed by the viewport not being THERE,
// which reads exactly like the dialog not opening.
//
// AN ELEVATION IS DIFFERENT, and that is what makes the branch live. Its
// `elevId` is checked against the four names E1..E4 and nothing more -- the
// auto elevations are not in the file, they are DERIVED from the walls each
// time, and `_standardElevationCuts()` returns none at all for a house whose
// footprint is under a foot. So a saved sheet can hold an E1 viewport on a
// drawing that currently has no E1, which is the state below.
test('an elevation with no cut behind it says so instead of offering a wrong Y', async ({ page }) => {
  await stubModelSpace(page);
  const drawing = houseDrawing(
    { id: 1, kind: 'elevation', elevId: 'E1', pif: 1 / 48, xIn: PW / 2, yIn: PH / 2, sheet: 1 });
  // Half a foot across, so `_standardElevationCuts()` bails on the span test
  // and the four standard elevations do not exist to be opened.
  drawing.walls = [{
    id: 1, start: point(0, 0), end: point(0.5, 0),
    levelId: 1, view: 'plan', wallType: 'stud_2x6',
    baseHeight: 0, topHeight: 8, refLine: 'left',
  }];
  drawing.fenestrations = [];
  await openLayout(page, drawing);

  await doubleClickViewport(page);
  expect(await asking(page)).toBe(true);
  await expect(page.locator('#lay-edit-description')).toContainText('no longer in the file');
  await expect(page.locator('[data-edit-model-yes]')).toBeDisabled();
  // And pressing it anyway goes nowhere.
  await page.locator('[data-edit-model-yes]').click({ force: true });
  expect(stillOnLayout(page)).toBe(true);
});

// ── AND A FINGER IS NOT A MOUSE ─────────────────────────────────────────
//
// Chromium synthesizes a `dblclick` from two taps at one spot, and on a sheet
// those two taps are the ordinary ones: place a viewport, tap it again to
// select it. The question then appeared unasked AND its scrim covered the
// status strip, swallowing the next tap -- which is how this was found, as
// `touch-layout.spec.js`'s DELETE test timing out on the CI runner while
// passing here. Whether the two taps land inside the platform's double-click
// interval is a race, so this is pinned on BOTH sides: the double-tap does
// not ask, and the strip's button does.
test.describe('on a touchscreen', () => {
  test.use({ hasTouch: true });

  test('two taps on a viewport select it and ask nothing', async ({ page }) => {
    await stubModelSpace(page);
    await openLayout(page, houseDrawing(PLAN_VIEWPORT));
    const p = await sheetPoint(page, PLAN_VIEWPORT.xIn, PLAN_VIEWPORT.yIn);

    await page.touchscreen.tap(p.x, p.y);
    await page.touchscreen.tap(p.x, p.y);
    expect(await hasSelection(page), 'the second tap selected it').toBe(true);
    expect(await asking(page), 'and asked nothing').toBe(false);

    // The strip is reachable, which is the half of this that bit: a scrim
    // over DELETE is what turned an unasked question into a timeout.
    await expect(page.locator('[data-delete-viewport]')).toBeVisible();
    await page.locator('[data-delete-viewport]').tap();
    expect((await savedLayout(page)).viewports, 'the tap landed').toHaveLength(0);
  });

  test('the strip is the finger’s way in, and it opens the same question', async ({ page }) => {
    await stubModelSpace(page);
    await openLayout(page, houseDrawing(PLAN_VIEWPORT));
    const edit = page.locator('[data-edit-in-model]');
    await expect(edit, 'nothing selected, nothing to edit').toBeHidden();

    const p = await sheetPoint(page, PLAN_VIEWPORT.xIn, PLAN_VIEWPORT.yIn);
    await page.touchscreen.tap(p.x, p.y);
    await expect(edit).toBeVisible();
    await edit.tap();

    expect(await asking(page)).toBe(true);
    await expect(page.locator('#lay-edit-description')).toContainText('MAIN FL');
    // And Y still goes to the right drawing, by the strip as by the mouse.
    await page.locator('[data-edit-model-yes]').tap();
    const url = await atModelSpace(page);
    expect(url.searchParams.get('level')).toBe('1');
  });
});
