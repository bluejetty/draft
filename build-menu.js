// BUILD MENU — the house types the build row offers.
//
// LIFTED OUT OF MODEL.dc.html UNCHANGED, for the reason layer-views.js was:
// the table lived inside one page, so nothing else could read it. MODEL.html
// needs the same list for its top bar, and the alternative was a second copy
// of declared data — which is exactly how the level lookup came to have four
// homes and how #325 happened.
//
// This file is that list and nothing else: pure frozen data plus two lookups,
// no DOM, node-loadable. Both drawing pages read it, so they cannot disagree
// about what houses the office builds.
//
// WHAT IS NOT HERE, deliberately: the generator. A button says WHICH TYPE was
// chosen; what geometry that produces is somebody else's decision and is
// being replaced — the drafter is moving to a premade design per house type
// in place of generated rooms. The seam is the point of the file.
//
// The comments below came across with the data and are Movie's and the old
// page's reasoning, not mine.
if (!window.DraftBuildMenu) {
(() => {
  // The build row's house types (NEW-5), in row order. Ids are the persisted
  // vocabulary (drawing-format.js BUILD_TYPES); labels are Movie's words --
  // "BUNGALOW / 2 STOREY / BILEVEL / MODIFIED BILEVEL" -- and the buttons wear
  // them rather than lamp art.
  const BUILD_TYPE_BUTTONS = Object.freeze([
    Object.freeze({ id: 'bungalow', label: 'BUNGALOW' }),
    Object.freeze({ id: 'twoStorey', label: '2 STOREY' }),
    Object.freeze({ id: 'bilevel', label: 'BILEVEL' }),
    Object.freeze({ id: 'modifiedBilevel', label: 'MODIFIED BILEVEL' }),
  ]);

  // THE ROW IS A MENU (Movie, 6 Sep). Three families between the turtle and the
  // bone, each opening ONE submenu -- "only 1 submenu each" -- and every entry
  // is a WHOLE HOUSE rather than a question. Movie wrote the list out:
  //
  //     BUNGALOW  1 STOREY / +GARAGE / 2 STOREY / +GARAGE / +ROOM OVER
  //     BILEVEL   BILEVEL / +GARAGE / MODIFIED BILEVEL (1.5 STOREY)
  //     DETACHED GARAGE   THICKENED EDGE / GRADE BEAM / FROST WALL
  //
  // THE ORDER OF THE FAMILIES IS DETACHED GARAGE / BUNGALOW / BILEVEL since
  // 24 Sep, which is Movie's and is the order PROJECT's type picker has shown
  // since 22 Sep. The two were reading the same three buildings in two
  // different orders, which is the smaller cousin of the duplication this
  // file was lifted out to end.
  //
  // THE ARRAY'S ORDER IS THE ONLY PLACE IT IS SAID. Both drawing pages render
  // straight off it, and the two specs that check the row's order derive their
  // expectation from it rather than typing the words -- so this list is the
  // one edit, and a hardcoded roster somewhere else would be the bug.
  //
  // WHY A LIST OF HOUSES BEATS A CHAIN OF QUESTIONS. An earlier draft asked the
  // type, then the garage, then the storey over it. The drafter recognises the
  // building they are drawing; they should not have to answer three questions
  // about it. And the garage ends up in the NAME of the thing pressed rather
  // than a separate stored answer that can later disagree with the drawing.
  //
  // `type` is the persisted vocabulary (drawing-format.js BUILD_TYPES) and is
  // the only thing here that reaches the file. `garage` and `overGarage` are
  // NOT stored: a garage is an outline carrying garage:true, so an entry naming
  // one is saying what to draw next, not writing a label. Store it and the file
  // would hold a claim its own geometry could contradict.
  //
  // `foundation` belongs to the DETACHED entries alone and pre-answers the
  // prompt that _commitDetachedGarageOutline raises after the loop closes.
  const BUILD_MENU = Object.freeze([
    Object.freeze({
      id: 'detachedGarage',
      label: 'DETACHED GARAGE',
      title: 'DETACHED GARAGE — pick its foundation, then draw its own loop',
      // No `type`: a detached garage says nothing about what house it stands
      // beside, and may stand beside none.
      // `needsSize` is the detached garage's second question (Movie, 15 Sep:
      // "allow them to enter the size give them choices 16x24 24x26 25x25
      // (or 4th option allow them to enter ___FT X ___FT)"). A house's size
      // comes with its premade design; a garage is a box, so its size IS the
      // design and nothing can be built without it.
      entries: Object.freeze([
        Object.freeze({ id: 'detached-thickened', label: 'THICKENED EDGE', foundation: 'thickened', needsSize: true }),
        Object.freeze({ id: 'detached-gradebeam', label: 'GRADE BEAM', foundation: 'gradebeam', needsSize: true }),
        Object.freeze({ id: 'detached-frostwall', label: 'FROST WALL', foundation: 'frostwall', needsSize: true }),
      ]),
    }),
    Object.freeze({
      id: 'bungalow',
      label: 'BUNGALOW',
      title: 'BUNGALOW — 1 or 2 storey, with or without an attached garage',
      entries: Object.freeze([
        Object.freeze({ id: 'bungalow', label: '1 STOREY', type: 'bungalow' }),
        Object.freeze({ id: 'bungalow-garage', label: '1 STOREY + GARAGE', type: 'bungalow', garage: 'attached' }),
        Object.freeze({ id: 'twoStorey', label: '2 STOREY', type: 'twoStorey' }),
        Object.freeze({ id: 'twoStorey-garage', label: '2 STOREY + GARAGE', type: 'twoStorey', garage: 'attached' }),
        // The room over the garage on a 2 STOREY is the UPPER FLOOR REACHING
        // ACROSS -- one deck, one roof -- not a level of its own. That is the
        // asymmetry with MODIFIED BILEVEL below, where the garage sits half a
        // storey down and its floor cannot join the house's.
        Object.freeze({ id: 'twoStorey-over', label: '2 STOREY + GARAGE + ROOM OVER', type: 'twoStorey', garage: 'attached', overGarage: true }),
      ]),
    }),
    Object.freeze({
      id: 'bilevel',
      label: 'BILEVEL',
      title: 'BILEVEL — split entry, with or without a garage; MODIFIED adds the storey over it',
      entries: Object.freeze([
        Object.freeze({ id: 'bilevel', label: 'BILEVEL', type: 'bilevel' }),
        Object.freeze({ id: 'bilevel-garage', label: 'BILEVEL + GARAGE', type: 'bilevel', garage: 'attached' }),
        // MODIFIED BILEVEL asks nothing: the name already says there is a garage
        // and a storey over it, and the .5 IS that storey. It is the only entry
        // in the whole menu that makes a HALF-LEVEL.
        Object.freeze({ id: 'modifiedBilevel', label: 'MODIFIED BILEVEL', type: 'modifiedBilevel', garage: 'attached', overGarage: true }),
      ]),
    }),]);

  // ── HOW BIG THE GARAGE IS ────────────────────────────────────────────
  // Movie's three, in his order, plus the fourth that is not a size but a
  // pair of empty fields. Feet, because that is what the drafter says out
  // loud -- "sixteen by twenty-four" -- and the page converts once, at the
  // point it makes geometry, rather than storing two units.
  //
  // WIDTH IS ACROSS THE DOOR WALL, depth is back from it. 16x24 is a single
  // bay you can walk past the car in; the other two are doubles. Naming
  // which number is which is the whole difference between a 16x24 and a
  // 24x16, and the label cannot say it.
  const GARAGE_SIZES = Object.freeze([
    Object.freeze({ id: '16x24', label: "16' x 24'", widthFt: 16, depthFt: 24 }),
    Object.freeze({ id: '24x26', label: "24' x 26'", widthFt: 24, depthFt: 26 }),
    Object.freeze({ id: '25x25', label: "25' x 25'", widthFt: 25, depthFt: 25 }),
  ]);

  // THE FOURTH OPTION HAS BOUNDS, and they are here rather than in the page
  // because a typed size is the one a drafter can get wrong. Below 8ft
  // nothing parks; above 60ft it is a shop, not a garage, and either is far
  // more likely a slipped finger than a building.
  const GARAGE_SIZE_MIN_FT = 8;
  const GARAGE_SIZE_MAX_FT = 60;
  const garageSizeById = id => GARAGE_SIZES.find(size => size.id === id) || null;
  // A typed pair, checked and named, or null. Returning the same shape as a
  // stock size means the caller has one kind of thing to carry: whoever
  // builds the box never asks which of the four the drafter pressed.
  const customGarageSize = (widthFt, depthFt) => {
    const w = Number(widthFt);
    const d = Number(depthFt);
    const sane = value => Number.isFinite(value)
      && value >= GARAGE_SIZE_MIN_FT && value <= GARAGE_SIZE_MAX_FT;
    if (!sane(w) || !sane(d)) return null;
    return Object.freeze({
      id: 'custom', label: `${w}' x ${d}'`, widthFt: w, depthFt: d, custom: true,
    });
  };

  // The family a menu id belongs to, and the entry itself. Both pages ask
  // these questions; neither should walk the array in its own words.
  const familyById = id => BUILD_MENU.find(family => family.id === id) || null;
  const entryById = id => BUILD_MENU
    .flatMap(family => family.entries)
    .find(entry => entry.id === id) || null;
  // What a stored build type is called on a button. Falls back to HOUSE, as
  // MODEL.dc.html:14212 does, because a drawing can carry a type the row has
  // no button for.
  const labelForType = type => BUILD_TYPE_BUTTONS
    .find(button => button.id === type)?.label || 'HOUSE';

  window.DraftBuildMenu = Object.freeze({
    BUILD_TYPE_BUTTONS,
    BUILD_MENU,
    GARAGE_SIZES,
    GARAGE_SIZE_MIN_FT,
    GARAGE_SIZE_MAX_FT,
    garageSizeById,
    customGarageSize,
    familyById,
    entryById,
    labelForType,
  });
})();
}
