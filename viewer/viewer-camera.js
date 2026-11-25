// THE VIEWER'S CAMERA -- one orbit camera both painters read.
//
// A camera is plain data: { target:{x,y,z}, yaw, pitch, dist, fov }. yaw
// turns round the house (degrees, 0 = looking north along -z), pitch tips
// up and down (degrees above the horizon), dist is feet from the target.
// The mouse, the wheel and the arrow keys change these numbers and nothing
// else, so the WebGL painter and the plain-canvas painter always show the
// same view, and switching painters never jumps.
(function () {
  'use strict';
  if (window.DraftViewerCamera) return;

  const rad = d => d * Math.PI / 180;

  function fit(bounds) {
    const { lo, hi } = bounds;
    const target = { x: (lo.x + hi.x) / 2, y: (lo.y + hi.y) / 2, z: (lo.z + hi.z) / 2 };
    const size = Math.max(hi.x - lo.x, hi.y - lo.y, hi.z - lo.z, 10);
    return { target, yaw: 35, pitch: 25, dist: size * 1.9, fov: 40 };
  }

  function eyeOf(c) {
    const cp = Math.cos(rad(c.pitch)), sp = Math.sin(rad(c.pitch));
    const sy = Math.sin(rad(c.yaw)), cy = Math.cos(rad(c.yaw));
    return { x: c.target.x + c.dist * cp * sy, y: c.target.y + c.dist * sp, z: c.target.z + c.dist * cp * cy };
  }

  // The camera's frame: right, up and forward, and a point mapped into it
  // (x right, y up, z = distance in front of the eye).
  function basis(c) {
    const eye = eyeOf(c);
    let fx = c.target.x - eye.x, fy = c.target.y - eye.y, fz = c.target.z - eye.z;
    const fl = Math.hypot(fx, fy, fz) || 1; fx /= fl; fy /= fl; fz /= fl;
    // right = forward x worldUp
    let rx = -fz, rz = fx; const rl = Math.hypot(rx, rz) || 1; rx /= rl; rz /= rl;
    const ux = -rz * fy, uy = rz * fx - rx * fz, uz = rx * fy;
    return {
      eye,
      right: { x: rx, y: 0, z: rz }, up: { x: ux, y: uy, z: uz }, forward: { x: fx, y: fy, z: fz },
      toCamera(p) {
        const dx = p.x - eye.x, dy = p.y - eye.y, dz = p.z - eye.z;
        return { x: dx * rx + dz * rz, y: dx * ux + dy * uy + dz * uz, z: dx * fx + dy * fy + dz * fz };
      },
    };
  }

  const clampPitch = p => Math.max(-85, Math.min(89, p));

  function orbit(c, dYaw, dPitch) { return { ...c, yaw: (c.yaw + dYaw) % 360, pitch: clampPitch(c.pitch + dPitch) }; }
  function zoom(c, factor) { return { ...c, dist: Math.max(2, Math.min(5000, c.dist * factor)) }; }
  // Slide the target across the screen, in screen pixels at this distance.
  function pan(c, dxPx, dyPx, heightPx) {
    const b = basis(c);
    const feetPerPx = 2 * c.dist * Math.tan(rad(c.fov / 2)) / Math.max(heightPx, 1);
    const sx = -dxPx * feetPerPx, sy = dyPx * feetPerPx;
    return { ...c, target: {
      x: c.target.x + b.right.x * sx + b.up.x * sy,
      y: c.target.y + b.up.y * sy,
      z: c.target.z + b.right.z * sx + b.up.z * sy,
    } };
  }

  window.DraftViewerCamera = Object.freeze({ fit, eyeOf, basis, orbit, zoom, pan });
})();
