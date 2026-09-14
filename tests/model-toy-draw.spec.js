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

async function armWall(page) {
  const armed = await page.locator('[data-draw-wall]')
    .evaluate(el => el.classList.contains('armed'));
  if (!armed) await page.locator('[data-draw-wall]').click();
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
  await armWall(page);
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
  await armWall(page);
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
  await armWall(page);
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
    await armWall(page);
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
  await armWall(page);
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
  await page.locator('[data-draw-wall]').click();
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
    await armWall(page);
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
  await armWall(page);
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
    await armWall(page);
    for (const [x, z] of [[0, 0], [10, 0], [10, 6], [0, 6]]) {
      await page.mouse.click(...at(x, z));
      await page.waitForTimeout(60);
    }
    // Away from the house, and not touching it: the run starts where nothing
    // ended, which is what makes it a second footprint.
    await page.locator('[data-draw-wall]').click();   // put the chain down
    await page.waitForTimeout(60);
    await page.locator('[data-draw-wall]').click();
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
  await armWall(page);
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
  await armWall(page);
  await page.mouse.click(...at(0, 0));
  await page.waitForTimeout(60);
  await page.mouse.click(...at(6, 0));       // two taps: a run, not yet a shape
  await page.waitForTimeout(60);
  await page.locator('[data-draw-wall]').click();
  await page.waitForTimeout(60);
  await page.locator('[data-draw-wall]').click();

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
  await armWall(page);
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
  await expect(page.locator('#strip-message')).toContainText(/cannot|angled|not/i);

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

    // THE HALF-INCH IS GIVEN UP ONCE, ON THE WALL THAT WAS MOVED.
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
