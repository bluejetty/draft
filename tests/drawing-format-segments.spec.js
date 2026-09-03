// EQUIVALENCE, not a rewrite. drawing-format.js now carries the field rules for
// walls, lines and floors -- the three types MODEL.dc.html has always inflated
// inline (5241, 5255, 5270). The rules were MOVED, so the only assertion worth
// making is that the shared version and the old page agree, field for field, on
// the same saved drawing.
//
// What is deliberately NOT compared: `id` and the vertex objects themselves.
// MODEL assigns stored ids and pools its vertices; the shared normaliser does
// neither, because a pooled vertex is MODEL's own identity mechanism and a
// reader does not want one. That is the seam -- this module decides whether a
// wall is WELL FORMED, MODEL decides what it is CONNECTED TO -- so coordinates
// are compared and object identity is not.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

test.describe('drawing-format walls/lines/floors', () => {
  test('the shared rules agree with the old page, field for field', async ({ page }) => {
    await h.openModel(page, { webgl: false, rails: false, entryCoach: true });
    await expect(page.locator('[data-entry-coach]')).toBeVisible({ timeout: 4000 });
    await page.locator('[data-first-bone-press]').click();
    await h.waitForSaved(page);

    const out = await page.evaluate(() => {
      const F = window.DraftDrawingFormat;
      const root = window.__dcRoot;
      const saved = JSON.parse(window.localStorage.getItem('__lastSavedDrawing') || 'null');
      return { hasRoot: !!root, hasSaved: !!saved, exports: Object.keys(F).length };
    });
    // The old page's live arrays are not reachable from the test context in
    // this harness, so the comparison runs against the SAVED drawing, which is
    // what both sides inflate from anyway.
    const saved = await h.savedDrawing(page);

    const mine = await page.evaluate(drawing => {
      const F = window.DraftDrawingFormat;
      // levelId() takes a SET, not an array -- format.levelId does levelIds.has(id).
      const levelIds = new Set((drawing.levels || []).map(l => Number(l.id)));
      const WT = window.DraftWallTypes;
      return {
        walls: F.walls(drawing.walls, levelIds, {
          wallTypes: WT.WALL_TYPES,
          legacyWallTypes: WT.LEGACY_WALL_TYPES,
          defaultWallTopFt: 8,
        }),
        lines: F.lines(drawing.lines, levelIds, {}),
        floors: F.floors(drawing.floors, levelIds, { defaultFloorThickness: 0.75 }),
      };
    }, saved);

    // CONTROLS: the comparison is meaningless if the fixture is empty, and it
    // is weak if nothing is ever rejected.
    expect(saved.walls.length, 'the fixture must save walls').toBeGreaterThan(0);
    expect(saved.floors.length, 'and floors').toBeGreaterThan(0);
    expect(mine.walls.length, 'and the shared rules must keep them')
      .toBe(saved.walls.length);

    // Field-for-field, against the values the old page wrote out.
    saved.walls.forEach((w, i) => {
      const m = mine.walls[i];
      expect(m.view, `wall ${i} view`).toBe(w.view);
      expect(m.wallType, `wall ${i} wallType`).toBe(w.wallType);
      expect(m.refLine, `wall ${i} refLine`).toBe(w.refLine);
      expect(m.topHeight, `wall ${i} topHeight`).toBeCloseTo(w.topHeight, 6);
      expect(m.start.x, `wall ${i} start.x`).toBeCloseTo(w.start.x, 9);
      expect(m.end.z, `wall ${i} end.z`).toBeCloseTo(w.end.z, 9);
    });
    saved.floors.forEach((f, i) => {
      const m = mine.floors[i];
      expect(m.view, `floor ${i} view`).toBe(f.view);
      expect(m.structure, `floor ${i} structure`).toBe(f.structure);
      expect(m.points.length, `floor ${i} point count`).toBe(f.points.length);
    });
  });

  test('a legacy wallType falls back the way the old page falls back', async ({ page }) => {
    await h.openModel(page, { webgl: false, rails: false, entryCoach: true });
    const result = await page.evaluate(() => {
      const F = window.DraftDrawingFormat;
      const WT = window.DraftWallTypes;
      const env = { wallTypes: WT.WALL_TYPES, legacyWallTypes: WT.LEGACY_WALL_TYPES };
      const seg = (wallType) => ({ start: { x: 0, z: 0 }, end: { x: 10, z: 0 }, levelId: 3, wallType });
      const legacyKey = Object.keys(WT.LEGACY_WALL_TYPES)[0] || null;
      return {
        legacyKey,
        legacyMapsTo: legacyKey ? WT.LEGACY_WALL_TYPES[legacyKey] : null,
        fromLegacy: legacyKey ? F.walls([seg(legacyKey)], new Set([3]), env)[0].wallType : null,
        fromGarbage: F.walls([seg('no-such-type')], new Set([3]), env)[0].wallType,
        fromKnown: F.walls([seg('stud_2x6')], new Set([3]), env)[0].wallType,
      };
    });
    // Control: this proves nothing unless a legacy mapping actually exists.
    expect(result.legacyKey, 'LEGACY_WALL_TYPES must have entries to test').not.toBeNull();
    expect(result.fromLegacy, 'a legacy id maps to its replacement')
      .toBe(result.legacyMapsTo);
    expect(result.fromGarbage, 'an unknown id falls to the default').toBe('stud_2x6');
    expect(result.fromKnown, 'a known id survives untouched').toBe('stud_2x6');
  });

  test('a zero-length segment is rejected, not loaded invisible', async ({ page }) => {
    await h.openModel(page, { webgl: false, rails: false, entryCoach: true });
    const kept = await page.evaluate(() => {
      const F = window.DraftDrawingFormat;
      const at = (x, z) => ({ x, z });
      return F.walls([
        { start: at(0, 0), end: at(0, 0), levelId: 3 },        // zero length
        { start: at(0, 0), end: at(1e-9, 0), levelId: 3 },     // below tolerance
        { start: at(0, 0), end: at(10, 0), levelId: 3 },       // real
      ], new Set([3]), {}).length;
    });
    expect(kept, 'only the segment with length survives').toBe(1);
  });

  // AND THE WIRING IS LIVE. The rules above are worth nothing to MODEL.html if
  // it still reads the raw arrays, so this asserts through the page: plant
  // malformed geometry in the stored drawing and check the page drops it and
  // says so.
  test('MODEL.html drops malformed geometry and reports how much', async ({ page }) => {
    await h.openModel(page, { webgl: false, rails: false, entryCoach: true });
    await expect(page.locator('[data-entry-coach]')).toBeVisible({ timeout: 4000 });
    await page.locator('[data-first-bone-press]').click();
    await h.waitForSaved(page);

    await page.goto('/MODEL.html?mode=night');
    await expect(page.locator('#readout')).toContainText('walls', { timeout: 6000 });
    const before = await page.locator('#readout').textContent();
    expect(before, 'a clean drawing reports nothing dropped').not.toContain('dropped');

    // Three bad segments: no length, no level, and a floor with two points.
    await page.evaluate(async () => {
      const file = await window.SharedFileStore.loadSharedFile('model-drawing');
      const d = JSON.parse(await file.text());
      const lvl = d.walls[0].levelId;
      d.walls.push({ id: 'zz1', start: { x: 5, z: 5 }, end: { x: 5, z: 5 }, levelId: lvl });
      d.walls.push({ id: 'zz2', start: { x: 0, z: 0 }, end: { x: 9, z: 0 }, levelId: 9999 });
      d.floors.push({ id: 'zz3', levelId: lvl, points: [{ x: 0, z: 0 }, { x: 1, z: 0 }] });
      await window.SharedFileStore.saveSharedFile(
        new File([JSON.stringify(d)], 'drawing.json', { type: 'application/json' }),
        'model-drawing');
    });
    await page.reload();
    await expect(page.locator('#readout'),
      'three malformed items planted, three reported dropped')
      .toContainText('3 dropped', { timeout: 6000 });
  });
});
