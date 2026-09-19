// THE BONE WALLET ON MODEL.html — the number on the press, and what it costs.
//
// Movie, 19 Sep: "can you bring the BONE number / TOKEN system over too. put
// the number on the bone under the bone in the red area and put the number in
// the house centered in the middle of the house outline", then "bring it like
// it was in model.dc".
//
// MODEL.html DID NOT LOAD bone-wallet.js AT ALL. The whole economy was absent
// on the page that is meant to replace the old one: builds were free, the
// press said nothing about what one cost, and a drafter moving between the
// two pages met two different rules for the same button.
//
// THE TWO POSITIONS ARE ONE RULE, which is the part worth a test of its own.
// The bone and the blue house are THE SAME BUTTON — BONE_ART swaps its
// artwork by theme, ruff to bone-red.png and rough to house-blue-*.png — so
// "under the bone in the red" and "centered in the house outline" are one
// number and two offsets. Movie, on being shown that: "yes exactly the style
// is different but the bone and house are the same button".
//
// These tests opt OUT of the helpers' fat 999-bone test wallet, because the
// economy is the subject.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';

const setWallet = (page, balance) => page.evaluate(b =>
  localStorage.setItem('draft-bone-wallet',
    JSON.stringify({ balance: b, lastDripAt: Date.now(), createdAt: Date.now() })), balance);

const walletBalance = page => page.evaluate(() =>
  JSON.parse(localStorage.getItem('draft-bone-wallet')).balance);

// AN EMPTY SHEET, because a build is the subject and the starter house would
// trip the one-house cap before the bone was pressed. The WHOLE level stack,
// not just MAIN FL: a bone press raises a building ACROSS the levels, and
// drawing-format.js drops any record whose levelId the drawing does not list
// -- so a one-level fixture would lose the foundation on the next open and
// the wall count below would be measuring the page's memory.
const empty = () => ({
  version: 1,
  levels: [
    { id: 8, name: 'SITE', elev: 0 },
    { id: 7, name: 'ROOF', elev: 0 },
    { id: 5, name: '2ND FL', elev: 9 },
    { id: 3, name: 'MAIN FL', elev: 0 },
    { id: 1, name: 'FOUNDATION', elev: -8 },
  ],
  activeLevelIdx: 3,
  walls: [], lines: [], floors: [], roofs: [], fenestrations: [], dimensions: [],
  outlines: [], shapes: [], surfaceOpenings: [], stairs: [], notes: [],
  roomTags: [], columns: [], beams: [], boneyardOutlines: [], boneyardShelves: [],
  groups: [], levelLocks: [], underlays: [],
});

async function open(page, balance) {
  await h.openModel(page, { webgl: false, boneWallet: false });
  await page.evaluate(async ({ bucket, f }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json',
        { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, f: empty() });
  await setWallet(page, balance);
  await page.goto('/MODEL.html?mode=night');
  // The readout's TEXT, not its visibility: it starts hidden.
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
}

// Order a type at the window and press the bone on the post.
async function order(page, family, entry) {
  await h.openDriveThru(page);
  await page.locator(`[data-build-family="${family}"]`).click();
  await page.locator(`[data-build-entry="${entry}"]`).click();
  await page.locator('#dt-bone').click();
  await page.waitForTimeout(400);
}

// THIS PAGE DOES NOT AUTOSAVE, so the store holds the FIXTURE until the
// button is pressed. Reading it without saving would report 0 walls whether
// the build ran or not -- one assertion, two worlds.
async function save(page) {
  await page.locator('#save').click();
  await expect(page.locator('#save')).toHaveText('SAVED', { timeout: 6000 });
}

const wallCount = page => page.evaluate(async bucket => {
  const file = await window.SharedFileStore.loadSharedFile(bucket);
  if (!file) return 0;
  return (JSON.parse(await file.text()).walls || []).length;
}, BUCKET);

// WHERE THE NUMBER SITS ON THE PRESS, as a fraction of the artwork's height.
// 0 is the top of the picture and 1 the bottom, so "low in the red" and
// "centred in the outline" are each one number this can be held to.
async function balanceHeightFraction(page) {
  const art = await page.locator('#bone [data-bone-art]').boundingBox();
  const num = await page.locator('#bone-balance').boundingBox();
  return ((num.y + num.height / 2) - art.y) / art.height;
}

test.describe('MODEL.html bone wallet', () => {
  test('the number is on the press, and it is the wallet', async ({ page }) => {
    await open(page, 5);
    await expect(page.locator('#bone-balance')).toHaveText('5');
    await expect(page.locator('#bone'))
      .toHaveAttribute('title', /5 bones/);
  });

  test('it rides low in the red on the bone and centred in the house outline',
    async ({ page }) => {
      await open(page, 5);

      // RUFF: the bone. Movie asked for it "under the bone in the red area",
      // which is MODEL.dc.html's own 74%.
      const onBone = await balanceHeightFraction(page);
      expect(onBone, `the number sat at ${onBone.toFixed(2)} of the bone's `
        + 'height — Movie asked for it low, in the red under the bone')
        .toBeGreaterThan(0.6);

      // ROUGH: the same button, wearing the blue house.
      await page.locator('[data-theme="rough"]').click();
      await page.waitForTimeout(250);
      await expect(page.locator('#bone [data-bone-art]'))
        .toHaveAttribute('src', /house-blue/);
      await expect(page.locator('#bone-balance'),
        'the wallet does not change because the picture did').toHaveText('5');

      const inHouse = await balanceHeightFraction(page);
      expect(Math.abs(inHouse - 0.5),
        `the number sat at ${inHouse.toFixed(2)} of the house's height — `
        + 'Movie asked for it centred in the middle of the outline')
        .toBeLessThan(0.06);
    });

  test('a build spends one bone', async ({ page }) => {
    await open(page, 5);
    await order(page, 'bungalow', 'bungalow');
    await save(page);
    expect(await wallCount(page),
      'the house has to be built for the spend to mean anything')
      .toBeGreaterThan(0);
    expect(await walletBalance(page)).toBe(4);
    await expect(page.locator('#bone-balance')).toHaveText('4');
  });

  test('an empty wallet greys the press, counts down, and refuses the build',
    async ({ page }) => {
      await open(page, 0);

      await expect(page.locator('#bone')).toHaveAttribute('data-broke', '');
      // NOT A BARE 0. The number on the press answers "can I build", and "no"
      // is only half of it — the other half is when.
      await expect(page.locator('#bone-balance')).toHaveText(/^0 · \S/);
      await expect(page.locator('#bone')).toHaveAttribute('title', /Out of bones/);

      await order(page, 'bungalow', 'bungalow');
      await save(page);
      expect(await wallCount(page),
        'a refused build must not raise a house')
        .toBe(0);
      expect(await walletBalance(page),
        'and a refusal cannot take a bone there is none of').toBe(0);
      await expect(page.locator('#dt-line')).toContainText('OUT OF BONES');
    });

  // THE VISIT COUNTER'S SLOT. Movie, 19 Sep: "i need the viewcounter lets put
  // it on lower left (2nd row from bottom to the left of 'STATUS READOUT'".
  //
  // THE COUNT ITSELF NEVER MOUNTS HERE and cannot be made to: traffic-counter
  // .js returns before doing anything on localhost, 127.0.0.1 and file:, so
  // that the suite never speaks off-site or inflates the public numbers. So
  // the slot is what is tested, with a probe standing in for the count — and
  // that is also why the slot is a named element rather than a gap measured
  // in pixels.
  test('the visit counter stands to the left of STATUS READOUT, on its row',
    async ({ page }) => {
      await open(page, 5);
      const slot = page.locator('[data-visit-counter-home]');
      await expect(slot).toHaveCount(1);

      const bare = await page.locator('#readout-tab').boundingBox();
      await page.evaluate(() => {
        const el = document.createElement('a');
        el.id = 'zz-count-probe';
        el.textContent = '1234 VISITS';
        el.style.cssText = 'display:inline-flex; align-items:center; height:20px;';
        document.querySelector('[data-visit-counter-home]').appendChild(el);
      });
      const probe = await page.locator('#zz-count-probe').boundingBox();
      const tab = await page.locator('#readout-tab').boundingBox();

      expect(probe.x + probe.width,
        'the count must end before STATUS READOUT begins')
        .toBeLessThanOrEqual(tab.x + 1);
      expect(Math.abs((probe.y + probe.height / 2) - (tab.y + tab.height / 2)),
        'and it must be ON that row, not above or below it')
        .toBeLessThan(10);
      expect(tab.x, 'the tab moves right to make room, and only then')
        .toBeGreaterThan(bare.x);
    });
});
