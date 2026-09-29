#!/usr/bin/env node
// THE TITLEBLOCK, OFF THE SHEET (boards #285/#286).
//
// This is the strip a client and a building department read first, and it is
// a PURE PAINTER -- a context, a pixel box, the sheet's words -- so all of it
// can be inked into a recording context and read back here. What that buys
// over a screenshot is the thing a screenshot cannot state: WHICH WORDS
// REACHED THE SHEET. A missing address on a printed set is a defect nobody
// catches until the sheet is on a desk.
//
// THE RECORDING CONTEXT IS THIS FILE'S OWN, and deliberately not the shared
// one in harness-env.js, for two reasons that both matter here:
//
//   IT KEEPS A TRANSFORM. Half of the right-hand strip is drawn rotated --
//   translate, rotate(-90deg), fillText at the origin -- so under a context
//   that ignores translate every rotated word lands at (0,0) and "is the
//   project title above the address" cannot be asked at all.
//
//   IT MEASURES TEXT. fit() shrinks a string until it fits its cell, and it
//   asks measureText to decide. A measureText that returns 0 means nothing
//   ever overflows, so the whole shrink-to-fit path -- the reason a long
//   owner name does not run out of its box -- goes untested and every
//   mutation of it survives. Width here is proportional to the font size and
//   the string length, which is crude but MONOTONIC, which is all fit needs.
//
// Run: node proto/titleblock-harness.js
//      node proto/titleblock-harness.js --mutate
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const MUTATE = require('./harness-args.js').mutationMode();

let EDIT = null;
const readSubject = name => {
  const text = fs.readFileSync(path.join(ROOT, name), 'utf8');
  return EDIT && EDIT.file === name ? EDIT.fn(text) : text;
};

function loadTitleblock() {
  const win = {};
  const sandbox = { window: win, console, Math, Number, String, Object, Array, JSON };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(readSubject('titleblock.js'), sandbox, { filename: 'titleblock.js' });
  if (!win.DraftTitleblock) throw new Error('titleblock.js did not publish DraftTitleblock');
  return win.DraftTitleblock;
}

// ── A CONTEXT THAT REMEMBERS WHERE IT WAS POINTED ──────────────────────
function sheetCtx() {
  const strokes = [];
  const rects = [];
  const words = [];
  const images = [];
  // [a b c d e f], the canvas transform, so a rotated word reports the page
  // position it actually lands on.
  let m = [1, 0, 0, 1, 0, 0];
  // SAVE/RESTORE CARRIES THE PEN, NOT JUST THE TRANSFORM, because that is
  // what a canvas does and because the caller's ink is the thing an
  // unbalanced painter walks off with.
  const PEN = ['strokeStyle', 'fillStyle', 'lineWidth', 'font', 'textAlign', 'textBaseline'];
  const stack = [];
  const at = (x, y) => ({ x: m[0] * x + m[2] * y + m[4], y: m[1] * x + m[3] * y + m[5] });
  const mul = n => {
    m = [
      m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1],
      m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3],
      m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5],
    ];
  };
  const sizeOf = font => {
    const found = /(\d+(?:\.\d+)?)px/.exec(font || '');
    return found ? parseFloat(found[1]) : 10;
  };
  let cur = null;
  const ctx = {
    strokeStyle: '#000', fillStyle: '#000', lineWidth: 1,
    font: '', textAlign: '', textBaseline: '',
    beginPath() { cur = []; },
    moveTo(x, y) { (cur || (cur = [])).push({ ...at(x, y), move: true }); },
    lineTo(x, y) { (cur || (cur = [])).push(at(x, y)); },
    closePath() { if (cur && cur.length) cur.push({ ...cur[0], close: true }); },
    stroke() {
      if (cur && cur.length > 1) strokes.push({ pts: cur.slice(), ink: this.strokeStyle, w: this.lineWidth });
    },
    fill() { if (cur && cur.length > 1) rects.push({ pts: cur.slice(), ink: this.fillStyle, filled: true }); },
    strokeRect(x, y, w, h) {
      rects.push({ box: { ...at(x, y), w, h }, ink: this.strokeStyle, lw: this.lineWidth, stroked: true });
    },
    fillRect() {}, clearRect() {}, rect() {},
    save() {
      const pen = {};
      PEN.forEach(key => { pen[key] = ctx[key]; });
      stack.push({ m: m.slice(), pen });
    },
    restore() {
      if (!stack.length) return;
      const top = stack.pop();
      m = top.m;
      PEN.forEach(key => { ctx[key] = top.pen[key]; });
    },
    translate(x, y) { mul([1, 0, 0, 1, x, y]); },
    rotate(a) { mul([Math.cos(a), Math.sin(a), -Math.sin(a), Math.cos(a), 0, 0]); },
    scale(x, y) { mul([x, 0, 0, y, 0, 0]); },
    setLineDash() {}, getLineDash() { return []; },
    fillText(text, x, y) {
      const px = sizeOf(this.font);
      words.push({
        text: String(text), ...at(x, y), ink: this.fillStyle, font: this.font, px,
        // -90deg rotation turns the x basis vector to point up the sheet.
        rotated: Math.abs(m[1]) > 0.5 || Math.abs(m[2]) > 0.5,
        align: this.textAlign, baseline: this.textBaseline,
      });
    },
    strokeText() {},
    // Crude but monotonic in both length and size, which is what fit needs.
    measureText(text) { return { width: String(text).length * sizeOf(this.font) * 0.5 }; },
    arc(x, y, r) { strokes.push({ arc: { ...at(x, y), r }, ink: this.strokeStyle }); },
    ellipse() {}, quadraticCurveTo() {}, bezierCurveTo() {}, clip() {},
    drawImage(img, x, y, w, h) { images.push({ img, ...at(x, y), w, h }); },
    createLinearGradient: () => ({ addColorStop() {} }),
  };
  return { ctx, strokes, rects, words, images };
}

const BOX = { x: 700, y: 40, w: 100, h: 900 };
const BAND = { x: 40, y: 900, w: 1000, h: 130 };
const LOGO = { complete: true, naturalWidth: 400, naturalHeight: 200 };

const INFO = {
  projectName: 'MAPLE RIDGE',
  pageTitle: 'GROUND FLOOR PLAN',
  address: '128 CONCESSION ROAD 4',
  owner: 'R. GRUFF',
  revision: 'B',
  date: '2026-09-29',
  scale: '1/4" = 1\'-0"',
  drafterName: 'M. QUEST',
  drafterPhone: '705-555-0134',
  sheet: 'A-2',
  northArrow: false,
};

const ink = (paint, text) => paint.words.find(word => word.text === text) || null;
const has = (paint, text) => ink(paint, text) !== null;

let passed = 0;
let failures = [];
const check = (label, condition, detail) => {
  if (condition) { passed += 1; return; }
  failures.push(detail ? `${label} — ${detail}` : label);
};

const paintWith = (T, style, info, logo, box) => {
  const paint = sheetCtx();
  T.draw(paint.ctx, box || BOX, style, info, logo === undefined ? LOGO : logo);
  return paint;
};

function runChecks() {
  passed = 0; failures = [];
  const T = loadTitleblock();
  const right = T.styleById('roughdrafter');
  const band = T.styleById('bluejetty-band');

  // ── THE REGISTRY ─────────────────────────────────────────────────────
  check('a new company is a STYLES entry, not a new painter', T.STYLES.length === 4);
  check('every style is reachable by its id',
    T.STYLES.every(style => T.styleById(style.id) === style));
  check('the ids are distinct', new Set(T.STYLES.map(s => s.id)).size === 4);
  check('a company nobody has heard of comes back null, not a wrong strip',
    T.styleById('acme') === null && T.styleById(undefined) === null,
    'silently painting another company\'s name on a client sheet is the bad failure here');
  check('every style names a company and a mark to paint it with',
    T.STYLES.every(s => s.company && s.logoSrc && s.label));
  check('every company has both a strip and a band',
    ['BLUEJETTY', 'ROUGH DRAFTER'].every(company =>
      T.STYLES.some(s => s.company === company && s.placement === 'right')
        && T.STYLES.some(s => s.company === company && s.placement === 'bottom')));
  check('the registry is frozen, entries and all',
    Object.isFrozen(T.STYLES) && T.STYLES.every(Object.isFrozen) && Object.isFrozen(T));
  check('the paper sizes are in INCHES, not pixels',
    T.STRIP_W_IN === 1.15 && T.BAND_H_IN === 1.5 && T.CORNER_RADIUS_IN === 0.35,
    'a strip measured in pixels prints a different width on every sheet scale');
  check('each right-hand style carries its own sheet-border radius',
    T.styleById('bluejetty').cornerRadiusIn === 0.35
      && T.styleById('roughdrafter').cornerRadiusIn === 0);

  // ── WHICH PAINTER ────────────────────────────────────────────────────
  const stripPaint = paintWith(T, right, INFO);
  const bandPaint = paintWith(T, band, INFO, LOGO, BAND);
  check('a right-placement style draws the vertical strip',
    stripPaint.words.some(word => word.rotated),
    'the rotated words are the strip and nothing else draws them');
  check('a bottom-placement style draws the band',
    bandPaint.rects.some(rect => rect.stroked) && !bandPaint.words.some(w => w.rotated),
    'the band is a stroked rectangle of cells; the strip has neither');
  check('a style naming no placement falls to the band',
    paintWith(T, { ...band, placement: undefined }, INFO, LOGO, BAND)
      .rects.some(rect => rect.stroked));

  // ── THE WORDS REACH THE SHEET ────────────────────────────────────────
  const mustCarry = ['MAPLE RIDGE', 'GROUND FLOOR PLAN', '128 CONCESSION ROAD 4',
    'R. GRUFF', 'B', '2026-09-29', '1/4" = 1\'-0"', 'M. QUEST', '705-555-0134', 'A-2'];
  const missing = mustCarry.filter(text => !has(stripPaint, text));
  check('THE STRIP CARRIES EVERY WORD IT WAS GIVEN', missing.length === 0,
    `missing ${missing.join(', ')}`);
  const bandMissing = ['MAPLE RIDGE', '128 CONCESSION ROAD 4', 'R. GRUFF', '2026-09-29',
    '1/4" = 1\'-0"', 'M. QUEST', '705-555-0134', 'A-2'].filter(text => !has(bandPaint, text));
  check('and so does the band', bandMissing.length === 0, `missing ${bandMissing.join(', ')}`);
  check('the strip labels its record rows',
    ['REVISION', 'DATE', 'SCALE', 'DRAFT BY', 'SHEET'].every(text => has(stripPaint, text)));
  check('the strip labels the address and the owner',
    has(stripPaint, 'BUILDING ADDRESS') && has(stripPaint, 'BUILDING OWNER'));
  check('the band labels its cells',
    ['PROJECT', 'DRAWN BY', 'DATE · SCALE', 'SHEET'].every(text => has(bandPaint, text)));

  // ── WHAT AN EMPTY SHEET DOES ─────────────────────────────────────────
  const bare = paintWith(T, right, {});
  check('a sheet with no project name still says something',
    has(bare, 'NEW HOME'), 'an untitled strip with a blank title reads as a printing fault');
  check('a sheet with no number is sheet 1',
    has(bare, '1') && has(paintWith(T, band, {}, LOGO, BAND), '1'));
  check('a revision nobody has set prints an em dash, not an empty row',
    has(bare, '—'));
  check('an absent value paints nothing rather than the word undefined',
    !bare.words.some(word => /undefined|null|NaN/.test(word.text)),
    'this is the failure that reaches a client sheet unnoticed');
  check('an absent page title does not paint an empty string',
    !bare.words.some(word => word.text === ''));
  check('an empty band is the same story',
    !paintWith(T, band, {}, LOGO, BAND).words.some(w => /undefined|null|NaN/.test(w.text)));

  // ── THE STRIP READS UP THE SHEET, IN ORDER ───────────────────────────
  const title = ink(stripPaint, 'MAPLE RIDGE');
  const pageTitle = ink(stripPaint, 'GROUND FLOOR PLAN');
  const address = ink(stripPaint, '128 CONCESSION ROAD 4');
  const sheetNo = ink(stripPaint, 'A-2');
  check('the rotated words are actually rotated',
    [title, pageTitle, address, ink(stripPaint, 'R. GRUFF')].every(word => word.rotated));
  check('the record rows and the sheet number are NOT',
    !ink(stripPaint, 'REVISION').rotated && !sheetNo.rotated);
  check('turn the sheet and the project reads first, the page title second',
    title.x < pageTitle.x,
    'the two are one stacked pair; swapping them puts the page title over the project');
  check('the title block sits above the address block, which sits above the rows',
    title.y < address.y && address.y < ink(stripPaint, 'REVISION').y,
    'sections are fractions of the strip height and a wrong one overprints its neighbour');
  check('the sheet number carries the bottom cell',
    sheetNo.y > ink(stripPaint, 'DRAFT BY').y && sheetNo.y > ink(stripPaint, 'SHEET').y);
  check('the sheet number is the biggest thing on the strip',
    stripPaint.words.every(word => word === sheetNo || word.px <= sheetNo.px),
    'it is what a set is leafed through by');
  check('the label column sits against the rail and the words beside it',
    ink(stripPaint, 'BUILDING ADDRESS').x < address.x
      && ink(stripPaint, 'BUILDING OWNER').x < ink(stripPaint, 'R. GRUFF').x);
  check('every word lands inside the strip it belongs to',
    stripPaint.words.every(word => word.x >= BOX.x - 1 && word.x <= BOX.x + BOX.w + 1
      && word.y >= BOX.y - 1 && word.y <= BOX.y + BOX.h + 1),
    'a word outside the box is a word over the drawing');
  check('the strip draws its left rail down the full height',
    stripPaint.strokes.some(s => s.pts && s.pts.length === 2
      && Math.abs(s.pts[0].x - BOX.x) < 0.01 && Math.abs(s.pts[1].x - BOX.x) < 0.01
      && Math.abs(s.pts[1].y - s.pts[0].y - BOX.h) < 0.01));
  // A SECTION DIVIDER IS 0.75 WIDE AND A RECORD-ROW RULE IS 0.5. Both run
  // the full width of the strip, so the pen is the only thing telling them
  // apart -- and it is a real distinction on the sheet: the sections are the
  // composition, the row rules are inside one of them.
  const fullWidth = s => s.pts && s.pts.length === 2
    && Math.abs(s.pts[0].y - s.pts[1].y) < 0.01 && Math.abs(s.pts[1].x - s.pts[0].x - BOX.w) < 0.01;
  const dividers = stripPaint.strokes.filter(s => fullWidth(s) && s.w === 0.75);
  check('the record rules are drawn finer than the section dividers',
    stripPaint.strokes.filter(s => fullWidth(s) && s.w === 0.5).length === 3,
    'three rules between four record rows');
  check('the strip is divided into its six sections',
    dividers.length === 5, `${dividers.length} full-width dividers`);
  check('the dividers are in order down the strip and none lands on another',
    new Set(dividers.map(d => d.pts[0].y)).size === dividers.length);

  // ── THE NORTH ARROW IS A SITE-PLAN THING ─────────────────────────────
  const plain = paintWith(T, right, INFO);
  const sited = paintWith(T, right, { ...INFO, northArrow: true });
  check('an ordinary sheet flies no north arrow',
    !has(plain, 'N') && !plain.strokes.some(s => s.arc));
  check('a site plan does', has(sited, 'N') && sited.strokes.some(s => s.arc));
  check('THE ARROW CELL HOLDS ITS PLACE ON EVERY SHEET',
    ink(plain, 'MAPLE RIDGE').y === ink(sited, 'MAPLE RIDGE').y,
    'if the cell collapsed, adding a north arrow would shift the whole composition');
  check('the arrow cell is a fraction of the strip, not of whether an arrow flies',
    dividers.some(d => Math.abs(d.pts[0].y - (BOX.y + BOX.h * 0.12)) < 0.01),
    'the first divider is the bottom of the arrow cell and it sits there on every sheet');
  check('the arrow points up the sheet',
    sited.strokes.some(s => s.pts && s.pts.length === 2 && s.pts[1].y < s.pts[0].y
      && Math.abs(s.pts[1].x - s.pts[0].x) < 0.01));
  check('a style that wants no arrow divider gets none',
    paintWith(T, { ...right, arrowDivider: false }, INFO).strokes
      .filter(s => s.pts && s.pts.length === 2
        && Math.abs(s.pts[0].y - s.pts[1].y) < 0.01
        && Math.abs(s.pts[1].x - s.pts[0].x - BOX.w) < 0.01 && s.w === 0.75).length === dividers.length - 1);

  // ── THE COMPANY MARK ─────────────────────────────────────────────────
  check('a logoOnly company paints its mark and NOT its name twice',
    !has(stripPaint, 'ROUGH DRAFTER') && stripPaint.images.length === 1,
    'the logo has ROUGH DRAFTER set across it; the wordmark under it printed the name twice');
  const worded = paintWith(T, { ...right, logoOnly: false }, INFO);
  check('a company whose logo is not its wordmark gets the name under the mark',
    has(worded, 'ROUGH DRAFTER'));
  check('the mark keeps its aspect ratio',
    Math.abs(stripPaint.images[0].w / stripPaint.images[0].h
      - LOGO.naturalWidth / LOGO.naturalHeight) < 1e-6,
    'a stretched company logo is the thing a client notices first');
  const tallLogo = { complete: true, naturalWidth: 100, naturalHeight: 900 };
  const tallPaint = paintWith(T, right, INFO, tallLogo);
  check('a logoOnly mark is given the room the missing wordmark would have taken',
    tallPaint.images[0].h > paintWith(T, { ...right, logoOnly: false }, INFO, tallLogo).images[0].h,
    'it fills ~75% of the cell against ~42%, which is only visible once the height is what binds');
  check('a tall mark is held to its cell rather than running through the dividers',
    tallPaint.images[0].h <= (BOX.h * 0.92 - BOX.h * 0.78) * 0.75 + 0.01,
    `drew ${tallPaint.images[0].h}px into a ${(BOX.h * 0.14).toFixed(1)}px cell`);
  check('and it keeps its aspect ratio while being held',
    Math.abs(tallPaint.images[0].w / tallPaint.images[0].h - 100 / 900) < 1e-6);
  check('a mark that has not loaded yet is simply not drawn',
    paintWith(T, right, INFO, { complete: false, naturalWidth: 400, naturalHeight: 200 })
      .images.length === 0
      && paintWith(T, right, INFO, null).images.length === 0,
    'a half-loaded image draws a black box on a client sheet');
  check('a mark with no dimensions yet is not drawn either',
    paintWith(T, right, INFO, { complete: true, naturalWidth: 0, naturalHeight: 0 })
      .images.length === 0);
  check('the sheet still carries its words with no mark at all',
    has(paintWith(T, right, INFO, null), 'MAPLE RIDGE'));
  const longDrafter = 'ALOYSIUS PENDERGAST-WHITTINGHAM III';
  check('a record row value too wide for the strip is shrunk to fit it',
    ink(paintWith(T, right, { ...INFO, drafterName: longDrafter }), longDrafter).px
      < ink(stripPaint, 'M. QUEST').px,
    'the rows are the narrow way across the strip, so this is where fit earns its keep');
  check('the drafter\'s phone follows the mark',
    ink(stripPaint, '705-555-0134').y > ink(stripPaint, 'SCALE').y);
  check('a drafter with no phone leaves no gap-filler',
    !paintWith(T, right, { ...INFO, drafterPhone: '' }, LOGO).words
      .some(word => word.text === ''));

  // ── SHRINK TO FIT ────────────────────────────────────────────────────
  const longName = 'THE VERY LONG NAME OF A CLIENT WHO USES ALL THEIR NAMES';
  const longPaint = paintWith(T, right, { ...INFO, owner: longName });
  check('a long name is shrunk rather than run out of its cell',
    ink(longPaint, longName).px < ink(stripPaint, 'R. GRUFF').px,
    'the alternative is a name printed across the record rows');
  check('but it is still printed', has(longPaint, longName));
  const absurd = 'X'.repeat(4000);
  const absurdPaint = paintWith(T, right, { ...INFO, owner: absurd });
  const worse = 'X'.repeat(16000);
  check('a name nothing could fit stops shrinking at a readable floor',
    ink(absurdPaint, absurd).px >= 5
      && ink(paintWith(T, right, { ...INFO, owner: worse }), worse).px
        === ink(absurdPaint, absurd).px,
    `floor is ${ink(absurdPaint, absurd).px}px; without one this shrinks to a grey smear`);
  check('a short name is not shrunk for nothing',
    ink(stripPaint, 'R. GRUFF').px === BOX.w * 0.14,
    `drew at ${ink(stripPaint, 'R. GRUFF').px}px, base is ${BOX.w * 0.14}px`);
  const bandLong = paintWith(T, band, { ...INFO, projectName: longName }, LOGO, BAND);
  check('the band shrinks to fit too', ink(bandLong, longName).px
    < ink(bandPaint, 'MAPLE RIDGE').px);

  // ── THE BAND'S CELLS ─────────────────────────────────────────────────
  const border = bandPaint.rects.find(rect => rect.stroked);
  check('the band is bordered on all four sides',
    border && border.box.w === BAND.w && border.box.h === BAND.h);
  const cellLines = bandPaint.strokes.filter(s => s.pts && s.pts.length === 2
    && Math.abs(s.pts[0].x - s.pts[1].x) < 0.01);
  check('the band has five cells, so four dividers', cellLines.length === 4,
    `${cellLines.length} dividers`);
  check('the cells run left to right and fill the band exactly',
    cellLines.map(s => s.pts[0].x).every((x, i, all) => i === 0 || x > all[i - 1])
      && Math.abs(cellLines[3].pts[0].x - (BAND.x + BAND.w * 0.88)) < 0.01,
    'the five fractions must sum to one or the last cell falls off the sheet');
  check('the identity cell carries the company name',
    has(bandPaint, 'BLUEJETTY'),
    'the band has no logoOnly: the name is printed beside the mark on every band');
  check('the band words all land inside the band',
    bandPaint.words.every(word => word.x >= BAND.x - 1 && word.x <= BAND.x + BAND.w + 1
      && word.y >= BAND.y - 1 && word.y <= BAND.y + BAND.h + 1));
  check('the band mark keeps its aspect ratio',
    Math.abs(bandPaint.images[0].w / bandPaint.images[0].h
      - LOGO.naturalWidth / LOGO.naturalHeight) < 1e-6);
  check('a wide mark is held inside the identity cell',
    paintWith(T, band, INFO, { complete: true, naturalWidth: 4000, naturalHeight: 100 }, BAND)
      .images[0].w <= BAND.w * 0.2);
  check('the band sheet number carries its cell',
    ink(bandPaint, 'A-2').px > ink(bandPaint, 'SHEET').px);

  // ── THE INK ──────────────────────────────────────────────────────────
  check('the values are inked and the labels are faint',
    ink(stripPaint, 'MAPLE RIDGE').ink === '#1d1f20'
      && ink(stripPaint, 'BUILDING ADDRESS').ink === 'rgba(29,31,32,0.55)'
      && ink(stripPaint, 'REVISION').ink === 'rgba(29,31,32,0.55)',
    'a label as dark as its value makes the strip unreadable at arm\'s length');
  check('the page title is the quieter of the two title lines',
    ink(stripPaint, 'GROUND FLOOR PLAN').ink === 'rgba(29,31,32,0.55)'
      && ink(stripPaint, 'MAPLE RIDGE').ink === '#1d1f20');
  check('the sheet number is inked, not faint', ink(stripPaint, 'A-2').ink === '#1d1f20');
  check('nothing is painted in a colour the sheet does not own',
    stripPaint.words.every(word => word.ink === '#1d1f20' || word.ink === 'rgba(29,31,32,0.55)'));

  // ── THE PAINTER LEAVES THE CONTEXT AS IT FOUND IT ────────────────────
  const shared = sheetCtx();
  shared.ctx.save();
  shared.ctx.strokeStyle = '#ff0000';
  shared.ctx.fillStyle = '#00ff00';
  shared.ctx.lineWidth = 4;
  shared.ctx.font = '400 99px caller';
  T.draw(shared.ctx, BOX, right, INFO, LOGO);
  check('AND HANDS BACK THE PEN IT WAS LENT',
    shared.ctx.strokeStyle === '#ff0000' && shared.ctx.fillStyle === '#00ff00'
      && shared.ctx.lineWidth === 4 && shared.ctx.font === '400 99px caller',
    'the sheet border is drawn after the strip and inherits whatever it leaves set');
  shared.ctx.beginPath();
  shared.ctx.moveTo(0, 0);
  shared.ctx.lineTo(10, 0);
  shared.ctx.stroke();
  const after = shared.strokes[shared.strokes.length - 1];
  check('THE PAINTER UNWINDS ITS OWN TRANSFORM',
    Math.abs(after.pts[0].x) < 1e-9 && Math.abs(after.pts[1].x - 10) < 1e-9
      && Math.abs(after.pts[0].y) < 1e-9,
    'a rotate left standing turns every drawing painted after the titleblock on its side');
}

if (!MUTATE) {
  runChecks();
  console.log(`\ntitleblock harness: ${passed} checks passed, ${failures.length} failed`);
  if (failures.length) {
    failures.forEach(line => console.log(`  ✘ ${line}`));
    process.exit(1);
  }
  process.exit(0);
}

// ── MUTATIONS ───────────────────────────────────────────────────────────
const MUTATIONS = [
  ['an unknown company falls back to the first style instead of null', 'titleblock.js',
    c => c.replace('const styleById = id => STYLES.find(style => style.id === id) || null;',
      'const styleById = id => STYLES.find(style => style.id === id) || STYLES[0];')],

  ['every style draws the band, whatever its placement says', 'titleblock.js',
    c => c.replace("if (style.placement === 'right') drawRight(ctx, box, style, info, logo);",
      "if (false) drawRight(ctx, box, style, info, logo);")],

  ['every style draws the strip', 'titleblock.js',
    c => c.replace("if (style.placement === 'right') drawRight(ctx, box, style, info, logo);\n    else drawBottom(ctx, box, style, info, logo);",
      '    drawRight(ctx, box, style, info, logo);')],

  ['the strip drops the page title line', 'titleblock.js',
    c => c.replace("    rot(info.pageTitle || '', x + w * 0.68, arrowB, titleB, w * 0.22, 400, condensed, FAINT);\n", '')],

  ['the project title and the page title swap places', 'titleblock.js',
    c => c.replace("rot(info.projectName || 'NEW HOME', x + w * 0.32,", "rot(info.projectName || 'NEW HOME', x + w * 0.88,")],

  ['an untitled sheet prints a blank where the project goes', 'titleblock.js',
    c => c.replace("rot(info.projectName || 'NEW HOME',", 'rot(info.projectName,')],

  ['a sheet with no number prints nothing instead of 1', 'titleblock.js',
    c => c.replace("    ctx.fillText(info.sheet || '1', x + w / 2, markB + (y + h - markB) * 0.58);",
      '    ctx.fillText(info.sheet, x + w / 2, markB + (y + h - markB) * 0.58);')],

  ['an unset revision prints the word undefined', 'titleblock.js',
    c => c.replace("      ['REVISION', info.revision || '—'],", "      ['REVISION', String(info.revision)],")],

  ['the record rows print their values whether or not there are any', 'titleblock.js',
    c => c.replace('      if (value) {\n        const size = fit(ctx, value,', '      if (true) {\n        const size = fit(ctx, String(value),')],

  ['the address block loses the owner', 'titleblock.js',
    c => c.replace("    rot(info.owner, x + w * 0.82, titleB, wordsB, w * 0.14, 400, plain, INK);\n", '')],

  ['the labels are inked as dark as their values', 'titleblock.js',
    c => c.replace("const FAINT = 'rgba(29,31,32,0.55)';", "const FAINT = '#1d1f20';")],

  ['the sheet number is printed faint', 'titleblock.js',
    c => c.replace("    ctx.fillStyle = INK;\n    ctx.font = `600 ${(y + h - markB) * 0.52}px ${condensed}`;",
      '    ctx.fillStyle = FAINT;\n    ctx.font = `600 ${(y + h - markB) * 0.52}px ${condensed}`;')],

  ['the sheet number shrinks to the size of its label', 'titleblock.js',
    c => c.replace('ctx.font = `600 ${(y + h - markB) * 0.52}px ${condensed}`;',
      'ctx.font = `600 ${Math.max(6, w * 0.13)}px ${condensed}`;')],

  ['the north arrow is flown on every sheet', 'titleblock.js',
    c => c.replace('    if (info.northArrow) {', '    if (true) {')],

  ['the arrow cell collapses when no arrow is flown', 'titleblock.js',
    c => c.replace('const arrowB = y + h * 0.12;',
      'const arrowB = y + (info.northArrow ? h * 0.12 : 0);')],

  ['the needle flies down the sheet', 'titleblock.js',
    c => c.replace('    ctx.moveTo(cx, cy + tail);\n    ctx.lineTo(cx, cy - tail * 0.35);',
      '    ctx.moveTo(cx, cy - tail);\n    ctx.lineTo(cx, cy + tail * 0.35);')],

  ['the arrow divider is drawn even where a style refuses it', 'titleblock.js',
    c => c.replace('if (style.arrowDivider !== false) divider(arrowB);', 'divider(arrowB);')],

  ['a section divider is dropped and two sections run together', 'titleblock.js',
    c => c.replace('    divider(wordsB);\n', '')],

  ['the strip stops drawing its left rail', 'titleblock.js',
    c => c.replace('    ctx.moveTo(x, y);\n    ctx.lineTo(x, y + h);\n    ctx.stroke();\n', '')],

  ['the sections are laid out bottom up', 'titleblock.js',
    c => c.replace('const titleB = y + h * 0.44;', 'const titleB = y + h * 0.80;')],

  ['the logoOnly company gets its name printed twice', 'titleblock.js',
    c => c.replace('    if (!style.logoOnly) {\n      const companyPx', '    if (true) {\n      const companyPx')],

  ['a logoOnly mark is drawn at the small size anyway', 'titleblock.js',
    c => c.replace('const share = style.logoOnly ? 0.75 : 0.42;', 'const share = 0.42;')],

  ['the mark is stretched to the cell instead of keeping its shape', 'titleblock.js',
    c => c.replace('      let logoH = logoW * (logo.naturalHeight / logo.naturalWidth);',
      '      let logoH = markH * 0.75;')],

  ['a tall mark is drawn at full height, through the dividers', 'titleblock.js',
    c => c.replace('      if (logoH > markH * share) {\n        logoH = markH * share;\n        logoW = logoH * (logo.naturalWidth / logo.naturalHeight);\n      }\n', '')],

  ['an image that has not loaded is drawn anyway', 'titleblock.js',
    c => c.replace('    if (logo && logo.complete && logo.naturalWidth) {\n      const share',
      '    if (logo) {\n      const share')],

  ['the phone is printed whether the drafter gave one or not', 'titleblock.js',
    c => c.replace('    if (info.drafterPhone) {\n      const phonePx', '    if (true) {\n      const phonePx')],

  ['nothing shrinks to fit any more', 'titleblock.js',
    c => c.replace('  while (size > 6 && ctx.measureText(text).width > maxPx) {',
      '  while (false) {')],

  ['the shrink has no floor, so a long name prints as a smear', 'titleblock.js',
    c => c.replace('  while (size > 6 && ctx.measureText(text).width > maxPx) {',
      '  while (size > 0 && ctx.measureText(text).width > maxPx) {')],

  ['the fitted size is measured but not used', 'titleblock.js',
    c => c.replace('        ctx.font = `400 ${size}px ${plain}`;', '        ctx.font = `400 ${w * 0.14}px ${plain}`;')],

  ['the band loses its border', 'titleblock.js',
    c => c.replace('    ctx.strokeRect(x, y, w, h);\n', '')],

  ['the band cells no longer fill the band', 'titleblock.js',
    c => c.replace('const CELLS = [0.2, 0.34, 0.2, 0.14, 0.12];', 'const CELLS = [0.2, 0.34, 0.2, 0.14, 0.3];')],

  ['a band cell divider is drawn past the last cell, off the sheet', 'titleblock.js',
    c => c.replace('    cells.slice(0, -1).forEach(cell => {', '    cells.forEach(cell => {')],

  ['the band identity cell loses the company name', 'titleblock.js',
    c => c.replace('    ctx.fillText(style.company, textX, y + h / 2);\n', '')],

  ['the band project cell loses the address', 'titleblock.js',
    c => c.replace('lines(cells[1], [info.projectName, info.owner, info.address], h * 0.14);',
      'lines(cells[1], [info.projectName, info.owner], h * 0.14);')],

  ['an empty band row is printed as a blank line', 'titleblock.js',
    c => c.replace('      rows.filter(Boolean).forEach(row => {', '      rows.forEach(row => {')],

  ['the painter leaves its rotation standing', 'titleblock.js',
    c => c.replace('      ctx.fillText(text, 0, 0);\n      ctx.restore();', '      ctx.fillText(text, 0, 0);')],

  ['the painter leaves the whole strip transform standing', 'titleblock.js',
    c => c.replace('    ctx.restore();\n  };\n\n  // The original bottom band', '  };\n\n  // The original bottom band')],

  ['the registry is left thawed', 'titleblock.js',
    c => c.replace('  const STYLES = Object.freeze([', '  const STYLES = ([')],
];

let caught = 0;
for (const [name, file, fn] of MUTATIONS) {
  const before = fs.readFileSync(path.join(ROOT, file), 'utf8');
  if (fn(before) === before) {
    console.log(`  ANCHOR MISSED  ${name}  (the edit changed nothing in ${file} -- re-aim it)`);
    continue;
  }
  EDIT = { file, fn };
  let red = false;
  try { runChecks(); red = failures.length > 0; }
  catch (err) { red = true; }
  EDIT = null;
  if (red) caught += 1;
  else console.log(`  SURVIVED  ${name}`);
}
console.log(`titleblock-harness: ${caught}/${MUTATIONS.length} mutations caught`);
process.exit(caught === MUTATIONS.length ? 0 : 1);
