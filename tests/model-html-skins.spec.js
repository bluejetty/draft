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

  // THE ROOF FOLLOWS THE SKIN, and until 4 Sep it did not.
  //
  // drawRoof2D used one brown on both skins -- #7a4a21, which is 6.64 on the
  // day page and 2.23 on the night one, under the 3.0 non-text floor. It was
  // the last colour in the app that was actually broken rather than quiet.
  // palette.js pins the contrast; this pins that the value reaches the canvas,
  // which is a different claim and the one a page can fail on its own.
  //
  // Counted as exact pixels of each brown rather than a family predicate: the
  // question here is WHICH brown, so a test that accepts any brown answers a
  // question nobody asked. Presence of one against total absence of the other,
  // measured on the same drawing at the same level.
  const ROOF_LEVEL = 7;
  const NIGHT_ROOF = [0xc4, 0x91, 0x5a];
  const DAY_ROOF = [0x7a, 0x4a, 0x21];
  const exact = (page, rgb) => page.evaluate(t => {
    const c = document.getElementById('plan');
    const { data } = c.getContext('2d').getImageData(0, 0, c.width, c.height);
    let n = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i] === t[0] && data[i + 1] === t[1] && data[i + 2] === t[2]) n += 1;
    }
    return n;
  }, rgb);

  for (const [mode, mine, theirs, name] of [
    ['night', NIGHT_ROOF, DAY_ROOF, '#c4915a'],
    ['day', DAY_ROOF, NIGHT_ROOF, '#7a4a21'],
  ]) {
    test(`the roof is painted in ${name} on ${mode}, and never in the other skin's brown`,
      async ({ page }) => {
        await houseOnOldPage(page);
        await page.goto(`/MODEL.html?level=${ROOF_LEVEL}&mode=${mode}`);
        await expect(page.locator('#readout')).toContainText('roofs 1/', { timeout: 6000 });

        // The fixture first: no roof on the level means both counts are zero
        // and the absence assertion below passes for the wrong reason.
        const ours = await exact(page, mine);
        expect(ours, `the roof must be painted in ${name}`).toBeGreaterThan(50);

        const other = await exact(page, theirs);
        expect(other, "the other skin's roof brown must not appear").toBe(0);
      });
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

  // THE PREVIEW RAIL IS PAINTED, NOT STYLED, which is why it can go stale in
  // a way no CSS check would catch. Each elevation seat holds PIXELS from
  // whenever it was last drawn, so a skin switch that repaints the drawing
  // and not the rail leaves four night elevations beside a white sheet --
  // Movie, 24 Sep: "the 'day' sidebar elevations look like 'night'".
  //
  // IT WAS INVISIBLE UNTIL THE PAINTER LEARNED ABOUT SKINS. While an
  // elevation drew the same picture whatever the lights were doing, a rail
  // nobody repainted was a rail nobody could tell was stale. The miss is
  // older than the symptom, which is the argument for pinning it in pixels
  // rather than trusting the call to stay where it was put.
  test('a skin switch repaints the preview rail, not just the drawing',
    async ({ page }) => {
      await houseOnOldPage(page);
      await page.goto('/MODEL.html?mode=night&pane=previews&right=1');
      await expect(page.locator('#readout')).toContainText('walls', { timeout: 15000 });
      await page.waitForTimeout(2500);

      // THE SEAT'S OWN GROUND, one pixel in from its corner -- the canvas the
      // painter cleared, not the chrome around it. The chrome follows the skin
      // through CSS either way, so only what is painted INTO the seat can say
      // whether it was repainted.
      const grounds = () => page.evaluate(() => [...document.querySelectorAll('canvas')]
        .filter(c => c.width > 40 && c.width < 260 && c.height > 30 && c.height < 200)
        .map(c => {
          const d = c.getContext('2d').getImageData(2, 2, 1, 1).data;
          return d[3] === 0 ? null : d[0] + d[1] + d[2];
        })
        .filter(v => v !== null));

      const night = await grounds();
      expect(night.length, 'no painted seats to read, so this proves nothing')
        .toBeGreaterThan(0);
      // Dark: the three channels of a night ground sum well under half of 765.
      night.forEach(sum => expect(sum, 'a seat was not painted in night').toBeLessThan(300));

      await page.locator('[data-skin-mode="day"]').click();
      await page.waitForTimeout(2000);

      const day = await grounds();
      expect(day.length, 'the seats went missing across the switch')
        .toBe(night.length);
      // And light. Before the rail was repainted these came back unchanged at
      // the night value, which is exactly what the drafter was looking at.
      day.forEach(sum => expect(sum, 'a seat kept its night ground on day')
        .toBeGreaterThan(600));
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

  // THE FIRST LOGO TO ARRIVE ON THE THEME AXIS. Movie, 17 Sep: the bone
  // becomes a blue house on the ROUGH DRAFTER version. palette.js's own note
  // said a theme is "mainly through logos and colors" and until now only the
  // colours had anything to prove.
  //
  // BOTH PRESSES, AND THE SIGN'S IS THE ONE THAT ROTS. The foot bar's bone is
  // in front of whoever presses the switch; the one on the sign's post is
  // behind a shut board, so a swap that reached only the visible one would
  // look right all day and show a red bone the first time someone opened the
  // drive-thru. This drives the switch with the board UP for exactly that
  // reason.
  test('the build press wears the theme\'s own artwork, on both presses', async ({ page }) => {
    await houseOnOldPage(page);
    await page.goto('/MODEL.html?theme=ruff&mode=night');
    await expect(page.locator('#readout')).toContainText('walls', { timeout: 5000 });

    const artOf = locator => locator.evaluate(el => ({
      // The file, not the whole URL: the assertion is about which artwork,
      // and a port number in the expectation is a spec that fails on a
      // second worktree.
      file: new URL(el.src).pathname.split('/').pop(),
      alt: el.alt,
    }));
    const barBone = page.locator('#bone img');
    const signBone = page.locator('#dt-bone img');

    expect((await artOf(barBone)).file, 'RUFF keeps the bone').toBe('bone-red.png');
    expect((await artOf(signBone)).file, 'and so does the sign').toBe('bone-red.png');

    // The board UP, so the sign's press is on screen while the theme changes
    // under it.
    await page.locator('#bone').click();
    await expect(page.locator('#dt-bone')).toBeVisible({ timeout: 4000 });

    await page.locator('[data-theme-switch] [data-theme="rough"]').click();
    // THE ON STATE, BECAUSE THE BOARD IS UP. The press that called the board
    // is lit for as long as the board stands, so the file here is the lit one
    // -- and either file would say the swap reached it, since a press stuck on
    // the other theme reads bone-red.png in both states.
    expect((await artOf(barBone)).file, 'ROUGH puts a blue house on the bar')
      .toBe('house-blue-on.png');
    // AND ROUGH'S BOARD HAS NO PRESS ON IT. The sheet rides above the bar and
    // leaves the bone standing there instead, so there is nothing on the
    // paper for the swap to reach. Its src is still kept right, because a
    // hidden control that comes back wrong is the same defect one switch
    // later.
    await expect(page.locator('#dt-bone'),
      'the sheet carries no press of its own').toBeHidden();
    expect((await artOf(signBone)).file,
      'though the one behind it is kept in the right finish').toBe('house-blue-off.png');

    // THE SPOKEN NAME MOVES WITH THE PICTURE. A screen reader told BONE while
    // the screen shows a house is the same defect one sense over.
    await expect(page.locator('#bone .said')).toHaveText('HOUSE');
    expect((await artOf(signBone)).alt, 'the sign\'s press says what it is')
      .toContain('HOUSE');

    // AND BACK, because a one-way swap passes every test written forwards.
    await page.locator('[data-theme-switch] [data-theme="ruff"]').click();
    expect((await artOf(barBone)).file, 'RUFF takes the bone back').toBe('bone-red.png');
    // Lit or not, RUFF has one file. The board is still up here, so this also
    // says that a theme with no ON state is not left reaching for one -- and
    // that the sign's press, which ROUGH had hidden a moment ago, comes back
    // wearing the right artwork rather than the one it went away in.
    await expect(page.locator('#dt-bone')).toBeVisible();
    expect((await artOf(signBone)).file, 'on both presses').toBe('bone-red.png');
    await expect(page.locator('#bone .said')).toHaveText('BONE');
  });

  // THE BOARD IS THE SECOND LOGO, and it moves on the same switch. Movie, 17
  // Sep: "the blueprint will replace the drivethru", "in the ROUGH version it
  // isn't going to show the dog", "no dog will ask questions they will just
  // see the selections".
  //
  // TWO THINGS, AND THE SECOND IS THE ONE WORTH PINNING. Swapping the picture
  // is one attribute; taking the dog's screen off it is a stylesheet rule that
  // a later edit to #dt-screen could undo without touching anything named
  // rough. The selections are asserted to survive both, because the whole
  // instruction was that they are what is left.
  test('ROUGH trades the sign for a sheet, and the dog goes with it',
    async ({ page }) => {
      await houseOnOldPage(page);
      await page.goto('/MODEL.html?theme=ruff&mode=night');
      await expect(page.locator('#readout')).toContainText('walls', { timeout: 5000 });
      const boardFile = () => page.locator('#dt-board')
        .evaluate(el => new URL(el.src).pathname.split('/').pop());

      // THE BOARD UP FOR THE WHOLE SWAP, for the same reason the press test
      // does it: a shut board is a board nobody can see is wrong.
      await page.locator('#bone').click();
      await expect(page.locator('#dt-bone')).toBeVisible({ timeout: 4000 });

      expect(await boardFile(), 'RUFF keeps the sign')
        .toBe('drivethru-menu-board.png');
      await expect(page.locator('#dt-screen'), 'and Gruff has his screen on it')
        .toBeVisible();
      await expect(page.locator('[data-drivethru-line]')).not.toBeEmpty();

      await page.locator('[data-theme-switch] [data-theme="rough"]').click();
      expect(await boardFile(), 'ROUGH puts the blueprint up instead')
        .toBe('draft-board.png');
      await expect(page.locator('#dt-screen'),
        'and the dog\'s screen is not on a sheet of paper').toBeHidden();
      await expect(page.locator('#build-families button').first(),
        'the selections are what is left').toBeVisible();

      // AND BACK. A one-way swap passes every test written forwards.
      await page.locator('[data-theme-switch] [data-theme="ruff"]').click();
      expect(await boardFile(), 'RUFF takes the sign back')
        .toBe('drivethru-menu-board.png');
      await expect(page.locator('#dt-screen')).toBeVisible();
    });

  // THE SHEET RIDES ABOVE THE BAR AND LEAVES THE BONE STANDING. Movie, 17
  // Sep: "don't put the house on the blueprint, just bring the blueprint up
  // high enough so the house button on the model area can be seen still" --
  // "i mean the blue house button don't put it on the blueprint".
  //
  // GEOMETRY, NOT A PIXEL. The lift is `--house-h` plus a gap and --house-h is
  // a min-height, so a foot bar whose row wrapped would be taller than the
  // stylesheet clears. What is asserted is the requirement -- the bone's
  // rectangle starts below the board's -- which is the same shape as the
  // drive-thru suite's assertion that the SIGN covers it, read the other way.
  //
  // AND REACHABLE, WHICH IS THE POINT OF SEEING IT. The sign disables the
  // bone because it hides it; a sheet that left the press visible and dead
  // would satisfy every assertion above and still be the wrong board.
  test('the sheet clears the bone instead of covering it, and leaves it live',
    async ({ page }) => {
      await houseOnOldPage(page);
      const boxes = async () => ({
        bone: await page.locator('#bone').boundingBox(),
        board: await page.locator('#dt-frame').boundingBox(),
      });

      await page.goto('/MODEL.html?theme=rough&mode=night');
      await expect(page.locator('#readout')).toContainText('walls', { timeout: 5000 });
      await page.locator('#bone').click();
      await expect(page.locator('#drivethru')).not.toHaveAttribute('data-shut', '', { timeout: 4000 });

      const up = await boxes();
      expect(up.bone.y, `the sheet (to ${Math.round(up.board.y + up.board.height)}) `
        + `runs over the bone (from ${Math.round(up.bone.y)})`)
        .toBeGreaterThanOrEqual(up.board.y + up.board.height);
      await expect(page.locator('#bone'),
        'and the press it left showing is the one that builds').toBeEnabled();

      // AND IT SITS IN THE MIDDLE OF THE SHEET (Movie, 18 Sep: "can you move
      // the blueprint to closer to middle (top bottomwise)"). The rule is
      // "centred, or clear of the bar, whichever is lower", and this viewport
      // has room for the first -- so the tolerance is 2px for rounding, not a
      // window wide enough for the fallback to slip through.
      const middle = page.viewportSize().height / 2;
      expect(Math.abs(up.board.y + up.board.height / 2 - middle),
        `the sheet's centre is at ${Math.round(up.board.y + up.board.height / 2)}, `
        + `the sheet's middle at ${middle}`)
        .toBeLessThanOrEqual(2);

      // THE SIGN STILL COVERS IT, read on the same page with one press of the
      // switch between. Two boards, two behaviours, one rule about coverage.
      await page.locator('[data-theme-switch] [data-theme="ruff"]').click();
      const sign = await boxes();
      expect(sign.bone.y, 'the sign is meant to cover the bone')
        .toBeLessThan(sign.board.y + sign.board.height);
      await expect(page.locator('#bone'),
        'so under the sign it is not something to tab into').toBeDisabled();
    });

  // THE GLOW IS A SECOND FILE ON ROUGH. RUFF's is a CSS filter over one
  // artwork and has nothing to swap, which is the asymmetry this pins.
  //
  // AND IT LASTS THE WHOLE VISIT NOW, not two seconds. Movie, 17 Sep: "when
  // the blueprint is showing the blue house button should be light and when
  // it goes down unlit". It used to come on for the rise and go out as the
  // board arrived; the board arriving is now the middle of the light rather
  // than the end of it, so this reads it at all three moments -- during the
  // rise, with the board up, and after it goes down. A light that never went
  // out would pass a check that stopped at the second.
  test('the ROUGH press lights by swapping to its ON artwork, and stays lit',
    async ({ page }) => {
      await houseOnOldPage(page);
      await page.goto('/MODEL.html?theme=rough&mode=night');
      await expect(page.locator('#readout')).toContainText('walls', { timeout: 5000 });
      const file = async () => page.locator('#bone img')
        .evaluate(el => new URL(el.src).pathname.split('/').pop());

      expect(await file(), 'at rest it is the OFF house').toBe('house-blue-off.png');
      await page.locator('#bone').click();
      // DURING the rise, which is the two seconds before the board arrives.
      await expect.poll(file, { timeout: 1500 })
        .toBe('house-blue-on.png');
      // AND STILL, with the board up. The press is on the bar, in plain sight
      // beneath the sheet, so this is the state the drafter looks at longest.
      await expect(page.locator('#drivethru'))
        .not.toHaveAttribute('data-shut', '', { timeout: 4000 });
      await expect(page.locator('#bone')).toHaveAttribute('data-lit', '');
      expect(await file(), 'the sheet is up, so the house stays lit')
        .toBe('house-blue-on.png');

      // AND OUT when the board goes down, which is the edge the wording named.
      await page.locator('[data-drivethru-close]').click();
      await expect(page.locator('#drivethru')).toHaveAttribute('data-shut', '');
      await expect(page.locator('#bone')).not.toHaveAttribute('data-lit', '');
      expect(await file(), 'and out again when it goes down')
        .toBe('house-blue-off.png');
    });

  // THE ARTWORK IS REACHABLE, which a src assertion cannot tell you. A missing
  // file leaves the attribute exactly as this spec expects and draws a broken
  // image -- the one failure the swap is most likely to ship with, since the
  // houses arrive as separate uploads.
  test('every theme\'s build artwork actually loads', async ({ page }) => {
    await houseOnOldPage(page);
    for (const theme of ['ruff', 'rough']) {
      await page.goto(`/MODEL.html?theme=${theme}&mode=night`);
      await expect(page.locator('#readout')).toContainText('walls', { timeout: 5000 });
      const ok = await page.locator('#bone img').evaluate(el => el.complete && el.naturalWidth > 0);
      expect(ok, `${theme}: the build press's artwork is missing or failed to decode`).toBe(true);
      // THE BOARD TOO, and it needs the check more than the press does: it is
      // behind a shut drive-thru, so a missing file draws its broken image
      // where nobody looks until they open the menu.
      const boardOk = await page.locator('#dt-board')
        .evaluate(el => el.complete && el.naturalWidth > 0);
      expect(boardOk, `${theme}: the board's artwork is missing or failed to decode`).toBe(true);
    }
    // The ON state too, which no page shows at rest and so no other check
    // would ever fetch.
    const lit = await page.evaluate(() => new Promise(ok => {
      const img = new Image();
      img.onload = () => ok(img.naturalWidth > 0);
      img.onerror = () => ok(false);
      img.src = './assets/house-blue-on.png';
    }));
    expect(lit, "ROUGH's lit artwork is missing or failed to decode").toBe(true);
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
