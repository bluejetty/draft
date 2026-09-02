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
  if (!boneReveal || !autoStairs || !roomGrow || !autoWindows) {
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
      localStorage.setItem(key, JSON.stringify(pkg));
    }, { boneReveal: !boneReveal, suggestStairs: !autoStairs, roomGrow: !roomGrow, autoWindows: !autoWindows });
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
async function waitForModelReady(page, { rails = true } = {}) {
  await page.waitForFunction(() => document.body.dataset.modelReady === '1');
  // The entry performance notice pops right after the profile restore that
  // follows model-ready; put it away so it never covers the top-bar build
  // cluster mid-test. perf-notice.spec.js exercises the notice itself with
  // its own inline waits instead of this helper.
  const gotIt = page.locator('[data-perf-notice-continue]');
  try { await gotIt.click({ timeout: 2000 }); } catch { /* opted out or already gone */ }
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
  await expect(page.locator('[data-model-status]')).toContainText('SAVED', { timeout: 5000 });
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

module.exports = {
  HALF_HEIGHT_FT,
  STORAGE_BUCKET,
  openModel,
  openRails,
  waitForModelReady,
  worldToClient,
  moveTo,
  clickWorld,
  selectTool,
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
