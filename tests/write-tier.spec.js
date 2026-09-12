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
  // the offset. MODEL.html rebuilds reference equality at shared corners on
  // load, so two walls that meet end up holding ONE point object — and one
  // object can carry one link.
  //
  // The load path already anticipates this and says so: "First point into a
  // pooled corner wins, matching the identity the old page saved." This test
  // asks whether that is true of the FILE, which is a different question from
  // whether it is true of the page.
  //
  // MEASURED, NOT FIXED — AND IT FOUND SOMETHING. The round trip collapses the
  // two links into one:
  //
  //     coincident-b.start   srcId  bone-master-B -> bone-master-A
  //                          offX   -1.5          -> 0.25
  //                          offZ    2            -> -0.5
  //
  // Wall B's corner is silently re-parented to wall A's master, at A's offset.
  // Nothing on screen changes today, and nothing in the file records that it
  // happened — but the next time master A moves it drags B's corner with it, to
  // a position derived from the wrong offset. That is the boneyard link doing
  // the opposite of its job.
  //
  // test.fail() rather than a fixed expectation, deliberately. Asserting the
  // current behaviour would write the defect into the suite as the contract,
  // which is the failure this spec file spent the week removing. As a marked
  // failure it does two things a passing test cannot: it stays visible as an
  // open finding, and it goes RED THE DAY SOMEBODY FIXES IT, so the fix cannot
  // land silently and the ruling gets written down.
  //
  // ONE THING THIS IS NOT: the handmade points below omit `y`, and the round
  // trip returns them carrying `y: 0`. That is the fixture, not the page — the
  // old page writes `y` on every point and the bone round-trips it exactly, as
  // the whole-file test below proves. Recorded so the next reader does not
  // re-derive it as a second finding.
  //
  // WHAT IS STILL UNMEASURED: whether a real gesture can produce two coincident
  // corners with different masters. This shows the format can express it and
  // the round trip does not survive it; it does not show a drafter can reach
  // it. And the same question of MODEL.dc.html is unasked — if the old page
  // collapses them too, this is the format's identity model rather than the
  // new page's bug.
  test.fail('gate widening: two walls meet at one point carrying different srcIds',
    async ({ page }) => {
      await houseWithPassthroughs(page);

      await page.evaluate(async bucket => {
        const store = window.SharedFileStore;
        const at = await store.loadSharedFileAt(bucket);
        const drawing = JSON.parse(await at.file.text());
        const levelId = drawing.levels[0].id;
        const corner = { x: 40, z: 40 };
        // Same level, same view, same body, coincident to the last decimal —
        // everything the pool keys on. The two links differ, which is the only
        // thing being asked about.
        drawing.walls.push({
          id: 'coincident-a', levelId, view: 'plan', wallType: 'stud_2x6',
          start: { x: 30, z: 40 },
          end: { ...corner, srcId: 'bone-master-A', offX: 0.25, offZ: -0.5 },
          baseHeight: 0, topHeight: 8, refLine: 'left',
        });
        drawing.walls.push({
          id: 'coincident-b', levelId, view: 'plan', wallType: 'stud_2x6',
          start: { ...corner, srcId: 'bone-master-B', offX: -1.5, offZ: 2 },
          end: { x: 40, z: 50 },
          baseHeight: 0, topHeight: 8, refLine: 'left',
        });
        await store.saveSharedFile(
          new File([JSON.stringify(drawing)], 'd.json', { type: 'application/json' }),
          bucket, { ifRev: at.rev });
      }, h.STORAGE_BUCKET);

      const before = await h.savedDrawing(page);
      const linkOf = (drawing, id, endKey) =>
        drawing.walls.find(wall => wall.id === id)?.[endKey];
      expect(linkOf(before, 'coincident-a', 'end').srcId,
        'the two links must really differ in the file before the round trip')
        .toBe('bone-master-A');
      expect(linkOf(before, 'coincident-b', 'start').srcId).toBe('bone-master-B');

      await page.goto('/MODEL.html');
      await expect(readout(page)).toContainText('walls', { timeout: 6000 });
      await saveButton(page).click();
      await expect(saveButton(page)).toHaveText('SAVED', { timeout: 6000 });

      const after = await h.savedDrawing(page);
      expect({
        a: linkOf(after, 'coincident-a', 'end'),
        b: linkOf(after, 'coincident-b', 'start'),
      }, 'each wall must keep its own link to its own master — a corner two '
        + 'walls share is still two walls').toEqual({
        a: linkOf(before, 'coincident-a', 'end'),
        b: linkOf(before, 'coincident-b', 'start'),
      });
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
      // Two full bone builds plus a detour. The 180 s default is for one.
      test.setTimeout(300_000);
      const LINE = [-6, 2, 6, 2];

      const arm = async detour => {
        const context = await browser.newContext();
        const page = await context.newPage();
        try {
          await houseWithPassthroughs(page);
          // Counted inside the arm rather than by building a third bone. Same
          // assertion, one fewer context: the first version of this test opened
          // three and died in teardown.
          const linesBefore = (await h.savedDrawing(page)).lines.length;

          if (detour) {
            await page.goto('/MODEL.html');
            await expect(readout(page)).toContainText('walls', { timeout: 6000 });
            await saveButton(page).click();
            await expect(saveButton(page)).toHaveText('SAVED', { timeout: 6000 });
            // Back to the page that owns the format, reading what the new page
            // wrote.
            await h.openModel(page, { webgl: false, rails: false });
          }

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
      // reason it must never pass — which is the shape this gate keeps
      // producing.
      expect([control.drawing.lines.length - control.linesBefore,
        twoHop.drawing.lines.length - twoHop.linesBefore],
      'each arm must really have drawn its line').toEqual([1, 1]);

      expect(twoHop.drawing,
        'a detour through MODEL.html must be invisible to the page that owns '
        + 'the format — same bone, same edit, same file')
        .toEqual(control.drawing);
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
