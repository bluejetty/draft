// THE OBJ / PROP WINDOW'S VIEWS OF ONE PIECE (Movie, 24 Oct): "i'd like to
// be able to click on the FIXTURES / CABINETS and items like that in a
// different window ... then open up the window with the top and side views
// and properties to change down below" -- "call that tab OBJ / PROP".
//
// TOP is the plan symbol, drawn by the page's own painter through `topFrame`
// so the window and the sheet cannot draw a piece two ways. FRONT, LEFT and
// RIGHT are Movie's own traced faces (fixture-profiles.js, the ones a section
// stands in a room), fitted to the piece's real width and depth the way
// cut-view.js fits them: a stretching face scaled, a CABINET run tiled in
// 24" bays. A kind with no traced face draws its plain box at its size.
//
// Standing at the piece facing it, its LEFT is on your left. Seen from that
// side its front is on the viewer's left and the wall on the right; from the
// RIGHT the wall is on the left. A side face's `a` runs out from the wall.
//
// Pure: no page state, so the harness can hold it.
if (!window.DraftObjViews) {
(() => {
  // HOW TALL A PIECE STANDS when it has no traced face to say so.
  const PLAIN_HEIGHT_IN = Object.freeze({ fridge: 70, fridge30: 66, tallcab: 82.75, pantry: 84, closet: 84,
    shower: 80, stall: 80, tub: 20, toilet: 30, washer: 38, dryer: 38 });
  const plainHeightIn = kind => PLAIN_HEIGHT_IN[kind] || 36;

  // ONE FACE, IN INCHES: x across the face from 0 to its width, h up from the
  // floor. `view` is 'front', 'left' or 'right'.
  function faceOf(fixture, view, FP) {
    const widthIn = (Number(fixture?.width) || 0) * 12;
    const depthIn = (Number(fixture?.depth) || 0) * 12;
    const spanIn = view === 'front' ? widthIn : depthIn;
    const profile = FP && FP.profileFor(fixture?.kind, view === 'front' ? 'front' : 'side');
    if (!profile) {
      const h = plainHeightIn(fixture?.kind);
      const box = [0, 0, spanIn, 0, spanIn, h, 0, h, 0, 0];
      return { widthIn: spanIn, heightIn: h, sil: [box], polys: [box], traced: false };
    }
    const stretch = FP.stretches(fixture.kind);
    const map = [];
    if (view === 'front') {
      const tile = FP.tileIn ? FP.tileIn(fixture.kind) : null;
      const n = tile ? Math.max(1, Math.round(widthIn / tile)) : 1;
      const bayIn = widthIn / n;
      const k = stretch ? bayIn / profile.w : 1;
      for (let i = 0; i < n; i += 1) map.push(a => (i + 0.5) * bayIn + a * k);
    } else {
      const k = stretch ? depthIn / profile.w : 1;
      // From the RIGHT the wall is on the left; from the LEFT, mirrored.
      map.push(view === 'right' ? (a => a * k) : (a => depthIn - a * k));
    }
    const each = flats => map.flatMap(at => flats.map(flat => {
      const out = [];
      for (let i = 0; i < flat.length; i += 2) out.push(at(flat[i]), flat[i + 1]);
      return out;
    }));
    const polys = each(profile.polys || []);
    const heightIn = Math.max(1, ...polys.flatMap(flat => flat.filter((v, i) => i % 2 === 1)));
    return { widthIn: spanIn, heightIn, sil: each(profile.sil || []), polys, traced: true };
  }

  // DRAWN IN A BOX on the window: fitted whole with a margin, the floor line
  // under it, its width under that and its height beside it in inches.
  const MARGIN_PX = 14;
  function drawFace(ctx, face, box, ink) {
    const w = Math.max(face.widthIn, 1), h = Math.max(face.heightIn, 1);
    const s = Math.min((box.w - MARGIN_PX * 2) / w, (box.h - MARGIN_PX * 2) / h);
    const x0 = box.x + (box.w - w * s) / 2, y0 = box.y + (box.h + h * s) / 2;
    const X = a => x0 + a * s, Y = v => y0 - v * s;
    const trace = flats => {
      ctx.beginPath();
      flats.forEach(flat => {
        for (let i = 0; i < flat.length; i += 2) {
          if (i === 0) ctx.moveTo(X(flat[i]), Y(flat[i + 1])); else ctx.lineTo(X(flat[i]), Y(flat[i + 1]));
        }
      });
    };
    ctx.save();
    ctx.lineWidth = 1;
    ctx.strokeStyle = ink.line;
    ctx.fillStyle = ink.ground;
    trace(face.sil); ctx.fill();
    trace(face.polys); ctx.stroke();
    // THE FLOOR it stands on.
    ctx.beginPath(); ctx.moveTo(box.x + 4, Y(0)); ctx.lineTo(box.x + box.w - 4, Y(0)); ctx.stroke();
    ctx.fillStyle = ink.text;
    ctx.font = "600 9px 'Barlow Condensed', system-ui, sans-serif";
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.fillText(`${Math.round(face.widthIn)}`, X(w / 2), Y(0) + 2);
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText(`${Math.round(face.heightIn)}`, X(w) + 3, Y(h / 2));
    ctx.restore();
    return { s, x0, y0 };
  }

  // THE TOP VIEW'S MAPPING: world to the box, the piece's own wall along the
  // top of it and its front toward the bottom, fitted whole. `geo` is
  // fixture-geometry's; the page paints through the returned toS.
  function topFrame(geo, box, padFt = 0.25) {
    const f = geo.frame;
    const o = f.at(0, 0);
    const dir = geo.frontOff >= geo.backOff ? 1 : -1;
    const a0 = geo.alongStart - padFt, a1 = geo.alongEnd + padFt;
    const c0 = geo.backOff, c1 = geo.frontOff + dir * padFt;
    const lenA = Math.max(a1 - a0, 0.1), lenC = Math.max(Math.abs(c1 - c0), 0.1);
    const s = Math.min((box.w - MARGIN_PX * 2) / lenA, (box.h - MARGIN_PX * 2) / lenC);
    const x0 = box.x + (box.w - lenA * s) / 2, y0 = box.y + (box.h - lenC * s) / 2;
    const toS = p => {
      const rx = p.x - o.x, rz = p.z - o.z;
      const along = rx * f.ux + rz * f.uz, across = rx * f.nx + rz * f.nz;
      return { x: x0 + (along - a0) * s, y: y0 + (across - c0) * dir * s };
    };
    return { toS, s };
  }

  window.DraftObjViews = Object.freeze({ faceOf, drawFace, topFrame, plainHeightIn });
})();
}
