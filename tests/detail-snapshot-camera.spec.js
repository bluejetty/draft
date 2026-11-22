// DETAIL SNAPSHOT: the camera.
//
// jb, 20 Nov 2026: "i'd like to be able to make a 'square' area and take a
// 'snapshot' of the elevation or section and have it pop up in the DETAIL
// area as a new detail" -- "(that can be further edited - not a window that
// shows what exists there, but takes a snapshot and copies the lines over so
// they can be edited and new details added too" -- "lets call it DETAIL
// SNAPSHOT and make it camera" -- "a square with a circle in the middle".
//
// THIS FILE IS THE CAMERA HALF: the key, the box, and what is filed. The
// other half -- a detail in the library starting from a picture -- is not
// built yet and nothing here pretends it is.
//
// WHAT IS FILED IS READ BACK THE WAY THE LIBRARY WILL READ IT. The page
// publishes a count on the canvas and says a sentence on the strip, and a
// check that read only those would be the camera grading its own work: a
// picture of the wrong place, at the wrong size, upside down, files the same
// count and says the same sentence. So every claim below opens the tray in
// the browser's store, parses the DXF with the reader TRACE uses, and
// measures the lines.
//
// AND THE WITNESS IS THE SCREEN. "What the drafter was looking at" is a
// claim about pixels, so the canvas is read before the box is drawn and the
// picture is laid back over it, both ways:
//
//   1. WHEREVER THE PICTURE HAS A LINE, THE SCREEN SHOWS INK. A picture at
//      the wrong size, upside down or off centre puts its lines on blank
//      paper. So does a picture with the far side of the house in it: the
//      painter hides the back wall's windows under the front wall's white
//      fill, a DXF leaves fills out, and the first picture this camera took
//      of E1 had three windows where the screen had one.
//   2. WHEREVER THE SCREEN SHOWS A LINE OF THE HOUSE, THE PICTURE HAS ONE.
//      Where to look comes from the snap's recorder (elev-snap.js), stood up
//      over a spare canvas and stripped to strokes; whether a line is really
//      THERE comes from the pixels -- darker than the paper either side of
//      it -- because that recorder keeps hidden strokes too.
//
// One comparison, and it is the scale, the flip, the centring, the clip and
// the hidden lines.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const h = require('./helpers');

// A two storey with a drawn section in it, so one house answers for an
// elevation and a section both.
const HOUSE = JSON.parse(fs.readFileSync(
  path.join(__dirname, '..', 'proto', 'repro-jb-fdn-tee.draft'), 'utf8'));
const urlFor = view => '/MODEL.html?theme=rough&mode=day&level=3&lpane=drafting&left=1'
  + (view ? `&view=cut%3A${view}` : '');

async function openView(page, view) {
  await page.setViewportSize({ width: 1366, height: 768 });
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, saved }) => {
    const f = new File([JSON.stringify(saved)], 'model-drawing.json', { type: 'application/json' });
    await window.SharedFileStore.saveSharedFile(f, bucket);
  }, { bucket: h.STORAGE_BUCKET, saved: HOUSE });
  await page.goto(urlFor(view));
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  if (view) {
    await page.waitForFunction(() => !!window.__elevFrame);
    await page.waitForTimeout(300);
  }
}

// The frame the painter drew in, and where the canvas is on the page.
const frame = page => page.evaluate(() => {
  const f = window.__elevFrame;
  const r = document.getElementById('plan').getBoundingClientRect();
  return { x0: f.x0, y0: f.y0, pxPerFt: f.pxPerFt, uMin: f.uMin, yTop: f.yTop,
    left: r.left, top: r.top, w: r.width, h: r.height };
});
const toClient = (f, p) => ({ x: f.left + f.x0 + (p.u - f.uMin) * f.pxPerFt,
  y: f.top + f.y0 + (f.yTop - p.e) * f.pxPerFt });
// What a press at a client pixel reads as, in the view's feet: the page's
// own arithmetic, done here so the box is known to the test exactly.
const toFeet = (f, c) => ({ u: f.uMin + (c.x - f.left - f.x0) / f.pxPerFt,
  e: f.yTop - (c.y - f.top - f.y0) / f.pxPerFt });

// WHERE THE HOUSE'S LINES ARE, in feet: every line the painter STROKED.
//
// The snap's recorder (elev-snap.js) wraps a real canvas and keeps what is
// drawn through it; here it is stood up over a spare canvas and the view is
// painted through it once more. A different recorder from the camera's, with
// its own arithmetic for transforms and for feet.
//
// STROKES ONLY, AND NOT WHITE ONES. The snap keeps the edge of every FILL
// as well, because a corner is a corner to a hand looking for one; but a
// white fascia filled over white paper has no edge anyone can see. And a
// white stroke is a mask the painter lays to hide what is under it.
//
// IT KEEPS HIDDEN STROKES TOO -- it is a list of where lines MAY be, and the
// pixels say which of them show (`laidOver`, below).
//
// PAINTED AT THE FIT, IN ITS OWN FRAME, whatever the screen is zoomed to.
// Feet are feet at any zoom, so it does not need the screen's frame. (When
// this was written it could not have used it: the snap's recorder lost the
// house on a zoomed pass, keeping 5 pieces of 244 on this elevation. That
// was found here and is fixed -- tests/elevation-snap-zoomed.spec.js -- and
// the list is still painted at the fit, where it has one scale to answer
// for.)
const strokesFeet = page => page.evaluate(() => {
  const spare = document.createElement('canvas');
  spare.width = Math.round(cssW);
  spare.height = Math.round(cssH);
  const rec = window.DraftElevSnap.recorder(spare.getContext('2d'), cssW, cssH);
  const white = style => {
    const m = String(style).match(/^#([0-9a-f]{6})/i);
    if (m) {
      const n = parseInt(m[1], 16);
      return (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255 > 0.88;
    }
    const a = String(style).match(/^rgba\(([^)]+)\)/);
    return a ? Number(a[1].split(',')[3]) < 0.08 : false;
  };
  const strokesOnly = new Proxy(rec.ctx, {
    get(t, k) {
      if (k === 'fill' || k === 'fillRect') return () => {};
      if (k === 'stroke') return (...args) => { if (!white(t.strokeStyle)) t.stroke(...args); };
      if (k === 'strokeRect') return (...args) => { if (!white(t.strokeStyle)) t.strokeRect(...args); };
      const v = t[k];
      return typeof v === 'function' ? v.bind(t) : v;
    },
    set(t, k, v) { t[k] = v; return true; },
  });
  let own = null;
  window.DraftCutView.drawCutView(cutEnv(), strokesOnly, cssW, cssH, activeCut(),
    { margins: furnitureMargins(), cushion: 0.1, onFrame: fr => { own = { ...fr }; } });
  // `px`: the scale it was painted at, which is how finely it knows where a
  // line is -- the painter puts its lines on half-pixel centres.
  return { px: own.pxPerFt, segs: window.DraftElevSnap.segmentsInFeet(own, rec.segments())
    .map(s => ({ a: { u: s.a.u, e: s.a.e }, b: { u: s.b.u, e: s.b.e } })) };
});
// EVERYTHING THE VIEW DREW, fills and all, for finding where the paper is
// BLANK -- the one question the fuller record is the right witness to.
const allInk = page => page.evaluate(() =>
  elevInkFeet().map(s => ({ a: { u: s.a.u, e: s.a.e }, b: { u: s.b.u, e: s.b.e } })));

// THE PART OF THE CANVAS A HAND CAN REACH: clear of the rails either side,
// the strip across the top and the house strip below. The canvas runs under
// all of them, and a press on a rail is the rail's.
const openArea = page => page.evaluate(() => {
  const mg = furnitureMargins() || { left: 0, right: 0, bottom: 0 };
  const cr = document.getElementById('plan').getBoundingClientRect();
  const strip = document.getElementById('strip');
  const sr = strip && !strip.hidden ? strip.getBoundingClientRect() : null;
  return { x0: cr.left + (mg.left || 0) + 12, x1: cr.right - (mg.right || 0) - 12,
    y0: Math.max(cr.top, sr ? sr.bottom : cr.top) + 12, y1: cr.bottom - (mg.bottom || 0) - 12 };
});
const reachable = (open, c) => c.x > open.x0 && c.x < open.x1 && c.y > open.y0 && c.y < open.y1;

// THE TRAY, opened the way the library will open it: out of the browser's
// store, each picture's DXF parsed by the reader TRACE uses.
const tray = page => page.evaluate(async () => {
  const list = await window.DraftDetailSnapshot.list();
  return list.map(rec => {
    const dxf = window.DraftDxfReader.parse(rec.dxf, { segments: true });
    return { ...rec, dxf: undefined, chars: rec.dxf.length, units: dxf.units,
      segs: dxf.segments.map(s => ({ a: s.a, b: s.b })),
      texts: (dxf.texts || []).length,
      words: (dxf.texts || []).map(t => ({ text: t.lines.join(' '), h: t.h })) };
  });
});
const filed = (page, n) => expect.poll(async () => (await tray(page)).length,
  { message: `${n} in the tray` }).toBe(n);

// THE SCREEN AS IT STANDS, kept in the page for `readScreen`. Taken before
// the first press: after it the box in hand is on the canvas too.
const shoot = page => page.evaluate(() => {
  const c = document.getElementById('plan');
  const r = c.getBoundingClientRect();
  const img = c.getContext('2d').getImageData(0, 0, c.width, c.height);
  // The paper is whatever most of the canvas is.
  const seen = new Map();
  for (let i = 0; i < img.data.length; i += 4 * 97) {
    const l = Math.round(0.299 * img.data[i] + 0.587 * img.data[i + 1] + 0.114 * img.data[i + 2]);
    seen.set(l, (seen.get(l) || 0) + 1);
  }
  const paper = [...seen.entries()].sort((p, q) => q[1] - p[1])[0][0];
  window.__snapShot = { img, sx: c.width / r.width, sy: c.height / r.height, paper };
  return paper;
});

// A PLACE WORTH PHOTOGRAPHING: the box with the most whole lines of the
// house in it, of those a hand can reach, so the checks below have lines to
// stand on whichever view is open. Returned as two whole client pixels and
// the box they make in feet -- with the screen shot first.
//
// SCORED BY WHOLE LINES, not by ends: a run of siding ticks is a hundred
// ends and not one line long enough to measure a picture by.
async function busyBox(page, wFt = 8, hFt = 6) {
  await shoot(page);
  const f = await frame(page);
  const ink = await strokesFeet(page);
  const open = await openArea(page);
  const long = ink.segs.filter(s => Math.hypot(s.b.u - s.a.u, s.b.e - s.a.e) > 0.5);
  let best = null;
  long.forEach(s => {
    const c = { u: (s.a.u + s.b.u) / 2, e: (s.a.e + s.b.e) / 2 };
    const corners = [toClient(f, { u: c.u - wFt / 2, e: c.e + hFt / 2 }),
      toClient(f, { u: c.u + wFt / 2, e: c.e - hFt / 2 })];
    if (!corners.every(p => reachable(open, p))) return;
    const box = { uMin: c.u - wFt / 2, uMax: c.u + wFt / 2, eMin: c.e - hFt / 2, eMax: c.e + hFt / 2 };
    const n = long.filter(t => [t.a, t.b].every(p =>
      p.u > box.uMin + 0.4 && p.u < box.uMax - 0.4 && p.e > box.eMin + 0.4 && p.e < box.eMax - 0.4)).length;
    if (!best || n > best.n) best = { n, c };
  });
  expect(best, 'somewhere on the view a hand can reach').toBeTruthy();
  const p1 = toClient(f, { u: best.c.u - wFt / 2, e: best.c.e + hFt / 2 });
  const p2 = toClient(f, { u: best.c.u + wFt / 2, e: best.c.e - hFt / 2 });
  const a = { x: Math.round(p1.x), y: Math.round(p1.y) };
  const b = { x: Math.round(p2.x), y: Math.round(p2.y) };
  const fa = toFeet(f, a), fb = toFeet(f, b);
  return { a, b, f, ink,
    box: { uMin: fa.u, uMax: fb.u, eMin: fb.e, eMax: fa.e,
      cu: (fa.u + fb.u) / 2, ce: (fa.e + fb.e) / 2 } };
}
// A BOX OF BLANK PAPER a hand can reach: 160 px by 44 with nothing the view
// drew inside it or within a few pixels of it.
async function blankBox(page) {
  const f = await frame(page);
  const open = await openArea(page);
  const ink = (await allInk(page)).map(s => [toClient(f, s.a), toClient(f, s.b)]);
  const W = 160, H = 44, PAD = 8;
  // each piece's own box against this one, grown by the pad
  const hits = (x, y) => ink.some(([p, q]) =>
    Math.max(p.x, q.x) > x - PAD && Math.min(p.x, q.x) < x + W + PAD
    && Math.max(p.y, q.y) > y - PAD && Math.min(p.y, q.y) < y + H + PAD);
  for (let y = Math.ceil(open.y0); y + H < open.y1; y += 6) {
    for (let x = Math.ceil(open.x0); x + W < open.x1; x += 6) {
      if (!hits(x, y)) return { a: { x, y }, b: { x: x + W, y: y + H } };
    }
  }
  throw new Error('no blank paper on this view');
}
const drag = async (page, a, b) => {
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move((a.x + b.x) / 2, (a.y + b.y) / 2, { steps: 4 });
  await page.mouse.move(b.x, b.y, { steps: 4 });
  await page.mouse.up();
};

// Where a point of the view lands in the picture: inches from the box's
// centre, y up -- and the way back.
const inPicture = (box, p) => [(p.u - box.cu) * 12, (p.e - box.ce) * 12];
const onView = (box, q) => ({ u: box.cu + q[0] / 12, e: box.ce + q[1] / 12 });
const toSeg = (p, s) => {
  const dx = s.b[0] - s.a[0], dy = s.b[1] - s.a[1];
  const len2 = dx * dx + dy * dy;
  const t = len2 ? Math.max(0, Math.min(1, ((p[0] - s.a[0]) * dx + (p[1] - s.a[1]) * dy) / len2)) : 0;
  return Math.hypot(p[0] - (s.a[0] + t * dx), p[1] - (s.a[1] + t * dy));
};
// Points every two pixels along a line on the screen, clear of its ends
// (where another line usually meets it), each with the line's normal.
const walk = (a, b) => {
  const len = Math.hypot(b.x - a.x, b.y - a.y);
  const out = [];
  if (len < 10) return out;
  const nx = -(b.y - a.y) / len, ny = (b.x - a.x) / len;
  for (let d = 3; d <= len - 3; d += 2) {
    out.push([a.x + (b.x - a.x) * d / len, a.y + (b.y - a.y) * d / len, nx, ny]);
  }
  return out;
};
// WHAT THE SCREEN HAS AT EACH POINT, off the shot: `ink`, something darker
// than the paper within a pixel; and `line`, darker than the screen three
// pixels to EITHER side -- a line standing on its own, which a stroke hidden
// under a wall or lost in a grey poche is not.
const readScreen = (page, pts) => page.evaluate(points => {
  const { img, sx, sy, paper } = window.__snapShot;
  const r = document.getElementById('plan').getBoundingClientRect();
  const lum = (x, y) => {
    const xi = Math.max(0, Math.min(img.width - 1, Math.round((x - r.left) * sx)));
    const yi = Math.max(0, Math.min(img.height - 1, Math.round((y - r.top) * sy)));
    const i = (yi * img.width + xi) * 4;
    return 0.299 * img.data[i] + 0.587 * img.data[i + 1] + 0.114 * img.data[i + 2];
  };
  return points.map(([x, y, nx, ny]) => {
    let c = 255;
    for (let dy = -1; dy <= 1; dy += 1) for (let dx = -1; dx <= 1; dx += 1) c = Math.min(c, lum(x + dx, y + dy));
    const a = lum(x + 3 * nx, y + 3 * ny), b = lum(x - 3 * nx, y - 3 * ny);
    // 18, NOT 25 (22 Nov 2026): the section's level marks are a quarter-ink
    // 0.75px line, 23 under the paper on the screen. A box on S1 that took in
    // the footing-bottom mark read it as a picture line on blank paper.
    return [c <= paper - 18 ? 1 : 0, c < a - 12 && c < b - 12 ? 1 : 0];
  });
}, pts);
const within = (box, p, pad) => p.u > box.uMin + pad && p.u < box.uMax - pad
  && p.e > box.eMin + pad && p.e < box.eMax - pad;

// THE PICTURE LAID BACK OVER THE SCREEN, both ways. `f` is the frame the
// screen was shot in; `tol` is how far, in inches, a line of the picture may
// stand from where the list of the house's lines has it -- a pixel at the
// scale that list was painted at, which is under an inch here. Zoomed in,
// the picture knows where a wall is more finely than the list does.
async function laidOver(page, pic, box, f, ink) {
  const tol = 12 / ink.px;
  const pad = 3 / f.pxPerFt;   // three pixels clear of the box's own edge
  // 1. THE PICTURE'S LINES, on the screen.
  const picPts = pic.segs.flatMap(s =>
    walk(toClient(f, onView(box, s.a)), toClient(f, onView(box, s.b))))
    .filter(q => within(box, toFeet(f, { x: q[0], y: q[1] }), pad));
  const onScreen = await readScreen(page, picPts);
  // 2. THE HOUSE'S LINES, where the screen shows them, in the picture.
  const housePts = ink.segs.flatMap(s => walk(toClient(f, s.a), toClient(f, s.b)))
    .filter(q => within(box, toFeet(f, { x: q[0], y: q[1] }), pad));
  const seen = await readScreen(page, housePts);
  const showing = housePts.filter((q, i) => seen[i][1]);
  const missing = showing.filter(q => {
    const at = inPicture(box, toFeet(f, { x: q[0], y: q[1] }));
    return !pic.segs.some(s => toSeg(at, s) <= tol);
  });
  return {
    picture: picPts.length,
    onBlankPaper: onScreen.filter(v => !v[0]).length,
    house: housePts.length,
    showing: showing.length,
    hidden: housePts.length - showing.length,
    missing: missing.length,
  };
}
// AND WHAT IS ASKED OF IT. Neither half can pass on nothing: a box with no
// line of the house in it proves nothing about a picture.
//
// NOT ZERO, AND WHY. A dashed line is a whole line in the picture and gaps
// on the screen. And where a HIDDEN line of the house passes under one that
// shows, the pixels there are dark and the list says a line runs through
// them: on E1 the +17'-6" level line, hidden by the front wall, reads as
// "showing" at the two places a fascia crosses it -- 2 points of 161. Three
// in a hundred allows that; a picture at the wrong size, or with the far
// wall in it, or with a visible wall cut out of it, is tens in a hundred.
//
// THE FLOORS ARE LOWER THAN THEY WERE (150, then 80 for the picture). When
// the camera began joining what lies on one line into one line, the same
// box of E1 went from 206 points of picture to 137: the roof's edge, its
// fascia and the wall's stepped top had been three lines laid over one
// another, and each was being walked. Fewer points for the same ink is the
// change working, and a floor that failed on it was counting duplicates.
const expectThePictureIsTheScreen = (got, why) => {
  expect(got.picture, 'the picture has lines to lay over the screen').toBeGreaterThan(80);
  expect(got.showing, 'the screen shows lines of the house inside the box').toBeGreaterThan(150);
  expect(got.onBlankPaper / got.picture,
    `${why}: ${got.onBlankPaper} of ${got.picture} points of the picture are on blank paper`)
    .toBeLessThan(0.03);
  expect(got.missing / got.showing,
    `${why}: ${got.missing} of ${got.showing} points of line on the screen are not in the picture`)
    .toBeLessThan(0.03);
};

test('the camera is a key in the drafting column: a square with a circle in the middle', async ({ page }) => {
  await openView(page, 'E1');
  const key = page.locator('[data-tool-key="snapshot"]');
  await expect(key).toHaveCount(1);
  await expect(key.locator('[data-tool-name]')).toHaveText('DETAIL SNAPSHOT');
  expect(await key.evaluate(el => el.closest('[data-tool-group]').dataset.toolGroup),
    'with the drafting keys').toBe('draw');
  // THE DRAWING ON ITS FACE, measured: one square, one circle, the circle
  // inside the square and centred on it.
  const face = await key.locator('[data-tool-icon] svg').evaluate(svg => {
    const r = svg.querySelectorAll('rect'), c = svg.querySelectorAll('circle');
    if (r.length !== 1 || c.length !== 1 || svg.children.length !== 2) return null;
    const n = (el, a) => Number(el.getAttribute(a));
    return { x: n(r[0], 'x'), y: n(r[0], 'y'), w: n(r[0], 'width'), h: n(r[0], 'height'),
      cx: n(c[0], 'cx'), cy: n(c[0], 'cy'), r: n(c[0], 'r') };
  });
  expect(face, 'a square and a circle, and nothing else').toBeTruthy();
  expect(face.w, 'a square').toBe(face.h);
  expect(face.cx, 'the circle in the middle, across').toBe(face.x + face.w / 2);
  expect(face.cy, 'and down').toBe(face.y + face.h / 2);
  expect(face.r * 2, 'and inside the square').toBeLessThan(face.w);
  // AND IT ARMS, and says what to do.
  await h.armFromRail(page, 'snapshot');
  await expect(page.locator('#strip-message')).toContainText('DETAIL SNAPSHOT');
  await expect(page.locator('#strip-message')).toContainText('corner');
});

test('a box dragged on an elevation files what the screen shows inside it: full size, the right way up, cut at the box', async ({ page }) => {
  await openView(page, 'E1');
  await h.armFromRail(page, 'snapshot');
  const { a, b, box, ink, f } = await busyBox(page);
  await drag(page, a, b);
  await filed(page, 1);
  const [pic] = await tray(page);

  // WHAT IT SAYS IT IS.
  expect(pic.cut).toBe('E1');
  expect(pic.kind).toBe('elevation');
  expect(pic.name).toBe('E1 SNAPSHOT');
  expect(pic.widthFt, 'the box\'s width, in feet').toBeCloseTo(box.uMax - box.uMin, 3);
  expect(pic.heightFt, 'and its height').toBeCloseTo(box.eMax - box.eMin, 3);
  // NO UNITS WRITTEN, which the reader takes as inches: it lands full size
  // without a question.
  expect(pic.units, 'a DXF with no units is read as inches').toBeNull();
  expect(pic.segs.length, 'lines came over').toBeGreaterThan(4);

  // NOTHING OUTSIDE THE BOX. Half the box each way from the centre, in
  // inches, and a hundredth for the arithmetic.
  const halfW = (box.uMax - box.uMin) * 6, halfH = (box.eMax - box.eMin) * 6;
  pic.segs.forEach(s => [s.a, s.b].forEach(p => {
    expect(Math.abs(p[0]), 'no line runs past the box, across').toBeLessThanOrEqual(halfW + 0.01);
    expect(Math.abs(p[1]), 'or up and down').toBeLessThanOrEqual(halfH + 0.01);
  }));
  // AND IT WAS CUT THERE, NOT SHRUNK TO FIT: the house runs on past an 8 ft
  // box, so something drawn must reach the edge it was cut at.
  const reach = Math.max(...pic.segs.flatMap(s => [Math.abs(s.a[0]), Math.abs(s.b[0])]));
  expect(reach, 'a line reaches the side of the box').toBeGreaterThan(halfW - 0.05);

  // THE PICTURE, LAID BACK OVER THE SCREEN.
  const got = await laidOver(page, pic, box, f, ink);
  expectThePictureIsTheScreen(got, 'a box dragged on E1');
  // AND THIS BOX HAS SOMETHING BEHIND THE WALL, or the first half above
  // would pass on a camera that sees through it: strokes of the house the
  // screen does not show as lines. They are the far side, under the fill.
  expect(got.hidden, 'the far side of the house is behind this box').toBeGreaterThan(40);
});

test('two presses make the box as well as a drag does', async ({ page }) => {
  await openView(page, 'E1');
  await h.armFromRail(page, 'snapshot');
  const { a, b, box, ink, f } = await busyBox(page);
  await page.mouse.click(a.x, a.y);
  // ONE PRESS IS HALF A BOX: nothing is filed until the other corner.
  await page.waitForTimeout(250);
  expect((await tray(page)).length, 'one corner files nothing').toBe(0);
  await page.mouse.move((a.x + b.x) / 2, (a.y + b.y) / 2, { steps: 3 });
  await page.mouse.click(b.x, b.y);
  await filed(page, 1);
  const [pic] = await tray(page);
  expect(pic.widthFt).toBeCloseTo(box.uMax - box.uMin, 3);
  expect(pic.heightFt).toBeCloseTo(box.eMax - box.eMin, 3);
  expectThePictureIsTheScreen(await laidOver(page, pic, box, f, ink), 'two presses');
});

test('and from the far corner back: a box dragged up and to the left is the same box', async ({ page }) => {
  await openView(page, 'E1');
  await h.armFromRail(page, 'snapshot');
  const { a, b, box, ink, f } = await busyBox(page);
  await drag(page, b, a);
  await filed(page, 1);
  const [pic] = await tray(page);
  expect(pic.widthFt).toBeCloseTo(box.uMax - box.uMin, 3);
  expect(pic.heightFt).toBeCloseTo(box.eMax - box.eMin, 3);
  // NOT MIRRORED, NOT UPSIDE DOWN: it still lies on the screen it was taken of.
  expectThePictureIsTheScreen(await laidOver(page, pic, box, f, ink), 'dragged from the far corner');
});

test('a section is photographed the same way, and filed as a section', async ({ page }) => {
  await openView(page, 'S1');
  await h.armFromRail(page, 'snapshot');
  const { a, b, box, ink, f } = await busyBox(page);
  await drag(page, a, b);
  await filed(page, 1);
  const [pic] = await tray(page);
  expect(pic.cut).toBe('S1');
  expect(pic.kind).toBe('section');
  expect(pic.segs.length).toBeGreaterThan(4);
  expectThePictureIsTheScreen(await laidOver(page, pic, box, f, ink), 'a box on S1');
});

test('zoomed in on the elevation, the picture is still full size', async ({ page }) => {
  await openView(page, 'E1');
  const first = await busyBox(page);
  // INTO THE BUSY PART, the way he looks at a detail before drawing it.
  await page.mouse.move((first.a.x + first.b.x) / 2, (first.a.y + first.b.y) / 2);
  await page.mouse.wheel(0, -500);
  await page.waitForTimeout(300);
  const zoomed = await frame(page);
  expect(zoomed.pxPerFt, 'zoomed in').toBeGreaterThan(first.f.pxPerFt * 1.4);
  await h.armFromRail(page, 'snapshot');
  const { a, b, box, ink, f } = await busyBox(page, 4, 3);
  await drag(page, a, b);
  await filed(page, 1);
  const [pic] = await tray(page);
  // FEET ARE FEET AT ANY ZOOM: the box is 4 ft across on the house, and so
  // 48 inches across in the picture, however many pixels that was.
  expect(pic.widthFt).toBeCloseTo(box.uMax - box.uMin, 3);
  expect(pic.widthFt, 'four feet of the house').toBeCloseTo(4, 0);
  const reach = Math.max(...pic.segs.flatMap(s => [Math.abs(s.a[0]), Math.abs(s.b[0])]));
  expect(reach, 'and so about 24 inches each way from the middle, not the screen\'s pixels')
    .toBeLessThanOrEqual(pic.widthFt * 6 + 0.01);
  expectThePictureIsTheScreen(await laidOver(page, pic, box, f, ink), 'zoomed in');
});

test('the box shows while it is in hand, and ESC puts it down', async ({ page }) => {
  await openView(page, 'E1');
  await h.armFromRail(page, 'snapshot');
  // ON BLANK PAPER, where any ink is the box's own.
  const { a, b } = await blankBox(page);
  // The box's top edge, a strip three pixels deep along it.
  const edgeInk = () => page.evaluate(({ x, y, w }) => {
    const c = document.getElementById('plan');
    const r = c.getBoundingClientRect();
    const sx = c.width / r.width, sy = c.height / r.height;
    const d = c.getContext('2d').getImageData(Math.round((x - r.left) * sx), Math.round((y - r.top - 1) * sy),
      Math.round(w * sx), Math.max(3, Math.round(3 * sy))).data;
    let dark = 0;
    for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 40 && (d[i] + d[i + 1] + d[i + 2]) / 3 < 150) dark += 1;
    return dark;
  }, { x: a.x + 20, y: a.y, w: 120 });
  expect(await edgeInk(), 'blank paper before the press').toBe(0);
  await page.mouse.click(a.x, a.y);
  await page.mouse.move(b.x, b.y, { steps: 4 });
  await page.waitForTimeout(120);
  expect(await edgeInk(), 'the box is drawn from the corner to the hand').toBeGreaterThan(20);
  // ESC: the box goes, nothing is filed, and the next press is a FIRST
  // corner again rather than the end of the box that was dropped.
  await page.keyboard.press('Escape');
  await page.waitForTimeout(120);
  expect(await edgeInk(), 'the box is gone').toBe(0);
  await page.mouse.click(b.x, b.y);
  await page.waitForTimeout(250);
  expect((await tray(page)).length, 'a dropped box files nothing').toBe(0);
});

test('a slip is not a picture: two presses on one spot, or a box over blank paper, file nothing', async ({ page }) => {
  await openView(page, 'E1');
  await h.armFromRail(page, 'snapshot');
  const { a } = await busyBox(page);
  await page.mouse.click(a.x + 40, a.y + 40);
  await page.mouse.click(a.x + 42, a.y + 41);
  await expect(page.locator('#strip-message')).toContainText('under 6 inches');
  expect((await tray(page)).length, 'a box of nothing is not filed').toBe(0);
  // AND BLANK PAPER: a real box, with no line of the house in it.
  const blank = await blankBox(page);
  await drag(page, blank.a, blank.b);
  await expect(page.locator('#strip-message')).toContainText('nothing is drawn inside that box');
  await page.waitForTimeout(250);
  expect((await tray(page)).length, 'an empty picture is not filed').toBe(0);
});

test('a snapshot changes nothing on the house it was taken of', async ({ page }) => {
  await openView(page, 'E1');
  await h.armFromRail(page, 'snapshot');
  const before = await page.evaluate(() => ({
    marks: (drawing.elevationMarks || []).length, undo: undoStack.length, text: JSON.stringify(drawing) }));
  const { a, b } = await busyBox(page);
  await drag(page, a, b);
  await filed(page, 1);
  const after = await page.evaluate(() => ({
    marks: (drawing.elevationMarks || []).length, undo: undoStack.length, text: JSON.stringify(drawing) }));
  expect(after.marks, 'no mark was added to the elevation').toBe(before.marks);
  expect(after.undo, 'nothing to undo').toBe(before.undo);
  expect(after.text === before.text, 'the drawing is letter for letter what it was').toBe(true);
  // THE CAMERA STAYS UP for the next one, and a second picture is a second
  // picture rather than the first one over again.
  await expect(page.locator('[data-tool-key="snapshot"]')).toHaveAttribute('aria-pressed', 'true');
  await drag(page, { x: a.x + 30, y: a.y + 20 }, { x: b.x + 30, y: b.y + 20 });
  await filed(page, 2);
  const two = await tray(page);
  expect(new Set(two.map(p => p.id)).size, 'two pictures, two names').toBe(2);
});

test('on a plan the camera says where it works, and takes nothing', async ({ page }) => {
  await openView(page, null);
  await h.armFromRail(page, 'snapshot');
  await expect(page.locator('#strip-message')).toContainText('works on an elevation or a section');
  const r = await page.locator('#plan').boundingBox();
  const before = await page.evaluate(() => JSON.stringify(drawing));
  await drag(page, { x: r.x + r.width / 2 - 80, y: r.y + r.height / 2 - 60 },
    { x: r.x + r.width / 2 + 80, y: r.y + r.height / 2 + 60 });
  await page.waitForTimeout(250);
  expect((await tray(page)).length, 'no picture of a plan').toBe(0);
  expect(await page.evaluate(() => JSON.stringify(drawing)) === before,
    'and the press drew nothing on it').toBe(true);
});

test('the tray is in the browser\'s store, so another page of this site can open it', async ({ page }) => {
  await openView(page, 'E1');
  await h.armFromRail(page, 'snapshot');
  const { a, b } = await busyBox(page);
  await drag(page, a, b);
  await filed(page, 1);
  const [here] = await tray(page);
  // A FRESH LOAD, on a plan, with nothing in memory: what is read now came
  // out of the store, which is the only thing the house's file and the
  // details library's have in common.
  await page.goto(urlFor(null));
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  const again = await tray(page);
  expect(again.length).toBe(1);
  expect(again[0].id).toBe(here.id);
  expect(again[0].segs).toEqual(here.segs);
});

test('the tray holds two dozen pictures and lets the oldest go', async ({ page }) => {
  await openView(page, 'E1');
  // TWO DOZEN ALREADY IN IT, a minute apart, filed the way the camera files.
  const max = await page.evaluate(async () => {
    const DS = window.DraftDetailSnapshot;
    for (let i = 0; i < DS.TRAY_MAX; i += 1) {
      await DS.save({ version: 1, id: `old-${String(i).padStart(2, '0')}`, name: 'E1 SNAPSHOT', cut: 'E1',
        kind: 'elevation', takenAt: `2026-11-19T10:${String(i).padStart(2, '0')}:00.000Z`,
        widthFt: 8, heightFt: 6, units: 'in', lines: 1,
        dxf: window.DraftDxfWriter.write({ entities: [{ type: 'poly', layer: 'SNAPSHOT', pts: [0, 0, 12, 0] }] }) });
    }
    return DS.TRAY_MAX;
  });
  expect(max).toBe(24);
  expect((await tray(page)).length, 'a full tray').toBe(24);
  await h.armFromRail(page, 'snapshot');
  const { a, b } = await busyBox(page);
  await drag(page, a, b);
  await expect(page.locator('#strip-message')).toContainText('In the snapshot tray (24)');
  const now = await tray(page);
  expect(now.length, 'still two dozen').toBe(24);
  expect(now.some(p => p.id === 'old-00'), 'the oldest made room').toBe(false);
  expect(now[0].id, 'and the next oldest is now first').toBe('old-01');
  expect(now[now.length - 1].cut, 'for the one just taken, which is last').toBe('E1');
  expect(now[now.length - 1].id.startsWith('snap-'), 'the camera\'s own').toBe(true);
});

// jb, 20 Nov 2026, of the first picture: "the roof lines look kindof scratchy
// what is that ? how come not crisp clean line?" The painter puts every point
// on a screen pixel -- most of an inch at the zoom a whole elevation is read
// at -- and lays a roof's edge, its fascia and the wall's stepped top over
// one another. The camera now paints the view again at a sixteenth of an
// inch to the pixel and joins what lies on one line into one line.
// proto/detail-snapshot-harness.js pins the arithmetic; this is the house.
test('the lines come clean: a roof slope is a few long lines, not a run of short steps', async ({ page }) => {
  await openView(page, 'E1');
  await h.armFromRail(page, 'snapshot');
  // A BOX BIG ENOUGH FOR THE GABLE: fourteen feet by twelve, where the most
  // of the house is.
  const { a, b } = await busyBox(page, 14, 12);
  await drag(page, a, b);
  await filed(page, 1);
  const [pic] = await tray(page);
  const len = s => Math.hypot(s.b[0] - s.a[0], s.b[1] - s.a[1]);
  const sloped = pic.segs.filter(s => Math.abs(s.b[0] - s.a[0]) > 1 && Math.abs(s.b[1] - s.a[1]) > 1);
  expect(sloped.length, 'the gable has slopes in the picture').toBeGreaterThan(1);
  // NO RUN OF STEPS. Taken at the screen's scale this box held some sixty
  // sloping pieces under a foot long; a roof's lines are feet long.
  const steps = sloped.filter(s => len(s) < 12);
  expect(steps.length, `sloping pieces under a foot: ${steps.length} of ${sloped.length}`).toBeLessThanOrEqual(2);
  expect(sloped.length, 'and a handful of lines, not dozens').toBeLessThan(20);
  // AND NO LINE DRAWN TWICE: no two pieces of the picture lie along one
  // another. A tenth of an inch apart and overlapping by more than an inch
  // is the same line kept twice.
  const along = (p, s) => {
    const dx = s.b[0] - s.a[0], dy = s.b[1] - s.a[1], l = Math.hypot(dx, dy);
    return { t: ((p[0] - s.a[0]) * dx + (p[1] - s.a[1]) * dy) / l, off: Math.abs((p[0] - s.a[0]) * dy - (p[1] - s.a[1]) * dx) / l, l };
  };
  const doubled = pic.segs.filter((s, i) => len(s) > 2 && pic.segs.some((t, j) => {
    if (i === j || len(t) < len(s)) return false;
    const a = along(s.a, t), b = along(s.b, t);
    if (a.off > 0.1 || b.off > 0.1) return false;
    return Math.min(Math.max(a.t, b.t), a.l) - Math.max(Math.min(a.t, b.t), 0) > 1;
  }));
  expect(doubled.length, 'lines kept twice').toBe(0);
  // THE LETTERING COMES AT THE SIZE THE SCREEN SHOWS IT. The finer sheet
  // multiplies its lettering with everything else; left behind, a window's
  // label would come into the detail a sixteenth of its size.
  const label = pic.words.find(w => /^W \d+ X \d+$/.test(w.text));
  expect(label, 'the window\'s label is in the picture').toBeTruthy();
  expect(label.h, `lettered ${label.h.toFixed(2)} inches high`).toBeGreaterThan(2);
  expect(label.h).toBeLessThan(12);
});
