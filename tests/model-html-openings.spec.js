// OPENINGS ON MODEL.html — the windows and doors the page used to leave out.
//
// Every real drawing in this app has fenestrations, and this page drew none of
// them. A house opened here showed BLANK WALLS: the records loaded, saved back
// untouched, and were simply never painted. Nothing said so, which is the
// quiet kind of wrong — the drawing is not damaged, it is just not the
// drawing.
//
// WHAT IS MEASURED IS INK ON THE CANVAS, and it has to be. An opening's whole
// job is visual: there is no record to check, because the record was already
// there and already correct. So the assertions sample pixels, and they sample
// them in PAIRS — inside the opening and on the solid wall beside it — because
// ink appearing somewhere is true of any drawing. Only the two together say a
// hole was cut in a wall.
//
// AND THE INSTRUMENT IS INK, NOT THE GAP. The first version of this file
// counted the paper colour inside the opening, on the reasoning that the hole
// is filled with it. That cannot work here and the numbers said so — 35 inside
// the opening against 96 on the solid wall. `draw-wall` is deliberately almost
// the page colour on BOTH skins (1.30 night, 1.12 day: "a plan does not shout
// its walls with fill, it draws them with line"), so the wall and the hole in
// it are near enough the same colour that a fill check measures antialiasing.
//
// What DOES separate them is linework. A stretch of solid wall carries two
// long edges running along it; an opening carries two jambs across it, two
// glazing panes, a frame block at each end and the centre grab dot — a dense
// cluster of ink in a few feet. So the count is of pixels that differ from the
// paper, which works whichever skin the page is wearing.
//
// THE PAINTER IS SHARED with MODEL.dc.html (render-2d.js drawOpening2D), so
// what this file guards is the WIRING: that the openings are found, that their
// geometry resolves, and that they are drawn ON TOP of the wall rather than
// under it — painted first they would be poche-d over and disappear, which
// looks exactly like not drawing them at all.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const V = (x, z) => ({ x, y: 0, z });

// ONE LONG WALL ACROSS THE MIDDLE, with a window in the centre of it and a
// door off to one side. A single wall rather than a room: a room's corners
// bring mitres into the sample, and this file is not about mitres.
//
// The wall runs 40 ft so that at any fit() scale the 4 ft window is several
// pixels wide — a hole narrower than the sample radius cannot be told from a
// smudge.
const WALL_ID = 'w-main';
const base = extra => ({
  version: 1,
  levels: [{ id: 3, name: 'MAIN FL', elev: 0 }],
  activeLevelIdx: 0,
  walls: [{
    id: WALL_ID, start: V(-20, 8), end: V(20, 8), levelId: 3, view: 'plan',
    wallType: 'stud_2x6', baseHeight: 0, topHeight: 8, refLine: 'center',
  }, {
    // A SECOND WALL, SQUARE TO IT, and it is not decoration: fit() frames the
    // drawing's extent, and a single horizontal wall gives the camera no
    // height to work with — every earlier version of this fixture put the
    // sample points off the canvas.
    id: 'w-side', start: V(-20, 8), end: V(-20, 32), levelId: 3, view: 'plan',
    wallType: 'stud_2x6', baseHeight: 0, topHeight: 8, refLine: 'center',
  }],
  fenestrations: [{
    id: 'f-win', wallId: WALL_ID, levelId: 3, view: 'plan', type: 'window',
    layer: 'A-GLAZ', offset: 20, width: 6, sillHeight: 3, headHeight: 7,
    garage: false, auto: false,
  }],
  lines: [], floors: [], roofs: [], dimensions: [],
  outlines: [], shapes: [], surfaceOpenings: [], stairs: [], notes: [],
  roomTags: [], columns: [], beams: [], boneyardOutlines: [], boneyardShelves: [],
  groups: [], levelLocks: [], underlays: [],
  ...extra,
});

// The window's centre in world feet. offset 20 along a wall that starts at
// x -20 puts it at x 0, and the wall lies on z 8.
//
// OFF THE ORIGIN, DELIBERATELY. The wall sat on z 0 and the window's centre
// landed exactly on (0,0) -- where this page draws the drawing's REGISTRATION
// MARK. Every sample at the "window" was reading that mark: 138 ink pixels
// turned up there on a fixture whose window had been refused for being 400 ft
// wide, which is how it was found. A test that measures the thing it is not
// about passes for a reason that has nothing to do with the feature.
const WINDOW_AT = [0, 8];
// SOLID WALL, four feet clear of the opening's edge and no further.
//
// It was at x -12 and that was a FALSE GREEN waiting to happen: zoomed in on
// the window, a point twelve feet away is off the canvas entirely, getImageData
// clamps, and the sample comes back transparent -- which counts as no ink. The
// comparison then read "the window has more ink than a piece of wall that is
// not on screen", which is true of a page that draws nothing at all. The
// opening spans x -3..3, so this sits just past it and stays in frame.
const SOLID_AT = [7, 8];

async function open(page, file) {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, f }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json',
        { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, f: file });
  await page.goto('/MODEL.html');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  // The paint has landed before anything is sampled: a screenshot of a frame
  // that has not been drawn yet is a page-coloured rectangle, which is exactly
  // what a missing opening looks like.
  await page.waitForTimeout(250);
}

// ZOOM IN FIRST, and this is a measurement rather than a preference. A
// stud_2x6 is 6 1/2 inches -- about HALF A FOOT -- so at the scale fit()
// chooses for a 40 ft wall the whole wall is roughly three pixels thick and
// the 6 ft window is a sliver. Every reading taken there is antialiasing: the
// first version of this file measured 106 ink pixels at the window against 132
// on solid wall and the DIFFERENCE was real, but it was the fill erasing the
// wall's own two edges, not the opening's detail, and which way it pointed
// depended on the zoom.
//
// Zoomed in, the two samples are different things rather than different
// amounts of blur: a box on solid wall sits INSIDE the poche, which is
// deliberately almost the paper colour, while the same box at the opening
// carries the glazing panes and the centre grab dot.
async function zoomOnto(page, [x, z], notches = 7) {
  for (let i = 0; i < notches; i += 1) {
    const frame = await h.planFrame(page);
    const at = frame.at(x, z);
    await page.mouse.move(at[0], at[1]);
    await page.mouse.wheel(0, -120);
    await page.waitForTimeout(60);
  }
  await page.waitForTimeout(150);
}

// WHAT IS ACTUALLY ON THE GLASS around a world point, through the published
// camera so the sample lands where it says it does.
async function inkAround(page, [x, z], radius = 6) {
  const frame = await h.planFrame(page);
  const [clientX, clientY] = frame.at(x, z);
  // ON THE CANVAS, OR THIS IS NOT A MEASUREMENT. getImageData outside the
  // bitmap returns transparent pixels rather than an error, and transparent
  // counts as no ink -- so an off-screen sample silently reads as blank paper
  // and every "more ink here than there" comparison against it passes. Found
  // exactly that way.
  const box = frame.box;
  if (clientX < box.x || clientX > box.x + box.width
    || clientY < box.y || clientY > box.y + box.height) {
    throw new Error(`the sample at world ${x},${z} is off the canvas `
      + `(${Math.round(clientX)},${Math.round(clientY)} against `
      + `${Math.round(box.x)},${Math.round(box.y)} `
      + `${Math.round(box.width)}x${Math.round(box.height)}) -- it would read `
      + 'as blank paper and prove nothing');
  }
  return page.evaluate(({ clientX, clientY, radius }) => {
    const canvas = document.getElementById('plan');
    const rect = canvas.getBoundingClientRect();
    const sx = canvas.width / rect.width;
    const sy = canvas.height / rect.height;
    const px = Math.round((clientX - rect.left) * sx);
    const py = Math.round((clientY - rect.top) * sy);
    const size = Math.max(2, Math.round(radius * 2 * sx));
    return Array.from(canvas.getContext('2d').getImageData(
      Math.max(0, px - size / 2), Math.max(0, py - size / 2), size, size).data);
  }, { clientX, clientY, radius });
}

// INK: pixels that differ from the paper by more than antialiasing does.
//
// NOT "darker than the paper", which is what the old page's own detail spec
// counts (fenestration-detail.spec.js:9). That page has one skin and it is a
// light one. This page has a NIGHT skin, where the ink is lighter than the
// ground, and a darker-than check would count nothing at all on it and pass
// for the wrong reason.
const ink = pixels => {
  let count = 0;
  const [pr, pg, pb] = pixels.slice(0, 4);
  for (let i = 0; i < pixels.length; i += 4) {
    if (pixels[i + 3] < 200) continue;
    const d = Math.abs(pixels[i] - pr) + Math.abs(pixels[i + 1] - pg)
      + Math.abs(pixels[i + 2] - pb);
    if (d > 60) count += 1;
  }
  return count;
};

test('a window is drawn into the wall, not left as a blank stretch of it',
  async ({ page }) => {
    await open(page, base());
    await zoomOnto(page, WINDOW_AT);

    const atWindow = ink(await inkAround(page, WINDOW_AT, 10));
    const atWall = ink(await inkAround(page, SOLID_AT, 10));

    // THE PAIR IS THE MEASUREMENT, and the same-frame comparison is what makes
    // it one. Ink at the window says nothing alone: the wall's own two edges
    // run through that sample too. What says an opening was drawn is that
    // there is MORE of it there than on the identical stretch of wall twelve
    // feet away -- same wall, same zoom, same frame, the only difference being
    // the record this rung teaches the page to paint.
    expect(atWindow, 'an opening carries glazing panes and its centre grab dot '
      + 'where the solid wall carries only poche -- and poche is deliberately '
      + 'almost the paper colour, which is what makes the two samples differ '
      + 'in KIND rather than in blur').toBeGreaterThan(atWall);
  });

// EVERY PIXEL ON THE CANVAS, counted. The point samples above are aimed at one
// spot each, which is right for "is the window there" and useless for "did
// something appear that should not have". For that the whole sheet is the
// instrument.
const wholeCanvasInk = page => page.evaluate(() => {
  const canvas = document.getElementById('plan');
  const data = canvas.getContext('2d')
    .getImageData(0, 0, canvas.width, canvas.height).data;
  const [pr, pg, pb] = data.slice(0, 4);
  let count = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 200) continue;
    const d = Math.abs(data[i] - pr) + Math.abs(data[i + 1] - pg)
      + Math.abs(data[i + 2] - pb);
    if (d > 60) count += 1;
  }
  return count;
});

test('an opening whose wall is not on this level is not drawn', async ({ page }) => {
  // THE WALL DECIDES, NOT THE OPENING'S OWN levelId. An opening is matched to
  // the walls being painted by wallId, because a wall can be shown from
  // another level through a shared context and its openings must come with it
  // or the wall arrives solid. The mirror of that rule is this: an opening
  // pointing at a wall that is not being drawn is not drawn either, and a
  // painter handed no host wall would throw rather than skip.
  const orphaned = base();
  orphaned.fenestrations.push({
    id: 'f-orphan', wallId: 'wall-that-is-not-here', levelId: 3, view: 'plan',
    type: 'door', layer: 'A-DOOR', offset: 4, width: 3,
    sillHeight: 0, headHeight: 7, garage: false, auto: false,
  });

  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await open(page, orphaned);

  expect(errors, 'the orphan was skipped rather than thrown on').toEqual([]);
  const withOrphan = await wholeCanvasInk(page);

  // AND THE REAL ONE STILL DREW. Without this the test passes on a page that
  // gave up at the first bad record and painted nothing at all.
  await zoomOnto(page, WINDOW_AT);
  expect(ink(await inkAround(page, WINDOW_AT, 10)),
    'the window beside it was still drawn')
    .toBeGreaterThan(ink(await inkAround(page, SOLID_AT, 10)));

  // NOT ONE PIXEL DIFFERENT from the same drawing without the orphan in it.
  //
  // This is the assertion that has teeth, and the point samples do not: a
  // fallback that handed the orphan to the FIRST wall on screen instead of its
  // own would draw a door in the middle of a wall the drafter never put one
  // in, several feet from anywhere this file aims a sample. Nothing local can
  // see that; the whole sheet can. The mutation that did exactly that survived
  // until this went in.
  await page.goto('about:blank');
  await open(page, base());
  expect(await wholeCanvasInk(page),
    'an orphaned record changed the drawing').toBe(withOrphan);
});

test('an opening too wide for its wall is skipped, not drawn wrong',
  async ({ page }) => {
    // clampOpeningToWall refuses an opening that cannot sit on its wall with
    // the bearing left at each end, and answers null. A painter handed that
    // null reads `.corners` off it and throws on the first line -- taking the
    // whole frame with it, so a single bad record would blank the drawing.
    const tooWide = base();
    tooWide.fenestrations[0].width = 400;

    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await open(page, tooWide);

    expect(errors, 'a refusal is a refusal, not a crash').toEqual([]);

    // AND THE WALL IS STILL PLAIN THERE. A 400 ft window that drew anyway
    // would cut the wall from end to end, which is the failure this guards --
    // so the middle of the wall carries no more ink than any other stretch of
    // it, which is the same comparison the first test makes and the opposite
    // answer.
    await zoomOnto(page, WINDOW_AT);
    expect(ink(await inkAround(page, WINDOW_AT, 10)),
      'nothing was drawn where the impossible window was asked for')
      .toBeLessThanOrEqual(ink(await inkAround(page, SOLID_AT, 10)));
  });
