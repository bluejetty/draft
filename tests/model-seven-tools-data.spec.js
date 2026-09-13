// THE SEVEN SMALL TOOLS — THEIR DATA, BEFORE THEIR UI.
//
// beam, column, trim, shape, node, annotation, fixture are all required in
// MODEL.html before MODEL.dc.html can be deleted. Before any palette is built,
// one question decides how much UI there even is:
//
//   does an entity drawn on the OLD page survive a MODEL.html open-and-save
//   untouched, today, with no tool built?
//
// This is NOT the round-trip gate again. The gate asked whether MODEL.html
// saves less than the file contains, and the Write Tier ruling answered it in
// general: rejected items are kept raw and re-emitted. Kept-raw is not the same
// as USABLE — an entity preserved as an unknown blob round-trips perfectly and
// still cannot be selected, edited or repainted. For the gate that is a pass;
// for a tool build it is a finding. So three answers per tool, not one:
//
//   preserved  byte-identical through old -> new -> old
//   painted    MODEL.html actually draws it
//   linked     its references to other entities survive and still resolve
//
// TESTS ONLY. No product file. Where a tool's entities are dropped or unlinked
// that is a report, not a patch.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

// ── PAINTED, WITHOUT ASKING WHETHER THERE IS INK ──────────────────────────
// "Is there ink" cannot tell a beam from an elevation of nothing — it passed
// happily while the cut-view host painted an empty world. So `painted` is
// measured one level up: every render-2d entry point MODEL.html uses is
// wrapped before the page boots, and the question becomes "was this entity
// handed to a painter", which names the beam rather than the pixels.
const SPY = `
  window.__paintCalls = {};
  window.__spyState = 'waiting';
  // THE PAINTER OBJECT IS FROZEN — writable:false, configurable:false on every
  // export. Patching its properties after the fact SILENTLY DOES NOTHING in
  // sloppy mode: no throw, no change, and a spy that reports "wrapped 16" while
  // wrapping none. That empty result is indistinguishable from a page that
  // paints nothing, which is the very question being asked, so the instrument
  // is installed at ASSIGNMENT time instead.
  //
  // A Proxy cannot be used here: for a non-configurable, non-writable property
  // the get trap must return the identical value, so a Proxy is not allowed to
  // substitute a wrapper. What works is replacing the global with an unfrozen
  // shallow copy whose draw* members are wrapped — the page reads the global
  // after this runs, so it captures the copy.
  let real = undefined;
  Object.defineProperty(window, 'DraftRender2D', {
    configurable: true,
    get() { return real; },
    set(value) {
      if (!value || typeof value !== 'object') { real = value; return; }
      const copy = {};
      let wrapped = 0;
      for (const name of Object.keys(value)) {
        const member = value[name];
        if (typeof member === 'function' && /^draw/.test(name)) {
          wrapped += 1;
          copy[name] = function (...args) {
            // WHAT was handed to the painter, not how many arguments it took.
            // A call count answers "did this painter run", which is one paint
            // pass whether the sheet holds one beam or none — "assert the beam,
            // not the ink" applies to the spy as much as to the pixels. Every
            // id-bearing argument is recorded so a row can name its entity.
            const ids = args.flatMap(a => {
              if (Array.isArray(a)) return a.map(item => item && item.id).filter(v => v != null);
              return (a && typeof a === 'object' && a.id != null) ? [a.id] : [];
            });
            (window.__paintCalls[name] = window.__paintCalls[name] || []).push(ids);
            return member.apply(this, args);
          };
        } else {
          copy[name] = member;
        }
      }
      window.__spyState = 'wrapped ' + wrapped;
      real = copy;
    },
  });
`;

async function paintCalls(page) {
  return page.evaluate(() => window.__paintCalls || {});
}

// ── THE FIXTURE: all seven, by gesture, on the old page ───────────────────
// Every one of the seven has a real gesture and an existing spec that drives
// it; those sequences are the ones used here rather than invented ones. NOTHING
// IS SEEDED — the #385 rule governs, so each artefact below was made the way a
// drafter makes it and then survived a save.
async function sevenToolsHouse(page) {
  await h.openModel(page);

  // A house to hang things on, and two crossing lines for the two tools that
  // edit geometry rather than create it.
  await h.selectTool(page, 'Outline');
  for (const [x, z] of [[-8, -6], [8, -6], [8, 6], [-8, 6]]) await h.clickWorld(page, x, z);
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);
  await h.climbTourToMain(page);

  // NODE and TRIM edit lines rather than creating entities, so each gets its
  // own line drawn immediately before it — which is also how their own specs
  // drive them. An earlier version of this fixture ran them last, after four
  // other tools, and NODE silently did nothing: the click landed but the split
  // never happened. Rather than guess why, the sequence was moved to the one
  // its own spec uses, and it takes.
  const made = {};

  // NODE — a click on a line's body inserts a node, splitting it in two.
  await h.selectTool(page, 'Line');
  await h.clickWorld(page, -10, 0);
  await h.clickWorld(page, 10, 0);
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);
  const linesBeforeNode = h.allLines(await h.savedDrawing(page)).length;
  await h.selectTool(page, 'Node');
  await h.clickWorld(page, 2, 0);
  await h.waitForSaved(page);
  made.node = h.allLines(await h.savedDrawing(page)).length - linesBeforeNode;

  // TRIM — shortens a line at a crossing, so it needs one.
  await h.selectTool(page, 'Line');
  await h.clickWorld(page, 4, -6);
  await h.clickWorld(page, 4, 6);
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);
  const linesBeforeTrim = h.allLines(await h.savedDrawing(page)).length;
  await h.selectTool(page, 'Trim');
  await h.clickWorld(page, 8, 0);
  await h.waitForSaved(page);
  made.trim = h.allLines(await h.savedDrawing(page)).length - linesBeforeTrim;



  // BEAM — two clicks, start and end.
  await h.selectTool(page, 'Beam');
  await h.clickWorld(page, -6, 3);
  await h.clickWorld(page, 6, 3);
  await h.waitForSaved(page);
  made.beam = (await h.savedDrawing(page)).beams?.length || 0;

  // COLUMN — one click.
  await h.selectTool(page, 'Column');
  await h.clickWorld(page, 0, 3.5);
  await h.waitForSaved(page);
  made.column = (await h.savedDrawing(page)).columns?.length || 0;

  // SHAPE — a closed run of clicks.
  await h.selectTool(page, 'Shape');
  for (const [x, z] of [[-6, -4], [-2, -4], [-2, -1], [-6, -1]]) await h.clickWorld(page, x, z);
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);
  made.shape = (await h.savedDrawing(page)).shapes?.length || 0;

  // ANNOTATION — the object, then where the text goes, then the text.
  await h.selectTool(page, 'Annotation');
  await h.clickWorld(page, 0, 0);
  await h.clickWorld(page, 12, -8);
  await page.keyboard.type('BEAM POCKET HERE');
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);
  made.annotation = (await h.savedDrawing(page)).notes?.length || 0;

  // FIXTURE — hosts on a wall, so it needs one drawn first. Its own spec draws
  // a plain wall rather than building a house, which is cheaper and puts the
  // wall where the click can find it.
  await h.selectTool(page, 'Wall');
  await h.clickWorld(page, -6, -8);
  await h.clickWorld(page, 6, -8);
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);

  await h.selectTool(page, 'Fixture');
  await page.getByRole('button', { name: 'FRIDGE', exact: true }).click();
  await h.clickWorld(page, 0, -7.6);
  await h.waitForSaved(page);
  made.fixture = (await h.savedDrawing(page)).fixtures?.length || 0;

  return made;
}

test.describe('the seven small tools — preserved, painted, linked', () => {

  test('the fixture: every one of the seven is made BY GESTURE and survives its own save',
    async ({ page }) => {
      test.setTimeout(300_000);
      const made = await sevenToolsHouse(page);
      console.log('SEVEN made by gesture:', JSON.stringify(made));

      // THE FIXTURE IS THE MEASUREMENT'S FOUNDATION, so it is asserted before
      // anything is concluded from it. A tool whose gesture silently made
      // nothing would otherwise report `preserved` for an empty collection —
      // the "zero found and cannot find are the same output" trap, seven times
      // over.
      expect({
        beam: made.beam > 0, column: made.column > 0, shape: made.shape > 0,
        annotation: made.annotation > 0, fixture: made.fixture > 0,
        node: made.node !== 0, trim: made.trim !== 0,
      }, 'each gesture must have changed the drawing, or its row below measures '
        + 'nothing').toEqual({
        beam: true, column: true, shape: true, annotation: true, fixture: true,
        node: true, trim: true,
      });
    });

  test('PRESERVED and PAINTED — one open-and-save on MODEL.html, measured per tool',
    async ({ page }) => {
      test.setTimeout(300_000);
      await sevenToolsHouse(page);
      const before = await h.savedDrawing(page);

      // The records themselves, printed once, so `linked` below is defined from
      // what the seven actually carry rather than from what a reader expects
      // them to carry.
      for (const key of ['beams', 'columns', 'shapes', 'fixtures', 'notes']) {
        console.log(`RECORD ${key}:`, JSON.stringify((before[key] || [])[0] || null));
      }

      await page.addInitScript(SPY);
      await page.goto('/MODEL.html');
      await expect(page.locator('#readout')).toContainText('walls', { timeout: 6000 });
      await page.locator('#save').click();
      await expect(page.locator('#save')).toHaveText('SAVED', { timeout: 6000 });

      // FORCE A PAINT WHILE THE SPY IS LIVE. render-2d.js populates its exports
      // during boot and the page paints immediately after, so the first frame
      // can be gone before the spy is installed — and a spy that missed the
      // only paint reports the same empty object as a page that paints nothing.
      // `0` is fit-and-repaint, a gesture the page already answers.
      await page.keyboard.press('0');
      await page.waitForTimeout(400);

      const painted = await paintCalls(page);
      const spyState = await page.evaluate(() => window.__spyState);
      console.log('SPY STATE:', spyState);
      const handed = Object.fromEntries(Object.entries(painted)
        .map(([k, v]) => [k, [...new Set(v.flat())]]).sort());
      console.log('PAINTERS CALLED, and what reached them:', JSON.stringify(handed));

      const after = await h.savedDrawing(page);
      const per = {};
      for (const key of ['beams', 'columns', 'shapes', 'fixtures', 'notes', 'lines']) {
        per[key] = JSON.stringify(before[key] || []) === JSON.stringify(after[key] || [])
          ? `preserved (${(before[key] || []).length})` : 'CHANGED';
      }
      console.log('PRESERVED per collection:', JSON.stringify(per));

      // THE WHOLE FILE, strictly, AND BEFORE THE LINK CHECKS. Ordering matters
      // for the controls: the first run of the `preserved` mutant (fixtures
      // dropped on save) went red on the LINKED assertion instead, because a
      // dropped fixture has no wallId to resolve. A mutant that kills the wrong
      // assertion leaves the intended one untested.
      expect(after, 'a MODEL.html open-and-save must not move the seven tools\' data')
        .toEqual(before);

      // PAINTED, ASSERTED — not merely printed. The first version logged
      // `handed` and asserted nothing, so the control mutation (the fixture
      // painter short-circuited) SURVIVED.
      //
      // AND ASSERTED PER PAINTER, not against one pooled set of ids. The second
      // version put every id into a single Set and asked whether the beam's id
      // was in it — the beam's id is 1, the column's id is 1, and the note's id
      // is 1, so both read as painted off the NOTE's call. Ids are unique
      // within a collection and not across them; pooling them measured nothing
      // and said "painted" twice.
      const reachedBy = (painter, id) => (handed[painter] || []).includes(id);
      const painterNames = await page.evaluate(() => window.__spyState);
      const beamPainter = Object.keys(handed).find(n => /beam/i.test(n)) || null;
      const columnPainter = Object.keys(handed).find(n => /column|footing/i.test(n)) || null;
      console.log('PAINTER SURFACE:', painterNames,
        '| beam painter:', beamPainter, '| column painter:', columnPainter);

      expect({
        fixture: reachedBy('drawFixture2D', (after.fixtures || [])[0]?.id),
        shape: reachedBy('drawShape2D', (after.shapes || [])[0]?.id),
        annotation: reachedBy('drawNoteScreen2D', (after.notes || [])[0]?.id),
        beamPainterExists: beamPainter !== null,
        columnPainterExists: columnPainter !== null,
      }, 'which of the seven reached a painter of their own — MODEL.html calls '
        + 'no beam or column painter at all')
        .toEqual({
          fixture: true, shape: true, annotation: true,
          beamPainterExists: false, columnPainterExists: false,
        });

      // LINKED — every one of the seven carries a levelId, and the fixture also
      // carries a wallId. Those are the real cross-entity references in this
      // fixture; the others (column pullSrcId/pullLevelId, shape sourceLevelId)
      // exist in the format but were NOT set by these gestures, which is
      // reported rather than papered over.
      const levelIds = new Set((after.levels || []).map(l => l.id));
      const wallIds = new Set((after.walls || []).map(w => w.id));
      const links = {
        beam: levelIds.has((after.beams || [])[0]?.levelId),
        column: levelIds.has((after.columns || [])[0]?.levelId),
        shape: levelIds.has((after.shapes || [])[0]?.levelId),
        annotation: levelIds.has((after.notes || [])[0]?.levelId),
        fixture: levelIds.has((after.fixtures || [])[0]?.levelId)
          && wallIds.has((after.fixtures || [])[0]?.wallId),
      };
      console.log('LINKED:', JSON.stringify(links));
      console.log('LINK FIELDS PRESENT BUT UNSET BY THESE GESTURES:', JSON.stringify({
        column_pullSrcId: (after.columns || [])[0]?.pullSrcId ?? null,
        shape_sourceLevelId: (after.shapes || [])[0]?.sourceLevelId ?? null,
      }));
      expect(links, 'every reference the seven carry must still resolve after '
        + 'the round trip').toEqual({
        beam: true, column: true, shape: true, annotation: true, fixture: true,
      });

      // THE SPY'S OWN CONTROL. An empty result from a spy that never wrapped
      // anything is not a measurement, and that is exactly what the first run
      // of this test produced.
      expect(String(spyState),
        'the painter spy must have wrapped real painters before any conclusion '
        + 'is drawn from what it did not record').toMatch(/^wrapped [1-9]/);
      expect(Object.keys(painted).length,
        'and it must have recorded SOMETHING — a page that painted no walls '
        + 'either is a broken fixture, not a finding about beams')
        .toBeGreaterThan(0);



    });

  // ── THE LINKED CHECK'S OWN CONTROL ───────────────────────────────────────
  // `linked` cannot be killed by a mutation inside the test above: any change
  // that breaks a reference also changes the saved file, so the strict
  // whole-file `preserved` assertion fires first and the link check is never
  // reached. Both mutations that were supposed to prove `linked` red actually
  // proved `preserved` red twice.
  //
  // So the link check is exercised against a drawing that is SUPPOSED to have a
  // dangling reference, and the only thing asserted is that the check can tell
  // the difference. An instrument that answers "resolved" for a fixture hosted
  // on a wall that does not exist would have reported `linked` for all five
  // rows above without ever looking.
  test('CONTROL — the link check reports a dangling reference as dangling',
    async ({ page }) => {
      test.setTimeout(300_000);
      await sevenToolsHouse(page);

      const drawing = await h.savedDrawing(page);
      const resolves = d => {
        const wallIds = new Set((d.walls || []).map(w => w.id));
        return wallIds.has((d.fixtures || [])[0]?.wallId);
      };
      expect(resolves(drawing),
        'the fixture must really be hosted on a wall that exists, before the '
        + 'dangling case means anything').toBe(true);

      const broken = JSON.parse(JSON.stringify(drawing));
      broken.fixtures[0].wallId = 'no-such-wall';
      expect(resolves(broken),
        'and the same check must report a fixture hosted on a wall that does '
        + 'not exist as unresolved').toBe(false);
    });
});
