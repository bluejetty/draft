// AUTOSAVE RULING, RUNG 2 — the change broadcast.
//
// Spec of record: RD-DOCUMENTS/RULING-autosave-two-writers.md §3.3 and §4.
//
// Rung 1 turned the eat into a refusal. It did not stop the refusals coming,
// and §0's second bug is a refusal with no conflict behind it at all:
// MODEL.html reads its revision once at load and nothing ever refreshes it, so
// one LAYOUT sheet edit — a write to a key this page does not touch — refuses
// every save until the drafter reloads, and reloading is what costs them the
// corner they have not saved.
//
// A page that hears "this bucket is now rev 9" and re-reads is never stale, so
// it never has anything to overwrite. That is the whole rung: a PREVENTER, not
// a resolver. It does not make two pages safe to edit at once.
//
// THE DIRTY HALF IS THE HALF THAT MATTERS. A page that live-reloads over an
// unsaved edit throws away the drafter's work to avoid throwing away someone
// else's — the same defect the ruling exists to remove — so every test that
// asserts a re-read has a sibling asserting the re-read did NOT happen.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const MAIN_FL = 3;

// The rectangle from the rung 1 spec: x -10..10, z -5..5. Symmetric about the
// origin, so MODEL.html's fit() puts world (0,0) at the canvas centre and the
// readout's px/ft is the whole of the transform this file needs.
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

// ── the store, reached the way a page reaches it ─────────────────────────────
const putDrawing = (page, drawing) => page.evaluate(async ({ bucket, data }) => {
  await window.SharedFileStore.saveSharedFile(
    new File([JSON.stringify(data)], 'drawing.json', { type: 'application/json' }), bucket);
}, { bucket: BUCKET, data: drawing });

const readStore = page => page.evaluate(async bucket => {
  const file = await window.SharedFileStore.loadSharedFile(bucket);
  return JSON.parse(await file.text());
}, BUCKET);

// A foreign writer: reads what is there, changes it, writes it back. Whoever
// this runs in is a different page instance from the one under test, so its
// writerId differs and the page under test must treat it as somebody else.
const foreignWrite = (page, src) => page.evaluate(async ({ bucket, source }) => {
  const file = await window.SharedFileStore.loadSharedFile(bucket);
  const drawing = JSON.parse(await file.text());
  // eslint-disable-next-line no-new-func
  const out = new Function('d', source)(drawing) || drawing;
  await window.SharedFileStore.saveSharedFile(
    new File([JSON.stringify(out)], 'drawing.json', { type: 'application/json' }), bucket);
}, { bucket: BUCKET, source: src });

// ── MODEL.html, opened on the fixture ────────────────────────────────────────
// Seeded through a first visit, because the store is per-origin and the page
// refuses to show anything when the bucket is empty.
async function openNew(page, { seed = false } = {}) {
  await page.goto('/MODEL.html?mode=night');
  if (seed) {
    await page.waitForFunction(() => !!window.SharedFileStore, null, { timeout: 10000 });
    await putDrawing(page, FIXTURE);
    await page.goto('/MODEL.html?mode=night');
  }
  await expect(page.locator('#readout')).toContainText('walls 4/4', { timeout: 8000 });
  return page;
}

const wallsShown = async page => {
  const hit = (await page.locator('#readout').textContent()).match(/walls (\d+)\/(\d+)/);
  expect(hit, 'the readout publishes the wall count this file measures from').toBeTruthy();
  return `${hit[1]}/${hit[2]}`;
};

const scaleOf = async page => {
  const hit = (await page.locator('#readout').textContent()).match(/scale ([\d.]+) px\/ft/);
  expect(hit, 'the readout publishes the scale').toBeTruthy();
  return Number(hit[1]);
};

const tapAt = async (page, x, z) => {
  const box = await page.locator('#plan').boundingBox();
  const scale = await scaleOf(page);
  const cx = box.width / 2 + x * scale;
  const cy = box.height / 2 + z * scale;
  // A click off the canvas does nothing, and nothing is exactly what a broken
  // feature looks like. Guarded rather than read as "the wall would not commit".
  expect(cx >= 0 && cx <= box.width && cy >= 0 && cy <= box.height,
    `world (${x}, ${z}) is off-canvas at ${scale} px/ft — the tap would land nowhere`)
    .toBe(true);
  await page.mouse.click(box.x + cx, box.y + cy);
  await page.waitForTimeout(60);
};

// Draw mode chains: after a commit the pending start is the wall just ended,
// so n+1 taps draw n walls and Escape puts the chain down.
async function drawWalls(page, points) {
  await page.locator('[data-draw-wall]').click();
  for (const [x, z] of points) await tapAt(page, x, z);
  await page.keyboard.press('Escape');
}

const saveNew = async page => {
  await page.locator('#save').click();
  await expect(page.locator('#save')).toHaveText('SAVED', { timeout: 6000 });
};

test.describe('rung 2 — a committed change is broadcast, and a clean page adopts it', () => {

  // ── 1 ──────────────────────────────────────────────────────────────────────
  // MUTATION: never post the message. This fails — the second page keeps
  // showing the drawing it loaded and only a reload would move it.
  test('a clean second page picks up the first page\'s write without a reload',
    async ({ page, context }) => {
      await openNew(page, { seed: true });
      const watcher = await openNew(await context.newPage());

      await drawWalls(page, [[-6, -2], [0, -2]]);
      expect(await wallsShown(page), 'the writer really drew one').toBe('5/5');
      await saveNew(page);

      // NO RELOAD ANYWHERE BELOW. If this ever needs one, the rung is not built.
      await expect(page.locator('#readout')).toContainText('walls 5/5');
      await expect(watcher.locator('#readout'),
        'the clean page must show the wall it never drew')
        .toContainText('walls 5/5', { timeout: 6000 });
    });

  // ── 2 ──────────────────────────────────────────────────────────────────────
  // MUTATION: re-read regardless of dirty. This fails — and that mutation is
  // itself a work-eating bug, which is the right thing for a test to stand in
  // front of.
  test('a dirty second page does not re-read and keeps its edit',
    async ({ page, context }) => {
      await openNew(page, { seed: true });
      const drafter = await openNew(await context.newPage());

      // The drafter has one unsaved wall: 5 on screen, 4 in the store.
      await drawWalls(drafter, [[-6, 2], [0, 2]]);
      expect(await wallsShown(drafter)).toBe('5/5');
      await expect(drafter.locator('#save')).toHaveText('UNSAVED');

      // The other page saves TWO, so the store goes to 6 — a different number
      // from both 4 and 5. Equal counts would make a re-read and a refusal
      // look identical.
      await drawWalls(page, [[-6, -2], [0, -2], [6, -2]]);
      await saveNew(page);
      expect((await readStore(page)).walls, 'the store must really hold six').toHaveLength(6);

      // THE EFFECT BEFORE THE WORDING. 5/5 says both halves at once: the
      // drafter's own wall is still there, and the two from the other page are
      // not — nothing was re-read.
      await page.waitForTimeout(400);
      expect(await wallsShown(drafter),
        'a dirty page must re-read nothing: its own unsaved wall stays, and the '
        + 'other page\'s two must not appear')
        .toBe('5/5');
      await expect(drafter.locator('#save'),
        'and it must still say there is something unsaved').toHaveText('UNSAVED');

      // The note is separate, and second, because a note is not evidence that
      // a re-read was suppressed.
      await expect(drafter.locator('[data-changed-elsewhere]'),
        'a quiet note may say the drawing changed elsewhere').toBeVisible();
    });

  // ── 3 ──────────────────────────────────────────────────────────────────────
  // MUTATION: post from recordsReq.onsuccess instead of tx.oncomplete. The
  // transaction queues its puts inside onsuccess, so a listener that reads on a
  // message posted from there can legally read the pre-commit state.
  test('the message carries the committed rev, and a reader that reads on it '
    + 'sees the committed records', async ({ page, context }) => {
      await openNew(page, { seed: true });
      const reader = await context.newPage();
      await reader.goto('/MODEL.html?mode=night');
      await reader.waitForFunction(() => !!window.SharedFileStore, null, { timeout: 10000 });

      await reader.evaluate(bucket => {
        window.__heard = [];
        window.SharedFileStore.onBucketChanged(bucket, async change => {
          // Read ON the message, which is the whole point of the guarantee.
          const at = await window.SharedFileStore.readBucket(bucket);
          const file = at.records[0] && new File([at.records[0].blob], 'x');
          window.__heard.push({
            messageRev: change.rev,
            storeRev: at.rev,
            walls: file ? (JSON.parse(await file.text()).walls || []).length : -1,
            foreign: change.writerId !== window.SharedFileStore.writerId,
          });
        });
      }, BUCKET);

      await foreignWrite(page, 'd.walls = d.walls.slice(0, 2); return d;');

      await reader.waitForFunction(() => (window.__heard || []).length >= 1, null, { timeout: 6000 });
      const heard = await reader.evaluate(() => window.__heard);
      expect(heard, 'exactly one change was made').toHaveLength(1);
      expect(heard[0].messageRev,
        'the message must carry the revision the transaction committed')
        .toBe(heard[0].storeRev);
      expect(heard[0].walls,
        'and a read taken on the message must find the committed records, not '
        + 'the ones that were there before the put')
        .toBe(2);
      expect(heard[0].foreign, 'another page wrote it').toBe(true);
    });

  // MUTATION: post from onsuccess ahead of the ifRev check. This fails — a
  // write that was refused changed nothing, and announcing it would send every
  // clean page off to re-read a revision that does not exist.
  test('a refused write announces nothing', async ({ page, context }) => {
    await openNew(page, { seed: true });
    const reader = await context.newPage();
    await reader.goto('/MODEL.html?mode=night');
    await reader.waitForFunction(() => !!window.SharedFileStore, null, { timeout: 10000 });
    await reader.evaluate(bucket => {
      window.__heard = [];
      window.SharedFileStore.onBucketChanged(bucket, change => window.__heard.push(change));
    }, BUCKET);

    const refused = await page.evaluate(async bucket => {
      try {
        await window.SharedFileStore.saveSharedFile(
          new File(['{}'], 'drawing.json', { type: 'application/json' }), bucket, { ifRev: 99 });
        return 'written';
      } catch (error) { return error?.stale ? 'refused' : `failed: ${error?.message}`; }
    }, BUCKET);
    expect(refused, 'the write must really have been refused — otherwise this '
      + 'test is asserting silence about a write that never happened')
      .toBe('refused');

    await page.waitForTimeout(500);
    expect(await reader.evaluate(() => window.__heard),
      'a refused write changed nothing, so there is nothing to announce')
      .toHaveLength(0);
  });

  // M5's PREMISE, MEASURED — and only the premise.
  //
  // adoptStore takes the revision from the READ, not from the message, and the
  // comment there says why: by the time that read runs another page may have
  // written again, so the message's number would hand the next save an `ifRev`
  // that does not describe the drawing it is about to write. That claim is a
  // fact about the store, and it can be checked head-on: a listener that waits
  // before it reads finds a bucket that has already moved past the revision it
  // was told about.
  //
  // THIS DOES NOT COVER THE GUARD, and is not counted as covering it. MODEL.html
  // cancels an adopt the moment a newer message arrives (`adoptSeq`), so the
  // only ordering that reaches the mutation needs a SILENT write — a page with
  // no BroadcastChannel — committing inside the page's read window, a few
  // milliseconds between one page's postMessage and another page's listener
  // task. Nothing on this surface can pin that. The mutation stays a survivor
  // and is reported as unexercised; what is measured here is that the
  // divergence it is written against is real rather than theoretical.
  test('the revision a message carries can already be behind the store',
    async ({ page, context }) => {
      await openNew(page, { seed: true });
      const reader = await context.newPage();
      await reader.goto('/MODEL.html?mode=night');
      await reader.waitForFunction(() => !!window.SharedFileStore, null, { timeout: 10000 });
      await reader.evaluate(bucket => {
        window.__heard = [];
        window.SharedFileStore.onBucketChanged(bucket, async change => {
          const slot = window.__heard.push({ messageRev: change.rev, revAtRead: null }) - 1;
          // The wait is what makes the window big enough to place a write in on
          // purpose. A real page's window is the length of an IndexedDB read.
          await new Promise(done => setTimeout(done, 400));
          window.__heard[slot].revAtRead = (await window.SharedFileStore.readBucket(bucket)).rev;
        });
      }, BUCKET);

      await foreignWrite(page, 'd.walls = d.walls.slice(0, 3); return d;');
      await reader.waitForFunction(() => (window.__heard || []).length >= 1, null, { timeout: 6000 });
      // Inside the first listener's wait.
      await foreignWrite(page, 'd.walls = d.walls.slice(0, 2); return d;');

      await reader.waitForFunction(() => (window.__heard || [])[0]?.revAtRead !== null,
        null, { timeout: 6000 });
      const first = (await reader.evaluate(() => window.__heard))[0];
      expect(first.revAtRead,
        'the store moved on while the listener was between the message and its '
        + 'read — which is why the revision a page adopts must come from the read')
        .toBeGreaterThan(first.messageRev);
    });

  // ── 4 ──────────────────────────────────────────────────────────────────────
  // MUTATION: drop the writerId comparison. This fails — the page hears its own
  // save, is clean at that moment, re-reads, and the re-read replaces the
  // drawing the undo stack points into, so the drafter's history is gone every
  // time they press SAVE.
  test('a page ignores its own write', async ({ page }) => {
    await openNew(page, { seed: true });
    await drawWalls(page, [[-6, -2], [0, -2]]);
    expect(await wallsShown(page)).toBe('5/5');
    await saveNew(page);

    await page.waitForTimeout(400);
    await page.keyboard.press('Control+z');
    expect(await wallsShown(page),
      'undo must still reach the wall drawn before the save — a page that '
      + 're-read its own write would have replaced the drawing that history '
      + 'points into')
      .toBe('4/4');
    await expect(page.locator('#save'),
      'and an undo is an edit, so the page is unsaved again').toHaveText('UNSAVED');
  });

  // ── 5 ──────────────────────────────────────────────────────────────────────
  // §0's SECOND BUG, STATED AS A TEST, and the one a drafter would notice.
  // MODEL.html's storeRev is set at load and advanced only by its own save, so
  // one sheet edit in LAYOUT — a legitimate write to a key this page does not
  // touch — refuses every save from this page until it is reloaded.
  test('a clean MODEL.html whose bucket was bumped by a sheet edit can still '
    + 'save without a reload', async ({ page, context }) => {
      await openNew(page, { seed: true });
      const layout = await context.newPage();
      await layout.goto('/MODEL.html?mode=night');
      await layout.waitForFunction(() => !!window.SharedFileStore, null, { timeout: 10000 });

      // LAYOUT's whole write: re-read, put its one key on, write back.
      await foreignWrite(layout, "d.layout = { sheets: [{ id: 'A1', name: 'SITE PLAN' }] }; return d;");

      await page.waitForTimeout(500);
      await drawWalls(page, [[-6, -2], [0, -2]]);
      await page.locator('#save').click();
      await expect(page.locator('#save'),
        'the sheet edit touched no key this page owns, so the save must land')
        .toHaveText('SAVED', { timeout: 6000 });

      const saved = await readStore(page);
      expect(saved.walls, "the drafter's wall must be in the store").toHaveLength(5);
      expect(saved.layout?.sheets?.[0]?.name,
        'and the sheet must have survived it — a page that adopted the revision '
        + 'without re-reading the file would write its old copy over the sheet')
        .toBe('SITE PLAN');
    });
});

// ── the old page is half of this slice ───────────────────────────────────────
// A broadcast only MODEL.html hears leaves MODEL.dc.html refusing saves for
// exactly the reason rung 2 exists to remove.
test.describe('rung 2 — MODEL.dc.html hears it too', () => {

  async function oldPageOnFixture(page) {
    await h.openModel(page, { rails: false, entryCoach: true });
    await expect(page.locator('[data-entry-coach]')).toBeVisible({ timeout: 4000 });
    await page.locator('[data-first-bone-press]').click();
    await h.waitForSaved(page);
    await h.openModel(page, { rails: true });
    await h.openRails(page);
    await h.waitForSaved(page);
  }

  async function drawALine(page, x1, z1, x2, z2) {
    await h.selectTool(page, 'Line');
    await h.clickWorld(page, x1, z1);
    await h.clickWorld(page, x2, z2);
    await page.keyboard.press('Enter');
  }

  // MUTATION: never post the message. This fails — the old page stays on the
  // revision it loaded, its next edit is refused as a conflict, and the drafter
  // is told to reconcile two drawings that never disagreed.
  test('a clean old page adopts another page\'s model change instead of '
    + 'conflicting with it', async ({ page, context }) => {
      await oldPageOnFixture(page);
      const before = (await h.savedDrawing(page)).lines?.length || 0;

      const other = await context.newPage();
      await other.goto('/MODEL.html?mode=night');
      await other.waitForFunction(() => !!window.SharedFileStore, null, { timeout: 10000 });
      await foreignWrite(other, `
        d.lines = [...(d.lines || []), { id: 'foreign-1', levelId: ${MAIN_FL}, view: 'plan',
          layer: 'draft', start: { x: -30, y: 0, z: -30 }, end: { x: -20, y: 0, z: -30 } }];
        return d;`);

      await page.waitForTimeout(600);
      await drawALine(page, -4, 0, 4, 0);
      await h.waitForSaved(page);

      await expect(page.locator('[data-model-status]'),
        'the old page adopted the change before it wrote, so there is nothing '
        + 'to conflict about').toHaveText('SAVED');
      const saved = await h.savedDrawing(page);
      expect(h.allLines(saved),
        "both lines must be in the store — the other page's and this page's")
        .toHaveLength(before + 2);
    });

  // A DIRTY OLD PAGE RE-READS NOTHING EITHER, and on this page dirty is not a
  // rare state — it is where rung 1 leaves a drafter whose write was refused,
  // holding an edit and a conflict to resolve. Re-reading there would eat
  // exactly the work rung 1 was built to save.
  //
  // The staleness is made the way it happens in the wild: BY A WRITER THAT
  // DOES NOT ANNOUNCE. A browser with no BroadcastChannel still writes, and
  // §3.3 says so — it just does not live-reload. That is the whole of the
  // setup below, no test-only mode in the page.
  //
  // MUTATION: drop the persistenceStatus guard. This fails — the conflict and
  // the unsaved line are both replaced by whatever the other page wrote.
  test('a dirty old page holding a refused write re-reads nothing',
    async ({ page, context }) => {
      await oldPageOnFixture(page);
      const before = h.allLines(await h.savedDrawing(page)).length;

      // ── a silent writer makes the old page stale ─────────────────────────
      const silent = await context.newPage();
      await silent.addInitScript(() => { delete window.BroadcastChannel; });
      await silent.goto('/MODEL.html?mode=night');
      await silent.waitForFunction(() => !!window.SharedFileStore, null, { timeout: 10000 });
      await foreignWrite(silent, `
        d.lines = [...(d.lines || []), { id: 'silent-1', levelId: ${MAIN_FL}, view: 'plan',
          layer: 'draft', start: { x: -30, y: 0, z: -30 }, end: { x: -20, y: 0, z: -30 } }];
        return d;`);
      await page.waitForTimeout(400);

      // ── so the old page's next edit is refused, and it stays dirty ────────
      await drawALine(page, -4, 0, 4, 0);
      await expect(page.locator('[data-model-drawing-message]'),
        'the setup must really have produced a refusal, or this test is '
        + 'asserting things about a page that is not dirty')
        .toContainText('Another page saved this drawing', { timeout: 6000 });
      await expect(page.locator('[data-model-status]')).toHaveText('UNSAVED');

      // ── now an announcing writer commits ─────────────────────────────────
      const loud = await context.newPage();
      await loud.goto('/MODEL.html?mode=night');
      await loud.waitForFunction(() => !!window.SharedFileStore, null, { timeout: 10000 });
      await foreignWrite(loud, `
        d.lines = [...(d.lines || []), { id: 'loud-1', levelId: ${MAIN_FL}, view: 'plan',
          layer: 'draft', start: { x: 20, y: 0, z: 30 }, end: { x: 30, y: 0, z: 30 } }];
        return d;`);
      await page.waitForTimeout(700);

      // THE EFFECT BEFORE THE WORDING. The drafter's line is still there to be
      // undone; a page that had re-read would have replaced the drawing it
      // lives in and there would be nothing to undo.
      await page.keyboard.press('Control+z');
      await expect(page.locator('[data-model-drawing-message]'),
        'the unsaved line and its history must have survived the other page\'s write')
        .toContainText('Undone', { timeout: 4000 });
      await expect(page.locator('[data-model-status]'),
        'and the page must still be holding an unsaved edit').toHaveText('UNSAVED');
      expect(h.allLines(await h.savedDrawing(page)),
        'and nothing of this page\'s went into the store — only the two '
        + 'foreign lines are there')
        .toHaveLength(before + 2);
    });

  // MUTATION: drop the writerId comparison on the old page. This fails — the
  // old page writes on EVERY edit, so it would re-read and rebuild the drawing
  // after every single one.
  test('the old page ignores its own write', async ({ page }) => {
    await oldPageOnFixture(page);
    await drawALine(page, -4, 0, 4, 0);
    await h.waitForSaved(page);

    await page.waitForTimeout(500);
    await page.keyboard.press('Control+z');
    await expect(page.locator('[data-model-drawing-message]'),
      'the edit and its history must survive the page\'s own autosave')
      .toContainText('Undone', { timeout: 4000 });
  });
});
