// A DOOR HAS A TYPE, A STYLE AND A SIZE, AND HANGS ONE OF FOUR WAYS.
//
// Movie, 1 Oct 2026: one list to pick from ("they can all be on big list"),
// and the size rule -- "if the STYLE changes the size should remain the
// same, if the TYPE changes the size should go to default" -- plus FLIP HINGE
// and FLIP SWING ("side vs other side and then also outside vs inswing").
//
// WHAT IS PINNED OFFLINE, in proto/door-style-harness.js: the list against
// the stored vocabulary, the sizes, the reader, every style's plan drawing,
// the four hangs, and the elevations. WHAT NEEDS A BROWSER is this file: the
// panel offers the list, the size rule holds when picking, and what is
// picked is what is saved.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const V = (x, z) => ({ x, y: 0, z });
const MAIN_FL = 3;

const base = extra => ({
  version: 1,
  levels: [{ id: MAIN_FL, name: 'MAIN FL', elev: 0 }],
  activeLevelIdx: 0,
  board: 'drafting',
  walls: [
    ['n', V(-10, -10), V(10, -10)], ['e', V(10, -10), V(10, 10)],
    ['s', V(10, 10), V(-10, 10)], ['w', V(-10, 10), V(-10, -10)],
  ].map(([id, start, end]) => ({ id, start, end, levelId: MAIN_FL, view: 'plan',
    wallType: 'stud_2x6', baseHeight: 0, topHeight: 8, refLine: 'left' })),
  lines: [], floors: [], roofs: [], fenestrations: [], dimensions: [],
  outlines: [], shapes: [], surfaceOpenings: [], stairs: [], notes: [],
  roomTags: [], columns: [], beams: [], boneyardOutlines: [], boneyardShelves: [],
  groups: [], levelLocks: [], underlays: [],
  ...extra,
});

const readout = page => page.locator('#readout');

async function open(page, file = base({})) {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, f }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json',
        { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, f: file });
  // `lpane=build`, since 29 Sep: the left rail is tabbed now and FENESTRATION
  // is a BUILD key. Its CASEMENT row opens in the PROPERTIES box, which stands
  // open beside the tool tab, so the panel is still one press from the key.
  await page.goto('/MODEL.html?left=1&lpane=build&right=1');
  await expect(readout(page)).toContainText('walls', { timeout: 10000 });
  await expect(page.locator('[data-tool-key="fenestration"]')).toBeVisible();
}

const armOpening = async page => {
  await h.showLeftPane(page, 'build');
  await page.locator('[data-tool-key="fenestration"]').click();
};
const pickType = (page, id) =>
  page.locator(`[data-prop-row="opening"] [data-prop-value="${id}"]`).click();

async function save(page) {
  await expect(page.locator('#save')).toBeEnabled({ timeout: 4000 });
  await page.locator('#save').click();
  await expect(page.locator('#save')).toHaveText('SAVED', { timeout: 6000 });
}

// THE READ THAT MATTERS: not what the page holds, but what a fresh load keeps.
// DraftDrawingFormat is the normaliser the page runs on open, so this asks the
// question a reload asks -- and it is the read that catches a field the reader
// quietly drops, which is exactly what a brand-new key is at risk of being.
const survives = page => page.evaluate(async bucket => {
  const file = await window.SharedFileStore.loadSharedFile(bucket);
  const raw = JSON.parse(await file.text());
  const F = window.DraftDrawingFormat;
  const levelIds = new Set((raw.levels || []).map(level => Number(level.id)));
  return F.fenestrations(raw.fenestrations, levelIds);
}, BUCKET);


const pickDoor = (page, id) => page.locator('[data-prop-select="door"]').first().selectOption(id);
const note = page => page.locator('[data-opening-note]');

test('the tool offers the door list on a door and not on a window', async ({ page }) => {
  await open(page);
  await armOpening(page);
  await expect(page.locator('[data-prop-select="door"]')).toBeVisible();
  await expect(page.locator('[data-prop-select="door"]')).toHaveValue('ext-single');
  await pickType(page, 'window');
  await expect(page.locator('[data-prop-select="door"]')).toHaveCount(0);
});

test('a new STYLE keeps the size; a new TYPE goes to its default', async ({ page }) => {
  await open(page);
  await armOpening(page);
  await expect(note(page)).toContainText(`EXT – TYP. 3'-0"`);
  // EXT to EXT: the style changes and the size stays.
  await pickDoor(page, 'ext-french');
  await expect(note(page)).toContainText(`EXT – FRENCH 3'-0"`);
  // EXT to INT: the type changes and the size goes to INT POCKET's default.
  await pickDoor(page, 'int-pocket');
  await expect(note(page)).toContainText(`INT – POCKET 2'-6"`);
  // INT to INT again: kept.
  await pickDoor(page, 'int-bypass');
  await expect(note(page)).toContainText(`INT – BYPASS 2'-6"`);
  // And a SIZE chip sets it.
  await page.locator('[data-prop-row="size"] [data-prop-value="48"]').click();
  await expect(note(page)).toContainText(`INT – BYPASS 4'-0"`);
  // Into a garage door: its own default, 8 ft by 8 ft.
  await pickDoor(page, 'garage-overhead');
  await expect(note(page)).toContainText(`8'-0" WIDE`);
  await expect(note(page)).toContainText(`HEAD 8'-0"`);
  await expect(page.locator('[data-door-flip]')).toHaveCount(0);
  // Its chips read the way a garage door is marked, in feet: 16W × 7H.
  const sixteen = page.locator('[data-prop-row="size"] [data-prop-value="16x7"]');
  await expect(sixteen).toHaveText('16W × 7H');
  await sixteen.click();
  await expect(note(page)).toContainText(`16'-0" WIDE`);
  await expect(note(page)).toContainText(`HEAD 7'-0"`);
});

test('a door placed by hand saves its type, style and hand', async ({ page }) => {
  await open(page);
  await armOpening(page);
  await pickDoor(page, 'int-pocket');
  await page.locator('[data-door-flip="swing"]').click();
  await expect(page.locator('[data-door-flip="swing"]')).toHaveAttribute('aria-pressed', 'true');
  const f = await h.planFrame(page);
  await page.mouse.click(...f.at(0, -10));
  await page.waitForTimeout(150);
  await save(page);
  const [o] = await survives(page);
  expect([o.type, o.doorType, o.doorStyle, o.swingFlip, o.hingeFlip])
    .toEqual(['door', 'int', 'pocket', true, false]);
  expect(o.width).toBeCloseTo(30 / 12, 6);
});

test('a GARDEN door splits into a door width and a window width', async ({ page }) => {
  await open(page);
  await armOpening(page);
  await pickDoor(page, 'ext-garden');
  // The chip face is the bare number; nobody needs the inch mark.
  await expect(page.locator('[data-prop-row="size"] [data-prop-value="60"]')).toHaveText('60');
  await page.locator('[data-prop-row="size"] [data-prop-value="60"]').click();
  await expect(page.locator('[data-prop-field="door width"]')).toHaveValue(`2'-6"`);
  await expect(page.locator('[data-prop-field="window width"]')).toHaveValue(`2'-6"`);
  // A bare number in a door box is inches: 36 is 3'-0", not 36 feet.
  await page.locator('[data-prop-field="door width"]').fill('36');
  await page.locator('[data-prop-field="door width"]').press('Enter');
  await expect(note(page)).toContainText(`EXT – GARDEN 5'-6"`);
  const f = await h.planFrame(page);
  await page.mouse.click(...f.at(0, -10));
  await page.waitForTimeout(150);
  await save(page);
  const [o] = await survives(page);
  expect(o.doorStyle).toBe('garden');
  expect(o.width).toBeCloseTo(66 / 12, 6);
  expect(o.gardenWindowWidth).toBeCloseTo(30 / 12, 6);
});

test('on a door already drawn: style keeps the size, type resets it, flips flip', async ({ page }) => {
  await open(page);
  await armOpening(page);
  await pickDoor(page, 'ext-single');
  const f = await h.planFrame(page);
  await page.mouse.click(...f.at(0, -10));
  await page.waitForTimeout(150);
  await h.armFromRail(page, 'select');
  await page.mouse.click(...f.at(0, -10));
  await page.waitForTimeout(150);
  const panel = page.locator('#props-slot');
  await expect(panel.locator('[data-prop-select="door"]')).toHaveValue('ext-single');
  await panel.locator('[data-prop-select="door"]').selectOption('ext-slide');
  await page.waitForTimeout(150);
  let [o] = await (async () => { await save(page); return survives(page); })();
  expect(o.doorStyle).toBe('slide');
  expect(o.width, 'a new style keeps the size').toBeCloseTo(3, 6);
  await panel.locator('[data-prop-select="door"]').selectOption('int-french');
  await page.waitForTimeout(150);
  await panel.locator('[data-door-flip="hinge"]').click();
  await page.waitForTimeout(150);
  await save(page);
  [o] = await survives(page);
  expect([o.doorType, o.doorStyle, o.hingeFlip]).toEqual(['int', 'french', true]);
  expect(o.width, 'a new type goes to its default').toBeCloseTo(4, 6);

  // A bare number typed into a drawn door's WIDTH is inches too.
  await panel.locator('[data-prop-field="width"]').fill('42');
  await panel.locator('[data-prop-field="width"]').press('Enter');
  await page.waitForTimeout(150);
  await save(page);
  [o] = await survives(page);
  expect(o.width, '42 typed is 3\'-6"').toBeCloseTo(3.5, 6);
});
