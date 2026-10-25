// MODEL.html's page script, part 4 of 17: the level and view switchers, the NOTES pad, the left rail's facts, the build bar, GRUFF's sign, the bone's second press.
//
// Stage 2 of the split (Movie, 24 Oct: "how can we reduce the MODEL.html
// size in a nice organized way"): the one script the page carried, cut
// at its own section headings and moved here verbatim, in order. The
// parts load one after another as classic scripts and share one scope,
// as they did inside the page; the indent is the page's, kept so every
// line reads as it did there.

  // ── the level switcher, and the view switcher ─────────────────────────────
  // TIER 3b, and the spec's own words: "a level switcher is chrome, and chrome
  // is tier 3." The page has painted any level correctly since tier 2a, but
  // only `?level=` could change which one -- and a URL is not a drafter.
  //
  // NO WRITES IN THIS RUNG. Both switchers change what is LOOKED AT and
  // nothing that is saved: they set a query parameter and repaint. `drawing`
  // is not touched, markDirty is not called, and the save button does not
  // move off SAVE.
  //
  // THE URL STAYS THE ONE SOURCE OF TRUTH. `params` is already what
  // activeLevelId() and activeViewId() read, so the switcher writes THERE and
  // repaints, rather than keeping a second copy of "which level" beside it.
  // Two copies is how a picker comes to disagree with the address bar; with
  // one, `?level=` keeps working untouched, every switch is shareable and
  // reloadable, and there is nothing to get out of step.
  //
  // IDS, NEVER INDEXES. Every option's value is the level's own `id`.
  // MAIN_FLOOR_LEVEL_ID is 3 and `state.activeLevelIdx` is an index; on the
  // default list they happen to agree, and they stop agreeing the moment a
  // level is inserted. A switcher carrying the index would pass every test on
  // a default drawing and paint the wrong level on a real one -- broken and
  // passing looking identical, which is the failure this whole rung is about.
  // ── the shell ─────────────────────────────────────────────────────────────
  // THE URL IS THE STATE, as it is for `?level=` and `?view=`. A sidebar's
  // open/shut is what the drafter is looking at, so it lives where everything
  // else about that lives -- which makes it survive a reload and be shareable
  // without a second mechanism, and keeps this page's one-source-of-truth rule
  // intact. localStorage would have been a second home for view state.
  //
  // EACH SIDE IS ITS OWN PARAMETER. Devin's control is that closing the left
  // must not disturb the right, and two independent flags is the shape that
  // cannot get that wrong -- one packed value would have to be parsed, and a
  // parse is where "independent" quietly stops being true.
  //
  // BOTH DEFAULT SHUT, which is MODEL.dc.html's own default (:3009, "pull-out
  // tabs: both side rails start hidden") and the only state that costs the
  // drafter nothing. tests/model-html-shell.spec.js measures all four.
  //
  // THE TABLE OF RAILS IS GONE, not mislaid: it paired one tab with one
  // param, and the right edge now has two tabs driving one param plus a
  // pane. A row that said `tab: 'right-tab'` would have been a second,
  // wrong answer to "which tab opens the right rail" sitting beside the
  // real one.
  //
  // THE RIGHT ONE IS OPEN BY DEFAULT NOW (Movie, 10 Oct): "can you always
  // bring up this tab LAYERS/LEVELS up when a user entres the site or make an
  // AUTOBUILD, so they can see it draw onto the PREVIEWS when they press the
  // BONE". A drafter landing on the page, coming back from the BONEYARD after
  // a BONE, or opening a saved file finds it open. SHUT is spelled `right=0`,
  // so a drafter who closes it keeps it closed across a reload; the left
  // still defaults shut.
  const railOpen = param => (param === 'right'
    ? params.get(param) !== '0' : params.get(param) === '1');
  const setRail = (param, open) => {
    if (open) params.set(param, '1');
    else if (param === 'right') params.set(param, '0');
    else params.delete(param);
    syncUrl();
    syncShell();
    // The canvas did not change size -- the panels float over it, as every
    // other piece of this page's chrome does -- but the rail's seats only
    // exist to be looked at, so opening the right one has to paint them.
    paint();
  };

  // THE TWO SIDES COLLAPSE DIFFERENTLY, and that asymmetry is the ruling
  // rather than an inconsistency. The left holds tools: nothing there has a
  // claim to be permanently reachable, so shut means gone. The right holds
  // the view rail, and MODEL.dc.html keeps a column of it visible under an
  // open panel on purpose (:1766) -- "every view stays one tap away". Shut to
  // zero would have taken that away, so shut means ONE SEAT WIDE: all six
  // seats, single column, no properties.
  // WHICH PANE THE RIGHT RAIL IS SHOWING, in the URL beside `right` for the
  // same reason `right` is there: it is what the drafter is looking at, it
  // survives a reload, and it is shareable. `right` still says OPEN or SHUT
  // on its own, so every check written against `?right=1` keeps its meaning
  // -- the pane is a second, independent fact, not a repacking of the first.
  // ONE PANE NOW (Movie, 10 Oct), so an old `pane=previews` link -- a
  // bookmark, a shared URL -- falls back to it and still shows the previews.
  const PANES = ['levels', 'notes', 'history'];
  const paneShowing = () =>
    PANES.includes(params.get('pane')) ? params.get('pane') : 'levels';
  const setPane = pane => {
    // Pressing the tab that is already up SHUTS the rail, which is what the
    // one tab did and the gesture a drafter already has. Pressing the other
    // swaps panes and leaves it open -- shutting on a swap would make the
    // second tab cost two presses to use.
    if (pane === paneShowing() && railOpen('right')) { setRail('right', false); return; }
    params.set('pane', pane);
    if (!railOpen('right')) { setRail('right', true); return; }
    syncUrl();
    syncShell();
    paint();
  };

  // ── THE NOTES PAD ───────────────────────────────────────────────────────
  //
  // Movie, 16-17 Oct: "save with the draft, and also when a user starts a new
  // plan, keep the notes still there ... try to keep those notes always in
  // there as long as possible unless the user presses CLEAR". So the pad is
  // the drafter's, not the drawing's: it rides in the .draft as `notepad`, it
  // is mirrored to this browser so a reload or a crash keeps it, and a NEW
  // plan picks it up and saves it too. The one case where a file wins is a
  // drawing that has notes of its own -- opening it shows those.
  //
  // ABOUT FIVE PAGES: 15,000 characters, roughly 250 lines of the pad. The
  // textarea's maxlength stops typing and cuts a paste at the line, and the
  // head says how much is left before it does.
  // THE PAD'S SIZE, pulled out by its grab spots: as far as the right half of
  // the page across, and from under the instrument strip down to the foot
  // bar. It is the drafter's way of looking, so it lives in this browser,
  // and it is the NOTES pane's only -- LEVELS / LAYERS keeps the rail's own.
  var notesSize = null;
  try { notesSize = JSON.parse(localStorage.getItem('draft.notepad.size') || 'null'); } catch (e) { notesSize = null; }
  function applyNotesSize(rail, pane) {
    const on = pane === 'notes' && notesSize;
    rail.style.width = on && notesSize.w ? `${notesSize.w}px` : '';
    rail.style.top = on && notesSize.top != null ? `${notesSize.top}px` : '';
    rail.style.bottom = on && notesSize.bottom != null ? `${notesSize.bottom}px` : '';
  }
  document.querySelectorAll('[data-notes-grip]').forEach(grip => {
    grip.addEventListener('pointerdown', e => {
      e.preventDefault();
      e.stopPropagation();
      const rail = document.getElementById('right-rail');
      const box = rail.getBoundingClientRect();
      const css = getComputedStyle(rail);
      const right = parseFloat(css.right) || 0;
      const topMin = (document.getElementById('strip')?.getBoundingClientRect().bottom || 44) + 4;
      const stripEl = document.getElementById('house-strip');
      const bottomMin = stripEl ? window.innerHeight - stripEl.getBoundingClientRect().top + 4 : 8;
      const start = { x: e.clientX, y: e.clientY, w: box.width, top: box.top, bottom: window.innerHeight - box.bottom };
      const minW = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--rail-w')) || box.width;
      const maxW = Math.max(minW, window.innerWidth / 2 - right);
      grip.setPointerCapture(e.pointerId);
      const move = ev => {
        const size = { ...(notesSize || {}) };
        if (grip.dataset.notesGrip === 'left') {
          size.w = Math.round(Math.max(Math.min(start.w, minW), Math.min(maxW, start.w + (start.x - ev.clientX))));
        } else if (grip.dataset.notesGrip === 'top') {
          size.top = Math.round(Math.max(topMin, Math.min(window.innerHeight - start.bottom - 120, start.top + ev.clientY - start.y)));
        } else {
          size.bottom = Math.round(Math.max(bottomMin, Math.min(window.innerHeight - start.top - 120, start.bottom - (ev.clientY - start.y))));
        }
        notesSize = size;
        applyNotesSize(rail, 'notes');
      };
      const up = () => {
        grip.removeEventListener('pointermove', move);
        grip.removeEventListener('pointerup', up);
        try { localStorage.setItem('draft.notepad.size', JSON.stringify(notesSize)); } catch (err) {}
      };
      grip.addEventListener('pointermove', move);
      grip.addEventListener('pointerup', up);
    });
  });
  const NOTES_MAX = 15000;
  const NOTES_KEY = 'draft.notepad';
  const notesText = document.querySelector('[data-notes-text]');
  const notesCount = document.querySelector('[data-notes-count]');
  notesText.maxLength = NOTES_MAX;
  const notesStored = () => {
    try { return localStorage.getItem(NOTES_KEY) || ''; } catch { return ''; }
  };
  const storeNotes = text => {
    try {
      if (text) localStorage.setItem(NOTES_KEY, text);
      else localStorage.removeItem(NOTES_KEY);
    } catch { /* private window: the .draft still carries them */ }
  };
  const syncNotesCount = () => {
    const used = notesText.value.length;
    const pages = Math.max(1, Math.ceil(used / (NOTES_MAX / 5)));
    notesCount.textContent = used >= NOTES_MAX ? 'PAD FULL' : `PAGE ${pages} OF 5`;
    notesCount.toggleAttribute('data-full', used >= NOTES_MAX);
  };
  const showNotes = text => {
    notesText.value = String(text).slice(0, NOTES_MAX);
    syncNotesCount();
  };
  // ON THE DRAWING ONLY WHEN THERE IS SOMETHING TO SAY: a drawing opened and
  // saved with an empty pad comes back key for key.
  const notesOntoDrawing = text => {
    if (!drawing) return;
    if (text) drawing.notepad = text;
    else delete drawing.notepad;
  };
  // Called by adoptFile once the drawing is built -- open, NEW and a re-read
  // all come through there.
  const adoptNotes = () => {
    const own = typeof drawing?.notepad === 'string' ? drawing.notepad.slice(0, NOTES_MAX) : '';
    if (own) { showNotes(own); storeNotes(own); }
    notesOntoDrawing(notesText.value);
  };
  showNotes(notesStored());
  // RIGHT UNDER LEVELS / LAYERS, wherever that tab's word ends. The stylesheet
  // can only place it under the tab's 32vh CAP, which left a hand's width of
  // empty edge between the two at every window height.
  const notesTab = document.getElementById('notes-tab');
  const historyTab = document.getElementById('history-tab');
  const seatNotesTab = () => {
    const above = document.getElementById('right-tab').getBoundingClientRect();
    if (above.height) notesTab.style.top = `${Math.round(above.bottom + 8)}px`;
    // AND UNDO / REDO UNDER THAT (Movie, 20 Oct), the same way.
    const notes = notesTab.getBoundingClientRect();
    if (historyTab && notes.height) historyTab.style.top = `${Math.round(notes.bottom + 8)}px`;
  };
  // AND AGAIN WHEN THAT TAB CHANGES SIZE -- the webfont landing after the
  // first seat makes its word a few pixels longer.
  window.addEventListener('resize', seatNotesTab);
  if (window.ResizeObserver) {
    new ResizeObserver(seatNotesTab).observe(document.getElementById('right-tab'));
    new ResizeObserver(seatNotesTab).observe(notesTab);
  }
  notesText.addEventListener('input', () => {
    syncNotesCount();
    storeNotes(notesText.value);
    if (!drawing) return;
    const was = drawing.notepad || '';
    notesOntoDrawing(notesText.value);
    if ((drawing.notepad || '') !== was) markDirty();
  });
  // CLEAR ASKS FIRST, so one stray press cannot wipe five pages.
  document.querySelector('[data-notes-clear]').addEventListener('click', () => {
    if (!notesText.value) return;
    if (!window.confirm('Clear all notes?')) return;
    showNotes('');
    storeNotes('');
    if (drawing && drawing.notepad !== undefined) { notesOntoDrawing(''); markDirty(); }
  });

  // ── THE CALCULATOR, THE PAD'S OTHER TAB (Movie, 18 Oct: "a construction
  // calculator tab under the notebook tab ... metric and ft and do area" --
  // "need areas for sure"). ──────────────────────────────────────────────
  //
  // Typed or keyed, a line is worked as it is written and its answer shown
  // under it; = (or ENTER) puts the line on the tape. A tape line clicked
  // brings its answer back to work on. -> NOTES writes the line and its
  // answer onto the pad. The tape and FT-IN / METRIC are kept per browser.
  const padTabs = [...document.querySelectorAll('[data-pad-tab]')];
  const calcBox = document.querySelector('[data-calc]');
  const calcLine = document.querySelector('[data-calc-line]');
  const calcAnswer = document.querySelector('[data-calc-answer]');
  const calcTape = document.querySelector('[data-calc-tape]');
  const CALC_KEY = 'draft.calc';
  const calcState = (() => {
    try { const v = JSON.parse(localStorage.getItem(CALC_KEY) || '{}');
      return { tape: Array.isArray(v.tape) ? v.tape.slice(-60) : [], metric: v.metric === true }; }
    catch { return { tape: [], metric: false }; }
  })();
  const keepCalc = () => { try { localStorage.setItem(CALC_KEY, JSON.stringify(calcState)); } catch { /* this tab only */ } };
  const showPad = which => {
    padTabs.forEach(b => b.setAttribute('aria-selected', String(b.dataset.padTab === which)));
    notesText.hidden = which !== 'notes';
    calcBox.hidden = which !== 'calc';
    notesCount.hidden = which !== 'notes';
    document.querySelectorAll('[data-notes-save-txt], [data-notes-clear]').forEach(b => { b.hidden = which !== 'notes'; });
    if (which === 'calc') calcLine.focus();
  };
  padTabs.forEach(b => b.addEventListener('click', () => showPad(b.dataset.padTab)));
  const calcWork = () => window.DraftCalc.work(calcLine.value, { metric: calcState.metric });
  const showAnswer = () => {
    calcAnswer.textContent = '';
    calcAnswer.removeAttribute('data-bad');
    if (!calcLine.value.trim()) return null;
    const r = calcWork();
    if (!r.ok) { calcAnswer.textContent = r.why; calcAnswer.setAttribute('data-bad', ''); return r; }
    calcAnswer.append(r.main);
    if (r.alt.length) { const sm = document.createElement('small'); sm.textContent = r.alt.join('   '); calcAnswer.append(sm); }
    return r;
  };
  const drawTape = () => {
    calcTape.textContent = '';
    calcState.tape.forEach(row => {
      const div = document.createElement('div');
      div.className = 'calc-row';
      div.dataset.calcRow = '';
      const ex = document.createElement('span'); ex.className = 'ex'; ex.textContent = row.line;
      const an = document.createElement('span'); an.className = 'an'; an.textContent = row.main;
      div.append(ex, an);
      div.title = 'Work on from this answer';
      div.addEventListener('click', () => { calcLine.value = row.reuse || row.main; showAnswer(); calcLine.focus(); });
      calcTape.append(div);
    });
    calcTape.scrollTop = calcTape.scrollHeight;
  };
  // An answer as a line the calculator reads back: feet-inches as written,
  // an area in sq ft (or sq m), a plain number as it is.
  const reusable = r => (r.dim === 2 ? (calcState.metric ? `${(r.v / (window.DraftCalc.FT_PER_M ** 2)).toFixed(4)} sqm`
    : `${r.v.toFixed(4)} sqft`) : r.dim === 1 ? window.DraftCalc.feetInches(r.v, 16).replace('-', ' ') : String(+r.v.toFixed(6)));
  const calcEquals = () => {
    const r = showAnswer();
    if (!r || !r.ok) return;
    calcState.tape.push({ line: calcLine.value.trim(), main: r.main, reuse: reusable(r) });
    calcState.tape = calcState.tape.slice(-60);
    keepCalc();
    drawTape();
    calcLine.value = reusable(r);
    calcLine.select();
  };
  const unitsButton = document.querySelector('[data-calc-do="units"]');
  const syncUnits = () => { unitsButton.textContent = calcState.metric ? 'METRIC' : 'FT-IN'; };
  document.querySelectorAll('[data-calc-key]').forEach(b => b.addEventListener('click', () => {
    const at = calcLine.selectionStart ?? calcLine.value.length, to = calcLine.selectionEnd ?? at;
    calcLine.value = calcLine.value.slice(0, at) + b.dataset.calcKey + calcLine.value.slice(to);
    const caret = at + b.dataset.calcKey.length;
    calcLine.focus();
    calcLine.setSelectionRange(caret, caret);
    showAnswer();
  }));
  document.querySelectorAll('[data-calc-do]').forEach(b => b.addEventListener('click', () => {
    const what = b.dataset.calcDo;
    if (what === 'equals') calcEquals();
    else if (what === 'clear') { calcLine.value = ''; showAnswer(); }
    else if (what === 'back') { calcLine.value = calcLine.value.replace(/\s*\S\s*$/, ''); showAnswer(); }
    else if (what === 'units') { calcState.metric = !calcState.metric; keepCalc(); syncUnits(); showAnswer(); }
    else if (what === 'notes') {
      const r = showAnswer();
      if (!r || !r.ok) return;
      const line = `${calcLine.value.trim()} = ${r.main}`;
      const text = notesText.value ? `${notesText.value.replace(/\s*$/, '')}\n${line}` : line;
      showNotes(text);
      storeNotes(notesText.value);
      if (drawing) { notesOntoDrawing(notesText.value); markDirty(); }
      sayOnStrip(`On the NOTES pad: ${line}`);
    }
    if (what !== 'notes') calcLine.focus();
  }));
  calcLine.addEventListener('input', showAnswer);
  // THE PAGE'S KEYS STAY OFF THIS LINE: a D typed here is a D, not DIMENSION.
  calcLine.addEventListener('keydown', e => {
    e.stopPropagation();
    if (e.key === 'Enter') { e.preventDefault(); calcEquals(); }
    if (e.key === 'Escape') { calcLine.blur(); }
  });
  syncUnits();
  drawTape();

  // ── AND THE SAME TWO FACTS ON THE LEFT ──────────────────────────────────
  //
  // `left` still says OPEN or SHUT by itself and `lpane` says WHICH, exactly
  // as `right` and `pane` divide the work -- so every check written against
  // `?left=1` keeps the meaning it had before the column came apart.
  //
  // DRAFTING IS THE DEFAULT because it is where a drafter starts: Select is
  // the resting tool, and its keys are on that tab. An unknown or hand-typed
  // value falls back to it rather than to a blank rail.
  const LEFT_PANES = ['drafting', 'build'];
  const leftPane = id => document.querySelector(`[data-left-pane="${id}"]`);

  // ── PROPERTIES IS NOT THE THIRD OF THREE ────────────────────────────────
  //
  // Movie, 29 Sep: "i'd like to be able to have the properties tab open while
  // either of the other ones are open, but the other 2 don't need to open at
  // the same time".
  //
  // WHICH SETTLES SOMETHING THREE TAKING TURNS COULD NOT. Every panel opens on
  // PROPERTIES -- also his ruling -- and a tool's own controls are among them,
  // so with three tabs taking turns, arming FENESTRATION put DOOR / WINDOW one
  // press away from the key that raised it, every single time. Standing
  // PROPERTIES open BESIDE the tool tab puts those controls back under the key
  // without moving them out of the box they belong in.
  //
  // SO THERE ARE TWO FACTS HERE, NOT ONE: which TOOL tab is up, and whether
  // PROPERTIES is standing with it. DRAFTING and BUILD take turns because
  // their keys are what the rail is for, and 691px of them in one column is
  // what put this page over a 768 fold. PROPERTIES is what you are working ON,
  // and its box already hides itself when there is nothing in hand.
  //
  // DEFAULT OPEN, and `lprops=0` is the only value that means anything -- the
  // same absent-means-open spelling the fold below uses, for the same reason:
  // a drafter who has just pressed a wall wants to see what he pressed.
  //
  // AND NOW ALWAYS ON (Movie, 25 Oct: "keep the properties at the bottom of
  // the BUILD and DRAFT areas when the user is there, but just leave them ON
  // ... and we won't need the left side PROPERTIES tab"): its tab is gone,
  // so nothing can put it down, and an old `lprops=0` link means nothing.
  const propsShowing = () => true;

  // WHICH TAB EACH BLOCK LIVES ON, AS A TABLE. Movie, 29 Sep: "i may want to
  // move the properties back in to DRAFT and BUILD depending on what they are
  // properties for". This is that, and it is a table precisely so the answer
  // can change without four builders and six `ModelProps.set` call sites
  // having to agree about it -- moving a block is an edit here, not a hunt.
  //
  // THE DIVISION IS WHAT THE BLOCK IS FOR, not what it looks like. SELECTION
  // and OBJECT TYPE modify what Select grabs and ASSEMBLY acts on what Select
  // got, so all three are DRAFTING; the fixture palettes are the catalogue the
  // FIXTURE tool places from, so they are BUILD.
  const BLOCK_PANE = Object.freeze({
    draw: 'drafting',
    selection: 'drafting',
    assembly: 'drafting',
    build: 'build',
    fixtures: 'build',
  });
  const paneForBlock = id => BLOCK_PANE[id] || 'properties';


  const leftPaneShowing = () =>
    LEFT_PANES.includes(params.get('lpane')) ? params.get('lpane') : 'drafting';
  const setLeftPane = pane => {
    // PROPERTIES IS NOT ONE OF THE TURNS. It has its own flag and its own
    // toggle, so a press on its tab must never be read as "which tool tab",
    // which would otherwise swap DRAFTING out from under the drafter.
    // It has no tab now; asked for, it is the rail that opens.
    if (pane === 'properties') { if (!railOpen('left')) setRail('left', true); return; }
    // Pressing the tool tab that is already up SHUTS the rail, and pressing
    // the other swaps without shutting. Identical to the right edge, and
    // deliberately so: one gesture for both edges is one thing to learn.
    if (pane === leftPaneShowing() && railOpen('left')) { setRail('left', false); return; }
    params.set('lpane', pane);
    if (!railOpen('left')) { setRail('left', true); return; }
    syncUrl();
    syncShell();
    paint();
  };

  const syncShell = () => {
    const leftOpen = railOpen('left');
    const leftPanel = document.getElementById('left-rail');
    leftPanel.hidden = !leftOpen;
    const lpane = leftPaneShowing();
    const propsUp = propsShowing();
    leftPanel.dataset.leftPaneShowing = lpane;
    // THE TOOL PANES TAKE TURNS; PROPERTIES ANSWERS TO ITS OWN FLAG. One walk
    // over all three rather than two, so there is a single place that decides
    // what is on the rail and no chance of a pane nobody hid.
    leftPanel.querySelectorAll('[data-left-pane]').forEach(el => {
      el.hidden = el.dataset.leftPane === 'properties'
        ? !propsUp : el.dataset.leftPane !== lpane;
    });
    [...document.querySelectorAll('.rail-tab[data-left-pane-tab]')].forEach(tab => {
      tab.hidden = false;
      const up = tab.dataset.leftPaneTab === 'properties'
        ? propsUp : tab.dataset.leftPaneTab === lpane;
      tab.setAttribute('aria-expanded', String(leftOpen && up));
      tab.setAttribute('aria-selected', String(up));
    });

    const rightOpen = railOpen('right');
    const rightPanel = document.getElementById('right-rail');
    // The stylesheet owns the shut face: `[data-collapsed]` displays nothing,
    // and the edge tabs are the whole collapsed state.
    rightPanel.hidden = false;
    rightPanel.toggleAttribute('data-collapsed', !rightOpen);
    const pane = paneShowing();
    rightPanel.dataset.paneShowing = pane;
    applyNotesSize(rightPanel, pane);
    rightPanel.querySelectorAll('[data-pane]').forEach(el => {
      el.hidden = el.dataset.pane !== pane;
    });
    [...document.querySelectorAll('.rail-tab[data-pane-tab]')].forEach(tab => {
      tab.hidden = false;
      tab.setAttribute('aria-expanded',
        String(rightOpen && tab.dataset.paneTab === pane));
      tab.setAttribute('aria-selected', String(tab.dataset.paneTab === pane));
    });
    seatNotesTab();
  };

  // `#left-tab` IS A PANE TAB NOW, not the rail's on/off switch, so it goes
  // through the same listener as the other two rather than keeping a
  // `setRail` of its own. Pressing it with DRAFTING already up still shuts
  // the rail -- `setLeftPane` does that -- so the gesture every existing spec
  // drives is unchanged; what moved is which function decides it.
  [...document.querySelectorAll('.rail-tab[data-left-pane-tab]')].forEach(tab => {
    tab.addEventListener('click', () => setLeftPane(tab.dataset.leftPaneTab));
  });
  [...document.querySelectorAll('.rail-tab[data-pane-tab]')].forEach(tab => {
    tab.addEventListener('click', () => setPane(tab.dataset.paneTab));
  });

  // ── the build bar, and the seam behind it ─────────────────────────────────
  // THE BUTTON SAYS WHICH HOUSE. SOMETHING ELSE BUILDS IT.
  //
  // That split is the whole point of this bar and it is Devin's instruction,
  // not a convenience: the drafter is moving to a premade design per house
  // type in place of generated rooms, so whatever produces geometry today is
  // being replaced. Wire the buttons to it and the bar is built twice.
  //
  // WHAT THIS SIDE OWNS: which family is open, which entry was pressed, and
  // writing the chosen `buildType` to the drawing -- that key IS the persisted
  // vocabulary for this question (drawing-format.js BUILD_TYPES), normalised
  // through the format exactly as MODEL.dc.html normalises it at :14159.
  //
  // WHAT IT DOES NOT OWN: a single foot of geometry. No outline, no rooms, no
  // walls. If this code ever decides where a bedroom goes, it has crossed the
  // seam and should be deleted back to here.
  //
  // BOTH HALVES OF THE OLD PAGE'S ARMING ARRIVE NOW. _pressBuildType does two
  // things: it records the type AND arms the outline tool so the next press
  // starts tracing the house (:14156). The second half was left behind while
  // this page had no outline tool to arm -- "the tracing waits for whoever
  // builds that tool" -- and it now waits no longer: the geometry side takes
  // the choose seam below and arms its trace. This bar still records the type
  // and nothing else; which is the whole point of the seam.
  //
  // THE SEAM, for whoever writes the geometry side:
  //
  //   window.ModelBuild.onChoose(fn)   fn({ family, entry }) when a house type
  //                                    is picked. entry carries type, garage,
  //                                    overGarage, foundation -- the old
  //                                    page's own vocabulary, from the same
  //                                    build-menu.js.
  //   window.ModelBuild.onBuild(fn)    fn({ family, entry }) when the FOOT's
  //                                    bone is pressed. This is "build what
  //                                    the drafter drew" -- his own outline,
  //                                    with the chosen type as context.
  //   window.ModelBuild.onOrder(fn)    fn({ family, entry, round }) when the
  //                                    SIGN's bone is pressed. round 'menu'
  //                                    means "build the premade design for
  //                                    the type I picked"; round 'outline'
  //                                    means "walk me through drawing that
  //                                    type myself" -- the sign was called
  //                                    up by OUTLINE rather than the house.
  //   window.ModelBuild.chosen()       the current choice, or null.
  //   window.ModelBuild.orderServed()  the geometry side says an order was
  //                                    BUILT. The choice is spent -- a tile
  //                                    that stayed pressed after its garage
  //                                    landed made the next foot-bone press
  //                                    a re-build instead of a menu.
  //
  // TWO BONES, TWO VERBS (Movie, 15 Sep): "the bone on the drivethru menu
  // will auto build the house that is provided for their selection... the
  // bone on the screen will be for if they draw their own OUTLINE". They
  // wear the same artwork because they produce the same kind of thing, but
  // one reads a catalogue and one reads the drafter's lines. Wired to one
  // seam, the premade designs would build themselves under a drafter who
  // had drawn his own walls and pressed the bone beneath them.
  //
  // BONE FIRES EVEN WITH NOTHING CHOSEN, with entry null. That is deliberate:
  // "the bone builds it" is the old page's phrase and on a drawing that
  // already has a type the drafter has chosen nothing this session. Deciding
  // what an empty press means is the geometry side's call, not the bar's.
  const BM = window.DraftBuildMenu;
  const buildBar = document.getElementById('build-bar');
  const familyRow = document.getElementById('build-families');
  const entryRow = document.getElementById('build-entries');
  let openFamilyId = null;
  // THE CARDS ARE KEYED BY MENU ID, not by position in a list. Movie drew
  // five -- 1 STOREY, 2 STOREY, BILEVEL, MODIFIED BILEVEL, DETACHED GARAGE --
  // and they hang off whichever tile carries that id, family or entry. A tile
  // with no card falls back to its lettering, so build-menu.js can grow an
  // entry before the art for it exists and nothing disappears off the board.
  //
  // THE SECOND PAGE IS BEING DRAWN NOW. Movie's five were the families and the
  // bare house types; the ENTRIES that add a garage had none and fell back to
  // lettering, so an open submenu read as half finished -- a card, two words, a
  // card. Both houses' second pages are fully drawn as of 24 Sep, and the
  // DETACHED GARAGE's followed the same day -- Movie, uploading three: "those
  // 3 are to replace for DETACHED GARAGE 2nd level".
  //
  // WHAT IS STILL LETTERING is one tile: a 1 STOREY of its own for the
  // bungalow ENTRY, which borrows the FAMILY's card, so that page opens
  // BUNGALOW where its own label reads 1 STOREY. One line here the day its art
  // lands, and until then the fallback keeps the tile on the board.
  //
  // THE EXTENSIONS ARE NOT UNIFORM and are written out rather than derived:
  // two of the three are .jpeg and the thickened edge is .jpg, as uploaded. A
  // rule that built these paths from the id would be one typo away from a
  // silently lettered tile, which is exactly the failure the fallback hides.
  const CARD_ART = Object.freeze({
    bungalow: './assets/house-bungalow.png',
    'bungalow-garage': './assets/house-bungalow-garage.png',
    twoStorey: './assets/house-twoStorey.png',
    'twoStorey-garage': './assets/house-twoStorey-garage.png',
    'twoStorey-over': './assets/house-twoStorey-over.png',
    bilevel: './assets/house-bilevel.png',
    'bilevel-garage': './assets/house-bilevel-garage.png',
    modifiedBilevel: './assets/house-modifiedBilevel.png',
    detachedGarage: './assets/house-detachedGarage.png',
    'detached-thickened': './assets/garagethickenedge.jpg',
    'detached-gradebeam': './assets/garagegradebeam.jpeg',
    'detached-frostwall': './assets/garagefrostwall.jpeg',
  });

  // WHAT AN ENTRY WEARS WHEN ITS ID IS ALSO A FAMILY'S. Checked first for a
  // tile on the second level and ignored everywhere else, so the table stays
  // the list of collisions rather than a second copy of the board.
  const ENTRY_ART = Object.freeze({
    bungalow: './assets/1storey.png',
  });

  // The card if there is one, the words if there is not. Either way the
  // label is the button's text, which is what every check reads and what a
  // screen reader says.
  const dressTile = (button, id, label, scope) => {
    // ONE ID IS TWO TILES, and only here does that bite. `bungalow` is the
    // FAMILY and also its first ENTRY, so a single table cannot hand them
    // different cards -- which is why the submenu opened a card reading
    // BUNGALOW under a label reading 1 STOREY. Movie, 24 Sep: "the 2nd lvl
    // down should say 1 STOREY - (not BUNGALOW)", and "one on top should stay
    // BUNGALOW".
    //
    // THE SCOPE IS ASKED FOR RATHER THAN GUESSED. Reading the id and hoping
    // would work until the next family shares a name with one of its entries,
    // and the tell would again be a card quietly disagreeing with the words
    // under it -- which nothing fails on and nobody notices for weeks.
    const art = (scope === 'entry' && ENTRY_ART[id]) || CARD_ART[id];
    if (!art) { button.textContent = label; return; }
    const card = document.createElement('img');
    card.src = art;
    card.alt = '';
    const said = document.createElement('span');
    said.className = 'said';
    said.textContent = label;
    button.replaceChildren(card, said);
    button.classList.add('card');
  };
  const chooseHandlers = [];
  const buildHandlers = [];
  const orderHandlers = [];
  const outlineHandlers = [];
  let chosenEntryId = null;
  // 'menu' or 'outline' -- which button called the sign up, and so what the
  // bone on the post will mean when it is pressed.
  let round = 'menu';

  const chosen = () => {
    if (!chosenEntryId) return null;
    const entry = BM.entryById(chosenEntryId);
    if (!entry) return null;
    const family = BM.BUILD_MENU
      .find(f => f.entries.some(e => e.id === chosenEntryId)) || null;
    return { family, entry };
  };

  // AN ORDER THAT WAS SERVED IS SPENT. Only the geometry side knows the
  // build landed, so it says so through the seam rather than this side
  // guessing from the sign shutting -- a drafter who opens the board to
  // look and shuts it again keeps his choice; a drafter whose garage was
  // built has been answered, and the tile un-presses. The persisted
  // buildType stays: the FILE remembers what the project is; the menu
  // only remembers the question currently being asked.
  // ── WHAT A BUILD COSTS (board #261) ──────────────────────────────────
  //
  // A BUILD IS A BUILD, whichever door it came through. This page raises a
  // building from TWO presses -- the foot's bone, which builds what the
  // drafter drew, and the sign's bone, which builds the premade design --
  // and the geometry side says so through two different words, buildServed
  // and orderServed. A toll written at one press would be free at the other,
  // which is exactly the shape of the defect Movie is already living with on
  // the same button. So the CHARGE hangs off both served-signals and the
  // REFUSAL off both presses, and both are these three lines rather than
  // four copies of them.
  //
  // A DETACHED GARAGE COSTS A BONE TOO -- MOVIE'S RULING, 19 Sep, asked for
  // and given: "sure every produced home or garage is 1 bone now (these will
  // change and be applied to other stuff later)". MODEL.dc.html charges only
  // COSTS.buildHouse because a house is all it builds; here a garage is an
  // order the geometry side serves like any other, and making it free would
  // have the wallet report what KIND of thing was built rather than that
  // something was.
  //
  // AND THE PRICE LIST IS EXPECTED TO GROW, which is why nothing here knows
  // a number: the cost is COSTS.buildHouse out of bone-wallet.js, and the
  // day a second thing is charged for it joins that table rather than this
  // file. One produced body, one bone, is the rule as it stands.
  const canAffordBuild = () => {
    const W = window.DraftBoneWallet;
    return !W || readWallet().balance >= W.COSTS.buildHouse;
  };
  const refuseForBones = () => {
    signRefusal = {
      line: 'OUT OF BONES.',
      note: `The next free one lands in ${waitLabel(readWallet().nextDripMs)}.`,
    };
    refreshWallet();
  };
  const chargeForBuild = () => {
    const W = window.DraftBoneWallet;
    if (!W) return;
    W.spend(W.COSTS.buildHouse);
    refreshWallet();
  };

  const orderServed = () => {
    // PAID ON DELIVERY, and this is the word the geometry side says when it
    // has actually raised the order -- not when the press happened.
    chargeForBuild();
    // AND THE SAME WORD STARTS THE SHOW. Board #283 says "every bone press
    // that grows the house", and this is the one place that means a house
    // was actually grown -- a press that refused, or one the wallet turned
    // away, never reaches here. It now starts in the BONEYARD: see
    // presentBuild.
    presentBuild();
    chosenEntryId = null;
    chosenSizeId = null;
    openFamilyId = null;
    syncBuildBar();
  };

  window.ModelBuild = Object.freeze({
    chosen,
    orderServed,
    onChoose: fn => { if (typeof fn === 'function') chooseHandlers.push(fn); },
    onBuild: fn => { if (typeof fn === 'function') buildHandlers.push(fn); },
    // The geometry side's word that the FOOT's bone raised something. See
    // fireBuild: said out loud rather than inferred from a return value.
    buildServed: () => { buildWasServed = true; },
    // THE BONE'S BUILD, pressed by the page itself: a traced house goes up
    // the moment its last loop closes. The same toll and the same handlers.
    build: () => fireBuild(),
    onOrder: fn => { if (typeof fn === 'function') orderHandlers.push(fn); },
    // CLICK HERE to draw house OUTLINE: the geometry side arms the trace.
    onOutline: fn => { if (typeof fn === 'function') outlineHandlers.push(fn); },
  });

  // HOW BIG, for the entries that ask (the detached garage, and only it).
  // A stock id, 'custom', or null for not answered yet. The typed pair
  // lives in the fields themselves rather than being mirrored here: two
  // places holding one number is how they come to disagree.
  let chosenSizeId = null;
  const sizeRow = document.getElementById('build-sizes');
  const sizeStock = document.getElementById('size-stock');
  const sizeCustom = document.getElementById('size-custom');
  const sizeWidth = document.getElementById('size-w');
  const sizeDepth = document.getElementById('size-d');

  // WHETHER THE BOARD ASKS HOW BIG. Movie, 24 Sep: "don't offer a size for
  // now ... for the Drive Thru Menu", with 24x26 as the answer instead.
  //
  // A SWITCH RATHER THAN A DELETION, because "for now" is his word. The size
  // row, the three stock tiles, the typed fourth option and the refusal that
  // guards it are all left standing and all still correct -- they are simply
  // not put to the drafter.
  //
  // AND ?sizes=ask TURNS IT BACK ON, which is not a test hook bolted to the
  // side: five checks in model-drivethru.spec.js cover that question -- the
  // row's contents, a stock size reaching the seam, the typed pair's bounds,
  // a size not following the drafter onto his next press, and the foot bone
  // closing the order. Withdrawing the question without this would have meant
  // deleting all five and finding out the hard way, the day it came back,
  // which of them still held. They now ask for it and go on measuring it.
  //
  // THE PAGE ALREADY VARIES THIS WAY -- ?mode, ?theme, ?level, ?view, ?board
  // -- so a flag is the idiom here rather than an exception to it.
  //
  // needsSize STAYS TRUE ON THE ENTRIES, and that is deliberate: it is the
  // data fact that a garage HAS a size, which is a different statement from
  // whether the board asks for one. Several things read it -- among them the
  // one-building cap, which uses it to tell a press that raises a building
  // from one that hands over a trace -- and they all still want the true
  // answer.
  const ASKS_SIZE = new URLSearchParams(location.search).get('sizes') === 'ask';

  // THE SIZE THE ORDER WOULD CARRY, or null if the entry has no size at all.
  // A typed pair that is blank or out of bounds is NOT a size -- the bone
  // refuses rather than building a garage nobody asked for.
  const chosenSize = () => {
    if (!chosen()?.entry?.needsSize) return null;
    // UNASKED IS NOT UNANSWERED -- BUT ASKED AND UNPRESSED STILL IS. When the
    // board does not put the question (see ASKS_SIZE), "nothing pressed" is
    // the normal case rather than an open one, and the default is what the
    // order carries; a null there would put the bone back to refusing HOW
    // BIG, THOUGH? for a question nobody was shown.
    //
    // WHEN IT DOES ASK, the same silence means the opposite and has to keep
    // meaning it: the question is open, the bone refuses, and Gruff says so.
    // Defaulting in both cases made the sign answer a question it had just
    // asked -- "ONE 24' x 26' THICKENED EDGE. GOOD CHOICE." over an untouched
    // size row -- which is what the two checks under ?sizes=ask caught.
    // AND WHICH DEFAULT DEPENDS ON THE FOUNDATION, because a frost wall or a
    // grade beam arrives two storeys (13 Oct) and that garage has a stair and
    // a man door leading to it -- it needs a door wall that can hold them.
    // build-menu.js owns which id that is; this only has to hand it the
    // foundation the tile was pressed for.
    if (!chosenSizeId) {
      return ASKS_SIZE ? null : BM.garageDefaultSizeFor(chosen()?.entry?.foundation);
    }
    if (chosenSizeId !== 'custom') return BM.garageSizeById(chosenSizeId);
    return BM.customGarageSize(sizeWidth.value, sizeDepth.value);
  };

  // THE TYPE REACHES THE FILE; garage, overGarage and foundation do not.
  // build-menu.js says why in Movie's own words: a garage is an outline
  // carrying garage:true, so storing one would put a claim in the file that
  // its own geometry could contradict.
  //
  // IT IS A FUNCTION BECAUSE IT HAS TWO CALLERS, and the second is easy to
  // miss: the press stamps whichever drawing was open at the time, so a build
  // that opens a CLEAN file has to stamp again or the new file carries no
  // type at all. Nothing reads buildType during a build, which is exactly why
  // that would have gone unnoticed -- the house would rise correctly into a
  // file that had forgotten what it was.
  const stampBuildType = () => {
    const type = chosen()?.entry?.type ?? null;
    if (drawing && type && drawing.buildType !== type) {
      drawing.buildType = window.DraftDrawingFormat.buildType(type);
      markDirty();
    }
  };

  const pressEntry = entryId => {
    // A NEW ENTRY IS A NEW QUESTION. Carrying the last garage's size onto
    // the next press would build a 16x24 for a drafter who pressed a
    // different tile and never saw the size asked.
    if (entryId !== chosenEntryId) chosenSizeId = null;
    chosenEntryId = entryId;
    // THE PAGE DOES NOT TURN UNDER THE PRESS. Movie, 24 Sep: "after they make
    // their choice on this page, don't change the page. just light up their
    // choice and make the bone glow and pulse the glow so they will click it".
    //
    // It used to shut the submenu here, so the board the drafter had just
    // pressed folded back to the three families and the thing they chose was
    // off screen -- the answer to "did that work?" being a different page.
    // The submenu stays open, the chosen tile keeps the glow it already wears,
    // and the bone starts asking for the press that finishes the order.
    const picked = chosen();
    stampBuildType();
    buildChrome();
    syncBuildBar();
    paint();
    chooseHandlers.forEach(fn => fn(picked));
  };

  // Set below, once the sign has its elements. Declared here because the
  // sign says what the menu is showing, so every redraw of the menu is a
  // redraw of the sign -- one call site, not four.
  let paintSign = () => {};

  const syncBuildBar = () => {
    if (!drawing) return;
    familyRow.replaceChildren(...BM.BUILD_MENU.map(family => {
      // A STACKED FAMILY SHOWS ITS TILES IN THE ROW ITSELF, close together in
      // one slot the ON GRADE pair's way -- the SUITE's two (Movie, 20 Oct).
      if (family.stack) {
        const stack = document.createElement('span');
        stack.className = 'dt-stack';
        stack.dataset.buildStack = family.id;
        stack.append(...family.entries.map(entry => {
          const button = document.createElement('button');
          button.type = 'button';
          button.dataset.buildEntry = entry.id;
          button.textContent = entry.label;
          button.title = family.title;
          button.classList.toggle('chosen', entry.id === chosenEntryId);
          button.onclick = () => { openFamilyId = null; pressEntry(entry.id); };
          return button;
        }));
        return stack;
      }
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.buildFamily = family.id;
      dressTile(button, family.id, family.label);
      button.title = family.title;
      button.classList.toggle('open', openFamilyId === family.id);
      // A family with the chosen entry under it wears the mark, so the bar
      // says what the drawing carries even with every submenu shut.
      const holds = family.entries.some(e => e.id === chosenEntryId);
      button.classList.toggle('chosen', holds && openFamilyId !== family.id);
      button.onclick = () => {
        openFamilyId = openFamilyId === family.id ? null : family.id;
        syncBuildBar();
      };
      return button;
    }));

    const open = openFamilyId ? BM.familyById(openFamilyId) : null;
    entryRow.hidden = !open;
    const tiles = open ? open.entries.map(entry => {
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.buildEntry = entry.id;
      dressTile(button, entry.id, entry.label, 'entry');
      button.classList.toggle('chosen', entry.id === chosenEntryId);
      button.onclick = () => pressEntry(entry.id);
      return button;
    }) : [];
    // Neighbouring tiles with no card go into one stacked slot (see the CSS).
    const slots = [];
    tiles.forEach(button => {
      const last = slots[slots.length - 1];
      if (button.classList.contains('card')) { slots.push(button); return; }
      if (last?.classList?.contains('dt-stack')) { last.append(button); return; }
      const prev = last && !last.classList.contains('card') ? slots.pop() : null;
      if (prev) {
        const stack = document.createElement('span');
        stack.className = 'dt-stack';
        stack.append(prev, button);
        slots.push(stack);
      } else slots.push(button);
    });
    entryRow.replaceChildren(...slots);

    // AND THE BONE SAYS IT IS READY. Pulsing means "this order can be
    // placed", not merely "something is chosen": a detached garage whose size
    // is still open would be refused by the bone, and a button begging for a
    // press that bounces is worse than a quiet one.
    const boneReady = Boolean(chosen())
      && (chosen().entry?.needsSize !== true || chosenSize() !== null);
    document.getElementById('dt-bone')?.toggleAttribute('data-ready', boneReady);
    // AND THE FOOT PRESS ASKS TOO. This reached only the SIGN's bone, so the
    // foot button never pulsed -- and on ROUGH there is no sign bone at all,
    // which left the drafter with a chosen house, a board full of tiles and
    // nothing on screen asking to be pressed. Movie, 24 Sep: "when the 'BONE'
    // is pulse glowing the 'HOUSE' should be 'pulse glowing' but doesn't so
    // user is confused if it doesn't do this".
    //
    // ONE ATTRIBUTE ON BOTH, because they are one question asked in two
    // places -- his own rule for these two buttons, 19 Sep: "the style is
    // different but the bone and house are the same button". What the pulse
    // LOOKS like differs per theme and is settled in shell-bars.css, where
    // the rest of this button's states already live.
    // LOOKED UP RATHER THAN CLOSED OVER, like the line above it: `boneFoot`
    // is declared 130 lines below this and would be in the temporal dead
    // zone if anything ever calls this during setup rather than on a press.
    document.getElementById('bone')?.toggleAttribute('data-ready', boneReady);

    // THE SIZE ROW BELONGS TO THE CHOSEN ENTRY, not to the open submenu:
    // it is the question that follows the press, so it stays up after the
    // submenu shuts and the drafter can still see what he answered.
    const asks = ASKS_SIZE && chosen()?.entry?.needsSize === true;
    sizeRow.hidden = !asks;
    if (asks) {
      sizeStock.replaceChildren(...BM.GARAGE_SIZES.map(size => {
        const button = document.createElement('button');
        button.type = 'button';
        button.dataset.buildSize = size.id;
        button.textContent = size.label;
        button.classList.toggle('chosen', size.id === chosenSizeId);
        button.onclick = () => { chosenSizeId = size.id; syncBuildBar(); };
        return button;
      }), (() => {
        // THE FOURTH IS NOT A SIZE, it is the fields. It presses like the
        // other three so the row reads as one question with four answers.
        const button = document.createElement('button');
        button.type = 'button';
        button.dataset.buildSize = 'custom';
        button.textContent = 'OTHER';
        button.classList.toggle('chosen', chosenSizeId === 'custom');
        button.onclick = () => {
          chosenSizeId = 'custom';
          syncBuildBar();
          sizeWidth.focus();
        };
        return button;
      })());
      sizeCustom.hidden = chosenSizeId !== 'custom';
    }

    buildBar.hidden = false;
    paintSign();
  };
  // A TYPED FIGURE REDRAWS THE SIGN AND NOTHING ELSE. Rebuilding the row on
  // every keystroke would take the field's focus away mid-number.
  [sizeWidth, sizeDepth].forEach(field =>
    field.addEventListener('input', () => paintSign()));

  // A HANDLER THAT BUILT SOMETHING SAYS SO, and fireBuild passes that word back
  // to the press. Without it the foot bone cannot tell "I raised the house"
  // from "nobody was listening": it falls through to NOTHING TO BUILD YET and
  // calls the board up, so a drafter who had just watched his walls appear
  // would get the drive-thru over the top of them.
  //
  // IT SAYS SO BY CALLING buildServed, NOT BY RETURNING SOMETHING. The first
  // version read the handlers' return values, and that is a trap: a handler
  // written for any other purpose reports a build by accident. The one in
  // model-drivethru.spec.js does exactly that -- `p => seen.push(p)` returns
  // the array's new LENGTH, which is truthy, so a spec that only wanted to
  // watch the seam silenced the board. Found by that test.
  //
  // So the word is deliberate, and it is the seam's own existing idiom:
  // orderServed already means "the geometry side BUILT it" (:4262) and this is
  // its twin for the foot's bone. Nothing incidental can say it by mistake.
  let buildWasServed = false;
  const fireBuild = () => {
    // A BUILD COSTS A BONE (board #261), AND THE TOLL IS HERE rather than in
    // the handlers. MODEL.dc.html checks the wallet inside its build method,
    // which is one place because it has one caller; this page fires the same
    // seam from the foot press, from the sign's own bone on the post, and
    // from anything that registers later. A check per caller is a rule with
    // as many copies as there are doors, and the door added next year is the
    // one that forgets. So: refused before any handler runs, and paid for
    // only if one of them actually served.
    if (!canAffordBuild()) { refuseForBones(); return false; }
    // The traced build's half of fireOrder's stamp, for the same reason.
    stampBuildType();
    buildWasServed = false;
    // EVERY handler is called, and the flag is read after -- never a short
    // circuit, which would silently skip whatever registered later.
    buildHandlers.forEach(fn => fn(chosen()));
    // PAID ON DELIVERY. A press the geometry side declined to serve -- no
    // type picked, nothing the design can make -- costs nothing, which is
    // what `buildWasServed` is already the page's word for.
    if (buildWasServed) chargeForBuild();
    return buildWasServed;
  };
  // THE ORDER CARRIES ITS ROUND: 'menu' means hand over the premade design
  // for this type, 'outline' means walk the drafter through drawing it.
  // AND ITS SIZE, when the entry asked for one. `size` is null on every
  // other order rather than absent, so the geometry side reads one shape.
  //
  // THE TYPE IS STAMPED AGAIN AT THE BUILD, not only at the tile. Movie, 4
  // Oct, on a MOD BILEVEL whose main roof stood at the room-over-garage's
  // plate, whose garage sill sat 1 1/2" under the house's and whose garage
  // wall ran up through the room's floor: the file had no buildType, so
  // every elevation stacked it as a plain 2 STOREY. The tile stamps the
  // drawing open WHEN IT IS PRESSED, and the choice outlives that drawing --
  // press MODIFIED BILEVEL, press NEW, press the bone, and the house rose
  // into a blank that was never told what it is. Stamping at the build
  // covers that and every other way the drawing can change under a choice.
  const fireOrder = () => {
    stampBuildType();
    const order = {
      ...(chosen() || { family: null, entry: null }), round, size: chosenSize(),
    };
    orderHandlers.forEach(fn => fn(order));
  };
  // The foot bone is wired under the sign, because an empty press is
  // answered by the sign and the sign does not exist yet up here.

  // ── GRUFF'S DRIVE-THRU SIGN ───────────────────────────────────────────
  // Movie, 15 Sep: the sign rises from the foot and covers the two presses
  // in the middle of the strip, carries its own bone, and "the dog on
  // screen will take them through the menu of home types".
  //
  // IT IS THE BUILD BAR WITH A FACE. The tiles are the same family and
  // entry chips, from the same build-menu.js, firing the same pressEntry --
  // so the seam is untouched: an order records a type and draws nothing,
  // and the bone fires the build handlers whether it is the one on the foot
  // or the one on the post. The premade design per house type attaches
  // there, and this knows nothing about geometry.
  //
  // WHAT GRUFF SAYS IS DERIVED, never stored: it reads the menu's own state
  // each paint, so a line that disagrees with the tiles cannot happen.
  const sign = document.getElementById('drivethru');
  const signLine = document.getElementById('dt-line');
  const signNote = document.getElementById('dt-note');
  // THE BONE IS THE ONE PRESS UNDER THE BOARD (Movie, 16 Sep: "remove the
  // two house buttons and keep the BONE button just go to the drivethru").
  // The house button and the OUTLINE button were two more ways to the same
  // window, so the bone inherits their whole job: it calls the sign up, it
  // wears the glow while the board rises, and it carries the aria-expanded
  // the reader listens for. The outline ROUND still exists in `round` --
  // what retired is its button, not its meaning.
  const boneFoot = document.getElementById('bone');

  // THE PRESS'S ARTWORK IS PART OF THE FINISH. Movie, 17 Sep: the bone
  // becomes a blue house on the ROUGH DRAFTER version. A theme was already
  // "mainly through logos and colors" (palette.js's own note) -- this is the
  // first logo to arrive, so it rides the same switch the colours do rather
  // than growing a second way to be on ROUGH.
  //
  // ONE ENTRY PER THEME, AND EVERY THEME HAS ONE, so a theme added to
  // DraftPalette.THEMES without an artwork is a missing key here rather than
  // a press that silently keeps the last theme's picture.
  //
  // BOTH PRESSES, FOUND BY ATTRIBUTE. The foot bar's bone and the one on the
  // sign's post are one verb wearing one artwork -- the stylesheet says so in
  // as many words -- and a query that named only #bone would have left the
  // sign showing a bone under a blue house on the bar.
  //
  // `lit` IS A SECOND FILE, NOT A FILTER, AND ONLY WHERE ONE WAS DRAWN. The
  // bone's glow is a brightness filter over one artwork; the house arrived as
  // an ON and an OFF pair, drawn that way, and a filter cannot invent the
  // neon its ON state has. So a theme that ships two files gets the swap and
  // one that ships a single file keeps the filter the stylesheet gives it.
  //
  // IT LIVES HERE, BESIDE THE PRESS, rather than with the skin switches lower
  // down. callSign lights the bone during module evaluation on the ?from=entry
  // path, and a `const` declared after that line is in its dead zone when that
  // runs -- so the page would have thrown on the one entry that most needs to
  // work, and only on that entry.
  //
  // `balanceTop` IS PART OF THE ARTWORK, not part of the wallet. The bone's
  // number sits low, in the red under the bone; the house's sits in the
  // middle of its outline. Same number, two pictures -- so the offset is
  // declared where the pictures are, and a third theme that ships a third
  // drawing says where its number goes in the same line it names its file.
  // 74% is MODEL.dc.html:558's own figure, carried rather than re-eyeballed.
  // THE TABLE IS THE BAR'S NOW, and this page reads it rather than holding
  // the second copy. It went out with shell-bars.js the moment PROJECT wore
  // the bone and came up RED on a ROUGH skin: the artwork swap lived here, so
  // the page that owned the table got the house and the page that did not got
  // a red bone on a blue board. A table with two homes is how this repo's
  // oldest bugs start.
  const BONE_ART = window.DraftShellBars.BONE_ART;
  // AND THE BOARD IS THE SECOND LOGO. The note above says a theme is "mainly
  // through logos and colors" and that the press was the first to arrive;
  // this is the second, so it rides the same switch rather than growing a
  // third way to be on ROUGH. One entry per theme, for the same reason.
  // WHETHER IT COVERS THE BONE IS A FACT ABOUT THE ART, so it is kept beside
  // the art rather than derived from the theme's name further down. The sign
  // rises over the foot and hides the bone -- the stylesheet has said so since
  // the strip was built -- and carries its own copy of the press on its post.
  // The sheet stops above the bar and leaves the bone standing, so there the
  // bone is not something to disable, it is the press the drafter uses.
  //
  // AND WHETHER THE DOG IS ON IT is the other fact about the art, and it is
  // one fact rather than two: Gruff's screen and Gruff's bone are both Gruff.
  // Movie, 17 Sep, on the sheet: "in the ROUGH version it isn't going to show
  // the dog", and "no dog will ask questions they will just see the
  // selections". The stylesheet hides #dt-screen and #dt-bone on rough; this
  // flag is what the SCRIPT reads for the same fact, and model-drivethru pins
  // the two together so they cannot drift apart.
  //
  // IT IS NOT DERIVABLE FROM coversBone, which is about where the board
  // stands rather than what is painted on it. A board could stop above the
  // bar and still carry a dog.
  const BOARD_ART = Object.freeze({
    ruff:  Object.freeze({ src: './assets/drivethru-menu-board.png', coversBone: true,  dog: true }),
    rough: Object.freeze({ src: './assets/draft-board.png',          coversBone: false, dog: false }),
  });
  const boardHasDog = () => (BOARD_ART[theme] || {}).dog === true;
  const signBoard = document.querySelector('[data-drivethru-board]');
  const paintSignBoard = () => {
    const art = BOARD_ART[theme];
    if (!art || !signBoard) {
      console.warn(`MODEL: no board artwork for theme "${theme}"; leaving it as it is.`);
      return;
    }
    const next = new URL(art.src, location.href).href;
    if (signBoard.src !== next) signBoard.src = next;
    // A THEME PRESSED WITH THE BOARD ALREADY UP changes who is covered, and
    // a bone left disabled under a sheet that is not on top of it is a press
    // the drafter can see and cannot use.
    boneFoot.disabled = !sign.hasAttribute('data-shut') && art.coversBone;
  };
  const bonePressArt = [...document.querySelectorAll('[data-bone-art]')];
  // THE SPOKEN NAME MOVES WITH THE PICTURE. One of the two images carries the
  // press's only label (the sign's), the other is decorative beside a visually
  // hidden span -- so an empty alt stays empty and a spoken one is rewritten.
  // A screen reader told "BONE" while the screen shows a house is the same
  // defect as the sign keeping the old artwork, one sense over.
  const boneSaid = document.querySelector('#bone .said');
  // THE ON STATE, FETCHED BEFORE IT IS WANTED. The glow lasts two seconds and
  // is the whole of the feedback; a file that starts downloading when the
  // press is hit shows an empty box for the part of it that matters.
  Object.values(BONE_ART).forEach(art => {
    if (art.lit) { const pre = new Image(); pre.src = art.lit; }
  });
  const paintBonePress = () => {
    const art = BONE_ART[theme];
    if (!art) {
      console.warn(`MODEL: no bone artwork for theme "${theme}"; leaving it as it is.`);
      return;
    }
    bonePressArt.forEach(img => {
      // THE PRESS'S OWN STATE, not a shared one: the foot bar's bone lights
      // and the sign's does not, and they are two buttons.
      const press = img.closest('button');
      const wanted = (art.lit && press && press.hasAttribute('data-lit'))
        ? art.lit : art.src;
      // ONLY ON A CHANGE. Assigning the src it already has is a no-op in
      // every browser this page is tested in, but this runs on every
      // NIGHT/DAY press and on both edges of the glow, and a needless
      // assignment is a needless decode.
      const next = new URL(wanted, location.href).href;
      if (img.src !== next) img.src = next;
      if (img.alt) img.alt = `${art.label} — build it`;
    });
    if (boneSaid) boneSaid.textContent = art.label;
    // The number follows the picture it is drawn on -- low in the red on the
    // bone, in the middle of the outline on the house.
    if (boneBalanceEl) boneBalanceEl.style.top = art.balanceTop;
  };

  // ── THE FREE-BONE WALLET (board #261) ─────────────────────────────────
  //
  // Movie, 19 Sep: "can you bring the BONE number / TOKEN system over too",
  // "bring it like it was in model.dc". MODEL.html did not load
  // bone-wallet.js at all, so the whole economy was missing here: builds
  // were free, the press said nothing about what it cost, and a drafter
  // moving between the two pages met two different rules.
  //
  // THE WALLET IS APP STATE, NEVER DRAWING STATE. It lives in localStorage
  // and belongs to the browser, not to the file -- so nothing here marks the
  // drawing dirty, and a build that spends a bone does not make the drawing
  // need saving for that reason.
  //
  // THE MODULE'S OWN HEADER CALLS IT AN HONOUR SYSTEM: localStorage, editable
  // with devtools, real enforcement waiting on the server ledger (#52). This
  // page inherits that and does not pretend otherwise.
  const boneBalanceEl = document.getElementById('bone-balance');
  const waitLabel = ms => {
    if (ms == null) return '';
    const minutes = Math.ceil(ms / 60000);
    return minutes <= 1 ? '<1m' : `${minutes}m`;
  };
  let walletShown = { balance: null, nextDripMs: null };
  const readWallet = () => (window.DraftBoneWallet
    ? window.DraftBoneWallet.read() : { balance: Infinity, nextDripMs: null });

  const paintWallet = () => {
    const W = window.DraftBoneWallet;
    if (!W || !boneBalanceEl) return;
    const { balance, nextDripMs } = walletShown;
    const broke = balance < 1;
    // AN EMPTY WALLET SHOWS THE COUNTDOWN, not a bare 0 -- the number on the
    // press is the answer to "can I build", and "no" is only half of it.
    boneBalanceEl.textContent = broke
      ? `0 \u00b7 ${waitLabel(nextDripMs)}` : String(balance);
    // THE DIGIT LADDER (MODEL.dc.html:23499), carried rather than re-derived:
    // sized for one digit and stepping down so even a five-digit paid wallet
    // never overflows the artwork.
    const chars = broke ? 8 : String(balance).length;
    boneBalanceEl.style.fontSize =
      `${chars <= 1 ? 15 : chars <= 3 ? 11 : chars <= 5 ? 8 : 7}px`;
    // THE SAME NUMBER ON THE SIGN'S PRESS (Movie, 16 Oct: "add the number to
    // the one in the RUFF Drive-thru version"): one wallet read, two places.
    // The sign's disc is drawn larger than the foot's, so the ladder is
    // scaled by the two presses' widths rather than copied.
    document.querySelectorAll('[data-dt-balance]').forEach(el => {
      el.textContent = boneBalanceEl.textContent;
      const press = el.closest('button');
      const scale = press && boneFoot && boneFoot.offsetWidth > 0
        ? Math.max(1, press.offsetWidth / boneFoot.offsetWidth) : 1;
      el.style.fontSize = `${Math.round(parseFloat(boneBalanceEl.style.fontSize) * scale)}px`;
    });
    boneFoot.toggleAttribute('data-broke', broke);
    boneFoot.title = broke
      ? `Out of bones \u2014 the next free bone lands in ${waitLabel(nextDripMs)}. `
        + `One drips in every hour, up to ${W.DRIP_CAP}.`
      : nextDripMs != null
        ? `${balance} bone${balance === 1 ? '' : 's'} \u00b7 next free bone in `
          + `${waitLabel(nextDripMs)}. Each BUILD costs 1.`
        : `${balance} bones \u2014 the free wallet is full. Each BUILD costs 1.`;
  };

  // REPAINTED ONLY ON A CHANGE, which is what makes the minute tick below
  // cheap enough to leave running: read() is a localStorage parse and a
  // little arithmetic, and the DOM is touched only when the answer moved.
  const refreshWallet = () => {
    if (!window.DraftBoneWallet) return;
    const now = readWallet();
    if (now.balance === walletShown.balance
      && now.nextDripMs === walletShown.nextDripMs) return;
    walletShown = { balance: now.balance, nextDripMs: now.nextDripMs };
    paintWallet();
  };
  refreshWallet();
  // ONE TICK A MINUTE, because the countdown on an empty press is in minutes
  // and a drip lands on the hour. Faster would redraw nothing; slower would
  // leave a bone in the wallet that the press says is not there.
  window.setInterval(refreshWallet, 60000);

  const signShut = () => sign.hasAttribute('data-shut');
  const outlinePresses = [...document.querySelectorAll('[data-drivethru-outline]')];
  const buildNowPresses = [...document.querySelectorAll('[data-drivethru-build-now]')];
  const projectGoPresses = [...document.querySelectorAll('[data-drivethru-project-go]')];
  const isGarageOrder = picked =>
    picked?.family?.id === 'detachedGarage' || Boolean(picked?.entry?.foundation);
  // THE SIGN GOES DOWN AND THE TRACE IS ARMED, with the type on it.
  outlinePresses.forEach(press => press.addEventListener('click', () => {
    const picked = chosen();
    if (!picked?.entry) return;
    round = 'outline';
    setSign(false);
    outlineHandlers.forEach(fn => fn(picked));
  }));

  // WHAT GRUFF SAYS WHEN HE IS REFUSING, set by the press that was refused
  // and spent by the next paint, so it cannot outlive the moment it explains.
  let signRefusal = null;

  paintSign = () => {
    const picked = chosen();
    // THE OUTLINE PRESS, offered once there is a type to draw and nothing
    // left to ask about it.
    const canTrace = !!picked?.entry && !(picked.entry.needsSize && !chosenSize());
    const kind = isGarageOrder(picked) ? 'garage' : 'house';
    const traceWords = `CLICK HERE to draw ${kind} OUTLINE`;
    // THE BANNERS SAY IT SHORT (Movie's own words on his drawing: DRAW HOUSE,
    // DRAW HOUSE OUTLINE); the text links keep the sentence.
    const banner = press => press.dataset.drivethruBanner;
    const arrow = press => banner(press) === 'arrow';
    outlinePresses.forEach(press => {
      press.hidden = !canTrace;
      if (arrow(press)) return;
      press.textContent = banner(press) ? `DRAW ${kind.toUpperCase()} OUTLINE` : traceWords;
    });
    // OFFERED BESIDE IT, on the same terms: a type with nothing left to ask.
    const buildWords = `PRESS TO DRAW ${kind.toUpperCase()} WITHOUT drawing OUTLINE`;
    buildNowPresses.forEach(press => {
      press.hidden = !canTrace;
      if (arrow(press)) return;
      press.textContent = banner(press) ? `DRAW ${kind.toUpperCase()}` : buildWords;
    });
    // AND THE ROW THEY STAND IN rises and goes with them.
    document.querySelectorAll('[data-drivethru-banners]').forEach(row => { row.hidden = !canTrace; });
    projectGoPresses.forEach(press => { press.hidden = !canTrace; });
    const open = openFamilyId ? BM.familyById(openFamilyId) : null;
    if (signRefusal) {
      signLine.textContent = signRefusal.line;
      signNote.textContent = signRefusal.note;
      signRefusal = null;
    } else if (picked?.entry?.needsSize && !chosenSize()) {
      // THE GARAGE IS ASKED HOW BIG BEFORE IT IS PROMISED. Saying "press
      // the bone and I'll build it" with the size still open would promise
      // something the bone is about to refuse.
      signLine.textContent = `${picked.entry.label}. HOW BIG?`;
      signNote.textContent = chosenSizeId === 'custom'
        ? `Type the two figures \u2014 anything from ${BM.GARAGE_SIZE_MIN_FT} to `
          + `${BM.GARAGE_SIZE_MAX_FT} feet.`
        : 'Pick a size off the shelf, or press OTHER and type your own.';
    } else if (picked) {
      const size = chosenSize();
      signLine.textContent = size
        ? `ONE ${size.label} ${picked.entry.label}. GOOD CHOICE.`
        : `ONE ${picked.entry.label}. GOOD CHOICE.`;
      // THE SAME BOARD SAYS WHICH ROUND IT IS. Both rounds end on the same
      // bone, so the screen is the only thing telling the drafter whether
      // the house arrives built or he draws it -- and that is the whole
      // difference between the two presses.
      signNote.textContent = round === 'outline'
        ? 'Press the bone and I\u2019ll walk you through drawing it.'
        // NOTHING, now the build-now line says it (Movie, 4 Oct: the note
        // only repeated "PRESS TO DRAW HOUSE WITHOUT drawing OUTLINE").
        : '';
    } else if (open) {
      signLine.textContent = `${open.label} \u2014 WHICH ONE?`;
      signNote.textContent = open.title;
    } else {
      signLine.textContent = 'WELCOME TO THE DRIVE-THRU. WHAT ARE WE BUILDING?';
      signNote.textContent = 'Pick a house type off the board.';
    }
  };

  // OPENING THE SIGN CHANGES NOTHING BUT THE SIGN. It reads the menu and
  // moves; it does not choose, build, mark the drawing dirty or touch a
  // level. A drafter who opens it to look and shuts it again has made no
  // edit, and the spec says so.
  // THE PRESS STAYS LIT FOR AS LONG AS THE BOARD IS UP. Movie, 17 Sep: "when
  // the blueprint is showing the blue house button should be light and when it
  // goes down unlit" -- and then, naming which button: "i mean the blue house
  // button", the one in the bar that the sheet now rides above.
  //
  // SO THE GLOW IS NO LONGER TWO SECONDS, it is the whole visit. callSign
  // lights the press and the light simply never goes out until the board does,
  // which is why the timeout below hands the attribute to this function rather
  // than clearing it and letting this set it again a line later.
  //
  // ON RUFF NOBODY SEES IT, because the sign covers the bone -- and that is
  // not a reason to make this conditional. The rule is "the press that called
  // the board is lit while the board is up", the same rule on both finishes,
  // and RUFF's sign already carries its own lit copy of the press on its post.
  // THE THIRD BUTTON GOES TO PROJECT WITH THE ORDER SO FAR (Movie, 20 Oct:
  // "this will take them over to the PROJECT AREA with whatever they
  // selected so far"). The type is stamped on the drawing at the pick
  // (stampBuildType); the garage half of the entry is written here as the
  // garagePlan PROJECT's family row reads (planForEntry's own three words),
  // the drawing is saved so PROJECT's re-read finds both, and the card the
  // order came from is named on the way over -- which is what carries a
  // DETACHED GARAGE, whose entry has no type to stamp.
  const PROJECT_CARD = { bungalow: 'bungalow', bilevel: 'bilevel', detachedGarage: 'detached' };
  const goToProjectWithOrder = () => {
    const picked = chosen();
    if (!picked?.entry || !drawing) return;
    const entry = picked.entry;
    const plan = !entry.garage ? 'none' : (entry.overGarage ? 'attachedRoomOver' : 'attached');
    if (entry.type && drawing.garagePlan !== plan) { drawing.garagePlan = plan; markDirty(); }
    const card = PROJECT_CARD[picked.family?.id] || null;
    Promise.resolve(save()).catch(() => false).then(() => {
      const url = new URL('./PROJECT.html', location.href);
      if (card) url.searchParams.set('type', card);
      location.href = url.pathname + url.search;
    });
  };
  projectGoPresses.forEach(press => press.addEventListener('click', goToProjectWithOrder));

  const setSign = show => {
    sign.toggleAttribute('data-shut', !show);
    boneFoot.setAttribute('aria-expanded', String(show));
    if (show) paintSign();
    boneFoot.toggleAttribute('data-lit', show);
    paintBonePress();
    // Covered is not reachable: the sign hides the bone and nothing under it
    // should be tabbed into. The sheet does not, so there it stays live.
    boneFoot.disabled = show && (BOARD_ART[theme] || {}).coversBone === true;
  };
  // THE BUTTON LIGHTS BEFORE THE SIGN RISES (Movie, 15 Sep): the house
  // button glows, then the board comes up. One constant, because he said
  // he would want to change the length.
  const SIGN_LIGHT_MS = 2000;
  let lighting = 0;
  // WHICH BUTTON PULLED UP TO THE WINDOW. The board is the same either way;
  // what changes is what the bone at the end of the round means.
  const callSign = (button, which) => {
    // A SECOND PRESS MID-GLOW IS NOT A SECOND ORDER. Without this the
    // impatient double-press queues two rises, and the second one lands on
    // a sign that is already up -- which reads as the board flickering shut.
    if (lighting) return;
    if (!signShut()) { setSign(false); return; }
    round = which;
    button.toggleAttribute('data-lit', true);
    // BOTH EDGES, because a theme whose ON state is its own file has to be
    // put back as well as put on. RUFF's filter needs neither and this is a
    // no-op there.
    paintBonePress();
    lighting = window.setTimeout(() => {
      lighting = 0;
      // THE LIGHT IS NOT PUT OUT HERE ANY MORE. It was two seconds and then
      // dark; it is now on until the board goes down, and setSign owns that.
      // Clearing it first would paint the OFF artwork for one frame between
      // the glow and the board.
      setSign(true);
    }, SIGN_LIGHT_MS);
  };

  // THE BONE ON THE SCREEN WITH NOTHING TO BUILD (Movie, 15 Sep: "what
  // happens if they press the bone if no outline?" -- then: "take them to
  // the full house flow (not the outline flow) if there isn't a house and
  // detached garage already... it will do nothing once both house and
  // garage both made").
  //
  // THE HOUSE ROUND, NEVER THE OUTLINE ROUND. A drafter who pressed the
  // bone asked for a house, not for a drawing lesson; sending him down the
  // guided trace would answer a question he did not ask.
  //
  // AND NOTHING AT ALL WHEN THE PROJECT IS FULL. One house and one detached
  // garage is the cap, so with both standing there is nothing the board
  // could offer -- a board that rises with every tile spent is a board that
  // wastes a press. What counts as standing is building-bodies.js's answer,
  // not this page's: PROJECT and the drive-thru's own tiles will ask the
  // same question, and three derivations of it would be two too many.
  //
  // The seam still hears every press either way -- what an empty press
  // means to the geometry side stays the geometry side's call.
  // ON AN ELEVATION THE BONE IS A DOOR, NOT A BUILD. Movie, 20 Oct: "maybe
  // pressing the BONE in elevations should take them over to the EXT FINISH
  // area ... the autohouse BONE in the ELEVATIONS doesn't seem right", and
  // for a section: "take them over to PROJECT fom SECTIONS if they press the
  // bone in the sections area". An empty file still gets the drive-thru --
  // "good idea" -- there is nothing to finish yet. EXT FINISH opens on the
  // same elevation (its ?elev=). No bone is spent: it is a walk, not a build.
  function boneGoesTo() {
    const cut = activeCut();
    if (!cut || !(drawing?.walls || []).length) return null;
    return autoElevationCuts().some(c => String(c.id) === String(cut.id))
      ? { label: 'EXT. FINISH', href: `./EXTFINISH.html?elev=${encodeURIComponent(cut.id)}` }
      : { label: 'PROJECT', href: './PROJECT.html' };
  }
  // THE PRESS SAYS WHERE IT GOES, in a tag over it (the title is the bone
  // wallet's), so the walk is never a surprise. Read off the element each
  // paint, which can run before boneFoot is declared.
  function syncBoneGoes() {
    const bone = document.getElementById('bone');
    if (!bone) return;
    const goes = boneGoesTo();
    if (goes) bone.dataset.boneGoes = goes.label;
    else delete bone.dataset.boneGoes;
  }
  boneFoot.addEventListener('click', () => {
    // BUILT IS AN ANSWER. Movie, 18 Sep: "when they draw the U outline, they
    // should still press the BONE or blue house to cause the house to be
    // created" -- so the press that raises a house is a press that has been
    // answered, and the board has nothing left to ask.
    // AT THE WINDOW, THIS PRESS IS THE POST'S. The board is up, so the
    // drafter is inside the drive-thru, and Movie said so twice: "unless
    // they are inside the drive thru, if they press it then (or when the
    // house is glowing blue) that will count as only BUILD HOUSE". On RUFF
    // he never gets here because the board covers this press; on ROUGH it
    // does not, and this is the press he actually reaches for.
    if (!signShut()) { orderAtWindow(); return; }
    const goes = boneGoesTo();
    if (goes) { guardUnsaved(`leaving for ${goes.label}`, () => { window.location.href = goes.href; }); return; }
    // THE SECOND PRESS ASKS. A type is picked and the board is down, so the
    // drafter has already been through the window once.
    if (chosen()) { openBuildChoice(); return; }
    // AND THE FIRST PRESS IS THE BOARD, ALWAYS -- including with an outline
    // traced and waiting, which is the whole of Movie's ruling: "on 1st
    // press go to drivethru questions". fireBuild used to run here and
    // build on the spot; it now runs from the card's BUILD instead, so the
    // traced shape is still what gets built, one press later and named.
    //
    // AND "ALWAYS" NOW MEANS ALWAYS. A gate stood on this line and returned
    // in SILENCE when building-bodies said the file was full. That was right
    // while full meant "there is nothing left to build, ever" -- Movie's rule
    // for it was "it will do nothing once both house and garage both made".
    //
    // Under ONE BUILDING PER FILE it means something else: "this file has its
    // building". The drafter can still have another, in a file of its own, so
    // a gate here would make this the one press in the app that answers
    // nothing at all -- he could never reach a tile, never reach the offer to
    // save and start clean, and never be told why the bone had gone dead. The
    // cap is enforced at the ORDER instead (:4746), which is the only place
    // that knows WHICH building he wants and can therefore ask about it.
    signRefusal = {
      line: 'NOTHING TO BUILD YET.',
      note: 'Pick a type off the board and I\u2019ll build it.',
    };
    callSign(boneFoot, 'menu');
  });

  // ARRIVING FROM THE FRONT DOOR PULLS UP TO THE WINDOW BY ITSELF (Movie,
  // 15 Sep): "when they enter into the model area from the front entry
  // screen the drivethru should pop up after about 2 seconds". The same
  // call as the press, so it is the same two seconds of glow and the same
  // board -- one behaviour, not a second copy of it.
  //
  // ONLY FROM THE ENTRY SCREEN, and the address says so. A board that rose
  // on every load would rise on every reload, over a drafter who is mid-
  // drawing; the flag is spent as it is read so a refresh lands in the
  // drawing rather than in the drive-thru again.
  //
  // AND A HAND ON THE PAGE CANCELS IT. Someone who starts working inside
  // those two seconds has said what they came for, and the board rising
  // over them would take the press they were making.
  // AND FROM AN EMPTY BONEYARD the same way (Movie, 3 Oct): nothing on the
  // shelf yet, so the drafter is sent here to pick a house.
  // AND AFTER NEW (Movie, 5 Oct): "once the sheet is blank, please bring up
  // the screen for creating a new house" -- the same rise, the same cancel.
  const pullUpToWindow = () => {
    const cancel = () => {
      ['pointerdown', 'keydown', 'wheel'].forEach(type =>
        document.removeEventListener(type, cancel, true));
      if (!lighting) return;
      window.clearTimeout(lighting);
      lighting = 0;
      boneFoot.toggleAttribute('data-lit', false);
      paintBonePress();
    };
    ['pointerdown', 'keydown', 'wheel'].forEach(type =>
      document.addEventListener(type, cancel, true));
    callSign(boneFoot, 'menu');
  };
  // WHICH DOOR THE DRAFTER CAME THROUGH, read once and spent once.
  //
  // THE BOARD CANNOT BE DECIDED HERE ANY MORE. This runs while the module
  // evaluates, and the drawing is not adopted until boot resolves -- `drawing`
  // is still null, so "has this drafter got work?" has no honest answer yet,
  // and asking it here would answer NO for everybody. The flag is still spent
  // here, where it always was, so a reload lands in the drawing; the board
  // itself is raised in boot().then(), which is the first moment the question
  // can be put.
  const arrivedFrom = (() => {
    const from = new URLSearchParams(location.search).get('from');
    if (!['entry', 'boneyard'].includes(from)) return null;
    const spent = new URL(location.href);
    spent.searchParams.delete('from');
    history.replaceState(null, '', spent.pathname + spent.search + spent.hash);
    return from;
  })();
  document.getElementById('dt-close').addEventListener('click', () => {
    setSign(false);
    boneFoot.focus();
  });
  // THE SIGN'S BONE IS THE ORDER, not the drafter's outline -- the other
  // seam, and nothing is listening on it yet because neither the premade
  // designs nor the guided trace exist. A press with nothing behind it is
  // still a press the geometry side is told about, and it carries the round
  // so "build me one" and "walk me through drawing one" cannot be confused
  // for each other by whoever writes them.
  //
  // EXCEPT A GARAGE WITH NO SIZE, which is not an order. The size is the
  // whole design of a box, so an order without one has nothing in it --
  // and the drafter who typed 4ft by 900ft is told so rather than watching
  // a press do nothing.
  // WHAT A PRESS AT THE WINDOW MEANS, once, for BOTH presses that can make
  // it. Movie, 19 Sep: "unless they are inside the drive thru, if they press
  // it then (or when the house is glowing blue) that will count as only
  // BUILD HOUSE".
  //
  // THIS WAS THE BLUE HOUSE BUG. There are two presses at the window -- the
  // bone on the post and the one on the foot -- and only the post's did this.
  // On RUFF that is invisible, because BOARD_ART.ruff covers the foot press
  // and setSign disables it; on ROUGH the sheet stops above the bar, the foot
  // press stays live in front of the drafter, and its handler read
  // `if (chosen()) return;` -- a bare return with no refusal, no board and no
  // sound. Pick a house on ROUGH, press the blue house, nothing happens.
  // Movie: "sometimes i have to switch to RUFF to make it work."
  //
  // So the meaning lives here and both presses call it. A second copy is what
  // made one of them wrong, and a second copy is what would make one of them
  // wrong again.
  // A REFUSAL HAS TO BE READ, and the only place this page says one is on
  // Gruff's screen. That was fine while the only press that could be refused
  // stood ON the board; the bone's second press can order with the board
  // DOWN, and paintSign() into a shut sign writes a sentence nobody sees --
  // and worse, SPENDS it, because paintSign consumes signRefusal. So: raise
  // the board and let its own paint carry the line.
  //
  // AND ON ROUGH THERE IS NO SCREEN TO RAISE IT TO. The same bug one layer
  // in: the stylesheet hides #dt-screen on the sheet with the rest of the
  // dog, so "how big, though?", "you've got one already", "you've got a
  // house already" and the wallet's refusal were all being written onto a
  // box nobody can see. The board still comes up -- it is the selections --
  // but it comes up silent, which is a press that does nothing and says
  // nothing, the worst answer this page can give.
  //
  // THE PAGE'S OWN LINE IS WHERE THEY GO WITHOUT HIM. sayOnStrip is how this
  // page speaks when it is not wearing a dog, and it is the same line the
  // outline tool's refusals already use. Both halves are spoken, because the
  // shout is the WHAT and the note is the WHAT TO DO, and on one line the
  // drafter needs both. The words are taken off signRefusal rather than
  // passed in, because refuseForBones STAGES its refusal for the next paint
  // instead of handing it over -- and taken off means taken: leaving it
  // staged would let Gruff say it later, in RUFF, about a press that is long
  // over.
  const sayAtWindow = () => {
    if (!boardHasDog()) {
      const said = signRefusal;
      signRefusal = null;
      if (said) sayOnStrip(`${said.line} ${said.note}`);
      return false;
    }
    if (signShut()) callSign(boneFoot, 'menu'); else paintSign();
    return false;
  };

  // Returns whether the order was actually placed, so a caller that pressed
  // with the board down knows whether to expect a house or an explanation.
  // FALSE NOW COVERS A THIRD OUTCOME: a press that opened the save dialog on
  // its way to a clean file has placed no order yet, and may never place one.
  const orderAtWindow = () => {
    const picked = chosen();
    // A SUITE COSTS NOTHING AND RAISES NOTHING: it is started on the
    // boneyard, so neither the wallet nor the one-building cap is asked.
    if (picked?.entry?.suite) { fireOrder(); return true; }
    if (picked?.entry?.needsSize && !chosenSize()) {
      signRefusal = {
        line: 'HOW BIG, THOUGH?',
        note: chosenSizeId === 'custom'
          ? `Both figures, between ${BM.GARAGE_SIZE_MIN_FT} and `
            + `${BM.GARAGE_SIZE_MAX_FT} feet.`
          : 'Pick a size off the shelf, or press OTHER and type your own.',
      };
      return sayAtWindow();
    }
    // THE WALLET GOES BEFORE THE CAP NOW, and the comment that stood below
    // used to argue the exact opposite: while the cap was a REFUSAL, a
    // drafter with no bones AND a house standing was better told about the
    // house, the thing waiting could not fix.
    //
    // THE CAP BELOW IS NO LONGER A REFUSAL, so that reasoning inverts with
    // it. It SWAPS THE DRAFTER'S FILE OUT -- asks, saves, blanks, builds --
    // and doing all of that for a build the wallet was always going to turn
    // away would clear his screen for nothing and then hand him the bone
    // message he could have had with his drawing still up.
    if (!canAffordBuild()) { refuseForBones(); return sayAtWindow(); }
    // AND ONE BUILDING IS THE FILE'S LOT -- a HOUSE or a DETACHED GARAGE,
    // never both. Movie, 24 Sep: "rule should be 1 autobuilt BUILDING per
    // DRAFT file (a BUILDING would be a HOUSE or a DETACHED GARAGE)". An
    // ATTACHED garage is part of the house it hangs off and spends nothing,
    // which is why one question does for both bodies; building-bodies.js
    // holds all of that arithmetic, so PROJECT cannot come to a different
    // answer about the same file.
    //
    // AND IT IS AN OFFER RATHER THAN A REFUSAL, which is the change here.
    // Two "YOU'VE GOT ONE ALREADY" signs stood in these lines and sent the
    // drafter away from a build that is perfectly available -- it just needs
    // a file of its own. Movie: "if they press the button ask them if they
    // would like to SAVE the current drawing and then proceed with a NEW
    // CLEAN file for the new AUTOBUILD".
    //
    // ASKED ONLY OF A PRESS THAT WOULD ACTUALLY RAISE ONE. A garage tile
    // qualifies -- it is past its size question by the time it gets here --
    // and a house tile only if it HAS a design. A 2 STOREY press with no plan
    // behind it falls through to the trace handover, and swapping the file
    // out from under a shape the drafter is about to trace by hand would be
    // the worst of the three outcomes. The old refusal was gated the same
    // way, for the milder version of the same reason.
    //
    // AND TWO PRESSES REACH THIS, not one. The obvious caller is the bone at
    // the window. The other is the CHOICE CARD'S BUILD, which runs fireBuild
    // first and falls through to here when it answers false (:4204) -- a
    // drafter whose traced loop is already built presses BUILD, there is
    // nothing left to raise from his outline, and the premade design is what
    // the order round is for. That second press lands on a file that by
    // definition already holds the house he just built, so it is the one most
    // likely to meet this offer. Worth naming because the fall-through is
    // easy to miss: nothing at the card says it leads here.
    const raisesABuilding = picked?.entry?.needsSize
      || !!window.DraftPremadePlans?.planFor(picked?.entry?.id);
    if (raisesABuilding && window.DraftBuildingBodies.hasBuilding(drawing)) {
      buildInAFreshFile();
      // FALSE BECAUSE NOTHING IS BUILT YET. The dialog is up and the order
      // fires from its answer -- or never, if the drafter cancels -- so this
      // press has placed none, which is what the caller is asking about.
      return false;
    }
    fireOrder();
    return true;
  };
  document.getElementById('dt-bone').addEventListener('click', orderAtWindow);
  // THE WORDS ARE THE BONE: one handler, so the two can never build differently.
  buildNowPresses.forEach(press => press.addEventListener('click', orderAtWindow));

  // ── THE BONE'S SECOND PRESS ──────────────────────────────────────────
  //
  // Movie, 19 Sep, ruling on the collision between two of his own rules:
  // "go with the 19 sep rule, on 1st press go to drivethru questions and on
  // 2nd always offer choice between drivetrhu or house build". So a press
  // with the board down NEVER builds straight off any more -- not even with
  // an outline traced, which is what his 18 Sep instruction asked for and
  // what this retires.
  //
  // WHAT THE CARD NAMES IS THE ENTRY'S OWN LABEL, out of build-menu.js:
  // "1 STOREY", "2 STOREY + GARAGE + ROOM OVER", "MODIFIED BILEVEL" --
  // Movie's own words for these houses, already written down once. The
  // FAMILY is prefixed only for the detached garage, whose entries are named
  // for their FOUNDATION ("THICKENED EDGE") and say nothing about what is
  // being built on their own.
  const buildChoice = document.getElementById('build-choice');
  const queuedHouseLabel = () => {
    const picked = chosen();
    if (!picked?.entry) return '';
    return picked.entry.needsSize
      ? `${picked.family?.label || 'DETACHED GARAGE'} \u00b7 ${picked.entry.label}`
      : picked.entry.label;
  };
  // ── PROFESSOR GRUFF'S GARAGE LESSON ────────────────────────────────────
  // The old page's own setting, in the same place (settings package,
  // model.garageIntroOff), so "Don't show this again" ticked on either page
  // holds on both.
  const garageLesson = document.getElementById('garage-lesson');
  const garageIntroOff = () => window.DraftProfileManager
    ?.getActive('settings')?.content?.model?.garageIntroOff === true;
  const openGarageLesson = () => {
    if (!garageLesson || garageIntroOff()) return;
    garageLesson.querySelector('[data-garage-lesson-off]').checked = false;
    garageLesson.hidden = false;
    // ON THE NEXT TICK: the press that closed the house is still landing,
    // and its mousedown hands focus to the plan after this runs.
    setTimeout(() => garageLesson.querySelector('[data-garage-lesson-go]').focus(), 0);
  };
  const closeGarageLesson = () => {
    if (!garageLesson || garageLesson.hidden) return;
    garageLesson.hidden = true;
    const PM = window.DraftProfileManager;
    if (PM && garageLesson.querySelector('[data-garage-lesson-off]').checked) {
      const was = PM.getActive('settings');
      PM.saveActive(PM.createPackage('settings', was?.name, { model: { garageIntroOff: true } }));
    }
    canvas.focus?.();
  };
  if (garageLesson) {
    garageLesson.querySelector('[data-garage-lesson-go]').addEventListener('click', closeGarageLesson);
    // ENTER, AS HIS BUTTON SAYS, wherever the focus happens to be -- and
    // Escape the same -- taken before the page's own keys see it.
    window.addEventListener('keydown', event => {
      if (garageLesson.hidden || (event.key !== 'Escape' && event.key !== 'Enter')) return;
      if (event.key === 'Enter' && event.target?.matches?.('[data-garage-lesson-off]')) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      closeGarageLesson();
    }, true);
  }

  const closeBuildChoice = () => { buildChoice.hidden = true; };
  const openBuildChoice = () => {
    buildChoice.querySelector('[data-build-choice-house]').textContent =
      queuedHouseLabel();
    buildChoice.hidden = false;
    buildChoice.querySelector('[data-build-choice-build]').focus();
  };
  buildChoice.querySelector('[data-build-choice-change]')
    .addEventListener('click', () => { closeBuildChoice(); callSign(boneFoot, 'menu'); });
  buildChoice.querySelector('[data-build-choice-build]')
    .addEventListener('click', () => {
      closeBuildChoice();
      // HIS OWN OUTLINE FIRST, which is where the 18 Sep instruction went
      // rather than being dropped: a drafter who traced a shape and picked a
      // type gets the house on that shape. fireBuild answers false when
      // there is nothing traced to build from, and the premade design is
      // what the order round is for.
      if (fireBuild()) return;
      // A TRACE STILL BEING DRAWN IS NOT A PREMADE ORDER. Movie, 5 Oct: "i
      // tried the outline method ... it allowed me to draw the outline, but
      // then it asked me about saving or discarding the previous drawing ...
      // and then it didn't make the outline, it just created the premade
      // version". A type that hangs a garage on the house waits for the
      // garage loop, so this press found nothing it could build yet -- and
      // falling through counted his own house loop as a building already in
      // the file, offered a clean one, and threw the trace away for the
      // premade square. While his house loop waits for its garage, the press
      // says so instead. ONLY THEN: a type picked at the window arms the same
      // trace with no loop drawn, and that press is still the premade order.
      if (tracedOrder && traceStillThere(tracedHouse) && !tracedGarage
          && window.DraftTracedPlans?.needsGarage(tracedOrder.entry?.id)) {
        sayOnStrip(`Draw the garage first — start ON the house, three legs out, around and back, and land ON the house.${
          tracedBuildsOnClose ? ' Your house goes up as soon as it closes.' : ''}`);
        return;
      }
      // AND A TRACE THE TYPE REFUSED IS NOT A PREMADE ORDER EITHER (Movie,
      // 6 Oct: "the house didn't get drawn in proper shape as requested").
      // fireBuild has just tried his trace and said why it cannot be built;
      // falling through here threw it away for the premade. The refusal
      // stays on the strip, and his trace stays in hand to fix.
      if (tracedOrder && traceStillThere(tracedHouse)) return;
      orderAtWindow();
    });
  // Escape backs out, as it does from every other card on this page. It
  // CHANGES NOTHING -- the type stays picked and the next press asks again.
  buildChoice.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    event.stopPropagation();
    closeBuildChoice();
    boneFoot.focus();
  });
  // Escape shuts the sign, as it shuts every other thing this page puts over
  // the drawing. Captured before the drawing's own Escape so an open sign is
  // not also a cleared selection.
  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape' || signShut()) return;
    event.stopPropagation();
    setSign(false);
    boneFoot.focus();
  }, true);

