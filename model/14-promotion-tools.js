// MODEL.html's page script, part 14 of 17: TOO BIG, the promotion, typed lengths, the switches, the tool column, SELECTION / OBJECT TYPE, ASSEMBLY / UNGROUP.
//
// Stage 2 of the split (Movie, 24 Oct: "how can we reduce the MODEL.html
// size in a nice organized way"): the one script the page carried, cut
// at its own section headings and moved here verbatim, in order. The
// parts load one after another as classic scripts and share one scope,
// as they did inside the page; the indent is the page's, kept so every
// line reads as it did there.

  // ── TOO BIG: A POPUP AND A GLOW ──────────────────────────────────────
  //
  // Movie, 20 Oct, on why the French door would not go onto the 36" one:
  // "oh that's why it didn't fit too wide makes sens a popup warning good
  // idea" -- and "make it glow to be obvious". The strip still says it; the
  // card says it where he is looking, and paintTooBig rings what refused.
  // Not modal: the next press, OK, or Escape puts both away.
  const brushWarnBox = document.getElementById('brush-warn');
  const brushWarn = (text, target) => {
    sayOnStrip(text);
    brushWarned = target || null;
    if (brushWarnBox) {
      brushWarnBox.querySelector('[data-brush-warn-text]').textContent = text;
      brushWarnBox.hidden = false;
    }
    paint();
  };
  const brushWarnClear = () => {
    const had = brushWarned || (brushWarnBox && !brushWarnBox.hidden);
    brushWarned = null;
    if (brushWarnBox) brushWarnBox.hidden = true;
    if (had) paint();
  };
  brushWarnBox?.querySelector('[data-brush-warn-ok]')?.addEventListener('click', brushWarnClear);

  // ── TWO CURSORS: PICKING UP, AND PUTTING DOWN ────────────────────────
  //
  // Movie, 20 Oct: "can we have 2 different ICONS for cursor - one for when
  // it empty and GRABBING a property - and a second one that looks like it
  // DROPPING the properties". An eyedropper while the brush is empty, a brush
  // with a drip on it while it is loaded -- whether the brush chip is up or
  // FENESTRATION came up wearing the load. Drawn in the skin's own inks, so
  // the cursor reads on a night sheet and a day one; the hot spot is the
  // dropper's tip and the drip.
  const cursorSvg = (body, hotX, hotY, fallback) => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28">${body}</svg>`;
    return `url("data:image/svg+xml,${encodeURIComponent(svg)}") ${hotX} ${hotY}, ${fallback}`;
  };
  const brushCursorFor = loaded => {
    const ink = skin['accent'], edge = skin['surface-page'];
    const line = `stroke="${edge}" stroke-width="1.5" stroke-linejoin="round"`;
    return loaded
      // A BRUSH, BRISTLES DOWN-LEFT, A DROP FALLING OFF THEM.
      ? cursorSvg(`<g transform="translate(2 -4)"><path d="M24 2 L27 5 L15 17 L12 14 Z" fill="${ink}" ${line}/>`
        + `<path d="M12 14 L15 17 L11 22 Q7 25 4 23 Q6 20 7 17 Z" fill="${ink}" ${line}/></g>`
        + `<path d="M5 21 Q2 25 5 26.5 Q8 25 5 21 Z" fill="${ink}" ${line}/>`, 5, 26, 'copy')
      // AN EYEDROPPER, TIP DOWN-LEFT: a bulb, a collar, a glass tube.
      : cursorSvg(`<circle cx="22" cy="6" r="4.5" fill="${ink}" ${line}/>`
        + `<path d="M15 9 L19 13" stroke="${edge}" stroke-width="5" stroke-linecap="round"/>`
        + `<path d="M15 9 L19 13" stroke="${ink}" stroke-width="3" stroke-linecap="round"/>`
        + `<path d="M17 11 L4 24 L2 26 L4 24" fill="none" stroke="${edge}" stroke-width="4.5" stroke-linecap="round"/>`
        + `<path d="M17 11 L3 25" fill="none" stroke="${ink}" stroke-width="2.5" stroke-linecap="round"/>`, 2, 26, 'copy');
  };
  // WHICH ONE, IF EITHER. Asked after every tool change and every load: a
  // brush that is up and empty picks; a load in hand -- brush up, or
  // FENESTRATION armed with it -- puts down.
  const brushCursorNow = () => {
    if (brushOn && !brushLoad) return brushCursorFor(false);
    if (brushLoad && (brushOn || (activeTool === 'fenestration' && brushLoad.kind === 'fenestration'))) {
      return brushCursorFor(true);
    }
    return null;
  };
  const applyBrushCursor = () => {
    const c = brushCursorNow();
    if (c) canvas.style.cursor = c;
    else if (canvas.style.cursor.startsWith('url(')) canvas.style.cursor = drawsRun() || activeTool !== RESTING_TOOL ? 'crosshair' : '';
  };

  // THE LOAD GOES DOWN, THE TOOL STAYS UP -- which the chip alone cannot do,
  // and is why the spec gives Escape a step of its own. Called from the
  // canvas Escape branch, where every other half-taken gesture is put down.
  const brushDrop = () => {
    brushLoad = null;
    stripRefresh();
    sayOnStrip('Brush put down.');
  };

  brushChip.addEventListener('click', () => {
    brushOn = !brushOn;
    // A DRAFTER WHO SWITCHES THE BRUSH OFF AT THE CHIP IS DONE WITH IT, load
    // and all. Escape is the one that keeps the tool and drops the load; the
    // chip is the coarse one, exactly as the spec's three states describe.
    if (!brushOn) brushLoad = null;
    // THE ARMED TOOL GOES DOWN WITH THE BRUSH COMING UP, because the brush
    // takes the press whole: a WALL left armed under a brush would be a tool
    // the page says is on and that no press can reach.
    if (brushOn && activeTool !== RESTING_TOOL) setTool(RESTING_TOOL);
    canvas.style.cursor = brushOn ? 'copy' : (drawsRun() ? 'crosshair' : '');
    if (!brushOn) brushWarnClear();
    stripRefresh();
    paint();
  });

  // TYPING A LENGTH COMMITS THE WALL, which is the instrument's whole point:
  // a drafter who knows the wall is 12'-6" should not have to find 12'-6"
  // with a mouse. The DIRECTION is the one the cursor is already giving --
  // squared first if the T-square is down -- so the typed number replaces the
  // distance and nothing else.
  // ── the promotion, which used to be a question ──────────────────────────
  // §7 of the TOY bones order: "Entering an exact length anywhere promotes the
  // drawing to DRAFTING", and the drafter was ASKED before it happened --
  // Continue / Stay in TOY, once per drawing. That was right while DRAFTING
  // was somewhere a drafter CHOSE to go and TOY took sixteen tools away with
  // him. Movie settled it the other way on 15 Oct and the card is gone; see
  // promoteForNumber below for what replaced it and why the asking had to go
  // with it.
  // ── WHAT TOY ITSELF WOULD HAVE MADE ──────────────────────────────────────
  //
  // Movie, 27 Sep: *"allow the use while in 'TOY MODE' to enter a 'L' or 'R'
  // value - if it is to the nearest foot accept it and don't change to
  // DRAFTING MODE (i tried this and it made me switch because it considered
  // it a 'precise' length)"*, and again, plainly: *"allow a TOY MODE user to
  // stay in toy mode if they enter an exact foot length"*.
  //
  // THE GATE NEVER LOOKED AT THE VALUE. It asked whether the board was TOY and
  // whether the drafter had been asked before, and nothing whatever about what
  // had been typed -- so a flat 12 raised the same "this switches your drawing
  // to DRAFTING" question that 12'-6" does, and a drafter doing a thing TOY
  // does natively was told he was leaving TOY to do it.
  //
  // AND THIS IS NOT AN EXCEPTION TO TOY'S LAW, IT IS A BETTER READING OF IT.
  // The rule was written down as "entering an EXACT length promotes", and the
  // first gate read "exact" as "typed". TOY's own law is that everything lands
  // on the whole foot -- which is WHY the promotion exists. A typed 12 lands
  // there. That is not a precision TOY cannot hold; it is the only precision
  // TOY has. The note below still stands on its own terms: TOY keeps one law
  // with no exceptions, and this is the law rather than a hole in it.
  //
  // ASKED OF toy-constraints, NOT OF A MODULUS WRITTEN HERE. quantiseFeet is
  // the same function the drag arm rounds with, so "on the foot" means one
  // thing on this page and cannot quietly come to mean two.
  const toyCouldMakeLength = feet => {
    const Q = window.DraftToyConstraints;
    return !!Q && Math.abs(Q.quantiseFeet(feet) - feet) < 1e-9;
  };
  // AND THE SAME QUESTION ABOUT A BEARING, because TOY squares every run to an
  // axis: a typed 0 or 90 is a wall TOY would have drawn, and 37 is not. The
  // protractor reads -180..180, and every multiple of 90 in that range is an
  // axis, which is the whole of the test.
  const toyCouldMakeAngle = deg => Math.abs(deg % 90) < 1e-9;

  // ── THE PROMOTION IS AUTOMATIC NOW, AND IT IS NOT A QUESTION ────────────
  //
  // Movie, 15 Oct: "if they enter a ANGLE or length other than 1ft, it will
  // automatically place them in DRAFTING MODE. so it ill be basically a LIGHT
  // -- not a button".
  //
  // WHAT THIS REPLACES was a card -- Continue / Stay in TOY -- raised before
  // the first finer length and remembered per drawing. It was the right shape
  // under the older ruling, where DRAFTING was a place the drafter CHOSE to
  // go and TOY took sixteen tools away; leaving TOY was a decision and a
  // decision gets asked about. It is the wrong shape under this one. TOY now
  // takes nothing away, so the drafter is not being moved anywhere he could
  // have refused to go: he typed 12'-6", there is only one drawing that can
  // be, and the page's job is to make it and say what happened.
  //
  // SAID, THOUGH. A mode that changes silently is the "hidden mode flip" the
  // old card existed to avoid, and the lamp alone is too quiet for the moment
  // it happens -- a drafter watching his wall is not watching the corner. So
  // the strip says it once, in the same breath as the number that did it.
  const promotionWord = said => `${said} is finer than TOY draws — DRAFTING now`;
  const promoteForNumber = (toyCouldHoldIt, said) => {
    if (board !== 'toy' || toyCouldHoldIt) return false;
    setBoard('drafting');
    sayOnStrip(promotionWord(said));
    return true;
  };

  // THE OUTLINE'S TYPED EDGE: square (or 45 on DRAFTING), along the way the
  // cursor is pointing (or the typed bearing). Whole feet are TOY's law and the
  // light's, not the outline's: a number typed in inches moves the board,
  // as it does for a wall (typedOutlineFeet).
  const typedOutlineEdge = ({ feet = null, deg = null }) => {
    const from = outlineTail();
    if (!from || !cursorWorld) return;
    const aim = outlinePoint(cursorWorld);
    let ux = aim.x - from.x, uz = aim.z - from.z;
    if (deg !== null) {
      const step = outlineStep();
      if (Math.abs(deg % step) > 1e-9) { stripMessage.textContent = `the outline turns in ${step}° steps`; return; }
      const [tx, tz] = eighthTurn(deg);
      // Which end of the line: the hand's, as the wall's angle box does.
      const sign = (ux * tx + uz * tz) < 0 ? -1 : 1;
      const run = feet ?? Math.max(1, Math.round(Math.hypot(ux, uz)));
      ux = tx * sign; uz = tz * sign;
      outlineAdd({ x: from.x + ux * run, z: from.z + uz * run });
      return;
    }
    const len = Math.hypot(ux, uz);
    if (len < 1e-6) { stripMessage.textContent = 'point away from the corner first'; return; }
    outlineAdd({ x: from.x + ux / len * feet, z: from.z + uz / len * feet });
  };
  // A LOOP'S TYPED CORNER goes down where it is typed: not through
  // loopPoint again, whose 1 ft light would round 12-6 back to 12.
  const typedLoopCorner = feet => {
    const corners = loopCornersInHand();
    const from = corners[corners.length - 1];
    const aim = loopPoint(cursorWorld);
    const ux = aim.x - from.x, uz = aim.z - from.z;
    const len = Math.hypot(ux, uz);
    if (len < 1e-6) { stripMessage.textContent = 'point away from the corner first'; return; }
    corners.push({ x: from.x + ux / len * feet, z: from.z + uz / len * feet });
    stripRefresh();
    paint();
  };
  const typedOutlineFeet = () => {
    const parsed = F.parseArchitecturalLength(lengthBox.value);
    if (!parsed.ok) { stripMessage.textContent = parsed.error; return undefined; }
    const feet = parsed.inches / 12;
    return feet > 0 ? feet : undefined;
  };

  // ENTER PLACES THE POINT THE CURSOR SHOWS (Movie, 17 Oct: "to place the
  // walls the click choose direction and length and then click again or
  // ENTER"). With nothing typed, Enter on a run in hand is the click it
  // stands for; a typed LENGTH still takes its own Enter, in its own box.
  // ONCE A NODE, TWICE THE END (Movie, 20 Oct): "when drawing a series of
  // LINE, DIMENSION WALL, if the user esc, end the series of items being
  // drawn (as it does now) also make the DOUBLE CLICK on mouse close it off
  // in the same way. If the user presses one click on mouse it makes a NODE,
  // if DOUBLE click it closes.. also make the ENTER and SPACE act in the
  // same way where 1 click makes a NODE but a double click for ENTER or
  // SPACE closes the series".
  //
  // For a WALL or LINE run: ENTER or SPACE once puts a corner where the
  // cursor stands (and starts the run there when none is in hand); the same
  // key again inside SERIES_TWICE_MS, WITH THE CURSOR WHERE IT WAS, ends the
  // run, so the corner the first press put down is the run's last -- the
  // same shape as the double-click below, whose first click is a corner and
  // whose second lands on it. A quick second press after the cursor has
  // moved on is the next corner, not the end: a drafter who presses, moves,
  // presses is drawing, however fast.
  // AND THE SAME RULE CLOSES A LOOP -- a FLOOR, a SHAPE, an OUTLINE or the
  // single slope ROOF's outline (Movie, 22 Oct: "for when a user is
  // completing a shape like FLOOR, ROOF or SHAPE once the user is ready to
  // make the LAST / at FIRST point location by DOUBLE clicking, or pressing
  // ENTER or SPACEBAR twice quickly"). Once is a corner at the cursor; the
  // same key again, quickly, with the cursor where it was, closes the loop
  // on its first corner, and a double-click closes it the same way: its first
  // click is the last corner, its second lands on it (no corner: loopTailIs),
  // and the dblclick that follows closes. Below three corners nothing closes
  // -- two enclose no area -- and the strip says so.
  // DIMENSION KEEPS ITS OWN RULE, refined (Movie, 23 Oct: "to end a string
  // and go to the Line placement part, press SPACE BAR once (or ENTER key)
  // or the RIGHT mouse button ... right click / space / enter to end the
  // line placement and finish the dimension string"): ONCE ends -- the
  // points, or the lines (dimOnceEnds); the right button says the same. Esc
  // alone abandons the string. SPACE in a box is a space: typed lengths
  // carry them ("4 6"), which the target guard keeps.
  const SERIES_TWICE_MS = 450;
  let seriesKeyLast = { key: null, at: 0, where: null };
  const endDrawRun = () => {
    drawStart = null;
    seriesKeyLast = { key: null, at: 0, where: null };
    sayOnStrip(`${activeTool.toUpperCase()} — run ended. Press, ENTER or SPACE to start another.`);
  };
  // THE LOOP IN HAND: a corner or more on one of the loop tools.
  const loopInHand = () => traceCorners().length > 0;
  const dimInHand = () => activeTool === 'dimension' && dimPoints.length > 0;
  // ONE PRESS ON THE LOOP TOOL ARMED, from the pointer or from a key at the
  // cursor. A double-click ON THE FIRST CORNER closes on its first click, and
  // every close puts the tool down (setTool(RESTING_TOOL) in each commit), so
  // its second click is a resting press, not the start of a new loop.
  const loopPress = at => {
    if (activeTool === 'roof') shedPress(at);
    else if (activeTool === 'outline') outlinePress(at);
    else if (activeTool === 'floor') floorPress(at);
    else if (activeTool === 'shape') shapePress(at);
  };
  // CLOSE THE LOOP IN HAND ON ITS FIRST CORNER.
  const closeLoop = () => {
    const corners = traceCorners();
    if (!corners.length) return false;
    seriesKeyLast = { key: null, at: 0, where: null };
    if (corners.length < 3) {
      sayOnStrip(`A ${activeTool.toUpperCase()} needs three corners before it can close on the first.`);
      return true;
    }
    const first = { x: corners[0].x, z: corners[0].z };
    // THE OUTLINE CLOSES AS A PRESS ON ITS FIRST CORNER DOES, through its own
    // home rule (homeTail), which may refuse and say why.
    if (activeTool === 'outline') outlineAdd(first, first);
    else if (activeTool === 'floor') commitFloor();
    else if (activeTool === 'shape') commitShape();
    else if (activeTool === 'roof') commitShedRoof();
    return true;
  };
  const seriesKeyPress = (key, place) => {
    const now = Date.now();
    const still = seriesKeyLast.where && cursorWorld
      && Math.hypot(cursorWorld.x - seriesKeyLast.where.x, cursorWorld.z - seriesKeyLast.where.z) < 0.01;
    const twice = seriesKeyLast.key === key && now - seriesKeyLast.at < SERIES_TWICE_MS && still;
    seriesKeyLast = { key, at: now, where: cursorWorld ? { x: cursorWorld.x, z: cursorWorld.z } : null };
    if (twice && loopInHand()) return closeLoop();
    if (twice && drawsRun() && drawStart) { endDrawRun(); return true; }
    return place();
  };
  const enterPlaces = () => {
    if (!cursorWorld) return false;
    if (loopInHand()) { loopPress(cursorWorld); return true; }
    // With or without a run in hand: a first press starts one at the cursor.
    const run = drawsRun();
    if (run) { drawPress(cursorWorld); return true; }
    if (dimInHand()) return dimOnceEnds();
    return false;
  };
  window.addEventListener('keydown', e => {
    if (e.key !== 'Enter' || e.repeat || modalUp()) return;
    const t = e.target;
    if (t instanceof HTMLElement && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(t.tagName))) return;
    if (seriesKeyPress('Enter', enterPlaces)) { e.preventDefault(); stripRefresh(); paint(); }
  });
  window.addEventListener('keydown', e => {
    if (e.key !== ' ' || e.repeat || !(drawsRun() || loopInHand() || dimInHand()) || modalUp()) return;
    const t = e.target;
    if (t instanceof HTMLElement && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(t.tagName))) return;
    if (!cursorWorld) return;
    e.preventDefault();
    if (seriesKeyPress(' ', enterPlaces)) { stripRefresh(); paint(); }
  });
  // A DOUBLE-CLICK ENDS THE RUN. Its first click is an ordinary press -- a
  // corner, committed by the run's own pointerup -- and its second lands on
  // the same spot, which drawPress reads as no move; what is left to do is
  // put the run down. On a loop tool it closes the loop the same way.
  canvas.addEventListener('dblclick', e => {
    if (modalUp()) return;
    if (loopInHand()) { e.preventDefault(); closeLoop(); stripRefresh(); paint(); return; }
    if (!drawsRun() || !drawStart) return;
    e.preventDefault();
    endDrawRun();
    stripRefresh();
    paint();
  });
  // THE MOVE, MADE EXACT: the same points, from where the drag found them,
  // the typed distance along the line the drag took. The drag's own undo
  // entry restores those starting points, so one UNDO still takes it back.
  const moveByTyped = () => {
    const parsed = F.parseArchitecturalLength(lengthBox.value);
    if (!parsed.ok) { sayOnStrip(parsed.error); return; }
    const feet = parsed.inches / 12;
    const m = moveTyped;
    if (m.opening) return slideByTyped(m, feet);
    if (m.drag) return dragByTyped(m, feet);
    const wx = m.way ? m.way.x : m.dx, wz = m.way ? m.way.z : m.dz;
    const len = Math.hypot(wx, wz);
    if (!(feet > 0) || len < 1e-9) { sayOnStrip('Type a length over zero.'); return; }
    const dx = wx / len * feet, dz = wz / len * feet;
    // WHAT THE RELEASE WORKED OUT COMES BACK FIRST -- a floor stepped deeper
    // for the drag's span, a stair's framing laid where the drag left it --
    // last first, the way UNDO takes a batch. The move's own step stays: it
    // holds where the pieces started, which is what the typed distance is
    // measured from.
    const after = m.step.kind === 'batch' ? m.step.steps.slice(1) : [];
    after.slice().reverse().forEach(step => { undoStack.push(step); undoOnce(); });
    m.set.before.forEach(b => { b.vtx.x = b.x + dx; b.vtx.z = b.z + dz; });
    if (m.set.run) reclipRun(m.set.run);
    m.set.wells.forEach(w => { w.hole.points = w.points.map(p => ({ ...p, x: p.x + dx, z: p.z + dz })); });
    m.set.points.forEach(relinkVertex);
    m.dx = dx; m.dz = dz;
    // AND IS WORKED OUT AGAIN FOR THE EXACT PLACE, in the same UNDO.
    const settled = settleSelectionMove(m.set);
    const steps = [m.moveStep, ...settled.steps];
    const entry = steps.length > 1 ? { kind: 'batch', steps } : m.moveStep;
    undoStack[undoStack.length - 1] = entry;
    m.step = entry;
    lengthBox.blur();
    markDirty();
    sayOnStrip(`Moved ${feetLabel(feet)}.${settled.said} UNDO puts it ${settled.said ? 'all ' : ''}back.`);
    paint();
  };
  // A DOOR OR WINDOW, THE SAME WAY (Movie, 19 Oct: typed distance for doors):
  // the typed distance from where the slide began, the way the slide went,
  // clamped to the wall like every slide. The slide's step is taken back and
  // one written for the exact place, so the jamb dimensions are re-laid there
  // and a single UNDO still returns the door to where it started.
  const slideByTyped = (m, feet) => {
    if (!(feet >= 0)) { sayOnStrip('Type a distance.'); return; }
    const clamped = window.DraftGeometry2D.clampOpeningToWall(m.host, m.was + m.dir * feet,
      m.opening.width, { walls: walls(), thicknessFt: openingThicknessFt() });
    if (!clamped) return;
    undoOnce();
    m.opening.offset = clamped.offset;
    undoStack.push(foldRedim({ kind: 'move-opening', opening: m.opening, was: m.was }));
    m.step = undoStack[undoStack.length - 1];
    const went = Math.abs(clamped.offset - m.was);
    lengthBox.blur();
    markDirty();
    sayOnStrip(Math.abs(went - feet) > 1e-6
      ? `Slid ${feetLabel(went)} -- as far as the wall carries it. UNDO puts it back.`
      : `Slid ${feetLabel(feet)}. UNDO puts it back.`);
    paint();
  };
  // A SELECT DRAG, MADE EXACT: the drag is taken back -- its strings with
  // it -- and the same points are set the typed distance along the line it
  // took, from where they started, in a step of their own that UNDO takes
  // back in one.
  const dragByTyped = (m, feet) => {
    const len = Math.hypot(m.dx, m.dz);
    if (!(feet > 0) || len < 1e-9) { sayOnStrip('Type a length over zero.'); return; }
    const dx = m.dx / len * feet, dz = m.dz / len * feet;
    undoOnce();
    m.before.forEach(b => { b.vtx.x = b.x + dx; b.vtx.z = b.z + dz; });
    m.before.forEach(b => relinkVertex(b.vtx));
    const step = { kind: 'move', before: m.before };
    undoStack.push(step);
    foldRedim(step);
    m.step = step; m.dx = dx; m.dz = dz;
    lengthBox.blur();
    markDirty();
    sayOnStrip(`Moved ${feetLabel(feet)}. UNDO puts it back.`);
    paint();
  };
  // ANOTHER TOOL PUT IN HAND ENDS IT: the box is that tool's from then on.
  toolListeners.push(() => { if (moveTyped) { moveTyped = null; stripRefresh(); } });

  // ── A DIMENSION THAT DRIVES (Movie, 20 Oct) ───────────────────────────
  //
  // "if i click on that dimension and the type in 9-5 1/2" into the
  // dimension instead, it would stetch the wall to that size ... in this one
  // i have the door and its 2 sidewalls as an ASSEMBLY so it shouldn't
  // stretch but the other 'LONE" line at the north / top side should stretch
  // because it isn't in an ASSEMBLY" -- "i'd like to do this for the windows
  // and door dimensions too" -- and, of a value that cannot be met, nothing
  // changes and the strip says why.
  //
  // ONE DIMENSION SELECTED, the LENGTH box reads it and takes a number;
  // ENTER makes the dimension that long by moving what stands at ONE of its
  // ends, along the dimension's own line. What stands there is found by
  // position -- a record keeps only its two points -- on the extension line
  // through each end: a door or window (its dot or a jamb), a wall standing
  // across the line (either face or its centre), or a wall's or line's end.
  // Which end moves, best first: an OPENING (it slides along its wall; one
  // whose wall is in an assembly moves the assembly instead), then an
  // ASSEMBLY (it moves whole), then LONE geometry (it moves, and the walls
  // joined to it stretch). A tie moves the far end. So the overall stays put
  // unless the overall itself is what was typed into.
  // A DECLARATION, not a const: the strip refreshes while the page is still
  // loading, before this line has run.
  function dimTypedReady() {
    return !!(selection.length === 1 && selection[0].type === 'dimension' && !selection[0].point
      && selection[0].item?.start && selection[0].item?.end && !moveDrag
      && !(drawsRun() && drawStart) && !moveTypedReady());
  }
  // A dimension picked or let go opens or shuts the box at once.
  selectionWatchers.push(() => stripRefresh());
  const DIM_FEATURE_TOL_FT = 0.03;
  const dimEndFeatures = (dim, which) => {
    const G = window.DraftGeometry2D;
    const L = Math.hypot(dim.end.x - dim.start.x, dim.end.z - dim.start.z);
    const u = { x: (dim.end.x - dim.start.x) / L, z: (dim.end.z - dim.start.z) / L };
    const along = p => (p.x - dim.start.x) * u.x + (p.z - dim.start.z) * u.z;
    const at = which === 'start' ? 0 : L;
    const near = a => Math.abs(a - at) <= DIM_FEATURE_TOL_FT;
    const thick = openingThicknessFt();
    const found = { openings: [], walls: [], points: [] };
    openingsOn(walls()).forEach(({ opening }) => {
      const c = openingCentre(opening);
      const host = (drawing?.walls || []).find(w => String(w.id) === String(opening.wallId));
      if (!c || !host) return;
      const len = Math.hypot(host.end.x - host.start.x, host.end.z - host.start.z) || 1;
      const w = { x: (host.end.x - host.start.x) / len, z: (host.end.z - host.start.z) / len };
      const half = (Number(opening.width) || 0) / 2;
      if ([c, { x: c.x + w.x * half, z: c.z + w.z * half }, { x: c.x - w.x * half, z: c.z - w.z * half }]
        .some(p => near(along(p)))) found.openings.push({ opening, host, w });
    });
    walls().forEach(wall => {
      if (!wall.start || !wall.end) return;
      const len = Math.hypot(wall.end.x - wall.start.x, wall.end.z - wall.start.z) || 1;
      const dot = ((wall.end.x - wall.start.x) * u.x + (wall.end.z - wall.start.z) * u.z) / len;
      const t = thick(wall);
      if (Math.abs(dot) < 0.02) {
        // ACROSS THE LINE: its centre, either face, or the far face of a
        // wall drawn on one of its faces.
        const a = along(wall.start);
        if ([0, t / 2, -t / 2, t, -t].some(off => near(a + off))) found.walls.push({ wall, pts: [wall.start, wall.end] });
      } else {
        ['start', 'end'].forEach(key => {
          const a = along(wall[key]);
          if ([0, t / 2, -t / 2, t, -t].some(off => near(a + off))) found.points.push({ wall, pts: [wall[key]] });
        });
      }
    });
    lines().forEach(line => ['start', 'end'].forEach(key => {
      if (line[key] && near(along(line[key]))) found.points.push({ line, pts: [line[key]] });
    }));
    return { found, u, L };
  };
  // What one end would move, and how good a choice it is.
  const dimEndPlan = (found) => {
    const inGroup = wall => groupOf({ type: 'wall', item: wall });
    const opening = found.openings[0];
    if (opening) {
      const group = inGroup(opening.host);
      return group ? { kind: 'assembly', group, score: 3 } : { kind: 'opening', ...opening, score: 3 };
    }
    const runs = [...found.walls, ...found.points];
    const grouped = runs.map(r => r.wall && inGroup(r.wall)).find(Boolean);
    if (grouped) return { kind: 'assembly', group: grouped, score: 2 };
    const pts = [...new Set(runs.flatMap(r => r.pts))];
    return pts.length ? { kind: 'lone', pts, score: 1 } : null;
  };
  const driveDimension = feet => {
    const dim = selection[0].item;
    const G = window.DraftGeometry2D;
    if (!(feet > 0)) { sayOnStrip('Type a length over zero.'); return; }
    const S = dimEndFeatures(dim, 'start'), E = dimEndFeatures(dim, 'end');
    const delta = feet - S.L;
    if (Math.abs(delta) < 1e-6) { lengthBox.blur(); sayOnStrip(`Already ${feetLabel(feet)}.`); return; }
    const plans = [['end', dimEndPlan(E.found)], ['start', dimEndPlan(S.found)]].filter(([, p]) => p);
    if (!plans.length) { sayOnStrip('Nothing stands at either end of that dimension to move -- it stays as it is.'); return; }
    plans.sort((a, b) => b[1].score - a[1].score);
    const [which, plan] = plans[0];
    const sign = which === 'end' ? 1 : -1;
    const shift = { x: S.u.x * delta * sign, z: S.u.z * delta * sign };
    let step;
    if (plan.kind === 'opening') {
      const by = (shift.x * plan.w.x + shift.z * plan.w.z);
      const want = Number(plan.opening.offset) + by;
      const clamped = G.clampOpeningToWall(plan.host, want, plan.opening.width,
        { walls: walls(), thicknessFt: openingThicknessFt() });
      if (!clamped || Math.abs(clamped.offset - want) > 1e-4) {
        sayOnStrip(`The ${String(plan.opening.type || 'opening').toLowerCase()} can't go there -- it would run past the end of its wall. Nothing changed.`);
        return;
      }
      const was = plan.opening.offset;
      plan.opening.offset = clamped.offset;
      step = foldRedim({ kind: 'move-opening', opening: plan.opening, was });
    } else {
      const pts = plan.kind === 'assembly'
        ? [...new Set(itemsOfGroup(plan.group).flatMap(rotatePointsOf))]
        : plan.pts;
      const before = pts.map(vtx => ({ vtx, x: vtx.x, z: vtx.z,
        ...(vtx.offX !== undefined ? { offX: vtx.offX, offZ: vtx.offZ } : {}) }));
      const lens = new Map(walls().map(w => [w, { x: w.end.x - w.start.x, z: w.end.z - w.start.z }]));
      pts.forEach(v => { v.x += shift.x; v.z += shift.z; });
      // A WALL SQUEEZED TO NOTHING, OR TURNED INSIDE OUT, is a value the
      // drawing cannot meet: everything goes back and the strip says so.
      const crushed = walls().find(w => {
        const was = lens.get(w);
        const dx = w.end.x - w.start.x, dz = w.end.z - w.start.z;
        return was && (Math.hypot(dx, dz) < 0.25 || dx * was.x + dz * was.z < 0);
      });
      if (crushed) {
        before.forEach(b => { b.vtx.x = b.x; b.vtx.z = b.z; });
        sayOnStrip(`That would squeeze a wall to nothing -- ${feetLabel(feet)} doesn't fit. Nothing changed.`);
        return;
      }
      pts.forEach(relinkVertex);
      step = foldRedim({ kind: 'move', before });
    }
    // A HAND DIMENSION NOT LINKED TO WHAT MOVED says the new length too.
    const ref = dim[`${which}Ref`];
    const steps = [step];
    if (dim.auto !== true && !ref) {
      steps.unshift({ kind: 'props', edits: [{ item: dim, before: { ...dim } }] });
      dim[which] = { ...dim[which], x: dim[which].x + shift.x, z: dim[which].z + shift.z };
    }
    undoStack.push(steps.length > 1 ? { kind: 'batch', steps } : step);
    setSelection(selection.filter(entry => (drawing.dimensions || []).includes(entry.item)));
    lengthBox.blur();
    markDirty();
    const what = plan.kind === 'opening' ? `The ${String(plan.opening.type || 'opening').toLowerCase()} slid`
      : plan.kind === 'assembly' ? 'The assembly moved' : 'It moved';
    sayOnStrip(`${what} ${feetLabel(Math.abs(delta))} -- the dimension is ${feetLabel(feet)}. UNDO puts it back.`);
    paint();
  };
  const commitTypedLength = () => {
    // ENTER WITH THE BUTTON STILL DOWN (Movie, 25 Oct: "i try to move it the
    // direction id like then i press L or R to go into the LENGTH box and pres
    // 0-2 and press ENTER and at that point i'd like the wall to move 2
    // inchers over in the direction i chose"): the drag ends there, as its
    // release would, and that release finishes the typed length
    // (finishTypedMidDrag). The button coming up afterwards finds no drag.
    if (typedMidDrag && dragInHand()) {
      canvas.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, button: 0, pointerType: 'mouse' }));
      return;
    }
    if (stretchTypable()) { stretchByTyped(); return; }
    if (moveTypedReady()) { moveByTyped(); return; }
    if (dimTypedReady()) {
      const parsed = F.parseArchitecturalLength(lengthBox.value);
      if (!parsed.ok) { sayOnStrip(parsed.error); return; }
      driveDimension(parsed.inches / 12);
      return;
    }
    if (shedRun()) {
      const parsed = F.parseArchitecturalLength(lengthBox.value);
      if (!parsed.ok) { sayOnStrip(parsed.error); return; }
      if (!(parsed.inches > 0)) { sayOnStrip('Type a length over zero.'); return; }
      shedByTyped(parsed.inches / 12);
      lengthBox.value = '';
      lengthBox.blur();
      stripRefresh();
      return;
    }
    if (activeTool === 'outline') {
      if (String(lengthBox.value).trim() === '') { lengthBox.blur(); enterPlaces(); return; }
      const feet = typedOutlineFeet();
      if (feet !== undefined) {
        // AND THE NUMBER MOVES THE BOARD, as a typed wall length does. This
        // box used to answer "the outline goes in whole feet" on every board,
        // and on TOY there was nothing else to press: the board is a lamp,
        // and a drafter tracing a real building (Movie, 17 Oct, 5-2 in hand:
        // "no way to turn it off but to enter precise numbers") was refused
        // by the one thing that could have turned it off. The outline he
        // typed is the outline he gets, and the lamp changes behind it --
        // BEFORE the corner goes down, so it goes down on the board it
        // belongs to, and said again AFTER, because the corner's own "next
        // corner" would otherwise talk over the board's word.
        const said = String(lengthBox.value).trim();
        const promoted = promoteForNumber(toyCouldMakeLength(feet), said);
        typedOutlineEdge({ feet });
        if (promoted) sayOnStrip(promotionWord(said));
      }
      lengthBox.blur();
      return;
    }
    // A FLOOR'S OR A SHAPE'S NEXT CORNER, TYPED (Movie, 25 Oct: "do the other
    // 2 for sure" -- typed lengths and dragging corners, as WALL and LINE
    // have): that far from the last corner, the way the cursor points.
    if (loopTypable()) {
      if (String(lengthBox.value).trim() === '') { lengthBox.blur(); enterPlaces(); return; }
      const feet = typedOutlineFeet();
      if (feet !== undefined) typedLoopCorner(feet);
      lengthBox.blur();
      return;
    }
    if (String(lengthBox.value).trim() === '') { lengthBox.blur(); enterPlaces(); return; }
    const parsed = F.parseArchitecturalLength(lengthBox.value);
    if (!parsed.ok) { stripMessage.textContent = parsed.error; return; }
    const feet = parsed.inches / 12;
    if (!(feet > 0) || !drawStart || !cursorWorld) return;
    // AND THE NUMBER ITSELF MOVES THE BOARD, if a whole foot cannot hold it.
    // Nothing is asked and nothing is refused: the wall the drafter typed is
    // the wall he gets, and the lamp changes behind it.
    // SAID IN HIS OWN WORDS, the box's text rather than a re-formatted number:
    // a drafter who typed 12-6 reads "12-6", and a line that answered
    // 12'-6" would be the page correcting him in the middle of telling him
    // something else.
    promoteForNumber(toyCouldMakeLength(feet), String(lengthBox.value).trim());
    // LINED UP ON A NODE, THE LENGTH IS MEASURED FROM IT (refTyped).
    const fromRef = refTyped(feet);
    const aim = lockedPoint(drawStart, cursorWorld) || squareTo(drawStart, cursorWorld);
    const dx = aim.x - drawStart.x, dz = aim.z - drawStart.z;
    const len = Math.hypot(dx, dz);
    if (!fromRef && len < 1e-6) { stripMessage.textContent = 'point away from the start first'; return; }
    const end = fromRef || { x: drawStart.x + dx / len * feet, y: 0, z: drawStart.z + dz / len * feet };
    if (fromRef) dropRefLock();
    const made = commitDrawn(drawStart, end);
    drawStart = made.item.end;
    // THE SELECTION IS A SET ON THIS BRANCH. #398 wrote this line as
    // `selectedSeg = wall` against the single-wall variable that the selection
    // set replaced -- the third binding this merge had to re-seat, after
    // deleteLevel's setArmed and the strip's four reads of drawArmed. Same
    // shape every time: one branch deletes a name, another starts using it,
    // and git has nothing to say.
    setSelection([made]);
    lengthBox.blur();
    stripRefresh();
    paint();
  };
  // TYPING AN ANGLE KEEPS IT; THE PROTRACTOR ENGAGES IT. This used to commit
  // a wall along the typed bearing on Enter. Movie, 5 Oct: "allow them to
  // enter an angle but don't engage unless they light up the protractor". So
  // Enter only keeps the number; with the protractor lit, every piece of the
  // run travels along it (drawPoint, outlinePoint) and the hand or the LENGTH
  // box sets how far.
  const commitTypedAngle = () => {
    const raw = String(angleBox.value).replace(/[°\s]/g, '');
    // CLEARED, THE RUN SWINGS FREE: the number goes and the ANGLE goes dark.
    if (raw === '') {
      typedAngle = null;
      if (angleOn) lightInstrument(null);
      angleBox.blur(); clearNotice(); stripRefresh(); paint(); return;
    }
    const deg = parseFloat(raw);
    if (!Number.isFinite(deg) || Math.abs(deg) > 180) {
      stripMessage.textContent = 'angle in degrees, -180 to 180';
      return;
    }
    typedAngle = deg;
    // TYPED IS LOCKED: "if they enter and ANGLE eg 33 - it should take them
    // that angle with their line and lock it at that angle".
    lightInstrument('angle');
    angleBox.blur();
    // "if they enter a ANGLE or length other than 1ft" -- an angle TOY would
    // have drawn is every multiple of 90, and anything else is the drafter
    // asking for a building TOY cannot make. The promotion speaks for itself
    // here; the ANGLE line below would otherwise talk over it.
    if (!promoteForNumber(toyCouldMakeAngle(deg), `${deg}°`)) {
      sayOnStrip(`ANGLE LOCKED ${deg}° — clear the box to swing free`);
    }
    stripRefresh();
    paint();
  };
  // DELETED, NOT ONLY ENTERED: an emptied box frees the run at once.
  angleBox.addEventListener('input', () => {
    if (String(angleBox.value).replace(/[°\s]/g, '') === '' && typedAngle != null) commitTypedAngle();
  });
  angleBox.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); commitTypedAngle(); }
    if (e.key === 'Escape') { e.preventDefault(); angleBox.blur(); stripRefresh(); }
    e.stopPropagation();
  });

  lengthBox.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); commitTypedLength(); }
    // ONCE A SPACE, TWICE THE END (Movie, 20 Oct: "press enter or the mouse
    // button or the space bar to finish the length"). "14 6" is a length
    // with a space in it, so one space is typed; a second straight after it
    // is ENTER, the way a second ENTER ends a run.
    if (e.key === ' ' && / $/.test(lengthBox.value) && lengthBox.value.trim()) {
      e.preventDefault();
      lengthBox.value = lengthBox.value.trimEnd();
      commitTypedLength();
    }
    if (e.key === 'Escape') { e.preventDefault(); lengthBox.blur(); stripRefresh(); }
    // The page's own keys (0 to fit, Escape, Delete) must not fire while a
    // length is being typed -- a drafter typing 10' would otherwise refit the
    // view under his hands.
    e.stopPropagation();
  });

  // ── TYPE THE LENGTH WITHOUT CLICKING THE BOX ──────────────────────────
  //
  // Movie, 16 Oct: "when they get to this position and they are pointed a
  // direction, can we allow them to start entering numbers and it will start
  // entering into the LENGTH texbox without having to click on the texbox,
  // just put it straight in there".
  //
  // THE RULE, STATED RATHER THAN DISCOVERED: while a length is typable -- a
  // run in hand with a direction to measure along, which is exactly when
  // stripRefresh enables the box -- a digit pressed anywhere on the page is
  // the first character of a LENGTH. Focus follows that keystroke, so every
  // key after it lands in the box by itself: the foot mark, the hyphen, the
  // space of "14 6", the inch mark, Enter to commit, Escape to let go. The
  // box's own handler above keeps those from the page, as it always did.
  //
  // CAPTURED ON THE WINDOW AND SPENT HERE, because the page's own keys mean
  // something else while a run is live: 0 refits the sheet (the handler
  // further down) and the tool letters arm tools. A 0 that reached the fit
  // would refit the view under the drafter's hands -- the complaint the box's
  // stopPropagation already answers for keys typed INSIDE it; this is the
  // same answer for keys typed OUTSIDE it. So while a run is live, 0 is a
  // digit and not a fit. Escape first, which cancels the run as it always
  // has, and 0 is the fit again.
  //
  // THE FIRST KEYSTROKE REPLACES THE LIVE READING. Unfocused, the box shows
  // the run's own length (stripRefresh writes it there), and a 1 appended to
  // 6'-0" would read 6'-0"1. The drafter is starting a number, so the box
  // starts empty and takes his digit.
  //
  // DIGITS AND THE POINT OPEN IT, nothing else. The other characters a
  // length uses -- ' " - / and the space -- are nothing on their own, and the
  // letters are tool keys: W mid-run still puts the WALL tool down. They all
  // reach the box once a digit has given it the focus.
  //
  // THROUGH THE SAME COMMIT. Nothing here parses or promotes. Enter runs
  // commitTypedLength exactly as a click-then-type does, so a length a whole
  // foot cannot hold still turns the TOY light off (#746) whichever way the
  // digits arrived -- the hole #746 closed stays closed.
  //
  // TAB IS THE ANGLE. Movie asked for A ("unless they press A where they will
  // ... enter the ANGLE textbox"), and A is SHAPE on the default key profile
  // and P on the office one, so a letter would arm a tool in the middle of a
  // run. TAB is what AutoCAD's and Revit's dynamic input use to step from
  // length to angle, it is the "next field" key everywhere else, and it is a
  // tool letter in no profile. From the LENGTH box or from the sheet, Tab
  // puts the caret in the ANGLE box while a run is in hand; Shift+Tab from
  // the ANGLE box steps back. The box-to-box routes are written out rather
  // than left to the browser's own Tab order so they survive a control being
  // put between the two boxes.
  const typedLengthOpener = /^[0-9.]$/;
  const inAField = el => !!el && el instanceof HTMLElement
    && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName));
  window.addEventListener('keydown', event => {
    if (event.ctrlKey || event.altKey || event.metaKey) return;
    const target = event.target;
    if (event.key === 'Tab') {
      if (target === lengthBox && !event.shiftKey && !angleBox.disabled) {
        event.preventDefault(); event.stopImmediatePropagation();
        angleBox.focus(); angleBox.select(); return;
      }
      if (target === angleBox && event.shiftKey && !lengthBox.disabled) {
        event.preventDefault(); event.stopImmediatePropagation();
        lengthBox.focus(); lengthBox.select(); return;
      }
      if (!inAField(target) && !event.shiftKey && !angleBox.disabled && !lengthBox.disabled) {
        event.preventDefault(); event.stopImmediatePropagation();
        angleBox.focus(); angleBox.select(); return;
      }
      return;
    }
    if (inAField(target)) return;
    if (lengthBox.disabled || !typedLengthOpener.test(event.key)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    dropLengthHint();
    lengthBox.value = event.key;
    lengthBox.focus();
    lengthBox.setSelectionRange(lengthBox.value.length, lengthBox.value.length);
  }, true);

  // ── R AND L OPEN IT TOO, AND MID-DRAG (Movie, 20 Oct) ────────────────────
  //
  // "i click the ASSEMBLY to highlight it.. i move it in the direction i
  // want to move (with T SQUARE ON it will be in a 90 direction... then i
  // press 'R' or 'L' and it takes me into the text box to type the length,
  // and i press enter or the mouse button or the space bar to finish the
  // length and make the MOVE" -- "R = RADIUS (not right) L = LENGTH (not
  // left)". Either letter puts the caret in the LENGTH box whenever a length
  // is typable -- a run in hand, a move just made, a dimension picked -- and
  // ALSO WHILE A MOVE IS STILL IN HAND, button down: the drag gives the line,
  // the box takes the distance, and the release (finishTypedMidDrag) is the
  // ENTER. At any other time L is the LINE key and R is whatever the profile
  // says, exactly as before: this listener lets them through.
  const dragInHand = () => !!((moveDrag && moveDrag.active && ['wall', 'group', 'corner'].includes(moveDrag.kind))
    || (moveState?.drag && (moveState.drag.kind === 'selection' || moveState.drag.kind === 'opening')));
  window.addEventListener('keydown', event => {
    if (event.ctrlKey || event.altKey || event.metaKey || event.repeat) return;
    if (!/^[rl]$/i.test(event.key) || inAField(event.target) || modalUp()) return;
    const mid = dragInHand();
    if (lengthBox.disabled && !mid) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    dropLengthHint();
    if (mid) { typedMidDrag = true; lengthBox.disabled = false; lengthBox.value = ''; }
    lengthBox.focus();
    lengthBox.select();
  }, true);
  // AND THE MOUSE BUTTON FINISHES IT: a press on the sheet while a typed
  // length waits in the box after a move is the ENTER, not a new pick -- the
  // drafter said "enter or the mouse button or the space bar". Captured so
  // the press reaches no picker, and the selection stays in hand.
  // ON THE WINDOW, as the hologram pick and the trace move are: a press
  // that must beat every picker on the sheet is caught before the sheet
  // sees it at all.
  window.addEventListener('pointerdown', event => {
    if (event.button !== 0 || event.target !== canvas || document.activeElement !== lengthBox) return;
    if (!String(lengthBox.value).trim() || !moveTypedReady()) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    moveByTyped();
  }, true);

  // ── the switches ──────────────────────────────────────────────────────────
  // SKIN WITHOUT A RELOAD. Every painter reads its colours from `skin` inside
  // its own body, so re-resolving the palette and repainting is the whole
  // change -- and it has to be, because this page can be holding an unsaved
  // edit and a reload would be asked to throw it away to change a colour.
  // THE THREE SWITCHES LIVE IN THE MODE CORNER, not the strip: §7b moved them
  // to the head-left so the strip carries instruments and readings only.
  //
  // BUTTONS ONLY, AND INSIDE A DECLARED HOME. `html` carries `data-theme`
  // and `body` carries `data-board` -- those are the marks the switches SET
  // -- so a document-wide query hands the switch code its own output as a
  // control: every click then bubbles to `html`, re-reads the theme off it
  // and rewrites the skin key without the board in it.
  //
  // THE HOME IS AN ATTRIBUTE, NOT A LIST OF IDS, and this is the second time
  // that has paid for itself. The switches were split across the strip and
  // the bottom bar (Movie, 15 Sep) and all four are back in the mode corner
  // (Movie, 17 Sep) -- two moves, and not one line of wiring in between,
  // because `#mode-corner, #house-strip` would have gone stale on the first
  // of them. It fails SILENTLY when it does, with the switch simply never
  // wired, which is the failure shape this page keeps paying for.
  // THE SWITCH FINDER AND THE PRESSED-MARKER ARE THE BAR'S NOW. Both went out
  // with shell-bars.js, carrying the note they earned here: the home is an
  // ATTRIBUTE, not a list of ids, because the switches moved twice across
  // this page and a `#mode-corner, #house-strip` selector would have gone
  // stale on the first move -- silently, with the switch simply never wired.
  const { switchSet, markSwitch } = window.DraftShellBars;
  const themeButtons = switchSet('data-theme');
  const modeButtons = switchSet('data-skin-mode');

  // THE SKIN SWITCH IS THE BAR'S; WHAT TO REPAINT AFTERWARDS IS THIS PAGE'S.
  // The module applies the palette, marks the pressed button and merges the
  // choice into the stored skin -- the half PROJECT, SPECS and Construction
  // Layout will each need, and would each have copied. The three paints below
  // are the half that stayed, because a bar that repainted a drawing would be
  // a bar that knows what a drawing is.
  //
  // theme AND mode COME BACK THROUGH THE CALLBACK rather than being read off
  // the module, because this page keeps its own and a dozen things read them:
  // the board artwork, the bone artwork, the logo and the readout line. A
  // copy that went stale after the first switch would have left RUFF's dog on
  // a ROUGH board, which is exactly the shape of bug that does not show up
  // until someone flips a skin twice.
  window.DraftShellBars.wireSkin({
    theme, mode, key: SKIN_KEY,
    onSkin: (nextSkin, nextTheme, nextMode) => {
      skin = nextSkin; theme = nextTheme; mode = nextMode;
      paintBonePress();
      paintSignBoard();
      paint();
      // AND THE RAIL, which paint() does not touch. Its seats hold PIXELS
      // painted in whatever skin was current when they were last drawn, so a
      // switch left four night elevations sitting beside a white drawing --
      // Movie, 24 Sep: "the 'day' sidebar elevations look like 'night'".
      //
      // IT ONLY BECAME VISIBLE WHEN THE PAINTER LEARNED ABOUT SKINS. Before
      // the elevations took their inks from the caller, a thumbnail painted
      // the same picture whatever the lights were doing, so a rail that was
      // never repainted was a rail nobody could tell was stale. The bug is
      // older than the symptom.
      //
      // THE PRECEDENT IS TEN LINES UP: inDaylight swaps the skin for a shoot
      // and puts BOTH back in its finally, paint() and paintRailNow(). That
      // path knew the rail follows the skin; this one, which is where the
      // drafter actually changes it, did not.
      //
      // SYNCHRONOUS RATHER THAN THE SEAT-PER-FRAME REPAINT, for the reason
      // paintRailNow exists at all: a skin switch is one press and wants
      // finished pictures, not four frames of half-turned rail.
      paintRailNow();
    },
  });

  // ── THE BOARD IS A LIGHT, AND EVERY DRAWING STARTS IN TOY ───────────────
  //
  // Movie, 15 Oct: *"lets always start the users in TOY MODE"*, and *"maybe
  // don't even offer them to change to DRAFTING MODE, but if they enter a
  // ANGLE or length other than 1ft, it will automatically place them in
  // DRAFTING MODE. so it ill be basically a LIGHT -- not a button"*.
  //
  // SO THE SEED IS GONE. It used to be the board the drafter last used, kept
  // in localStorage so a fresh page opened where he left off -- which is
  // exactly what "always start the users in TOY MODE" rules out: one typed
  // 12'-6" in one drawing would have put every later drawing on DRAFTING
  // before its first wall. A drawing that has RECORDED a board still wins, so
  // a promoted drawing still reloads as DRAFTING -- that is a fact about one
  // file, and the reason the board was moved onto the drawing in the first
  // place.
  const BOARDS = ['toy', 'drafting'];
  let board = 'toy';

  const boardOfDrawing = () =>
    window.DraftDrawingFormat.board(drawing?.board) || 'toy';
  const applyBoard = () => {
    document.body.setAttribute('data-board', board);
    paintBoardLamp();
    boardListeners.forEach(fn => fn(board));
  };

  // WHAT THE LAMP SAYS. Two rows: the board, and what being on it MEANS --
  // "so if its in TOY MODE the user will know its 90s / and 1ft". A lamp that
  // only said TOY would be a label; the second row is the instrument.
  //
  // LIT ON TOY ONLY. TOY is the state with a rule in it, so it is the state
  // worth announcing; DRAFTING is the page with nothing held back, and the
  // lamp goes quiet without going blank -- it still says which board the
  // drawing is on, because that does not stop being true.
  const boardLamp = document.querySelector('[data-board-light]');
  const paintBoardLamp = () => {
    if (!boardLamp) return;
    const toy = board === 'toy';
    boardLamp.querySelector('[data-board-lamp]').textContent = toy ? 'TOY' : 'DRAFTING';
    boardLamp.querySelector('[data-board-lamp-note]').textContent = toy
      ? '1 FT · 90°' : 'ANY LENGTH';
    boardLamp.toggleAttribute('data-lit', toy);
    // THE TITLE IS THE LAMP'S OWN, set here beside the words it explains --
    // the switch's titles were set from script for the same reason, and the
    // one thing that must not happen is a lamp whose hover describes the
    // other board.
    boardLamp.title = toy
      ? 'TOY — every tool, but square and on the whole foot. Type a finer '
        + 'length or an off-square angle and the drawing moves to DRAFTING.'
      : 'DRAFTING — any length, any angle. This drawing left TOY when a '
        + 'number was typed that a whole foot could not hold.';
  };

  // ONE PLACE THE BOARD CHANGES, so the drawing and the lamp cannot drift.
  // There is no longer anything that moves it BACK: the promotion below is
  // the only caller, and a drafter who wants TOY again starts a drawing.
  const setBoard = next => {
    if (!BOARDS.includes(next) || next === board) return;
    board = next;
    if (drawing) {
      drawing.board = window.DraftDrawingFormat.board(next);
      markDirty();
    }
    applyBoard();
  };

  markSwitch(themeButtons, 'theme', theme);
  markSwitch(modeButtons, 'skinMode', mode);
  paintBonePress();
  paintSignBoard();
  applyBoard();
  stripRefresh();

  // ONE LISTENER, THE REGISTER'S. #398 wrote this against the armed
  // boolean (`setArmed(!drawArmed)`); the register replaced that, and the
  // merge offered both because the strip and the tool column were added at
  // the same point in the file. Keeping both listeners would have given the
  // button two handlers that disagree about what armed means.

  // ── the tool column ───────────────────────────────────────────────────────
  // SEVENTEEN KEYS, RENDERED FROM THE LIST. tool-roster.js holds the roster;
  // this builds it and wires it to the register above. Nothing here decides
  // what a tool does — pressing a key sets `activeTool` and that is all — so a
  // tool whose gesture is not written yet still lights, still says what it
  // would do, and still puts the previous one down. A key that did nothing at
  // all would be worse than no key: it would look like a working tool.
  //
  // THE LETTERS ARE READ ONCE AT BUILD, from SETTINGS through the roster. A
  // remap made in another tab lands on the next load, which is how every other
  // profile-backed value on this page behaves.
  const buildToolColumn = () => {
    const roster = window.DraftToolRoster;
    const slot = document.getElementById('tool-slot');
    if (!roster || !slot) return;
    const resolved = roster.bindings();
    roster.GROUPS.forEach(group => {
      const box = document.createElement('div');
      box.dataset.toolGroup = group.id;
      const name = document.createElement('div');
      name.dataset.toolGroupName = '';
      name.textContent = group.label;
      const keys = document.createElement('div');
      keys.className = 'tool-keys';
      keys.append(...roster.inGroup(group.id).map(tool => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'tool-key';
        btn.dataset.toolKey = tool.id;
        btn.dataset.toolKind = tool.kind;
        btn.setAttribute('aria-pressed', String(tool.id === activeTool));
        // The disabled state and the title are NOT set here -- see
        // refreshToolAvailability below, which this function calls once the
        // keys exist. One place decides the face, for the same reason one
        // place decides availability.
        const letter = document.createElement('span');
        letter.dataset.toolLetter = '';
        letter.textContent = roster.keyFor(tool.id, resolved);
        const label = document.createElement('span');
        label.dataset.toolName = '';
        label.textContent = tool.name;
        btn.append(letter, label);
        // PRESSING THE ARMED KEY RETURNS TO SELECT rather than to nothing --
        // see the register's comment. Pressing SELECT while select is armed is
        // therefore a no-op, which is right: it is the resting state.
        btn.addEventListener('click', () => pressToolKey(tool.id));
        return btn;
      }));
      box.append(name, keys);
      // EACH GROUP ONTO ITS OWN TAB, and PREPENDED rather than appended: the
      // DRAFTING pane also carries SELECTION, OBJECT TYPE and ASSEMBLY, and
      // the keys belong above the blocks that modify what they do.
      //
      // REPLACING ITS OWN BOX, not the pane's children. The note below is
      // about exactly this: `replaceChildren` on a shared parent is what wiped
      // the selection and assembly panels the first time, and a pane is a
      // shared parent again. Swapping the group's own element leaves whatever
      // else lives on that tab alone, so a second call is harmless instead of
      // destructive.
      const pane = leftPane(paneForBlock(group.id));
      if (!pane) return;
      const standing = pane.querySelector(`[data-tool-group="${group.id}"]`);
      if (standing) standing.replaceWith(box); else pane.prepend(box);
    });
    refreshToolAvailability();
  };

  // §6 ON THE FACE, AND IT IS A WALK RATHER THAN A REBUILD. `disabled` rather
  // than hidden: a key that vanishes on TOY tells a drafter the tool does not
  // exist, and moves every key below it, so switching boards would reshuffle
  // the column under their finger. Down and still in its place says the true
  // thing -- this board does not offer it.
  //
  // WHY THIS IS NOT buildToolColumn() CALLED AGAIN. #tool-slot is shared: the
  // SELECTION and ASSEMBLY panels append into the same element, and this
  // builder is the only one that calls replaceChildren. Re-running it on a
  // board change wiped both of them -- the page kept its seventeen keys and
  // lost every selection mode, filter and assembly control. My own boards spec
  // stayed green through it, because it only ever looked at tool keys; 25
  // checks in three MERGED suites went red. Availability changes on a board
  // switch, the letters do not, so nothing needs rebuilding.
  function refreshToolAvailability() {
    const roster = window.DraftToolRoster;
    if (!roster) return;
    document.querySelectorAll('[data-tool-key]').forEach(btn => {
      const tool = roster.get(btn.dataset.toolKey);
      if (!tool) return;
      // STILL ASKED, THOUGH THE ANSWER IS NOW ALWAYS YES on both boards
      // (Movie, 15 Oct). The roster is the one place that decides, and a
      // keypad that stopped asking would be the day a board takes something
      // away again and the keys do not hear about it.
      const usable = roster.availableOn(tool.id, board);
      btn.disabled = !usable;
      // The title is the whole name, because the face is 40px and
      // FENESTRATION does not fit on it at a readable size. The refusal that
      // used to go here -- "the TOY board does not offer this tool" -- went
      // with the ruling: there is no tool TOY does not offer.
      btn.title = tool.name;
    });
  }

  // The register tells the column, never the other way round. Any future
  // arming path -- a keyboard shortcut, a tool that puts itself down when it
  // finishes -- lights the right key for free, because it goes through
  // setTool and setTool is what fires this.
  toolListeners.push(next => {
    document.querySelectorAll('[data-tool-key]').forEach(btn => {
      btn.setAttribute('aria-pressed', String(btn.dataset.toolKey === next));
    });
  });

  buildToolColumn();

  // ── THE LETTERS ON THE KEYS DO SOMETHING ─────────────────────────────────
  //
  // The column has painted a letter on every key since it was built and not
  // one of them was wired. The faces are real -- they come from the roster,
  // which reads the drafter's OWN bindings, so a profile that moves TRIM off Q
  // moves the face too -- and pressing the key the page drew did nothing at
  // all. Seventeen keys, seventeen instructions the page could not carry out.
  //
  // Movie, 18 Sep: "check the model.dc file it has a tool was U before". It is
  // U -- profile-manager.js, `outline: 'U'` -- and he was pressing it. The old
  // page has no OUTLINE button either (its column is the same seventeen,
  // :24035); outline is reached there by that key or by picking a house type.
  // So the missing tool and the dead letters are one gap, not two.
  //
  // A KEY FACE THAT DOES NOTHING IS THE SAME DEFECT AS THE STALE GARAGE
  // REFUSAL two rungs back: the page stating something about itself that is
  // not true, and a drafter believing it.
  //
  // THE VERB IS THE COLUMN'S, not a second one. Pressing the armed tool's
  // letter returns to SELECT exactly as pressing its key does, because they
  // are one sentence said two ways -- and both go through setTool, so the
  // board refuses a tool it does not offer whichever way it was asked for.
  document.addEventListener('keydown', event => {
    const kb = window.DraftKeyboard;
    const roster = window.DraftToolRoster;
    if (!kb || !roster) return;
    // A DRAFTER TYPING A GARAGE WIDTH IS NOT ARMING THE WALL TOOL. The size
    // fields on the sign are the live case -- 'W' is a digit's neighbour and
    // a name is nothing but letters -- and a page that armed a tool out from
    // under a field would also eat the character.
    const el = event.target;
    if (el && (el.isContentEditable
      || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName))) return;
    // NO COMBINATIONS FALL THROUGH HERE BY ACCIDENT: eventMatchesBinding
    // compares every modifier exactly, so Ctrl+Z is not 'Z' and the undo
    // handler keeps it.
    const map = roster.bindings();
    const tool = roster.TOOLS.find(entry => entry.command
      && kb.eventMatchesBinding(event, map[entry.command]));
    if (!tool) return;
    // ASKED OF THE BOARD BEFORE THE PRESS IS SPENT. setTool would refuse a
    // tool the board does not offer and fall back to SELECT, which would put
    // down the tool the drafter was holding as the price of a key that was
    // never going to work.
    if (!roster.availableOn(tool.id, board)) return;
    event.preventDefault();
    pressToolKey(tool.id);
  });

  // A BOARD CHANGE PUTS DOWN A TOOL THE NEW BOARD DOES NOT OFFER, and ONLY
  // such a tool. Leaving it armed would keep ROOF live behind a greyed ROOF
  // key -- the column telling the truth about the key and a lie about the
  // state, and the next drag still drawing a roof on the toy board.
  //
  // THE CONDITION IS NOT DECORATION. The first version called setTool on every
  // board change, and setTool clears `drawStart` because a tool change
  // abandons the gesture that belonged to the old tool. A BOARD change is not
  // a tool change: PROMOTION crosses boards in the middle of a run on purpose
  // -- typing a length in TOY offers DRAFTING and then commits that same run
  // -- so disarming unconditionally cut the anchor out from under the commit
  // and the wall was never made. model-toy-board.spec.js:224 caught it; the
  // gesture survives a crossing that keeps its tool.
  boardListeners.push(() => {
    const roster = window.DraftToolRoster;
    if (roster && !roster.availableOn(activeTool, board)) setTool(RESTING_TOOL);
    refreshToolAvailability();
    // THE OTHER TWO SURFACES. Leaving these out is exactly the gap that made
    // §6 a third built: the keys obeyed the board and the panels did not, and
    // nothing said so because the spec only looked at keys.
    syncSelectionPanel();
    syncAssembly();
    // AND THE FIXTURE PANEL, for the reason stated three lines up -- which is
    // the gap this very listener was written to close, and which the fixture
    // panel promptly fell into: built before the board settles, its chips read
    // TOY's answer and stayed dead on the drafting board. The keys obeyed the
    // board and one more panel did not.
    syncFixturePanel();
  });

  // ── SELECTION and OBJECT TYPE ─────────────────────────────────────────────
  // THE HELP STRINGS ARE THE OLD PAGE'S, VERBATIM (:23597 and :23619). They are
  // not decoration: the mode help is the only place the shift-drag shortcut is
  // written down, and the filter help is the only thing that tells a drafter
  // why the thing under the cursor stopped responding. Paraphrasing them would
  // have quietly dropped facts a drafter depends on.
  const MODES = [
    { id: 'click', label: 'ITEMS' },
    { id: 'window', label: 'WINDOW' },
    { id: 'window-all', label: 'ALL LEVELS' },
  ];
  const MODE_HELP = {
    click: 'Click items to select; Shift adds or removes. Drag left to right for a '
      + 'blue box of what it encloses, right to left for a green box of what it '
      + 'crosses. Right-drag (two fingers) pans.',
    window: 'Drag a blue box to select fully enclosed items on the current level.',
    'window-all': 'Drag a red box to select fully enclosed items on every level.',
  };
  const FILTERS = [
    { id: 'line', label: 'LINE', aria: 'Grab only lines' },
    { id: 'wall', label: 'WALL', aria: 'Grab only walls' },
    { id: 'outline', label: 'OUTLINE', aria: 'Grab only outlines' },
    { id: 'floor', label: 'FLOOR', aria: 'Grab only floors' },
    // EVERY OTHER THING SELECT CAN PICK (Movie, 4 Oct: "if i press WALL and
    // then SELECT it will only select WALLS, or same thing for other object
    // types"). One per type `hitAt` answers, under the type it answers with,
    // so the filter and the pick cannot disagree about a name.
    { id: 'fenestration', label: 'DOOR/WIN', aria: 'Grab only doors and windows' },
    { id: 'fixture', label: 'FIXTURE', aria: 'Grab only fixtures' },
    { id: 'stair', label: 'STAIR', aria: 'Grab only stairs' },
    { id: 'roomtag', label: 'TAG', aria: 'Grab only room tags' },
    { id: 'note', label: 'NOTE', aria: 'Grab only notes' },
    { id: 'shape', label: 'SHAPE', aria: 'Grab only shapes' },
    { id: 'roof', label: 'ROOF', aria: 'Grab only roofs' },
    { id: 'dimension', label: 'DIM', aria: 'Grab only dimensions' },
    { id: 'beam', label: 'BEAM', aria: 'Grab only beams' },
    { id: 'column', label: 'COLUMN', aria: 'Grab only columns' },
    { id: 'superNode', label: 'SNODE', aria: 'Grab only super nodes' },
  ];
  const filterHelp = () => (selectFilter === 'all'
    ? 'Nothing lit grabs everything. Press a type so Select only grabs that object — even under other geometry.'
    : `${(FILTERS.find(f => f.id === selectFilter)?.label || selectFilter.toUpperCase())} is engaged: nothing else responds. `
      + 'Press it again — or Esc with nothing selected — to release.');

  // PICKING A MODE ALSO ARMS SELECT, which is the old page's own behaviour
  // (setClickSelectionMode and its two siblings all set activeTool: 'select').
  // Without it a drafter with WALL armed could press WINDOW, see it light, and
  // still draw a wall on the next drag.
  const setSelectionMode = id => {
    selectionMode = id;
    setTool('select');
    syncSelectionPanel();
  };

  // NO ALL BUTTON (Movie, 4 Oct: "if nothing is selected ... just select ALL
  // when nothing else is selected"). Nothing lit IS all, so pressing the lit
  // type again lets it go -- and 'all' stays the state's own word for that.
  const setSelectFilter = id => {
    selectFilter = id === selectFilter && !selectFixtureKind ? 'all' : id;
    selectFixtureKind = null;
    syncSelectionPanel();
    syncPickGlow();
  };

  let syncSelectionPanel = () => {};

  const buildSelectionPanel = () => {
    const slot = document.getElementById('tool-slot');
    if (!slot) return;
    const chip = (dataKey, entry, onPick) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'sel-chip';
      btn.dataset[dataKey] = entry.id;
      btn.textContent = entry.label;
      if (entry.aria) btn.setAttribute('aria-label', entry.aria);
      btn.addEventListener('click', () => onPick(entry.id));
      return btn;
    };
    const section = (name, chips, help) => {
      const box = document.createElement('div');
      box.dataset.toolGroup = name.toLowerCase().replace(/\s+/g, '-');
      const title = document.createElement('div');
      title.dataset.toolGroupName = '';
      title.textContent = name;
      const row = document.createElement('div');
      row.className = 'sel-row';
      row.append(...chips);
      box.append(title, row, help);
      return box;
    };

    const modeHelp = document.createElement('div');
    modeHelp.className = 'sel-help';
    modeHelp.dataset.selHelp = '';
    const filterHelpEl = document.createElement('div');
    filterHelpEl.className = 'sel-help';
    filterHelpEl.dataset.filterHelp = '';

    // ONTO THE DRAFTING TAB, from the table -- these two modify what Select
    // grabs, so they belong beside the key that arms it. The `slot` lookups
    // below still read the whole rail on purpose: the panes are inside it, so
    // a chip stays findable wherever the table happens to put its section.
    const home = leftPane(paneForBlock('selection')) || slot;
    home.append(
      section('SELECTION',
        MODES.map(m => chip('selMode', m, setSelectionMode)), modeHelp),
      section('OBJECT TYPE',
        FILTERS.map(f => chip('selFilter', f, setSelectFilter)), filterHelpEl));

    syncSelectionPanel = () => {
      // §6: "the selection filters ... none of them operate in TOY". The board
      // answer comes from the roster, not from a `board === 'toy'` written
      // here, so this panel and the keypad cannot disagree about a board.
      const on = window.DraftToolRoster?.panelOn('selection', board) !== false;
      slot.querySelectorAll('[data-sel-mode]').forEach(btn => {
        btn.setAttribute('aria-pressed',
          String(btn.dataset.selMode === selectionMode));
        btn.disabled = !on;
      });
      slot.querySelectorAll('[data-sel-filter]').forEach(btn => {
        btn.setAttribute('aria-pressed',
          String(btn.dataset.selFilter === selectFilter));
        btn.disabled = !on;
      });
      // THE HELP SAYS WHY, and it replaces the mode help rather than sitting
      // beside it: MODE_HELP describes a shortcut for a gesture this board
      // does not have, and leaving it up would teach a drafter a control that
      // is right there and dead.
      // THE REFUSAL BRANCH IS UNREACHABLE SINCE 15 OCT -- no board puts these
      // chips away any more -- and it is kept rather than deleted because the
      // roster is still the one place that decides, and the day a board
      // refuses again this is where the drafter is told. What went is the
      // SENTENCE: "on the DRAFTING board" named a switch that no longer
      // exists, so it would have sent him looking for a button.
      modeHelp.textContent = on ? MODE_HELP[selectionMode]
        : 'Selection modes and filters are not offered on this board.';
      filterHelpEl.textContent = on ? filterHelp() : '';
      // RED WHENEVER A FILTER IS ENGAGED -- not when the cursor is over
      // something the filter excludes. selectFilterHelpColor (:23622) is a
      // straight ternary on selectFilter, and a cursor-driven red would mean
      // hit-testing on every mousemove, which the old page does not do.
      filterHelpEl.toggleAttribute('data-engaged', selectFilter !== 'all');
    };
    syncSelectionPanel();
  };

  buildSelectionPanel();

  // ── SELECT PICKING A KIND, and the bar over the tabs ─────────────────────
  //
  // Movie, 19 Oct: "have the SELECT button chosen, and also choose the
  // FENETRATION (for this example) and instead of doing the TOOLS FUNCTION
  // the SELECTION will take over and if a user make a rectangular window it
  // will SELECT all the FENSTRATIONS in the rectangle so the user can delete
  // them all at once" -- "same with WALLS and LINES", DIMENSIONS too; "ONLY 1
  // at a time"; ended by "escape or press S or SELECT again".
  //
  // The kind a key picks is the OBJECT TYPE filter's own word, so the chip
  // and the key light together and the pick and the box read one filter.
  // Keys with no kind (EXTEND, COPY, TRIM, ASSEMBLY ...) do what they always
  // did, and arming one ends the picking.
  const PICK_KINDS = { wall: 'wall', line: 'line', fenestration: 'fenestration', floor: 'floor',
    roof: 'roof', dormer: 'roof', column: 'column', beam: 'beam', stair: 'stair',
    fixture: 'fixture', dimension: 'dimension', shape: 'shape', annotation: 'note', roomtag: 'roomtag',
    node: 'superNode' };
  const BAR_KEYS = ['select', 'assembly', 'dimension', 'trim'];
  function syncPickGlow() {
    document.querySelectorAll('[data-tool-key], [data-bar-key]').forEach(btn => {
      const id = btn.dataset.toolKey || btn.dataset.barKey;
      btn.toggleAttribute('data-picking', selectPicking && id === 'select');
      btn.toggleAttribute('data-picked', selectPicking && PICK_KINDS[id] === selectFilter
        && !(id === 'fixture' && selectFixtureKind));
    });
    document.querySelectorAll('[data-fixture-kind]').forEach(btn => {
      btn.toggleAttribute('data-picked', selectPicking && selectFilter === 'fixture'
        && btn.dataset.fixtureKind === selectFixtureKind);
    });
  }
  function pickName() {
    if (selectFixtureKind) return (window.DraftFixtureKinds?.kindFor(selectFixtureKind)?.label || selectFixtureKind).toUpperCase();
    return selectFilter === 'fenestration' ? 'DOORS AND WINDOWS'
      : selectFilter === 'superNode' ? 'SUPER NODES'
        : selectFilter === 'note' ? 'NOTES' : `${selectFilter.toUpperCase()}S`;
  }
  function setSelectPicking(on) {
    selectPicking = on;
    if (!on) { selectFilter = 'all'; selectFixtureKind = null; }
    syncSelectionPanel();
    syncPickGlow();
    sayOnStrip(on ? 'SELECT — press a kind (WALL, LINE, FENESTRATION, DIMENSION ...) and box them. Esc, S or SELECT again to stop.'
      : 'SELECT — picks everything again.');
  }
  // ONE KIND AT A TIME: another key swaps to its kind, the lit one lets go.
  function pickKind(kind, fixtureKind = null) {
    const same = selectFilter === kind && selectFixtureKind === fixtureKind;
    selectFilter = same ? 'all' : kind;
    selectFixtureKind = same ? null : fixtureKind;
    syncSelectionPanel();
    syncPickGlow();
    sayOnStrip(same ? 'SELECT — no kind picked: everything responds. Press a kind, or Esc to stop.'
      : `SELECT — picking ${pickName()} only. Box them, then DELETE. Esc, S or SELECT again to stop.`);
  }
  // EVERY KEY PRESS COMES HERE -- the column, the bar and the letters -- so
  // they cannot disagree about what a press means.
  // S TOGGLES (Movie, 25 Oct: "try S to toggle from tool to select"): from a
  // tool, S is SELECT and the tool is remembered; S again in SELECT brings that
  // tool back up. The bar's SELECT keeps its own job, picking one kind.
  let toolBeforeSelect = null;
  const toolName = id => window.DraftToolRoster?.TOOLS.find(t => t.id === id)?.name || id;
  function pressToolKey(id, fromBar = false) {
    if (id === RESTING_TOOL) {
      if (selectPicking) { setSelectPicking(false); return; }
      if (!fromBar && activeTool === RESTING_TOOL && toolBeforeSelect
        && window.DraftToolRoster?.availableOn(toolBeforeSelect, board)) {
        const back = toolBeforeSelect;
        toolBeforeSelect = null;
        setTool(back);
        sayOnStrip(`${toolName(back).toUpperCase()} — back up. S for SELECT again.`);
        return;
      }
      const was = activeTool;
      setTool(RESTING_TOOL);
      if (!fromBar && was !== RESTING_TOOL) {
        toolBeforeSelect = was;
        sayOnStrip(`SELECT — S again goes back to ${toolName(was).toUpperCase()}.`);
      }
      if (fromBar) setSelectPicking(true);
      return;
    }
    if (selectPicking && PICK_KINDS[id]) { pickKind(PICK_KINDS[id]); return; }
    // MOVE IS THE FOOT'S MOVE, pressed from the column or by M ("keep move
    // bottom too"): it acts on what is picked, so with nothing picked it says
    // to pick first rather than arming a tool that has nothing to carry.
    if (id === 'move') {
      if (!selection.length && !moveState.on) {
        sayOnStrip('MOVE: pick what to move first -- click it, or box it -- then press M or MOVE.');
        return;
      }
      pressMove();
      return;
    }
    setTool(id === activeTool ? RESTING_TOOL : id);
  }
  // SELECT GLOWS WHILE STRETCH IS UP -- the box is the rectangle select's.
  toolListeners.push(next => {
    document.querySelectorAll('[data-tool-key="select"], [data-bar-key="select"]').forEach(btn => {
      if (next === 'stretch') btn.setAttribute('data-stretch-glow', ''); else btn.removeAttribute('data-stretch-glow');
    });
    if (next === 'stretch') sayOnStrip('STRETCH: press one corner of the box, then the opposite corner.');
  });
  toolListeners.push(next => {
    if (next !== RESTING_TOOL && selectPicking) setSelectPicking(false);
    document.querySelectorAll('[data-bar-key]').forEach(btn => {
      btn.setAttribute('aria-pressed', String(btn.dataset.barKey === next));
    });
  });
  const buildSelectBar = () => {
    const bar = document.getElementById('select-bar');
    const roster = window.DraftToolRoster;
    if (!bar || !roster) return;
    const resolved = roster.bindings();
    const keys = document.createElement('div');
    keys.className = 'tool-keys';
    keys.append(...BAR_KEYS.map(id => {
      const tool = roster.get(id);
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'tool-key';
      btn.dataset.barKey = id;
      btn.title = id === 'select' ? 'SELECT — then press a kind to pick only that kind' : tool.name;
      btn.setAttribute('aria-pressed', String(id === activeTool));
      const letter = document.createElement('span');
      letter.dataset.toolLetter = '';
      letter.textContent = roster.keyFor(id, resolved);
      const label = document.createElement('span');
      label.dataset.toolName = '';
      label.textContent = tool.name;
      btn.append(letter, label);
      btn.addEventListener('click', () => pressToolKey(id, true));
      return btn;
    }));
    bar.replaceChildren(keys);
  };
  buildSelectBar();

  // ── ASSEMBLY and UNGROUP ──────────────────────────────────────────────────
  // WHAT AN ASSEMBLY IS, in the file: a named set of members recorded by TYPE
  // AND ID, never by object reference (_createGroup :17940). Ids are what
  // survive a save; references are not.
  //
  // ESCAPE IN THE NAME FIELD CREATES A "NOT FIXED" ASSEMBLY. It does not
  // cancel. That is the old page's binding (onGroupNameKey :23685-23687:
  // Enter -> _createGroup(true), Escape -> _createGroup(false)) and it is
  // ported faithfully because this order says the roster is not a place to
  // improve on -- but it is worth someone's decision rather than quiet
  // inheritance: everywhere else on both pages Escape backs out, so a drafter
  // reaching for it to abandon the dialog gets an assembly they did not want.
  // Flagged, not fixed.
  const nextGroupNumber = () => {
    const n = Number(drawing?.nextGroupId);
    return Number.isFinite(n) && n > 0 ? n : (groups().length + 1);
  };

  const createAssembly = fixed => {
    const chosen = selection.slice();
    if (!chosen.length) { closeAssemblyDialog(); return; }
    const members = [];
    chosen.forEach(entry => {
      if (!entry.item || entry.item.id == null) return;
      const key = memberKey(entry);
      if (!members.some(m => `${m.type}:${m.id}` === key)) {
        members.push({ type: entry.type, id: entry.item.id });
      }
    });
    if (!members.length) { closeAssemblyDialog(); return; }
    // AN ITEM BELONGS TO ONE ASSEMBLY. Taking it into a new one takes it out
    // of its old one, and an assembly left with nothing in it goes -- the old
    // page's own two lines, and without them a drafter can build overlapping
    // assemblies that disagree about what moves with what.
    const taken = new Set(members.map(m => `${m.type}:${m.id}`));
    drawing.groups = groups()
      .map(group => ({ ...group,
        members: (group.members || [])
          .filter(m => !taken.has(`${m.type}:${m.id}`)) }))
      .filter(group => group.members.length > 0);

    const n = nextGroupNumber();
    const typed = (assemblyName || '').trim().toUpperCase();
    const firstWall = chosen.find(entry => entry.type === 'wall')?.item;
    const group = {
      id: `group-${n}`,
      name: typed || `ASSEMBLY ${n}`,
      fixed: fixed === true,
      stretchBehavior: fixed === true ? 'rigid' : 'item-geometry',
      members,
      // The first wall's settings ride the assembly, so a later change to the
      // assembly has something to change FROM. Null when it holds no wall.
      wallSettings: firstWall ? {
        wallType: firstWall.wallType,
        baseHeight: firstWall.baseHeight,
        topHeight: firstWall.topHeight,
        refLine: firstWall.refLine,
      } : null,
    };
    drawing.groups.push(group);
    drawing.nextGroupId = n + 1;
    // The new assembly is what is selected afterwards -- all of it, which is
    // also the drafter's confirmation that it took.
    setSelection(itemsOfGroup(group));
    assemblyName = '';
    closeAssemblyDialog();
    markDirty();
    paint();
  };

  const ungroupSelected = () => {
    const going = selectedGroups();
    if (!going.length) return;
    const ids = new Set(going.map(group => group.id));
    // THE ITEMS SURVIVE; only the grouping goes. Ungroup is not delete, and
    // the members stay selected so the drafter can see what they just freed.
    drawing.groups = groups().filter(group => !ids.has(group.id));
    syncAssembly();
    markDirty();
    paint();
  };

  // ── THE ASSEMBLY KEY: Y, PICK, AND Y / ENTER / DOUBLE-CLICK ─────────────
  //
  // Movie, 18 Oct: "press Y first and THEN puts them into select mode the
  // items and THEn press ENTER or DOUBLE CLICK or press Y again to close the
  // assembly as one new unit with the items within moving, copy rotate as one
  // unit". So arming ASSEMBLY keeps whatever is already selected, every click
  // adds (or, on something already in, takes out) and a box adds what it
  // catches; any of the three closers makes one FIXED assembly of the lot.
  // Escape, or arming another tool, puts it down with nothing made.
  let assemblyClosing = false;
  const closeAssemblyKey = () => {
    if (activeTool !== 'assembly') return false;
    assemblyClosing = true;
    const n = selection.length;
    if (n) {
      createAssembly(true);
      const group = selectedGroups()[0];
      sayOnStrip(`${group?.name || 'ASSEMBLY'} made: ${n} item${n === 1 ? '' : 's'} move, copy and rotate as one. ASSEMBLY BUST breaks it.`);
    } else {
      sayOnStrip('Nothing picked, so no assembly was made.');
    }
    setTool(RESTING_TOOL);
    assemblyClosing = false;
    return true;
  };
  let assemblyWasArmed = false;
  toolListeners.push(next => {
    // Y AGAIN -- or the key pressed again -- is the column's own toggle back
    // to SELECT, so it arrives here as "assembly put down for select".
    if (assemblyWasArmed && next === RESTING_TOOL && !assemblyClosing && !assemblyEscaped) {
      assemblyWasArmed = false;
      activeTool = 'assembly';
      closeAssemblyKey();
      return;
    }
    assemblyWasArmed = next === 'assembly';
    assemblyEscaped = false;
    if (next === 'assembly') {
      sayOnStrip('ASSEMBLY: click the items to put in it (again to take one out), '
        + 'then ENTER, double-click or Y to make it one unit.');
    }
  });
  let assemblyEscaped = false;
  window.addEventListener('keydown', event => {
    if (activeTool !== 'assembly') return;
    const el = event.target;
    if (el && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName))) return;
    if (event.key === 'Escape') {
      assemblyEscaped = true;
      setTool(RESTING_TOOL);
      sayOnStrip('ASSEMBLY put down; nothing was made.');
      return;
    }
    if (event.key === 'Enter' && !event.ctrlKey && !event.altKey && !event.metaKey) {
      event.preventDefault();
      event.stopImmediatePropagation();
      closeAssemblyKey();
    }
  }, true);
  // A DOUBLE-CLICK IS TWO CLICKS FIRST, and the second took back out what
  // the first put in -- so whatever is under it goes back in before closing.
  canvas.addEventListener('dblclick', e => {
    if (activeTool !== 'assembly') return;
    const rect = canvas.getBoundingClientRect();
    const hit = hitAt(toWorld(e.clientX - rect.left, e.clientY - rect.top));
    if (hit && !selection.some(entry => entry.item === hit.item)) {
      const owner = groupOf(hit);
      const whole = owner ? itemsOfGroup(owner) : withGroup(hit);
      setSelection(selection.concat(whole.filter(w => !selection.some(entry => entry.item === w.item))));
    }
    closeAssemblyKey();
  });

  let assemblyName = '';
  let assemblyDialogOpen = false;
  let syncAssembly = () => {};
  const closeAssemblyDialog = () => { assemblyDialogOpen = false; syncAssembly(); };

