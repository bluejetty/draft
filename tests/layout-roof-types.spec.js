// LAYOUT KEEPS A SAVED ROOFING, because it loads the file that names the ten.
//
// The page had every other module cut-view-env.js asks for and not this one.
// The normaliser takes its list of legal roofing ids from window.DraftRoofTypes
// and keeps `roofing` only when the stored id is on it — so with the script
// absent the list was null, the id matched nothing, and every saved roofing was
// dropped on load. Nothing threw. The sheets drew, the roof came back as the
// default, and the only trace was the warning #533 added.
//
// THE TEST IS THE PAGE'S SCRIPT SET, not the painter's arithmetic — roof-types
// itself has a harness. So it asks the page two things: that the file is there
// at all, and that a drawing carrying a non-default roofing still carries it
// after the page has read the file. The second is what a dropped tag breaks;
// the first is what names the cause when it does.
const { test, expect } = require('@playwright/test');

const BUCKET = 'model-drawing';

const point = (x, z) => ({ x, y: 0, z });

const wall = (id, levelId, view, sx, sz, ex, ez, top) => ({
  id, start: point(sx, sz), end: point(ex, ez), levelId, view,
  wallType: view === 'foundation' ? 'concrete_8' : 'stud_2x6',
  baseHeight: 0, topHeight: top, refLine: 'left',
});

const ring = (idBase, levelId, view, top) => [
  wall(idBase + 1, levelId, view, 0, 0, 36, 0, top),
  wall(idBase + 2, levelId, view, 36, 0, 36, 26, top),
  wall(idBase + 3, levelId, view, 36, 26, 0, 26, top),
  wall(idBase + 4, levelId, view, 0, 26, 0, 0, top),
];

// A roofed box with a roofing chosen by hand — CEDAR SHAKE, deliberately not
// the default, since a drawing left on asphalt would read the same either way.
function shakeDrawing() {
  return {
    version: 1,
    levels: [
      { id: 8, name: 'SITE', elev: 0 },
      { id: 7, name: 'ROOF', elev: 9 },
      { id: 3, name: 'MAIN FL', elev: 0 },
      { id: 1, name: 'FOUNDATION', elev: -9 },
    ],
    walls: [...ring(0, 3, 'plan', 8.09), ...ring(10, 1, 'foundation', 8)],
    roofs: [{
      id: 1, levelId: 7, pitch: 4, overhang: 1.5,
      roofing: 'cedar_shake', gableCorner: 'return',
      points: [
        { x: -1.5, z: -1.5 }, { x: 37.5, z: -1.5 },
        { x: 37.5, z: 27.5 }, { x: -1.5, z: 27.5 },
      ],
      edges: ['eave', 'gable', 'eave', 'gable'],
    }],
    cuts: [{
      id: 1, name: 'S1', elev: 0, levelId: 3,
      startPt: { x: 18, z: -4 }, endPt: { x: 18, z: 30 },
      dirVec: { x: 1, z: 0 },
    }],
    layout: { auto: true },
  };
}

async function openLayout(page, drawing) {
  await page.addInitScript(() => {
    if (sessionStorage.getItem('draft-test-storage-cleared')) return;
    sessionStorage.setItem('draft-test-storage-cleared', '1');
    indexedDB.deleteDatabase('pdf-img-mgr-shared');
    localStorage.clear();
  });
  await page.goto('/LAYOUT.html');
  await page.waitForFunction(() => document.body.dataset.layoutReady === '1');
  await page.evaluate(async ({ bucket, saved }) => {
    const file = new File([JSON.stringify(saved)], 'model-drawing.json', { type: 'application/json' });
    await window.SharedFileStore.saveSharedFile(file, bucket);
  }, { bucket: BUCKET, saved: drawing });
  await page.reload();
  await page.waitForFunction(() => document.body.dataset.layoutReady === '1');
}

test('LAYOUT loads roof-types.js', async ({ page }) => {
  await openLayout(page, shakeDrawing());
  expect(await page.evaluate(() => typeof window.DraftRoofTypes)).toBe('object');
  // And that it is the real module and not a stub something else left behind.
  expect(await page.evaluate(() => window.DraftRoofTypes.ROOFING_TYPES
    .some(r => r.id === 'cedar_shake'))).toBe(true);
});

test('a saved roofing survives the page load', async ({ page }) => {
  const warnings = [];
  page.on('console', message => {
    if (message.type() === 'warning') warnings.push(message.text());
  });
  await openLayout(page, shakeDrawing());
  // The env the page hands the cut painter, built the way the page builds it.
  const roof = await page.evaluate(saved => {
    const env = window.DraftCutViewEnv.buildCutViewEnv(saved, saved.levels.map(l => ({ ...l })));
    const roofs = env.roofs();
    return roofs[0] ? { roofing: roofs[0].roofing, gableCorner: roofs[0].gableCorner } : null;
  }, shakeDrawing());
  expect(roof).toEqual({ roofing: 'cedar_shake', gableCorner: 'return' });
  // #533's warning is the audible half of this; a pass here means it stayed quiet.
  expect(warnings.filter(w => w.includes('roof-types.js'))).toEqual([]);
});
