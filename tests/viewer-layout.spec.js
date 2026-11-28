// THE 3D PAGE'S SHAPE (jb, 28 Nov 2026): on a wide screen -- a desktop, an
// iPad on its side -- "the viewport could be square in middle and then have
// side bars where the commands are listed", then "make the bars not as wide
// and make the viewport a bit wider ... make them 60% width of what they are
// now". A phone held upright keeps the rows across the top.
const { test, expect } = require('@playwright/test');

const boxes = p => p.evaluate(() => {
  const r = id => { const b = document.querySelector(id).getBoundingClientRect(); return { l: b.left, r: b.right, t: b.top, b: b.bottom, w: b.width, h: b.height }; };
  return { header: r('header'), tools: r('#tools'), stage: r('#stage'), scroll: document.documentElement.scrollWidth, vw: innerWidth };
});

for (const [w, h, what] of [[1440, 900, 'a desktop'], [1180, 820, 'an iPad on its side']]) {
  test(`on ${what} the commands are in narrow bars either side of the picture`, async ({ page: p }) => {
    await p.setViewportSize({ width: w, height: h });
    await p.goto('/viewer/index.html');
    await p.waitForSelector('body[data-ready="1"]');
    const b = await boxes(p);
    expect(b.header.r).toBeLessThanOrEqual(b.stage.l + 0.5);
    expect(b.tools.l).toBeGreaterThanOrEqual(b.stage.r - 0.5);
    expect(b.stage.h).toBeCloseTo(h, 0);
    // A bar is 60% of what a square picture would leave it, never under 150px.
    const bar = Math.max(150, (w - Math.min(h, w - 400)) / 2 * 0.6);
    expect(b.header.w).toBeCloseTo(bar, 0);
    expect(b.tools.w).toBeCloseTo(bar, 0);
    expect(b.stage.w).toBeGreaterThanOrEqual(b.stage.h * 0.99);
    expect(b.scroll).toBe(w);
    // The group names show in the bars, and every command is still there.
    await expect(p.locator('header .gl', { hasText: 'FILE' })).toBeVisible();
    await expect(p.locator('#tools .gl', { hasText: 'SAVE' })).toBeVisible();
    for (const id of ['open', 'fit', 'edges', 'textures', 'walk', 'photo-open', 'export-open', 'print-open']) await expect(p.locator('#' + id)).toBeVisible();
  });
}

test('a phone held upright keeps the rows across the top, and nothing runs off the side', async ({ page: p }) => {
  await p.setViewportSize({ width: 390, height: 844 });
  await p.goto('/viewer/index.html');
  await p.waitForSelector('body[data-ready="1"]');
  const b = await boxes(p);
  expect(b.header.b).toBeLessThanOrEqual(b.tools.t + 0.5);
  expect(b.tools.b).toBeLessThanOrEqual(b.stage.t + 0.5);
  expect(b.stage.w).toBeCloseTo(390, 0);
  expect(b.scroll).toBe(390);
  await expect(p.locator('.gl').first()).toBeHidden();
});

test('a sheet\'s 3D viewport is only the house, wide or not', async ({ page: p }) => {
  await p.setViewportSize({ width: 1200, height: 700 });
  await p.goto('/viewer/index.html?embed=1');
  await p.waitForSelector('body[data-ready="1"]');
  const b = await boxes(p);
  expect(b.stage.w).toBeCloseTo(1200, 0);
  expect(b.stage.h).toBeCloseTo(700, 0);
});

// THE NOTEPAD IN THE BAR (jb, 28 Nov 2026): "under the SAVE TAKE PHOTO PRINT
// MODEL spot put the tab for notepad and when it open make it look and act
// like the other one (yellow or blue) keep the text allow save as text etc.
// maybe even calculator too".
test('NOTEPAD sits under SAVE and opens the drafter\'s pad: NOTES, CALC, pages and the TXT file', async ({ page: p }) => {
  await p.setViewportSize({ width: 1440, height: 900 });
  await p.goto('/viewer/index.html');
  await p.waitForSelector('body[data-ready="1"]');
  await p.evaluate(() => { localStorage.setItem('draft.notepad', 'from the drafter'); localStorage.removeItem('draft.calc'); });
  await p.reload();
  await p.waitForSelector('body[data-ready="1"]');
  const save = await p.locator('#print-open').boundingBox(), key = await p.locator('#pad-tab').boundingBox();
  expect(key.y).toBeGreaterThan(save.y);
  expect(await p.locator('#pad-tab').evaluate(b => !!b.closest('#tools'))).toBe(true);
  await p.locator('#pad-tab').click();
  await expect(p.locator('#pad-text')).toHaveValue('from the drafter');
  // A key typed on the pad is a letter, not the page's F (fit) or W (walk).
  const cam = await p.evaluate(() => JSON.stringify(DraftViewer.state.camera));
  await p.locator('#pad-text').press('End');
  await p.locator('#pad-text').type('\nfw');
  expect(await p.evaluate(() => JSON.stringify(DraftViewer.state.camera))).toBe(cam);
  // CALC: the drafter's calculator, its tape kept where the drafter keeps it.
  await p.locator('[data-pad-tab="calc"]').click();
  await p.locator('#calc-line').fill("12'6\" x 10'");
  await expect(p.locator('[data-calc-answer]')).toContainText('125 sq ft');
  await p.locator('#calc-line').press('Enter');
  await expect(p.locator('[data-calc-row]')).toHaveCount(1);
  const kept = JSON.parse(await p.evaluate(() => localStorage.getItem('draft.calc')));
  expect(kept.pages[0][0]).toMatchObject({ line: "12'6\" x 10'", main: '125 sq ft' });
  await p.locator('#calc-line').fill("3' + 6\"");
  await p.locator('[data-calc-do="notes"]').click();
  expect(await p.evaluate(() => localStorage.getItem('draft.notepad'))).toBe("from the drafter\nfw\n3' + 6\" = 3'-6\"");
  // The page keys follow the tab: page 2 of CALC is its own tape.
  await p.locator('[data-pad-page="2"]').click();
  await expect(p.locator('[data-calc-row]')).toHaveCount(0);
  await expect(p.locator('#pad-page-said')).toHaveText('PAGE 2 OF 5');
  // SAVE AS TXT writes the drafter's format; OPEN TXT reads it back.
  const text = await p.evaluate(() => DraftViewerPad.asText());
  expect(text).toContain('ROUGH-DRAFTER NOTEPAD');
  expect(text).toContain("=== NOTES PAGE 1 ===\nfrom the drafter");
  expect(text).toContain("=== CALC PAGE 1 ===\n12'6\" x 10' = 125 sq ft");
  await p.evaluate(() => DraftViewerPad.openText('=== NOTES PAGE 3 ===\nfrom a file\n\n=== CALC PAGE 2 ===\n2\' x 3\' = 6 sq ft'));
  const pages = JSON.parse(await p.evaluate(() => localStorage.getItem('draft.notepad.pages')));
  expect(pages[2]).toBe('from a file');
  await expect(p.locator('[data-calc-row]')).toHaveCount(1);
  // The close button puts it away.
  await p.locator('#pad-close').click();
  await expect(p.locator('#pad')).toBeHidden();
});
