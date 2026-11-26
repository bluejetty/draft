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
    let mesh = null, edges = null;

    function setFaces(faces) {
      const M = window.DraftHouseMesh;
      if (mesh) { scene.remove(mesh); mesh.geometry.dispose(); }
      if (edges) { scene.remove(edges); edges.geometry.dispose(); }
      const pos = [], col = [], edgePos = [];
      faces.forEach(f => {
        const tris = M.triangulate(f.pts);
        const [r, g, b] = f.colour.map(v => v / 255);
        tris.forEach(t => t.forEach(i => { const p = f.pts[i]; pos.push(p.x, p.y, p.z); col.push(r, g, b); }));
        for (let i = 0; i < f.pts.length; i += 1) {
          // A seam (an edge where one wall face meets the next piece of the
          // same face, beside a window) is not a line anyone would draw.
          if (f.seams && f.seams[i]) continue;
          const p = f.pts[i], q = f.pts[(i + 1) % f.pts.length];
          edgePos.push(p.x, p.y, p.z, q.x, q.y, q.z);
        }
      });
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
      geo.computeVertexNormals();   // non-indexed: one flat normal per triangle
      mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({
        vertexColors: true, side: THREE.DoubleSide,
        polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1,
      }));
      scene.add(mesh);
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
      const eye = window.DraftViewerCamera.eyeOf(cam);
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
      return mesh ? mesh.geometry.attributes.position.count / 3 : 0;
    }

    function dispose() {
      if (mesh) mesh.geometry.dispose();
      if (edges) edges.geometry.dispose();
      renderer.dispose();
      if (renderer.forceContextLoss) renderer.forceContextLoss();
    }

    return { kind: 'webgl', setFaces, render, dispose };
  }

  window.DraftPaintWebGL = Object.freeze({ available, create });
})();
