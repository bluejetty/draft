// The bottom-right nav cluster: MODEL · LAYOUT · PROJECT and the logo back
// to the main page, riding the status bar.
//
// ONE PAGE WEARS IT NOW. It was on both drawing pages until 24 Sep, when
// Construction Layout took the shared bars and the cluster came off with its
// own top bar -- the bottom bar's page row is the same map, written once by
// shell-bars.js out of one table, with the current page marked from what the
// page mounts itself with. So the cluster is MODEL.dc.html's, and this file
// asks two different questions of two different shapes: the old page still
// has its cluster, and the ported page has the row instead of a second copy.
//
// THE LOGO WENT WITH IT, on both converted pages. MODEL.html has no way back
// to index.html either, and that is a gap rather than a decision -- the page
// row has no HOME entry. Worth raising with Movie; not worth inventing.
const { test, expect } = require('@playwright/test');
const { openModel } = require('./helpers');

// MODEL.dc.html's own roster. It is typed here rather than read off a module
// because the DC page has no module to read -- the cluster is markup in the
// template, which is half of why it was worth replacing.
const LINKS = [
  ['[data-nav-model]', 'MODEL.dc.html'],
  ['[data-nav-layout]', 'LAYOUT.html'],
  ['[data-nav-project]', 'PROJECT.html'],
  ['[data-nav-home]', 'index.html'],
];

test('MODEL carries the nav cluster with MODEL wearing the dark face', async ({ page }) => {
  await openModel(page);

  for (const [selector, target] of LINKS) {
    const link = page.locator(selector);
    await expect(link).toBeVisible();
    expect(await link.getAttribute('href')).toContain(target);
  }
  await expect(page.locator('[data-nav-model]')).toHaveCSS('background-color', 'rgb(29, 31, 32)');
  await expect(page.locator('[data-nav-layout]')).toHaveCSS('background-color', 'rgb(255, 255, 255)');
});

test('LAYOUT wears the shared page row rather than a cluster of its own', async ({ page }) => {
  await page.goto('/LAYOUT.html');

  // NO SECOND COPY OF THE MAP. This is the assertion that would have caught
  // the obvious half-conversion -- mounting the bar and leaving the cluster
  // in the status bar, which looks fine and gives the drafter two rows of the
  // same links to keep in step.
  await expect(page.locator('[data-nav-cluster]')).toHaveCount(0);
  await expect(page.locator('#lay-top')).toHaveCount(0);

  // THE ROW IS READ OFF THE MODULE, not typed. shell-bars.js's own comment
  // calls its table the one place the row is said, and four hardcoded rosters
  // elsewhere in this suite have already gone stale against it.
  const rows = await page.evaluate(() => {
    const out = {};
    window.DraftShellBars.PAGES.forEach(entry => {
      out[entry.id] = { label: entry.label, href: entry.href };
    });
    return out;
  });
  for (const [id, entry] of Object.entries(rows)) {
    const chip = page.locator(`[data-page="${id}"]`);
    await expect(chip, `${id} is missing from the row`).toHaveCount(1);
    await expect(chip).toHaveText(entry.label);
  }

  // The page you are on is a span with aria-current, not a link to itself.
  const here = page.locator('[data-page="construction"]');
  await expect(here).toHaveAttribute('aria-current', 'page');
  expect(await here.evaluate(el => el.tagName)).toBe('SPAN');
  // And a page that does not exist yet is a disabled button, not a dead link.
  await expect(page.locator('[data-page="estimates"]')).toBeDisabled();
});

test('LAYOUT wears the top bar too, with the instruments standing down', async ({ page }) => {
  await page.goto('/LAYOUT.html');

  await expect(page.locator('#strip')).toBeVisible();
  await expect(page.locator('#settings-corner')).toBeVisible();
  // MOUNTED ON MOVIE'S OWN INSTRUCTION -- "put those top and bottom bars in
  // the Construction layout (with the LENGTH, ANGLE and other instruments ...
  // we may need to draw sometimes" -- and DORMANT because nothing on this
  // page fills them. The pair is the point: a bar without them would be the
  // wrong bar, and a live chip that does nothing would be worse.
  await expect(page.locator('#strip-center')).toBeVisible();
  //
  // EVERY chip dormant, and every chip that CAN be disabled disabled. The two
  // halves are separate because a chip is not always a button: four are, and
  // the rest are spans, and `el.disabled = true` on a span is ignored without
  // a word. The first version of this asked for both of everything and went
  // red on data-mode-compass -- which is how the page learned it had been
  // marking three chips down without actually standing them down.
  const state = await page.$$eval('#strip-center .chip', nodes => nodes.map(el => ({
    tag: el.tagName,
    dormant: el.classList.contains('dormant'),
    // `disabled in el` is the same test the page makes, so the two agree by
    // construction rather than by both being kept up to date by hand.
    disabled: 'disabled' in el ? el.disabled : null,
  })));
  expect(state.length, 'the instruments never mounted').toBeGreaterThan(0);
  expect(state.filter(c => !c.dormant)).toEqual([]);
  expect(state.filter(c => c.disabled === false)).toEqual([]);
  expect(state.filter(c => c.disabled === true).length,
    'no chip is a real control any more -- has the bar changed shape?')
    .toBeGreaterThan(0);

  // THE PAGE'S OWN DIALOG SURVIVED THE SWAP, and it had to: profile-manager's
  // parseFile has two callers in the whole repo, and neither SETTINGS.html
  // nor STANDARDS.html has an import path -- so this is the only door left to
  // reading a profile package back in on a page that is not the DC one.
  await expect(page.locator('#lay-scrim')).toBeHidden();
  await page.locator('[data-open-settings]').click();
  await expect(page.locator('#lay-scrim')).toBeVisible();
  await expect(page.locator('#lay-dialog-title')).toHaveText(/personal settings/i);
});

test('the cluster walks MODEL over to PROJECT and the logo back home', async ({ page }) => {
  await openModel(page);

  await page.click('[data-nav-project]');
  await expect(page).toHaveURL(/PROJECT\.html/);

  // BACK TO THE OLD PAGE FOR THE LOGO. This used to hop through LAYOUT, which
  // carried the same cluster; it does not any more, and PROJECT never did.
  await openModel(page);
  await page.click('[data-nav-home]');
  await expect(page).toHaveURL(/index\.html|\/$/);
});

test('and the page row walks LAYOUT over to the model space', async ({ page }) => {
  await page.goto('/LAYOUT.html');

  await page.click('[data-page="model"]');
  await expect(page).toHaveURL(/MODEL\.html/);
});
