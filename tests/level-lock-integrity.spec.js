// A LEVEL LOCK THE DRAWING OUTGREW IS NOT A DAMAGED FILE.
//
// The loader's report separates two things on purpose (MODEL.dc.html:4080):
// "incomplete" means we could not READ the item and something is wrong with
// the file; a dropped item that is merely no longer applicable is not that.
// Level locks were counted the blunt way -- every lock that failed to load,
// for any reason, went into the damage tally.
//
// So deleting a level, which takes its assemblies with it, could leave a lock
// with fewer than two members and the drafter would be told their FILE was
// broken. It was true that the lock did not load. It was an accusation about
// geometry they deleted on purpose.
//
// This is the same defect as the lock leak that #348 fixed, wearing different
// clothes: there the lock was left dangling, here the dangling lock is
// reported as corruption. Kevin's rule covers both -- a finding describes the
// MODEL'S state, never the drafter's fault.
//
// THE TWO CASES ARE PINNED TOGETHER AND THAT IS THE POINT. Silencing the
// benign one is only correct if the genuine one still speaks; a change that
// muted both would pass a test that checked one.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const RECT = [[-16, -14], [16, -14], [16, 14], [-16, 14]];

async function bareOutline(page) {
  await h.pickBuild(page, 'twoStorey');
  await page.keyboard.press('Enter');
  for (const [x, z] of RECT) await h.clickWorld(page, x, z);
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);
  await expect(page.locator('[data-tour-popup]')).toBeVisible();
  await page.keyboard.press('Escape');
  await h.waitForSaved(page);
}

// Build a two-storey house so the bone deals a washroom on each floor and
// locks them together — that lock is the fixture.
async function houseWithALock(page) {
  await h.openModel(page, { autoStairs: true, tourEscort: true, roomGrow: true });
  await bareOutline(page);
  await page.locator('[data-build-house]').click();
  await h.waitForSaved(page);
  const saved = await h.savedDrawing(page);
  expect((saved.levelLocks || []).length, 'the press produced a lock to damage').toBeGreaterThan(0);
  return saved;
}

async function rewrite(page, mutate) {
  await page.evaluate(async fnBody => {
    const file = await window.SharedFileStore.loadSharedFile('model-drawing');
    const saved = JSON.parse(await file.text());
    // eslint-disable-next-line no-new-func
    new Function('saved', fnBody)(saved);
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(saved)], 'model-drawing.json', { type: 'application/json' }),
      'model-drawing');
  }, mutate);
  await page.reload();
  await expect(page.locator('[data-model-canvas]')).toBeVisible();
  await h.waitForModelReady(page);
}

test('a lock left with one member loads quietly — the drafter is not told their file is broken', async ({ page }) => {
  await houseWithALock(page);

  // Exactly what deleting one storey's assembly leaves behind.
  await rewrite(page, 'saved.levelLocks[0].members = [saved.levelLocks[0].members[0]];');

  await expect(page.locator('[data-model-drawing-message]')).not.toContainText('incomplete');
  await expect(page.locator('[data-model-drawing-message]')).not.toContainText('could not be loaded');
  // AND IT REALLY DID DROP -- otherwise this passes because nothing happened,
  // which is the whole failure mode a "does not say X" assertion invites.
  //
  // Read back through a RE-SAVE, not straight off disk. The load drops the
  // lock in memory; the stored file still holds the injected one until some
  // change writes it out. The first draft of this check read the file and
  // failed against working code -- measuring the fixture instead of the load.
  await h.selectTool(page, 'Annotation');
  await page.locator('[data-room-areas]').click();
  await h.waitForSaved(page);
  const after = await h.savedDrawing(page);
  expect(after.levelLocks || [], 'the one-member lock did not survive the load').toHaveLength(0);
});

test('a lock with no id still counts as damage — the quiet path did not mute everything', async ({ page }) => {
  await houseWithALock(page);

  await rewrite(page, 'saved.levelLocks[0].id = "";');

  await expect(page.locator('[data-model-drawing-message]')).toContainText('incomplete');
});
