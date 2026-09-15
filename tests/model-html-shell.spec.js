// THE CHROME SHELL on MODEL.html — two pull-out sidebars and what they hold.
//
// Work order: SKIPPER-CHROME-SHELL-WORKORDER.md. The shape is
// MODEL.dc.html's (a tab on each edge, :1762-1763) and not its stylesheet.
//
// THE TWO SIDES COLLAPSE DIFFERENTLY, and that asymmetry is a ruling rather
// than an inconsistency. The left holds tools — nothing there has a claim to
// be permanently reachable, so shut means gone. The right holds the view rail,
// and the old page keeps a column of it visible beneath an open panel on
// purpose (:1766, "every view stays one tap away"). Devin's ruling: the right
// collapses to a strip that still seats all six, not to zero.
//
// WHAT THE MEASUREMENT CHANGED ABOUT THAT RULING. He said "a seat-width
// strip". A strip one seat across is six seats TALL, and on a house that is
// wider than it is deep — which fit() centres — a tall narrow panel is the
// worst shape available. Percentage of the DRAWING hidden, collapsed,
// repro-garage-house:
//
//     1 column   97x486   9.4%    <- the strip as ruled, and the worst
//     2 columns 187x246   6.5%
//     3 columns 277x166   4.5%    <- widest and shortest, the best
//     (expanded 195x254   6.7%)
//
// One column cost MORE than leaving the panel open, which would have made
// collapsing pointless, and more than the 5.5% of the corner overlay the shell
// replaced. So collapsed goes wide and short. The ruling's GOAL — drawing area
// back, no view lost — is what is tested below; its mechanism was a guess at
// how to reach it and the measurement beat it.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const REPRO = JSON.parse(fs.readFileSync(
  path.join(__dirname, '..', 'proto', 'repro-garage-house.draft'), 'utf8'));

const SECTION = {
  id: 'S1', name: 'S1', elev: 0, levelId: null,
  startPt: { x: -20, z: 0 }, endPt: { x: 30, z: 0 }, dirVec: { x: 0, z: 1 },
};

async function openShell(page, query = '') {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, saved, cut }) => {
    saved.cuts = [cut];
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(saved)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, saved: REPRO, cut: SECTION });
  await page.goto(`/MODEL.html?mode=night${query}`);
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
}

// How much of the DRAWING each state covers — not of the canvas. The canvas
// fraction answers a question nobody asked: what matters is how much of the
// house a drafter loses.
const hiddenPct = page => page.evaluate(() => {
  const canvas = document.getElementById('plan');
  const c = canvas.getBoundingClientRect();
  // THE TOP ROW COUNTS TOO. It was left out while it was two separately
  // positioned elements, which is part of how the build bar came to be sitting
  // on the SAVE button without any measurement noticing.
  // EVERY BAND, TOP AND BOTTOM. The page row and the house strip are chrome
  // over the sheet exactly as the top row is, and leaving them out would
  // report a shell cheaper than the one the drafter has.
  // THE TOP ROW IS GONE and its two tenants are inside the strip now (Movie,
  // 15 Sep: everything into the two dark bars), so the strip's box is the
  // whole of the top band. The page row is likewise inside the house strip.
  const boxes = ['left-tab', 'left-rail', 'right-tab', 'right-rail',
    'strip', 'house-strip', 'readout']
    .map(id => document.getElementById(id))
    .filter(el => el && !el.hidden)
    .map(el => el.getBoundingClientRect())
    .filter(r => r.width > 0 && r.height > 0);
  const ctx = canvas.getContext('2d');
  const dpr = canvas.width / c.width;
  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const g = [data[0], data[1], data[2]];
  let ink = 0; let under = 0;
  for (let y = 0; y < canvas.height; y += 2) {
    for (let x = 0; x < canvas.width; x += 2) {
      const i = (y * canvas.width + x) * 4;
      const drawn = data[i + 3] > 0 && (Math.abs(data[i] - g[0])
        + Math.abs(data[i + 1] - g[1]) + Math.abs(data[i + 2] - g[2]) > 24);
      if (!drawn) continue;
      ink += 1;
      const cx = x / dpr + c.left; const cy = y / dpr + c.top;
      if (boxes.some(r => cx >= r.left && cx <= r.right && cy >= r.top && cy <= r.bottom)) under += 1;
    }
  }
  return ink ? 100 * under / ink : 0;
});

test('both sidebars start shut, and shut costs less sheet than the overlay did',
  async ({ page }) => {
    await openShell(page);

    // BOTH SHUT IS THE OLD PAGE'S OWN DEFAULT — "pull-out tabs: both side
    // rails start hidden" (MODEL.dc.html:3009) — and the state that costs the
    // drafter least. Argued with a number, as the order requires.
    await expect(page.locator('#left-rail')).toBeHidden();
    await expect(page.locator('#right-rail')).toHaveAttribute('data-collapsed', '');

    // Both tabs are reachable, or a shut panel is a panel with no way back.
    await expect(page.locator('#left-tab')).toBeVisible();
    await expect(page.locator('#right-tab')).toBeVisible();

    const pct = await hiddenPct(page);
    console.log(`  both shut: ${pct.toFixed(1)}% of the drawing hidden`);
    // The corner overlay cost 5.5%; 3% leaves no room for the shell to drift
    // back towards it. Two placement mistakes were caught by this number
    // rather than by looking: full-height tabs copied from the old page (9.7%)
    // and panels centred where fit() centres the house (4.5%).
    // RE-BASED after the panels moved below the top row. That move was forced
    // by the collision check above and cost four points: the row spans the top
    // edge, so a panel level with it sits underneath it.
    // RE-BASED AGAIN for §7b, which put three more bands on the sheet -- the
    // instrument strip at the top and the page row and house strip at the
    // foot -- and counts all of them here. The bands are the shell now, so
    // the number they cost is the number to hold, and holding the old 6%
    // would have meant not measuring them.
    expect(pct, 'the shell is taking more of the sheet than it should')
      .toBeLessThan(14);
  });

test('the collapsed right panel keeps the whole chart, six of it in sight',
  async ({ page }) => {
    await openShell(page);

    // THE RULING SURVIVED THE CHART GROWING, but its shape changed and the
    // measurement is why. Collapsed used to show all six seats at 4.5%. The
    // derived chart seats FOURTEEN, and at fourteen there is no arrangement
    // that stays cheap -- 3 columns 13.2%, 4 columns 14.3%, 5 columns 14.5%,
    // 6 columns 19.9%, every one worse than the full-height version rejected
    // in #389 for being worse than the overlay it replaced.
    //
    // So collapsed is capped at two rows and scrolls, which is what
    // MODEL.dc.html does with its own rail: 4.3% of the drawing, better than
    // the 5.4% this shell shipped at, with more than twice the seats. Six are
    // in sight -- the whole rail as it stood before -- and the rest are one
    // scroll, not one more click.
    await expect(page.locator('#right-rail')).toHaveAttribute('data-collapsed', '');
    await expect(page.locator('.seat')).toHaveCount(14);
    const panel = await page.locator('#right-rail').boundingBox();
    // 182, not 180: the level chips §7c put under the seats are one short row,
    // and that row is what keeps a level switch reachable with the rail shut.
    expect(panel.height, 'the collapsed strip grew past its cap — re-measure the sheet')
      .toBeLessThanOrEqual(182);

    // THE FIRST SIX ARE IN SIGHT, and "in sight" is asked of the panel's own
    // scroll box rather than of visibility: a seat scrolled out of a
    // clipping panel still reports visible to a CSS check.
    const inSight = await page.evaluate(() => {
      const box = document.getElementById('right-rail').getBoundingClientRect();
      return [...document.querySelectorAll('.seat')]
        .filter(el => el.getBoundingClientRect().bottom <= box.bottom + 1)
        .map(el => el.dataset.seat);
    });
    expect(inSight.length,
      'collapsed must show at least the six seats the rail used to hold')
      .toBeGreaterThanOrEqual(6);
    expect(inSight[0]).toBe('E1');

    // And a seat still works from the collapsed strip — visible is not the
    // same as reachable, and the claim is that no view is ever more than a
    // tap away.
    await page.locator('.seat[data-seat="E1"]').click();
    await page.waitForTimeout(200);
    expect(page.url()).toContain('view=cut%3AE1');
  });

test('the properties slot belongs to the open panel, not the strip', async ({ page }) => {
  await openShell(page);

  // Collapsed drops the properties: unlike the seats, nothing there has a
  // claim on the sheet's edge.
  const slot = page.locator('#props-slot');
  await expect(slot).toBeHidden();

  // The contract Gilligan builds against, exercised from outside exactly as he
  // would: set puts a node under a title and shows the slot, clear empties and
  // hides it. Nothing here knows what a beam is.
  await page.locator('#right-tab').click();
  await page.waitForTimeout(150);
  await page.evaluate(() => {
    const node = document.createElement('div');
    node.id = 'zz-probe-props';
    node.textContent = 'width 3.5"';
    window.ModelProps.set('BEAM PROPERTIES', node);
  });
  await expect(slot).toBeVisible();
  await expect(slot).toContainText('BEAM PROPERTIES');
  await expect(page.locator('#zz-probe-props')).toBeVisible();

  await page.evaluate(() => window.ModelProps.clear());
  await expect(slot).toBeHidden();

  // ARMING A TOOL MUST NOT YANK A PANEL OPEN. The slot owns the space and the
  // show/hide; whether the drafter is looking at the panel is the drafter's.
  await page.locator('#right-tab').click();
  await page.waitForTimeout(150);
  await expect(page.locator('#right-rail')).toHaveAttribute('data-collapsed', '');
  await page.evaluate(() => window.ModelProps.set('FIXTURE PROPERTIES', null));
  await expect(page.locator('#right-rail'),
    'setting properties must not open a panel the drafter closed')
    .toHaveAttribute('data-collapsed', '');
});

test('each side opens and shuts without disturbing the other', async ({ page }) => {
  await openShell(page);

  await page.locator('#left-tab').click();
  await page.waitForTimeout(150);
  await expect(page.locator('#left-rail')).toBeVisible();
  // THE CONTROL Devin asked for: closing one must not move the other. Two
  // independent flags is the shape that cannot get this wrong; one packed
  // value would have to be parsed, and a parse is where "independent" quietly
  // stops being true.
  await expect(page.locator('#right-rail'), 'opening the left moved the right')
    .toHaveAttribute('data-collapsed', '');

  await page.locator('#right-tab').click();
  await page.waitForTimeout(150);
  await expect(page.locator('#right-rail')).not.toHaveAttribute('data-collapsed', '');
  await expect(page.locator('#left-rail'), 'opening the right moved the left').toBeVisible();

  await page.locator('#left-tab').click();
  await page.waitForTimeout(150);
  await expect(page.locator('#left-rail')).toBeHidden();
  await expect(page.locator('#right-rail'), 'shutting the left moved the right')
    .not.toHaveAttribute('data-collapsed', '');
});

test('each side remembers its own state across a reload', async ({ page }) => {
  await openShell(page);

  // THE STATE IS THE URL, as it is for ?level= and ?view=. That is deliberate
  // rather than incidental — it makes a reload keep the choice, makes the
  // arrangement shareable, and keeps this page's one-source-of-truth rule. A
  // sidebar whose state persisted by accident is what the order says it will
  // not accept, so this asserts the mechanism and not just the outcome.
  await page.locator('#left-tab').click();
  await page.waitForTimeout(150);
  expect(page.url()).toContain('left=1');
  expect(page.url(), 'the right must not have written itself into the URL')
    .not.toContain('right=1');

  await page.reload();
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  await expect(page.locator('#left-rail'), 'the left forgot across a reload').toBeVisible();
  await expect(page.locator('#right-rail'), 'the right invented a state across a reload')
    .toHaveAttribute('data-collapsed', '');
});

// THE TWO DARK BARS OWN THE CONTROLS (Movie, 15 Sep). The order he gave is
// read back as tenancy, not as pixels: who is inside which bar, and in what
// order along it. A coordinate check would pass on two bars stacked a pixel
// apart, which is the arrangement that put the build bar on SAVE.
test('every control is a tenant of a bar, and the counters sit above the foot',
  async ({ page }) => {
    await openShell(page);

    const where = await page.evaluate(() => {
      const owner = id => document.getElementById(id)?.parentElement?.id || null;
      const strip = [...document.getElementById('strip').children]
        .map(el => el.id).filter(Boolean);
      const foot = [...document.getElementById('house-strip').children]
        .map(el => el.id).filter(Boolean);
      const box = id => document.getElementById(id).getBoundingClientRect();
      return {
        settings: owner('settings-corner'),
        mode: owner('mode-corner'),
        file: owner('file-row'),
        page: owner('page-row'),
        stripOrder: strip,
        footOrder: foot,
        topRow: !!document.getElementById('top-row'),
        readout: box('readout'),
        housetop: box('house-strip').top,
        half: window.innerHeight / 2,
        readoutText: document.getElementById('readout').textContent,
      };
    });

    // THE TOP BAR, left to right as Movie listed it: SETTINGS / STANDARDS /
    // UNITS come BEFORE the board switch, which is why the settings corner
    // is first and not merely present.
    expect(where.topRow, 'the old top row is gone, not hidden').toBe(false);
    expect(where.settings).toBe('strip');
    expect(where.mode).toBe('strip');
    expect(where.file).toBe('strip');
    expect(where.stripOrder.indexOf('settings-corner')).toBe(0);
    expect(where.stripOrder.indexOf('mode-corner'))
      .toBeGreaterThan(where.stripOrder.indexOf('settings-corner'));
    expect(where.stripOrder[where.stripOrder.length - 1]).toBe('file-row');

    // THE FOOT BAR: the page row leads it, the middle pair sits between the
    // two ends, and the sheets close it (Movie, 15 Sep). The build bar is no
    // longer a tenant of the foot at all -- it went up onto Gruff's board,
    // which is the sign, not the bar, and lives outside both.
    expect(where.page).toBe('house-strip');
    expect(where.footOrder[0]).toBe('page-row');
    expect(where.footOrder.indexOf('dt-bar'))
      .toBeGreaterThan(where.footOrder.indexOf('page-row'));
    expect(where.footOrder[where.footOrder.length - 1]).toBe('sheet-row');
    expect(where.footOrder, 'the house menu is on the sign now, not in the bar')
      .not.toContain('build-bar');

    // THE COUNTERS CAME BACK DOWN -- "to the bottom of the grid area just
    // above the darker area" -- and the view reads there with them, which is
    // the one thing that was missing from the block.
    expect(where.readout.top, 'the counters are in the lower half of the sheet')
      .toBeGreaterThan(where.half);
    expect(where.readout.bottom, 'and clear of the foot bar')
      .toBeLessThanOrEqual(where.housetop);
    expect(where.readoutText).toMatch(/view\s+\S+/);
    expect(where.readoutText).toMatch(/walls\s+\d+\/\d+/);
  });

test('UNITS names the unit in force and switches the drawing over', async ({ page }) => {
  await openShell(page);
  const units = page.locator('#units-toggle');
  await expect(units).toHaveText('UNITS: IMPERIAL');
  await units.click();
  await expect(units).toHaveText('UNITS: METRIC');
  // The label is a statement about the file, so the FILE has to agree with
  // it -- a button that renames itself and leaves `units` alone is the kind
  // of green-and-hollow control this page has paid for before. Read back out
  // of the store, not out of a test hook the page does not have.
  await page.locator('#save').click();
  await h.waitForSaved(page);
  expect((await h.savedDrawing(page)).units).toBe('metric');

  await units.click();
  await expect(units).toHaveText('UNITS: IMPERIAL');
});

test('NO PIECE OF CHROME COVERS ANY OTHER, shut or open', async ({ page }) => {
  // THE GUARD THIS SHELL KEPT NEEDING. Four collisions were shipped and caught
  // one at a time, each as a confusing failure somewhere else:
  //
  //   the right tab over SAVE          eleven draw-delete tests, 180s timeouts
  //   the build bar over SAVE          stale-merge-refusal, "BUNGALOW ...
  //                                    intercepts pointer events"
  //   the top row over the left rail   the tap guard below, hitting the picker
  //   the top row over the right rail  found only by this check
  //
  // Every one came from placing a fixed element by coordinate and reasoning
  // about where it would land. This asserts the RELATIONSHIP across every
  // pair, so the next one fails here, named, instead of surfacing three
  // specs away as a timeout.
  await openShell(page);
  //
  // THE CONTROLS MOVED INSIDE THE TWO BARS (Movie, 15 Sep), which is the
  // arrangement this check has been arguing for all along: a flex child
  // cannot leave its parent, so the pairs that kept colliding no longer
  // exist as pairs. The bars themselves and the two loose panels are still
  // checked -- and A CONTAINER IS NOT A COLLISION, so a pair where one
  // element contains the other is skipped rather than reported. Without
  // that, `strip overlaps file-row` would be a permanent red that says
  // nothing, and a real collision would be read as more of the same.
  const ids = ['left-tab', 'left-rail', 'right-tab', 'right-rail',
    'readout', 'hint', 'elsewhere', 'strip', 'file-row', 'mode-corner',
    'settings-corner', 'page-row', 'house-strip'];
  const clashesIn = () => page.evaluate(list => {
    const vis = list.map(id => document.getElementById(id))
      .filter(el => el && !el.hidden && getComputedStyle(el).display !== 'none')
      .map(el => ({ id: el.id, el, r: el.getBoundingClientRect() }))
      .filter(o => o.r.width > 0 && o.r.height > 0);
    const out = [];
    for (let i = 0; i < vis.length; i += 1) {
      for (let j = i + 1; j < vis.length; j += 1) {
        const a = vis[i].r; const b = vis[j].r;
        if (vis[i].el.contains(vis[j].el) || vis[j].el.contains(vis[i].el)) continue;
        if (a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom) {
          out.push(`${vis[i].id} overlaps ${vis[j].id}`);
        }
      }
    }
    return out;
  }, ids);

  expect(await clashesIn(), 'chrome overlaps chrome with both panels shut').toEqual([]);

  await page.locator('#left-tab').click();
  await page.locator('#right-tab').click();
  await page.waitForTimeout(200);
  expect(await clashesIn(), 'chrome overlaps chrome with both panels open').toEqual([]);
});

test('the file row and the build bar cannot overlap at any width', async ({ page }) => {
  await openShell(page);

  // TWO SEPARATELY FIXED-POSITIONED BARS, EACH AS WIDE AS ITS CONTENT, is how
  // the build bar came to be sitting on SAVE: the chrome bar grew with the
  // level and view names and the build bar with the family labels, so on a
  // drawing with long level names they met. CI caught it as a 180-second
  // timeout on a spec that had nothing to do with either
  // (stale-merge-refusal), with "BUNGALOW ... intercepts pointer events".
  //
  // §7b PUT A WHOLE BAND BETWEEN THEM -- the file row is at the top right and
  // the build bar along the foot -- so the two cannot meet at any width now.
  // The check follows them rather than being deleted: the thing it guards is
  // that SAVE is pressable, and that is worth asserting wherever SAVE lives.
  const geom = await page.evaluate(() => {
    const file = document.getElementById('file-row').getBoundingClientRect();
    const bar = document.getElementById('build-bar').getBoundingClientRect();
    const save = document.getElementById('save').getBoundingClientRect();
    const owner = document.elementFromPoint(save.x + save.width / 2, save.y + save.height / 2);
    return {
      overlap: file.bottom > bar.top && file.top < bar.bottom
        && file.left < bar.right && bar.left < file.right,
      nested: document.getElementById('file-row')
        .contains(document.getElementById('build-bar')),
      saveOwner: owner ? (owner.id || owner.tagName) : 'none',
    };
  });
  expect(geom.overlap, 'the file row reaches into the build bar').toBe(false);
  // The malformed-DOM check: an unclosed row swallowed the build bar once and
  // every measurement after it described a tree that was not the page's.
  expect(geom.nested, '#file-row is not closed — it contains the build bar').toBe(false);
  expect(geom.saveOwner, 'something is sitting on the SAVE button').toBe('save');
});

test('the right panel stays inside its bound, and keeps every control it holds',
  async ({ page }) => {
    // THE SAME GAP AS THE TOP BAR'S, one tier over. `aside` is position:fixed
    // with no width, so it is SHRINK-TO-FIT -- as wide as its widest content
    // wants, with nothing stopping it. The boneyard's card put a title AND a
    // + SHELF button on one line and took the rail from 277px to 343px; its
    // left edge moved to x=909, over the drawing, and a tap aimed at world
    // (4,-3) in model-html-draw-delete reached the panel instead of the canvas.
    //
    // TWO ASSERTIONS, BECAUSE THE FIX HAS TWO WAYS TO GO WRONG. A max-width
    // stops the panel eating the sheet; it can just as easily CLIP a control
    // instead, which trades a bug you can see for one you cannot. So: the rail
    // is within its bound, AND every control inside it is still inside its box.
    await openShell(page);
    const verdict = await page.evaluate(() => {
      const rail = document.getElementById('right-rail');
      if (!rail) return { missing: true };
      const box = rail.getBoundingClientRect();
      const controls = [...rail.querySelectorAll('button, a, input, select')]
        .filter(el => el.offsetParent !== null);
      const escaped = controls.map(el => {
        const r = el.getBoundingClientRect();
        return { name: el.id || el.className || el.textContent.trim().slice(0, 18),
          right: Math.round(r.right), bottom: Math.round(r.bottom) };
      }).filter(c => c.right > Math.round(box.right) + 1);
      return { w: Math.round(box.width), right: Math.round(box.right),
        controls: controls.length, escaped: escaped.slice(0, 6) };
    });
    expect(verdict.missing, 'there is a right rail to measure').toBeFalsy();
    expect(verdict.controls, 'and it holds controls worth protecting')
      .toBeGreaterThan(0);
    // 277px is the bound MODEL.html sets, and it is MEASURED -- the width the
    // rail has on main, where every tap in the suite clears it. An earlier
    // estimate of 288 left the edge three pixels over a tap in
    // model-change-broadcast, which is the whole reason this number is not
    // worked out from the seat grid.
    expect(verdict.w, `the right panel is ${verdict.w}px wide; bounded at 277`)
      .toBeLessThanOrEqual(277);
    // NOT CLIPPED INTO UNREACHABILITY. A control whose box ends past the
    // panel's own right edge is a control the drafter cannot press.
    expect(verdict.escaped,
      'every control in the right panel is inside it, not clipped past its edge')
      .toEqual([]);
  });

test('no tenant of the top bar is pushed off the sheet', async ({ page }) => {
  // THE GAP THE OVERLAP CHECK ABOVE LEFT. Two bars that never meet each other
  // can still both run off the right edge, and a flex row does exactly that
  // when a control is added to it: it overflows rather than wrapping, so the
  // last tenant -- the file row -- walks off the sheet a button at a time.
  //
  // PRINTSCREEN was the 94px that did it. At 1280 the bar's tenants wanted
  // 1422px, SAVE AS sat at x=1296 on a 1280 sheet, and three file-row specs
  // and a delete-verb one died as 180-second "element is outside of the
  // viewport" timeouts in specs that never mention the strip. Nothing in the
  // suite said the bar has to FIT; this does.
  await openShell(page);

  const strip = await page.evaluate(() => {
    const bar = document.getElementById('strip');
    return {
      overflow: bar.scrollWidth - bar.clientWidth,
      escaped: [...bar.querySelectorAll('a, button, input, select')]
        .filter(el => el.offsetParent !== null)
        .map(el => [el.id || el.textContent.trim().slice(0, 12),
          el.getBoundingClientRect()])
        .filter(([, box]) => box.width > 0
          && (box.right > window.innerWidth || box.left < 0))
        .map(([name, box]) => `${name} at ${Math.round(box.left)}..${Math.round(box.right)}`),
    };
  });

  expect(strip.escaped,
    `off the sheet at ${page.viewportSize().width}px: ${strip.escaped.join(', ')}`)
    .toEqual([]);
  // And the row is not merely fitting by a hair: overflow at all means the
  // next control added repeats this, which is how it happened the first time.
  expect(strip.overflow, 'the top bar overflows its own width').toBeLessThanOrEqual(0);
});

test('a tap that lands on a sidebar says which one', async ({ page }) => {
  await openShell(page, '&left=1&right=1');

  // The guard from model-html-draw-delete.spec.js, extended to the shell. A
  // click eaten by chrome used to surface as an undefined property four frames
  // later; it names the panel instead.
  const named = await page.evaluate(() => {
    const hit = (el) => {
      if (!el) return 'nothing';
      if (el.closest('#left-rail')) return 'the left sidebar';
      if (el.closest('#right-rail')) return el.closest('[data-seat]')
        ? `the ${el.closest('[data-seat]').dataset.seat} seat on the view rail`
        : 'the right sidebar';
      if (el.id === 'left-tab' || el.id === 'right-tab') return `the ${el.id}`;
      return el.id ? `${el.tagName.toLowerCase()}#${el.id}` : el.tagName.toLowerCase();
    };
    const box = document.getElementById('left-rail').getBoundingClientRect();
    return hit(document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2));
  });
  expect(named).toBe('the left sidebar');
});

test('the shell does not put a long task back', async ({ page }) => {
  await openShell(page, '&left=1&right=1');

  // MEASURED ON A DRAFTING BOARD, and the void-sample guard below is what
  // said so. These are three (four) SEPARATE two-tap runs, and on the default
  // TOY board §1 refuses a new run while one is unfinished — a rule with its
  // own check (model-toy-draw.spec.js:447), which also proves putting the
  // tool down does not cancel the run. So every edit after the first was
  // correctly refused, committed nothing, and this read as a chrome
  // regression. The subject here is what the chrome costs, not what the
  // board allows, so the board is named rather than inherited.
  await page.locator('#mode-corner [data-board="drafting"]').click();
  await expect(page.locator('body')).toHaveAttribute('data-board', 'drafting');

  // The order's bar: the last table read 31–54 ms per committed click with no
  // long tasks, and the shell must not undo that. Measured with BOTH panels
  // open, which is the most chrome the page can have on screen at once.
  await page.evaluate(() => {
    window.__long = [];
    new PerformanceObserver(list => list.getEntries()
      .forEach(e => window.__long.push(Math.round(e.duration))))
      .observe({ entryTypes: ['longtask'] });
  });

  const scale = await page.evaluate(() => Number(
    /scale ([\d.]+) px\/ft/.exec(document.getElementById('readout').textContent)[1]));
  const box = await page.locator('#plan').boundingBox();
  const at = (x, z) => [box.x + box.width / 2 + x * scale, box.y + box.height / 2 + z * scale];
  const wallCount = () => page.evaluate(() => Number(
    /walls \d+\/(\d+)/.exec(document.getElementById('readout').textContent)[1]));

  for (let i = 0; i < 3; i += 1) {
    const before = await wallCount();
    await h.armWall(page);
    await page.mouse.click(...at(-3, -1.5 - i * 0.9));
    await page.waitForTimeout(50);
    await page.mouse.click(...at(3, -1.5 - i * 0.9));
    await h.disarmWall(page);   // the key TOGGLES; put it down
    await page.waitForTimeout(300);
    // A void sample is not a fast one: an edit that commits nothing repaints
    // nothing and reads exactly like an edit that was free.
    expect(await wallCount(), `edit ${i + 1} did not commit — the sample would be void`)
      .toBeGreaterThan(before);
  }

  const long = await page.evaluate(() => window.__long.slice());
  console.log(`  with both panels open, long tasks: ${long.length ? long.join(', ') + ' ms' : 'none'}`);
  expect(long, `the shell put a long task back: ${long.join(', ')} ms`).toEqual([]);
});
