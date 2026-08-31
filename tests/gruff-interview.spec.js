// GRUFF'S INTERVIEW ENGINE (board #323): the professor takes the order after
// the bone has already built a house. The tree, the wording, the placement
// and the defaults are pinned offline by proto/gruff-interview-harness.js
// (64 checks) — this spec proves the module reaches the page and behaves as
// the same engine there. The drive-thru board is the Skipper's, and its
// specs come with it.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

test('the professor loads in the page with his surface frozen', async ({ page }) => {
  await h.openModel(page);
  const shape = await page.evaluate(() => {
    const G = window.DraftGruffInterview;
    return {
      present: !!G,
      frozen: Object.isFrozen(G),
      api: ['startState', 'nextQuestion', 'answer', 'program'].every(k => typeof G[k] === 'function'),
      ladder: G.CRITICAL_LADDER.join(','),
      zones: G.ZONES.length,
    };
  });
  expect(shape.present).toBe(true);
  expect(shape.frozen).toBe(true);
  expect(shape.api).toBe(true);
  // The critical ladder is the order the office asks in, and it is public.
  expect(shape.ladder).toBe('storeys,bedrooms,bathrooms,entry');
  expect(shape.zones).toBe(5);
});

test('he takes an order in the browser and hands over a complete program', async ({ page }) => {
  await h.openModel(page);
  const result = await page.evaluate(() => {
    const G = window.DraftGruffInterview;
    let state = G.startState({ outline: { x0: -20, x1: 20, z0: -14, z1: 14 } }, 7);
    const asked = [];
    // Answer the way a client actually talks, not in tidy tokens.
    const replies = { count: 'about three', yesno: 'yeah go on', zone: 'out front' };
    for (let i = 0; i < 6; i++) {
      const q = G.nextQuestion(state);
      if (q.done) break;
      asked.push(q.id);
      state = G.answer(state, q.id, replies[q.kind] ?? (q.options || ['standard'])[0]);
    }
    const program = G.program(state);
    return {
      asked,
      stamps: program.stamps.length,
      complete: program.complete,
      allPlaced: program.stamps.every(s => Number.isFinite(s.x) && Number.isFinite(s.z) && !!s.base),
      bedrooms: program.stamps.filter(s => s.base === 'BEDROOM').length,
    };
  });
  expect(result.asked[0]).toBe('storeys');
  expect(result.complete).toBe(true);
  expect(result.stamps).toBeGreaterThan(0);
  expect(result.allPlaced).toBe(true);
  // "about three" parsed as three, so three bedrooms came out the far end.
  expect(result.bedrooms).toBe(3);
});

test('the bone can be pressed at any rung — the program is never half-built', async ({ page }) => {
  await h.openModel(page);
  const sizes = await page.evaluate(() => {
    const G = window.DraftGruffInterview;
    let state = G.startState({}, 3);
    const out = [];
    for (let i = 0; i < 5; i++) {
      const p = G.program(state);
      out.push({ n: p.stamps.length, complete: p.complete, defaulted: p.defaulted.length });
      const q = G.nextQuestion(state);
      if (q.done) break;
      state = G.answer(state, q.id, q.kind === 'count' ? '2' : q.kind === 'yesno' ? 'no' : 'back');
    }
    return out;
  });
  // Even before a word is said there is a whole house to build.
  expect(sizes[0].n).toBeGreaterThan(0);
  expect(sizes[0].defaulted).toBeGreaterThan(0);
  sizes.forEach(step => {
    expect(step.complete).toBe(true);
    expect(step.n).toBeGreaterThan(0);
  });
});
