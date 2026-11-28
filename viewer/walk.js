// THE WALKTHROUGH -- stand in the house at eye height and walk round it.
//
// jb, 28 Nov 2026: "would it be possible to have a 'walkthough where the
// user camera is placed on about 6ft above groundlevel and he can 'walk'
// through the house and rise up using the staircase etc ?" ... "ok go ahead
// lets try it".
//
// WALK, then a click on a floor, a stair, a deck or the ground puts you
// there, the eye 5'-6" over your feet (a 6 ft person's eyes). Then:
//   W / S or the up and down arrows   walk forward and back
//   A / D                             step sideways
//   the left and right arrows         turn
//   drag                              look round, up and down
//   Shift                             walk faster
//   the thumb pad (bottom left)       walk on a tablet; drag elsewhere looks
//   Esc, or WALK again                back to turning the house round
//
// THE HOUSE HOLDS YOU UP AND STOPS YOU. It is read from the same faces the
// painters draw (house-mesh.js), all of them, whichever levels are hidden:
//   - you stand on the highest floor, slab, stair tread, deck or ground
//     under you that you can step onto: a stair's rise (STEP_UP), or a
//     door's sill height off the ground outside (STEP_UP_GROUND), since
//     entry steps are not drawn. Lower than you, you go down to it -- the
//     next tread, or the basement floor if you walk off the stair's side.
//   - walls, their finish, foundation walls, posts and glass stop you, cut
//     at your knees, chest and head, so you pass under a door's head and
//     through its opening, not through the wall beside it or a window over
//     a sill. Doors and garage doors stand open: you walk through them.
//
// The camera is the viewer's own (viewer-camera.js) with the target a foot
// in front of the eye, so both painters, TAKE PHOTO and EXPORT need nothing
// new. While you move, the plain painter draws a half-size picture and
// sharpens it when you stop (viewer.js state.lowRes), so jb's PC keeps up.
(function () {
  'use strict';
  if (window.DraftViewerWalk) return;

  const $ = id => document.getElementById(id);
  const V = () => window.DraftViewer;

  const EYE = 5.5;              // feet over the floor
  const RADIUS = 0.9;           // feet: how close a wall lets you come
  const STEP_UP = 1.0;          // a stair's rise, with room to spare
  const STEP_UP_GROUND = 3.0;   // from grade, up through a door with no steps drawn
  const WALK_FPS = 4.5;         // feet a second
  const RUN_FPS = 11;
  const TURN_DPS = 100;         // degrees a second on the arrow keys
  const RISE_FPS = 7;           // how fast the eye climbs a step
  const FALL_FPS = 16;          // and drops
  const LOOK_DEG_PX = 0.25;     // degrees of look per pixel dragged
  const FOV = 65;
  const LEAD = 1;               // feet from the eye to the camera's target

  const WALK_KINDS = new Set(['floor', 'slab', 'stair', 'ground', 'deck']);
  const BLOCK_KINDS = new Set(['wall', 'finish', 'garageWall', 'foundation', 'glass', 'post']);

  const rad = d => d * Math.PI / 180;

  // ── THE HOUSE AS FLOORS AND WALLS ──────────────────────────────────────
  let index = null;   // { faces, walk:[...], block:[...] }

  function buildIndex(faces) {
    const M = window.DraftHouseMesh;
    const walk = [], block = [];
    faces.forEach(f => {
      if (!f.pts || f.pts.length < 3) return;
      const n = M.normalOf(f.pts);
      const xs = f.pts.map(p => p.x), zs = f.pts.map(p => p.z), ys = f.pts.map(p => p.y);
      const box = { x0: Math.min(...xs), x1: Math.max(...xs), z0: Math.min(...zs), z1: Math.max(...zs) };
      if (WALK_KINDS.has(f.kind) && n.y > 0.6) {
        const p0 = f.pts[0];
        walk.push({ f, n, d: n.x * p0.x + n.y * p0.y + n.z * p0.z, poly: f.pts.map(p => [p.x, p.z]), box, group: f.group, kind: f.kind });
      } else if (BLOCK_KINDS.has(f.kind) && Math.abs(n.y) < 0.25) {
        const hl = Math.hypot(n.x, n.z) || 1;
        const axis = { x: -n.z / hl, z: n.x / hl };   // along the wall, level
        const o = f.pts[0];
        block.push({ pts: f.pts, axis, o, y0: Math.min(...ys), y1: Math.max(...ys), box, nrm: { x: n.x / hl, z: n.z / hl } });
      }
    });
    return { faces, walk, block };
  }
  const ensureIndex = () => {
    const faces = V().state.faces;
    if (!index || index.faces !== faces) index = buildIndex(faces);
    return index;
  };

  const inPoly = (poly, x, z) => {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [xi, zi] = poly[i], [xj, zj] = poly[j];
      if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) inside = !inside;
    }
    return inside;
  };

  // The surface you would stand on at (x, z): the highest one no more than
  // `up` over your feet. null where there is nothing at all (off the world).
  //
  // A surface too high to step onto but under your head is a floor edge you
  // would walk into (a landing's side, a floor over a crawlspace): that is
  // `blocked`, so you are stopped rather than walking on underneath it.
  //
  // Feet are not a point: the surface is looked for under the middle of you
  // and half a foot round, the highest wins, so a sliver of gap between a
  // top tread and the floor's edge is stepped over, not fallen through.
  const FOOT = [[0, 0], [0.5, 0], [-0.5, 0], [0, 0.5], [0, -0.5]];
  function floorAt(x, z, feet, up) {
    let best = null, blocked = false;
    for (const w of ensureIndex().walk) {
      if (x < w.box.x0 - 0.5 || x > w.box.x1 + 0.5 || z < w.box.z0 - 0.5 || z > w.box.z1 + 0.5) continue;
      FOOT.forEach(([ox, oz], i) => {
        const px = x + ox, pz = z + oz;
        if (!inPoly(w.poly, px, pz)) return;
        const y = (w.d - w.n.x * px - w.n.z * pz) / w.n.y;
        if (y > feet + up + 0.01) { if (i === 0 && y < feet + EYE + 0.3) blocked = true; return; }
        if (!best || y > best.y + 1e-6) best = { y, group: w.group, kind: w.kind };
      });
    }
    return best ? { ...best, blocked } : null;
  }

  // The walls round (x, z) at your knee, chest and head, as level segments.
  function wallsNear(x, z, feet, up) {
    const hs = [feet + up + 0.15, feet + 3.2, feet + EYE + 0.2];
    const reach = RADIUS + 1;
    const segs = [];
    for (const b of ensureIndex().block) {
      if (x < b.box.x0 - reach || x > b.box.x1 + reach || z < b.box.z0 - reach || z > b.box.z1 + reach) continue;
      if (b.y1 < hs[0] || b.y0 > hs[2]) continue;
      hs.forEach(h => {
        if (h < b.y0 || h > b.y1) return;
        const us = [];
        const P = b.pts;
        for (let i = 0; i < P.length; i += 1) {
          const a = P[i], c = P[(i + 1) % P.length];
          if ((a.y > h) === (c.y > h)) continue;
          const t = (h - a.y) / (c.y - a.y);
          const px = a.x + (c.x - a.x) * t, pz = a.z + (c.z - a.z) * t;
          us.push((px - b.o.x) * b.axis.x + (pz - b.o.z) * b.axis.z);
        }
        us.sort((p, q) => p - q);
        for (let i = 0; i + 1 < us.length; i += 2) {
          if (us[i + 1] - us[i] < 1e-6) continue;
          segs.push({
            ax: b.o.x + b.axis.x * us[i], az: b.o.z + b.axis.z * us[i],
            bx: b.o.x + b.axis.x * us[i + 1], bz: b.o.z + b.axis.z * us[i + 1], nrm: b.nrm,
          });
        }
      });
    }
    return segs;
  }

  // Push the point (x, z) out of every wall it is closer to than RADIUS.
  function pushOut(x, z, segs, fromX, fromZ) {
    for (let iter = 0; iter < 4; iter += 1) {
      let moved = false;
      for (const s of segs) {
        const dx = s.bx - s.ax, dz = s.bz - s.az;
        const L2 = dx * dx + dz * dz || 1e-9;
        const t = Math.max(0, Math.min(1, ((x - s.ax) * dx + (z - s.az) * dz) / L2));
        const cx = s.ax + dx * t, cz = s.az + dz * t;
        let ox = x - cx, oz = z - cz;
        let d = Math.hypot(ox, oz);
        if (d >= RADIUS) continue;
        if (d < 1e-6) {
          // On the line: out to the side you came from.
          const side = (fromX - cx) * s.nrm.x + (fromZ - cz) * s.nrm.z >= 0 ? 1 : -1;
          ox = s.nrm.x * side; oz = s.nrm.z * side; d = 1e-6;
          x = cx + ox * RADIUS; z = cz + oz * RADIUS;
        } else {
          x = cx + ox / d * RADIUS; z = cz + oz / d * RADIUS;
        }
        moved = true;
      }
      if (!moved) break;
    }
    return { x, z };
  }

  // A wall crossed outright between two points (a fast step, a thin wall).
  function crosses(x0, z0, x1, z1, segs) {
    for (const s of segs) {
      const d1x = x1 - x0, d1z = z1 - z0, d2x = s.bx - s.ax, d2z = s.bz - s.az;
      const den = d1x * d2z - d1z * d2x;
      if (Math.abs(den) < 1e-12) continue;
      const t = ((s.ax - x0) * d2z - (s.az - z0) * d2x) / den;
      const u = ((s.ax - x0) * d1z - (s.az - z0) * d1x) / den;
      if (t > 0 && t <= 1 && u >= 0 && u <= 1) return true;
    }
    return false;
  }

  // ── THE WALKER ─────────────────────────────────────────────────────────
  const walker = { on: false, picking: false, x: 0, z: 0, feet: 0, ground: 0, kind: null, group: null, yaw: 0, pitch: 0, orbit: null };

  // On a stair, a stair's rise. Anywhere else a bigger step: entry steps
  // and the garage's steps up into the house are not drawn, so a sill up
  // to 3 ft is stepped onto.
  const stepUp = () => (walker.kind === 'stair' ? STEP_UP : STEP_UP_GROUND);

  function cameraOf() {
    const eye = { x: walker.x, y: walker.feet + EYE, z: walker.z };
    const cp = Math.cos(rad(walker.pitch)), sp = Math.sin(rad(walker.pitch));
    const sy = Math.sin(rad(walker.yaw)), cy = Math.cos(rad(walker.yaw));
    return {
      target: { x: eye.x - LEAD * cp * sy, y: eye.y - LEAD * sp, z: eye.z - LEAD * cp * cy },
      yaw: walker.yaw, pitch: walker.pitch, dist: LEAD, fov: FOV,
    };
  }

  function levelName(group) {
    const g = (V().state.groups || []).find(x => x.id === group);
    return g ? g.name : group === 'ground' ? 'GROUND' : '';
  }

  function sayWhere() {
    const where = walker.kind === 'ground' ? 'outside, on the ground' : walker.kind === 'stair' ? `on the stairs${levelName(walker.group) ? ` (${levelName(walker.group)})` : ''}` : `on ${levelName(walker.group) || 'the floor'}`;
    V().setStatus(`WALKING ${where}. W/S or arrows walk, A/D step aside, drag to look, Shift goes faster, Esc stops.`);
    document.body.dataset.walkOn = walker.kind || '';
  }

  function show() {
    const v = V();
    v.state.camera = cameraOf();
    v.redraw();
  }

  // Stand at a spot (the click). The eye looks the way the house was seen.
  function standAt(x, y, z, kind, group) {
    walker.x = x; walker.z = z; walker.feet = y; walker.ground = y;
    walker.kind = kind; walker.group = group;
    walker.pitch = 0;
    walker.on = true; walker.picking = false;
    document.body.dataset.walking = '1';
    $('walk-pad').hidden = false;
    $('stage').classList.remove('walk-picking');
    sayWhere();
    show();
  }

  // ── PICKING WHERE TO STAND ─────────────────────────────────────────────
  // A ray from the eye through the pixel, against what is on screen: the
  // nearest face it meets. A floor-like face there is where you stand.
  function pick(px, py) {
    const v = V(), M = window.DraftHouseMesh;
    const st = $('stage');
    const W = st.clientWidth, H = st.clientHeight;
    const b = window.DraftViewerCamera.basis(v.state.camera);
    const focal = (H / 2) / Math.tan(rad(v.state.camera.fov / 2));
    const qx = (px - W / 2) / focal, qy = -(py - H / 2) / focal;
    const d = {
      x: b.forward.x + b.right.x * qx + b.up.x * qy,
      y: b.forward.y + b.right.y * qx + b.up.y * qy,
      z: b.forward.z + b.right.z * qx + b.up.z * qy,
    };
    const o = b.eye;
    let best = null;
    v.state.shown.forEach(f => {
      if (!f.pts || f.pts.length < 3 || f.kind === 'glass') return;
      const n = M.normalOf(f.pts);
      const den = n.x * d.x + n.y * d.y + n.z * d.z;
      if (Math.abs(den) < 1e-9) return;
      const p0 = f.pts[0];
      const t = (n.x * (p0.x - o.x) + n.y * (p0.y - o.y) + n.z * (p0.z - o.z)) / den;
      if (!(t > 0) || (best && t >= best.t)) return;
      const hit = { x: o.x + d.x * t, y: o.y + d.y * t, z: o.z + d.z * t };
      // Inside the polygon: on its own plane, dropped onto the two axes the
      // normal leans least along.
      const ax = Math.abs(n.x), ay = Math.abs(n.y), az = Math.abs(n.z);
      const [u, w] = ay >= ax && ay >= az ? ['x', 'z'] : ax >= az ? ['y', 'z'] : ['x', 'y'];
      if (!inPoly(f.pts.map(p => [p[u], p[w]]), hit[u], hit[w])) return;
      best = { t, hit, f, n };
    });
    if (!best) return null;
    const ok = WALK_KINDS.has(best.f.kind) && best.n.y > 0.6;
    return { ...best.hit, ok, kind: best.f.kind, group: best.f.group };
  }

  function start() {
    const v = V();
    if (!v.state.shown || !v.state.shown.length) return;
    if (walker.on || walker.picking) { stop(); return; }
    v.closeOthers && v.closeOthers('');
    walker.orbit = v.state.camera;
    walker.yaw = v.state.camera.yaw;
    walker.picking = true;
    $('walk').classList.add('lit');
    $('stage').classList.add('walk-picking');
    document.body.dataset.walking = 'pick';
    v.setStatus('WALK: click a spot on a floor, a stair, a deck or the ground to stand there. (Hide a level to reach the one under it.) Esc cancels.');
  }

  function stop() {
    const v = V();
    const was = walker.on || walker.picking;
    walker.on = false; walker.picking = false;
    keys.clear(); pad.active = false;
    $('walk').classList.remove('lit');
    $('walk-pad').hidden = true;
    $('stage').classList.remove('walk-picking');
    document.body.dataset.walking = '';
    if (was && walker.orbit) { v.state.camera = walker.orbit; v.state.lowRes = false; v.redraw(); }
    if (was) v.setStatus(`${v.state.name}: turning the house round again.`);
  }

  // ── MOVING ─────────────────────────────────────────────────────────────
  const keys = new Set();
  const pad = { active: false, id: null, cx: 0, cy: 0, dx: 0, dy: 0 };
  let last = 0, ticking = false, sharpen = null;

  const moving = () => keys.has('fwd') || keys.has('back') || keys.has('left') || keys.has('right') || keys.has('turnL') || keys.has('turnR')
    || (pad.active && (Math.abs(pad.dx) > 0.08 || Math.abs(pad.dy) > 0.08)) || Math.abs(walker.feet - walker.ground) > 0.005;

  function blur() {
    const v = V();
    v.state.lowRes = true;
    clearTimeout(sharpen);
    sharpen = setTimeout(() => { v.state.lowRes = false; v.redraw(); }, 180);
  }

  // One step of dt seconds. Exposed for the spec, which walks without a clock.
  function step(dt) {
    if (!walker.on) return;
    const was = `${walker.kind}|${walker.group}`;
    const run = keys.has('run');
    const speed = run ? RUN_FPS : WALK_FPS;
    if (keys.has('turnL')) walker.yaw = (walker.yaw + TURN_DPS * dt) % 360;
    if (keys.has('turnR')) walker.yaw = (walker.yaw - TURN_DPS * dt + 360) % 360;
    let f = (keys.has('fwd') ? 1 : 0) - (keys.has('back') ? 1 : 0);
    let s = (keys.has('right') ? 1 : 0) - (keys.has('left') ? 1 : 0);
    if (pad.active) { f += -pad.dy; s += pad.dx; }
    const mag = Math.hypot(f, s);
    if (mag > 1) { f /= mag; s /= mag; }
    const sy = Math.sin(rad(walker.yaw)), cy = Math.cos(rad(walker.yaw));
    // Forward is the way the eye looks, level; right is a quarter turn round.
    const fx = -sy, fz = -cy, rx = cy, rz = -sy;
    let dist = Math.hypot(f, s) * speed * dt;
    const n = Math.max(1, Math.ceil(dist / 0.25));
    for (let i = 0; i < n && dist > 0; i += 1) {
      const k = speed * dt / n;
      const tx = walker.x + (fx * f + rx * s) * k, tz = walker.z + (fz * f + rz * s) * k;
      const up = stepUp();
      const segs = wallsNear(tx, tz, walker.feet, up);
      const q = pushOut(tx, tz, segs, walker.x, walker.z);
      if (crosses(walker.x, walker.z, q.x, q.z, segs)) break;
      const under = floorAt(q.x, q.z, walker.feet, up);
      if (!under || under.blocked) break;   // the edge of the world, or a floor's edge: stay put
      walker.x = q.x; walker.z = q.z;
      walker.ground = under.y; walker.kind = under.kind; walker.group = under.group;
    }
    // Where you stand now, even without a step (a level shown again, say).
    const under = floorAt(walker.x, walker.z, walker.feet, stepUp());
    if (under) { walker.ground = under.y; walker.kind = under.kind; walker.group = under.group; }
    if (walker.ground > walker.feet) walker.feet = Math.min(walker.ground, walker.feet + RISE_FPS * dt);
    else if (walker.ground < walker.feet) walker.feet = Math.max(walker.ground, walker.feet - FALL_FPS * dt);
    if (`${walker.kind}|${walker.group}` !== was) sayWhere();
  }

  function tick(now) {
    ticking = false;
    if (!walker.on) return;
    const dt = Math.min(0.06, Math.max(0, (now - last) / 1000));
    last = now;
    step(dt);
    blur();
    show();
    if (moving()) { ticking = true; requestAnimationFrame(tick); }
  }
  function go() {
    if (ticking || !walker.on) return;
    ticking = true;
    last = performance.now();
    requestAnimationFrame(tick);
  }

  const KEYMAP = {
    KeyW: 'fwd', ArrowUp: 'fwd', KeyS: 'back', ArrowDown: 'back',
    KeyA: 'left', KeyD: 'right', ArrowLeft: 'turnL', ArrowRight: 'turnR',
    ShiftLeft: 'run', ShiftRight: 'run',
  };

  function wire() {
    const stage = $('stage');
    $('walk').addEventListener('click', start);

    // Keys: caught before the viewer's own (arrows turn the house, F fits).
    window.addEventListener('keydown', e => {
      if (!walker.on && !walker.picking) return;
      if (e.target.closest && e.target.closest('input,select,textarea')) return;
      if (e.key === 'Escape') { stop(); e.preventDefault(); e.stopPropagation(); return; }
      if (!walker.on) return;
      const k = KEYMAP[e.code];
      if (!k) { if (/^(f|F|Home|\+|=|-)$/.test(e.key)) e.stopPropagation(); return; }
      keys.add(k);
      e.preventDefault(); e.stopPropagation();
      go();
    }, true);
    window.addEventListener('keyup', e => {
      const k = KEYMAP[e.code];
      if (k) keys.delete(k);
    }, true);
    window.addEventListener('blur', () => keys.clear());

    // The mouse: caught on the stage before the viewer's orbit drag.
    let drag = null;
    const onUi = e => !!(e.target.closest && e.target.closest('.panel, #embed-bar, #pad, #pad-tab, #bone-foot, #walk-pad'));
    stage.addEventListener('pointerdown', e => {
      if (!walker.on && !walker.picking) return;
      if (onUi(e)) return;
      e.stopPropagation();
      drag = { x: e.clientX, y: e.clientY, id: e.pointerId, moved: false };
      try { stage.setPointerCapture(e.pointerId); } catch (err) { /* gone */ }
    }, true);
    stage.addEventListener('pointermove', e => {
      if (!drag || drag.id !== e.pointerId) return;
      e.stopPropagation();
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (Math.abs(dx) + Math.abs(dy) > 3) drag.moved = true;
      if (!walker.on) return;
      drag.x = e.clientX; drag.y = e.clientY;
      walker.yaw = (walker.yaw - dx * LOOK_DEG_PX + 360) % 360;
      walker.pitch = Math.max(-80, Math.min(80, walker.pitch + dy * LOOK_DEG_PX));
      blur();
      show();
    }, true);
    const up = e => {
      if (!drag || drag.id !== e.pointerId) return;
      e.stopPropagation();
      const was = drag;
      drag = null;
      if (walker.picking && !was.moved) {
        const r = stage.getBoundingClientRect();
        const hit = pick(e.clientX - r.left, e.clientY - r.top);
        if (hit && hit.ok) standAt(hit.x, hit.y, hit.z, hit.kind, hit.group);
        else V().setStatus(hit ? 'That is not something to stand on: click a floor, a stair, a deck or the ground. (Hide a level to reach the one under it.)' : 'Nothing there: click a floor, a stair, a deck or the ground.', true);
      }
    };
    stage.addEventListener('pointerup', up, true);
    stage.addEventListener('pointercancel', up, true);
    stage.addEventListener('wheel', e => { if (walker.on && !onUi(e)) { e.stopPropagation(); e.preventDefault(); } }, { capture: true, passive: false });
    stage.addEventListener('touchstart', e => { if (walker.on) e.stopPropagation(); }, { capture: true, passive: true });
    stage.addEventListener('touchmove', e => { if (walker.on) e.stopPropagation(); }, { capture: true, passive: true });

    // The thumb pad: push the knob the way to walk.
    const padEl = $('walk-pad'), knob = $('walk-knob');
    const R = 44;
    const setKnob = () => { knob.style.transform = `translate(${pad.dx * R}px, ${pad.dy * R}px)`; };
    padEl.addEventListener('pointerdown', e => {
      e.stopPropagation(); e.preventDefault();
      const r = padEl.getBoundingClientRect();
      pad.active = true; pad.id = e.pointerId; pad.cx = r.left + r.width / 2; pad.cy = r.top + r.height / 2;
      try { padEl.setPointerCapture(e.pointerId); } catch (err) { /* gone */ }
      padMove(e);
    });
    const padMove = e => {
      if (!pad.active || e.pointerId !== pad.id) return;
      e.stopPropagation();
      let dx = (e.clientX - pad.cx) / R, dy = (e.clientY - pad.cy) / R;
      const m = Math.hypot(dx, dy);
      if (m > 1) { dx /= m; dy /= m; }
      pad.dx = dx; pad.dy = dy;
      setKnob();
      go();
    };
    padEl.addEventListener('pointermove', padMove);
    const padUp = e => {
      if (e.pointerId !== pad.id) return;
      e.stopPropagation();
      pad.active = false; pad.dx = 0; pad.dy = 0; setKnob();
    };
    padEl.addEventListener('pointerup', padUp);
    padEl.addEventListener('pointercancel', padUp);

    // A new house, or none: stop walking.
    window.addEventListener('draft-viewer-shown', () => {
      const v = V();
      $('walk').disabled = !(v.state.shown && v.state.shown.length);
      if ((walker.on || walker.picking) && index && index.faces !== v.state.faces) { walker.orbit = null; stop(); }
    });
  }

  function boot() {
    if (!$('walk') || !V()) return;
    if (document.body.dataset.embed === '1') { $('walk').hidden = true; return; }
    wire();
  }

  window.DraftViewerWalk = Object.freeze({
    EYE, RADIUS, STEP_UP, STEP_UP_GROUND,
    start, stop, standAt, step, pick, floorAt, wallsNear,
    keys, walker,
  });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
