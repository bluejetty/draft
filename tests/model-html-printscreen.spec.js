// PRINTSCREEN MAKES A PRESENTATION, NOT A DRAWING.
//
// Movie, 15 Sep: three pages to show a client -- this view, the whole plan,
// and the view tiles -- with NOT TO SCALE above the logo on every one. The
// disclaimer is tested as hard as the pictures, because it is the whole
// reason a button that prints is allowed on a page that deliberately has no
// print path: a screen grab a client can mistake for a permit sheet is worse
// than no screen grab at all.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const REPRO = JSON.parse(fs.readFileSync(
  path.join(__dirname, '..', 'proto', 'repro-garage-house.draft'), 'utf8'));

// THE PRINT DIALOG IS STUBBED, NOT DRIVEN. window.print() blocks on a native
// dialog Playwright cannot dismiss, so it is replaced by a recorder that
// copies the sheet AS IT IS at the moment of the call -- the only moment it
// exists, since the page tears it up afterwards, which is itself asserted
// below.
async function stubPrint(page) {
  await page.addInitScript(() => {
    window.__printCalls = 0;
    window.print = () => {
      window.__printCalls += 1;
      window.__printedHtml = document.getElementById('presentation')?.outerHTML || '';
      window.__printedPages =
        document.querySelectorAll('#presentation .pres-page').length;
    };
  });
}

// The house is seeded through the store rather than drawn: what is being
// measured is the presentation, so the drawing must not also be the test.
async function openHouse(page, { empty = false } = {}) {
  await stubPrint(page);
  await h.openModel(page, { webgl: false });
  // The empty case is a file with its levels and no geometry, NOT the
  // absence of a file: with nothing saved at all this page covers itself
  // with a full-screen notice, and a drafter with no drafting screen in
  // front of them is not the case being asked about.
  const drawing = empty
    ? { ...REPRO, walls: [], lines: [], outlines: [], dimensions: [], notes: [] }
    : REPRO;
  await page.evaluate(async ({ bucket, saved }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(saved)], 'drawing.json', { type: 'application/json' }),
      bucket);
  }, { bucket: BUCKET, saved: drawing });
  await page.goto('/MODEL.html');
  // The readout is this page's ready signal (`data-model-ready` belongs to
  // the old page and this one never sets it).
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
}

// The rail lands one seat per frame, so a presentation taken too early prints
// a half-painted set of tiles. Same wait the seats spec uses, same reason.
async function settleRail(page) {
  await expect
    .poll(async () => (/rail ([\d.]+) ms/.exec(await page.locator('#readout').textContent()) || [])[1],
      { timeout: 6000 })
    .not.toBe('0.00');
  await page.waitForTimeout(200);
}

const planBuffer = page =>
  page.evaluate(() => document.getElementById('plan').toDataURL());

const printedDoc = async page => {
  const html = await page.evaluate(() => window.__printedHtml);
  expect(html, 'nothing was handed to the print dialog').toBeTruthy();
  return html;
};

test('PRINTSCREEN sits between the units and the mode switches', async ({ page }) => {
  await openHouse(page);
  await expect(page.locator('#printscreen')).toBeVisible();

  // Movie named the seat, so the seat is asserted and not merely the
  // button's existence -- one that drifted to the far end of the bar would
  // pass every other check in this file.
  const order = await page.evaluate(() => {
    const all = [...document.querySelectorAll('#strip button, #strip a')];
    return {
      units: all.indexOf(document.getElementById('units-toggle')),
      print: all.indexOf(document.getElementById('printscreen')),
      toy: all.indexOf(document.querySelector('#mode-corner [data-board="toy"]')),
    };
  });
  expect(order.units).toBeLessThan(order.print);
  expect(order.print).toBeLessThan(order.toy);
});

test('three pages: this view, the whole plan, and the views rail', async ({ page }) => {
  await openHouse(page);
  await settleRail(page);
  await page.locator('#printscreen').click();

  expect(await page.evaluate(() => window.__printCalls)).toBe(1);
  expect(await page.evaluate(() => window.__printedPages),
    'the presentation was not three pages').toBe(3);

  const html = await printedDoc(page);
  // Page 3 carries one tile per seat that has something in it -- Movie's
  // "all the active little layout views".
  const tiles = (html.match(/data-pres-tile=/g) || []).length;
  const inked = await page.evaluate(() =>
    [...document.querySelectorAll('#view-rail .seat:not([disabled])')]
      .filter(seat => {
        const c = seat.firstChild;
        const { data } = c.getContext('2d').getImageData(0, 0, c.width, c.height);
        for (let i = 3; i < data.length; i += 4) if (data[i] !== 0) return true;
        return false;
      }).length);
  expect(inked, 'the rail seated nothing, so this proves nothing').toBeGreaterThan(0);
  expect(tiles, 'the views page did not carry the rail seats').toBe(inked);
});

// THREE PAGES IN THE DOM IS NOT THREE SHEETS OF PAPER. This is the only
// check here that asks the printer rather than the page: the app pane is
// html/body height:100% with overflow hidden, which clipped the whole set to
// sheet one while every DOM check above stayed green. Chromium's own
// paginator counts them.
test('three sheets come out, not one clipped one', async ({ page }) => {
  await openHouse(page);
  await settleRail(page);
  await page.locator('#printscreen').click();
  await page.emulateMedia({ media: 'print' });

  const pdf = await page.pdf({ printBackground: true });
  const count = (pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;
  expect(count, 'the presentation printed as one clipped sheet').toBe(3);
});

// LANDSCAPE IS READ OFF THE PAPER, not off the stylesheet. preferCSSPageSize
// is what makes Chromium's headless printer obey @page at all -- a real print
// dialog obeys it by itself -- and the MediaBox is the sheet the client holds.
test('the sheets come out landscape', async ({ page }) => {
  await openHouse(page);
  await settleRail(page);
  await page.locator('#printscreen').click();
  await page.emulateMedia({ media: 'print' });

  const pdf = await page.pdf({ printBackground: true, preferCSSPageSize: true });
  const box = pdf.toString('latin1').match(/\/MediaBox\s*\[\s*0\s+0\s+([\d.]+)\s+([\d.]+)/);
  expect(box, 'no sheet size in the pdf').not.toBeNull();
  const [w, h] = [Number(box[1]), Number(box[2])];
  expect(w, `the paper came out ${w}x${h}, taller than it is wide`).toBeGreaterThan(h);
});

// THE GAP IS MEASURED ON PAPER, not read out of the stylesheet. The first
// version of this check declared 1/8" in the grid and the tiles still stood
// 92px apart: a figure carries 40px of browser margin of its own, so the
// space between two tiles was the margins, not the gap, and the picture was
// that much narrower for it.
test('an eighth of an inch between the view tiles', async ({ page }) => {
  await openHouse(page);
  await settleRail(page);
  await page.locator('#printscreen').click();
  await page.emulateMedia({ media: 'print' });

  const gaps = await page.evaluate(() => {
    const tiles = [...document.querySelectorAll('#presentation .pres-tile')]
      .map(tile => tile.getBoundingClientRect());
    const row = tiles.filter(box => Math.abs(box.top - tiles[0].top) < 1);
    return row.slice(1).map((box, i) => box.left - row[i].right);
  });

  expect(gaps.length,
    'only one tile in the top row to measure from').toBeGreaterThan(0);
  gaps.forEach(gap =>
    expect(gap, `the tiles are ${gap}px apart`).toBeCloseTo(12, 0));
});

// MORE THAN TWELVE VIEWS OPENS ANOTHER SHEET (Movie, 15 Sep). Left to spill,
// the grid did break onto a fourth page by itself -- and the tiles that
// landed there had no title, no NOT TO SCALE and no logo over them, which is
// the one thing this whole feature exists to prevent.
test('a thirteenth view opens a fourth page, marked like the rest', async ({ page }) => {
  await openHouse(page);
  await settleRail(page);

  const seated = await page.evaluate(() => {
    const rail = document.getElementById('view-rail');
    const isInked = seat => {
      const c = seat.firstChild;
      const { data } = c.getContext('2d').getImageData(0, 0, c.width, c.height);
      for (let i = 3; i < data.length; i += 4) if (data[i] !== 0) return true;
      return false;
    };
    const inked = [...rail.querySelectorAll('.seat:not([disabled])')].find(isInked);
    while ([...rail.querySelectorAll('.seat:not([disabled])')]
      .filter(isInked).length <= 12) {
      const spare = inked.cloneNode(true);
      spare.dataset.seat = `spare-${rail.children.length}`;
      spare.firstChild.width = inked.firstChild.width;
      spare.firstChild.height = inked.firstChild.height;
      spare.firstChild.getContext('2d').drawImage(inked.firstChild, 0, 0);
      rail.append(spare);
    }
    return [...rail.querySelectorAll('.seat:not([disabled])')].filter(isInked).length;
  });
  expect(seated, 'the rail never reached thirteen inked seats').toBeGreaterThan(12);

  await page.locator('#printscreen').click();

  const marks = await page.evaluate(() => {
    const doc = new DOMParser().parseFromString(window.__printedHtml, 'text/html');
    return [...doc.querySelectorAll('.pres-page')].map(sheet => ({
      tiles: sheet.querySelectorAll('.pres-tile').length,
      scale: sheet.querySelector('.pres-scale')?.textContent,
      logo: !!sheet.querySelector('.pres-mark img'),
    }));
  });

  expect(marks.length, 'the thirteenth tile did not open a sheet').toBe(4);
  expect(marks[2].tiles,
    'more than twelve tiles were crowded onto one sheet').toBe(12);
  expect(marks[3].tiles).toBe(seated - 12);
  marks.forEach((sheet, i) => {
    expect(sheet.scale,
      `sheet ${i + 1} printed without NOT TO SCALE`).toBe('NOT TO SCALE');
    expect(sheet.logo, `sheet ${i + 1} printed without the logo`).toBe(true);
  });
});

// THE DISCLAIMER IS CHECKED FOR ITS POSITION, not just its presence. Movie
// asked for it ABOVE the logo: below it, the eye reaches the brand first and
// the page reads as something the office is standing behind.
test('every page says NOT TO SCALE immediately above the logo', async ({ page }) => {
  await openHouse(page);
  await settleRail(page);
  await page.locator('#printscreen').click();

  const marks = await page.evaluate(() => {
    const doc = new DOMParser().parseFromString(window.__printedHtml, 'text/html');
    return [...doc.querySelectorAll('.pres-page')].map(sheet => {
      const mark = sheet.querySelector('.pres-mark');
      // The logo is read by the mark it claims rather than by its src:
      // Movie's logo-ruff.png and logo-rough.png are not drawn yet, so the
      // element falls back to the old logo file the moment the load fails,
      // and the file it ends up showing is not what is being ruled on here.
      return mark ? [...mark.children].map(el => el.tagName === 'IMG'
        ? `LOGO:${el.dataset.presLogo}` : el.textContent) : null;
    });
  });

  expect(marks.length).toBe(3);
  marks.forEach(mark => {
    expect(mark && mark[0]).toBe('NOT TO SCALE');
    expect(mark && mark[1]).toBe('LOGO:ruff');
  });
});

// The logo swaps with the RUFF/ROUGH switch the way the skin does, so a RUFF
// drawing presents under the RUFF mark without anyone choosing a file.
test('the logo follows the ROUGH switch', async ({ page }) => {
  await openHouse(page);
  await page.locator('#mode-corner [data-theme="rough"]').click();
  await page.locator('#printscreen').click();

  const html = await printedDoc(page);
  expect(html).toContain('data-pres-logo="rough"');
  expect(html).not.toContain('data-pres-logo="ruff"');
});

// THE CAMERA COMES BACK. Page 2 is made by moving the drafter's own view to
// fit and painting through the page's own painters -- the alternative, a
// second renderer, is what makes a client's picture and a drafter's screen
// disagree with nobody able to say which is right. The one hazard of doing it
// that way is this one, and nothing else in the suite would notice it.
test('the drafter\'s own view is where it was afterwards', async ({ page }) => {
  await openHouse(page);
  // DAY, so that page 1 and the screen buffer are comparable byte for byte:
  // at night the presentation is painted in daylight on purpose, and this
  // check is about the FRAMING rather than the colours.
  await page.locator('#mode-corner [data-skin-mode="day"]').click();
  await settleRail(page);
  // Somewhere that is deliberately NOT the fit, so a restore that quietly
  // refits shows up.
  const box = await page.locator('#plan').boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.wheel(0, -240);
  await page.waitForTimeout(250);

  const before = await planBuffer(page);
  await page.locator('#printscreen').click();
  await page.waitForTimeout(250);
  expect(await planBuffer(page),
    'PRINTSCREEN left the drafter looking at a view they did not ask for')
    .toBe(before);

  const shots = await page.evaluate(() => {
    const doc = new DOMParser().parseFromString(window.__printedHtml, 'text/html');
    return [...doc.querySelectorAll('.pres-art img')].map(img => img.getAttribute('src'));
  });
  expect(shots.length).toBe(2);
  // Page 1 is the view as it stands; page 2 is fitted. Equal images here
  // would mean one of the two pages is a copy of the other.
  expect(shots[0]).toBe(before);
  expect(shots[1]).not.toBe(shots[0]);
});

// DAYLIGHT (Movie, 15 Sep). The paper was always white; the PICTURES carried
// whatever skin the drafter was in, so a drafter working at night handed a
// client three black rectangles. The sheet is a presentation, and a night
// screen photographed onto paper is not one.
test('the pictures are daylight even when the drafter is working at night', async ({ page }) => {
  await openHouse(page);
  await settleRail(page);
  await expect(page.locator('#mode-corner [data-skin-mode="night"]'))
    .toHaveAttribute('aria-pressed', 'true');

  const nightScreen = await planBuffer(page);
  await page.locator('#printscreen').click();

  // Read the printed PNGs back through a canvas, COMPOSITED OVER WHITE,
  // because white is what they land on: the plan seats paint on transparency
  // and carry only their ink, so judging their pixels raw calls a perfectly
  // good tile black. What is being caught is the night skin's dark GROUND
  // being painted into the picture, and paper is where that shows.
  const light = await page.evaluate(async () => {
    const doc = new DOMParser().parseFromString(window.__printedHtml, 'text/html');
    const srcs = [...doc.querySelectorAll('.pres-art img, .pres-tile img')]
      .map(img => img.getAttribute('src'));
    const pad = document.createElement('canvas');
    const pen = pad.getContext('2d');
    return Promise.all(srcs.map(src => new Promise(done => {
      const img = new Image();
      img.onload = () => {
        pad.width = img.width; pad.height = img.height;
        pen.fillStyle = '#fff';
        pen.fillRect(0, 0, img.width, img.height);
        pen.drawImage(img, 0, 0);
        const { data } = pen.getImageData(0, 0, img.width, img.height);
        let sum = 0;
        for (let i = 0; i < data.length; i += 4) sum += data[i] + data[i + 1] + data[i + 2];
        done(sum / (data.length / 4) / 3);
      };
      img.src = src;
    })));
  });

  expect(light.length, 'no pictures to judge').toBeGreaterThan(2);
  light.forEach((mean, i) =>
    expect(mean, `picture ${i + 1} printed on a night ground`).toBeGreaterThan(160));

  // AND THE DRAFTER IS STILL AT NIGHT. Taking the picture is not the drafter
  // changing their mind about the skin, so the switch, the stored choice and
  // the screen all have to be where they were left.
  await expect(page.locator('#mode-corner [data-skin-mode="night"]'))
    .toHaveAttribute('aria-pressed', 'true');
  expect(await page.evaluate(() =>
    JSON.parse(localStorage.getItem('draft-skin') || '{}').mode)).not.toBe('day');
  expect(await planBuffer(page),
    'the drafter was left looking at a daylit screen').toBe(nightScreen);
});

// THE SHEET IS TORN UP. It holds full-size PNGs of the drawing, so left
// behind it grows a copy per press -- and a later press could print pictures
// taken before the last hour of drawing.
test('the presentation does not stay in the page', async ({ page }) => {
  await openHouse(page);
  await expect(page.locator('#presentation')).toHaveCount(0);

  await page.locator('#printscreen').click();
  await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
  await expect(page.locator('#presentation')).toHaveCount(0);

  // Twice, because a first press can leave a listener behind as easily as a
  // sheet, and the second set of pictures must be the second set.
  await page.locator('#printscreen').click();
  await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
  await expect(page.locator('#presentation')).toHaveCount(0);
  expect(await page.evaluate(() => window.__printCalls)).toBe(2);
});

// A VIEW THAT DOES NOT EXIST DOES NOT GET A TILE. With no walls drawn the
// rail still offers its level seats but greys out the elevations and the
// sections, and a client's sheet must not carry six captioned blanks
// labelled E1 to S2. The measured shape with an empty file is the level
// seats only -- written down here because it is the case a placeholder grid
// would quietly pass.
test('greyed-out seats stay off the views page', async ({ page }) => {
  await openHouse(page, { empty: true });
  await settleRail(page);
  await page.locator('#printscreen').click();

  const html = await printedDoc(page);
  const printed = [...html.matchAll(/data-pres-tile="([^"]+)"/g)].map(m => m[1]);
  expect(printed.length).toBeGreaterThan(0);
  ['E1', 'E2', 'E3', 'E4', 'S1', 'S2'].forEach(seat =>
    expect(printed, `${seat} has nothing to show and must not print`)
      .not.toContain(seat));
  const offered = await page.evaluate(() =>
    [...document.querySelectorAll('#view-rail .seat:not([disabled])')]
      .map(seat => seat.dataset.seat));
  printed.forEach(seat => expect(offered).toContain(seat));
});
