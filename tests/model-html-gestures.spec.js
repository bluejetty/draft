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

  test('LAYER VIEW — the picker matches the level, and a visible one is never empty',
    async ({ page }) => {
      await seeded(page);

      // THIS TEST USED TO ASSERT THE PICKER HIDES ON ROOF AND SITE, and it
      // passed, and then #386 landed and it stopped being true — not because
      // the picker changed, but because those levels stopped being empty. The
      // cut-view seats put the four elevations (E1–E4) on EVERY level, so
      // ROOF and SITE now hold four views each and the picker legitimately
      // shows. Measured 12 Sep, after the rail:
      //
      //     SITE / ROOF        E1 · FRONT  E2 · LEFT  E3 · BACK  E4 · RIGHT
      //     MAIN FL / 2ND FL   + ELECTRIC, FLOOR PLAN (WALLS),
      //                          FLOOR LAYOUT (FLOOR), STAIR
      //     FOUNDATION         + ELECTRIC, BASEMENT (WALLS), FOUNDATION
      //
      // So the parity row's "hides itself on ROOF and SITE" is now a statement
      // about a page that no longer exists. Rather than delete the check or
      // freeze the old answer, it is rewritten to guard the two properties that
      // are still worth guarding and that no longer depend on which levels
      // happen to be bare:
      //
      //   1. A VISIBLE PICKER IS NEVER EMPTY. An empty visible picker and a
      //      hidden one read identically in prose and completely differently to
      //      a drafter.
      //   2. THE PICKER BELONGS TO THE LEVEL. A picker still holding the
      //      previous level's views would offer a layer set that does not
      //      exist on the level the drafter is on.
      const levels = await page.locator('#level-pick option')
        .evaluateAll(nodes => nodes.map(n => ({ value: n.value, label: n.textContent.trim() })));
      expect(levels.length, 'the level picker must offer levels to walk')
        .toBeGreaterThan(1);

      const seen = {};
      for (const level of levels) {
        await page.locator('#level-pick').selectOption(level.value);
        await expect(readout(page)).toContainText(level.label, { timeout: 6000 });
        const visible = await page.locator('#view-pick').isVisible();
        const options = await page.locator('#view-pick option')
          .evaluateAll(nodes => nodes.map(n => n.value));
        if (visible) {
          expect(options.length,
            `${level.label}: a visible layer-view picker must have something in `
            + 'it — an empty picker is worse than a hidden one').toBeGreaterThan(0);
          const shown = await page.locator('#view-pick').inputValue();
          expect(options.includes(shown),
            `${level.label}: the picker must be showing one of its own options, `
            + 'not a view carried over from the level before it').toBe(true);
        }
        seen[level.label] = options.length;
      }

      // AND THE LEVELS ARE NOT ALL THE SAME. If every level answered with an
      // identical list, both assertions above would pass on a picker that never
      // reads the level at all.
      expect(new Set(Object.values(seen)).size,
        'the levels must not all offer the same number of views, or this test '
        + 'cannot tell a level-aware picker from a fixed one').toBeGreaterThan(1);
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
      // SORTED, because this asks WHICH controls exist, not what order the DOM
      // happens to put them in. Order is a layout fact and would make the check
      // go red for a rearrangement that changes nothing a drafter can do.
      // THE PANEL'S OWN ROWS ARE EXCLUDED HERE AND CHECKED SEPARATELY BELOW,
      // and that is a change in shape rather than a loosening. The LEVELS /
      // LAYERS panel puts one row per level, one per layer view and one per
      // elevation on the page -- all DERIVED from drawing.levels and
      // layerViewsForLevelId, so the list would change with the fixture and
      // say nothing about a hidden control. What this list is for is the part
      // that must not grow without anyone noticing; the panel's contents are
      // asserted against the module in model-html-levels.spec.js, which is a
      // stronger claim than naming them here.
      const controls = await page.evaluate(() => {
        // THREE SURFACES ARE PARTITIONED OUT, all for one reason: each is
        // DERIVED, so naming its contents here would guard the fixture instead
        // of the control surface, and each is asserted exhaustively somewhere
        // stronger.
        //
        //   the LEVELS / LAYERS panel  -- rows from drawing.levels and
        //     layerViewsForLevelId; asserted in model-html-levels.spec.js
        //   the VIEW RAIL             -- the seating chart is derived now
        //     (four elevations, ROOF | SITE, a pair per level with layer
        //     views, then the sections); asserted against the old page's own
        //     chart in model-html-seats.spec.js
        //   the TOOL COLUMN           -- seventeen keys from tool-roster.js
        //     with the letters resolved through SETTINGS; asserted against
        //     the roster itself in model-tool-column.spec.js
        //
        // KEPT AS THREE PREDICATES rather than one widened `inPanel`, because
        // panelKinds below counts what the PANEL may hold and folding the rail
        // into that word would quietly change what it asserts.
        //
        // What this list is for is the part that must not grow without anyone
        // noticing, so the column is counted BY KIND: a context menu host or a
        // file input smuggled into the slot arrives as 'BUTTON' or 'INPUT' and
        // fails.
        const inPanel = el => el.closest('#levels-panel') !== null;
        const inRail = el => el.closest('#view-rail') !== null;
        const inTools = el => el.closest('#tool-slot') !== null;
        const outside = el => !inPanel(el) && !inRail(el) && !inTools(el);
        const toolKind = el => (el.dataset.toolKey !== undefined ? 'tool-key'
          : el.dataset.selMode !== undefined ? 'sel-mode'
            : el.dataset.selFilter !== undefined ? 'sel-filter'
              : el.dataset.assemblyStart !== undefined ? 'assembly-start'
                : el.dataset.assemblyUngroup !== undefined ? 'assembly-ungroup'
                  : el.dataset.assemblyFixed !== undefined ? 'assembly-fixed'
                    : el.dataset.assemblyLoose !== undefined ? 'assembly-loose'
                      : el.dataset.assemblyName !== undefined ? 'assembly-name'
                        : el.tagName.toLowerCase());
        return {
          buttons: [...document.querySelectorAll('button')].filter(outside)
            .map(b => b.id || b.textContent.trim()).sort(),
          selects: [...document.querySelectorAll('select')].filter(outside)
            .map(s => s.id).sort(),
          inputs: [...document.querySelectorAll('input')].filter(outside)
            .map(i => i.type).sort(),
          toolKinds: [...new Set([...document.querySelectorAll('#tool-slot *')]
            .filter(el => ['BUTTON', 'INPUT', 'SELECT'].includes(el.tagName))
            .map(toolKind))].sort(),
          // AND THE PANEL, counted rather than named: every control inside it
          // must be one of the four kinds it is allowed to hold. A context
          // menu host or a file input smuggled in there would fail this.
          // Every control in the rail is a seat, or this fails naming the tag.
          railKinds: [...new Set([...document.querySelectorAll('#view-rail *')]
            .filter(el => el.tagName === 'BUTTON' || el.tagName === 'INPUT'
              || el.tagName === 'SELECT')
            .map(el => (el.classList.contains('seat') ? 'seat' : el.tagName)))].sort(),
          panelKinds: [...new Set([...document.querySelectorAll('#levels-panel *')]
            .filter(el => el.tagName === 'BUTTON' || el.tagName === 'INPUT'
              || el.tagName === 'SELECT')
            .map(el => el.dataset.addLevel !== undefined ? 'add-level'
              : el.dataset.deleteLevel !== undefined ? 'delete-level'
                : el.dataset.deleteCut !== undefined ? 'delete-cut'
                  : el.dataset.layer !== undefined ? 'layer-row'
                    : el.dataset.levelRow !== undefined ? 'level-row'
                      : el.dataset.view3d !== undefined ? 'view-3d'
                        : el.tagName === 'BUTTON' ? 'cut-row' : el.tagName))].sort(),
        };
      });
      // THE SIX SEATS ARRIVED WHILE THIS PR WAS OPEN, and this assertion is how
      // that was noticed rather than merged past: it went red on the merge with
      // #386, naming the six buttons it had never seen. That is the check doing
      // exactly the job it was written for — a control that no parity row
      // mentions means a row is wrong.
      //
      // They are cut-view SEATS, not drawing verbs: each shows a section or an
      // elevation. No absence row below is affected, and the parity table now
      // carries a row for them.
      //
      // AND IT HAPPENED AGAIN, with the chrome shell: two sidebar tabs, three
      // house-type families and BONE. Same verdict for the tabs — a tab opens
      // a panel and draws nothing — but the four build controls needed
      // checking rather than waving through, because BUNGALOW looks exactly
      // like the BUILD HOUSE verb the table records as absent.
      //
      // AND A THIRD TIME, with the tool column -- seventeen keys, which is what
      // took this red on CI while every suite I had thought to run locally was
      // green. THE CHECK DID ITS JOB AND I DID NOT DO MINE: a change that adds
      // a control column is precisely the change this assertion exists to
      // notice, and it was not in the set I ran. Running the suites related to
      // the work is not the same as running the suites the work disturbs.
      //
      // The verdict for the keys themselves: none of them is a drawing verb
      // YET. A key sets `activeTool` and nothing else -- WALL is the only one
      // with a gesture behind it, and that gesture is the same `draw-wall`
      // this list already names, now driven through the register instead of a
      // boolean. So no absence row below changes; the parity table carries a
      // row for the column.
      //
      // IT IS NOT THAT VERB. The bar sits on a seam: it records which type was
      // chosen and something else, not yet built, decides what geometry that
      // produces. `model-html-topbar.spec.js` holds the wall count across a
      // family press, an entry press and BONE, so "Draw an outline — absent"
      // and every tool row below still stand. Four parity rows were wrong all
      // the same, and this check is why they were found: two of them describe
      // the control surface by listing it, and that list is no longer four
      // buttons and two selects.
      // AND A THIRD TIME, with the bottom instrument strip. Two instruments
      // (`strip-ruler`, `strip-tsquare`), one text input (the LENGTH box) and
      // six switch buttons in three pairs. They needed the same reading as
      // BUNGALOW did, because a RULER looks exactly like a drawing verb:
      //
      //   - THE RULER DRAWS NOTHING. It measures between two presses and
      //     writes no entity; model-html-strip.spec.js holds the wall count
      //     across a full measurement, which is what makes that a fact.
      //   - THE T-SQUARE IS A CONSTRAINT ON THE EXISTING draw-wall GESTURE,
      //     not a second way to make a wall. With it down the page draws the
      //     same off-square walls it always did.
      //   - THE LENGTH BOX COMMITS THROUGH draw-wall's own gesture: it is
      //     dead until a run is in hand, so it cannot start one.
      //   - TOY/DRAFTING, RUFF/ROUGH and NIGHT/DAY set board and skin state.
      //     They change what the page LOOKS like and what it remembers, and
      //     no absence row is about either.
      //
      // So every `absent` row below still stands. The list grows; the table
      // does not change.
      expect(controls,
        'the parity table\'s absences are only as good as this list — if a '
        + 'control appears here that no row mentions, a row is wrong')
        .toEqual({
          buttons: ['left-tab', 'right-tab',
            'BUNGALOW', 'BILEVEL', 'DETACHED GARAGE', 'bone',
            'delete-wall', 'draw-wall', 'save', 'take-over',
            'strip-ruler', 'strip-tsquare',
            'TOY', 'DRAFTING', 'RUFF', 'ROUGH', 'NIGHT', 'DAY'].sort(),
          selects: ['level-pick', 'view-pick'],
          // THE LENGTH BOX, and it is named as a type rather than an id
          // because what this row guards is a FILE INPUT appearing without
          // anyone noticing — the surface an INSERT UNDERLAY verb would need.
          inputs: ['text'],
          railKinds: ['seat'],
          // EVERY KIND THE PANEL MAY HOLD, and nothing else. No file input,
          // no unlabelled button: an entry this cannot name would arrive as
          // 'BUTTON' or 'INPUT' and fail.
          panelKinds: ['add-level', 'cut-row', 'delete-level', 'layer-row',
            'level-row', 'view-3d'].sort(),
          // The column's kinds. SELECTION's three modes and OBJECT TYPE's five
          // filters are named rather than counted for the same reason the keys
          // are not: a control the classifier cannot name arrives as 'button'
          // and fails, which is how the chips were noticed here in the first
          // place.
          //
          // AND THE ASSEMBLY NAME FIELD IS THE PAGE'S FIRST INPUT. That is why
          // it is named here rather than counted: `inputs` above is what the
          // INSERT UNDERLAY row rests on, and an input appearing anywhere on
          // this page has to be accounted for by someone. It is a text field
          // in the tool column, not a file picker -- the underlay row's own
          // check asserts `input[type=file]` is still zero, which is the
          // guarantee that row actually needs.
          toolKinds: ['assembly-fixed', 'assembly-loose', 'assembly-name',
            'assembly-start', 'assembly-ungroup',
            'sel-filter', 'sel-mode', 'tool-key'].sort(),
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
      // LET THE RAIL SETTLE FIRST. The readout carries `rail N ms`, which the
      // seat repaint writes when its pass finishes -- and since the seats now
      // paint ONE PER FRAME to keep the task short, that pass spans several
      // frames after load. Snapshotting mid-pass and comparing afterwards
      // compares two different moments of an instrument, not the effect of a
      // keypress: it read `rail 0.00 ms` before and `rail 35.20 ms` after,
      // and blamed the T-square. Wait for it to stop moving, then measure.
      await expect
        .poll(async () => (/rail ([\d.]+) ms/.exec(await readout(page).textContent()) || [])[1],
          { timeout: 5000 })
        .not.toBe('0.00');
      await page.waitForTimeout(200);
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

  test('LEVEL LOCKS and SOURCE LINKS — no verb, and the keys are re-emitted untouched',
    async ({ page }) => {
      // GROUPS LEFT THIS ROW. It used to read "LEVEL LOCKS, GROUPS and SOURCE
      // LINKS — no verb", and that stopped being true the moment ASSEMBLY and
      // UNGROUP landed in the tool column. The parity table's row moved from
      // absent to present with it.
      //
      // The carry-through assertion below still covers groups, and still
      // should: a page that HAS a verb must also hand back untouched the
      // groups nobody touched. What changed is the claim in the title, and
      // leaving that stale while quietly teaching the control census to accept
      // the new buttons would have been the exact failure the census exists to
      // prevent — a control on the page that no row mentions, silenced instead
      // of answered.
      //
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
      'locks have no verb and must come back exactly as they went in; groups '
      + 'now HAVE one, and must still come back untouched when it is not used')
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
