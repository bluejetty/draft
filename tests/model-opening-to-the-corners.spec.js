// A PICKED OPENING SAYS HOW FAR IT IS FROM EACH CORNER.
//
// Movie, 15 Oct: "with windows and doors when you click them can you show
// their dimensions to the corners as well so the user can know how far they
// should move it", and on the principle behind it: "just showing the
// necessary dims rather than all is a nice feature".
//
// SO IT IS THE SELECTION THAT ASKS. Nothing is added to the drawing: the two
// numbers are read off the geometry every frame and vanish with the pick. A
// drafter sliding a window wants the two numbers that change, not two more
// dimension records to delete afterwards -- which is the whole of "the
// necessary dims rather than all".
//
// READ OFF THE CANVAS ATTRIBUTE, not off pixels. `data-opening-dims` carries
// what was drawn, the way the BONEYARD reports its side lengths, so a check
// can state the DISTANCE rather than "some ink appeared near the wall".
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const V = (x, z) => ({ x, y: 0, z });

// A 20 ft square. The north wall runs (-10,-10) -> (10,-10), and the window
// sits 5 ft along it: 5 ft to one corner, 15 to the other, which is the
// clearest pair to read -- two different numbers that still add up.
const WIN = { id: 1, wallId: 'n', type: 'window', width: 3, height: 3.5,
  sillHeight: 3.5, offset: 5, levelId: 3, view: 'plan', layer: 'A-GLAZ' };
const CENTRE = { x: -5, z: -10 };

const file = (extra = {}) => ({
  version: 1,
  levels: [{ id: 3, name: 'MAIN FL', elev: 0 }],
  activeLevelIdx: 0,
  walls: [['n', V(-10, -10), V(10, -10)], ['e', V(10, -10), V(10, 10)],
    ['s', V(10, 10), V(-10, 10)], ['w', V(-10, 10), V(-10, -10)]]
    .map(([id, start, end]) => ({ id, start, end, levelId: 3, view: 'plan',
      wallType: 'stud_2x6', baseHeight: 0, topHeight: 8, refLine: 'left' })),
  fenestrations: [WIN],
  lines: [], floors: [], roofs: [], dimensions: [], outlines: [], shapes: [],
  surfaceOpenings: [], stairs: [], notes: [], roomTags: [], columns: [],
  beams: [], boneyardOutlines: [], boneyardShelves: [], groups: [],
  levelLocks: [], underlays: [], nextDrawingItemId: 30,
  ...extra,
});

async function open(page, extra) {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, f }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, f: file(extra) });
  await page.goto('/MODEL.html');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  await page.waitForTimeout(250);
  return (await h.planFrame(page)).at;
}

const dims = page => page.locator('#plan').getAttribute('data-opening-dims')
  .then(raw => JSON.parse(raw || '[]'));

test('clicking a window says how far it is from each corner', async ({ page }) => {
  const at = await open(page);
  expect(await dims(page), 'nothing picked, nothing said').toEqual([]);

  await page.mouse.click(...at(CENTRE.x, CENTRE.z));
  await page.waitForTimeout(200);

  const shown = await dims(page);
  expect(shown.map(d => d.ft), 'both corners of its own wall').toEqual([5, 15]);
  // AND THEY ADD UP TO THE WALL, which is the check that catches a diagonal
  // measured instead of a run. The opening's centre stands on the wall's
  // physical centreline, half a thickness off the stored line when the
  // reference is a face -- measured corner-to-centre straight it reads
  // 5.0052 and 15.0018 on a 20 ft wall, and those are two numbers a drafter
  // cannot use. Projected onto the run they are what a tape reads.
  expect(shown[0].ft + shown[1].ft, 'the pair is the wall').toBeCloseTo(20, 6);
});

test('and the numbers follow it as it slides', async ({ page }) => {
  // THE WHOLE POINT, in his words: "so the user can know how far they should
  // move it". A readout that did not move with the opening would tell the
  // drafter where it USED to be, at the moment he is deciding where to put it.
  const at = await open(page);
  await page.mouse.click(...at(CENTRE.x, CENTRE.z));
  await page.waitForTimeout(150);
  expect((await dims(page)).map(d => d.ft)).toEqual([5, 15]);

  // Press it again and slide 4 ft along its wall: the two-step grab an
  // opening takes (press to pick, press again and drag).
  await page.mouse.move(...at(CENTRE.x, CENTRE.z));
  await page.mouse.down();
  await page.mouse.move(...at(CENTRE.x + 4, CENTRE.z), { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(200);

  const shown = await dims(page);
  expect(shown[0].ft, 'it is 4 ft further from the first corner')
    .toBeCloseTo(9, 1);
  expect(shown[0].ft + shown[1].ft, 'and still the whole wall').toBeCloseTo(20, 6);
});

test('a wall picked instead says nothing: this is the OPENING\'s readout',
  async ({ page }) => {
    const at = await open(page);
    await page.mouse.click(...at(5, -10));     // the same wall, clear of the window
    await page.waitForTimeout(200);
    expect(await dims(page), 'a wall has its own panel').toEqual([]);
  });

test('dropping the pick takes the numbers with it', async ({ page }) => {
  // An attribute left standing after the pick is dropped would say a readout
  // is on screen that is not -- and the specs below it would read a stale one.
  const at = await open(page);
  await page.mouse.click(...at(CENTRE.x, CENTRE.z));
  await page.waitForTimeout(150);
  expect(await dims(page)).toHaveLength(2);

  // Clicked off it, which is how a drafter drops a pick.
  await page.mouse.click(...at(0, 0));
  await page.waitForTimeout(200);
  expect(await dims(page), 'gone with the selection').toEqual([]);
});

// NO "IT IS ON THE CORNER" CASE IS CHECKED, and that is deliberate: there
// is none to reach. clampOpeningToWall keeps half a width plus the bearing
// off each end -- measured against whatever stands at that end, a 2x6
// exterior and a 2x4 partition reserving different amounts -- so an
// opening's centre cannot arrive at a corner and no number here can be
// 0'-0". The guard that would have suppressed it came out of MODEL.html
// rather than being tested, because nothing could make it run.
