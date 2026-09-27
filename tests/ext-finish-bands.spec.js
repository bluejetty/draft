// ADJUSTING A BAND that is already laid, on EXT. FINISH.
//
// Movie, 27 Sep, having seen the page: *"for the BANDS (not full wall) can we
// allow them to start at the top or bottom and allow the user move the bottom
// or top up by 1' and also on the sides by 1ft"*, then *"for materials that
// reach the edge of the wall lets add a choice to 'ADD CORNER WRAP' and make
// it default 2ft but they can change it (1ft, 4ft etc)"*, *"if there is a
// gable area allow the full triangle to be filled and then they can adjust how
// far up or down the finish is"*, and *"lets add a choice button on the menu
// that allows them to TURN OFF the ledge"*.
//
// EVERY ONE OF THESE COULD ALREADY BE STORED AND DRAWN before this rail
// existed -- `anchor`, `toTop`, `startFt`, `endFt`, `wrapFt` and
// `noSillLedge` have been in the record and read by the painter since the day
// they were asked for. So what is worth testing is not that the record holds
// them; roof-types and wall-finish already prove that offline. It is that the
// CONTROL reaches the record:
//
//   THE NUDGE MOVES ONE FOOT        and the drawing keeps it after a reload
//   THE DEFAULT IS STORED AS NOTHING so an untouched band carries no key
//   A NUDGE NEVER DELETES ITS BAND   the refusal is said, not silent
//   THE LEDGE SWITCH IS WHERE LEDGES ARE  and absent where they are not
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const REPRO = JSON.parse(fs.readFileSync(
  path.join(__dirname, '..', 'proto', 'repro-garage-house.draft'), 'utf8'));

// THE WALL IS PICKED BY CLICKING IT, the way a drafter picks one -- there is
// no list of walls, because a wall face is a thing you can see and aim at.
// 0.5/0.6 of the canvas lands on a 16 ft wall of the front elevation.
async function openWall(page) {
  await h.suppressEntryCoach(page);
  await page.goto('/EXTFINISH.html');
  await page.waitForFunction(() => !!window.SharedFileStore, null, { timeout: 10000 });
  await page.evaluate(async ({ bucket, saved }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(saved)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, saved: REPRO });
  await page.goto('/EXTFINISH.html');
  await page.waitForSelector('#elev-list [data-elev]', { timeout: 10000 });
  const box = await page.locator('#elev').boundingBox();
  await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.6);
  await expect(page.locator('#wall-props')).toBeVisible();
}

// Lay one band and open its controls. The material is an argument because the
// ledge switch is gated on the table, so two of the checks below need rows on
// either side of that gate.
async function layBand(page, finishId) {
  await page.locator('#band-finish').selectOption(finishId);
  await page.locator('#band-add').click();
  await expect(page.locator('#band-list .band')).toHaveCount(1);
  await page.locator('#band-list .band .what').click();
  await expect(page.locator('#band-edit')).toBeVisible();
}

// WHAT THE DRAWING HOLDS, which is the only thing that outlives the page.
// Read through the store, not off the page's own state -- the page's state is
// what looks right in the failure this file is about.
const storedBands = page => page.evaluate(async bucket => {
  const file = await window.SharedFileStore.loadSharedFile(bucket);
  const saved = JSON.parse(await file.text());
  const wall = (saved.walls || []).find(w => Array.isArray(w.finishBands) && w.finishBands.length);
  return wall ? wall.finishBands : [];
}, BUCKET);

const settle = (page, want) => page.waitForFunction(async ({ bucket, want: w }) => {
  const file = await window.SharedFileStore.loadSharedFile(bucket);
  const saved = JSON.parse(await file.text());
  const wall = (saved.walls || []).find(x => Array.isArray(x.finishBands) && x.finishBands.length);
  return !!wall && JSON.stringify(wall.finishBands[0]).includes(w);
}, { bucket: BUCKET, want }, { timeout: 5000 });

test('a band opens its controls, and a nudge moves one foot into the drawing',
  async ({ page }) => {
    await openWall(page);
    await layBand(page, 'brick');

    // THE BAND AS LAID: 0 to 3, from the sill, running corner to corner.
    // Asserted first so every claim below is a CHANGE and not a coincidence.
    let bands = await storedBands(page);
    expect(bands).toHaveLength(1);
    expect(bands[0].lowFt).toBe(0);
    expect(bands[0].highFt).toBe(3);
    // AN UNTOUCHED BAND CARRIES NO KEY ABOUT ANY OF THIS -- the record's
    // standing rule, and the reason opening an old drawing is not a migration.
    expect(Object.keys(bands[0]).sort())
      .toEqual(['finishId', 'highFt', 'lowFt']);

    // ONE FOOT, which is his step: "make it 1ft changes default and then later
    // when he get the 'L' 'R' commands and the lengthbox we can allow them to
    // use specific length other than 1ft".
    await page.locator('[data-nudge="high"][data-by="1"]').click();
    await settle(page, '"highFt":4');
    bands = await storedBands(page);
    expect(bands[0].highFt).toBe(4);

    // AND THE BOTTOM GOES BELOW ITS LINE, which is the case he asked for by
    // name: "allow them to move either the upper 'BOTTOM line' to below the
    // bottom of the SILL". A negative is how a band crosses its own anchor.
    await page.locator('[data-nudge="low"][data-by="-1"]').click();
    await settle(page, '"lowFt":-1');
    bands = await storedBands(page);
    expect(bands[0].lowFt).toBe(-1);

    // AND IT IS STILL THERE AFTER A RELOAD, which separates "the rail works"
    // from "the rail appears to work".
    await page.reload();
    await page.waitForSelector('#elev-list [data-elev]');
    bands = await storedBands(page);
    expect(bands[0]).toMatchObject({ lowFt: -1, highFt: 4 });
  });

test('a nudge never deletes the band it is adjusting',
  async ({ page }) => {
    await openWall(page);
    await layBand(page, 'brick');

    // THREE PRESSES BRINGS THE TOP TO THE BOTTOM. The normaliser drops a band
    // whose top is at or below its bottom -- correctly, since such a band
    // claims no wall -- so without a refusal in the rail a drafter pressing
    // MINUS once too often watches his band vanish with nothing said.
    const down = page.locator('[data-nudge="high"][data-by="-1"]');
    await down.click();
    await settle(page, '"highFt":2');
    await down.click();
    await settle(page, '"highFt":1');
    await down.click();

    await expect(page.locator('#status'))
      .toContainText('top at or below the bottom');
    await expect(page.locator('#band-list .band'), 'the band is still there')
      .toHaveCount(1);
    const bands = await storedBands(page);
    expect(bands).toHaveLength(1);
    expect(bands[0].highFt, 'and it is still one foot high').toBe(1);
  });

test('the anchor, the gable fill and the corner wrap all reach the drawing',
  async ({ page }) => {
    await openWall(page);
    await layBand(page, 'brick');

    // THE ANCHOR. Sill is the default and is stored as nothing; the plate is
    // a departure and is written down.
    await expect(page.locator('#band-anchor')).toHaveValue('sill');
    await page.locator('#band-anchor').selectOption('plate');
    await settle(page, '"anchor":"plate"');
    expect((await storedBands(page))[0].anchor).toBe('plate');
    await page.locator('#band-anchor').selectOption('sill');
    await page.waitForFunction(async bucket => {
      const file = await window.SharedFileStore.loadSharedFile(bucket);
      const saved = JSON.parse(await file.text());
      const wall = (saved.walls || []).find(w => Array.isArray(w.finishBands) && w.finishBands.length);
      return wall && !('anchor' in wall.finishBands[0]);
    }, BUCKET, { timeout: 5000 });
    expect((await storedBands(page))[0].anchor).toBeUndefined();

    // THE GABLE. "if there is a gable area allow the full triangle to be
    // filled and then they can adjust how far up or down the finish is" --
    // so the top stops being a number and becomes the head, and the control
    // for a number that no longer exists goes away with it.
    await page.locator('#band-totop').check();
    await settle(page, '"toTop":true');
    let bands = await storedBands(page);
    expect(bands[0].toTop).toBe(true);
    expect(bands[0].highFt, 'a band filled to the top has no top of its own')
      .toBeUndefined();
    await expect(page.locator('#prop-high')).toBeHidden();

    // COMING BACK DOWN NEEDS A TOP AGAIN, since the one it had is gone.
    await page.locator('#band-totop').uncheck();
    await settle(page, '"highFt":3');
    bands = await storedBands(page);
    expect(bands[0].toTop).toBeUndefined();
    expect(bands[0].highFt).toBe(3);
    await expect(page.locator('#prop-high')).toBeVisible();

    // THE SIDE INSETS, measured from each END of the wall: "and also on the
    // sides by 1ft".
    await page.locator('[data-nudge="start"][data-by="1"]').click();
    await settle(page, '"startFt":1');
    expect((await storedBands(page))[0].startFt).toBe(1);
    // AND BACK TO THE CORNER REMOVES THE KEY rather than storing a zero.
    await page.locator('[data-nudge="start"][data-by="-1"]').click();
    await page.waitForFunction(async bucket => {
      const file = await window.SharedFileStore.loadSharedFile(bucket);
      const saved = JSON.parse(await file.text());
      const wall = (saved.walls || []).find(w => Array.isArray(w.finishBands) && w.finishBands.length);
      return wall && !('startFt' in wall.finishBands[0]);
    }, BUCKET, { timeout: 5000 });

    // THE CORNER WRAP: "make it default 2ft but they can change it (1ft, 4ft
    // etc)".
    await expect(page.locator('#prop-wrap')).toBeHidden();
    await page.locator('#band-wrap').check();
    await settle(page, '"wrapFt":2');
    expect((await storedBands(page))[0].wrapFt).toBe(2);
    await expect(page.locator('#prop-wrap')).toBeVisible();
    await page.locator('[data-nudge="wrap"][data-by="1"]').click();
    await settle(page, '"wrapFt":3');
    expect((await storedBands(page))[0].wrapFt).toBe(3);
    await page.locator('#band-wrap').uncheck();
    await page.waitForFunction(async bucket => {
      const file = await window.SharedFileStore.loadSharedFile(bucket);
      const saved = JSON.parse(await file.text());
      const wall = (saved.walls || []).find(w => Array.isArray(w.finishBands) && w.finishBands.length);
      return wall && !('wrapFt' in wall.finishBands[0]);
    }, BUCKET, { timeout: 5000 });
    expect((await storedBands(page))[0].wrapFt).toBeUndefined();
  });

test('the ledge switch is offered where there are ledges, and nowhere else',
  async ({ page }) => {
    await openWall(page);
    await layBand(page, 'brick');

    // BRICK IS 4 5/8" AND CAPPED, so it takes a sill ledge and the switch is
    // there. Ticked means shown, which is the default.
    await expect(page.locator('#tick-ledge')).toBeVisible();
    await expect(page.locator('#band-ledge')).toBeChecked();
    expect((await storedBands(page))[0].noSillLedge).toBeUndefined();

    // THE REFUSAL IS WHAT IS STORED. "lets add a choice button on the menu
    // that allows them to TURN OFF the ledge if they choose not to show it" --
    // so the record holds the departure, not the permission.
    await page.locator('#band-ledge').uncheck();
    await settle(page, '"noSillLedge":true');
    expect((await storedBands(page))[0].noSillLedge).toBe(true);
    await page.locator('#band-ledge').check();
    await page.waitForFunction(async bucket => {
      const file = await window.SharedFileStore.loadSharedFile(bucket);
      const saved = JSON.parse(await file.text());
      const wall = (saved.walls || []).find(w => Array.isArray(w.finishBands) && w.finishBands.length);
      return wall && !('noSillLedge' in wall.finishBands[0]);
    }, BUCKET, { timeout: 5000 });

    // AND ON SIDING THERE IS NO SWITCH AT ALL, because there is no ledge for
    // it to turn off -- his gate is "the types that are over 1"". A control
    // for a thing the drawing never does teaches the rule wrong.
    await page.locator('#band-list .band .drop').click();
    await expect(page.locator('#band-list .band')).toHaveCount(0);
    await layBand(page, 'siding_h');
    await expect(page.locator('#tick-ledge')).toBeHidden();
    await expect(page.locator('#band-note')).toContainText('under an inch');
  });
