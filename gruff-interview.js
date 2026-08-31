// GRUFF'S INTERVIEW ENGINE (board #323) — the professor takes the order.
//
// Press the bone and you get a whole house with no questions asked. THEN
// Gruff rolls up and starts asking, and every answer tightens the house he
// would have built anyway. Silence is a valid answer: at every rung the
// program is complete, because whatever nobody said falls to a
// crowd-pleasing default.
//
// Pure and DOM-free, in the style of room-grow.js: the board displays what
// this hands it, and every word Gruff says lives here rather than in the
// board. No AI, no cloud, no network — a scripted tree. The only "random"
// is his choice of opener, and that is seeded so the same interview reads
// the same way twice.
//
// This module also owns PLACEMENT. The client never points at the drawing;
// they say "front" or "by the stairs" and the zone resolver below turns
// that into the stamp coordinates room-grow already consumes. One placement
// path, and this is it.
if (!window.DraftGruffInterview) {
(() => {
  // ── Zones: the only spatial vocabulary the client ever needs ───────────
  // The compass matches the section marks — E1 is the front (+z), E3 the
  // back, E2 left, E4 right — so "front" here and "front" on the elevation
  // are the same wall.
  const ZONES = Object.freeze(['front', 'back', 'left', 'right', 'by the stairs']);

  // Every question in the critical ladder, in the order the office asks
  // them: the answers that move the most house come first.
  const CRITICAL_LADDER = Object.freeze(['storeys', 'bedrooms', 'bathrooms', 'entry']);

  // How often Gruff mentions the bone. Often enough that nobody feels
  // trapped in the queue; rare enough that it is not nagging.
  const REMINDER_EVERY = 4;

  // What the bone builds when nobody says otherwise (#315).
  const DEFAULTS = Object.freeze({
    storeys: 2, bedrooms: 3, bathrooms: 2, entry: 'front',
    primarySuite: true, primaryZone: 'back', ensuite: 'three-piece', walkIn: true,
    bedroomZone: 'back', kitchenZone: 'back', livingZone: 'front',
    diningRoom: true, diningZone: 'front',
    laundryStorey: 1, laundryZone: 'by the stairs',
    officeDen: false, officeZone: 'front',
    pantry: true, mudroom: true, mudroomZone: 'by the stairs',
    closets: 'standard', windows: 'balanced', storage: false,
  });

  // ── Gruff's voice ─────────────────────────────────────────────────────
  // Short lines. A dot-matrix strip is not a paragraph.
  const REMINDERS = Object.freeze([
    'Press the bone any time — I finish the rest from here.',
    'Bone whenever you like. I fill in whatever you have not said.',
    'No rush. Hit the bone and I take it from there.',
    'You can stop me at the bone. Nothing is left blank.',
  ]);
  const RE_ASKS = Object.freeze([
    'Did not catch that one. Once more?',
    'That one got past me — try again?',
    'Say again for the old goat?',
  ]);
  const DONE_LINES = Object.freeze([
    'That is the whole order. Press the bone and I will build it.',
    'Nothing left to ask. The bone is yours.',
    'Order is up. Hit the bone whenever you are ready.',
  ]);

  // Tiny seeded PRNG: same seed, same flavour, every run.
  const pick = (list, seed) => {
    let t = (seed >>> 0) + 0x6d2b79f5;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return list[(((t ^ (t >>> 14)) >>> 0) % list.length)];
  };

  // ── Tolerant parsing ──────────────────────────────────────────────────
  // The board types what the client said; nothing here should ever be a
  // dead end. "3", "three", "3 bedrooms" and "about three" all land.
  const WORD_NUMBERS = Object.freeze({
    none: 0, zero: 0, one: 1, a: 1, single: 1, two: 2, couple: 2, three: 3,
    few: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  });
  const YES = /\b(y|yes|yeah|yep|yup|sure|ok|okay|please|aye|do|definitely|course)\b/i;
  const NO = /\b(n|no|nope|nah|none|skip|never|without|don'?t)\b/i;

  const parseCount = text => {
    const s = String(text ?? '').toLowerCase();
    const digits = s.match(/-?\d+/);
    if (digits) return Math.max(0, parseInt(digits[0], 10));
    // Longest word first, or the bare "a" in "a couple" answers before
    // "couple" does and two becomes one.
    const words = Object.entries(WORD_NUMBERS).sort((x, y) => y[0].length - x[0].length);
    for (const [word, value] of words) {
      if (new RegExp(`\\b${word}\\b`).test(s)) return value;
    }
    return null;
  };
  const parseYesNo = text => {
    const s = String(text ?? '');
    // NO is checked first: "no thanks" contains neither a yes word nor a
    // trap, but "not really" would match nothing at all if yes went first.
    if (NO.test(s)) return false;
    if (YES.test(s)) return true;
    return null;
  };
  const parseZone = text => {
    const s = String(text ?? '').toLowerCase();
    if (/\bstair|\bstairs\b|by the stairs|near the stairs/.test(s)) return 'by the stairs';
    if (/\bfront\b|\bstreet\b|\bforward\b|\bfacing\b/.test(s)) return 'front';
    if (/\bback\b|\brear\b|\byard\b|\bbehind\b/.test(s)) return 'back';
    if (/\bleft\b|\bport\b|\bwest\b/.test(s)) return 'left';
    if (/\bright\b|\bstarboard\b|\beast\b/.test(s)) return 'right';
    return null;
  };
  const parseChoice = (text, options) => {
    const s = String(text ?? '').toLowerCase().trim();
    if (!s) return null;
    const exact = options.find(opt => String(opt).toLowerCase() === s);
    if (exact) return exact;
    const loose = options.find(opt => s.includes(String(opt).toLowerCase())
      || String(opt).toLowerCase().includes(s));
    return loose || null;
  };

  const parseAnswer = (question, value) => {
    if (!question) return null;
    switch (question.kind) {
      case 'count': return parseCount(value);
      case 'yesno': return parseYesNo(value);
      case 'zone': return parseZone(value);
      case 'choice': return parseChoice(value, question.options || []);
      default: return null;
    }
  };

  // ── The question catalogue ────────────────────────────────────────────
  // `when` decides whether a question is live at all; `settled` lets the
  // DRAWING answer it, so Gruff never asks what he can already see. A
  // settled question with a value the drawing only implies comes back as a
  // confirm rather than a cold ask.
  const num = value => (Number.isFinite(value) ? value : null);
  const answered = (state, id) => Object.prototype.hasOwnProperty.call(state.answers, id);
  const valueOf = (state, id, fallback) => (answered(state, id) ? state.answers[id] : fallback);

  const QUESTIONS = [
    {
      id: 'storeys', kind: 'count', critical: true,
      prompt: 'How many floors are we putting up?',
      options: ['1', '2'],
      // The level stack already says how many floors there are, so this
      // one is settled by the drawing and never asked.
      skipWhen: facts => Number.isFinite(facts.storeys),
    },
    {
      id: 'bedrooms', kind: 'count', critical: true,
      prompt: 'How many bedrooms?',
      options: ['2', '3', '4'],
      settled: facts => num(facts.bedrooms),
      confirm: value => `Project info has you down for ${value} bedrooms. Still ${value}?`,
    },
    {
      id: 'bathrooms', kind: 'count', critical: true,
      prompt: 'And bathrooms?',
      options: ['1', '2', '3'],
      settled: facts => num(facts.bathrooms),
      confirm: value => `${value} bathrooms on file. Keeping that?`,
    },
    {
      id: 'entry', kind: 'zone', critical: true,
      prompt: 'Which side does the front door land on?',
      options: ['front', 'left', 'right', 'back'],
      // A door already placed has answered this; asking would be rude.
      skipWhen: facts => ZONES.includes(facts.entrySide),
    },

    {
      id: 'stairZone', kind: 'zone',
      prompt: 'Where should the stairs run?',
      options: ['back', 'left', 'right', 'by the stairs'],
      // Stairs already on the drawing answer this outright.
      skipWhen: facts => facts.hasStairs === true,
      when: state => valueOf(state, 'storeys', DEFAULTS.storeys) >= 2,
    },

    // ── Detail branches. Deep, not wide: the count answers above spawn a
    // question per room, so a bigger house is a longer conversation.
    {
      id: 'primarySuite', kind: 'yesno',
      prompt: 'Do you want a primary suite — the big bedroom with its own bath?',
      when: state => valueOf(state, 'bedrooms', DEFAULTS.bedrooms) >= 2,
    },
    {
      id: 'primaryZone', kind: 'zone',
      prompt: 'Where does the primary sit?', options: ['front', 'back', 'left', 'right'],
      when: state => valueOf(state, 'primarySuite', DEFAULTS.primarySuite) === true,
    },
    {
      id: 'ensuite', kind: 'choice',
      prompt: 'Ensuite: three-piece or four-piece?', options: ['three-piece', 'four-piece'],
      when: state => valueOf(state, 'primarySuite', DEFAULTS.primarySuite) === true,
    },
    {
      id: 'walkIn', kind: 'yesno',
      prompt: 'Walk-in closet off the primary?',
      when: state => valueOf(state, 'primarySuite', DEFAULTS.primarySuite) === true,
    },
    { id: 'kitchenZone', kind: 'zone', prompt: 'Where do you want the kitchen?', options: ['front', 'back', 'left', 'right'] },
    { id: 'livingZone', kind: 'zone', prompt: 'And the living room?', options: ['front', 'back', 'left', 'right'] },
    { id: 'diningRoom', kind: 'yesno', prompt: 'A separate dining room, or eat in the kitchen?' },
    {
      id: 'diningZone', kind: 'zone', prompt: 'Where does the dining room go?',
      options: ['front', 'back', 'left', 'right'],
      when: state => valueOf(state, 'diningRoom', DEFAULTS.diningRoom) === true,
    },
    {
      id: 'laundryStorey', kind: 'count',
      prompt: 'Which floor takes the laundry?', options: ['1', '2'],
      when: state => valueOf(state, 'storeys', DEFAULTS.storeys) >= 2,
    },
    { id: 'laundryZone', kind: 'zone', prompt: 'Whereabouts does the laundry sit?', options: ['back', 'by the stairs', 'left', 'right'] },
    { id: 'mudroom', kind: 'yesno', prompt: 'Drop zone by the door — boots, coats, the lot?' },
    {
      id: 'mudroomZone', kind: 'zone', prompt: 'Which side for the drop zone?',
      options: ['back', 'left', 'right', 'by the stairs'],
      when: state => valueOf(state, 'mudroom', DEFAULTS.mudroom) === true,
    },
    { id: 'pantry', kind: 'yesno', prompt: 'Walk-in pantry off the kitchen?' },
    { id: 'officeDen', kind: 'yesno', prompt: 'An office or den anywhere?' },
    {
      id: 'officeZone', kind: 'zone', prompt: 'Where does the office want to be?',
      options: ['front', 'back', 'left', 'right'],
      when: state => valueOf(state, 'officeDen', DEFAULTS.officeDen) === true,
    },
    { id: 'closets', kind: 'choice', prompt: 'Closets: standard, or generous?', options: ['standard', 'generous'] },
    { id: 'storage', kind: 'yesno', prompt: 'A storage room on top of the closets?' },
    {
      id: 'windows', kind: 'choice',
      prompt: 'Windows: plenty, balanced, or sparing?',
      options: ['plenty', 'balanced', 'sparing'],
      hint: 'Changes how many the bone deals, not where the rooms land.',
    },
  ];

  // Per-bedroom and per-bath placement questions, generated from the counts
  // — this is what makes the tree DEEP: a four-bedroom house is a longer
  // conversation than a two, without a wider catalogue.
  const dynamicQuestions = state => {
    const out = [];
    const beds = valueOf(state, 'bedrooms', DEFAULTS.bedrooms);
    const primary = valueOf(state, 'primarySuite', DEFAULTS.primarySuite) === true;
    const ordinary = Math.max(0, beds - (primary ? 1 : 0));
    for (let i = 0; i < ordinary; i++) {
      const nth = i + (primary ? 2 : 1);
      out.push({
        id: `bedroomZone:${nth}`, kind: 'zone',
        prompt: `Bedroom ${nth} — which side?`,
        options: ['front', 'back', 'left', 'right'],
      });
    }
    const baths = valueOf(state, 'bathrooms', DEFAULTS.bathrooms);
    const extra = Math.max(0, baths - (primary ? 1 : 0));
    for (let i = 0; i < extra; i++) {
      out.push({
        id: `wcZone:${i + 1}`, kind: 'zone',
        prompt: extra === 1 ? 'Where does the main bath go?' : `Bathroom ${i + 1} — which side?`,
        options: ['front', 'back', 'left', 'right', 'by the stairs'],
      });
    }
    return out;
  };

  const catalogue = state => {
    const beds = QUESTIONS.filter(q => q.critical);
    const rest = QUESTIONS.filter(q => !q.critical);
    // Critical ladder first, always. Then the per-room questions the counts
    // opened up, then the rest of the detail.
    return [...beds, ...dynamicQuestions(state), ...rest];
  };

  const questionById = (state, id) => catalogue(state).find(q => q.id === id) || null;

  // ── State ─────────────────────────────────────────────────────────────
  // facts: what the drawing already answers — outline box, storeys, whether
  // stairs are placed, bedroom/bathroom counts from project info, entry
  // side, stair well centre, and the caller's storey → levelId mapping.
  const startState = (facts = {}, seed = 1) => Object.freeze({
    facts: Object.freeze({ ...facts }),
    answers: Object.freeze({}),
    asked: Object.freeze([]),
    retries: Object.freeze({}),
    seed: Number.isFinite(seed) ? seed : 1,
  });

  // A question is LIVE when its branch condition holds and nobody has
  // answered it. A question the drawing settles is skipped outright unless
  // it is worth confirming, in which case it is asked as a confirm.
  const liveQuestions = state => catalogue(state).filter(q => {
    if (answered(state, q.id)) return false;
    // Settled by the drawing: not asked, not confirmed, not mentioned.
    if (typeof q.skipWhen === 'function' && q.skipWhen(state.facts)) return false;
    if (typeof q.when === 'function' && !q.when(state)) return false;
    return true;
  });

  const settledValue = (state, question) =>
    (typeof question.settled === 'function' ? question.settled(state.facts) : null);

  const nextQuestion = state => {
    const live = liveQuestions(state);
    const asked = state.asked.length;
    if (!live.length) {
      return { done: true, id: null, prompt: pick(DONE_LINES, state.seed + asked) };
    }
    const q = live[0];
    const settled = settledValue(state, q);
    const retried = (state.retries[q.id] || 0) > 0;
    // The drawing knows it: confirm rather than ask cold.
    const prompt = settled != null && typeof q.confirm === 'function'
      ? q.confirm(settled)
      : q.prompt;
    const out = {
      id: q.id,
      prompt: retried ? `${pick(RE_ASKS, state.seed + asked)} ${prompt}` : prompt,
      kind: q.kind,
      ...(q.options ? { options: [...q.options] } : {}),
      ...(q.hint ? { hint: q.hint } : {}),
      ...(settled != null ? { suggested: settled } : {}),
    };
    // The reminder rides every few questions — never on the first, never
    // twice running, and never instead of the question itself.
    if (asked > 0 && asked % REMINDER_EVERY === 0) {
      out.reminder = pick(REMINDERS, state.seed + asked);
    }
    return out;
  };

  // Pure: returns a NEW state. An answer that does not parse is not a dead
  // end — it bumps a retry counter and the same question comes back with a
  // good-natured line in front of it.
  const answer = (state, id, value) => {
    const q = questionById(state, id);
    if (!q) return state;
    const parsed = parseAnswer(q, value);
    if (parsed == null) {
      return Object.freeze({
        ...state,
        retries: Object.freeze({ ...state.retries, [id]: (state.retries[id] || 0) + 1 }),
      });
    }
    const retries = { ...state.retries };
    delete retries[id];
    return Object.freeze({
      ...state,
      answers: Object.freeze({ ...state.answers, [id]: parsed }),
      asked: Object.freeze([...state.asked, id]),
      retries: Object.freeze(retries),
    });
  };

  // ── Zone words → coordinates ──────────────────────────────────────────
  // The one placement path. Stamps sharing a zone spread evenly along that
  // zone's run so two "back" rooms never land on the same spot.
  const NOMINAL = Object.freeze({ x0: -20, x1: 20, z0: -14, z1: 14 });

  const resolveZone = (zone, box, index = 0, count = 1, stairAt = null) => {
    const b = box && Number.isFinite(box.x0) ? box : NOMINAL;
    const w = b.x1 - b.x0, d = b.z1 - b.z0;
    const inset = Math.max(2, Math.min(w, d) * 0.18);
    const at = (lo, hi) => lo + ((hi - lo) * (index + 1)) / (count + 1);
    switch (zone) {
      case 'front': return { x: at(b.x0 + inset, b.x1 - inset), z: b.z1 - inset };
      case 'back': return { x: at(b.x0 + inset, b.x1 - inset), z: b.z0 + inset };
      case 'left': return { x: b.x0 + inset, z: at(b.z0 + inset, b.z1 - inset) };
      case 'right': return { x: b.x1 - inset, z: at(b.z0 + inset, b.z1 - inset) };
      case 'by the stairs': {
        const c = stairAt && Number.isFinite(stairAt.x)
          ? stairAt : { x: (b.x0 + b.x1) / 2, z: (b.z0 + b.z1) / 2 };
        // A small deterministic fan so several "by the stairs" rooms are
        // near the stairs rather than inside each other.
        const step = Math.max(1.5, inset * 0.75);
        return { x: c.x + (index - (count - 1) / 2) * step, z: c.z };
      }
      default: return { x: (b.x0 + b.x1) / 2, z: (b.z0 + b.z1) / 2 };
    }
  };

  // ── The program ───────────────────────────────────────────────────────
  // Complete at every rung: anything unanswered takes its default and is
  // named in `defaulted`, so the board can say what Gruff decided for you.
  const program = state => {
    const answers = state?.answers || {};
    const facts = state?.facts || {};
    const box = facts.outline || null;
    // "By the stairs" means the real stair when one is placed, and the
    // stair Gruff was told to expect when one is not.
    const stairAt = facts.stairAt
      || (answers.stairZone ? resolveZone(answers.stairZone, facts.outline || null) : null);
    const levelIds = Array.isArray(facts.levelIds) ? facts.levelIds : [];
    const defaulted = [];
    const get = (id, fallback) => {
      if (Object.prototype.hasOwnProperty.call(answers, id)) return answers[id];
      defaulted.push(id);
      return fallback;
    };

    const storeys = Math.max(1, Number.isFinite(facts.storeys)
      ? facts.storeys : get('storeys', DEFAULTS.storeys));
    const beds = Math.max(1, get('bedrooms', DEFAULTS.bedrooms));
    const baths = Math.max(1, get('bathrooms', DEFAULTS.bathrooms));
    const primary = get('primarySuite', DEFAULTS.primarySuite) === true && beds >= 2;
    // Bedrooms go upstairs when there is an upstairs; the living floor
    // keeps the kitchen, living and dining.
    const bedStorey = storeys >= 2 ? 2 : 1;
    const laundryStorey = storeys >= 2
      ? Math.min(storeys, Math.max(1, get('laundryStorey', DEFAULTS.laundryStorey)))
      : 1;

    const wanted = [];   // { base, storey, zone, companionOf? }
    if (primary) {
      wanted.push({ key: 'primary', base: 'BEDROOM', storey: bedStorey, zone: get('primaryZone', DEFAULTS.primaryZone) });
      wanted.push({ key: 'ensuite', base: 'ENSUITE', storey: bedStorey, zone: get('primaryZone', DEFAULTS.primaryZone), companionOfKey: 'primary' });
      if (get('walkIn', DEFAULTS.walkIn) === true) {
        wanted.push({ key: 'walkin', base: 'WALK-IN', storey: bedStorey, zone: get('primaryZone', DEFAULTS.primaryZone), companionOfKey: 'primary' });
      }
    }
    const ordinary = Math.max(0, beds - (primary ? 1 : 0));
    for (let i = 0; i < ordinary; i++) {
      const nth = i + (primary ? 2 : 1);
      wanted.push({
        key: `bedroom${nth}`, base: 'BEDROOM', storey: bedStorey,
        zone: get(`bedroomZone:${nth}`, DEFAULTS.bedroomZone),
      });
    }
    const extraBaths = Math.max(0, baths - (primary ? 1 : 0));
    for (let i = 0; i < extraBaths; i++) {
      wanted.push({
        key: `wc${i + 1}`, base: 'WC',
        // One bath stays on the living floor where the guests are; the
        // rest go up with the bedrooms.
        storey: i === 0 ? 1 : bedStorey,
        zone: get(`wcZone:${i + 1}`, 'by the stairs'),
      });
    }
    wanted.push({ key: 'kitchen', base: 'KITCHEN', storey: 1, zone: get('kitchenZone', DEFAULTS.kitchenZone) });
    wanted.push({ key: 'living', base: 'LIVING', storey: 1, zone: get('livingZone', DEFAULTS.livingZone) });
    if (get('diningRoom', DEFAULTS.diningRoom) === true) {
      wanted.push({ key: 'dining', base: 'DINING', storey: 1, zone: get('diningZone', DEFAULTS.diningZone) });
    }
    if (get('pantry', DEFAULTS.pantry) === true) {
      wanted.push({ key: 'pantry', base: 'PANTRY', storey: 1, zone: get('kitchenZone', DEFAULTS.kitchenZone) });
    }
    wanted.push({ key: 'laundry', base: 'LAUNDRY', storey: laundryStorey, zone: get('laundryZone', DEFAULTS.laundryZone) });
    if (get('mudroom', DEFAULTS.mudroom) === true) {
      wanted.push({ key: 'dz', base: 'DZ', storey: 1, zone: get('mudroomZone', DEFAULTS.mudroomZone) });
    }
    if (get('officeDen', DEFAULTS.officeDen) === true) {
      wanted.push({ key: 'office', base: 'OFFICE/DEN', storey: 1, zone: get('officeZone', DEFAULTS.officeZone) });
    }
    if (get('storage', DEFAULTS.storage) === true) {
      wanted.push({ key: 'storage', base: 'STORAGE', storey: 1, zone: 'by the stairs' });
    }
    // Closets ride with the bedrooms rather than as their own question.
    if (get('closets', DEFAULTS.closets) === 'generous') {
      wanted.filter(item => item.base === 'BEDROOM').forEach((bed, i) => {
        wanted.push({ key: `closet${i}`, base: 'CLOSET', storey: bed.storey, zone: bed.zone, companionOfKey: bed.key });
      });
    }

    // Resolve zones per (storey, zone) group so shared zones spread.
    const groups = new Map();
    wanted.forEach(item => {
      if (item.companionOfKey) return;              // companions sit with their host
      const key = `${item.storey}|${item.zone}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(item);
    });
    const placed = new Map();
    groups.forEach(list => {
      list.forEach((item, i) => {
        placed.set(item.key, resolveZone(item.zone, box, i, list.length, stairAt));
      });
    });

    let nextId = 1;
    const ids = new Map();
    const stamps = [];
    wanted.forEach(item => {
      const id = nextId++;
      ids.set(item.key, id);
      const at = item.companionOfKey
        ? placed.get(item.companionOfKey) || resolveZone(item.zone, box, 0, 1, stairAt)
        : placed.get(item.key);
      stamps.push({
        id,
        base: item.base,
        storey: item.storey,
        levelId: levelIds[item.storey - 1] ?? null,
        zone: item.zone,
        x: Math.round(at.x * 1000) / 1000,
        z: Math.round(at.z * 1000) / 1000,
        ...(item.companionOfKey ? { companionOf: ids.get(item.companionOfKey) } : {}),
      });
    });

    return {
      stamps,
      storeys,
      entry: ZONES.includes(facts.entrySide) ? facts.entrySide : get('entry', DEFAULTS.entry),
      windows: get('windows', DEFAULTS.windows),
      defaulted: [...new Set(defaulted)].sort(),
      complete: true,
    };
  };

  window.DraftGruffInterview = Object.freeze({
    ZONES, CRITICAL_LADDER, REMINDER_EVERY, DEFAULTS,
    startState, nextQuestion, answer, program,
    parseAnswer, parseCount, parseYesNo, parseZone, resolveZone,
  });
})();
}
