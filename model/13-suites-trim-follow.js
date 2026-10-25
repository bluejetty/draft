// MODEL.html's page script, part 13 of 17: suites on the boneyard, + CUT, TRIM / EXTEND, the sheet following the cursor, MOVE and DELETE, suite floors, turning the house, undo for a dust.
//
// Stage 2 of the split (Movie, 24 Oct: "how can we reduce the MODEL.html
// size in a nice organized way"): the one script the page carried, cut
// at its own section headings and moved here verbatim, in order. The
// parts load one after another as classic scripts and share one scope,
// as they did inside the page; the indent is the page's, kept so every
// line reads as it did there.

  // ── A SUITE IS STARTED ON THE BONEYARD ────────────────────────────────────
  //
  // Movie, 20 Oct: "both those 'SUITES will be built in the BONE'YARD" --
  // the minus level, "like normal MODEL space" -- "and will be to place as
  // HOLOGRAM in another DRAFT file". Nothing is built: the order opens the
  // boneyard on a drawing that knows it is a suite, and the drafter draws
  // it there, one floor. Its heights are the floor's it is placed on, so it
  // is not charged as a build and does not go through the grow.
  //
  // A SHEET THAT ALREADY HOLDS A DRAWING asks to save and start fresh, NEW's
  // way, keeping the PROJECT page's numbers.
  const suiteLabel = kind => (kind === 'commercial' ? 'COMMERCIAL SUITE' : 'RESIDENTIAL SUITE');
  const startSuite = kind => {
    const begin = () => {
      drawing.suiteKind = window.DraftDrawingFormat.suiteKind(kind);
      goToBoneyard();
      setSign(false);
      chosenEntryId = null;
      chosenSizeId = null;
      openFamilyId = null;
      syncBuildBar();
      markDirty();
      sayOnStrip(`${suiteLabel(kind)} — draw it here on the BONEYARD, one floor. SAVE AS to keep it, `
        + 'then INSERT it as a hologram on a floor of a house .draft.');
    };
    const drawn = (drawing?.walls || []).length > 0 || window.DraftBuildingBodies.hasBuilding(drawing);
    if (!drawn) { begin(); return; }
    askToSave(`This plan already has a drawing. Save it, then start a new ${suiteLabel(kind)}?`, async () => {
      if (!(await adoptAndShow(blankDrawingFile(projectNumbersOf(drawing))))) return;
      begin();
    });
  };
  window.ModelBuild.onOrder(order => {
    if (order?.entry?.suite) startSuite(order.entry.suite);
  });

  // ── THE CUT TOOL: a section line and the way it looks ─────────────────────
  //
  // The parity row said "SECTIONS list -- listed and deletable, not cuttable",
  // and the panel said so out loud: "This page has no cut tool -- sections are
  // cut in LAYOUT." Both are true until this block, and neither is after it.
  //
  // THREE PRESSES, WHICH IS THE OLD PAGE'S GESTURE (MODEL.dc.html:22284):
  // where the cut starts, where it ends, and which side the drafter wants to
  // look from. The third press is the one that carries meaning a plan cannot
  // show -- see geometry-2d.js's cutDirVec, and the harness beside it.
  //
  // NO PHASE VARIABLE. The old page keeps `cutPhase: 'idle'|'placing'|
  // 'choosing'` beside the two points, which is a second fact about the same
  // state and free to disagree with it. Here the points ARE the phase: no
  // start is "place the start", a start alone is "place the end", both is
  // "choose the side". A state that cannot be out of step with itself.
  let cutStart = null;
  let cutEnd = null;

  // ARMED THROUGH THE REGISTER, like every key in the column. Movie, 5 Oct:
  // "can we add the 'CUT' command to the draftng menu and give it LETTER
  // command" -- "ya use C". So CUT is a DRAW / EDIT key with the C its
  // binding always named, and + CUT in the SECTIONS head is the same press.
  // Whichever way it is armed (or put down), the cut's own half-placed
  // points go, so a line started under CUT never finishes under another tool.
  toolListeners.push(next => {
    cutStart = null;
    cutEnd = null;
    if (next === 'cut') sayOnStrip('CUT — press where the section line starts.');
  });
  // ── + CUT TAKES YOU SOMEWHERE YOU CAN CUT ──────────────────────────────
  //
  // Movie, 14 Oct: "i also noticed if i'm on ELEVATION or some others and i
  // press +CUT or the SECTION viewport with +CUT in it, nothing happens, if
  // they user presses either +CUT or command +CUT can you take the user to
  // the MAIN FLOOR PLAN and allow them to make the cut".
  //
  // A CUT IS DRAWN ON A PLAN -- two presses for the ends of the line and a
  // third for the side to look from, all in plan feet. But + CUT can be
  // pressed from ANYWHERE: the SECTIONS head stands in the rail on every
  // view, and an empty S seat offers the same press. On an elevation the tool
  // armed and then had nothing to land on, so the button read as broken --
  // which is the worst kind of nothing, because a drafter cannot tell a dead
  // control from one he has not understood.
  //
  // THE MAIN FLOOR IS WHERE A SECTION IS CUT FROM, which is his answer and
  // the right one: it is the floor carrying the stairs, the openings and the
  // walls a section is usually taken through.
  //
  // UNLESS THE DRAWING HAS NO MAIN FLOOR. A detached garage is drawn on its
  // own levels and may never have one, so the level is only changed when it
  // is really there. Otherwise the VIEW alone is dropped, which still lands
  // the drafter on a plan he can cut -- the one belonging to the level he was
  // already standing on.
  const armCut = () => {
    if (activeCut()) {
      const hasMain = (drawing?.levels || []).some(l => Number(l.id) === MAIN_FLOOR_LEVEL_ID);
      // goToLevel DROPS THE CUT VIEW ITSELF: a cut id is not one of a level's
      // layer views, so arriving anywhere clears `?view=cut:E4` on the way in.
      // That is why this does not clear it by hand as well -- two places
      // setting one parameter is how they come to disagree.
      if (hasMain) goToLevel(MAIN_FLOOR_LEVEL_ID);
      else { params.delete('view'); syncUrl(); buildChrome(); }
    }
    setTool('cut');
    paint();
  };

  // ── LINES AND NOTES ON AN ELEVATION ────────────────────────────────────
  //
  // Movie, 5 Oct: "i'd like to be able to also draw lines and add annotations
  // to the elevations" -- asked how a note should look, "Both": plain text,
  // or with a leader arrow; and on the LAYOUT sheets too.
  //
  // IN THE VIEW'S OWN FEET. cut-view.js hands back its frame on every paint
  // (elevFrame), so a press is read as `u` along the view and `e` the
  // elevation -- the numbers the mark is stored and painted by, whatever the
  // zoom or the sheet scale.
  //
  //   LINE        press, press: a line; it carries on from its end like the
  //               plan's LINE, and Escape puts it down. The T-square holds it
  //               level or plumb.
  //   ANNOTATION  tap where the text goes; or PRESS ON THE THING AND DRAG to
  //               where the text goes, for a leader arrow -- a drag works on
  //               the iPad, where a modifier key would not. Then type it and
  //               press Enter.
  //   SELECT      a tap on a mark holds it; Delete removes it. Undo takes back
  //               either.
  const elevAt = (cx, cy) => (elevFrame ? {
    u: elevFrame.uMin + (cx - elevFrame.x0) / elevFrame.pxPerFt,
    e: elevFrame.yTop - (cy - elevFrame.y0) / elevFrame.pxPerFt,
  } : null);
  const elevPx = p => ({ x: elevFrame.x0 + (p.u - elevFrame.uMin) * elevFrame.pxPerFt,
    y: elevFrame.y0 + (elevFrame.yTop - p.e) * elevFrame.pxPerFt });
  const elevMarks = () => {
    if (!Array.isArray(drawing.elevationMarks)) drawing.elevationMarks = [];
    return drawing.elevationMarks;
  };
  const newMarkId = () => {
    let n = elevMarks().length + 1;
    while (elevMarks().some(m => m.id === `mark-${n}`)) n += 1;
    return `mark-${n}`;
  };
  const addElevMark = mark => {
    elevMarks().push(mark);
    undoStack.push({ kind: 'add-item', list: elevMarks(), item: mark });
    markDirty();
  };
  const squared = (a, b) => {
    if (!tsquareOn) return b;
    return Math.abs(b.u - a.u) >= Math.abs(b.e - a.e) ? { u: b.u, e: a.e } : { u: a.u, e: b.e };
  };
  // The mark under a point on screen, nearest first, within 8 px.
  const elevMarkAt = (cx, cy) => {
    const cut = activeCut();
    if (!cut || !elevFrame) return null;
    let best = null, bestD = 8;
    (drawing.elevationMarks || []).filter(m => m.cut === cut.name).forEach(m => {
      let d = Infinity;
      if (m.kind === 'line') {
        const a = elevPx(m.a), b = elevPx(m.b);
        d = window.DraftGeometry2D.pointToSegment({ x: cx, z: cy },
          { start: { x: a.x, z: a.y }, end: { x: b.x, z: b.y } }).d;
      } else {
        const t = elevPx(m.at);
        const w = Math.max(30, String(m.text || '').length * 7);
        if (cx >= t.x - 4 && cx <= t.x + w && Math.abs(cy - t.y) <= 10) d = 0;
        if (m.tip) {
          const p = elevPx(m.tip);
          d = Math.min(d, window.DraftGeometry2D.pointToSegment({ x: cx, z: cy },
            { start: { x: t.x, z: t.y }, end: { x: p.x, z: p.y } }).d);
        }
      }
      if (d < bestD) { bestD = d; best = m; }
    });
    return best;
  };
  const elevPress = (e, rect) => {
    const cx = e.clientX - rect.left, cy = e.clientY - rect.top;
    const here = elevAt(cx, cy);
    if (!here) return false;
    const cut = activeCut();
    if (activeTool === 'line') {
      if (!elevLineStart) {
        elevLineStart = here;
        elevCursor = here;
        sayOnStrip('LINE on the elevation — press where it ends. Escape to finish.');
        paint();
        return true;
      }
      const end = squared(elevLineStart, here);
      if (Math.hypot(end.u - elevLineStart.u, end.e - elevLineStart.e) < 0.05) return true;
      addElevMark({ id: newMarkId(), cut: cut.name, kind: 'line',
        a: { ...elevLineStart }, b: end });
      elevLineStart = end;
      paint();
      return true;
    }
    if (activeTool === 'annotation') {
      elevNotePress = { at: here, x: e.clientX, y: e.clientY };
      return true;
    }
    if (activeTool === RESTING_TOOL) {
      const hit = elevMarkAt(cx, cy);
      if (!hit) { if (elevSelected) { elevSelected = null; paint(); } return false; }
      elevSelected = hit.id;
      sayOnStrip(hit.kind === 'line' ? 'Line held — Delete removes it.' : 'Note held — Delete removes it.');
      paint();
      return true;
    }
    return false;
  };
  const elevMove = e => {
    const rect = canvas.getBoundingClientRect();
    const here = elevAt(e.clientX - rect.left, e.clientY - rect.top);
    if (!here) return;
    elevCursor = elevLineStart ? squared(elevLineStart, here) : here;
    paint();
  };
  const elevNoteLift = e => {
    const press = elevNotePress;
    elevNotePress = null;
    const rect = canvas.getBoundingClientRect();
    const moved = Math.hypot(e.clientX - press.x, e.clientY - press.y) > 8;
    const lift = elevAt(e.clientX - rect.left, e.clientY - rect.top) || press.at;
    // POINTER'S FIRST TAP is the thing pointed at; the text waits for the next.
    if (notePointer && !moved && !elevPointerTip) {
      elevPointerTip = press.at;
      elevCursor = press.at;
      sayOnStrip('POINTER — now tap where the text goes.');
      paint();
      return;
    }
    // A DRAG IS A LEADER: pressed on the thing, lifted where the text goes.
    // POINTER's second tap is the same thing in two presses.
    const pointed = elevPointerTip;
    elevPointerTip = null;
    const at = pointed ? press.at : (moved ? lift : press.at);
    const tip = pointed || (moved ? press.at : null);
    askNoteText(e.clientX, e.clientY, text => {
      paint();
      if (!text) return;
      addElevMark({ id: newMarkId(), cut: activeCut().name, kind: 'note', at, text,
        ...(tip ? { tip, end: noteEnd } : {}) });
      paint();
    });
  };
  // A small box where the note goes; Enter keeps it, Escape drops it.
  const askNoteText = (clientX, clientY, done) => {
    const box = document.createElement('input');
    box.type = 'text';
    box.dataset.elevNote = '';
    box.placeholder = 'NOTE — Enter to place';
    Object.assign(box.style, { position: 'fixed', left: `${clientX}px`, top: `${clientY - 14}px`,
      zIndex: 50, font: "600 14px 'Barlow Condensed', system-ui, sans-serif",
      padding: '2px 6px', minWidth: '180px' });
    let settled = false;
    const settle = keep => {
      if (settled) return;
      settled = true;
      const text = keep ? box.value.trim().toUpperCase() : '';
      box.remove();
      done(text);
    };
    box.addEventListener('keydown', ev => {
      ev.stopPropagation();
      if (ev.key === 'Enter') { ev.preventDefault(); settle(true); }
      if (ev.key === 'Escape') { ev.preventDefault(); settle(false); }
    });
    box.addEventListener('blur', () => settle(true));
    document.body.appendChild(box);
    // AT ONCE, not on the next tick: the drafter starts typing the moment the
    // box shows, and a key that lands before it has focus goes to the page --
    // where S, C, K and the rest are tool letters.
    box.focus();
  };
  const deleteElevMark = () => {
    const list = elevMarks();
    const index = list.findIndex(m => m.id === elevSelected);
    elevSelected = null;
    if (index < 0) return;
    const [item] = list.splice(index, 1);
    undoStack.push({ kind: 'remove-item', list, index, item });
    markDirty();
    paint();
  };
  toolListeners.push(next => {
    elevLineStart = null;
    elevNotePress = null;
    elevPointerTip = null;
    if (drawing && activeCut()) {
      if (next === 'line') sayOnStrip('LINE on the elevation — press where it starts.');
      if (next === 'annotation') sayOnStrip('NOTE — tap where the text goes, or press on the thing and drag to the text for a pointer. POINTER in the panel: tap the thing, then the text.');
    }
  });

  // ── TRIM AND EXTEND, THE AUTOCAD WAY ────────────────────────────────────
  //
  // Movie, 17 Oct, after the two-press TRIM would not take his exterior wall:
  // "id like to be able to select both items and them seltec the TRIM or
  // press the TRIM command and then select the part i want to cut (i'd select
  // the int wall on the side i want to cut off) or if i had selected 2 lines
  // it would use all suraces for cutting except the one i select the part i
  // select gets the cut ... is gone" -- "cuts on either side if there is
  // another selected line crossing over". And EXTEND, which had a key and no
  // gesture: "extend the end to another selected lin" -- "if the int wall is
  // 2 ft from the ext wall i select both that int wall an that ext wall and
  // then click the int wall at the end closest to the ext wall and it will
  // extend to attach to the wall".
  //
  // THE CUTTING EDGES ARE THE SELECTION, every wall and line in it but the
  // one pressed; with nothing selected, every wall and line on the level.
  // ONE PRESS: TRIM takes away the piece under it, between the nearest
  // crossing on each side (or to the segment's end); EXTEND runs the nearer
  // end on to the nearest edge ahead of it. SHIFT swaps the two for that
  // press -- "could trim and extend operate at the same time" -- because one
  // tool guessing which was meant would sometimes delete a wall the drafter
  // wanted. Both stay armed; each press is one UNDO; Escape puts them down.
  //
  // A CUT STOPS AT A WALL'S FACE, not its stored line (trim-extend.js says
  // why): an exterior wall's line is its outside face, and the old TRIM ran a
  // partition through the wall to it. Near the other wall's own end the two
  // still make a CORNER, both ends on one pooled point where their stored
  // lines meet, which mitres -- the old TRIM's rule, kept.
  //
  // A DOOR OR WINDOW ON A PIECE TAKEN AWAY slides on to what is left if it
  // fits, and is deleted if it does not (Movie: "move the doors and windows
  // in on the wall if they fit, if there comes too many doors and windows
  // widthwise, delete them"). The strip names what went.
  const TRIM_CORNER_FT = 1.5;
  // SHIFT, HELD, for the preview: the press reads its own event.
  let trimShift = false;
  window.addEventListener('keydown', e => {
    if (e.key === 'Shift' && !trimShift) { trimShift = true; if (activeTool === 'trim' || activeTool === 'extend') paint(); }
  });
  window.addEventListener('keyup', e => {
    if (e.key === 'Shift' && trimShift) { trimShift = false; if (activeTool === 'trim' || activeTool === 'extend') paint(); }
  });
  toolListeners.push(next => {
    if (next !== 'trim' && next !== 'extend') return;
    const edges = trimCuttersPicked().length;
    const from = edges ? `the ${edges} selected` : 'every wall and line';
    sayOnStrip(next === 'trim'
      ? `TRIM — press the piece to take away; it cuts at ${from}. Shift+press extends.`
      : `EXTEND — press near the end to run on; it runs to ${from}. Shift+press trims.`);
  });
  const trimLines = () => new Set(lines());
  // THE SELECTED WALLS AND LINES ON THIS LEVEL -- the cutting edges, when
  // there are any.
  const trimCuttersPicked = () => {
    const here = new Set([...walls(), ...lines()]);
    return selection.filter(e => (e.type === 'wall' || e.type === 'line') && here.has(e.item)).map(e => e.item);
  };
  const trimThickness = () => {
    const isLine = trimLines();
    const wallFt = openingThicknessFt();
    return seg => (isLine.has(seg) ? 0 : wallFt(seg));
  };
  // THE SEGMENT UNDER THE PRESS, BY ITS BODY. wallAt measures to the stored
  // line, and an exterior wall's line is its outside face -- so a press in
  // the middle of a thick wall, zoomed in, missed it. A press anywhere on a
  // wall's body takes the wall; a line still takes the grab band either side.
  const trimSegAt = at => {
    const TE = window.DraftTrimExtend;
    const thick = trimThickness();
    const grab = SELECT_GRAB_PX / view.scale;
    let best = null;
    [...walls(), ...lines()].forEach(seg => {
      if (!seg.start || !seg.end) return;
      const dx = seg.end.x - seg.start.x, dz = seg.end.z - seg.start.z;
      const len = Math.hypot(dx, dz);
      if (len < 1e-6) return;
      const t = ((at.x - seg.start.x) * dx + (at.z - seg.start.z) * dz) / (len * len);
      if (t * len < -grab || (t - 1) * len > grab) return;
      const across = ((at.x - seg.start.x) * -dz + (at.z - seg.start.z) * dx) / len;
      const [lo, hi] = TE.faceOffsets(seg, thick(seg));
      const off = across < lo ? lo - across : across > hi ? across - hi : 0;
      if (off > grab || (best && off >= best.off)) return;
      best = { seg, off, t: Math.max(0, Math.min(1, t)) };
    });
    return best;
  };
  const trimPointAt = (seg, t) => ({
    x: seg.start.x + (seg.end.x - seg.start.x) * t,
    z: seg.start.z + (seg.end.z - seg.start.z) * t,
  });
  // WHAT A PRESS HERE WOULD DO, asked by the press and by the preview alike so
  // the two cannot disagree. null, or { seg, mode, ... } with a `why` when
  // there is nothing to do.
  const trimPlan = (at, mode) => {
    const TE = window.DraftTrimExtend;
    const hit = trimSegAt(at);
    if (!hit) return null;
    const seg = hit.seg;
    const thick = trimThickness();
    const picked = trimCuttersPicked().filter(c => c !== seg);
    const cutters = picked.length ? picked : [...walls(), ...lines()].filter(c => c !== seg);
    // EXTEND REACHES A LITTLE FURTHER: to an edge whose own end stops short
    // of the line by up to TRIM_CORNER_FT, the two meeting in a corner there
    // -- the L that does not quite close, which is what extending is for.
    const reachFt = mode === 'extend' ? TRIM_CORNER_FT : thick(seg) / 2 + 1e-3;
    const spans = TE.spans(seg, cutters, { thicknessFt: thick, reachFt });
    if (mode === 'trim') {
      const piece = TE.trimPiece(spans, hit.t);
      return piece ? { seg, mode, ...piece } : { seg, mode, why: 'nothing crosses it there' };
    }
    const end = hit.t < 0.5 ? 'start' : 'end';
    const to = TE.extendTo(spans, end);
    return to ? { seg, mode, end, t: to.t, cutter: to.cutter } : { seg, mode, end, why: 'nothing ahead of that end' };
  };
  // A CORNER, NOT A TEE, where the meeting point is within TRIM_CORNER_FT of
  // the other segment's own end (or past it): both ends go to where the two
  // stored lines meet, one pooled point, and the join mitres. Same kind only
  // -- a wall does not corner with a line.
  const trimCornerWith = (seg, cutter) => {
    if (!cutter || trimLines().has(seg) !== trimLines().has(cutter)) return null;
    const r = { x: seg.end.x - seg.start.x, z: seg.end.z - seg.start.z };
    const q = { x: cutter.end.x - cutter.start.x, z: cutter.end.z - cutter.start.z };
    const den = r.x * q.z - r.z * q.x;
    if (Math.abs(den) < 1e-9) return null;
    const w = { x: cutter.start.x - seg.start.x, z: cutter.start.z - seg.start.z };
    const u = (w.x * r.z - w.z * r.x) / den;
    const lenQ = Math.hypot(q.x, q.z);
    const toEnd = Math.min(Math.abs(u), Math.abs(1 - u)) * lenQ;
    if (!(u <= 0 || u >= 1 || toEnd <= TRIM_CORNER_FT)) return null;
    const t = (w.x * q.z - w.z * q.x) / den;
    return { at: trimPointAt(seg, t), cutterEnd: u < 0.5 ? 'start' : 'end' };
  };
  // One end of a wall or line on to a point: a corner of its own from the
  // pool (the old one may be shared), and the openings measured from a start
  // that moved take the move with them.
  const trimMoveEnd = (seg, end, to, changes) => {
    const G = window.DraftGeometry2D;
    const was = seg[end];
    if (Math.abs(was.x - to.x) < 1e-9 && Math.abs(was.z - to.z) < 1e-9) return;
    const v = G.mergeVertex(vertexPool, { x: to.x, y: was.y, z: to.z },
      was._draftLevelId, was._draftViewId, was._draftBody || 'house');
    const shifts = [];
    if (end === 'start') {
      const dirx = seg.end.x - was.x, dirz = seg.end.z - was.z;
      const dl = Math.hypot(dirx, dirz) || 1;
      const moved = ((v.x - was.x) * dirx + (v.z - was.z) * dirz) / dl;
      (drawing.fenestrations || []).forEach(o => {
        if (!o || o.wallId !== seg.id) return;
        shifts.push({ opening: o, was: o.offset });
        o.offset = (Number(o.offset) || 0) - moved;
      });
    }
    seg[end] = v;
    changes.push({ wall: seg, end, was, shifts });
  };
  // THE OPENINGS ON A WALL THAT CHANGED LENGTH, put back where they fit. The
  // ones that sat clear of the cut go first and keep their places; the ones
  // the cut took the wall from under follow, nearest the kept wall first, each
  // brought in by the bearing rule (clampOpeningToWall) and kept only if it
  // then overlaps nothing already placed.
  const trimRefitOpenings = (wall, movedIds, edits, removed) => {
    const G = window.DraftGeometry2D;
    const on = (drawing.fenestrations || []).filter(o => o && o.wallId === wall.id);
    const len = Math.hypot(wall.end.x - wall.start.x, wall.end.z - wall.start.z);
    const mid = len / 2;
    on.sort((a, b) => (movedIds.has(a) - movedIds.has(b))
      || (movedIds.has(a) ? Math.abs(a.offset - mid) - Math.abs(b.offset - mid) : 0));
    const placed = [];
    const gone = [];
    on.forEach(o => {
      const w = Number(o.width) || 0;
      const fit = G.clampOpeningToWall(wall, Number(o.offset) || 0, w,
        { walls: walls(), thicknessFt: openingThicknessFt() });
      const lo = fit && fit.offset - w / 2, hi = fit && fit.offset + w / 2;
      if (!fit || placed.some(p => lo < p.hi - 1e-6 && p.lo < hi - 1e-6)) {
        gone.push(o);
        return;
      }
      placed.push({ lo, hi });
      if (Math.abs(fit.offset - o.offset) > 1e-9) {
        if (!edits.has(o)) edits.set(o, { opening: o, offset: o.offset, wallId: o.wallId });
        o.offset = fit.offset;
      }
    });
    gone.forEach(o => {
      const at = drawing.fenestrations.indexOf(o);
      if (at >= 0) drawing.fenestrations.splice(at, 1);
      removed.push({ list: drawing.fenestrations, item: o });
    });
    return gone;
  };
  const trimPress = (at, e, tool) => {
    const mode = (tool === 'extend') !== !!(e && e.shiftKey) ? 'extend' : 'trim';
    const plan = trimPlan(at, mode);
    if (!plan) {
      sayOnStrip(mode === 'trim' ? 'TRIM — press on the piece of a wall or line to take away.'
        : 'EXTEND — press near the end of a wall or line.');
      return;
    }
    if (plan.why) {
      sayOnStrip(mode === 'trim'
        ? 'Nothing crosses it there — press a piece between two edges, or select the edges to cut at.'
        : 'Nothing ahead of that end to run on to — select the wall it should reach.');
      return;
    }
    const seg = plan.seg;
    const isLine = trimLines().has(seg);
    const changes = [], added = [], removed = [];
    const edits = new Map();
    // Snapshot every opening on the wall before anything moves, so UNDO puts
    // each back on the wall and at the offset it had.
    (drawing.fenestrations || []).forEach(o => {
      if (o && o.wallId === seg.id) edits.set(o, { opening: o, offset: o.offset, wallId: o.wallId });
    });
    const len = Math.hypot(seg.end.x - seg.start.x, seg.end.z - seg.start.z);
    const moved = new Set();
    let said;
    if (mode === 'extend') {
      const corner = trimCornerWith(seg, plan.cutter);
      if (corner) {
        trimMoveEnd(seg, plan.end, corner.at, changes);
        trimMoveEnd(plan.cutter, corner.cutterEnd, seg[plan.end], changes);
      } else {
        trimMoveEnd(seg, plan.end, trimPointAt(seg, plan.t), changes);
      }
      said = corner ? 'Extended to a corner.' : 'Extended.';
    } else if (plan.kind === 'middle') {
      // THE MIDDLE GOES, AND THE WALL IS TWO. The far piece is a new record,
      // the same wall in every property, holding the old end's corner; the
      // near piece keeps the record and its id.
      const G = window.DraftGeometry2D;
      const cut2 = trimPointAt(seg, plan.to);
      const list = isLine ? drawing.lines : drawing.walls;
      const ref = seg.end;
      const tail = { ...seg, id: newDrawingItemId(isLine ? 'line' : 'wall'),
        start: G.mergeVertex(vertexPool, { x: cut2.x, y: ref.y, z: cut2.z },
          ref._draftLevelId, ref._draftViewId, ref._draftBody || 'house'),
        end: seg.end };
      list.push(tail);
      added.push({ list, item: tail });
      const fromFt = plan.from * len, toFt = plan.to * len;
      (drawing.fenestrations || []).forEach(o => {
        if (!o || o.wallId !== seg.id) return;
        const c = Number(o.offset) || 0;
        const toTail = c >= toFt || (c > fromFt && c - fromFt >= toFt - c);
        if (c > fromFt && c < toFt) moved.add(o);
        if (toTail) { o.wallId = tail.id; o.offset = c - toFt; }
      });
      trimMoveEnd(seg, 'end', trimPointAt(seg, plan.from), changes);
      said = 'Trimmed out — two pieces left.';
    } else {
      const end = plan.kind === 'start' ? 'start' : 'end';
      const tKeep = plan.kind === 'start' ? plan.to : plan.from;
      const cutter = plan.kind === 'start' ? plan.ahead : plan.behind;
      const fromFt = plan.from * len, toFt = plan.to * len;
      (drawing.fenestrations || []).forEach(o => {
        const c = o && o.wallId === seg.id ? Number(o.offset) || 0 : NaN;
        if (c > fromFt - 1e-9 && c < toFt + 1e-9) moved.add(o);
      });
      // A CORNER ONLY WHEN BOTH ARE ASKED FOR (Movie, 18 Oct: "when i trim i
      // don't want to trim both ends only the one i touch (pink one)" -- "to
      // trim a corner i'd like the user to need to select both ends to trim,
      // if they only select one only trim the one they touch at the location
      // the other line crosses"). The edge it is cut at has to be SELECTED
      // for the two to meet in a corner; otherwise only the pink piece goes
      // and the other runs on through.
      const corner = trimCuttersPicked().includes(cutter) ? trimCornerWith(seg, cutter) : null;
      if (corner) {
        trimMoveEnd(seg, end, corner.at, changes);
        trimMoveEnd(cutter, corner.cutterEnd, seg[end], changes);
      } else {
        trimMoveEnd(seg, end, trimPointAt(seg, tKeep), changes);
      }
      said = corner ? 'Trimmed to a corner.' : 'Trimmed.';
    }
    const gone = isLine ? [] : [
      ...trimRefitOpenings(seg, moved, edits, removed),
      ...added.filter(a => a.list === drawing.walls).flatMap(a => trimRefitOpenings(a.item, moved, edits, removed)),
    ];
    const retired = retirePoolCorners(changes.map(c => c.was));
    if (!changes.length && !added.length) { sayOnStrip('Already there — nothing to change.'); paint(); return; }
    undoStack.push({ kind: 'trim', changes, retired, added, removed,
      openings: [...edits.values()] });
    markDirty();
    const names = gone.map(o => `the ${window.DraftFormatters.formatArchitecturalInches((Number(o.width) || 0) * 12)} `
      + (o.type === 'door' ? 'door' : 'window'));
    sayOnStrip(gone.length
      ? `${said} ${names.join(' and ')} did not fit and ${gone.length > 1 ? 'were' : 'was'} removed.`
      : `${said} Press the next one.`);
    paint();
  };

  const cutPress = at => {
    const here = { x: at.x, z: at.z };
    if (!cutStart) {
      cutStart = here;
      sayOnStrip('Now press the other end of the section line.');
      paint();
      return;
    }
    if (!cutEnd) {
      // THE T-SQUARE HOLDS THE CUT TOO (Movie, 6 Oct: "the T - doesn't work on
      // the CUT line (but i'd like it too) - T-SQUARE 90 degrees"): level or
      // plumb from its first press, the way a wall run is.
      Object.assign(here, squareTo(cutStart, here));
      // THE OLD PAGE'S OWN GUARD, and it is not a nicety: a cut with no length
      // has no perpendicular, so it has no direction to store. Refusing the
      // second press leaves the drafter placing it again rather than making a
      // record that can never say which way it looks.
      if (Math.hypot(here.x - cutStart.x, here.z - cutStart.z) < 0.001) return;
      cutEnd = here;
      sayOnStrip('Now press the side you want the section to look FROM.');
      paint();
      return;
    }
    commitCut(here);
  };

  const commitCut = at => {
    const G = window.DraftGeometry2D;
    const dirVec = G.cutDirVec(cutStart, cutEnd, at);
    if (!dirVec) return;
    if (!Array.isArray(drawing.cuts)) drawing.cuts = [];
    const stored = drawing.cuts;
    // THE ID IS DERIVED FROM THE CUTS THEMSELVES rather than kept in a
    // counter. The old page stores `nextCutId` in the file and then, on load,
    // ignores it in favour of max(1, ...cuts.map(id + 1)) anyway
    // (MODEL.dc.html:5623) -- so the counter is a value the loader already
    // refuses to trust. Deriving it here means the two pages cannot disagree
    // about the next number, and there is no key to leave stale.
    //
    // drawing-format.js reads a cut id with Number.isInteger (:79), so this is
    // the one id on this page that is a NUMBER: newDrawingItemId mints
    // strings, and a string here would be dropped on load without a word.
    const id = Math.max(1, ...stored.map(cut => Number(cut.id) + 1));
    // S1, S2 ... after the standard E1-E4 elevations, taking the first free
    // number rather than the count: deleting S2 of three should let the next
    // cut be S2 again rather than mint an S4 beside an existing one.
    const used = new Set(stored.map(cut => cut.name));
    let n = 1;
    while (used.has(`S${n}`)) n += 1;
    const levelId = activeLevelId();
    const level = (drawing.levels || []).find(lvl => Number(lvl.id) === Number(levelId));
    const cut = {
      id,
      name: `S${n}`,
      startPt: { x: cutStart.x, z: cutStart.z },
      endPt: { x: cutEnd.x, z: cutEnd.z },
      dirVec: { x: dirVec.x, z: dirVec.z },
      // The old page stores `this._drawElev`, which _applyLevelElevation sets
      // to the active level's own elev (:9860). Same number, read from the
      // level rather than from a field that shadows it.
      elev: Number(level?.elev) || 0,
      levelId,
    };
    stored.push(cut);
    // THE EXISTING GENERIC UNDO ENTRY, which captures the LIST as well as the
    // item -- so this needed no new branch. It is also why the push above is
    // in place rather than `drawing.cuts = [...stored, cut]`: a new array
    // would leave undo holding the old one and taking the cut out of a list
    // nothing reads.
    undoStack.push({ kind: 'add-item', list: stored, item: cut });
    cutStart = null;
    cutEnd = null;
    activeTool = RESTING_TOOL;
    sayOnStrip(`${cut.name} cut.`);
    markDirty();
    buildChrome();
    paint();
    return cut;
  };

  // ── the instrument strip ──────────────────────────────────────────────────
  // MODEL.dc.html:1963's bottom panel, rebuilt on this page's terms. Movie,
  // 13 Sep: "we also still need the bottom bar which should look like lights
  // for [an] instrument panel like on the Model.dc.html version. the length
  // T-square, ruler and other stuff are down there we need. and the skin
  // switcher can be there too."
  //
  // FOUR INSTRUMENTS ARE REAL AND SIX ARE DORMANT, and the strip says which
  // is which rather than offering ten buttons where four work. The dormant
  // six hold their seats (see the stylesheet's note on spacing) with a title
  // that names them as unbuilt -- the same refusal as the panel's disabled 3D
  // chair, which is the house rule: a control that lies about what the page
  // can do is worse than a gap.
  const strip = document.getElementById('strip');
  const stripMessage = document.getElementById('strip-message');
  // What the page is SAYING, as against what it is reporting. Cleared by the
  // next press that does something, so a refusal never sits over a gesture
  // that has since succeeded.
  let stripNotice = '';
  // BOTH HALVES GO THROUGH A FUNCTION THAT REPAINTS. Saying it and clearing it
  // are the same operation with different text, and the bug both times was the
  // repaint: first stripRefresh overwrote a notice that had been set, then a
  // notice was cleared and the strip kept showing it because nothing repainted
  // until an unrelated pointermove happened along. A message has two halves --
  // it must appear and it must STOP -- and a bare assignment does neither on
  // its own.
  const sayOnStrip = text => { stripNotice = text; stripRefresh(); };
  const clearNotice = () => { if (stripNotice) sayOnStrip(''); };
  const lenOut = document.getElementById('strip-len');
  const angOut = document.getElementById('strip-ang');
  const protractorOut = document.getElementById('strip-protractor-angle');
  const rulerChip = strip.querySelector('[data-mode-ruler]');
  const tsquareChip = strip.querySelector('[data-mode-tsquare]');
  const protractorChip = strip.querySelector('[data-mode-protractor]');
  const protractorStepChip = strip.querySelector('[data-protractor-step]');
  const angleWord = strip.querySelector('[data-angle-word]');
  const scaleChip = strip.querySelector('[data-mode-scale]');
  const snapChip = strip.querySelector('[data-mode-snap]');
  const trackChip = strip.querySelector('[data-mode-track]');
  // IN THE BOTTOM BAR since 1 Oct, not the top strip -- so asked of the
  // document rather than of the strip.
  const rotateChip = document.querySelector('[data-mode-rotate]');
  const brushChip = strip.querySelector('[data-mode-brush]');
  const brushLoadOut = strip.querySelector('[data-brush-load]');
  const lengthBox = document.getElementById('frozen-length');
  const angleBox = document.getElementById('frozen-angle');

  const F = window.DraftFormatters;
  const feetLabel = ft => F.formatArchitecturalInches(ft * 12);
  // Compass bearing off the +X axis, the reading a protractor gives: 0-180
  // either way rather than 0-360, because a wall drawn left has the same
  // angle as the same wall drawn right and a drafter reading 183° would
  // reasonably think it was out of square.
  const angleLabel = (from, to) => {
    const deg = Math.atan2(-(to.z - from.z), to.x - from.x) * 180 / Math.PI;
    const folded = deg <= -90 ? deg + 180 : (deg > 90 ? deg - 180 : deg);
    return `${folded.toFixed(1)}°`;
  };

  // WHAT THE T-SQUARE ACTUALLY DOES. The longer leg wins, so the run follows
  // the direction the hand is already going rather than jumping axes under
  // the cursor.
  // TOY SQUARES BECAUSE THE BOARD SAYS SO, not because an instrument is up.
  // §1: "Four directions only, +X/-X/+Z/-Z from the start point", and TOY has
  // no instruments for a drafter to switch on -- §6 takes the tools away. So
  // the T-square is one reason to square and the board is another, and a run
  // is held square if EITHER holds.
  //
  // Acceptance #4 is what keeps this honest in the other direction: in
  // DRAFTING with the T-square down, nothing squares and the same gesture
  // commits the same off-axis wall it commits today. TOY must not leak.
  const squaring = () => tsquareOn || board === 'toy';

  const squareTo = (from, at) => {
    if (!squaring() || !from) return at;
    return Math.abs(at.x - from.x) >= Math.abs(at.z - from.z)
      ? { x: at.x, z: from.z } : { x: from.x, z: at.z };
  };

  // WHICH COORDINATE THE SQUARE FIXED, or null when nothing is squaring. The
  // caller needs this and cannot get it by comparing points: a run that is
  // already axis-aligned comes back from squareTo unchanged, and "unchanged"
  // then means both "not squaring" and "squaring, already square".
  const squaredAxis = (from, at) => {
    if (!squaring() || !from) return null;
    return Math.abs(at.x - from.x) >= Math.abs(at.z - from.z) ? 'z' : 'x';
  };

  // The run the instruments are reading: the wall being drawn if there is
  // one, otherwise the ruler's measure. Null when the drafter is doing
  // neither, and the readouts go blank rather than holding a stale number --
  // a length that stays on screen after the gesture ends is the one thing a
  // drafter should never be able to misread.
  const runInHand = () => {
    if (!cursorWorld) return null;
    // drawPoint, NOT squareTo, AND THAT IS A BUG FIX RATHER THAN A TIDY-UP.
    // squareTo only squares; drawPoint is what the commit calls, and in TOY it
    // also lands the run on the whole foot. Reading the cursor through the
    // weaker of the two made the strip say 5.4 ft over a wall that committed
    // at 5. §1: the readout must be "the same number commitWall will receive,
    // not the cursor measured separately -- two readings of one distance
    // drift, and the drafter believes the one he can see." This has been
    // wrong on the TOY board since §1 landed.
    if (drawStart && drawsRun()) return { from: drawStart, to: drawPoint(cursorWorld) };
    // THE OUTLINE READS THE SAME WAY: the edge the next press will put down.
    if (activeTool === 'outline' && outlineCorners.length) {
      return { from: outlineTail(), to: outlinePoint(cursorWorld) };
    }
    // FLOOR AND SHAPE TOO, for the strip's readout only (Movie, 12 Oct: "area
    // and shapes like roof and floor too"): the edge from the last corner to
    // the cursor. Their LENGTH box still takes no typing.
    // AND THE SINGLE SLOPE ROOF'S EDGE IN HAND, which the box can type.
    if (shedRun()) return shedRun();
    const corners = activeTool === 'floor' ? floorCorners : activeTool === 'shape' ? shapeCorners : null;
    if (corners && corners.length) return { from: corners[corners.length - 1], to: loopPoint(cursorWorld) };
    if (rulerFrom) return { from: rulerFrom, to: cursorWorld };
    return null;
  };

  // ── WHEN THE SHEET HAS TO FOLLOW THE CURSOR ──────────────────────────────
  //
  // A HALF-FINISHED GESTURE, ANY OF THEM. Five tools draw a mark that reads
  // the cursor -- the wall's band, the cut's line and arrow, the floor's and
  // the outline's trace, the ruler's measure -- and until now NONE of them
  // tracked it. They were painted, correctly, inside paint(), and paint() is
  // not what runs on a pointermove: the hover branch repaints only when the
  // hovered CORNER changes, which is a deliberate rule with its own note and a
  // real reason -- *"a pointermove fires on every pixel and this branch is the
  // page's hot path"*. So all five previews were frozen at whatever the last
  // unrelated repaint had left, and Movie found the one where that shows
  // worst: a live length beside the cursor with no line under it, because the
  // label is DOM and syncDrawLength DOES run on every move.
  //
  // SO THE HOT-PATH RULE STANDS AND GAINS AN EXCEPTION, rather than being
  // dropped. A repaint per move while a gesture is in hand is what a drag
  // already costs here -- the pan does it, the corner drag does it, the
  // opening slide does it -- and a wall in hand is the same kind of moment.
  // What the rule protects is the OTHER case, a drafter sweeping the sheet
  // hunting for a handle, and that is untouched: no gesture in hand, no
  // repaint.
  //
  // NAMED ONCE, FOR ALL FIVE, because it is the same gate. `drawStart &&
  // activeTool === 'wall'` would be the same amount of code and would leave
  // the other four frozen -- which is how this survived four tools that had a
  // band before the wall did.
  const previewTracksCursor = () => (drawsRun() && !!drawStart)
    || (activeTool === 'cut' && !!cutStart)
    || (activeTool === 'floor' && floorCorners.length > 0)
    || (activeTool === 'shape' && shapeCorners.length > 0)
    || (activeTool === 'roof' && !!shedRoof)
    || (activeTool === 'outline' && outlineCorners.length > 0)
    // The house's rays light under the cursor before the garage's first corner.
    || (activeTool === 'outline' && outlineGarage && !!tracedOrder && traceStillThere(tracedHouse))
    || (rulerOn && !!rulerFrom)
    || (activeTool === 'fixture' && (!!washroomPreset || !!kitchenPreset))
    // DIMENSION from its first point too: the node it will lock to lights up.
    || activeTool === 'dimension'
    // STRETCH's box follows the cursor from its first corner, and the ghost
    // from the base point.
    || (activeTool === 'stretch' && !!stretchState.a);

  // THE LENGTH ON THE DRAWING, beside the one on the strip. Both read
  // runInHand, so both read what commitWall will receive -- §1 asks for the
  // on-screen number and the committed number to be ASSERTED EQUAL, and the
  // only way to keep that true is for there to be one number.
  //
  // PLACEMENT IS THE WHOLE DIFFERENCE BETWEEN THE TWO POINTERS. §1: "by the
  // cursor on PC, clear of the finger on touch". On a touch screen the thing
  // being read is exactly the thing the hand is covering, so it goes well
  // above the contact point and centred on it; a mouse has nothing to hide
  // behind it, so it sits low and to the right where a cursor label belongs.
  const drawLenEl = document.getElementById('draw-len');
  let pointerScreen = null;
  const syncDrawLength = () => {
    if (!drawLenEl) return;
    const run = drawsRun() && drawStart ? runInHand() : null;
    if (!run || !pointerScreen) { drawLenEl.hidden = true; return; }
    drawLenEl.hidden = false;
    drawLenEl.textContent =
      feetLabel(Math.hypot(run.to.x - run.from.x, run.to.z - run.from.z));
    const touch = pointerScreen.type === 'touch';
    drawLenEl.style.left = `${pointerScreen.x + (touch ? 0 : 14)}px`;
    drawLenEl.style.top = `${pointerScreen.y + (touch ? -54 : 16)}px`;
    drawLenEl.style.transform = touch ? 'translateX(-50%)' : 'none';
  };

  // FOUR READS OF `drawArmed` BECAME READS OF THE REGISTER. #398 wrote this
  // strip against the armed boolean; the tool register replaced that boolean
  // with a tool id, and the merge that brought the two together was clean --
  // the strip and the column live in different parts of the file. The same
  // shape as deleteLevel's `setArmed(false)` earlier today, from the other
  // side: git has nothing to say when one branch deletes a name another branch
  // starts using.
  // THE LENGTH HINT COMES UP WITH THE FIRST POINT AND GOES WITH THE NEXT.
  // Up on the refresh that first finds a line in hand; down on the next press
  // on the sheet (that press is the second point), on the first key typed into
  // the box, or when the line is put down. A chain of walls shows it once.
  const lengthHint = document.getElementById('length-hint');
  // TURNED OFF FOR GOOD from its own checkbox, kept in this browser like the
  // TRACE switch: a reading habit of the drafter's, not a fact of the drawing.
  const LENGTH_HINT_OFF_KEY = 'draft.lengthHint.off';
  const lengthHintOff = () => {
    try { return localStorage.getItem(LENGTH_HINT_OFF_KEY) === '1'; } catch { return false; }
  };
  lengthHint?.querySelector('[data-length-hint-off]')?.addEventListener('change', e => {
    try { localStorage.setItem(LENGTH_HINT_OFF_KEY, e.target.checked ? '1' : '0'); } catch { /* private mode */ }
    if (e.target.checked) lengthHint.hidden = true;
  });
  let hintWasLive = false;
  const placeLengthHint = () => {
    const box = lengthBox.getBoundingClientRect();
    lengthHint.style.left = `${box.left + box.width / 2}px`;
    lengthHint.style.top = `${box.bottom + 12}px`;
  };
  const syncLengthHint = live => {
    if (!lengthHint) return;
    if (live && !hintWasLive && !lengthHintOff()) { lengthHint.hidden = false; placeLengthHint(); }
    if (!live) lengthHint.hidden = true;
    hintWasLive = live;
  };
  const dropLengthHint = () => { if (lengthHint) lengthHint.hidden = true; };
  canvas.addEventListener('pointerdown', dropLengthHint, true);
  lengthBox.addEventListener('keydown', dropLengthHint);
  window.addEventListener('resize', () => { if (lengthHint && !lengthHint.hidden) placeLengthHint(); });

  function stripRefresh() {
    syncNorthHands();
    const run = runInHand();
    const dist = run ? Math.hypot(run.to.x - run.from.x, run.to.z - run.from.z) : null;
    lenOut.textContent = dist === null ? '' : feetLabel(dist);
    angOut.textContent = run ? angleLabel(run.from, run.to) : '';
    protractorOut.textContent = run ? angleLabel(run.from, run.to) : '—';
    rulerChip.classList.toggle('lit', rulerOn);
    tsquareChip.classList.toggle('lit', tsquareOn);
    // THE BOARD IS NOT ASKED (Movie, 15 Oct). The chip was dark on TOY because
    // the instrument was refused there; it is offered now, and a chip that
    // took the press and stayed dark would be the worst of both.
    protractorChip.classList.toggle('lit', protractorOn);
    if (protractorStepChip) {
      protractorStepChip.textContent = `${protractorStep}°`;
      protractorStepChip.classList.toggle('lit', protractorOn);
    }
    angleWord?.classList.toggle('lit', angleOn);
    angleWord?.setAttribute('aria-pressed', String(angleOn));
    angleBox.classList.toggle('locked', angleLockDeg() != null);
    scaleChip.classList.toggle('lit', footOn);
    snapChip?.classList.toggle('lit', snapOn);
    trackChip?.classList.toggle('lit', trackOn);
    snapChip?.setAttribute('aria-pressed', String(snapOn));
    trackChip?.setAttribute('aria-pressed', String(trackOn));
    // LIT MEANS LOADED, not merely armed, and that is the whole reason this
    // tool needs no mode indicator anywhere else: an armed-but-empty brush
    // does nothing to the drawing, and a loaded one says what it will do.
    brushChip.classList.toggle('lit', !!brushLoad);
    brushChip.classList.toggle('armed', brushOn);
    applyBrushCursor();
    const said = brushSays();
    brushLoadOut.textContent = said.short;
    brushChip.title = brushLoad
      ? `DRAFTING BRUSH — holding ${said.long}. Press another of the same kind `
        + 'to give them to it. Escape puts it down.'
      : 'DRAFTING BRUSH — press a thing to pick its properties up, then press '
        + 'another of the same kind to give them to it';
    // THE LENGTH BOX IS LIVE ONLY WHILE A WALL IS IN HAND, because that is
    // the only moment a typed length has an anchor and a direction to be
    // measured along. Enabled at any other time it would take a number and
    // have nowhere to put it.
    // AND AFTER A MOVE, for the distance it went (moveTyped); and with one
    // dimension selected, for its length (driveDimension).
    const moveReady = moveTypedReady();
    // STRETCH from its base point: the box reads how far the cursor pulls.
    const stretchReady = !moveReady && stretchTypable();
    const dimReady = !moveReady && !stretchReady && dimTypedReady();
    const moveTypable = moveReady || dimReady || stretchReady;
    const typable = !!(((drawsRun() && drawStart)
      || (activeTool === 'outline' && outlineCorners.length)) && cursorWorld) || moveTypable
      || !!shedRun();
    if (lengthBox.disabled === typable) {
      lengthBox.disabled = !typable;
      if (!typable) lengthBox.value = '';
    }
    // THE ANGLE BOX TAKES A NUMBER WHENEVER A RUN TOOL IS UP, run in hand or
    // not: typing it commits nothing now, it is kept for the protractor
    // (commitTypedAngle). Not on TOY, which has no instruments. While a
    // number is kept the box shows it; otherwise it reads the run, as before.
    // TYPABLE ON TOY TOO, since 15 Oct. It was shut there because TOY squares
    // everything and a box that took 37 and ignored it is a lie -- but the
    // answer now is that 37 is taken and MOVES THE BOARD, which is the
    // drafter's own instruction. A box he cannot type in is the "they all go
    // dim" he was complaining about.
    const angleTypable = drawsRun() || activeTool === 'outline';
    if (angleBox.disabled === angleTypable) {
      angleBox.disabled = !angleTypable;
      if (!angleTypable) angleBox.value = '';
    }
    if (angleTypable && document.activeElement !== angleBox) {
      angleBox.value = typedAngle != null ? `${typedAngle}°`
        : (run && typable ? angleLabel(run.from, run.to) : '');
    }
    // While the drafter is typing, the box is his; the live length would
    // overwrite the digits mid-word.
    // THE BOX GLOWS ORANGE WHILE A LINE IS IN HAND (Movie, 12 Oct: "brighten
    // up the LENGTH BOX so the users attention is brought to it ... make it
    // orange ... around the outside, but leave the inner part darker so the
    // white number text can easily be seen"): every run, the outline's edges,
    // and the floor's and shape's -- whatever is being drawn whose length
    // changes as the hand moves.
    const cornerEdge = (activeTool === 'floor' && floorCorners.length > 0)
      || (activeTool === 'shape' && shapeCorners.length > 0);
    const live = !!cursorWorld && (typable || cornerEdge);
    syncLengthHint(live);
    lengthBox.classList.toggle('live', live);
    if (live && document.activeElement !== lengthBox) {
      lengthBox.value = dist === null ? '' : feetLabel(dist);
    } else if (!live && !typable && lengthBox.value) {
      lengthBox.value = '';
    }
    if (dimReady && document.activeElement !== lengthBox) {
      const dim = selection[0].item;
      lengthBox.value = feetLabel(Math.hypot(dim.end.x - dim.start.x, dim.end.z - dim.start.z));
    } else if (stretchReady && document.activeElement !== lengthBox) {
      const to = stretchDestination(cursorWorld);
      lengthBox.value = feetLabel(Math.hypot(to.x - stretchState.base.x, to.z - stretchState.base.z));
    } else if (moveReady && document.activeElement !== lengthBox) {
      lengthBox.value = feetLabel(moveTyped.opening
        ? Math.abs(moveTyped.opening.offset - moveTyped.was)
        : Math.hypot(moveTyped.dx, moveTyped.dz));
    }
    // A NOTICE OUTLIVES ONE REFRESH, and it has to. Both the refusal and the
    // cancel wrote straight to stripMessage and were erased microseconds later
    // by this line -- the page said the true thing and then said the routine
    // thing over the top of it, which on screen is the page saying nothing.
    // Found by the check asserting the message was VISIBLE rather than that
    // the code had set it, which is the difference between the two halves of
    // every failure today.
    stripMessage.textContent = stripNotice || (rulerOn
      ? (rulerFrom ? 'ruler — second point' : 'ruler — first point')
      : (drawsRun() ? `${activeTool} — ${drawStart ? 'second point · double-click, ENTER or SPACE twice, or ESC ends the run' : 'first point'}`
        + (angleLockDeg() != null ? ` · ANGLE LOCKED ${angleLockDeg()}°` : '')
        : (activeTool === 'outline'
          ? (outlineCorners.length ? 'outline — next corner' : 'outline — first corner') : '')));
    // Last, and from here rather than from the pointer handlers, so the label
    // goes out the moment the run does -- every path that ends a run already
    // calls stripRefresh, and a length still on screen after the gesture is
    // over is the one thing a drafter should never be able to misread.
    syncDrawLength();
  }

  const rulerPress = at => {
    if (!rulerFrom) { rulerFrom = { x: at.x, z: at.z }; }
    else { rulerFrom = null; }
    cursorWorld = at;
    stripRefresh();
    paint();
  };

  rulerChip.addEventListener('click', () => {
    rulerOn = !rulerOn;
    rulerFrom = null;
    canvas.style.cursor = rulerOn ? 'crosshair' : (drawsRun() ? 'crosshair' : '');
    stripRefresh();
    paint();
  });
  tsquareChip.addEventListener('click', () => {
    // ONE INSTRUMENT HOLDS THE RUN AT A TIME: "when the protractor is lit
    // the T square should be UNLIT", and the other way round -- and the ANGLE.
    lightInstrument(tsquareOn ? null : 'tsquare');
    clearNotice();
    stripRefresh();
    paint();
  });
  protractorChip.addEventListener('click', () => {
    // NO LONGER REFUSED ON TOY (Movie, 15 Oct); it turns nothing there, where
    // every run is square already. Lit, it holds the run to its steps.
    lightInstrument(protractorOn ? null : 'protractor');
    if (protractorOn) sayOnStrip(`PROTRACTOR lit — the run turns in ${protractorStep}° steps; press ${protractorStep}° to change it`);
    else clearNotice();
    stripRefresh();
    paint();
  });
  // 45 OR 30, AND THE PRESS LIGHTS THE PROTRACTOR: changing its step is
  // asking to draw with it.
  protractorStepChip?.addEventListener('click', () => {
    protractorStep = protractorStep === 45 ? 30 : 45;
    keepLight('protractorStep', protractorStep);
    lightInstrument('protractor');
    sayOnStrip(`PROTRACTOR lit — the run turns in ${protractorStep}° steps`);
    stripRefresh();
    paint();
  });
  // THE ANGLE WORD: lit, the run holds the typed angle. With nothing typed
  // yet it asks for one.
  angleWord?.addEventListener('click', () => {
    lightInstrument(angleOn ? null : 'angle');
    if (angleOn && typedAngle == null) {
      sayOnStrip('ANGLE lit — type an angle (0 east, 90 north) and press Enter');
      if (!angleBox.disabled) angleBox.focus();
    } else if (angleOn) sayOnStrip(`ANGLE LOCKED ${typedAngle}°`);
    else clearNotice();
    stripRefresh();
    paint();
  });

  // THE SAME CONTROL AS THE T-SQUARE, with one line more: the store. The
  // order says to follow that neighbour exactly, and this does -- toggle,
  // refresh, paint -- but the T-SQUARE keeps nothing across a reload and
  // acceptance 3 requires that this does.
  // SNAP AND TRACK: on and off, kept beside the 1' light.
  const keepLight = (key, on) => {
    try {
      const keep = JSON.parse(localStorage.getItem(SKIN_KEY) || '{}');
      localStorage.setItem(SKIN_KEY, JSON.stringify({ ...keep, [key]: on }));
    } catch { /* a browser refusing storage still gets the light, for this tab */ }
  };
  snapChip?.addEventListener('click', () => {
    snapOn = !snapOn; keepLight('snapLight', snapOn);
    sayOnStrip(`SNAP ${snapOn ? 'on — a point near a node lands on it' : 'off'}`);
    stripRefresh(); paint();
  });
  trackChip?.addEventListener('click', () => {
    trackOn = !trackOn; keepLight('trackLight', trackOn);
    sayOnStrip(`TRACK ${trackOn ? 'on — the cross lines square to a node, and a point near one lands on it' : 'off'}`);
    stripRefresh(); paint();
  });
  scaleChip.addEventListener('click', () => {
    footOn = !footOn;
    try {
      const keep = JSON.parse(localStorage.getItem(SKIN_KEY) || '{}');
      localStorage.setItem(SKIN_KEY, JSON.stringify({ ...keep, footLight: footOn }));
    } catch { /* a browser refusing storage still gets the light, for this tab */ }
    stripRefresh();
    paint();
  });

  // ── TRACE: A PHOTO OR A PDF UNDER THE PLAN ────────────────────────────────
  //
  // Movie, 7 Oct: "make it an INSTRUMENT PANEL. when you press it it turn ON
  // and if there is images already loaded it will show them, click it again
  // and it turns off the images turn off. when it is turned on, popup should
  // ask the user if they would like to upload another image" -- and "the
  // previous version model.dc.html could scale PDF plans if there was info",
  // "also can do that identify line length scal for non pdf stuff".
  //
  // THE INSERT IS MODEL.dc.html's, through the same pdf-scan.js: what the
  // file is, the scale printed on the page (picked up, or typed), a width for
  // a photo, and CALIBRATE -- two clicks on a line you know and its real
  // length. The binary goes to the shared store's 'underlays' bucket and the
  // drawing keeps the placement, so either page draws what the other placed.
  const traceChip = strip.querySelector('[data-mode-trace]');
  const traceAsk = document.getElementById('trace-ask');
  const traceCard = document.getElementById('trace-insert');
  const traceFile = document.querySelector('[data-trace-file]');
  const tq = sel => traceCard.querySelector(sel);
  const TRACE_OPACITY = 0.4;
  let traceScan = null;      // the file being inspected (pdf-scan's record)
  let traceDropAt = null;    // where a dropped file was let go, in feet (23 Oct)
  let tracePage = 1;
  let traceCalOn = false;

  const traceLevelName = () => {
    const level = (drawing?.levels || []).find(l => Number(l.id) === activeLevelId());
    return level ? levelLabel(level.id, level.name) : 'this level';
  };
  const setTraceChip = () => {
    if (!traceChip) return;
    traceChip.classList.toggle('lit', traceOn);
    traceChip.setAttribute('aria-pressed', traceOn ? 'true' : 'false');
  };
  setTraceChip();
  const setTraceOn = on => {
    traceOn = on;
    try { localStorage.setItem('draft.trace.on', on ? '1' : '0'); } catch { /* this tab only */ }
    setTraceChip();
    if (on) loadUnderlayImages();
    paint();
    updateReadout();
  };
  const dropTraceScan = () => {
    if (traceScan?.previewUrl) URL.revokeObjectURL(traceScan.previewUrl);
    if (traceScan?.pdfDoc) traceScan.pdfDoc.destroy().catch(() => {});
    traceScan = null;
  };
  const closeTraceCard = () => { dropTraceScan(); traceCard.hidden = true; paint(); };

  // THE CARD, redrawn from the scan record whenever anything on it changes.
  const traceHasScale = () => Boolean(traceScan?.kind === 'pdf' && traceScan.selectedScale && traceScan.pageDims);
  const showTraceCard = (status = '') => {
    traceCard.hidden = false;
    tq('[data-trace-level]').textContent = traceLevelName();
    tq('[data-trace-status]').textContent = status;
    const ready = Boolean(traceScan && !status);
    tq('[data-trace-body]').hidden = !ready;
    tq('[data-trace-go]').hidden = !ready;
    // A DXF ASKS ONCE, HERE (Movie, 9 Oct): locked to trace over, or the
    // drafter's own lines to edit. Changing that later is a fresh load.
    const isDxf = traceScan?.kind === 'dxf';
    tq('[data-trace-go]').textContent = isDxf ? 'NON-EDITABLE' : 'INSERT';
    tq('[data-trace-editable]').hidden = !ready || !isDxf;
    tq('[data-trace-other]').hidden = !traceScan && !status;
    if (!ready) return;
    const scan = traceScan;
    tq('[data-trace-preview]').src = scan.previewUrl;
    tq('[data-trace-verdict]').textContent = scan.kind === 'dxf'
      ? 'DXF \u2014 ITS OWN LINES, FULL SIZE'
      : scan.kind === 'pdf'
        ? (scan.isVector ? 'PDF \u2014 DRAWN LINES, KEPT AS THE PDF' : 'PDF \u2014 A SCANNED PAGE, KEPT AS AN IMAGE')
        : 'PHOTO / IMAGE';
    tq('[data-trace-pages]').hidden = !(scan.kind === 'pdf' && scan.pageCount > 1);
    tq('[data-trace-page]').textContent = `${tracePage} / ${scan.pageCount || 1}`;
    // SCALE: the ones printed on the page as chips, the pick in the box. A
    // photo has no paper to be at a scale, so it gets a WIDTH instead.
    tq('[data-trace-scale-row]').hidden = scan.kind !== 'pdf';
    const found = scan.kind === 'pdf' ? (scan.scalesByPage[tracePage] || []) : [];
    const chips = tq('[data-trace-scales]');
    chips.textContent = '';
    found.forEach(scale => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.textContent = scale.raw;
      chip.dataset.traceScaleChip = '';
      chip.setAttribute('aria-pressed', scan.selectedScale?.raw === scale.raw ? 'true' : 'false');
      chip.addEventListener('click', () => {
        scan.selectedScale = scale;
        tq('[data-trace-scale]').value = scale.raw;
        tq('[data-trace-scale-error]').textContent = '';
        showTraceCard();
      });
      chips.appendChild(chip);
    });
    tq('[data-trace-width-row]').hidden = traceHasScale() || scan.kind === 'dxf';
    // A DXF IS FULL SIZE: no scale, no width, no CALIBRATE -- only which
    // unit its numbers are in, read off the file when it says.
    tq('[data-trace-calibrate]').hidden = scan.kind === 'dxf';
    tq('[data-trace-units-row]').hidden = scan.kind !== 'dxf';
    if (scan.kind === 'dxf') {
      const unitBox = tq('[data-trace-units]');
      unitBox.textContent = '';
      Object.entries(window.DraftDxfReader.UNITS).forEach(([key, unit]) => {
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.textContent = unit.label;
        chip.dataset.traceUnit = key;
        chip.setAttribute('aria-pressed', scan.dxfUnits === key ? 'true' : 'false');
        chip.addEventListener('click', () => { scan.dxfUnits = key; showTraceCard(); });
        unitBox.appendChild(chip);
      });
      const size = traceDxfSize(scan);
      const said = scan.geo.units ? 'the file says so' : 'the file does not say \u2014 check the size';
      const ftIn = feet => F.formatArchitecturalInches(feet * 12);
      tq('[data-trace-size]').textContent = `${ftIn(size.widthFt)} \u00d7 ${ftIn(size.heightFt)} (${said}). `
        + `${scan.geo.layers.length} layer${scan.geo.layers.length === 1 ? '' : 's'}.`;
      // THE LAYERS, picked before either button: what is lit comes in, as
      // lines to trace over or as lines to edit.
      const layerBox = tq('[data-trace-card-layers]');
      layerBox.textContent = '';
      scan.geo.layers.filter(l => l.count > 0).forEach(layer => {
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.textContent = layer.name;
        chip.dataset.traceCardLayer = layer.name;
        const shown = !scan.hiddenLayers.includes(layer.name);
        chip.setAttribute('aria-pressed', shown ? 'true' : 'false');
        chip.title = `${layer.count} piece${layer.count === 1 ? '' : 's'}`;
        chip.addEventListener('click', () => {
          scan.hiddenLayers = shown ? [...scan.hiddenLayers, layer.name]
            : scan.hiddenLayers.filter(n => n !== layer.name);
          scan.previewUrl = traceDxfPreview(scan.geo, scan.hiddenLayers);
          showTraceCard();
        });
        layerBox.appendChild(chip);
      });
      const textBox = tq('[data-trace-card-text]');
      textBox.textContent = '';
      textBox.appendChild(traceTextList(scan.geo));
    }
    tq('[data-trace-calibrate]').setAttribute('aria-pressed', traceCalOn ? 'true' : 'false');
    tq('[data-trace-cal]').hidden = !traceCalOn;
    const marks = scan.calMarks || [];
    tq('[data-trace-cal-hint]').textContent = marks.length < 2
      ? 'Click the two ends of a line you know on the picture \u2014 a dimensioned wall, a door, a scale bar.'
      : 'Now type the real length between the two marks and press APPLY.';
    const markBox = tq('[data-trace-marks]');
    markBox.textContent = '';
    if (traceCalOn) {
      marks.forEach(mark => {
        const dot = document.createElement('div');
        dot.className = 'trace-mark';
        dot.style.left = `${(mark.fx * 100).toFixed(2)}%`;
        dot.style.top = `${(mark.fy * 100).toFixed(2)}%`;
        markBox.appendChild(dot);
      });
    }
  };

  // A DXF's size on the plan: its box, in the unit picked for it.
  const traceDxfSize = scan => {
    const b = scan.geo.bounds;
    const unitFt = window.DraftDxfReader.UNITS[scan.dxfUnits].ft;
    return {
      widthFt: Math.max(0.01, (b.maxX - b.minX) * unitFt),
      heightFt: Math.max(0.01, (b.maxY - b.minY) * unitFt),
    };
  };
  // The card's picture of a DXF: its lines, fitted, in its own colours, on
  // the preview's white.
  const traceDxfPreview = (geo, hidden = geo.layers.filter(l => l.off).map(l => l.name)) => {
    const canvas = document.createElement('canvas');
    canvas.width = 480; canvas.height = 320;
    const c2 = canvas.getContext('2d');
    const b = geo.bounds;
    const k = Math.min((canvas.width - 16) / Math.max(1e-9, b.maxX - b.minX),
      (canvas.height - 16) / Math.max(1e-9, b.maxY - b.minY));
    const ox = (canvas.width - (b.maxX - b.minX) * k) / 2, oy = (canvas.height - (b.maxY - b.minY) * k) / 2;
    c2.lineWidth = 1;
    geo.paths.forEach(p => {
      if (hidden.includes(p.layer)) return;
      // The preview is on white paper, so the file's "white on black"
      // colour 7 is the day ink here, whatever the page is.
      c2.strokeStyle = p.color || '#1d1f20';
      c2.beginPath();
      for (let i = 0; i < p.pts.length; i += 2) {
        const x = ox + (p.pts[i] - b.minX) * k, y = canvas.height - oy - (p.pts[i + 1] - b.minY) * k;
        if (i === 0) c2.moveTo(x, y); else c2.lineTo(x, y);
      }
      if (p.closed) c2.closePath();
      c2.stroke();
    });
    return canvas.toDataURL('image/png');
  };

  const inspectTraceFile = async file => {
    dropTraceScan();
    traceCalOn = false;
    tracePage = 1;
    tq('[data-trace-scale]').value = '';
    tq('[data-trace-width]').value = '';
    ['[data-trace-scale-error]', '[data-trace-width-error]', '[data-trace-cal-error]']
      .forEach(sel => { tq(sel).textContent = ''; });
    tq('[data-trace-cal-length]').value = '';
    showTraceCard(`READING ${file.name}\u2026`);
    if (/\.dwg$/i.test(file.name)) {
      // THE CONVERTER IS ONE PAGE OVER (Movie, 11 Oct: roughdrafter.com/DXF),
      // a separate program that hands its DXF back here through ?trace=handoff.
      showTraceCard(`${file.name} is a DWG \u2014 turn it into a DXF on the DXF page (DXF/ on this site), then pick that.`);
      return;
    }
    if (/\.dxf$/i.test(file.name)) {
      let geo;
      try {
        geo = window.DraftDxfReader.parse(await file.text());
      } catch (error) {
        showTraceCard(`Could not read ${file.name}: ${error?.message || 'not a DXF this can read'}.`);
        return;
      }
      // Unitless files are mostly architectural ones drawn in inches.
      traceScan = { file, kind: 'dxf', geo, dxfUnits: geo.units || 'in',
        hiddenLayers: geo.layers.filter(l => l.off).map(l => l.name),
        previewUrl: traceDxfPreview(geo), calMarks: [] };
      showTraceCard();
      return;
    }
    const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
    const scan = {
      file, kind: isPdf ? 'pdf' : 'image', pageCount: 1, scalesByPage: {}, selectedScale: null,
      previewUrl: '', pageDims: null, imgWidth: 0, imgHeight: 0, isVector: false,
      tier: '', textChars: 0, convertedBlob: null, pdfDoc: null, calMarks: [],
    };
    try {
      if (isPdf) {
        await ensurePdfJs();
        await window.DraftPdfScan.inspectPdf(scan);
      } else {
        await window.DraftPdfScan.inspectImage(scan);
      }
    } catch (error) {
      showTraceCard(`Could not read ${file.name}: ${error?.message || 'not a file this can trace'}.`);
      return;
    }
    traceScan = scan;
    scan.selectedScale = (scan.scalesByPage[1] || [])[0] || null;
    tq('[data-trace-scale]').value = scan.selectedScale ? scan.selectedScale.raw : '';
    showTraceCard();
  };

  const turnTracePage = async delta => {
    const scan = traceScan;
    if (!scan || scan.kind !== 'pdf') return;
    const page = Math.min(scan.pageCount, Math.max(1, tracePage + delta));
    if (page === tracePage) return;
    showTraceCard(`READING PAGE ${page}\u2026`);
    try {
      await window.DraftPdfScan.inspectPdfPage(scan, page);
    } catch {
      showTraceCard(`Could not read page ${page}.`);
      return;
    }
    tracePage = page;
    scan.calMarks = [];
    scan.selectedScale = (scan.scalesByPage[page] || [])[0] || null;
    tq('[data-trace-scale]').value = scan.selectedScale ? scan.selectedScale.raw : '';
    showTraceCard();
  };

  const insertTrace = async () => {
    const scan = traceScan;
    if (!scan || !drawing) return;
    if (scan.kind === 'dxf') { insertTraceDxf(scan); return; }
    let size;
    if (traceHasScale()) {
      size = window.DraftPdfScan.worldSizeFromScan({ kind: scan.kind, pageDims: scan.pageDims,
        imgWidth: scan.imgWidth, imgHeight: scan.imgHeight, selectedScale: scan.selectedScale, typedWidthFt: 0 });
    } else {
      const typed = tq('[data-trace-width]').value.trim() || `40'`;
      const parsed = F.parseArchitecturalLength(typed);
      if (!parsed.ok || !(parsed.inches > 0)) {
        tq('[data-trace-width-error]').textContent = parsed.ok ? 'The width must be more than zero.' : parsed.error;
        return;
      }
      size = window.DraftPdfScan.worldSizeFromScan({ kind: scan.kind, pageDims: scan.pageDims,
        imgWidth: scan.imgWidth, imgHeight: scan.imgHeight, selectedScale: null, typedWidthFt: parsed.inches / 12 });
    }
    const keepVector = scan.kind === 'pdf' && scan.isVector;
    const id = newDrawingItemId('underlay');
    try {
      await window.SharedFileStore.saveNamedFile(keepVector
        ? new File([scan.file], id, { type: 'application/pdf' })
        : new File([scan.convertedBlob], id, { type: 'image/webp' }), 'underlays');
    } catch {
      showTraceCard('Could not keep the file in this browser\u2019s storage.');
      return;
    }
    const scale = traceHasScale() ? scan.selectedScale : null;
    const underlay = {
      id, levelId: activeLevelId(), kind: keepVector ? 'pdf' : 'image', name: scan.file.name,
      page: scan.kind === 'pdf' ? tracePage : 1,
      // Dropped where the drafter is looking -- or, since 23 Oct, where the
      // hand let the file go on the sheet.
      x: traceDropAt ? traceDropAt.x : view.cx, z: traceDropAt ? traceDropAt.z : view.cz,
      widthFt: size.widthFt, heightFt: size.heightFt,
      opacity: TRACE_OPACITY,
      scaleRaw: scale ? scale.raw : null, scaleRatio: scale ? scale.ratio : null,
      scaleUnit: scale ? scale.unit : null, layer: 'UNDERLAY',
    };
    if (!Array.isArray(drawing.underlays)) drawing.underlays = [];
    underlayImages.set(id, scan.pageCanvas);
    closeTraceCard();
    if (!traceOn) setTraceOn(true);
    addItem(drawing.underlays, underlay);
    updateReadout();
    sayOnStrip(`${underlay.name} is under ${traceLevelName()} to trace over.`);
  };

  // A DXF'S WORDS, TO COPY OUT (Movie, 9 Oct: "can i 'copy' the text from
  // the DXF and past it in my format?"). On the plan they are drawn, so they
  // cannot be selected; here each is plain text with a COPY, once each in
  // the order the file has them, for a room tag, a note, anything typed.
  const copyText = async text => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // No clipboard permission (an older browser, a frame): the old way.
      const area = document.createElement('textarea');
      area.value = text;
      document.body.appendChild(area);
      area.select();
      try { document.execCommand('copy'); } catch { /* nothing more to try */ }
      area.remove();
    }
    sayOnStrip(`Copied \u201c${text.length > 40 ? `${text.slice(0, 40)}\u2026` : text}\u201d.`);
  };
  const traceTextList = geo => {
    const words = [...new Set((geo.texts || []).map(t => t.lines.join(' ').replace(/\s+/g, ' ').trim())
      .filter(Boolean))];
    const box = document.createElement('details');
    box.className = 'trace-text';
    box.dataset.traceText = '';
    const head = document.createElement('summary');
    head.textContent = words.length ? `TEXT IN THE FILE (${words.length}) \u2014 COPY ANY OF IT` : 'NO TEXT IN THE FILE';
    box.appendChild(head);
    if (!words.length) return box;
    const list = document.createElement('div');
    list.className = 'trace-text-list';
    words.forEach(word => {
      const row = document.createElement('div');
      row.className = 'trace-text-row';
      const span = document.createElement('span');
      span.textContent = word;
      const copy = document.createElement('button');
      copy.type = 'button';
      copy.textContent = 'COPY';
      copy.dataset.traceCopy = word;
      copy.addEventListener('click', () => copyText(word));
      row.append(span, copy);
      list.appendChild(row);
    });
    const all = document.createElement('button');
    all.type = 'button';
    all.textContent = 'COPY ALL';
    all.dataset.traceCopyAll = '';
    all.className = 'trace-wide';
    all.addEventListener('click', () => copyText(words.join('\n')));
    box.append(list, all);
    return box;
  };

  // EDITABLE: THE DXF AS THE DRAFTER'S OWN LINES. Every piece on a lit layer
  // becomes a LINE on this level -- arcs as curved lines, cut at 45 degrees
  // so each one bends true -- placed exactly where NON-EDITABLE would have
  // laid it: centred where the drafter is looking, full size, file up.
  // They keep the file's layer names and go in as ONE ASSEMBLY named for
  // the file, so the whole drawing moves as one; UNGROUP to work on single
  // lines. One UNDO takes them all out. The file's text comes in as NOTES
  // in the same assembly, lettered at the file's own height and turn (Movie,
  // 10 Oct); it is on the card to copy as well.
  const TRACE_DXF_ASK_OVER = 5000;
  const insertTraceDxfEditable = async scan => {
    let geo;
    try {
      geo = window.DraftDxfReader.parse(await scan.file.text(), { segments: true });
    } catch (error) {
      showTraceCard(`Could not read ${scan.file.name}: ${error?.message || 'not a DXF this can read'}.`);
      return;
    }
    const hidden = new Set(scan.hiddenLayers);
    const pieces = geo.segments.filter(pc => !hidden.has(pc.layer));
    // THE FILE'S TEXT COMES IN AS NOTES (Movie, 10 Oct), at its own height
    // and turn, so it sits where it sat among the lines and zooms with them.
    const words = (geo.texts || []).filter(t => !hidden.has(t.layer)
      && t.lines.join('').trim() && Number(t.h) > 0);
    if (!pieces.length && !words.length) {
      tq('[data-trace-status]').textContent = 'Every layer with lines on it is off \u2014 light one to bring it in.';
      return;
    }
    // A BIG FILE SAYS SO FIRST: the count, and a second press to go ahead.
    if (pieces.length > TRACE_DXF_ASK_OVER && scan.bigOk !== pieces.length) {
      scan.bigOk = pieces.length;
      tq('[data-trace-status]').textContent = `That is ${pieces.length.toLocaleString()} lines, which can slow `
        + 'the plan \u2014 switch off layers you do not need, or press EDITABLE again to bring them all in.';
      return;
    }
    const b = geo.bounds;
    const unitFt = window.DraftDxfReader.UNITS[scan.dxfUnits].ft;
    const cx = (b.minX + b.maxX) / 2, cy = (b.minY + b.maxY) / 2;
    const at = { x: view.cx, z: view.cz };
    const toWorld = ([x, y]) => ({ x: at.x + (x - cx) * unitFt, z: at.z - (y - cy) * unitFt });
    const { levelId, viewId } = onActiveLevel();
    const lineView = wallHomeView(viewId);
    drawing.lines = drawing.lines || [];
    const made = window.DraftDxfReader.piecesToLines(pieces, toWorld).map(seg => ({
      id: newDrawingItemId('line'),
      start: seg.start, end: seg.end,
      levelId, view: lineView,
      layer: seg.layer,
      importedFrom: scan.file.name,
      ...(seg.bulge ? { bulge: seg.bulge } : {}),
      // THE FILE'S OWN COLOUR, where it gave one (a DXF's lines are coloured
      // by entity or by layer; the reader resolves both).
      ...(window.DraftLineStyles?.colorHex(seg.color) ? { color: window.DraftLineStyles.colorHex(seg.color) } : {}),
    }));
    made.forEach(line => drawing.lines.push(line));
    drawing.notes = drawing.notes || [];
    // A note's id is a whole number (the format insists), after the highest.
    let noteId = drawing.notes.reduce((top, n) => Math.max(top, Number(n.id) || 0), 0);
    const lettered = words.map(t => {
      const p = toWorld([t.x, t.y]);
      return {
        id: (noteId += 1), anchor: p, text: { ...p }, levelId, view: lineView,
        body: t.lines.map(line => line.trimEnd()).join('\n').trim(), end: 'none',
        fill: false, fillOpacity: 0.85, outline: false, bullnose: 0,
        heightFt: t.h * unitFt, rot: Number(t.rot) || 0,
        align: t.align || 'left', baseline: t.baseline || 'alphabetic',
        layer: 'A-ANNO-NOTE',
      };
    });
    lettered.forEach(note => drawing.notes.push(note));
    const items = [...made.map(item => ({ list: drawing.lines, item })),
      ...lettered.map(item => ({ list: drawing.notes, item }))];
    let group = null;
    if (made.length + lettered.length >= 2) {
      const n = nextGroupNumber();
      group = {
        id: `group-${n}`,
        name: scan.file.name.replace(/\.dxf$/i, ''),
        fixed: false,
        stretchBehavior: 'item-geometry',
        members: [...made.map(line => ({ type: 'line', id: line.id })),
          ...lettered.map(note => ({ type: 'note', id: note.id }))],
      };
      drawing.groups = groups();
      drawing.groups.push(group);
      drawing.nextGroupId = 1 + n;
      items.push({ list: drawing.groups, item: group });
    }
    undoStack.push({ kind: 'built', walls: [], outlines: [], list: null, openings: [], items });
    closeTraceCard();
    markDirty();
    if (group) setSelection(itemsOfGroup(group));
    paint();
    updateReadout();
    const notesSaid = lettered.length
      ? ` and ${lettered.length.toLocaleString()} note${lettered.length === 1 ? '' : 's'}` : '';
    sayOnStrip(`${made.length.toLocaleString()} line${made.length === 1 ? '' : 's'}${notesSaid} from ${scan.file.name} on `
      + `${traceLevelName()}${group ? ', as one group \u2014 drag it into place, ASSEMBLY BUST to edit single pieces' : ''}.`);
  };

  // THE DXF IS KEPT AS THE FILE, and drawn from it: its lines are never
  // turned into a picture. It lands centred where the drafter is looking,
  // full size, with the layers the file itself has off left off.
  const insertTraceDxf = async scan => {
    const id = newDrawingItemId('underlay');
    try {
      await window.SharedFileStore.saveNamedFile(new File([scan.file], id, { type: 'application/dxf' }), 'underlays');
    } catch {
      showTraceCard('Could not keep the file in this browser\u2019s storage.');
      return;
    }
    const size = traceDxfSize(scan);
    const underlay = {
      id, levelId: activeLevelId(), kind: 'dxf', name: scan.file.name, page: 1,
      x: view.cx, z: view.cz, widthFt: size.widthFt, heightFt: size.heightFt,
      // Lines one pixel wide want more than a photo's 40%.
      opacity: 0.8,
      scaleRaw: null, scaleRatio: null, scaleUnit: null, layer: 'UNDERLAY',
      dxfUnits: scan.dxfUnits,
      hiddenLayers: [...scan.hiddenLayers],
    };
    if (!Array.isArray(drawing.underlays)) drawing.underlays = [];
    underlayImages.set(id, { dxf: true, ...scan.geo });
    closeTraceCard();
    if (!traceOn) setTraceOn(true);
    addItem(drawing.underlays, underlay);
    updateReadout();
    sayOnStrip(`${underlay.name} is under ${traceLevelName()} at full size \u2014 MOVE it to where it belongs.`);
  };

  if (traceChip) {
    traceChip.addEventListener('click', () => {
      if (!drawing) return;
      if (traceOn) { setTraceOn(false); return; }
      setTraceOn(true);
      // ON ASKS whether to bring in another, naming what is already there.
      openTraceAsk();
    });
  }
  // ── MOVE AND DELETE (Movie, 7 Oct) ──────────────────────────────────────
  //
  // The ask card lists the level's images, each with MOVE and DELETE. MOVE
  // hands the next drag on the plan to that image -- press anywhere, drag,
  // let go -- and Esc puts it back. Both are one UNDO each. DELETE keeps the
  // stored file, so UNDO brings the picture back as it was.
  let traceMoving = null;   // { underlay, from, before }
  // A DXF's LAYERS, one chip each, lit while it shows: a press switches the
  // layer off or on, one UNDO each. Only the layers that draw something.
  const traceLayerChips = underlay => {
    const box = document.createElement('div');
    box.className = 'trace-chips';
    box.dataset.traceLayers = underlay.id;
    const geo = underlayImages.get(underlay.id);
    if (!geo?.dxf) {
      box.textContent = 'Layers show once the file has loaded.';
      return box;
    }
    geo.layers.filter(l => l.count > 0).forEach(layer => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.textContent = layer.name;
      chip.dataset.traceLayer = layer.name;
      const shown = !(underlay.hiddenLayers || []).includes(layer.name);
      chip.setAttribute('aria-pressed', shown ? 'true' : 'false');
      chip.title = `${layer.count} piece${layer.count === 1 ? '' : 's'} \u2014 press to ${shown ? 'hide' : 'show'}`;
      chip.addEventListener('click', () => {
        const before = { ...underlay };
        const was = underlay.hiddenLayers || [];
        underlay.hiddenLayers = shown ? [...was, layer.name] : was.filter(n => n !== layer.name);
        undoStack.push({ kind: 'props', edits: [{ item: underlay, before }] });
        markDirty();
        paint();
        openTraceAsk();
      });
      box.appendChild(chip);
    });
    return box;
  };
  const openTraceAsk = () => {
    const mine = underlays();
    const n = mine.length;
    traceAsk.querySelector('[data-trace-count]').textContent = n
      ? `${n} image${n === 1 ? '' : 's'} on ${traceLevelName()}.`
      : `No images on ${traceLevelName()} yet.`;
    const list = traceAsk.querySelector('[data-trace-list]');
    list.textContent = '';
    mine.forEach(underlay => {
      const row = document.createElement('div');
      row.className = 'trace-row';
      row.dataset.traceRow = underlay.id;
      const name = document.createElement('span');
      name.textContent = underlay.name || underlay.id;
      const move = document.createElement('button');
      move.type = 'button';
      move.textContent = 'MOVE';
      move.dataset.traceMove = underlay.id;
      move.addEventListener('click', () => {
        traceAsk.hidden = true;
        traceMoving = { underlay, from: null, before: null };
        sayOnStrip(`Drag ${underlay.name || 'the image'} to where it belongs \u2014 ROTATE turns it, Esc to leave it.`);
        // Painted now, so the picture glows in hand and ROTATE is in the foot.
        paint();
      });
      const del = document.createElement('button');
      del.type = 'button';
      del.textContent = 'DELETE';
      del.dataset.traceDelete = underlay.id;
      del.addEventListener('click', () => {
        const at = drawing.underlays.indexOf(underlay);
        if (at < 0) return;
        drawing.underlays.splice(at, 1);
        undoStack.push({ kind: 'remove-item', list: drawing.underlays, index: at, item: underlay });
        markDirty();
        paint();
        updateReadout();
        sayOnStrip(`${underlay.name || 'The image'} is off ${traceLevelName()} \u2014 UNDO brings it back.`);
        openTraceAsk();
      });
      // ROTATE (Movie, 18 Oct: "in the photo popup area can we also add
      // 'ROTATE'"): a quarter turn clockwise each press, about its middle.
      const turn = document.createElement('button');
      turn.type = 'button';
      turn.textContent = 'ROTATE';
      turn.dataset.traceRotate = underlay.id;
      turn.title = 'A quarter turn clockwise';
      turn.addEventListener('click', () => {
        if (turnPhoto(underlay, 1)) sayOnStrip(`${underlay.name || 'The image'} turned a quarter. UNDO turns it back.`);
      });
      row.append(name, move, turn, del);
      list.appendChild(row);
      if (underlay.kind === 'dxf') {
        list.appendChild(traceLayerChips(underlay));
        // And its words to copy, once the file has loaded.
        const geo = underlayImages.get(underlay.id);
        if (geo?.dxf) list.appendChild(traceTextList(geo));
      }
    });
    renderHologramList();
    traceAsk.hidden = false;
  };

  // ── HOLOGRAMS ON THE CARD (Movie, 8 Oct) ─────────────────────────────────
  //
  // BRING IN reads a .draft and keeps a COPY of it on this drawing; it lands
  // exactly where its own file has it, so two drawings started on the same
  // gold target line up with nothing to do. MOVE is the image MOVE above
  // (drag, Esc to leave it) with [ and ] turning it 15 degrees a press, 1
  // with Shift; the arrows turn it a quarter. REFRESH picks the newer file
  // and keeps where it sits. Every one of them is one UNDO.
  const hologramFile = document.querySelector('[data-hologram-file]');
  const hologramAsk = document.getElementById('hologram-ask');
  const hologramChip = strip.querySelector('[data-mode-hologram]');
  const closeHologramCards = () => { traceAsk.hidden = true; if (hologramAsk) hologramAsk.hidden = true; setHologramChip(); };
  function setHologramChip() {
    if (!hologramChip) return;
    hologramChip.classList.toggle('lit', holograms().length > 0);
    hologramChip.setAttribute('aria-pressed', hologramAsk && !hologramAsk.hidden ? 'true' : 'false');
  }
  if (hologramChip && hologramAsk) {
    hologramChip.addEventListener('click', () => {
      if (!drawing) return;
      if (!hologramAsk.hidden) { closeHologramCards(); return; }
      traceAsk.hidden = true;
      hologramAsk.hidden = false;
      renderHologramList();
    });
    hologramAsk.querySelector('[data-hologram-close]').addEventListener('click', closeHologramCards);
  }
  // A DOUBLE-CLICK ON A HOLOGRAM OPENS ITS CARD (Movie, 18 Oct: "when a user
  // double clicks on a HOLOGRAM can you bring up this menu for him make it
  // easier"). Only where nothing of this drawing's own is under the pointer,
  // so a double-click on a wall drawn over the hologram is still the wall's.
  // "On" the hologram is within its placed walls' box on this level.
  const hologramUnder = world => holograms().find(holo => {
    if (holo.hidden || !H()) return false;
    const walls = H().placed(holo, (H().parts(holo).existing.walls || [])
      .filter(w => w?.levelId === activeLevelId()));
    const pts = walls.flatMap(w => [w.start, w.end]).filter(p => Number.isFinite(p?.x));
    if (!pts.length) return false;
    const xs = pts.map(p => p.x), zs = pts.map(p => p.z);
    return world.x >= Math.min(...xs) - 0.5 && world.x <= Math.max(...xs) + 0.5
      && world.z >= Math.min(...zs) - 0.5 && world.z <= Math.max(...zs) + 0.5;
  }) || null;
  canvas.addEventListener('dblclick', e => {
    if (!drawing || !hologramAsk || activeTool !== RESTING_TOOL || activeCut()) return;
    const r = canvas.getBoundingClientRect();
    const world = toWorld(e.clientX - r.left, e.clientY - r.top);
    const own = hitAt(world);
    if ((own && own.type !== 'hologram') || !hologramUnder(world)) return;
    e.preventDefault();
    traceAsk.hidden = true;
    hologramAsk.hidden = false;
    renderHologramList();
  });
  let hologramRefreshing = null;   // the hologram REFRESH is replacing
  const hologramNoun = holo => holo.name || 'The hologram';
  const hologramPivot = source => {
    const xs = [], zs = [];
    (Array.isArray(source?.walls) ? source.walls : []).forEach(wall => {
      [wall?.start, wall?.end].forEach(pt => {
        if (Number.isFinite(pt?.x) && Number.isFinite(pt?.z)) { xs.push(pt.x); zs.push(pt.z); }
      });
    });
    if (!xs.length) return { x: 0, z: 0 };
    return { x: (Math.min(...xs) + Math.max(...xs)) / 2, z: (Math.min(...zs) + Math.max(...zs)) / 2 };
  };
  const hologramEdit = (holo, change, message) => {
    // A whole copy, for the same reason as MOVE's: 'props' UNDO keeps only
    // the keys its copy has.
    const before = { ...holo };
    Object.assign(holo, change);
    undoStack.push({ kind: 'props', edits: [{ item: holo, before }] });
    markDirty();
    paint();
    if (message) sayOnStrip(message);
  };
  const turnHologram = (holo, degrees) => {
    const angleDeg = ((((Number(holo.angleDeg) || 0) + degrees) % 360) + 360) % 360;
    hologramEdit(holo, { angleDeg }, `${hologramNoun(holo)} turned to ${Math.round(angleDeg)}\u00b0.`);
  };
  // ── A SUITE FLOOR TO FLOOR (Movie, 18 Oct: "we might want the same suite
  // on different floors" -- "make the ability to copy the suite floor to
  // floor easily and match up") ─────────────────────────────────────────
  //
  // THE FLOORS ARE THE WHOLE STOREYS, lowest first: not the SITE, the ROOF
  // or the FOUNDATION, and not a half level. A suite's own floors land on
  // the shell's in order from the one it is put on, so a two-storey suite
  // put on 2ND FL takes 2ND and 3RD. Where it stands on the plan does not
  // change -- lined up on one floor is lined up on the next.
  const SUITE_NOT_FLOORS = new Set([1, 2, 4, 7, 8]);
  const floorsOf = levels => (Array.isArray(levels) ? levels : [])
    .filter(l => l && !SUITE_NOT_FLOORS.has(Number(l.id)))
    .slice().sort((a, b) => (Number(a.elev) || 0) - (Number(b.elev) || 0));
  // THE SUITE'S FLOORS ARE THE ONES WITH WALLS: a suite file started from
  // the usual template carries an empty 2ND FL, and counting it would make
  // every one-floor suite a two-storey one with no room at the top.
  const suiteFloors = holo => floorsOf(holo.source?.levels).filter(l =>
    (holo.source?.walls || []).some(w => Number(w?.levelId) === Number(l.id)));
  // Which of the shell's floors the suite's lowest floor is on, by index.
  const suiteFloorAt = holo => {
    const own = suiteFloors(holo);
    const shell = floorsOf(drawing?.levels);
    if (!own.length) return -1;
    const first = Number(own[0].id);
    const on = holo.levelMap && Object.prototype.hasOwnProperty.call(holo.levelMap, String(first))
      ? holo.levelMap[String(first)] : first;
    return shell.findIndex(l => Number(l.id) === Number(on));
  };
  // The map that puts the suite's lowest floor on the shell's floor `at`;
  // null when a floor of it would land past the top (or under the bottom).
  const suiteMapFor = (holo, at) => {
    const own = suiteFloors(holo);
    const shell = floorsOf(drawing?.levels);
    if (!own.length || at < 0 || at + own.length > shell.length) return null;
    const map = {};
    own.forEach((l, i) => { map[Number(l.id)] = Number(shell[at + i].id); });
    return map;
  };
  const sameMap = (holo, map) => Object.keys(map).every(k => Number(k) === map[k]);
  // A SUITE DRAWN ON THE BONEYARD COMES IN STANDING ON A FLOOR (Movie, 20
  // Oct: "built in the BONE'YARD" and placed "as HOLOGRAM in another DRAFT
  // file"). Its walls are on a shelf -- a negative level id, which no floor
  // of any drawing carries -- so what it drew there is moved onto its own
  // lowest floor (MAIN FL in the usual template), and from there the
  // hologram's floor mapping puts it on whichever floor of the house it is
  // stood on. Only a file that says it is a suite; anything else parks
  // work on its shelves that is not meant to come with it.
  // AND A DRAWING WITH NOTHING BUT SHELVES -- walls only on the BONEYARD,
  // none on a floor -- is the same thing saved before SAVE AS SUITE existed
  // (Movie, 20 Oct: "i saved the 2BD on the SHELF and when i brought it in as
  // a HOLOGRAM - it loaded it into the SHELF").
  const onlyOnShelves = parsed => {
    const list = Array.isArray(parsed?.walls) ? parsed.walls : [];
    return list.length > 0 && list.every(w => Number(w?.levelId) < 0);
  };
  const suiteOnFloor = parsed => {
    if (!window.DraftDrawingFormat.suiteKind(parsed?.suiteKind) && !onlyOnShelves(parsed)) return parsed;
    const floor = floorsOf(parsed.levels)[0];
    const target = floor ? Number(floor.id) : 3;
    const out = { ...parsed, levels: floor ? parsed.levels
      : [...(Array.isArray(parsed.levels) ? parsed.levels : []), { id: 3, name: 'MAIN FL', elev: 0 }] };
    const KEEP = new Set(['levels', 'holograms', 'boneyardOutlines', 'boneyardShelves']);
    Object.keys(parsed).forEach(key => {
      const list = parsed[key];
      if (KEEP.has(key) || !Array.isArray(list)) return;
      if (!list.some(item => item && Number(item.levelId) < 0)) return;
      out[key] = list.map(item => (item && Number(item.levelId) < 0 ? { ...item, levelId: target } : item));
    });
    return out;
  };
  // A SUITE DROPS ONTO THE REGISTRATION POSITION (Movie, 22 Oct: "once they
  // drop it onto a plan it will drop into the registration position and the
  // user can move it to the correct location they want it in"). Its file's
  // gold target -- cut-marks' siteDatum over its lowest floor, the corner the
  // shelf's target sat on -- lands on this plan's gold target. Only a file
  // saved as a suite: a PHASE plan is drawn on the house's own grid already,
  // and stays where its file has it. The x and z that do it, or null when
  // either target is missing.
  const suiteRegistration = holo => {
    const F = window.DraftDrawingFormat, CM = window.DraftCutMarks, WT = window.DraftWallTypes;
    if (!F.suiteKind(holo?.source?.suiteKind) || !CM?.siteDatum) return null;
    const target = gridDatum();
    const floor = suiteFloors(holo)[0];
    if (!target || !floor) return null;
    const thicknessFt = w => (WT?.WALL_TYPES.find(t => t.id === w.wallType)?.totalIn || 0) / 12;
    const walls = (holo.source.walls || []).filter(w => w && Number(w.levelId) === Number(floor.id))
      .map(w => ({ ...w, levelId: 3 }));
    const own = CM.siteDatum(walls, { turn: holo.source.planTurn || 0, thicknessFt });
    if (!own) return null;
    const at = F.hologramPoint({ ...holo, x: 0, z: 0 }, own);
    return { x: target.x - at.x, z: target.z - at.z };
  };
  const suiteFloorName = holo => {
    const at = suiteFloorAt(holo);
    const l = floorsOf(drawing?.levels)[at];
    return l ? levelLabel(l.id, l.name) : 'no floor here';
  };
  // FLOOR ▲▼: this one to the next floor up or down.
  const moveSuiteFloor = (holo, step) => {
    const at = suiteFloorAt(holo);
    const map = suiteMapFor(holo, (at < 0 ? 0 : at) + step);
    if (!map) { sayOnStrip(`${hologramNoun(holo)} has no floor ${step > 0 ? 'above' : 'below'} to go to in this drawing.`); return; }
    const before = { ...holo };
    if (sameMap(holo, map)) delete holo.levelMap; else holo.levelMap = map;
    undoStack.push({ kind: 'props', edits: [{ item: holo, before }] });
    markDirty();
    paint();
    sayOnStrip(`${hologramNoun(holo)} is on ${suiteFloorName(holo)} \u2014 where it stands on the plan is unchanged.`);
  };
  // COPY ▲▼: another of it on the floor above or below, right over it.
  const copySuiteFloor = (holo, step) => {
    const at = suiteFloorAt(holo);
    const map = suiteMapFor(holo, (at < 0 ? 0 : at) + step);
    if (!map) { sayOnStrip(`There is no floor ${step > 0 ? 'above' : 'below'} ${hologramNoun(holo)} in this drawing to copy it to.`); return; }
    const { demo, levelMap, ...rest } = holo;
    let id = newDrawingItemId('hologram');
    while (holograms().some(h => h.id === id)) id = newDrawingItemId('hologram');
    const copy = { ...rest, id, ...(sameMap(holo, map) ? {} : { levelMap: map }) };
    addItem(drawing.holograms, copy);
    paint();
    sayOnStrip(`A copy of ${hologramNoun(holo)} is on ${suiteFloorName(copy)}, right over this one \u2014 UNDO takes it off.`);
  };
  // ITS DRAWING ON A NEW SHELF: its lowest floor's walls, doors, windows,
  // fixtures and the rest, pasted the way PASTE puts a copy down (fresh ids,
  // each opening on its wall's copy), on a shelf named for the file.
  const editOnShelf = holo => {
    const src = holo?.source;
    if (!drawing || !src) return;
    const floor = floorsOf(src.levels)[0];
    const floorId = floor ? Number(floor.id) : null;
    const TYPE_OF = { walls: 'wall', lines: 'line', floors: 'floor', fenestrations: 'fenestration',
      fixtures: 'fixture', roomTags: 'roomtag', notes: 'note', columns: 'column', beams: 'beam',
      shapes: 'shape', outlines: 'outline' };
    const items = Object.entries(TYPE_OF).flatMap(([key, type]) => (Array.isArray(src[key]) ? src[key] : [])
      .filter(item => item && (floorId == null || Number(item.levelId) === floorId))
      .map(item => ({ type, raw: JSON.parse(JSON.stringify(item)) })));
    if (!items.length) { sayOnStrip(`${hologramNoun(holo)} has nothing on its floor to put on a shelf.`); return; }
    addShelf();
    drawing.boneyardShelves = shelves();
    const shelf = drawing.boneyardShelves.find(sh => Number(sh.id) === activeShelfId());
    if (shelf) shelf.name = String(holo.name || 'SUITE').toUpperCase();
    const was = held;
    held = items;
    pasteHeld();
    held = was;
    buildChrome();
    paint();
    sayOnStrip(`${hologramNoun(holo)} is on the shelf ${shelf?.name || ''} to change. SAVE AS SUITE writes it back out; REFRESH on its card updates every copy.`);
  };
  // THE PICKER IS MADE AT THE PRESS AND NEVER PUT IN THE PAGE: the page's
  // own controls stay the ones the gesture census counts.
  function openShelfSuite() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.draft,.json,application/json';
    input.addEventListener('change', async () => {
      const file = input.files && input.files[0];
      if (!file || !drawing) return;
      const source = await readHologramFile(file);
      if (source) editOnShelf({ name: file.name.replace(/\.[^.]+$/, ''), source });
    });
    input.click();
  }
  const mirrorHologram = holo => {
    const flip = holo.flip !== true;
    hologramEdit(holo, { flip }, flip
      ? `${hologramNoun(holo)} is mirrored \u2014 MIRROR again, or UNDO, turns it back.`
      : `${hologramNoun(holo)} is the right way round again.`);
  };
  // THE LIST IS DRAWN INTO BOTH CARDS -- PHOTO's and the HOLOGRAM chip's
  // own (Movie, 18 Oct: "an area on the MODEL AREA that shows which
  // HOLOGRAMS are loaded ... up by the PHOTO IMAGE loading button").
  // INTO THE ONE THAT IS UP, the other's emptied: two copies of every row
  // would be two of every button.
  function renderHologramList() {
    const into = hologramAsk && !hologramAsk.hidden ? hologramAsk : traceAsk;
    [traceAsk, hologramAsk].forEach(card => {
      if (!card) return;
      if (card === into) renderHologramListInto(card);
      else card.querySelector('[data-hologram-list]').textContent = '';
    });
    setHologramChip();
  }
  // THE LIST FOLLOWS THE PLAN: a hologram picked there lights its row (and
  // brings it into view), and a COPY / PASTE or DELETE there shows in the
  // list -- whenever a card with the list is up.
  selectionWatchers.push(() => {
    const up = (hologramAsk && !hologramAsk.hidden) || (traceAsk && !traceAsk.hidden);
    if (!up) return;
    renderHologramList();
    const litRow = document.querySelector('.hologram-copy[data-lit]');
    if (litRow?.scrollIntoView) litRow.scrollIntoView({ block: 'nearest' });
  });
  // WHICH FILES' INSIDE LISTS ARE OPEN, by file.
  const hologramInsideOpen = new Set();
  // AND THE COPY WHOSE BUTTONS A PRESS LAST USED, kept open while nothing is picked.
  let hologramOpenId = null;
  function renderHologramListInto(card) {
    const all = holograms();
    const suites = all.filter(holo => holo.mode === 'suite').length;
    const clashCount = H()?.clashes ? H().clashes(drawing).length : 0;
    card.querySelector('[data-hologram-count]').textContent = (all.length
      ? `${all.length} hologram${all.length === 1 ? '' : 's'}`
        + (suites ? ` (${suites} SUITE${suites === 1 ? '' : 'S'})` : '')
        + ' \u2014 another drawing shown under this one, never edited here.'
      : 'No hologram. Bring in a .draft to show it here (an existing house, or a SUITE).')
      + (clashCount ? ` \u26a0 ${clashCount} window clash${clashCount === 1 ? '' : 'es'} on the shell walls.` : '');
    const list = card.querySelector('[data-hologram-list]');
    list.textContent = '';
    // THE THREE SWITCHES, once there is a hologram to switch.
    if (all.length) {
      const row = document.createElement('div');
      row.className = 'trace-row hologram-show';
      [['existing', 'EXISTING'], ['demo', 'DEMO'], ['new', 'NEW']].forEach(([key, label]) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.textContent = label;
        b.dataset.hologramView = key;
        b.setAttribute('aria-pressed', hologramShow[key] ? 'true' : 'false');
        b.addEventListener('click', () => { setHologramShow(key, !hologramShow[key]); renderHologramList(); });
        row.appendChild(b);
      });
      list.appendChild(row);
    }
    // ONE CARD PER FILE, A NUMBERED ROW PER COPY (Movie, 20 Oct: "can we do
    // 1 per file (and 1 color per file) and then a list within that of each
    // copy, with a number assigned and when they click it or scroll past it
    // it will light up and its' suite will also light up"). The card wears
    // the file's colour; a row lit is its hologram lit on the plan, and a
    // hologram picked on the plan lights its row.
    const files = new Map();
    all.forEach(holo => {
      const key = H().fileOf(holo);
      if (!files.has(key)) files.set(key, []);
      files.get(key).push(holo);
    });
    files.forEach((copies, key) => {
      const first = copies[0];
      const fileCard = document.createElement('div');
      fileCard.className = 'hologram-file';
      fileCard.dataset.hologramFileCard = key;
      const colour = H().colourOf(first, drawing);
      fileCard.style.setProperty('--holo-ink', colour.ink);
      const head = document.createElement('div');
      head.className = 'trace-row hologram-file-head';
      const swatch = document.createElement('span');
      swatch.dataset.hologramSwatch = colour.ink;
      const name = document.createElement('span');
      name.dataset.hologramName = '';
      // A SUITE FILE SAYS WHICH KIND IT IS, on its card (Movie, 20 Oct).
      const kind = window.DraftDrawingFormat.suiteKind(first.source?.suiteKind);
      name.textContent = kind ? `${suiteLabel(kind)} · ${first.name || first.id}` : (first.name || first.id);
      const count = document.createElement('span');
      count.dataset.hologramCopies = String(copies.length);
      count.textContent = copies.length === 1 ? '1 copy' : `${copies.length} copies`;
      // REFRESH IS THE FILE'S: every copy takes the newer one.
      const refresh = document.createElement('button');
      refresh.type = 'button';
      refresh.textContent = 'REFRESH';
      refresh.dataset.hologramRefresh = first.id;
      refresh.title = 'Pick the newer copy of its .draft; every copy of the same file takes it';
      refresh.addEventListener('click', () => { hologramRefreshing = first; hologramFile.click(); });
      // EDIT ON SHELF (Movie, 20 Oct: "they can also use that area to modify
      // the SUITES for the existing SHELL"): the file's own drawing put on a
      // new shelf here to change, then SAVE AS SUITE and REFRESH.
      const edit = document.createElement('button');
      edit.type = 'button';
      edit.textContent = 'EDIT ON SHELF';
      edit.dataset.hologramEditShelf = first.id;
      edit.title = 'Put a copy of its drawing on a new BONEYARD shelf to change; SAVE AS SUITE, then REFRESH';
      edit.addEventListener('click', () => { closeHologramCards(); editOnShelf(first); });
      head.append(swatch, name, count, edit, refresh);
      fileCard.appendChild(head);
      // ITS OWN HOLOGRAMS, ON AND OFF (Movie, 21 Oct: "a little button to
      // show a list of the HOLOGRAMS within a HOLOGRAM and a checkbox beside
      // all of them and allow the user to turn on and off the other
      // holograms within a file"; "also a button ... where ALL its attached
      // HOLOGRAMS can be NOT SHOWN / SHOWN"). Set on every copy of the file,
      // which share the one drawing.
      const inside = Array.isArray(first.source?.holograms) ? first.source.holograms : [];
      if (inside.length) {
        const offOf = holo => new Set((holo.hiddenInside || []).map(String));
        const setOff = next => {
          const edits = copies.map(holo => ({ item: holo, before: { ...holo } }));
          copies.forEach(holo => { if (next.size) holo.hiddenInside = [...next]; else delete holo.hiddenInside; });
          undoStack.push({ kind: 'props', edits });
          markDirty();
          paint();
          renderHologramList();
        };
        const off = offOf(first);
        const allOff = inside.every(child => off.has(String(child.id)));
        const insideRow = document.createElement('div');
        insideRow.className = 'trace-row hologram-inside-head';
        const open = hologramInsideOpen.has(key);
        const list = document.createElement('button');
        list.type = 'button';
        list.dataset.hologramInside = key;
        list.textContent = `INSIDE (${inside.length - [...off].filter(id => inside.some(c => String(c.id) === id)).length}/${inside.length}) ${open ? '\u25b4' : '\u25be'}`;
        list.title = 'The holograms inside this file: tick to show, untick to hide';
        list.setAttribute('aria-expanded', open ? 'true' : 'false');
        list.addEventListener('click', () => {
          if (hologramInsideOpen.has(key)) hologramInsideOpen.delete(key); else hologramInsideOpen.add(key);
          renderHologramList();
        });
        const every = document.createElement('button');
        every.type = 'button';
        every.dataset.hologramInsideAll = key;
        every.textContent = allOff ? 'SHOW ALL INSIDE' : 'HIDE ALL INSIDE';
        every.addEventListener('click', () => setOff(allOff ? new Set() : new Set(inside.map(c => String(c.id)))));
        insideRow.append(list, every);
        fileCard.appendChild(insideRow);
        if (open) {
          inside.forEach(child => {
            const r = document.createElement('label');
            r.className = 'trace-row hologram-inside';
            r.dataset.hologramInsideRow = String(child.id);
            const tick = document.createElement('input');
            tick.type = 'checkbox';
            tick.checked = !off.has(String(child.id));
            tick.addEventListener('change', () => {
              const next = offOf(first);
              if (tick.checked) next.delete(String(child.id)); else next.add(String(child.id));
              setOff(next);
            });
            const word = document.createElement('span');
            const kindOf = window.DraftDrawingFormat.suiteKind(child.source?.suiteKind);
            word.textContent = kindOf ? `${suiteLabel(kindOf)} \u00b7 ${child.name || child.id}` : (child.name || child.id);
            r.append(tick, word);
            fileCard.appendChild(r);
          });
        }
      }
      copies.forEach((holo, index) => {
      const row = document.createElement('div');
      row.className = 'trace-row hologram-copy';
      row.dataset.hologramRow = holo.id;
      const number = document.createElement('span');
      number.dataset.hologramNumber = String(index + 1);
      number.textContent = `#${index + 1}`;
      const lit = selection.some(entry => entry.type === 'hologram' && entry.item === holo);
      if (lit) row.dataset.lit = '';
      // ITS BUTTONS ONLY WHEN IT IS THE ONE PICKED -- or the only copy there
      // is, which has nothing to be picked from.
      const open = lit || all.length === 1 || (hologramOpenId === holo.id && !selection.some(e => e.type === 'hologram'));
      if (open) row.dataset.hologramOpen = '';
      // WHERE IT STANDS, on the line itself: its floor, and HIDDEN if so.
      const where = document.createElement('span');
      where.dataset.hologramWhere = '';
      where.textContent = [holo.mode === 'suite' ? suiteFloorName(holo) : 'HOLOGRAM', holo.hidden ? 'HIDDEN' : '']
        .filter(Boolean).join(' \u00b7 ');
      // LIT BY A PASS OF THE POINTER (scrolling past it) and PICKED BY A
      // CLICK on the row, which is the same as picking it on the plan.
      row.addEventListener('mouseenter', () => { hologramHover = holo; paint(); });
      row.addEventListener('mouseleave', () => { if (hologramHover === holo) { hologramHover = null; paint(); } });
      row.addEventListener('click', event => {
        if (event.target.closest('button')) return;
        hologramOpenId = holo.id;
        setSelection([{ type: 'hologram', item: holo }]);
        paint();
      });
      const button = (label, key, title, onClick) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.textContent = label;
        b.dataset[key] = holo.id;
        if (title) b.title = title;
        // A PRESS KEEPS ITS BUTTONS OPEN, after a COPY has made it one of
        // several -- without picking it on the plan, which would glow it.
        b.addEventListener('click', event => {
          hologramOpenId = holo.id;
          onClick(event);
        });
        return b;
      };
      const suite = holo.mode === 'suite';
      // HOLOGRAM / SUITE (Movie, 18 Oct): a SUITE is drawn in the normal
      // colours and only ever moved, turned, mirrored, copied or deleted
      // here; its insides are its own .draft's. No DEMO on a suite.
      const mode = button(suite ? 'SUITE' : 'HOLOGRAM', 'hologramMode',
        suite ? 'Drawn in normal colours, its windows cut into the shell walls it lines up with; press for the blue HOLOGRAM'
          : 'Press to make it a SUITE: normal colours, locked, its windows cut into the shell walls it lines up with', () => {
          const next = suite ? null : 'suite';
          const before = { ...holo };
          if (next) holo.mode = next; else delete holo.mode;
          undoStack.push({ kind: 'props', edits: [{ item: holo, before }] });
          markDirty();
          paint();
          sayOnStrip(next ? `${hologramNoun(holo)} is a SUITE \u2014 normal colours, moved and copied whole; edit it in its own file and REFRESH.`
            : `${hologramNoun(holo)} is a blue HOLOGRAM again.`);
          renderHologramList();
        });
      mode.setAttribute('aria-pressed', suite ? 'true' : 'false');
      const tools = document.createElement('div');
      tools.className = 'hologram-tools';
      row.append(number, where);
      if (open) row.append(tools);
      tools.append(mode,
        button(holo.hidden ? 'SHOW' : 'HIDE', 'hologramShow', '', () => {
          hologramEdit(holo, { hidden: !holo.hidden });
          renderHologramList();
        }),
        ...(suite ? [] : [button(hologramDemoCount(holo) ? `DEMO (${hologramDemoCount(holo)})` : 'DEMO', 'hologramDemo',
          'Click its walls, doors, windows and fixtures to mark them coming out', () => {
            closeHologramCards();
            hologramPicking = holo;
            hologramPartMode = false;
            hologramPartStart = null;
            if (!hologramShow.demo) setHologramShow('demo', true);
            sayOnStrip(`Click ${hologramNoun(holo)}'s walls, doors, windows or fixtures to mark them DEMO \u2014 click again to keep one, Esc when done.`);
            paint();
          }),
        button('DEMO PART', 'hologramDemoPart', 'Click two points on one of its walls to cut that piece out', () => {
          closeHologramCards();
          hologramPicking = holo;
          hologramPartMode = true;
          hologramPartStart = null;
          if (!hologramShow.demo) setHologramShow('demo', true);
          sayOnStrip(`Click one end, then the other, of the piece of ${hologramNoun(holo)}'s wall coming out \u2014 click inside a piece to keep it, Esc when done.`);
          paint();
        })]),
        button('MOVE', 'hologramMove', 'Drag it; [ and ] turn it, F mirrors it, Esc leaves it', () => {
          closeHologramCards();
          traceMoving = { underlay: holo, from: null, before: null, hologram: true };
          sayOnStrip(traceMoveWord(traceMoving));
        }),
        // FLOOR and COPY floor to floor, on a SUITE.
        ...(suite ? (() => {
          const floor = document.createElement('span');
          floor.dataset.hologramFloor = holo.id;
          floor.textContent = suiteFloorName(holo);
          return [floor,
            button('FLOOR \u25b2', 'hologramFloorUp', 'Move it to the floor above, where it stands', () => { moveSuiteFloor(holo, 1); renderHologramList(); }),
            button('FLOOR \u25bc', 'hologramFloorDown', 'Move it to the floor below, where it stands', () => { moveSuiteFloor(holo, -1); renderHologramList(); }),
            button('COPY \u25b2', 'hologramCopyUp', 'Another of it on the floor above, lined up over this one', () => { copySuiteFloor(holo, 1); renderHologramList(); }),
            button('COPY \u25bc', 'hologramCopyDown', 'Another of it on the floor below, lined up under this one', () => { copySuiteFloor(holo, -1); renderHologramList(); })];
        })() : []),
        button('\u27f2', 'hologramLeft', 'Turn a quarter to the left', () => { turnHologram(holo, -90); renderHologramList(); }),
        button('\u27f3', 'hologramRight', 'Turn a quarter to the right', () => { turnHologram(holo, 90); renderHologramList(); }),
        // MIRROR (Movie, 17 Oct, placing his suites): the same file turned
        // over across its own axis, so a handed suite is one file, not two.
        button('MIRROR', 'hologramMirror', 'Turn it over across its own axis (F while it is in hand)', () => {
          mirrorHologram(holo);
          renderHologramList();
        }),
        // COPY: another of the same file, in hand to place, the way BRING IN
        // arrives. One suite file, four suites. The copy shares the file's
        // text, so a REFRESH of either refreshes both.
        button('COPY', 'hologramCopy', 'Another of the same file, in hand to place', () => {
          const { demo, ...rest } = holo;
          // An id no hologram on this drawing has: a file brought in from
          // elsewhere may carry ids the counter here has never seen.
          let id = newDrawingItemId('hologram');
          while (holograms().some(h => h.id === id)) id = newDrawingItemId('hologram');
          const copy = { ...rest, id };
          addItem(drawing.holograms, copy);
          closeHologramCards();
          traceMoving = { underlay: copy, from: null, before: null, hologram: true };
          sayOnStrip(`A copy of ${hologramNoun(holo)} is in \u2014 ${traceMoveWord(traceMoving)}`);
          paint();
        }),
        button('DELETE', 'hologramDelete', '', () => {
          const at = drawing.holograms.indexOf(holo);
          if (at < 0) return;
          drawing.holograms.splice(at, 1);
          undoStack.push({ kind: 'remove-item', list: drawing.holograms, index: at, item: holo });
          markDirty();
          paint();
          sayOnStrip(`${hologramNoun(holo)} is gone \u2014 UNDO brings it back.`);
          renderHologramList();
        }));
      fileCard.appendChild(row);
      });
      list.appendChild(fileCard);
    });
  }
  const readHologramFile = async file => {
    const F = window.DraftDrawingFormat;
    let parsed;
    try {
      parsed = JSON.parse(await file.text());
    } catch {
      sayOnStrip(`${file.name} is not a drawing this page can read.`);
      return null;
    }
    const check = F.checkEnvelope(parsed);
    if (!check.ok) {
      sayOnStrip(check.reason === 'version'
        ? `${file.name} was saved by a newer Draft than this page.`
        : `${file.name} is not a drawing this page can read.`);
      return null;
    }
    return suiteOnFloor(parsed);
  };
  hologramFile.addEventListener('change', async () => {
    const file = hologramFile.files && hologramFile.files[0];
    hologramFile.value = '';
    const refreshing = hologramRefreshing;
    hologramRefreshing = null;
    if (!file || !drawing) return;
    const parsed = await readHologramFile(file);
    if (!parsed) return;
    const F = window.DraftDrawingFormat;
    const name = file.name.replace(/\.[^.]+$/, '');
    if (refreshing) {
      const [fresh] = F.holograms([{ ...refreshing, source: parsed }]);
      if (!fresh) return;
      // EVERY COPY OF THE SAME FILE TAKES THE NEWER ONE (Movie, 17 Oct:
      // "change as a block"): the copies are named for the file they came
      // from, so the name is what says they are one block. Each keeps where
      // it sits and what it has marked DEMO; one UNDO takes them all back.
      const copies = holograms().filter(h => h.name === refreshing.name);
      const edits = copies.map(h => {
        const before = { ...h };
        Object.assign(h, { source: fresh.source, name });
        return { item: h, before };
      });
      undoStack.push({ kind: 'props', edits });
      markDirty();
      paint();
      sayOnStrip(copies.length > 1
        ? `${name} is refreshed on all ${copies.length} copies \u2014 each stays where it sat.`
        : `${name} is refreshed \u2014 it stays where it sat.`);
      return;
    }
    if (!bringInHologram(parsed, name)) sayOnStrip(`${file.name} is not a drawing this page can read.`);
  });
  // A PARSED FILE INTO A HOLOGRAM IN HAND -- the upload's own tail, shared
  // since 23 Oct with a shelf square dragged onto the plan. Null when the
  // file is not a drawing.
  const bringInHologram = (parsed, name) => {
    const F = window.DraftDrawingFormat;
    const pivot = hologramPivot(parsed);
    // A NEW FILE TAKES THE FIRST COLOUR NO FILE HERE HAS; the same file
    // brought in again is that file, and wears its colour.
    const sameFile = holograms().some(h => H()?.fileOf(h) === name);
    const [holo] = F.holograms([{ id: newDrawingItemId('hologram'), name, source: parsed,
      x: 0, z: 0, angleDeg: 0, pivotX: pivot.x, pivotZ: pivot.z,
      ...(!sameFile && H()?.nextColour ? { colour: H().nextColour(drawing) } : {}) }]);
    if (!holo) return null;
    // ON THE FLOOR THE DRAFTER IS STANDING ON (Movie, 20 Oct: "can we load
    // them in the CURRENT PLAN LEVEL.. so if i'm in MAIN FLOOR PLAN - it
    // would align into that floor, or 2nd floor --- same thing"). Its lowest
    // floor goes on this one; on the BONEYARD, or with no room above for all
    // its floors, it stands where its own file has it.
    const here = boneyardActive ? -1 : floorsOf(drawing.levels).findIndex(l => Number(l.id) === Number(activeLevelId()));
    const map = here >= 0 ? suiteMapFor(holo, here) : null;
    if (map && !sameMap(holo, map)) holo.levelMap = map;
    const registeredAt = suiteRegistration(holo);
    if (registeredAt) { holo.x = registeredAt.x; holo.z = registeredAt.z; }
    if (!Array.isArray(drawing.holograms)) drawing.holograms = [];
    addItem(drawing.holograms, holo);
    // ── AND IT ARRIVES IN HAND ────────────────────────────────────────────
    //
    // Movie, 14 Oct: "i need a better way to place the hologram too".
    //
    // IT USED TO LAND WHERE ITS OWN FILE HAD IT and say so, which is right
    // about the arithmetic and wrong about the job: the two drawings were set
    // up on different days, so "where its own file has it" is almost never
    // where it belongs on this one. The drafter then had to go and find the
    // card, open it, and press MOVE before they could put it anywhere.
    //
    // SO THE PRESS THAT BRINGS IT IN IS THE PRESS THAT PLACES IT. The same
    // MOVE the card arms, armed here: drag it where it belongs, [ and ] turn
    // it, Esc to leave it where the file had it. The card is still the way
    // back to it later.
    traceAsk.hidden = true;
    // A SUITE COMES IN ON THE REGISTRATION POSITION (see suiteRegistration),
    // still in hand, so the drag starts from there; Esc leaves it on it.
    traceMoving = { underlay: holo, from: null, before: null, hologram: true };
    sayOnStrip(`${name} is in${registeredAt ? ' on the gold target' : ''} \u2014 ${traceMoveWord(traceMoving)}`);
    paint();
    return { holo, registeredAt };
  };
  [traceAsk.querySelector('[data-hologram-upload]'), hologramAsk?.querySelector('[data-hologram-ask-upload]')].forEach(b => b?.addEventListener('click', () => {
    closeHologramCards();
    hologramRefreshing = null;
    hologramFile.click();
  }));
  // ── MARKING DEMO ON THE PLAN ─────────────────────────────────────────────
  //
  // While a hologram is being marked, a press on the plan finds the thing of
  // its under the cursor -- a door or window first, then a fixture, then the
  // wall -- and flips it in or out of DEMO. One UNDO each. Esc stops.
  let hologramPicking = null;
  const hologramDemoCount = holo => window.DraftDrawingFormat.HOLOGRAM_DEMO_KINDS
    .reduce((n, kind) => n + (holo.demo?.[kind]?.length || 0), holo.demo?.pieces?.length || 0);
  // DEMO PART: two clicks on one hologram wall cut out the run between them.
  // A click inside a run already cut puts it back. Feet along the wall from
  // its start, to the inch.
  const hologramWallAt = (holo, world) => {
    const F = window.DraftDrawingFormat;
    const local = F.hologramLocal(holo, world);
    const viewId = activeViewId();
    const source = holo.source || {};
    const shapes = hologramShapes(holo, { walls: source.walls || [], fenestrations: [], fixtures: [] },
      activeLevelId(), HOLOGRAM_VIEWS.has(viewId) ? viewId : 'plan');
    const slack = 6 / view.scale;
    let best = null;
    shapes.forEach(shape => {
      const [a, b] = shape.line;
      const dx = b.x - a.x, dz = b.z - a.z, len = Math.hypot(dx, dz);
      if (!(len > 0)) return;
      const t = Math.max(0, Math.min(1, ((local.x - a.x) * dx + (local.z - a.z) * dz) / (len * len)));
      const off = Math.hypot(local.x - a.x - t * dx, local.z - a.z - t * dz);
      if (off <= shape.reach + slack && (!best || off < best.off)) {
        best = { wallId: shape.id, along: Math.round(t * len * 12) / 12, len, off };
      }
    });
    return best;
  };
  const hologramPartPress = (holo, world) => {
    const hit = hologramWallAt(holo, world);
    if (!hit) { sayOnStrip(`No wall of ${hologramNoun(holo)}'s there \u2014 Esc when done.`); return; }
    const pieces = holo.demo?.pieces || [];
    const inside = pieces.findIndex(p => p.wallId === hit.wallId && hit.along > p.from && hit.along < p.to);
    const withPieces = next => {
      const demo = { ...(holo.demo || {}) };
      if (next.length) demo.pieces = next; else delete demo.pieces;
      return Object.keys(demo).length ? demo : undefined;
    };
    if (!hologramPartStart && inside >= 0) {
      hologramEdit(holo, { demo: withPieces(pieces.filter((p, i) => i !== inside)) },
        'That piece of wall stays \u2014 Esc when done.');
      return;
    }
    if (!hologramPartStart || hologramPartStart.wallId !== hit.wallId) {
      hologramPartStart = { wallId: hit.wallId, along: hit.along, at: world };
      sayOnStrip('Now click the other end of the piece coming out \u2014 on the same wall.');
      paint();
      return;
    }
    const from = Math.min(hologramPartStart.along, hit.along);
    const to = Math.max(hologramPartStart.along, hit.along);
    hologramPartStart = null;
    if (!(to - from > 1e-6)) { sayOnStrip('Click the other end of the piece, not the same spot.'); paint(); return; }
    const F = window.DraftFormatters || {};
    const size = F.formatArchitecturalInches ? F.formatArchitecturalInches((to - from) * 12) : `${(to - from).toFixed(2)}'`;
    hologramEdit(holo, { demo: withPieces([...pieces, { wallId: hit.wallId, from, to }]) },
      `${size} of wall is DEMO \u2014 click another, or Esc when done.`);
  };
  function setHologramShow(key, on) {
    hologramShow[key] = on;
    try { localStorage.setItem(HOLOGRAM_SHOW_KEY, JSON.stringify(hologramShow)); } catch { /* this tab only */ }
    paint();
  }
  const hologramPick = (holo, world) => {
    const F = window.DraftDrawingFormat;
    const local = F.hologramLocal(holo, world);
    const source = holo.source || {};
    const all = { walls: source.walls || [], fenestrations: source.fenestrations || [],
      fixtures: source.fixtures || [] };
    const viewId = activeViewId();
    const shapes = hologramShapes(holo, all, activeLevelId(), HOLOGRAM_VIEWS.has(viewId) ? viewId : 'plan');
    const slack = 6 / view.scale;
    const toSegment = (p, a, b) => {
      const dx = b.x - a.x, dz = b.z - a.z;
      const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / (dx * dx + dz * dz || 1)));
      return Math.hypot(p.x - a.x - t * dx, p.z - a.z - t * dz);
    };
    const inside = (p, pts) => pts.reduce((hit, a, i) => {
      const b = pts[(i + 1) % pts.length];
      return ((a.z > p.z) !== (b.z > p.z)) && (p.x < (b.x - a.x) * (p.z - a.z) / (b.z - a.z) + a.x) ? !hit : hit;
    }, false);
    const hits = shape => (shape.line
      ? toSegment(local, shape.line[0], shape.line[1]) <= shape.reach + slack
      : inside(local, shape.corners));
    return ['fenestrations', 'fixtures', 'walls']
      .map(kind => shapes.find(shape => shape.kind === kind && hits(shape)))
      .find(Boolean) || null;
  };
  const NOUN = { walls: 'wall', fenestrations: 'door or window', fixtures: 'fixture' };
  const toggleHologramDemo = (holo, shape) => {
    const demo = Object.fromEntries(Object.entries(holo.demo || {}).map(([k, v]) => [k, [...v]]));
    const list = demo[shape.kind] || [];
    const at = list.indexOf(shape.id);
    if (at >= 0) list.splice(at, 1); else list.push(shape.id);
    if (list.length) demo[shape.kind] = list; else delete demo[shape.kind];
    hologramEdit(holo, { demo: Object.keys(demo).length ? demo : undefined },
      at >= 0 ? `That ${NOUN[shape.kind]} stays \u2014 Esc when done.`
        : `That ${NOUN[shape.kind]} is DEMO \u2014 dashed, and out of the existing plan. Esc when done.`);
  };
  let swallowPickClick = false;
  window.addEventListener('pointerdown', event => {
    if (!hologramPicking || event.target !== canvas || event.button !== 0) return;
    event.stopImmediatePropagation();
    event.preventDefault();
    swallowPickClick = true;
    const holo = hologramPicking;
    if (!holograms().includes(holo)) { hologramPicking = null; return; }
    if (hologramPartMode) { hologramPartPress(holo, tracePoint(event)); return; }
    const shape = hologramPick(holo, tracePoint(event));
    if (shape) toggleHologramDemo(holo, shape);
    else sayOnStrip(`Nothing of ${hologramNoun(holo)}'s there on this level \u2014 Esc when done.`);
  }, true);
  window.addEventListener('click', event => {
    if (!swallowPickClick) return;
    swallowPickClick = false;
    if (event.target === canvas) { event.stopImmediatePropagation(); event.preventDefault(); }
  }, true);
  window.addEventListener('keydown', event => {
    if (!hologramPicking || event.key !== 'Escape') return;
    event.stopImmediatePropagation();
    hologramPicking = null;
    hologramPartMode = false;
    hologramPartStart = null;
    sayOnStrip('');
    paint();
  }, true);

  // THE WASHROOM IN HAND: [ and ] turn it a quarter, F mirrors it, Esc
  // puts it down. Not while a field has the keys. THE KITCHEN IN HAND takes
  // F and Esc the same way -- the corner it is pressed into sets its turn.
  window.addEventListener('keydown', event => {
    if (activeTool !== 'fixture' || (!washroomPreset && !kitchenPreset)) return;
    if (event.target && /^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName)) return;
    const turn = { BracketLeft: -90, BracketRight: 90 }[event.code];
    if (turn && washroomPreset) washroomTurn = ((washroomTurn + turn) % 360 + 360) % 360;
    else if (turn && kitchenPreset) kitchenTurn = ((kitchenTurn + turn) % 360 + 360) % 360;
    else if (event.code === 'KeyF' && washroomPreset) washroomFlip = !washroomFlip;
    else if (event.code === 'KeyF') kitchenFlip = !kitchenFlip;
    else if (event.key === 'Escape') { washroomPreset = null; kitchenPreset = null; syncFixturePanel(); }
    else return;
    event.stopImmediatePropagation();
    event.preventDefault();
    paint();
  }, true);

  // TURNING WHILE IT IS IN HAND: [ and ] like the neighborhood program, and
  // F turns it over, the way F mirrors a washroom in hand.
  window.addEventListener('keydown', event => {
    // By CODE, not key: Shift turns [ into { on the keyboards this is used on.
    const turn = { BracketLeft: -1, BracketRight: 1 }[event.code];
    const mirror = event.code === 'KeyF';
    if (!traceMoving?.hologram || (!turn && !mirror)) return;
    if (event.target && /^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName)) return;
    event.stopImmediatePropagation();
    event.preventDefault();
    if (mirror) { mirrorHologram(traceMoving.underlay); return; }
    const step = (event.shiftKey ? 1 : 15) * turn;
    turnHologram(traceMoving.underlay, step);
  }, true);
  // THE DRAG. Registered on the window in the capture phase so it runs ahead
  // of every tool's own press, and only while a MOVE is armed.
  const endTraceMove = commit => {
    const m = traceMoving;
    traceMoving = null;
    if (!m) return;
    // A SHELF SQUARE'S SUITE: the drop IS its arrival, so there is no move
    // step over the add -- one UNDO takes it off again -- and an Esc takes
    // it straight back off the sheet rather than leaving it where the drag
    // began.
    if (m.shelfDrop) {
      if (!commit) {
        const at = (drawing?.holograms || []).indexOf(m.underlay);
        if (at >= 0) drawing.holograms.splice(at, 1);
        const top = undoStack[undoStack.length - 1];
        if (top?.kind === 'add-item' && top.item === m.underlay) undoStack.pop();
        markDirty();
      }
      sayOnStrip(commit ? `${hologramNoun(m.underlay)} is down \u2014 UNDO takes it off; its card has MOVE, turn and MIRROR.` : '');
      paint();
      return;
    }
    if (m.before && !commit) Object.assign(m.underlay, m.before);
    if (m.before && commit && (m.before.x !== m.underlay.x || m.before.z !== m.underlay.z)) {
      undoStack.push({ kind: 'props', edits: [{ item: m.underlay, before: m.before }] });
      markDirty();
    }
    sayOnStrip('');
    paint();
  };
  // WHAT THE STRIP SAYS WHILE SOMETHING IS IN HAND. One sentence, said when
  // the mode is armed and again whenever a click leaves it armed -- a mode a
  // drafter cannot see is a mode they will assume is over.
  const traceMoveWord = m => (m?.hologram
    ? `Drag ${hologramNoun(m.underlay)} to where it belongs \u2014 [ and ] turn it, F mirrors it, Esc to leave it.`
    : 'Drag the picture to where it belongs \u2014 Esc to leave it.')
    + (squaring() ? ' The T-SQUARE holds the move to one axis.' : '');
  const tracePoint = event => {
    const r = canvas.getBoundingClientRect();
    return toWorld(event.clientX - r.left, event.clientY - r.top);
  };
  // WHERE THE HAND'S RUN ENDS under the lit instruments: squared first, then
  // on the foot (no floor on the length -- see the pointermove below).
  const traceMovedPoint = (from, at) => {
    const squaredAt = squareTo(from, at);
    return onTheFoot_if() ? onTheFoot(from, squaredAt, 0) : squaredAt;
  };
  window.addEventListener('pointerdown', event => {
    if (!traceMoving || event.target !== canvas || event.button !== 0) return;
    event.stopImmediatePropagation();
    event.preventDefault();
    traceMoving.from = tracePoint(event);
    // A WHOLE COPY, because UNDO's 'props' step restores the record to exactly
    // its copy and drops any key the copy lacks -- an { x, z } here undid a
    // MOVE by deleting the picture's id, level and kind with it.
    traceMoving.before = { ...traceMoving.underlay };
  }, true);
  window.addEventListener('pointermove', event => {
    const m = traceMoving;
    if (!m || !m.from) return;
    event.stopImmediatePropagation();
    const at = tracePoint(event);
    // THE MOVE READS THE SAME INSTRUMENTS AS A DRAWN RUN (Movie, 19 Oct:
    // "when i MOVE the hologram --- when the T SQUARE is engaged it should
    // only move in 90's from its original position"). The drag is a run from
    // the press to the hand: the T-SQUARE holds it to one axis, so the thing
    // in hand goes straight across or straight up from where it stood, and
    // the FOOT LIGHT lands that run on the whole foot -- squareTo then
    // onTheFoot, drawPoint's own order, with no floor on the length, because
    // a nudge of four inches with the light lit should round back to where it
    // started (model-html-point-drag-instruments has the same rule for a
    // dragged corner). TOY lights both, as it does for everything else.
    const to = traceMovedPoint(m.from, at);
    m.underlay.x = m.before.x + (to.x - m.from.x);
    m.underlay.z = m.before.z + (to.z - m.from.z);
    // ITS SUPER NODES CLICK ONTO THE HOUSE'S FIRST (Movie, 20 Oct: "super
    // high power nodes very SNAP Magnetic ... they will attach to the other
    // SUPER NODES"): a suite's super node within a foot of a house super
    // node pulls the suite until the two coincide, and the face slide below
    // is not asked. A blue hologram's are read too, so the strip can say it
    // would have caught had it been a SUITE.
    // EVERY HOLOGRAM'S, blue too (Movie, 23 Oct: "all suites attrached"),
    // and before every other snap: "the corner rings should take priority".
    m.superLock = m.hologram ? superNodeLock(m.underlay, m.superLock) : null;
    if (m.superLock) {
      // AND NOT OFF THE SQUARE, the face slide's own rule below.
      const held = squaredAxis(m.from, at);
      m.underlay.x += held === 'x' ? 0 : m.superLock.dx;
      m.underlay.z += held === 'z' ? 0 : m.superLock.dz;
    }
    // A SUITE SNAPS ONTO THE SHELL (Movie, 18 Oct: "when they go close to
    // lining them up it snaps to make it easy for them"): within 6" of a
    // shell wall's faces lining up with its own, it slides the rest -- when
    // no super node has it.
    if (m.hologram && m.underlay.mode === 'suite' && !m.superLock && H()?.suiteSnap) {
      const slide = H().suiteSnap(drawing, m.underlay, activeLevelId(), 0.5);
      // AND NOT OFF THE SQUARE: with the T-SQUARE down the slide may only
      // take the suite further along the axis the hand is moving on. A slide
      // on the held axis would be the snap moving what the square forbade.
      const held = squaredAxis(m.from, at);
      m.underlay.x += held === 'x' ? 0 : slide.x;
      m.underlay.z += held === 'z' ? 0 : slide.z;
    }
    // A BLUE HOLOGRAM NEVER SNAPS -- only a SUITE does -- so where a suite
    // would have caught, the strip says how to make it one (Movie, 18 Oct:
    // "the suite wall isn't SNAPPING or GLOWING to show they line up ... and
    // the window holes too").
    if (m.hologram && m.underlay.mode !== 'suite' && H()?.suiteNear
      && H().suiteNear(drawing, { ...m.underlay, mode: 'suite' }, activeLevelId(), 0.5).length) {
      sayOnStrip('This hologram is blue, so it does not snap. Set it to SUITE on the HOLOGRAM card: it snaps, its lined-up walls glow, and its windows cut the shell wall.');
    }
    paint();
  }, true);
  // The click the browser sends after the drag is the drag's own, not a
  // press for whatever tool is up -- swallowed once.
  let swallowTraceClick = false;
  // ── A CLICK IS NOT A MOVE, AND MUST NOT END ONE ──────────────────────
  //
  // Movie, 14 Oct: "i need a better way to place the hologram too. and 'MOVE'
  // it later, doesn't seem to be able to move."
  //
  // MEASURED, THREE WAYS. MOVE then drag works; MOVE with a tool armed works;
  // MOVE, a CLICK, then a drag does nothing at all -- and that is the one a
  // drafter actually does, because a press-and-release on the spot is how
  // anyone checks that a mode took. The press armed the drag, the release
  // ended it having moved nothing, and the mode was over before the real drag
  // started. Nothing said so: the strip had already been cleared.
  //
  // SO A RELEASE THAT MOVED NOTHING PUTS THE DRAG DOWN AND KEEPS THE MODE.
  // Only a release that actually moved the thing commits and finishes; Escape
  // still leaves, as it always did, and the strip says so again.
  const TRACE_MOVE_MIN_FT = 0.01;
  window.addEventListener('pointerup', event => {
    if (!traceMoving || !traceMoving.from) return;
    event.stopImmediatePropagation();
    swallowTraceClick = true;
    const m = traceMoving;
    const moved = m.before && (Math.abs(m.underlay.x - m.before.x) > TRACE_MOVE_MIN_FT
      || Math.abs(m.underlay.z - m.before.z) > TRACE_MOVE_MIN_FT);
    if (moved) { endTraceMove(true); return; }
    m.from = null;
    m.before = null;
    sayOnStrip(traceMoveWord(m));
  }, true);
  window.addEventListener('click', event => {
    if (!swallowTraceClick) return;
    swallowTraceClick = false;
    if (event.target === canvas) { event.stopImmediatePropagation(); event.preventDefault(); }
  }, true);
  window.addEventListener('keydown', event => {
    if (traceMoving && event.key === 'Escape') {
      event.stopImmediatePropagation();
      endTraceMove(false);
    }
  }, true);

  // Closed through paint(), which is what shows UNDO again once no card is up.
  traceAsk.querySelector('[data-trace-later]').addEventListener('click', () => { traceAsk.hidden = true; paint(); });
  traceAsk.querySelector('[data-trace-upload]').addEventListener('click', () => {
    traceAsk.hidden = true;
    traceFile.click();
  });
  traceFile.addEventListener('change', () => {
    const file = traceFile.files && traceFile.files[0];
    traceFile.value = '';
    traceDropAt = null;
    if (file) inspectTraceFile(file);
  });
  // ── A FILE DROPPED ON THE SHEET (Movie, 23 Oct) ───────────────────────
  //
  // "if a user is in their file with pdfs or image and want to DRAG and DROP
  // on onto the model space area, can we allow them to bring it in as a
  // background image/pdf?" The drop is the picker's press: the file the hand
  // lets go of over the sheet goes to inspectTraceFile, which asks the scale
  // and inserts it under the level the way BRING IN does -- and it lands
  // centred where it was let go (traceDropAt), not where the view happens to
  // be looking. A PDF, a photo, a DXF (the picker's own kinds); anything
  // else, the strip says what the sheet takes.
  //
  // THE WHOLE WINDOW REFUSES THE BROWSER'S OWN DROP: left to itself a
  // browser opens a dropped file in place of the page, and a file let go an
  // inch off the sheet, on a panel, would throw the drawing away.
  const DROP_FILE_KINDS = /\.(pdf|png|jpe?g|webp|gif|bmp|dxf|dwg)$/i;
  const dropCarriesFiles = event => Array.from(event.dataTransfer?.types || []).includes('Files');
  const overSheet = event => event.target === canvas && !!drawing;
  window.addEventListener('dragover', event => {
    if (!dropCarriesFiles(event)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = overSheet(event) ? 'copy' : 'none';
    canvas.classList.toggle('drop-here', overSheet(event));
  });
  window.addEventListener('dragleave', event => {
    if (event.target === canvas) canvas.classList.remove('drop-here');
  });
  window.addEventListener('drop', event => {
    if (!dropCarriesFiles(event)) return;
    event.preventDefault();
    canvas.classList.remove('drop-here');
    if (!overSheet(event)) return;
    const files = Array.from(event.dataTransfer.files || []);
    const file = files.find(f => DROP_FILE_KINDS.test(f.name) || /^(image\/|application\/pdf$)/.test(f.type));
    if (!file) {
      sayOnStrip('The sheet takes a PDF, a photo (PNG, JPG, WEBP, GIF, BMP) or a DXF to trace over; a .draft comes in through OPEN or BRING IN.');
      return;
    }
    traceDropAt = tracePoint(event);
    inspectTraceFile(file);
    if (files.length > 1) sayOnStrip(`${file.name} first \u2014 one file at a time.`);
  });
  tq('[data-trace-cancel]').addEventListener('click', closeTraceCard);
  tq('[data-trace-other]').addEventListener('click', () => traceFile.click());
  tq('[data-trace-go]').addEventListener('click', () => { insertTrace(); });
  tq('[data-trace-editable]').addEventListener('click', () => {
    if (traceScan?.kind === 'dxf') insertTraceDxfEditable(traceScan);
  });
  tq('[data-trace-prev]').addEventListener('click', () => turnTracePage(-1));
  tq('[data-trace-next]').addEventListener('click', () => turnTracePage(1));
  tq('[data-trace-scale]').addEventListener('input', event => {
    if (!traceScan) return;
    const typed = event.target.value.trim();
    const parsed = typed ? window.DraftPdfScan.parseScaleEntry(typed) : null;
    traceScan.selectedScale = parsed;
    tq('[data-trace-scale-error]').textContent = typed && !parsed
      ? 'Use a scale like 1/4" = 1\'-0" or 1:100.' : '';
    tq('[data-trace-width-row]').hidden = traceHasScale();
  });
  tq('[data-trace-width]').addEventListener('input', () => { tq('[data-trace-width-error]').textContent = ''; });
  tq('[data-trace-calibrate]').addEventListener('click', () => {
    if (!traceScan) return;
    traceCalOn = !traceCalOn;
    traceScan.calMarks = [];
    tq('[data-trace-cal-error]').textContent = '';
    showTraceCard();
  });
  // CALIBRATE's marks go on the preview itself: a third click starts over.
  tq('[data-trace-preview]').addEventListener('click', event => {
    if (!traceScan || !traceCalOn) return;
    const box = event.currentTarget.getBoundingClientRect();
    // object-fit: contain -- the picture may not fill its box, so the marks
    // are measured against where it is actually drawn.
    const img = event.currentTarget;
    const ratio = Math.min(box.width / (img.naturalWidth || box.width), box.height / (img.naturalHeight || box.height));
    const w = (img.naturalWidth || box.width) * ratio, h = (img.naturalHeight || box.height) * ratio;
    const left = box.left + (box.width - w) / 2, top = box.top + (box.height - h) / 2;
    const fx = (event.clientX - left) / w, fy = (event.clientY - top) / h;
    if (fx < 0 || fx > 1 || fy < 0 || fy > 1) return;
    const marks = traceScan.calMarks || [];
    traceScan.calMarks = marks.length >= 2 ? [{ fx, fy }] : [...marks, { fx, fy }];
    showTraceCard();
  });
  tq('[data-trace-cal-apply]').addEventListener('click', () => {
    const scan = traceScan;
    if (!scan || (scan.calMarks || []).length !== 2) {
      tq('[data-trace-cal-error]').textContent = 'Click both ends of the line on the picture first.';
      return;
    }
    const parsed = F.parseArchitecturalLength(tq('[data-trace-cal-length]').value);
    if (!parsed.ok || !(parsed.inches > 0)) {
      tq('[data-trace-cal-error]').textContent = parsed.ok ? 'The length must be more than zero.' : parsed.error;
      return;
    }
    const result = window.DraftPdfScan.calibrateScale({
      marks: scan.calMarks, canvasWidth: scan.pageCanvas.width, canvasHeight: scan.pageCanvas.height,
      kind: scan.kind, pageDims: scan.pageDims, realInches: parsed.inches,
    });
    if (!result.ok) { tq('[data-trace-cal-error]').textContent = result.error; return; }
    if (result.scale) {
      scan.selectedScale = result.scale;
      tq('[data-trace-scale]').value = result.scale.raw;
    } else {
      tq('[data-trace-width]').value = F.formatArchitecturalInches(result.widthFt * 12);
    }
    traceCalOn = false;
    scan.calMarks = [];
    showTraceCard();
  });

  // ── TURN THE HOUSE A QUARTER ──────────────────────────────────────────────
  //
  // Movie, 27 Sep: *"make it rotate the actual model space so the E1 E2 etc
  // all rotate. make the rotations 90degrees don't allow in between"*, and the
  // clarification that settles what it means: *"the front view E1 will stay as
  // the same view but the house and the E1-E4 lines will rotate"*.
  //
  // THE ARITHMETIC IS NOT HERE. plan-rotate.js turns every record that carries
  // a plan coordinate and counts the turn; cut-marks walks each elevation a
  // seat along so E1 keeps its own wall. Both are checked offline, where a
  // record type nobody remembered to turn fails a walk of the drawing rather
  // than waiting to be noticed on a screenshot.
  //
  // A NEW RECORD, NOT AN EDIT IN PLACE, which is the module's own bargain --
  // so the assignment is what makes it real, and everything downstream reads
  // `drawing` through a function rather than holding the array it was handed.
  //
  // AND IT RE-FITS. The house is a different shape on the paper afterwards --
  // that is the whole point of the press, "depending on length of house so it
  // fits on the layout pages nicer" -- so leaving the camera where it was
  // would put a house that now runs the other way half off the sheet.
  const northButton = document.querySelector('[data-north-button]');
  if (northButton) {
    northButton.addEventListener('click', () => {
      if (!drawing || !window.DraftNorth) return;
      window.DraftNorth.openPopup(northButton, northOf(), next => {
        drawing.layout = { ...(drawing.layout || {}), north: next };
        markDirty();
        paint();
      });
    });
  }

  // ZOOM TO FILL (Movie, 23 Oct). Nothing drawn, nothing to fill: the strip
  // says so and the view stays.
  const fillChip = document.querySelector('[data-zoom-fill]');
  if (fillChip) {
    fillChip.addEventListener('click', () => {
      if (!drawing) return;
      if (zoomToFill()) { paint(); return; }
      sayOnStrip('ZOOM TO FILL: nothing drawn on this level to fill the sheet with.');
    });
  }

  if (rotateChip) {
    rotateChip.addEventListener('click', () => {
      if (!drawing) return;
      const ROT = window.DraftPlanRotate;
      if (!ROT) { sayOnStrip('Rotation is not loaded on this page.'); return; }
      drawing = ROT.rotateDrawing(drawing, 1);
      // markDirty FIRST, because it bumps the model epoch and the elevation
      // marks are cached on it -- fit() asks for those marks, and asking
      // before the bump would frame the house against the ring it had in its
      // old orientation.
      markDirty();
      fit();
      buildChrome();
      paint();
      sayOnStrip(`Turned a quarter \u2014 ${(drawing.planTurn || 0) * 90}\u00b0 from where it was drawn.`);
    });
  }

  // ── THE DRAFTING BRUSH ────────────────────────────────────────────────────
  //
  // Movie, 20 Sep: "brush will copy the propeties of the object type - LINE /
  // WALL / FLOOR / DIMENSIONS etc. and will copy the EXACT PROPERTIES over to
  // a 'matching' object TYPE - a WALL will only change another WALL for
  // example." Then, on what a loaded brush does next: "if they change to WALL
  // command and start drawing a wall those 'selected' drafting brush
  // properties will remain", and "if you select FENSTRATION you should be
  // able to put new windows into a WALL".
  //
  // Designed with him on 5 Sep and written down then as
  // RD-DOCUMENTS/SPEC-drafting-brush.md, which left two questions open and
  // marked them "Needs Movie". Both are answered above and the answers are
  // what this is built to.
  //
  // ── THE RULE THAT SETTLES EVERY EDGE CASE ───────────────────────────────
  //
  // THE BRUSH CARRIES WHAT A THING IS, NEVER WHERE IT IS. Type, size, head
  // height, sill height -- yes. Which wall, which storey, how far along, which
  // points -- never. Dust is a finish lifted off a surface; it is not the
  // surface. Every list below is that sentence applied once, and the keys
  // left OUT of them are the substance of it.
  const BRUSH_PROPS = {
    // The four the WALL panel edits. GUARDRAIL is not here because it is not
    // stored: `wallType === 'guardrail'` IS the guardrail, so it travels
    // inside wallType and cannot arrive disagreeing with itself.
    wall: ['wallType', 'refLine', 'baseHeight', 'topHeight'],
    // `garage` rides along although no panel edits it: it is what makes an
    // overhead door an overhead door, and Movie's own example is dusting one.
    // `offset` and `wallId` are the two that must NEVER travel -- they are
    // where it is.
    fenestration: ['type', 'layer', 'width', 'sillHeight', 'headHeight', 'garage', 'casement',
      'doorType', 'doorStyle', 'gardenWindowWidth', 'sidelightWidth', 'sidelightSides', 'hingeFlip', 'swingFlip', 'showHeight'],
    // NOT `structure`. Whether a floor is framed or a slab is read from the
    // layer set it lives on (layer-views.js's floorHomeView), so copying it
    // would make a floor's own two answers disagree -- and `points` is its
    // shape, which is where it is.
    floor: ['thickness', 'thickenedEdge', 'slopeInPerFt'],
    // A line is two points, a level, a view and a layer. Three of those five
    // are where it is; the layer is the whole of what it is.
    // A LINE'S LOOK TOO (Movie, 20 Oct): the brush carries what the LINE
    // tool draws with, so a pickup can become the tool's own defaults.
    line: ['layer', 'weight', 'style', 'color'],
  };

  // WHAT THE BRUSH CANNOT REACH, AND WHY, said here rather than discovered.
  // Movie named DIMENSIONS among the kinds. hitAt's chain is fenestration,
  // wall, line, outline, floor -- a dimension cannot be pressed on this page
  // at all, so a dimension entry above would be a promise with nothing behind
  // it. Columns and beams are the same story from the other end: they are
  // selected by being PLACED and never found again by a press. OUTLINE is in
  // the chain and is deliberately absent: an outline is a guide, and what a
  // drafter changes about one is its corners.
  // `brushOn` and `brushLoad` are declared with the strip's other state, up
  // beside rulerOn and footOn -- stripRefresh reads both, and a `let` down
  // here would sit in the temporal dead zone for every call made before this
  // line runs. The comments that belong to them are here, where the tool is.
  //
  // brushOn -- the chip: presses lift and dust instead of select
  // THE LOAD OUTLIVES THE CHIP, which is Movie's second sentence and not an
  // accident of scope: "if they change to WALL command and start drawing a
  // wall those 'selected' drafting brush properties will remain". Arming a
  // drawing tool puts the brush's PRESS down -- otherwise there would be no
  // way to draw -- and keeps what it is holding, so the next wall comes out
  // wearing it. One thing held, two ways to spend it.
  // brushLoad -- { kind, props } or null

  const brushHas = kind => brushLoad && brushLoad.kind === kind;

  // The properties a drawing tool should use, or nothing. Handed to the
  // COMMIT rather than read inside it: commitWall is also how a premade house
  // and an ordered garage raise their walls, and a loaded brush must not
  // change what the bone builds.
  const brushOptions = kind => (brushHas(kind) ? { ...brushLoad.props } : {});

  const brushPick = (item, kind) => {
    const out = {};
    (BRUSH_PROPS[kind] || []).forEach(key => {
      if (item[key] !== undefined) out[key] = item[key];
    });
    // A DOOR DRAWN BEFORE DOOR STYLES carries none of their keys, and a brush
    // that lifted nothing would leave a FRENCH door it dusts still FRENCH.
    // What an old door IS is a plain single hung the default way, so that is
    // what it lends.
    if (kind === 'fenestration' && item.type === 'door' && item.garage !== true) {
      if (out.doorStyle === undefined) out.doorStyle = 'single';
      if (out.hingeFlip === undefined) out.hingeFlip = false;
      if (out.swingFlip === undefined) out.swingFlip = false;
    }
    return out;
  };

  // WHAT THE CHIP SAYS IT IS HOLDING. Short enough for the strip; the whole
  // of it goes in the title, where there is room.
  // ── WHAT A THING IS CALLED, SAID ONCE ────────────────────────────────
  //
  // The brush chip and the hover readout both have to name the same objects,
  // and two namers is two vocabularies that drift: the chip would say GARAGE
  // DOOR 8'-0" while the thing under the cursor read DOOR, and a drafter
  // comparing them would be right to think they were different objects.
  //
  // So the SHORT form lives here and both read it. The brush's `long` stays
  // its own, because it describes a LOAD -- what would be stamped -- and that
  // is a different sentence from naming what is under the pointer.
  const shortName = (kind, p) => {
    const F = window.DraftFormatters;
    const ftIn = feet => F.formatArchitecturalInches((Number(feet) || 0) * 12);
    if (!p) return '';
    if (kind === 'wall') return `WALL ${ftIn(p.topHeight)}`;
    if (kind === 'fenestration') {
      // Movie, 13 Oct, naming the thing rather than the kind: not DOOR/WIN but
      // "GARAGE DOOR 16'-0"". A garage door says so -- which is the one he
      // could not pick out of a wall it sits in.
      const name = p.garage === true ? 'GARAGE DOOR'
        : (p.type === 'door' ? 'DOOR' : 'WINDOW');
      return `${name} ${ftIn(p.width)}`;
    }
    if (kind === 'floor') return `FLOOR ${ftIn(p.thickness)}`;
    if (kind === 'line') return `LINE ${p.layer || ''}`.trim();
    return '';
  };

  const brushSays = () => {
    if (!brushLoad) return { short: '', long: '' };
    const F = window.DraftFormatters;
    const ftIn = feet => F.formatArchitecturalInches((Number(feet) || 0) * 12);
    const p = brushLoad.props;
    if (brushLoad.kind === 'wall') {
      const type = window.DraftWallTypes.WALL_TYPES
        .find(t => t.id === (p.wallType || 'stud_2x6'));
      return { short: shortName('wall', p),
        long: `${type ? type.label : p.wallType} — ${ftIn(p.baseHeight)} to `
          + `${ftIn(p.topHeight)}, ${p.refLine} reference` };
    }
    if (brushLoad.kind === 'fenestration') {
      const name = p.garage === true ? 'GARAGE DOOR'
        : (p.type === 'door' ? 'DOOR' : 'WINDOW');
      return { short: shortName('fenestration', p),
        long: `${name} ${ftIn(p.width)} wide, head ${ftIn(p.headHeight)}`
          + (p.type === 'door' ? '' : `, sill ${ftIn(p.sillHeight)}`) };
    }
    if (brushLoad.kind === 'floor') {
      return { short: shortName('floor', p),
        long: `FLOOR ${ftIn(p.thickness)} thick`
          + (p.thickenedEdge ? ', thickened edge' : '')
          + (p.slopeInPerFt ? `, falling ${p.slopeInPerFt}"/ft` : '') };
    }
    return { short: shortName('line', p), long: `LINE on ${p.layer}` };
  };

  // A KIND IN THE WORDS THE DRAFTER SEES, for the refusals. 'fenestration' is
  // the record's word and nobody else's.
  const BRUSH_KIND_SAID = { wall: 'WALL', fenestration: 'OPENING',
    floor: 'FLOOR', line: 'LINE', outline: 'OUTLINE' };

  // ── UNDO FOR A DUST ───────────────────────────────────────────────────────
  //
  // THE PANELS DO NOT PUSH ONE AND THIS DOES, which is a difference worth
  // stating rather than leaving to be found. A panel edit is slow and
  // deliberate: a drafter opens a field, types, and sees the number he typed.
  // A brush is a repeated press -- ten things in five seconds -- so a
  // misplaced one is not a rare event, it is the ordinary cost of using the
  // tool at speed. The step below is the seam the panels should join when
  // somebody gives them one; it is deliberately shaped for any property edit
  // and not for the brush.
  const brushUndoStep = items => ({
    kind: 'props',
    edits: items.map(item => ({ item, before: { ...item } })),
  });

  const brushDust = (hit) => {
    const F = window.DraftFormatters;
    const G = window.DraftGeometry2D;
    const item = hit.item;
    // ── AN OPENING IS PLACED AGAIN, NOT JUST OVERWRITTEN ────────────────
    //
    // Movie, 20 Sep, on dusting a small window with a garage door: "DOES NOT
    // become a garage door - popup says 'TOO BIG' and won't be accepted the
    // same window will remain it won't change PROPERTIES". Which is the fit
    // rule, and it is his own from 5 Sep: "maybe don't allow to place in that
    // case". So the width goes through clampOpeningToWall -- the same rule a
    // press follows and the same rule the WIDTH field follows -- and a wall
    // that cannot carry it keeps the opening it has, untouched.
    //
    // REFUSED, NOT SLID. A typed width may slide the opening along to make
    // room, because the drafter asked for that width at that opening. A dusted
    // one may not: he asked for THESE PROPERTIES, and quietly moving the
    // window he aimed at would be the brush editing where a thing is.
    if (hit.type === 'fenestration') {
      const wall = openingHostWall(item);
      const width = Number(brushLoad.props.width) || 0;
      const fit = wall && G.clampOpeningToWall(wall, Number(item.offset) || 0, width,
        { walls: walls(), thicknessFt: openingThicknessFt() });
      if (!fit || Math.abs(fit.offset - (Number(item.offset) || 0)) > 1e-6) {
        brushWarn(`TOO BIG — that wall cannot carry a `
          + `${F.formatArchitecturalInches(width * 12)} opening there. Nothing changed.`, { opening: item });
        return;
      }
    }
    undoStack.push(brushUndoStep([item]));
    Object.assign(item, brushLoad.props);
    // A WALL'S SUBSTITUTION ENDS WITH A DRAFTER'S CHANGE, and a dust is one.
    // Without this a wall just brushed to RAIL would save as concrete_12
    // again -- see applyToWalls, whose rule this is.
    if (hit.type === 'wall') substitutedWallTypes.delete(item.id);
    markDirty();
    showSelectionProps();
    paint();
    sayOnStrip(`${BRUSH_KIND_SAID[hit.type]} takes the brush's properties.`);
  };

  // A PICKUP BECOMES THE TOOL'S DEFAULTS (Movie, 20 Oct): "when the user
  // picks up the PROPERTIES - also change the PROPERTIES to match in the
  // 'item' FENS / WALL / LINE area to match most recent BRUSH pickup of
  // properties for each type, so when the user goes back to use that item,
  // it will be the type they 'picked up' with the brush". The brush's load
  // already drives the next press while it is held; this writes the same
  // properties where each tool keeps its own, so the panel shows them and
  // the tool draws with them after the brush is put down.
  const brushSetsDefaults = (kind, props) => {
    const G = window.DraftGeometry2D;
    const num = value => (Number.isFinite(Number(value)) ? Number(value) : null);
    if (kind === 'fenestration') {
      const type = props.type === 'window' ? 'window' : 'door';
      fenestrationType = type;
      if (num(props.width) > 0) openingSizes[type] = num(props.width);
      if (num(props.headHeight) > 0) openingHeads[type] = num(props.headHeight);
      if (type === 'window') {
        if (num(props.sillHeight) != null) openingSill = Math.max(0, num(props.sillHeight));
        if (props.casement && CASEMENT_CHIPS.some(([id]) => id === props.casement)) fenestrationCasement = props.casement;
      } else {
        const entry = props.garage === true
          ? G.DOOR_CATALOG.find(e => e.type === 'garage')
          : G.DOOR_CATALOG.find(e => e.type === props.doorType && e.style === (props.doorStyle || 'single'));
        if (entry) fenestrationDoor = entry.id;
        doorHingeFlip = props.hingeFlip === true;
        doorSwingFlip = props.swingFlip === true;
        gardenWindowFt = props.doorStyle === 'garden' ? (num(props.gardenWindowWidth) ?? null) : null;
      }
      if (openingPanelUp) showOpeningProps();
      return;
    }
    if (kind === 'wall') {
      const WT = window.DraftWallTypes;
      if (WT?.WALL_TYPES.some(t => t.id === props.wallType)) drawing.activeWallType = props.wallType;
      if (['left', 'center', 'right'].includes(props.refLine)) drawing.wallRefLine = props.refLine;
      if (num(props.baseHeight) != null) drawing.wallBaseHeight = num(props.baseHeight);
      if (num(props.topHeight) > 0) drawing.wallTopHeight = num(props.topHeight);
      markDirty();
      if (wallPanelUp) showWallProps();
      return;
    }
    if (kind === 'line') {
      const LS = window.DraftLineStyles;
      const patch = {};
      if (LS?.WEIGHTS.some(w => w.id === props.weight)) patch.weight = props.weight;
      if (LS?.STYLES.some(st => st.id === props.style)) patch.style = props.style;
      if (typeof props.color === 'string' && props.color) patch.color = props.color;
      if (Object.keys(patch).length) setLineDefaults(patch);
    }
  };

  // ── WITHIN A FOOT OF AN OPENING'S DOT, IT IS THE OPENING ──────────────
  //
  // Movie, 20 Oct: "i'm trying to GRAB properties from a int FRENCH door and
  // trying to copy those to a 36 INT normal door, but not working" -- the
  // strip said THE BRUSH IS HOLDING WALL PROPERTIES: his first press had
  // landed on the wall beside the door, since an opening only answered a
  // press inside its own gap. His rule: "if the user is within 1ft of the DOT
  // for fenstration radius 2ft dia can they pickup the DOOR properties (not
  // other items lit wall etc)". The dot is the opening's centre grab point.
  // Asked first, and only by a brush that is empty or holding an opening --
  // a brush holding a wall still means the wall.
  const BRUSH_DOT_FT = 1;
  const openingByDot = worldPt => {
    let best = null, bestD = BRUSH_DOT_FT;
    openingsOn(walls()).forEach(({ opening, geometry }) => {
      const d = Math.hypot(geometry.center.x - worldPt.x, geometry.center.z - worldPt.z);
      if (d <= bestD) { bestD = d; best = opening; }
    });
    return best;
  };
  const brushHitAt = at => {
    if (!brushLoad || brushLoad.kind === 'fenestration') {
      const opening = openingByDot(at);
      if (opening) return { type: 'fenestration', item: opening };
    }
    return hitAt(at);
  };

  const brushPress = at => {
    brushWarnClear();
    const hit = brushHitAt(at);
    // ── NOTHING UNDER THE PRESS ──────────────────────────────────────────
    if (!hit) {
      sayOnStrip(brushLoad
        ? 'Nothing there. Press something of the same kind to give it these properties.'
        : 'Press a wall, an opening, a floor or a line to pick up its properties.');
      return;
    }
    const kind = hit.type;
    // ── EMPTY: THE PRESS LIFTS ───────────────────────────────────────────
    if (!brushLoad) {
      if (!BRUSH_PROPS[kind]) {
        sayOnStrip(`The brush has nothing to lift off ${BRUSH_KIND_SAID[kind] || 'that'}.`);
        return;
      }
      brushLoad = { kind, props: brushPick(hit.item, kind) };
      brushSetsDefaults(kind, brushLoad.props);
      // AN OPENING LIFTED ARMS FENESTRATION (Movie, 20 Oct: "once the user
      // uses the BRUSH to get PROPERTIES can you also change the user to
      // the TOOL necessary to use the properties / item, in this case into
      // the BUILD DOOR command with those properties so the user can click
      // on a wall or additionally to paste the properties of that door to
      // another existing door"). The tool comes up wearing the load -- its
      // OPENING row says DOOR or WINDOW as the load does -- and under it a
      // press on bare wall puts one in (placeOpening reads the brush) and a
      // press on an opening gives it these properties (the dispatch below
      // asks the brush first). A WALL lifted keeps the brush up instead:
      // "a WALL will only change another WALL", and the next press is that.
      const arms = kind === 'fenestration' && window.DraftToolRoster?.availableOn('fenestration', board);
      if (arms) {
        fenestrationType = brushLoad.props.type === 'window' ? 'window' : 'door';
        setTool('fenestration');
      }
      stripRefresh();
      paint();
      sayOnStrip(arms
        ? `Brush loaded: ${brushSays().long}. FENESTRATION is armed with it: press a wall to put one in, or press a door or window to give it these properties. Escape puts the brush down.`
        : `Brush loaded: ${brushSays().long}. Escape puts it down.`);
      return;
    }
    // ── LOADED: A MATCHING KIND TAKES THEM ───────────────────────────────
    //
    // Movie: "a WALL will only change another WALL for example." The refusal
    // names both sides, because "wrong kind" without saying which two is a
    // sentence the drafter has to work out from what he can see.
    if (kind === brushLoad.kind) { brushDust(hit); return; }
    // ── AND A BARE WALL UNDER A LOADED OPENING GETS A NEW ONE ────────────
    //
    // Movie, 20 Sep: "if you select FENSTRATION you should be able to put new
    // windows into a WALL". The target decides the verb -- press an opening
    // and it becomes this one, press the wall between two and a new one lands
    // there -- so there is no mode to pick and nothing to remember.
    //
    // THROUGH placeOpening, NOT A SECOND BUILDER. It already finds the wall,
    // clamps to it, refuses a wall too short in the app's own words, files the
    // record on the host's level and view, and pushes the undo step. A second
    // one here would agree with it today and stop agreeing the first time
    // either moved.
    if (brushLoad.kind === 'fenestration' && kind === 'wall') {
      placeOpening(at);
      return;
    }
    sayOnStrip(`The brush is holding ${BRUSH_KIND_SAID[brushLoad.kind]} `
      + `properties. That is a ${BRUSH_KIND_SAID[kind] || 'different kind of thing'}.`);
  };

