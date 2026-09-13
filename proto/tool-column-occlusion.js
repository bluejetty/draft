// WHAT THE OPEN TOOL COLUMN COSTS IN DRAWING AREA.
//
// The order for this work says to report the drawing-area number the first
// time the left panel is populated rather than assume an earlier bound still
// holds, and the selection spec paid for not knowing it: a drag begun at world
// (-12, -6) with the column open pressed the PANEL, not the canvas, and
// reported "the window selects nothing" when the window was fine.
//
// SAME MEASURE SKIPPER USED FOR THE RIGHT PANEL, so the two numbers can be put
// beside each other: the percentage of the DRAWING'S OWN BOUNDING BOX on
// screen that the panel covers -- not the percentage of the viewport, which
// flatters a panel on a big screen with a small house in the middle.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const HOUSE = JSON.parse(fs.readFileSync(
  path.join(__dirname, 'repro-garage-house.draft'), 'utf8'));
const BASE = process.env.BASE_URL || 'http://localhost:4173';

// The extent fit() sees: the on-screen collections' points on the level the
// file opens on. walls, lines and floors -- which is what allPoints() gathers.
const EXTENT = (() => {
  const level = HOUSE.levels[HOUSE.activeLevelIdx].id;
  const pts = [];
  (HOUSE.walls || []).concat(HOUSE.lines || [])
    .filter(x => x.levelId === level)
    .forEach(x => { if (x.start) pts.push(x.start); if (x.end) pts.push(x.end); });
  (HOUSE.floors || []).filter(x => x.levelId === level)
    .forEach(f => (f.points || []).forEach(p => pts.push(p)));
  const xs = pts.map(p => p.x), zs = pts.map(p => p.z);
  return { spanX: Math.max(...xs) - Math.min(...xs),
    spanZ: Math.max(...zs) - Math.min(...zs) };
})();

(async () => {
  const browser = await chromium.launch();
  const rows = [];
  for (const [w, h, label] of [[1280, 720, 'laptop'], [1600, 900, 'desktop'],
    [1024, 768, 'small']]) {
    const page = await browser.newPage({ viewport: { width: w, height: h } });
    await page.goto(`${BASE}/MODEL.html`);
    await page.evaluate(async file => {
      await window.SharedFileStore.saveSharedFile(
        new File([JSON.stringify(file)], 'd.json',
          { type: 'application/json' }), 'model-drawing');
    }, HOUSE);
    for (const open of [false, true]) {
      await page.goto(`${BASE}/MODEL.html${open ? '?left=1' : ''}`);
      await page.locator('#readout').filter({ hasText: 'walls' })
        .waitFor({ timeout: 15000 });
      const shot = await page.evaluate(() => {
        const rail = document.getElementById('left-rail');
        const tab = document.getElementById('left-tab');
        const box = el => (el && !el.hidden ? el.getBoundingClientRect() : null);
        return { rail: box(rail), tab: box(tab) };
      });
      // THE DRAWING'S BOX ON SCREEN, derived rather than sampled. The first
      // version read it off the canvas pixels, and got the whole canvas back:
      // the page paints a ground and a grid, so "any pixel unlike the corner"
      // is every pixel. Percentages against that are percentages of the
      // VIEWPORT, which is exactly the flattering measure this script set out
      // not to use.
      //
      // So: fit() centres the drawn extent and scales it, and the readout
      // publishes the scale it chose. Extent times scale, centred, is the box.
      const ink = await page.evaluate(({ spanX, spanZ }) => {
        const c = document.getElementById('plan');
        const r = c.getBoundingClientRect();
        const scale = Number(/scale ([\d.]+) px\/ft/.exec(
          document.getElementById('readout').textContent)[1]);
        const w = spanX * scale, h = spanZ * scale;
        return { x: r.left + r.width / 2 - w / 2, y: r.top + r.height / 2 - h / 2,
          w, h };
      }, EXTENT);
      if (!ink) { console.log(`${label} ${open ? 'open' : 'shut'}: no ink`); continue; }
      const overlap = r => {
        if (!r) return 0;
        const ox = Math.max(0, Math.min(r.right, ink.x + ink.w) - Math.max(r.left, ink.x));
        const oy = Math.max(0, Math.min(r.bottom, ink.y + ink.h) - Math.max(r.top, ink.y));
        return ox * oy;
      };
      const covered = overlap(shot.rail) + (shot.rail ? 0 : overlap(shot.tab));
      const pct = (covered / (ink.w * ink.h)) * 100;
      rows.push({ label, open, pct, panel: shot.rail
        ? `${Math.round(shot.rail.width)}x${Math.round(shot.rail.height)}` : 'tab only' });
      console.log(`${label.padEnd(9)} ${(open ? 'column OPEN ' : 'column shut ')}`
        + `panel ${(shot.rail ? `${Math.round(shot.rail.width)}x${Math.round(shot.rail.height)}` : 'tab only').padEnd(10)}`
        + ` drawing ${Math.round(ink.w)}x${Math.round(ink.h)}`
        + `   covers ${pct.toFixed(1)}%`);
    }
    await page.close();
  }
  await browser.close();
  fs.writeFileSync(path.join(__dirname, 'tool-column-occlusion.json'),
    JSON.stringify(rows, null, 2));
})();
