// A WALL DRAGGED OFF ITS FOOTPRINT IS ASKED WHAT IT MEANT.
//
// Movie, 15 Oct, asked what the footprint should do when a wall is pulled
// away from it, and answered with the question: "can we ask them if they
// would like a cantilever or overhang supported by a beam (2ft max if
// cantilevel, 4-6 min if supported on beam. or ask them if they would like to
// move the foundation other floors and roof at the same time --- 3 options".
//
// IT IS THE ONE ANSWER THE PAGE CANNOT WORK OUT. The drag says where the wall
// went and nothing about what it meant: the same 2 ft east is a cantilevered
// floor, a supported overhang, or the whole building getting wider.
//
// AND IT IS WHAT THE DIMENSION ORDER WAS WAITING ON. Measured on this page
// before any of this was written: a wall dragged 4 ft east moved its corner
// and left the outline where it was, and AUTO DIMS strings the OUTLINE (walls
// are only its fallback) -- so a re-run laid a 20'-0" overall over a 24 ft
// building. The strings follow once the footprint does.
//
// THE NUMBERS ARE NOT THIS FILE'S. 2'-0" free, nothing between 2'-0" and
// 4'-6", piles beyond, at most 8'-0" apart: tour.js's floorPullLadder and
// boneyard-edit.js's constants have held them since the BONEYARD went in, and
// the page reads them from there. proto/boneyard-edit-harness.js pins the
// ladder itself; what only a page test can reach is the SEAM -- that the drag
// raises the card, that each button does what its label says, and that one
// Ctrl+Z puts the whole answer back.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const MAIN_FL = 3, FOUNDATION = 1, ROOF = 7, SECOND_FL = 5;
const V = (x, z) => ({ x, y: 0, z });

// A 20 ft square house: four walls, the footprint on the same four corners,
// and a roof 2 ft out all round. The NE corner at (10,-10) is what every
// gesture here drags.
const NE = { x: 10, z: -10 };
const CORNERS = [V(-10, -10), V(10, -10), V(10, 10), V(-10, 10)];
const OVERHANG = 2;

// AUTO STRINGS ALREADY ON THE SHEET, because the re-lay only follows strings
// that are there: a drafter who has never pressed AUTO DIMS must not find a
// dimensioned plan because he nudged a wall. One overall per side is enough to
// read the building's width off the save.
// THE ID IS A NUMBER AND THE LAYER IS ONE OF THE FIVE, because the loader
// refuses a dimension that is neither (drawing-format.js reads `Number(id)`
// and checks the layer against DIMENSION_LAYERS) -- and a refused record is
// parked and re-emitted on save, so a fixture that got this wrong would save
// back exactly what it wrote and look like a re-lay that did not happen.
const autoDim = (id, start, end) => ({
  id, start, end, levelId: MAIN_FL, view: 'plan', auto: true, layer: 'A-DIMS-OVR',
});

// THE BONE-LINKED HALF OF THE FIXTURE, switched on by `master`. A traced
// house keeps its common geometry on a BONEYARD shelf and every floor carries
// a COPY pointing back at it corner by corner -- which is the link the whole
// "move the foundation, floors and roof" answer travels down, and the thing a
// cantilever has to take one corner OFF (overriddenSrcIds) so a later master
// edit cannot quietly pull the overhang back flush.
const MASTER_ID = 'm1';
const srcOf = i => `mp${i}`;
const masterPoints = () => CORNERS.map((p, i) => ({ x: p.x, z: p.z, id: srcOf(i) }));
const copyFor = (id, levelId) => ({
  id, levelId, masterId: MASTER_ID, overriddenSrcIds: [],
  points: CORNERS.map((p, i) => ({ ...p, srcId: srcOf(i) })),
});

// `drag` is the level the WALLS are on and the one the page opens at -- the
// storey the gesture happens on. It defaults to MAIN FL, which has nothing
// under it; the inward half needs 2ND FL, which has.
const file = ({ board = 'drafting', roof = true, dims = true, master = false,
  drag = MAIN_FL, noNorthWall = false } = {}) => ({
  version: 1,
  levels: [
    { id: ROOF, name: 'ROOF', elev: 0 },
    ...(master ? [{ id: SECOND_FL, name: '2ND FL', elev: 9 }] : []),
    { id: MAIN_FL, name: 'MAIN FL', elev: 0 },
    { id: FOUNDATION, name: 'FOUNDATION', elev: -8 },
  ],
  activeLevelIdx: drag === SECOND_FL ? 1 : (master ? 2 : 1),
  board,
  walls: [
    ['n', V(-10, -10), V(10, -10)], ['e', V(10, -10), V(10, 10)],
    ['s', V(10, 10), V(-10, 10)], ['w', V(-10, 10), V(-10, -10)],
  ].filter(([id]) => !(noNorthWall && id === 'n'))
    .map(([id, start, end]) => ({
      id, start, end, levelId: drag, view: 'plan',
      wallType: 'stud_2x6', baseHeight: 0, topHeight: 8, refLine: 'left',
    })),
  outlines: master
    ? [copyFor('house', MAIN_FL), copyFor('upper', SECOND_FL)]
    : [{ id: 'house', levelId: MAIN_FL, points: CORNERS.map(p => ({ ...p })) }],
  roofs: roof ? [{
    id: 'roof1', levelId: ROOF, view: 'plan', overhang: OVERHANG, pitch: 6,
    points: [V(-12, -12), V(12, -12), V(12, 12), V(-12, 12)],
    edges: ['eave', 'eave', 'eave', 'eave'],
  }] : [],
  dimensions: dims ? [
    autoDim(901, V(-10, -13), V(10, -13)),
    autoDim(902, V(13, -10), V(13, 10)),
  ] : [],
  // A LINE ALONG THE NORTH WALL, corner to corner. Draughting, not the
  // building -- and the body grab answers for a selected line now, so it can
  // reach the card's own gesture.
  lines: [{ id: 'l1', levelId: drag, view: 'plan', layer: 'draft',
    start: V(-10, -10), end: V(10, -10) }],
  floors: [], fenestrations: [], shapes: [], surfaceOpenings: [],
  stairs: [], notes: [], roomTags: [], columns: [], beams: [],
  boneyardShelves: master ? [{ id: 1, name: 'SHELF 1' }] : [],
  boneyardOutlines: master
    ? [{ id: MASTER_ID, shelfId: 1, points: masterPoints() }] : [],
  groups: [], levelLocks: [],
  underlays: [], nextDrawingItemId: 60,
});

async function open(page, opts = {}) {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, f }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, f: file(opts) });
  // THE LEVEL IS NAMED IN THE URL, not left to activeLevelIdx. The rail
  // orders levels by the sheet set rather than by the file's array, so that
  // index is the page's ordering and not this fixture's -- it opened MAIN FL
  // for a fixture whose walls were all on the 2ND FL, and every gesture
  // landed on an empty sheet.
  const level = opts.drag || MAIN_FL;
  await page.goto(`/MODEL.html?level=${level}`);
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  await page.waitForTimeout(250);
}

// Select the north wall, then pull its NE end to (x, z). cornerAt only offers
// the SELECTED wall's two ends, so the click is not optional.
async function pullCorner(page, x, z) {
  const { at } = await h.planFrame(page);
  await page.mouse.click(...at(0, -10));
  await page.waitForTimeout(80);
  await page.mouse.move(...at(NE.x, NE.z));
  await page.mouse.down();
  await page.mouse.move(...at(x, z), { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(150);
}

const card = page => page.locator('#footprint-ask');
const cantilever = page => card(page).locator('[data-footprint-cantilever]');
const piles = page => card(page).locator('[data-footprint-piles]');
const moveAll = page => card(page).locator('[data-footprint-all]');
const deck = page => card(page).locator('[data-footprint-deck]');

const saveAndRead = async page => {
  await page.locator('[data-model-save]').click();
  await expect(page.locator('[data-model-save]')).toHaveText(/saved/i, { timeout: 6000 });
  return page.evaluate(async bucket => {
    const f = await window.SharedFileStore.loadSharedFile(bucket);
    return JSON.parse(await f.text());
  }, BUCKET);
};

// The house's NE corner as the WALL has it and as the FOOTPRINT has it. Asked
// together on purpose: the whole complaint was that these two could disagree,
// so every answer below is read as a pair rather than one at a time.
const corner = saved => ({
  wall: saved.walls.find(w => w.id === 'n').end,
  outline: saved.outlines.find(o => o.id === 'house').points[1],
});

test('a small pull offers the cantilever, and not the piles', async ({ page }) => {
  await open(page);
  await pullCorner(page, 11.5, -10);
  await expect(card(page), 'the card comes up on its own').toBeVisible();
  await expect(cantilever(page), "1'-6\" is inside the free cantilever").toBeVisible();
  await expect(cantilever(page)).toContainText(`1'-6"`);
  await expect(piles(page), 'and nothing that short needs holding up').toBeHidden();
  await expect(moveAll(page), 'the whole building is always an answer').toBeVisible();
});

test('CANTILEVER moves the footprint on this level and freezes it off the master',
  async ({ page }) => {
    await open(page);
    await pullCorner(page, 11.5, -10);
    await cantilever(page).click();
    await page.waitForTimeout(150);

    const saved = await saveAndRead(page);
    const { wall, outline } = corner(saved);
    expect(wall.x, 'the wall is where the hand left it').toBeCloseTo(11.5, 2);
    expect(outline.x, 'and the footprint came with it').toBeCloseTo(11.5, 2);
    expect(outline.z).toBeCloseTo(-10, 2);
  });

test('a pull into the forbidden band comes back as 2 ft or goes out to 4-6',
  async ({ page }) => {
    // 3'-0" is in the gap the ladder refuses -- "A nudge that would land in
    // the gap jumps it". Both buttons are offered and each says the number it
    // will actually give, because the page may not hand back what the hand did.
    await open(page);
    await pullCorner(page, 13, -10);
    await expect(cantilever(page)).toContainText(`2'-0"`);
    await expect(piles(page)).toContainText(`4'-6"`);

    await piles(page).click();
    await page.waitForTimeout(150);
    const saved = await saveAndRead(page);
    const { wall, outline } = corner(saved);
    expect(wall.x, 'the wall went out to the first pile line').toBeCloseTo(14.5, 2);
    expect(outline.x, 'and the footprint with it').toBeCloseTo(14.5, 2);
  });

test('ON PILES puts a pile under the overhang, and it is the drafter\'s',
  async ({ page }) => {
    await open(page);
    await pullCorner(page, 16, -10);
    await expect(cantilever(page), '6 ft out is not a cantilever at all').toBeHidden();
    await piles(page).click();
    await page.waitForTimeout(200);

    const saved = await saveAndRead(page);
    const pile = (saved.columns || [])[0];
    expect(saved.columns, 'one pile under the corner that is out in the air')
      .toHaveLength(1);
    expect(pile.footing, 'the 10" pile the BONEYARD rules name').toBe('pile10');
    expect(pile.levelId, 'piles live on the foundation').toBe(FOUNDATION);
    expect(pile.auto, 'not a suggestion AUTO PILES may sweep away').toBe(false);
    expect(pile.point.x, 'standing under the corner it holds up').toBeCloseTo(16, 2);
  });

test('MOVE FOUNDATION, FLOORS & ROOF takes the eave with it', async ({ page }) => {
  await open(page);
  await pullCorner(page, 14, -10);
  await moveAll(page).click();
  await page.waitForTimeout(200);

  const saved = await saveAndRead(page);
  const { wall, outline } = corner(saved);
  expect(wall.x, 'the wall stands where it was dropped').toBeCloseTo(14, 2);
  expect(outline.x, 'the footprint came with it').toBeCloseTo(14, 2);
  // THE EAVE IS NEVER AT THE CORNER -- it stands one overhang out, which is
  // why it needs its own rule and why this reads 16 and not 14.
  const eave = saved.roofs[0].points
    .find(p => Math.abs(p.z - (-12)) < 0.01 && p.x > 0);
  expect(eave.x, 'and the roof eave rode its own corner').toBeCloseTo(16, 2);
});

test('the strings re-lay off the footprint that moved', async ({ page }) => {
  // THE ORDER THIS WAS ALL WAITING ON. The overall was 20'-0" over a 20 ft
  // house; the building is 24 ft wide now, so the string that measures it has
  // to say so without anybody pressing AUTO DIMS again.
  await open(page);
  await pullCorner(page, 14, -10);
  await moveAll(page).click();
  await page.waitForTimeout(250);

  const saved = await saveAndRead(page);
  const auto = (saved.dimensions || []).filter(d => d.auto === true
    && Number(d.levelId) === MAIN_FL && Math.abs(d.start.z - d.end.z) < 1e-6);
  const widest = Math.max(...auto.map(d => Math.abs(d.end.x - d.start.x)));
  expect(widest, 'the overall grew with the building').toBeCloseTo(24, 1);
});

test('ESCAPE leaves the wall off its footprint, which is what the page did before',
  async ({ page }) => {
    await open(page);
    await pullCorner(page, 14, -10);
    await expect(card(page)).toBeVisible();
    await page.keyboard.press('Escape');
    await page.waitForTimeout(150);
    await expect(card(page)).toBeHidden();

    const saved = await saveAndRead(page);
    const { wall, outline } = corner(saved);
    expect(wall.x, 'the wall kept the drag').toBeCloseTo(14, 2);
    expect(outline.x, 'and the footprint was not touched').toBeCloseTo(10, 6);
  });

test('one Ctrl+Z puts the wall, the footprint and the pile back', async ({ page }) => {
  // ONE GESTURE, ONE UNDO. The answer is written into the drag's own move
  // step, so a drafter who did not mean any of it presses Ctrl+Z once --
  // not once for the wall and again for what the answer added.
  await open(page);
  await pullCorner(page, 16, -10);
  await piles(page).click();
  await page.waitForTimeout(200);
  await page.keyboard.press('Control+z');
  await page.waitForTimeout(200);

  const saved = await saveAndRead(page);
  const { wall, outline } = corner(saved);
  expect(wall.x, 'the wall is back on the corner').toBeCloseTo(10, 6);
  expect(outline.x, 'the footprint never left it').toBeCloseTo(10, 6);
  expect(saved.columns || [], 'and the pile it placed is gone').toHaveLength(0);
});

test('the TOY board is never asked', async ({ page }) => {
  // Nothing on that board has a foundation to cantilever off, and a modal in
  // the middle of a child's drag is the one thing the board is built not to
  // do. It takes the whole-building answer, which is what a push means there.
  await open(page, { board: 'toy' });
  await pullCorner(page, 14, -10);
  await expect(card(page), 'no card on the bone board').toBeHidden();

  const saved = await saveAndRead(page);
  const { outline } = corner(saved);
  expect(outline.x, 'and the footprint went with the wall anyway').toBeCloseTo(14, 2);
});

test('a corner slid ALONG its own wall is not off the footprint', async ({ page }) => {
  // The card asks about a wall that LEFT the footprint, and the measure is
  // the distance to the loop it started on -- not the length of the pull. A
  // corner dragged 3 ft down the east wall's own line never leaves the
  // building, so there is nothing to ask about and no card.
  await open(page);
  await pullCorner(page, 10, -7);
  await expect(card(page), 'it is still on the footprint').toBeHidden();
});

// ── AND DOWN THE BONE'S OWN LINK ──────────────────────────────────────────
//
// A traced house keeps its geometry on a BONEYARD master and every floor
// carries a copy pointing back at it. That link is what "move the foundation,
// floors and roof" travels down -- and it is what a CANTILEVER has to take
// one corner off, or the next master edit pulls the overhang back flush and
// nothing on the plan says it happened.

test('MOVE EVERYTHING goes through the master, so every floor follows',
  async ({ page }) => {
    await open(page, { master: true });
    await pullCorner(page, 14, -10);
    await moveAll(page).click();
    await page.waitForTimeout(250);

    const saved = await saveAndRead(page);
    const master = saved.boneyardOutlines.find(m => m.id === MASTER_ID);
    const ne = master.points.find(p => p.id === srcOf(1));
    expect(ne.x, 'the master itself moved').toBeCloseTo(14, 2);
    // AND THE WALL IS STILL WHERE THE HAND LEFT IT. The drag re-measured its
    // offset against a master that then moved the same distance, so a
    // propagation run before that offset is put back lands the wall at 18 --
    // twice as far out as anybody asked, from a gesture that looks right on
    // the master and on every copy.
    expect(corner(saved).wall.x, 'the wall did not travel twice').toBeCloseTo(14, 2);
    saved.outlines.forEach(outline => {
      const corner = outline.points.find(p => p.srcId === srcOf(1));
      expect(corner.x, `${outline.id} followed its master`).toBeCloseTo(14, 2);
    });
    expect(saved.outlines.find(o => o.id === 'upper').overriddenSrcIds,
      'and nothing was taken off the master — the whole building moved')
      .toEqual([]);
  });

test('CANTILEVER takes that one corner OFF the master and leaves the rest on',
  async ({ page }) => {
    await open(page, { master: true });
    await pullCorner(page, 11.5, -10);
    await cantilever(page).click();
    await page.waitForTimeout(250);

    const saved = await saveAndRead(page);
    const house = saved.outlines.find(o => o.id === 'house');
    const upper = saved.outlines.find(o => o.id === 'upper');
    const master = saved.boneyardOutlines.find(m => m.id === MASTER_ID);
    expect(house.points.find(p => p.srcId === srcOf(1)).x,
      'this floor projects').toBeCloseTo(11.5, 2);
    expect(master.points.find(p => p.id === srcOf(1)).x,
      'the master did NOT move — that is what makes it an overhang').toBeCloseTo(10, 6);
    expect(upper.points.find(p => p.srcId === srcOf(1)).x,
      'and the floor above is where it was').toBeCloseTo(10, 6);
    expect(house.overriddenSrcIds,
      'the corner is frozen off the master, so a later master edit cannot '
      + 'pull the overhang back flush').toContain(srcOf(1));
    expect(house.overriddenSrcIds, 'and only that corner').toHaveLength(1);
  });

test('undoing a cantilever takes the freeze off with it', async ({ page }) => {
  // A corner left overridden after its overhang has been undone is a point
  // that silently stops following the bone: invisible on the plan, and found
  // later when a master edit moves every corner but that one.
  await open(page, { master: true });
  await pullCorner(page, 11.5, -10);
  await cantilever(page).click();
  await page.waitForTimeout(200);
  await page.keyboard.press('Control+z');
  await page.waitForTimeout(200);

  const saved = await saveAndRead(page);
  const house = saved.outlines.find(o => o.id === 'house');
  expect(house.points.find(p => p.srcId === srcOf(1)).x,
    'the footprint is back').toBeCloseTo(10, 6);
  expect(house.overriddenSrcIds, 'and so is its link to the master').toEqual([]);
});

// ── AND INWARD, WHAT THE WALL UNCOVERED ───────────────────────────────────
//
// Movie, 15 Oct, straight after the outward three: "for interior stretch we
// could do the same thing, but it wouldn't create an exterior overhang, it
// would offer move the full foundation roof etc, or move ext wall inward for
// roof deck / floor req membrane".
//
// So the card is DIRECTIONAL, and the two halves share nothing but the
// gesture: pulled out a wall is a cantilever, an overhang or a wider
// building; pushed in it is a smaller building or a storey stepped back, and
// what it steps off is a floor that is suddenly in the weather.

// PUSH THE WHOLE NORTH WALL IN, which is the gesture the inward half is
// about: "move ext wall inward". A single CORNER cannot step a wall in -- a
// rectangle's corner slid either way runs along one of its own two walls and
// never leaves the footprint at all (pinned above) -- so what moves here is
// the wall BODY, and both of its ends travel together.
//
// SELECTION FIRST, then the press: wallBodyAt only offers a wall that is
// already selected, which is the same rule the corner grab has.
async function pushWallIn(page, toZ) {
  const { at } = await h.planFrame(page);
  await page.mouse.click(...at(0, -10));
  await page.waitForTimeout(80);
  await page.mouse.move(...at(0, -10));
  await page.mouse.down();
  await page.mouse.move(...at(0, toZ), { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(150);
}

test('pushed IN, the card offers neither overhang', async ({ page }) => {
  await open(page);
  await pushWallIn(page, -7);
  await expect(card(page), 'a wall pushed in is still a question').toBeVisible();
  await expect(card(page).locator('[data-footprint-side]'),
    'and the card says which way it went').toHaveText('inside');
  await expect(cantilever(page), 'nothing projects when a wall comes in').toBeHidden();
  await expect(piles(page), 'and there is nothing out in the air to hold up').toBeHidden();
  await expect(moveAll(page), 'a smaller building is always an answer').toBeVisible();
});

test('the lowest storey has nothing to step off, so no deck is offered',
  async ({ page }) => {
    // THE GATE, and the reason for it: the MAIN FL pushed in is just a
    // smaller building. Nothing is uncovered, there is no deck, and naming
    // one would put a membrane on the drawing for a floor that does not
    // exist. The default fixture's dragged level is the lowest with an
    // outline.
    await open(page);
    await pushWallIn(page, -7);
    await expect(card(page), 'the wall still left its footprint').toBeVisible();
    await expect(deck(page), 'no storey below to step off').toBeHidden();
  });

test('STEP IN FOR A ROOF DECK moves this floor and names what it left',
  async ({ page }) => {
    await open(page, { master: true, drag: SECOND_FL });
    await pushWallIn(page, -7);
    await expect(deck(page), 'there is a MAIN FL under this one').toBeVisible();
    await deck(page).click();
    await page.waitForTimeout(250);

    const saved = await saveAndRead(page);
    const upper = saved.outlines.find(o => o.id === 'upper');
    const house = saved.outlines.find(o => o.id === 'house');
    expect(upper.points.find(p => p.srcId === srcOf(1)).z,
      'the storey stepped back').toBeCloseTo(-7, 2);
    expect(house.points.find(p => p.srcId === srcOf(1)).z,
      'and the floor below stayed out, which is what makes it a deck')
      .toBeCloseTo(-10, 6);

    // THE MEMBRANE IS THE DELIVERABLE. The geometry makes the deck; this is
    // what makes somebody build it watertight.
    const note = (saved.notes || []).find(n => /ROOF DECK/i.test(n.body || ''));
    expect(note, 'the deck is named on the plan').toBeTruthy();
    expect(note.body, 'and the membrane with it').toMatch(/MEMBRANE/i);
    expect(note.levelId, "on the stepped storey's own sheet, which is where it "
      + 'is read from').toBe(SECOND_FL);
    // Between where the corner was and where it is now: the ground the wall
    // came off, which is the deck.
    expect(note.anchor.z, 'anchored on the ground it uncovered')
      .toBeGreaterThan(-10.01);
    expect(note.anchor.z).toBeLessThan(-7);
  });

test('one Ctrl+Z takes the step-in and its membrane note back together',
  async ({ page }) => {
    await open(page, { master: true, drag: SECOND_FL });
    await pushWallIn(page, -7);
    await deck(page).click();
    await page.waitForTimeout(200);
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(200);

    const saved = await saveAndRead(page);
    expect(saved.outlines.find(o => o.id === 'upper').points
      .find(p => p.srcId === srcOf(1)).z, 'the storey is back out').toBeCloseTo(-10, 6);
    expect((saved.notes || []).filter(n => /ROOF DECK/i.test(n.body || '')),
      'and the deck it named is gone with it').toHaveLength(0);
  });

test('a LINE dragged off the footprint is not asked about: it is not the building',
  async ({ page }) => {
    // The body grab answers for a selected LINE as well as a wall now, so a
    // 'wall' drag whose body is a line reaches the card's own test -- and
    // this line runs corner to corner where the north wall was, so both its
    // ends sit exactly on footprint corners. It is draughting all the same:
    // it raises no storey and carries no floor, and a cantilever under one
    // would be a cantilever under nothing.
    //
    // THE NORTH WALL IS TAKEN OUT OF THE FIXTURE so the press can only land
    // on the line. With both there the grab could take either, and a test
    // that passes whichever it took is a test of nothing.
    await open(page, { noNorthWall: true });
    const { at } = await h.planFrame(page);
    await page.mouse.click(...at(0, -10));
    await page.waitForTimeout(100);
    await page.mouse.move(...at(0, -10));
    await page.mouse.down();
    await page.mouse.move(...at(0, -7), { steps: 8 });
    await page.mouse.up();
    await page.waitForTimeout(200);

    await expect(card(page), 'a line is not asked what it meant').toBeHidden();
    const saved = await saveAndRead(page);
    expect(saved.lines[0].start.z, 'and it moved, with no question asked')
      .toBeCloseTo(-7, 1);
    expect(saved.lines[0].end.z, 'whole, both ends').toBeCloseTo(-7, 1);
    expect(saved.outlines.find(o => o.id === 'house').points[1].z,
      'the footprint was left exactly where it was').toBeCloseTo(-10, 6);
  });
