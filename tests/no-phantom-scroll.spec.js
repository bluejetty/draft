// A PAGE THAT IS TALLER THAN THE WINDOW WITH NOTHING IN IT.
//
// Movie, 27 Sep, of PROJECT.html: "then we don't need the SCROLL BAR on the
// right anymore do we". It was not the content. `main` carries a fixed bar's
// clearance as a TOP MARGIN, that margin collapses through body -- body has
// neither padding nor border to stop it -- and `min-height:100vh` then claims
// a whole viewport starting from wherever the collapsed margin left body's
// box. The page comes out exactly --strip-h-and-change taller than the
// window, at every window size, however little is on it. 236633c fixed
// PROJECT by dropping the min-height.
//
// IT WAS STILL ON THREE MORE PAGES, and this file is why that is now known
// rather than guessed. SPECS.html had the live fault and nobody had reported
// it; STANDARDS.html and SETTINGS.html carried the identical CSS line and did
// NOT have it, because their top bar is in normal flow and there is nothing
// for main's margin to collapse past. Reading the line tells you which page
// is broken exactly as often as it tells you wrong.
//
// SO IT MEASURES, AND THE MEASUREMENT IS A FIXED POINT. "Does the page
// scroll" cannot be the question: STANDARDS is a list of forty layer rows and
// is honestly 3648px tall, and a check that failed on it would be deleted
// within a week. The question is whether the page's height DEPENDS ON THE
// WINDOW'S -- give it a window as tall as it just said it needed, and ask
// again. A page with a lot in it says the same number twice and settles. A
// page asserting a phantom viewport comes back taller every round, forever,
// by the size of the collapsed margin:
//
//     SPECS.html, before:  3094 -> 3162 -> 3230 -> 3298   (+68 = --strip-h + 24)
//     SPECS.html, after:   3094 -> 3094
//
// That is why the fault shows here whatever the viewport, and why a page can
// be caught the day it grows one rather than the day somebody notices a bar.
//
// IT SCANS RATHER THAN LISTS, for shared-shell-harness.js's reason: two hand-
// kept rosters of pages exist in this repo and BOTH have drifted. The next
// page added is covered without anyone remembering this file exists.
const fs = require('fs');
const path = require('path');
const { test, expect } = require('@playwright/test');

const ROOT = path.join(__dirname, '..');
const PAGES = fs.readdirSync(ROOT).filter(f => f.endsWith('.html')).sort();

const WIDTH = 1280;
const START = 700;
// Three extra rounds. A settling page takes one, and a phantom grows by a
// fixed amount every round, so it is over by the second -- the third is there
// only so the failure prints a trail nobody can read as a slow convergence.
const ROUNDS = 4;

// THE COMPANION EVERY SCAN NEEDS. Every assertion below is of the shape "no
// page does X", which is triumphantly true of a glob that has stopped
// matching. Naming a page that must be in the list is what makes the sweep
// mean something.
test('the scan finds the pages', () => {
  expect(PAGES.length).toBeGreaterThanOrEqual(5);
  expect(PAGES).toContain('PROJECT.html');
});

for (const page of PAGES) {
  test(`${page} is no taller than what is on it`, async ({ page: tab }) => {
    await tab.setViewportSize({ width: WIDTH, height: START });
    await tab.goto(`/${page}`, { waitUntil: 'networkidle' });

    const trail = [];
    let height = START;
    let settled = false;
    for (let round = 0; round < ROUNDS && !settled; round += 1) {
      await tab.setViewportSize({ width: WIDTH, height });
      // The bars and the drawings size themselves off the window, so the
      // number has to be read after the resize has been laid out rather than
      // in the same frame as it.
      await tab.waitForTimeout(150);
      const document_ = await tab.evaluate(() => document.documentElement.scrollHeight);
      trail.push(`${height} -> ${document_}`);
      // ASKED OF THE WINDOW THAT WAS UP WHEN IT WAS MEASURED, which is the
      // whole check and easy to lose: growing the window to the answer and
      // THEN comparing compares a number with itself and passes on every page
      // there is. It did, on the first draft of this file, against a SPECS
      // that was visibly still growing.
      settled = document_ <= height;
      height = document_;
    }

    expect(settled, `${page} never stops growing: ${trail.join(', ')}. `
      + 'A document that is taller than the window at every window size is not '
      + 'content -- look for min-height:100vh on body with a fixed bar\'s '
      + 'clearance carried as a top margin on main, which collapses through '
      + 'body. See the block at the top of this file.').toBe(true);
  });
}
