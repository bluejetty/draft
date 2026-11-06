// THE SITE PLAN DRAWN IN ANOTHER .DRAFT.
//
// jb, 6 Nov: "i think in alot of situations i will draw the site plan on a
// seperate draft file that i will bring in and place, can we make that an
// option for the site plan setup when it asks about drawing the site plan
// can 'import site plan from draft file' be an option. we might need to
// refine details of this later".
//
// SO A FIFTH COMMAND ON THE LOT CARD, and it is a door to a room that was
// already there: the HOLOGRAM chip's BRING IN reads a .draft, the file
// arrives in hand to be placed, and a hologram's lot line already shows on
// SITE while this file has no lot of its own. Three claims, one check each:
// the command is on the card beside the other four; pressing it and choosing
// a file puts that file in as a hologram, with its lot listed in the
// registration box; and this file still has no lot of its own, because what
// he asked to bring in and PLACE must not be copied in before he has placed it.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const SITE = 8;

const levels = [{ id: SITE, name: 'SITE', elev: 0 }, { id: 7, name: 'ROOF', elev: 0 },
  { id: 3, name: 'MAIN FL', elev: 0 }, { id: 1, name: 'FOUNDATION', elev: -8 }];
const blank = () => ({
  version: 1, planTurn: 0, board: 'drafting', levels, activeLevelIdx: 2,
  walls: [], lines: [], floors: [], roofs: [], fenestrations: [], dimensions: [],
  outlines: [], shapes: [], surfaceOpenings: [], stairs: [], notes: [],
  roomTags: [], columns: [], beams: [], boneyardOutlines: [],
  groups: [], levelLocks: [], underlays: [],
});
// THE OTHER FILE: a 50 x 120 lot and nothing else, which is what a site plan
// drawn on its own .draft is.
const LOT = [[-25, -60], [25, -60], [25, 60], [-25, 60]];
const sitePlanFile = () => ({
  ...blank(),
  outlines: [{ id: 'lot', levelId: SITE, closed: true, site: true,
    points: LOT.map(([x, z]) => ({ x, y: 0, z })) }],
  lot: { widthFt: 50, depthFt: 120 },
});

async function openOnSite(page) {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, drawing }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(drawing)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, drawing: blank() });
  await page.goto(`/MODEL.html?level=${SITE}`);
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  await expect(page.locator('#lot-pick')).toBeVisible();
  await page.waitForTimeout(300);
}

const card = page => page.locator('#lot-pick');
const importBtn = page => card(page).locator('[data-lot-pick-import]');
const saved = async page => {
  await page.locator('#save').click();
  await h.waitForSaved(page);
  return h.savedDrawing(page);
};

test('the command is on the card, beside the other four', async ({ page }) => {
  await openOnSite(page);
  await expect(importBtn(page)).toBeVisible();
  await expect(importBtn(page)).toHaveText(/IMPORT SITE PLAN FROM \.DRAFT/);
  // IN THE COMMANDS COLUMN with the rest, not somewhere else on the card --
  // "an option for the site plan setup" means one of the options.
  for (const other of ['draw', 'skip', 'hand', 'upload']) {
    await expect(card(page).locator(`[data-lot-pick-${other}]`)).toBeVisible();
  }
  const column = await card(page).locator('.lot-commands').boundingBox();
  const button = await importBtn(page).boundingBox();
  expect(button.x, 'it sits in the commands column').toBeGreaterThanOrEqual(column.x - 1);
  expect(button.x + button.width).toBeLessThanOrEqual(column.x + column.width + 1);
});

test('pressing it and choosing a .draft brings that file in as a hologram, lot and all', async ({ page }) => {
  await openOnSite(page);
  // THE PRESS OPENS THE .DRAFT PICKER AND NOT THE PICTURE ONE. The picture
  // picker is the UPLOAD command's, and it cannot read a .draft; a drafter
  // who chose the wrong door would be told his site plan "is not a drawing
  // this page can read". So the press is watched for the file chooser it
  // opens, and the chooser must be the hologram input.
  const chooser = page.waitForEvent('filechooser');
  await importBtn(page).click();
  const picked = await chooser;
  expect(await picked.element().getAttribute('data-hologram-file'), 'the .draft picker opened').not.toBeNull();
  // AND THE CARD IS OUT OF THE WAY, because a file dialog over a question
  // card is two questions at once.
  await expect(card(page)).toBeHidden();
  await picked.setFiles({ name: 'my-site-plan.draft', mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(sitePlanFile())) });
  await page.waitForTimeout(300);
  // IT IS IN, named for its file.
  await expect.poll(async () => (await saved(page)).holograms?.length || 0).toBe(1);
  const d = await saved(page);
  expect(d.holograms[0].name).toBe('my-site-plan');
  // ITS LOT IS WHAT THE REGISTRATION BOX NOW OFFERS: the hologram's row,
  // ticked, with USE beside it for the day he wants it copied in.
  const row = page.locator('[data-reg-sites] [data-reg-site]');
  await expect(row).toHaveCount(1);
  await expect(row).toBeChecked();
  await expect(page.locator('[data-reg-sites] [data-reg-use]')).toHaveCount(1);
  // AND NOT COPIED IN BEHIND HIS BACK. "bring in and place" -- the lot is
  // still the hologram's, to be put where it belongs, and this file's own
  // outlines are as empty as they were.
  expect((d.outlines || []).filter(o => Number(o.levelId) === SITE)).toHaveLength(0);
});
