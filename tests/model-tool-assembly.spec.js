// ASSEMBLY and UNGROUP on MODEL.html — the last of acceptance #3.
//
// Work order: GILLIGAN-TOOL-COLUMN-WORKORDER.md.
//
// AN ASSEMBLY NAMES ITS MEMBERS BY TYPE AND ID, never by object reference
// (_createGroup :17940), which is why the checks here save and reload rather
// than reading the panel. Every object in a drawing is a new object after a
// load; the ids come back and the references do not, so a grouping held by
// reference would look perfect on screen and be gone the next morning. Reading
// it back out of the file is the only check that can tell those two apart.
//
// ESCAPE IN THE NAME FIELD CREATES AN ASSEMBLY. It does not cancel. That is
// the old page's binding (onGroupNameKey :23685-23687) and it is ported
// faithfully because the order says the roster is not a place to improve on.
// It is asserted below so it is a recorded decision rather than an accident,
// and it is flagged in the PR as worth someone's ruling: everywhere else on
// both pages Escape backs out.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const V = (x, z) => ({ x, y: 0, z });
const W = 10;

// Symmetric about the origin so fit()'s centre is exactly (0,0) — see
// model-tool-select.spec.js for the two coordinate traps that buys off.
const FIXTURE = {
  version: 1,
  levels: [{ id: 3, name: 'MAIN FL', elev: 0 }],
  activeLevelIdx: 0,
  walls: [
    ['w-n', V(-W, -W), V(W, -W)],
    ['w-e', V(W, -W), V(W, W)],
    ['w-s', V(W, W), V(-W, W)],
    ['w-w', V(-W, W), V(-W, -W)],
  ].map(([id, start, end]) => ({
    id, start, end, levelId: 3, view: 'plan',
    wallType: 'stud_2x6', baseHeight: 0, topHeight: 8, refLine: 'left',
  })),
  lines: [], floors: [], roofs: [], fenestrations: [], dimensions: [],
  outlines: [], shapes: [], surfaceOpenings: [], stairs: [], notes: [],
  roomTags: [], columns: [], beams: [], boneyardOutlines: [],
  boneyardShelves: [], groups: [], levelLocks: [], nextGroupId: 1,
  underlays: [],
  // A DRAFTING BOARD, NAMED. §6 gives TOY a walls-only tool column and puts the
  // rest away, and the page now defaults to TOY -- so every open() here waited
  // on a button that is correctly absent, at three minutes a test. That is what
  // cancelled CI shard 3 after forty minutes, twice, with no failure text on
  // the PR to say why.
  //
  // These suites are about what the tool does once the drafter has it, not
  // about which board offers it. §6's own gate owns that question. So the board
  // is stated rather than inherited, which is the same correction the strip,
  // shell and seats checks needed.
  board: 'drafting',
};

async function open(page) {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, file }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(file)], 'drawing.json',
        { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, file: FIXTURE });
  await page.goto('/MODEL.html?left=1');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  await expect(page.locator('[data-assembly-start]')).toBeVisible();
}

const at = async (page, x, z) => {
  const box = await page.locator('#plan').boundingBox();
  const scale = await page.evaluate(() => Number(
    /scale ([\d.]+) px\/ft/.exec(document.getElementById('readout').textContent)[1]));
  return [box.x + box.width / 2 + x * scale, box.y + box.height / 2 + z * scale];
};

const selCount = page => page.evaluate(() => {
  const m = /(\d+) selected/.exec(document.getElementById('readout').textContent);
  return m ? Number(m[1]) : 0;
});

// Two walls, by clicking one and shift-clicking another.
async function pickTwoWalls(page) {
  await page.mouse.click(...await at(page, 0, -W));
  await page.waitForTimeout(60);
  await page.keyboard.down('Shift');
  await page.mouse.click(...await at(page, W, 0));
  await page.waitForTimeout(60);
  await page.keyboard.up('Shift');
  expect(await selCount(page)).toBe(2);
}

// THE FILE, not the panel. See the header.
async function savedGroups(page) {
  await page.locator('#save').click();
  await expect(page.locator('#save')).toHaveText('SAVED', { timeout: 6000 });
  const saved = await page.evaluate(async bucket => {
    const file = await window.SharedFileStore.loadSharedFile(bucket);
    return file ? JSON.parse(await file.text()) : null;
  }, BUCKET);
  return saved?.groups || [];
}

async function assemble(page, { name, fixed = true }) {
  await page.locator('[data-assembly-start]').click();
  await expect(page.locator('[data-assembly-dialog]')).toBeVisible();
  if (name) await page.locator('[data-assembly-name]').fill(name);
  await page.locator(fixed ? '[data-assembly-fixed]' : '[data-assembly-loose]')
    .click();
  await page.waitForTimeout(120);
}

test('ASSEMBLY is dead until something is selected, and says why',
  async ({ page }) => {
    await open(page);
    const btn = page.locator('[data-assembly-start]');
    const help = page.locator('[data-assembly-help]');

    await expect(btn).toBeDisabled();
    await expect(help).toHaveText('Select drawing items before assembling them.');
    await expect(help).toHaveAttribute('data-engaged', '');

    await pickTwoWalls(page);
    await expect(btn).toBeEnabled();
    await expect(help).toHaveText('2 selected items · make a named assembly.');
    await expect(help).not.toHaveAttribute('data-engaged', /.*/);

    // The count is a count, not the word "some": one item reads singular.
    await page.mouse.click(...await at(page, 0, -W));
    await page.waitForTimeout(60);
    await expect(help).toHaveText('1 selected item · make a named assembly.');
  });

test('FIXED writes a named assembly into the file, by type and id',
  async ({ page }) => {
    await open(page);
    await pickTwoWalls(page);
    await assemble(page, { name: 'wc stack', fixed: true });

    const groups = await savedGroups(page);
    expect(groups).toHaveLength(1);
    expect(groups[0].name, 'the typed name, uppercased').toBe('WC STACK');
    expect(groups[0].fixed).toBe(true);
    expect(groups[0].stretchBehavior).toBe('rigid');
    // BY TYPE AND ID. A grouping held any other way does not survive the
    // reload this assertion just did.
    expect(groups[0].members).toEqual([
      { type: 'wall', id: 'w-n' }, { type: 'wall', id: 'w-e' },
    ]);
    // The first wall's settings ride the assembly, so a later change to it has
    // something to change from.
    expect(groups[0].wallSettings).toMatchObject({ wallType: 'stud_2x6' });
  });

test('NOT FIXED is a different assembly, not the same one with a flag off',
  async ({ page }) => {
    await open(page);
    await pickTwoWalls(page);
    await assemble(page, { name: '', fixed: false });

    const groups = await savedGroups(page);
    expect(groups[0].fixed).toBe(false);
    expect(groups[0].stretchBehavior, 'the behaviour moves with the flag')
      .toBe('item-geometry');
    // No name typed: the default names itself after its own number rather
    // than landing in the file blank.
    expect(groups[0].name).toBe('ASSEMBLY 1');
  });

test('clicking one member takes THAT member — the assembly is not expanded',
  async ({ page }) => {
    // A DELIBERATE DIVERGENCE FROM THE OLD PAGE, left open rather than decided
    // in this PR. Its _addItemsAndTheirGroups pulls a hit item's group in with
    // it, and that shipped here first — then broke ten checks in
    // model-html-draw-delete.spec.js, whose fixture groups w-a with w-b. A tap
    // meant to select ONE wall selected two, the DELETE button (which means
    // "exactly one wall") went dark, and "delete this wall" had quietly become
    // "delete this assembly".
    //
    // That is a product decision — a drafter who groups two walls and presses
    // Delete on one may or may not mean both — and this order says only that
    // ASSEMBLY groups and UNGROUP releases. Nothing in it needs the expansion:
    // selectedGroups() counts a group as selected when ANY member is, which is
    // the old page's own test, so UNGROUP still works from a click on one wall
    // (asserted below). Established behaviour wins while the question is open.
    await open(page);
    await pickTwoWalls(page);
    await assemble(page, { name: 'pair', fixed: true });
    expect(await selCount(page), 'the new assembly is what is selected').toBe(2);

    await page.keyboard.press('Escape');
    await page.waitForTimeout(60);
    expect(await selCount(page)).toBe(0);

    // ONE wall of the assembly, and one is what is selected.
    await page.mouse.click(...await at(page, 0, -W));
    await page.waitForTimeout(80);
    expect(await selCount(page),
      'the assembly is not pulled in behind the wall that was clicked').toBe(1);

    // And the DELETE button still means what it meant — the reading that broke
    // when the expansion was in.
    await expect(page.locator('[data-delete-wall]')).toBeVisible();
  });

test('UNGROUP appears only for an assembly, and releases it without deleting',
  async ({ page }) => {
    await open(page);
    const ungroup = page.locator('[data-assembly-ungroup]');
    await expect(ungroup).toBeHidden();

    await pickTwoWalls(page);
    await expect(ungroup, 'still nothing to release: two loose walls')
      .toBeHidden();

    await assemble(page, { name: 'pair', fixed: true });
    await expect(ungroup).toBeVisible();

    await ungroup.click();
    await page.waitForTimeout(120);
    expect(await savedGroups(page), 'the assembly is gone').toHaveLength(0);

    // THE WALLS SURVIVE. Ungroup is not delete, and a version that removed the
    // members would pass the assertion above.
    const walls = await page.evaluate(async bucket => {
      const file = await window.SharedFileStore.loadSharedFile(bucket);
      return JSON.parse(await file.text()).walls.map(w => w.id);
    }, BUCKET);
    expect(walls).toEqual(['w-n', 'w-e', 'w-s', 'w-w']);

    // And clicking one is one again.
    await page.keyboard.press('Escape');
    await page.mouse.click(...await at(page, 0, -W));
    await page.waitForTimeout(80);
    expect(await selCount(page)).toBe(1);
  });

test('an item belongs to one assembly, and an emptied one goes',
  async ({ page }) => {
    await open(page);
    await pickTwoWalls(page);
    await assemble(page, { name: 'first', fixed: true });
    expect(await savedGroups(page)).toHaveLength(1);

    // Both of those walls plus a third, built click by click -- a click takes
    // the wall it hit and no more, so the set is assembled by shift-adding.
    await page.keyboard.press('Escape');
    await page.waitForTimeout(60);
    await page.mouse.click(...await at(page, 0, -W));   // w-n, in the first
    await page.waitForTimeout(60);
    await page.keyboard.down('Shift');
    await page.mouse.click(...await at(page, W, 0));    // w-e, in the first
    await page.waitForTimeout(60);
    await page.mouse.click(...await at(page, 0, W));    // w-s, in nothing yet
    await page.waitForTimeout(60);
    await page.keyboard.up('Shift');
    expect(await selCount(page)).toBe(3);

    await assemble(page, { name: 'second', fixed: false });
    const groups = await savedGroups(page);

    // The first assembly held w-n and w-e; both are now in the second, so the
    // first has nothing left and is dropped rather than persisting empty.
    expect(groups.map(g => g.name)).toEqual(['SECOND']);
    expect(groups[0].members.map(m => m.id).sort())
      .toEqual(['w-e', 'w-n', 'w-s']);
  });

test('Escape in the name field CREATES a NOT FIXED assembly', async ({ page }) => {
  // The old page's binding, ported faithfully and recorded here so it is a
  // decision rather than an accident. Everywhere else Escape backs out; here
  // it commits the flexible variant. Flagged for a ruling, not changed.
  await open(page);
  await pickTwoWalls(page);
  await page.locator('[data-assembly-start]').click();
  await page.locator('[data-assembly-name]').fill('by escape');
  await page.locator('[data-assembly-name]').press('Escape');
  await page.waitForTimeout(120);

  const groups = await savedGroups(page);
  expect(groups, 'Escape did not cancel — it made one').toHaveLength(1);
  expect(groups[0].name).toBe('BY ESCAPE');
  expect(groups[0].fixed, 'and the flexible variant, not the fixed one')
    .toBe(false);
});
