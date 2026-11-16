// THE JOIST PICKS (jb, 16 Nov 2026, with Weyerhaeuser's TJ-4500 open): "in
// the FLOOR JOISTS area can we allow the user to enter a number as it is now,
// but also offer all these floor thicknesses" -- "I need to add 14" TJI
// joists for the current house" -- "the beams will be effected by the choice
// of this" -- "the 2x12 should be 1.5x11 1/4".
//
// What is pinned here:
//   - joist-spans.js reads TJ-4500 the way the page says it does (¾" OSB,
//     40/15, no directly applied ceiling, simple or continuous span);
//   - the ▾ beside JOIST DEPTH writes the depth AND the joist type, and the
//     box still takes a typed number;
//   - a TJI deck's callout names the series its longest bay needs;
//   - a FLUSH beam's note carries the depth of the joists it sits among.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const load = (...files) => {
  const saved = global.window;
  global.window = {};
  files.forEach(file => {
    delete require.cache[require.resolve(file)];
    require(file);
  });
  const win = global.window;
  global.window = saved;
  return win;
};
const W = load('../joist-spans.js', '../level-assembly.js', '../layer-views.js', '../build-house.js');
const JS = W.DraftJoistSpans;
// build-house reads its neighbours off `window` at call time.
const inWin = fn => () => {
  const saved = global.window;
  global.window = W;
  try { return fn(); } finally { global.window = saved; }
};
const ftIn = (f, i) => f + i / 12;

test('TJ-4500 is read at 3/4" OSB, 40/15, no ceiling, simple or continuous span', () => {
  const at = (series, depthIn) => JS.rowsAt('tji', depthIn).find(r => r.series === series).spanFt;
  // The PDF's own figures, page 8 and page 18.
  expect(at('230', 14)[16]).toBeCloseTo(ftIn(19, 7), 6);
  expect(at('110', 14)[12]).toBeCloseTo(ftIn(20, 0), 6);
  expect(at('560', 16)[24]).toBeCloseTo(ftIn(21, 9), 6);
  expect(at('560D', 24)[16]).toBeCloseTo(ftIn(31, 5), 6);
  expect(at('360', 18)[12], 'section 2 has no 12" o.c. column').toBeUndefined();
  // Every TJI pick has rows, every depth TJ-4500 makes is a pick.
  const tjiDepths = JS.PICKS.filter(p => p.family === 'tji').map(p => p.depthIn);
  expect(tjiDepths).toEqual([9.5, 11.875, 14, 16, 18, 20, 22, 24]);
  tjiDepths.forEach(d => expect(JS.rowsAt('tji', d).length, `${d}" rows`).toBeGreaterThan(0));
  // Sawn lumber is offered now and has no table yet.
  expect(JS.PICKS.filter(p => p.family === 'sawn').map(p => p.depthIn)).toEqual([7.25, 9.25, 11.25]);
  expect(JS.rowsAt('conv_2x10', 9.25)).toEqual([]);
});

test('a span picks the lightest series at the depth, 16" first, 12" last', () => {
  expect(JS.sizeFor({ joistType: 'tji', depthIn: 14, spanFt: 18 }))
    .toMatchObject({ series: '110', ocIn: 16, fits: true });
  expect(JS.sizeFor({ joistType: 'tji', depthIn: 14, spanFt: 19.5 }))
    .toMatchObject({ series: '230', ocIn: 16, fits: true });
  expect(JS.sizeFor({ joistType: 'tji', depthIn: 14, spanFt: 23 }))
    .toMatchObject({ series: '560', ocIn: 12, fits: true });
  expect(JS.sizeFor({ joistType: 'tji', depthIn: 14, spanFt: 26 }))
    .toMatchObject({ series: '560', fits: false });
  expect(JS.sizeFor({ joistType: 'conv_2x12', depthIn: 11.25, spanFt: 12 }), 'no sawn table yet').toBeNull();
});

test('a 2x12 is 1 1/2 x 11 1/4 and a 2x8 is on the list', () => {
  const types = W.DraftLevelAssembly.JOIST_TYPES;
  expect(types.find(t => t.id === 'conv_2x12').depthIn).toBe(11.25);
  expect(types.find(t => t.id === 'conv_2x8').depthIn).toBe(7.25);
});

test('a TJI deck is called out with the series its longest bay needs', inWin(() => {
  const B = W.DraftBuildHouse;
  const callout = { axis: 'x', label: 'TJI 14"', bays: [{ spanFt: 15 }, { spanFt: 19.5 }] };
  const sized = B.overSpanBays(callout, { joistType: 'tji', joistDepthIn: 14 });
  expect(sized.label).toBe('TJI 230 14"');
  expect(sized.bays.some(bay => bay.warn), 'both bays reach').toBe(false);
  // Past every 16" row the spacing is said; past the table the long bay is marked.
  expect(B.overSpanBays({ ...callout, bays: [{ spanFt: 23 }] }, { joistType: 'tji', joistDepthIn: 14 }).label)
    .toBe('TJI 560 14" @ 12" O.C.');
  const over = B.overSpanBays({ ...callout, bays: [{ spanFt: 10 }, { spanFt: 26 }] }, { joistType: 'tji', joistDepthIn: 14 });
  expect(over.bays.map(bay => Boolean(bay.warn))).toEqual([false, true]);
  // An engineer's typed callout wins, untouched.
  expect(B.overSpanBays(callout, { joistType: 'tji', joistDepthIn: 14, joistCallout: 'BY ENGINEER' }))
    .toBe(callout);
}));

test('a flush beam is as deep as the deck it holds; a dropped beam says nothing', inWin(() => {
  const B = W.DraftBuildHouse;
  const drawing = {
    levels: [{ id: 8, name: 'SITE' }, { id: 7, name: 'ROOF' }, { id: 5, name: '2ND FL' },
      { id: 3, name: 'MAIN FL' }, { id: 1, name: 'FOUNDATION' }],
    levelAssemblies: { 3: { joistType: 'tji', joistDepthIn: 14 }, 5: { joistType: 'conv_2x12', joistDepthIn: 11.25 } },
  };
  expect(B.beamDepthLabel({ levelId: 1, view: 'foundation', mode: 'flush' }, drawing), 'basement beam holds MAIN FL').toBe('14"');
  expect(B.beamDepthLabel({ levelId: 3, view: 'floor', mode: 'flush' }, drawing), 'MAIN FL beam holds 2ND FL').toBe('11-1/4"');
  expect(B.beamDepthLabel({ levelId: 1, view: 'foundation', mode: 'dropped' }, drawing)).toBeNull();
}));

test.describe('PROJECT — the JOIST DEPTH picks', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      if (sessionStorage.getItem('draft-test-storage-cleared')) return;
      sessionStorage.setItem('draft-test-storage-cleared', '1');
      localStorage.clear();
    });
  });

  test('the ▾ sets depth and type, the reach line follows, typing still works', async ({ page }) => {
    await page.goto('/PROJECT.html?type=bungalow');
    const box = page.locator('input[data-detail-input="floor-3"]');
    const reach = page.locator('[data-joist-reach="3"]');
    await expect(box).toHaveValue('11 7/8"');
    await expect(reach).toHaveText(`TJI @ 16": 16'-11" (110) to 20'-1" (560)`);

    await page.locator('[data-joist-pick-open="3"]').click();
    await expect(page.locator('[data-joist-pick-menu="3"] [data-joist-pick="tji:11.875"]'))
      .toHaveAttribute('aria-current', 'true');
    await page.locator('[data-joist-pick="tji:14"]').click();
    await expect(page.locator('[data-joist-pick-menu]')).toHaveCount(0);
    await expect(box).toHaveValue('14"');
    await expect(reach).toHaveText(`TJI @ 16": 18'-7" (110) to 22'-4" (560)`);

    await page.locator('[data-joist-pick-open="3"]').click();
    await page.locator('[data-joist-pick="conv_2x12:11.25"]').click();
    await expect(box).toHaveValue('11 1/4"');
    await expect(reach).toHaveText('2x12: no span table yet');

    // Stored: depth and type together, in the drawing the other pages read.
    await expect.poll(() => page.evaluate(async bucket => {
      const file = await window.SharedFileStore.loadSharedFile(bucket);
      return file ? JSON.parse(await file.text()).levelAssemblies?.[3] : null;
    }, h.STORAGE_BUCKET)).toMatchObject({ joistType: 'conv_2x12', joistDepthIn: 11.25 });

    // Typing still works, and keeps the type.
    await box.fill('9 1/2');
    await box.press('Enter');
    await expect(box).toHaveValue('9 1/2"');

    // Escape and a press elsewhere close the list.
    await page.locator('[data-joist-pick-open="3"]').click();
    await page.keyboard.press('Escape');
    await expect(page.locator('[data-joist-pick-menu]')).toHaveCount(0);
  });
});
