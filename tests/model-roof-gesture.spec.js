// THE ROOF GESTURE ON MODEL.html — build from the footprint, tag the edges.
//
// Work order (Movie, 16 Sep): ROOF at gesture-parity with MODEL.dc.html, which
// means the from-a-shape path (board #31) and the per-edge EAVE / GABLE flip,
// and NOT the old page's second entry (:16584, click an edge then a side then
// drop a square body). One way in, so there is one thing to check.
//
// WHAT THIS FILE IS REALLY GUARDING. The order's hard line is "zero schema
// change": the gesture must write the record drawing-format.js:490 already
// rebuilds, key for key, so a roof drawn on this page and a roof restored from
// the file are the same object. That is not something a render check can see —
// a roof with a wrong key still paints, because drawRoof2D reads points and
// edges and ignores the rest. So the assertions here are on the PERSISTED
// record, read back out of the shared file store after a save, and then again
// after a reload.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';

// The fascia the FORMAT writes, hard-coded here rather than read off the page.
// Asking MODEL.html what fascia it used and checking it used that fascia
// asserts nothing; this constant is the independent witness. The page now
// reads its fascia FROM drawing-format.js rather than keeping a second 5.5,
// so this is the check that would catch that shared constant moving.
const FASCIA_IN = 5.5;

// SEED ON THE OLD PAGE, THEN OPEN THE NEW ONE. h.openModel drives
// MODEL.dc.html, not MODEL.html -- the two pages share the store, and every
// MODEL.html spec in this suite builds its drawing on the old page and then
// goes to /MODEL.html (model-html-beam-column.spec.js:109 is the pattern).
// Worth stating because the helper's name does not say which page it opens,
// and a spec that assumes the new one finds none of its globals and fails
// four assertions deep for a reason that looks nothing like the cause.
async function houseWithOutline(page) {
  await h.openModel(page, { webgl: false, rails: false, entryCoach: true });
  await expect(page.locator('[data-entry-coach]')).toBeVisible({ timeout: 4000 });
  await page.locator('[data-first-bone-press]').click();
  await h.waitForSaved(page);
  const built = await h.savedDrawing(page);
  await openNewPage(page);
  return built;
}

async function openNewPage(page) {
  await page.goto('/MODEL.html');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 8000 });
}

// ROOF IS A DRAFTING-BOARD KEY, and the page opens on TOY. That is the order's
// own rule working -- a contextual key is disabled off its board, not hidden --
// so the test has to walk on the board first, exactly as a drafter does. Left
// out, every assertion below fails at a disabled button and reads like the
// gesture is missing rather than the board being wrong.
async function armRoof(page) {
  await page.locator('[data-board="drafting"]').click();
  // The keypad is a drawer on this page; a key in a shut drawer is enabled and
  // unclickable, which is a different failure from a key that is off-board.
  await h.openToolRail(page);
  // ..and the RIGHT rail, which is where the slot lives. ModelProps sets the
  // content either way -- by design it will not yank a panel open under a
  // drafter who shut it (:4340) -- so a spec that skips this reads a populated
  // slot as "hidden" and blames the gesture.
  await h.openModelRail(page);
  const key = page.locator('[data-tool-key="roof"]');
  await expect(key, 'ROOF must be live on the DRAFTING board').toBeEnabled();
  await key.click();
}

const roofs = drawing => (drawing?.roofs || []);

// PRESS SAVE. MODEL.html DOES NOT AUTOSAVE -- it carries an explicit #save
// button and holds body[data-save-dirty]='1' until the drafter presses it.
// (MODEL.dc.html does autosave, which is why h.waitForSaved works over there
// and why a spec ported across the two pages waits forever for a file that was
// never going to be written.) Measured the long way round: the readout said
// `roofs 1/2` -- the gesture had built the roof -- while the store still held
// one, for seven seconds. Nothing was broken; nobody had pressed SAVE.
async function save(page) {
  await page.locator('#save').click();
  await h.waitForSaved(page);
}

async function roofsInStore(page, want) {
  await expect.poll(async () => roofs(await h.savedDrawing(page)).length,
    { timeout: 8000, message: `expected ${want} roof(s) to reach the store` }).toBe(want);
  return roofs(await h.savedDrawing(page));
}

async function lastRoofInStore(page) {
  const list = roofs(await h.savedDrawing(page));
  return list[list.length - 1];
}

test.describe('MODEL.html ROOF', () => {
  test('builds a roof from the level outline and persists the format record', async ({ page }) => {
    const built = await houseWithOutline(page);
    expect(built.outlines?.length, 'the bone press should leave an outline to cut from').toBeGreaterThan(0);
    const before = roofs(built).length;

    await armRoof(page);
    const panel = page.locator('#props-slot');
    await expect(panel).toBeVisible();
    await expect(panel.locator('[data-roof-build]')).toBeEnabled();

    // 1'-6" overhang and a 6 pitch: both OFF the defaults (2 and 4), so a
    // record that carries the defaults proves the panel was ignored rather
    // than reading as a pass.
    await panel.locator('[data-prop-row="overhang"] [data-prop-value="1.5"]').click();
    await panel.locator('[data-roof-field="pitch"]').fill('6');
    await panel.locator('[data-roof-field="pitch"]').dispatchEvent('change');
    await panel.locator('[data-roof-build]').click();
    await save(page);
    const list = await roofsInStore(page, before + 1);
    const roof = list[list.length - 1];

    expect(roof.overhang, 'the panel’s overhang, not the default').toBe(1.5);
    expect(roof.pitch, 'the panel’s pitch, not the default').toBe(6);
    expect(roof.fascia, 'the format writes 5.5 regardless').toBe(FASCIA_IN);
    expect(roof.layer).toBe('A-ROOF');
    expect(roof.points.length, 'a closed footprint').toBeGreaterThanOrEqual(3);
    expect(roof.edges.length, 'one tag per point').toBe(roof.points.length);
    expect(new Set(roof.edges), 'a fresh roof is all eave').toEqual(new Set(['eave']));
    expect(roof.sourceShapeId, 'the roof remembers the outline it was cut from').toBeTruthy();

    // THE RELOAD IS THE POINT. A record the page holds but the format drops is
    // a roof that vanishes on the next open, and nothing on screen says so.
    await page.reload();
    await expect(page.locator('#readout')).toContainText('walls', { timeout: 8000 });
    const reloaded = await h.savedDrawing(page);
    const back = roofs(reloaded)[roofs(reloaded).length - 1];
    expect(back.overhang).toBe(1.5);
    expect(back.pitch).toBe(6);
    expect(back.points.length).toBe(roof.points.length);
  });

  test('a click on a roof edge flips it to GABLE, and the flip is saved', async ({ page }) => {
    await houseWithOutline(page);
    await armRoof(page);
    await page.locator('#props-slot [data-roof-build]').click();
    await save(page);
    const roof = await lastRoofInStore(page);
    const a = roof.points[0];
    const b = roof.points[1];
    // The MIDPOINT of edge 0. A corner would sit within grab range of two
    // edges and the flip could land on either, which is a test that passes
    // whichever edge it hits.
    // h.clickWorld drives [data-model-canvas] -- MODEL.dc.html's canvas. This
    // page's plan is #plan, and planFrame reads the camera the page publishes
    // on it rather than assuming the view is centred on the origin.
    const { at } = await h.planFrame(page);
    await page.mouse.click(...at((a.x + b.x) / 2, (a.z + b.z) / 2));
    await page.waitForTimeout(80);
    await save(page);
    await expect.poll(async () => (await lastRoofInStore(page)).edges[0],
      { timeout: 8000, message: 'the flip must reach the file, not just the screen' })
      .toBe('gable');

    const after = await lastRoofInStore(page);
    expect(after.edges[0], 'the tapped edge is now a gable').toBe('gable');
    expect(after.edges.slice(1).every(e => e === 'eave'),
      'only the tapped edge flipped').toBe(true);
  });

  test('the heel readout is the shared calc, not a second copy of it', async ({ page }) => {
    await houseWithOutline(page);
    await armRoof(page);
    const panel = page.locator('#props-slot');
    await panel.locator('[data-prop-row="overhang"] [data-prop-value="2"]').click();

    // drawing-format.js is the one owner of fascia + overhang * pitch -- it
    // sits beside the fascia the format writes, and project-page.js delegates
    // to it. proto/section-table-harness.js:204 measures it at
    // (5.5, 2, 4) -> 13.5". The panel must AGREE with that module rather than
    // carry its own sum.
    const want = await page.evaluate(
      ([f, o, p]) => window.DraftDrawingFormat.roofHeelIn(f, o, p), [FASCIA_IN, 2, 4]);
    expect(want, 'the shared calc itself, as the harness pins it').toBe(13.5);

    const shown = await panel.locator('[data-roof-heel]').textContent();
    const asText = await page.evaluate(
      n => window.DraftFormatters.formatArchitecturalInches(n), want);
    expect(shown).toContain(asText);
  });

  test('the build button is disabled, not hidden, with no outline to cut', async ({ page }) => {
    // A LEVEL WITH NO OUTLINE, which is not the same thing as no drawing. An
    // empty store gives MODEL.html 'no drawing saved' and no levels at all --
    // the ROOF key is then off-board for a reason that has nothing to do with
    // outlines, and the test would pass without testing anything. So: build
    // the house, then take its outlines away.
    await h.openModel(page, { webgl: false, rails: false, entryCoach: true });
    await expect(page.locator('[data-entry-coach]')).toBeVisible({ timeout: 4000 });
    await page.locator('[data-first-bone-press]').click();
    await h.waitForSaved(page);
    await page.evaluate(async bucket => {
      const file = await window.SharedFileStore.loadSharedFile(bucket);
      const drawing = JSON.parse(await file.text());
      drawing.outlines = [];
      await window.SharedFileStore.saveSharedFile(
        new File([JSON.stringify(drawing)], 'drawing.json', { type: 'application/json' }), bucket);
    }, BUCKET);
    await openNewPage(page);
    await armRoof(page);
    const build = page.locator('#props-slot [data-roof-build]');
    // Disabled AND present: a vanished button teaches the drafter ROOF does
    // nothing here, which is the off-board rule the tool keys already follow.
    await expect(build).toBeVisible();
    await expect(build).toBeDisabled();
  });
});
