// AUTOSAVE RULING, RUNG 1 — the eat becomes a refusal.
//
// MODEL.dc.html's stale-write path (_writeDrawingToStore, MODEL.dc.html:6176)
// re-reads the store, takes `layout` and `specs` from the fresh copy, and then
// writes its OWN model keys over the top. The comment above it says why:
//
//   "every key in this file is the Model Space's own and our copy is the
//    current one, except `layout`, which is LAYOUT's"
//
// That sentence was true when LAYOUT was the only other writer. TIER 3a made
// it false — MODEL.html writes walls now — and the sentence is still there,
// which is what makes this worth a spec rather than a patch. The revision
// check catches the collision correctly and the merge then throws the catch
// away: stale writer wins, no error anywhere, and PR #178's rule that the
// store must not eat work fails on the path built to honour it.
//
// NO RACE IS NEEDED. Every step below is awaited to completion. The bug is in
// what the merge decides, not in when it runs.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const MAIN_FL = 3;

// A closed rectangle, x -10..10 and z -5..5, so MODEL.html's fit puts the
// world origin at the canvas centre and a corner is a known number of pixels
// away. Both pages load this same drawing.
const FIXTURE = `
  const wall = (id, sx, sz, ex, ez) => ({
    id, start: { x: sx, y: 0, z: sz }, end: { x: ex, y: 0, z: ez },
    levelId: ${MAIN_FL}, view: 'plan', wallType: 'stud_2x6',
  });
  d.walls = [
    wall('n', -10, -5, 10, -5), wall('e', 10, -5, 10, 5),
    wall('s', 10, 5, -10, 5),   wall('w', -10, 5, -10, -5)
  ];
  d.lines = []; d.floors = []; d.dimensions = []; d.roofs = []; d.shapes = [];
  return d;`;

const readStore = page => page.evaluate(async bucket => {
  const file = await window.SharedFileStore.loadSharedFile(bucket);
  return JSON.parse(await file.text());
}, BUCKET);

// The north wall's west end — the corner this test moves and then watches for.
const movedCorner = saved => saved.walls.find(w => w.id === 'n').start;

async function pxPerFt(page) {
  const text = await page.locator('#readout').textContent();
  const m = text.match(/scale ([\d.]+) px\/ft/);
  expect(m, 'the readout must print the scale this test measures from').not.toBeNull();
  return Number(m[1]);
}

async function dragOn(page, ox, oy, dx, dy) {
  const box = await page.locator('#plan').boundingBox();
  const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
  await page.mouse.move(cx + ox, cy + oy);
  await page.mouse.down();
  await page.mouse.move(cx + ox + dx, cy + oy + dy, { steps: 10 });
  await page.mouse.up();
  await page.waitForTimeout(60);
}

// AN EDIT ON THE OLD PAGE. ENTER, not Escape — Escape cancels the chain and
// commits nothing, which is how the first draft of this file "edited" the old
// page without editing it: every assertion below held, for free, because no
// write was ever attempted. The control test guards that door from now on.
async function drawALine(page, x1, z1, x2, z2) {
  await h.selectTool(page, 'Line');
  await h.clickWorld(page, x1, z1);
  await h.clickWorld(page, x2, z2);
  await page.keyboard.press('Enter');
}

// The old page, holding the rectangle and a current store revision.
//
// WITH NO LIVE BROADCAST, WHICH IS WHAT KEEPS THIS FILE ABOUT RUNG 1. Rung 2
// gives a CLEAN page the other page's write before it can go stale, so on a
// browser that has BroadcastChannel these tests would stop reaching the merge
// path at all — every assertion below would hold for the wrong reason, or fail
// describing a conflict that no longer happens.
//
// Deleting BroadcastChannel is not a test-only mode: it is the degrade the
// ruling names (§3.3, "a browser without it does not live-reload"), and it is
// also every page that IS dirty when the write lands. The rule this file
// exists for — a stale write with model-key differences is refused, never
// merged over — has to hold in both, and rung 2's own spec
// (tests/model-change-broadcast.spec.js) covers the clean page picking the
// write up instead.
async function oldPageOnFixture(page) {
  await page.addInitScript(() => { delete window.BroadcastChannel; });
  await h.openModel(page, { rails: false, entryCoach: true });
  await expect(page.locator('[data-entry-coach]')).toBeVisible({ timeout: 4000 });
  await page.locator('[data-first-bone-press]').click();
  await h.waitForSaved(page);
  await page.evaluate(async ({ bucket, src }) => {
    const file = await window.SharedFileStore.loadSharedFile(bucket);
    const drawing = JSON.parse(await file.text());
    // eslint-disable-next-line no-new-func
    const out = new Function('d', src)(drawing) || drawing;
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(out)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, src: FIXTURE });
  // Reopened with rails so the edit below is made with a real tool, and so the
  // page's revision is CURRENT — its staleness must be caused by the new
  // page's save, not by the fixture write, or this proves nothing about TIER 3a.
  await h.openModel(page, { rails: true });
  await h.openRails(page);
  await h.waitForSaved(page);
}

test.describe('a stale write is refused, not merged over', () => {
  // THE CONTROL, and the conflict test below is worthless without it. It runs
  // the identical gesture with no second writer: the line must reach the store
  // and the page must report SAVED. If drawing ever stops being an edit — a
  // renamed tool, a changed commit key, anything — this goes red, instead of
  // the conflict test passing because nothing was ever written.
  test('drawing a line on the old page is an edit that reaches the store',
    async ({ page }) => {
      await oldPageOnFixture(page);
      expect(h.allLines(await h.savedDrawing(page)),
        'the fixture starts with no lines').toHaveLength(0);

      await drawALine(page, -4, 0, 4, 0);
      await h.waitForSaved(page);

      expect(h.allLines(await h.savedDrawing(page)),
        'the line must have reached the store — otherwise the conflict test '
        + 'below is asserting things about an edit that never happened')
        .toHaveLength(1);
    });

  test('the old page must not overwrite a corner the new page saved',
    async ({ page, context }) => {
      await oldPageOnFixture(page);

      // THE OLD PAGE SAVES ONE EDIT OF ITS OWN FIRST, so its baseline is a
      // copy it WROTE rather than the one it loaded. Without this step the
      // page's baseline never has to move, and a build that stopped updating
      // it after a successful write would still pass everything below — the
      // load-time copy would carry the whole test. It is also the ordinary
      // case: nobody's second edit is their first.
      await drawALine(page, -8, -2, -6, -2);
      await h.waitForSaved(page);

      const before = movedCorner(await readStore(page));
      expect(before, 'both pages must start on the rectangle')
        .toMatchObject({ x: -10, z: -5 });

      // ── the new page saves a moved corner ─────────────────────────────────
      const modern = await context.newPage();
      await modern.goto('/MODEL.html?mode=night');
      await expect(modern.locator('#readout')).toContainText('walls 4/4', { timeout: 6000 });
      const ppf = await pxPerFt(modern);

      await modern.mouse.click(
        (await modern.locator('#plan').boundingBox()).x
          + (await modern.locator('#plan').boundingBox()).width / 2,
        (await modern.locator('#plan').boundingBox()).y
          + (await modern.locator('#plan').boundingBox()).height / 2 - 5 * ppf);
      await modern.waitForTimeout(60);
      await dragOn(modern, -10 * ppf, -5 * ppf, 0, -3 * ppf);   // pull the NW corner north

      await expect(modern.locator('#save')).toHaveText('UNSAVED');
      await modern.locator('#save').click();
      await expect(modern.locator('#save')).toHaveText('SAVED', { timeout: 6000 });

      const saved = movedCorner(await readStore(modern));
      expect(saved.z, 'the new page must really have moved and saved the corner')
        .toBeLessThan(before.z - 0.5);

      // ── the old page, still holding the revision from before that save ────
      // ANY edit funnels through _markUnsaved, which writes at the stale
      // revision. A line is the cheapest one to draw, and the control above
      // proves this gesture really writes.
      await drawALine(page, -4, 0, 4, 0);
      await page.waitForTimeout(900);

      // ── what must be true ─────────────────────────────────────────────────
      // 1. THE STORE STILL HOLDS THE MOVED CORNER. This is the whole ruling:
      //    a refused write may not be re-applied over another page's model
      //    keys. Today the merge keeps its own stale walls and this fails.
      const after = movedCorner(await readStore(page));
      expect(after.z, 'the corner the new page saved must survive the old '
        + "page's refused write — the store must not eat work")
        .toBeCloseTo(saved.z, 6);

      // 2. AND THE OLD PAGE SAYS SO. A refusal that reports SAVED is the same
      //    bug wearing a different face: the drafter is told their edit landed
      //    when it did not.
      expect(await page.evaluate(() => document.body.dataset.saveDirty),
        'the old page must still be dirty — its edit was not written').toBe('1');
      // EXACTLY 'UNSAVED', not "does not contain SAVED" — which is how this
      // assertion was first written, and it could never have passed: the word
      // UNSAVED contains the word SAVED.
      await expect(page.locator('[data-model-status]'),
        'and it must say so').toHaveText('UNSAVED');
      await expect(page.locator('[data-model-drawing-message]'),
        'and it must tell the drafter what happened, not "Save failed"')
        .toContainText('Another page saved this drawing');

      // 3. AND NOTHING OF THE OLD PAGE'S OWN WENT IN EITHER. A refusal writes
      //    nothing at all; a merge would have carried this line in alongside
      //    the stale walls.
      expect(h.allLines(await h.savedDrawing(page)),
        'a refused write must write nothing — the second line must be absent, '
        + 'and the first, already saved, must still be there')
        .toHaveLength(1);
    });

  test('a LAYOUT sheet write is still merged silently — no regression',
    async ({ page, context }) => {
      await oldPageOnFixture(page);

      // THE OLD PAGE SAVES A MODEL CHANGE FIRST. Without this the page's
      // baseline is still the copy it LOADED, and every model difference below
      // would be its own — so the mutation that stops updating the baseline on
      // a successful write survives, because nothing ever needed it updated.
      // With it, the baseline must move to what this page wrote or the merge
      // below sees this page's own line as somebody else's change.
      await drawALine(page, -8, -2, -6, -2);
      await h.waitForSaved(page);
      expect(h.allLines(await h.savedDrawing(page)),
        'the first line must be in the store before the merge case begins')
        .toHaveLength(1);

      // ANOTHER WRITER TOUCHES ONLY `layout` — AND SERIALISES IN ITS OWN KEY
      // ORDER. That is the case the merge was built for and it must keep
      // working: laying out a sheet is not a conflict, and a page that refused
      // here would have traded one bug for a worse one — nobody could save
      // while LAYOUT was open.
      //
      // The reordering is the point of the second half. Nothing in the format
      // fixes key order, and the comparison must not mistake a differently
      // spelled identical drawing for somebody else's edit. Reversing the keys
      // is the cheapest way to make an order-sensitive compare say "conflict"
      // about a file whose only real change is `layout`.
      const other = await context.newPage();
      await other.goto('/MODEL.html?mode=night');
      await expect(other.locator('#readout')).toContainText('walls 4/4', { timeout: 6000 });
      await other.evaluate(async bucket => {
        const file = await window.SharedFileStore.loadSharedFile(bucket);
        const drawing = JSON.parse(await file.text());
        drawing.layout = { sheets: [{ id: 'A1', name: 'SITE PLAN' }] };
        const reordered = {};
        Object.keys(drawing).reverse().forEach(key => { reordered[key] = drawing[key]; });
        await window.SharedFileStore.saveSharedFile(
          new File([JSON.stringify(reordered)], 'drawing.json', { type: 'application/json' }), bucket);
      }, BUCKET);

      await drawALine(page, -4, 0, 4, 0);
      await h.waitForSaved(page);

      const saved = await h.savedDrawing(page);
      expect(h.allLines(saved), "the old page's second line must have gone in")
        .toHaveLength(2);
      expect(saved.layout?.sheets?.[0]?.name,
        "and the other page's sheet must have survived — that is what merging is for")
        .toBe('SITE PLAN');
    });

  test('a refused write does not eat the local edit either', async ({ page, context }) => {
    await oldPageOnFixture(page);

    const modern = await context.newPage();
    await modern.goto('/MODEL.html?mode=night');
    await expect(modern.locator('#readout')).toContainText('walls 4/4', { timeout: 6000 });
    const ppf = await pxPerFt(modern);
    const box = await modern.locator('#plan').boundingBox();
    await modern.mouse.click(box.x + box.width / 2, box.y + box.height / 2 - 5 * ppf);
    await modern.waitForTimeout(60);
    await dragOn(modern, -10 * ppf, -5 * ppf, 0, -3 * ppf);
    await modern.locator('#save').click();
    await expect(modern.locator('#save')).toHaveText('SAVED', { timeout: 6000 });

    await drawALine(page, -4, 0, 4, 0);
    await page.waitForTimeout(900);
    await expect(page.locator('[data-model-status]')).toHaveText('UNSAVED');

    // THE REFUSAL MUST NOT HAVE COST THE DRAFTER THEIR LINE. Undo is the way
    // to ask without reaching inside: if the edit and its history are intact
    // the page undoes it and says so; if the refusal had thrown the edit away
    // there would be nothing to undo, and it would say that instead.
    await page.keyboard.press('Control+z');
    await expect(page.locator('[data-model-drawing-message]'),
      'the local edit and its undo history must have survived the refusal')
      .toContainText('Undone', { timeout: 4000 });
  });
});