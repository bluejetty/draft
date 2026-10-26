// MODEL.html's page script, part 9 of 17: the draw gesture, ROTATE / FLIP, RESCALE, WALL OFF, the selection move, STRETCH, BREAK ROOF, TOY's grain.
//
// Stage 2 of the split (Movie, 24 Oct: "how can we reduce the MODEL.html
// size in a nice organized way"): the one script the page carried, cut
// at its own section headings and moved here verbatim, in order. The
// parts load one after another as classic scripts and share one scope,
// as they did inside the page; the indent is the page's, kept so every
// line reads as it did there.

  // ── the draw gesture ──────────────────────────────────────────────────────
  // TWO PRESSES, one wall. The first sets a start and the second commits, so
  // the gesture works with a finger, a pen or a mouse without a drag — the old
  // page's wall tool is press-press too (its chain committer is the same shape
  // repeated).
  //
  // ARMED IS A MODE, and it is visible: the WALL key in the tool column
  // carries the accent while the next tap will draw. A mode nobody can see is
  // how a drafter loses a pan and gets a wall.
  //
  // DRAW WALL, THE BUTTON, IS GONE (§7). It was the chrome bar's own arming
  // control and the tool column's WALL key was the second one; two buttons
  // for one register is the drift this pass exists to end, and the key is the
  // survivor because the other sixteen tools are already only there.
  const deleteButton = document.getElementById('delete');
  const undoButton = document.getElementById('model-undo');
  // THE STOREY ARROWS, which this page unhides because this page has levels.
  // shell-bars.js ships them hidden, and NAMELESS: four pages step the trio
  // now and they step four different lists -- sheets on Construction Layout,
  // house types on PROJECT, sections on SPECS -- so the words belong to
  // whichever page mounted them. These are MODEL's.
  const levelUpButton = document.getElementById('trio-up');
  const levelDownButton = document.getElementById('trio-down');
  if (levelUpButton) levelUpButton.title = 'Go up to the next level';
  if (levelDownButton) levelDownButton.title = 'Go down to the next level';
  const copyButton = document.getElementById('copy');
  const pasteButton = document.getElementById('paste');

  // WHAT IS HELD. Not the selection, and not a reference to it: raw snapshots
  // taken at COPY, so an edit or a delete between the copy and the paste
  // cannot reach back into what the drafter took.
  let held = [];

  // WHAT COUNTS AS A MODAL. Each of these covers the whole viewport at
  // z-index 7 and asks a question that has to be answered first; the foot
  // strip sits at 6, under all of them. The drive-thru sign is not built and
  // will be the fifth entry in this list rather than a new mechanism.
  const MODAL_IDS = ['promote', 'bone-choice', 'build-choice', 'file-guard', 'save-as', 'garage-lesson', 'corner-join', 'garage-align',
    'trace-ask', 'trace-insert', 'footprint-ask', 'stair-fit'];
  const modalUp = () => MODAL_IDS.some(id => {
    const node = document.getElementById(id);
    return !!node && !node.hidden;
  });

  // ── ROTATE ──────────────────────────────────────────────────────────────
  //
  // Movie, 18 Oct: "i just realized i also need a ROTATE command (for items
  // that are selected like the stiarcase which i'd like to rotate 90)" -- and
  // for a placed WC or kitchen, and the PHOTO: "in the photo popup area can
  // we also add 'ROTATE'". Down in the foot with DELETE and COPY, and while
  // it is up its own small row stands OVER them ("i like how those little
  // commands cover the other ones when they are active").
  //
  // WHAT TURNS: every point the selection owns, ONCE, about the middle of
  // them all -- a wall's two ends, a floor's or a roof's ring (and the wall
  // line the roof hangs from), a stair's start and end, a tag or a note.
  // Doors, windows and fixtures ride their walls by an offset, so they turn
  // with them and are never touched here.
  //
  // A CORNER SHARED WITH SOMETHING LEFT BEHIND IS LET GO first: a WC joined
  // to the house wall would otherwise drag the house wall round with it. The
  // WC's wall gets its own copy of that corner, and UNDO hands the shared one
  // back along with every number.
  //
  // CLOCKWISE ON THE SCREEN: x runs right and z runs down the sheet, so a
  // positive angle in the (x, z) turn below is clockwise as the drafter sees
  // it. A PHOTO has no free angle -- it is drawn a quarter turn at a time --
  // so its turn is rounded to quarters.
  var rotateState = { open: false };
  const rotateButton = document.getElementById('model-rotate');
  const rotateBar = document.getElementById('rotate-bar');
  const rotatePointsOf = ({ type, item }) => {
    if (!item) return [];
    // A FREE FIXTURE TURNS ON ITS OWN LINE (Movie, 25 Oct: "i tried to rotate
    // it ... didn't work"): standing on no wall, it has nothing to turn with.
    if (type === 'fixture' && item.wallId == null && item.host?.start && item.host?.end) return [item.host.start, item.host.end];
    if (type === 'fixture' || type === 'fenestration') return [];
    if (type === 'roomtag') return [item.at, ...(roomShapeOf(item) || [])].filter(Boolean);
    if (type === 'note') return [item.anchor, item.text].filter(Boolean);
    if (type === 'column' || type === 'superNode') return item.point ? [item.point] : [];
    if (Array.isArray(item.points)) {
      return [...item.points, ...(type === 'roof' && Array.isArray(item.footprint) ? item.footprint : [])];
    }
    return [item.start, item.end].filter(Boolean);
  };
  // Asked from paint(), which can run before the trace code below has set
  // `traceMoving` up -- so a picture is in hand only once that exists.
  const photoInHand = () => {
    try { return traceMoving?.underlay && !traceMoving.hologram ? traceMoving.underlay : null; } catch { return null; }
  };
  // THE PHOTO PICKED ON THE SHEET (Movie, 23 Oct), when it is the whole of
  // the selection: ROTATE turns it, MOVE takes it in hand, RESCALE sizes it.
  const selectedPhoto = () => (selection.length === 1 && selection[0].type === 'underlay' ? selection[0].item : null);
  const turnPhoto = (underlay, quarters) => {
    const q = ((Math.round(quarters) % 4) + 4) % 4;
    if (!q) return false;
    const before = { ...underlay };
    underlay.turn = (((Number(underlay.turn) || 0) + q) % 4 + 4) % 4;
    if (!underlay.turn) delete underlay.turn;
    if (q % 2) { const w = underlay.widthFt; underlay.widthFt = underlay.heightFt; underlay.heightFt = w; }
    undoStack.push({ kind: 'props', edits: [{ item: underlay, before }] });
    markDirty();
    paint();
    return true;
  };
  // ── THE SET A TURN OR A FLIP WORKS ON ──────────────────────────────────
  //
  // A FIXED ASSEMBLY TURNS WHOLE (Movie: "the full WC to move and rotate
  // ... as one unit"): one wall of a WC picked is the WC picked, the same
  // as a drag of it takes the lot. CORNERS SHARED WITH WALLS THAT STAY ARE
  // LET GO: the WC's wall gets its own copy of that corner, and UNDO hands
  // the shared one back. Then every point the set owns, once.
  const turnSet = () => {
    const entries = selection.slice();
    selection.forEach(entry => {
      const owner = groupOf(entry);
      if (!owner || owner.fixed !== true) return;
      itemsOfGroup(owner).forEach(w => { if (!entries.some(e => e.item === w.item)) entries.push(w); });
    });
    const chosen = new Set(entries.map(entry => entry.item));
    const keep = (drawing.walls || []).filter(wall => !chosen.has(wall));
    const held = new Set(keep.flatMap(wall => [wall.start, wall.end]));
    const detached = [];
    const linked = [];
    entries.forEach(({ type, item }) => {
      if (type === 'roomtag' && roomShapeOf(item)) {
        // A ROOM SHAPE'S LINKED CORNERS LIKEWISE: the shape turns on its
        // own copies, and the wall's node stays where the wall is.
        // A CORNER WHOSE WALL TURNS WITH IT KEEPS ITS LINK (Movie, 25 Oct:
        // "the bathroom floor acting weird"): a whole WC turned or flipped
        // lost every tie between its floor and its walls, so the floor stood
        // still the next time a wall of it was moved. Kept, its offset off
        // the wall's end is turned with it (`linked`, for the caller).
        item.points.forEach((pt, index) => {
          if (!held.has(pt) && !pt.link) return;
          if (pt.link && !held.has(pt) && chosen.has(linkWall(pt))) { linked.push(pt); return; }
          detached.push({ wall: item.points, key: index, orig: pt });
          item.points[index] = { x: pt.x, z: pt.z };
        });
        return;
      }
      if (type !== 'wall') return;
      ['start', 'end'].forEach(key => {
        if (!held.has(item[key])) return;
        detached.push({ wall: item, key, orig: item[key] });
        item[key] = { ...item[key] };
      });
    });
    const points = [...new Set(entries.flatMap(rotatePointsOf))]
      .filter(pt => Number.isFinite(pt?.x) && Number.isFinite(pt?.z));
    return { entries, detached, points, linked };
  };
  // A STAIR'S FRAMING RIDES THE TURN, the points of it the set does not
  // already own.
  const turnFraming = (entries, points) => entries.filter(entry => entry.type === 'stair').flatMap(({ item }) => {
    const f = stairFramingOf(item);
    return [...f.beams.flatMap(b => [b.start, b.end]), ...f.columns.map(c => c.point)];
  }).filter(pt => !points.includes(pt));
  // A STAIR'S WELL IS CUT AGAIN WHERE IT NOW STANDS (Movie, 18 Oct: "when
  // i rotated the main floor stairs the foundation outline didn't show
  // rotated" -- "floor layout too"). Re-cut, not turned with it: a well
  // already left behind by an earlier turn comes back around its flight.
  // A NEW ring is written so the undo keeps the old one. A shared well (two
  // flights through one hole) stays, as a drag leaves it.
  const recutWells = entries => {
    const wells = [];
    entries.filter(entry => entry.type === 'stair').forEach(({ item }) => {
      const hole = stairWellOf(item).hole;
      const ring = hole && stairOpeningFootprint(item);
      if (!ring || ring.length < 3) return;
      wells.push({ hole, points: hole.points });
      hole.points = ring.map(pt => ({ x: pt.x, z: pt.z }));
    });
    return wells;
  };
  const rotateSelection = degrees => {
    const photo = photoInHand() || selectedPhoto();
    if (photo) {
      if (turnPhoto(photo, degrees / 90)) sayOnStrip(`${photo.name || 'The picture'} turned. UNDO turns it back.`);
      return;
    }
    if (!selection.length || !Number.isFinite(degrees) || Math.abs(degrees % 360) < 1e-9) return;
    const { entries, detached, points, linked } = turnSet();
    const holos = entries.filter(e => e.type === 'hologram').map(e => e.item);
    if (!points.length && !holos.length) {
      detached.forEach(d => { d.wall[d.key] = d.orig; });
      sayOnStrip('Nothing in the selection can be turned on its own -- doors, windows and fixtures turn with their walls.');
      return;
    }
    // ABOUT ITS MIDDLE: a free fixture's body counts, not only the line it
    // stands on, so a lone one turns in place.
    const freeOnes = entries.filter(e => e.type === 'fixture' && e.item.wallId == null && e.item.host).map(e => e.item);
    const freeLines = new Set(freeOnes.flatMap(f => [f.host.start, f.host.end]));
    const freeBodies = freeOnes.flatMap(f => window.DraftFixtureGeometry?.fixtureGeometry(drawing.walls || [], f)?.corners || []);
    const spread = [...points.filter(pt => !freeLines.has(pt)), ...holos.flatMap(hologramCorners), ...freeBodies];
    const xs = spread.map(pt => pt.x), zs = spread.map(pt => pt.z);
    const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cz = (Math.min(...zs) + Math.max(...zs)) / 2;
    const a = degrees * Math.PI / 180, cos = Math.cos(a), sin = Math.sin(a);
    const before = points.map(vtx => ({ vtx, x: vtx.x, z: vtx.z,
      ...(vtx.offX !== undefined ? { offX: vtx.offX, offZ: vtx.offZ } : {}) }));
    const turnPoint = pt => {
      const dx = pt.x - cx, dz = pt.z - cz;
      pt.x = cx + dx * cos - dz * sin;
      pt.z = cz + dx * sin + dz * cos;
    };
    points.forEach(turnPoint);
    // A KEPT LINK'S OFFSET TURNS BY AS MUCH, its old one kept for the UNDO.
    linked.forEach(pt => {
      const was = before.find(b => b.vtx === pt);
      if (was) was.link = { ...pt.link };
      const { dx, dz } = pt.link;
      pt.link = { ...pt.link, dx: dx * cos - dz * sin, dz: dx * sin + dz * cos };
    });
    // ITS FRAMING TURNS WITH IT, about the same middle -- and is then laid
    // again below where there is a house to measure it against.
    const framing = turnFraming(entries, points);
    framing.forEach(vtx => before.push({ vtx, x: vtx.x, z: vtx.z }));
    framing.forEach(turnPoint);
    const wells = recutWells(entries);
    points.forEach(relinkVertex);
    // AND ITS FRAMING IS LAID AGAIN (reframeStair), not left as it turned: a
    // run turned to lie with the joists needs no side beam, and one turned
    // end for end has its open side where the wall was. One UNDO takes the
    // turn and the new framing back together.
    const turn = { kind: 'rotate', before, detached, wells };
    // A HOLOGRAM TURNS ABOUT THE SAME MIDDLE: its placed pivot goes round,
    // and it turns on it by as much.
    const holoEdits = holos.map(holo => {
      const was = { ...holo };
      const p = hologramPivotPlaced(holo);
      turnPoint(p);
      holo.x = p.x - (Number(holo.pivotX) || 0);
      holo.z = p.z - (Number(holo.pivotZ) || 0);
      holo.angleDeg = ((((Number(holo.angleDeg) || 0) + degrees) % 360) + 360) % 360;
      return { item: holo, before: was };
    });
    const reframed = entries.filter(entry => entry.type === 'stair').map(({ item }) => reframeStair(item));
    const steps = [...(holoEdits.length ? [{ kind: 'props', edits: holoEdits }] : []), ...reframed.flatMap(r => r.steps)];
    undoStack.push(steps.length ? { kind: 'batch', steps: [turn, ...steps] } : turn);
    markDirty();
    paint();
    const shown = Math.round(((degrees % 360) + 360) % 360 * 100) / 100;
    sayOnStrip(`Turned ${shown}° clockwise about its middle.${stairFramingSaid(reframed)} UNDO turns it back.`);
  };

  // ── FLIP (Movie, 20 Oct) ─────────────────────────────────────────────
  //
  // "i need another option down there for FLIP beside rotate and move". A
  // mirror of what is selected about its own middle -- left for right
  // (across x) or top for bottom (across z) -- with ROTATE's own rules: a
  // FIXED assembly flips whole, a corner shared with a wall that stays is
  // let go first, a stair's well is cut again and its framing laid again,
  // and one UNDO takes it all back.
  //
  // A MIRROR REVERSES THE HAND. A wall's direction still runs start to end,
  // and the end is where its mirror image is -- but the side that was its
  // left is now its right (the hologram's own MIRROR, placed(), has the same
  // three swaps). So a wall drawn by its left or right line swaps lines, a
  // fixture crosses to the other face, a door swings the other way, and a
  // stair that turned left turns right. A door's hinge is measured from the
  // wall's start, which mirrored with it, so it keeps its jamb.
  var flipState = { open: false };
  const flipButton = document.getElementById('model-flip');
  const flipBar = document.getElementById('flip-bar');
  const flipSelection = axis => {
    if (!selection.length || (axis !== 'x' && axis !== 'z')) return;
    const { entries, detached, points, linked } = turnSet();
    const holos = entries.filter(e => e.type === 'hologram').map(e => e.item);
    if (!points.length && !holos.length) {
      detached.forEach(d => { d.wall[d.key] = d.orig; });
      sayOnStrip('Nothing in the selection can be flipped on its own -- doors, windows and fixtures flip with their walls.');
      return;
    }
    // A FREE FIXTURE MIRRORS ABOUT ITS BODY, as it turns about it.
    const freeOnes = entries.filter(e => e.type === 'fixture' && e.item.wallId == null && e.item.host).map(e => e.item);
    const freeLines = new Set(freeOnes.flatMap(f => [f.host.start, f.host.end]));
    const freeBodies = freeOnes.flatMap(f => window.DraftFixtureGeometry?.fixtureGeometry(drawing.walls || [], f)?.corners || []);
    const vals = [...points.filter(pt => !freeLines.has(pt)), ...holos.flatMap(hologramCorners), ...freeBodies].map(pt => pt[axis]);
    const mid = (Math.min(...vals) + Math.max(...vals)) / 2;
    const before = points.map(vtx => ({ vtx, x: vtx.x, z: vtx.z,
      ...(vtx.offX !== undefined ? { offX: vtx.offX, offZ: vtx.offZ } : {}) }));
    const mirror = pt => { pt[axis] = 2 * mid - pt[axis]; };
    points.forEach(mirror);
    // A KEPT LINK'S OFFSET MIRRORS TOO.
    linked.forEach(pt => {
      const was = before.find(b => b.vtx === pt);
      if (was) was.link = { ...pt.link };
      pt.link = { ...pt.link, [axis === 'x' ? 'dx' : 'dz']: -pt.link[axis === 'x' ? 'dx' : 'dz'] };
    });
    const framing = turnFraming(entries, points);
    framing.forEach(vtx => before.push({ vtx, x: vtx.x, z: vtx.z }));
    framing.forEach(mirror);
    const wells = recutWells(entries);
    points.forEach(relinkVertex);
    // THE SIDES SWAP.
    const edits = [];
    const flippedWalls = entries.filter(e => e.type === 'wall').map(e => e.item);
    const wallIds = new Set(flippedWalls.map(w => String(w.id)));
    flippedWalls.forEach(w => {
      if (w.refLine !== 'left' && w.refLine !== 'right') return;
      edits.push({ item: w, before: { ...w } });
      w.refLine = w.refLine === 'left' ? 'right' : 'left';
    });
    (drawing.fixtures || []).filter(f => wallIds.has(String(f.wallId)) || freeOnes.includes(f)).forEach(f => {
      edits.push({ item: f, before: { ...f } });
      f.side = f.side === -1 ? 1 : -1;
    });
    (drawing.fenestrations || []).filter(o => wallIds.has(String(o.wallId)) && o.type === 'door').forEach(o => {
      edits.push({ item: o, before: { ...o } });
      o.swingFlip = o.swingFlip !== true;
    });
    entries.filter(e => e.type === 'stair').forEach(({ item }) => {
      if (item.turn !== 'left' && item.turn !== 'right') return;
      edits.push({ item, before: { ...item } });
      item.turn = item.turn === 'left' ? 'right' : 'left';
    });
    // A HOLOGRAM IS TURNED OVER: its placed pivot mirrors across the middle,
    // it is mirrored, and its turn runs the other way -- left for right is
    // -angle, top for bottom is 180 - angle (a mirror across z is one across
    // x and a half turn).
    holos.forEach(holo => {
      edits.push({ item: holo, before: { ...holo } });
      const p = hologramPivotPlaced(holo);
      mirror(p);
      holo.x = p.x - (Number(holo.pivotX) || 0);
      holo.z = p.z - (Number(holo.pivotZ) || 0);
      if (holo.flip === true) delete holo.flip; else holo.flip = true;
      const a = Number(holo.angleDeg) || 0;
      holo.angleDeg = ((((axis === 'x' ? -a : 180 - a) % 360) + 360) % 360);
    });
    // THE SAME UNDO RECORD AS A TURN: the points back, the corners joined.
    const flipped = { kind: 'rotate', before, detached, wells };
    const reframed = entries.filter(e => e.type === 'stair').map(({ item }) => reframeStair(item));
    const steps = [flipped, ...(edits.length ? [{ kind: 'props', edits }] : []), ...reframed.flatMap(r => r.steps)];
    undoStack.push(steps.length > 1 ? { kind: 'batch', steps } : flipped);
    markDirty();
    paint();
    sayOnStrip(`Flipped ${axis === 'x' ? 'left for right' : 'top for bottom'} about its middle.${stairFramingSaid(reframed)} UNDO flips it back.`);
  };
  const setFlipOpen = open => { flipState.open = !!open; paint(); };
  function syncFlipVerbs() {
    if (!flipState || !flipButton || !flipBar) return;
    const able = selection.length && !activeCut() && !modalUp();
    if (!able) flipState.open = false;
    flipButton.hidden = !able || flipState.open || !!rotateState?.open;
    flipBar.hidden = !flipState.open;
    // OVER THE OTHER VERBS while it is up, as ROTATE's row is.
    if (flipState.open) {
      [deleteButton, undoButton, copyButton, pasteButton].forEach(b => { if (b) b.hidden = true; }); // FLIP's row
    }
  }
  // ── RESCALE (Movie, 23 Oct) ─────────────────────────────────────────────
  //
  // "can we allow the user to click on the bg photo and 'resize' it with a
  // resize button in bottom left menu area" -- "RESCALE might be a better
  // term to use" -- "allow them to change it with proportions locked and
  // also without proportions locked".
  //
  // With a photo picked and RESCALE up, eight handles stand on its edge.
  // A CORNER keeps the proportions: it scales about the opposite corner,
  // which stays put. A SIDE stretches that one way only, the opposite side
  // staying put. Never under half a foot. One UNDO per drag.
  var rescaleState = { open: false, drag: null };
  const rescaleButton = document.getElementById('model-rescale');
  const rescaleBar = document.getElementById('rescale-bar');
  const RESCALE_HANDLE_PX = 7, RESCALE_GRAB_PX = 12, RESCALE_MIN_FT = 0.5;
  // The eight, in feet: corners first, then the sides' middles.
  const rescaleHandles = u => {
    const r = underlayRect(u);
    if (!r) return [];
    const cx = (r.left + r.right) / 2, cz = (r.top + r.bottom) / 2;
    return [
      { id: 'nw', x: r.left, z: r.top, corner: true }, { id: 'ne', x: r.right, z: r.top, corner: true },
      { id: 'se', x: r.right, z: r.bottom, corner: true }, { id: 'sw', x: r.left, z: r.bottom, corner: true },
      { id: 'n', x: cx, z: r.top }, { id: 'e', x: r.right, z: cz }, { id: 's', x: cx, z: r.bottom }, { id: 'w', x: r.left, z: cz },
    ];
  };
  const setRescaleOpen = open => {
    rescaleState.open = !!open && !!selectedPhoto();
    if (!rescaleState.open) rescaleState.drag = null;
    stripRefresh();
    paint();
  };
  function syncRescaleVerbs() {
    if (!rescaleState || !rescaleButton || !rescaleBar) return;
    const able = !!selectedPhoto() && !activeCut() && !modalUp();
    if (!able) { rescaleState.open = false; rescaleState.drag = null; }
    rescaleButton.hidden = !able || rescaleState.open || !!rotateState?.open || !!flipState?.open;
    rescaleBar.hidden = !rescaleState.open;
    if (rescaleState.open) {
      [deleteButton, undoButton, copyButton, pasteButton, rotateButton, flipButton, moveButton].forEach(b => { if (b) b.hidden = true; });
    }
  }
  if (rescaleButton) rescaleButton.addEventListener('click', () => setRescaleOpen(true));
  rescaleBar?.querySelector('[data-rescale-done]')?.addEventListener('click', () => setRescaleOpen(false));
  // THE HANDLES, painted over the picture while RESCALE is up.
  const paintRescaleHandles = () => {
    const photo = rescaleState.open ? selectedPhoto() : null;
    if (!photo) return;
    ctx.save();
    ctx.fillStyle = selectHandle();
    ctx.strokeStyle = skin['surface-page'] || '#000';
    ctx.lineWidth = 1.5;
    rescaleHandles(photo).forEach(hd => {
      const p = toS({ x: hd.x, y: 0, z: hd.z });
      const half = hd.corner ? RESCALE_HANDLE_PX / 2 + 1 : RESCALE_HANDLE_PX / 2;
      ctx.beginPath();
      ctx.rect(p.x - half, p.y - half, half * 2, half * 2);
      ctx.fill();
      ctx.stroke();
    });
    ctx.restore();
  };
  // THE DRAG. On the window in the capture phase, ahead of the sheet's own
  // press, and only while RESCALE is up and the press lands on a handle.
  const rescaleHandleAt = (photo, sx, sy) => rescaleHandles(photo).find(hd => {
    const p = toS({ x: hd.x, y: 0, z: hd.z });
    return Math.hypot(p.x - sx, p.y - sy) <= RESCALE_GRAB_PX;
  }) || null;
  const rescaleTo = (drag, at) => {
    const { before: b0, handle } = drag;
    const r0 = { left: b0.x - b0.widthFt / 2, right: b0.x + b0.widthFt / 2, top: b0.z - b0.heightFt / 2, bottom: b0.z + b0.heightFt / 2 };
    const u = drag.underlay;
    if (handle.corner) {
      // ABOUT THE OPPOSITE CORNER, by one factor: how far along the diagonal
      // from that corner the hand has gone.
      const ax = handle.id.includes('w') ? r0.right : r0.left, az = handle.id.includes('n') ? r0.bottom : r0.top;
      const dx = handle.x - ax, dz = handle.z - az;
      const len2 = dx * dx + dz * dz;
      if (len2 < 1e-9) return;
      const minF = RESCALE_MIN_FT / Math.max(Math.min(b0.widthFt, b0.heightFt), 1e-6);
      const f = Math.max(minF, ((at.x - ax) * dx + (at.z - az) * dz) / len2);
      u.widthFt = b0.widthFt * f;
      u.heightFt = b0.heightFt * f;
      u.x = ax + (dx * f) / 2;
      u.z = az + (dz * f) / 2;
      return;
    }
    // A SIDE: that edge to the hand, the opposite edge where it was.
    if (handle.id === 'e') { const w = Math.max(RESCALE_MIN_FT, at.x - r0.left); u.widthFt = w; u.x = r0.left + w / 2; }
    if (handle.id === 'w') { const w = Math.max(RESCALE_MIN_FT, r0.right - at.x); u.widthFt = w; u.x = r0.right - w / 2; }
    if (handle.id === 's') { const h = Math.max(RESCALE_MIN_FT, at.z - r0.top); u.heightFt = h; u.z = r0.top + h / 2; }
    if (handle.id === 'n') { const h = Math.max(RESCALE_MIN_FT, r0.bottom - at.z); u.heightFt = h; u.z = r0.bottom - h / 2; }
  };
  window.addEventListener('pointerdown', event => {
    if (!rescaleState.open || event.target !== canvas || event.button !== 0) return;
    const photo = selectedPhoto();
    if (!photo) return;
    const rect = canvas.getBoundingClientRect();
    const handle = rescaleHandleAt(photo, event.clientX - rect.left, event.clientY - rect.top);
    if (!handle) return;
    event.stopImmediatePropagation();
    event.preventDefault();
    rescaleState.drag = { underlay: photo, handle, before: { ...photo } };
  }, true);
  window.addEventListener('pointermove', event => {
    const drag = rescaleState.drag;
    if (!drag) return;
    event.stopImmediatePropagation();
    const rect = canvas.getBoundingClientRect();
    rescaleTo(drag, toWorld(event.clientX - rect.left, event.clientY - rect.top));
    paint();
  }, true);
  window.addEventListener('pointerup', event => {
    const drag = rescaleState.drag;
    if (!drag) return;
    event.stopImmediatePropagation();
    rescaleState.drag = null;
    const u = drag.underlay, b = drag.before;
    if (u.widthFt !== b.widthFt || u.heightFt !== b.heightFt || u.x !== b.x || u.z !== b.z) {
      undoStack.push({ kind: 'props', edits: [{ item: u, before: b }] });
      markDirty();
      const F = window.DraftFormatters;
      const label = ft => (F?.formatArchitecturalInches ? F.formatArchitecturalInches(ft * 12) : `${ft.toFixed(2)} ft`);
      sayOnStrip(`${u.name || 'The image'} is ${label(u.widthFt)} by ${label(u.heightFt)}. UNDO puts it back; DONE puts RESCALE down.`);
    }
    paint();
  }, true);
  window.addEventListener('keydown', event => {
    if (rescaleState.open && event.key === 'Escape') { event.stopImmediatePropagation(); setRescaleOpen(false); }
  }, true);
  if (flipButton) flipButton.addEventListener('click', () => setFlipOpen(true));
  if (flipBar) {
    flipBar.querySelectorAll('[data-flip-axis]').forEach(btn => btn.addEventListener('click', () =>
      flipSelection(btn.dataset.flipAxis)));
    flipBar.querySelector('[data-flip-done]')?.addEventListener('click', () => setFlipOpen(false));
  }
  const setRotateOpen = open => {
    rotateState.open = !!open;
    if (rotateBar) {
      const box = rotateBar.querySelector('[data-rotate-angle]');
      if (box && open) box.value = '';
    }
    paint();
  };
  function syncRotateVerbs() {
    if (!rotateState || !rotateButton || !rotateBar) return;
    const able = (selection.length || photoInHand()) && !activeCut() && !modalUp();
    if (!able) rotateState.open = false;
    rotateButton.hidden = !able || rotateState.open || !!flipState?.open;
    rotateBar.hidden = !rotateState.open;
    // OVER THE OTHER VERBS while it is up.
    if (rotateState.open) {
      [deleteButton, undoButton, copyButton, pasteButton].forEach(b => { if (b) b.hidden = true; });
    }
  }
  if (rotateButton) rotateButton.addEventListener('click', () => setRotateOpen(true));
  if (rotateBar) {
    rotateBar.querySelectorAll('[data-rotate-by]').forEach(btn => btn.addEventListener('click', () =>
      rotateSelection(Number(btn.dataset.rotateBy))));
    rotateBar.querySelector('[data-rotate-done]')?.addEventListener('click', () => setRotateOpen(false));
    const box = rotateBar.querySelector('[data-rotate-angle]');
    box?.addEventListener('keydown', event => {
      event.stopPropagation();
      if (event.key === 'Escape') { setRotateOpen(false); return; }
      if (event.key !== 'Enter') return;
      event.preventDefault();
      const deg = Number(String(box.value).replace(/[^\d.+-]/g, ''));
      if (!Number.isFinite(deg) || box.value.trim() === '') { sayOnStrip('Type the turn in degrees, clockwise -- 90, 45, -30.'); return; }
      rotateSelection(deg);
      box.value = '';
    });
  }

  // ── BREAK ───────────────────────────────────────────────────────────────
  //
  // Movie, 18 Oct, option 2 for North Point's roof: "'BREAK' the roof and
  // deleted the 2 hip peices and move the GABLE part all the wal over to
  // cover the existing roof" -- and "can you place the BREAK command down
  // near where UNDO COPY DELETE commands show up ... when the roof or other
  // ASSEMBLIES are selected".
  //
  // A ROOF: BREAK, then a click on one of its edges and a click on another,
  // and it is two roofs cut along the line between. The cut is a GABLE on
  // both sides, flush (0 overhang), so the ridge runs straight to it and no
  // hip appears there; delete the piece not wanted and push the other's cut
  // edge out with OVERHANG, THIS EDGE.
  //
  // AN ASSEMBLY: BREAK breaks it into its pieces -- UNGROUP, said the way he
  // says it ("BREAK the kitchen into pieces").
  const breakButton = document.getElementById('model-break');
  // BREAK ADDS A NODE (Movie, 18 Oct: "the BREAK can be used for making break
  // in line wall, edge o f shape roof floor etc" -- "adding a new node" -- and
  // on a roof, "just ad a node to the edge of the roof, this way a user can
  // ask to 'gable between 2 nodes"). One item held, BREAK pressed: every click
  // on it puts a node there, until ENTER, Esc or BREAK again. A wall or a line
  // becomes two joined at the node; a roof, shape or floor gains a corner on
  // that edge, and the two halves are edges of their own.
  var breakState = { held: null, pieces: [] };
  const BREAKABLE = ['roof', 'wall', 'line', 'shape', 'floor'];
  // A PIECE OF AN ASSEMBLY IS THE ASSEMBLY: BUST it first.
  const breakHeld = () => (selection.length === 1 && BREAKABLE.includes(selection[0].type)
    && !selectedGroups().length ? selection[0] : null);
  function syncBreakVerb() {
    if (!breakState || !breakButton) return;
    const one = breakHeld();
    const able = !activeCut() && !modalUp() && (!!one || selectedGroups().length > 0);
    if (!able || (breakState.held && one?.item !== breakState.held.item)) breakState.held = null;
    breakButton.hidden = !able || !!rotateState?.open || !!flipState?.open;
    breakButton.setAttribute('aria-pressed', String(!!breakState.held));
    // AN ITEM IS BROKEN, AN ASSEMBLY IS BUST (Movie, 18 Oct: "ASSEMBLY BREAK
    // is different from ROOF EDGE BREAK" -- "lets go ASSEMBLY GROUP /
    // ASSEMBLY BUST"). One button, the word for what it will do.
    // TWO ROOF NODES PICKED, IT IS BREAK ROOF (Movie, 18 Oct: "a 3rd command
    // 'BREAK ROOF at NODE' where the user could split the roof and make
    // different properties or move one of them").
    const splits = moveState?.node?.list?.length === 2;
    breakButton.textContent = splits ? 'BREAK ROOF' : one ? 'BREAK' : 'BUST';
    breakButton.title = splits ? 'BREAK ROOF — split the roof in two between the two picked nodes'
      : one ? 'BREAK — click the item to add a node there'
        : 'ASSEMBLY BUST — break the assembly into its pieces';
  }
  // ── WALL OFF (Movie, 18 Oct) ──────────────────────────────────────────
  //
  // "on the WC and the KITCHENS. when a user clicks on a wall and is offered
  // the BREAK or MOVE it, can you also offer to TURN OFF that wall (on one or
  // two sides would be easier to use the HOUSE wall rather than the 'WC wall"
  // -- "the ones behind the shower and sink too, but each plan will be
  // different".
  //
  // THE HOUSE WALL IT BACKS ON TO SERVES INSTEAD. A fixture hangs on its wall
  // by an offset along it, so taking the WC's wall away bare would take the
  // toilet with it: each fixture, door and window on it moves onto the house
  // wall at the same place, against the house wall's face; the WC's walls
  // that met it run on to that face; then the WC wall goes. One UNDO.
  var wallPicked = null;
  var wallOffButton = document.getElementById('model-wall-off');
  const WALL_OFF_GAP_FT = 1;
  // The house wall a wall stands against: parallel, on its floor, the two
  // facing faces within a foot, running along most of it. Nearest wins.
  const wallOffHost = wall => {
    const G = window.DraftGeometry2D;
    const thick = openingThicknessFt();
    const frame = w => {
      const dx = w.end.x - w.start.x, dz = w.end.z - w.start.z, len = Math.hypot(dx, dz);
      if (!(len > 1e-6)) return null;
      const u = { x: dx / len, z: dz / len }, n = { x: -u.z, z: u.x };
      const { startOff, endOff } = G.wallFaceOffsets(w, thick(w));
      return { w, u, n, len, s: w.start, faces: [startOff, endOff] };
    };
    const me = frame(wall);
    if (!me) return null;
    let best = null;
    (drawing.walls || []).forEach(other => {
      if (other === wall || other.levelId !== wall.levelId || (other.view || 'plan') !== (wall.view || 'plan')) return;
      const f = frame(other);
      if (!f || Math.abs(me.u.x * f.u.z - me.u.z * f.u.x) > 1e-3) return;
      const across = (me.s.x - f.s.x) * f.n.x + (me.s.z - f.s.z) * f.n.z;
      const turn = me.n.x * f.n.x + me.n.z * f.n.z;
      const mine = me.faces.map(o => across + o * turn);
      const side = (Math.min(...mine) + Math.max(...mine)) / 2 >= (f.faces[0] + f.faces[1]) / 2 ? 1 : -1;
      const hostFace = side > 0 ? Math.max(...f.faces) : Math.min(...f.faces);
      const myFace = side > 0 ? Math.min(...mine) : Math.max(...mine);
      const gap = side * (myFace - hostFace);
      if (gap < -1e-3 || gap > WALL_OFF_GAP_FT) return;
      const a = (me.s.x - f.s.x) * f.u.x + (me.s.z - f.s.z) * f.u.z;
      const b = a + me.len * (me.u.x * f.u.x + me.u.z * f.u.z);
      const overlap = Math.min(Math.max(a, b), f.len) - Math.max(Math.min(a, b), 0);
      if (overlap < me.len * 0.5) return;
      if (!best || gap < best.gap) best = { host: other, f, me, hostFace, gap };
    });
    return best;
  };
  function syncWallOffVerb() {
    if (!wallOffButton) return;
    const wall = wallPicked && selection.some(e => e.item === wallPicked) && walls().includes(wallPicked) ? wallPicked : null;
    const able = !activeCut() && !modalUp() && !!wall && !!wallOffHost(wall);
    wallOffButton.hidden = !able || !!rotateState?.open || !!flipState?.open;
  }
  const wallOff = () => {
    const wall = wallPicked;
    const found = wall && wallOffHost(wall);
    if (!found) return;
    const { host, f } = found;
    const FG = window.DraftFixtureGeometry;
    const onHost = p => ({ t: (p.x - f.s.x) * f.u.x + (p.z - f.s.z) * f.u.z, across: (p.x - f.s.x) * f.n.x + (p.z - f.s.z) * f.n.z });
    const ou = found.me.u;
    const reversed = ou.x * f.u.x + ou.z * f.u.z < 0;
    const edits = [];
    const keep = item => edits.push({ item, before: { ...item } });
    // THE FIXTURES, where they stand, onto the house wall.
    (drawing.fixtures || []).forEach(fx => {
      if (fx.endWallId === wall.id) { keep(fx); fx.endWallId = host.id; }
      if (fx.wallId !== wall.id) return;
      if (!edits.some(e => e.item === fx)) keep(fx);
      const g = FG && FG.fixtureGeometry(drawing.walls, fx, wall);
      if (fx.kind === 'tub') {
        fx.wallId = host.id;
        if (reversed) fx.dir = fx.dir === -1 ? 1 : -1;
        if (g?.center) fx.side = onHost(g.center).across >= 0 ? 1 : -1;
        return;
      }
      if (!g?.center) return;
      const at = onHost(g.center);
      fx.wallId = host.id;
      fx.offset = Math.max(0, at.t);
      fx.side = at.across >= 0 ? 1 : -1;
    });
    // THE DOORS AND WINDOWS, their middles across.
    (drawing.fenestrations || []).forEach(o => {
      if (o.wallId !== wall.id) return;
      keep(o);
      const mid = { x: wall.start.x + ou.x * o.offset, z: wall.start.z + ou.z * o.offset };
      o.wallId = host.id;
      o.offset = Math.max(0, onHost(mid).t);
      if (reversed) {
        if (o.type === 'door') o.hingeFlip = o.hingeFlip !== true;
        o.swingFlip = o.swingFlip !== true;
      }
    });
    // THE WALLS THAT MET IT RUN ON TO THE HOUSE WALL'S FACE.
    const moved = [];
    [wall.start, wall.end].forEach(v => {
      const other = (drawing.walls || []).find(w => w !== wall && w !== host && (w.start === v || w.end === v));
      if (!other) return;
      const far = other.start === v ? other.end : other.start;
      const dir = { x: v.x - far.x, z: v.z - far.z };
      const denom = dir.x * f.n.x + dir.z * f.n.z;
      if (Math.abs(denom) < 1e-9) return;
      const k = (found.hostFace - ((far.x - f.s.x) * f.n.x + (far.z - f.s.z) * f.n.z)) / denom;
      moved.push({ vtx: v, x: v.x, z: v.z });
      v.x = far.x + dir.x * k;
      v.z = far.z + dir.z * k;
      relinkVertex(v);
    });
    const index = drawing.walls.indexOf(wall);
    drawing.walls.splice(index, 1);
    const groupsBefore = (drawing.groups || []).map(g => ({ g, members: g.members }));
    (drawing.groups || []).forEach(g => { g.members = (g.members || []).filter(m => !(m.type === 'wall' && m.id === wall.id)); });
    undoStack.push({ kind: 'node', undo: () => {
      drawing.walls.splice(index, 0, wall);
      edits.forEach(({ item, before }) => { Object.keys(item).forEach(k => delete item[k]); Object.assign(item, before); });
      moved.forEach(m => { m.vtx.x = m.x; m.vtx.z = m.z; relinkVertex(m.vtx); });
      groupsBefore.forEach(({ g, members }) => { g.members = members; });
    } });
    wallPicked = null;
    markDirty();
    setSelection(selection.filter(e => e.item !== wall));
    sayOnStrip('WALL OFF: the house wall serves -- what hung on that wall moved onto it. UNDO puts the wall back.');
    paint();
  };
  if (wallOffButton) wallOffButton.addEventListener('click', wallOff);

  // THE NEAREST POINT ON THE HELD ITEM: its one run for a wall or a line, its
  // ring's edges for the rest. A node on a corner already there is no node.
  const breakAt = (held, world) => {
    const G = window.DraftGeometry2D;
    const open = held.type === 'wall' || held.type === 'line';
    const pts = open ? [held.item.start, held.item.end] : (held.item.points || []);
    const edges = open ? 1 : pts.length;
    let best = null, bestD = (SELECT_GRAB_PX * 1.5) / view.scale;
    for (let index = 0; index < edges; index += 1) {
      const pt = pts[index], next = pts[(index + 1) % pts.length];
      if (!pt || !next || Math.hypot(next.x - pt.x, next.z - pt.z) < 1e-6) continue;
      const { d } = G.pointToSegment(world, { start: pt, end: next });
      if (d >= bestD) continue;
      const ex = next.x - pt.x, ez = next.z - pt.z;
      const t = ((world.x - pt.x) * ex + (world.z - pt.z) * ez) / (ex * ex + ez * ez);
      const len = Math.hypot(ex, ez);
      if (t * len < 0.01 || (1 - t) * len < 0.01) continue;
      bestD = d;
      best = { index, t, p: { x: pt.x + ex * t, z: pt.z + ez * t } };
    }
    return best;
  };
  // A ROOF'S NODE: the eave gains the point, both halves keep the edge's kind
  // and overhang, and the wall line it hangs from gains the point square
  // across from it -- each overhang is worked square off its own wall edge.
  const roofGainsNode = (roof, at) => {
    const i = at.index, n = roof.points.length;
    const y = roof.points[0]?.y ?? 0;
    const kinds = roof.points.map((_, k) => roofEdgeKind(roof.edges?.[k]));
    const overs = roofOverhangs(roof);
    const foot = roofFootprint(roof);
    roof.points = [...roof.points.slice(0, i + 1), { x: at.p.x, y, z: at.p.z }, ...roof.points.slice(i + 1)];
    roof.edges = [...kinds.slice(0, i + 1), kinds[i], ...kinds.slice(i + 1)];
    roof.edgeOverhang = [...overs.slice(0, i + 1), overs[i], ...overs.slice(i + 1)];
    if (foot && foot.length === n) {
      const a = foot[i], b = foot[(i + 1) % n];
      const ex = b.x - a.x, ez = b.z - a.z, l2 = ex * ex + ez * ez;
      const t = l2 > 0 ? ((at.p.x - a.x) * ex + (at.p.z - a.z) * ez) / l2 : 0.5;
      roof.footprint = [...foot.slice(0, i + 1), { x: a.x + ex * t, y, z: a.z + ez * t }, ...foot.slice(i + 1)];
    }
  };
  const breakNodeAt = (held, at) => {
    const item = held.item;
    if (held.type === 'wall') {
      // THE BONE'S OWN BREAK, and the bone ring gains the point with it.
      const end = item.end;
      const before = [...(drawing.outlines || []), ...(drawing.boneyardOutlines || [])]
        .map(o => ({ o, points: (o.points || []).map(pt => ({ ...pt })) }));
      const tail = breakBoneAt(item, at.p);
      undoStack.pop();
      breakState.pieces.push({ type: 'wall', item: tail });
      undoStack.push({ kind: 'node', undo: () => {
        const k = drawing.walls.indexOf(tail);
        if (k >= 0) drawing.walls.splice(k, 1);
        item.end = end;
        before.forEach(b => { b.o.points = b.points; });
        retirePoolCorners([tail.start]);
      } });
      return;
    }
    if (held.type === 'line') {
      const end = item.end;
      const mid = poolVertex(at.p, item.levelId, item.view);
      const tail = { ...item, id: newDrawingItemId('line'), start: mid, end };
      item.end = mid;
      const k = drawing.lines.indexOf(item);
      drawing.lines.splice(k < 0 ? drawing.lines.length : k + 1, 0, tail);
      breakState.pieces.push({ type: 'line', item: tail });
      undoStack.push({ kind: 'node', undo: () => {
        const j = drawing.lines.indexOf(tail);
        if (j >= 0) drawing.lines.splice(j, 1);
        item.end = end;
        retirePoolCorners([mid]);
      } });
      markDirty();
      return;
    }
    const before = { ...item };
    if (held.type === 'roof') roofGainsNode(item, at);
    else {
      const y = item.points[0]?.y ?? 0;
      item.points = [...item.points.slice(0, at.index + 1), { x: at.p.x, y, z: at.p.z },
        ...item.points.slice(at.index + 1)];
    }
    undoStack.push({ kind: 'props', edits: [{ item, before }] });
    markDirty();
  };
  const endBreak = () => {
    if (!breakState.held) return false;
    breakState.held = null;
    syncBreakVerb();
    sayOnStrip('');
    paint();
    return true;
  };
  const pressBreak = () => {
    if (moveState?.node?.list?.length === 2) { splitRoofAtNodes(); return; }
    const one = breakHeld();
    if (one) {
      if (breakState.held) { endBreak(); return; }
      breakState.held = one;
      breakState.pieces = [one];
      syncBreakVerb();
      sayOnStrip('BREAK: click on it to add a node there -- as many as you like. ENTER, Esc or BREAK again ends it.');
      paint();
      return;
    }
    const n = selectedGroups().length;
    if (!n) return;
    ungroupSelected();
    sayOnStrip(`ASSEMBLY BUST: broken into pieces, ${n === 1 ? 'the assembly is' : `${n} assemblies are`} gone and the pieces stay selected.`);
    paint();
  };
  if (breakButton) breakButton.addEventListener('click', pressBreak);
  // EACH CLICK A NODE, ahead of every tool's own press while BREAK is up.
  canvas.addEventListener('pointerdown', event => {
    if (!breakState.held || event.button !== 0) return;
    event.stopImmediatePropagation();
    event.preventDefault();
    const r = canvas.getBoundingClientRect();
    const world = toWorld(event.clientX - r.left, event.clientY - r.top);
    // A WALL OR LINE BROKEN IS TWO, and a click on either half breaks it
    // again: every piece made since BREAK was pressed is still in the running.
    const piece = breakState.pieces.find(entry => breakAt(entry, world));
    const at = piece && breakAt(piece, world);
    if (!at) { sayOnStrip('BREAK: click ON it, away from a corner already there.'); return; }
    breakNodeAt(piece, at);
    sayOnStrip('BREAK: node added. Another, or ENTER / Esc to end.');
    setSelection([...selection]);
    paint();
  }, true);
  document.addEventListener('keydown', event => {
    if (event.key !== 'Enter' || !breakState.held) return;
    if (event.target?.closest?.('input, textarea, select')) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    endBreak();
  }, true);

  // ── MOVE, FOR A ROOF (Movie, 18 Oct) ─────────────────────────────────────
  //
  // "id like to be able to grab the edge of a roof, and then have opion down
  // below with BREAK COPY etc that says MOVE ... if i grab the jog backed edge
  // on the right side of the jog and chose MOVE and then pushed it over all
  // the way to the left so there is no roof left it would just smooth out the
  // roof to the main eave (but would ignore the walls ...)" -- "if they grab
  // the peice more upward ... the ROOF EDGE and then drag it down to where the
  // main roof edge is and line them up" -- "option also to SELECT just the
  // NODE and i could either DELETE it or MOVE it" -- "keep the PLANE / SLOPE
  // of roof FIXED". A roof has one pitch, so its planes keep their slope
  // whatever its outline does.
  //
  // MOVE pressed, a press on the roof decides what is in hand:
  //   a NODE    -- drag it, or let go where it was and it is PICKED: DELETE
  //                takes it out, its two edges joining;
  //   an EDGE   -- it slides square to itself, the edges either side
  //                stretching along their own lines;
  //   inside    -- the whole roof moves, and every roof in its assembly.
  // THE WALL LINE GOES WITH THE EAVE, so each edge keeps its overhang. The
  // walls themselves are not touched. A point the move leaves on top of
  // another, or doubled back, or on a straight run, is cleaned away -- only
  // round what moved, so a BREAK node elsewhere is kept.
  const moveButton = document.getElementById('model-move');
  var moveState = { on: false, roof: null, node: null, drag: null };
  // THE LAST MOVE, kept for a typed length (Movie, 19 Oct: "i would like to
  // move exactly 12'1 down (at 90 with T on) but it won't allow me to enter a
  // LENGTH"). The drag gives the direction, the box the distance: drag it
  // roughly where it goes, type 12'1, ENTER, and it lands exactly that far
  // along the line the drag took. Good only while that move is still the
  // last thing done -- `step` is its undo entry, and anything pushed after it
  // means the drawing has moved on.
  var moveTyped = null;
  // A LENGTH TYPED WHILE THE BUTTON IS STILL DOWN (Movie, 20 Oct): "i move
  // it in the direction i want to move ... then i press 'R' or 'L' and it
  // takes me into the text box to type the length, and i press enter or the
  // mouse button or the space bar to finish the length and make the MOVE".
  // R and L open the box mid-drag (the handler by the digit opener); this
  // remembers that they did, so the release knows to finish the length.
  var typedMidDrag = false;
  // A DRAG UNDER SELECT IS FINISHED THE SAME WAY (Movie, 20 Oct: "when i
  // move the line it doesn't allow me to enter the LENGTH textbox to allow it
  // to go a certain distance from initial point") -- `drag` marks one, and it
  // needs no MOVE lit. Never while a run is being drawn: then the box is the
  // run's length, as it always was.
  const moveTypedReady = () => !!(moveTyped
    && (moveTyped.drag ? !moveDrag || moveDrag.before === moveTyped.before : moveState.on && !moveState.drag)
    && !(drawsRun() && drawStart) && !(activeTool === 'outline' && outlineCorners.length)
    && undoStack[undoStack.length - 1] === moveTyped.step);
  // THE RELEASE FINISHES A LENGTH TYPED MID-DRAG: the drag gave the line,
  // the box the distance, and the button coming up is the ENTER. Called by
  // every release that arms moveTyped, after it has.
  const finishTypedMidDrag = () => {
    if (!typedMidDrag) return;
    typedMidDrag = false;
    if (moveTypedReady() && String(lengthBox.value).trim()) { moveByTyped(); return; }
    lengthBox.blur();
    stripRefresh();
  };
  const moveRoofHeld = () => {
    if (selection.length && selection.every(entry => entry.type === 'roof')) return selection[0].item;
    return null;
  };
  function syncMoveVerb() {
    if (!moveState || !moveButton) return;
    const roof = moveRoofHeld();
    // ANY SELECTION MOVES (Movie, 18 Oct, a WC picked whole: "need to be
    // able to MOVE the SELECTED items too, not able too move the WC when all
    // selected like this"). A roof on its own keeps its edge and node MOVE.
    const able = !activeCut() && !modalUp() && selection.length > 0;
    if (!able || (moveState.on && roof !== moveState.roof && !moveState.drag)) {
      moveState.on = false; moveState.roof = null; moveState.node = null;
    }
    if (moveState.node && roof !== moveState.node.roof) moveState.node = null;
    moveButton.hidden = !able || !!rotateState?.open || !!flipState?.open || !!rescaleState?.open;
    moveButton.setAttribute('aria-pressed', String(!!moveState.on));
    document.querySelectorAll('[data-tool-key="move"]').forEach(btn =>
      btn.setAttribute('aria-pressed', String(!!moveState.on)));
  }
  const roofRings = roof => {
    const n = roof.points.length;
    const foot = roofFootprint(roof);
    return { foot: foot && foot.length === n ? foot.map(p => ({ x: p.x, z: p.z })) : null };
  };
  const lineMeet = (p, u, q, v) => {
    const cross = u.x * v.z - u.z * v.x;
    if (Math.abs(cross) < 1e-9) return null;
    const t = ((q.x - p.x) * v.z - (q.z - p.z) * v.x) / cross;
    return { x: p.x + u.x * t, z: p.z + u.z * t };
  };
  // ONE RING'S EDGE i SLID BY d ALONG ITS LEFT NORMAL: its ends go to where
  // the slid line meets the neighbours' lines (or straight across, where a
  // neighbour runs on in line with it).
  const slideEdge = (pts, i, d) => {
    const n = pts.length, a = pts[i], b = pts[(i + 1) % n];
    const len = Math.hypot(b.x - a.x, b.z - a.z);
    if (len < 1e-9) return pts;
    const u = { x: (b.x - a.x) / len, z: (b.z - a.z) / len }, nn = { x: -u.z, z: u.x };
    const a2 = { x: a.x + nn.x * d, z: a.z + nn.z * d };
    const prev = pts[(i - 1 + n) % n], next = pts[(i + 2) % n];
    const along = (p, q) => { const l = Math.hypot(q.x - p.x, q.z - p.z) || 1; return { x: (q.x - p.x) / l, z: (q.z - p.z) / l }; };
    const na = lineMeet(a2, u, prev, along(prev, a)) || a2;
    const b2 = { x: b.x + nn.x * d, z: b.z + nn.z * d };
    const nb = lineMeet(b2, u, next, along(next, b)) || b2;
    const out = pts.slice();
    out[i] = { ...a, x: na.x, z: na.z };
    out[(i + 1) % n] = { ...b, x: nb.x, z: nb.z };
    return out;
  };
  // THE TIDY: round the points in `near` (indices), take away one that sits
  // on its neighbour, doubles back, or runs straight on between two edges of
  // one kind -- the same index from every parallel array.
  const tidyRoof = (roof, near) => {
    let watch = new Set(near.map(i => roof.points[i]));
    const drop = i => {
      const n = roof.points.length;
      [roof.points[(i - 1 + n) % n], roof.points[(i + 1) % n]].forEach(p => watch.add(p));
      roof.points.splice(i, 1);
      roof.edges.splice(i, 1);
      roof.edgeOverhang.splice(i, 1);
      if (roof.footprint) roof.footprint.splice(i, 1);
    };
    for (let guard = 0; guard < 200 && roof.points.length > 3; guard += 1) {
      const n = roof.points.length;
      let hit = -1;
      for (let i = 0; i < n && hit < 0; i += 1) {
        if (!watch.has(roof.points[i])) continue;
        const p = roof.points[(i - 1 + n) % n], c = roof.points[i], q = roof.points[(i + 1) % n];
        if (Math.hypot(q.x - c.x, q.z - c.z) < 1e-4) { hit = i; break; }
        const ax = c.x - p.x, az = c.z - p.z, bx = q.x - c.x, bz = q.z - c.z;
        const straight = Math.abs(ax * bz - az * bx) < 1e-6 * Math.max(1, Math.hypot(ax, az) * Math.hypot(bx, bz));
        if (!straight) continue;
        const back = ax * bx + az * bz < 0;
        const sameKind = roof.edges[(i - 1 + n) % n] === roof.edges[i];
        if (back || sameKind) hit = i;
      }
      if (hit < 0) break;
      drop(hit);
    }
  };
  const roofNodeAt = (roof, at, px = SELECT_GRAB_PX) => {
    const reach = px / view.scale;
    let best = null;
    roof.points.forEach((p, i) => {
      const d = Math.hypot(p.x - at.x, p.z - at.z);
      if (d <= reach && (!best || d < best.d)) best = { i, d };
    });
    return best ? best.i : null;
  };
  const roofBefore = roof => ({ ...roof, points: roof.points.map(p => ({ ...p })),
    edges: roof.edges.slice(), edgeOverhang: roofOverhangs(roof).slice(),
    ...(roof.footprint ? { footprint: roof.footprint.map(p => ({ ...p })) } : {}),
    ...(roof.crossGables ? { crossGables: roof.crossGables.map(g => ({ ...g, at: { ...g.at } })) } : {}) });
  const normaliseForMove = roof => {
    roof.edges = roof.points.map((_, k) => roofEdgeKind(roof.edges?.[k]));
    roof.edgeOverhang = roofOverhangs(roof).slice();
    const { foot } = roofRings(roof);
    if (foot) roof.footprint = foot.map(p => ({ x: p.x, y: roof.points[0]?.y ?? 0, z: p.z }));
    roof.follows = 'none';
  };
  const endMove = () => {
    moveState.on = false; moveState.node = null; moveState.drag = null;
    syncMoveVerb();
    sayOnStrip('');
    paint();
  };
  const pressMove = () => {
    if (moveState.on) { endMove(); return; }
    // A PHOTO PICKED ON THE SHEET GOES IN HAND, the card's own MOVE.
    const photo = selectedPhoto();
    if (photo) {
      setRescaleOpen(false);
      traceMoving = { underlay: photo, from: null, before: null };
      sayOnStrip(`Drag ${photo.name || 'the image'} to where it belongs \u2014 ROTATE turns it, Esc to leave it.`);
      paint();
      return;
    }
    const roof = moveRoofHeld();
    if (!roof) {
      if (!selection.length) return;
      moveState.on = true; moveState.roof = null; moveState.node = null;
      syncMoveVerb();
      sayOnStrip('MOVE: drag anywhere to move what is selected -- the doors, windows and fixtures on its walls go with them. Esc or MOVE again ends.');
      paint();
      return;
    }
    moveState.on = true; moveState.roof = roof;
    if (moveState.node?.roof !== roof) moveState.node = null;
    syncMoveVerb();
    sayOnStrip('MOVE: drag an EDGE in or out, drag a NODE (or click one and DELETE it), or drag inside the roof to move it all. Esc or MOVE again ends.');
    paint();
  };
  const deleteRoofNode = () => {
    const { roof, list } = moveState.node || {};
    if (!roof || !list?.length) return;
    if (roof.points.length - list.length < 3) { sayOnStrip('A roof needs three corners at least.'); return; }
    const before = roofBefore(roof);
    normaliseForMove(roof);
    // A CORNER TAKEN OUT LEAVES A SLOPED EDGE (Movie, 18 Oct: "that corner
    // node i would delete to cut off the corner and match the 45 (it would be
    // a sloped eave)"): the planes stay, cut along the new edge. A node on a
    // straight run just goes. Several picked go highest index first, so the
    // ones still to go keep their places.
    list.slice().sort((a, b) => b - a).forEach(i => {
      const n0 = roof.points.length;
      const p0 = roof.points[(i - 1 + n0) % n0], c0 = roof.points[i], q0 = roof.points[(i + 1) % n0];
      const turn = Math.abs((c0.x - p0.x) * (q0.z - c0.z) - (c0.z - p0.z) * (q0.x - c0.x));
      if (turn > 1e-6) roof.edges[(i - 1 + n0) % n0] = 'sloped';
      roof.points.splice(i, 1);
      roof.edges.splice(i, 1);
      roof.edgeOverhang.splice(i, 1);
      if (roof.footprint) roof.footprint.splice(i, 1);
    });
    undoStack.push({ kind: 'props', edits: [{ item: roof, before }] });
    moveState.node = null;
    markDirty();
    setSelection([...selection]);
    sayOnStrip(`${list.length === 1 ? 'Node' : `${list.length} nodes`} taken out: a cut corner is SLOPED -- the roof planes kept, cut along it. UNDO puts it back.`);
    paint();
  };
  if (moveButton) moveButton.addEventListener('click', pressMove);
  // ── WHAT A MOVE OF THE SELECTION CARRIES ─────────────────────────────
  //
  // ROTATE's own set, the same reasons: a FIXED assembly goes whole when any
  // of it is picked; a corner shared with a wall that stays is let go, so the
  // walls left behind keep their place; doors, windows and fixtures ride
  // their walls by offset; a stair's framing goes with it and its well is
  // carried. Every point once.
  // A MOVED ROW SPANS WALL TO WALL AGAIN: its line is run out both ways to
  // the footprint of the floor it carries, so sliding it across an L or a jog
  // lengthens it to the walls it now meets -- or shortens it, though never
  // past the first post-to-post joint, so no piece of it is driven to
  // nothing. A row that has left every footprint keeps the length it had.
  const reclipRun = run => {
    const beam = run[0];
    const ux = beam.end.x - beam.start.x, uz = beam.end.z - beam.start.z, len = Math.hypot(ux, uz);
    if (len < 1e-6) return;
    const u = { x: ux / len, z: uz / len };
    const o = beam.start;
    const at = p => (p.x - o.x) * u.x + (p.z - o.z) * u.z;
    const ends = run.flatMap(b => [b.start, b.end]);
    const params = ends.map(at);
    const lo = Math.min(...params), hi = Math.max(...params);
    const joints = [...new Set(params.map(p => Math.round(p * 1000) / 1000))]
      .filter(p => p > lo + 1e-3 && p < hi - 1e-3);
    const rings = storeyBodiesOver(Number(beam.levelId)).map(b => b.outline?.points || [])
      .filter(ring => ring.length >= 3);
    // FROM A POINT OF THE ROW THAT IS OVER THE FLOOR: its middle first, then
    // out along it, so a row whose middle sits right on a wall of a jog still
    // finds the floor it crosses.
    let from = null, ring = null;
    [0.5, 0.4, 0.6, 0.3, 0.7, 0.2, 0.8, 0.1, 0.9].some(t => {
      const p = lo + (hi - lo) * t;
      const pt = { x: o.x + u.x * p, z: o.z + u.z * p };
      const hit = rings.find(r => pointInRing(r, pt));
      if (hit) { from = { pt, p }; ring = hit; }
      return !!hit;
    });
    if (!ring) return;
    const reach = sign => {
      let best = Infinity;
      ring.forEach((a, i) => {
        const b = ring[(i + 1) % ring.length];
        const ex = b.x - a.x, ez = b.z - a.z;
        const dx = sign * u.x, dz = sign * u.z;
        const den = dx * ez - dz * ex;
        if (Math.abs(den) < 1e-12) return;
        const t = ((a.x - from.pt.x) * ez - (a.z - from.pt.z) * ex) / den;
        const s = ((a.x - from.pt.x) * dz - (a.z - from.pt.z) * dx) / den;
        if (t > 1e-9 && s >= -1e-9 && s <= 1 + 1e-9) best = Math.min(best, t);
      });
      return best;
    };
    const back = reach(-1), fwd = reach(1);
    if (!Number.isFinite(back) || !Number.isFinite(fwd)) return;
    const newLo = Math.min(from.p - back, joints.length ? joints[0] - 0.5 : hi - 0.5);
    const newHi = Math.max(from.p + fwd, joints.length ? joints[joints.length - 1] + 0.5 : lo + 0.5);
    ends.forEach((pt, i) => {
      const p = params[i];
      const to = Math.abs(p - lo) < 1e-6 ? newLo : Math.abs(p - hi) < 1e-6 ? newHi : null;
      if (to == null) return;
      const across = (pt.x - o.x) * -u.z + (pt.z - o.z) * u.x;
      pt.x = o.x + u.x * to - u.z * across;
      pt.z = o.z + u.z * to + u.x * across;
    });
  };
  // ── THE FLOOR STEPS UP WHEN A MOVED BEAM LENGTHENS ITS SPAN ──────────────
  //
  // Movie, 19 Oct: "allow the user to INCREASE the thickness of the floor if
  // the span is increased past acceptable span, and would be 31 feet max space
  // for OWJ, they can span further, but the floor will stay at the same
  // thickness (24" 23.25" plus 3/4" sheathin)" -- and asked whether the
  // deeper floor raises the house: "yes the whole house will need to increase
  // height ... to maintain floor to ceiling heights which should be
  // maintained, if it is a crawl space under the main floor (if it is less
  // than 8ft height foundation) THAT ceiling height can be decreased".
  //
  // So after a beam row is moved or deleted, each OWJ floor it carries is
  // measured bay by bay, and one whose longest bay is past what its joist
  // reaches takes the shallowest row of build-house's own table that does --
  // 16" o.c. first, 12" the last resort, never past 23-1/4". The storey stack
  // is built from these numbers, so every storey above rises by the
  // difference and keeps its ceiling; over a crawl space the pour gives the
  // difference up instead, so the floor deepens down into it. Past the table
  // the floor stays at 23-1/4" @ 12" and the bay is marked (paintJoistCallouts).
  //
  // A floor is never stepped DOWN here: a beam moved to shorten a span leaves
  // the depth the drafter or an earlier step chose. Answers the 'props' edits
  // it made, for the gesture's own undo, and a line for the strip.
  const CRAWL_SPACE_POUR_FT = 8;
  const stepUpJoists = framingLevelId => {
    const B = window.DraftBuildHouse, LA = window.DraftLevelAssembly;
    if (!drawing || !B?.joistBays || !B?.owjFor || !LA) return { edits: [], said: [] };
    const beamsHere = (drawing.beams || []).filter(b => Number(b.levelId) === Number(framingLevelId) && b.start && b.end);
    const spanOf = new Map();
    storeyBodiesOver(Number(framingLevelId)).forEach(({ outline, storeyId }) => {
      const bays = B.joistBays(outline.points.map(p => ({ x: p.x, z: p.z })), { beams: beamsHere });
      if (bays) spanOf.set(storeyId, Math.max(spanOf.get(storeyId) || 0, bays.spanFt));
    });
    const edits = [], said = [];
    const tableSpan = (depthIn, ocIn) => (B.OWJ_SPANS || [])
      .find(row => Math.abs(row.depthIn - depthIn) < 1e-6)?.spanFt?.[ocIn];
    spanOf.forEach((span, storeyId) => {
      const asm = LA.levelAssemblyFor(drawing.levelAssemblies, storeyId);
      if (asm.joistType !== 'owj') return;
      const reach = tableSpan(asm.joistDepthIn, asm.joistSpacingIn);
      if (Number.isFinite(reach) && span <= reach + 1e-6) return;
      const want = B.owjFor(span, { minDepthIn: asm.joistDepthIn });
      if (Math.abs(want.depthIn - asm.joistDepthIn) < 1e-6 && Math.abs(want.ocIn - asm.joistSpacingIn) < 1e-6) return;
      drawing.levelAssemblies = drawing.levelAssemblies || {};
      const rec = drawing.levelAssemblies[storeyId] || (drawing.levelAssemblies[storeyId] = {});
      edits.push({ item: rec, before: { ...rec } });
      const deeperFt = (want.depthIn - asm.joistDepthIn) / 12;
      rec.joistType = 'owj';
      rec.joistDepthIn = want.depthIn;
      rec.joistSpacingIn = want.ocIn;
      // THE CRAWL SPACE TAKES IT, not the house: the floor carried straight
      // off a foundation poured under 8 ft deepens down into the crawl, so
      // the footing stays where it was. A BALLOON / LEDGER floor adds no
      // depth to begin with and has nothing to give.
      let crawl = false;
      if (Number(framingLevelId) === FOUNDATION_LEVEL_ID && deeperFt > 0 && asm.framing !== 'balloon') {
        const fdn = LA.levelAssemblyFor(drawing.levelAssemblies, FOUNDATION_LEVEL_ID);
        if (fdn.wallHeightFt - LA.SILL_PLATE_IN / 12 < CRAWL_SPACE_POUR_FT - 1e-6) {
          const fRec = drawing.levelAssemblies[FOUNDATION_LEVEL_ID]
            || (drawing.levelAssemblies[FOUNDATION_LEVEL_ID] = {});
          edits.push({ item: fRec, before: { ...fRec } });
          fRec.wallHeightFt = fdn.wallHeightFt - deeperFt;
          crawl = true;
        }
      }
      const level = (drawing.levels || []).find(l => Number(l.id) === Number(storeyId));
      said.push(`${level?.name || 'FLOOR'} OWJ ${B.inchesLabel(want.depthIn)} @ ${want.ocIn}" O.C. for the ${feetLabel(span)} span`
        + (want.fits ? '' : ' -- PAST THE TABLE: REQUIRES ENGINEERING')
        + (deeperFt > 0 ? (crawl ? '; the crawl space gives up the depth' : '; the house above rises to keep its ceilings') : ''));
    });
    return { edits, said };
  };
  // The selection with every FIXED assembly it touches held whole.
  const selectionEntries = () => {
    const entries = selection.slice();
    selection.forEach(entry => {
      const unit = groupOf(entry);
      if (unit?.fixed !== true) return;
      itemsOfGroup(unit).forEach(w => { if (!entries.some(e => e.item === w.item)) entries.push(w); });
    });
    return entries;
  };
  // Every point those entries carry: read by the move, and by the hover
  // glow before it, which must not detach anything.
  const carriedPoints = entries => {
    const chosen = new Set(entries.map(entry => entry.item));
    return [...new Set([
      ...entries.flatMap(rotatePointsOf),
      ...entries.filter(e => e.type === 'roof').flatMap(({ item }) => (item.crossGables || []).map(g => g.at)),
      ...entries.filter(e => e.type === 'stair').flatMap(({ item }) => {
        const f = stairFramingOf(item);
        return [...f.beams.flatMap(b => [b.start, b.end]), ...f.columns.map(c => c.point)];
      }),
      // A BEAM'S POSTS RIDE WITH IT (Movie, 19 Oct: "move the BEAM manually
      // so that all the columns follow"), the ones a beam staying behind
      // also stands on excepted.
      ...entries.filter(e => e.type === 'beam').flatMap(({ item }) =>
        columnsOnBeam(item, (drawing.beams || []).filter(b => !chosen.has(b))).map(c => c.point)),
    ])].filter(pt => Number.isFinite(pt?.x) && Number.isFinite(pt?.z));
  };
  // THE POINT A MOVE TAKES HOLD OF (Movie, 25 Oct: "i'd like to pick the
  // point where i scroll over, the 'node or intersection' is given a
  // CIRCLE, if there is a CIRCLE and i click the circle it click on the
  // exact intersection or node and allow me to place that node EXACTLY onto
  // another intersection or node in the same way" -- after "i'd like to
  // snap the inside corner of the WC and move it to the inside corner where
  // the 2x6 wall meets the 2x4 wall ... i get it off a little each time").
  // A press used to take hold wherever it fell, a few inches off the corner
  // he aimed at, and the move carried that miss to the corner it landed on;
  // and the WC's inside FACE corners were never among the points a move
  // seeks with. Now: every point the selection carries, and the face corners
  // of its walls -- inside and outside -- within a node's reach of the hand
  // (2", 4 to 30 px: the one snapping rule, Movie 26 Oct); the press takes
  // that exact point, and the hand's catch then lands it exactly on the node
  // or face corner it is dropped on.
  const moveGrabPoints = () => {
    const entries = selectionEntries();
    const pts = carriedPoints(entries).map(v => ({ x: v.x, z: v.z, node: true }));
    const G = window.DraftGeometry2D;
    const ws = entries.filter(e => e.type === 'wall').map(e => e.item);
    if (G?.wallFaceCorners && ws.length) {
      G.wallFaceCorners(ws, openingThicknessFt()).forEach(c => pts.push({ x: c.x, z: c.z, node: false }));
    }
    return pts;
  };
  const moveGrabAt = at => {
    if (!at || !selection.length) return null;
    const r = reachFt(NODE_REACH);
    let best = null;
    moveGrabPoints().forEach(p => {
      const d = Math.hypot(p.x - at.x, p.z - at.z);
      // PLAIN NEAREST; a node beats a face corner only at the same distance.
      if (d <= r && (!best || d < best.d - 1e-9 || (Math.abs(d - best.d) < 1e-9 && p.node && !best.p.node))) best = { d, p };
    });
    return best ? best.p : null;
  };
  const selectionMoveSet = () => {
    const entries = selectionEntries();
    const chosen = new Set(entries.map(entry => entry.item));
    const keep = (drawing.walls || []).filter(wall => !chosen.has(wall));
    const held = new Set(keep.flatMap(wall => [wall.start, wall.end]));
    // ONE ASSEMBLY ON ITS WINDOW TRACK (anchorSlide): its two anchors stay on
    // the outside walls, which stretch, and the move runs along the track.
    const owners = [...new Set(entries.map(entry => groupOf(entry)))];
    const slide = owners.length === 1 && owners[0] ? anchorSlide(owners[0]) : null;
    const pinned = new Set(slide ? anchorsOf(owners[0]).map(a => a.vtx) : []);
    const detached = [];
    entries.forEach(({ type, item }) => {
      if (type === 'roomtag' && roomShapeOf(item)) {
        // A ROOM SHAPE MOVED OFF WALLS THAT STAY LETS GO OF THEM (Movie, 25
        // Oct: "the bathroom floor acting weird"), as a turn does: a corner
        // linked to a wall left behind was pulled back to it on the next
        // paint while its unlinked neighbours went, and the WC's floor tore
        // into a band. A corner on a wall that moves too keeps its link.
        item.points.forEach((pt, index) => {
          if (!pt.link || chosen.has(linkWall(pt))) return;
          detached.push({ wall: item.points, key: index, orig: pt });
          item.points[index] = { x: pt.x, z: pt.z };
        });
        return;
      }
      if (type !== 'wall') return;
      ['start', 'end'].forEach(key => {
        if (!held.has(item[key]) || pinned.has(item[key])) return;
        const orig = item[key];
        detached.push({ wall: item, key, orig });
        item[key] = { ...orig };
      });
    });
    const points = carriedPoints(entries);
    // A LONE BEAM SLIDES ACROSS ITSELF ONLY -- "move beams up or down (in
    // this situation but if positioned the other direction from side to
    // side)" -- and its ends find the walls again wherever it lands.
    const lone = entries.length && entries.every(e => e.type === 'beam')
      && entries.every(e => beamRun(entries[0].item).includes(e.item)) ? entries[0].item : null;
    const across = lone && lone.start && lone.end ? (() => {
      const ux = lone.end.x - lone.start.x, uz = lone.end.z - lone.start.z, len = Math.hypot(ux, uz);
      return len > 1e-6 ? { x: -uz / len, z: ux / len } : null;
    })() : null;
    const wells = entries.filter(e => e.type === 'stair').map(({ item }) => stairWellOf(item))
      .filter(w => w.hole && !w.shared).map(w => ({ hole: w.hole, points: w.hole.points }));
    return { points, detached, wells, run: across ? entries.map(e => e.item) : null, across, slide,
      stairs: entries.filter(e => e.type === 'stair').map(e => e.item),
      holos: entries.filter(e => e.type === 'hologram').map(e => e.item),
      before: [...points.map(vtx => ({ vtx, x: vtx.x, z: vtx.z,
        ...(vtx.offX !== undefined ? { offX: vtx.offX, offZ: vtx.offZ } : {}) })),
        // A HOLOGRAM MOVES BY ITS OWN x AND z -- its offset on this drawing,
        // not a point on it -- so it rides the move and its undo, and the
        // magnet, which reads this list for corners to catch, passes it by.
        ...entries.filter(e => e.type === 'hologram').map(({ item }) => {
          item.x = Number(item.x) || 0; item.z = Number(item.z) || 0;
          return { vtx: item, x: item.x, z: item.z, holo: true };
        })] };
  };
  // WHAT A MOVE'S RELEASE WORKS OUT AGAIN for where the pieces now are: a
  // moved beam row re-asks its floor's span (stepUpJoists -- the deeper floor
  // and the move are one gesture and go back with one UNDO), and a moved
  // stair is framed again where it landed (reframeStair). The undo steps for
  // both, after the move's own, and the strip's word on them. Shared by the
  // drag's release and by a typed length that finishes it.
  const settleSelectionMove = set => {
    const stepped = set.run ? stepUpJoists(set.run[0].levelId) : { edits: [], said: [] };
    const carrying = set.run && !set.run.some(beam => beam.stairId);
    const reframed = [...(set.stairs || []).map(reframeStair),
      ...(carrying ? reframeStairsOn([Number(set.run[0].levelId)], set.stairs || []) : [])];
    const framedSaid = stairFramingSaid(reframed);
    return {
      steps: [...(stepped.edits.length ? [{ kind: 'props', edits: stepped.edits }] : []),
        ...reframed.flatMap(r => r.steps)],
      said: `${stepped.said.length ? ` ${stepped.said.join('. ')}.` : ''}${framedSaid}`,
    };
  };
  // ── STRETCH (Movie, 20 Oct) ──────────────────────────────────────────
  //
  // "use it with the RECTAGULAR SELECT, so if they choose STRETCH
  // automatically also glow the SELECT button and bring up the rectagle
  // select ... let him just press for each corner" -- then "click on the edge
  // node of the existing suite and pull it up to te line, and all the
  // ASSEMBLED units with even a small part withint the rectabgle should be
  // FULLY dragged along 'in tact'". And his answers: doors and windows on a
  // stretched wall "keep em put", measured from the end that stays; a suite
  // hologram the box touches moves whole.
  //
  // FOUR PRESSES: two corners of a crossing box, a base point, and where the
  // base point goes (the magnet, the T-square and a typed length all work on
  // that last one, as on a wall). Then:
  //   - every point INSIDE the box moves, once -- a wall corner is one point
  //     shared by the walls that meet there, so the walls crossing the box
  //     edge stretch and the ones wholly inside move;
  //   - an ASSEMBLY any part of which the box touches moves whole, and so do
  //     a stair, a column, a tag and a note;
  //   - a SUITE hologram the box touches moves whole;
  //   - a door, window or fixture on a stretched wall keeps its distance from
  //     the end that stays -- one inside the box rides the end that moves;
  //   - one UNDO puts it all back.
  const STRETCH_WHOLE = new Set(['stair', 'column', 'roomtag', 'note', 'superNode']);
  const stretchBox = () => {
    const { a, b } = stretchState;
    if (!a || !b) return null;
    return { minX: Math.min(a.x, b.x), maxX: Math.max(a.x, b.x), minZ: Math.min(a.z, b.z), maxZ: Math.max(a.z, b.z) };
  };
  const inBox = (box, pt) => !!pt && pt.x >= box.minX && pt.x <= box.maxX && pt.z >= box.minZ && pt.z <= box.maxZ;
  // A SHAPE THE BOX TOUCHES: a corner inside, or an edge across one of its own.
  const boxTouches = (box, parts, open) => {
    const corners = [{ x: box.minX, z: box.minZ }, { x: box.maxX, z: box.minZ }, { x: box.maxX, z: box.maxZ }, { x: box.minX, z: box.maxZ }];
    const d = (u, v, w) => (v.x - u.x) * (w.z - u.z) - (v.z - u.z) * (w.x - u.x);
    const cross = (p, q, r, t) => ((d(r, t, p) > 0) !== (d(r, t, q) > 0)) && ((d(p, q, r) > 0) !== (d(p, q, t) > 0));
    return parts.some(pts => {
      const ring = (pts || []).filter(Boolean);
      if (ring.some(p => inBox(box, p))) return true;
      const n = open ? ring.length - 1 : ring.length;
      for (let i = 0; i < n; i += 1) {
        const u = ring[i], v = ring[(i + 1) % ring.length];
        if (corners.some((r, k) => cross(u, v, r, corners[(k + 1) % 4]))) return true;
      }
      return false;
    });
  };
  // WHAT A BOX WILL MOVE, worked out without moving anything -- read by the
  // ghost while the destination is chosen and by the stretch itself.
  const stretchPlan = box => {
    const was = selectFilter;
    let shapesHere;
    try { selectFilter = 'all'; shapesHere = boxShapes(false); } finally { selectFilter = was; }
    const points = new Set();
    const whole = new Set();
    const addAll = entry => rotatePointsOf(entry).forEach(p => points.add(p));
    const doneGroups = new Set();
    shapesHere.forEach(({ type, item, parts, open }) => {
      if (type === 'fenestration' || type === 'fixture') return;
      const entry = { type, item };
      const unit = groupOf(entry);
      if (unit) {
        if (doneGroups.has(unit)) return;
        const members = itemsOfGroup(unit);
        const touched = members.some(m => {
          const shape = shapesHere.find(sh => sh.item === m.item);
          return shape && boxTouches(box, shape.parts, shape.open);
        });
        if (!touched) return;
        doneGroups.add(unit);
        members.forEach(m => { whole.add(m.item); addAll(m); });
        return;
      }
      if (STRETCH_WHOLE.has(type)) {
        if (boxTouches(box, parts, open)) { whole.add(item); addAll(entry); }
        return;
      }
      rotatePointsOf(entry).forEach(p => { if (inBox(box, p)) points.add(p); });
    });
    // A HAND DIMENSION's ends inside the box go with what they measure.
    dimensions().filter(dim => dim.auto !== true).forEach(dim => {
      [dim.start, dim.end].forEach(p => { if (p && inBox(box, p)) points.add(p); });
    });
    const valid = [...points].filter(pt => Number.isFinite(pt?.x) && Number.isFinite(pt?.z));
    const holos = holograms().filter(holo => !holo.hidden && H()
      && boxTouches(box, H().placed(holo, H().parts(holo).existing.walls || [])
        .filter(w => w?.start && w?.end && Number(w.levelId) === Number(activeLevelId()))
        .map(w => [w.start, w.end]), true));
    return { points: new Set(valid), whole, holos };
  };
  // Where the base point goes: the magnet's catch, then square to the base
  // under the T-square.
  const stretchDestination = at => {
    const base = stretchState.base;
    let to = drawSnap(at).pt || at;
    if (base && tsquareOn && board !== 'toy') {
      to = Math.abs(to.x - base.x) >= Math.abs(to.z - base.z) ? { x: to.x, z: base.z } : { x: base.x, z: to.z };
    }
    return { x: to.x, z: to.z };
  };
  // A DOOR, WINDOW OR FIXTURE ON A WALL ONE END OF WHICH MOVED keeps its
  // distance from the end it belongs to: the end that stays, or the end that
  // moves when the opening itself is inside the box.
  const stretchOffsets = (box, points, dx, dz) => {
    const edits = [];
    const G = window.DraftGeometry2D;
    (drawing.walls || []).forEach(wall => {
      const sMoves = points.has(wall.start), eMoves = points.has(wall.end);
      if (sMoves === eMoves) return;
      const oldLen = Math.hypot(wall.end.x - wall.start.x, wall.end.z - wall.start.z);
      const s2 = sMoves ? { x: wall.start.x + dx, z: wall.start.z + dz } : wall.start;
      const e2 = eMoves ? { x: wall.end.x + dx, z: wall.end.z + dz } : wall.end;
      const newLen = Math.hypot(e2.x - s2.x, e2.z - s2.z);
      const centreOf = offset => ({ x: wall.start.x + (wall.end.x - wall.start.x) * (offset / (oldLen || 1)),
        z: wall.start.z + (wall.end.z - wall.start.z) * (offset / (oldLen || 1)) });
      const onIt = [...(drawing.fenestrations || []), ...(drawing.fixtures || [])]
        .filter(o => String(o.wallId) === String(wall.id) && Number.isFinite(Number(o.offset)));
      onIt.forEach(o => {
        const offset = Number(o.offset);
        const rides = inBox(box, centreOf(offset)) ? (sMoves ? 'start' : 'end') : (sMoves ? 'end' : 'start');
        const next = rides === 'end' ? newLen - (oldLen - offset) : offset;
        if (Math.abs(next - offset) > 1e-9) edits.push({ item: o, before: { ...o }, offset: next });
      });
    });
    return edits;
  };
  const stretchApply = (dx, dz) => {
    const box = stretchBox();
    stretchState = { a: null, b: null, base: null };
    if (!box || Math.hypot(dx, dz) < 1e-6) { paint(); return; }
    const plan = stretchPlan(box);
    if (!plan.points.size && !plan.holos.length) {
      sayOnStrip('STRETCH: nothing in that box to stretch.');
      setTool(RESTING_TOOL);
      paint();
      return;
    }
    const offsets = stretchOffsets(box, plan.points, dx, dz);
    const points = [...plan.points];
    const before = points.map(vtx => ({ vtx, x: vtx.x, z: vtx.z,
      ...(vtx.offX !== undefined ? { offX: vtx.offX, offZ: vtx.offZ } : {}) }));
    const stairsMoved = (drawing.stairs || []).filter(st => plan.whole.has(st));
    const wells = stairsMoved.map(stairWellOf).filter(w => w.hole && !w.shared)
      .map(w => ({ hole: w.hole, points: w.hole.points }));
    points.forEach(p => { p.x += dx; p.z += dz; });
    wells.forEach(w => { w.hole.points = w.points.map(p => ({ ...p, x: p.x + dx, z: p.z + dz })); });
    points.forEach(relinkVertex);
    const props = [];
    offsets.forEach(({ item, before: was, offset }) => { props.push({ item, before: was }); item.offset = offset; });
    plan.holos.forEach(holo => {
      props.push({ item: holo, before: { ...holo } });
      holo.x = (Number(holo.x) || 0) + dx;
      holo.z = (Number(holo.z) || 0) + dz;
    });
    const settled = settleSelectionMove({ run: null, stairs: stairsMoved });
    const steps = [{ kind: 'rotate', before, detached: [], wells },
      ...(props.length ? [{ kind: 'props', edits: props }] : []), ...settled.steps];
    undoStack.push(steps.length > 1 ? { kind: 'batch', steps } : steps[0]);
    markDirty();
    setTool(RESTING_TOOL);
    const stretched = (drawing.walls || []).filter(w => plan.points.has(w.start) !== plan.points.has(w.end)).length;
    const parts = [stretched && `${stretched} wall${stretched === 1 ? '' : 's'} stretched`,
      plan.holos.length && `${plan.holos.length} suite${plan.holos.length === 1 ? '' : 's'} moved`].filter(Boolean);
    sayOnStrip(`STRETCHED ${feetLabel(Math.hypot(dx, dz))}${parts.length ? ` -- ${parts.join(', ')}` : ''}.${settled.said} UNDO puts it back.`);
    paint();
  };
  // The press, in its four steps.
  const stretchPress = at => {
    const st = stretchState;
    if (!st.a) {
      stretchState = { a: { x: at.x, z: at.z }, b: null, base: null };
      sayOnStrip('STRETCH: now press the opposite corner of the box.');
    } else if (!st.b) {
      if (Math.abs(at.x - st.a.x) * view.scale < 4 || Math.abs(at.z - st.a.z) * view.scale < 4) {
        sayOnStrip('STRETCH: that box has no size -- press the opposite corner.');
        return;
      }
      st.b = { x: at.x, z: at.z };
      const plan = stretchPlan(stretchBox());
      sayOnStrip(plan.points.size || plan.holos.length
        ? 'STRETCH: press the BASE POINT -- a corner it should pull by.'
        : 'STRETCH: nothing in that box yet. Press the base point anyway, or Esc to start over.');
    } else if (!st.base) {
      const p = drawSnap(at).pt || at;
      st.base = { x: p.x, z: p.z };
      sayOnStrip('STRETCH: press where it goes -- or type a length and ENTER. Esc starts over.');
    } else {
      const to = stretchDestination(at);
      stretchApply(to.x - st.base.x, to.z - st.base.z);
      return;
    }
    stripRefresh();
    paint();
  };
  // A TYPED LENGTH FINISHES IT, along the way the cursor points from the base.
  function stretchTypable() {
    return activeTool === 'stretch' && !!stretchState?.base && !!cursorWorld;
  }
  const stretchByTyped = () => {
    const parsed = F.parseArchitecturalLength(lengthBox.value);
    if (!parsed.ok) { sayOnStrip(parsed.error); return; }
    const base = stretchState.base;
    const to = stretchDestination(cursorWorld);
    const ux = to.x - base.x, uz = to.z - base.z, len = Math.hypot(ux, uz);
    if (len < 1e-9) { sayOnStrip('STRETCH: point the cursor the way it goes, then type the length.'); return; }
    const feet = parsed.inches / 12;
    lengthBox.value = '';
    lengthBox.blur();
    stretchApply(ux / len * feet, uz / len * feet);
  };
  // A HOLOGRAM LIT FROM ITS LIST ROW, as one picked is lit, a little lighter.
  function paintHologramHover() {
    if (!hologramHover || !holograms().includes(hologramHover)) return;
    ctx.save();
    ctx.strokeStyle = selectInk();
    ctx.globalAlpha = 0.6;
    ctx.lineWidth = 7;
    ctx.lineCap = 'round';
    hologramWallsHere(hologramHover).forEach(w => {
      const a = toS(w.start), b = toS(w.end);
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    });
    ctx.restore();
  }
  // THE BOX, THE BASE POINT AND A GHOST OF WHERE IT ALL GOES.
  function paintStretch() {
    if (activeTool !== 'stretch' || !stretchState?.a) return;
    const st = stretchState;
    const far = st.b || cursorWorld;
    if (!far) return;
    ctx.save();
    const a = toS(st.a), b = toS(far);
    ctx.strokeStyle = skin['draw-selected-cross'];
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 3]);
    ctx.strokeRect(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.abs(b.x - a.x), Math.abs(b.y - a.y));
    ctx.setLineDash([]);
    if (st.b) {
      const box = stretchBox();
      const plan = stretchPlan(box);
      const to = st.base && cursorWorld ? stretchDestination(cursorWorld) : null;
      const dx = to ? to.x - st.base.x : 0, dz = to ? to.z - st.base.z : 0;
      const at = p => toS({ x: p.x + (plan.points.has(p) ? dx : 0), y: 0, z: p.z + (plan.points.has(p) ? dz : 0) });
      ctx.strokeStyle = skin['draw-selected'];
      ctx.lineWidth = 2;
      ctx.globalAlpha = 0.8;
      // WHAT MOVES, lit; and once the base is down, where it lands.
      [...walls(), ...lines(), ...beams()].forEach(seg => {
        if (!seg.start || !seg.end || !(plan.points.has(seg.start) || plan.points.has(seg.end))) return;
        const s1 = at(seg.start), e1 = at(seg.end);
        ctx.beginPath(); ctx.moveTo(s1.x, s1.y); ctx.lineTo(e1.x, e1.y); ctx.stroke();
      });
      ctx.globalAlpha = 1;
      if (st.base) {
        const bs = toS(st.base);
        ctx.fillStyle = skin['draw-selected'];
        ctx.beginPath(); ctx.arc(bs.x, bs.y, 4, 0, Math.PI * 2); ctx.fill();
        if (to) {
          const ts = toS(to);
          ctx.setLineDash([3, 3]);
          ctx.beginPath(); ctx.moveTo(bs.x, bs.y); ctx.lineTo(ts.x, ts.y); ctx.stroke();
        }
      }
    }
    ctx.restore();
  }

  canvas.addEventListener('pointerdown', event => {
    if (!moveState.on || event.button !== 0) return;
    const roof = moveState.roof;
    if (!roof) {
      if (!selection.length) return;
      event.stopImmediatePropagation();
      event.preventDefault();
      const r = canvas.getBoundingClientRect();
      const at = toWorld(event.clientX - r.left, event.clientY - r.top);
      // A DOOR OR WINDOW SLIDES ALONG ITS WALL (Movie, 19 Oct: "i'm trying
      // to select and then MOVE the door to SLIDE it on the wall, but it isn't
      // moving"). An opening is a width and an offset along its host, with no
      // points of its own for the selection move to carry -- so MOVE drives
      // the same slide the SELECT drag does, by the press's travel along the
      // wall, wherever on the sheet the press began.
      const lone = selection.length === 1 && selection[0].type === 'fenestration' ? selection[0].item : null;
      const host = lone && walls().find(wall => String(wall.id) === String(lone.wallId));
      if (host) {
        moveState.drag = { kind: 'opening', at, opening: lone, host, was: lone.offset, moved: false,
          live: liveRedimBegin() };
        canvas.setPointerCapture(event.pointerId);
        return;
      }
      // A FIXTURE SLIDES AS ITS SELECT DRAG SLIDES IT (Movie, 24 Oct: "i
      // can't MOVE the cabinets sideways"). A piece on a wall stands on no
      // points of its own, so the selection move carried nothing and said
      // "Moved." -- MOVE now drives fixtureMoveBegin / fixtureMoveTo by the
      // press's travel, wherever on the sheet the press began.
      // TWO OR MORE JOINED WITH Y SLIDE TOGETHER (Movie, 25 Oct: "ONE at a
      // time unless the user connects 2 with Y ASSEMBLY (2 or mor)"): an
      // assembly of pieces on one wall goes along it as one, its gaps kept.
      const set = fixtureSetSlide(at);
      if (set) {
        moveState.drag = set;
        canvas.setPointerCapture(event.pointerId);
        return;
      }
      const piece = selection.length === 1 && selection[0].type === 'fixture' ? selection[0].item : null;
      const held = piece && fixtureMoveBegin(piece, at);
      if (held) {
        moveState.drag = { kind: 'fixture', at, md: { kind: 'fixture', ...held, links: fixtureLinks(piece) }, moved: false };
        canvas.setPointerCapture(event.pointerId);
        return;
      }
      const grab = moveGrabAt(at);
      moveState.drag = { kind: 'selection', at: grab ? { x: grab.x, z: grab.z } : at, grab: grab || null, press: at,
        set: selectionMoveSet(), moved: false };
      canvas.setPointerCapture(event.pointerId);
      return;
    }
    event.stopImmediatePropagation();
    event.preventDefault();
    const r = canvas.getBoundingClientRect();
    const at = toWorld(event.clientX - r.left, event.clientY - r.top);
    const node = roofNodeAt(roof, at);
    const edge = node == null ? roofEdgeNear(roof, at) : null;
    const owner = groupOf({ type: 'roof', item: roof });
    const whole = owner ? itemsOfGroup(owner).filter(e => e.type === 'roof').map(e => e.item) : [roof];
    const inside = node == null && edge == null && whole.some(rf => pointInRing(rf.points, at));
    if (node == null && edge == null && !inside) { moveState.node = null; paint(); return; }
    const targets = inside ? whole : [roof];
    targets.forEach(normaliseForMove);
    const carried = node != null && moveState.node?.roof === roof && moveState.node.list.length > 1
      && moveState.node.list.includes(node);
    moveState.drag = { kind: carried ? 'nodes' : node != null ? 'node' : edge != null ? 'edge' : 'roof', at, node, edge, targets,
      befores: targets.map(roofBefore), moved: false };
    canvas.setPointerCapture(event.pointerId);
  }, true);
  canvas.addEventListener('pointermove', event => {
    const d = moveState?.drag;
    if (!d) return;
    event.stopImmediatePropagation();
    const r = canvas.getBoundingClientRect();
    const at = toWorld(event.clientX - r.left, event.clientY - r.top);
    let dx = at.x - d.at.x, dz = at.z - d.at.z;
    if (!d.moved && Math.hypot(dx, dz) * view.scale < 3) return;
    d.moved = true;
    d.cursor = at;
    if (d.kind === 'opening') {
      // ALONG THE WALL ONLY, and clamped every event -- the SELECT drag's
      // reasons, the same bearing kept under the lintel.
      const wall = d.host;
      const wx = wall.end.x - wall.start.x, wz = wall.end.z - wall.start.z;
      const length = Math.hypot(wx, wz) || 1;
      const along = d.was + (dx * wx + dz * wz) / length;
      const clamped = window.DraftGeometry2D.clampOpeningToWall(wall, along, d.opening.width, {
        walls: walls(), thicknessFt: openingThicknessFt(),
      });
      if (clamped && clamped.offset !== d.opening.offset) {
        d.opening.offset = clamped.offset;
        liveRedimStep(d.live);
      }
      paint();
      return;
    }
    if (d.kind === 'fixtures') {
      fixtureSetTo(d, at);
      paint();
      return;
    }
    if (d.kind === 'fixture') {
      fixtureMoveTo(d.md, at);
      carryFixtureLinks(d.md);
      paint();
      return;
    }
    if (d.kind === 'selection' && d.set.slide) {
      ({ dx, dz } = slideDelta(d.set.slide, dx, dz));
      d.set.before.forEach(b => { b.vtx.x = b.x + dx; b.vtx.z = b.z + dz; });
      d.dx = dx; d.dz = dz;
      paint();
      return;
    }
    if (d.kind === 'selection') {
      // A BEAM ROW SLIDES ACROSS ITSELF and takes no magnet (Movie, 19 Oct:
      // the beams are placed and moved by hand); every other selection
      // SEEKS by every point it carries (SNAP lit, off TOY).
      if (d.set.across) {
        const k = dx * d.set.across.x + dz * d.set.across.z;
        dx = d.set.across.x * k; dz = d.set.across.z * k;
      }
      // THE T-SQUARE HOLDS IT SQUARE (Movie, 19 Oct: "i'm trying to move this
      // ASSEMBLY of WALLS and the T SQUARE isn't keeping it at 90 degrees it
      // is freemoving"). The hand's larger travel wins and the other is
      // dropped -- BEFORE the magnet, so the axis is picked from the raw
      // travel and no catch can flip it mid-drag; the catches are then
      // measured along that axis (moveSeek), and a free move reads them in
      // both.
      let axis = null;
      if (tsquareOn && board !== 'toy' && !d.set.across) {
        if (Math.abs(at.x - d.at.x) >= Math.abs(at.z - d.at.z)) { dz = 0; axis = 'x'; } else { dx = 0; axis = 'z'; }
      }
      // BY THE FOOT WITH THE 1' LIGHT LIT (Movie, 20 Oct: "when i MOVE a group
      // of items and i use the '1'' key (beside T SQUARE - which works) the
      // '1'' key doesn't make it go 'by the foot'"). Each axis rounded to a
      // whole foot, as a dragged wall or stair is -- after the T-square, so
      // the axis is the hand's, and before the magnet, so a catch still wins.
      const Q = window.DraftToyConstraints;
      if (footOn && Q && !d.set.across) { dx = Q.quantiseFeet(dx); dz = Q.quantiseFeet(dz); }
      if (!d.set.across && snapLive() && board !== 'toy') {
        d.magnet ||= magnetExcluding(d.set.points);
        const seek = moveSeek(d, dx, dz, axis);
        d.lit = seek?.lit || null;
        if (seek) { dx = seek.dx; dz = seek.dz; }
      }
      d.set.before.forEach(b => { b.vtx.x = b.x + dx; b.vtx.z = b.z + dz; });
      d.dx = dx; d.dz = dz;
      if (d.set.run) reclipRun(d.set.run);
      d.set.wells.forEach(w => { w.hole.points = w.points.map(p => ({ ...p, x: p.x + dx, z: p.z + dz })); });
      paint();
      return;
    }
    // A WHOLE ROOF SEEKS by its corners, the way a selection does.
    if (d.kind === 'roof' && snapLive() && board !== 'toy') {
      const carried = d.targets.flatMap(r => [...r.points, ...(r.footprint || [])]);
      const seek = pointsSeek(d.befores.flatMap(b => b.points), dx, dz, (d.magnet ||= magnetExcluding(carried)));
      d.lit = seek?.lit || null;
      if (seek) { dx = seek.dx; dz = seek.dz; }
    }
    d.targets.forEach((roof, k) => {
      const b = d.befores[k];
      roof.points = b.points.map(p => ({ ...p }));
      if (b.footprint) roof.footprint = b.footprint.map(p => ({ ...p }));
      roof.edges = b.edges.slice(); roof.edgeOverhang = b.edgeOverhang.slice();
      if (d.kind === 'roof') {
        const by = p => ({ ...p, x: p.x + dx, z: p.z + dz });
        roof.points = roof.points.map(by);
        if (roof.footprint) roof.footprint = roof.footprint.map(by);
        if (b.crossGables) roof.crossGables = b.crossGables.map(g => ({ ...g, at: by(g.at) }));
      } else if (d.kind === 'nodes') {
        moveState.node.list.forEach(k => {
          roof.points[k] = { ...roof.points[k], x: b.points[k].x + dx, z: b.points[k].z + dz };
          if (roof.footprint) roof.footprint[k] = { ...roof.footprint[k], x: b.footprint[k].x + dx, z: b.footprint[k].z + dz };
        });
      } else if (d.kind === 'node') {
        // A ROOF'S CORNER IN HAND reads the three tiers and the cross lines,
        // never itself: its own place is kept out of the magnet.
        const own = b.points[d.node];
        const magnet = snapLive() && board !== 'toy' ? (d.magnet ||= magnetExcluding([own])) : null;
        const hit = magnet ? dragMagnetAt(at, own, magnet) : null;
        d.lit = hit || null;
        const snap = hit?.pt || trackSnap(at, [own])?.pt || null;
        const to = snap ? { x: snap.x, z: snap.z } : at;
        const sx = to.x - b.points[d.node].x, sz = to.z - b.points[d.node].z;
        roof.points[d.node] = { ...roof.points[d.node], x: to.x, z: to.z };
        if (roof.footprint) roof.footprint[d.node] = { ...roof.footprint[d.node], x: roof.footprint[d.node].x + sx, z: roof.footprint[d.node].z + sz };
      } else {
        const i = d.edge, n = roof.points.length, a = roof.points[i], c = roof.points[(i + 1) % n];
        const len = Math.hypot(c.x - a.x, c.z - a.z) || 1;
        const nn = { x: -(c.z - a.z) / len, z: (c.x - a.x) / len };
        let dist = dx * nn.x + dz * nn.z;
        // IT STOPS ON THE CORNER (Movie, 18 Oct: "if the user pulls it past
        // the corner can you cut it at the corner rather than making new roof
        // on the other side" -- "it was hard to get right on the corner point
        // there was a little extra roof on either one side or the other").
        // Where an edge either side would shrink to nothing -- the slid line
        // through its far corner -- the slide stops, and catches it from a
        // few pixels short; the tidy on the release then drops the corner.
        const stops = [roof.points[(i - 1 + n) % n], roof.points[(i + 2) % n]]
          .map(p => (p.x - a.x) * nn.x + (p.z - a.z) * nn.z)
          .filter(cd => Math.abs(cd) > 1e-6 && Math.sign(cd) === Math.sign(dist || cd));
        const catchFt = 8 / view.scale;
        stops.sort((p, q) => Math.abs(p) - Math.abs(q));
        const stop = stops[0];
        if (stop != null && (Math.abs(dist) > Math.abs(stop) || Math.abs(dist - stop) < catchFt)) dist = stop;
        roof.points = slideEdge(roof.points, i, dist);
        if (roof.footprint) roof.footprint = slideEdge(roof.footprint, i, dist);
      }
    });
    paint();
  }, true);
  canvas.addEventListener('pointerup', event => {
    const d = moveState?.drag;
    if (!d) return;
    event.stopImmediatePropagation();
    moveState.drag = null;
    if (canvas.hasPointerCapture?.(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    if (d.kind === 'opening') {
      // One slide, one UNDO, with the strings that measure it re-laid in the
      // same step; nothing pushed when the clamp held it where it was.
      if (d.opening.offset !== d.was) {
        undoStack.push(liveRedimFold({ kind: 'move-opening', opening: d.opening, was: d.was }, d.live));
        // AND A TYPED DISTANCE MAY FINISH IT, as it does a wall (moveTyped):
        // the slide gives the way along the wall, the box how far.
        moveTyped = { opening: d.opening, host: d.host, was: d.was,
          dir: Math.sign(d.opening.offset - d.was), step: undoStack[undoStack.length - 1] };
        markDirty();
        sayOnStrip('Slid along its wall. Type a distance for an exact one, or UNDO puts it back.');
      }
      finishTypedMidDrag();
      paint();
      return;
    }
    if (d.kind === 'fixtures') {
      if (d.moved) {
        const edits = [...d.edits];
        settleFixtureGaps().forEach(e => { if (!edits.some(x => x.item === e.item)) edits.push(e); });
        undoStack.push({ kind: 'props', edits });
        markDirty();
        sayOnStrip(`${d.pieces.length} pieces slid along their wall together. UNDO puts them back.`);
      }
      setSelection([...selection]);
      paint();
      return;
    }
    if (d.kind === 'fixture') {
      fixtureMoveRelease(d.md);
      setSelection([...selection]);
      paint();
      return;
    }
    if (d.kind === 'selection') {
      if (!d.moved) { d.set.detached.forEach(x => { x.wall[x.key] = x.orig; }); finishTypedMidDrag(); paint(); return; }
      // SUITES MOVED ON THEIR OWN LINE UP WITH THE SHELL when let go near it,
      // as one does in hand (hologram.js suiteSnap) -- all of them by the
      // first suite's slide, so the set keeps its spacing.
      const holos = d.set.holos || [];
      const suite = !d.set.points.length && holos.find(holo => holo.mode === 'suite');
      if (suite && H()?.suiteSnap) {
        const slide = H().suiteSnap(drawing, suite, activeLevelId());
        if (slide.x || slide.z) {
          holos.forEach(holo => { holo.x += slide.x; holo.z += slide.z; });
          d.dx = (d.dx || 0) + slide.x; d.dz = (d.dz || 0) + slide.z;
        }
      }
      d.set.points.forEach(relinkVertex);
      const moveStep = { kind: 'rotate', before: d.set.before, detached: d.set.detached, wells: d.set.wells };
      const settled = settleSelectionMove(d.set);
      const steps = [moveStep, ...settled.steps];
      undoStack.push(steps.length > 1 ? { kind: 'batch', steps } : moveStep);
      // A TYPED LENGTH MAY FINISH IT -- see moveTyped.
      // THE WAY A TYPED LENGTH GOES is the hand's own travel, press to
      // release: with a corner taken exactly (moveGrabAt) the drag's start
      // stood a little off the press, and that small jump would tilt a
      // straight drag into a slant.
      const way = d.grab && d.press && d.cursor
        ? { x: d.cursor.x - d.press.x, z: d.cursor.z - d.press.z } : null;
      moveTyped = Math.hypot(d.dx || 0, d.dz || 0) > 1e-6
        ? { set: d.set, dx: d.dx, dz: d.dz, ...(way && Math.hypot(way.x, way.z) > 1e-6 ? { way } : {}),
          moveStep, step: undoStack[undoStack.length - 1] } : null;
      markDirty();
      setSelection([...selection]);
      sayOnStrip(settled.said
        ? `Moved.${settled.said} UNDO puts it all back.` : 'Moved. UNDO puts it back.');
      finishTypedMidDrag();
      paint();
      return;
    }
    if (!d.moved) {
      // A NODE CLICKED AND LET GO WHERE IT WAS IS PICKED, for DELETE.
      d.targets.forEach((roof, k) => Object.assign(roof, d.befores[k]));
      moveState.node = d.node != null ? { roof: d.targets[0], list: [d.node] } : null;
      if (moveState.node) sayOnStrip('NODE picked: DELETE takes it out, or drag it to move it.');
      paint();
      return;
    }
    if (d.kind !== 'roof') {
      const roof = d.targets[0], n = roof.points.length;
      const near = d.kind === 'nodes' ? moveState.node.list.slice()
        : d.kind === 'node' ? [d.node] : [d.edge, (d.edge + 1) % n];
      tidyRoof(roof, near);
    }
    undoStack.push({ kind: 'props', edits: d.targets.map((item, k) => ({ item, before: d.befores[k] })) });
    moveState.node = null;
    markDirty();
    setSelection([...selection]);
    sayOnStrip(d.kind === 'roof' ? 'Roof moved. UNDO puts it back.' : d.kind === 'node' || d.kind === 'nodes' ? 'Node moved; the roof keeps its pitch. UNDO puts it back.'
      : 'Edge moved; its overhang kept. UNDO puts it back.');
    paint();
  }, true);
  // ESC NEEDS NO LISTENER OF ITS OWN: the page's Escape puts the roof down,
  // and MOVE goes down with it (syncMoveVerb), as BREAK does.
  function paintRoofMoveNode() {
    const pick = moveState?.node;
    if (!pick) return;
    ctx.save();
    ctx.strokeStyle = skin['accent'] || '#e8a33d';
    ctx.fillStyle = skin['accent'] || '#e8a33d';
    ctx.lineWidth = 2;
    pick.list.forEach(i => {
      if (!pick.roof.points[i]) return;
      const s = toS(pick.roof.points[i]);
      ctx.globalAlpha = 0.45; ctx.fillRect(s.x - 6, s.y - 6, 12, 12);
      ctx.globalAlpha = 1; ctx.strokeRect(s.x - 6, s.y - 6, 12, 12);
    });
    ctx.restore();
  }
  // ESC NEEDS NO LISTENER OF ITS OWN: the page's Escape puts the selection
  // down, and a BREAK with no roof held goes down with it (syncBreakVerb).

  // ── A ROOF'S NODES PICKED WITHOUT MOVE (Movie, 18 Oct) ────────────────
  //
  // "could we do that right sweep rectangle over a node, or even just click
  // close to a ROOF node" -- "select just the NODE so it lights up and the
  // rest of the roof doesn't" -- "and then offer thing to do with that node
  // - MOVE, DELETE". The roof is held so the foot offers its verbs; the
  // nodes are what they act on: DELETE takes them out, MOVE then a drag on
  // one carries them all, a click on one picks just it; two picked and
  // BREAK ROOF splits the roof between them.
  const ROOF_NODE_CATCH_PX = 14;
  // ── BREAK ROOF: TWO ROOFS FROM ONE, ALONG THE LINE BETWEEN TWO NODES ──
  //
  // Each piece keeps its own run of the outline, its edges' kinds and
  // overhangs, and every other property; the cut is a flush GABLE on both,
  // so where the cut crosses a ridge each piece's ridge runs straight out to
  // it and the two still meet. A dormer goes with the piece it stands on.
  // The wall line is worked out again from the overhangs. One UNDO.
  function splitRoofAtNodes() {
    const { roof, list } = moveState.node || {};
    if (!roof || list?.length !== 2) return;
    const n = roof.points.length;
    const [i, j] = list.slice().sort((a, b) => a - b);
    if (j - i < 2 || n - (j - i) < 2) {
      sayOnStrip('BREAK ROOF — those two nodes share an edge. Pick two across the roof.');
      return;
    }
    const G = window.DraftGeometry2D;
    const pi = roof.points[i], pj = roof.points[j];
    const mid = { x: (pi.x + pj.x) / 2, z: (pi.z + pj.z) / 2 };
    const crosses = roof.points.some((a, k) => {
      const k2 = (k + 1) % n;
      if ([k, k2].includes(i) || [k, k2].includes(j)) return false;
      const b = roof.points[k2];
      const d = (u, v, w) => (v.x - u.x) * (w.z - u.z) - (v.z - u.z) * (w.x - u.x);
      return (d(pi, pj, a) > 0) !== (d(pi, pj, b) > 0) && (d(a, b, pi) > 0) !== (d(a, b, pj) > 0);
    });
    if (crosses || !pointInRing(roof.points, mid) || !G) {
      sayOnStrip('BREAK ROOF — the line between those nodes leaves the roof. Pick two that see each other across it.');
      return;
    }
    const before = roofBefore(roof);
    normaliseForMove(roof);
    const piece = idx => ({
      points: idx.map(k => ({ ...roof.points[k] })),
      edges: idx.map((k, m) => (m === idx.length - 1 ? 'gable' : roof.edges[k])),
      edgeOverhang: idx.map((k, m) => (m === idx.length - 1 ? 0 : roof.edgeOverhang[k])),
    });
    const run = (from, to) => { const out = []; for (let k = from; ; k = (k + 1) % n) { out.push(k); if (k === to) break; } return out; };
    const a = piece(run(i, j)), b = piece(run(j, i));
    const gables = Array.isArray(roof.crossGables) ? roof.crossGables : [];
    const onA = gables.filter(g => pointInRing(a.points, g.at));
    const onB = gables.filter(g => !onA.includes(g));
    let id = newDrawingItemId('roof');
    while (drawing.roofs.some(r => r.id === id)) id = newDrawingItemId('roof');
    const other = { ...JSON.parse(JSON.stringify(before)), ...b, id };
    delete other.footprint;
    if (onB.length) other.crossGables = onB.map(g => ({ ...g, at: { ...g.at } })); else delete other.crossGables;
    Object.assign(roof, a);
    delete roof.footprint;
    if (onA.length) roof.crossGables = onA; else delete roof.crossGables;
    const list0 = drawing.roofs;
    list0.splice(list0.indexOf(roof) + 1, 0, other);
    undoStack.push({ kind: 'node', undo: () => {
      Object.keys(roof).forEach(key => { if (!(key in before)) delete roof[key]; });
      Object.assign(roof, before);
      const at = list0.indexOf(other);
      if (at >= 0) list0.splice(at, 1);
    } });
    moveState.node = null;
    markDirty();
    setSelection([{ type: 'roof', item: roof }]);
    sayOnStrip('ROOF BROKEN in two between the nodes: each piece has its own PITCH and overhangs now and MOVEs on its own. UNDO joins them.');
    paint();
  }
  function roofNodeNear(world) {
    if (!filterAllows('roof')) return null;
    let best = null;
    pickRoofs().forEach(roof => {
      const i = roofNodeAt(roof, world, ROOF_NODE_CATCH_PX);
      if (i == null) return;
      const d = Math.hypot(roof.points[i].x - world.x, roof.points[i].z - world.z);
      if (!best || d < best.d) best = { roof, i, d };
    });
    return best;
  }
  function roofNodesInBox(a, b) {
    if (!filterAllows('roof')) return null;
    const minX = Math.min(a.x, b.x), maxX = Math.max(a.x, b.x);
    const minZ = Math.min(a.z, b.z), maxZ = Math.max(a.z, b.z);
    let best = null;
    pickRoofs().forEach(roof => {
      const list = (roof.points || []).map((p, i) => (p.x >= minX && p.x <= maxX && p.z >= minZ && p.z <= maxZ ? i : -1))
        .filter(i => i >= 0);
      if (list.length && list.length < roof.points.length && (!best || list.length > best.list.length)) best = { roof, list };
    });
    return best;
  }
  function pickRoofNodes(roof, list) {
    roofEdgeIdx = null;
    if (!(selection.length === 1 && selection[0].item === roof)) setSelection([{ type: 'roof', item: roof }]);
    moveState.node = { roof, list: list.slice() };
    syncBreakVerb();
    sayOnStrip(list.length === 1
      ? 'NODE picked: DELETE takes it out, or MOVE and drag it. SHIFT-click another node to pick two and BREAK ROOF between them.'
      : `${list.length} NODES picked: DELETE takes them out, MOVE and drag one to move them all, click one to pick just it`
        + (list.length === 2 ? ', or BREAK ROOF to split the roof between them.' : '.'));
  }

  // ONE DELETE PRESS, whichever control did the pressing. The button and the
  // two keys were separate implementations of the same sentence and only one
  // of them was ever taught anything new.
  const pressDelete = () => {
    if (activeCut() || modalUp()) return 0;
    if (moveState?.node) { deleteRoofNode(); return 1; }
    const gone = deleteSelection();
    if (gone) paint();
    return gone;
  };
  // ── the tool register ─────────────────────────────────────────────────────
  // ONE VARIABLE HOLDS WHICH TOOL IS ARMED, and it holds a tool id, never a
  // boolean. This was `let drawArmed = false` — correct while WALL was the only
  // tool on the page, and the wrong shape the moment a second one exists. A
  // seventeen-key column hung off its own state beside a live boolean gives the
  // page two ideas of what is armed; a drafter would then press SELECT, see the
  // column agree, and still commit a wall on the next tap, because the boolean
  // never heard about it. That is the same two-sources-of-truth failure this
  // page's own shell comment warns about for the active level, one panel over.
  //
  // SELECT IS THE RESTING TOOL, not "nothing armed". The old page has no
  // no-tool state (its Select is `standardTool('Select', …)`, one of the four),
  // and a column with no key lit looks exactly like a column that stopped
  // working. Pressing the armed key puts it back to select.
  //
  // WHAT THIS DOES NOT DO: it does not know how any tool behaves. Every gesture
  // still reads the register and decides for itself; the register only says
  // which one gets the press.
  const RESTING_TOOL = 'select';
  let activeTool = RESTING_TOOL;
  let drawStart = null;
  // THE PROTRACTOR IS AN INSTRUMENT NOW, lit or unlit like the T-square.
  // Movie, 5 Oct: "can we press the protractor and enter a number into the
  // ANGLE textbox and force the line to travel in that angle" -- "for LINE
  // WALLS and other similar commands (Outline)" -- then "allow them to enter
  // an angle but don't engage unless they light up the protractor" and "when
  // the protractor is lit the T square should be UNLIT".
  //
  // SO TWO FACTS: the angle the drafter typed (Enter in the ANGLE box keeps
  // it, and commits nothing), and whether the protractor is lit. Only both
  // together hold the run to that bearing; the hand then sets the length.
  let protractorOn = false;
  let typedAngle = null;
  // AND SINCE 17 OCT THEY ARE THREE INSTRUMENTS, one lit at a time. Movie:
  // "for the PROTACTOR - the user should be able to set it to 45 / or 30
  // degrees ... and then if they click on it its kindof like the T - but the
  // T is just for 90 degrees" -- "if they click the Protractor the T turns
  // off. if they click ANGLE it uses the ANGLE textbox and the typed angle is
  // used the ANGLE word is lit up and glow around the text box" -- "if they
  // enter and ANGLE eg 33 - it should take them that angle with their line
  // and lock it at that angle unless they enter a new angle or retouch the T
  // or the PROTRACTOR" -- "or if they go back to angle text box and delete
  // the number it will go back to swinigng free". So the PROTRACTOR turns the
  // run in steps of its own (protractorStep) and the ANGLE word is what locks
  // to the typed number.
  let angleOn = false;
  // NOT ON TOY. Movie: "i guess this should only be allowed if not in TOY
  // mode" -- TOY holds every run to the four axes already, and §6 takes the
  // instruments away.
  // THE BOARD IS NOT ASKED ANY MORE: a TOY drawing can only be holding an
  // angle a foot and a right angle can make, because anything else promoted
  // it on the way in. So the lock is the protractor's and the number's.
  const angleLockDeg = () => (angleOn && typedAngle != null
    ? typedAngle : null);
  // ONE LIT AT A TIME: whichever the drafter touched last holds the run.
  const lightInstrument = which => {
    tsquareOn = which === 'tsquare';
    protractorOn = which === 'protractor';
    angleOn = which === 'angle';
  };
  // The point along the locked bearing nearest the hand, either way along it
  // (the protractor folds a bearing to -90..90, so the hand picks the end, as
  // the typed angle always has). `step` rounds the bearing to the nearest
  // multiple of it: a quarter turn for a tool that only draws square, an
  // eighth for the outline on DRAFTING.
  const lockedPoint = (from, at, { step = null } = {}) => {
    const lock = angleLockDeg();
    if (lock == null || !from || !at) return null;
    const deg = step ? Math.round(lock / step) * step : lock;
    const rad = deg * Math.PI / 180;
    const [ux, uz] = step ? eighthTurn(deg) : [Math.cos(rad), -Math.sin(rad)];
    const t = (at.x - from.x) * ux + (at.z - from.z) * uz;
    return { x: from.x + ux * t, y: 0, z: from.z + uz * t };
  };
  // WALL AND LINE ARE ONE GESTURE. Movie, 5 Oct: "make the line act like the
  // WALL everything the same WALL works good". Same presses, same chaining,
  // same instruments and typed boxes; only the record each piece writes
  // differs (commitDrawn).
  const drawsRun = () => activeTool === 'wall' || activeTool === 'line';
  // Where the wall gesture's pointer went down, and whether that press opened
  // the run. Read by the pointerup that places the line; see its comment.
  let wallPress = null;
  const toolListeners = [];
  // ROOF ON A STOREY ASKS WHICH ROOF TO DRAW (Movie, 21 Oct: "when i click
  // on the ROOF command now, nothing really happens, instead, lets make a
  // POPUP"). Any other tool puts a half-drawn one down.
  toolListeners.push(next => {
    if (next !== 'roof') {
      if (roofPickCard) roofPickCard.hidden = true;
      shedRoof = null;
      return;
    }
    if (roofPickCard && storeyHere()) roofPickCard.hidden = false;
  });
  // THE BOARD'S LISTENERS ARE DECLARED HERE, beside the tool's, for one dull
  // reason: `applyBoard` runs at load and the tool column builder is a `const`
  // defined several hundred lines further down, so applyBoard cannot name it
  // without landing in its temporal dead zone. An array declared up here can
  // be filled in later and fired from anywhere.
  const boardListeners = [];

  const setTool = id => {
    const roster = window.DraftToolRoster;
    // An unknown id would silently arm nothing and read as "select is on",
    // which is a broken state that looks like a working one.
    //
    // §6, "no other tools": THE REGISTER ASKS THE SAME FUNCTION THE KEYPAD
    // ASKS. Greying a key is presentation and presentation can be got round --
    // a keyboard shortcut, a restored session, a tool that arms itself when a
    // gesture finishes. Refusing here is what makes the board a rule rather
    // than a look, and it falls back to the resting tool for the same reason
    // an unknown id does: there is no such thing as no tool.
    const next = roster && roster.availableOn(id, board) ? id : RESTING_TOOL;
    activeTool = next;
    // THE BRUSH'S PRESS GOES DOWN AND ITS LOAD STAYS UP. Movie, 20 Sep: "if
    // they change to WALL command and start drawing a wall those 'selected'
    // drafting brush properties will remain". The brush takes pointerdown
    // whole, so a tool armed under it could never be reached -- but clearing
    // what it is holding here would delete the very thing that sentence asks
    // to survive. Two facts, and only one of them is about the tool.
    if (next !== RESTING_TOOL) brushOn = false;
    // Any half-finished gesture belongs to the tool being put down. Carrying an
    // anchor across a tool change is how a chain commits into the next tool's
    // first tap -- and the beam's anchor is a second one of exactly the same
    // kind, so it goes the same way. Leaving it would let a beam started under
    // BEAM finish under COLUMN.
    drawStart = null;
    beamStart = null;
    stretchState = { a: null, b: null, base: null };
    canvas.style.cursor = next === RESTING_TOOL ? '' : 'crosshair';
    // The instrument strip is a third reader of the same fact, added by #398
    // against the boolean this replaced. It reads the register now like
    // everything else does.
    stripRefresh();
    toolListeners.forEach(fn => fn(next));
  };

  // A drawn endpoint snaps to an existing corner exactly as a dragged one
  // does, and for the same reason: landing ON a corner is what makes the join
  // mitre. Nothing is moving during a draw, so nothing is excluded.
  //
  // THE T-SQUARE GOES FIRST AND THE CORNER SNAP MAY ONLY SLIDE ALONG IT. A
  // snap that pulled the run off square would make the instrument a
  // suggestion, and an instrument a drafter cannot trust is worse than no
  // instrument.
  //
  // THIS COMMENT USED TO SAY THAT AND THE CODE DID NOT DO IT. It cited
  // "squareTo's second half"; squareTo has no second half, and cornerSnap was
  // an unrestricted nearest-vertex search. Measured in
  // proto/tsquare-snap-override.js: with the T-square lit, a bait corner
  // 0.06 ft off the axis and inside the 0.129 ft radius pulled the endpoint
  // onto itself -- (0,0) -> (4, 0.06) where squaring gives (4, 0). A comment
  // describing behaviour the code does not have is worse than no comment: it
  // is the reason nobody looked.
  // WHOLE FEET IN TOY, ON THE NUMBER THAT REACHES commitWall. §1 says that in
  // those words, and it is the whole of the difference between a constraint
  // and a display convention: rounding the readout would show 12'-0" over a
  // wall the file records as 12.037, and the drafter would find out later,
  // from a dimension string that disagrees with the plan it measures.
  //
  // MEASURED FROM THE START, NOT ROUNDED IN PLACE. The run's LENGTH is what
  // lands on the foot, so the far end moves to make it so; rounding the
  // endpoint's coordinates instead would give whole-foot positions and a
  // fractional length whenever the start was itself fractional -- which it is,
  // on any drawing that existed before TOY.
  //
  // AND IT ROUNDS AFTER THE SNAP, so a corner the snap legitimately reached is
  // not then nudged off it. A snap that lands on a real corner is the one case
  // where the foot gives way: the corner is where the geometry actually joins.
  // THE FOOT IS ROUNDED FOR TWO REASONS AND THE SWITCH REACHES ONE OF THEM.
  // Read this beside `squaring()` -- same shape, same reason. `||` is what
  // makes the leak impossible in both directions that matter:
  //
  //   TOY cannot be UNROUNDED by the light, because the board arm does not
  //   consult it. §3's gate carries "TOY LEAKS: every board goes through the
  //   constraint path"; a light that could unround TOY is that same defect
  //   wearing the other coat, and the order asks for a check on both.
  //
  //   DRAFTING is not rounded unless the drafter lit it. Off by default, and
  //   a drafter who has never touched it never finds his plan on the grid.
  //
  // AND IT ROUNDS DISTANCE ONLY. onTheFoot takes the run's LENGTH to the
  // nearest foot along the direction the hand gave it; it does not square.
  // The T-SQUARE is a different instrument and this is not a second one.
  const onTheFoot_if = () => board === 'toy' || footOn;

  // `minFeet` IS A DRAWING RULE, NOT A ROUNDING RULE, which is why it is a
  // parameter rather than the constant it used to be. A run being DRAWN is at
  // least a foot long: round it to nothing and the press commits a wall of no
  // length, which the reader drops. A point being DRAGGED has no such floor --
  // a corner nudged four inches with the light lit SHOULD round back to where
  // it started and stay there, and forcing it a whole foot would make the
  // light a thing that moves geometry the hand did not.
  const onTheFoot = (from, pt, minFeet = 1) => {
    if (!from) return pt;
    const dx = pt.x - from.x, dz = pt.z - from.z;
    // One of these is zero under the square, so this is the run's length.
    const len = Math.hypot(dx, dz);
    if (len < 1e-9) return pt;
    const feet = Math.max(minFeet, Math.round(len));
    return { x: from.x + (dx / len) * feet, y: 0, z: from.z + (dz / len) * feet };
  };

  // ── TOY'S 6" GRAIN INSIDE THE HOUSE (Movie, 16 Oct) ──────────────────
  //
  // "this 6" spacing should be based on the 1ft exterior grid ... if the line
  // isn't connected to a CORNER, the GRID used for the interior 6" snap grid
  // will be based on the 1ft exterior house wall corners", and, correcting an
  // earlier wording: "its not measure off inside face - the 6" grid is based
  // on the ext corners of the house (1ft grid)".
  //
  // THE GRID IS THE OUTLINE'S OWN FOOT GRID, HALVED. Its datum is an exterior
  // corner of the house on this level -- every corner of a TOY outline stands
  // a whole foot from every other, so any one of them gives the same grid,
  // and the lowest-left is named so the answer is one answer. Not the inside
  // faces, not a room, not the world origin: a house at 12'-0\u00bd" has its
  // grid at 12'-0\u00bd".
  //
  // A POSITION, NOT A LENGTH. The foot rule (onTheFoot) rounds a run's
  // LENGTH from wherever it started; this lands each POINT on the grid, so a
  // run that starts on an inside face still ends on the grid. It applies only
  // while a house outline exists on the level and the run is inside it: the
  // house being drawn, and anything outside it, keeps the whole foot.
  //
  // THE HARD LINES BEAT THE GRID. "the interior walls allows the connection
  // at the 5.5" corner (usually default) rather than the 6" so it lines up
  // and the stair opening is a similar line-up method which deviates from the
  // 6" grid (in most cases)" -- "the interior walls should be 'cut' at the
  // interior wall line of the exterior wall". Two kinds of line: the INSIDE
  // FACE of every exterior wall, read off its wall type (5\u00bd" for a 2x6, 8"
  // concrete, whatever stands there -- "at the corners the int walls will
  // just move to the req 1/2" for 5.5" wall or whatever in need for the
  // thicker ... or thinner wall"), and every square edge of a floor opening
  // (a stair well, a hole) on the level. A face line runs the width of the
  // house, so a wall running square into the exterior wall ends on it, and a
  // wall continuing the face line past an inside corner lies along it --
  // "so that the interior wall line of the EXT wall is inline with the line
  // of the interior wall so those 2 lines line up".
  //
  // WHY THE FACE MUST WIN, written down: 5\u00bd" and 6" are half an inch apart
  // and indistinguishable by eye. If the grid won, every interior wall meeting
  // an exterior wall would miss the inside face by \u00bd" -- a drawing that looks
  // right and builds wrong. So a hard line takes the point when the hand is
  // within half a grain of it (nearer the line than any other grid point
  // could be), AND when the grid point the hand would otherwise get lies in
  // the band the line owns: for a face, the whole thickness of the exterior
  // wall behind it and an inch past it -- a hand inside the wall's body wants
  // the face, not the wall's line -- and for an opening edge an inch either
  // side. The face owns the grid point beside it either way.
  //
  // THE TOY LIGHT STAYS ON. None of this is a typed number; a 6" position,
  // a face or an opening edge comes from the house's own geometry, not from a
  // precision TOY cannot hold, and nothing here reaches promoteForNumber.
  const GRAIN_OWNS_IN = 1;   // a grid point this close to a hard line is the line's
  const HARD_LINE_REACH_FT = () => window.DraftToyConstraints.HALF_FOOT_FT / 2;
  const toyInteriorGrain = () => {
    if (board !== 'toy' || activeTool !== 'wall') return null;
    const house = houseOutlineOn(activeLevelId());
    const pts = house && house.points;
    if (!pts || pts.length < 3) return null;
    return { pts, datum: {
      x: Math.min(...pts.map(p => Number(p.x))),
      z: Math.min(...pts.map(p => Number(p.z))) } };
  };
  const inHouse = (grain, pt) => window.DraftBuildingBodies.pointInLoop(grain.pts, pt);
  // Every hard line on the level, as { axis, c }: a line of constant x or z.
  const toyHardLines = grain => {
    const G = window.DraftGeometry2D;
    const FG = window.DraftFixtureGeometry;
    const levelId = activeLevelId();
    const lines = [];
    const ring = G.loopSegments(grain.pts);
    (drawing.walls || []).forEach(wall => {
      if (Number(wall.levelId) !== Number(levelId) || (wall.view || 'plan') !== 'plan') return;
      if (!wall.start || !wall.end || !G.edgeOnLoop(wall.start, wall.end, ring)) return;
      const frame = FG && FG.wallFrame(wall);
      if (!frame) return;
      const alongX = Math.abs(frame.uz) < 1e-6, alongZ = Math.abs(frame.ux) < 1e-6;
      if (!alongX && !alongZ) return;
      // WHICH SIDE THE HOUSE IS ON: a probe a foot in along the frame's normal.
      // The body's far edge on that side is the inside face, whichever way the
      // wall was drawn and whatever its reference line.
      const inside = inHouse(grain, frame.at(frame.len / 2, 1));
      const faceAcross = inside ? frame.endOff : frame.startOff;
      const face = frame.at(frame.len / 2, faceAcross);
      const line = frame.at(frame.len / 2, 0);
      const owns = (a, b) => ({ lo: Math.min(a, b) - GRAIN_OWNS_IN / 12, hi: Math.max(a, b) + GRAIN_OWNS_IN / 12 });
      // AWAY is the house's side of the face: +1 or -1 along the line's axis.
      // The frame's normal points to +n; the house is there when the probe
      // landed inside, else on -n.
      const nAlongAxis = alongX ? Math.sign(frame.nz) : Math.sign(frame.nx);
      const away = inside ? nAlongAxis : -nAlongAxis;
      lines.push(alongX ? { axis: 'z', c: face.z, away, kind: 'face', ...owns(face.z, line.z) }
        : { axis: 'x', c: face.x, away, kind: 'face', ...owns(face.x, line.x) });
    });
    (drawing.surfaceOpenings || []).forEach(opening => {
      if (Number(opening.levelId) !== Number(levelId) || opening.hostType !== 'floor') return;
      const op = opening.points || [];
      // AWAY from the hole: the edge seen from the opening's middle.
      const mid = op.reduce((m, p) => ({ x: m.x + p.x / op.length, z: m.z + p.z / op.length }), { x: 0, z: 0 });
      op.forEach((p, i) => {
        const q = op[(i + 1) % op.length];
        const band = (axis, c) => ({ axis, c, kind: 'opening', away: Math.sign(c - mid[axis]) || 1,
          lo: c - GRAIN_OWNS_IN / 12, hi: c + GRAIN_OWNS_IN / 12 });
        if (Math.abs(p.x - q.x) < 1e-6) lines.push(band('x', p.x));
        else if (Math.abs(p.z - q.z) < 1e-6) lines.push(band('z', p.z));
      });
    });
    return lines;
  };
  const toyGrainCoord = (grain, lines, axis, value) => {
    const Q = window.DraftToyConstraints;
    const reach = HARD_LINE_REACH_FT();
    const grid = Q.onGrain(value, Q.HALF_FOOT_FT, axis === 'x' ? grain.datum.x : grain.datum.z);
    let best = null;
    lines.forEach(line => {
      if (line.axis !== axis) return;
      const d = Math.abs(line.c - value);
      const owns = grid >= line.lo - 1e-9 && grid <= line.hi + 1e-9;
      if ((d <= reach || owns) && (!best || d < best.d)) best = { c: line.c, d };
    });
    return best ? best.c : grid;
  };
  // `fixedAxis` is the coordinate the square holds (squaredAxis); it is kept
  // exactly and only the free one lands on the grain.
  const toyGrainPoint = (grain, pt, fixedAxis) => {
    const lines = toyHardLines(grain);
    return {
      x: fixedAxis === 'x' ? pt.x : toyGrainCoord(grain, lines, 'x', pt.x),
      y: 0,
      z: fixedAxis === 'z' ? pt.z : toyGrainCoord(grain, lines, 'z', pt.z),
    };
  };

  // ── ALONG A HARD LINE, THE SIDE IS NOT THE DRAFTER'S TO GET WRONG ──────
  //
  // A wall whose line lies ON an inside face or an opening edge has one side
  // it can stand on: into the room off a face, away from the hole off an
  // opening edge. Put it on the other and the wall sits inside the exterior
  // wall, or hangs over the well. So a run that lies along a hard line is
  // justified by the line, whatever the WALL panel says -- and the panel's
  // pick is left as it was, since the drafter did not change his mind, the
  // geometry answered for him. Asked at commit, from the geometry, not from
  // a note left behind by the snap: the typed-length commit never passes
  // through drawPoint, and a stale note from the preview would be wrong on
  // exactly the run it was not written for.
  //
  // THE SIDE, IN THE RECORD'S TERMS: the body of a 'left' wall lies on +n
  // of the run (n = (-uz, ux)), a 'right' wall's on -n. So the body goes
  // where `away` points: 'left' when away agrees with n, else 'right'.
  const toyJustifyAlongHardLine = (from, to) => {
    const grain = toyInteriorGrain();
    if (!grain || !from || !to) return null;
    const dx = to.x - from.x, dz = to.z - from.z;
    const len = Math.hypot(dx, dz);
    if (len < 1e-9) return null;
    const alongX = Math.abs(dz) < 1e-9, alongZ = Math.abs(dx) < 1e-9;
    if (!alongX && !alongZ) return null;
    const axis = alongX ? 'z' : 'x';
    const line = toyHardLines(grain).find(l => l.axis === axis
      && Math.abs(from[axis] - l.c) < 1e-6 && Math.abs(to[axis] - l.c) < 1e-6);
    if (!line) return null;
    const ux = dx / len, uz = dz / len;
    const nAlongAxis = axis === 'z' ? ux : -uz;    // n = (-uz, ux), read on the line's axis
    return line.away * nAlongAxis > 0 ? 'left' : 'right';
  };

