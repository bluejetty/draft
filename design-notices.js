// DESIGN NOTICES — what the page says when a press CANNOT move the drawing.
//
// Board #313 rules one direction: software never moves geometry on its own,
// only the drafter's press may. It does not say what happens when a press
// arrives and the geometry correctly stays where it is. Today the answer is
// nothing, and silence reads as agreement -- the drafter has no way to learn
// their press did not take, or that a number they changed elsewhere has left
// something else out of range.
//
// THREE FINDINGS, ONE SHAPE (6 Sep). A stair whose rise changed after it was
// placed still draws at its old riser count until something re-derives it. A
// joist package deep enough to drop the garage door head under 7'-0" is a
// legal wall and an unbuildable door. Pressing BUNGALOW on a drawing that
// already has a storey over the garage keeps the storey -- correctly, since
// the drafter built it -- while the press said otherwise. In each the
// geometry is right and the page is mute.
//
// THE THIRD IS BOARD #333 and is NOT in this file, deliberately. Its build
// row is not on main, and a function returning null until it lands would pass
// every check in the harness for the wrong reason. Named here, where it
// cannot look tested, rather than stubbed there, where it would.
//
// SO THESE RETURN FACTS, NOT ACTIONS. Every function here answers "is there
// something to say", never "what should move". A caller that renders the
// notice has changed nothing in the drawing, which is the point: the rule
// that software may not move geometry survives only if the alternative to
// moving it is saying so, rather than staying quiet.
//
// PURE, AND IT OWNS NO CONSTANTS IT DOES NOT DEFINE. The garage numbers live
// in project-page.js and the stair numbers in stair-geometry.js; a fourth
// copy of OPENING_HEAD_DROP_IN here is exactly the drift this repo spent
// today removing. Callers pass them in. A caller that passes nothing gets a
// notice saying so rather than a quiet null -- a check that cannot fail is
// not a check, and neither is a warning that cannot warn.
if (!window.DraftDesignNotices) {
(() => {
  const num = value => (Number.isFinite(Number(value)) ? Number(value) : null);

  // Every notice carries a stable `kind` for the page to key off, and the
  // numbers it was decided from. The `text` is here rather than at the call
  // site so two boards cannot phrase the same fact two ways -- the divergence
  // that a single-page test can never see.
  const notice = (kind, text, facts) => Object.freeze({ kind, text, ...facts });

  // ── THE STAIR NO LONGER FITS WHAT IT WAS DRAWN FOR ────────────────────
  //
  // A stair re-derives its rise from the level heights on every paint and
  // never writes the new one back, so `stair.riseFt` is the rise at PLACEMENT
  // and stays that way. When the two disagree by a whole riser the stair's
  // run has changed length, and the space the drafter left for it has not.
  //
  // Riser COUNT is the test, not riser height. The run is (risers - 1) treads
  // long, so a stair that keeps its count occupies exactly the space it did;
  // one that gains a riser grew 10". A rise that moved a sixteenth changes
  // every riser height slightly and moves nothing the drafter can collide
  // with, and a notice for that is noise.
  //
  // `layoutFor` and `descentFor` are passed in rather than imported so this
  // module does not depend on the stair module's load order; both come
  // straight off window.DraftStairGeometry at the call site.
  const stairRefitNotice = (stair, levels, { layoutFor, descentFor }) => {
    if (typeof layoutFor !== 'function' || typeof descentFor !== 'function') {
      return notice('notice-inputs-missing',
        'stair fit cannot be checked: the stair geometry module was not supplied',
        { about: 'stair-refit' });
    }
    const placedRiseFt = num(stair && stair.riseFt);
    // No placement rise means nothing to compare against -- a stair drawn
    // before the field existed, not a stair that has drifted.
    if (placedRiseFt === null || placedRiseFt <= 0) return null;
    const descent = descentFor(stair.levelId, levels);
    const nowRiseFt = descent ? num(descent.riseFt) : null;
    if (nowRiseFt === null || nowRiseFt <= 0) return null;
    const placed = layoutFor(placedRiseFt);
    const now = layoutFor(nowRiseFt);
    if (placed.risers === now.risers) return null;
    const grew = now.risers > placed.risers;
    return notice('stair-refit',
      `This stair was drawn for a ${ftIn(placedRiseFt)} rise and now descends `
      + `${ftIn(nowRiseFt)}. It needs ${now.risers} risers instead of ${placed.risers}, `
      + `so its run ${grew ? 'grew' : 'shrank'} from ${ftIn(placed.runFt)} to `
      + `${ftIn(now.runFt)}. Nothing has been moved.`,
      {
        stairId: (stair && stair.id) || null,
        levelId: (stair && stair.levelId) || null,
        placedRiseFt, nowRiseFt,
        placedRisers: placed.risers, nowRisers: now.risers,
        placedRunFt: placed.runFt, nowRunFt: now.runFt,
        landing: descent.landing || null,
      });
  };

  // ── THE GARAGE DOOR HEAD HAS COME DOWN TOO FAR ────────────────────────
  //
  // The head hangs a fixed drop under the top plate, so it follows the wall
  // down without anyone wiring it: deepen the floor package over the garage
  // and the deck stays put, the wall loses what the joists gained, and the
  // head goes with it (Movie, 6 Sep). At some depth a standard overhead door
  // stops fitting -- 27 7/8" of joist with 3/4" sheathing under a 10'-9 1/8"
  // deck, on the numbers of the day this was written.
  //
  // THE ANSWER IS THE NUMBER, NOT A CLAMP (Movie, 6 Sep: "the user will need
  // to take the door limitation height into consideration for their design").
  // So this never adjusts the wall; it reports how short the head is.
  const garageDoorHeadNotice = ({ wallHeightFt, headDropIn, doorHeightIn } = {}) => {
    const wallFt = num(wallHeightFt), dropIn = num(headDropIn), doorIn = num(doorHeightIn);
    // A missing input is louder than a clear result. Silently returning null
    // here would make a miswired caller look like a garage that fits.
    if (wallFt === null || dropIn === null || doorIn === null) {
      const missing = [
        wallFt === null ? 'wallHeightFt' : null,
        dropIn === null ? 'headDropIn' : null,
        doorIn === null ? 'doorHeightIn' : null,
      ].filter(Boolean);
      return notice('notice-inputs-missing',
        `garage door head cannot be checked: ${missing.join(', ')} not supplied`,
        { about: 'garage-door-head', missing });
    }
    const headIn = wallFt * 12 - dropIn;
    const clearIn = headIn - doorIn;
    // NO EPSILON HERE, AND THAT WAS MEASURED. A wall height arrives as feet
    // and is multiplied straight back to inches, which invites a tolerance
    // "for float noise". Over every joist depth from 0 to 40" in eighths,
    // under a 10'-9 1/8" deck with 3/4" sheathing, the round trip introduces
    // none -- and the boundary case lands on exactly 0.0 at a 27 7/8" joist,
    // where a 7'-0" door still fits. A tolerance would be guarding a thing
    // that does not happen, and would quietly swallow a real shortfall
    // smaller than itself. Do not add one without measuring again.
    if (clearIn >= 0) return null;
    return notice('garage-door-head',
      `The garage door head sits at ${ftIn(headIn / 12)}, which is `
      + `${inches(-clearIn)} under a ${ftIn(doorIn / 12)} door. The wall has not `
      + `been changed -- the door, the floor package or the deck has to give.`,
      { headIn, doorHeightIn: doorIn, shortIn: -clearIn, wallHeightFt: wallFt });
  };

  // The tallest door that still fits under a given wall, in inches -- what a
  // drafter asks next after the notice above. Whole inches down, because a
  // door is ordered from a catalogue and 83.6" is not one of them.
  const garageDoorHeadLimitIn = ({ wallHeightFt, headDropIn } = {}) => {
    const wallFt = num(wallHeightFt), dropIn = num(headDropIn);
    if (wallFt === null || dropIn === null) return null;
    return Math.floor(wallFt * 12 - dropIn);
  };

  // ── FORMATTING ────────────────────────────────────────────────────────
  // Feet and inches to the nearest 1/8", the drafting unit this repo reads
  // everything else in. Kept private: formatters.js is a page module and
  // these strings must be identical whichever board renders them.
  const EIGHTHS = ['', '1/8', '1/4', '3/8', '1/2', '5/8', '3/4', '7/8'];
  function inches(totalIn) {
    const sign = totalIn < 0 ? '-' : '';
    const eighths = Math.round(Math.abs(totalIn) * 8);
    const whole = Math.floor(eighths / 8), part = EIGHTHS[eighths % 8];
    if (!whole && part) return `${sign}${part}"`;
    return `${sign}${whole}${part ? ` ${part}` : ''}"`;
  }
  function ftIn(feet) {
    const sign = feet < 0 ? '-' : '';
    const eighths = Math.round(Math.abs(feet) * 96);
    const ft = Math.floor(eighths / 96);
    const rest = eighths - ft * 96;
    const inch = Math.floor(rest / 8), part = EIGHTHS[rest % 8];
    return `${sign}${ft}'-${inch}${part ? ` ${part}` : ''}"`;
  }

  window.DraftDesignNotices = Object.freeze({
    stairRefitNotice,
    garageDoorHeadNotice,
    garageDoorHeadLimitIn,
    // Exported for the harness, which holds the strings against the numbers.
    formatFtIn: ftIn,
    formatIn: inches,
  });
})();
}
