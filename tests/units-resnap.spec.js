// SWITCHING UNITS RE-SNAPS THE DRAWING (board: units round trip).
//
// Before this, switching re-labelled the drawing and left the geometry where
// it was. That reads as the safe option and is not: three 12'-0" walls shown
// in mm print 3658 each against an overall of 10973, so the partials sum to
// 10974 and the sheet is 1 mm out with nothing wrong in the drawing. The only
// fix available to the drafter was to nudge a wall by an amount that exists
// nowhere on screen — which is the exact bug board NEW-5 removed, reappearing
// in the other unit system.
//
// What re-snaps is every quantity the drafter ENTERED: node positions, and
// also the sizes and offsets that are not coordinates at all. A window stores
// width and an offset along its wall, both of which print as dimensions, so
// re-snapping the node pool alone would leave a window measuring 914.4 mm
// inside a wall whose ends read whole millimetres.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const MM_FT = 0.001 / 0.3048;       // one millimetre, in feet
const SIXTEENTH_FT = 1 / 192;
const mm = ft => ft * 304.8;

const offGrid = (value, step) => {
  const n = value / step;
  return Math.abs(n - Math.round(n));
};

// Every coordinate the drawing stores for its own geometry.
const coords = drawing => [
  ...(drawing.lines || []).flatMap(l => [l.start, l.end]),
  ...(drawing.walls || []).flatMap(w => [w.start, w.end]),
  ...(drawing.floors || []).flatMap(f => f.points || []),
  ...(drawing.shapes || []).flatMap(s => s.points || []),
  ...(drawing.boneyardOutlines || []).flatMap(o => o.points || []),
].flatMap(p => [p.x, p.z]);

// ONE button that flips, so driving it means pressing the toggle and checking
// where it landed rather than picking a named button out of a pair.
const unitToggle = page => page.locator('[data-unit-toggle] button');
const setUnits = async (page, name) => {
  const toggle = unitToggle(page);
  if ((await toggle.innerText()).includes(name)) return;   // already there
  await toggle.click();
  await expect(toggle).toHaveText(new RegExp(name));
  await h.waitForSaved(page);
};

// Three walls in a row, drawn on whole feet from an awkward datum so nothing
// else in the snap path can be credited with the result.
const drawRun = async page => {
  await h.selectTool(page, 'Line');
  await h.clickWorld(page, 0, 0);
  await h.clickWorld(page, 12, 0);
  await h.clickWorld(page, 24, 0);
  await h.clickWorld(page, 36, 0);
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);
};

test('switching to metric puts every stored coordinate on the millimetre grid', async ({ page }) => {
  await h.openModel(page, { webgl: false });
  await h.selectTool(page, 'Line');
  await h.clickWorld(page, -7.3137, 4.8291);
  await h.clickWorld(page, 9.1719, -3.4157);
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);

  const before = coords(await h.savedDrawing(page));
  expect(Math.max(...before.map(v => offGrid(v, SIXTEENTH_FT)))).toBeLessThan(1e-6);

  await setUnits(page, 'METRIC');

  const drawing = await h.savedDrawing(page);
  const datum = drawing.drawingOrigin;
  const after = coords(drawing);
  expect(after.length).toBe(before.length);
  // Measured FROM THE DATUM, which is where the grid is counted from.
  const worst = Math.max(
    ...(drawing.lines || []).flatMap(l => [l.start, l.end]).flatMap(p => [
      offGrid(p.x - datum.x, MM_FT), offGrid(p.z - datum.z, MM_FT),
    ]),
  );
  expect(worst).toBeLessThan(1e-6);
});

test('every printed length is a whole millimetre, so the partials sum', async ({ page }) => {
  await h.openModel(page, { webgl: false });
  await drawRun(page);

  // A dimension string rounds each LENGTH on its own — that is where the
  // board's discrepancy comes from. Rounding the node positions and then
  // subtracting them cannot reproduce it: differences of rounded numbers
  // always sum to the rounded total, so an earlier version of this check
  // passed with the re-snap disabled.
  // THE APP'S OWN PRINT FUNCTION, not a stand-in: MODEL.dc.html's _metric is
  // `(feet * 0.3048).toFixed(3) + ' m'`. Three decimals of a metre IS
  // millimetre precision, so this is the string a drafter reads off the sheet.
  const printed = feet => (feet * 0.3048).toFixed(3);
  const strings = drawing => {
    const xs = [...new Set((drawing.lines || []).flatMap(l => [l.start.x, l.end.x]))].sort((a, b) => a - b);
    return {
      segments: xs.slice(1).map((x, i) => printed(x - xs[i])),
      overall: printed(xs[xs.length - 1] - xs[0]),
    };
  };
  const sumOf = segs => segs.reduce((total, s) => total + Number(s), 0).toFixed(3);

  const before = strings(await h.savedDrawing(page));
  // 12'-0" prints 3.658 m. Three of them sum to 10.974 against an overall of
  // 10.973 — the board's millimetre, in the strings themselves.
  expect(before.segments).toEqual(['3.658', '3.658', '3.658']);
  expect(before.overall).toBe('10.973');
  expect(sumOf(before.segments)).not.toBe(before.overall);

  await setUnits(page, 'METRIC');

  const after = strings(await h.savedDrawing(page));
  expect(sumOf(after.segments)).toBe(after.overall);
});

test('a window re-snaps its size and its offset, not only the wall it sits in', async ({ page }) => {
  // A real house with real windows: a fenestration stores width and an offset
  // along its wall, and both print. Re-snapping only the node pool leaves a
  // window measuring 914.4 mm inside a wall whose ends read whole millimetres.
  await h.openModel(page, { autoWindows: true });
  await h.selectTool(page, 'Outline');
  for (const [x, z] of [[-20, -14], [20, -14], [20, 14], [-20, 14]]) await h.clickWorld(page, x, z);
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);
  await h.selectTool(page, 'Outline');
  await page.getByRole('button', { name: 'BUILD HOUSE' }).click();
  await page.waitForTimeout(400);
  await h.waitForSaved(page);

  const built = await h.savedDrawing(page);
  // Guard against a vacuous pass: with no windows there is nothing to assert,
  // and forEach over an empty list is green for the wrong reason.
  expect((built.fenestrations || []).length).toBeGreaterThan(0);
  // A 30" window is 762.0 mm exactly, so WIDTH alone would not show this. The
  // offset along the wall is the one that lands off-grid, which is why the
  // check below covers every stored length rather than the obvious one.

  await setUnits(page, 'METRIC');

  const drawing = await h.savedDrawing(page);
  const lengths = [
    ...(drawing.fenestrations || []).flatMap(f => [f.offset, f.width, f.sillHeight, f.headHeight]),
    ...(drawing.fixtures || []).flatMap(f => [f.offset, f.width, f.depth]),
  ].filter(v => Number.isFinite(v));
  expect(lengths.length).toBeGreaterThan(0);
  lengths.forEach(v => expect(offGrid(v, MM_FT)).toBeLessThan(1e-6));
});

test('imperial to metric and back returns every node exactly where it started', async ({ page }) => {
  await h.openModel(page, { webgl: false });
  await drawRun(page);
  const before = coords(await h.savedDrawing(page));

  await setUnits(page, 'METRIC');
  // Without this the test is vacuous: if nothing ever moved, "it came back"
  // is trivially true and the check would pass with re-snapping disabled.
  const metric = coords(await h.savedDrawing(page));
  expect(metric).not.toEqual(before);

  await setUnits(page, 'IMPERIAL');

  const after = coords(await h.savedDrawing(page));
  expect(after.length).toBe(before.length);
  after.forEach((v, i) => expect(v).toBeCloseTo(before[i], 9));
});

test('opening a drawing never re-snaps it — only the drafter switching does', async ({ page }) => {
  await h.openModel(page, { webgl: false });
  await drawRun(page);
  await setUnits(page, 'METRIC');
  const before = coords(await h.savedDrawing(page));
  const datum = (await h.savedDrawing(page)).drawingOrigin;
  // The switch really did move it onto the mm grid — otherwise "the reload
  // changed nothing" would be true of a page that never snaps at all.
  const lines = (await h.savedDrawing(page)).lines.flatMap(l => [l.start, l.end]);
  lines.forEach(p => expect(offGrid(p.x - datum.x, MM_FT)).toBeLessThan(1e-6));

  await page.reload();
  await h.waitForModelReady(page);

  const after = coords(await h.savedDrawing(page));
  expect(after).toEqual(before);
});

test('the whole switch is one undo, geometry and units together', async ({ page }) => {
  await h.openModel(page, { webgl: false });
  await drawRun(page);
  const before = coords(await h.savedDrawing(page));

  await setUnits(page, 'METRIC');
  expect(coords(await h.savedDrawing(page))).not.toEqual(before);

  await page.keyboard.press('Control+z');
  await h.waitForSaved(page);

  const after = coords(await h.savedDrawing(page));
  after.forEach((v, i) => expect(v).toBeCloseTo(before[i], 9));
});

test('the move is announced, and names what actually moved', async ({ page }) => {
  await h.openModel(page, { webgl: false });
  await drawRun(page);
  await setUnits(page, 'METRIC');
  // Not just the words "Re-snapped": the readout also has a "nothing moved"
  // form, which matched a looser regex even with the re-snap disabled.
  await expect(page.getByText(/Re-snapped to mm — \d+ nodes? .*moved, max /)).toBeVisible();
});

test('the toggle says which unit is in force, not which one a tap would bring', async ({ page }) => {
  await h.openModel(page, { webgl: false });
  const toggle = unitToggle(page);
  // One control, not two: the pair could not be made both disjoint and 44px.
  await expect(toggle).toHaveCount(1);

  // A lone button reading "METRIC" is ambiguous — it can name the state or the
  // action. Naming the state as a statement is what removes the ambiguity, so
  // the label must carry the noun and must not read as a command.
  await expect(toggle).toHaveText(/^UNITS: IMPERIAL$/);
  await expect(toggle).toHaveAttribute('title', /is in imperial/);

  await toggle.click();
  await h.waitForSaved(page);
  await expect(toggle).toHaveText(/^UNITS: METRIC$/);
  await expect(toggle).toHaveAttribute('title', /is in metric/);
});

test('the toggle is one 44px target, with nothing to overlap it', async ({ page }) => {
  await h.openModel(page, { webgl: false });
  const box = await page.evaluate(() => {
    const b = document.querySelector('[data-unit-toggle] button');
    const r = b.getBoundingClientRect();
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    // `hit === b` is the WRONG test: the label is a template interpolation, so
    // the engine wraps it in a span and that span is what sits topmost. A
    // press there still reaches the button. What must not happen is the point
    // belonging to some OTHER control, which is how IMPERIAL was lost.
    return { w: Math.round(r.width), h: Math.round(r.height), reachable: b.contains(hit) };
  });
  expect(box.reachable).toBe(true);
  expect(box.h).toBeGreaterThanOrEqual(44);
  expect(box.w).toBeGreaterThanOrEqual(44);
});
