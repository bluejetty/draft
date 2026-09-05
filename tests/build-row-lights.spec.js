// THE BUILD ROW — turtle, rabbit, and lamps that mean something (board NEW-4,
// the house types NEW-5).
//
// Three states per lamp: OFF when the thing does not exist and its tool is
// not armed, LIT once the thing is in the drawing, ARMED while you trace.
// The garage lamps are art — the button, and the same button with its light
// out — so off is drawn rather than approximated by a filter, and a dark
// lamp keeps the colour that says which lamp it is. Armed is the lit art
// plus a halo, and it beats lit, so a press never reads as an off.
//
// The rule these specs exist to protect for the GARAGES: LIT IS DERIVED FROM
// THE MODEL ON EVERY RENDER AND NEVER STORED. That is what makes F5 keep the
// lights and NEW clear them without either being written twice — so the F5
// and NEW cases below are the ones that would catch a flag creeping back in.
//
// The HOUSE TYPES are the deliberate exception, and the rule is the mirror:
// LIT IS THE STORED TYPE AND NOTHING ELSE. BUNGALOW / 2 STOREY / BILEVEL /
// MODIFIED BILEVEL are words, not art; the lit one is `buildType` on the
// drawing, which no geometry can derive (a traced rectangle does not say how
// many storeys it will be), so it is read from state on every render and
// lives in the file. F5 keeps it because the file has it; NEW clears it
// because the blank drawing has none. A house drawn without pressing a type
// — the Outline tool straight from a spec, an older drawing — lights no
// type, and that is the truth about it rather than a defect.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

// Off and on are two pieces of ART for the garages, not one filter. The halo
// is the third state and the only one that is a filter, on every lamp.
const off = name => new RegExp(`${name}out\\.png$`);
const on = name => new RegExp(`btn-${name}\\.png$`);
const NO_GLOW = 'none';
const armedRe = {
  house: /rgba?\(192, ?57, ?43/,
  attached: /rgba?\(63, ?127, ?214/,
  detached: /rgba?\(125, ?91, ?166/,
};
const TYPES = ['bungalow', 'twoStorey', 'bilevel', 'modifiedBilevel'];

// Each lamp read as the pair that describes it: which art it wears (or, for
// a house type, whether it carries the lit fill), and whether it carries the
// armed halo.
const lamps = page => page.evaluate(() => {
  const read = sel => {
    const el = document.querySelector(sel);
    if (!el) return null;
    return { src: el.querySelector('img')?.getAttribute('src') || '', glow: el.style.filter };
  };
  const types = Object.fromEntries([...document.querySelectorAll('[data-select-build]')].map(el => [
    el.dataset.selectBuild,
    { lit: el.style.background === 'rgb(29, 31, 32)', glow: el.style.filter, label: el.textContent.trim() },
  ]));
  return {
    turtle: read('[data-select-turtle]'),
    attached: read('[data-mark-attached-garage]'),
    detached: read('[data-mark-detached-garage]'),
    rabbit: read('[data-select-rabbit]'),
    types,
  };
});
const litTypes = state => TYPES.filter(id => state.types[id]?.lit);
const haloTypes = state => TYPES.filter(id => state.types[id] && state.types[id].glow !== NO_GLOW);

async function traceRect(page, points) {
  await h.selectTool(page, 'Outline');
  for (const [x, z] of points) await h.clickWorld(page, x, z);
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);
}

// A house the way a drafter draws one: press its type, past PROFESSOR GRUFF,
// trace, close.
async function traceHouseAs(page, type, points) {
  await page.locator(`[data-select-build="${type}"]`).click();
  await page.keyboard.press('Enter');
  for (const [x, z] of points) await h.clickWorld(page, x, z);
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);
}

const HOUSE = [[-8, -6], [8, -6], [8, 6], [-8, 6], [-8, -6]];

// A house, an attached garage and a detached garage on the active shelf —
// the "2 or 3 lights maybe 4" case, and the only footprint that tells the
// lamps apart.
async function buildHouseAndBothGarages(page) {
  await traceHouseAs(page, 'bungalow', HOUSE);
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
    expect(Object.keys(state.types)).toEqual(TYPES);
    expect(litTypes(state)).toEqual([]);
    expect(haloTypes(state)).toEqual([]);
    expect(state.detached.src).toMatch(off('detached'));
    // ATTACHED is not in the DOM until a house master exists.
    expect(state.attached).toBeNull();

    await page.locator('[data-select-build="bungalow"]').click();
    await page.waitForTimeout(200);
    state = await lamps(page);
    // Arming lights the type and adds the halo, though nothing exists yet.
    expect(litTypes(state)).toEqual(['bungalow']);
    expect(haloTypes(state)).toEqual(['bungalow']);
    expect(state.types.bungalow.glow).toMatch(armedRe.house);
    // Arming one lamp says nothing about any other.
    expect(state.detached.src).toMatch(off('detached'));
  });

  test('building lights each lamp, and armed still beats lit', async ({ page }) => {
    await h.openModel(page, { webgl: false });
    await buildHouseAndBothGarages(page);

    // Tracing the last outline leaves the Outline tool live with no garage
    // mode, which IS the type's armed condition — so armed-beats-lit shows
    // up here by construction rather than by contrivance: the house exists
    // AND is armed, and the row shows armed on the stored type.
    await h.climbTourToMain(page);
    let state = await lamps(page);
    expect(litTypes(state)).toEqual(['bungalow']);
    expect(state.types.bungalow.glow).toMatch(armedRe.house);
    expect(state.attached.src).toMatch(on('attached'));
    expect(state.attached.glow).toBe(NO_GLOW);
    expect(state.detached.src).toMatch(on('detached'));

    // Arming a garage hands the bright state over: the type stops being
    // armed and falls back to lit, because it is still the stored type.
    await page.locator('[data-mark-attached-garage]').click();
    await page.waitForTimeout(200);
    state = await lamps(page);
    expect(state.attached.glow).toMatch(armedRe.attached);
    expect(litTypes(state)).toEqual(['bungalow']);
    expect(haloTypes(state)).toEqual([]);
    expect(state.detached.src).toMatch(on('detached'));
  });

  test('lit survives a reload and NEW puts every lamp out', async ({ page }) => {
    await h.openModel(page, { webgl: false });
    await buildHouseAndBothGarages(page);

    // F5: three lamps lit on open, no click needed. The garages pass only
    // while lit is derived from the model; the type passes only while it
    // is in the file.
    await page.reload();
    await h.waitForModelReady(page);
    let state = await lamps(page);
    for (const name of ['attached', 'detached']) {
      expect(state[name].src).toMatch(on(name));
      expect(state[name].glow).toBe(NO_GLOW);
    }
    expect(litTypes(state)).toEqual(['bungalow']);
    expect(haloTypes(state)).toEqual([]);

    await page.getByRole('button', { name: 'NEW', exact: true }).click();
    const dontSave = page.getByRole('button', { name: "DON'T SAVE" });
    if (await dontSave.count()) await dontSave.click();
    await h.waitForSaved(page);

    state = await lamps(page);
    expect(litTypes(state)).toEqual([]);
    expect(state.detached.src).toMatch(off('detached'));
    expect(state.attached).toBeNull();
  });

  test('the lit type is the stored type: it moves with the press and a press on it stands the trace down', async ({ page }) => {
    await h.openModel(page, { webgl: false });

    await page.locator('[data-select-build="twoStorey"]').click();
    await page.keyboard.press('Enter');
    await page.waitForTimeout(200);
    let state = await lamps(page);
    expect(litTypes(state)).toEqual(['twoStorey']);
    expect(haloTypes(state)).toEqual(['twoStorey']);
    await expect(page.locator('[data-model-drawing-message]')).toContainText('2 STOREY — trace the outline');

    // Another type mid-trace: the type changes hands and the halo goes with
    // it, because a house outline is the same outline under every type.
    await h.clickWorld(page, -8, -6);
    await h.clickWorld(page, 8, -6);
    await page.locator('[data-select-build="modifiedBilevel"]').click();
    await page.waitForTimeout(200);
    state = await lamps(page);
    expect(litTypes(state)).toEqual(['modifiedBilevel']);
    expect(haloTypes(state)).toEqual(['modifiedBilevel']);
    await expect(page.locator('[data-model-drawing-message]')).toContainText('MODIFIED BILEVEL — trace the outline');

    // The lit type pressed while armed stands the trace down and stays lit:
    // the drawing still has a type, there is just nothing being traced.
    await page.locator('[data-select-build="modifiedBilevel"]').click();
    await page.waitForTimeout(200);
    state = await lamps(page);
    expect(litTypes(state)).toEqual(['modifiedBilevel']);
    expect(haloTypes(state)).toEqual([]);
    await expect(page.locator('[data-model-drawing-message]')).toContainText('MODIFIED BILEVEL trace off.');
    expect((await h.savedDrawing(page)).buildType).toBe('modifiedBilevel');
  });

  test('a house drawn without a type press lights no type', async ({ page }) => {
    await h.openModel(page, { webgl: false });
    await traceRect(page, HOUSE);
    await h.climbTourToMain(page);
    const state = await lamps(page);
    expect(litTypes(state)).toEqual([]);
    expect((await h.savedDrawing(page)).buildType).toBeNull();
  });

  test('turtle and rabbit bookend the row, always present and never lamps', async ({ page }) => {
    await h.openModel(page, { webgl: false });

    const cluster = page.locator('[data-build-cluster]');
    await expect(cluster.locator('[data-select-turtle]')).toBeVisible();
    await expect(cluster.locator('[data-select-rabbit]')).toBeVisible();

    // They wear no filter in any drawing state — an assistance level is not
    // a thing that can exist, so dim/armed/lit would say something untrue.
    let state = await lamps(page);
    expect(state.turtle.glow).toBe('');
    expect(state.rabbit.glow).toBe('');

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
    await traceHouseAs(page, 'bungalow', HOUSE);
    await h.climbTourToMain(page);
    state = await lamps(page);
    expect(litTypes(state)).toEqual(['bungalow']);
    expect(state.turtle.glow).toBe('');
    expect(state.rabbit.glow).toBe('');
  });
});
