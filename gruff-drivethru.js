// GRUFF'S DRIVE-THRU WINDOW (board #323, the UI half) — the pure half.
//
// The brain lives in gruff-interview.js and is frozen. This module is the
// window's own arithmetic: where the four zones sit on the board art, how
// MODEL's raw drawing snapshot becomes the eight facts the engine reads,
// and how one nextQuestion() result becomes render props.
//
// The hard rule of board #323 holds here too: NOTHING in this file decides
// where a room goes. It shapes facts going in and words coming out. The
// only geometry it touches is the outline's own bounding box, which the
// order names as a fact the engine is owed, and the entry door's side,
// which is a reading of what the drafter already drew.
//
// No DOM, no component state, node-loadable, frozen.
if (!window.DraftGruffDrivethru) {
(() => {

  // ── The board art, measured ────────────────────────────────────────────
  // assets/gruff-drivethru-board.png is 1250x1050. Every zone below was measured
  // against that file's actual pixels — the lit portrait inside its bezel,
  // the black screen, the white panel inside its gold border, and the
  // speaker plate — then expressed as percentages so the board scales
  // without the zones drifting off their art. Re-measure if the art is
  // ever replaced; do not nudge these by eye.
  const BOARD = Object.freeze({
    src: 'assets/gruff-drivethru-board.png',
    width: 1250,
    height: 1050,
    zones: Object.freeze({
      // Gruff's face. Decorative — it never takes a press.
      portrait: Object.freeze({ left: 6.720, top: 10.667, width: 31.520, height: 35.810 }),
      // The black screen: Gruff's questions, in red LED lettering.
      screen:   Object.freeze({ left: 41.440, top: 9.333, width: 53.360, height: 40.952 }),
      // The white panel: the client's answer, in ordinary black letters.
      answer:   Object.freeze({ left: 6.640, top: 53.429, width: 86.560, height: 28.000 }),
      // The speaker: press to talk, which here means "give me the box".
      speaker:  Object.freeze({ left: 34.400, top: 86.571, width: 13.120, height: 11.143 }),
    }),
  });

  // ── Facts in ───────────────────────────────────────────────────────────
  // The engine skips any question the drawing has already answered, so the
  // richer this snapshot is, the less Gruff asks. Everything is optional:
  // a missing fact simply becomes a question.

  // The outline's bounding box in feet. resolveZone() reads {x0,x1,z0,z1}
  // and nothing else, so a polygon of any shape reduces to its extents.
  const outlineBox = points => {
    if (!Array.isArray(points) || points.length < 3) return null;
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    points.forEach(p => {
      if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.z)) return;
      if (p.x < x0) x0 = p.x; if (p.x > x1) x1 = p.x;
      if (p.z < z0) z0 = p.z; if (p.z > z1) z1 = p.z;
    });
    // A degenerate outline is worse than none: it would collapse every
    // zone onto one point. Hand back null and let Gruff ask instead.
    if (!Number.isFinite(x0) || x1 - x0 < 1 || z1 - z0 < 1) return null;
    return { x0, x1, z0, z1 };
  };

  // Which wall the front door landed on, in the same compass the section
  // marks use: E1 front (+z), E2 left (-x), E3 back (-z), E4 right (+x).
  // Nearest edge wins; a door in the middle of nowhere answers nothing.
  const doorSide = (door, box) => {
    if (!door || !box || !Number.isFinite(door.x) || !Number.isFinite(door.z)) return null;
    const gaps = [
      { side: 'front', gap: Math.abs(box.z1 - door.z) },
      { side: 'back',  gap: Math.abs(door.z - box.z0) },
      { side: 'left',  gap: Math.abs(door.x - box.x0) },
      { side: 'right', gap: Math.abs(box.x1 - door.x) },
    ];
    gaps.sort((a, b) => a.gap - b.gap);
    return gaps[0].side;
  };

  const count = value => (Number.isFinite(value) && value > 0 ? Math.round(value) : undefined);

  const factsFrom = (snapshot = {}) => {
    const box = outlineBox(snapshot.outlinePoints);
    const levels = Array.isArray(snapshot.levels) ? snapshot.levels : [];
    const stairs = Array.isArray(snapshot.stairs) ? snapshot.stairs : [];
    const info = snapshot.projectInfo || {};
    const stair = stairs.find(s => s && Number.isFinite(s.x) && Number.isFinite(s.z)) || null;
    const facts = {};
    if (box) facts.outline = box;
    // Storeys come from the level stack, which is the drawing's own answer.
    if (levels.length) {
      facts.storeys = levels.length;
      facts.levelIds = levels.map(level => level.id);
    }
    facts.hasStairs = stairs.length > 0;
    if (stair) facts.stairAt = { x: stair.x, z: stair.z };
    const beds = count(info.bedrooms);
    const baths = count(info.bathrooms);
    // Zero is not an answer — it is the empty state of the project fields,
    // and confirming "0 bedrooms on file" at the client would be daft.
    if (beds !== undefined) facts.bedrooms = beds;
    if (baths !== undefined) facts.bathrooms = baths;
    const side = doorSide(snapshot.entryDoor, box);
    if (side) facts.entrySide = side;
    return facts;
  };

  // ── Words out ──────────────────────────────────────────────────────────
  // One nextQuestion() result becomes what the two screens show. Gruff's
  // words are the engine's verbatim — this adds no prose of its own, and
  // re-asks already arrive with their good-natured line attached.
  const viewModel = (question, draft = '') => {
    const q = question || {};
    if (q.done === true) {
      return Object.freeze({
        done: true,
        line: q.prompt || '',
        reminder: '',
        hint: '',
        chips: Object.freeze([]),
        typed: '',
        canSend: false,
        placeholder: '',
      });
    }
    const suggested = q.suggested != null ? String(q.suggested) : '';
    const chips = (Array.isArray(q.options) ? q.options : []).map(option => Object.freeze({
      value: String(option),
      label: String(option).toUpperCase(),
      // The drawing already implies this one — it renders as the pre-filled
      // choice rather than one of the crowd.
      suggested: suggested !== '' && String(option) === suggested,
    }));
    // A settled answer the client has not overruled is offered as its own
    // chip when it is not already among the options, so "keep it" is always
    // one press rather than a typing exercise.
    if (suggested !== '' && !chips.some(chip => chip.suggested)) {
      chips.unshift(Object.freeze({ value: suggested, label: `KEEP ${suggested.toUpperCase()}`, suggested: true }));
    }
    const typed = String(draft || '');
    return Object.freeze({
      done: false,
      id: q.id || null,
      kind: q.kind || 'choice',
      line: q.prompt || '',
      reminder: q.reminder || '',
      hint: q.hint || '',
      chips: Object.freeze(chips),
      typed,
      canSend: typed.trim().length > 0,
      placeholder: q.kind === 'count' ? 'a number, or just say' : 'type your answer',
    });
  };

  window.DraftGruffDrivethru = Object.freeze({
    BOARD, factsFrom, viewModel, outlineBox, doorSide,
  });
})();
}
