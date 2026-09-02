// The column flow, on its own: heights in, an assignment out.
//
// Kept apart from the SPECS page spec because the rule it encodes — fill the
// columns, then break — is the one thing about a spec sheet that is arguable
// from a printout and unarguable from numbers.
const { test, expect } = require('@playwright/test');

const load = async page => {
  await page.goto('/SPECS.html');
  await page.waitForFunction(() => !!window.DraftSpecPages);
};

const flow = (page, items, height, columns = 3) =>
  page.evaluate(([list, h, c]) => window.DraftSpecPages.flow(list, h, c), [items, height, columns]);

const lines = (prefix, count, h = 10) =>
  Array.from({ length: count }, (_, i) => ({ key: `${prefix}-${i}`, h, keepWithNext: false }));

test('a column fills to its height before the next one starts', async ({ page }) => {
  await load(page);
  const pages = await flow(page, lines('a', 30), 100);
  // 30 lines of 10 px into 100 px columns: ten to a column, three columns, one page.
  expect(pages).toHaveLength(1);
  expect(pages[0].map(column => column.length)).toEqual([10, 10, 10]);
});

test('the fourth column starts a second page', async ({ page }) => {
  await load(page);
  const pages = await flow(page, lines('a', 35), 100);
  expect(pages).toHaveLength(2);
  expect(pages[0].map(column => column.length)).toEqual([10, 10, 10]);
  expect(pages[1].map(column => column.length)).toEqual([5, 0, 0]);
});

test('a heading never lands at the foot of a column alone', async ({ page }) => {
  await load(page);
  // 8 lines, then a heading, then 5 lines, in a 100 px column: the heading
  // would fit at 90 px with one line under it, and must move anyway.
  const items = [
    ...lines('a', 8),
    { key: 'head', h: 10, keepWithNext: true },
    ...lines('b', 5),
  ];
  const pages = await flow(page, items, 100);
  expect(pages[0][0]).not.toContain('head');
  expect(pages[0][1][0]).toBe('head');
});

test('an item taller than a column is not shuffled into emptying one', async ({ page }) => {
  await load(page);
  const items = [
    ...lines('a', 4),
    { key: 'giant', h: 250, keepWithNext: false },
    ...lines('b', 3),
  ];
  const pages = await flow(page, items, 100);
  // The giant stays where it fell rather than pushing four lines' worth of
  // blank column ahead of itself and overflowing anyway.
  expect(pages[0][0]).toEqual(['a-0', 'a-1', 'a-2', 'a-3', 'giant']);
});

test('an empty specification is no pages at all', async ({ page }) => {
  await load(page);
  expect(await flow(page, [], 100)).toEqual([]);
});
