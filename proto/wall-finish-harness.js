// WHAT A WALL WEARS -- the record behind "the bottom 3 ft of that wall in
// ledgestone", and the rules that read it back.
//
//   node proto/wall-finish-harness.js
//   node proto/wall-finish-harness.js --mutate   break it, prove each break is caught
//
// TWO FILES, ONE SUBJECT. wall-types.js holds the vocabulary and answers WHAT
// a wall wears at a height; drawing-format.js decides whether a stored record
// is well formed enough to ask. They are checked together because a rule that
// resolves a band the format would have dropped is a rule about nothing.
//
// Movie, 26 Sep: *"i'd like to make it easy to for instance choose the bottom
// 3 ft of a certain wall for LEDGESTONE"*, and *"those changes will change the
// FULL WALL or full house if its the DEFAULT wall they are changing"*. So there
// are two scales and this is both of them: a BASE finish over the whole wall,
// and BANDS between two heights laid over that base.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const MUTATION_MODE = require('./harness-args.js').mutationMode();
const ROOT = path.join(__dirname, '..');
const read = name => fs.readFileSync(path.join(ROOT, name), 'utf8');

// THE MUTATOR SEES BOTH FILES AT ONCE, keyed by name, so a mutation says which
// one it is breaking. A mutation that matched nothing in either is a mutation
// that proves nothing, and load() says so rather than reporting a pass.
function load(mutate) {
  let src = { 'wall-types.js': read('wall-types.js'),
    'drawing-format.js': read('drawing-format.js') };
  if (mutate) {
    const next = mutate({ ...src });
    if (next['wall-types.js'] === src['wall-types.js']
      && next['drawing-format.js'] === src['drawing-format.js']) {
      throw new Error('mutation matched nothing -- it would prove nothing');
    }
    src = next;
  }
  const win = {};
  const sandbox = { window: win, console, Math, Number, String, Object, Array, JSON,
    isFinite, parseFloat, Set, Map, Boolean, RegExp, Error, Date };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  for (const name of ['wall-types.js', 'drawing-format.js']) {
    vm.runInContext(src[name], sandbox, { filename: name });
  }
  return win;
}

function run(win) {
  const missed = [];
  const check = (label, ok, detail) => {
    if (!ok) missed.push({ label, detail });
    if (!MUTATION_MODE) console.log(`${ok ? 'ok  ' : 'FAIL'}  ${label}${detail ? `   ${detail}` : ''}`);
    return ok;
  };
  const T = win.DraftWallTypes;
  const FORMAT = win.DraftDrawingFormat;
  if (!T?.finishAtFt || !FORMAT?.walls) {
    missed.push({ label: 'both modules load and export what this asks',
      detail: `${!!T?.finishAtFt} ${!!FORMAT?.walls}` });
    return missed;
  }

  // ── THE ENV EVERY NORMALISE CALL TAKES ────────────────────────────────
  // drawing-format.js reads no table off `window` on purpose -- its own note:
  // "Reading window.DraftWallTypes here would put a load-order dependency into
  // the module that every page loads first". So the finish vocabulary arrives
  // the same way the wall types do, and this env is what a page hands it.
  const LEVELS = new Set([1]);
  const env = {
    wallTypes: T.WALL_TYPES,
    finishIds: T.EXTERIOR_FINISHES.map(f => f.id),
    defaultWallTopFt: 8,
  };
  const SEG = { id: 'w1', levelId: 1, start: { x: 0, z: 0 }, end: { x: 10, z: 0 } };
  const one = extra => FORMAT.walls([{ ...SEG, ...extra }], LEVELS, env)[0];

  // ── AN UNTOUCHED WALL GROWS NOTHING ───────────────────────────────────
  // The house rule from drawing-format.js's own walls(): conditional keys,
  // never invented. Every drawing in existence predates this field, and a
  // normaliser that writes `finish: 'stucco'` onto all of them turns an open
  // of an old file into a migration -- every wall dirty, every save rewritten,
  // and no way to tell a drafter's stucco from a default one afterwards.
  const plain = one({});
  check('fixture: a wall with no finish set is still a wall',
    !!plain && plain.id === 'w1', plain && `${plain.id} ${plain.wallType}`);
  check('and it grows no finish keys at all, so opening an old drawing is not a migration',
    !('finish' in plain) && !('finishColor' in plain) && !('finishBands' in plain),
    Object.keys(plain).filter(k => /finish/i.test(k)).join(',') || '(none)');
  check('and it still reads as the default finish, which is where STUCCO comes from',
    T.finishAtFt(plain, 4).id === T.DEFAULT_FINISH_ID, T.finishAtFt(plain, 4).id);

  // ── THE BASE FINISH: THE WHOLE WALL ───────────────────────────────────
  check('a base finish that is in the table is kept',
    one({ finish: 'brick' }).finish === 'brick', one({ finish: 'brick' }).finish);
  check('and it answers at every height, top to bottom',
    [0, 4, 7.99].every(ft => T.finishAtFt(one({ finish: 'brick' }), ft).id === 'brick'),
    'brick at 0 / 4 / 7.99');
  // DROPPED, NOT DEFAULTED, and the difference shows on the next save: a wall
  // whose id was retired reads as the default either way, but dropping means
  // the file stops carrying a name nothing can draw.
  check('a base finish that is NOT in the table is dropped, so the wall reads default',
    !('finish' in one({ finish: 'terracotta_rainscreen' })),
    JSON.stringify(one({ finish: 'terracotta_rainscreen' }).finish ?? null));

  // ── COLOUR: STORED, AND DRAWN BY NOTHING YET ──────────────────────────
  // Movie, 27 Sep: *"the color should only show in the 3d window"*, then *"we
  // don't have 3d Window yet so COLOR won't show anywhere yet"*, *"we will do
  // 3D later"*. So this is a field waiting for a renderer, and the only thing
  // that can be wrong about it today is the SHAPE of what gets stored.
  //
  // ONE SPELLING. #rrggbb is what <input type="color"> hands back, and folding
  // case here is what stops #AABBCC and #aabbcc being two colours in a legend.
  check('a colour is kept when it is the shape a colour input produces',
    one({ finishColor: '#8b5a2b' }).finishColor === '#8b5a2b',
    one({ finishColor: '#8b5a2b' }).finishColor);
  check('and it is folded to one case, so two spellings are not two colours',
    one({ finishColor: '#8B5A2B' }).finishColor === '#8b5a2b',
    one({ finishColor: '#8B5A2B' }).finishColor);
  check('a colour in any other shape is dropped whole, not half kept',
    ['red', '#abc', '8b5a2b', '#8b5a2bff', '', null, 42]
      .every(raw => !('finishColor' in one({ finishColor: raw }))),
    'red #abc 8b5a2b #8b5a2bff "" null 42');

  // ── A BAND: BETWEEN TWO HEIGHTS ───────────────────────────────────────
  const BAND = { finishId: 'ledgestone', lowFt: 0, highFt: 3 };
  const banded = one({ finishBands: [BAND] });
  check('a band with a finish and two heights is kept',
    banded.finishBands?.length === 1 && banded.finishBands[0].finishId === 'ledgestone',
    JSON.stringify(banded.finishBands));
  check('and it is MEASURED FROM THE BOTTOM OF THE WALL -- "the bottom 3 ft" is 0 to 3',
    banded.finishBands[0].lowFt === 0 && banded.finishBands[0].highFt === 3,
    `${banded.finishBands[0].lowFt} to ${banded.finishBands[0].highFt}`);
  // Each of these claims no wall, or claims wall that is not there. A band is
  // the one record here a drafter can produce by dragging, so a malformed one
  // is a gesture that went wrong rather than a file that was hand-edited --
  // and the safe answer to a gesture that went wrong is nothing, not a guess.
  const bad = [
    ['an unknown finish', { finishId: 'terracotta', lowFt: 0, highFt: 3 }],
    ['a top at its own bottom', { finishId: 'brick', lowFt: 3, highFt: 3 }],
    ['a top BELOW its bottom', { finishId: 'brick', lowFt: 3, highFt: 1 }],
    ['a bottom below the wall', { finishId: 'brick', lowFt: -1, highFt: 3 }],
    ['a height that is not a number', { finishId: 'brick', lowFt: 0, highFt: 'three' }],
    ['no finish named at all', { lowFt: 0, highFt: 3 }],
  ];
  bad.forEach(([why, band]) => check(`a band with ${why} is dropped`,
    !('finishBands' in one({ finishBands: [band] })),
    JSON.stringify(one({ finishBands: [band] }).finishBands ?? null)));
  check('and a bad band takes only itself, leaving the good ones on the wall',
    one({ finishBands: [{ finishId: 'brick', lowFt: 3, highFt: 1 }, BAND] })
      .finishBands?.length === 1,
    JSON.stringify(one({ finishBands: [{ finishId: 'brick', lowFt: 3, highFt: 1 }, BAND] })
      .finishBands));
  check('a wall with no good band left grows no key, rather than an empty list',
    !('finishBands' in one({ finishBands: [{ finishId: 'nope', lowFt: 0, highFt: 3 }] })),
    JSON.stringify(one({ finishBands: [{ finishId: 'nope', lowFt: 0, highFt: 3 }] })
      .finishBands ?? null));
  check('and a band carries its own colour, separately from the wall\'s',
    one({ finishColor: '#ffffff', finishBands: [{ ...BAND, color: '#8b5a2b' }] })
      .finishBands[0].color === '#8b5a2b',
    one({ finishColor: '#ffffff', finishBands: [{ ...BAND, color: '#8b5a2b' }] })
      .finishBands[0].color);

  // ── ORDER IS PAINT ORDER ──────────────────────────────────────────────
  // NOT SORTED BY HEIGHT, and that is the point. A drafter who lays stone to
  // 3 ft and then shake from 2 to 6 gets shake over the top foot of the stone,
  // the same as if they had drawn it in that order. Sorting the list would
  // make the answer depend on which band happened to be lower rather than on
  // what they did last, and there would be no gesture that produces the other
  // result.
  const STONE = { finishId: 'ledgestone', lowFt: 0, highFt: 3 };
  const SHAKE = { finishId: 'shake', lowFt: 2, highFt: 6 };
  const stack = one({ finishBands: [STONE, SHAKE] });
  check('two bands are stored in the order they were laid, not sorted by height',
    stack.finishBands.map(b => b.finishId).join(' > ') === 'ledgestone > shake',
    stack.finishBands.map(b => `${b.finishId}@${b.lowFt}`).join(' '));
  check('and the LAST one laid wins where they overlap',
    T.finishAtFt(stack, 2.5).id === 'shake', T.finishAtFt(stack, 2.5).id);
  check('while the first still owns what the second does not reach',
    T.finishAtFt(stack, 1).id === 'ledgestone', T.finishAtFt(stack, 1).id);
  check('and reversing the order reverses the answer, which is what makes it an order',
    T.finishAtFt(one({ finishBands: [SHAKE, STONE] }), 2.5).id === 'ledgestone',
    T.finishAtFt(one({ finishBands: [SHAKE, STONE] }), 2.5).id);

  // ── WHERE A BAND STARTS AND STOPS ─────────────────────────────────────
  // HALF OPEN, [low, high). Two bands stacked 0-3 and 3-6 share the number 3,
  // and exactly one of them has to own it or the line between them is decided
  // by list order in a place a drafter cannot see. The upper one owns it,
  // which is the same convention as a wall's own base height.
  const wainscot = one({ finishBands: [{ finishId: 'ledgestone', lowFt: 0, highFt: 3 }] });
  check('a band owns its own bottom edge',
    T.finishAtFt(wainscot, 0).id === 'ledgestone', T.finishAtFt(wainscot, 0).id);
  check('and it does NOT own its top edge -- the wall above does',
    T.finishAtFt(wainscot, 3).id === T.DEFAULT_FINISH_ID, T.finishAtFt(wainscot, 3).id);
  check('so two bands meeting at one number do not fight over it',
    ['ledgestone', 'shake'].every((want, i) => T.finishAtFt(
      one({ finishBands: [{ finishId: 'ledgestone', lowFt: 0, highFt: 3 },
        { finishId: 'shake', lowFt: 3, highFt: 6 }] }), [2.99, 3][i]).id === want),
    'ledgestone at 2.99, shake at 3');
  check('and above every band the wall\'s own finish comes back',
    T.finishAtFt(one({ finish: 'brick', finishBands: [BAND] }), 5).id === 'brick',
    T.finishAtFt(one({ finish: 'brick', finishBands: [BAND] }), 5).id);

  // ── WHICH COLOUR COMES BACK ───────────────────────────────────────────
  const twoTone = one({ finishColor: '#eeeeee',
    finishBands: [{ ...BAND, color: '#8b5a2b' }] });
  check('inside a band its own colour answers',
    T.finishAtFt(twoTone, 1).color === '#8b5a2b', T.finishAtFt(twoTone, 1).color);
  check('and above it the wall\'s colour does',
    T.finishAtFt(twoTone, 5).color === '#eeeeee', T.finishAtFt(twoTone, 5).color);
  check('a band with no colour of its own falls back on the wall\'s',
    T.finishAtFt(one({ finishColor: '#eeeeee', finishBands: [BAND] }), 1).color === '#eeeeee',
    T.finishAtFt(one({ finishColor: '#eeeeee', finishBands: [BAND] }), 1).color);
  check('and a wall with no colour anywhere answers null, not a made-up one',
    T.finishAtFt(plain, 4).color === null, JSON.stringify(T.finishAtFt(plain, 4).color));

  // ── AND WHETHER THE BAND IS CAPPED ────────────────────────────────────
  // Movie's own test, given in the same breath as the ledge itself: *"(if its
  // not at top of wall)"*, *"at top of the wall won't need a legde"*.
  check('a stone band that stops short of the wall top is capped',
    T.bandIsCapped(STONE, 8) === true, `${STONE.highFt} under 8`);
  check('and one that reaches the top is not -- there is nothing to terminate',
    T.bandIsCapped({ finishId: 'ledgestone', lowFt: 0, highFt: 8 }, 8) === false,
    '8 under 8');
  check('a band of something with no cap in the table takes none, wherever it stops',
    T.bandIsCapped({ finishId: 'shake', lowFt: 0, highFt: 3 }, 8) === false,
    'shake to 3 of 8');
  check('and every masonry band IS capped when it stops short, all five of them',
    T.MASONRY_FINISH_IDS.every(id => T.bandIsCapped({ finishId: id, lowFt: 0, highFt: 3 }, 8)),
    T.MASONRY_FINISH_IDS.join(' '));
  // A BASE FINISH IS NEVER CAPPED: it runs the whole wall by definition, so it
  // has no top to stop short at. Asked as a fact about the BAND argument
  // because that is the shape the painter's question has -- there is no band,
  // so there is no cap, whatever the material is.
  check('the base finish is never capped, having no top of its own to stop at',
    T.bandIsCapped(null, 8) === false && T.bandIsCapped(undefined, 8) === false,
    'null / undefined');
  check('and a cap needs a wall top to be measured against, or it answers no',
    T.bandIsCapped(STONE, null) === false && T.bandIsCapped(STONE, undefined) === false,
    'null / undefined wall top');

  // ── WHAT IS ON THIS WALL, FOR A LEGEND ────────────────────────────────
  check('a bare wall names one finish -- the default it is wearing',
    T.finishesOnWall(plain).join(' ') === T.DEFAULT_FINISH_ID,
    T.finishesOnWall(plain).join(' '));
  check('and a banded wall names its base and every band',
    T.finishesOnWall(stack).join(' ') === 'stucco ledgestone shake',
    T.finishesOnWall(stack).join(' '));
  check('and names each once, so a legend does not print a material twice',
    T.finishesOnWall(one({ finish: 'brick',
      finishBands: [{ finishId: 'brick', lowFt: 0, highFt: 3 }] })).join(' ') === 'brick',
    T.finishesOnWall(one({ finish: 'brick',
      finishBands: [{ finishId: 'brick', lowFt: 0, highFt: 3 }] })).join(' '));

  // ── AND IT ALL SURVIVES A ROUND TRIP ──────────────────────────────────
  // The record is only worth anything if it comes back. Normalise, stringify,
  // parse, normalise again: what a save and an open do to it.
  const rich = one({ finish: 'siding_h', finishColor: '#eeeeee',
    finishBands: [STONE, { ...SHAKE, color: '#8b5a2b' }] });
  const reopened = FORMAT.walls([JSON.parse(JSON.stringify(rich))], LEVELS, env)[0];
  check('a wall with a base, a colour and two bands survives save and open unchanged',
    JSON.stringify(reopened) === JSON.stringify(rich),
    JSON.stringify(reopened.finishBands));
  check('and it still answers the same finish at the same height afterwards',
    [0.5, 2.5, 7].every(ft => T.finishAtFt(reopened, ft).id === T.finishAtFt(rich, ft).id),
    [0.5, 2.5, 7].map(ft => `${ft}:${T.finishAtFt(reopened, ft).id}`).join(' '));

  return missed;
}

// EXACTLY ONCE, AND THIS ENGINE CHECKS ITS OWN. mutant-anchors-harness.js
// finds a mutant file's subject by reading a single `const SRC`, so an engine
// that mutates TWO files is one it can only report as uncovered (board #57). It
// matters because `String.replace` takes the FIRST match: an anchor that occurs
// twice mutates a line its label does not name, the mutant still dies, and it
// dies on the wrong claim. So every mutation below goes through here.
const sub = (src, file, find, repl) => {
  const hits = src[file].split(find).length - 1;
  if (hits !== 1) {
    throw new Error(`AMBIGUOUS ANCHOR: matches ${hits}x in ${file} -- ${
      find.replace(/\n/g, ' ').slice(0, 64)}`);
  }
  return { ...src, [file]: src[file].replace(find, repl) };
};

const MUTATIONS = [
  // ── THE RECORD ──────────────────────────────────────────────────────
  ['an untouched wall is written a finish, so opening an old drawing dirties every wall',
    s => sub(s, 'drawing-format.js',
      '      ...(base ? { finish: base } : {}),',
      "      finish: base || 'stucco',")],
  ['an unknown finish id is kept, so a file carries a name nothing can draw',
    s => sub(s, 'drawing-format.js',
      "    const base = ids.includes(wall?.finish) ? wall.finish : null;",
      '    const base = wall?.finish || null;')],
  ['a colour is stored however it was typed, so two spellings are two colours',
    s => sub(s, 'drawing-format.js',
      '(HEX.test(String(raw ?? \'\')) ? String(raw).toLowerCase() : null)',
      '(raw ? String(raw) : null)')],
  ['the colour shape stops being checked, so a legend gets "red" and "#abc" too',
    s => sub(s, 'drawing-format.js',
      "const HEX = /^#[0-9a-f]{6}$/i;", 'const HEX = /^#?[0-9a-z]*$/i;')],
  ['a band with no height at all is kept, so it claims a strip of nothing',
    s => sub(s, 'drawing-format.js',
      '    if (!id || !Number.isFinite(lo) || !Number.isFinite(hi) || hi <= lo || lo < 0) return null;',
      '    if (!id) return null;')],
  ['an inverted band is kept, so its top is below its bottom',
    s => sub(s, 'drawing-format.js',
      '|| hi <= lo || lo < 0) return null;', ') return null;')],
  ['a band naming an unknown finish is kept',
    s => sub(s, 'drawing-format.js',
      '    const id = ids.includes(raw?.finishId) ? raw.finishId : null;',
      '    const id = raw?.finishId || null;')],
  ['one bad band takes the good ones down with it',
    s => sub(s, 'drawing-format.js',
      '      .map(band => finishBand(band, ids)).filter(Boolean);',
      '      .map(band => finishBand(band, ids));\n'
      + '    if (bands.some(band => !band)) bands.length = 0;')],
  ['an empty band list is written anyway, so a wall carries a key meaning nothing',
    s => sub(s, 'drawing-format.js',
      '      ...(bands.length ? { finishBands: bands } : {}),',
      '      finishBands: bands,')],
  ['the bands are sorted by height, so what the drafter did last stops deciding',
    s => sub(s, 'drawing-format.js',
      '      .map(band => finishBand(band, ids)).filter(Boolean);',
      '      .map(band => finishBand(band, ids)).filter(Boolean)\n'
      + '      .sort((a, b) => a.lowFt - b.lowFt);')],
  ['a band loses its own colour, so a two-tone wall is one colour',
    s => sub(s, 'drawing-format.js',
      "      ...(bandColor ? { color: bandColor } : {}) };", '    };')],

  // ── THE RESOLUTION ──────────────────────────────────────────────────
  ['the bands are read low to high, so the FIRST laid wins instead of the last',
    s => sub(s, 'wall-types.js',
      '    for (let i = bands.length - 1; i >= 0; i -= 1) {',
      '    for (let i = 0; i < bands.length; i += 1) {')],
  ['a band owns its top edge as well, so two stacked bands fight over the line',
    s => sub(s, 'wall-types.js',
      '      if (ft >= band.lowFt && ft < band.highFt) {',
      '      if (ft >= band.lowFt && ft <= band.highFt) {')],
  ['a band stops owning its own bottom, so the wall shows through at the line',
    s => sub(s, 'wall-types.js',
      '      if (ft >= band.lowFt && ft < band.highFt) {',
      '      if (ft > band.lowFt && ft < band.highFt) {')],
  ['the base finish stops answering, so every unbanded wall draws as stucco',
    s => sub(s, 'wall-types.js',
      "    return Object.freeze({ id: wall?.finish || DEFAULT_FINISH_ID, band: null,",
      '    return Object.freeze({ id: DEFAULT_FINISH_ID, band: null,')],
  ['a band answers the wall\'s colour instead of its own, so two-tone is flat',
    s => sub(s, 'wall-types.js',
      "          color: band.color || wall?.finishColor || null });",
      '          color: wall?.finishColor || null });')],
  ['a missing colour comes back as a made-up one instead of nothing',
    s => sub(s, 'wall-types.js',
      "    return Object.freeze({ id: wall?.finish || DEFAULT_FINISH_ID, band: null,\n"
      + "      color: wall?.finishColor || null });",
      "    return Object.freeze({ id: wall?.finish || DEFAULT_FINISH_ID, band: null,\n"
      + "      color: wall?.finishColor || '#ffffff' });")],

  // ── THE CAP ─────────────────────────────────────────────────────────
  ['every band is capped, so stone carried to the soffit grows a ledge under it',
    s => sub(s, 'wall-types.js',
      '    return Number.isFinite(wallHighFt) && band.highFt < wallHighFt - 1e-6;',
      '    return true;')],
  ['no band is capped, so a wainscot stops on an open joint',
    s => sub(s, 'wall-types.js',
      '    return Number.isFinite(wallHighFt) && band.highFt < wallHighFt - 1e-6;',
      '    return false;')],
  ['a band that reaches the top is capped anyway, by a hair of float error',
    s => sub(s, 'wall-types.js',
      'band.highFt < wallHighFt - 1e-6;', 'band.highFt <= wallHighFt;')],
  ['siding gets a stone water table, because the table stops being consulted',
    s => sub(s, 'wall-types.js',
      '    if (!band || !finishById(band.finishId)?.cap) return false;',
      '    if (!band) return false;')],
  ['the base finish is capped too, so every wall grows a ledge at its bottom',
    s => sub(s, 'wall-types.js',
      '    if (!band || !finishById(band.finishId)?.cap) return false;',
      '    if (!band) return true;\n'
      + '    if (!finishById(band.finishId)?.cap) return false;')],
  ['a missing wall top means capped rather than not, so a painter with no top caps anyway',
    s => sub(s, 'wall-types.js',
      '    return Number.isFinite(wallHighFt) && band.highFt < wallHighFt - 1e-6;',
      '    return !Number.isFinite(wallHighFt) || band.highFt < wallHighFt - 1e-6;')],

  // ── THE LEGEND ──────────────────────────────────────────────────────
  ['the legend forgets the base finish and lists only the bands',
    s => sub(s, 'wall-types.js',
      "    wall?.finish || DEFAULT_FINISH_ID,\n", '')],
  ['the legend forgets the bands and lists only the base',
    s => sub(s, 'wall-types.js',
      "    ...(Array.isArray(wall?.finishBands) ? wall.finishBands.map(b => b.finishId) : []),\n",
      '')],
  ['the legend prints a material once per band that uses it',
    s => sub(s, 'wall-types.js',
      '  ].filter((id, i, all) => all.indexOf(id) === i));', '  ]);')],
];

console.log('\n' + 'mutation'.padEnd(78) + 'caught by');
let survivors = 0, broken = 0;
for (const [label, mutate] of MUTATIONS) {
  let by;
  try {
    const m = run(load(mutate));
    if (!m.length) survivors += 1;
    by = m.length ? m[0].label : '!!! SURVIVED -- nothing here says this is wrong';
  } catch (error) {
    broken += 1;
    by = `!!! MUTATION DID NOT APPLY: ${error.message}`;
  }
  console.log(label.padEnd(78) + by);
}
console.log(`\n${MUTATIONS.length - survivors - broken}/${MUTATIONS.length} mutations caught`);
if (broken) console.log(`${broken} mutation(s) never applied -- they prove nothing`);

if (!MUTATION_MODE) {
  const missed = run(load(null));
  console.log(missed.length
    ? `\nwall finish harness: ${missed.length} check(s) FAILED`
    : '\nwall finish harness: all checks passed');
  process.exit(missed.length ? 1 : 0);
}
process.exit(survivors || broken ? 1 : 0);
