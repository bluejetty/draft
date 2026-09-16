// Shared helpers for the Model Space specs.
//
// The page keeps no test hook on the component, so everything here works the
// way a user does: click in the canvas, then read the drawing back out of the
// same IndexedDB bucket the app saves to.
const { expect } = require('@playwright/test');

const HALF_HEIGHT_FT = 25;          // default ortho half-height in _init()
const STORAGE_BUCKET = 'model-drawing';

async function openModel(page, {
  webgl = true, rails = true, boneWallet = true, boneReveal = false, autoStairs = false, roomGrow = false,
  autoWindows = false, entryCoach = false, search = '',
  // PARKED FEATURES, opt IN (Movie, 2 Sep). The tour escort and the entry
  // performance notice are switched off for every drafter, so they are off
  // here too -- but the code is still in the file, so the specs that cover it
  // turn it back on rather than being deleted. A parked feature with no
  // coverage is one flag from shipping with nothing watching it.
  tourEscort = false, perfNotice = false,
} = {}) {
  // Init scripts run on every navigation, so the flag keeps a reload inside a
  // test from wiping the drawing the test just made. The FAT TEST WALLET
  // (board #261): every spec gets 999 bones so bone-count never becomes a
  // hidden constraint on unrelated tests — bone-wallet.spec.js opts out
  // (boneWallet: false) to test the real 3-bone / drip / cap behavior.
  await page.addInitScript(seedWallet => {
    if (sessionStorage.getItem('draft-test-storage-cleared')) return;
    sessionStorage.setItem('draft-test-storage-cleared', '1');
    indexedDB.deleteDatabase('pdf-img-mgr-shared');
    localStorage.clear();
    if (seedWallet) {
      localStorage.setItem('draft-bone-wallet',
        JSON.stringify({ balance: 999, lastDripAt: Date.now(), createdAt: Date.now() }));
    }
  }, boneWallet);
  // The bone reveal (board #283) jumps every successful BUILD HOUSE press to
  // the E1 elevation, STAIR SUGGESTIONS (board #260) place a phantom stair
  // under the tour and the bone, and ROOM GROWING (board #275) previews and
  // grows interior walls from stamps, and AUTO WINDOWS (board #169) deals
  // windows onto the exterior walls. The suite presses the bone and climbs
  // the tour as SETUP, so all four run seeded off; the feature specs opt
  // back in ({ boneReveal: true } / { autoStairs: true } / { roomGrow:
  // true } / { autoWindows: true }), each exercising the real default-on
  // path.
  if (!boneReveal || !autoStairs || !roomGrow || !autoWindows || tourEscort || perfNotice) {
    await page.addInitScript(seed => {
      const key = 'draft-active-package:settings';
      let pkg = null;
      try { pkg = JSON.parse(localStorage.getItem(key) || 'null'); } catch { pkg = null; }
      if (!pkg || pkg.format !== 'draft-profile-package' || pkg.kind !== 'settings') {
        pkg = { format: 'draft-profile-package', version: 1, kind: 'settings', name: 'test-seed', createdAt: new Date().toISOString(), content: { model: {} } };
      }
      if (!pkg.content || typeof pkg.content !== 'object') pkg.content = {};
      if (!pkg.content.model || typeof pkg.content.model !== 'object') pkg.content.model = {};
      // Only seed when unset, so a spec that flips the setting keeps its
      // choice across reloads.
      if (seed.boneReveal && !('boneReveal' in pkg.content.model)) pkg.content.model.boneReveal = false;
      if (seed.suggestStairs && !('suggestStairs' in pkg.content.model)) pkg.content.model.suggestStairs = false;
      if (seed.roomGrow && !('roomGrow' in pkg.content.model)) pkg.content.model.roomGrow = false;
      if (seed.autoWindows && !('autoWindows' in pkg.content.model)) pkg.content.model.autoWindows = false;
      // These two are the other way round: default OFF in the app, so a spec
      // that wants them says so and everything else inherits the drafter's
      // experience unchanged.
      if (seed.tourEscort) pkg.content.model.tourEscort = true;
      if (seed.perfNotice) pkg.content.model.perfNoticeOn = true;
      localStorage.setItem(key, JSON.stringify(pkg));
    }, { boneReveal: !boneReveal, suggestStairs: !autoStairs, roomGrow: !roomGrow, autoWindows: !autoWindows,
         tourEscort, perfNotice });
  }
  // THE ENTRY COACH scrims the app a second after a first-ever open, and every
  // spec runs on a fresh profile -- so without this every one of them would
  // find its tools behind a tint. Seeded as ALREADY SEEN by default and opted
  // back into by entry-coach.spec.js, which exercises the real path.
  if (!entryCoach) {
    await page.addInitScript(() => {
      try { localStorage.setItem('draft-entry-coach-seen', '1'); } catch (err) { /* private window */ }
    });
  }
  if (!webgl) {
    await page.addInitScript(() => {
      const real = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (type, ...rest) {
        if (typeof type === 'string' && type.toLowerCase().includes('webgl')) return null;
        return real.call(this, type, ...rest);
      };
    });
  }
  // `search` opens the page with a query string. TOY MODE's temporary door is
  // a query flag until the real mode switch lands (turtle path step 5), so a
  // spec that needs it asks for it here rather than navigating by hand and
  // losing every init script above.
  await page.goto(`/MODEL.dc.html${search}`);
  await expect(page.locator('[data-model-canvas]')).toBeVisible();
  await waitForModelReady(page, { rails });
  return page.locator('[data-model-canvas]');
}

// Pulls out any still-hidden side rail by its edge tab (TOOLS / LEVELS).
async function openRails(page) {
  if (await page.locator('[data-left-rail-tab]').count() === 0) return;
  if (!(await page.locator('[data-model-left]').isVisible())) {
    await page.locator('[data-left-rail-tab]').click();
    await expect(page.locator('[data-model-left]')).toBeVisible();
  }
  if (!(await page.locator('[data-model-right]').isVisible())) {
    await page.locator('[data-right-rail-tab]').click();
    await expect(page.locator('[data-model-right]')).toBeVisible();
  }
}

// The app stamps data-model-ready on <body> once init and the initial
// drawing load finish — a condition wait instead of a fixed settle, so a
// slow machine waits longer and a fast one doesn't wait at all. Use after
// page.reload() too.
// The entry coach scrims the app one second after a FIRST-EVER open over an
// empty sheet. openModel seeds it away for every spec that does not ask for
// it; a spec that reaches MODEL by its own page.goto never passes through
// there, so it needs this before navigating. Deliberately NOT folded into
// waitForModelReady: a helper that dismissed the coach would make
// entry-coach.spec.js's "once, ever" assertions pass whatever the app did.
async function suppressEntryCoach(page) {
  await page.addInitScript(() => {
    try { localStorage.setItem('draft-entry-coach-seen', '1'); } catch (err) { /* private window */ }
  });
}

async function waitForModelReady(page, { rails = true } = {}) {
  await page.waitForFunction(() => document.body.dataset.modelReady === '1');
  // THE PERF-NOTICE CLICK USED TO LIVE HERE, AND REMOVING IT IS THE FIX.
  //
  // It waited up to 2000ms for [data-perf-notice-continue]. While the notice
  // was on by default that click landed in milliseconds; once the notice was
  // parked (Movie, 2 Sep) it never appeared, so every call sat out the full
  // two seconds and swallowed the timeout. That window is longer than
  // Component.ENTRY_COACH_DELAY_MS (1000ms), so on a fresh profile the entry
  // coach scrim went up mid-wait and then intercepted the rail-tab click
  // below -- five specs on CI, none of them ones this branch touched.
  //
  // main was not passing because it was right; it was passing because the
  // notice happened to close the window before the coach opened it. The fix
  // is to delete the race rather than re-tune it: a shorter timeout would
  // restore the luck and fail again on a slower runner.
  //
  // Nothing is lost. perf-notice.spec.js is the only spec that turns the
  // notice on, and it opens raw precisely BECAUSE this helper would dismiss
  // it -- so for every caller here the notice is off and there was nothing to
  // click.
  //
  // THAT IS A DEPENDENCY, SO IT IS WRITTEN DOWN: this helper is correct only
  // while perfNoticeOn defaults FALSE. If that default is ever flipped back,
  // the notice starts covering the build cluster again and this must dismiss
  // it once more -- and the failure will look like a mysterious intercepted
  // click rather than a settings change, which is the twenty minutes this
  // cost tonight. Gilligan's flag, 3 Sep.
  //
  // Both side rails start tucked behind their pull tabs (#242); nearly every
  // spec works the rails, so pull them out unless the test opts out.
  if (rails) await openRails(page);
}

// Top view keeps the camera at the origin, so feet map to pixels linearly.
async function worldToClient(page, x, z) {
  const box = await page.locator('[data-model-canvas]').boundingBox();
  const ppf = box.height / (2 * HALF_HEIGHT_FT);
  return { x: box.x + box.width / 2 + x * ppf, y: box.y + box.height / 2 + z * ppf };
}

// WHERE THE 2D PLAN PUTS A WORLD POINT, asked of the page instead of guessed.
//
// Every spec that presses on MODEL.html's #plan used to rebuild the mapping
// itself: read `scale N px/ft` out of the readout, then add x*scale to the
// middle of the canvas box. The scale half is fine. The middle half is a
// GUESS -- that the view is centred on world 0,0 -- and it is only true for a
// fixture symmetric about the origin. fit() centres on the MIDPOINT OF THE
// DRAWN BOUNDS, so a plan running z from -8.37 to 8 sits at z=-0.185 and every
// press aimed by the guess lands 0.185*scale pixels off: ~7px at the usual
// zoom. Those presses hit anyway for as long as the hit tolerance covered the
// error and the canvas under them was bare -- and stopped the day the
// instrument strip grew 10px and took the band they were landing in.
//
// The page now publishes the camera on the canvas as `data-view` ("cx cz
// scale"), written by paint(). This reads it. There is no arithmetic here
// that MODEL.html does not already own -- which is the point: a second copy
// is how the two drift, and the drift is exactly what cost #401 a shard.
async function planFrame(page) {
  const box = await page.locator('#plan').boundingBox();
  const view = await page.locator('#plan').getAttribute('data-view');
  // No attribute means paint() has not run, not "assume the origin". Say so:
  // the silent fallback is the bug class this helper exists to end.
  if (!view) throw new Error('#plan carries no data-view — has the page painted?');
  const [cx, cz, scale] = view.trim().split(/\s+/).map(Number);
  if (![cx, cz, scale].every(Number.isFinite) || !(scale > 0)) {
    throw new Error(`#plan data-view is not three numbers: ${JSON.stringify(view)}`);
  }
  const at = (x, z) => [box.x + box.width / 2 + (x - cx) * scale,
    box.y + box.height / 2 + (z - cz) * scale];
  return { at, cx, cz, scale, box };
}

// WHERE THE MODEL.dc.html PLAN PUTS A WORLD POINT, asked of the page.
// Companion to planFrame above, which does this for MODEL.html's #plan.
//
// worldToClient is the older, FIXED-camera version of this same question: it
// reads box.height / (2 * HALF_HEIGHT_FT) and places world 0,0 at the middle
// of the canvas. Both halves are true at the page's opening defaults and both
// stop being true the moment a spec pans or zooms -- so a spec that MOVES the
// view cannot use it to ask where anything is, and a spec that wants to know
// whether the view moved has nothing to read at all. This reads the camera the
// page publishes instead.
async function modelFrame(page) {
  const canvas = page.locator('[data-model-canvas]');
  const box = await canvas.boundingBox();
  const view = await canvas.getAttribute('data-view');
  // No attribute is not "assume the origin". It means the PLAN is not what is
  // on screen -- an elevation, a section or 3D -- or that no frame has painted
  // yet. Say which, loudly; the silent fallback is the bug class both this and
  // planFrame exist to end.
  if (!view) {
    throw new Error('[data-model-canvas] carries no data-view '
      + '\u2014 is the PLAN view open, and has the page painted?');
  }
  const [cx, cz, scale] = view.trim().split(/\s+/).map(Number);
  if (![cx, cz, scale].every(Number.isFinite) || !(scale > 0)) {
    throw new Error(`[data-model-canvas] data-view is not three numbers: ${JSON.stringify(view)}`);
  }
  const at = (x, z) => ({ x: box.x + box.width / 2 + (x - cx) * scale,
    y: box.y + box.height / 2 + (z - cz) * scale });
  return { at, cx, cz, scale, box };
}

async function moveTo(page, x, z) {
  const p = await worldToClient(page, x, z);
  await page.mouse.move(p.x, p.y);
}

async function clickWorld(page, x, z) {
  await moveTo(page, x, z);
  const p = await worldToClient(page, x, z);
  // Synthetic pointer events keep the fractional client coordinates the
  // hardware mouse rounds away, so a click on (5, 5) lands on exactly (5, 5).
  await page.evaluate(({ cx, cy }) => {
    // A real canvas press moves focus off the toolbar; without this the
    // focused button would swallow the keyboard shortcuts that follow.
    if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur();
    const canvas = document.querySelector('[data-model-canvas]');
    // POINTER names, matching the canvas listeners (audit C2). These were
    // already PointerEvent objects carrying MOUSE event names — that mismatch
    // is the one thing which had to change in step with the app, and it is the
    // only thing that did. Coordinates, ordering, the blur above and the 400ms
    // settle below are untouched: this helper's contract is what ~550 specs
    // are written against.
    //
    // pointerId 1 is what Chromium gives a real mouse, so these agree with the
    // genuine pointermove `moveTo` just sent through page.mouse — the canvas
    // sees one pointer, claims it on down, releases it on up.
    const opts = {
      bubbles: true, cancelable: true, view: window,
      clientX: cx, clientY: cy, button: 0, pointerId: 1, isPrimary: true,
    };
    canvas.dispatchEvent(new PointerEvent('pointermove', { ...opts, buttons: 0 }));
    canvas.dispatchEvent(new PointerEvent('pointerdown', { ...opts, buttons: 1 }));
    window.dispatchEvent(new PointerEvent('pointerup', { ...opts, buttons: 0 }));
  }, { cx: p.x, cy: p.y });
  // Two clicks inside 350ms read as a double click (finish chain).
  await page.waitForTimeout(400);
}

// Tool labels stay stable across contexts (e.g. "WALL [W]"); tools are
// matched by word so shortcut suffixes don't matter.
async function selectTool(page, name) {
  if (/^outline$/i.test(name)) {
    // The OUTLINE key left the keypad (#211): the red bone button or the U
    // shortcut arms the trace now. Tests arm it the keyboard way.
    await page.evaluate(() => {
      if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur();
    });
    await page.keyboard.press('u');
    return;
  }
  await page.getByRole('button', { name: new RegExp(`\\b${name}\\b`, 'i') }).first().click();
}

async function activeToolLabels(page) {
  return page.evaluate(() => Array.from(document.querySelectorAll('button'))
    .filter(b => getComputedStyle(b).backgroundColor === 'rgb(29, 31, 32)')
    .map(b => b.textContent.trim()));
}

async function waitForSaved(page) {
  // _markUnsaved stamps data-save-dirty=1 on <body> synchronously with the
  // edit and clears it only when the IndexedDB write lands, so "not dirty"
  // means the drawing on disk is current. Commits that run in a setState
  // callback mark dirty a frame after the input event — two rAFs let those
  // land before the first read, replacing the old fixed 300ms guard.
  await page.evaluate(() => new Promise(resolve =>
    requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await page.waitForFunction(() => document.body.dataset.saveDirty === '0', undefined, { timeout: 5000 });
  // EITHER PAGE'S STATUS. MODEL.dc.html has a separate [data-model-status]
  // element; MODEL.html carries the status ON its SAVE button
  // ([data-save-status]) since the chrome shell put the file row together. A
  // helper that only knew the first read as "the save never landed" on the
  // second, which is a false report about the page rather than a missing
  // element -- and it costs a five-second timeout to find that out.
  //
  // Not `.or()` on one locator: each page has exactly one of these, so asking
  // which is present first keeps the failure message pointing at the element
  // that should have said SAVED rather than at a union that matched nothing.
  const dc = page.locator('[data-model-status]');
  const status = (await dc.count()) ? dc : page.locator('[data-save-status]');
  await expect(status).toContainText('SAVED', { timeout: 5000 });
}

async function savedDrawing(page) {
  return page.evaluate(async bucket => {
    const file = await window.SharedFileStore.loadSharedFile(bucket);
    return file ? JSON.parse(await file.text()) : null;
  }, STORAGE_BUCKET);
}

function allLines(drawing) {
  return drawing?.lines || [];
}

function allWalls(drawing) {
  return drawing?.walls || [];
}

function near(a, b, tol = 0.4) {
  return Math.abs(a - b) <= tol;
}

function touchesPoint(seg, x, z) {
  return (near(seg.start.x, x) && near(seg.start.z, z))
    || (near(seg.end.x, x) && near(seg.end.z, z));
}

// Reads the overlay canvas back; the only way to assert 2D-fallback drawing.
async function overlayPixels(page, clientX, clientY, radius = 12) {
  return page.evaluate(({ clientX, clientY, radius }) => {
    const canvas = document.querySelector('[data-model-overlay]');
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = Math.round((clientX - rect.left) * scaleX);
    const y = Math.round((clientY - rect.top) * scaleY);
    const size = Math.round(radius * 2 * scaleX);
    const data = canvas.getContext('2d').getImageData(
      Math.max(0, x - size / 2), Math.max(0, y - size / 2), size, size,
    ).data;
    return Array.from(data);
  }, { clientX, clientY, radius });
}

function countColor(pixels, [r, g, b], tol = 26) {
  let count = 0;
  for (let i = 0; i < pixels.length; i += 4) {
    if (pixels[i + 3] === 0) continue;
    if (Math.abs(pixels[i] - r) <= tol && Math.abs(pixels[i + 1] - g) <= tol
      && Math.abs(pixels[i + 2] - b) <= tol) count += 1;
  }
  return count;
}

// The guided tour (board #230) pulls every closed HOUSE outline down to
// FOUNDATION and offers the FOUNDATION DONE popup. Specs that trace a house
// as SETUP climb straight back to MAIN the way a drafter does — one press on
// the popup. Only for house outlines closed on a LEVEL: garage loops and
// boneyard-drawn masters never start the tour.
async function climbTourToMain(page) {
  const popup = page.locator('[data-tour-popup]');
  // Tolerant: a second outline on the shelf, a garage loop, or a boneyard
  // master never fires the tour — no popup within the reveal window means
  // nothing to climb. house-tour.spec.js asserts the firing cases loudly.
  try { await popup.waitFor({ state: 'visible', timeout: 4000 }); }
  catch (e) { return; }
  await popup.click();
  await popup.waitFor({ state: 'hidden' });
  await waitForSaved(page);
}

// THE BUILD ROW IS A MENU (Movie, 6 Sep). Three families sit between the
// turtle and the bone -- BUNGALOW, BILEVEL, DETACHED GARAGE -- and the type
// buttons live one press inside their family, so a spec cannot click a type
// straight off the row any more.
//
// EVERY SPEC GOES THROUGH HERE for the same reason the page derives its lamps
// instead of flagging them: when the menu changes shape again, one function
// moves rather than thirty-five call sites. It also closes an open submenu
// first, so a spec that picks two types in a row does not have to know where
// the menu was left standing.
const BUILD_FAMILY = Object.freeze({
  bungalow: 'bungalow',
  twoStorey: 'bungalow',
  bilevel: 'bilevel',
  modifiedBilevel: 'bilevel',
});

async function pickBuild(page, type, { tap = false } = {}) {
  const family = BUILD_FAMILY[type];
  if (!family) throw new Error(`pickBuild: no build family for "${type}"`);
  const back = page.locator('[data-build-menu-back]');
  if (await back.count()) await back.click();
  await page.locator(`[data-build-menu="${family}"]`).click();
  const entry = page.locator(`[data-select-build="${type}"]`);
  if (tap) await entry.tap();
  else await entry.click();
}

// MODEL.html's HOUSE TYPES MOVED ONTO GRUFF'S DRIVE-THRU SIGN (Movie, 15
// Sep): the foot keeps one press, the BONE (Movie, 16 Sep), and the family
// and entry chips are tiles on the board the sign raises. So a spec that
// wants a chip has to order at the window first.
//
// IDEMPOTENT, and it WAITS for the board rather than sleeping: the sign
// slides, and a click sent mid-rise lands on nothing. Every spec goes
// through here for the reason pickBuild exists — when the menu moves again,
// one function moves.
async function openDriveThru(page) {
  const sign = page.locator('#drivethru');
  if (await sign.getAttribute('data-shut') === null) return;
  await page.locator('#bone').click();
  await expect(sign).not.toHaveAttribute('data-shut', '');
  await expect(page.locator('#build-families button').first()).toBeVisible();
}

// ── MODEL.html: the level and the view, now that the two SELECTs are gone ──
//
// §7 deleted the chrome bar, and with it `#level-pick` and `#view-pick`. The
// LEVELS panel in the right rail is the one control left: a `[data-level-row]`
// per level and a `[data-layer]` per layer view inside it, which is what the
// panel and the seats already shared. Every spec that drove the selects comes
// through here instead, so the next time the control moves one function moves
// with it rather than sixty call sites.
//
// THE RAIL IS OPENED FIRST. Shut is shut (Movie, 16 Sep) -- a collapsed rail
// shows nothing at all, so every row a spec wants to press is behind the
// LEVELS / LAYERS tab.
async function openModelRail(page) {
  const rail = page.locator('#right-rail');
  if (await rail.getAttribute('data-collapsed') === null) return;
  await page.locator('#right-tab').click();
  await expect(rail).not.toHaveAttribute('data-collapsed', '');
}

async function pickModelLevel(page, id) {
  await openModelRail(page);
  await page.locator(`[data-level-row="${id}"]`).click();
}

async function pickModelLayer(page, levelId, viewId) {
  await openModelRail(page);
  await page.locator(`[data-layer="${levelId}:${viewId}"]`).click();
}

// WHAT THE PAGE IS LOOKING AT, read off the readout rather than the URL: the
// URL omits both parameters at their defaults, so a URL read would report
// "none" on the level the drafter is actually standing on. The readout prints
// the resolved answer, which is the question every one of these specs asked
// the select.
async function modelLevelId(page) {
  return page.evaluate(() => {
    const m = /(\d+)\/\d+\s+view\s/.exec(document.getElementById('readout').textContent);
    return m ? m[1] : null;
  });
}

async function modelViewId(page) {
  return page.evaluate(() => {
    const m = /\sview\s+(\S+)/.exec(document.getElementById('readout').textContent);
    return m ? m[1] : null;
  });
}

// A SECTION OR AN ELEVATION, which the panel lists under its own headings
// rather than among a level's layer rows -- they belong to the drawing, not
// to a floor. Matched on the leading id so `E1 · FRONT` answers to `E1`.
const cutRow = (page, id) => page.locator('.lv-layer')
  .filter({ hasText: new RegExp(`^${id}(\\s|$)`) }).first();

async function pickModelCut(page, id) {
  await openModelRail(page);
  await cutRow(page, id).click();
}

async function modelCutOffered(page, id) {
  await openModelRail(page);
  return await cutRow(page, id).count() > 0;
}

// The layer views a level offers, in the panel's order -- the count and the
// labels the `#view-pick` options used to give.
async function modelLayerIds(page, levelId) {
  await openModelRail(page);
  return page.evaluate(id => [...document.querySelectorAll(`[data-layer^="${id}:"]`)]
    .map(el => el.dataset.layer.split(':')[1]), levelId);
}

// ── MODEL.html: arming the WALL tool, now that #draw-wall is gone ─────────
//
// §7b took the top row for the mode corner and the file row, and `#draw-wall`
// went with the chrome bar it lived in. WALL was never that button's alone --
// the tool column and the old button shared ONE register -- so arming it is
// the same act through the key that remains, in the left rail.
//
// THE RAIL IS OPENED FIRST, because shut it is `hidden` and a click on a key
// inside it waits for ever. Specs that used to press a button in the head
// call this instead, so the next move of the control moves one function.
async function openToolRail(page) {
  const rail = page.locator('#left-rail');
  if (!(await rail.isHidden())) return;
  await page.locator('#left-tab').click();
  await expect(rail).toBeVisible();
}

const wallKey = page => page.locator('[data-tool-key="wall"]');

async function wallArmed(page) {
  await openToolRail(page);
  return await wallKey(page).getAttribute('aria-pressed') === 'true';
}

// IDEMPOTENT, unlike the press. Pressing the armed key returns to SELECT --
// the register's rule -- so a helper that always clicked would disarm the
// tool for any caller that was already holding it.
async function armWall(page) {
  if (await wallArmed(page)) return;
  await wallKey(page).click();
  await expect(wallKey(page)).toHaveAttribute('aria-pressed', 'true');
}

async function disarmWall(page) {
  if (!(await wallArmed(page))) return;
  await wallKey(page).click();
  await expect(wallKey(page)).toHaveAttribute('aria-pressed', 'false');
}

module.exports = {
  HALF_HEIGHT_FT,
  STORAGE_BUCKET,
  openModel,
  openRails,
  openModelRail,
  pickModelLevel,
  pickModelLayer,
  modelLevelId,
  modelViewId,
  modelLayerIds,
  pickModelCut,
  modelCutOffered,
  openToolRail,
  armWall,
  disarmWall,
  wallArmed,
  waitForModelReady,
  suppressEntryCoach,
  worldToClient,
  planFrame,
  modelFrame,
  moveTo,
  clickWorld,
  selectTool,
  pickBuild,
  openDriveThru,
  BUILD_FAMILY,
  activeToolLabels,
  waitForSaved,
  climbTourToMain,
  savedDrawing,
  allLines,
  allWalls,
  near,
  touchesPoint,
  overlayPixels,
  countColor,
};
