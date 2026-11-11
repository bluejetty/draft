// A NOTE'S PROPERTIES (jb, 10 Nov): "i need to add some properties that can
// be changed for the annotation. have to be able to turn on and off the
// pointer... and adjust the line use and option to add an arrow on the end.
// and also need text size and type ... and then a position of the 'node'
// centered left or right right top bottom left etc and then also
// justification of text left center right". A picked note shows the NOTE
// panel: POINTER on / off, POINTER END, POINTER LINE (style and weight),
// TEXT SIZE, FONT, NODE, JUSTIFY, ROTATE and BOX (BORDER, MASK, CAPS), plus
// EDIT TEXT. Each pick writes the note in one undo and is the next note's
// default; the same chips sit on the ANNOTATION tool's own panel.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const SITE = 8;
const ring = ([w, d]) => [[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2]]
  .map(([x, z]) => ({ x, y: 0, z }));
const TAPPED = { id: 1, anchor: { x: 0, y: 0, z: -40 }, text: { x: 0, y: 0, z: -40 }, levelId: SITE, view: 'plan',
  body: 'Plan heading', end: 'none', caps: true, layer: 'A-ANNO-NOTE' };
const LED = { id: 2, anchor: { x: 30, y: 0, z: 60 }, text: { x: 45, y: 0, z: 75 }, levelId: SITE, view: 'plan',
  body: 'Iron pin found', end: 'arrow', caps: true, layer: 'A-ANNO-NOTE' };
const siteFile = (notes = [TAPPED, LED]) => ({
  version: 1, planTurn: 0, board: 'drafting', standalone: 'site',
  levels: [{ id: SITE, name: 'SITE', elev: 0 }, { id: 7, name: 'ROOF', elev: 18 },
    { id: 5, name: '2ND FL', elev: 9 }, { id: 3, name: 'MAIN FL', elev: 0 },
    { id: 1, name: 'FOUNDATION', elev: -10 }],
  activeLevelIdx: 0,
  walls: [], lines: [], floors: [], roofs: [], fenestrations: [], dimensions: [],
  outlines: [{ id: 'lot', levelId: SITE, site: true, garage: false, detached: false, masterId: null,
    foundation: null, closed: true, points: ring([60, 120]), overriddenSrcIds: [] }],
  shapes: [], surfaceOpenings: [], stairs: [], notes,
  roomTags: [], columns: [], beams: [], boneyardOutlines: [],
  groups: [], levelLocks: [], underlays: [],
});

async function openSite(page, notes) {
  await page.setViewportSize({ width: 1366, height: 768 });
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, drawing }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(drawing)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, drawing: siteFile(notes) });
  await page.goto(`/MODEL.html?level=${SITE}&lpane=drafting&left=1`);
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  await page.waitForTimeout(300);
  const later = page.locator('#lot-pick [data-lot-pick-ok]');
  if (await later.isVisible().catch(() => false)) await later.click();
}
const saved = async page => {
  await page.locator('#save').click();
  await h.waitForSaved(page);
  return h.savedDrawing(page);
};
const noteById = async (page, id) => (await saved(page)).notes.find(n => n.id === id);
// Pick a note by a click inside its text block (the block grows right of
// the text point when the anchor is on it or to its left).
const pickNote = async (page, note) => {
  await page.keyboard.press('s');
  const f = await h.planFrame(page);
  const [x, y] = f.at(note.text.x, note.text.z);
  await page.mouse.click(x + 12, y);
  await expect(page.locator('#props-box')).toContainText('NOTE');
};
const panel = page => page.locator('#props-box');

test('a picked note shows the NOTE panel on both property boxes, and each chip writes the note', async ({ page }) => {
  await openSite(page);
  await page.locator('#objprop-tab').click();
  await pickNote(page, LED);
  await expect(page.locator('#objprop [data-objprop-title]')).toHaveText(/^NOTE/);
  await expect(page.locator('#objprop [data-note-end="dot"]')).toBeVisible();

  await panel(page).locator('[data-note-end="dot"]').click();
  expect((await noteById(page, 2)).end).toBe('dot');
  await panel(page).locator('[data-note-style="dashed"]').click();
  await panel(page).locator('[data-note-weight="5"]').click();
  await panel(page).locator('[data-note-size="6\\""]').click();
  await panel(page).locator('[data-note-font="mono"]').click();
  await panel(page).locator('[data-note-node="c"]').click();
  await panel(page).locator('[data-note-align="center"]').click();
  await panel(page).locator('[data-note-rot="90"]').click();
  await panel(page).locator('[data-note-outline]').click();
  await panel(page).locator('[data-note-fill]').click();
  const n = await noteById(page, 2);
  expect(n.style).toBe('dashed');
  expect(n.weight).toBe(5);
  expect(n.heightFt).toBeCloseTo(0.5, 6);
  expect(n.font).toBe('mono');
  expect(n.node).toBe('c');
  expect(n.align).toBe('center');
  expect(n.rot).toBeCloseTo(Math.PI / 2, 6);
  expect(n.outline).toBe(true);
  expect(n.fill).toBe(true);
  expect(n.caps, 'CAPS untouched').toBe(true);
  // The chips read the note back, lit.
  await expect(panel(page).locator('[data-note-node="c"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(panel(page).locator('[data-note-align="center"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(panel(page).locator('[data-note-size-field]')).toHaveValue(/6"/);
  // Typed height and degrees.
  await panel(page).locator('[data-note-size-field]').fill("2'-6\"");
  await page.keyboard.press('Enter');
  expect((await noteById(page, 2)).heightFt).toBeCloseTo(2.5, 6);
  await panel(page).locator('[data-note-rot-field]').fill('45');
  await page.keyboard.press('Enter');
  expect((await noteById(page, 2)).rot).toBeCloseTo(Math.PI / 4, 6);
  // UNDO takes the last pick off, and the key with it when it was new.
  await page.locator('[data-model-undo]').click();
  expect((await noteById(page, 2)).rot).toBeCloseTo(Math.PI / 2, 6);
});

test('POINTER off keeps the anchor and draws no leader; on again gives a tapped note a handle to drag', async ({ page }) => {
  await openSite(page);
  await pickNote(page, LED);
  await panel(page).locator('[data-note-pointer="off"]').click();
  let n = await noteById(page, 2);
  expect(n.end).toBe('none');
  expect(n.anchor).toEqual({ x: 30, y: 0, z: 60 });
  await panel(page).locator('[data-note-pointer="on"]').click();
  n = await noteById(page, 2);
  expect(n.end).toBe('arrow');
  expect(n.anchor, 'the leader still points where it did').toEqual({ x: 30, y: 0, z: 60 });

  await page.keyboard.press('Escape');
  await pickNote(page, TAPPED);
  await expect(panel(page).locator('[data-note-pointer="off"]')).toHaveAttribute('aria-pressed', 'true');
  await panel(page).locator('[data-note-pointer="on"]').click();
  n = await noteById(page, 1);
  expect(n.end, 'a note that never had a pointer takes the tool\'s POINTER END').toBe('line');
  expect(Math.hypot(n.anchor.x - n.text.x, n.anchor.z - n.text.z), 'the anchor is set off the text').toBeGreaterThan(1);
  await page.locator('[data-model-undo]').click();
  n = await noteById(page, 1);
  expect(n.end).toBe('none');
  expect(n.anchor).toEqual({ x: 0, y: 0, z: -40 });
});

test('CAPS off shows the words as typed; EDIT TEXT retypes them', async ({ page }) => {
  await openSite(page);
  await pickNote(page, TAPPED);
  await panel(page).locator('[data-note-caps]').click();
  expect((await noteById(page, 1)).caps).toBe(false);
  await panel(page).locator('[data-note-retype]').click();
  const box = page.locator('[data-note-edit]');
  await expect(box).toBeFocused();
  await expect(box).toHaveValue('Plan heading');
  await page.keyboard.press('Control+a');
  await page.keyboard.type('Plan of Lot 12');
  await page.keyboard.press('Enter');
  const n = await noteById(page, 1);
  expect(n.body, 'kept as typed with CAPS off').toBe('Plan of Lot 12');
});

test('the last picks are the ANNOTATION tool\'s defaults, and the next note is born with them', async ({ page }) => {
  await openSite(page);
  await pickNote(page, LED);
  await panel(page).locator('[data-note-size="1\'"]').click();
  await panel(page).locator('[data-note-font="serif"]').click();
  await panel(page).locator('[data-note-node="t"]').click();
  await panel(page).locator('[data-note-caps]').click();
  await page.keyboard.press('Escape');
  await h.armFromRail(page, 'annotation');
  await expect(panel(page).locator('[data-note-size="1\'"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(panel(page).locator('[data-note-font="serif"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(panel(page).locator('[data-note-node="t"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(panel(page).locator('[data-note-caps]')).toHaveAttribute('aria-pressed', 'false');
  const f = await h.planFrame(page);
  await page.mouse.click(...f.at(-20, 20));
  await expect(page.locator('[data-elev-note]')).toBeVisible();
  await page.keyboard.type('Bench mark');
  await page.keyboard.press('Enter');
  const n = (await saved(page)).notes.find(note => note.body === 'Bench mark');
  expect(n.heightFt).toBeCloseTo(1, 6);
  expect(n.font).toBe('serif');
  expect(n.node).toBe('t');
  expect(n.caps, 'CAPS off rides on the record').toBe(false);
  // Back after a reload: the file keeps the look.
  await page.reload();
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  const again = (await h.savedDrawing(page)).notes.find(note => note.body === 'Bench mark');
  expect(again.font).toBe('serif');
  expect(again.node).toBe('t');
});

test('render-2d: the node puts the leader on the block\'s corner, side or centre, and rotation turns the box', async ({ page }) => {
  await openSite(page, []);
  const boxes = await page.evaluate(() => {
    const R = window.DraftRender2D;
    const c = document.createElement('canvas').getContext('2d');
    const anchor = { x: 0, y: 0 }, text = { x: 100, y: 100 };
    const at = node => R.noteBoxScreen2D(c, anchor, text, { body: 'AB', node }, 0);
    const auto = at('auto'), tl = at('tl'), c0 = at('c'), br = at('br');
    const turned = R.noteBoxScreen2D(c, anchor, text, { body: 'ABCD', node: 'tl', rot: Math.PI / 2 }, 0);
    return { auto, tl, c0, br, turned };
  });
  // AUTO with the anchor to the left: the block starts at the text point.
  expect(boxes.auto.left).toBeCloseTo(100, 6);
  expect(boxes.auto.top + boxes.auto.height / 2).toBeCloseTo(100, 6);
  expect(boxes.tl.left).toBeCloseTo(100, 6);
  expect(boxes.tl.top).toBeCloseTo(100, 6);
  expect(boxes.c0.left + boxes.c0.width / 2).toBeCloseTo(100, 6);
  expect(boxes.c0.top + boxes.c0.height / 2).toBeCloseTo(100, 6);
  expect(boxes.br.right).toBeCloseTo(100, 6);
  expect(boxes.br.bottom).toBeCloseTo(100, 6);
  // A quarter turn counter-clockwise stands the block up above the point.
  expect(boxes.turned.width).toBeCloseTo(boxes.tl.height, 6);
  expect(boxes.turned.bottom).toBeCloseTo(100, 6);
});
