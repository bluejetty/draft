// SIDING THAT FILLS IN, A BAND HELD TO THE WALL, AND STUCCO DARK.
//
// jb, 26 Nov 2026, on EXT. FINISH (his 2 storey, E2 and E3): "at the floor
// level and also at the roof it looks like there is a gap in the vinyl
// siding. can we do something smart to solve this so it will fill in";
// "the BAND, maybe we should put a restriction based on the actual wall
// height"; then, with the back switched to a gable: "i can't select the
// GABLE area to put ext finish ... also the fascia boards look wobbly"; and
// "a 2nd STUCCO version called STUCCO DARK ... (for white reg STUCCO no
// dots) but for DARK STUCCO make a random dot/scratch type stucco pattern".
//
// HIS VINYL IS A BAND, NOT THE BASE: every wall's base is still the default
// stucco and the siding is a band from the sill. That is the whole of it:
//
//   THE FLOOR LINE      each storey coursed its siding off its own sill, so a
//                       course and a half went missing at the floor line
//   THE EAVE            the seam rule read the BASE (stucco) against his
//                       stucco fascia, called it one surface and dropped the
//                       board's foot line -- the board read as a gap
//   THE GABLE           the band stopped at the plate, and the triangle over
//                       it was a face this page could not click
//
// The fixture is his file with the back roof edge turned to a gable and a
// 0'-9'-3.6" band of H. Siding on every wall (proto/repro-jb-siding-bands).
// In the node bench E2 looks at an eave side, E4 at the gable (the page's E3).
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const h = require('./helpers');
const H = require('../proto/harness-env.js');

const BUCKET = 'model-drawing';
const FIXTURE = path.join(__dirname, '..', 'proto', 'repro-jb-siding-bands.draft');
const REPRO = JSON.parse(fs.readFileSync(FIXTURE, 'utf8'));
const copy = (mutate = () => {}) => { const c = JSON.parse(JSON.stringify(REPRO)); mutate(c); return c; };

const paint = (saved, id) => {
  const win = H.loadDraftModules();
  const env = H.buildEnv(win, saved);
  const cut = H.standardElevationCuts(env).find(c => c.id === id);
  return H.paintElevation(win, env, cut, { finishes: true });
};
const HATCH = '#1d1f20';
const HATCH_W = 0.75;
// The level hatch lines crossing station u, as elevations, low to high.
const coursesAt = (view, u) => {
  const out = [];
  view.strokes.filter(s => s.ink === HATCH && s.w === HATCH_W && s.clip).forEach(s => {
    const ce = s.clip.map(p => p.e);
    const clipLo = Math.min(...ce), clipHi = Math.max(...ce);
    if (clipLo > 9.5) return;   // a roof plane's shingle hatch, not a wall's
    s.pts.forEach((p, i) => {
      if (!i || p.move) return;
      const q = s.pts[i - 1];
      if (Math.abs(p.e - q.e) > 0.001) return;
      if (u < Math.min(p.u, q.u) || u > Math.max(p.u, q.u)) return;
      if (p.e < clipLo - 1e-6 || p.e > clipHi + 1e-6) return;
      out.push(p.e);
    });
  });
  return [...new Set(out.map(e => Math.round(e * 1000) / 1000))].sort((a, b) => a - b);
};
const EXPOSURE_FT = 4 / 12;

test('the floor line: one coursing up the house, no strip without a course', () => {
  const view = paint(REPRO, 'E2');
  const courses = coursesAt(view, -10).filter(e => e > 6 && e < 11);
  expect(courses.length, 'siding courses either side of the 2ND FL floor').toBeGreaterThan(10);
  const gaps = courses.slice(1).map((e, i) => e - courses[i]);
  // ONE EXPOSURE APART, ACROSS THE FLOOR TOO: the main floor's last course
  // and the 2ND FL's first were 0.45 ft apart (a course and a half).
  expect(Math.max(...gaps), `course spacing ${gaps.map(g => g.toFixed(3)).join(' ')}`)
    .toBeLessThan(EXPOSURE_FT + 0.03);
  // AND ON ONE GRID: two storeys coursed apart and a floor strip coursed on
  // a third put lines a fraction of a course apart.
  expect(Math.min(...gaps), `course spacing ${gaps.map(g => g.toFixed(3)).join(' ')}`)
    .toBeGreaterThan(EXPOSURE_FT - 0.03);
});

// THE FLOOR STRIP TAKES EACH WALL'S OWN FINISH (jb, 27 Nov 2026, E3/E4:
// "at floor the fill sometimes goes to other type? how come"; then "left
// also have the problem"). His TIMBERHOUSE: siding walls, a 1' jog set back
// in STUCCO DARK, 2' STUCCO DARK stubs at the front corner, and a plain
// stucco end wall. The strip between storeys was one piece per run at the
// nearest wall's depth, so a jog took its neighbour's finish and a column
// in the same plane left the whole strip bare.
const STRIP = JSON.parse(fs.readFileSync(
  path.join(__dirname, '..', 'proto', 'repro-jb-floor-strip-jog.draft'), 'utf8'));
// The floor strip's hatch strokes: [lo, hi, 'lines' | 'dots'].
const stripOf = view => view.strokes
  .filter(s => s.ink === HATCH && s.clip && s.pts.length)
  .filter(s => { const ce = s.clip.map(p => p.e); return Math.min(...ce) > 7.9 && Math.max(...ce) < 9.5; })
  .map(s => {
    const cu = s.clip.map(p => p.u);
    const flat = s.pts.every((p, i) => !i || p.move || Math.abs(p.e - s.pts[i - 1].e) < 1e-6);
    const long = s.pts.some((p, i) => i && !p.move && Math.abs(p.u - s.pts[i - 1].u) > 1);
    return [+Math.min(...cu).toFixed(2), +Math.max(...cu).toFixed(2), flat && long ? 'lines' : 'dots'];
  })
  .sort((a, b) => a[0] - b[0]);

test('the floor strip takes the finish of the walls over and under it, piece by piece', () => {
  // E1, the front: siding, then a 2' STUCCO DARK column in the same plane.
  expect(stripOf(paint(STRIP, 'E1'))).toEqual([[-41.5, 0, 'lines'], [0, 2, 'dots']]);
  // The back: a 1' STUCCO DARK jog (with its 2' stubs) beside the siding.
  expect(stripOf(paint(STRIP, 'E3'))).toEqual([[-2, 1, 'dots'], [1, 41.5, 'lines']]);
  // E4: the siding jog set back a foot, and the near wall plain stucco --
  // the jog keeps its siding, the stucco wall's strip stays blank.
  expect(stripOf(paint(STRIP, 'E4'))).toEqual([[13, 19.5, 'lines']]);
});

test('the eave: a stucco board over a vinyl BAND keeps its foot line', () => {
  // His roof: 0" overhang, 5 1/2" stucco fascia, base finish stucco, vinyl band.
  const footAt = v => v.strokes.filter(s => s.w === 2.25 && s.pts.every(p => Math.abs(p.e - 17.42) < 0.02)
    && Math.abs(s.pts[0].u - s.pts[s.pts.length - 1].u) > 20);
  const view = paint(REPRO, 'E1');
  const foot = footAt(view);
  expect(foot.length, 'the heavy line along the board\'s foot').toBeGreaterThan(0);
  // AND THE SAME BOARD OVER A STUCCO WALL STILL BLENDS (the 14 Nov rule).
  const plain = paint(copy(c => c.walls.forEach(w => { delete w.finishBands; })), 'E1');
  expect(footAt(plain), 'stucco board over stucco: no foot line').toEqual([]);
});

test('the gable: a band that reaches the plate fills the triangle', () => {
  const view = paint(REPRO, 'E4');
  const plate = 17.427;
  const above = coursesAt(view, 9.75).filter(e => e > plate + 0.2);
  expect(above.length, 'siding courses up the gable over the 2ND FL band').toBeGreaterThan(10);
  // A WAINSCOT STILL STOPS: 3 ft of siding leaves the gable plain.
  const low = paint(copy(c => c.walls.forEach(w => {
    if (w.finishBands) w.finishBands = [{ finishId: 'siding_h', lowFt: 0, highFt: 3 }];
  })), 'E4');
  expect(coursesAt(low, 9.75).filter(e => e > plate + 0.2), 'a 3 ft band: nothing in the gable').toEqual([]);
});

test('the rake: the outline up a straight rake is one straight line, not a pixel stair', () => {
  const view = paint(REPRO, 'E4');
  // The heavy outline through the gable's apex.
  const outline = view.strokes.find(s => s.w === 1.5 && s.pts.some(p => Math.abs(p.e - 24.377) < 0.01)
    && s.pts.length > 3);
  expect(outline, 'the roof outline').toBeTruthy();
  // The main roof's rake, apex at u 9.75 down to its eave at 19.5 (the
  // jog roof breaks the outline on the other side).
  const rising = outline.pts.filter(p => p.e > 18 && p.e < 24.3 && p.u > 9.8);
  expect(rising.length, `points on the rake: ${rising.map(p => `${p.u.toFixed(2)},${p.e.toFixed(3)}`).join(' ')}`)
    .toBeLessThan(3);
});

test('STUCCO DARK stipples, plain STUCCO stays blank, and they are two skins', () => {
  const win = H.loadDraftModules();
  const WT = win.DraftWallTypes;
  const FP = win.DraftFinishPatterns;
  const dark = WT.finishById('stucco_dark');
  expect(dark.id).toBe('stucco_dark');
  expect(dark.label).toBe('Stucco Dark');
  const box = { x0: 0, x1: 200, yTop: 0, yBottom: 200, pxPerFt: 12 };
  const drawn = finish => {
    const { ctx, strokes } = H.recordingCtx();
    FP.drawFinish(ctx, box, finish, {});
    return strokes.reduce((n, s) => n + s.pts.filter(p => !p.move).length, 0);
  };
  expect(drawn(WT.finishById('stucco')), 'white stucco: no dots').toBe(0);
  expect(drawn(dark), 'dark stucco: a stipple').toBeGreaterThan(300);
  // SAME EVERY REPAINT.
  const once = H.recordingCtx(); FP.drawFinish(once.ctx, box, dark, {});
  const again = H.recordingCtx(); FP.drawFinish(again.ctx, box, dark, {});
  expect(JSON.stringify(once.strokes)).toBe(JSON.stringify(again.strokes));
});

// ── ON THE PAGE ───────────────────────────────────────────────────────
async function openPage(page, saved = REPRO, elev = 'E3') {
  await h.suppressEntryCoach(page);
  await page.goto('/EXTFINISH.html');
  await page.waitForFunction(() => !!window.SharedFileStore, null, { timeout: 10000 });
  await page.evaluate(async ({ bucket, drawing }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(drawing)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, drawing: saved });
  await page.goto(`/EXTFINISH.html?elev=${elev}`);
  await page.waitForFunction(() => !!window.__extFinishFrame && window.__extFinishFaceOutlines().length > 0,
    null, { timeout: 10000 });
}
const screenAt = (page, u, e) => page.evaluate(([u, e]) => {
  const f = window.__extFinishFrame;
  const c = document.getElementById('elev');
  const box = c.getBoundingClientRect();
  return { x: box.left + (f.x0 + (u - f.uMin) * f.pxPerFt) * box.width / c.width,
    y: box.top + (f.y0 + (f.yTop - e) * f.pxPerFt) * box.height / c.height };
}, [u, e]);
const storedBands = (page, wallId) => page.evaluate(async ({ bucket, wallId }) => {
  const file = await window.SharedFileStore.loadSharedFile(bucket);
  const w = JSON.parse(await file.text()).walls.find(x => String(x.id) === wallId);
  return w ? (w.finishBands || []) : null;
}, { bucket: BUCKET, wallId });

test('a click in the gable triangle picks THE GABLE, its own area; a band\'s top stops at the apex',
  async ({ page }) => {
    // jb, 26 Nov 2026: "the 2nd floor wall and gable are the same BAND, can
    // we make the gable area a seperate BAND area?"
    await openPage(page);
    const gable = await page.evaluate(() => {
      const o = window.__extFinishFaceOutlines();
      // The outlines come far to near; the LAST climbing one is the wall in
      // front, the one a click there means.
      const climbing = o.filter(x => x.tops.some(t => t.top > 20));
      const g = climbing[climbing.length - 1];
      const apex = g.tops.reduce((a, t) => (t.top > a.top ? t : a));
      return { wallIds: [...new Set(climbing.map(x => x.wallId))], u: apex.u, e: apex.top - 1.5,
        wallE: g.floor + 3 };
    });
    let at = await screenAt(page, gable.u, gable.e);
    await page.mouse.click(at.x, at.y);
    await expect(page.locator('#status')).toContainText('Gable');
    await expect(page.locator('#gable-props')).toBeVisible();
    await expect(page.locator('#wall-props')).toBeHidden();
    await expect(page.locator('#gable-finish')).toHaveValue('');
    await page.locator('#gable-finish').selectOption('shake');
    const gableOwners = () => page.evaluate(async bucket => {
      const file = await window.SharedFileStore.loadSharedFile(bucket);
      return JSON.parse(await file.text()).walls.filter(w => w.gableFinish)
        .map(w => ({ id: String(w.id), gableFinish: w.gableFinish, bands: (w.finishBands || []).length }));
    }, BUCKET);
    await expect.poll(gableOwners).toEqual([expect.objectContaining({ gableFinish: 'shake', bands: 1 })]);
    const owner = (await gableOwners())[0].id;
    expect(gable.wallIds, 'the gable picked is over a wall with a gable').toContain(owner);
    // BACK TO "SAME AS THE WALL" TAKES THE KEY OFF.
    await page.locator('#gable-finish').selectOption('');
    await expect.poll(gableOwners).toEqual([]);

    // THE WALL UNDER IT, below the plate, is still the wall -- and its TO box
    // is held to the wall: past the apex it is stored as FILL TO THE TOP.
    at = await screenAt(page, gable.u, gable.wallE);
    await page.mouse.click(at.x, at.y);
    await expect(page.locator('#band-area')).toBeVisible();
    await page.locator('#band-finish').selectOption('stucco_dark');
    await page.fill('#band-low', '0');
    await page.fill('#band-high', '40');
    await page.click('#band-add');
    await expect.poll(() => page.evaluate(async bucket => {
      const file = await window.SharedFileStore.loadSharedFile(bucket);
      return JSON.parse(await file.text()).walls
        .filter(w => (w.finishBands || []).some(b => b.finishId === 'stucco_dark'))
        .map(w => w.finishBands.slice(-1)[0]);
    }, BUCKET)).toEqual([{ finishId: 'stucco_dark', lowFt: 0, toTop: true }]);
  });

test('a gable with its own finish: shake in the triangle, the wall\'s siding stops at the plate, a seam between',
  () => {
    const plate = 17.427;
    const own = paint(copy(c => c.walls.forEach(w => {
      if (w.levelId === 5 && w.view === 'plan') w.gableFinish = 'shake';
    })), 'E4');
    // NO SIDING COURSES IN THE GABLE: the band is not carried up any more.
    expect(coursesAt(own, 9.75).filter(e => e > plate + 0.2), 'no lap siding in the gable').toEqual([]);
    // SHAKE IN IT: courses of 7" with their stubs, clipped to the triangle.
    const shake = own.strokes.filter(s => s.ink === HATCH && s.clip
      && Math.min(...s.clip.map(p => p.e)) >= plate - 0.05 && s.pts.some(p => p.e > plate + 1));
    expect(shake.length, 'shake drawn over the plate').toBeGreaterThan(0);
    // AND THE PLATE IS A SEAM: one ink line along it.
    const seam = own.strokes.filter(s => s.w === 1 && s.pts.length === 2
      && s.pts.every(p => Math.abs(p.e - plate) < 0.03) && Math.abs(s.pts[0].u - s.pts[1].u) > 10);
    expect(seam.length, 'the seam line at the plate').toBeGreaterThan(0);
  });

test('nudging a band\'s top past the wall\'s head turns on FILL TO THE TOP', async ({ page }) => {
  await openPage(page, REPRO, 'E2');
  const face = await page.evaluate(() => {
    const o = window.__extFinishFaceOutlines().filter(x => !x.gable);
    const g = o.sort((a, b) => (b.hi - b.lo) - (a.hi - a.lo)).find(x => x.floor > 5);
    return { wallId: g.wallId, u: (g.lo + g.hi) / 2, e: g.floor + 2 };
  });
  const at = await screenAt(page, face.u, face.e);
  await page.mouse.click(at.x, at.y);
  await page.locator('#band-list [data-open-band="0"]').click();
  await expect(page.locator('#band-edit')).toBeVisible();
  for (let i = 0; i < 6 && await page.locator('#prop-high').isVisible(); i += 1) {
    await page.click('#nudge-high-up');
  }
  await expect(page.locator('#band-totop')).toBeChecked();
  const bands = await storedBands(page, face.wallId);
  expect(bands[0].toTop).toBe(true);
  expect(bands[0].highFt).toBeUndefined();
});
