// jb, 27 Nov 2026, on TIMBERHOUSE: "can you figure out what that little
// notch is?" Two short stray lines on the elevations, each a hair off the
// corner it belongs to. Fixture: jb's own file (planTurn 3, so his E1 is
// this bench's E4 and his E3 is E2).
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const H = require('../proto/harness-env.js');

const HOUSE = JSON.parse(fs.readFileSync(
  path.join(__dirname, '..', 'proto', 'repro-jb-timberhouse-notches.draft'), 'utf8'));
const paint = id => {
  const win = H.loadDraftModules();
  const env = H.buildEnv(win, HOUSE);
  const cut = H.standardElevationCuts(env).find(c => c.id === id);
  return H.paintElevation(win, env, cut, { finishes: true });
};
// Every plumb unclipped segment overlapping [e0, e1], as its u.
const plumbs = (view, w, e0, e1) => {
  const out = [];
  view.strokes.filter(s => !s.clip && s.w === w).forEach(s => s.pts.forEach((p, i) => {
    if (!i || p.move) return;
    const q = s.pts[i - 1];
    if (Math.abs(p.u - q.u) > 1e-6 || Math.max(p.e, q.e) < e0 || Math.min(p.e, q.e) > e1) return;
    out.push(+p.u.toFixed(3));
  }));
  return out;
};

test('his E1: the floor strip corner line stands on the jog corner above it', () => {
  // The stucco front stops at u 13, the siding body set back a foot carries
  // on. A partition ending at 12.958 used to claim the joint, and the line
  // through the floor strip stood 5/8" inside the corner: a notch at 0'-0".
  const view = paint('E4');
  const strip = plumbs(view, 1.25, -1.2, 0);
  expect(strip).toContain(13);
  expect(strip.filter(u => u > 12.5 && u < 13.5)).toEqual([13]);
});

test('his E3: the 18" fascia\'s end is drawn on the wall corner, not 7/8" inside it', () => {
  // Gable end, 0" overhang: the side eave seen end on is a point at the
  // corner, one silhouette sample past where the run stopped.
  const view = paint('E2');
  const near = plumbs(view, 1.5, 16.4, 17.9).filter(u => Math.abs(u) < 0.5 || Math.abs(u + 19.5) < 0.5);
  expect(near.length).toBeGreaterThan(0);
  near.forEach(u => expect([0, -19.5]).toContain(u));
});

// jb, 27 Nov 2026, his E2 (this bench's E1) at the 2' stucco column beside
// the siding: "something funny with the sill plate maybe? not sure the floor
// area shaded properly", then "the column should be in front" of the deck.
const SEAM_INK = '#1d1f20';
const fillsOver = (view, u0, u1, top) => (view.modelFills || [])
  .map(f => ({ seq: f.seq, us: (f.pts || []).map(p => p.u), es: (f.pts || []).map(p => p.e) }))
  .filter(f => f.us.length && Math.min(...f.us) < u0 && Math.max(...f.us) > u1
    && Math.abs(Math.max(...f.es) - top) < 0.03);
const columnHatch = view => view.strokes.find(s => s.clip && s.ink === SEAM_INK && s.w < 1
  && Math.abs(Math.min(...s.clip.map(p => p.u))) < 0.01 && Math.abs(Math.max(...s.clip.map(p => p.u)) - 2) < 0.01
  && Math.min(...s.clip.map(p => p.e)) < -1);

test('his E2: the column\'s stucco runs down over the floor strip like the siding beside it', () => {
  const view = paint('E1');
  const hatch = columnHatch(view);
  expect(hatch, 'the column is clad down past the floor').toBeTruthy();
  // The MAIN FL band (0'-0" down to the sill) goes down BEFORE the column's
  // cladding, not over it.
  const bands = fillsOver(view, 0.05, 1.95, 0.027);
  expect(bands.length).toBeGreaterThan(0);
  bands.forEach(b => expect(b.seq, 'band painted under the column').toBeLessThan(hatch.seq));
});

test('his E2: no joint line in the concrete under the flush column', () => {
  const view = paint('E1');
  expect(plumbs(view, 1, -2.4, -1.3).filter(u => Math.abs(u) < 0.01)).toEqual([]);
});

test('his E2 and E4: the deck behind the column stays behind it', () => {
  for (const [id, lo, hi] of [['E1', 0.05, 1.95], ['E3', -1.95, -0.05]]) {
    const view = paint(id);
    const hatch = view.strokes.filter(s => s.clip && s.ink === SEAM_INK && s.w < 1
      && Math.min(...s.clip.map(p => p.e)) < -1 && Math.min(...s.clip.map(p => p.u)) <= lo
      && Math.max(...s.clip.map(p => p.u)) >= hi);
    expect(hatch.length, `${id}: the column's cladding`).toBeGreaterThan(0);
    const last = Math.min(...hatch.map(s => s.seq));
    // The deck's top is 0'-0" less its drop.
    const decks = fillsOver(view, hi, lo, -0.37).filter(f => f.seq > last);
    expect(decks, `${id}: a deck fill laid over the column`).toEqual([]);
  }
});
