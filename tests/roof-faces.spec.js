// Roof FACE polygons from the straight skeleton, and exact section profiles
// by clipping (geometry-2d.js). The old section rule measured height as the
// min over every eave edge's INFINITE line — right on rectangles, but on
// L/T/U footprints a far wing's eave line carved phantom valleys through
// regions its plane never reached, which read as squiggly roof lines on
// diagonal cuts. Faces only ever answer for their own region, and a profile
// is breakpoints-only: dead straight between them at any cut angle.
const { test, expect } = require('@playwright/test');

test.beforeEach(async ({ page }) => {
  await page.goto('/MODEL.dc.html');
  await page.waitForFunction(() => !!window.DraftGeometry2D
    && !!window.DraftGeometry2D.roofFaces);
});

const L_ROOF = {
  points: [{ x: -10, z: -8 }, { x: 10, z: -8 }, { x: 10, z: 2 },
    { x: 2, z: 2 }, { x: 2, z: 8 }, { x: -10, z: 8 }],
  edges: ['eave', 'eave', 'eave', 'eave', 'eave', 'eave'],
  pitch: 4,
};

test('the phantom-valley kill shot: an L tab point reads its true plane height', async ({ page }) => {
  const rise = await page.evaluate(roof => {
    const g = window.DraftGeometry2D;
    const faces = g.roofFaces(roof, g.roofSkeleton(roof));
    const p = { x: -4, z: 2.5 };
    const host = faces.find(face => {
      let inside = false;
      const poly = face.points;
      for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const pi = poly[i], pj = poly[j];
        if ((pi.z > p.z) !== (pj.z > p.z)
          && p.x < (pj.x - pi.x) * (p.z - pi.z) / (pj.z - pi.z) + pi.x) inside = !inside;
      }
      return inside;
    });
    return host ? g.roofFaceRise(host, p, roof.pitch) : null;
  }, L_ROOF);
  // The infinite-line rule said 0.167 here — the east wing's eave line
  // passing 0.5' away as pure fiction. The true surface is 5.5' from the
  // tab's own north eave: 1.833'.
  expect(rise).toBeCloseTo(1.833, 3);
});

test('a 45-degree cut across a hip roof yields a handful of exact vertices, not 240 samples', async ({ page }) => {
  const profile = await page.evaluate(() => {
    const g = window.DraftGeometry2D;
    const roof = {
      points: [{ x: -10, z: -6 }, { x: 10, z: -6 }, { x: 10, z: 6 }, { x: -10, z: 6 }],
      edges: ['eave', 'eave', 'eave', 'eave'], pitch: 4,
    };
    const faces = g.roofFaces(roof, g.roofSkeleton(roof));
    const d = Math.SQRT1_2;
    return g.roofProfile(roof, faces, { x: -12, z: -8 }, { x: 8, z: 12 }, { x: d, z: d });
  });
  // Breakpoints only — the anti-squiggle assertion is the COUNT.
  expect(profile.length).toBeGreaterThanOrEqual(3);
  expect(profile.length).toBeLessThanOrEqual(6);
  expect(profile[0].rise).toBeCloseTo(0, 3);
  expect(profile[profile.length - 1].rise).toBeCloseTo(0, 3);
  const peak = Math.max(...profile.map(pt => pt.rise));
  expect(peak).toBeCloseTo(2, 3); // 6' half-depth x 4/12
});

test('an axis-aligned hip cut is the exact eave-hip-ridge-hip-eave trapezoid', async ({ page }) => {
  const profile = await page.evaluate(() => {
    const g = window.DraftGeometry2D;
    const roof = {
      points: [{ x: -10, z: -6 }, { x: 10, z: -6 }, { x: 10, z: 6 }, { x: -10, z: 6 }],
      edges: ['eave', 'eave', 'eave', 'eave'], pitch: 4,
    };
    const faces = g.roofFaces(roof, g.roofSkeleton(roof));
    return g.roofProfile(roof, faces, { x: -12, z: 0 }, { x: 12, z: 0 }, { x: 1, z: 0 });
  });
  const expected = [[-10, 0], [-4, 2], [4, 2], [10, 0]];
  expect(profile.length).toBe(expected.length);
  expected.forEach(([u, rise], index) => {
    expect(profile[index].u).toBeCloseTo(u, 3);
    expect(profile[index].rise).toBeCloseTo(rise, 3);
  });
});

test('a gable-end cut reads the clean eave-ridge-eave triangle', async ({ page }) => {
  const profile = await page.evaluate(() => {
    const g = window.DraftGeometry2D;
    const roof = {
      points: [{ x: -10, z: -6 }, { x: 10, z: -6 }, { x: 10, z: 6 }, { x: -10, z: 6 }],
      edges: ['eave', 'gable', 'eave', 'gable'], pitch: 6,
    };
    const faces = g.roofFaces(roof, g.roofSkeleton(roof));
    return g.roofProfile(roof, faces, { x: 9.5, z: -7 }, { x: 9.5, z: 7 }, { x: 0, z: 1 });
  });
  const expected = [[-6, 0], [0, 3], [6, 0]];
  expect(profile.length).toBe(expected.length);
  expected.forEach(([u, rise], index) => {
    expect(profile[index].u).toBeCloseTo(u, 3);
    expect(profile[index].rise).toBeCloseTo(rise, 3);
  });
});

test('faces tile the footprint and agree on heights along shared edges', async ({ page }) => {
  const results = await page.evaluate(roof => {
    const g = window.DraftGeometry2D;
    const faces = g.roofFaces(roof, g.roofSkeleton(roof));
    const footprint = Math.abs(roof.points.reduce((sum, pt, index) => {
      const next = roof.points[(index + 1) % roof.points.length];
      return sum + (pt.x * next.z - next.x * pt.z);
    }, 0) / 2);
    const faceSum = faces.reduce((sum, face) => sum + face.area, 0);
    // Any vertex two faces share must get the same height from BOTH planes —
    // the surface is continuous across hips, valleys, and ridges.
    let worst = 0;
    faces.forEach((fa, i) => faces.forEach((fb, j) => {
      if (j <= i) return;
      fa.points.forEach(pa => fb.points.forEach(pb => {
        if (Math.hypot(pa.x - pb.x, pa.z - pb.z) > 1e-4) return;
        worst = Math.max(worst, Math.abs(
          g.roofFaceRise(fa, pa, roof.pitch) - g.roofFaceRise(fb, pb, roof.pitch)));
      }));
    }));
    return { faces: faces.length, footprint, faceSum, worst };
  }, L_ROOF);
  expect(results.faces).toBe(6);
  expect(results.faceSum).toBeCloseTo(results.footprint, 4);
  expect(results.worst).toBeLessThan(1e-6);
});
