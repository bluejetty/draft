// THE LEFT RAIL'S TABS, and the check that was not there.
//
// Movie, 29 Sep, shown the single column at 1366x768: "i'd like to spit it
// into multiple tabs actually ... DRAFTING , BUILD , PROPERTIES" -- and then,
// once he had seen the mock: "i'd like to be able to have the properties tab
// open while either of the other ones are open, but the other 2 don't need to
// open at the same time".
//
// SO IT IS TWO FACTS, NOT THREE TABS TAKING TURNS. DRAFTING and BUILD take
// turns; PROPERTIES stands open beside whichever of them is up. That second
// message is what makes the arrangement work at all: every panel opens on
// PROPERTIES (his ruling too), tool controls included, so with three tabs
// taking turns, arming FENESTRATION put DOOR / WINDOW one press from the key
// that raised it -- every time.
//
// WHAT WAS WRONG BEFORE ANY OF IT. Seventeen tool keys, the selection modes,
// the object-type filter, four fixture palettes and the assembly verbs were
// stacked in ONE column. At 1366x768 that is 691px inside a 532px rail, so
// 179px sat below a fold nothing marked: VANITY cut in half, LAUNDRY, BEDROOM
// and ASSEMBLY not on the screen at all. The tools were never the problem --
// all seventeen keys together are 248px and always fitted.
//
// AND NOTHING CAUGHT IT, which is why this file exists. The pairwise chrome
// check in model-html-shell.spec.js is the instrument for chrome going wrong,
// and it could not see this AT ANY WINDOW SIZE: it asks "does chrome overlap
// chrome", and a panel with `overflow-y:auto` never overlaps anything -- it
// scrolls. The question that catches it is CONTAINMENT, and nobody was asking
// it. Its viewports are 1280x900 and a width sweep at height 800, so 768 --
// the commonest laptop panel there is -- had never been run either.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const REPRO = JSON.parse(fs.readFileSync(
  path.join(__dirname, '..', 'proto', 'repro-garage-house.draft'), 'utf8'));

// A HOUSE, not an empty page. An empty drawing gives the fixture palettes and
// the assembly verbs nothing to size themselves against, and a pane that is
// short because it is empty would satisfy the fit check by having nothing to
// fit -- the disease this file is written against.
async function open(page, { pane = 'drafting', props = null, w = 1366, hh = 768 } = {}) {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, saved }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(saved)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, saved: REPRO });
  await page.setViewportSize({ width: w, height: hh });
  const q = `/MODEL.html?left=1&lpane=${pane}${props === false ? '&lprops=0' : ''}`;
  await page.goto(q);
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
}

const TOOL_TABS = [['drafting', 'left-tab', 'DRAFTING'], ['build', 'build-tab', 'BUILD']];

const shownPanes = page => page.evaluate(() =>
  [...document.querySelectorAll('[data-left-pane]')]
    .filter(el => !el.hidden).map(el => el.dataset.leftPane));

test('the left edge carries two tabs, and no PROPERTIES tab', async ({ page }) => {
  // Movie, 25 Oct: "keep the properties at the bottom of the BUILD and DRAFT
  // areas ... just leave them ON ... and we won't need the left side
  // PROPERTIES tab".
  await open(page);
  for (const [, id, label] of TOOL_TABS) {
    await expect(page.locator(`#${id}`), `${id} is on the edge`).toBeVisible();
    await expect(page.locator(`#${id}`)).toHaveText(label);
  }
  await expect(page.locator('#props-tab')).toHaveCount(0);
  await expect(page.locator('.rail-tab[data-left-pane-tab]')).toHaveCount(2);
});

test('each block is on the tab its tools are for', async ({ page }) => {
  // THE TABLE, CHECKED FROM OUTSIDE IT. BLOCK_PANE in MODEL.html says where
  // each block goes; this asserts the same thing from the rendered rail, so a
  // table edited without the builders following it goes red here rather than
  // shipping a block onto a tab nobody meant.
  const WHERE = {
    drafting: ['[data-tool-key="select"]', '[data-tool-key="dimension"]',
      '[data-sel-mode]', '[data-sel-filter]', '[data-assembly-start]'],
    build: ['[data-tool-key="wall"]', '[data-tool-key="fixture"]',
      '[data-fixture-kind]'],
    properties: ['[data-props-box]'],
  };
  for (const [pane, selectors] of Object.entries(WHERE)) {
    await open(page, { pane: pane === 'properties' ? 'drafting' : pane });
    for (const sel of selectors) {
      const owner = await page.locator(sel).first().evaluate(el =>
        el.closest('[data-left-pane]')?.dataset.leftPane || null);
      expect(owner, `${sel} sits on the ${pane} tab`).toBe(pane);
    }
  }
});

test('DRAFTING and BUILD take turns', async ({ page }) => {
  for (const [pane, id] of TOOL_TABS) {
    await open(page, { pane });
    expect((await shownPanes(page)).filter(p => p !== 'properties'),
      `only ${pane} of the two tool panes is up`).toEqual([pane]);
    await expect(page.locator(`#${id}`)).toHaveAttribute('aria-selected', 'true');
    const [, other] = TOOL_TABS.find(t => t[1] !== id);
    await expect(page.locator(`#${other}`)).toHaveAttribute('aria-selected', 'false');
  }
});

test('and PROPERTIES stands open beside either of them', async ({ page }) => {
  // THE WHOLE POINT OF THE SECOND MESSAGE. If this is ever red, arming a tool
  // costs a tab press to reach the tool's own controls, which is the thing
  // the arrangement exists to avoid.
  for (const [pane] of TOOL_TABS) {
    await open(page, { pane });
    const up = await shownPanes(page);
    expect(up, `${pane} and PROPERTIES are both on the rail`)
      .toEqual(expect.arrayContaining([pane, 'properties']));
  }
});

test('PROPERTIES stays on under either tab, even from an old link that shut it',
  async ({ page }) => {
    await open(page, { pane: 'build', props: false });
    expect(await shownPanes(page), 'lprops=0 means nothing now')
      .toEqual(expect.arrayContaining(['build', 'properties']));
    await page.locator('#left-tab').click();
    expect(await shownPanes(page), 'and it comes with DRAFTING too')
      .toEqual(expect.arrayContaining(['drafting', 'properties']));
  });

test('pressing the open tool tab shuts the rail; the other swaps it', async ({ page }) => {
  await open(page, { pane: 'drafting' });
  await expect(page.locator('#left-rail')).toBeVisible();

  await page.locator('#build-tab').click();
  await expect(page.locator('#left-rail'), 'a swap leaves the rail open').toBeVisible();
  await expect(page.locator('[data-tool-key="wall"]')).toBeVisible();

  await page.locator('#build-tab').click();
  await expect(page.locator('#left-rail'), 'the open tool tab shuts it').toBeHidden();
});

test('the tool tab survives a reload, because it is in the URL', async ({ page }) => {
  await open(page, { pane: 'build' });
  await page.reload();
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  await expect(page.locator('[data-tool-key="wall"]')).toBeVisible();
  await expect(page.locator('#build-tab')).toHaveAttribute('aria-selected', 'true');
  expect(await shownPanes(page), 'PROPERTIES still under it')
    .toEqual(expect.arrayContaining(['build', 'properties']));
});

test('an unknown lpane opens on DRAFTING rather than on a blank rail', async ({ page }) => {
  await open(page, { pane: 'kitchen-sink' });
  await expect(page.locator('#left-tab')).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('[data-tool-key="select"]')).toBeVisible();
});

test('the rail FITS at 1366x768 with PROPERTIES standing open — the question '
  + 'nobody was asking', async ({ page }) => {
  // THE DEFECT, AS A NUMBER. Before the split this rail held 691px of content
  // in a 532px box. The check is `scrollHeight <= clientHeight`: anything
  // taller is below a fold, whether or not it overlaps a thing.
  //
  // MEASURED WITH BOTH PANES UP, because that is the arrangement a drafter
  // actually gets -- a fit check on a tool tab alone would pass while the
  // rail he is looking at overflowed.
  const REACH = { drafting: '[data-tool-key="select"]', build: '[data-tool-key="wall"]' };
  for (const [pane] of TOOL_TABS) {
    await open(page, { pane });
    await expect(page.locator(REACH[pane]),
      `the ${pane} tab drew its own content before being measured`).toBeVisible();
    expect(await shownPanes(page), 'and PROPERTIES is up beside it')
      .toEqual(expect.arrayContaining([pane, 'properties']));
    const m = await page.evaluate(() => {
      const rail = document.getElementById('left-rail');
      return { client: rail.clientHeight, scroll: rail.scrollHeight };
    });
    expect(m.client, `the ${pane} rail has a height at all`).toBeGreaterThan(20);
    expect(m.scroll - m.client,
      `${pane} + PROPERTIES overflows the rail by ${m.scroll - m.client}px at 1366x768 — `
      + 'its bottom is below a fold nothing marks').toBeLessThanOrEqual(0);
  }
});

test('and the rail is only as tall as what is in it', async ({ page }) => {
  // Movie, on the mock: the rail "probably wants to shrink to its content".
  // Pinned top AND bottom it was 532px whatever was inside, so eight build
  // keys sat above 380px of empty panel. The ceiling stays -- `max-height`
  // keeps the exact floor the pin gave -- so this asserts BOTH: shorter than
  // the old pin for a short pane, and never past it.
  await open(page, { pane: 'build', props: false });
  const m = await page.evaluate(() => {
    const rail = document.getElementById('left-rail').getBoundingClientRect();
    const strip = document.getElementById('house-strip').getBoundingClientRect();
    return { railH: rail.height, railBottom: rail.bottom, stripTop: strip.top };
  });
  // The build keys and the FIXTURE rows -- KITCHEN's lines with Movie's
  // base cabinets (9 Oct), the WC 1/WC 2, WC BF2-BF5 and U1/L2/L3 presets
  // (17 Oct), and DORMER's key opening a third row of build keys (18 Oct,
  // 503px) -- still short of the 532px pin, which is the whole claim.
  expect(m.railH, 'the rail shrank to the build keys rather than filling 532px')
    .toBeLessThan(532);
  expect(m.railBottom, 'and still stops above the foot bar')
    .toBeLessThanOrEqual(m.stripTop);
});

test('PROPERTIES says why it is blank instead of showing nothing', async ({ page }) => {
  await open(page, { pane: 'drafting' });
  await expect(page.locator('[data-props-empty]')).toBeVisible();
  await expect(page.locator('[data-props-empty]')).toHaveText('NOTHING SELECTED');
  await expect(page.locator('[data-props-box]')).toBeHidden();
});

test('a build tool opens its own controls WITHOUT the drafter moving tab',
  async ({ page }) => {
    // THE ARRANGEMENT EARNING ITS KEEP. ROOF's key is on BUILD and its
    // overhang and pitch open in the PROPERTIES box -- and because PROPERTIES
    // stands open beside BUILD, they appear under the key he just pressed.
    // This is the check that fails if PROPERTIES ever goes back to taking a
    // turn with the tool tabs.
    await open(page, { pane: 'build' });
    // THE DRAFTING BOARD USED TO BE PRESSED HERE, because ROOF was not a TOY
    // tool and its key was dead on the board this page opens on. TOY offers
    // the whole roster since 15 Oct, so the key arms where it stands.

    await page.locator('[data-tool-key="roof"]').click();
    await page.waitForTimeout(200);

    await expect(page.locator('[data-props-box]'),
      'the roof panel is on screen, not one tab away').toBeVisible();
    await expect(page.locator('[data-tool-key="roof"]'),
      'and the key that raised it is still on screen too').toBeVisible();
    await expect(page.locator('#build-tab'),
      'the drafter never left BUILD').toHaveAttribute('aria-selected', 'true');
  });

test('arming a tool fills the box under the tab the drafter is on',
  async ({ page }) => {
    await open(page, { pane: 'build' });
    await page.locator('[data-tool-key="roof"]').click();
    await expect(page.locator('[data-props-box]'), 'the roof panel, in view under BUILD').toBeVisible();
    await expect(page.locator('#build-tab'),
      'and the drafter is still on BUILD').toHaveAttribute('aria-selected', 'true');
  });
