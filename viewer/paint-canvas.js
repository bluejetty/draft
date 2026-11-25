// PLAIN-CANVAS PAINTER -- the house on a 2D canvas, no WebGL, no library.
//
// jb's own Linux PC has no graphics card and WebGL fails there, so this is
// not a fallback in name only: it is the painter that PC will always use.
// Same idea as the 3D ISO view in BONEYARD -- every face projected, sorted
// far to near, and filled flat with a shade from one light -- but with a
// real orbit camera, so the house turns, tips and zooms.
//
// It reads the face list DraftHouseMesh.build made and the shared camera
// (viewer-camera.js); it keeps nothing of its own between frames.
(function () {
  'use strict';
  if (window.DraftPaintCanvas) return;

  const LIGHT = (() => { const v = { x: -0.45, y: 0.8, z: 0.4 }; const l = Math.hypot(v.x, v.y, v.z); return { x: v.x / l, y: v.y / l, z: v.z / l }; })();

  function create(canvas) {
    const ctx = canvas.getContext('2d');
    let model = null;   // { faces, normals, centres }

    function setFaces(faces) {
      const M = window.DraftHouseMesh;
      model = {
        faces,
        normals: faces.map(f => M.normalOf(f.pts)),
        centres: faces.map(f => {
          const c = { x: 0, y: 0, z: 0 };
          f.pts.forEach(p => { c.x += p.x; c.y += p.y; c.z += p.z; });
          return { x: c.x / f.pts.length, y: c.y / f.pts.length, z: c.z / f.pts.length };
        }),
      };
    }

    function render(camera, look) {
      const dpr = window.devicePixelRatio || 1;
      const w = canvas.clientWidth, h = canvas.clientHeight;
      if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
        canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = look.background;
      ctx.fillRect(0, 0, w, h);
      if (!model) return 0;
      const view = window.DraftViewerCamera.basis(camera);
      const focal = (h / 2) / Math.tan(camera.fov * Math.PI / 360);
      const eye = view.eye;
      const list = [];
      const { faces, normals, centres } = model;
      for (let i = 0; i < faces.length; i += 1) {
        const f = faces[i], n = normals[i], c = centres[i];
        // Facing away from the eye: a closed solid's back is hidden anyway.
        const toEye = { x: eye.x - c.x, y: eye.y - c.y, z: eye.z - c.z };
        const facing = n.x * toEye.x + n.y * toEye.y + n.z * toEye.z;
        if (facing < 0 && !f.twoSided) continue;
        const pts = [];
        let behind = false, depth = 0;
        for (const p of f.pts) {
          const q = view.toCamera(p);
          if (q.z < 0.1) { behind = true; break; }
          pts.push(w / 2 + q.x * focal / q.z, h / 2 - q.y * focal / q.z);
          depth += q.z;
        }
        if (behind) continue;
        // Lambert from one light, plus enough ambient that walls in shade
        // still read. A two-sided face seen from behind shades by its back.
        const sn = facing < 0 ? -1 : 1;
        const lam = Math.max(0, sn * (n.x * LIGHT.x + n.y * LIGHT.y + n.z * LIGHT.z));
        const k = look.ambient + (1 - look.ambient) * lam;
        list.push({ pts, depth: depth / f.pts.length, colour: f.colour, k });
      }
      list.sort((a, b) => b.depth - a.depth);   // far first
      ctx.lineJoin = 'round';
      ctx.lineWidth = 0.6;
      for (const item of list) {
        const [r, g, b] = item.colour;
        ctx.fillStyle = `rgb(${Math.round(r * item.k)},${Math.round(g * item.k)},${Math.round(b * item.k)})`;
        ctx.strokeStyle = look.edges ? 'rgba(0,0,0,0.35)' : ctx.fillStyle;
        ctx.beginPath();
        ctx.moveTo(item.pts[0], item.pts[1]);
        for (let j = 2; j < item.pts.length; j += 2) ctx.lineTo(item.pts[j], item.pts[j + 1]);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
      return list.length;
    }

    return { kind: 'plain', setFaces, render, dispose() { model = null; } };
  }

  window.DraftPaintCanvas = Object.freeze({ create });
})();
