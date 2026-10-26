// MODEL.html's page script, part 5 of 17: the per-tool properties slot, a shelf saved as a suite, the view rail.
//
// Stage 2 of the split (Movie, 24 Oct: "how can we reduce the MODEL.html
// size in a nice organized way"): the one script the page carried, cut
// at its own section headings and moved here verbatim, in order. The
// parts load one after another as classic scripts and share one scope,
// as they did inside the page; the indent is the page's, kept so every
// line reads as it did there.

  // ── the per-tool properties slot ──────────────────────────────────────────
  // THE CONTRACT, for Gilligan, written so it can be built against without
  // reading anything below it:
  //
  //   window.ModelProps.set(title, node)   puts `node` in the right panel
  //                                        under `title` and shows the slot.
  //   window.ModelProps.clear()            empties it and hides the slot.
  //   window.ModelProps.slot()             the element, if something would
  //                                        rather append to it directly.
  //
  // WHAT THE SHELL PROMISES: the slot exists whenever the page has a drawing,
  // it sits under the view rail in the right panel, and it is hidden while
  // empty so a shut-looking panel never has an empty PROPERTIES heading in it.
  // Opening the right panel is the caller's business, not the slot's -- a tool
  // arming should not yank a panel open under a drafter who closed it.
  //
  // WHAT IT DOES NOT DO: it holds no state, reads no tool, and knows nothing
  // about beams, columns, fixtures or annotations. The armed tool decides what
  // goes here and when; this only owns the space and the show/hide.
  const propsSlot = document.getElementById('props-slot');
  const propsBox = document.getElementById('props-box');
  const propsFold = propsBox.querySelector('[data-props-fold]');

  // FOLDED IS IN THE URL, beside `left` and `right`, for the reason those
  // are: it is what the drafter is looking at and it survives a reload.
  //
  // DEFAULT OPEN, and the absent-means-open spelling is deliberate. A drafter
  // who has just pressed a wall wants to see what he pressed; the box has to
  // earn being shut rather than be shut until asked. `props=0` is the only
  // value that means anything, so a stale or hand-typed URL opens.
  const propsFolded = () => params.get('props') === '0';
  const syncPropsFold = () => {
    propsBox.toggleAttribute('data-folded', propsFolded());
    propsFold.setAttribute('aria-expanded', String(!propsFolded()));
  };
  propsFold.addEventListener('click', () => {
    if (propsFolded()) params.delete('props'); else params.set('props', '0');
    syncUrl();
    syncPropsFold();
  });
  syncPropsFold();

  // THE TAB SAYS THERE IS SOMETHING BEHIND IT, and it does NOT jump the
  // drafter onto that tab. This page already ruled on the difference, six
  // lines up: "a tool arming should not yank a panel open under a drafter who
  // closed it". Switching the pane under his cursor is the same trespass one
  // tab over -- he armed a tool, he did not ask to stop looking at the keys.
  // A lit tab tells him and leaves the move to him.
  // THE TAB SAYS THERE IS SOMETHING BEHIND IT, and it does NOT jump the
  // drafter onto that tab. This page already ruled on the difference, six
  // lines up: "a tool arming should not yank a panel open under a drafter who
  // closed it". Switching the pane under his cursor is the same trespass one
  // tab over -- he armed a tool, he did not ask to stop looking at the keys.
  // A lit tab tells him and leaves the move to him.
  //
  // WHICH MATTERS MORE HERE THAN IT LOOKS. Movie, 29 Sep, asked for every
  // panel on PROPERTIES -- a tool's own controls included -- so arming
  // FENESTRATION from the BUILD tab puts DOOR / WINDOW one tab away. The dot
  // is the whole of what tells him it is there, and without it the panel he
  // needs next is somewhere he has no reason to look.
  const markPropsTab = () => {
    const tab = document.getElementById('props-tab');
    if (tab) tab.toggleAttribute('data-has-props', !propsBox.hidden);
    // THE TWO ARE ONE FACT, so they are set in one place: the line stands in
    // for the box, and a state where both showed -- or neither -- would be
    // the panel lying about whether anything is selected.
    const empty = document.querySelector('[data-props-empty]');
    if (empty) empty.hidden = !propsBox.hidden;
  };

  window.ModelProps = Object.freeze({
    slot: () => propsSlot,
    clear: () => {
      propsSlot.replaceChildren();
      propsSlot.hidden = true;
      // THE BOX GOES WITH ITS CONTENTS. An empty box would leave a PROPERTIES
      // heading and a fold arrow under the tools with nothing behind them --
      // a control that does nothing, which is the same lie a stale panel is.
      propsBox.hidden = true;
      markPropsTab();
    },
    set: (title, node) => {
      propsSlot.replaceChildren();
      if (title) {
        const head = document.createElement('div');
        head.className = 'props-title';
        head.textContent = title;
        propsSlot.append(head);
      }
      if (node) propsSlot.append(node);
      propsSlot.hidden = !(title || node);
      propsBox.hidden = propsSlot.hidden;
      markPropsTab();
    },
  });
  // ONCE AT BOOT, because both the dot and the NOTHING SELECTED line are
  // derived from the box and nothing has touched the box yet. Without this
  // the line is absent on a fresh load -- the one state a drafter is
  // guaranteed to see -- and only appears after the first select and clear.
  markPropsTab();

  // THE LEVEL AND VIEW PICKERS ARE GONE (§7). They were the chrome bar's two
  // SELECTs and the panel's cards were the second way to do the same two
  // things -- one piece of state with two controls on it, which is the drift
  // this page has paid for repeatedly. The panel is the survivor because it
  // says MORE: the layer rows, the datum, the colours, ADD and DELETE. The
  // one thing the pickers had over it was that they were reachable with the
  // rail shut, and the LEVELS / LAYERS tab answers that now: one press opens
  // the panel, the same one press the pickers cost.
  const levelsPanel = document.getElementById('levels-panel');
  const fileRow = document.getElementById('file-row');

  // UNITS. The page already reads `drawing.units` everywhere it prints a
  // length -- `drawing?.units !== 'metric'` is the test, in seven places --
  // so the control is the one thing that was missing, not the plumbing.
  // WHAT IT DOES NOT DO: re-snap the geometry. MODEL.dc.html's _setUnits
  // moves the drawing onto the other system's increments; here the feet in
  // the file are the truth and the unit is how they are READ, so switching
  // changes no coordinate. That is a smaller promise than the old page's and
  // it is the one this page can keep -- a re-snap that rounded a permit
  // drawing's walls on a button press is the opposite of what Movie asked
  // the foot light for.
  //
  // TWO BUTTONS NOW, NOT ONE (Movie, 15 Sep), and the shading is what makes
  // that safe to say: with a toggle, the label had to carry the state,
  // which is why it read "UNITS: IMPERIAL" rather than "IMPERIAL". Two
  // buttons name the two systems and the accent says which is in force, so
  // neither label has to do a second job. Each is a SET, not a toggle --
  // pressing IMPERIAL while imperial is in force does nothing, where a
  // toggle pressed twice by a slipping thumb changed the drawing.
  const unitButtons =
    [...document.querySelectorAll('#units-corner button[data-units]')];
  const metric = () => drawing?.units === 'metric';
  const paintUnits = () => {
    unitButtons.forEach(b => b.setAttribute('aria-pressed',
      String((b.dataset.units === 'metric') === metric())));
  };
  unitButtons.forEach(b => b.addEventListener('click', () => {
    if (!drawing) return;
    const wanted = b.dataset.units === 'metric';
    if (wanted === metric()) return;
    drawing.units = wanted ? 'metric' : 'imperial';
    markDirty();
    paintUnits();
    // THE SIZE BOXES READ THE SWITCH TOO, and an open panel would otherwise go
    // on showing 3'-0" on a drawing that now says 915 everywhere else.
    if (selectionPanelUp) showSelectionProps();
    else showToolProps(activeTool);
    paint();
  }));

  // replaceState, not pushState: a switch is a change of viewpoint, not a
  // navigation, and forty pushes would bury whatever page the drafter came
  // from under forty presses of Back.
  const syncUrl = () => {
    const query = params.toString();
    history.replaceState(null, '',
      query ? `${location.pathname}?${query}` : location.pathname);
  };

  // THE PANEL IS A VIEW OF `drawing.levels`, never a second copy of it. Every
  // row here drives goToLevel / goToView -- the same two entry points the
  // pickers use -- so the card, the seat, the picker and the plan cannot
  // disagree about what is active. That is the seam Devin drew between this
  // panel and the tool column: the panel owns the level/view state and
  // everything else reads it.
  //
  // The layer rows come from layerViewsForLevelId and are NOT hard-coded.
  // ROOF and SITE answer with none, which is why their cards carry no rows --
  // the same fact that puts them in one rail row together rather than two.
  // COPIED FROM MODEL.dc.html:2292, not remembered. Its own comment records
  // why it is one list: fenestrations, fixtures, stairs, notes and roomTags
  // were each missing from the delete at some point, so deleting a level left
  // its doors, windows, appliances, stairs, annotations and room names behind
  // -- pointing at a level id that no longer existed, invisible on every
  // level, and carried through save after save. Retyping it from memory is
  // how that happens a second time.
  //
  // NOT here, deliberately and for the old page's reasons: boneyardOutlines
  // (the master is storage, not a level), groups (membership spans levels and
  // is cleaned below), and cuts (owned by level id, handled separately).
  const LEVEL_OWNED_COLLECTIONS = [
    'lines', 'walls', 'floors', 'shapes', 'roofs', 'outlines',
    'surfaceOpenings', 'dimensions', 'columns', 'beams',
    'fenestrations', 'fixtures', 'stairs', 'notes', 'roomTags',
    'electricDevices', 'underlays',
  ];

  // ADD A LEVEL — MODEL.dc.html:9850 `_addLevel`, carried rather than invented.
  // The elevation it suggests is the assembly below plus its floor sandwich,
  // NOT a round 9': a suggestion that disagrees with the construction the
  // level cards already show is worse than no suggestion.
  const addLevel = () => {
    if (!drawing) return;
    const LV = window.DraftLayerViews;
    const LA = window.DraftLevelAssembly;
    const floors = LV.floorLevels(drawing.levels || []);
    const count = floors.length + 1;
    const suggestedName = `${count === 1 ? '1ST' : count === 2 ? '2ND'
      : count === 3 ? '3RD' : `${count}TH`} FL`;
    const name = window.prompt('Level name:', suggestedName);
    if (name === null) return;
    const topFloor = floors[floors.length - 1];
    const assemblyOf = id => LA.levelAssemblyFor(drawing.levelAssemblies, id);
    const suggestedElev = topFloor
      ? Math.round(((Number(topFloor.elev) || 0)
        + assemblyOf(topFloor.id).wallHeightFt
        + LA.levelFloorFt(assemblyOf(topFloor.id))) * 10000) / 10000
      : 0;
    const elevRaw = window.prompt(
      topFloor
        ? `Elevation in feet, top of this floor (negative = below grade).\n`
          + `Suggested: ${suggestedElev} — ${topFloor.name} wall + floor.`
        : 'Elevation in feet (negative = below grade):',
      String(suggestedElev));
    if (elevRaw === null) return;
    const elev = parseFloat(elevRaw);
    if (Number.isNaN(elev)) return;

    const id = Number.isInteger(drawing.nextLevelId) ? drawing.nextLevelId : 1;
    const level = { id, name: String(name).toUpperCase().trim(), elev, visible: true };
    // Every regular level carries a copy of each BONEYARD master outline, so a
    // freshly added floor starts with the inherited geometry rather than bare.
    //
    // LINKED, AND WITH ITS OWN POINTS. This read
    //
    //   drawing.outlines.push({ ...master, id: ..., levelId: id });
    //
    // and was wrong twice, in opposite directions that hid each other.
    //
    // NO LINK. The copy carried no masterId and its points no srcId, so
    // nothing could find it again. _propagateMasterOutline (MODEL.dc.html:
    // 12057) selects copies by `outline.masterId === master.id` and then each
    // point by `point.srcId`; with both null the ported propagation would have
    // moved NOTHING, on every drawing this page has ever made -- and a check
    // for it would have passed by finding no work to do. That is the order's
    // "the master is a stamp, not a governor", measured.
    //
    // AND TOTAL ALIASING. `{ ...master }` is a shallow spread, so the copy and
    // the master shared ONE points array. Moving a corner on the second floor
    // moved the master and therefore every other floor -- not by propagation
    // but by there only ever being one set of coordinates, which also makes a
    // per-level override impossible to express.
    //
    // offX/offZ start at ZERO because the copy starts coincident, and
    // relinkVertex re-measures them on every drag. That is the same
    // srcId/offset contract the dimension ends, beams and columns already use.
    (drawing.boneyardOutlines || []).forEach(master => {
      drawing.outlines = drawing.outlines || [];
      drawing.outlines.push({
        ...master,
        id: newDrawingItemId('outline'),
        levelId: id,
        masterId: master.id,
        shelfId: undefined,          // a level copy is not shelf storage
        overriddenSrcIds: [],
        points: (master.points || []).map(pt => ({
          ...pt,
          id: undefined,             // the copy's point is not the master's
          srcId: pt.id,
          offX: 0,
          offZ: 0,
        })),
      });
    });
    // ABOVE THE TOP FLOOR AND BELOW ROOF, which is where the old page stacks a
    // new storey -- levels are stored top-down, so that is the top floor's own
    // index rather than the end of the list.
    const levels = [...(drawing.levels || [])];
    const insertIdx = topFloor
      ? levels.findIndex(entry => entry.id === topFloor.id)
      : levels.length;
    levels.splice(insertIdx < 0 ? levels.length : insertIdx, 0, level);
    drawing.levels = levels;
    drawing.nextLevelId = id + 1;
    markDirty();
    buildChrome();
    paint();
    return level;
  };

  // DELETE A LEVEL — MODEL.dc.html:9895 `_deleteLevel`. It does not refuse and
  // does not orphan: it confirms, then takes everything the level owned.
  const deleteLevel = levelId => {
    if (!drawing) return false;
    const levels = drawing.levels || [];
    if (levels.length <= 1) { window.alert('Cannot delete the last level.'); return false; }
    const idx = levels.findIndex(level => Number(level.id) === Number(levelId));
    if (idx < 0) return false;
    if (!window.confirm(`Delete level "${levels[idx].name}"? `
      + 'Geometry on this level will be removed.')) return false;

    // PENDING GEOMETRY BELONGS TO THE FLOOR IT WAS STARTED ON. Discard it
    // before the level list changes, or a half-drawn wall commits into
    // whichever floor the page lands on next.
    //
    // THIS WAS `setArmed(false)` AND THE MERGE THAT BROKE IT WAS CLEAN. The
    // tool register replaced the armed boolean, and setArmed went with it;
    // this call arrived from a branch written against the old shape, in a
    // region of the file neither side had touched, so git had nothing to
    // report. The line threw, deleteLevel stopped at its first statement, and
    // a level "deleted" with all its geometry still in the file -- which is
    // why tests/model-html-levels.spec.js's cascade check is worth its length.
    // setTool does what setArmed did and clears the pending anchor too, which
    // is what the paragraph above is actually asking for.
    setTool(RESTING_TOOL);
    const id = Number(levels[idx].id);
    // ASKED BEFORE THE LEVEL IS REMOVED, and that ordering is the whole of it.
    // Asking afterwards returns the FALLBACK -- activeLevelId drops to MAIN FL
    // and then to the first level when `?level=` names one that is gone -- so
    // the test "am I standing on the level being deleted" was never true and
    // the URL went on naming a level the drawing no longer had.
    const wasStandingHere = activeLevelId() === id;

    const droppedUnderlays = (drawing.underlays || []).filter(u => u && u.levelId === id);
    const goneIds = new Set();
    LEVEL_OWNED_COLLECTIONS.forEach(field => {
      if (!Array.isArray(drawing[field])) return;
      drawing[field].forEach(item => { if (item && item.levelId === id) goneIds.add(String(item.id)); });
      drawing[field] = drawing[field].filter(item => !item || item.levelId !== id);
    });
    // An underlay's PICTURE lives outside the drawing, in its own bucket keyed
    // by the underlay id, so dropping the record is only half of it -- the
    // bytes would sit in the browser profile for ever with nothing pointing at
    // them.
    droppedUnderlays.forEach(underlay => {
      window.SharedFileStore?.removeNamedFile?.(underlay.id, 'underlays')
        ?.catch(error => console.warn('Underlay binary removal failed:', error));
    });
    // Cuts are owned by a level id, not by elevation: two levels can sit at the
    // same height, so only this level's own sections go with it.
    if (Array.isArray(drawing.cuts)) {
      drawing.cuts = drawing.cuts.filter(cut => cut && cut.levelId !== id);
    }
    // Groups reference members by {type, id} and can span levels, so they are
    // cleaned rather than dropped -- and a group left holding a dead id would
    // adopt the next item given that id, which is the fault the wall cascade
    // above already guards.
    if (Array.isArray(drawing.groups)) {
      drawing.groups.forEach(group => {
        if (group && Array.isArray(group.members)) {
          group.members = group.members.filter(m => m && !goneIds.has(String(m.id)));
        }
      });
      drawing.groups = drawing.groups.filter(g => g && Array.isArray(g.members) && g.members.length >= 2);
    }
    drawing.backgroundLevelIds = (drawing.backgroundLevelIds || []).filter(x => Number(x) !== id);
    if (drawing.backgroundLevelViews && typeof drawing.backgroundLevelViews === 'object') {
      delete drawing.backgroundLevelViews[String(id)];
    }
    drawing.levels = levels.filter((_, i) => i !== idx);

    // The drafter has to land somewhere real. If the level being deleted is
    // the one on screen, step to its neighbour rather than leaving `?level=`
    // pointing at a level that no longer exists.
    if (wasStandingHere) {
      const next = drawing.levels[Math.min(idx, drawing.levels.length - 1)];
      params.set('level', String(next.id));
      params.delete('view');
      syncUrl();
    }
    markDirty();
    buildChrome();
    paint();
    return true;
  };

  // WHICH ROW IS LIT, in one place. buildLevelsPanel draws the rows and this
  // lights them, so the rule lives once -- the level lookup having had four
  // homes (#325) is the reason that matters here rather than being tidy.
  const markActiveLayer = () => {
    if (!levelsPanel) return;
    const activeId = activeLevelId();
    const LV = window.DraftLayerViews;
    const asked = params.get('view');
    // A CUT IS A VIEW TOO. Standing in a section, no layer row is lit: the
    // section's own row carries the mark, and lighting FLOOR PLAN under a
    // painted section is the panel disagreeing with the canvas.
    const inCut = typeof asked === 'string' && asked.startsWith(CUT_VIEW);
    const live = !inCut && asked
      && LV.layerViewsForLevelId(activeId).some(v => v.id === asked)
      ? asked : LV.defaultLayerViewId(activeId);
    // THIS PASS OWNS `data-active`, and that is why the boneyard is named in
    // it rather than lighting itself during the build. It runs over EVERY
    // .lv-card and .lv-layer after buildLevelsPanel, so a card that set the
    // attribute on itself a moment earlier has it taken straight back off --
    // which is exactly what the boneyard card did for an hour: `toggleAttribute
    // ('data-active', true)` ran, under a condition measured true, and the
    // attribute was gone by the time anything could read it.
    //
    // Two places deciding which row is lit is how the panel and the canvas
    // come to disagree. One place, and the boneyard is one of the things it
    // knows can be active.
    levelsPanel.querySelectorAll('.lv-layer').forEach(row => {
      if (row.dataset.shelf !== undefined) {
        row.toggleAttribute('data-active',
          boneyardActive && Number(row.dataset.shelf) === activeShelfId());
        return;
      }
      if (row.dataset.viewRow) {
        row.toggleAttribute('data-active', row.dataset.viewRow === asked);
        return;
      }
      // A LEVEL'S LAYER ROW IS NEVER LIT ON THE BONEYARD. Without this the
      // panel shows MAIN FL's FLOOR PLAN lit while the canvas draws a shelf.
      row.toggleAttribute('data-active',
        !inCut && !boneyardActive && row.dataset.layer === `${activeId}:${live}`);
    });
    levelsPanel.querySelectorAll('.lv-card').forEach(card => {
      if (card.dataset.boneyard !== undefined) {
        card.toggleAttribute('data-active', boneyardActive);
        return;
      }
      card.toggleAttribute('data-active',
        !boneyardActive && Number(card.dataset.level) === activeId);
    });
  };

  const buildLevelsPanel = () => {
    if (!levelsPanel) return;
    const levels = drawing?.levels || [];
    const LV = window.DraftLayerViews;
    const activeId = activeLevelId();
    levelsPanel.innerHTML = '';
    if (!levels.length) return;

    const head = document.createElement('div');
    head.className = 'lv-head';
    const title = document.createElement('div');
    title.className = 'lv-head-title';
    title.textContent = 'Levels';
    const datum = document.createElement('div');
    datum.className = 'lv-datum';
    // The old page's DATUM readout. It reads the stored elevationDatum rather
    // than assuming 0, because a drafter who has moved it would otherwise see
    // a panel confidently disagreeing with his own drawing.
    datum.textContent = `DATUM ${Number(drawing?.elevationDatum || 0)}'`;
    const add = document.createElement('button');
    add.type = 'button';
    add.className = 'lv-add';
    add.dataset.addLevel = '';
    add.textContent = '+ ADD';
    add.title = 'Add a level above the top floor';
    add.addEventListener('click', addLevel);
    head.append(title, datum, add);
    levelsPanel.append(head);

    // ── THE SHEET SET'S ORDER HERE TOO (Movie, 13 Oct) ──────────────────────
    //
    // "and for the lower down area of level/layers in text, also put it in
    // that same order staring with SITE PLAN, than ELEVATIONS, than ROOF, 2nd
    // fl, Main Fl, Foundation, SECTIONS". The levels were already in that
    // order among themselves; what was out of place was the ELEVATIONS group,
    // which sat after every level card. So the card builder is lifted out of
    // its loop and called in two passes with the elevations between them --
    // the panel and the rail now read the same way down, which is the whole
    // point of asking for one order.
    const levelCard = level => {
      const card = document.createElement('div');
      card.className = 'lv-card';
      card.dataset.level = String(level.id);
      if (Number(level.id) === activeId) card.toggleAttribute('data-active', true);

      const bar = document.createElement('div');
      bar.className = 'lv-bar';
      bar.style.background = level.color || 'var(--rule)';

      const body = document.createElement('div');
      body.className = 'lv-body';

      const name = document.createElement('button');
      name.type = 'button';
      name.className = 'lv-name';
      // `data-level-row`, and it stays that way now that the chrome bar's
      // select is gone: these rows are THE way to change level, and a name
      // that once collided with the select is the name every spec drives.
      name.dataset.levelRow = String(level.id);
      // THE NUMBERED NAME, derived rather than stored -- level-assembly.js's
      // levelLabel. The record keeps whatever it was saved with, so a file is
      // byte-identical either side of this and every lookup by stored name
      // goes on working; only what the drafter READS changes.
      const label = levelLabel(level.id, level.name);
      name.textContent = label;
      name.title = `Switch to ${label}`;
      name.addEventListener('click', () => goToLevel(level.id));
      // ── A HALF FLOOR SAYS WHERE ITS PICTURE IS (Movie, 14 Oct) ──────────
      //
      // The preview rail above no longer seats a card for it -- its drawing
      // is on its full floor's card, lighter -- and a level present in this
      // list with no card up there reads as something missing rather than
      // something folded. So the row says so, and the name is still the
      // press that goes to the level: "i may want to allow the user to click
      // on that 'floor level' and then go into that level to edit the floor
      // or whatever they need to edit on that level".
      const LP = window.DraftLayoutPlan;
      let rides = null;
      if (LP && LP.ridesOnFullFloor(drawing, level.id)) {
        const full = LP.fullFloorOver(level.id);
        const fullName = levelLabel(full,
          (levels.find(other => Number(other.id) === full) || {}).name);
        card.dataset.ridesOn = String(full);
        name.title = `Switch to ${label} — drawn on ${fullName}'s preview`;
        rides = document.createElement('div');
        rides.className = 'lv-rides';
        rides.textContent = `drawn on ${fullName}`;
      }

      const del = document.createElement('button');
      del.type = 'button';
      del.className = 'lv-del';
      del.dataset.deleteLevel = String(level.id);
      del.textContent = '×';
      del.title = `Delete ${label}`;
      del.addEventListener('click', event => {
        event.stopPropagation();
        deleteLevel(level.id);
      });

      const headRow = document.createElement('div');
      headRow.className = 'lv-card-head';
      headRow.append(name, del);
      body.append(headRow);
      if (rides) body.append(rides);

      const views = LV.layerViewsForLevelId(level.id);
      if (views.length) {
        const stack = document.createElement('div');
        stack.className = 'lv-layers';
        views.forEach(view => {
          const row = document.createElement('button');
          row.type = 'button';
          row.className = 'lv-layer';
          row.dataset.layer = `${level.id}:${view.id}`;
          row.textContent = view.label || view.id;
          row.addEventListener('click', () => {
            if (Number(level.id) !== activeId) goToLevel(level.id);
            goToView(view.id);
          });
          stack.append(row);
        });
        body.append(stack);
      }

      card.append(bar, body);
      levelsPanel.append(card);
    };

    // ── ELEVATIONS ──────────────────────────────────────────────────────────
    // Real, and the same four the rail seats: autoElevationCuts is the one
    // home for that derivation, so the panel and the seats cannot disagree
    // about which elevations exist or what they are called.
    const section = (label, extra) => {
      const wrap = document.createElement('div');
      wrap.className = 'lv-head';
      wrap.style.marginTop = '8px';
      const t = document.createElement('div');
      t.className = 'lv-head-title';
      t.textContent = label;
      wrap.append(t);
      if (extra) wrap.append(extra);
      levelsPanel.append(wrap);
      return wrap;
    };
    const rowButton = (text, title, onClick, active) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'lv-layer';
      b.textContent = text;
      b.title = title;
      if (active) b.toggleAttribute('data-active', true);
      if (onClick) b.addEventListener('click', onClick);
      else b.disabled = true;
      levelsPanel.append(b);
      return b;
    };

    // SITE FIRST, THEN THE ELEVATIONS, THEN EVERYTHING ELSE. Asked by level
    // id rather than by name or by position, the way the rail seats it: a
    // drafter who renames SITE still gets his order, and a drawing without one
    // simply starts at the elevations.
    levels.filter(level => Number(level.id) === SITE_LEVEL_ID).forEach(levelCard);

    section('Elevations');
    const viewNow = params.get('view');
    autoElevationCuts().forEach(cut => {
      rowButton(`${cut.id} · ${elevationName(cut.id)}`,
        `${cut.id} — the ${elevationName(cut.id)} elevation; tap to bring it center`,
        () => goToView(CUT_VIEW + cut.id),
        viewNow === CUT_VIEW + cut.id).dataset.viewRow = CUT_VIEW + cut.id;
    });

    // AND THE REST IN THE STACK'S OWN ORDER -- ROOF, the floors top down,
    // FOUNDATION -- which is already the order he asked for.
    levels.filter(level => Number(level.id) !== SITE_LEVEL_ID).forEach(levelCard);

    // ── SECTIONS ────────────────────────────────────────────────────────────
    const stored = cuts();
    // + CUT, AND NOT A KEY. The old page's hint is "Press [C] to cut a view",
    // and `cut: 'C'` is in DEFAULT_KEYBINDINGS to this day -- but this page
    // binds no tool letters at all, and a cut a drafter can only reach from a
    // keyboard is no cut on the iPad at the counter. The button is the
    // affordance; the letter can follow it whenever the keypad does.
    //
    // It sits in the SECTIONS head beside its own list, where + ADD sits for
    // levels and + SHELF for the boneyard -- the place a drafter already looks
    // to make one more of the thing under it.
    const cutBtn = document.createElement('button');
    cutBtn.type = 'button';
    cutBtn.className = 'lv-add';
    cutBtn.dataset.addCut = '';
    cutBtn.textContent = '+ CUT';
    cutBtn.title = 'Cut a section — press the two ends of the line, then the '
      + 'side you want to look from';
    cutBtn.addEventListener('click', event => { event.stopPropagation(); armCut(); });
    section('Sections', cutBtn);
    if (!stored.length) {
      // THIS NAMED THE GESTURE -- "No sections yet. Press + CUT, then the two
      // ends of the line and the side to look from" -- on the reasoning that
      // an empty state is the one text a drafter reads when nothing else is on
      // screen. Movie, 25 Sep, reading it in the panel: "there is a line with
      // a lone sentence in the LEVELS / LAYERS tab" ... "just say 'NO
      // SECTIONS'".
      //
      // THE GESTURE IS ALREADY ON THE BUTTON BESIDE IT. + CUT carries the
      // whole instruction in its own title, four lines above, so the sentence
      // was the same help written twice -- and the second copy was the one
      // wrapping to three lines inside a panel that is already taking the
      // drawing's width.
      const none = document.createElement('div');
      none.className = 'lv-empty';
      none.dataset.noSections = '';
      none.textContent = 'NO SECTIONS';
      levelsPanel.append(none);
    }
    stored.forEach(cut => {
      const row = document.createElement('div');
      row.className = 'lv-card-head';
      const b = rowButton(cut.name || cut.id,
        `${cut.name || cut.id} — tap to bring this section center`,
        () => goToView(CUT_VIEW + cut.id),
        viewNow === CUT_VIEW + cut.id);
      b.dataset.viewRow = CUT_VIEW + cut.id;
      const del = document.createElement('button');
      del.type = 'button';
      del.className = 'lv-del';
      del.dataset.deleteCut = String(cut.id);
      del.textContent = '×';
      del.title = `Delete ${cut.name || cut.id}`;
      del.addEventListener('click', event => {
        event.stopPropagation();
        if (!window.confirm(`Delete section "${cut.name || cut.id}"?`)) return;
        drawing.cuts = cuts().filter(c => c.id !== cut.id);
        // A drafter looking AT the section being deleted has to be moved off
        // it, or the page keeps painting a cut the drawing no longer has.
        if (params.get('view') === CUT_VIEW + cut.id) {
          params.delete('view');
          syncUrl();
        }
        markDirty();
        buildChrome();
        paint();
      });
      b.style.flex = '1';
      levelsPanel.removeChild(b);
      row.append(b, del);
      levelsPanel.append(row);
    });

    // ── THE BONEYARD ────────────────────────────────────────────────────────
    // THIS READ "LISTED, NOT EDITED, and that is a ruling rather than an
    // omission" -- the shelf names printed as dead text because "the level
    // picker offers no negative pseudo-level, so there is nowhere for a new
    // shelf to be used. '+ SHELF' would write a shelf into the file that this
    // page can never open." That reasoning was exactly right and is now spent:
    // activeLevelId() answers -shelfId, so there IS somewhere for a shelf to
    // be used, and a wall parked on one survives the reload (c8654eb).
    //
    // Movie ruled it back on, 14 Sep: "yes boneyard should be working so i can
    // copy and paste stuff in there that won't show on the plan".
    //
    // PINNED LAST, and that is a rule rather than an accident of order: a
    // basement added beneath the foundation lands ABOVE this card, because
    // the boneyard is not a storey. Built after the level loop for exactly
    // that reason, and acceptance 7 asserts it by POSITION -- a row that
    // sorts last in the markup but paints halfway up is still wrong.
    const shelfList = shelves();
    section('Boneyard');
    const bone = document.createElement('div');
    bone.className = 'lv-card';
    bone.dataset.boneyard = '';
    if (boneyardActive) bone.toggleAttribute('data-active', true);
    bone.title = 'BONEYARD — shelf storage: geometry parks in its exact '
      + 'position, never prints';

    const boneHead = document.createElement('div');
    boneHead.className = 'lv-head';
    const boneName = document.createElement('div');
    boneName.className = 'lv-head-title';
    boneName.textContent = 'BONEYARD';
    const plus = document.createElement('button');
    plus.type = 'button';
    plus.className = 'lv-add';
    plus.dataset.addShelf = '';
    plus.textContent = '+ SHELF';
    // DC'S OWN TOOLTIP, which states the reason shelves exist at all rather
    // than what the button does: a drafter who cannot see why he would want a
    // second shelf never presses it.
    plus.title = 'Add a shelf — park geometry at the same spot on different '
      + 'shelves without overlap';
    plus.addEventListener('click', event => { event.stopPropagation(); addShelf(); });
    // SAVE AS SUITE (Movie, 20 Oct: "ALLOW users to use the BONEYARD - as a
    // little mini model area and they can independanatly SAVE whatever is in
    // there as a SUITE. (but a draft file)"). The shelf the drafter is on,
    // and only it, written as a suite .draft named for the shelf.
    const saveShelf = document.createElement('button');
    saveShelf.type = 'button';
    saveShelf.className = 'lv-add';
    saveShelf.dataset.saveShelf = '';
    saveShelf.textContent = 'SAVE AS SUITE';
    saveShelf.hidden = !boneyardActive;
    saveShelf.title = 'Save what is on this shelf, and only it, as its own SUITE .draft';
    saveShelf.addEventListener('click', event => { event.stopPropagation(); askShelfSuite(); });
    // OPEN SUITE (Movie, 21 Oct: "where a suite will open in the shelf and i
    // can put all the SUITES in the same file as the SHELL and go into the
    // SHELFS if i need to edit them"): a suite .draft onto a new shelf of its
    // own, named for the file, read by openShelfSuite below.
    const openShelf = document.createElement('button');
    openShelf.type = 'button';
    openShelf.className = 'lv-add';
    openShelf.dataset.openShelfSuite = '';
    openShelf.textContent = 'OPEN SUITE';
    openShelf.title = 'Open a SUITE .draft onto a new shelf, kept in this file to change';
    openShelf.addEventListener('click', event => {
      event.stopPropagation();
      openShelfSuite();
    });
    boneHead.append(boneName, plus, saveShelf);
    // ON A LINE OF ITS OWN, always there: in the head it would wrap the
    // moment SAVE AS SUITE shows, and the shelves under it would jump between
    // the two clicks of a rename's double-click.
    const openRow = document.createElement('div');
    openRow.className = 'lv-open-suite';
    openRow.append(openShelf);
    bone.append(boneHead, openRow);
    bone.addEventListener('click', () => goToBoneyard());
    levelsPanel.append(bone);

    shelfList.forEach(shelf => {
      const row = document.createElement('button');
      row.type = 'button';
      row.className = 'lv-layer';
      row.dataset.shelf = String(shelf.id);
      if (boneyardActive && Number(shelf.id) === activeShelfId()) {
        row.toggleAttribute('data-active', true);
      }
      row.append(document.createTextNode(shelf.name || `SHELF ${shelf.id}`), shelfCloseX(shelf));
      row.title = `Show only ${shelf.name || `SHELF ${shelf.id}`} — each shelf `
        + 'keeps its own geometry';
      row.addEventListener('click', event => {
        event.stopPropagation();
        // A CLICK ON THE SHELF ALREADY OPEN STAYS PUT -- and so does the
        // second click of a double-click, which is the rename's: going there
        // again would rebuild this row under the pointer and the double-click
        // would land on nothing.
        if (row.querySelector('input')) return;
        if (boneyardActive && Number(shelf.id) === activeShelfId()) return;
        goToBoneyard(Number(shelf.id));
      });
      // A DOUBLE-CLICK RENAMES IT (Movie, 20 Oct: "if i double click on
      // SHELF1 name it will allow me to rename it (2 BEDROOM in this case)").
      row.addEventListener('dblclick', event => {
        event.preventDefault();
        event.stopPropagation();
        renameShelf(row, Number(shelf.id));
      });
      levelsPanel.append(row);
    });

    markActiveLayer();
  };

  // THE ONE REBUILD, and it is now the panel's. Everything that used to call
  // buildChrome() to re-fill two SELECTs calls it to redraw the cards, which
  // is the same job with one control left instead of three.
  const buildChrome = () => {
    buildLevelsPanel();
    paintUnits();
    if (fileRow) fileRow.hidden = false;
    // THE WRITE BUTTONS COME ALIVE WITH THE THING THEY WRITE, and here rather
    // than in the loader because a drawing arrives two ways -- stored on
    // arrival, and NEW/OPEN once the page is up -- and only one of them used
    // to say so. The lease painter may put them straight back down if
    // another page holds the file: something to save first, permission to
    // save second.
    const saveAsButton = document.getElementById('file-save-as');
    if (saveButton) saveButton.disabled = !drawing;
    if (saveAsButton) saveAsButton.disabled = !drawing;
    buildShelfStrip();
  };

  // ONE WAY INTO THE BONEYARD, and one way out. The card and every shelf row
  // come through here, so the panel, the plan and what a new wall is stamped
  // with cannot disagree about where the drafter is.
  //
  // CHANGES WHAT IS LOOKED AT AND, WHEN THE SHELF MOVES, ONE THING THAT IS
  // SAVED. Which shelf is active is a fact about the drawing -- reopen it
  // tomorrow and the shelf you were working on is the one you get -- so a
  // shelf switch marks dirty. Being ON the boneyard is not saved at all, the
  // same call DC makes at :5606.
  const goToBoneyard = (shelfId = null) => {
    const want = shelfId === null ? activeShelfId() : Number(shelfId);
    const moved = drawing && Number(drawing.activeBoneyardShelfId) !== want;
    if (drawing && moved) { drawing.activeBoneyardShelfId = want; markDirty(); }
    boneyardActive = true;
    // A HALF-TAKEN GESTURE DOES NOT FOLLOW YOU ACROSS, which is the same rule
    // Escape enforces and the same one DC applies on _selectBoneyard (:9). A
    // run begun on MAIN FL and finished on a shelf would weld two workspaces
    // together through one wall.
    drawStart = null;
    pendingBone = null;
    selection = [];
    buildChrome();
    paint();
  };

  // ENTERING A SHELF FRAMES ITS ITEM (Movie, 23 Oct: "when a user enters a
  // SHELF can the zoom go to center the item in the viewport and leave a
  // little extra space on the sides"): the page's own fit, with a roomier
  // margin than a floor's, once the shelf is the drafting context.
  const SHELF_FIT_MARGIN = 0.74;
  // THE SQUARE IN HAND (see the drag in buildShelfStrip): where the press
  // began and which shelf's, until the hand lets go anywhere.
  let shelfPress = null;
  const SHELF_DRAG_PX = 6;
  // A FLOOR PLAN IS WHERE A SUITE CAN BE DROPPED (Movie: "the DRAG won't
  // work unless they are in a FLOOR PLAN type main area"): one of the
  // house's floors, on its plan or floor view, not a shelf, a cut or a site.
  const onFloorPlanMain = () => {
    if (!drawing) return false;
    // ONE OF THE HOUSE'S FLOORS: a shelf's level is negative, the site's and
    // the roof's are not floors.
    if (!floorsOf(drawing.levels).some(l => Number(l.id) === Number(activeLevelId()))) return false;
    // AND ITS PLAN OR FLOOR VIEW: an elevation or a section reports its own
    // id here (activeViewId), which is no plan view, and ELECTRIC and STAIR
    // are layer views of the floor, not the floor plan.
    const v = activeViewId();
    return v == null || !!H()?.VIEWS?.has(v);
  };
  // THE SHELF'S SUITE COMES IN UNDER THE HAND, carried by its registration
  // corner (the gold one), and goes down where the hand lets go. One UNDO
  // takes it off again; Esc while it is in hand does the same.
  const dragShelfSuite = (shelfId, event) => {
    const shelf = shelves().find(sh => Number(sh.id) === shelfId);
    const name = shelf?.name || `SHELF ${shelfId}`;
    if (!onFloorPlanMain()) {
      sayOnStrip(`${name} drops onto a FLOOR PLAN: stand on one of the house's floors and drag the square again.`);
      return;
    }
    const file = shelfSuiteFile(shelfId, shelf?.suiteKind || 'residential');
    const count = ['walls', 'lines', 'fenestrations', 'fixtures', 'floors']
      .reduce((n, key) => n + (Array.isArray(file[key]) ? file[key].length : 0), 0);
    if (!count) { sayOnStrip(`${name} is empty -- draw the suite on it first.`); return; }
    const made = bringInHologram(suiteOnFloor(file), name);
    if (!made) return;
    const { holo } = made;
    const at = tracePoint(event);
    const nodes = H()?.suiteSuperNodes ? H().suiteSuperNodes(holo, activeLevelId()) : [];
    const grip = nodes.find(n => n.registration)?.point
      || (nodes.length ? { x: nodes.reduce((a, n) => a + n.point.x, 0) / nodes.length, z: nodes.reduce((a, n) => a + n.point.z, 0) / nodes.length }
        : { x: holo.x, z: holo.z });
    holo.x += at.x - grip.x;
    holo.z += at.z - grip.z;
    traceMoving = { underlay: holo, from: at, before: { ...holo }, hologram: true, shelfDrop: true };
    sayOnStrip(`${name} is in hand by its gold corner — let go where it belongs; Esc puts it back on the shelf.`);
    paint();
  };
  const enterShelf = shelfId => {
    goToBoneyard(shelfId);
    fit(false, SHELF_FIT_MARGIN);
    paint();
  };
  // THE SHELF PREVIEWS ABOVE THE BONE (Movie, 23 Oct; see #shelf-strip's
  // CSS). One square per shelf, each a miniature of the shelf drawn by the
  // page's own painters (paintPlanThumb, the rail's seats' way), the shelf
  // the drafter stands on lit; a press enters that shelf. The row retracts
  // into a SHELVES tab, remembered with the lights (keepLight). RETRACTED
  // UNTIL ASKED FOR: the squares stand over the sheet's foot, where a fitted
  // drawing's south wall is, and a press there must land on the wall until
  // the drafter has chosen the squares; the tab alone sits in the fit's own
  // margin and covers nothing a press wants.
  let shelfStripOpen = stored.shelfStrip === true;
  const shelfStrip = () => document.getElementById('shelf-strip');
  const buildShelfStrip = () => {
    const bar = document.getElementById('dt-bar');
    if (!bar) return;
    let strip = shelfStrip();
    if (!strip) {
      strip = document.createElement('div');
      strip.id = 'shelf-strip';
      strip.dataset.shelfStrip = '';
      const previews = document.createElement('div');
      previews.id = 'shelf-previews';
      previews.dataset.shelfPreviews = '';
      const tab = document.createElement('button');
      tab.id = 'shelf-tab';
      tab.type = 'button';
      tab.dataset.shelfTab = '';
      tab.addEventListener('click', () => {
        shelfStripOpen = !shelfStripOpen;
        keepLight('shelfStrip', shelfStripOpen);
        buildShelfStrip();
      });
      // OPEN SUITE LEFT OF THE TAB, SAVE AS SUITE RIGHT OF IT (Movie, 23 Oct:
      // "bring out 2 button on either side of the SHELF tab (about the same
      // size) the left one says OPEN SUITE and right one SAVE AS SUITE" --
      // "will only be on when they are in a SHELF view in the main area").
      // The same two presses the LEVELS pane's BONEYARD head offers.
      const row = document.createElement('div');
      row.id = 'shelf-tab-row';
      const side = (id, label, title, press) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.id = id;
        b.className = 'shelf-tab-side';
        b.textContent = label;
        b.title = title;
        b.hidden = true;
        b.addEventListener('click', event => { event.stopPropagation(); press(); });
        return b;
      };
      row.append(
        side('shelf-open-suite', 'OPEN SUITE', 'Open a SUITE .draft onto a new shelf, kept in this file to change', () => openShelfSuite()),
        tab,
        side('shelf-save-suite', 'SAVE AS SUITE', 'Save what is on this shelf, and only it, as its own SUITE .draft', () => askShelfSuite()));
      strip.append(previews, row);
      bar.append(strip);
      // A DRAG THAT LEFT A SQUARE ENDS WHEREVER THE HAND LETS GO.
      window.addEventListener('pointerup', () => { shelfPress = null; }, true);
    }
    ['shelf-open-suite', 'shelf-save-suite'].forEach(id => {
      const b = strip.querySelector(`#${id}`);
      if (b) b.hidden = !boneyardActive;
    });
    const list = drawing ? shelves() : [];
    strip.hidden = !list.length;
    const tab = strip.querySelector('#shelf-tab');
    tab.textContent = `SHELVES ${shelfStripOpen ? '\u25BE' : '\u25B4'}`;
    tab.title = shelfStripOpen ? 'Put the shelf previews away' : 'Show the shelf previews';
    strip.dataset.open = String(shelfStripOpen);
    const previews = strip.querySelector('#shelf-previews');
    previews.hidden = !shelfStripOpen;
    previews.innerHTML = '';
    list.forEach(shelf => {
      const square = document.createElement('button');
      square.type = 'button';
      square.className = 'shelf-preview';
      square.dataset.shelfPreview = String(shelf.id);
      const name = shelf.name || `SHELF ${shelf.id}`;
      square.title = `Go to ${name}`;
      if (boneyardActive && Number(shelf.id) === activeShelfId()) square.toggleAttribute('data-active', true);
      const screen = document.createElement('canvas');
      screen.width = 140; screen.height = 140;
      const label = document.createElement('span');
      label.className = 'shelf-preview-name';
      label.textContent = name;
      square.append(screen, label, shelfCloseX(shelf));
      square.addEventListener('click', () => enterShelf(Number(shelf.id)));
      // PRESS AND HOLD, THEN DRAG THE SQUARE ONTO A FLOOR PLAN (Movie, 23
      // Oct: "if they click and hold to drag one a suite layout view, can we
      // allow them to DRAG that suite (when they are on a FLOOR PLAN main
      // view - not ELEVATIONS) DRAG the suite and position it on the plan
      // they are viewing"). A press that does not move is still the press
      // that enters the shelf; one that moves a few pixels is a drag, and no
      // click follows it once the hand has left the square.
      square.addEventListener('pointerdown', event => {
        if (event.button !== 0) return;
        shelfPress = { shelfId: Number(shelf.id), x: event.clientX, y: event.clientY, dragging: false };
      });
      square.addEventListener('pointermove', event => {
        const press = shelfPress;
        if (!press || press.dragging || press.shelfId !== Number(shelf.id)) return;
        if (Math.hypot(event.clientX - press.x, event.clientY - press.y) < SHELF_DRAG_PX) return;
        press.dragging = true;
        dragShelfSuite(press.shelfId, event);
      });
      previews.append(square);
    });
    paintShelfPreviews();
  };
  const paintShelfPreviews = () => {
    const strip = shelfStrip();
    if (!strip || strip.hidden || !shelfStripOpen || !drawing) return;
    strip.querySelectorAll('.shelf-preview').forEach(square => {
      const screen = square.querySelector('canvas');
      if (screen) paintPlanThumb(screen, boneyardLevelId(Number(square.dataset.shelfPreview)), null);
    });
  };
  // ── CLOSING A SHELF (Movie, 23 Oct) ─────────────────────────────────────
  //
  // "on the SHELF layout views (and also in the layout level area on the
  // left side where it says SHELF 1) can we have a little X (top right
  // corner of the SHELF viewports) ... if they close one ask them if they
  // want to save first or close without save". The X is the same span on a
  // square and on a row; a press on it asks and does nothing else -- it
  // neither enters the shelf nor begins the drag a press on a square can.
  const shelfCloseX = shelf => {
    const x = document.createElement('span');
    x.className = 'shelf-close-x';
    x.dataset.shelfClose = String(shelf.id);
    x.setAttribute('role', 'button');
    x.setAttribute('aria-label', `Close ${shelf.name || `SHELF ${shelf.id}`}`);
    x.title = `Close ${shelf.name || `SHELF ${shelf.id}`}`;
    const swallow = event => event.stopPropagation();
    x.addEventListener('pointerdown', swallow);
    x.addEventListener('dblclick', swallow);
    x.addEventListener('click', event => { event.stopPropagation(); askShelfClose(Number(shelf.id)); });
    return x;
  };
  const shelfCloseAsk = document.getElementById('shelf-close');
  let shelfClosePending = null;
  const askShelfClose = shelfId => {
    const shelf = shelves().find(sh => Number(sh.id) === shelfId);
    if (!shelf || !shelfCloseAsk) return;
    shelfClosePending = shelfId;
    shelfCloseAsk.querySelector('[data-shelf-close-name]').textContent = shelf.name || `SHELF ${shelfId}`;
    shelfCloseAsk.hidden = false;
    setTimeout(() => shelfCloseAsk.querySelector('[data-shelf-close-save]')?.focus(), 0);
  };
  const settleShelfClose = choice => {
    const shelfId = shelfClosePending;
    shelfClosePending = null;
    if (shelfCloseAsk) shelfCloseAsk.hidden = true;
    if (shelfId == null) return;
    // SAVE FIRST MEANS SAVED: the shelf closes only once its suite file has
    // been written; a cancelled picker or kind question closes nothing.
    if (choice === 'save') askShelfSuite(shelfId, () => closeShelf(shelfId));
    else if (choice === 'discard') closeShelf(shelfId);
  };
  if (shelfCloseAsk) {
    shelfCloseAsk.querySelector('[data-shelf-close-save]').addEventListener('click', () => settleShelfClose('save'));
    shelfCloseAsk.querySelector('[data-shelf-close-discard]').addEventListener('click', () => settleShelfClose('discard'));
    shelfCloseAsk.querySelector('[data-shelf-close-cancel]').addEventListener('click', () => settleShelfClose(null));
  }
  // WHAT CLOSING TAKES: the shelf's own geometry (everything owned by
  // -shelfId, deleteLevel's cascade), its masters, and the shelf itself.
  // Suites brought into a plan are the plan's and stay. THE LAST SHELF IS
  // EMPTIED, NOT CLOSED: the format always yields one shelf, so closing it
  // would only bring an empty SHELF 1 straight back under another name.
  const closeShelf = shelfId => {
    if (!drawing) return false;
    const list = shelves();
    const shelf = list.find(sh => Number(sh.id) === shelfId);
    if (!shelf) return false;
    const name = shelf.name || `SHELF ${shelfId}`;
    const owner = -shelfId;
    const wasHere = boneyardActive && activeShelfId() === shelfId;
    setTool(RESTING_TOOL);
    selection = [];
    const droppedUnderlays = (drawing.underlays || []).filter(u => u && u.levelId === owner);
    const goneIds = new Set();
    LEVEL_OWNED_COLLECTIONS.forEach(field => {
      if (!Array.isArray(drawing[field])) return;
      drawing[field].forEach(item => { if (item && item.levelId === owner) goneIds.add(String(item.id)); });
      drawing[field] = drawing[field].filter(item => !item || item.levelId !== owner);
    });
    droppedUnderlays.forEach(underlay => {
      window.SharedFileStore?.removeNamedFile?.(underlay.id, 'underlays')
        ?.catch(error => console.warn('Underlay binary removal failed:', error));
    });
    if (Array.isArray(drawing.cuts)) drawing.cuts = drawing.cuts.filter(cut => cut && cut.levelId !== owner);
    if (Array.isArray(drawing.groups)) {
      drawing.groups.forEach(group => {
        if (group && Array.isArray(group.members)) group.members = group.members.filter(m => m && !goneIds.has(String(m.id)));
      });
      drawing.groups = drawing.groups.filter(g => g && Array.isArray(g.members) && g.members.length >= 2);
    }
    if (Array.isArray(drawing.boneyardOutlines)) {
      drawing.boneyardOutlines = drawing.boneyardOutlines.filter(m => Number(m?.shelfId) !== shelfId);
    }
    const rest = list.filter(sh => Number(sh.id) !== shelfId);
    const emptied = !rest.length;
    drawing.boneyardShelves = emptied ? [shelf] : rest;
    if (!emptied && Number(drawing.activeBoneyardShelfId) === shelfId) {
      drawing.activeBoneyardShelfId = Number(rest[0].id);
    }
    // THE HISTORY HOLDS WHAT WAS ON IT: the stack's references point into
    // records that are gone, so it is cleared, and Ctrl+Z steps back
    // through the versions, where the shelf still stands.
    undoStack.length = 0;
    markDirty();
    // STANDING ON THE CLOSED SHELF, the drafter is on the next one now: the
    // active shelf id moved above, and the rebuild reads it.
    drawStart = null;
    pendingBone = null;
    buildChrome();
    paint();
    sayOnStrip(emptied
      ? `${name} is the last shelf, so it is emptied rather than closed.`
      : `${name} closed${wasHere ? ` \u2014 you are on ${rest[0].name || `SHELF ${rest[0].id}`}` : ''}.`);
    return true;
  };

  const addShelf = () => {
    if (!drawing) return;
    const list = shelves();
    // THE ALLOCATOR IS STORED, not `list.length + 1`. Delete SHELF 2 of three
    // and the count says 2 while SHELF 3 still holds geometry; the next shelf
    // would take an id that is already an owner and adopt that geometry on
    // sight. Same family as the duplicate-id bug #392 paid for.
    const next = Math.max(
      Number.isInteger(drawing.nextBoneyardShelfId) ? drawing.nextBoneyardShelfId : 1,
      ...list.map(s => Number(s.id) + 1), 2);
    drawing.boneyardShelves = [...list, { id: next, name: `SHELF ${next}` }];
    drawing.nextBoneyardShelfId = next + 1;
    drawing.activeBoneyardShelfId = next;
    markDirty();
    boneyardActive = true;
    buildChrome();
    paint();
  };

  // A SHELF RENAMED IN PLACE: the row becomes a box holding its name, ENTER
  // or leaving it keeps the new one, Esc keeps the old. One UNDO.
  const renameShelf = (row, shelfId) => {
    if (!drawing || row.querySelector('input')) return;
    // THE STORED LIST, so the record renamed is the one the file keeps.
    drawing.boneyardShelves = shelves();
    const shelf = drawing.boneyardShelves.find(sh => Number(sh.id) === shelfId);
    if (!shelf) return;
    const box = document.createElement('input');
    box.type = 'text';
    box.dataset.shelfName = String(shelfId);
    box.value = shelf.name || `SHELF ${shelfId}`;
    row.textContent = '';
    row.append(box);
    box.focus();
    box.select();
    let done = false;
    const finish = keep => {
      if (done) return;
      done = true;
      const name = box.value.trim().toUpperCase();
      if (keep && name && name !== shelf.name) {
        undoStack.push({ kind: 'props', edits: [{ item: shelf, before: { ...shelf } }] });
        shelf.name = name;
        markDirty();
        sayOnStrip(`The shelf is ${name} now.`);
      }
      buildChrome();
    };
    box.addEventListener('keydown', event => {
      event.stopPropagation();
      if (event.key === 'Enter') finish(true);
      if (event.key === 'Escape') finish(false);
    });
    box.addEventListener('click', event => event.stopPropagation());
    box.addEventListener('blur', () => finish(true));
  };

  // ── A SHELF SAVED AS A SUITE (Movie, 20 Oct) ───────────────────────────
  //
  // "they can independanatly SAVE whatever is in there as a SUITE. (but a
  // draft file) and will only ever be in the SHELVES, so a user can build
  // them in any BONEYARD in any draft file, and save them as a DRAFT file".
  // The file is this drawing's levels and settings with only what stands on
  // the shelf, filed on that shelf, marked a suite of the kind asked: brought
  // in elsewhere it comes in as a suite, standing on a floor (suiteOnFloor).
  const shelfSuiteFile = (shelfId, kind) => {
    const full = serializeDrawing();
    const owner = -Number(shelfId);
    const out = Object.create(Object.prototype);
    Object.keys(full).forEach(key => {
      const value = full[key];
      if (Array.isArray(value) && value.some(item => item && typeof item === 'object' && 'levelId' in item)) {
        out[key] = value.filter(item => item && Number(item.levelId) === owner);
      } else {
        out[key] = value;
      }
    });
    // WHAT DOES NOT COME: other drawings shown here, the other shelves'
    // parked outlines, locks between floors, and assemblies whose pieces are
    // not on this shelf.
    const ids = new Set(Object.entries(out).flatMap(([key, list]) => (Array.isArray(list)
      ? list.filter(item => item && item.id != null).map(item => `${key}:${item.id}`) : [])));
    const KEY_OF = { ...SELECTION_LISTS, wall: 'walls' };
    out.groups = (Array.isArray(full.groups) ? full.groups : []).filter(group => (group.members || []).length
      && (group.members || []).every(m => ids.has(`${KEY_OF[m.type]}:${m.id}`)));
    out.holograms = [];
    out.boneyardOutlines = [];
    out.levelLocks = [];
    const shelf = shelves().find(sh => Number(sh.id) === Number(shelfId));
    out.boneyardShelves = [{ id: Number(shelfId), name: shelf?.name || `SHELF ${shelfId}` }];
    out.activeBoneyardShelfId = Number(shelfId);
    out.suiteKind = kind;
    return out;
  };
  const shelfSuiteAsk = document.getElementById('shelf-suite');
  // WHICH SHELF THE QUESTION IS ABOUT, and what follows the file being
  // written: the shelf the drafter stands on, with nothing after, from the
  // two SAVE AS SUITE presses; the shelf whose X was pressed, and its
  // closing, from the close card.
  let shelfSuitePending = null;
  const askShelfSuite = (shelfId = activeShelfId(), after = null) => {
    if (!drawing || !shelfSuiteAsk) return;
    const shelf = shelves().find(sh => Number(sh.id) === Number(shelfId));
    const name = shelf?.name || `SHELF ${shelfId}`;
    shelfSuitePending = { shelfId: Number(shelfId), after };
    shelfSuiteAsk.querySelector('[data-shelf-suite-name]').textContent = name;
    shelfSuiteAsk.hidden = false;
  };
  const saveShelfSuite = async kind => {
    if (!shelfSuiteAsk) return;
    const pending = shelfSuitePending || { shelfId: activeShelfId(), after: null };
    const shelfId = pending.shelfId;
    const shelf = shelves().find(sh => Number(sh.id) === shelfId);
    const name = `${shelf?.name || `SHELF ${shelfId}`}.draft`;
    // The picker first, from the press: the gesture is spent by the first await.
    const handle = await pickSaveTarget(name);
    if (handle === 'cancelled') return;
    shelfSuiteAsk.hidden = true;
    const file = shelfSuiteFile(shelfId, kind);
    const count = ['walls', 'lines', 'fenestrations', 'fixtures', 'floors']
      .reduce((n, key) => n + (Array.isArray(file[key]) ? file[key].length : 0), 0);
    if (!count) {
      // AN EMPTY SHELF HAS NOTHING TO SAVE: closing it is what was asked.
      shelfSuitePending = null;
      if (typeof pending.after === 'function') { pending.after(); return; }
      sayOnStrip(`${shelf?.name || 'This shelf'} is empty -- draw the suite on it first.`);
      return;
    }
    await downloadDrawing(JSON.stringify(file), name, handle);
    sayOnStrip(`${name} saved as a ${suiteLabel(kind)} -- BRING IN .DRAFT puts it in a plan; saved again, REFRESH updates every copy.`);
    shelfSuitePending = null;
    if (typeof pending.after === 'function') pending.after();
  };
  shelfSuiteAsk?.querySelectorAll('[data-shelf-suite-kind]').forEach(b => b.addEventListener('click', () =>
    saveShelfSuite(b.dataset.shelfSuiteKind)));
  shelfSuiteAsk?.querySelector('[data-shelf-suite-cancel]')?.addEventListener('click', () => { shelfSuiteAsk.hidden = true; shelfSuitePending = null; });

  // DECLARED HERE, FILLED IN WITH THE REST OF THE LOT CARD further down --
  // PROJECT's syncFamilyRow pattern, and for its reason: goToLevel is the
  // door the SITE question hangs on and it is written above the card that
  // answers it. A `const` arrow down there would be in its temporal dead
  // zone from up here, which is a crash rather than a missing repaint.
  let paintLotPick = () => {};

  const goToLevel = id => {
    // LEAVING THE BONEYARD IS PART OF ARRIVING AT A LEVEL. Without this the
    // card stays lit while the plan shows MAIN FL, and the two readouts the
    // drafter has disagree about where he is.
    boneyardActive = false;
    params.set('level', String(id));
    // THE VIEW IS KEPT WHERE THE NEW LEVEL HAS IT, dropped where it does not.
    // MAIN FL and 2ND FL share the same four views, so a drafter comparing
    // one floor's electrical plan with the next stays on ELECTRIC rather than
    // being thrown back to walls at every switch. FOUNDATION has no 'stair',
    // so arriving there falls to that level's own default -- and dropping the
    // parameter is how it falls, since leaving a stale `?view=stair` in the
    // URL would make activeViewId() warn about a view the level never had.
    const views = window.DraftLayerViews.layerViewsForLevelId(Number(id));
    const asked = params.get('view');
    if (!asked || !views.some(view => view.id === asked)) params.delete('view');
    syncUrl();
    buildChrome();
    refreshToolPropsOnLevel();
    // ARRIVING AT SITE IS THE QUESTION (Movie, 13 Oct). The flag is cleared
    // on the way to anywhere else so that coming BACK to a site with no lot
    // asks again -- a drafter who pressed NOT NOW and walked away has
    // arrived at the question a second time, which is not nagging.
    if (Number(id) !== SITE_LEVEL_ID) lotAsked = false;
    // AND ARRIVING AT SITE FRAMES THE SITE (Movie, 14 Oct: "when the user
    // brings it up zoom to show the full site"). Only on the way IN, and only
    // on this level: re-fitting on every level change would throw away the
    // zoom a drafter had set on the floor he just left, which is the thing
    // 0-to-fit exists to let him ask for.
    if (Number(id) === SITE_LEVEL_ID) fit();
    paintLotPick();
    paint();
  };

  // ── ONE STOREY UP, ONE STOREY DOWN (Movie, 12 Oct) ──────────────────────
  //
  // "id like UP and DOWN arrows and when they are pressed the LEVEL goes
  // either to the next one up or the next one down."
  //
  // THROUGH goToLevel, so the arrows are the level rows by another route and
  // not a second way of changing level: the view is kept or dropped by the
  // same rule, the boneyard card lets go the same way, and the URL carries
  // the same `?level=`.
  //
  // THE ORDER IS THE PANEL'S ORDER, which is `drawing.levels` as stored --
  // SITE, ROOF, 2ND FL, MAIN FL, FOUNDATION, top down. The panel renders that
  // array straight through, so the arrows step the list the drafter is
  // looking at rather than a second ordering of my own. UP is one row EARLIER
  // in it, DOWN one row later.
  //
  // NOT BY `elev`, and the stock list says why: SITE and MAIN FL both sit at
  // elevation 0, so sorting by height would have to break that tie by
  // guessing -- and the half levels are spliced into the array at the place
  // they belong (buildPremadePlan), which is the answer already.
  //
  // FROM A SHELF, EITHER ARROW GOES BACK TO THE HOUSE. A boneyard shelf is a
  // level with a negative id and is not in this list, so the lookup misses
  // and the step lands on the near end: one press back to a floor rather than
  // a dead button.
  const levelStepTarget = direction => {
    const levels = drawing?.levels || [];
    if (!levels.length) return null;
    const here = levels.findIndex(level => Number(level.id) === activeLevelId());
    if (here < 0) return levels[direction < 0 ? levels.length - 1 : 0];
    const next = here + direction;
    return next >= 0 && next < levels.length ? levels[next] : null;
  };
  const LEVEL_UP = -1;
  const LEVEL_DOWN = 1;
  const levelStep = direction => {
    const target = levelStepTarget(direction);
    if (target) goToLevel(Number(target.id));
  };

  // ONE WAY INTO A VIEW, for the picker and for a seat press. Both change
  // what is looked at and nothing that is saved: a query parameter and a
  // repaint, with `drawing` untouched and markDirty uncalled.
  const goToView = viewId => {
    params.set('view', viewId);
    syncUrl();
    // No buildChrome(): the level did not change, so the cards are still
    // right. What DOES have to move is which row is lit -- a layer row
    // clicked on another level once moved the URL and the plan to STAIR
    // while the panel went on lighting PLAN, because goToLevel rebuilt the
    // panel before goToView had set the view. Two answers on screen at once,
    // which is the fault this page keeps having to be shown.
    markActiveLayer();
    paint();
  };

  // ── the view rail ─────────────────────────────────────────────────────────
  // SIX SEATS, ALWAYS SIX. The rail shows E1-E4 and S1-S2 whether or not those
  // views exist, because a seating chart with gaps in it is a worse answer to
  // "what can I look at" than one with empty chairs.
  //
  // THE PAIRING IS THE OLD PAGE'S. MODEL.dc.html fills two columns across:
  // E1|E3, then E2|E4 (:7266-7267), and the section seats side by side at the
  // bottom (:7281-7290). Reading down a column would put E1 above E2, which is
  // not where a drafter who knows that rail expects to find them.
  // THE FULL CHART, IN MOVIE'S ORDER -- and the order changed on 13 Oct, from
  // the one he gave on 12 Sep (elevations, then ROOF and SITE as a pair, then
  // the plans) to the SHEET SET's, which is what LAYOUT already deals:
  //
  //     1. SITE PLAN                    the whole row
  //     2. the four elevations          E1|E3 over E2|E4
  //     3. ROOF PLAN                    the whole row
  //     4. the floor plans, level by level, top down
  //     5. the sections                 S1|S2
  //     6. the electric plan                                    <- not built
  //
  // It is NOT MODEL.dc.html's order, which runs the sections last after every
  // plan (:7281). Sections sit ahead of the electric plan here because that is
  // where Movie wants to find them. Row 6 is not built; when it is, it goes
  // after the sections rather than anywhere else, which is why the order is
  // written down here instead of inferred from the array later.
  // THE SEATING CHART IS DERIVED, not listed. MODEL.dc.html:7160
  // `_viewRailCards` walks `state.levels` to build it, and that is the whole
  // reason the LEVELS / LAYERS panel came first: add a level and two seats
  // appear, delete one and two leave. A fixed list of fourteen looks right on
  // Movie's bungalow today and is wrong the first time he adds a floor.
  //
  // Counted from the old page on proto/perf-bungalow.draft rather than taken
  // from the order, which said twelve -- it is twelve FILLED seats and two
  // empty section chairs, fourteen elements:
  //
  //     SITE PLAN             E1 · FRONT
  //     E2 · LEFT             E3 · BACK
  //     E4 · RIGHT            ROOF PLAN
  //     2ND FL PLAN (WALLS)   2ND FL LAYOUT (FLOOR)
  //     MAIN FL PLAN (WALLS)  MAIN FL LAYOUT (FLOOR)
  //     FOUNDATION            BASEMENT (WALLS)
  //     S1                    S2
  //
  // The rail is two columns, so the flat order is row-major: inner, outer,
  // inner, outer. SITE and ROOF sat together in row three until 13 Oct, when
  // the order became the sheet set's; they are seated where Movie put them
  // himself -- see seatingChart.
  // ROOF is level 7 and SITE is level 8 -- MODEL.dc.html:7201 seats them by
  // id, and layer-views.js calls the pair WHOLE_LEVEL_IDS. By id rather than
  // by name, so renaming a level cannot empty the row; and if a drawing has
  // no ROOF, that seat is ABSENT rather than an empty chair, which is the old
  // page's own `push` skipping a falsy card.
  const ROOF_LEVEL_ID = 7, SITE_LEVEL_ID = 8;
  const seatingChart = () => {
    const LV = window.DraftLayerViews;
    const levels = drawing?.levels || [];
    const byId = id => levels.find(level => Number(level.id) === id) || null;
    const seats = [];
    const planSeat = (level, viewId, label, fold = null) => {
      if (level) seats.push({ kind: 'plan', levelId: Number(level.id), viewId, label, fold });
    };
    // ── AND THE ORDER IS THE SHEET SET'S (Movie, 13 Oct) ────────────────────
    //
    // "i'd like the arrangement of layout views to start with SITE PLAN -
    // than ELEVATIONS etc ... staring with SITE PLAN, than ELEVATIONS, than
    // ROOF, 2nd fl, Main Fl, Foundation, SECTIONS". LAYOUT already deals its
    // sheets this way; this rail ran elevations first and seated SITE beside
    // ROOF, so a drafter reading one against the other had to re-find
    // everything. The order above replaces the 12 Sep one written out below.
    //
    // IT FLOWS, TWO ACROSS, AND NOTHING TAKES A ROW TO ITSELF. Shown the
    // first cut of this, where SITE and ROOF each took a whole row to keep
    // the elevations' 2x2 square, Movie placed them himself: "the SITE can be
    // 1st position than E1 to the right andthen E2 and E3 2nd row, E4 ROOF on
    // 3rd row". So the rail simply fills:
    //
    //     SITE PLAN             E1 · FRONT
    //     E2 · LEFT             E3 · BACK
    //     E4 · RIGHT            ROOF PLAN
    //
    // WHICH ALSO RE-ORDERS THE ELEVATIONS, from the old page's E1|E3 over
    // E2|E4 (MODEL.dc.html:7266) to E1 E2 E3 E4 read across. That pairing was
    // carried here deliberately -- a drafter who knew the old rail looked for
    // E3 beside E1 -- and it is his to change: with SITE in front of them the
    // columns no longer line up anyway, and 1-2-3-4 in order is what he asked
    // for.
    planSeat(byId(SITE_LEVEL_ID), null, 'SITE PLAN');
    ['E1', 'E2', 'E3', 'E4'].forEach(id => seats.push({ kind: 'cut', name: id }));
    planSeat(byId(ROOF_LEVEL_ID), null, 'ROOF PLAN');
    // ── A HALF FLOOR TAKES NO SEAT OF ITS OWN (Movie, 14 Oct) ──────────────
    //
    // "in the layout viewports, let show all the info in the 2nd floor from
    // both 1.5 and 2nd fl and then DON'T show the 1.5 layout view at all in
    // the layout menu on right side, and also do the same thing with the 0.5
    // and 1st floor ... when a user scrolls down to the text area they will
    // see the 1.5 floor and 0.5 floors".
    //
    // THE SHEET SET ALREADY READ THIS WAY and the rail did not, which is the
    // whole of the complaint: LAYOUT deals 2ND FL one sheet with the 1.5
    // floor drawn lighter on it (layout-plan's ridesOnFullFloor), while this
    // rail seated four cards for the pair -- so a drafter checking one
    // against the other found a 1.5 PLAN here that exists on no sheet.
    // Asked of layout-plan rather than of a list of my own, so the two
    // cannot answer differently again.
    //
    // AND IT STAYS A LEVEL. The LEVELS panel below this rail lists every
    // level the drawing holds, half floors included, and its name row is a
    // press that goes there to edit -- "i may want to allow the user to
    // click on that 'floor level' and then go into that level to edit the
    // floor". Nothing here takes that away; what goes is the PREVIEW CARD.
    const LP = window.DraftLayoutPlan;
    const folded = level => Boolean(LP && LP.ridesOnFullFloor(drawing, level.id));
    levels.forEach(level => {
      const views = LV.layerViewsForLevelId(level.id);
      if (!views.length) return;
      // THE FOUNDATION PAIR IS `foundation` AND `plan`, and the second one is
      // labelled BASEMENT (WALLS) -- there is no `basement` view id. Reading
      // the label as if it named a view is how this would have seated a blank.
      if (views.some(view => view.id === 'foundation')) {
        planSeat(level, 'foundation', 'FOUNDATION');
        planSeat(level, 'plan', 'BASEMENT (WALLS)');
        return;
      }
      if (folded(level)) return;
      const seatName = levelLabel(level.id, level.name);
      // WHAT THIS SEAT IS CARRYING FOR SOMEBODY ELSE. The half floor is
      // drawn into the thumbnail lighter (paintHalfLevelGhost), and a
      // picture that is merely lighter does not say WHOSE the faint walls
      // are -- so the seat wears the storey number it has folded in. Named
      // only when there is something of the half floor to see, because a
      // tag for an empty level is a question a drafter cannot answer.
      const half = LP ? LP.halfLevelUnder(level.id) : null;
      const carries = half != null && levels
        .some(other => Number(other.id) === half)
        && (LP.planWalls(drawing, half).length > 0
          || LP.hasFloorLayout(drawing, half));
      const LA = window.DraftLevelAssembly;
      const fold = carries ? (LA.STOREY_NUMBER[half] || String(half)) : null;
      planSeat(level, 'plan', `${seatName} PLAN (WALLS)`, fold);
      planSeat(level, 'floor', `${seatName} LAYOUT (FLOOR)`, fold);
    });
    // SECTIONS FILL ACROSS, with two chairs standing ready before anything is
    // cut (:7215). Padded to a minimum of two, not to an even number: the
    // rows above are balanced pairs, so appending in order is the old page's
    // "whichever column is shorter".
    const stored = cuts();
    for (let n = 0; n < Math.max(2, stored.length); n += 1) {
      seats.push({ kind: 'cut', name: `S${n + 1}` });
    }
    return seats;
  };

  const rail = document.getElementById('view-rail');
  let railEpoch = -1;
  let railFrame = null;
  // A PASS IN FLIGHT: the seats still to paint, the env they are being painted
  // against, and the total so far. One seat lands per frame, so a pass spans
  // several -- see repaintSeats for why, and for what that does NOT fix.
  let railQueue = null;
  let railPassEnv = null;
  let railPassMs = 0;

  // WHICH CUT SITS IN A SEAT. Elevations are looked up BY ID -- E3 is the back
  // of the house wherever it falls in the array. Sections are seated BY
  // POSITION, which is the old page's rule and not an oversight of mine: it
  // maps `cuts` across the seats in order (:7281), so the first stored cut
  // takes the first seat whatever the drafter named it.
  const seatFor = name => {
    if (name[0] === 'E') {
      const cut = autoElevationCuts().find(c => String(c.id) === name) || null;
      return {
        cut,
        label: cut ? cutLabel(cut) : `${name} · ${elevationName(name)}`,
        title: cut
          ? `${cut.name || name} — the ${elevationName(name)} elevation; tap to bring it center`
          // The old page's words for an empty elevation seat, and still true
          // here: nobody cuts these by hand, the house cuts them for you.
          : `${name} — this elevation cuts itself when the house builds`,
      };
    }
    const cut = cuts()[Number(name.slice(1)) - 1] || null;
    return {
      cut,
      label: cut ? cutLabel(cut) : name,
      // AN EMPTY SECTION SEAT IS + CUT (Movie, 11 Oct), the same press as
      // + CUT in the SECTIONS head, so its title is that button's words.
      title: cut
        ? `${cut.name || name} — tap to bring this section center`
        : `${name} — + CUT: press the two ends of the line, then the side you want to look from`,
    };
  };

  // ONE SPEC FOR EITHER KIND OF SEAT. A cut seat shows a section or an
  // elevation and a plan seat shows a level's drawing, but both answer the
  // same four questions -- what it is called, what it says on hover, whether
  // it is the view on screen, and where a press goes -- so the rail below
  // does not care which it is holding.
  const seatSpec = entry => {
    if (entry.kind === 'cut') {
      const base = seatFor(entry.name);
      return { ...base,
        key: `cut:${entry.name}`,
        // THE NAME STAYS THE NAME. `data-seat` is what the tap guard prints
        // when a press lands on chrome and what every seat assertion looks up
        // by, so a cut seat is still E1 or S1 and a plan seat gets a readable
        // level:view of its own. The rebuild key is separate, below.
        seatId: entry.name,
        active: Boolean(base.cut) && params.get('view') === CUT_VIEW + base.cut.id,
        // An elevation seat is never empty for long (the house cuts it), so
        // only a section seat offers + CUT when nothing sits in it.
        addCut: !base.cut && entry.name[0] === 'S',
        press: base.cut ? () => goToView(CUT_VIEW + base.cut.id)
          : entry.name[0] === 'S' ? () => armCut() : null };
    }
    // A PLAN SEAT IS LIVE WHENEVER THE PAGE IS ON THAT LEVEL AND DRAWING.
    // Asked of activeLevelId/activeViewId rather than of the URL, because a
    // level with no `?view=` is still showing its default -- the same reason
    // the panel's lit row is computed and not read off the query string.
    //
    // AND A HALF FLOOR LIGHTS ITS STOREY'S SEAT. Once the 1.5 card is gone,
    // a drafter who presses 1.5 in the LEVELS list below and goes there to
    // edit would otherwise find every card dark -- the rail saying "you are
    // nowhere" about a level the drawing certainly has. The seat that is
    // DRAWING that level is the 2ND FL one, so that is the one lit.
    const LP = window.DraftLayoutPlan;
    const activeId = activeLevelId();
    const seatedHere = activeId === entry.levelId
      || (LP && LP.ridesOnFullFloor(drawing, activeId)
        && LP.fullFloorOver(activeId) === entry.levelId);
    const onIt = !cutForViewId(params.get('view'))
      && seatedHere
      && (entry.viewId === null || activeViewId() === entry.viewId);
    return {
      cut: null,
      plan: entry,
      key: `plan:${entry.levelId}:${entry.viewId || ''}:${entry.fold || ''}`,
      seatId: `${entry.levelId}:${entry.viewId || 'all'}`,
      label: entry.label,
      fold: entry.fold || null,
      title: entry.fold
        ? `${entry.label} — with the ${entry.fold} floor drawn lighter; tap to bring this plan center`
        : `${entry.label} — tap to bring this plan center`,
      active: onIt,
      press: () => {
        if (activeLevelId() !== entry.levelId) goToLevel(entry.levelId);
        if (entry.viewId) goToView(entry.viewId);
        else { params.delete('view'); syncUrl(); buildChrome(); paint(); }
      },
    };
  };

  // THE SEATS THE RAIL IS CURRENTLY HOLDING, so the DOM is rebuilt when the
  // CHART changes and not on every paint. Adding a level adds two seats and
  // deleting one takes two away -- that is the item this whole order exists
  // to demonstrate, so the rail cannot assume its own length.
  let railKeys = '';
  const syncRail = () => {
    if (!drawing) return;
    const chart = seatingChart();
    const specs = chart.map(seatSpec);
    const keys = specs.map(spec => spec.key).join('|');
    if (keys !== railKeys) {
      railKeys = keys;
      rail.innerHTML = '';
      specs.forEach(spec => {
        const seat = document.createElement('button');
        seat.type = 'button';
        seat.className = 'seat';
        seat.dataset.seat = spec.seatId;
        seat.dataset.seatKey = spec.key;
        const screen = document.createElement('canvas');
        // 2x the CSS size, so the lines are crisp on a retina panel. The old
        // page uses 232x152 for a 116x76 seat (:7306); these seats are 82x54,
        // small enough that the rail still fits once the plan cards join it.
        screen.width = 164; screen.height = 108;
        seat.append(screen);
        // + CUT over the blank screen of an empty section seat; the label
        // stays lastChild, which the print caption reads.
        const plus = document.createElement('div');
        plus.className = 'seat-cut';
        plus.hidden = true;
        const word = document.createElement('span');
        word.textContent = '+ CUT';
        plus.append(word);
        seat.append(plus);
        // THE HALF FLOOR THIS SEAT HAS FOLDED IN, in the corner of the
        // picture. Built for every seat and shown on the few that carry one,
        // because the label has to stay `lastChild` -- the print caption
        // reads it from there -- so a tag appended later would quietly
        // become the caption.
        const fold = document.createElement('div');
        fold.className = 'seat-fold';
        fold.hidden = true;
        seat.append(fold);
        // BG, on a plan seat: a span, because a seat is already a button.
        const bg = document.createElement('span');
        bg.className = 'seat-bg';
        bg.dataset.seatBg = '';
        bg.textContent = 'BG';
        bg.hidden = true;
        seat.append(bg);
        const label = document.createElement('div');
        label.className = 'seat-label';
        seat.append(label);
        rail.append(seat);
      });
    }
    specs.forEach((spec, i) => {
      const seat = rail.children[i];
      seat.title = spec.title;
      seat.lastChild.textContent = spec.label;
      // A CHAIR, NOT A BUTTON, for a seat with nothing behind it -- and a
      // plan seat always has something behind it, because the chart only
      // seats levels the drawing actually holds.
      seat.disabled = !spec.press;
      seat.querySelector('.seat-cut').hidden = !spec.addCut;
      if (spec.addCut) seat.dataset.seatCut = ''; else delete seat.dataset.seatCut;
      const fold = seat.querySelector('.seat-fold');
      fold.hidden = !spec.fold;
      fold.textContent = spec.fold ? `+${spec.fold}` : '';
      if (spec.fold) seat.dataset.seatFold = spec.fold; else delete seat.dataset.seatFold;
      seat.classList.toggle('active', spec.active);
      seat.onclick = spec.press;
      const bg = seat.querySelector('.seat-bg');
      bg.hidden = !spec.plan;
      if (spec.plan) {
        const lit = bgLayers.has(spec.seatId);
        if (lit) bg.dataset.lit = ''; else delete bg.dataset.lit;
        bg.title = lit ? `${spec.label} drawn behind this plan — click to take it away`
          : `Draw ${spec.label} faded behind the plan you are on`;
        bg.onclick = event => {
          event.stopPropagation();
          if (bgLayers.has(spec.seatId)) bgLayers.delete(spec.seatId); else bgLayers.add(spec.seatId);
          saveBgLayers();
          sayOnStrip(bgLayers.has(spec.seatId) ? `BG: ${spec.label} behind, faded.` : `BG: ${spec.label} taken away.`);
          paint();
        };
      }
    });

    // THE THUMBNAILS, ON THE NEXT FRAME, AND ONLY WHEN THE DRAWING MOVED.
    //
    // Two gates, and they do different jobs. The EPOCH says whether there is
    // anything new to draw -- six paints on every pan and zoom would redraw
    // six pictures that did not change, which is MODEL.dc.html's own rule at
    // :7203, "Repaints only when the model changes, never on mouse traffic".
    // The FRAME says when to do it.
    //
    // The frame gate is the one I missed first time, and it is the whole
    // difference between this rail and the old page's. syncRail is reached
    // from paint(), which runs INSIDE the click handler that commits a wall --
    // so painting here put the rail's whole cost in the middle of the
    // drafter's gesture. MODEL.dc.html never does that: it calls
    // _syncViewRails from _animate (:7188), its requestAnimationFrame loop, so
    // the edit handler returns, the wall appears, and the rail catches up on
    // the next frame. The work is the same; the felt difference is a wall that
    // lands instantly against one that lands after a stutter.
    //
    // That is also why the elevations can be pictures again. They cost ~45 ms
    // each and the labels fallback existed because four of them blocked the
    // gesture; off the critical path they cost the drafter nothing they can
    // feel, which is how the old page has always shown them.
    //
    // COALESCED, because an edit can bump the epoch again before the frame
    // runs. One pending frame at a time, and it draws whatever the epoch says
    // when it arrives -- not once per bump.
    if (railEpoch !== modelEpoch && railFrame === null) {
      railFrame = requestAnimationFrame(stepSeats);
    }
    // The previews share the LEVELS / LAYERS pane, at its head (Movie,
    // 10 Oct), so the pane that shows the levels shows them too.
    rail.hidden = paneShowing() !== 'levels';
    // AND THE NORTH PAIR SITS OVER THIS RAIL'S TWO COLUMNS (Movie, 14 Oct:
    // "center each over the layouts below"), so it is re-seated whenever the
    // columns arrive or move. Without this the dock keeps whatever it worked
    // out on the paint BEFORE the rail was built -- which is the paint it
    // usually gets, since nothing repaints the plan afterwards.
    seatNorthDock();
  };

  // AND AGAIN WHENEVER THE RAIL ITSELF MOVES OR APPEARS. The call at the end
  // of syncRail is not enough on its own: the rail is HIDDEN unless the
  // LEVELS / LAYERS pane is the one showing, and a hidden element measures
  // zero -- so the first seating usually happens while there is nothing to
  // line up with, and nothing repaints the plan afterwards to try again.
  // A ResizeObserver is the real signal for "the columns are somewhere new",
  // which is the question being asked, rather than a retry on a timer.
  // THE ARROW GOES WITH THE DOCK, since 23 Oct by construction: it is painted
  // on its chip's own face, so seating the dock moves it too and no second
  // paint is owed. (Before that it was on the sheet, and a seat without a
  // repaint left the pair split -- which three selection specs' canvas
  // hashes caught.)
  {
    const rail = document.getElementById('view-rail');
    if (rail && typeof ResizeObserver === 'function') {
      new ResizeObserver(() => { seatNorthDock(); }).observe(rail);
    }
  }

  // ONE SEAT PER FRAME, and the reason is a measurement rather than a taste.
  //
  // Painting all six in one rAF is a single task the length of the whole rail,
  // and on `repro-garage-house` that task is 47 ms against the browser's 50 ms
  // longtask threshold -- so the page reported a main-thread block on about
  // three runs in five. Attributed rather than guessed: the longtask entry's
  // startTime equals the first painter call's, to the millisecond, across
  // three runs, and it is always the FIRST edit.
  //
  //     EDIT 1  E1 15.1  E3 14.7  E2 9.7  E4 6.9  S1 0.8  = 47.2 ms  -> 50 ms long task
  //     EDIT 2  E1 10.3  E3  9.6  E2 7.6  E4 9.7  S1 0.9  = 38.1 ms     none
  //     EDIT 4  E1  7.2  E3  6.7  E2 7.1  E4 5.4  S1 0.5  = 26.9 ms     none
  //
  // Devin's ruling, and the trade in his words: a drafter cannot see four
  // thumbnails land in one frame anyway; they CAN feel a 47 ms lurch. The work
  // is identical, the longest task becomes one elevation instead of four, and
  // the cost is that the last seat settles a few frames after the edit.
  //
  // WHAT THIS DOES NOT FIX, kept here because it would otherwise be forgotten
  // the moment the spec goes green:
  //   - The steady state is four elevations at ~7 ms = 28 ms, 56% of the
  //     threshold. Splitting the frame buys headroom; it does not retire the
  //     question, and the honest answer is still a cheaper elevation painter.
  //   - E1 and E3 cost 15-16 ms on the first edit against ~7 ms after it.
  //     That is a FIRST-PAINT cost, not an outlier to cut -- it was chased and
  //     it is warmup, so nobody need chase it twice.
  // The standing pre-ruling on both: make the painter cheaper, do not move the
  // line.
  const stepSeats = () => {
    railFrame = null;
    if (!drawing || !rail.children.length) { railQueue = null; return; }
    // A FRESH PASS when there is none, or when an edit landed mid-pass. The
    // epoch check is the coalescing the single-frame version did at the
    // scheduler; at seat granularity it has to happen here too, or a pass
    // started before an edit would finish painting the model as it was.
    if (railQueue === null || railEpoch !== modelEpoch) {
      railEpoch = modelEpoch;
      railPassEnv = cutEnv();
      railQueue = seatingChart().map((entry, i) => ({ spec: seatSpec(entry), i }));
      railPassMs = 0;
    }
    const t0 = performance.now();
    const { spec, i } = railQueue.shift();
    paintSeat(spec, i, railPassEnv);
    railPassMs += performance.now() - t0;
    if (railQueue.length) {
      railFrame = requestAnimationFrame(stepSeats);
      return;
    }
    railQueue = null;
    // AND THE SHELF PREVIEWS ABOVE THE BONE, after the seats: the same
    // epoch, the same painters, the same deferred frame.
    paintShelfPreviews();
    railPassEnv = null;
    // THE NUMBER THE WHOLE LIVE-THUMBNAIL DECISION RESTS ON, on screen
    // rather than in a commit message. The spec recommended label-only seats
    // precisely because nobody had measured this; it is measured here, on
    // whatever house the drafter actually has open, and it is the cost of an
    // EDIT rather than of a frame. It is still the whole pass -- splitting the
    // frames changed when the work happens, not how much of it there is.
    lastRailMs = railPassMs;
    // AND SAY SO. updateReadout runs inside paint(), which is over before
    // this frame fires, so without this the readout carries the PREVIOUS
    // repaint's number for ever -- 0 on the first load, and one edit behind
    // after that. The synchronous version ordered these deliberately for
    // exactly this reason; deferring the paint put the staleness back, and
    // the instrument being one step behind is the fault it exists to catch.
    updateReadout();
  };

  // A LEVEL'S PLAN IN MINIATURE, drawn by the painters that draw the big one.
  // The viewport is swapped for the length of the call and restored in a
  // `finally`: ctx, the canvas size, the device ratio, the camera and the
  // thumb target all go back even if a painter throws, because a page left
  // pointing at a 82x54 seat would paint the drawing into a thumbnail and
  // look like the canvas had died.
  //
  // fit() is the page's own fit, not a second one -- it reads allPoints(),
  // which reads the filtered collections, which read activeLevelId(), which
  // reads thumbTarget. So the seat frames THAT level by the same rule the
  // drafter gets from pressing 0.
  const paintPlanThumb = (screen, levelId, viewId) => {
    const savedCtx = ctx, savedW = cssW, savedH = cssH, savedDpr = dpr;
    const savedView = { cx: view.cx, cz: view.cz, scale: view.scale };
    try {
      thumbTarget = { levelId: Number(levelId), viewId: viewId || null };
      ctx = screen.getContext('2d');
      // NO WORDS IN A SEAT (Movie, 26 Oct: "the MAIN FL layout looks like
      // there is a bunch of text but its all jumbled, just show the main wall
      // outlines" -- "no text"). Room names, sizes, tags and dimension
      // figures shrink to a smear at 82px across, so the seat's own context
      // writes none of them; the lines are what read.
      ctx.fillText = () => {};
      ctx.strokeText = () => {};
      // The seat canvas is 2x its CSS box, the same trick the main canvas
      // uses, so the miniature is crisp on a retina panel.
      dpr = 2; cssW = screen.width / dpr; cssH = screen.height / dpr;
      ctx.save();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, cssW, cssH);
      // WIDE: this level may be ROOF or SITE, whose whole content is a roof
      // footprint and an outline. See allPoints.
      fit(true);
      // GEOMETRY ONLY. No grid, no underlays: a grid at 82px across is noise,
      // and an underlay is a decoded image per seat per edit. The old page's
      // thumbnail makes the same cut (:7269 draws the level's own geometry).
      //
      // THE HALF FLOOR IS NOT AN EXTRA, THOUGH -- it is the seat's own
      // content now (Movie, 14 Oct: "show all the info in the 2nd floor from
      // both 1.5 and 2nd fl"). The two ghost passes are the ones the main
      // view has drawn since 7 Oct, at half strength and UNDER this level's
      // own lines, so where the pair overlap the full floor is what reads.
      paintHalfLevelGhostFloors();
      paintFloors(); paintRoofs(); paintShapes();
      paintOutlines(); paintLines();
      paintHalfLevelGhost();
      paintWalls();
      // A SHELF'S SQUARE ABOVE THE BONE SHOWS ITS CORNERS, in its unit's
      // colour (Movie, 23 Oct: "in the little SHELF layout in the middle
      // above the bone can you show the corner colors so they can easily
      // identify each suite type (right now its just grey)"). Shelves only:
      // a rail seat is a storey of the house, and stays geometry.
      if (Number(levelId) < 0) paintSuperNodes();
      ctx.restore();
    } finally {
      // The seat's own canvas writes again once the miniature is down.
      const seatCtx = screen.getContext('2d');
      delete seatCtx.fillText;
      delete seatCtx.strokeText;
      ctx = savedCtx; cssW = savedW; cssH = savedH; dpr = savedDpr;
      view.cx = savedView.cx; view.cz = savedView.cz; view.scale = savedView.scale;
      thumbTarget = null;
    }
  };

  const paintSeat = (spec, i, env) => {
    const screen = rail.children[i] && rail.children[i].firstChild;
    if (!screen) return;
    // A PLAN SEAT GOES THROUGH THE PAGE'S OWN PAINTERS, not a second
    // miniature renderer -- see paintPlanThumb. It returns before the
    // clearRect below because it clears inside its own viewport swap, where
    // the size it is clearing is the size it is about to draw into.
    if (spec.plan) {
      paintPlanThumb(screen, spec.plan.levelId, spec.plan.viewId);
      return;
    }
    const c = screen.getContext('2d');
    c.clearRect(0, 0, screen.width, screen.height);
    if (!spec.cut) return;
    // A TRUE MINIATURE where one is affordable: the same painter that
    // draws the full-size view, through the same env. MODEL.dc.html's
    // thumbnail painter is a one-line wrapper over drawCutView (:10117),
    // so this is not a second, smaller renderer that could drift.
    //
    // ELEVATIONS DO NOT GET ONE, and the reason is what the seat is FOR,
    // not what it costs. A thumbnail earns its keep where the name does
    // not identify the view: S1 and S2 tell a drafter nothing about which
    // section is which, so a picture is the only way to tell them apart.
    // E1 FRONT and E3 BACK already do the job a picture would.
    //
    // The cost only makes the correct answer also the cheap one, and it
    // is worth recording because it was measured the wrong way first.
    // Per seat, 232x152, repro-garage-house:
    //
    //     E1 46.8 ms   E2 43.2 ms   E3 47.6 ms   E4 43.7 ms   S1 0.32 ms
    //
    // About 100x, holding across three houses and IDENTICAL at 232x152
    // and 900x600 -- so it is the painter's hidden-line geometry, not
    // fill. Four live elevations is ~180 ms of blocking JS on every edit;
    // in the browser, before this, the rail cost 148 ms per wall drawn.
    //
    // THE SHAPE IS KEPT ON PURPOSE. Seat, canvas and epoch are unchanged
    // and an elevation draws its name where its picture would go, so a
    // faster elevation painter becomes a thumbnail here without moving a
    // seat -- Devin's "labels behind the same seat", taken literally.
    // COARSE, because the seat is 82 px wide. The roof silhouette's full
    // 240-sample resolution is eleven samples per pixel here and costs
    // ~28 ms an elevation; at 40 it is one sample per two pixels and costs
    // ~7 ms. Four elevations: 112 ms against 30 ms, for a picture that
    // cannot differ at this size.
    // THE SAME INKS AS THE FULL-SIZE VIEW. A thumbnail that kept paper while
    // the sheet beside it went dark would be the rail disagreeing with the
    // drawing it is a rail of.
    // AND NO WORDS IN IT, as a plan's seat has none (paintPlanThumb): its
    // level marks and tags are a smear at this size.
    c.fillText = () => {};
    c.strokeText = () => {};
    try {
      window.DraftCutView.drawCutView(env, c, screen.width, screen.height, spec.cut,
        { coarseSilhouette: true, colors: window.DraftCutView.inksFromSkin(skin) });
    } finally {
      delete c.fillText;
      delete c.strokeText;
    }
  };

  // ── PRINTSCREEN: three pages for a client ─────────────────────────────────
  // Movie, 15 Sep. This is a PRESENTATION, not a print of the drawing, and
  // the distinction is the whole reason it is allowed to exist on a page that
  // has no print path: a permit sheet has a scale, a title block and a frame,
  // all of which live on the layout. These three pages are screen grabs. They
  // carry NOT TO SCALE above the logo precisely so that nobody can take one
  // to a builder and treat it as a drawing.
  //
  //     page 1  the view as the drafter is looking at it
  //     page 2  the whole plan, fitted
  //     page 3  every view tile the rail is holding
  //
  // NOTHING NEW IS DRAWN. Page 1 is the canvas's own buffer, page 2 is the
  // page's own fit and painters through a saved-and-restored camera, page 3
  // copies the seat canvases the rail has already painted. A second renderer
  // here is the thing worth refusing: it would drift from the one on screen,
  // and then a client's picture and a drafter's screen would disagree with
  // nobody able to say which was right.
  //
  // PDF AND PRINTER ARE ONE BUTTON, not two. The browser's own print dialog
  // offers "Save as PDF" beside the printers, so a separate export would be a
  // second way to ask for the same sheet.
  const presentationLogo = () => {
    const img = document.createElement('img');
    // The logo follows the RUFF/ROUGH switch the way the skin does, so a RUFF
    // drawing presents under the RUFF mark. Movie's two files are not drawn
    // yet; until they land the one logo in assets stands in, which is why
    // this falls back rather than printing a broken image.
    img.src = `./assets/logo-${theme}.png`;
    img.alt = '';
    img.dataset.presLogo = theme;
    img.onerror = () => { img.onerror = null; img.src = './assets/rough-drafter-logo.png'; };
    return img;
  };

  const presentationFoot = () => {
    const foot = document.createElement('div');
    foot.className = 'pres-foot';
    const mark = document.createElement('div');
    mark.className = 'pres-mark';
    const scale = document.createElement('div');
    scale.className = 'pres-scale';
    scale.dataset.presScale = '';
    scale.textContent = 'NOT TO SCALE';
    // ABOVE the logo, and in that order in the DOM as well as on the page --
    // a reader with a screen reader gets the warning before the brand too.
    mark.append(scale, presentationLogo());
    foot.append(mark);
    return foot;
  };

  const presentationPage = (title, body) => {
    const page = document.createElement('section');
    page.className = 'pres-page';
    const head = document.createElement('div');
    head.className = 'pres-title';
    head.textContent = title;
    page.append(head, body, presentationFoot());
    return page;
  };

  const presentationArt = dataUrl => {
    const art = document.createElement('div');
    art.className = 'pres-art';
    const img = document.createElement('img');
    img.src = dataUrl;
    img.alt = '';
    art.append(img);
    return art;
  };

  // EVERY PICTURE IS TAKEN IN DAYLIGHT, whatever skin the drafter is working
  // in (Movie, 15 Sep). The paper around the pictures was already white and
  // black; the pictures themselves carried the night skin, so a drafter
  // working at night handed a client three black rectangles -- a page that
  // costs a cartridge to print and reads as a photograph of a screen rather
  // than a drawing.
  //
  // The palette is re-applied and the page repainted, which is exactly what
  // the DAY switch does, EXCEPT that it does not touch the stored skin: this
  // is a picture being taken, not a drafter changing their mind, and the
  // choice has to be there when they look up. Nothing is awaited inside, so
  // the browser never paints a frame mid-press and the screen does not blink
  // white.
  const inDaylight = shoot => {
    // AND WITH THE DESK FURNITURE OFF: the super nodes are the drafter's
    // own marks, not the client's picture (paintSuperNodes reads this).
    presenting = true;
    try {
      if (mode !== 'day') skin = window.DraftPalette.apply(document, theme, 'day');
      return shoot();
    } finally {
      presenting = false;
      if (mode !== 'day') skin = window.DraftPalette.apply(document, theme, mode);
      paint();
      paintRailNow();
    }
  };

  // THE RAIL, SYNCHRONOUSLY, and only from here. Its own repaint lands one
  // seat per frame so an edit never stutters -- right for editing, useless
  // for a press that must hand back finished pictures in the same task. The
  // whole pass is ~30 ms, which is a cost a print press can carry and a
  // gesture cannot.
  const paintRailNow = () => {
    if (!drawing || !rail.children.length) return;
    const env = cutEnv();
    seatingChart().forEach((entry, i) => paintSeat(seatSpec(entry), i, env));
  };

  // WHOLE-PLAN SHOT. The camera is put back and the page repainted in a
  // `finally` for the same reason paintPlanThumb does it: a throw halfway
  // through would otherwise leave the drafter looking at a fitted view they
  // never asked for, with their own pan and zoom gone.
  const wholePlanShot = () => {
    const saved = { cx: view.cx, cz: view.cz, scale: view.scale };
    // The bars are not in the photograph, so they are not in the framing
    // either -- chromeInsets reads this. Cleared BEFORE the restoring paint
    // below, so the drafter's own view comes back framed the way it was.
    shootingPaper = true;
    try {
      fit(true);
      paint();
      return canvas.toDataURL('image/png');
    } finally {
      shootingPaper = false;
      view.cx = saved.cx; view.cz = saved.cz; view.scale = saved.scale;
      paint();
    }
  };

  // WHICH TILES ARE ACTIVE. Movie asked for "all the active little layout
  // views", and the rail's own answer to that is already on the page: a seat
  // with nothing behind it is disabled. The ink check catches the second
  // case -- a seat enabled but not yet painted, because the rail paints one
  // per frame -- so an empty rectangle never reaches the paper.
  const inkedSeats = () => [...rail.querySelectorAll('.seat')].filter(seat => {
    if (seat.disabled || 'seatCut' in seat.dataset) return false;
    const screen = seat.firstChild;
    if (!screen || !screen.width) return false;
    const { data } = screen.getContext('2d')
      .getImageData(0, 0, screen.width, screen.height);
    for (let i = 3; i < data.length; i += 4) if (data[i] !== 0) return true;
    return false;
  });

  // TWELVE TO A SHEET (Movie, 15 Sep: "if needed the layouts can go to 4th
  // page when more than 12"). A grid left to spill breaks across paper by
  // itself, but the overflow lands on a page with no title, no NOT TO SCALE
  // and no logo on it -- a loose sheet of pictures with nothing saying what
  // they are. Cut deliberately, every sheet is a whole page again.
  const TILES_PER_SHEET = 12;

  const presentationTiles = () => {
    const grids = [];
    inkedSeats().forEach((seat, i) => {
      if (i % TILES_PER_SHEET === 0) {
        const grid = document.createElement('div');
        grid.className = 'pres-tiles';
        grids.push(grid);
      }
      const tile = document.createElement('figure');
      tile.className = 'pres-tile';
      tile.dataset.presTile = seat.dataset.seat;
      const img = document.createElement('img');
      img.src = seat.firstChild.toDataURL('image/png');
      img.alt = '';
      const caption = document.createElement('figcaption');
      caption.textContent = seat.lastChild.textContent;
      tile.append(img, caption);
      grids[grids.length - 1].append(tile);
    });
    return grids;
  };

  const buildPresentation = () => {
    document.getElementById('presentation')?.remove();
    const sheet = document.createElement('div');
    sheet.id = 'presentation';
    sheet.dataset.presentation = '';
    const name = drawing?.projectInfo?.projectName || 'UNTITLED';
    inDaylight(() => {
      // Page 1 is taken BEFORE page 2, because page 2 moves the camera to fit
      // and page 1 is the whole point of the button: the view as it stands.
      // It is repainted first all the same -- the buffer on screen is still
      // the night one until something draws over it.
      paint();
      sheet.append(
        presentationPage(`${name} — this view`, presentationArt(canvas.toDataURL('image/png'))),
        presentationPage(`${name} — the whole plan`, presentationArt(wholePlanShot())));
      // THE TILES PAGE IS DROPPED WHEN THE RAIL IS EMPTY rather than printed
      // blank. A new drawing has no views yet, and a page carrying nothing but
      // a disclaimer is a page a client has to be told to ignore.
      paintRailNow();
      presentationTiles().forEach((grid, i) => sheet.append(presentationPage(
        i ? `${name} — the views, continued` : `${name} — the views`, grid)));
    });
    document.body.append(sheet);
    return sheet;
  };

  const printButton = document.getElementById('printscreen');
  printButton.addEventListener('click', () => {
    buildPresentation();
    // The sheet is torn up after the dialog closes either way -- printed or
    // cancelled -- so a stale set of pictures can never be printed a second
    // time, and the DOM a drafter works in does not quietly grow a copy of
    // the drawing every press.
    const tidy = () => {
      document.getElementById('presentation')?.remove();
      window.removeEventListener('afterprint', tidy);
    };
    window.addEventListener('afterprint', tidy);
    window.print();
  });

