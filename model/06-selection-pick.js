// MODEL.html's page script, part 6 of 17: selection, what a click can hit, the window drag, assemblies, anchor nodes, a stair's hole, dimensions.
//
// Stage 2 of the split (Movie, 24 Oct: "how can we reduce the MODEL.html
// size in a nice organized way"): the one script the page carried, cut
// at its own section headings and moved here verbatim, in order. The
// parts load one after another as classic scripts and share one scope,
// as they did inside the page; the indent is the page's, kept so every
// line reads as it did there.

  // ── selection ─────────────────────────────────────────────────────────────
  // TIER 3a. The first editing tool: click a wall, it lights up.
  //
  // THE OLD PAGE IS THE SPEC, and it does NOT paint this through the painter.
  // drawWallSeg2D has no `selected` key -- drawRoof2D, drawFixture2D and
  // drawFloor2D do, and MODEL.dc.html uses both mechanisms deliberately, split
  // by what is being selected: AREAS go through their painter with
  // { selected: true } (:7393), SEGMENTS get a separate overlay pass (:7380).
  // A wall is a segment, so it gets the overlay, and render-2d.js needs no
  // change at all.
  //
  // THE SELECTION HAS ITS OWN ROLES NOW, and the reason it did not is worth
  // keeping because it was right at the time: these were MODEL.dc.html's
  // literals, #5980a6 being the drafting blue, and the palette had no
  // `selected` role to ask for -- only 'draw-floor-edge', which happens to
  // hold the same hex under a name that means the slab outline. Borrowing
  // that name would have been worse than a literal saying where it came from.
  // So draw-selected and draw-selected-all exist, named for what they are.
  //
  // READ AT CALL TIME, NOT CAPTURED. A `const` here would freeze on whichever
  // skin was live when the page booted, and this page re-applies the palette
  // on a theme switch (:7022) without reloading -- so a captured blue would
  // survive the switch and the selection alone would stay on the old skin.
  const selectHandle = () => skin['draw-selected'];
  const SELECT_ALPHA = 0.55;                    // MODEL.dc.html:7385
  const selectInk = () => {
    const hex = String(selectHandle()).replace('#', '');
    const [r, g, b] = [0, 2, 4].map(i => parseInt(hex.slice(i, i + 2), 16));
    return `rgba(${r},${g},${b},${SELECT_ALPHA})`;
  };
  const SELECT_GRAB_PX = 12;                    // MODEL.dc.html:16707, _findLineHit
  // ── the selection ─────────────────────────────────────────────────────────
  // A SET, NOT A WALL. This was `let selectedSeg = null` -- correct while a
  // wall was the only selectable thing on the page, and the wrong shape for
  // ITEMS/WINDOW/ALL LEVELS, which select many things of several types at
  // once. Same correction as the tool register a few hundred lines down: the
  // single-value variable becomes the general one, and the old narrow reading
  // becomes a VIEW of it rather than a second copy kept in step by hand.
  //
  // ENTRIES ARE { type, item }, because a bare item cannot answer "is this a
  // wall or a line" -- both are `{ start, end }` and the OBJECT TYPE filter
  // has to tell them apart. `type` is the filter vocabulary
  // (MODEL.dc.html:2793): 'line' | 'wall' | 'outline' | 'floor'.
  //
  // selectedWall() IS THE OLD MEANING, exactly: the one wall the corner drag,
  // the body drag, the delete button and the highlight act on. It is null the
  // moment the selection holds anything other than a single wall, which is
  // what those four should do when a drafter has ten things selected -- a
  // corner handle on one of ten walls would be a handle on an ambiguity.
  let selection = [];

  // THE TWO PANEL STATES, with the old page's own vocabularies and defaults
  // (:2792-2793). `window-all` is a THIRD MODE, not a modifier on `window`:
  // WINDOW drags a blue box over the current level, ALL LEVELS drags a red one
  // over every level, and they are mutually exclusive.
  let selectionMode = 'click';        // 'click' | 'window' | 'window-all'
  let selectFilter = 'all';           // 'all', or one of hitAt's types (FILTERS)
  // AND WITH 'fixture', ONE KIND OF IT (Movie, 19 Oct: TUB picks only tubs),
  // or null for every fixture.
  let selectFixtureKind = null;
  // SELECT PICKING A KIND (Movie, 19 Oct): pressed from the bar over the
  // tabs, SELECT lights and the tool keys stop drawing -- each one picks its
  // kind for SELECT instead, one kind at a time. Esc, S, or SELECT again ends
  // it.
  let selectPicking = false;
  const fixtureKindAllowed = item => !selectFixtureKind || item?.kind === selectFixtureKind;

  const selectedWall = () => (selection.length === 1 && selection[0].type === 'wall'
    ? selection[0].item : null);

  // ONE PLACE THE SELECTION CHANGES, so anything that watches it cannot fall
  // out of step. The assembly panel's button states and help line are a
  // function of the selection, and a panel updated at each call site instead
  // would be a second copy of "what is selected" -- the failure this file has
  // now corrected twice.
  const selectionWatchers = [];
  const setSelection = next => {
    selection = next;
    selectionWatchers.forEach(fn => fn());
  };

  // Nearest wall to a world point, or null. The threshold is converted from
  // pixels at the CURRENT zoom, so the grab zone stays the same size on screen
  // however far in the drafter is -- and it is passed in rather than baked
  // into geometry-2d.js, because the old page uses eight different distances
  // (30, 24, 18, 14, 12, 4 px) for different targets and a number frozen in
  // the shared function would be wrong for seven of them.
  //
  // `skip` TAKES ONE WALL OUT OF THE RUNNING, which TRIM's second press needs
  // and nothing else does: see trimPress.
  const wallAt = (worldPt, skip = null) => {
    const G = window.DraftGeometry2D;
    const thresh = SELECT_GRAB_PX / view.scale;
    let best = null, bestD = thresh;
    walls().forEach(wall => {
      if (!wall.start || !wall.end || wall === skip) return;
      const { d } = G.pointToSegment(worldPt, wall);
      if (d < bestD) { bestD = d; best = wall; }
    });
    return best;
  };

  // ── what a click can hit ──────────────────────────────────────────────────
  // THE OLD PAGE'S PRECEDENCE, in its order (_handleSelectClick :18185). It is
  // not arbitrary: a vertex beats the segments through it, a segment beats the
  // outline edge behind it, and a floor is last because it is the biggest
  // target on screen and would otherwise swallow everything drawn on top of it.
  //
  // WHAT IS MISSING HERE AND WHY IT IS NOT A BUG. The old page's chain also
  // tests fenestrations, fixtures, surface openings, dimensions and roofs. None
  // of those five is in the OBJECT TYPE vocabulary ('all' | 'line' | 'wall' |
  // 'outline' | 'floor', :2793), so they are reachable only under ALL, and none
  // of them has a tool on this page yet. Selecting is not saving -- the file
  // keeps every one of them untouched -- so this page selects less than the old
  // one for now, and says so rather than pretending the chain is complete.
  //
  // THE TOOLTIP AND THE HANDLER DISAGREE IN THE OLD PAGE, and the handler wins
  // here. `title: 'Only outline nodes respond to Select'` says nodes;
  // _findOutlineEdgeHit and the corner branch above it both select the WHOLE
  // outline, from an edge or from a corner. Copying the tooltip would have
  // produced a filter that behaves differently from the one it was ported from.
  // A post is picked within the same reach as a line, or anywhere on its
  // own footprint when that is bigger on screen.
  const columnAt = worldPt => {
    const reach = Math.max(SELECT_GRAB_PX / view.scale, 0.5);
    let best = null, bestD = reach;
    columns().forEach(c => {
      if (!c.point) return;
      const d = Math.hypot(c.point.x - worldPt.x, c.point.z - worldPt.z);
      if (d < bestD) { best = c; bestD = d; }
    });
    return best;
  };
  // THE POSTS A BEAM STANDS ON: its own level and view, on its line between
  // its ends -- and not also on another beam that is staying, which keeps
  // the post where two beams meet.
  const COLUMN_ON_BEAM_FT = 0.25;
  const onBeamLine = (beam, pt) => pt && beam.start && beam.end
    && window.DraftGeometry2D.pointToSegment(pt, beam).d <= COLUMN_ON_BEAM_FT;
  const columnsOnBeam = (beam, keepBeams = []) => (drawing?.columns || []).filter(c =>
    Number(c.levelId) === Number(beam.levelId) && (c.view || 'plan') === (beam.view || 'plan')
    && onBeamLine(beam, c.point)
    && !keepBeams.some(other => other !== beam && Number(other.levelId) === Number(beam.levelId)
      && (other.view || 'plan') === (beam.view || 'plan') && onBeamLine(other, c.point)));
  const segAt = (list, worldPt) => {
    const G = window.DraftGeometry2D;
    const thresh = SELECT_GRAB_PX / view.scale;
    let best = null, bestD = thresh;
    list.forEach(item => {
      if (!item.start || !item.end) return;
      const { d } = G.pointToSegment(worldPt, item);
      if (d < bestD) { bestD = d; best = item; }
    });
    return best;
  };

  const lineAt = worldPt => segAt(lines(), worldPt);

  // A ray cast, which is the standard test and the only one that answers
  // correctly for the concave footprints this program draws all day -- an L or
  // a courtyard has points outside its own bounding box's interior.
  const pointInRing = (ring, pt) => {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
      const a = ring[i], b = ring[j];
      if (!a || !b) continue;
      if ((a.z > pt.z) !== (b.z > pt.z)
        && pt.x < ((b.x - a.x) * (pt.z - a.z)) / (b.z - a.z) + a.x) inside = !inside;
    }
    return inside;
  };

  const floorAt = worldPt => floors()
    .find(floor => pointInRing(floor.points || [], worldPt)) || null;
  // A PHOTO'S FOOTPRINT, in feet: centred at x, z, widthFt by heightFt (a
  // turned one has its sides swapped already, by turnPhoto). Not a DXF,
  // whose lines are the drawing's own kind of thing.
  const underlayRect = u => (u && u.kind !== 'dxf' && Number.isFinite(u.widthFt) && Number.isFinite(u.heightFt)
    ? { left: u.x - u.widthFt / 2, right: u.x + u.widthFt / 2, top: u.z - u.heightFt / 2, bottom: u.z + u.heightFt / 2 }
    : null);
  const underlayAt = worldPt => {
    if (!traceOn) return null;
    const mine = underlays();
    for (let i = mine.length - 1; i >= 0; i -= 1) {
      const r = underlayRect(mine[i]);
      if (r && worldPt.x >= r.left && worldPt.x <= r.right && worldPt.z >= r.top && worldPt.z <= r.bottom) return mine[i];
    }
    return null;
  };

  // An outline is selected WHOLE, from any of its edges or any of its corners.
  const outlineAt = worldPt => {
    const G = window.DraftGeometry2D;
    const thresh = SELECT_GRAB_PX / view.scale;
    return outlines().find(outline => {
      const pts = outline.points || [];
      return pts.some((a, i) => {
        const b = pts[(i + 1) % pts.length];
        if (!a || !b || pts.length < 2) return false;
        return G.pointToSegment(worldPt, { start: a, end: b }).d < thresh;
      });
    }) || null;
  };

  // ── AN OPENING ANSWERS A PRESS ───────────────────────────────────────────
  //
  // Movie asked for the bungalow's windows and doors so he could "change them
  // if i need to afterwards". Stage 1 put them in; this is the half that takes
  // one out.
  //
  // THE TARGET IS THE CARVED QUAD, which is the shape on the sheet: the
  // opening's width along the wall by the wall's own thickness across. Not a
  // radius round its centre, because a 16 ft overhead door and a 2'-6" man
  // door would then have the same grab, and pressing the middle of the big one
  // is not where a drafter aims.
  //
  // IT IS NOT A SECOND HIT TEST -- the same rule the hover ring follows, and
  // here it pays twice. The list comes from openingsOn, which is what PAINTS
  // them, so the press cannot pick an opening that is not on the sheet: one
  // hosted on a wall from another level, or one the clamp refuses because its
  // wall is too short to carry it.
  //
  // AND THE SLACK ARRIVES WITH THE SHAPE. The old page grabs an opening with
  // "a couple of pixels of slack so a click on the wall face still counts" --
  // its reference line is where the wall's boundary stroke is CENTRED, so
  // half the ink a drafter presses at is outside the opening proper. This
  // page needs no such figure of its own, because openingGeometry is already
  // handed padFt (2px, openingPadFt) so the gap fill reaches past each face
  // to interrupt that same stroke. The painted quad IS the padded quad, and
  // pressing what is painted is the whole point.
  //
  // A SEPARATE OPENING_SLACK_PX STOOD HERE and was removed: a mutation
  // setting it to zero changed no answer, because the two pixels were already
  // in the shape. Two slacks for one reason is the drift this file keeps
  // paying for -- and the one that is left is the one the drafter can see.
  const openingAt = worldPt => {
    const hit = openingsOn(walls())
      .find(({ geometry }) => pointInRing(geometry.corners, worldPt));
    return hit ? hit.opening : null;
  };

  // AN ALREADY-SELECTED OPENING IS A GRAB, which is the page's own two-step
  // for moving anything: press it to choose it, press it again and drag. The
  // segment body drag reads the same way (segmentBodyAt only answers for a
  // wall or line already in the selection), and the reason is the same -- a
  // press that both selected and started moving would make every mis-aimed
  // tap a small edit.
  const openingBodyAt = worldPt => {
    const opening = openingAt(worldPt);
    return opening && selection.some(entry => entry.item === opening)
      ? opening : null;
  };

  // 'all' passes everything; any other filter passes only its own type. The old
  // page's whole rule, in one line (_selectFilterAllows :18180).
  //
  // EVERY TYPE hitAt ANSWERS HAS ITS OWN FILTER since 4 Oct (Movie: "same
  // thing for other object types"), so a door, a stair or a tag can be
  // engaged on its own. The old page's list was the first five.
  const filterAllows = type => selectFilter === 'all' || selectFilter === type;

  // ── the window drag ───────────────────────────────────────────────────────
  // FULLY ENCLOSED, NOT CROSSED. The old page's own rule
  // (_handleWindowSelection :18282): every point of an item must be inside the
  // box. A crossing window -- catching anything the box touches -- is a
  // different tool with different node rules, and its own comment there says
  // so: "A future Stretch command can use a crossing window".
  //
  // OUTLINES ARE NOT IN A WINDOW, and that is the old page's behaviour rather
  // than an omission here. Its window reaches lines, walls, floors and
  // dimensions; outlines are click-only. So OUTLINE engaged plus a window drag
  // selects nothing, which is correct and would look exactly like a bug if it
  // were not written down.
  let bandDrag = null;
  // THE ITEMS-MODE BOX, live while a left drag from empty sheet is under way
  // (Movie, 4 Oct: "drag box select"). Its own variable rather than a field on
  // the pan's `dragging`, which is declared far below the painter.
  let itemBox = null;

  // ── WHAT A BOX CAN CATCH: every type hitAt picks ─────────────────────────
  //
  // Movie, 4 Oct: the box catches "every pickable type", and the OBJECT TYPE
  // filter still narrows it. Each item is its outline in plan feet: a wall or
  // a line is its centre line, an area its ring, a door/window or fixture the
  // quad the painter draws, a stair its flights and landing, a tag the box
  // its text paints in.
  const boxShapes = all => {
    const scope = (key, onScreen) => (all ? (drawing?.[key] || []) : onScreen());
    const out = [];
    const seg = item => [[item.start, item.end]];
    const ring = item => [(item.points || []).filter(Boolean)];
    if (filterAllows('wall')) scope('walls', walls).forEach(item => out.push({ type: 'wall', item, parts: seg(item), open: true }));
    if (filterAllows('line')) scope('lines', lines).forEach(item => out.push({ type: 'line', item, parts: seg(item), open: true }));
    if (filterAllows('floor')) scope('floors', floors).forEach(item => out.push({ type: 'floor', item, parts: ring(item) }));
    // THE OTHERS ARE THIS LEVEL'S: what the sheet paints is what a box drawn
    // on it can mean. ALL LEVELS reaches them through their walls' levels
    // only where a record is filed that way, so it keeps the three it had.
    if (all) return out;
    if (filterAllows('outline')) outlines().forEach(item => out.push({ type: 'outline', item, parts: ring(item) }));
    if (filterAllows('shape')) shapes().forEach(item => out.push({ type: 'shape', item, parts: ring(item) }));
    if (filterAllows('roof')) pickRoofs().forEach(item => out.push({ type: 'roof', item, parts: ring(item) }));
    if (filterAllows('beam')) beams().forEach(item => out.push({ type: 'beam', item, parts: seg(item), open: true }));
    if (filterAllows('column')) columns().filter(c => c.point)
      .forEach(item => out.push({ type: 'column', item, parts: [[item.point]], open: true }));
    if (filterAllows('fenestration')) {
      openingsOn(walls()).forEach(({ opening, geometry }) =>
        out.push({ type: 'fenestration', item: opening, parts: [geometry.corners] }));
    }
    if (filterAllows('fixture') && window.DraftFixtureGeometry) {
      const host = drawing?.walls || [];
      fixtures().filter(fixtureKindAllowed).forEach(item => {
        const geo = window.DraftFixtureGeometry.fixtureGeometry(host, item);
        if (geo) out.push({ type: 'fixture', item, parts: [geo.corners, ...(geo.decks || [])] });
      });
    }
    if (filterAllows('stair')) {
      const levels = stairLevels();
      stairs().forEach(item => out.push({ type: 'stair', item, parts: stairRings(item, levels) }));
    }
    if (filterAllows('roomtag') && roomTagsShown()) {
      roomTags().forEach(item => {
        const b = roomTagBox(item);
        out.push({ type: 'roomtag', item, parts: [[toWorld(b.left, b.top), toWorld(b.right, b.top),
          toWorld(b.right, b.bottom), toWorld(b.left, b.bottom)]] });
      });
    }
    // DIMENSIONS IN THE PLAIN BOX TOO (Movie, 25 Oct: "i'd like to be able to
    // SELECT the DIMS with the RECTANGULAR selection thingy ,, without needing
    // to choose SELECT & DIMENSION ... jus twhen general SELECT is on"). They
    // used to come only with DIMENSION picked (19 Oct), so a box over walls
    // kept their strings; DIMENSION picked still takes them alone. Each is the
    // line as drawn, where the drafter sees it.
    if (filterAllows('dimension')) {
      shownDimensions().forEach(item => {
        const line = dimDrawnLine(item);
        if (line) out.push({ type: 'dimension', item, parts: [line.map(p => toWorld(p.x, p.y))], open: true });
      });
    }
    // A HOLOGRAM by its walls on this level: inside the blue box when all of
    // them are, caught by the green one when the box touches any.
    if (filterAllows('hologram')) {
      holograms().forEach(item => {
        const segs = hologramWallsHere(item).map(w => [w.start, w.end]);
        if (segs.length) out.push({ type: 'hologram', item, parts: segs, open: true });
      });
    }
    // A NOTE IS IN THE WINDOW when its text block and the tip of its leader are.
    if (filterAllows('note')) {
      notes().forEach(item => {
        const b = noteBox(item);
        const box = [toWorld(b.left, b.top), toWorld(b.right, b.top),
          toWorld(b.right, b.bottom), toWorld(b.left, b.bottom)];
        out.push({ type: 'note', item, parts: [item.end === 'none' ? box : [...box, item.anchor]] });
      });
    }
    return out;
  };

  // ENCLOSED takes what lies wholly inside; CROSSING also takes what the box
  // touches -- a corner inside, or an edge across one of the box's own.
  const boxCatch = (a, b, { crossing = false, all = false } = {}) => {
    const minX = Math.min(a.x, b.x), maxX = Math.max(a.x, b.x);
    const minZ = Math.min(a.z, b.z), maxZ = Math.max(a.z, b.z);
    const inside = pt => pt && pt.x >= minX && pt.x <= maxX && pt.z >= minZ && pt.z <= maxZ;
    const box = [{ x: minX, z: minZ }, { x: maxX, z: minZ }, { x: maxX, z: maxZ }, { x: minX, z: maxZ }];
    const cross = (p, q, r, t) => {
      const d = (u, v, w) => (v.x - u.x) * (w.z - u.z) - (v.z - u.z) * (w.x - u.x);
      const d1 = d(r, t, p), d2 = d(r, t, q), d3 = d(p, q, r), d4 = d(p, q, t);
      return ((d1 > 0) !== (d2 > 0)) && ((d3 > 0) !== (d4 > 0));
    };
    const edges = (pts, open) => {
      const list = [];
      const n = open ? pts.length - 1 : pts.length;
      for (let i = 0; i < n; i += 1) list.push([pts[i], pts[(i + 1) % pts.length]]);
      return list;
    };
    return boxShapes(all).filter(({ parts, open }) => {
      const rings = parts.filter(p => p && p.length >= (open ? 2 : 3) && p.every(Boolean));
      if (!rings.length) return false;
      if (rings.every(p => p.every(inside))) return true;
      if (!crossing) return false;
      return rings.some(p => p.some(inside) || edges(p, open).some(([u, v]) =>
        edges(box, false).some(([r, t]) => cross(u, v, r, t))));
    }).map(({ type, item }) => ({ type, item }));
  };
  // The WINDOW modes' own rule, unchanged: fully enclosed.
  const enclosedBy = (a, b) => boxCatch(a, b, { all: selectionMode === 'window-all' });
  // EVERYTHING THE BOX COULD CATCH, with no box drawn -- CTRL+A (Movie, 22
  // Oct: "lets do the CTRL-A (select all) i just had a use for it"). Through
  // the box's own list, so the key and the box cannot disagree: the kind
  // picked under OBJECT TYPE if one is, this level's items, or every level's
  // walls, lines and floors under ALL LEVELS. Assemblies come whole, as a
  // box brings them.
  const selectAll = () => {
    if (activeTool !== RESTING_TOOL) setTool(RESTING_TOOL);
    const caught = [];
    boxShapes(selectionMode === 'window-all').forEach(({ type, item }) =>
      withGroup({ type, item }).forEach(w => { if (!caught.some(c => c.item === w.item)) caught.push(w); }));
    setSelection(caught);
    const n = caught.length;
    sayOnStrip(n ? `SELECT ALL — ${n} selected${selectFilter === 'all' ? '' : ` (${pickName()} only)`}. DELETE, MOVE, or Esc.`
      : 'SELECT ALL — nothing here to select.');
    paint();
  };

  // Blue for the current level, red for every level -- the two colours the
  // mode help promises in words, so the box a drafter sees matches the
  // sentence they just read.
  const bandInk = selMode => (selMode === 'window-all'
    ? skin['draw-selected-all'] : skin['draw-selected']);

  // THE ITEMS BOX SAYS WHICH IT IS (Movie, 4 Oct, CAD style): dragged left to
  // right it is a solid blue window, right to left a dashed green crossing.
  const boxIsCrossing = band => toS(band.to).x < toS(band.from).x;
  const paintBand = () => {
    const band = bandDrag || itemBox;
    if (!band || !band.active) return;
    const a = toS(band.from), b = toS(band.to);
    ctx.save();
    const itemsBox = band === itemBox;
    const crossing = itemsBox && boxIsCrossing(band);
    ctx.strokeStyle = crossing ? skin['draw-selected-cross'] : bandInk(selectionMode);
    ctx.lineWidth = 1;
    ctx.setLineDash(itemsBox && !crossing ? [] : [4, 3]);
    ctx.strokeRect(Math.min(a.x, b.x), Math.min(a.y, b.y),
      Math.abs(b.x - a.x), Math.abs(b.y - a.y));
    ctx.restore();
  };

  // ── assemblies ────────────────────────────────────────────────────────────
  // A GROUP NAMES ITS MEMBERS BY TYPE AND ID, never by object reference
  // (_createGroup :17940). That is what lets it survive a save and a reload,
  // where every object in the drawing is a new one: the ids come back, the
  // references do not.
  //
  // A GROUP IS "SELECTED" IF ANY ONE MEMBER IS -- the old page's own test
  // (_selectedGroups :…, `items.some(isSelected)`), not "all members". So
  // clicking one wall of an assembly and pressing UNGROUP releases the whole
  // thing, which is what a drafter means by it.
  const groups = () => (drawing?.groups || []);

  const memberKey = entry => `${entry.type}:${entry.item?.id}`;

  const itemsOfGroup = group => {
    const want = new Set((group.members || []).map(m => `${m.type}:${m.id}`));
    const out = [];
    const sweep = (type, list) => list.forEach(item => {
      if (want.has(`${type}:${item.id}`)) out.push({ type, item });
    });
    sweep('wall', walls());
    sweep('line', lines());
    sweep('floor', floors());
    sweep('note', notes());
    // And the rest a click can pick: a kitchen with no walls of its own is an
    // assembly of fixtures, and roofs go into assemblies too (Movie, 18 Oct).
    sweep('fixture', fixtures());
    sweep('stair', stairs());
    sweep('shape', shapes());
    sweep('roomtag', roomTags());
    sweep('roof', pickRoofs());
    // AND THE DOORS, WINDOWS, OUTLINES AND DIMENSIONS a window of the WC took
    // in (Movie, 18 Oct: "i'm not able to make an ASSEBLY - so i can select
    // it as 1 UNIT - its always in peiced"): an assembly that could not find
    // them again dropped them the moment it was picked.
    sweep('fenestration', (drawing?.fenestrations || []).filter(o => walls().some(w => String(w.id) === String(o.wallId))));
    sweep('outline', outlines());
    sweep('dimension', dimensions());
    return out;
  };

  const groupOf = entry => groups().find(group => (group.members || [])
    .some(m => m.type === entry.type && String(m.id) === String(entry.item?.id))) || null;

  // ── LEVEL LOCK ─────────────────────────────────────────────────────────────
  // A PORT of MODEL.dc.html's level-lock tier (:17750-17825), and the split is
  // the module's: level-lock.js owns every RULE -- which lock holds a group,
  // who its siblings are, that a lock of one is not a lock, that a shared
  // corner moves once -- and this page owns the real point objects and the
  // relinking of dragged vertices. Nothing below re-decides anything the
  // module already decides; the order is explicit that reaching for it is the
  // point, so the page cannot quietly grow a second copy of siblingIds the day
  // the module changes.
  const levelLocks = () => (drawing?.levelLocks || []);

  // THE SIBLINGS ARE ON OTHER FLOORS, WHICH IS THE ENTIRE POINT, so they must
  // be found in the WHOLE drawing and not through the level-filtered
  // accessors. itemsOfGroup sweeps walls()/lines()/floors(), and those answer
  // for the ACTIVE level only -- so a lock asked for its sibling's items while
  // the drafter stands on the other floor gets an empty list, moves nothing,
  // and reports success. The lock would then be a feature that works only when
  // both assemblies are on the level you are already looking at, which is the
  // one case a level lock is not for.
  const itemsOfGroupAnywhere = group => {
    const want = new Set((group?.members || []).map(m => `${m.type}:${m.id}`));
    const out = [];
    const sweep = (type, list) => (list || []).forEach(item => {
      if (item && want.has(`${type}:${item.id}`)) out.push(item);
    });
    sweep('wall', drawing?.walls);
    sweep('line', drawing?.lines);
    sweep('floor', drawing?.floors);
    sweep('note', drawing?.notes);
    return out;
  };

  // ── ANCHOR NODES (Movie, 22 Oct) ────────────────────────────────────────
  //
  // "once more than 2 items are 'Y'ed, i'd like to specify a point on the
  // assembly and also sharing a node with a non - assebly node ... if that
  // point moves the 'Y' object will moves according to how that point moves"
  // -- in AQUA, apart from the suites' white and gold super nodes -- and, on
  // a closet bumped into an outside wall, "make the top an bottom of the walls
  // STRETCH where the nodes are connected so it allows the Y object to move
  // back and forth within the other walls ... like it as if it was a window";
  // "would only work if 2 nodes alone a similar walls that are aligned".
  //
  // An anchor is an END OF ONE OF THE ASSEMBLY'S OWN WALLS -- { wallId, end }
  // on the group, so it survives a save -- standing on a corner a wall
  // outside the assembly holds too (the pool makes that one object). Then:
  //   - ONE anchor: the assembly FOLLOWS it. A corner or wall drag that moves
  //     the shared corner carries the whole assembly by the same distance.
  //   - TWO anchors on outside walls that line up: the assembly SLIDES along
  //     that line like a window, and the two outside walls stretch and shrink
  //     to stay joined, never below ANCHOR_MIN_FT.
  const ANCHOR_MIN_FT = 0.5;
  const ANCHOR_INK = '#40e0d0';
  const groupWalls = group => itemsOfGroupAnywhere(group).filter(item => (drawing?.walls || []).includes(item));
  const outsideWallsAt = (group, vtx) => {
    const own = new Set(groupWalls(group));
    return (drawing?.walls || []).filter(w => w && !own.has(w) && (w.start === vtx || w.end === vtx));
  };
  const anchorsOf = group => (Array.isArray(group?.anchors) ? group.anchors : []).map(a => {
    const wall = groupWalls(group).find(w => String(w.id) === String(a?.wallId));
    const vtx = wall ? (a.end === 'end' ? wall.end : wall.start) : null;
    return vtx ? { wallId: a.wallId, end: a.end === 'end' ? 'end' : 'start', wall, vtx } : null;
  }).filter(Boolean);
  // THE WINDOW'S TRACK: the line the two anchors share, and how far either
  // way the assembly may go before an outside wall would shrink past the
  // minimum. Null when the two do not stand on lined-up outside walls.
  const anchorSlide = group => {
    const list = anchorsOf(group);
    if (list.length !== 2) return null;
    const [A, B] = list.map(a => a.vtx);
    const len = Math.hypot(B.x - A.x, B.z - A.z);
    if (len < 1e-6) return null;
    const u = { x: (B.x - A.x) / len, z: (B.z - A.z) / len };
    let lo = -Infinity, hi = Infinity;
    const lined = list.every(({ vtx }) => {
      const hosts = outsideWallsAt(group, vtx).map(w => (w.start === vtx ? w.end : w.start)).filter(o => {
        const ox = o.x - vtx.x, oz = o.z - vtx.z, ol = Math.hypot(ox, oz);
        return ol > 1e-6 && Math.abs(ox * u.z - oz * u.x) / ol < 0.01;
      });
      hosts.forEach(o => {
        const s = (o.x - vtx.x) * u.x + (o.z - vtx.z) * u.z;
        if (s > 0) hi = Math.min(hi, s - ANCHOR_MIN_FT); else lo = Math.max(lo, s + ANCHOR_MIN_FT);
      });
      return hosts.length > 0;
    });
    return lined ? { u, lo: Math.min(lo, 0), hi: Math.max(hi, 0) } : null;
  };
  // A DRAG'S TRAVEL ON THAT TRACK: along it only, held between its ends, by
  // the foot with the 1' light lit.
  const slideDelta = (slide, dx, dz) => {
    let t = dx * slide.u.x + dz * slide.u.z;
    const Q = window.DraftToyConstraints;
    if (footOn && Q) t = Q.quantiseFeet(t);
    t = Math.max(slide.lo, Math.min(slide.hi, t));
    return { dx: slide.u.x * t, dz: slide.u.z * t };
  };
  // WHO FOLLOWS A CORNER OR WALL DRAG: every one-anchor assembly whose anchor
  // is among the points in hand -- its other points, from where they start,
  // each told which point it rides. Not an assembly whose own wall is the
  // one being dragged: that is the assembly being reshaped, not followed.
  const anchorFollowers = (before, body) => groups().flatMap(group => {
    const list = anchorsOf(group);
    if (list.length !== 1) return [];
    const lead = before.find(b => b.vtx === list[0].vtx);
    if (!lead || (body && groupWalls(group).includes(body))) return [];
    if (!outsideWallsAt(group, lead.vtx).length) return [];
    return window.DraftLevelLock.uniquePoints(itemsOfGroupAnywhere(group))
      .filter(v => v !== lead.vtx && !before.some(b => b.vtx === v))
      .map(v => ({ vtx: v, x: v.x, z: v.z, offX: v.offX, offZ: v.offZ, follows: lead }));
  });
  // THE ANCHORS, AQUA (Movie, 22 Oct: "SUPERNODe color Aqua Turquoise"), on
  // this level's assemblies; a ring round each of the assembly whose anchors
  // are being picked, so the drafter sees which corners can take one.
  paintAnchors = () => {
    if (presenting || !drawing) return;
    const here = new Set(walls());
    let n = 0;
    groups().forEach(group => anchorsOf(group).forEach(a => {
      if (!here.has(a.wall)) return;
      const p = toS(a.vtx);
      ctx.save();
      ctx.shadowColor = ANCHOR_INK;
      ctx.shadowBlur = 10;
      ctx.fillStyle = ANCHOR_INK;
      ctx.beginPath(); ctx.arc(p.x, p.y, 4.5, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      n += 1;
    }));
    if (anchorPicking) {
      groupWalls(anchorPicking).flatMap(w => [w.start, w.end])
        .filter((v, i, all) => all.indexOf(v) === i && outsideWallsAt(anchorPicking, v).length)
        .forEach(v => {
          const p = toS(v);
          ctx.save();
          ctx.strokeStyle = ANCHOR_INK;
          ctx.globalAlpha = 0.7;
          ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.arc(p.x, p.y, 8, 0, Math.PI * 2); ctx.stroke();
          ctx.restore();
        });
    }
    canvas.dataset.anchors = String(n);
  };
  const followAnchors = follow => (follow || []).forEach(f => {
    f.vtx.x = f.x + (f.follows.vtx.x - f.follows.x);
    f.vtx.z = f.z + (f.follows.vtx.z - f.follows.z);
  });

  const levelLockFor = group =>
    (group ? window.DraftLevelLock.lockFor(levelLocks(), group.id) : null);

  const levelLockSiblings = group => (group
    ? window.DraftLevelLock.siblingIds(levelLocks(), group.id)
      .map(id => groups().find(other => other.id === id))
      .filter(Boolean)
    : []);

  // EVERY POINT ONCE. A corner shared by two walls of one assembly is ONE
  // object in the vertex pool, so walking items and moving their points would
  // move it twice and tear the assembly apart at its own corners. uniquePoints
  // is identity-based and is exactly the instrument for it -- which is why it
  // is the module's and not re-rolled here.
  const translateItemsBy = (items, dx, dz) => {
    const points = window.DraftLevelLock.uniquePoints(items);
    window.DraftLevelLock.translate(points, dx, dz);
    // The half that stays here: a dragged linked vertex re-measures its master
    // offset rather than dropping the link, same as every other move on this
    // page. The module owns geometry, not the boneyard.
    points.forEach(relinkVertex);
    return points.length;
  };

  // MOVE THE SIBLINGS, and only the siblings. Called with the delta the member
  // group has ALREADY moved by, so the mover is never moved twice: the caller
  // owns its own move and this owns the others. A check that watches only the
  // siblings passes on a page that moves the mover at double speed, which is
  // why the acceptance asserts the mover's own delta too.
  //
  // PLAN ONLY. Per-floor properties -- heights, the storey a wall sits on --
  // stay per-floor: a lock says "the same place on the plan", not "the same
  // storey", which is the whole reason it spans storeys at all.
  const applyLevelLockDelta = (group, dx, dz) => {
    if (!group || (Math.abs(dx) < 1e-9 && Math.abs(dz) < 1e-9)) return 0;
    const siblings = levelLockSiblings(group);
    if (!siblings.length) return 0;
    let moved = 0;
    siblings.forEach(sibling => {
      moved += translateItemsBy(itemsOfGroupAnywhere(sibling), dx, dz);
    });
    return moved;
  };

  // BREAKING IS AN EXPLICIT ACT. A drag never breaks a lock and neither does
  // distance -- the same principle as storey detachment in the BONE model. If
  // the drafter has not said so the lock holds, however far apart the
  // assemblies end up.
  //
  // It REMOVES rather than marks: a broken lock and no lock behave
  // identically, and one of them is a state to carry, migrate and get wrong.
  const breakLevelLock = lock => {
    if (!lock) return false;
    const before = levelLocks().length;
    drawing.levelLocks = window.DraftLevelLock.breakLock(levelLocks(), lock.id);
    if (drawing.levelLocks.length === before) return false;
    // ON THE STRIP, NOT IN A MODAL. MODEL.dc.html says this through
    // drawingMessage -- a line, not a door -- and a modal here would be the
    // page stopping the drafter to tell him the thing he just asked for
    // happened. It also sat over the SAVE button afterwards, which is how it
    // was caught.
    sayOnStrip(`${lock.name} broken — each floor's assembly moves alone now.`);
    markDirty();
    return true;
  };

  // A LOCK OF ONE IS NOT A LOCK, and makeLock refuses it -- the same rule
  // drawing-format.js enforces on load, so this verb cannot create what a
  // reload would drop. Refused HERE by asking the module rather than by
  // counting members here, which is the check the acceptance names.
  const lockGroupsAcrossLevels = (chosen, name = 'LEVEL LOCK') => {
    const nextId = Number.isInteger(drawing?.nextLevelLockId)
      ? drawing.nextLevelLockId : 1;
    const lock = window.DraftLevelLock.makeLock(
      `lock-${nextId}`, name, (chosen || []).map(group => group?.id));
    if (!lock) return null;
    drawing.nextLevelLockId = nextId + 1;
    (drawing.levelLocks || (drawing.levelLocks = [])).push(lock);
    markDirty();
    return lock;
  };

  const selectedGroups = () => groups().filter(group => (group.members || [])
    .some(m => selection.some(entry =>
      entry.type === m.type && String(entry.item?.id) === String(m.id))));

  // CLICKING A MEMBER TAKES THAT MEMBER, NOT THE WHOLE ASSEMBLY -- and this is
  // a deliberate divergence from the old page, left open rather than decided
  // here.
  //
  // The old page pulls a hit item's group in with it
  // (_addItemsAndTheirGroups), and that shipped here first. It broke ten
  // checks in tests/model-html-draw-delete.spec.js, whose fixture groups w-a
  // with w-b: a tap meant to select ONE wall selected two, the DELETE button
  // (which means "exactly one wall") went dark, and "delete this wall" had
  // quietly become "delete this assembly". That last one is a product
  // decision -- a drafter who groups two walls and presses Delete on one may
  // or may not mean both -- and it is not mine to make inside a PR whose
  // order says only that ASSEMBLY groups and UNGROUP releases.
  //
  // NOTHING IN THE ACCEPTANCE NEEDS THE EXPANSION. selectedGroups() counts a
  // group as selected when ANY member is, which is the old page's own test, so
  // UNGROUP still releases an assembly from a click on one of its walls. The
  // expansion was parity I reached for, not a requirement, and the established
  // behaviour wins while the question is open.
  //
  // DECIDED FOR A FIXED ONE (Movie, 18 Oct: "i'm not able to make an ASSEBLY
  // - so i can select it as 1 UNIT - its always in peiced"). A FIXED
  // assembly is one unit -- a WC -- and a click on any piece of it picks it
  // whole, the way ROTATE and MOVE already take it whole. A NOT FIXED one
  // still picks piece by piece, which is what NOT FIXED says.
  const withGroup = entry => {
    if (!entry) return [];
    const owner = groupOf(entry);
    if (owner && owner.fixed === true) return itemsOfGroup(owner);
    // A BEAM IS ITS WHOLE ROW. AUTO BEAM lays a row in pieces, post to post,
    // and what Movie moves and deletes is "one line of beams" -- so a click
    // on any piece takes them all.
    if (entry.type === 'beam') return beamRun(entry.item).map(item => ({ type: 'beam', item }));
    return [entry];
  };
  // The pieces of beam that make one row with this one: the same level and
  // view, on the same line, joined end to end.
  const beamRun = beam => {
    const G = window.DraftGeometry2D;
    if (!beam?.start || !beam?.end) return [beam];
    const ux = beam.end.x - beam.start.x, uz = beam.end.z - beam.start.z, len = Math.hypot(ux, uz);
    if (len < 1e-6) return [beam];
    const sameLine = other => {
      if (!other?.start || !other?.end) return false;
      if (Number(other.levelId) !== Number(beam.levelId) || (other.view || 'plan') !== (beam.view || 'plan')) return false;
      const vx = other.end.x - other.start.x, vz = other.end.z - other.start.z, vlen = Math.hypot(vx, vz);
      if (vlen < 1e-6 || Math.abs(ux * vz - uz * vx) / (len * vlen) > 1e-3) return false;
      return Math.abs((other.start.x - beam.start.x) * uz - (other.start.z - beam.start.z) * ux) / len < 0.01;
    };
    const pool = (drawing?.beams || []).filter(sameLine);
    const touches = (a, b) => [a.start, a.end].some(p => [b.start, b.end]
      .some(q => Math.hypot(p.x - q.x, p.z - q.z) < 0.01 || G.pointToSegment(p, b).d < 0.01));
    const run = [beam];
    for (let i = 0; i < run.length; i++) {
      pool.forEach(other => { if (!run.includes(other) && touches(run[i], other)) run.push(other); });
    }
    return run;
  };

  // ── WHAT ELSE A CLICK CAN PICK (Movie, 1 Oct: "when i try to SELECT a
  // stair or the CLOSET or other stuff (ROOF) i can't select it") ──────────
  //
  // THE CHAIN STOPPED AT FIVE TYPES, so a click on a closet landed on the wall
  // behind it, a click on a stair landed on the floor under it, and a click
  // on a roof landed on nothing. Each test below asks the SAME shape its
  // painter draws -- fixtureGeometry's corners, stairPlanParts' runs and
  // landing, the roof's own footprint -- so a click picks what is on screen
  // and cannot pick what is not.
  //
  // A FIXTURE IS ITS BOX ALONG THE WALL, decks included for a tub: the old
  // page's _findFixtureAt tests the same span. Latest first, so of two
  // fixtures overlapping on screen the one painted on top wins.
  // AN ALREADY-SELECTED FIXTURE IS A GRAB, the opening's rule: press it to
  // choose it, press it again and drag.
  const fixtureBodyAt = worldPt => {
    const fixture = fixtureAt(worldPt);
    return fixture && selection.some(entry => entry.item === fixture) ? fixture : null;
  };
  const fixtureAt = worldPt => {
    const FG = window.DraftFixtureGeometry;
    if (!FG) return null;
    const all = drawing?.walls || [];
    const list = fixtures();
    for (let i = list.length - 1; i >= 0; i -= 1) {
      const geo = FG.fixtureGeometry(all, list[i]);
      if (!geo) continue;
      const rings = [geo.corners, ...(geo.decks || [])];
      if (rings.some(ring => ring?.length >= 3 && pointInRing(ring, worldPt))) return list[i];
    }
    return null;
  };

  // A STAIR IS ITS FLIGHTS AND ITS LANDING: each run is a rectangle the
  // stair's width wide, centred on the walk line, and an L or U adds the
  // landing's own polygon. Built from stairPlanParts, the same parts the
  // painter strokes.
  const stairRings = (stair, levels) => {
    const SG = window.DraftStairGeometry;
    if (!SG || !stair?.start || !stair?.end) return [];
    const parts = SG.stairPlanParts(stair, SG.stairCurrentLayout(stair, levels));
    const half = (Number(stair.widthFt) || 3) / 2;
    const rings = (parts.runs || []).map(run => {
      const end = { x: run.start.x + run.dir.x * run.lenFt, z: run.start.z + run.dir.z * run.lenFt };
      const side = { x: -run.dir.z * half, z: run.dir.x * half };
      return [
        { x: run.start.x + side.x, z: run.start.z + side.z },
        { x: end.x + side.x, z: end.z + side.z },
        { x: end.x - side.x, z: end.z - side.z },
        { x: run.start.x - side.x, z: run.start.z - side.z },
      ];
    });
    if (parts.landing?.poly?.length >= 3) rings.push(parts.landing.poly);
    return rings;
  };
  const stairAt = worldPt => {
    const levels = stairLevels();
    return stairs().slice().reverse()
      .find(stair => stairRings(stair, levels).some(ring => pointInRing(ring, worldPt))) || null;
  };

  // ── THE HOLE A STAIR CLIMBS THROUGH ─────────────────────────────────────
  //
  // buildStairOpenings files each well with its stair's id, and never cuts a
  // second one for a stair that already has one -- so a flight that moves and
  // leaves its well behind has no way back to it. The drag takes the well
  // with it, and this is what it asks for.
  //
  // A SHARED WELL IS NOT MOVED, AND IS SAID RATHER THAN IGNORED. A bilevel's
  // two flights climb through ONE hole (`stairIds`), sized to both: dragging
  // one flight's share of it by that flight's delta would move the other
  // flight's headroom out from under it. `shared` is what the release reports.
  const stairWellOf = stair => {
    const mine = (drawing?.surfaceOpenings || []).filter(hole =>
      Number(hole.stairId) === Number(stair.id)
      || (hole.stairIds || []).map(Number).includes(Number(stair.id)));
    const alone = mine.filter(hole => (hole.stairIds || []).length <= 1
      && Array.isArray(hole.points) && hole.points.length >= 3);
    return {
      hole: alone.length === 1 ? alone[0] : null,
      shared: mine.length > alone.length,
    };
  };

  // AND THE BEAMS THAT FRAME IT (Movie, 18 Oct: "the beam stayed in the old
  // location too"). The open side's flush beams carry the stair's id; their
  // posts do not, so a post goes with them when it stands on one of their
  // ends and on no other beam's -- a post a second beam also bears on is that
  // beam's too, and stays.
  const stairFramingOf = stair => {
    const beams = (drawing?.beams || []).filter(b => Number(b.stairId) === Number(stair.id) && b.start && b.end);
    const near = (p, q) => Math.hypot(p.x - q.x, p.z - q.z) < 0.05;
    const others = (drawing?.beams || []).filter(b => !beams.includes(b) && b.start && b.end);
    const columns = (drawing?.columns || []).filter(c => c.point
      && beams.some(b => near(c.point, b.start) || near(c.point, b.end))
      && !others.some(b => near(c.point, b.start) || near(c.point, b.end)));
    return { beams, columns };
  };

  // A WELL THAT NO LONGER SITS IN THE FLOOR IT WAS CUT FROM. buildStairOpenings
  // REFUSES to cut one of those ("the opening runs off the floor") -- but a
  // drafter moving or reshaping a stair he has already placed is mid-
  // arrangement, so the hole follows him and the page says what it has become
  // instead of refusing the gesture. Asked of the host it is filed against,
  // not of whatever floor it now overlaps: a hole belongs to one floor, and
  // re-hosting it is an edit nobody asked for.
  // ── A STAIR LOCKED TO A WALL'S INSIDE FACE (Movie, 18 Oct) ─────────────
  //
  // "make the INTERIOR line of a wall (like a SNAP POINT for the stairs so
  // the edge of the stairs can move to line up there easily. for the
  // stiarcase going UPSTAIRS we should use the main floor wall int line, but
  // going down to the founsation from main floor we need to use the
  // thickness of the foundation and inside insulation" -- the insulation
  // "drawn as part of the perimiter line", so the foundation wall's own
  // thickness is the face. "once the stair is locked onto that wall, the
  // user can move it, but if the user also changes the foundation wall
  // thickness, that should also move the stairs (and reduce the width ...)"
  // -- keeping "the other side of stairs in the same location", on walls
  // either side or one, with no minimum, and a pop-up saying the new width.
  //
  // THE WALLS ARE THE FLOOR THE STAIR STANDS ON. A stair is filed on the
  // floor it goes DOWN from, so the flight between MAIN and 2ND is filed on
  // 2ND and stands between MAIN's walls; the one filed on MAIN stands in the
  // basement, between the foundation walls (and any basement wall).
  //
  // A STRAIGHT FLIGHT ONLY, for now: an L or a U has more than one pair of
  // sides and turns, and is left as it was.
  const STAIR_SNAP_PX = 14;
  const stairFaceWalls = stair => {
    const SG = window.DraftStairGeometry;
    const landing = SG?.stairLandingLevelId?.(stair.levelId, stairLevels().floors);
    if (landing == null) return [];
    const basement = Number(landing) === 1;
    return (drawing?.walls || []).filter(wall => Number(wall.levelId) === Number(landing) && wall.start && wall.end
      && (basement ? ['foundation', 'plan'].includes(wall.view || 'plan') : (wall.view || 'plan') === 'plan'));
  };
  const stairFrame = stair => {
    if (!stair?.start || !stair?.end || (stair.shape || 'straight') !== 'straight') return null;
    const dx = stair.end.x - stair.start.x, dz = stair.end.z - stair.start.z, len = Math.hypot(dx, dz);
    if (len < 1e-6) return null;
    const u = { x: dx / len, z: dz / len };
    return { c: { x: (stair.start.x + stair.end.x) / 2, z: (stair.start.z + stair.end.z) / 2 },
      u, n: { x: -u.z, z: u.x }, len, half: (Number(stair.widthFt) || 3) / 2 };
  };
  // WHERE A WALL'S FACE STANDS ACROSS THE FLIGHT: its offset along the
  // stair's left normal, for the face toward the flight's middle -- or null
  // for a wall not alongside it (not parallel, beside less than 6" of it, or
  // standing across the walk line).
  const wallFaceAcross = (frame, wall) => {
    const G = window.DraftGeometry2D;
    const wx = wall.end.x - wall.start.x, wz = wall.end.z - wall.start.z, wl = Math.hypot(wx, wz);
    if (wl < 1e-6) return null;
    const wu = { x: wx / wl, z: wz / wl };
    if (Math.abs(wu.x * frame.u.z - wu.z * frame.u.x) > 1e-3) return null;
    const along = p => (p.x - frame.c.x) * frame.u.x + (p.z - frame.c.z) * frame.u.z;
    const a = along(wall.start), b = along(wall.end);
    if (Math.min(Math.max(a, b), frame.len / 2) - Math.max(Math.min(a, b), -frame.len / 2) < 0.5) return null;
    const o = (wall.start.x - frame.c.x) * frame.n.x + (wall.start.z - frame.c.z) * frame.n.z;
    const k = -wu.z * frame.n.x + wu.x * frame.n.z;
    const { startOff, endOff } = G.wallFaceOffsets(wall, openingThicknessFt()(wall));
    const faces = [o + k * startOff, o + k * endOff];
    if (faces[0] * faces[1] <= 0) return null;
    return Math.abs(faces[0]) < Math.abs(faces[1]) ? faces[0] : faces[1];
  };
  // THE SNAP: how far across to move the flight so its nearer side lies on
  // the nearest face within reach, or null.
  const stairFaceSnap = stair => {
    const frame = stairFrame(stair);
    if (!frame) return null;
    const reach = STAIR_SNAP_PX / view.scale;
    let best = null;
    stairFaceWalls(stair).forEach(wall => {
      const f = wallFaceAcross(frame, wall);
      if (f == null) return;
      const shift = f > 0 ? f - frame.half : f + frame.half;
      if (Math.abs(shift) <= reach && (!best || Math.abs(shift) < Math.abs(best.shift))) best = { shift, frame };
    });
    return best;
  };
  // THE SIDES THAT LIE ON A FACE NOW, which is what a lock records.
  const stairLockNow = stair => {
    const frame = stairFrame(stair);
    if (!frame) return null;
    const lock = {};
    stairFaceWalls(stair).forEach(wall => {
      const f = wallFaceAcross(frame, wall);
      if (f == null) return;
      if (f > 0 && Math.abs(f - frame.half) < 1e-3) lock.left = { wallId: wall.id };
      if (f < 0 && Math.abs(f + frame.half) < 1e-3) lock.right = { wallId: wall.id };
    });
    return lock.left || lock.right ? lock : null;
  };
  // A WALL GROWN OR SHRUNK: every locked flight's locked sides go to where
  // the faces now are, the free side staying put. Each one changed comes
  // back with its width before and after.
  const followStairLocks = () => {
    const changed = [];
    (drawing?.stairs || []).forEach(stair => {
      if (!stair.lock) return;
      const frame = stairFrame(stair);
      if (!frame) return;
      let left = frame.half, right = -frame.half;
      ['left', 'right'].forEach(side => {
        const id = stair.lock[side]?.wallId;
        if (id == null) return;
        const wall = (drawing.walls || []).find(w => String(w.id) === String(id));
        const f = wall ? wallFaceAcross(frame, wall) : null;
        if (f == null || (side === 'left') !== (f > 0)) { delete stair.lock[side]; return; }
        if (side === 'left') left = f; else right = f;
      });
      if (!stair.lock.left && !stair.lock.right) delete stair.lock;
      const widthFt = left - right, shift = (left + right) / 2;
      if (widthFt < 0.5 || (Math.abs(widthFt - frame.half * 2) < 1e-4 && Math.abs(shift) < 1e-4)) return;
      const by = p => ({ ...p, x: p.x + frame.n.x * shift, z: p.z + frame.n.z * shift });
      const was = frame.half * 2;
      stair.start = by(stair.start);
      stair.end = by(stair.end);
      stair.widthFt = widthFt;
      const hole = stairWellOf(stair).hole;
      const ring = hole && stairOpeningFootprint(stair);
      if (ring && ring.length >= 3) hole.points = ring.map(pt => ({ x: pt.x, z: pt.z }));
      const landing = window.DraftStairGeometry?.stairLandingLevelId?.(stair.levelId, stairLevels().floors);
      changed.push({ stair, was, now: widthFt, basement: Number(landing) === 1 });
    });
    return changed;
  };
  const showStairFitNote = changed => {
    const card = document.getElementById('stair-fit');
    if (!card || !changed.length) return;
    const F = window.DraftFormatters;
    const ftIn = ft => F.formatArchitecturalInches(ft * 12);
    card.querySelector('[data-stair-fit-text]').textContent = changed.every(c => c.basement)
      ? 'The basement stair widths at the exterior walls have been adjusted to fit the new foundation thickness.'
      : 'The stair widths at the walls have been adjusted to fit the new wall thickness.';
    card.querySelector('[data-stair-fit-list]').replaceChildren(...changed.map(c => {
      const row = document.createElement('div');
      row.textContent = `STAIR ${c.stair.id}: ${ftIn(c.was)} \u2192 ${ftIn(c.now)} WIDE`;
      return row;
    }));
    card.hidden = false;
    card.querySelector('[data-stair-fit-ok]').focus();
  };
  document.querySelector('#stair-fit [data-stair-fit-ok]')?.addEventListener('click', () => {
    document.getElementById('stair-fit').hidden = true;
  });

  const wellOffItsFloor = hole => {
    const G = window.DraftGeometry2D;
    const host = (drawing?.floors || [])
      .find(floor => String(floor.id) === String(hole.hostId));
    return !!host && !G.ringInsideRing(hole.points, host.points || []);
  };

  // A ROOF IS PICKED ON THE LEVEL IT IS DRAWN ON, which for a built house is
  // ROOF: roofs() is the active level's, and a roof that is not painted is
  // not offered -- this file's rule everywhere. LAST in the chain, as on the
  // old page (_findRoofAt after the floor), so the walls and floors drawn
  // inside a footprint keep their clicks.
  // AND ON SITE, THE ROOF'S (Movie, 18 Oct: "i'd like to be able to select
  // the roof and on this page and change the properties of the eave i
  // clicked on"). The site plan paints the ROOF level's roofs over the
  // footprint, so a roof painted there is a roof that can be picked there --
  // the rule above, kept, for the one level that draws another's roofs.
  const pickRoofs = () => (activeLevelId() === SITE_LEVEL_ID
    ? (drawing?.roofs || []).filter(r => Number(r.levelId) === ROOF_LEVEL_ID) : roofs());
  const roofAt = worldPt => pickRoofs().slice().reverse()
    .find(roof => (roof.points || []).length >= 3 && pointInRing(roof.points, worldPt)) || null;

  // Returns { type, item } or null, in the old page's precedence.
  // ── DIMENSIONS: WHERE THEY ARE DRAWN, AND THEIR ROWS ───────────────────
  // The painter stands the dimension line 19px off its two points
  // (render-2d.js drawDimension2D), so the pick asks of the drawn line, in
  // screen pixels, not of the points.
  const DIM_LINE_PX = 19;
  const dimDrawnLine = d => {
    const a = toS(d.start), b = toS(d.end);
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    if (len < 1) return null;
    const nx = -(b.y - a.y) / len, ny = (b.x - a.x) / len;
    return [{ x: a.x + nx * DIM_LINE_PX, y: a.y + ny * DIM_LINE_PX },
      { x: b.x + nx * DIM_LINE_PX, y: b.y + ny * DIM_LINE_PX }];
  };
  const dimensionAt = worldPt => {
    const s = toS(worldPt);
    let best = null, bestD = SELECT_GRAB_PX;
    shownDimensions().forEach(d => {
      const line = dimDrawnLine(d);
      if (!line) return;
      const [p, q] = line;
      const dx = q.x - p.x, dy = q.y - p.y;
      const t = Math.max(0, Math.min(1, ((s.x - p.x) * dx + (s.y - p.y) * dy) / (dx * dx + dy * dy)));
      const dist = Math.hypot(s.x - (p.x + t * dx), s.y - (p.y + t * dy));
      if (dist < bestD) { bestD = dist; best = d; }
    });
    return best;
  };
  // THE ROW A DIMENSION STANDS IN: every dimension on this level and view
  // whose line is the same straight line (Movie, 6 Oct: the whole row slides
  // in or out together, staying straight and lined up).
  const dimNormal = d => {
    const dx = d.end.x - d.start.x, dz = d.end.z - d.start.z;
    const len = Math.hypot(dx, dz) || 1;
    return { x: -dz / len, z: dx / len };
  };
  // THE POINT A DIMENSION IS MEASURED TO (Movie, 20 Oct: "i'd like to be
  // able to select that 'point' arrows, etc where they meet"): the spot
  // where two pieces of a hand string meet, or a string's end -- the arrow
  // tips on the drawn line. Hand dimensions only: AUTO DIMS lay themselves
  // out again from the walls, so a point taken off one would be back on the
  // next re-lay. Nearest tip within the grab, and it wins over the line it
  // stands on (hitAt asks here first).
  const dimPointAt = worldPt => {
    const s = toS(worldPt);
    let best = null, bestD = SELECT_GRAB_PX;
    shownDimensions().forEach(d => {
      if (d.auto) return;
      const line = dimDrawnLine(d);
      if (!line) return;
      [['start', line[0]], ['end', line[1]]].forEach(([point, q]) => {
        const dist = Math.hypot(s.x - q.x, s.y - q.y);
        if (dist < bestD) { bestD = dist; best = { type: 'dimension', item: d, point }; }
      });
    });
    return best;
  };
  const dimRow = grabbed => {
    const n = dimNormal(grabbed);
    const at = p => p.x * n.x + p.z * n.z;
    const line = at(grabbed.start);
    return shownDimensions().filter(d => {
      const m = dimNormal(d);
      const parallel = Math.abs(m.x * n.z - m.z * n.x) < 1e-6;
      return parallel && Math.abs(at(d.start) - line) < 0.01 && Math.abs(at(d.end) - line) < 0.01;
    });
  };

  // EVERYTHING UNDER A PRESS, top first, in the pick chain's own order:
  // hitAt is its first, and a click again on the same spot steps down it
  // (pickUnder). `first` stops at the first, which is every hover's need.
  const hitsAt = (worldPt, first = false) => {
    const out = [];
    const take = hit => { if (hit && !out.some(h => h.item === hit.item)) out.push(hit); return first && out.length > 0; };
    // A ROOM TAG IS ON TOP OF WHAT IT NAMES: it is painted last, over the
    // floor and often over a fixture, so the pick agrees with the picture.
    // Movie, 1 Oct: "i wasn't able to select the ROOM TAG".
    if (filterAllows('roomtag')) {
      const tag = roomTagAt(worldPt);
      if ((tag) && take({ type: 'roomtag', item: tag })) return out;
    }
    // A NOTE TOO: painted with the tags, over what it points at.
    if (filterAllows('note')) {
      const note = noteAt(worldPt);
      if ((note) && take({ type: 'note', item: note })) return out;
    }
    // AN OPENING BEATS ITS HOST WALL, and the old page says why in its own
    // words: "Openings under a select click take priority over their host
    // wall, so an opening can be picked and deleted without grabbing the wall
    // around it." An opening is always ON a wall, so a wall-first chain would
    // make every opening unselectable -- not hard to select, impossible.
    if (filterAllows('fenestration')) {
      const opening = openingAt(worldPt);
      if ((opening) && take({ type: 'fenestration', item: opening })) return out;
    }
    // A FIXTURE BEATS ITS HOST WALL for the opening's reason: a closet or a
    // sink is always against a wall, and wall-first would make every one of
    // them unselectable.
    if (filterAllows('fixture')) {
      const fixture = fixtureAt(worldPt);
      if ((fixture && fixtureKindAllowed(fixture)) && take({ type: 'fixture', item: fixture })) return out;
    }
    // A DIMENSION IS ANNOTATION, painted over the plan, and its line stands
    // off what it measures -- so it is asked before the walls it sits beside.
    if (filterAllows('dimension')) {
      const point = dimPointAt(worldPt);
      if (point && take(point)) return out;
      const dimension = dimensionAt(worldPt);
      if ((dimension) && take({ type: 'dimension', item: dimension })) return out;
    }
    if (filterAllows('wall')) {
      const wall = segAt(walls(), worldPt);
      if ((wall) && take({ type: 'wall', item: wall })) return out;
    }
    if (filterAllows('line')) {
      const line = lineAt(worldPt);
      if ((line) && take({ type: 'line', item: line })) return out;
    }
    // A COLUMN, THEN THE BEAM IT HOLDS UP (Movie, 19 Oct: "I'd like to be
    // able to move the BEAM manually so that all the columns follow. i will
    // also want to probably DELETE one line of beams"). A beam a click could
    // not reach could be neither, so they pick like a line does; the post
    // first, since it stands on the beam and a beam-first chain would make
    // every post on one unreachable.
    if (filterAllows('column')) {
      const column = columnAt(worldPt);
      if ((column) && take({ type: 'column', item: column })) return out;
    }
    if (filterAllows('beam')) {
      const beam = segAt(beams(), worldPt);
      if ((beam) && take({ type: 'beam', item: beam })) return out;
    }
    // A STAIR BEATS THE FLOOR IT STANDS IN, which would otherwise take every
    // click inside the stairwell.
    if (filterAllows('stair')) {
      const stair = stairAt(worldPt);
      if ((stair) && take({ type: 'stair', item: stair })) return out;
    }
    // A SHAPE BEATS THE FLOOR UNDER IT: a suite outlined inside a floor would
    // otherwise be unreachable, every click inside it taking the floor.
    if (filterAllows('shape')) {
      const shape = shapes().slice().reverse()
        .find(sh => (sh.points || []).length >= 3 && pointInRing(sh.points, worldPt));
      if ((shape) && take({ type: 'shape', item: shape })) return out;
    }
    if (filterAllows('outline')) {
      const outline = outlineAt(worldPt);
      if ((outline) && take({ type: 'outline', item: outline })) return out;
    }
    if (filterAllows('floor')) {
      const floor = floorAt(worldPt);
      if ((floor) && take({ type: 'floor', item: floor })) return out;
    }
    if (filterAllows('roof')) {
      const roof = roofAt(worldPt);
      if ((roof) && take({ type: 'roof', item: roof })) return out;
    }
    // A HOLOGRAM LAST: it is under the drawing, so anything of this drawing's
    // own at the press is what the press means.
    if (filterAllows('hologram')) {
      const holo = hologramPickAt(worldPt);
      if ((holo) && take({ type: 'hologram', item: holo })) return out;
    }
    // A PHOTO LAST OF ALL (Movie, 23 Oct: "click on the bg photo"): it lies
    // under everything drawn, so it is picked only where nothing else is,
    // and only while TRACE shows it.
    if (filterAllows('underlay')) {
      const photo = underlayAt(worldPt);
      if ((photo) && take({ type: 'underlay', item: photo })) return out;
    }
    return out;
  };
  const hitAt = worldPt => hitsAt(worldPt, true)[0] || null;
  // CLICK AGAIN FOR WHAT IS UNDERNEATH (Movie, 24 Oct: "if a user clicks
  // and the wrong item (if they overlap) is selected the first time, allow
  // the user to make a 2nd click and it will select the 'underneath' item,
  // and if more than 2 a 3rd click will do it too etc... and then cycle back
  // to the first one"). A click within a few pixels of the last one, with
  // one of the things there in hand, takes the next one down that is not
  // already in hand -- an assembly's other walls are skipped -- and after
  // the last comes the first again. Anywhere else, the top one, as always.
  const PICK_AGAIN_PX = 4;
  let lastPick = null;
  const pickUnder = (sx, sy) => {
    const hits = hitsAt(toWorld(sx, sy));
    let at = 0;
    const again = lastPick && Math.hypot(sx - lastPick.sx, sy - lastPick.sy) <= PICK_AGAIN_PX;
    const held = h => selection.some(entry => entry.item === h.item);
    const now = again ? hits.findIndex(held) : -1;
    if (now >= 0 && hits.length > 1) {
      for (let i = 1; i <= hits.length; i += 1) {
        const k = (now + i) % hits.length;
        if (!held(hits[k])) { at = k; break; }
      }
    }
    lastPick = { sx, sy };
    return { hit: hits[at] || null, at, of: hits.length, again: !!again };
  };
  // WHAT IS IN HAND, SAID: which of how many, so the drafter sees there is
  // more under it and what each one is.
  const sayPickUnder = under => {
    if (under.of > 1) sayOnStrip(`${under.at + 1} OF ${under.of} HERE: ${hitSays(under.hit)} \u2014 click again on the same spot for the one under it.`);
  };

  // EVERY SELECTED ITEM, not just the one wall. The highlight is what tells a
  // drafter what a Delete or an ASSEMBLY is about to act on, so a selection of
  // ten that paints one is worse than useless -- it names the wrong thing with
  // total confidence.
  //
  // HANDLES ONLY ON A LONE WALL. They are the grab targets for the corner drag,
  // and cornerAt() only offers them when exactly one wall is selected
  // (selectedWall()). Drawing them on ten walls would advertise ten grabs that
  // do nothing, which is the same lie one step down.
  // ── the corner under the cursor ────────────────────────────────────────────
  // THE PAGE ALREADY KNEW WHERE THE GRAB WAS AND ONLY WHISPERED IT. `cornerAt`
  // has been running on every pointermove since the corner drag landed, but its
  // only output was a CSS cursor -- so the drafter learned where a node was
  // grabbable by sweeping the mouse and watching the pointer flicker, and on a
  // touch screen, where there is no cursor at all, never learned it.
  //
  // A RING, NOT A FILLED SQUARE. The 8px squares belong to the SELECTED wall's
  // own ends and mean "this is yours, drag it"; hover is a weaker claim -- "you
  // could take this" -- and drawing the same mark for both would make the
  // selected handles stop meaning anything. Same ink, hollow, one pixel
  // narrower than the grab circle it stands for.
  //
  // IT IS NOT A SECOND HIT TEST. It paints whatever cornerAt already returned,
  // so the ring cannot promise a grab the drag would refuse: the two cannot
  // disagree, because there is only one of them.
  const HOVER_RING = 'rgba(89,128,166,0.85)';
  const paintHoverCorner = () => {
    if (!hoverCorner) return;
    const p = toS(hoverCorner);
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) return;
    ctx.save();
    ctx.strokeStyle = HOVER_RING;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 6, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  };

  const paintSelection = () => {
    if (!selection.length) return;
    const onScreen = { wall: walls(), line: lines(), floor: floors(), outline: outlines(),
      fixture: fixtures(), stair: stairs(), roof: pickRoofs(), roomtag: roomTags(), shape: shapes(),
      dimension: shownDimensions(), note: notes(), beam: beams(), column: columns(),
      hologram: holograms(), underlay: traceOn ? underlays() : [] };
    // THE OPENINGS AND THEIR SHAPES IN ONE PASS. openingsOn resolves geometry
    // per opening, which is not free, and the highlight needs both the list
    // (to answer "is it still on screen") and the quad (to draw it). Calling
    // it twice would also let the two answers disagree.
    const openingShapes = new Map(openingsOn(walls())
      .map(({ opening, geometry }) => [opening, geometry]));
    onScreen.fenestration = [...openingShapes.keys()];
    const lone = selectedWall();
    ctx.save();
    ctx.strokeStyle = selectInk();
    ctx.lineWidth = 7;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    selection.forEach(({ type, item }) => {
      // Only if it is still on screen's level: a selection kept across a level
      // change would paint a highlight over nothing.
      if (!(onScreen[type] || []).includes(item)) return;
      // A DIMENSION IS DRAWN SELECTED BY ITS OWN PAINTER (paintDimensions),
      // halo and all, so it reads as the same mark lit up.
      if (type === 'dimension') return;
      // A ROOF WHOSE NODES ARE PICKED STAYS DARK (Movie, 18 Oct: "i'd like to
      // select just the NODE so it lights up and the rest of the roof
      // doesn't"): the nodes are lit by paintRoofMoveNode.
      if (type === 'roof' && moveState?.node?.roof === item) return;
      // A PHOTO IS LIT ROUND ITS EDGE, as it glows in hand.
      if (type === 'underlay') {
        const r = underlayRect(item);
        if (!r) return;
        const a = toS({ x: r.left, y: 0, z: r.top }), b = toS({ x: r.right, y: 0, z: r.bottom });
        ctx.strokeRect(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.abs(b.x - a.x), Math.abs(b.y - a.y));
        return;
      }
      // A PICKED SHAPE OR FLOOR SHOWS ITS CORNER HANDLES (Movie, 25 Oct): a
      // hollow square on each corner to drag, a ring on each edge's midpoint
      // to grow a corner -- the room shape's, without the wall-node fill.
      if ((type === 'shape' || type === 'floor') && selection.length === 1 && roomShapeOf(item)) {
        const screen = item.points.map(toS);
        ctx.save();
        ctx.lineWidth = 2;
        ctx.beginPath();
        screen.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
        ctx.closePath();
        ctx.stroke();
        const h = ROOM_HANDLE_PX;
        screen.forEach(p => {
          ctx.fillStyle = skin['surface-page'];
          ctx.fillRect(p.x - h / 2, p.y - h / 2, h, h);
          ctx.strokeRect(p.x - h / 2, p.y - h / 2, h, h);
        });
        ctx.lineWidth = 1.5;
        screen.forEach((p, i) => {
          const q = screen[(i + 1) % screen.length];
          ctx.beginPath();
          ctx.arc((p.x + q.x) / 2, (p.y + q.y) / 2, h / 2 - 0.5, 0, Math.PI * 2);
          ctx.stroke();
        });
        ctx.restore();
        return;
      }
      if (type === 'roomtag' || type === 'note') {
        const b = type === 'note' ? noteBox(item) : roomTagBox(item);
        ctx.save();
        ctx.lineWidth = 3;
        ctx.strokeRect(b.left, b.top, b.right - b.left, b.bottom - b.top);
        const pts = type === 'roomtag' ? roomShapeOf(item) : null;
        if (pts) {
          // THE SHAPE, and its handles: a square on each corner (filled
          // where the corner is a wall's node, hollow where it is free) and
          // a small ring on each edge's midpoint, where a corner can be added.
          const screen = pts.map(toS);
          ctx.lineWidth = 2;
          ctx.beginPath();
          screen.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
          ctx.closePath();
          ctx.stroke();
          ctx.fillStyle = selectInk();
          const h = ROOM_HANDLE_PX;
          screen.forEach((p, i) => {
            if (wallsOnCorner(pts[i]).length) ctx.fillRect(p.x - h / 2, p.y - h / 2, h, h);
            else { ctx.fillStyle = skin['surface-page']; ctx.fillRect(p.x - h / 2, p.y - h / 2, h, h); ctx.fillStyle = selectInk(); ctx.strokeRect(p.x - h / 2, p.y - h / 2, h, h); }
          });
          ctx.lineWidth = 1.5;
          screen.forEach((p, i) => {
            const q = screen[(i + 1) % screen.length];
            ctx.beginPath();
            ctx.arc((p.x + q.x) / 2, (p.y + q.y) / 2, h / 2 - 0.5, 0, Math.PI * 2);
            ctx.stroke();
          });
        }
        ctx.restore();
        return;
      }
      if (type === 'hologram') {
        hologramWallsHere(item).forEach(w => {
          const a = toS(w.start), b = toS(w.end);
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        });
        return;
      }
      if (type === 'column') {
        const c = toS(item.point);
        ctx.save();
        ctx.lineWidth = 3;
        ctx.strokeRect(c.x - 9, c.y - 9, 18, 18);
        ctx.restore();
        return;
      }
      if (type === 'wall' || type === 'line' || type === 'beam') {
        const a = toS(item.start), b = toS(item.end);
        if (item.bulge) {
          // The halo follows the curve the line is drawn on.
          window.DraftRender2D.strokeSegPath2D(ctx, toS, item, { controlPoint: window.DraftGeometry2D.lineControlPoint });
        } else {
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
        if (item === lone) {
          // Square handles at each end -- the same 8px squares the old page
          // draws, and the grab targets the corner drag uses.
          ctx.fillStyle = selectHandle();
          [a, b].forEach(pt => ctx.fillRect(pt.x - 4, pt.y - 4, 8, 8));
        }
        return;
      }
      // AN OPENING HAS NO `points` OF ITS OWN -- it is a width and an offset
      // along a wall -- so its outline comes from the geometry resolved
      // above. Falling through to the branch below would read `item.points`,
      // find nothing, and silently paint no highlight at all: a selection the
      // drafter cannot see, about to be deleted.
      // A FIXTURE AND A STAIR ARE OUTLINED BY THE SAME SHAPES A CLICK TESTS,
      // so the highlight is exactly what was hit.
      const rings = type === 'fixture'
        ? (() => {
          const geo = window.DraftFixtureGeometry?.fixtureGeometry(drawing?.walls || [], item);
          if (!geo) return [];
          // ROUND THE HALF INCH, not the body (Movie, 24 Oct: "the BLUE line
          // should go to the outside of the 1/2" faint line when its
          // selected"): the gap is part of what was placed.
          const g = geo.faceOff != null && geo.frame ? (geo.wallGap || 0) : 0;
          if (g > 0) {
            const a0 = (geo.tub ? geo.tubAlongStart : geo.alongStart) - g;
            const a1 = (geo.tub ? geo.tubAlongEnd : geo.alongEnd) + g;
            const at = (a, c) => geo.frame.at(a, c);
            return [[at(a0, geo.faceOff), at(a1, geo.faceOff), at(a1, geo.frontOff), at(a0, geo.frontOff)],
              ...(geo.decks || [])];
          }
          return [geo.corners, ...(geo.decks || [])];
        })()
        : type === 'stair' ? stairRings(item, stairLevels()) : null;
      if (rings) {
        rings.filter(ring => ring?.length >= 3).forEach(ring => {
          ctx.beginPath();
          ring.forEach((pt, i) => {
            const p = toS(pt);
            if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
          });
          ctx.closePath();
          ctx.stroke();
        });
        // ITS HALF-INCH CORNERS, as the nodes they are (Movie, 24 Oct): a
        // small ring each, where a wall end can be put to connect.
        if (type === 'fixture') {
          const FG = window.DraftFixtureGeometry;
          (FG?.gapCorners ? FG.gapCorners(drawing?.walls || [], item, fixtures()) : []).forEach(c => {
            const p = toS(c);
            ctx.save();
            ctx.lineWidth = 1.5;
            ctx.beginPath(); ctx.arc(p.x, p.y, GAP_NODE_PX, 0, Math.PI * 2); ctx.stroke();
            ctx.restore();
          });
        }
        return;
      }
      if (type === 'fenestration') {
        const quad = openingShapes.get(item)?.corners || [];
        if (quad.length < 3) return;
        ctx.beginPath();
        quad.forEach((pt, i) => {
          const p = toS(pt);
          if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
        });
        ctx.closePath();
        ctx.stroke();
        return;
      }
      const pts = (item.points || []).filter(Boolean);
      if (pts.length < 2) return;
      ctx.beginPath();
      pts.forEach((pt, i) => {
        const p = toS(pt);
        if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
      });
      ctx.closePath();
      ctx.stroke();
      // THE PICKED EDGE, in the handle colour over the halo, so the panel's
      // EDGE 3 OF 12 is the line the drafter is looking at.
      if (type === 'roof' && selection.length === 1 && roofEdgeIdx != null && pts[roofEdgeIdx]) {
        const a = toS(pts[roofEdgeIdx]), b = toS(pts[(roofEdgeIdx + 1) % pts.length]);
        ctx.save();
        ctx.strokeStyle = selectHandle();
        ctx.lineWidth = 4;
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        ctx.restore();
      }
    });
    ctx.restore();
    // ── AND A PICKED OPENING SAYS HOW FAR IT IS FROM EACH CORNER ──────────
    //
    // Movie, 15 Oct: "with windows and doors when you click them can you show
    // their dimensions to the corners as well so the user can know how far
    // they should move it", and on the principle: "just showing the necessary
    // dims rather than all is a nice feature".
    //
    // SO IT IS THE SELECTION THAT ASKS, and nothing is added to the drawing.
    // These are read off the geometry every frame and vanish with the pick --
    // a drafter sliding a window wants the two numbers that change, not two
    // more dimension records to delete afterwards.
    //
    // MEASURED TO THE CENTRE, which is the convention this app already keeps:
    // auto-dims strings its closest row "corner-to-corner through the
    // fenestration centres", and a framer sets a window by its centre line.
    // The number here is therefore the same number that row prints, so
    // sliding to 4'-0" by eye here and reading 4'-0" there is one fact told
    // twice rather than two that can disagree.
    //
    // ONE OPENING ONLY. Two picked at once is four numbers over two walls,
    // which is the clutter the order was about.
  };

  // The two spans a picked opening stands between, drawn as a thin line with
  // the distance centred on it. Screen-only: no record, no undo, no save.
  const OPENING_DIM_OFF_PX = 13;
  const openingCornerDims = (ctx, toS) => {
    // WHAT WAS DRAWN, ON THE CANVAS, so a spec can read the two numbers
    // instead of scanning pixels for them -- the same way the BONEYARD
    // reports its side lengths. Cleared every frame: an attribute left
    // standing after the pick is dropped would say a readout is on screen
    // that is not.
    const shownDims = [];
    const report = () => canvas.setAttribute('data-opening-dims',
      JSON.stringify(shownDims));
    if (selection.length !== 1 || selection[0].type !== 'fenestration') { report(); return; }
    const opening = selection[0].item;
    const wall = walls().find(w => String(w.id) === String(opening.wallId));
    if (!wall || !wall.start || !wall.end) { report(); return; }
    const geometry = openingsOn(walls())
      .find(entry => entry.opening === opening)?.geometry;
    const centre = geometry && geometry.center;
    if (!centre) { report(); return; }
    const F = window.DraftFormatters;
    const dx = wall.end.x - wall.start.x, dz = wall.end.z - wall.start.z;
    const run = Math.hypot(dx, dz);
    if (!(run > 0)) { report(); return; }
    // THE OFFSET IS PERPENDICULAR IN SCREEN SPACE, not in feet, so the two
    // numbers stand the same distance off the wall at every zoom -- a gap in
    // feet closes up as the drafter zooms out and the text lands on the wall.
    const a = toS(wall.start), b = toS(wall.end), c = toS(centre);
    const sx = b.x - a.x, sy = b.y - a.y;
    const slen = Math.hypot(sx, sy) || 1;
    const nx = -sy / slen, ny = sx / slen;
    ctx.save();
    ctx.strokeStyle = selectInk();
    ctx.fillStyle = selectInk();
    ctx.lineWidth = 1;
    ctx.lineCap = 'butt';
    ctx.font = "600 11px 'DM Mono', ui-monospace, monospace";
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    // ALONG THE WALL, NOT THE DIAGONAL TO IT. The opening's centre is the
    // centre of the OPENING, which stands on the wall's physical centreline
    // -- half a thickness off the stored line when the reference is a face.
    // Measured corner-to-centre straight, both numbers come out a few
    // thousandths long and no longer add up to the wall: 5.0052 and 15.0018
    // on a 20 ft wall. Projected onto the run they are 5 and 15, which is
    // what a tape reads and what the dimension row beside them prints.
    const ux = dx / run, uz = dz / run;
    const along = (centre.x - wall.start.x) * ux + (centre.z - wall.start.z) * uz;
    [wall.start, wall.end].forEach((corner, i) => {
      const feet = Math.abs(i === 0 ? along : run - along);
      // AND THERE IS NO "IT IS ON THE CORNER" CASE TO GUARD. It looks as
      // though a door shoved hard against its jamb would read 0'-0" and want
      // suppressing -- clampOpeningToWall keeps `half + bearing` off each
      // end, measured against whatever stands there, so the centre cannot
      // reach a corner and the smallest this can be is half a door plus its
      // bearing. A guard here would be a line nothing can run.
      const p = toS(corner);
      const from = { x: p.x + nx * OPENING_DIM_OFF_PX, y: p.y + ny * OPENING_DIM_OFF_PX };
      const to = { x: c.x + nx * OPENING_DIM_OFF_PX, y: c.y + ny * OPENING_DIM_OFF_PX };
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);
      ctx.stroke();
      const text = F.formatArchitecturalInches(feet * 12);
      const mid = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
      // THE TEXT SITS IN A GAP IN ITS OWN LINE rather than on top of it:
      // measured, cleared, then drawn, so a number is never read through the
      // rule underneath it.
      const w = ctx.measureText(text).width + 6;
      ctx.save();
      ctx.globalCompositeOperation = 'destination-out';
      ctx.lineWidth = 13;
      ctx.beginPath();
      ctx.moveTo(mid.x - (sx / slen) * w / 2, mid.y - (sy / slen) * w / 2);
      ctx.lineTo(mid.x + (sx / slen) * w / 2, mid.y + (sy / slen) * w / 2);
      ctx.stroke();
      ctx.restore();
      ctx.fillText(text, mid.x, mid.y);
      shownDims.push({ corner: i === 0 ? 'start' : 'end', ft: Math.round(feet * 1e4) / 1e4 });
    });
    ctx.restore();
    report();
  };

