// THE TURTLE, the NOTES pad's third tab (Movie, 10 Nov: "was thinking of
// adding a column / TURTLE ... i'd like a 2 column s, each row will be a new
// MOVE for the line ... i can either press (draw on registration point the
// GOLD target) or select location to start as 2nd option" -- "select the
// TURTLE CREATED item ... press REGENERATE and it will go to the new numbers
// ... same start point ... all the dimensions should still link properly" --
// "once the guy returns perfectly the position where he started all the
// TURTLE numbers glow green"). The arithmetic is proved in
// proto/turtle-path-harness.js; these check the pad, the lines and the link.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const drawing = (extra = {}) => ({
  version: 1, planTurn: 0,
  levels: [{ id: 8, name: 'SITE', elev: 0 }, { id: 7, name: 'ROOF', elev: 0 },
    { id: 5, name: '2ND FL', elev: 9 }, { id: 3, name: 'MAIN FL', elev: 0 },
    { id: 1, name: 'FOUNDATION', elev: -8 }],
  activeLevelIdx: 3,
  walls: [], lines: [], floors: [], roofs: [], fenestrations: [], dimensions: [],
  outlines: [], shapes: [], surfaceOpenings: [], stairs: [], notes: [],
  roomTags: [], columns: [], beams: [], boneyardOutlines: [],
  groups: [], levelLocks: [], underlays: [],
  ...extra,
});

async function open(page, f = drawing()) {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, f }) => {
    localStorage.removeItem('draft.turtle');
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, f });
  await page.goto('/MODEL.html');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
}
const box = page => page.locator('[data-turtle]');
const status = page => page.locator('[data-turtle-status]');
const dirAt = (page, i) => page.locator(`[data-turtle-row="${i}"] [data-turtle-dir]`);
const distAt = (page, i) => page.locator(`[data-turtle-row="${i}"] [data-turtle-dist]`);
const act = (page, what) => page.locator(`[data-turtle-do="${what}"]`);
const chip = page => page.locator('[data-turtle-lamp-chip]');
async function openTurtle(page) {
  const tab = page.locator('#notes-tab');
  if (await tab.getAttribute('aria-expanded') !== 'true') await tab.click();
  await page.locator('[data-pad-tab="turtle"]').click();
  await expect(box(page)).toBeVisible();
}
async function typeRows(page, rows) {
  for (let i = 0; i < rows.length; i += 1) {
    await dirAt(page, i).fill(rows[i][0]);
    await distAt(page, i).fill(rows[i][1]);
  }
}
const SQUARE = [['W', '100'], ['N', '50'], ['E', '100'], ['S', '50']];
const pageLines = page => page.evaluate(() => (drawing.lines || []).map(l => ({
  id: l.id, levelId: l.levelId, view: l.view, layer: l.layer,
  start: [+l.start.x.toFixed(3), +l.start.z.toFixed(3)], end: [+l.end.x.toFixed(3), +l.end.z.toFixed(3)] })));
const pageGroups = page => page.evaluate(() => (drawing.groups || []).map(g => ({ id: g.id, name: g.name, members: g.members.map(m => `${m.type}:${m.id}`) })));
async function saved(page) {
  await page.locator('#save').click();
  await h.waitForSaved(page);
  return h.savedDrawing(page);
}

test('TURTLE is the third tab on the pad: a direction and a distance per row, a blank row always waiting', async ({ page }) => {
  await open(page);
  await openTurtle(page);
  await expect(page.locator('[data-pad-tab="turtle"]')).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('[data-notes-text]')).toBeHidden();
  await expect(page.locator('[data-calc]')).toBeHidden();
  await expect(status(page)).toHaveText('NO MOVES YET');
  await expect(page.locator('[data-turtle-row]')).toHaveCount(1);
  // Typing in the blank row makes it a move and opens the next.
  await dirAt(page, 0).fill('W');
  await expect(page.locator('[data-turtle-row]')).toHaveCount(2);
  await distAt(page, 0).fill('86.86');
  await expect(status(page)).toContainText('OPEN');
  await expect(status(page)).toContainText('1 MOVE');
  // ENTER walks direction, distance, next row.
  await dirAt(page, 1).focus();
  await page.keyboard.type('N');
  await page.keyboard.press('Enter');
  await expect(distAt(page, 1)).toBeFocused();
  await page.keyboard.type('106.87');
  await page.keyboard.press('Enter');
  await expect(dirAt(page, 2)).toBeFocused();
  // A direction that reads as nothing is marked, and the gap counts.
  await dirAt(page, 2).fill('NS');
  await distAt(page, 2).fill('5');
  await expect(dirAt(page, 2)).toHaveAttribute('data-bad', '');
  await expect(status(page)).toContainText('2 MOVES');
  // The table survives a reload before it is drawn.
  await page.reload();
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  await openTurtle(page);
  await expect(distAt(page, 1)).toHaveValue('106.87');
});

test('a path that comes home lights the pad and the strip lamp green; one that does not says its gap', async ({ page }) => {
  await open(page);
  await openTurtle(page);
  await typeRows(page, [['W', '86.86'], ['N', '106.87'], ['E', '106.86'], ['S', '106.87']]);
  await expect(status(page)).toContainText('OPEN');
  await expect(status(page)).toContainText(`GAP 20'-0"`);
  await expect(box(page)).not.toHaveAttribute('data-closed', '');
  await expect(chip(page)).not.toHaveClass(/home/);
  await distAt(page, 0).fill('106.86');
  await expect(status(page)).toContainText('CLOSED');
  await expect(box(page)).toHaveAttribute('data-closed', '');
  await expect(chip(page)).toHaveClass(/home/);
  const green = await distAt(page, 0).evaluate(el => getComputedStyle(el).color);
  expect(green).toBe('rgb(18, 138, 56)');
  // Any order of letters, a bearing, degrees and a turn all read.
  await typeRows(page, [['SWW', '10'], ['N 30 E', '10'], ['45', '10'], ['R90', '10']]);
  for (let i = 0; i < 4; i += 1) await expect(dirAt(page, i)).not.toHaveAttribute('data-bad', '');
});

test('DRAW AT TARGET draws the moves as one TURTLE assembly of lines from the gold target, saved with its table', async ({ page }) => {
  await open(page);
  await openTurtle(page);
  await typeRows(page, SQUARE);
  await act(page, 'target').click();
  const lines = await pageLines(page);
  expect(lines).toHaveLength(4);
  // The empty sheet's target is the origin; W first, then N (-z), E, S home.
  expect(lines.map(l => [l.start, l.end])).toEqual([
    [[0, 0], [-100, 0]], [[-100, 0], [-100, -50]], [[-100, -50], [0, -50]], [[0, -50], [0, 0]]]);
  expect(lines.every(l => l.levelId === 3 && l.view === 'plan' && l.layer === 'draft')).toBe(true);
  const groups = await pageGroups(page);
  expect(groups).toHaveLength(1);
  expect(groups[0].name).toBe('TURTLE 1');
  expect(groups[0].members).toEqual(lines.map(l => `line:${l.id}`));
  // Selected as drawn, and the pad names the path.
  expect(await page.evaluate(() => selection.map(e => e.type))).toEqual(['line', 'line', 'line', 'line']);
  await expect(page.locator('[data-turtle-name]')).toHaveText('TURTLE 1');
  await expect(page.locator('#strip-message')).toContainText('4 lines drawn, and the path closes');
  const file = await saved(page);
  expect(file.turtles).toHaveLength(1);
  expect(file.turtles[0].rows).toEqual(SQUARE.map(([dir, dist]) => ({ dir, dist })));
  expect(file.turtles[0].itemIds).toEqual(lines.map(l => l.id));
  expect(file.turtles[0].kind).toBe('lines');
  expect(file.turtles[0].start).toEqual({ x: 0, z: 0 });
  // One UNDO takes the whole path out, lines, assembly and table record.
  await page.keyboard.press('Control+z');
  expect(await pageLines(page)).toHaveLength(0);
  expect(await pageGroups(page)).toHaveLength(0);
  expect(await page.evaluate(() => (drawing.turtles || []).length)).toBe(0);
});

test('DRAW AT POINT starts the path where the sheet is pressed, on a corner it is near', async ({ page }) => {
  await open(page);
  await openTurtle(page);
  await typeRows(page, [['N', '10'], ['E', '10']]);
  // A line whose end sits a third of the way across the sheet, LEFT of the
  // pad (which stands over the sheet's right-hand side), put there by the
  // page's own pool so its corner is a node.
  const { at, cx, cz, scale, box } = await h.planFrame(page);
  const W = { x: Math.round(cx + (box.width * 0.3 - box.width / 2) / scale), z: Math.round(cz) };
  await page.evaluate(({ W }) => {
    drawing.lines.push({ id: 'line-1', start: poolVertex({ x: W.x - 20, z: W.z }, 3, 'plan'),
      end: poolVertex({ x: W.x, z: W.z }, 3, 'plan'), levelId: 3, view: 'plan', layer: 'draft' });
    paint();
  }, { W });
  await act(page, 'point').click();
  await expect(act(page, 'point')).toHaveAttribute('data-armed', '');
  await expect(page.locator('#strip-message')).toContainText('press the start point');
  // Half a foot off the line's end: the start lands ON the corner.
  const [sx, sy] = at(W.x + 0.4, W.z + 0.3);
  await page.mouse.click(sx, sy);
  const lines = await pageLines(page);
  expect(lines).toHaveLength(3);
  expect(lines[1].start).toEqual([W.x, W.z]);
  expect(lines[1].end).toEqual([W.x, W.z - 10]);
  expect(lines[2].end).toEqual([W.x + 10, W.z - 10]);
  await expect(act(page, 'point')).not.toHaveAttribute('data-armed', '');
  // Two lines are an assembly; the seeded line is not in it.
  const groups = await pageGroups(page);
  expect(groups[0].members).toEqual([`line:${lines[1].id}`, `line:${lines[2].id}`]);
});

test('REGENERATE moves the same lines to the new numbers from the same start; a row put in adds a line, a row taken out drops one', async ({ page }) => {
  await open(page);
  await openTurtle(page);
  await typeRows(page, SQUARE);
  await act(page, 'target').click();
  const before = await pageLines(page);
  // Wider and shorter: the ids stay, the corners move, the start does not.
  await distAt(page, 0).fill('120');
  await distAt(page, 1).fill('40');
  await distAt(page, 2).fill('120');
  await distAt(page, 3).fill('40');
  // Until REGENERATE the rows whose lines no longer agree are marked.
  await expect(page.locator('[data-turtle-row="0"]')).toHaveAttribute('data-off', '');
  await act(page, 'regen').click();
  const after = await pageLines(page);
  expect(after.map(l => l.id)).toEqual(before.map(l => l.id));
  expect(after.map(l => [l.start, l.end])).toEqual([
    [[0, 0], [-120, 0]], [[-120, 0], [-120, -40]], [[-120, -40], [0, -40]], [[0, -40], [0, 0]]]);
  await expect(page.locator('[data-turtle-row="0"]')).not.toHaveAttribute('data-off', '');
  await expect(page.locator('#strip-message')).toContainText('4 lines regenerated, and the path closes');
  // A fifth move put in after the second: a new line, the others as they were.
  await page.locator('[data-turtle-insert="1"]').click();
  await expect(dirAt(page, 2)).toBeFocused();
  await dirAt(page, 2).fill('W');
  await distAt(page, 2).fill('10');
  await act(page, 'regen').click();
  const five = await pageLines(page);
  expect(five).toHaveLength(5);
  expect(five.slice(0, 2).map(l => l.id)).toEqual(before.slice(0, 2).map(l => l.id));
  expect(five[2].end).toEqual([-130, -40]);
  expect(await page.evaluate(() => drawing.groups[0].members.length)).toBe(5);
  await expect(status(page)).toContainText('OPEN');
  // Taken out again: back to four, and home.
  await page.locator('[data-turtle-remove="2"]').click();
  await act(page, 'regen').click();
  expect((await pageLines(page)).map(l => l.id)).toEqual(before.map(l => l.id));
  await expect(status(page)).toContainText('CLOSED');
  // The table rides in the file with the new numbers.
  const file = await saved(page);
  expect(file.turtles[0].rows[0].dist).toBe('120');
  expect(file.lines).toHaveLength(4);
  // UNDO of a REGENERATE puts the lines back where they were.
  await page.keyboard.press('Control+z');
  await page.keyboard.press('Control+z');
  await page.keyboard.press('Control+z');
  expect((await pageLines(page)).map(l => [l.start, l.end])).toEqual(before.map(l => [l.start, l.end]));
});

test('picking a turtle line on the sheet brings its table back; a path moved whole regenerates where it stands', async ({ page }) => {
  await open(page);
  await openTurtle(page);
  await typeRows(page, [['E', '30'], ['N', '20']]);
  await act(page, 'target').click();
  await act(page, 'new').click();
  await expect(page.locator('[data-turtle-name]')).toHaveText('NEW PATH');
  await expect(page.locator('[data-turtle-row]')).toHaveCount(1);
  // Move the drawn path on the sheet by its record, as MOVE would.
  await page.evaluate(() => {
    drawing.lines.forEach(l => { [l.start, l.end].forEach(v => { v.x += 5; v.z += 5; }); });
    setSelection([{ type: 'line', item: drawing.lines[0] }]);
    paint();
  });
  await expect(page.locator('[data-turtle-name]')).toHaveText('TURTLE 1');
  await expect(distAt(page, 0)).toHaveValue('30');
  await distAt(page, 1).fill('25');
  await act(page, 'regen').click();
  const lines = await pageLines(page);
  expect(lines[0].start).toEqual([5, 5]);
  expect(lines[1].end).toEqual([35, -20]);
});

test('FROM NOTES reads the moves off the pad the way Movie wrote them', async ({ page }) => {
  await open(page, drawing({ notepad: 'duplex condo site\nW 86.86 - 20\nN 106.87\nE 106.86\nS 106.87\n' }));
  await openTurtle(page);
  await act(page, 'notes').click();
  await expect(page.locator('[data-turtle-row]')).toHaveCount(5);
  await expect(dirAt(page, 0)).toHaveValue('W');
  await expect(distAt(page, 0)).toHaveValue('86.86');
  await expect(distAt(page, 3)).toHaveValue('106.87');
  await expect(status(page)).toContainText(`GAP 20'-0"`);
  // The strip lamp opens the pad on TURTLE. It stands only on a sheet
  // wider than 1300, where the dormant chips stood before it.
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.locator('#notes-tab').click();
  await expect(box(page)).toBeHidden();
  await chip(page).click();
  await expect(box(page)).toBeVisible();
});

// DRAW AS (Movie, 10 Nov: "the turtle should be able to be used for the
// SITE PLAN for sure, and then also for the build house outline ... or a
// choice ... AREA / SHAPE").
const kind = (page, k) => page.locator(`[data-turtle-kind="${k}"]`);
test('DRAW AS LOT makes the SITE PLAN lot line from a closed path, and REGENERATE moves its corners in place', async ({ page }) => {
  await open(page);
  await openTurtle(page);
  await typeRows(page, [['W', '86.86'], ['N', '106.87'], ['E', '106.86'], ['S', '106.87']]);
  await kind(page, 'lot').click();
  await expect(kind(page, 'lot')).toHaveAttribute('aria-pressed', 'true');
  // Open by 20 feet: nothing is drawn, and the strip says so.
  await act(page, 'target').click();
  await expect(page.locator('#strip-message')).toContainText(`LOT needs the path to come home`);
  expect(await page.evaluate(() => (drawing.outlines || []).length)).toBe(0);
  await distAt(page, 0).fill('106.86');
  await act(page, 'target').click();
  const lots = await page.evaluate(() => drawing.outlines.map(o => ({ id: o.id, site: o.site, levelId: o.levelId,
    points: o.points.map(p => [+p.x.toFixed(2), +p.z.toFixed(2)]) })));
  expect(lots).toHaveLength(1);
  expect(lots[0].site).toBe(true);
  expect(lots[0].levelId).toBe(8);
  expect(lots[0].points).toEqual([[0, 0], [-106.86, 0], [-106.86, -106.87], [0, -106.87]]);
  expect(await page.evaluate(() => drawing.lot)).toEqual({ widthFt: 106.86, depthFt: 106.87, tier: null });
  await expect(page.locator('[data-turtle-name]')).toHaveText('LOT');
  // Deeper: the same outline, its corners moved; the second lot takes the
  // first's place rather than standing beside it.
  await distAt(page, 1).fill('120');
  await distAt(page, 3).fill('120');
  await act(page, 'regen').click();
  const again = await page.evaluate(() => drawing.outlines.map(o => ({ id: o.id, points: o.points.map(p => [+p.x.toFixed(2), +p.z.toFixed(2)]) })));
  expect(again).toHaveLength(1);
  expect(again[0].id).toBe(lots[0].id);
  expect(again[0].points[2]).toEqual([-106.86, -120]);
  const file = await saved(page);
  expect(file.turtles[0].kind).toBe('lot');
  expect(file.turtles[0].itemIds).toEqual([lots[0].id]);
});

test('DRAW AS HOUSE makes the outline the bone builds on, a copy on every level; AREA makes a shape', async ({ page }) => {
  await open(page);
  await openTurtle(page);
  await typeRows(page, [['E', '40'], ['N', '30'], ['W', '40'], ['S', '30']]);
  await kind(page, 'house').click();
  await act(page, 'target').click();
  const house = await page.evaluate(() => ({
    masters: (drawing.boneyardOutlines || []).length,
    copies: drawing.outlines.map(o => ({ levelId: o.levelId, masterId: o.masterId, n: o.points.length })),
    picked: selection.map(e => `${e.type}:${e.item.levelId}`),
  }));
  expect(house.masters).toBe(1);
  expect(house.copies.map(c => c.levelId).sort()).toEqual([1, 3, 5, 7, 8]);
  expect(house.copies.every(c => c.n === 4 && c.masterId)).toBe(true);
  expect(house.picked).toEqual(['outline:3']);
  await expect(page.locator('#strip-message')).toContainText('press the bone to build on it');
  // Wider: every copy and the master move together, the same records.
  await distAt(page, 0).fill('50');
  await distAt(page, 2).fill('50');
  await act(page, 'regen').click();
  const wider = await page.evaluate(() => ({
    master: drawing.boneyardOutlines[0].points.map(p => [p.x, p.z]),
    copies: drawing.outlines.map(o => o.points[1].x),
  }));
  expect(wider.master).toEqual([[0, 0], [50, 0], [50, -30], [0, -30]]);
  expect(wider.copies).toEqual([50, 50, 50, 50, 50]);
  // AREA on a new page: a shape on this level.
  await page.locator('[data-notes-page="2"]').click();
  await expect(page.locator('[data-turtle-row]')).toHaveCount(1);
  await typeRows(page, [['N', '10'], ['E', '10'], ['S', '10'], ['W', '10']]);
  await kind(page, 'area').click();
  await act(page, 'target').click();
  const shapes = await page.evaluate(() => drawing.shapes.map(sh => ({ levelId: sh.levelId, layer: sh.layer, n: sh.points.length })));
  expect(shapes).toEqual([{ levelId: 3, layer: 'SHAPE', n: 4 }]);
  await expect(page.locator('[data-turtle-name]')).toHaveText('AREA / SHAPE');
  // Back on page 1 the house's table is still there, lit as HOUSE.
  await page.locator('[data-notes-page="1"]').click();
  await expect(page.locator('[data-turtle-name]')).toHaveText('HOUSE OUTLINE');
  await expect(distAt(page, 0)).toHaveValue('50');
  // One UNDO per draw.
  await page.keyboard.press('Control+z');
  expect(await page.evaluate(() => (drawing.shapes || []).length)).toBe(0);
});

// FIVE PAGES ON EVERY TAB (Movie, 10 Nov: "the number should apply for
// notes, and then also for CALC ... and for TURTLE they can make multiple
// outlines / site plan etc"), all of it in the .draft ("keep it all in the
// draft package with the plans") and in one .txt (SAVE AS TXT / OPEN TXT).
test('CALC and TURTLE pages are each their own, ride in the .draft, and the whole pad saves to one .txt and opens from it', async ({ page }) => {
  await open(page);
  await openTurtle(page);
  await typeRows(page, [['N', '10'], ['R', '10']]);
  await page.locator('[data-notes-page="3"]').click();
  await expect(page.locator('[data-turtle-row]')).toHaveCount(1);
  await expect(page.locator('[data-notes-page="1"]')).toHaveAttribute('data-written', '');
  await typeRows(page, [['S', '5']]);
  await kind(page, 'lot').click();
  // CALC: a sum on page 1, another on page 2; page 1 keeps its tape.
  await page.locator('[data-pad-tab="calc"]').click();
  await expect(page.locator('[data-notes-page="1"]')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('[data-calc-line]').fill('12 x 10');
  await page.keyboard.press('Enter');
  await page.locator('[data-notes-page="2"]').click();
  await expect(page.locator('[data-calc-row]')).toHaveCount(0);
  await page.locator('[data-calc-line]').fill("10' + 2'");
  await page.keyboard.press('Enter');
  await page.locator('[data-calc-line]').fill('3 x');
  await page.locator('[data-notes-page="1"]').click();
  await expect(page.locator('[data-calc-row]')).toHaveCount(1);
  await expect(page.locator('[data-calc-row] .an')).toHaveText('120 sq ft');
  await page.locator('[data-pad-tab="notes"]').click();
  await page.locator('[data-notes-text]').fill('lot one');
  // In the file.
  const file = await saved(page);
  expect(file.calcPages.pages[0].map(r => r.line)).toEqual(['12 x 10']);
  expect(file.calcPages.pages[1].map(r => r.main)).toEqual([`12'-0"`]);
  expect(file.calcPages.lines[1]).toBe('3 x');
  expect(file.turtlePages[0]).toEqual({ rows: [{ dir: 'N', dist: '10' }, { dir: 'R', dist: '10' }], kind: 'lines' });
  expect(file.turtlePages[2]).toEqual({ rows: [{ dir: 'S', dist: '5' }], kind: 'lot' });
  // The file opened fresh in a browser that kept nothing brings them back.
  await page.evaluate(() => ['draft.notepad', 'draft.notepad.pages', 'draft.calc', 'draft.turtle', 'draft.turtle.page'].forEach(k => localStorage.removeItem(k)));
  await page.reload();
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  await openTurtle(page);
  await page.locator('[data-notes-page="3"]').click();
  await expect(distAt(page, 0)).toHaveValue('5');
  await expect(kind(page, 'lot')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('[data-pad-tab="calc"]').click();
  await page.locator('[data-notes-page="2"]').click();
  await expect(page.locator('[data-calc-row]')).toHaveCount(1);
  await expect(page.locator('[data-calc-line]')).toHaveValue('3 x');
  // The one .txt: every page headed, and read back the same.
  const text = await page.evaluate(() => notepadAsText());
  expect(text).toContain('=== NOTES PAGE 1 ===\nlot one');
  expect(text).toContain('=== CALC PAGE 1 ===\n12 x 10 = 120 sq ft');
  expect(text).toContain(`=== CALC PAGE 2 ===\n10' + 2' = 12'-0"\n3 x`);
  expect(text).toContain('=== TURTLE PAGE 1 (LINES) ===\nN\t10\nR\t10');
  expect(text).toContain('=== TURTLE PAGE 3 (LOT) ===\nS\t5');
  const back = await page.evaluate(t => notepadFromText(t), text);
  expect(back.notes[0]).toBe('lot one');
  expect(back.calc[0].tape.map(r => r.main)).toEqual(['120 sq ft']);
  expect(back.calc[1].line).toBe('3 x');
  expect(back.turtle[0].rows).toEqual([{ dir: 'N', dist: '10' }, { dir: 'R', dist: '10' }]);
  expect(back.turtle[2]).toEqual({ rows: [{ dir: 'S', dist: '5' }], kind: 'lot' });
  // A plain .txt with no headings is page 1's notes.
  expect((await page.evaluate(() => notepadFromText('just notes\nmore'))).notes[0]).toBe('just notes\nmore');
  // OPEN TXT is beside SAVE AS TXT, on every tab.
  await expect(page.locator('[data-notes-open-txt]')).toBeVisible();
  await expect(page.locator('[data-notes-clear]')).toBeHidden();
});
