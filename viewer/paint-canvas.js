// PLAIN-CANVAS PAINTER -- the house drawn pixel by pixel, no WebGL, no library.
//
// jb's own Linux PC has no graphics card and WebGL fails there, so this is
// not a fallback in name only: it is the painter that PC will always use.
//
// IT KEEPS A DEPTH FOR EVERY PIXEL, like a graphics card does. Phase 1 drew
// whole faces far-to-near (the 3D ISO view's way), and a sort like that is
// wrong whenever a big face and a small one overlap: a fascia board behind a
// roof plane, or a floor deck tucked inside its walls, came out drawn on top
// because its middle happened to be nearer. Here every triangle is filled
// into an ImageData with a depth test per pixel, so the nearest surface
// always wins, whatever order the faces come in. The edges are drawn after,
// each pixel only where it is not hidden.
//
// It reads the face list DraftHouseMesh.build made and the shared camera
// (viewer-camera.js); it keeps nothing of its own between frames but its
// buffers.
(function () {
  'use strict';
  if (window.DraftPaintCanvas) return;

  const LIGHT = (() => { const v = { x: -0.45, y: 0.8, z: 0.4 }; const l = Math.hypot(v.x, v.y, v.z); return { x: v.x / l, y: v.y / l, z: v.z / l }; })();

  const hexRgb = hex => {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
    const v = m ? parseInt(m[1], 16) : 0xdfe6ee;
    return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
  };

  function create(canvas) {
    const ctx = canvas.getContext('2d');
    let tris = null;   // [{ a, b, c, edges:[ab,bc,ca], n, twoSided, colour, mid }]
    let image = null, depth = null, pix = null;

    function setFaces(faces) {
      const M = window.DraftHouseMesh;
      tris = [];
      faces.forEach(f => {
        const n = M.normalOf(f.pts);
        const count = f.pts.length;
        // A triangle edge is one of the face's own edges when its corners
        // are neighbours round the polygon; the rest are cuts, never drawn.
        // A face may also mark some of its own edges as seams (f.seams[i]
        // for the edge from corner i to i+1): a wall face cut in pieces round
        // a window is one face to the eye, so the joins are not drawn.
        const seam = i => !!(f.seams && f.seams[i]);
        const real = (i, j) => {
          const d = Math.abs(i - j);
          if (d === 1) return !seam(Math.min(i, j));
          if (d === count - 1) return !seam(count - 1);
          return false;
        };
        M.triangulate(f.pts).forEach(([i, j, k]) => {
          const a = f.pts[i], b = f.pts[j], c = f.pts[k];
          tris.push({
            a, b, c, n, twoSided: !!f.twoSided, colour: f.colour,
            edges: [real(i, j), real(j, k), real(k, i)],
            mid: { x: (a.x + b.x + c.x) / 3, y: (a.y + b.y + c.y) / 3, z: (a.z + b.z + c.z) / 3 },
          });
        });
      });
    }

    function buffers(W, H) {
      if (!image || image.width !== W || image.height !== H) {
        image = ctx.createImageData(W, H);
        depth = new Float32Array(W * H);
        pix = new Uint32Array(image.data.buffer);
      }
    }

    function render(camera, look) {
      const dpr = window.devicePixelRatio || 1;
      const w = canvas.clientWidth, h = canvas.clientHeight;
      const W = Math.max(1, Math.round(w * dpr)), H = Math.max(1, Math.round(h * dpr));
      if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H; }
      buffers(W, H);
      const [br, bg, bb] = hexRgb(look.background);
      // Little-endian RGBA packed into one 32-bit word.
      pix.fill(((255 << 24) | (bb << 16) | (bg << 8) | br) >>> 0);
      depth.fill(0);   // 1/z: 0 is infinitely far, bigger is nearer
      if (!tris) { ctx.putImageData(image, 0, 0); return 0; }

      const view = window.DraftViewerCamera.basis(camera);
      const focal = (H / 2) / Math.tan(camera.fov * Math.PI / 360);
      const eye = view.eye;
      const near = Math.max(0.1, camera.dist / 500);
      const proj = p => {
        const q = view.toCamera(p);
        return { x: W / 2 + q.x * focal / q.z, y: H / 2 - q.y * focal / q.z, iz: 1 / q.z, z: q.z };
      };
      const lines = [];
      let drawn = 0;

      for (const t of tris) {
        const n = t.n, m = t.mid;
        const facing = n.x * (eye.x - m.x) + n.y * (eye.y - m.y) + n.z * (eye.z - m.z);
        // The inside of a solid is only ever seen through a SECTION cut, and
        // there it is the solid's own body: drawn flat in the cut colour.
        const inside = facing < 0 && !t.twoSided;
        if (inside && !look.section) continue;
        const A = proj(t.a), B = proj(t.b), C = proj(t.c);
        // Behind the eye: left out rather than clipped (only matters with
        // the camera inside the house).
        if (A.z < near || B.z < near || C.z < near) continue;
        const area = (B.x - A.x) * (C.y - A.y) - (B.y - A.y) * (C.x - A.x);
        if (Math.abs(area) < 1e-9) continue;
        const sn = facing < 0 ? -1 : 1;
        const lam = Math.max(0, sn * (n.x * LIGHT.x + n.y * LIGHT.y + n.z * LIGHT.z));
        const k = look.ambient + (1 - look.ambient) * lam;
        const cut = inside ? hexRgb(look.cutColour || '#4a4744') : null;
        const r = cut ? cut[0] : Math.min(255, Math.round(t.colour[0] * k));
        const g = cut ? cut[1] : Math.min(255, Math.round(t.colour[1] * k));
        const b = cut ? cut[2] : Math.min(255, Math.round(t.colour[2] * k));
        const word = ((255 << 24) | (b << 16) | (g << 8) | r) >>> 0;
        const x0 = Math.max(0, Math.floor(Math.min(A.x, B.x, C.x)));
        const x1 = Math.min(W - 1, Math.ceil(Math.max(A.x, B.x, C.x)));
        const y0 = Math.max(0, Math.floor(Math.min(A.y, B.y, C.y)));
        const y1 = Math.min(H - 1, Math.ceil(Math.max(A.y, B.y, C.y)));
        if (x0 > x1 || y0 > y1) continue;
        drawn += 1;
        const inv = 1 / area;
        // Barycentric weights from the edge functions, stepped a pixel at a time.
        const e0dx = (B.y - C.y) * inv, e0dy = (C.x - B.x) * inv;
        const e1dx = (C.y - A.y) * inv, e1dy = (A.x - C.x) * inv;
        const e2dx = (A.y - B.y) * inv, e2dy = (B.x - A.x) * inv;
        const px0 = x0 + 0.5, py0 = y0 + 0.5;
        let w0r = ((B.x - px0) * (C.y - py0) - (B.y - py0) * (C.x - px0)) * inv;
        let w1r = ((C.x - px0) * (A.y - py0) - (C.y - py0) * (A.x - px0)) * inv;
        let w2r = ((A.x - px0) * (B.y - py0) - (A.y - py0) * (B.x - px0)) * inv;
        const EPS = -1e-7;
        for (let y = y0; y <= y1; y += 1) {
          let w0 = w0r, w1 = w1r, w2 = w2r;
          let idx = y * W + x0;
          for (let x = x0; x <= x1; x += 1, idx += 1) {
            if (w0 >= EPS && w1 >= EPS && w2 >= EPS) {
              const iz = w0 * A.iz + w1 * B.iz + w2 * C.iz;
              if (iz > depth[idx]) { depth[idx] = iz; pix[idx] = word; }
            }
            w0 += e0dx; w1 += e1dx; w2 += e2dx;
          }
          w0r += e0dy; w1r += e1dy; w2r += e2dy;
        }
        if (look.edges && !inside) {
          if (t.edges[0]) lines.push(A, B);
          if (t.edges[1]) lines.push(B, C);
          if (t.edges[2]) lines.push(C, A);
        }
      }

      // The edges, darkened in where nothing nearer covers them. A pixel on
      // an edge is shared with the face it bounds, so the test allows a
      // little slack toward the eye.
      const thick = Math.max(1, Math.round(dpr));
      for (let i = 0; i < lines.length; i += 2) {
        const P = lines[i], Q = lines[i + 1];
        const steps = Math.ceil(Math.max(Math.abs(Q.x - P.x), Math.abs(Q.y - P.y)));
        if (!(steps >= 1) || steps > 20000) continue;
        for (let s = 0; s <= steps; s += 1) {
          const f = s / steps;
          const x = Math.floor(P.x + (Q.x - P.x) * f), y = Math.floor(P.y + (Q.y - P.y) * f);
          const iz = P.iz + (Q.iz - P.iz) * f;
          for (let oy = 0; oy < thick; oy += 1) {
            const yy = y + oy;
            if (x < 0 || x >= W || yy < 0 || yy >= H) continue;
            const idx = yy * W + x;
            if (iz < depth[idx] * 0.996) continue;
            const v = pix[idx];
            const rr = Math.round((v & 255) * 0.62);
            const gg = Math.round(((v >>> 8) & 255) * 0.62);
            const bl = Math.round(((v >>> 16) & 255) * 0.62);
            pix[idx] = ((255 << 24) | (bl << 16) | (gg << 8) | rr) >>> 0;
          }
        }
      }
      ctx.putImageData(image, 0, 0);
      return drawn;
    }

    return { kind: 'plain', setFaces, render, dispose() { tris = null; image = null; depth = null; pix = null; } };
  }

  window.DraftPaintCanvas = Object.freeze({ create });
})();
