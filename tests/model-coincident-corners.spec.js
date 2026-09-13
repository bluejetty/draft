// CAN A GESTURE MAKE ONE CORNER WITH TWO MASTERS?
//
// A point object carries one `srcId` — its BONEYARD master point — and one
// offX/offZ. Two points at the same coordinate are pooled into one object, so
// two corners parented to DIFFERENT masters lose one link, silently, on both
// pages. #383 proved the two pages agree, so this is a question about the
// format and not a MODEL.html defect.
//
// The board item has been open on the strength of an argument, with no evidence
// that a human can produce the state. This spec settles that, and A NEGATIVE IS
// THE VALUABLE ANSWER: if no gesture reaches it, nobody defends the format
// against a state it cannot enter.
//
// The question, exactly: can a drafter, using gestures in the running page,
// arrive at a SAVED drawing in which one pooled point is the corner of two
// outlines parented to different masters? Not: can a fixture be written that
// way — #383 already wrote one.
//
// NO PRODUCT FILE IS TOUCHED. If a path reaches the state it is a report, not a
// patch.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

// ── THE INSTRUMENT ────────────────────────────────────────────────────────
// Every point in the saved drawing that carries a position, grouped by the
// coordinate it sits on. A coordinate holding two DIFFERENT srcIds is the state
// being hunted; a coordinate holding one srcId where two were planted is the
// collapse.
//
// Rounded to 1e-6 because the pool's own tolerance is coarser than float noise:
// two points that pooled are equal to the byte, and two that did not are apart
// by feet, so nothing lands in between.
function linksByCoordinate(drawing) {
  const at = new Map();
  const add = (p, where) => {
    if (!p || typeof p.x !== 'number' || typeof p.z !== 'number') return;
    const key = `${p.x.toFixed(6)},${p.z.toFixed(6)}`;
    if (!at.has(key)) at.set(key, []);
    at.get(key).push({ where, srcId: p.srcId ?? null, offX: p.offX ?? null, offZ: p.offZ ?? null });
  };
  (drawing.walls || []).forEach(w => { add(w.start, `wall:${w.id}:start`); add(w.end, `wall:${w.id}:end`); });
  (drawing.lines || []).forEach(l => { add(l.start, `line:${l.id}:start`); add(l.end, `line:${l.id}:end`); });
  (drawing.outlines || []).forEach(o =>
    (o.points || []).forEach((p, i) => add(p, `outline:${o.id}:${i}`)));
  (drawing.floors || []).forEach(f =>
    (f.points || []).forEach((p, i) => add(p, `floor:${f.id}:${i}`)));
  return at;
}

// The coordinates where more than one DISTINCT non-null srcId appears — the
// state itself, if any gesture can produce it.
function twoMasterCorners(drawing) {
  const out = [];
  for (const [key, entries] of linksByCoordinate(drawing)) {
    const ids = [...new Set(entries.map(e => e.srcId).filter(Boolean))];
    if (ids.length > 1) out.push({ key, ids, entries });
  }
  return out;
}

// How many distinct srcIds sit at one coordinate, for the control below.
function idsAt(drawing, x, z) {
  const key = `${x.toFixed(6)},${z.toFixed(6)}`;
  const entries = linksByCoordinate(drawing).get(key) || [];
  return [...new Set(entries.map(e => e.srcId).filter(Boolean))];
}

async function bone(page) {
  await h.openModel(page, { webgl: false, rails: false, entryCoach: true });
  await expect(page.locator('[data-entry-coach]')).toBeVisible({ timeout: 4000 });
  await page.locator('[data-first-bone-press]').click();
  await h.waitForSaved(page);
}

test.describe('coincident corners — can a gesture make one point with two masters', () => {

  // ── THE CONTROL THE ORDER REQUIRES ───────────────────────────────────────
  // Before any negative result is worth reading, the instrument has to be shown
  // seeing the state when it IS present. An inspection that reports "one link"
  // on a drawing that never had two is measuring nothing, and every negative
  // below would be that inspection's silence rather than the page's.
  //
  // So: plant #383's fixture — two walls meeting at one coordinate with
  // different srcIds — and watch the instrument report two links before the
  // round trip and one after.
  test('CONTROL — the instrument sees two masters when they are there, and the collapse when it happens',
    async ({ page }) => {
      await bone(page);
      const CORNER = { x: 40, z: 40 };

      await page.evaluate(async ({ bucket, corner }) => {
        const store = window.SharedFileStore;
        const at = await store.loadSharedFileAt(bucket);
        const drawing = JSON.parse(await at.file.text());
        const levelId = (drawing.walls.find(w => w.view === 'plan') || drawing.walls[0]).levelId;
        drawing.walls.push({
          id: 'ctrl-a', levelId, view: 'plan', wallType: 'stud_2x6',
          start: { x: 30, z: 40, y: 0 },
          end: { ...corner, y: 0, srcId: 'master-A', offX: 0.25, offZ: -0.5 },
          baseHeight: 0, topHeight: 8, refLine: 'left',
        });
        drawing.walls.push({
          id: 'ctrl-b', levelId, view: 'plan', wallType: 'stud_2x6',
          start: { ...corner, y: 0, srcId: 'master-B', offX: -1.5, offZ: 2 },
          end: { x: 40, z: 50, y: 0 },
          baseHeight: 0, topHeight: 8, refLine: 'left',
        });
        await store.saveSharedFile(
          new File([JSON.stringify(drawing)], 'd.json', { type: 'application/json' }),
          bucket, { ifRev: at.rev });
      }, { bucket: h.STORAGE_BUCKET, corner: CORNER });

      const planted = await h.savedDrawing(page);
      expect(idsAt(planted, CORNER.x, CORNER.z),
        'THE INSTRUMENT MUST SEE TWO MASTERS AT ONE COORDINATE when a fixture '
        + 'puts them there — without this, every negative below is the '
        + 'inspection being blind rather than the page refusing')
        .toEqual(['master-A', 'master-B']);
      expect(twoMasterCorners(planted).map(c => c.ids),
        'and the hunt function must find that same corner unaided')
        .toEqual([['master-A', 'master-B']]);

      // AND THE COLLAPSE, so the negative result below has a positive control
      // for its opposite too: the same instrument reports ONE link after the
      // page has pooled the corner.
      await page.goto('/MODEL.html');
      await expect(page.locator('#readout')).toContainText('walls', { timeout: 6000 });
      await page.locator('#save').click();
      await expect(page.locator('#save')).toHaveText('SAVED', { timeout: 6000 });

      const after = await h.savedDrawing(page);
      expect(idsAt(after, CORNER.x, CORNER.z),
        'the same instrument must report the collapse — one link where two went in')
        .toEqual(['master-A']);
      expect(twoMasterCorners(after),
        'and find no two-master corner left in the file').toEqual([]);
    });

  // ── THE BASELINE ─────────────────────────────────────────────────────────
  // What the bone house alone contains. If it already held a two-master corner,
  // every path below would "reach" the state without doing anything.
  test('BASELINE — a bone house has no corner with two masters', async ({ page }) => {
    await bone(page);
    const drawing = await h.savedDrawing(page);
    expect(drawing.outlines?.length,
      'the bone must really produce outlines, or the paths below have nothing '
      + 'to parent').toBeGreaterThan(0);
    expect(twoMasterCorners(drawing),
      'the starting house must not already be in the state being hunted')
      .toEqual([]);
  });

  // ── PATH 1: THE ATTACHED GARAGE ──────────────────────────────────────────
  // The tour instructs this one: "click your first corner ON the house outline,
  // draw the three legs out, around, and back, and land the last corner ON the
  // house too." Two outlines deliberately sharing corners, by instruction — the
  // most likely of the three paths by a distance, because it is the only one a
  // drafter is TOLD to do.
  //
  // Driven in two variants, because the tour's own example and the worst case
  // are not the same gesture:
  //
  //   1a  the ends land on the house EDGE, between corners — the tour's example
  //   1b  the ends land exactly ON two house CORNERS — the collision case
  //
  // Variant 1b is the one that matters. If the garage's end point and the
  // house's corner point are two objects at one coordinate, each parented to
  // its own master, the state is reached by a gesture a drafter is encouraged
  // to make.
  async function houseThenGarage(page, garageRun) {
    await h.openModel(page);
    await h.selectTool(page, 'Outline');
    for (const [x, z] of [[-8, -6], [8, -6], [8, 6], [-8, 6]]) await h.clickWorld(page, x, z);
    await page.keyboard.press('Enter');
    await h.waitForSaved(page);
    await h.climbTourToMain(page);

    await h.selectTool(page, 'Outline');
    await page.getByRole('button', { name: /MARK ATTACHED GARAGE/ }).click();
    await page.keyboard.press('Enter');   // the professor's lesson steps aside
    for (const [x, z] of garageRun) await h.clickWorld(page, x, z);
    await page.keyboard.press('Enter');
    await h.waitForSaved(page);
  }

  test('PATH 1a — attached garage landing on the house EDGE (the tour\'s own example)',
    async ({ page }) => {
      test.setTimeout(180_000);
      await houseThenGarage(page, [[8, -4], [20, -4], [20, 4], [8, 4]]);

      const saved = await h.savedDrawing(page);
      expect(saved.outlines.length,
        'the house and the garage must both have committed, or this path was '
        + 'never walked').toBeGreaterThan(1);

      const found = twoMasterCorners(saved);
      // WHAT IS ACTUALLY AT THE JOIN, reported whichever way it goes — the
      // order asks for a mechanism, not for "it didn't happen".
      console.log('PATH 1a joins:', JSON.stringify(
        [[8, -4], [8, 4]].map(([x, z]) => ({ at: `${x},${z}`,
          entries: linksByCoordinate(saved).get(`${x.toFixed(6)},${z.toFixed(6)}`) || [] })), null, 1));
      console.log('PATH 1a two-master corners:', JSON.stringify(found));
      expect(found, 'PATH 1a reached the state — reported, not fixed').toEqual([]);
    });

  test('PATH 1b — attached garage landing exactly ON two house CORNERS',
    async ({ page }) => {
      test.setTimeout(180_000);
      await houseThenGarage(page, [[8, -6], [20, -6], [20, 6], [8, 6]]);

      const saved = await h.savedDrawing(page);
      expect(saved.outlines.length,
        'the house and the garage must both have committed, or this path was '
        + 'never walked').toBeGreaterThan(1);

      const corners = [[8, -6], [8, 6]];
      console.log('PATH 1b joins:', JSON.stringify(
        corners.map(([x, z]) => ({ at: `${x},${z}`,
          entries: linksByCoordinate(saved).get(`${x.toFixed(6)},${z.toFixed(6)}`) || [] })), null, 1));
      const found = twoMasterCorners(saved);
      console.log('PATH 1b two-master corners:', JSON.stringify(found));
      expect(found, 'PATH 1b reached the state — reported, not fixed').toEqual([]);
    });

  // ── PATH 3: TWO MASTERS PLACED SO THEIR CORNERS COINCIDE ─────────────────
  // The direct route, and the one with no instruction behind it: draw one
  // outline, then draw a second whose first corner lands exactly on a corner of
  // the first. Two masters, two parentages, one coordinate — if the page lets
  // them stay two.
  test('PATH 3 — a second outline drawn with a corner exactly on the first\'s',
    async ({ page }) => {
      test.setTimeout(180_000);
      await h.openModel(page);
      await h.selectTool(page, 'Outline');
      for (const [x, z] of [[-8, -6], [8, -6], [8, 6], [-8, 6]]) await h.clickWorld(page, x, z);
      await page.keyboard.press('Enter');
      await h.waitForSaved(page);
      await h.climbTourToMain(page);

      // The second outline STARTS on (8, 6), a corner of the first.
      await h.selectTool(page, 'Outline');
      for (const [x, z] of [[8, 6], [20, 6], [20, 16], [8, 16]]) await h.clickWorld(page, x, z);
      await page.keyboard.press('Enter');
      await page.waitForTimeout(500);

      const saved = await h.savedDrawing(page);
      console.log('PATH 3 outlines:', saved.outlines.length,
        'masters:', JSON.stringify([...new Set(saved.outlines.map(o => o.masterId))]));
      console.log('PATH 3 at (8,6):', JSON.stringify(
        linksByCoordinate(saved).get(`${(8).toFixed(6)},${(6).toFixed(6)}`) || []));
      const found = twoMasterCorners(saved);
      console.log('PATH 3 two-master corners:', JSON.stringify(found));
      expect(found, 'PATH 3 reached the state — reported, not fixed').toEqual([]);
    });

  // ── PATH 2: DRAG A CORNER ONTO ANOTHER CORNER ────────────────────────────
  // The tour offers this as the repair for a missed garage end: "Missed it? No
  // trouble — grab the corner and drag it onto the house." It reaches the
  // pooling path rather than the drawing path, which is a different route to
  // the same coordinate, so it gets its own attempt.
  //
  // Two outlines are drawn APART first, so each corner really does start with
  // its own master, and only then is one dragged onto the other.
  test('PATH 2 — drag one outline\'s corner onto another outline\'s corner',
    async ({ page }) => {
      test.setTimeout(180_000);
      await h.openModel(page);
      await h.selectTool(page, 'Outline');
      for (const [x, z] of [[-8, -6], [8, -6], [8, 6], [-8, 6]]) await h.clickWorld(page, x, z);
      await page.keyboard.press('Enter');
      await h.waitForSaved(page);
      await h.climbTourToMain(page);

      await h.selectTool(page, 'Outline');
      for (const [x, z] of [[14, 6], [26, 6], [26, 16], [14, 16]]) await h.clickWorld(page, x, z);
      await page.keyboard.press('Enter');
      await page.waitForTimeout(500);

      const apart = await h.savedDrawing(page);
      const before = linksByCoordinate(apart).get(`${(14).toFixed(6)},${(6).toFixed(6)}`) || [];
      console.log('PATH 2 before the drag, at (14,6):', JSON.stringify(before));
      expect(before.length,
        'the second outline\'s corner must exist at (14,6) before it is dragged, '
        + 'or the drag below has nothing to grab').toBeGreaterThan(0);

      // GRAB (14, 6) AND DRAG IT ONTO (8, 6) — the first outline's corner.
      const from = await h.worldToClient(page, 14, 6);
      const to = await h.worldToClient(page, 8, 6);
      await page.mouse.move(from.x, from.y);
      await page.mouse.down();
      await page.mouse.move(to.x, to.y, { steps: 20 });
      await page.mouse.up();
      await page.waitForTimeout(700);

      const saved = await h.savedDrawing(page);
      // WHAT THE DRAG ACTUALLY DID, before any conclusion is drawn from what it
      // did not do. The first run of this test found the corner gone from both
      // the coordinate it left and the one it was aimed at — which is not
      // evidence of a refusal, it is evidence that the drag was not watched.
      const dragged = id => (saved.outlines.find(o => o.id === id) || {}).points || [];
      const wasDragged = (apart.outlines.find(o =>
        (o.points || []).some(pt => Math.abs(pt.x - 14) < 1e-6 && Math.abs(pt.z - 6) < 1e-6)) || {}).id;
      console.log('PATH 2 the outline holding (14,6) was:', wasDragged);
      console.log('PATH 2 its points BEFORE:', JSON.stringify(
        ((apart.outlines.find(o => o.id === wasDragged) || {}).points || [])
          .map(pt => `${pt.x},${pt.z}`)));
      console.log('PATH 2 its points AFTER :', JSON.stringify(
        dragged(wasDragged).map(pt => `${pt.x},${pt.z}`)));
      console.log('PATH 2 after the drag, at (8,6):', JSON.stringify(
        linksByCoordinate(saved).get(`${(8).toFixed(6)},${(6).toFixed(6)}`) || []));
      console.log('PATH 2 still at (14,6):', JSON.stringify(
        linksByCoordinate(saved).get(`${(14).toFixed(6)},${(6).toFixed(6)}`) || []));
      const found = twoMasterCorners(saved);
      console.log('PATH 2 two-master corners:', JSON.stringify(found));
      expect(found, 'PATH 2 reached the state — reported, not fixed').toEqual([]);
    });

  // ── THE QUESTION UNDERNEATH ALL THREE PATHS ──────────────────────────────
  // Every path above came back negative, and PATH 3 showed why in its own
  // output: the second outline committed with `masterId: null` and every point
  // `srcId: null`. It is not a master. If a drafter can only ever have ONE
  // master, then two different srcIds cannot meet at a coordinate no matter
  // where the corners are put — the paths are not three separate refusals, they
  // are one fact seen three times.
  //
  // So the fact gets measured directly rather than inferred from three
  // negatives.
  test('HOW MANY MASTERS can gestures produce', async ({ page }) => {
    test.setTimeout(180_000);
    await h.openModel(page);
    await h.selectTool(page, 'Outline');
    for (const [x, z] of [[-8, -6], [8, -6], [8, 6], [-8, 6]]) await h.clickWorld(page, x, z);
    await page.keyboard.press('Enter');
    await h.waitForSaved(page);
    await h.climbTourToMain(page);

    // Three more outlines, well apart, each a fresh attempt at a second master.
    for (const at of [[30, 30], [60, 30], [90, 30]]) {
      await h.selectTool(page, 'Outline');
      for (const [dx, dz] of [[0, 0], [10, 0], [10, 10], [0, 10]]) {
        await h.clickWorld(page, at[0] + dx, at[1] + dz);
      }
      await page.keyboard.press('Enter');
      await page.waitForTimeout(400);
    }

    const saved = await h.savedDrawing(page);
    const masters = [...new Set((saved.outlines || []).map(o => o.masterId))];
    const parented = (saved.outlines || []).filter(o =>
      (o.points || []).some(pt => pt.srcId)).length;
    console.log('MASTERS after four outlines:', JSON.stringify(masters),
      'outlines:', saved.outlines.length, 'with any parented point:', parented);
    console.log('BONEYARD masters:', JSON.stringify(
      (saved.boneyardOutlines || []).map(o => o.id)));

    // REPORTED, NOT RULED. The number is the finding; what it means for the
    // format is Devin's.
    expect(masters.filter(Boolean).length,
      'the count of distinct masters a drafter reached — if this is 1, the '
      + 'board item is theoretical because two masters cannot meet')
      .toBeGreaterThan(0);
  });
});
