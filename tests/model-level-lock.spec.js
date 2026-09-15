// LEVEL LOCK — one assembly standing in the same place on more than one floor.
//
// Work order: GILLIGAN-LEVEL-LOCK-PORT-WORKORDER.md, acceptance 1-7. Written
// against level-lock.js's own contract rather than against a description of
// it, which is what the order asks for: two members minimum, plan only (x and
// z, never y), the mover never moved twice, a shared corner moved once.
//
// THE GESTURE ARRIVED WITH THE PORT, and had to. MODEL.html wrote `fixed` and
// `stretchBehavior:'rigid'` when an assembly was created and read NEITHER, so
// a drafter who ticked "stays rigid" got a group whose walls still moved one
// at a time. MODEL.dc.html gates the lock on `sd.rigid && sd.group` (:7059),
// a drag armed only when a node of a rigid assembly is grabbed (:11142) —
// without that drag here, applyLevelLockDelta would be a function with no
// caller and every check below would be calling it directly, which proves the
// code runs rather than that locking happens.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const V = (x, z) => ({ x, y: 0, z });

// TWO ASSEMBLIES, ONE ON EACH FLOOR, and the MAIN one shares a corner between
// its two walls — a single vertex object, which is uniquePoints' whole reason
// for existing and acceptance 3's subject.
const shared = V(-4, -4);
const sharedBelow = V(-4, -4);   // FOUNDATION's own corner object
const base = extra => ({
  version: 1,
  // DRAFTING, said out loud. The assembly verbs are a DRAFTING-board tier --
  // "the assembly verbs ... none of them operate in TOY" -- and syncAssembly
  // disables them on the board before it looks at the selection at all. A
  // fixture with no board left LEVEL LOCK greyed out and the failure read as
  // "the lock verb is broken" rather than "this is the wrong board".
  board: 'drafting',
  levels: [{ id: 3, name: 'MAIN FL', elev: 0 }, { id: 1, name: 'FOUNDATION', elev: -10 }],
  activeLevelIdx: 0,
  walls: [
    // MAIN: an L, sharing `shared` between a1 and a2.
    { id: 'a1', start: shared, end: V(4, -4), levelId: 3 },
    { id: 'a2', start: shared, end: V(-4, 4), levelId: 3 },
    // FOUNDATION: the same L, its own points -- AND ITS OWN SHARED CORNER.
    // b1 and b2 hold ONE object between them, exactly as a1/a2 do. Without
    // that the sibling half of the move never exercises uniquePoints, and the
    // gate said so: a mutant replacing it with a plain walk survived the
    // shared-corner check, because the only shared corner in the fixture was
    // on the assembly being dragged rather than on the one being carried.
    { id: 'b1', start: sharedBelow, end: V(4, -4), levelId: 1 },
    { id: 'b2', start: sharedBelow, end: V(-4, 4), levelId: 1 },
  ].map(w => ({ ...w, view: 'plan', wallType: 'stud_2x6',
    baseHeight: 0, topHeight: 8, refLine: 'left' })),
  groups: [
    { id: 'group-1', name: 'WC MAIN', fixed: true, stretchBehavior: 'rigid',
      members: [{ type: 'wall', id: 'a1' }, { type: 'wall', id: 'a2' }] },
    { id: 'group-2', name: 'WC FOUND', fixed: true, stretchBehavior: 'rigid',
      members: [{ type: 'wall', id: 'b1' }, { type: 'wall', id: 'b2' }] },
  ],
  levelLocks: [], nextLevelLockId: 1,
  lines: [], floors: [], roofs: [], fenestrations: [], dimensions: [],
  outlines: [], shapes: [], surfaceOpenings: [], stairs: [], notes: [],
  roomTags: [], columns: [], beams: [], boneyardOutlines: [], boneyardShelves: [],
  underlays: [],
  ...extra,
});

const LOCKED = { id: 'lock-1', name: 'WC STACK', members: ['group-1', 'group-2'] };

// `left` opens the tool rail, where the assembly box and the two lock verbs
// live. The drag checks DO NOT take it: the rail covers the left of the sheet
// and an occluded press reports as a drag that never armed, which points at
// the gesture instead of at the panel sitting over it. Only the check that
// presses a button needs the panel, and its grab point is at the centre of the
// sheet, well clear of the rail.
async function open(page, file, { left = false } = {}) {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, f }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json',
        { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, f: file });
  await page.goto(left ? '/MODEL.html?left=1' : '/MODEL.html');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  if (left) await expect(page.locator('[data-assembly-start]')).toBeVisible();
}

const saved = async page => {
  await page.locator('#save').click();
  await page.waitForTimeout(400);
  return page.evaluate(async bucket => {
    const f = await window.SharedFileStore.loadSharedFile(bucket);
    return JSON.parse(await f.text());
  }, BUCKET);
};

const wallOf = (file, id) => file.walls.find(w => w.id === id);
const r = n => { const v = Number(Number(n).toFixed(6)); return v === 0 ? 0 : v; };

// WHERE A WORLD POINT LANDS — asked of the page, not assumed.
//
// This was a local helper mapping world to screen from the canvas box's centre
// plus the readout's scale, on the grounds that the fixture is symmetric about
// the origin so fit() centres there. That was TRUE WHEN IT WAS WRITTEN and
// stopped being true the moment this branch rebased onto main: fit() now insets
// the view for the two dark bars, so the camera sits a couple of pixels off the
// canvas centre and every press this helper aimed missed by that much.
//
// helpers.planFrame reads the camera the page publishes on #plan as data-view.
// It arrived on main with the fit-inset work; the local version is gone rather
// than corrected, because the correction would have been a second copy of
// arithmetic that had just finished proving it drifts.
// Drag a wall of the MAIN assembly by a plan delta, in world feet.
async function dragAssembly(page, from, by) {
  const { at } = await h.planFrame(page);
  // SELECT FIRST: this page's rule is that only a selected wall's body is
  // grabbable, and the rigid drag arms off the body hit.
  await page.mouse.click(...at(...from));
  await page.waitForTimeout(120);
  const [sx, sy] = at(...from);
  const [ex, ey] = at(from[0] + by[0], from[1] + by[1]);
  await page.mouse.move(sx, sy);
  await page.mouse.down();
  await page.mouse.move(sx + (ex - sx) / 2, sy + (ey - sy) / 2, { steps: 6 });
  await page.mouse.move(ex, ey, { steps: 6 });
  await page.mouse.up();
  await page.waitForTimeout(200);
}

test('1 — a drag on one member moves its locked siblings the same delta, plan only',
  async ({ page }) => {
    await open(page, base({ levelLocks: [LOCKED] }));
    await dragAssembly(page, [0, -4], [3, 2]);          // grab a1's body
    const file = await saved(page);

    // THE SIBLING MOVED BY THE MOVER'S DELTA, asserted as stored coordinates.
    const b1 = wallOf(file, 'b1');
    expect([r(b1.start.x), r(b1.start.z)],
      "the sibling's start took the same plan delta").toEqual([-1, -2]);
    expect([r(b1.end.x), r(b1.end.z)],
      "and its end took it too").toEqual([7, -2]);

    // PLAN ONLY. y is the storey and a lock never touches it, and the level a
    // wall sits on is a per-floor property — a lock says "the same place on
    // the plan", not "the same storey".
    expect(r(b1.start.y ?? 0), 'y untouched').toBe(0);
    expect(Number(b1.levelId), 'the sibling stayed on its own floor').toBe(1);
  });

test('2 — the mover moves ONCE, not at double speed', async ({ page }) => {
    // A CHECK THAT ONLY WATCHES THE SIBLINGS PASSES ON A PAGE THAT MOVES THE
    // MOVER TWICE: the caller applies its own move and applyLevelLockDelta
    // applies the others, so the mover's own delta has to be asserted or the
    // double-apply is invisible.
    await open(page, base({ levelLocks: [LOCKED] }));
    await dragAssembly(page, [0, -4], [3, 2]);
    const file = await saved(page);

    const a1 = wallOf(file, 'a1');
    expect([r(a1.start.x), r(a1.start.z)],
      'the mover travelled the drag, not twice it').toEqual([-1, -2]);
    expect([r(a1.end.x), r(a1.end.z)]).toEqual([7, -2]);
  });

test('3 — a corner shared by two walls of one assembly moves ONCE',
  async ({ page }) => {
    // uniquePoints' reason for existing. a1 and a2 share ONE vertex object at
    // (-4,-4); walking items and moving their points would move it twice and
    // tear the assembly apart at its own corner — a2 would end up 3ft further
    // than a1 from a corner they are supposed to share.
    await open(page, base({ levelLocks: [LOCKED] }));
    await dragAssembly(page, [0, -4], [3, 2]);
    const file = await saved(page);

    const a1 = wallOf(file, 'a1'), a2 = wallOf(file, 'a2');
    expect([r(a1.start.x), r(a1.start.z)],
      'the shared corner moved by the delta').toEqual([-1, -2]);
    expect([r(a2.start.x), r(a2.start.z)],
      'and the other wall still meets it there').toEqual([-1, -2]);
    // The far ends prove the assembly kept its shape rather than collapsing.
    expect([r(a2.end.x), r(a2.end.z)], 'the L is still an L').toEqual([-1, 6]);

    // AND THE CARRIED ASSEMBLY'S OWN SHARED CORNER MOVED ONCE TOO. This is the
    // half that matters: applyLevelLockDelta walks the SIBLING's items, so the
    // sibling is where a plain walk would double the corner. Asserting only
    // the mover left that path uncovered.
    const b1 = wallOf(file, 'b1'), b2 = wallOf(file, 'b2');
    expect([r(b1.start.x), r(b1.start.z)],
      "the sibling's shared corner moved by the delta").toEqual([-1, -2]);
    expect([r(b2.start.x), r(b2.start.z)],
      'and its other wall still meets it there').toEqual([-1, -2]);
  });

test('4 — a lock of one is refused by the MODULE, at the page verb',
  async ({ page }) => {
    // THE VERB IS PRESSED, not merely inspected. Asserting that the button is
    // disabled proves the sync pass can count to two; it says nothing about
    // whether the page asked makeLock. The gate proved the difference — with
    // the count in the page, a mutant swapping makeLock for the page's own
    // maker SURVIVED, because the button never fired.
    await open(page, base(), { left: true });
    const { at } = await h.planFrame(page);
    await page.mouse.click(...at(0, -4));            // one assembly held
    await page.waitForTimeout(150);

    const btn = page.locator('[data-level-lock]');
    await expect(btn, 'the verb is offered with one assembly held').toBeEnabled();
    await btn.click();
    await page.waitForTimeout(150);

    const file = await saved(page);
    expect(file.levelLocks || [], 'no lock was made from one assembly').toEqual([]);
    expect(file.nextLevelLockId, 'and the id counter did not advance').toBe(1);
    // AND THE DRAFTER IS TOLD WHY, rather than left with a press that did
    // nothing visible.
    await expect(page.locator('#strip-message')).toContainText('two assemblies');
  });

test('5 — a drag never breaks a lock, however far the assemblies end up',
  async ({ page }) => {
    // BREAKING IS AN EXPLICIT ACT — the same principle as storey detachment in
    // the BONE model. Distance is not consent.
    await open(page, base({ levelLocks: [LOCKED] }));
    await dragAssembly(page, [0, -4], [30, 20]);       // a long way
    const file = await saved(page);

    expect((file.levelLocks || []).length, 'the lock survived the drag').toBe(1);
    expect(file.levelLocks[0].members, 'with both members').toEqual(
      ['group-1', 'group-2']);
    // AND IT STILL CARRIED: the sibling went the whole distance with it.
    //
    // toBeCloseTo HERE AND NOWHERE ELSE, and the tolerance is derived rather
    // than picked. It landed at 25.999999 — about 5e-7 ft out, which is FLOAT
    // DRIFT through the world/screen conversions over a thirty-foot carry, not
    // pixel rounding: one pixel at this fit is ~0.037 ft, four orders of
    // magnitude coarser, so if the mouse grid were the cause the error would
    // be far bigger. The short drags in checks 1-3 come out exact.
    //
    // FIVE DECIMALS (5e-6 ft) sits just above that drift and is still TIGHTER
    // than MODEL.html's own on-grid tolerance, which calls anything inside
    // 1e-6 ft on the foot mark. A lock that failed to carry is out by thirty
    // FEET, so nothing this check exists to catch can hide under 5e-6 — which
    // is the test a loosened assertion has to pass before it is allowed.
    const b1 = wallOf(file, 'b1');
    expect(b1.start.x, 'the far floor came the whole way in x').toBeCloseTo(26, 5);
    expect(b1.start.z, 'and in z').toBeCloseTo(16, 5);
  });

test('5b — BREAK removes the lock outright rather than marking it broken',
  async ({ page }) => {
    await open(page, base({ levelLocks: [LOCKED] }), { left: true });
    const { at } = await h.planFrame(page);
    await page.mouse.click(...at(0, -4));
    await page.waitForTimeout(150);
    await expect(page.locator('[data-level-lock-break]')).toBeVisible();
    await page.locator('[data-level-lock-break]').click();
    await page.waitForTimeout(150);

    const file = await saved(page);
    // REMOVED, not flagged: a broken lock and no lock behave identically, and
    // one of them is a state to carry, migrate and get wrong later.
    expect(file.levelLocks || [], 'the lock is gone, not marked').toEqual([]);

    // AND THE ASSEMBLIES MOVE ALONE NOW.
    await dragAssembly(page, [0, -4], [3, 2]);
    const after = await saved(page);
    expect([r(wallOf(after, 'b1').start.x), r(wallOf(after, 'b1').start.z)],
      'the former sibling stayed put').toEqual([-4, -4]);
  });

test('5c — one Ctrl+Z puts BOTH floors back, not just the one that was grabbed',
  async ({ page }) => {
    // THE DRAFTER MADE ONE GESTURE, so one undo takes all of it. The snapshot
    // is taken when the drag arms and has to cover the siblings as well: with
    // only the grabbed assembly in it, Ctrl+Z restores that one and leaves
    // every floor the lock carried sitting where the drag left it — one press,
    // two buildings, no longer in the same place while the file still says
    // they are locked together.
    await open(page, base({ levelLocks: [LOCKED] }));
    await dragAssembly(page, [0, -4], [3, 2]);
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(200);
    const file = await saved(page);

    const a1 = wallOf(file, 'a1'), b1 = wallOf(file, 'b1');
    expect([r(a1.start.x), r(a1.start.z)],
      'the assembly that was grabbed went back').toEqual([-4, -4]);
    expect([r(b1.start.x), r(b1.start.z)],
      'and so did the floor the lock carried').toEqual([-4, -4]);
  });

test('6 — the round-trip holds: a seeded lock and nextLevelLockId survive',
  async ({ page }) => {
    // THE ONE THING THE ORDER SAYS MUST NOT BREAK. MODEL.html carried these
    // keys through a save without understanding them; understanding them must
    // not cost the round-trip.
    await open(page, base({ levelLocks: [LOCKED], nextLevelLockId: 7 }));
    const file = await saved(page);
    expect(file.levelLocks, 'the lock came back whole').toEqual([LOCKED]);
    expect(file.nextLevelLockId, 'and the id counter with it').toBe(7);
  });

test('6b — a lock whose members are gone comes back SUPERSEDED, not an error',
  async ({ page }) => {
    // drawing-format.js already classifies this: unknown members are dropped,
    // and a lock left under two members is `superseded` into the drops sink.
    // The new part is that MODEL.html now loads carrying that classification
    // rather than stepping over the key.
    await open(page, base({ levelLocks: [LOCKED] }));
    const verdict = await page.evaluate(() => {
      const drops = [];
      const kept = window.DraftDrawingFormat.levelLocks(
        [{ id: 'lock-1', name: 'WC STACK', members: ['group-1', 'ghost'] }],
        new Set(['group-1']), drops);
      return { kept, drops };
    });
    expect(verdict.kept, 'a lock left with one member is not kept').toEqual([]);
    expect(JSON.stringify(verdict.drops), 'and it is recorded as superseded')
      .toContain('superseded');
  });

test('7 — no rule is written twice: the page reaches the module for each rule',
  async ({ page }) => {
    // THE PAGE MUST NOT GROW ITS OWN COPY of siblingIds the day the module
    // changes. Proved by WRAPPING the module and recording which rules a real
    // gesture reaches — a page carrying its own arithmetic would record
    // nothing and still move the walls.
    //
    // My first version of this installed the spy and then never read it: it
    // asserted the six exports exist and that translate was still a function,
    // which is true of any page that never calls the module at all. Recorded
    // here because it is the third check this week that looked like a pass and
    // proved nothing.
    await open(page, base({ levelLocks: [LOCKED] }));

    const exports = await page.evaluate(() => {
      const real = window.DraftLevelLock;
      const seen = [];
      const spy = {};
      for (const k of Object.keys(real)) {
        spy[k] = (...args) => { seen.push(k); return real[k](...args); };
      }
      window.__lockSeen = seen;
      // The real one is frozen, so it is replaced wholesale rather than patched.
      Object.defineProperty(window, 'DraftLevelLock',
        { value: spy, configurable: true, writable: true });
      return Object.keys(real).sort();
    });
    expect(exports, 'the module still holds exactly its six rules').toEqual(
      ['breakLock', 'lockFor', 'makeLock', 'siblingIds', 'translate', 'uniquePoints']);

    await dragAssembly(page, [0, -4], [2, 1]);

    const seen = await page.evaluate(() => [...new Set(window.__lockSeen || [])]);
    // ONE DRAG OF A LOCKED RIGID ASSEMBLY has to go through all four of the
    // rules a move needs. makeLock and breakLock belong to the two verbs and
    // are exercised by checks 4 and 5b.
    for (const rule of ['uniquePoints', 'lockFor', 'siblingIds', 'translate']) {
      expect(seen, `the drag reached the module for ${rule}`).toContain(rule);
    }

    // AND THE MOVE STILL LANDED, so this is a check about a working gesture
    // rather than about a page that called four functions and did nothing.
    const file = await saved(page);
    expect([r(wallOf(file, 'b1').start.x), r(wallOf(file, 'b1').start.z)],
      'the sibling moved while the module was being watched').toEqual([-2, -3]);
  });
