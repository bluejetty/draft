// THE DETAILS LIBRARY — a file of small 2D details, one per detail window.
//
// jb, 19 Nov 2026: "i'm thinking of making a different DRAFT file option a
// DETAILS LAYOUT that should all the typical details ... i'd like it to be a
// 'special file' like the site plan it will only contain the DETAIL
// DRAWINGS, which are all 2D small square or rectangle drawings. i'd like a
// database type organization system ... id like to draw each detail in a
// seperate 'SHELF' ... it won't need all the LEVELS / LAYERS because the
// DETAILS are just 2D small drawing with notes". His answers on the plan the
// same day: categories "FOUNDATION, FRAMING, and SITE ... that's probably
// enough for starters", a 4' x 4' frame at 1" = 1'-0" ("i think that is
// good"), SAVE DETAIL "free for now", and "details file first make detail
// after". Then: "go for it".
//
// WHAT IS CHECKED, each where it would quietly go wrong:
//
//   1. THE TILE: DRAW DETAILS LIBRARY is the third half of the site-plan
//      stack, under CLASSIC DRAFTING, and the press writes
//      `standalone: 'details'`, builds nothing and stands the drafter in
//      DETAIL 1 with its default card.
//   2. NOTHING OF A HOUSE IS OFFERED: no level, elevation or section rows,
//      no rail seats, the PROJECT / WIREFRAME / EXT. FINISH doors greyed,
//      every BUILD key and CUT / ROOM TAG down, and their letters refused.
//      LINE stays up: details are drawn with the DRAW / EDIT keys.
//   3. THE CARD is the file's: category, TYP. / SPECIAL, frame, scale, tags
//      and note reach the saved .draft on the detail's shelf, and an edit is
//      one UNDO.
//   4. + DETAIL makes another framed detail, and a line drawn in one detail
//      belongs to it alone.
//   5. SAVE DETAIL saves the drawing (free) and keeps a copy of the whole
//      library in this browser's `details-libraries` store, which is where
//      house files will find it.
//   6. A DETAILS FILE OPENS IN ITS DETAIL, whatever level the URL asks for.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const blank = (extra = {}) => ({
  version: 1, planTurn: 0,
  levels: [{ id: 8, name: 'SITE', elev: 0 }, { id: 7, name: 'ROOF', elev: 18 },
    { id: 5, name: '2ND FL', elev: 9 }, { id: 3, name: 'MAIN FL', elev: 0 },
    { id: 1, name: 'FOUNDATION', elev: -10 }],
  activeLevelIdx: 3,
  walls: [], lines: [], floors: [], roofs: [], fenestrations: [], dimensions: [],
  outlines: [], shapes: [], surfaceOpenings: [], stairs: [], notes: [],
  roomTags: [], columns: [], beams: [], boneyardOutlines: [],
  groups: [], levelLocks: [], underlays: [],
  ...extra,
});
// A library as saved: two details, a line in the first.
const library = () => blank({
  standalone: 'details', detailsLibrary: 'DETAILS-LIBRARY',
  boneyardShelves: [
    { id: 1, name: 'TYP. STRIP FOOTING', detail: { category: 'FOUNDATION', kind: 'typ', frameW: 4, frameH: 4, scale: 1 } },
    { id: 2, name: 'TYP. EAVE', detail: { category: 'FRAMING', kind: 'typ', frameW: 3, frameH: 2, scale: 1.5 } },
  ],
  nextBoneyardShelfId: 3, activeBoneyardShelfId: 1,
  lines: [{ id: 'l1', levelId: -1, start: { x: -1, y: 0, z: 0 }, end: { x: 1, y: 0, z: 0 }, layer: 'A-DETL' }],
});

async function openModel(page, file = blank(), query = '') {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, drawing }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(drawing)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, drawing: file });
  await page.goto(`/MODEL.html${query}`);
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  await page.waitForTimeout(300);
}
const saved = async page => {
  await page.locator('#save').click();
  await h.waitForSaved(page);
  return h.savedDrawing(page);
};
const pressTile = async page => {
  await h.openDriveThru(page);
  await page.locator('[data-build-entry="details-library"]').click();
  await expect(page.locator('#drivethru'), 'the board goes down').toHaveAttribute('data-shut', '');
};
const card = page => page.locator('#levels-panel [data-detail-card]');

test('the tile is the lower half of the site-plan stack, under DRAW STANDALONE SITE PLAN', async ({ page }) => {
  // CLASSIC DRAFTING, which stood between them, moved to its own row under
  // the house tiles (jb, 25 Nov 2026).
  await openModel(page);
  await h.openDriveThru(page);
  const stack = page.locator('#build-families [data-build-stack="sitePlan"]');
  await expect(stack.locator('[data-build-entry]'))
    .toHaveText(['DRAW STANDALONE SITE PLAN', 'DRAW DETAILS LIBRARY']);
  const site = await page.locator('[data-build-entry="site-standalone"]').boundingBox();
  const tile = await page.locator('[data-build-entry="details-library"]').boundingBox();
  expect(tile.y, 'under DRAW STANDALONE SITE PLAN').toBeGreaterThan(site.y + site.height - 1);
});

test('the press builds nothing, marks the file details and stands in DETAIL 1 with the default card', async ({ page }) => {
  await openModel(page);
  await pressTile(page);
  const state = await page.evaluate(() => ({
    standalone: drawing.standalone, onShelf: boneyardActive, shelf: activeShelfId(),
    walls: drawing.walls.length + drawing.roofs.length,
  }));
  expect(state).toEqual({ standalone: 'details', onShelf: true, shelf: 1, walls: 0 });
  await h.openModelRail(page);
  await expect(page.locator('#levels-panel [data-detail]')).toHaveText([/DETAIL 1/]);
  // THE DEFAULTS HE ANSWERED: FOUNDATION first of his three, 4' x 4', 1" = 1'-0".
  await expect(card(page).locator('[data-detail-category]')).toHaveValue('FOUNDATION');
  await expect(card(page).locator('[data-detail-frame="frameW"]')).toHaveValue(`4'-0"`);
  await expect(card(page).locator('[data-detail-frame="frameH"]')).toHaveValue(`4'-0"`);
  await expect(card(page).locator('[data-detail-scale]')).toHaveValue('1');
  await expect(card(page).locator('[data-detail-kind="typ"]')).toHaveAttribute('aria-pressed', 'true');
  const d = await saved(page);
  expect(d.standalone).toBe('details');
  expect(d.boneyardShelves).toEqual([{ id: 1, name: 'DETAIL 1',
    detail: { category: 'FOUNDATION', kind: 'typ', tags: [], note: '', frameW: 4, frameH: 4, scale: 1 } }]);
  expect(d.buildType ?? null, 'a library is not a house type').toBeNull();
});

test('nothing of a house is offered: no levels, no seats, house doors greyed, BUILD keys and CUT down', async ({ page }) => {
  await openModel(page, library());
  await h.openModelRail(page);
  await expect(page.locator('#levels-panel [data-level-row]'), 'no level rows').toHaveCount(0);
  await expect(page.locator('#levels-panel [data-view-row]'), 'no elevation or section rows').toHaveCount(0);
  await expect(page.locator('#levels-panel [data-add-level]')).toHaveCount(0);
  await expect(page.locator('#view-rail .seat'), 'the rail seats nothing').toHaveCount(0);
  for (const door of ['project', 'boneyard', 'ext-finish']) {
    await expect(page.locator(`#page-row [data-page="${door}"]`).first(), `${door} greyed`)
      .toHaveAttribute('data-site-locked', '');
  }
  for (const key of ['wall', 'fenestration', 'roof', 'stair', 'cut', 'roomtag']) {
    await expect(page.locator(`[data-tool-key="${key}"]`), `${key} down`).toBeDisabled();
  }
  await expect(page.locator('[data-site-plan-key]'), 'the SITE PLAN key too').toBeDisabled();
  for (const key of ['line', 'shape', 'dimension', 'annotation', 'offset', 'trim']) {
    await expect(page.locator(`[data-tool-key="${key}"]`), `${key} up`).toBeEnabled();
  }
  // AND THE LETTER IS REFUSED, not merely the key: W arms no wall.
  await page.evaluate(() => document.activeElement?.blur());
  await page.keyboard.press('w');
  expect(await page.evaluate(() => activeTool), 'W arms nothing').not.toBe('wall');
  // AND NO HOUSE TILE ON THE BOARD.
  await h.openDriveThru(page);
  await expect(page.locator('[data-build-family="bungalow"]')).toBeDisabled();
  await expect(page.locator('[data-build-entry="site-standalone"]')).toBeDisabled();
  await expect(page.locator('[data-build-entry="details-library"]'), 'its own tile stays live').toBeEnabled();
});

test('the card reaches the file, and each edit is one UNDO', async ({ page }) => {
  await openModel(page, library());
  await h.openModelRail(page);
  const c = card(page);
  await c.locator('[data-detail-category]').fill('window wells');
  await c.locator('[data-detail-category]').press('Enter');
  await c.locator('[data-detail-category]').blur();
  await expect(card(page).locator('[data-detail-category]')).toHaveValue('WINDOW WELLS');
  await card(page).locator('[data-detail-kind="special"]').click();
  await card(page).locator('[data-detail-frame="frameW"]').fill(`2'-6"`);
  await card(page).locator('[data-detail-frame="frameW"]').press('Tab');
  await card(page).locator('[data-detail-scale]').selectOption('1.5');
  await card(page).locator('[data-detail-tags]').fill('Basement, egress');
  await card(page).locator('[data-detail-tags]').press('Tab');
  await card(page).locator('[data-detail-note]').fill('Egress windows only');
  await card(page).locator('[data-detail-note]').press('Tab');
  const d = await saved(page);
  expect(d.boneyardShelves[0].detail).toEqual({ category: 'WINDOW WELLS', kind: 'special',
    tags: ['basement', 'egress'], note: 'Egress windows only', frameW: 2.5, frameH: 4, scale: 1.5 });
  // ONE UNDO STEP PER EDIT -- category, kind, frame, scale, tags, note --
  // on the page's own stack, not the saved versions'.
  expect(await page.evaluate(() => undoStack.filter(step => step.kind === 'props'
    && step.edits.some(e => e.item === drawing.boneyardShelves[0])).length)).toBe(6);
  // ONE UNDO PUTS THE NOTE BACK, AND ONLY THE NOTE.
  await page.evaluate(() => document.activeElement?.blur());
  await page.keyboard.press('Control+z');
  const after = await page.evaluate(() => drawing.boneyardShelves[0].detail);
  expect(after.note, 'the note is undone').toBe('');
  expect(after.frameW, 'the frame stays').toBe(2.5);
});

test('+ DETAIL makes another framed detail, and a line belongs to the detail it was drawn in', async ({ page }) => {
  await openModel(page, library());
  await h.openModelRail(page);
  await page.locator('#levels-panel [data-add-detail]').click();
  await expect(page.locator('#levels-panel [data-detail]')).toHaveText([/STRIP FOOTING/, /EAVE/, /DETAIL 3/]);
  const now = await page.evaluate(() => ({ shelf: activeShelfId(), card: drawing.boneyardShelves.find(s => s.id === 3).detail }));
  expect(now.shelf, 'standing in the new one').toBe(3);
  // THE NEW ONE TAKES THE CATEGORY AND SCALE OF THE ONE BEFORE IT.
  expect(now.card).toMatchObject({ category: 'FRAMING', scale: 1.5, frameW: 4, frameH: 4 });
  // THE FOOTING'S LINE IS NOT IN IT.
  expect(await page.evaluate(() => drawing.lines.filter(l => l.levelId === -activeShelfId()).length)).toBe(0);
  await page.locator('#levels-panel [data-detail="1"]').click();
  expect(await page.evaluate(() => activeShelfId())).toBe(1);
  expect(await page.evaluate(() => drawing.lines.filter(l => l.levelId === -activeShelfId()).length)).toBe(1);
});

test('SAVE DETAIL saves the drawing and keeps a copy of the library in this browser', async ({ page }) => {
  await openModel(page, library());
  await h.openModelRail(page);
  await card(page).locator('[data-save-detail]').click();
  await expect(page.locator('#levels-panel [data-detail-status]')).toContainText('LIBRARY COPY');
  const stored = await page.evaluate(async () => {
    const file = await window.SharedFileStore.loadNamedFile('DETAILS-LIBRARY.draft', 'details-libraries');
    return file ? JSON.parse(await file.text()) : null;
  });
  expect(stored, 'the library copy exists').not.toBeNull();
  expect(stored.standalone).toBe('details');
  expect(stored.boneyardShelves.map(s => s.name)).toEqual(['TYP. STRIP FOOTING', 'TYP. EAVE']);
  expect(stored.boneyardShelves[0].detail.changed, 'the detail saved is stamped').toMatch(/^\d{4}-\d{2}-\d{2}$/);
  // AND THE DRAWING ITSELF WAS SAVED: nothing is left unsaved.
  await expect(page.locator('#save')).toHaveText('SAVED');
  expect((await h.savedDrawing(page)).boneyardShelves[0].detail.changed).toBe(stored.boneyardShelves[0].detail.changed);
});

test('a details file opens in its detail whatever level the URL asks for', async ({ page }) => {
  await openModel(page, library(), '?level=3&view=plan');
  expect(await page.evaluate(() => ({ onShelf: boneyardActive, shelf: activeShelfId() })))
    .toEqual({ onShelf: true, shelf: 1 });
  // AND A LEVEL ASKED FOR AFTERWARDS LANDS BACK IN THE DETAIL.
  await page.evaluate(() => goToLevel(3));
  expect(await page.evaluate(() => boneyardActive)).toBe(true);
  // A HOUSE FILE STILL OPENS ON MAIN FL.
  await openModel(page, blank());
  expect(await page.evaluate(() => boneyardActive)).toBe(false);
  expect(await h.modelLevelId(page)).toBe('3');
});

// ══ THE DETAILS BOARD (step 3 of the plan) ══════════════════════════════════
//
// jb: "i'd like a database type organization system so that they can be
// arranged easily". The plan's board: categories down the LEFT, search and
// buttons across the top, a card per detail with its thumbnail; double-click
// opens the detail, BOARD comes back to where the drafter was; drag to sort,
// right-click for more, + CATEGORY.
const board = page => page.locator('#details-board');
const boardCard = (page, id) => board(page).locator(`[data-board-card="${id}"]`);
const boardNames = page => board(page).locator('[data-board-card] .db-name');
const threeDetails = () => {
  const file = library();
  file.boneyardShelves.push({ id: 3, name: 'WINDOW WELL',
    detail: { category: 'FOUNDATION', kind: 'special', frameW: 4, frameH: 4, scale: 1, tags: ['basement', 'egress'] } });
  file.nextBoneyardShelfId = 4;
  return file;
};

test('a details file opens on its board: a card per detail, in the library\'s order, each with its thumbnail', async ({ page }) => {
  await openModel(page, threeDetails());
  await expect(board(page)).toBeVisible();
  await expect(boardNames(page)).toHaveText(['TYP. STRIP FOOTING', 'TYP. EAVE', 'WINDOW WELL']);
  await expect(board(page).locator('[data-board-card] .db-num')).toHaveText(['1', '2', '3']);
  await expect(boardCard(page, 3).locator('.db-sub')).toHaveText(`FOUNDATION · SPECIAL · 1" = 1'-0"`);
  await expect(boardCard(page, 3).locator('.db-tags')).toHaveText('basement, egress');
  // THE RAIL: ALL, FAVOURITES and his three, with what each holds.
  await expect(board(page).locator('[data-board-category]')).toHaveText(
    [/^ALL\s*3$/, /FAVOURITES\s*0$/, /^FOUNDATION\s*2$/, /^FRAMING\s*1$/, /^SITE\s*0$/]);
  // THE THUMBNAIL IS THE DETAIL: the footing's line is in the footing's
  // card and not in the eave's (inked pixels counted off each canvas).
  const inked = id => page.evaluate(n => {
    const c = document.querySelector(`#details-board [data-board-card="${n}"] canvas`);
    const px = c.getContext('2d').getImageData(0, c.height / 2 - 2, c.width, 4).data;
    let count = 0;
    for (let i = 3; i < px.length; i += 4) if (px[i] > 0) count += 1;
    return count;
  }, id);
  expect(await inked(1), 'the footing\'s line across its middle').toBeGreaterThan(200);
  expect(await inked(2), 'nothing across the eave\'s middle but its frame').toBeLessThan(60);
  // THE BOARD COVERS THE DRAWING AREA, not the pane beside it.
  await h.openModelRail(page);
  const b = await board(page).boundingBox();
  const pane = await page.locator('#levels-panel').boundingBox();
  expect(b.x + b.width, 'the board stops short of the pane').toBeLessThanOrEqual(pane.x);
  // A HOUSE FILE HAS NO BOARD.
  await openModel(page, blank());
  await expect(board(page)).toBeHidden();
});

test('the board filters by category, FAVOURITES, TYP. / SPECIAL and search', async ({ page }) => {
  await openModel(page, threeDetails());
  await board(page).locator('[data-board-category="FOUNDATION"]').click();
  await expect(boardNames(page)).toHaveText(['TYP. STRIP FOOTING', 'WINDOW WELL']);
  await board(page).locator('[data-board-kind="special"]').click();
  await expect(boardNames(page)).toHaveText(['WINDOW WELL']);
  await board(page).locator('[data-board-kind="all"]').click();
  await board(page).locator('[data-board-category="ALL"]').click();
  // SEARCH reads the name, the tags, the note and the category.
  await board(page).locator('[data-board-search]').fill('egress');
  await expect(boardNames(page)).toHaveText(['WINDOW WELL']);
  await board(page).locator('[data-board-search]').fill('framing');
  await expect(boardNames(page)).toHaveText(['TYP. EAVE']);
  await board(page).locator('[data-board-search]').fill('nothing like it');
  await expect(board(page).locator('.db-empty')).toBeVisible();
  await board(page).locator('[data-board-search]').fill('');
  // THE STAR: a favourite is the file's, and one UNDO takes it off.
  await board(page).locator('[data-board-favourite="2"]').click();
  await expect(board(page).locator('[data-board-category="FAVOURITES"]')).toHaveText(/1$/);
  await board(page).locator('[data-board-category="FAVOURITES"]').click();
  await expect(boardNames(page)).toHaveText(['TYP. EAVE']);
  const d = await saved(page);
  expect(d.boneyardShelves[1].detail.favourite).toBe(true);
  await page.evaluate(() => document.activeElement?.blur());
  await page.keyboard.press('Control+z');
  expect(await page.evaluate(() => drawing.boneyardShelves[1].detail.favourite ?? false)).toBe(false);
});

test('double-click opens the detail; BOARD comes back to the same category and search', async ({ page }) => {
  await openModel(page, threeDetails());
  await board(page).locator('[data-board-category="FOUNDATION"]').click();
  await board(page).locator('[data-board-search]').fill('well');
  await boardCard(page, 3).dblclick();
  await expect(board(page)).toBeHidden();
  expect(await page.evaluate(() => ({ onShelf: boneyardActive, shelf: activeShelfId() })))
    .toEqual({ onShelf: true, shelf: 3 });
  await h.openModelRail(page);
  await page.locator('#levels-panel [data-open-board]').click();
  await expect(board(page)).toBeVisible();
  await expect(board(page).locator('[data-board-category="FOUNDATION"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(board(page).locator('[data-board-search]')).toHaveValue('well');
  await expect(boardCard(page, 3), 'the card it left from is picked').toHaveAttribute('data-picked', '');
});

test('a card dragged onto another takes its place, the order is saved, and one UNDO puts it back', async ({ page }) => {
  await openModel(page, threeDetails());
  const target = await boardCard(page, 1).boundingBox();
  await boardCard(page, 3).dragTo(boardCard(page, 1), { targetPosition: { x: 8, y: target.height / 2 } });
  await expect(boardNames(page)).toHaveText(['WINDOW WELL', 'TYP. STRIP FOOTING', 'TYP. EAVE']);
  // THE NUMBERS FOLLOW THE ORDER: the library's order is the bubbles' order.
  await expect(board(page).locator('[data-board-card] .db-num')).toHaveText(['1', '2', '3']);
  // ONE STEP ON THE PAGE'S OWN STACK, not the saved versions'.
  expect(await page.evaluate(() => undoStack.filter(step => step.kind === 'reorder').length)).toBe(1);
  expect((await saved(page)).boneyardShelves.map(s => s.id)).toEqual([3, 1, 2]);
  await page.evaluate(() => document.activeElement?.blur());
  await page.keyboard.press('Control+z');
  await expect(boardNames(page)).toHaveText(['TYP. STRIP FOOTING', 'TYP. EAVE', 'WINDOW WELL']);
  // UNDER SORT: NAME the cards show by name and a drop moves nothing.
  await board(page).locator('[data-board-sort]').selectOption('name');
  await expect(boardNames(page)).toHaveText(['TYP. EAVE', 'TYP. STRIP FOOTING', 'WINDOW WELL']);
  await boardCard(page, 3).dragTo(boardCard(page, 2), { targetPosition: { x: 8, y: target.height / 2 } });
  expect(await page.evaluate(() => drawing.boneyardShelves.map(s => s.id))).toEqual([1, 2, 3]);
});

test('right-click: MOVE TO, FAVOURITE, RENAME and DELETE (twice); + CATEGORY is kept even empty', async ({ page }) => {
  await openModel(page, threeDetails());
  const menu = page.locator('#details-board-menu');
  await boardCard(page, 1).click({ button: 'right' });
  await expect(menu).toBeVisible();
  await menu.locator('[data-board-act="move:FRAMING"]').click();
  await expect(boardCard(page, 1).locator('.db-sub')).toContainText('FRAMING');
  await boardCard(page, 1).click({ button: 'right' });
  await menu.locator('[data-board-act="favourite"]').click();
  await expect(board(page).locator('[data-board-favourite="1"]')).toHaveAttribute('aria-pressed', 'true');
  await boardCard(page, 1).click({ button: 'right' });
  await menu.locator('[data-board-act="rename"]').click();
  const box = boardCard(page, 1).locator('input');
  await box.fill('typ. strip footing 8"');
  await box.press('Enter');
  await expect(boardCard(page, 1).locator('.db-name')).toHaveText('TYP. STRIP FOOTING 8"');
  // DELETE ASKS TWICE: the first press only arms it.
  await boardCard(page, 2).click({ button: 'right' });
  await menu.locator('[data-board-act="delete"]').click();
  await expect(menu.locator('[data-board-act="delete"]')).toHaveText('DELETE? PRESS AGAIN');
  expect(await page.evaluate(() => drawing.boneyardShelves.length)).toBe(3);
  await menu.locator('[data-board-act="delete"]').click();
  await expect(boardNames(page)).toHaveText(['TYP. STRIP FOOTING 8"', 'WINDOW WELL']);
  // + CATEGORY, then a card dropped on it moves there.
  await board(page).locator('[data-board-add-category]').click();
  await board(page).locator('[data-board-new-category]').fill('duplex');
  await board(page).locator('[data-board-new-category]').press('Enter');
  await expect(board(page).locator('[data-board-category="DUPLEX"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(board(page).locator('.db-empty')).toBeVisible();
  await board(page).locator('[data-board-category="ALL"]').click();
  await boardCard(page, 3).dragTo(board(page).locator('[data-board-category="DUPLEX"]'));
  await expect(board(page).locator('[data-board-category="DUPLEX"]')).toHaveText(/1$/);
  const d = await saved(page);
  expect(d.detailCategories).toEqual(['DUPLEX']);
  expect(d.boneyardShelves.map(s => [s.name, s.detail.category, !!s.detail.favourite])).toEqual([
    ['TYP. STRIP FOOTING 8"', 'FRAMING', true], ['WINDOW WELL', 'DUPLEX', false]]);
  expect(d.lines.filter(l => l.levelId === -2), 'the deleted detail\'s drawing went with it').toHaveLength(0);
});

test('+ DETAIL on the board starts a detail in the category on view, and opens it', async ({ page }) => {
  await openModel(page, threeDetails());
  await board(page).locator('[data-board-category="SITE"]').click();
  await board(page).locator('[data-board-add]').click();
  await expect(board(page)).toBeHidden();
  const now = await page.evaluate(() => ({ shelf: activeShelfId(),
    card: drawing.boneyardShelves.find(s => s.id === activeShelfId()).detail }));
  expect(now.shelf).toBe(4);
  expect(now.card.category).toBe('SITE');
});

test('SAVE LIBRARY on the board saves the drawing and keeps the library copy', async ({ page }) => {
  await openModel(page, threeDetails());
  await board(page).locator('[data-board-save]').click();
  await expect(page.locator('#save')).toHaveText('SAVED');
  await expect.poll(() => page.evaluate(async () => {
    const file = await window.SharedFileStore.loadNamedFile('DETAILS-LIBRARY.draft', 'details-libraries');
    return file ? JSON.parse(await file.text()).boneyardShelves.map(s => s.name) : null;
  })).toEqual(['TYP. STRIP FOOTING', 'TYP. EAVE', 'WINDOW WELL']);
});
