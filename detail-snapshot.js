// DETAIL SNAPSHOT: a camera for a section or an elevation.
//
// jb, 20 Nov 2026: "i'd like to be able to make a 'square' area and take a
// 'snapshot' of the elevation or section and have it pop up in the DETAIL
// area as a new detail" -- "not a window that shows what exists there, but
// takes a snapshot and copies the lines over so they can be edited and new
// details added too" -- "it will only be used to get information for drawing
// the details which will be stand alone files" -- "lets call it DETAIL
// SNAPSHOT and make it camera".
//
// A PHOTO DOES NOT UPDATE, and that is the feature. The four built-in details
// are live windows on the wall section and re-draw from the model; this is
// the other thing: the lines inside a box, taken once, with no link back. A
// detail is drawn to be generally true, and it is drawn ON -- flashing,
// membrane, fasteners -- which a view of the model cannot be.
//
// IT IS NOT A SECOND DRAWING OF THE SECTION. dxf-writer.js's recorder is a
// stand-in for a canvas 2D context: the section's own painter draws onto it
// exactly as it draws onto the screen, and it keeps what was stroked. So what
// the camera takes is what the drafter was looking at, from the same code,
// and cannot drift from it. The recorder already cuts a line at a clip box,
// which is the whole of "inside the square".
//
// THE PICTURE IS A SMALL DXF, IN INCHES, Y UP, CENTRED ON THE BOX. A DXF
// because TRACE already takes one two ways -- kept as an underlay to draw
// over, or turned into lines that can be edited -- which are the two things
// he asked of it. Inches because that is what a DXF with no units is read as,
// so it lands full size without a question. Centred because a library
// detail's frame is centred on its shelf's origin.
//
// FILLS DO NOT COME OVER, BUT WHAT THEY HIDE STAYS HIDDEN. The recorder keeps
// outlines and small dark marks and leaves poche and tints behind, as it
// does for an engineer's DXF -- for something to trace that is the right
// half to keep. But the painter draws a house back to front and lets the
// near wall's white fill cover the far one, so with the fills simply dropped
// the back wall's windows came through the front elevation (the first
// picture this camera took, of E1, had three windows where the screen had
// one). The recorder is asked to `hide`: an opaque fill cuts away the lines
// already drawn under it, and the picture is what the screen showed.
//
// REQUIRES window.DraftDxfWriter, resolved at CALL time.
if (!window.DraftDetailSnapshot) {
(() => {
  // WHERE THE PICTURES WAIT. Its own bucket in the shared store, not a field
  // on the drawing: the camera is used in a house's file and the detail is
  // drawn in the details library's, and the browser's store is the one place
  // both can see.
  const BUCKET = 'detail-snapshots';
  // A BOX SMALLER THAN THIS IS A SLIP, not a detail: two presses on one spot
  // would otherwise file an empty picture.
  const MIN_FT = 0.5;
  // THE TRAY HOLDS THIS MANY and drops the oldest past it. It is a tray, not
  // an archive: a picture is kept by being drawn into a detail, and the
  // browser's store is shared with every drawing's underlays.
  const TRAY_MAX = 24;

  // The box two presses make, in the view's own feet and in its pixels.
  const boxOf = (a, b, frame) => {
    if (!a || !b || !frame || !(frame.pxPerFt > 0)) return null;
    const uMin = Math.min(a.u, b.u), uMax = Math.max(a.u, b.u);
    const eMin = Math.min(a.e, b.e), eMax = Math.max(a.e, b.e);
    return {
      uMin, uMax, eMin, eMax,
      widthFt: uMax - uMin, heightFt: eMax - eMin,
      px: {
        x: frame.x0 + (uMin - frame.uMin) * frame.pxPerFt,
        y: frame.y0 + (frame.yTop - eMax) * frame.pxPerFt,
        w: (uMax - uMin) * frame.pxPerFt,
        h: (eMax - eMin) * frame.pxPerFt,
      },
    };
  };
  const bigEnough = box => !!box && box.widthFt >= MIN_FT && box.heightFt >= MIN_FT;

  // ── A CLEAN LINE, AND A TRUE ONE ─────────────────────────────────────────
  //
  // jb, 20 Nov 2026, looking at the first picture of E1: "the roof lines look
  // kindof scratchy what is that ? how come not crisp clean line?"
  //
  // TWO THINGS, and both were the screen's. The painter puts every point on
  // a pixel, and at the zoom a whole elevation is read at a pixel is most of
  // an inch; and it draws a wall's sloped top as a run of two-inch steps and
  // lays the roof's edge, the fascia and that wall top over one another. On
  // the screen those are one line a pixel and a half wide. Kept as lines,
  // they are a bundle of nearly-parallel pieces that zigzag by half an inch.
  //
  // SO THE PICTURE IS NOT TAKEN AT THE SCREEN'S SCALE. The view is painted
  // again at `FINE_PX_PER_FT` or better -- a sixteenth of an inch to the
  // pixel -- whatever the screen is zoomed to, so a 2x6 wall measures 5 1/2
  // in the detail and not "about six". The same frame, every pixel of it
  // multiplied: same drawing, finer grain.
  //
  // AND WHAT LIES ON ONE LINE IS ONE LINE (`tidy`): pieces of the same kind
  // of line that run along the same line and touch or overlap become the one
  // piece that covers them, on the longest one's line.
  const FINE_PX_PER_FT = 192;
  // How far off a line, in inches, a piece may be and still be on it. A
  // TENTH, MEASURED: the painter's half-pixel at the fine scale is a
  // thirty-second, but two painters rounding the same edge their own ways
  // land up to three of those apart. On the four elevations of the test
  // house a sixteenth left 7 doubled lines on two of them, a tenth left
  // none, and nothing more joined all the way out to a fifth -- no two real
  // lines of a house stand a tenth of an inch apart.
  const SAME_LINE_IN = 0.1;
  const styleOf = e => `${e.layer}|${e.linetype || ''}|${e.dashed ? 1 : 0}|${e.color ?? ''}`;
  const tidy = (entities, tol = SAME_LINE_IN) => {
    const rest = [];
    const byStyle = new Map();
    entities.forEach(e => {
      if (e.type !== 'poly') { rest.push(e); return; }
      const key = styleOf(e);
      if (!byStyle.has(key)) byStyle.set(key, { like: e, segs: [] });
      const pts = e.closed ? [...e.pts, e.pts[0], e.pts[1]] : e.pts;
      for (let i = 2; i < pts.length; i += 2) {
        const len = Math.hypot(pts[i] - pts[i - 2], pts[i + 1] - pts[i - 1]);
        if (len > 1e-9) byStyle.get(key).segs.push({ a: [pts[i - 2], pts[i - 1]], b: [pts[i], pts[i + 1]], len });
      }
    });
    const lines = [];
    byStyle.forEach(({ like, segs }) => {
      // THE LONGEST FIRST: it knows best where the line is, and the short
      // pieces along it are measured against it rather than it against them.
      segs.sort((p, q) => q.len - p.len);
      const used = new Array(segs.length).fill(false);
      segs.forEach((carrier, ci) => {
        if (used[ci]) return;
        used[ci] = true;
        const ux = (carrier.b[0] - carrier.a[0]) / carrier.len, uy = (carrier.b[1] - carrier.a[1]) / carrier.len;
        const along = p => (p[0] - carrier.a[0]) * ux + (p[1] - carrier.a[1]) * uy;
        const off = p => Math.abs((p[0] - carrier.a[0]) * uy - (p[1] - carrier.a[1]) * ux);
        let spans = [[0, carrier.len]];
        // Taken up until nothing more joins: a piece that touches only a
        // piece taken on the last pass joins on this one.
        let grew = true;
        while (grew) {
          grew = false;
          segs.forEach((s, si) => {
            if (used[si] || off(s.a) > tol || off(s.b) > tol) return;
            const t0 = Math.min(along(s.a), along(s.b)), t1 = Math.max(along(s.a), along(s.b));
            const hit = spans.filter(sp => t0 <= sp[1] + tol && t1 >= sp[0] - tol);
            if (!hit.length) return;
            used[si] = true;
            grew = true;
            spans = spans.filter(sp => !hit.includes(sp));
            spans.push([Math.min(t0, ...hit.map(sp => sp[0])), Math.max(t1, ...hit.map(sp => sp[1]))]);
          });
        }
        spans.forEach(([t0, t1]) => lines.push({ ...like, closed: false,
          pts: [carrier.a[0] + ux * t0, carrier.a[1] + uy * t0, carrier.a[0] + ux * t1, carrier.a[1] + uy * t1] }));
      });
    });
    return [...lines, ...rest];
  };

  // TAKE THE PICTURE. `paint(ctx, at)` is the caller's own painter, drawing
  // the view in the frame `at.frame` on a sheet `at.width` by `at.height`,
  // everything it sizes in pixels multiplied by `at.scale`; here it is handed
  // the recorder, with the box set as the clip before a line is drawn.
  //
  // What comes back is in INCHES, y up, with the box's centre at the origin.
  const capture = ({ paint, frame, box, width, height }) => {
    const W = window.DraftDxfWriter;
    if (!W || typeof paint !== 'function' || !bigEnough(box)) return null;
    const k = Math.max(1, Math.ceil(FINE_PX_PER_FT / frame.pxPerFt));
    const fine = { ...frame, pxPerFt: frame.pxPerFt * k, x0: frame.x0 * k, y0: frame.y0 * k };
    ['w', 'h', 'marginL', 'marginR', 'marginT', 'marginB'].forEach(key => {
      if (Number.isFinite(frame[key])) fine[key] = frame[key] * k;
    });
    const px = { x: box.px.x * k, y: box.px.y * k, w: box.px.w * k, h: box.px.h * k };
    // `hide`: a nearer wall's fill covers what is behind it, as on the screen.
    const ctx = W.recorder({ width: width * k, height: height * k, layer: 'SNAPSHOT', hide: true });
    ctx.save();
    ctx.beginPath();
    ctx.rect(px.x, px.y, px.w, px.h);
    ctx.clip();
    paint(ctx, { frame: fine, width: width * k, height: height * k, scale: k });
    ctx.restore();
    const cx = px.x + px.w / 2, cy = px.y + px.h / 2;
    const inPerPx = 12 / fine.pxPerFt;
    const entities = tidy(W.mapEntities(ctx.entities,
      ([x, y]) => [(x - cx) * inPerPx, (cy - y) * inPerPx]));
    return { entities, widthFt: box.widthFt, heightFt: box.heightFt };
  };

  // THE PICTURE AS IT IS FILED: the DXF, and enough said about it that the
  // tray can show what it is without opening it.
  const record = ({ id, taken, cutName, kind, drawingName, when }) => {
    const W = window.DraftDxfWriter;
    return {
      version: 1,
      id,
      name: `${cutName} SNAPSHOT`,
      cut: cutName,
      // 'elevation' or 'section', as the view it was taken from.
      kind,
      from: drawingName || '',
      takenAt: when,
      widthFt: Math.round(taken.widthFt * 1e4) / 1e4,
      heightFt: Math.round(taken.heightFt * 1e4) / 1e4,
      units: 'in',
      lines: taken.entities.length,
      dxf: W.write({ entities: taken.entities, layers: [{ name: 'SNAPSHOT', color: 7 }] }),
    };
  };

  // INTO THE TRAY AND OUT OF IT. One JSON file to a picture, named by its id.
  const fileName = id => `${id}.json`;
  // Answers with the tray as it now stands, oldest first.
  const save = async rec => {
    const S = window.SharedFileStore;
    await S.saveNamedFile(new File([JSON.stringify(rec)], fileName(rec.id),
      { type: 'application/json' }), BUCKET);
    const tray = await list();
    const over = tray.splice(0, Math.max(0, tray.length - TRAY_MAX));
    for (const old of over) await S.removeNamedFile(fileName(old.id), BUCKET);
    return tray;
  };
  const list = async () => {
    const S = window.SharedFileStore;
    const files = await S.loadSharedFiles(BUCKET);
    const out = [];
    for (const file of files || []) {
      try {
        const rec = JSON.parse(await file.text());
        if (rec && rec.id && typeof rec.dxf === 'string') out.push(rec);
      } catch { /* a file that is not a picture is not in the tray */ }
    }
    return out.sort((a, b) => String(a.takenAt).localeCompare(String(b.takenAt)));
  };
  const remove = id => window.SharedFileStore.removeNamedFile(fileName(id), BUCKET);

  window.DraftDetailSnapshot = Object.freeze({
    BUCKET, MIN_FT, TRAY_MAX, FINE_PX_PER_FT, boxOf, bigEnough, tidy, capture, record, save, list, remove,
  });
})();
}
