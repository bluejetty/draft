// THE T-SQUARE AND THE 1 FT LIGHT ARE ON UNTIL THE DRAFTER TURNS THEM OFF.
//
// Movie, 9 Nov 2026, taking TOY MODE out of the program: "i would like to
// completely remove TOY MODE from our project it causes more problems, we
// can have those features like TSQUARE and 1FT engaged so that it will be
// kind of like toy mode, but he can turn it off easy".
//
// So a fresh browser draws square and on the whole foot with nothing
// pressed, one press on either chip turns that light off, and the browser
// remembers each light the way it already remembered the foot light. The
// suite itself runs with both remembered OFF (playwright.config.js), which
// is why this file clears the memory first: it is the one place the
// fresh-browser default is pinned.
//
// AND THERE IS NO BOARD. No lamp, no `board` on the body, no toy module on
// the page, no break-or-move card: a drawing that still says `board: 'toy'`
// in its file (written before today) opens like any other and saves without
// the word.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const V = (x, z) => ({ x, y: 0, z });
const file = extra => ({
  version: 1, planTurn: 0,
  levels: [{ id: 3, name: 'MAIN FL', elev: 0 }],
  activeLevelIdx: 0,
  walls: [
    ['n', V(-10, -10), V(10, -10)], ['e', V(10, -10), V(10, 10)],
    ['s', V(10, 10), V(-10, 10)], ['w', V(-10, 10), V(-10, -10)],
  ].map(([id, start, end]) => ({
    id, start, end, levelId: 3, view: 'plan',
    wallType: 'stud_2x6', baseHeight: 0, topHeight: 8, refLine: 'left',
  })),
  lines: [], floors: [], roofs: [], fenestrations: [], dimensions: [],
  outlines: [], shapes: [], surfaceOpenings: [], stairs: [], notes: [],
  roomTags: [], columns: [], beams: [], boneyardOutlines: [], boneyardShelves: [],
  groups: [], levelLocks: [], underlays: [],
  nextDrawingItemId: 20,
  ...extra,
});

// A FRESH BROWSER: the suite's remembered-off lights are forgotten first.
async function openFresh(page, f = file()) {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, drawing }) => {
    try { localStorage.removeItem('draft-skin'); } catch { /* fine */ }
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(drawing)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, drawing: f });
  await page.goto('/MODEL.html');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
}
const reopen = async page => {
  await page.reload();
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
};
const tsquare = page => page.locator('[data-mode-tsquare]');
const foot = page => page.locator('[data-mode-scale]');
const lit = async chip => chip.evaluate(el => el.classList.contains('lit'));

const frame = async page => {
  const box = await page.locator('#plan').boundingBox();
  const scale = await page.evaluate(() => Number(
    /scale ([\d.]+) px\/ft/.exec(document.getElementById('readout').textContent)[1]));
  return (x, z) => [box.x + box.width / 2 + x * scale, box.y + box.height / 2 + z * scale];
};
const saveAndRead = async page => {
  await page.locator('[data-model-save]').click();
  await expect(page.locator('[data-model-save]')).toHaveText(/saved/i, { timeout: 6000 });
  return page.evaluate(async bucket => {
    const f = await window.SharedFileStore.loadSharedFile(bucket);
    return JSON.parse(await f.text());
  }, BUCKET);
};
const FIXTURE_IDS = ['n', 'e', 's', 'w'];
const drawnWall = saved => (saved.walls || []).find(w => !FIXTURE_IDS.includes(w.id));

test('a fresh browser lights the T-SQUARE and the 1 FT, and a free-hand run comes out square and on the foot',
  async ({ page }) => {
    await openFresh(page);
    expect(await lit(tsquare(page)), 'T-SQUARE lit with nothing pressed').toBe(true);
    expect(await lit(foot(page)), '1 FT lit with nothing pressed').toBe(true);

    // 6.4 across and 0.7 down: square makes it 6.4 across, the foot makes
    // it 6 -- the two instruments together, which is what TOY used to do.
    const at = await frame(page);
    await h.armWall(page);
    await page.mouse.click(...at(-3, 0));
    await page.waitForTimeout(60);
    await page.mouse.move(...at(-3 + 6.4, 0.7));
    await page.waitForTimeout(60);
    await page.mouse.click(...at(-3 + 6.4, 0.7));
    await page.waitForTimeout(60);
    const drawn = drawnWall(await saveAndRead(page));
    expect(drawn, 'the wall reached the file').toBeTruthy();
    expect(drawn.end.z - drawn.start.z, 'square').toBeCloseTo(0, 6);
    expect(Math.abs(drawn.end.x - drawn.start.x), 'on the foot').toBeCloseTo(6, 6);
  });

test('one press turns each light off, and the browser remembers it across a reload',
  async ({ page }) => {
    await openFresh(page);
    await tsquare(page).click();
    expect(await lit(tsquare(page)), 'T-SQUARE off in one press').toBe(false);
    expect(await lit(foot(page)), 'the other light is its own').toBe(true);
    await reopen(page);
    expect(await lit(tsquare(page)), 'T-SQUARE stays off after a reload').toBe(false);
    expect(await lit(foot(page))).toBe(true);

    await foot(page).click();
    expect(await lit(foot(page)), '1 FT off in one press').toBe(false);
    await reopen(page);
    expect(await lit(foot(page)), '1 FT stays off after a reload').toBe(false);
    expect(await lit(tsquare(page))).toBe(false);

    // AND BACK ON, remembered the same way.
    await tsquare(page).click();
    await reopen(page);
    expect(await lit(tsquare(page))).toBe(true);
  });

test('T turns the T-square off as the chip does, and it is remembered', async ({ page }) => {
  await openFresh(page);
  await page.keyboard.press('t');
  expect(await lit(tsquare(page))).toBe(false);
  await reopen(page);
  expect(await lit(tsquare(page))).toBe(false);
});

test('there is no board: no lamp, no toy module, no break-or-move card, and a file that said toy saves without the word',
  async ({ page }) => {
    await openFresh(page, file({ board: 'toy' }));
    expect(await page.locator('[data-board-light], #bone-choice, #promote').count()).toBe(0);
    await expect(page.locator('body')).not.toHaveAttribute('data-board', /./);
    expect(await page.evaluate(() => ({
      toy: typeof window.DraftToyConstraints, ctx: typeof window.DraftToyContext,
      boards: 'BOARDS' in window.DraftToolRoster, fmt: typeof window.DraftDrawingFormat.board,
    }))).toEqual({ toy: 'undefined', ctx: 'undefined', boards: false, fmt: 'undefined' });
    expect(await lit(tsquare(page)), 'the old toy file opens with the lights on like any other').toBe(true);
    const saved = await saveAndRead(page);
    expect('board' in saved, 'the word is not written back').toBe(false);
    expect(saved.walls.length).toBe(4);
  });
