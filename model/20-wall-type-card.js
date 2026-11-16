// CREATE WALL TYPE (jb, 16 Nov 2026): "can i have in addition to the 'emtpy
// wall - you pick thickness' can i have another button - create wall-type.
// which will allow the user to identify the 'slice compoments' of the wall
// with their thicknesses showing. allow the user to 'hatch or shade' each
// slice" -- and "this is needed for the foundation walls too exactly the
// same".
//
// THE CARD: a name, FLOOR WALL or FOUNDATION WALL, and the slices listed
// OUTSIDE TO INSIDE -- each a name, a thickness and a hatch or shade (the
// three wall fills and every SHAPE hatch). A foundation type's slices each
// say which plan they show on, FDN and/or BSMT (jb: the 8" concrete on the
// FOUNDATION plan, the air space, 2x4 batt, VB and gyp on the BASEMENT plan
// only). A drawing of the wall cut with every slice's thickness written
// beside it, and the TOTAL, follow every keystroke.
//
// WHERE A TYPE LIVES: in the drawing file (`drawing.wallTypes`), so the file
// carries its walls anywhere; and in this browser's MY WALL TYPES, so a new
// drawing can start from one made before (FROM MY WALL TYPES on the card).
// wall-types.js holds the registry every painter reads.
//
// Loaded after 19-line-arcs.js. Earlier files call in through typeof
// guards. Same scope, same indent.

  // ── the vocabulary ─────────────────────────────────────────────────────
  const WALL_SLICE_FILLS = Object.freeze([
    ['stud', 'PLAIN (WALL)'], ['concrete', 'CONCRETE'], ['insulation', 'BATT INSULATION'],
    ['white', 'WHITE'], ['lightgrey', 'LIGHT GREY'], ['grey', 'GREY'], ['black', 'BLACK'],
    ['transparent', 'NONE (CLEAR)'], ['dots', 'DOTS 25%'],
    ['siding_h', 'H. SIDING'], ['siding_v_bb', 'V. SIDING'], ['shake', 'CEDAR SHAKE'],
    ['ledgestone', 'LEDGESTONE'], ['ashlar', 'ASHLAR'], ['roundstone', 'ROUNDSTONE'],
    ['fieldstone', 'FIELDSTONE'], ['brick', 'BRICK'],
  ]);
  // WHAT A NEW TYPE STARTS AS: a wall a drafter would draw, so the card
  // opens on something to change rather than an empty list. The foundation
  // one is jb's own example, slice for slice.
  const WALL_TYPE_STARTERS = Object.freeze({
    floor: Object.freeze([
      { name: 'SIDING', in: 0.75, fill: 'siding_h' },
      { name: 'SHEATHING', in: 7 / 16, fill: 'lightgrey' },
      { name: '2X6 STUDS + BATT', in: 5.5, fill: 'insulation' },
      { name: 'VB', in: 0, fill: 'stud' },
      { name: 'GYP', in: 0.5, fill: 'white' },
    ]),
    foundation: Object.freeze([
      { name: '8" CONC', in: 8, fill: 'concrete' },
      { name: 'AIR SPACE', in: 0.5, fill: 'transparent', fdn: false },
      { name: '2X4 + BATT', in: 3.5, fill: 'insulation', fdn: false },
      { name: 'VB', in: 0, fill: 'stud', fdn: false },
      { name: 'GYP', in: 0.5, fill: 'white', fdn: false },
    ]),
  });
  const MY_WALL_TYPES_KEY = 'draft.myWallTypes';
  const PREVIEW_TYPE_ID = 'wt_card_preview';

  // ── MY WALL TYPES, this browser's shelf of them ─────────────────────────
  const readMyWallTypes = () => {
    try {
      const WT = window.DraftWallTypes;
      return WT.normalizeUserWallTypes(JSON.parse(localStorage.getItem(MY_WALL_TYPES_KEY) || '[]'));
    } catch (e) { return []; }
  };
  const keepInMyWallTypes = type => {
    try {
      const WT = window.DraftWallTypes;
      const list = readMyWallTypes().filter(t => t.id !== type.id).map(WT.userWallTypeRecord);
      list.unshift(WT.userWallTypeRecord(type));
      localStorage.setItem(MY_WALL_TYPES_KEY, JSON.stringify(list.slice(0, 60)));
    } catch (e) { /* a browser that keeps nothing still has the file's copy */ }
  };

  // ── the drawing's list ──────────────────────────────────────────────────
  const drawingWallTypes = () => window.DraftWallTypes.userWallTypesOf(drawing);
  const putDrawingWallType = type => {
    const WT = window.DraftWallTypes;
    const list = (Array.isArray(drawing.wallTypes) ? drawing.wallTypes : []).filter(t => t?.id !== type.id);
    list.push(WT.userWallTypeRecord(type));
    drawing.wallTypes = list;
    WT.registerUserWallTypes([type]);
    // EVERY WALL OF IT KNOWS ITS WIDTH, so a page not handed the type still
    // draws it the right thickness.
    (drawing.walls || []).forEach(wall => { if (wall.wallType === type.id) wall.widthIn = type.totalIn; });
  };

  // ── length words ────────────────────────────────────────────────────────
  const sliceWords = inches => window.DraftFormatters.formatInchesOnly(inches);
  // A THICKNESS IS INCHES: a bare 5 1/2 or 5.5 is inches, as on the WIDTH
  // box; 0 is a slice drawn as a line (a vapour barrier).
  const parseSlice = text => {
    const F = window.DraftFormatters;
    let raw = String(text || '').trim();
    if (!raw) return { error: 'Type a thickness, like 1/2" or 5 1/2.' };
    if (/^0+(\.0*)?$/.test(raw)) return { inches: 0 };
    if (!/['"a-z]/i.test(raw)) raw += '"';
    const parsed = F.parseArchitecturalLength(raw);
    if (!parsed.ok) return { error: parsed.error };
    const inches = Math.round(parsed.inches * 64) / 64;
    if (!(inches >= 0) || inches > 48) return { error: 'A slice is 0" to 48" thick.' };
    return { inches };
  };

  // ── the card ────────────────────────────────────────────────────────────
  let wallTypeCardEl = null;
  const wallTypeCardStyle = () => {
    if (document.getElementById('wall-type-card-style')) return;
    const style = document.createElement('style');
    style.id = 'wall-type-card-style';
    style.textContent = `
  #wall-type-card { position:fixed; inset:0; z-index:9; display:flex; align-items:center;
    justify-content:center; padding:16px; background:rgba(0,0,0,0.35); }
  #wall-type-card[hidden] { display:none; }
  #wall-type-card .promote-card { max-width:min(760px, 96vw); width:min(760px, 96vw);
    max-height:calc(100vh - 32px); overflow:auto; box-sizing:border-box;
    background-color: var(--surface-page); background-image: var(--surface-page-tex, none);
    font-family: var(--font-ui); color: var(--ink-primary); }
  #wall-type-card h3 { margin:0 0 10px; font-size:14px; letter-spacing:0.08em; }
  #wall-type-card .wt-row { display:flex; gap:6px; align-items:center; margin:0 0 6px; flex-wrap:wrap; }
  #wall-type-card .wt-label { font-size:11px; letter-spacing:0.06em; min-width:5.5em; color: var(--ink-secondary); }
  #wall-type-card input[type=text], #wall-type-card select { font:inherit; font-size:12px;
    padding:3px 5px; border:1px solid var(--edge-panel); border-radius:3px;
    background: var(--surface-chip); color: var(--ink-primary); }
  #wall-type-card table { border-collapse:collapse; width:100%; margin:4px 0 8px; font-size:12px; }
  #wall-type-card th { text-align:left; font-size:10px; letter-spacing:0.06em; color: var(--ink-secondary);
    font-weight:600; padding:2px 4px; }
  #wall-type-card td { padding:2px 4px; vertical-align:middle; }
  #wall-type-card td input[data-slice-name] { width:11em; }
  #wall-type-card td input[data-slice-in] { width:5em; }
  #wall-type-card button.mini { padding:2px 6px; font-size:11px; cursor:pointer; border-radius:3px;
    border:1px solid var(--edge-panel); background: var(--surface-chip); color: var(--ink-quiet); }
  #wall-type-card button.mini[aria-pressed="true"] { border-color: var(--accent); color: var(--accent); }
  #wall-type-card canvas { display:block; width:100%; border:1px solid var(--edge-panel);
    border-radius:3px; background:#ffffff; margin:4px 0 8px; }
  #wall-type-card [data-wall-type-total] { font-size:22px; font-weight:700; letter-spacing:0.04em; }
  #wall-type-card [data-wall-type-error] { color: var(--ink-warn); font-size:12px; min-height:1em; margin:4px 0; }
  #wall-type-card .sel-chip[aria-pressed="true"] { border-color: var(--accent); color: var(--accent); }
`;
    document.head.append(style);
  };

  // `options`: { kind, editId, onMade(type), onDone(type|null) }. onMade is handed the type
  // made or changed, so the press that opened the card puts it on the walls
  // in hand (or makes it the type the WALL tool draws).
  const openWallTypeCard = (options = {}) => {
    const WT = window.DraftWallTypes;
    if (!WT?.normalizeUserWallType || !drawing) return;
    wallTypeCardStyle();
    if (wallTypeCardEl) wallTypeCardEl.remove();
    const editing = options.editId && !(WT.isStockWallType && WT.isStockWallType(options.editId))
      ? WT.userWallTypeById(options.editId) : null;
    const state = {
      id: editing ? editing.id : null,
      name: editing ? editing.name : '',
      kind: editing ? editing.kind : (options.kind === 'foundation' ? 'foundation' : 'floor'),
      slices: (editing ? editing.layers : WALL_TYPE_STARTERS[options.kind === 'foundation' ? 'foundation' : 'floor'])
        .map(layer => ({ name: layer.name || '', in: layer.in, fill: layer.fill,
          fdn: layer.fdn !== false, bsmt: layer.bsmt !== false })),
    };

    const card = document.createElement('div');
    card.id = 'wall-type-card';
    card.dataset.wallTypeCard = '';
    card.setAttribute('role', 'dialog');
    card.setAttribute('aria-label', 'Create wall type');
    const inner = document.createElement('div');
    inner.className = 'promote-card';
    card.append(inner);

    const head = document.createElement('h3');
    head.textContent = editing ? `EDIT WALL TYPE — ${editing.name}` : 'CREATE WALL TYPE';
    inner.append(head);

    // NAME
    const nameRow = document.createElement('div');
    nameRow.className = 'wt-row';
    const nameLabel = document.createElement('span');
    nameLabel.className = 'wt-label';
    nameLabel.textContent = 'NAME';
    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.dataset.wallTypeName = '';
    nameInput.placeholder = 'e.g. 2X6 EXT W/ SIDING';
    nameInput.value = state.name;
    nameInput.style.flex = '1';
    nameInput.addEventListener('input', () => { state.name = nameInput.value; });
    nameRow.append(nameLabel, nameInput);
    inner.append(nameRow);

    // KIND
    const kindRow = document.createElement('div');
    kindRow.className = 'wt-row';
    const kindLabel = document.createElement('span');
    kindLabel.className = 'wt-label';
    kindLabel.textContent = 'FOR';
    kindRow.append(kindLabel);
    const kindChips = [['floor', 'FLOOR WALLS'], ['foundation', 'FOUNDATION WALLS']].map(([id, face]) => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'sel-chip';
      chip.dataset.wallTypeKind = id;
      chip.textContent = face;
      chip.addEventListener('click', () => { state.kind = id; redraw(); });
      kindRow.append(chip);
      return chip;
    });
    inner.append(kindRow);

    // FROM MY WALL TYPES
    const mine = readMyWallTypes();
    if (mine.length) {
      const fromRow = document.createElement('div');
      fromRow.className = 'wt-row';
      const fromLabel = document.createElement('span');
      fromLabel.className = 'wt-label';
      fromLabel.textContent = 'START FROM';
      const pickMine = document.createElement('select');
      pickMine.dataset.wallTypeFromMine = '';
      const none = document.createElement('option');
      none.value = '';
      none.textContent = 'MY WALL TYPES…';
      pickMine.append(none, ...mine.map(type => {
        const opt = document.createElement('option');
        opt.value = type.id;
        opt.textContent = type.label;
        return opt;
      }));
      pickMine.addEventListener('change', () => {
        const type = mine.find(t => t.id === pickMine.value);
        if (!type) return;
        if (!editing) state.id = type.id;
        state.name = type.name;
        state.kind = type.kind;
        state.slices = type.layers.map(layer => ({ name: layer.name, in: layer.in, fill: layer.fill,
          fdn: layer.fdn !== false, bsmt: layer.bsmt !== false }));
        nameInput.value = state.name;
        redraw();
      });
      fromRow.append(fromLabel, pickMine);
      inner.append(fromRow);
    }

    const sliceHead = document.createElement('div');
    sliceHead.className = 'wt-label';
    sliceHead.style.marginTop = '6px';
    sliceHead.textContent = 'SLICES — OUTSIDE (TOP) TO INSIDE (BOTTOM)';
    inner.append(sliceHead);
    const table = document.createElement('table');
    table.dataset.wallTypeSlices = '';
    inner.append(table);

    const addRow = document.createElement('div');
    addRow.className = 'wt-row';
    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.className = 'mini';
    addBtn.dataset.wallTypeAddSlice = '';
    addBtn.textContent = '+ ADD SLICE';
    addBtn.addEventListener('click', () => {
      if (state.slices.length >= WT.USER_SLICE_MAX) return;
      state.slices.push({ name: '', in: 0.5, fill: 'stud', fdn: true, bsmt: true });
      redraw();
    });
    addRow.append(addBtn);
    inner.append(addRow);

    const canvas = document.createElement('canvas');
    canvas.dataset.wallTypePreview = '';
    inner.append(canvas);

    const totalRow = document.createElement('div');
    totalRow.className = 'wt-row';
    const totalLabel = document.createElement('span');
    totalLabel.className = 'wt-label';
    totalLabel.textContent = 'TOTAL WIDTH';
    const total = document.createElement('span');
    total.dataset.wallTypeTotal = '';
    totalRow.append(totalLabel, total);
    inner.append(totalRow);

    const error = document.createElement('div');
    error.dataset.wallTypeError = '';
    inner.append(error);

    const buttons = document.createElement('div');
    buttons.className = 'promote-row';
    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.dataset.wallTypeCancel = '';
    cancel.textContent = 'CANCEL';
    const save = document.createElement('button');
    save.type = 'button';
    save.dataset.wallTypeSave = '';
    save.dataset.promoteGo = '';
    save.textContent = editing ? 'SAVE TYPE' : 'MAKE TYPE';
    buttons.append(cancel);
    if (editing) {
      const del = document.createElement('button');
      del.type = 'button';
      del.dataset.wallTypeDelete = '';
      del.textContent = 'DELETE TYPE';
      // ONE PRESS ASKS, THE SECOND DELETES: the walls of it become custom
      // width walls, which no UNDO brings back to the type.
      let armed = false;
      del.addEventListener('click', () => {
        if (!armed) {
          armed = true;
          const used = (drawing.walls || []).filter(wall => wall.wallType === editing.id).length;
          del.textContent = used ? `DELETE? ${used} WALL${used === 1 ? '' : 'S'} BECOME CUSTOM WIDTH — PRESS AGAIN` : 'DELETE? PRESS AGAIN';
          return;
        }
        deleteWallType(editing);
        closeCard();
        if (typeof options.onDone === 'function') options.onDone(null);
      });
      buttons.append(del);
    }
    buttons.append(save);
    inner.append(buttons);

    const closeCard = () => {
      card.remove();
      if (wallTypeCardEl === card) wallTypeCardEl = null;
    };
    cancel.addEventListener('click', closeCard);
    card.addEventListener('keydown', event => {
      event.stopPropagation();
      if (event.key === 'Escape') closeCard();
    });
    card.addEventListener('pointerdown', event => { if (event.target === card) closeCard(); });

    const totalIn = () => Math.round(state.slices.reduce((sum, slice) => sum + (Number(slice.in) || 0), 0) * 64) / 64;
    const record = id => ({ id, name: state.name || 'MY WALL', kind: state.kind,
      layers: state.slices.map(slice => ({ name: slice.name, in: slice.in, fill: slice.fill,
        ...(state.kind === 'foundation' && !slice.fdn ? { fdn: false } : {}),
        ...(state.kind === 'foundation' && !slice.bsmt ? { bsmt: false } : {}) })) });

    const fillSelect = (slice, index) => {
      const select = document.createElement('select');
      select.dataset.sliceFill = String(index);
      WALL_SLICE_FILLS.forEach(([id, face]) => {
        const opt = document.createElement('option');
        opt.value = id;
        opt.textContent = face;
        if (id === slice.fill) opt.selected = true;
        select.append(opt);
      });
      select.addEventListener('change', () => { slice.fill = select.value; paintPreview(); });
      return select;
    };
    const mini = (text, title, press, data) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'mini';
      btn.textContent = text;
      btn.title = title;
      Object.entries(data || {}).forEach(([k, v]) => { btn.dataset[k] = v; });
      btn.addEventListener('click', press);
      return btn;
    };

    const paintTable = () => {
      table.textContent = '';
      const headRow = document.createElement('tr');
      ['', 'SLICE', 'THICKNESS', 'HATCH / SHADE', ...(state.kind === 'foundation' ? ['SHOWS ON'] : []), '']
        .forEach(text => { const th = document.createElement('th'); th.textContent = text; headRow.append(th); });
      table.append(headRow);
      state.slices.forEach((slice, index) => {
        const tr = document.createElement('tr');
        tr.dataset.sliceRow = String(index);
        const move = document.createElement('td');
        move.append(
          mini('▲', 'Move this slice out', () => {
            if (index === 0) return;
            [state.slices[index - 1], state.slices[index]] = [state.slices[index], state.slices[index - 1]];
            redraw();
          }, { sliceUp: String(index) }),
          mini('▼', 'Move this slice in', () => {
            if (index === state.slices.length - 1) return;
            [state.slices[index + 1], state.slices[index]] = [state.slices[index], state.slices[index + 1]];
            redraw();
          }, { sliceDown: String(index) }));
        const nameTd = document.createElement('td');
        const sliceName = document.createElement('input');
        sliceName.type = 'text';
        sliceName.dataset.sliceName = String(index);
        sliceName.value = slice.name;
        sliceName.placeholder = 'e.g. GYP';
        sliceName.addEventListener('input', () => { slice.name = sliceName.value.toUpperCase(); paintPreview(); });
        nameTd.append(sliceName);
        const inTd = document.createElement('td');
        const sliceIn = document.createElement('input');
        sliceIn.type = 'text';
        sliceIn.dataset.sliceIn = String(index);
        sliceIn.value = sliceWords(slice.in);
        const takeIn = () => {
          const got = parseSlice(sliceIn.value);
          if (got.error) { error.textContent = got.error; sliceIn.value = sliceWords(slice.in); return; }
          error.textContent = '';
          slice.in = got.inches;
          sliceIn.value = sliceWords(slice.in);
          paintPreview();
        };
        sliceIn.addEventListener('blur', takeIn);
        sliceIn.addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); takeIn(); } });
        inTd.append(sliceIn);
        const fillTd = document.createElement('td');
        fillTd.append(fillSelect(slice, index));
        tr.append(move, nameTd, inTd, fillTd);
        if (state.kind === 'foundation') {
          const onTd = document.createElement('td');
          [['fdn', 'FDN', 'Shows on the FOUNDATION plan'], ['bsmt', 'BSMT', 'Shows on the BASEMENT plan']].forEach(([key, face, title]) => {
            const chip = mini(face, title, () => {
              slice[key] = !slice[key];
              chip.setAttribute('aria-pressed', String(slice[key]));
              paintPreview();
            }, { sliceShows: `${key}-${index}` });
            chip.setAttribute('aria-pressed', String(slice[key]));
            onTd.append(chip, document.createTextNode(' '));
          });
          tr.append(onTd);
        }
        const delTd = document.createElement('td');
        delTd.append(mini('✕', 'Take this slice out', () => {
          if (state.slices.length <= 1) return;
          state.slices.splice(index, 1);
          redraw();
        }, { sliceRemove: String(index) }));
        tr.append(delTd);
        table.append(tr);
      });
    };

    // THE CUT, DRAWN BY THE WALL PAINTER ITSELF: a short run of this wall,
    // outside at the top, through drawWallSeg2D -- so the card shows exactly
    // the hatches the plan will -- and each slice's thickness and name
    // written beside it.
    const paintPreview = () => {
      const R = window.DraftRender2D;
      const t = totalIn();
      total.textContent = t > 0 ? sliceWords(t) : '—';
      const cssW = Math.max(320, inner.clientWidth - 40 || 640);
      // The wall first, then the labels stacked beside it no closer than a
      // line apart -- and the card as tall as the lower of the two.
      const wallPx = Math.min(220, Math.max(70, t * 9));
      const pxPerFt = t > 0 ? wallPx / (t / 12) : 1;
      const top = 26, left = 20, right = cssW * 0.45;
      const rowGap = 18;
      const labelYs = [];
      state.slices.reduce((y, slice) => {
        const h = (slice.in / 12) * pxPerFt;
        const prev = labelYs.length ? labelYs[labelYs.length - 1] : -Infinity;
        labelYs.push(Math.max(y + h / 2, prev + rowGap));
        return y + h;
      }, top);
      const rowsH = Math.ceil(Math.max(top + wallPx + 24, (labelYs[labelYs.length - 1] || 0) + 16, 120));
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.round(cssW * dpr);
      canvas.height = Math.round(rowsH * dpr);
      canvas.style.height = `${rowsH}px`;
      const g = canvas.getContext('2d');
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.fillStyle = '#ffffff';
      g.fillRect(0, 0, cssW, rowsH);
      if (!(t > 0) || !R) return;
      // A run from left to right with its line on the outside face: the
      // painter lays the slices along the run's normal (-dz, dx), which is
      // DOWN the card here, so the first slice -- the outside -- is on top.
      const lenFt = (right - left) / pxPerFt;
      const toS = p => ({ x: left + p.x * pxPerFt, y: top + p.z * pxPerFt });
      WT.registerUserWallTypes([record(PREVIEW_TYPE_ID)]);
      const seg = { id: 'wall-type-preview', start: { x: 0, y: 0, z: 0 }, end: { x: lenFt, y: 0, z: 0 },
        wallType: PREVIEW_TYPE_ID, refLine: 'left', levelId: 3, view: 'plan' };
      try {
        R.drawWallSeg2D(g, toS, seg, false, null, 'both', {
          wallTypes: WT.WALL_TYPES,
          colors: { wall: '#ffffff', wallPreview: '#ffffff', wallEdge: '#1d1f20', wallEdgePreview: '#1d1f20' },
        });
      } catch (e) { /* a half-typed slice list draws nothing rather than throwing */ }
      // THE THICKNESSES, one per slice, with a tick at each face.
      g.strokeStyle = '#1d1f20';
      g.fillStyle = '#1d1f20';
      g.lineWidth = 1;
      g.font = "600 12px 'Barlow Condensed', system-ui, sans-serif";
      g.textBaseline = 'middle';
      const dimX = right + 14;
      let y = top;
      g.beginPath();
      g.moveTo(dimX, top); g.lineTo(dimX, top + wallPx);
      g.stroke();
      state.slices.forEach((slice, index) => {
        const h = (slice.in / 12) * pxPerFt;
        g.beginPath(); g.moveTo(dimX - 5, y); g.lineTo(dimX + 5, y); g.stroke();
        const mid = y + h / 2;
        const labelY = labelYs[index];
        g.beginPath(); g.moveTo(dimX, mid); g.lineTo(dimX + 14, labelY); g.lineTo(dimX + 20, labelY); g.stroke();
        const shows = state.kind === 'foundation'
          ? `   ${[slice.fdn && 'FDN', slice.bsmt && 'BSMT'].filter(Boolean).join(' + ') || 'HIDDEN'}` : '';
        g.fillText(`${sliceWords(slice.in)}  ${slice.name || `SLICE ${index + 1}`}${shows}`, dimX + 24, labelY);
        y += h;
      });
      g.beginPath(); g.moveTo(dimX - 5, top + wallPx); g.lineTo(dimX + 5, top + wallPx); g.stroke();
      g.font = "700 11px 'Barlow Condensed', system-ui, sans-serif";
      g.fillText('OUTSIDE', left, top - 10);
      g.fillText('INSIDE', left, top + wallPx + 10);
    };
    const redraw = () => {
      kindChips.forEach(chip => chip.setAttribute('aria-pressed', String(chip.dataset.wallTypeKind === state.kind)));
      paintTable();
      paintPreview();
    };

    save.addEventListener('click', () => {
      // A thickness still being typed is taken first.
      if (document.activeElement && card.contains(document.activeElement)) document.activeElement.blur();
      const t = totalIn();
      if (!(t >= WT.CUSTOM_WALL_MIN_IN) || t > WT.CUSTOM_WALL_MAX_IN) {
        error.textContent = `A wall is ${sliceWords(WT.CUSTOM_WALL_MIN_IN)} to ${sliceWords(WT.CUSTOM_WALL_MAX_IN)} in all (now ${sliceWords(t)}).`;
        return;
      }
      if (state.kind === 'foundation' && !state.slices.some(slice => slice.fdn)) {
        error.textContent = 'A foundation wall needs at least one slice on the FOUNDATION plan (FDN).';
        return;
      }
      if (!String(state.name).trim()) { error.textContent = 'Give the type a name.'; nameInput.focus(); return; }
      const type = WT.normalizeUserWallType(record(state.id || WT.newUserWallTypeId()));
      if (!type) { error.textContent = 'That wall type could not be made.'; return; }
      putDrawingWallType(type);
      keepInMyWallTypes(type);
      closeCard();
      if (typeof options.onMade === 'function') options.onMade(type);
      if (typeof options.onDone === 'function') options.onDone(type);
      markDirty();
      showSelectionProps();
      paint();
    });

    document.body.append(card);
    wallTypeCardEl = card;
    redraw();
    if (!editing) nameInput.focus();
  };

  // DELETE: the walls of it keep their width as a CUSTOM WIDTH wall, so
  // nothing moves; the type leaves the file (MY WALL TYPES keeps it).
  const deleteWallType = type => {
    if (!drawing) return;
    (drawing.walls || []).forEach(wall => {
      if (wall.wallType !== type.id) return;
      wall.wallType = 'custom';
      wall.widthIn = type.totalIn;
      delete wall.sliceFlip;
    });
    (drawing.groups || []).forEach(group => {
      if (group?.wallSettings?.wallType === type.id) {
        group.wallSettings = { ...group.wallSettings, wallType: 'custom', widthIn: type.totalIn };
      }
    });
    drawing.wallTypes = (Array.isArray(drawing.wallTypes) ? drawing.wallTypes : []).filter(t => t?.id !== type.id);
    if (drawing.activeWallType === type.id) delete drawing.activeWallType;
    markDirty();
    showSelectionProps();
    paint();
  };

  // ── MADE TYPES STAND OUT, AND EACH ONE EDITS FROM ITS OWN CHIP ───────────
  //
  // jb, 16 Nov 2026: "for the wall types can we [have] a way to EDIT the
  // 'user created' wall types. (maybe make their cards blue tinge, rather
  // than just grey to make obvious to the user)". EDIT TYPE under MADE TYPE
  // only showed while the walls in hand were already of that type, and the
  // WALL tool's panel had no way in at all. So every chip of a made type, on
  // every TYPE row (WALL tool, a picked wall, MAIN WALLS, SPECIAL CASE),
  // wears a blue tinge and carries a ✎ beside it that opens its card;
  // a right-click on the chip opens it too. `after` runs once the card has
  // saved or deleted, for a panel that showSelectionProps does not redraw.
  const dressMadeTypeChips = (row, after) => {
    const WT = window.DraftWallTypes;
    if (!row || !WT?.isUserWallTypeId) return row;
    row.querySelectorAll('button[data-prop-value]').forEach(chip => {
      const id = chip.dataset.propValue;
      // A STOCK type (wall-types.js STOCK_WALL_TYPES) is built in: grey, no ✎.
      if (!WT.isUserWallTypeId(id) || chip.dataset.madeType != null
        || (WT.isStockWallType && WT.isStockWallType(id))) return;
      chip.dataset.madeType = '';
      chip.classList.add('made-type');
      chip.title = 'A wall type made in this drawing · right-click or ✎ to edit it';
      const type = WT.userWallTypeById(id);
      const open = () => openWallTypeCard({ editId: id, kind: type?.kind, onDone: after });
      chip.addEventListener('contextmenu', event => { event.preventDefault(); open(); });
      const pen = document.createElement('button');
      pen.type = 'button';
      pen.className = 'sel-chip made-type made-type-edit';
      pen.dataset.madeTypeEdit = id;
      pen.textContent = '✎';
      pen.title = `Edit ${type?.name || 'this wall type'}`;
      pen.setAttribute('aria-label', `Edit wall type ${type?.name || ''}`.trim());
      pen.addEventListener('click', event => { event.stopPropagation(); open(); });
      // The chip and its ✎ wrap together, never one line apart.
      const pair = document.createElement('span');
      pair.className = 'made-type-pair';
      chip.replaceWith(pair);
      pair.append(chip, pen);
    });
    return row;
  };
