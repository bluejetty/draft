// TIER 3c — MODEL.html draws a wall and deletes one.
//
// The first rung that CREATES and DESTROYS. Everything before it moved
// geometry that already existed, so the whole write surface was a move-drag
// commit and an undo. The deliverable is not the feature, it is the proof that
// the old page still opens the file afterwards without loss.
//
// Every wall field is derived the way MODEL.dc.html:14609 `_commitWall`
// derives it. These specs assert the DERIVED VALUES rather than re-deriving
// them from the same helpers the page uses — asking the module the same
// question the page asks it would let a wrong answer agree with itself.
const { test, expect } = require('@playwright/test');

const BUCKET = 'model-drawing';
const MAIN_FL = 3, FOUNDATION = 1;

const readout = page => page.locator('#readout');
const wallsShown = async page => {
  const hit = (await readout(page).textContent()).match(/walls (\d+)\/(\d+)/);
  return hit ? { shown: Number(hit[1]), total: Number(hit[2]) } : null;
};
const stored = page => page.evaluate(async bucket => {
  const file = await window.SharedFileStore.loadSharedFile(bucket);
  return JSON.parse(await file.text());
}, BUCKET);

// Two walls on MAIN FL sharing a corner at (8,0), a door on the first, a
// fixture anchored across both, and a group holding both.
const FIXTURE = `
  const wall = (id, x0, x1) => ({
    id, levelId: ${MAIN_FL}, view: 'plan', wallType: 'stud_2x6',
    baseHeight: 0, topHeight: 8, refLine: 'left',
    start: { x: x0, y: 0, z: 0 }, end: { x: x1, y: 0, z: 0 },
  });
  d.walls = [wall('w-a', -8, 0), wall('w-b', 0, 8)];
  d.fenestrations = [{ id: 'd1', wallId: 'w-a', levelId: ${MAIN_FL}, type: 'door',
    width: 3, offset: 4, sillHeight: 0, headHeight: 6.75 }];
  d.fixtures = [{ id: 'fx1', wallId: 'w-a', endWallId: 'w-b', levelId: ${MAIN_FL}, kind: 'tub' }];
  d.groups = [{ id: 'g1', members: [{ type: 'wall', id: 'w-a' }, { type: 'wall', id: 'w-b' }] }];
  d.nextDrawingItemId = 7;
  d.wallRefLine = 'left'; d.wallBaseHeight = 0; d.wallTopHeight = 8;
  d.activeWallType = 'stud_2x6';
  d.lines = []; d.floors = []; d.dimensions = []; d.roofs = []; d.shapes = []; d.outlines = [];
  return d;`;

async function seed(page, extra = null) {
  await page.goto('/MODEL.dc.html');
  await page.waitForFunction(() => !!window.SharedFileStore, null, { timeout: 10000 });
  await page.evaluate(async bucket => {
    const base = { format: 'draft-drawing', version: 1, levels: [
      { id: 8, name: 'SITE', elev: 0, visible: true },
      { id: 7, name: 'ROOF', elev: 18, visible: true },
      { id: 5, name: '2ND FL', elev: 9, visible: true },
      { id: 3, name: 'MAIN FL', elev: 0, visible: true },
      { id: 1, name: 'FOUNDATION', elev: -10, visible: true },
    ], walls: [], lines: [], floors: [], roofs: [], shapes: [], outlines: [],
      dimensions: [], notes: [], underlays: [], fixtures: [], fenestrations: [], stairs: [] };
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(base)], 'drawing.json', { type: 'application/json' }), bucket);
  }, BUCKET);
  for (const src of [FIXTURE, extra].filter(Boolean)) {
    await page.evaluate(async ({ bucket, src }) => {
      const file = await window.SharedFileStore.loadSharedFile(bucket);
      const d = JSON.parse(await file.text());
      // eslint-disable-next-line no-new-func
      const out = new Function('d', src)(d) || d;
      await window.SharedFileStore.saveSharedFile(
        new File([JSON.stringify(out)], 'drawing.json', { type: 'application/json' }), bucket);
    }, { bucket: BUCKET, src });
  }
}

// World → client WITHOUT reaching into the page. The fixture is symmetric
// about the origin, so fit() centres the view there, and the readout already
// publishes the scale in px/ft. Those two facts are the whole transform.
//
// The page exposes no view object and this spec does not ask it to: a test-only
// hook in product code is a second definition of where things are, and the one
// that gets stale is always the one nobody uses to draw.
const scaleOf = async page => {
  const hit = (await readout(page).textContent()).match(/scale ([\d.]+) px\/ft/);
  expect(hit, 'the readout publishes the scale').toBeTruthy();
  return Number(hit[1]);
};
const tapAt = async (page, x, z) => {
  const box = await page.locator('#plan').boundingBox();
  const scale = await scaleOf(page);
  const cx = box.width / 2 + x * scale;
  const cy = box.height / 2 + z * scale;
  // A CLICK OFF THE CANVAS DOES NOTHING, and nothing is exactly what a broken
  // feature looks like. fit() zooms to the drawing, so on a small fixture the
  // scale is large — 68.8 px/ft on two 8-foot walls — and a point six feet
  // away is 413px out, past the edge of a 720px canvas. Caught here rather
  // than read as "the wall would not commit".
  expect(cx >= 0 && cx <= box.width && cy >= 0 && cy <= box.height,
    `world (${x}, ${z}) is off-canvas at ${scale} px/ft — the tap would land nowhere`)
    .toBe(true);
  await page.mouse.click(box.x + cx, box.y + cy);
  await page.waitForTimeout(60);
};

// PROVE THE MAPPING BEFORE TRUSTING IT. If fit() does not centre on the origin
// for this fixture, every tap below lands somewhere the spec did not mean and
// the failures would look like the feature being broken. One tap on a known
// wall settles it.
async function assertMappingSane(page) {
  await tapAt(page, -4, 0);
  await expect(page.locator('[data-delete-wall]'),
    'a tap on w-a selects it, so world (0,0) really is canvas centre').toBeVisible();
  await page.keyboard.press('Escape');
}

async function openNewPage(page) {
  await page.goto('/MODEL.html');
  await expect(readout(page)).toContainText('MAIN FL', { timeout: 6000 });
  await assertMappingSane(page);
}

test.describe('MODEL.html draw + delete a wall', () => {
  test('two presses commit one wall, with every field the old page would write',
    async ({ page }) => {
      await seed(page);
      await openNewPage(page);
      expect(await wallsShown(page)).toEqual({ shown: 2, total: 2 });

      await page.locator('[data-draw-wall]').click();
      await tapAt(page, -4, 3);
      await tapAt(page, 4, 3);
      expect(await wallsShown(page)).toEqual({ shown: 3, total: 3 });

      await page.locator('[data-model-save]').click();
      await expect(page.locator('[data-model-save]')).toHaveText(/saved/i, { timeout: 6000 });

      const saved = await stored(page);
      const drawn = saved.walls.find(w => !['w-a', 'w-b'].includes(w.id));
      expect(drawn, 'a third wall reached the file').toBeTruthy();

      // The id comes off the persisted counter, and the counter MOVED.
      expect(drawn.id).toBe('wall-7');
      expect(saved.nextDrawingItemId).toBe(8);

      expect(drawn.levelId).toBe(MAIN_FL);
      expect(drawn.view).toBe('plan');
      expect(drawn.wallType).toBe('stud_2x6');
      expect(drawn.baseHeight).toBe(0);
      expect(drawn.topHeight).toBe(8);
      expect(drawn.refLine).toBe('left');
      // CONDITIONAL KEYS ARE NOT INVENTED. `auto: true` would make the old
      // page treat this as generated geometry (MODEL.dc.html:22218).
      expect('auto' in drawn).toBe(false);
      expect('body' in drawn).toBe(false);
    });

  test('a drawn endpoint on an existing corner SHARES it, so the join mitres',
    async ({ page }) => {
      await seed(page);
      await openNewPage(page);
      await page.locator('[data-draw-wall]').click();
      // Start on the shared corner of w-a and w-b.
      await tapAt(page, 0, 0);
      await tapAt(page, 0, 3);
      await page.locator('[data-model-save]').click();
      await expect(page.locator('[data-model-save]')).toHaveText(/saved/i, { timeout: 6000 });

      const saved = await stored(page);
      const drawn = saved.walls.find(w => w.id === 'wall-7');
      const corner = saved.walls.find(w => w.id === 'w-a').end;  // (0,0)
      // Saved points are plain values, so identity cannot be asserted through
      // the file — coincidence at the pool's own tolerance is what identity
      // LOOKS like once written, and a fresh unpooled object would not be
      // exact after the snap.
      expect(drawn.start.x).toBeCloseTo(corner.x, 9);
      expect(drawn.start.z).toBeCloseTo(corner.z, 9);
      // THE CONTROL: the far end is nowhere near it, so "both coincide" cannot
      // pass by the whole wall having collapsed.
      expect(Math.hypot(drawn.end.x - corner.x, drawn.end.z - corner.z)).toBeGreaterThan(1);
    });

  test('the shared corner is ONE object: moving it moves every wall that holds it',
    async ({ page }) => {
      await seed(page);
      await openNewPage(page);
      await page.locator('[data-draw-wall]').click();
      await tapAt(page, 0, 0);                       // start ON w-a/w-b's shared corner
      await tapAt(page, 0, 3);
      await page.locator('[data-draw-wall]').click();  // disarm; the wall stays selected

      // THIS IS WHAT THE COORDINATE CHECK COULD NOT SEE. cornerSnap already
      // puts a fresh, unpooled endpoint at exactly the corner's coordinates,
      // so coincidence in the saved file is satisfied either way — a mutation
      // replacing the pool with `{x, y, z}` copies passed every other test in
      // this file. Only MOVING the corner tells them apart: pooled, all three
      // walls travel with it; copied, the drawn wall leaves the other two
      // behind and the mitre becomes a butt joint with nothing red anywhere.
      const box = await page.locator('#plan').boundingBox();
      const scale = await scaleOf(page);
      const from = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
      await page.mouse.move(from.x, from.y);
      await page.mouse.down();
      await page.mouse.move(from.x + 2 * scale, from.y, { steps: 8 });
      await page.mouse.up();
      await page.waitForTimeout(80);

      await page.locator('[data-model-save]').click();
      await expect(page.locator('[data-model-save]')).toHaveText(/saved/i, { timeout: 6000 });

      const saved = await stored(page);
      const at = id => saved.walls.find(w => w.id === id);
      expect(at('wall-7').start.x, 'the dragged corner moved').toBeCloseTo(2, 4);
      expect(at('w-a').end.x, "w-a's end travelled with it").toBeCloseTo(2, 4);
      expect(at('w-b').start.x, "w-b's start travelled with it").toBeCloseTo(2, 4);
      // THE CONTROL: the far ends did not move, so "everything moved" cannot
      // pass by the whole drawing having been translated.
      expect(at('w-a').start.x).toBeCloseTo(-8, 4);
      expect(at('w-b').end.x).toBeCloseTo(8, 4);
    });

  test("a drawing that says 'centre' writes 'center'", async ({ page }) => {
    await seed(page, `d.wallRefLine = 'centre'; return d;`);
    await openNewPage(page);
    await page.locator('[data-draw-wall]').click();
    await tapAt(page, -4, 3);
    await tapAt(page, 4, 3);
    await page.locator('[data-model-save]').click();
    await expect(page.locator('[data-model-save]')).toHaveText(/saved/i, { timeout: 6000 });

    const drawn = (await stored(page)).walls.find(w => w.id === 'wall-7');
    // drawing-format.js:400 folds the British spelling on LOAD; this page has
    // no serializer, so a record written with 'centre' would reach the file
    // unvalidated and only the NEXT load would repair it — moving the wall
    // half an assembly thickness in between.
    expect(drawn.refLine).toBe('center');
  });

  test('FOUNDATION draws a foundation-set wall, not a stud one', async ({ page }) => {
    await seed(page);
    await page.goto(`/MODEL.html?level=${FOUNDATION}`);
    await expect(readout(page)).toContainText('FOUNDATION', { timeout: 6000 });
    await page.locator('[data-draw-wall]').click();
    await tapAt(page, -4, 3);
    await tapAt(page, 4, 3);
    await page.locator('[data-model-save]').click();
    await expect(page.locator('[data-model-save]')).toHaveText(/saved/i, { timeout: 6000 });

    const drawn = (await stored(page)).walls.find(w => w.id === 'wall-7');
    // The two type lists are DISJOINT, so this is not a near miss: picking the
    // plan default here is a wall of the wrong kind, silently.
    expect(drawn.wallType).toBe('concrete_8');
    expect(drawn.view).toBe('foundation');
    expect(drawn.levelId).toBe(FOUNDATION);
  });

  test('deleting a wall takes its door, its fixture and its group membership',
    async ({ page }) => {
      await seed(page);
      await openNewPage(page);
      await tapAt(page, -4, 0);                      // select w-a
      await expect(page.locator('[data-delete-wall]')).toBeVisible();
      await page.locator('[data-delete-wall]').click();
      expect(await wallsShown(page)).toEqual({ shown: 1, total: 1 });

      await page.locator('[data-model-save]').click();
      await expect(page.locator('[data-model-save]')).toHaveText(/saved/i, { timeout: 6000 });

      const saved = await stored(page);
      expect(saved.walls.map(w => w.id)).toEqual(['w-b']);
      // Neither validator checks that a host wall exists, so an orphan here
      // would be invisible and persistent — it survives every save, paints
      // nowhere, and returns the moment something is given the dead id.
      expect(saved.fenestrations).toEqual([]);
      // The tub anchors by endWallId as well; dropping only wallId leaves it.
      expect(saved.fixtures).toEqual([]);
      // A group of one is not a group.
      expect(saved.groups).toEqual([]);
    });

  test('undo takes back a create, including the corner it introduced',
    async ({ page }) => {
      await seed(page);
      await openNewPage(page);
      await page.locator('[data-draw-wall]').click();
      await tapAt(page, -4, 3);
      await tapAt(page, 4, 3);
      expect(await wallsShown(page)).toEqual({ shown: 3, total: 3 });

      await page.keyboard.press('Escape');           // leave draw mode
      await page.keyboard.press('Control+z');
      expect(await wallsShown(page)).toEqual({ shown: 2, total: 2 });

      await page.locator('[data-model-save]').click();
      await expect(page.locator('[data-model-save]')).toHaveText(/saved/i, { timeout: 6000 });
      expect((await stored(page)).walls.map(w => w.id).sort()).toEqual(['w-a', 'w-b']);
    });

  test('undo puts a deleted wall back WITH its dependents', async ({ page }) => {
    await seed(page);
    await openNewPage(page);
    await tapAt(page, -4, 0);
    await page.locator('[data-delete-wall]').click();
    expect(await wallsShown(page)).toEqual({ shown: 1, total: 1 });

    await page.keyboard.press('Control+z');
    expect(await wallsShown(page)).toEqual({ shown: 2, total: 2 });

    await page.locator('[data-model-save]').click();
    await expect(page.locator('[data-model-save]')).toHaveText(/saved/i, { timeout: 6000 });

    const saved = await stored(page);
    expect(saved.walls.map(w => w.id).sort()).toEqual(['w-a', 'w-b']);
    // An undo that restored the wall and not its door would leave the drawing
    // quietly poorer than before the delete — the failure this rung exists to
    // avoid, arriving by the back door.
    expect(saved.fenestrations.map(f => f.id)).toEqual(['d1']);
    expect(saved.fixtures.map(f => f.id)).toEqual(['fx1']);
    expect(saved.groups.map(g => g.id)).toEqual(['g1']);
  });

  test('after delete + undo the restored corner is POOLED again, so a new wall joins it',
    async ({ page }) => {
      await seed(page);
      await openNewPage(page);
      await tapAt(page, 4, 0);                       // select w-b
      await page.locator('[data-delete-wall]').click();
      await page.keyboard.press('Control+z');        // w-b is back
      expect(await wallsShown(page)).toEqual({ shown: 2, total: 2 });

      // THE MIRROR OF THE POOLING TEST, and the same class of defect.
      // deleteWall retires the corners no surviving wall holds; the restored
      // wall still HOLDS those objects, so identity on the wall survives — but
      // the pool is what the next drawn endpoint searches. Leave them out and
      // this draw mints a fresh object at the same coordinates: every number
      // right, the drawing right, the mitre silently gone.
      await page.locator('[data-draw-wall]').click();
      await tapAt(page, 8, 0);                       // onto w-b's restored free end
      await tapAt(page, 8, 3);
      await page.locator('[data-draw-wall]').click();  // disarm; new wall selected

      const box = await page.locator('#plan').boundingBox();
      const scale = await scaleOf(page);
      const from = { x: box.x + box.width / 2 + 8 * scale, y: box.y + box.height / 2 };
      await page.mouse.move(from.x, from.y);
      await page.mouse.down();
      await page.mouse.move(from.x - 2 * scale, from.y, { steps: 8 });
      await page.mouse.up();
      await page.waitForTimeout(80);

      await page.locator('[data-model-save]').click();
      await expect(page.locator('[data-model-save]')).toHaveText(/saved/i, { timeout: 6000 });

      const saved = await stored(page);
      // FOUR PLACES, NOT SIX, and measured rather than relaxed until green: a
      // drag lands on pixel boundaries and one pixel is 0.0145 ft here, so a
      // pixel-derived coordinate carries ~1e-6 ft of quantisation. Six places
      // asserts more precision than the input has; four is still 0.0006 of an
      // inch, far tighter than anything this rung could get wrong.
      const at = id => saved.walls.find(w => w.id === id);
      expect(at('wall-7').start.x, 'the dragged corner moved').toBeCloseTo(6, 4);
      expect(at('w-b').end.x, 'the restored wall travelled with it').toBeCloseTo(6, 4);
      // CONTROL: the other end stayed, so this is a shared corner and not a
      // whole-drawing translation.
      expect(at('w-b').start.x).toBeCloseTo(0, 4);
    });

  test('Escape cancels the pending wall AND the selection in one press, and keeps the tool',
    async ({ page }) => {
      await seed(page);
      await openNewPage(page);
      await page.locator('[data-draw-wall]').click();
      await tapAt(page, -4, 3);                       // a wall is pending
      await tapAt(page, 4, 3);                        // committed, chain live, wall selected
      await expect(page.locator('[data-delete-wall]')).toBeVisible();

      await page.keyboard.press('Escape');

      // MODEL.dc.html:22165-22172 does BOTH in one press — _cancelWall plus
      // _clearSelection — and does NOT put the tool down. A ladder that took
      // two presses to reach the selection, or that disarmed the tool, would
      // teach a drafter one habit on this page and cost them their tool on
      // the other.
      await expect(page.locator('[data-delete-wall]'), 'the selection went').toBeHidden();
      await expect(page.locator('[data-draw-wall]'), 'the tool stayed').toHaveClass(/armed/);

      // And the chain really is broken: the next two taps make ONE wall, not a
      // wall joined to the abandoned one.
      await tapAt(page, -4, -3);
      await tapAt(page, 4, -3);
      expect(await wallsShown(page)).toEqual({ shown: 4, total: 4 });
    });

  test('THE DELIVERABLE: the old page reopens the file without loss',
    async ({ page }) => {
      await seed(page);
      await openNewPage(page);
      await page.locator('[data-draw-wall]').click();
      await tapAt(page, -4, 3);
      await tapAt(page, 4, 3);
      // DISARM DELIBERATELY. The gesture CHAINS after a commit — the next wall
      // starts where the last one ended — so one Escape clears only the
      // pending start and leaves the mode armed. A tap then draws instead of
      // selecting, and the delete lands on the wrong wall. That is the page
      // behaving as designed; the test has to say which mode it wants.
      await page.locator('[data-draw-wall]').click();
      await expect(page.locator('[data-draw-wall]')).not.toHaveClass(/armed/);
      await tapAt(page, 4, 0);                      // select w-b
      await page.locator('[data-delete-wall]').click();
      await page.locator('[data-model-save]').click();
      await expect(page.locator('[data-model-save]')).toHaveText(/saved/i, { timeout: 6000 });
      const afterNew = await stored(page);

      // Reopen on the OLD page and let it load, normalise and re-serialise.
      await page.goto('/MODEL.dc.html');
      await page.waitForFunction(() => !!window.SharedFileStore, null, { timeout: 10000 });
      await page.waitForTimeout(1500);
      const afterOld = await stored(page);

      const ids = d => d.walls.map(w => w.id).sort();
      expect(ids(afterOld), 'the old page kept every wall the new page left')
        .toEqual(ids(afterNew));
      expect(ids(afterOld)).toEqual(['w-a', 'wall-7']);

      const drawnNew = afterNew.walls.find(w => w.id === 'wall-7');
      const drawnOld = afterOld.walls.find(w => w.id === 'wall-7');
      // Field for field on the wall this page invented: if any of them were
      // written in a shape the old page repairs on load, the two differ here.
      ['levelId', 'view', 'wallType', 'baseHeight', 'topHeight', 'refLine']
        .forEach(key => expect(drawnOld[key], `field ${key} survived`).toEqual(drawnNew[key]));
      expect(drawnOld.start.x).toBeCloseTo(drawnNew.start.x, 9);
      expect(drawnOld.end.z).toBeCloseTo(drawnNew.end.z, 9);

      // And the untouched wall is untouched.
      const keptNew = afterNew.walls.find(w => w.id === 'w-a');
      const keptOld = afterOld.walls.find(w => w.id === 'w-a');
      expect(keptOld.wallType).toBe(keptNew.wallType);
      expect(keptOld.refLine).toBe(keptNew.refLine);
    });
});
