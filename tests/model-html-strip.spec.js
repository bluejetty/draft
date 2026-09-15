// THE INSTRUMENT STRIP — MODEL.dc.html:1963's bottom panel on the new page.
//
// Movie, 13 Sep: "we also still need the bottom bar which should look like
// lights for [an] instrument panel like on the Model.dc.html version. the
// length T-square, ruler and other stuff are down there we need. and the skin
// switcher can be there too", and then "the mode switcher could be there on
// PC version too if its not already placed".
//
// WHAT THIS SUITE IS ACTUALLY FOR. A strip is chrome, and chrome is the
// easiest thing in the app to test wrongly: `toBeVisible()` on ten chips
// passes on a bar where nothing works. So every instrument here is asserted
// through the DRAWING or through the CANVAS — the T-square by the geometry
// the page stored, the ruler by the geometry it did NOT store, the skin by
// the pixels — and the two controls that are honestly inert are asserted to
// SAY they are inert.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const MAIN_FL = 3;

const readout = page => page.locator('#readout');

// One wall on MAIN FL, symmetric about the origin so fit() centres the view
// there — the same transform trick model-html-draw-delete.spec.js uses, and
// for the same reason: the page publishes its scale in the readout, so a
// spec needs no test hook to know where a world point lands.
// THE BOARD IS A FACT OF THE DRAWING, so a test about a DRAFTING rule says so
// in the file rather than leaning on whatever the page defaults to. The default
// is TOY (Movie's stated default for the PC board), and TOY squares the wall,
// rounds it to the foot and asks before a typed length promotes -- so three
// checks in this file were asserting DRAFTING behaviour on a TOY board and
// reading the difference as a regression in the instruments.
//
// They are DRAFTING's rules and they still hold; naming the board is asserting
// the layer the rule is ABOUT. The TOY side of each is covered where it
// belongs, in model-toy-board.spec.js.
async function seed(page, { board } = {}) {
  await page.goto('/MODEL.dc.html');
  await page.waitForFunction(() => !!window.SharedFileStore, null, { timeout: 10000 });
  await page.evaluate(async ({ bucket, level, board }) => {
    const wall = {
      id: 'w-a', levelId: level, view: 'plan', wallType: 'stud_2x6',
      baseHeight: 0, topHeight: 8, refLine: 'left',
      start: { x: -8, y: 0, z: 0 }, end: { x: 8, y: 0, z: 0 },
    };
    const d = {
      format: 'draft-drawing', version: 1,
      levels: [
        { id: 8, name: 'SITE', elev: 0, visible: true },
        { id: 7, name: 'ROOF', elev: 18, visible: true },
        { id: 5, name: '2ND FL', elev: 9, visible: true },
        { id: level, name: 'MAIN FL', elev: 0, visible: true },
        { id: 1, name: 'FOUNDATION', elev: -10, visible: true },
      ],
      walls: [wall], lines: [], floors: [], roofs: [], shapes: [], outlines: [],
      dimensions: [], notes: [], underlays: [], fixtures: [], fenestrations: [],
      stairs: [], groups: [],
      nextDrawingItemId: 7, wallRefLine: 'left', wallBaseHeight: 0,
      wallTopHeight: 8, activeWallType: 'stud_2x6',
      ...(board ? { board } : {}),
    };
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(d)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, level: MAIN_FL, board: board || null });
}

async function openModel(page, search = '') {
  await page.goto(`/MODEL.html${search}`);
  await expect(readout(page)).toContainText('walls', { timeout: 6000 });
}

const scaleOf = async page => {
  const hit = (await readout(page).textContent()).match(/scale ([\d.]+) px\/ft/);
  expect(hit, 'the readout publishes the scale').toBeTruthy();
  return Number(hit[1]);
};

// World → client. Every helper below refuses a point that would land off the
// canvas or under the page's own chrome, because a tap that reaches nothing
// and a feature that does nothing are indistinguishable in the result.
async function clientOf(page, x, z) {
  const box = await page.locator('#plan').boundingBox();
  const scale = await scaleOf(page);
  const px = box.x + box.width / 2 + x * scale;
  const py = box.y + box.height / 2 + z * scale;
  const hit = await page.evaluate(({ cx, cy }) => {
    const el = document.elementFromPoint(cx, cy);
    return el ? (el.id ? `${el.tagName.toLowerCase()}#${el.id}` : el.tagName.toLowerCase()) : 'nothing';
  }, { cx: px, cy: py });
  expect(hit, `world (${x}, ${z}) is covered — the press reached ${hit}, not the canvas`)
    .toBe('canvas#plan');
  return { px, py };
}

const hoverAt = async (page, x, z) => {
  const { px, py } = await clientOf(page, x, z);
  await page.mouse.move(px, py);
  await page.waitForTimeout(40);
};

const tapAt = async (page, x, z) => {
  const { px, py } = await clientOf(page, x, z);
  // MOVE FIRST, ALWAYS. The instruments read the cursor, and Playwright's
  // click() can land a press without a preceding move — which is not how a
  // mouse works and would leave the live readouts empty on a page that is
  // perfectly correct under a real hand.
  await page.mouse.move(px, py);
  await page.mouse.click(px, py);
  await page.waitForTimeout(60);
};

const stored = page => page.evaluate(async bucket => {
  const file = await window.SharedFileStore.loadSharedFile(bucket);
  return JSON.parse(await file.text());
}, BUCKET);

// The walls the page holds right now, before any save — the draw gesture
// commits into memory and SAVE writes it, so a spec that read the store
// would be testing SAVE.
const wallCount = async page => {
  const hit = (await readout(page).textContent()).match(/walls (\d+)\/(\d+)/);
  return Number(hit[2]);
};

test.describe('MODEL.html instrument strip', () => {
  test('the strip carries the old page\'s instruments, and says which are not built',
    async ({ page }) => {
      await seed(page);
      await openModel(page);

      await expect(page.locator('[data-instrument-strip]')).toBeVisible();
      // PROJECT LEFT THE STRIP IN §7b. It is a place to go, not an
      // instrument, so it sits in the page row along the foot with the other
      // five destinations; the check follows it rather than being dropped.
      await expect(page.locator('#page-row [data-page="project"]')).toHaveText('PROJECT');
      // NO DESTINATION IS REACHABLE FROM TWO BARS, which is what this check
      // was really about. SETTINGS and STANDARDS are in the strip on purpose
      // now (Movie, 15 Sep) and the page row does not hold them, so the
      // claim is stated as the overlap rather than as a count: one page, one
      // way to it, wherever it lives.
      const twice = await page.evaluate(() => {
        const names = sel => [...document.querySelectorAll(sel)]
          .map(el => el.dataset.page);
        const foot = new Set(names('#house-strip [data-page]'));
        return names('#strip [data-page]').filter(p => foot.has(p));
      });
      expect(twice, 'a page reachable from both bars is two ways to one place')
        .toEqual([]);

      // THE FIVE THAT WORK. Asserted as a set, so an instrument quietly
      // demoted to dormant during a refactor fails here rather than being
      // discovered by a drafter.
      //
      // SCALE JOINED THEM. It is the foot light now — the architect's rule
      // was the one dormant chip whose whole job is measuring in feet, so the
      // icon already said what the switch does. Moved rather than dropped
      // from the list below: this check's value is that the two sets are
      // exhaustive, and an instrument that left one has to arrive in the
      // other or the count stops meaning anything.
      for (const sel of ['[data-mode-ruler]', '[data-mode-tsquare]',
        '[data-mode-protractor]', '[data-mode-scale]', '#frozen-length']) {
        await expect(page.locator(sel)).toBeVisible();
        await expect(page.locator(sel)).not.toHaveClass(/dormant/);
      }

      // THE FOUR THAT DO NOT, each marked dormant and each saying so in its
      // own title. This is the panel's own rule — the disabled 3D chair —
      // applied to the strip: a chip that looks live and does nothing is
      // worse than a gap.
      for (const sel of ['[data-mode-compass]', '[data-mode-triangle]',
        '[data-mode-brush]', '[data-mode-shield]']) {
        const chip = page.locator(sel);
        await expect(chip).toHaveClass(/dormant/);
        await expect(chip).toHaveAttribute('title', /not built/);
      }
    });

  test('the length and angle read the run in hand, and go blank when there is none',
    async ({ page }) => {
      await seed(page);
      await openModel(page);

      const len = page.locator('#strip-len');
      const ang = page.locator('#strip-ang');
      await expect(len, 'nothing in hand, nothing on the instruments').toHaveText('');

      await h.armWall(page);
      await tapAt(page, -4, -4);          // the run starts
      await hoverAt(page, 0, -4);         // 4 feet along +X

      await expect(len).toHaveText(/4'/);
      await expect(ang).toHaveText(/0\.0°/);
      await expect(page.locator('#strip-protractor-angle')).toHaveText(/0\.0°/);

      // ESCAPE PUTS THE RUN DOWN and the instruments must follow it. A length
      // left on the strip after the gesture ended is the one reading a
      // drafter would act on without checking.
      await page.keyboard.press('Escape');
      await expect(len).toHaveText('');
      await expect(ang).toHaveText('');
    });

  test('the T-SQUARE holds the wall square, and the page is not square without it',
    async ({ page }) => {
      // ON A DRAFTING BOARD, because "not square without it" is a DRAFTING
      // claim: TOY squares every wall whether the T-square is up or down, and
      // has no way to switch that off (model-toy-board.spec.js:357). Without
      // this line the control case below draws a squared wall and the check
      // reads it as the T-square leaking.
      await seed(page, { board: 'drafting' });
      await openModel(page);
      await h.armWall(page);

      // OFF SQUARE FIRST — the control case, and the one that makes the
      // assertion below mean something. Two taps that are deliberately not
      // aligned produce a wall that is not aligned.
      await tapAt(page, -4, -4);
      await tapAt(page, 1, -2);
      let walls = (await page.evaluate(() => null), await wallCount(page));
      expect(walls, 'the first wall committed').toBe(2);
      await page.locator('[data-model-save]').click();
      await page.waitForTimeout(200);
      let free = (await stored(page)).walls.find(w => w.id !== 'w-a');
      expect(free, 'the off-square wall reached the file').toBeTruthy();
      expect(Math.abs(free.end.z - free.start.z),
        'with the T-square up the page must draw exactly what was tapped')
        .toBeGreaterThan(0.5);

      await page.keyboard.press('Escape');

      // NOW WITH THE INSTRUMENT DOWN, the same shape of gesture.
      await page.locator('[data-mode-tsquare]').click();
      await expect(page.locator('[data-mode-tsquare]')).toHaveClass(/lit/);
      await tapAt(page, -4, -3);
      await tapAt(page, 1, -1);         // 5ft across, 2ft down: X is the long leg
      await page.locator('[data-model-save]').click();
      await page.waitForTimeout(200);

      const after = (await stored(page)).walls;
      const squared = after[after.length - 1];
      expect(squared.start.z, 'the T-square run is level')
        .toBeCloseTo(squared.end.z, 6);
      expect(Math.abs(squared.end.x - squared.start.x),
        'and it kept the length the hand gave it along that axis')
        .toBeGreaterThan(1);
    });

  test('the LENGTH box commits a typed wall, and is dead when there is nothing to measure',
    async ({ page }) => {
      // DRAFTING, for the same reason and a sharper one: §7 makes a typed
      // length on a TOY board ASK before it promotes, so on the default board
      // the typed wall does not commit until a confirm is answered. That
      // question is the subject of its own checks; this one is about the box.
      await seed(page, { board: 'drafting' });
      await openModel(page);

      const box = page.locator('#frozen-length');
      await expect(box, 'no run in hand: a typed length would have nowhere to go')
        .toBeDisabled();

      await h.armWall(page);
      await tapAt(page, -4, -4);
      await hoverAt(page, 2, -4);        // aiming along +X
      await expect(box).toBeEnabled();

      await box.click();
      await box.fill("12'");
      await box.press('Enter');
      await page.waitForTimeout(80);
      await page.locator('[data-model-save]').click();
      await page.waitForTimeout(200);

      const walls = (await stored(page)).walls;
      const typed = walls.find(w => w.id !== 'w-a');
      expect(typed, 'the typed wall reached the file').toBeTruthy();
      const length = Math.hypot(typed.end.x - typed.start.x, typed.end.z - typed.start.z);
      // TO THE SIXTEENTH, which is the drawing's own resolution. A typed
      // length that lands within a few inches of what was asked for is not a
      // typed length, it is a snap.
      expect(length, "12' typed must be 12' stored").toBeCloseTo(12, 3);
    });

  test('the RULER measures and writes nothing — the one instrument that must not draw',
    async ({ page }) => {
      await seed(page);
      await openModel(page);

      const before = await wallCount(page);
      await page.locator('[data-mode-ruler]').click();
      await expect(page.locator('[data-mode-ruler]')).toHaveClass(/lit/);

      await tapAt(page, -5, -2);
      await hoverAt(page, 1, -2);
      await expect(page.locator('#strip-len'), 'six feet, read off the sheet')
        .toHaveText(/6'/);

      await tapAt(page, 1, -2);
      expect(await wallCount(page),
        'a measure is not a wall — the ruler must add nothing to the drawing')
        .toBe(before);

      // AND IT DOES NOT STEAL THE DRAW GESTURE PERMANENTLY: put the ruler up
      // and the wall tool still works, which is what makes it an instrument
      // rather than a mode the drafter gets stuck in.
      await page.locator('[data-mode-ruler]').click();
      await expect(page.locator('[data-mode-ruler]')).not.toHaveClass(/lit/);
      await h.armWall(page);
      await tapAt(page, -4, 3);
      await tapAt(page, 2, 3);
      expect(await wallCount(page), 'the wall tool survived the ruler').toBe(before + 1);
    });

  test('the skin switcher repaints the canvas without a reload, and is remembered',
    async ({ page }) => {
      await seed(page);
      await openModel(page);
      await expect(page.locator('html')).toHaveAttribute('data-mode', 'night');

      // A MARKER THAT CANNOT SURVIVE A NAVIGATION. The switcher's whole claim
      // is that it changes the skin WITHOUT reloading — this page can be
      // holding an unsaved edit — and a reload-based switcher would pass every
      // colour assertion below while silently throwing that edit away.
      await page.evaluate(() => { window.__stripAlive = true; });

      await page.locator('[data-skin-mode="day"]').click();
      await page.waitForTimeout(150);

      expect(await page.evaluate(() => window.__stripAlive === true),
        'the page must not have reloaded to change skin').toBe(true);
      await expect(page.locator('html')).toHaveAttribute('data-mode', 'day');
      await expect(page.locator('[data-skin-mode="day"]')).toHaveAttribute('aria-pressed', 'true');

      // THE CANVAS, not the stylesheet. 92% of this app's colour is set from
      // JavaScript, so a switcher that only reached CSS would leave the
      // drawing painted in night for ever and pass a computed-style check.
      const groundShare = await page.evaluate(() => {
        const c = document.getElementById('plan');
        const { data } = c.getContext('2d').getImageData(0, 0, c.width, c.height);
        let day = 0, night = 0, total = 0;
        for (let i = 0; i < data.length; i += 4) {
          total += 1;
          if (data[i] === 242 && data[i + 1] === 242 && data[i + 2] === 243) day += 1;
          if (data[i] === 29 && data[i + 1] === 31 && data[i + 2] === 32) night += 1;
        }
        return { day: day / total, night: night / total };
      });
      expect(groundShare.day, 'the canvas is cleared in the day ground').toBeGreaterThan(0.15);
      expect(groundShare.night, "and not in the night skin's").toBeLessThan(0.02);

      // REMEMBERED. A switch that forgets by morning is a demo.
      await page.reload();
      await expect(readout(page)).toContainText('walls', { timeout: 6000 });
      await expect(page.locator('html')).toHaveAttribute('data-mode', 'day');

      // AND THE URL STILL WINS, because a pasted ?mode= is a deliberate
      // override for one visit and must not fight the stored choice.
      await openModel(page, '?mode=night');
      await expect(page.locator('html')).toHaveAttribute('data-mode', 'night');
    });

  test('the theme switcher moves the brand and leaves the mode alone', async ({ page }) => {
    await seed(page);
    await openModel(page);
    const accent = () => page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--accent').trim());

    const ruff = await accent();
    await page.locator('[data-theme="rough"]').click();
    await page.waitForTimeout(100);
    expect(await accent(), 'the two brands must not share an accent').not.toBe(ruff);
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'rough');
    await expect(page.locator('html'), 'the brand is not the mode\'s business')
      .toHaveAttribute('data-mode', 'night');
  });

  test('the board switch remembers the choice, and its title says what it enforces',
    async ({ page }) => {
      await seed(page);
      await openModel(page);

      // TOY by default, which is Movie's stated default for the PC board.
      await expect(page.locator('body')).toHaveAttribute('data-board', 'toy');
      // `body` carries the same attribute, which is the point of it -- the
      // constraints, when they exist, read the body.
      // Scoped to the mode corner, where §7b put the board switch.
      const toy = page.locator('#mode-corner [data-board="toy"]');
      await expect(toy).toHaveAttribute('aria-pressed', 'true');

      await page.locator('#mode-corner [data-board="drafting"]').click();
      await expect(page.locator('body')).toHaveAttribute('data-board', 'drafting');
      await page.reload();
      await expect(readout(page)).toContainText('walls', { timeout: 6000 });
      await expect(page.locator('body'), 'the board outlives the tab')
        .toHaveAttribute('data-board', 'drafting');

      // THE HONESTY CHECK, and the reason this test exists at all. It read
      //   await expect(toy).toHaveAttribute('title', /nothing is constrained/);
      // for exactly as long as that was true, under a note saying "the day
      // someone wires the constraints, this line is the one that tells them to
      // change the title". That day came: §1–§5 square the wall, round it to
      // the foot, and hold the shape rectilinear through a drag.
      //
      // THE CLAIM IS UNCHANGED — the title must describe what the board really
      // does — and only the truth it checks has moved. The regex names a
      // constraint a drafter can confirm by drawing one wall, so a title that
      // goes back to promising nothing is red, and so is one that keeps
      // promising squareness after someone unwires it.
      await expect(toy).toHaveAttribute('title', /square and whole-foot/);
      await expect(page.locator('#mode-corner [data-board="drafting"]'),
        'and the other switch says what it does instead, or "square" reads as '
        + 'a property of the strip rather than of TOY')
        .toHaveAttribute('title', /any angle and any length/);
    });
});
