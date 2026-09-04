// THE FRONT DOOR MEANS START SOMETHING NEW.
//
// Arriving through the entry page is somebody saying "let us draw a house".
// Typing MODEL.dc.html, or using a bookmark, is somebody saying "let me get
// back to work". Same page, two intentions, and the door decides.
//
// Movie chose a real delete over setting the old drawing aside, because
// drawings are saved to .draft files. So this spec is pinning a deliberate
// loss -- which is exactly the kind of behaviour that should be pinned rather
// than remembered.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

// Draw one line and let it save, so there is something to lose.
async function drawSomething(page) {
  await h.selectTool(page, 'Line');
  await h.clickWorld(page, -8, 0);
  await h.clickWorld(page, 8, 0);
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);
  expect(h.allLines(await h.savedDrawing(page))).toHaveLength(1);
}

test('the direct URL keeps your work', async ({ page }) => {
  await h.openModel(page, { webgl: false });
  await drawSomething(page);

  await page.reload();
  await h.waitForModelReady(page, { rails: false });

  // The whole reason the drawing persists at all: it lives in IndexedDB under
  // model-drawing, and LAYOUT and PROJECT read the same bucket.
  expect(h.allLines(await h.savedDrawing(page))).toHaveLength(1);
});

test('the front door clears it', async ({ page, baseURL }) => {
  await h.openModel(page, { webgl: false });
  await drawSomething(page);

  await page.goto(`${baseURL}/MODEL.dc.html?new=1`);
  await h.waitForModelReady(page, { rails: false });

  expect(h.allLines(await h.savedDrawing(page))).toHaveLength(0);
});

// The trap this avoids: left in the address bar, the flag would wipe again on
// every reload, and a bookmark taken after arriving would eat the drawer's
// work every time it was opened.
test('the flag does not survive arrival, so a reload is safe', async ({ page, baseURL }) => {
  await h.openModel(page, { webgl: false });
  await page.goto(`${baseURL}/MODEL.dc.html?new=1`);
  await h.waitForModelReady(page, { rails: false });

  expect(page.url()).not.toContain('new=1');

  // openModel opens the rails; a raw goto reloads the page and they close
  // again, so the tools are out of reach until they are reopened. Nothing to
  // do with the front door -- it just bites any spec that navigates by hand
  // and then tries to draw.
  await h.openRails(page);
  await drawSomething(page);
  await page.reload();
  await h.waitForModelReady(page, { rails: false });

  // If the flag had stuck, this line would be gone.
  expect(h.allLines(await h.savedDrawing(page))).toHaveLength(1);
});

// The entry page is the front door, so its link must carry the flag. It was
// two links, logo and bone, sharing a destination; the bone came off the
// entry page on 4 Sep (nobody sees a bone until model space), so the logo is
// the one way in and this pins that there is exactly one, not that there are
// still two.
test('the entry link carries the flag', async ({ page, baseURL }) => {
  await page.goto(`${baseURL}/index.html`);
  const hrefs = await page.locator('a.enter-link').evaluateAll(
    els => els.map(el => el.getAttribute('href')));
  expect(hrefs).toHaveLength(1);
  for (const href of hrefs) expect(href).toContain('new=1');
});
