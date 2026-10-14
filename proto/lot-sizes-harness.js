#!/usr/bin/env node
// LOT SIZES — offline checks for lot-sizes.js, the table behind the SITE
// card on MODEL and the one on LAYOUT.
//
// Movie, 13 Oct: "when they enter onto the SITE in the MODEL area or on
// layout area can you ask them to pick a size from this list or to enter
// their size information (if it rectangle) or tell them they will need to
// adjust the 'AUTOSITE' if it isn't square" -- then the setbacks: "the house
// registration can be placed on the site plan so the distance is 20ft from
// the front registration SITE to the HOUSE registration (20 ft setback at
// front typical)", and on the sides "in most cases even with no windows the
// distance will be 4ft".
//
// WHY A HARNESS AND NOT ONLY SPECS. Two pages read this table, and what can
// go wrong in it is arithmetic -- a lot laid out the wrong way round, a
// setback measured from the wrong face, a metric field read as feet. Those
// are answerable without a browser, and answering them here means a spec
// that opens the card can be about the CARD.
//
//   node proto/lot-sizes-harness.js
//
// Exit 0 = every check passed.
const MUTATE = require('./harness-args.js').mutationMode();

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');

// ── MUTATIONS ────────────────────────────────────────────────────────────
// Each one is a way this module could be wrong and still look right: the
// numbers all stay plausible, and the drawing it produces is a different
// lot. The checks below are written to catch these rather than to describe
// the file back to itself.
const MUTATIONS = [
  // THE FIT RULE, which is a rule about what the card may OFFER and so has
  // every chance of being quietly wrong: a lot one foot too narrow still
  // draws, and the drafter finds out when his eave crosses the line.
  ['a lot is judged against the walls, with no side setback at all',
    'lot-sizes.js',
    c => c.replace('    return { widthFt: w + 2 * sideSetbackFt(opts), depthFt: FRONT_SETBACK_FT + d };',
      '    return { widthFt: w, depthFt: d };')],
  ['the brightest size is the biggest that fits rather than the first',
    'lot-sizes.js',
    c => c.replace('    return LOT_TIERS.find(tier => lotFitsHouse(tier, house, opts)) || null;',
      '    return [...LOT_TIERS].reverse().find(tier => lotFitsHouse(tier, house, opts)) || null;')],
  ['the lot is laid out portrait: the frontage runs back instead of across',
    'lot-sizes.js',
    c => c.replace(`    const x0 = centerX - w / 2, x1 = centerX + w / 2;
    const z0 = centerZ - d / 2, z1 = centerZ + d / 2;`,
    `    const x0 = centerX - d / 2, x1 = centerX + d / 2;
    const z0 = centerZ - w / 2, z1 = centerZ + w / 2;`)],
  ['the front setback is dropped, so the house sits on the front lot line',
    'lot-sizes.js',
    c => c.replace('      + FRONT_SETBACK_FT;', '      + 0;')],
  ['the front lot line goes BEHIND the house instead of in front of it',
    'lot-sizes.js',
    c => c.replace('      + FRONT_SETBACK_FT;', '      - FRONT_SETBACK_FT;')],
  ['the side setback takes the TIGHTER of the two rules, not the looser',
    'lot-sizes.js',
    c => c.replace('    return Math.max(wall, eave);', '    return Math.min(wall, eave);')],
  ['the eave is not counted, so a deep overhang hangs over the lot line',
    'lot-sizes.js',
    c => c.replace('    const eave = (Number(eaveFt) || 0) + EAVE_CLEAR_FT;',
      '    const eave = 0;')],
  ['a blank wall is given the windowed setback as well',
    'lot-sizes.js',
    c => c.replace('    const wall = windowed ? SIDE_SETBACK_WINDOWED_FT : SIDE_SETBACK_BLANK_FT;',
      '    const wall = SIDE_SETBACK_WINDOWED_FT;')],
  ['a typed lot is taken on trust, so a slipped finger builds a mile of lot',
    'lot-sizes.js',
    c => c.replace('      && value >= LOT_MIN_FT && value <= LOT_MAX_FT;', '      ;')],
  ['a metric typed lot is read as feet', 'lot-sizes.js',
    c => c.replace('    const raw = (value) => (metric ? feetOfMetres(value) : Number(value));',
      '    const raw = (value) => Number(value);')],
  ['the typed lot is left at the full conversion rather than rounded to the inch',
    'lot-sizes.js',
    c => c.replace('    const toInch = value => Math.round(value * 12) / 12;',
      '    const toInch = value => value;')],
  ['the site datum moves to the far corner, away from E1 and E2',
    'lot-sizes.js',
    c => c.replace('    const minX = Math.min(...pts.map(p => Number(p.x)));\n    const maxZ = Math.max(...pts.map(p => Number(p.z)));',
      '    const minX = Math.max(...pts.map(p => Number(p.x)));\n    const maxZ = Math.min(...pts.map(p => Number(p.z)));')],
  ['the lot itself is counted as a building when the house is measured',
    'lot-sizes.js',
    c => c.replace(`      .filter(outline => outline && outline.site !== true && Array.isArray(outline.points))
      .flatMap(outline => outline.points)
      .filter(p => p && Number.isFinite(Number(p.x)) && Number.isFinite(Number(p.z)));
    if (!pts.length) return null;
    return {
      leftX: Math.min(...pts.map(p => Number(p.x))),`,
    `      .filter(outline => outline && Array.isArray(outline.points))
      .flatMap(outline => outline.points)
      .filter(p => p && Number.isFinite(Number(p.x)) && Number.isFinite(Number(p.z)));
    if (!pts.length) return null;
    return {
      leftX: Math.min(...pts.map(p => Number(p.x))),`)],
];

if (MUTATE) {
  const all = require('./mutant-subprocess.js').runMutations('lot-sizes',
    MUTATIONS, { root: ROOT, harness: __filename, preload: true });
  process.exit(all ? 0 : 1);
}

const win = {};
const sandbox = { window: win, console, Object, Array, String, Number, JSON, Math };
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'lot-sizes.js'), 'utf8'),
  sandbox, { filename: 'lot-sizes.js' });

const LS = win.DraftLotSizes;
let passed = 0;
const failures = [];
const check = (name, condition, detail) => {
  if (condition) { passed += 1; return; }
  failures.push(detail ? `${name}\n      ${detail}` : name);
};
const near = (a, b, tol = 1e-6) => Math.abs(Number(a) - Number(b)) <= tol;
const box = points => ({
  x0: Math.min(...points.map(p => p.x)), x1: Math.max(...points.map(p => p.x)),
  z0: Math.min(...points.map(p => p.z)), z1: Math.max(...points.map(p => p.z)),
});

// ── HIS SIX TIERS ────────────────────────────────────────────────────────
check('the six tiers are S through XXXL, in that order',
  LS.LOT_TIERS.map(tier => tier.id).join(' ') === 'S M L XL XXL XXXL',
  JSON.stringify(LS.LOT_TIERS.map(tier => tier.id)));
// WIDTH IS FRONTAGE. "A 45 foot lot" is how a tier is quoted and how the
// typed fields are labelled, so the pair is pinned the way the garage sizes
// are: a 45x120 laid out 120 across is a different lot, and the label cannot
// say which number is which.
check('a 45 ft lot is 45 of FRONTAGE by 120 back',
  LS.lotTierById('L').widthFt === 45 && LS.lotTierById('L').depthFt === 120,
  JSON.stringify(LS.lotTierById('L')));
check('every tier carries both figures, a label and a character',
  LS.LOT_TIERS.every(tier => tier.widthFt > 0 && tier.depthFt > 0
    && typeof tier.label === 'string' && tier.label.length > 0
    && typeof tier.character === 'string' && tier.character.length > 0),
  JSON.stringify(LS.LOT_TIERS));
check('and they get wider as they go up the list',
  LS.LOT_TIERS.every((tier, i) => i === 0 || tier.widthFt > LS.LOT_TIERS[i - 1].widthFt),
  JSON.stringify(LS.LOT_TIERS.map(tier => tier.widthFt)));
check('an id that is not on the shelf answers null rather than a guess',
  LS.lotTierById('XS') === null && LS.lotTierById(null) === null,
  JSON.stringify([LS.lotTierById('XS'), LS.lotTierById(null)]));

// ── THE TYPED ONE ────────────────────────────────────────────────────────
check('a typed lot comes back the same shape as a stock one',
  (() => { const lot = LS.customLotSize(50, 110);
           return lot.widthFt === 50 && lot.depthFt === 110 && lot.custom === true; })(),
  JSON.stringify(LS.customLotSize(50, 110)));
// THE BOUNDS ARE WHAT A TYPED FIELD IS FOR. A laneway lot is real, so the
// floor is well under the narrowest tier; past the ceiling a "lot" is acreage
// that wants a different drawing, and far more likely a typo.
check('the bounds hold at both ends, inclusive',
  !!LS.customLotSize(LS.LOT_MIN_FT, LS.LOT_MAX_FT)
  && LS.customLotSize(LS.LOT_MIN_FT - 0.1, 100) === null
  && LS.customLotSize(100, LS.LOT_MAX_FT + 0.1) === null,
  JSON.stringify([LS.LOT_MIN_FT, LS.LOT_MAX_FT]));
check('and a blank, a word or a NaN is refused rather than drawn',
  ['', 'forty', NaN, null, undefined, Infinity]
    .every(bad => LS.customLotSize(bad, 100) === null && LS.customLotSize(100, bad) === null),
  'something other than a number was accepted');

// FEET ARE STORED, METRIC IS A UNIT: 13.7 m and 44'-11 3/8" are one lot said
// two ways, so a drafter who flips the switch must not find his lot line has
// moved. The conversion is rounded to the inch -- finer than any lot on this
// page is surveyed to, and the difference between a dimension someone typed
// and one that prints as 44'-11 3/8".
check('a metric typed lot converts to feet, rounded to the inch',
  near(LS.customLotSize(13.7, 36.6, { metric: true }).widthFt,
    Math.round(LS.feetOfMetres(13.7) * 12) / 12),
  JSON.stringify(LS.customLotSize(13.7, 36.6, { metric: true })));
check('and 13.7 m is the same lot as 45 ft to within an inch',
  Math.abs(LS.customLotSize(13.7, 36.6, { metric: true }).widthFt - 45) < 1 / 12 + 0.01,
  String(LS.customLotSize(13.7, 36.6, { metric: true }).widthFt));
// THE TWO CONVERSIONS ARE NOT INVERSES, and that is the design rather than a
// rounding bug to chase: `metresOf` is what a TILE PRINTS, rounded to a tenth
// of a metre because "13.716 m" on a menu is noise; `feetOfMetres` is what a
// TYPED field is read with, and it is exact. So the round trip lands inside
// that tenth and no closer -- and the lot itself never moves, because what is
// stored is always the feet.
check('metres round-trip to within the tenth the tile prints, and no further',
  (() => { const back = LS.feetOfMetres(LS.metresOf(45));
           return Math.abs(back - 45) <= LS.feetOfMetres(0.05) + 1e-9
             && Math.abs(back - 45) > 0; })(),
  String(LS.feetOfMetres(LS.metresOf(45))));
check('and the exact conversion is the one a typed metric field goes through',
  near(LS.feetOfMetres(1), 1 / 0.3048, 1e-9),
  String(LS.feetOfMetres(1)));

check('lotSizeFor takes a tier id or the typed pair, and nothing else',
  LS.lotSizeFor('L').widthFt === 45
  && LS.lotSizeFor('custom', 50, 110).widthFt === 50
  && LS.lotSizeFor('nonsense') === null,
  JSON.stringify([LS.lotSizeFor('L'), LS.lotSizeFor('custom', 50, 110)]));

// ── THE RECTANGLE ────────────────────────────────────────────────────────
//
// FRONTAGE ACROSS, DEPTH BACK, which is the arithmetic rather than a taste:
// a 45x120 drawn 120 across is 45 deep, and a 20 ft front setback in front of
// the premade bungalow's 40 ft depth would put the back of the house fifteen
// feet beyond the rear lot line.
check('the rectangle lays the frontage across and the depth back',
  (() => { const b = box(LS.lotRectanglePoints(45, 120));
           return near(b.x1 - b.x0, 45) && near(b.z1 - b.z0, 120); })(),
  JSON.stringify(box(LS.lotRectanglePoints(45, 120))));
check('it is four corners, centred where it is told',
  (() => { const pts = LS.lotRectanglePoints(40, 100, { centerX: 10, centerZ: -5 });
           const b = box(pts);
           return pts.length === 4 && near((b.x0 + b.x1) / 2, 10) && near((b.z0 + b.z1) / 2, -5); })(),
  JSON.stringify(LS.lotRectanglePoints(40, 100, { centerX: 10, centerZ: -5 })));
check('and a size that is not a size draws nothing',
  LS.lotRectanglePoints(0, 100) === null && LS.lotRectanglePoints(45, NaN) === null,
  'a degenerate rectangle was returned');

// ── THE SETBACKS (Movie, 13 Oct) ─────────────────────────────────────────
//
// The side is the LOOSER of two rules: 4 ft where there are windows, 2'-6"
// where the wall is blank, but never closer than 2 ft to the eave. With the
// usual 2 ft overhang that is 4 ft either way, which is his "in most cases
// even with no windows the distance will be 4ft".
check('the front setback is his 20 ft',
  LS.FRONT_SETBACK_FT === 20, String(LS.FRONT_SETBACK_FT));
check('a windowed wall takes 4 ft',
  near(LS.sideSetbackFt({ windowed: true, eaveFt: 2 }), 4),
  String(LS.sideSetbackFt({ windowed: true, eaveFt: 2 })));
check('a blank wall with the usual 2 ft eave still takes 4 ft -- his own words',
  near(LS.sideSetbackFt({ windowed: false, eaveFt: 2 }), 4),
  String(LS.sideSetbackFt({ windowed: false, eaveFt: 2 })));
// THE EAVE RULE IS WHAT BITES ON A DEEP OVERHANG, and it is the only reason
// the blank-wall number is not simply 2'-6".
check('a blank wall with a short eave drops to the 2 ft 6 wall rule',
  near(LS.sideSetbackFt({ windowed: false, eaveFt: 0 }), LS.SIDE_SETBACK_BLANK_FT),
  String(LS.sideSetbackFt({ windowed: false, eaveFt: 0 })));
check('and a 4 ft eave pushes the wall out past both rules',
  near(LS.sideSetbackFt({ windowed: true, eaveFt: 4 }), 4 + LS.EAVE_CLEAR_FT),
  String(LS.sideSetbackFt({ windowed: true, eaveFt: 4 })));

// ── WHERE THE LOT LANDS ROUND THE HOUSE ──────────────────────────────────
//
// THE LOT MOVES, NOT THE HOUSE. A drafter being asked how big his lot is
// must not have his building carried twenty feet by the answer, so this
// returns the lot's corners against a house that stays where it is.
const HOUSE = { leftX: -16, frontZ: 20, datumZ: 20 };
const placed = LS.placeLotFor(45, 120, HOUSE, { windowed: true, eaveFt: 2 });
check('the front lot line sits 20 ft in front of the house datum',
  near(box(placed).z1, HOUSE.datumZ + LS.FRONT_SETBACK_FT),
  JSON.stringify(box(placed)));
check('the left lot line sits one side setback left of the house',
  near(box(placed).x0, HOUSE.leftX - LS.sideSetbackFt({ windowed: true, eaveFt: 2 })),
  JSON.stringify(box(placed)));
check('and the lot it places is the size it was asked for',
  near(box(placed).x1 - box(placed).x0, 45)
  && near(box(placed).z1 - box(placed).z0, 120),
  JSON.stringify(box(placed)));
// WITH NO HOUSE there is nothing to set back from, so it is the centred
// rectangle -- which is what a drafter drawing the lot first gets.
check('with no house to place against it is the plain centred rectangle',
  JSON.stringify(LS.placeLotFor(45, 120, null)) === JSON.stringify(LS.lotRectanglePoints(45, 120)),
  JSON.stringify(LS.placeLotFor(45, 120, null)));

// ── READING THE DRAWING ──────────────────────────────────────────────────
//
// The lot is an outline carrying site:true, and that flag is what keeps it
// out of every reader that treats an outline as a BUILDING.
const LOT = { site: true, points: [{ x: -100, z: -100 }, { x: 100, z: -100 },
  { x: 100, z: 100 }, { x: -100, z: 100 }] };
const BODY = { points: [{ x: -16, z: -20 }, { x: 16, z: -20 },
  { x: 16, z: 20 }, { x: -16, z: 20 }] };
check('the house face is read off the buildings, never off the lot',
  (() => { const face = LS.houseFaceOf([LOT, BODY]);
           return near(face.leftX, -16) && near(face.frontZ, 20); })(),
  JSON.stringify(LS.houseFaceOf([LOT, BODY])));
check('and the centre of what is drawn skips the lot too',
  (() => { const c = LS.centreOfOutlines([LOT, BODY]);
           return near(c.centerX, 0) && near(c.centerZ, 0); })(),
  JSON.stringify(LS.centreOfOutlines([LOT, BODY])));
check('a drawing with nothing in it answers null rather than zero',
  LS.houseFaceOf([]) === null && LS.centreOfOutlines([LOT]) === null,
  'an empty drawing was given a face or a centre');
check('siteOutlineOf finds the lot and only the lot',
  LS.siteOutlineOf([BODY, LOT]) === LOT && LS.siteOutlineOf([BODY]) === null,
  'the site outline lookup read the wrong outline');

// THE GREEN TARGET STANDS WHERE E1 AND E2 CROSS -- Movie: "it should be
// located at the corne were E1 and E2 are front and left side corner". E1 is
// on the south edge (largest z) and E2 on the west (smallest x), so the
// corner they share is min x / max z.
check('the site datum is the front-left corner, where E1 meets E2',
  (() => { const d = LS.siteDatumOf(LOT); return near(d.x, -100) && near(d.z, 100); })(),
  JSON.stringify(LS.siteDatumOf(LOT)));
// READ OFF THE POINTS, so it follows the corner after the lot has been
// dragged into an odd shape -- which is the whole reason the lot is an
// outline rather than a stored pair of numbers.
check('and it follows the corner when the lot is dragged out of square',
  (() => { const odd = { site: true, points: [{ x: -60, z: 90 }, { x: 40, z: 100 },
    { x: 50, z: -80 }, { x: -70, z: -60 }] };
           const d = LS.siteDatumOf(odd);
           return near(d.x, -60) && near(d.z, 90); })(),
  JSON.stringify(LS.siteDatumOf({ site: true, points: [{ x: -60, z: 90 }] })));
check('a lot with no points has no datum rather than a NaN one',
  LS.siteDatumOf({ site: true, points: [] }) === null && LS.siteDatumOf(null) === null,
  'a datum was invented for a lot with no corners');

// ── TOO SMALL FOR WHAT IS DRAWN ──────────────────────────────────────────
//
// Movie, 14 Oct, having put a 25 ft lot under a 30 ft garage: "can it figure
// out the house width and not allow lots that are too small from the
// selections", and then the number itself -- "for that 30 for garage with 2ft
// overhangs would be min 38 min".
//
// HIS 38 IS THE CHECK. A rule that merely refuses SOME lots would pass a
// dozen vaguer assertions; this one has to land on the same figure he did.
const GARAGE = { points: [{ x: 0, z: 0 }, { x: 30, z: 0 },
  { x: 30, z: 24 }, { x: 0, z: 24 }] };
check('a 30 ft building reads 30 wide and 24 deep off its outline',
  (() => { const box = LS.houseBoxOf([LOT, GARAGE]);
           return near(box.widthFt, 30) && near(box.depthFt, 24); })(),
  JSON.stringify(LS.houseBoxOf([LOT, GARAGE])));
check('and with 2 ft eaves it needs a 38 ft lot, his own number',
  near(LS.minLotFor(LS.houseBoxOf([GARAGE]), { eaveFt: 2 }).widthFt, 38),
  JSON.stringify(LS.minLotFor(LS.houseBoxOf([GARAGE]), { eaveFt: 2 })));
// THE DEPTH IS THE FRONT SETBACK PLUS THE BUILDING, and no rear yard is
// invented: 20 + 24.
check('the depth it needs is the front setback plus the building',
  near(LS.minLotFor(LS.houseBoxOf([GARAGE]), { eaveFt: 2 }).depthFt, 44),
  JSON.stringify(LS.minLotFor(LS.houseBoxOf([GARAGE]), { eaveFt: 2 })));
// A SHORTER EAVE BUYS BACK THE WIDTH ONLY WHERE THE WALL RULE LETS IT. The
// side setback is max(wall, eave + 2) and a WINDOWED wall is 4 ft on its own
// -- so a 1 ft eave still needs 38 beside windows, and only a blank wall
// (2'-6") comes in at 36. Movie's own two rules, meeting.
check('a 1 ft eave still needs 38 beside windows, because the wall rule is 4',
  near(LS.minLotFor(LS.houseBoxOf([GARAGE]), { eaveFt: 1 }).widthFt, 38),
  JSON.stringify(LS.minLotFor(LS.houseBoxOf([GARAGE]), { eaveFt: 1 })));
check('and a blank wall with a 1 ft eave comes in at 36',
  near(LS.minLotFor(LS.houseBoxOf([GARAGE]), { eaveFt: 1, windowed: false }).widthFt, 36),
  JSON.stringify(LS.minLotFor(LS.houseBoxOf([GARAGE]), { eaveFt: 1, windowed: false })));

const fits = id => LS.lotFitsHouse(LS.lotTierById(id), LS.houseBoxOf([GARAGE]), { eaveFt: 2 });
check('S and M are too small for that garage, and L up are not',
  fits('S') === false && fits('M') === false && fits('L') === true && fits('XL') === true,
  [fits('S'), fits('M'), fits('L'), fits('XL')].join());
// FIRST TO FIT, NOT BIGGEST (Movie: "make the most appropriate size brighter
// (first size to fit)"), and the tiers are ascending so the first IS the
// smallest that holds him.
check('the one to point at is L, the first that fits',
  LS.bestLotTierFor(LS.houseBoxOf([GARAGE]), { eaveFt: 2 })?.id === 'L',
  JSON.stringify(LS.bestLotTierFor(LS.houseBoxOf([GARAGE]), { eaveFt: 2 })));
// NOTHING DRAWN, NOTHING JUDGED ("if no house drawn all would be allowed
// nothing lighten up or faded").
check('with nothing drawn every size is allowed and none is brightest',
  LS.minLotFor(null) === null && LS.bestLotTierFor(null) === null
    && LS.lotFitsHouse(LS.lotTierById('S'), null) === true
    && LS.houseBoxOf([LOT]) === null,
  'an empty drawing was judged against a building it does not have');
// AND A BUILDING PAST THE WHOLE TABLE POINTS AT NOTHING rather than at the
// biggest tier: 80 ft of lot cannot hold a 90 ft building, and brightening
// XXXL would be the card recommending a lot that does not fit either.
check('a building wider than every tier brightens none of them',
  LS.bestLotTierFor({ widthFt: 90, depthFt: 40 }, { eaveFt: 2 }) === null,
  JSON.stringify(LS.bestLotTierFor({ widthFt: 90, depthFt: 40 }, { eaveFt: 2 })));

// AND THE SENTENCE FOR AN ODD-SHAPED LOT, which is the third thing Movie
// asked the card to do: "tell them they will need to adjust the 'AUTOSITE'
// if it isn't square".
check('there is a sentence to show about adjusting the AUTOSITE',
  typeof LS.AUTOSITE_NOTE === 'string' && /AUTOSITE/i.test(LS.AUTOSITE_NOTE),
  JSON.stringify(LS.AUTOSITE_NOTE));

console.log(`lot sizes harness: ${passed} checks passed, ${failures.length} failed`);
if (failures.length) {
  failures.forEach(line => console.log(`  ✘ ${line}`));
  process.exit(1);
}
