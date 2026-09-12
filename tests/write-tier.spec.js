// THE WRITE TIER'S PROOF. MODEL.html can save now, and this spec is the
// acceptance test the tier plan named: a save through the new page must equal
// the save the old page wrote, key for key, under deep comparison.
//
// The new page's save is load → normalise → store: it re-emits what it
// loaded through the same drawing-format rules the old page saves through,
// and edits nothing. So "equal" here is not approximately-equal or
// same-count — it is toEqual on the whole parsed drawing, every one of the
// 65 persisted keys plus the layout/specs passthroughs, because any key the
// round trip loses is work a drafter loses the moment this page becomes a
// door they save through.
//
// THE FIXTURE IS A REAL HOUSE, NOT A HANDMADE OBJECT. The bone builds it on
// the old page exactly as a first-time user does, which is what makes the
// comparison honest: bone-built walls carry srcId/offX/offZ source links,
// the drawing carries floors, roofs, dims, beams, columns, groups, outlines
// and levelLocks — the
// fields a synthetic fixture forgets are exactly the ones a save silently
// drops. The spec asserts the fixture's reach before trusting it.
//
// THIS COMMENT USED TO CLAIM STAIRS AND FENESTRATIONS. Measured 11 Sep while
// widening for the round-trip gate: both arrays are EMPTY in the bone house. A
// sentence above a green test describing coverage that does not exist is the
// same defect as an assertion that cannot fail — anyone reading it concluded
// riseFt and openings were round-tripped, and nothing could contradict it
// because no assertion stood behind it. Corrected rather than deleted, so the
// next reader knows the claim was checked rather than quietly dropped.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const readout = page => page.locator('#readout');
const saveButton = page => page.locator('#save');

// The bone house, plus the two conditional passthroughs injected the way
// their owning pages write them — LAYOUT's sheet key and SPECS' project
// sections. Without them the passthrough half of the comparison would be
// vacuously green: a drawing with no layout key cannot lose one.
async function houseWithPassthroughs(page) {
  await h.openModel(page, { webgl: false, rails: false, entryCoach: true });
  await expect(page.locator('[data-entry-coach]')).toBeVisible({ timeout: 4000 });
  await page.locator('[data-first-bone-press]').click();
  await h.waitForSaved(page);
  const saved = await h.savedDrawing(page);

  const levelId = saved.levels[0].id;
  await page.evaluate(async ({ bucket, levelId }) => {
    const store = window.SharedFileStore;
    const at = await store.loadSharedFileAt(bucket);
    const drawing = JSON.parse(await at.file.text());
    drawing.layout = {
      paperKey: '11x17', orientation: 'landscape', titleblock: 'bluejetty-band',
      northArrow: false, auto: true, nextViewportId: 2,
      viewports: [{ id: 1, kind: 'plan', pif: 1 / 8, xIn: 4, yIn: 3, sheet: 1, levelId }],
    };
    drawing.specs = { sections: [{ id: 'off-1', division: 6, off: true }] };
    const file = new File([JSON.stringify(drawing)], 'model-drawing.json',
      { type: 'application/json' });
    await store.saveSharedFile(file, bucket, { ifRev: at.rev });
  }, { bucket: h.STORAGE_BUCKET, levelId });

  return page.evaluate(async bucket => {
    const store = window.SharedFileStore;
    const at = await store.loadSharedFileAt(bucket);
    return { drawing: JSON.parse(await at.file.text()), rev: at.rev };
  }, h.STORAGE_BUCKET);
}

test.describe('MODEL.html write tier', () => {

  // MOVIE'S RULING, 11 Sep: PAINT THE SUBSTITUTE, NEVER PERSIST IT.
  //
  // Found by the round-trip gate's first widening. `legacyWallTypes` rewrites a
  // retired wall type to the nearest surviving one so the wall can be drawn —
  // correct for a reader, and this page is also a writer. Before the fix, a
  // no-op round trip turned `concrete_12` into `concrete_8` IN THE FILE: open an
  // old house, change nothing, press SAVE, and four inches of concrete are gone
  // from the record with no message.
  //
  // The damage is one-way and time-limited in the worst way: every old drawing
  // opened and saved between now and the day the thicker type returns loses it,
  // and when it returns those walls do not, because nothing in the file
  // remembers what they were.
  //
  // MUTATION: drop the restore in serializeDrawing. Fails — the file comes back
  // migrated.
  test('a retired wall type is drawn as its substitute and SAVED as itself',
    async ({ page }) => {
      await houseWithPassthroughs(page);

      const legacyName = await page.evaluate(async bucket => {
        const store = window.SharedFileStore;
        const at = await store.loadSharedFileAt(bucket);
        const drawing = JSON.parse(await at.file.text());
        const legacy = Object.keys(window.DraftWallTypes.LEGACY_WALL_TYPES || {});
        if (!legacy.length) return null;
        drawing.walls[0].wallType = legacy[0];
        await store.saveSharedFile(
          new File([JSON.stringify(drawing)], 'd.json', { type: 'application/json' }),
          bucket, { ifRev: at.rev });
        return legacy[0];
      }, h.STORAGE_BUCKET);

      expect(legacyName,
        'there is no retired wall type to test with, so this spec asserts '
        + 'nothing — that is a finding, not a pass').toBeTruthy();
      const seeded = await h.savedDrawing(page);
      expect(seeded.walls[0].wallType,
        'the legacy type must really be in the file before the round trip')
        .toBe(legacyName);

      await page.goto('/MODEL.html');
      await expect(readout(page)).toContainText('walls', { timeout: 6000 });
      await saveButton(page).click();
      await expect(saveButton(page)).toHaveText('SAVED', { timeout: 6000 });

      const after = await h.savedDrawing(page);
      expect(after.walls[0].wallType,
        'the drafter changed nothing, so the file must still say what it said — '
        + 'a page that draws a substitute may not write one')
        .toBe(legacyName);

      // AND THE DRAFTER CAN FIND OUT. The ruling asks for this in the same voice
      // the dropped-item count already uses: the page says what it could not do
      // rather than looking like it did it. Without it the accommodation is
      // invisible — the wall simply looks thinner and nothing on screen says the
      // page could not draw what the file holds.
      //
      // MUTATION: drop the readout clause. Fails.
      await expect(readout(page),
        'the page must say a substitution happened, or the drafter has no way to '
        + 'tell a thinner wall from a page that cannot draw the real one')
        .toContainText('1 wall type substituted');
    });

  // MOVIE'S RULING, 11 Sep: A REJECTED ITEM IS STILL THE DRAFTER'S.
  //
  // The gate's second finding, and the same sentence as the first. The format
  // module refuses malformed geometry so the page does not try to draw it —
  // right, and this page also writes. Before the fix a refused item was gone
  // from the file on the next SAVE: open a drawing with one bad wall, change
  // nothing, press SAVE, and the wall is deleted. The drafter asked to draw
  // nothing and lost data anyway.
  //
  // A page may show less than the file contains; it may not save less than the
  // file contains.
  //
  // FOUR REFUSALS, ONE PER NORMALISED COLLECTION, because the four go through
  // four different rules and a fix applied to walls alone would look identical
  // from the outside. The dimension is refused for a DUPLICATE ID, which is the
  // case a call-site reconstruction gets backwards: re-run on its own that
  // dimension passes.
  //
  // MUTATIONS, four run and four killed, on different assertions: drop
  // withRefused from walls — the wall is missing from the saved file. Return
  // `items` unchanged — the same, across all four collections. Splice at the
  // end instead of the recorded index — the whole-file compare, on order alone.
  // Stop passing `drops` to floors — the readout count reads 3, and the test
  // never reaches the save. That last one is why the count is asserted here
  // rather than left to the segments spec.
  test("an item the format module refuses is not drawn, and SAVE writes it back unchanged",
    async ({ page }) => {
      await houseWithPassthroughs(page);

      await page.evaluate(async bucket => {
        const store = window.SharedFileStore;
        const at = await store.loadSharedFileAt(bucket);
        const drawing = JSON.parse(await at.file.text());
        const levelId = drawing.levels[0].id;
        // IN THE MIDDLE, not appended. Order is part of the comparison, and an
        // item that comes back at the end of the array passes a presence check
        // while still not being the file the drafter had.
        //
        // `provenance` is a key nothing in this repo reads. A page that rebuilt
        // the item out of the fields it understands would lose it and look
        // entirely correct doing so.
        drawing.walls.splice(1, 0, {
          id: 'refused-wall', start: { x: 5, z: 5 }, end: { x: 5, z: 5 },
          levelId, provenance: 'surveyed 1998, do not touch',
        });
        drawing.lines.splice(1, 0, {
          id: 'refused-line', start: { x: 2, z: 2 }, end: { x: 2, z: 2 }, levelId,
        });
        drawing.floors.push({
          id: 'refused-floor', levelId, points: [{ x: 0, z: 0 }, { x: 1, z: 0 }],
        });
        // Refused for its id alone: a byte-for-byte copy of a dimension that is
        // already in the file and already valid.
        drawing.dimensions.push({ ...drawing.dimensions[0] });
        await store.saveSharedFile(
          new File([JSON.stringify(drawing)], 'd.json', { type: 'application/json' }),
          bucket, { ifRev: at.rev });
      }, h.STORAGE_BUCKET);

      const before = await h.savedDrawing(page);
      expect(before.walls[1].id,
        'the refused wall must really be in the file, at index 1, before the '
        + 'round trip — a fixture that never planted it would pass this spec '
        + 'without exercising anything').toBe('refused-wall');
      expect(before.dimensions.at(-1).id,
        'and the duplicate dimension must really be a duplicate')
        .toBe(before.dimensions[0].id);

      await page.goto('/MODEL.html');
      await expect(readout(page)).toContainText('walls', { timeout: 6000 });

      // NOT DRAWN, AND SAID SO. Four refusals across four collections.
      await expect(readout(page),
        'the page must say how many items it is carrying but not drawing')
        .toContainText('4 not drawn, kept in file');

      // AND NOT DRAWN IS AN EFFECT, NOT A WORDING. The readout's total is the
      // length of the drawing the page BUILT, so `walls n/25` on a 26-wall file
      // is the refused wall being absent from it. Asserted separately from the
      // count above, which a page that kept the item in the drawing and merely
      // said otherwise would still satisfy.
      await expect(readout(page),
        'the refused wall must be absent from the drawing being painted, not '
        + 'merely described as absent')
        .toContainText(`/${before.walls.length - 1}`);

      await saveButton(page).click();
      await expect(saveButton(page)).toHaveText('SAVED', { timeout: 6000 });

      const after = await h.savedDrawing(page);
      expect(after.walls[1],
        'the refused wall must come back byte-for-byte, at the index it came in '
        + 'at, unknown keys and all').toEqual(before.walls[1]);
      expect(after,
        'and the whole file unchanged — keep-and-re-emit that is not asserted '
        + 'whole is a green that proves nothing').toEqual(before);
    });

  // GATE WIDENING 1 of 3: UNDERLAYS.
  //
  // The bone house has none, so the gate has never carried one through. An
  // underlay is the only persisted entity whose PAYLOAD lives outside the
  // drawing — the image bytes are a separate named file in the store and only
  // the placement metadata is in the JSON — which makes it the entity most
  // likely to be treated as scenery by a page that never has to draw it well.
  //
  // Planted into the stored file rather than drawn, because there is no
  // gesture on either page that creates one without a file picker. The record
  // is shaped exactly as drawing-format.js emits one, so anything the round
  // trip changes is the round trip's doing and not a normaliser correcting a
  // handmade object.
  //
  // MEASURED, NOT FIXED. Movie's standing order on the gate: widen one item at
  // a time and report the raw result.
  test('gate widening: an underlay survives the round trip', async ({ page }) => {
    await houseWithPassthroughs(page);

    await page.evaluate(async bucket => {
      const store = window.SharedFileStore;
      const at = await store.loadSharedFileAt(bucket);
      const drawing = JSON.parse(await at.file.text());
      drawing.underlays = [{
        id: 'ul-1',
        levelId: drawing.levels[0].id,
        kind: 'pdf',
        name: 'survey.pdf',
        page: 2,
        x: -12.5, z: 7.25,
        widthFt: 40, heightFt: 30,
        opacity: 0.45,
        scaleRaw: '1/8" = 1\'-0"',
        scaleRatio: 96,
        scaleUnit: 'imperial',
        layer: 'UNDERLAY',
      }];
      await store.saveSharedFile(
        new File([JSON.stringify(drawing)], 'd.json', { type: 'application/json' }),
        bucket, { ifRev: at.rev });
    }, h.STORAGE_BUCKET);

    const before = await h.savedDrawing(page);
    expect(before.underlays, 'the underlay must really be in the file first')
      .toHaveLength(1);

    await page.goto('/MODEL.html');
    await expect(readout(page)).toContainText('walls', { timeout: 6000 });
    await saveButton(page).click();
    await expect(saveButton(page)).toHaveText('SAVED', { timeout: 6000 });

    const after = await h.savedDrawing(page);
    expect(after.underlays,
      'every placement field the drafter set — page, opacity, scale, position — '
      + 'must come back as it went in').toEqual(before.underlays);
    expect(after, 'and the rest of the drawing with it').toEqual(before);
  });

  // GATE WIDENING 2 of 3: TWO WALLS MEETING AT ONE POINT WITH DIFFERENT srcIds.
  //
  // srcId lives on the POINT, not the wall (drawing-format.js:51): it links a
  // corner to the boneyard master it was generated from, with offX/offZ holding
  // the offset. Both pages rebuild reference equality at shared corners on load,
  // so two walls that meet end up holding ONE point object — and one object can
  // carry one link.
  //
  // THIS WAS FILED AS A FINDING AGAINST MODEL.html AND IT IS NOT ONE.
  //
  // The first version of this test asserted that each wall keeps its own link,
  // saw MODEL.html collapse them, and recorded a defect. Then the same fixture
  // was run through MODEL.dc.html, and the old page does exactly the same
  // thing:
  //
  //     both pages:  coincident-b.start  srcId  bone-master-B -> bone-master-A
  //                                      offX   -1.5          -> 0.25
  //                                      offZ    2            -> -0.5
  //
  // So this is the FORMAT'S IDENTITY MODEL — one shared corner is one point and
  // one point carries one link — and not a new-page regression. The defect was
  // in the expectation. It was caught by measuring the other page instead of
  // ruling on the first result, which is the only reason a correct behaviour
  // was not "fixed" into a divergence.
  //
  // WHAT THIS TEST ASSERTS NOW is the Write Tier's actual contract: the two
  // pages resolve the corner IDENTICALLY. It is written as a comparison between
  // them rather than against a hardcoded expectation, so it cannot bless one
  // page's answer — if either page changes how it pools, this goes red and says
  // which.
  //
  // STILL OPEN, AND NOT THIS TEST'S TO SETTLE: whether collapsing is the right
  // model at all. A drafter's second boneyard link is silently discarded on both
  // pages, and the next time master A moves it drags B's corner to a position
  // derived from the wrong offset. That is a question about the format, older
  // than this page, and it wants a board rather than a patch. Also unmeasured:
  // whether a real gesture can produce two coincident corners with different
  // masters at all.
  test('gate widening: both pages resolve a shared corner the same way',
    async ({ browser }) => {
      test.setTimeout(300_000);

      const seeded = async () => {
        const context = await browser.newContext();
        const page = await context.newPage();
        await houseWithPassthroughs(page);
        await page.evaluate(async bucket => {
          const store = window.SharedFileStore;
          const at = await store.loadSharedFileAt(bucket);
          const drawing = JSON.parse(await at.file.text());
          const levelId = drawing.levels[0].id;
          const corner = { x: 40, z: 40, y: 0 };
          // Same level, same view, same body, coincident to the last decimal —
          // everything the pool keys on. The two links differ, which is the only
          // thing being asked about.
          drawing.walls.push({
            id: 'coincident-a', levelId, view: 'plan', wallType: 'stud_2x6',
            start: { x: 30, z: 40, y: 0 },
            end: { ...corner, srcId: 'bone-master-A', offX: 0.25, offZ: -0.5 },
            baseHeight: 0, topHeight: 8, refLine: 'left',
          });
          drawing.walls.push({
            id: 'coincident-b', levelId, view: 'plan', wallType: 'stud_2x6',
            start: { ...corner, srcId: 'bone-master-B', offX: -1.5, offZ: 2 },
            end: { x: 40, z: 50, y: 0 },
            baseHeight: 0, topHeight: 8, refLine: 'left',
          });
          await store.saveSharedFile(
            new File([JSON.stringify(drawing)], 'd.json', { type: 'application/json' }),
            bucket, { ifRev: at.rev });
        }, h.STORAGE_BUCKET);
        return { context, page };
      };

      const links = drawing => ({
        a: drawing.walls.find(w => w.id === 'coincident-a')?.end,
        b: drawing.walls.find(w => w.id === 'coincident-b')?.start,
      });

      // ── the new page: load, press SAVE ──────────────────────────────────
      const modern = await seeded();
      let planted;
      let viaNewPage;
      try {
        planted = links(await h.savedDrawing(modern.page));
        await modern.page.goto('/MODEL.html');
        await expect(readout(modern.page)).toContainText('walls', { timeout: 6000 });
        await saveButton(modern.page).click();
        await expect(saveButton(modern.page)).toHaveText('SAVED', { timeout: 6000 });
        viaNewPage = links(await h.savedDrawing(modern.page));
      } finally {
        await modern.context.close();
      }

      // ── the old page: load, and make the cheapest edit that forces its
      //    serializer to run, because it saves on edit and on nothing else ──
      const legacy = await seeded();
      let viaOldPage;
      try {
        await h.openModel(legacy.page, { webgl: false, rails: false });
        await h.openRails(legacy.page);
        await h.selectTool(legacy.page, 'Line');
        await h.clickWorld(legacy.page, -6, 2);
        await h.clickWorld(legacy.page, 6, 2);
        await legacy.page.keyboard.press('Enter');
        await h.waitForSaved(legacy.page);
        viaOldPage = links(await h.savedDrawing(legacy.page));
      } finally {
        await legacy.context.close();
      }

      // THE FIXTURE MUST REALLY HAVE HELD TWO DIFFERENT LINKS, or every
      // assertion below is satisfied by a file that never posed the question.
      expect([planted.a.srcId, planted.b.srcId],
        'the two links must really differ before either page reads the file')
        .toEqual(['bone-master-A', 'bone-master-B']);

      // THE CONTRACT: whatever the format's identity model is, both pages
      // implement the same one. Compared against each other, never against a
      // hardcoded answer — a fixed expectation here would bless one page's
      // behaviour as correct, and which one is correct is exactly what this
      // test is not entitled to decide.
      expect(viaNewPage,
        'the new page must resolve a shared corner exactly as the page that '
        + 'owns the format does — whatever that resolution is')
        .toEqual(viaOldPage);

      // AND THE MEASURED FACT, recorded so a future reader does not have to
      // re-run this to learn what the model IS: both pages keep the first link
      // into the corner and discard the second.
      expect([viaNewPage.b.srcId, viaNewPage.b.offX, viaNewPage.b.offZ],
        'both pages collapse to the first link — recorded as the measurement '
        + 'it is, not endorsed as the behaviour it should be')
        .toEqual([planted.a.srcId, planted.a.offX, planted.a.offZ]);
    });

  // GATE WIDENING 3 of 3: THE TWO-HOP. old writes -> new saves -> old reopens
  // and saves. This did not exist in any form; the gate has only ever measured
  // one hop, and one hop cannot see a difference the old page's own loader
  // would forgive on the way back in.
  //
  // THE PROBLEM WITH THE SECOND HOP: there is no gesture that makes the old
  // page save without editing something. It writes on every edit and on
  // nothing else. So the vehicle is a drawn line — and a drawn line is a
  // difference, which would turn a strict whole-file compare into a compare
  // with an exception carved out of it, which is a normaliser wearing a
  // different hat.
  //
  // THE CONTROL ARM IS THE ANSWER. Both arms build the same bone and draw the
  // same line; only one of them detours through MODEL.html in between. The
  // vehicle appears on both sides, so it cancels, and the comparison stays a
  // STRICT toEqual on the whole file. Anything the detour changed is the only
  // thing that can show up.
  //
  //     control:  bone -> line -> save
  //     two-hop:  bone -> MODEL.html SAVE -> reopen old -> line -> save
  //
  // Separate browser contexts, because the two arms need separate IndexedDB.
  //
  // WHAT A GREEN HERE MEANS, precisely: the old page reads back everything
  // MODEL.html wrote and re-saves it identically to a file that never left the
  // old page. Not that the file is byte-identical to the one-hop result — the
  // line makes sure of that — but that the detour is invisible to the page
  // that owns the format.
  test('gate widening: the two-hop — old writes, new saves, old saves again',
    async ({ browser }) => {
      test.setTimeout(300_000);
      const LINE = [-6, 2, 6, 2];

      const freshPage = async () => {
        const context = await browser.newContext();
        return { context, page: await context.newPage() };
      };

      // ONE BONE, SHARED BY BOTH ARMS — and this is the part that was wrong
      // first time.
      //
      // The control arm's job is to cancel the vehicle edit. That only works if
      // the two arms start from the same house, and TWO INDEPENDENT BONE BUILDS
      // DO NOT AGREE. Measured, not assumed: a null-hypothesis run with the
      // detour removed from BOTH arms still failed, the house landing at a
      // different origin each time —
      //
      //     control  x -15    two-hop  x -10.5
      //     control  x -25    two-hop  x -21
      //
      // A differential built on two separate builds compares fixture noise and
      // reports it as a round-trip finding. The first version of this test did
      // exactly that, and the only reason it is not in the PR is that the
      // control was checked against itself before the result was believed.
      //
      // So the bone is built once and both arms are SEEDED from the same bytes.
      // Identical by construction rather than by hope.
      const seed = await (async () => {
        const { context, page } = await freshPage();
        try {
          await houseWithPassthroughs(page);
          return JSON.stringify(await h.savedDrawing(page));
        } finally {
          await context.close();
        }
      })();

      const arm = async detour => {
        const { context, page } = await freshPage();
        try {
          await h.openModel(page, { webgl: false, rails: false });
          await page.evaluate(async ({ bucket, text }) => {
            const store = window.SharedFileStore;
            const at = await store.loadSharedFileAt(bucket);
            await store.saveSharedFile(
              new File([text], 'd.json', { type: 'application/json' }),
              bucket, at ? { ifRev: at.rev } : {});
          }, { bucket: h.STORAGE_BUCKET, text: seed });
          await page.reload();
          await h.waitForModelReady(page, { rails: false });

          // THE SEED MUST HAVE TAKEN. A store write that silently did not land
          // leaves the arm on its own freshly-built house, which is the exact
          // failure this seeding exists to remove — and it would look like a
          // round-trip difference.
          expect(await h.savedDrawing(page),
            'the arm must be standing on the shared bone, not one of its own')
            .toEqual(JSON.parse(seed));

          if (detour) {
            await page.goto('/MODEL.html');
            await expect(readout(page)).toContainText('walls', { timeout: 6000 });
            await saveButton(page).click();
            await expect(saveButton(page)).toHaveText('SAVED', { timeout: 6000 });
            // Back to the page that owns the format, reading what the new page
            // wrote.
            await h.openModel(page, { webgl: false, rails: false });
          }

          const linesBefore = (await h.savedDrawing(page)).lines.length;

          // THE RAILS MUST BE OUT BEFORE A TOOL CAN BE PICKED. selectTool clicks
          // by role, so with the rail closed Playwright waits for a button that
          // never becomes actionable and the test dies on its own timeout — in
          // the arm that has nothing to do with the detour. Same shape as the
          // disabled-button trap: an invisible control is not a failing click,
          // it is a hang.
          await h.openRails(page);
          await h.selectTool(page, 'Line');
          await h.clickWorld(page, LINE[0], LINE[1]);
          await h.clickWorld(page, LINE[2], LINE[3]);
          await page.keyboard.press('Enter');
          await h.waitForSaved(page);

          return { drawing: await h.savedDrawing(page), linesBefore };
        } finally {
          await context.close();
        }
      };

      const control = await arm(false);
      const twoHop = await arm(true);

      // THE VEHICLE MUST REALLY HAVE HAPPENED, in both arms. Without this the
      // comparison below is between two untouched bones and passes for the one
      // reason it must never pass.
      expect([control.drawing.lines.length - control.linesBefore,
        twoHop.drawing.lines.length - twoHop.linesBefore],
      'each arm must really have drawn its line').toEqual([1, 1]);

      expect(twoHop.drawing,
        'a detour through MODEL.html must be invisible to the page that owns '
        + 'the format — same bone, same edit, same file')
        .toEqual(control.drawing);

      // WHAT THIS INSTRUMENT CANNOT SEE, measured rather than reasoned.
      //
      // Two mutants were run against this test. Dropping the last line from
      // MODEL.html's save KILLS it. Rewriting every roof's `slopeInPerFt` on
      // save does NOT — the old page drops the key on the way back in, so the
      // corruption is healed before the second save and the two-hop is blind
      // to it by construction.
      //
      // That is the two-hop being what it is rather than a hole in it: it
      // measures what SURVIVES a return to the page that owns the format, and
      // a field that page re-derives was never really persisted. The one-hop
      // test below is the one that sees those, which is why both exist.
      //
      // Say it out loud so nobody reads a green here as "the round trip is
      // exact". It means: the detour left nothing behind that the old page
      // would not have written itself.
    });

  test('a save through the new page equals the save the old page wrote, key for key', async ({ page }) => {
    const before = await houseWithPassthroughs(page);
    const legacy = before.drawing;

    // THE FIXTURE'S REACH, ASSERTED BEFORE IT IS TRUSTED. Each of these is a
    // field the round trip could lose silently; a fixture without them
    // proves nothing about them.
    expect(legacy.walls.length).toBeGreaterThan(0);
    expect(legacy.walls.some(w => w.start.srcId || w.end.srcId),
      'no wall carries a source link, so the srcId path is untested').toBe(true);
    expect((legacy.lines || []).length,
      'no lines, so layer preservation is untested').toBeGreaterThan(0);
    expect(legacy.lines.some(l => l.layer !== 'draft'),
      'every line is on draft, so a save that flattens layers would pass').toBe(true);
    expect((legacy.floors || []).length).toBeGreaterThan(0);
    expect((legacy.roofs || []).length).toBeGreaterThan(0);
    expect((legacy.dimensions || []).length).toBeGreaterThan(0);
    expect(legacy.layout, 'the LAYOUT passthrough is missing from the fixture').toBeTruthy();
    expect(legacy.specs, 'the SPECS passthrough is missing from the fixture').toBeTruthy();

    await page.goto('/MODEL.html');
    await expect(readout(page)).toContainText('walls', { timeout: 5000 });
    await expect(saveButton(page)).toHaveClass(/show/);

    await saveButton(page).click();
    await expect(saveButton(page)).toHaveText('SAVED', { timeout: 5000 });

    // THE CONTROL. Asserting the end state proves nothing unless the save
    // ran — persisted-format.spec.js learned that by mutation. The store's
    // revision counter only moves on a real write, so this is the proof the
    // comparison below is comparing a NEW save and not reading back the
    // legacy file untouched.
    const after = await page.evaluate(async bucket => {
      const store = window.SharedFileStore;
      const at = await store.loadSharedFileAt(bucket);
      return { drawing: JSON.parse(await at.file.text()), rev: at.rev };
    }, h.STORAGE_BUCKET);
    expect(after.rev, 'the new page never wrote the bucket').toBeGreaterThan(before.rev);

    // The tier's acceptance line: every key equal, deep.
    expect(after.drawing).toEqual(legacy);
  });

  test('a stale save is refused, and the other page\'s write survives untouched', async ({ page }) => {
    await houseWithPassthroughs(page);

    await page.goto('/MODEL.html');
    await expect(readout(page)).toContainText('walls', { timeout: 5000 });

    // Another page saves AFTER this one loaded — the exact race the ifRev
    // guard exists for. The intruding write marks itself so the assertion
    // below can tell whose bytes are in the bucket.
    const intruded = await page.evaluate(async bucket => {
      const store = window.SharedFileStore;
      const at = await store.loadSharedFileAt(bucket);
      const drawing = JSON.parse(await at.file.text());
      drawing.projectName = 'THE OTHER PAGE GOT HERE FIRST';
      const file = new File([JSON.stringify(drawing)], 'model-drawing.json',
        { type: 'application/json' });
      const rev = await store.saveSharedFile(file, bucket, { ifRev: at.rev });
      return rev;
    }, h.STORAGE_BUCKET);

    await saveButton(page).click();

    // Refused, and SAID so — a guard that fails silently is the audit rule's
    // first shape. The button goes back to SAVE, not SAVED.
    await expect(page.locator('#notice')).toHaveClass(/show/, { timeout: 5000 });
    await expect(page.locator('#notice')).toContainText('changed underneath');
    await expect(saveButton(page)).toHaveText('SAVE');

    // And the store still holds the other page's work: same revision, same
    // marker. Nothing was written on top of it.
    const after = await page.evaluate(async bucket => {
      const store = window.SharedFileStore;
      const at = await store.loadSharedFileAt(bucket);
      return { drawing: JSON.parse(await at.file.text()), rev: at.rev };
    }, h.STORAGE_BUCKET);
    expect(after.rev).toBe(intruded);
    expect(after.drawing.projectName).toBe('THE OTHER PAGE GOT HERE FIRST');
  });
});
