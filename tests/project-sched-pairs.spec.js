// THE SCHEDULE READS TWO TO A LINE, AND NOTHING IS LOST FITTING IT THERE.
//
// Movie, 27 Sep, with a mock-up made by cutting the column in half in GIMP
// and pasting the bottom beside the top: *"i found a way to make the text
// entry not as long by doubling the info per row"*. The house column ran 21
// rows and 713px — taller than the 500px drawing beside it and off the bottom
// of his 768px screen.
//
// ── WHERE THE WIDTH CAME FROM ───────────────────────────────────────────────
//
// Asked what should give, he answered: *"what about making the section
// slightly smaller"*. Measuring said the section barely had to. Across the
// five bungalow variations the drawing's ink spans 241–456px of a 600px
// canvas while filling the HEIGHT every time — and sectionView takes the
// SMALLER of the width fit and the height fit, so height was setting the
// scale throughout and the spare width was doing nothing at all.
//
// That is the claim the canvas cut rests on, so it is the claim checked here:
// the drawing must still be HEIGHT-fit at 360px. If it ever stops being, the
// canvas has been cut into the drawing and every variation starts shrinking —
// which no check on this page would otherwise notice, because a smaller
// drawing is still a correct drawing.
//
// ── THE FAILURE THAT LOOKED LIKE SUCCESS ────────────────────────────────────
//
// Halving the width broke exactly one thing, and it broke it silently. A
// select row gives its box a fixed 104px so GRADE BEAM is not clipped to
// GRADE; inside a 155px half that left 36px for the name, and ATTACHMENT is a
// single word that cannot wrap. The page drew "ATTACHME" — text gone, no
// error, no overflow, and a screenshot that reads fine at a glance. Movie
// spotted it before any check did.
//
// So a check asks the browser what it needed rather than what it drew:
// scrollWidth against clientWidth, over every name in both columns.
const { test, expect } = require('@playwright/test');

const open = async (page, type = 'bungalow') => {
  await page.goto(`/PROJECT.html?type=${type}`);
  await page.waitForSelector('#sched-house .sched-row', { state: 'visible', timeout: 10000 });
};

// A LINE IS A SHARED TOP, not a count divided by two: rows are hidden and
// shown as the drawing changes (2ND FL's four go off a 1 STOREY), so the
// arithmetic would drift and the geometry cannot.
const lines = async (page, id) => page.evaluate(sel => {
  const rows = [...document.querySelectorAll(`${sel} .sched-row`)].filter(r => !r.hidden);
  return { rows: rows.length,
    lines: new Set(rows.map(r => Math.round(r.getBoundingClientRect().top))).size };
}, `#${id}`);

test.describe('PROJECT — the bungalow schedule pairs', () => {
  test('the house column puts two rows on a line', async ({ page }) => {
    await open(page);
    const { rows, lines: n } = await lines(page, 'sched-house');
    // MORE ROWS THAN LINES IS THE WHOLE CLAIM, and it is the one number a
    // column that quietly fell back to single would fail: there rows === lines
    // exactly. Pinned as a ratio rather than "11", because a level added to
    // the fixture should not have to come back here.
    expect(rows).toBeGreaterThan(12);
    expect(n).toBeLessThan(rows);
    expect(n).toBeLessThanOrEqual(Math.ceil(rows / 2) + 3); // + the group heads
  });

  test('and so does the attached garage column', async ({ page }) => {
    await open(page);
    const { rows, lines: n } = await lines(page, 'sched-garage');
    expect(rows).toBeGreaterThan(6);
    expect(n).toBeLessThan(rows);
  });

  test('no row name is clipped', async ({ page }) => {
    await open(page);
    // THE ATTACHMENT BUG, asked of every name rather than of the one that had
    // it. A name is clipped when the element needs more width than it has —
    // and a single word cannot wrap out of trouble, so this is the only way
    // the loss shows up in anything but a screenshot.
    const clipped = await page.evaluate(() => {
      const bad = [];
      for (const id of ['sched-house', 'sched-garage']) {
        for (const row of document.getElementById(id).querySelectorAll('.sched-row')) {
          if (row.hidden) continue;
          const name = row.querySelector('.sched-name');
          if (!name) continue;
          const width = name.getBoundingClientRect().width;
          if (name.scrollWidth > Math.ceil(width) + 1) {
            bad.push(`${name.textContent} needs ${name.scrollWidth} in ${Math.round(width)}`);
          }
        }
      }
      return bad;
    });
    expect(clipped).toEqual([]);
  });

  test('a group head keeps a line to itself, so no pair straddles two groups',
    async ({ page }) => {
      await open(page);
      // WITHOUT THIS, 2ND FL's last row could share a line with MAIN FL's
      // first and the heading above them would name only half of what it sat
      // over — a schedule that is wrong rather than merely ugly, because
      // every one of these rows is a height and the head says whose.
      const straddles = await page.evaluate(() => {
        const bad = [];
        for (const id of ['sched-house', 'sched-garage']) {
          const host = document.getElementById(id);
          const tops = new Map();
          for (const el of host.querySelectorAll('.sched-head, .sched-row')) {
            if (el.hidden) continue;
            const top = Math.round(el.getBoundingClientRect().top);
            (tops.get(top) || tops.set(top, []).get(top)).push(el);
          }
          for (const [, group] of tops) {
            if (group.some(el => el.classList.contains('sched-head')) && group.length > 1) {
              bad.push(group.map(el => el.textContent.slice(0, 20)).join(' + '));
            }
          }
        }
        return bad;
      });
      expect(straddles).toEqual([]);
    });

  test('a row still holds exactly a name and a value', async ({ page }) => {
    await open(page);
    // THE CONTRACT THE PAIRING WAS BUILT AROUND, and the reason it is done on
    // the COLUMN rather than by merging rows. Three checks elsewhere index
    // these positionally — project-bilevel reads children[0]/children[1]
    // twice, project-page filters on .sched-name — so a row that grew to four
    // cells would have broken them all for a layout change. Stated here so
    // the next person to compact this column finds the rule before the
    // failures.
    const wrong = await page.evaluate(() => [...document.querySelectorAll(
      '#sched-house .sched-row, #sched-garage .sched-row')]
      .filter(r => !r.hidden && !r.classList.contains('wide'))
      .filter(r => r.children.length !== 2)
      .map(r => `${r.dataset.schedRow}: ${r.children.length}`));
    expect(wrong).toEqual([]);
  });

  test('a row does not reprint the word its own head carries', async ({ page }) => {
    await open(page);
    // MUTATION ASKED FOR THIS ONE. Making dropHeadWord a no-op -- every name
    // back to "2ND FL WALL HEIGHT" and "Garage fascia depth" -- left all six
    // checks above green, because the column still paired and nothing
    // clipped. Half the change had no witness at all.
    //
    // AND IT IS WRITTEN AS THE RULE, NOT AS THE NAMES. A list of expected
    // strings would need editing every time a row is added and would say
    // nothing about the row that was added wrong. The heads are read off the
    // page, so a storey added in MODEL is covered without anyone remembering
    // to come back here.
    //
    // THE FIRST WORD, not the whole head, and that is not belt and braces: it
    // is the bug this caught. The tag is "2ND FL JST", and expanding the
    // short form before stripping the head left "2ND joist depth" -- which no
    // longer begins with "2ND FL" and so slipped past a whole-head test while
    // still printing the level twice.
    //
    // ROOF IS DELIBERATELY EXEMPT. Its rows keep ROOF PITCH : 12 and ROOF
    // HEEL, which is Movie's own wording; only the OVERHANG row lost the word
    // (27 Sep, so it matches the garage's). A head is a place, and ROOF is
    // the one head here that is also part of the parts' names.
    const echoes = await page.evaluate(() => {
      const bad = [];
      const walk = (id, heads) => {
        let words = [];
        for (const el of document.getElementById(id).children) {
          if (el.classList.contains('sched-head')) {
            const text = el.textContent.trim();
            words = heads(text) ? text.toUpperCase().split(/\s+/).filter(w => w.length > 1) : [];
            continue;
          }
          if (!el.classList.contains('sched-row') || el.hidden) continue;
          const name = el.querySelector('.sched-name');
          if (!name) continue;
          const text = name.textContent.trim().toUpperCase();
          words.forEach(w => { if (text === w || text.startsWith(w + ' ')) bad.push(`${w} / ${text}`); });
        }
      };
      walk('sched-house', text => /\bFL\b/i.test(text));
      walk('sched-garage', () => true);
      return bad;
    });
    expect(echoes).toEqual([]);
  });

  test('the narrower canvas did not shrink the drawing', async ({ page }) => {
    await open(page);
    // HEIGHT MUST STILL BE SETTING THE SCALE. sectionView takes the smaller
    // of canvas.width/span and canvas.height/rise, so while the drawing runs
    // the full height of the canvas its width is slack and cutting the canvas
    // costs it nothing. The moment the ink stops reaching top and bottom, the
    // WIDTH has become the binding fit and the canvas has been cut into the
    // drawing — at which point every variation is being drawn smaller than it
    // was, silently and correctly-looking.
    const fill = await page.evaluate(() => {
      const c = document.getElementById('detail-canvas');
      const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
      const bg = [d[0], d[1], d[2]];
      let minY = c.height, maxY = -1;
      for (let y = 0; y < c.height; y += 1) {
        for (let x = 0; x < c.width; x += 1) {
          const i = (y * c.width + x) * 4;
          if (Math.abs(d[i] - bg[0]) + Math.abs(d[i + 1] - bg[1])
            + Math.abs(d[i + 2] - bg[2]) <= 24) continue;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
          break;
        }
      }
      return { height: c.height, width: c.width, minY, maxY };
    });
    expect(fill.width, 'the canvas is the narrower one').toBe(360);
    // Within a few pixels of the full height, top and bottom.
    expect(fill.minY, 'the drawing reaches the top of its canvas').toBeLessThan(20);
    expect(fill.maxY, 'and the bottom')
      .toBeGreaterThan(fill.height - 20);
  });
});

// ── AND BAND 3, WHICH WAS PAIRED ON 28 SEP ────────────────────────────────
//
// Movie: *"make the arrangement like the BUNGALOW - 2 columns per"*. The same
// auto-fit rule, so the same trap: the 128px floor falls back to ONE column
// the moment a column is narrower than 264, and nothing looks wrong when it
// does -- falling back is what auto-fit is for. That is why the bungalow's
// own note records the afternoon a 140px floor paired at 1366 and quietly
// stopped at 1280, and why this file runs at the config's 1280. Band 3 buys
// its width the same way band 1 did, by cutting its canvas (360, then 300
// once the FOUNDATION block grew its dropdowns), so the
// same pair of checks holds it: the columns pair, and the drawing did not pay
// for it.
test.describe('PROJECT — the detached schedule pairs', () => {
  const openDetached = async page => {
    await page.goto('/PROJECT.html?type=detached');
    await page.waitForSelector('#sched-detached-right .sched-row', { state: 'visible', timeout: 10000 });
  };

  test('both columns put two rows on a line', async ({ page }) => {
    await openDetached(page);
    for (const id of ['sched-detached-left', 'sched-detached-right']) {
      const { rows, lines: n } = await lines(page, id);
      expect(rows, id).toBeGreaterThan(2);
      // rows === lines exactly is what a column that fell back to single reads.
      expect(n, id).toBeLessThan(rows);
    }
  });

  test('no row name is clipped and no head shares its line', async ({ page }) => {
    await openDetached(page);
    const bad = await page.evaluate(() => {
      const clipped = [];
      const straddles = [];
      for (const id of ['sched-detached-left', 'sched-detached-right']) {
        const host = document.getElementById(id);
        const tops = new Map();
        for (const el of host.querySelectorAll('.sched-head, .sched-row')) {
          if (el.hidden) continue;
          const top = Math.round(el.getBoundingClientRect().top);
          (tops.get(top) || tops.set(top, []).get(top)).push(el);
          const name = el.querySelector && el.querySelector('.sched-name');
          if (!name) continue;
          const width = name.getBoundingClientRect().width;
          if (name.scrollWidth > Math.ceil(width) + 1) {
            clipped.push(`${name.textContent} needs ${name.scrollWidth} in ${Math.round(width)}`);
          }
        }
        for (const [, group] of tops) {
          if (group.some(el => el.classList.contains('sched-head')) && group.length > 1) {
            straddles.push(group.map(el => el.textContent.slice(0, 20)).join(' + '));
          }
        }
      }
      return { clipped, straddles };
    });
    expect(bad.clipped).toEqual([]);
    expect(bad.straddles).toEqual([]);
  });

  // THE CONTRACT THE PAIRING IS BUILT AROUND, asked of band 3 as well:
  // project-bilevel indexes children[0]/children[1] and project-page filters
  // on .sched-name, so a row that grew a third cell would break them for a
  // layout change.
  test('a detached row still holds exactly a name and a value', async ({ page }) => {
    await openDetached(page);
    const wrong = await page.evaluate(() => [...document.querySelectorAll(
      '#sched-detached-left .sched-row, #sched-detached-right .sched-row')]
      .filter(r => !r.hidden && !r.classList.contains('wide'))
      .filter(r => r.children.length !== 2)
      .map(r => `${r.dataset.schedRow}: ${r.children.length}`));
    expect(wrong).toEqual([]);
  });

  test('the narrower canvas did not shrink the detached drawing', async ({ page }) => {
    await openDetached(page);
    const fill = await page.evaluate(() => {
      const c = document.getElementById('detached-canvas');
      const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
      const bg = [d[0], d[1], d[2]];
      let minY = c.height, maxY = -1;
      for (let y = 0; y < c.height; y += 1) {
        for (let x = 0; x < c.width; x += 1) {
          const i = (y * c.width + x) * 4;
          if (Math.abs(d[i] - bg[0]) + Math.abs(d[i + 1] - bg[1])
            + Math.abs(d[i + 2] - bg[2]) <= 24) continue;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
          break;
        }
      }
      return { height: c.height, width: c.width, minY, maxY };
    });
    // 300 SINCE THE FOUNDATION BLOCK GREW ITS DROPDOWNS. At 360 the column's
    // half left FDN TYPE's select 83px and drew "THICKENED EDG"; the reason
    // the number moved is written at the rule in PROJECT.html.
    expect(fill.width, 'the canvas is the narrower one').toBe(300);
    expect(fill.minY, 'the drawing reaches the top of its canvas').toBeLessThan(20);
    expect(fill.maxY, 'and the bottom').toBeGreaterThan(fill.height - 20);
  });
});
