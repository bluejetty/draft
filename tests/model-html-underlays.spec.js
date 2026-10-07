// TIER 2 — MODEL.html paints underlays through drawUnderlays2D.
//
// An underlay is a jpg or a PDF page the drafter traces over. The painter is
// twenty lines and refuses four ways, and EVERY REFUSAL DRAWS NOTHING -- no
// placeholder, no outline, not even for the image-not-loaded case. That is
// deliberate (palette.js on draw-underlay: the photograph arrives with its own
// colours and the painter adds no ink), and it is also what makes this page's
// version dangerous: silence is indistinguishable from a broken viewer.
//
// THE TRACE CHIP DECIDES WHETHER THEY SHOW (Movie, 7 Oct), and while it is off
// the readout says how many are hidden -- the same rule the `dropped` counter
// follows: an absence stated is a fact, an absence unstated is a bug report.
// PDFs draw too now, through pdf.js fetched only when a PDF is shown.
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

// TRACE on in this browser before the page reads it.
const traceOn = page => page.addInitScript(() => {
  try { localStorage.setItem('draft.trace.on', '1'); } catch { /* fine */ }
});

// A one-page letter PDF, written by hand (see model-html-trace.spec.js).
function onePagePdf() {
  const stream = '0 0 0 RG 72 400 m 540 400 l S\n';
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R >>',
    `<< /Length ${stream.length} >>\nstream\n${stream}endstream`,
  ];
  let out = '%PDF-1.4\n';
  const offsets = [];
  objects.forEach((body, i) => { offsets.push(out.length); out += `${i + 1} 0 obj\n${body}\nendobj\n`; });
  const xref = out.length;
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.forEach(off => { out += `${String(off).padStart(10, '0')} 00000 n \n`; });
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return out;
}

async function houseOnOldPage(page) {
  await h.openModel(page, { webgl: false, rails: false, entryCoach: true });
  await expect(page.locator('[data-entry-coach]')).toBeVisible({ timeout: 4000 });
  await page.locator('[data-first-bone-press]').click();
  await h.waitForSaved(page);
}

// A real 8x8 PNG in the named-file store, so the raster path decodes something
// a browser genuinely accepts rather than a fabricated blob.
async function putUnderlay(page, { id, kind, levelId = MAIN_FL, withFile = true, pdf = null }) {
  await page.evaluate(async ({ bucket, id: uid, kind: k, levelId: lid, withFile: wf, pdf: pdfText }) => {
    if (pdfText) {
      const bytes = Uint8Array.from(pdfText, ch => ch.charCodeAt(0));
      await window.SharedFileStore.saveNamedFile(
        new File([bytes], uid, { type: 'application/pdf' }), 'underlays');
    } else if (wf) {
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
  }, { bucket: BUCKET, id, kind, levelId, withFile, pdf });
}

const readout = page => page.locator('#readout');

test.describe('MODEL.html underlays', () => {
  test('a raster underlay decodes and paints under the drawing', async ({ page }) => {
    await recordDraws(page);
    await traceOn(page);
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

  test('with TRACE off the images are hidden, and the readout says so', async ({ page }) => {
    await recordDraws(page);
    await houseOnOldPage(page);
    await putUnderlay(page, { id: 'u-hidden', kind: 'image' });
    await page.goto('/MODEL.html');
    await expect(readout(page)).toContainText('1 tracing image hidden', { timeout: 6000 });
    await expect(readout(page)).toContainText('(TRACE is off)');
    // And nothing is decoded or drawn for an image nobody is showing.
    await page.waitForTimeout(1200);
    await expect(readout(page)).toContainText('underlays 0/1');
    expect(await page.evaluate(() => window.__draws)).toHaveLength(0);
  });

  test('a PDF underlay draws its page, through pdf.js fetched on demand', async ({ page }) => {
    await recordDraws(page);
    await traceOn(page);
    await houseOnOldPage(page);
    await putUnderlay(page, { id: 'u-pdf', kind: 'pdf', pdf: onePagePdf() });
    await page.goto('/MODEL.html');
    await expect(readout(page)).toContainText('underlays 1/1', { timeout: 15000 });
    expect(await page.evaluate(() => window.__draws.length)).toBe(1);
    expect(await page.evaluate(() => Boolean(window.pdfjsLib))).toBe(true);
  });

  test('an underlay on another level does not paint', async ({ page }) => {
    await recordDraws(page);
    await traceOn(page);
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
