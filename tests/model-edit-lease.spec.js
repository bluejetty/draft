// AUTOSAVE RULING, RUNG 3 — the named edit lease.
//
// Spec of record: RD-DOCUMENTS/RULING-autosave-two-writers.md §2, §3.1, §3.2
// and §4 rung 3 including its 9 SEP amendment.
//
// Rung 2 made a clean page stop being stale. It did nothing for two pages that
// are both being edited, and was never meant to: the ruling calls the broadcast
// the preventer and the lease the RESOLVER.
//
// The lease is the only thing in this design that protects work BEFORE it is
// written. `ifRev` catches a collision when it is already too late to do
// anything good — the drafter has made the edit, pressed the thing, and now
// learns they cannot have it. A lease means the second page never let them
// start.
//
// It does not make concurrent editing safe. It makes concurrent editing
// REFUSED, visibly, with the loser's work intact.
const { test, expect } = require('@playwright/test');

// A bucket of this file's own. The model pages claim `model` on
// `model-drawing` as soon as they load, and a store-level test sharing that
// bucket would be measuring the page's claim as often as its own.
const PROBE = 'lease-probe';
const SCOPE = 'model';

// Any page that carries the store. It is loaded for `window.SharedFileStore`
// and nothing else.
async function storePage(page) {
  await page.goto('/MODEL.html?mode=night');
  await page.waitForFunction(() => !!window.SharedFileStore, null, { timeout: 10000 });
  return page;
}

const inPage = (page, fn, arg) => page.evaluate(fn, arg);

test.describe('rung 3 — the lease lives in its own key', () => {

  // ── 1 ──────────────────────────────────────────────────────────────────────
  // THE SINGLE MOST IMPORTANT TEST IN THE DESIGN (§2, §3.1). If the lease lives
  // in the records array, every heartbeat is a revision bump and every bump is
  // a stale refusal somewhere else — the mechanism would generate precisely the
  // storm it exists to prevent.
  //
  // MUTATION: store the lease as a record in the bucket. Fails.
  test('a claim and ten renewals do not change the bucket\'s revision',
    async ({ page }) => {
      await storePage(page);
      const seen = await inPage(page, async ({ bucket, scope }) => {
        const S = window.SharedFileStore;
        // A real write first, so the revision under test is a live number and
        // not zero. A bucket that never held anything would report "unchanged"
        // for free.
        await S.saveSharedFile(new File(['{}'], 'd.json', { type: 'application/json' }), bucket);
        const before = await S.readBucket(bucket);
        await S.claimLease(bucket, scope, 'holder-a', { ttlMs: 15000 });
        for (let i = 0; i < 10; i += 1) {
          await S.renewLease(bucket, scope, 'holder-a', { ttlMs: 15000 });
        }
        const after = await S.readBucket(bucket);
        return {
          revBefore: before.rev, revAfter: after.rev,
          recordsBefore: before.records.length, recordsAfter: after.records.length,
        };
      }, { bucket: PROBE, scope: SCOPE });

      expect(seen.revBefore, 'the probe wrote something, so the revision is a real number')
        .toBeGreaterThan(0);
      expect(seen.revAfter,
        'a claim and ten renewals must not move the data revision — a lease in '
        + 'the records array makes every heartbeat a stale refusal somewhere else')
        .toBe(seen.revBefore);
      expect(seen.recordsAfter,
        'and the records array must be exactly what it was').toBe(seen.recordsBefore);
    });

  // A held lease is named, so a banner can say WHO has it rather than that
  // somebody does.
  test('readLease names the holder, and an unheld scope reads as null',
    async ({ page }) => {
      await storePage(page);
      const seen = await inPage(page, async ({ bucket, scope }) => {
        const S = window.SharedFileStore;
        const empty = await S.readLease(bucket, scope);
        const granted = await S.claimLease(bucket, scope, 'holder-a', { ttlMs: 15000 });
        const held = await S.readLease(bucket, scope);
        return { empty, granted, held, now: Date.now() };
      }, { bucket: PROBE, scope: SCOPE });

      expect(seen.empty, 'nothing holds it yet').toBeNull();
      expect(seen.granted.ok).toBe(true);
      expect(seen.held.holderId).toBe('holder-a');
      expect(seen.held.until, 'the lease expires at a time it carries')
        .toBeGreaterThan(seen.now);
    });

  // §3.1: claim grants if unheld, expired, OR ALREADY THIS HOLDER — which makes
  // claim and renew one operation and removes a race. And a renewal is not a
  // change of holder, so the generation must not move.
  test('the holder can re-claim its own lease, and that is not a new generation',
    async ({ page }) => {
      await storePage(page);
      const seen = await inPage(page, async ({ bucket, scope }) => {
        const S = window.SharedFileStore;
        const first = await S.claimLease(bucket, scope, 'holder-a', { ttlMs: 15000 });
        const again = await S.claimLease(bucket, scope, 'holder-a', { ttlMs: 15000 });
        const other = await S.claimLease(bucket, scope, 'holder-b', { ttlMs: 15000 });
        return { first, again, other };
      }, { bucket: PROBE, scope: SCOPE });

      expect(seen.again.ok, 'the holder is always granted its own lease').toBe(true);
      expect(seen.again.generation,
        'a renewal is not a change of holder — the generation must not move')
        .toBe(seen.first.generation);
      expect(seen.other.ok, 'and a second holder is refused while it is held').toBe(false);
      expect(seen.other.holderId,
        'the refusal names who has it, so a banner can too').toBe('holder-a');
    });

  test('a release frees the lease, and only the holder may release it',
    async ({ page }) => {
      await storePage(page);
      const seen = await inPage(page, async ({ bucket, scope }) => {
        const S = window.SharedFileStore;
        await S.claimLease(bucket, scope, 'holder-a', { ttlMs: 15000 });
        await S.releaseLease(bucket, scope, 'holder-b');       // not the holder
        const afterStranger = await S.readLease(bucket, scope);
        const held = await S.claimLease(bucket, scope, 'holder-a', { ttlMs: 15000 });
        await S.releaseLease(bucket, scope, 'holder-a');       // the holder
        const afterHolder = await S.readLease(bucket, scope);
        const reclaim = await S.claimLease(bucket, scope, 'holder-b', { ttlMs: 15000 });
        return { afterStranger, afterHolder, reclaim, firstGen: held.generation };
      }, { bucket: PROBE, scope: SCOPE });

      expect(seen.afterStranger?.holderId,
        'a page that does not hold the lease cannot release it out from under '
        + 'the page that does').toBe('holder-a');
      expect(seen.afterHolder, 'the holder released it').toBeNull();
      expect(seen.reclaim.ok, 'so the next page gets it').toBe(true);
      // THE GENERATION NEVER GOES BACKWARDS, which is why a released lease is
      // expired rather than deleted. Delete the record and the next holder
      // starts at 1 again — and a generation that can repeat is one a stale
      // page's saved generation can match, which is the resume path's guard
      // silently inverted.
      //
      // MUTATION: delete the key on release instead of expiring it. Fails here.
      expect(seen.reclaim.generation,
        'a new holder after a release is a new generation, not a reused one')
        .toBeGreaterThan(seen.firstGen);
    });
});

test.describe('rung 3 — the write gate', () => {

  // ── 2 ──────────────────────────────────────────────────────────────────────
  // MUTATION: check the lease AFTER the mutate. Fails on the CONTENTS, not just
  // on the error — which is why this asserts the bucket is unchanged before it
  // asserts anything about what was thrown.
  test('a write with a lease held by someone else is refused and the bucket is '
    + 'unchanged', async ({ page }) => {
      await storePage(page);
      const seen = await inPage(page, async ({ bucket, scope }) => {
        const S = window.SharedFileStore;
        const rev = await S.saveSharedFile(
          new File(['{"who":"first"}'], 'd.json', { type: 'application/json' }), bucket);
        const held = await S.claimLease(bucket, scope, 'holder-a', { ttlMs: 15000 });

        let outcome = 'written';
        try {
          await S.saveSharedFile(
            new File(['{"who":"intruder"}'], 'd.json', { type: 'application/json' }), bucket,
            { ifRev: rev, lease: { scope, holderId: 'holder-b', generation: held.generation } });
        } catch (error) {
          outcome = error?.lease ? 'lease-refused' : `other: ${error?.name}`;
        }
        const after = await S.readBucket(bucket);
        const file = after.records[0] && new File([after.records[0].blob], 'x');
        return { outcome, rev, revAfter: after.rev, body: file ? await file.text() : null };
      }, { bucket: PROBE, scope: SCOPE });

      // THE EFFECT BEFORE THE WORDING.
      expect(seen.body, 'the bucket must still hold the first page\'s file')
        .toBe('{"who":"first"}');
      expect(seen.revAfter, 'and its revision must not have moved').toBe(seen.rev);
      expect(seen.outcome, 'and the write must have been refused as a LEASE '
        + 'failure, not as something else').toBe('lease-refused');
    });

  test('the holder writes through its own lease', async ({ page }) => {
    await storePage(page);
    const seen = await inPage(page, async ({ bucket, scope }) => {
      const S = window.SharedFileStore;
      const rev = await S.saveSharedFile(
        new File(['{"who":"first"}'], 'd.json', { type: 'application/json' }), bucket);
      const held = await S.claimLease(bucket, scope, 'holder-a', { ttlMs: 15000 });
      let outcome = 'written';
      try {
        await S.saveSharedFile(
          new File(['{"who":"holder"}'], 'd.json', { type: 'application/json' }), bucket,
          { ifRev: rev, lease: { scope, holderId: 'holder-a', generation: held.generation } });
      } catch (error) { outcome = `refused: ${error?.name}`; }
      const after = await S.readBucket(bucket);
      const file = after.records[0] && new File([after.records[0].blob], 'x');
      return { outcome, body: file ? await file.text() : null };
    }, { bucket: PROBE, scope: SCOPE });

    // THE CONTROL. Without it every refusal test above passes for free on a
    // gate that refuses everybody.
    expect(seen.outcome, 'the page holding the lease must be able to write').toBe('written');
    expect(seen.body).toBe('{"who":"holder"}');
  });

  // §3.2: ifRev STILL APPLIES AND IS STILL REQUIRED. The lease prevents the
  // collision; ifRev catches the case where prevention failed. A page that drops
  // ifRev because it holds a lease has reintroduced audit C3.
  test('holding the lease does not excuse a stale ifRev', async ({ page }) => {
    await storePage(page);
    const seen = await inPage(page, async ({ bucket, scope }) => {
      const S = window.SharedFileStore;
      await S.saveSharedFile(new File(['{"n":1}'], 'd.json', { type: 'application/json' }), bucket);
      const held = await S.claimLease(bucket, scope, 'holder-a', { ttlMs: 15000 });
      // Somebody wrote without a lease at all — LAYOUT does exactly this.
      const now = await S.saveSharedFile(
        new File(['{"n":2}'], 'd.json', { type: 'application/json' }), bucket);
      let outcome = 'written';
      try {
        await S.saveSharedFile(
          new File(['{"n":3}'], 'd.json', { type: 'application/json' }), bucket,
          { ifRev: now - 1, lease: { scope, holderId: 'holder-a', generation: held.generation } });
      } catch (error) { outcome = error?.stale ? 'stale-refused' : `other: ${error?.name}`; }
      return { outcome };
    }, { bucket: PROBE, scope: SCOPE });

    expect(seen.outcome, 'the lease prevents the collision; ifRev catches the '
      + 'case where prevention failed, and a lease may not excuse it')
      .toBe('stale-refused');
  });

  // ── 8, the store's half ────────────────────────────────────────────────────
  // LAYOUT keeps its present discipline, needs no lease, and MUST NOT BE ASKED
  // FOR ONE (§2). Omitting `lease` is exactly today's behaviour.
  test('a write with no lease argument is ungated, even while a lease is held',
    async ({ page }) => {
      await storePage(page);
      const seen = await inPage(page, async ({ bucket, scope }) => {
        const S = window.SharedFileStore;
        await S.claimLease(bucket, scope, 'holder-a', { ttlMs: 15000 });
        let outcome = 'written';
        try {
          await S.saveSharedFile(
            new File(['{"who":"layout"}'], 'd.json', { type: 'application/json' }), bucket);
        } catch (error) { outcome = `refused: ${error?.name}`; }
        const after = await S.readBucket(bucket);
        const file = after.records[0] && new File([after.records[0].blob], 'x');
        return { outcome, body: file ? await file.text() : null };
      }, { bucket: PROBE, scope: SCOPE });

      expect(seen.outcome, 'an unconverted caller must keep working exactly as '
        + 'it does today').toBe('written');
      expect(seen.body).toBe('{"who":"layout"}');
    });
});

test.describe('rung 3 — expiry and generation', () => {

  // ── 3 ──────────────────────────────────────────────────────────────────────
  // TESTS DRIVE THE CLOCK; THEY DO NOT SLEEP FIFTEEN SECONDS. `ttlMs` is a
  // per-call argument, so a test claims with a tiny one and waits out a REAL
  // expiry — no clock hook in product code, and nothing here depends on the
  // shipped constant's value.
  //
  // MUTATIONS: never expire; reuse the generation on takeover.
  test('an expired lease is claimable, and the old holder\'s generation is dead',
    async ({ page }) => {
      await storePage(page);
      const seen = await inPage(page, async ({ bucket, scope }) => {
        const S = window.SharedFileStore;
        const rev = await S.saveSharedFile(
          new File(['{"who":"first"}'], 'd.json', { type: 'application/json' }), bucket);
        const first = await S.claimLease(bucket, scope, 'holder-a', { ttlMs: 50 });
        await new Promise(done => setTimeout(done, 120));
        const second = await S.claimLease(bucket, scope, 'holder-b', { ttlMs: 15000 });

        // The first holder's ifRev is CURRENT — nothing has been written since.
        // Only the lease stands between it and the file.
        let outcome = 'written';
        try {
          await S.saveSharedFile(
            new File(['{"who":"ghost"}'], 'd.json', { type: 'application/json' }), bucket,
            { ifRev: rev, lease: { scope, holderId: 'holder-a', generation: first.generation } });
        } catch (error) { outcome = error?.lease ? 'lease-refused' : `other: ${error?.name}`; }

        const after = await S.readBucket(bucket);
        const file = after.records[0] && new File([after.records[0].blob], 'x');
        return {
          firstGen: first.generation, secondGen: second.generation,
          secondOk: second.ok, outcome, body: file ? await file.text() : null,
        };
      }, { bucket: PROBE, scope: SCOPE });

      expect(seen.secondOk, 'an expired lease is claimable — without this a '
        + 'closed tab bricks the drawing').toBe(true);
      expect(seen.secondGen, 'and a change of holder is a new generation')
        .toBeGreaterThan(seen.firstGen);
      expect(seen.body, 'the ghost must not have written').toBe('{"who":"first"}');
      expect(seen.outcome, 'the old holder is refused on its generation even '
        + 'though its ifRev is current').toBe('lease-refused');
    });

  // §3.4, THE RESUME PATH, at the store level. A holder whose lease expired
  // with NOBODY taking it gets it back at the SAME generation — nothing
  // happened, so there is nothing to tell the drafter about. The page-level
  // half of this (no banner) is the second stage of this rung.
  //
  // MUTATION: bump the generation on any re-claim — fails.
  test('a holder whose lease merely expired re-claims at the same generation',
    async ({ page }) => {
      await storePage(page);
      const seen = await inPage(page, async ({ bucket, scope }) => {
        const S = window.SharedFileStore;
        const first = await S.claimLease(bucket, scope, 'holder-a', { ttlMs: 50 });
        await new Promise(done => setTimeout(done, 120));
        const resumed = await S.claimLease(bucket, scope, 'holder-a', { ttlMs: 15000 });
        return { firstGen: first.generation, resumedGen: resumed.generation, ok: resumed.ok };
      }, { bucket: PROBE, scope: SCOPE });

      expect(seen.ok, 'nobody took it, so it is there to be resumed').toBe(true);
      expect(seen.resumedGen,
        'the generation must NOT move: a page that froze and woke up was not '
        + 'taken over, and a banner saying it was is a lie the drafter acts on')
        .toBe(seen.firstGen);
    });
});

// ── the pages ────────────────────────────────────────────────────────────────
// The store gate above is the authority; these are about what the two model
// pages do in front of it. A lease MODEL.html held and MODEL.dc.html ignored
// would be a banner over a page still autosaving on every keystroke, so both
// conversions are here.
const h = require('./helpers');

const BUCKET = 'model-drawing';
const MAIN_FL = 3;

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
    ['n', -10, -5, 10, -5], ['e', 10, -5, 10, 5],
    ['s', 10, 5, -10, 5], ['w', -10, 5, -10, -5],
  ].map(([id, sx, sz, ex, ez]) => ({
    id, start: { x: sx, y: 0, z: sz }, end: { x: ex, y: 0, z: ez },
    levelId: MAIN_FL, view: 'plan', wallType: 'stud_2x6',
    baseHeight: 0, topHeight: 8, refLine: 'left',
  })),
  lines: [], floors: [], roofs: [], shapes: [], outlines: [], dimensions: [],
  notes: [], underlays: [], fixtures: [], fenestrations: [], stairs: [],
  nextDrawingItemId: 9,
};

const readStore = page => page.evaluate(async bucket => {
  const file = await window.SharedFileStore.loadSharedFile(bucket);
  return JSON.parse(await file.text());
}, BUCKET);

async function openNew(page, { seed = false } = {}) {
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

const scaleOf = async page => {
  const hit = (await page.locator('#readout').textContent()).match(/scale ([\d.]+) px\/ft/);
  expect(hit, 'the readout publishes the scale').toBeTruthy();
  return Number(hit[1]);
};

async function drawWallOn(page, points) {
  const box = await page.locator('#plan').boundingBox();
  const scale = await scaleOf(page);
  await page.locator('[data-draw-wall]').click();
  for (const [x, z] of points) {
    const cx = box.width / 2 + x * scale;
    const cy = box.height / 2 + z * scale;
    expect(cx >= 0 && cx <= box.width && cy >= 0 && cy <= box.height,
      `world (${x}, ${z}) is off-canvas — the tap would land nowhere`).toBe(true);
    await page.mouse.click(box.x + cx, box.y + cy);
    await page.waitForTimeout(60);
  }
  await page.keyboard.press('Escape');
}

const holdsLease = page => page.evaluate(() => document.body.dataset.leaseHeld);

async function takeOverOn(page) {
  await page.locator('[data-take-over]').click();
  await expect(page.locator('body')).toHaveAttribute('data-lease-held', '1', { timeout: 8000 });
}

test.describe('rung 3 — the pages in front of the gate', () => {

  // ── 5 ──────────────────────────────────────────────────────────────────────
  // ASSERTED AS DISABLED, NEVER CLICKED. A click on a disabled button is not a
  // failing click — Playwright waits for it to become enabled and burns the
  // whole test timeout, which is three minutes to say what one attribute says
  // now. That is how the first repair pass arrived: hangs, not refusals.
  test('a second page opens read-only, naming the holder', async ({ page, context }) => {
    await openNew(page, { seed: true });
    await expect(page.locator('body')).toHaveAttribute('data-lease-held', '1', { timeout: 8000 });
    // THE NEGATIVE HALF. Every "the banner is visible" assertion in this file was
    // satisfied by two worlds until now: the banner really appearing, and the
    // banner never having been hidden at all — which is exactly the bug that
    // shipped, an inline `display` beating the browser's `[hidden]`. Asserting
    // it is GONE while this page holds the lease is what makes the visible
    // assertions mean something.
    await expect(page.locator('[data-lease-banner]'),
      'the page holding the lease shows no banner').toBeHidden();
    const holder = await page.evaluate(() => window.SharedFileStore.leaseHolderId());

    const second = await openNew(await context.newPage());
    await expect(second.locator('body'),
      'the second page must not hold the lease').toHaveAttribute('data-lease-held', '0', { timeout: 8000 });
    await expect(second.locator('#save'),
      'and SAVE is disabled rather than hidden — a missing button reads as a broken page')
      .toBeDisabled();
    await expect(second.locator('[data-lease-banner]')).toBeVisible();
    await expect(second.locator('[data-lease-banner]'),
      'and the banner names WHICH page has it, not merely that one does')
      .toHaveAttribute('data-lease-holder', holder);
  });

  // ── 4 ──────────────────────────────────────────────────────────────────────
  // THE TEST THAT WOULD HAVE CAUGHT §0. The old page writes on every edit; if it
  // does that while MODEL.html holds the lease, the lease is decoration.
  //
  // MUTATION: drop the gate in `_markUnsaved`. Fails.
  test('the old page\'s autosave cannot land while MODEL.html holds the lease',
    async ({ page, context }) => {
      await h.openModel(page, { rails: false, entryCoach: true });
      await expect(page.locator('[data-entry-coach]')).toBeVisible({ timeout: 4000 });
      await page.locator('[data-first-bone-press]').click();
      await h.waitForSaved(page);
      await h.openModel(page, { rails: true });
      await h.openRails(page);
      await h.waitForSaved(page);
      const before = h.allLines(await h.savedDrawing(page)).length;
      await expect(page.locator('body')).toHaveAttribute('data-lease-held', '1', { timeout: 8000 });
      await expect(page.locator('[data-lease-banner]'),
        'the old page holds the lease and shows no banner — without this the '
        + 'assertion further down passes on a banner that was never hidden')
        .toBeHidden();

      // MODEL.html takes the file.
      const modern = await context.newPage();
      await modern.goto('/MODEL.html?mode=night');
      await expect(modern.locator('#readout')).toContainText('walls', { timeout: 8000 });
      await takeOverOn(modern);
      await expect(page.locator('body'),
        'the old page must notice it lost the lease on its own heartbeat')
        .toHaveAttribute('data-lease-held', '0', { timeout: 10000 });

      // AND NOW IT EDITS ANYWAY.
      await h.selectTool(page, 'Line');
      await h.clickWorld(page, -4, 0);
      await h.clickWorld(page, 4, 0);
      await page.keyboard.press('Enter');
      await page.waitForTimeout(1200);

      // THE EFFECT BEFORE THE WORDING.
      expect(h.allLines(await h.savedDrawing(page)),
        'the old page must not have written — that is the whole of the lease')
        .toHaveLength(before);
      await expect(page.locator('[data-model-status]'),
        'and the edit is kept, unsaved, not discarded').toHaveText('UNSAVED');
      await expect(page.locator('[data-lease-banner]')).toBeVisible();

      // AND THE DRAFTER STILL HAS IT. A gate that dropped the edit would be the
      // eat wearing a lease.
      await page.keyboard.press('Control+z');
      await expect(page.locator('[data-model-drawing-message]'))
        .toContainText('Undone', { timeout: 4000 });
    });

  // ── 6 ──────────────────────────────────────────────────────────────────────
  // Someone loses work here; the ruling is only that they must CHOOSE to.
  test('a taken-over dirty page is refused, not eaten', async ({ page, context }) => {
    await openNew(page, { seed: true });
    await expect(page.locator('body')).toHaveAttribute('data-lease-held', '1', { timeout: 8000 });
    await drawWallOn(page, [[-6, -2], [0, -2]]);
    await expect(page.locator('#save')).toHaveText('UNSAVED');
    await expect(page.locator('[data-lease-banner]'),
      'no banner while it still holds the lease').toBeHidden();

    const other = await openNew(await context.newPage());
    await takeOverOn(other);

    await expect(page.locator('body'),
      'the first page loses it on its next heartbeat')
      .toHaveAttribute('data-lease-held', '0', { timeout: 10000 });

    // ITS COPY STAYS IN MEMORY, DIRTY. The wall it drew is still on screen and
    // still absent from the store.
    expect((await page.locator('#readout').textContent()).match(/walls (\d+)/)[1],
      'the drafter\'s unsaved wall is still there').toBe('5');
    expect((await readStore(page)).walls,
      'and it never reached the store').toHaveLength(4);
    await expect(page.locator('#save'), 'and it cannot write it').toBeDisabled();
    await expect(page.locator('[data-lease-banner]')).toBeVisible();
  });

  // THE PRESS-THEN-LOSE RACE, and the only thing that exercises MODEL.html's
  // half of the STORE gate.
  //
  // The page refuses its own write when it knows it is read-only, and that guard
  // is what tests 5 and 6 above measure. But it means the `lease` argument the
  // page hands the store is never actually tested by them: drop it and every one
  // of those still passes, because the page never gets far enough to need it.
  // That mutation (L8) survived the first table, which is what this test is for.
  //
  // The window is real, not contrived. A page learns it lost the lease on its
  // next heartbeat, TTL/4 away, and a drafter can press SAVE inside that window —
  // believing, correctly as far as it knows, that it still holds the file. The
  // store is the only thing standing there.
  //
  // MUTATION: drop the `lease` argument from MODEL.html's save. Fails — the write
  // lands.
  test('a save pressed in the window before the page learns it lost the lease is '
    + 'refused by the store', async ({ page, context }) => {
      await openNew(page, { seed: true });
      await expect(page.locator('body')).toHaveAttribute('data-lease-held', '1', { timeout: 8000 });
      await drawWallOn(page, [[-6, -2], [0, -2]]);
      await expect(page.locator('#save')).toHaveText('UNSAVED');
      await expect(page.locator('[data-lease-banner]'),
        'no banner while it still holds the lease').toBeHidden();

      const other = await openNew(await context.newPage());
      await takeOverOn(other);

      // INSIDE THE HEARTBEAT WINDOW, and checked rather than hoped: if this page
      // has already noticed, SAVE is disabled and the press below would wait for
      // an enabled button until the test times out. Better to say so here.
      expect(await holdsLease(page),
        'this page must still BELIEVE it holds the lease — the heartbeat beat the '
        + 'test to it, so the race this stands in front of was not staged')
        .toBe('1');

      await page.locator('#save').click();
      await page.waitForTimeout(1200);

      // THE EFFECT BEFORE THE WORDING.
      expect((await readStore(page)).walls,
        'the store must have refused it: this page presented a generation that is '
        + 'no longer current, and nothing but the store was left to notice')
        .toHaveLength(4);
      await expect(page.locator('#save'),
        'and the drafter still has the edit, unsaved').toHaveText('UNSAVED');
      await expect(page.locator('[data-lease-banner]'),
        'and now the page knows too').toBeVisible();
    });

  // ── 7 ──────────────────────────────────────────────────────────────────────
  // §3.4, THE RESUME PATH, at the page. The probe produced a 22.6-second freeze
  // with the lease dead for 7.6s of it and the generation unchanged; without
  // this the drafter comes back to a read-only page holding their dirty edits,
  // which the ruling calls the sharpest edge in the design.
  //
  // The lease is aged rather than the page frozen: the test re-claims the page's
  // OWN holder id with a 1ms ttl, which expires it without changing hands. What
  // the page does next is the page's own heartbeat, unmodified.
  //
  // MUTATION: bump the generation on any re-claim. Fails.
  test('a holder whose lease expired with nobody taking it resumes in silence',
    async ({ page }) => {
      await openNew(page, { seed: true });
      await expect(page.locator('body')).toHaveAttribute('data-lease-held', '1', { timeout: 8000 });
      await drawWallOn(page, [[-6, -2], [0, -2]]);

      // THE SETUP IS THE PART THAT FAILED ON CI, and it failed silently in a way
      // this code could not report. It aged the lease by re-claiming with a 1ms
      // ttl and never looked at whether the claim was GRANTED. Two different
      // causes produce the identical observation — the page's own heartbeat
      // landing between the claim and the read back, or a live lease under
      // another holder correctly REFUSING the claim so the ageing never happened
      // at all — and both hand back a live record with the generation unchanged.
      // Sub-millisecond on an unshared box; 582ms to fail on a shared runner.
      //
      // A setup step that can silently not happen is the same defect as a
      // mutation that never applied. So this one reports: it asserts the claim
      // was granted, and it retries until it has OBSERVED the lease dead rather
      // than assuming one attempt did it.
      const aged = await page.evaluate(async bucket => {
        const S = window.SharedFileStore;
        const mine = S.leaseHolderId();
        const before = await S.readLease(bucket, 'model');
        let granted = null;
        let observedDead = false;
        for (let i = 0; i < 60 && !observedDead; i += 1) {
          granted = await S.claimLease(bucket, 'model', mine, { ttlMs: 1 });
          if (!granted.ok) break;
          observedDead = (await S.readLease(bucket, 'model')) === null;
        }
        return { gen: before.generation, observedDead, granted, mine };
      }, BUCKET);
      expect(aged.granted && aged.granted.ok,
        `the ageing claim must be granted — this page holds the lease, so a refusal `
        + `means something else does (${JSON.stringify(aged.granted)}) and the `
        + `expiry this test rests on never happened`)
        .toBe(true);
      expect(aged.observedDead,
        "the lease must really have been seen expired before the wake-up — if the "
        + "page's heartbeat won all sixty attempts, this test never staged the "
        + 'thing it is about')
        .toBe(true);

      // One heartbeat later, with nothing else touching it.
      await page.waitForTimeout(6000);

      expect(await holdsLease(page),
        'the page resumed its own lease').toBe('1');
      const now = await page.evaluate(bucket =>
        window.SharedFileStore.readLease(bucket, 'model'), BUCKET);
      expect(now.generation,
        'and at the SAME generation — nobody took it, so nothing happened')
        .toBe(aged.gen);
      await expect(page.locator('[data-changed-elsewhere]'),
        'so the drafter is told nothing at all: a banner here is a lie they act on')
        .toBeHidden();
      await expect(page.locator('[data-lease-banner]'),
        'and no read-only banner ever appeared').toBeHidden();
      await expect(page.locator('#save'), 'and they can still save').toBeEnabled();
    });

  // THE FLUSH IS SAFE BECAUSE `ifRev` STILL APPLIES, and that was inherited
  // rather than asserted until this test. An edit made while the page was
  // read-only is written when the lease arrives — so if the bucket MOVED while
  // it was read-only, that write must be refused, not land on top.
  test('an edit held back by the gate is refused, not applied over a bucket that '
    + 'moved underneath', async ({ page, context }) => {
      await h.openModel(page, { rails: false, entryCoach: true });
      await expect(page.locator('[data-entry-coach]')).toBeVisible({ timeout: 4000 });
      await page.locator('[data-first-bone-press]').click();
      await h.waitForSaved(page);
      await h.openModel(page, { rails: true });
      await h.openRails(page);
      await h.waitForSaved(page);

      const modern = await context.newPage();
      await modern.goto('/MODEL.html?mode=night');
      await expect(modern.locator('#readout')).toContainText('walls', { timeout: 8000 });
      await takeOverOn(modern);
      await expect(page.locator('body')).toHaveAttribute('data-lease-held', '0', { timeout: 10000 });

      // The old page edits while it cannot write. The edit is held back.
      await h.selectTool(page, 'Line');
      await h.clickWorld(page, -4, 0);
      await h.clickWorld(page, 4, 0);
      await page.keyboard.press('Enter');
      await page.waitForTimeout(400);

      // AND THE BUCKET MOVES UNDERNEATH IT — an ungated writer, the one kind the
      // lease does not cover.
      await modern.evaluate(async bucket => {
        const file = await window.SharedFileStore.loadSharedFile(bucket);
        const drawing = JSON.parse(await file.text());
        drawing.walls[0].start.z -= 3;
        await window.SharedFileStore.saveSharedFile(
          new File([JSON.stringify(drawing)], 'drawing.json', { type: 'application/json' }), bucket);
      }, BUCKET);
      const theirs = (await readStore(page)).walls[0].start.z;

      // The old page gets the lease back and flushes what it held.
      await page.locator('[data-take-over]').click();
      await expect(page.locator('body')).toHaveAttribute('data-lease-held', '1', { timeout: 8000 });
      await page.waitForTimeout(1500);

      expect((await readStore(page)).walls[0].start.z,
        'the flushed write must have been refused on `ifRev`, not applied over '
        + 'the corner that moved while this page was read-only')
        .toBeCloseTo(theirs, 6);
      await expect(page.locator('[data-model-status]'),
        'and the drafter still has their line, unsaved').toHaveText('UNSAVED');
    });
});
