// THE UNDERSIDE OF THE FRONT GABLE'S RAKE BOARD SHOWS, STUBS OR NO STUBS.
//
// jb, 19 Nov 2026, E1 of the stepped-front house (proto/repro-jb-gable-
// stubs.draft, jb's own file; planTurn 3, so jb's E1 is the harness's E4):
// "the underside of the roof gable also isn't showing". The small front
// gable (roof-64) has an 18" stucco rake board standing 2 ft out past the
// gable wall, and jb had run 1FT WALL stubs out to the rake at both sides
// of the 2ND FL and MAIN FL.
//
// cut-view.js gableInfills asked whether a wall's top reached the roof's
// TOP at each station of the rake; a gable wall stops under the board, at
// its foot, so it never did. On an ordinary gable the run was snapped away
// by the wall beside it; with the stubs' ends at the rake on both sides the
// run between them became a gable infill AT the rake, flush and in the
// board's finish, and the seam rule then took the board's underside away
// the whole way up. Covered now means reaching the board's foot.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const H = require('../proto/harness-env.js');

const FILE = path.join(__dirname, '..', 'proto', 'repro-jb-gable-stubs.draft');
const STUBS = ['wall-69', 'wall-80', 'wall-81', 'wall-82'];

const paint = saved => {
  const win = H.loadDraftModules();
  win.DraftWallTypes.adoptDrawing(saved);   // the 1FT WALL is a made type
  const env = H.buildEnv(win, saved);
  const cut = H.standardElevationCuts(env).find(c => c.id === 'E4');
  return H.paintElevation(win, env, cut, {});
};
// The heavy foot line of roof-64's rake, as [lo u, hi u] runs: the board's
// foot is the 2.25 pen, sloped, above the 2ND FL plate.
const footRuns = v => {
  const out = [];
  v.strokes.forEach(s => {
    if (Math.abs(s.w - 2.25) > 0.01) return;
    s.pts.forEach((p, i) => {
      if (!i || p.move) return;
      const q = s.pts[i - 1];
      if (Math.abs(p.u - q.u) > 0.05 && Math.abs(p.e - q.e) > 0.05 && Math.min(p.e, q.e) > 16 && Math.max(p.u, q.u) <= 13.01)
        out.push([Math.min(p.u, q.u), Math.max(p.u, q.u)]);
    });
  });
  return out;
};
const covers = (runs, u) => runs.some(([lo, hi]) => lo <= u && hi >= u);

test('E1 (jb): the front gable\'s rake board shows its underside with the 1FT stubs run out to it', () => {
  const saved = JSON.parse(fs.readFileSync(FILE, 'utf8'));
  const runs = footRuns(paint(saved));
  // Up both slopes, peak to the stubs.
  for (const u of [2, 4, 6, 7, 9, 11]) expect(covers(runs, u), `u ${u}: ${JSON.stringify(runs)}`).toBe(true);
});

test('E1 (jb): and without the stubs it is drawn the same way up the slopes', () => {
  const saved = JSON.parse(fs.readFileSync(FILE, 'utf8'));
  saved.walls = saved.walls.filter(w => !STUBS.includes(w.id));
  const runs = footRuns(paint(saved));
  for (const u of [2, 4, 6, 7, 9, 11]) expect(covers(runs, u), `u ${u}: ${JSON.stringify(runs)}`).toBe(true);
});
