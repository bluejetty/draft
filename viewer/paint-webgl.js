// WEBGL PAINTER -- the same faces through three.js, when the browser has it.
//
// three.js 0.128 is already in vendor/ (the old MODEL.dc.html loads it). Only
// the VIEWER loads it now from the 2D side's point of view: MODEL.html never
// does, and tests/viewer.spec.js fails the build if it ever starts.
//
// It does not own the camera. viewer-camera.js does, and this painter copies
// that camera into a THREE.PerspectiveCamera each frame -- so the mouse works
// the same in both painters and switching between them never jumps.
(function () {
  'use strict';
  if (window.DraftPaintWebGL) return;

  // Can this browser make a WebGL context at all? jb's PC cannot.
  function available() {
    if (!window.THREE) return false;
    try {
      const c = document.createElement('canvas');
      return !!(window.WebGLRenderingContext && (c.getContext('webgl') || c.getContext('experimental-webgl')));
    } catch (e) { return false; }
  }

  function create(canvas) {
    const THREE = window.THREE;
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 20000);
    const ambient = new THREE.AmbientLight(0xffffff, 0.45);
    const sun = new THREE.DirectionalLight(0xffffff, 0.75);
    scene.add(ambient, sun);
    // THREE MESHES FROM ONE LIST. The solids (walls, floors, boards) are
    // closed and wound outward, so only their fronts are drawn; the thin
    // sheets (roof planes, glass, door slabs) are seen from both sides; and
    // with a SECTION on, the INSIDE of every solid is drawn flat in the cut
    // colour -- what you see through a cut is the wall's own body, poché,
    // the same rule the plain painter follows.
    let mesh = null, thin = null, glass = null, back = null, edges = null;
    // THE TEXTURED FINISHES (finish-texture.js): one mesh per finish, its
    // pattern painted once into a tile and repeated; with TEXTURES off the
    // same mesh wears the plain material.
    let textured = [];   // [{ mesh, back, texMat, plainMat }]
    const lambert = side => new THREE.MeshLambertMaterial({
      vertexColors: true, side, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1,
    });
    const backMat = new THREE.MeshBasicMaterial({ color: 0x4a4744, side: THREE.BackSide,
      polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });

    // THE GLASS'S REFLECTION as a texture: the glass colour with a little of
    // the sky and trees (glass-reflection.js, GLASS_REFLECT) mixed in, so
    // the vertex colour is white and the map is the pane. Made once.
    let glassMap = null;
    function glassTexture() {
      const GR = window.DraftGlassReflection, M = window.DraftHouseMesh;
      if (glassMap || !GR) return glassMap;
      const t = GR.make(), src = GR.canvas();
      const cv = document.createElement('canvas');
      cv.width = t.w; cv.height = t.h;
      const cx = cv.getContext('2d');
      cx.fillStyle = `rgb(${M.COLOURS.glass.join(',')})`;
      cx.fillRect(0, 0, t.w, t.h);
      cx.globalAlpha = M.GLASS_REFLECT;
      cx.drawImage(src, 0, 0);
      glassMap = new THREE.CanvasTexture(cv);
      glassMap.wrapS = THREE.RepeatWrapping;
      glassMap.wrapT = THREE.ClampToEdgeWrapping;
      glassMap.anisotropy = 4;
      return glassMap;
    }
    // TEXTURES on: the pane wears the reflection (white vertex colour times
    // the map); off: its flat glass colour, as before.
    let glassReflects = true;
    function glassLook(mat) {
      const map = glassReflects ? glassTexture() : null;
      mat.map = map;
      mat.vertexColors = !map;
      mat.needsUpdate = true;
    }

    // THE REFLECTION FOLLOWS THE EYE (glass-reflection.js seenFrom): each
    // glass corner's place in the picture, worked out again whenever the eye
    // has moved. One function per pane per frame; a house has a few hundred
    // corners of glass at most.
    let glassCorners = [], aimedFrom = null;
    function aimRefl(eye) {
      const GR = window.DraftGlassReflection;
      if (!glass || !GR || !glassReflects || !glassCorners.length) return;
      if (aimedFrom && aimedFrom.x === eye.x && aimedFrom.y === eye.y && aimedFrom.z === eye.z) return;
      aimedFrom = { x: eye.x, y: eye.y, z: eye.z };
      const uv = glass.geometry.getAttribute('uv');
      let face = null, where = null;
      glassCorners.forEach((c, i) => {
        if (!c) return;
        if (c.f !== face) { face = c.f; where = GR.seenFrom(c.f.refl, c.n, c.f.pts[0], eye); }
        const q = where(c.p);
        uv.setXY(i, q[0] / GR.FT_W, GR.ease(q[1]) / GR.FT_H);
      });
      uv.needsUpdate = true;
    }

    function setFaces(faces) {
      const M = window.DraftHouseMesh;
      [mesh, thin, glass, back, edges].forEach(o => { if (o) { scene.remove(o); o.geometry.dispose(); } });
      textured.forEach(t => {
        scene.remove(t.mesh, t.back); t.mesh.geometry.dispose();
        if (t.texMat.map) t.texMat.map.dispose();
        t.texMat.dispose(); t.plainMat.dispose();
      });
      textured = [];
      const solid = { pos: [], col: [] }, sheet = { pos: [], col: [] }, clear = { pos: [], col: [], uv: [], refl: [] }, edgePos = [];
      const WT = window.DraftWallTypes, FT = window.DraftFinishTexture;
      const byFinish = new Map();   // id -> { pos, col, uv, tile }
      faces.forEach(f => {
        const tris = M.triangulate(f.pts);
        const [r, g, b] = f.colour.map(v => v / 255);
        let part = null;
        if (f.tex && f.finish && WT && FT) {
          if (!byFinish.has(f.finish)) {
            const finish = WT.finishById(f.finish);
            byFinish.set(f.finish, { pos: [], col: [], uv: [], finish, tile: FT.tileOf(finish) });
          }
          part = byFinish.get(f.finish);
          if (!part.tile) part = null;
        }
        if (part) {
          const tx = f.tex;
          tris.forEach(t => t.forEach(i => {
            const p = f.pts[i];
            const s = (p.x - tx.ox) * tx.ax.x + (p.z - tx.oz) * tx.ax.z;
            part.pos.push(p.x, p.y, p.z); part.col.push(r, g, b);
            part.uv.push(s / part.tile.w, p.y / part.tile.h);
          }));
        } else {
          // Glass is see-through: its own mesh, drawn last, blended.
          const into = f.kind === 'glass' ? clear : f.twoSided ? sheet : solid;
          tris.forEach(t => t.forEach(i => { const p = f.pts[i]; into.pos.push(p.x, p.y, p.z); into.col.push(r, g, b); }));
          // Glass carries where it sits in the reflected scene
          // (glass-reflection.js), in feet along the wall and up from grade.
          // Which part of it depends on the eye (a pane is a mirror), so
          // the corners are kept and aimRefl() works them out each frame.
          if (into === clear) {
            const n = M.normalOf(f.pts);
            tris.forEach(t => t.forEach(i => { clear.uv.push(0, 0.5); clear.refl.push(f.refl ? { p: f.pts[i], f, n } : null); }));
          }
        }
        for (let i = 0; i < f.pts.length; i += 1) {
          // A seam (an edge where one wall face meets the next piece of the
          // same face, beside a window) is not a line anyone would draw.
          if (f.seams && f.seams[i]) continue;
          const p = f.pts[i], q = f.pts[(i + 1) % f.pts.length];
          edgePos.push(p.x, p.y, p.z, q.x, q.y, q.z);
        }
      });
      const geoOf = part => {
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(part.pos, 3));
        geo.setAttribute('color', new THREE.Float32BufferAttribute(part.col, 3));
        geo.computeVertexNormals();   // non-indexed: one flat normal per triangle
        return geo;
      };
      mesh = new THREE.Mesh(geoOf(solid), lambert(THREE.FrontSide));
      thin = new THREE.Mesh(geoOf(sheet), lambert(THREE.DoubleSide));
      // Glass shows the sky it catches, so it is not shaded like a wall: a
      // window on the shady side stays blue instead of going grey.
      const glassGeo = geoOf(clear);
      glassGeo.setAttribute('uv', new THREE.Float32BufferAttribute(clear.uv, 2));
      glass = new THREE.Mesh(glassGeo, new THREE.MeshBasicMaterial({ color: 0xe0e0e0,
        vertexColors: true, side: THREE.DoubleSide, transparent: true, opacity: window.DraftHouseMesh.GLASS_SHOW, depthWrite: false,
      }));
      glassLook(glass.material);
      glassCorners = clear.refl;
      aimedFrom = null;
      glass.renderOrder = 2;
      back = new THREE.Mesh(mesh.geometry.clone(), backMat);
      back.visible = false;
      scene.add(mesh, thin, glass, back);
      byFinish.forEach(part => {
        if (!part.tile || !part.pos.length) return;   // drawn plain, with the walls
        const geo = geoOf(part);
        geo.setAttribute('uv', new THREE.Float32BufferAttribute(part.uv, 2));
        // A finish with no repeat to paint (a pattern of 'none', or a
        // tile the finish's numbers can't make) is drawn plain.
        const made = FT.tileCanvas(part.finish, 512);
        const plainMat = lambert(THREE.FrontSide);
        let texMat = plainMat;
        if (made && made.canvas) {
          const map = new THREE.CanvasTexture(made.canvas);
          map.wrapS = map.wrapT = THREE.RepeatWrapping;
          map.anisotropy = renderer.capabilities.getMaxAnisotropy ? renderer.capabilities.getMaxAnisotropy() : 1;
          texMat = new THREE.MeshLambertMaterial({ vertexColors: true, map, side: THREE.FrontSide,
            polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
        }
        const m = new THREE.Mesh(geo, texMat);
        const bk = new THREE.Mesh(geo, backMat);
        bk.visible = false;
        scene.add(m, bk);
        textured.push({ mesh: m, back: bk, texMat, plainMat });
      });
      const eg = new THREE.BufferGeometry();
      eg.setAttribute('position', new THREE.Float32BufferAttribute(edgePos, 3));
      edges = new THREE.LineSegments(eg, new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35 }));
      scene.add(edges);
    }

    function render(cam, look) {
      const dpr = window.devicePixelRatio || 1;
      const w = canvas.clientWidth, h = canvas.clientHeight;
      renderer.setPixelRatio(dpr);
      renderer.setSize(w, h, false);
      renderer.setClearColor(new THREE.Color(look.background));
      ambient.intensity = look.ambient;
      sun.intensity = 1 - look.ambient;
      if (edges) edges.visible = !!look.edges;
      if (glass && (look.textures !== false) !== glassReflects) {
        glassReflects = look.textures !== false;
        glassLook(glass.material);
        aimedFrom = null;
      }
      if (back) {
        back.visible = !!look.section;
        if (look.cutColour) backMat.color.set(look.cutColour);
      }
      textured.forEach(t => {
        t.mesh.material = look.textures === false ? t.plainMat : t.texMat;
        t.back.visible = !!look.section;
      });
      const eye = window.DraftViewerCamera.eyeOf(cam);
      aimRefl(eye);
      camera.fov = cam.fov;
      camera.aspect = w / Math.max(h, 1);
      camera.near = Math.max(0.1, cam.dist / 500);
      camera.far = cam.dist * 50 + 1000;
      camera.position.set(eye.x, eye.y, eye.z);
      camera.up.set(0, 1, 0);
      camera.lookAt(cam.target.x, cam.target.y, cam.target.z);
      camera.updateProjectionMatrix();
      // The light rides a little left of and above the eye, like a sun over
      // the viewer's shoulder, so the face turned toward you is never black.
      sun.position.set(eye.x - cam.dist * 0.4, eye.y + cam.dist, eye.z + cam.dist * 0.3);
      renderer.render(scene, camera);
      return (mesh ? mesh.geometry.attributes.position.count / 3 : 0) + (thin ? thin.geometry.attributes.position.count / 3 : 0)
        + (glass ? glass.geometry.attributes.position.count / 3 : 0);
    }

    function dispose() {
      [mesh, thin, glass, back, edges].forEach(o => { if (o) o.geometry.dispose(); });
      textured.forEach(t => { t.mesh.geometry.dispose(); if (t.texMat.map) t.texMat.map.dispose(); });
      textured = [];
      renderer.dispose();
      if (renderer.forceContextLoss) renderer.forceContextLoss();
    }

    return { kind: 'webgl', setFaces, render, dispose };
  }

  window.DraftPaintWebGL = Object.freeze({ available, create });
})();
