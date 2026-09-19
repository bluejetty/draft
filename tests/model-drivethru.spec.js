// GRUFF'S DRIVE-THRU on MODEL.html — the foot's bone and the sign.
//
// Movie, 15 Sep put two buttons and later an OUTLINE press in the middle of
// the foot; Movie, 16 Sep took them back out: "remove the two house buttons
// and keep the BONE button just go to the drivethru". So the BONE is the one
// press under the board now — it calls the sign up, and the drafter who
// wants to trace his own outline uses the OUTLINE command instead of a
// second button.
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
// covering the press that called it is the requirement and a sign that stops
// an inch short reads as a bug in the bar, not in the sign.
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

// The rectangles, in page pixels, of the press the board must cover.
const boxes = async page => ({
  bone: await page.locator('#bone').boundingBox(),
  sign: await page.locator('#dt-frame').boundingBox(),
});

test('the foot bar: PROJECT and MODEL left, the bone in the middle, the sheets right',
  async ({ page }) => {
    await openPage(page);

    // THE THREE GROUPS IN ORDER, read off the bar itself. Asserted by group
    // rather than by one flat list because the arrangement IS the ruling --
    // the sheets went right so the middle could be two presses wide.
    expect(await page.locator('#page-row > *').evaluateAll(els => els.map(
      el => (el.textContent || '').trim().replace(/\s+/g, ' '))),
    'the foot\'s left end is the project, the page you are on, and the '
    + 'marketing plan that is a drawing of it')
      // AND RUFF/ROUGH WENT BACK UP (Movie, 17 Sep). It came down here on
      // 15 Sep and spent two days at the end of this group; the bottom bar is
      // pages and sheets again, with no switch on it at either end.
      .toEqual(['PROJECT', 'MODEL', 'REAL ESTATE LAYOUT']);

    expect(await page.locator('#sheet-row > *').evaluateAll(els => els.map(
      el => (el.textContent || '').trim().replace(/\s+/g, ' '))),
    'the sheets belong at the far right, in reading order')
      // NIGHT/DAY went up with it, so this group is the sheets alone.
      .toEqual(['CONSTRUCTION LAYOUT', 'SPECIFICATIONS', 'ESTIMATES']);

    // WHERE THEY WENT, asserted here rather than left implied. A pair that
    // vanished from the bottom bar and reached nowhere would pass both
    // assertions above, and the switch would simply be gone.
    //
    // THE ORDER IS THE RULING (Movie, 17 Sep): "put NIGHT DAY up beside
    // IMPERIAL METRIC ... and put the RUFF / ROUGH to the left of NIGHT DAY
    // before the last one which will be TOY DRAFTING". Read off the bar
    // left to right, the units included, because the units are the pair the
    // other three were told to match.
    expect(await page.locator('#units-corner, #mode-corner > .set')
      .evaluateAll(els => els.map(
        el => (el.textContent || '').trim().replace(/\s+/g, ' '))),
    'the four stacked pairs, in the order he gave them')
      .toEqual(['IMPERIAL METRIC', 'RUFF ROUGH', 'NIGHT DAY', 'TOY DRAFTING']);

    // The middle is the bone and nothing else (Movie, 16 Sep) -- DELETE,
    // COPY and PASTE live here too but are hidden until something is
    // selected, which is the shell's rule and not this suite's business.
    //
    // READ BY NAME, NOT BY EVERY CHARACTER ON IT. The press wears the bone
    // WALLET now (board #261, brought over 19 Sep), so its textContent is the
    // balance and then its name -- "5BONE" -- and a flat text read would fail
    // here for a number that is supposed to be there. The claim was never
    // about the characters: it is that the middle of the foot holds ONE
    // press. So each child answers with its spoken name where it has one.
    expect(await page.locator('#dt-bar > *:not([hidden])').evaluateAll(els => els.map(
      el => ((el.querySelector('.said') || el).textContent || '')
        .trim().replace(/\s+/g, ' '))),
    'the middle of the foot is the bone alone')
      .toEqual(['BONE']);

    // AND THE PAGES THAT ARE NOT BUILT ARE STILL DOWN. Moving a chip between
    // groups must not have quietly lit it.
    await expect(page.locator('#page-row [data-page="real-estate"]')).toBeDisabled();
    await expect(page.locator('#sheet-row [data-page="estimates"]')).toBeDisabled();
  });

// THE QUIET WAY OUT TO THE CONSTRUCTION DETAILS. Movie, 19 Sep: "on the
// bottom of the drivethru menu area (where display area is) we should put a
// button to the PROJECT area that says 'CLICK HERE TO GO OVER THE
// CONSTRUCTION DETAILS / SECTIONS FOR YOUR PROJECT'", then, before anything
// was built: "make it smaller text like don't draw attention to it, it will
// just be there for people who want to use it".
//
// QUIET IS THE REQUIREMENT, so quiet is what is measured -- smaller AND
// dimmer than the line it sits under, read off the computed style rather
// than trusted to a stylesheet nobody re-reads. A second call to action
// beside the bone would compete with the one thing this board is for.
test('the drive-thru offers the construction details without competing with the bone',
  async ({ page }) => {
    await openPage(page);
    await h.openDriveThru(page);

    const link = page.locator('#dt-project');
    await expect(link).toBeVisible();
    await expect(link).toHaveText(/CONSTRUCTION DETAILS/);
    // A PLACE YOU GO IS A LINK, the rule the page row at the foot already
    // teaches. A button that navigated would be a third control on this page
    // pretending to be a press when it is a door.
    await expect(link).toHaveAttribute('href', './PROJECT.html');

    const read = sel => page.locator(sel).evaluate(el => {
      const css = getComputedStyle(el);
      return { size: parseFloat(css.fontSize), opacity: parseFloat(css.opacity),
        events: css.pointerEvents };
    });
    const note = await read('#dt-note');
    const out = await read('#dt-project');
    expect(out.size, `the way out is ${out.size}px against the note's `
      + `${note.size}px -- it was asked to be smaller`).toBeLessThan(note.size);
    expect(out.opacity, 'and dimmer, so it does not read as the next step')
      .toBeLessThan(note.opacity);

    // THE SCREEN IS pointer-events:none so the board behind it stays a
    // picture. This line has to take its press back, and it is the only
    // thing in there that does.
    expect(out.events).toBe('auto');
    expect((await read('#dt-screen')).events).toBe('none');
  });

test('the sign rises from the foot and covers the bone', async ({ page }) => {
  await openPage(page);
  await expect(page.locator('#drivethru')).toHaveAttribute('data-shut', '');

  const down = await boxes(page);
  expect(down.sign.y, 'the sign is parked below the foot until it is called')
    .toBeGreaterThan(down.bone.y);

  await h.openDriveThru(page);
  const up = await boxes(page);

  // COVERS THE PRESS that called it, which was the requirement when the
  // middle held three presses and stays the requirement at one. Read as
  // containment of the bone's rectangle in the board's, so a sign that
  // rises but stops short of the bone fails here rather than in a squint.
  expect(up.bone.y >= up.sign.y
    && up.bone.y + up.bone.height <= up.sign.y + up.sign.height
    && up.bone.x >= up.sign.x
    && up.bone.x + up.bone.width <= up.sign.x + up.sign.width,
  'the board left BONE showing underneath it').toBe(true);

  // And it goes back down, leaving the foot as it was.
  await page.locator('[data-drivethru-close]').click();
  await expect(page.locator('#drivethru')).toHaveAttribute('data-shut', '');
  await expect(page.locator('#bone')).toHaveAttribute('aria-expanded', 'false');
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
    const tile = await h.undesignedTile(page);
    test.skip(!tile, 'every tile on the board now has a design');
    const seen = await page.evaluate(async tile => {
      const built = [];
      const ordered = [];
      window.ModelBuild.onBuild(p => built.push(p?.entry?.id ?? 'null'));
      window.ModelBuild.onOrder(p => ordered.push(p?.entry?.id ?? 'null'));
      document.querySelector(`#dt-tiles [data-build-family="${tile.family}"]`).click();
      await new Promise(r => setTimeout(r, 60));
      // AN UNDESIGNED TILE, DELIBERATELY, and asked for rather than named:
      // this test is about the PLUMBING -- each press firing its own seam and
      // not the other's -- and a tile WITH a design makes the board refuse the
      // order on this fixture, which already has houses. A refusal is the
      // right answer to that press and the wrong thing to measure here.
      //
      // It said `twoStorey` until 2 STOREY got a design, and `bungalow`
      // before that. The name was never the point.
      document.querySelector(`#dt-tiles [data-build-entry="${tile.entry}"]`).click();
      await new Promise(r => setTimeout(r, 60));
      const chosen = window.ModelBuild.chosen()?.entry?.id ?? 'null';
      document.getElementById('dt-bone').click();
      const afterPost = { built: built.length, ordered: ordered.length };
      // The foot's bone is under the board and disabled while the sign is
      // up; its verb is for a drafter standing at the drawing, so the board
      // is dropped before it is pressed.
      document.getElementById('dt-close').click();
      document.getElementById('bone').click();
      const afterFoot = { built: built.length, ordered: ordered.length };
      // AND THEN THE CARD'S OWN ANSWER, which is where the foot's verb went.
      document.querySelector('[data-build-choice-build]').click();
      await new Promise(r => setTimeout(r, 60));
      return { built, ordered, chosen, afterPost, afterFoot };
    }, tile);

    expect(seen.ordered[0], 'the sign\'s bone did not order the chosen design')
      .toBe(seen.chosen);
    expect(seen.afterPost.built,
      'the sign\'s bone reached the outline seam, which is the other bone\'s')
      .toBe(0);

    // THE FOOT'S BONE FIRES NEITHER SEAM NOW. Movie, 19 Sep: "on 1st press go
    // to drivethru questions and on 2nd always offer choice between drivetrhu
    // or house build". With a type already picked, that press ASKS -- so the
    // separation this test exists for is unchanged and the foot's verb simply
    // moved one press later, onto the card.
    expect(seen.afterFoot, 'the foot\'s press built something instead of asking')
      .toEqual(seen.afterPost);

    // AND THE CARD'S BUILD IS THE FOOT'S VERB: the drafter's own outline
    // first. Nothing was traced on this fixture, so it falls through to the
    // order -- which is the one place the two seams meet, and it meets them
    // in the safe direction. The hazard the separation guards against is a
    // premade design landing UNDER traced walls; here the traced walls win
    // and the design is the fallback.
    expect(seen.built, 'the card\'s BUILD did not reach the outline seam')
      .toEqual([seen.chosen]);
  });

// THE OUTLINE BUTTON RETIRED (Movie, 16 Sep): "i will add the OUTLINE part
// later in a different way (or they can just press the OUTLINE command
// normally)". The outline ROUND still exists in the page's `round` state —
// what left was its button, so the suite that pressed it left with it.

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

test('the board is a picture with live cards on it, and nothing else takes a press',
  async ({ page }) => {
    // AN OVERLAY THAT SWALLOWS PRESSES HAS COST THIS PROJECT TWICE, and
    // gruff-drivethru.spec.js opens on that sentence for the other board. This
    // one earned the same check the hard way: the shelf was declared
    // `#dt-tiles > * { pointer-events:auto }`, and `> *` is #build-bar -- a
    // flex COLUMN, not a control, spanning the shelf corner to corner. So the
    // gaps between cards, and the strip of shelf either side of them, took
    // presses meant for the sheet underneath and gave the drafter nothing.
    //
    // THE CARDS THEMSELVES ARE A DIFFERENT QUESTION and are asked about at
    // the end: a card is a control, and a press on one is the card's. What is
    // wrong above is the GROUND they stand on answering for them.
    await page.setViewportSize({ width: 1440, height: 900 });
    await openPage(page);
    await h.openDriveThru(page);
    await page.locator('#dt-tiles [data-build-family="bungalow"]').click();
    await expect(page.locator('#dt-tiles [data-build-entry]').first())
      .toBeVisible();

    // WHAT THE BROWSER SAYS IS ON TOP, which is the crispest statement of
    // "this zone is decorative" there is -- and it reads the same rule the
    // press would.
    const at = (x, y) => page.evaluate(({ cx, cy }) => {
      const el = document.elementFromPoint(cx, cy);
      if (!el) return 'none';
      if (el.closest('#dt-tiles button')) return 'card';
      if (el.closest('#dt-close')) return 'close';
      if (el.closest('#drivethru')) return `board:${el.id || el.tagName}`;
      if (el.id === 'plan') return 'sheet';
      return `other:${el.id || el.tagName}`;
    }, { cx: x, cy: y });

    const board = await page.locator('#dt-frame').boundingBox();
    const shelf = await page.locator('#dt-tiles').boundingBox();
    const bar = await page.locator('#build-bar').boundingBox();

    // THE ART ITSELF: the frame down the side of the screen, and the band
    // between the screen and the shelf. Both are paint, and a press on paint
    // belongs to the sheet. The very TOP of the board is not asked about --
    // the instrument strip is fixed over it, and that one is real chrome.
    expect(await at(board.x + 6, board.y + board.height * 0.25),
      'the board frame took a press').toBe('sheet');
    expect(await at(board.x + board.width / 2, shelf.y - 8),
      'the band above the shelf took a press').toBe('sheet');

    // THE SHELF EITHER SIDE OF THE CARD ROW -- which is the exact ground the
    // old rule lost. #build-bar is the shelf's full width by design (it is
    // what centres the rows on it), so this point is inside the container and
    // outside every card: under the old rule it was the container's, and the
    // sheet never heard it.
    const card = await page.locator('#dt-tiles button').first().boundingBox();
    expect(card.x, 'the cards reach the edge of the bar, so this proves nothing')
      .toBeGreaterThan(bar.x + 8);
    expect(await at(bar.x + 3, card.y + card.height / 2),
      'the shelf beside the cards took a press').toBe('sheet');
    expect(shelf.width, 'the bar stopped spanning the shelf')
      .toBeGreaterThanOrEqual(bar.width - 1);

    // AND THE CARDS DO TAKE THEIRS. Everything above is only worth having if
    // the controls still work, which is the half a careless fix for this
    // breaks: pointer-events:none on the container and nothing put back.
    expect(await at(card.x + card.width / 2, card.y + card.height / 2),
      'a card went decorative with the shelf').toBe('card');
    const close = await page.locator('#dt-close').boundingBox();
    expect(await at(close.x + close.width / 2, close.y + close.height / 2),
      'the close cross went decorative').toBe('close');
  });

test('the bone lights first, and the sign follows it up',
  async ({ page }) => {
    await openPage(page);
    const press = page.locator('#bone');
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
    // AND IT STAYS LIT NOW, which is the reverse of what this line used to
    // say. It read "the light goes out once the board is up; a button still
    // glowing under an open sign is a button that looks like it is still
    // working" -- and on 17 Sep Movie asked for exactly that: "when the
    // blueprint is showing the blue house button should be light and when it
    // goes down unlit".
    //
    // THE OLD WORRY IS ANSWERED RATHER THAN OVERRULED. It is still working:
    // ROUGH's sheet rides above the bar and leaves this press standing, and
    // it is the press that builds what you picked off the board. RUFF's sign
    // covers it, so there the light is under the board and nobody reads it
    // either way.
    await expect(press).toHaveAttribute('data-lit', '');

    // And out when the board goes down, which is the edge that carries the
    // meaning now.
    await page.locator('[data-drivethru-close]').click();
    await expect(sign).toHaveAttribute('data-shut', '');
    await expect(press).not.toHaveAttribute('data-lit', '');
  });

// ── ARRIVING THROUGH THE FRONT DOOR ──────────────────────────────────────
// Movie, 15 Sep: "when they enter into the model area from the front entry
// screen the drivethru should pop up after about 2 seconds."
//
// THE FLAG IS THE POINT OF THESE TWO. A board that rises on arrival and a
// board that rises on every load look identical the first time and differ
// every time after, on a drafter who is mid-drawing -- which is the version
// that costs a press. So both halves are asserted: it rises from the entry
// screen, and it stays down on a plain load and on the reload after.
test('coming in from the front screen, the board rises by itself',
  async ({ page }) => {
    await h.openModel(page, { webgl: false });
    await page.evaluate(async ({ bucket, saved }) => {
      await window.SharedFileStore.saveSharedFile(
        new File([JSON.stringify(saved)], 'drawing.json', { type: 'application/json' }), bucket);
    }, { bucket: BUCKET, saved: REPRO });

    await page.goto('/MODEL.html?from=entry');
    await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });

    // Same two seconds as the press: the bone glows first, then the board.
    await expect(page.locator('#bone')).toHaveAttribute('data-lit', '');
    await expect(page.locator('#drivethru'))
      .not.toHaveAttribute('data-shut', '', { timeout: 5000 });

    // THE FLAG IS SPENT AS IT IS READ, so the reload lands in the drawing.
    expect(new URL(page.url()).searchParams.get('from'),
      'the arrival flag stayed in the address and will fire again on reload')
      .toBe(null);
    await page.reload();
    await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
    await page.waitForTimeout(3000);
    await expect(page.locator('#drivethru'),
      'the board rose again on a reload, over a drafter already at work')
      .toHaveAttribute('data-shut', '');
  });

test('a hand on the page inside the two seconds calls the board off',
  async ({ page }) => {
    await h.openModel(page, { webgl: false });
    await page.evaluate(async ({ bucket, saved }) => {
      await window.SharedFileStore.saveSharedFile(
        new File([JSON.stringify(saved)], 'drawing.json', { type: 'application/json' }), bucket);
    }, { bucket: BUCKET, saved: REPRO });

    await page.goto('/MODEL.html?from=entry');
    await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
    await expect(page.locator('#bone')).toHaveAttribute('data-lit', '');

    // Someone who starts drawing inside the glow has said what they came
    // for; the board rising over them would take the press they were making.
    await page.mouse.click(400, 300);
    await page.waitForTimeout(3000);
    await expect(page.locator('#drivethru'),
      'the board came up over a drafter who had already started')
      .toHaveAttribute('data-shut', '');
    await expect(page.locator('#bone')).not.toHaveAttribute('data-lit', '');
  });

// ── THE BONE WITH NOTHING BEHIND IT ──────────────────────────────────────
// Movie, 15 Sep: "what happens if they are in model area and they press the
// bone if no outline?" then "take them to the full house flow (not the
// outline flow) if there isn't a house and detached garage already... it
// will do nothing once both house and garage both made."
//
// It used to be nothing at all -- the seam fired with a null choice and the
// screen said not one word, which reads as a dead bone.
test('the bone with nothing chosen opens the house round, not the outline one',
  async ({ page }) => {
    await openPage(page);

    const fired = await page.evaluate(() => {
      const seen = [];
      window.ModelBuild.onBuild(p => seen.push(p));
      document.getElementById('bone').click();
      return seen.length;
    });
    // THE EMPTY PRESS REACHES NO SEAM AT ALL NOW, and that is the ruling
    // rather than a regression. Movie, 19 Sep: "on 1st press go to drivethru
    // questions". It used to call the build seam first and open the board
    // only when that served nothing; a press that cannot build should not be
    // asking the geometry side whether it can. What the press DOES is
    // asserted below -- the board, and the reason.
    expect(fired, 'the first press asked the build seam instead of opening the board')
      .toBe(0);

    await expect(page.locator('#drivethru'))
      .not.toHaveAttribute('data-shut', '', { timeout: 5000 });
    await expect(page.locator('[data-drivethru-line]')).toContainText('NOTHING TO BUILD');

    // THE HOUSE ROUND, NEVER THE OUTLINE ROUND. A drafter who pressed the
    // bone asked for a house, not for a drawing lesson -- and the round is
    // invisible until the bone on the post is pressed, so it is read off
    // the seam rather than off the board.
    const tile2 = await h.undesignedTile(page);
    test.skip(!tile2, 'every tile on the board now has a design');
    const round = await page.evaluate(async tile => {
      const seen = [];
      window.ModelBuild.onOrder(p => seen.push(p?.round ?? 'none'));
      document.querySelector(`#dt-tiles [data-build-family="${tile.family}"]`).click();
      await new Promise(r => setTimeout(r, 60));
      // An undesigned tile again, for the same reason as the seam test above:
      // the ROUND is what this measures, and a designed tile is refused on
      // this fixture before the order is ever fired.
      document.querySelector(`#dt-tiles [data-build-entry="${tile.entry}"]`).click();
      await new Promise(r => setTimeout(r, 60));
      document.getElementById('dt-bone').click();
      return seen;
    }, tile2);
    expect(round, 'the bone sent the drafter down the guided trace he did not ask for')
      .toEqual(['menu']);

    // AND THE REFUSAL IS SPENT, not stuck on the board behind the choice
    // that answers it.
    await expect(page.locator('[data-drivethru-line]')).not.toContainText('NOTHING TO BUILD');
  });

test('with a house and a detached garage already standing, the bone does nothing',
  async ({ page }) => {
    // ONE HOUSE AND ONE DETACHED GARAGE IS THE CAP (Movie). With both up
    // there is nothing the board could offer, and a board that rises with
    // every tile spent wastes the press it just took.
    await h.openModel(page, { webgl: false });
    const full = JSON.parse(JSON.stringify(REPRO));
    // The fixture's garage is ATTACHED, which is part of the house and does
    // not spend the detached slot -- so the drawing is completed here by
    // detaching the garage master, the way the shelf records it.
    full.boneyardOutlines.find(m => m.garage).detached = true;
    await page.evaluate(async ({ bucket, saved }) => {
      await window.SharedFileStore.saveSharedFile(
        new File([JSON.stringify(saved)], 'drawing.json', { type: 'application/json' }), bucket);
    }, { bucket: BUCKET, saved: full });
    await page.goto('/MODEL.html?mode=night');
    await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });

    await page.locator('#bone').click();
    await page.waitForTimeout(3000);
    await expect(page.locator('#drivethru'),
      'the board rose on a project that has nothing left to build')
      .toHaveAttribute('data-shut', '');
    await expect(page.locator('#bone')).not.toHaveAttribute('data-lit', '');
  });

// ── HOW BIG IS THE GARAGE ────────────────────────────────────────────────
// Movie, 15 Sep: "we could make a detached garage and even allow them to
// enter the size give them choices 16x24 24x26 25x25 (or 4th option allow
// them to enter ___FT X ___FT)".
//
// THE SIZE ROW IS ON THE SIGN, NOT A SECOND SUBMENU. The board is "only 1
// submenu each" (Movie, 6 Sep), and the fourth option is two fields, which
// a tile cannot carry.
const openGarage = async page => {
  await h.openDriveThru(page);
  await page.locator('#dt-tiles [data-build-family="detachedGarage"]').click();
  await page.locator('#dt-tiles [data-build-entry="detached-thickened"]').click();
};

test('the detached garage is asked how big, and the house never is',
  async ({ page }) => {
    await openPage(page);
    await openGarage(page);

    await expect(page.locator('#build-sizes')).toBeVisible();
    await expect(page.locator('#size-stock button'))
      .toHaveText(["16' x 24'", "24' x 26'", "25' x 25'", 'OTHER']);
    // AND GRUFF ASKS RATHER THAN PROMISING. Saying "press the bone and
    // I'll build it" with the size still open promises what the bone is
    // about to refuse.
    await expect(page.locator('[data-drivethru-line]')).toContainText('HOW BIG');

    // A HOUSE'S SIZE ARRIVES WITH ITS PREMADE DESIGN, so the row goes away
    // again -- a bungalow asked for its dimensions would be the drive-thru
    // asking a question the catalogue already answered.
    await page.locator('#dt-tiles [data-build-family="bungalow"]').click();
    await page.locator('#dt-tiles [data-build-entry="bungalow"]').click();
    await expect(page.locator('#build-sizes')).toBeHidden();
  });

test('a stock size rides the order to the seam', async ({ page }) => {
  await openPage(page);
  await openGarage(page);
  await page.locator('#size-stock [data-build-size="24x26"]').click();
  await expect(page.locator('[data-drivethru-line]')).toContainText("24' x 26'");

  const ordered = await page.evaluate(() => {
    const seen = [];
    window.ModelBuild.onOrder(order => seen.push(order.size));
    document.getElementById('dt-bone').click();
    return seen;
  });
  expect(ordered.length, 'the order never reached the seam').toBe(1);
  expect({ w: ordered[0]?.widthFt, d: ordered[0]?.depthFt },
    'the size the drafter pressed is not the size that was ordered')
    .toEqual({ w: 24, d: 26 });
});

test('the fourth option is two fields, and they are checked before the bone',
  async ({ page }) => {
    await openPage(page);
    await openGarage(page);
    await page.locator('#size-stock [data-build-size="custom"]').click();
    await expect(page.locator('#size-custom')).toBeVisible();

    // A GARAGE WITH NO SIZE IS NOT AN ORDER. The size is the whole design
    // of a box, so the bone refuses out loud rather than firing a seam
    // with nothing in it -- and this is the half that would rot silently,
    // because an empty field reads as 0 to anything that only asks "is it
    // a number".
    let fired = await page.evaluate(() => {
      const seen = [];
      window.ModelBuild.onOrder(order => seen.push(order));
      document.getElementById('dt-bone').click();
      return seen.length;
    });
    expect(fired, 'a garage with no size was ordered anyway').toBe(0);
    await expect(page.locator('[data-drivethru-line]')).toContainText('HOW BIG');

    // AND A SLIPPED FINGER IS NOT A BUILDING either: 4ft parks nothing.
    await page.locator('#size-w').fill('4');
    await page.locator('#size-d').fill('900');
    fired = await page.evaluate(() => {
      const seen = [];
      window.ModelBuild.onOrder(order => seen.push(order));
      document.getElementById('dt-bone').click();
      return seen.length;
    });
    expect(fired, 'a 4ft by 900ft garage was ordered').toBe(0);

    await page.locator('#size-w').fill('18');
    await page.locator('#size-d').fill('22');
    await expect(page.locator('[data-drivethru-line]')).toContainText("18' x 22'");
    const ordered = await page.evaluate(() => {
      const seen = [];
      window.ModelBuild.onOrder(order => seen.push(order.size));
      document.getElementById('dt-bone').click();
      return seen;
    });
    expect({ w: ordered[0]?.widthFt, d: ordered[0]?.depthFt, own: ordered[0]?.custom },
      'the typed pair did not reach the seam as a size')
      .toEqual({ w: 18, d: 22, own: true });
  });

test('a size does not follow the drafter onto the next thing he picks',
  async ({ page }) => {
    await openPage(page);
    await openGarage(page);
    await page.locator('#size-stock [data-build-size="16x24"]').click();
    await expect(page.locator('[data-drivethru-line]')).toContainText("16' x 24'");

    // PRESSING A DIFFERENT FOUNDATION IS A NEW QUESTION. Carrying the last
    // answer across would build a 16x24 for a drafter who never saw the
    // size asked on the tile he actually pressed.
    await page.locator('#dt-tiles [data-build-family="detachedGarage"]').click();
    await page.locator('#dt-tiles [data-build-entry="detached-frostwall"]').click();
    await expect(page.locator('[data-drivethru-line]')).toContainText('HOW BIG');
    await expect(page.locator('#size-stock [data-build-size="16x24"]'))
      .not.toHaveClass(/chosen/);
  });
