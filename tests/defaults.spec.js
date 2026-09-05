// The SHIPPING configuration, end to end (audit Q15).
//
// Every other spec in this suite opens the model through helpers that seed a
// fat bone wallet and turn the two newest default-ON features OFF — the bone
// reveal (#283) and stair suggestions (#260) — because both move the view or
// place geometry under tests written before they existed. That is a
// reasonable accommodation and a real blind spot: roughly 550 specs run a
// configuration no user has, so a feature that only misbehaves ALONGSIDE
// another one has nothing watching for it.
//
// This spec is that watch. It seeds no settings and no wallet: three bones
// like a new browser, the reveal on, suggestions on, and one drafter's path
// straight through — trace, the tour's foundation, the suggested stair, the
// rooms pause, the roof, the bone, and out onto a LAYOUT sheet.
//
// On paper the bone now deals the default sheet set (#168): plans first,
// then E1+E2 on one sheet and E3+E4 on the next, all before the drafter
// touches LAYOUT. The first hand-placed viewport rides on top of that set
// and takes ownership of the sheets (layout.auto goes false).
//
// It is a shipping-DEFAULTS test, not a cold-arrival test: openModel still
// dismisses the performance notice like any drafter would, and
// waitForModelReady opens both tucked side rails so the levels are
// clickable. The pinned path starts after those two user actions; the
// notice and the tucked rails have their own specs.
//
// THE RULE THIS PINS: a new default-on feature ships with its place in this
// combination test. If it changes what the drafter sees on this path, it
// belongs here; if adding it here is awkward, that is the finding.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

// Landscape 11x17, and the fit margin the layout page uses — enough to turn
// a paper inch into a client pixel.
const PW = 17;
const PH = 11;
const FIT_MARGIN = 60;

async function traceHouse(page, w, d) {
  await page.locator('[data-select-build="bungalow"]').click();
  await page.keyboard.press('Enter'); // past PROFESSOR GRUFF
  await h.clickWorld(page, -w / 2, -d / 2);
  await h.clickWorld(page, w / 2, -d / 2);
  await h.clickWorld(page, w / 2, d / 2);
  await h.clickWorld(page, -w / 2, d / 2);
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);
}

test('the shipping defaults draw a whole house and put it on a sheet', async ({ page }) => {
  // No seeds: boneWallet false leaves the real 3-bone grant, and asking for
  // BOTH boneReveal and autoStairs skips the settings seed entirely, so every
  // model setting sits at its shipped value.
  await h.openModel(page, { boneWallet: false, boneReveal: true, autoStairs: true, tourEscort: true });

  // ── trace ──────────────────────────────────────────────────────────────
  // 28 x 24: the 24' joist span passes the 19' trigger, so the foundation
  // step has a beam to grow.
  await traceHouse(page, 28, 24);

  // ── the tour: foundation ───────────────────────────────────────────────
  const popup = page.locator('[data-tour-popup]');
  await expect(popup).toBeVisible();
  await expect(page.locator('.level-row.active .level-name')).toHaveText(/FOUNDATION/);
  let saved = await h.savedDrawing(page);
  expect(saved.beams.length).toBeGreaterThan(0);
  expect(saved.columns.length).toBeGreaterThan(0);

  await popup.click();
  await expect(page.locator('.level-row.active .level-name')).toHaveText(/MAIN FL/);
  await h.waitForSaved(page);

  // ── the suggested stair ────────────────────────────────────────────────
  // Nothing was placed by hand: with suggestions at their shipped default the
  // stair is already there, and it is what opens the floor gate.
  saved = await h.savedDrawing(page);
  expect(saved.stairs.filter(stair => stair.auto)).toHaveLength(1);
  await expect(page.locator('[data-tour-next]')).toBeVisible();

  // ── the rooms pause ────────────────────────────────────────────────────
  await page.locator('[data-tour-next]').click();
  await expect(popup).toContainText('MAIN FLOOR DONE');
  await popup.click();
  await page.keyboard.press('Enter'); // the always-lit rooms gate
  await expect(popup).toContainText('MAIN ROOMS DONE');

  // ── the roof ───────────────────────────────────────────────────────────
  // One storey: the stored BUNGALOW climbs straight to the ROOF without
  // asking (NEW-5), and the preview is accepted as it comes - a plain hip,
  // the shipped answer for a drafter who changes nothing.
  await popup.click();
  await expect(page.locator('.level-row.active .level-name')).toHaveText(/ROOF/);
  await expect(page.locator('[data-tour-gable]')).toBeVisible();
  await page.locator('[data-tour-next]').click();
  await expect(popup).toContainText('ROOF DONE');
  await page.keyboard.press('Enter');

  // ── the bone ───────────────────────────────────────────────────────────
  // Three bones is what a new browser has; one press is affordable, and with
  // the reveal at its shipped default the finale jumps to the front elevation
  // and grows the house out of the ground.
  await page.locator('[data-build-house]').click();
  await expect(page.locator('.cut-row.active')).toContainText('E1');
  await page.waitForTimeout(4300); // 1s curtain hold + the ~2.5s reveal
  await h.waitForSaved(page);

  saved = await h.savedDrawing(page);
  expect(saved.tour.step).toBe(null);
  expect(saved.walls.length).toBeGreaterThan(0);
  expect(saved.roofs.length).toBeGreaterThan(0);
  // The suggested stair was built through: its rough opening is cut.
  expect(saved.surfaceOpenings.filter(o => Number.isInteger(o.stairId))).toHaveLength(1);

  // ── rooms and areas on the built house ─────────────────────────────────
  await page.locator('.level-row', { hasText: 'MAIN FL' }).locator('.level-body').click();
  await expect(page.locator('.level-row.active .level-name')).toHaveText(/MAIN FL/);
  await h.selectTool(page, 'Annotation');
  await page.locator('[data-room-tags]').click();
  await h.waitForSaved(page);
  saved = await h.savedDrawing(page);
  expect(saved.roomTags.filter(tag => tag.levelId === 3).length).toBeGreaterThan(0);

  await page.locator('[data-areas-open]').click();
  await expect(page.locator('[data-areas-dialog]')).toBeVisible();
  // A real figure, not the em-dash the report prints when it can measure
  // nothing.
  await expect(page.locator('[data-areas-total]')).toHaveText(/\d+ sq ft/);
  await page.locator('[data-areas-dialog]').getByRole('button', { name: 'DONE' }).click();

  // ── out onto paper ─────────────────────────────────────────────────────
  await page.locator('[data-nav-layout]').click();
  await page.waitForFunction(() => document.body.dataset.layoutReady === '1');
  const canvas = page.locator('[data-layout-canvas]');
  await expect(canvas).toBeVisible();

  const box = await canvas.boundingBox();
  const zoom = Math.min((box.width - FIT_MARGIN * 2) / PW, (box.height - FIT_MARGIN * 2) / PH);
  const panX = (box.width - PW * zoom) / 2;
  const panY = (box.height - PH * zoom) / 2;
  const seq = await page.evaluate(() => Number(document.body.dataset.layoutSaveSeq || 0));
  await page.locator('[data-layout-add-viewport]').click();
  await page.mouse.click(box.x + panX + (PW / 2) * zoom, box.y + panY + (PH / 2) * zoom);
  await page.waitForFunction(
    prev => Number(document.body.dataset.layoutSaveSeq || 0) > prev, seq,
  );

  const onPaper = await page.evaluate(async bucket => {
    const file = await window.SharedFileStore.loadSharedFile(bucket);
    return JSON.parse(await file.text());
  }, h.STORAGE_BUCKET);
  // The bone dealt the default sheet set: plans first, then E1+E2 on one
  // sheet and E3+E4 on the next. The hand-placed plan rides on top of it,
  // and placing it by hand took ownership of the sheets.
  const vps = onPaper.layout.viewports;
  const elev = id => vps.find(v => v.elevId === id);
  expect(elev('E1').sheet).toBe(elev('E2').sheet);
  expect(elev('E3').sheet).toBe(elev('E4').sheet);
  expect(elev('E3').sheet).toBe(elev('E1').sheet + 1);
  const placed = vps.reduce((a, b) => (a.id > b.id ? a : b));
  expect(placed.kind).toBe('plan');
  expect(placed.sheet).toBe(1);
  expect(onPaper.layout.auto).toBe(false);
  // The house the model built is still in the same file the sheet writes to -
  // the last hand-off on the path, and the one the audit found a clobber in.
  expect(onPaper.walls.length).toBeGreaterThan(0);
  expect(onPaper.roofs.length).toBeGreaterThan(0);

  // And the viewport is a drawn plan, not an empty frame: ink on the sheet.
  // The sample has to span the whole plan - a 28' x 24' house at 1/4" = 1'-0"
  // is 7 x 6 paper inches, and its walls are at the EDGES of that, so a tight
  // radius around the placement point reads bare paper and proves nothing.
  const ink = await page.evaluate(({ cx, cy, r }) => {
    const el = document.querySelector('[data-layout-canvas]');
    const left = Math.max(0, Math.round(cx - r));
    const top = Math.max(0, Math.round(cy - r));
    const data = el.getContext('2d').getImageData(
      left, top,
      Math.min(el.width - left, Math.round(r * 2)),
      Math.min(el.height - top, Math.round(r * 2)),
    ).data;
    let count = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] === 0) continue;
      if (data[i] < 240 || data[i + 1] < 240 || data[i + 2] < 240) count += 1;
    }
    return count;
  }, { cx: panX + (PW / 2) * zoom, cy: panY + (PH / 2) * zoom, r: 4.5 * zoom });
  expect(ink).toBeGreaterThan(50);
});
