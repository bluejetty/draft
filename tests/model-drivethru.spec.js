// GRUFF'S DRIVE-THRU on MODEL.html — the foot's middle pair and the sign.
//
// Movie, 15 Sep: "the middle area i'd like to change it so there will be 2
// buttons, the DRIVE-THRU MENU, and the BONE... when it is pressed the drive
// thru menu should pop up from the bottom of the screen and cover both the
// DRIVETHRU MENU BUTTON, and the BONE BUTTON (there will be another BONE
// BUTTON on the Drivethru menu.) and when it pops up the dog on screen will
// take them through the menu of home types."
//
// WHAT THIS SUITE IS FOR, and it is not the picture. A menu that rises is
// easy to eyeball and easy to get subtly wrong in the two ways that cost
// something later:
//
//   - THE SIGN IS A WINDOW, NOT AN EDIT. Opening it to look at the board and
//     shutting it again must leave the drawing byte-identical. A popup that
//     marks a file dirty teaches the drafter to ignore the unsaved guard,
//     and then the guard is worth nothing on the day it matters.
//   - THE SECOND BONE IS THE SAME BONE. Two presses with one verb between
//     them; the moment the post's bone grows its own build path, the premade
//     designs get written twice and diverge. It fires the seam, or it is a
//     decoration.
//
// The board's cover is asserted in geometry rather than by eye, because
// "covers both buttons" is the requirement and a sign that stops an inch
// short reads as a bug in the bar, not in the sign.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const REPRO = JSON.parse(fs.readFileSync(
  path.join(__dirname, '..', 'proto', 'repro-garage-house.draft'), 'utf8'));

// MODEL.html, reached the way every other MODEL.html spec reaches it: through
// openModel for its init scripts -- the seeded wallet, the parked features,
// the coach already seen -- and then a navigation to the page under test.
async function openPage(page) {
  await h.openModel(page, { webgl: false });
  // A DRAWING IN THE STORE, because MODEL.html reads the shared file and an
  // empty store gives "no drawing saved" -- a page with no drawing has no
  // build bar to put on the board.
  await page.evaluate(async ({ bucket, saved }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(saved)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, saved: REPRO });
  await page.goto('/MODEL.html?mode=night');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
}

// The rectangles, in page pixels, of the two presses the board must cover.
const boxes = async page => ({
  open: await page.locator('#dt-open').boundingBox(),
  bone: await page.locator('#bone').boundingBox(),
  outline: await page.locator('#outline').boundingBox(),
  sign: await page.locator('#dt-frame').boundingBox(),
});

test('the foot bar: PROJECT and MODEL left, the pair in the middle, the sheets right',
  async ({ page }) => {
    await openPage(page);

    // THE THREE GROUPS IN ORDER, read off the bar itself. Asserted by group
    // rather than by one flat list because the arrangement IS the ruling --
    // the sheets went right so the middle could be two presses wide.
    expect(await page.locator('#page-row > *').evaluateAll(els => els.map(
      el => (el.textContent || '').trim().replace(/\s+/g, ' '))),
    'the foot\'s left end is the project, the page you are on, and the '
    + 'marketing plan that is a drawing of it')
      .toEqual(['PROJECT', 'MODEL', 'REAL ESTATE LAYOUT']);

    expect(await page.locator('#sheet-row > *').evaluateAll(els => els.map(
      el => (el.textContent || '').trim().replace(/\s+/g, ' '))),
    'the sheets belong at the far right, in reading order')
      .toEqual(['CONSTRUCTION LAYOUT', 'SPECIFICATIONS', 'ESTIMATES']);

    // The middle is the two presses and nothing else -- DELETE lives here too
    // but is hidden until something is selected, which is the shell's rule
    // and not this suite's business.
    expect(await page.locator('#dt-bar > *:not([hidden])').evaluateAll(els => els.map(
      el => (el.textContent || '').trim().replace(/\s+/g, ' '))),
    'the middle of the foot is the drive-thru, the bone and the outline')
      .toEqual(['DRIVE-THRU MENU', 'BONE', 'OUTLINE']);

    // AND THE PAGES THAT ARE NOT BUILT ARE STILL DOWN. Moving a chip between
    // groups must not have quietly lit it.
    await expect(page.locator('#page-row [data-page="real-estate"]')).toBeDisabled();
    await expect(page.locator('#sheet-row [data-page="estimates"]')).toBeDisabled();
  });

test('the sign rises from the foot and covers both presses', async ({ page }) => {
  await openPage(page);
  await expect(page.locator('#drivethru')).toHaveAttribute('data-shut', '');

  const down = await boxes(page);
  expect(down.sign.y, 'the sign is parked below the foot until it is called')
    .toBeGreaterThan(down.open.y);

  await h.openDriveThru(page);
  const up = await boxes(page);

  // COVERS BOTH, which is the requirement in Movie's own words. Read as
  // containment of each press's rectangle in the board's, so a sign that
  // rises but stops short of the bone fails here rather than in a squint.
  for (const [name, box] of [['DRIVE-THRU MENU', up.open], ['BONE', up.bone],
    ['OUTLINE', up.outline]]) {
    expect(box.y >= up.sign.y && box.y + box.height <= up.sign.y + up.sign.height
      && box.x >= up.sign.x && box.x + box.width <= up.sign.x + up.sign.width,
    `the board left ${name} showing underneath it`).toBe(true);
  }

  // And it goes back down, leaving the foot as it was.
  await page.locator('[data-drivethru-close]').click();
  await expect(page.locator('#drivethru')).toHaveAttribute('data-shut', '');
  await expect(page.locator('#dt-open')).toHaveAttribute('aria-expanded', 'false');
});

test('the board carries the office\'s house types and its own bone',
  async ({ page }) => {
    await openPage(page);
    await h.openDriveThru(page);

    // THE TYPES ARE build-menu.js's TYPES, not a list painted on a board.
    // The sign is the build bar with a face; if it ever holds its own copy
    // of the menu, the two pages start disagreeing about what the office
    // builds, which is the duplication the module was lifted out to end.
    const fromModule = await page.evaluate(() =>
      window.DraftBuildMenu.BUILD_MENU.map(f => f.label));
    expect(await page.locator('#dt-tiles [data-build-family]').allTextContents(),
      'the board\'s tiles are not the module\'s families')
      .toEqual(fromModule);

    // Every home type Movie put on the board is reachable: the families plus
    // the entries underneath them. One basic example per type is the content
    // question and it belongs to build-menu.js; that they are all ORDERABLE
    // from the window is this suite's.
    for (const family of fromModule) {
      await page.locator(`#dt-tiles [data-build-family]`)
        .filter({ hasText: new RegExp(`^${family}$`) }).click();
      await expect(page.locator('#dt-tiles [data-build-entry]').first()).toBeVisible();
    }

    await expect(page.locator('#dt-bone')).toBeVisible();
  });

test('the dog talks the drafter through it, and says what was ordered',
  async ({ page }) => {
    await openPage(page);
    await h.openDriveThru(page);

    // GRUFF SPEAKS BEFORE HE IS SPOKEN TO. An empty screen on a board that
    // exists to guide is the whole feature missing.
    await expect(page.locator('[data-drivethru-line]')).not.toBeEmpty();

    await page.locator('#dt-tiles [data-build-family="bungalow"]').click();
    // The sign names the family it has just opened, so the screen and the
    // tiles cannot be showing two different things.
    await expect(page.locator('[data-drivethru-line]')).toContainText('BUNGALOW');

    const entry = page.locator('#dt-tiles [data-build-entry]').first();
    const ordered = (await entry.textContent()).trim();
    await entry.click();
    await expect(page.locator('[data-drivethru-line]')).toContainText(ordered);
  });

test('opening the window and shutting it again is not an edit', async ({ page }) => {
  await openPage(page);

  // THE FILE BEFORE, and the guard's own opinion of it.
  // SAVE is also the status word on this page (`data-save-status`), so the
  // guard's opinion is readable without a helper: the word plus the dirty
  // mark it wears.
  const clean = () => page.evaluate(() => {
    const save = document.getElementById('save');
    return `${save.textContent.trim()}|${save.className}`;
  });
  const before = await clean();

  await h.openDriveThru(page);
  await page.locator('#dt-tiles [data-build-family="bungalow"]').click();
  await page.locator('[data-drivethru-close]').click();
  await expect(page.locator('#drivethru')).toHaveAttribute('data-shut', '');

  // LOOKING IS NOT EDITING. Raising the board, opening a family to read what
  // is under it and dropping the board again touches no geometry and no
  // stored field -- so the unsaved guard must still say exactly what it said
  // before the drafter pulled up to the window.
  expect(await clean(), 'opening the drive-thru dirtied the drawing')
    .toBe(before);
});

test('the post\'s bone orders off the menu; the foot\'s builds what was drawn',
  async ({ page }) => {
    await openPage(page);
    await h.openDriveThru(page);

    // TWO BONES, TWO VERBS. Movie, 15 Sep: "the bone on the drivethru menu
    // will auto build the house that is provided for their selection... the
    // bone on the screen will be for if they draw their own OUTLINE".
    //
    // This suite used to assert the opposite -- one seam, two presses -- and
    // it was wrong about the feature, not about the code. Wired together,
    // the premade designs would land under a drafter who had traced his own
    // walls and pressed the bone beneath them, wiping the thing he drew. The
    // separation is the whole safety of the arrangement, so it is checked in
    // both directions: each press fires its own seam and NOT the other's.
    const seen = await page.evaluate(async () => {
      const built = [];
      const ordered = [];
      window.ModelBuild.onBuild(p => built.push(p?.entry?.id ?? 'null'));
      window.ModelBuild.onOrder(p => ordered.push(p?.entry?.id ?? 'null'));
      document.querySelector('#dt-tiles [data-build-family="bungalow"]').click();
      await new Promise(r => setTimeout(r, 60));
      document.querySelector('#dt-tiles [data-build-entry]').click();
      await new Promise(r => setTimeout(r, 60));
      const chosen = window.ModelBuild.chosen()?.entry?.id ?? 'null';
      document.getElementById('dt-bone').click();
      document.getElementById('bone').click();
      return { built, ordered, chosen };
    });

    expect(seen.ordered, 'the sign\'s bone did not order the chosen design')
      .toEqual([seen.chosen]);
    expect(seen.built, 'the foot\'s bone did not fire the outline seam once')
      .toEqual([seen.chosen]);
  });

test('OUTLINE calls up the same board, and its bone means draw it yourself',
  async ({ page }) => {
    await openPage(page);

    // Movie, 15 Sep: "if they press it lets also have the same drivethru
    // menu come up, but when they press the bone at the end after that
    // round, they are guided through drawing" it. ONE BOARD, TWO EXITS --
    // and the only thing separating them is which button called it up, so
    // the round has to survive the trip to the seam or the premade design
    // lands on a drafter who asked to draw his own.
    await page.locator('#outline').click();
    await expect(page.locator('#drivethru'))
      .not.toHaveAttribute('data-shut', '', { timeout: 5000 });

    const seen = await page.evaluate(async () => {
      const ordered = [];
      window.ModelBuild.onOrder(p => ordered.push(p?.round ?? 'none'));
      document.querySelector('#dt-tiles [data-build-family="bungalow"]').click();
      await new Promise(r => setTimeout(r, 60));
      document.querySelector('#dt-tiles [data-build-entry]').click();
      await new Promise(r => setTimeout(r, 60));
      const note = document.querySelector('[data-drivethru-note]').textContent;
      document.getElementById('dt-bone').click();
      return { ordered, note };
    });

    expect(seen.ordered, 'the OUTLINE round did not reach the seam')
      .toEqual(['outline']);
    // AND GRUFF SAYS WHICH ROUND IT IS. Both rounds end on the same bone;
    // the screen is the drafter's only warning of what pressing it does.
    expect(seen.note.toLowerCase(),
      'the dog promised to build it on the round where the drafter draws it')
      .toContain('drawing it');
  });

test('every tile is on the shelf and says its own name, card or no card',
  async ({ page }) => {
    // THE WIDTH THE SPILL HAPPENED AT. The cards are sized in vw, so a
    // narrow window shrinks them out of trouble and the check would pass on
    // a board it never looked at.
    await page.setViewportSize({ width: 1440, height: 900 });
    await openPage(page);
    await h.openDriveThru(page);
    // The submenu that spilled: BUNGALOW opens five entries under three
    // families, which is the widest the shelf ever gets.
    await page.locator('#dt-tiles [data-build-family="bungalow"]').click();
    await expect(page.locator('#dt-tiles [data-build-entry]').first())
      .toBeVisible();

    // THE SHELF, not the whole board: the black strip is where the orders
    // are printed, and a tile on the post or over Gruff's face is as lost as
    // one off the frame.
    const shelf = await page.locator('#dt-tiles').boundingBox();
    const tiles = page.locator('#dt-tiles button');
    const count = await tiles.count();
    expect(count, 'the board went empty').toBeGreaterThan(5);

    for (let i = 0; i < count; i += 1) {
      const tile = tiles.nth(i);
      const label = (await tile.textContent() || '').trim();

      // A TILE WEARING ART STILL SAYS ITS NAME. Movie's cards carry their own
      // lettering, so the words are clipped out of sight -- but a button
      // whose only name is a picture is a button a screen reader cannot read
      // and a check cannot find.
      expect(label, `a tile ${i} with no name`).not.toBe('');

      // ON THE BOARD, not past it. The card was sized at 62px and the open
      // submenu hung below the frame, where the drafter could see an order
      // and not press it.
      const box = await tile.boundingBox();
      expect(box.y + box.height,
        `the ${label} tile hangs off the bottom of the shelf`)
        .toBeLessThanOrEqual(shelf.y + shelf.height + 1);
      expect(box.y, `the ${label} tile rides up off the shelf`)
        .toBeGreaterThanOrEqual(shelf.y - 1);
      expect(box.x, `the ${label} tile hangs off the side of the shelf`)
        .toBeGreaterThanOrEqual(shelf.x - 1);
    }
  });

test('the house button lights first, and the sign follows it up',
  async ({ page }) => {
    await openPage(page);
    const press = page.locator('#dt-open');
    const sign = page.locator('#drivethru');

    // MOVIE, 15 Sep: "change the button to light up for about 2 seconds
    // before the drivethru menu appears". The light is the acknowledgement
    // -- a press that does nothing visible for two seconds reads as a dead
    // button, and the drafter presses it again.
    await press.click();
    await expect(press).toHaveAttribute('data-lit', '');
    await expect(sign, 'the sign came up without the button lighting first')
      .toHaveAttribute('data-shut', '');

    // A SECOND PRESS MID-GLOW IS NOT A SECOND ORDER.
    await press.click();
    await expect(press).toHaveAttribute('data-lit', '');

    await expect(sign).not.toHaveAttribute('data-shut', '', { timeout: 5000 });
    // The light goes out once the board is up; a button still glowing under
    // an open sign is a button that looks like it is still working.
    await expect(press).not.toHaveAttribute('data-lit', '');
  });
