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
  await h.armWall(page);
  await page.mouse.click(c.x + from[0], c.y + from[1]);
  await page.mouse.click(c.x + to[0], c.y + to[1]);
  await h.disarmWall(page);   // so the next click selects
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
          const levelId = await h.modelLevelId(arm);
          for (const view of await h.modelLayerIds(arm, levelId)) {
            await h.pickModelLayer(arm, levelId, view);
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
      //
      // THE FLOOR ANSWERS NOW, and the row moved for a real reason rather
      // than a drifting fixture: DELETE used to be `delete-wall` and could
      // only take a wall, so a floor that WAS selected read as unselectable
      // through this measurement. The shell's one generic DELETE removes
      // whatever is selected, so the click a floor always answered finally
      // shows. A dimension still answers nothing.
      expect(answers,
        'the parity row must say which entities answer a click, not "select"')
        .toEqual({ wall: true, floor: true, dimension: false });
    });

  test('SWITCH LEVEL and SWITCH LAYER VIEW — driven through the levels panel',
    async ({ page }) => {
      await seeded(page);
      const before = await readout(page).textContent();

      // THE TWO SELECTS ARE GONE with the chrome bar the shell replaced; the
      // panel's own rows are the way to change level and layer now, which is
      // what these helpers drive. The claim is unchanged -- the page must
      // follow the choice, and the choice must survive a reload.
      await h.openModelRail(page);
      const ids = await page.locator('[data-level-row]')
        .evaluateAll(nodes => nodes.map(n => ({
          id: Number(n.dataset.levelRow), name: n.textContent.trim(),
        })));
      expect(ids.length, 'the panel must offer more than one level')
        .toBeGreaterThan(1);

      const other = ids.find(level => !before.includes(level.name));
      await h.pickModelLevel(page, other.id);
      await expect(readout(page),
        'picking another level must change what the page says it is showing')
        .toContainText(other.name);

      // AND IT IS KEYED BY THE LEVEL, NOT BY AN INDEX — the row says `?level=`,
      // so a reload of the resulting URL must land on the same level.
      await page.reload();
      await expect(readout(page), 'the chosen level must survive a reload')
        .toContainText(other.name, { timeout: 6000 });

      // AND THE LAYER ROWS BELONG TO THE LEVEL. A level with no layer views
      // shows no rows rather than an empty list -- the same claim the hidden
      // picker carried, now made of the rows themselves.
      await h.openModelRail(page);
      const rows = await h.modelLayerIds(page, other.id);
      const lit = page.locator(`[data-layer^="${other.id}:"][data-active]`);
      expect(rows.length ? await lit.count() : 0,
        'a level that offers layer rows must show which one is live')
        .toBe(rows.length ? 1 : 0);
    });

  test('ESCAPE and FIT — no persisted consequence, so the visible state is the assertion',
    async ({ page }) => {
      await seeded(page);
      const walls = (await savedWalls(page)).length;

      // Arm DRAW, place one end, then Escape. The old page's Escape cancels the
      // gesture AND clears the selection while KEEPING the tool.
      const c = await centre(page);
      await h.armWall(page);
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
      //
      // AND THE PICKER ITSELF IS GONE — the shell took the chrome bar with it
      // and the panel's layer rows are what a drafter presses now. Both
      // properties survive the move word for word: a level either shows rows
      // or shows none, and the lit row belongs to the level being stood on.
      await h.openModelRail(page);
      const levels = await page.locator('[data-level-row]')
        .evaluateAll(nodes => nodes.map(n => ({
          value: Number(n.dataset.levelRow), label: n.textContent.trim(),
        })));
      expect(levels.length, 'the panel must offer levels to walk')
        .toBeGreaterThan(1);

      const seen = {};
      for (const level of levels) {
        await h.pickModelLevel(page, level.value);
        await expect(readout(page)).toContainText(level.label, { timeout: 6000 });
        await h.openModelRail(page);
        const options = await h.modelLayerIds(page, level.value);
        if (options.length) {
          const lit = await page.locator(`[data-layer^="${level.value}:"][data-active]`)
            .evaluateAll(nodes => nodes.map(n => n.dataset.layer.split(':')[1]));
          expect(lit.length,
            `${level.label}: a level with layer rows must show exactly one lit`)
            .toBe(1);
          expect(options.includes(lit[0]),
            `${level.label}: the lit row must be one of this level's own, `
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
                        : el.dataset.levelLock !== undefined ? 'level-lock'
                          : el.dataset.levelLockBreak !== undefined ? 'level-lock-break'
                            : el.tagName.toLowerCase());
        return {
          buttons: [...document.querySelectorAll('button')].filter(outside)
            .map(b => b.id || b.textContent.trim()).sort(),
          anchors: [...document.querySelectorAll('a')].filter(outside)
            .map(a => a.textContent.trim()).sort(),
          selects: [...document.querySelectorAll('select')].filter(outside)
            .map(s => s.id).sort(),
          // NAMED, NOT COUNTED BY TYPE. This read `i.type`, so every text
          // box in the page arrived as the word 'text' and the list was
          // three indistinguishable entries: a control swapped for another
          // of the same type moved nothing, and only a change in the COUNT
          // was ever visible. `buttons` above already reads `id || text`,
          // so this is the file's own convention rather than a new idea --
          // and every input on the page has an id.
          inputs: [...document.querySelectorAll('input')].filter(outside)
            .map(i => i.id || i.type).sort(),
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
                      // THE BONEYARD'S TWO, named rather than absorbed. They
                      // arrived with the shelf UI and this check stayed GREEN
                      // through it: the fallback below turns any unnamed
                      // button into 'cut-row', so three new kinds of control
                      // entered the panel and the list that exists to notice
                      // exactly that did not move.
                      //
                      // THE COMMENT ON THE EXPECTED LIST SAYS THE OPPOSITE --
                      // "no unlabelled button: an entry this cannot name
                      // would arrive as 'BUTTON' or 'INPUT' and fail" -- and
                      // for the TOOL COLUMN's classifier below that is true
                      // and is how its chips were caught. For the panel it is
                      // not: `? 'cut-row'` is the same idea with the safety
                      // off. Naming what can be named shrinks what the
                      // fallback can swallow; giving a cut row its own marker
                      // so the fallback could fail loudly is a change of its
                      // own and is not smuggled in here.
                      : el.dataset.addShelf !== undefined ? 'add-shelf'
                        : el.dataset.shelf !== undefined ? 'shelf-row'
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
      //   - AND SO IS THE FOOT LIGHT (`strip-scale`), for the same reason and
      //     with the same reading. It arrived as a third instrument and this
      //     check is how that was noticed rather than merged past: it went red
      //     naming a button no parity row mentioned, which is exactly the job
      //     it says it is for.
      //
      //     It constrains two EXISTING gestures -- the draw and the wall drag
      //     -- to land on the whole foot in DRAFTING, and adds neither a verb
      //     nor an entity. Unlit, which is how every page that has never been
      //     touched opens, both gestures behave precisely as they did before
      //     it existed. So no absence row changes: the old page has no such
      //     instrument and this one draws nothing the old page could not.
      //   - THE LENGTH BOX COMMITS THROUGH draw-wall's own gesture: it is
      //     dead until a run is in hand, so it cannot start one.
      //   - TOY/DRAFTING, RUFF/ROUGH and NIGHT/DAY set board and skin state.
      //     They change what the page LOOKS like and what it remembers, and
      //     no absence row is about either.
      //   - CONTINUE and STAY IN TOY are the promotion confirm's two answers.
      //     The dialog is raised by typing a length on the TOY board and it
      //     asks one question about the BOARD; Continue moves the drawing to
      //     DRAFTING and lets the length it interrupted commit through
      //     draw-wall's own gesture, and Stay in TOY does nothing at all.
      //     Neither is a way to make anything, so neither touches a row.
      //   - BREAK HERE and MOVE THIS WALL are §4's two answers, raised by
      //     clicking a wall that is already selected on the TOY board. BREAK
      //     HERE puts a joint in an existing bone at a foot mark; MOVE THIS
      //     WALL does nothing at all, and the move it names is the drag that
      //     was already there. So neither MAKES anything either, and no
      //     absence row is about either.
      //
      // So every `absent` row below still stands. The list grows; the table
      // does not change.
      expect(controls,
        'the parity table\'s absences are only as good as this list — if a '
        + 'control appears here that no row mentions, a row is wrong')
        .toEqual({
          //
          // AND A FOURTH TIME, with the chrome shell proper. The file row
          // (NEW / OPEN / SAVE AS and the extension select), the page row's
          // two dark destinations, the unsaved guard's three answers and the
          // SAVE AS card's two. Read the same way as the rest: NEW and OPEN
          // REPLACE the drawing and SAVE AS writes the one in hand -- none of
          // them MAKES an entity, so no absence row moves. `draw-wall` and
          // `delete-wall` are gone from this list because the shell took the
          // bar they sat in: WALL is a key in the column now, and DELETE is
          // one generic verb (`delete`) rather than a wall-only one.
          //
          // AND A FIFTH TIME, with the dashboard (Movie, 15 Sep). UNITS is a
          // reading, not a making -- it changes the numbers the drafter is
          // shown and the unit the file records, and moves no point -- so no
          // absence row moves. The drive-thru presses are the house menu's
          // door: the foot's `bone` raises Gruff's sign, `dt-close` drops
          // it, and `dt-bone` is the SECOND bone, on the post. It fires the
          // same seam the foot's bone does, and the seam's own suite asserts
          // both draw nothing -- so BUILD HOUSE stays absent, twice over.
          //
          // `dt-open` AND `outline` LEFT WITH MOVIE'S 16 Sep ruling ("remove
          // the two house buttons and keep the BONE button just go to the
          // drivethru"): both were doors to the same board the bone opens,
          // so their departure retires two entries and adds none.
          //
          // COPY and PASTE joined this page with the boneyard's cross-workspace
          // clipboard and were NOT declared here at the time -- my own commit,
          // and the same omission #401 caught in the drive-thru series for
          // OUTLINE. It sat undetected because that work ran the boneyard spec
          // and not this one; the census found it the moment anything else
          // touched the list. Declared now rather than after a third one.
          buttons: ['left-tab', 'right-tab',
            'BUNGALOW', 'BILEVEL', 'DETACHED GARAGE', 'bone',
            'copy', 'paste',
            'delete', 'save', 'take-over',
            'file-new', 'file-open', 'file-save-as',
            'REAL ESTATE LAYOUT', 'ESTIMATES',
            // UNITS IS TWO BUTTONS NOW, not one naming the unit in force
            // (Movie, 15 Sep). They carry no id, so the census sees them by
            // their faces. Neither authors an entity: they change how a
            // length is READ, which is why no absence row moves.
            'IMPERIAL', 'METRIC',
            // The previews tab, the second of the right edge's two.
            'previews-tab',
            'dt-close', 'dt-bone',
            // PRINTSCREEN PRINTS THE SCREEN, and that is the whole of it: a
            // three-page presentation made from pictures the page has
            // already painted -- this view, the whole plan, the rail's
            // tiles -- each marked NOT TO SCALE. It authors no entity and
            // moves no point, so no absence row changes; in particular this
            // is NOT the print path the boneyard's non-printing rule needs,
            // which still belongs to the layout sheet.
            'printscreen',
            // AND A SIXTH TIME, with the PROPERTIES box (Movie, 19 Sep: "i'm
            // thinking add a collapsable box on the left side under the
            // DRAFTING TOOLS"). This is its FOLD -- one button that shows and
            // hides what is already in the box. It authors nothing and reads
            // nothing; it is the same kind of control as `readout-tab`.
            //
            // WHAT THE BOX HOLDS DOES MOVE A ROW, and the row moved: "Change
            // a wall's type" was `absent` and is not any more. The chips and
            // fields inside are not in this list because the census runs on
            // an untouched page, where nothing is selected and the box is
            // empty -- which is worth knowing about this check's reach
            // rather than worth fixing, since a control that only exists
            // once something is selected is not part of "what the page
            // offers" in the sense the absences are read against.
            'PROPERTIES',
            'strip-ruler', 'strip-tsquare', 'strip-scale',
            // THE READOUT IS A WORD UNTIL IT IS ASKED FOR (Movie, 15 Sep), so
            // the counts that used to sit open at the foot are behind two
            // presses now: `readout-tab` shows them and `readout-close` puts
            // them away. Both only SHOW what the page already counted, so no
            // absence row moves.
            'readout-tab', 'readout-close',
            'TOY', 'DRAFTING', 'RUFF', 'ROUGH', 'NIGHT', 'DAY',
            'Continue', 'Stay in TOY',
            'Break here', 'Move this wall',
            // THE BONE'S SECOND PRESS (Movie, 19 Sep): "on 2nd always offer
            // choice between drivetrhu or house build". Two answers to one
            // question, like every other card on this page -- and neither
            // is a new way to make anything. CHANGE IT opens the board the
            // bone already opens; BUILD IT fires the seam the bone already
            // fires. So no absence row moves.
            'Change it', 'Build it',
            'Save first', 'Discard', 'Cancel',   // the unsaved guard
            'Save', 'Cancel'].sort(),           // the SAVE AS card
          // THE PAGE ROW'S LIVE DESTINATIONS. Links, not buttons, so they
          // would have slipped past the button census entirely -- and a
          // navigation control that draws nothing is still a control this
          // list has to account for.
          // SETTINGS and STANDARDS join them: destinations in the top bar,
          // and links for the same reason PROJECT is one.
          // AND THE DRIVE-THRU'S QUIET WAY OUT (Movie, 19 Sep). It is a
          // DESTINATION, which is why it is an anchor and not a button --
          // the page row already teaches that a place you go is a link. It
          // draws nothing and builds nothing, so no absence row moves; the
          // board's own check measures the thing Movie actually asked for,
          // which is that it stays quieter than the line above it.
          //
          // CONSTRUCTION DETAILS, NOT PROPERTIES, and that distinction is
          // now a ruling rather than a wording choice -- Movie, same day:
          // "properties is associated with the OBJECTS, the house
          // Construction Details is more appropriate name for the PROJECT
          // information". RD-DOCUMENTS/DEFINITIONS.md carries it.
          anchors: ['PROJECT', 'CONSTRUCTION LAYOUT', 'SPECIFICATIONS',
            'SETTINGS', 'STANDARDS',
            'CLICK HERE TO GO OVER THE CONSTRUCTION DETAILS / SECTIONS FOR YOUR PROJECT',
          ].sort(),
          selects: ['file-ext'],
          // THE LENGTH BOX and the SAVE AS name, plus ONE file input -- the
          // drawing picker OPEN hangs on. It is named here rather than
          // counted because this row is what the INSERT UNDERLAY absence
          // rests on; that row's own check asserts the picker takes drawings
          // and not images.
          // AND THE GARAGE'S TWO FIGURES (Movie, 15 Sep: "allow them to
          // enter the size... or 4th option allow them to enter ___FT X
          // ___FT"). They sit on the drive-thru board beside three stock
          // sizes, and they are a SIZE, not a verb: the order carries the
          // pair to the same onOrder seam nothing listens on yet, and the
          // board still authors no entity. So no absence row moves -- but
          // they are named here because this census counts every input in
          // the page whether its board is up or not.
          //
          // The three stock chips are absent from `buttons` above for a
          // real reason rather than an oversight: they exist only while a
          // detached garage entry is chosen, and nothing is chosen at rest.
          // THE ANGLE BOX IS THE SIXTH (Movie, 15 Sep: "we should have a
          // angle textbox actually"). It is TEXT and not number for the
          // reason the length box is: a bearing is typed the way a drafter
          // says it, not spun. It turns the run in hand and authors nothing
          // the length box does not already author.
          //
          // It arrived undeclared -- this
          // check went red naming one more 'text' than the list held, which
          // is the job it advertises. It is the LENGTH box's twin: dead
          // until a run is in hand, so it cannot START one, and it commits
          // through draw-wall's own gesture exactly as the length box does.
          // It authors no entity and moves no point, so no absence row
          // changes.
          inputs: ['size-w', 'size-d', 'frozen-length', 'frozen-angle',
            'file-input', 'save-as-name'].sort(),
          railKinds: ['seat'],
          // EVERY KIND THE PANEL MAY HOLD, and nothing else. No file input,
          // no unlabelled button: an entry this cannot name would arrive as
          // 'BUTTON' or 'INPUT' and fail.
          panelKinds: ['add-level', 'cut-row', 'delete-level', 'layer-row',
            'level-row', 'add-shelf', 'shelf-row'].sort(),
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
          // LEVEL LOCK AND BREAK LOCK are the two verbs the level-lock port
          // added, and they are DECLARED here rather than found here later.
          // This list is the reason #401 caught OUTLINE arriving undeclared,
          // and the order for this port says the control goes in it in the
          // same commit for exactly that reason.
          //
          // They live beside ASSEMBLY rather than in the LEVELS panel: a lock
          // is made FROM assemblies, and the assemblies are what the drafter
          // has in his hand when he wants one.
          toolKinds: ['assembly-fixed', 'assembly-loose', 'assembly-name',
            'assembly-start', 'assembly-ungroup',
            'level-lock', 'level-lock-break',
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

      // AND THERE IS STILL NOWHERE TO PUT A NEW ONE. The page grew a file
      // input with the shell -- OPEN needs one -- so "no file input at all"
      // stopped being the honest form of this claim. The claim that matters
      // is unchanged and is now said directly: the ONE picker on the page
      // takes DRAWINGS, and an image cannot be offered to it.
      const pickers = page.locator('input[type=file]');
      expect(await pickers.count(),
        'the only file picker on this page is the one OPEN reads a drawing with')
        .toBe(1);
      const accept = await pickers.getAttribute('accept');
      expect(accept, 'OPEN names the drawing extensions it reads').toBeTruthy();
      expect(accept.includes('image') || accept.includes('.png') || accept.includes('.pdf'),
        'an underlay is an image or a PDF, and the drawing picker must not take one')
        .toBe(false);
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

  test('BONEYARD — the levels panel offers no way to reach one', async ({ page }) => {
    await seeded(page);
    // The old page reaches the boneyard through a pseudo-level with a NEGATIVE
    // id. If this page could reach it, that is where it would show.
    await h.openModelRail(page);
    const values = await page.locator('[data-level-row]')
      .evaluateAll(nodes => nodes.map(n => n.dataset.levelRow));
    expect(values.length, 'the panel must list the levels it is read for')
      .toBeGreaterThan(0);
    expect(values.filter(v => Number(v) < 0),
      'a boneyard would appear as a negative pseudo-level id').toEqual([]);
    expect(values.every(v => Number.isFinite(Number(v))),
      'and every option must be a real level id').toBe(true);
  });

  test('SOURCE LINKS have no verb; LEVEL LOCKS now do — and the keys are re-emitted untouched',
    async ({ page }) => {
      // GROUPS LEFT THIS ROW, AND NOW LOCKS HAVE TOO. It first read "LEVEL
      // LOCKS, GROUPS and SOURCE LINKS — no verb"; that stopped being true for
      // GROUPS when ASSEMBLY and UNGROUP landed in the tool column, and it has
      // now stopped being true for LOCKS as well: the level-lock port added
      // LEVEL LOCK and BREAK LOCK beside them. Both times the row moved from
      // absent to present and the TITLE moved with it.
      //
      // That is the whole discipline here. Teaching the control census to
      // accept two new buttons while leaving a title that says they do not
      // exist would be the exact failure the census exists to prevent -- a
      // control on the page that no row mentions, silenced instead of
      // answered. SOURCE LINKS are the only half of the original claim left.
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
