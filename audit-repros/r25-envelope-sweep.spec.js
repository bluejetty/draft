// How often does profileEnvelope drop a roof profile endpoint, and what does
// the section draw when it drops one but not both?
const { test } = require('@playwright/test');
const h = require('../tests/helpers.js');

test('R25: profileEnvelope endpoint loss across cut angles', async ({ page }) => {
  await h.openModel(page, { webgl: false });
  const out = await page.evaluate(() => {
    const g = window.DraftGeometry2D;
    const roof = {
      points: [{ x: -14, z: -11 }, { x: 14, z: -11 }, { x: 14, z: 11 }, { x: -14, z: 11 }],
      edges: ['eave', 'eave', 'eave', 'eave'], overhang: 2, pitch: 4,
    };
    const faces = g.roofFaces(roof, g.roofSkeleton(roof));
    let full = 0, partial = 0, dead = 0, none = 0;
    const examples = { partial: [], dead: [] };
    for (let i = 0; i <= 400; i++) {
      const t = 4 + i * 0.03;                       // cut from (-16,-t) to (16,t)
      const a = { x: -16, z: -t }, b = { x: 16, z: t };
      const len = Math.hypot(b.x - a.x, b.z - a.z);
      const axis = { x: (b.x - a.x) / len, z: (b.z - a.z) / len };
      const profile = g.roofProfile(roof, faces, a, b, axis);
      if (profile.length < 2) { none++; continue; }
      const env = g.profileEnvelope([profile.map(p => ({ u: p.u, rise: 10 + p.rise }))]);
      const lit = env.filter(p => p.rise != null).length;
      const deg = (Math.atan2(2 * t, 32) * 180 / Math.PI).toFixed(1);
      if (lit === profile.length) full++;
      else if (lit > 1) { partial++; if (examples.partial.length < 4) examples.partial.push(`${deg}deg ${profile.length}->${lit}`); }
      else { dead++; if (examples.dead.length < 6) examples.dead.push(`${deg}deg ${profile.length}->${lit}`); }
    }
    return { full, partial, dead, none, examples };
  });
  const total = out.full + out.partial + out.dead + out.none;
  console.log(`${total} cut angles across a hip roof:`);
  console.log(`  intact profile          : ${out.full}`);
  console.log(`  endpoint(s) dropped, roof still drawn but short: ${out.partial}  ${JSON.stringify(out.examples.partial)}`);
  console.log(`  collapsed to <2 samples, NO ROOF DRAWN        : ${out.dead}  ${JSON.stringify(out.examples.dead)}`);
  console.log(`  no profile at all       : ${out.none}`);
});
