// MODEL.html's page script, part 3 of 17: which way is out, the rising reveal, the bones, a garage's doors, the rail's pair, the foot bar.
//
// Stage 2 of the split (Movie, 24 Oct: "how can we reduce the MODEL.html
// size in a nice organized way"): the one script the page carried, cut
// at its own section headings and moved here verbatim, in order. The
// parts load one after another as classic scripts and share one scope,
// as they did inside the page; the indent is the page's, kept so every
// line reads as it did there.

  // ── WHICH WAY IS OUT ───────────────────────────────────────────────────
  //
  // OFF THE OUTLINE'S OWN WINDING, through build-house.js's
  // outlineInteriorRef -- the function the wall builder already uses to decide
  // which side of a traced line the body lands on. A centroid would be a
  // second answer to the same question and would get an L-shaped house wrong
  // at the inside corner; a point-in-polygon test would be a third copy of a
  // primitive this codebase keeps only in its harnesses.
  //
  // THE EDGE, NOT THE WALL. A wall record's start and end run whichever way it
  // was drawn, and the ring's direction is what the interior ref is about -- so
  // the normal is taken from the outline segment the window stands on.
  //
  // AN OUTLINE IS `{ points }`, NOT AN ARRAY. houseOutlineOn hands back the
  // body's outline object, and a bare `Array.isArray` guard here rejected
  // every window in the drawing -- silently, because the guard returns null
  // and the caller skips. Both shapes are taken, so a caller holding either
  // is right.

  // ── WHAT AN OPENING NEEDS TO KNOW ABOUT ITS WALL ────────────────────────
  //
  // geometry-2d.js's openingGeometry (#426) does the arithmetic and asks the
  // caller for the two things only a page can answer: how thick the host wall
  // is, and how much to pad the hole by so its edges do not shimmer against
  // the wall faces at this zoom.
  //
  // THE THICKNESS RULE IS MODEL.dc.html:14970, to the character -- the type's
  // totalIn over twelve, defaulting to stud_2x6 and falling back to
  // WALL_TYPES[1] for a type this build has never heard of. It is three lines,
  // which is exactly why it is worth copying carefully rather than
  // approximating: an opening cut half an inch too deep leaves a hairline of
  // wall across the hole and reads as a rendering artefact.
  const openingThicknessFt = () => wall => {
    const types = window.DraftWallTypes.WALL_TYPES;
    const def = types.find(type => type.id === (wall?.wallType || 'stud_2x6'))
      || types[1];
    return def.totalIn / 12;
  };

  // TWO PIXELS' WORTH OF WORLD, which is what the old page asks for
  // (worldPerPixel(halfH, canvasHeight) * 2). It is a PAINT pad, not geometry:
  // the hole is cut a couple of pixels proud of both wall faces so the fill
  // covers the wall's own edge line instead of landing exactly on it, where
  // the two would fight over the same pixel row at some zooms and not others.
  // view.scale is px per foot, so its reciprocal is the foot-per-pixel the old
  // page derives from its ortho camera.
  const openingPadFt = () => (view.scale > 0 ? 2 / view.scale : 0.02);

  // THE TWO COLOURS, and they are the reason drawOpening2D takes them at all.
  // The old page fills the hole with #fafafa because that matches ITS clear
  // colour and the gap reads as paper; on this page's night ground the same
  // fill is a near-white hole punched through a dark wall. surface-page is
  // whatever the current skin's paper is, so the hole reads as paper on both.
  //
  // THE INK IS draw-wall-edge RATHER THAN A ROLE OF ITS OWN. An opening's
  // jambs ARE wall edges -- the line that carries the wall where the body
  // stops -- and that role already documents the two grounds this linework
  // sits on: the draw-wall fill it usually crosses, and bare page inside the
  // hole. Both of its values clear 3.0 on both skins, which is the measurement
  // a new role would have had to repeat.
  const openingEnv = () => ({
    isPrinting: false,
    openingColor: skin['draw-wall-edge'],
    openingGapColor: skin['surface-page'],
    selectColor: skin['accent'],
  });

  // The openings that belong to the walls being drawn, each with its geometry
  // already resolved -- drawOpening2D takes the answer rather than fetching
  // it, the way drawColumn2D takes its footing.
  //
  // AN OPENING WHOSE WALL IS NOT ON SCREEN IS NOT DRAWN, and it is matched by
  // wallId against the walls this pass is painting rather than by level: a
  // wall can be shown from another level through a shared context, and its
  // openings have to come with it or the wall arrives solid.
  // THE SHELL'S OPENINGS AND THE SUITES' ON ITS WALLS (Movie, 18 Oct: "all
  // the FENSTRATIONS from the SUITE exterior wall will 'OVERRIDE' the SOLID
  // SHELL wall"). Drawn, dimensioned and drawn in elevation like the shell's
  // own, but never picked: they belong to the suite's .draft.
  const shellOpenings = () => [...(drawing?.fenestrations || []),
    ...(H()?.hostOpenings ? H().hostOpenings(drawing) : [])];
  const openingsOn = (shown, withSuites = false) => {
    // Resolved HERE rather than captured at module scope: eight modules in
    // this repo bind a global at load and break when their dependency arrives
    // later, and MODEL.html's own head comment is about exactly that. Every
    // other user of the geometry module in this file does the same.
    const G = window.DraftGeometry2D;
    const byId = new Map(shown.map(wall => [String(wall.id), wall]));
    const opts = {
      walls: shown,
      thicknessFt: openingThicknessFt(),
      padFt: openingPadFt(),
    };
    return (withSuites ? shellOpenings() : (drawing?.fenestrations || [])).reduce((out, opening) => {
      const wall = byId.get(String(opening.wallId));
      if (!wall || !wall.start || !wall.end) return out;
      const geometry = G.openingGeometry(opening, wall, opts);
      // NULL IS A REAL ANSWER: clampOpeningToWall refuses an opening wider
      // than its wall can carry with the bearing left at each end.
      //
      // AND THIS IS THE SECOND OF TWO GUARDS, not the only one. An earlier
      // version of this comment said a painter handed the null would throw on
      // the first corner; it would not -- drawOpening2D opens with its own
      // `if (!geoInfo) return`, and the mutation that dropped this line
      // survived every check, which is how the claim was caught. What this
      // line actually buys is a list with nothing refused in it, so a caller
      // counting what was drawn is counting what was drawn.
      if (geometry) out.push({ opening, geometry });
      return out;
    }, []);
  };

  // drawDimension2D reads exactly two things: a label function and five
  // colours. Small, but the label is the one place this page can silently
  // diverge from the product, so the polarity below is copied and not
  // rewritten.
  const dimensionEnv = () => ({
    // IMPERIAL IS THE FALL-THROUGH, DELIBERATELY -- MODEL.dc.html:8058 reads
    // `units !== 'metric'`, not `units === 'imperial'`. Nothing normalises
    // `units`: drawing-format.js has no rule for it, so it arrives here raw
    // off the saved JSON, where it can be absent, null, or a string from a
    // drawing older than the toggle. Every one of those has to print SOMETHING
    // a drafter can read, and feet-and-inches is this app's home unit.
    //
    // Inverting it to `=== 'imperial'` reads identically on the fixture and
    // sends every one of those drawings to metres. This is the same polarity
    // that hid seven metric display sites from a grep earlier today: a test
    // for one value is not a test for the other when a third case exists.
    label: value => (drawing?.units !== 'metric'
      ? window.DraftFormatters.formatArchitecturalInches(value * 12)
      : window.DraftFormatters.formatMetres(value)),
    // Only `stroke` and `labelBack` ever paint here. This page has no
    // dimension tool and no selection, so drawDimension2D's `options` is
    // always `{}` and the preview and selected branches are unreachable --
    // but they must still be DEFINED, or wiring selection up later would read
    // `undefined`, paint transparent black, and look like a geometry bug.
    //
    // Placeholders follow floorEnv's split: preview takes the committed look,
    // selection takes the accent. The accent is the loud choice, and loud is
    // the point -- a placeholder that fires should be obviously wrong rather
    // than quietly plausible. Wiring the halo to `surface-panel` was the first
    // attempt and was the opposite: a page-coloured 7px band under the line,
    // which is the placeholder that HIDES. (On rough/day the accent happens to
    // equal draw-dim, so there the two would not be told apart -- harmless
    // while the branch is dead, and not worth a role of its own until
    // selection is real.)
    colors: {
      stroke: skin['draw-dim'],
      selected: skin['accent'],
      selectedHalo: skin['accent'],
      preview: skin['draw-dim'],
      // The plate the label is drawn ON. It has to be the ground draw-dim was
      // measured against, or the contrast the palette harness proves is a
      // contrast against something this page never paints.
      labelBack: skin['surface-panel'],
    },
  });

  const paintDimensions = () => {
    const R = window.DraftRender2D;
    const F = window.DraftFormatters;
    const missing = [!R && 'render-2d.js', !F && 'formatters.js'].filter(Boolean);
    if (missing.length) {
      throw new Error(`MODEL.html: cannot paint dimensions, ${missing.join(' and ')} `
        + 'did not load. Check the script order in the page head.');
    }
    const env = dimensionEnv();
    const lit = new Set(selection.filter(entry => entry.type === 'dimension' && !entry.point).map(entry => entry.item));
    const shown = shownDimensions();
    shown.forEach(dimension => R.drawDimension2D(ctx, toS, dimension,
      lit.has(dimension) ? { selected: true } : {}, env));
    // A PICKED POINT IS LIT AS A POINT -- a ring on the arrow tip -- and its
    // line stays as it was, so what DELETE will take reads at a glance.
    selection.filter(entry => entry.type === 'dimension' && entry.point && shown.includes(entry.item))
      .forEach(({ item, point }) => {
        const line = dimDrawnLine(item);
        if (!line) return;
        const q = point === 'start' ? line[0] : line[1];
        ctx.save();
        ctx.strokeStyle = env.colors.selectedHalo;
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(q.x, q.y, 8, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = env.colors.selected;
        ctx.beginPath(); ctx.arc(q.x, q.y, 3.5, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      });
  };

  // LEADER NOTES. Two env keys, and until #302 there was no colour to put in
  // them: NOTE_COLOR is '#1d1f20' and the night skin's surface-page is
  // '#1d1f20' -- the identical hex, contrast 1.00, a note painted in exactly
  // the colour of the page behind it. MODEL.dc.html never saw it because that
  // page has one light ground and no second one to be wrong against, so the
  // port creates the defect rather than finding it. draw-note is the key now,
  // and it answers to 4.5 rather than 3.0 because a note is text.
  //
  // The painter takes SCREEN points, not world ones -- it is the only one here
  // that does. Both the anchor and the text block come through toS.
  const paintNotes = () => {
    const R = window.DraftRender2D;
    if (!R) {
      throw new Error('MODEL.html: cannot paint notes, render-2d.js did not '
        + 'load. Check the script order in the page head.');
    }
    const env = { color: skin['draw-note'], fillColor: skin['surface-page'] };
    // options is {} here: preview and pending are in-progress states of the
    // annotation TOOL, and this page has no tools. A committed note is the
    // only kind it can hold.
    notes().forEach(note =>
      R.drawNoteScreen2D(ctx, toS(note.anchor), toS(note.text), note, { pxPerFt: view.scale }, env));
  };

  // The name, and the size under it when there is one -- exactly as typed.
  // render-2d's `areaFor` is the painter's second line, and the size is what
  // goes there now that nothing on this page computes an area.
  const paintRoomTags = () => {
    const R = window.DraftRender2D;
    if (!R || !roomTagsShown()) return;
    const env = roomTagEnv();
    roomTags().forEach(tag => R.drawRoomTag2D(ctx, toS, tag, {}, env));
  };
  // THE ROOM SHAPES AND THEIR FLOORING, under the walls so their fill stops
  // the finish at the face -- the slot the WC tile has.
  const paintRoomShapes = () => {
    const R = window.DraftRender2D;
    if (!R?.drawRoomShape2D || !roomTagsShown()) return;
    const env = { ...roomTagEnv(), isPrinting: false };
    roomTags().forEach(tag => { if (roomShapeOf(tag)) R.drawRoomShape2D(ctx, toS, tag, {}, env); });
  };

  // The fixture body is filled with the page's own ground so the wall hatch
  // shows faintly through it -- which is what the painter's old literal white
  // meant on a light page, and the opposite of what it meant on a dark one.
  //
  // THE ALPHA IS APPENDED AS A HEX BYTE rather than parsed: 0.65 * 255 = 166 =
  // 0xa6, and canvas takes 8-digit hex. Guarded by the shape of the value, so
  // a skin that ever hands back an rgba() or a named colour falls through
  // opaque instead of producing '#f2f2f3a6'-shaped nonsense that silently
  // paints black. palette.js's own parse() reads 8-digit hex, so this is the
  // repo's spelling for the same idea, not a new one.
  const fixtureFill = () => {
    const ground = skin['surface-page'];
    return /^#[0-9a-f]{6}$/i.test(ground) ? `${ground}a6` : ground;
  };

  // FIXTURES -- kitchen, bath and laundry symbols riding their host walls.
  //
  // ELEVEN ENV KEYS, and only two of them are colours; the rest are ANSWERS.
  // drawFixture2D does not know where a fixture is: it asks its caller through
  // fixtureGeometry, wallFrame and wallCross. Those three (four, with the tub)
  // lived as methods on MODEL.dc.html's component and were therefore reachable
  // only from that page, which is why this one drew no fixtures through two
  // tiers. They are fixture-geometry.js now, one copy, both boards.
  //
  // The extraction was proved by a differential run while both copies existed
  // -- 8421 comparisons over 2994 fixtures, identical -- and that proof is
  // recorded in proto/fixture-geometry-harness.js rather than kept, because
  // MODEL.dc.html delegates here now and the same comparison would be the
  // module against itself.
  //
  // WALLS IS EVERY WALL, not fixtures()' filtered set, and the difference is
  // load-bearing: the tub scans for the wall that closes its alcove and does
  // its OWN level and view filtering while it scans (fixture-geometry.js).
  // Handing it a pre-filtered list would be filtering twice and would drop the
  // foundation wall a ground-floor tub can legitimately end against.
  // WHAT THE FIXTURE PAINTER IS HANDED, the sheet's and the OBJ / PROP
  // window's alike, so the two cannot draw a piece two ways.
  const fixturePaintEnv = () => {
    const FG = window.DraftFixtureGeometry;
    const CL = window.DraftClosets;
    const all = drawing?.walls || [];
    return {
      fixtureGeometry: (fx, wl) => FG.fixtureGeometry(all, fx, wl),
      wallCross: (a, frame, b) => FG.wallCross(a, frame, b),
      wallFrame: wl => FG.wallFrame(wl),
      walls: all,
      closetDoorFor: outsideWidthFt => CL.doorFor(outsideWidthFt),
      CLOSET_WALL_FT: CL.WALL_FT, CLOSET_ROD_FT: CL.RAIL_FT,
      CLOSET_SHELF_FT: CL.SHELF_FT, CLOSET_CLOTHES_FT: CL.CLOTHES_FT,
      COUNTER_OVERHANG_FT: FG.COUNTER_OVERHANG_FT,
      FIXTURE_COLOR: skin['draw-fixture'],
      fixtureFill: fixtureFill(),
      // The neighbours a counter piece melds with at a joint.
      fixtures: fixtures(),
      // ONE COUNTER (Movie, 21 Oct: "meld the COUNTER"): the boxes light,
      // the counter and the uppers drawn over them as one.
      meldCounters: true,
      hasUppers: fixture => !!window.DraftFixtureKinds?.hasUppers(fixture),
    };
  };
  const paintFixtures = () => {
    const R = window.DraftRender2D;
    const FG = window.DraftFixtureGeometry;
    const CL = window.DraftClosets;
    const missing = [!R && 'render-2d.js', !FG && 'fixture-geometry.js',
      !CL && 'closets.js'].filter(Boolean);
    if (missing.length) {
      throw new Error(`MODEL.html: cannot paint fixtures, ${missing.join(' and ')} `
        + 'did not load. Check the script order in the page head.');
    }
    const all = drawing?.walls || [];
    const env = fixturePaintEnv();
    // options is {} for the same reason it is on notes: preview and selected
    // are states of the fixture TOOL, and this page has no tools.
    const K = window.DraftFixtureKinds;
    fixtures().forEach(fixture => {
      const wall = all.find(w => w.id === fixture.wallId);
      R.drawFixture2D(ctx, toS, fixture, {}, wall, env);
      // THE UPPERS OVER IT, dashed and lighter (the overhead convention,
      // Movie 16 Oct): which kinds carry them is the catalogue's answer.
      if (K && K.hasUppers(fixture) && R.drawUpperCabinets2D) R.drawUpperCabinets2D(ctx, toS, fixture, wall, env);
    });
    if (R.drawCounters2D) R.drawCounters2D(ctx, toS, fixtures(), env);
    // THE MARKS OVER THE PIECES, never under their fill.
    paintFixtureMarks(ctx, toS);
  };

  // THE WC FLOOR -- 1'-0" tile in a room with a toilet, tub or shower in it
  // (Movie, 9 Oct: "lighter line at joints"). The fixture ink, faint.
  const paintWetFloors = () => {
    const R = window.DraftRender2D;
    const FG = window.DraftFixtureGeometry;
    if (!R?.drawWetFloors2D || !FG) return;
    const all = drawing?.walls || [];
    const ink = skin['draw-fixture'];
    R.drawWetFloors2D(ctx, toS, {
      walls: walls(),
      // A room whose tag lays its own flooring is not tiled over it.
      flooredAt: roomTags().filter(tag => roomShapeOf(tag) && tag.flooring).map(tag => tag.at),
      fixtures: fixtures(),
      fixtureGeometry: (fx, wl) => FG.fixtureGeometry(all, fx, wl),
      wallFrame: wl => FG.wallFrame(wl),
      tileColor: /^#[0-9a-f]{6}$/i.test(ink) ? `${ink}55` : ink,
    });
  };

  // THE WASHROOM PREVIEW: the room washroomPlacement would drop, drawn
  // through the same painters a dropped one goes through, faint. Its walls
  // are stand-ins with the ids the fixtures and door name, so fixture
  // geometry finds them exactly as it will find the real ones.
  const paintWashroomPreview = () => {
    const R = window.DraftRender2D;
    const FG = window.DraftFixtureGeometry;
    const room = washroomPlacement(cursorWorld);
    if (!R || !FG || !room) return;
    const { levelId } = onActiveLevel();
    const ghost = room.walls.map(w => ({
      id: `washroom-${w.key}`, start: { ...w.start, y: 0 }, end: { ...w.end, y: 0 },
      levelId, view: 'plan', wallType: w.wallType, refLine: 'center',
    }));
    const all = ghost.concat(room.ext ? [room.ext] : []);
    const hostId = key => (key === 'ext' ? room.ext.id : `washroom-${key}`);
    ctx.save();
    ctx.globalAlpha = 0.6;
    ctx.fillStyle = skin['draw-selected'];
    ctx.strokeStyle = skin['draw-selected'];
    ctx.lineWidth = 1;
    ghost.forEach(wall => {
      const f = FG.wallFrame(wall);
      if (!f) return;
      const c = [f.at(0, f.startOff), f.at(f.len, f.startOff), f.at(f.len, f.endOff), f.at(0, f.endOff)].map(toS);
      ctx.beginPath();
      c.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
      ctx.closePath(); ctx.fill(); ctx.stroke();
    });
    ctx.restore();
    const env = presetPreviewEnv(all);
    room.fixtures.forEach(f => {
      const record = { kind: f.kind, wallId: hostId(f.host), offset: f.offset, width: f.width,
        depth: f.depth, side: f.side,
        ...(f.kind === 'tub' ? { endWallId: hostId(f.endWall), dir: f.dir } : {}) };
      R.drawFixture2D(ctx, toS, record, { preview: true }, all.find(w => w.id === record.wallId), env);
    });
  };
  // What a preset's faint fixtures are drawn against: the walls they would
  // ride, in the preview's ink. One builder for the washroom and the kitchen.
  const presetPreviewEnv = all => {
    const FG = window.DraftFixtureGeometry;
    return {
      fixtureGeometry: (fx, wl) => FG.fixtureGeometry(all, fx, wl),
      wallCross: (a, frame, b) => FG.wallCross(a, frame, b),
      wallFrame: wl => FG.wallFrame(wl),
      walls: all,
      closetDoorFor: () => null,
      COUNTER_OVERHANG_FT: FG.COUNTER_OVERHANG_FT,
      FIXTURE_COLOR: skin['draw-selected'],
      fixtureFill: fixtureFill(),
    };
  };
  // THE KITCHEN IN HAND: its six pieces on the two walls of the corner the
  // cursor is in, in the preview's faint ink. Nothing when no corner is
  // within reach or a leg is short -- the press will say which.
  const paintKitchenPreview = () => {
    const R = window.DraftRender2D;
    const kitchen = kitchenPlacement(cursorWorld);
    if (!R || !kitchen || kitchen.refused) return;
    // ITS OWN WALLS, when it brings them, as the rubber band draws a wall.
    (kitchen.own || []).forEach(w => R.drawWallSeg2D(ctx, toS, w, true, null, 'both', wallEnv()));
    const all = walls().concat(kitchen.own || []);
    const env = presetPreviewEnv(all);
    kitchen.fixtures.forEach(f => {
      const record = { kind: f.kind, wallId: f.wall.id, offset: f.offset, width: f.width,
        depth: f.depth, side: f.side, ...(f.standoff ? { standoff: f.standoff } : {}) };
      R.drawFixture2D(ctx, toS, record, { preview: true }, f.wall, env);
    });
  };

  // CUT MARKS -- the section lines and their bubbles.
  //
  // FOUR INPUTS, AND THEY COME FROM THREE DIFFERENT PLACES. That is the whole
  // story of this painter, and it is why it went last of the ones that only
  // needed wiring:
  //
  //   cuts                  the drawing        persisted, read like walls
  //   elevationMarkOffsets  the drawing        persisted (PERSISTED_KEYS)
  //   structureStandards    the PROFILE        the drafter's office standard,
  //                                            localStorage, not the drawing
  //   autoDimFirstOffsetFt  the drawing        persisted since PR #319;
  //                                            null means derive
  //
  // The third is why profile-manager.js is in the head.
  //
  // THE FOURTH USED TO HAVE NO HOME, AND THIS PAGE PAINTED ITS OWN DEFAULT.
  // Until PR #319 the offset was session state on the old page, written
  // nowhere, so this page hardcoded 1.5' and the comment here said out loud
  // that a drafter who changed it mid-session saw a different gap on the two
  // boards. That was the one input this page could not be faithful about, and
  // it is now one it reads -- which is why this is a completion of tier 2
  // rather than a tidy: tier 2's whole claim is that this page paints what the
  // drawing says.
  //
  // NULL MEANS DERIVE, and reading it any other way reintroduces the bug the
  // key was added to close. `format.autoDimFirstOffsetFt` keeps null for a
  // drawing that never chose (drawing-format.js: "readers normalise, writers
  // never invent"), so `?? AUTO_DIM_FIRST_OFFSET_FT` is where the gap comes
  // from -- and moving that default later then reaches every such drawing,
  // which is what happened on 12 Oct when it went from 1'-6" to 2'-0".
  //
  // HALF, because the bubbles sit in the middle of the gap between the walls
  // and the first string. MODEL.dc.html's `_cutMarkGapFt()` takes the same
  // half of the same number -- one underscore apart from this name, on the
  // board this one has to agree with, which is why that file carries a comment
  // pointing here and this one points back.
  const autoDimFirstOffsetFt = () =>
    drawing?.autoDimFirstOffsetFt ?? window.DraftDrawingFormat.AUTO_DIM_FIRST_OFFSET_FT;
  const cutMarkGapFt = () => autoDimFirstOffsetFt() / 2;

  // TWO GLOBALS, not one, and profile-manager.js publishes seven. The reader
  // is on DraftProfileManager; the normaliser is on DraftStructureStandards
  // (profile-manager.js:479). Written out rather than assumed: the first
  // version of this reached for PM.normaliseStructureStandards, which is
  // undefined, and the page caught the throw and said "painter failed".
  const structureStandards = () => window.DraftStructureStandards
    .normaliseStructureStandards(
      window.DraftProfileManager.getActive('standards')?.content?.model?.structureStandards);

  // THE LAYER TABLE, from the same profile and by the same two globals.
  //
  // THIS PAGE HAD NO READER AT ALL until now, and the cost was exact: the
  // window size tag moved to A-DIMS-WIN on 30 Sep so Movie could drop the
  // corner string and keep the sizes, cut-view-env.js gave Construction
  // Layout and EXT. FINISH the lookup that makes the tick work -- and the one
  // page he actually draws on honoured none of it. Unticking the layer took
  // the size off every printed elevation and left it on the plan in front of
  // him, which is a worse answer than not offering the tick.
  //
  // MODEL.html:3621 says "this page has none to read" about A-STR, and that
  // was true when it was written. It is the sentence this line retires.
  //
  // NOT CACHED, and that is parity rather than laziness. Standards live in
  // localStorage and take effect on the next paint -- the model epoch a few
  // lines down deliberately does not carry the profile, "standards live in
  // localStorage and take effect on the" next look. A table cached here would
  // make the tick need a reload, which is the shape of the bug being fixed.
  //
  // NO TABLE MEANS EVERY LAYER DRAWS, the same rule cut-view.js states at its
  // own gate: a page whose profile never loaded is not a page that hid the
  // layer. The two must not answer differently about one tick.
  const layerStandardOf = id => {
    const api = window.DraftLayerStandards;
    const pm = window.DraftProfileManager;
    if (!api || !pm) return null;
    return api.normaliseLayerStandards(
      pm.getActive('standards')?.content?.model?.layerStandards)[id] || null;
  };


  // THE MODEL EPOCH: bumped when the DRAWING changes and at nothing else --
  // not on pan, zoom, a level switch or a view switch. MODEL.dc.html bumps
  // its rail epoch at exactly two places, the load and _markUnsaved
  // (:6366, :6632); this matches them.
  //
  // It does two jobs, and both ask the same question -- has the drawing
  // changed since I last looked:
  //   - the rail's six thumbnails repaint on it, never on mouse traffic;
  //   - autoElevationCuts caches on it.
  //
  // The PROFILE is deliberately not part of it, and that is parity rather
  // than an oversight: standards live in localStorage and take effect on the
  // next load on both pages. tests/model-html-cuts.spec.js changes them and
  // reloads, which starts a fresh epoch anyway.
  let modelEpoch = 0;
  const bumpModelEpoch = () => { modelEpoch += 1; };

  // THE FOUR STANDARD ELEVATIONS ARE DERIVED, NOT STORED. `cuts` holds the
  // drafter's SECTIONS; E1-E4 are computed from the plan's own extents every
  // time, which is why a house that grows moves its elevation lines without
  // anyone editing them.
  //
  // ONE HOME, because there are now two readers: paintCuts draws their marks
  // on the plan, and the rail seats them. Two derivations of the same four
  // cuts could disagree about where the house is -- a seat showing one
  // elevation while the mark on the plan points somewhere else. This is the
  // third time in this branch that a second copy was the thing to avoid
  // (levelAssemblyFor, cutAxis), so it is not written twice even once.
  // CACHED ON THE EPOCH, and the numbers below are the measurement, not the
  // guess it replaced. autoElevationCuts walks every wall to find the plan's
  // extents, and cutForViewId is called several times a paint.
  //
  // I expected the damage to be in the PLAN paint, where walls(), lines(),
  // floors() and outlines() each call onActiveLevel() once per item. It is
  // not: under a plan view cutForViewId exits on the `cut:` prefix test
  // before it derives anything, and the plan paint measured 0.70 ms on the
  // 24-wall house with the cache and without it. The per-item path never pays.
  //
  // The cost is real on the SECTION paint, where every call does derive:
  // 0.60 ms uncached against 0.40 ms cached, same house. So the cache earns
  // its place, just not for the reason it was written for.
  let autoElevCache = { epoch: -1, cuts: [] };
  const autoElevationCuts = () => {
    if (autoElevCache.epoch !== modelEpoch) {
      autoElevCache = {
        epoch: modelEpoch,
        cuts: window.DraftCutMarks.autoElevationCuts({
          // A SHOWN HOLOGRAM'S WALLS TOO, where they stand: E1 to E4 stand
          // round the existing house and the addition together, so the
          // elevation takes in both (hologram PR 5).
          walls: (drawing?.walls || []).concat(hologramWallsPlaced()),
          dimensions: drawing?.dimensions || [],
          elevationMarkOffsets: drawing?.elevationMarkOffsets || {},
          autoElevations: structureStandards().autoElevations,
          // HOW FAR ROUND THE HOUSE HAS BEEN TURNED. Movie, 27 Sep: "the
          // front view E1 will stay as the same view but the house and the
          // E1-E4 lines will rotate" -- so the marks walk a seat along with
          // the geometry and E1 keeps its own wall. The cache above is keyed
          // on the model epoch, which a rotation bumps through markDirty.
          planTurn: drawing?.planTurn || 0,
        }),
      };
    }
    return autoElevCache.cuts;
  };

  // EVERY CUT VIEW THIS DRAWING OFFERS, in MODEL.dc.html's _cutById order
  // (:9531): the four derived elevations, then the drafter's stored sections.
  //
  // Three callers ask this one question -- the view lookup, the view picker
  // and the rail -- and they must not be able to disagree about it. A picker
  // offering a view the lookup cannot resolve is a dead option; a rail seating
  // one is a dead card.
  const allCuts = () => [...autoElevationCuts(), ...cuts()];
  // THE E MARKS AS DRAWN: a ring round the LOT on the site level, round the
  // house elsewhere -- and NONE ON THE SHELF (Movie, 22 Oct: "lets take off
  // the E1-E4 from the SHELF don't think its needed there"). The record
  // (autoElevationCuts) stands: it is the house's, cut round the house's
  // walls, and the shelf's own suite is not the house. It is only not drawn
  // round a sheet that shows the suite and not the house.
  const eMarksDrawn = () => (boneyardActive ? [] : (siteMarkRing() || autoElevationCuts()));

  // ── THE RISING REVEAL (board #283) ────────────────────────────────────
  // "Every bone press that grows the house jumps to the E1 front elevation
  // and the house climbs out of the ground under the rising mask -- not just
  // the tour finale. BONE REVEAL in SETTINGS turns it off for drafters who'd
  // rather stay on the plan." MODEL.dc.html's words, and its behaviour.
  //
  // Movie, 23 Sep, asking for it on both BONEs: "go to the MODEL html, and go
  // to the FRONT ELEVATIONS view, and 'GROW' the house from bottom to top",
  // "make it a nice presentation where it is revealed to the user by the
  // GROW". It already existed; this page never had it.
  //
  // TWO FIELDS AND NO TIMER. `revealStart` is in the future by the held beat,
  // so the first frames compute a clip BELOW the canvas and paint a full
  // curtain -- the pause falls out of the arithmetic instead of needing a
  // setTimeout that could fire after the drafter has moved on.
  let revealActive = false;
  let revealStart = 0;

  // The setting SETTINGS.html already writes (#bone-reveal), read the way
  // this page reads every other one: through the active package, defaulting
  // ON, so a drafter who has never opened SETTINGS still gets the show.
  // ── AND THE SITE IS THE NEXT QUESTION (Movie, 15 Oct) ──────────────────
  //
  // "basically after the house is AUTOBUILD, how about once they see it all
  // pop up, after that directly go into asking them about the site popup ...
  // don't use anything default", and again: "just ask them about the SITE
  // right after the AUTOHOUSE is built".
  //
  // AFTER THE SHOW, NOT BEFORE IT. The build already owns one question that
  // holds the grow trip (see presentBuild), and this is the opposite kind:
  // "once they see it all pop up, AFTER THAT" -- the bones grow, the house
  // climbs out of the ground on E1, and the lot is what he is asked next.
  // So the flag is set when the reveal starts and spent when the curtain
  // finishes.
  //
  // IT GOES TO THE SITE TO ASK. The card's own answers assume the drafter is
  // standing on the lot -- DRAW IT MYSELF arms the OUTLINE tool "on the SITE
  // level the drafter is already standing on" -- so raising it over an
  // elevation would offer a lot line drawn on E1. Arriving at SITE is also
  // what frames the site and what the question was built for.
  //
  // NOTHING DEFAULT IS DRAWN, which was the whole of his second thought: an
  // AUTOSITE laid for him and corrected afterwards is a lot he never chose.
  let askSiteWhenShown = false;
  const askAboutTheSite = () => {
    if (!drawing) return false;
    // A LOT ALREADY THERE IS NOT A QUESTION. A rebuild on a drawing that has
    // its site -- or one opened from a file that carries one -- must not be
    // marched back to a card it has already answered.
    if (window.DraftLotSizes?.siteOutlineOf(drawing.outlines)) return false;
    // ASKED AGAIN BECAUSE THE BUILD IS A NEW EVENT. A NOT NOW pressed before
    // there was a house to put on a lot is not an answer to this.
    lotAsked = false;
    if (Number(activeLevelId()) === SITE_LEVEL_ID) { paintLotPick(); return true; }
    goToLevel(SITE_LEVEL_ID);
    return true;
  };

  const boneRevealOn = () => window.DraftProfileManager
    ?.getActive('settings')?.content?.model?.boneReveal !== false;

  const startBoneReveal = () => {
    if (!boneRevealOn()) return;
    // No auto elevations means nothing to jump to -- the build still stands,
    // it simply is not presented. The dc page refuses the same way.
    if (!autoElevationCuts().some(cut => String(cut.id) === 'E1')) return;
    // THE CURTAIN MOMENT: both rails slide open around the stage and the mask
    // holds one beat -- get them ready -- before the house starts up.
    setRail('left', true);
    setRail('right', true);
    revealStart = performance.now() + window.DraftTour.REVEAL_HOLD_MS;
    revealActive = true;
    askSiteWhenShown = true;
    // CUT_VIEW + the id, the way every other caller reaches a cut. The first
    // draft of this passed the bare 'E1' and would have jumped to a view that
    // does not resolve -- the exact fault the comment on cutForViewId already
    // records against an earlier bug: "every `?view=cut:E1` resolved to null,
    // fell through to the layer-view branch, and warned about a view the
    // level does not have. Nothing caught it because nothing had asked for an
    // elevation yet."
    goToView(CUT_VIEW + 'E1');
  };

  // ── THE BONES GROW FIRST (Movie, 3 Oct) ──────────────────────────────────
  // "can you show the 3d ISO bone grow first and then flip to model space and
  // show the front elevation grow". So a served order no longer starts the
  // rising reveal here: it SAVES, goes to the BONEYARD, which grows the bones
  // level by level in its 3D window, and the BONEYARD sends the drafter back
  // here with `reveal=1`, where boot plays the E1 grow on the drawing it just
  // read. Same gate as the reveal (BONE REVEAL in SETTINGS, an E1 to jump to)
  // so a drafter who turned the show off stays on his plan.
  //
  // SAVED FIRST, OR NOT AT ALL. The BONEYARD reads the store, not this page,
  // so a trip taken without the write would grow the house he had before the
  // press. A save that is refused -- no lease, a stale rev -- keeps him here
  // and plays the elevation grow in place, the way it always did.
  //
  // ON THE NEXT TICK, because orderServed is called from inside the order's
  // listener: the sign still has to come down and the build bar still has to
  // settle before the drawing is written.
  // AND A QUESTION THE PRESS STILL OWES HOLDS THE TRIP. The grow trip
  // REPLACES this page, so a card the build raised over the drawing -- the
  // garage span ask is the one that does it -- is carried off and answered by
  // whatever it had drafted as the default. Measured, not reasoned: a 40 ft
  // detached garage drafted its REQ note, the page went to the BONEYARD, and
  // the "PLACE COLUMNS" half of Movie's 12 Oct ruling was never offered.
  // Asked here, answered here, and THEN the bones grow.
  //
  // ONE HOOK, NOT A SECOND CALLER. Both build doors (the sign's premade house
  // and the drive-thru garage) end in presentBuild, so the hold lives here
  // rather than being remembered at each press.
  const GROW_PAGE = './BONEYARD.html';
  const presentBuild = () => {
    // NO SHOW, SO THE QUESTION COMES STRAIGHT AWAY. A drafter who turned BONE
    // REVEAL off, or a drawing with no E1 to jump to, still built a house --
    // and the thing he is asked next does not depend on whether he watched it
    // go up.
    if (!boneRevealOn() || !autoElevationCuts().some(cut => String(cut.id) === 'E1')) {
      askAboutTheSite();
      return;
    }
    const grow = async () => {
      if (!(await save())) { startBoneReveal(); return; }
      const back = new URLSearchParams(location.search);
      back.delete('reveal');
      const query = back.toString();
      location.assign(`${GROW_PAGE}?grow=1&back=${encodeURIComponent(query ? `?${query}` : '')}`);
    };
    // ON ITS OWN TICK, as it always did. This used to hand the trip over to
    // the garage-span card when that card was up, so the bones did not grow
    // out from under a question the drafter was still answering. There is no
    // question any more -- the span decides -- so there is nothing to wait for.
    setTimeout(grow, 0);
  };

  // ── E1-E4 ON THE SITE PLAN STAND OUTSIDE THE LOT ──────────────────────
  //
  // Movie, 14 Oct: "the E1-E4 on the outside can we make it so it is on the
  // OUTSIDE of the site lines". They are seated off the WALLS, which is right
  // on a floor plan and wrong here: on the site level the subject is the lot,
  // and marks round the house sit in the middle of the sheet, inside the
  // property line and inside the two dimension rows now standing outside it.
  //
  // PAINT ONLY. The cuts themselves are what the elevations are generated
  // from, so this hands the painter a re-seated copy (cut-marks' own
  // seatMarksAround) and the records keep their ids, offsets and directions.
  // Every other level answers null and gets the marks it always had.
  //
  // CLEAR OF THE ROWS, not of the lot: the ring stands outside the outer
  // dimension line, and that distance is layout-plan's number rather than a
  // second copy of 3 + 2 kept here.
  const siteMarkRing = () => {
    const LP = window.DraftLayoutPlan;
    const CM = window.DraftCutMarks;
    const LS = window.DraftLotSizes;
    if (activeLevelId() !== SITE_LEVEL_ID || !LP || !CM || !LS) return null;
    if (typeof CM.seatMarksAround !== 'function') return null;
    const lot = LS.siteOutlineOf(drawing?.outlines);
    const points = lot && Array.isArray(lot.points) ? lot.points : null;
    if (!points || !points.length) return null;
    const box = {
      minX: Math.min(...points.map(pt => pt.x)), maxX: Math.max(...points.map(pt => pt.x)),
      minZ: Math.min(...points.map(pt => pt.z)), maxZ: Math.max(...points.map(pt => pt.z)),
    };
    const reach = (typeof LP.siteDimReachFt === 'function' ? LP.siteDimReachFt() : 5)
      + (CM.E_MARK_CLEAR_FT || 2);
    return CM.seatMarksAround(autoElevationCuts(), box, reach);
  };

  const paintCuts = () => {
    const R = window.DraftRender2D;
    const CM = window.DraftCutMarks;
    const PM = window.DraftProfileManager;
    const SS = window.DraftStructureStandards;
    // Both profile-manager globals are named, so a load-order slip says which
    // half is missing rather than blaming the file twice.
    const missing = [!R && 'render-2d.js', !CM && 'cut-marks.js',
      !PM && 'profile-manager.js (DraftProfileManager)',
      !SS && 'profile-manager.js (DraftStructureStandards)'].filter(Boolean);
    if (missing.length) {
      throw new Error(`MODEL.html: cannot paint cut marks, ${missing.join(' and ')} `
        + 'did not load. Check the script order in the page head.');
    }
    const all = drawing?.walls || [];
    const standards = structureStandards();
    R.drawCutMarks2D(ctx, toS, {
      bubbleStyle: standards.cutBubbleStyle,
      lineSpan: (start, end) => CM.cutLineSpan(all, start, end, cutMarkGapFt()),
      autoCuts: eMarksDrawn(),
      cuts: cuts(),
      cutColor: skin['draw-cut'],
      // The bubble interior is the page's own ground, so the lettering inside
      // it reads at the same contrast the palette measured draw-cut against.
      bubbleFill: skin['surface-page'],
    });
  };

  // The level readings a stair's rise is built from. Faithful to the four
  // component methods it replaces, INCLUDING their inconsistencies: _floorLevels
  // does not coerce level ids and _levelWallTopFt compares them strictly, so
  // neither does this. A stair descends to the subfloor below, and on the
  // lowest floor past the foundation wall onto the slab -- stair-geometry.js
  // owns that rule; this only answers the four questions it asks.
  // THE ROLE, NOT JUST THE ID. Passing no role means every level frames like a
  // plain floor, and MODEL.dc.html stopped believing that on 6 Sep (PR #323,
  // Devin's ruling). This page's whole job is to paint what that page saved, so
  // the two must ask the module the same question.
  //
  // ONE DEFINITION, TWO CALLERS — stairLevels below and cutEnv after it. It was
  // scoped inside stairLevels until the cut-view host needed the same answer,
  // and two level-assembly lookups that could drift apart is how the derive/
  // store divergence got in last time.
  // levelAssemblyFor IS this lookup, exported for exactly this reason: the
  // module's own comment says the TABLE had one home while the LOOKUP had
  // four, and that is how #325's role-less callers happened. Rolling a fifth
  // copy here would have re-made that bug in the file that warns about it.
  // WHAT A LEVEL IS CALLED ON SCREEN, asked of level-assembly.js rather than
  // read off the record. The stored `name` is what the file holds; this is
  // what the drafter reads -- "1 MAIN FL", "1.5 2ND FL" -- and the two are
  // deliberately different so no file changes and no lookup by stored name
  // breaks. See levelLabel's own note for why it is derived.
  const levelLabel = (id, name) => window.DraftLevelAssembly.levelLabel(id, name);

  const assemblyFor = id => window.DraftLevelAssembly
    .levelAssemblyFor(drawing?.levelAssemblies, id);

  // A GARAGE'S MASTER, if it has one: a level COPY points at one by masterId
  // and a master IS a master because it carries its own shelfId. The old page
  // reads the same two ways round (_garageMaster).
  //
  // THESE TWO CAME OUT OF cutEnv WITH garageFoundationOf, which calls both.
  // Left inside, the lifted function referenced names that only existed while
  // the env was being built -- and the page threw `garageMaster is not
  // defined` on every paint after a garage went up. Found by a probe watching
  // for page errors, not by a spec: the throw was inside a React render, so
  // the canvas kept painting and only UNDO looked broken.
  const garageMaster = garage => {
    if (garage?.shelfId != null) return garage;
    return (drawing?.boneyardOutlines || [])
      .find(master => master.id === garage?.masterId) || null;
  };
  const garageDetached = garage =>
    garage?.detached === true || garageMaster(garage)?.detached === true;

  // ── THE DOORS OF A GARAGE, AS THE SQUARE AND THE BEAM NEED THEM ───────
  //
  // Every door cut into a wall standing on the garage's loop: its centre on
  // the wall line, the wall's direction, the normal INTO the garage, its
  // clear width, whether it is the overhead door (`garage: true` on the
  // fenestration, set by the builder), and its wall's thickness to the
  // inside face. build-house.js garageKeepOuts and garageBeamPlan read these;
  // nothing here guesses a door's kind from its width.
  const garageDoorRecordsOf = garage => {
    const G = window.DraftGeometry2D;
    const WT = window.DraftWallTypes;
    const loop = (garage?.points || []).map(pt => ({ x: pt.x, z: pt.z }));
    if (loop.length < 3 || !G) return [];
    const ring = G.loopSegments(loop);
    const centre = loop.reduce((m, p) => ({ x: m.x + p.x / loop.length, z: m.z + p.z / loop.length }), { x: 0, z: 0 });
    const walls = (drawing?.walls || []).filter(w => Number(w.levelId) === Number(garage.levelId)
      && (w.view || 'plan') === 'plan' && w.start && w.end
      && (w.body === 'garage' || G.edgeOnLoop(w.start, w.end, ring)));
    return (drawing?.fenestrations || []).filter(f => f.type === 'door').flatMap(f => {
      const wall = walls.find(w => w.id === f.wallId);
      if (!wall || !(f.width > 0)) return [];
      const dx = wall.end.x - wall.start.x, dz = wall.end.z - wall.start.z;
      const len = Math.hypot(dx, dz);
      if (len < 1e-6) return [];
      const along = { x: dx / len, z: dz / len };
      const t = f.offset / len;
      const at = { x: wall.start.x + dx * t, z: wall.start.z + dz * t };
      let inward = { x: -along.z, z: along.x };
      if ((centre.x - at.x) * inward.x + (centre.z - at.z) * inward.z < 0) inward = { x: -inward.x, z: -inward.z };
      const totalIn = (WT?.WALL_TYPES || []).find(type => type.id === wall.wallType)?.totalIn;
      return [{ id: f.id, at, along, inward, widthFt: f.width, overhead: f.garage === true,
        insetFt: (Number.isFinite(totalIn) ? totalIn : 5.5) / 12 }];
    });
  };
  // THE GARAGE SQUARES (and the man door's landing) of one garage, and of
  // every garage under a level's floor: the keep-outs a stair, a column or a
  // pile on that floor must stay out of. See build-house.js garageKeepOuts.
  const garageKeepOutsOf = garage => (window.DraftBuildHouse
    ? window.DraftBuildHouse.garageKeepOuts(garage.points, garageDoorRecordsOf(garage)) : []);
  const garageKeepOutsUnder = levelId => {
    const elevOf = id => Number((drawing?.levels || []).find(l => Number(l.id) === Number(id))?.elev) || 0;
    return (drawing?.outlines || [])
      .filter(o => o.garage === true && (o.points || []).length >= 3
        && (Number(o.levelId) === Number(levelId) || elevOf(o.levelId) < elevOf(levelId) - 1e-6))
      .flatMap(garageKeepOutsOf);
  };

  // WHICH FOUNDATION A GARAGE HAS, ported from _garageFoundation: the outline
  // answers first, then its master, then the section table's row for this
  // garage's kind, and a gradebeam when nothing has said.
  //
  // IT LIVES OUT HERE because two callers need it and they must not differ.
  // It was written inside cutEnv, where it answered "what concrete should I
  // DRAW"; the build asks "what concrete should I MAKE", and a garage drawn
  // with a frost wall and built with a grade beam is a drawing that disagrees
  // with itself.
  //
  // THE RULE ITSELF LIVES IN cut-view.js (garageFoundationKind) since 16 Oct,
  // when Construction Layout's copy of it turned out to stop at the master
  // and never ask the table -- "the slab shows in model space but not on the
  // construction plan layout". This hands it the three things only this page
  // knows where to find.
  const garageFoundationOf = garage => window.DraftCutView.garageFoundationKind(garage, {
    master: garageMaster(garage),
    sectionRow: row => drawing?.sectionTable?.rows?.[row] ?? null,
  });

  // ── the cut-view env ────────────────────────────────────────────────────────
  // SPEC-model-html-cut-views.md. cut-view.js's drawCutView reads its world
  // through EIGHTEEN accessors and nothing else — there is no destructuring of
  // `env` anywhere in that file, so this object is the whole contract rather
  // than a sample, and MODEL.dc.html's _cutViewEnv supplies exactly the same
  // eighteen. Neither end carries a spare.
  //
  // NOT ONE OF THEM NEEDS PAGE STATE. Measured rather than assumed: the two
  // that look like state on the old page (`buildType`, `elevationDatum`) are
  // PERSISTED_KEYS entries, and even `garageFoundation` bottoms out in
  // persisted keys — `boneyardOutlines`, which this page reads though it offers
  // no boneyard gestures, and `sectionTable`. So the env is a function of the
  // drawing plus the shared modules, and the host inherits none of the old
  // page's state machine.
  //
  // proto/elevation-harness.js:buildEnv is the third implementation of this
  // contract and the one the offline timing runs against; where the two could
  // drift, that harness is the reference.
  const cutEnv = () => {
    const LA = window.DraftLevelAssembly;
    const LV = window.DraftLayerViews;
    const G = window.DraftGeometry2D;
    const F = window.DraftFormatters;
    const ftIn = feet => F.formatArchitecturalInches(feet * 12);

    // A garage outline's master lives on the boneyard shelf; an outline that
    return {
      // THE DRAFTER'S OWN LINES AND NOTES on this view (cut-view.js paints
      // them last, over the building).
      elevationMarks: name => (drawing?.elevationMarks || []).filter(m => m.cut === name),
      // EVERY LEVEL'S STAIRS, not the active level's: a section cuts them all.
      stairs: () => drawing?.stairs || [],
      // EVERY LEVEL'S FIXTURES, for the bath pieces a section looks at.
      fixtures: () => drawing?.fixtures || [],
      floorOpenings: floorId => (drawing?.surfaceOpenings || [])
        .filter(o => o.hostType === 'floor' && String(o.hostId) === String(floorId)),
      // THE SAME TICK THE PLAN READS, handed to the shared painter.
      //
      // cut-view.js asks `env.layerStandard('A-DIMS-WIN')` before it draws a
      // window's size tag. cut-view-env.js has answered that for Construction
      // Layout and EXT. FINISH since the layer split; THIS page answered
      // nothing, so the identical elevation, drawn by the identical painter,
      // carried the tag here and dropped it there. A shared painter that two
      // callers feed differently is two painters wearing one name.
      //
      // A FUNCTION, NOT A TABLE, matching cut-view-env's shape: the painter
      // reads a MISSING entry as "draws", so a page with no profile loaded is
      // not a page that hid the layer.
      layerStandard: id => layerStandardOf(id),
      // DOOR SIZES ON ELEVATIONS, the office's switch (STANDARDS), the same
      // way cut-view-env hands it to the sheets.
      fenStandards: () => (window.DraftFenLabels && window.DraftProfileManager
        ? window.DraftFenLabels.normaliseFenStandards(
          window.DraftProfileManager.getActive('standards')?.content?.model?.fenestrationStandards)
        : null),
      floorLevels: () => LV.floorLevels(drawing?.levels),
      levelAssembly: levelId => assemblyFor(levelId),
      levelFloorFt: levelId => LA.levelFloorFt(assemblyFor(levelId)),
      levelWallTopFt: (levelId, view = 'plan') =>
        LA.levelWallTopFt(drawing?.walls || [], levelId, view),
      // NOT a module function — footingWidthIn is a FIELD on the normalised
      // assembly, and a nullable one: null means "derive from the foundation
      // wall type", ICF on 24" and everything else on 20". I called
      // LA.footingWidthIn() here because I had counted occurrences of the name
      // instead of reading level-assembly.js's export block, and the page
      // swallowed the TypeError into "painter failed". Counting a name is not
      // confirming an export. The two constants are inlined because they are
      // not exported either — MODEL.dc.html, LAYOUT.html and the elevation
      // harness each hold their own pair, and this is the fourth.
      footingWidthIn: levelId => {
        const stored = assemblyFor(levelId).footingWidthIn;
        if (stored) return stored;
        const icf = (drawing?.walls || []).some(wall => wall.levelId === levelId
          && (wall.view || 'plan') === 'foundation'
          && String(wall.wallType || '').startsWith('icf'));
        return icf ? 24 : 20;
      },
      // THE WHOLE DRAWING, NOT THE PAGE'S VIEW OF IT. walls(), roofs(),
      // floors() and outlines() are this page's ON-SCREEN accessors: each one
      // filters to the active level and the active layer view. A section cuts
      // through EVERY level at once — that is what a section is — so handing
      // the painter those filtered lists is a category error, and under a cut
      // view they filter to nothing at all, because no item's `view` is ever
      // "cut:S1".
      //
      // It did not fail loudly. drawCutView falls back to an ELEVATION when
      // the cut crosses no walls, so the page painted a plausible picture from
      // an empty world and every test passed: `ink > 0` is true of an
      // elevation, and nothing asserted a section. Found by running the same
      // cut through proto/elevation-harness.js's env, which reported 8
      // crossings where this one reported none — the third env existing is
      // what made the disagreement visible, and the spec now asserts the
      // crossing count rather than that something was drawn.
      walls: () => drawing?.walls || [],
      roofs: () => drawing?.roofs || [],
      floors: () => drawing?.floors || [],
      // EVERY LEVEL'S ROOM TAGS, for the flooring a shaped one lays.
      roomTags: () => drawing?.roomTags || [],
      // THE WHOLE DRAWING'S COLUMNS, by the same rule as the four above: the
      // elevation draws the piles under a grade beam, and they are filed on
      // FOUNDATION while the drafter may be looking at any level.
      columns: () => drawing?.columns || [],
      fenestrations: () => shellOpenings(),
      garageOutlines: levelId => (drawing?.outlines || [])
        .filter(outline => outline.levelId === levelId && outline.garage),
      // WHICH FOUNDATION A GARAGE HAS. Lifted OUT of this env (see
      // garageFoundationOf above) the day the build needed it too: the
      // section painter asks what kind of concrete to draw and the builder
      // asks what kind of concrete to make, and those must be one question.
      garageFoundation: garageFoundationOf,
      buildType: () => drawing?.buildType ?? null,
      // PROJECT's section-table row for a build type -- a BILEVEL's half-levels
      // stand on its numbers (cut-view.js splitFloorStack).
      sectionRow: rowId => drawing?.sectionTable?.rows?.[rowId] ?? null,
      foundationHoldDown: () => ({ attachment: drawing?.foundationAttachment,
        ladderIn: drawing?.foundationLadderIn }),
      // BOTH ENDS AND THE MIDDLE, as the old page asks it: an edge lying along
      // an outline needs all three on the boundary, or a chord across a
      // concave outline would read as an edge of it. The segment walk comes
      // from geometry-2d.js rather than a private copy.
      edgeOnOutline: (a, b, outline, eps = 0.1) => {
        if (!outline) return false;
        const count = G.outlineSegmentCount(outline);
        const onBoundary = pt => (outline.points || []).some((point, index) => {
          if (index >= count) return false;
          return G.pointToSegment(pt, G.outlineSegment(outline, index)).d <= eps;
        });
        return onBoundary(a) && onBoundary(b)
          && onBoundary({ x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 });
      },
      masterPointById: srcId => masterPointById(srcId),
      gableCornerStyle: () => structureStandards().gableCorner,
      // The sign is suppressed when the drawing carries a datum, because the
      // datum already says what the number is measured from.
      elevLabel: elev => {
        const sign = elev > 0 && !drawing?.elevationDatum ? '+' : '';
        return sign + (drawing?.units !== 'metric'
          ? ftIn(elev) : F.formatMetres(elev));
      },
      ftIn,
      elevationDatum: () => drawing?.elevationDatum ?? null,
      // THE SIZE TAGS READ THE SWITCH TOO (Movie, 1 Oct: "is it possible to
      // adjust the window and door ... dimensions to metric"), so the
      // elevation's W 915 X 1065 agrees with the plan's.
      units: drawing?.units === 'metric' ? 'metric' : 'imperial',
    };
  };

  // ── A ROOM OVER A DETACHED GARAGE LANDS ON CONCRETE ──────────────────────
  //
  // Movie, 13 Oct, on the stair into that room: "they will land about 6"
  // lower than the sill plate , depending on the concrete slab, is there a
  // calculation for that? maybe only 4"".
  //
  // THERE IS, AND IT IS 5 1/2" -- and it is not typed here, it is ASKED of
  // the file that owns the garage's heights. cut-view.js bears a garage's
  // walls on the TOP of their sill plate (garageBearing), puts the top of
  // concrete one plate below that (GARAGE_BEAM_PLATE_IN, 1 1/2") and pours
  // the slab GARAGE_SLAB_THICKNESS_IN (4") below the concrete -- so the
  // finished garage floor is 5 1/2" under the line a stair's rise is
  // otherwise measured from. His two guesses bracket it, and asking cut-view
  // rather than writing 5.5 means a garage that changes foundation, or a
  // slab that changes thickness, moves the stair with it.
  //
  // WHY THE RISE AND NOT THE DRAWING: stairDescent's ordinary answer is
  // "this level's floor package plus the wall below", which lands a flight on
  // the SUBFLOOR of the storey underneath. A detached garage has no subfloor
  // at all -- there is concrete down there -- so a flight sized the ordinary
  // way is short by the whole recess, every riser in it is wrong, and the
  // bottom step floats. The hook it comes in through, `riseFtFor`, is the one
  // the split levels already use for the same reason: levels that do not
  // stack one on the next.
  //
  // NULL IS THE COMMON ANSWER. Every level that is not a room over a detached
  // garage falls through to the ordinary arithmetic.
  //
  // EITHER STOREY ANSWERS, and the pair is not a hedge. The room moved from
  // OVER GARAGE to 2ND FL on 14 Oct (GARAGE_ROOM_LEVEL_ID), and every drawing
  // saved before that has it on OVER GARAGE -- those files open, and a stair
  // in them is still standing on a slab. The id is only a cheap first pass
  // anyway: what actually decides is the test below, one room loop with a
  // DETACHED garage under it, which no house storey can pass.
  const garageSlabDescent = levelId => {
    const CV = window.DraftCutView;
    const LA = window.DraftLevelAssembly;
    const roomLevel = Number(levelId) === GARAGE_ROOM_LEVEL_ID
      || Number(levelId) === OVER_GARAGE_LEVEL_ID;
    if (!CV || !LA || !roomLevel) return null;
    const loops = drawing?.outlines || [];
    const rooms = loops.filter(loop => Number(loop.levelId) === Number(levelId)
      && loop.garage !== true && (loop.points || []).length >= 3);
    if (rooms.length !== 1) return null;
    const [room] = rooms;
    const box = points => {
      const xs = points.map(pt => pt.x), zs = points.map(pt => pt.z);
      return { x0: Math.min(...xs), x1: Math.max(...xs), z0: Math.min(...zs), z1: Math.max(...zs) };
    };
    const over = box(room.points);
    // THE GARAGE UNDER IT, BY ITS MIDDLE RATHER THAN BY CONTAINMENT. The room
    // the build raises has the SAME footprint as the bay, corner for corner,
    // and a strict point-in-ring test reads a shared corner as outside -- so
    // a containment check here would answer "no garage under this room" for
    // the one case this exists for.
    const garage = loops.find(loop => loop.garage === true && garageDetached(loop)
      && (loop.points || []).length >= 3 && (() => {
        const under = box(loop.points);
        const cx = (under.x0 + under.x1) / 2, cz = (under.z0 + under.z1) / 2;
        return cx >= over.x0 - 0.01 && cx <= over.x1 + 0.01
          && cz >= over.z0 - 0.01 && cz <= over.z1 + 0.01;
      })());
    if (!garage) return null;
    // ONE ROOM, AND IT IS THIS ONE -- which is why the list above is counted
    // rather than searched. OVER GARAGE is a LEVEL, and a house's own room
    // over its ATTACHED garage lives on the same one: a drawing holding both
    // has two rooms up there, one landing on concrete and one on a subfloor,
    // and a single rise cannot be right for both. The detached garage is the
    // odd one out, so it gives way and the ordinary arithmetic governs the
    // level. Left here as a known limit rather than mis-sized silently.
    const env = cutEnv();
    const fdn = CV.sectionLevelStack(env)?.foundation;
    if (!fdn) return null;
    // ── BOTH ENDS OFF THE SECTION'S OWN STACK ────────────────────────────
    //
    // Movie, 13 Oct, looking at S1 of a two-storey garage: "stairs go to 0-0
    // but should go down to the slab".
    //
    // THE FIRST CUT OF THIS ADDED A 5 1/2" DROP to the ordinary rise -- one
    // sill plate plus the slab's recess -- on the reading that the garage's
    // walls stand on their bearing line. MEASURED, THEY DO NOT: on a detached
    // garage the model stands its studs at the level datum (0'-0") while
    // cut-view places the concrete off GRADE, which on a plain grade-beam
    // garage puts the slab at -1'-6 1/8" and the bearing at -1'-0 5/8". The
    // flight was sized 10'-2 5/8" and the section drew it to 9'-9 1/8": three
    // numbers, no two alike.
    //
    // So the rise is simply the room's floor MINUS the slab, both read from
    // the stack the SECTION draws with -- which is what makes the drawn
    // flight and the stored riser count the same stair rather than two that
    // agree until something moves.
    //
    // THE GAP BETWEEN THE MODEL'S WALL BASE AND THE DRAWN BEARING IS NOT
    // THIS FUNCTION'S, and it is not hidden here: a detached garage's studs
    // sit about a foot above where its section bears them. Reported rather
    // than papered over, because a stair that reaches the slab is right
    // either way and that one is a question about the garage.
    const stack = CV.sectionLevelStack(env);
    const floorTop = (stack?.floors || [])
      .find(level => Number(level.id) === Number(levelId))?.floorTop;
    const slabTop = CV.garageSlabTop(env, fdn, garage);
    if (!Number.isFinite(floorTop) || !Number.isFinite(slabTop)) return null;
    const riseFt = floorTop - slabTop;
    if (!(riseFt > 0)) return null;
    return { riseFt, landing: 'the garage slab' };
  };

  const stairLevels = () => {
    const LA = window.DraftLevelAssembly;
    const LV = window.DraftLayerViews;
    const all = drawing?.walls || [];
    return {
      floors: (drawing?.levels || [])
        .filter(level => LV.layerViewsForLevelId(level.id).some(view => view.id === 'floor'))
        .slice()
        .reverse(),
      assemblyFor,
      // ON A BILEVEL, THE STACK SAYS HOW FAR. Its levels stand where PROJECT's
      // numbers put them (cut-view.js splitFloorStack), not one storey on the
      // next, so a flight's rise is the drop from its own deck to the deck it
      // lands on. The lowest level -- the landing down to the slab -- keeps
      // the slab arithmetic below, which already agrees.
      riseFtFor: id => {
        // THE GARAGE SLAB IS ASKED FIRST, and it answers for one level only.
        const slab = garageSlabDescent(id);
        if (slab) return slab;
        if (!LA.isSplitType || !LA.isSplitType(drawing?.buildType)) return null;
        const stack = window.DraftCutView?.sectionLevelStack(cutEnv());
        if (!stack || !stack.split) return null;
        const own = stack.floors.find(level => Number(level.id) === Number(id));
        if (!own) return null;
        const below = stack.floors
          .filter(level => level.floorTop < own.floorTop - 1e-6)
          .sort((a, b) => b.floorTop - a.floorTop)[0];
        if (!below) return null;
        return { riseFt: own.floorTop - below.floorTop, landing: `the ${below.name} subfloor` };
      },
      floorFtFor: id => LA.levelFloorFt(assemblyFor(id)),
      // THE HOUSE'S OWN WALLS. A garage's concrete is filed on FOUNDATION
      // too, at its own height, and is not what a basement stair lands under:
      // on a bilevel its 8' beam out-measured the 5'-1 1/2" basement wall and
      // the stair down grew three feet.
      wallTopFtFor: (id, view = 'plan') => {
        const tops = all
          .filter(wall => wall.levelId === id && (wall.view || 'plan') === view
            && wall.body !== 'garage')
          .map(wall => wall.topHeight);
        return tops.length ? Math.max(...tops) : LA.DEFAULT_WALL_TOP_FT;
      },
    };
  };

  // A-STR IS UNCONFIGURED HERE, and that is the bone's own default rather than
  // a stub. _layerStandard(STAIR_LAYER) reads this.state.layerStandards and
  // falls back to `{ name, printable: true, visible: true }` for any layer the
  // drafter has not touched. Layer standards are page state, not drawing data,
  // so this page has none to read and every stair layer is untouched by
  // definition -- the fallback is the whole answer, not a placeholder for one.
  const STAIR_LAYER_STANDARD = Object.freeze({ name: 'A-STR', printable: true, visible: true });

  const paintStairs = () => {
    const R = window.DraftRender2D;
    const SG = window.DraftStairGeometry;
    const LA = window.DraftLevelAssembly;
    const F = window.DraftFormatters;
    const missing = [!R && 'render-2d.js', !SG && 'stair-geometry.js',
      !LA && 'level-assembly.js', !F && 'formatters.js'].filter(Boolean);
    if (missing.length) {
      throw new Error(`MODEL.html: cannot paint stairs, ${missing.join(' and ')} `
        + 'did not load. Check the script order in the page head.');
    }
    // Built ONCE per paint, not per stair: every stair on the level asks the
    // same four questions and wallTopFtFor scans the whole wall array.
    const levels = stairLevels();
    // WHICH STAIRS THIS FLOOR SHOWS, AND HOW (Movie, 16 Oct; stair-geometry
    // stairsShownOn): its own going DN, the ones landing on it going UP,
    // the ones entirely under it lighter. Only the stairs on this view --
    // a stair lives on the plan, and the floor layout shows its well.
    const { levelId: hereId, viewId } = onActiveLevel();
    const views = window.DraftLayerViews.layerViewsForLevelId(hereId);
    const onView = stair => !views.length || stair.view === viewId;
    const shown = SG.stairsShownOn(hereId, (drawing?.stairs || []).filter(onView), levels.floors);
    const roles = new Map(shown.map(entry => [entry.stair, entry.role]));
    R.drawStairs2D(ctx, toS, {
      layer: STAIR_LAYER_STANDARD,
      isPrinting: false,
      stairs: shown.map(entry => entry.stair),
      roleFor: stair => roles.get(stair) || 'own',
      // Inert here for the same reason as the origin marker: toS is a plan
      // projection reading x and z only. Supplied because the painter reads
      // `env.elev || 0` and a caller answers the whole interface.
      elev: 0,
      stairColor: skin['draw-stair'],
      treadRunIn: SG.STAIR_TREAD_RUN_IN,
      layoutFor: stair => SG.stairCurrentLayout(stair, levels),
      partsFor: (stair, layout) => SG.stairPlanParts(stair, layout),
      formatInchesOnly: F.formatInchesOnly,
    });
  };

  // THE DATUM MADE VISIBLE. Tier 2d anchored the grid to the datum but never
  // showed the point itself, so the drafter saw a grid whose origin was
  // inferable only by counting squares. Same three states as the grid, from
  // the same gridDatum(): a point, the back-filled world origin, or nothing.
  //
  // MODEL.dc.html guards this with `!this._isPrinting`. This page never
  // prints, so the guard is the constant `false` and the marker always shows
  // when a datum exists -- which is the whole point of drawing it.
  // Reference images the drafter traces over. The painter refuses four ways
  // and every refusal draws NOTHING -- no placeholder, no outline -- which is
  // deliberate (see palette.js on draw-underlay: an underlay arrives with its
  // own colours and the painter puts no ink of its own on the page).
  const paintUnderlays = () => {
    const R = window.DraftRender2D;
    if (!R) {
      throw new Error('MODEL.html: cannot paint underlays, render-2d.js did '
        + 'not load. Check the script order in the page head.');
    }
    R.drawUnderlays2D(ctx, toS, {
      isPrinting: false,
      underlays: underlays(),
      // The painter reads `.id` and nothing else. MODEL.dc.html hands it
      // `state.levels[state.activeLevelIdx]` -- an INDEX into the level list --
      // and this page has an ID, so it builds the one field the painter asks
      // for rather than pretending to supply a level object.
      activeLevel: { id: activeLevelId() },
      imageFor: id => underlayImages.get(id),
      // A DXF's colour 7 is "the page's ink": white on night, black on day.
      dxfInk: skin['draw-fixture'],
    });
    // THE PICTURE IN HAND GLOWS (Movie, 18 Oct: "allow this item to glow when
    // selected"), so MOVE and ROTATE are plainly about this one -- while it
    // stays drawn behind the plan as it was ("i like how it shows in the
    // background as it does").
    let held = null;
    try { held = photoInHand(); } catch { held = null; }   // not set up yet on the first paints
    if (held && underlays().includes(held)) {
      const a = toS({ x: held.x - held.widthFt / 2, y: 0, z: held.z - held.heightFt / 2 });
      const b = toS({ x: held.x + held.widthFt / 2, y: 0, z: held.z + held.heightFt / 2 });
      ctx.save();
      ctx.strokeStyle = selectHandle();
      ctx.shadowColor = selectHandle();
      ctx.shadowBlur = 14;
      ctx.lineWidth = 3;
      ctx.strokeRect(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.abs(b.x - a.x), Math.abs(b.y - a.y));
      ctx.restore();
    }
    // AND ITS HANDLES while RESCALE is up (the function is written with the
    // verb, further down; by paint time it exists).
    try { paintRescaleHandles(); } catch { /* not wired yet */ }
  };

  // ── THE TWO NORTHS, on the plan and on the button ───────────────────────
  // Movie, 1 Oct: construction north (dark, the main one, a quarter at a
  // time) and true north (grey, a degree at a time) -- shown on the plan, set
  // from the NORTH button's popup. Kept on the drawing's layout record, the
  // key the Construction Layout writes too, so the two pages share one north.
  const northOf = () => (window.DraftNorth
    ? window.DraftNorth.normalise(drawing?.layout?.north) : { cn: 0, tn: 0 });
  let northIconKey = null;
  const paintNorthIcon = () => {
    const button = document.querySelector('[data-north-button]:not([data-north-hit])');
    if (!button || !window.DraftNorth) return;
    const n = northOf();
    const key = `${n.cn}:${n.tn}`;
    if (key === northIconKey) return;
    northIconKey = key;
    button.innerHTML = window.DraftNorth.iconSvg(n);
  };
  // ── THE PAIR, OVER THE RAIL'S TWO COLUMNS ────────────────────────────
  //
  // Movie, 14 Oct: "over in upper right area where the N Arrow is and the box
  // with the ROTATE page, can we make them the same size and center each over
  // the layouts below ... the N arrow would be alot smaller", then "the same
  // color WHITE for both and the NOrth arrow doesn't need a box actually just
  // make them similar size".
  //
  // HALF THE SIZE IT WAS. At r=30 the arrow stood 77px tall beside a 36px
  // button; at 16 the two are a matched pair, which is what he asked for.
  //
  // AND INTO A BOX, 23 Oct (Movie, with a mockup: "update the NORTH arrow
  // make it look like the other button"). The arrow is painted on the face
  // canvas inside its own chip now, the same size as HOUSE turn's and the new
  // ZOOM TO FILL's; r=11 stands its letter and ring inside 40px.
  const NORTH_R = 11;
  const DOCK_CHIP = 40;
  // CENTRED ON THE SEATS THEMSELVES, not on an offset from the right edge.
  // The rail is two columns of thumbnails and those columns are what the pair
  // sits over; measuring them means the pair follows the rail when it is
  // widened (it was, by 15px, four hours ago) instead of drifting off it.
  // Falls back to the old offsets when the rail is not up -- the arrow is
  // still painted on a page with no seats to line up with.
  const railColumns = () => {
    const seats = [...document.querySelectorAll('[data-seat]')].slice(0, 2)
      .map(seat => seat.getBoundingClientRect())
      .filter(box => box.width > 0);
    if (seats.length < 2) return null;
    const box = canvas.getBoundingClientRect();
    const centre = b => b.x + b.width / 2 - box.left;
    // THE TWO COLUMNS, LEFT FIRST. The first row of the rail holds one seat
    // in each, and reading them in document order is reading them left to
    // right -- but only because they are laid out that way, so it is sorted
    // rather than assumed.
    return [centre(seats[0]), centre(seats[1])].sort((a, b) => a - b);
  };
  const northCentre = () => {
    const cols = railColumns();
    return { x: cols ? cols[0] : canvas.clientWidth - 112, y: 96 };
  };
  // THE TWO COLOURS ARE THE MARKS' OWN. Movie, 14 Oct: "the GREEN will match
  // the Site plan registration mark and the Gold will match the HOUSE
  // registration mark". Both are already palette keys -- draw-site-datum and
  // draw-origin -- so they are read from the skin rather than typed again
  // here, and they follow DAY and NIGHT without a second table.
  let northHover = false;
  const northDock = document.getElementById('north-dock');
  // THE SELECT KEYS ON THE DOCK'S LINE (Movie, 24 Oct: "the SELECT /
  // ASSEMBLY / DIMENSION / TRIM buttons should be brough down ... so the
  // text can be read and they will be level /symetrical with the AUTO DIMS /
  // HAND DIMS etc line on the other side"): centred on the row the arrow,
  // the turn and the two DIMS chips stand on, and never over the strip's
  // words.
  const seatSelectBar = () => {
    const bar = document.getElementById('select-bar');
    if (!bar || !bar.offsetHeight) return;
    const mid = canvas.getBoundingClientRect().top + northCentre().y - 28 + DOCK_CHIP / 2;
    // The strip's line is 12px capitals from its top, said or not yet.
    const words = document.getElementById('strip-message')?.getBoundingClientRect();
    const floor = words ? words.top + 12 : 0;
    bar.style.top = `${Math.max(mid - bar.offsetHeight / 2, floor)}px`;
  };
  const seatNorthDock = () => {
    seatSelectBar();
    if (!northDock) return;
    if (!window.DraftNorth || !drawing || driveThruUp()) { northDock.hidden = true; return; }
    // AND NOT ON A CUT VIEW. `paint()` puts the dock away and only a plan
    // paint reaches paintNorth to seat it again -- which was the whole guard
    // until the ResizeObserver at the foot of this file started calling in
    // here directly. The rail re-seats on every view change, so an elevation
    // got the arrow's hand and a turn button back with no arrow under them.
    if (activeCut()) { northDock.hidden = true; return; }
    const box = canvas.getBoundingClientRect();
    const c = northCentre();
    // THREE IN A ROW (Movie's mockup, 23 Oct): the arrow over the rail's
    // first column, ZOOM TO FILL over the second, HOUSE turn halfway between
    // -- the pitch is read off the columns, so the row follows the rail. A
    // chip is 40 wide, so the pitch never closes under 44 or they'd touch.
    const cols = railColumns();
    const pitch = Math.max(DOCK_CHIP + 4, cols ? (cols[1] - cols[0]) / 2 : 45);
    const top = c.y - 28, mid = top + DOCK_CHIP / 2;
    northDock.hidden = false;
    northDock.style.left = `${box.left}px`;
    northDock.style.top = `${box.top}px`;
    [['north-hit', c.x], ['strip-rotate', c.x + pitch], ['strip-fill', c.x + pitch * 2]].forEach(([id, cx]) => {
      const chip = document.getElementById(id);
      if (chip) Object.assign(chip.style, { left: `${cx - DOCK_CHIP / 2}px`, top: `${top}px` });
    });
    seatDimsShow(northDock, c, mid);
    syncNorthHands();
  };
  // THE TWO CHIPS STAND LEFT OF THE ARROW, on its line, and only where there
  // is something for them to do: a level with strings on it, or the
  // DIMENSION tool up.
  var dimsShowBox = null;
  function seatDimsShow(dock, c, midY) {
    if (!dimsShowBox) {
      dimsShowBox = document.createElement('div');
      dimsShowBox.id = 'dims-show';
      dimsShowBox.dataset.dimsShow = '';
      [['auto', 'AUTO DIMS'], ['hand', 'HAND DIMS']].forEach(([kind, label]) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'sel-chip';
        btn.dataset.dimsShow = kind;
        btn.textContent = label;
        btn.title = `${label} -- show or hide them on the sheet`;
        btn.addEventListener('click', () => {
          dimsHidden = { ...dimsHidden, [kind]: !dimsHidden[kind] };
          try { localStorage.setItem('model.dimsHidden', JSON.stringify(dimsHidden)); } catch (e) {}
          // A string out of sight is out of hand too.
          if (dimsHidden[kind] && selection.some(en => en.type === 'dimension' && dimKind(en.item) === kind)) {
            setSelection(selection.filter(en => !(en.type === 'dimension' && dimKind(en.item) === kind)));
          }
          paint();
        });
        dimsShowBox.append(btn);
      });
      dock.append(dimsShowBox);
    }
    const any = dimensions().length > 0 || activeTool === 'dimension';
    dimsShowBox.hidden = !any;
    if (!any) return;
    dimsShowBox.querySelectorAll('[data-dims-show]').forEach(btn => {
      btn.setAttribute('aria-pressed', String(!dimsHidden[btn.dataset.dimsShow]));
    });
    const w = dimsShowBox.offsetWidth, hgt = dimsShowBox.offsetHeight;
    dimsShowBox.style.left = `${c.x - DOCK_CHIP / 2 - 10 - w}px`;
    dimsShowBox.style.top = `${midY - hgt / 2}px`;
  }
  // THE ARROW LIGHTS UNDER THE HAND, and it has to be wired rather than
  // styled: the needles are painted on the CANVAS, so no :hover rule can
  // reach them. The invisible hand over them is what the pointer actually
  // meets, so it carries the flag and asks for a repaint.
  //
  // ONE REPAINT PER CROSSING, not per move: the flag is only written when it
  // changes, because `paint()` redraws the whole plan and a mousemove handler
  // that repainted on every event would do it sixty times a second for a
  // halo that is already on screen.
  const setNorthHover = on => {
    if (northHover === on) return;
    northHover = on;
    paint();
  };
  {
    const hand = document.getElementById('north-hit');
    if (hand) {
      hand.addEventListener('pointerenter', () => setNorthHover(true));
      hand.addEventListener('pointerleave', () => setNorthHover(false));
      // FOCUS COUNTS TOO, so the keyboard sees what the mouse sees.
      hand.addEventListener('focus', () => setNorthHover(true));
      hand.addEventListener('blur', () => setNorthHover(false));
    }
  }

  // A PRESS THERE IS A CORNER WHILE A TOOL IS ARMED. The arrow was paint
  // before 12 Oct and a wall or an outline could be started under it; the
  // hand only catches a press when nothing is being drawn. Asked again from
  // stripRefresh, which every tool change runs, as well as from the seat.
  // AND THE DRIVE-THRU BOARD PUTS THEM AWAY WHILE IT IS UP: its trace and its
  // tiles are the job then, and the arrow's corner of the sheet is where a
  // traced house's corner lands as often as anywhere.
  const driveThruUp = () => {
    const board = document.getElementById('drivethru');
    return !!board && !board.hasAttribute('data-shut');
  };
  const syncNorthHands = () => {
    if (northDock && driveThruUp()) northDock.hidden = true;
    const drafting = activeTool !== RESTING_TOOL;
    ['north-hit', 'strip-rotate', 'strip-fill'].forEach(id => {
      const b = document.getElementById(id);
      if (b) b.style.pointerEvents = drafting ? 'none' : '';
    });
  };
  const paintNorth = () => {
    seatNorthDock();
    if (!window.DraftNorth || !drawing) return;
    // WHITE, AND GREEN WHEN THE HAND IS OVER IT. Movie, 14 Oct: "make them
    // glow green for the north arrow if a user passes the mouse over ... make
    // it glow from the WHITE part like it is being iluminated in that color
    // but alow a 'glow ' around it" / "around the white lettering which is
    // tinted with the color".
    //
    // THE INK STAYS WHITE AND THE HALO CARRIES THE COLOUR, which is what
    // "illuminated in that color" is -- a needle painted flat green would
    // read as a different arrow rather than a lit one.
    //
    // ON THE CHIP'S OWN FACE since 23 Oct, not on the sheet: the arrow lives
    // in a box like its neighbours now, so it is drawn where the box is and
    // goes wherever the box goes, with nothing left to split from. Painted
    // once per change of north or hand, not once per frame.
    const face = document.querySelector('[data-north-face]');
    if (!face) return;
    const n = northOf();
    const key = `${n.cn}:${n.tn}:${northHover ? 1 : 0}:${face.clientWidth}`;
    if (face.dataset.painted === key) return;
    face.dataset.painted = key;
    const dprNow = window.devicePixelRatio || 1;
    const side = Math.max(1, face.clientWidth || 38);
    face.width = Math.round(side * dprNow); face.height = Math.round(side * dprNow);
    const fx = face.getContext('2d');
    fx.setTransform(dprNow, 0, 0, dprNow, 0, 0);
    fx.clearRect(0, 0, side, side);
    // THE LETTER STANDS 1.55 r ABOVE THE CENTRE and the ring 0.62 r below:
    // the centre sits a little low so the whole of it is inside the face.
    window.DraftNorth.drawPair(fx, side / 2, side / 2 + NORTH_R * 0.4, NORTH_R, n, {
      cnColor: '#ffffff',
      tnColor: 'rgba(255,255,255,0.72)',
      glow: northHover ? (skin['draw-site-datum'] || '#6a9a57') : null,
      glowWidth: NORTH_R * 1.2,
    });
  };

  const paintOrigin = () => {
    const R = window.DraftRender2D;
    if (!R) {
      throw new Error('MODEL.html: cannot paint the origin, render-2d.js did '
        + 'not load. Check the script order in the page head.');
    }
    // elev is inert here and passed anyway: toS is a plan projection reading
    // x and z only, so the y it builds is dropped. Supplied rather than
    // omitted because the painter reads `env.elev || 0` and a caller should
    // answer the whole interface, not the part that happens to be observable.
    R.drawOrigin2D(ctx, toS, {
      datum: gridDatum(),
      elev: 0,
      colors: { origin: skin['draw-origin'] },
    });
    // ── AND THE LOT'S OWN MARK (Movie, 13 Oct) ─────────────────────────────
    //
    // "the SITE PLAN will need a seperate registration mark make it a GREEN
    // TARGET - it should be located at the corne were E1 and E2 are front and
    // left side corner".
    //
    // THE SAME PAINTER, A SECOND TIME. A target is a target: giving the site
    // its own drawing code would be two marks that could drift apart in
    // shape, and the only things that differ are WHERE it stands and what
    // colour it is -- which is exactly what this painter takes.
    //
    // WHERE IS READ OFF THE LOT'S CORNERS, not stored: lot-sizes' siteDatumOf
    // answers min x / max z, the corner E2 and E1 share, and re-reads it
    // after the drafter has dragged the lot out of square. That is the whole
    // reason the lot is an outline.
    //
    // ONLY WHERE THERE IS A LOT. A drawing with no site plan has no second
    // datum, and a mark at 0,0 "ready for one" would be a registration point
    // for a lot nobody has drawn.
    const lot = window.DraftLotSizes.siteOutlineOf(drawing?.outlines);
    // ── THE BUILDING'S FOOTPRINT, ON THE SITE LEVEL ──────────────────────
    //
    // Movie, 14 Oct: "also show a 'footprint shape' of the building on the
    // site plan. is that possible". It is the same drawing LAYOUT's SITE
    // PLAN sheet paints -- layout-plan.js's drawSitePlan, the lot line, the
    // footprint and the eave -- so the sheet and the screen cannot disagree
    // about where his building sits on his lot.
    //
    // ONLY ON SITE. Every other level draws its own storey; the footprint
    // here is context for dragging the lot around, which is the one thing a
    // drafter does on this level.
    if (activeLevelId() === SITE_LEVEL_ID && window.DraftLayoutPlan) {
      ctx.save();
      // AND THE PROPERTY LINE IN THE SKIN'S INK (Movie, 14 Oct: "on the
      // NIGHT make them bright thick white"). The sheet paints it black,
      // which is right on paper and invisible on this page's black ground,
      // so the ink is the one thing the screen hands the painter.
      window.DraftLayoutPlan.drawSitePlan(ctx, toS, drawing, {
        siteLineInk: skin['draw-site-line'],
        // AND THE TOP PLATES THE ROOF RESTS ON (Movie, 14 Oct: "please show
        // the outline of the top plates of walls that the roof rests on that
        // are n the roof plan - show those lines also in the site plane").
        // The footprint here IS the roof plan, so it has carried those lines
        // since the footprint did -- in the sheet's paper ink, which on this
        // page is black on a black ground. The ROOF level draws them in this
        // same skin ink (paintRoofs), so the two plans now agree.
        wallTopInk: skin['draw-wall-edge'] || skin['draw-line'],
        // AND THE SITE'S DIMENSION ROWS IN THE SKIN'S OWN BLUE. The sheet's
        // table is written for white paper; on this page the strings are
        // every other dimension's colour, which is the one a drafter already
        // reads as "a measurement" here.
        siteDimColors: {
          stroke: skin['draw-dim'],
          selected: skin['draw-selected'],
          selectedHalo: 'rgba(89,128,166,0.35)',
          preview: skin['draw-dim'],
          labelBack: skin['surface-page'],
        },
      });
      ctx.restore();
    }
    // THE TURN GOES WITH IT. The mark stands where E1 and E2 cross, and
    // cut-marks moves those two with the drawing's planTurn -- so the lot's
    // own corner has to be asked the same question the house's was.
    const siteDatum = lot
      ? window.DraftLotSizes.siteDatumOf(lot, drawing?.planTurn || 0) : null;
    if (siteDatum) {
      R.drawOrigin2D(ctx, toS, {
        datum: siteDatum,
        elev: 0,
        colors: { origin: skin['draw-site-datum'] },
      });
    }
  };

  // THE FRAME TIME IS AN INSTRUMENT, not a test hook. Measured here rather
  // than in the spec because the page offers nothing to time from outside:
  // dispatching a resize and timing it measures canvas REALLOCATION, which on
  // this fixture swamped the paint so completely that fifty section paints per
  // frame moved the median from 0.20ms to 0.90ms and the budget check still
  // passed. A check that survives fifty times the work is not a check, and the
  // number it produced was not the section's cost. This times the paint body
  // and nothing else, and the readout carries it, so what the spec asserts is
  // the same number a drafter can see on a slow drawing.
  let lastPaintMs = 0;
  let lastRailMs = 0;

  // ── HOW MUCH OF THE CANVAS THE RAILS ARE SITTING ON ──────────────────────
  //
  // Movie, 22 Sep, on an elevation with both rails open: *"when the side menus
  // are open they cover the drawing in elevation, can we make the zoom for the
  // elevations so the house is a little smaller and there is more white around
  // the edges and sides so these menus when expanded don't cover it"*.
  //
  // MEASURED, NOT TYPED. Both rails are `position:fixed` overlays and this
  // canvas is painted the full width underneath them, so what they cover is
  // their own bounding boxes -- which are CSS, and which CHANGE: the right one
  // is bounded at 277px but shrink-to-fit under that, and either can be
  // collapsed to a seat. The comment beside that `max-width:277px` already
  // records what guessing costs: "An estimate that is nearly right is a panel
  // that nearly stays off the sheet."
  //
  // AGAINST THE CANVAS, not the window, because the canvas is what the painter
  // measures its margins from and the two need not share an origin.
  //
  // ONLY THE SIDES. The rails run nearly the full height, so asking for their
  // height as a top and bottom margin would leave the drawing nothing to grow
  // into; the painter takes the greater of what it is handed and its own
  // default, and its own defaults are what top and bottom keep.
  // RESERVED WHETHER THE RAIL IS OPEN OR SHUT, which is a change from what
  // this did until 24 Sep and Movie's own correction:
  //
  //   "when the collapsable menus on the side are closed can the screen scale
  //    stay the same with the extra little white area. it looks nicer with
  //    more space / smaller drawing" ... "so it would be this same size (not
  //    change) when the sidemenus close"
  //
  // It measured the rails LIVE, so shutting one handed the elevation back its
  // width and the house grew to fill it -- the drawing changing size because
  // of a menu, which is the drafter's furniture rearranging his drawing.
  // Reserving the space always means the toggle does nothing to the house and
  // the room the rail was in becomes white paper.
  //
  // A SHUT RAIL IS STILL MEASURED, not guessed at. `display:none` reports a
  // zero box, so the rail is un-hidden, measured and re-hidden inside one
  // statement -- the browser paints between frames, never between two lines of
  // JavaScript, so nothing flashes. That keeps the promise the old comment
  // made ("MEASURED, NOT TYPED"), which matters more here than it looks: the
  // right rail is shrink-to-fit under its 277px bound and the left one holds
  // whatever tools the page has, so a typed constant would be wrong the first
  // time either changed. The comment beside that `max-width` already records
  // what guessing costs -- "An estimate that is nearly right is a panel that
  // nearly stays off the sheet."
  //
  // AND IT ONLY EVER GROWS, per side, for the session. The right rail resizes
  // when its pane changes, and a reservation that followed it down would move
  // the house every time the drafter switched panes -- the same defect one
  // step smaller. High-water mark: the drawing settles at the widest the rail
  // has been and stays there.
  // ── AND THE FOOT BAR IS FURNITURE TOO ─────────────────────────────────────
  //
  // Movie, 26 Sep: "see how the footing bottom line is just under the
  // dashboard line where the tint starts - could we make the house just a
  // little smaller so that the bottom of the footing doesnt cross over the
  // 'tint' line of the lower bar ... but allow the piles to extend past that
  // tint line", and then, twice: "rather than moving the house up, make it
  // smaller scale slightly so it fits and gets smaller too" ... "the position
  // is nice centered basically how it is just need it smaller".
  //
  // #house-strip IS `position:fixed; bottom:0` OVER THE CANVAS, exactly like
  // the rails, and exactly like them it was covering a drawing painted the
  // full height underneath it. Measured at 1366x700, twoStorey-garage E1: the
  // bar's top edge -- the tint line he is pointing at -- at y 636, the
  // footing's dashed bottom at y 655, nineteen pixels INSIDE the bar.
  //
  // WHICH IS WHY THIS IS A MARGIN AND NOT A NUDGE. Reserving the bar makes
  // the painter's own height fit shorter, and pxPerFt is the smaller of what
  // the width allows and what the height allows -- so the house scales down
  // to fit rather than sliding up out of the way, which is the correction he
  // made himself while looking at it. The 2 ft of pile room below the footing
  // is the painter's to let overflow; the note at `yFit` in cut-view.js has
  // that half.
  //
  // MEASURED LIVE, NOT A HIGH-WATER MARK. A rail is reserved whether it is
  // open or shut because a drafter toggles those and a drawing that resized
  // with them would be furniture rearranging the sheet. The bar has no
  // toggle: it is always there, the same height, so what it covers now is
  // what it covers.
  const railReserve = { left: 0, right: 0 };
  // ── THE STAIR WORKSPACE ───────────────────────────────────────────────────
  //
  // Movie, 7 Oct: "on the MODEL.DC.html i could bring up the STAIR SECTION -
  // it would show a full page with 2 views ... can you find that and bring
  // it over". A level's STAIR layer view is that page: the carpenter's stair
  // section on top and the down-view plan below, on one horizontal scale, for
  // the last stair placed on the level's PLAN. A press on a pane fills the
  // canvas with it; a press again returns to the split. The painting is
  // stair-section.js, the same code MODEL.dc.html draws it with.
  let stairPane = 'split';
  const stairWorkspaceOn = () => Boolean(drawing) && !activeCut() && activeViewId() === 'stair';
  const workspaceStair = () => {
    const levelId = Number(activeLevelId());
    const list = (drawing?.stairs || []).filter(st => Number(st.levelId) === levelId
      && (st.view || 'plan') === 'plan');
    return list.length ? list[list.length - 1] : null;
  };
  // CLEAR OF THE FURNITURE: the rails either side, the house strip below,
  // and the instrument strip across the top, which the canvas runs under.
  const stairWorkspaceBox = () => {
    const mg = furnitureMargins() || { left: 0, right: 0, bottom: 0 };
    const strip = document.getElementById('strip');
    const cr = canvas.getBoundingClientRect();
    const sr = strip && !strip.hidden ? strip.getBoundingClientRect() : null;
    const top = sr && sr.height > 0 ? Math.max(0, sr.bottom - cr.top) : 0;
    return { x: mg.left, y: top, w: Math.max(40, cssW - mg.left - mg.right),
      h: Math.max(40, cssH - mg.bottom - top) };
  };
  const paintStairWorkspace = () => {
    const box = stairWorkspaceBox();
    const F = window.DraftFormatters;
    const LA = window.DraftLevelAssembly;
    const level = (drawing.levels || []).find(l => Number(l.id) === Number(activeLevelId()));
    ctx.save();
    ctx.translate(box.x, box.y);
    // Which pane is up, for anything reading the page rather than its pixels.
    canvas.dataset.stairPane = workspaceStair() ? stairPane : 'empty';
    window.DraftStairSection.drawWorkspace(ctx, box.w, box.h, workspaceStair(), {
      levels: stairLevels(),
      levelName: level?.name,
      mode: stairPane,
      printing: false,
      floorFt: levelId => LA.levelFloorFt(assemblyFor(levelId)),
      ftIn: ft => F.formatArchitecturalInches(ft * 12),
      inchesOnly: inches => F.formatInchesOnly(inches),
      walls: () => drawing.walls || [],
      floors: () => drawing.floors || [],
      openingsFor: (kind, id) => (drawing.surfaceOpenings || []).filter(o =>
        o.hostType === kind && String(o.hostId) === String(id) && (o.points || []).length >= 3),
    });
    ctx.restore();
  };

  const furnitureMargins = () => {
    const canvas = ctx && ctx.canvas;
    const box = canvas && canvas.getBoundingClientRect
      ? canvas.getBoundingClientRect() : null;
    if (!box || !(box.width > 0)) return null;
    ['#left-rail', '#right-rail'].forEach(sel => {
      const rail = document.querySelector(sel);
      if (!rail) return;
      const wasHidden = rail.hidden;
      if (wasHidden) rail.hidden = false;
      const r = rail.getBoundingClientRect();
      if (wasHidden) rail.hidden = true;
      if (!(r.width > 0) || !(r.height > 0)) return;
      // A rail overhanging the canvas' left edge eats from the left, one
      // overhanging its right eats from the right; a rail that somehow sits
      // clear of the canvas eats nothing.
      if (r.right > box.left && r.left < box.left + box.width / 2) {
        railReserve.left = Math.max(railReserve.left, r.right - box.left + 8);
      } else if (r.left < box.right && r.right > box.left + box.width / 2) {
        railReserve.right = Math.max(railReserve.right, box.right - r.left + 8);
      }
    });
    // WHAT THE BAR COVERS OF THE CANVAS, which on a page whose canvas runs to
    // the window's foot is the bar's own height and on one that stops short
    // of it is less -- or nothing. No clearance is added: the painter keeps
    // its own inset from whatever its bottom edge turns out to be, which is
    // the "little space" and is the same white it holds against a bare canvas.
    const strip = document.querySelector('#house-strip');
    const sr = strip && !strip.hidden ? strip.getBoundingClientRect() : null;
    const bottom = sr && sr.height > 0
      ? Math.max(0, Math.min(box.bottom, sr.bottom) - Math.max(box.top, sr.top)) : 0;
    return { left: railReserve.left, right: railReserve.right, bottom };
  };

  // The whole of what the painter reads from the furniture, as one comparable
  // value.
  const railKey = mg => (mg ? `${mg.left},${mg.right},${mg.bottom}` : '');

  // WHAT THE RAILS COVERED WHEN THE DRAWING ON SCREEN WAS PAINTED, or null if
  // what is on screen is not a cut view -- a plan does not read them. The
  // observer at the foot of this file compares against it, so "is this drawing
  // out of date" is answered by what was actually used rather than by guessing
  // at the order boot and layout happen in.
  let paintedForRails = null;

  // THE DRAG'S DISTANCE INTO LENGTH, set where the drag state lives (below)
  // and called from every paint -- a drag repaints on each move it makes.
  // A `var`, so a paint before that line has run finds it empty, not dead.
  var syncDragLength = null;
  // WHICH PAINT THIS IS, for what is worked out once a frame.
  var paintFrame = 0;
  const paint = () => {
    paintFrame += 1;
    if (syncDragLength) syncDragLength();
    const t0 = performance.now();
    // Hand dimensions onto the corners they were put on, before anything draws.
    if (typeof followDimLinks === 'function') followDimLinks();
    if (typeof followRoomLinks === 'function') followRoomLinks();
    // THE ARROW'S HAND AND HOUSE ROTATE GO WITH THE ARROW: put away here and
    // seated again by paintNorth, which only a plan paint reaches -- so an
    // elevation or a section shows neither a click over nothing nor a turn
    // button beside an arrow that is not there.
    if (northDock) northDock.hidden = true;
    if (typeof syncBoneGoes === 'function') syncBoneGoes();
    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);
    ctx.fillStyle = skin['surface-page'];
    ctx.fillRect(0, 0, cssW, cssH);
    try {
      // THE SECTION INSTEAD OF THE PLAN, when a cut is the active view. The
      // painter is the shared one (cut-view.js), reading through cutEnv()'s
      // eighteen accessors — the same contract MODEL.dc.html supplies and the
      // same one proto/elevation-harness.js mirrors offline.
      const cut = drawing ? activeCut() : null;
      if (!stairWorkspaceOn()) delete canvas.dataset.stairPane;
      if (cut) {
        const rails = furnitureMargins();
        paintedForRails = railKey(rails);
        // IN THE SKIN, like everything else on this page. Movie, 24 Sep,
        // looking at a white elevation over a night page: "would it be
        // possible to make the background of the elevations black when in
        // NIGHT mode? ... or should we reverse the lines to white? like on
        // the PROJECT Sections?" The line above this one already cleared the
        // canvas to skin['surface-page']; drawCutView then painted straight
        // over it with its own #fafafa, because it was handed no colours and
        // paper is what it assumes.
        //
        // THE PAINTER IS SHARED, so the skin is passed IN rather than known
        // there: the Construction Layout draws these same elevations as
        // viewports on a sheet that gets printed, and that one says nothing
        // and keeps its paper. inksFromSkin is cut-view's own translation
        // from palette roles to the eight things it draws.
        //
        // AND PRINTSCREEN IS ALREADY RIGHT because this reads the live
        // `skin`: inDaylight swaps it to day for the length of the shoot, so
        // a drafter working at night still hands a client a white drawing.
        window.DraftCutView.drawCutView(cutEnv(), ctx, cssW, cssH, cut,
          // AND A TENTH OF THE DRAWING OF AIR ROUND IT (Movie, 23 Oct: "make
          // sure it zooms out to show the entire building in addition to
          // the ELEVATION marks on the side ... about 10% extra cushion").
          { margins: rails, cushion: 0.1, colors: window.DraftCutView.inksFromSkin(skin),
            // THE EXISTING HOUSE UNDER IT (hologram PR 5): called back with
            // the frame, before this drawing's own lines.
            ...(window.DraftHologram ? window.DraftHologram.cutOptions(ctx, cssW, cssH, cut, drawing,
              { show: hologramShow, paperColor: skin['surface-page'],
                colors: window.DraftCutView.inksFromSkin(skin) }) : {}),
            // The frame comes back so a press can be read in the view's feet,
            // and the line being drawn and the mark held are shown in place.
            // Read by the specs too (tests/clipped-gable.spec.js), which
            // measure the fit from the frame rather than by hunting ink.
            onFrame: f => {
              elevFrame = f; window.__elevFrame = f;
              if (!elevPinned(cut)) elevFitPx = f.pxPerFt;
            },
            // Zoomed or panned by hand: the painter draws in this frame.
            ...(elevPinned(cut) ? { frame: elevPin } : {}),
            selectedMark: elevSelected,
            selectColor: skin['draw-selected'],
            markPreview: (activeTool === 'line' && elevLineStart && elevCursor)
              ? { kind: 'line', a: elevLineStart, b: elevCursor }
              : (activeTool === 'annotation' && elevPointerTip && elevCursor)
                ? { kind: 'note', at: elevCursor, tip: elevPointerTip, text: '', end: noteEnd }
                : null });

        // THE MASK CLIMBS BOTTOM TO TOP, dotted underground first, footing to
        // ridge -- the order a house is actually built in, which is why the
        // elevation is the view this plays on. Self-driving: each frame asks
        // for the next until the clip has left the canvas.
        //
        // IT PAINTS IN THE SKIN, not a literal. The dc page filled '#fafafa',
        // which is a WHITE curtain over a night drawing -- correct on the old
        // page's white ground and wrong on all four of this one's skins. The
        // curtain is the page's own ground, so it is surface-page.
        if (revealActive) {
          const elapsed = performance.now() - revealStart;
          const clipY = window.DraftTour.revealClipY(
            elapsed, window.DraftTour.REVEAL_MS, cssH + 10, -10);
          ctx.save();
          ctx.fillStyle = skin['surface-page'];
          ctx.fillRect(0, 0, cssW, Math.max(0, clipY));
          ctx.restore();
          if (elapsed <= window.DraftTour.REVEAL_MS) requestAnimationFrame(paint);
          else {
            revealActive = false;
            // THE CURTAIN IS DOWN, so the house has been seen and the lot is
            // the next question. On its own tick: askAboutTheSite goes to a
            // level, which paints, and paint is the function we are inside.
            if (askSiteWhenShown) {
              askSiteWhenShown = false;
              setTimeout(askAboutTheSite, 0);
            }
          }
        }
      } else if (stairWorkspaceOn()) {
        paintedForRails = null;
        paintStairWorkspace();
      } else if (drawing) {
        paintedForRails = null;
        paintGrid();
        // "Underlays sit beneath everything drawn: over the grid, under
        // geometry" -- MODEL.dc.html's own words at the same seam. A tracing
        // image that painted over the walls would be worse than none.
        if (traceOn) paintUnderlays();
        // The hologram with them: under everything this drawing draws.
        paintHolograms();
        // NEW OFF (hologram DEMO switches): the existing house and what is
        // coming out of it, without this drawing's own work over them.
        // Only while there is a hologram to look at instead.
        const showOwn = hologramShow.new || !holograms().some(holo => !holo.hidden);
        if (showOwn) {
        paintBackgrounds();
        paintHalfLevelGhostFloors();
        paintFloors(); paintRoofs(); paintShapes(); paintStructure();
        // THE BEAM UNDER THIS FLOOR, after the structure ON it and before the
        // openings above, which is the order they stack in the building.
        paintBeamsBelow();
        // AND THE BEAM OVER THIS PLAN, dash-dot and lighter (the overhead
        // convention), in the same slot: structure first, then what is read
        // against it.
        paintBeamsAbove();
        paintOverheadLines();
        // AFTER THE STRUCTURE IT SITS OVER, before the walls. An opening above
        // is context for what this level carries, so it reads over the pads
        // and the beam -- which is the order a drafter looks in: the hole is
        // why the beam lands where it does.
        paintOpeningsAbove();
        paintOutlines();
        paintHalfLevelGhost();
        paintBasementFoundationGhost();
        // The WC tile under the walls, so their fill stops it at the face,
        // and the room shapes with the flooring they lay, in the same slot.
        paintRoomShapes();
        paintWetFloors();
        paintLines(); paintWalls();
        // THE DOOR BUCKS, over the concrete they are cut from (Movie, 16 Oct).
        paintDoorBucks();
        // Fixtures ride ON the walls, so they go after them and before the
        // annotation -- the slot the bone puts them in (MODEL.dc.html:6993,
        // straight after the wall and opening passes and well before the
        // dimensions at 6960's tail).
        paintFixtures();
        // Stairs sit with the geometry, not the annotation, and after the
        // fixtures for the slot the bone puts them in (MODEL.dc.html:7018 --
        // straight past the fixture and beam passes, and well before the
        // selection highlight and the dimension strings).
        paintStairs();
        // THE SUPER NODES, over the geometry they mark (desk furniture:
        // never on a sheet, never in a PRINTSCREEN).
        paintSuperNodes();
        paintAnchors();
        paintRefGuide();
        // LAST, because dimensions are annotation: MODEL.dc.html paints them
        // after the walls and lines (6960) so a string is never buried under
        // the geometry it measures.
        paintDimensions();
        // The selection highlight sits where MODEL.dc.html puts it: after the
        // dimension strings (:6960) and immediately before the cut marks
        // (:7380 against :7432), so the highlight is never buried under the
        // geometry it marks but never covers the annotation either.
        paintSelection();
        // ── AND WHAT A PICKED OPENING IS FROM ITS CORNERS ─────────────────
        //
        // OUTSIDE paintSelection, which returns early when nothing is
        // picked. Inside it the readout drew correctly and never CLEARED: a
        // drafter who clicked a window and then clicked off it kept two
        // numbers on the canvas measuring a selection that was gone, because
        // the only code that could take them down was the code that does not
        // run when there is no selection.
        openingCornerDims(ctx, toS);
        // AFTER the selection, so a hovered corner of a selected wall reads as
        // the ring over its own handle rather than under it.
        paintHoverCorner();
        paintBand();
        paintStretch();
        paintHologramHover();
        // Cut marks go with the annotation rather than the geometry: they are
        // a fact ABOUT the drawing, and the bone paints them late for the same
        // reason (MODEL.dc.html:7432, after every piece of linework and just
        // before the outline guide).
        paintCuts();
        // Notes ride with the dimensions, for the same reason and in the same
        // place the bone puts them (MODEL.dc.html:7025, immediately after the
        // dimension pass): annotation goes over the geometry it annotates.
        paintNotes();
        // Room tags are annotation too, and go down with the notes.
        paintRoomTags();
        }
        // The datum marker goes on top of everything, as it does in the old
        // page (MODEL.dc.html:6956, immediately before the committed lines):
        // it is the one point the drafter must always be able to find.
        paintOrigin();
        paintNorth();
        paintNorthIcon();
        paintTrackingRays();
        // ── THE WALL IN HAND ────────────────────────────────────────────
        //
        // Movie, 27 Sep: *"after the first point for wall is made a dotted
        // line should show the line position as the user moves the cursor so
        // the user can see where it will go when he pressed the button"*.
        //
        // THE ANCHOR RING WAS ALL THERE WAS, and it earned its own note:
        // without it the first tap of a two-tap gesture has no visible effect
        // at all, which is indistinguishable from the tap not registering. The
        // ring says A PRESS LANDED. It does not say WHERE THE WALL WILL GO,
        // which is a different question and the one Movie is asking -- he had
        // a live length by the cursor and no line to hang it on.
        //
        // wallEnv's own note has been waiting for this since the env was
        // written: *"this page's wall gesture commits on the second tap and
        // paints no ghost between them, so `preview` is the constant false ...
        // wiring a rubber-band preview up later must not be the moment someone
        // discovers the key was missing"*. It isn't. The keys were there.
        //
        // THE GHOST IS THE WALL, NOT A LINE WHERE THE WALL WILL BE. It goes
        // through drawWallSeg2D like every committed wall, so it carries the
        // assembly's real WIDTH and sits on the real SIDE of the drawn line --
        // and it takes those from wallShape, which is the same function the
        // commit takes them from. A bare centreline would have been three
        // lines of code and would have lied about the one thing a drafter
        // aiming a 12" ICF at a corner needs to see.
        //
        // AND THE DASH IS ON TOP OF IT, which is Movie's word answered
        // literally and for the reason the ruler's line is dashed: it is the
        // only mark on the sheet that is not in the drawing yet, and the dash
        // is how a drafter knows that without being told. At a normal zoom a
        // 6" wall is four pixels wide and the ghost alone -- 0.45 alpha, thin
        // pale edges -- reads as a smudge over the grid, which is the
        // complaint rather than the fix.
        //
        // THE FAR END IS runInHand's, NOT THE CURSOR'S, and that is the whole
        // reason this band can be trusted. drawPoint is what squares to the
        // T-square, lands on the whole foot under TOY and catches an open end;
        // the raw cursor does none of it. §1 already had to settle this for
        // the length readout -- *"the same number commitWall will receive, not
        // the cursor measured separately -- two readings of one distance
        // drift, and the drafter believes the one he can see"* -- and a band
        // drawn to the cursor while the wall commits a foot away is that
        // failure in its worst form: the drafter aims by the line.
        if (drawStart) {
          const run = runInHand();
          const R = window.DraftRender2D;
          // THE TOOL, ASKED HERE AND NOT ONLY IN runInHand. setTool clears
          // drawStart on every tool change, so this cannot fire today -- but
          // runInHand falls through to the RULER's run when the wall's does not
          // match, and a stale drawStart would put a WALL ghost along a ruler
          // measure. One clause against a whole class of surprise, and it
          // states out loud whose mark this is.
          if (drawsRun() && run && R
            && Math.hypot(run.to.x - run.from.x, run.to.z - run.from.z) > 0.001) {
            const ghost = { start: run.from, end: run.to, ...wallShape(brushOptions('wall')) };
            // JOINS NULL, WHICH GIVES CAPPED ENDS, and capped is the honest
            // preview: the wall is not joined to anything yet. Mitring it
            // would need the ghost in wallJoins alongside the real walls,
            // which classifies on vertex identity -- so the ghost would
            // reshape a REAL wall's corner mid-gesture and unshape it again
            // if the drafter pressed escape.
            // A LINE HAS NO THICKNESS TO SHOW, so it is the dash alone.
            if (activeTool === 'wall') R.drawWallSeg2D(ctx, toS, ghost, true, null, 'both', wallEnv());
            const a = toS(run.from), b = toS(run.to);
            ctx.save();
            // THE WALL'S OWN EDGE INK, not the accent. wallEnv's note settles
            // the tone: *"A preview wall is the same wall a moment earlier, so
            // committed-looking is the honest placeholder; loud would be
            // wrong."* The dash carries the "not yet"; the colour carries the
            // "this is a wall".
            ctx.strokeStyle = skin['draw-wall-edge'];
            ctx.setLineDash([6, 4]);
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
            ctx.restore();
          }
          const p = toS(drawStart);
          ctx.save();
          ctx.strokeStyle = skin['accent'];
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
          // THE LOCKED BEARING, across the sheet through the start, so the
          // drafter sees the rail the run is on before he moves along it.
          const lock = angleLockDeg();
          if (lock != null) {
            const rad = lock * Math.PI / 180;
            const far = 10000 / view.scale;
            const a = toS({ x: drawStart.x - Math.cos(rad) * far, z: drawStart.z + Math.sin(rad) * far });
            const b = toS({ x: drawStart.x + Math.cos(rad) * far, z: drawStart.z - Math.sin(rad) * far });
            ctx.save();
            ctx.strokeStyle = skin['accent'];
            ctx.globalAlpha = 0.45;
            ctx.setLineDash([2, 6]);
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
            ctx.restore();
          }
        }
        // THE CUT BEING PLACED. Without this the three presses land on a
        // sheet that never changes, which is the defect the outline tool had
        // and is the reason a drafter cannot tell a press that missed from a
        // press that worked.
        //
        // AND THE ARROW IS THE OPPOSITE OF WHAT GETS STORED, by construction
        // rather than by a second copy of the rule: the arrow shows the way
        // the view will LOOK, the file keeps where the viewer STANDS, and the
        // one is negated from the other here so the preview cannot drift from
        // the commit.
        // THE WASHROOM IN HAND, where a press would drop it: its walls as
        // bands, its fixtures and door in the preview's faint ink, the tile
        // floor showing it is the room it will be.
        if (activeTool === 'fixture' && washroomPreset && cursorWorld) paintWashroomPreview();
        // THE DIMENSION STRING IN HAND.
        if (activeTool === 'dimension') paintDimPreview();
        // THE ROOF NODE IN HAND (MOVE).
        paintRoofMoveNode();
        // THE KITCHEN IN HAND, in the corner within reach of the cursor.
        if (activeTool === 'fixture' && kitchenPreset && cursorWorld) paintKitchenPreview();
        // WHAT THE PRESS WOULD DO, under the cursor: the piece TRIM takes away
        // in red, the run EXTEND adds dashed in the selection ink.
        if ((activeTool === 'trim' || activeTool === 'extend') && cursorWorld) {
          const mode = (activeTool === 'extend') !== trimShift ? 'extend' : 'trim';
          const plan = trimPlan(cursorWorld, mode);
          if (plan && !plan.why) {
            const seg = plan.seg;
            const a = mode === 'trim' ? trimPointAt(seg, plan.from) : seg[plan.end];
            const b = mode === 'trim' ? trimPointAt(seg, plan.to) : trimPointAt(seg, plan.t);
            const A = toS(a), B = toS(b);
            ctx.save();
            ctx.strokeStyle = mode === 'trim' ? skin['draw-cut'] : skin['draw-selected'];
            ctx.lineWidth = 4;
            ctx.globalAlpha = 0.75;
            if (mode === 'extend') ctx.setLineDash([6, 4]);
            ctx.beginPath(); ctx.moveTo(A.x, A.y); ctx.lineTo(B.x, B.y); ctx.stroke();
            ctx.restore();
          }
        }
        if (activeTool === 'cut' && cutStart) {
          const G = window.DraftGeometry2D;
          const far = cutEnd || (cursorWorld && squareTo(cutStart, cursorWorld));
          ctx.save();
          ctx.strokeStyle = skin['draw-cut'];
          ctx.fillStyle = skin['draw-cut'];
          ctx.lineWidth = 1.5;
          if (far) {
            const a = toS(cutStart), b = toS(far);
            ctx.setLineDash([6, 4]);
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
            ctx.setLineDash([]);
          }
          const s0 = toS(cutStart);
          ctx.beginPath();
          ctx.arc(s0.x, s0.y, 4, 0, Math.PI * 2);
          ctx.stroke();
          if (cutEnd && cursorWorld) {
            const stored = G.cutDirVec(cutStart, cutEnd, cursorWorld);
            if (stored) {
              // Screen space, so the arrow is the same size at any zoom: the
              // world direction is projected through the same toS the geometry
              // uses rather than converted by a second scale factor here.
              const mid = { x: (cutStart.x + cutEnd.x) / 2, z: (cutStart.z + cutEnd.z) / 2 };
              const m = toS(mid);
              const tip = toS({ x: mid.x - stored.x, z: mid.z - stored.z });
              const dx = tip.x - m.x, dy = tip.y - m.y;
              const len = Math.hypot(dx, dy) || 1;
              const ux = dx / len, uy = dy / len;
              const end = { x: m.x + ux * 26, y: m.y + uy * 26 };
              ctx.beginPath();
              ctx.moveTo(m.x, m.y);
              ctx.lineTo(end.x, end.y);
              ctx.stroke();
              ctx.beginPath();
              ctx.moveTo(end.x, end.y);
              ctx.lineTo(end.x - ux * 7 - uy * 4, end.y - uy * 7 + ux * 4);
              ctx.lineTo(end.x - ux * 7 + uy * 4, end.y - uy * 7 - ux * 4);
              ctx.closePath();
              ctx.fill();
            }
          }
          ctx.restore();
        }
        // THE FLOOR BEING TRACED. The same reason the cut preview above
        // exists: a press that changes nothing on the sheet cannot be told
        // from a press that missed, which is exactly how the OUTLINE tool read
        // before it painted -- Movie, 17 Sep: "outline command doesn't work".
        //
        // THROUGH drawFloor2D, not a second polygon drawn here. That painter
        // has had a `preview` mode all along -- dashed edge, wash, and no
        // corner handles -- and floorEnv() has carried its two preview colours
        // since tier 2c against this day.
        //
        // TWO MARKS THE PAINTER DOES NOT MAKE are added after it. It returns
        // early under two points, so the FIRST press would paint nothing at
        // all; and it knows nothing about closing, so there would be no
        // target to close on.
        if (activeTool === 'floor' && floorCorners.length) {
          const R = window.DraftRender2D;
          // THE RUBBER BAND'S FAR END, supplied only while there is a cursor
          // to band to. A finger leaves none behind, so on a tablet the trace
          // is the placed corners alone -- which is the truth rather than a
          // degraded version of it.
          const trace = cursorWorld
            ? floorCorners.concat([loopPoint(cursorWorld)])
            : floorCorners;
          R.drawFloor2D(ctx, toS, { points: trace }, { preview: true }, floorEnv());
          ctx.save();
          ctx.fillStyle = skin['draw-floor-edge'];
          ctx.strokeStyle = skin['draw-floor-edge'];
          ctx.lineWidth = 2;
          // ROUND, where a committed floor's handles are square (drawFloor2D
          // fills 5x5 blocks). The shape is the difference a drafter reads at
          // a glance; the colour is deliberately the same, because this is
          // the floor they are drawing and not a different kind of thing.
          floorCorners.forEach(corner => {
            const p = toS(corner);
            ctx.beginPath();
            ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
            ctx.fill();
          });
          // THE CLOSE TARGET, rung once the loop CAN be closed and not before
          // -- three corners, the same count floorPress accepts as a close.
          // The ring is the page saying where the gesture can be finished, so
          // it appears on the press that makes finishing possible and not one
          // earlier.
          if (floorCorners.length >= 3) {
            const first = toS(floorCorners[0]);
            ctx.beginPath();
            ctx.arc(first.x, first.y, 7, 0, Math.PI * 2);
            ctx.stroke();
          }
          ctx.restore();
        }
        // THE SHAPE IN HAND: the corners placed, a band to the cursor, and
        // the close ring once three corners make closing legal.
        if (activeTool === 'shape' && shapeCorners.length) {
          const trace = cursorWorld
            ? shapeCorners.concat([loopPoint(cursorWorld)])
            : shapeCorners;
          ctx.save();
          ctx.strokeStyle = skin['draw-note'];
          ctx.fillStyle = skin['draw-note'];
          ctx.lineWidth = 1.5;
          ctx.setLineDash([6, 4]);
          ctx.beginPath();
          trace.forEach((pt, i) => {
            const p = toS(pt);
            if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
          });
          ctx.stroke();
          ctx.setLineDash([]);
          shapeCorners.forEach(corner => {
            const p = toS(corner);
            ctx.beginPath();
            ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
            ctx.fill();
          });
          if (shapeCorners.length >= 3) {
            const first = toS(shapeCorners[0]);
            ctx.beginPath();
            ctx.arc(first.x, first.y, 7, 0, Math.PI * 2);
            ctx.stroke();
          }
          ctx.restore();
        }
        paintShedRoof();
        paintRoomPick();
        // THE RULER'S OWN LINE, dashed so it cannot be mistaken for geometry.
        // It is the only mark on this canvas that is not in the drawing and
        // never will be, and the dash is how a drafter knows that without
        // being told.
        if (rulerFrom && cursorWorld) {
          const a = toS(rulerFrom), b = toS(cursorWorld);
          ctx.save();
          ctx.strokeStyle = skin['accent'];
          ctx.setLineDash([5, 4]);
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
          ctx.restore();
        }
      }
    } catch (err) {
      // The throw above is only useful if someone SEES it. paint() runs on
      // every pan, zoom and resize, so an uncaught error here would be a
      // console full of noise behind a blank page; this puts it on screen
      // once, in the same notice the store errors use.
      ctx.restore();
      readoutText.textContent = 'painter failed';
      say('The drawing could not be painted',
        `<p><code>${escapeHtml(err && err.message || err)}</code></p>`);
      throw err;
    }
    ctx.restore();
    // The delete affordance exists exactly while there is something to delete.
    // A button that is always there and usually does nothing teaches a drafter
    // to distrust it.
    // ...and not under a section, where the selection it would delete is not
    // on screen to point at. The comment above is the reason: an affordance
    // that acts on something invisible is the same distrust, one step worse.
    // ...and not under a modal either: the drive-thru sign will rise from the
    // foot and cover this exact strip, so a DELETE still live underneath it
    // would be a button the drafter cannot see being pressed through a sign
    // they can.
    if (deleteButton) {
      deleteButton.hidden = !selection.length || !!activeCut() || modalUp();
    }
    // THE SAME RULE AS DELETE, and asked here for the same reason: a section
    // view or a modal suppresses every verb, because neither is a workspace a
    // paste could land on.
    // UNDO IS ON SCREEN WHILE THERE IS SOMETHING TO UNDO, the same rule as
    // DELETE above -- and, unlike DELETE, under a section too: taking back
    // the cut that made the section is exactly what a drafter may want there.
    if (undoButton) undoButton.hidden = (!undoStack.length && !pendingCornerList()) || modalUp();
    // THE STOREY ARROWS ARE ON SCREEN WHENEVER THERE IS A DRAWING, and under
    // a modal they go with everything else on this strip -- the drive-thru
    // sign rises over it, and a live control under a sign is a press the
    // drafter cannot see being made.
    //
    // GREYED AT THE ENDS RATHER THAN HIDDEN: a pair that vanished on the top
    // floor would move DELETE and UNDO sideways under the drafter's hand
    // every time they changed storey. `disabled` says the same thing and
    // keeps the strip still.
    [[levelUpButton, LEVEL_UP], [levelDownButton, LEVEL_DOWN]].forEach(([button, direction]) => {
      if (!button) return;
      button.hidden = !drawing || modalUp();
      button.disabled = !levelStepTarget(direction);
    });
    if (copyButton) {
      copyButton.hidden = !selection.length || !!activeCut() || modalUp();
    }
    if (pasteButton) {
      // PASTE ASKS WHAT IS HELD, NOT WHAT IS SELECTED -- the two are different
      // questions and this is the whole of the cross-workspace behaviour.
      // A drafter copies on MAIN FL, switches to a shelf (which clears the
      // selection, because a selection is a fact about one workspace) and
      // pastes. If PASTE read the selection it would be dead exactly when it
      // is wanted.
      pasteButton.hidden = !held.length || !!activeCut() || modalUp();
    }
    syncRotateVerbs();
    syncFlipVerbs();
    syncRescaleVerbs();
    syncBreakVerb();
    syncMoveVerb();
    syncWallOffVerb();
    // Before updateReadout, so the readout reports the frame it describes and
    // not the cost of writing itself.
    lastPaintMs = performance.now() - t0;
    // THE CAMERA, SAID OUT LOUD. toS is the one place that turns a world point
    // into a screen point, and until now nothing outside this file could ask
    // it anything -- so a check wanting to press ON a wall had to rebuild the
    // mapping from the readout's scale and a GUESS that the view is centred on
    // world 0,0. That guess holds only for a fixture symmetric about the
    // origin, and model-toy-draw.spec.js:758 is not one: fitted, its centre is
    // z=-0.185, so every press that helper aimed landed ~7px off the thing it
    // named. It passed anyway while bare canvas was forgiving, and stopped the
    // day a bar moved into the 7px.
    //
    // A second copy of the arithmetic is how the two drift; this is the first
    // copy, published. The canvas already wears data-* for the same reason the
    // panels do. Three numbers, one attribute, one write a frame.
    canvas.setAttribute('data-view',
      `${view.cx.toFixed(6)} ${view.cz.toFixed(6)} ${view.scale.toFixed(6)}`);
    // ── AND THE FOUR ELEVATION MARKS THIS FRAME IS DRAWING ──────────────
    //
    // Published for the reason data-view above it is, and the note there
    // already argues it: a second copy of the arithmetic is how the page and
    // its checks drift apart. Measured, 27 Sep: model-house-rotate.spec.js
    // asked DraftCutMarks for the marks ITSELF, with the saved drawing's own
    // turn -- so a mutant that stopped this page passing the turn through left
    // the spec computing the right answer while the page drew the wrong one,
    // and it survived. A check that re-derives what it is checking is a check
    // of its own arithmetic.
    //
    // FOUR LINES OF NUMBERS, written once a frame beside the camera. `id`, the
    // two ends, and which way it looks -- everything a reader needs to say
    // which wall an elevation is on and which way round it is.
    const publishMarks = (name, list) => canvas.setAttribute(name, JSON.stringify(list.map(cut => ({
      id: cut.id,
      a: [Number(cut.startPt.x.toFixed(4)), Number(cut.startPt.z.toFixed(4))],
      b: [Number(cut.endPt.x.toFixed(4)), Number(cut.endPt.z.toFixed(4))],
      d: [cut.dirVec.x, cut.dirVec.z],
    }))));
    // THE RECORD, which is what every elevation is generated from and what
    // E1 RIGHT and HOUSE ROTATE are asked about.
    publishMarks('data-e-marks', autoElevationCuts());
    // AND WHERE THEY WERE ACTUALLY DRAWN, which on the site level is a ring
    // round the LOT rather than round the house (Movie, 14 Oct: "the E1-E4 on
    // the outside ... on the OUTSIDE of the site lines"). The same two numbers
    // on every other level; published separately because "what the file says"
    // and "what the drafter is looking at" are two questions, and this feature
    // is the one place they differ.
    publishMarks('data-e-marks-drawn', eMarksDrawn());
    // AFTER the canvas timing and BEFORE the readout. After, because `paint`
    // in the readout means the main canvas and folding six thumbnails into it
    // would make one frame an edit read like a slow one. Before, because the
    // readout carries the rail's own number and reporting last frame's would
    // be the same staleness this page has already been bitten by once.
    syncRail();
    updateReadout();
  };

  // THE NAME THE DRAFTER READS, which is the derived one -- the same string
  // the level card shows. The readout and the panel are two instruments on one
  // piece of state, and this file has already been bitten once by letting two
  // of them answer differently (see the LEVELS panel's agreement check): a
  // card reading "1 MAIN FL" beside a readout reading "MAIN FL" is two names
  // for one level on screen at the same time.
  const levelName = () => {
    const level = (drawing?.levels || [])
      .find(entry => Number(entry.id) === activeLevelId());
    return level ? levelLabel(level.id, level.name) : 'level';
  };

  // THE READOUT IS THE ONLY INSTRUMENT ON THIS PAGE. Movie, 3 Sep: keep adding
  // to it, never prune -- he decides later what earns its place. So counts are
  // shown as SHOWN/TOTAL rather than shown alone: `walls 13/24` says both what
  // is painted and what the drawing holds, which makes the level filter
  // visible instead of something you have to trust. `floors 0/3` is what would
  // have shown the tier 2a floor bug on sight rather than after a screenshot.
  const shownOfTotal = (shown, all) => `${shown}/${(all || []).length}`;

  // Three states, matching gridDatum(): a point, the back-filled world origin
  // for a pre-datum drawing, or none at all -- and none means no grid.
  const datumLabel = () => {
    const d = gridDatum();
    if (!d) return 'none — no grid';
    const at = `${d.x.toFixed(2)},${d.z.toFixed(2)}`;
    if (siteDatumNow()) return `${at} (front-left of ${boneyardActive ? 'the shelf' : 'foundation'})`;
    return (drawing && !('drawingOrigin' in drawing)) ? `${at} (world, back-filled)` : at;
  };

  // Tracing images on THIS level that TRACE is keeping out of sight.
  const hiddenUnderlays = () => (traceOn ? 0 : underlays().length);

  // THE READOUT FOLLOWS THE SECTION, or it stops being an instrument the
  // moment the page is most novel. The first cut branch in paint() returned
  // early, straight past updateReadout, so a page opened cold on ?view=cut:
  // painted a correct section and sat at "loading..." underneath it for ever.
  //
  // The spec did not catch it, and the reason is worth keeping: the test
  // asserted the readout contains "walls" AFTER switching view, when the plan
  // paint's readout was still on screen. True whether the section updated the
  // readout or never touched it -- an assertion two world states satisfy,
  // which is the defect shape this session has met at every rung. It is now
  // asserted on a COLD load, where only one state can produce it.
  //
  // The counts come from the painter's OWN exported passes with the painter's
  // own axis, not a second derivation: sectionLevelStack and
  // sectionWallCrossings are what drawCutView itself calls, so the instrument
  // cannot drift from the picture it describes. The three states it reports
  // are the painter's three: no level stack, no crossings (an elevation, not
  // a section), and a section with walls in it.
  // The office's side name for a standard elevation -- E1 FRONT, E2 LEFT and
  // so on -- read the way MODEL.dc.html's _elevationName reads it (:9437):
  // the drawing's own names first (they are persisted, so a drawing saved
  // with its own names keeps them), then the profile's, then a plain word.
  const elevationName = id => drawing?.elevationNames?.[id]
    || structureStandards().elevationNames?.[id] || 'ELEVATION';

  // What a cut is called on screen, in the picker and on its seat. An auto
  // elevation carries its office side name; a section is just its name.
  const cutLabel = cut => (cut.auto
    ? `${cut.name || cut.id} · ${elevationName(cut.id)}`
    : (cut.name || String(cut.id)));

  const sectionReadout = cut => {
    const CV = window.DraftCutView;
    const env = cutEnv();
    const stack = CV.sectionLevelStack(env);
    const crossings = stack ? CV.sectionWallCrossings(env, cut, CV.cutAxis(cut)) : [];
    const what = !stack ? 'no level stack'
      : (crossings.length ? `walls cut <b>${crossings.length}</b>`
        : 'crosses no walls — an elevation');
    // THE RIGHT NOUN. An auto cut stands OUTSIDE the house looking at it, so
    // it crosses no walls BY DESIGN -- "section E1 crosses no walls" reads as
    // a fault rather than the normal case. The drafter's two kinds of cut are
    // named as two kinds.
    const title = cut.auto
      ? `elevation <b>${escapeHtml(cut.name || cut.id)} · ${escapeHtml(elevationName(cut.id))}</b>`
      : `section <b>${escapeHtml(cut.name || cut.id)}</b>`;
    return `${title}   ${what}   `
      + `of <b>${(drawing.walls || []).length}</b> in the drawing
`
      + `${escapeHtml(levelName())} <b>${activeLevelId()}</b>/${(drawing.levels || []).length}   `
      + `view <b>${CUT_VIEW}${escapeHtml(cut.id)}</b>   `
      + `${theme}/${mode}   `
      + `scale <b>fit to the cut</b>   `
      + `paint <b>${lastPaintMs.toFixed(2)}</b> ms   `
      + `rail <b>${lastRailMs.toFixed(2)}</b> ms`;
  };

  const updateReadout = () => {
    if (!drawing) return;
    // Before the plan counts, which describe a picture that is not on screen:
    // walls() and the rest filter by layer view, and under a section every one
    // of them reads 0 while the section shows the whole house.
    const cut = activeCut();
    if (cut) { readoutText.innerHTML = sectionReadout(cut); return; }
    readoutText.innerHTML =
      `walls <b>${shownOfTotal(walls().length, drawing.walls)}</b>   `
      + `lines <b>${shownOfTotal(lines().length, drawing.lines)}</b>   `
      + `floors <b>${shownOfTotal(floors().length, drawing.floors)}</b>   `
      + `roofs <b>${shownOfTotal(roofs().length, drawing.roofs)}</b>   `
      + `shapes <b>${shownOfTotal(shapes().length, drawing.shapes)}</b>   `
      + `outlines <b>${shownOfTotal(outlines().length, drawing.outlines)}</b>   `
      + `dims <b>${shownOfTotal(dimensions().length, drawing.dimensions)}</b>   `
      // COLUMNS AND BEAMS, and until now the readout had neither. The page has
      // painted both since the painter landed, so a drafter placing one had no
      // on-page way to see it arrive -- which is part of why this half of #392
      // could sit unfinished without looking broken. shownOfTotal, like every
      // row above: the left number is this level and view, the right is the
      // whole drawing.
      + `columns <b>${shownOfTotal(columns().length, drawing.columns)}</b>   `
      + `beams <b>${shownOfTotal(beams().length, drawing.beams)}</b>   `
      // AND OPENINGS, which were in exactly the state the two rows above
      // describe: painted since the painter landed, counted nowhere. A
      // drafter placing a window had no on-page way to see it arrive, and
      // the one that got REFUSED -- a wall too short to carry it -- looked
      // identical to the one that landed.
      //
      // THE LEFT NUMBER IS WHAT RESOLVED, not what is on this level.
      // openingsOn drops an opening whose host wall is not here and one the
      // clamp refuses, so `openings 10/11` is the page saying one of them is
      // not being drawn -- which is the only warning this page gives that a
      // record is in the file and not on the sheet.
      + `openings <b>${shownOfTotal(openingsOn(walls()).length, drawing.fenestrations)}</b>   `
      // BOTH SIDES LEVEL-SCOPED. The loader decodes every underlay in the
      // drawing, not just this level's, so that switching level is instant --
      // which means underlayImages.size counts images the drafter cannot
      // currently see. Counting it against this level's total printed
      // `underlays 1/0`, and a ratio above one is not a fact, it is a bug.
      + `underlays <b>${underlays().filter(u => underlayImages.has(u.id)).length}</b>`
      + `/${underlays().length}\n`
      + `${escapeHtml(levelName())} <b>${activeLevelId()}</b>/${(drawing.levels || []).length}   `
      + `view <b>${escapeHtml(onActiveLevel().viewId || 'all')}</b>   `
      + `${theme}/${mode}   `
      + `scale <b>${view.scale.toFixed(2)}</b> px/ft   `
      // Why the grid is or is not there, so its absence reads as a fact about
      // the drawing rather than a broken page.
      + `datum <b>${datumLabel()}</b>`
      // Malformed geometry is NOT DRAWN and NOT DELETED. Say how much, so a
      // thinner drawing is a fact rather than a mystery — and say which of the
      // two happened, because "dropped" is now a lie in the direction that
      // matters. The count is the same count it always was; the word changed
      // when the behaviour did.
      + (dropped ? `   <b>${dropped} not drawn, kept in file</b>` : '')
      // A SUBSTITUTION IS NOT A FACT ABOUT THE DRAWING, and the drafter should
      // be able to find out one happened. This page has no 12" assembly, so it
      // paints those walls as 8" — drawing nothing would be worse — and the file
      // keeps `concrete_12` either way (RULING-substitution-is-not-a-save).
      // Without this clause the accommodation is invisible: the wall looks
      // thinner and there is nothing on screen to say the page could not draw
      // what the file says. The same voice as `dropped` above, for the same
      // reason — this page says what it could not do rather than looking like
      // it did it.
      + (substitutedWallTypes.size
        ? `   <b>${substitutedWallTypes.size} wall type${substitutedWallTypes.size === 1 ? '' : 's'} substituted</b>`
        : '')
      // THE SAME RULE AS `dropped` ABOVE: a tracing image that is on this
      // level and not showing says why, so the drafter can tell a switch from
      // a loss.
      + (hiddenUnderlays() ? `   <b>${hiddenUnderlays()} tracing image`
          + `${hiddenUnderlays() === 1 ? '' : 's'} hidden</b> (PHOTO is off)` : '')
      // The frame this readout describes, on both views, so a plan and a
      // section on the same drawing can be compared by looking at them.
      // The rail's six thumbnails, and this is the cost of an EDIT, not of a
      // frame: it only moves when the epoch does.
      // WHAT IS SELECTED, because with the OBJECT TYPE filter engaged a click
      // that grabs nothing and a click that grabs something look identical on
      // a busy screen -- the highlight is under the cursor and the cursor is
      // over it. The readout is this page's own reporting surface for exactly
      // that problem (it already says `walls 8/20` rather than making a
      // drafter count), so the selection goes here rather than into a test
      // hook nothing but a spec would ever read.
      + (selection.length ? `   <b>${selection.length} selected</b>` : '')
      + `   paint <b>${lastPaintMs.toFixed(2)}</b> ms`
      + `   rail <b>${lastRailMs.toFixed(2)}</b> ms`;
  };

