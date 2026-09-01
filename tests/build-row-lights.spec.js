// THE BUILD ROW — turtle, rabbit, and lamps that mean something (board NEW-4).
//
// Three states per lamp: DIM when the thing does not exist and its tool is
// not armed, ARMED while you trace, LIT once the thing is in the drawing.
// Armed beats lit, so a press never reads as switching something off.
//
// The rule these specs exist to protect: LIT IS DERIVED FROM THE MODEL ON
// EVERY RENDER AND NEVER STORED. That is what makes F5 keep the lights and
// NEW clear them without either being written twice — so the F5 and NEW
// cases below are the ones that would catch a flag creeping back in.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const DIM = 'grayscale(1) brightness(0.7)';
const LIT = 'none';
const armedRe = {
  house: /rgba?\(192, ?57, ?43/,
  attached: /rgba?\(63, ?127, ?214/,
  detached: /rgba?\(125, ?91, ?166/,
};

const lamps = page => page.evaluate(() => {
  const f = sel => { const el = document.querySelector(sel); return el ? el.style.filter : null; };
  return {
    turtle: f('[data-select-turtle]'),
    house: f('[data-select-house]'),
    split: f('[data-select-split]'),
    attached: f('[data-mark-attached-garage]'),
    detached: f('[data-mark-detached-garage]'),
    rabbit: f('[data-select-rabbit]'),
  };
});

async function traceRect(page, points) {
  await h.selectTool(page, 'Outline');
  for (const [x, z] of points) await h.clickWorld(page, x, z);
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);
}

// A house, an attached garage and a detached garage on the active shelf —
// the "2 or 3 lights maybe 4" case, and the only footprint that tells the
// three lamps apart.
async function buildHouseAndBothGarages(page) {
  await traceRect(page, [[-8, -6], [8, -6], [8, 6], [-8, 6], [-8, -6]]);
  await h.climbTourToMain(page);

  await page.locator('[data-mark-attached-garage]').click();
  await traceRect(page, [[8, -6], [18, -6], [18, 2], [8, 2]]);

  await page.locator('[data-mark-detached-garage]').click();
  await traceRect(page, [[-30, -6], [-20, -6], [-20, 2], [-30, 2], [-30, -6]]);
  // A detached garage is not a master until its foundation is answered.
  await page.locator('[data-detached-grade-beam]').click();
  await h.waitForSaved(page);
}

test.describe('The build row lamps', () => {
  test('an empty drawing rests dark, and arming lights only its own lamp', async ({ page }) => {
    await h.openModel(page, { webgl: false });

    let state = await lamps(page);
    expect(state.house).toBe(DIM);
    expect(state.detached).toBe(DIM);
    // SPLIT and ATTACHED are not in the DOM until a house master exists.
    expect(state.split).toBeNull();
    expect(state.attached).toBeNull();

    await page.locator('[data-select-house]').click();
    await page.waitForTimeout(200);
    state = await lamps(page);
    expect(state.house).toMatch(armedRe.house);
    // Arming one lamp says nothing about any other.
    expect(state.detached).toBe(DIM);
  });

  test('building lights each lamp, and armed still beats lit', async ({ page }) => {
    await h.openModel(page, { webgl: false });
    await buildHouseAndBothGarages(page);

    // Tracing the last outline leaves the Outline tool live with no garage
    // mode, which IS the house lamp's armed condition — so armed-beats-lit
    // shows up here by construction rather than by contrivance: the house
    // exists AND is armed, and the row shows armed.
    let state = await lamps(page);
    expect(state.house).toMatch(armedRe.house);
    expect(state.attached).toBe(LIT);
    expect(state.detached).toBe(LIT);

    // Arming a garage hands the bright state over: the house stops being
    // armed and falls back to lit, because it still exists.
    await page.locator('[data-mark-attached-garage]').click();
    await page.waitForTimeout(200);
    state = await lamps(page);
    expect(state.attached).toMatch(armedRe.attached);
    expect(state.house).toBe(LIT);
    expect(state.detached).toBe(LIT);
  });

  test('lit survives a reload and NEW puts every lamp out', async ({ page }) => {
    await h.openModel(page, { webgl: false });
    await buildHouseAndBothGarages(page);

    // F5: three lamps lit on open, no click needed. This passes only while
    // lit is derived from the model rather than stored.
    await page.reload();
    await h.waitForModelReady(page);
    let state = await lamps(page);
    expect(state.house).toBe(LIT);
    expect(state.attached).toBe(LIT);
    expect(state.detached).toBe(LIT);

    await page.getByRole('button', { name: 'NEW', exact: true }).click();
    const dontSave = page.getByRole('button', { name: "DON'T SAVE" });
    if (await dontSave.count()) await dontSave.click();
    await h.waitForSaved(page);

    state = await lamps(page);
    expect(state.house).toBe(DIM);
    expect(state.detached).toBe(DIM);
    expect(state.split).toBeNull();
    expect(state.attached).toBeNull();
  });

  test('SPLIT holds its place permanently dim until split zones exist', async ({ page }) => {
    await h.openModel(page, { webgl: false });
    await traceRect(page, [[-8, -6], [8, -6], [8, 6], [-8, 6], [-8, -6]]);
    await h.climbTourToMain(page);

    // It appears with the house, and it is dark: there is no split geometry
    // and no split tool, so it can neither be armed nor exist. Unavailable
    // is the truth about it, not a defect.
    expect((await lamps(page)).split).toBe(DIM);
    await page.locator('[data-select-split]').click();
    await expect(page.locator('[data-model-drawing-message]')).toContainText('coming soon');
    expect((await lamps(page)).split).toBe(DIM);
  });

  test('turtle and rabbit bookend the row, always present and never lamps', async ({ page }) => {
    await h.openModel(page, { webgl: false });

    const cluster = page.locator('[data-build-cluster]');
    await expect(cluster.locator('[data-select-turtle]')).toBeVisible();
    await expect(cluster.locator('[data-select-rabbit]')).toBeVisible();

    // They wear no filter in any drawing state — an assistance level is not
    // a thing that can exist, so dim/armed/lit would say something untrue.
    let state = await lamps(page);
    expect(state.turtle).toBe('');
    expect(state.rabbit).toBe('');

    // First and last in the cluster, with the lamps between them.
    const order = await page.evaluate(() => [...document.querySelector('[data-build-cluster]').children]
      .filter(el => el.tagName === 'BUTTON' || el.querySelector('button'))
      .map(el => (el.tagName === 'BUTTON' ? el : el.querySelector('button')).dataset));
    expect(Object.keys(order[0])).toContain('selectTurtle');
    expect(Object.keys(order[order.length - 1])).toContain('selectRabbit');

    // They say what is coming rather than answering a press with nothing.
    await page.locator('[data-select-turtle]').click();
    await expect(page.locator('[data-model-drawing-message]')).toContainText('TURTLE');
    await page.locator('[data-select-rabbit]').click();
    await expect(page.locator('[data-model-drawing-message]')).toContainText('RABBIT');

    // Still bare after a house exists and the lamps have come on.
    await traceRect(page, [[-8, -6], [8, -6], [8, 6], [-8, 6], [-8, -6]]);
    await h.climbTourToMain(page);
    state = await lamps(page);
    expect(state.house).toBe(LIT);
    expect(state.turtle).toBe('');
    expect(state.rabbit).toBe('');
  });
});
