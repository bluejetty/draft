// The plan-view snapping and trim maths is pure, so it is exercised directly
// rather than through the drafting UI.
const { test, expect } = require('@playwright/test');

const seg = (x1, z1, x2, z2, y = 0) => ({ start: { x: x1, y, z: z1 }, end: { x: x2, y, z: z2 } });

test.beforeEach(async ({ page }) => {
  await page.goto('/MODEL.dc.html');
  await page.waitForFunction(() => !!window.DraftGeometry2D);
});

test('snap radii scale with zoom so they stay constant on screen', async ({ page }) => {
  const results = await page.evaluate(() => {
    const g = window.DraftGeometry2D;
    return {
      defaultZoom: g.worldPerPixel(25, 600),
      zoomedIn: g.worldPerPixel(5, 600),
      noCanvasHeight: g.worldPerPixel(25, 0),
    };
  });

  expect(results.defaultZoom).toBeCloseTo(50 / 600, 6);
  expect(results.zoomedIn).toBeCloseTo(10 / 600, 6);
  // A canvas that has not been measured yet falls back to 600px rather than
  // dividing by zero and making every snap radius infinite.
  expect(results.noCanvasHeight).toBeCloseTo(50 / 600, 6);
});

test('the nearest vertex wins, and only inside the radius', async ({ page }) => {
  const results = await page.evaluate(() => {
    const g = window.DraftGeometry2D;
    const vertices = [{ x: 0, y: 0, z: 0 }, { x: 2, y: 0, z: 0 }, { x: 10, y: 0, z: 0 }];
    return {
      nearest: g.nearestVertex(vertices, { x: 1.6, y: 0, z: 0 }, 1),
      outOfRange: g.nearestVertex(vertices, { x: 5, y: 0, z: 0 }, 1),
      ignoresElevation: g.nearestVertex([{ x: 0, y: 40, z: 0 }], { x: 0, y: 0, z: 0 }, 1),
      empty: g.nearestVertex([], { x: 0, y: 0, z: 0 }, 1),
    };
  });

  expect(results.nearest).toEqual({ x: 2, y: 0, z: 0 });
  expect(results.outOfRange).toBeNull();
  // Levels stack in y; a snap has to consider the plan position only.
  expect(results.ignoresElevation).toEqual({ x: 0, y: 40, z: 0 });
  expect(results.empty).toBeNull();
});

test('midpoint snapping returns the midpoint of the closest segment', async ({ page }) => {
  const results = await page.evaluate(segments => {
    const g = window.DraftGeometry2D;
    return {
      hit: g.nearestMidpoint(segments, { x: 5.2, y: 0, z: 0.3 }, 1),
      miss: g.nearestMidpoint(segments, { x: 5, y: 0, z: 20 }, 1),
    };
  }, [seg(0, 0, 10, 0), seg(0, 10, 10, 10)]);

  expect(results.hit).toEqual({ x: 5, y: 0, z: 0 });
  expect(results.miss).toBeNull();
});

test('the angle lock takes the nearest 45 degree ray and needs a direction', async ({ page }) => {
  const results = await page.evaluate(() => {
    const g = window.DraftGeometry2D;
    const start = { x: 0, y: 0, z: 0 };
    return {
      nearlyEast: g.lockAngleFor(start, { x: 10, y: 0, z: 1 }),
      nearlyDiagonal: g.lockAngleFor(start, { x: 10, y: 0, z: 9 }),
      // A cursor still on the start point has no direction to lock to yet.
      noDirection: g.lockAngleFor(start, { x: 0, y: 0, z: 0 }),
      projected: g.projectOntoRay(start, 0, { x: 7, y: 3, z: 4 }),
    };
  });

  expect(results.nearlyEast).toBeCloseTo(0, 6);
  expect(results.nearlyDiagonal).toBeCloseTo(Math.PI / 4, 6);
  expect(results.noDirection).toBeNull();
  // Projection keeps the distance along the ray and drops the sideways part.
  expect(results.projected.x).toBeCloseTo(7, 6);
  expect(results.projected.z).toBeCloseTo(0, 6);
});

test('bearings read with North at 90 degrees', async ({ page }) => {
  const results = await page.evaluate(() => {
    const g = window.DraftGeometry2D;
    const start = { x: 0, y: 0, z: 0 };
    return {
      east: g.angleDeg(start, { x: 10, y: 0, z: 0 }),
      north: g.angleDeg(start, { x: 0, y: 0, z: -10 }),
      south: g.angleDeg(start, { x: 0, y: 0, z: 10 }),
      zeroLength: g.angleDeg(start, { x: 0, y: 0, z: 0 }),
    };
  });

  expect(results.east).toBeCloseTo(0, 6);
  expect(results.north).toBe(90);
  expect(results.south).toBe(270);
  expect(results.zeroLength).toBeNull();
});

test('segment intersection reports both parameters and rejects misses', async ({ page }) => {
  const results = await page.evaluate(segments => {
    const g = window.DraftGeometry2D;
    const [cross, other, parallel, apart] = segments;
    return {
      crossing: g.segmentIntersection(cross, other),
      parallel: g.segmentIntersection(cross, parallel),
      beyondTheEnds: g.segmentIntersection(cross, apart),
    };
  }, [seg(0, 0, 10, 0), seg(4, -5, 4, 5), seg(0, 3, 10, 3), seg(40, -5, 40, 5)]);

  expect(results.crossing.x).toBeCloseTo(4, 6);
  expect(results.crossing.z).toBeCloseTo(0, 6);
  expect(results.crossing.t).toBeCloseTo(0.4, 6);
  expect(results.crossing.u).toBeCloseTo(0.5, 6);
  expect(results.parallel).toBeNull();
  // The crossing point lies on the infinite lines but off both segments.
  expect(results.beyondTheEnds).toBeNull();
});

test('trim picks the intersection nearest the click, on the clicked side', async ({ page }) => {
  const results = await page.evaluate(segments => {
    const g = window.DraftGeometry2D;
    const [clicked, ...others] = segments;
    const nearStart = g.nearestIntersection(clicked, others, { x: 1, y: 0, z: 0 });
    const nearEnd = g.nearestIntersection(clicked, others, { x: 9, y: 0, z: 0 });
    return {
      nearStart: { x: nearStart.x, tPoint: nearStart.tPoint },
      nearEnd: { x: nearEnd.x, tPoint: nearEnd.tPoint },
      noneAtAll: g.nearestIntersection(clicked, [], { x: 1, y: 0, z: 0 }),
    };
  }, [seg(0, 0, 10, 0), seg(2, -5, 2, 5), seg(8, -5, 8, 5)]);

  expect(results.nearStart.x).toBeCloseTo(2, 6);
  expect(results.nearStart.tPoint).toBeCloseTo(0.1, 6);
  expect(results.nearEnd.x).toBeCloseTo(8, 6);
  expect(results.nearEnd.tPoint).toBeCloseTo(0.9, 6);
  expect(results.noneAtAll).toBeNull();
});

test('no page keeps its own copy of the plan geometry helpers', async ({ page }) => {
  const source = await page.evaluate(async () => {
    const response = await fetch('/MODEL.dc.html');
    return response.text();
  });

  expect(source).not.toContain('Math.round(raw / (Math.PI / 4))');
  expect(source).not.toContain('const den = (bx-ax)*(dz-cz)');
});
