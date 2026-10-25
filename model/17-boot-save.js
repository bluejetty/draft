// MODEL.html's page script, part 17 of 17: boot, the write tier, slivers, notes as text, NEW, an order from PROJECT, the hide-save, the converter's hand-off.
//
// Stage 2 of the split (Movie, 24 Oct: "how can we reduce the MODEL.html
// size in a nice organized way"): the one script the page carried, cut
// at its own section headings and moved here verbatim, in order. The
// parts load one after another as classic scripts and share one scope,
// as they did inside the page; the indent is the page's, kept so every
// line reads as it did there.

  // ── boot ──────────────────────────────────────────────────────────────────
  // ── from a saved file to the drawing on this page ─────────────────────────
  // Parse, check the envelope, normalise the four collections this page owns
  // rules for, and rebuild reference equality at the shared corners. BOOT AND
  // THE CHANGE BROADCAST BOTH COME THROUGH HERE, so a page that adopts another
  // page's write builds exactly the drawing a reload would have built — one
  // definition of what reading a file means, not two that drift.
  //
  // Returns false when the file could not be adopted, having already told the
  // drafter why. The drawing on screen is left alone in that case: a page that
  // blanked itself because somebody else wrote something unreadable would turn
  // one damaged file into two lost drawings.
  const adoptFile = async file => {
    let parsed;
    try {
      parsed = JSON.parse(await file.text());
    } catch (err) {
      readoutText.textContent = 'unreadable';
      say('The saved drawing could not be parsed',
        `<p><code>${escapeHtml(err && err.message || err)}</code></p>`);
      return false;
    }

    // The same envelope check MODEL.dc.html runs, from the same module, so this
    // page agrees with the old one about what a valid drawing is rather than
    // inventing a second opinion.
    const check = window.DraftDrawingFormat?.checkEnvelope(parsed)
      || { ok: true, reason: 'unchecked' };
    if (!check.ok) {
      readoutText.textContent = `envelope ${check.reason}`;
      say('That drawing is not one this page can read',
        `<p>checkEnvelope said <code>${escapeHtml(check.reason)}</code>.
            <code>version</code> means it was written by a newer MODEL than this page knows.</p>`);
      return false;
    }

    // VALIDATE THE THREE TYPES NOTHING VALIDATED. Every other item type on a
    // saved drawing goes through drawing-format.js on load; walls, lines and
    // floors were inflated inline in MODEL.dc.html, so this page read them raw
    // -- no view whitelist, no wallType check, no zero-length rejection. The
    // rules now live in the shared module (drawing-format.js) and this is the
    // first caller of them.
    //
    // REJECTED ITEMS ARE NOT DRAWN AND NOT DELETED (RULING-a-rejected-item-is-
    // still-the-drafters, 11 Sep). They used to be dropped, exactly as the old
    // page drops them, and a SAVE then wrote the file back without them: a
    // drafter who opened a drawing and pressed SAVE had asked to draw nothing
    // and lost geometry anyway. Same failure as the 12" foundation, a different
    // field.
    //
    // So each normaliser is handed a `drops` sink and what it refuses is kept
    // RAW, by index, for the serializer to put back untouched. The readout says
    // how many are being carried, so a malformed drawing reads as a fact rather
    // than as a page that quietly lost -- or quietly kept -- geometry.
    const F = window.DraftDrawingFormat;
    // SHELVES ARE OWNERS TOO, and this page did not know it.
    //
    // drawing-format.js is sign-agnostic -- `levelId()` accepts whatever is in
    // the set it is handed -- so what may own a wall is decided HERE. This
    // page built the set from levels alone, while MODEL.dc.html:5486 builds
    // `new Set([...levelIds, ...boneyardShelves.map(s => -s.id)])`.
    //
    // The consequence is the silent loss this format punishes hardest: a wall
    // parked on a shelf at levelId -1 is dropped on load, with no error,
    // because dropping what it cannot own is the reader's whole job. The
    // boneyard order's estimate rests on "parking a wall on a shelf needs no
    // format change at all" -- true, and it needs THIS, which is not a format
    // change either but is a precondition rather than an assumption.
    //
    // A shelf's owner id is -shelfId. boneyardShelves always yields at least
    // SHELF 1 (drawing-format.js:827), so a drawing saved before shelves
    // existed still gets its default shelf and nothing changes for it.
    const shelfIds = window.DraftDrawingFormat
      .boneyardShelves(parsed.boneyardShelves).map(shelf => -shelf.id);
    const levelIds = new Set((parsed.levels || [])
      .map(level => Number(level.id)).concat(shelfIds));
    const WT = window.DraftWallTypes;
    refusedItems = { walls: [], lines: [], floors: [], dimensions: [],
      beams: [], columns: [], shapes: [], fixtures: [] };
    drawing = {
      ...parsed,
      // NORMALISED, NOT PASSED THROUGH. `...parsed` would carry whatever the
      // file said -- a board of "TOY", or of "banana" -- and the switch would
      // then hold a value BOARDS does not contain. Round-tripping junk is the
      // Write Tier's job for GEOMETRY it cannot understand; a scalar the page
      // acts on gets normalised on the way in.
      board: F.board(parsed.board),
      // The drafter's lines and notes on the elevations, by view name. ONLY
      // WHEN THE FILE HAS THEM: a drawing opened and saved untouched must come
      // back key for key, so the list is made on the first mark, not here.
      ...(parsed.elevationMarks !== undefined && F.elevationMarks
        ? { elevationMarks: F.elevationMarks(parsed.elevationMarks) } : {}),
      // Another .draft shown under this one (HOLOGRAM). Same only-when-present
      // rule, so a file that never had one comes back without the key.
      ...(parsed.holograms !== undefined ? { holograms: F.holograms(parsed.holograms) } : {}),
      // A SUITE FILE'S KIND, normalised; dropped when it is not one.
      ...(parsed.suiteKind !== undefined && F.suiteKind(parsed.suiteKind)
        ? { suiteKind: F.suiteKind(parsed.suiteKind) } : { suiteKind: undefined }),
      walls: F.walls(parsed.walls, levelIds, {
        wallTypes: WT.WALL_TYPES,
        legacyWallTypes: WT.LEGACY_WALL_TYPES,
        // THE FINISH VOCABULARY, for the same reason the layer set is passed
        // to F.lines below and with the same trap. This page does not PAINT
        // exterior finishes -- they are the Real Estate Layout's business --
        // so leaving this off would read perfectly here and still be a bug:
        // the normaliser drops a finish it cannot recognise, the Write Tier
        // re-emits what it loaded, and a drafter who opened their drawing in
        // the Model Space and saved would find the stone stripped off every
        // wall of it with nothing anywhere saying so.
        finishIds: WT.EXTERIOR_FINISHES.map(finish => finish.id),
        legacyFinishes: WT.LEGACY_FINISH_IDS,
        finishAnchors: WT.FINISH_ANCHORS,
        defaultWallTopFt: 8,
        drops: refusedItems.walls,
      }),
      // THE KNOWN LAYERS, or the normaliser flattens them. format.lines folds
      // any layer outside this set to 'draft' (or E-POWER); passing {} here
      // read fine — a flattened layer still paints — but the Write Tier
      // re-emits what it loaded, so a save through this page would have
      // quietly moved every A-DOOR and A-GLAZ line to draft. The set is
      // derived from the same table MODEL.dc.html derives its own from.
      lines: F.lines(parsed.lines, levelIds, {
        knownLayerIds: new Set(window.DraftLayerStandards.DEFAULT_LAYER_STANDARDS
          .flatMap(group => group.layers).map(layer => layer.id)),
        drops: refusedItems.lines,
      }),
      floors: F.floors(parsed.floors, levelIds, {
        // 0.75 WAS THIS PAGE'S OWN NUMBER and nothing else in the app agreed
        // with it: MODEL.dc.html's floor is 12 5/8" (1.052 ft), the joist plus
        // its sheathing. The fallback is only reached by a floor with no
        // stored thickness -- which the old page never writes -- so the two
        // pages would have drawn one hand-edited drawing at two different
        // thicknesses, in section, where it shows. level-assembly.js derives
        // it from the assembly now and both pages read it there.
        defaultFloorThickness: window.DraftLevelAssembly.DEFAULT_FLOOR_THICKNESS_IN / 12,
        drops: refusedItems.floors,
      }),
      // Dimensions already had a rule; this page just never called it. Running
      // it is what lets the view filter above trust that every dimension in
      // the array carries a real view.
      dimensions: F.dimensions(parsed.dimensions, levelIds, { drops: refusedItems.dimensions }),
      // Normalised here rather than at the paint site so the null survives to
      // exactly one place that resolves it. `drawing` is built by spreading
      // `parsed`, so without this line the raw key would still be present and
      // the paint site would read it -- indistinguishable for a valid number,
      // wrong for a quoted one, since the format does not coerce.
      autoDimFirstOffsetFt: F.autoDimFirstOffsetFt(parsed.autoDimFirstOffsetFt),
      // TIER 3J. These four were carried through on `...parsed` while nothing
      // on this page acted on them -- the rule above, followed correctly. The
      // small tools cross that line, so they are asked the format's own
      // questions now: an id that is not an integer, a beam with no length, a
      // level the drawing does not have, a shape with no points, and -- the
      // one a deleted wall leaves behind -- a fixture hanging on no wall.
      beams: F.beams(parsed.beams, levelIds, { drops: refusedItems.beams }),
      columns: F.columns(parsed.columns, levelIds, { drops: refusedItems.columns }),
      // AND ONLY WHEN THE FILE HAS THE KEY: readers normalise, writers never
      // invent (model-seven-tools-data). The first SUPERNODE placed makes it.
      ...(Array.isArray(parsed.superNodes) ? { superNodes: F.superNodes(parsed.superNodes, levelIds) } : {}),
      shapes: F.shapes(parsed.shapes, levelIds, { drops: refusedItems.shapes }),
      fixtures: F.fixtures(parsed.fixtures, levelIds, { drops: refusedItems.fixtures }),
    };
    adoptNotes();
    trimSlivers({ walls: true });
    // THE HALF INCH OFF A CROSSING WALL, on every drawing opened (Movie, 23
    // Oct: "update all the stuff"): a piece or run that ran into a wall
    // stands its half inch off it (settleFixtureGaps).
    settleFixtureGaps();
    // Recorded against the RAW file: the normaliser is the only thing that knows
    // a substitution happened, and it does not say so — the two types differ and
    // nothing else marks it.
    substitutedWallTypes = new Map();
    (Array.isArray(parsed.walls) ? parsed.walls : []).forEach(raw => {
      if (!raw || typeof raw.wallType !== 'string') return;
      const kept = drawing.walls.find(wall => wall.id === raw.id);
      if (kept && kept.wallType !== raw.wallType) {
        substitutedWallTypes.set(kept.id, { original: raw.wallType, painted: kept.wallType });
      }
    });

    // ONE SOURCE, NOT TWO. This used to be a length difference between the raw
    // arrays and the normalised ones. It agreed with the sink by construction,
    // which is the problem: two ways to count the same thing drift, and the one
    // that drifts is the one nothing reads back.
    dropped = REFUSED_KEYS.reduce((total, key) => total + refusedItems[key].length, 0);

    // REBUILD REFERENCE EQUALITY AT SHARED CORNERS. Everything above restores
    // VALUES: JSON has no way to say "these two walls end at the same point",
    // only "these two walls end at points that happen to be equal". So a
    // drawing read back off disk holds a separate object at every corner --
    // and geometryJoins() keys on OBJECT IDENTITY, so without this pass it
    // finds nothing and every corner stays a butt joint. Silently: no error,
    // no warning, just capped ends on a house that should be mitred.
    //
    // MODEL.dc.html does the same thing on its own load path and describes it
    // the same way: "restores reference equality at shared corners instead of
    // merely restoring values."
    //
    // The key is the pool's, not this page's: (levelId, viewId, body). The
    // view is folded to two values because a wall on the e-power or floor set
    // is the same physical wall as the one on plan and shares its corner. The
    // BODY IS PASSED THROUGH UNTOUCHED -- collapsing it is what would let a
    // garage, or a shed, splice onto a house corner, and the normaliser is
    // already the place that decides what a body may be.
    const G = window.DraftGeometry2D;
    vertexPool = [];
    // mergeVertex copies coordinates and pool identity, NOTHING ELSE — and a
    // stored point may carry more: srcId/offX/offZ, the link that lets a wall
    // corner ride its BONEYARD master point (drawing-format.js stores them on
    // purpose). A viewer could shrug that off; a page that SAVES cannot,
    // because the pooled object is what gets re-emitted, and a save that
    // drops srcId silently unhooks every BUILD HOUSE wall from its bone.
    // First point into a pooled corner wins, matching the identity the old
    // page saved: one shared object per corner has one link.
    const pooled = (pt, wall, view, body) => {
      const v = G.mergeVertex(vertexPool, pt, wall.levelId, view, body);
      if (pt.srcId && !v.srcId) {
        v.srcId = pt.srcId;
        v.offX = pt.offX;
        v.offZ = pt.offZ;
      }
      return v;
    };
    drawing.walls.forEach(wall => {
      const view = wall.view === 'foundation' ? 'foundation' : 'plan';
      const body = wall.body || 'house';
      wall.start = pooled(wall.start, wall, view, body);
      wall.end = pooled(wall.end, wall, view, body);
    });
    // A ROOM SHAPE'S CORNERS GO INTO THE SAME POOL (Movie, 23 Oct): a corner
    // saved at a wall's node comes back as that node, linked, and a wall
    // later drawn to a free corner takes it up. The pool merges exact
    // places only, so a corner a hair off a node stays its own.
    (drawing.roomTags || []).forEach(tag => {
      if (!Array.isArray(tag.points) || tag.points.length < 3) return;
      tag.points = tag.points.map(p => {
        const v = G.mergeVertex(vertexPool, p, tag.levelId, 'plan', 'house');
        if (p.link && !v.link) v.link = { ...p.link };
        return v;
      });
    });

    // THE HISTORY GOES WITH THE DRAWING IT POINTS INTO. Undo entries hold
    // references to wall and corner OBJECTS, and every one of them has just
    // been replaced. Kept, an undo would splice a wall from the previous
    // drawing back into this one, or move a corner nothing is joined to.
    undoStack.length = 0;
    // AND THE VERSIONS GO WITH IT (Movie, 20 Oct: "do it per session"): a
    // new drawing starts a new history. A jump adopts too, muted, and keeps.
    historyReset();
    setSelection([]);
    drawStart = null;

    // THE DRAWING'S BOARD BECOMES THE PAGE'S. A file that recorded one wins;
    // one that never did leaves the remembered board alone, so opening an old
    // drawing does not silently move a drafter off the board they were on.
    // No markDirty: adopting what the file already says is not a change to it.
    board = boardOfDrawing();
    applyBoard();
    // A SUITE OPENS ON THE BONEYARD, where it is drawn (Movie, 20 Oct).
    if (drawing.suiteKind) boneyardActive = true;
    return true;
  };


  let projectOrder = null;
  // Set by boot from ?trace=handoff, acted on once the drawing is up.
  let wantsHandoffAtBoot = false;
  const boot = async () => {
    resize();
    // ── ANOTHER PAGE CAN ASK FOR A BLANK ONE, AND THE ASK IS SPENT FIRST ──
    //
    // Movie, 28 Sep, on the EXT. FINISH page: *"when i press NEW can you take
    // me back to MODEL page from the EXT FINISH page and open a new blank
    // plan"*. That page clads a drawing it does not own and has none of its
    // own to blank, so NEW there is this page's NEW reached by a link.
    //
    // SPENT BEFORE THE FIRST `await`, not beside the branch that reads it.
    // Beside the branch it is spent after the store read, and everything in
    // that window -- a refresh, a slow IndexedDB, the read failing and
    // returning early -- leaves the flag in the bar to blank the drafter's
    // work a second time. tests/ext-finish-new.spec.js caught it as a URL
    // still carrying `new=1` after the page had landed.
    const wantsBlank = new URLSearchParams(location.search).get('new') === '1';
    // NEW FROM THE PROJECT PAGE COMES BACK TO IT (Movie, 7 Oct): "allow the
    // NEW button to function in the PROJECT area (clear the MODEL area - and
    // bring up the selection screen, and then they can proceed to change the
    // PROJECT info prior to hitting the BONE". So it is this page's own NEW --
    // the same save-a-copy question over the house on screen, the same blank
    // -- and then back to PROJECT instead of the drive-thru.
    // AND FROM LAYOUT THE SAME WAY (Movie, 11 Oct: NEW there asks SAVE
    // CURRENT or DISCARD, then opens a blank file "but stay in layout area").
    // LAYOUT asks its own question, so `asked=1` means it is not asked again.
    const thenPage = new URLSearchParams(location.search).get('then');
    const newForProject = wantsBlank && (thenPage === 'project' || thenPage === 'layout');
    const alreadyAsked = newForProject
      && new URLSearchParams(location.search).get('asked') === '1';
    // KEEP THE NUMBERS, when PROJECT's NEW was answered KEEP (option C).
    const keepProjectNumbers = newForProject
      && new URLSearchParams(location.search).get('keep') === '1';
    const backToProject = () => {
      window.location.href = thenPage === 'layout' ? './LAYOUT.html' : './PROJECT.html';
    };
    if (wantsBlank) {
      const spent = new URL(location.href);
      spent.searchParams.delete('new');
      spent.searchParams.delete('then');
      spent.searchParams.delete('keep');
      spent.searchParams.delete('asked');
      history.replaceState(null, '', spent.pathname + spent.search + spent.hash);
    }
    // ── BACK FROM THE BONEYARD'S GROW, AND THAT ASK IS SPENT FIRST TOO ──
    // Same reasoning as `new=1` above: a refresh must not play it twice.
    // Taken out of `params` as well as the bar, since syncUrl writes the bar
    // FROM `params` and would otherwise put it straight back.
    // ── AND AN ORDER FROM THE PROJECT PAGE, spent the same way ──
    if (params.get('order')) {
      projectOrder = { entryId: params.get('order'), round: params.get('round') };
      params.delete('order');
      params.delete('round');
      syncUrl();
    }
    // ── A DXF HANDED OVER BY THE CONVERTER (DXF/), spent the same way ──
    if (params.get('trace') === 'handoff') {
      wantsHandoffAtBoot = true;
      params.delete('trace');
      syncUrl();
    }
    const wantsReveal = params.get('reveal') === '1';
    if (wantsReveal) {
      params.delete('reveal');
      // BACK FROM A BONE, LEVELS / LAYERS IS UP (Movie, 10 Oct: "so they can
      // see it draw onto the PREVIEWS when they press the BONE") -- even for
      // a drafter who shut it before pressing, and even with BONE REVEAL off.
      params.set('right', '1');
      syncUrl();
    }
    let file = null;
    try {
      // loadSharedFileAt, not loadSharedFile: the file AND the revision it was
      // read at, in one transaction, so the rev handed to a later save really
      // describes the drawing on screen and not some neighbouring moment.
      const at = await window.SharedFileStore.loadSharedFileAt(BUCKET);
      file = at.file;
      storeRev = at.rev;
    } catch (err) {
      readoutText.textContent = 'store unavailable';
      say('The drawing store could not be opened',
        `<p>IndexedDB refused to open: <code>${escapeHtml(err && err.message || err)}</code></p>
         <p>Private-browsing windows and blocked site data both do this.</p>`);
      return;
    }
    // ── NOTHING STORED IS A BLANK SHEET, NOT A MESSAGE ───────────────────
    //
    // Movie, 20 Sep, on being shown this screen: "on this page take this part
    // off - just show a NEW / BLANK page instead". It read "Draw something in
    // MODEL.dc.html on this same origin and save it, then reload this page",
    // which was honest while this page could only READ what the old one made.
    // It writes now, and the same message sends a first-time drafter to a
    // page he is not meant to use -- and on the same day the front door
    // started pointing here, so he would meet it before anything else.
    //
    // THE SAME BLANK THE NEW BUTTON GIVES, through the same function, because
    // "what an empty drawing is" is one answer. adoptAndShow marks it UNSAVED
    // on arrival, which is true: the store has never seen it.
    // ── AND THE BLANK THE ASK ABOVE IS FOR ──────────────────────────────
    //
    // THE SAME BRANCH AS "NOTHING STORED", deliberately: the comment below
    // already says why the blank comes through one function, and a second
    // path to it here would be a second answer to the same question.
    //
    // AFTER THE STORE READ, so `storeRev` is real -- a drafter who presses
    // SAVE on this blank is writing over what is there, and that write needs
    // the revision it is replacing, not nothing.
    //
    // NO GUARD, AND THAT IS NOT AN OVERSIGHT. `newDrawing` asks guardUnsaved
    // first, which is right when a drawing is on the screen with edits in it.
    // Nothing is on the screen yet here -- boot has not adopted anything --
    // so there is nothing to lose and nothing to ask about.
    if (wantsBlank && !newForProject) {
      await adoptAndShow(blankDrawingFile());
      return;
    }
    if (!file) {
      if (newForProject) {
        if (await adoptAndShow(blankDrawingFile()) && await askForLease()) await save();
        backToProject();
        return;
      }
      await adoptAndShow(blankDrawingFile());
      return;
    }

    if (!(await adoptFile(file))) return;
    // The drawing is on the page: first epoch, as MODEL.dc.html bumps at the
    // end of its load (:6366).
    bumpModelEpoch();
    fit();
    paint();
    // The shell comes up with the drawing, for the same reason the switchers
    // do: a tab that opens an empty panel is furniture.
    syncShell();
    syncBuildBar();
    // The switchers can only be built once the drawing is on the page: their
    // options ARE its levels. Before this the bar stays hidden, like #save.
    buildChrome();
    // CLEAN ON ARRIVAL, and stamped rather than assumed: without this the
    // attribute is absent, and absent is not '0' to anything reading it.
    document.body.dataset.saveDirty = '0';
    // THE HOUSE IS ON SCREEN, so NEW asks about it exactly as the button here
    // does. CANCEL keeps it and goes back too: the drafter asked from PROJECT.
    // THE LEASE FIRST: the blank is saved over the house, and a page that
    // does not hold the lease is refused at the store.
    if (newForProject) {
      await askForLease();
      newDrawing({ then: backToProject, onCancel: backToProject, ask: !alreadyAsked,
        keep: keepProjectNumbers ? projectNumbersOf(drawing) : null });
      return;
    }
    // Deliberately NOT awaited: the drawing is correct without its tracing
    // images and should be on screen before they arrive. Each one repaints
    // itself as it lands.
    loadUnderlayImages();
    // THE SECOND HALF OF THE SHOW: the bones grew in the BONEYARD, and now
    // the house climbs out of the ground on E1.
    if (wantsReveal) startBoneReveal();
    // CLAIMED ONCE THERE IS SOMETHING TO EDIT. A page that failed to load a
    // drawing has nothing to protect and should not hold the lease shut against
    // a page that does.
    await askForLease();
    startLeaseHeartbeat();
  };

  // ── the Write Tier ──────────────────────────────────────────────────────────────────
  // This page has no serializer of its own, ON PURPOSE. `drawing` was built by
  // spreading the parsed save, so every persisted key — all 65 literal ones
  // plus conditional layout/specs passthrough — is still sitting on it,
  // untouched, in the shape MODEL.dc.html wrote. The four collections this
  // page normalises on load are re-emitted through the SAME shared rules the
  // old page saves through, and pooled wall corners go back to stored points
  // through the same pointForStorage that wrote them. Nothing here decides
  // what a drawing looks like; drawing-format.js already did.
  //
  // What a save through this page is, precisely: load → normalise → store.
  // The deep-compare proof in tests/write-tier.spec.js holds the result
  // against a straight legacy save of the same drawing, key for key.
  // ── unsaved edits ─────────────────────────────────────────────────────────
  // MODEL.dc.html AUTOSAVES: _markUnsaved (MODEL.dc.html:6199) writes on every
  // edit, so its UNSAVED is only ever briefly true. THIS PAGE SAVES ON A
  // PRESS, deliberately — the Write Tier note below says why, and the stale
  // check in save() is the other half of it: two pages writing the same file
  // on every drag would spend the day refusing each other. A manual save is
  // only honest if the drafter can see there is something unsaved, so the
  // button carries three true words: SAVE before anything is touched, UNSAVED
  // the instant a corner moves, SAVED once it is written.
  //
  // THE BODY ATTRIBUTE IS LIFTED FROM MODEL.dc.html:6206 and is there for the
  // same stated reason: it flips SYNCHRONOUSLY with the edit, where the
  // button's text lands a frame later. A test that watched the text would be
  // racing the edit it is checking.
  let dirty = false;
  const markDirty = () => {
    if (!drawing) return;
    // EVERY EDIT, ahead of the dirty guard. That guard returns early once the
    // page is already unsaved, which is right for the button and wrong for
    // the epoch: MODEL.dc.html's _markUnsaved has no such short-circuit, so
    // its rail epoch moves on every edit. Bumping below the guard would
    // freeze the six thumbnails on the FIRST change after a save and leave
    // them stale for every change after it -- a wall drawn, no seat updated.
    bumpModelEpoch();
    // AND THE HISTORY TAB HEARS EVERY EDIT (Movie, 20 Oct), ahead of the
    // guard for the epoch's reason: the first edit after a save is not the
    // only one worth a version.
    historyNoteEdit();
    if (dirty) return;
    dirty = true;
    document.body.dataset.saveDirty = '1';
    saveButton.textContent = 'UNSAVED';
    saveButton.classList.add('dirty');
  };
  const markSaved = () => {
    dirty = false;
    document.body.dataset.saveDirty = '0';
    saveButton.textContent = 'SAVED';
    saveButton.classList.remove('dirty');
  };

  // PUT THE REFUSED ITEMS BACK WHERE THEY CAME FROM. Original index, so a load
  // followed by an untouched SAVE reproduces the file's own order rather than a
  // resemblance of it — the round trip is asserted deep-equal, and an item that
  // comes back in a different slot fails that as surely as one that vanishes.
  //
  // The index clamps. After the drafter adds or deletes, the recorded slot can
  // be past the end of a shorter array, and there is no honest answer to
  // "where does it go now" — it lands as near its old position as the array
  // allows. Stated because it is a choice, not an invariant.
  //
  // Applied to all four collections unconditionally, empty list or not. A
  // `if (refused.length)` around the call site would be dead code on every
  // clean drawing, which is to say untested on every clean drawing.
  const withRefused = (key, items) => {
    const refused = refusedItems[key] || [];
    if (!refused.length) return items;
    const out = items.slice();
    [...refused].sort((a, b) => a.index - b.index)
      .forEach(({ index, item }) => out.splice(Math.min(index, out.length), 0, item));
    return out;
  };

  // READERS NORMALISE, WRITERS NEVER INVENT. The loader materialises `board`
  // on `drawing` because the page ACTS on it -- a board of "banana" must not
  // reach the lamp (see the normalise comment above) -- and `...drawing` then
  // wrote it into every file this page saved.
  //
  // THAT IS THE 12" FOUNDATION AGAIN, pointing the other way. A drafter who
  // opened a drawing and pressed SAVE had asked to draw nothing, and the file
  // came back with keys the page that owns the format never writes. The Write
  // Tier's acceptance line is "every key equal, deep" and it was red for
  // exactly as long as this was true; three of its checks say the same fact.
  //
  // `board: null` is the ABSENCE spelled out -- it means "never chosen", which
  // is what a missing key already means, and which now reads as TOY. A REAL
  // choice is 'drafting': a drawing promoted by a number it was given reloads
  // on the board that number put it on.
  //
  // `boardPromptSeen` WENT WITH THE CARD (Movie, 15 Oct). It recorded that a
  // drafter had answered the Continue / Stay question once, and there is no
  // question any more. Files written before that still carry the key; the
  // loader drops it, which is what it already did with every other key the
  // format does not name.
  const storedChoice = () => ({
    ...(drawing.board ? { board: drawing.board } : {}),
  });

  // ── SLIVERS ARE TRIMMED OFF (Movie, 18 Oct) ───────────────────────────
  //
  // "if there is a peice of roof or wall or floor with less that 1/64"
  // thickness can you autoamatically TRIM it off ... i think this might solve
  // some of our roof problems" -- and, told his worst sliver measured about
  // 1/60", "ok lets go 1/16" on your advice". The roof painter already reads
  // past anything under a sixteenth (geometry-2d cleanRoofRing); this takes
  // it out of the drawing itself, so every reader -- sections, elevations,
  // plans, the file -- sees the same clean ring:
  //   a roof, floor, shape or outline loses a point that sits within 1/16"
  //   of the next, or that the ring doubles back through (a spike);
  //   a wall shorter than 1/16" goes, with the doors and windows on it.
  // On open, and on every save. Walls only on open: a wall being dragged
  // through zero length is not a sliver yet.
  const SLIVER_FT = 1 / 192;
  function trimSlivers({ walls: doWalls = false } = {}) {
    const G = window.DraftGeometry2D;
    if (!drawing || !G?.cleanRoofRing) return 0;
    let trimmed = 0;
    // A CORNER EXACTLY ON ITS NEIGHBOUR IS MEANT, A HAIR OFF IT IS NOT. A
    // jog whose front overhang lands it on the main eave puts its two eave
    // corners on one spot to the last decimal -- worked out from the
    // overhangs, over walls still six feet apart, and meant to come back out
    // when the overhang does -- so a roof carrying one is left whole (the
    // painter already reads past it). A slid edge leaves a near miss, his
    // 1/60" strip, and that is the sliver.
    (drawing.roofs || []).forEach(roof => {
      const pts = roof.points || [];
      const landed = pts.some((p, i) => {
        const q = pts[(i + 1) % pts.length];
        return Math.hypot(q.x - p.x, q.z - p.z) < 1e-6;
      });
      if (landed) return;
      const clean = G.cleanRoofRing(roof);
      if (!clean) return;
      roof.points = clean.points;
      roof.edges = clean.edges;
      roof.edgeOverhang = clean.edgeOverhang;
      delete roof.footprint;
      trimmed += 1;
    });
    ['floors', 'shapes', 'outlines'].forEach(key => (drawing[key] || []).forEach(item => {
      if (!Array.isArray(item?.points) || item.points.length < 4) return;
      const clean = G.cleanRoofRing({ points: item.points });
      if (!clean) return;
      item.points = clean.points;
      trimmed += 1;
    }));
    if (doWalls && Array.isArray(drawing.walls)) {
      const gone = drawing.walls.filter(w => w.start && w.end
        && Math.hypot(w.end.x - w.start.x, w.end.z - w.start.z) < SLIVER_FT);
      if (gone.length) {
        const ids = new Set(gone.map(w => String(w.id)));
        drawing.walls = drawing.walls.filter(w => !gone.includes(w));
        if (Array.isArray(drawing.fenestrations)) {
          drawing.fenestrations = drawing.fenestrations.filter(o => !ids.has(String(o.wallId)));
        }
        trimmed += gone.length;
      }
    }
    return trimmed;
  }
  const serializeDrawing = ({ trim = true } = {}) => {
    // THE HISTORY TAB ASKS WITHOUT THE TRIM: a version is the drawing as it
    // stands, and a snapshot that tidied the sheet would be an edit.
    if (trim) trimSlivers();
    const point = p => window.DraftDrawingFormat.pointForStorage(p);
    // Destructured out of the spread rather than overwritten with `undefined`,
    // so the key is genuinely absent from the OBJECT and not merely absent from
    // its JSON -- the omission must not depend on this having one caller.
    const { board: _board, ...rest } = drawing;
    return {
      ...rest,
      ...storedChoice(),
      walls: withRefused('walls', drawing.walls.map(wall => {
        // Restored ONLY while the wall still carries the type this page
        // substituted; a deliberate later change is the drafter's edit and is
        // what gets written.
        const swap = substitutedWallTypes.get(wall.id);
        const wallType = (swap && wall.wallType === swap.painted) ? swap.original : wall.wallType;
        return { ...wall, wallType, start: point(wall.start), end: point(wall.end) };
      })),
      // Spread from `drawing` these three would already be here; they are named
      // so the refused items go back into them. A refused LINE is as much the
      // drafter's as a refused wall.
      lines: withRefused('lines', drawing.lines),
      floors: withRefused('floors', drawing.floors),
      dimensions: withRefused('dimensions', drawing.dimensions),
      beams: withRefused('beams', drawing.beams || []),
      columns: withRefused('columns', drawing.columns || []),
      shapes: withRefused('shapes', drawing.shapes || []),
      fixtures: withRefused('fixtures', drawing.fixtures || []),
      // A SHAPED TAG'S CORNERS ARE POOLED OBJECTS, written as plain points;
      // its area is the shape's as it stands, the figure the roll-ups read.
      roomTags: (drawing.roomTags || []).map(tag => (roomShapeOf(tag)
        ? { ...tag, points: tag.points.map(p => ({ ...point(p), ...(p.link ? { link: { ...p.link } } : {}) })), areaSqFt: roomTagArea(tag) }
        : tag)),
    };
  };

  // ONE WRITE, TWO CALLERS. The press and the hide-save below both come through
  // here, and that is the point: two write paths to one file is how the two
  // halves drift apart, and the half that drifts is always the one nobody
  // watches. Everything that decides WHETHER to write stays with the caller;
  // everything that decides HOW lives here.
  //
  // markSaved() is inside the await rather than after it at the call site, so a
  // page cannot say SAVED before the store has taken the bytes.
  // The BYTES come back, so a download is a copy of what the store took and
  // not a second serialization of the same drawing. Serializing twice would
  // let the file on disk and the file in the store differ -- by an id
  // allocated between the two calls, say -- while both claimed to be the
  // save the drafter pressed once.
  const writeDrawing = async () => {
    const contents = JSON.stringify(serializeDrawing());
    const file = new File([contents], 'model-drawing.json', { type: 'application/json' });
    storeRev = await window.SharedFileStore.saveSharedFile(file, BUCKET, {
      // BOTH GUARDS, NOT ONE. The lease prevents the collision; `ifRev`
      // catches the case where prevention failed. Dropping `ifRev` because
      // this page holds a lease would reintroduce audit C3.
      ifRev: Number.isInteger(storeRev) ? storeRev : null,
      lease: { scope: LEASE_SCOPE, holderId: holderId(), generation: leaseGeneration },
    });
    markSaved();
    return contents;
  };

  // Returns whether the write landed, because SAVE FIRST in the unsaved guard
  // has to know: a guard that offered to save, failed, and threw the drawing
  // away anyway would be worse than no guard at all.
  const save = async ({ download = null, handle = null } = {}) => {
    if (!drawing) return false;
    // A READ-ONLY PAGE DOES NOT ASK. The store would refuse it anyway — that gate
    // is the authority and is tested on its own — but a page that fires a write
    // it knows will be refused spends the drafter's attention to learn something
    // it already knew.
    if (!holdsLease()) { paintLease(); return false; }
    saveButton.disabled = true;
    saveButton.textContent = 'SAVING…';
    try {
      // THE STORE FIRST, THE DISK SECOND, and the download only if the store
      // took it. A refused write that still handed the drafter a file would
      // give them a copy of a drawing the shared store does not have, named
      // as though it were saved.
      const contents = await writeDrawing();
      if (download) await downloadDrawing(contents, download, handle);
      // The note described a difference this save has just resolved.
      if (elsewhereNote) elsewhereNote.hidden = true;
      saveButton.disabled = false;
      return true;
    } catch (error) {
      // The edit is still unsaved, so the button must still say so. Dropping
      // back to a neutral SAVE here would tell a drafter whose write just
      // failed that there is nothing to lose.
      saveButton.textContent = dirty ? 'UNSAVED' : 'SAVE';
      saveButton.disabled = false;
      // A STALE WRITE IS REFUSED, NOT MERGED. MODEL.dc.html re-reads and
      // retries because it holds live edits worth fighting for; this page
      // holds only what it loaded, so the honest resolution is to reload and
      // read what is really there now.
      // TAKEN OVER BETWEEN THE PRESS AND THE WRITE. The edit is untouched and
      // still on screen; the banner names who holds it and offers it back.
      if (error?.lease) {
        leaseGeneration = null;
        leaseHolder = error.holderId;
        paintLease();
        return false;
      }
      if (error?.stale) {
        say('The drawing changed underneath this page',
          `<p>Another page saved since this one loaded. Nothing was written.
              Reload to pick up the current drawing, then save again.</p>`);
        return false;
      }
      say('The save failed', `<p><code>${escapeHtml(error && error.message || error)}</code></p>`);
      return false;
    }
  };
  saveButton.addEventListener('click', () => save());

  // ── the file row (§1) ─────────────────────────────────────────────────────
  // NEW · OPEN · SAVE · SAVE AS · the extension. SAVE is above, because it is
  // the store's business and predates the row; everything that is only about
  // a FILE lives here.
  const fileExtPick = document.getElementById('file-ext');
  const fileInput = document.getElementById('file-input');
  const fileGuard = document.getElementById('file-guard');
  const fileGuardText = fileGuard && fileGuard.querySelector('[data-file-guard-text]');
  const fileGuardLease = fileGuard && fileGuard.querySelector('[data-guard-lease]');
  const saveAsBox = document.getElementById('save-as');
  const saveAsName = document.getElementById('save-as-name');

  const chosenExtension = () => (fileExtPick ? fileExtPick.value : 'draft');
  const generatedFileName = () =>
    window.DraftDrawingFormat.drawingFileName(chosenExtension());
  // THE LAST FILE A SAVE DIALOG WROTE, so the NOTES pad's SAVE AS TXT can
  // open its dialog in the same folder (`startIn` takes a handle and opens
  // beside it).
  var lastSaveHandle = null;

  // ── NOTES, SAVED AS TEXT (Movie, 18 Oct) ────────────────────────────────
  //
  // "can we put in the notepad a 'SAVE AS TXT FILE' and allow them to save it
  // as a TXT file in location where they save their DRAFT files as a
  // backup". The dialog opens where the last .draft went; a browser with no
  // save dialog downloads it, and the chip says so, as a .draft download does.
  const saveNotesAsText = async () => {
    const text = notesText.value || '';
    const name = `${generatedFileName().replace(/\.[^.]+$/, '')} NOTES.txt`;
    if (window.showSaveFilePicker) {
      let handle = null;
      try {
        handle = await window.showSaveFilePicker({
          suggestedName: name,
          ...(lastSaveHandle ? { startIn: lastSaveHandle } : {}),
          types: [{ description: 'Text', accept: { 'text/plain': ['.txt'] } }],
        });
      } catch (error) {
        if (error && error.name === 'AbortError') return;
        handle = null;
      }
      if (handle) {
        const writable = await handle.createWritable();
        await writable.write(text);
        await writable.close();
        if (savedWhereNote) savedWhereNote.hidden = true;
        return;
      }
    }
    const file = new File([text], name, { type: 'text/plain' });
    const url = URL.createObjectURL(file);
    const link = document.createElement('a');
    link.href = url;
    link.download = file.name;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
    sayWhereItWent(file.name);
  };
  document.querySelector('[data-notes-save-txt]').addEventListener('click', saveNotesAsText);

  // TWO WAYS TO PUT A FILE ON A DISK, and both have to keep working.
  //
  // With a HANDLE the drafter already chose the folder in their own save
  // dialog, so the file goes exactly where they put it and they can find it
  // again. Without one this is a DOWNLOAD: the drafter names the file and the
  // BROWSER picks the folder -- which is the half Movie could not live with,
  // having saved a drawing and had "no clue where it is".
  //
  // The fallback is not a lesser path to be removed later. `showSaveFilePicker`
  // is Chromium only -- Chrome, Edge, Brave, Opera -- and Firefox and Safari
  // do not implement it, so a download is the only thing those browsers can
  // do. Both paths ship; both stay tested.
  // A DOWNLOAD IS NOT SILENT ANY MORE. Where the browser chose the folder the
  // drafter never saw it happen, so the chip says so and names the file. It
  // stays until the next save rather than timing out: somebody who looks back
  // five minutes later is exactly who needs it.
  const sayWhereItWent = name => {
    if (!savedWhereNote) return;
    savedWhereNote.innerHTML = `SAVED TO YOUR DOWNLOADS FOLDER<br><b></b>`;
    // The filename goes in as TEXT, never as markup -- it is a drafter's
    // typing and it reaches this line unsanitised.
    savedWhereNote.querySelector('b').textContent = name;
    savedWhereNote.hidden = false;
  };

  const downloadDrawing = async (contents, name, handle = null) => {
    if (handle) {
      // The drafter picked the folder themselves, so there is nothing to
      // tell them; a stale chip from an earlier download would be a lie.
      if (savedWhereNote) savedWhereNote.hidden = true;
      const writable = await handle.createWritable();
      await writable.write(contents);
      await writable.close();
      return;
    }
    const file = new File([contents], name, { type: 'application/json' });
    const url = URL.createObjectURL(file);
    const link = document.createElement('a');
    link.href = url;
    link.download = file.name;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
    sayWhereItWent(file.name);
  };

  // THE PICKER IS OPENED FROM THE CLICK AND NOTHING MAY COME BEFORE IT.
  // A save dialog is gated on a user gesture, and the gesture is spent by the
  // first `await` that yields -- so this is called before the drawing is
  // serialised, not after. Putting it where `downloadDrawing` sits would be
  // the obvious place and the dialog would silently never open.
  //
  // Returns a handle, or null to mean "use the download path", and throws
  // nothing: CANCEL IS A NORMAL PRESS, not a failure. The API reports a
  // back-out as an AbortError exception, and a Save that treated that as an
  // error would put a scary notice on screen for somebody who simply changed
  // their mind -- so it comes back as the string 'cancelled' and the caller
  // leaves the card alone.
  const pickSaveTarget = async suggestedName => {
    if (!window.showSaveFilePicker) return null;
    try {
      return lastSaveHandle = await window.showSaveFilePicker({
        suggestedName,
        types: [{
          description: 'Rough Drafter drawing',
          accept: { 'application/json': ['.draft', '.json'] },
        }],
      });
    } catch (error) {
      if (error && error.name === 'AbortError') return 'cancelled';
      // Anything else -- a blocked picker, a sandboxed frame -- is not worth
      // stopping a save for. Fall through to the download the page has always
      // done, which works everywhere.
      return null;
    }
  };

  // THE GUARD IS ONE FUNCTION WITH THREE WAYS OUT, and the caller's work
  // happens in the callback rather than after the call: `await`ing a modal
  // and carrying on would run the discard path on Cancel the first time
  // somebody forgot to check the answer.
  let guardProceed = null;
  const closeGuard = () => {
    guardProceed = null;
    guardSaveWith = null;
    guardCancel = null;
    if (fileGuard) fileGuard.hidden = true;
    paint();
  };

  // SAVE / DON'T SAVE / CANCEL, asked about a question the CALLER supplies.
  // Two things now need those three answers and they disagree about when to
  // ask, so what they share is the dialog and not the condition.
  //
  // THE CALLER'S WORK STAYS IN A CALLBACK, which is the whole discipline of
  // this thing: every answer including CANCEL returns from here immediately,
  // so work written after the call would run on all three. It has to be
  // handed over to run on two of them.
  // `saveWith`, where given, is what SAVE FIRST does instead of the plain
  // store write -- NEW's guard saves a COPY TO THE COMPUTER as well, because
  // NEW is about to clear the stored drawing too.
  let guardSaveWith = null;
  let guardCancel = null;
  const askToSave = (question, proceed, saveWith = null, onCancel = null) => {
    guardProceed = proceed;
    guardSaveWith = saveWith;
    guardCancel = onCancel;
    if (fileGuardText) fileGuardText.textContent = question;
    if (fileGuard) fileGuard.hidden = false;
    paint();
  };

  // THE UNSAVED-EDITS GUARD IS ONE CALLER, and the only one that asks
  // conditionally -- a clean drawing has nothing to lose, so it goes straight
  // through without a dialog in the way.
  const guardUnsaved = (what, proceed) => {
    if (!dirty) { proceed(); return; }
    askToSave(`This drawing has unsaved edits. Save before ${what}?`, proceed);
  };

  if (fileGuard) {
    fileGuard.querySelector('[data-guard-save]').addEventListener('click', async () => {
      const proceed = guardProceed;
      // SAVE FIRST MEANS SAVED. A refused lease or a stale revision leaves the
      // drawing exactly where it is and the guard up, so the drafter still
      // has the edits and the message explaining why.
      if (!(await (guardSaveWith ? guardSaveWith() : save()))) return;
      closeGuard();
      if (proceed) proceed();
    });
    fileGuard.querySelector('[data-guard-discard]').addEventListener('click', () => {
      const proceed = guardProceed;
      closeGuard();
      if (proceed) proceed();
    });
    fileGuard.querySelector('[data-guard-cancel]').addEventListener('click', () => {
      const cancelled = guardCancel;
      closeGuard();
      if (cancelled) cancelled();
    });
    // THE SAME PRESS THE CORNER BANNER CARRIES, and it does the same one
    // thing: take the lease. It deliberately does NOT then save -- SAVE
    // FIRST is the commit point and stays the commit point, so the drafter
    // takes the drawing back, watches the note go, and presses the button
    // they were pressing. A takeover that silently wrote would make this the
    // second way to commit, which RULING-autosave-two-writers.md §3.4 is
    // explicit about not having.
    fileGuard.querySelector('[data-guard-take-over]').addEventListener('click', () => {
      askForLease({ takeover: true })
        .catch(error => console.warn('draft: takeover failed', error));
    });
  }

  // A BLANK DRAWING IS THE OLD PAGE'S FIVE LEVELS, not an empty object: a
  // drawing with no levels has nowhere to draw, and the ids are the ones both
  // pages hard-code (MODEL.dc.html DEFAULT_LEVELS, and ROOF_LEVEL_ID /
  // SITE_LEVEL_ID here). It goes in through adoptFile like every other load,
  // so a new drawing is built by the one reader rather than assembled on the
  // page and hoped over.
  const BLANK_LEVELS = [
    { id: 8, name: 'SITE', elev: 0, visible: true },
    { id: 7, name: 'ROOF', elev: 18, visible: true },
    { id: 5, name: '2ND FL', elev: 9, visible: true },
    { id: 3, name: 'MAIN FL', elev: 0, visible: true },
    { id: 1, name: 'FOUNDATION', elev: -10, visible: true },
  ];

  const adoptAndShow = async file => {
    if (!(await adoptFile(file))) return false;
    hideNotice();
    bumpModelEpoch();
    fit();
    paint();
    syncShell();
    syncBuildBar();
    buildChrome();
    loadUnderlayImages();
    // UNSAVED ON ARRIVAL, not saved: what is on screen is not what the store
    // holds until somebody presses SAVE, and a page that said SAVED over a
    // drawing the store has never seen is the lie this button exists to
    // avoid.
    markDirty();
    return true;
  };

  // AN EMPTY SHEET, and ONE of them: NEW presses this and so does a first
  // visit to an origin with nothing stored. Written twice, the day one gained
  // a level the other would open a different blank -- and a drafter would
  // meet two different empty drawings depending on how he arrived.
  // THE PROJECT PAGE'S NUMBERS, for a NEW that keeps them: heights, the
  // section table, pitch and overhang, wall type, foundation attachment.
  // NOT the project's name and owner, and not the house type or garage plan
  // -- those are the next house's to pick. A detached garage's foundation
  // choice goes too, because PROJECT reads it as the house's type.
  const PROJECT_NUMBER_KEYS = ['zoneHeights', 'sectionTable', 'levelAssemblies',
    'roofPitch', 'roofOverhang', 'roofSideOverhang', 'roofHeelIn', 'activeWallType',
    'foundationAttachment', 'foundationAttachmentIn', 'foundationLadderIn'];
  const projectNumbersOf = d => {
    const kept = {};
    PROJECT_NUMBER_KEYS.forEach(key => {
      if (d && d[key] !== undefined && d[key] !== null) kept[key] = JSON.parse(JSON.stringify(d[key]));
    });
    const detached = kept.sectionTable?.rows?.detachedGarage;
    if (detached) delete detached.garageFoundation;
    return kept;
  };
  const blankDrawingFile = (keep = {}) => new File([JSON.stringify({
    ...keep,
    version: window.DraftDrawingFormat.VERSION,
    levels: BLANK_LEVELS.map(level => ({ ...level })),
    activeLevelIdx: 3,
    nextLevelId: 9,
    nextDrawingItemId: 1,
    // E1 ON THE RIGHT, looking left at the house. Movie, 1 Oct: *"i'd like
    // the drawings to start out with E1 on the right side looking leftwards
    // towards the house, which will place E2 on the bottom looking up"*.
    // Three quarter turns is that seat (cut-marks.js: S, W, N, E), and HOUSE
    // ROTATE carries on round from it.
    planTurn: 3,
  })], 'new-drawing.json', { type: 'application/json' });

  // ── LEAVING THE PAGE IS LEAVING THE DRAWING ──────────────────────────────
  //
  // Movie, 27 Sep: *"something weird is happening the PREVIOUSLY created plan
  // is popping back up when i move from MODEL area into the EXT FINISH area
  // it switches to the PREVIOUS house at that point"*.
  //
  // IT IS NOT THE OLD PLAN COMING BACK. IT IS THE NEW ONE NEVER LEAVING.
  // This page holds the drawing in memory and writes it to the shared store on
  // SAVE; every other page in the app READS that store. So a drafter who
  // builds a house, does not save, and presses EXT. FINISH is shown the last
  // house that WAS saved. And because a fresh MODEL loads from the same store,
  // coming back does not bring the new one home either -- which makes this a
  // good deal worse than the display fault it looks like from the outside.
  // The work is gone, and nothing said so.
  //
  // THE GUARD ALREADY EXISTED AND HAD EXACTLY TWO CALLERS. NEW and OPEN both
  // ask before they throw a dirty drawing away. Leaving the page throws the
  // same drawing away and asked nothing -- so this is one more caller, not one
  // more mechanism, and the drafter gets the same three answers in the same
  // dialog they already know.
  //
  // THE ROW'S OWN MARKUP DOES THE FILTERING, which is why there is no list of
  // destinations here. shell-bars renders the page you are ON as a <span> and
  // one that is not built yet as a disabled <button>; only a page you can
  // actually reach is an <a href>. So the selector IS the test, and a row that
  // grows a new destination tomorrow is guarded the day it appears rather than
  // the day somebody remembers to add it here.
  //
  // CAPTURE, so this runs before any handler the bar installs on its own
  // chips -- a guard that fires after the thing it guards has already begun is
  // not a guard.
  //
  // AND A MODIFIED PRESS IS NOT A DEPARTURE. Ctrl-, Cmd-, Shift- and
  // middle-click open the destination somewhere else and leave this page
  // exactly where it is, with the drawing still in it. Guarding those would
  // ask the drafter to save something they are not leaving.
  document.addEventListener('click', event => {
    if (event.defaultPrevented) return;
    if (event.button !== 0 || event.metaKey || event.ctrlKey
      || event.shiftKey || event.altKey) return;
    const link = event.target && event.target.closest
      && event.target.closest('a[data-page][href]');
    if (!link) return;
    // NO `dirty` TEST HERE. guardUnsaved's first line already is one -- a
    // clean drawing has nothing to lose, so it calls straight through without
    // a dialog -- and a copy of that rule in this handler is a second
    // authority on one question. Mutation proved the cost: deleting a `&&
    // !dirty` from here survived the check that a clean drawing walks straight
    // through, because the guard let it through anyway. So the handler asks
    // about the LINK, the guard asks about the DRAWING, and neither has an
    // opinion about the other's half.
    event.preventDefault();
    const where = (link.textContent || 'another page').trim();
    const href = link.href;
    guardUnsaved(`leaving for ${where}`, () => { window.location.href = href; });
  }, true);

  // ── NEW CLEARS THE DRAWING, NOT JUST THE SCREEN ─────────────────────────
  //
  // Movie, 5 Oct: "if i press NEW - it brings up a blank page, but if i
  // press 'F5' when it refreshes the plan it brings back the last plan i
  // drew ... Once the USER presses NEW - the old drawing should DISAPPEAR and
  // not come back if they didn't save it". Asked which way, (a): NEW stores
  // the blank, so a refresh, EXT. FINISH and every other page read the new
  // empty drawing -- after asking, whenever there is anything to lose, to
  // save a COPY TO THE COMPUTER first. The browser's store is the only other
  // place a plain SAVE ever went, and NEW is about to empty it.
  const drawingHasWork = () => !!drawing && ['walls', 'lines', 'floors', 'roofs', 'outlines',
    'shapes', 'fenestrations', 'dimensions', 'stairs', 'columns', 'beams', 'notes', 'roomTags']
    .some(key => Array.isArray(drawing[key]) && drawing[key].length);
  const newDrawing = ({ then = null, onCancel = null, keep = null, ask = true } = {}) => {
    const clear = async () => {
      if (!(await adoptAndShow(blankDrawingFile(keep || {})))) return;
      await save();
      if (then) { then(); return; }
      // AND THE HOUSE PICKER COMES UP ON THE BLANK (Movie, 5 Oct): "once the
      // sheet is blank, please bring up the screen for creating a new house".
      // The same call the front door makes -- the house button glows, then
      // the drive-thru rises -- and a hand on the page inside the glow still
      // cancels it, so it never lands over someone already drawing.
      pullUpToWindow();
    };
    if (!ask || (!dirty && !drawingHasWork())) { clear(); return; }
    askToSave('NEW clears this drawing from this browser. Save a copy to your computer first?',
      clear, async () => {
        const name = generatedFileName();
        const ok = await save({ download: name });
        return ok;
      }, onCancel);
  };

  const openDrawing = () => guardUnsaved('opening another', () => {
    if (fileInput) fileInput.click();
  });

  // ── A BUILDING NEEDS A FILE OF ITS OWN ───────────────────────────────
  //
  // Movie, 24 Sep: "if they press the button ask them if they would like to
  // SAVE the current drawing and then proceed with a NEW CLEAN file for the
  // new AUTOBUILD". One building per file means a second cannot land beside
  // the first, so the bone stops refusing and starts offering.
  //
  // IT ASKS WHETHER OR NOT THERE ARE EDITS, which is why it goes through
  // askToSave rather than guardUnsaved. guardUnsaved's silence on a clean
  // drawing is right for FILE > NEW, where the drafter asked for a new file
  // and knows what he asked for. Here he pressed a BONE, and the drawing on
  // screen is about to be replaced whether or not it has unsaved edits --
  // going quietly would be the surprise.
  //
  // WHAT SURVIVES THE SWAP IS THE CHOICE, NOT THE FILE. chosenEntryId and
  // chosenSizeId are page state that only orderServed() clears, so the entry
  // picked at the window is still picked once the blank is adopted, and
  // fireOrder -- which reads page state, never the drawing -- has something
  // to build. drawing.buildType does NOT survive, hence the re-stamp.
  //
  // AND A FAILED SAVE BUILDS NOTHING. The guard's SAVE button returns early
  // rather than closing when save() comes back false, so a refused lease or
  // a stale revision leaves the drawing, the dialog and the message exactly
  // where they are -- and this callback, which would have blanked it, never
  // runs. adoptAndShow is checked for the same reason one layer down.
  const buildInAFreshFile = () => askToSave(
    'This build needs a clean file. Save the current drawing first?',
    async () => {
      if (!(await adoptAndShow(blankDrawingFile()))) return;
      stampBuildType();
      fireOrder();
    });

  // ── AN ORDER FROM THE PROJECT PAGE ──────────────────────────────────────
  //
  // Movie, 6 Oct: "i'd like a user to be able to go into the PROJECT area on
  // a NEW plan, and pick the type within that area (rather than on the
  // popup) and once they select everything they want, they press the
  // BONE/HOUSE it will build as they chose" ... "it should ask them - DRAW
  // OUTLINE or NO OUTLINE?".
  //
  // PROJECT ASKS THE QUESTION AND THIS PAGE DOES THE WORK, through the same
  // two presses the drive-thru offers -- "CLICK HERE to draw OUTLINE" and
  // "PRESS TO DRAW HOUSE WITHOUT drawing OUTLINE" -- so the two doors cannot
  // build differently. The ask arrives as ?order=<entry>&round=outline|menu.
  //
  // A FILE THAT ALREADY HOLDS A BUILDING asks to start fresh first (his
  // answer: "ASK TO FRESH START"), save or discard as NEW does -- and the
  // fresh file KEEPS THE PROJECT'S NUMBERS, because those are what he just
  // set up on the PROJECT page and what "build as they chose" means.
  //
  // A DETACHED GARAGE WITH NO OUTLINE IS 24' x 24' (his answer).
  const PROJECT_KEYS = ['projectInfo', 'zoneHeights', 'sectionTable', 'levelAssemblies',
    'roofPitch', 'roofOverhang', 'roofSideOverhang', 'roofHeelIn', 'activeWallType', 'foundationAttachment',
    'foundationAttachmentIn', 'foundationLadderIn', 'buildType', 'garagePlan'];
  const blankKeepingProject = from => {
    const blank = {
      version: window.DraftDrawingFormat.VERSION,
      levels: BLANK_LEVELS.map(level => ({ ...level })),
      activeLevelIdx: 3, nextLevelId: 9, nextDrawingItemId: 1, planTurn: 3,
    };
    PROJECT_KEYS.forEach(key => { if (from && from[key] != null) blank[key] = from[key]; });
    return new File([JSON.stringify(blank)], 'new-drawing.json', { type: 'application/json' });
  };
  const PROJECT_GARAGE_FT = 24;
  const runProjectOrder = ({ entryId, round: wanted } = {}) => {
    if (!drawing || !entryId) return;
    const entry = BM.entryById(entryId);
    if (!entry) return;
    pressEntry(entryId);
    if (entry.needsSize) {
      chosenSizeId = 'custom';
      sizeWidth.value = String(PROJECT_GARAGE_FT);
      sizeDepth.value = String(PROJECT_GARAGE_FT);
      syncBuildBar();
    }
    const go = () => {
      if (wanted === 'outline') {
        round = 'outline';
        setSign(false);
        const picked = chosen();
        outlineHandlers.forEach(fn => fn(picked));
      } else {
        orderAtWindow();
      }
    };
    if (!window.DraftBuildingBodies.hasBuilding(drawing)) { go(); return; }
    askToSave('This plan already has a building. Save it, then start a new plan with your PROJECT settings?',
      async () => {
        if (!(await adoptAndShow(blankKeepingProject(drawing)))) return;
        stampBuildType();
        go();
      });
  };

  if (fileInput) {
    fileInput.addEventListener('change', async event => {
      const file = event.target.files && event.target.files[0];
      // CLEARED EITHER WAY, so opening the same file twice in a row fires a
      // second change event instead of silently doing nothing.
      event.target.value = '';
      // A SAVED FILE OPENS ONTO LEVELS / LAYERS (Movie, 10 Oct), so the
      // previews of what was just opened are the first thing in view.
      if (file && (await adoptAndShow(file))) setRail('right', true);
    });
  }

  document.getElementById('file-new').addEventListener('click', () => newDrawing());
  document.getElementById('file-open').addEventListener('click', openDrawing);

  // SAVE AS SAVES. It is the same write as SAVE with a download hung off the
  // end of it, in that order, so the copy on disk is a copy of what the store
  // took -- byte for byte, from one serialization.
  const openSaveAs = () => {
    if (!drawing || !saveAsBox || !saveAsName) return;
    saveAsName.value = generatedFileName();
    saveAsBox.hidden = false;
    paint();
    saveAsName.focus();
    // SELECTED, NOT EMPTY. The generated name is the answer most of the time
    // and typing over a selection is one keystroke; an empty box would make
    // the drafter invent a name they did not want to think about.
    saveAsName.select();
  };
  const closeSaveAs = () => {
    if (saveAsBox) saveAsBox.hidden = true;
    paint();
  };

  document.getElementById('file-save-as').addEventListener('click', openSaveAs);
  if (saveAsBox) {
    saveAsBox.querySelector('[data-save-as-go]').addEventListener('click', async () => {
      const typed = saveAsName.value.trim() || generatedFileName();
      // The picker first, because the gesture is spent by the first await.
      const handle = await pickSaveTarget(typed);
      // A cancelled dialog leaves the card up: the drafter's typed name is
      // still there and they can press Save again or Cancel themselves.
      // Closing it for them would read as "something went wrong".
      if (handle === 'cancelled') return;
      closeSaveAs();
      await save({ download: typed, handle });
    });
    saveAsBox.querySelector('[data-save-as-cancel]').addEventListener('click', closeSaveAs);
    saveAsName.addEventListener('keydown', event => {
      if (event.key === 'Enter') {
        event.preventDefault();
        saveAsBox.querySelector('[data-save-as-go]').click();
      } else if (event.key === 'Escape') {
        event.preventDefault();
        closeSaveAs();
      }
    });
  }

  // THE LAST THING BETWEEN AN EDIT AND LOSING IT. MODEL.dc.html never needed
  // this: _markUnsaved (MODEL.dc.html:6199) writes on every edit, so there is
  // never a closed tab with work in it. This page saves on a press, which is
  // the right call for a second writer on one file — and it is what puts a
  // drafter one stray Ctrl+W away from a moved corner that never landed.
  //
  // The browser owns the dialog and its wording; a page can only say whether
  // there is something to lose.
  //
  // TWO SPELLINGS, AND ONLY ONE OF THEM IS TESTED HERE. Mutating preventDefault
  // away makes the spec below fail; mutating returnValue away does not — this
  // Chromium reads preventDefault and nothing else. returnValue is the older
  // spelling, kept for the engines that still read only it, and THE SUITE
  // CANNOT PROVE IT DOES ANYTHING, because it runs one engine. Said out loud
  // rather than left as a line that reads as verified: a reader who deletes it
  // will see every test pass.
  //
  // This is the honest minimum, not the answer. The answer is autosave, and
  // autosave here means deciding what happens when this page and MODEL.dc.html
  // both hold the same file — the ifRev refusal in save() above is one half of
  // a story that has not been written yet. Not a rung to take on the way past.
  window.addEventListener('beforeunload', event => {
    if (!dirty) return;
    event.preventDefault();
    event.returnValue = '';
  });

  // ── the edit lease ──────────────────────────────────────────────────────────
  // RULING-autosave-two-writers.md §2 and §3.1-3.2, rung 3. The broadcast below
  // stops a CLEAN page going stale; this is what happens when two pages are both
  // being edited. It is the only thing in the design that protects work before
  // it is written, and it does not make concurrent editing safe — it makes it
  // refused, visibly, with the loser's work intact.
  const LEASE_SCOPE = 'model';
  // ONE ID PER PAGE INSTANCE, and it is rung 2's `writerId` rather than a second
  // one. A page that ignored its own broadcast under one identity and held the
  // lease under another would have two answers to "is this me".
  const holderId = () => window.SharedFileStore.leaseHolderId();
  let leaseGeneration = null;   // the generation we hold, or null when we do not
  let leaseHolder = null;       // whoever holds it instead, so the banner can say
  let leaseTimer = null;
  const holdsLease = () => leaseGeneration !== null;

  const paintLease = () => {
    const held = holdsLease();
    // A SYNCHRONOUS BEACON, like data-save-dirty: it flips with the state, where
    // the banner's text lands a frame later.
    document.body.dataset.leaseHeld = held ? '1' : '0';
    if (leaseBanner) {
      leaseBanner.hidden = held;
      // NAMED, as §2 asks — and the holder id is the only name there is. It is
      // not shown, because "w-mf2k3-8ad19c" tells a drafter nothing; it is
      // carried where a second page, and a test, can read WHICH page has it
      // rather than merely that one does.
      if (leaseHolder) leaseBanner.dataset.leaseHolder = leaseHolder;
      else delete leaseBanner.dataset.leaseHolder;
    }
    // THE GUARD'S COPY OF THE SAME NOTE, painted from the same `held` in the
    // same pass. The dialog is a modal in the middle of the screen and the
    // banner is a chip in the corner behind it; a drafter reading the first
    // does not read the second, which is what "nothing is happening" was.
    // One source for both, so there is no state where the corner says the
    // drawing is held and the dialog does not.
    if (fileGuardLease) fileGuardLease.hidden = held;
    if (leaseMessage && !held) {
      // WORDED AS BEING EDITED ELSEWHERE, NOT AS EXPIRED (§3.4). An
      // expired-but-unclaimed lease is an absent drafter, not a free lease, and a
      // drafter told "expired" will reasonably assume they may simply carry on.
      leaseMessage.textContent = 'Being edited in another tab';
    }
    // DISABLED, NOT HIDDEN. The ruling leaves this unruled and asks that someone
    // who watches drafters pick it; THIS IS A PICK, NOT A SPECIFICATION. A
    // missing button reads as a broken page, where a dead one says the drafter
    // is looking at the right place and cannot use it yet.
    if (saveButton) saveButton.disabled = !held || !drawing;
  };

  const askForLease = async ({ takeover = false } = {}) => {
    const S = window.SharedFileStore;
    if (!S || !S.claimLease) return false;
    let got;
    try {
      got = await S.claimLease(BUCKET, LEASE_SCOPE, holderId(),
        { ttlMs: S.LEASE_TTL_MS, takeover });
    } catch (error) {
      console.warn('draft: could not reach the edit lease', error);
      return holdsLease();
    }
    if (!got.ok) {
      // WE DO NOT HOLD IT, AND NOTHING OF OURS IS DISCARDED. A dirty page keeps
      // every edit it has; it is simply refused at the store if it tries to
      // write, and the banner tells the drafter why and offers the way out.
      leaseGeneration = null;
      leaseHolder = got.holderId;
      paintLease();
      return false;
    }
    // A GENERATION THAT MOVED WHILE WE WERE AWAY MEANS SOMEBODY HELD THIS IN
    // BETWEEN — we froze, they took it, it came back to us. They may have
    // written, so this page says the same thing rung 2 says when another page
    // writes rather than inventing a fourth kind of notice.
    //
    // A generation that did NOT move is the resume path (§3.4): our own lease
    // expired, nobody took it, nothing happened, and the drafter is told nothing
    // at all. Bump the generation on every re-claim and every woken tab
    // announces a takeover that never occurred.
    const wasTakenOver = leaseGeneration !== null && got.generation !== leaseGeneration;
    leaseGeneration = got.generation;
    leaseHolder = null;
    paintLease();
    if (wasTakenOver && !takeover && elsewhereNote) elsewhereNote.hidden = false;
    return true;
  };

  const startLeaseHeartbeat = () => {
    if (leaseTimer) return;
    const S = window.SharedFileStore;
    // It renews while we hold it and acquires when whoever does goes away —
    // expiry with a heartbeat is what stops a closed tab bricking the drawing,
    // and the ruling calls that non-negotiable.
    leaseTimer = setInterval(() => {
      askForLease().catch(error => console.warn('draft: lease heartbeat failed', error));
    }, (S && S.LEASE_HEARTBEAT_MS) || 4000);
  };

  if (takeOverButton) {
    takeOverButton.addEventListener('click', () => {
      // The only thing that may seize a live lease, and only because a person
      // read a banner and pressed it.
      askForLease({ takeover: true })
        .catch(error => console.warn('draft: takeover failed', error));
    });
  }

  // ── the hide-save ───────────────────────────────────────────────────────────
  // RULING-autosave-two-writers.md §3.4, rung 4. AN EXTRA, NOT A MECHANISM.
  // The press is still the only commit point and stays the only commit point.
  // This closes the tab-closed hole MOST OF THE TIME, which is the whole claim
  // and the most that can honestly be claimed: the probe (TTL-MEASUREMENT-MEMO)
  // measured a pagehide IndexedDB write failing to land on a tab reload with no
  // memory pressure at all. It landed on close. So nothing here — no rung, no
  // test, no comment — may assume this ran.
  //
  // TWO LISTENERS, AND NEITHER IS A SUPERSET OF THE OTHER. visibilitychange is
  // what fires when an iPad drafter switches apps or backgrounds the tab;
  // pagehide is what fires on close and on navigation. A page that listened to
  // one of them would miss whichever half of the drafter's day it did not pick.
  //
  // It writes only when it can write CLEANLY, and the three conditions are the
  // press's own: something to save, a lease to save under, a drawing to
  // serialise. A hide-save that fired without the lease would spend a refusal
  // to learn what holdsLease() already knew, exactly as save() says.
  //
  // NO TIMER, AND THAT IS NOT AN OVERSIGHT. Saving on an interval or a debounce
  // is rung 5, and rung 5 is illegal until this page is the sole model writer.
  // A mutation in the rung-4 PR fires this on a timer specifically so the suite
  // can tell the two rungs apart.
  // THE WRITE THE RELEASE WAITS ON. Rung 4 dropped this promise on the floor,
  // which is what left the write and the lease release racing; the release
  // below chains off it.
  let inFlightWrite = null;
  const saveOnHide = () => {
    if (!dirty || !drawing || !holdsLease()) return;
    const write = writeDrawing();
    inFlightWrite = write;
    // NOTHING ON FAILURE, ON PURPOSE. Stale, refused, store unreachable — the
    // page keeps the edit and keeps saying UNSAVED, because markSaved() runs
    // only inside a resolved write. The failure mode of a best-effort save is
    // "the drafter still has their work and can still see it is unsaved", never
    // "the drafter was told it was fine" on the way out the door.
    //
    // SWALLOWED HERE RATHER THAN IN THE STORED PROMISE. `inFlightWrite` keeps
    // the raw write, so the release can tell a failure from a success and
    // still run either way; a pre-caught promise would hide the difference and
    // make a release chained on success alone look correct.
    write.catch(() => {});
  };
  // REGISTERED BEFORE THE LEASE RELEASE BELOW, WHICH BUYS THE CALL ORDER AND
  // NOTHING MORE. Listeners run in registration order, so this handler is
  // CALLED first — but it starts an asynchronous write and returns, so the
  // release listener runs while that write is still in flight. What guarantees
  // the lease is still live when the write reads it is the release awaiting
  // `inFlightWrite`, below; registration order alone never settled a race
  // between two async operations.
  //
  // WHY THIS WAS NOT A BUG BEFORE THE CHAINING, for the record and not as the
  // guarantee: both paths reach IndexedDB through the store's `withDb`, which
  // awaits one cached connection promise, so the write's continuation is queued
  // as a microtask ahead of the release's and its `readwrite` transaction is
  // created first — and IndexedDB serialises overlapping transactions on a
  // store in creation order. True, load-bearing, and two levels below anything
  // this file says. One added `await` before the write's transaction opens, or
  // the re-open branch inside `withDb`, inverts it silently and nothing
  // reports. That is the sentence this comment used to make, and the reason it
  // was replaced rather than softened.
  window.addEventListener('pagehide', saveOnHide);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'hidden') return;
    saveOnHide();
  });

  // BEST EFFORT, AND NOTHING DEPENDS ON IT (§3.4). The probe found a pagehide
  // IndexedDB write fail to land on a tab reload with no memory pressure at all;
  // the TTL is the real backstop and this only shortens the wait for whoever is
  // next.
  //
  // AFTER THE HIDE-SAVE, AND AFTER IT EITHER WAY. The release is chained on the
  // write's promise SETTLING, not resolving: a write that was refused as stale
  // must still give the lease up, or a failed best-effort save would cost the
  // next drafter the full TTL — a regression traded for nothing. With no write
  // in flight this is exactly what it was.
  //
  // ONLY pagehide RELEASES. visibilitychange deliberately does not: a
  // backgrounded iPad tab is coming back, and handing its lease away while the
  // drafter is reading their mail is how they return to a read-only page.
  window.addEventListener('pagehide', () => {
    const S = window.SharedFileStore;
    if (!holdsLease() || !S || !S.releaseLease) return;
    const release = () => S.releaseLease(BUCKET, LEASE_SCOPE, holderId()).catch(() => {});
    if (inFlightWrite) inFlightWrite.then(release, release);
    else release();
  });

  // ── the change broadcast ────────────────────────────────────────────────────
  // RULING-autosave-two-writers.md §4, rung 2. This page reads its revision
  // once at load and advances it only by its own save, so before this listener
  // existed a single sheet edit in LAYOUT — a write to a key this page does not
  // touch — refused every save from here until the drafter reloaded, and
  // reloading is what costs them the corner they had not saved.
  //
  // A page that hears the write and re-reads is never stale, so it never has
  // anything to overwrite.
  //
  // Reads overlap: two writes land in quick succession and the second read can
  // resolve first, leaving the older file on screen with the newer revision
  // beside it. A sequence number is the cheapest thing that makes the last
  // change asked for the one that wins.
  let adoptSeq = 0;
  const adoptStore = async () => {
    const mine = ++adoptSeq;
    const at = await window.SharedFileStore.loadSharedFileAt(BUCKET);
    if (mine !== adoptSeq) return;
    // A cleared bucket is not a drawing to adopt. Keeping what is on screen is
    // the safe direction: nothing here can put it back.
    if (!at.file) return;
    if (!(await adoptFile(at.file))) return;
    if (mine !== adoptSeq) return;
    // THE REVISION COMES FROM THE READ, NOT FROM THE MESSAGE. loadSharedFileAt
    // takes the file and the revision in ONE transaction, so they describe one
    // state of the bucket. The message's rev describes the write that woke us,
    // and by the time this read ran a third page may have written again —
    // adopting that number would hand the next save an `ifRev` that does not
    // match the drawing it is about to write.
    storeRev = at.rev;
    // NOT fit(). A reload would re-frame the view; a live adopt must not move
    // the drafter's camera out from under them for someone else's edit.
    paint();
    buildChrome();
    loadUnderlayImages();
  };

  if (window.SharedFileStore?.onBucketChanged) {
    window.SharedFileStore.onBucketChanged(BUCKET, change => {
      // OUR OWN SAVE. The store tells every listener, this page's included, so
      // that "the bucket changed" means one thing regardless of who wrote it.
      // Ignoring our own is this page's decision and this is where it is made:
      // without it, every SAVE would be followed by a re-read that replaces the
      // drawing the undo stack points into, and the drafter's history would go
      // with it.
      if (change.writerId === window.SharedFileStore.writerId) return;
      // Nothing on screen yet — boot failed or the store was empty. There is no
      // drawing to keep current and no camera to preserve; a reload is the
      // honest way back and the notice already says so.
      if (!drawing) return;
      // A DIRTY PAGE RE-READS NOTHING. Not the drawing, not the revision: the
      // next save must still be refused, because this page's copy really is
      // built on an older one and rung 1's refusal is what stands between the
      // drafter and somebody else's work being eaten.
      if (dirty) {
        if (elsewhereNote) elsewhereNote.hidden = false;
        return;
      }
      adoptStore().catch(error => {
        console.warn('draft: could not adopt a change from another page', error);
      });
    });
  }

  // ── THE CONVERTER'S HANDOFF ─────────────────────────────────────────────
  //
  // Movie, 11 Oct, of the DWG -> DXF page: "once the file is converted you
  // ask the user if they would like to open the file in ROUGHDRAFTER". The
  // converter (DXF/) is a separate, GPL program; the two share no code and
  // meet only here, at one IndexedDB slot on this origin that it fills and
  // this page empties. A slot older than ten minutes is a leftover from a
  // tab that never got here, and is dropped rather than opened by surprise.
  const HANDOFF = Object.freeze({ db: 'rd-dxf-handoff', store: 'files', key: 'pending', freshMs: 10 * 60 * 1000 });
  const takeHandoff = () => new Promise(resolve => {
    let open;
    try { open = indexedDB.open(HANDOFF.db, 1); } catch { resolve(null); return; }
    open.onupgradeneeded = () => open.result.createObjectStore(HANDOFF.store);
    open.onerror = () => resolve(null);
    open.onsuccess = () => {
      const tx = open.result.transaction(HANDOFF.store, 'readwrite');
      const store = tx.objectStore(HANDOFF.store);
      const get = store.get(HANDOFF.key);
      get.onsuccess = () => {
        const record = get.result || null;
        store.delete(HANDOFF.key);
        tx.oncomplete = () => { open.result.close(); resolve(record); };
      };
      tx.onerror = () => { open.result.close(); resolve(null); };
    };
  });
  const openHandoff = async () => {
    const record = await takeHandoff();
    if (!record || !record.dxf || !(Date.now() - (record.at || 0) < HANDOFF.freshMs)) {
      showTraceCard('The converted DXF did not arrive \u2014 open the downloaded DXF here instead.');
      return;
    }
    const file = new File([record.dxf], record.name || 'converted.dxf', { type: 'application/dxf' });
    inspectTraceFile(file);
  };

  boot().then(() => {
    const order = projectOrder;
    projectOrder = null;
    if (order) runProjectOrder(order);
    if (wantsHandoffAtBoot) openHandoff();
    // ── THE BOARD ONLY MEETS A BLANK SHEET (Movie, 12 Oct) ────────────────
    //
    // "when the user already have plans in memory in the computer (not a
    // blank screen) when they open the website, lets NOT present them with
    // the AUTOBUILD HOUSE menu, lets just let them work on their existing
    // plan and they can press HOUSE/BONE if thy wish for that menu".
    //
    // THIS NARROWS 15 SEP RATHER THAN UNDOING IT. The board still rises by
    // itself for a drafter who arrives at an empty sheet -- they have nothing
    // to work on, and the board is the thing they came for. What changes is
    // the one who HAS a drawing: the front door used to raise it over their
    // plan, and the bone on the bar is how they ask for it now. The old rule
    // was written when the front door meant "start something"; it also means
    // "come back to what I was doing", and only one of those wants a menu.
    //
    // FROM THE BONEYARD IS NOT THE FRONT DOOR, and still rises either way: an
    // empty shelf is what sent that drafter here to pick a house (Movie, 3
    // Oct), so the board IS the errand whatever is on the sheet.
    //
    // AFTER BOOT, BECAUSE THAT IS WHEN THERE IS A DRAWING TO ASK ABOUT -- see
    // `arrivedFrom`. drawingHasWork() is the same answer NEW uses before it
    // offers to save, so "is there anything here" has one definition.
    if (arrivedFrom === 'boneyard' || (arrivedFrom === 'entry' && !drawingHasWork())) {
      pullUpToWindow();
    }
    // ARRIVING ON SITE IS ARRIVING AT THE QUESTION, however the drafter got
    // there. goToLevel covers the press; this covers the other door -- a
    // reload, a bookmark, or LAYOUT handing the page over with ?level=8 --
    // and has to run after boot, because before it there is no drawing to
    // ask whether a lot is already drawn on.
    paintLotPick();
  });
