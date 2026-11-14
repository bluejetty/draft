// WHAT THE FASCIA WEARS, AND THE SEAM RULE.
//
// jb, 13 Nov 2026: "default fascia, soffit, eavestroughs = PFM (pre-finished
// metal); stucco etc chosen per piece" -- and the rule the choice is for:
// "if wall is siding and fascia is PFM there should be a seam still",
// then, general: "whenever 2 surface of the same finish meet on the same
// plane" there is no line between them.
//
// THE CLAIMS:
//   THE CHOICE IS OFFERED AND STORED    FASCIA on the ROOF area, PFM first,
//                                       PFM stored as nothing, the rest as a word
//   THE FASCIA IS PICKED OFF THE DRAWING a click on the band picks its roof
//   THE SEAM RULE AT THE EAVE           flush wall in the fascia's finish: no
//                                       foot line; another finish, or an
//                                       overhang: the line stays
//   THE SEAM RULE AT THE FLOOR          one skin over and under a floor band:
//                                       no plate line; two skins: drawn
//
// The two painter claims run in node through proto/harness-env.js, on a
// FLUSH copy of the garage house (its eaves pulled back onto the walls), so
// the lines are read in feet rather than guessed from pixels.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const FIXTURE = path.join(__dirname, '..', 'proto', 'repro-garage-house.draft');
const REPRO = JSON.parse(fs.readFileSync(FIXTURE, 'utf8'));

async function openPage(page, saved = REPRO) {
  await h.suppressEntryCoach(page);
  await page.goto('/EXTFINISH.html');
  await page.waitForFunction(() => !!window.SharedFileStore, null, { timeout: 10000 });
  await page.evaluate(async ({ bucket, drawing }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(drawing)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, drawing: saved });
  await page.goto('/EXTFINISH.html');
  await expect(page.locator('#roof-list [data-roof]').first()).toBeVisible({ timeout: 10000 });
}

const storedRoofs = page => page.evaluate(async bucket => {
  const file = await window.SharedFileStore.loadSharedFile(bucket);
  const saved = JSON.parse(await file.text());
  return (saved.roofs || []).map(r => ({ id: String(r.id), fasciaFinish: r.fasciaFinish ?? null }));
}, BUCKET);

const storeHas = (page, word) => page.waitForFunction(async ({ bucket, word }) => {
  const file = await window.SharedFileStore.loadSharedFile(bucket);
  return JSON.stringify(JSON.parse(await file.text()).roofs || []).includes(word);
}, { bucket: BUCKET, word }, { timeout: 5000 });
const storeLacks = (page, word) => page.waitForFunction(async ({ bucket, word }) => {
  const file = await window.SharedFileStore.loadSharedFile(bucket);
  return !JSON.stringify(JSON.parse(await file.text()).roofs || []).includes(word);
}, { bucket: BUCKET, word }, { timeout: 5000 });

test('the ROOF area offers FASCIA, PFM first; PFM is stored as nothing and a choice as a word',
  async ({ page }) => {
    await openPage(page);
    const first = page.locator('#roof-list [data-roof]').first();
    await first.click();
    const id = await first.getAttribute('data-roof');
    const options = page.locator('#fascia-finish option');
    // PFM AND THE WHOLE WALL TABLE: a stucco fascia and a stucco wall must be
    // the same word for the seam rule to compare them.
    await expect(options.first()).toHaveAttribute('value', 'pfm');
    expect(await options.count()).toBeGreaterThan(9);
    await expect(page.locator('#fascia-finish')).toHaveValue('pfm');
    expect((await storedRoofs(page)).find(r => r.id === id).fasciaFinish,
      'a roof nobody has touched carries no fasciaFinish key').toBeNull();

    await page.locator('#fascia-finish').selectOption('stucco');
    await storeHas(page, '"fasciaFinish":"stucco"');
    await page.reload();
    await expect(first).toBeVisible();
    expect((await storedRoofs(page)).find(r => r.id === id).fasciaFinish).toBe('stucco');
    await first.click();
    await expect(page.locator('#fascia-finish')).toHaveValue('stucco');
    // ONE ROOF ONLY.
    expect((await storedRoofs(page)).filter(r => r.id !== id).every(r => r.fasciaFinish === null))
      .toBe(true);

    // BACK TO PFM REMOVES THE KEY rather than storing the word.
    await page.locator('#fascia-finish').selectOption('pfm');
    await storeLacks(page, 'fasciaFinish');
    expect((await storedRoofs(page)).find(r => r.id === id).fasciaFinish).toBeNull();
  });

test('a click on a fascia band picks its roof, the way a click on a wall picks the wall',
  async ({ page }) => {
    await openPage(page);
    await expect(page.locator('#roof-props')).toBeHidden();
    const aim = await page.evaluate(() => {
      const f = window.__extFinishFrame;
      const bands = window.__extFinishFasciaBands();
      const band = bands.find(b => b.e0 == null);
      if (!band) return null;
      const c = document.getElementById('elev');
      const box = c.getBoundingClientRect();
      const u = (band.u0 + band.u1) / 2, e = (band.top + band.foot) / 2;
      return { roofId: band.roofId, count: bands.length,
        x: box.left + (f.x0 + (u - f.uMin) * f.pxPerFt) * box.width / c.width,
        y: box.top + (f.y0 + (f.yTop - e) * f.pxPerFt) * box.height / c.height };
    });
    expect(aim, 'E1 drew at least one eave fascia band').not.toBeNull();
    await page.mouse.click(aim.x, aim.y);
    await expect(page.locator('#status')).toContainText('Fascia of ROOF');
    await expect(page.locator('#roof-props')).toBeVisible();
    await expect(page.locator(`#roof-list [data-roof="${aim.roofId}"]`))
      .toHaveAttribute('aria-pressed', 'true');
  });

// ── THE PAINTER, IN NODE ──────────────────────────────────────────────
const H = require('../proto/harness-env.js');
const flushCopy = (mutate = () => {}) => {
  const c = JSON.parse(JSON.stringify(REPRO));
  // THE EAVES PULLED BACK ONTO THE WALLS: each roof point carries the offset
  // the overhang gave it, so taking it off puts the eave on the wall line.
  c.roofs.forEach(r => {
    r.points = r.points.map(p => ({ ...p, x: p.x - (p.offX || 0), z: p.z - (p.offZ || 0), offX: 0, offZ: 0 }));
    r.overhang = 0;
    delete r.edgeOverhang;
  });
  mutate(c);
  return c;
};
const paintE1 = (saved, opts = {}) => {
  const win = H.loadDraftModules();
  const env = H.buildEnv(win, saved);
  const cut = H.standardElevationCuts(env).find(c => c.id === 'E1');
  return H.paintElevation(win, env, cut, opts);
};
// Level ink segments at a height, as [u0, u1, width].
const levelInkAt = (view, e, tol = 0.05) => {
  const out = [];
  view.strokes.filter(s => s.ink !== '#fff' && s.ink !== '#e8e8ea').forEach(s => s.pts.forEach((p, i) => {
    if (!i || p.move) return;
    const q = s.pts[i - 1];
    if (Math.abs(p.e - q.e) < 0.01 && Math.abs(p.e - e) < tol) {
      out.push([Math.min(p.u, q.u), Math.max(p.u, q.u), s.w]);
    }
  }));
  return out;
};
const FOOT_W = 2.25;   // cut-view.js: the fascia's foot, the heaviest roof line
const HOUSE_FOOT_E = 17.25;   // the 2ND FL plate, where the house eave's foot lands flush
const GARAGE_FOOT_E = 8.1;
const footAcross = (view, e, u0, u1) => levelInkAt(view, e).some(([a, b, w]) =>
  Math.abs(w - FOOT_W) < 1e-9 && a <= u0 + 0.1 && b >= u1 - 0.1);

test('the seam rule at the eave: no foot line where a flush wall wears the fascia\'s finish',
  () => {
    // THE FIXTURE'S REACH FIRST: flush, stucco walls under PFM fascia, both
    // feet are drawn -- the line Movie's drawings have always shown.
    const plain = paintE1(flushCopy());
    expect(footAcross(plain, HOUSE_FOOT_E, -8, 8), 'PFM over stucco: the house foot line').toBe(true);
    expect(footAcross(plain, GARAGE_FOOT_E, 8, 20), 'PFM over stucco: the garage foot line').toBe(true);

    // STUCCO FASCIA OVER STUCCO WALLS: one surface, no line, on both roofs.
    const same = paintE1(flushCopy(c => c.roofs.forEach(r => { r.fasciaFinish = 'stucco'; })));
    expect(levelInkAt(same, HOUSE_FOOT_E).filter(([, , w]) => Math.abs(w - FOOT_W) < 1e-9),
      'stucco over stucco: no house foot line').toEqual([]);
    expect(levelInkAt(same, GARAGE_FOOT_E).filter(([, , w]) => Math.abs(w - FOOT_W) < 1e-9),
      'stucco over stucco: no garage foot line').toEqual([]);

    // STUCCO FASCIA OVER SIDING: the line stays ("siding under PFM keeps
    // its seam" is this with the words swapped).
    const differ = paintE1(flushCopy(c => {
      c.walls.forEach(w => { w.finish = 'siding_h'; });
      c.roofs.forEach(r => { r.fasciaFinish = 'stucco'; });
    }));
    expect(footAcross(differ, HOUSE_FOOT_E, -8, 8), 'stucco over siding: the house foot line').toBe(true);

    // AND WITH AN OVERHANG THE WALL IS NOT FLUSH: the heavy line is the
    // eave's shadow, whatever either wears.
    const hung = JSON.parse(JSON.stringify(REPRO));
    hung.roofs.forEach(r => { r.fasciaFinish = 'stucco'; });
    const over = paintE1(hung);
    expect(footAcross(over, HOUSE_FOOT_E, -10, 10), '2 ft overhang: the house foot line').toBe(true);
  });

test('the seam rule at the floor: one skin over and under a floor band has no plate line, two skins keep it',
  () => {
    const PLATE_E = 8.094;   // MAIN's wall top, under the 2ND FL floor band
    const plateLine = view => levelInkAt(view, PLATE_E).some(([a, b, w]) =>
      Math.abs(w - 1.25) < 1e-9 && a <= -7.9 && b >= 7.9)
      || levelInkAt(view, PLATE_E).filter(([a, b, w]) => Math.abs(w - 1.25) < 1e-9 && a >= -8.1 && b <= 8.1)
        .reduce((len, [a, b]) => len + (b - a), 0) > 15;
    expect(plateLine(paintE1(REPRO)), 'stucco over stucco: no plate line across the house front').toBe(false);
    const two = JSON.parse(JSON.stringify(REPRO));
    two.walls.forEach(w => { if (w.levelId === 5) w.finish = 'siding_h'; });
    expect(plateLine(paintE1(two)), 'siding over stucco: the plate line is drawn').toBe(true);
  });
