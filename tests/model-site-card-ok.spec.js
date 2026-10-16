// ONE LOUD WAY THROUGH THE SITE CARD.
//
// Movie, 16 Oct: "when it gets to the SITE menu- put a big button on the
// bottom that says OK and make it red so it draws attention. if they click
// that just put in the best fit based on the sizes / setbacks ok ?", then the
// reason -- "make it easier for when the user wants to think less and read
// less simplify it for them to get through easy" -- and the scope: "leave all
// that other stuff in the sITE menu, but add the extra red OK button on the
// bottom".
//
// AND IT MUST NOT BE MAGIC: "highlight the 'DRAW AUTOSITE' button so the user
// knows when they press OK that is what will happen" ... "make it glow" ...
// "until they press another button".
//
// So three claims, and this file is one check each: OK takes the size the
// card itself would choose, the glow names the verb it will press, and the
// rest of the card is untouched.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const SITE = 8;

// A 40 x 26 HOUSE, which rules the two narrow lots out and makes the first
// size to fit a real answer rather than the top of the list.
const HOUSE = [[-20, -13], [20, -13], [20, 13], [-20, 13]];

const file = ({ house = true } = {}) => ({
  version: 1, planTurn: 0, board: 'drafting',
  levels: [{ id: SITE, name: 'SITE', elev: 0 }, { id: 7, name: 'ROOF', elev: 0 },
    { id: 3, name: 'MAIN FL', elev: 0 }, { id: 1, name: 'FOUNDATION', elev: -8 }],
  activeLevelIdx: 2,
  walls: [], lines: [], floors: [], roofs: [], fenestrations: [], dimensions: [],
  outlines: house ? [{
    id: 'house', levelId: 3, closed: true,
    points: HOUSE.map(([x, z]) => ({ x, y: 0, z })),
  }] : [],
  shapes: [], surfaceOpenings: [], stairs: [], notes: [],
  roomTags: [], columns: [], beams: [], boneyardOutlines: [],
  groups: [], levelLocks: [], underlays: [],
});

async function openOnSite(page, f = file()) {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, drawing }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(drawing)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, drawing: f });
  await page.goto(`/MODEL.html?level=${SITE}`);
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  await expect(page.locator('#lot-pick')).toBeVisible();
  await page.waitForTimeout(300);
}

const card = page => page.locator('#lot-pick');
const ok = page => card(page).locator('[data-lot-pick-ok]');
const drawBtn = page => card(page).locator('[data-lot-pick-draw]');
const lotOf = async page => {
  await page.locator('#save').click();
  await h.waitForSaved(page);
  const d = await h.savedDrawing(page);
  const lot = (d.outlines || []).find(o => Number(o.levelId) === SITE);
  if (!lot) return null;
  const xs = lot.points.map(p => p.x), zs = lot.points.map(p => p.z);
  return [Math.round(Math.max(...xs) - Math.min(...xs)),
    Math.round(Math.max(...zs) - Math.min(...zs))];
};

test('OK draws the size the ladder itself brightens', async ({ page }) => {
  await openOnSite(page);
  // THE FIRST SIZE TO FIT is what the card marks (Movie, 14 Oct), and OK must
  // take THAT -- a loud button that disagreed with the bright row would be
  // two answers to one question.
  const bright = card(page).locator('.lot-best');
  await expect(bright).toHaveCount(1);
  const brightSize = (await bright.locator('.lot-size').textContent()).trim();
  await expect(ok(page)).toHaveText('OK');
  await expect(ok(page)).toHaveAttribute('title', new RegExp(brightSize));

  await ok(page).click();
  await expect(card(page), 'the card is answered and gone').toBeHidden();
  const [w, d] = brightSize.split('X').map(Number);
  expect(await lotOf(page), 'and the lot it drew is that size').toEqual([w, d]);
});

test('DRAW AUTOSITE glows, so OK is not magic', async ({ page }) => {
  await openOnSite(page);
  // THE GLOW IS ON THE VERB, not on the size: what a drafter needs to know
  // before pressing a button that answers for him is WHICH button answered.
  await expect(drawBtn(page)).toHaveClass(/lot-ok-target/);
  // MEASURED, not asserted. A class with no rule behind it looks exactly like
  // a button that is not glowing -- which is the whole of what was asked for.
  const lit = await drawBtn(page).evaluate(el => {
    const style = getComputedStyle(el);
    return { animation: style.animationName, shadow: style.boxShadow };
  });
  expect(lit.animation === 'lot-ok-points' || /\d/.test(lit.shadow),
    'the glow is drawn, not merely named').toBe(true);
});

test('and it stops glowing once he presses another button', async ({ page }) => {
  await openOnSite(page);
  await expect(drawBtn(page)).toHaveClass(/lot-ok-target/);
  // "until they press another button": a drafter pressing a size IS reading
  // the ladder and making his own choice, so the pointer stops pointing.
  await card(page).locator('[data-lot-tier="XXL"]').click();
  await expect(drawBtn(page)).not.toHaveClass(/lot-ok-target/);
  // AND OK STILL WORKS -- it is not a lock, it is a shortcut. It now draws
  // the size HE picked: a button that overrode his own choice because it
  // knows better is the opposite of what was asked for.
  await expect(ok(page)).toHaveAttribute('title', /65X150/);
  await ok(page).click();
  expect(await lotOf(page), 'his pick, not the best fit').toEqual([65, 150]);
});

test('everything else in the card is still there', async ({ page }) => {
  // "leave all that other stuff in the sITE menu, but add the extra red OK
  // button on the bottom". This is the check that the addition stayed an
  // addition.
  await openOnSite(page);
  await expect(card(page).locator('[data-lot-pick-draw]')).toBeVisible();
  await expect(card(page).locator('[data-lot-pick-skip]')).toBeVisible();
  await expect(card(page).locator('[data-lot-pick-hand]')).toBeVisible();
  await expect(card(page).locator('[data-lot-pick-upload]')).toBeVisible();
  // The six tiers and OTHER, still a ladder.
  expect(await card(page).locator('[data-lot-tier]').count()).toBe(7);
  // AND THE OK IS AT THE BOTTOM, under the lot note -- "a big button on the
  // bottom". Read as geometry rather than as DOM order, because the drafter
  // sees a position, not a sibling index.
  const note = await card(page).locator('[data-lot-note]').boundingBox();
  const button = await ok(page).boundingBox();
  expect(button.y, 'OK sits below the note').toBeGreaterThan(note.y);
  expect(button.width, 'and it is the big one').toBeGreaterThan(200);
});

test('with nothing drawn yet, OK still has an answer', async ({ page }) => {
  // NO BUILDING MEANS NO FIRST-TO-FIT: every size fits and the ladder
  // brightens none of them, which is his own rule from 14 Oct. A dead OK
  // there would be the one card whose way through is missing exactly when
  // the drafter knows least, so it falls back to the tier the list itself
  // calls Standard suburban.
  await openOnSite(page, file({ house: false }));
  await expect(card(page).locator('.lot-best')).toHaveCount(0);
  await expect(ok(page)).toBeEnabled();
  await expect(ok(page)).toHaveAttribute('title', /45X120/);
  await ok(page).click();
  expect(await lotOf(page)).toEqual([45, 120]);
});
