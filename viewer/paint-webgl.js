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
    const lambert = side => new THREE.MeshLambertMaterial({
      vertexColors: true, side, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1,
    });
    const backMat = new THREE.MeshBasicMaterial({ color: 0x4a4744, side: THREE.BackSide,
      polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });

    function setFaces(faces) {
      const M = window.DraftHouseMesh;
      [mesh, thin, glass, back, edges].forEach(o => { if (o) { scene.remove(o); o.geometry.dispose(); } });
      const solid = { pos: [], col: [] }, sheet = { pos: [], col: [] }, clear = { pos: [], col: [] }, edgePos = [];
      faces.forEach(f => {
        // Glass is see-through: its own mesh, drawn last, blended.
        const into = f.kind === 'glass' ? clear : f.twoSided ? sheet : solid;
        const tris = M.triangulate(f.pts);
        const [r, g, b] = f.colour.map(v => v / 255);
        tris.forEach(t => t.forEach(i => { const p = f.pts[i]; into.pos.push(p.x, p.y, p.z); into.col.push(r, g, b); }));
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
      glass = new THREE.Mesh(geoOf(clear), new THREE.MeshLambertMaterial({
        vertexColors: true, side: THREE.DoubleSide, transparent: true, opacity: 0.35, depthWrite: false,
      }));
      glass.renderOrder = 2;
      back = new THREE.Mesh(mesh.geometry.clone(), backMat);
      back.visible = false;
      scene.add(mesh, thin, glass, back);
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
      if (back) {
        back.visible = !!look.section;
        if (look.cutColour) backMat.color.set(look.cutColour);
      }
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
      return (mesh ? mesh.geometry.attributes.position.count / 3 : 0) + (thin ? thin.geometry.attributes.position.count / 3 : 0)
        + (glass ? glass.geometry.attributes.position.count / 3 : 0);
    }

    function dispose() {
      [mesh, thin, glass, back, edges].forEach(o => { if (o) o.geometry.dispose(); });
      renderer.dispose();
      if (renderer.forceContextLoss) renderer.forceContextLoss();
    }

    return { kind: 'webgl', setFaces, render, dispose };
  }

  window.DraftPaintWebGL = Object.freeze({ available, create });
})();
