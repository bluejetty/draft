// SHEETS BY NAME, SHEETS OFF, VIEWS IN, AND THE LOGO (Movie, 25 Oct).
//
// "click on the title ... a text box comes up and you can change the name it
// changes all 3 names. also add a X so the user can delete a page that is
// emtpty or not neede" -- "the +add viewport button doesn't seem to do
// anything yet can we activate it so users can bring in a new viewport on an
// emply or page with extra space" -- "when the user double clicks on the
// logo area can it bring up a popup that allows the user to select one of
// the available logos or allows the to add their logo jpg or other file to
// the list and upload it".
const { test, expect } = require('@playwright/test');
const h = require('./helpers');
const { pdfBytes, bmpBytes } = require('./logo-files');

const BUCKET = 'model-drawing';
const PW = 17;
const PH = 11;
const FIT_MARGIN = 60;

const point = (x, z) => ({ x, y: 0, z });

// A saved drawing the way the bone leaves one: a 36' x 26' main floor over a
// foundation, an all-covering gable roof, one drawn section, and the flag up.
function boneDrawing({ auto = true, layout = undefined } = {}) {
  const wall = (id, levelId, view, sx, sz, ex, ez, top) => ({
    id, start: point(sx, sz), end: point(ex, ez), levelId, view,
    wallType: view === 'foundation' ? 'concrete_8' : 'stud_2x6',
    baseHeight: 0, topHeight: top, refLine: 'left',
  });
  const ring = (idBase, levelId, view, top) => [
    wall(idBase + 1, levelId, view, 0, 0, 36, 0, top),
    wall(idBase + 2, levelId, view, 36, 0, 36, 26, top),
    wall(idBase + 3, levelId, view, 36, 26, 0, 26, top),
    wall(idBase + 4, levelId, view, 0, 26, 0, 0, top),
  ];
  return {
    version: 1,
    levels: [
      { id: 8, name: 'SITE', elev: 0 },
      { id: 7, name: 'ROOF', elev: 9 },
      { id: 3, name: 'MAIN FL', elev: 0 },
      { id: 1, name: 'FOUNDATION', elev: -9 },
    ],
    walls: [...ring(0, 3, 'plan', 8.09), ...ring(10, 1, 'foundation', 8)],
    roofs: [{
      id: 1, levelId: 7, pitch: 4, overhang: 1.5,
      points: [
        { x: -1.5, z: -1.5 }, { x: 37.5, z: -1.5 },
        { x: 37.5, z: 27.5 }, { x: -1.5, z: 27.5 },
      ],
      edges: ['eave', 'gable', 'eave', 'gable'],
    }],
    cuts: [{
      id: 1, name: 'S1', elev: 0, levelId: 3,
      startPt: { x: 18, z: -4 }, endPt: { x: 18, z: 30 },
      dirVec: { x: 1, z: 0 },
    }],
    fenestrations: [
      { id: 1, levelId: 3, wallId: 1, type: 'door', offset: 6, width: 3 },
    ],
    layout: layout !== undefined ? layout : { auto },
  };
}

async function openLayout(page, drawing) {
  await page.addInitScript(() => {
    if (sessionStorage.getItem('draft-test-storage-cleared')) return;
    sessionStorage.setItem('draft-test-storage-cleared', '1');
    indexedDB.deleteDatabase('pdf-img-mgr-shared');
    localStorage.clear();
  });
  await page.goto('/LAYOUT.html');
  await page.waitForFunction(() => document.body.dataset.layoutReady === '1');
  await page.evaluate(async ({ bucket, saved }) => {
    const file = new File([JSON.stringify(saved)], 'model-drawing.json', { type: 'application/json' });
    await window.SharedFileStore.saveSharedFile(file, bucket);
  }, { bucket: BUCKET, saved: drawing });
  await page.reload();
  await page.waitForFunction(() => document.body.dataset.layoutReady === '1');
}

// The composer persists from inside the load callback; reads wait for its
// write to land instead of racing it.
async function waitForCompose(page) {
  await page.waitForFunction(() => Number(document.body.dataset.layoutSaveSeq || 0) > 0
    && document.body.dataset.layoutSaveDirty !== '1');
}

async function savedLayout(page) {
  return page.evaluate(async bucket => {
    const file = await window.SharedFileStore.loadSharedFile(bucket);
    return file ? JSON.parse(await file.text()).layout : null;
  }, BUCKET);
}


// A paper-inch point on the desk, through the view the page reports.
async function deskPoint(page, xIn, yIn) {
  const box = await page.locator('[data-layout-canvas]').boundingBox();
  const [zoom, panX, panY] = (await page.evaluate(() => document.body.dataset.layoutView)).split(',').map(Number);
  return [box.x + panX + xIn * zoom, box.y + panY + yIn * zoom];
}
const hitOf = (page, key) => page.evaluate(k => JSON.parse(document.body.dataset[k] || 'null'), key);
const centre = r => [r.xIn + r.wIn / 2, r.yIn + r.hIn / 2];
const saveSeq = page => page.evaluate(() => Number(document.body.dataset.layoutSaveSeq || 0));
const savedAfter = async (page, after) => {
  await page.waitForFunction(p => Number(document.body.dataset.layoutSaveSeq || 0) > p, after);
  return savedLayout(page);
};

test('the open sheet\'s name is a text box on a press -- in the list, the thumbnail and the titleblock -- and one name changes all three', async ({ page }) => {
  await openLayout(page, boneDrawing());
  await waitForCompose(page);
  const name = n => page.locator(`[data-layout-sheet="${n}"] [data-sheet-name]`);
  // A press on a sheet that is not open only opens it.
  await name(2).click();
  await expect(page.locator('#lay-rename')).toHaveCount(0);
  await expect(page.locator('[data-layout-sheet="2"]')).toHaveClass(/\bon\b/);
  // On the open one, the box.
  await name(2).click();
  await expect(page.locator('#lay-rename')).toBeVisible();
  let seq = await saveSeq(page);
  await page.locator('#lay-rename').fill('front and back');
  await page.keyboard.press('Enter');
  let saved = await savedAfter(page, seq);
  expect(saved.sheets[1].title).toBe('FRONT AND BACK');
  await expect(name(2)).toHaveText('FRONT AND BACK');
  await expect(page.locator('[data-sheet-thumb="2"] [data-sheet-name]')).toHaveText('2 FRONT AND BACK');
  // The thumbnail's name does the same.
  await page.locator('[data-sheet-thumb="2"] [data-sheet-name]').click();
  await expect(page.locator('#lay-rename')).toHaveValue('FRONT AND BACK');
  await page.keyboard.press('Escape');
  await expect(page.locator('#lay-rename')).toHaveCount(0);
  // And the titleblock's page title, on the sheet itself.
  const title = await hitOf(page, 'layoutTitleHit');
  expect(title, 'the strip says where its title is').toBeTruthy();
  await page.mouse.click(...await deskPoint(page, ...centre(title)));
  await expect(page.locator('#lay-rename')).toHaveValue('FRONT AND BACK');
  seq = await saveSeq(page);
  await page.locator('#lay-rename').fill('elevations');
  await page.keyboard.press('Enter');
  saved = await savedAfter(page, seq);
  expect(saved.sheets[1].title).toBe('ELEVATIONS');
});

test('the X takes a sheet off: an empty one straight away, one with drawings after asking; later sheets move up', async ({ page }) => {
  await openLayout(page, boneDrawing());
  await waitForCompose(page);
  const dealt = await savedLayout(page);
  const count = dealt.sheets.length;
  // An empty sheet at the end.
  await page.locator('[data-layout-add-sheet]').click();
  await expect(page.locator('[data-sheet-list] [data-layout-sheet]')).toHaveCount(count + 1);
  let asked = 0;
  page.on('dialog', d => { asked += 1; d.accept(); });
  let seq = await saveSeq(page);
  await page.locator(`[data-layout-sheet="${count + 1}"] [data-remove-sheet-at]`).click();
  await savedAfter(page, seq);
  await expect(page.locator('[data-sheet-list] [data-layout-sheet]')).toHaveCount(count);
  expect(asked, 'an empty sheet goes without a question').toBe(0);
  // The first sheet with drawings, from its thumbnail: it asks.
  const full = Math.min(...dealt.viewports.map(v => v.sheet || 1));
  const onOne = dealt.viewports.filter(v => (v.sheet || 1) === full).length;
  seq = await saveSeq(page);
  await page.locator(`[data-sheet-thumb="${full}"] [data-remove-sheet-at]`).click();
  const after = await savedAfter(page, seq);
  expect(asked).toBe(1);
  expect(after.sheets).toHaveLength(count - 1);
  expect(after.viewports).toHaveLength(dealt.viewports.length - onOne);
  expect(after.viewports.every(v => v.sheet >= 1 && v.sheet <= count - 1)).toBe(true);
  // One undo brings it back.
  seq = await saveSeq(page);
  await page.locator('[data-undo]').click();
  expect((await savedAfter(page, seq)).viewports).toHaveLength(dealt.viewports.length);
});

test('the X wears the accent and its ink', async ({ page }) => {
  await openLayout(page, boneDrawing());
  await waitForCompose(page);
  const x = page.locator('[data-layout-sheet="1"] [data-remove-sheet-at]');
  const [bg, fg, accent, ink] = await x.evaluate(el => {
    const cs = getComputedStyle(el), root = getComputedStyle(document.documentElement);
    const probe = c => { const d = document.createElement('div'); d.style.color = c; document.body.append(d);
      const v = getComputedStyle(d).color; d.remove(); return v; };
    return [cs.backgroundColor, cs.color, probe(root.getPropertyValue('--accent')), probe(root.getPropertyValue('--accent-ink'))];
  });
  expect(bg).toBe(accent);
  expect(fg).toBe(ink);
  await expect(x).toHaveText('\u00d7');
});

test('+ ADD VIEWPORT asks what -- plans, elevations, sections -- then the next press on the sheet puts it there, at a scale that fits', async ({ page }) => {
  await openLayout(page, boneDrawing());
  await waitForCompose(page);
  const dealt = await savedLayout(page);
  await page.locator('[data-layout-add-sheet]').click();
  const sheet = dealt.sheets.length + 1;
  await page.locator('[data-layout-add-viewport]').click();
  await expect(page.locator('[data-add-pick]')).toHaveText(['MAIN FL PLAN', 'FOUNDATION PLAN',
    'ELEVATION E1', 'ELEVATION E2', 'ELEVATION E3', 'ELEVATION E4', 'SECTION S1']);
  await page.locator('[data-add-pick="elevation:E2"]').click();
  await expect(page.locator('[data-add-menu]')).toBeHidden();
  await expect(page.locator('[data-layout-add-viewport]')).toHaveText(/CLICK THE SHEET/i);
  const seq = await saveSeq(page);
  await page.mouse.click(...await deskPoint(page, 7, 5));
  const after = await savedAfter(page, seq);
  const made = after.viewports.find(v => !dealt.viewports.some(d => d.id === v.id));
  expect(made).toMatchObject({ kind: 'elevation', elevId: 'E2', sheet, xIn: expect.any(Number), yIn: expect.any(Number) });
  expect(Math.abs(made.xIn - 7)).toBeLessThan(0.05);
  expect(Math.abs(made.yIn - 5)).toBeLessThan(0.05);
  // At a rung that fits the paper -- 26' deep, so it is not crammed to the floor of the ladder.
  expect(made.pif).toBeGreaterThanOrEqual(1 / 8);
  await expect(page.locator('[data-layout-add-viewport]')).toHaveText(/ADD VIEWPORT/i);
});

test('a double press on the titleblock\'s logo opens the picker: pick one, or add a picture of your own', async ({ page }) => {
  await openLayout(page, boneDrawing());
  await waitForCompose(page);
  const logo = await hitOf(page, 'layoutLogoHit');
  expect(logo, 'the strip says where its logo cell is').toBeTruthy();
  await page.mouse.dblclick(...await deskPoint(page, ...centre(logo)));
  await expect(page.locator('[data-logo-picker]')).toBeVisible();
  const picks = page.locator('[data-logo-pick]');
  expect(await picks.count()).toBeGreaterThanOrEqual(2);
  const other = await picks.evaluateAll(list => list.find(b => !b.classList.contains('on')).dataset.logoPick);
  let seq = await saveSeq(page);
  await page.locator(`[data-logo-pick="${other}"]`).click();
  await expect(page.locator('[data-logo-picker]')).toBeHidden();
  expect((await savedAfter(page, seq)).titleblockMark).toBe(other);
  // A picture of one's own: a blue block on a wide white margin.
  await page.mouse.dblclick(...await deskPoint(page, ...centre(logo)));
  const png = await page.evaluate(() => {
    const c = document.createElement('canvas'); c.width = 600; c.height = 400;
    const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, 600, 400);
    g.fillStyle = '#1e50a0'; g.fillRect(200, 150, 200, 100);
    return c.toDataURL('image/png').split(',')[1];
  });
  seq = await saveSeq(page);
  await page.locator('[data-logo-upload]').setInputFiles({ name: 'acme.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64') });
  await expect(page.locator('[data-logo-note]')).toContainText('COMPANY 01 added');
  await expect(page.locator('[data-logo-pick].on')).toContainText('COMPANY 01');
  const mark = (await savedAfter(page, seq)).titleblockMark;
  expect(mark).toMatch(/^logo:/);
  // Kept in the company standard, its margin trimmed off.
  const kept = await page.evaluate(() => window.DraftProfileManager.getActive('standards').content.model.companyLogos);
  expect(kept.map(l => l.label)).toEqual(['COMPANY 01']);
  const size = await page.evaluate(src => new Promise(res => { const i = new Image(); i.onload = () => res([i.width, i.height]); i.src = src; }), kept[0].dataUrl);
  // 600 wide came down to 512, so the 200 x 100 block is 171 x 85 or so --
  // and nothing of the white round it.
  expect(size[0]).toBeLessThan(200);
  expect(size[0]).toBeGreaterThan(160);
  expect(Math.abs(size[0] / size[1] - 2)).toBeLessThan(0.06);
  await page.keyboard.press('Escape');
  await expect(page.locator('[data-logo-picker]')).toBeHidden();
});

// MORE THAN PICTURES (Movie, 25 Oct: "can we allow PDF and as many other
// image filetypes as possilbe for the LOGO" -- "do all the check marks"): a
// PDF's first page and a BMP each land as a logo, their margins trimmed.
for (const [name, mimeType, bytes, ratio] of [
  ['letterhead.pdf', 'application/pdf', pdfBytes, 2],
  ['mark.bmp', 'image/bmp', bmpBytes, 2],
]) {
  test(`the logo picker takes a ${name.split('.').pop().toUpperCase()}`, async ({ page }) => {
    await openLayout(page, boneDrawing());
    await waitForCompose(page);
    await expect(page.locator('[data-logo-upload]')).toHaveAttribute('accept', /\.pdf/);
    await expect(page.locator('[data-logo-upload]')).toHaveAttribute('accept', /\.bmp/);
    await expect(page.locator('[data-logo-upload]')).toHaveAttribute('accept', /\.ico/);
    await expect(page.locator('[data-logo-upload]')).toHaveAttribute('accept', /\.avif/);
    const logo = await hitOf(page, 'layoutLogoHit');
    await page.mouse.dblclick(...await deskPoint(page, ...centre(logo)));
    await page.locator('[data-logo-upload]').setInputFiles({ name, mimeType, buffer: bytes() });
    await expect(page.locator('[data-logo-note]')).toContainText('COMPANY 01 added', { timeout: 15000 });
    const kept = await page.evaluate(() => window.DraftProfileManager.getActive('standards').content.model.companyLogos);
    const size = await page.evaluate(src => new Promise(res => { const i = new Image(); i.onload = () => res([i.width, i.height]); i.src = src; }), kept[0].dataUrl);
    expect(Math.abs(size[0] / size[1] - ratio), `the block alone, ${size}`).toBeLessThan(0.08);
  });
}
