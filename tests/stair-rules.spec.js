// STAIR RULES (boards #246 + #260): the placement brains moved out of ten
// constants at the top of auto-stair.js and into stair-rules.js — a frozen
// table where every row carries its source, its confidence, and whether it
// is actually live. These specs pin the table's integrity, the decision
// tree the database describes, and the two new optional inputs.
//
// The engine's own placement geometry is pinned elsewhere (auto-stair.spec
// and the offline harness). What matters HERE is that moving the brains
// into data changed no placement, and that the research values which are
// not verified stay marked and stay out of the shipping path.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

// A plain rectangle with one mid-span beam: enough for a straight run on
// either side of the beam, which is what the scoring tests need.
const RECT = [{ x: -14, z: -12 }, { x: 14, z: -12 }, { x: 14, z: 12 }, { x: -14, z: 12 }];
const BEAM = [{ start: { x: -14, z: 0 }, end: { x: 14, z: 0 } }];

const suggest = (page, extra = {}) => page.evaluate(([points, beams, extra]) =>
  window.DraftAutoStair.suggestStair({
    points, beams, stamps: [],
    insetFt: 5.5 / 12,
    runFt: 11, treads: 13, landFt: 3,
    ...extra,
  }), [RECT, BEAM, extra]);

test('the rulebook is frozen all the way down, and the two code packs never blend', async ({ page }) => {
  await h.openModel(page);
  const report = await page.evaluate(() => {
    const R = window.DraftStairRules;
    // A nested row left thawed is a table that can be edited by accident.
    const deepFrozen = value => {
      if (!value || typeof value !== 'object') return true;
      return Object.isFrozen(value) && Object.values(value).every(deepFrozen);
    };
    const before = R.DIMENSIONS.ca.width.value;
    try { R.DIMENSIONS.ca.width.value = 999; } catch { /* strict mode throws; frozen either way */ }
    try { R.SHAPES.push({ id: 'nonsense' }); } catch { /* ditto */ }
    return {
      deepFrozen: deepFrozen(R),
      widthHeld: R.DIMENSIONS.ca.width.value === before,
      shapeCount: R.SHAPES.length,
      usId: R.DIMENSIONS.us.id, caId: R.DIMENSIONS.ca.id,
      sameObject: R.DIMENSIONS.us === R.DIMENSIONS.ca,
      // Nothing in this file is a code approval until §9 is worked.
      unverified: ['us', 'ca'].every(pack => Object.values(R.DIMENSIONS[pack])
        .filter(entry => entry && typeof entry === 'object' && 'value' in entry)
        .every(entry => entry.verified === false)),
      // The NBC width the sources could not agree on keeps its dispute.
      caWidthDisputed: typeof R.DIMENSIONS.ca.width.dispute === 'string',
      headroomDiffers: R.DIMENSIONS.us.headroom.value !== R.DIMENSIONS.ca.headroom.value,
      riserDiffers: R.DIMENSIONS.us.riserMax.value !== R.DIMENSIONS.ca.riserMax.value,
    };
  });
  expect(report.deepFrozen).toBe(true);
  expect(report.widthHeld).toBe(true);
  expect(report.shapeCount).toBe(7);
  expect(report.sameObject).toBe(false);
  expect(report.usId).toBe('us');
  expect(report.caId).toBe('ca');
  expect(report.unverified).toBe(true);
  expect(report.caWidthDisputed).toBe(true);
  // The differences the nine sources DO agree on must survive the packs.
  expect(report.headroomDiffers).toBe(true);
  expect(report.riserDiffers).toBe(true);
});

test('every placement rule says what it is, what it is worth, and where it came from', async ({ page }) => {
  await h.openModel(page);
  const report = await page.evaluate(() => {
    const R = window.DraftStairRules;
    const bad = R.PLACEMENT.filter(row => !row.id || !row.kind || !row.source
      || !row.confidence || !row.note
      || !['hard', 'soft'].includes(row.kind)
      || !['scored', 'by-construction', 'inactive', 'caller'].includes(row.applied)
      // A soft rule with no weight cannot be scored or explained.
      || (row.kind === 'soft' && !Number.isFinite(row.weight)));
    return {
      badIds: bad.map(row => row.id),
      count: R.PLACEMENT.length,
      // A prior band, never a single number: the spread between the nine
      // sources is information and must not be averaged away.
      bandsAreBands: R.SHAPES.every(row => Array.isArray(row.priorBand)
        && row.priorBand.length === 2 && row.priorBand[0] <= row.priorBand[1]),
      generated: R.GENERATED_SHAPES,
      // The disputed research weights must NOT be live in the score.
      joistInactive: R.PLACEMENT_BY_ID.joistDirection.applied === 'inactive',
      joistIsSoft: R.PLACEMENT_BY_ID.joistDirection.kind === 'soft',
      disagreements: R.DISAGREEMENTS.length,
      checklist: R.VERIFICATION_CHECKLIST.length,
    };
  });
  expect(report.badIds).toEqual([]);
  expect(report.count).toBeGreaterThan(8);
  expect(report.bandsAreBands).toBe(true);
  // Only the three shapes the engine can actually produce claim to be generated.
  expect(report.generated).toEqual(['straight', 'L', 'U']);
  // Five sources say parallel, three perpendicular, one splits 60/40 — a
  // rule that contested is never allowed to become a hard constraint.
  expect(report.joistIsSoft).toBe(true);
  expect(report.joistInactive).toBe(true);
  expect(report.disagreements).toBeGreaterThan(5);
  expect(report.checklist).toBeGreaterThan(5);
});

test('the decision tree walks the database cases and always hands back a full ladder', async ({ page }) => {
  await h.openModel(page);
  const walks = await page.evaluate(() => {
    const R = window.DraftStairRules;
    const ladder = [...R.FALLBACK_LADDER];
    const cases = {
      bungalow: R.suggestShapes({ storeys: 'bungalow' }),
      bilevel: R.suggestShapes({ storeys: 'bilevel' }),
      narrow: R.suggestShapes({ storeys: 'two', houseWidthFt: 22 }),
      wide: R.suggestShapes({ storeys: 'two', entry: 'center', houseWidthFt: 40 }),
      nothingKnown: R.suggestShapes({}),
      rubbish: R.suggestShapes(null),
    };
    return Object.fromEntries(Object.entries(cases).map(([key, res]) => [key, {
      rule: res.rule, first: res.shapes[0], shapes: res.shapes,
      // Every walk ends up offering the whole ladder, in order, with no
      // repeats — an empty answer would strand the caller.
      coversLadder: ladder.every(id => res.shapes.includes(id)),
      unique: new Set(res.shapes).size === res.shapes.length,
    }]));
  });

  // The bungalow's only stair is the basement stair: straight, utility zone.
  expect(walks.bungalow.rule).toBe('bungalow');
  expect(walks.bungalow.first).toBe('straight');
  // Split-entry: straight up and down from the landing behind the door.
  expect(walks.bilevel.rule).toBe('splitEntry');
  expect(walks.bilevel.first).toBe('straight');
  // Under ~24' wide the U packs the tightest shaft and stacks best.
  expect(walks.narrow.rule).toBe('twoStoreyNarrow');
  expect(walks.narrow.first).toBe('U');
  // Wide house, centre entry: straight beside the foyer.
  expect(walks.wide.rule).toBe('twoStoreyCentreEntry');
  expect(walks.wide.first).toBe('straight');
  // An unknown context still gets the ladder rather than nothing at all.
  expect(walks.nothingKnown.rule).toBe(null);
  expect(walks.nothingKnown.shapes).toEqual(['straight', 'L', 'U', 'winder']);
  expect(walks.rubbish.shapes).toEqual(['straight', 'L', 'U', 'winder']);

  Object.entries(walks).forEach(([, res]) => {
    expect(res.coversLadder).toBe(true);
    expect(res.unique).toBe(true);
  });
});

test('the same house twice suggests the same stair, and the winner says why it won', async ({ page }) => {
  await h.openModel(page);
  const first = await suggest(page);
  const second = await suggest(page);
  expect(first.stair).not.toBeNull();
  // Deterministic: same inputs, same stair, down to the coordinates.
  expect(JSON.stringify(second.stair)).toBe(JSON.stringify(first.stair));

  // The score is a COST — lower wins — so a negative term is a rule that
  // helped this candidate win.
  const fired = first.report.rulesFired;
  expect(Array.isArray(fired)).toBe(true);
  expect(fired.length).toBeGreaterThan(0);
  fired.forEach(term => {
    expect(typeof term.ruleId).toBe('string');
    expect(Number.isFinite(term.points)).toBe(true);
    expect(term.points).not.toBe(0);       // a breakdown of zeroes explains nothing
  });
  expect(fired.map(term => term.ruleId)).toContain('circulationDistance');
  // With no stair below, the stacking rule contributes nothing at all.
  expect(fired.map(term => term.ruleId)).not.toContain('basementStacking');
});

test('a committed stair below pulls the next one toward it', async ({ page }) => {
  await h.openModel(page);
  const free = await suggest(page);
  // Both sides of the beam are equally near the centroid, so the pull is
  // what decides. Put the lower stair firmly on one side and it should win.
  const near = { wellCentre: { x: 0, z: 6 } };
  const far = { wellCentre: { x: 0, z: -6 } };
  const pulledNear = await suggest(page, { lowerStair: near });
  const pulledFar = await suggest(page, { lowerStair: far });

  expect(pulledNear.stair).not.toBeNull();
  expect(pulledFar.stair).not.toBeNull();
  // The suggestion follows the flight below to whichever side it sits on.
  expect(Math.sign(pulledNear.stair.wellCentre.z)).toBe(1);
  expect(Math.sign(pulledFar.stair.wellCentre.z)).toBe(-1);
  // And it is genuinely the stacking rule doing it, not a coincidence.
  const stack = pulledNear.report.rulesFired.find(term => term.ruleId === 'basementStacking');
  expect(stack).toBeTruthy();
  expect(stack.points).toBeLessThan(0);
  // A stair too far below to matter leaves the free placement alone.
  const miles = await suggest(page, { lowerStair: { wellCentre: { x: 500, z: 500 } } });
  expect(JSON.stringify(miles.stair)).toBe(JSON.stringify(free.stair));
});

test('the jurisdiction picks the width default and deliberately leaves the landing alone', async ({ page }) => {
  await h.openModel(page);
  const packs = await page.evaluate(() => {
    const R = window.DraftStairRules;
    return {
      us: R.dimensionsFor('us').defaultWidthFt,
      ca: R.dimensionsFor('ca').defaultWidthFt,
      usLanding: R.dimensionsFor('us').defaultLandingFt,
      caLanding: R.dimensionsFor('ca').defaultLandingFt,
      fallback: R.dimensionsFor().id,
      rubbish: R.dimensionsFor('atlantis').id,
      default: R.DIMENSIONS.defaultJurisdiction,
    };
  });
  // IRC gives 36"; the NBC figure the sources fought over is narrower.
  expect(packs.us).toBeCloseTo(3, 6);
  expect(packs.ca).toBeCloseTo(34 / 12, 6);
  // The landing is deliberately NOT switched: 36" satisfies both codes,
  // and narrowing it would move every stair that leaves landingFt unset.
  expect(packs.usLanding).toBeCloseTo(3, 6);
  expect(packs.caLanding).toBeCloseTo(3, 6);
  // A missing or nonsense jurisdiction falls to the default, never throws:
  // a bad string must not cost a drafter their stair.
  expect(packs.fallback).toBe('ca');
  expect(packs.rubbish).toBe('ca');
  expect(packs.default).toBe('ca');

  // The engine honours the pack — a wider default puts the run further off
  // the beam, so the geometry moves.
  const usStair = await suggest(page, { jurisdiction: 'us' });
  const caStair = await suggest(page, { jurisdiction: 'ca' });
  const explicit = await suggest(page, { widthFt: 3 });
  expect(Math.abs(usStair.stair.start.z)).not.toBeCloseTo(Math.abs(caStair.stair.start.z), 6);
  // 'us' resolves to the same 3'-0" an explicit caller asks for.
  expect(JSON.stringify(usStair.stair)).toBe(JSON.stringify(explicit.stair));
  // An explicit width overrides the pack outright.
  const explicitUnderCa = await suggest(page, { jurisdiction: 'ca', widthFt: 3 });
  expect(JSON.stringify(explicitUnderCa.stair)).toBe(JSON.stringify(explicit.stair));
});
