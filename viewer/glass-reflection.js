// glass-reflection.js -- WHAT A WINDOW REFLECTS (jb, 28 Nov 2026): "a slight
// sky and clouds reflection for upper windows, lower windows green / trees
// reflection (just very subtle where the user bearly notices it)", and "make
// it look very realistic like photo of clouds and trees".
//
// No photo: a picture is DRAWN here, once, from noise -- a sky going pale to
// the horizon, heaped cumulus lit from above, and a tree line of round
// broadleaf crowns and a few spruces in front of a hazier row behind. It is
// laid on the house in FEET: `s` along the wall (world x/z on the pane's own
// run, so the next window along carries on the same scene) and `h` up from
// grade. Trees reach about 10-22 ft, so a main-floor window shows leaves and
// a second-floor window mostly sky with a few tree tops. The picture repeats
// every TILE.ftW feet along; above TILE.ftH it is sky.
//
// Both painters read it: the PLAIN painter per pixel (`at`), WEBGL as a
// texture (`canvas`). Where on it a pane looks depends on the eye
// (`seenFrom`, at the bottom). Exports and PRINT MODEL never see it.
(function () {
  'use strict';

  const FT_W = 120;   // the scene repeats every 120 ft along a wall
  const FT_H = 48;    // and runs from grade to 48 ft up
  const PX_FT = 6;
  const W = FT_W * PX_FT, H = FT_H * PX_FT;

  // ── NOISE: value noise on a lattice that wraps along `s` ───────────────
  function hash(x, y, seed) {
    let n = (x * 374761393 + y * 668265263 + seed * 2147483647) | 0;
    n = (n ^ (n >>> 13)) * 1274126177;
    n ^= n >>> 16;
    return (n >>> 0) / 4294967296;
  }
  const fade = t => t * t * (3 - 2 * t);
  // x wraps every `period` lattice cells, so the picture tiles.
  function noise(x, y, period, seed) {
    const xi = Math.floor(x), yi = Math.floor(y);
    const fx = fade(x - xi), fy = fade(y - yi);
    const x0 = ((xi % period) + period) % period, x1 = (x0 + 1) % period;
    const a = hash(x0, yi, seed), b = hash(x1, yi, seed);
    const c = hash(x0, yi + 1, seed), d = hash(x1, yi + 1, seed);
    return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
  }
  // Octaves over feet: `cell` feet per lattice cell at the first octave,
  // which must divide FT_W so every octave wraps clean.
  function fbm(s, h, cell, octaves, seed, stretchY = 1) {
    let sum = 0, amp = 0.5, norm = 0, c = cell;
    for (let o = 0; o < octaves; o += 1) {
      sum += amp * noise(s / c, (h / c) * stretchY, Math.round(FT_W / c), seed + o * 17);
      norm += amp; amp *= 0.5; c /= 2;
    }
    return sum / norm;
  }
  const clamp01 = v => (v < 0 ? 0 : v > 1 ? 1 : v);
  const smooth = (a, b, v) => fade(clamp01((v - a) / (b - a)));
  const mix = (p, q, t) => [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t, p[2] + (q[2] - p[2]) * t];

  // ── THE TREES: crowns placed along the wall, wrapping at FT_W ──────────
  // A broadleaf tree is a few round lobes heaped on a trunk; a spruce, a
  // cone in tiers of drooping branches.
  function plantTrees(seed, count, hMin, hMax, spruces) {
    const trees = [];
    for (let i = 0; i < count; i += 1) {
      const r = k => hash(i, k, seed);
      const spruce = r(3) < spruces;
      const top = hMin + r(2) * (hMax - hMin);
      const rad = spruce ? 2.2 + r(4) * 1.4 : 3.5 + r(4) * 3.5;
      const c = (i + r(1) * 0.8) * (FT_W / count);
      const lobes = [];
      if (!spruce) {
        // The head, and two or three lobes lower and out to the sides.
        lobes.push({ c, y: top - rad, rx: rad, ry: rad * 1.05 });
        const n = 2 + Math.floor(r(5) * 2);
        for (let k = 0; k < n; k += 1) {
          const side = k % 2 ? 1 : -1, q = rad * (0.6 + 0.35 * r(10 + k));
          lobes.push({ c: c + side * rad * (0.55 + 0.4 * r(20 + k)), y: top - rad * (1.5 + 0.7 * r(30 + k)), rx: q, ry: q });
        }
      }
      trees.push({ c, top, spruce, rad, lobes, base: top - rad * (spruce ? 5 : 3.2) });
    }
    return trees;
  }
  const NEAR = plantTrees(11, 12, 12, 22, 0.25);
  const FAR = plantTrees(29, 22, 8, 14, 0.3);
  const wrapS = (s, c) => { let d = (s - c) % FT_W; if (d > FT_W / 2) d -= FT_W; if (d < -FT_W / 2) d += FT_W; return d; };
  // How far inside the canopy the point is (ft; > 0 inside), how near the
  // top of its lobe (1 at the top, for the light), and the tree.
  function canopy(trees, s, h) {
    let best = -1e9, lit = 0, which = null;
    trees.forEach(t => {
      const dc = wrapS(s, t.c);
      if (Math.abs(dc) > t.rad * 3) return;
      if (t.spruce) {
        const down = t.top - h;
        if (down < 0 || h < t.base) return;
        // Tiers: each a little wider at its foot than the one above.
        const tier = (down / 1.7) % 1;
        const half = (down / 2.6) * (0.78 + 0.32 * tier);
        const d = half - Math.abs(dc);
        if (d > best) { best = d; lit = 0.4 + 0.6 * (1 - tier) * (dc < 0 ? 1 : 0.6); which = t; }
        return;
      }
      t.lobes.forEach(L => {
        const dx = wrapS(s, L.c) / L.rx, dy = (h - L.y) / L.ry;
        const q = Math.sqrt(dx * dx + dy * dy);
        const d = (1 - q) * Math.min(L.rx, L.ry);
        // Top-left lit, like the sun on the house.
        if (d > best) { best = d; lit = clamp01(0.5 + 0.5 * dy - 0.25 * dx); which = t; }
      });
    });
    return { depth: best, lit, tree: which };
  }
  // A trunk under each broadleaf crown, where nothing in front hides it.
  function trunk(trees, s, h) {
    return trees.some(t => !t.spruce && h < t.top - t.rad && Math.abs(wrapS(s, t.c)) < 0.35 + 0.1 * (t.top - h) / t.top);
  }

  const SKY_HIGH = [92, 142, 204];
  const SKY_LOW = [196, 214, 230];
  const CLOUD_LIT = [250, 250, 252];
  const CLOUD_BASE = [170, 180, 196];
  const LEAF_DARK = [34, 54, 34];
  const LEAF_LIT = [116, 146, 78];
  const SPRUCE = [30, 52, 40];
  const FAR_TREES = [104, 128, 118];
  const TRUNK = [62, 56, 46];

  function shadeAt(s, h) {
    // The sky: deep blue up high, hazy pale toward the horizon.
    const up = Math.pow(clamp01((h - 4) / 40), 0.8);
    let col = mix(SKY_LOW, SKY_HIGH, up);
    // Cumulus: a warped billow, flat-ish bottoms, heaped tops; most of them
    // mid-sky. Lit from above: the cloud is brighter where there is less
    // cloud just above the point.
    const wx = s + 6 * fbm(s, h, 24, 2, 5);
    const dens = fbm(wx, h, 24, 5, 41, 2.2);
    const band = smooth(8, 18, h) * (1 - 0.4 * smooth(34, 48, h));
    const cloud = smooth(0.5, 0.68, dens) * band;
    if (cloud > 0) {
      const above = fbm(wx, h + 1.2, 24, 5, 41, 2.2);
      const lit = clamp01(0.55 + (dens - above) * 6);
      col = mix(col, mix(CLOUD_BASE, CLOUD_LIT, lit), cloud);
    }
    // The far row: soft and hazy, a little blue with distance.
    const far = canopy(FAR, s, h);
    const farEdge = far.depth + (fbm(s, h, 1.5, 3, 61) - 0.5) * 1.2;
    if (farEdge > 0) {
      const f = mix(FAR_TREES, mix(FAR_TREES, SKY_LOW, 0.35), far.lit);
      col = mix(col, f, smooth(0, 0.4, farEdge));
    }
    // Low shrubs along the bottom.
    const shrubTop = 3.5 + 3 * fbm(s, 0, 7.5, 3, 83);
    const shrub = shrubTop - h + (fbm(s, h, 1.5, 3, 87) - 0.5) * 1.2;
    if (shrub > 0) col = mix(col, mix(LEAF_DARK, LEAF_LIT, 0.25 + 0.4 * fbm(s, h, 0.75, 3, 89)), smooth(0, 0.4, shrub));
    // The near trees: leafy clumps, lit on top, dark in the gaps.
    if (trunk(NEAR, s, h) && shrub <= 0) col = mix(col, TRUNK, 0.9);
    const near = canopy(NEAR, s, h);
    const leaf = fbm(s, h, 3, 4, 77);
    const edge = near.depth + (leaf - 0.5) * 2.4;
    if (edge > 0) {
      const spruce = near.tree && near.tree.spruce;
      const clump = fbm(s, h, 0.75, 3, 93);
      const lit = clamp01(0.1 + 0.45 * clump + 0.45 * near.lit + 0.6 * (leaf - 0.5));
      const g = spruce ? mix(SPRUCE, mix(SPRUCE, LEAF_LIT, 0.4), lit) : mix(LEAF_DARK, LEAF_LIT, lit);
      // Sky peeks through the outer leaves.
      col = mix(col, g, smooth(0, 0.6, edge) * (edge > 1.5 ? 1 : 0.7 + 0.3 * clump));
    }
    return col;
  }

  let tile = null;
  function make() {
    if (tile) return tile;
    const data = new Uint8ClampedArray(W * H * 4);
    for (let y = 0; y < H; y += 1) {
      const h = FT_H - (y + 0.5) / PX_FT;   // row 0 is the top of the picture
      for (let x = 0; x < W; x += 1) {
        const c = shadeAt((x + 0.5) / PX_FT, h);
        const i = (y * W + x) * 4;
        data[i] = c[0]; data[i + 1] = c[1]; data[i + 2] = c[2]; data[i + 3] = 255;
      }
    }
    tile = { w: W, h: H, ftW: FT_W, ftH: FT_H, pxFt: PX_FT, data };
    return tile;
  }

  // The picture's colour at s feet along, h feet above grade: [r, g, b].
  function at(s, h) {
    const t = make();
    let x = Math.floor(s * PX_FT) % W; if (x < 0) x += W;
    let y = Math.floor((FT_H - h) * PX_FT);
    if (y < 0) y = 0; else if (y >= H) y = H - 1;
    const i = (y * W + x) * 4;
    return [t.data[i], t.data[i + 1], t.data[i + 2]];
  }

  // A canvas of the picture, for a WebGL texture (repeat along s).
  let cv = null;
  function canvas() {
    if (cv) return cv;
    const t = make();
    cv = document.createElement('canvas');
    cv.width = t.w; cv.height = t.h;
    cv.getContext('2d').putImageData(new ImageData(t.data, t.w, t.h), 0, 0);
    return cv;
  }

  // ── WHAT THE PANE SHOWS FROM WHERE YOU STAND (jb, 28 Nov 2026) ───────
  // "make it so when the user walks by the reflections will change based on
  // his angle", and looking up "he should mostly see sky and cloud
  // reflection". A window is a mirror: what you see in it at a point is
  // what lies along your line of sight bounced off the glass. The picture
  // above is taken to stand BACKDROP feet out from the wall, so the bounced
  // ray from the eye through a point on the pane meets it at
  //
  //   s' = s + (s - sEye) * BACKDROP / d     h' = h + (h - hEye) * BACKDROP / d
  //
  // (d = the eye's distance from the glass): the mirror image of the
  // picture, seen through the pane as through a window. Both are straight
  // lines in s and h, so a painter can work them out at the corners and
  // carry them across the pane like any texture. Walk along and s' slides
  // (the trees pass in the glass); look up at a window above you and h'
  // climbs into the sky; look down from on high and it drops to the shrubs.
  // A pane that is not upright (none today) keeps the fixed picture.
  const BACKDROP = 40;
  const NEAREST = 1;   // closer than a foot, as at a foot: no blow-up at the glass
  function seenFrom(refl, n, p0, eye) {
    const ax = refl.ax, gr = refl.grade;
    const sOf = p => p.x * ax.x + p.z * ax.z;
    const len = Math.hypot(n.x, n.y, n.z) || 1;
    if (!eye || Math.abs(n.y) / len > 0.3) return p => [sOf(p), p.y - gr];
    const d = Math.max(NEAREST, Math.abs((n.x * (eye.x - p0.x) + n.y * (eye.y - p0.y) + n.z * (eye.z - p0.z)) / len));
    const k = BACKDROP / d, sE = sOf(eye), hE = eye.y - gr;
    return p => { const s = sOf(p), h = p.y - gr; return [s + (s - sE) * k, h + (h - hE) * k]; };
  }
  // The picture stops at FT_H, and a ray bounced steeply up would read its
  // top row, a flat blue with no clouds in it. So the height is eased in
  // above SKY_FROM: as the ray climbs it passes up through the clouds and
  // only ever nears the top of the picture. Below, unchanged.
  const SKY_FROM = 18;
  const ease = h => (h <= SKY_FROM ? h : SKY_FROM + (FT_H - 1 - SKY_FROM) * (1 - Math.exp(-(h - SKY_FROM) / 40)));

  window.DraftGlassReflection = Object.freeze({ at, canvas, make, seenFrom, ease, FT_W, FT_H, BACKDROP });
})();
