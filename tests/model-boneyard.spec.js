// THE BONEYARD on MODEL.html — shelf storage that never prints.
//
// Work order: BONEYARD-WORKORDER.md, ruled 14 Sep:
//   "yes boneyard should be working so i can copy and paste stuff in there
//    that won't show on the plan (to save for later / reference)"
//   "check the dc version i liked that one" — "had addable shelves"
//
// THIS IS A PORT, NOT A DESIGN. MODEL.dc.html has the working boneyard;
// this page printed the shelf names as dead text and nothing pressed.
//
// THE CLAIM THE ORDER SAYS TO MEASURE FIRST -- "a shelf is already a level
// with a negative id, so parking a wall on a shelf needs no format change at
// all" -- was measured on 14 Sep and was HALF FALSE. drawing-format.js is
// sign-agnostic, but the OWNER SET is the caller's, and this page built it
// from levels alone, so a wall at levelId -1 was dropped on load. Fixed in
// c8654eb and merged; model-boneyard-shelf.spec.js is the check that holds
// it. Without that fix every check in this file would pass on screen and
// lose the drafter's parked geometry on the first reload.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const V = (x, z) => ({ x, y: 0, z });
const MAIN = 3;

const wall = (id, levelId, start, end) => ({
  id, levelId, start, end, view: 'plan',
  wallType: 'stud_2x6', baseHeight: 0, topHeight: 8, refLine: 'left',
});

const base = extra => ({
  version: 1,
  levels: [
    { id: 1, name: 'FOUNDATION', elev: -10 },
    { id: MAIN, name: 'MAIN FL', elev: 0 },
  ],
  activeLevelIdx: 1,
  walls: [
    wall('m-n', MAIN, V(-10, -10), V(10, -10)),
    wall('m-e', MAIN, V(10, -10), V(10, 10)),
    wall('m-s', MAIN, V(10, 10), V(-10, 10)),
    wall('m-w', MAIN, V(-10, 10), V(-10, -10)),
  ],
  lines: [], floors: [], roofs: [], fenestrations: [], dimensions: [],
  outlines: [], shapes: [], surfaceOpenings: [], stairs: [], notes: [],
  roomTags: [], columns: [], beams: [], boneyardOutlines: [],
  boneyardShelves: [{ id: 1, name: 'SHELF 1' }],
  groups: [], levelLocks: [], underlays: [],
  nextDrawingItemId: 50,
  ...extra,
});

async function open(page, file) {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, f }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json',
        { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, f: file });
  await page.goto('/MODEL.html?right=1');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
}

const card = page => page.locator('[data-boneyard]');
const addShelf = page => page.locator('[data-add-shelf]');
const shelfRow = (page, id) => page.locator(`[data-shelf="${id}"]`);

// WHAT IS ON THE PAGE, read off the readout the page publishes rather than a
// test hook -- the same instrument every other spec here trusts. "walls 4/20"
// is shown/total, and SHOWN is the number that answers "is the level's
// geometry gone".
const shown = async page => {
  const text = await page.locator('#readout').textContent();
  const hit = /walls (\d+)\/(\d+)/.exec(text);
  expect(hit, 'the readout publishes the wall count').toBeTruthy();
  return { shown: Number(hit[1]), total: Number(hit[2]) };
};

const saved = page => page.evaluate(async bucket => {
  const f = await window.SharedFileStore.loadSharedFile(bucket);
  return JSON.parse(await f.text());
}, BUCKET);

const saveIt = async page => {
  await page.locator('[data-model-save]').click();
  await expect(page.locator('[data-model-save]')).toHaveText(/saved/i, { timeout: 6000 });
  return saved(page);
};

test('ACCEPTANCE 1: the BONEYARD card selects, and the level geometry goes',
  async ({ page }) => {
    // A WALL PARKED ON SHELF 1 so the two halves are distinguishable. Without
    // it "the shelf's contents are what draws" is satisfied by drawing
    // NOTHING, which is also what a card that merely hides everything does.
    await open(page, base({
      walls: [...base({}).walls, wall('parked', -1, V(-4, -4), V(4, -4))],
    }));

    const before = await shown(page);
    expect(before.shown, 'the level shows its four walls to begin with').toBe(4);
    expect(before.total, 'and the parked wall is LOADED, not dropped -- c8654eb')
      .toBe(5);

    await card(page).click();
    await expect(card(page)).toHaveAttribute('data-active', '');

    const after = await shown(page);
    expect(after.shown,
      'on the boneyard only the shelf draws: one parked wall, and none of the '
      + "level's four").toBe(1);
  });

test('ACCEPTANCE 2: + SHELF adds a shelf, selects it, and its contents are its own',
  async ({ page }) => {
    // GEOMETRY AT THE SAME COORDINATES ON BOTH SHELVES, which is the tooltip's
    // own stated reason for shelves existing: "park geometry at the same spot
    // on different shelves without overlap". Two walls at identical points
    // make "the shelves are independent" a claim a merge would break.
    await open(page, base({
      boneyardShelves: [{ id: 1, name: 'SHELF 1' }, { id: 2, name: 'SHELF 2' }],
      walls: [...base({}).walls,
        wall('on-1', -1, V(-4, -4), V(4, -4)),
        wall('on-2', -2, V(-4, -4), V(4, -4))],
    }));

    await card(page).click();
    expect((await shown(page)).shown, 'SHELF 1 shows its one wall').toBe(1);

    await shelfRow(page, 2).click();
    expect((await shown(page)).shown,
      'SHELF 2 shows its own one wall, not both and not none').toBe(1);

    // AND THE PAGE SAYS WHICH SHELF IT IS SHOWING, on the row itself rather
    // than through a test hook -- the panel is the drafter's own readout and
    // a `window.__` global would let the two disagree without anything red.
    await expect(shelfRow(page, 2)).toHaveAttribute('data-active', '');
    await expect(shelfRow(page, 1)).not.toHaveAttribute('data-active', '');
  });

test('+ SHELF creates the next shelf and makes it active', async ({ page }) => {
  await open(page, base({}));
  await card(page).click();
  await addShelf(page).click();

  await expect(shelfRow(page, 2), 'a second shelf row arrived').toHaveCount(1);
  await expect(shelfRow(page, 2)).toHaveAttribute('data-active', '');
  expect((await shown(page)).shown, 'a fresh shelf is empty').toBe(0);
});

test('ACCEPTANCE 6: shelves and the active shelf survive save and reload',
  async ({ page }) => {
    await open(page, base({}));
    await card(page).click();
    await addShelf(page).click();
    await addShelf(page).click();          // SHELF 2 and SHELF 3, 3 active

    const file = await saveIt(page);
    expect((file.boneyardShelves || []).map(s => s.id),
      'both new shelves reached the file').toEqual([1, 2, 3]);
    expect(file.activeBoneyardShelfId, 'and which one was active').toBe(3);
    expect(file.nextBoneyardShelfId, 'and the allocator, so ids are not reused')
      .toBe(4);

    await page.reload();
    await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
    await expect(shelfRow(page, 3), 'the third shelf came back').toHaveCount(1);
  });

test('a drawing saved before shelves existed loads with the single default',
  async ({ page }) => {
    const old = base({});
    delete old.boneyardShelves;
    await open(page, old);
    await card(page).click();
    await expect(shelfRow(page, 1), 'the default SHELF 1, and no error')
      .toHaveCount(1);
  });

test('ACCEPTANCE 7: the boneyard row stays pinned last in the panel',
  async ({ page }) => {
    // ADD A BASEMENT BENEATH THE FOUNDATION and it must land ABOVE the
    // boneyard. Asserted by vertical position rather than by DOM order: the
    // panel is what a drafter reads, and a row that sorts last in the markup
    // but paints halfway up is still wrong.
    await open(page, base({
      levels: [
        { id: 0, name: 'BASEMENT', elev: -20 },
        { id: 1, name: 'FOUNDATION', elev: -10 },
        { id: MAIN, name: 'MAIN FL', elev: 0 },
      ],
    }));

    const boneBox = await card(page).boundingBox();
    for (const id of [0, 1, MAIN]) {
      const box = await page.locator(`[data-level="${id}"]`).boundingBox();
      expect(box.y, `level ${id} sits above the boneyard`)
        .toBeLessThan(boneBox.y);
    }
  });

test('leaving the boneyard puts the level geometry back', async ({ page }) => {
  // THE WAY BACK, which a card that only ever switches ONE way would fail
  // while passing acceptance 1.
  await open(page, base({
    walls: [...base({}).walls, wall('parked', -1, V(-4, -4), V(4, -4))],
  }));
  await card(page).click();
  expect((await shown(page)).shown).toBe(1);

  await page.locator(`[data-level="${MAIN}"]`).click();
  await expect(card(page)).not.toHaveAttribute('data-active', '');
  expect((await shown(page)).shown, 'MAIN FL has its four walls again').toBe(4);
});

// ── COPY / PASTE ACROSS WORKSPACES ─────────────────────────────────────────
// THE ONE GENUINELY NEW THING IN THE ORDER. DC's copy is one gesture inside
// one workspace -- capture, base, destination, done. Movie's ask outlives the
// gesture: "copy and paste stuff in there that won't show on the plan (to save
// for later / reference)". So what is held survives a change of level or
// shelf, and pasting clones onto whatever is active.

const copyBtn = page => page.locator('[data-copy]');
const pasteBtn = page => page.locator('[data-paste]');

const clickWorld = async (page, x, z) => {
  // ASKS THE PAGE WHERE THE POINT IS. See dragMaster below for what computing
  // it here costs.
  const { at } = await h.planFrame(page);
  await page.mouse.click(...at(x, z));
  await page.waitForTimeout(80);
};

test('ACCEPTANCE 3: copy a wall from a level, paste it on a shelf',
  async ({ page }) => {
    await open(page, base({}));

    await clickWorld(page, 0, -10);                 // the north wall
    await expect(copyBtn(page), 'COPY is live with something selected')
      .toBeVisible();
    await copyBtn(page).click();

    await card(page).click();                        // switch to the boneyard
    await pasteBtn(page).click();

    const file = await saveIt(page);
    const parked = file.walls.filter(w => Number(w.levelId) === -1);
    expect(parked.length, 'one wall landed on SHELF 1').toBe(1);
    expect(Number(parked[0].levelId), 'and it is owned by the shelf').toBe(-1);

    // THE ORIGINAL IS STILL ON THE PLAN. It is a COPY -- the order says so in
    // as many words -- and a paste that moved the wall would satisfy every
    // other line here.
    const original = file.walls.find(w => w.id === 'm-n');
    expect(original, 'the original is still on MAIN FL').toBeTruthy();
    expect(Number(original.levelId)).toBe(MAIN);

    // AND THE TWO HAVE DIFFERENT IDS. "#392 has already paid for one id bug
    // tonight, and a duplicate id is the same family."
    expect(parked[0].id).not.toBe('m-n');
  });

test('ACCEPTANCE 4: copy it back from the shelf to a level, with a new id again',
  async ({ page }) => {
    await open(page, base({
      walls: [...base({}).walls, wall('parked', -1, V(-4, -4), V(4, -4))],
    }));

    await card(page).click();
    await clickWorld(page, 0, -4);                   // the parked wall
    await copyBtn(page).click();

    await page.locator(`[data-level="${MAIN}"]`).click();
    await pasteBtn(page).click();

    const file = await saveIt(page);
    const onMain = file.walls.filter(w => Number(w.levelId) === MAIN);
    expect(onMain.length, 'MAIN FL gained the wall: four plus one').toBe(5);

    const landed = onMain.find(w => !['m-n', 'm-e', 'm-s', 'm-w'].includes(w.id));
    expect(landed, 'and it is a new record').toBeTruthy();
    expect(landed.id, 'with a new id, not the one it had on the shelf')
      .not.toBe('parked');

    // AND THE SHELF KEPT ITS OWN. Copying back is the same verb backwards, so
    // it must not empty the shelf.
    expect(file.walls.some(w => w.id === 'parked' && Number(w.levelId) === -1),
      'the shelf still holds what was parked there').toBe(true);
  });

test('a pasted wall does not join a group that lives on another workspace',
  async ({ page }) => {
    // THE ORDER'S OWN RULE: "do not let a pasted wall join a group that lives
    // on another level". A shelf copy tied to a group on MAIN FL would MOVE
    // when that group moved, and not moving is the entire reason to park it.
    //
    // I WROTE THIS CHECK AGAINST THE WRONG MODEL FIRST, and the check is what
    // said so. It asserted a `groupId` on the wall and went red reporting that
    // the ORIGINAL's groupId was undefined -- because membership is not on the
    // item at all. A group carries `members: [{type, id}]` (see
    // model-tool-assembly.spec.js:147) and the wall normaliser drops any
    // groupId, so a wall does not know what it belongs to; the group does.
    //
    // That makes the rule hold BY CONSTRUCTION rather than by a strip: the
    // paste allocates a fresh id, and no group's member list names it. Which
    // is worth an assertion precisely BECAUSE it is free -- the day someone
    // makes paste reuse an id, or copy the member rows along, this is what
    // notices. So the claim is checked where membership actually lives.
    await open(page, base({
      groups: [{
        id: 'g-1', name: 'NORTH', fixed: true,
        members: [{ type: 'wall', id: 'm-n' }, { type: 'wall', id: 'm-e' }],
      }],
    }));

    await clickWorld(page, 0, -10);
    await copyBtn(page).click();
    await card(page).click();
    await pasteBtn(page).click();

    const file = await saveIt(page);
    const parked = file.walls.find(w => Number(w.levelId) === -1);
    expect(parked, 'the copy landed').toBeTruthy();

    const group = (file.groups || []).find(g => g.id === 'g-1');
    expect(group, 'the group survived the round trip').toBeTruthy();
    expect(group.members.map(m => m.id).sort(),
      'the group still names its original two, and not the copy')
      .toEqual(['m-e', 'm-n']);
    expect(group.members.some(m => m.id === parked.id),
      'the parked copy is a member of nothing').toBe(false);
  });

test('COPY and PASTE stand down when they have nothing to do', async ({ page }) => {
  // A VERB THAT LOOKS LIVE AND DOES NOTHING is worse than a gap -- the same
  // rule the dormant strip chips follow, and the same one that made DELETE
  // hidden rather than inert.
  await open(page, base({}));
  await expect(copyBtn(page), 'nothing selected: COPY has nothing to take')
    .toBeHidden();
  await expect(pasteBtn(page), 'nothing held: PASTE has nothing to put down')
    .toBeHidden();

  await clickWorld(page, 0, -10);
  await expect(copyBtn(page)).toBeVisible();
  await expect(pasteBtn(page), 'selecting is not copying').toBeHidden();

  await copyBtn(page).click();
  await expect(pasteBtn(page), 'and now there is something to put down')
    .toBeVisible();
});

// ── ACCEPTANCE 5, TRANSLATED ───────────────────────────────────────────────
// The order asks: "Print with a populated shelf and the shelf's contents
// appear nowhere -- assert the printed output, not the boneyardActive flag."
//
// MEASURED, MODEL.html HAS NO PRINTING AT ALL: no window.print, no @media
// print, no print control. So the check as written cannot be built here, and
// faking one against `boneyardActive` is exactly what the order forbids.
//
// What it is FOR does exist on this page. The fear is a drafter's parked
// geometry turning up where the drawing is shown -- "he finds out from the
// plans examiner" -- and this page shows the drawing in two places besides
// the plan: the view rail's seat thumbnails, and any section view. A shelf
// leaking into a seat is the same failure with a different sheet.
//
// THIS CAUGHT A REAL ONE. activeLevelId() answered the boneyard BEFORE it
// answered thumbTarget, so with the boneyard open every seat in the rail
// painted the shelf instead of its own level.
test("ACCEPTANCE 5: a shelf's contents stay off every level's thumbnail",
  async ({ page }) => {
    await open(page, base({
      // THE SHELF IS POPULATED AND THE LEVEL IS NOT EMPTY, both load-bearing.
      // A check run against an empty shelf passes on a page that leaks, and
      // one against an empty level cannot tell a leak from a blank seat.
      walls: [...base({}).walls, wall('parked', -1, V(-4, -4), V(4, -4))],
      // AND A MASTER ON THE SHELF, which the gate insisted on. With only the
      // parked WALL here, removing the thumbTarget guard from showingBoneyard
      // changed nothing this check could see -- because walls are filtered
      // through activeLevelId(), which answers thumbTarget first and was never
      // the leaky path. Only outlines() reads showingBoneyard, and only a
      // MASTER travels that road.
      //
      // So the fixture was missing the one kind of geometry the fault moves.
      // Generated rather than assumed away, which is the same correction the
      // gapped-shelf case needed.
      boneyardOutlines: [{
        id: 'shelf-master', shelfId: 1,
        points: [{ id: 'q1', x: -6, z: -5 }, { id: 'q2', x: 6, z: -5 },
          { id: 'q3', x: 6, z: 5 }, { id: 'q4', x: -6, z: 5 }],
      }],
    }));

    await card(page).click();
    await expect(card(page)).toHaveAttribute('data-active', '');

    // AND THE PLAN ITSELF still shows only the shelf, so nothing below can
    // pass because the boneyard quietly failed to engage.
    expect((await shown(page)).shown,
      'the boneyard is genuinely open -- one parked wall, not the four')
      .toBe(1);

    // THE SEATS THEMSELVES, PIXEL FOR PIXEL. An earlier draft of this check
    // asserted that seats EXIST and that the plan had switched -- and would
    // not have caught the leak it was written for, which is the same
    // satisfied-by-absence shape this session keeps finding in other people's
    // checks and is no better in mine.
    //
    // What a level's seat shows cannot depend on whether the drafter happens
    // to be looking at a shelf. So the seats are captured with the boneyard
    // OPEN and again with it CLOSED, and the two must be identical. A
    // thumbnail painting the shelf differs from one painting its own level,
    // and that difference is the whole failure.
    // CAPTURED ONCE THE PAINT HAS SETTLED, and this check taught me that the
    // hard way by going green, then red, then green on an unchanged page.
    //
    // The seats repaint on a frame callback, so a capture taken straight after
    // a click can catch one canvas mid-paint -- and a mid-paint thumbnail
    // differs from a finished one, which reads exactly like the leak this is
    // hunting. A flaky check for a real fault is worse than none: it teaches
    // people to re-run it.
    //
    // So it reads twice and only trusts a reading that agrees with itself.
    const seatShots = async () => {
      let last = null;
      for (let i = 0; i < 12; i += 1) {
        /* eslint-disable no-await-in-loop */
        const shot = await page.evaluate(() => new Promise(done => {
          requestAnimationFrame(() => requestAnimationFrame(() => done(
            [...document.querySelectorAll('#view-rail .seat canvas')]
              .map(c => c.toDataURL()))));
        }));
        if (last && JSON.stringify(last) === JSON.stringify(shot)) return shot;
        last = shot;
        await page.waitForTimeout(120);
      }
      return last;
    };

    const open_ = await seatShots();
    expect(open_.length, 'the rail has seats to leak into').toBeGreaterThan(0);

    await page.locator(`[data-level="${MAIN}"]`).click();
    await expect(card(page)).not.toHaveAttribute('data-active', '');
    const closed = await seatShots();

    expect(closed.length, 'the same seats are there either way')
      .toBe(open_.length);
    expect(open_,
      "a level's thumbnail shows that level, whether or not a shelf is open")
      .toEqual(closed);

    // THE CONTROL, because "identical" is also what two BLANK sets of seats
    // look like, and a rail that painted nothing at all would sail through
    // the line above.
    const blank = await page.evaluate(() => {
      const c = document.createElement('canvas');
      const live = document.querySelector('#view-rail .seat canvas');
      c.width = live.width; c.height = live.height;
      return c.toDataURL();
    });
    expect(closed.some(shot => shot !== blank),
      'at least one seat actually painted something').toBe(true);
  });

test('a shelf added to a gapped list takes a FREE id, not the next row number',
  async ({ page }) => {
    // THE GATE FOUND THIS MISSING and the finding is the useful kind. The
    // mutant that replaces the allocator with `list.length + 1` SURVIVED every
    // other check here, because they all add shelves to a drawing whose ids
    // run 1,2,3 -- where the row count and the next free id agree, and the two
    // are indistinguishable.
    //
    // They part company over a GAP. MODEL.html cannot delete a shelf, so my
    // first thought was that no such drawing exists -- but MODEL.dc.html can,
    // and a file is a file. Shelves 1 and 3 with 2 deleted is an ordinary
    // artefact, and `length + 1` answers 3: the id of a shelf that is already
    // there, holding geometry. The drafter presses + SHELF and is handed
    // somebody else's parked wall.
    //
    // The lesson is the one this session keeps paying for: when a mutant
    // survives and no case comes to mind, GENERATE the case rather than
    // conclude there is not one.
    await open(page, base({
      boneyardShelves: [{ id: 1, name: 'SHELF 1' }, { id: 3, name: 'SHELF 3' }],
      nextBoneyardShelfId: 4,
      walls: [...base({}).walls, wall('on-3', -3, V(-4, -4), V(4, -4))],
    }));

    await card(page).click();
    await addShelf(page).click();

    // NOT 3, WHICH IS TAKEN.
    await expect(shelfRow(page, 3), 'SHELF 3 is still its own row')
      .toHaveCount(1);
    expect((await shown(page)).shown,
      'the new shelf is EMPTY -- it did not adopt what is parked on SHELF 3')
      .toBe(0);

    const file = await saveIt(page);
    const ids = (file.boneyardShelves || []).map(s => Number(s.id)).sort((a, b) => a - b);
    expect(ids, 'the gap is left alone and the new shelf takes a free id')
      .toEqual([1, 3, 4]);
  });

// ── §4: THE MASTER MUST BE A GOVERNOR, AND FIRST IT MUST BE LINKED ─────────
// The order says propagation is a PORT: MODEL.dc.html:12057 already moves the
// dimension strings, the columns, the auto-beams and the welded garage along
// with the corners, and "anyone writing it fresh gets the corners right and
// leaves the riders behind".
//
// MEASURED BEFORE PORTING, and the port cannot work without this first.
// _propagateMasterOutline finds its copies by `outline.masterId === master.id`
// and then each point by `point.srcId`. On this page addLevel stamps neither:
// the copy came out with masterId null and every srcId null, so the ported
// function would have propagated to NOTHING on every drawing this page has
// ever made -- and every check for it would have passed by finding no work.
//
// AND THE COPY SHARED THE MASTER'S POINTS ARRAY. `{ ...master }` is a shallow
// spread, so the level copy and the master held the SAME point objects: an
// override could never differ from the master because there was only ever one
// set of coordinates. That is the opposite failure to "a stamp, not a
// governor" -- total aliasing -- and the two hid each other.
test('§4: a level copy of a master is LINKED to it, and owns its own points',
  async ({ page }) => {
    await open(page, base({
      outlines: [],
      boneyardOutlines: [{
        id: 'master-1', shelfId: 1,
        points: [{ id: 'p1', x: 0, z: 0 }, { id: 'p2', x: 10, z: 0 },
          { id: 'p3', x: 10, z: 8 }],
      }],
      nextLevelId: 7,
    }));

    page.on('dialog', d => d.accept(d.message().includes('feet') ? '9' : 'SECOND FL'));
    await page.locator('[data-add-level]').click();
    await page.waitForTimeout(400);

    const file = await saveIt(page);
    const copy = (file.outlines || []).find(o => Number(o.levelId) === 7);
    expect(copy, 'the new floor starts with the inherited geometry').toBeTruthy();

    // THE LINK, both halves. Without masterId the propagation loop never sees
    // this outline; without srcId it sees it and moves nothing.
    expect(copy.masterId, 'the copy knows which master governs it')
      .toBe('master-1');
    expect(copy.points.map(p => p.srcId),
      'and every point knows which master point it came from')
      .toEqual(['p1', 'p2', 'p3']);

    // ITS OWN POINTS, not the master's. Moving the copy must not move the
    // master, which is what a shared array would do.
    const master = (file.boneyardOutlines || []).find(o => o.id === 'master-1');
    expect(master.points.map(p => p.srcId ?? null),
      'the master itself carries no srcId -- it IS the source')
      .toEqual([null, null, null]);
  });

// ── §4: THE MASTER MOVES AND EVERYTHING FOLLOWS ────────────────────────────
// A PORT of MODEL.dc.html:12057, and the order says why it must be one: "the
// propagation is not the outline, it is the dozen things that ride the
// outline. A fresh implementation gets the corners right and silently leaves
// the dimension strings, the teleposts and the garage behind."
//
// AND THE PORT NEEDED A GESTURE. Nothing on this page moved a master point --
// a master lives in boneyardOutlines keyed by shelfId, so it did not even
// DRAW on its own shelf. The propagation would have been dead code, which is
// why Movie ruled the gesture into the same commit: drag a master's corner on
// the boneyard, where masters live.

const MASTER = {
  id: 'master-1', shelfId: 1,
  points: [{ id: 'p1', x: -8, z: -6 }, { id: 'p2', x: 8, z: -6 },
    { id: 'p3', x: 8, z: 6 }, { id: 'p4', x: -8, z: 6 }],
};

// A COPY ON A LEVEL, linked the way addLevel now stamps it.
const copyOn = levelId => ({
  id: `copy-${levelId}`, levelId, masterId: 'master-1', overriddenSrcIds: [],
  points: MASTER.points.map(pt => ({ x: pt.x, z: pt.z, srcId: pt.id, offX: 0, offZ: 0 })),
});

// THE CENTRE IS MEASURED, NOT ASSUMED, and the reload check is what forced
// it. fit() centres the view on the MIDPOINT OF DRAWN BOUNDS, not the origin.
// The fixture starts symmetric about (0,0) so the two agree -- and the moment
// the first drag pulls a corner to z=-12 they stop agreeing. On the reload the
// view re-fits around the new midpoint, and a helper still mapping from the
// origin presses four feet from the corner it is aiming at.
//
// On the boneyard the master IS everything drawn, so its own bounds give the
// centre exactly.
const dragMaster = async (page, from, to) => {
  // THE PAGE IS ASKED WHERE THE POINT IS, and this helper has now been wrong
  // twice for two different reasons -- which is why it no longer works it out.
  //
  // FIRST it computed the centre from the MASTER's bounds, which is what fit()
  // would use if the boneyard were what it had fitted to. It is not: fit()
  // runs at LOAD, against the LEVEL's geometry, because the page opens on a
  // level. That was replaced by "the centre is the origin", measured from the
  // fixture being symmetric about (0,0).
  //
  // THEN THE ORIGIN STOPPED BEING THE CENTRE. fit() insets the view for the
  // two dark bars, so the camera sits off-centre by half their difference --
  // and when the drive-thru commits changed a bar's height, that offset moved
  // and every press this helper aimed drifted with it. The master landed at
  // -12.072 instead of -12: not the propagation, the aim.
  //
  // planFrame reads the camera the page publishes on #plan. A mapping worked
  // out here is a second copy of fit()'s arithmetic, and it has now drifted
  // from the first copy twice.
  const { at } = await h.planFrame(page);
  // SELECTION FIRST, then the grab -- the page's own rule for a corner.
  await page.mouse.click(...at(...from));
  await page.waitForTimeout(80);
  await page.mouse.move(...at(...from));
  await page.mouse.down();
  await page.mouse.move(...at(...to), { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(150);
};

test('§4: moving a master corner moves EVERY level that follows it',
  async ({ page }) => {
    // TWO LEVELS, because "assert every locked level's copy moved with it --
    // the master and all floors, not the one you can see". One floor would
    // pass on a build that only ever reaches the active level.
    await open(page, base({
      boneyardOutlines: [MASTER],
      outlines: [copyOn(MAIN), copyOn(1)],
    }));

    await card(page).click();
    await dragMaster(page, [-8, -6], [-8, -12]);

    const file = await saveIt(page);
    const master = file.boneyardOutlines.find(o => o.id === 'master-1');
    const src = master.points.find(p => p.id === 'p1');
    expect(src.z, 'the master corner itself moved').toBeCloseTo(-12, 1);

    for (const levelId of [MAIN, 1]) {
      const copy = file.outlines.find(o => Number(o.levelId) === levelId);
      const pt = copy.points.find(p => p.srcId === 'p1');
      expect(pt.z, `level ${levelId} followed the master`).toBeCloseTo(src.z, 6);
    }

    // THE CONTROL: the other three corners did not move, so "everything
    // followed" cannot pass by the whole drawing having been translated.
    const far = file.outlines[0].points.find(p => p.srcId === 'p3');
    expect(far.z, 'the far corner stayed where it was').toBeCloseTo(6, 6);
  });

test('§4: the riders move too — a dimension, a column and a beam',
  async ({ page }) => {
    // THE REASON THE ORDER SAYS PORT RATHER THAN WRITE. Each rides at the
    // offset it was generated with, and each is its own loop so the gate can
    // mutate them away separately: a check that only reads the outline passes
    // with all three deleted.
    await open(page, base({
      boneyardOutlines: [MASTER],
      outlines: [copyOn(MAIN)],
      // INTEGER IDS, and the check found that out the hard way: the format
      // takes `Number.isInteger(id)` for dimensions, beams and columns
      // (drawing-format.js:199), so a string id is REFUSED on load and the
      // rider never existed to ride. The first run reported "the dimension
      // did not move" when the truth was that the fixture had no dimension.
      dimensions: [{ id: 1, levelId: MAIN, view: 'plan',
        start: { x: -8, y: 0, z: -6, srcId: 'p1', offX: 0, offZ: 0 },
        end: { x: 8, y: 0, z: -6, srcId: 'p2', offX: 0, offZ: 0 } }],
      columns: [{ id: 1, levelId: MAIN, view: 'floor',
        point: { x: -6, y: 0, z: -4, srcId: 'p1', offX: 2, offZ: 2 } }],
      beams: [{ id: 1, levelId: MAIN, view: 'floor',
        start: { x: -8, y: 0, z: -6, srcId: 'p1', offX: 0, offZ: 0 },
        end: { x: 8, y: 0, z: 6, srcId: 'p3', offX: 0, offZ: 0 } }],
    }));

    await card(page).click();
    await dragMaster(page, [-8, -6], [-8, -12]);

    const file = await saveIt(page);
    const z = file.boneyardOutlines[0].points.find(p => p.id === 'p1').z;
    expect(z, 'the master moved at all').toBeCloseTo(-12, 1);

    expect(file.dimensions[0].start.z,
      'the dimension string rides the corner it was strung from')
      .toBeCloseTo(z, 6);
    expect(file.columns[0].point.z,
      'the column rides at the offset it was placed with')
      .toBeCloseTo(z + 2, 6);
    expect(file.beams[0].start.z, 'and the auto-beam snapped to that jog')
      .toBeCloseTo(z, 6);

    // EACH RIDER'S OTHER END IS LINKED TO A CORNER THAT DID NOT MOVE, so a
    // build that dragged whole records rather than linked points fails here.
    expect(file.dimensions[0].end.z, "the string's far end stayed")
      .toBeCloseTo(-6, 6);
    expect(file.beams[0].end.z, "and the beam's far end stayed")
      .toBeCloseTo(6, 6);
  });

test('§5a: a hand-moved point FREEZES — the master moves out from under it',
  async ({ page }) => {
    // ASSERTED AS AN ABSOLUTE COORDINATE, which the order names specifically:
    // "assert its absolute coordinate is unchanged after the master moves, not
    // merely that it differs from the master". Differing from the master is
    // also what riding at an offset looks like, so "not taken back" is
    // satisfied by the behaviour this commit is replacing.
    //
    // MODEL.dc.html rides the point at its stored offset (:12057). Movie ruled
    // the other way and the divergence is deliberate: an override means the
    // drafter took this corner off the master BY HAND, and riding keeps it
    // following the master forever at a fixed gap — which makes "overridden"
    // mean "offset", and offset already has a name, on every rider.
    // TWO COPIES OF THE SAME MASTER, and only one of them overridden. THE
    // CONTRAST IS THE CHECK: one drag, one master, and the two copies must
    // end up in DIFFERENT places.
    //
    // My first version of this used one copy and asserted that an untouched
    // CORNER still followed. That could not fail. The drag moves p1 only, so
    // p2's master coordinate never changes either — both sides of the
    // comparison were static, and a freeze applied to EVERY point read
    // exactly like a freeze applied to the right one. The mutation harness
    // caught it and said so ("caught by another check — re-aim `test`"),
    // which is the whole reason that line exists in the harness.
    const held = copyOn(MAIN);
    held.overriddenSrcIds = ['p1'];
    held.points = held.points.map(pt => (pt.srcId === 'p1'
      ? { ...pt, x: -5, z: -3, offX: 3, offZ: 3 } : pt));

    await open(page, base({
      boneyardOutlines: [MASTER],
      outlines: [held, copyOn(1)],          // FOUNDATION follows, MAIN is held
    }));
    await card(page).click();
    await dragMaster(page, [-8, -6], [-8, -12]);

    const file = await saveIt(page);
    const z = file.boneyardOutlines[0].points.find(p => p.id === 'p1').z;
    const heldPt = file.outlines.find(o => Number(o.levelId) === MAIN)
      .points.find(p => p.srcId === 'p1');
    const freePt = file.outlines.find(o => Number(o.levelId) === 1)
      .points.find(p => p.srcId === 'p1');

    // THE MASTER REALLY MOVED, or the rest of this proves nothing: a drag that
    // silently failed would leave both copies untouched and read as a freeze.
    //
    // TOLERANCED LIKE A DRAG, which is what it measures -- and which its two
    // siblings in this file already do (:638 and :681 both check "the master
    // moved" at precision 1). This one asked for SIX, and that was the odd
    // one out rather than a deliberate tightening: it is a precondition about
    // whether a MOUSE landed, and a mouse carries integer pixels.
    //
    // It came due when the shared bar's box model was pinned and the top
    // strip went 45px to the 44 its variable always named. fit() insets the
    // view for the two dark bars, so the camera moved half a pixel and the
    // drag landed at -12.00000051 instead of -12 -- off by one part in twenty
    // million, over a threshold of 5e-7. dragMaster's own comment records the
    // same thing happening before, when a drive-thru commit changed a bar's
    // height: "not the propagation, the aim."
    //
    // THE PROPAGATION ASSERTIONS BELOW KEEP PRECISION 6, and that is the
    // distinction. They compare saved values against each other or against
    // fixture literals the drag never touched -- exact arithmetic, where six
    // places is honest. Only the aim is loosened, and only to what its
    // siblings already use.
    expect(z, 'the master corner moved').toBeCloseTo(-12, 1);

    // FROZEN: exactly where the hand left it, both axes.
    expect(heldPt.z, 'the overridden point stayed where it was put')
      .toBeCloseTo(-3, 6);
    expect(heldPt.x, 'and did not drift in x either').toBeCloseTo(-5, 6);
    // AND NOT RIDING, named, so a regression to DC's branch fails here with
    // the reason on it rather than as a bare number mismatch.
    expect(heldPt.z, 'it did not ride at its stored offset (DC behaviour)')
      .not.toBeCloseTo(z + 3, 6);

    // AND THE COPY NOBODY TOUCHED STILL FOLLOWS, to the master's new place.
    // This is the half that fails when the freeze is over-broad: same point,
    // same master, same drag, and it must have MOVED.
    expect(freePt.z, 'the un-overridden copy followed the master')
      .toBeCloseTo(z, 6);
    expect(freePt.z, 'and it really moved, rather than starting there')
      .not.toBeCloseTo(-6, 6);
  });

test('§4: save, reload, move again — the same points follow', async ({ page }) => {
  await open(page, base({
    boneyardOutlines: [MASTER],
    outlines: [copyOn(MAIN)],
  }));

  await card(page).click();
  await dragMaster(page, [-8, -6], [-8, -12]);
  await saveIt(page);

  await page.reload();
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  await card(page).click();

  // A DIFFERENT CORNER for the second move, and deliberately so. Re-dragging
  // p1 would ask the same question twice and make the check depend on knowing
  // exactly where the first drag left it; moving p2 asks whether propagation
  // is still live for a point it has never touched -- which is the thing a
  // one-shot or a cached map would fail.
  await dragMaster(page, [8, -6], [8, -10]);

  const file = await saveIt(page);
  const master = file.boneyardOutlines[0];
  const moved = master.points.find(p => p.id === 'p2');
  expect(moved.z, 'the second move landed too').toBeCloseTo(-10, 1);
  expect(file.outlines[0].points.find(p => p.srcId === 'p2').z,
    'and the copy followed it across the reload').toBeCloseTo(moved.z, 6);

  // AND THE FIRST MOVE SURVIVED THE RELOAD, so this is a second edit to a
  // drawing that remembers the first, not a fresh one that forgot it.
  expect(master.points.find(p => p.id === 'p1').z,
    "the first drag's corner is still where it was left").toBeCloseTo(-12, 1);
});
