const { test, expect } = require('@playwright/test');

// BAND 2 IS WIRED, AND IT IS NOT BAND 1 REPAINTED.
// The cheap version of this test asserts the canvas is non-blank, which a
// second copy of the bungalow would also pass — and a second copy is exactly
// the mistake available here, since both bands call buildWallSection and the
// only thing keeping them apart is which values object they are handed.
test('band 2 is wired and draws without error', async ({ page }) => {
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.goto('/PROJECT.html');
  await expect(page.locator('#bilevel-canvas')).toBeVisible();
  const split = (await page.locator('#bilevel-canvas').screenshot()).toString('base64');
  expect(errors).toEqual([]);
  expect(split.length).toBeGreaterThan(2000);
});

// WHAT BAND 2 BORROWS, AND WHAT IT MUST NOT. This pair is the whole contract,
// and it needs both halves: band 2 takes the ROOF from band 1 because a pitch
// belongs to the job, and refuses band 1's FOUNDATION because a pour belongs to
// the build type. One assertion alone is satisfiable by the wrong code --
// sharing everything passes the first, sharing nothing passes the second.
//
// The obvious test here is a dud and was written first: compare band 2's canvas
// against band 1's and call them different. They are always different. Band 1
// paints the garage beside the house, so handing band 2 detailValues() -- an
// exact second bungalow, the single most likely mistake in this wiring --
// still leaves two unequal images. It passed the mutation and proved nothing.
test('band 2 ignores a foundation edit in band 1', async ({ page }) => {
  await page.goto('/PROJECT.html');
  const shoot = async () =>
    (await page.locator('#bilevel-canvas').screenshot()).toString('base64');
  const before = await shoot();

  const fdn = page.locator('#sched-house').getByLabel('FDN WALL HT');
  await expect(fdn).toBeVisible();
  await fdn.fill(String.raw`6'-0"`);
  await fdn.press('Enter');

  // Band 1 moved -- otherwise this asserts nothing about band 2.
  await expect.poll(async () =>
    (await page.locator('#detail-canvas').screenshot()).toString('base64')
  ).not.toEqual(before);
  // Band 2 did not. Its pour is the office default for the type, 5'-0".
  expect(await shoot()).toEqual(before);
});

// THE ROOF IS THE OFFICE'S, NOT THE BUILD TYPE'S. Band 2 borrows pitch and eave
// from band 1 deliberately -- two sections drawn with different roofs would be
// two drawings rather than two build types, and the whole point of putting them
// on one page is that everything except the type is held still.
//
// This is the failure the wiring invites: paintSections on the second canvas
// sits inside repaint(), and dropping it (or calling it once at load) leaves
// band 2 looking perfectly correct while showing the previous roof. A test that
// only checked band 2 was non-blank would pass on that forever.
test('a pitch change in band 1 moves band 2 too', async ({ page }) => {
  await page.goto('/PROJECT.html');
  const shoot = async () =>
    (await page.locator('#bilevel-canvas').screenshot()).toString('base64');

  const before = await shoot();
  // Scoped to the house schedule: PITCH :12 also labels a cell in every row
  // of the section table, so an unscoped lookup finds six of them.
  const pitch = page.locator('#sched-house').getByLabel('PITCH :12');
  await expect(pitch).toBeVisible();
  const was = await pitch.inputValue();

  await pitch.fill('12');
  await pitch.press('Enter');
  await expect.poll(shoot).not.toEqual(before);

  // And back again, so the change is the pitch rather than anything the page
  // does once on first edit.
  await pitch.fill(was);
  await pitch.press('Enter');
  await expect.poll(shoot).toEqual(before);
});

// WHAT BAND 2 ACTUALLY DREW, converted back to feet. The screenshot tests above
// cover the wiring; this one covers the drawing. Losing the fill wall passed a
// pixel comparison, because a bilevel without one still looks like a section.
//
// Anchors come back in canvas pixels, so distances are divided by view.scale.
// Differences rather than absolute positions: paintSections auto-fits, so the
// origin is wherever the content put it.
test('band 2 draws a split: fill wall present, entry landing below main', async ({ page }) => {
  await page.goto('/PROJECT.html');
  const paint = await page.evaluate(() =>
    document.querySelector('#bilevel-canvas').paintedSection);
  const at = paint.anchors;
  const feetBelow = (a, b) => (at[a].y - at[b].y) / paint.view.scale;  // canvas y is down

  // THE FILL WALL EXISTS. buildWallSection sets this anchor only when it has a
  // height to draw, so the anchor's absence is the missing wall -- which is
  // the whole difference between a bilevel and a bungalow on a short pour.
  expect(at.woodFill).toBeTruthy();

  // ENTRY is a LANDING BELOW MAIN, not a storey stacked on the foundation.
  // Bounded rather than pinned, and deliberately: the derivation puts the drop
  // at 4'-5 3/8" but Movie's PDF disagrees by 1'-8 3/8" and is not yet
  // reconciled (RD-DOCUMENTS/SPEC-bilevel-section.md). Pinning the figure would
  // make this test fail the day that settles, on a change that is not a
  // regression. The sign and the rough size are not in dispute.
  expect(feetBelow('floor-2', 'floor-3')).toBeGreaterThan(3);
  expect(feetBelow('floor-2', 'floor-3')).toBeLessThan(6);

  // And the storey over the garage is above main by about a wall and a floor.
  expect(feetBelow('floor-3', 'floor-5')).toBeGreaterThan(8);

  // THE ENTRY FLOOR BEARS ON THE FILL WALL, so it sits BELOW that wall's
  // midpoint -- near its base, on the sill both of them share. This is the fact
  // the entry-wall derivation rests on, and it is also the one assertion here
  // that notices the foundation coming adrift from the floors.
  //
  // It earns its place: getting datumIndex wrong leaves every floor spaced
  // correctly relative to its neighbours while the whole concrete stack slides
  // 4 ft away, because fdnTop is pinned one package below the datum rather than
  // to the bottom of the stack. Every other check in this file passes on that,
  // including the screenshots -- the drawing is wrong in a way that only shows
  // as a gap between two things that must touch.
  expect(feetBelow('floor-2', 'woodFill')).toBeGreaterThan(0.5);
  expect(feetBelow('floor-2', 'woodFill')).toBeLessThan(3);
});

// THE SCHEDULE SAYS WHAT THE DRAWING DRAWS. Band 2 exists so Movie can hold it
// against his ArchiCAD section, which means the numbers beside it have to be
// the split's and not, say, the same field read twice.
test('band 2 schedule reads the split stack', async ({ page }) => {
  await page.goto('/PROJECT.html');
  const rows = await page.evaluate(() => Object.fromEntries(
    [...document.querySelectorAll('#sched-bilevel-left .sched-row, #sched-bilevel-right .sched-row')]
      .filter(r => !r.hidden)
      .map(r => [r.children[0].textContent, r.children[1].textContent])));

  // Office defaults for the type, pinned: these are the numbers that make a
  // split a split, and all three are frozen in SECTION_TABLE_DEFAULTS.
  expect(rows['POUR']).toBe(String.raw`5'-0"`);
  expect(rows['FILL WALL']).toBe(String.raw`4'-2 3/4"`);
  expect(rows['MAIN FL WALL']).toBe(String.raw`9'-1 1/8"`);

  // The entry package is the 2x10 and ply Movie named, deliberately NOT the
  // main floor's I-joist — sharing that field would draw it 2 5/8" too deep and
  // look entirely plausible.
  expect(rows['ENTRY FL']).toBe(String.raw`0'-10"`);
  expect(rows['MAIN FL JST']).toBe(String.raw`1'-0 5/8"`);

  // THE DISPUTED ONE, pinned to the derivation rather than left loose: fill
  // wall less the entry package. Movie's PDF says 5'-1 1/8" and is not
  // reconciled (RD-DOCUMENTS/SPEC-bilevel-section.md). If that settles his way
  // this test SHOULD fail — the number changing is the point of settling it,
  // and a test that shrugged would let the schedule and the spec drift apart.
  expect(rows['ENTRY WALL']).toBe(String.raw`3'-4 3/4"`);
});

// LABELS MUST NOT LAND ON EACH OTHER. Five tags stacked at the roof, three at
// the sill, three at the footing: each placed correctly at the height of the
// part it names, and together unreadable. Every other test in this repo passed
// throughout -- a canvas does not care that the words over it are illegible,
// and neither does a screenshot comparison.
//
// Both bands, because the de-collision pass is shared and band 2 exercises the
// tighter stack: POUR and FILL WALL are 6 3/4" apart in the drawing.
for (const [label, host] of [['band 1', '#detail-wrap'], ['band 2', '#bilevel-wrap']]) {
  test(`${label} labels do not overlap each other`, async ({ page }) => {
    await page.goto('/PROJECT.html');
    await expect(page.locator(`${host} .detail-tag`).first()).toBeAttached();
    const boxes = await page.evaluate(sel => [...document.querySelectorAll(`${sel} .detail-tag`)]
      .filter(t => t.style.display !== 'none' && t.textContent.trim())
      .map(t => { const r = t.getBoundingClientRect();
        return { text: t.textContent, x: Math.round(r.left), top: r.top, bottom: r.bottom }; }), host);

    expect(boxes.length).toBeGreaterThan(3);
    const collisions = [];
    for (let i = 0; i < boxes.length; i += 1) {
      for (let j = i + 1; j < boxes.length; j += 1) {
        const a = boxes[i]; const b = boxes[j];
        // Same column and vertically overlapping. Different columns are free to
        // share a height -- that is the whole point of having two.
        if (Math.abs(a.x - b.x) > 4) continue;
        if (a.top < b.bottom && b.top < a.bottom) collisions.push(`${a.text} / ${b.text}`);
      }
    }
    expect(collisions).toEqual([]);
  });
}

// A ROW THAT SAYS "BELOW" MUST NOT SHOW A NEGATIVE. The two cancel: "grade
// below foundation top: -3'-2"" states that grade is 3'-2" ABOVE the concrete,
// which is the opposite of the drawing, the stored value and the truth.
//
// Written as an invariant over every row rather than as a check on the one that
// was wrong, because the trap is in the pairing and not in that row: any future
// label with a direction in it inherits the same problem the moment its value
// can go negative.
test('no schedule row states a direction and then contradicts it', async ({ page }) => {
  await page.goto('/PROJECT.html');
  const bad = await page.evaluate(() => [...document.querySelectorAll('.sched-row')]
    .filter(r => !r.hidden)
    .map(r => {
      const name = (r.children[0].textContent || '').toLowerCase();
      const el = r.children[1];
      return { name, value: (el.value !== undefined ? el.value : el.textContent) || '' };
    })
    .filter(({ name, value }) => /\b(below|above|under|over)\b/.test(name) && value.trim().startsWith('-'))
    .map(({ name, value }) => `${name} = ${value}`));
  expect(bad).toEqual([]);
});
