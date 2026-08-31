// GRUFF'S DRIVE-THRU WINDOW (board #323, the UI half). The interview engine
// landed in #198 with nothing on the page calling it; this is his face. The
// window asks what gruff-interview.js says to ask, sends every answer back
// through answer(), and stamps program() verbatim. It decides nothing.
//
// The assertion that matters most here is the first one. An overlay that
// swallows presses has cost this project twice, most recently seven specs
// on this same board — so the board art, both screens, the portrait and the
// speaker are proved decorative, and only the controls take a press.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BOARD = { width: 1250, height: 1050 };
// Measured against assets/gruff-drivethru-board.png; mirrored from
// gruff-drivethru.js so a drift in either is a failure here.
const ZONES = {
  portrait: { left: 6.720, top: 10.667, width: 31.520, height: 35.810 },
  screen: { left: 41.440, top: 9.333, width: 53.360, height: 40.952 },
  answer: { left: 6.640, top: 53.429, width: 86.560, height: 28.000 },
  speaker: { left: 34.400, top: 86.571, width: 13.120, height: 11.143 },
};

// What the browser says is on top at a point — the crispest statement of
// "this zone is decorative" there is.
async function topmostAt(page, x, y) {
  return page.evaluate(({ cx, cy }) => {
    const el = document.elementFromPoint(cx, cy);
    if (!el) return 'none';
    if (el.closest('[data-gruff-window]')) {
      const named = el.closest('[data-gruff-chip],[data-gruff-field],[data-gruff-send],[data-gruff-close]');
      return named ? `control:${named.getAttribute('data-dc-tpl') ? named.tagName : named.tagName}` : 'window';
    }
    if (el.matches('[data-model-canvas]') || el.closest('[data-model-canvas]')) return 'canvas';
    return `other:${el.tagName}`;
  }, { cx: x, cy: y });
}

async function drawOutlineRect(page) {
  await h.selectTool(page, 'Outline');
  await h.clickWorld(page, -18, -12);
  await h.clickWorld(page, 18, -12);
  await h.clickWorld(page, 18, 12);
  await h.clickWorld(page, -18, 12);
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);
}

async function openGruff(page) {
  await page.locator('[data-gruff-open]').click();
  await expect(page.locator('[data-gruff-window]')).toBeVisible();
}

// The centre of a named zone, in client pixels, from the board's own box.
async function zoneCentre(page, name) {
  const box = await page.locator('[data-gruff-board]').boundingBox();
  const z = ZONES[name];
  return {
    x: box.x + box.width * (z.left + z.width / 2) / 100,
    y: box.y + box.height * (z.top + z.height / 2) / 100,
  };
}

// Answer whatever is on the screen until Gruff is done, or the cap trips.
// Chips first (the iPad path), free text where a question offers none.
async function runInterview(page, { max = 40 } = {}) {
  const asked = [];
  for (let i = 0; i < max; i++) {
    const asking = await page.locator('[data-gruff-field]').isVisible().catch(() => false);
    if (!asking) return asked;
    asked.push(await page.locator('[data-gruff-line]').innerText());
    const chips = page.locator('[data-gruff-chip]');
    if (await chips.count()) {
      await chips.first().click();
    } else {
      await page.locator('[data-gruff-field]').fill('yes');
      await page.locator('[data-gruff-send]').click();
    }
    await page.waitForTimeout(40);
  }
  throw new Error(`interview did not finish in ${max} questions`);
}

test('the drawing stays usable under the window — art, screens, portrait and speaker take no press', async ({ page }) => {
  await h.openModel(page);
  await drawOutlineRect(page);
  await openGruff(page);

  // The board art, both screens, the portrait and the speaker are scenery.
  // The browser's own hit-test is the witness: at the centre of each, the
  // thing on top is the drawing.
  // Not the answer panel: its centre is the field, which is a control and
  // is meant to take the press. Its blank space is the next spec's business.
  for (const zone of ['portrait', 'screen', 'speaker']) {
    const at = await zoneCentre(page, zone);
    const panel = await page.locator('[data-gruff-window]').boundingBox();
    // The point really is under the panel, or this proves nothing at all.
    expect(at.x).toBeGreaterThan(panel.x);
    expect(at.x).toBeLessThan(panel.x + panel.width);
    expect(at.y).toBeGreaterThan(panel.y);
    expect(at.y).toBeLessThan(panel.y + panel.height);
    expect(await topmostAt(page, at.x, at.y)).toBe('canvas');
  }

  // And a real, hit-tested press is DELIVERED to the canvas. Drawing a line
  // would be the fuller proof, but this suite's clickWorld dispatches
  // synthetic pointer events straight at the canvas element — a genuine
  // page.mouse click does not drive the drawing tools at all, with or
  // without an overlay (probed). So the canvas itself is the witness: it
  // hears the press, through Gruff's face, at the board's own coordinates.
  await page.evaluate(() => {
    window.__gruffHits = 0;
    document.querySelector('[data-model-canvas]')
      .addEventListener('pointerdown', () => { window.__gruffHits += 1; }, true);
  });
  for (const zone of ['portrait', 'screen', 'speaker']) {
    const at = await zoneCentre(page, zone);
    await page.mouse.move(at.x, at.y);
    await page.mouse.down();
    await page.mouse.up();
  }
  expect(await page.evaluate(() => window.__gruffHits)).toBe(3);
});

test('the answer panel takes a press only on its controls, not its blank space', async ({ page }) => {
  await h.openModel(page);
  await drawOutlineRect(page);
  await openGruff(page);

  // The panel's own background is not a button: its far right, clear of the
  // chips and the field, still hands the press to the drawing.
  const box = await page.locator('[data-gruff-board]').boundingBox();
  const z = ZONES.answer;
  const blank = {
    x: box.x + box.width * (z.left + z.width * 0.96) / 100,
    y: box.y + box.height * (z.top + z.height * 0.12) / 100,
  };
  expect(await topmostAt(page, blank.x, blank.y)).toBe('canvas');

  await page.evaluate(() => {
    window.__gruffHits = 0;
    document.querySelector('[data-model-canvas]')
      .addEventListener('pointerdown', () => { window.__gruffHits += 1; }, true);
  });
  await page.mouse.move(blank.x, blank.y);
  await page.mouse.down();
  await page.mouse.up();
  expect(await page.evaluate(() => window.__gruffHits)).toBe(1);

  // The controls, by contrast, are plainly pressable.
  const chip = await page.locator('[data-gruff-chip]').first().boundingBox();
  expect(await topmostAt(page, chip.x + chip.width / 2, chip.y + chip.height / 2))
    .toContain('control');
  const line = await page.locator('[data-gruff-line]').innerText();
  await page.locator('[data-gruff-chip]').first().click();
  await expect(page.locator('[data-gruff-line]')).not.toHaveText(line);
});

test('a full interview through the window stamps the rooms into the saved drawing', async ({ page }) => {
  await h.openModel(page);
  await drawOutlineRect(page);
  await openGruff(page);

  const asked = await runInterview(page);
  expect(asked.length).toBeGreaterThan(3);
  // The level stack already says two floors, so Gruff never asks.
  expect(asked.join(' | ')).not.toContain('How many floors');

  await expect(page.locator('[data-gruff-done-note]')).toBeVisible();
  await h.waitForSaved(page);

  const saved = await h.savedDrawing(page);
  const dealt = saved.roomTags.filter(tag => tag.auto === true);
  expect(dealt.length).toBeGreaterThan(4);
  dealt.forEach(tag => expect(tag.stamped).toBe(true));
  // Every dealt stamp lands on a real floor level, never the foundation.
  dealt.forEach(tag => expect([3, 5]).toContain(tag.levelId));
  // The engine's own positions, carried through untouched: every stamp
  // sits inside the outline it was dealt against.
  dealt.forEach(tag => {
    expect(tag.at.x).toBeGreaterThan(-18);
    expect(tag.at.x).toBeLessThan(18);
    expect(tag.at.z).toBeGreaterThan(-12);
    expect(tag.at.z).toBeLessThan(12);
  });
  // A primary suite brings its companions, tied to it by tag id.
  const companions = dealt.filter(tag => tag.companionOf != null);
  companions.forEach(tag => {
    expect(dealt.some(host => host.id === tag.companionOf)).toBe(true);
  });
});

test('the bone is never gated — pressed mid-order it deals the rest from the defaults', async ({ page }) => {
  await h.openModel(page);
  await drawOutlineRect(page);
  await openGruff(page);

  // Answer exactly one rung, then walk off and press the bone.
  await page.locator('[data-gruff-chip]').first().click();
  await page.waitForTimeout(40);
  await expect(page.locator('[data-gruff-field]')).toBeVisible();

  await page.getByRole('button', { name: 'BUILD HOUSE' }).click();
  await page.waitForTimeout(400);
  await h.waitForSaved(page);

  // The order is placed: the window stops asking and says what was left
  // to the house defaults.
  await expect(page.locator('[data-gruff-field]')).toHaveCount(0);
  await expect(page.locator('[data-gruff-done-note]')).toContainText('house default');

  const saved = await h.savedDrawing(page);
  const dealt = saved.roomTags.filter(tag => tag.auto === true);
  // KITCHEN and LIVING were never asked about — they are here because
  // everything unsaid falls to a default, which is the whole point.
  expect(dealt.some(tag => tag.base === 'KITCHEN')).toBe(true);
  expect(dealt.some(tag => tag.base === 'LIVING')).toBe(true);
  expect(dealt.length).toBeGreaterThan(4);
});

test('the window is reachable and escapable without a pointer', async ({ page }) => {
  await h.openModel(page);
  await drawOutlineRect(page);
  await openGruff(page);

  // The field takes focus from the keyboard and answers from the keyboard.
  const line = await page.locator('[data-gruff-line]').innerText();
  await page.locator('[data-gruff-field]').focus();
  await expect(page.locator('[data-gruff-field]')).toBeFocused();
  await page.keyboard.type('3');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(60);
  await expect(page.locator('[data-gruff-line]')).not.toHaveText(line);

  // Escape leaves, from inside the field — a dialog you cannot leave by
  // keyboard is a trap, not a panel.
  await page.locator('[data-gruff-field]').focus();
  await page.keyboard.press('Escape');
  await expect(page.locator('[data-gruff-window]')).toHaveCount(0);

  // And the launcher brings him back.
  await page.locator('[data-gruff-open]').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('[data-gruff-window]')).toBeVisible();
});

test('Gruff never asks what the drawing already told him', async ({ page }) => {
  await h.openModel(page);
  await drawOutlineRect(page);
  await openGruff(page);

  const asked = [];
  for (let i = 0; i < 6; i++) {
    if (!(await page.locator('[data-gruff-field]').isVisible().catch(() => false))) break;
    asked.push(await page.locator('[data-gruff-line]').innerText());
    // Not every rung offers chips — some are free text only, and waiting on
    // a chip that never comes is a hang, not a failure.
    const chips = page.locator('[data-gruff-chip]');
    if (await chips.count()) {
      await chips.first().click();
    } else {
      await page.locator('[data-gruff-field]').fill('yes');
      await page.locator('[data-gruff-send]').click();
    }
    await page.waitForTimeout(40);
  }
  // Two floor levels ship by default, so the storeys rung is settled by the
  // level stack and skipped outright.
  expect(asked.join(' | ')).not.toContain('How many floors');
  expect(asked.length).toBeGreaterThan(0);
});
