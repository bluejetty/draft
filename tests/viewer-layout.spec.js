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
