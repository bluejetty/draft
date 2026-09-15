// THE VIEW RAIL ON MODEL.html — the seating chart, DERIVED from the levels.
//
// Spec of record: RD-DOCUMENTS/SPEC-model-html-cut-views.md §2 and §3.
//
// WHAT A SEAT SHOWS IS A RULING, NOT A DEFAULT (Devin, 12 Sep): a thumbnail
// earns its keep where the NAME does not identify the view. S1 and S2 tell a
// drafter nothing about which section is which, so only a picture separates
// them; E1 FRONT and E3 BACK already do the job a picture would. The cost
// measured below only makes the correct answer the cheap one too.
//
// THE MEASUREMENT THAT NEARLY DECIDED THIS THE OTHER WAY is why §2 of the spec
// now carries a correction. proto/cut-view-timing.js timed ONE SECTION and
// printed "six cards at the median" — one sample reported as a population it
// had never sampled. Four of the six seats are elevations, and an elevation is
// about 100x a section (E1 46.8 ms against S1 0.32 ms on the 24-wall house,
// the same at 232x152 and 900x600, so it is hidden-line geometry rather than
// fill). Live elevations cost 148 ms per wall drawn in the browser.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const REPRO = JSON.parse(fs.readFileSync(
  path.join(__dirname, '..', 'proto', 'repro-garage-house.draft'), 'utf8'));

// A cut straight through the house, west to east at z = 0: the walls span
// x -8..20 and z -6..6, so it crosses them rather than standing outside the
// model, which would paint an elevation and seat the wrong kind of picture.
const SECTION = {
  id: 'S1', name: 'S1', elev: 0, levelId: null,
  startPt: { x: -20, z: 0 }, endPt: { x: 30, z: 0 }, dirVec: { x: 0, z: 1 },
};

// `cuts` is LAYOUT's to write (tests/persisted-format.spec.js's writer map), so
// the fixture writes the file directly rather than pretending this page can
// author one.
async function openWith(page, cuts = []) {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, saved, sections }) => {
    saved.cuts = sections;
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(saved)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, saved: REPRO, sections: cuts });
  await page.goto('/MODEL.html?mode=night');
  // THE READY SIGNAL IS THE READOUT, not `data-model-ready` — that attribute
  // belongs to MODEL.dc.html and this page never sets it.
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
}

// THE RAIL TAKES SEVERAL FRAMES TO SETTLE, and at fourteen seats that is long
// enough to read a half-painted rail. One seat lands per frame -- the fix that
// keeps an edit off the 50 ms longtask threshold -- so a fourteen-seat pass is
// about fourteen frames, ~230ms, where the six-seat rail was ~100ms. Reading
// immediately after load got `S1 ink=0` and looked exactly like a seat that
// does not paint; the same seat reads 3576 two hundred milliseconds later.
// Waiting is the honest fix: the number is real and the drafter sees it too.
async function settleRail(page) {
  await expect
    .poll(async () => (/rail ([\d.]+) ms/.exec(await page.locator('#readout').textContent()) || [])[1],
      { timeout: 6000 })
    .not.toBe('0.00');
  await page.waitForTimeout(120);
}

const seatData = page => page.locator('.seat').evaluateAll(els => els.map(el => ({
  seat: el.dataset.seat,
  label: el.lastChild.textContent,
  disabled: el.disabled,
  // Anything drawn at all. Used only to tell a painted screen from a blank
  // one — WHICH picture was painted is asserted through the readout, which
  // reports the painter's own crossing count.
  ink: (() => {
    const ctx = el.firstChild.getContext('2d');
    const { data } = ctx.getImageData(0, 0, el.firstChild.width, el.firstChild.height);
    let lit = 0;
    for (let i = 0; i < data.length; i += 4) if (data[i + 3] > 0) lit += 1;
    return lit;
  })(),
})));

const railMs = page => page.evaluate(() => Number(
  /rail ([\d.]+) ms/.exec(document.getElementById('readout').textContent)[1]));

const scaleOf = page => page.evaluate(() => Number(
  /scale ([\d.]+) px\/ft/.exec(document.getElementById('readout').textContent)[1]));

// A committed edit: two taps with the wall tool armed. Each one calls
// markDirty, which is what moves the epoch — the four markDirty sites are all
// committed edits (a wall added, one removed, a move finished at mouseup, an
// undo), never a mousemove.
async function drawWall(page, x1, z1, x2, z2) {
  const box = await page.locator('#plan').boundingBox();
  const scale = await scaleOf(page);
  const at = (x, z) => [box.x + box.width / 2 + x * scale, box.y + box.height / 2 + z * scale];
  await h.armWall(page);
  await page.mouse.click(...at(x1, z1));
  await page.waitForTimeout(50);
  await page.mouse.click(...at(x2, z2));
  await page.waitForTimeout(80);
  // DISARM. The key TOGGLES and the tool stays armed after a wall commits,
  // so a second call would arm-off and its two taps would select rather than
  // draw. Left out, every edit after the first silently committed nothing --
  // and an edit that commits nothing repaints nothing, which reads exactly
  // like an edit that was free.
  await h.disarmWall(page);
  await page.waitForTimeout(40);
}

test('the rail seats the chart the old page seats', async ({ page }) => {
  await openWith(page, [SECTION]);
  await settleRail(page);
  const seats = await seatData(page);

  // DERIVED, NOT LISTED. MODEL.dc.html:7160 walks state.levels to build this,
  // and a fixed list of fourteen looks right on this fixture and is wrong the
  // first time a floor is added -- which is why the ADD / delete acceptance
  // below is the real test of it and this one is the shape.
  //
  // COUNTED OFF THE OLD PAGE rather than taken from the order. The order said
  // twelve; the old page seats FOURTEEN on the same file -- twelve filled and
  // two empty section chairs -- read out of its own two rail columns:
  //
  //     E1 · FRONT            E3 · BACK
  //     E2 · LEFT             E4 · RIGHT
  //     ROOF PLAN             SITE PLAN
  //     2ND FL PLAN (WALLS)   2ND FL LAYOUT (FLOOR)
  //     MAIN FL PLAN (WALLS)  MAIN FL LAYOUT (FLOOR)
  //     FOUNDATION            BASEMENT (WALLS)
  //     S1                    S2
  expect(seats.map(s => s.label)).toEqual([
    'E1 · FRONT', 'E3 · BACK', 'E2 · LEFT', 'E4 · RIGHT',
    'ROOF PLAN', 'SITE PLAN',
    '2ND FL PLAN (WALLS)', '2ND FL LAYOUT (FLOOR)',
    'MAIN FL PLAN (WALLS)', 'MAIN FL LAYOUT (FLOOR)',
    'FOUNDATION', 'BASEMENT (WALLS)',
    'S1', 'S2',
  ]);

  // THE FOUNDATION PAIR IS NOT plan|floor, and getting that from the label
  // rather than the code is how it would seat a blank: the second card is the
  // `plan` view LABELLED "BASEMENT (WALLS)". There is no `basement` view id.
  expect(seats.find(s => s.label === 'BASEMENT (WALLS)').seat).toBe('1:plan');
  expect(seats.find(s => s.label === 'FOUNDATION').seat).toBe('1:foundation');
  // ROOF and SITE take the whole level, so they carry no view at all.
  expect(seats.find(s => s.label === 'ROOF PLAN').seat).toBe('7:all');

  // THE PAIRING IS THE OLD PAGE'S, and reading down a column rather than
  // across it is the way to get this wrong: MODEL.dc.html fills two columns
  // E1|E3 then E2|E4 (:7266). A drafter who knows that rail looks for E3 to
  // the right of E1, not under it.
  expect(seats[0].seat, 'E1 and E3 share the first row').toBe('E1');
  expect(seats[1].seat).toBe('E3');

  // The office side names, off the profile through elevationName.
  expect(seats.find(s => s.seat === 'E1').label).toBe('E1 · FRONT');
  expect(seats.find(s => s.seat === 'E3').label).toBe('E3 · BACK');
});

test('a section seat paints a real section, and an elevation seat carries its name',
  async ({ page }) => {
    await openWith(page, [SECTION]);
    await settleRail(page);
    const seats = await seatData(page);

    // Both kinds put ink on their screen — that is the point of keeping one
    // seat shape — so ink alone cannot tell them apart, and this test does not
    // try to. What it asserts is that neither screen is BLANK, and the section
    // seat's content is checked through the painter in the next test.
    expect(seats.find(s => s.seat === 'S1').ink, 'the section seat paints').toBeGreaterThan(0);
    expect(seats.find(s => s.seat === 'E1').ink, 'the elevation seat is not blank').toBeGreaterThan(0);

    // The empty seat is the one with nothing on it.
    expect(seats.find(s => s.seat === 'S2').ink, 'an empty seat holds no picture').toBe(0);
  });

test('pressing a seat brings that view center, and the picker follows it',
  async ({ page }) => {
    await openWith(page, [SECTION]);
    await page.locator('.seat[data-seat="S1"]').click();
    await page.waitForTimeout(200);

    // THE URL IS THE STATE — the same mechanism the picker uses, so a seat
    // press is shareable and survives a reload for free.
    expect(page.url()).toContain('view=cut%3AS1');

    // A REAL SECTION, through the painter's own crossing count rather than
    // "something was drawn": drawCutView falls back to an ELEVATION when a cut
    // crosses no walls, so ink alone is true of a cut that misses the house.
    await expect(page.locator('#readout')).toContainText('section S1');
    await expect(page.locator('#readout')).toContainText('walls cut');

    // The rail and the levels panel are two controls on ONE piece of state.
    // A seat that left the panel behind would put two answers on screen at
    // once -- the picker this used to read went with the chrome bar, and the
    // section's own row carries the lit mark instead.
    await h.openModelRail(page);
    await expect(page.locator('[data-view-row="cut:S1"]'))
      .toHaveAttribute('data-active', '');
    await expect(page.locator('.seat[data-seat="S1"]')).toHaveClass(/active/);
  });

test('an elevation seat presses through to its elevation', async ({ page }) => {
  // No stored sections: the four elevations are DERIVED, so they are seated on
  // a drawing that has no `cuts` at all. This is what made the seats need the
  // lookup fix — cutForViewId searched stored cuts alone, and every elevation
  // resolved to null.
  await openWith(page, []);
  await page.locator('.seat[data-seat="E1"]').click();
  await page.waitForTimeout(200);

  expect(page.url()).toContain('view=cut%3AE1');
  // ELEVATION, not section. An auto cut stands outside the house looking at
  // it, so crossing no walls is the normal case and the readout says so.
  await expect(page.locator('#readout')).toContainText('elevation E1 · FRONT');
});

test('an empty seat is a chair, not a button', async ({ page }) => {
  await openWith(page, [SECTION]);

  // S2 has no section behind it. The creation gesture that fills this seat on
  // the old page is deferred (spec §3), so the seat must not invite a press
  // that does nothing.
  const empty = page.locator('.seat[data-seat="S2"]');
  await expect(empty).toBeDisabled();

  // And pressing it changes nothing — asserted rather than assumed, because
  // `disabled` on the element and "the click does nothing" are two claims.
  const before = page.url();
  await empty.click({ force: true });
  await page.waitForTimeout(150);
  expect(page.url(), 'an empty seat cannot navigate').toBe(before);

  // A seat WITH a view behind it is pressable, or the assertion above would
  // pass on a rail where every seat was dead.
  await expect(page.locator('.seat[data-seat="S1"]')).toBeEnabled();
});

test('the thumbnails repaint on an edit and NOT on mouse traffic', async ({ page }) => {
  await openWith(page, [SECTION]);

  // THE EPOCH IS THE WHOLE PERFORMANCE STORY. syncRail runs on every paint —
  // it must, or a seat's active ring lags the view it points at — and six
  // section paints on every pan and zoom would be a per-frame cost for six
  // pictures that did not change. MODEL.dc.html says it in one line at :7203:
  // "Repaints only when the model changes (the epoch), never on mouse traffic."
  // WAIT FOR THE FIRST PAINT TO LAND FIRST. The repaint is scheduled on a
  // requestAnimationFrame now, not run inside paint(), so immediately after
  // load the rail has been SCHEDULED and not yet drawn and railMs still reads
  // its initial 0. Sampling there and again after the resizes compared
  // "before the first paint" with "after it" and blamed the resizes for a
  // repaint they did not cause.
  await expect.poll(() => railMs(page), { timeout: 5000 })
    .toBeGreaterThan(0);

  const before = await railMs(page);
  await page.evaluate(() => {
    for (let i = 0; i < 10; i += 1) window.dispatchEvent(new Event('resize'));
  });
  // Two frames' grace, so a repaint the resizes DID schedule would have run.
  await page.waitForTimeout(200);
  expect(await railMs(page), 'ten repaints must not touch the rail').toBe(before);

  // An EDIT moves it. Without this half, the assertion above is satisfied by a
  // rail that never repaints at all — which is the same picture as a rail that
  // correctly skipped the repaint, and the defect this suite keeps meeting.
  await drawWall(page, -2, -2, 2, -2);
  await page.waitForTimeout(200);
  const after = await railMs(page);
  expect(after, 'an edit repaints the rail').not.toBe(before);
});

test('the seats paint one per frame, which is what keeps the task short',
  async ({ page }) => {
    // THE LONGTASK CHECK BELOW IS PROBABILISTIC AND THIS ONE IS NOT, which is
    // why both exist. Before the split, four elevations in one frame came to
    // 47 ms against the browser's 50 ms threshold, so the block was reported
    // on about three runs in five -- meaning that check PASSED twice in five
    // on a page that was broken, and would pass always on a faster machine.
    // An assertion satisfied by more than one world state is the defect this
    // suite keeps meeting; this one names the mechanism instead of the
    // symptom, so a revert to painting all six in one frame fails it every
    // time rather than two times in five.
    //
    // PATCHING THIS MODULE HAS A TRAP IN IT, recorded because it cost two
    // probes that both reported confident nonsense: cut-view.js:1758 exports
    // through `window.DraftCutView = Object.freeze({...})`, so assigning onto
    // the module is a SILENT no-op in sloppy mode. The first probe reported
    // "0 painter calls" on a page whose seats were painting perfectly. Replace
    // the frozen object; do not mutate it.
    await h.openModel(page, { webgl: false });
    await page.evaluate(async ({ bucket, saved, sections }) => {
      saved.cuts = sections;
      await window.SharedFileStore.saveSharedFile(
        new File([JSON.stringify(saved)], 'drawing.json', { type: 'application/json' }), bucket);
    }, { bucket: BUCKET, saved: REPRO, sections: [SECTION] });

    await page.addInitScript(() => {
      window.__paints = [];
      window.__frame = 0;
      const tick = () => { window.__frame += 1; requestAnimationFrame(tick); };
      requestAnimationFrame(tick);
      // HOOKED ON clearRect, NOT ON THE PAINTER, and that is the second
      // version of this check. The first patched DraftCutView.drawCutView,
      // which only the CUT seats go through -- once the plan seats arrived it
      // counted five of fourteen and reported "5 seats across 5 frames" on a
      // rail that was painting nine more it could not see. A check that
      // silently narrows to a subset is worse than one that fails.
      //
      // Every seat of either kind starts by clearing its own canvas, so this
      // is the one call both paths share, and `.seat` scopes it to the rail.
      const realClear = CanvasRenderingContext2D.prototype.clearRect;
      CanvasRenderingContext2D.prototype.clearRect = function (...args) {
        const host = this.canvas && this.canvas.parentElement;
        if (host && host.classList && host.classList.contains('seat')) {
          window.__paints.push({ seat: host.dataset.seat, frame: window.__frame });
        }
        return realClear.apply(this, args);
      };
    });
    await page.goto('/MODEL.html?mode=night');
    await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
    await page.waitForTimeout(400);

    await page.evaluate(() => { window.__paints = []; });
    await drawWall(page, -3, -1.5, 3, -1.5);
    await page.waitForTimeout(600);

    const paints = await page.evaluate(() => window.__paints.slice());
    // THE EDIT HAS TO HAVE REPAINTED AT ALL, or every assertion below is true
    // of a rail that did nothing -- the void-sample fault this file already
    // carries a guard for on the timing test.
    expect(paints.length, 'the edit repainted no seat at all').toBeGreaterThan(1);

    const perFrame = new Map();
    paints.forEach(p => perFrame.set(p.frame, (perFrame.get(p.frame) || 0) + 1));
    const worst = Math.max(...perFrame.values());
    console.log(`  ${paints.length} seats painted across ${perFrame.size} frames`
      + `, worst frame ${worst}`);

    // ONE SEAT PER FRAME. The whole fix in one line: the longest task the rail
    // can produce is one elevation, not four, and the total work is unchanged.
    expect(worst,
      `${worst} seats painted in a single frame -- the rail is back to one long task`)
      .toBe(1);
  });

test('an edit never blocks the main thread, even with four live elevations',
  async ({ page }) => {
    await openWith(page, [SECTION]);

    // MEASURED ON A DRAFTING BOARD, and the void-sample guard below is what
    // said so. These are three (four) SEPARATE two-tap runs, and on the default
    // TOY board §1 refuses a new run while one is unfinished — a rule with its
    // own check (model-toy-draw.spec.js:447), which also proves putting the
    // tool down does not cancel the run. So every edit after the first was
    // correctly refused, committed nothing, and this read as a chrome
    // regression. The subject here is what the chrome costs, not what the
    // board allows, so the board is named rather than inherited.
    await page.locator('#mode-corner [data-board="drafting"]').click();
    await expect(page.locator('body')).toHaveAttribute('data-board', 'drafting');

    // WHAT A DRAFTER FEELS, not a millisecond budget. The old assertion here
    // read `rail < 10ms`, which encoded the labels ruling; Movie reversed that
    // after seeing it — the dc page shows live elevations and he wants them —
    // so the question changed from "how cheap" to "does it stutter".
    //
    // A long task IS the stutter: the browser reports any main-thread block
    // over 50ms, which is what turns a wall landing instantly into a wall
    // landing after a lurch. Measured rather than budgeted, so this stays
    // honest if the machine running it is slower than mine.
    //
    // Two things had to be true together for this to pass, and they are the
    // two things that were wrong before:
    //   - the repaint runs on a requestAnimationFrame, not inside the click
    //     handler, which is what MODEL.dc.html does at :7188;
    //   - the seats paint with coarseSilhouette, which takes an elevation from
    //     ~28ms to ~7ms, so four of them fit in a frame budget at all.
    // Drop either and this goes red.
    await page.evaluate(() => {
      window.__long = [];
      new PerformanceObserver(list => list.getEntries()
        .forEach(e => window.__long.push(Math.round(e.duration))))
        .observe({ entryTypes: ['longtask'] });
    });

    const rails = [];
    for (let i = 0; i < 4; i += 1) {
      const before = await page.evaluate(() =>
        Number(/walls \d+\/(\d+)/.exec(document.getElementById('readout').textContent)[1]));
      // Parallel walls on their own z, not near-collinear ones: overlapping
      // runs snap onto the wall already there and commit nothing, which is
      // what the guard below caught on the first attempt.
      await drawWall(page, -3, -1.5 - i * 0.9, 3, -1.5 - i * 0.9);
      await page.waitForTimeout(300);
      const after = await page.evaluate(() =>
        Number(/walls \d+\/(\d+)/.exec(document.getElementById('readout').textContent)[1]));
      // A VOID SAMPLE IS NOT A FAST ONE. An edit that did not commit bumps no
      // epoch and repaints nothing, and reads exactly like an edit that was
      // free — which is how an earlier version of this measurement reported
      // "no long tasks" from four edits that never happened.
      expect(after, `edit ${i + 1} did not commit — the sample would be void`)
        .toBeGreaterThan(before);
      rails.push(await railMs(page));
    }

    const long = await page.evaluate(() => window.__long.slice());
    console.log(`  rail repaint per edit: ${rails.map(m => m.toFixed(0)).join(', ')} ms`
      + `   long tasks: ${long.length ? long.join(', ') + ' ms' : 'none'}`);

    expect(long, `an edit blocked the main thread: ${long.join(', ')} ms`).toEqual([]);
    expect(new Set(rails).size,
      'every sample identical — the rail probably never repainted').toBeGreaterThan(1);
  });

test('ADD A LEVEL AND TWO SEATS APPEAR; DELETE IT AND THEY LEAVE', async ({ page }) => {
  // THE ACCEPTANCE TEST OF THE WHOLE ORDER, and the reason the LEVELS /
  // LAYERS panel had to come first: "a rail built against a level list nobody
  // can edit cannot be shown to be right". A fixed list of fourteen passes
  // every other check in this file and fails this one.
  await openWith(page, [SECTION]);
  await settleRail(page);
  const before = await seatData(page);

  await page.locator('#right-tab').click();
  await page.evaluate(() => {
    window.prompt = q => (/Level name/.test(q) ? 'ATTIC' : '20');
  });
  await page.locator('[data-add-level]').click();
  await settleRail(page);

  // WITHOUT A RELOAD. The page is never navigated in this test.
  const added = await seatData(page);
  expect(added.length, 'a new level must add exactly two seats')
    .toBe(before.length + 2);
  expect(added.map(s => s.label)).toContain('ATTIC PLAN (WALLS)');
  expect(added.map(s => s.label)).toContain('ATTIC LAYOUT (FLOOR)');

  // AND THEY LAND IN THE RIGHT ROW, above the floor below them rather than at
  // the end: the chart is ordered by the building, not by insertion.
  const labels = added.map(s => s.label);
  expect(labels.indexOf('ATTIC PLAN (WALLS)'))
    .toBeLessThan(labels.indexOf('2ND FL PLAN (WALLS)'));

  // DELETE IT AND THEY LEAVE, and nothing else moves.
  await page.evaluate(() => { window.confirm = () => true; });
  const atticId = await page.evaluate(() => [...document.querySelectorAll('.lv-card')]
    .find(c => c.querySelector('.lv-name').textContent === 'ATTIC').dataset.level);
  await page.locator(`[data-delete-level="${atticId}"]`).click();
  await settleRail(page);

  const after = await seatData(page);
  expect(after.map(s => s.label), 'the seats are exactly what they were before the level existed')
    .toEqual(before.map(s => s.label));
});
