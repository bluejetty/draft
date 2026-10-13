// UP AND DOWN A STOREY (Movie, 12 Oct): "id like UP and DOWN arrows and when
// they are pressed the LEVEL goes either to the next one up or the next one
// down", marked at the foot strip beside the bone.
//
// WHAT THESE PIN, beyond "a button that does something": the arrows step the
// list the drafter is LOOKING AT. The levels panel renders `drawing.levels`
// straight through -- SITE, ROOF, 2ND FL, MAIN FL, FOUNDATION -- so the order
// here is read off that panel rather than written down twice. An
// implementation that sorted by `elev` instead would pass a check that only
// watched the level change, and would get SITE and MAIN FL in the wrong order
// on the stock drawing, because both of them sit at elevation 0.
const fs = require('fs');
const path = require('path');
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const REPRO = JSON.parse(fs.readFileSync(
  path.join(__dirname, '..', 'proto', 'repro-garage-house.draft'), 'utf8'));

async function openPage(page) {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, saved }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(saved)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, saved: REPRO });
  await page.goto('/MODEL.html?mode=night');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
}

const up = page => page.locator('#model-level-up');
const down = page => page.locator('#model-level-down');

// The level the page is actually on, asked of the panel rather than of the
// URL: the panel marks the active card, and that is what the drafter sees.
const activeLevel = page => page.evaluate(() =>
  document.querySelector('#levels-panel .lv-card[data-active]')?.dataset.level ?? null);

// The order the panel shows, top row first -- THE STOREY CARDS ONLY.
//
// The panel also carries the BONEYARD's shelf cards, which carry
// `data-boneyard` and no `data-level`, and a shelf is not a storey: it is a
// parking space with a negative id that is not in `drawing.levels` at all. The
// first version of this spec read every `.lv-card` and so expected the arrows
// to walk onto the shelves, which failed at the bottom of the real levels --
// the spec was wrong and the arrows were right.
const panelOrder = page => page.evaluate(() =>
  [...document.querySelectorAll('#levels-panel .lv-card:not([data-boneyard])')]
    .map(card => card.dataset.level));

test('the arrows walk the levels in the order the panel shows them', async ({ page }) => {
  await openPage(page);
  await h.openRails(page);

  const order = await panelOrder(page);
  expect(order.length, 'the fixture has only one level, so stepping proves nothing')
    .toBeGreaterThan(2);

  // Down to the bottom, one press at a time, checking each landing against
  // the panel's own next row.
  const start = await activeLevel(page);
  let at = order.indexOf(start);
  expect(at, 'the active card is not one of the panel rows').toBeGreaterThanOrEqual(0);

  while (at < order.length - 1) {
    await down(page).click();
    at += 1;
    expect(await activeLevel(page), `DOWN from row ${at - 1} did not land on row ${at}`)
      .toBe(order[at]);
  }
  // At the bottom DOWN says so rather than doing nothing when pressed.
  await expect(down(page)).toBeDisabled();
  await expect(up(page)).toBeEnabled();

  while (at > 0) {
    await up(page).click();
    at -= 1;
    expect(await activeLevel(page), `UP from row ${at + 1} did not land on row ${at}`)
      .toBe(order[at]);
  }
  await expect(up(page)).toBeDisabled();
  await expect(down(page)).toBeEnabled();

  // AND THE WALK IS THE STOREYS, not everything the panel draws. If the
  // boneyard's shelves were in it the ends would be somewhere else entirely,
  // and the check above would have walked past the top floor onto a shelf.
  const shelves = await page.locator('#levels-panel .lv-card[data-boneyard]').count();
  expect(order.every(id => id !== undefined),
    'a card with no level id got into the walk').toBe(true);
  expect(order.length + shelves,
    'the fixture has no shelf card, so the distinction above is untested')
    .toBeGreaterThan(order.length);
});

test('an arrow changes the level the same way a level row does: the URL carries it',
  async ({ page }) => {
    await openPage(page);
    await h.openRails(page);
    const order = await panelOrder(page);
    const start = await activeLevel(page);

    await down(page).click();
    const landed = order[order.indexOf(start) + 1];
    expect(await activeLevel(page)).toBe(landed);
    // THE SAME DOOR AS THE PANEL ROW. goToLevel is what writes `?level=`, so
    // a URL carrying the new level is how this spec knows the arrows went
    // through it rather than repainting behind its back -- which would leave
    // a reload on the old storey.
    expect(new URL(page.url()).searchParams.get('level')).toBe(landed);
  });

test('the arrows are MODEL\'s own: the pages that share the bar do not show them',
  async ({ page }) => {
    await openPage(page);
    await expect(up(page)).toBeVisible();

    // LAYOUT and PROJECT carry the same foot strip out of shell-bars.js and
    // have no levels to step, so the pair ships hidden and only this page
    // unhides it. A button that turned up there would be a control with
    // nothing behind it.
    for (const url of ['/LAYOUT.html', '/PROJECT.html']) {
      await page.goto(url);
      await page.waitForLoadState('load');
      const shown = await page.evaluate(() => ['model-level-up', 'model-level-down']
        .map(id => document.getElementById(id))
        .filter(el => el && !el.hidden).length);
      expect(shown, `a storey arrow is showing on ${url}`).toBe(0);
    }
  });
