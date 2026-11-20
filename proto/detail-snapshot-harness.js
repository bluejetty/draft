// detail-snapshot.js — the camera's arithmetic, off the page.
//
// jb, 20 Nov 2026: "make a 'square' area and take a 'snapshot' of the
// elevation or section" -- "copies the lines over so they can be edited" --
// "it will only be used to get information for drawing the details which
// will be stand alone files".
//
// tests/detail-snapshot-camera.spec.js drives the key and the box in a
// browser and lays the picture back over the screen. This is the part of it
// that needs no browser and should not wait for one: the box two presses
// make, what a picture is measured in, and what the same painter hands a
// recorder when it is asked for a box of a real house.
//
//   node proto/detail-snapshot-harness.js
const fs = require('fs');
const path = require('path');
const H = require('./harness-env.js');

const win = H.loadDraftModules();
const DS = win.DraftDetailSnapshot, W = win.DraftDxfWriter, D = win.DraftDxfReader, CV = win.DraftCutView;

let failed = 0, ran = 0;
const check = (label, got, want) => {
  ran += 1;
  if (String(got) === String(want)) return;
  failed += 1;
  console.log(`  FAIL ${label}\n       got  ${got}\n       want ${want}`);
};
const r2 = v => Math.round(v * 100) / 100;

// ── THE BOX TWO PRESSES MAKE ───────────────────────────────────────────────
{
  // A frame as the painter hands one out: 20 px to the foot, the foot u=10
  // at x=100, the elevation 30 at y=50.
  const frame = { pxPerFt: 20, x0: 100, y0: 50, uMin: 10, yTop: 30 };
  const a = { u: 12, e: 28 }, b = { u: 20, e: 22 };
  const box = DS.boxOf(a, b, frame);
  check('eight feet by six', `${box.widthFt} x ${box.heightFt}`, '8 x 6');
  check('where the painter put those feet, in pixels, y down',
    [box.px.x, box.px.y, box.px.w, box.px.h].join(), '140,90,160,120');
  const back = DS.boxOf(b, a, frame);
  check('the same box from the far corner back', JSON.stringify(back), JSON.stringify(box));
  check('and from the other two corners',
    JSON.stringify(DS.boxOf({ u: 20, e: 28 }, { u: 12, e: 22 }, frame)), JSON.stringify(box));
  check('a box is big enough at six inches a side',
    [DS.bigEnough(DS.boxOf({ u: 0, e: 0 }, { u: 0.5, e: 0.5 }, frame)),
      DS.bigEnough(DS.boxOf({ u: 0, e: 0 }, { u: 0.49, e: 4 }, frame)),
      DS.bigEnough(DS.boxOf({ u: 0, e: 0 }, { u: 4, e: 0.49 }, frame)),
      DS.bigEnough(null)].join(), 'true,false,false,false');
  check('no frame, no box', DS.boxOf(a, b, null), null);
  check('nor on a frame with no scale', DS.boxOf(a, b, { ...frame, pxPerFt: 0 }), null);
}

// ── WHAT A PICTURE IS MEASURED IN ──────────────────────────────────────────
//
// A painter that draws one known thing: a cross through the box's centre
// reaching a foot each way, a line that runs clean across the canvas, and a
// word. So every number below can be said without a house.
{
  const frame = { pxPerFt: 20, x0: 100, y0: 50, uMin: 10, yTop: 30 };
  const box = DS.boxOf({ u: 12, e: 28 }, { u: 20, e: 22 }, frame);
  const X = u => frame.x0 + (u - frame.uMin) * frame.pxPerFt;
  const Y = e => frame.y0 + (frame.yTop - e) * frame.pxPerFt;
  const paint = ctx => {
    ctx.strokeStyle = '#1d1f20';
    ctx.beginPath(); ctx.moveTo(X(15), Y(25)); ctx.lineTo(X(17), Y(25)); ctx.stroke();   // 2 ft across, centred
    ctx.beginPath(); ctx.moveTo(X(16), Y(25)); ctx.lineTo(X(16), Y(26)); ctx.stroke();   // 1 ft UP from the centre
    ctx.beginPath(); ctx.moveTo(0, Y(23)); ctx.lineTo(1000, Y(23)); ctx.stroke();        // right across the sheet
    ctx.font = '10px sans-serif'; ctx.fillStyle = '#1d1f20';
    ctx.fillText('IN', X(13), Y(27)); ctx.fillText('OUT', X(30), Y(27));
  };
  const taken = DS.capture({ paint, frame, box, width: 1000, height: 600 });
  const lines = taken.entities.filter(e => e.type === 'poly').map(e => e.pts.map(r2).join(' '));
  check('inches, from the box\'s centre: two feet across is 24, a foot each way', lines[0], '-12 0 12 0');
  check('y UP: a line drawn a foot up the house goes up the picture', lines[1], '0 0 0 12');
  check('a line across the sheet is cut at the box: 8 ft is 48 inches each way, two feet below the middle',
    lines[2], '-48 -24 48 -24');
  check('a word inside the box comes, one outside does not',
    taken.entities.filter(e => e.type === 'text').map(e => e.text).join(), 'IN');
  check('the size it was taken at', `${taken.widthFt} x ${taken.heightFt}`, '8 x 6');
  check('too small a box takes nothing',
    DS.capture({ paint, frame, box: DS.boxOf({ u: 12, e: 28 }, { u: 12.2, e: 27.9 }, frame), width: 1000, height: 600 }), null);

  // AS IT IS FILED.
  const rec = DS.record({ id: 'snap-1', taken, cutName: 'S1', kind: 'section', when: '2026-11-20T12:00:00.000Z' });
  check('named for the view it was taken of', `${rec.name} / ${rec.cut} / ${rec.kind}`, 'S1 SNAPSHOT / S1 / section');
  check('its size, in feet', `${rec.widthFt} x ${rec.heightFt}`, '8 x 6');
  const geo = D.parse(rec.dxf, { segments: true });
  check('the DXF says no units, which a reader takes as inches', geo.units, null);
  check('and reads back as the same three lines',
    geo.segments.map(s => [...s.a, ...s.b].map(r2).join(' ')).join(' | '),
    '-12 0 12 0 | 0 0 0 12 | -48 -24 48 -24');
  check('with its word', geo.texts.map(t => t.lines.join()).join(), 'IN');
}

// ── A BOX OF A REAL HOUSE, FROM THE PAINTER THAT DRAWS THE SCREEN ─────────
{
  const saved = JSON.parse(fs.readFileSync(path.join(__dirname, 'repro-jb-fdn-tee.draft'), 'utf8'));
  const env = H.buildEnv(win, saved);
  const cut = H.standardElevationCuts(env).find(c => c.id === 'E1');
  const w = 1100, h = 700;
  // THE FRAME, as the page learns it: painted once, fitted, and handed back.
  let frame = null;
  const fitted = W.recorder({ width: w, height: h, layer: 'X' });
  CV.drawCutView(env, fitted, w, h, cut, { cushion: 0.1, onFrame: f => { frame = { ...f }; } });
  check('the painter hands its frame back', Number.isFinite(frame && frame.pxPerFt), true);

  // PINNED TO THAT FRAME, THE PAINTER DRAWS THE SAME DRAWING. The camera
  // repaints in the frame the screen was painted in, and everything it files
  // rests on that being the same picture.
  const pinned = W.recorder({ width: w, height: h, layer: 'X' });
  CV.drawCutView(env, pinned, w, h, cut, { frame });
  const ends = rec => rec.entities.filter(e => e.type === 'poly')
    .map(e => e.pts.map(v => Math.round(v * 10) / 10).join(' '));
  const inPinned = new Set(ends(pinned));
  check('a pinned pass draws every line the fitted pass drew, where it drew it',
    ends(fitted).filter(line => !inPinned.has(line)).join('|'), '');
  // (One line more, in fact: the pinned pass rules the grade right across
  // its margins. More of the ground is not a different house.)
  check('and no more than the ground line besides',
    pinned.entities.length - fitted.entities.length <= 1, true);

  // THE HOUSE'S CORNER, 8 ft by 6, about the second floor: nine feet up
  // this house, where its level lines are ruled. The frame carries two feet
  // of air either side of the house, so the corner is two feet in from it.
  const corner = { u: frame.uMin + 2, e: 9 };
  const box = DS.boxOf({ u: corner.u - 4, e: corner.e + 3 }, { u: corner.u + 4, e: corner.e - 3 }, frame);
  const paint = ctx => CV.drawCutView(env, ctx, w, h, cut, { frame });
  const taken = DS.capture({ paint, frame, box, width: w, height: h });
  const polys = taken.entities.filter(e => e.type === 'poly');
  check('lines of the house came', polys.length >= 3, true);
  const xs = polys.flatMap(e => e.pts.filter((v, i) => i % 2 === 0));
  const ys = polys.flatMap(e => e.pts.filter((v, i) => i % 2 === 1));
  check('none past the box: 48 inches each way across, 36 up and down',
    Math.max(...xs.map(Math.abs)) <= 48.001 && Math.max(...ys.map(Math.abs)) <= 36.001, true);
  // CUT AT THE BOX, NOT SHRUNK TO FIT: the wall's corner runs out of the top
  // of the box and out of the bottom, and a level line out of its left side.
  check('the corner of the house runs to the top of the box and to the bottom',
    `${r2(Math.min(...ys))} ${r2(Math.max(...ys))}`, '-36 36');
  check('and a level line to its left side', r2(Math.min(...xs)), -48);
  // THE CORNER IS IN THE MIDDLE, where the box was centred on it: within an
  // inch, the painter's lines being on half-pixel centres.
  const uprights = polys.filter(e => e.pts.length === 4 && Math.abs(e.pts[0] - e.pts[2]) < 0.01);
  check('the corner stands in the middle of the picture',
    uprights.length > 0 && uprights.every(e => Math.abs(e.pts[0]) < 1), true);

  // WHAT IS BEHIND THE WALL STAYS BEHIND IT. The painter rules the level
  // lines right across the sheet and then stands the house in front of them;
  // on the screen they stop at the wall. So in the picture they stop at the
  // corner in the middle of it -- and the same box with nothing hidden has
  // them running on through the house to its far side.
  const levels = polys.filter(e => e.pts.length === 4 && Math.abs(e.pts[1] - e.pts[3]) < 0.01);
  check('the level lines stop at the wall', levels.length > 0 && levels.every(e => Math.max(e.pts[0], e.pts[2]) < 1), true);
  const seeThrough = W.recorder({ width: w, height: h, layer: 'X' });
  seeThrough.save(); seeThrough.beginPath();
  seeThrough.rect(box.px.x, box.px.y, box.px.w, box.px.h); seeThrough.clip();
  paint(seeThrough); seeThrough.restore();
  const length = es => es.filter(e => e.type === 'poly').reduce((sum, e) => {
    for (let i = 2; i < e.pts.length; i += 2) sum += Math.hypot(e.pts[i] - e.pts[i - 2], e.pts[i + 1] - e.pts[i - 1]);
    return sum;
  }, 0);
  const shown = length(taken.entities) / 12;                       // feet of line in the picture
  const drawn = length(seeThrough.entities) / frame.pxPerFt;       // feet of line the painter stroked
  check('where the painter stroked them four feet further, each',
    drawn - shown > 7, true);
}

console.log(`\n${ran - failed}/${ran} checks passed`);
if (failed) process.exitCode = 1;
