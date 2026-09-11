// AUTOSAVE RULING, RUNG 4 — the best-effort hide-save.
//
// Spec of record: RD-DOCUMENTS/RULING-autosave-two-writers.md §3.4 and the rung
// list at §"Never"/rung 4.
//
// MODEL.html commits on a press and only on a press, and that stays true. This
// rung adds a save when the page is hidden or going away, for the drafter who
// closes a tab without ceremony and whose only protection until now was a
// `beforeunload` dialog the suite runs one engine and cannot fully prove.
//
// IT IS AN EXTRA, NOT A MECHANISM, and the distinction is the reason half the
// tests below exist. The probe (TTL-MEASUREMENT-MEMO) measured a `pagehide`
// IndexedDB write FAILING TO LAND on a tab reload with no memory pressure at
// all; it landed on close. So the honest claim is "it closes the tab-closed
// hole most of the time" — nothing in this repo may assume the hide-save ran,
// and no test here asserts that it must have.
//
// WHAT A DISPATCHED EVENT DOES AND DOES NOT PROVE. Playwright will not
// background a tab honestly, so every case below fires the event itself:
// `pagehide` on the window, and `visibilitychange` on the document with
// `visibilityState` overridden to 'hidden'. That evidences THE HANDLER DOES THE
// RIGHT THING WHEN IT RUNS. It does not evidence that the browser fires it in
// the real case — the probe is what evidences that, and this file would pass
// unchanged against a browser that never fired either event. Said out loud
// rather than left for a reader to assume the stronger claim.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const MAIN_FL = 3;
const PROFILE_KEY = 'draft-active-package:standards';   // profile-manager.js:7

async function houseOnOldPage(page) {
  await h.openModel(page, { webgl: false, rails: false, entryCoach: true });
  await expect(page.locator('[data-entry-coach]')).toBeVisible({ timeout: 4000 });
  await page.locator('[data-first-bone-press]').click();
  await h.waitForSaved(page);
  await page.evaluate(key => localStorage.setItem(key, JSON.stringify({
    format: 'draft-profile-package',
    kind: 'standards',
    content: { model: { structureStandards: { autoElevations: false } } },
  })), PROFILE_KEY);
}

// The corner-drag fixture from model-html-save.spec.js: four walls meeting at
// the world origin, which the page's fit puts at the canvas centre.
const FIXTURE = `
  const C = () => ({ x: 0, y: 0, z: 0 });
  const wall = (id, start, end) => ({
    id, start, end, levelId: ${MAIN_FL}, view: 'plan', wallType: 'stud_2x6',
  });
  d.boneyardOutlines = [];
  d.walls = [
    wall('w', { x: -10, y: 0, z: 0 }, C()),
    wall('e', C(), { x: 10, y: 0, z: 0 }),
    wall('n', C(), { x: 0, y: 0, z: -5 }),
    wall('s', C(), { x: 0, y: 0, z: 5 })
  ];
  d.lines = []; d.floors = []; d.dimensions = []; d.roofs = []; d.shapes = [];
  return d;`;

async function writeFixture(page) {
  await page.evaluate(async ({ bucket, src }) => {
    const file = await window.SharedFileStore.loadSharedFile(bucket);
    const drawing = JSON.parse(await file.text());
    // eslint-disable-next-line no-new-func
    const out = new Function('d', src)(drawing) || drawing;
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(out)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, src: FIXTURE });
}

async function openModelPage(page) {
  await page.goto('/MODEL.html?mode=night');
  await expect(page.locator('#readout')).toContainText('walls 4/4', { timeout: 6000 });
  await expect(page.locator('body')).toHaveAttribute('data-lease-held', '1', { timeout: 6000 });
}

const beacon = page => page.evaluate(() => document.body.dataset.saveDirty);
const corner = saved => saved.walls.find(x => x.id === 'w').end;

const readStore = page => page.evaluate(async bucket => {
  const at = await window.SharedFileStore.loadSharedFileAt(bucket);
  return { rev: at.rev, drawing: JSON.parse(await at.file.text()) };
}, BUCKET);

// Select the west wall, then drag the corner its handle sits on — the same two
// moves model-html-save.spec.js makes, and the corner does not move without the
// selection first.
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

// The two hides, each on its own. Neither helper fires the other's event: a
// case that fired both would prove neither listener.
const hideByPagehide = page => page.evaluate(() => {
  window.dispatchEvent(new Event('pagehide'));
});
const hideByVisibility = page => page.evaluate(() => {
  Object.defineProperty(document, 'visibilityState', {
    configurable: true, get: () => 'hidden',
  });
  document.dispatchEvent(new Event('visibilitychange'));
});

// Long enough that a write WOULD have landed, for the cases that assert none
// did. A bare assertion straight after the dispatch passes against a page that
// is about to write.
const SETTLE = 1500;

async function editedPage(page) {
  await houseOnOldPage(page);
  await writeFixture(page);
  await openModelPage(page);
  const before = await readStore(page);
  await moveCorner(page, 90, 50);
  expect(await beacon(page), 'the drag must have marked the page dirty').toBe('1');
  return before;
}

test.describe('rung 4 — the hide-save', () => {

  // ── 1 ──────────────────────────────────────────────────────────────────────
  // THIS IS THE RUNG. A corner moved and never pressed, read back by a page
  // that was not there when it was moved — which is the only way to show it is
  // in the store rather than in the first page's memory.
  test('a hidden tab\'s moved corner is in the store when the next page reads it',
    async ({ page, context }) => {
      const before = await editedPage(page);

      await hideByPagehide(page);
      await expect(page.locator('#save')).toHaveText('SAVED', { timeout: 6000 });

      const next = await context.newPage();
      await next.goto('/MODEL.html?mode=night');
      await expect(next.locator('#readout')).toContainText('walls 4/4', { timeout: 6000 });
      const seen = await readStore(next);
      expect(seen.rev).toBeGreaterThan(before.rev);
      expect(corner(seen.drawing)).not.toMatchObject(corner(before.drawing));
      await next.close();
    });

  // ── 2 ──────────────────────────────────────────────────────────────────────
  // WHAT MAKES THIS AN EXTRA AND NOT AUTOSAVE. No press, no hide, no write —
  // however long the drafter leaves the edit sitting there. The timer mutant
  // dies here, and it is the shape of rung 5 arriving early.
  test('a drag with no press and no hide writes nothing', async ({ page }) => {
    const before = await editedPage(page);
    await page.waitForTimeout(SETTLE);

    const after = await readStore(page);
    expect(after.rev).toBe(before.rev);
    await expect(page.locator('#save')).toHaveText('UNSAVED');
    expect(await beacon(page)).toBe('1');
  });

  // ── 3 ──────────────────────────────────────────────────────────────────────
  // A page that does not hold the lease does not spend a refusal to learn what
  // holdsLease() already told it — save()'s own reasoning, and the hide-save
  // inherits it rather than arguing with it.
  test('a hidden tab without the lease does not write and stays UNSAVED',
    async ({ page, context }) => {
      const before = await editedPage(page);

      // A second page TAKES the lease. The first learns it lost on its next
      // heartbeat, which is what the beacon below waits for.
      const thief = await context.newPage();
      await thief.goto('/MODEL.html?mode=night');
      await thief.waitForFunction(() => !!window.SharedFileStore, null, { timeout: 10000 });
      await thief.evaluate(async bucket => {
        const S = window.SharedFileStore;
        await S.claimLease(bucket, 'model', 'holder-thief',
          { ttlMs: S.LEASE_TTL_MS, takeover: true });
      }, BUCKET);
      await expect(page.locator('body'))
        .toHaveAttribute('data-lease-held', '0', { timeout: 15000 });

      // COUNTING THE ATTEMPT, NOT THE OUTCOME, and the difference is the whole
      // test. Without the lease the store refuses the write anyway, so "the
      // bucket is unchanged and the page still says UNSAVED" is equally true of
      // a page that declined to write and a page that wrote and was refused —
      // measured, not assumed: with the lease check deleted, every assertion
      // below except this counter still passed. The guard exists precisely so
      // the page does not spend a refusal to learn what holdsLease() already
      // told it, so the attempt is the thing to observe.
      await page.evaluate(() => {
        const S = window.SharedFileStore;
        window.__hideWrites = 0;
        const real = S.saveSharedFile;
        S.saveSharedFile = (...args) => { window.__hideWrites += 1; return real.apply(S, args); };
      });

      await hideByPagehide(page);
      await page.waitForTimeout(SETTLE);

      expect(await page.evaluate(() => window.__hideWrites),
        'a leaseless hide must not even attempt the write').toBe(0);
      const after = await readStore(page);
      expect(after.rev, 'and nothing may land in the bucket').toBe(before.rev);
      expect(await beacon(page), 'and the drafter must still see UNSAVED').toBe('1');
      await thief.close();
    });

  // ── 4 ──────────────────────────────────────────────────────────────────────
  // REFUSED ON THE WAY OUT IS STILL REFUSED. A dirty page deliberately re-reads
  // nothing when another page writes (MODEL.html's broadcast handler says so),
  // so its `ifRev` is genuinely behind and the store refuses the hide-save as
  // stale. The page keeps the edit and keeps saying UNSAVED: the failure mode
  // of a best-effort save is never "the drafter was told it was fine".
  test('a hide-save refused as stale leaves the page unsaved', async ({ page, context }) => {
    const before = await editedPage(page);

    // An unleased write from elsewhere. The store checks a lease only when one
    // is passed, so this lands and moves the revision out from under the first
    // page — which, being dirty, does not adopt it.
    const other = await context.newPage();
    await other.goto('/MODEL.html?mode=night');
    await other.waitForFunction(() => !!window.SharedFileStore, null, { timeout: 10000 });
    await other.evaluate(async bucket => {
      const S = window.SharedFileStore;
      const file = await S.loadSharedFile(bucket);
      const drawing = JSON.parse(await file.text());
      drawing.notes = [{ id: 'from-elsewhere', text: 'x' }];
      await S.saveSharedFile(
        new File([JSON.stringify(drawing)], 'drawing.json', { type: 'application/json' }),
        bucket);
    }, BUCKET);
    await page.waitForTimeout(400);

    await hideByPagehide(page);
    await page.waitForTimeout(SETTLE);

    await expect(page.locator('#save')).not.toHaveText('SAVED');
    expect(await beacon(page), 'a refused hide-save must leave the page dirty').toBe('1');
    const after = await readStore(page);
    expect(corner(after.drawing), 'and must not have overwritten the other page\'s write')
      .toMatchObject(corner(before.drawing));
    await other.close();
  });

  // ── 5 ──────────────────────────────────────────────────────────────────────
  // TWO LISTENERS, TWO CASES. Neither event is a superset of the other in
  // practice — visibilitychange is the iPad switching apps, pagehide is the
  // close — and a single case firing both would pass with either listener
  // deleted.
  test('visibilitychange to hidden saves on its own', async ({ page }) => {
    const before = await editedPage(page);
    await hideByVisibility(page);
    await expect(page.locator('#save')).toHaveText('SAVED', { timeout: 6000 });
    const after = await readStore(page);
    expect(after.rev).toBeGreaterThan(before.rev);
    expect(corner(after.drawing)).not.toMatchObject(corner(before.drawing));
  });

  test('pagehide saves on its own', async ({ page }) => {
    const before = await editedPage(page);
    await hideByPagehide(page);
    await expect(page.locator('#save')).toHaveText('SAVED', { timeout: 6000 });
    const after = await readStore(page);
    expect(after.rev).toBeGreaterThan(before.rev);
    expect(corner(after.drawing)).not.toMatchObject(corner(before.drawing));
  });

  // ── 6 ──────────────────────────────────────────────────────────────────────
  // NOT IN THE WORK ORDER'S LIST, AND THE TABLE LIES WITHOUT IT. The order asks
  // that "drop the dirty guard" be killed by a revision-count assertion, and
  // every other case here is dirty before it hides — so a page that wrote on
  // EVERY hide would pass all of them. Nothing to save is not a reason to
  // write: it spends a revision, and every revision spent is a stale refusal
  // waiting to happen somewhere else.
  test('hiding a clean page writes nothing', async ({ page }) => {
    await houseOnOldPage(page);
    await writeFixture(page);
    await openModelPage(page);
    const before = await readStore(page);
    expect(await beacon(page), 'the page must be clean before it is hidden').toBe('0');

    await hideByVisibility(page);
    await hideByPagehide(page);
    await page.waitForTimeout(SETTLE);

    expect((await readStore(page)).rev, 'a clean hide must not spend a revision')
      .toBe(before.rev);
  });
});

// ── rung 4a — the hide-save / lease-release ordering ─────────────────────────
//
// Spec of record: RULING-autosave-two-writers.md §3.4, and the rung-4 code this
// extends.
//
// Rung 4 was correct and its COMMENT was not. It said listener registration
// order put the write out "while the page still holds the lease", but
// registration order settles the CALL order; the write is asynchronous and the
// release listener ran while it was still in flight. It happened to work — both
// paths reach IndexedDB through one cached connection, so the write's
// transaction was created first and IndexedDB serialises overlapping
// transactions in creation order — which is a guarantee two levels below the
// one the comment named, and one added `await` from inverting silently.
//
// The release now waits on the write. These cases are about COMPLETION order,
// which is what the rung-4 cases could not see: swapping the two listeners is
// already caught by 'pagehide saves on its own' above, and an assertion on call
// order would only re-test that.
//
// The note about dispatched events applies here too: this proves what the
// handlers do when they run, not that a browser fires them.
test.describe('rung 4a — the release waits for the write', () => {

  // Both store entry points, logged on the way in and on the way out. The page
  // looks `saveSharedFile` and `releaseLease` up on the store object at call
  // time, so patching the object is enough.
  const instrument = page => page.evaluate(() => {
    const S = window.SharedFileStore;
    window.__order = [];
    const write = S.saveSharedFile, release = S.releaseLease;
    S.saveSharedFile = (...args) => {
      window.__order.push('write:call');
      return write.apply(S, args).then(
        value => { window.__order.push('write:done'); return value; },
        error => { window.__order.push('write:failed'); throw error; });
    };
    S.releaseLease = (...args) => {
      window.__order.push('release:call');
      return release.apply(S, args).then(
        value => { window.__order.push('release:done'); return value; },
        error => { window.__order.push('release:failed'); throw error; });
    };
  });
  const order = page => page.evaluate(() => window.__order);

  const leaseNow = page => page.evaluate(async bucket =>
    window.SharedFileStore.readLease(bucket, 'model'), BUCKET);
  const myHolderId = page => page.evaluate(() => window.SharedFileStore.leaseHolderId());

  // ── 1 ────────────────────────────────────────────────────────────────────
  // THE COMPLETION ORDER, WHICH IS THE WHOLE RUNG. Not "the release was called
  // second" — rung 4 had that — but "the release had not even been asked for
  // until the write had finished".
  test('the release does not land before the hide-save\'s write', async ({ page }) => {
    await editedPage(page);
    await instrument(page);

    await hideByPagehide(page);
    await expect(page.locator('#save')).toHaveText('SAVED', { timeout: 6000 });
    await page.waitForTimeout(SETTLE);

    const log = await order(page);
    expect(log, 'the write must have run and finished').toContain('write:done');
    expect(log, 'and the release must have run').toContain('release:call');
    expect(log.indexOf('write:done'),
      'the release must not be asked for until the write has settled')
      .toBeLessThan(log.indexOf('release:call'));
  });

  // ── 2 ────────────────────────────────────────────────────────────────────
  // THE REGRESSION THE CHAINING COULD INTRODUCE, and the one a first draft gets
  // wrong by chaining on resolve. A refused write must still give the lease up:
  // holding it because our own save failed costs the next drafter the full TTL
  // for nothing.
  test('a hide-save whose write fails still releases the lease', async ({ page, context }) => {
    await editedPage(page);
    const mine = await myHolderId(page);
    expect((await leaseNow(page))?.holderId, 'this page must hold the lease first').toBe(mine);

    // An unleased write from elsewhere moves the revision; this page is dirty,
    // so it deliberately does not adopt it, and its own write is refused stale.
    const other = await context.newPage();
    await other.goto('/MODEL.html?mode=night');
    await other.waitForFunction(() => !!window.SharedFileStore, null, { timeout: 10000 });
    await other.evaluate(async bucket => {
      const S = window.SharedFileStore;
      const file = await S.loadSharedFile(bucket);
      const drawing = JSON.parse(await file.text());
      drawing.notes = [{ id: 'from-elsewhere', text: 'x' }];
      await S.saveSharedFile(
        new File([JSON.stringify(drawing)], 'drawing.json', { type: 'application/json' }), bucket);
    }, BUCKET);
    await page.waitForTimeout(400);
    await instrument(page);

    await hideByPagehide(page);
    await page.waitForTimeout(SETTLE);

    const log = await order(page);
    expect(log, 'the write must really have been refused').toContain('write:failed');
    expect(await leaseNow(page), 'and the lease must be gone all the same').toBeNull();
    await other.close();
  });

  // ── 3 ────────────────────────────────────────────────────────────────────
  // A BACKGROUNDED TAB IS COMING BACK. Only pagehide gives the lease up; a
  // drafter who switched apps to read their mail must not return to a page that
  // handed its lease away. This is the case that notices if the two handlers
  // are ever merged into one.
  test('a hidden-but-not-unloading tab keeps its lease', async ({ page }) => {
    await editedPage(page);
    const mine = await myHolderId(page);

    await hideByVisibility(page);
    await expect(page.locator('#save')).toHaveText('SAVED', { timeout: 6000 });
    await page.waitForTimeout(SETTLE);

    expect((await leaseNow(page))?.holderId,
      'visibilitychange must not release the lease').toBe(mine);
    await expect(page.locator('body')).toHaveAttribute('data-lease-held', '1');
  });
});
