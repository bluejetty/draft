// MODEL.html's page script, part 1 of 17: the skin, zoom and pan, world to screen, the boneyard's state, the photo, a room tag's shape, ZOOM TO FILL, what holds a floor up.
//
// Stage 2 of the split (Movie, 24 Oct: "how can we reduce the MODEL.html
// size in a nice organized way"): the one script the page carried, cut
// at its own section headings and moved here verbatim, in order. The
// parts load one after another as classic scripts and share one scope,
// as they did inside the page; the indent is the page's, kept so every
// line reads as it did there.

  // ── skin ──────────────────────────────────────────────────────────────────
  // Four dashboards: RUFF DRAFTER and ROUGH DRAFTER, each night and day
  // (RD-DOCUMENTS/SPEC-skins.md). The skins themselves get designed later;
  // what exists now is the seam they arrive through.
  //
  // ?theme= and ?mode= are the seam, deliberately: a URL is the cheapest way
  // for a designer to see a skin, and for a spec to assert one, before any
  // settings UI exists. When the profile package carries the choice, this
  // reads that first and the query string stays as an override.
  //
  // `skin` is captured ONCE at module scope, which is a load-order hazard this
  // repo has been bitten by 13 times across 8 files -- so palette.js is loaded
  // above and this throws here, naming itself, rather than painting undefined
  // three functions away.
  // resolve() throws on an unknown name, which is right for a painter asking
  // for a role that does not exist. It is WRONG here: a typo in a URL someone
  // pasted should not blank the page. So the query string is validated against
  // the palette's own lists and falls back, loudly, to the default skin.
  const params = new URLSearchParams(location.search);
  const pick = (name, allowed, fallback) => {
    const asked = params.get(name);
    if (!asked || allowed.includes(asked)) return asked || fallback;
    console.warn(`MODEL: unknown ${name} "${asked}"; using ${fallback}. `
      + `Known: ${allowed.join(', ')}`);
    return fallback;
  };
  // THE CHOICE OUTLIVES THE TAB, and the query string still wins. A drafter
  // who picks DAY on the strip gets DAY tomorrow morning; a ?mode= in a URL
  // someone pasted is a deliberate override for that visit and does not
  // overwrite what the drafter chose. Stored under one key rather than in the
  // profile package: the package is office standards, and a skin is not one.
  const SKIN_KEY = 'draft-skin';
  const stored = (() => {
    try { return JSON.parse(localStorage.getItem(SKIN_KEY) || 'null') || {}; }
    catch { return {}; }
  })();
  const storedOr = (name, allowed, fallback) =>
    (allowed.includes(stored[name]) ? stored[name] : fallback);
  // `let`, and this is the whole seam the switcher hangs on. Every painter
  // reads `skin['role']` INSIDE its own function (30 sites, checked), so
  // re-resolving here and repainting changes the drawing's colours without a
  // reload -- and a reload is what a switcher must avoid, because this page
  // holds unsaved edits.
  let theme = pick('theme', window.DraftPalette.THEMES,
    storedOr('theme', window.DraftPalette.THEMES, 'ruff'));
  let mode = pick('mode', window.DraftPalette.MODES,
    storedOr('mode', window.DraftPalette.MODES, 'night'));
  let skin = window.DraftPalette.apply(document, theme, mode);
  'use strict';

  const BUCKET = 'model-drawing';
  const canvas = document.getElementById('plan');
  // NOT const, and this is the one binding that decides whether a seat can
  // show a plan. Every painter on this page draws into `ctx` and projects
  // through toS(), both module-level -- so a thumbnail either swaps them for
  // the length of one draw or becomes a SECOND, smaller renderer. The old
  // page took the second road (_drawPlanThumb2D) and this page took the first
  // for its cut seats already: "the same painter that draws the full-size
  // view, through the same env". A miniature that can disagree with the plan
  // it claims to show is the defect this suite keeps meeting.
  let ctx = canvas.getContext('2d');
  // THE TAB IS THE BAR'S. Opening and shutting the panel is the same on every
  // page that has one, so shell-bars.js owns it and keeps the rule it was
  // written with: the tab is the ONLY thing that moves the panel -- not a
  // level change, not a save -- so what is on screen is the drafter's own
  // last decision and never a surprise mid-gesture.
  //
  // WHAT GOES IN IT STAYS HERE. readoutText is written by this page's paint,
  // and the counts are a fact about a drawing.
  const showReadout = window.DraftShellBars.wireReadout();
  const readoutText = document.getElementById('readout-text');
  const notice = document.getElementById('notice');
  const noticeBody = document.getElementById('notice-body');
  const saveButton = document.getElementById('save');
  const elsewhereNote = document.getElementById('elsewhere');
  const savedWhereNote = document.getElementById('saved-where');
  const leaseBanner = document.getElementById('lease');
  const leaseMessage = leaseBanner && leaseBanner.querySelector('[data-lease-message]');
  const takeOverButton = document.getElementById('take-over');

  // ── the instruments' own state ────────────────────────────────────────────
  // Declared here rather than beside the strip's wiring because paint() reads
  // the ruler, and paint() is defined a thousand lines above it. A `let` read
  // before its declaration is a throw, not an undefined, and the boot paint
  // would hit it.
  // THE ELEVATION'S OWN GESTURES (lines and notes drawn on E1-E4 and the
  // sections). Declared up here because paint() reads them, and paint can run
  // before the block that works them has been reached. See elevPress below.
  let elevFrame = null;      // where a foot of the elevation on screen lands
  // ── ZOOM AND PAN ON AN ELEVATION (Movie, 23 Oct) ─────────────────────
  //
  // "once a user goes to elevation can it be zoomed out fill like it is
  // now, but once the user is in the elevation can they zoom in to look at
  // details they'd like to see closer". A cut view opens at the painter's
  // own fit (the whole building, its marks, a tenth of air); the wheel then
  // zooms about the cursor and a drag pans, exactly as the plan does, and 0
  // brings the fit back. The painter is handed the frame to draw in
  // (`opts.frame`, its pinned pass) rather than fitting for itself; nothing
  // here is a second fit. `elevPin` is that frame, null for the fit, and
  // `elevPinFor` the cut it belongs to -- another cut opens fitted.
  let elevPin = null;
  let elevPinFor = null;
  // The fit's own scale, read off the last unpinned paint, so zooming out
  // stops at half of it rather than running off to nothing.
  let elevFitPx = null;
  let elevLineStart = null;  // { u, e } -- a line half drawn
  let elevCursor = null;     // { u, e } -- the pointer, for the line's preview
  let elevSelected = null;   // the id of the mark Select is holding
  let elevNotePress = null;  // { at, x, y } -- a note press not yet lifted
  // THE POINTER (Movie, 6 Oct): "when i put in ANNOTATION TEXT - can i have an
  // option for a POINTER ARROW? I will want to adjust the types of 'ARROWS' on
  // the end but put in just a straight end on the line now (no arrow)".
  // POINTER ON: the first tap is the thing pointed at, the second is where the
  // text goes. The press-and-drag leader works either way. `noteEnd` is what
  // the leader ends in -- 'line', a plain straight end, is the only one yet;
  // 'arrow' is the old filled head, kept for notes drawn before this.
  let notePointer = false;
  let noteEnd = 'line';
  let elevPointerTip = null;  // { u, e } -- POINTER's first tap, waiting for the text
  let tsquareOn = false;    // T-SQUARE down: the run in hand is held square
  // THE FOOT LIGHT. A PAGE SETTING, NOT DRAWING DATA -- a drawing carrying
  // "the foot light was on" would arrive in someone else's session and start
  // rounding his walls, so it rides in SKIN_KEY with the theme. (The board
  // used to ride there too; it stopped on 15 Oct, when "always start the
  // users in TOY MODE" made a remembered board the wrong answer.)
  //
  // THE ORDER SAYS IT RIDES WITH THE T-SQUARE, "same store, same restore-on-
  // load". Measured, the T-SQUARE HAS NO STORE: `tsquareOn` is a plain `let`
  // that resets to false on every load, and nothing writes it anywhere. So
  // the instruction cannot be followed literally; what it asks for is
  // acceptance 3 -- survives reload, off on a page that has never seen it --
  // and SKIN_KEY is where this page already keeps exactly that kind of
  // setting. Reported rather than quietly reinterpreted.
  let footOn = stored.footLight === true;
  // SNAP AND TRACK, ON UNLESS TURNED OFF (Movie, 17 Oct: "make those 2
  // features that we can turn on and off in the Instrument pannel" -- "have
  // them ON default yes"). Kept beside the 1' light, for the same reason.
  let snapOn = stored.snapLight !== false;
  let trackOn = stored.trackLight !== false;
  // THE PROTRACTOR'S STEP, 45 or 30, kept with the lights (Movie, 17 Oct:
  // "yes keep protactor at 45/90 initally").
  let protractorStep = stored.protractorStep === 30 ? 30 : 45;
  let rulerOn = false;      // RULER down: presses measure instead of drawing
  let brushOn = false;      // DRAFTING BRUSH up: presses lift and dust
  let brushLoad = null;     // what the brush is holding — see BRUSH_PROPS
  let brushWarned = null;   // { opening } or { wall } a TOO BIG glows on, until the next press
  let rulerFrom = null;     // the ruler's first press, in world feet
  let cursorWorld = null;   // where the cursor last was, for the live readouts
  // THE HOVERED NODE AND THE SHIFT THAT LINES UP ON IT (refPoint).
  let refHover = null;
  let refLock = null;
  // STRETCH's presses so far: the box's two corners, then the base point.
  let stretchState = { a: null, b: null, base: null };
  // THE CORNER UNDER THE CURSOR, or null. Painted, not just cursored -- see
  // paintHoverCorner. Held as the POOLED VERTEX OBJECT rather than a copy of
  // its numbers, so a corner that moves under the cursor keeps its highlight
  // without anything re-finding it.
  let hoverCorner = null;

  // View state in world units (feet). scale is screen pixels per foot.
  // Deliberately plain arithmetic: MODEL.dc.html projects through a three.js
  // camera, but the painters take `toS` as a parameter and never ask where it
  // came from, so tier 1 owes three.js nothing.
  const view = { cx: 0, cz: 0, scale: 6 };
  // WHILE A SEAT IS BEING PAINTED, this says which level and which drawing of
  // it -- and it is deliberately the ONLY override. activeLevelId and
  // activeViewId read it, and everything downstream (walls, lines, floors,
  // roofs, dimensions, the fit) already reads THEM, so one hook aims the
  // entire existing filter chain at another level instead of seventeen
  // painters growing a parameter. It is a second source of truth for "what is
  // active" for exactly as long as one synchronous draw, restored in a
  // `finally` so a throwing painter cannot leave the page pointing at a seat.
  let thumbTarget = null;
  let drawing = null;
  // The bucket revision the drawing was read at, handed back as `ifRev` on
  // save so a write that would land on top of someone else's is REFUSED
  // rather than silent — the same guard MODEL.dc.html saves under.
  let storeRev = null;
  // One shared object per corner, rebuilt on every load. Only wall endpoints
  // go in it today, because mitring is the only thing that needs identity;
  // MODEL.dc.html pools lines, floors and roofs too, and this grows to match
  // when something on this page needs them to share a corner.
  let vertexPool = [];
  let dropped = 0;   // items the format module refused on load — kept, not drawn
  // WHAT THE FORMAT MODULE REFUSED, HELD RAW SO THE SAVE CAN PUT IT BACK
  // (RULING-a-rejected-item-is-still-the-drafters, Movie, 11 Sep). Keyed by
  // collection; each entry is `{ index, item }` with `item` byte-for-byte as it
  // came out of the file. The page will not draw these — they failed the
  // format's own rules and drawing them is exactly what those rules prevent —
  // but a page may show less than the file contains; it may not SAVE less than
  // the file contains.
  //
  // The list comes from the normaliser's own sink rather than from a comparison
  // made here, because a reconstruction at this call site gets the duplicate-id
  // case backwards: a dimension refused for a duplicate id PASSES when re-run
  // on its own, so a caller re-deriving the refusals one at a time would call
  // it accepted, never record it, and lose it on the next save — while looking
  // exactly like a caller that works.
  // THE FOUR SMALL COLLECTIONS JOINED ON 16 SEP (tier 3j). A tool that can
  // place a beam is a page ACTING on beams, and the load block's own rule is
  // that a collection the page acts on is normalised on the way in. They
  // carry `drops` for the same reason the first four do: withRefused() puts a
  // refused record back on save, so refusing is declining to act on it rather
  // than deleting it from the drafter's file.
  const REFUSED_KEYS = ['walls', 'lines', 'floors', 'dimensions',
    'beams', 'columns', 'shapes', 'fixtures'];
  let refusedItems = { walls: [], lines: [], floors: [], dimensions: [],
    beams: [], columns: [], shapes: [], fixtures: [] };
  // PAINT THE SUBSTITUTE, NEVER PERSIST IT (RULING-substitution-is-not-a-save,
  // Movie, 11 Sep). `LEGACY_WALL_TYPES` rewrites a retired wall type to the
  // nearest surviving assembly so the wall can be DRAWN — a reader's
  // accommodation, and the right one. This page also WRITES, and re-emitting the
  // substitute makes the accommodation permanent: open an old house with 12"
  // foundation walls, change nothing, press SAVE, and four inches of concrete
  // are gone from the record with no message.
  //
  // The mapping is lossy and ONE-WAY. Nothing in the saved file records that a
  // wall was ever 12", so when the thicker types come back — one row each in
  // WALL_TYPES — the app recovers and already-round-tripped drawings do not.
  //
  // The rule this belongs to: a page may SHOW less than the file contains; it
  // may not SAVE less than the file contains. Keyed by wall id and holding both
  // halves, so a type the drafter later changes on purpose is not quietly
  // reverted to the legacy one.
  //
  // THE CONTRACT, AND IT IS NOT ENFORCED BY ANYTHING. The serializer decides
  // whether to restore by asking whether the wall still carries the type this
  // page substituted — it INFERS the drafter's intent, and there is one case it
  // infers wrongly: a drafter who deliberately picks the very type the
  // substitution chose is indistinguishable from the substitution, so the save
  // would put the retired type back over their choice. Skipper measured that on
  // MODEL.dc.html by modelling this guard as a mutant, and it fails there.
  //
  // It cannot happen HERE, today: every write of `wallType` in this file is the
  // creation site, the load-path normaliser, or the serializer. There is no
  // picker and no change-type verb, so an existing wall's type cannot be
  // reassigned at all. That makes this a LATENT defect, not a live one — and it
  // is why there is no clear-on-assignment call in this file. A call at the
  // creation site would be a no-op by construction: a freshly drawn wall has
  // never been loaded and has no kept original to forget, so the line could
  // never fail and would read to the next person as a guard that is working.
  //
  // So the rule is written and not pretended: ANY site that assigns a type to an
  // existing wall must delete that wall's entry here. The day the picker is
  // added, this comment is the thing that has to be obeyed, because nothing in
  // the code will complain.
  let substitutedWallTypes = new Map();

  // TEXT FROM A DRAWING FILE IS NOT MARKUP. A level name, a cut name and a
  // parser's error message all come out of a file that may have been handed
  // to the drafter by someone else, and every one of them reaches an
  // innerHTML below. Uppercasing a level name does not defang it -- an
  // entity-encoded handler survives toUpperCase -- so each is escaped where
  // it is spliced in (audit 8.2).
  const escapeHtml = value => String(value).replace(/[&<>"']/g,
    ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);

  const say = (title, body) => {
    noticeBody.innerHTML = `<h1>${title}</h1>${body}`;
    notice.classList.add('show');
  };
  // A NOTICE OUTLIVES ITS SUBJECT OTHERWISE. "No saved drawing on this
  // origin" is true until NEW or OPEN answers it, and nothing took it down.
  const hideNotice = () => notice.classList.remove('show');

  // ── canvas sizing ─────────────────────────────────────────────────────────
  // Backing store in device pixels, drawing in CSS pixels, so lines are crisp
  // on a retina screen without every painter having to know the ratio.
  let dpr = 1, cssW = 0, cssH = 0;
  const resize = () => {
    dpr = window.devicePixelRatio || 1;
    cssW = canvas.clientWidth;
    cssH = canvas.clientHeight;
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    paint();
  };

  // ── world → screen ────────────────────────────────────────────────────────
  const toS = p => ({
    x: (p.x - view.cx) * view.scale + cssW / 2,
    y: (p.z - view.cz) * view.scale + cssH / 2,
  });
  const toWorld = (sx, sy) => ({
    x: (sx - cssW / 2) / view.scale + view.cx,
    z: (sy - cssH / 2) / view.scale + view.cz,
  });

  // ── which level, and which drawing OF that level ──────────────────────────
  // Tier 1 painted all five levels at once, stacked. A drafter looks at one
  // level at a time, so this picks one -- and picking one is not
  // `levelId === active`, because a level is not one drawing. MAIN FL has a
  // walls plan, a floor layout, a stair drawing and an electrical plan;
  // FOUNDATION has basement walls and the concrete below them. That table is
  // layer-views.js, already shared with LAYOUT, so this reads it rather than
  // restating it.
  //
  // MAIN_FLOOR is an ID (3), not an index. MODEL.dc.html's own
  // state.activeLevelIdx is an INDEX into DEFAULT_LEVELS, and for the default
  // list index 3 also happens to be id 3 -- they stop agreeing the moment a
  // level is inserted. See RD-DOCUMENTS/SPEC-model-html-tiers.md.
  const MAIN_FLOOR_LEVEL_ID = 3;
  const levelIds = () => (drawing?.levels || []).map(level => Number(level.id));
  // ── THE BONEYARD'S OWN STATE ──────────────────────────────────────────────
  // A SHELF IS A LEVEL WITH A NEGATIVE ID. That is the whole of the port, and
  // it is `MODEL.dc.html:9061` verbatim: `_boneyardLevelId(shelfId) { return
  // -shelfId; }`. Every level-owned thing in the format is keyed by levelId
  // and the loader accepts -shelfId as an owner (since c8654eb), so parking a
  // wall on a shelf needs no format change and no `shelfId` on any entity.
  //
  // boneyardActive IS NOT DRAWING DATA, and DC agrees -- its loader sets
  // `boneyardActive: false` unconditionally (:5606). Which shelf is active IS
  // stored, because it is a fact about the drawing; whether the drafter was
  // looking at the boneyard when he saved is a fact about his afternoon.
  let boneyardActive = false;
  // DERIVED, NOT STORED, and the distinction is the one that cost a day of red
  // CI yesterday: "readers normalise, writers never invent". boneyardShelves()
  // always yields at least SHELF 1 (drawing-format.js:827), so a drawing saved
  // before shelves existed SHOWS the default -- which acceptance 6 asks for --
  // without a default shelf being written into a file that never had one.
  // Only + SHELF writes the key, and that is the drafter's own instruction.
  const shelves = () => window.DraftDrawingFormat.boneyardShelves(drawing?.boneyardShelves);
  const activeShelfId = () => {
    const want = Number(drawing?.activeBoneyardShelfId);
    return shelves().some(s => Number(s.id) === want) ? want
      : Number(shelves()[0]?.id || 1);
  };
  const boneyardLevelId = (shelfId = activeShelfId()) => -shelfId;

  // ONE PREDICATE FOR "THE BONEYARD IS WHAT IS BEING DRAWN", and it exists
  // because the leak came back through a second door.
  //
  // activeLevelId() already answers thumbTarget BEFORE the boneyard, so the
  // seat thumbnails were safe -- and then outlines() asked `boneyardActive`
  // DIRECTLY, which is the same question without the precedence, and every
  // seat painted the shelf's master again. Two spellings of one state is how a
  // rule gets enforced in one place and forgotten in the other.
  //
  // A THUMBNAIL IS ALWAYS ABOUT ITS OWN TARGET, so it can never be about the
  // boneyard, and nothing else needs to know why.
  //
  // THE `!thumbTarget` HALF IS UNPROVEN, and saying so is the point. I added
  // it believing a red check had caught the shelf painting into every seat.
  // It had not: that red was a RACE in the check itself, capturing a seat
  // canvas mid-paint. With the race fixed, removing `!thumbTarget` changes
  // nothing acceptance 5 can see -- tried with a wall on the shelf, then with
  // a master on the shelf, then with the real flag reaching drawOutlines2D.
  //
  // It stays because it is the same precedence activeLevelId() enforces two
  // functions up, and two spellings of one state that disagree is a fault
  // waiting for its first witness. But it is a DEFENSIVE guard, not a gated
  // one, and the honest label matters more than the tidy claim: nobody should
  // read this line as measured when it is not.
  const showingBoneyard = () => boneyardActive && !thumbTarget;

  const activeLevelId = () => {
    // THUMBTARGET FIRST, AND THE ORDER OF THESE TWO IS A BUG I SHIPPED FOR AN
    // HOUR. The boneyard check was written above this line, which reads
    // naturally -- the boneyard is a whole drafting context, not a filter laid
    // over a level -- and is wrong, because a seat thumbnail is not asking
    // "where is the drafter". It is asking "what does LEVEL n look like", and
    // it sets thumbTarget to say so.
    //
    // With the boneyard open, a boneyard-first answer paints the SHELF into
    // every seat in the rail: MAIN FL's thumbnail showing a parked kitchen.
    // That is the failure acceptance 5 is about -- "a drafter parks a rejected
    // kitchen on SHELF 2 and sends the set to the city" -- arriving by a
    // different road than printing, and this page has no printing.
    //
    // A THUMBNAIL IS ALWAYS ABOUT ITS OWN TARGET. Nothing else can be true of
    // it, so nothing may be asked before it.
    if (thumbTarget) return thumbTarget.levelId;
    // Then the boneyard, which IS a whole drafting context: everything
    // downstream -- walls(), lines(), floors(), what a new wall is stamped
    // with -- reads this one function, which is why the card needs no second
    // filter anywhere. DC answers the same question the same way at :9089.
    if (boneyardActive) return boneyardLevelId();
    const asked = Number(params.get('level'));
    if (Number.isFinite(asked) && levelIds().includes(asked)) return asked;
    if (params.get('level') !== null && drawing) {
      console.warn(`MODEL: unknown level "${params.get('level')}"; using MAIN FL. `
        + `Known: ${levelIds().join(', ')}`);
    }
    return levelIds().includes(MAIN_FLOOR_LEVEL_ID) ? MAIN_FLOOR_LEVEL_ID : levelIds()[0];
  };

  // ── what is on the page ───────────────────────────────────────────────────
  // FIVE RULES, NOT ONE, measured from MODEL.dc.html:6505-6513:
  //   walls / lines / floors  filter by level AND view
  //   roofs / outlines        filter by level ONLY -- no view filter at all
  //   and the view filter switches ITSELF OFF on a level that has no layer
  //   views (ROOF, SITE), which show everything they hold.
  //
  // The trap in the third rule: floors default to view 'floor', not 'plan'
  // (MODEL.dc.html:2905). Writing `view === 'plan'` hides every floor in the
  // drawing and reads exactly like a broken painter.
  // ?view= PICKS THE DRAWING, and without it half the level is unreachable.
  //
  // Tier 2a defaulted the layer view and offered no way to change it, which
  // quietly switched the floors off: MAIN FL and 2ND FL default to the walls
  // plan, FOUNDATION to the concrete, and a floor saves with `view: 'floor'`
  // (MODEL.dc.html:2905). So `(view || 'plan') === viewId` was false for every
  // floor on every reachable view, paintFloors() drew nothing anywhere, and
  // the readout said `floors 0` on a drawing that has them. Tier 1 painted
  // them; tier 2a turned them off and no spec noticed, because the specs
  // asserted walls.
  //
  // A level is not one drawing. Choosing the level and not the drawing is
  // choosing half.
  // A CUT IS A VIEW, and it is named in the URL like every other one.
  // SPEC-model-html-cut-views.md called for "a state saying which one you are
  // looking at" and the first draft of that spec proposed building one. The
  // page already had it: `?view=` keyed through the URL. A second source of
  // truth for what is on screen is the defect shape this project spent the
  // week removing, so the section reuses the mechanism instead — which also
  // means it is shareable, survives a reload, and inherits the level-change
  // handling below for free.
  const CUT_VIEW = 'cut:';
  // BOTH LISTS, as the old page's _cutById reads them (MODEL.dc.html:9531):
  // the four DERIVED elevations first, then the drafter's stored sections.
  //
  // This searched `cuts()` alone when the host shipped, which was wrong and
  // quiet about it: E1-E4 are not in `cuts` -- they are computed from the
  // plan's extents -- so every `?view=cut:E1` resolved to null, fell through
  // to the layer-view branch, and warned about a view the level does not
  // have. Nothing caught it because nothing had asked for an elevation yet;
  // the rail is what asks, and it would have seated four dead cards.
  const cutForViewId = id => {
    if (typeof id !== 'string' || !id.startsWith(CUT_VIEW)) return null;
    const wanted = id.slice(CUT_VIEW.length);
    return allCuts().find(cut => String(cut.id) === wanted) || null;
  };
  const activeCut = () => cutForViewId(params.get('view'));
  // The hand-set frame for THIS cut, if any (see elevPin).
  const elevPinned = cut => !!(elevPin && cut && elevPinFor === String(cut.id || cut.name));

  const activeViewId = () => {
    if (thumbTarget) return thumbTarget.viewId;
    const LV = window.DraftLayerViews;
    const levelId = activeLevelId();
    const views = LV.layerViewsForLevelId(levelId);
    const asked = params.get('view');
    // Before the layer-view lookup, or a cut would be reported as a view the
    // level does not have and warn on every paint.
    if (cutForViewId(asked)) return asked;
    if (!views.length) return null;               // ROOF / SITE hold everything
    if (asked && views.some(v => v.id === asked)) return asked;
    if (asked) {
      console.warn(`MODEL: level ${levelId} has no view "${asked}"; using its `
        + `default. Known: ${views.map(v => v.id).join(', ')}`);
    }
    return LV.defaultLayerViewId(levelId);
  };

  // THE PAIRED FLOOR, DRAWN FAINT (Movie, 7 Oct): on a split, MAIN FL and
  // the 0.5 floor are one storey drawn on two levels, and so are 2ND FL and
  // the 1.5 floor -- "show them, but make them even lighter like about half
  // the opacity to make it more obvious they can't edit it". Both ways round:
  // each of the pair shows the other.
  //
  // `ghostLevelId` is set only for the length of that faint pass, so every
  // filter below draws the partner's walls, openings and stairs -- and
  // nothing that picks, selects or edits ever sees it.
  //
  // THE PAIR IS READ OFF THE LADDER, not listed here. This was
  // `{2: 3, 3: 2, 4: 5, 5: 4}` -- a third copy of what level-assembly.js's
  // STOREY_FLOOR says and layout-plan.js asks it for -- and Movie's 14 Oct
  // ruling that a future 3rd floor must fold the same way is a ruling about
  // one table, not three. `halfLevelUnder` gives the mate below and
  // `fullFloorOver` the mate above, so this is still "the other level of my
  // storey" and still symmetric: each of the pair shows the other.
  const halfLevelPartner = levelId => {
    const LP = window.DraftLayoutPlan;
    if (!LP) return null;
    const under = LP.halfLevelUnder(levelId);
    return under != null ? under : LP.fullFloorOver(levelId);
  };
  let ghostLevelId = null;
  let ghostViewId = null;      // the same, for another view of this level
  let ghostKeep = null;        // and which of its items the ghost draws
  // ── BG: OTHER LAYERS BEHIND THIS ONE (Movie, 21 Oct) ───────────────────
  //
  // "to creat the ROOF i need to see the BG of the main floor walls
  // (BACKGROUND) can you put a little BG button in each of the LAYOUT preview
  // viewports and if somebody click the BG (to make it light up) the
  // BACKGROUND will show that story BEHIND the current floor and slightly
  // faded (so it obvious its a background)"; "we can turn on an off multiple
  // at a time"; "i would like the NODES to work in the BG". Keyed as the
  // seat is, `levelId:viewId|all`. This browser's, not the file's.
  const BG_ALPHA = 0.3;
  const BG_KEY = 'draft-bg-layers';
  var bgLayers = (() => {
    try { return new Set(JSON.parse(localStorage.getItem(BG_KEY) || '[]').map(String)); }
    catch { return new Set(); }
  })();
  const saveBgLayers = () => {
    try { localStorage.setItem(BG_KEY, JSON.stringify([...bgLayers])); } catch { /* private window */ }
  };
  // THE ONES TO DRAW HERE: every lit layer but the one in view.
  function bgEntries() {
    if (!drawing) return [];
    const ids = new Set((drawing.levels || []).map(l => Number(l.id)));
    return [...bgLayers].map(key => {
      const [lv, view] = key.split(':');
      return { levelId: Number(lv), viewId: view === 'all' ? null : view };
    }).filter(e => ids.has(e.levelId)
      && !(e.levelId === Number(activeLevelId()) && (e.viewId === null || e.viewId === activeViewId())));
  }
  // `fn` run as if the background layer were the one in view.
  function withBg(entry, fn) {
    const was = [ghostLevelId, ghostViewId];
    ghostLevelId = entry.levelId;
    ghostViewId = entry.viewId;
    try { return fn(); } finally { [ghostLevelId, ghostViewId] = was; }
  }
  // THE WALLS BEHIND, for the snaps: their ends and their face corners.
  function bgWalls() {
    return bgEntries().flatMap(entry => withBg(entry, () => walls()));
  }
  const onActiveLevel = () => {
    const LV = window.DraftLayerViews;
    const levelId = ghostLevelId ?? activeLevelId();
    const views = LV.layerViewsForLevelId(levelId);
    const viewId = ghostViewId ?? activeViewId();
    // THE FALLBACK DIFFERS BY ITEM TYPE. Measured, not assumed: every
    // `.view || '...'` in MODEL.dc.html reads 'plan' -- wall, line, stair,
    // opening, fixture, device, seg, 20-odd sites -- EXCEPT floors, which
    // read 'floor' (MODEL.dc.html:2905, 9029, 9089, 9098, 9162, 17025).
    //
    // A floor outline's home layer set is FLOOR, or FOUNDATION where it is a
    // concrete slab; it was never a plan-set item. Defaulting floors to
    // 'plan' put a view-less floor on the wrong layer set -- invisible on
    // every fixture, because a floor drawn by the old page always carries an
    // explicit `view`, and visible only on an older saved drawing whose
    // floors predate the field. Those are exactly the drawings that have to
    // keep opening, so the spec builds that case by hand.
    const onPlan = (item, fallback = 'plan') =>
      !views.length || (item.view || fallback) === viewId;
    const byLevel = item => Number(item.levelId) === levelId;
    return { levelId, viewId, onPlan, byLevel };
  };
  const walls = () => (drawing?.walls || [])
    .filter(w => { const f = onActiveLevel(); return f.byLevel(w) && f.onPlan(w) && (!ghostKeep || ghostKeep(w)); });
  const lines = () => (drawing?.lines || [])
    .filter(l => { const f = onActiveLevel(); return f.byLevel(l) && f.onPlan(l); });
  const floors = () => (drawing?.floors || [])
    .filter(x => { const f = onActiveLevel(); return f.byLevel(x) && f.onPlan(x, 'floor'); });
  // Rules four and five: LEVEL ONLY. A roof footprint and a reference shape are
  // level-wide -- every drawing of the level shows them -- so they take no view
  // filter at all. Copying the walls line here would hide both on FOUNDATION.
  // AND ON THE STOREY IT WAS DRAWN ON (Movie, 21 Oct: draw the lower roof on
  // the 2nd floor "but for it to also show on the 2nd FLoor PLAN and on the
  // ROOF plan"), where it is picked and edited too.
  const roofs = () => (drawing?.roofs || [])
    .filter(r => onActiveLevel().byLevel(r)
      || (r.drawnOn != null && Number(r.drawnOn) === onActiveLevel().levelId));
  // DIMENSIONS TAKE NO FALLBACK, and that is not an oversight -- it is the
  // one collection whose invariant is guaranteed upstream. MODEL.dc.html:8929
  // filters `dimension.view === view` with no `|| 'plan'`, because
  // format.dimensions (drawing-format.js:101) DROPS any dimension whose view
  // is not one of plan/floor/e-power/foundation. By the time anything filters
  // them, every survivor carries an explicit view.
  //
  // So copying the walls line here would be worse than redundant: `|| 'plan'`
  // can only fire on a dimension the normaliser already rejected, which means
  // it would only ever run on geometry that is not in the array. Writing the
  // filter to match the guarantee is what makes the guarantee readable.
  const dimensions = () => (drawing?.dimensions || [])
    .filter(d => { const f = onActiveLevel(); return f.byLevel(d)
      && (f.viewId == null || d.view === f.viewId); });
  // AUTO DIMS / HAND DIMS ON THE SHEET (Movie, 18 Oct): each kind can be put
  // out of sight and back with a chip beside the north arrow. A string is
  // AUTO when AUTO DIMS laid it and HAND otherwise. It is how the screen
  // looks, not what the drawing holds -- the sheets in LAYOUT print every
  // string their layers allow -- so it lives in this browser, not the .draft.
  // `var` and a hoisted function because paint() reaches here before the
  // page's consts are made.
  var dimsHidden = readDimsHidden();
  function readDimsHidden() {
    try {
      const v = JSON.parse(localStorage.getItem('model.dimsHidden') || '{}');
      return { auto: v.auto === true, hand: v.hand === true };
    } catch (e) { return { auto: false, hand: false }; }
  }
  function dimKind(d) { return d.auto === true ? 'auto' : 'hand'; }
  const shownDimensions = () => dimensions().filter(d => !dimsHidden[dimKind(d)]);
  // NOTES TAKE THE DIMENSION RULE -- level, plus view where the level has views
  // -- and then one exclusion the bone applies on top of it. MODEL.dc.html:7025
  // filters `note.view !== 'stair'` AFTER _activeNotes(), which reads redundant
  // beside the view match and is not: a level with NO layer views matches every
  // note it holds, stair ones included, and the STAIR workspace is a separate
  // surface with its own painter (drawStairNotes2D, tier 3).
  const notes = () => (drawing?.notes || [])
    .filter(n => { const f = onActiveLevel(); return f.byLevel(n)
      && (f.viewId == null || n.view === f.viewId)
      && n.view !== 'stair'; });
  // ── ROOM TAGS ─────────────────────────────────────────────────────────────
  //
  // Movie, 1 Oct: "just make ROOM TAG that a user can place and fill out the
  // info", NAME on the top line and the size, in feet, on the second. No
  // detection and no auto-placing: a tag is a label the drafter puts down.
  //
  // FLOOR PLAN ONLY. A tag is a record of the walls drawing (view 'plan', the
  // only view the format gives one), and ROOM-IDS-AREA sits in that view's
  // layer list alone -- so a tag shows where its layer does.
  const ROOM_TAG_LAYER = 'ROOM-IDS-AREA';
  const roomTags = () => (drawing?.roomTags || [])
    .filter(t => { const f = onActiveLevel(); return f.byLevel(t)
      && (f.viewId == null || f.viewId === 'plan'); });
  const roomTagsShown = () => layerStandardOf(ROOM_TAG_LAYER)?.visible !== false;
  // THE BOX IS MEASURED, not cached from the last paint: a hit test and the
  // highlight both need it, and the highlight paints BEFORE the tags do. The
  // fonts are the painter's own (render-2d.js drawRoomTag2D).
  // THE PAINTER'S OWN ENV, so the lines the box covers are the lines drawn:
  // the size as typed, and the AREA a shaped tag measures (Movie, 23 Oct).
  const roomTagEnv = () => ({
    color: skin['draw-note'],
    areaFor: tag => tag.size || '',
    areaLabel: sqFt => (metric()
      ? `${(Math.round(sqFt * 0.09290304 * 10) / 10).toLocaleString('en-US')} m\u00b2`
      : `${Math.round(sqFt).toLocaleString('en-US')} SQ FT`),
  });
  const roomTagBox = tag => {
    const s = toS(tag.at);
    const R = window.DraftRender2D;
    const lines = R?.roomTagLines ? R.roomTagLines(tag, roomTagEnv()) : (tag.size ? [tag.size] : []);
    ctx.save();
    ctx.font = '600 13px "Barlow Condensed", system-ui, sans-serif';
    let w = ctx.measureText(String(tag.name || '')).width;
    ctx.font = '500 10px "Barlow Condensed", system-ui, sans-serif';
    lines.forEach(line => { w = Math.max(w, ctx.measureText(String(line)).width); });
    ctx.restore();
    const pad = 4;
    return {
      left: s.x - w / 2 - pad, right: s.x + w / 2 + pad,
      top: s.y - (lines.length ? 14 : 8) - pad, bottom: s.y + (lines.length ? 1 + 11 * lines.length : 8) + pad,
    };
  };
  // ── A ROOM TAG'S SHAPE (Movie, 23 Oct) ────────────────────────────────
  // "the FLOOR shape and ROOM TAG shape can be the same thing": a tag placed
  // by hand gets a small square to start ("i'll just make a small square for
  // each room"), and its corners drag -- onto a wall's node to LINK there,
  // so the floor follows the wall. A press on an edge's midpoint adds a
  // corner; a corner dropped on its neighbour is let go.
  const ROOM_TAG_SQUARE_FT = 3;
  const ROOM_HANDLE_PX = 7;
  const ROOM_EDGE_PICK_PX = 5;
  const roomShapeOf = tag => (Array.isArray(tag?.points) && tag.points.length >= 3 ? tag.points : null);
  // A corner is LINKED when a wall stands on the same point object (the
  // pool's identity, not its coordinates) -- or when it carries a `link`:
  // a wall's end and its own offset from it (Movie, 23 Oct: "can we also
  // get it to LINK to non-NODE, corners of 2 walls?"). The inside corner of
  // two centre-line walls is no node; it is a face corner, half a wall off
  // the node, and the link keeps that offset as the node moves.
  const linkWall = pt => (pt?.link ? (drawing?.walls || []).find(w => String(w.id) === String(pt.link.wallId)) || null : null);
  const wallsOnCorner = pt => {
    const on = (drawing?.walls || []).filter(w => w.start === pt || w.end === pt);
    const by = linkWall(pt);
    return by && !on.includes(by) ? [...on, by] : on;
  };
  const ROOM_LINK_FT = 1;
  // THE LINK A FREE POINT TAKES: the nearest wall end within a foot, and the
  // offset from it. None when no wall end is near.
  const roomLinkAt = p => {
    let best = null;
    walls().forEach(w => ['start', 'end'].forEach(end => {
      const v = w[end];
      if (!v) return;
      const d = Math.hypot(v.x - p.x, v.z - p.z);
      if (d <= ROOM_LINK_FT && (!best || d < best.d)) best = { d, link: { wallId: String(w.id), end, dx: p.x - v.x, dz: p.z - v.z } };
    }));
    return best ? best.link : null;
  };
  // EVERY PAINT, A LINKED CORNER STANDS ITS OFFSET OFF ITS WALL'S END, so it
  // follows the wall's node wherever a drag or an UNDO puts it. A wall that
  // is gone drops the link and the corner stays where it stood: the floor
  // outlives the wall (Movie: "the floor just stays in same position").
  var followRoomLinks = () => {
    (drawing?.roomTags || []).forEach(tag => {
      if (!Array.isArray(tag.points)) return;
      tag.points.forEach(pt => {
        if (!pt.link) return;
        const w = linkWall(pt);
        const v = w && w[pt.link.end];
        if (!v) { delete pt.link; return; }
        const x = v.x + pt.link.dx, z = v.z + pt.link.dz;
        if (Math.abs(pt.x - x) > 1e-9 || Math.abs(pt.z - z) > 1e-9) { pt.x = x; pt.z = z; }
      });
    });
  };
  const roomSquare = at => [
    { x: at.x - ROOM_TAG_SQUARE_FT / 2, z: at.z - ROOM_TAG_SQUARE_FT / 2 },
    { x: at.x + ROOM_TAG_SQUARE_FT / 2, z: at.z - ROOM_TAG_SQUARE_FT / 2 },
    { x: at.x + ROOM_TAG_SQUARE_FT / 2, z: at.z + ROOM_TAG_SQUARE_FT / 2 },
    { x: at.x - ROOM_TAG_SQUARE_FT / 2, z: at.z + ROOM_TAG_SQUARE_FT / 2 },
  ];
  const roomTagArea = tag => {
    const pts = roomShapeOf(tag);
    if (!pts || tag.areaShown === false) return 0;
    return window.DraftDrawingFormat.loopAreaSqFt(pts);
  };
  // The handle under the hand on a picked shape: a corner, or an edge's
  // midpoint. Corners first, so a short edge's midpoint never shadows one.
  const roomHandleAt = (tag, worldPt) => {
    const pts = roomShapeOf(tag);
    if (!pts) return null;
    const p = toS(worldPt);
    const near = (q, r) => { const s2 = toS(q); return Math.hypot(s2.x - p.x, s2.y - p.y) <= r; };
    const corner = pts.findIndex(q => near(q, ROOM_HANDLE_PX + 2));
    if (corner >= 0) return { kind: 'corner', index: corner };
    const mid = pts.findIndex((q, i) => {
      const r = pts[(i + 1) % pts.length];
      return near({ x: (q.x + r.x) / 2, z: (q.z + r.z) / 2 }, ROOM_HANDLE_PX);
    });
    return mid >= 0 ? { kind: 'mid', index: mid } : null;
  };
  const roomEdgeNear = (tag, worldPt) => {
    const pts = roomShapeOf(tag);
    if (!pts) return false;
    const p = toS(worldPt);
    return pts.some((q, i) => {
      const a = toS(q), b = toS(pts[(i + 1) % pts.length]);
      const dx = b.x - a.x, dy = b.y - a.y;
      const len2 = dx * dx + dy * dy;
      const t = len2 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2)) : 0;
      return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy)) <= ROOM_EDGE_PICK_PX;
    });
  };
  const roomTagAt = worldPt => {
    if (!roomTagsShown()) return null;
    const p = toS(worldPt);
    const tags = roomTags().slice().reverse();
    return tags.find(tag => {
      const b = roomTagBox(tag);
      return p.x >= b.left && p.x <= b.right && p.y >= b.top && p.y <= b.bottom;
    }) || tags.find(tag => roomEdgeNear(tag, worldPt)) || null;
  };
  // ── A NOTE IS PICKED BY ITS TEXT ──────────────────────────────────────────
  // Movie, 10 Oct ("looks good as you have it"): notes are selected, moved,
  // deleted and edited like the rest. The box is render-2d's own
  // (noteBoxScreen2D), the one the painter draws in, so the pick and the
  // picture cannot disagree; the leader is picked within a few px of it.
  const NOTE_LEADER_GRAB_PX = 5;
  const NOTE_TIP_GRAB_PX = 8;
  // What a drag of a selection moves as one piece.
  const MOVE_TOGETHER = new Set(['line', 'note']);
  const noteBox = note => window.DraftRender2D.noteBoxScreen2D(ctx, toS(note.anchor), toS(note.text), note, view.scale);
  const noteAt = worldPt => {
    const p = toS(worldPt);
    return notes().slice().reverse().find(note => {
      const b = noteBox(note);
      if (p.x >= b.left && p.x <= b.right && p.y >= b.top && p.y <= b.bottom) return true;
      if (note.end === 'none') return false;
      const a = toS(note.anchor), t = toS(note.text);
      const from = b.world ? t : { x: t.x >= a.x ? b.left : b.right, y: t.y };
      // pointToSegment reads x/z; screen y stands in for z.
      return window.DraftGeometry2D.pointToSegment({ x: p.x, z: p.y },
        { start: { x: a.x, z: a.y }, end: { x: from.x, z: from.y } }).d <= NOTE_LEADER_GRAB_PX;
    }) || null;
  };
  // FIXTURES INHERIT THEIR WALL'S VISIBILITY -- they do not carry a view rule
  // of their own. MODEL.dc.html:_activeFixtures keeps a fixture whose levelId
  // matches AND whose wallId is in the set of walls the page is showing, and
  // the note above it says why in as many words: "a fixture inherits the
  // layer-view exclusion rather than having one of its own", and that
  // inheritance is the only thing keeping a sink unselectable on the ELECTRIC
  // sheet. Filtering on `fixture.view` here would look equivalent and would
  // not be -- a fixture on a hidden wall would come back.
  //
  // ONE DIFFERENCE, STATED RATHER THAN HIDDEN. The bone unions in
  // _sharedContextWalls() -- the foundation walls it ghosts under a plan, the
  // plan walls it ghosts under e-power. This page paints no context walls at
  // all (walls() is the plain view filter), so keying off walls() gives it the
  // same RULE against a smaller set: a fixture shows when its host wall shows
  // HERE. When context walls arrive, this follows them with no edit, which is
  // the reason it reads walls() rather than repeating the filter.
  const fixtures = () => {
    const shown = new Set(walls().map(w => w.id));
    return (drawing?.fixtures || [])
      // A FIXTURE KEPT WHEN ITS WALL WENT (`host`) shows on its own level.
      .filter(fx => onActiveLevel().byLevel(fx) && (fx.wallId == null ? !!fx.host : shown.has(fx.wallId)));
  };
  // CUTS TAKE NO LEVEL FILTER, and that is the bone's rule rather than an
  // omission here. _drawCuts2D (MODEL.dc.html:7432) is called ungated -- no
  // activeVisible, no view test -- because a section cut is a fact about the
  // BUILDING, not about one storey: the same line through the house is what
  // the drafter wants to see whichever floor is on screen. The four auto marks
  // carry levelId: null, which says the same thing in the data.
  const cuts = () => drawing?.cuts || [];
  // STAIRS FILTER STRICTLY ON view, and that is copied deliberately rather
  // than routed through onPlan(). _activeStairs (MODEL.dc.html) reads
  // `stair.view === view` with NO `|| 'plan'` fallback, unlike every wall,
  // line and fixture beside it. So a stair saved without a view is hidden on
  // a level that has layer views, and shown on one that has none. Reusing
  // onPlan() here would have quietly REVEALED those stairs on this page only.
  const stairs = () => {
    const { levelId, viewId } = onActiveLevel();
    const views = window.DraftLayerViews.layerViewsForLevelId(levelId);
    return (drawing?.stairs || [])
      .filter(stair => Number(stair.levelId) === levelId
        && (!views.length || stair.view === viewId));
  };
  // UNDERLAYS TAKE THE LEVEL FILTER ONLY -- no view filter, because an
  // underlay is a tracing image for the whole level, not for one layer set.
  // That is the painter's own rule (drawUnderlays2D skips on
  // `underlay.levelId !== env.activeLevel.id` and tests nothing else), copied
  // rather than invented.
  const underlays = () => (drawing?.underlays || [])
    .filter(underlay => Number(underlay.levelId) === activeLevelId());

  // Decoded tracing images, by underlay id. Empty until the async loader
  // fills it, which is why paint() must tolerate a missing image -- and the
  // painter already does: `if (!image) continue`.
  const underlayImages = new Map();

  // THE TRACE CHIP DECIDES WHETHER THEY SHOW (Movie, 7 Oct): "when you press
  // it it turn ON and if there is images already loaded it will show them,
  // click it again and it turns off the images turn off". Remembered in this
  // browser, so a drafter halfway through a tracing finds it as they left it.
  let traceOn = (() => {
    try { return localStorage.getItem('draft.trace.on') === '1'; } catch { return false; }
  })();

  // PDF.JS ONLY WHEN A PDF IS ASKED FOR. It is 1.37 MB with its worker, and
  // this page's claim is a short dependency list -- so a drafter who never
  // traces a PDF never fetches it. Photos need none of it.
  let pdfJsLoading = null;
  const ensurePdfJs = () => {
    if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
    if (!pdfJsLoading) {
      pdfJsLoading = new Promise((resolve, reject) => {
        const tag = document.createElement('script');
        tag.src = './vendor/pdf-3.11.174.min.js';
        tag.onload = () => {
          if (!window.pdfjsLib) { reject(new Error('the PDF library did not start')); return; }
          window.pdfjsLib.GlobalWorkerOptions.workerSrc = './vendor/pdf-3.11.174.worker.min.js';
          resolve(window.pdfjsLib);
        };
        tag.onerror = () => reject(new Error('the PDF library could not be fetched'));
        document.head.appendChild(tag);
      }).catch(error => { pdfJsLoading = null; throw error; });
    }
    return pdfJsLoading;
  };

  // Photos decode straight from their stored blob; a PDF kept as vector
  // re-renders its page through pdf.js, as MODEL.dc.html does. Only while
  // TRACE is on: nothing is fetched or decoded for images nobody is showing.
  const loadUnderlayImages = async () => {
    if (!traceOn) return;
    for (const underlay of (drawing?.underlays || [])) {
      if (underlayImages.has(underlay.id)) continue;
      try {
        const file = await window.SharedFileStore.loadNamedFile(underlay.id, 'underlays');
        if (!file) continue;
        let canvas = null;
        if (underlay.kind === 'dxf') {
          // A DXF is kept as its lines, never a picture: read once, drawn by
          // render-2d at whatever zoom.
          canvas = { dxf: true, ...window.DraftDxfReader.parse(await file.text()) };
        } else if (underlay.kind === 'pdf') {
          const pdfjs = await ensurePdfJs();
          const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
          const page = await doc.getPage(Math.min(underlay.page || 1, doc.numPages));
          const one = page.getViewport({ scale: 1 });
          const viewport = page.getViewport({ scale: Math.min(2.6, 2200 / Math.max(one.width, one.height)) });
          canvas = document.createElement('canvas');
          canvas.width = Math.round(viewport.width);
          canvas.height = Math.round(viewport.height);
          await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
          doc.destroy().catch(() => {});
        } else {
          const bitmap = await createImageBitmap(file).catch(() => null);
          if (!bitmap) continue;
          canvas = document.createElement('canvas');
          canvas.width = bitmap.width;
          canvas.height = bitmap.height;
          canvas.getContext('2d').drawImage(bitmap, 0, 0);
          bitmap.close();
        }
        underlayImages.set(underlay.id, canvas);
        // Each image repaints as it lands, rather than one repaint at the end:
        // a large tracing image can take a moment and the drawing above it is
        // already correct without it.
        paint();
        updateReadout();
        // A DXF's layer chips wait on the file; an open card gets them now.
        if (underlay.kind === 'dxf' && !traceAsk.hidden) openTraceAsk();
      } catch (error) {
        console.warn(`MODEL: underlay ${underlay.id} failed to load:`, error);
      }
    }
  };

  const shapes = () => (drawing?.shapes || [])
    .filter(sh => onActiveLevel().byLevel(sh));

  // BEAMS AND COLUMNS take the level AND view rule: a foundation beam has no
  // business on the main floor's plan, and the old page files them by view the
  // same way.
  const beams = () => (drawing?.beams || [])
    .filter(b => onActiveLevel().byLevel(b) && onActiveLevel().onPlan(b));
  const columns = () => (drawing?.columns || [])
    .filter(c => onActiveLevel().byLevel(c) && onActiveLevel().onPlan(c));
  // Outlines take the same LEVEL-ONLY rule as roofs -- rule four above. They
  // are the room and garage footprints, level-wide, so no view filter.
  // ON THE BONEYARD THE MASTERS ARE THE SHELF'S CONTENTS. A master lives in
  // boneyardOutlines keyed by shelfId rather than in drawing.outlines keyed by
  // levelId, so the byLevel filter can never reach one -- and until now this
  // page drew nothing at all on a shelf that held only a master.
  //
  // That is also what made §4 unbuildable: the order says "the page has no
  // gesture to move a master at all", and a master you cannot see is one you
  // cannot grab.
  const outlines = () => (showingBoneyard()
    ? (drawing?.boneyardOutlines || []).filter(o => Number(o.shelfId) === activeShelfId())
    : (drawing?.outlines || []).filter(o => onActiveLevel().byLevel(o)));

  // Every point that defines the drawing's extent, for fit-to-content.
  const allPoints = (wide = false) => {
    const pts = [];
    walls().forEach(w => { if (w.start && w.end) pts.push(w.start, w.end); });
    lines().forEach(l => { if (l.start && l.end) pts.push(l.start, l.end); });
    floors().forEach(f => (f.points || []).forEach(p => pts.push(p)));
    // ROOFS AND OUTLINES ONLY WHEN ASKED, and the scoping is the point.
    //
    // ROOF and SITE hold no walls, lines or floors at all -- a roof footprint
    // and an outline is the whole of them -- so a fit over the three above
    // finds nothing, falls back to scale 6 at the world origin, and draws the
    // level off the side of the canvas. The plan seats have to fit those two
    // levels, so they ask for all five, the way MODEL.dc.html's own thumbnail
    // bounds do (:7269).
    //
    // THE MAIN VIEW DELIBERATELY DOES NOT, even though it has the same gap.
    // Adding them there changes the default zoom of every drawing that owns a
    // roof or an outline -- which is nearly all of them -- and that showed up
    // immediately: model-html-corner.spec.js released a corner 2px from
    // another and it landed 0.66ft away instead of snapping, because 2px is a
    // different distance once the scale moves. Fixing a real fit bug is not a
    // licence to re-zoom the drafter's page inside a rail change. The gap is
    // written up rather than smuggled; pressing 0 on ROOF still fits to
    // nothing, and that is one line to change when somebody rules on it.
    if (wide) {
      roofs().forEach(r => (r.points || []).forEach(p => pts.push(p)));
      outlines().forEach(o => (o.points || []).forEach(p => pts.push(p)));
    }
    // AND A SEAT FRAMES THE HALF FLOOR IT IS CARRYING (Movie, 14 Oct). The
    // 1.5 card is gone from the rail, so the 2ND FL thumbnail is the whole
    // of what the rail now says about that storey -- and a 1.5 floor over a
    // garage reaches past the 2ND FL walls, which is exactly the part that
    // would be cropped out of the picture. layout-plan's `planBounds` folds
    // the half floor into the sheet's frame for the same reason.
    //
    // THUMBNAILS ONLY, on the ruling written just above: the main view's fit
    // is the drafter's default zoom, and re-framing it is a change nobody
    // pressed for. The ghost is still drawn there, inside whatever the full
    // floor frames, as it has been since 7 Oct.
    if (thumbTarget) {
      const partner = halfLevelPartner(activeLevelId());
      if (partner != null && (drawing?.levels || []).some(l => Number(l.id) === partner)) {
        const was = ghostLevelId;
        ghostLevelId = partner;
        try {
          walls().forEach(w => { if (w.start && w.end) pts.push(w.start, w.end); });
          floors().forEach(f => (f.points || []).forEach(p => pts.push(p)));
        } finally { ghostLevelId = was; }
      }
    }
    return pts.filter(p => Number.isFinite(p?.x) && Number.isFinite(p?.z));
  };

  // THE TWO DARK BARS SIT ON TOP OF THE CANVAS, not beside it. #plan is the
  // full height of the sheet and #strip / #house-strip are `position:fixed`
  // over its top and foot, so a fit computed against cssH frames the drawing
  // into a rectangle that is partly covered -- and geometry under a bar cannot
  // be grabbed by ANYONE, drafter or check. It is not a drawing bug, it is a
  // reach bug: the wall is painted, it is just not pressable.
  //
  // This was live before the bars grew and nothing said so, because the band
  // it stole was small enough that the hit tolerance covered it. Widening the
  // instrument strip from 34px to 44px pushed the top edge of the plan 10px
  // further under the bar and tests/model-toy-draw.spec.js:758 started
  // failing -- the press landed 2px INSIDE the strip. Shaving 10px back off
  // the bar would have moved the cliff rather than removed it, and put it
  // under whichever control gets added next.
  //
  // MEASURED, NOT ASSUMED. --house-h is a `min-height`, so the foot bar is
  // free to be taller than the variable says as soon as its row wraps;
  // reading the variable would be right until it wasn't. The elements are
  // asked how tall they actually are.
  //
  // NOT DURING A SEAT. paintPlanThumb borrows fit() to frame a level into an
  // 82x54 offscreen canvas, and no bar is over THAT -- insetting it would
  // shrink every thumbnail by a band that isn't there. thumbTarget is already
  // the page's word for "painting a seat, not the sheet".
  //
  // THE SIDE RAILS ARE NOT HANDLED HERE and this does not pretend to. They
  // are toggleable, they overlay the same way, and the same reach bug is
  // available along the left edge -- model-toy-draw.spec.js opens without
  // ?left=1 for exactly that reason. One thing at a time; the bars are what
  // #401 is red over.
  // SET WHILE THE PRESENTATION IS BEING PHOTOGRAPHED. See chromeInsets.
  let shootingPaper = false;

  const chromeInsets = () => {
    // NO BAR IS OVER A PICTURE. Two callers frame an IMAGE rather than the
    // sheet: paintPlanThumb, which borrows fit() for an 82x54 seat, and
    // wholePlanShot, which fits the plan and photographs the canvas for page
    // two of the presentation. Neither result has a bar anywhere near it --
    // the bars are DOM elements sitting ON TOP of the canvas, so they are not
    // in the PNG and never were -- and insetting either one frames it around
    // furniture that is not in the room.
    //
    // MEASURED, because "the plan prints a bit smaller" is not something
    // anyone spots by looking: with the insets applied the walls spanned
    // 76.4% of the printed page's height against 86% without them, a tenth
    // of the sheet given to white bands at the top and bottom.
    if (thumbTarget || shootingPaper) return { top: 0, bottom: 0 };
    const tall = id => {
      const el = document.getElementById(id);
      if (!el || el.hidden) return 0;
      const r = el.getBoundingClientRect();
      return Number.isFinite(r?.height) ? r.height : 0;
    };
    // THE HEM IS NOT THE BAR. The house strip carries --browser-lane as bottom
    // padding so the browser's own link-preview strip lands on panel colour
    // instead of on a nav chip -- and that band is the BROWSER'S, drawn over
    // whatever is beneath it and only while a link is hovered. A drawing that
    // dodged it would be permanently smaller to make room for a tooltip.
    //
    // MEASURED OFF THE ELEMENT, not read back from the custom property: the
    // lane IS this padding, so taking the padding cannot drift from what is
    // rendered the way a second lookup of the variable could.
    //
    // IT COST A SPEC TO LEARN. The lane made the strip 64px where it had been
    // 40, and the line at the foot of this function offsets the drawing by
    // half the DIFFERENCE between the two bars -- so the plan slid 10px up,
    // model-html-select's wall came off the canvas centre, and a click 4px
    // from it was suddenly 16px from it and outside the 12px grab zone. The
    // comment there already said why it would be invisible until it wasn't:
    // "Equal bars, no offset, which is why this was invisible while they
    // matched."
    const hemOf = id => {
      const el = document.getElementById(id);
      if (!el) return 0;
      const pad = parseFloat(getComputedStyle(el).paddingBottom);
      return Number.isFinite(pad) ? pad : 0;
    };
    const top = tall('strip');
    // AND THE SHELF PREVIEWS' BAND ABOVE THE BAR (#shelf-strip), while the
    // squares are UP: they rise over the sheet, and a drawing fitted under
    // them would have its foot where a press lands on a square instead of
    // on the wall (model-tool-select's south wall did, measured). What is
    // counted is the part of the strip ABOVE the bar's top edge, plus a
    // hair of air. Retracted, the tab sits inside the bar and the band is
    // as it was -- the offset a taller bottom bar puts on the centre is
    // one several specs stand on.
    const stripBand = () => {
      const el = document.getElementById('shelf-strip');
      const bar = document.getElementById('house-strip');
      if (!el || !bar || el.hidden || el.dataset.open !== 'true') return 0;
      const r = el.getBoundingClientRect(), b = bar.getBoundingClientRect();
      const above = Number.isFinite(r?.top) && Number.isFinite(b?.top) ? b.top - r.top : 0;
      return above > 0 ? above + 4 : 0;
    };
    const bottom = Math.max(tall('house-strip') - hemOf('house-strip'), 0) + stripBand();
    // ── AND NOT THE SIDE TABS, WHICH WAS TRIED AND MEASURED ────────────
    //
    // Movie, 27 Sep, asked for the marks to clear "the top bottom and
    // sidemenus". The bars are insetted here and the three rail tabs are not,
    // which looks like the same omission -- so an inset for them was written,
    // and then taken out again because nothing could tell the difference.
    //
    // MEASURED, on repro-garage-house at 1280x720: the mark ring spans x 230
    // to 1050 while DRAFTING TOOLS ends at 26 and LEVELS / LAYERS begins at
    // 1254. Two hundred pixels of clearance on each side, against a tab
    // twenty-six wide. The vertical is the tight one -- 45px clear at the top
    // and 21 at the bottom -- because the fit is HEIGHT-bound, and the 0.86
    // margin therefore leaves the width enormous slack. A wide house is
    // width-bound instead, and 7% of the sheet is still ninety pixels a side.
    //
    // SO THE TABS ARE ALREADY CLEARED BY THE MARGIN, and an inset for them is
    // a change no check can see. What Movie was actually looking at is the
    // other half of this: the marks were off the frame entirely, which fit()
    // fixes by measuring them.
    // A sheet that is nearly all bar is a broken layout, not a tight fit.
    // Refusing the inset there leaves the old framing rather than dividing
    // the drawing into a sliver -- visibly wrong beats invisibly tiny.
    if (!(cssH > 0) || top + bottom > cssH * 0.6) return { top: 0, bottom: 0 };
    return { top, bottom };
  };

  // A SHOWN HOLOGRAM IS ON THE SHEET TOO: its walls, where they are placed.
  // Main view only, like the marks below -- a rail thumbnail is this house.
  // THE SUITES STANDING ON THIS LEVEL, as they are drawn (Movie, 23 Oct:
  // "when i press the full zoom button ... they should be centered but they
  // come up like this off to the left"). hologram.js's framePoints frames
  // EVERY placed suite on every level, so a suite on another storey, or
  // far off on another floor, pulled the frame away from what is on the
  // sheet and left this level's own suite small in a corner. The walls
  // hologramWallsHere hands the painter are the walls this level shows.
  const hologramFramePoints = () => holograms()
    .flatMap(holo => hologramWallsHere(holo).flatMap(w => [w.start, w.end]))
    .filter(p => p && Number.isFinite(p.x) && Number.isFinite(p.z));
  const fit = (wide = false, margin = 0.86) => {
    // 0 TO FIT on an elevation: back to the painter's own fit.
    elevPin = null; elevPinFor = null;
    const own = allPoints(wide);
    const pts = thumbTarget || shootingPaper ? own : own.concat(hologramFramePoints());
    // THE EMPTY TEST STILL STANDS HERE FOR EVERY OTHER LEVEL, and only moves
    // out of the way for the site. It used to fire on a site every time --
    // allPoints measures the ACTIVE level's walls, lines and floors, and a
    // site has none -- so the fit fell to its 6 px/ft default and the lot,
    // the rows and the marks were never considered at all. Found by printing
    // the view rather than by reading the function: the published scale was
    // exactly the fallback's.
    //
    // NARROWED TO THE SITE, THOUGH. Carrying on past an empty level anywhere
    // else would frame the elevation ring of a house on ANOTHER level -- a
    // drafter standing on a storey he has not drawn yet would arrive zoomed
    // to the house below instead of at the page's own default, which is a
    // different view on every page that starts empty.
    const sitePlan = activeLevelId() === SITE_LEVEL_ID && !thumbTarget && !shootingPaper;
    if (!pts.length && !sitePlan) { view.cx = 0; view.cz = 0; view.scale = 6; return; }

    // ── THE ELEVATION MARKS ARE PART OF WHAT IS ON THE SHEET ───────────
    //
    // Movie, 27 Sep: *"can you adjust the 'default' opening window of model
    // space to zoom to a position so that the E1 - E4 lines have extra space
    // to the top bottom and sidemenus"*.
    //
    // `allPoints` measures walls, lines and floors, so a fit framed the HOUSE
    // and the ring of E marks standing off it fell outside -- which is what he
    // is looking at. The ring is drawn on every plan by default, so it is part
    // of the picture whether or not it is part of the building.
    //
    // NOT IN allPoints, THOUGH, and the scoping is the same ruling that keeps
    // roofs and outlines out of it: `allPoints(wide)` also feeds the rail
    // seats, and a thumbnail 82px across wants the HOUSE, not the house shrunk
    // to make room for four bubbles. The marks are folded in here, where the
    // main view is what is being framed, and the two callers that borrow fit()
    // to make a picture say so already.
    const framed = pts.slice();
    if (!thumbTarget && !shootingPaper) {
      // ── THE SITE PLAN IS THE LOT, NOT THE HOUSE ────────────────────────
      //
      // Movie, 14 Oct: "also on the SITE plan when the user brings it up zoom
      // to show the full site, dimensions and E1-E4 which will be located
      // around the perimeter of the site and dimensions".
      //
      // `allPoints` measures walls, lines and floors -- the BUILDING -- and
      // on every other level that is the subject. On this one the building is
      // a thing standing on the subject, so a fit framed the house and left
      // the lot, its two rows of figures and the ring of marks outside the
      // window. Everything that is drawn out there is folded in here: the lot
      // itself, the ends of every dimension row, and the ring as it is
      // PAINTED (round the lot on this level), not as it is stored.
      const site = sitePlan;
      const LS = window.DraftLotSizes;
      const LP = window.DraftLayoutPlan;
      const lot = site && LS ? LS.siteOutlineOf(drawing?.outlines) : null;
      if (lot) {
        (lot.points || []).forEach(point => framed.push(point));
        if (LP && typeof LP.siteDimStrings === 'function') {
          LP.siteDimStrings(drawing).forEach(row => {
            framed.push(row.start);
            framed.push(row.end);
          });
        }
      }
      // THE E MARKS AS DRAWN (eMarksDrawn): none on the shelf, so a shelf's
      // fit frames the suite and not the house's ring round nothing.
      eMarksDrawn().forEach(cut => {
        if (cut.startPt) framed.push(cut.startPt);
        if (cut.endPt) framed.push(cut.endPt);
      });
    }
    if (!framed.length) { view.cx = 0; view.cz = 0; view.scale = 6; return; }
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    framed.forEach(p => {
      if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x;
      if (p.z < minZ) minZ = p.z; if (p.z > maxZ) maxZ = p.z;
    });
    const ins = chromeInsets();
    // What is left of the sheet once the bars have taken their band.
    const openH = Math.max(cssH - ins.top - ins.bottom, 1);
    view.cx = (minX + maxX) / 2;
    // A drawing one foot across must not zoom to a thousand pixels per foot,
    // and a zero-extent one must not divide by zero.
    const spanX = Math.max(maxX - minX, 1);
    const spanZ = Math.max(maxZ - minZ, 1);
    view.scale = Math.min(cssW / spanX, openH / spanZ) * margin;
    view.scale = Math.max(0.25, Math.min(view.scale, 200));
    // CENTRE IN THE OPEN BAND, not on the canvas. toS puts view.cz at cssH/2
    // and that stays true -- panning and zooming are untouched. The drawing's
    // own middle is offset so it lands at the middle of what is uncovered:
    // half the DIFFERENCE between the bars, in feet. Equal bars, no offset,
    // which is why this was invisible while they matched.
    view.cz = (minZ + maxZ) / 2 - (ins.top - ins.bottom) / 2 / view.scale;
  };

  // ── ZOOM TO FILL ──────────────────────────────────────────────────────
  //
  // Movie, 23 Oct: "add a ZOOM TO FILL - fill the screen with the OBJECTS
  // DRAWN and add 20% padding without dimensions (from the building) and 10%
  // if dimensions (from the dimensions)".
  //
  // WHAT IS FRAMED is everything drawn on this level: walls, lines, floors,
  // roofs, outlines, shapes, columns, beams, stairs, notes and room tags, and
  // a hologram standing on the sheet -- not the E marks, which fit() frames
  // and which are not objects drawn. With dimension strings showing, the
  // frame is theirs: each string's drawn line stands DIM_LINE_PX off its
  // record on the screen, and its figure a little beyond that, so the
  // stand-off is folded in at the scale the frame lands on (two passes: the
  // stand-off is pixels, the frame is feet).
  //
  // THE PADDING is a share of the framed span, each side: a fifth of the
  // building's span round the building, a tenth of the strings' round the
  // strings. "20%" read as 20% of what is being framed rather than of the
  // sheet -- the building fills 1/1.4 of the sheet's tight axis, which is
  // the "little extra space" of the shelf fit he liked, and with dimensions
  // 1/1.2, tighter, since the figures already stand off the house.
  const ZOOM_FILL_PAD = { plain: 0.20, dims: 0.10 };
  // THE FIGURE OVER THE LINE: the line is DIM_LINE_PX off the record (19) and
  // the figure sits about 13px past it.
  const DIM_FILL_PX = 32;
  const zoomFillPoints = () => {
    const pts = [];
    const push = p => { if (p && Number.isFinite(p.x) && Number.isFinite(p.z)) pts.push(p); };
    walls().forEach(w => { push(w.start); push(w.end); });
    lines().forEach(l => { push(l.start); push(l.end); });
    [floors(), roofs(), outlines(), shapes()].forEach(list => list.forEach(item => (item.points || []).forEach(push)));
    columns().forEach(c => push(c.point));
    beams().forEach(b => { push(b.start); push(b.end); });
    stairs().forEach(st => { push(st.start); push(st.end); (st.points || []).forEach(push); });
    notes().forEach(n => { push(n.anchor); push(n.text); });
    roomTags().forEach(t => push(t.at));
    if (!thumbTarget && !shootingPaper) hologramFramePoints().forEach(push);
    return pts;
  };
  const zoomToFill = () => {
    if (!drawing) return false;
    const own = zoomFillPoints();
    const dims = shownDimensions().filter(d => d.start && d.end);
    if (!own.length && !dims.length) return false;
    const pad = dims.length ? ZOOM_FILL_PAD.dims : ZOOM_FILL_PAD.plain;
    const ins = chromeInsets();
    const openH = Math.max(cssH - ins.top - ins.bottom, 1);
    const frame = scale => {
      const framed = own.slice();
      dims.forEach(d => {
        const len = Math.hypot(d.end.x - d.start.x, d.end.z - d.start.z);
        if (len < 0.01) return;
        // THE LINE'S SIDE, as drawDimension2D stands it: the left of
        // start->end on a screen whose y is z.
        const nx = -(d.end.z - d.start.z) / len, nz = (d.end.x - d.start.x) / len;
        const off = DIM_FILL_PX / scale;
        [d.start, d.end].forEach(p => { framed.push(p); framed.push({ x: p.x + nx * off, z: p.z + nz * off }); });
      });
      let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
      framed.forEach(p => {
        if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x;
        if (p.z < minZ) minZ = p.z; if (p.z > maxZ) maxZ = p.z;
      });
      const spanX = Math.max(maxX - minX, 1), spanZ = Math.max(maxZ - minZ, 1);
      const next = Math.min(cssW / (spanX * (1 + 2 * pad)), openH / (spanZ * (1 + 2 * pad)));
      return { scale: Math.max(0.25, Math.min(next, 200)), minX, maxX, minZ, maxZ };
    };
    // Once at the sheet's scale to size the stand-off, once more at the
    // scale that gives.
    const first = frame(view.scale);
    const f = frame(first.scale);
    view.scale = f.scale;
    view.cx = (f.minX + f.maxX) / 2;
    view.cz = (f.minZ + f.maxZ) / 2 - (ins.top - ins.bottom) / 2 / view.scale;
    return true;
  };

  // ── painting ──────────────────────────────────────────────────────────────
  // THE DATUM IS THE DRAFTER'S ZERO, not the world's. MODEL.dc.html sets
  // state.drawingOrigin from the drafter's FIRST CLICK (MODEL.dc.html:10360),
  // so the point they start on reads as 0,0 from then on, and drawGrid2D
  // anchors the grid to it. Movie, 3 Sep: "that way he always first clicks on
  // 0,0."
  //
  // No click, no datum, and therefore NO GRID. That is deliberate, not a gap:
  // tests/registration-grid.spec.js asserts it by name -- "an untouched model
  // space draws no grid, and the first node sets the datum" -- and the grid
  // cannot be anchored to a point the drafter has not chosen yet. Tier 1's
  // hand-rolled grid drew always, aligned to world 0,0, which was a
  // divergence from the old page rather than a feature.
  //
  // ABSENT AND NULL MEAN DIFFERENT THINGS. This is the tier-2a floors bug's
  // exact shape, so it is spelled out rather than compressed. MODEL.dc.html
  // :5160 reads:
  //     'drawingOrigin' in saved ? normalise(saved.drawingOrigin) : {x:0,z:0}
  // Absent = a drawing made before the datum existed. It was drawn on the
  // world grid, so 0,0 is what leaves every coordinate where it is. Explicit
  // null = "no origin yet", which is where NEW starts and how it avoids
  // silently adopting 0,0.
  //
  // `drawing.drawingOrigin || null` would collapse the two and strip the grid
  // from every old drawing -- and no fixture would catch it, because the old
  // page always writes the key now.
  // THE SITE POINT, when there is a house to take it from (cut-marks.js
  // siteDatum: where the front and left outside foundation faces meet). It
  // is the gold target and the grid's origin both, so in TOY the one-foot
  // blocks line up from it (Movie, 1 Oct: "kindof like MINECRAFT, in the 1FT
  // block idea"). Cached on the model epoch like the elevation marks.
  // ON A BONEYARD SHELF, THE SAME POINT OFF THE SHELF'S OWN WALLS (Movie,
  // 22 Oct, on his 1BDEN suite: "also in the SHELF can the registration lower
  // right corner auto place itself like it does for a house"). The shelf's
  // walls are read as one storey -- siteDatum skips the boneyard's negative
  // levels by design -- so the suite's front-and-left corner is its target,
  // and it follows the suite when the suite moves. An empty shelf keeps the
  // first-click datum.
  let siteDatumCache = { epoch: -1, shelf: null, point: null };
  const siteDatumNow = () => {
    const shelf = boneyardActive ? boneyardLevelId() : null;
    if (siteDatumCache.epoch !== modelEpoch || siteDatumCache.shelf !== shelf) {
      const WT = window.DraftWallTypes;
      const thicknessFt = wall => {
        const def = WT && WT.WALL_TYPES.find(type => type.id === wall.wallType);
        return def ? def.totalIn / 12 : 0;
      };
      const walls = shelf == null ? (drawing?.walls || [])
        : (drawing?.walls || []).filter(w => w && Number(w.levelId) === shelf)
          .map(w => ({ ...w, levelId: 3 }));
      siteDatumCache = {
        epoch: modelEpoch,
        shelf,
        point: window.DraftCutMarks && window.DraftCutMarks.siteDatum
          ? window.DraftCutMarks.siteDatum(walls, { turn: drawing?.planTurn || 0, thicknessFt })
          : null,
      };
    }
    return siteDatumCache.point;
  };
  const gridDatum = () => {
    if (!drawing) return null;
    const site = siteDatumNow();
    if (site) return site;
    if (!('drawingOrigin' in drawing)) return { x: 0, z: 0 };
    const raw = drawing.drawingOrigin;
    if (!raw || typeof raw !== 'object') return null;
    const x = Number(raw.x), z = Number(raw.z);
    return Number.isFinite(x) && Number.isFinite(z) ? { x, z } : null;
  };

  const paintGrid = () => {
    const R = window.DraftRender2D;
    if (!R) {
      throw new Error('MODEL.html: cannot paint the grid, render-2d.js did not '
        + 'load. Check the script order in the page head.');
    }
    // drawGrid2D builds its own screen transform instead of taking toS, so it
    // wants the camera in WORLD units. halfH is half the viewport height in
    // FEET: cssH/2 pixels divided by px-per-foot. Getting this wrong scales
    // the grid against everything else rather than hiding it, which is at
    // least loud.
    R.drawGrid2D(ctx, cssW, cssH, {
      datum: gridDatum(),
      halfH: cssH / 2 / view.scale,
      camX: view.cx,
      camZ: view.cz,
      // Three weights, not two: 1ft fine, 10ft major, 100ft coarse. The page
      // owns the look, as MODEL.dc.html:6559 does with its own greys.
      gridFine: skin['draw-grid-minor'],
      gridMajor: skin['draw-grid-major'],
      gridCoarse: skin['draw-grid-coarse'],
    });
  };

  // drawFloor2D's env, which is paintEnv() plus four keys only it reads.
  // Kept separate rather than folded into paintEnv() because of `colors`:
  // the name looks page-wide, but a grep of render-2d.js shows env.colors is
  // read at 848-886 and nowhere else -- i.e. by this painter only. Parking a
  // floor-specific five-colour set under a generic name in the shared env is
  // how the next person ends up wondering why changing it moves nothing.
  //
  // All seven keys are supplied, including the three the garage branch needs.
  // The default house has no garage slab, so that branch never runs HERE --
  // but old drawings must keep opening, and a garage slab with an undefined
  // taper offsets its dashed ring by NaN and silently draws nothing. Missing
  // env keys are the tier-2b lesson: an interface satisfied for the fixture
  // is not an interface satisfied.
  const floorEnv = () => {
    const S = window.DraftCutView.STANDARDS;
    return {
      ...paintEnv(),
      formatInchesOnly: window.DraftFormatters.formatInchesOnly,
      garageSlabThicknessIn: S.GARAGE_SLAB_THICKNESS_IN,
      garageEdgeDepthIn: S.GARAGE_EDGE_DEPTH_IN,
      // Derived exactly as MODEL.dc.html:1997 derives it -- at 45 degrees the
      // taper runs (edge - field) inches in plan. STANDARDS exports the two
      // depths but not this difference, so both pages compute it.
      garageEdgeTaperRunIn: S.GARAGE_EDGE_DEPTH_IN - S.GARAGE_SLAB_THICKNESS_IN,
      // drawFloor2D's own five-colour set. The preview pair was written
      // against the day this page grew a floor gesture, on the grounds that a
      // preview reading as committed is visible and diagnosable while an
      // absent colour throws. THAT DAY IS THIS ONE, and the pair is left
      // pointing at the committed look ON PURPOSE rather than by inheritance:
      // a floor being traced is the floor it is about to be, and the painter
      // already separates the two states by DASHING the preview edge and
      // withholding the corner handles. A second colour would be a second
      // thing to keep in step with the palette for no fact gained.
      //
      // `selected` is still the placeholder it was: this page's selection is
      // wall-only, so that entry has no way to be reached yet.
      colors: {
        fill: skin['draw-floor'],
        fillPreview: skin['draw-floor'],
        stroke: skin['draw-floor-edge'],
        strokePreview: skin['draw-floor-edge'],
        selected: skin['accent'],
      },
    };
  };

  const paintFloors = () => {
    // Lazy and loud, like paintWalls. cut-view.js and formatters.js are new
    // to this page and they carry the load-order trap named in the head.
    const R = window.DraftRender2D;
    const CV = window.DraftCutView;
    const F = window.DraftFormatters;
    const missing = [!R && 'render-2d.js', !CV && 'cut-view.js', !F && 'formatters.js']
      .filter(Boolean);
    if (missing.length) {
      throw new Error(`MODEL.html: cannot paint floors, ${missing.join(' and ')} `
        + 'did not load. Check the script order in the page head.');
    }
    const env = floorEnv();
    floors().forEach(floor => {
      // drawFloor2D returns early under 2 points itself; this only skips the
      // degenerate ones the hand-rolled wash used to skip, so the count in
      // the readout keeps meaning the same thing.
      if ((floor.points || []).length < 2) return;
      R.drawFloor2D(ctx, toS, floor, {}, env);
    });
  };

  const paintLines = () => {
    ctx.save();
    // A CURVED LINE IS DRAWN CURVED. Every line here was a straight stroke
    // from end to end, so a `bulge` -- a DXF's arcs brought in EDITABLE, or
    // the old page's arcs -- drew as its chord. render-2d's segment path
    // owns the curve, through geometry-2d's control point, the same maths
    // the hit test reads.
    const R = window.DraftRender2D, G = window.DraftGeometry2D, LS = window.DraftLineStyles;
    lines().forEach(line => {
      if (!line.start || !line.end) return;
      // ITS OWN WEIGHT, COLOUR AND STYLE (Movie, 19 Oct), off line-styles.js;
      // a line with none set is FINE, solid, in the skin's line ink -- what
      // every line drew before today.
      const ink = LS ? LS.strokeFor(line) : { lineWidth: 1, dash: [], color: null };
      ctx.strokeStyle = ink.color || skin['draw-line'];
      ctx.lineWidth = ink.lineWidth;
      ctx.setLineDash(ink.dash);
      if (line.bulge) {
        R.strokeSegPath2D(ctx, toS, line, { controlPoint: G.lineControlPoint });
        return;
      }
      const a = toS(line.start), b = toS(line.end);
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    });
    ctx.restore();
  };

  // EVERYTHING A PAINTER READS ARRIVES THROUGH env. That is what lets
  // render-2d.js serve this page and MODEL.dc.html from one copy: the module
  // owns the drawing, not the state of whoever is calling. Built at call time
  // from `skin` and the saved JSON, never captured at module scope.
  //
  // The contract is NINE keys, not the two that make a roof appear. It was
  // found by reading every `env.` in render-2d.js at once, after supplying two
  // and watching the page throw `env.roofSkeleton is not a function` -- which
  // is exactly what the loud painter was for. Discovering an interface one
  // exception at a time is how you end up believing you have finished.
  //
  //   drawWallSeg2D  wallTypes
  //   drawRoof2D     isPrinting offsetOutline offsetOutlineVariable roofSkeleton
  //                  roofWelds surfaceOpeningsFor
  //                  colors.roof colors.roofGuide
  //   drawShape2D    isPrinting areaLabel outlineAreaSqFt flooringTypes
  //                  shapeColor
  const paintEnv = () => ({
    wallTypes: window.DraftWallTypes.WALL_TYPES,
    shapeColor: skin['draw-shape'],
    // STRUCTURE'S TWO COLOURS AND THE LABEL FONT. The painters take these from
    // env rather than holding literals, because the old page's values are known
    // failures on this page's night ground: its beam brown is 2.23 and its
    // column ink is 1.00 -- the same colour as surface-page, which is how notes
    // and fixtures once vanished entirely. palette.js carries both new roles
    // with the numbers.
    //
    // labelFont is stated rather than inherited. Two painters in render-2d.js
    // already read env.labelFont and this page never supplied it, so their
    // labels drew in whatever font the canvas last had -- assigning undefined
    // to ctx.font is ignored silently, which is a default nobody chose.
    beamColor: skin['draw-beam'],
    columnColor: skin['draw-column'],
    // THE HOLE WEARS THE STAIR'S COLOUR, because that is what cut it. On
    // FOUNDATION there is no stair drawn to connect it to, so the ink is the
    // only thing saying what the dashed rectangle overhead is -- and a
    // structural grey there would read as one more piece of concrete.
    openingAboveColor: skin['draw-stair'],
    labelFont: "600 9px 'Barlow Condensed', system-ui, sans-serif",
    // THE ROOF READS THE SKIN, and that is the whole point of the pair.
    // drawRoof2D used one brown for both skins -- #7a4a21, which is 6.64 on
    // the day page and 2.23 on the night one, under the 3.0 non-text floor.
    // It also left the dashed guides at 3.90, LOUDER than the footprint they
    // belong to, which inverts the reading day always had. The old page has
    // no night skin at all, so it keeps the literals through the painter's
    // fallbacks and is untouched; this page is the one that has two grounds.
    //
    // The fill wash and the GABLE / EAVE tags are DERIVED from colors.roof
    // inside the painter rather than passed, so they cannot drift apart from
    // the outline. Only the two roles cross this boundary.
    colors: {
      roof: skin['draw-roof'],
      roofGuide: skin['draw-roof-guide'],
    },
    flooringTypes: window.DraftDrawingFormat.FLOORING_TYPES,
    // This page never prints. When it does, this stops being a constant.
    isPrinting: false,
    offsetOutline: window.DraftGeometry2D.offsetOutline,
    offsetOutlineVariable: window.DraftGeometry2D.offsetOutlineVariable,
    roofSkeleton: window.DraftGeometry2D.roofSkeleton,
    crossGableLines: window.DraftGeometry2D.crossGableLines,
    cutRoofSegment: window.DraftGeometry2D.cutRoofSegment,
    // TWO SHEETS IN ONE PLANE SHOW NO LINE BETWEEN THEM -- the plan's half of
    // what cut-view's `carriedOn` answers on the elevations. Handed the whole
    // roof list because a weld is a fact about a PAIR, and `roofs()` is what
    // this page draws.
    roofWelds: roof => window.DraftGeometry2D.roofWeldSpans(roof, roofs()),
    // AND WHAT RUNS UNDER A HIGHER ROOF IS DOTTED (Movie, 16 Oct: "show it
    // as dotted line (under the upper roof overhang)").
    roofHidden: roof => window.DraftGeometry2D.roofHiddenSpans(roof, roofs()),
    // MODEL.dc.html also consults layer visibility and print flags here; this
    // page has neither yet, so an opening is shown whenever it is real.
    surfaceOpeningsFor: (hostType, hostId) => (drawing?.surfaceOpenings || [])
      .filter(o => o.hostType === hostType && o.hostId === hostId
        && (o.points || []).length >= 3),
    // DUPLICATED FROM MODEL.dc.html, deliberately and temporarily. Both are
    // pure -- a shoelace area and a unit label -- and both are needed by a
    // painter that has ALREADY been extracted, which makes them extraction
    // candidates rather than page code. Flagged to whoever holds board #1;
    // when they move, this env reads them instead of restating them.
    outlineAreaSqFt: points => {
      if (!Array.isArray(points) || points.length < 3) return 0;
      let doubled = 0;
      for (let i = 0; i < points.length; i += 1) {
        const a = points[i], b = points[(i + 1) % points.length];
        doubled += a.x * b.z - b.x * a.z;
      }
      return Math.abs(doubled) / 2;
    },
    areaLabel: sqFt => (sqFt > 0
      ? `${(Math.round(sqFt * 10) / 10).toLocaleString()} SQ FT` : ''),
  });

  const paintRoofs = () => {
    const R = window.DraftRender2D;
    const G = window.DraftGeometry2D;
    // ON THE ROOF PLAN, what each roof stands on (Movie, 5 Oct): the tops of
    // the exterior walls it bears on, and the main roof stopped at the outside
    // face of the storey whose own roof stands over it. geometry-2d decides
    // which walls; render-2d draws them.
    const bearing = new Map((G.roofBearing && drawing
      ? G.roofBearing({ roofs: roofs(), walls: drawing.walls || [],
        outlines: drawing.outlines || [], levels: drawing.levels || [] })
      : []).map(b => [b.roof, b]));
    roofs().forEach(roof => {
      if ((roof.points || []).length < 3) return;
      const b = bearing.get(roof);
      R.drawRoof2D(ctx, toS, roof, b && b.exclude.length ? { exclude: b.exclude } : {}, paintEnv());
    });
    const thicknessFt = openingThicknessFt();
    // EVERY wall top a roof rests on -- entry and garage too -- once each,
    // not roof by roof (geometry-2d roofPlanWalls).
    // ROOF PLAN ONLY: roofs() is empty on any other level, and the tops of
    // walls drawn there read as walls (a room over the garage showed up as a
    // wall through the garage on MAIN FL).
    const tops = G.roofPlanWalls && drawing && roofs().length ? G.roofPlanWalls({ walls: drawing.walls || [],
      outlines: drawing.outlines || [], floors: drawing.floors || [], levels: drawing.levels || [] }) : [];
    if (R.drawWallTops2D) {
      R.drawWallTops2D(ctx, toS, tops, {
        thicknessFt, color: skin['draw-wall-edge'] || skin['draw-line'],
      }, { wallFaceOffsets: G.wallFaceOffsets });
    }
  };

  // STRUCTURE THE DRAFTER NEVER DREW. BUILD HOUSE lands a mid-span beam and
  // its teleposts whenever a clear span passes 19', so every built house in the
  // store already holds beams and columns -- which this page kept faithfully
  // through every save and did not draw. A drafter could not see the structure
  // holding their floor up.
  // THE BEAMS BESIDE A BAY PAST THE TABLE (Movie, 19 Oct: "the beams and
  // joists will be marked BEAM / JOIST SPAN REQUIRES ENGINEERING"): for each
  // level that frames an OWJ floor, the bays its beams leave, and the beams
  // that bound one past 31 ft. Read every paint, never stored.
  const beamsPastTheTable = () => {
    const B = window.DraftBuildHouse, LA = window.DraftLevelAssembly;
    const out = new Set();
    if (!drawing || !B?.overSpanBays || !LA) return out;
    const byLevel = new Map();
    (drawing.beams || []).forEach(b => {
      if (!b.start || !b.end) return;
      const id = Number(b.levelId);
      if (!byLevel.has(id)) byLevel.set(id, []);
      byLevel.get(id).push(b);
    });
    byLevel.forEach((list, framingId) => {
      storeyBodiesOver(framingId).forEach(({ outline, storeyId }) => {
        const asm = LA.levelAssemblyFor(drawing.levelAssemblies, storeyId);
        const bays = B.overSpanBays(B.joistBays(outline.points.map(p => ({ x: p.x, z: p.z })), { beams: list }), asm);
        (bays?.bays || []).filter(bay => bay.warn).forEach(bay => {
          const along = bays.axis === 'x' ? 'x' : 'z';
          list.forEach(b => {
            const fixed = (b.start[along] + b.end[along]) / 2;
            const runs = Math.abs(b.end[along] - b.start[along]) < 0.01;
            if (runs && (Math.abs(fixed - bay.from) < 0.01 || Math.abs(fixed - bay.to) < 0.01)) out.add(b);
          });
        });
      });
    });
    return out;
  };
  const paintStructure = () => {
    const R = window.DraftRender2D;
    const env = paintEnv();
    const B = window.DraftBuildHouse;
    const F = window.DraftFormatters;
    // THE TAG OPPOSITE THE STRING, one per beam line (render-2d
    // beamTagSides): read off this level and view's own column rows.
    const tags = R.beamTagSides(beams(), dimensions());
    const marked = beamsPastTheTable();
    beams().forEach(beam => R.drawBeam2D(ctx, toS, beam,
      { tag: tags.get(beam.id), warn: marked.has(beam) ? B?.ENGINEERING_MARK : null }, env));
    // ── THE PADS GO DOWN FIRST, UNDER EVERYTHING THEY CARRY ─────────────────
    //
    // Movie, 25 Sep: "we have beam and columns, but no footing, we will need
    // footings below the columns ... i think it had them already
    // 36"x36"x8"dp". It did -- MODEL.dc.html:8403 -- and the table it read
    // never came across, so this page had no size to draw and drew nothing.
    //
    // ON FOUNDATION ONLY, which is dc's rule and an architectural one: a pad
    // is concrete in the ground, and the plan it belongs on is the one about
    // the ground. Drawn on a floor plan it would read as something in the
    // room.
    //
    // FIRST, so a telepost's cross sits ON its pad rather than under it. The
    // painter draws in call order and these overlap by construction.
    if (activeViewId() === 'foundation' && B) {
      B.padGroups(columns()).forEach(group => R.drawPadGroup2D(ctx, toS, group, {
        // ONE PAD KEEPS ITS TYPE, several pour as a measured rectangle -- dc's
        // wording, because "TYP 36x36" is a schedule reference and a combined
        // pour has no row to refer to.
        label: group.columns.length === 1
          ? B.footingFor(group.columns[0].footing).label
          : `COMBINED ${F.formatInchesOnly((group.maxX - group.minX) * 12)}`
            + `×${F.formatInchesOnly((group.maxZ - group.minZ) * 12)} PAD`,
      }, env));
    }
    // THE FOOTING IS THE PAGE'S ANSWER, not the painter's -- but the page had
    // no table to answer from, so it invented `sizeIn: 6` for every pile and
    // handed the LABEL the raw id. A 12" pile and an 8" pile drew as the same
    // circle marked "pile12". build-house.js owns the table now.
    // AND WHICH PILE IT IS, by what stands over it. Movie, 15 Oct: "anything
    // under 'HOUSE' type outline for any storey will need P3, and thing under
    // GARAGE will need P2, and the ext piles for roof and deck P1". The rule
    // is build-house.js's; the bodies are this page's -- every building
    // outline on the drawing, on any storey, with the LOT LINE left out
    // because a lot is not a building (`site`, the flag auto-dims and areas
    // already filter on for the same reason).
    const pileBodies = (drawing?.outlines || [])
      .filter(outline => outline.site !== true && (outline.points || []).length >= 3)
      .map(outline => ({ points: outline.points, garage: outline.garage === true }));
    columns().forEach(column => R.drawColumn2D(ctx, toS, column, {
      footing: B ? B.footingFor(column.footing) : null,
      mark: B ? B.pileMark(column.point, pileBodies) : null,
    }, env));
    // ── AND THE POSTS STANDING ON PILES OUT IN THE OPEN ─────────────────
    //
    // Movie, 4 Oct: "when piles are generated also add a column to the
    // bottom of whatever is being supported". cut-view.js pilePosts says
    // which piles carry one and how high; a post is on the WALLS plan of
    // every storey it passes through -- a roof's post on the main floor
    // under a porch roof, and on the second floor too when it climbs to a
    // roof up there. A post that only reaches the main floor's underside
    // stands in no storey and is on no floor plan.
    if (activeViewId() === 'plan' && Number(activeLevelId()) !== 1
      && (drawing?.columns || []).some(c => c.view === 'foundation' && c.auto !== true
        && String(c.footing || '').startsWith('pile'))) {
      const CV = window.DraftCutView;
      const cEnv = CV && cutEnv();
      const stack = cEnv && CV.sectionLevelStack(cEnv);
      const level = stack && stack.floors.find(l => Number(l.id) === Number(activeLevelId()));
      if (level) {
        CV.pilePosts(cEnv, stack)
          .filter(post => post.top > level.floorTop + 0.01 && post.foot < level.wallTop - 0.01)
          .forEach(post => R.drawColumn2D(ctx, toS, { point: post.point },
            { sizeIn: post.sizeIn }, env));
      }
    }
  };

  // ── AND WHAT IS HOLDING THIS FLOOR UP ──────────────────────────────────────
  //
  // Movie, 13 Oct: "the main floor support beam should show on the MAIN FLOOR
  // (layout) and the foundation plan".
  //
  // The beam is filed on the level that FRAMES this floor, which is where it
  // physically is -- a basement beam is in the basement -- and that plan
  // draws it as its own. This is the other sheet he asked for: the floor
  // layout showing the beam under it, drawn faint and labelled BELOW because
  // it belongs to the plan underneath.
  //
  // ONE RECORD, TWO SHEETS. Filing a second beam against this level would put
  // the same beam in the file twice and leave an edit to one of them to drift
  // from the other -- which is the trade the E-SAVE note calls out about a
  // second copy of anything.
  //
  // THE FLOOR LAYOUT ONLY, which is the sheet he named and the one S-BEAM is
  // a layer on. The WALLS plan of the same level is about what stands on this
  // floor, not what is under it.
  //
  // CONTEXT, NOT CONTENT: it is not in `beams()`, so nothing here can be
  // picked, selected, moved or counted on this sheet -- the same rule the
  // openings above follow, and for the same reason.
  // THE JOIST CALLOUT IN EVERY BAY OF THIS FLOOR'S DECK (Movie, 16 Oct):
  // the bays between the beams that hold it up (paintBeamsBelow's, the
  // storey under's), the arrow standing clear of the stairwell, the short
  // form off this storey's schedule (level-assembly: PROJECT's own row, and
  // the depth AUTO BEAM wrote there for a room over a garage). A bare deck
  // over a garage runs with the door wall (build-house deckJoistAxis).
  const paintJoistCallouts = (belowBeams, env) => {
    const R = window.DraftRender2D;
    const B = window.DraftBuildHouse;
    const LA = window.DraftLevelAssembly;
    if (!B || !R.drawJoistSpans2D || !LA) return;
    const levelId = Number(activeLevelId());
    const holes = (drawing?.surfaceOpenings || []).filter(opening =>
      Number(opening.levelId) === levelId && opening.hostType === 'floor'
      && (opening.points || []).length >= 3);
    const ladder = window.DraftLayerViews.floorLevels(drawing?.levels || []).map(level => Number(level.id));
    const at = ladder.indexOf(levelId);
    const under = new Set(at < 0 ? [] : ladder.slice(0, at));
    const garages = (drawing?.outlines || []).filter(outline => outline.garage === true
      && under.has(Number(outline.levelId)) && (outline.points || []).length >= 3);
    const wallById = new Map((drawing?.walls || []).map(wall => [String(wall.id), wall]));
    const doorPoints = (drawing?.fenestrations || []).filter(fen => fen.garage === true)
      .map(fen => wallById.get(String(fen.wallId))).filter(Boolean)
      .map(wall => ({ x: (wall.start.x + wall.end.x) / 2, z: (wall.start.z + wall.end.z) / 2 }));
    const asm = LA.levelAssemblyFor(drawing?.levelAssemblies, levelId);
    const label = B.joistCallout(asm);
    // THE BODIES AUTO BEAM FRAMES: this level's outlines, the garage's own
    // aside (layout-plan joistCalloutsFor reads the same), the floors only
    // where a level has no outline.
    const bodies = (drawing?.outlines || []).filter(outline => Number(outline.levelId) === levelId
      && outline.garage !== true && outline.site !== true && (outline.points || []).length >= 3);
    const decks = bodies.length ? bodies
      : floors().filter(floor => floor.garage !== true && (floor.points || []).length >= 3);
    decks.forEach(floor => {
      const points = floor.points.map(pt => ({ x: pt.x, z: pt.z }));
      const bays = B.joistBays(points, {
        beams: belowBeams, holes,
        axis: B.deckJoistAxis(points, { garages, doorPoints }),
      });
      if (bays) R.drawJoistSpans2D(ctx, toS, B.overSpanBays({ ...bays, label }, asm), {}, env);
    });
  };

  // THE BEAM IN THE FLOOR SYSTEM OVER THIS PLAN (Movie, 16 Oct, MAIN FL PLAN
  // sheet 7): "anything above the cut is drawn lighter weight with a dash-dot
  // line -- the beam in the floor system above (or dropped) on the floor it
  // is over (columns already shown)". The beams this level carries are filed
  // on it under its floor view (placeAutoBeam: FOUNDATION's on 'foundation',
  // a storey's on 'floor'), so the plan view borrows that view's rows and
  // hands them to the painter as `above` -- dash-dot, lighter, tagged ABOVE.
  // A floor shows only what sits DIRECTLY over it, which these are: the
  // level above's deck is what this level's beam holds up.
  const paintBeamsAbove = () => {
    const R = window.DraftRender2D;
    const onPlanView = activeViewId() === 'plan';
    const levelId = Number(activeLevelId());
    const floorView = levelId === FOUNDATION_LEVEL_ID ? 'foundation' : 'floor';
    const mine = item => Number(item.levelId) === levelId && item.view === floorView;
    const aboveBeams = onPlanView ? (drawing?.beams || []).filter(mine) : [];
    canvas.setAttribute('data-beams-above', String(aboveBeams.length));
    if (!aboveBeams.length) return;
    const env = paintEnv();
    const tags = R.beamTagSides(aboveBeams, (drawing?.dimensions || []).filter(mine));
    aboveBeams.forEach(beam => R.drawBeam2D(ctx, toS, beam, { above: true, tag: tags.get(beam.id) }, env));
    // AND THE POSTS UNDER IT, at full weight: they stand on this floor and
    // are cut by the plan, the same rows the LAYOUT walls plan borrows
    // (layout-plan planPosts). Not the piles, which are the garage's.
    const B = window.DraftBuildHouse;
    (drawing?.columns || []).filter(column => mine(column)
      && !String(column.footing || '').startsWith('pile'))
      .forEach(column => R.drawColumn2D(ctx, toS, column,
        { footing: B ? B.footingFor(column.footing) : null }, env));
  };

  // THE CANTILEVER OF THE FLOOR ABOVE AND THE ROOF OVERHANG, dashed and
  // lighter on the walls plan (Movie, 16 Oct: "a floor shows only what sits
  // DIRECTLY over it ... nothing two storeys up"). overhead-lines.js clips
  // the storey above's outline and this storey's roofs to what lies outside
  // this level's own outlines; the ladder it reads is the full storeys low
  // to high, a bilevel's half levels left out so ENTRY is not told MAIN
  // hangs over it.
  const paintOverheadLines = () => {
    const R = window.DraftRender2D;
    const O = window.DraftOverheadLines;
    const LA = window.DraftLevelAssembly;
    const onWallsPlan = activeViewId() === 'plan';
    const lines = onWallsPlan && O && R.drawOverheadLines2D ? O.overheadLines({
      levelId: activeLevelId(),
      ladder: window.DraftLayerViews.floorLevels(drawing?.levels || []).map(level => Number(level.id))
        .filter(id => !LA || !LA.STOREY_NUMBER || !(id in LA.STOREY_NUMBER)
          || Number.isInteger(Number(LA.STOREY_NUMBER[id]))),
      outlines: drawing?.outlines || [],
      roofs: drawing?.roofs || [],
    }) : { cantilevers: [], overhangs: [] };
    const segments = [...lines.cantilevers, ...lines.overhangs];
    canvas.setAttribute('data-overhead-lines', String(segments.length));
    if (!segments.length) return;
    R.drawOverheadLines2D(ctx, toS, segments, { ink: skin['draw-wall-edge'] || skin['draw-line'] });
  };

  const paintBeamsBelow = () => {
    const R = window.DraftRender2D;
    const B = window.DraftBuildHouse;
    if (activeViewId() !== 'floor') return;
    const from = framesFrom(activeLevelId());
    const framed = from != null && Number(from) !== Number(activeLevelId());
    const view = Number(from) === FOUNDATION_LEVEL_ID ? 'foundation' : 'floor';
    const env = paintEnv();
    const mine = item => framed && Number(item.levelId) === Number(from) && item.view === view;
    const belowBeams = (drawing?.beams || []).filter(mine);
    const tags = R.beamTagSides(belowBeams, (drawing?.dimensions || []).filter(mine));
    belowBeams.forEach(beam => R.drawBeam2D(ctx, toS, beam, { below: true, tag: tags.get(beam.id) }, env));
    paintJoistCallouts(belowBeams, env);
    if (!framed) return;
    // The posts with it, and NOT the piles: a pile is concrete in the ground
    // under a garage slab, which is not what this floor stands on.
    (drawing?.columns || []).filter(column => mine(column)
      && !String(column.footing || '').startsWith('pile'))
      .forEach(column => R.drawColumn2D(ctx, toS, column, {
        below: true, footing: B ? B.footingFor(column.footing) : null,
        // `below` FIRST, and not for style: pad-footing-mutants anchors on
        // the footing line as the structure pass writes it, and that string
        // sits inside this one when the keys are the other way round. Two
        // matches and the mutation lands on whichever comes first.
      }, env));
  };

  // ── WHAT IS OPEN IN THE FLOOR ABOVE ────────────────────────────────────────
  //
  // Movie, 25 Sep: "the stair, also on the foundation plan (on on floor plans
  // where the floor has an opening above uses a line with short dashes and
  // gaps with a med-lightweight pen draw where the openings in the floor ABOVE
  // are located".
  //
  // THE FLOOR ABOVE IS THE ONE THIS LEVEL CARRIES, which is floorCarriedBy --
  // the same lookup the beam rule takes, and for the same reason. FOUNDATION
  // carries the lowest storey, a storey carries the next one up, and the top
  // storey carries a roof and so has nothing overhead to show.
  //
  // IT IS THE OPENINGS THAT ARE DRAWN, not the stairs. A stair is a thing on
  // its own level; the HOLE is what this level needs to know about, because it
  // is what the beam under it has to miss and what a drafter standing here
  // would see daylight through.
  const paintOpeningsAbove = () => {
    const R = window.DraftRender2D;
    const carried = floorCarriedBy(activeLevelId());
    if (!carried) return;
    const env = paintEnv();
    (drawing?.surfaceOpenings || [])
      .filter(opening => Number(opening.levelId) === Number(carried.id)
        && opening.hostType === 'floor' && (opening.points || []).length >= 3)
      .forEach(opening => R.drawOpeningAbove2D(ctx, toS, opening.points, {}, env));
  };

  const paintShapes = () => {
    const R = window.DraftRender2D;
    shapes().forEach(shape => {
      if ((shape.points || []).length < 2) return;
      R.drawShape2D(ctx, toS, shape, {}, paintEnv());
    });
  };

  // OUTLINES. The painter has been in render-2d.js since the extraction; what
  // kept it unreachable was three env keys resolving to `this._` methods on the
  // old page. They now live in geometry-2d.js and this page reads them from
  // there -- which is the whole difference between a painter that moved and a
  // painter that is shared.
  //
  // THE LIVE-EDITING KEYS WERE PASSED EXPLICITLY AS FALSE AND EMPTY while this
  // page only read outlines, under the note that naming them meant "the day
  // this page grows an outline tool, the keys to fill are already listed and
  // the branches are already wired -- instead of a reader concluding the
  // painter has no preview and quietly building a second one". That day is
  // this one, and the note held: the part-drawn trace below is filled-in keys,
  // not a new preview. The FENESTRATION ghost's keys stay inert, because this
  // page still places no marks.
  //
  // FIVE OF THE SIX COLOURS are copied verbatim from MODEL.dc.html:8276. They
  // are hardcoded in BOTH pages, which is one literal set too many -- flagged
  // for whoever takes the palette work, not fixed here, because moving a colour
  // into palette.js is a decision about the drawing rather than about this
  // lift. The sixth, the house TRACE, is no longer a literal on this page: it
  // is the armed build family's colour, and the block below says why.
  const paintOutlines = () => {
    const R = window.DraftRender2D;
    const G = window.DraftGeometry2D;
    R.drawOutlines2D(ctx, toS, {
      isPrinting: false,
      // THIS READ `boneyardActive: false` under "No boneyard on this page: it
      // holds no unplaced geometry and offers no way to switch to it". Both
      // halves were true when written and neither is now: the card selects,
      // shelves hold geometry, and the masters ARE what a shelf draws.
      //
      // The flag picks the colours, so leaving it false painted a master in
      // LEVEL ink while the drafter was standing on a shelf -- the page
      // telling him he was somewhere he was not.
      //
      // showingBoneyard() rather than boneyardActive, for the precedence a
      // thumbnail needs: a seat is always about its own level.
      boneyardActive: showingBoneyard(),
      outlines: outlines(),
      boneyardOutlines: [],
      // Handles belong to the outline and select tools. This page has neither.
      showHandles: false,
      // Nothing is selectable yet, so nothing is selected. Returning false is
      // the honest answer; omitting the key would throw.
      isSelected: () => false,
      segmentCount: G.outlineSegmentCount,
      segment: G.outlineSegment,
      controlPoint: G.lineControlPoint,
      // Boneyard marks only. Unreachable with boneyardActive false, and present
      // so the reader can see the branch exists rather than infer it is gone.
      geometryFor: () => null,
      markPlacement: () => null,
      // LIVE INTERACTION STATE, AND IT IS LIVE NOW. These keys were passed
      // false and empty against the day this page grew an outline tool, with
      // the note that then "the keys to fill are already listed and the
      // branches are already wired". That day is this one: the trace the
      // drafter is part-way through paints through the SAME painter the old
      // page traces with, rather than a second preview drawn here.
      activeTool,
      fenestrationType: null,
      // Garage runs are not on this page yet -- this rung draws the house
      // loop -- so the painter's two garage branches stay unreachable and the
      // trace takes the house colour below.
      outlineGarage: null,
      // THE RUBBER BAND'S FAR END, and it is only supplied while a trace is
      // actually part-drawn. cursorWorld survives a finger lifting and a tool
      // changing; handing it over with no corners placed would band from
      // nothing, and handing it over after the loop commits would band from a
      // trace that is gone.
      // Through outlinePoint, so the band shows the corner the press will put
      // down -- square and on the foot -- not the raw cursor.
      snapPt: activeTool === 'outline' && outlineCorners.length && cursorWorld
        ? outlinePoint(cursorWorld) : null,
      outlineDrawing: activeTool === 'outline' && outlineCorners.length > 0,
      outlinePoints: outlineCorners,
      // The close target. The painter rings it once three corners are down,
      // which is the same press count outlinePress will accept as a close --
      // the ring is the page saying where the loop can be finished, so it has
      // to appear on the press that makes finishing possible and not before.
      outlineStart: outlineCorners[0] || null,
      frozenEnd: null,
      colors: {
        boneyard: skin['draw-trace-boneyard'],
        level: skin['draw-trace-level'],
        garageBoneyard: skin['draw-trace-garage-boneyard'],
        garageLevel: skin['draw-trace-garage-level'],
        // THE HOUSE TRACE COLOUR IS A QUESTION ON THIS PAGE, not a constant.
        // The painter asks what colour a house trace is; here the answer is
        // the colour of the build-bar family that armed it, which is the
        // order's rule 4. Reading the family HERE rather than teaching the
        // shared painter about families keeps build families out of a module
        // that draws for both pages -- the old page has no per-family trace
        // colour and is not being given one by this rung.
        traceHouse: outlineTraceColor(),
        traceAttached: skin['draw-trace-attached'],
        // THE LOT IS NOT A TRACE, and since 14 Oct it does not look like one:
        // it is the property line, and the painter draws it heavy, dash-dot
        // and in the sheet's own ink. Its own key so the lot can be edited
        // like any other outline and still read as a boundary.
        siteLine: skin['draw-site-line'],
      },
    });
  };

  // drawWallSeg2D's two colours, plus the two preview entries it also reads.
  // Same split floorEnv and dimensionEnv use: this page's wall gesture commits
  // on the second tap and paints no ghost between them, so `preview` is the
  // constant false at the call below and both preview branches are
  // unreachable -- but they are DEFINED, because a caller should answer the
  // whole interface, and because wiring a rubber-band preview up later must
  // not be the moment someone discovers the key was missing.
  //
  // Preview takes the committed look rather than the accent here, unlike the
  // dimension placeholders. A preview wall is the same wall a moment earlier,
  // so committed-looking is the honest placeholder; loud would be wrong.
  const wallEnv = () => ({
    ...paintEnv(),
    colors: {
      wall: skin['draw-wall'],
      wallPreview: skin['draw-wall'],
      wallEdge: skin['draw-wall-edge'],
      wallEdgePreview: skin['draw-wall-edge'],
    },
  });

  // The partner level's walls, openings and stairs, at half strength and under
  // this level's own -- only when the partner has anything on this drawing
  // of it, so a bungalow (no 0.5 or 1.5 floor) draws exactly as before.
  const HALF_LEVEL_GHOST_ALPHA = 0.5;
  // THE BG LAYERS, faded, under everything this layer draws.
  const paintBackgrounds = () => {
    bgEntries().forEach(entry => withBg(entry, () => {
      ctx.save();
      ctx.globalAlpha = BG_ALPHA;
      paintFloors(); paintRoofs(); paintLines(); paintWalls(); paintStairs();
      ctx.restore();
    }));
  };
  const paintHalfLevelGhost = () => {
    const partner = halfLevelPartner(activeLevelId());
    if (partner == null || !drawing) return;
    if (!(drawing.levels || []).some(l => Number(l.id) === partner)) return;
    ghostLevelId = partner;
    try {
      if (!walls().length && !stairs().length) return;
      ctx.save();
      ctx.globalAlpha = HALF_LEVEL_GHOST_ALPHA;
      paintWalls();
      paintStairs();
      ctx.restore();
    } finally {
      ghostLevelId = null;
    }
  };
  // THE BASEMENT PLAN SHOWS THE FOUNDATION IT STANDS IN (Movie, 7 Oct): "on
  // the 'BASEMENT' plan ... can you show the FOUNDATION WALL (slightly
  // lighter and not editable) (don't show footings, but show where columns
  // are located on the basement plan too". The house's foundation walls and
  // its posts, off the FOUNDATION view, faded like a half-floor and drawn
  // under the basement's own walls. No pads and no piles: a pile is the
  // garage's, and both are footings.
  const paintBasementFoundationGhost = () => {
    if (!drawing || Number(activeLevelId()) !== FOUNDATION_LEVEL_ID || activeViewId() !== 'plan') return;
    const R = window.DraftRender2D;
    const B = window.DraftBuildHouse;
    ghostViewId = 'foundation';
    ghostKeep = item => item.body !== 'garage';
    try {
      const posts = columns().filter(c => !(B && B.footingFor(c.footing)?.pile));
      if (!walls().length && !posts.length) return;
      ctx.save();
      ctx.globalAlpha = HALF_LEVEL_GHOST_ALPHA;
      paintWalls();
      const env = paintEnv();
      posts.forEach(column => R.drawColumn2D(ctx, toS, column, {}, env));
      ctx.restore();
    } finally {
      ghostViewId = null;
      ghostKeep = null;
    }
  };
  // AND ON THE FLOOR LAYOUT, THE PAIR'S FLOOR AREA (Movie, 7 Oct): "we should
  // also show the 0.5 FLOOR in the 1 FLOOR" -- the partner's floor drawn
  // lighter, UNDER this level's own, so where the two overlap this floor's
  // shade is the one read and the half-floor shows only where it alone is.
  const paintHalfLevelGhostFloors = () => {
    const partner = halfLevelPartner(activeLevelId());
    if (partner == null || !drawing) return;
    if (!(drawing.levels || []).some(l => Number(l.id) === partner)) return;
    ghostLevelId = partner;
    try {
      if (!floors().length) return;
      ctx.save();
      ctx.globalAlpha = HALF_LEVEL_GHOST_ALPHA;
      paintFloors();
      ctx.restore();
    } finally {
      ghostLevelId = null;
    }
  };
