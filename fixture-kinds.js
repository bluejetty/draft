// THE FIXTURE CATALOGUE — what a drafter can put against a wall.
//
// LIFTED FROM MODEL.dc.html, NOT REWRITTEN. The array below is that page's
// `FIXTURE_KINDS` moved verbatim: same ids, same sizes, same notes, same
// order. It moved because MODEL.html — the page the front door now links to —
// has no fixture tool at all, and a kitchen is seven fixtures, so FIT-OUT
// cannot start until both pages can name the same cabinet.
// See RD-DOCUMENTS/ORDER-tiers-of-assembly.md.
//
// WHAT A KIND IS, field by field, because three of the six flags change how a
// click behaves rather than how a fixture looks:
//
//   widthFt/depthFt  the catalogue size. `width` is stored per fixture, so a
//                    run or a stretched tub overrides it; `depth` is taken
//                    from here and stored as given.
//   casework         draws with a countertop line, and lands on the CASEWORK
//                    layer instead of the fixture layer.
//   run              TWO clicks along one wall, which set the extents. Only
//                    cabinet, vanity and closet.
//   preset           not a fixture at all — a click that drops SEVERAL. The
//                    kitchen L is the only one, and `kitchenL` is therefore
//                    NOT a storable kind (see the pairing below).
//
// IT DOES NOT VALIDATE, AND drawing-format.js STILL HAS ITS OWN LIST. That
// duplication is deliberate and load-bearing: drawing-format.js is the module
// every page loads FIRST and it reads nothing off `window` on purpose — its
// own comment at :337 names the trap, counted thirteen times by the module
// review gate. So the format keeps a bare id list and this file keeps the
// catalogue, and `proto/fixture-kinds-harness.js` fails if the two ever
// disagree about which ids exist.
//
// LOAD AFTER closets.js. The closet's depth is the clear inside plus its own
// 2x4 wall, and both numbers are Movie's, held in closets.js. Reading them
// here rather than restating them is why this file has a load order at all.

if (!window.DraftFixtureKinds) {
(() => {
  const CLOSET_INSIDE_DEPTH_FT = window.DraftClosets.INSIDE_DEPTH_FT;
  const CLOSET_WALL_FT = window.DraftClosets.WALL_FT;

  const FIXTURE_KINDS = [
    { id: 'cabinet', label: 'CABINET', group: 'KITCHEN',  widthFt: 3,      depthFt: 2,      casework: true,  run: true,
      note: 'Base cabinet run — two clicks along a wall set the run; 24" deep with a countertop line.' },
    { id: 'sink',    label: 'SINK',    group: 'KITCHEN',  widthFt: 2.5,    depthFt: 2,      casework: false, run: false,
      note: 'Kitchen sink — click it onto a wall (usually over a cabinet run).' },
    { id: 'fridge',  label: 'FRIDGE',  group: 'KITCHEN',  widthFt: 3,      depthFt: 2.5,    casework: false, run: false,
      note: 'Refrigerator box — click it onto a wall.' },
    { id: 'stove',   label: 'STOVE',   group: 'KITCHEN',  widthFt: 2.5,    depthFt: 2.17,   casework: false, run: false,
      note: 'Range with burners — click it onto a wall.' },
    { id: 'dish',    label: 'DW',      group: 'KITCHEN',  widthFt: 2,      depthFt: 2,      casework: false, run: false,
      note: '24" dishwasher — click it onto a wall, usually beside the sink.' },
    { id: 'island',  label: 'ISLAND',  group: 'KITCHEN',  widthFt: 6,      depthFt: 3,      casework: false, run: false,
      note: '36" x 72" island — click it onto a wall; it stands 42" clear of the counter and slides along the run.' },
    { id: 'pantry',  label: 'PANTRY',  group: 'KITCHEN',  widthFt: 4,      depthFt: 4,      casework: false, run: false,
      note: '48" x 48" corner walk-in pantry with a 45° angled door — click it into a corner.' },
    { id: 'kitchenL', label: 'L PRESET', group: 'KITCHEN', widthFt: 4,     depthFt: 2,      casework: false, run: false, preset: true,
      note: 'Corner-L kitchen — click the inside corner where two walls meet: cabinets, sink, DW, fridge, and stove drop in at the proven spots; every piece stays movable.' },
    { id: 'tub',     label: 'TUB',     group: 'BATH',     widthFt: 5,      depthFt: 2.5,    casework: false, run: false,
      note: 'Alcove tub — click the back wall, then the faucet-end wall; the tub fills the alcove.' },
    { id: 'toilet',  label: 'TOILET',  group: 'BATH',     widthFt: 5 / 3,  depthFt: 7 / 3,  casework: false, run: false,
      note: 'Toilet — tank against the wall, click it into place.' },
    { id: 'shower',  label: 'SHOWER',  group: 'BATH',     widthFt: 3,      depthFt: 3,      casework: false, run: false,
      note: '36" square shower — click it onto a wall.' },
    { id: 'stall',   label: 'STALL',   group: 'BATH',     widthFt: 4,      depthFt: 8 / 3,  casework: false, run: false,
      note: '48" x 32" shower stall — click it onto a wall.' },
    { id: 'vanity',  label: 'VANITY',  group: 'BATH',     widthFt: 2.5,    depthFt: 1.75,   casework: true,  run: true,
      note: 'Vanity run — two clicks along a wall set the run; 21" deep with a basin.' },
    { id: 'washer',  label: 'WASHER',  group: 'LAUNDRY',  widthFt: 2.25,   depthFt: 2.25,   casework: false, run: false,
      note: 'Washer box — click it onto a wall.' },
    { id: 'dryer',   label: 'DRYER',   group: 'LAUNDRY',  widthFt: 2.25,   depthFt: 2.25,   casework: false, run: false,
      note: 'Dryer box — click it onto a wall.' },
    { id: 'closet',  label: 'CLOSET',  group: 'BEDROOM',  widthFt: 4,      depthFt: CLOSET_INSIDE_DEPTH_FT + CLOSET_WALL_FT, casework: false, run: true,
      note: 'Closet — two clicks along a wall set the width; 2\'-1" inside with 2x4 closet walls, rod + shelf, and the door picked from the DD/D ladder.' },
  ];

  // The old page's own fallback, carried with it: an unknown id answers with
  // the FIRST kind rather than null, so a click is never silently swallowed.
  // Callers that need to know whether an id is real ask `isKind`.
  const kindFor = id => FIXTURE_KINDS.find(kind => kind.id === id) || FIXTURE_KINDS[0];
  const isKind = id => FIXTURE_KINDS.some(kind => kind.id === id);

  // WHAT CAN BE STORED IS NOT WHAT CAN BE CLICKED. A preset drops several
  // ordinary fixtures and is never itself written to a drawing, so the ids
  // the format must accept are the catalogue MINUS the presets. This is the
  // list the harness holds drawing-format.js against.
  const STORABLE_KIND_IDS = FIXTURE_KINDS
    .filter(kind => kind.preset !== true).map(kind => kind.id);

  // Panel order, derived rather than listed: a new kind appears under its own
  // heading without a second place to edit.
  const GROUPS = [...new Set(FIXTURE_KINDS.map(kind => kind.group))];
  const kindsInGroup = group => FIXTURE_KINDS.filter(kind => kind.group === group);

  window.DraftFixtureKinds = Object.freeze({
    FIXTURE_KINDS: Object.freeze(FIXTURE_KINDS.map(kind => Object.freeze({ ...kind }))),
    STORABLE_KIND_IDS: Object.freeze(STORABLE_KIND_IDS),
    GROUPS: Object.freeze(GROUPS),
    kindFor,
    isKind,
    kindsInGroup,
  });
})();
}
