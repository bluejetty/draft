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
