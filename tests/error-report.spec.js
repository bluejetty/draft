// SEND A REPORT WHEN THE APP HITS A PROBLEM (Movie, 6 Nov).
//
// "on my old Archicad Program ... whenever it bugged out it would give me
// message about sending the report to archicad. could we do something like
// that when a user has a problem" -- "they wouldn't go to the user they would
// come to me, maybe a copy could go to the user" -- and, on the desk address,
// "not sure of the email i should use yet i will have to leave it empty for
// now". So the card is asserted with the desk EMPTY, which is how it ships:
// the report is saved here unless the drafter asks for a copy, and then it
// goes through the backup-email worker, stood in for by a route so nothing
// leaves the test.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const WORKER = 'https://bluejetty-mail.bluejetty.workers.dev/**';
const drawing = () => ({
  version: 1, planTurn: 0,
  levels: [{ id: 8, name: 'SITE', elev: 0 }, { id: 7, name: 'ROOF', elev: 0 },
    { id: 5, name: '2ND FL', elev: 9 }, { id: 3, name: 'MAIN FL', elev: 0 },
    { id: 1, name: 'FOUNDATION', elev: -8 }],
  activeLevelIdx: 3,
  walls: [], lines: [], floors: [], roofs: [], fenestrations: [], dimensions: [],
  outlines: [], shapes: [], surfaceOpenings: [], stairs: [], notes: [],
  roomTags: [], columns: [], beams: [], boneyardOutlines: [],
  groups: [], levelLocks: [], underlays: [], notepad: 'REPORT ME',
});

async function openModel(page) {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, f }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, f: drawing() });
  await page.goto('/MODEL.html');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
}
const sent = [];
const standInWorker = async (page, status = 200) => {
  sent.length = 0;
  await page.route(WORKER, async route => {
    sent.push(JSON.parse(route.request().postData()));
    await route.fulfill({ status, contentType: 'application/json', body: '{"ok":true}' });
  });
};
const card = page => page.locator('[data-error-report]');
// A fault the page did not catch: thrown off a timer, so it is the window's
// error, not the evaluate's.
const crash = (page, text) => page.evaluate(t => { setTimeout(() => { throw new Error(t); }, 0); }, text);
const reject = (page, text) => page.evaluate(t => { Promise.reject(new Error(t)); }, text);
const decoded = piece => Buffer.from(piece.dataUrl.split(',')[1], 'base64').toString('utf8');

test('an uncaught error opens ROUGH-DRAFTER HIT A PROBLEM once; with no desk address the report is saved on this computer', async ({ page }) => {
  await openModel(page);
  await standInWorker(page);
  await expect(card(page)).toHaveCount(0);
  // Something on the trail before the fault: a tool change and a key.
  await page.keyboard.press('s');
  await crash(page, 'boom from the spec');
  await expect(card(page)).toBeVisible();
  await expect(card(page).locator('#er-title')).toHaveText('ROUGH-DRAFTER HIT A PROBLEM');
  await expect(card(page).locator('[data-er-fault]')).toContainText('boom from the spec');
  // THE SAME FAULT AGAIN DOES NOT STACK A SECOND CARD -- a bug that fires on
  // every repaint would otherwise bury the drafter.
  await crash(page, 'boom from the spec');
  await page.waitForTimeout(100);
  await expect(card(page)).toHaveCount(1);
  // No desk address, no copy address: the button says what it will do.
  await expect(card(page).locator('[data-er-copy]')).toHaveValue('');
  await expect(card(page).locator('[data-er-send]')).toHaveText('SAVE REPORT FILE');
  await card(page).locator('[data-er-said]').fill('I pressed S and it fell over');
  const download = page.waitForEvent('download');
  await card(page).locator('[data-er-send]').click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/^rough-drafter-report-\d{8}-\d{6}\.txt$/);
  const text = require('fs').readFileSync(await file.path(), 'utf8');
  expect(text).toContain('MESSAGE    Uncaught Error: boom from the spec');
  expect(text, 'the stack').toMatch(/at .*MODEL\.html|at <anonymous>|Error: boom/);
  expect(text).toContain('I pressed S and it fell over');
  expect(text, 'the tool trail').toContain('tool select');
  expect(text, 'the key trail').toContain('key s');
  expect(text, 'the fault itself is on the trail').toContain('FAULT uncaught error: Uncaught Error: boom from the spec');
  expect(text, 'APP STATE from the page').toContain('LEVEL      1 MAIN FL');
  expect(text).toContain('TOOL       select');
  expect(text).toMatch(/BROWSER\s+Mozilla/);
  await expect(card(page).locator('[data-er-status]')).toHaveText('Report saved on this computer. Email it to the Rough Drafter desk when you can.');
  expect(sent, 'nothing went to the worker').toHaveLength(0);
  // AND ONCE ANSWERED, THE SAME FAULT STAYS ANSWERED for the rest of the
  // page's life; a different fault still asks.
  await card(page).locator('[data-er-skip]').click();
  await expect(card(page)).toHaveCount(0);
  await crash(page, 'boom from the spec');
  await page.waitForTimeout(100);
  await expect(card(page), 'the same fault, already reported').toHaveCount(0);
  await crash(page, 'a different boom');
  await expect(card(page).locator('[data-er-fault]')).toContainText('a different boom');
});

test('a copy address mails the report through the backup worker; the drawing goes only when ticked', async ({ page }) => {
  await openModel(page);
  await standInWorker(page);
  await crash(page, 'wall fell down');
  await expect(card(page)).toBeVisible();
  const copy = card(page).locator('[data-er-copy]');
  await copy.fill('kris@example.com');
  await expect(card(page).locator('[data-er-send]')).toHaveText('SEND');
  await card(page).locator('[data-er-send]').click();
  await expect(card(page).locator('[data-er-status]')).toHaveText('Report sent to kris@example.com. Thank you.');
  expect(sent, 'one email, no drawing').toHaveLength(1);
  expect(sent[0].email).toBe('kris@example.com');
  expect(sent[0].app).toBe('bluejetty');
  expect(sent[0].filename).toMatch(/^rough-drafter-report-.*\.txt$/);
  expect(decoded(sent[0])).toContain('wall fell down');
  expect(decoded(sent[0])).toContain('COPY TO    kris@example.com');
  await card(page).locator('[data-er-skip]').click();
  await expect(card(page)).toHaveCount(0);

  // TICKED: the .draft rides along as its own attachment, after the report.
  await crash(page, 'roof fell in');
  await expect(card(page)).toBeVisible();
  await expect(copy, 'the address is remembered').toHaveValue('kris@example.com');
  await card(page).locator('[data-er-file]').check();
  await card(page).locator('[data-er-send]').click();
  await expect(card(page).locator('[data-er-status]')).toHaveText('Report sent to kris@example.com. Thank you.');
  expect(sent).toHaveLength(3);
  expect(sent[2].filename).toMatch(/\.draft$/);
  expect(JSON.parse(decoded(sent[2])).notepad, 'the drawing as it stands').toBe('REPORT ME');
});

test('an unhandled promise rejection opens the card; NOT NOW closes it; REPORT A PROBLEM in the foot lane opens it by hand', async ({ page }) => {
  await openModel(page);
  await standInWorker(page);
  await reject(page, 'nobody caught me');
  await expect(card(page)).toBeVisible();
  await expect(card(page).locator('[data-er-fault]')).toContainText('nobody caught me');
  await card(page).locator('[data-er-skip]').click();
  await expect(card(page)).toHaveCount(0);

  const button = page.locator('#foot-lane [data-report-problem]');
  await expect(button).toHaveText('REPORT A PROBLEM');
  await button.click();
  await expect(card(page)).toHaveAttribute('data-error-report', 'manual');
  await expect(card(page).locator('#er-title')).toHaveText('REPORT A PROBLEM');
  await expect(card(page).locator('[data-er-fault]')).toHaveCount(0);
  // "alot of them probably won't fill it out i bet": a pick or a line is
  // enough, and with neither the card asks for one rather than mailing an
  // empty report. The drawing is ticked on here, off on the crash card.
  await expect(card(page).locator('[data-er-file]')).toBeChecked();
  await card(page).locator('[data-er-copy]').fill('kris@example.com');
  await card(page).locator('[data-er-send]').click();
  await expect(card(page).locator('[data-er-status]')).toHaveText('Tap what went wrong, or type a line.');
  expect(sent).toHaveLength(0);
  const picks = card(page).locator('[data-er-pick]');
  await expect(picks).toHaveText(['ROOF LOOKS WRONG', 'WALLS LOOK WRONG', "WON'T PRINT RIGHT", 'SOMETHING DISAPPEARED',
    'A BUTTON DOES NOTHING', 'TOO SLOW', 'OTHER']);
  await picks.nth(3).click();
  await expect(picks.nth(3)).toHaveAttribute('aria-pressed', 'true');
  await picks.nth(0).click();
  await expect(picks.nth(3), 'one pick at a time').toHaveAttribute('aria-pressed', 'false');
  await expect(picks.nth(0)).toHaveAttribute('aria-pressed', 'true');
  await card(page).locator('[data-er-said]').fill('the stair went the wrong way');
  await card(page).locator('[data-er-send]').click();
  await expect(card(page).locator('[data-er-status]')).toContainText('Report sent');
  expect(sent, 'the report and the drawing').toHaveLength(2);
  expect(decoded(sent[0])).toContain('(none -- the drafter pressed REPORT A PROBLEM)');
  expect(decoded(sent[0])).toContain('PICKED     ROOF LOOKS WRONG');
  expect(decoded(sent[0])).toContain('the stair went the wrong way');
  expect(sent[1].filename).toMatch(/\.draft$/);
  expect(sent.map(s => s.email)).toEqual(['kris@example.com', 'kris@example.com']);
});

test('three reports an hour a browser, and a worker that says no leaves SAVE REPORT FILE', async ({ page }) => {
  await openModel(page);
  await standInWorker(page);
  await page.evaluate(() => localStorage.setItem('draft-error-report-sent', JSON.stringify([Date.now(), Date.now(), Date.now()])));
  await page.locator('#foot-lane [data-report-problem]').click();
  await card(page).locator('[data-er-pick]').last().click();
  await card(page).locator('[data-er-file]').uncheck();
  await card(page).locator('[data-er-copy]').fill('kris@example.com');
  await card(page).locator('[data-er-send]').click();
  await expect(card(page).locator('[data-er-status]')).toContainText('sent its 3 reports for the hour');
  expect(sent).toHaveLength(0);
  await card(page).locator('[data-er-skip]').click();

  await page.evaluate(() => localStorage.removeItem('draft-error-report-sent'));
  await standInWorker(page, 500);
  await page.locator('#foot-lane [data-report-problem]').click();
  await card(page).locator('[data-er-pick]').last().click();
  await card(page).locator('[data-er-file]').uncheck();
  await card(page).locator('[data-er-copy]').fill('kris@example.com');
  await card(page).locator('[data-er-send]').click();
  await expect(card(page).locator('[data-er-status]')).toContainText('Could not send (the mail server replied 500)');
  await expect(card(page).locator('[data-er-send]')).toHaveText('SAVE REPORT FILE');
  const download = page.waitForEvent('download');
  await card(page).locator('[data-er-send]').click();
  expect((await download).suggestedFilename()).toMatch(/\.txt$/);
  expect(sent, 'a refused send is not retried by the save').toHaveLength(1);
});
