// Chrome a finger can actually hit (board #304).
//
// ~44px is where Apple and Google both land for a touch target, and MODEL's
// chrome was drawn for a mouse: tool keys came out at 29px on an iPad, the
// pull tabs at 33, the level cards at 23 high. This spec MEASURES them at
// iPad-landscape width rather than trusting the stylesheet, so the numbers
// cannot quietly rot.
//
// The fixes grow the HIT AREA, not the look — padding out, negative margin
// back — so nothing on the desk moved. Two things are deliberately NOT here:
// canvas-space geometry handles (nodes, magnets) are snap-zone territory and
// belong to their own board, and the exceptions listed below cannot reach 44
// without stealing the taps of whatever sits beside them.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const TARGET = 44;

// iPad landscape. The desk is not the case under test — a 1280 window has
// room to spare; 1024 is where the chrome got tight.
test.use({ viewport: { width: 1024, height: 768 } });

// Everything a drafter taps to work the app, with the smallest instance of
// each measured. `min` is the floor a selector must clear.
const REQUIRED = [
  ['.tool-key', 'the tool keypad'],
  ['.nav-key', 'the view-navigation keys'],
  ['.level-row .level-body', 'the level cards'],
  ['[data-areas-open]', 'AREAS'],
  ['[data-build-house]', 'the bone'],
  ['[data-project-corner-bl]', 'the PROJECT link'],
  ['[data-unit-toggle] button', 'the unit toggle'],
  ['[data-nav-cluster] a', 'the bottom-right nav links'],
];

// Measured exceptions, each with the reason it cannot grow. They are asserted
// too — at the size they legitimately are — so that a future change which
// makes them SMALLER still fails this spec.
const EXCEPTIONS = [
  ['.rail-tab', 33, 44, 'the pull tabs are flush with the screen edge and run the canvas\'s full height, so a finger cannot overshoot them outward; widening them would eat drawing area instead'],
  ['.strip-chip', 15, 44, 'instrument chips sit 10px apart; widening them closes that gap and a press near an edge lands on the neighbour, so these grow vertically only'],
];

async function smallest(page, selector) {
  return page.evaluate(sel => {
    const els = [...document.querySelectorAll(sel)].filter(el => el.offsetParent !== null);
    if (!els.length) return null;
    let w = Infinity, h = Infinity;
    els.forEach(el => {
      const r = el.getBoundingClientRect();
      if (r.width) w = Math.min(w, r.width);
      if (r.height) h = Math.min(h, r.height);
    });
    return { count: els.length, width: Math.round(w), height: Math.round(h) };
  }, selector);
}

test('every interactive control clears 44px at iPad width', async ({ page }) => {
  await h.openModel(page);
  for (const [selector, what] of REQUIRED) {
    const box = await smallest(page, selector);
    expect(box, `${what} (${selector}) is on screen`).not.toBeNull();
    expect(box.width, `${what} is wide enough to tap`).toBeGreaterThanOrEqual(TARGET);
    expect(box.height, `${what} is tall enough to tap`).toBeGreaterThanOrEqual(TARGET);
  }
});

test('the documented exceptions are exactly as small as they are allowed to be', async ({ page }) => {
  await h.openModel(page);
  for (const [selector, minW, minH, why] of EXCEPTIONS) {
    const box = await smallest(page, selector);
    expect(box, `${selector} is on screen`).not.toBeNull();
    expect(box.width, `${selector}: ${why}`).toBeGreaterThanOrEqual(minW);
    expect(box.height, `${selector}: ${why}`).toBeGreaterThanOrEqual(minH);
  }
});

test('nothing on the bottom strip covers a control', async ({ page }) => {
  await h.openModel(page);
  // The instrument cluster is absolutely centred, and at this width it used to
  // sit ON TOP of the strip's buttons — they looked fine and swallowed every
  // tap. This is the check that caught it.
  const covered = await page.evaluate(() => {
    const out = [];
    document.querySelectorAll('[data-instrument-strip] button, [data-instrument-strip] a').forEach(el => {
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) return;
      const top = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
      if (top && top !== el && !el.contains(top)) {
        out.push(`${el.textContent.trim() || el.tagName} is covered by ${top.tagName}`);
      }
    });
    return out;
  });
  expect(covered, covered.join('; ')).toEqual([]);
});

test('an open tool rail and the drawing coexist at iPad width', async ({ page }) => {
  await h.openModel(page);
  const layout = await page.evaluate(() => ({
    canvas: document.querySelector('[data-model-container]').getBoundingClientRect().width,
    leftRail: document.querySelector('[data-model-left]').getBoundingClientRect().width,
    window: window.innerWidth,
  }));
  // The rails condense rather than swallow the sheet: the drawing keeps the
  // clear majority of the screen with BOTH rails out.
  expect(layout.leftRail).toBeLessThanOrEqual(170);
  expect(layout.canvas).toBeGreaterThan(layout.window * 0.6);
});

test('the strip drops read-outs before controls as it narrows', async ({ page }) => {
  await h.openModel(page);
  const visible = sel => page.evaluate(s => {
    const el = document.querySelector(s);
    return !!(el && el.offsetParent !== null);
  }, sel);

  // At iPad width the decorative instruments have stood down...
  expect(await visible('[data-mode-frenchcurve]')).toBe(false);
  expect(await visible('[data-mode-shield]')).toBe(false);
  expect(await visible('[data-mode-brush]')).toBe(false);
  // ...while every control is still there. That is the whole rule: a narrow
  // screen costs you a decoration, never a button.
  for (const sel of ['[data-zoom-in]', '[data-zoom-out]', '[data-zoom-fit]',
    '[data-hand-toggle]', '[data-areas-open]', '[data-build-house]']) {
    expect(await visible(sel), `${sel} survives a narrow screen`).toBe(true);
  }
  // And the compass — the one interactive chip in that cluster — is still
  // tappable, not buried under the controls beside it.
  await expect(page.locator('[data-mode-compass]')).toBeVisible();
  await page.locator('[data-mode-compass]').click();
  await expect(page.locator('[data-model-drawing-message]')).toContainText(/COMPASS up/i);
});
