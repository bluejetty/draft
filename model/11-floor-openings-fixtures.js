// MODEL.html's page script, part 11 of 17: the FLOOR tool, windows and doors, the wall panel, the washrooms, fixtures and kitchens, premade designs.
//
// Stage 2 of the split (Movie, 24 Oct: "how can we reduce the MODEL.html
// size in a nice organized way"): the one script the page carried, cut
// at its own section headings and moved here verbatim, in order. The
// parts load one after another as classic scripts and share one scope,
// as they did inside the page; the indent is the page's, kept so every
// line reads as it did there.

  // ── THE FLOOR TOOL: a closed loop, and what it saves as ──────────────────
  //
  // The parity row read "Draw a floor -- absent, must-have: it paints floors it
  // cannot create", which is this page's recurring shape: the painter arrived
  // with tier 1 and the gesture did not.
  //
  // THE SAME GESTURE AS THE OUTLINE, deliberately -- press corners, close on
  // the first. That is MODEL.dc.html's floor gesture too
  // (_handleFloorClick:11572), so a drafter who has learnt one has learnt
  // both. What is NOT shared is the state; see floorCorners.
  //
  // OUT OF SCOPE AND ABSENT RATHER THAN HALF-DONE: the typed-length ruler, arc
  // edges, the slope and thickened-edge properties, and the FLOOR JOISTS box.
  // Each is a panel of its own and none of them is the gesture.
  // A LOOP'S CORNER READS THE MAGNET AS A WALL'S POINT DOES (Movie, 19 Oct:
  // "the lines / walls / areas / floors/ roofs etc to all act in this way"):
  // a node in reach, else a face, else where it was pressed. TOY keeps its
  // raw press, as it keeps its own law everywhere.
  // THE LOOP'S LAST CORNER, PRESSED AGAIN, is the second click of a double
  // (the loop rule at seriesKeyPress), not a corner on top of a corner.
  const loopTailIs = (corners, pt) => {
    const tail = corners[corners.length - 1];
    return !!tail && Math.abs(tail.x - pt.x) < 1e-6 && Math.abs(tail.z - pt.z) < 1e-6;
  };
  // THE T-SQUARE AND THE MAGNET ON A FLOOR'S CORNERS TOO (Movie, 23 Oct:
  // "the FLOORING , the T and NODES don't seem to work"): from the corner
  // before it, a loop's next corner is drawPoint's, as a wall run's next
  // point is -- squared, snapped along the square, by the foot when lit.
  const loopPoint = (at, corners = activeTool === 'floor' ? floorCorners : activeTool === 'shape' ? shapeCorners : []) => {
    const ref = refPoint(at);
    if (ref) return { x: ref.x, z: ref.z };
    if (board === 'toy') return { x: at.x, z: at.z };
    const last = corners[corners.length - 1];
    if (last && !drawStart) {
      drawStart = { x: last.x, y: 0, z: last.z };
      try { const p = drawPoint(at); return { x: p.x, z: p.z }; } finally { drawStart = null; }
    }
    const corner = cornerSnap(at, []);
    if (corner) return { x: corner.x, z: corner.z };
    const snap = drawSnap(at);
    return snap.pt ? { x: snap.pt.x, z: snap.pt.z } : { x: at.x, z: at.z };
  };
  // A LOOP IN HAND TAKES A TYPED LENGTH for its next corner (typedLoopCorner).
  // Here, ahead of the strip that asks it and the box that answers it.
  // A DOUBLE-CLICK ON THE FIRST CORNER CLOSES ON ITS FIRST CLICK, and with the
  // tool staying up its second click would start the next loop right there.
  // So the press that lands back on the corner just closed, straight after,
  // is the double's second click, not a corner.
  const LOOP_REPRESS_MS = 500;
  let loopClosedAt = null;
  const markLoopClosed = first => { loopClosedAt = { x: first.x, z: first.z, when: Date.now() }; };
  const loopRepress = (corners, here) => {
    const was = loopClosedAt;
    loopClosedAt = null;
    return !!was && !corners.length && Date.now() - was.when < LOOP_REPRESS_MS
      && Math.hypot(here.x - was.x, here.z - was.z) <= OUTLINE_CLOSE_FT;
  };
  const loopCornersInHand = () => (activeTool === 'floor' ? floorCorners
    : activeTool === 'shape' ? shapeCorners : null);
  const loopTypable = () => !!(loopCornersInHand()?.length && cursorWorld);
  const floorPress = at => {
    const here = loopPoint(at);
    if (loopRepress(floorCorners, here)) return;
    // THREE CORNERS BEFORE CLOSING IS LEGAL and two is not, for the reason the
    // outline's own guard gives: two enclose no area. Below three, a press near
    // the first corner is a drafter putting a corner there.
    if (floorCorners.length >= 3) {
      const first = floorCorners[0];
      if (Math.hypot(here.x - first.x, here.z - first.z) <= OUTLINE_CLOSE_FT) {
        commitFloor();
        return;
      }
    }
    if (loopTailIs(floorCorners, here)) return;
    floorCorners.push(here);
    paint();
  };

  // ── SHAPE ─────────────────────────────────────────────────────────────────
  // A closed outline of the drafter's own, corner by corner, closed on the
  // first corner -- the FLOOR gesture, saving a SHAPE. Movie, 1 Oct: a
  // secondary suite is measured by "outlining the location of the suite (make
  // a shape and use that shape for the area)". A crossed loop is refused, as
  // the outline and the floor refuse one.
  const shapePress = at => {
    const here = loopPoint(at);
    if (loopRepress(shapeCorners, here)) return;
    if (shapeCorners.length >= 3) {
      const first = shapeCorners[0];
      if (Math.hypot(here.x - first.x, here.z - first.z) <= OUTLINE_CLOSE_FT) {
        commitShape();
        return;
      }
    }
    if (loopTailIs(shapeCorners, here)) return;
    shapeCorners.push(here);
    paint();
  };

  const commitShape = () => {
    const loop = shapeCorners.slice();
    if (loop.length < 3) return null;
    if (window.DraftGeometry2D.selfIntersects(loop)) {
      sayOnStrip('That shape crosses itself, so it encloses no area.');
      return null;
    }
    const { levelId } = onActiveLevel();
    drawing.shapes = drawing.shapes || [];
    const shape = addItem(drawing.shapes, {
      id: newDrawingItemId('shape'),
      points: loop,
      levelId,
      sourceLevelId: null,
      flooring: null,
      layer: 'SHAPE',
    });
    shapeCorners = [];
    markLoopClosed(loop[0]);
    // SELECTED, so its PROPERTIES -- the SECONDARY SUITE tick -- are up.
    // AND THE TOOL STAYS UP (Movie, 25 Oct: "i think tools stay on rather than
    // go to select"), as WALL's and LINE's do: the next press starts the next.
    selectPlaced('shape', shape);
    sayOnStrip('SHAPE closed. Tick SECONDARY SUITE in PROPERTIES if this is the suite, or press for the next shape.');
    return shape;
  };

  // WHAT A FLOOR RECORD IS, in one place. The gesture below and the premade
  // build both make one, and a second copy of these seven fields is how a
  // drawn floor and a built one come to disagree about what a floor IS.
  //
  // A CONCRETE SLAB IS AS THICK AS ITS LEVEL POURS; a framed floor is its
  // assembly's own depth. Both are MODEL.dc.html:11641's rule read from the
  // modules it reads them from -- this page has no floor-thickness setting of
  // its own, and inventing one here would be a third number for a thing that
  // has just stopped having three. assemblyFor IS this page's one
  // level-assembly lookup, and its own comment says why there is exactly one.
  const floorRecord = (loop, levelId, homeView, { garage = false } = {}) => {
    const LA = window.DraftLevelAssembly;
    const slab = homeView === 'foundation';
    return {
      id: newDrawingItemId('floor'),
      points: loop.map(point => ({ x: point.x, y: 0, z: point.z })),
      levelId,
      view: homeView,
      structure: slab ? 'slab' : 'floor',
      garage,
      slopeInPerFt: 0,
      thickness: slab
        ? assemblyFor(levelId).slabThicknessIn / 12
        : LA.DEFAULT_FLOOR_THICKNESS_IN / 12,
      thickenedEdge: false,
      assembly: { ...LA.DEFAULT_FLOOR_ASSEMBLY },
    };
  };

  const commitFloor = () => {
    const loop = floorCorners.slice();
    if (loop.length < 3) return null;
    // A CROSSED LOOP ENCLOSES NO AREA -- the same refusal the outline makes
    // on this page, through the same module. The pending corners are KEPT on a
    // refusal so the drafter can move the last one rather than retrace the room.
    //
    // AND THIS IS AN ADDITION, NOT PARITY, which is worth saying plainly: the
    // old page's _finishFloor checks the corner COUNT and nothing else, so a
    // bowtie drawn there commits and renders as two triangles with a fill that
    // fights itself. The outline tool here already refuses one, and a page
    // where the same gesture is legal for a guide and illegal for structure
    // would be teaching two rules for one motion.
    if (window.DraftGeometry2D.selfIntersects(loop)) {
      sayOnStrip('That floor crosses itself, so it encloses no area.');
      return null;
    }
    const LV = window.DraftLayerViews;
    const LA = window.DraftLevelAssembly;
    const { levelId, viewId } = onActiveLevel();
    // WHERE IT SAVES IS NOT WHERE IT WAS DRAWN, and layer-views.js owns that
    // rule. The surprising half is the second clause: a level that HAS a
    // foundation set puts its floor there whichever set the drafter was
    // looking at, because such a level's floor IS its foundation.
    const homeView = LV.floorHomeView(viewId, levelId);
    const slab = homeView === 'foundation';
    const floor = floorRecord(loop, levelId, homeView);
    if (!Array.isArray(drawing.floors)) drawing.floors = [];
    drawing.floors.push(floor);
    undoStack.push({ kind: 'add-item', list: drawing.floors, item: floor });
    floorCorners = [];
    markLoopClosed(loop[0]);
    // THE TOOL STAYS UP for the next floor (Movie, 25 Oct), as SHAPE's does.
    // THE MESSAGE HAS TO SAY WHERE IT WENT WHEN IT WENT SOMEWHERE ELSE.
    // floorHomeView's second clause files a floor drawn on FOUNDATION's WALLS
    // plan onto the FOUNDATION set, which is right -- and from the drafter's
    // seat it means the slab they just closed is nowhere on the sheet in front
    // of them. The old page softens that with a courtesy set (_courtesyFloorIds)
    // that keeps such a floor on screen until the layer set changes; this page
    // has no courtesy set and is not being given one on this rung, so it OWES
    // the drafter the sentence instead. A silent vanish is the one outcome
    // that reads as the tool having failed.
    const homeLabel = (LV.layerViewsForLevelId(levelId)
      .find(view => view.id === homeView) || {}).label || homeView;
    sayOnStrip(homeView === viewId
      ? (slab ? 'Slab drawn — it saves to S-SLAB.' : 'Floor drawn.')
      : `${slab ? 'Slab' : 'Floor'} drawn — it belongs to ${homeLabel}, `
        + 'so it is not on this layer set.');
    markDirty();
    paint();
    return floor;
  };

  // ── PLACING A WINDOW OR A DOOR ───────────────────────────────────────────
  //
  // Movie, 18 Sep, asking for the bungalow's openings: "please windows and
  // doors into the bungalow and i'll change them if i need to afterwards".
  // The design's eleven arrived that day and this page had no way to change
  // them -- no gesture to add one, move one or take one out. This is the first
  // of the three.
  //
  // ONE PRESS ON A WALL, which is the old page's own gesture
  // (_handleFenestrationClick:15180) and the only one a finger can make
  // without a keyboard. The press picks the nearest wall within reach and the
  // opening lands centred on the point pressed, then slides to fit.
  //
  // THE TOOL STAYS ARMED. A house has a dozen windows and resting after each
  // would cost a trip to the tool column between every one -- the old page
  // stays armed for the same reason. This is the opposite choice from FLOOR
  // and OUTLINE, and the difference is that those two gestures END: a closed
  // loop is finished, an opening is one press and the next press is the next
  // window.
  //
  // OUT OF SCOPE HERE AND EACH ITS OWN THING, exactly as the old page's
  // handler splits them: stair openings (its `stairs` type), boneyard marks on
  // a master outline, and shaped holes cut into a floor or a roof.
  const FENESTRATION_PICK_PX = 18;   // MODEL.dc.html:2198's own pick distance

  // DOOR FIRST, because the old page's state opens on 'door' (:2912) and a
  // drafter switching pages should not find the tool set to something else.
  let fenestrationType = 'door';
  // WHICH CASEMENT THE NEXT WINDOW WILL BE. Movie, 22 Sep: *"the first one
  // SINGLE CASEMENT, this one DOUBLE CASEMENT"*. A door has none, so this is
  // read only while a window is the thing being placed.
  let fenestrationCasement = 'single';
  // WHICH DOOR THE NEXT DOOR WILL BE (Movie, 1 Oct): one entry of
  // geometry-2d's DOOR_CATALOG -- a type and a style together -- and which
  // way it opens. A GARDEN's window share is held beside it.
  let fenestrationDoor = 'ext-single';
  let doorHingeFlip = false;
  let doorSwingFlip = false;
  let gardenWindowFt = null;
  let openingPanelUp = false;
  let wallPanelUp = false;

  // ── WHAT THE NEXT OPENING WILL MEASURE ──────────────────────────────────
  //
  // A WIDTH PER TYPE, one sill, one head -- the old page's own shape
  // (:2925-2930). A door and a window are different sizes of thing, and a
  // drafter who sets a 5 ft window does not mean his next door to be 5 ft
  // wide. The sill and head belong to the WALL rather than to the opening, so
  // they are single numbers.
  //
  // SESSION STATE, NOT THE DRAWING'S. The old page keeps these in component
  // state and writes none of them to the file -- drawing-format.js has no
  // rule for any of them. A page that persisted them would invent a key the
  // other page ignores, and every save would differ from the last for no edit
  // the drafter made.
  //
  // THE DEFAULTS COME FROM geometry-2d.js, which is where the openings the
  // BONE deals get theirs. Typed here and hardcoded there, a drafter's 5 ft
  // window and a bone press would disagree about what a window is.
  const openingSizes = {
    door: window.DraftGeometry2D.DEFAULT_DOOR_WIDTH_FT,
    window: window.DraftGeometry2D.DEFAULT_WINDOW_WIDTH_FT,
  };
  // ── A WINDOW HEADS AT 7'-0", A DOOR AT 6'-8" ────────────────────────────
  //
  // Movie, 21 Sep: *"on windows the top of the window should be default
  // located 7ft high from the current level floor level (if the window changes
  // size the bottom changes)"*.
  //
  // PER TYPE, exactly as the WIDTH already is above: one shared head meant a
  // door drawn after a window inherited the window's, which was harmless while
  // both defaulted to 6'-8" and stops being so now that they differ.
  //
  // AND THE SILL FOLLOWS THE HEAD. It is 2'-10" now, not 2'-6" -- the same
  // 4'-2" window the app has always drawn, hung four inches higher. Derived
  // rather than typed, so the size stays one number in geometry-2d.js.
  const openingHeads = {
    door: window.DraftGeometry2D.DEFAULT_OPENING_HEAD_FT,
    window: window.DraftGeometry2D.DEFAULT_WINDOW_HEAD_FT,
  };
  const OPENING_WINDOW_HEIGHT_FT = window.DraftGeometry2D.DEFAULT_OPENING_HEAD_FT
    - window.DraftGeometry2D.DEFAULT_WINDOW_SILL_FT;
  let openingSill = Math.max(0,
    window.DraftGeometry2D.DEFAULT_WINDOW_HEAD_FT - OPENING_WINDOW_HEIGHT_FT);

  const openingWidthFt = (type = fenestrationType) =>
    openingSizes[type === 'window' ? 'window' : 'door'];

  // A SILL BELONGS TO A WINDOW. A door's is zero by construction -- it stands
  // on the floor -- which is the old page's rule at the point of writing the
  // record rather than a second number kept beside the first.
  const openingSillFt = (type = fenestrationType) => (type === 'door' ? 0 : openingSill);
  const openingHeadFt = (type = fenestrationType) =>
    openingHeads[type === 'window' ? 'window' : 'door'];

  const OPENING_TYPES = Object.freeze([['door', 'DOOR'], ['window', 'WINDOW']]);
  // THE FACES ARE SHORT AND THE ROW SAYS CASEMENT, so the two read together as
  // "CASEMENT: SINGLE | DOUBLE" in a rail that is 277px at its widest. The
  // VOCABULARY behind them is drawing-format.js's -- these are only what the
  // drafter sees.
  const CASEMENT_CHIPS = Object.freeze([['single', 'SINGLE'], ['double', 'DOUBLE']]);

  // A TYPED DIMENSION, parsed by the app's own reader. formatters.js's
  // parseArchitecturalLength takes 3, 3', 3-6, 3'-6", 42" and the rest, and
  // answers {ok, inches} or {ok:false, error} -- so the field never has to
  // know what a valid dimension looks like, which is the whole reason that
  // parser is shared.
  //
  // COMMITTED ON BLUR AND ON ENTER, REVERTED ON A REFUSAL. A field left
  // holding text the page did not accept is a field lying about the state:
  // the next opening would come out the old size while the box said
  // otherwise. So a bad entry says why on the strip and the box goes back to
  // the number actually in force.
  // ── A DOOR OR WINDOW SIZE ON A METRIC DRAWING IS MILLIMETRES ───────────
  //
  // Movie, 1 Oct: *"is it possible to adjust the window and door / fixture
  // dimensions to metric / back to imperial?"* -- *"when the METRIC button
  // hit"*. The size boxes show 915 where they showed 3'-0", and a BARE NUMBER
  // typed into one means millimetres, the way a bare number means inches on
  // an imperial drawing. `m` reads metres; anything else -- 3'-0", 36" --
  // still goes to the imperial reader, so a drafter who thinks in feet is
  // never refused.
  //
  // Only the boxes that take inches on an imperial drawing (`inches: true`:
  // the door and window boxes). A wall or a floor keeps its feet.
  const metricSizes = () => drawing?.units === 'metric' && !!window.DraftFenLabels;
  const sizeText = ft => (metricSizes()
    ? `${window.DraftFenLabels.mmTo(ft, 5)} mm`
    : window.DraftFormatters.formatArchitecturalInches(ft * 12));
  const parseMetricSize = text => {
    const m = String(text ?? '').trim().match(/^(\d+(?:\.\d+)?)\s*(mm|m)?$/i);
    if (!m) return null;
    const mm = Number(m[1]) * (m[2] && m[2].toLowerCase() === 'm' ? 1000 : 1);
    if (!(mm > 0)) return { ok: false, error: `${text} is not a size.` };
    return { ok: true, inches: mm / 25.4 };
  };

  const propField = (label, valueFt, commit, redraw, { inches = false } = {}) => {
    const F = window.DraftFormatters;
    const metric = inches && metricSizes();
    const row = document.createElement('div');
    row.dataset.propRow = label.toLowerCase();
    const name = document.createElement('div');
    name.className = 'props-title';
    name.textContent = label;
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'prop-field';
    input.dataset.propField = label.toLowerCase();
    // NULL IS "THEY DO NOT AGREE", which only a selection of several can be.
    // An empty box with a dash behind it says so; showing the first one's
    // number would be a claim about all of them, and typing over it is how
    // the drafter says "all of these, this".
    const shown = () => (valueFt == null ? ''
      : metric ? String(window.DraftFenLabels.mmTo(valueFt, 5))
        : F.formatArchitecturalInches(valueFt * 12));
    input.value = shown();
    if (valueFt == null) input.placeholder = '\u2014';
    input.setAttribute('aria-label', label);
    const apply = () => {
      // A disagreeing field left untouched is not an edit. Without this an
      // empty box would go through the parser on every blur and refuse,
      // putting an error on the strip for a drafter who typed nothing.
      if (valueFt == null && !input.value.trim()) return;
      // FEET FIRST, THE SAME AS EVERY OTHER BOX (Movie, 20 Oct: "make it the
      // same format as th other ones where it 1-6 or 0-18 would be the same.
      // (would need to type feet first before inches)"). Since 1 Oct a bare
      // number in a door or window box had been inches; it is feet again, so
      // 3 is 3'-0" here as in the LENGTH box, and 1-6, 0-18, 3' and 36" read
      // as they always did.
      //
      // A METRIC BOX LEFT AS IT WAS SHOWN IS NOT AN EDIT. It shows the size
      // to the nearest 5 mm, so committing it back would move a 36" window to
      // 915 mm -- 36.02" -- on every blur, a change nobody made.
      if (metric && input.value.trim() === shown()) return;
      const parsed = (metric && parseMetricSize(input.value))
        || F.parseArchitecturalLength(input.value);
      if (!parsed.ok) {
        sayOnStrip(parsed.error);
        input.value = shown();
        return;
      }
      const refusal = commit(parsed.inches / 12);
      if (refusal) sayOnStrip(refusal);
      // REDRAWN FROM THE STATE EITHER WAY, so the box shows what is in force
      // rather than what was typed -- 3.5 comes back as 3'-6".
      redraw();
    };
    input.addEventListener('blur', apply);
    input.addEventListener('keydown', event => {
      if (event.key === 'Enter') { event.preventDefault(); input.blur(); }
    });
    row.append(name, input);
    return row;
  };

  // The opening panel's own fields, which is what the above WAS until walls
  // needed the same row. Only the redraw differs: this panel knows its name.
  const openingField = (label, valueFt, commit) =>
    propField(label, valueFt, commit, showOpeningProps, { inches: true });

  // A LIST AS A DROPDOWN, for when the choices outgrow a row of chips -- the
  // door list is ten long and the rail is 277px.
  const propSelect = (label, options, current, pick) => {
    const row = document.createElement('div');
    row.dataset.propRow = label.toLowerCase();
    const name = document.createElement('div');
    name.className = 'props-title';
    name.textContent = label;
    const select = document.createElement('select');
    select.className = 'prop-field';
    select.dataset.propSelect = label.toLowerCase();
    select.setAttribute('aria-label', label);
    options.forEach(([id, face]) => {
      const option = document.createElement('option');
      option.value = id;
      option.textContent = face;
      if (id === current) option.selected = true;
      select.append(option);
    });
    if (current == null) select.selectedIndex = -1;
    select.addEventListener('change', () => pick(select.value));
    row.append(name, select);
    return row;
  };

  // A catalog entry's sizes as chips. A garage door's carry a height, so
  // its faces read the way Movie marks one, in feet: 8W × 8H, 16W × 7H.
  // Every other door's are inches. No unit mark on either (Movie, 1 Oct: "the
  // user will understand what it represents without seeing the unit").
  const doorSizeKey = (entry, widthFt, headFt) => (entry.type === 'garage'
    ? `${widthFt}x${headFt}` : String(Math.round(widthFt * 12)));
  //
  // ON A METRIC DRAWING THE FACES ARE MILLIMETRES, the same numbers the tag
  // will print (fen-labels.js rounds both): 915, 4880W × 2440H. The KEYS stay
  // in the catalog's own units, since they name an entry and not a reading.
  const doorSizeChips = entry => {
    const FL = window.DraftFenLabels;
    const metric = drawing?.units === 'metric' && FL;
    return entry.sizes.map(size => (entry.type === 'garage'
      ? [`${size.widthFt}x${size.heightFt}`, metric
        ? `${FL.mmTo(size.widthFt, 10)}W × ${FL.mmTo(size.heightFt, 10)}H`
        : `${size.widthFt}W × ${size.heightFt}H`]
      : [String(Math.round(size * 12)),
        metric ? String(FL.mmTo(size, 5)) : String(Math.round(size * 12))]));
  };
  const doorSizeFromKey = (entry, key) => {
    if (entry.type === 'garage') {
      const size = entry.sizes.find(sz => `${sz.widthFt}x${sz.heightFt}` === key);
      return size ? { widthFt: size.widthFt, heightFt: size.heightFt } : null;
    }
    const inches = Number(key);
    return Number.isFinite(inches) && inches > 0 ? { widthFt: inches / 12 } : null;
  };

  // FLIP HINGE and FLIP SWING (Movie, 1 Oct: "switch door swing on the side
  // vs other side and then also outside vs inswing"). Two presses, four ways
  // a door can hang; the chip is lit while its flip is on.
  const doorHandRow = (hingeFlip, swingFlip, flip) => {
    const row = document.createElement('div');
    row.dataset.propRow = 'hand';
    const name = document.createElement('div');
    name.className = 'props-title';
    name.textContent = 'OPENS';
    const chips = document.createElement('div');
    chips.className = 'chip-row';
    [['hinge', 'FLIP HINGE', hingeFlip], ['swing', 'FLIP SWING', swingFlip]].forEach(([id, face, on]) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'sel-chip';
      btn.dataset.doorFlip = id;
      btn.textContent = face;
      btn.setAttribute('aria-pressed', String(on));
      btn.addEventListener('click', () => flip(id));
      chips.append(btn);
    });
    row.append(name, chips);
    return row;
  };

  // What a placed door carries of its kind: the brush's, when it is dusting
  // one, else the DOOR list's.
  const doorRecordFields = dusting => {
    if (dusting) {
      return {
        doorType: dusting.doorType ?? null,
        doorStyle: dusting.doorStyle || 'single',
        ...(dusting.doorStyle === 'garden' ? { gardenWindowWidth: dusting.gardenWindowWidth ?? null } : {}),
        hingeFlip: dusting.hingeFlip === true,
        swingFlip: dusting.swingFlip === true,
      };
    }
    const entry = window.DraftGeometry2D.DOOR_CATALOG.find(e => e.id === fenestrationDoor);
    if (!entry || entry.type === 'garage') return entry ? { garage: true } : {};
    return {
      doorType: entry.type,
      doorStyle: entry.style,
      ...(entry.style === 'garden' ? { gardenWindowWidth: gardenWindowFt } : {}),
      hingeFlip: doorHingeFlip,
      swingFlip: doorSwingFlip,
    };
  };

  // ── THE WALL PANEL: WHICH SIDE OF THE LINE THE WALL GOES ─────────────
  //
  // Movie, 16 Oct: "allow the user to select the 'LEFT SIDE' CENTERLINE or
  // 'RIGHT SIDE' for placement of the actual wall, based on where the LINE
  // is positioned".
  //
  // HIS WORDS NAME THE BODY'S SIDE, read along the direction of travel (first
  // press to second): LEFT SIDE puts the wall on the drafter's left of the
  // line he draws. The record's `refLine` names the FACE the line is -- 'left'
  // means the line is the wall's left face, so the body lies to the RIGHT.
  // The two vocabularies are the same fact from opposite ends, and this table
  // is the one place they meet: a label here is a side, a value is a face.
  // The selection panel's row speaks the same words (REF_LINES) so a drafter
  // never meets both senses.
  //
  // STICKY, AND THE DRAWING'S: the pick is written to drawing.wallRefLine,
  // which every drawn wall reads (wallShape) and the save keeps. The ghost
  // body in hand follows it at once, through the same wallShape.
  const WALL_SIDES = [['right', 'LEFT SIDE'], ['center', 'CENTERLINE'], ['left', 'RIGHT SIDE']];
  // THE WALL TYPE, PICKED BEFORE DRAWING (Movie, 18 Oct: "under the WALL title
  // can we put the TYPE of WALL - 2x4, 2X6, 2X8, 11.25" (6"CORE) ICF 13.25
  // (8"CORE) ICF, 8" CONC" -- "so i can select a wall type / thickness before
  // drawing"). Sticky, and the drawing's, like the side: every wall drawn
  // after takes it.
  var WALL_PANEL_TYPES = [['stud_2x4', '2X4'], ['stud_2x6', '2X6'], ['stud_2x8', '2X8'],
    ['icf', '11 1/4" ICF (6" CORE)'], ['icf_13', '13 1/4" ICF (8" CORE)'], ['concrete_8', '8" CONC']];
  const wallSideNow = () => wallShape({}).refLine;
  const showWallProps = () => {
    const P = window.ModelProps;
    if (!P) return;
    const box = document.createElement('div');
    box.append(propRow('WALL TYPE', WALL_PANEL_TYPES, wallShape({}).wallType, id => {
      drawing.activeWallType = id;
      markDirty();
      showWallProps();
      paint();
    }));
    box.append(propRow('WALL SIDE', WALL_SIDES, wallSideNow(), id => {
      drawing.wallRefLine = id;
      markDirty();
      showWallProps();
      paint();
    }));
    const note = document.createElement('div');
    note.className = 'props-title';
    note.dataset.wallSideNote = '';
    note.textContent = 'Which side of the line you draw the wall stands on, '
      + 'looking from the first press to the second. Along an inside face or an '
      + 'opening edge the wall takes the room side by itself.';
    box.append(note);
    P.set('WALL', box);
    wallPanelUp = true;
  };

  const showOpeningProps = () => {
    const P = window.ModelProps;
    if (!P) return;
    const F = window.DraftFormatters;
    const box = document.createElement('div');
    box.append(propRow('OPENING', OPENING_TYPES, fenestrationType, id => {
      fenestrationType = id;
      showOpeningProps();
    }));

    // ── PICKING A CASEMENT LOADS THE SIZE THAT TYPE COMES AT ───────────────
    //
    // Movie, 22 Sep: *"no size should stay the same (they can change it) ...
    // ya lets make that size default for that type"*. So this is the moment
    // the default applies -- on the way IN to placing one -- and the WIDTH and
    // SILL fields below still type straight over it afterwards.
    //
    // THE SILL IS DERIVED FROM THE HEAD, never carried. A double casement is
    // 3'-0" tall and heads at 7'-0" like every other window, so its sill is
    // 4'-0" BECAUSE of those two and not as a third number. That is the 21 Sep
    // ruling: the head is the datum and the bottom is what moves.
    if (fenestrationType === 'window') {
      box.append(propRow('CASEMENT', CASEMENT_CHIPS, fenestrationCasement, id => {
        fenestrationCasement = id;
        const size = window.DraftGeometry2D.casementSizeFt(id);
        openingSizes.window = size.widthFt;
        openingSill = Math.max(0, openingHeads.window - size.heightFt);
        showOpeningProps();
      }));
    }

    // ── THE DOOR: ONE LIST, THEN A SIZE, THEN WHICH WAY IT OPENS ──────────
    //
    // Movie, 1 Oct: "they won't need seperate categories when selecting the
    // door ... they can all be on big list", and the size rule -- "if the
    // STYLE changes the size should remain the same, if the TYPE changes the
    // size should go to default".
    if (fenestrationType === 'door') {
      const G = window.DraftGeometry2D;
      const entry = G.DOOR_CATALOG.find(e => e.id === fenestrationDoor) || G.DOOR_CATALOG[0];
      box.append(propSelect('DOOR', G.DOOR_CATALOG.map(e => [e.id, e.label]), entry.id, id => {
        const next = G.DOOR_CATALOG.find(e => e.id === id);
        if (!next) return;
        if (next.type !== entry.type) {
          openingSizes.door = next.defaultFt;
          openingHeads.door = next.defaultHeightFt || G.DEFAULT_OPENING_HEAD_FT;
        }
        fenestrationDoor = id;
        gardenWindowFt = null;
        showOpeningProps();
      }));
      box.append(propRow('SIZE', doorSizeChips(entry), doorSizeKey(entry, openingSizes.door, openingHeads.door), key => {
        const size = doorSizeFromKey(entry, key);
        if (!size) return;
        openingSizes.door = size.widthFt;
        if (size.heightFt) openingHeads.door = size.heightFt;
        gardenWindowFt = null;
        showOpeningProps();
      }));
      if (entry.style === 'garden') {
        const split = G.gardenSplitFt({ width: openingSizes.door, gardenWindowWidth: gardenWindowFt });
        box.append(openingField('DOOR WIDTH', split.doorFt, feet => {
          if (!(feet > 0)) return 'The door needs a width greater than zero.';
          gardenWindowFt = split.windowFt;
          openingSizes.door = feet + split.windowFt;
          return null;
        }));
        box.append(openingField('WINDOW WIDTH', split.windowFt, feet => {
          if (!(feet > 0)) return 'The window needs a width greater than zero.';
          gardenWindowFt = feet;
          openingSizes.door = split.doorFt + feet;
          return null;
        }));
      }
      if (entry.type !== 'garage') {
        box.append(doorHandRow(doorHingeFlip, doorSwingFlip, which => {
          if (which === 'hinge') doorHingeFlip = !doorHingeFlip;
          else doorSwingFlip = !doorSwingFlip;
          showOpeningProps();
        }));
      }
    }

    // WIDTH IS PER TYPE, so the field edits the one the drafter is holding.
    box.append(openingField('WIDTH', openingWidthFt(), feet => {
      if (!(feet > 0)) return 'An opening needs a width greater than zero.';
      openingSizes[fenestrationType === 'window' ? 'window' : 'door'] = feet;
      return null;
    }));

    // NO SILL FIELD ON A DOOR, because a door has no sill to set -- it stands
    // on the floor. Offering a box that the record then ignores would be the
    // panel telling the drafter something about the page that is not true.
    if (fenestrationType === 'window') {
      box.append(openingField('SILL', openingSill, feet => {
        if (feet < 0) return 'A sill cannot be below the floor.';
        if (feet >= openingHeadFt()) {
          return `A sill at ${sizeText(feet)} is not `
            + `below the head at ${sizeText(openingHeadFt())}.`;
        }
        openingSill = feet;
        return null;
      }));
    }

    box.append(openingField('HEAD', openingHeadFt(), feet => {
      // THE HEAD MUST STAND ABOVE THE SILL IT IS PAIRED WITH, and the pairing
      // is per type: a door's sill is zero whatever the window's is, so the
      // comparison asks openingSillFt rather than the stored window number.
      const sill = openingSillFt();
      if (!(feet > sill)) {
        return `A head at ${sizeText(feet)} is not `
          + `above the sill at ${sizeText(sill)}.`;
      }
      openingHeads[fenestrationType === 'window' ? 'window' : 'door'] = feet;
      return null;
    }));

    // WHAT THE NEXT PRESS WILL MAKE, spelled out -- kept now that the numbers
    // are typeable, because the fields show three values separately and this
    // is the one line that says what they add up to.
    const note = document.createElement('div');
    note.className = 'props-title';
    note.dataset.openingNote = '';
    const doorName = fenestrationType === 'door'
      ? `${(window.DraftGeometry2D.DOOR_CATALOG.find(e => e.id === fenestrationDoor) || {}).label || 'DOOR'} ` : '';
    note.textContent = `${doorName}${sizeText(openingWidthFt())} WIDE, `
      + `SILL ${sizeText(openingSillFt())}, `
      + `HEAD ${sizeText(openingHeadFt())}`;
    box.append(note);
    P.set('FENESTRATION', box);
    openingPanelUp = true;
  };

  // The wall nearest the press, with how far along it the press landed.
  // SEPARATE FROM wallAt(), which uses the SELECT grab distance: this one is
  // the old page's 18px fenestration pick, and the two numbers are different
  // there for a reason -- an opening is aimed at a wall FACE, a selection at a
  // wall LINE.
  const wallForOpening = worldPt => {
    const G = window.DraftGeometry2D;
    const thresh = FENESTRATION_PICK_PX / view.scale;
    let best = null, bestD = thresh;
    walls().forEach(wall => {
      if (!wall.start || !wall.end) return;
      const { d, t } = G.pointToSegment(worldPt, wall);
      if (d < bestD) { bestD = d; best = { wall, t }; }
    });
    return best;
  };

  // ── THE FIXTURE TOOL ─────────────────────────────────────────────────────
  //
  // WHY THIS PAGE DID NOT HAVE ONE, and it is not that nobody got to it. The
  // page has DRAWN fixtures since fixture-geometry.js landed and carries them
  // through save untouched, so a kitchen drawn on MODEL.dc.html opens here
  // correctly and simply cannot be added to. That is a quiet gap: nothing
  // looks broken, the drawing is right, and the tool key was already on the
  // column -- enabled on the drafting board, arming `activeTool = 'fixture'`
  // -- with no gesture reading it. Pressing it did nothing at all.
  //
  // FIT-OUT is what forced it. A kitchen is roughly seven fixtures and a
  // cabinet is one, so a CABINET cannot be an assembly until a cabinet can be
  // placed. See RD-DOCUMENTS/ORDER-tiers-of-assembly.md.
  //
  // NOTHING BELOW IS NEW MATHS. The old page's _fixturePlacement composed two
  // private helpers (_distToLineSeg, _wallFrame); both are shared modules now,
  // so this is `pointToSegment` and `wallFrame` called in order. The catalogue
  // is fixture-kinds.js, which is the old page's array moved rather than
  // retyped.
  const FIXTURE_PICK_PX = 30;          // MODEL.dc.html:2200, the same grab zone
  // ONE LAYER FOR ALL OF IT: cabinets and vanities ride A-FIXT with the sink
  // in them, since a thing cannot sit on two layers
  // (Movie, 1 Oct: "maybe we only need A-FIXT and the CASE stuff can go in there").
  const FIXTURE_LAYER = 'A-FIXT';

  // Which catalogue entry the tool is holding, and -- for the three kinds that
  // take two clicks -- where the first one landed.
  let fixtureKindId = 'cabinet';
  let fixtureRunStart = null;          // { wallId, along, side }
  let syncFixturePanel = () => {};

  const fixtureKind = () => window.DraftFixtureKinds.kindFor(fixtureKindId);

  // THE WALL UNDER THE PRESS, plus where along it and WHICH FACE.
  //
  // `side` is the half of the wall the cursor is on, measured across the
  // wall's own frame rather than in world space -- so it stays correct for a
  // wall drawn right-to-left, and for a `refLine` that puts the centreline off
  // the middle. The old page compared against the frame's mid-offset for
  // exactly that reason and this keeps the comparison rather than simplifying
  // it to a sign test, which would be wrong for a left- or right-referenced
  // wall.
  // THE REACH IS THE FIXTURE'S OWN DEPTH as well as the grab zone (Movie,
  // 19 Oct: "i can't insert WASHER or DRYER"). A drafter presses where the
  // machine will STAND, which for a 27" washer is over a foot off the wall's
  // centreline -- and at the zoom a room is drawn at, 30px is about a foot and
  // a half, so the press read as "near no wall" however close to the wall it
  // looked. `reachFt` is measured from the centreline: the depth plus half a
  // thick wall.
  const fixturePlacement = (worldPt, reachFt = 0) => {
    const G = window.DraftGeometry2D;
    const FG = window.DraftFixtureGeometry;
    if (!G || !FG) return null;
    const thresh = Math.max(FIXTURE_PICK_PX / view.scale, reachFt);
    let best = null, bestD = thresh;
    walls().forEach(wall => {
      if (!wall.start || !wall.end) return;
      const { d, t } = G.pointToSegment(worldPt, wall);
      if (d < bestD) { bestD = d; best = { wall, t }; }
    });
    if (!best) return null;
    const frame = FG.wallFrame(best.wall);
    if (!frame) return null;
    const relX = worldPt.x - best.wall.start.x;
    const relZ = worldPt.z - best.wall.start.z;
    const across = relX * frame.nx + relZ * frame.nz;
    return {
      wall: best.wall,
      frame,
      along: best.t * frame.len,
      side: across >= (frame.startOff + frame.endOff) / 2 ? 1 : -1,
    };
  };

  // ONE BUILDER, so a run and a single click cannot file two different record
  // shapes -- the lesson placeOpening states one screen up, and the reason the
  // brush's press goes through it rather than minting its own.
  //
  // THE HOST WALL'S LEVEL AND VIEW, for placeOpening's reason: a fixture sits
  // against a wall and belongs wherever that wall is drawn. Filing it under
  // whatever the drafter happens to have open would hide it from its own wall.
  //
  // `layer` is written here even though drawing-format.js can derive it from
  // the kind, because this page has no serializer between the push and the
  // file: a record that is only right after a reload is a file that is wrong
  // until then.
  // THE HALF INCH OFF A CROSSING WALL (fixture-geometry settleWallGaps):
  // every piece, or run of pieces, an end of which meets a crossing wall
  // slides to stand exactly WALL_GAP_FT off its face. What moved, as 'props'
  // undo edits for the caller to fold into its own step.
  const settleFixtureGaps = () => {
    const FG = window.DraftFixtureGeometry;
    if (!FG?.settleWallGaps || !drawing) return [];
    return FG.settleWallGaps(drawing.walls || [], drawing.fixtures || []).map(({ fixture, offset }) => {
      const before = { ...fixture };
      fixture.offset = offset;
      return { item: fixture, before };
    });
  };
  const addFixture = (kind, wall, props) => {
    const record = {
      id: newDrawingItemId('fixture'),
      wallId: wall.id,
      levelId: wall.levelId,
      view: wall.view || 'plan',
      kind: kind.id,
      layer: FIXTURE_LAYER,
      depth: kind.depthFt,
      ...props,
    };
    if (!Array.isArray(drawing.fixtures)) drawing.fixtures = [];
    drawing.fixtures.push(record);
    undoStack.push({ kind: 'add-item', list: drawing.fixtures, item: record });
    // PRESSED INTO A CORNER, IT STANDS ITS HALF INCH OFF THE OTHER WALL. Its
    // own move is part of the add; any other piece its run carried is a
    // second step, which the add's UNDO follows.
    const moved = settleFixtureGaps().filter(e => e.item !== record);
    if (moved.length) undoStack.push({ kind: 'props', edits: moved });
    sayOnStrip(`${kind.label} placed on ${record.layer} — it rides the wall it sits against.`);
    markDirty();
    paint();
    return record;
  };

  // A run is TWO presses along ONE FACE of ONE wall, and the pair sets the
  // width. Moving to another wall or round to the other face does not fail --
  // it RESTARTS, because a drafter who has changed wall has plainly changed
  // their mind, and an error there would make them press twice to do what one
  // press says.
  // CASEWORK ON TOY'S 6" GRAIN (Movie, 16 Oct: "in the TOY mode we should be
  // able to add CABINETS right? ... for the CABINETS we allow those to shift
  // extra to 6" scale so we could have 1ft, 18" 24" 30" 36" 42" 48" etc").
  // Each press lands on the half foot measured from the NEARER corner of the
  // wall the cabinet backs onto, so a run can always sit flush in a corner
  // whatever the wall's length -- a TOY wall is whole feet long and either
  // corner gives the same answer; an imported wall of odd length is measured
  // from the corner the cabinet is at. Both presses on the grain means the
  // width is on it too. TOY only, and casework only (a closet is its own
  // table); and no light goes out, since nothing was typed.
  const toyCaseworkAlong = (kind, placement) => {
    const Q = window.DraftToyConstraints;
    if (board !== 'toy' || !kind.casework || !Q) return placement.along;
    const len = placement.frame.len;
    const datum = placement.along <= len / 2 ? 0 : len;
    return Math.max(0, Math.min(len, Q.onGrain(placement.along, Q.HALF_FOOT_FT, datum)));
  };
  const fixtureRunPress = (kind, placement) => {
    const start = fixtureRunStart;
    const along = toyCaseworkAlong(kind, placement);
    if (!start || start.wallId !== placement.wall.id || start.side !== placement.side) {
      fixtureRunStart = { wallId: placement.wall.id, along, side: placement.side };
      sayOnStrip(start
        ? `New ${start.wallId !== placement.wall.id ? 'wall' : 'face'} — the `
          + `${kind.label.toLowerCase()} run restarted: press the other end.`
        : `Press the other end of the ${kind.label.toLowerCase()} run along the wall.`);
      paint();
      return null;
    }
    const width = Math.abs(along - start.along);
    // THE CLOSET ASKS THE DOOR TABLE, not a number chosen here. closets.js
    // picks from the DD/D ladder and answers nothing below a D18, so "too
    // narrow" is its verdict rather than this page's guess at one.
    if (kind.id === 'closet' && !window.DraftClosets.doorFor(width)) {
      sayOnStrip('Too narrow for a closet — the smallest door is a D18: press the other end farther along.');
      return null;
    }
    if (width < 0.5) {
      sayOnStrip('Runs need at least 6" — press the other end farther along the wall.');
      return null;
    }
    fixtureRunStart = null;
    return addFixture(kind, placement.wall, {
      offset: (along + start.along) / 2, width, side: start.side,
    });
  };

  // ── THE DEFAULT WASHROOMS (Movie, 9 Oct) ──────────────────────────────────
  //
  // "make some 'default' washrooms i can select and add to the plan": WC 1
  // and WC 2 (once BATH A and B), Movie's own, and the North Point suites'
  // WC BF1 to BF5 with their closets and laundry (washroom-presets.js holds
  // what they are). Picked on the FIXTURE tool's BATH row, the whole room
  // follows the cursor -- [ and ] turn it a quarter, F mirrors it, Esc puts
  // it down -- and a press drops it: its walls, its doors, the tub, toilet
  // and vanity, the tile coming with them because a toilet stands in the room.
  //
  // THE TUB END JOINS THE HOUSE. Within 18" of the exterior wall it slides
  // flush and draws no wall of its own there -- the tub sits on the house's
  // wall ("when the bathroom is against the exterior wall it should join up
  // like this"); anywhere else that end is a 3 1/2" partition.
  //
  // ONE ASSEMBLY, ONE UNDO. The room's walls are filed as an assembly named
  // for the bath, so it moves as one; UNGROUP breaks it into pieces to edit
  // and ASSEMBLY puts a new arrangement back together (Movie: "BREAK the
  // kitchen into pieces, add new pieces or delete pieces and ASSEMBLY the
  // kitchen in new configuration"). Fixtures and the door ride their walls.
  let washroomPreset = null;           // a washroom-presets.js id, or null
  let washroomTurn = 0;                // degrees, quarter turns
  let washroomFlip = false;

  // The exterior is the house outline's walls: a wall with both ends on it.
  // A storey with no outline yet falls back to the thick walls, which is what
  // an exterior is on every house this page builds.
  const washroomExteriorWalls = () => {
    const FG = window.DraftFixtureGeometry;
    const G = window.DraftGeometry2D;
    const { levelId } = onActiveLevel();
    const outline = window.DraftBuildingBodies?.houseOutlineOn(drawing, levelId);
    const pts = outline && Array.isArray(outline.points) ? outline.points : null;
    const onOutline = pt => pts && pts.some((a, i) => {
      const b = pts[(i + 1) % pts.length];
      return G.pointToSegment(pt, { start: a, end: b }).d < 0.6;
    });
    return walls().filter(wall => {
      if (!wall.start || !wall.end) return false;
      if (pts) return onOutline(wall.start) && onOutline(wall.end);
      return (FG.wallFrame(wall)?.totalFt || 0) >= 5.4 / 12;
    });
  };

  const washroomPlacement = at => {
    const WP = window.DraftWashroomPresets;
    const FG = window.DraftFixtureGeometry;
    if (!WP || !FG || !washroomPreset || !at) return null;
    const pose = { at: { x: at.x, z: at.z }, angleDeg: washroomTurn, flip: washroomFlip };
    const snap = WP.snapToExterior(washroomPreset, pose, washroomExteriorWalls(),
      wall => FG.wallFrame(wall));
    return WP.place(washroomPreset, { ...pose, ...(snap ? { at: snap.at, ext: snap.ext } : {}) });
  };

  const dropWashroom = at => {
    const room = washroomPlacement(at);
    if (!room) return null;
    const { levelId, viewId } = onActiveLevel();
    const mark = undoStack.length;
    const byKey = {};
    const made = room.walls.map(w => {
      const wall = commitWall(w.start, w.end, { bone: false, refLine: 'center', wallType: w.wallType });
      byKey[w.key] = wall;
      return wall;
    });
    const hostOf = key => (key === 'ext' ? room.ext : byKey[key]);
    if (!Array.isArray(drawing.fixtures)) drawing.fixtures = [];
    const fixtures = room.fixtures.map(f => {
      const host = hostOf(f.host);
      if (!host) return null;
      const record = {
        id: newDrawingItemId('fixture'),
        wallId: host.id,
        levelId: host.levelId,
        view: host.view || 'plan',
        kind: f.kind,
        layer: FIXTURE_LAYER,
        offset: f.offset,
        width: f.width,
        depth: f.depth,
        side: f.side,
        ...(f.kind === 'tub' ? { endWallId: byKey[f.endWall].id, dir: f.dir } : {}),
      };
      drawing.fixtures.push(record);
      return record;
    }).filter(Boolean);
    // EVERY DOOR THE ROOM HAS, in its own style: the WC's, the closet's
    // beyond it, the laundry's two leaves, BF1's pocket.
    if (!Array.isArray(drawing.fenestrations)) drawing.fenestrations = [];
    const doors = room.doors.map(d => {
      const doorHost = hostOf(d.host);
      const door = {
        id: newDrawingItemId('fenestration'),
        wallId: doorHost.id,
        levelId: doorHost.levelId,
        view: doorHost.view || 'plan',
        type: 'door',
        layer: 'A-DOOR',
        offset: d.offset,
        width: d.width,
        sillHeight: openingSillFt('door'),
        headHeight: openingHeadFt('door'),
        casement: null,
        doorType: 'int',
        doorStyle: d.style || 'single',
        hingeFlip: d.hingeFlip,
        swingFlip: d.swingFlip,
        auto: false,
      };
      drawing.fenestrations.push(door);
      return door;
    });
    // THE ASSEMBLY: its walls, named for the bath. What rides them -- the
    // fixtures, the door -- moves with them without being members.
    const n = nextGroupNumber();
    const group = {
      id: `group-${n}`,
      name: room.name,
      fixed: false,
      stretchBehavior: 'item-geometry',
      members: made.map(wall => ({ type: 'wall', id: wall.id })),
      wallSettings: {
        wallType: made[0].wallType, baseHeight: made[0].baseHeight,
        topHeight: made[0].topHeight, refLine: made[0].refLine,
      },
    };
    drawing.groups = groups();
    drawing.groups.push(group);
    drawing.nextGroupId = 1 + n;
    // THE ROOM'S TAG, shaped to its inside faces and tiled (Movie, 23 Oct:
    // "maybe when the bathroom is dropped in they will be linked"). Its
    // corners are the inside corners, linked by their offset off the nodes
    // the centre-line walls meet at.
    drawing.roomTags = drawing.roomTags || [];
    const tagIds = drawing.roomTags.map(t => Number(t.id)).filter(Number.isInteger);
    const tagId = Math.max(0, ...tagIds, (Number(drawing.nextRoomTagId) || 1) - 1) + 1;
    drawing.nextRoomTagId = tagId + 1;
    // EACH INSIDE CORNER LINKED to the nearest wall end -- the WC's own
    // walls', or the house wall it stands against -- so the floor follows
    // the room (Movie: "when the bathroom is dropped in they will be linked").
    const inside = (room.inside || []).map(p => {
      const link = roomLinkAt({ x: p.x, z: p.z });
      return { x: p.x, z: p.z, ...(link ? { link } : {}) };
    });
    const tag = inside.length >= 3 ? addItem(drawing.roomTags, {
      id: tagId, at: { x: room.centre.x, z: room.centre.z }, levelId, view: 'plan',
      name: room.name, areaSqFt: 0, underMin: false, stamped: true, layer: ROOM_TAG_LAYER,
      points: inside, flooring: { type: 'tile' },
    }) : null;
    // ONE STEP BACK TAKES THE ROOM: the walls' own 'add' steps give way to a
    // single 'built' carrying everything the press made.
    undoStack.length = mark;
    // ITS PIECES STAND THEIR HALF INCH OFF THE WALLS THEY RUN INTO.
    const gapped = settleFixtureGaps().filter(e => !fixtures.includes(e.item));
    undoStack.push({
      kind: 'built', walls: made, outlines: [], list: null,
      openings: doors,
      items: fixtures.map(item => ({ list: drawing.fixtures, item }))
        .concat([{ list: drawing.groups, item: group }])
        .concat(tag ? [{ list: drawing.roomTags, item: tag }] : []),
    });
    if (gapped.length) undoStack.push({ kind: 'props', edits: gapped });
    sayOnStrip(`${room.name} placed${room.ext ? ' against the exterior wall' : ''} — `
      + 'one assembly: ASSEMBLY BUST to break it into pieces.');
    markDirty();
    paint();
    return { walls: made, fixtures, doors, door: doors[0], group, levelId, viewId };
  };

  // ── THE DEFAULT KITCHEN (Movie, 17 Oct) ───────────────────────────────────
  //
  // "can you make a WC and KITCHENS that are like on this plan ... call it
  // ... KITCHEN L1": the studio suite's corner L (kitchen-presets.js holds
  // what it is). Picked beside the KITCHEN title, it shows as a faint kitchen
  // in whichever corner is within reach of the cursor -- F swaps the legs,
  // Esc puts it down -- and a press files its six pieces as ordinary
  // fixtures on the corner's two walls, one undo for the lot.
  //
  // NO WALLS AND NO ASSEMBLY, unlike the washrooms: a kitchen stands against
  // walls already there, and its pieces are the drafter's to slide one by one
  // afterwards, which is what Movie asked of the old page's L PRESET too.
  let kitchenPreset = null;            // a kitchen-presets.js id, or null
  let kitchenFlip = false;
  let kitchenTurn = 0;                 // degrees, quarter turns -- open floor only

  // WHERE THE KITCHEN IN HAND WOULD GO. A corner of two walls within reach
  // takes it, as before; anywhere else it brings its own two walls (Movie,
  // 17 Oct: "not working yet like the WCs which work good"), turned by [ and
  // ], so the ghost is always under the cursor and a press always drops it.
  // `own` carries those walls when it brings them.
  const kitchenPlacement = at => {
    const KP = window.DraftKitchenPresets;
    const FG = window.DraftFixtureGeometry;
    const K = window.DraftFixtureKinds;
    if (!KP || !FG || !K || !kitchenPreset || !at) return null;
    const depthOf = kind => K.kindFor(kind).depthFt;
    const corner = KP.findCorner(walls(), at, FG);
    if (corner) return KP.place(kitchenPreset, corner, { flip: kitchenFlip, depthOf });
    const { levelId, viewId } = onActiveLevel();
    const own = KP.ownWalls(kitchenPreset, at, kitchenTurn, kitchenFlip);
    own.walls.forEach(w => { w.levelId = levelId; w.view = wallHomeView(viewId); w.id = `kitchen-${w.key}`; });
    const theirs = KP.findCorner(own.walls, own.inside, FG);
    const kitchen = theirs && KP.place(kitchenPreset, theirs, { flip: kitchenFlip, depthOf });
    return kitchen && !kitchen.refused ? { ...kitchen, own: own.walls } : null;
  };

  const dropKitchen = at => {
    const kitchen = kitchenPlacement(at);
    if (!kitchen) { sayOnStrip('That kitchen does not fit there.'); return null; }
    if (kitchen.refused) { sayOnStrip(kitchen.refused); return null; }
    if (!Array.isArray(drawing.fixtures)) drawing.fixtures = [];
    // ITS OWN WALLS FIRST, when it brought them: filed as ordinary 2x4s
    // through commitWall, the shared corner pooled into one point so it
    // mitres, and the pieces re-hosted from the stand-ins to the real walls.
    const mark = undoStack.length;
    const builtWalls = (kitchen.own || []).map(w => ({
      stand: w, wall: commitWall(w.start, w.end, { bone: false, refLine: 'center', wallType: w.wallType }),
    }));
    undoStack.length = mark;
    const hostOf = wall => (builtWalls.find(b => b.stand === wall) || { wall }).wall;
    const made = kitchen.fixtures.map(f => {
      const host = hostOf(f.wall);
      const record = {
        id: newDrawingItemId('fixture'),
        wallId: host.id,
        levelId: host.levelId,
        view: host.view || 'plan',
        kind: f.kind,
        layer: FIXTURE_LAYER,
        offset: f.offset,
        width: f.width,
        depth: f.depth,
        side: f.side,
        // AN ISLAND OR PENINSULA floats off the wall it rides, its sink and
        // dishwasher with it.
        ...(f.standoff ? { standoff: f.standoff } : {}),
      };
      drawing.fixtures.push(record);
      return record;
    });
    // ONE ASSEMBLY (Movie, 17 Oct: "each of the preselected items should be
    // all ASSEMBLY (Grouped as one item) but that can be broken apart into
    // smaller item ASSEMBLIES like Cabinet / Toilet / Stove"): its pieces,
    // and its own walls when it brought them -- then rigid, so a wall of it
    // dragged takes the whole kitchen, as a washroom's does. UNGROUP leaves
    // the pieces.
    const ownWalls = builtWalls.map(b => b.wall);
    const n = nextGroupNumber();
    const group = {
      id: `group-${n}`,
      name: kitchen.name,
      fixed: ownWalls.length > 0,
      stretchBehavior: ownWalls.length ? 'rigid' : 'item-geometry',
      preset: { kind: 'kitchen', id: kitchen.id, flip: kitchenFlip, angleDeg: kitchenTurn },
      members: ownWalls.map(wall => ({ type: 'wall', id: wall.id }))
        .concat(made.map(item => ({ type: 'fixture', id: item.id }))),
    };
    drawing.groups = groups();
    drawing.groups.push(group);
    drawing.nextGroupId = 1 + n;
    // ITS PIECES STAND THEIR HALF INCH OFF THE WALLS THEY RUN INTO.
    const gapped = settleFixtureGaps().filter(e => !made.includes(e.item));
    if (gapped.length) undoStack.push({ kind: 'props', edits: gapped });
    // ONE STEP BACK TAKES THE KITCHEN, its walls and its assembly with it.
    undoStack.push({
      kind: 'built', walls: ownWalls, outlines: [], list: null,
      items: made.map(item => ({ list: drawing.fixtures, item }))
        .concat([{ list: drawing.groups, item: group }]),
    });
    sayOnStrip(`${kitchen.name} placed ${ownWalls.length ? 'with its own two walls' : 'in the corner'} \u2014 `
      + 'one assembly: ASSEMBLY BUST to break it into pieces. One UNDO takes it all.');
    markDirty();
    paint();
    return { fixtures: made, walls: ownWalls, group };
  };

  // WHAT THIS DOES NOT DO YET, said rather than left to be discovered: the TUB
  // takes two WALLS (back, then faucet end) and the kitchen L PRESET drops
  // seven fixtures at once. Both are their own gesture on the old page and
  // neither is ported here. They are refused BY NAME below, so pressing one
  // says what is missing instead of placing the wrong thing or nothing.
  // ── A FIXTURE'S SLIDE, AN ISLAND'S MOVE (Movie, 20 Oct) ───────────────
  //
  // "i'd like to be able to move sink / dw in island back an forth / and
  // they shouldn't overlap like in the photo ... also would like to move
  // the island independantly from the wall and other cabinets". A piece
  // slides along its wall -- inside its island when it has one -- and stops
  // at a run mate, so the sink and the dishwasher touch and never overlap;
  // an island goes anywhere, along its wall and off it, its pieces riding.
  // The host wall is kept: an island is still a fixture OF a wall, its
  // aisle (standoff) now whatever the drag leaves. One 'props' step for the
  // lot on the release.
  const fixtureLabel = fixture => String(window.DraftFixtureKinds?.kindFor(fixture.kind)?.label
    || fixture.kind || 'FIXTURE').toUpperCase();
  // A FIXTURE KEPT WHEN ITS WALL WENT moves free, its kept line with it, and
  // let go against a wall it goes onto that wall (freeFixtureLand).
  const hostCopy = h => ({ ...h, start: { ...h.start }, end: { ...h.end } });
  const fixtureMoveBegin = (fixture, at) => {
    const FG = window.DraftFixtureGeometry;
    if (fixture.wallId == null && fixture.host) {
      const all = fixtures();
      const riders = fixture.kind === 'island' ? FG.islandPieces(all, fixture) : [];
      const moving = [fixture, ...riders];
      return {
        fixture, free: true, grabWorld: { x: at.x, z: at.z }, island: null,
        hostsWas: new Map(moving.map(item => [item, hostCopy(item.host)])),
        riders: riders.map(item => ({ item, offset: Number(item.offset) || 0 })),
        edits: moving.map(item => ({ item, before: { ...item } })),
        moved: false,
      };
    }
    const host = walls().find(wall => String(wall.id) === String(fixture.wallId));
    const frame = host && FG?.wallFrame(host);
    if (!frame) return null;
    const local = p => ({
      along: (p.x - host.start.x) * frame.ux + (p.z - host.start.z) * frame.uz,
      across: (p.x - host.start.x) * frame.nx + (p.z - host.start.z) * frame.nz,
    });
    const all = fixtures();
    const island = fixture.kind === 'island' ? null : FG.islandHolding(all, fixture);
    const riders = fixture.kind === 'island' ? FG.islandPieces(all, fixture) : [];
    return {
      fixture, host, frame, local, grab: local(at), island,
      was: { offset: Number(fixture.offset) || 0, standoff: Number(fixture.standoff) || 0 },
      riders: riders.map(item => ({ item, offset: Number(item.offset) || 0 })),
      edits: [fixture, ...riders].map(item => ({ item, before: { ...item } })),
      moved: false,
    };
  };
  // ITS SIDE GOES TO A NEIGHBOUR'S SIDE within an inch (Movie, 24 Oct: "can
  // you make the edges (not the 1/2" extra but the main edge of the cabinet)
  // to snap to the SIDE of the other CABINET when its within 1 inch"): the
  // pieces' own widths, never the half inch a wall stands them off. SNAP lit,
  // off TOY, as every other catch.
  const SIDE_SNAP_FT = 1 / 12;
  const sideSnap = (fixture, target, half) => {
    if (!snapLive() || board === 'toy') return target;
    let best = target, bestD = SIDE_SNAP_FT + 1e-9;
    window.DraftFixtureGeometry.runMates(fixtures(), fixture).filter(o => o.kind !== 'island').forEach(o => {
      const o0 = Number(o.offset) - Number(o.width) / 2, o1 = Number(o.offset) + Number(o.width) / 2;
      [o1 + half, o0 - half].forEach(t => {
        const d = Math.abs(t - target);
        if (d < bestD) { bestD = d; best = t; }
      });
    });
    return best;
  };
  const setStandoff = (item, standoff) => { if (standoff > 0) item.standoff = standoff; else delete item.standoff; };
  const fixtureMoveTo = (md, raw) => {
    const FG = window.DraftFixtureGeometry;
    const K = window.DraftFixtureKinds;
    if (md.free) {
      let dx = raw.x - md.grabWorld.x, dz = raw.z - md.grabWorld.z;
      if (tsquareOn && board !== 'toy') { if (Math.abs(dx) >= Math.abs(dz)) dz = 0; else dx = 0; }
      // A PIECE LEAVES ITS RUN when it moves on its own; an island takes its
      // pieces. A new line object each time, so the undo's before keeps the old.
      const own = md.fixture.kind === 'island' || !md.riders.length ? null : `free:${md.fixture.id}`;
      md.hostsWas.forEach((was, item) => {
        item.host = { ...was, ...(own && item === md.fixture ? { id: own } : {}),
          start: { x: was.start.x + dx, y: 0, z: was.start.z + dz },
          end: { x: was.end.x + dx, y: 0, z: was.end.z + dz } };
      });
      md.moved = Math.hypot(dx, dz) > 1e-6;
      return;
    }
    const { fixture, frame } = md;
    const here = md.local(raw);
    let dAlong = here.along - md.grab.along, dAcross = here.across - md.grab.across;
    const half = Math.min(Number(fixture.width) || 0, frame.len) / 2;
    if (fixture.kind === 'island') {
      // ANYWHERE: along the wall and off it, held square by the T-SQUARE as
      // the MOVE verb is -- the larger travel wins.
      if (tsquareOn && board !== 'toy') { if (Math.abs(dAlong) >= Math.abs(dAcross)) dAcross = 0; else dAlong = 0; }
      const offset = Math.min(Math.max(md.was.offset + dAlong, half + 0.01), Math.max(frame.len - half - 0.01, half + 0.01));
      const side = fixture.side === -1 ? -1 : 1;
      const standoff = Math.max(0, md.was.standoff + side * dAcross);
      fixture.offset = offset;
      setStandoff(fixture, standoff);
      md.riders.forEach(r => { r.item.offset = r.offset + (offset - md.was.offset); setStandoff(r.item, standoff); });
    } else if (fixture.kind === 'tub' && fixture.endWallId) {
      const geo = FG.tubGeometry(walls(), fixture, md.host, frame);
      if (geo) fixture.offset = Math.min(Math.max(geo.dir * (here.along - geo.face) - geo.tubLen / 2, 0), geo.gap);
    } else {
      // ALONG ITS WALL ONLY, inside its island when it has one, and never
      // over a run mate. A counter run (cabinet, vanity) is what pieces sit
      // in, so it neither blocks nor is blocked.
      const runs = item => !!K?.kindFor(item.kind)?.run;
      const bounds = md.island
        ? [Number(md.island.offset) - Number(md.island.width) / 2, Number(md.island.offset) + Number(md.island.width) / 2]
        : [0, frame.len];
      const blocks = runs(fixture) ? []
        : FG.runMates(fixtures(), fixture).filter(o => o.kind !== 'island' && !runs(o))
          .map(o => [Number(o.offset) - Number(o.width) / 2, Number(o.offset) + Number(o.width) / 2]);
      const at = FG.slideClamp(sideSnap(fixture, md.was.offset + dAlong, half), half, bounds, blocks);
      if (at != null) fixture.offset = at;
    }
    md.moved = md.edits.some(({ item, before }) => item.offset !== before.offset
      || (Number(item.standoff) || 0) !== (Number(before.standoff) || 0));
  };
  // LET GO AGAINST A WALL, A KEPT FIXTURE GOES ONTO IT: the wall its back
  // face lands on (within 9"), its middle along that wall, the side it stands
  // on -- the WALL OFF projection. An island's pieces go with it.
  const FREE_LAND_FT = 0.75;
  const freeFixtureLand = md => {
    const FG = window.DraftFixtureGeometry;
    const G = window.DraftGeometry2D;
    const geo = FG.fixtureGeometry(drawing.walls, md.fixture);
    if (!geo || !G) return null;
    // ITS BACK OR ITS FRONT: brought up front first, it turns round and
    // hangs with its back on that wall, facing the room.
    // OR EITHER SIDE (Movie, 25 Oct: "the VANITY doesn't go with its back
    // towards the wall, it seems to only get positioned this way"): a free
    // piece stands with its back to the top of the sheet, so against a wall
    // running up the sheet it is a side that meets it -- and it turns a
    // quarter to put its back there.
    const mid = (a, b) => ({ x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 });
    const c = geo.corners;
    const edges = [mid(c[0], c[1]), mid(c[2], c[3]), mid(c[1], c[2]), mid(c[3], c[0])];
    let best = null, bestD = Infinity;
    walls().forEach(wall => {
      const frame = wall.start && wall.end && FG.wallFrame(wall);
      if (!frame) return;
      edges.forEach(edge => {
        const { d } = G.pointToSegment(edge, wall);
        // THE FACE, not the centre line: half the wall's thickness counts.
        const face = Math.max(0, d - Math.max(Math.abs(frame.startOff), Math.abs(frame.endOff)));
        if (face < bestD) { bestD = face; best = { wall, frame }; }
      });
    });
    if (!best || bestD > FREE_LAND_FT) return null;
    const { wall, frame } = best;
    [md.fixture, ...md.riders.map(r => r.item)].forEach(item => {
      const g = FG.fixtureGeometry(drawing.walls, item);
      if (!g?.center) return;
      const rx = g.center.x - wall.start.x, rz = g.center.z - wall.start.z;
      const along = rx * frame.ux + rz * frame.uz;
      const across = rx * frame.nx + rz * frame.nz;
      item.wallId = wall.id;
      item.offset = Math.max(0, Math.min(frame.len, along));
      item.side = across >= (frame.startOff + frame.endOff) / 2 ? 1 : -1;
      delete item.host;
      // AGAINST THE FACE: an island keeps the aisle it stood off at.
      if (item.kind !== 'island' && !md.riders.some(r => r.item === item)) delete item.standoff;
    });
    return wall;
  };
  // AN ASSEMBLY OF PIECES ON ONE WALL, in MOVE: every one along that wall by
  // the same travel, held inside the wall, and its outer sides caught to a
  // neighbour's within an inch as one piece's are (sideSnap). The piece in
  // hand belongs to a Y ASSEMBLY of two or more fixtures and nothing else
  // (a kitchen preset's assembly has its walls in it, and its pieces still
  // move one at a time), all on one wall.
  const fixtureSetSlide = at => {
    if (!selection.length || selection.some(entry => entry.type !== 'fixture')) return null;
    const owner = groupOf(selection[0]);
    if (!owner || selection.some(entry => groupOf(entry) !== owner)) return null;
    if ((owner.members || []).some(m => m.type !== 'fixture')) return null;
    const pieces = fixtures().filter(f => owner.members.some(m => String(m.id) === String(f.id)));
    if (pieces.length < 2) return null;
    const hostId = pieces[0].wallId;
    if (hostId == null || pieces.some(p => String(p.wallId) !== String(hostId))) return null;
    const wall = walls().find(wl => String(wl.id) === String(hostId));
    const frame = wall && window.DraftFixtureGeometry?.wallFrame(wall);
    if (!frame) return null;
    return { kind: 'fixtures', at, pieces, frame, was: pieces.map(p => Number(p.offset) || 0),
      edits: pieces.map(item => ({ item, before: { ...item } })), moved: false };
  };
  const fixtureSetTo = (d, raw) => {
    const { frame, pieces, was } = d;
    let dAlong = (raw.x - d.at.x) * frame.ux + (raw.z - d.at.z) * frame.uz;
    // THE SIDES CATCH: the nearest of any piece's sides to a neighbour's
    // side outside the set, within an inch.
    if (snapLive() && board !== 'toy') {
      let best = null, bestD = SIDE_SNAP_FT + 1e-9;
      pieces.forEach((p, i) => {
        const half = (Number(p.width) || 0) / 2;
        window.DraftFixtureGeometry.runMates(fixtures(), p)
          .filter(o => o.kind !== 'island' && !pieces.includes(o)).forEach(o => {
            const o0 = Number(o.offset) - Number(o.width) / 2, o1 = Number(o.offset) + Number(o.width) / 2;
            [o1 + half, o0 - half].forEach(t => {
              const shift = t - was[i];
              if (Math.abs(shift - dAlong) < bestD) { bestD = Math.abs(shift - dAlong); best = shift; }
            });
          });
      });
      if (best != null) dAlong = best;
    }
    // INSIDE THE WALL, all of them.
    const lo = Math.max(...pieces.map((p, i) => (Number(p.width) || 0) / 2 - was[i]));
    const hi = Math.min(...pieces.map((p, i) => frame.len - (Number(p.width) || 0) / 2 - was[i]));
    dAlong = Math.min(Math.max(dAlong, lo), Math.max(hi, lo));
    pieces.forEach((p, i) => { p.offset = was[i] + dAlong; });
    d.moved = Math.abs(dAlong) > 1e-9;
  };
  // A FIXTURE LET GO, from the SELECT drag or the MOVE verb alike.
  // ONE GESTURE, ONE UNDO: a 'props' step restores each record in place,
  // the island's aisle key coming or going with it. AND LET GO BY A
  // CROSSING WALL, IT STANDS ITS HALF INCH OFF IT (settleFixtureGaps), in
  // the same step.
  const fixtureMoveRelease = md => {
    const gapIn = () => settleFixtureGaps().forEach(e => {
      if (!md.edits.some(x => x.item === e.item)) md.edits.push(e);
    });
    // THE WALL ENDS IT CARRIED come back with it on UNDO, in one step.
    const withLinks = step => (md.links?.length
      ? { kind: 'batch', steps: [step, { kind: 'move', before: md.links.map(({ vtx, x, z, offX, offZ }) => ({ vtx, x, z, offX, offZ })) }] }
      : step);
    if (md.moved && !md.free) { gapIn(); carryFixtureLinks(md); }
    if (md.moved && md.free) {
      const onto = freeFixtureLand(md);
      gapIn();
      carryFixtureLinks(md);
      undoStack.push(withLinks({ kind: 'props', edits: [...md.edits] }));
      markDirty();
      sayOnStrip(onto ? `${fixtureLabel(md.fixture)} is on that wall now. UNDO puts it back.`
        : `${fixtureLabel(md.fixture)} moved, on no wall -- let it go against one to put it on it. UNDO puts it back.`);
    } else if (md.moved) {
      undoStack.push(withLinks({ kind: 'props', edits: md.edits }));
      markDirty();
      sayOnStrip(md.fixture.kind === 'island'
        ? `ISLAND moved${md.riders.length ? ', its pieces with it' : ''}. UNDO puts it back.`
        : `${fixtureLabel(md.fixture)} slid ${md.island ? 'inside its island' : 'along its wall'}. UNDO puts it back.`);
    }
  };
  const fixturePress = at => {
    if (washroomPreset) return dropWashroom(at);
    if (kitchenPreset) return dropKitchen(at);
    const kind = fixtureKind();
    if (kind.preset === true || kind.id === 'tub') {
      sayOnStrip(`${kind.label} is not on this page yet — it takes a gesture of its own.`);
      return null;
    }
    const placement = fixturePlacement(at, kind.run ? 0 : (Number(kind.depthFt) || 0) + 0.5);
    // AWAY FROM EVERY WALL, IT DROPS FREE WHERE IT IS PRESSED (Movie, 24
    // Oct: "i can't place the INDUVIDUAL items of the kitchen items manually
    // yet - like STOVE / CABINET / or FRIDGE etc. i'l like to be able to
    // place all those so i can arrange the kitchens"): centred on the press,
    // its back to the top of the sheet, standing on a line of its own as a
    // fixture kept when its wall went does. Dragged against a wall and let
    // go, it goes onto that wall (freeFixtureLand).
    if (!placement) return freeFixturePress(kind, at);
    if (kind.run) return fixtureRunPress(kind, placement);
    // CLAMPED, NOT REFUSED, when the press lands near a corner. Null means the
    // wall cannot carry the width at all, which is a different answer and gets
    // a different sentence.
    //
    // THE FULL OPENING BEARING RESERVE, because that is what the old page does
    // -- _clampOpeningToWall (:15085) hands geometry-2d.js `walls` and
    // `thicknessFt` for a fixture exactly as it does for a window, so a
    // single-click cabinet is held off a corner by whatever carries that end
    // plus the header bearing. `thicknessFt` is NOT optional: the shared
    // function throws without it rather than quietly reserving the free-post
    // figure at every end.
    //
    // WHETHER A CABINET SHOULD RESERVE HEADER BEARING AT ALL is a fair
    // question and it is NOT settled here -- a base cabinet really does run
    // into the corner, and a window's header really does need wood to sit on.
    // This is a PORT, so it matches. Two things worth knowing before anyone
    // changes it: the old page is already inconsistent about it, because a
    // cabinet RUN (below) never goes through this clamp and so may reach the
    // corner; and changing it is a product decision, which is Movie's.
    if (kind.id === 'cornerbase') return cornerPress(kind, placement);
    const G = window.DraftGeometry2D;
    // PRESSED BY A CORNER, IT GOES INTO IT, its half inch off the crossing
    // wall (Movie, 23 Oct: "the corner at the extra 1/2" point will be the
    // important point i need to attached to the corner of wall") -- not held
    // off by the header bearing a window takes. Not a toilet.
    const FGs = window.DraftFixtureGeometry;
    const intoCorner = FGs?.wallGapOf?.({ kind: kind.id })
      ? FGs.snapToWallGap(drawing.walls || [], placement.wall, placement.along, kind.widthFt) : null;
    const clamped = intoCorner != null ? { offset: intoCorner } : G.clampOpeningToWall(placement.wall, placement.along, kind.widthFt, {
      walls: walls(),
      thicknessFt: openingThicknessFt(),
    });
    if (!clamped) {
      sayOnStrip(`That wall is too short for the ${kind.label.toLowerCase()}.`);
      return null;
    }
    // A KITCHEN PIECE PRESSED BESIDE ANOTHER lands flush against it, so the
    // joint melds (render-2d snapCounterOffset; Movie, 9 Oct) -- or against
    // the end of a CORNER's leg on the other wall.
    const offset = snapToCornerLeg(placement, window.DraftRender2D.snapCounterOffset(fixtures(), {
      kind: kind.id, wallId: placement.wall.id, side: placement.side,
      offset: clamped.offset, width: kind.widthFt,
    }), kind);
    return addFixture(kind, placement.wall, {
      offset, width: kind.widthFt, side: placement.side,
    });
  };

  const freeFixturePress = (kind, at) => {
    const FG = window.DraftFixtureGeometry;
    const active = onActiveLevel();
    const width = Number(kind.widthFt) || 1;
    const id = newDrawingItemId('fixture');
    const host = { id: `free:${id}`, start: { x: at.x - width, y: 0, z: at.z }, end: { x: at.x + width, y: 0, z: at.z },
      wallType: 'stud_2x4', refLine: 'center', levelId: active.levelId, view: active.viewId || 'plan' };
    const record = { id, wallId: null, host, levelId: active.levelId, view: active.viewId || 'plan',
      kind: kind.id, layer: FIXTURE_LAYER, offset: width, width, depth: kind.depthFt, side: 1 };
    // CENTRED ON THE PRESS: its line moved by however far the piece's middle
    // stands off it.
    const geo = FG.fixtureGeometry(drawing.walls || [], record);
    if (geo?.center) {
      const dx = at.x - geo.center.x, dz = at.z - geo.center.z;
      host.start = { x: host.start.x + dx, y: 0, z: host.start.z + dz };
      host.end = { x: host.end.x + dx, y: 0, z: host.end.z + dz };
    }
    if (!Array.isArray(drawing.fixtures)) drawing.fixtures = [];
    drawing.fixtures.push(record);
    undoStack.push({ kind: 'add-item', list: drawing.fixtures, item: record });
    sayOnStrip(`${kind.label} placed free -- drag it against a wall to put it on that wall.`);
    markDirty();
    paint();
    return record;
  };

  // THE CORNER, PRESSED INTO A CORNER (Movie, 21 Oct): the crossing wall's
  // face nearest the press, within 4 ft, is the corner, and the piece sits
  // tight in it -- no header bearing held off this end, it is a cabinet in
  // the corner. Its `corner` says which of its ends stands there.
  const CORNER_REACH_FT = 4;
  const cornerPress = (kind, placement) => {
    const FG = window.DraftFixtureGeometry;
    const { wall, frame, along } = placement;
    let face = null;
    walls().forEach(other => {
      if (other === wall || !other.start || !other.end) return;
      if (String(other.levelId) !== String(wall.levelId) || (other.view || 'plan') !== (wall.view || 'plan')) return;
      const hit = FG.wallCross(wall, frame, other);
      if (!hit || hit.s < -0.05 || hit.s > 1.05) return;
      // ITS FACE NEAREST THE PRESS: the one looking into the room pressed in.
      FG.facesAlong(frame, other, hit.along).forEach(f => {
        if (f < -0.05 || f > frame.len + 0.05 || Math.abs(along - f) > CORNER_REACH_FT) return;
        if (face == null || Math.abs(along - f) < Math.abs(along - face)) face = f;
      });
    });
    if (face == null) {
      sayOnStrip('Press the CORNER near where two walls meet -- it sits tight in the corner.');
      return null;
    }
    const corner = along < face ? 1 : -1;
    const offset = face - corner * kind.widthFt / 2;
    if (offset - kind.widthFt / 2 < -0.01 || offset + kind.widthFt / 2 > frame.len + 0.01) {
      sayOnStrip('That wall is too short for the corner.');
      return null;
    }
    return addFixture(kind, wall, { offset, width: kind.widthFt, side: placement.side, corner });
  };
  // A PIECE PRESSED BY A CORNER'S LEG ON THE OTHER WALL lands against its end,
  // so the counter turns the corner whole: the leg's end edge, 28" out, is
  // where the next drawers or doors start. Within 6", as a joint snaps.
  const snapToCornerLeg = (placement, offset, kind) => {
    const FG = window.DraftFixtureGeometry;
    const half = kind.widthFt / 2;
    let best = offset, gap = 0.5;
    fixtures().forEach(fx => {
      if (fx.kind !== 'cornerbase' || String(fx.wallId) === String(placement.wall.id)) return;
      const geo = FG.fixtureGeometry(drawing.walls, fx);
      if (!geo || geo.cornerAlong == null) return;
      const m = geo.frame.at((geo.cornerAlong + geo.legAlong) / 2, geo.legOff);
      const { frame, wall } = placement;
      const rx = m.x - wall.start.x, rz = m.z - wall.start.z;
      const t = rx * frame.ux + rz * frame.uz;
      const across = rx * frame.nx + rz * frame.nz;
      const faceOff = placement.side === -1 ? frame.startOff : frame.endOff;
      // ON THIS FACE: the leg's middle stands half its depth off it.
      if (Math.abs(placement.side * (across - faceOff) - fx.depth / 2) > 0.3) return;
      [t + half, t - half].forEach(at => {
        if (Math.abs(at - offset) < gap) { best = at; gap = Math.abs(at - offset); }
      });
    });
    return best;
  };

  // A half-finished run belongs to the tool being put down, the way drawStart
  // and beamStart do -- see setTool. Carrying it across would let a cabinet run
  // started under FIXTURE finish under a later press.
  toolListeners.push(next => {
    if (next !== 'fixture') { fixtureRunStart = null; washroomPreset = null; kitchenPreset = null; }
    syncFixturePanel();
  });

  const placeOpening = at => {
    const G = window.DraftGeometry2D;
    const best = wallForOpening(at);
    if (!best) {
      sayOnStrip('Press a wall to put an opening in it.');
      return null;
    }
    // ── WHAT IS BEING PLACED: THE BRUSH'S, OR THE TOOL'S ────────────────
    //
    // Movie, 20 Sep: "if you select FENSTRATION you should be able to put new
    // windows into a WALL", and "so if there is a window in the drafting
    // brush cursor area it will change it, but if a wall it will place a
    // window or door". A brush holding an opening turns a press on bare wall
    // into a placement of THAT opening -- the target decides the verb, and
    // there is no mode to pick.
    //
    // ONE BUILDER, TWO CALLERS. The brush's press comes through here rather
    // than minting its own record: this function already finds the wall,
    // clamps to it, refuses a wall too short in the app's own words, files the
    // record on the HOST'S level and view, and pushes the undo step. A second
    // builder beside it would agree today and drift the first time either
    // moved -- which is the drift dealOpenings was pulled out of raiseLoop to
    // stop, one rung ago, in this same file.
    const dusting = brushHas('fenestration') ? brushLoad.props : null;
    const type = (dusting ? dusting.type : fenestrationType) === 'window'
      ? 'window' : 'door';
    const width = dusting ? Number(dusting.width) || 0 : openingWidthFt(type);
    const wall = best.wall;
    const length = Math.hypot(wall.end.x - wall.start.x, wall.end.z - wall.start.z);
    // CLAMPED, NOT REFUSED, when the press lands near a corner: the opening
    // slides along until its bearing fits. clampOpeningToWall returns null
    // only when the wall cannot carry the width AT ALL, which is a different
    // answer and gets a different sentence.
    const clamped = G.clampOpeningToWall(wall, best.t * length, width, {
      walls: walls(),
      thicknessFt: openingThicknessFt(),
    });
    if (!clamped) {
      brushWarn(`TOO BIG — that wall is too short to carry a ${window.DraftFormatters
        .formatArchitecturalInches(width * 12)} opening.`, { wall });
      return null;
    }
    const record = {
      id: newDrawingItemId('fenestration'),
      wallId: wall.id,
      levelId: wall.levelId,
      // THE HOST WALL'S VIEW, not the drafter's. An opening is cut into a
      // wall and belongs wherever that wall is drawn; filing it under the
      // layer set that happened to be open would hide it from its own wall.
      view: wall.view || 'plan',
      type,
      // drawing-format.js derives the layer from the type on load, so this
      // cannot come out wrong -- but this page has no serializer between the
      // push and the file, and a record that is only right AFTER a reload is
      // a file that is wrong until then.
      layer: type === 'door' ? 'A-DOOR' : 'A-GLAZ',
      offset: clamped.offset,
      width,
      sillHeight: dusting ? Number(dusting.sillHeight) || 0 : openingSillFt(type),
      headHeight: dusting ? Number(dusting.headHeight) || 0 : openingHeadFt(type),
      // A CASEMENT RIDES THE BRUSH, like the garage flag below it, and belongs
      // to a window alone -- drawing-format.js writes null on a door, and a
      // key that means nothing about the thing it is written on is worse than
      // no key. A brush loaded before this existed carries none, and falls to
      // whatever the tool is holding.
      casement: type !== 'window' ? null
        : ((dusting && dusting.casement) || fenestrationCasement),
      // AN OVERHEAD DOOR STAYS ONE THROUGH THE BRUSH. `garage` is what makes
      // it one, and it is written only when the brush is carrying it -- a
      // `garage: false` on every hand-placed window would be a key the old
      // page never wrote, in every file this page saves.
      ...(dusting && dusting.garage === true ? { garage: true } : {}),
      // THE DOOR'S TYPE, STYLE AND HAND, from the brush when it carries them
      // and from the DOOR list when it does not. A garage door is the
      // `garage` flag; the reader names its type and style from that.
      ...(type === 'door' ? doorRecordFields(dusting) : {}),
      // NOT THE BONE'S. auto-windows.js re-deals what it dealt; one the
      // drafter placed by hand is his from the moment it lands.
      auto: false,
    };
    if (!Array.isArray(drawing.fenestrations)) drawing.fenestrations = [];
    drawing.fenestrations.push(record);
    undoStack.push({ kind: 'add-item', list: drawing.fenestrations, item: record });
    sayOnStrip(`${type === 'door' ? 'Door' : 'Window'} placed on `
      + `${record.layer}.`);
    markDirty();
    paint();
    return record;
  };

  // THE ARMING, through the seam :3875 declared for exactly this. A house type
  // press records the type (that half already worked) and now arms the trace,
  // which is what _pressBuildType has always done in one motion.
  window.ModelBuild.onChoose(picked => { if (picked) armOutline(picked); });
  window.ModelBuild.onOutline(picked => armOutline(picked, { fromLink: true }));

  // ── HANGING A DESIGN'S OPENINGS ON THE WALLS IT JUST RAISED ──────────────
  //
  // ONE HOME, because there are now two builders. This lived inside raiseLoop,
  // which is how a premade bungalow gets its windows; the ordered detached
  // garage raises its four walls itself -- it mints its own outline, with its
  // own `detached: true` and the foundation the drafter picked off the tile --
  // and a second copy of the record shape here is how a `layer` or a `garage`
  // flag comes to be written two different ways by one page.
  //
  // THE EDGE INDEX IS LOOKED UP, NOT COUNTED. `wallsByEdge` is sparse on
  // purpose: an attached garage skips the edges it shares with the house, and
  // houseWallRuns drops degenerate ones. By position, the bungalow's man-door
  // would move onto the wall beside the one it belongs to and still LOOK like
  // a door on a garage. An opening keyed to an edge that raised no wall is
  // dropped rather than written against the wrong one.
  const dealOpenings = (openings, wallsByEdge, levelId) => {
    if (!Array.isArray(drawing.fenestrations)) drawing.fenestrations = [];
    return (openings || []).map(spec => {
      const wall = wallsByEdge[spec.edge];
      if (!wall) return null;
      const record = {
        id: newDrawingItemId('fenestration'),
        wallId: wall.id,
        levelId,
        // THE HOST WALL'S VIEW, not the drafter's -- an opening is cut into a
        // wall and belongs wherever that wall is drawn.
        view: wall.view || 'plan',
        type: spec.type,
        // drawing-format.js:230 derives this from the type on load, so it
        // cannot come out wrong -- but this page has no serializer between the
        // push and the file, and a record that is only right AFTER a reload is
        // a file that is wrong until then.
        layer: spec.type === 'door' ? 'A-DOOR' : 'A-GLAZ',
        offset: spec.offsetFt,
        width: spec.widthFt,
        sillHeight: spec.sillFt,
        headHeight: spec.headFt,
        // THE DESIGN SAYS WHICH CASEMENT, every time -- premade-plans.js puts
        // 'single' on an ordinary window rather than leaving the key off, so
        // there is nothing for this page to decide.
        casement: spec.casement,
        garage: spec.garage === true,
        // NOT THE BONE'S. auto-windows.js re-deals what it dealt; a design's
        // own openings are the design's, and a re-deal leaves them alone.
        auto: false,
      };
      drawing.fenestrations.push(record);
      return record;
    }).filter(Boolean);
  };

  // ── THE PREMADE DESIGN THE BOARD OFFERED ─────────────────────────────────
  //
  // Movie, 18 Sep: "we shouldn't put it in the drivethru window yet, i'd just
  // like to offer them premade designs in there at the beginning". So the
  // window's bone builds the building in the picture the drafter pressed --
  // the trace handover below is what a tile with no design yet still gets.
  //
  // THE DESIGN IS NOT DECIDED HERE. premade-plans.js holds the numbers and the
  // reasoning behind every one of them, with a harness on the arithmetic;
  // this reads points and commits them, exactly as the ordered garage reads
  // garage-site.js. A page that carried the dimensions itself would be the
  // second home of a rule, and the day the bungalow changes width the two
  // would disagree quietly.
  //
  // TWO BODIES, ONE PRESS. The bungalow with a garage raises a house loop and
  // an ATTACHED garage loop -- `garage: true` and `detached: false`, which is
  // what building-bodies.js reads to tell the attached one from the detached
  // one (:37). An attached garage is part of the house it hangs off, so it
  // does not spend the detached garage's slot.
  const raiseLoop = (points, levelId,
    { garage = false, openings = [], against = null, stackOn = null,
      viewId = 'plan', wallType = null, withOutline = true,
      baseHeight, topHeight, body } = {}) => {
    const BH = window.DraftBuildHouse;
    const G = window.DraftGeometry2D;
    const outline = {
      id: newDrawingItemId('outline'),
      masterId: null,
      levelId,
      garage,
      // SAID ON THE RECORD rather than left to the absence of a key.
      // building-bodies.js reads `detached === true`, so a missing key would
      // answer the same today -- and would stop answering the moment anything
      // asks the question the other way round.
      detached: garage ? false : undefined,
      points: points.map(point => ({ x: point.x, y: 0, z: point.z })),
      overriddenSrcIds: [],
    };
    if (outline.detached === undefined) delete outline.detached;
    // ONE OUTLINE PER BODY, NOT ONE PER RING. The foundation walls under a
    // house are the same loop raised again in concrete, and an outline for
    // them would be a second footprint for one building -- which BUILD HOUSE
    // reads as "this level already has a house" and every count of outlines
    // reads as two buildings.
    if (withOutline) drawing.outlines.push(outline);
    const refLine = BH.outlineInteriorRef(points);
    // ── THE WALLS THIS BODY ACTUALLY OWNS ────────────────────────────────
    //
    // AN ATTACHED GARAGE DOES NOT RAISE THE WALLS IT SHARES WITH THE HOUSE.
    // Movie, 18 Sep, with the wall marked in green on a screenshot: "the
    // garage has an extra wall that is not needed. the garage walls should
    // link into the house (look at how the DC version did it)". The DC
    // version is one line of _buildGarageWalls -- skip an edge that lies on
    // the house outline -- and that test is now geometry-2d.js's edgeOnLoop,
    // read from there by both pages rather than written twice.
    //
    // TWO EDGES GO ON THIS BUNGALOW, not the one that was visible. The 20 ft
    // along the house's front wall is the one in the screenshot; the 1 ft TIE
    // down the house's right wall is the same mistake a foot long, and it is
    // the one nobody would have reported. Both are a second wall standing in
    // the same place as a house wall: doubled linework on the plan, a doubled
    // stud count off it, and two walls to drag when the house moves.
    //
    // THE FOOTPRINT KEEPS ALL SIX CORNERS. Only the WALLS are skipped -- the
    // outline above is the garage's shape, and the slab, the roof and the
    // grade beam are all cut from it. Trimming the loop to the walls raised
    // would leave the garage open along the house.
    const sharedWith = against ? G.loopSegments(against) : null;
    // THE LEVEL AND VIEW THIS BODY IS FOR, handed to every wall rather than
    // left to the active one. See commitWall's own note: this function took a
    // levelId, put it on the outline, and let the walls file themselves
    // wherever the drafter happened to be standing.
    const on = { levelId, view: viewId, wallType, baseHeight, topHeight, body };
    // BY EDGE NUMBER, not by position. The openings below are keyed to the
    // plan's edges, and both the skip above and houseWallRuns' own degenerate
    // skip take runs OUT of the list -- so a wall's place in an array stopped
    // meaning its edge the moment either could fire.
    // ── STACKED ON THE WALL BELOW ────────────────────────────────────────
    //
    // Movie, 9 Oct, on the MOD BILEVEL's roof plan: "2nd floor walls should
    // line up with main floor walls in that area". Where an edge of this loop
    // runs along a wall line of a loop below (`stackOn`) and that loop lies
    // on the OTHER side, the wall takes the lower wall's side of the line, so
    // its body stands on the wall under it instead of a thickness beside it.
    const lowerLoops = (stackOn || []).filter(l => Array.isArray(l) && l.length >= 3);
    const insideLoop = (loop, p) => {
      let hit = false;
      for (let i = 0, j = loop.length - 1; i < loop.length; j = i++) {
        const a = loop[i], b = loop[j];
        if ((a.z > p.z) !== (b.z > p.z) && p.x < (b.x - a.x) * (p.z - a.z) / (b.z - a.z) + a.x) hit = !hit;
      }
      return hit;
    };
    const refFor = run => {
      if (!lowerLoops.length) return refLine;
      const dx = run.end.x - run.start.x, dz = run.end.z - run.start.z;
      const len = Math.hypot(dx, dz);
      if (!(len > 1e-6)) return refLine;
      const mid = { x: (run.start.x + run.end.x) / 2, z: (run.start.z + run.end.z) / 2 };
      const onLine = lowerLoops.some(loop => loop.some((a, i) =>
        G.pointToSegment(mid, { start: a, end: loop[(i + 1) % loop.length] }).d < 0.01));
      if (!onLine) return refLine;
      // 'left' puts the body on the (-dz, dx) side of start -> end.
      const outward = refLine === 'left' ? -1 : 1;
      const probe = { x: mid.x - outward * 0.25 * dz / len, z: mid.z + outward * 0.25 * dx / len };
      return lowerLoops.some(loop => insideLoop(loop, probe))
        ? (refLine === 'left' ? 'right' : 'left') : refLine;
    };
    const wallsByEdge = [];
    BH.houseWallRuns(points).forEach(run => {
      if (sharedWith && G.edgeOnLoop(run.start, run.end, sharedWith)) return;
      wallsByEdge[run.edge] = commitWall(run.start, run.end,
        { bone: false, refLine: refFor(run), ...on });
    });
    const walls = wallsByEdge.filter(Boolean);

    // ── AND THE WINDOWS AND DOORS THE DESIGN CALLS FOR ─────────────────────
    //
    // Movie, 18 Sep: "i'd like the windows to be in set positions for each
    // house in the drivethru menu, but for the 'AUTOHOUSE' when they draw the
    // outline and create the house that one could have the fenestrations auto
    // generated". So these come from the PLAN, fixed, and auto-windows.js is
    // the other thing entirely -- the records carry `auto: false` so a re-deal
    // leaves the design's own openings alone.
    //
    // AND THE DEALING ITSELF IS SHARED, because the ordered detached garage
    // hangs its own two doors and a window the same way -- see dealOpenings,
    // which is also where the reasoning about `wallsByEdge` being a LOOKUP
    // rather than a position now lives. Passed here as a sparse array on
    // purpose: the shared edges above raised no wall, and an opening keyed to
    // one of those is dropped rather than written against its neighbour.
    const made = dealOpenings(openings, wallsByEdge, levelId);
    return { outline: withOutline ? outline : null, walls, openings: made };
  };

  // ── THE WHOLE BUILDING, NOT ONE STOREY OF IT ─────────────────────────────
  //
  // Movie, 18 Sep, looking at a bungalow he had just ordered: "the current
  // houses are missing foundation and roof you only did the main level so far
  // it looks like". Exactly so. buildPremadePlan raised ONE ring of exterior
  // stud walls and its windows and called that a house.
  //
  // MODEL.dc.html:14632 `_buildHouse` IS THE REFERENCE, and Movie's ruling on
  // it is "it worked decent in that version not perfect but real nice". From
  // one bone press it raises walls and a floor on every floor level, then
  // FOUNDATION's concrete walls, its slab and its strip footings, then the
  // roof. That order is kept below, and each piece reads its numbers from the
  // same modules the old page reads them from.
  //
  // AND IT IS WHY THE ELEVATIONS WERE BLANK, which is the same fact from the
  // other end. drawElevationView looks each wall's level up in the floor stack
  // and returns false when it collects no faces; a house with no foundation,
  // no floor and no roof, whose one ring of walls was filed on FOUNDATION
  // because that is where the drafter was standing, has nothing to stand up.
  // The page then printed "the cut line crosses no walls" four times.
  // ROOF_LEVEL_ID is already declared above for the seating chart, and the
  // roof below lands on that same 7 -- MODEL.dc.html's own number, which
  // _buildHouseRoof uses both to find the roof footprint and to refuse
  // building a second house roof (`roof.levelId === 7`).
  const FOUNDATION_LEVEL_ID = 1;

