// MODEL.html's page script, part 15 of 17: the FIXTURE panel, WALL / FLOOR / LINE properties, GABLE END, fixture properties and OBJ / PROP, the ROOF panel, hand DIMENSIONS, the BEAM panel, AUTO PILES.
//
// Stage 2 of the split (Movie, 24 Oct: "how can we reduce the MODEL.html
// size in a nice organized way"): the one script the page carried, cut
// at its own section headings and moved here verbatim, in order. The
// parts load one after another as classic scripts and share one scope,
// as they did inside the page; the indent is the page's, kept so every
// line reads as it did there.

  // ── THE FIXTURE PANEL ────────────────────────────────────────────────────
  //
  // Sixteen catalogue entries under their own four headings, and the headings
  // are DERIVED from the catalogue (DraftFixtureKinds.GROUPS) rather than
  // listed here -- a kind added to fixture-kinds.js appears under its heading
  // without a second place to edit, which is the whole reason the catalogue
  // moved out of MODEL.dc.html.
  //
  // PICKING A KIND ARMS THE TOOL. A drafter who presses CABINET means to place
  // a cabinet; making them press FIXTURE afterwards would be a second step
  // that says nothing. This is the same reasoning as the build bar arming the
  // outline trace at :3875 -- the choice IS the arming.
  //
  // THE HELP LINE IS THE CATALOGUE'S OWN `note`, not a sentence written here,
  // so what the panel promises and what the tool does come from one string.
  const buildFixturePanel = () => {
    const slot = document.getElementById('tool-slot');
    const K = window.DraftFixtureKinds;
    if (!slot || !K) return;

    const help = document.createElement('div');
    help.className = 'sel-help';
    help.dataset.fixtureHelp = '';

    // ONTO THE BUILD TAB, from the table: these palettes are the catalogue
    // the FIXTURE tool places from, and FIXTURE is a BUILD key.
    const home = leftPane(paneForBlock('fixtures')) || slot;

    K.GROUPS.forEach(group => {
      const box = document.createElement('div');
      box.dataset.toolGroup = `fixture-${group.toLowerCase()}`;
      const title = document.createElement('div');
      title.dataset.toolGroupName = '';
      title.textContent = group;
      const row = document.createElement('div');
      row.className = 'sel-row';
      // THE ASSEMBLED ONES STAND BESIDE THE NAME (Movie, 14 Oct: "bring those
      // ASSEMBLED units for BATH and KITCHEN up beside the title (to the
      // right)"). A whole kitchen or washroom in one press is a different
      // kind of thing from the single cabinets and fixtures under it, and the
      // row it was buried in said nothing about that.
      //
      // THE CATALOGUE SAYS WHICH ARE WHICH -- `preset: true` in
      // fixture-kinds.js -- so a preset added there turns up here by itself,
      // and nothing in this file has to carry a list of their ids.
      const head = document.createElement('div');
      head.className = 'tool-group-head';
      const headRow = document.createElement('div');
      headRow.className = 'sel-row';
      headRow.dataset.assembledRow = group.toLowerCase();
      head.append(title, headRow);
      // THE OLD PAGE'S L PRESET IS NOT OFFERED HERE (Movie, 17 Oct: "i just
      // need the KITCHEN L1 don't worry about the othe L PReset one"). It
      // stays in the shared catalogue, where MODEL.dc.html still builds it;
      // this page only ever answered it with "not on this page yet".
      K.kindsInGroup(group).filter(kind => kind.preset !== true).forEach(kind => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `sel-chip${kind.preset ? ' assembled' : ''}`;
        btn.dataset.fixtureKind = kind.id;
        btn.textContent = kind.label;
        btn.title = kind.note;
        btn.addEventListener('click', () => {
          if (selectPicking) { pickKind('fixture', kind.id); return; }
          fixtureKindId = kind.id;
          washroomPreset = null;
          kitchenPreset = null;
          // A run half-made with one kind must not finish as another: the
          // second press would take the first press's `along` and file a
          // cabinet's width under a vanity. Same rule setTool applies to
          // drawStart, for the same reason.
          fixtureRunStart = null;
          setTool('fixture');
          syncFixturePanel();
        });
        (kind.preset ? headRow : row).append(btn);
      });
      box.append(head, row);
      home.append(box);
    });
    // THE DEFAULT WASHROOMS GO BESIDE THE BATH TITLE for the same reason the
    // kitchen's L PRESET does: a pick here is a whole ROOM, not a fixture
    // kind, held until Esc or another pick. They used to sit on the BATH row
    // beside VANITY, which put a washroom and a single sink in one line and
    // said nothing about the difference.
    const bathRow = home.querySelector('[data-assembled-row="bath"]');
    if (window.DraftWashroomPresets && bathRow) {
      window.DraftWashroomPresets.IDS.forEach(id => {
        const preset = window.DraftWashroomPresets.PRESETS[id];
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'sel-chip assembled';
        btn.dataset.washroom = id;
        btn.textContent = preset.name;
        btn.title = `${preset.label} — press to drop it; [ and ] turn it, F mirrors it, Esc puts it down. `
          + 'The tub end joins an exterior wall it is dropped against.';
        btn.addEventListener('click', () => {
          washroomPreset = id;
          kitchenPreset = null;
          fixtureRunStart = null;
          setTool('fixture');
          syncFixturePanel();
        });
        bathRow.append(btn);
      });
    }
    // AND THE DEFAULT KITCHEN BESIDE THE KITCHEN TITLE (Movie, 17 Oct:
    // "KITCHEN L1"), with the old page's L PRESET chip: a pick is a whole
    // kitchen, held until Esc or another pick, pressed into a corner.
    const kitchenRow = home.querySelector('[data-assembled-row="kitchen"]');
    if (window.DraftKitchenPresets && kitchenRow) {
      window.DraftKitchenPresets.IDS.forEach(id => {
        const preset = window.DraftKitchenPresets.PRESETS[id];
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'sel-chip assembled';
        btn.dataset.kitchen = id;
        btn.textContent = preset.name;
        btn.title = `${preset.label} — press to drop it: into a corner two walls make, or with its own two walls anywhere else; [ ] turn it, F swaps the legs, Esc puts it down.`;
        btn.addEventListener('click', () => {
          kitchenPreset = id;
          washroomPreset = null;
          fixtureRunStart = null;
          setTool('fixture');
          syncFixturePanel();
        });
        kitchenRow.append(btn);
      });
    }
    home.append(help);

    syncFixturePanel = () => {
      // The board answers through the roster, never a `board === 'toy'`
      // written here -- so this panel and the keypad cannot disagree about a
      // board. FIXTURE is not a TOY tool, so on TOY every chip is dead.
      const on = window.DraftToolRoster?.availableOn('fixture', board) !== false;
      slot.querySelectorAll('[data-fixture-kind]').forEach(btn => {
        btn.setAttribute('aria-pressed',
          String(activeTool === 'fixture' && !washroomPreset && !kitchenPreset && btn.dataset.fixtureKind === fixtureKindId));
        btn.disabled = !on;
      });
      slot.querySelectorAll('[data-washroom]').forEach(btn => {
        btn.setAttribute('aria-pressed',
          String(activeTool === 'fixture' && btn.dataset.washroom === washroomPreset));
        btn.disabled = !on;
      });
      slot.querySelectorAll('[data-kitchen]').forEach(btn => {
        btn.setAttribute('aria-pressed',
          String(activeTool === 'fixture' && btn.dataset.kitchen === kitchenPreset));
        btn.disabled = !on;
      });
      const kind = K.kindFor(fixtureKindId);
      help.textContent = activeTool === 'fixture' && washroomPreset
        ? `${window.DraftWashroomPresets.PRESETS[washroomPreset].label}: press to drop it — [ ] turn, F mirror, Esc to put it down.`
        : activeTool === 'fixture' && kitchenPreset
        ? `${window.DraftKitchenPresets.PRESETS[kitchenPreset].label}: press to drop it — into a corner two walls make, or with its own two walls anywhere else. [ ] turn, F swaps the legs, Esc to put it down.`
        : activeTool === 'fixture'
        ? (fixtureRunStart
          ? `Press the other end of the ${kind.label.toLowerCase()} run.`
          : kind.note)
        : '';
    };
    syncFixturePanel();
  };

  const buildAssemblyPanel = () => {
    const slot = document.getElementById('tool-slot');
    if (!slot) return;
    const box = document.createElement('div');
    box.dataset.toolGroup = 'assembly';
    const title = document.createElement('div');
    title.dataset.toolGroupName = '';
    title.textContent = 'ASSEMBLY';

    const asmBtn = document.createElement('button');
    asmBtn.type = 'button';
    asmBtn.className = 'sel-chip asm-wide';
    asmBtn.dataset.assemblyStart = '';
    asmBtn.addEventListener('click', () => {
      if (!selection.length) return;
      assemblyDialogOpen = true;
      syncAssembly();
      slot.querySelector('[data-assembly-name]')?.focus();
    });

    const unBtn = document.createElement('button');
    unBtn.type = 'button';
    unBtn.className = 'sel-chip';
    unBtn.dataset.assemblyUngroup = '';
    unBtn.addEventListener('click', ungroupSelected);

    // LEVEL LOCK LIVES BESIDE ASSEMBLY, not in the LEVELS panel. The order
    // leaves the placement to me and this is the reason: a lock is made FROM
    // assemblies and it is the assembly the drafter has in his hand when he
    // wants one. The LEVELS panel knows about storeys, not about which
    // assembly on each storey is the same room -- putting the verb there would
    // mean picking the assemblies somewhere else and then walking to another
    // panel to join them.
    const lockBtn = document.createElement('button');
    lockBtn.type = 'button';
    lockBtn.className = 'sel-chip';
    lockBtn.dataset.levelLock = '';
    lockBtn.addEventListener('click', () => {
      const chosen = selectedGroups();
      // A LOCK OF ONE IS NOT A LOCK and the MODULE refuses it -- this verb
      // hands it the list and believes the answer, rather than counting to two
      // here. Counting here is how the page grows a second, weaker rule that
      // disagrees with the loader the day one of them changes.
      const lock = lockGroupsAcrossLevels(chosen);
      if (!lock) {
        sayOnStrip('a level lock needs two assemblies — one has nothing to '
          + 'be held against');
        return;
      }
      syncAssembly();
      paint();
    });

    const breakBtn = document.createElement('button');
    breakBtn.type = 'button';
    breakBtn.className = 'sel-chip';
    breakBtn.dataset.levelLockBreak = '';
    breakBtn.addEventListener('click', () => {
      const lock = selectedGroups().map(levelLockFor).find(Boolean);
      if (lock && breakLevelLock(lock)) { syncAssembly(); paint(); }
    });

    // ANCHOR (Movie, 22 Oct): lit, a click on a corner of the held assembly
    // that a wall outside it shares turns it into an aqua anchor, or back.
    const anchorBtn = document.createElement('button');
    anchorBtn.type = 'button';
    anchorBtn.className = 'sel-chip';
    anchorBtn.dataset.assemblyAnchor = '';
    anchorBtn.textContent = 'ANCHOR';
    anchorBtn.title = 'ANCHOR — click a corner the assembly shares with another wall: one anchor, it follows that corner; two on a lined-up wall, it slides along it like a window';
    anchorBtn.addEventListener('click', () => {
      const group = selectedGroups()[0];
      anchorPicking = anchorPicking || !group ? null : group;
      anchorBtn.setAttribute('aria-pressed', String(!!anchorPicking));
      sayOnStrip(anchorPicking ? `ANCHOR: click a corner of ${group.name} that it shares with a wall outside it. Esc or ANCHOR again ends.` : '');
      paint();
    });
    const anchorSaid = group => {
      const n = anchorsOf(group).length;
      if (n === 0) return `${group.name} has no anchors.`;
      if (n === 1) return `${group.name} is anchored: it follows that corner when the corner moves.`;
      if (n === 2 && anchorSlide(group)) return `${group.name} slides along that wall like a window; the wall stretches to stay joined.`;
      return `${group.name} has ${n} anchors that are not two on one lined-up wall, so it does not slide -- MOVE still moves it.`;
    };
    window.addEventListener('pointerdown', event => {
      const group = anchorPicking;
      if (!group || event.target !== canvas || event.button !== 0) return;
      event.stopImmediatePropagation();
      event.preventDefault();
      const r = canvas.getBoundingClientRect();
      const px = event.clientX - r.left, py = event.clientY - r.top;
      let best = null, bestD = 14;
      groupWalls(group).forEach(wall => ['start', 'end'].forEach(end => {
        const p = toS(wall[end]);
        const d = Math.hypot(p.x - px, p.y - py);
        if (d < bestD) { bestD = d; best = { wall, end, vtx: wall[end] }; }
      }));
      if (!best) { sayOnStrip(`No corner of ${group.name} there -- Esc or ANCHOR again ends.`); return; }
      if (!outsideWallsAt(group, best.vtx).length) {
        sayOnStrip('That corner is not shared with a wall outside the assembly, so there is nothing to anchor it to.');
        return;
      }
      const before = { ...group };
      const list = Array.isArray(group.anchors) ? group.anchors : [];
      const on = anchorsOf(group).find(a => a.vtx === best.vtx);
      group.anchors = on
        ? list.filter(a => !(String(a.wallId) === String(on.wallId) && (a.end === 'end' ? 'end' : 'start') === on.end))
        : [...list, { wallId: best.wall.id, end: best.end }];
      if (!group.anchors.length) delete group.anchors;
      undoStack.push({ kind: 'props', edits: [{ item: group, before }] });
      markDirty();
      sayOnStrip(anchorSaid(group));
      paint();
    }, true);
    window.addEventListener('keydown', event => {
      if (!anchorPicking || event.key !== 'Escape') return;
      anchorPicking = null;
      anchorBtn.setAttribute('aria-pressed', 'false');
      sayOnStrip('');
      paint();
    }, true);

    const help = document.createElement('div');
    help.className = 'sel-help';
    help.dataset.assemblyHelp = '';

    const dialog = document.createElement('div');
    dialog.dataset.assemblyDialog = '';
    dialog.hidden = true;
    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.dataset.assemblyName = '';
    nameInput.placeholder = 'NAME';
    nameInput.addEventListener('input', e => { assemblyName = e.target.value; });
    nameInput.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); createAssembly(true); }
      // See the note above: Escape here CREATES, it does not cancel.
      if (e.key === 'Escape') { e.preventDefault(); createAssembly(false); }
      // The page's own Escape clears the selection, which would empty the
      // dialog out from under itself.
      e.stopPropagation();
    });
    const row = document.createElement('div');
    row.className = 'sel-row';
    const fixedBtn = document.createElement('button');
    fixedBtn.type = 'button';
    fixedBtn.className = 'sel-chip';
    fixedBtn.dataset.assemblyFixed = '';
    fixedBtn.textContent = 'FIXED';
    fixedBtn.addEventListener('click', () => createAssembly(true));
    const looseBtn = document.createElement('button');
    looseBtn.type = 'button';
    looseBtn.className = 'sel-chip';
    looseBtn.dataset.assemblyLoose = '';
    looseBtn.textContent = 'NOT FIXED';
    looseBtn.addEventListener('click', () => createAssembly(false));
    row.append(fixedBtn, looseBtn);
    dialog.append(nameInput, row);

    // ONE ROW FOR THE THREE VERBS THAT ACT ON AN ASSEMBLY THAT ALREADY
    // EXISTS. Not a tidy: two extra full-width rows grew the right panel until
    // it covered world (4,-3), and model-html-draw-delete caught it as "the
    // tap reached the right sidebar, not the canvas" -- the same shape as the
    // instrument strip overflowing at 1280, one tier down. The panel was
    // already at that edge and one row tipped it.
    //
    // UNGROUP keeps its own width when it is alone, because BREAK LOCK is
    // hidden until there is a lock to break.
    const actRow = document.createElement('div');
    actRow.className = 'sel-row';
    actRow.append(unBtn, lockBtn, breakBtn, anchorBtn);
    box.append(title, asmBtn, actRow, help, dialog);
    // ONTO THE DRAFTING TAB, from the table: these verbs act on what Select
    // got hold of, so they sit with the key that got it.
    (leftPane(paneForBlock('assembly')) || slot).append(box);

    syncAssembly = () => {
      const n = selection.length;
      const held = selectedGroups();
      const key = window.DraftToolRoster?.keyFor('select')
        ? window.DraftToolRoster.bindings() : {};
      const gKey = window.DraftKeyboard?.keyBindingLabel(key.group) || '';
      // §6: "the assembly verbs ... none of them operate in TOY". The board
      // beats the selection count -- a TOY drafter with items selected must
      // still find ASSEMBLY down, or the rule holds only while nothing is
      // picked, which is the half nobody would test.
      const on = window.DraftToolRoster?.panelOn('assembly', board) !== false;
      asmBtn.textContent = gKey ? `ASSEMBLY GROUP  [${gKey}]` : 'ASSEMBLY GROUP';
      asmBtn.disabled = !on || n === 0;
      // ASSEMBLY GROUP / ASSEMBLY BUST (Movie, 18 Oct): BREAK is the roof's
      // cut along its edges, so the assembly's own undoing has its own word.
      unBtn.textContent = 'ASSEMBLY BUST';
      unBtn.disabled = !on || held.length === 0;
      unBtn.hidden = held.length === 0;
      // THE LOCK VERBS ARE SYNCED HERE, in the same pass that owns these
      // buttons' state. Two places deciding one button's state is how they
      // drift -- the boneyard card cost an hour to exactly that.
      const lockedNow = held.map(levelLockFor).find(Boolean) || null;
      lockBtn.textContent = 'LEVEL LOCK';
      // OFFERED WITH ONE, AND REFUSED BY THE MODULE. Disabling this at
      // `held.length < 2` would be THE PAGE COUNTING TO TWO -- a second, weaker
      // copy of makeLock's rule, sitting where it can drift from the loader
      // that enforces the same thing. The gate proved it: with the count here,
      // a mutant replacing makeLock with the page's own maker SURVIVED,
      // because the button never fired and nothing ever asked the module.
      //
      // So the verb is live whenever an assembly is held, the module refuses a
      // lock of one, and the strip says why. A drafter finds out what a lock
      // needs by being told, rather than by a grey button that explains
      // nothing.
      lockBtn.disabled = !on || held.length === 0 || !!lockedNow;
      lockBtn.hidden = held.length === 0;
      // ANCHOR for one assembly held; put down when it is not.
      anchorBtn.hidden = !on || held.length !== 1;
      if (anchorPicking && (held.length !== 1 || held[0] !== anchorPicking)) anchorPicking = null;
      anchorBtn.setAttribute('aria-pressed', String(!!anchorPicking));
      breakBtn.textContent = lockedNow ? `BREAK ${lockedNow.name}` : 'BREAK LOCK';
      breakBtn.disabled = !on || !lockedNow;
      breakBtn.hidden = !lockedNow;
      // The old page's own two sentences (:23631-23633), and the red is its
      // own too: nothing selected is the state that stops the button working.
      help.textContent = !on
        ? 'Assemblies are not offered on this board.'
        : (n ? `${n} selected item${n === 1 ? '' : 's'} · make a named assembly.`
             : 'Select drawing items before assembling them.');
      help.toggleAttribute('data-engaged', !on || n === 0);
      dialog.hidden = !assemblyDialogOpen;
      if (!assemblyDialogOpen) nameInput.value = assemblyName = '';
    };
    syncAssembly();
  };

  buildFixturePanel();
  buildAssemblyPanel();
  selectionWatchers.push(() => syncAssembly());

  // ── THE STRUCTURE PROPERTIES PANEL ───────────────────────────────────────
  //
  // WHAT IT DOES NOT DO, said plainly rather than left to be discovered: it
  // does not make an existing column or beam clickable. This page's hit-test
  // knows walls, lines and floors; teaching it structure is the selection
  // system's job and not #392's. So the panel shows the item the drafter just
  // PLACED, which is the moment its properties are wanted and the moment
  // commitWall already selects its wall in.
  //
  // ONE VALUE PER ROW, AND THE VALUES ARE THE FORMAT'S. footing and mode are
  // enumerations drawing-format.js validates (:517 and :563); anything not on
  // those lists is silently replaced with the default on the next load, so the
  // panel offers exactly what the reader accepts and nothing else.
  const FOOTINGS = [['pad36', 'PAD 36"'], ['pad42', 'PAD 42"'],
    ['pile8', 'PILE 8"'], ['pile10', 'PILE 10"'], ['pile12', 'PILE 12"']];
  const BEAM_MODES = [['flush', 'FLUSH'], ['dropped', 'DROPPED']];

  const propRow = (label, options, current, pick) => {
    const row = document.createElement('div');
    row.dataset.propRow = label.toLowerCase();
    const name = document.createElement('div');
    name.className = 'props-title';
    name.textContent = label;
    const chips = document.createElement('div');
    chips.className = 'chip-row';
    chips.append(...options.map(([id, face]) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'sel-chip';
      btn.dataset.propValue = id;
      btn.textContent = face;
      btn.setAttribute('aria-pressed', String(id === current));
      btn.addEventListener('click', () => pick(id));
      return btn;
    }));
    row.append(name, chips);
    return row;
  };

  // A BUILDER RETURNS A NODE AND NOTHING ELSE. It used to call ModelProps.set
  // itself and return EARLY when the selection was not its own kind -- which
  // left whatever was in the box standing. See the router below.
  const columnPropsNode = item => {
    const box = document.createElement('div');
    box.append(propRow('FOOTING', FOOTINGS, item.footing, id => {
      item.footing = id;
      // A pile has a fixed diameter, so a pad's custom size is meaningless
      // on one. The format drops padIn for piles anyway (:534); dropping it
      // here too keeps the page's record and the reader's identical.
      if (id.startsWith('pile')) delete item.padIn;
      markDirty();
      showSelectionProps();
      paint();
    }));
    return box;
  };

  const beamPropsNode = list => {
    const items = Array.isArray(list) ? list : [list];
    const box = document.createElement('div');
    const span = items.reduce((sum, item) => sum + Math.hypot(item.end.x - item.start.x, item.end.z - item.start.z), 0);
    box.append(propRow('BEAM', BEAM_MODES, agreedOn(items, item => item.mode), id => {
      items.forEach(item => { item.mode = id; });
      markDirty();
      showSelectionProps();
      paint();
    }));
    const len = document.createElement('div');
    len.dataset.propSpan = '';
    len.className = 'props-title';
    // The span is read from the geometry, never stored: a stored length and
    // a moved endpoint are two facts that can disagree, and the drafter
    // would believe the one on the panel.
    len.textContent = `SPAN ${feetLabel(span)}`;
    box.append(len);
    // THE ENGINEER'S MARK (Movie, 19 Oct: "make that TEXT editable so and
    // ENGINEER can change it to whatever they specify the floor or beams as
    // (STEEL, LAMINATED BEAMS etc)"). It labels the beam on the plan and the
    // sheets in place of FLUSH / DROPPED BEAM; blank puts that back.
    box.append(propText('MARK', agreedOn(items, item => item.mark || '') || '', text => {
      const edits = items.map(item => ({ item, before: { ...item } }));
      items.forEach(item => { if (text.trim()) item.mark = text.trim(); else delete item.mark; });
      undoStack.push({ kind: 'props', edits });
      markDirty();
      showSelectionProps();
      paint();
    }));
    return box;
  };

  // ── WALL PROPERTIES ───────────────────────────────────────────────────────
  //
  // Movie, 19 Sep: "if they select a specific wall or multiples they can
  // change the properties". A wall, or several -- NOT the old page's rule.
  // MODEL.dc.html has this editor only on an ASSEMBLY
  // (_selectedGroupForWallEditing), so changing one wall's type there means
  // bundling it into a named group first. Movie ruled otherwise for this
  // page. The RECORD it writes is the old page's, field for field
  // (_applyGroupWallSettings :18110-18118).
  //
  // WHY IT MATTERS MORE THAN IT LOOKS. A wall's height is copied in when it
  // is drawn, from the storey's default, and never looked at again -- on both
  // pages. Movie's rule for the default moving ("if the floor or ceiling is
  // the same height as the DEFAULT, if they change the PROJECT DEFAULT, also
  // change those heights to match") leaves behind exactly the walls somebody
  // had already adjusted, and he answered that himself: "(the user may need
  // to manually change the 'previously adjusted' height". This is the panel
  // he changes them with.
  // THE SAME WORDS AS THE WALL PANEL (WALL_SIDES): a label is the side the
  // wall body stands on, read along the wall's own start -> end; the value
  // is the face the stored line is. 'LEFT' here used to mean the line is the
  // left face -- a wall on the RIGHT -- which is the opposite of what the
  // same word means on the tool's panel. One vocabulary, or a drafter sets
  // LEFT twice and gets two walls.
  const REF_LINES = [['right', 'LEFT SIDE'], ['center', 'CENTERLINE'], ['left', 'RIGHT SIDE']];

  // A GUARDRAIL IS 42", and that is a HELD DEFAULT rather than a code rule --
  // the height one arrives at when it is first switched on, and Movie's to
  // change. 42 inches is 3'-6", which is what the field shows.
  //
  // AND IT IS A GUARDRAIL, NOT A HANDRAIL. Movie drew the line, 20 Sep: "it
  // should be clarified as GUARDRAIL (typical 42" height) / to be not
  // confused with HANDRAIL which would be 3' height an accompany min one
  // side of a staircase". Six inches apart and different jobs -- a guard
  // stops a fall, a hand rail is what you hold going down. The handrail is
  // NOT built, here or anywhere: it belongs to the stair, not to a wall
  // type, and naming this one properly is what keeps the next reader from
  // assuming it was.
  const GUARDRAIL_HEIGHT_FT = 42 / 12;

  // What the walls in hand AGREE on, or null. A LIT CHIP IS A CLAIM ABOUT
  // EVERY WALL IN THE SELECTION, so two walls of different types light
  // nothing rather than lighting the first one's -- the drafter would
  // otherwise read the panel as "these are all 2x6" and be wrong about one.
  const agreedOn = (walls, read) => {
    const first = read(walls[0]);
    return walls.every(wall => read(wall) === first) ? first : null;
  };

  // The same patch onto every item in hand. applyToWalls is this plus the
  // wall-type substitution, which is a wall's own business.
  const applyToItems = (items, patch) => {
    items.forEach(item => Object.assign(item, patch));
    markDirty();
    showSelectionProps();
    paint();
  };

  const applyToWalls = (walls, patch) => {
    walls.forEach(wall => {
      Object.assign(wall, patch);
      // A DRAFTER'S CHANGE ENDS THE SUBSTITUTION (MODEL.dc.html:18114). The
      // loader records a wall whose retired type was mapped onto a current
      // one and the saver puts the ORIGINAL back; without this line a wall
      // somebody just set to RAIL would save as concrete_12 again. "Never
      // persist the substitute" turned into "never persist the drafter's
      // change" is the failure the fix itself creates if this is missed.
      if (patch.wallType !== undefined) substitutedWallTypes.delete(wall.id);
    });
    // A FACE MOVED: the flights locked to it follow, and say so.
    if (patch.wallType !== undefined || patch.refLine !== undefined) showStairFitNote(followStairLocks());
    markDirty();
    showSelectionProps();
    paint();
  };

  const wallPropsNode = walls => {
    const WT = window.DraftWallTypes;
    const F = window.DraftFormatters;
    const ftIn = feet => F.formatArchitecturalInches(feet * 12);
    const box = document.createElement('div');

    // THE TYPES ON OFFER ARE THE CONTEXT'S, not the whole table. Foundation
    // assemblies and framed ones are disjoint lists (contextWallTypes), so
    // offering an 8" pour for a wall on the main floor is not a near miss, it
    // is a wall of the wrong kind. Read off the WALLS rather than the active
    // view, because the walls are what is being changed; a selection spanning
    // two views agrees on nothing and gets the whole table.
    const view = agreedOn(walls, wall => wall.view || 'plan');
    const types = view === null ? WT.WALL_TYPES : contextWallTypes(view);
    box.append(propRow('TYPE', types.map(type => [type.id, type.label]),
      agreedOn(walls, wall => wall.wallType || 'stud_2x6'),
      id => applyToWalls(walls, { wallType: id })));

    box.append(propRow('WALL SIDE', REF_LINES,
      agreedOn(walls, wall => wall.refLine || 'center'),
      id => applyToWalls(walls, { refLine: id })));

    // A WALL STANDS ON ITS BASE. Refused per wall rather than against the
    // agreed pair, because a selection whose tops differ has no agreed pair
    // to check and would accept a base above one of them.
    const height = (which, label) => propField(label,
      agreedOn(walls, wall => Number(which === 'base' ? wall.baseHeight : wall.topHeight) || 0),
      feet => {
        const bad = walls.find(wall => {
          const base = which === 'base' ? feet : Number(wall.baseHeight) || 0;
          const top = which === 'base' ? Number(wall.topHeight) || 0 : feet;
          return !(top > base);
        });
        if (bad) {
          return `A wall from ${ftIn(which === 'base' ? feet : Number(bad.baseHeight) || 0)} `
            + `to ${ftIn(which === 'base' ? Number(bad.topHeight) || 0 : feet)} is not a wall.`;
        }
        applyToWalls(walls, which === 'base' ? { baseHeight: feet } : { topHeight: feet });
        return null;
      }, showSelectionProps);
    box.append(height('base', 'BASE'), height('top', 'TOP'));
    // A SUITE'S HEIGHT IS SET WHERE IT IS PLACED, and PROPERTIES says so over
    // the stand-in it is drawn at (Movie, 20 Oct).
    const standIn = drawing?.suiteKind && walls.every(wall => Number(wall.levelId) < 0)
      ? SUITE_STAND_IN_FT[drawing.suiteKind] : null;
    if (standIn != null) {
      const note = document.createElement('div');
      note.className = 'sel-help';
      note.dataset.suiteHeightNote = '';
      note.textContent = `HEIGHT — SET WHEN PLACED: the suite fits the floor-to-ceiling height `
        + `of the floor it stands on (${ftIn(standIn)} shown here).`;
      box.append(note);
    }

    // ── GUARDRAIL ─────────────────────────────────────────────────────────
    //
    // Movie, 20 Sep, refining his own earlier "lets consider a 'RAIL' a wall
    // type": "RAIL will be an option for WALL properties it will be toggle
    // you can select turn on or off, and if you turn it on the height will
    // be adjusted to what you input in that part (rail section) of the
    // properties area", and "properties area for WALL". Then the name, same
    // day: "GUARDRAIL (typical 42" height) / to be not confused with
    // HANDRAIL which would be 3' height an accompany min one side of a
    // staircase".
    //
    // THE TOGGLE IS THE VERB; THE WALL TYPE IS THE RECORD. `wallType ===
    // 'guardrail'` is what makes a wall one -- a single stored fact, no key
    // of its own, nothing that can disagree with itself. A `rail: true` beside a
    // type would be two ways to say one thing, which is the drift this file
    // has paid for repeatedly; the toggle simply READS the type it already
    // writes, and the TYPE row above shows the same answer.
    //
    // TURNING IT OFF RETURNS THE WALL TO ITS CONTEXT'S DEFAULT rather than
    // to whatever it was before. Remembering the old type would be a second
    // stored fact for the sake of one undo, and Ctrl+Z is the page's answer
    // to that.
    const isRail = wall => (wall.wallType || '') === 'guardrail';
    const railOn = agreedOn(walls, isRail);
    box.append(propRow('GUARDRAIL', [['on', 'ON'], ['off', 'OFF']],
      railOn === null ? null : (railOn ? 'on' : 'off'),
      id => {
        if (id === 'off') {
          applyToWalls(walls, { wallType: contextWallType(view || 'plan') });
          return;
        }
        // THE HEIGHT COMES WITH IT. A wall switched to a guardrail and left
        // at nine feet is a nine-foot railing, which is not a thing -- so
        // the first switch brings 42" with it and the field below is how it
        // is changed. A wall already at that height keeps the number it has.
        applyToWalls(walls, { wallType: 'guardrail',
          ...(walls.every(wall => Number(wall.topHeight) === GUARDRAIL_HEIGHT_FT)
            ? {} : { topHeight: GUARDRAIL_HEIGHT_FT }) });
      }));

    // ONLY WHILE IT IS ON, because a guardrail height on a wall that is not
    // one is a field that edits something else under another name -- it
    // would be the TOP row again, wearing a word that does not apply.
    if (railOn) {
      box.append(propField('GUARDRAIL HEIGHT',
        agreedOn(walls, wall => Number(wall.topHeight) || 0),
        feet => {
          if (!(feet > 0)) return 'A guardrail needs a height greater than zero.';
          applyToWalls(walls, { topHeight: feet });
          return null;
        }, showSelectionProps));
    }
    return box;
  };

  // ── FENESTRATION PROPERTIES ───────────────────────────────────────────
  //
  // Movie, 18 Sep, on the bungalow's windows and doors: he wanted them so he
  // could "change them if i need to afterwards". Stage 1 drew them, stage 2
  // placed, picked and slid them, and the parity row has said since: "Also
  // absent: typing a width, sill or head -- the properties panel STATES all
  // three so they are not discovered by placing one." This is that row.
  //
  // A WIDTH CHANGE IS A PLACEMENT AGAIN. An opening has to fit its wall with
  // bearing either side, and the rule for that is clampOpeningToWall --
  // already the rule a press follows. Re-asking it with the new width slides
  // the opening if it must and refuses when the wall cannot carry it at all,
  // which is the same two answers, in the same words, as placing one.
  const openingHostWall = opening =>
    walls().find(wall => wall.id === opening.wallId) || null;

  const openingPropsNode = openings => {
    const F = window.DraftFormatters;
    const G = window.DraftGeometry2D;
    const box = document.createElement('div');
    const typeOf = opening => (opening.type === 'door' ? 'door' : 'window');

    box.append(propRow('OPENING', OPENING_TYPES,
      agreedOn(openings, typeOf),
      id => {
        // A DOOR'S SILL IS ZERO BY CONSTRUCTION -- it stands on the floor --
        // which is the old page's rule at the point of writing the record
        // rather than a second number kept beside the first. So the switch
        // carries it, and the SILL row below goes away with it.
        applyToOpenings(openings, opening => ({
          type: id, layer: id === 'door' ? 'A-DOOR' : 'A-GLAZ',
          ...(id === 'door' ? { sillHeight: 0 } : {}),
        }));
      }));

    // ── AND SWITCHING ONE CHANGES ITS PANES, NOT ITS SIZE ──────────────────
    //
    // Movie, 22 Sep, asked whether picking DOUBLE CASEMENT should resize the
    // window it is picked on: *"no size should stay the same (they can change
    // it)"* -- and separately, for a window being placed, *"ya lets make that
    // size default for that type"*. Both, and they are only both true if a
    // size is a DEFAULT the type carries in rather than a rule it enforces
    // afterwards. So the tool panel loads 5'-6" x 3'-0" when a double is
    // picked to place; this row does not, because by here the drafter has a
    // window on the drawing and its width may be one he typed.
    //
    // It is the 7'-0" head ruling a third time: what moves is what nobody
    // chose, and nothing here was nobody's.
    if (agreedOn(openings, typeOf) === 'window') {
      box.append(propRow('CASEMENT', CASEMENT_CHIPS,
        agreedOn(openings, o => (o.casement === 'double' ? 'double' : 'single')),
        id => applyToOpenings(openings, () => ({ casement: id }))));
    }

    // A NEW WIDTH, CLAMPED TO EACH OPENING'S OWN WALL -- the WIDTH field's
    // rule, shared with the DOOR list and the GARDEN fields so all three
    // refuse a width the wall cannot carry the same way. `extra` adds to each
    // opening's patch (a type, a style, a head).
    const resizeOpenings = (feet, extra = () => ({})) => {
      if (!(feet > 0)) return 'An opening needs a width greater than zero.';
      const refused = [];
      const clamped = new Map();
      openings.forEach(opening => {
        const wall = openingHostWall(opening);
        if (!wall) { refused.push(opening); return; }
        const fit = G.clampOpeningToWall(wall, Number(opening.offset) || 0, feet,
          { walls: walls(), thicknessFt: openingThicknessFt() });
        if (!fit) { refused.push(opening); return; }
        clamped.set(opening, fit.offset);
      });
      if (refused.length) {
        const wall = openingHostWall(refused[0]);
        const said = `TOO BIG — that wall is too short to carry a ${sizeText(feet)} opening.`
          + (wall ? widestSaid(wall, sizeText) : '');
        brushWarn(said, { opening: refused[0] });
        return said;
      }
      applyToOpenings(openings, opening =>
        ({ width: feet, offset: clamped.get(opening), ...extra(opening) }));
      return null;
    };

    // ── THE DOOR: WHICH ONE, AND WHICH WAY IT OPENS (Movie, 1 Oct) ─────────
    //
    // The size rule is his: a new STYLE keeps the door's size, a new TYPE
    // takes the type's default -- so EXT TYP. to EXT FRENCH stays 36", and
    // EXT to INT goes to 30". Into or out of a garage door is a new type,
    // and the head goes with the size.
    if (agreedOn(openings, typeOf) === 'door') {
      const entryOf = o => G.doorCatalogEntry(o)?.id || null;
      const current = agreedOn(openings, entryOf);
      box.append(propSelect('DOOR', G.DOOR_CATALOG.map(e => [e.id, e.label]), current, id => {
        const next = G.DOOR_CATALOG.find(e => e.id === id);
        if (!next) return;
        const kind = opening => (next.type === 'garage'
          ? { garage: true, doorType: 'garage', doorStyle: 'overhead' }
          : { garage: false, doorType: next.type, doorStyle: next.style,
            ...(next.style === 'garden' ? { gardenWindowWidth: null } : {}) });
        const typeChanges = openings.some(o => G.doorCatalogEntry(o)?.type !== next.type);
        if (!typeChanges) { applyToOpenings(openings, kind); return; }
        const head = next.defaultHeightFt || G.DEFAULT_OPENING_HEAD_FT;
        const refusal = resizeOpenings(next.defaultFt, o => ({ ...kind(o), headHeight: head }));
        if (refusal) sayOnStrip(refusal);
      }));
      if (openings.length === 1 && openings[0].doorStyle === 'garden') {
        const only = openings[0];
        const split = G.gardenSplitFt(only);
        box.append(propField('DOOR WIDTH', split.doorFt, feet => {
          if (!(feet > 0)) return 'The door needs a width greater than zero.';
          return resizeOpenings(feet + split.windowFt, () => ({ gardenWindowWidth: split.windowFt }));
        }, showSelectionProps, { inches: true }));
        box.append(propField('WINDOW WIDTH', split.windowFt, feet => {
          if (!(feet > 0)) return 'The window needs a width greater than zero.';
          return resizeOpenings(split.doorFt + feet, () => ({ gardenWindowWidth: feet }));
        }, showSelectionProps, { inches: true }));
      }
      // A SIDELIGHT'S SIDES AND ITS LIGHT (Movie, 24 Oct: "One or two,
      // picked", "36" door + 14" light"). The leaf keeps its width: a light
      // added or taken away widens or narrows the unit by its own width.
      if (openings.length === 1 && openings[0].doorStyle === 'sidelight') {
        const only = openings[0];
        const p = G.sidelightPanelsFt(only);
        const count = sides => (sides === 'both' ? 2 : 1);
        box.append(propSelect('SIDELIGHT', [['latch', 'LATCH SIDE'], ['hinge', 'HINGE SIDE'], ['both', 'BOTH SIDES']],
          p.sides, sides => {
            const refusal = resizeOpenings(p.doorFt + count(sides) * p.lightFt,
              () => ({ sidelightSides: sides, sidelightWidth: p.lightFt }));
            if (refusal) sayOnStrip(refusal);
          }));
        box.append(propField('DOOR WIDTH', p.doorFt, feet => {
          if (!(feet >= 1)) return 'The door needs a width of a foot or more.';
          return resizeOpenings(feet + count(p.sides) * p.lightFt, () => ({ sidelightWidth: p.lightFt, sidelightSides: p.sides }));
        }, showSelectionProps, { inches: true }));
        box.append(propField('LIGHT WIDTH', p.lightFt, feet => {
          if (!(feet > 0)) return 'The light needs a width greater than zero.';
          return resizeOpenings(p.doorFt + count(p.sides) * feet, () => ({ sidelightWidth: feet, sidelightSides: p.sides }));
        }, showSelectionProps, { inches: true }));
      }
      if (openings.every(o => o.garage !== true)) {
        box.append(doorHandRow(
          openings.every(o => o.hingeFlip === true),
          openings.every(o => o.swingFlip === true),
          which => applyToOpenings(openings, o => (which === 'hinge'
            ? { hingeFlip: o.hingeFlip !== true } : { swingFlip: o.swingFlip !== true }))));
        // SHOW HEIGHT (Movie, 24 Oct: "doors only mark WIDTH, but allow them
        // to add X 80"): the mark says the height on this door even at the
        // standard 80". Off the height is said only when it is not 80".
        const shown = openings.every(o => o.showHeight === true);
        const row = document.createElement('div');
        row.dataset.propRow = 'show-height';
        const chips = document.createElement('div');
        chips.className = 'chip-row';
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'sel-chip';
        chip.dataset.doorShowHeight = '';
        chip.textContent = 'SHOW HEIGHT';
        chip.setAttribute('aria-pressed', String(shown));
        chip.addEventListener('click', () => applyToOpenings(openings, () => ({ showHeight: shown ? null : true })));
        chips.append(chip);
        row.append(chips);
        box.append(row);
      }
    }

    box.append(propField('WIDTH', agreedOn(openings, o => Number(o.width) || 0),
      feet => resizeOpenings(feet), showSelectionProps, { inches: true }));

    // ONLY A WINDOW HAS ONE, for the reason above. A sill row on a door
    // would edit a number the record writes as zero whatever it said.
    if (agreedOn(openings, typeOf) === 'window') {
      box.append(propField('SILL', agreedOn(openings, o => Number(o.sillHeight) || 0),
        feet => {
          const bad = openings.find(o => feet >= (Number(o.headHeight) || 0));
          if (bad) {
            return `A sill at ${sizeText(feet)} is not `
              + `below the head at `
              + `${sizeText((Number(bad.headHeight) || 0))}.`;
          }
          applyToOpenings(openings, () => ({ sillHeight: feet }));
          return null;
        }, showSelectionProps, { inches: true }));
    }

    box.append(propField('HEAD', agreedOn(openings, o => Number(o.headHeight) || 0),
      feet => {
        const bad = openings.find(o => feet <= (Number(o.sillHeight) || 0));
        if (bad) {
          return `A head at ${sizeText(feet)} is not `
            + `above the sill at `
            + `${sizeText((Number(bad.sillHeight) || 0))}.`;
        }
        applyToOpenings(openings, () => ({ headHeight: feet }));
        return null;
      }, showSelectionProps, { inches: true }));
    return box;
  };

  // PER ITEM, because two of these edits are not one patch: a width clamps to
  // each opening's own wall and lands at its own offset.
  const applyToOpenings = (openings, patchFor) => {
    openings.forEach(opening => Object.assign(opening, patchFor(opening)));
    markDirty();
    showSelectionProps();
    paint();
  };

  // ── FLOOR PROPERTIES ──────────────────────────────────────────────────
  //
  // THE THREE THE FLOOR TOOL NAMED AS ABSENT. Its own comment listed what it
  // left out -- "the typed-length ruler, arc edges, the slope and thickened-
  // edge properties, and the FLOOR JOISTS box" -- and two of those are here,
  // with the thickness that was derived at creation and never editable after.
  //
  // STRUCTURE IS READ, NOT WRITTEN. Whether a floor is framed or a slab is
  // layer-views.js's answer from where it LIVES (floorHomeView), not a
  // property of its own: a level with a foundation set files its floor there
  // whichever set it was drawn on, "because such a level's floor IS its
  // foundation". A picker here would let a drafter put a slab on a plan set
  // and make the two answers disagree.
  const floorPropsNode = floors => {
    const F = window.DraftFormatters;
    const box = document.createElement('div');

    const structure = agreedOn(floors, floor =>
      (floor.structure === 'slab' ? 'SLAB' : 'FRAMED'));
    const said = document.createElement('div');
    said.className = 'props-title';
    said.dataset.propStructure = '';
    said.textContent = structure === null ? 'MIXED' : structure;
    box.append(said);

    box.append(propField('THICKNESS',
      agreedOn(floors, floor => Number(floor.thickness) || 0),
      feet => {
        if (!(feet > 0)) return 'A floor needs a thickness greater than zero.';
        applyToItems(floors, { thickness: feet });
        return null;
      }, showSelectionProps));

    // Movie asked for this one by name on 18 Sep, in the same breath as the
    // roof: "i'd like the roof and thickened edge done".
    const thick = agreedOn(floors, floor => floor.thickenedEdge === true);
    box.append(propRow('THICKENED EDGE', [['on', 'ON'], ['off', 'OFF']],
      thick === null ? null : (thick ? 'on' : 'off'),
      id => applyToItems(floors, { thickenedEdge: id === 'on' })));

    // INCHES PER FOOT, which is how a garage slab's fall is drawn and how the
    // record already stores it. Not an architectural length: a slope is a
    // ratio, and putting it through the foot-and-inch parser would make
    // 1/4 read as a quarter of a foot.
    box.append(numberField('SLOPE IN/FT',
      agreedOn(floors, floor => Number(floor.slopeInPerFt) || 0) ?? 0,
      0, 3, 0.125, value => {
        if (value === null) return agreedOn(floors, floor => Number(floor.slopeInPerFt) || 0) ?? 0;
        applyToItems(floors, { slopeInPerFt: value });
        return value;
      }));

    // READ FROM THE GEOMETRY, never stored -- a stored area and a dragged
    // corner are two facts that can disagree, and the drafter would believe
    // the one on the panel.
    const area = floors.reduce((sum, floor) => {
      const points = floor.points || [];
      return sum + Math.abs(points.reduce((acc, point, index) => {
        const next = points[(index + 1) % points.length];
        return acc + (point.x * next.z - next.x * point.z);
      }, 0)) / 2;
    }, 0);
    const size = document.createElement('div');
    size.dataset.propArea = '';
    size.className = 'props-title';
    size.textContent = `AREA ${Math.round(area)} SQ FT`;
    box.append(size);
    return box;
  };

  // ── LINE PROPERTIES ───────────────────────────────────────────────────
  //
  // A LINE CARRIES ALMOST NOTHING, and saying so is the panel. Its record is
  // two points, a level, a view and a layer -- no type, no width, no height.
  // What a drafter wants off it is the LENGTH, and that is read from the two
  // points rather than stored, for the reason the beam's SPAN is.
  //
  // AN EMPTY BOX WOULD BE THE WRONG ANSWER. It would read as "this page has
  // no properties for a line", which is not what is true: a line HAS no
  // properties to change, and those are different sentences.
  // A TEXT BOX, which propField is not: that one is a length, formatted and
  // parsed. This one keeps what was typed. It commits on Enter or on leaving
  // the box, and Escape puts the old text back.
  const propText = (label, value, commit) => {
    const row = document.createElement('div');
    row.dataset.propRow = label.toLowerCase();
    const name = document.createElement('div');
    name.className = 'props-title';
    name.textContent = label;
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'prop-field';
    input.dataset.propText = label.toLowerCase();
    input.setAttribute('aria-label', label);
    input.value = value;
    let done = false;
    const apply = () => {
      if (done) return;
      done = true;
      if (input.value !== value) commit(input.value);
    };
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); apply(); input.blur(); }
      if (e.key === 'Escape') { done = true; input.value = value; input.blur(); }
    });
    input.addEventListener('blur', apply);
    row.append(name, input);
    return row;
  };

  // NAME on top, SIZE under it (Movie, 1 Oct). The size is in feet the way he
  // writes it -- 12X10, 12-6X10, 12-4 1/4X10 -- WIDTH by HEIGHT as the room
  // sits on the plan, and printed exactly as typed: "if they only put in 12
  // only show 12".
  const roomTagPropsNode = tag => {
    const box = document.createElement('div');
    const edit = change => {
      undoStack.push(brushUndoStep([tag]));
      change();
      markDirty();
      showSelectionProps();
      paint();
    };
    box.append(propText('NAME', tag.name || '', text => {
      const name = text.replace(/\s+/g, ' ').trim().toUpperCase();
      // A NAMELESS TAG IS NO TAG: the format drops it on the next load. The
      // box goes back to the name it had rather than saving one that leaves.
      if (!name) { sayOnStrip('A ROOM TAG needs a name -- DELETE takes the tag away.'); showSelectionProps(); return; }
      edit(() => { tag.name = name; });
    }));
    box.append(propText('SIZE', tag.size || '', text => {
      const size = text.replace(/\s+/g, ' ').trim();
      edit(() => { if (size) tag.size = size; else delete tag.size; });
    }));
    const note = document.createElement('div');
    note.className = 'props-title';
    note.dataset.propNote = '';
    note.textContent = 'SIZE IN FEET, WIDTH X HEIGHT: 12X10, 12-6X10. DRAG THE TAG TO MOVE IT.';
    box.append(note);
    // ── THE ROOM'S SHAPE (Movie, 23 Oct) ─────────────────────────────────
    // Its measured AREA, the switch that shows it under the name, and the
    // FLOORING the shape lays when one is picked: "the FLOOR aspect doesn't
    // always need to be turned on, (it can just be turned off and the AREA
    // calculated, or the user can change the flooring type".
    const pts = roomShapeOf(tag);
    if (pts) {
      const FMT = window.DraftDrawingFormat;
      const area = document.createElement('div');
      area.className = 'props-title';
      area.dataset.propRoomArea = '';
      area.textContent = `AREA ${roomTagEnv().areaLabel(FMT.loopAreaSqFt(pts))}`;
      box.append(area);
      const chips = document.createElement('div');
      chips.className = 'chip-row';
      const show = document.createElement('button');
      show.type = 'button';
      show.className = 'sel-chip';
      show.dataset.roomAreaShown = '';
      show.textContent = 'SHOW AREA';
      show.setAttribute('aria-pressed', String(tag.areaShown !== false));
      show.addEventListener('click', () => edit(() => {
        if (tag.areaShown === false) delete tag.areaShown; else tag.areaShown = false;
      }));
      chips.append(show);
      box.append(chips);
      const floorRow = document.createElement('div');
      floorRow.className = 'chip-row';
      const finishes = [{ id: null, label: 'NO FLOORING' }, ...FMT.FLOORING_FINISHES];
      finishes.forEach(finish => {
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'sel-chip';
        chip.dataset.roomFlooring = finish.id || 'none';
        chip.textContent = finish.label;
        chip.setAttribute('aria-pressed', String((tag.flooring?.type || null) === finish.id));
        chip.addEventListener('click', () => edit(() => {
          if (finish.id) tag.flooring = { type: finish.id }; else delete tag.flooring;
        }));
        floorRow.append(chip);
      });
      box.append(floorRow);
      const how = document.createElement('div');
      how.className = 'props-title';
      how.dataset.propNote = '';
      how.textContent = 'DRAG A CORNER ONTO A WALL NODE TO LINK IT. PRESS AN EDGE\u2019S MIDPOINT TO ADD A CORNER.';
      box.append(how);
    }
    return box;
  };

  // A SHAPE'S AREA, and whether it is the SECONDARY SUITE (Movie, 1 Oct).
  // A ticked shape's area is the SUITE line under its floor on the Real
  // Estate plan's FLOOR AREAS.
  const shapePropsNode = shape => {
    const box = document.createElement('div');
    const area = document.createElement('div');
    area.className = 'props-title';
    area.dataset.propSpan = '';
    const sqft = Math.abs(shape.points.reduce((sum, p, i) => {
      const q = shape.points[(i + 1) % shape.points.length];
      return sum + (p.x * q.z - q.x * p.z) / 2;
    }, 0));
    area.textContent = `AREA ${Math.round(sqft).toLocaleString('en-US')} SQ FT`;
    box.append(area);
    const chips = document.createElement('div');
    chips.className = 'chip-row';
    const suite = document.createElement('button');
    suite.type = 'button';
    suite.className = 'sel-chip';
    suite.dataset.shapeSuite = '';
    suite.textContent = 'SECONDARY SUITE';
    suite.setAttribute('aria-pressed', String(shape.suite === true));
    suite.addEventListener('click', () => {
      undoStack.push(brushUndoStep([shape]));
      if (shape.suite === true) delete shape.suite; else shape.suite = true;
      markDirty();
      showSelectionProps();
      paint();
    });
    chips.append(suite);
    box.append(chips);
    return box;
  };

  // ── A LINE'S WEIGHT, COLOUR AND STYLE (Movie, 19 Oct) ─────────────────
  //
  // "for the LINE -- it need some PROPERTIES that can change too. put in 5
  // line weights from thin to thick ... allow the user to select line color
  // from full spectrum as another property, and also if the line is DASHED
  // (stuff above), SOLID, DOT DASHED (property lines / beams), etc" -- and
  // "Add 4.5 XTRA-BOLD". Six weight chips drawn at their own thickness, four
  // style chips, a colour picker with the full spectrum behind it. A change
  // writes every selected line in one undo, and becomes the default for the
  // next line drawn, remembered per browser with the lights.
  const LINE_STYLE_KEY = 'lineStyle';
  let lineDefaults = (() => {
    const LS = window.DraftLineStyles;
    const raw = stored[LINE_STYLE_KEY] || {};
    return LS ? { weight: LS.weightId(raw.weight), style: LS.styleId(raw.style), color: LS.colorHex(raw.color) }
      : { weight: 2, style: 'solid', color: null };
  })();
  const lineStyleDefaults = () => ({
    weight: lineDefaults.weight, style: lineDefaults.style,
    ...(lineDefaults.color ? { color: lineDefaults.color } : {}),
  });
  const keepLineDefaults = () => {
    try {
      const keep = JSON.parse(localStorage.getItem(SKIN_KEY) || '{}');
      localStorage.setItem(SKIN_KEY, JSON.stringify({ ...keep, [LINE_STYLE_KEY]: lineDefaults }));
    } catch { /* a browser refusing storage still keeps it for this tab */ }
  };
  // The defaults on their own, for a pickup that changed no line.
  const setLineDefaults = patch => {
    lineDefaults = { ...lineDefaults, ...patch };
    keepLineDefaults();
  };
  const writeLineStyle = (lines, patch) => {
    const edits = lines.map(line => ({ item: line, before: { ...line } }));
    lines.forEach(line => {
      Object.entries(patch).forEach(([key, value]) => {
        if (value == null) delete line[key]; else line[key] = value;
      });
    });
    undoStack.push({ kind: 'props', edits });
    lineDefaults = { ...lineDefaults, ...patch };
    keepLineDefaults();
    markDirty();
    paint();
  };
  const linePropsNode = lines => {
    const LS = window.DraftLineStyles;
    const box = document.createElement('div');
    const total = lines.reduce((sum, line) => sum
      + Math.hypot(line.end.x - line.start.x, line.end.z - line.start.z), 0);
    const len = document.createElement('div');
    len.dataset.propSpan = '';
    len.className = 'props-title';
    len.textContent = `${lines.length > 1 ? 'TOTAL ' : ''}LENGTH ${feetLabel(total)}`;
    box.append(len);
    if (LS) {
      const same = key => (lines.every(l => (l[key] ?? null) === (lines[0][key] ?? null)) ? (lines[0][key] ?? null) : undefined);
      const weightNow = same('weight') === undefined ? undefined : LS.weightId(same('weight'));
      const styleNow = same('style') === undefined ? undefined : LS.styleId(same('style'));
      const colorNow = same('color');
      const title = text => {
        const t = document.createElement('div');
        t.className = 'props-title';
        t.textContent = text;
        return t;
      };
      // WEIGHT: six chips, each with a stroke of its own thickness.
      box.append(title('WEIGHT'));
      const weights = document.createElement('div');
      weights.className = 'chip-row';
      LS.WEIGHTS.forEach(w => {
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'sel-chip';
        chip.dataset.lineWeight = String(w.id);
        chip.title = `${w.name} \u2014 ${w.px} px`;
        chip.setAttribute('aria-pressed', String(weightNow === w.id));
        chip.classList.toggle('lit', weightNow === w.id);
        const bar = document.createElement('span');
        bar.style.cssText = `display:inline-block;width:22px;height:${w.px}px;background:currentColor;vertical-align:middle;margin-right:5px;`;
        chip.append(bar, document.createTextNode(w.name));
        chip.addEventListener('click', () => { writeLineStyle(lines, { weight: w.id }); showSelectionProps(); });
        weights.append(chip);
      });
      box.append(weights);
      // STYLE: solid, dashed, dot dash, dotted.
      box.append(title('STYLE'));
      const styles = document.createElement('div');
      styles.className = 'chip-row';
      LS.STYLES.forEach(st => {
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'sel-chip';
        chip.dataset.lineStyle = st.id;
        chip.setAttribute('aria-pressed', String(styleNow === st.id));
        chip.classList.toggle('lit', styleNow === st.id);
        chip.textContent = st.name;
        chip.addEventListener('click', () => { writeLineStyle(lines, { style: st.id }); showSelectionProps(); });
        styles.append(chip);
      });
      box.append(styles);
      // COLOUR: the full spectrum, and SKIN to hand the line back to the
      // page's own ink.
      box.append(title('COLOUR'));
      const colours = document.createElement('div');
      colours.className = 'chip-row';
      const pick = document.createElement('input');
      pick.type = 'color';
      pick.dataset.lineColor = '';
      pick.value = colorNow || '#ff0000';
      pick.title = 'Line colour';
      // THE PICKER PREVIEWS AS IT DRAGS AND WRITES ONCE ON RELEASE: every
      // 'input' paints the colour live without an undo step, and 'change'
      // puts the lines back to where they were and writes the one change,
      // so a single UNDO takes the whole pick back.
      let preview = null;
      pick.addEventListener('input', () => {
        if (!preview) preview = lines.map(line => [line, line.color ?? null]);
        lines.forEach(line => { line.color = LS.colorHex(pick.value); });
        paint();
      });
      pick.addEventListener('change', () => {
        if (preview) { preview.forEach(([line, was]) => { if (was == null) delete line.color; else line.color = was; }); preview = null; }
        writeLineStyle(lines, { color: LS.colorHex(pick.value) });
        showSelectionProps();
      });
      colours.append(pick);
      const skinChip = document.createElement('button');
      skinChip.type = 'button';
      skinChip.className = 'sel-chip';
      skinChip.dataset.lineColorSkin = '';
      skinChip.setAttribute('aria-pressed', String(colorNow === null));
      skinChip.classList.toggle('lit', colorNow === null);
      skinChip.textContent = 'SKIN';
      skinChip.title = 'The page\'s own line ink';
      skinChip.addEventListener('click', () => { writeLineStyle(lines, { color: null }); showSelectionProps(); });
      colours.append(skinChip);
      box.append(colours);
    }
    const note = document.createElement('div');
    note.dataset.propNote = '';
    note.className = 'props-title';
    note.textContent = 'A LINE IS TWO POINTS. DRAG AN END TO CHANGE IT.';
    box.append(note);
    return box;
  };

  // ── A STAIR'S SHAPE, ITS TURN, AND ITS WINDERS ──────────────────────────
  //
  // Movie, 15 Oct: "you wanted U/L shapes and winders". The format and the
  // geometry have carried all three since the stair went in --
  // drawing-format.js validates `shape`, `turn` and `winders`, and
  // stairShapeSplit / stairPlanParts build the landing and the second leg from
  // them -- and MODEL.dc.html has the picker. THIS page had no way to say so:
  // it wrote `winders: 0` and whatever shape the suggester chose, and a
  // selected stair had no panel at all.
  //
  // ON THE SELECTED STAIR, not as the next placement's default. The live page
  // places through AUTO STAIR, so a "next stair" setting would be a control
  // over a flight the drafter cannot see yet; the shape he wants is the shape
  // of the one in front of him. (Width and rail are still the tool's defaults,
  // untouched here.)
  const STAIR_TURNS = [['right', 'TURN RIGHT'], ['left', 'TURN LEFT']];
  const stairPropsNode = stair => {
    const SG = window.DraftStairGeometry;
    const F = window.DraftFormatters;
    const box = document.createElement('div');
    const layout = SG.stairCurrentLayout(stair, stairLevels());

    // ── WHAT A SHAPE CHANGE COSTS THE WELL ────────────────────────────────
    //
    // Everything about an L or a U is derived from the record at paint time,
    // so the flight itself needs nothing but the word. THE HOLE DOES: it is a
    // stored ring, cut to the shape the stair had, and an L folds its second
    // leg out sideways from under it. stairOpeningFootprint already knows all
    // three shapes -- it is what cut the hole in the first place -- so the
    // well is RE-CUT here rather than left wrong or left to AUTO STAIR, which
    // never cuts a second hole for a stair that already has one.
    //
    // RE-CUT HERE, TRANSLATED BY THE DRAG, and the two are not in disagreement:
    // a drag keeps the hole's authored ring because a hole that merely moved
    // is still the right hole (its length comes from headroom and may have
    // been nudged), while a shape change invalidates the ring's own topology,
    // so there is nothing left to preserve. And it is still the DRAFTER
    // changing his own geometry -- Board #313 forbids the software doing it
    // unasked, which a hole re-cut on a press he just made is not.
    //
    // A SHARED WELL IS NOT RE-CUT, for the drag's reason: it is sized to two
    // flights and this is one of them. Said, not ignored.
    const write = patch => {
      const before = { ...stair };
      Object.assign(stair, patch);
      // THE FORMAT'S OWN RULE, applied here rather than discovered on the next
      // load: `winders: shape === 'L' ? ... : 0`. A U carrying 2 winders would
      // read back as a U with none, so the page would be showing a choice the
      // file does not hold.
      if (stair.shape !== 'L') stair.winders = 0;
      // Touched by hand, so no longer the suggester's placement -- the drag's
      // reason, and the same `auto` contract.
      stair.auto = false;
      const edits = [{ item: stair, before }];
      const said = [];
      const well = stairWellOf(stair);
      if (well.hole) {
        const points = stairOpeningFootprint(stair);
        if (points && points.length >= 3) {
          // THE OLD RING IS KEPT BY REFERENCE in `before` and a NEW array is
          // written, never the old one edited -- or the undo copy would hold
          // the points the edit produced.
          edits.push({ item: well.hole, before: { ...well.hole } });
          well.hole.points = points.map(pt => ({ x: pt.x, z: pt.z }));
          said.push('its well re-cut');
          if (wellOffItsFloor(well.hole)) said.push('and now running off its floor');
        } else {
          said.push('its well left as it was — no footprint could be cut for this shape');
        }
      } else if (well.shared) {
        said.push('the shared well left as it is — two flights climb through it');
      }
      // A FLIGHT TOO SHORT TO TURN STILL DRAWS STRAIGHT, and that is
      // stairShapeSplit's rule (`layout.treads < 3` returns null), not a
      // refusal invented here. The word is stored either way -- a stair that
      // gains rise later turns then -- so the sentence is the only place the
      // drafter can learn why the picture did not change.
      if (stair.shape !== 'straight' && layout.treads < 3) {
        said.push(`this flight has ${layout.treads} tread${layout.treads === 1 ? '' : 's'}`
          + ' — a turn needs 3, so it still draws straight');
      }
      undoStack.push({ kind: 'props', edits });
      markDirty();
      sayOnStrip(`STAIR ${stair.shape === 'straight' ? 'STRAIGHT'
        : `${stair.shape} turning ${stair.turn}`}`
        + `${stair.winders ? ` with ${stair.winders} winders` : ''}`
        + `${said.length ? ` · ${said.join(' · ')}` : ''}.`);
      showSelectionProps();
      paint();
    };

    const shapeRow = propRow('SHAPE',
      SG.STAIR_SHAPE_OPTIONS.map(option => [option.id, option.label]),
      stair.shape || 'straight',
      id => { if (id !== 'L') stairWindersOpen = false; write({ shape: id }); });
    // THE HIDDEN DOOR: double-click L to reveal the winder row (the old page's
    // own gesture). A single click on L still just makes it an L -- revealing
    // on the first click would advertise winders, which the whole arrangement
    // exists not to do.
    const lChip = shapeRow.querySelector('[data-prop-value="L"]');
    if (lChip) {
      lChip.title = 'L — two runs over a landing. Double-click for winders.';
      lChip.addEventListener('dblclick', () => {
        stairWindersOpen = true;
        if (stair.shape !== 'L') write({ shape: 'L' });
        else showSelectionProps();
      });
    }
    box.append(shapeRow);

    // THE TURN ONLY MEANS SOMETHING ONCE THERE IS ONE. A straight flight has
    // no handed version, so the row is not offered on one -- the old page's
    // `stairTurnVisible` rule.
    if ((stair.shape || 'straight') !== 'straight') {
      box.append(propRow('TURN', STAIR_TURNS, stair.turn === 'left' ? 'left' : 'right',
        id => write({ turn: id })));
    }
    // WINDERS ARE L-ONLY (the format's rule) and shown only once asked for --
    // or when the stair already has them, which is not a secret to keep from
    // the drafter who is looking at them.
    if ((stair.shape || 'straight') === 'L' && (stairWindersOpen || stair.winders > 0)) {
      box.append(propRow('WINDERS',
        SG.STAIR_WINDER_OPTIONS.map(count => [count, count === 0 ? 'FLAT' : `${count} WINDERS`]),
        SG.STAIR_WINDER_OPTIONS.includes(stair.winders) ? stair.winders : 0,
        count => write({ winders: count })));
    }

    // ITS WIDTH, ONE RISER MORE OR LESS, AND ITS RAIL (Movie, 25 Oct: "One
    // PROPERTIES i'd like added is WIDTH", "ADD or SUBTRACT stair tread",
    // inside the riser limits). Through editStair, so the well is cut again
    // and the framing laid again with them; the panel and OBJ / PROP redrawn.
    const redraw = () => { showSelectionProps(); renderObjProp(); };
    const width = document.createElement('div');
    width.dataset.propRow = 'width';
    const wName = document.createElement('div');
    wName.className = 'props-title';
    wName.textContent = 'WIDTH (IN)';
    const wInput = document.createElement('input');
    wInput.type = 'number';
    wInput.dataset.stairWidth = '';
    wInput.min = String(STAIR_MIN_WIDTH_IN);
    wInput.step = '1';
    wInput.value = String(Math.round((Number(stair.widthFt) || 3) * 12 * 8) / 8);
    wInput.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') wInput.blur(); });
    wInput.addEventListener('change', () => { setStairWidth(stair, wInput.value); redraw(); });
    width.append(wName, wInput);
    const risers = document.createElement('div');
    risers.dataset.propRow = 'risers';
    const rName = document.createElement('div');
    rName.className = 'props-title';
    rName.textContent = 'RISERS';
    const rRow = document.createElement('div');
    rRow.className = 'chip-row';
    const step = (face, by, key) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'sel-chip';
      btn.textContent = face;
      btn.dataset.stairRisers = key;
      btn.addEventListener('click', () => { stepStairRisers(stair, by); redraw(); });
      return btn;
    };
    const count = document.createElement('span');
    count.dataset.stairRisersSaid = '';
    count.textContent = `${layout.risers} @ ${F.formatInchesOnly(layout.riserIn)} \u00b7 RUN ${F.formatArchitecturalInches(layout.runFt * 12)}`;
    rRow.append(step('\u2212', -1, 'less'), count, step('+', 1, 'more'));
    risers.append(rName, rRow);
    box.append(width, risers, propRow('RAIL', [['left', 'LEFT'], ['right', 'RIGHT'], ['both', 'BOTH'], ['none', 'NONE']],
      stair.rail || 'left', id => { editStair(stair, st => { st.rail = id; return null; }); redraw(); }));

    // THE FLIGHT AS IT IS, in the painter's own words (drawStairs2D writes
    // `DN — {risers}R @ {riser}`), so the panel and the plan cannot disagree.
    // SHORT, and the length is load-bearing -- see the BEAM panel's note.
    const note = document.createElement('div');
    note.className = 'props-title';
    note.dataset.stairLayout = '';
    note.textContent = `${layout.risers}R @ ${F.formatInchesOnly(layout.riserIn)}`
      + ` · ${layout.treads} TREADS · ${Math.round((stair.widthFt || 3) * 12)}" WIDE`;
    box.append(note);
    return box;
  };

  // ── PROPERTIES BELONG TO WHAT IS SELECTED ─────────────────────────────────
  //
  // Movie, 19 Sep: "There should be a PROPERTIES box with in this case WALL
  // PROPERTIES, but there should also a PROPERTIES for ROOF, FLOOR, FENST,
  // LINE, etc (all objects)". This table is where the rest land.
  //
  // ONE ROUTER, SO THE BOX CANNOT DESCRIBE SOMETHING THAT IS NOT SELECTED.
  // showStructureProps was a watcher that returned early when the selection
  // was not a column or a beam AND LEFT THE OLD PANEL STANDING: place a
  // column, then press a wall, and COLUMN properties sat there with the
  // column long since deselected -- a panel whose edits went to a thing the
  // drafter could not see selected. Returning early is exactly how a panel
  // and its subject come apart, so no builder is allowed to decide for
  // itself whether to leave the box alone.
  // ── A SELECTED ROOF: ITS EDGES, THEIR OVERHANGS, ITS PITCH ─────────────
  //
  // Movie, 18 Oct, on North Point: "main roof overhang at 8ft except at the
  // front jog out, the side overhangs are only 2ft and at the left edge its
  // no overhang, diag edge 2-5.5"". One number for the whole roof cannot say
  // that, so a roof that is selected shows its EDGES: click one of them (or
  // step with the arrows) and the panel shows that edge's kind and overhang.
  //
  // EVERY OVERHANG IS WORKED FROM THE WALL LINE, NOT THE EAVE. The record's
  // `footprint` keeps the line the eaves hang from; an older roof gets one
  // worked back from its eave and its overhangs the first time an edge is
  // typed. Offsetting the EAVE instead goes wrong exactly where Movie needs
  // it: the jog-out's front brought onto the main eave line leaves the jog's
  // two sides with no length, and an edge of no length has no direction to be
  // pushed back out along.
  //
  // AND A ROOF SHAPED BY HAND STOPS FOLLOWING THE PROJECT PAGE (`follows:
  // 'none'`): a changed overhang there would otherwise put 8' back on the
  // edge he just made flush.
  let roofEdgeIdx = null;
  // WHERE ON THE EDGE it was clicked, for a CROSS GABLE put there. Null when
  // the edge was reached by the arrows: the gable then goes at its middle.
  let roofEdgeClick = null;
  const roofEdgeNear = (roof, worldPt) => {
    const G = window.DraftGeometry2D;
    const pts = roof?.points || [];
    let best = null, bestD = SELECT_GRAB_PX / view.scale;
    pts.forEach((pt, index) => {
      const next = pts[(index + 1) % pts.length];
      if (Math.hypot(next.x - pt.x, next.z - pt.z) < 1e-6) return;
      const { d } = G.pointToSegment(worldPt, { start: pt, end: next });
      if (d < bestD) { bestD = d; best = index; }
    });
    return best;
  };
  const roofOverhangs = roof => {
    const per = Array.isArray(roof.edgeOverhang) && roof.edgeOverhang.length === roof.points.length;
    const fallback = Number(roof.overhang) || 0;
    return roof.points.map((_, i) => {
      const v = per ? Number(roof.edgeOverhang[i]) : NaN;
      return Number.isFinite(v) ? v : fallback;
    });
  };
  const ringArea = ring => ring.reduce((sum, pt, i) => {
    const next = ring[(i + 1) % ring.length];
    return sum + (pt.x * next.z - next.x * pt.z);
  }, 0) / 2;
  // The kept wall line if it still hangs the eave where the eave is (some
  // other edit may have moved the roof since), else one worked back from the
  // eave -- which needs every edge to still have a length.
  const roofFootprint = roof => {
    const G = window.DraftGeometry2D;
    const pts = roof.points.map(pt => ({ x: pt.x, z: pt.z }));
    const was = roofOverhangs(roof);
    const kept = Array.isArray(roof.footprint) && roof.footprint.length === pts.length
      ? roof.footprint.map(pt => ({ x: pt.x, z: pt.z })) : null;
    if (kept) {
      const hung = G.offsetOutlineVariable(kept, was);
      if (hung.every((pt, i) => Math.hypot(pt.x - pts[i].x, pt.z - pts[i].z) < 0.01)) return kept;
    }
    if (pts.some((pt, i) => {
      const next = pts[(i + 1) % pts.length];
      return Math.hypot(next.x - pt.x, next.z - pt.z) < 1e-6;
    })) return null;
    return G.offsetOutlineVariable(pts, was.map(v => -v));
  };
  const setRoofOverhangs = (roof, want) => {
    const G = window.DraftGeometry2D;
    const max = window.DraftDrawingFormat.ROOF_OVERHANG_MAX_FT;
    if (want.some(v => !(v >= 0) || v > max)) {
      return `A roof overhang runs from 0 to ${max}'.`;
    }
    const footprint = roofFootprint(roof);
    if (!footprint) return 'This roof has an edge of no length, so the wall line under it cannot be found.';
    const eave = G.offsetOutlineVariable(footprint, want);
    if (eave.some(pt => !Number.isFinite(pt.x) || !Number.isFinite(pt.z))
      || Math.sign(ringArea(eave)) !== Math.sign(ringArea(footprint))) {
      return 'That overhang folds the roof over itself.';
    }
    roof.footprint = footprint.map(pt => ({ x: pt.x, y: 0, z: pt.z }));
    roof.points = eave.map((pt, i) => ({ ...roof.points[i], x: pt.x, z: pt.z }));
    roof.edgeOverhang = want.slice();
    roof.follows = 'none';
    return null;
  };
  // ONE UNDO PER EDIT, however many roofs it touched, and nothing at all if
  // any one of them refuses -- a half-applied edit across an assembly would
  // leave the drafter guessing which roofs took it.
  const editRoofs = (list, change) => {
    const edits = list.map(item => ({ item, before: { ...item } }));
    const refusal = list.map(change).find(Boolean);
    if (refusal) {
      edits.forEach(({ item, before }) => {
        Object.keys(item).forEach(key => { if (!(key in before)) delete item[key]; });
        Object.assign(item, before);
      });
      return refusal;
    }
    undoStack.push({ kind: 'props', edits });
    markDirty();
    paint();
    return null;
  };
  // ── GABLE END: THE END SQUARED ACROSS AND MADE A GABLE ────────────────
  //
  // Movie, 18 Oct: "change bother hips to GABLE on the left end of the plan".
  // His left end is not one edge: the end wall, the 45° chamfer at its corner
  // and the hips over both. The roof PDF runs the gable square across that
  // whole end, so this does too: from the picked edge it walks each way to
  // the first edge running ACROSS it -- the two long eaves -- and puts one
  // straight GABLE between them where the end reaches furthest out. Whatever
  // stood between (the chamfer, a short return) is swallowed by the roof.
  //
  // DONE ON THE WALL LINE, then hung again by the overhangs, so the gable's
  // own overhang is the picked edge's and every eave keeps its own.
  const squareEnd = (ring, index) => {
    const n = ring.length;
    const dir = k => {
      const a = ring[k % n], b = ring[(k + 1) % n];
      const len = Math.hypot(b.x - a.x, b.z - a.z);
      return len < 1e-9 ? null : { x: (b.x - a.x) / len, z: (b.z - a.z) / len };
    };
    const d = dir(index);
    if (!d) return null;
    const across = k => { const e = dir(k); return e && Math.abs(e.x * d.x + e.z * d.z) < Math.sin(5 * Math.PI / 180); };
    let l = null, r = null;
    for (let step = 1; step < n; step += 1) {
      if (l == null && across((index - step + n) % n)) l = (index - step + n) % n;
      if (r == null && across((index + step) % n)) r = (index + step) % n;
    }
    if (l == null || r == null || l === r) return null;
    // Rotated so the eave BEFORE the end is edge 0 and the one after is `rr`.
    const rot = ring.map((_, k) => ring[(k + l) % n]);
    const rr = (r - l + n) % n;
    if (rr < 2) return null;
    // OUTWARD, across the picked edge: the normal that points away from the
    // middle of the ring.
    const mid = ring.reduce((m, pt) => ({ x: m.x + pt.x / n, z: m.z + pt.z / n }), { x: 0, z: 0 });
    const a0 = ring[index];
    let out = { x: d.z, z: -d.x };
    if ((a0.x - mid.x) * out.x + (a0.z - mid.z) * out.z < 0) out = { x: -out.x, z: -out.z };
    const reach = Math.max(...rot.slice(1, rr + 1).map(pt => pt.x * out.x + pt.z * out.z));
    const onEnd = (a, b) => {
      // Where the line a->b meets the end line {p : p.out = reach}.
      const da = a.x * out.x + a.z * out.z, db = b.x * out.x + b.z * out.z;
      if (Math.abs(db - da) < 1e-12) return null;
      const t = (reach - da) / (db - da);
      return { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t };
    };
    const A = onEnd(rot[0], rot[1]);
    const B = onEnd(rot[rr], rot[(rr + 1) % n]);
    if (!A || !B) return null;
    return { rot: l, rr, ring: [rot[0], A, B, ...rot.slice(rr + 1)] };
  };
  const gableEnd = (roof, index) => {
    const G = window.DraftGeometry2D;
    const n = roof.points.length;
    const footprint = roofFootprint(roof);
    if (!footprint) return 'This roof has an edge of no length, so the wall line under it cannot be found.';
    const done = squareEnd(footprint, index);
    if (!done) return 'GABLE END needs an eave running across each side of the end.';
    const keep = arr => { const rot = arr.map((_, k) => arr[(k + done.rot) % n]); return [rot[0], null, ...rot.slice(done.rr)]; };
    const overs = roofOverhangs(roof);
    const kinds = roof.points.map((_, k) => (roof.edges?.[k] === 'gable' ? 'gable' : 'eave'));
    const nextOvers = keep(overs); nextOvers[1] = overs[index];
    const nextKinds = keep(kinds); nextKinds[1] = 'gable';
    const eave = G.offsetOutlineVariable(done.ring, nextOvers);
    if (eave.some(pt => !Number.isFinite(pt.x) || !Number.isFinite(pt.z))
      || Math.sign(ringArea(eave)) !== Math.sign(ringArea(done.ring))) {
      return 'That end folds the roof over itself.';
    }
    const y = roof.points[0]?.y ?? 0;
    roof.footprint = done.ring.map(pt => ({ x: pt.x, y: 0, z: pt.z }));
    roof.points = eave.map(pt => ({ x: pt.x, y, z: pt.z }));
    roof.edges = nextKinds;
    roof.edgeOverhang = nextOvers;
    roof.follows = 'none';
    roofEdgeIdx = 1;
    return null;
  };
  let crossGableWidthFt = 40;
  let crossGablePitch = 4;
  // ── DORMER, THE BUILD TOOL (Movie, 18 Oct) ──────────────────────────────
  //
  // "can we make a DORMER command in the BUILD tab?" -- "we will start with
  // the full dormer with only front wall like on the NORTH POINT roof plan".
  // That dormer IS the cross gable above: a full gable down to the valleys,
  // its front wall on the outside wall line, roof cavity behind it. So the
  // tool is a way in to the same record -- DORMER armed, a click on an eave
  // puts one there at the panel's width and pitch, as many as he likes.
  //
  // THE TYPE ROW HAS ONE CHIP FOR NOW: "i will need to refine it because
  // there are different dormer looks and ways to build". Each new look is a
  // chip here and a shape in geometry-2d.
  const DORMER_TYPES = [['full-gable', 'FULL GABLE — FRONT WALL ONLY']];
  let dormerType = 'full-gable';
  let dormerPanelUp = false;
  const dormerSaid = () => `DORMER ${window.DraftFormatters.formatArchitecturalInches(crossGableWidthFt * 12)} wide at ${crossGablePitch}/12. UNDO takes it off.`;
  const showDormerProps = () => {
    const P = window.ModelProps;
    if (!P) return;
    const box = document.createElement('div');
    const types = document.createElement('div');
    types.className = 'chip-row';
    types.dataset.dormerTypes = '';
    DORMER_TYPES.forEach(([id, label]) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'sel-chip';
      btn.dataset.dormerType = id;
      btn.textContent = label;
      btn.setAttribute('aria-pressed', String(dormerType === id));
      btn.addEventListener('click', () => { dormerType = id; showDormerProps(); });
      types.append(btn);
    });
    box.append(types);
    box.append(propField('DORMER WIDTH', crossGableWidthFt, ft => {
      if (!(ft > 0)) return 'A dormer needs a width.';
      crossGableWidthFt = ft;
      return null;
    }, showDormerProps));
    box.append(numberField('DORMER PITCH', crossGablePitch, 1, 24, 0.5, v => {
      if (v !== null) crossGablePitch = v;
      return crossGablePitch;
    }));
    const note = document.createElement('div');
    note.className = 'props-title';
    note.dataset.dormerNote = '';
    note.textContent = 'CLICK AN EAVE OF THE ROOF WHERE THE DORMER GOES. ITS FRONT WALL STANDS ON THE WALL LINE BELOW.';
    box.append(note);
    P.set('DORMER', box);
    dormerPanelUp = true;
  };
  // THE EAVE NEAREST THE PRESS, on any roof this sheet paints (ROOF, or the
  // ROOF level's from SITE). A gable edge has no eave to stand a dormer on.
  const dormerPress = at => {
    let hit = null;
    pickRoofs().forEach(roof => {
      if (hit) return;
      const index = roofEdgeNear(roof, at);
      if (index != null) hit = { roof, index };
    });
    if (!hit) { sayOnStrip('DORMER — click ON an eave of the roof.'); return; }
    if (hit.roof.edges?.[hit.index] === 'gable') { sayOnStrip('DORMER — that edge is a GABLE; a dormer stands on an EAVE.'); return; }
    const refusal = editRoofs([hit.roof], roof => addCrossGable(roof, hit.index, at));
    sayOnStrip(refusal ? `DORMER — ${refusal}` : dormerSaid());
  };
  const addCrossGable = (roof, index, click) => {
    const G = window.DraftGeometry2D;
    const wall = G.roofWallLine(roof);
    if (!wall) return 'This roof has an edge of no length, so the wall line under it cannot be found.';
    const a = wall.ring[index], b = wall.ring[(index + 1) % wall.ring.length];
    const ex = b.x - a.x, ez = b.z - a.z, len2 = ex * ex + ez * ez;
    if (len2 < 1e-9) return 'That edge has no length.';
    const t = click ? Math.max(0, Math.min(1, ((click.x - a.x) * ex + (click.z - a.z) * ez) / len2)) : 0.5;
    const len = Math.sqrt(len2);
    if (crossGableWidthFt > len + 1e-6) return 'That dormer is wider than the wall under this edge.';
    // Kept on its wall: a width that would run off the end slides it back.
    const halfT = crossGableWidthFt / 2 / len;
    const tc = Math.max(halfT, Math.min(1 - halfT, t));
    roof.crossGables = [...(roof.crossGables || []), {
      at: { x: a.x + ex * tc, z: a.z + ez * tc }, widthFt: crossGableWidthFt, pitch: crossGablePitch }];
    roof.follows = 'none';
    return null;
  };
  // SLOPED (Movie, 18 Oct): the planes either side kept, cut off along this
  // edge (geometry-2d slopedVirtual) -- what a corner node DELETEd leaves.
  const ROOF_EDGE_KINDS = [['eave', 'EAVE'], ['gable', 'GABLE'], ['sloped', 'SLOPED']];
  const roofEdgeKind = k => (k === 'gable' || k === 'sloped' ? k : 'eave');
  // A ROOF IN AN ASSEMBLY WITH OTHER ROOFS (Movie, 18 Oct): "ASSEMBLY roof
  // peices that are similar so i can adjust the EAVE and PITCH for the
  // grouped roofs seperately but be able to edit the properties of all as one
  // within the ASSEMBLY". So PITCH and OVERHANG, ALL EDGES reach every roof
  // in its assembly -- unless THIS ROOF is chosen; an edge is always this
  // roof's own.
  let roofScopeOne = false;
  const roofPropsNode = picked => {
    const box = document.createElement('div');
    const again = () => { if (selection.every(e => e.type === 'roof')) showSelectionProps(); };
    const lone = picked.length === 1 ? picked[0] : null;
    const owner = lone ? groupOf({ type: 'roof', item: lone }) : null;
    const kin = owner ? itemsOfGroup(owner).filter(e => e.type === 'roof').map(e => e.item) : [];
    if (kin.length > 1) {
      box.append(propRow('APPLY TO', [['assembly', `${owner.name} (${kin.length} ROOFS)`], ['one', 'THIS ROOF']],
        roofScopeOne ? 'one' : 'assembly', id => { roofScopeOne = id === 'one'; again(); }));
    }
    const items = kin.length > 1 && !roofScopeOne ? kin : picked;
    box.append(numberField('PITCH', lone ? lone.pitch : items[0].pitch, 0, 24, 0.5, v => {
      if (v !== null) {
        const refusal = editRoofs(items, roof => { roof.pitch = v; roof.follows = 'none'; return null; });
        if (refusal) sayOnStrip(refusal);
      }
      again();
      return items[0].pitch;
    }));
    // EVERY EDGE AT ONCE, which is where a drafter starts -- 8' all round --
    // before picking out the edges that differ.
    const all = items.flatMap(roofOverhangs);
    const agree = all.every(v => Math.abs(v - all[0]) < 1e-9);
    box.append(propField('OVERHANG, ALL EDGES', agree ? all[0] : null,
      ft => editRoofs(items, roof => setRoofOverhangs(roof, roof.points.map(() => ft))), again));
    if (lone) {
      const count = lone.points.length;
      if (roofEdgeIdx != null && roofEdgeIdx >= count) roofEdgeIdx = null;
      const head = document.createElement('div');
      head.className = 'chip-row';
      head.dataset.roofEdgeHead = '';
      const step = by => {
        roofEdgeIdx = roofEdgeIdx == null ? (by > 0 ? 0 : count - 1) : (roofEdgeIdx + by + count) % count;
        roofEdgeClick = null;
        again();
        paint();
      };
      const arrow = (face, by, key) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'sel-chip';
        btn.dataset.roofEdgeStep = key;
        btn.textContent = face;
        btn.addEventListener('click', () => step(by));
        return btn;
      };
      const label = document.createElement('span');
      label.className = 'props-title';
      label.dataset.roofEdgeLabel = '';
      label.textContent = roofEdgeIdx == null ? 'CLICK AN EDGE OF THE ROOF'
        : `EDGE ${roofEdgeIdx + 1} OF ${count}`;
      head.append(arrow('◀', -1, 'prev'), label, arrow('▶', 1, 'next'));
      box.append(head);
      if (roofEdgeIdx != null) {
        const index = roofEdgeIdx;
        const kind = roofEdgeKind(lone.edges?.[index]);
        box.append(propRow('EDGE', ROOF_EDGE_KINDS, kind, id => {
          if (id === kind) return;
          editRoofs([lone], roof => {
            roof.edges = roof.points.map((_, i) => (i === index ? id
              : roofEdgeKind(roof.edges?.[i])));
            roof.follows = 'none';
            return null;
          });
          again();
        }));
        box.append(propField('OVERHANG, THIS EDGE', roofOverhangs(lone)[index],
          ft => editRoofs([lone], roof => setRoofOverhangs(roof,
            roofOverhangs(roof).map((v, i) => (i === index ? ft : v)))), again));
        const end = document.createElement('button');
        end.type = 'button';
        end.className = 'sel-chip';
        end.dataset.roofGableEnd = '';
        end.textContent = 'GABLE END';
        end.title = 'Square this end of the roof across and make it a gable';
        end.addEventListener('click', () => {
          const refusal = editRoofs([lone], roof => gableEnd(roof, index));
          if (refusal) sayOnStrip(refusal);
          again();
        });
        box.append(end);
        // CROSS GABLE on an EAVE (Movie, 18 Oct): "its a full gable that
        // extend down to meet the roof in the valley ... only a front wall
        // that is aligned with the ext perimter wall below". Centred where
        // the edge was clicked, on the wall line under it.
        if (kind === 'eave') {
          box.append(propField('DORMER WIDTH', crossGableWidthFt, ft => {
            if (!(ft > 0)) return 'A dormer needs a width.';
            crossGableWidthFt = ft;
            return null;
          }, again));
          box.append(numberField('DORMER PITCH', crossGablePitch, 1, 24, 0.5, v => {
            if (v !== null) crossGablePitch = v;
            return crossGablePitch;
          }));
          const add = document.createElement('button');
          add.type = 'button';
          add.className = 'sel-chip';
          add.dataset.roofCrossGable = '';
          add.textContent = 'ADD DORMER';
          add.addEventListener('click', () => {
            const refusal = editRoofs([lone], roof => addCrossGable(roof, index, roofEdgeClick));
            if (refusal) sayOnStrip(refusal);
            else sayOnStrip(dormerSaid());
            again();
          });
          box.append(add);
        }
      }
      // THE ROOF'S CROSS GABLES, each with REMOVE.
      (lone.crossGables || []).forEach((gable, gi) => {
        const row = document.createElement('div');
        row.className = 'chip-row';
        row.dataset.roofCrossGableRow = String(gi);
        const word = document.createElement('span');
        word.className = 'props-title';
        word.textContent = `DORMER ${gi + 1}: ${window.DraftFormatters.formatArchitecturalInches(gable.widthFt * 12)} @ ${gable.pitch}/12`;
        const gone = document.createElement('button');
        gone.type = 'button';
        gone.className = 'sel-chip';
        gone.dataset.roofCrossGableRemove = String(gi);
        gone.textContent = 'REMOVE';
        gone.addEventListener('click', () => {
          editRoofs([lone], roof => {
            roof.crossGables = (roof.crossGables || []).filter((_, k) => k !== gi);
            if (!roof.crossGables.length) delete roof.crossGables;
            return null;
          });
          again();
        });
        row.append(word, gone);
        box.append(row);
      });
    }
    return box;
  };

  // ── FIXTURE PROPERTIES (Movie, 20 Oct) ────────────────────────────────
  //
  // "click on the island and change the dimensions size". WIDTH and DEPTH
  // for any fixture in hand, and AISLE -- the clear run from the wall's
  // face -- for an island, typed like every other box; one UNDO per change.
  // An island narrowed pulls its pieces back inside its ends; its aisle
  // retyped takes them with it.
  const fixturePanelTitle = items => (items.every(f => f.kind === 'island') ? 'ISLAND'
    : items.every(f => f.kind === items[0].kind) ? fixtureLabel(items[0]) : 'FIXTURE');
  const commitFixtureEdits = pairs => {
    const edits = pairs.map(({ item }) => ({ item, before: { ...item } }));
    pairs.forEach(({ item, patch }) => Object.entries(patch).forEach(([key, value]) => {
      if (value == null) delete item[key]; else item[key] = value;
    }));
    undoStack.push({ kind: 'props', edits });
    markDirty();
    showSelectionProps();
    renderObjProp();
    paint();
  };
  const islandPiecePatches = (island, offset, width) => {
    const FG = window.DraftFixtureGeometry;
    const lo = offset - width / 2, hi = offset + width / 2;
    return FG.islandPieces(fixtures(), island).map(item => {
      const half = (Number(item.width) || 0) / 2;
      if (hi - lo < half * 2) return null;
      const at = Math.min(Math.max(Number(item.offset) || 0, lo + half), hi - half);
      return at === item.offset ? null : { item, patch: { offset: at } };
    }).filter(Boolean);
  };
  const fixturePropsNode = items => {
    const FG = window.DraftFixtureGeometry;
    const box = document.createElement('div');
    const hostLen = f => {
      if (f.wallId == null) return Infinity;
      const host = walls().find(w => String(w.id) === String(f.wallId));
      const frame = host && FG?.wallFrame(host);
      return frame ? frame.len : Infinity;
    };
    const field = (label, read, commit) =>
      propField(label, agreedOn(items, read), commit, showSelectionProps, { inches: true });
    box.append(field('WIDTH', f => Number(f.width) || 0, feet => {
      if (!(feet > 0)) return 'A fixture needs a width greater than zero.';
      if (items.some(f => feet > hostLen(f) - 0.02)) return `${sizeText(feet)} is longer than the wall it rides.`;
      commitFixtureEdits(items.flatMap(f => [{ item: f, patch: { width: feet } },
        ...(f.kind === 'island' ? islandPiecePatches(f, Number(f.offset) || 0, feet) : [])]));
      return null;
    }));
    box.append(field('DEPTH', f => Number(f.depth) || 0, feet => {
      if (!(feet > 0)) return 'A fixture needs a depth greater than zero.';
      commitFixtureEdits(items.map(f => ({ item: f, patch: { depth: feet } })));
      return null;
    }));
    // A SINK BASE'S BOWLS (Movie, 24 Oct: "add double sink right bowl
    // option"): one bowl, two equal, or two with the bigger, 60/40, on the
    // right. The equal double is what a sink base always was.
    const R2 = window.DraftRender2D;
    if (R2 && items.every(f => f.kind === 'sinkbase' || f.kind === 'sink')) {
      box.append(propSelect('BOWLS', [['double', 'DOUBLE'], ['single', 'SINGLE'], ['right', 'DOUBLE, BIG RIGHT 60/40']],
        agreedOn(items, f => R2.sinkBowlsOf(f)), id => {
          commitFixtureEdits(items.map(f => ({ item: f, patch: { bowls: id } })));
        }));
    }
    // UPPERS ON OR OFF over each lower piece, as wide as it (Movie, 24 Oct:
    // "allow the lower cabinets to turn on or off upper cabinet that would
    // match the width. oh ya also above the fridge too"). ON until turned off.
    const KU = window.DraftFixtureKinds;
    if (KU?.takesUppers && items.every(f => KU.takesUppers(f))) {
      box.append(propSelect('UPPERS', [['on', 'ON'], ['off', 'OFF']],
        agreedOn(items, f => (f.uppers === false ? 'off' : 'on')), id => {
          commitFixtureEdits(items.map(f => ({ item: f, patch: { uppers: id === 'off' ? false : null } })));
        }));
    }
    if (items.every(f => f.kind === 'island')) {
      box.append(field('AISLE', f => Number(f.standoff) || 0, feet => {
        if (!(feet >= 0)) return 'The aisle is the clear run from the wall: zero or more.';
        const standoff = feet > 0 ? feet : null;
        commitFixtureEdits(items.flatMap(f => [{ item: f, patch: { standoff } },
          ...FG.islandPieces(fixtures(), f).map(item => ({ item, patch: { standoff } }))]));
        return null;
      }));
    }
    return box;
  };
  const SELECTION_PANELS = {
    roomtag: items => (items.length === 1
      ? { title: 'ROOM TAG', node: roomTagPropsNode(items[0]) } : null),
    shape: items => (items.length === 1
      ? { title: 'SHAPE', node: shapePropsNode(items[0]) } : null),
    wall: items => ({ title: 'WALL', node: wallPropsNode(items) }),
    fenestration: items => ({ title: 'OPENING', node: openingPropsNode(items) }),
    // A FIXTURE'S SIZE, and an island's aisle (Movie, 20 Oct).
    fixture: items => ({ title: fixturePanelTitle(items), node: fixturePropsNode(items) }),
    floor: items => ({ title: 'FLOOR', node: floorPropsNode(items) }),
    line: items => ({ title: 'LINE', node: linePropsNode(items) }),
    // ONE AT A TIME. The shape of two flights at once is two questions --
    // which way each turns is about where each one sits -- and the pick chain
    // offers a stair singly anyway; a window-select of several is the only way
    // to hold two, and it is not a gesture that asks for this panel.
    stair: items => (items.length === 1
      ? { title: 'STAIR', node: stairPropsNode(items[0]) } : null),
    // ROOF IS HERE NOW: hitAt reaches roofs, and North Point's eaves need
    // an overhang per edge (Movie, 18 Oct). The roof TOOL's box is still
    // about the NEXT roof; this one is about the roofs in hand.
    roof: items => ({ title: 'ROOF', node: roofPropsNode(items) }),
    //
    // OUTLINE IS NOT HERE: it is a guide, and what a drafter changes
    // about one is its corners, which is a drag.
    column: items => (items.length === 1
      ? { title: 'COLUMN', node: columnPropsNode(items[0]) } : null),
    // A BEAM IS A ROW: AUTO BEAM lays one in pieces post to post, and a
    // click takes the whole row, so the panel answers for all of it.
    beam: items => (items.length ? { title: 'BEAM', node: beamPropsNode(items) } : null),
  };

  let selectionPanelUp = false;
  const showSelectionProps = () => {
    const P = window.ModelProps;
    if (!P) return;
    const kinds = [...new Set(selection.map(entry => entry.type))];
    const build = kinds.length === 1 ? SELECTION_PANELS[kinds[0]] : null;
    const panel = build ? build(selection.map(entry => entry.item)) : null;
    if (panel) {
      P.set(panel.title, panel.node);
      selectionPanelUp = true;
      return;
    }
    // MIXED SAYS SO. An empty box beside a selection of six things reads as
    // "this page has no properties for these", which is not what is true:
    // they are properties of different kinds and there is no one panel for
    // them. The sentence costs a line and answers the question the blank
    // would raise.
    if (kinds.length > 1) {
      const note = document.createElement('div');
      note.dataset.propsMixed = '';
      note.textContent = `${selection.length} THINGS OF ${kinds.length} KINDS. `
        + 'PROPERTIES SHOW WHEN THEY ARE ALL ONE KIND.';
      P.set('SELECTION', note);
      selectionPanelUp = true;
      return;
    }
    if (!selectionPanelUp) return;
    // THE PANEL COMES DOWN WITH ITS SUBJECT, and the box goes back to the
    // ARMED TOOL rather than simply empty -- a drafter who was setting a
    // roof's overhang, pressed a wall and pressed the sheet should find the
    // overhang where he left it.
    selectionPanelUp = false;
    P.clear();
    showToolProps(activeTool);
  };
  selectionWatchers.push(showSelectionProps);

  // ── OBJ / PROP (Movie, 24 Oct) ────────────────────────────────────────
  //
  // "i'd like to be able to click on the FIXTURES / CABINETS and items like
  // that in a different window ... then open up the window with the top and
  // side views and properties to change down below" -- "call that tab OBJ /
  // PROP". The tab hangs under the top bar over the right rail and opens and
  // shuts the window; a click on a fixture opens it on that piece. TOP is
  // the sheet's own painter in the window's frame; FRONT, LEFT and RIGHT are
  // the traced faces (objprop-views.js); the piece's PROPERTIES go under
  // them, the same fields the left pane shows.
  const objTab = document.getElementById('objprop-tab');
  const objWin = document.getElementById('objprop');
  let objOpen = false;
  const objPieces = () => selection.filter(entry => entry.type === 'fixture').map(entry => entry.item);
  // AND A STAIR (Movie, 25 Oct: "so it a guy clicks on the STAIRCASE it will
  // allow him to see the OBJ/PROP window with the STAIR info"): its PLAN and
  // its SECTION in the two top boxes, the stair workspace's own panes, and
  // its PROPERTIES under them. The two lower boxes are not a stair's.
  const objStair = () => (selection.length === 1 && selection[0].type === 'stair' ? selection[0].item : null);
  const seatObjProp = () => {
    if (!objTab || !objWin) return;
    const rail = document.getElementById('right-rail');
    const box = rail && !rail.hidden ? rail.getBoundingClientRect() : null;
    const right = box && box.width ? Math.max(0, window.innerWidth - box.right) : 48;
    objTab.style.right = `${right + 8}px`;
    objWin.style.right = `${right}px`;
    objWin.style.top = `${objTab.getBoundingClientRect().bottom || 60}px`;
  };
  const drawObjViews = items => {
    const V = window.DraftObjViews, R = window.DraftRender2D, FG = window.DraftFixtureGeometry;
    const fx = items[0] || null;
    objWin.querySelectorAll('[data-objprop-view]').forEach(cv => {
      const view = cv.dataset.objpropView;
      const dpr = window.devicePixelRatio || 1;
      const w = cv.clientWidth || 140, h = cv.clientHeight || 110;
      cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
      const c = cv.getContext('2d');
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      c.clearRect(0, 0, w, h);
      if (!fx || !V || !R || !FG) return;
      const box = { x: 0, y: 0, w, h };
      if (view === 'top') {
        const env = fixturePaintEnv();
        const geo = env.fixtureGeometry(fx);
        if (!geo || !geo.frame) return;
        const { toS } = V.topFrame(geo, box);
        const wall = (drawing?.walls || []).find(wl => wl.id === fx.wallId);
        R.drawFixture2D(c, toS, fx, {}, wall, { ...env, meldCounters: false });
        if (env.hasUppers(fx) && R.drawUpperCabinets2D) R.drawUpperCabinets2D(c, toS, fx, wall, { ...env, meldCounters: false });
        return;
      }
      V.drawFace(c, V.faceOf(fx, view, window.DraftFixtureProfiles), box,
        { line: skin['draw-fixture'], ground: fixtureFill(), text: skin['ink-quiet'] || skin['draw-fixture'] });
    });
  };
  const drawObjStairViews = stair => {
    const S = window.DraftStairSection;
    objWin.querySelectorAll('[data-objprop-view]').forEach((cv, i) => {
      const dpr = window.devicePixelRatio || 1;
      const w = cv.clientWidth || 140, h = cv.clientHeight || 110;
      cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
      const c = cv.getContext('2d');
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      c.clearRect(0, 0, w, h);
      if (!S || i > 1) return;
      S.drawWorkspace(c, w, h, stair, { ...stairWorkspaceEnv(i === 0 ? 'plan' : 'section'), compact: true });
    });
  };
  const renderObjProp = () => {
    if (!objWin || !objOpen) return;
    const items = objPieces();
    const title = objWin.querySelector('[data-objprop-title]');
    const props = objWin.querySelector('[data-objprop-props]');
    const stair = items.length ? null : objStair();
    objWin.dataset.objpropKind = stair ? 'stair' : 'fixture';
    const caps = stair ? ['PLAN', 'SECTION'] : ['TOP', 'FRONT', 'LEFT', 'RIGHT'];
    objWin.querySelectorAll('figcaption').forEach((cap, i) => { if (caps[i]) cap.textContent = caps[i]; });
    if (stair) {
      const SG = window.DraftStairGeometry, F = window.DraftFormatters;
      const layout = SG.stairCurrentLayout(stair, stairLevels());
      title.textContent = `STAIR \u2014 ${layout.risers}R @ ${F.formatInchesOnly(layout.riserIn)} \u00b7 ${Math.round((Number(stair.widthFt) || 3) * 12)}" WIDE`;
      props.replaceChildren(stairPropsNode(stair));
      drawObjStairViews(stair);
      return;
    }
    title.textContent = items.length ? `${fixturePanelTitle(items)}${items.length > 1 ? ` \u00d7${items.length}` : ''}` : 'PICK A FIXTURE, CABINET OR STAIR';
    props.replaceChildren(...(items.length ? [fixturePropsNode(items)] : []));
    drawObjViews(items);
  };
  const setObjOpen = on => {
    if (!objTab || !objWin) return;
    objOpen = !!on;
    objWin.hidden = !objOpen;
    objTab.setAttribute('aria-expanded', String(objOpen));
    objTab.textContent = `OBJ / PROP ${objOpen ? '\u25B4' : '\u25BE'}`;
    seatObjProp();
    renderObjProp();
  };
  if (objTab) {
    objTab.hidden = false;
    objTab.textContent = 'OBJ / PROP \u25BE';
    objTab.addEventListener('click', () => setObjOpen(!objOpen));
    window.addEventListener('resize', seatObjProp);
    seatObjProp();
  }
  // A CLICK ON A FIXTURE OPENS IT; anything else leaves the window as it is,
  // saying what to pick.
  selectionWatchers.push(() => {
    if ((objPieces().length || objStair()) && !objOpen) { setObjOpen(true); return; }
    renderObjProp();
  });

  // ── THE ROOF PANEL ────────────────────────────────────────────────────────
  //
  // The second way into this slot. COLUMN and BEAM above fill it from the
  // SELECTION -- they are properties OF a placed thing. ROOF's overhang and
  // pitch are properties of the NEXT roof, so they hang off the armed tool
  // and have to exist before anything is placed.
  //
  // The four presets are the order's, and they are feet because the record is
  // (drawing-format.js clamps overhang to 0..ROOF_OVERHANG_MAX_FT, ten feet
  // since North Point's 8' eave). The free entry is
  // the same range; a value outside it is not silently clamped here, because
  // a box that swallows 9 and shows 6 teaches the drafter that 9 was taken.
  const ROOF_OVERHANGS = [['0.5', "6\""], ['1', "1'"], ['1.5', "1'-6\""], ['2', "2'"]];
  let roofPanelUp = false;

  // A PLAIN NUMBER, not a foot-and-inch length. The roof's overhang and
  // pitch use it, and so does a floor's slope -- a slope is a RATIO, and
  // putting "1/4" through the architectural parser would read it as a
  // quarter of a FOOT.
  //
  // IT KEEPS data-roof-field, which is now a small lie about its name and a
  // deliberate one: two specs drive the roof's pitch through that attribute,
  // and renaming it to buy a tidier word would be changing a hook that works
  // in order to fix a comment. The name is what moved.
  const numberField = (label, value, min, max, step, commit) => {
    const row = document.createElement('div');
    row.dataset.propRow = label.toLowerCase();
    const name = document.createElement('div');
    name.className = 'props-title';
    name.textContent = label;
    const input = document.createElement('input');
    input.type = 'number';
    input.className = 'roof-field';
    input.dataset.roofField = label.toLowerCase();
    input.min = String(min); input.max = String(max); input.step = String(step);
    input.value = String(value);
    const apply = () => {
      const raw = Number(input.value);
      // REFUSE, DO NOT ROUND. Number('') is 0 and a blank box would otherwise
      // read as a zero overhang -- a roof cut flush to the wall, which is a
      // drawing nobody asked for and no message would explain.
      if (!Number.isFinite(raw) || raw < min || raw > max) {
        input.value = String(commit(null));
        return;
      }
      input.value = String(commit(raw));
    };
    input.addEventListener('change', apply);
    row.append(name, input);
    return row;
  };

  const showRoofProps = () => {
    const P = window.ModelProps;
    if (!P) return;
    const box = document.createElement('div');

    box.append(propRow('OVERHANG', ROOF_OVERHANGS, String(roofOverhangFt), id => {
      roofOverhangFt = Number(id);
      showRoofProps();
    }));
    box.append(numberField('OVERHANG FT', roofOverhangFt, 0,
      window.DraftDrawingFormat.ROOF_OVERHANG_MAX_FT, 0.25, v => {
      if (v !== null) roofOverhangFt = v;
      showRoofProps();
      return roofOverhangFt;
    }));
    box.append(numberField('PITCH', roofPitch, 0, 24, 1, v => {
      if (v !== null) roofPitch = v;
      showRoofProps();
      return roofPitch;
    }));

    // READ, NOT SET. The heel is fascia + rise and the drafter cannot type it
    // here: it has no field in the roof record at all, so a typed one would
    // have nowhere to go.
    const heel = document.createElement('div');
    heel.className = 'props-title';
    heel.dataset.roofHeel = '';
    heel.textContent = `HEEL ${window.DraftFormatters.formatArchitecturalInches(roofHeelIn())}`
      + ` (FASCIA ${window.DraftFormatters.formatArchitecturalInches(ROOF_FASCIA_IN)})`;
    box.append(heel);

    const build = document.createElement('button');
    build.type = 'button';
    build.className = 'sel-chip';
    build.dataset.roofBuild = '';
    build.textContent = 'BUILD FROM FOOTPRINT';
    // DISABLED, NOT HIDDEN -- the same rule the tool keys follow. A button
    // that vanishes when the level has no outline teaches the drafter that
    // ROOF does nothing here; one that is greyed says what is missing.
    const source = roofSourceOutline();
    build.disabled = !source;
    build.title = source
      ? 'Cut a roof from this level’s outline, offset by the overhang.'
      : 'No outline on this level yet — draw one first.';
    build.addEventListener('click', () => {
      if (buildRoofFromFootprint()) showRoofProps();
    });
    box.append(build);

    P.set('ROOF', box);
    roofPanelUp = true;
  };

  // ── THE DIMENSION PANEL: AUTO DIMS ──────────────────────────────────────
  //
  // Movie, 19 Sep: "we will need to get the autodimensioning from the
  // model.dc.html too". The bone press dimensions what it builds; this is the
  // other half -- the drafter asking for strings around what is already on the
  // sheet, which is MODEL.dc.html's own AUTO DIMS button in the DIMENSION
  // panel (:1387).
  //
  // AND IT SAYS WHAT THE TOOL CANNOT DO YET. Arming DIMENSION on this page
  // draws nothing: the gesture is not built. A panel offering only AUTO DIMS,
  // with no word about the rest, would leave a drafter pressing the canvas and
  // concluding the page is broken -- so the note says which half is here.
  let dimensionPanelUp = false;

  const pressAutoDims = () => {
    if (!drawing) return;
    const levelId = activeLevelId();
    // A LEVEL WITH NO LAYER VIEWS -- the ROOF -- files its strings under
    // 'plan', which is where the build puts them. Filed under no view, a
    // press stacked a second set over the build's instead of replacing it
    // (Movie's roof plan, 11 Oct: old per-roof strings under the new rows).
    const view = activeViewId() || 'plan';
    // WHERE THE STRINGS GO IS WHERE THE DRAFTER IS STANDING, which is the old
    // page's rule too -- it dims the active level and its active layer view.
    const result = placeAutoDims(levelId, view);
    if (result === -1) {
      sayOnStrip('AUTO DIMS needs walls or an outline with some size on this '
        + 'level first.');
      return;
    }
    const { placed, removed } = result;
    // NOTHING PLACED IS NOT NOTHING DONE. A re-run over a level whose strings
    // were already there sweeps and re-lays them, so the step is pushed on the
    // strength of either list -- an undo that skipped because `placed` was
    // empty would strand a sweep with no way back.
    if (placed.length || removed.length) {
      undoStack.push({
        kind: 'built',
        walls: [],
        outlines: [],
        list: null,
        items: placed.map(item => ({ list: drawing.dimensions, item })),
        restored: removed.length
          ? [{ list: drawing.dimensions, items: removed }] : [],
      });
      markDirty();
    }
    // THE LEVEL IS NAMED, because the strings land on the level the drafter is
    // standing on and he may well be looking at another one -- and it is named
    // the way every other reader of a level names it, through levelLabel.
    const level = (drawing.levels || [])
      .find(entry => Number(entry.id) === levelId);
    sayOnStrip(`AUTO DIMS placed ${placed.length} dimensions on `
      + `${levelLabel(levelId, level && level.name)} — re-run after edits to `
      + 'refresh them.');
    buildChrome();
    paint();
  };

  const showDimensionProps = () => {
    const P = window.ModelProps;
    if (!P) return;
    const box = document.createElement('div');

    const row = document.createElement('div');
    row.className = 'chip-row';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'sel-chip';
    btn.dataset.autoDims = '';
    btn.textContent = 'AUTO DIMS';
    btn.addEventListener('click', pressAutoDims);
    row.append(btn);

    const note = document.createElement('div');
    note.className = 'props-title';
    note.dataset.dimensionNote = '';
    note.textContent = 'AUTO DIMS STRINGS THE ACTIVE LEVEL. BY HAND: CLICK POINTS, '
      + 'ENTER OR DOUBLE-CLICK ENDS THE STRING, THEN CLICK WHERE IT GOES.';

    // HORIZ / VERT / DIAG (Movie, 17 Oct: "D command ... VERT or HORIZ ...
    // DIAG"), the same three on the pop-up beside the sheet.
    const modes = document.createElement('div');
    modes.className = 'chip-row';
    modes.dataset.dimModes = '';
    DIM_MODES.forEach(([id, label]) => modes.append(dimModeButton(id, label)));

    box.append(modes, row, note);
    P.set('DIMENSION', box);
    dimensionPanelUp = true;
    syncDimModes();
  };

  // ── DIMENSIONS BY HAND (Movie, 17-18 Oct) ──────────────────────────────
  //
  // "i need to make the NORMAL style dimension ... D command ... VERT or
  // HORIZ ... DIAG" -- "aloow the user to make a line of dimensions and then
  // press enter or double click to end the string and the next click will
  // position the dimensions". Points are pressed one after another, snapped
  // the way a wall's are (a node, the cross lines, a corner); ENTER or a
  // double-click ends the string; the next press says how far off the points
  // the string stands. HORIZ measures across, VERT up and down, DIAG along
  // the first point to the last -- or along the locked ANGLE.
  //
  // THEY LOOK LIKE THE AUTO DIMS ("same as the autodims look"): the same
  // records, the same painter, on their own layer, A-DIMS-HAND, auto false --
  // so AUTO DIMS never sweeps them and the two switch apart.
  const DIM_MODES = [['h', 'HORIZ'], ['v', 'VERT'], ['d', 'DIAG']];
  const DIM_HAND_LAYER = 'A-DIMS-HAND';
  let dimMode = 'h';
  let dimPoints = [];
  let dimPlacing = false;
  const dimModeButton = (id, label) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'sel-chip';
    btn.dataset.dimMode = id;
    btn.textContent = label;
    btn.addEventListener('click', () => { dimMode = id; syncDimModes(); paint(); });
    return btn;
  };
  const syncDimModes = () => {
    document.querySelectorAll('[data-dim-mode]').forEach(btn => {
      btn.setAttribute('aria-pressed', String(btn.dataset.dimMode === dimMode));
      btn.classList.toggle('lit', btn.dataset.dimMode === dimMode);
    });
  };
  // THE POP-UP: the three modes over the sheet while the tool is up, so the
  // drafter need not go back to PROPERTIES between strings.
  let dimPop = null;
  const syncDimPop = () => {
    const up = activeTool === 'dimension' && !activeCut();
    if (up && !dimPop) {
      dimPop = document.createElement('div');
      dimPop.id = 'dim-pop';
      dimPop.dataset.dimPop = '';
      DIM_MODES.forEach(([id, label]) => dimPop.append(dimModeButton(id, label)));
      canvas.parentElement.append(dimPop);
    }
    if (dimPop) dimPop.hidden = !up;
    if (up) syncDimModes();
  };
  // A point as the string takes it: on a node, on a cross line, on a corner,
  // or where it was pressed. TOY has no SNAP or TRACK; its corners still take.
  // THE DOT IN THE MIDDLE OF A DOOR OR WINDOW IS A DIMENSION POINT (Movie,
  // 20 Oct: "can you make that round dot in the middle SNAPABLE point ORANGE
  // for the dimensions to link onto and if i move that can the dimension
  // move with it"). Its centre on the wall's centreline -- `offset` is the
  // centre's distance from the host wall's start -- and it beats every other
  // catch in its reach, because the drafter aimed at it.
  const openingCentre = opening => {
    const wall = opening && (drawing?.walls || []).find(w => String(w.id) === String(opening.wallId));
    if (!wall?.start || !wall?.end) return null;
    const len = Math.hypot(wall.end.x - wall.start.x, wall.end.z - wall.start.z);
    if (!(len > 1e-9) || !Number.isFinite(Number(opening.offset))) return null;
    const t = Number(opening.offset) / len;
    return { x: wall.start.x + (wall.end.x - wall.start.x) * t, z: wall.start.z + (wall.end.z - wall.start.z) * t };
  };
  const openingCentreAt = at => {
    if (!at) return null;
    const r = pullFt(NODE_PULL_PX);
    let best = null;
    openingsOn(walls()).forEach(({ opening }) => {
      const c = openingCentre(opening);
      const d = c && Math.hypot(c.x - at.x, c.z - at.z);
      if (c && d <= r && (!best || d < best.d)) best = { d, c, opening };
    });
    return best;
  };
  const dimPoint = at => {
    const ref = refPoint(at);
    if (ref) return { x: ref.x, z: ref.z };
    const dot = openingCentreAt(at);
    if (dot) return { x: dot.c.x, z: dot.c.z, ref: { openingId: String(dot.opening.id), x: dot.c.x, z: dot.c.z } };
    const snap = board !== 'toy' ? drawSnap(at) : {};
    const p = snap.pt || cornerSnap(at, []) || at;
    return { x: p.x, z: p.z, ...(snap.pt || cornerSnap(at, []) ? dimLinkAt(p) : {}) };
  };
  // ONE CLICK IN THE MIDDLE OF A WALL TAKES BOTH ITS FACES (Movie, 25 Oct:
  // "when the use DOUBLE CLICKS on a wall, the dimension will choose BOTH
  // sides of the wall and show the dimension between (usually 3 1/2" or
  // 5 1/2")" -- then "how about if the user clicks in the middle of a wall it
  // does that ... one click not 2"). Inside the wall's body and clear of both
  // faces by a few pixels; a node, a corner or an opening's dot near the
  // click still wins, and a click on a face is that face alone. The two
  // points stand straight across the wall from the click.
  const DIM_FACE_CLEAR_PX = 3;
  const dimWallFacesAt = at => {
    if (board === 'toy' || refPoint(at) || openingCentreAt(at) || cornerSnap(at, [])) return null;
    const TE = window.DraftTrimExtend;
    if (!TE) return null;
    const clear = DIM_FACE_CLEAR_PX / view.scale;
    const thick = openingThicknessFt();
    for (const w of walls()) {
      if (!w.start || !w.end) continue;
      const dx = w.end.x - w.start.x, dz = w.end.z - w.start.z;
      const len = Math.hypot(dx, dz);
      if (len < 1e-6) continue;
      const t = ((at.x - w.start.x) * dx + (at.z - w.start.z) * dz) / (len * len);
      if (t <= 0 || t >= 1) continue;
      const across = ((at.x - w.start.x) * -dz + (at.z - w.start.z) * dx) / len;
      const [lo, hi] = TE.faceOffsets(w, thick(w));
      if (!(across > lo + clear && across < hi - clear)) continue;
      const base = { x: w.start.x + dx * t, z: w.start.z + dz * t };
      const nx = -dz / len, nz = dx / len;
      // TIED TO THE WALL (Movie, 25 Oct: "when the WALL is selected in the
      // middle and both sides dimensioned can those dimensions 'STICK to the
      // wall"): both points remember the wall's start node, and followDimLinks
      // carries them along the string as that node moves -- a wall dragged
      // across takes its thickness dimension with it.
      const ref = { wallId: String(w.id), end: 'start', x: w.start.x, z: w.start.z };
      return { wall: w, thicknessFt: hi - lo,
        points: [{ x: base.x + nx * lo, z: base.z + nz * lo, ref: { ...ref } },
          { x: base.x + nx * hi, z: base.z + nz * hi, ref: { ...ref } }] };
    }
    return null;
  };
  // ── A HAND DIMENSION STAYS ON ITS NODE (Movie, 18 Oct: "i moved thenode
  // but the dim didn't follow the node it should be linked too") ──────────
  //
  // A point that landed on a node remembers the wall corner it is nearest
  // (the node itself, or a face corner of it): which wall, which end, and
  // where that corner stood. Each paint, a corner that has moved carries the
  // dimension's end with it ALONG the dimension's own run -- a HORIZ string
  // takes the corner's x and keeps its row, so a string never tilts. An UNDO
  // of the move puts the corner back and the end follows back.
  const DIM_LINK_FT = 1;
  const dimLinkAt = p => {
    let best = null;
    walls().forEach(w => ['start', 'end'].forEach(end => {
      const v = w[end];
      const d = Math.hypot(v.x - p.x, v.z - p.z);
      if (d <= DIM_LINK_FT && (!best || d < best.d)) best = { d, ref: { wallId: String(w.id), end, x: v.x, z: v.z } };
    }));
    return best ? { ref: best.ref } : {};
  };
  var followDimLinks = () => {
    const list = drawing?.dimensions;
    if (!Array.isArray(list) || !list.some(d => d.startRef || d.endRef)) return;
    const byId = new Map((drawing.walls || []).map(w => [String(w.id), w]));
    const fenById = new Map((drawing.fenestrations || []).map(f => [String(f.id), f]));
    // An end on an opening's dot reads the dot where the opening now is --
    // every paint, so it follows the door while the door is being slid.
    const refPoint = ref => (ref.openingId != null
      ? openingCentre(fenById.get(String(ref.openingId)))
      : byId.get(String(ref.wallId))?.[ref.end]);
    list.forEach(dim => {
      const len = Math.hypot(dim.end.x - dim.start.x, dim.end.z - dim.start.z);
      if (!(len > 1e-9)) return;
      const u = { x: (dim.end.x - dim.start.x) / len, z: (dim.end.z - dim.start.z) / len };
      [['startRef', 'start'], ['endRef', 'end']].forEach(([key, at]) => {
        const ref = dim[key];
        const v = ref && refPoint(ref);
        if (!v) return;
        const along = (v.x - ref.x) * u.x + (v.z - ref.z) * u.z;
        if (Math.abs(v.x - ref.x) < 1e-9 && Math.abs(v.z - ref.z) < 1e-9) return;
        dim[at] = { ...dim[at], x: dim[at].x + u.x * along, z: dim[at].z + u.z * along };
        ref.x = v.x; ref.z = v.z;
      });
    });
  };
  const dimDirection = points => {
    if (dimMode === 'h') return { x: 1, z: 0 };
    if (dimMode === 'v') return { x: 0, z: 1 };
    const lock = angleLockDeg();
    if (lock != null) return { x: Math.cos(lock * Math.PI / 180), z: -Math.sin(lock * Math.PI / 180) };
    const a = points[0], b = points[points.length - 1];
    const len = a && b ? Math.hypot(b.x - a.x, b.z - a.z) : 0;
    return len > 1e-6 ? { x: (b.x - a.x) / len, z: (b.z - a.z) / len } : null;
  };
  // THE STRING, STANDING THROUGH `at`: every point carried square on to the
  // line through `at` along the string's direction, and a dimension between
  // each pair. drawDimension2D stands its line off to the LEFT of start ->
  // end, so each piece is turned to put that side away from what it
  // measures, where the ink belongs.
  const dimString = (points, at) => {
    const u = points.length >= 2 ? dimDirection(points) : null;
    if (!u || !at) return [];
    const n = { x: -u.z, z: u.x };
    const o = points[0];
    const off = (at.x - o.x) * n.x + (at.z - o.z) * n.z;
    // IN WHATEVER ORDER THEY WERE PRESSED (Movie, 20 Oct: "i'd like it if it
    // doesn't matter what order they are placed, the closest together ones
    // will create a dimention between"): the points are taken in order ALONG
    // the string, so each piece measures between neighbours.
    const q = points.map(p => {
      const along = (p.x - o.x) * u.x + (p.z - o.z) * u.z;
      return { x: o.x + u.x * along + n.x * off, z: o.z + u.z * along + n.z * off, from: p, along };
    }).sort((p1, p2) => p1.along - p2.along);
    const out = [];
    for (let i = 0; i + 1 < q.length; i += 1) {
      const a = q[i], b = q[i + 1];
      if (Math.hypot(b.x - a.x, b.z - a.z) < 0.01) continue;
      const left = { x: -(b.z - a.z), z: b.x - a.x };
      const away = (a.x - a.from.x + b.x - b.from.x) * left.x + (a.z - a.from.z + b.z - b.from.z) * left.z;
      const [s0, s1] = away < 0 ? [b, a] : [a, b];
      out.push({ start: { x: s0.x, y: 0, z: s0.z }, end: { x: s1.x, y: 0, z: s1.z },
        ...(s0.from.ref ? { startRef: { ...s0.from.ref } } : {}), ...(s1.from.ref ? { endRef: { ...s1.from.ref } } : {}) });
    }
    return out;
  };
  // ANOTHER LINE OF THE SAME POINTS, AND ANOTHER (Movie, 20 Oct: "after the
  // first line is placed can you also allow the user to place a SECOND line in
  // another position and another until the user double clicks the mouse,
  // enter key or keyboard (click again after the last one twice) to stop").
  // Placing stays up after each line; ENTER, a double-click, or a click on
  // the line just placed puts the string down. The pieces he does not want
  // on the outer lines he deletes like any dimension.
  let dimLastLine = null;
  const finishDimString = () => {
    const placed = dimLastLine?.count || 0;
    dimPoints = [];
    dimPlacing = false;
    dimLastLine = null;
    sayOnStrip(placed ? 'DIMENSION — done. Press the next string\'s first point.' : 'DIMENSION — press the first point.');
    paint();
    return true;
  };
  // AN UNDO OF THE LINE JUST PLACED -- or anything done after it -- ends the
  // lines: the string is over once its last line is no longer the last thing
  // done, and the next press starts a fresh one.
  const dimLinesStale = () => {
    if (!dimLastLine || undoStack[undoStack.length - 1] === dimLastLine.step) return false;
    dimPoints = []; dimPlacing = false; dimLastLine = null;
    return true;
  };
  const endDimString = () => {
    dimLinesStale();
    if (dimPoints.length < 2) {
      sayOnStrip('DIMENSION — press two points at least, then SPACE, ENTER or the right button.');
      return false;
    }
    dimPlacing = true;
    sayOnStrip(`DIMENSION — ${dimPoints.length - 1} to place: click where the string goes.`);
    return true;
  };
  // ── THE SEQUENCE, AS MOVIE SET IT OUT (24 Oct) ────────────────────────
  //
  // "first press "D" to start the dimensiong ... choose a point and beging
  // making a line of dimensions by clicking left click on each point, when
  // i press RIGHT mouse, SPACE or ENTER the points are finished and we move
  // onto the LINE placement, once the line is in a good place the user
  // presses LEFT click to place line, and again another LEFT click at
  // another line location,,, when wish to finish press RIGHT CLICK, SPACE or
  // ENTER. at any time if they user would like to abort the DIMensionsing
  // process press ESC key to exit out without placing dimension".
  //
  // So LEFT only ever adds -- a point, or a line -- and only RIGHT, SPACE or
  // ENTER moves the string on. The double-click that used to end it, and the
  // click on the line just placed that used to finish it, are gone: a
  // drafter clicking two points quickly, or laying a second line close to
  // the first, was being told he had finished. A click exactly where the last
  // line already stands lays nothing: that line is there.
  // ON THE LINE JUST PLACED: within 2 px of it, across the string.
  const dimOnLastLine = at => {
    if (!dimLastLine) return false;
    const u = dimDirection(dimPoints);
    const n = u ? { x: -u.z, z: u.x } : null;
    const off = n ? (at.x - dimLastLine.at.x) * n.x + (at.z - dimLastLine.at.z) * n.z : Infinity;
    return Math.abs(off) * view.scale < 2;
  };
  const dimPress = at => {
    dimLinesStale();
    if (dimPlacing) {
      // A CLICK ON THE LINE JUST PLACED puts the string down: the same spot,
      // twice, is how he says he is done.
      if (dimOnLastLine(at)) return;
      const pieces = dimString(dimPoints, at);
      if (!pieces.length) { sayOnStrip('DIMENSION — those points measure nothing that way.'); return; }
      const { levelId } = onActiveLevel();
      const viewId = activeViewId() || 'plan';
      if (!Array.isArray(drawing.dimensions)) drawing.dimensions = [];
      const made = pieces.map(piece => {
        const record = { id: newDimensionId(), start: piece.start, end: piece.end, levelId, view: viewId,
          layer: DIM_HAND_LAYER, auto: false,
          ...(piece.startRef ? { startRef: piece.startRef } : {}), ...(piece.endRef ? { endRef: piece.endRef } : {}) };
        drawing.dimensions.push(record);
        return record;
      });
      const step = { kind: 'built', walls: [], outlines: [], list: null,
        items: made.map(item => ({ list: drawing.dimensions, item })) };
      undoStack.push(step);
      dimLastLine = { at: { x: at.x, z: at.z }, made, step, when: Date.now(), count: (dimLastLine?.count || 0) + 1 };
      // A LINE PLACED IS A LINE SEEN (Movie, 24 Oct: "the LEFT CLICK to place
      // the dimension line isn't working still" -- it was placing them, with
      // HAND DIMS switched off, so each one went down out of sight). Placing
      // one puts HAND DIMS back on, and says so.
      const wasHidden = dimsHidden.hand;
      if (wasHidden) {
        dimsHidden = { ...dimsHidden, hand: false };
        try { localStorage.setItem('model.dimsHidden', JSON.stringify(dimsHidden)); } catch (e) {}
      }
      sayOnStrip(`DIMENSION — ${made.length} placed${wasHidden ? ' (HAND DIMS was off — turned back on so you can see them)' : ''}. Click again for another line of the same points, or SPACE, ENTER or the right button to finish.`);
      markDirty();
      paint();
      return;
    }
    const faces = dimWallFacesAt(at);
    if (faces) {
      dimPoints.push(...faces.points);
      sayOnStrip(`DIMENSION — both faces of the wall (${window.DraftFormatters.formatArchitecturalInches(faces.thicknessFt * 12)}), `
        + `${dimPoints.length} points: the next, or SPACE, ENTER or the right button to end the string`);
      paint();
      return;
    }
    const p = dimPoint(at);
    const last = dimPoints[dimPoints.length - 1];
    // The second press of a double-click lands where the first did: it is
    // the end of the string, not another point.
    if (last && Math.hypot(p.x - last.x, p.z - last.z) < 1e-6) return;
    dimPoints.push(p);
    sayOnStrip(dimPoints.length === 1 ? 'DIMENSION — the next point'
      : `DIMENSION — ${dimPoints.length} points: the next, or SPACE, ENTER or the right button to end the string`);
    paint();
  };
  // ONCE ENDS (Movie, 23 Oct): SPACE, ENTER or the right button. While the
  // points go down it ends them and the line placement begins; while the
  // lines are placed it finishes the string, with nothing taken back -- the
  // key or the button laid no line of its own. Esc alone abandons it
  // (cancelGestures).
  // NOT BEFORE A LINE IS DOWN (Movie, 23 Oct: "it doesn't produce the
  // dimension at the very end it just ESC's and nothing appears"): a second
  // SPACE, ENTER or right click straight after the one that ended the points
  // -- the habit of the twice rule this replaced -- used to finish the string
  // with no line, which only Esc should do. With no line laid it keeps the
  // string up and says where the click goes.
  const dimOnceEnds = () => {
    dimLinesStale();
    // ONLY A LEFT CLICK LAYS A LINE (Movie, 25 Oct: "on the last dimension
    // line when the user presses SPACE or ENTER to close it off. don't add
    // another dimension line ... just leave the LEFT CLICK produced dims").
    // The key or the button that ends the lines lays none of its own; the
    // earlier rule that laid one at the mouse first is gone.
    if (dimPlacing && !dimLastLine) {
      sayOnStrip(`DIMENSION — ${Math.max(dimPoints.length - 1, 1)} to place: click where the string goes (Esc abandons it).`);
      return true;
    }
    if (dimPlacing) return finishDimString();
    if (endDimString()) paint();
    return true;
  };
  // ESC KEEPS WHAT IS DOWN (Movie, 25 Oct: "i accidentally press it meaning
  // to end the chain but to keep it. can we change it so what has been
  // created so far is KEPT when ESC is pressed but if its only on the 1st
  // stage it will finish the command quickly"). It used to take back every
  // line of the string. Now the lines laid stay, and so do their UNDO steps;
  // points not yet laid as a line simply go (cancelGestures). Called by
  // cancelGestures; says so when there was something to keep.
  const dimKeep = () => {
    const placed = dimLastLine?.count || 0;
    dimLastLine = null;
    if (placed) sayOnStrip(`DIMENSION — done, ${placed} line${placed === 1 ? '' : 's'} kept. Press the next string's first point.`);
    return placed > 0;
  };
  // A TOOL CHANGE PUTS THE STRING DOWN and brings the pop-up up or down --
  // through the register's listeners, because setTool runs at load, before
  // this block has declared anything.
  toolListeners.push(next => {
    // DIMENSION TAKEN UP AGAIN while its lines are being placed is a fresh
    // start too: the lines are finished.
    if (next !== 'dimension' || dimLastLine) { dimPoints = []; dimPlacing = false; dimLastLine = null; }
    syncDimPop();
    seatNorthDock();
  });
  // THE STRING IN HAND, in the preview's ink: along the points while they
  // are being pressed (the cursor the next one), off them where the cursor
  // is once the string is ended.
  const paintDimPreview = () => {
    const R = window.DraftRender2D;
    if (!R || !cursorWorld || activeTool !== 'dimension') return;
    dimLinesStale();
    const pieces = dimPlacing ? dimString(dimPoints, cursorWorld)
      : dimPoints.length ? dimString(dimPoints.concat([dimPoint(cursorWorld)]), dimPoints[0]) : [];
    const env = dimensionEnv();
    pieces.forEach(piece => R.drawDimension2D(ctx, toS, piece, { preview: true }, env));
    // THE NODE IT WILL LOCK TO, LIT (Movie, 18 Oct: "light them NODES up for
    // the DIMENSION points so the user will know they are going to be locked
    // on the right spot"). Not while the string is being placed.
    // THE DOORS' AND WINDOWS' DOTS, ORANGE while the tool is up, so the
    // drafter sees they take a dimension; the one in reach gets the donut.
    const dot = !dimPlacing ? openingCentreAt(cursorWorld) : null;
    ctx.save();
    ctx.fillStyle = DONUT.orange.ink;
    ctx.shadowColor = DONUT.orange.glow;
    ctx.shadowBlur = 6;
    openingsOn(walls()).forEach(({ opening }) => {
      const c = openingCentre(opening);
      if (!c) return;
      const s = toS(c);
      ctx.beginPath(); ctx.arc(s.x, s.y, 3, 0, Math.PI * 2); ctx.fill();
    });
    ctx.restore();
    if (dot) paintDonut(dot.c, 'orange');
    if (!dimPlacing && !dot) {
      const snap = board !== 'toy' ? drawSnap(cursorWorld) : {};
      const lit = snap.pt || cornerSnap(cursorWorld, []);
      if (lit) {
        const s = toS(lit);
        ctx.save();
        ctx.strokeStyle = skin['accent'] || '#e8a33d';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(s.x, s.y, 7, 0, Math.PI * 2); ctx.stroke();
        ctx.restore();
      }
    }
    ctx.save();
    ctx.fillStyle = skin['draw-dim'];
    dimPoints.forEach(p => {
      const s = toS(p);
      ctx.beginPath(); ctx.arc(s.x, s.y, 3, 0, Math.PI * 2); ctx.fill();
    });
    ctx.restore();
  };

  // ── THE ANNOTATION PANEL ─────────────────────────────────────────────────
  // POINTER on or off, and what the leader ends in. One end for now --
  // STRAIGHT -- with the row there so the arrow types land beside it.
  let notePanelUp = false;
  const showNoteProps = () => {
    const P = window.ModelProps;
    if (!P) return;
    const box = document.createElement('div');
    const chip = (label, on, data, click, title = '') => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'sel-chip';
      b.textContent = label;
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
      Object.entries(data).forEach(([k, v]) => { b.dataset[k] = v; });
      if (title) b.title = title;
      b.addEventListener('click', click);
      return b;
    };
    const titled = text => {
      const t = document.createElement('div');
      t.className = 'props-title';
      t.textContent = text;
      return t;
    };
    const pointerRow = document.createElement('div');
    pointerRow.className = 'chip-row';
    pointerRow.append(
      chip('NO POINTER', !notePointer, { notePointer: 'off' }, () => {
        notePointer = false; elevPointerTip = null; showNoteProps(); paint();
      }),
      chip('POINTER', notePointer, { notePointer: 'on' }, () => {
        notePointer = true; showNoteProps();
        sayOnStrip('POINTER — tap the thing to point at, then where the text goes.');
      }));
    const endRow = document.createElement('div');
    endRow.className = 'chip-row';
    endRow.append(chip('STRAIGHT', noteEnd === 'line', { noteEnd: 'line' }, () => {
      noteEnd = 'line'; showNoteProps();
    }, 'A plain end on the pointer line. Arrow types come later.'));
    box.append(titled('POINTER'), pointerRow, titled('POINTER END'), endRow);
    P.set('ANNOTATION', box);
    notePanelUp = true;
  };

  // ── THE BEAM PANEL ───────────────────────────────────────────────────────
  //
  // The armed-tool half of AUTO BEAM; the worker and the reasoning are up at
  // placeAutoBeam. Movie: "the AUTOBEAM/COLUMN should be available in the
  // build/ BEAM & COLUMN buttons".
  // ── THE FLOOR THE DRAFTER IS LOOKING AT IS THE ONE HE MEANS ─────────────
  //
  // And its beam lives on the level BELOW it. Standing on MAIN FL asks for the
  // beam that holds MAIN FL up, which is filed on FOUNDATION; standing on 2ND
  // FL asks for the one under 2ND FL, filed on MAIN FL. On FOUNDATION there is
  // no floor to look at, so it frames the storey above -- its own.
  //
  // THE FIRST VERSION HAD THIS THE OTHER WAY UP and the specs found it by
  // HANGING rather than failing: standing on MAIN FL it framed the floor
  // ABOVE, so on a drawing whose only outline is the main floor the button
  // went disabled and every `click()` waited out its timeout. Six tests, no
  // assertion message, just a run that never finished.
  //
  // It was also wrong for the drafter. AUTO BEAM on the main floor putting
  // structure on the 2ND FL layer is a surprise; asking for the beam under
  // the floor on screen is what the button looks like it does.
  // BY STOREY, like floorCarriedBy, and it has to be or the two disagree:
  // standing on the ENTRY landing of a MOD BILEVEL, the beam that holds it up
  // is the main floor's beam on FOUNDATION, not one filed against the landing
  // by the level below the landing -- which is FOUNDATION anyway. Asking this
  // by storey is what makes "the level that frames me" and "the floor that
  // level carries" the same relation read from its two ends.
  const framesFrom = levelId => {
    const LA = window.DraftLevelAssembly;
    const floors = window.DraftLayerViews.floorLevels(drawing?.levels || []);
    const at = floors.findIndex(level => Number(level.id) === Number(levelId));
    // Not a storey at all -- FOUNDATION, ROOF, SITE -- so it frames from where
    // it stands and floorCarriedBy decides whether that means anything.
    if (at < 0) return Number(levelId);
    // The last level below me that is NOT in my storey. Nothing below means
    // the lowest storey, and FOUNDATION frames that.
    const below = floors.slice(0, at).filter(level => !LA.sameStorey(level.id, levelId));
    return below.length ? Number(below[below.length - 1].id) : FOUNDATION_LEVEL_ID;
  };

  const pressAutoBeam = () => {
    const levelId = framesFrom(activeLevelId());
    const result = placeAutoBeam({ levelId });
    if (result === -1) {
      const carried = floorCarriedBy(levelId);
      sayOnStrip(!levelPresent(levelId)
        ? 'AUTO BEAM needs a level to file against.'
        : !carried
          ? 'AUTO BEAM frames the floor ABOVE — this level carries a roof, and '
            + 'the exterior walls do that job.'
          : 'AUTO BEAM needs an outline on ' + levelLabel(carried.id, carried.name)
            + ' — that is the floor this level would carry.');
      return;
    }
    // NOTHING PLACED IS NOT NOTHING DONE, the reason AUTO DIMS pushes on
    // either list: a re-run over a house that no longer needs a beam sweeps
    // the old one, and an undo skipped because `placed` was empty would
    // strand that sweep with no way back.
    if (result.placed.length || result.restored.length) {
      undoStack.push({
        kind: 'built',
        walls: [], outlines: [], list: null,
        items: result.placed,
        restored: result.restored,
      });
      markDirty();
    }
    // THE 19 FT ANSWER IS AN ANSWER, not a failure, and it is the one a
    // bungalow gets. MODEL.dc.html says it in a tour popup (:4364); the strip
    // is where this page says things.
    const level = (drawing.levels || [])
      .find(entry => Number(entry.id) === result.levelId);
    const many = n => (n === 1 ? '' : 's');
    // AND WHETHER THEY STAND ON ANYTHING. Movie's rule is that a column goes
    // over another column or over a solid wall; where nothing was in reach the
    // post still had to go in, and saying so is the difference between a frame
    // he can trust and one he has to re-check by eye.
    const hanging = result.unsupported
      ? ` ${result.unsupported} of them ${result.unsupported === 1 ? 'has' : 'have'} `
        + 'nothing under it — check what carries that load.'
      : '';
    sayOnStrip(result.beams
      ? `AUTO BEAM placed ${result.beams} beam${many(result.beams)} and `
        + `${result.columns} column${many(result.columns)} on `
        + `${levelLabel(result.levelId, level && level.name)} — re-run after `
        + 'outline edits to refresh them.' + hanging
      : 'Every span is under 19′ — no mid-span beam needed.');
    buildChrome();
    paint();
  };

  // ── AUTO PILES, the panel's other button ────────────────────────────────
  //
  // Movie, 25 Sep: "we should also add that into the COLUMN command". The
  // bone press pours a garage's piles as it builds it; this is the same
  // worker for a garage already on the sheet -- traced by hand, or built
  // before this landed and still standing on nothing.
  //
  // THE GARAGES A PILE CAN GO UNDER are the ones whose foundation is a GRADE
  // BEAM. A frost wall stands on a strip footing and a thickened edge is its
  // own, so neither wants piles -- writing them would draw concrete that is
  // not there, which is the rule raiseGarageConcrete's footing rings already
  // follow in the other direction.
  const gradeBeamGarages = () => {
    const storey = lowestFloorLevel();
    if (!storey) return [];
    return (drawing?.outlines || []).filter(outline =>
      Number(outline.levelId) === Number(storey.id)
      && outline.garage === true
      && (outline.points || []).length >= 3
      && garageFoundationOf(outline) === 'gradebeam');
  };

  const pressAutoPiles = () => {
    if (!drawing) return;
    const garages = gradeBeamGarages();
    if (!garages.length) {
      sayOnStrip('AUTO PILES needs a garage on a GRADE BEAM — a frost wall '
        + 'stands on its own footing and a thickened edge is its own.');
      return;
    }
    if (!levelPresent(FOUNDATION_LEVEL_ID)) {
      sayOnStrip('AUTO PILES files on FOUNDATION and this drawing has no '
        + 'FOUNDATION level.');
      return;
    }
    // RE-RUNNING REPLACES THE GENERATED PILES AND NOTHING ELSE, the rule AUTO
    // BEAM and AUTO DIMS both take. A pile the drafter placed or moved is his,
    // and so is a telepost -- which is why this asks for a PILE footing and
    // not merely for `auto`, the same discriminator that keeps AUTO BEAM's
    // sweep off these.
    const swept = [];
    drawing.columns = (drawing.columns || []).filter(column => {
      const mine = column.auto === true
        && Number(column.levelId) === FOUNDATION_LEVEL_ID
        && column.view === 'foundation'
        && String(column.footing || '').startsWith('pile');
      if (mine) swept.push(column);
      return !mine;
    });
    // THE HOUSE IS WHAT THE SHARED EDGE IS TESTED AGAINST, so an attached
    // garage takes no piles along the leg it shares -- there is no beam
    // there. A detached one has no house to share with and gets the whole
    // loop, which is the difference Movie flagged: "i don't think we had a
    // grade beam for the DETACHED at that point, but it could opertate in a
    // similar way".
    const house = houseFootprint();
    const against = house ? house.outline.points : null;
    const placed = [];
    garages.forEach(garage => {
      placed.push(...placeGaragePiles(garage.points, { against }).placed);
    });
    if (placed.length || swept.length) {
      undoStack.push({
        kind: 'built',
        walls: [], outlines: [], list: null,
        items: placed,
        restored: swept.length ? [{ list: drawing.columns, items: swept }] : [],
      });
      markDirty();
    }
    // THE MARKS ACTUALLY PLACED, not the one a constant used to name. Two
    // garages on one drawing can differ -- a room over one and not the other
    // -- and a line that claimed P2 for both would be the drawing's only
    // statement of a load the schedule reads differently.
    const marks = [...new Set(placed.map(p => p.item.pileMark))].sort();
    sayOnStrip(placed.length
      ? `AUTO PILES placed ${placed.length} pile${placed.length === 1 ? '' : 's'} `
        + `on FOUNDATION, ${marks.join('/')} at ${GARAGE_PILE_SPACING_FT}′ `
        + 'or less — re-run after outline edits to refresh them.'
      : 'That grade beam is too small to pile — check the garage outline.');
    buildChrome();
    paint();
  };

  let beamPanelUp = false;
  const showBeamProps = () => {
    const P = window.ModelProps;
    if (!P) return;
    const box = document.createElement('div');

    const row = document.createElement('div');
    row.className = 'chip-row';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'sel-chip';
    btn.dataset.autoBeam = '';
    btn.textContent = 'AUTO BEAM + COLUMNS';
    // DISABLED, NOT HIDDEN -- the rule the ROOF panel's own button takes: one
    // that vanishes teaches the drafter that BEAM does nothing here, and one
    // that is greyed says what is missing.
    //
    // AND NOT GREYED FOR "no beam needed", which is a RESULT rather than a
    // missing prerequisite. A house under 19 ft gets the press and the
    // sentence, which is the same answer MODEL.dc.html's tour gives (:4364);
    // a button greyed on a bungalow would read as broken.
    const armedLevel = framesFrom(activeLevelId());
    const carried = floorCarriedBy(armedLevel);
    const found = carried ? houseFootprint(carried) : null;
    const ready = !!found && levelPresent(armedLevel);
    btn.disabled = !ready;
    btn.title = !carried
      ? 'This level carries a roof, not a floor — the exterior walls do that job.'
      : found
        ? `Frame ${levelLabel(carried.id, carried.name)} from below: the mid-span `
          + 'beam and the posts that carry it.'
        : `No outline on ${levelLabel(carried.id, carried.name)} yet — that is the `
          + 'floor this level would carry.';
    btn.addEventListener('click', () => { pressAutoBeam(); showBeamProps(); });
    row.append(btn);

    // AND THE PILES, in the same row because they answer the same question --
    // what holds this level up. Movie put AUTO PILES "into the COLUMN
    // command", which is this panel: COLUMN and BEAM share it.
    const piles = document.createElement('button');
    piles.type = 'button';
    piles.className = 'sel-chip';
    piles.dataset.autoPiles = '';
    piles.textContent = 'AUTO PILES';
    const garages = gradeBeamGarages();
    piles.disabled = !(garages.length && levelPresent(FOUNDATION_LEVEL_ID));
    piles.title = garages.length
      ? (levelPresent(FOUNDATION_LEVEL_ID)
        ? `Pour piles under the grade beam, one per corner and every `
          + `${GARAGE_PILE_SPACING_FT}′ or less — ${GARAGE_PILE_MARK_ONE_STOREY}, `
          + `or ${GARAGE_PILE_MARK_ROOM_OVER} where a floor sits over the garage.`
        : 'This drawing has no FOUNDATION level to file the piles on.')
      : 'No garage on a grade beam — a frost wall carries its own footing.';
    piles.addEventListener('click', () => { pressAutoPiles(); showBeamProps(); });
    row.append(piles);

    // SHORT, AND THE LENGTH IS LOAD-BEARING. #left-rail has a min-width and
    // NO max-width (shell-bars.css:901), so the rail is as wide as its widest
    // child -- and this note began as a two-line paragraph about the 19 ft
    // rule and the 12 ft posts. Measured: the rail went from its tool-column
    // width to 470px and covered the plan out to x = 476, where
    // model-structure-place.spec.js clicks to draw a beam by hand. Both of
    // its beam tests failed with `beams 0/0` and no page error, because the
    // presses were landing on the rail.
    //
    // The cap below is what ENDS that, so this is no longer the only thing
    // standing between a panel and the drawing -- but a panel is a place for
    // a label, not a paragraph, and the long one is gone on its own merits.
    const note = document.createElement('div');
    note.className = 'props-title';
    note.dataset.beamNote = '';
    note.textContent = 'FILES ON FOUNDATION';

    box.append(row, note);
    // THE CARRIED FLOOR'S JOIST CALLOUT, typed (Movie, 19 Oct: "make that
    // TEXT editable so and ENGINEER can change it"). It replaces the callout
    // in every bay of that floor -- on its layout here and on the sheets --
    // and blank gives back the one worked out from the joist.
    if (carried) {
      const asm = drawing.levelAssemblies?.[carried.id] || {};
      const computed = window.DraftBuildHouse?.joistCallout?.({
        ...window.DraftLevelAssembly.levelAssemblyFor(drawing.levelAssemblies, carried.id), joistCallout: null }) || '';
      const field = propText(`JOIST CALLOUT ${levelLabel(carried.id, carried.name)}`, asm.joistCallout || '', text => {
        drawing.levelAssemblies = drawing.levelAssemblies || {};
        const rec = drawing.levelAssemblies[carried.id] || (drawing.levelAssemblies[carried.id] = {});
        const before = { ...rec };
        if (text.trim()) rec.joistCallout = text.trim(); else delete rec.joistCallout;
        undoStack.push({ kind: 'props', edits: [{ item: rec, before }] });
        markDirty();
        showBeamProps();
        paint();
      });
      field.dataset.joistCallout = '';
      const input = field.querySelector('input');
      if (input) input.placeholder = computed;
      box.append(field);
    }
    P.set('BEAM & COLUMN', box);
    beamPanelUp = true;
  };


  // THE BUTTON IS NOT THE ONLY CALLER, the same split AUTO BEAM and AUTO DIMS
  // take: the bone press folds the stairs into the ONE undo step that covers
  // the whole build, so the worker owns no undo of its own.
  const pressAutoStairs = () => {
    const result = placeAutoStairs();
    if (result === -1) {
      sayOnStrip(window.DraftAutoStair
        ? 'AUTO STAIR needs a level that carries a floor.'
        : 'AUTO STAIR cannot run: auto-stair.js did not load.');
      return;
    }
    if (result.placed.length) {
      undoStack.push({
        kind: 'built',
        walls: [], outlines: [], list: null,
        items: result.placed,
        restored: [],
      });
      markDirty();
    }
    // WHAT IT DID, LEVEL BY LEVEL, because a stair is a decision rather than a
    // count -- the riser number, the shape it folded to and whether it stacked
    // are the three things a drafter checks first. The notes carry all three,
    // and a level that got nothing says why rather than going quiet.
    const said = [];
    if (result.stairs) {
      said.push(`AUTO STAIR placed ${result.stairs} `
        + `flight${result.stairs === 1 ? '' : 's'}`
        + (result.openings
          ? ` and cut ${result.openings} opening${result.openings === 1 ? '' : 's'}`
          : ''));
    }
    // A NUDGE IS REPORTED BECAUSE THE STAIR MOVED. The drafter asked for a
    // placement and got one somewhere else -- inches off a beam, or back
    // inside the wall -- and a silent shift is the drawing disagreeing with
    // the press that made it.
    if (result.nudges.length) said.push(`nudged ${result.nudges.join(', ')} clear`);
    if (result.refused.length) {
      said.push(`${result.refused.length} opening`
        + `${result.refused.length === 1 ? '' : 's'} NOT cut — ${result.refused.join('; ')}`);
    }
    sayOnStrip(said.length
      ? `${said.join(' · ')}. ${result.notes.join(' ')}`.trim()
      : (result.notes.length
        ? result.notes.join(' ')
        : 'Every floor already has its stair — delete one to have it suggested again.'));
    buildChrome();
    paint();
  };

  let stairPanelUp = false;
  const showStairProps = () => {
    const P = window.ModelProps;
    if (!P) return;
    const box = document.createElement('div');

    const row = document.createElement('div');
    row.className = 'chip-row';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'sel-chip';
    btn.dataset.autoStair = '';
    btn.textContent = 'AUTO STAIR';
    // GREYED FOR A MISSING PREREQUISITE ONLY, which is the rule the BEAM
    // panel's button states: a button greyed on a house that simply already
    // has its stairs reads as broken. "Every floor already has one" is a
    // RESULT, so it gets the press and the sentence.
    //
    // THE PREREQUISITE IS AN OUTLINE ON SOME DESCENDING FLOOR. Without one
    // there is no ring to place inside and no rise to count, and the press
    // would be a no-op the drafter cannot see the reason for.
    const floors = stairFloorLevels();
    const placeable = floors.filter(level => {
      const descent = window.DraftStairGeometry.stairDescent(level.id, stairLevels());
      return !!houseOutlineOn(level.id) && !!descent && descent.riseFt > 0;
    });
    const ready = !!window.DraftAutoStair && placeable.length > 0;
    btn.disabled = !ready;
    btn.title = !window.DraftAutoStair
      ? 'auto-stair.js did not load — check the script order in the page head.'
      : placeable.length
        ? `Suggest a flight on ${placeable.map(level => levelLabel(level.id, level.name)).join(', ')}`
          + ' — bottom-up, each one stacked over the run below, and cut its opening.'
        : 'No floor with an outline to descend from yet — draw one and press again.';
    btn.addEventListener('click', () => { pressAutoStairs(); showStairProps(); });
    row.append(btn);

    // SHORT, AND THE LENGTH IS LOAD-BEARING -- see the BEAM panel's note. The
    // rail is as wide as its widest child, and a paragraph here covered the
    // plan out to x = 476 and swallowed the presses meant for the canvas.
    const note = document.createElement('div');
    note.className = 'props-title';
    note.dataset.stairNote = '';
    note.textContent = ready
      ? `${stairWidthFt * 12}" WIDE · ${stairRailSide.toUpperCase()} BAR`
      : 'NEEDS AN OUTLINE';

    box.append(row, note);
    P.set('STAIR', box);
    stairPanelUp = true;
  };

  // ── A PANEL BUILT ON ONE LEVEL IS STALE ON THE NEXT ─────────────────────
  //
  // showBeamProps reads the active level to decide which floor it would frame
  // and whether it can, so its sentence and its greying belong to the level
  // it was built on. goToLevel rebuilt the chrome and repainted and left the
  // panel exactly as it was -- the button could sit disabled on a level where
  // it would work, or offer to frame a floor the drafter had just left.
  //
  // It did not matter until AUTO BEAM: ROOF, FENESTRATION and DIMENSION all
  // describe the NEXT thing placed rather than the level, so their panels read
  // the same everywhere.
  //
  // ONLY WHEN A TOOL PANEL IS THE ONE ON SCREEN. A selection panel describes a
  // thing, not a level, and rebuilding the tool's over the top of it would
  // take away what the drafter is reading.
  const refreshToolPropsOnLevel = () => {
    if (roofPanelUp || openingPanelUp || dimensionPanelUp || beamPanelUp || stairPanelUp || notePanelUp
      || wallPanelUp) {
      showToolProps(activeTool);
    }
  };

  const showToolProps = tool => {
    if (tool === 'roof') { showRoofProps(); return; }
    if (tool === 'dormer') { showDormerProps(); return; }
    if (tool === 'wall') { showWallProps(); return; }
    if (tool === 'fenestration') { showOpeningProps(); return; }
    if (tool === 'dimension') { showDimensionProps(); return; }
    // COLUMN AND BEAM SHARE ONE PANEL, because AUTO BEAM places both and a
    // drafter reaching for either is reaching for the same button. Movie's
    // own placement -- "the AUTOBEAM/COLUMN should be available in the build/
    // BEAM & COLUMN buttons" -- rather than a tidy-up.
    if (tool === 'beam' || tool === 'column') { showBeamProps(); return; }
    if (tool === 'stair') { showStairProps(); return; }
    if (tool === 'annotation') { showNoteProps(); return; }
    // Only clear what this panel put there. A COLUMN's or a BEAM's own rows
    // belong to the SELECTION, which a tool change does not touch, and
    // clearing them here would blank a panel the drafter is reading.
    //
    // EACH PANEL CLEARS ITS OWN, and the two flags are not one flag: arming
    // ROOF from FENESTRATION has to take the opening rows down and put the
    // roof rows up, which a single `panelUp` would get right by luck and a
    // shared `clear()` before both branches would get wrong the moment a
    // third panel arrived that does not want clearing.
    if (roofPanelUp) { window.ModelProps.clear(); roofPanelUp = false; }
    if (openingPanelUp) { window.ModelProps.clear(); openingPanelUp = false; }
    if (wallPanelUp) { window.ModelProps.clear(); wallPanelUp = false; }
    if (dimensionPanelUp) { window.ModelProps.clear(); dimensionPanelUp = false; }
    if (beamPanelUp) { window.ModelProps.clear(); beamPanelUp = false; }
    if (stairPanelUp) { window.ModelProps.clear(); stairPanelUp = false; }
    if (notePanelUp) { window.ModelProps.clear(); notePanelUp = false; }
    if (dormerPanelUp) { window.ModelProps.clear(); dormerPanelUp = false; }
  };

  toolListeners.push(tool => {
    // ARMING A TOOL TAKES DOWN A PANEL THE SELECTION PUT UP, so the box
    // describes the thing the drafter just reached for. The three flags above
    // stay each panel's own -- that ruling holds -- and this is a fourth
    // owner, not a shared clear(): the selection's panel is the only one a
    // tool change must always take down, because the others ARE the tool.
    if (selectionPanelUp) { window.ModelProps.clear(); selectionPanelUp = false; }
    showToolProps(tool);
  });
  deleteButton.addEventListener('click', pressDelete);
  if (undoButton) undoButton.addEventListener('click', () => { if (!modalUp()) undoOnce(); });
  // The storey arrows, guarded the same way: the sign covers this strip, so a
  // press that arrives while it is up did not come from a drafter who could
  // see the button.
  if (levelUpButton) levelUpButton.addEventListener('click', () => { if (!modalUp()) levelStep(LEVEL_UP); });
  if (levelDownButton) levelDownButton.addEventListener('click', () => { if (!modalUp()) levelStep(LEVEL_DOWN); });
  if (copyButton) copyButton.addEventListener('click', () => { copySelection(); paint(); });
  if (pasteButton) pasteButton.addEventListener('click', () => { pasteHeld(); });

