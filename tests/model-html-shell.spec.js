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
//
// AND THEN MOVIE OVERTURNED THE STRIP ITSELF (16 Sep). Shown the long panel
// and the shortened one side by side, he said "delete the 2nd shorter
// version" — so a shut rail shows NOTHING now, the two edge tabs are the
// whole collapsed state, and every guarantee the strip carried moves one
// press over, onto the open pane. The measurements above are history, kept
// because they explain how the strip came to exist at all.
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

test('shut is shut; one press seats the whole chart, every seat reachable',
  async ({ page }) => {
    await openShell(page);

    // THE STRIP IS GONE (Movie, 16 Sep: "delete the 2nd shorter version").
    // Shut used to be a capped two-column strip of the same seats; now a
    // shut rail keeps NOTHING on the sheet, and the chart's guarantee moves
    // one press over: open, the whole chart is seated and every seat is
    // reachable without leaving the rail.
    //
    // THE SEATS LIVE IN THE LAYOUT PREVIEWS PANE (Movie, 15 Sep), so the
    // rail is asked about while it is showing that pane.
    await page.goto('/MODEL.html?mode=night&pane=previews');
    await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
    await expect(page.locator('#right-rail')).toHaveAttribute('data-collapsed', '');
    await expect(page.locator('#right-rail'), 'a shut rail keeps a face on the sheet')
      .not.toBeVisible();

    await page.locator('#previews-tab').click();
    await page.waitForTimeout(200);
    await expect(page.locator('#right-rail')).not.toHaveAttribute('data-collapsed', '');
    await expect(page.locator('.seat')).toHaveCount(14);

    // TWO COLUMNS AND NO MORE (Movie, 15 Sep: "only the one with 2 columns").
    // Asked as the seats' own geometry -- how many share a row -- because a
    // grid-template-columns string can say `repeat(2, 84px)` while an
    // override elsewhere quietly says three.
    const perRow = await page.evaluate(() => {
      const tops = [...document.querySelectorAll('.seat')]
        .map(el => Math.round(el.getBoundingClientRect().top));
      const first = tops[0];
      return tops.filter(t => t === first).length;
    });
    expect(perRow, 'the seat grid is not two across').toBe(2);

    // And a seat works -- the claim is that no view is ever more than a
    // press, a scroll and a tap away.
    await page.locator('.seat[data-seat="E1"]').click();
    await page.waitForTimeout(200);
    expect(page.url()).toContain('view=cut%3AE1');

    // THE SEATS BELOW THE FOLD ARE REACHED, not just present.
    // The last ENABLED seat: the section seats at the end are empty chairs
    // until a cut exists, and a disabled button proves nothing about scroll.
    const last = page.locator('.seat:not([disabled])').last();
    await last.scrollIntoViewIfNeeded();
    await last.click();
    await page.waitForTimeout(200);
    expect(page.url(), 'a seat past the fold could not be reached by scrolling')
      .not.toContain('view=cut%3AE1');
  });

// THE SLOT MOVED TO THE LEFT RAIL, under the tool column. Movie, 19 Sep: "we
// should designate an area on the model page for the PROPERTIES box (which
// will change depending on what you are using) i'm thinking add a collapsable
// box on the left side under the DRAFTING TOOLS". It lived under LEVELS /
// LAYERS on the right until then. The CONTRACT below did not change with the
// address -- set puts a node under a title and shows it, clear hides it --
// which is why this test keeps its shape and only swaps which tab it opens.
test('the properties slot belongs to the open panel, not the strip', async ({ page }) => {
  await openShell(page);

  // Collapsed drops the properties: unlike the seats, nothing there has a
  // claim on the sheet's edge.
  const slot = page.locator('#props-slot');
  await expect(slot).toBeHidden();

  // The contract Gilligan builds against, exercised from outside exactly as he
  // would: set puts a node under a title and shows the slot, clear empties and
  // hides it. Nothing here knows what a beam is.
  await page.locator('#left-tab').click();
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

  // AND THE BOX AROUND IT GOES WITH THE CONTENTS. An empty box would leave a
  // PROPERTIES heading and a fold arrow under the tools with nothing behind
  // them -- a control that does nothing.
  await expect(page.locator('#props-box')).toBeVisible();
  await page.evaluate(() => window.ModelProps.clear());
  await expect(slot).toBeHidden();
  await expect(page.locator('#props-box')).toBeHidden();

  // ARMING A TOOL MUST NOT YANK A PANEL OPEN. The slot owns the space and the
  // show/hide; whether the drafter is looking at the panel is the drafter's.
  await page.locator('#left-tab').click();
  await page.waitForTimeout(150);
  await expect(page.locator('#left-rail')).toBeHidden();
  await page.evaluate(() => window.ModelProps.set('FIXTURE PROPERTIES', null));
  await expect(page.locator('#left-rail'),
    'setting properties must not open a panel the drafter closed')
    .toBeHidden();
});

// THE FOLD IS THE BOX'S OWN, and it has to be: the tool column above it is six
// rows tall, so a drafter who wants the keys and not the properties would
// otherwise have to shut the whole rail and lose both.
test('the properties box folds without shutting the rail it sits in', async ({ page }) => {
  await openShell(page);
  await page.locator('#left-tab').click();
  await page.waitForTimeout(150);
  await page.evaluate(() => {
    const node = document.createElement('div');
    node.id = 'zz-fold-probe';
    node.textContent = 'stud 2x6';
    window.ModelProps.set('WALL', node);
  });
  const slot = page.locator('#props-slot');
  await expect(slot).toBeVisible();

  await page.locator('[data-props-fold]').click();
  await expect(slot, 'folding must hide what is in the box').toBeHidden();
  await expect(page.locator('#left-rail'),
    'folding the properties must not shut the rail holding the tool keys')
    .toBeVisible();
  await expect(page.locator('[data-tool-key="wall"]')).toBeVisible();

  // IT SURVIVES A RELOAD, like the two rails either side of it, and for the
  // same reason: a drafter who folded it does not want it back every time the
  // page comes up.
  await page.reload();
  await page.waitForTimeout(400);
  await expect(page.locator('[data-props-fold]'))
    .toHaveAttribute('aria-expanded', 'false');

  // The probe does not survive a reload -- nothing is selected and no tool is
  // armed, so the box is empty and hidden. Fill it again to press the fold:
  // the fold's STATE persisted, which is the claim; a box that is empty is
  // not a box that is open.
  await page.evaluate(() => window.ModelProps.set('WALL', null));
  await page.locator('[data-props-fold]').click();
  await expect(page.locator('[data-props-fold]'))
    .toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('#props-slot')).toBeVisible();
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
    // THE COUNTERS ARE BEHIND THEIR TAB NOW, so the band they sit in is only
    // a fact about the panel OPEN -- shut it has no box to measure. The rule
    // being guarded is unchanged: when the drafter asks for the counts they
    // come up in the lower half of the sheet and clear of the foot bar.
    await page.locator('#readout-tab').click();

    const where = await page.evaluate(() => {
      const owner = id => document.getElementById(id)?.parentElement?.id || null;
      const strip = [...document.getElementById('strip').children]
        .map(el => el.id).filter(Boolean);
      const foot = [...document.getElementById('house-strip').children]
        .map(el => el.id).filter(Boolean);
      const box = id => document.getElementById(id).getBoundingClientRect();
      return {
        settings: owner('settings-corner'),
        units: owner('units-corner'),
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
    // THE UNIT STACK IS ITS OWN TENANT NOW (Movie, 15 Sep). It used to be one
    // button inside the settings corner, so "the settings corner is first"
    // used to place it; a separate corner has to be placed on its own or the
    // sentence above stops being about anything this test reads.
    expect(where.units).toBe('strip');
    expect(where.stripOrder.indexOf('units-corner'))
      .toBe(where.stripOrder.indexOf('settings-corner') + 1);
    expect(where.mode).toBe('strip');
    expect(where.file).toBe('strip');
    expect(where.stripOrder.indexOf('settings-corner')).toBe(0);
    expect(where.stripOrder.indexOf('mode-corner'))
      .toBeGreaterThan(where.stripOrder.indexOf('settings-corner'));
    // PRINTSCREEN CLOSES THE BAR (Movie, 16 Sep: "fully to the RIGHT in
    // upper corner to RIGHT of the save stuff") -- the file row keeps the
    // corner and the paper button ends it.
    expect(where.stripOrder[where.stripOrder.length - 1]).toBe('printscreen');
    expect(where.stripOrder[where.stripOrder.length - 2]).toBe('file-row');

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

// TWO BUTTONS, THE LIVE ONE SHADED (Movie, 15 Sep). The toggle this replaces
// had to say "UNITS: IMPERIAL" because the label was the only place the state
// could live; with two named buttons the shading carries it, and the check
// follows the state to where it moved rather than being deleted with the
// label. What is asserted is unchanged: the control says what is in force,
// and the FILE agrees with what it says.
test('UNITS shades the unit in force and switches the drawing over', async ({ page }) => {
  await openShell(page);
  const imperial = page.locator('#units-corner button[data-units="imperial"]');
  const metric = page.locator('#units-corner button[data-units="metric"]');
  await expect(imperial).toHaveAttribute('aria-pressed', 'true');
  await expect(metric).toHaveAttribute('aria-pressed', 'false');

  await metric.click();
  await expect(metric).toHaveAttribute('aria-pressed', 'true');
  await expect(imperial, 'both units cannot be in force at once')
    .toHaveAttribute('aria-pressed', 'false');
  // The shading is a statement about the file, so the FILE has to agree with
  // it -- a button that lights itself and leaves `units` alone is the kind
  // of green-and-hollow control this page has paid for before. Read back out
  // of the store, not out of a test hook the page does not have.
  await page.locator('#save').click();
  await h.waitForSaved(page);
  expect((await h.savedDrawing(page)).units).toBe('metric');

  // A SET, NOT A TOGGLE: pressing the one already lit is a no-op, where the
  // old control read the same press as "change the drawing". This is the
  // whole behavioural difference between the two shapes, so it is the part
  // worth a check.
  await metric.click();
  await expect(metric).toHaveAttribute('aria-pressed', 'true');
  await page.locator('#save').click();
  await h.waitForSaved(page);
  expect((await h.savedDrawing(page)).units,
    'pressing the live unit changed the drawing').toBe('metric');

  await imperial.click();
  await expect(imperial).toHaveAttribute('aria-pressed', 'true');
  await expect(metric).toHaveAttribute('aria-pressed', 'false');
});

// THE CHECK THAT LETS THE STACKS EXIST AT ALL.
//
// Two of the top bar's corners now stack a pair of buttons vertically:
// IMPERIAL over METRIC, and TOY over DRAFTING. Stacking units is a REVERSAL
// of MODEL.dc.html:435-442, which made units one button naming the unit in
// force after its two stacked buttons -- grown to a 44px touch target by
// padding out and pulling the margin back -- OVERLAPPED, so METRIC ate every
// tap aimed at IMPERIAL.
//
// The reversal's whole argument is that the fault was the HIT BOXES and not
// the stacking: these rows are the settings stack's own 19px, the shape
// already standing two inches to the left without that fault. That argument
// is only worth what a measurement says, and the DC ruling it overturns was
// itself kept honest by one. So this is that measurement, and it is aimed at
// the exact failure DC hit -- not at the stylesheet, which can say
// `flex-direction:column` while a padded hit box reaches up over its
// neighbour anyway.
//
// A TAP IS SENT AT A COORDINATE, not at a locator: `locator.click()` asks
// Playwright for the element's own centre and dispatches there, so it lands
// on the right control even when the pixel belongs to something else. That
// is the DC bug passing unnoticed.
test('a tap aimed at a stacked button lands on that button, not its neighbour',
  async ({ page }) => {
    await openShell(page);

    const STACKS = [
      ['the unit stack', '#units-corner button[data-units]'],
      ['the board stack', '#mode-corner .set.stack button[data-board]'],
      // THE PRECEDENT IS MEASURED TOO. The reversal's argument is that these
      // rows -- SETTINGS over STANDARDS, the same 19px -- are the shape
      // already standing beside the units without DC's fault. An argument
      // resting on a control nobody measures is worth what the citation that
      // sent me here was worth.
      ['the settings stack', '#settings-stack a'],
    ];

    for (const [what, selector] of STACKS) {
      const boxes = await page.evaluate(sel => {
        return [...document.querySelectorAll(sel)].map(el => {
          const r = el.getBoundingClientRect();
          const cx = r.x + r.width / 2, cy = r.y + r.height / 2;
          const hit = document.elementFromPoint(cx, cy);
          return {
            label: (el.textContent || '').trim(),
            top: r.top, bottom: r.bottom, height: r.height,
            // `contains` because a button may wrap its label in a node, and
            // the tap legitimately lands on that child.
            hitsSelf: el === hit || el.contains(hit),
            hitLabel: (hit?.textContent || '').trim().slice(0, 24),
          };
        });
      }, selector);

      expect(boxes.length, `${what} is not two buttons`).toBe(2);

      for (const b of boxes) {
        expect(b.hitsSelf,
          `${what}: a tap on ${b.label}'s own centre landed on "${b.hitLabel}"`)
          .toBe(true);
      }

      // AND THE BOXES DO NOT OVERLAP AT ALL, which is the stronger half: a
      // centre can hit itself while the edges still steal each other's taps,
      // and the edge is where a thumb aiming at the upper button actually
      // lands. DC's pair overlapped by 14px and its centres were still fine.
      const [first, second] = boxes;
      expect(second.top,
        `${what}: ${second.label} reaches up over ${first.label} — `
        + 'the DC overlap, back again')
        .toBeGreaterThanOrEqual(first.bottom);
    }

    // AND THE TAP DOES WHAT THE BUTTON SAYS. The overlap DC suffered was only
    // a bug because the wrong unit took the press, so the last word is the
    // state: a coordinate tap on IMPERIAL's centre leaves IMPERIAL in force.
    await page.locator('#units-corner button[data-units="metric"]').click();
    await expect(page.locator('#units-corner button[data-units="metric"]'))
      .toHaveAttribute('aria-pressed', 'true');

    const aim = await page.evaluate(() => {
      const r = document.querySelector('#units-corner button[data-units="imperial"]')
        .getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    });
    await page.mouse.click(aim.x, aim.y);
    await expect(page.locator('#units-corner button[data-units="imperial"]'),
      'a tap aimed at IMPERIAL did not put imperial in force')
      .toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#units-corner button[data-units="metric"]'))
      .toHaveAttribute('aria-pressed', 'false');
  });

// AN ORIGIN WITH NOTHING STORED STILL HAS A FILE ROW (Movie, 15 Sep): "the
// OPEN or NEW button those should show ... and just the save buttons won't do
// anything if there hasn't been anything done". The row was hidden whole until
// a drawing loaded, so the page that most needed NEW was the page that did not
// offer it.
//
// AND NOTHING STORED IS A BLANK SHEET NOW, not a notice (Movie, 20 Sep: "just
// show a NEW / BLANK page instead"), which moved half of what this check said.
// The writes are no longer DEAD on an empty origin, because there is a drawing
// on the page -- an empty one, which a drafter may perfectly well want to save.
// What survives is the claim the check was written for: the row stands, and
// NEW and OPEN are reachable on the page that most needs them.
test('the file row stands on an empty origin, over a blank sheet', async ({ page }) => {
  await h.openModel(page, { webgl: false });
  await page.goto('/MODEL.html?mode=night');

  // NO NOTICE. The old one told a first-time drafter to go and draw in
  // MODEL.dc.html, which is the page he is not meant to use -- and since the
  // front door started pointing here, it is the first thing he would read.
  await expect(page.locator('#notice')).not.toHaveClass(/show/);

  await expect(page.locator('#file-new'), 'nothing stored is when NEW matters most')
    .toBeEnabled();
  await expect(page.locator('#file-open')).toBeEnabled();

  // THE WRITES ARE LIVE, because a blank sheet is a drawing. It is UNSAVED,
  // and that is the honest word: the store has never seen it.
  await expect(page.locator('#save')).toBeEnabled();
  await expect(page.locator('#file-save-as')).toBeEnabled();
  await expect(page.locator('[data-save-status]')).toHaveText(/UNSAVED/);

  // AND IT IS THE SAME BLANK THE NEW BUTTON GIVES. Pressing NEW on a sheet
  // that is already blank changes nothing a drafter can see, which is what
  // "one answer to what an empty drawing is" looks like from outside.
  const levels = () => page.locator('.lv-card').count();
  const before = await levels();
  expect(before, 'a blank sheet still has its levels').toBeGreaterThan(0);
  await page.locator('#file-new').click();
  expect(await levels()).toBe(before);
});

// THE RIGHT EDGE HAS TWO TABS NOW (Movie, 15 Sep): "top will be LEVELS /
// LAYERS, and then next down LAYOUT PREVIEWS". One pane shows at a time, and
// the pane is in the URL for the same reason the rail's open/shut is.
test('the right edge has two tabs and shows one pane at a time', async ({ page }) => {
  await openShell(page);
  const levelsTab = page.locator('#right-tab');
  const previewsTab = page.locator('#previews-tab');
  await expect(levelsTab).toHaveText('LEVELS / LAYERS');
  await expect(previewsTab).toHaveText('LAYOUT PREVIEWS');

  // Shut, NOTHING shows (Movie, 16 Sep: "delete the 2nd shorter version")
  // -- but LEVELS is still the pane on offer: the tab wears the light, and
  // one press brings up the full panel, not a stub.
  await expect(page.locator('#right-rail')).toHaveAttribute('data-collapsed', '');
  await expect(levelsTab).toHaveAttribute('aria-selected', 'true');

  await levelsTab.click();
  await page.waitForTimeout(150);
  await expect(page.locator('#right-rail')).not.toHaveAttribute('data-collapsed', '');
  await expect(page.locator('#levels-panel')).toBeVisible();
  await expect(page.locator('#view-rail')).toBeHidden();

  // The other tab SWAPS the pane and leaves the rail open -- shutting on a
  // swap would make the second tab cost two presses to use.
  await previewsTab.click();
  await page.waitForTimeout(150);
  await expect(page.locator('#right-rail')).not.toHaveAttribute('data-collapsed', '');
  await expect(page.locator('#view-rail')).toBeVisible();
  await expect(page.locator('#levels-panel'), 'both panes are showing at once')
    .toBeHidden();
  await expect(previewsTab).toHaveAttribute('aria-selected', 'true');
  await expect(levelsTab).toHaveAttribute('aria-selected', 'false');

  // Pressing the tab that is already up shuts the rail, which is the gesture
  // the single tab had.
  await previewsTab.click();
  await page.waitForTimeout(150);
  await expect(page.locator('#right-rail')).toHaveAttribute('data-collapsed', '');

  // THE PANE IS IN THE URL, so it survives a reload and can be sent to
  // someone else -- the same rule ?level=, ?view= and ?right= follow. The
  // rail comes back shut, so the memory shows on the tab's light and on
  // which pane the next press brings up.
  expect(page.url()).toContain('pane=previews');
  await page.reload();
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  await expect(previewsTab, 'the pane forgot across a reload')
    .toHaveAttribute('aria-selected', 'true');
  await previewsTab.click();
  await page.waitForTimeout(150);
  await expect(page.locator('#view-rail')).toBeVisible();
  await expect(page.locator('#levels-panel')).toBeHidden();
});

// SHUT TOOK THE CHIPS WITH IT (Movie, 16 Sep: "delete the 2nd shorter
// version"). §7c's worry -- a shut rail loses the level switch -- is answered
// by the LEVELS / LAYERS tab now: one press opens the full panel, the same
// one press the chips cost, and the panel it opens is the long one with
// every level's own name on it.
test('shut, the rail keeps nothing on the sheet; the tabs are the way back',
  async ({ page }) => {
    await openShell(page, '&pane=previews');
    await expect(page.locator('#right-rail')).toHaveAttribute('data-collapsed', '');
    await expect(page.locator('.lv-card .lv-name').first()).not.toBeVisible();
    await expect(page.locator('.seat').first()).not.toBeVisible();

    // Open, the pane asked for is the one that shows -- and only it.
    await page.locator('#previews-tab').click();
    await page.waitForTimeout(200);
    await expect(page.locator('#view-rail')).toBeVisible();
    await expect(page.locator('#levels-panel')).toBeHidden();
  });

// THE INSTRUMENTS SIT NEAR THE MIDDLE OF THE SHEET (Movie, 15 Sep: "the
// LENGTH in the middle (should be near center)"). Measured against the
// WINDOW's centre and not the strip's leftover space: the group is centred
// between two flexible gaps, so a corner gaining a button walks it sideways,
// and by the time it looks wrong nobody remembers which commit moved it.
//
// TRUE CENTRE COSTS 1440 (measured, 16 Sep): the cluster is 539px wide and
// the corners take 371 + 360, so at 1280 there is NO seat both centred and
// clear of the file row -- the absolute overlay's box reached 2px into NEW
// on an empty page and right over it with a length showing, and seven specs
// died as 180s interception timeouts. Below 1440 the cluster is an in-flow
// flex child: near centre (the corners weigh almost the same), overlap
// impossible. So the sheet's centre is asserted where it is bought, and at
// 1280 the assertion is the one that page died of: NEW takes the click.
test('the instrument group is centred on the sheet, not on what is left over',
  async ({ page }) => {
    await openShell(page);
    for (const width of [1440, 1920]) {
      await page.setViewportSize({ width, height: 800 });
      await page.waitForTimeout(250);
      const off = await page.evaluate(() => {
        const r = document.getElementById('strip-center').getBoundingClientRect();
        return Math.abs((r.x + r.width / 2) - window.innerWidth / 2);
      });
      expect(off, `the instruments sit ${off}px off centre at ${width}`)
        .toBeLessThan(60);
    }

    await page.setViewportSize({ width: 1280, height: 800 });
    await page.waitForTimeout(250);
    const at1280 = await page.evaluate(() => {
      const r = document.getElementById('strip-center').getBoundingClientRect();
      const hit = (() => {
        const b = document.getElementById('file-new').getBoundingClientRect();
        const el = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
        return el ? (el.id || el.tagName) : 'nothing';
      })();
      return { off: Math.abs((r.x + r.width / 2) - window.innerWidth / 2), hit };
    });
    expect(at1280.off, `the instruments sit ${at1280.off}px off centre at 1280`)
      .toBeLessThan(90);
    expect(at1280.hit, 'the instrument cluster is lying over NEW at 1280')
      .toBe('file-new');
  });

// THE COUNTS ARE OFFERED, NOT IMPOSED (Movie, 15 Sep). Shut, the panel must
// still be WRITTEN -- the drafter opens it to read a number that is already
// true, and half this suite measures the page's scale out of the same text --
// so the check is both halves: nothing on the sheet when shut, the counts
// there the moment it opens.
test('the readout is a word until it is asked for', async ({ page }) => {
  await openShell(page);
  const panel = page.locator('#readout');
  const tab = page.locator('#readout-tab');

  await expect(tab).toHaveText('STATUS READOUT');
  await expect(panel, 'the counts do not stand open over the sheet')
    .toBeHidden();
  expect(await panel.textContent(),
    'shut, the panel is still being written').toContain('walls');

  await tab.click();
  await expect(panel).toBeVisible();
  await expect(panel).toContainText('scale');
  // ONE CONTROL, NOT TWO. Open, the word is gone and the X in the panel's own
  // corner is the way back -- a tab still standing beside an open panel says
  // the same thing twice.
  await expect(tab, 'the word gives way to the panel it opened').toBeHidden();

  await page.locator('#readout-close').click();
  await expect(panel, 'the X shuts it').toBeHidden();
  await expect(tab).toBeVisible();
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
  // THE SECOND RIGHT TAB IS IN THE LIST, and that is the whole reason a
  // second tab on one edge is allowed at all: #389's collisions were two
  // tabs pinned to the same top, and the only thing that distinguishes this
  // arrangement from that one is a check that measures the pair.
  // THE UPPER-RIGHT COLUMN IS DECLARED, AND SO IS WHAT IT HOLDS. The clock
  // (Movie, 20 Sep) is the first thing on this page that stands under the top
  // bar unconditionally -- the two file notes are hidden on a page with
  // nothing wrong with the file, so that corner was empty in every run this
  // check has ever made. An always-on element in a corner nothing measured is
  // precisely the shape of the four collisions named above, so it goes in the
  // list rather than being trusted. The column and its children are all here;
  // a container is not a collision, so the pairs inside it are skipped and
  // what is left is the column against every other piece of chrome.
  const ids = ['left-tab', 'left-rail', 'right-tab', 'previews-tab', 'right-rail',
    'readout', 'readout-tab', 'hint', 'upper-right', 'clock', 'elsewhere',
    'strip', 'file-row', 'mode-corner',
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
    //
    // OPENED FIRST: shut shows nothing at all now (Movie, 16 Sep), so the
    // width worth measuring is the open panel's.
    await openShell(page);
    await page.locator('#right-tab').click();
    await page.waitForTimeout(200);
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
