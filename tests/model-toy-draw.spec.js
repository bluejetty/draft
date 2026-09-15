// §1 — DRAWING THE OUTLINE: the gestures, and the number the drafter can see.
//
// Work order: GILLIGAN-TOY-BONES-WORKORDER §1, acceptance #1, #2 and #4.
//
// WHY THIS FILE EXISTS SEPARATELY from model-toy-board.spec.js. That file
// asserts what TOY does to a run -- squares it, lands it on the foot -- and it
// drives every one of those checks with two `mouse.click`s. Acceptance #1 is
// named for a PRESS-DRAG-RELEASE and #2 asks that press-again-and-drag reach
// the same wall, and neither can be shown by a gesture that never presses and
// drags. The revised order says so in as many words: the check must "perform
// each gesture rather than naming one and tapping twice".
//
// So the gestures live here and they are performed. Three of them, because the
// page has three: a mouse click-move-click, a finger press-drag-lift, and a
// finger that lifts after the first press and comes back.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const V = (x, z) => ({ x, y: 0, z });

// The square from model-toy-board.spec.js, for the two reasons recorded there:
// symmetric about the origin so fit()'s centre is (0,0), and a real extent in
// BOTH axes so the 200 px/ft clamp does not put every press off the canvas.
const base = extra => ({
  version: 1,
  levels: [{ id: 3, name: 'MAIN FL', elev: 0 }],
  activeLevelIdx: 0,
  walls: [
    ['n', V(-10, -10), V(10, -10)], ['e', V(10, -10), V(10, 10)],
    ['s', V(10, 10), V(-10, 10)], ['w', V(-10, 10), V(-10, -10)],
  ].map(([id, start, end]) => ({ id, start, end, levelId: 3, view: 'plan',
    wallType: 'stud_2x6', baseHeight: 0, topHeight: 8, refLine: 'left' })),
  lines: [], floors: [], roofs: [], fenestrations: [], dimensions: [],
  outlines: [], shapes: [], surfaceOpenings: [], stairs: [], notes: [],
  roomTags: [], columns: [], beams: [], boneyardOutlines: [], boneyardShelves: [],
  groups: [], levelLocks: [], underlays: [],
  ...extra,
});

async function open(page, file) {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, f }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json',
        { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, f: file });
  // NO ?left=1. The rail covers the left of the drawing, and every press below
  // lands on the canvas -- an occluded press would report as a wall that never
  // committed and point at the gesture rather than at the panel over it.
  await page.goto('/MODEL.html');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
}

async function frame(page) {
  const box = await page.locator('#plan').boundingBox();
  const scale = await page.evaluate(() => Number(
    /scale ([\d.]+) px\/ft/.exec(document.getElementById('readout').textContent)[1]));
  return { at: (x, z) => [box.x + box.width / 2 + x * scale,
    box.y + box.height / 2 + z * scale] };
}

const stored = page => page.evaluate(async bucket => {
  const f = await window.SharedFileStore.loadSharedFile(bucket);
  return JSON.parse(await f.text());
}, BUCKET);

const SEEDED = new Set(['n', 'e', 's', 'w']);
async function committed(page) {
  await page.locator('#save').click();
  await page.waitForTimeout(400);
  const saved = await stored(page);
  const made = saved.walls.filter(w => !SEEDED.has(w.id)).pop();
  return made && {
    s: [Number(made.start.x.toFixed(6)), Number(made.start.z.toFixed(6))],
    e: [Number(made.end.x.toFixed(6)), Number(made.end.z.toFixed(6))],
  };
}
const spanOf = w => Math.hypot(w.e[0] - w.s[0], w.e[1] - w.s[1]);

// A MOUSE PRESS-DRAG-LIFT. Playwright's mouse reports pointerType 'mouse', so
// this is the PC pointer doing the drag gesture -- which must still work: §1's
// "either drag, or press again and drag" is not addressed to touch only.
async function mouseDrag(page, from, to) {
  const { at } = await frame(page);
  await h.armWall(page);
  await page.mouse.move(...at(...from));
  await page.mouse.down();
  await page.mouse.move(...at(...to), { steps: 10 });
  await page.mouse.up();
  await page.waitForTimeout(120);
}

// THE PC GESTURE THE ORDER NAMES: click to set, move with the line live, click
// to place.
async function mouseClickClick(page, from, to) {
  const { at } = await frame(page);
  await h.armWall(page);
  await page.mouse.click(...at(...from));
  await page.mouse.move(...at(...to), { steps: 10 });
  await page.waitForTimeout(60);
  await page.mouse.click(...at(...to));
  await page.waitForTimeout(120);
}

// A FINGER, AND IT HAS TO BE SYNTHETIC. page.mouse reports pointerType
// 'mouse', so every gesture above drives the PC path -- I built a pointer-type
// split and tested one side of it, and the gate said so: the mutant that makes
// a finger commit on the down survived because no check had a finger. These
// dispatch PointerEvents with pointerType 'touch' at exact client coordinates,
// which also makes them repeatable in a way mouse.move is not.
async function touchGesture(page, steps) {
  const { at } = await frame(page);
  await h.armWall(page);
  const pts = steps.map(([kind, x, z]) => [kind, ...at(x, z)]);
  await page.evaluate(list => {
    const c = document.getElementById('plan');
    for (const [kind, x, y] of list) {
      c.dispatchEvent(new PointerEvent(kind, {
        pointerId: 1, pointerType: 'touch', isPrimary: true,
        clientX: x, clientY: y, bubbles: true, cancelable: true }));
    }
  }, pts);
  await page.waitForTimeout(120);
}

test('a finger that presses, drags and lifts reaches the mouse\'s wall',
  async ({ page }) => {
    // §1 gives touch the press-drag-lift and PC the click-move-click, and says
    // they are "the same wall by the time it reaches commitWall". Compared to
    // each other, for the reason acceptance #2 is: a constant would let the
    // two pointers drift apart while both stayed plausible.
    await open(page, base({ board: 'toy' }));
    await touchGesture(page, [['pointerdown', 0, 0],
      ['pointermove', 3, 0.4], ['pointermove', 5.4, 0.8], ['pointerup', 5.4, 0.8]]);
    const byFinger = await committed(page);

    await open(page, base({ board: 'toy' }));
    await mouseClickClick(page, [0, 0], [5.4, 0.8]);
    const byMouse = await committed(page);

    expect(byFinger, 'the finger placed a wall').toBeTruthy();
    expect(byFinger).toEqual(byMouse);
  });

test('a finger that lifts, presses again and drags reaches the same wall',
  async ({ page }) => {
    // THE GESTURE THE TOUCH BRANCH EXISTS FOR, and the one the surviving
    // mutant broke. The second press lands at the MIDPOINT and the finger then
    // drags on to the end: if the down committed where it landed, this wall
    // would stop at 3 ft instead of 5.
    await open(page, base({ board: 'toy' }));
    await touchGesture(page, [['pointerdown', 0, 0], ['pointerup', 0, 0]]);
    await touchGesture(page, [['pointerdown', 3, 0.4],
      ['pointermove', 5.4, 0.8], ['pointerup', 5.4, 0.8]]);
    const w = await committed(page);

    await open(page, base({ board: 'toy' }));
    await mouseClickClick(page, [0, 0], [5.4, 0.8]);
    expect(w, 'press-again-and-drag placed a wall').toBeTruthy();
    expect(w).toEqual(await committed(page));
  });

test('a tremor during the press does not move where the run started',
  async ({ page }) => {
    // WHAT DRAG_ARM_PX IS ACTUALLY FOR, and my comment beside it was wrong. I
    // wrote that without the threshold "every PC click becomes a zero-length
    // wall attempt"; the gate disproved it -- drawPress treats a sub-0.001
    // second point as a CORRECTION, so nothing visible breaks. What really
    // breaks is this: a press with a few pixels of tremor commits nothing but
    // moves the run's start to where the tremor ended.
    //
    // DRAFTING, because TOY would round the difference away, and compared
    // against the same gesture held still rather than against a tolerance.
    await open(page, base({ board: 'drafting' }));
    const { at } = await frame(page);
    await h.armWall(page);
    const [x, y] = at(0, 0);
    await page.mouse.move(x, y);
    await page.mouse.down();
    // 2px EACH WAY, NOT 3. Diagonal displacement is the hypotenuse, and 3,3 is
    // 4.24px -- over DRAG_ARM_PX's 4, so my first version of this line was a
    // DRAG being called a tremor, and it committed. 2,2 is 2.83 and is what
    // the threshold is meant to absorb.
    await page.mouse.move(x + 2, y + 2);
    await page.mouse.up();
    await page.mouse.move(...at(6, 0));
    await page.mouse.click(...at(6, 0));
    await page.waitForTimeout(120);
    const shaky = await committed(page);

    await open(page, base({ board: 'drafting' }));
    await mouseClickClick(page, [0, 0], [6, 0]);
    const steady = await committed(page);
    expect(shaky, 'the shaky press still drew').toBeTruthy();
    expect(shaky, 'and drew the same wall a steady one does').toEqual(steady);
  });

test('acceptance #1 — a press, a drag and a lift commit a squared whole-foot wall',
  async ({ page }) => {
    // Deliberately awkward, as the order asks: 5.4 across and 0.8 down, so an
    // honest build has to both square it and round it.
    await open(page, base({ board: 'toy' }));
    await mouseDrag(page, [0, 0], [5.4, 0.8]);
    const w = await committed(page);
    expect(w, 'the lift placed a wall').toBeTruthy();
    expect(Math.abs(w.e[1] - w.s[1]), 'exactly axis-aligned').toBeLessThan(1e-9);
    expect(spanOf(w), 'and the nearest whole foot to 5.4').toBeCloseTo(5, 9);
  });

test('acceptance #2 — click-move-click reaches the same wall as press-drag-lift',
  async ({ page }) => {
    // THE TWO GESTURES ARE COMPARED, not each checked against a constant. That
    // is what "reaches the same wall" means, and it is why the commit may not
    // live in either handler: a constant would let the two drift apart as long
    // as both happened to be axis-aligned and whole.
    await open(page, base({ board: 'toy' }));
    await mouseDrag(page, [0, 0], [5.4, 0.8]);
    const dragged = await committed(page);

    await open(page, base({ board: 'toy' }));
    await mouseClickClick(page, [0, 0], [5.4, 0.8]);
    const clicked = await committed(page);

    expect(dragged, 'the drag committed').toBeTruthy();
    expect(clicked, 'the clicks committed').toBeTruthy();
    expect(clicked).toEqual(dragged);
  });

test('the length on screen is the length that gets committed', async ({ page }) => {
  // ACCEPTANCE #2's second half: "assert them equal, not merely both present".
  // Before this, runInHand measured the run through squareTo while the commit
  // went through drawPoint -- so on TOY the strip read 5.4 over a wall that
  // committed at 5. Both halves passed a "is there a number" check.
  await open(page, base({ board: 'toy' }));
  const { at } = await frame(page);
  await h.armWall(page);
  await page.mouse.move(...at(0, 0));
  await page.mouse.down();
  await page.mouse.move(...at(5.4, 0.8), { steps: 10 });

  const label = page.locator('[data-draw-length]');
  await expect(label, 'the drafter can see a length while drawing').toBeVisible();
  const shown = (await label.textContent()).trim();

  await page.mouse.up();
  await page.waitForTimeout(120);
  const w = await committed(page);
  expect(w).toBeTruthy();
  // The label is a feet string; the wall is a number. Comparing the label to
  // the FORMATTED committed span is the only comparison that catches a drift
  // of less than a foot, which is exactly the drift there was.
  // Formatted through the page's OWN formatter, the one feetLabel calls, so
  // this compares two feet strings rather than a string against a number a
  // test happened to round the same way.
  const asCommitted = await page.evaluate(n =>
    window.DraftFormatters.formatArchitecturalInches(n * 12), spanOf(w));
  expect(shown, `on screen ${shown}, committed ${asCommitted}`).toBe(asCommitted);
  // WHOLE FEET, and the shape of the string is how you can tell. The
  // architectural format always prints the inches, so 5'-0" IS a whole foot
  // and a bare `not.toContain('"')` rejects the correct answer -- my own first
  // version of this line did exactly that. What TOY must never show is a
  // non-zero or fractional inch: 5'-4" or 5'-4 3/4".
  expect(shown, 'whole feet and zero inches on the TOY board')
    .toMatch(/^\d+'-0"$/);
  expect(shown).toContain('5');
});

test('the length goes out when the run does', async ({ page }) => {
  // A length still on screen after the gesture is over is the one thing a
  // drafter should never be able to misread.
  await open(page, base({ board: 'toy' }));
  await mouseDrag(page, [0, 0], [5.4, 0.8]);
  // The chain leaves a run open at the wall's end, so put the tool down.
  await h.disarmWall(page);
  await page.waitForTimeout(80);
  await expect(page.locator('[data-draw-length]')).toBeHidden();
});

test('acceptance #4 — DRAFTING keeps the off-axis, off-foot wall the drag makes',
  async ({ page }) => {
    // TOY MUST NOT LEAK, and the new gesture is a new way for it to. The drag
    // handler is shared by both boards, so if the squaring rode in the handler
    // rather than in drawPoint this is what would catch it.
    await open(page, base({ board: 'drafting' }));
    await mouseDrag(page, [0, 0], [5.4, 0.8]);
    const w = await committed(page);
    expect(w, 'the lift placed a wall on DRAFTING too').toBeTruthy();
    expect(Math.abs(w.e[1] - w.s[1]), 'and it is NOT squared').toBeGreaterThan(0.1);
    // AND NOT ROUNDED, which is the half that was missing. onTheFoot rounds the
    // length ALONG THE RUN and keeps the direction, so a 5.4/0.8 drag stays
    // visibly off-axis at about 0.73 even when TOY's rounding has leaked into
    // DRAFTING -- the squared check alone passed straight through that mutant.
    const span = Math.hypot(w.e[0] - w.s[0], w.e[1] - w.s[1]);
    expect(Math.abs(span - Math.round(span)),
      'DRAFTING keeps the fractional length too').toBeGreaterThan(0.01);
  });

// ── §2: THE OUTLINE THE GESTURE MAKES ───────────────────────────────────────
//
// ACCEPTANCE 2b. Ruled 13 Sep: "yes the toy house will have the bones and those
// will be what TOY can manipulate" -- so the TOY draw gesture writes the level
// OUTLINE as well as the walls. One gesture, walls and bone together.
//
// This was a measurement before it was a ruling: commitWall pushes to
// drawing.walls and touches nothing else, and the only place MODEL.html makes
// a level outline is adding a level, copying a boneyard master
// (MODEL.html:2919). A hand-drawn TOY house had no bone at all, so §2's "the
// outline becomes a bone" had nothing to become one.
//
// THE OUTLINE IS THE FORMAT'S OWN, not a second store: drawing-format.js:893
// takes points with srcId/offX/offZ, masterId, and overriddenSrcIds. A hand
// drawn house has no master, so masterId is null -- "purely local outlines" in
// the format's own words -- and that is what makes it a bone rather than a
// copy of one.
const outlinesIn = page => page.evaluate(async bucket => {
  const f = await window.SharedFileStore.loadSharedFile(bucket);
  const raw = JSON.parse(await f.text());
  const F = window.DraftDrawingFormat;
  const ids = new Set((raw.levels || []).map(l => Number(l.id)));
  return { kept: F.outlines(raw.outlines, ids), written: (raw.outlines || []).length };
}, BUCKET);

async function saveIt(page) {
  await page.locator('#save').click();
  await page.waitForTimeout(400);
}

test('acceptance 2b — a house drawn in TOY has an outline, not walls alone',
  async ({ page }) => {
    // A THREE-SIDED RUN, because the format refuses an outline under three
    // points (:918). Two walls would leave nothing to assert and the check
    // would pass on a page that writes no outline at all.
    await open(page, base({ board: 'toy', walls: [] }));
    const { at } = await frame(page);
    await h.armWall(page);
    await page.mouse.click(...at(0, 0));
    await page.waitForTimeout(60);
    await page.mouse.click(...at(12, 0));
    await page.waitForTimeout(60);
    await page.mouse.click(...at(12, 8));
    await page.waitForTimeout(60);
    await page.mouse.click(...at(0, 8));
    await page.waitForTimeout(120);
    await saveIt(page);

    const o = await outlinesIn(page);
    expect(o.written, 'the gesture wrote an outline').toBeGreaterThan(0);
    // THROUGH THE READER. An outline the format drops is a bone that is gone
    // on the next load -- the same silent, one-reload-later loss as a column
    // written with a string id.
    expect(o.kept.length, 'and a reload keeps it').toBeGreaterThan(0);
    const bone = o.kept[0];
    // EXACTLY FOUR, NOT AT LEAST THREE. The gate caught the loose version: a
    // mutant that stores the shared corner twice gives MORE points and sailed
    // through `>= 3`. Four presses, four corners -- a chained wall starts
    // where the last one ended, so that corner is one point and not two.
    expect(bone.points.map(p => [Math.round(p.x), Math.round(p.z)]),
      'one point per corner pressed').toEqual([[0, 0], [12, 0], [12, 8], [0, 8]]);
    expect(bone.masterId, 'hand drawn, so no master: this IS the bone').toBeNull();
  });

test('a DRAFTING house is still walls alone — TOY does not leak', async ({ page }) => {
  // The mirror, and it is what stops the outline being written unconditionally.
  // Without it "always write an outline" satisfies 2b and changes what every
  // DRAFTING drawing contains.
  await open(page, base({ board: 'drafting', walls: [] }));
  const { at } = await frame(page);
  await h.armWall(page);
  await page.mouse.click(...at(0, 0));
  await page.waitForTimeout(60);
  await page.mouse.click(...at(12, 0));
  await page.waitForTimeout(60);
  await page.mouse.click(...at(12, 8));
  await page.waitForTimeout(120);
  await saveIt(page);
  expect((await outlinesIn(page)).written, 'DRAFTING writes no outline').toBe(0);
});

test('a run drawn away from the house is a second bone, not one polygon',
  async ({ page }) => {
    // RULED 13 SEP, against one-bone-per-level. A detached garage is a separate
    // footprint, so one level carries two bones and each is grabbed on its own.
    //
    // The version this replaces joined every run on a level into one outline,
    // which drew a shape running from the house across the yard to the garage.
    // Nobody drew that, and §4's break-the-bone would have had to treat it as a
    // loop. The check asserts TWO bones and that neither holds the other's
    // corners -- a single merged outline has all six points and would satisfy
    // any check that only counted points.
    await open(page, base({ board: 'toy', walls: [] }));
    const { at } = await frame(page);
    await h.armWall(page);
    for (const [x, z] of [[0, 0], [10, 0], [10, 6], [0, 6]]) {
      await page.mouse.click(...at(x, z));
      await page.waitForTimeout(60);
    }
    // Away from the house, and not touching it: the run starts where nothing
    // ended, which is what makes it a second footprint.
    await h.disarmWall(page);   // put the chain down
    await page.waitForTimeout(60);
    await h.armWall(page);
    for (const [x, z] of [[24, 0], [32, 0], [32, 6], [24, 6]]) {
      await page.mouse.click(...at(x, z));
      await page.waitForTimeout(60);
    }
    await saveIt(page);

    const { kept } = await outlinesIn(page);
    expect(kept.length, 'two bones on one level').toBe(2);
    const xs = kept.map(o => o.points.map(p => Math.round(p.x)));
    const house = xs.find(list => list.includes(0));
    const garage = xs.find(list => list.includes(24));
    expect(house, 'the house bone exists').toBeTruthy();
    expect(garage, 'and the garage bone is its own').toBeTruthy();
    expect(house, 'the house does not reach across the yard').not.toContain(24);
    expect(garage, 'and the garage does not reach back').not.toContain(0);
  });

test('one wall in TOY is not yet a bone, and nothing is written', async ({ page }) => {
  // THE GATE FOUND THIS HOLE. A mutant that pushes the outline before it has
  // three points survived every check here, because every check drew four
  // corners -- by save time the record had grown to a shape the reader keeps,
  // so the early push made no difference. It makes all the difference to a run
  // that STOPS at one wall: a two-point outline is written into the file and
  // thrown away on load, which is a drawing that has a bone until it is
  // reopened.
  await open(page, base({ board: 'toy', walls: [] }));
  const { at } = await frame(page);
  await h.armWall(page);
  await page.mouse.click(...at(0, 0));
  await page.waitForTimeout(60);
  await page.mouse.click(...at(12, 0));
  await page.waitForTimeout(120);
  await saveIt(page);
  const o = await outlinesIn(page);
  expect(o.written, 'nothing the reader would discard reached the file').toBe(0);
  expect(o.kept.length).toBe(0);
});

test('an unfinished run refuses a new one, and says so', async ({ page }) => {
  // RULED 13 SEP, replacing the boundary I reported. Starting a disconnected
  // run while the first has only two taps used to drop those taps silently.
  // Now the new run is refused and the strip says why -- the drafter's hand
  // did something, so the screen has to account for it.
  await open(page, base({ board: 'toy', walls: [] }));
  const { at } = await frame(page);
  await h.armWall(page);
  await page.mouse.click(...at(0, 0));
  await page.waitForTimeout(60);
  await page.mouse.click(...at(6, 0));       // two taps: a run, not yet a shape
  await page.waitForTimeout(60);
  await h.disarmWall(page);
  await page.waitForTimeout(60);
  await h.armWall(page);

  await page.mouse.click(...at(24, 0));      // somewhere else entirely
  await page.waitForTimeout(80);
  await expect(page.locator('#strip-message'),
    'the refusal is on screen, not only in the data')
    .toContainText('finish or cancel');

  // AND NOTHING WAS MADE BY THE REFUSED PRESS. A refusal that still commits
  // the first wall of the new run is the half-application §7 forbids one
  // section over.
  await page.mouse.click(...at(32, 0));
  await page.waitForTimeout(80);
  await saveIt(page);
  expect((await outlinesIn(page)).kept.length,
    'nothing was created by the refused press').toBe(0);

  // AND NOTHING WAS LOST -- the third assertion 2e asks for, and the one the
  // silent drop would sail past. The two taps are still the live run, so
  // continuing it from where it stopped closes the shape it was always going
  // to be, with the original corners in it.
  //
  // RESUMING MEANS PRESSING AT THE END THE RUN STOPPED AT. My first version
  // pressed straight at the far corner and was refused -- correctly, since a
  // press anywhere else is exactly what the rule forbids. The refusal is not
  // "you may not draw", it is "this run is still open": press its open end and
  // it continues.
  await page.mouse.click(...at(6, 0));
  await page.waitForTimeout(60);
  await page.mouse.click(...at(6, 6));
  await page.waitForTimeout(80);
  await saveIt(page);
  const after = (await outlinesIn(page)).kept;
  expect(after.length, 'the run finished into one bone').toBe(1);
  expect(after[0].points.map(p => [Math.round(p.x), Math.round(p.z)]),
    'and it still begins with the two taps that were there before the refusal')
    .toEqual([[0, 0], [6, 0], [6, 6]]);
});

test('Escape cancels the unfinished run the refusal names', async ({ page }) => {
  // The refusal says "finish or cancel", so the cancel has to exist: a message
  // naming a way out the page does not offer is worse than no message.
  await open(page, base({ board: 'toy', walls: [] }));
  const { at } = await frame(page);
  await h.armWall(page);
  await page.mouse.click(...at(0, 0));
  await page.waitForTimeout(60);
  await page.mouse.click(...at(6, 0));
  await page.waitForTimeout(60);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(60);
  await expect(page.locator('#strip-message')).toContainText('cancelled');

  // AND THE REFUSAL IS GONE WITH IT: a new run somewhere else is now allowed.
  await page.mouse.click(...at(24, 0));
  await page.waitForTimeout(60);
  // THE NOTICE GOES WHEN A PRESS SUCCEEDS. The gate caught this missing: a
  // mutant removing the clear survived, because the check read the notice
  // once and never looked again. "run cancelled" left sitting over a live new
  // run is the same lie as any other stale message -- the page reporting
  // something that stopped being true.
  await expect(page.locator('#strip-message'),
    'the cancel notice does not sit over the run that followed it')
    .not.toContainText('cancelled');
  await page.mouse.click(...at(32, 0));
  await page.waitForTimeout(60);
  await page.mouse.click(...at(32, 6));
  await page.waitForTimeout(80);
  await saveIt(page);
  const kept = (await outlinesIn(page)).kept;
  expect(kept.length, 'the new run was allowed to become a bone').toBe(1);
  expect(kept[0].points.map(p => Math.round(p.x)),
    'and it is the new run, not the cancelled one').not.toContain(0);
});

// ── §3: A BLOCKED DRAG STOPS DEAD AND THE BLOCKER SAYS WHY ──────────────────
//
// WRITTEN BEFORE THE CODE, and that ordering is the one thing today earned.
// allowedMove already returns a reason; MODEL.html already stores it in
// md.blocked; nothing displays it. That is the "never written" row of the
// message table — and the other three rows (hidden, overwritten, never
// cleared) all shipped green today because the check read state instead of
// the screen. So this asserts the strip, and it asserts it twice: the refusal
// appears, and the wall did not move.
//
// AN ANGLED WALL IS THE REFUSAL THAT NEEDS NO SETUP. toy-constraints.js calls
// inert geometry ineligible before it considers anything else — it is the
// answer that keeps old drawings open — so a diagonal is refused on its own
// merits rather than by contriving a room too small to shrink.
const angled = extra => base({
  board: 'toy',
  walls: [
    { id: 'diag', start: V(-8, -6), end: V(4, 3), levelId: 3, view: 'plan',
      wallType: 'stud_2x6', baseHeight: 0, topHeight: 8, refLine: 'left' },
  ],
  ...extra,
});

test('§3 — a blocked drag stops dead, and the strip says why', async ({ page }) => {
  await open(page, angled({}));
  const { at } = await frame(page);
  // SELECT IT FIRST. wallBodyAt only returns a wall that is already selected
  // -- "the body of a selected wall, whose grab zone has no marks on it at
  // all" -- so a press on an unselected wall starts a PAN, and my first
  // version of this check dragged the sheet instead of the wall. The strip
  // was empty because nothing was ever refused, not because the refusal was
  // silent: two different bugs with one symptom.
  const [gx, gy] = at(-2, -1.5);
  await page.mouse.click(gx, gy);
  await page.waitForTimeout(80);
  await page.mouse.move(gx, gy);
  await page.mouse.down();
  await page.mouse.move(gx, gy + 60, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(120);

  await expect(page.locator('#strip-message'),
    'the blocker is on screen, not only in md.blocked')
    .not.toHaveText('');
  // THE SPECIFIC REASON, not merely a refusal. The gate caught the loose
  // version: a mutant returning one flat "cannot move that" for every blocker
  // matched /cannot/ and survived. A refusal that never says WHICH rule
  // stopped you is the same as no reason at all -- and §3's rule is that the
  // blocker says why.
  await expect(page.locator('#strip-message')).toContainText('not square');

  // STOPS DEAD, NEVER ELASTIC: the wall is where it was.
  await saveIt(page);
  const moved = await page.evaluate(async bucket => {
    const f = await window.SharedFileStore.loadSharedFile(bucket);
    const w = JSON.parse(await f.text()).walls.find(w => w.id === 'diag');
    return [Number(w.start.x.toFixed(4)), Number(w.start.z.toFixed(4))];
  }, BUCKET);
  expect(moved, 'the refused drag moved nothing').toEqual([-8, -6]);
});

// ── ACCEPTANCE 2c: THE WALL THAT IS NOT ON THE GRID ─────────────────────────
//
// Movie, 13 Sep, offered 13'-0½" or 13'-0" and answered with a third: "make
// the first point land on a ft point how about so we don't have that problem".
// The first nudge lands the wall on the nearest foot mark; every move after is
// a whole foot.
//
// THE ORDER WARNS ABOUT THIS CHECK IN ADVANCE and the warning is the reason it
// is written this way: "a house born in TOY is already on the grid, so this
// rule is invisible there -- which means the check has to be written on an
// IMPORTED off-grid wall, or it asserts nothing." So the fixture is a drawing
// that arrived off-grid, not one this page drew.
//
// AND A WALL NOBODY TOUCHES MUST NOT MOVE. That is what keeps Movie's answer
// inside the 31 Aug rule rather than breaking it -- the half-inch is given up
// once, on the wall the drafter deliberately moved. A check that only asserted
// the moved wall would pass a page that quietly re-gridded the whole drawing
// on open, which is the one thing the rule forbids. The lone wall is far from
// the room and joined to nothing, so nothing can move it by stretching.
const OFF = -6.042;                     // 6'-0½" off the foot, as imported
//
// SYMMETRIC ABOUT THE ORIGIN, AND THE MIRROR WALL IS WHY. fit() centres on the
// midpoint of DRAWN BOUNDS, not on (0,0), and at() here assumes the origin is
// at the canvas centre. One lone wall out at (20..30, 14) dragged the centre to
// (10, 4) and every click in this check landed somewhere else entirely -- the
// press selected nothing, the drag became a PAN, and the wall sat at -6.042
// looking exactly like a refused move. The trap is written at the top of this
// file, in a fixture I copied and then broke.
//
// So there are TWO untouched walls, mirrored, and both are asserted. That is
// better than one anyway: "a wall nobody touched did not move" is a stronger
// claim when the walls sit on opposite sides of the thing that did.
const offGrid = () => base({
  board: 'toy',
  walls: [
    ['n', V(-10, OFF), V(10, OFF)], ['e', V(10, OFF), V(10, 10)],
    ['s', V(10, 10), V(-10, 10)], ['w', V(-10, 10), V(-10, OFF)],
    ['lone', V(20, 14), V(30, 14)], ['lone2', V(-30, -14), V(-20, -14)],
  ].map(([id, start, end]) => ({ id, start, end, levelId: 3, view: 'plan',
    wallType: 'stud_2x6', baseHeight: 0, topHeight: 8, refLine: 'left' })),
});

const wallZ = (page, id) => page.evaluate(async ({ bucket, wid }) => {
  const f = await window.SharedFileStore.loadSharedFile(bucket);
  const w = JSON.parse(await f.text()).walls.find(w => w.id === wid);
  return Number(w.start.z.toFixed(4));
}, { bucket: BUCKET, wid: id });

async function nudge(page, from, to) {
  const { at } = await frame(page);
  const [sx, sy] = at(...from);
  await page.mouse.click(sx, sy);                 // select: wallBodyAt needs it
  await page.waitForTimeout(80);
  // §4 CHANGED WHAT THAT CLICK MEANS ON THE SECOND PASS. The first nudge
  // leaves the wall SELECTED, so the next nudge's select-click lands on a wall
  // that is already chosen -- which is §4's gesture, and the choice opens over
  // the canvas and swallows the drag underneath it.
  //
  // So the helper does what a drafter would do, rather than pretending the
  // choice is not there: he clicked the wall, he meant to move it, he takes
  // MOVE THIS WALL and drags. Dismissing it any other way would be the helper
  // routing around a modal the drafter cannot route around.
  const choice = page.locator('[data-bone-choice]');
  if (await choice.isVisible()) {
    await choice.locator('[data-break-move]').click();
    await page.waitForTimeout(60);
  }
  await page.mouse.move(sx, sy);
  await page.mouse.down();
  const [ex, ey] = at(...to);
  await page.mouse.move(ex, ey, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(120);
  await saveIt(page);
}

test('acceptance 2c — the first nudge lands on the foot, the next is a whole foot',
  async ({ page }) => {
    await open(page, offGrid());
    // Grab the north wall's middle and pull it a foot further out (-z).
    await nudge(page, [0, OFF], [0, OFF - 1]);
    expect(await wallZ(page, 'n'), 'the first nudge landed it on the foot mark')
      .toBe(-7);

    await nudge(page, [0, -7], [0, -8]);
    expect(await wallZ(page, 'n'), 'and the next move is a whole foot')
      .toBe(-8);

    // AND THE OTHER DIRECTION, because the sign is a real part of the rule and
    // nothing above could see it: every nudge so far pulls -z, where "the mark
    // behind" and "the mark ahead" happen to give the same answer for this
    // wall. A mutant ignoring the direction survived on that. The south wall
    // is off-grid nowhere, so this uses a fresh drawing and pushes +z.
    await open(page, offGrid());
    await nudge(page, [0, OFF], [0, OFF + 1]);
    expect(await wallZ(page, 'n'), 'pushed the other way it lands on the mark ahead')
      .toBe(-6);

    await open(page, offGrid());
    // THE HALF-INCH IS GIVEN UP ONCE, ON THE WALL THAT WAS MOVED.
    await nudge(page, [0, OFF], [0, OFF - 1]);
    expect(await wallZ(page, 'lone'), 'a wall nobody touched did not move')
      .toBe(14);
    expect(await wallZ(page, 'lone2'), 'nor the one on the other side')
      .toBe(-14);
    expect(await wallZ(page, 's'), 'and neither did the far side of the room')
      .toBe(10);
  });

test('acceptance 2d — dragging one bone leaves the other where it was',
  async ({ page }) => {
    // 2d's SECOND CLAUSE, and it needed §3 before it could be written at all:
    // "assert two bones after reload, AND assert dragging one leaves the other
    // where it was." The first clause has been green since the second-bone
    // rule landed; this is the half that was owed.
    //
    // Two rooms, mirrored about the origin so fit() centres on (0,0) -- the
    // trap two checks above cost an hour, so the shape is deliberate here
    // rather than inherited.
    const rooms = base({
      board: 'toy',
      walls: [
        ['an', V(-24, -8), V(-8, -8)], ['ae', V(-8, -8), V(-8, 8)],
        ['as', V(-8, 8), V(-24, 8)], ['aw', V(-24, 8), V(-24, -8)],
        ['bn', V(8, -8), V(24, -8)], ['be', V(24, -8), V(24, 8)],
        ['bs', V(24, 8), V(8, 8)], ['bw', V(8, 8), V(8, -8)],
      ].map(([id, start, end]) => ({ id, start, end, levelId: 3, view: 'plan',
        wallType: 'stud_2x6', baseHeight: 0, topHeight: 8, refLine: 'left' })),
    });
    await open(page, rooms);
    await nudge(page, [-16, -8], [-16, -10]);

    expect(await wallZ(page, 'an'), 'the bone that was dragged moved a foot')
      .toBe(-10);
    // THE OTHER BONE IS UNTOUCHED, every wall of it. Asserting only its north
    // wall would pass a page that dragged the whole drawing and happened to
    // leave one edge alone.
    expect(await wallZ(page, 'bn'), 'the other bone did not follow').toBe(-8);
    expect(await wallZ(page, 'bs'), 'nor its far side').toBe(8);
    expect(await wallZ(page, 'be'), 'nor its sides').toBe(-8);
  });

test('a side wall moves along its own perpendicular, not always in z',
  async ({ page }) => {
    // THE GATE FOUND THIS HOLE. Every wall dragged in the checks above runs
    // along x, where the perpendicular IS z -- so a mutant that always took dz
    // changed nothing and survived. A wall running along Z is the only place
    // the axis choice can be seen at all.
    await open(page, base({
      board: 'toy',
      walls: [
        ['n', V(-12, -8), V(12, -8)], ['e', V(12, -8), V(12, 8)],
        ['s', V(12, 8), V(-12, 8)], ['w', V(-12, 8), V(-12, -8)],
      ].map(([id, start, end]) => ({ id, start, end, levelId: 3, view: 'plan',
        wallType: 'stud_2x6', baseHeight: 0, topHeight: 8, refLine: 'left' })),
    }));
    // Grab the EAST wall (runs along z) and pull it outward in x.
    await nudge(page, [12, 0], [14, 0]);
    const ex = await page.evaluate(async bucket => {
      const f = await window.SharedFileStore.loadSharedFile(bucket);
      const w = JSON.parse(await f.text()).walls.find(w => w.id === 'e');
      return [Number(w.start.x.toFixed(4)), Number(w.start.z.toFixed(4))];
    }, BUCKET);
    expect(ex[0], 'it moved in x, its own perpendicular').toBe(14);
    expect(ex[1], 'and not along its own run').toBe(-8);
  });

test('a DRAFTING wall drags freely — the constraint path is TOY only',
  async ({ page }) => {
    // THE OTHER SURVIVOR, and the leak that matters most. Acceptance #4's
    // existing check draws a NEW wall in DRAFTING; this one MOVES an existing
    // one, which is the path the constraint sits in. Without it, a mutant
    // sending every board through toyWallDelta rounds real DRAFTING plans to
    // the foot and no check objects.
    await open(page, base({
      board: 'drafting',
      walls: [
        ['n', V(-12, -8.37), V(12, -8.37)], ['e', V(12, -8.37), V(12, 8)],
        ['s', V(12, 8), V(-12, 8)], ['w', V(-12, 8), V(-12, -8.37)],
      ].map(([id, start, end]) => ({ id, start, end, levelId: 3, view: 'plan',
        wallType: 'stud_2x6', baseHeight: 0, topHeight: 8, refLine: 'left' })),
    }));
    await nudge(page, [0, -8.37], [0, -10.62]);
    const z = await wallZ(page, 'n');
    // IT MOVED, AND IT MOVED TO THE ODD PLACE. Asserting only "still
    // fractional" let the leak mutant survive: routed through the TOY path the
    // drag was REFUSED, the wall stayed at -8.37, and -8.37 is fractional --
    // so a check about the number alone passed while the wall never moved.
    // THE EXACT PLACE IT WAS DRAGGED TO, and nothing looser. "Moved, and still
    // fractional" let the leak mutant survive twice: routed through the TOY
    // path the drag quantises to a multiple of the landing step and arrives at
    // -10.89 -- moved, fractional, and wrong. Only the actual distance can
    // tell a free drag from a rounded one.
    expect(Math.abs(z - (-10.62)),
      'DRAFTING moved it exactly as far as it was dragged').toBeLessThan(0.12);
  });

// ── THE DIAGONAL TOY COULD STILL DRAW ───────────────────────────────────────
//
// Found by probing what a §4 break WOULD produce, before building §4: a run
// already split into two collinear walls sharing a corner. Dragging one half
// gave `n2: (0,-11) -> (10,-10)` -- a diagonal, in TOY, with an empty strip.
//
// TWO FAULTS UNDER IT, and neither could be seen from the square:
//
//  1. The page never told the module what moves. Left alone the module welds
//     every touching wall into one group, so a CLOSED ROOM is one group and
//     the question being answered was "may I pick the whole house up and set
//     it down a foot away" -- always yes. Measured: group [n,e,s,w], no
//     stretches, reason null. Every room minimum, cantilever band and span
//     rule in the module was unreachable from this page, and no mutant could
//     show it, because an unconditional yes looks the same whether the rules
//     work or not.
//  2. Even told the truth, nothing checked the SHAPE after the move.
//     `configAfterMove` advances declared numbers and never moves a vertex,
//     so `isLegal` judges a configuration with the original geometry in it.
//     The module computed the neighbour stretching 10.00 -> 10.05 -- which IS
//     the diagonal, sqrt(10^2 + 1^2) -- and returned ok.
//
// A wall PERPENDICULAR to the one being dragged just gets longer and stays
// square, which is every neighbour in the square fixture. That is why this
// went unseen: the same blind spot as the -z-only nudge and the along-x-only
// wall, a third time. The fixture in front of me exercised one side.
const brokenRun = () => base({
  board: 'toy',
  walls: [
    ['n1', V(-10, -10), V(0, -10)], ['n2', V(0, -10), V(10, -10)],
    ['e', V(10, -10), V(10, 10)],
    ['s', V(10, 10), V(-10, 10)], ['w', V(-10, 10), V(-10, -10)],
  ].map(([id, start, end]) => ({ id, start, end, levelId: 3, view: 'plan',
    wallType: 'stud_2x6', baseHeight: 0, topHeight: 8, refLine: 'left' })),
});

const wallEnds = (page, id) => page.evaluate(async ({ bucket, wid }) => {
  const f = await window.SharedFileStore.loadSharedFile(bucket);
  const w = JSON.parse(await f.text()).walls.find(w => w.id === wid);
  return [w.start.x, w.start.z, w.end.x, w.end.z].map(n => Number(n.toFixed(4)));
}, { bucket: BUCKET, wid: id });

// A wall is square iff one of its two runs is zero. Asserting THE ANGLE, not
// a pair of coordinates: a check written as toEqual([...]) passes for any
// number of wrong-but-square results and fails for right-but-shifted ones,
// and the rule here is about squareness.
const squareRun = ([x1, z1, x2, z2]) =>
  Math.abs(x2 - x1) < 1e-6 || Math.abs(z2 - z1) < 1e-6;

test('TOY never leaves the next wall on an angle — by connector now, not refusal',
  async ({ page }) => {
    // THIS CHECK CHANGED ITS MECHANISM AND KEPT ITS CLAIM, which is the whole
    // point of writing down what a check is FOR.
    //
    // §3b found that TOY could draw a diagonal: seeded with a run already
    // broken into two collinear walls, dragging one half gave
    // `n2: (0,-11) -> (10,-10)` with an empty strip. The fix then was to
    // REFUSE the drag, and this check asserted the refusal.
    //
    // §4's connector supersedes that. The drag is now permitted and the
    // collinear corner is unshared, so the neighbour is never bent and there
    // is nothing left to refuse. The rule §3b protects -- TOY NEVER LEAVES A
    // WALL ON AN ANGLE -- is unchanged; it is now kept by construction rather
    // than by refusal.
    //
    // So the check asserts the INVARIANT, not the mechanism. Had it kept
    // asserting "the strip says no", it would have gone red for an improvement
    // and told me the feature was broken.
    //
    // The module's own WOULD_ANGLE_NEIGHBOUR rule is still proven, directly,
    // in 'asked of the module, not of the page' below -- other callers reach
    // it without the page's connector.
    await open(page, brokenRun());
    const { at } = await frame(page);
    await nudge(page, [-5, -10], [-5, -11]);

    const walls = await wallsNamed(page);
    for (const w of walls) {
      expect(square([...w.s, ...w.e]),
        `${w.id} is square: (${w.s}) -> (${w.e})`).toBe(true);
    }
    // POSITIVE HALF: it actually moved. "nothing is angled" is satisfied by a
    // page that refuses every drag, which is what this file keeps warning
    // about and what the previous version of this check would now pass on.
    const n1 = walls.find(w => w.id === 'n1');
    expect([n1.s[1], n1.e[1]], 'and the wall the drafter dragged did move')
      .toEqual([-11, -11]);
  });

test('the same drag in DRAFTING is not refused — the angle rule is TOY only',
  async ({ page }) => {
    // THE LEAK, BOTH DIRECTIONS. DRAFTING's freedom is that a wall may sit off
    // axis; a rule that forbids a move for angling something would be exactly
    // the leak the foot-light order warns about, wearing a third coat. And it
    // is a positive assertion -- the wall MOVED -- because "DRAFTING was not
    // refused" is satisfied by a DRAFTING that cannot drag at all.
    await open(page, { ...brokenRun(), board: 'drafting' });
    const { at } = await frame(page);
    const [sx, sy] = at(-5, -10);
    await page.mouse.click(sx, sy);
    await page.waitForTimeout(80);
    await page.mouse.move(sx, sy);
    await page.mouse.down();
    const [ex, ey] = at(-5, -11);
    await page.mouse.move(ex, ey, { steps: 8 });
    await page.mouse.up();
    await page.waitForTimeout(150);
    await saveIt(page);
    expect(await wallZ(page, 'n1'),
      'DRAFTING moved the wall it was asked to move').toBe(-11);
  });

test('the ordinary square still drags — pinning the weld group did not freeze it',
  async ({ page }) => {
    // THE REGRESSION THE WELD PIN COULD HAVE CAUSED. Telling the module the
    // group is one wall makes every rule in it reachable for the first time,
    // so the ordinary case has to be re-proved rather than assumed: a room
    // minimum that was never consulted before could now refuse the drag that
    // every other check in this file depends on.
    await open(page, base({ board: 'toy' }));
    const { at } = await frame(page);
    const [sx, sy] = at(0, -10);
    await page.mouse.click(sx, sy);
    await page.waitForTimeout(80);
    await page.mouse.move(sx, sy);
    await page.mouse.down();
    const [ex, ey] = at(0, -11);
    await page.mouse.move(ex, ey, { steps: 8 });
    await page.mouse.up();
    await page.waitForTimeout(150);
    await saveIt(page);
    expect(await wallZ(page, 'n'), 'the square still moves a foot').toBe(-11);
    expect(squareRun(await wallEnds(page, 'e')),
      'and its perpendicular neighbour just got longer').toBe(true);
  });

test('the angle rule is TOY only — asked of the module, not of the page',
  async ({ page }) => {
    // THE CHECK BELOW THIS ONE CANNOT SEE THIS, and the gate said so: a mutant
    // dropping the module's `mode === MODE.TOY` guard SURVIVED it.
    //
    // It survived because in DRAFTING the page never calls the module at all
    // -- `board === 'toy' ? toyWallDelta(...) : null` -- so no guard inside
    // the module can change what DRAFTING does on this page. The check passes
    // because the path is ABSENT, not because the rule is TOY-only. That is
    // the same shape as "TOY must not leak into DRAFTING" passing with TOY
    // switched off entirely, which is the trap this file already carries a
    // note about, found again by the gate rather than by me.
    //
    // The module is shared -- the offline harnesses call it with MODE.DRAFTING
    // -- so the leak is real for other callers even though this page cannot
    // reach it. So it is asked of the module directly, and asserted BOTH ways:
    // the same drawing, the same wall, the same delta, refused in TOY and
    // permitted in DRAFTING. One verdict alone would be satisfied by a module
    // that refuses everything or permits everything.
    await open(page, brokenRun());
    const verdicts = await page.evaluate(() => {
      const T = window.DraftToyConstraints;
      const C = window.DraftToyContext;
      const V = (x, z) => ({ x, y: 0, z });
      const mk = (id, start, end) => ({ id, start, end, levelId: 3, view: 'plan',
        wallType: 'stud_2x6', baseHeight: 0, topHeight: 8, refLine: 'left' });
      const walls = [
        mk('n1', V(-10, -10), V(0, -10)), mk('n2', V(0, -10), V(10, -10)),
        mk('e', V(10, -10), V(10, 10)), mk('s', V(10, 10), V(-10, 10)),
        mk('w', V(-10, 10), V(-10, -10)),
      ];
      const ask = mode => {
        const ctx = C.gather({ walls: walls.map(w => ({ ...w })) });
        const v = T.allowedMove({ ...walls[0] }, -1,
          { ...ctx, mode, welds: [['n1']] });
        return { delta: v.delta, reason: v.reason || null };
      };
      return { toy: ask(T.MODE.TOY), drafting: ask(T.MODE.DRAFTING) };
    });
    expect(verdicts.toy.delta, 'TOY refuses the move that would angle n2').toBe(0);
    expect(verdicts.toy.reason, 'and names the angle').toBe('WOULD_ANGLE_NEIGHBOUR');
    expect(verdicts.drafting.delta, 'DRAFTING permits the very same move').toBe(-1);
    expect(verdicts.drafting.reason, 'with nothing to say about it').toBe(null);
  });

test('a press on the open end resumes the run instead of being refused',
  async ({ page }) => {
    // WHAT THE §2 REFUSAL WAS CATCHING BY MISTAKE, found three layers away: a
    // merged DRAFTING-era gestures check lost two of three walls, and the strip
    // said "finish or cancel the run you started".
    //
    // §2 asked "does this press continue the run?" with `sameSpot` at 1e-6 --
    // an EQUALITY test. It can never be true. TOY rounds a run's LENGTH, not
    // its coordinates (model-toy-board.spec.js:333 makes that a rule and warns
    // that a build doing the other one passes everything), so committing a
    // wall moves its end away from the pixel the drafter released on. Coming
    // back to carry on, the press is near the open end but not ON it, and the
    // run was refused.
    //
    // MY FIRST FIX WAS THE WRONG ONE and that merged check is what said so: I
    // rounded the first point to a foot mark, which gives whole-foot POSITIONS
    // and a fractional LENGTH -- exactly backwards, and exactly what it exists
    // to prevent. The fault was never where the point lands; it was asking an
    // equality question about a press. Pressing on the open end is now a grab
    // radius, like every other "did the drafter hit this" on the page.
    await open(page, base({ board: 'toy' }));
    const { at } = await frame(page);

    // First run: two clicks, tool down. One wall, so the bone is still open --
    // the format needs three points and §2 holds it back until then.
    await h.armWall(page);
    await page.mouse.click(...at(-6, -6));
    await page.mouse.click(...at(2, -6));
    await page.waitForTimeout(80);
    await h.disarmWall(page);                    // put the tool DOWN

    // Come back and carry on from the open end. Movie's ruling is that putting
    // the tool down does NOT cancel the run, so this must be a continuation.
    await h.armWall(page);
    await page.mouse.click(...at(2, -6));
    await page.mouse.click(...at(2, -1));
    await page.waitForTimeout(100);

    await expect(page.locator('#strip-message'),
      'the refusal did NOT fire on a press that continues the run')
      .not.toContainText('finish or cancel');

    await saveIt(page);
    const drawn = await page.evaluate(async bucket => {
      const f = await window.SharedFileStore.loadSharedFile(bucket);
      const d = JSON.parse(await f.text());
      return (d.walls || []).filter(w => !['n', 'e', 's', 'w'].includes(w.id)).length;
    }, BUCKET);
    // THE POSITIVE HALF. "no refusal on the strip" is satisfied by a page that
    // never drew anything and never said anything -- the trap this file keeps
    // walking into. The second wall has to actually exist.
    expect(drawn, 'both walls were drawn, not just the first').toBe(2);
  });

// ── §4: BREAKING THE BONE ───────────────────────────────────────────────────
//
// Movie: "they will be allowed to 'BREAK the bone' every foot if they want to
// by clicking on it". The order's own reason: it "lets TOY draw a real house
// -- break the bone and the two halves move independently, so an L, a
// bump-out and a garage offset are all reachable".
//
// THE BREAK POINT IS MEASURED ALONG THE RUN, and that is not a detail. TOY
// rounds a run's LENGTH, never its coordinates -- model-toy-board.spec.js:333
// is the rule, and tonight I broke it once already by rounding a point's x and
// z to foot marks. A bone that starts off the foot has its foot marks at
// whole-foot DISTANCES from its start, so a break measured by rounding world
// coordinates lands somewhere that is not a mark on this bone at all.
const boneChoice = page => page.locator('[data-bone-choice]');

async function selectThen(page, at, spot) {
  const [x, y] = at(...spot);
  await page.mouse.click(x, y);          // select: wallBodyAt needs it
  await page.waitForTimeout(80);
  await page.mouse.click(x, y);          // click again: the choice
  await page.waitForTimeout(120);
}

const wallsNamed = page => page.evaluate(async bucket => {
  const f = await window.SharedFileStore.loadSharedFile(bucket);
  return (JSON.parse(await f.text()).walls || []).map(w => ({
    id: w.id,
    s: [Number(w.start.x.toFixed(4)), Number(w.start.z.toFixed(4))],
    e: [Number(w.end.x.toFixed(4)), Number(w.end.z.toFixed(4))],
  }));
}, BUCKET);

test('§4 — clicking a selected bone offers break here or move this wall',
  async ({ page }) => {
    await open(page, base({ board: 'toy' }));
    const { at } = await frame(page);
    await selectThen(page, at, [0, -10]);
    await expect(boneChoice(page), 'the choice is on screen').toBeVisible();
    await expect(boneChoice(page), 'and it names both ways out')
      .toContainText(/break/i);
    await expect(boneChoice(page)).toContainText(/move/i);
  });

test('§4 — BREAK HERE splits the wall at the foot mark that was clicked',
  async ({ page }) => {
    await open(page, base({ board: 'toy' }));
    const { at } = await frame(page);
    const before = (await wallsNamed(page)).length;
    // The north wall runs (-10,-10) -> (10,-10). Click 13.4 ft along it, so
    // the mark is at 13 ft -> x = -10 + 13 = 3. A click ON a whole foot would
    // pass whether the rounding happens or not.
    await selectThen(page, at, [3.4, -10]);
    await boneChoice(page).locator('[data-break-here]').click();
    await page.waitForTimeout(120);
    await saveIt(page);

    const walls = await wallsNamed(page);
    expect(walls.length, 'one wall became two').toBe(before + 1);
    const halves = walls.filter(w => w.s[1] === -10 && w.e[1] === -10
      && Math.min(w.s[0], w.e[0]) >= -10 && Math.max(w.s[0], w.e[0]) <= 10);
    expect(halves.length, 'the north run is two walls now').toBe(2);
    const xs = halves.flatMap(w => [w.s[0], w.e[0]]).sort((a, b) => a - b);
    expect(xs, 'sharing the clicked foot mark at x=3').toEqual([-10, 3, 3, 10]);
  });

test('§4 — the mark is measured ALONG THE RUN, not by rounding coordinates',
  async ({ page }) => {
    // THE CHECK THAT SEPARATES THE TWO RULES, and nothing else here can.
    // On the square fixture every corner is a whole foot, so "round the
    // distance along the run" and "round the coordinate" agree everywhere --
    // the same blind spot model-toy-board.spec.js:333 warns about. So this
    // bone starts at x = -10.4: its foot marks are at -9.4, -8.4, ... and a
    // coordinate-rounding build puts the break on a whole x instead.
    await open(page, base({
      board: 'toy',
      walls: [
        ['n', V(-10.4, -10), V(9.6, -10)], ['e', V(9.6, -10), V(9.6, 10)],
        ['s', V(9.6, 10), V(-10.4, 10)], ['w', V(-10.4, 10), V(-10.4, -10)],
      ].map(([id, start, end]) => ({ id, start, end, levelId: 3, view: 'plan',
        wallType: 'stud_2x6', baseHeight: 0, topHeight: 8, refLine: 'left' })),
    }));
    const { at } = await frame(page);
    // Click 5.4 ft along the run -> the mark is 5 ft along -> x = -10.4 + 5.
    await selectThen(page, at, [-5, -10]);
    await boneChoice(page).locator('[data-break-here]').click();
    await page.waitForTimeout(120);
    await saveIt(page);

    const xs = (await wallsNamed(page))
      .filter(w => w.s[1] === -10 && w.e[1] === -10)
      .flatMap(w => [w.s[0], w.e[0]])
      .filter(x => x > -10.4 && x < 9.6);
    expect(xs.length, 'the run was broken once').toBe(2);
    expect(xs[0], 'the break sits a whole number of FEET ALONG THE RUN')
      .toBeCloseTo(-5.4, 6);
    expect(Number.isInteger(xs[0]),
      'and NOT on a rounded world coordinate').toBe(false);
  });

test('§4 — MOVE THIS WALL leaves the bone exactly as it was',
  async ({ page }) => {
    await open(page, base({ board: 'toy' }));
    const { at } = await frame(page);
    const before = await wallsNamed(page);
    await selectThen(page, at, [3.4, -10]);
    await boneChoice(page).locator('[data-break-move]').click();
    await page.waitForTimeout(120);
    await saveIt(page);
    expect(await wallsNamed(page),
      'choosing move broke nothing').toEqual(before);
    await expect(boneChoice(page), 'and the choice went away').toBeHidden();
  });

test('§4 — DRAFTING never offers the choice', async ({ page }) => {
    await open(page, base({ board: 'drafting' }));
    const { at } = await frame(page);
    await selectThen(page, at, [0, -10]);
    await expect(boneChoice(page), 'no bone choice off the TOY board')
      .toBeHidden();
  });

// ── §4 ACCEPTANCE 7a: A BREAK ON A MASTERED LEVEL CUTS THE MASTER ───────────
//
// Movie, 14 Sep: "yes break master and all that area attached to it locked to
// it". I built this BACKWARDS first -- `if (o.masterId) continue`, "a master's
// copy is not ours to cut" -- and every check I had written passed, because
// all of them draw ONE unmastered bone. The order names the cost exactly: the
// first house drawn is master-derived, so refusing the break there makes the
// very first bone anyone wants to cut the one bone that will not cut.
//
// THE ORDER ALSO WRITES THIS CHECK'S FAILURE MODE FOR ME: "a check that only
// looks at the floor that was clicked passes with the propagation deleted, and
// this order has produced four of those in one day." So floors 1 and 3 and the
// master are asserted, and the clicked floor is the least interesting of them.
const OUT = (id, levelId, masterId, pts) => ({
  id, levelId, masterId, garage: false, open: false, detached: false,
  foundation: null, overriddenSrcIds: [],
  points: pts.map(([x, z]) => ({ x, y: 0, z, srcId: null, offX: 0, offZ: 0 })),
});
const RING = [[-10, -10], [10, -10], [10, 10], [-10, 10]];

const threeStorey = () => base({
  board: 'toy',
  levels: [{ id: 3, name: 'MAIN FL', elev: 0 },
    { id: 4, name: '2ND FL', elev: 9 }, { id: 5, name: '3RD FL', elev: 18 }],
  boneyardOutlines: [OUT('master-1', null, null, RING)],
  outlines: [
    OUT('lvl-3', 3, 'master-1', RING),
    OUT('lvl-4', 4, 'master-1', RING),
    OUT('lvl-5', 5, 'master-1', RING),
  ],
});

const ringOf = (page, id, where) => page.evaluate(async ({ bucket, oid, w }) => {
  const f = await window.SharedFileStore.loadSharedFile(bucket);
  const d = JSON.parse(await f.text());
  const list = w === 'master' ? (d.boneyardOutlines || []) : (d.outlines || []);
  const o = list.find(x => String(x.id) === oid);
  return o ? (o.points || []).map(p => [Number(p.x.toFixed(4)), Number(p.z.toFixed(4))]) : null;
}, { bucket: BUCKET, oid: id, w: where });

test('§4 7a — a break on a mastered level cuts the master and every level on it',
  async ({ page }) => {
    await open(page, threeStorey());
    const { at } = await frame(page);
    await selectThen(page, at, [3.4, -10]);
    await boneChoice(page).locator('[data-break-here]').click();
    await page.waitForTimeout(150);
    await saveIt(page);

    const mark = [3, -10];
    const has = ring => !!ring && ring.some(p => p[0] === mark[0] && p[1] === mark[1]);

    // THE CLICKED FLOOR IS THE LEAST INTERESTING ASSERTION HERE -- it passes
    // with the propagation deleted, which is the check the order warns about.
    expect(has(await ringOf(page, 'lvl-3', 'level')),
      'the floor that was clicked took the cut').toBe(true);
    // THESE ARE THE ONES THAT MATTER.
    expect(has(await ringOf(page, 'master-1', 'master')),
      'the MASTER took the cut').toBe(true);
    expect(has(await ringOf(page, 'lvl-4', 'level')),
      'and floor 2, which nobody clicked').toBe(true);
    expect(has(await ringOf(page, 'lvl-5', 'level')),
      'and floor 3').toBe(true);

    // AND IT IS A JOINT, NOT A RESHAPE: one point gained, the corners kept.
    const lvl4 = await ringOf(page, 'lvl-4', 'level');
    expect(lvl4.length, 'exactly one point was added').toBe(RING.length + 1);
    for (const corner of RING) {
      expect(lvl4.some(p => p[0] === corner[0] && p[1] === corner[1]),
        `the original corner ${corner} is still there`).toBe(true);
    }
    // WHERE IT SITS IN THE RING, which is the whole of "joint, not reshape"
    // and which everything above is blind to. A mutant that APPENDED the mark
    // survived all of it: the ring still has five points, still has every
    // corner, still has the mark. It is a different POLYGON -- a spike
    // doubling back -- and only the ORDER says so.
    //
    // Third time tonight that a check tested membership when the claim was
    // about structure.
    const k = lvl4.findIndex(p => p[0] === mark[0] && p[1] === mark[1]);
    const before = lvl4[(k - 1 + lvl4.length) % lvl4.length];
    const after = lvl4[(k + 1) % lvl4.length];
    expect([before, after],
      'the mark sits BETWEEN the two corners of the wall that was cut')
      .toEqual([[-10, -10], [10, -10]]);
  });

test('§4 — a click near a corner breaks at the first mark IN, never at the corner',
  async ({ page }) => {
    // THE GATE ASKED FOR THIS ONE. A mutant removing the clamp -- so `feet` is
    // a bare Math.round(along) -- survived every §4 check, because all of them
    // click near the MIDDLE of a wall where clamped and unclamped agree. The
    // clamp only does anything at the ends.
    //
    // It matters: rounded to 0 the break lands ON the start corner and makes a
    // zero-length half, which drawing-format drops on load -- the silent loss
    // this page has been bitten by twice.
    //
    // A SMALLER HOUSE, NOT A ZOOM, and that took three runs to arrive at.
    // VERTEX BEATS BODY: cornerAt owns everything within CORNER_GRAB_PX (30px)
    // / view.scale, so the press must be further from the corner than that and
    // still under half a foot along, or Math.round never reaches 0. Widening
    // the gap by zooming failed twice -- the wheel keeps the point under the
    // CURSOR fixed, so it drifts view.cx, and frame()'s at() assumes the origin
    // is at the canvas centre; after one wheel tick every coordinate it
    // returns is wrong, and the press lands on nothing.
    //
    // fit() scales to the drawn bounds, so a smaller house fits at a larger
    // scale and the corner's grip shrinks in FEET. No view state is touched
    // and at() stays true. A five-foot house still left the corner owning
    // 0.484 ft, hence this one.
    await open(page, base({
      board: 'toy',
      walls: [
        ['n', V(-2.5, -2.5), V(2.5, -2.5)], ['e', V(2.5, -2.5), V(2.5, 2.5)],
        ['s', V(2.5, 2.5), V(-2.5, 2.5)], ['w', V(-2.5, 2.5), V(-2.5, -2.5)],
      ].map(([id, start, end]) => ({ id, start, end, levelId: 3, view: 'plan',
        wallType: 'stud_2x6', baseHeight: 0, topHeight: 8, refLine: 'left' })),
    }));
    const scale = await page.evaluate(() => Number(
      /scale ([\d.]+) px\/ft/.exec(document.getElementById('readout').textContent)[1]));
    const grabFt = 30 / scale;
    expect(grabFt, `at ${scale} px/ft the corner owns ${grabFt.toFixed(3)} ft; `
      + 'it must own under half a foot or the clamp cannot be reached')
      .toBeLessThan(0.44);
    // Clear of the corner's grip, still under the half foot where Math.round
    // drops to zero -- the only window in which the clamp does anything.
    const offset = grabFt + (0.49 - grabFt) / 2;
    const { at } = await frame(page);
    await selectThen(page, at, [-2.5 + offset, -2.5]);
    await expect(boneChoice(page),
      `at ${offset.toFixed(3)} ft from the corner the press grabs the BODY`)
      .toBeVisible();
    await boneChoice(page).locator('[data-break-here]').click();
    await page.waitForTimeout(120);
    await saveIt(page);

    const walls = await wallsNamed(page);
    const run = walls.filter(w => w.s[1] === -2.5 && w.e[1] === -2.5);
    expect(run.length, 'the wall was broken').toBe(2);
    const xs = run.flatMap(w => [w.s[0], w.e[0]]).sort((a, b) => a - b);
    expect(xs, 'broken one foot IN, not on the corner at -2.5')
      .toEqual([-2.5, -1.5, -1.5, 2.5]);
    // AND NO NULL HALF, the failure the clamp exists to prevent.
    for (const w of walls) {
      expect(Math.hypot(w.e[0] - w.s[0], w.e[1] - w.s[1]),
        `wall ${w.id} has a real length`).toBeGreaterThan(1e-6);
    }
  });

// ── §4 SECOND HALF: THE CONNECTOR ───────────────────────────────────────────
//
// "After a break the two halves are independent bones and each obeys §3", and
// they are not independent yet. Break a run and drag one half and §3b refuses
// it -- correctly, because the halves are COLLINEAR and dragging one swings
// the other. Safe, but the L and the bump-out the order names as the point of
// §4 are unreachable.
//
// What makes them reachable is the drag SPLITTING the shared corner and
// growing a connector wall between the old corner and the new one. That
// connector IS the side of the bump-out. Nothing is angled, so §3b has nothing
// to refuse.
const brokenAt = x => base({
  board: 'toy',
  walls: [
    ['n1', V(-10, -10), V(x, -10)], ['n2', V(x, -10), V(10, -10)],
    ['e', V(10, -10), V(10, 10)],
    ['s', V(10, 10), V(-10, 10)], ['w', V(-10, 10), V(-10, -10)],
  ].map(([id, start, end]) => ({ id, start, end, levelId: 3, view: 'plan',
    wallType: 'stud_2x6', baseHeight: 0, topHeight: 8, refLine: 'left' })),
});

const square = ([x1, z1, x2, z2]) =>
  Math.abs(x2 - x1) < 1e-6 || Math.abs(z2 - z1) < 1e-6;

test('§4 — dragging one half of a broken run grows a connector, not a diagonal',
  async ({ page }) => {
    await open(page, brokenAt(0));
    const { at } = await frame(page);
    await nudge(page, [-5, -10], [-5, -11]);

    const walls = await wallsNamed(page);
    for (const w of walls) {
      expect(square([...w.s, ...w.e]),
        `${w.id} is still square: (${w.s}) -> (${w.e})`).toBe(true);
    }
    // THE HALF THAT MOVED, AND THE HALF THAT DID NOT. Asserting only the
    // mover passes an implementation that drags both, which is the state
    // before any of this.
    const n1 = walls.find(w => w.id === 'n1');
    const n2 = walls.find(w => w.id === 'n2');
    expect([n1.s[1], n1.e[1]], 'the dragged half went out one foot')
      .toEqual([-11, -11]);
    expect([n2.s[1], n2.e[1]], 'the other half stayed exactly where it was')
      .toEqual([-10, -10]);

    // AND THE SIDE OF THE BUMP-OUT EXISTS. Without it the two halves are
    // simply disconnected and the house has a one-foot gap in its wall -- a
    // state that looks fine in a wall count and is not a building.
    const joiner = walls.find(w => !['n1', 'n2', 'e', 's', 'w'].includes(w.id));
    expect(joiner, 'a connector wall was made').toBeTruthy();
    const ends = [joiner.s, joiner.e].sort((a, b) => a[1] - b[1]);
    expect(ends, 'it runs from the new corner back to the old one')
      .toEqual([[0, -11], [0, -10]]);
  });

test('§4 — an ordinary drag makes no connector: the neighbours just stretch',
  async ({ page }) => {
    // THE OTHER SIDE OF THE BRANCH, and §3's whole behaviour. On the plain
    // square a wall's neighbours are PERPENDICULAR: they lengthen and stay
    // square, and splitting a corner there would leave a spurious zero-length
    // wall in the drawing on every single drag.
    await open(page, base({ board: 'toy' }));
    const before = (await wallsNamed(page)).length;
    await nudge(page, [0, -10], [0, -11]);
    const walls = await wallsNamed(page);
    expect(walls.length, 'no wall was added').toBe(before);
    const e = walls.find(w => w.id === 'e');
    expect(square([...e.s, ...e.e]),
      'the perpendicular neighbour just got longer').toBe(true);
  });

// ── §5: A ROOF OVER WHATEVER NOTHING SITS ON ────────────────────────────────
//
// Movie, 14 Sep: "the highest floor bone should also control the roof bone so
// the roof will change, additionally, if a main floor is added a roof should
// be added on it at the lower level if the 2nd floor doesn't cover it, or also
// if the 2nd floor is pulled back a main floor roof should cover the open
// ceiling."
//
// So the roof is a FUNCTION of the difference between a storey's footprint and
// the one above it, recomputed when either bone moves -- not a thing attached
// to the top storey. A ranch is the degenerate case: nothing above, so the
// whole floor is uncovered.
const roofsOf = page => page.evaluate(async bucket => {
  const f = await window.SharedFileStore.loadSharedFile(bucket);
  return (JSON.parse(await f.text()).roofs || []).map(r => ({
    levelId: r.levelId,
    from: r.sourceShapeId || null,
    edges: r.edges,
    pitch: r.pitch,
    box: [Math.min(...r.points.map(p => p.x)), Math.min(...r.points.map(p => p.z)),
      Math.max(...r.points.map(p => p.x)), Math.max(...r.points.map(p => p.z))],
  }));
}, BUCKET);

const twoStorey = (upperZ) => base({
  board: 'toy',
  levels: [{ id: 3, name: 'MAIN FL', elev: 0 }, { id: 4, name: '2ND FL', elev: 9 }],
  outlines: [
    OUT('main-1', 3, null, [[-10, -10], [10, -10], [10, 10], [-10, 10]]),
    OUT('up-1', 4, null, [[-10, -10], [10, -10], [10, upperZ], [-10, upperZ]]),
  ],
});

test('§5 — a storey pulled back leaves a roof over the ceiling it opened',
  async ({ page }) => {
    // THE DRAG PULLS THE FLOOR IN, not out, and that is not cosmetic. Dragging
    // it OUTWARD opens a second strip -- the new foot of floor beyond the
    // storey above -- so the answer is two roofs, which is correct and was not
    // what this check said. It only ever read as one because a bug in
    // boneFollows was dragging the upper storey's bone along with the lower's.
    await open(page, twoStorey(0));
    const { at } = await frame(page);
    await nudge(page, [0, 10], [0, 9]);         // move a bone: roofs rebuild

    const roofs = (await roofsOf(page)).filter(r => r.levelId === 3);
    expect(roofs.length, 'the main floor took a roof').toBe(1);
    expect(roofs[0].box, 'over exactly the part the 2nd floor does not cover')
      .toEqual([-10, 0, 10, 9]);
  });

test('§5 — a ranch takes one roof over the whole floor', async ({ page }) => {
    await open(page, base({
      board: 'toy',
      outlines: [OUT('main-1', 3, null, [[-10, -10], [10, -10], [10, 10], [-10, 10]])],
    }));
    const { at } = await frame(page);
    await nudge(page, [0, -10], [0, -11]);
    const roofs = (await roofsOf(page)).filter(r => r.levelId === 3);
    expect(roofs.length, 'one roof').toBe(1);
    // The north bone moved out a foot, so the floor -- and its roof -- grew.
    expect(roofs[0].box, 'over the whole floor as it now stands')
      .toEqual([-10, -11, 10, 10]);
  });

test('§5 — the roof comes up HIPPED, and only the shared edge is a gable',
  async ({ page }) => {
    // "make the roofs cottage default and switchable to gable", and the format
    // already does it: an edge is `gable` only if it says so, otherwise eave.
    // Cottage-by-default is behaviour to NOT BREAK rather than a feature.
    //
    // The one exception is ruled: the edge where the lower roof meets the
    // storey above is a GABLE -- it dies into that wall and must not carry an
    // eave's 2ft overhang, which would drive straight into the house.
    await open(page, twoStorey(0));
    const { at } = await frame(page);
    await nudge(page, [0, -10], [0, -11]);

    const roof = (await roofsOf(page)).find(r => r.levelId === 3);
    expect(roof, 'the roof exists').toBeTruthy();
    expect(roof.pitch, 'pitch 4 -- the 4/12 the format already defaults to').toBe(4);
    const gables = roof.edges.filter(e => e === 'gable').length;
    expect(gables, 'exactly one edge is a gable').toBe(1);
    expect(roof.edges.filter(e => e === 'eave').length,
      'and the other three are eaves -- hipped, not gabled all round').toBe(3);
  });

test('§5 — a floor pulled back under its storey loses the roof it had',
  async ({ page }) => {
    // THE REMOVAL, which nothing else asserts: "a roof appears" is satisfied
    // by an implementation that only ever adds, and the order says plainly
    // "push it back out and that roof goes again".
    //
    // ONE DRAG, ON A SYMMETRIC FIXTURE, and both of those were learned the
    // hard way. Two drags left the wall selected so §4's choice opened
    // mid-gesture; adding a reload between them made it worse, because after
    // the first drag the drawing is no longer symmetric about the origin and
    // fit() re-centres on the midpoint of DRAWN BOUNDS -- the trap written at
    // the top of this file -- so every click afterwards lands half a foot out.
    //
    // THE ROOF IS SEEDED, so this asserts REMOVAL rather than absence. A check
    // that drags and finds no roof passes a page that never made one.
    await open(page, base({
      board: 'toy',
      levels: [{ id: 3, name: 'MAIN FL', elev: 0 }, { id: 4, name: '2ND FL', elev: 9 }],
      walls: [
        ['n', V(-11, -11), V(11, -11)], ['e', V(11, -11), V(11, 11)],
        ['s', V(11, 11), V(-11, 11)], ['w', V(-11, 11), V(-11, -11)],
      ].map(([id, start, end]) => ({ id, start, end, levelId: 3, view: 'plan',
        wallType: 'stud_2x6', baseHeight: 0, topHeight: 8, refLine: 'left' })),
      outlines: [
        OUT('main-1', 3, null, [[-11, -11], [11, -11], [11, 11], [-11, 11]]),
        OUT('up-1', 4, null, [[-11, -11], [11, -11], [11, 10], [-11, 10]]),
      ],
      roofs: [{ id: 'roof-seed', levelId: 3, sourceLevelId: 4,
        sourceShapeId: 'main-1', overhang: 2, pitch: 4, garage: false,
        edges: ['gable', 'eave', 'eave', 'eave'],
        points: [{ x: -11, y: 0, z: 10 }, { x: 11, y: 0, z: 10 },
          { x: 11, y: 0, z: 11 }, { x: -11, y: 0, z: 11 }] }],
    }));
    expect((await roofsOf(page)).filter(r => r.levelId === 3).length,
      'the fixture really carries the roof this check removes').toBe(1);

    await nudge(page, [0, 11], [0, 10]);        // pull the floor back under

    expect((await roofsOf(page)).filter(r => r.levelId === 3).length,
      'covered again, so the roof goes').toBe(0);
  });

test('§5 — dragging one floor does not reshape the storey above it',
  async ({ page }) => {
    // THE FAULT MY OWN FIRST FIX INTRODUCED, and the gate caught that nothing
    // watched for it coming back.
    //
    // boneFollows matches outline points by POSITION, because an outline point
    // is a plain record and the wall holds a pooled vertex -- where they sit
    // is the only thing connecting them. The first version walked EVERY
    // outline, and storeys stacked on one footprint have points at identical
    // coordinates, so dragging the main floor's wall silently dragged the
    // second floor's bone with it.
    //
    // THE SHARED EDGE IS THE WHOLE POINT OF THIS FIXTURE. §5's other checks
    // drag the SOUTH wall, where the upper storey (pulled back to z=0) has no
    // point at all -- so the bug is invisible to them and the mutant survived
    // every one. This drags the NORTH wall, which both storeys share.
    //
    // And it asserts the UPPER BONE directly rather than a roof downstream of
    // it: the rule is about what a drag may touch, so that is what is read.
    await open(page, twoStorey(0));
    const before = await page.evaluate(async bucket => {
      const f = await window.SharedFileStore.loadSharedFile(bucket);
      const o = (JSON.parse(await f.text()).outlines || [])
        .find(x => String(x.id) === 'up-1');
      return o.points.map(p => [p.x, p.z]);
    }, BUCKET);
    expect(before.some(p => p[1] === -10),
      'the fixture really shares the north edge, or this proves nothing')
      .toBe(true);

    await nudge(page, [0, -10], [0, -11]);      // the shared edge

    const after = await page.evaluate(async bucket => {
      const f = await window.SharedFileStore.loadSharedFile(bucket);
      const o = (JSON.parse(await f.text()).outlines || [])
        .find(x => String(x.id) === 'up-1');
      return o.points.map(p => [p.x, p.z]);
    }, BUCKET);
    expect(after, 'the storey above is exactly where it was').toEqual(before);

    // AND THE FLOOR REALLY MOVED -- "the upper is unchanged" is satisfied by a
    // page where the drag did nothing at all.
    const main = await page.evaluate(async bucket => {
      const f = await window.SharedFileStore.loadSharedFile(bucket);
      const o = (JSON.parse(await f.text()).outlines || [])
        .find(x => String(x.id) === 'main-1');
      return Math.min(...o.points.map(p => p.z));
    }, BUCKET);
    expect(main, 'while the floor that was dragged did move').toBe(-11);
  });
