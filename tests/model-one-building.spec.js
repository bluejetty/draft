// ONE BUILDING PER DRAFT FILE (Movie, 24 Sep): "rule should be 1 autobuilt
// BUILDING per DRAFT file (a BUILDING would be a HOUSE or a DETACHED
// GARAGE)", and for the press that meets the cap: "if they press the button
// ask them if they would like to SAVE the current drawing and then proceed
// with a NEW CLEAN file for the new AUTOBUILD".
//
// WHAT THESE MEASURE IS THAT NOBODY IS SENT AWAY. The cap used to be two
// refusals at the order and a silent gate on the board; all three are gone,
// and a refusal turning into an offer is only worth anything if every step
// to it stays open. So the board still rises on a full file, the tile is
// still pressable, and the answer to the press is a QUESTION -- which means
// Cancel has to be a real answer too, and is checked here as carefully as
// the two that build.
//
// THE FIXTURE ALREADY HOLDS A HOUSE, which under this rule is a full file.
// Its attached garage rides the house outline onto every level, so it is
// also the witness that an attached garage spends nothing: the file is full
// because of the HOUSE, and building-bodies.js is what says so.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
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

// ONE WALL BY HAND, so the drawing has an unsaved edit for SAVE to write.
// Lifted from model-file-row.spec.js, which drives the same dialog from the
// FILE menu -- the geometry is incidental, the UNSAVED state is the point.
async function makeDirty(page) {
  const box = await page.locator('#plan').boundingBox();
  const scale = await page.evaluate(() =>
    Number(/scale\s+(\d+(?:\.\d+)?)/.exec(
      document.getElementById('readout').textContent)[1]));
  const at = (x, z) => [box.x + box.width / 2 + x * scale,
    box.y + box.height / 2 + z * scale];
  await h.armWall(page);
  await page.mouse.click(...at(-6, -6));
  await page.waitForTimeout(50);
  await page.mouse.click(...at(6, -6));
  await page.waitForTimeout(80);
  // THE KEY TOGGLES and stays armed after a wall commits, so leaving it on
  // would turn the next click in the test into a second wall.
  await h.disarmWall(page);
}

// UP TO THE PRESS AND NO FURTHER. Every check below starts here and then
// answers the dialog differently, so the ordering is written once.
const orderGarageOnAFullFile = async page => {
  await h.openDriveThru(page);
  await page.locator('#dt-tiles [data-build-family="detachedGarage"]').click();
  await page.locator('#dt-tiles [data-build-entry="detached-thickened"]').click();
  // NO SIZE PRESSED, because the board no longer asks. Movie, 24 Sep: "don't
  // offer a size for now ... for the Drive Thru Menu", with 24x26 standing in
  // as the answer. The press that follows is the whole order.
  await page.locator('#dt-bone').click();
};

test('the board still rises on a file that already holds a building',
  async ({ page }) => {
    // THE GATE THAT STOOD HERE RETURNED IN SILENCE. While "full" meant
    // "nothing left to build, ever" that was right; under one building per
    // file it made the bone the one press in the app that answers nothing,
    // with the offer on the far side of a board that would not open.
    await openPage(page);
    await page.locator('#bone').click();
    await expect(page.locator('#drivethru'),
      'the board stayed shut, so the drafter can never reach the offer')
      .not.toHaveAttribute('data-shut', '');
    await expect(page.locator('#build-families button').first()).toBeVisible();
  });

test('ordering a second building asks about the first instead of refusing it',
  async ({ page }) => {
    await openPage(page);
    await orderGarageOnAFullFile(page);
    // THE ANSWER IS A DIALOG, not a line on the sign. Two "YOU'VE GOT ONE
    // ALREADY" refusals used to land here and end the matter.
    await expect(page.locator('#file-guard'),
      'the press did not offer a clean file').toBeVisible();
    await expect(page.locator('[data-file-guard-text]')).toContainText(/clean file/i);
  });

test('Cancel builds nothing and leaves the drawing exactly where it was',
  async ({ page }) => {
    await openPage(page);
    const before = await h.savedDrawing(page);
    await orderGarageOnAFullFile(page);
    await page.locator('[data-guard-cancel]').click();
    await expect(page.locator('#file-guard')).toBeHidden();
    await page.waitForTimeout(400);

    // NOTHING MOVED. Cancel is the answer most likely to be wired wrong,
    // because the work sits in a callback and code written after the call
    // would run on all three buttons -- including this one.
    const after = await h.savedDrawing(page);
    expect({
      outlines: (after.outlines || []).length,
      walls: (after.walls || []).length,
    }).toEqual({
      outlines: (before.outlines || []).length,
      walls: (before.walls || []).length,
    });
  });

test('Discard opens a clean file and raises the building there',
  async ({ page }) => {
    await openPage(page);
    const before = await h.savedDrawing(page);
    const housesBefore = (before.outlines || []).filter(o => !o.garage).length;
    expect(housesBefore, 'the fixture was supposed to hold a house')
      .toBeGreaterThan(0);

    await orderGarageOnAFullFile(page);
    await page.locator('[data-guard-discard]').click();
    await expect(page.locator('#file-guard')).toBeHidden();
    await page.waitForTimeout(800);

    await page.locator('[data-model-save]').click();
    await expect(page.locator('[data-model-save]')).toHaveText(/saved/i, { timeout: 6000 });
    const after = await h.savedDrawing(page);

    const houses = (after.outlines || []).filter(o => !o.garage);
    const garages = (after.outlines || []).filter(o => o.garage && o.detached);
    expect(houses.length, 'the old house came along into the clean file').toBe(0);
    expect(garages.length, 'the garage did not land in the clean file').toBe(1);
    // AND NOT A WORD ABOUT buildType HERE, which is worth saying out loud
    // because the obvious assertion is wrong and fails convincingly. A
    // detached garage carries NO type by design -- build-menu.js: "a detached
    // garage says nothing about what house it stands beside, and may stand
    // beside none" -- so a garage file legitimately has none to forget. The
    // check for that belongs on a house, and is the next test.
  });

test('a house raised in the clean file still knows what it is',
  async ({ page }) => {
    // THE TRAP THIS EXISTS FOR: buildType is stamped onto whichever drawing
    // was open when the TYPE was pressed, so the blank adopted afterwards
    // carries none unless it is stamped a second time. NOTHING READS IT
    // DURING A BUILD, which is exactly why its absence would go unnoticed --
    // the house rises perfectly into a file that has forgotten what it is,
    // and the loss only surfaces somewhere that asks the file later.
    await openPage(page);
    await h.openDriveThru(page);
    await page.locator('#dt-tiles [data-build-family="bungalow"]').click();
    await page.locator('#dt-tiles [data-build-entry="bungalow"]').click();
    await page.locator('#dt-bone').click();

    await expect(page.locator('#file-guard'),
      'a house ordered onto a full file did not offer a clean one').toBeVisible();
    await page.locator('[data-guard-discard]').click();
    await expect(page.locator('#file-guard')).toBeHidden();
    await page.waitForTimeout(800);

    await page.locator('[data-model-save]').click();
    await expect(page.locator('[data-model-save]')).toHaveText(/saved/i, { timeout: 6000 });
    const after = await h.savedDrawing(page);
    expect((after.outlines || []).filter(o => !o.garage).length,
      'the bungalow never landed in the clean file').toBeGreaterThan(0);
    expect(after.buildType, 'the clean file forgot what it was built as')
      .toBeTruthy();
  });

test('Save writes the drawing that is being replaced, then builds',
  async ({ page }) => {
    await openPage(page);
    // A DIRTY DRAWING, so SAVE has something to do that DISCARD would lose.
    await makeDirty(page);
    await expect(page.locator('[data-model-save]')).toHaveText('UNSAVED');

    await orderGarageOnAFullFile(page);
    await page.locator('[data-guard-save]').click();
    await expect(page.locator('#file-guard')).toBeHidden({ timeout: 8000 });
    await page.waitForTimeout(800);

    // WHAT "IT SAVED FIRST" CAN AND CANNOT WITNESS HERE. save() writes to the
    // shared store, which holds ONE current drawing -- so the house it just
    // wrote is the same slot the garage will occupy the moment anything saves
    // again, and reading the store afterwards cannot tell a save that happened
    // from one that did not. This is FILE > NEW's behaviour too, through the
    // same dialog, and whether the store ought to keep the old drawing under
    // its own name is a question about the app's file model rather than about
    // this press.
    //
    // SO THE WITNESS IS THAT THE GUARD CLOSED AT ALL. Its SAVE button returns
    // early and leaves the dialog standing when save() comes back false, and
    // the callback that blanks the drawing never runs -- a closed guard and a
    // built garage together mean the write was taken.
    await page.locator('[data-model-save]').click();
    await expect(page.locator('[data-model-save]')).toHaveText(/saved/i, { timeout: 6000 });
    const after = await h.savedDrawing(page);
    expect((after.outlines || []).filter(o => !o.garage).length,
      'the house survived into the new file').toBe(0);
    expect((after.outlines || []).filter(o => o.garage && o.detached).length,
      'the garage never landed').toBe(1);
  });
