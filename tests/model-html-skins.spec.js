// FOUR SKINS, PROVEN ON THE CANVAS AND NOT ONLY IN THE STYLESHEET.
//
// Movie's ruling, 3 Sep: RUFF DRAFTER and ROUGH DRAFTER, each night and day.
// The skins get designed later; what is built now is the seam. See
// RD-DOCUMENTS/SPEC-skins.md.
//
// The measurement that matters is the canvas, not the CSS. 92% of MODEL's
// colour is set from JavaScript -- 174 inline style attributes and 52 canvas
// fillStyle assignments -- so a palette that only reaches the stylesheet would
// pass a CSS assertion while leaving the drawing painted in night for ever.
// Every test here therefore reads PIXELS for the drawing and computed style
// only for the chrome.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

// What SHOULD be on screen, worked out here rather than by calling the module
// the page calls. If this asked layer-views.js the same question MODEL.html
// asks it, a wrong answer would agree with itself and pass. So the rule is
// written out: MAIN FL is level id 3, its default layer view is the walls
// plan, and an item with no `view` is a plan item.
const MAIN_FL = 3;
const onMainPlan = item => Number(item.levelId) === MAIN_FL
  && (item.view || 'plan') === 'plan';


// The ground the skin says it painted, read off the element palette.js wrote
// it to. Also a check that apply() ran at all.
async function ground(page) {
  return page.evaluate(() => {
    const css = getComputedStyle(document.documentElement)
      .getPropertyValue('--surface-page').trim();
    const hex = css.replace('#', '');
    return { css, rgb: [0, 2, 4].map(i => parseInt(hex.slice(i, i + 2), 16)) };
  });
}

// What the canvas actually contains, relative to that ground. Antialiasing
// makes exact colour matching brittle on 1px grid lines, so this measures
// DISTANCE from the ground instead, which survives it.
async function inkProfile(page) {
  return page.evaluate(() => {
    const css = getComputedStyle(document.documentElement)
      .getPropertyValue('--surface-page').trim().replace('#', '');
    const g = [0, 2, 4].map(i => parseInt(css.slice(i, i + 2), 16));
    const canvas = document.getElementById('plan');
    const { data } = canvas.getContext('2d')
      .getImageData(0, 0, canvas.width, canvas.height);
    let groundPx = 0, faint = 0, strong = 0, total = 0;
    for (let i = 0; i < data.length; i += 4) {
      total += 1;
      const d = Math.max(Math.abs(data[i] - g[0]), Math.abs(data[i + 1] - g[1]),
        Math.abs(data[i + 2] - g[2]));
      if (d <= 4) groundPx += 1;
      else if (d < 60) faint += 1;
      else strong += 1;
    }
    return { groundPx, faint, strong, total };
  });
}

// The palette's three grid weights, hardcoded. Reading them off the page and
// then checking the page used them would be a tautology; if palette.js changes
// these, this constant has to change with it, and that is the point.
const NIGHT_GRID = [[0x26, 0x29, 0x2a], [0x34, 0x38, 0x3a], [0x45, 0x4a, 0x4c]];
const DAY_GRID = [[0xe0, 0xe1, 0xe3], [0xcb, 0xcd, 0xcf], [0xb0, 0xb3, 0xb5]];

async function colourPixels(page, targets) {
  return page.evaluate(list => {
    const c = document.getElementById('plan');
    const { data } = c.getContext('2d').getImageData(0, 0, c.width, c.height);
    let hits = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (list.some(t => Math.max(Math.abs(data[i] - t[0]), Math.abs(data[i + 1] - t[1]),
        Math.abs(data[i + 2] - t[2])) <= 2)) hits += 1;
    }
    return hits;
  }, targets);
}

async function houseOnOldPage(page) {
  await h.openModel(page, { webgl: false, rails: false, entryCoach: true });
  await expect(page.locator('[data-entry-coach]')).toBeVisible({ timeout: 4000 });
  await page.locator('[data-first-bone-press]').click();
  await h.waitForSaved(page);
  return h.savedDrawing(page);
}

test.describe('MODEL.html skins', () => {
  // The whole 2x2, so a skin that fails to resolve fails here rather than on
  // the day someone selects it.
  for (const theme of ['ruff', 'rough']) {
    for (const mode of ['night', 'day']) {
      test(`${theme}/${mode} applies to the page and to the canvas`, async ({ page }) => {
        const saved = await houseOnOldPage(page);
        await page.goto(`/MODEL.html?theme=${theme}&mode=${mode}`);
        await expect(page.locator('#readout')).toContainText('walls', { timeout: 5000 });
        await expect(page.locator('#readout'))
          .toContainText(`walls ${saved.walls.filter(onMainPlan).length}/`);

        // The page says which skin it is wearing.
        await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
        await expect(page.locator('html')).toHaveAttribute('data-mode', mode);

        // THE CANVAS IS PAINTED IN IT, and this is the assertion that would
        // catch `paint()` keeping its old literal '#1d1f20' clear.
        //
        // Not "the modal colour is the ground" -- two earlier versions of this
        // test assumed the ground dominates, and it does not reliably. The
        // page stacks all five levels (the level filter is tier 2), so
        // overlapping floor polygons compound the 10% wash and the largest
        // single colour on the canvas can be wash-over-wash-over-wash rather
        // than bare ground. Measured across repeats, the skin's own ground
        // covers 0.31-0.53 of the canvas depending on how the drawing fits.
        //
        // So it asks the question that has a wide answer instead: THE OTHER
        // SKIN'S GROUND IS ABSENT. Measured 0.0000-0.0039 (a few pixels of
        // coincidence in the wall fills), against the 0.31+ it would be if the
        // clear were hardcoded -- a hundredfold gap, and one that does not
        // move with the fit.
        const { rgb } = await ground(page);
        const other = mode === 'night' ? [242, 242, 243] : [29, 31, 32];
        const share = await page.evaluate(([mine, theirs]) => {
          const c = document.getElementById('plan');
          const { data } = c.getContext('2d').getImageData(0, 0, c.width, c.height);
          const eq = (i, g) => data[i] === g[0] && data[i + 1] === g[1] && data[i + 2] === g[2];
          let m = 0, t = 0, total = 0;
          for (let i = 0; i < data.length; i += 4) {
            total += 1;
            if (eq(i, mine)) m += 1;
            if (eq(i, theirs)) t += 1;
          }
          return { mine: m / total, theirs: t / total };
        }, [rgb, other]);

        expect(share.mine, 'the canvas clear must use this skin\'s ground')
          .toBeGreaterThan(0.15);
        expect(share.theirs, 'and must not be painted in the other skin\'s ground')
          .toBeLessThan(0.02);
      });
    }
  }

  test('night and day are genuinely different paintings, not just different chrome',
    async ({ page }) => {
      await houseOnOldPage(page);

      await page.goto('/MODEL.html?mode=night');
      await expect(page.locator('#readout')).toContainText('walls', { timeout: 5000 });
      const nightGround = (await ground(page)).rgb;
      const night = await inkProfile(page);

      await page.goto('/MODEL.html?mode=day');
      await expect(page.locator('#readout')).toContainText('walls', { timeout: 5000 });
      const dayGround = (await ground(page)).rgb;
      const day = await inkProfile(page);

      expect(nightGround[0]).toBeLessThan(80);
      expect(dayGround[0]).toBeGreaterThan(200);

      // THIS BLOCK USED TO ASSERT A GRID, and the grid was mine rather than
      // the product's. Tier 1 hand-rolled a grid that drew always, anchored to
      // world 0,0. The real page anchors it to the DRAWING DATUM -- the
      // drafter's first click -- and draws none at all when there is no datum
      // (tests/registration-grid.spec.js, "an untouched model space draws no
      // grid, and the first node sets the datum").
      //
      // The generated house is never clicked into place, so it saves
      // `drawingOrigin: null` and correctly gets NO GRID. `faint` measured
      // 399k-420k of 921k pixels while the hand-rolled grid was there; it
      // measures 28 now. So the old assertion was pinning a divergence, and
      // its replacement pins the behaviour instead: a drawing with no datum
      // has essentially nothing between the ground and the linework.
      //
      // The positive case -- a grid that appears BECAUSE a datum exists, in
      // this skin's own greys -- is tests/model-html-grid.spec.js. It belongs
      // there because it needs a drawing built with a datum, which this
      // fixture cannot produce.
      // MEASURED with the grid gone: ground 0.986 night / 0.979 day, strong
      // 11,149px / 8,822px, faint 1,316px / 10,222px.
      //
      // NOTE WHAT faint DOES: it differs EIGHT-FOLD between the two skins,
      // because dark ink anti-aliasing onto a light ground leaves far more
      // intermediate pixels than the reverse. So no single faint threshold has
      // a wide answer, and the first attempt at this line picked 0.01, which
      // lands between 0.00143 and 0.01109 and fails on day. That is the fourth
      // invented threshold in this suite's history. The cure is not a better
      // number -- it is to stop asking a question whose answers are close
      // together.
      for (const [name, p] of [['night', night], ['day', day]]) {
        expect(p.groundPx / p.total, `${name}: the ground should dominate`)
          .toBeGreaterThan(0.9);
        expect(p.strong, `${name}: there must be real linework, far from the `
          + 'ground -- a skin painting walls in the OTHER skin\'s ink would '
          + 'land in groundPx instead')
          .toBeGreaterThan(2000);
      }

      // AND NO GRID -- but asserted through the readout, not by counting
      // pixels. Night ink anti-aliasing onto the night ground manufactures
      // pixels at the grid's own greys, so a colour count cannot separate a
      // painted grid from a rendered edge (1 px in one house, 306 in
      // another). The pixel evidence lives in model-html-grid.spec.js, where
      // it is a RATIO against the same scene with a datum added.
      for (const name of ['night', 'day']) {
        await page.goto(`/MODEL.html?mode=${name}`);
        await expect(page.locator('#readout')).toContainText('walls', { timeout: 5000 });
        await expect(page.locator('#readout'),
          `${name}: the generated house has no datum, so there is no grid to `
          + 'anchor -- and the readout should say so rather than leave it a '
          + 'mystery')
          .toContainText('datum none');
      }
    });

  test('the theme axis reaches the chrome, and only the brand moves', async ({ page }) => {
    await houseOnOldPage(page);
    const accentOf = async themeName => {
      await page.goto(`/MODEL.html?theme=${themeName}&mode=night`);
      await expect(page.locator('#readout')).toContainText('walls', { timeout: 5000 });
      return page.evaluate(() => ({
        accent: getComputedStyle(document.querySelector('#readout b')).color,
        ink: getComputedStyle(document.body).color,
      }));
    };
    const ruff = await accentOf('ruff');
    const rough = await accentOf('rough');
    // Movie, 3 Sep: "we will change mainly through logos and colors".
    expect(rough.accent, 'the brands must not share an accent').not.toBe(ruff.accent);
    expect(rough.ink, 'the ink is the mode\'s job, not the brand\'s').toBe(ruff.ink);
  });

  test('a typo in the URL falls back instead of blanking the page', async ({ page }) => {
    await houseOnOldPage(page);
    const warnings = [];
    page.on('console', m => { if (m.type() === 'warning') warnings.push(m.text()); });

    await page.goto('/MODEL.html?theme=gruff&mode=dusk');
    // The page still works -- resolve() throws on a bad name, and a URL must
    // not be able to reach that throw.
    await expect(page.locator('#readout')).toContainText('walls', { timeout: 5000 });
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'ruff');
    await expect(page.locator('html')).toHaveAttribute('data-mode', 'night');
    expect(warnings.join(' '), 'and it says so, rather than failing silently')
      .toContain('gruff');
  });
});
