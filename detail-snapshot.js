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

  // TAKE THE PICTURE. `paint(ctx)` is the caller's own painter, drawing the
  // view at `frame` onto whatever it is handed; here it is handed the
  // recorder, with the box set as the clip before a line is drawn.
  //
  // What comes back is in INCHES, y up, with the box's centre at the origin.
  const capture = ({ paint, frame, box, width, height }) => {
    const W = window.DraftDxfWriter;
    if (!W || typeof paint !== 'function' || !bigEnough(box)) return null;
    // `hide`: a nearer wall's fill covers what is behind it, as on the screen.
    const ctx = W.recorder({ width, height, layer: 'SNAPSHOT', hide: true });
    ctx.save();
    ctx.beginPath();
    ctx.rect(box.px.x, box.px.y, box.px.w, box.px.h);
    ctx.clip();
    paint(ctx);
    ctx.restore();
    const cx = box.px.x + box.px.w / 2, cy = box.px.y + box.px.h / 2;
    const inPerPx = 12 / frame.pxPerFt;
    const entities = W.mapEntities(ctx.entities,
      ([x, y]) => [(x - cx) * inPerPx, (cy - y) * inPerPx]);
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
    BUCKET, MIN_FT, TRAY_MAX, boxOf, bigEnough, capture, record, save, list, remove,
  });
})();
}
