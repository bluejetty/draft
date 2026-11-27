// FINISH TEXTURES IN 3D (jb, 27 Nov 2026) -- step 3 of the finish thickness job.
//
// jb: *"maybe also have TEXTURES on the shapes for 3D like the brick joints
// and siding [laps] etc"*, and asked *"you think you'll have bricks with
// lines in it?"* -- yes. Each finish's surface is shaded from the SAME
// numbers the elevation hatch uses (wall-types.js params, as the house has
// them: brick long / high / joint, siding exposure, board and batten,
// shake exposure, stone sizes), so the 3D brick is the elevation's brick.
//
// ONE FUNCTION, TWO PAINTERS. `shadeAt(finish, s, y, ftPerPx)` answers how
// much light a point on the surface keeps (1 = the finish's own colour,
// less in a joint or under a lap) for a point `s` feet along the wall and `y`
// feet up. The plain painter (jb's PC, no WebGL) asks it per pixel; the WebGL
// painter paints it once into a tile (`tileCanvas`) and repeats the tile.
//
// PAINTED, NOT MODELLED: a brick is not its own 3D piece -- a house of
// separate bricks would be a million faces, too heavy to turn and to export.
//
// AND IT FADES WITH DISTANCE, the way the 2D hatch drops a pattern closer
// than three pixels: `ftPerPx` is how many feet one pixel covers there, and
// a joint narrower than a pixel is drawn as the share of the pixel it
// covers, a pattern finer than a few pixels not at all -- otherwise a far
// wall shimmers with moire instead of reading as brick.
(function () {
  'use strict';
  if (window.DraftFinishTexture) return;

  const hash2 = (a, b) => {
    let h = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  };
  const mod = (v, m) => ((v % m) + m) % m;
  const wrapI = (i, n) => (n ? mod(i, n) : i);
  const param = (finish, key, fallback) => {
    const p = (finish.params || []).find(q => q.key === key);
    return (p ? p.in : fallback) / 12;
  };
  // How much of a pixel a line of half width `hw` covers at distance `d`
  // from its centre line, with a pixel `px` wide.
  const cover = (d, hw, px) => {
    const p = Math.max(px, 1e-6);
    const c = Math.min(1, Math.max(0, (hw + p / 2 - Math.abs(d)) / p));
    return c * Math.min(1, (2 * hw) / p);
  };
  // A pattern repeating every `period` feet fades out below a few pixels.
  const fadeFor = (period, px) => Math.min(1, Math.max(0, (period / Math.max(px, 1e-6) - 2.5) / 2.5));
  const ink = (m, fade) => 1 - (1 - m) * fade;

  // A running-bond grid: brick, ashlar. Returns { cov, tone }.
  const bond = (s, y, long, high, joint, offsetOf, wrap, px) => {
    const row = Math.floor(y / high);
    const yy = y - row * high;
    const dy = Math.min(Math.abs(yy - joint / 2), Math.abs(yy - high - joint / 2));
    const off = offsetOf(wrapI(row, wrap && wrap.rows)) * long;
    const sx = s + off;
    const k = Math.floor(sx / long);
    const xx = sx - k * long;
    const dx = Math.min(Math.abs(xx - joint / 2), Math.abs(xx - long - joint / 2));
    const cov = Math.max(cover(dy, joint / 2, px), cover(dx, joint / 2, px));
    const tone = hash2(wrapI(k, wrap && wrap.cols), wrapI(row, wrap && wrap.rows));
    return { cov, tone };
  };

  // A random-length course: ledgestone, shake. Joints wander inside cells.
  const courses = (s, y, high, cell, joint, wrap, px, salt) => {
    const row = Math.floor(y / high);
    const yy = y - row * high;
    const dy = Math.min(Math.abs(yy - joint / 2), Math.abs(yy - high - joint / 2));
    const r = wrapI(row, wrap && wrap.rows);
    const sx = s + hash2(r, 7 + salt) * cell;
    const k = Math.floor(sx / cell);
    const at = i => (i + 0.5 + (hash2(r, wrapI(i, wrap && wrap.cols) + salt) - 0.5) * 0.7) * cell;
    const dx = Math.min(Math.abs(sx - at(k - 1)), Math.abs(sx - at(k)), Math.abs(sx - at(k + 1)));
    const piece = sx < at(k) ? k : k + 1;
    return { covY: cover(dy, joint / 2, px), covX: cover(dx, joint / 2, px), yy, row,
      tone: hash2(wrapI(piece, wrap && wrap.cols), r + 31) };
  };

  // Rubble: the nearest of a jittered grid of stone centres (Voronoi).
  const rubble = (s, y, size, joint, wrap, px) => {
    const gx = Math.floor(s / size), gy = Math.floor(y / size);
    let d1 = Infinity, d2 = Infinity, best = null;
    for (let j = -1; j <= 1; j += 1) {
      for (let i = -1; i <= 1; i += 1) {
        const cx = gx + i, cy = gy + j;
        const hx = wrapI(cx, wrap && wrap.cols), hy = wrapI(cy, wrap && wrap.rows);
        const px0 = (cx + 0.15 + 0.7 * hash2(hx, hy)) * size;
        const py0 = (cy + 0.15 + 0.7 * hash2(hy + 97, hx + 13)) * size;
        const d = Math.hypot(s - px0, y - py0);
        if (d < d1) { d2 = d1; d1 = d; best = [hx, hy]; } else if (d < d2) d2 = d;
      }
    }
    return { edge: (d2 - d1) / 2, d1, tone: best ? hash2(best[0] + 5, best[1] + 3) : 0.5 };
  };

  // `wrap` (optional) makes the hashes repeat every so many units, for a tile.
  function shadeAt(finish, s, y, ftPerPx, wrap) {
    if (!finish || finish.texture === false) return 1;
    const px = ftPerPx > 0 ? ftPerPx : 0;
    switch (finish.pattern) {
      case 'brick': {
        const joint = param(finish, 'jointIn', 0.375);
        const long = param(finish, 'brickLongIn', 7.625) + joint;
        const high = param(finish, 'brickHighIn', 2.25) + joint;
        const b = bond(s, y, long, high, joint, row => (row % 2) * 0.5, wrap, px);
        const fade = fadeFor(high, px);
        return ink((0.9 + 0.12 * b.tone) * (1 - 0.42 * b.cov), fade);
      }
      case 'ashlar': {
        const joint = param(finish, 'jointIn', 1);
        const long = param(finish, 'stoneLongIn', 16) + joint;
        const high = param(finish, 'stoneHighIn', 8) + joint;
        const b = bond(s, y, long, high, joint, row => hash2(row, 3), wrap, px);
        return ink((0.86 + 0.16 * b.tone) * (1 - 0.45 * b.cov), fadeFor(high, px));
      }
      case 'stacked': {
        const joint = param(finish, 'jointIn', 1) * 0.5;
        const high = param(finish, 'courseIn', 3) + joint;
        const c = courses(s, y, high, 1.1, joint, wrap, px, 0);
        const cov = Math.max(c.covY, c.covX);
        return ink((0.82 + 0.22 * c.tone) * (1 - 0.5 * cov), fadeFor(high, px));
      }
      case 'round':
      case 'field': {
        const joint = param(finish, 'jointIn', finish.pattern === 'field' ? 0.5 : 1);
        const size = param(finish, 'stoneIn', finish.pattern === 'field' ? 12 : 8) + joint;
        const r = rubble(s, y, size, joint, wrap, px);
        const cov = cover(r.edge, joint / 2, px);
        const dome = finish.pattern === 'round' ? 1 - 0.18 * Math.min(1, r.d1 / (size * 0.6)) : 1;
        return ink((0.82 + 0.22 * r.tone) * dome * (1 - 0.5 * cov), fadeFor(size, px));
      }
      case 'lines': {
        // Lap siding: each board's butt throws a thin shadow on the one under.
        const exp = param(finish, 'exposureIn', 4);
        const yy = mod(y, exp);
        const cov = cover(yy - 0.03, 0.03, px);
        return ink(1 - 0.38 * cov - 0.06 * (yy / exp), fadeFor(exp, px));
      }
      case 'batten': {
        const board = param(finish, 'boardIn', 12);
        const batten = param(finish, 'battenIn', 2);
        const xx = mod(s + board / 2, board) - board / 2;   // signed, from the nearest joint
        const edge = Math.abs(Math.abs(xx) - batten / 2);
        const cov = cover(edge, 0.012, px);
        const shade = xx > 0 && Math.abs(xx) > batten / 2 && Math.abs(xx) < batten / 2 + 0.05 ? 0.12 : 0;
        return ink(1 - 0.4 * cov - shade, fadeFor(board, px));
      }
      case 'shake': {
        const exp = param(finish, 'exposureIn', 7);
        const c = courses(s, y, exp, 0.6, 0.025, wrap, px, 11);
        const butt = cover(c.yy - 0.03, 0.03, px);
        const split = c.covX * (c.yy < exp * 0.92 ? 1 : 0);
        return ink((0.88 + 0.16 * c.tone) * (1 - 0.42 * butt) * (1 - 0.35 * split), fadeFor(exp, px));
      }
      case 'stipple': {
        const g = 0.03;
        const n = hash2(wrapI(Math.floor(s / g), wrap && wrap.cols), wrapI(Math.floor(y / g), wrap && wrap.rows));
        return ink(0.9 + 0.12 * n, fadeFor(g * 3, px));
      }
      default:
        return 1;
    }
  }

  // ── A TILE FOR THE WEBGL PAINTER ──────────────────────────────────────
  // The pattern over one repeat, in feet ({ w, h }), and the hash wrap that
  // makes its edges meet. Painted grey on white: the material colour is the
  // face's own, multiplied in by the renderer.
  function tileOf(finish) {
    const P = (k, f) => param(finish, k, f);
    switch (finish && finish.pattern) {
      case 'brick': { const j = P('jointIn', 0.375); const L = P('brickLongIn', 7.625) + j, H = P('brickHighIn', 2.25) + j; return { w: L * 8, h: H * 16, wrap: { cols: 8, rows: 16 } }; }
      case 'ashlar': { const j = P('jointIn', 1); const L = P('stoneLongIn', 16) + j, H = P('stoneHighIn', 8) + j; return { w: L * 6, h: H * 8, wrap: { cols: 6, rows: 8 } }; }
      case 'stacked': { const H = P('courseIn', 3) + P('jointIn', 1) * 0.5; return { w: 1.1 * 8, h: H * 24, wrap: { cols: 8, rows: 24 } }; }
      case 'round': case 'field': { const S = P('stoneIn', finish.pattern === 'field' ? 12 : 8) + P('jointIn', 1); return { w: S * 8, h: S * 8, wrap: { cols: 8, rows: 8 } }; }
      case 'lines': { const E = P('exposureIn', 4); return { w: 2, h: E * 6, wrap: null }; }
      case 'batten': { const B = P('boardIn', 12); return { w: B * 4, h: 2, wrap: null }; }
      case 'shake': { const E = P('exposureIn', 7); return { w: 0.6 * 12, h: E * 12, wrap: { cols: 12, rows: 12 } }; }
      case 'stipple': return { w: 0.03 * 64, h: 0.03 * 64, wrap: { cols: 64, rows: 64 } };
      default: return null;
    }
  }
  function tileCanvas(finish, sizePx = 512) {
    const tile = tileOf(finish);
    if (!tile) return null;
    const c = document.createElement('canvas');
    const W = sizePx, H = Math.max(16, Math.round(sizePx * tile.h / tile.w));
    c.width = W; c.height = Math.min(2048, H);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(c.width, c.height);
    const ftPerPx = tile.w / W;
    for (let j = 0; j < c.height; j += 1) {
      const y = tile.h * (1 - (j + 0.5) / c.height);
      for (let i = 0; i < W; i += 1) {
        const s = tile.w * (i + 0.5) / W;
        const v = Math.max(0, Math.min(255, Math.round(255 * shadeAt(finish, s, y, ftPerPx, tile.wrap))));
        const k = (j * W + i) * 4;
        img.data[k] = v; img.data[k + 1] = v; img.data[k + 2] = v; img.data[k + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    return { canvas: c, w: tile.w, h: tile.h };
  }

  window.DraftFinishTexture = Object.freeze({ shadeAt, tileOf, tileCanvas, hash2 });
})();
