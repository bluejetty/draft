// THE ROOF PLAN DRAWS ONE CONNECTED ROOF, NOT THREE OUTLINES.
//
// Movie, 24 Sep, with two shots marked in the same place -- the E4 elevation
// and the ROOF PLAN:
//
//   "your updated roof has an extra line in it, that should be all one
//    connected roof"
//
// The elevation's half landed in cut-view. THIS IS THE PLAN'S HALF, and what
// it draws is decided in two places that this file does not re-measure:
//
//   proto/geometry-2d-weld-harness.js   WHICH stretches are interior, and
//                                       why a valley or a different plate is
//                                       not one -- 18 checks, 9 mutations
//   proto/render-2d-harness.js          what the painter does with the
//                                       answer, and a gable's wall line
//
// SO WHAT IS LEFT FOR A BROWSER IS THE WIRING, and it is the half an offline
// harness cannot reach: both of those pass perfectly against a page that
// never puts `roofWelds` in the env it paints through. The painter then falls
// back -- deliberately, so a page that cannot answer still draws -- and the
// seam comes back with every check still green.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';

const empty = () => ({
  version: 1,
  levels: [
    { id: 8, name: 'SITE', elev: 0 }, { id: 7, name: 'ROOF', elev: 0 },
    { id: 5, name: '2ND FL', elev: 9 }, { id: 3, name: 'MAIN FL', elev: 0 },
    { id: 1, name: 'FOUNDATION', elev: -8 },
  ],
  activeLevelIdx: 3,
  walls: [], lines: [], floors: [], roofs: [], fenestrations: [], dimensions: [],
  outlines: [], shapes: [], surfaceOpenings: [], stairs: [], notes: [],
  roomTags: [], columns: [], beams: [], boneyardOutlines: [], boneyardShelves: [],
  groups: [], levelLocks: [], underlays: [],
});

async function buildTwoStoreyGarage(page) {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, f }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, f: empty() });
  await page.goto('/MODEL.html');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  await h.openDriveThru(page);
  await page.locator('[data-build-family="bungalow"]').click();
  await page.locator('[data-build-entry="twoStorey-garage"]').click();
  await page.locator('#dt-bone').click();
  await page.waitForTimeout(400);
  await expect(page.locator('#save')).toBeEnabled({ timeout: 4000 });
  await page.locator('#save').click();
  await expect(page.locator('#save')).toHaveText('SAVED', { timeout: 6000 });
}

const savedFile = page => page.evaluate(async bucket => {
  const file = await window.SharedFileStore.loadSharedFile(bucket);
  return file ? JSON.parse(await file.text()) : null;
}, BUCKET);

// The three roofs by WHAT THEY ARE. Ids are whatever the counter was at and
// the push order is the committer's; both have already moved once.
function namedRoofs(saved) {
  const list = saved.roofs || [];
  const house = list.find(r => !Number.isFinite(Number(r.plateHeightFt)));
  const garage = list.filter(r => r !== house);
  const span = r => {
    const xs = r.points.map(p => p.x), zs = r.points.map(p => p.z);
    return (Math.max(...xs) - Math.min(...xs)) * (Math.max(...zs) - Math.min(...zs));
  };
  const tie = garage.slice().sort((a, b) => span(a) - span(b))[0];
  return { house, tie, stub: garage.find(r => r !== tie) };
}

test('the build records what each roof edge really overhangs', async ({ page }) => {
  await buildTwoStoreyGarage(page);
  const saved = await savedFile(page);
  const { house, stub, tie } = namedRoofs(saved);
  expect(!!house && !!stub && !!tie).toBe(true);
  // A HOUSE ROOF HANGS THE SAME ALL ROUND, and always did -- this is the case
  // the single `overhang` number was the whole truth for.
  expect(house.edgeOverhang).toEqual([2, 2, 2, 2]);
  // THE STUB DIES INTO THE HOUSE along its rear edge: gable AND no board to
  // hang an eave on. Offset uniformly, its wall line landed two feet inside
  // the house and poked a 2 ft stub past the house's own corner.
  expect(stub.edges[0]).toBe('gable');
  expect(stub.edgeOverhang).toEqual([0, 2, 2, 2]);
  // AND THE TIE PIECE IS THE FIRST ROOF WITH BOTH KINDS AT ONCE -- Movie,
  // 24 Sep: "we will need additional short 2ft extra peice of gable that
  // extends 2ft past the back exterior garage wall". One raked gable with
  // its two feet, two flush ones with none.
  expect(tie.edgeOverhang).toEqual([2, 2, 0, 0]);
  // Every gable, and one of them raked: the case that makes a single number
  // a lie rather than merely imprecise.
  expect(tie.edges).toEqual(['gable', 'eave', 'gable', 'gable']);
});

test('a file saved and reopened keeps its per-edge overhang', async ({ page }) => {
  // THE FIELD HAS TO SURVIVE drawing-format.js, which rebuilds every roof
  // record key by key and drops anything it does not name. A painter reading
  // a field the format silently discards would be right on screen and wrong
  // after a reload -- the shape of defect this suite has been bitten by.
  await buildTwoStoreyGarage(page);
  await page.goto('/MODEL.html');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  const saved = await savedFile(page);
  const { stub, tie } = namedRoofs(saved);
  // THROUGH THE FORMAT'S OWN SANITISER, by the name it really exports.
  // The first cut of this called `readDrawing`, which does not exist -- the
  // call returned undefined, the assertion sat behind `if (through)` and
  // never ran, and the test passed green having checked NOTHING. A guarded
  // expectation is a silent skip wearing a check's hat.
  const through = await page.evaluate(roofs =>
    window.DraftDrawingFormat.roofs(roofs, new Set([7])).map(r => r.edgeOverhang),
  [stub, tie].map(r => ({ ...r, levelId: 7 })));
  expect(through).toEqual([[0, 2, 2, 2], [2, 2, 0, 0]]);

  // AND A BAD ENTRY KEEPS THE OLD DRAWING rather than inventing a flush
  // edge: zero is not a neutral default here, it is the word FLUSH, and a
  // flush edge draws no gable wall line at all.
  const battered = await page.evaluate(roof =>
    window.DraftDrawingFormat.roofs([
      { ...roof, edgeOverhang: [0, null, 2, 2] },
      { ...roof, edgeOverhang: [0, 2] },
      { ...roof, edgeOverhang: undefined },
    ], new Set([7])).map(r => r.edgeOverhang === undefined ? 'absent' : r.edgeOverhang),
  { ...stub, levelId: 7 });
  expect(battered[0]).toEqual([0, 2, 2, 2]);   // the null took the roof's own 2
  expect(battered[1]).toBe('absent');          // a short array is not believed
  expect(battered[2]).toBe('absent');          // and an old file simply has none
});

test('the plan asks which stretches are welded, and is told about the seam', async ({ page }) => {
  await buildTwoStoreyGarage(page);
  // THE ROOF PLAN IS A LEVEL, and the page opens on MAIN FL. Tapped without
  // this the recorder came back empty and said the page never asked -- which
  // was true, and about the wrong drawing: `roofs()` is filtered to the level
  // on screen, so on MAIN FL there is no roof to weld and nothing to ask.
  //
  // THROUGH THE HELPER, which opens the right rail first: "shut is shut"
  // (Movie, 16 Sep), so the row exists in the DOM and is not clickable while
  // the rail is collapsed -- the click sat retrying on an invisible button
  // for thirty-five seconds rather than failing with a reason.
  await h.pickModelLevel(page, 7);
  await page.waitForTimeout(250);
  // THE TAP GOES ON THE GEOMETRY, NOT THE CANVAS, and that is the point. A
  // canvas tap records pixels and would need the plan's pan and zoom undone
  // to say anything about a building; this records the QUESTION the page
  // asked and the answer it was given, in feet, which is what the seam is.
  const asked = await page.evaluate(async () => {
    const G = window.DraftGeometry2D;
    const real = G.roofWeldSpans;
    const seen = [];
    G.roofWeldSpans = (roof, others) => {
      const out = real(roof, others);
      seen.push({
        points: roof.points.map(p => [p.x, p.z]),
        others: (others || []).length,
        welds: out.map((spans, i) => spans.map(([t0, t1]) => {
          const a = roof.points[i], b = roof.points[(i + 1) % roof.points.length];
          const at = t => [+(a.x + (b.x - a.x) * t).toFixed(3), +(a.z + (b.z - a.z) * t).toFixed(3)];
          return [at(t0), at(t1)];
        })),
      });
      return out;
    };
    window.dispatchEvent(new Event('resize'));
    await new Promise(r => setTimeout(r, 300));
    G.roofWeldSpans = real;
    return seen;
  });
  // ASKED AT ALL. Without this the painter's fallback draws the old seam and
  // every offline check stays green.
  expect(asked.length).toBeGreaterThan(0);
  // AND ASKED ABOUT EVERY ROOF AGAINST EVERY ROOF -- a page that handed the
  // painter one roof at a time could never find a weld.
  expect(asked.every(a => a.others >= 3)).toBe(true);

  const flat = asked.flatMap(a => a.welds.flat());
  const has = (from, to) => flat.some(([p, q]) =>
    (String(p) === String(from) && String(q) === String(to))
    || (String(p) === String(to) && String(q) === String(from)));
  // THE SEAM ITSELF, in feet. The stub's rear edge runs (-6,20)->(22,20) and
  // the tie piece carries it on for the six feet from x=16 -- so that stretch
  // is interior to the one sheet and carries no line, and the twenty-two feet
  // the house roof lies under at a different plate keep theirs.
  expect(has([16, 20], [22, 20])).toBe(true);
  // The tie's own edge against the stub is the same seam from the other side.
  expect(flat.length).toBe(2);
});
