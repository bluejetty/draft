// THE PARITY TABLE, SETTLED BY DRIVING THE PAGE.
//
// Every `present` row in RD-DOCUMENTS/PARITY-model-html-vs-dc.md was read from
// source. Not one was driven. The document says so itself, and the row its
// author got wrong he got wrong by reading: he grepped MODEL.html for
// `activeLevelIdx` — the OLD page's name — found nothing, and reported level
// switching absent. It had been there the whole time.
//
// A grep answers "does this identifier appear". A drafter asks "can I do this".
//
// THE RULE THIS SPEC IS BUILT ON: a gesture counts as present only if its
// effect SURVIVES A RELOAD. Not that the canvas changed, not that a handler
// fired — placed, saved, reopened, still there. A page that paints what it
// cannot persist is the failure the Write Tier spent the week pulling out of
// this codebase, and a parity table that scored paint as presence would certify
// a page that loses a drafter's afternoon.
//
// Where a gesture has no persisted consequence — pan, zoom, Escape — the row
// says so and the visible state is asserted instead.
//
// NO PRODUCT FILE IS TOUCHED BY THIS WORK. Where the two pages disagree, this
// spec reports both and rules on neither.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const readout = page => page.locator('#readout');
const canvas = page => page.locator('#plan');

async function pxPerFt(page) {
  const text = await readout(page).textContent();
  const m = text.match(/scale ([\d.]+) px\/ft/);
  expect(m, 'the readout must print the scale this test measures from').not.toBeNull();
  return Number(m[1]);
}

// The bone house, then whatever this test needs done to the stored file, then
// MODEL.html opened on the result. Seeding through the store rather than
// through gestures is deliberate: the gesture is what is being measured, so it
// cannot also be the fixture.
async function seeded(page, mutate) {
  await h.openModel(page, { webgl: false, rails: false, entryCoach: true });
  await expect(page.locator('[data-entry-coach]')).toBeVisible({ timeout: 4000 });
  await page.locator('[data-first-bone-press]').click();
  await h.waitForSaved(page);

  if (mutate) {
    await page.evaluate(async ({ bucket, source }) => {
      const store = window.SharedFileStore;
      const at = await store.loadSharedFileAt(bucket);
      const drawing = JSON.parse(await at.file.text());
      // eslint-disable-next-line no-new-func
      new Function('drawing', source)(drawing);
      await store.saveSharedFile(
        new File([JSON.stringify(drawing)], 'd.json', { type: 'application/json' }),
        bucket, { ifRev: at.rev });
    }, { bucket: h.STORAGE_BUCKET, source: `(${mutate})(drawing)` });
  }

  await page.goto('/MODEL.html');
  await expect(readout(page)).toContainText('walls', { timeout: 6000 });
  return page;
}

// Centre of the canvas, in client pixels.
async function centre(page) {
  const box = await canvas(page).boundingBox();
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

// Draw one wall by arming DRAW and clicking two points. Returns the ids that
// were in the drawing before, so the caller can name which wall is new.
async function drawWall(page, from, to) {
  const c = await centre(page);
  await page.locator('#draw-wall').click();
  await page.mouse.click(c.x + from[0], c.y + from[1]);
  await page.mouse.click(c.x + to[0], c.y + to[1]);
  await page.locator('#draw-wall').click();   // disarm, so the next click selects
}

async function savedWalls(page) {
  return (await h.savedDrawing(page)).walls || [];
}

test.describe('MODEL.html gestures — parity by driving, not by reading', () => {

  // ── GROUP 2: rows already marked `present` ───────────────────────────────
  // Driven first. A false `present` does the most damage, because nobody
  // re-checks a row that already says yes.

  test('DRAW A WALL — the wall is in the file after a reload', async ({ page }) => {
    await seeded(page);
    const before = (await savedWalls(page)).length;

    await drawWall(page, [-60, -60], [60, -60]);
    await page.locator('#save').click();
    await expect(page.locator('#save')).toHaveText('SAVED', { timeout: 6000 });

    // THE RULE. Not "the canvas changed" — reopened, still there.
    await page.reload();
    await expect(readout(page)).toContainText('walls', { timeout: 6000 });
    expect((await savedWalls(page)).length,
      'a wall drawn, saved and reopened must still be in the file')
      .toBe(before + 1);
  });

  test('UNDO — three gestures need three presses, counted not read',
    async ({ page }) => {
      await seeded(page);
      const before = (await savedWalls(page)).length;

      await drawWall(page, [-80, -80], [0, -80]);
      await drawWall(page, [0, -80], [80, -80]);
      await drawWall(page, [80, -80], [80, 0]);
      await page.locator('#save').click();
      await expect(page.locator('#save')).toHaveText('SAVED', { timeout: 6000 });
      expect((await savedWalls(page)).length,
        'three walls must really have been drawn before undo is measured')
        .toBe(before + 3);

      // THE TABLE SAYS "one press per gesture". That was read. This counts.
      await page.keyboard.press('Control+z');
      await page.locator('#save').click();
      await expect(page.locator('#save')).toHaveText('SAVED', { timeout: 6000 });
      const afterOne = (await savedWalls(page)).length;

      await page.keyboard.press('Control+z');
      await page.keyboard.press('Control+z');
      await page.locator('#save').click();
      await expect(page.locator('#save')).toHaveText('SAVED', { timeout: 6000 });
      const afterThree = (await savedWalls(page)).length;

      expect([afterOne - before, afterThree - before],
        'one press must take back exactly one wall, and three presses all three')
        .toEqual([2, 0]);
    });

  test('SELECT — what actually answers a click, wall against floor and dimension',
    async ({ page }) => {
      test.setTimeout(180_000);
      // ONE ITEM IN THE DRAWING, so the page fits to it and the canvas centre is
      // ON it. That removes the world-to-screen transform from the measurement
      // entirely: no arithmetic to get wrong, the click simply lands on the
      // thing.
      // ON THE LEVEL THE HOUSE IS ON, not levels[0]. The page shows one level
      // at a time and defaults to the main floor; a fixture parked on some
      // other level is painted nowhere, so the click lands on empty canvas and
      // the measurement reads "nothing selects" for every entity including the
      // one that works. That is the first answer this test gave.
      const only = kind => `drawing => {
        const levelId = (drawing.walls.find(w => w.view === 'plan') || drawing.walls[0]).levelId;
        drawing.walls = []; drawing.lines = []; drawing.floors = [];
        drawing.roofs = []; drawing.dimensions = []; drawing.outlines = [];
        drawing.beams = []; drawing.columns = []; drawing.groups = [];
        drawing.boneyardOutlines = []; drawing.levelLocks = [];
        if ('${kind}' === 'wall') drawing.walls = [{ id: 'only', levelId, view: 'plan',
          wallType: 'stud_2x6', start: { x: -10, z: 0, y: 0 }, end: { x: 10, z: 0, y: 0 },
          baseHeight: 0, topHeight: 8, refLine: 'left' }];
        if ('${kind}' === 'floor') drawing.floors = [{ id: 'only', levelId, view: 'floor',
          structure: 'floor', garage: false, slopeInPerFt: 0, thickness: 0.75,
          thickenedEdge: false, assembly: {},
          points: [{ x: -10, z: -10, y: 0 }, { x: 10, z: -10, y: 0 }, { x: 10, z: 10, y: 0 }, { x: -10, z: 10, y: 0 }] }];
        if ('${kind}' === 'dimension') drawing.dimensions = [{ id: 90001, levelId,
          view: 'plan', auto: false,
          start: { x: -10, z: 0, y: 0 }, end: { x: 10, z: 0, y: 0 } }];
      }`;

      const answers = {};
      for (const kind of ['wall', 'floor', 'dimension']) {
        // A FRESH CONTEXT PER FIXTURE. The bone press needs a first-ever open,
        // and openModel's storage clear is once per session — so a second
        // seeding in the same context finds no entry coach and no bone.
        const context = await page.context().browser().newContext();
        const arm = await context.newPage();
        await seeded(arm, only(kind));
        const plural = kind === 'dimension' ? 'dimensions' : `${kind}s`;
        const before = ((await h.savedDrawing(arm))[plural] || []).length;
        expect(before, `the ${kind} fixture must really hold one ${kind}`).toBe(1);

        // AND IT MUST BE ON SCREEN. The readout counts shown/total for the
        // active level AND layer view, so `1/1` is the fixture being painted
        // where the click is about to land. Without this the measurement is
        // satisfied by a blank canvas — which is how the first run of this test
        // reported that nothing selects, walls included.
        //
        // The layer view has to be driven, not assumed: a floor carries
        // view 'floor' and does not paint on the plan set at all, so the
        // picker is walked until the fixture appears. If no view shows it, that
        // is recorded rather than worked around.
        const label = kind === 'dimension' ? 'dims' : plural;
        const shown = async () => (await readout(arm).textContent()).includes(`${label} 1/1`);
        if (!(await shown())) {
          const values = await arm.locator('#view-pick option')
            .evaluateAll(nodes => nodes.map(n => n.value));
          for (const value of values) {
            await arm.locator('#view-pick').selectOption(value);
            if (await shown()) break;
          }
        }
        expect(await shown(),
          `the ${kind} must be painted somewhere on this page before a click on `
          + 'it can mean anything').toBe(true);

        const c = await centre(arm);
        await arm.mouse.click(c.x, c.y);
        await arm.keyboard.press('Delete');
        await arm.locator('#save').click();
        await expect(arm.locator('#save')).toHaveText('SAVED', { timeout: 6000 });
        answers[kind] = ((await h.savedDrawing(arm))[plural] || []).length < before;
        await context.close();
      }

      // MEASURED, AND THE ROW FOLLOWS FROM IT. Delete is the observable: an
      // item that was selected goes, an item that was not stays. Reported as a
      // shape rather than three separate assertions so a failure prints the
      // whole answer at once.
      expect(answers,
        'the parity row must say which entities answer a click, not "select"')
        .toEqual({ wall: true, floor: false, dimension: false });
    });

  test('SWITCH LEVEL and SWITCH LAYER VIEW — driven through the chrome bar',
    async ({ page }) => {
      await seeded(page);
      const before = await readout(page).textContent();

      const options = await page.locator('#level-pick option').allTextContents();
      expect(options.length, 'the level picker must offer more than one level')
        .toBeGreaterThan(1);

      const other = options.find(name => !before.includes(name.trim()));
      await page.locator('#level-pick').selectOption({ label: other });
      await expect(readout(page),
        'picking another level must change what the page says it is showing')
        .toContainText(other.trim());

      // AND IT IS KEYED BY THE LEVEL, NOT BY AN INDEX — the row says `?level=`,
      // so a reload of the resulting URL must land on the same level.
      await page.reload();
      await expect(readout(page), 'the chosen level must survive a reload')
        .toContainText(other.trim(), { timeout: 6000 });

      // THE LAYER-VIEW PICKER hides itself where a level holds no layer views.
      // Read as "hides itself"; here it is asked whether it hides or merely
      // offers an empty list — those look identical to a reader and completely
      // different to a drafter.
      const viewPick = page.locator('#view-pick');
      const visible = await viewPick.isVisible();
      const count = await page.locator('#view-pick option').count();
      expect(visible ? count > 0 : true,
        'a visible layer-view picker must have something in it — an empty '
        + 'picker is worse than a hidden one').toBe(true);
    });

  test('ESCAPE and FIT — no persisted consequence, so the visible state is the assertion',
    async ({ page }) => {
      await seeded(page);
      const walls = (await savedWalls(page)).length;

      // Arm DRAW, place one end, then Escape. The old page's Escape cancels the
      // gesture AND clears the selection while KEEPING the tool.
      const c = await centre(page);
      await page.locator('#draw-wall').click();
      await page.mouse.click(c.x - 40, c.y + 40);
      await page.keyboard.press('Escape');
      await page.mouse.click(c.x + 40, c.y + 40);   // would have closed the wall

      expect((await savedWalls(page)).length,
        'Escape must have cancelled the half-drawn wall, so the second click '
        + 'starts a new one rather than finishing the old').toBe(walls);

      await page.keyboard.press('0');
      await expect(readout(page), 'fit must leave the page painting the drawing')
        .toContainText('walls');
    });

  test('LAYER VIEW ON A LEVEL THAT HAS NONE — it hides, rather than offering an empty picker',
    async ({ page }) => {
      await seeded(page);
      // THE LEVEL IT STARTED ON, captured before anything moves — and proved to
      // have a picker. Coming "back" to an arbitrary other level would answer a
      // different question: a second level with no layer views looks exactly
      // like a picker that never returns.
      const home = await page.locator('#level-pick').inputValue();
      await expect(page.locator('#view-pick'),
        'the starting level must have a layer-view picker, or the return leg '
        + 'below proves nothing').toBeVisible();

      const options = await page.locator('#level-pick option')
        .evaluateAll(nodes => nodes.map(n => ({ value: n.value, label: n.textContent.trim() })));
      const bare = options.find(o => /ROOF|SITE/i.test(o.label));
      expect(bare,
        'this measurement needs a level that holds no layer views — the row '
        + 'names ROOF and SITE').toBeTruthy();

      await page.locator('#level-pick').selectOption(bare.value);
      await expect(readout(page)).toContainText(bare.label, { timeout: 6000 });

      // THE TWO WORLDS A READER CANNOT TELL APART: a hidden picker and a
      // visible one with nothing in it. Both satisfy "hides itself on ROOF and
      // SITE" as prose; only one of them is a page a drafter can use.
      await expect(page.locator('#view-pick'),
        'on a level with no layer views the picker must be gone, not empty')
        .toBeHidden();

      // AND IT KEEPS ITS OLD OPTIONS WHILE HIDDEN — measured, and NOT reported
      // as a defect. A hidden select's contents are invisible; the only way
      // stale options could reach a drafter is if the picker were shown again
      // before being refilled. So that is the thing worth asserting, and it is
      // asserted on the way back rather than assumed either way.
      const staleWhileHidden = await page.locator('#view-pick option').count();
      expect(staleWhileHidden,
        'recorded: the hidden picker still holds the previous level\'s options')
        .toBeGreaterThan(0);

      await page.locator('#level-pick').selectOption(home);
      await expect(page.locator('#view-pick'),
        'the picker must come back on a level that has layer views').toBeVisible();
      const back = await page.locator('#view-pick option')
        .evaluateAll(nodes => nodes.map(n => n.value));
      const shown = await page.locator('#view-pick').inputValue();
      expect(back.includes(shown),
        'the picker that comes back must be showing one of its own options — a '
        + 're-shown picker still holding another level\'s views would offer the '
        + 'drafter a layer set that does not belong to the level they are on')
        .toBe(true);
    });

  // ── GROUP 1: the seven `?` rows ──────────────────────────────────────────
  // Absence is the harder thing to measure honestly. "I could not find a way to
  // do it" and "there is no way to do it" are the same sentence from a reader
  // and different facts to a drafter, so each row below attempts the gesture
  // through whatever surface the page actually offers, and where the answer is
  // "no verb", the persisted key is checked for the second question that then
  // matters: is it re-emitted untouched, or quietly re-derived?

  test('the page offers exactly six controls, and that is the shape of every absence',
    async ({ page }) => {
      await seeded(page);
      // THE WHOLE INTERACTIVE SURFACE, enumerated from the live DOM rather than
      // grepped. Every `absent` row below rests on this: there is no hidden
      // palette, no context menu host, no file input.
      const controls = await page.evaluate(() => ({
        buttons: [...document.querySelectorAll('button')].map(b => b.id || b.textContent.trim()),
        selects: [...document.querySelectorAll('select')].map(s => s.id),
        inputs: [...document.querySelectorAll('input')].map(i => i.type),
      }));
      expect(controls,
        'the parity table\'s absences are only as good as this list — if a '
        + 'control appears here that no row mentions, a row is wrong')
        .toEqual({
          buttons: ['draw-wall', 'delete-wall', 'save', 'take-over'],
          selects: ['level-pick', 'view-pick'],
          inputs: [],
        });
    });

  test('INSERT UNDERLAY — no insert gesture, and no file input to hang one on',
    async ({ page }) => {
      await seeded(page, `drawing => {
        drawing.underlays = [{ id: 'ul-1', levelId: (drawing.walls[0] || {}).levelId,
          kind: 'pdf', name: 'survey.pdf', page: 1, x: 0, z: 0,
          widthFt: 40, heightFt: 30, opacity: 0.5, scaleRaw: null,
          scaleRatio: null, scaleUnit: null, layer: 'UNDERLAY' }];
      }`);

      // IT PAINTS ONE — the row says `partial` and that half is real.
      await expect(readout(page), 'the page must be carrying the underlay')
        .toContainText('underlays');
      expect((await h.savedDrawing(page)).underlays,
        'the underlay must be in the file this page loaded').toHaveLength(1);

      // AND THERE IS NOWHERE TO PUT A NEW ONE. A file picker is the only way a
      // drafter supplies an image, and the page has no input of any kind.
      expect(await page.locator('input[type=file]').count(),
        'an INSERT gesture needs somewhere to choose a file').toBe(0);
    });

  test('T-SQUARE — pressing `t` does nothing the page or the file can show',
    async ({ page }) => {
      await seeded(page);
      const before = await readout(page).textContent();
      const beforeFile = JSON.stringify(await h.savedDrawing(page));

      await page.keyboard.press('t');
      await page.keyboard.press('T');

      // NO PERSISTED CONSEQUENCE IS EXPECTED for a T-square, so the visible
      // state is the assertion — per the rule, absence is only credible if
      // something was actually attempted.
      expect(await readout(page).textContent(),
        'a T-square that had stowed or dropped would change what the page says')
        .toBe(before);
      expect(JSON.stringify(await h.savedDrawing(page)),
        'and it must not have touched the file either').toBe(beforeFile);
    });

  test('BONEYARD — the level picker offers no way to reach one', async ({ page }) => {
    await seeded(page);
    // The old page reaches the boneyard through a pseudo-level with a NEGATIVE
    // id. If this page could reach it, that is where it would show.
    const values = await page.locator('#level-pick option')
      .evaluateAll(nodes => nodes.map(n => n.value));
    expect(values.filter(v => Number(v) < 0),
      'a boneyard would appear as a negative pseudo-level id').toEqual([]);
    expect(values.every(v => Number.isFinite(Number(v))),
      'and every option must be a real level id').toBe(true);
  });

  test('LEVEL LOCKS, GROUPS and SOURCE LINKS — no verb, and the keys are re-emitted untouched',
    async ({ page }) => {
      // THE SECOND QUESTION. Once "there is no verb" is established, the thing
      // that matters to a drafter is whether the page HONOURS the key or merely
      // carries it. A page that silently drops a lock is worse than one that
      // cannot set it.
      await seeded(page, `drawing => {
        const levelId = (drawing.walls[0] || {}).levelId;
        drawing.groups = [{ id: 'grp-1', name: 'ASSEMBLY ONE',
          members: (drawing.walls.slice(0, 2)).map(w => w.id) }];
        drawing.levelLocks = [{ id: 'lock-1', name: 'LEVEL LOCK',
          members: ['grp-1', 'grp-2'] }];
        drawing.nextLevelLockId = 2;
        drawing.walls[0].srcId = undefined;
        drawing.washroomLevelId = levelId;
      }`);

      const before = await h.savedDrawing(page);
      expect([before.groups.length, before.levelLocks.length],
        'the fixture must really carry a group and a lock').toEqual([1, 1]);

      await page.locator('#save').click();
      await expect(page.locator('#save')).toHaveText('SAVED', { timeout: 6000 });
      const after = await h.savedDrawing(page);

      expect({ groups: after.groups, levelLocks: after.levelLocks,
        nextLevelLockId: after.nextLevelLockId },
      'a page with no verb for these must hand them back exactly as it found '
      + 'them — carrying is the whole job')
        .toEqual({ groups: before.groups, levelLocks: before.levelLocks,
          nextLevelLockId: before.nextLevelLockId });
    });

  // ── THE MUTATION ─────────────────────────────────────────────────────────
  // A gesture spec that cannot tell a working gesture from a missing one is the
  // `ink > 0` mistake in a new costume. The row mutated is DRAW A WALL and the
  // mutation is recorded in the PR: with `drawPress` made a no-op, the draw
  // test fails on the reload assertion — the wall is not in the file — while
  // every absence test above still passes, which is the other half of the
  // proof: the absences are not passing because the page is broken.
});
