// THE LEASE FOLLOWS THE TAB BEING LOOKED AT (jb, 10 Nov 2026).
//
// "there is this other thing that pops up alot 'TAKE OVER DRAWING' ... i
// think when i'm trying to save it usually". Chrome slows a hidden tab's
// timers to one a minute, so a backgrounded MODEL.html let its 15 s lease
// expire; any other open tab picked it up on its next beat; coming back meant
// BEING EDITED IN ANOTHER TAB, a dead SAVE, a TAKE OVER press, and the same
// banner waiting on the other tab. With several tabs open it never stopped.
//
// Now a hidden tab hands its lease back on visibilitychange and asks for it
// again when it is shown. A lease nobody took in between comes back at the
// same generation, in silence; one that a VISIBLE window is holding is
// refused and the banner is back to being what it was written for.
//
// And the way through an accidental save in the wrong window (jb: "can they
// go in there and save that one overtop (the correct one)"): the stale
// refusal carries SAVE THIS ONE OVER TOP.
const { test, expect } = require('@playwright/test');

const BUCKET = 'model-drawing';
const SCOPE = 'model';
const MAIN_FL = 3;

// Four walls meeting at the origin, so the fit puts a shared corner at the
// canvas centre and a drag from there is an edit (tests/model-hide-save.spec.js).
const C = () => ({ x: 0, y: 0, z: 0 });
const FIXTURE = {
  format: 'draft-drawing', version: 1,
  levels: [
    { id: 8, name: 'SITE', elev: 0, visible: true },
    { id: 7, name: 'ROOF', elev: 18, visible: true },
    { id: 5, name: '2ND FL', elev: 9, visible: true },
    { id: 3, name: 'MAIN FL', elev: 0, visible: true },
    { id: 1, name: 'FOUNDATION', elev: -10, visible: true },
  ],
  walls: [
    ['w', { x: -10, y: 0, z: 0 }, C()], ['e', C(), { x: 10, y: 0, z: 0 }],
    ['n', C(), { x: 0, y: 0, z: -5 }], ['s', C(), { x: 0, y: 0, z: 5 }],
  ].map(([id, start, end]) => ({
    id, start, end, levelId: MAIN_FL, view: 'plan', wallType: 'stud_2x6',
    baseHeight: 0, topHeight: 8, refLine: 'left',
  })),
  lines: [], floors: [], roofs: [], shapes: [], outlines: [], dimensions: [],
  notes: [], underlays: [], fixtures: [], fenestrations: [], stairs: [],
  boneyardOutlines: [],
  nextDrawingItemId: 9,
};

async function openModel(page, { seed = false } = {}) {
  await page.goto('/MODEL.html?mode=night');
  if (seed) {
    await page.waitForFunction(() => !!window.SharedFileStore, null, { timeout: 10000 });
    await page.evaluate(async ({ bucket, data }) => {
      await window.SharedFileStore.saveSharedFile(
        new File([JSON.stringify(data)], 'drawing.json', { type: 'application/json' }), bucket);
    }, { bucket: BUCKET, data: FIXTURE });
    await page.goto('/MODEL.html?mode=night');
  }
  await expect(page.locator('#readout')).toContainText('walls 4/4', { timeout: 8000 });
  return page;
}

const leaseNow = page => page.evaluate(
  ({ bucket, scope }) => window.SharedFileStore.readLease(bucket, scope), { bucket: BUCKET, scope: SCOPE });
const myHolderId = page => page.evaluate(() => window.SharedFileStore.leaseHolderId());
const held = page => page.locator('body').getAttribute('data-lease-held');

// The browser's own events, faked the way tests/model-hide-save.spec.js fakes
// them: visibilityState is read-only, so it is redefined before the event.
const setVisibility = (page, state) => page.evaluate(s => {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => s });
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => s === 'hidden' });
  document.dispatchEvent(new Event('visibilitychange'));
}, state);

const readStore = page => page.evaluate(async bucket => {
  const at = await window.SharedFileStore.loadSharedFileAt(bucket);
  return { rev: at.rev, drawing: JSON.parse(await at.file.text()) };
}, BUCKET);

async function moveCorner(page, dx, dy) {
  const box = await page.locator('#plan').boundingBox();
  const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
  await page.mouse.click(cx - 120, cy);
  await page.waitForTimeout(60);
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx + dx, cy + dy, { steps: 10 });
  await page.mouse.up();
  await page.waitForTimeout(60);
}

test.describe('the lease follows the tab being looked at', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => { try { sessionStorage.clear(); } catch { /* fine */ } });
  });

  // MUTATION: drop parkLease from the hidden branch. The second page never
  // gets the lease without a press, and the old ping-pong is back.
  test('a hidden tab hands its lease back, and a second tab takes it with no press',
    async ({ page, context }) => {
      await openModel(page, { seed: true });
      await expect(page.locator('body')).toHaveAttribute('data-lease-held', '1', { timeout: 8000 });
      const first = await myHolderId(page);

      const second = await openModel(await context.newPage());
      await expect(second.locator('body')).toHaveAttribute('data-lease-held', '0', { timeout: 8000 });
      await expect(second.locator('[data-lease-banner]')).toBeVisible();

      await setVisibility(page, 'hidden');
      await expect.poll(async () => (await leaseNow(page))?.holderId ?? null,
        { message: 'the hidden tab must give the lease up at once, not on the TTL' })
        .not.toBe(first);
      expect(await held(page), 'and it knows it no longer holds it').toBe('0');
      await expect(page.locator('[data-lease-banner]'),
        'but a parked tab shows no banner — nobody is editing elsewhere').toBeHidden();

      // The second tab's own heartbeat picks it up; nothing is pressed.
      await expect(second.locator('body')).toHaveAttribute('data-lease-held', '1', { timeout: 8000 });
      await expect(second.locator('[data-lease-banner]')).toBeHidden();
      expect((await leaseNow(second)).holderId).toBe(await myHolderId(second));
    });

  // MUTATION: drop reclaimLease from the visible branch. The tab comes back
  // parked for good, SAVE dead, and no banner to say why.
  test('a tab shown again takes its lease back in silence when nobody has it',
    async ({ page }) => {
      await openModel(page, { seed: true });
      await expect(page.locator('body')).toHaveAttribute('data-lease-held', '1', { timeout: 8000 });
      const mine = await myHolderId(page);
      const before = (await leaseNow(page)).generation;

      await setVisibility(page, 'hidden');
      await expect.poll(async () => (await leaseNow(page)) === null,
        { message: 'released: an unheld lease reads as null' }).toBe(true);

      await setVisibility(page, 'visible');
      await expect(page.locator('body')).toHaveAttribute('data-lease-held', '1', { timeout: 6000 });
      const after = await leaseNow(page);
      expect(after.holderId).toBe(mine);
      expect(after.generation, 'the same generation: nothing happened, nobody is told').toBe(before);
      await expect(page.locator('[data-lease-banner]')).toBeHidden();
      await expect(page.locator('[data-changed-elsewhere]')).toBeHidden();
      await expect(page.locator('#save')).toBeEnabled();
    });

  // Two windows the drafter can SEE at once: the one still holding it keeps
  // it, and the banner says so on the other. The press is still the only
  // thing that seizes a live lease.
  test('a tab shown again while a visible window holds the lease gets the banner, not the lease',
    async ({ page, context }) => {
      await openModel(page, { seed: true });
      await expect(page.locator('body')).toHaveAttribute('data-lease-held', '1', { timeout: 8000 });
      const second = await openModel(await context.newPage());
      await setVisibility(page, 'hidden');
      await expect(second.locator('body')).toHaveAttribute('data-lease-held', '1', { timeout: 8000 });
      const theirs = await myHolderId(second);

      await setVisibility(page, 'visible');
      // The reclaim asks for a few seconds before it gives up; the banner is
      // down while it asks and up once it has stopped.
      await expect(page.locator('[data-lease-banner]')).toBeVisible({ timeout: 10000 });
      await expect(page.locator('[data-lease-banner]')).toHaveAttribute('data-lease-holder', theirs);
      expect(await held(page)).toBe('0');
      await expect(page.locator('#save')).toBeDisabled();
      expect((await leaseNow(second)).holderId, 'the visible holder was never robbed').toBe(theirs);

      await page.locator('[data-take-over]').click();
      await expect(page.locator('body')).toHaveAttribute('data-lease-held', '1', { timeout: 6000 });
    });
});

test.describe('saving the right window over top', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => { try { sessionStorage.clear(); } catch { /* fine */ } });
  });

  // MUTATION: pass ifRev regardless of overTop. The press is refused again,
  // the notice comes straight back, and the correct copy is stranded.
  test('a stale refusal offers SAVE THIS ONE OVER TOP, and the press writes this window\'s copy',
    async ({ page }) => {
      await openModel(page, { seed: true });
      await expect(page.locator('body')).toHaveAttribute('data-lease-held', '1', { timeout: 8000 });
      await moveCorner(page, 90, 50);
      await expect(page.locator('body')).toHaveAttribute('data-save-dirty', '1');
      const mine = (await readStore(page)).drawing;

      // The other window saved first: a write to the bucket this page did not
      // make, bumping the revision under it. Ungated on purpose, as a
      // second window holding the lease would be.
      await page.evaluate(async ({ bucket, data }) => {
        await window.SharedFileStore.saveSharedFile(
          new File([JSON.stringify({ ...data, walls: data.walls.slice(0, 2) })], 'other.json',
            { type: 'application/json' }), bucket);
      }, { bucket: BUCKET, data: FIXTURE });
      const theirs = await readStore(page);
      expect(theirs.drawing.walls.length).toBe(2);

      await page.locator('#save').click();
      await expect(page.locator('#notice')).toHaveClass(/show/, { timeout: 6000 });
      await expect(page.locator('#notice')).toContainText('changed underneath');
      expect((await readStore(page)).rev, 'the plain press wrote nothing').toBe(theirs.rev);
      await expect(page.locator('body'), 'and the page is still dirty').toHaveAttribute('data-save-dirty', '1');

      await page.locator('[data-save-over-top]').click();
      await expect(page.locator('#notice')).not.toHaveClass(/show/);
      await expect(page.locator('#save')).toHaveText('SAVED', { timeout: 6000 });
      const now = await readStore(page);
      expect(now.rev).toBeGreaterThan(theirs.rev);
      expect(now.drawing.walls.length, 'this window\'s four walls, not the other window\'s two').toBe(4);
      const moved = now.drawing.walls.find(w => w.id === 'w').end;
      expect(Math.hypot(moved.x - mine.walls.find(w => w.id === 'w').end.x,
        moved.z - mine.walls.find(w => w.id === 'w').end.z),
      'with the dragged corner, which is what made this the correct copy').toBeGreaterThan(1);

      // And the next plain save is current again.
      await moveCorner(page, -40, -20);
      await page.locator('#save').click();
      await expect(page.locator('#save')).toHaveText('SAVED', { timeout: 6000 });
      await expect(page.locator('#notice')).not.toHaveClass(/show/);
    });

  test('KEEP LOOKING closes the notice and keeps the edit, unsaved', async ({ page }) => {
    await openModel(page, { seed: true });
    await expect(page.locator('body')).toHaveAttribute('data-lease-held', '1', { timeout: 8000 });
    await moveCorner(page, 90, 50);
    await page.evaluate(async ({ bucket, data }) => {
      await window.SharedFileStore.saveSharedFile(
        new File([JSON.stringify(data)], 'other.json', { type: 'application/json' }), bucket);
    }, { bucket: BUCKET, data: FIXTURE });
    const before = (await readStore(page)).rev;
    await page.locator('#save').click();
    await expect(page.locator('#notice')).toHaveClass(/show/, { timeout: 6000 });
    await page.locator('[data-notice-close]').click();
    await expect(page.locator('#notice')).not.toHaveClass(/show/);
    await expect(page.locator('body')).toHaveAttribute('data-save-dirty', '1');
    await expect(page.locator('#save')).toHaveText('UNSAVED');
    expect((await readStore(page)).rev).toBe(before);
  });
});
