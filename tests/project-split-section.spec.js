// WHAT THE SPLIT'S SECTION SHOWS, AND ON WHICH SIDE OF THE CUT.
//
// Movie, 28 Sep, over three marked-up screenshots of the bilevel card in one
// go. All three are about the same thing -- the section was drawing framing
// that is not in this view, and leaving out framing that is:
//
//   "the left eave on the house is cut off can you add that back one"
//   "the main floor should only show on the right and entry and 2nd floor
//    above garage only on the left"
//   "the roof chords at the drop was missing a line ... and there was also an
//    extra line we don't want"
//
// ── WHY THIS ASKS THE BUILDER AND NOT THE CANVAS ──────────────────────────
//
// Every one of these is a line either present or absent at a known place in
// the building's own feet. Read off pixels, "the main floor is not on the
// left" becomes "this region of the bitmap is dark", which passes just as
// happily when the whole band failed to paint -- and the bands are 2 px tall
// on a 380 px canvas, so the reading is a coin flip besides. buildWallSection
// hands back its parts in feet, so the question can be asked as the question.
//
// The page's own wiring -- that these are the values band 2 hands over -- is
// what tests/project-bilevel.spec.js checks by painting.
const { test, expect } = require('@playwright/test');

// A SPLIT, WRITTEN OUT. Not read from the page: the page's numbers move every
// time Movie types one, and none of the rules below depend on them. What they
// depend on is the SHAPE -- an entry landing below the datum, a main floor on
// it, a lower second floor standing over the entry and stopping short -- so
// the shape is what is stated here.
const level = (id, name, wallHeightFt, joistDepthIn, rest) => ({
  id, name, wallHeightFt, joistDepthIn, sheathingIn: 0.75, ...rest,
});

const SPLIT = {
  floors: [
    level(2, 'ENTRY', 3.4, 9.25, { deckAt: 'near' }),
    level(3, 'MAIN FL', 9.09, 11.875, { deckAt: 'far' }),
    level(5, '2ND FL', 9.09, 11.875, {
      over: 2, deckAboveFt: 9, extentFt: 5.5, deckAt: 'near',
    }),
  ],
  datumIndex: 1,
  foundation: {
    wallHeightFt: 5, woodFillHeightFt: 4.23, thicknessIn: 8, slabIn: 3,
    footingWidthIn: 20, footingDepthIn: 8, gradeOffsetFt: 0,
    attachment: 'sill', attachmentIn: 1.5,
  },
  roof: { pitch: 4, overhangFt: 2, fasciaIn: 5.5, heelIn: null },
  wallThicknessIn: 5.5,
  cutDepthFt: 7,
  stairs: true,
  eaves: true,
};

const FAR_CUT_FT = 3;

const sections = page => page.evaluate(([values, farCut]) => {
  const P = window.DraftProjectPage;
  const strip = section => ({
    // A DECK BAND IS THE WEIGHT-1 RECT THAT IS DEEP. The only other rect drawn
    // at that weight is the slab, which is 3" -- a floor package is never
    // under half a foot, so the two cannot be confused by a typed number.
    decks: section.parts
      .filter(p => p.kind === 'rect' && p.weight === 1 && p.h > 0.4)
      .map(p => ({
        top: Math.round((p.y + p.h) * 1e6) / 1e6,
        depth: Math.round(p.h * 1e6) / 1e6,
      })),
    verticals: section.parts
      .filter(p => p.kind === 'line' && Math.abs(p.x1 - p.x2) < 1e-6)
      .map(p => ({
        x: Math.round(p.x1 * 1e6) / 1e6,
        lo: Math.round(Math.min(p.y1, p.y2) * 1e6) / 1e6,
        hi: Math.round(Math.max(p.y1, p.y2) * 1e6) / 1e6,
      })),
    horizontals: section.parts
      .filter(p => p.kind === 'line' && Math.abs(p.y1 - p.y2) < 1e-6)
      .map(p => ({
        y: Math.round(p.y1 * 1e6) / 1e6,
        x1: Math.round(Math.min(p.x1, p.x2) * 1e6) / 1e6,
        x2: Math.round(Math.max(p.x1, p.x2) * 1e6) / 1e6,
      })),
    minX: Math.round(section.extents.minX * 1e6) / 1e6,
  });
  return {
    near: strip(P.buildWallSection(values)),
    far: strip(P.buildFarEaveSection({ ...values, farEaveCutFt: farCut })),
  };
}, [SPLIT, FAR_CUT_FT]);

const open = async page => {
  await page.goto('/PROJECT.html?type=bilevel');
  await page.waitForFunction(() => window.DraftProjectPage != null, null, { timeout: 10000 });
};

// ── THE FLOORS ────────────────────────────────────────────────────────────
//
// The cut runs down the stairwell. Facing it you see the entry landing and
// the balcony over the garage; the main floor is past the stair, so it shows
// on the far edge drawn back from beyond the break. Before this, all three
// were banded on both halves, which said every level runs the full depth of
// the house -- the one thing a split's section exists to deny.
test('the near slice shows the half-storeys and the far edge shows the main floor',
  async ({ page }) => {
    await open(page);
    const { near, far } = await sections(page);
    // Two on the near slice: the entry landing and the lower second floor.
    expect(near.decks.length).toBe(2);
    // One on the far edge, and it is the main floor -- the datum, whose deck
    // top is 0 by definition on every drawing this page makes.
    expect(far.decks.length).toBe(1);
    expect(far.decks[0].top).toBeCloseTo(0.219, 2);
    // AND IT IS NOT ON THE NEAR SLICE, stated separately: a count alone is
    // satisfied by any two of the three.
    near.decks.forEach(deck => expect(Math.abs(deck.top - 0.219)).toBeGreaterThan(0.5));
  });

// A HIDDEN BAND IS A HIDDEN FLOOR, NOT A HOLE IN THE WALL. The band's own
// edges were carrying the two wall faces across the depth of the floor
// package, so the first version of the rule above opened a gap in the house's
// exterior wall exactly where the main floor used to be -- a wall that is cut
// through whatever is or is not framing behind it.
test('the wall runs unbroken past a floor that is not shown', async ({ page }) => {
  await open(page);
  const { near } = await sections(page);
  // A DECK BAND COVERS THE FACE TOO, by its own left edge, so it counts as
  // wall for this question -- otherwise the check would read a gap wherever a
  // floor IS drawn and say nothing about the case it exists for.
  const faces = [
    ...near.verticals.filter(v => Math.abs(v.x) < 1e-6),
    ...near.decks.map(d => ({ lo: d.top - d.depth, hi: d.top })),
  ].sort((a, b) => a.lo - b.lo);
  const gaps = faces.slice(1)
    .map((v, i) => ({ from: Math.max(...faces.slice(0, i + 1).map(f => f.hi)), to: v.lo }))
    .filter(g => g.to - g.from > 0.01);
  expect(gaps).toEqual([]);
});

// ── THE CEILING DROP ──────────────────────────────────────────────────────
//
// The bottom chord is ONE member that turns. Movie, 28 Sep, over a drawing
// where the drop was a single line between two chords: "they should be 3.5"
// chords at the drop the 3.5" chord should turn and go down th main floor
// ceiling and then continue horizontal at 3.5" chord (as it is already)".
//
// So this asks for the band and not for the lines: a room face that is the
// ceiling, the drop and the ceiling again, and a back that is that face
// offset by the chord the whole way -- including round both corners, which is
// what was missing. Ending the upper chord at the drop and starting the lower
// one there left a 3 1/2" square of nothing at each corner.
test('the bottom chord turns down the drop at its own thickness',
  async ({ page }) => {
    await open(page);
    const { near } = await sections(page);
    const ext = SPLIT.floors[2].extentFt;

    // The room face of the drop, between the two ceiling planes.
    const face = near.verticals.filter(v => Math.abs(v.x - ext) < 1e-6);
    expect(face.length).toBe(1);
    const lower = near.horizontals.find(h => Math.abs(h.x1 - ext) < 1e-6);
    const upper = near.horizontals.find(h => Math.abs(h.x2 - ext) < 1e-6);
    expect(lower).toBeTruthy();
    expect(upper).toBeTruthy();
    expect(face[0].lo).toBeCloseTo(lower.y, 3);
    expect(face[0].hi).toBeCloseTo(upper.y, 3);

    // THE CHORD, read as a thickness rather than as a number typed here: the
    // two ceiling planes and their backs give it, and the turn has to match.
    const chordFt = near.horizontals
      .filter(h => Math.abs(h.x2 - ext) < 1e-6 || Math.abs(h.x1 - ext) < 1e-6)
      .map(plane => Math.min(...near.horizontals
        .filter(h => h.y > plane.y).map(h => h.y - plane.y)));
    expect(chordFt[0]).toBeCloseTo(chordFt[1], 4);
    const chord = chordFt[0];
    expect(chord).toBeGreaterThan(0.2);

    // The back of the turn: one vertical, a chord in from the face, running
    // corner to corner of the offset.
    // A THOUSANDTH OF A FOOT is the tolerance on anything DERIVED here: the
    // chord above is a difference of two drawn heights, so it carries their
    // rounding, while ext is a number this file typed.
    const back = near.verticals.filter(v => Math.abs(v.x - (ext - chord)) < 1e-3);
    expect(back.length).toBe(1);
    expect(back[0].lo).toBeCloseTo(lower.y + chord, 3);
    expect(back[0].hi).toBeCloseTo(upper.y + chord, 3);

    // AND THE TWO HORIZONTAL BACKS STOP AND START ON IT, which is the corner
    // that was empty: an upper back ending at ext leaves the turn hanging.
    const upperBack = near.horizontals.find(h => Math.abs(h.y - (upper.y + chord)) < 1e-3);
    const lowerBack = near.horizontals.find(h => Math.abs(h.y - (lower.y + chord)) < 1e-3);
    expect(upperBack.x2).toBeCloseTo(ext - chord, 3);
    expect(lowerBack.x1).toBeCloseTo(ext - chord, 3);
  });

// ── THE NEAR EAVE ─────────────────────────────────────────────────────────
//
// It was off since 16 Sep -- "we probably won't see any eaves on this one" --
// and that was true of a slice cut at the wall the garage shares. It stopped
// being true when the garage got drawn: its roof is a storey lower and the
// house's gable hangs over it in plain view.
//
// ASKED OF THE PAGE, not of a values object written here: the builder has had
// an `eaves` flag all along and honours it either way, so a check that hands
// it `eaves: true` proves the flag works and nothing about which way band 2
// sets it -- which is the whole of what changed.
//
// The PLAIN bilevel is the one to ask. With the garage on, everything outside
// the house wall is the garage, so the question could not be put; with it off,
// the overhang is the only thing that is ever drawn out there.
//
// AND IT HAS TO BE PIXELS. The obvious cheap version reads the section's own
// extents, and they lie about this by design: minX is -overhangFt - 1.3
// whether or not the eave is drawn, because the drawing reserves the room for
// a label either way. It passed with the eave off, first try.
test('the house carries its own eave at the near edge', async ({ page }) => {
  await page.goto('/PROJECT.html?type=bilevel');
  await page.waitForFunction(
    () => document.querySelector('#bilevel-canvas')?.paintedSection != null,
    null, { timeout: 10000 });
  await page.locator('#bilevel-family-row button[data-family-entry="bilevel"]').click();
  await page.waitForTimeout(300);
  const outside = await page.evaluate(() => {
    const canvas = document.querySelector('#bilevel-canvas');
    const { view } = canvas.paintedSection;
    // The same arithmetic paintSection uses, so the wall face lands where the
    // page put it rather than where the test guessed.
    const slack = (canvas.width - view.span * view.scale) * 0.5;
    const wallFaceX = (0 - view.minX) * view.scale + slack;
    // THE TOP HALF ONLY, because the grade line is dashed across the WHOLE
    // canvas and lights up this strip whatever the roof is doing -- the first
    // version of this counted it and passed with the eave off.
    const px = canvas.getContext('2d').getImageData(
      0, 0, Math.max(1, Math.floor(wallFaceX - 2)), Math.floor(canvas.height / 2)).data;
    let lit = 0;
    for (let i = 3; i < px.length; i += 4) if (px[i] > 40) lit += 1;
    return lit;
  });
  // A fascia board, a soffit and the chord over them: about 140 px here, and
  // exactly none with the eave off.
  expect(outside).toBeGreaterThan(50);
});
