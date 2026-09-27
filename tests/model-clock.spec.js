// THE CLOCK IN THE BAR'S LOWEST ROW on MODEL.html.
//
// Movie, 20 Sep, asking for it: "in the same style of text in the upper right
// under the top banner (in model space currently there isn't anything in that
// spot) - can you put in there the current time and date of where the person
// is (timezonewise)".
//
// Movie, 25 Sep, moving it: "move the '# VISITS' and the DATE/TIME down below
// PROJECT / MODEL / REAL ESTATE / BONE / CONSTRUCTION / SPECTS / etc. on the
// lowest row (where it will be covered with http:/addressess (won't matter if
// these 2 items are covered from time to time".
//
// SO THE PLACEMENT CHECK FOLLOWED IT rather than being deleted. What it
// guards did not change with the corner: the reading is ON the page where he
// put it, it holds the same inset every other tenant of that row holds, and a
// press over it reaches what is underneath. Only the row is different.
//
// WHAT IS WORTH TESTING HERE IS NOT THAT A LINE OF TEXT APPEARED. A clock that
// renders beautifully and reads the server's zone, or the author's, or a time
// frozen at page load, passes every `toBeVisible()` anyone would think to
// write. So the claims asserted below are the ones that can actually be wrong:
//
//   IT IS THE VIEWER'S ZONE      two browsers a day apart read a day apart
//   IT IS THE REAL TIME          the reading agrees with the clock outside
//   IT MOVES, ON THE MINUTE      :30 to :50 changes nothing; the minute does
//   IT IS OUT OF THE WAY         it stands in the bar's hem, not on the sheet
//
// The ticking one is asserted with Playwright's clock rather than by waiting a
// minute -- a test that sleeps 60s to watch a digit change is a minute added
// to every shard forever.
//
// NOTHING HERE ASSERTS AN EXACT DATE STRING. The page hands the formatting to
// the browser's ICU and the runner's Node has its own, and the two disagree in
// small ways that are nobody's defect -- en-GB is "20 Sept 2026" on one ICU
// and "20 Sep 2026" on another. So the checks are on the PARTS: the year and
// the day the viewer's zone is actually in, a time with no seconds field, and
// a named zone. A spec that pinned the string would go red on a browser bump
// and teach everyone to edit it without reading it.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const REPRO = JSON.parse(fs.readFileSync(
  path.join(__dirname, '..', 'proto', 'repro-garage-house.draft'), 'utf8'));

// THE CONFIG'S `use` REACHES THE `page` FIXTURE AND NOT `browser.newContext`,
// so a context made by hand starts with no baseURL and the default viewport.
// Both are stated here rather than inherited, which is why they are written
// out: a relative goto in a hand-made context fails with "Invalid URL", and a
// corner measured at 1280x720 is not the corner every other spec measures.
const VIEW = { width: 1280, height: 900 };

// A REAL SHEET UNDER IT for the placement checks: an origin with nothing saved
// raises the empty-origin notice over the whole viewport, and measuring chrome
// against a page that is telling the drafter it has no drawing is measuring
// the wrong page.
async function openSheet(page) {
  await h.suppressEntryCoach(page);
  await page.goto('/MODEL.html');
  await page.waitForFunction(() => !!window.SharedFileStore, null, { timeout: 10000 });
  await page.evaluate(async ({ bucket, saved }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(saved)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, saved: REPRO });
  await page.goto('/MODEL.html?mode=night');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
}

test('the clock stands in the foot bar\'s lowest row, right of the page links',
  async ({ page }) => {
    await openSheet(page);

    const clock = page.locator('#clock');
    await expect(clock).toBeVisible();
    await expect(clock).not.toBeEmpty();

    const where = await page.evaluate(() => {
      const box = el => {
        const r = el.getBoundingClientRect();
        return { left: r.left, right: r.right, top: r.top, bottom: r.bottom };
      };
      const c = box(document.getElementById('clock'));
      return {
        clock: c,
        strip: box(document.getElementById('house-strip')),
        row: box(document.getElementById('page-row')),
        height: window.innerHeight,
        width: window.innerWidth,
        // THE ROW IS THE BAR'S, so the reading has to be INSIDE the bar and
        // not floating over it: the whole point of the hem is that a browser's
        // link preview lands on the bar's own panel colour. An element merely
        // positioned there would look identical and paint over the drawing the
        // moment the bar moved.
        inBar: document.getElementById('house-strip')
          .contains(document.getElementById('clock')),
        // WHAT A PRESS OVER IT LANDS ON. It is a reading, not a control, so a
        // press has to reach the bar it stands in rather than be swallowed by
        // a stray hit box over the sheet. ANSWERED AS "is it the bar or
        // something inside the bar", not as an id: the lane is the bar's own
        // hem and takes the hit itself, which is the bar -- while a stray
        // fixed box over the drawing would be neither.
        under: (() => {
          const el = document.elementFromPoint((c.left + c.right) / 2,
            (c.top + c.bottom) / 2);
          const bar = document.getElementById('house-strip');
          if (!el) return 'nothing';
          return (el === bar || bar.contains(el)) ? 'house-strip' : (el.id || el.tagName);
        })(),
      };
    });

    expect(where.inBar, 'the clock is a tenant of the bottom bar').toBe(true);
    expect(where.clock.top, 'the clock is BELOW the row of page links, not on it')
      .toBeGreaterThanOrEqual(where.row.bottom);
    expect(where.strip.bottom - where.clock.bottom,
      'and stands in the hem at the foot of the bar, not under the sheet')
      .toBeLessThan(12);
    expect(where.clock.left, 'the clock is in the right half of the sheet')
      .toBeGreaterThan(where.width / 2);
    expect(where.width - where.clock.right,
      'and holds the 12px inset the bar holds').toBeLessThanOrEqual(13);
    expect(where.under, 'a press over the clock reaches the bar it stands in')
      .toBe('house-strip');
  });

// ── IT IS THE VIEWER'S CLOCK, WHICH IS THE WHOLE REQUEST ──
//
// Two contexts 25 hours apart: Kiritimati is UTC+14 and Niue UTC-11, so there
// is no instant at which the two agree on the DATE, never mind the hour. A
// clock wired to the server, to UTC, or to whatever zone the author's machine
// was in reads the same in both, and this is the check that says so.
test('two drafters a day apart read two different clocks',
  async ({ browser, baseURL }) => {
    const read = async (timezoneId, locale) => {
      const context = await browser.newContext({ baseURL, viewport: VIEW, timezoneId, locale });
      try {
        const page = await context.newPage();
        await page.goto('/MODEL.html');
        const clock = page.locator('#clock');
        await expect(clock).not.toBeEmpty();
        return await clock.textContent();
      } finally {
        await context.close();
      }
    };

    const kiritimati = await read('Pacific/Kiritimati', 'en-US');
    const niue = await read('Pacific/Niue', 'en-US');
    expect(kiritimati, 'the far side of the date line reads its own day')
      .not.toBe(niue);

    // AND THE LOCALE IS THEIRS TOO, not an American reading translated. A
    // German browser is on a 24-hour clock, so an AM or a PM in that line
    // would mean the page had decided how a time is written rather than
    // asking the person whose time it is.
    const berlin = await read('Europe/Berlin', 'de-DE');
    expect(berlin, 'a German browser is not shown an American clock')
      .not.toMatch(/\b(AM|PM)\b/);
    expect(berlin, 'a 24-hour reading, in their own words').toMatch(/\d{1,2}:\d{2}/);
  });

// ── AND IT IS THE REAL TIME, NOT A PLAUSIBLE ONE ──
//
// en-GB on UTC so the reading is 24-hour and comparable with the runner's own
// clock without parsing an AM or a PM. The one-minute tolerance is for the
// boundary, not for slop: a page loaded at 15:59:59.8 is read at 16:00:00.1 by
// an assertion that has to be right either way.
test('the reading is the clock outside the browser, to the minute',
  async ({ browser, baseURL }) => {
    const context = await browser.newContext({
      baseURL, viewport: VIEW, timezoneId: 'UTC', locale: 'en-GB',
    });
    let text; let now;
    try {
      const page = await context.newPage();
      await page.goto('/MODEL.html');
      await expect(page.locator('#clock')).not.toBeEmpty();
      text = await page.locator('#clock').textContent();
      now = new Date();
    } finally {
      await context.close();
    }

    // ONE SEPARATOR, TWO HALVES -- the date the drafter is in and the time
    // they are at. Asserted first so a failure below says which half broke.
    const parts = text.split(' · ');
    expect(parts, `two halves, not ${parts.length}: ${text}`).toHaveLength(2);
    const [when, at] = parts;

    expect(when, 'the date carries the year').toContain(String(now.getUTCFullYear()));
    expect(when, 'and the day the viewer is actually in')
      .toMatch(new RegExp(`\\b${now.getUTCDate()}\\b`));
    // NO SECONDS FIELD, and the zone is NAMED: hh:mm and then one more word.
    // A drafter working across a time difference is reading this to know which
    // clock the reading belongs to, and `\S+` is as much as can be claimed
    // about a zone label that is "UTC" on one browser and "GMT" on another.
    expect(at, 'hours, minutes and the zone -- and no seconds ticking')
      .toMatch(/^\d{1,2}:\d{2} \S+$/u);

    const [, hh, mm] = at.match(/(\d{1,2}):(\d{2})/);
    const shown = Number(hh) * 60 + Number(mm);
    const real = now.getUTCHours() * 60 + now.getUTCMinutes();
    // Minutes of the day, wrapped, so a reading either side of midnight is one
    // minute out rather than 1439.
    const apart = Math.min(Math.abs(shown - real), 1440 - Math.abs(shown - real));
    expect(apart, `the clock read "${text}" at ${now.toISOString()}`)
      .toBeLessThanOrEqual(1);
  });

// ── IT MOVES, AND IT MOVES ON THE MINUTE ──
//
// A clock written once at load looks right for sixty seconds and is wrong for
// the rest of the day, which is the defect this exists to catch. Playwright's
// clock makes it a fast test instead of a minute-long one: install at a known
// instant and step the page's own timers over the boundary.
test('the clock turns over with the minute and not with the second',
  async ({ browser, baseURL }) => {
    const context = await browser.newContext({
      baseURL, viewport: VIEW, timezoneId: 'UTC', locale: 'en-GB',
    });
    try {
      const page = await context.newPage();
      // :30 PAST THE MINUTE on purpose. The tick is aimed at the minute
      // boundary rather than set to 60s from now, so from here the next write
      // is due in 30s -- which is what makes the two steps below mean what
      // they say. A clock that merely counted 60s from load would still read
      // 15:42 after the second step and fail.
      await page.clock.install({ time: new Date('2026-09-20T15:42:30Z') });
      await page.goto('/MODEL.html');

      const clock = page.locator('#clock');
      await expect(clock).toContainText('15:42');
      await expect(clock, 'the date is there beside it').toContainText('2026');

      // Twenty seconds. A clock counting seconds would have moved twenty times.
      await page.clock.fastForward(20_000);
      await expect(clock).toContainText('15:42');

      // And over the boundary, thirty-one seconds after the install.
      await page.clock.fastForward(20_000);
      await expect(clock).toContainText('15:43');
    } finally {
      await context.close();
    }
  });

// ── AND ON EVERY PAGE CARRYING THE BAR, NOT JUST THIS ONE ──
//
// Movie, 27 Sep, on the new Real Estate page: "i just noticed the date time
// doesn't show on the bottom right on this page", then "REAL ESTATE PAGE needs
// time /date".
//
// IT COULD NOT, and nothing above would ever have said so: the reading was
// twenty lines inline in MODEL.html while the lane it stands in is written by
// shell-bars.js, so every page added after 20 Sep got the slot and none of
// them got the clock. An empty slot is `display:none` by design, so the gap
// looked exactly like a page that had nothing to say.
//
// SO THE CLAIM IS ABOUT THE BAR. Asked per page, because "the module has a
// mountClock" is not the thing that was wrong -- what was wrong is that a page
// carrying this bar could come up without the reading, and only a page can
// answer that. The list is every page that calls bottomBar().
for (const page of ['MODEL', 'PROJECT', 'REALESTATE', 'SPECS', 'LAYOUT']) {
  test(`${page} carries the bar, so it carries the clock`, async ({ browser, baseURL }) => {
    const context = await browser.newContext({
      baseURL, viewport: VIEW, timezoneId: 'UTC', locale: 'en-GB',
    });
    try {
      const tab = await context.newPage();
      await h.suppressEntryCoach(tab);
      await tab.goto(`/${page}.html`);
      const clock = tab.locator('#clock');
      await expect(clock, 'the reading is on the page').toBeVisible();
      await expect(clock).not.toBeEmpty();

      // IN THE LANE AND AT THE RIGHT, which is where he looks for it: "the
      // bottom right on this page".
      const where = await tab.evaluate(() => {
        const r = document.getElementById('clock').getBoundingClientRect();
        const bar = document.querySelector('[data-foot-lane]');
        const lane = bar.getBoundingClientRect();
        return { right: r.right, left: r.left, width: window.innerWidth,
          inLane: bar.contains(document.getElementById('clock')),
          laneTop: lane.top, clockTop: r.top,
          // THE COUNT'S HOME IS LEFT OF IT: "viewcount on left if possible
          // too". The count itself is silent on localhost by design, so what
          // is asserted is the SLOT's side of the lane -- which is the part
          // the bar decides and the part that could be wrong.
          countLeft: bar.querySelector('[data-visit-counter-home]')
            ? bar.querySelector('[data-visit-counter-home]').compareDocumentPosition(
              document.getElementById('clock')) & Node.DOCUMENT_POSITION_FOLLOWING
            : 0 };
      });
      expect(where.inLane, 'the clock is a tenant of the bar\'s foot lane').toBe(true);
      expect(where.left, 'and reads in the right half of the sheet')
        .toBeGreaterThan(where.width / 2);
      expect(where.width - where.right, 'holding the 12px inset the lane holds')
        .toBeLessThanOrEqual(13);
      expect(where.countLeft, 'with the visit count\'s home to its left')
        .toBeGreaterThan(0);
    } finally {
      await context.close();
    }
  });
}
