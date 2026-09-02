// THE FIRST-RUN CEREMONY — the shortest road from an empty screen to a house.
//
// Movie's order: Gruff greets, asks THE ONE QUESTION, offers the three ways in,
// and on finish names what was made and offers the next stage up.
//
// ── THE TWO RULES THAT SHAPE IT ─────────────────────────────────────────
//
//   NEVER MORE THAN ONE QUESTION ON SCREEN.
//   EVERY STAGE IS SKIPPABLE.
//
// The first is why this is a ceremony and not a form: a beginner who is shown
// six fields has been handed a job, and the drive-thru already exists for
// anyone who wants to answer six. One question is the whole ask, and its
// answer is the one that moves the most house.
//
// The second is why nothing here can trap anybody. Every stage has a way past
// it, and skipping is never punished — a skipped question takes the same
// default the bone would have used anyway, from gruff-interview().js, so the
// ceremony has no numbers of its own to drift from the engine's.
//
// No DOM, no component state, node-loadable, frozen. What is here is the SHAPE
// of the ceremony; what any of the three ways in actually does belongs to
// those, not to this.
// REQUIRES window.DraftGruffInterview -- resolved at CALL time, not at load. A page may list this
// script before its dependency and still work; only the ceremony defaults needs the
// dependency present by the time it is called.
//
// It was captured at load until 2 Sep, which meant a page whose script order
// put this first got a module that loaded clean, reported every export, and
// threw later from a call site naming a different file.
if (!window.DraftFirstRun) {
(() => {
  const interview = () => window.DraftGruffInterview;

  // ── The stages, in order ──────────────────────────────────────────────
  const STAGE = Object.freeze({
    GREET: 'greet',      // Gruff says hello
    ASK: 'ask',          // THE one question
    CHOOSE: 'choose',    // the three ways in
    DONE: 'done',        // what was made, and the next stage up
  });

  // ── The three ways in ─────────────────────────────────────────────────
  // A ladder of how much the machine does for you, over one house model --
  // the same ladder the build row shows, said in words a beginner can pick
  // between without knowing what any of them mean yet.
  const WAYS = Object.freeze([
    Object.freeze({ id: 'bone', label: 'BUILD IT FOR ME',
      blurb: 'Gruff draws the whole house. Change anything after.', ready: true }),
    Object.freeze({ id: 'rabbit', label: 'GIVE ME A FEW',
      blurb: 'Four houses to choose from.', ready: false,
      // RABBIT is not built. It is still OFFERED, because the ladder is the
      // thing being explained and a rung missing from it teaches the wrong
      // shape -- but a press says so plainly rather than answering with
      // nothing, the same way SPLIT does on the build row.
      soon: 'A FEW TO CHOOSE FROM is coming — it draws four houses and you pick one.' }),
    Object.freeze({ id: 'turtle', label: 'I WILL DRAW IT',
      blurb: 'Walk the walls yourself, one at a time.', ready: true }),
  ]);

  const wayFor = id => WAYS.find(way => way.id === id) || null;

  // ── THE ONE QUESTION ──────────────────────────────────────────────────
  // How many bedrooms. It is the answer that moves the most house, and it is
  // the second rung of the drive-thru's own critical ladder -- storeys first
  // there, but a beginner who has never drawn a house has an opinion about
  // bedrooms and usually none about storeys.
  const QUESTION = Object.freeze({
    id: 'bedrooms',
    ask: 'How many bedrooms?',
    // Read from the engine, never restated. A skipped question and a bone
    // press must produce the same house, or skipping quietly costs something.
    get fallback() { return interview().DEFAULTS.bedrooms; },
    least: 1,
    most: 6,
  });

  const clamp = value => {
    const n = Math.round(Number(value));
    if (!Number.isFinite(n)) return QUESTION.fallback;
    return Math.min(QUESTION.most, Math.max(QUESTION.least, n));
  };

  const start = () => ({ stage: STAGE.GREET, bedrooms: null, way: null, skipped: [] });

  // ── Moving through it ─────────────────────────────────────────────────
  // One entry point, so there is one place where "what comes next" is decided
  // and no screen can invent its own order.
  const advance = (state, action = {}) => {
    const at = (state && state.stage) || STAGE.GREET;
    const skipped = [...((state && state.skipped) || [])];
    switch (at) {
      case STAGE.GREET:
        return { ...state, stage: STAGE.ASK, skipped };
      case STAGE.ASK: {
        // SKIPPING IS NOT PUNISHED. The answer becomes the same default the
        // bone would have used, so a skip costs a preference and never a
        // house.
        if (action.skip) {
          return { ...state, stage: STAGE.CHOOSE, bedrooms: QUESTION.fallback,
            skipped: [...skipped, STAGE.ASK] };
        }
        return { ...state, stage: STAGE.CHOOSE, bedrooms: clamp(action.bedrooms) };
      }
      case STAGE.CHOOSE: {
        if (action.skip) {
          // Skipping the choice is not choosing nothing: it is the drafting
          // tools, which have been on screen the whole time. The ceremony gets
          // out of the way rather than insisting on a way in.
          return { ...state, stage: STAGE.DONE, way: null, skipped: [...skipped, STAGE.CHOOSE] };
        }
        const way = wayFor(action.way);
        if (!way || !way.ready) return state;   // an unbuilt rung says so and stays put
        return { ...state, stage: STAGE.DONE, way: way.id };
      }
      default:
        return state;
    }
  };

  // ── What Gruff says ───────────────────────────────────────────────────
  // Short lines. The ceremony is chrome, not a teacher: it names what
  // happened and offers the next thing, and never explains a rule.
  const line = state => {
    const bedrooms = (state && state.bedrooms) || QUESTION.fallback;
    switch ((state && state.stage) || STAGE.GREET) {
      case STAGE.GREET:
        return 'Morning. Let us get a house on the paper.';
      case STAGE.ASK:
        return QUESTION.ask;
      case STAGE.CHOOSE:
        return `${bedrooms} bedrooms. How do you want to start?`;
      case STAGE.DONE:
        // WHAT WAS MADE, then THE NEXT STAGE UP -- the rung above whichever
        // one they took, so the ladder keeps going instead of ending.
        return state.way === 'bone'
          ? `There is your ${bedrooms}-bedroom house. Move a wall when you like — the tabs are on them.`
          : state.way === 'turtle'
          ? `Walk the walls and I will keep up. Press the bone any time and I finish it for you.`
          : `Tools are on the left whenever you want them. The bone builds a ${bedrooms}-bedroom house in one press.`;
      default:
        return '';
    }
  };

  // A question is on screen only at ASK. Anything else showing one at the same
  // time is the rule being broken, and this is what a test asks.
  const asking = state => ((state && state.stage) || STAGE.GREET) === STAGE.ASK;

  // Every stage before DONE has a way past it. There is no stage that traps.
  const skippable = state => ((state && state.stage) || STAGE.GREET) !== STAGE.DONE;

  window.DraftFirstRun = Object.freeze({
    STAGE, WAYS, QUESTION,
    start, advance, line, asking, skippable, wayFor, clamp,
  });
})();
}
