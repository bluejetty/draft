// THE FILE ROW on MODEL.html — NEW · OPEN · SAVE · status · SAVE AS · .ext
//
// Work order: the chrome shell, §1. Movie: "NEW OPEN SAVE SAVE AS in the
// upper right", and the name is "date-T-time to the minute" —
// 20260913T2201.draft, minutes and no seconds, ruled 13 Sep.
//
// THE ORDER OF THE TWO WRITES IS THE SUBJECT. A copy on disk of a drawing the
// shared store refused is worse than no copy: it is named as though it were
// saved, and the drafter keeps it. So the store goes first, the download only
// happens if the store took it, and both come from ONE serialization — a
// second JSON.stringify would hand out a file that differs from the stored
// one in any field a save mutates.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const HOUSE = JSON.parse(fs.readFileSync(
  path.join(__dirname, '..', 'proto', 'perf-bungalow.draft'), 'utf8'));

async function openPage(page, saved = HOUSE) {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, drawing }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(drawing)], 'drawing.json', { type: 'application/json' }),
      bucket);
  }, { bucket: BUCKET, drawing: saved });
  await page.goto('/MODEL.html?mode=night');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
}

// An edit the page counts as unsaved, made through the model rather than by
// setting the flag: a guard proven against a hand-set `dirty` would pass on a
// page where nothing real ever marks it.
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
  await expect(page.locator('[data-model-save]')).toHaveText('UNSAVED');
}

const wallTotal = page => page.evaluate(() =>
  Number(/walls\s+\d+\/(\d+)/.exec(
    document.getElementById('readout').textContent)[1]));

test('the row is six controls in the upper right, in the ruled order',
  async ({ page }) => {
    await openPage(page);
    const row = page.locator('#file-row');
    await expect(row).toBeVisible();
    expect(await row.evaluate(el => [...el.children]
      .map(c => c.tagName === 'SELECT' ? 'EXT' : (c.textContent.trim() || c.type))))
      .toEqual(['NEW', 'OPEN', 'file', 'SAVE', 'SAVE AS', 'EXT']);

    // UPPER RIGHT, measured against the sheet rather than trusted to CSS: the
    // mode corner holds the other end of the same row.
    const [box, mode] = await Promise.all([
      row.boundingBox(), page.locator('#mode-corner').boundingBox()]);
    expect(box.x, 'the file row sits right of the mode corner')
      .toBeGreaterThan(mode.x + mode.width - 1);
    expect(box.y, 'and at the top of the sheet').toBeLessThan(120);
  });

test('the generated name is the date and the time to the MINUTE, and follows the picker',
  async ({ page }) => {
    await openPage(page);
    const names = await page.evaluate(() => {
      const F = window.DraftDrawingFormat;
      const at = new Date(2026, 8, 13, 22, 1, 45);
      return {
        draft: F.drawingFileName('draft', at),
        json: F.drawingFileName('json', at),
        model: F.drawingFileName('.model', at),
        plan: F.drawingFileName('plan', at),
      };
    });
    // NO SECONDS. Movie read the format back as `20260913T2201.draft` and
    // ruled minutes; a seconds field would make two saves a minute apart look
    // like two different kinds of name.
    expect(names).toEqual({
      draft: '20260913T2201.draft',
      json: '20260913T2201.json',
      model: '20260913T2201.model',
      plan: '20260913T2201.plan',
    });

    // The picker offers exactly the four the page will open, `.draft` first.
    const options = await page.locator('#file-ext option')
      .evaluateAll(els => els.map(e => e.value));
    expect(options).toEqual(['draft', 'json', 'model', 'plan']);
    expect(await page.locator('#file-ext').inputValue()).toBe('draft');
  });

test('SAVE AS prefills the generated name, selects it, and lets it be typed over',
  async ({ page }) => {
    await openPage(page);
    await page.locator('#file-save-as').click();
    const box = page.locator('#save-as-name');
    await expect(box).toBeVisible();
    expect(await box.inputValue()).toMatch(/^\d{8}T\d{4}\.draft$/);
    // SELECTED, so typing replaces rather than appends — the prefill is a
    // suggestion, not a name the drafter has to delete first.
    expect(await box.evaluate(el => el.selectionEnd - el.selectionStart))
      .toBe((await box.inputValue()).length);

    await page.locator('#file-ext').selectOption('plan');
    await page.locator('[data-save-as-cancel]').click();
    await page.locator('#file-save-as').click();
    expect(await box.inputValue()).toMatch(/^\d{8}T\d{4}\.plan$/);
  });

test('SAVE AS writes the store FIRST and downloads exactly those bytes',
  async ({ page }) => {
    await openPage(page);
    await makeDirty(page);

    await page.locator('#file-save-as').click();
    await page.locator('#save-as-name').fill('my-house.draft');
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.locator('[data-save-as-go]').click(),
    ]);
    expect(download.suggestedFilename()).toBe('my-house.draft');

    const onDisk = fs.readFileSync(await download.path(), 'utf8');
    const inStore = JSON.stringify(await h.savedDrawing(page));
    // BYTE FOR BYTE, from one serialization. Two stringify calls would drift
    // silently the moment a save touched a counter, and the drafter's copy
    // would be a drawing that never existed anywhere.
    expect(onDisk).toBe(inStore);
    await expect(page.locator('[data-model-save]')).toHaveText('SAVED');
  });

test('a refused store write hands out NO file', async ({ page }) => {
  await openPage(page);
  await makeDirty(page);

  await page.evaluate(() => {
    const real = window.SharedFileStore.saveSharedFile;
    window.SharedFileStore.saveSharedFile = () => {
      window.__saveTried = (window.__saveTried || 0) + 1;
      return Promise.reject(Object.assign(new Error('stale'), { stale: true }));
    };
    window.__realSave = real;
  });

  let downloaded = false;
  page.on('download', () => { downloaded = true; });
  await page.locator('#file-save-as').click();
  await page.locator('[data-save-as-go]').click();
  await page.waitForTimeout(500);

  expect(await page.evaluate(() => window.__saveTried),
    'the store must have been asked, or this proves nothing').toBe(1);
  expect(downloaded, 'a refused write must not hand over a file').toBe(false);
  // And the drafter is told, and still has the edit.
  await expect(page.locator('[data-model-save]')).toHaveText('UNSAVED');
});

test('NEW asks before it throws away an edit, and Cancel keeps the drawing',
  async ({ page }) => {
    await openPage(page);
    await makeDirty(page);
    const before = await wallTotal(page);

    await page.locator('#file-new').click();
    await expect(page.locator('#file-guard')).toBeVisible();
    await page.locator('[data-guard-cancel]').click();
    await expect(page.locator('#file-guard')).toBeHidden();
    expect(await wallTotal(page), 'Cancel keeps the drawing').toBe(before);
    await expect(page.locator('[data-model-save]')).toHaveText('UNSAVED');
  });

test('NEW past the guard is the five-level blank, read in through the format',
  async ({ page }) => {
    await openPage(page);
    await makeDirty(page);
    await page.locator('#file-new').click();
    await page.locator('[data-guard-discard]').click();
    await expect(page.locator('#file-guard')).toBeHidden();
    await page.waitForTimeout(300);

    const fresh = await page.evaluate(() => {
      const text = document.getElementById('readout').textContent;
      const cards = [...document.querySelectorAll('.lv-card[data-level]')]
        .map(card => ({
          id: Number(card.dataset.level),
          label: card.querySelector('.lv-name').textContent,
        }));
      return { text, cards };
    });
    expect(fresh.text, 'a new drawing has nothing in it').toContain('walls 0/0');

    // THE OLD PAGE'S LEVELS, not an empty drawing: a drawing with no levels
    // has nowhere to draw.
    //
    // BY ID, WHICH IS WHAT THE FORMAT ACTUALLY FIXES. This read the cards'
    // text and compared it to the stored names, which held only while the two
    // were the same string -- and they stopped being the same the day the
    // cards began reading '1 MAIN FL'. The claim was never about the words on
    // screen: it is that NEW lays down the five-level blank, and a level's
    // identity in this repo is its id. So the ids are the assertion and the
    // labels are checked against the module that derives them.
    expect(fresh.cards.map(c => c.id), 'NEW must lay down the five-level blank')
      .toEqual([8, 7, 5, 3, 1]);
    // THE STOREYS ARE NUMBERED AND THE REST ARE NOT -- Movie, 19 Sep, "lets
    // name them ... 1 MAIN FL ... 2 2ND FL" and, on the others, "(and
    // foundation boneyard etc roof site". Written out in his own words so this
    // cannot go quietly green on a page that derives nothing.
    expect(fresh.cards.map(c => c.label), 'the cards must read as storeys')
      .toEqual(['SITE', 'ROOF', '2 2ND FL', '1 MAIN FL', 'FOUNDATION']);
    // AND THE MODULE IS WHERE THOSE TWO COME FROM, not this file: the blank's
    // stored names are the old page's, and levelLabel is what turns them into
    // what the card shows. Only the numbered pair is asked, because the other
    // three are names this table has no opinion about and passes through.
    const derived = await page.evaluate(() => [
      window.DraftLevelAssembly.levelLabel(5, '2ND FL'),
      window.DraftLevelAssembly.levelLabel(3, 'MAIN FL'),
    ]);
    expect(derived, 'the cards agree with the module that derives them')
      .toEqual(['2 2ND FL', '1 MAIN FL']);
  });

test('a clean page does not ask at all', async ({ page }) => {
  await openPage(page);
  await page.locator('#file-new').click();
  await expect(page.locator('#file-guard')).toBeHidden();
  await page.waitForTimeout(300);
  await expect(page.locator('#readout')).toContainText('walls 0/0');
});

test('SAVE FIRST that FAILS keeps the drawing and the guard', async ({ page }) => {
  await openPage(page);
  await makeDirty(page);
  const before = await wallTotal(page);

  await page.evaluate(() => {
    window.SharedFileStore.saveSharedFile = () =>
      Promise.reject(Object.assign(new Error('stale'), { stale: true }));
  });
  await page.locator('#file-new').click();
  await page.locator('[data-guard-save]').click();
  await page.waitForTimeout(400);

  // THE WHOLE POINT OF THE GUARD. A page that offered to save, failed, and
  // replaced the drawing anyway would be worse than no guard at all.
  await expect(page.locator('#file-guard')).toBeVisible();
  expect(await wallTotal(page), 'a failed save keeps the drawing').toBe(before);
  await expect(page.locator('[data-model-save]')).toHaveText('UNSAVED');
});

test('OPEN takes a drawing under any of the four extensions', async ({ page }) => {
  await openPage(page);

  const accept = await page.locator('#file-input').getAttribute('accept');
  for (const ext of ['.json', '.draft', '.model', '.plan']) {
    expect(accept, `${ext} must be offered`).toContain(ext);
  }

  const tmp = test.info().outputPath('opened');
  fs.mkdirSync(tmp, { recursive: true });
  for (const ext of ['json', 'draft', 'model', 'plan']) {
    // A DIFFERENT DRAWING PER EXTENSION, so a page that ignored the file and
    // kept what it had would read as a pass on the first one only.
    const wide = 12 + ['json', 'draft', 'model', 'plan'].indexOf(ext);
    const file = path.join(tmp, `house.${ext}`);
    fs.writeFileSync(file, JSON.stringify({
      ...HOUSE,
      walls: (HOUSE.walls || []).slice(0, wide),
    }));
    await page.locator('#file-input').setInputFiles(file);
    await expect.poll(() => wallTotal(page),
      { message: `a .${ext} file must open`, timeout: 5000 }).toBe(wide);
    // ARRIVES UNSAVED: what is on screen is not what the store holds until
    // somebody presses SAVE.
    await expect(page.locator('[data-model-save]')).toHaveText('UNSAVED');
  }
});

test('OPEN asks before it throws away an edit', async ({ page }) => {
  await openPage(page);
  await makeDirty(page);
  await page.locator('#file-open').click();
  await expect(page.locator('#file-guard')).toBeVisible();
  await expect(page.locator('[data-file-guard-text]'))
    .toContainText('opening another');
  await page.locator('[data-guard-cancel]').click();
  await expect(page.locator('#file-guard')).toBeHidden();
});
