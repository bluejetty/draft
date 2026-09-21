// A WASHROOM ON A CONSTRUCTION SHEET IS ITS THREE PIECES, not an empty box.
//
// The dealt WC (board #315) is four walls and a group -- `_dealWashrooms`
// writes no fixture record at all -- and its tub, toilet and basin are placed
// afterwards as wall-hosted fixtures. So a sheet that draws walls but not
// fixtures prints a three-piece bathroom as a blank rectangle, and the same
// silence covers every kitchen, laundry and closet, because all of them are
// that same record.
//
// These specs seed the shared bucket the way layout-viewports.spec.js does,
// place a viewport, and read the ink: the fixtures must be ON THE SHEET, and
// the same drawing with the fixtures taken out must draw strictly less.
const { test, expect } = require('@playwright/test');

const BUCKET = 'model-drawing';
const PW = 17;
const PH = 11;
const FIT_MARGIN = 60;

const point = (x, z) => ({ x, y: 0, z });

// THE DEALT WASHROOM'S OWN FOOTPRINT, off proto/repro-washroom-bungalow.draft:
// a 2x6 wet wall running the full length with 2x4s closing the other three
// sides, centre lines 9'-4" x 6'-2". The room is on the wet wall's +z side, so
// every fixture takes side 1.
const LEN = 9 + 4 / 12;
const WID = 6 + 2 / 12;

function washroomDrawing({ fixtures = true } = {}) {
  const wall = (id, sx, sz, ex, ez, wallType) => ({
    id,
    start: point(sx, sz),
    end: point(ex, ez),
    levelId: 1,
    view: 'plan',
    wallType,
    baseHeight: 0,
    topHeight: 8,
    refLine: 'center',
  });
  return {
    version: 1,
    levels: [{ id: 1, name: 'MAIN FL', elev: 0 }],
    walls: [
      wall('w1', 0, 0, LEN, 0, 'stud_2x6'),      // the wet wall
      wall('w2', LEN, 0, LEN, WID, 'stud_2x4'),  // the tub's back wall
      wall('w3', LEN, WID, 0, WID, 'stud_2x4'),  // the door wall
      wall('w4', 0, WID, 0, 0, 'stud_2x4'),
    ],
    fenestrations: [],
    fixtures: fixtures ? [
      // Basin and toilet stand on the wet wall, walking in from the door end.
      { id: 'f1', wallId: 'w1', levelId: 1, view: 'plan', kind: 'vanity', layer: 'A-CASE', offset: 1.5, width: 2.5, depth: 1.75, side: 1 },
      { id: 'f2', wallId: 'w1', levelId: 1, view: 'plan', kind: 'toilet', layer: 'A-FIXT', offset: 4.25, width: 5 / 3, depth: 7 / 3, side: 1 },
      // The alcove tub backs onto w2 with its faucet end at the wet wall, so
      // every supply in the room lands in the one 2x6.
      { id: 'f3', wallId: 'w2', levelId: 1, view: 'plan', kind: 'tub', layer: 'A-FIXT', offset: 0.5, width: 5, depth: 2.5, side: 1, endWallId: 'w1', dir: 1 },
    ] : [],
  };
}

async function openLayout(page, drawing) {
  await page.addInitScript(() => {
    if (sessionStorage.getItem('draft-test-storage-cleared')) return;
    sessionStorage.setItem('draft-test-storage-cleared', '1');
    indexedDB.deleteDatabase('pdf-img-mgr-shared');
    localStorage.clear();
  });
  await page.goto('/LAYOUT.dc.html');
  await page.waitForFunction(() => document.body.dataset.layoutReady === '1');
  await page.evaluate(async ({ bucket, saved }) => {
    const file = new File([JSON.stringify(saved)], 'model-drawing.json', { type: 'application/json' });
    await window.SharedFileStore.saveSharedFile(file, bucket);
  }, { bucket: BUCKET, saved: drawing });
  await page.reload();
  await page.waitForFunction(() => document.body.dataset.layoutReady === '1');
}

async function sheetMetrics(page) {
  const box = await page.locator('[data-layout-canvas]').boundingBox();
  const zoom = Math.min((box.width - FIT_MARGIN * 2) / PW, (box.height - FIT_MARGIN * 2) / PH);
  return {
    box,
    zoom,
    panX: (box.width - PW * zoom) / 2,
    panY: (box.height - PH * zoom) / 2,
  };
}

async function clickSheet(page, xIn, yIn) {
  const m = await sheetMetrics(page);
  await page.mouse.click(m.box.x + m.panX + xIn * m.zoom, m.box.y + m.panY + yIn * m.zoom);
}

async function placeViewport(page, xIn, yIn) {
  const seq = await page.evaluate(() => Number(document.body.dataset.layoutSaveSeq || 0));
  await page.locator('[data-layout-add-viewport]').click();
  await expect(page.locator('[data-layout-add-viewport]')).toContainText('CLICK THE SHEET');
  await clickSheet(page, xIn, yIn);
  await page.waitForFunction(
    prev => Number(document.body.dataset.layoutSaveSeq || 0) > prev, seq,
  );
}

// Ink in a box of sheet inches. Counts anything off white, so a wall, a
// dimension and a fixture all read alike -- which is why every assertion below
// is a COMPARISON against the same drawing with the fixtures removed rather
// than a bare threshold.
async function inkAround(page, xIn, yIn, radiusIn) {
  const m = await sheetMetrics(page);
  return page.evaluate(({ cx, cy, r }) => {
    const canvas = document.querySelector('[data-layout-canvas]');
    const data = canvas.getContext('2d').getImageData(
      Math.round(cx - r), Math.round(cy - r), Math.round(r * 2), Math.round(r * 2),
    ).data;
    let ink = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i] < 240 || data[i + 1] < 240 || data[i + 2] < 240) ink += 1;
    }
    return ink;
  }, { cx: m.panX + xIn * m.zoom, cy: m.panY + yIn * m.zoom, r: radiusIn * m.zoom });
}

test('a washroom draws its three pieces on the sheet', async ({ page }) => {
  await openLayout(page, washroomDrawing());
  await placeViewport(page, 8, 5);
  const withFixtures = await inkAround(page, 8, 5, 2);

  // The control: the identical drawing, fixtures taken out. Same walls, same
  // scale, same spot -- so any difference is the fixtures and nothing else.
  await openLayout(page, washroomDrawing({ fixtures: false }));
  await placeViewport(page, 8, 5);
  const without = await inkAround(page, 8, 5, 2);

  expect(without).toBeGreaterThan(50);            // the walls still draw
  expect(withFixtures).toBeGreaterThan(without);  // and the fixtures are extra ink
});

// A closet is a fixture too -- a small room drawn from the host wall, with a
// rod, a shelf, hanging clothes and a door off the DD/D ladder. It is the only
// fixture that reads the four closet numbers and the door picker, and the
// painter's env names them differently from the module that owns them
// (CLOSET_ROD_FT against closets.js's RAIL_FT), so this is the one place where
// the wiring is a RENAME.
//
// AND THIS SPEC DOES NOT PIN THAT RENAME -- said plainly, because a test whose
// reach is assumed is worse than one whose reach is known. It was mutation-run
// against three broken mappings (the rod handed the shelf's number, the
// clothes zeroed, the door picker returning nothing) and SURVIVED all three:
// every one of them still draws a closet, and "more ink than no closet" cannot
// tell a right closet from a wrong one. What it does catch is the fixture
// stage being gated off, which is the regression this file exists for.
//
// The five numbers were checked by eye instead, on a sheet at 1/4" = 1'-0":
// side walls, clothes strokes, the rod, the dashed shelf, and a door labelled
// D36 -- which is `closets.doorFor(4)` exactly. Pinning them by measurement
// wants a scanning harness in proto/, beside the other engines, rather than an
// ink threshold in here.
function closetDrawing({ closet = true } = {}) {
  const wall = (id, sx, sz, ex, ez) => ({
    id, start: point(sx, sz), end: point(ex, ez), levelId: 1, view: 'plan',
    wallType: 'stud_2x4', baseHeight: 0, topHeight: 8, refLine: 'center',
  });
  return {
    version: 1,
    levels: [{ id: 1, name: 'MAIN FL', elev: 0 }],
    walls: [
      wall('b1', 0, 0, 12, 0), wall('b2', 12, 0, 12, 10),
      wall('b3', 12, 10, 0, 10), wall('b4', 0, 10, 0, 0),
    ],
    fenestrations: [],
    fixtures: closet ? [{
      id: 'c1', wallId: 'b1', levelId: 1, view: 'plan', kind: 'closet',
      layer: 'A-FIXT', offset: 4, width: 4,
      // 2'-1" inside behind a 2x4 closet wall, which is the catalogue's own
      // depth for a closet rather than a number chosen here.
      depth: 2 + 1 / 12 + 3.5 / 12, side: 1,
    }] : [],
  };
}

test('a closet draws its rod, shelf and door on the sheet', async ({ page }) => {
  await openLayout(page, closetDrawing());
  await placeViewport(page, 8, 5);
  const withCloset = await inkAround(page, 8, 5, 2);

  await openLayout(page, closetDrawing({ closet: false }));
  await placeViewport(page, 8, 5);
  const without = await inkAround(page, 8, 5, 2);

  expect(without).toBeGreaterThan(50);
  expect(withCloset).toBeGreaterThan(without);
});

// EACH PIECE ON ITS OWN, because "the room got busier" is not proof that all
// three arrived. Dropping one fixture must cost ink, and the TUB is the one
// worth naming: an alcove tub is the only fixture whose geometry needs the
// OTHER walls -- it finds its far end by looking for a crossing wall -- so it
// is the one that silently disappears if the painter is handed the wrong wall
// set. The vanity is the casework case and reads the counter overhang.
for (const dropped of ['f1', 'f2', 'f3']) {
  const piece = { f1: 'the vanity', f2: 'the toilet', f3: 'the alcove tub' }[dropped];
  test(`${piece} draws on its own account`, async ({ page }) => {
    const all = washroomDrawing();
    await openLayout(page, all);
    await placeViewport(page, 8, 5);
    const whole = await inkAround(page, 8, 5, 2);

    const short = washroomDrawing();
    short.fixtures = short.fixtures.filter(fixture => fixture.id !== dropped);
    await openLayout(page, short);
    await placeViewport(page, 8, 5);
    const missing = await inkAround(page, 8, 5, 2);

    expect(whole).toBeGreaterThan(missing);
  });
}
