// THE VIEW RAIL ON MODEL.html — six seats, E1-E4 and S1-S2.
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
  await page.locator('[data-draw-wall]').click();
  await page.mouse.click(...at(x1, z1));
  await page.waitForTimeout(50);
  await page.mouse.click(...at(x2, z2));
  await page.waitForTimeout(80);
}

test('the rail seats all six, in the old page\'s pairing', async ({ page }) => {
  await openWith(page, [SECTION]);
  const seats = await seatData(page);

  // SIX, ALWAYS SIX. A seating chart with gaps in it is a worse answer to
  // "what can I look at" than one with empty chairs (spec §3).
  expect(seats.map(s => s.seat)).toEqual(['E1', 'E3', 'E2', 'E4', 'S1', 'S2']);

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

    // The rail and the picker are two controls on ONE piece of state. A seat
    // that left the picker behind would put two answers on screen at once.
    expect(await page.locator('#view-pick').inputValue()).toBe('cut:S1');
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
  const before = await railMs(page);
  await page.evaluate(() => {
    for (let i = 0; i < 10; i += 1) window.dispatchEvent(new Event('resize'));
  });
  await page.waitForTimeout(100);
  expect(await railMs(page), 'ten repaints must not touch the rail').toBe(before);

  // An EDIT moves it. Without this half, the assertion above is satisfied by a
  // rail that never repaints at all — which is the same picture as a rail that
  // correctly skipped the repaint, and the defect this suite keeps meeting.
  await drawWall(page, -2, -2, 2, -2);
  const after = await railMs(page);
  expect(after, 'an edit repaints the rail').not.toBe(before);
});

test('the rail costs a fraction of a frame, because the elevations are labels',
  async ({ page }) => {
    await openWith(page, [SECTION]);

    // Repaints provoked by real committed edits, and the number read is the
    // page's own — the readout carries what the rail actually spent.
    const times = [];
    for (let i = 0; i < 5; i += 1) {
      await drawWall(page, -2 + i * 0.4, -2, 2 + i * 0.4, -2);
      times.push(await railMs(page));
    }
    times.sort((a, b) => a - b);
    const median = times[Math.floor(times.length / 2)];
    console.log(`  rail repaint, 24-wall house, 5 section seats: ${median.toFixed(2)} ms median`);

    // IDENTICAL SAMPLES ARE NOT A MEASUREMENT. Reading one stale number five
    // times looks exactly like a stable result; it is how the first version of
    // this measurement "proved" the rail cost 113.6 ms on every edit, when in
    // fact nothing had repainted at all.
    expect(new Set(times).size,
      'every sample identical — the rail probably never repainted').toBeGreaterThan(1);

    // The budget is what the ruling rests on: four live elevations measured
    // 148 ms per wall drawn, which is a freeze. Ten is generous against the
    // ~1.3 ms this costs and still an order of magnitude below the old cost,
    // so it fails long before a live elevation could creep back in.
    expect(median, 'a labelled elevation seat must not cost what a painted one did')
      .toBeLessThan(10);
  });
