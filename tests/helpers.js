// Shared helpers for the Model Space specs.
//
// The page keeps no test hook on the component, so everything here works the
// way a user does: click in the canvas, then read the drawing back out of the
// same IndexedDB bucket the app saves to.
const { expect } = require('@playwright/test');

const HALF_HEIGHT_FT = 25;          // default ortho half-height in _init()
const STORAGE_BUCKET = 'model-drawing';

async function openModel(page, { webgl = true } = {}) {
  // Init scripts run on every navigation, so the flag keeps a reload inside a
  // test from wiping the drawing the test just made.
  await page.addInitScript(() => {
    if (sessionStorage.getItem('draft-test-storage-cleared')) return;
    sessionStorage.setItem('draft-test-storage-cleared', '1');
    indexedDB.deleteDatabase('pdf-img-mgr-shared');
    localStorage.clear();
  });
  if (!webgl) {
    await page.addInitScript(() => {
      const real = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (type, ...rest) {
        if (typeof type === 'string' && type.toLowerCase().includes('webgl')) return null;
        return real.call(this, type, ...rest);
      };
    });
  }
  await page.goto('/MODEL.dc.html');
  await expect(page.locator('[data-model-canvas]')).toBeVisible();
  await page.waitForTimeout(500);
  return page.locator('[data-model-canvas]');
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
    const opts = { bubbles: true, cancelable: true, view: window, clientX: cx, clientY: cy, button: 0 };
    canvas.dispatchEvent(new PointerEvent('mousemove', { ...opts, buttons: 0 }));
    canvas.dispatchEvent(new PointerEvent('mousedown', { ...opts, buttons: 1 }));
    window.dispatchEvent(new PointerEvent('mouseup', { ...opts, buttons: 0 }));
  }, { cx: p.x, cy: p.y });
  // Two clicks inside 350ms read as a double click (finish chain).
  await page.waitForTimeout(400);
}

// Tool labels stay stable across contexts (e.g. "WALL [W]"); tools are
// matched by word so shortcut suffixes don't matter.
async function selectTool(page, name) {
  await page.getByRole('button', { name: new RegExp(`\\b${name}\\b`, 'i') }).first().click();
}

async function activeToolLabels(page) {
  return page.evaluate(() => Array.from(document.querySelectorAll('button'))
    .filter(b => getComputedStyle(b).backgroundColor === 'rgb(29, 31, 32)')
    .map(b => b.textContent.trim()));
}

async function waitForSaved(page) {
  // An edit flips the status to UNSAVED a render after the input lands, so a
  // check that polls too early can match the PREVIOUS save's SAVED and read
  // stale storage. Give the flip a beat, then require SAVED to hold across a
  // second look so multi-step commits have fully drained.
  await page.waitForTimeout(300);
  await expect(page.locator('[data-model-status]')).toContainText('SAVED', { timeout: 5000 });
  await page.waitForTimeout(200);
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

module.exports = {
  HALF_HEIGHT_FT,
  STORAGE_BUCKET,
  openModel,
  worldToClient,
  moveTo,
  clickWorld,
  selectTool,
  activeToolLabels,
  waitForSaved,
  savedDrawing,
  allLines,
  allWalls,
  near,
  touchesPoint,
  overlayPixels,
  countColor,
};
