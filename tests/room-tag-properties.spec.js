// A ROOM TAG'S PROPERTIES (jb, 11 Nov 2026): "add all the 'obj/prop' stuff
// appropriate for the room tag that is already used in annotation (since
// they are very similar). the connection line can be considered the pointer
// line and please allow it to be turned on and off for the room tag." The
// ROOM TAG panel gains POINTER / NO POINTER, POINTER END, POINTER LINE,
// TEXT SIZE ON THE PLAN, FONT, ROTATE and BOX; each pick writes the tag in
// one undo, and the sheet letters a sized tag at its height.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const SITE = 8;
const ring = ([w, d]) => [[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2]]
  .map(([x, z]) => ({ x, y: 0, z }));
// A 40 x 30 parcel in the lot, its tag set down past the lot's east edge.
const PARCEL = { id: 1, at: { x: 45, y: 0, z: 0 }, levelId: SITE, view: 'plan', name: 'PARCEL A', areaSqFt: 0, stamped: true,
  points: [{ x: -20, z: -15 }, { x: 20, z: -15 }, { x: 20, z: 15 }, { x: -20, z: 15 }] };
const siteFile = () => ({
  version: 1, planTurn: 0, board: 'drafting', standalone: 'site',
  levels: [{ id: SITE, name: 'SITE', elev: 0 }, { id: 7, name: 'ROOF', elev: 18 },
    { id: 5, name: '2ND FL', elev: 9 }, { id: 3, name: 'MAIN FL', elev: 0 },
    { id: 1, name: 'FOUNDATION', elev: -10 }],
  activeLevelIdx: 0,
  walls: [], lines: [], floors: [], roofs: [], fenestrations: [], dimensions: [],
  outlines: [{ id: 'lot', levelId: SITE, site: true, garage: false, detached: false, masterId: null,
    foundation: null, closed: true, points: ring([60, 120]), overriddenSrcIds: [] }],
  shapes: [], surfaceOpenings: [], stairs: [], notes: [],
  roomTags: [PARCEL], columns: [], beams: [], boneyardOutlines: [],
  groups: [], levelLocks: [], underlays: [],
});

async function openSite(page) {
  await page.setViewportSize({ width: 1366, height: 768 });
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, drawing }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(drawing)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, drawing: siteFile() });
  await page.goto(`/MODEL.html?level=${SITE}&lpane=drafting&left=1`);
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  await page.waitForTimeout(300);
  const later = page.locator('#lot-pick [data-lot-pick-ok]');
  if (await later.isVisible().catch(() => false)) await later.click();
}
const saved = async page => {
  await page.locator('#save').click();
  await h.waitForSaved(page);
  return h.savedDrawing(page);
};
const tagById = async (page, id) => (await saved(page)).roomTags.find(t => t.id === id);
const pickTag = async page => {
  await page.keyboard.press('s');
  const f = await h.planFrame(page);
  const [x, y] = f.at(PARCEL.at.x, PARCEL.at.z);
  await page.mouse.click(x, y);
  await expect(page.locator('#props-box')).toContainText('ROOM TAG');
};
const panel = page => page.locator('#props-box');

test('a picked tag shows the note options that fit it, and each chip writes the tag in one undo', async ({ page }) => {
  await openSite(page);
  await page.locator('#objprop-tab').click();
  await pickTag(page);
  await expect(page.locator('#objprop [data-objprop-title]')).toHaveText(/^ROOM TAG/);
  // What a tag has, and what it has not.
  await expect(panel(page).locator('[data-room-tag-pointer="on"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(panel(page).locator('[data-room-tag-end="dot"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(panel(page).locator('[data-room-tag-node]')).toHaveCount(0);
  await expect(panel(page).locator('[data-room-tag-align]')).toHaveCount(0);
  await expect(panel(page).locator('[data-room-tag-caps]')).toHaveCount(0);

  await panel(page).locator('[data-room-tag-end="arrow"]').click();
  expect((await tagById(page, 1)).end).toBe('arrow');
  await panel(page).locator('[data-room-tag-style="dashed"]').click();
  await panel(page).locator('[data-room-tag-weight="5"]').click();
  await panel(page).locator('[data-room-tag-size="2\\\'"]').click();
  await panel(page).locator('[data-room-tag-font="mono"]').click();
  await panel(page).locator('[data-room-tag-rot="90"]').click();
  await panel(page).locator('[data-room-tag-outline]').click();
  await panel(page).locator('[data-room-tag-fill]').click();
  const t = await tagById(page, 1);
  expect(t.style).toBe('dashed');
  expect(t.weight).toBe(5);
  expect(t.heightFt).toBeCloseTo(2, 6);
  expect(t.font).toBe('mono');
  expect(t.rot).toBeCloseTo(Math.PI / 2, 6);
  expect(t.outline).toBe(true);
  expect(t.fill).toBe(true);
  expect(t.name, 'the name is untouched').toBe('PARCEL A');
  expect(t.points, 'and the shape').toHaveLength(4);
  await expect(panel(page).locator('[data-room-tag-font="mono"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(panel(page).locator('[data-room-tag-size-field]')).toHaveValue(/2'/);
  // Typed height and degrees.
  await panel(page).locator('[data-room-tag-size-field]').fill('6"');
  await page.keyboard.press('Enter');
  expect((await tagById(page, 1)).heightFt).toBeCloseTo(0.5, 6);
  await panel(page).locator('[data-room-tag-rot-field]').fill('45');
  await page.keyboard.press('Enter');
  expect((await tagById(page, 1)).rot).toBeCloseTo(Math.PI / 4, 6);
  // UNDO takes the last pick off.
  await page.locator('[data-model-undo]').click();
  expect((await tagById(page, 1)).rot).toBeCloseTo(Math.PI / 2, 6);
  // A sized, turned tag is still picked by its name: the box follows the paint.
  await page.keyboard.press('Escape');
  await pickTag(page);
});

test('NO POINTER drops the leader to the area and POINTER brings the dot back; DOT is the default and is not stored', async ({ page }) => {
  await openSite(page);
  await pickTag(page);
  const leader = () => page.evaluate(() => {
    const R = window.DraftRender2D;
    const tag = drawing.roomTags[0];
    const calls = [];
    const ctx = new Proxy({}, { get: (_, k) => (k === 'measureText' ? () => ({ width: 40 }) : (...a) => { calls.push([k, a]); }), set: () => true });
    R.drawRoomTag2D(ctx, p => ({ x: p.x * 10, y: p.z * 10 }), tag, {}, { color: '#000' });
    return { lines: calls.filter(c => c[0] === 'lineTo').length, dots: calls.filter(c => c[0] === 'arc').length };
  });
  expect(await leader()).toEqual({ lines: 1, dots: 1 });
  await panel(page).locator('[data-room-tag-pointer="off"]').click();
  expect((await tagById(page, 1)).end).toBe('none');
  expect(await leader()).toEqual({ lines: 0, dots: 0 });
  await expect(panel(page).locator('[data-room-tag-end="dot"]')).toHaveAttribute('aria-pressed', 'false');
  await panel(page).locator('[data-room-tag-pointer="on"]').click();
  expect((await tagById(page, 1)).end, 'DOT is the default, not written').toBeUndefined();
  expect(await leader()).toEqual({ lines: 1, dots: 1 });
  await page.locator('[data-model-undo]').click();
  expect((await tagById(page, 1)).end).toBe('none');
});
