// THE DWG -> DXF CONVERTER (DXF/), and its handoff into MODEL's TRACE.
//
// Movie, 11 Oct: "lets make it a seperate program and have a whole brand new
// page for it" -- "roughdrafter.com/DXF" -- and "once the file is converted
// you ask the user if they would like to open the file in ROUGHDRAFTER".
//
// The DWG under test is LibreDWG's own example_2018.dwg, committed beside the
// converter in DXF/samples/.
const fs = require('fs');
const path = require('path');
const { test, expect } = require('@playwright/test');

const SAMPLE = path.join(__dirname, '..', 'DXF', 'samples', 'example_2018.dwg');

async function convertOne(page) {
  await page.goto('/DXF/');
  const download = page.waitForEvent('download');
  await page.locator('[data-file]').setInputFiles([SAMPLE]);
  await expect(page.locator('[data-row="example_2018.dwg"]')).toHaveAttribute('data-state', 'done', { timeout: 60000 });
  return download;
}

test('a DWG comes out as a full DXF of the same version, and is saved', async ({ page }) => {
  test.setTimeout(90000);
  const download = await convertOne(page);
  const file = await download;
  expect(file.suggestedFilename()).toBe('example_2018.dxf');
  const text = fs.readFileSync(await file.path(), 'utf8');
  // libredwg's own writer: the whole file, the DWG's version kept (2018).
  expect(text).toMatch(/\$ACADVER\s+1\s+AC1032/);
  for (const section of ['HEADER', 'TABLES', 'BLOCKS', 'ENTITIES', 'OBJECTS']) {
    expect(text, `the DXF has its ${section} section`).toMatch(new RegExp(`SECTION\\s+2\\s+${section}`));
  }
  // LAYERS THAT ARE ON STAY ON. libredwg's writer put every layer's colour
  // out negative -- "off" -- and Movie's ArchiCAD plans arrived with all
  // twelve layers dark. The DWG's own on/off is written back.
  const layerColours = [...text.matchAll(/AcDbLayerTableRecord\s+2\s+(\S[^\r\n]*)\s+70\s+-?\d+\s+62\s+(-?\d+)/g)]
    .map(m => [m[1].trim(), Number(m[2])]);
  expect(layerColours.length, 'the LAYER table was read').toBe(5);
  expect(layerColours.filter(([, c]) => c > 0).length, 'layers that are on in the DWG are on in the DXF')
    .toBeGreaterThan(0);
  expect(layerColours.find(([n]) => n === '0')[1], 'layer 0 is on').toBeGreaterThan(0);
  // The row says what it read.
  const meta = page.locator('[data-row="example_2018.dwg"] .meta');
  await expect(meta).toContainText('Converted');
  await expect(meta).toContainText('AutoCAD 2018');
  await expect(meta).toContainText('5 layers');
  // And the preview is drawn, not left blank.
  const inked = await page.locator('[data-row="example_2018.dwg"] canvas').evaluate(c => {
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    let n = 0;
    for (let i = 0; i < d.length; i += 4) if (d[i] > 120) n += 1;
    return n;
  });
  expect(inked, 'the row preview draws the drawing').toBeGreaterThan(20);
});

test('it asks to open the drawing in RoughDrafter, and a yes lands it in TRACE', async ({ page }) => {
  test.setTimeout(90000);
  await convertOne(page);
  await expect(page.locator('[data-ask]')).toBeVisible();
  await expect(page.locator('[data-ask-file]')).toContainText('example_2018.dwg → example_2018.dxf');
  await page.locator('[data-ask-yes]').click();
  await page.waitForURL(/MODEL\.html/);
  // TRACE's card, holding the DXF that was handed across.
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 15000 });
  const card = page.locator('.trace-card');
  await expect(card).toBeVisible({ timeout: 10000 });
  await expect(card).toContainText('DXF');
  await expect(card).toContainText('5 layers');
  // The ask is spent: the URL no longer carries it, and the slot is empty.
  expect(page.url()).not.toContain('trace=handoff');
  const left = await page.evaluate(() => new Promise(resolve => {
    const open = indexedDB.open('rd-dxf-handoff', 1);
    open.onsuccess = () => {
      const get = open.result.transaction('files').objectStore('files').get('pending');
      get.onsuccess = () => resolve(get.result ?? null);
    };
  }));
  expect(left, 'the handoff is taken, not left for the next visit').toBeNull();
});

test('JUST DOWNLOAD with "don\'t ask again" stops the question', async ({ page }) => {
  test.setTimeout(90000);
  await convertOne(page);
  await expect(page.locator('[data-ask]')).toBeVisible();
  await page.locator('[data-ask-never]').check();
  await page.locator('[data-ask-no]').click();
  await expect(page.locator('[data-ask]')).toBeHidden();
  // A second file converts without asking -- but its row still offers it.
  const again = page.waitForEvent('download');
  await page.locator('[data-file]').setInputFiles([{ name: 'second.dwg', mimeType: 'application/acad',
    buffer: fs.readFileSync(SAMPLE) }]);
  await expect(page.locator('[data-row="second.dwg"]')).toHaveAttribute('data-state', 'done', { timeout: 60000 });
  expect((await again).suggestedFilename()).toBe('second.dxf');
  await expect(page.locator('[data-ask]')).toBeHidden();
  await expect(page.locator('[data-row="second.dwg"] [data-open-row]')).toBeVisible();
});

test('several files come back as one ZIP, and a file that is not a DWG says so', async ({ page }) => {
  test.setTimeout(90000);
  await page.goto('/DXF/');
  const download = page.waitForEvent('download');
  const dwg = fs.readFileSync(SAMPLE);
  await page.locator('[data-file]').setInputFiles([
    { name: 'a.dwg', mimeType: 'application/acad', buffer: dwg },
    { name: 'b.dwg', mimeType: 'application/acad', buffer: dwg },
    { name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('not a drawing') },
    { name: 'fake.dwg', mimeType: 'application/acad', buffer: Buffer.from('not a drawing either') },
  ]);
  await expect(page.locator('[data-row="b.dwg"]')).toHaveAttribute('data-state', 'done', { timeout: 60000 });
  await expect(page.locator('[data-row="a.dwg"]')).toHaveAttribute('data-state', 'done', { timeout: 60000 });
  await expect(page.locator('[data-row="notes.txt"]')).toHaveAttribute('data-state', 'failed');
  await expect(page.locator('[data-row="fake.dwg"]')).toHaveAttribute('data-state', 'failed');
  await expect(page.locator('[data-row="fake.dwg"] .meta')).toContainText('not a DWG');
  const zip = await download;
  expect(zip.suggestedFilename()).toBe('converted-dxf.zip');
  const bytes = fs.readFileSync(await zip.path());
  expect(bytes.subarray(0, 2).toString()).toBe('PK');
  // Both DXFs are in it, by name.
  expect(bytes.includes(Buffer.from('a.dxf'))).toBe(true);
  expect(bytes.includes(Buffer.from('b.dxf'))).toBe(true);
  await expect(page.locator('[data-all]')).toBeVisible();
});

test('MODEL with nothing handed over says so instead of hanging', async ({ page }) => {
  await page.goto('/MODEL.html?trace=handoff');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 15000 });
  await expect(page.locator('.trace-card')).toContainText('did not arrive');
});
