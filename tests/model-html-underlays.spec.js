// TIER 2 — MODEL.html paints underlays through drawUnderlays2D.
//
// An underlay is a jpg or a PDF page the drafter traces over. The painter is
// twenty lines and refuses four ways, and EVERY REFUSAL DRAWS NOTHING -- no
// placeholder, no outline, not even for the image-not-loaded case. That is
// deliberate (palette.js on draw-underlay: the photograph arrives with its own
// colours and the painter adds no ink), and it is also what makes this page's
// version dangerous: silence is indistinguishable from a broken viewer.
//
// THE SECOND TEST IS WHY THIS FILE EXISTS. This page decodes rasters and NOT
// PDFs -- pdf.js is 1.37 MB against a page whose whole claim is a short exact
// dependency list. That is a defensible trade and an indefensible silence: a
// drafter opens the viewer, the thing they were tracing is gone, and nothing
// says why. So the page names it, on the same rule the `dropped` counter
// already follows -- an absence stated is a fact, an absence unstated is a bug
// report waiting to happen.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const MAIN_FL = 3;

// Every drawImage the PLAN canvas receives. Scoped to #plan for the reason the
// stair spec records: these patch the prototype, so an unscoped hook counts
// every canvas on the page -- including the offscreen one the loader decodes
// each underlay into, which would make the count read as painting when it is
// only decoding.
async function recordDraws(page) {
  await page.addInitScript(() => {
    window.__draws = [];
    const proto = CanvasRenderingContext2D.prototype;
    const onPlan = ctx => ctx.canvas && ctx.canvas.id === 'plan';
    const clearRect = proto.clearRect;
    proto.clearRect = function (...a) {
      if (onPlan(this)) window.__draws = [];
      return clearRect.apply(this, a);
    };
    const drawImage = proto.drawImage;
    proto.drawImage = function (...a) {
      if (onPlan(this)) window.__draws.push({ w: a[3], h: a[4], alpha: this.globalAlpha });
      return drawImage.apply(this, a);
    };
  });
}

async function houseOnOldPage(page) {
  await h.openModel(page, { webgl: false, rails: false, entryCoach: true });
  await expect(page.locator('[data-entry-coach]')).toBeVisible({ timeout: 4000 });
  await page.locator('[data-first-bone-press]').click();
  await h.waitForSaved(page);
}

// A real 8x8 PNG in the named-file store, so the raster path decodes something
// a browser genuinely accepts rather than a fabricated blob.
async function putUnderlay(page, { id, kind, levelId = MAIN_FL, withFile = true }) {
  await page.evaluate(async ({ bucket, id: uid, kind: k, levelId: lid, withFile: wf }) => {
    if (wf) {
      const c = document.createElement('canvas');
      c.width = 8; c.height = 8;
      const g = c.getContext('2d');
      g.fillStyle = '#c0392b'; g.fillRect(0, 0, 8, 8);
      const blob = await new Promise(res => c.toBlob(res, 'image/png'));
      // saveNamedFile(file, bucket) -- the NAME comes from file.name, which is
      // how loadNamedFile(id, 'underlays') finds it again.
      await window.SharedFileStore.saveNamedFile(
        new File([blob], uid, { type: 'image/png' }), 'underlays');
    }
    const file = await window.SharedFileStore.loadSharedFile(bucket);
    const d = JSON.parse(await file.text());
    d.underlays = (d.underlays || []).concat([{
      id: uid, levelId: lid, kind: k, name: uid, page: 1,
      x: 0, z: 0, widthFt: 20, heightFt: 20, opacity: 0.5, scaleRatio: 1,
    }]);
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(d)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, id, kind, levelId, withFile });
}

const readout = page => page.locator('#readout');

test.describe('MODEL.html underlays', () => {
  test('a raster underlay decodes and paints under the drawing', async ({ page }) => {
    await recordDraws(page);
    await houseOnOldPage(page);
    await putUnderlay(page, { id: 'u-raster', kind: 'image' });
    await page.goto('/MODEL.html');

    // The loader is async and repaints as each image lands, so the count is
    // waited for rather than read once -- reading once would test the timing
    // of the first frame, not whether the image ever arrives.
    await expect(readout(page), 'the image decodes and the readout counts it')
      .toContainText('underlays 1/1', { timeout: 6000 });

    const draws = await page.evaluate(() => window.__draws);
    expect(draws, 'exactly one image on the plan canvas').toHaveLength(1);
    // 20 ft wide at the page's own scale, and painted at the stored opacity --
    // both come from the underlay record, so this fails if the painter is
    // handed a default instead of the drafter's own.
    expect(draws[0].alpha).toBeCloseTo(0.5, 5);
    expect(draws[0].w).toBeGreaterThan(1);
  });

  test('a PDF underlay is NAMED on the page, not silently missing', async ({ page }) => {
    await houseOnOldPage(page);
    // THE STORED FILE IS A DECODABLE PNG, DELIBERATELY, even though the record
    // says `kind: 'pdf'`. With no file at all the loader bails at
    // loadNamedFile and the kind guard is never reached -- so a sweep that
    // deleted `|| underlay.kind === 'pdf'` left this file green. A file the
    // raster path COULD decode makes the guard the only thing stopping it, and
    // the 0/1 below is then a statement about the guard rather than about a
    // missing file.
    await putUnderlay(page, { id: 'u-pdf', kind: 'pdf' });
    await page.goto('/MODEL.html');

    await expect(readout(page),
      'the raster path must not decode a PDF record even when the bytes would')
      .toContainText('underlays 0/1');
    // And it must STAY 0/1 -- the loader is async, so a guard that merely
    // decoded late would satisfy a single read.
    await page.waitForTimeout(1200);
    await expect(readout(page)).toContainText('underlays 0/1');
    // THE ASSERTION THIS FILE EXISTS FOR. Without it the drafter sees a level
    // where their tracing image used to be and nothing to distinguish "this
    // viewer does not do PDFs" from "this viewer is broken".
    await expect(readout(page),
      'a PDF underlay that cannot be drawn here must say so on the page')
      .toContainText('1 PDF underlay not drawn');
    await expect(readout(page), 'and say what would fix it').toContainText('needs pdf.js');
  });

  test('an underlay on another level does not paint', async ({ page }) => {
    await recordDraws(page);
    await houseOnOldPage(page);
    await putUnderlay(page, { id: 'u-elsewhere', kind: 'image', levelId: 1 });
    await page.goto('/MODEL.html');

    await expect(readout(page)).toContainText('underlays 0/0');
    // Give the async loader room to be wrong before believing it is right: a
    // bare assertion here would pass on a page that simply had not got round
    // to painting yet.
    await page.waitForTimeout(1500);
    expect(await page.evaluate(() => window.__draws),
      'a foundation underlay is not on the MAIN FL plan').toHaveLength(0);
  });
});
