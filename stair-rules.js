// STAIR PLACEMENT RULES (boards #246 + #260) — the rulebook auto-stair.js
// reads instead of the constants that used to sit at the top of it. Pure
// frozen data plus small pure helpers: no DOM, no state, no store, shaped
// like room-standards.js beside it.
//
// PROVENANCE AND ITS LIMITS — read before trusting a number.
// The section marks below (§2.4, §3, §9 …) point into
// `RD-DOCUMENTS/docs/stair-database-compiled.md`, the keeper document this table was
// built from: nine independent research syntheses reconciled into one,
// with the disagreements preserved. It rides with the repo so these
// citations resolve for whoever reads this file next.
//
// Every share and every frequency in this file is a MODEL-SYNTHESIZED
// ESTIMATE reconciled from nine independent research syntheses, NOT a
// measured census. The compiled database says it plainly: "no public
// census of North American plan catalogs exists". So the shape shares are
// PRIORS AND TIE-BREAKERS, never hard constraints, and they are stored as
// BANDS rather than single numbers on purpose — the spread between the
// nine sources is information, and averaging it away would be a lie.
//
// Nothing here is a code approval. Every dimension carries
// `verified: false` and keeps it until the database's §9 verification
// checklist is worked against the actual IRC and NBC text. A value the
// database marks disputed carries that dispute with it (see `dispute`).
// US and Canadian packs are kept fully separate and are NEVER blended.
if (!window.DraftStairRules) {
(() => {
  // Freeze the whole tree, not just the top table: a nested row left
  // thawed is a table that can be edited by accident at 2am.
  const deepFreeze = value => {
    if (value && typeof value === 'object' && !Object.isFrozen(value)) {
      Object.freeze(value);
      Object.values(value).forEach(deepFreeze);
    }
    return value;
  };

  const IN = 1 / 12;   // inches → feet, the unit the engine works in

  // ── 1. SHAPES ────────────────────────────────────────────────────────
  // priorBand is [lo, hi] percent of stair INSTANCES (not houses — one
  // house can carry a main stair and a basement stair of different
  // shapes; the distinction is Grok's and it matters when these are ever
  // fitted to real data). fallbackRank is the ladder every source agrees
  // on: straight → L → U → winders as a last resort.
  //
  // `generated: false` means the engine does not produce this shape
  // today. The rows exist so a picker UI and the later slices have the
  // priors to hand, and so the ladder is complete rather than implied.
  const SHAPES = deepFreeze([
    {
      id: 'straight', label: 'Straight', priorBand: [35, 50], confidence: 'HIGH',
      fallbackRank: 1, generated: true,
      footprintReqs: { minRunFt: 11, minHallWidthFt: 3.5 },
      note: '8 of 9 sources rank it first. Wants a clear run along a wall or hall.',
    },
    {
      id: 'straightLanding', label: 'Straight with mid-landing (dogleg)',
      priorBand: [2, 8], confidence: 'LOW', fallbackRank: 5, generated: false,
      footprintReqs: { minRunFt: 11 },
      note: 'Only one source (Kimi) separates it; the rest fold it into straight or L. Kept as a sub-variant, not an archetype.',
    },
    {
      id: 'L', label: 'L-shape', priorBand: [25, 35], confidence: 'HIGH',
      fallbackRank: 2, generated: true,
      footprintReqs: { squareIshFoyer: true },
      note: 'Tightest agreement of any row — all nine rank it second or close. Breaks the door-to-bedrooms sightline.',
    },
    {
      id: 'U', label: 'U / switchback', priorBand: [15, 25], confidence: 'MEDIUM',
      fallbackRank: 3, generated: true,
      footprintReqs: { maxHouseWidthFt: 24, minShaftWidthFt: 6 },
      note: 'Best stacker, compact shaft, suits narrow houses. One source (Gemini) ranks it FIRST at 42% — a nine-source outlier, recorded in DISAGREEMENTS and deliberately not averaged into this band.',
    },
    {
      id: 'winder', label: 'Winders', priorBand: [4, 10], confidence: 'MEDIUM',
      fallbackRank: 4, generated: false,
      footprintReqs: { lastResort: true },
      note: 'All sources agree they are declining in new production and code-fussy. Last resort where a rectangular landing will not fit.',
    },
    {
      id: 'curved', label: 'Curved', priorBand: [2, 5], confidence: 'MEDIUM',
      fallbackRank: 6, generated: false, footprintReqs: {},
      note: 'Custom and luxury only.',
    },
    {
      id: 'spiral', label: 'Spiral', priorBand: [0, 3], confidence: 'HIGH',
      fallbackRank: 7, generated: false, footprintReqs: {},
      note: 'Never the primary stair in production housing.',
    },
  ]);

  const SHAPE_BY_ID = deepFreeze(Object.fromEntries(SHAPES.map(row => [row.id, row])));
  const GENERATED_SHAPES = deepFreeze(SHAPES.filter(row => row.generated).map(row => row.id));

  // ── 2. PLACEMENT ─────────────────────────────────────────────────────
  // The scoring rulebook. The engine's score is a COST: lower wins. So a
  // penalty contributes POSITIVE points and a bonus contributes NEGATIVE
  // points, and `scoreBreakdown` reports that signed contribution.
  //
  // `applied` says how a row reaches the engine today, and it is the
  // honest part of this table:
  //   'scored'          — a live term in the score
  //   'by-construction' — the candidate generator cannot produce a
  //                       violation, so no score term exists
  //   'inactive'        — the rule needs an input nobody passes yet; the
  //                       weight is recorded, the term is not computed
  // Every soft weight marked 'scored' is SEEDED FROM THE CONSTANT THE
  // ENGINE ALREADY USED, so moving the brains into this table changes no
  // behavior. Research-derived weights land 'inactive' rather than
  // quietly re-tuning a placement that already ships.
  const PLACEMENT = deepFreeze([
    // ── hard: a candidate that breaks one of these is not a candidate ──
    {
      id: 'insideInteriorRing', kind: 'hard', weight: null, applied: 'by-construction',
      source: 'engine', confidence: 'HIGH',
      note: 'Every well corner must lie inside the interior ring (the inside face of the exterior walls). Tested per candidate.',
    },
    {
      id: 'beamEdgeGap', kind: 'hard', weight: 2, unit: 'in', applied: 'by-construction',
      source: 'board #246', confidence: 'HIGH',
      note: 'The well holds this gap off a beam centreline and may never straddle it. Default 2"; the caller overrides with gapIn.',
    },
    {
      id: 'neverCutBeam', kind: 'hard', weight: null, applied: 'by-construction',
      source: 'research: all nine', confidence: 'HIGH',
      note: 'The well never cuts the mid-span beam or girder. The one framing rule every source states without hedging. Enforced by the same straddle test as beamEdgeGap.',
    },
    {
      id: 'exteriorWallSetback', kind: 'hard', weight: 5.5, unit: 'in', applied: 'caller',
      source: 'board #246', confidence: 'HIGH',
      note: 'The opening may reach only to the actual wall thickness (5.5") from the outside wall face. MODEL supplies it as insetFt; the ring the engine receives is already inset by it.',
    },
    {
      id: 'headroomFeasible', kind: 'hard', weight: null, applied: 'inactive',
      source: 'IRC / NBC (unverified)', confidence: 'MEDIUM',
      note: 'Opening length must clear the headroom for the floor-to-floor. Board #72 owns the headroom-driven opening length; the engine does not test it yet. See DIMENSIONS.*.headroom and the Grok formula in the database §4.3 (marked VERIFY).',
    },

    // ── soft: scored, seeded from the shipping constants ──
    {
      id: 'circulationDistance', kind: 'soft', weight: 1, unit: 'cost/ft', applied: 'scored',
      source: 'engine (Q3/Q5) + research §2.2', confidence: 'HIGH',
      note: 'Straight-line distance from the well centre to the circulation target — nearest HALL/ENTRY/FOYER stamp, else the footprint centroid. The base term of the score; one cost point per foot.',
    },
    {
      id: 'entryLBonus', kind: 'soft', weight: -4, unit: 'cost', applied: 'scored',
      source: 'engine rule A (board #260)', confidence: 'HIGH',
      note: 'In the front-entry zone an L whose 36" landing sits against the front wall competes in the same pool as straight and can win outright. Negative: it lowers cost.',
    },
    {
      id: 'entryStepPenalty', kind: 'soft', weight: 1, unit: 'cost/step', applied: 'scored',
      source: 'engine rule A (board #260)', confidence: 'HIGH',
      note: 'Per entry step past the fewest that fit — steps are need-driven, so the shallowest split wins ties.',
    },
    {
      id: 'bedroomRepel', kind: 'soft', weight: 2, unit: 'cost/ft', radiusFt: 6, applied: 'scored',
      source: 'engine (Q5)', confidence: 'MEDIUM',
      note: 'Cost per foot of intrusion inside a 6\' circle around a BEDROOM stamp. Worst single stamp counts, not the sum.',
    },
    {
      id: 'exteriorWallPenalty', kind: 'soft', weight: 2, unit: 'cost', thresholdFt: 1, applied: 'scored',
      source: 'engine rule B + research §2.3', confidence: 'HIGH',
      note: 'A well within 1\' of the ring is "beside an exterior wall". Applied only when the caller asks (softInterior) — today the basement flight. Research agrees stairs hug interior walls: insulation, window conflicts, stringer bearing.',
    },

    // ── soft: recorded from the research, not yet live ──
    {
      id: 'basementStacking', kind: 'soft', weight: -10, unit: 'cost', radiusFt: 12, applied: 'scored',
      source: 'research §2.4 + GPT weights', confidence: 'MEDIUM',
      note: 'Bonus for landing over the stair below, falling off linearly to nothing at 12\'. Only computed when the caller passes lowerStair, so it is absent by default and changes no shipping placement. Claimed stacking rates run 60-100%; stored prior 0.7-0.9. NOTE the database\'s unresolved terminology (§2.4.12): "stacking" means exact footprint overlap to some sources, same structural bay to others, merely nearby to others. This rule models proximity of well centres, which is the middle reading.',
    },
    {
      id: 'besideTheBeam', kind: 'soft', weight: -8, unit: 'cost', applied: 'by-construction',
      source: 'drafter-preference', confidence: 'MEDIUM',
      note: 'The drafter\'s own rule: prefer the stair parallel to the governing beam, where the beam can carry the header or landing. Every straight candidate is BUILT along a beam line, so the preference is structural rather than scored — there is no candidate that ignores it to penalise. Echoed by Grok ("park the stair beside the girder, bear headers on it, never cut it"), Kimi and Gemini.',
    },
    {
      id: 'joistDirection', kind: 'soft', weight: 4, unit: 'cost', applied: 'inactive',
      source: 'research §3 (DISPUTED)', confidence: 'LOW',
      note: 'SECONDARY preference only, and deliberately never hard. Five sources say run the well parallel to the joists, three say perpendicular, one splits 60/40 — see DISAGREEMENTS. The database resolves it as mostly the same layout described in opposite vocabulary, which is exactly why this must not become a constraint. Inactive: no caller passes a joist direction.',
    },
  ]);

  const PLACEMENT_BY_ID = deepFreeze(Object.fromEntries(PLACEMENT.map(row => [row.id, row])));
  const weightOf = id => PLACEMENT_BY_ID[id]?.weight ?? 0;

  // ── 3. DIMENSIONS ────────────────────────────────────────────────────
  // US and Canada NEVER blended — separate packs, separate values, and a
  // third `production` pack for what builders actually do (which is not
  // the same as what the code allows). Every entry is
  // { value, basis, verified } and `verified` stays false until the
  // database's §9 checklist is worked against real code text.
  const val = (value, basis, extra) => ({ value, basis, verified: false, ...(extra || {}) });

  const DIMENSIONS = deepFreeze({
    // Which pack is assumed when a caller names none.
    defaultJurisdiction: 'ca',

    us: {
      id: 'us', label: 'United States', code: 'IRC 2021 R311.7 (claimed, unverified)',
      width: val(36, 'code'),
      riserMax: val(7.75, 'code'),
      treadRunMin: val(10, 'code'),
      nosing: val(1, 'code', { range: [0.75, 1.25] }),
      headroom: val(80, 'code'),
      landingDepth: val(36, 'code'),
      // What the engine uses when the caller passes no explicit number.
      defaultWidthFt: 36 * IN,
      defaultLandingFt: 36 * IN,
    },

    ca: {
      id: 'ca', label: 'Canada', code: 'NBC 2020 9.8 (claimed, unverified)',
      width: val(34, 'code', {
        dispute: 'Sources give 34", 36" and 860mm for the NBC minimum and do not agree. VERIFY against the NBC text before this drives any validation.',
      }),
      riserMax: val(7.875, 'code', { metric: '200mm' }),
      treadRunMin: val(10, 'code', { metric: '255mm' }),
      nosing: val(1, 'code'),
      headroom: val(82.5, 'code', {
        metric: '2100mm',
        note: 'Stricter than IRC 80" — all sources agree on the direction. Canadian stairs run slightly longer or take lower risers.',
      }),
      landingDepth: val(35.43, 'code', { metric: '900mm' }),
      defaultWidthFt: 34 * IN,
      // 36" satisfies NBC's 900mm (35.43") and IRC's 36" alike, and it is
      // the value the engine already shipped — so the landing default is
      // deliberately NOT switched by jurisdiction. Narrowing it here
      // would move every stair that leaves landingFt unset.
      defaultLandingFt: 36 * IN,
    },

    production: {
      id: 'production', label: 'Builder-typical (North America)',
      code: null,
      width: val(42, 'production', { range: [36, 48], note: '36" is the economy build.' }),
      riser: val(7.5, 'production', { range: [7, 7.75] }),
      treadRun: val(10.25, 'production', { range: [9.5, 11] }),
      nosing: val(1.125, 'production', { range: [0.75, 1.5] }),
      headroom: val(82, 'production'),
      landingDepth: val(42, 'production'),
    },

    // Straight run, no landings, from the database §4.2. DeepSeek's riser
    // math is the baseline; the others' spread is kept as `range` because
    // they integrate landings differently. Our own stair tool does the
    // real riser math from level heights — this table is a sanity check,
    // not a source of truth.
    runExamples: [
      { floorToFloorFt: 8, actual: "8'-1 1/8\"", risers: 14, treads: 13, runFt: 11 + 4.5 * IN, range: [10.5, 11.5] },
      { floorToFloorFt: 9, risers: 16, treads: 15, runFt: 13 + 1.5 * IN, range: [12, 13.5] },
      { floorToFloorFt: 10, risers: 17.5, treads: 16.5, runFt: 14, range: [13.5, 15] },
    ],
  });

  // The pack a caller gets. Unknown or missing names fall to the default
  // rather than throwing — a bad jurisdiction string must not lose a
  // drafter their stair.
  const dimensionsFor = jurisdiction => {
    const key = String(jurisdiction || '').toLowerCase();
    return DIMENSIONS[key] && key !== 'production' ? DIMENSIONS[key]
      : DIMENSIONS[DIMENSIONS.defaultJurisdiction];
  };

  // ── 4. DECISION TREE ─────────────────────────────────────────────────
  // The database's merged tree, as plain data walked by suggestShapes.
  // Conditions are matched field by field; a field absent from `when`
  // does not constrain. First match wins, then the fallback ladder fills
  // in whatever the match did not name — so the answer is always a full
  // ordered list and never an empty one.
  const NARROW_HOUSE_FT = 24;
  const FALLBACK_LADDER = deepFreeze(['straight', 'L', 'U', 'winder']);

  const DECISION_TREE = deepFreeze([
    {
      id: 'bungalow',
      when: { storeys: 'bungalow' },
      shapes: ['straight', 'L'],
      note: 'The only stair is the basement stair, and it belongs to the utility zone — kitchen, mudroom or garage hall — NOT the formal foyer. Straight preferred, over or beside the mid-span beam. Stacking does not apply.',
    },
    {
      id: 'splitEntry',
      when: { storeys: 'bilevel' },
      shapes: ['straight'],
      note: 'The defining feature of the type: straight up and straight down from an entry landing directly behind the front door. Landing at least 4\' deep for door swings and coats.',
    },
    {
      id: 'splitLevel',
      when: { storeys: 'splitlevel' },
      shapes: ['U', 'straight', 'L'],
      note: 'Short switchback runs navigating half-storeys.',
    },
    {
      id: 'twoStoreyNarrow',
      when: { storeys: 'two', narrow: true },
      shapes: ['U', 'L'],
      note: 'Under ~24\' wide a centred or rear U packs the tightest vertical shaft and stacks best; an L on a side wall is the fallback.',
    },
    {
      id: 'twoStoreyCentreEntry',
      when: { storeys: 'two', entry: 'center' },
      shapes: ['straight', 'L'],
      note: 'Straight beside the foyer, left or right — never facing the door swing. Folds to an L when the foyer is smaller than about 8\' x 8\'.',
    },
    {
      id: 'twoStoreySideEntry',
      when: { storeys: 'two', entry: 'side' },
      shapes: ['straight', 'L'],
      note: 'Straight, parallel to the entry wall, running into the central hall.',
    },
    {
      id: 'twoStoreyDefault',
      when: { storeys: 'two' },
      shapes: ['straight', 'L', 'U'],
      note: 'The general two-storey case: main stair adjacent to the foyer, basement stair stacked under it unless a beam or height conflict below forbids it.',
    },
  ]);

  const matches = (when, ctx) => Object.entries(when).every(([key, want]) => {
    const got = ctx[key];
    if (typeof want === 'string') return String(got || '').toLowerCase() === want;
    return got === want;
  });

  // ctx: { storeys, entry, garage, footprint, houseWidthFt, narrow }
  // `narrow` is derived from houseWidthFt when not stated outright.
  const suggestShapes = ctx => {
    const context = ctx && typeof ctx === 'object' ? ctx : {};
    const narrow = typeof context.narrow === 'boolean' ? context.narrow
      : (Number.isFinite(context.houseWidthFt) ? context.houseWidthFt < NARROW_HOUSE_FT : undefined);
    const probe = { ...context, narrow };
    const rule = DECISION_TREE.find(row => matches(row.when, probe)) || null;
    const ordered = [...(rule ? rule.shapes : [])];
    FALLBACK_LADDER.forEach(id => { if (!ordered.includes(id)) ordered.push(id); });
    return { rule: rule ? rule.id : null, note: rule ? rule.note : null, shapes: ordered };
  };

  // ── 5. WHY THIS STAIR ────────────────────────────────────────────────
  // The engine hands over the per-rule terms it actually computed; this
  // turns them into an ordered explanation. Points are the SIGNED
  // contribution to the score, and the score is a cost — so a negative
  // number is a rule that helped this candidate win. Terms worth nothing
  // are dropped: a breakdown listing a dozen zeroes explains nothing.
  const scoreBreakdown = (candidate, firedRules) => {
    const fired = Array.isArray(firedRules) ? firedRules : [];
    return fired
      .filter(term => term && term.ruleId && Number.isFinite(term.points) && term.points !== 0)
      .map(term => ({
        ruleId: term.ruleId,
        points: term.points,
        kind: PLACEMENT_BY_ID[term.ruleId]?.kind ?? null,
        source: PLACEMENT_BY_ID[term.ruleId]?.source ?? null,
      }))
      .sort((a, b) => Math.abs(b.points) - Math.abs(a.points));
  };

  // ── 6. DISAGREEMENTS ─────────────────────────────────────────────────
  // Kept deliberately. Where nine researchers split, the split IS the
  // finding, and a table that hides it would read more confident than the
  // evidence is. Anything resolved says who resolved it and how.
  const DISAGREEMENTS = deepFreeze([
    { topic: 'U-shape share', split: 'One source ranks U first at 42%; the other eight put it third at 10-25%.', status: 'Outlier recorded, not averaged. Band held at 15-25.' },
    { topic: 'Stacking rate', split: 'Claims run 60% to 100%.', status: 'Stored as a 0.7-0.9 prior. The definition of "stacking" itself is unresolved — see PLACEMENT.basementStacking.' },
    { topic: 'Joist orientation', split: 'Five sources say parallel, three say perpendicular, one splits 60/40.', status: 'Largely the same layout in opposite vocabulary: joists span the short way onto the long mid-span beam, so a stair parallel to the beam has its opening long-axis perpendicular to the joists. Resolved to the drafter\'s beam rule; the joist term stays soft and inactive.' },
    { topic: 'Bearing wall under a parallel-to-joists stringer', split: 'One source claims it is required.', status: 'CORRECTED by the drafter: doubled trimmers along the long sides and short doubled headers at each end carry the cut tails; trimmers span bearing to bearing like any joist. No bearing wall is inherently required — geometry decides.' },
    { topic: 'Dogleg as its own archetype', split: 'One source of nine separates it.', status: 'Kept as a sub-variant of straight (SHAPES.straightLanding, generated: false).' },
    { topic: 'Run length per floor height', split: 'Sources disagree on total run because they integrate landings differently.', status: 'Our own riser math governs; runExamples is a sanity check only.' },
    { topic: 'NBC minimum width', split: '34" vs 36" vs 860mm.', status: 'UNRESOLVED. Recorded on DIMENSIONS.ca.width.dispute. Verify against the NBC text.' },
  ]);

  // The database's §9 list, carried in the file it governs so it cannot
  // be lost. While any of these is open, nothing here is a code check.
  const VERIFICATION_CHECKLIST = deepFreeze([
    'Verify IRC R311.7 section numbers and values against the actual 2021 text.',
    'Verify NBC 9.8 values (riser, tread, width, headroom in mm) against the actual code.',
    'Parameterize provincial and state amendments (OBC, BCBC) separately.',
    'Determine whether ANY percentage came from a counted sample (assume none did).',
    'Resolve the "stacking" definition before the bonus is tuned.',
    'Validate the rough-opening formula against real stair geometry and our stair tool.',
    'Confirm framing terminology (header, trimmer, stringer bearing) with a framing reference.',
    'Keep the US and Canada packs parameterized — never blended.',
    'Unit tests against generated footprints.',
  ]);

  window.DraftStairRules = deepFreeze({
    SHAPES, SHAPE_BY_ID, GENERATED_SHAPES,
    PLACEMENT, PLACEMENT_BY_ID, weightOf,
    DIMENSIONS, dimensionsFor,
    DECISION_TREE, FALLBACK_LADDER, NARROW_HOUSE_FT, suggestShapes,
    scoreBreakdown,
    DISAGREEMENTS, VERIFICATION_CHECKLIST,
  });
})();
}
