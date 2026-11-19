// MODEL.html's page script, part 21: the DETAILS LIBRARY -- a file of small
// 2D details, one per detail window, with a card each.
//
// jb, 19 Nov 2026: "i'm thinking of making a different DRAFT file option a
// DETAILS LAYOUT that should all the typical details, and some not so
// typical like duplex wall construction, window wells etc ... i'd like it to
// be a 'special file' like the site plan it will only contain the DETAIL
// DRAWINGS, which are all 2D small square or rectangle drawings. i'd like a
// database type organization system so that they can be arranged easily.
// id like to draw each detail in a seperate 'SHELF' ... it won't need all
// the LEVELS / LAYERS because the DETAILS are just 2D small drawing with
// notes". The plan he approved the same day ("go for it") is step 2 of five:
// this file kind and the DETAIL window. The DETAILS BOARD, details on LAYOUT
// sheets and MAKE DETAIL from a section come after it.
//
// WHAT A DETAILS LIBRARY IS, in this page's own terms:
//
//   - a .draft with `standalone: 'details'` (drawing-format.js
//     STANDALONE_KINDS), started from the drive-thru's DRAW DETAILS LIBRARY;
//   - EACH SHELF IS ONE DETAIL. The shelf already is a private drawing space
//     with its own geometry (level -shelfId), its own name and a double-click
//     rename; a detail adds a card to it (`shelf.detail`, drawing-format.js
//     detailCard): category, TYP. or SPECIAL, tags, a note, a frame in real
//     feet and the scale it is drawn at;
//   - THE FRAME is centred on the shelf's origin, painted dashed, and is what
//     the detail is: what is inside it is what will print. Under it, the
//     detail's bubble (number, name, scale), drawn from the card;
//   - no level, no elevation, no section, no BUILD key and no autohouse is
//     offered (LEVELS panel, view rail, page-row doors, tool keys);
//   - SAVE DETAIL is plain SAVE (free, jb: "free for now") and then a copy of
//     the whole library into this browser's `details-libraries` store under
//     the library's name, which is where a house file will find it once the
//     DETAILS button is built (step 4). SAVE AS writes the .draft to disk as
//     the backup, and OPEN reads one back, as for any drawing.
//
// jb's answers on 19 Nov fixed the defaults: "FOUNDATION, FRAMING, and SITE
// ... that's probably enough for starters", and a 4' x 4' frame at
// 1" = 1'-0" ("i think that is good").

  const DETAILS_BUCKET = 'details-libraries';
  const DETAILS_DEFAULT_LIBRARY = 'DETAILS-LIBRARY';
  const isDetailsFile = () => drawing?.standalone === 'details';

  // ── WHICH KEYS A DETAIL IS DRAWN WITH ──────────────────────────────────────
  //
  // THE DRAW / EDIT KEYS, less the two that are about a house: CUT makes a
  // section through walls a detail does not have, and ROOM TAG names a room.
  // Every BUILD key is refused (walls, openings, floors, roofs, stairs...),
  // and so is OUTLINE (U), the autohouse's loop. Down and still in place on
  // the keypad (refreshToolAvailability), and a letter pressed for one says
  // why (pressToolKey).
  const DETAIL_REFUSED_TOOLS = new Set(['cut', 'roomtag', 'outline']);
  const detailsToolRefused = id => {
    if (!isDetailsFile()) return false;
    if (DETAIL_REFUSED_TOOLS.has(id)) return true;
    return window.DraftToolRoster?.get?.(id)?.group === 'build';
  };

  // ── THE DETAIL BEING DRAWN ─────────────────────────────────────────────────
  //
  // THE STORED RECORD, so a card edit lands on what the file keeps. A drawing
  // that never wrote its shelves (the format yields SHELF 1 without writing
  // it) gets the list written once, here, which is the drafter's own act.
  const storedShelf = shelfId => {
    if (!drawing) return null;
    if (!Array.isArray(drawing.boneyardShelves)
      || !drawing.boneyardShelves.some(sh => Number(sh?.id) === Number(shelfId))) {
      drawing.boneyardShelves = shelves();
    }
    return drawing.boneyardShelves.find(sh => Number(sh?.id) === Number(shelfId)) || null;
  };
  const detailCardOf = shelf => window.DraftDrawingFormat.detailCard(shelf?.detail);
  const activeDetail = () => {
    const id = activeShelfId();
    const list = shelves();
    const at = list.findIndex(sh => Number(sh.id) === id);
    return at < 0 ? null : { shelf: list[at], card: detailCardOf(list[at]), number: at + 1 };
  };
  const scaleLabel = scale => {
    const inches = { 3: '3"', 1.5: '1 1/2"', 1: '1"', 0.75: '3/4"', 0.5: '1/2"' }[scale] || `${scale}"`;
    return `${inches} = 1'-0"`;
  };
  const feetText = ft => window.DraftFormatters.formatArchitecturalInches(ft * 12);

  // ONE UNDO PER CARD EDIT, through the props step the brush and the shelf
  // rename already use: the shelf record is put back in place.
  const writeCard = (patch, say = null) => {
    const now = activeDetail();
    if (!now) return;
    const shelf = storedShelf(now.shelf.id);
    if (!shelf) return;
    const before = { ...shelf, ...(shelf.detail ? { detail: { ...shelf.detail } } : {}) };
    const next = window.DraftDrawingFormat.detailCard({ ...detailCardOf(shelf), ...patch });
    if (JSON.stringify(next) === JSON.stringify(detailCardOf(shelf)) && shelf.detail) return;
    undoStack.push({ kind: 'props', edits: [{ item: shelf, before }] });
    shelf.detail = next;
    markDirty();
    if (say) sayOnStrip(say);
    buildChrome();
    paint();
  };

  // ── THE FRAME ON THE SHEET ────────────────────────────────────────────────
  const detailFrameRect = card => ({
    x0: -card.frameW / 2, x1: card.frameW / 2, z0: -card.frameH / 2, z1: card.frameH / 2,
  });
  // FOR THE FIT (model/01 fit): the frame's corners and room under it for
  // the bubble, so an empty detail still arrives framed rather than at the
  // page's 6 px/ft default.
  const detailFramePoints = () => {
    if (!isDetailsFile() || !boneyardActive) return [];
    const now = activeDetail();
    if (!now) return [];
    const r = detailFrameRect(now.card);
    const under = Math.max(1, now.card.frameH * 0.22);
    return [{ x: r.x0, z: r.z0 }, { x: r.x1, z: r.z0 }, { x: r.x1, z: r.z1 + under }, { x: r.x0, z: r.z1 + under }];
  };
  const paintDetailFrame = () => {
    if (!isDetailsFile() || !boneyardActive || thumbTarget) return;
    const now = activeDetail();
    if (!now) return;
    const { card, shelf, number } = now;
    const r = detailFrameRect(card);
    const a = toS({ x: r.x0, z: r.z0 });
    const b = toS({ x: r.x1, z: r.z1 });
    const ink = skin['draw-note'] || '#333';
    ctx.save();
    // THE FRAME, dashed: a boundary, not a line of the detail.
    ctx.strokeStyle = skin['draw-selected'] || ink;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([8, 5]);
    ctx.strokeRect(a.x, a.y, b.x - a.x, b.y - a.y);
    ctx.setLineDash([]);
    ctx.fillStyle = ink;
    ctx.font = '11px "DM Mono", monospace';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';
    ctx.fillText(`FRAME ${feetText(card.frameW)} x ${feetText(card.frameH)}`, b.x, a.y - 4);
    // THE BUBBLE UNDER IT (the plan's mockup): number, name, scale. The
    // number is the detail's place in the library for now; on a sheet it
    // will be the sheet's own (step 4).
    const cy = b.y + 26;
    const cx = a.x + 16;
    ctx.strokeStyle = ink;
    ctx.lineWidth = 1.25;
    ctx.beginPath();
    ctx.arc(cx, cy, 14, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx + 14, cy);
    ctx.lineTo(Math.max(cx + 120, b.x), cy);
    ctx.stroke();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '600 13px Barlow, sans-serif';
    ctx.fillText(String(number), cx, cy + 1);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(shelf.name || `DETAIL ${shelf.id}`, cx + 22, cy - 5);
    ctx.font = '11px "DM Mono", monospace';
    ctx.fillText(`SCALE: ${scaleLabel(card.scale)}${card.kind === 'typ' ? '  TYP.' : ''}`, cx + 22, cy + 15);
    ctx.restore();
  };

  // ── STARTING ONE, AND ADDING TO IT ─────────────────────────────────────────
  //
  // THE FIRST DETAIL IS THE SHELF THE FILE ALREADY HAS: an empty SHELF 1 is
  // renamed DETAIL 1 and given the default card, so a fresh library opens on
  // a framed, named detail and not on a shelf called SHELF.
  const isUnnamedShelf = shelf => /^SHELF \d+$/.test(String(shelf?.name || ''));
  const startDetailsLibrary = () => {
    if (!drawing) return;
    if (!drawing.detailsLibrary) drawing.detailsLibrary = DETAILS_DEFAULT_LIBRARY;
    drawing.boneyardShelves = shelves().map(shelf => ({
      ...shelf,
      ...(isUnnamedShelf(shelf) ? { name: `DETAIL ${shelf.id}` } : {}),
      detail: detailCardOf(shelf),
    }));
    markDirty();
    if (detailsToolRefused(activeTool)) setTool(RESTING_TOOL);
    goToBoneyard(activeShelfId());
    refreshToolAvailability();
    fit(false, 0.8);
    paint();
    sayOnStrip('DETAILS LIBRARY — draw the detail inside its frame. + DETAIL adds another; SAVE DETAIL keeps it.');
  };
  const addDetail = () => {
    if (!drawing) return;
    addShelf();
    const id = activeShelfId();
    const shelf = storedShelf(id);
    if (!shelf) return;
    shelf.name = `DETAIL ${id}`;
    // THE NEW DETAIL TAKES THE CATEGORY AND SCALE OF THE ONE BEFORE IT: a
    // drafter adding framing details adds them in a row.
    const was = shelves().filter(sh => Number(sh.id) !== id).slice(-1)[0];
    const from = was ? detailCardOf(was) : null;
    shelf.detail = window.DraftDrawingFormat.detailCard(from
      ? { category: from.category, scale: from.scale } : {});
    markDirty();
    buildChrome();
    fit(false, 0.8);
    paint();
    sayOnStrip(`${shelf.name} — a new detail, framed and empty. Double-click its name to rename it.`);
  };
  const enterDetail = id => {
    goToBoneyard(Number(id));
    fit(false, 0.8);
    paint();
  };

  // ── SAVE DETAIL ────────────────────────────────────────────────────────────
  //
  // PLAIN SAVE FIRST (the drawing in this browser, free), then the library
  // copy, so a house file can reach the library without opening anything
  // from disk. "A web page can't quietly write to a file on your disk": the
  // .draft on disk is SAVE AS, the backup, as for every drawing.
  let detailsStoredAt = null;
  const libraryName = () => String(drawing?.detailsLibrary || DETAILS_DEFAULT_LIBRARY)
    .trim().toUpperCase().replace(/[^A-Z0-9 _-]+/g, '').slice(0, 60) || DETAILS_DEFAULT_LIBRARY;
  const storeLibrary = async () => {
    const name = `${libraryName()}.draft`;
    const text = JSON.stringify(serializeDrawing());
    await window.SharedFileStore.saveNamedFile(
      new File([text], name, { type: 'application/json' }), DETAILS_BUCKET);
    detailsStoredAt = new Date();
    return name;
  };
  const saveDetail = async () => {
    const now = activeDetail();
    if (!now || !drawing) return false;
    const shelf = storedShelf(now.shelf.id);
    if (shelf) {
      shelf.detail = window.DraftDrawingFormat.detailCard({
        ...detailCardOf(shelf), changed: new Date().toISOString().slice(0, 10) });
      markDirty();
    }
    const ok = await save();
    if (!ok) return false;
    try {
      const name = await storeLibrary();
      sayOnStrip(`${now.shelf.name} saved — into ${name} in this browser. SAVE AS keeps a copy on the computer.`);
    } catch (error) {
      console.warn('draft: details library copy failed', error);
      sayOnStrip(`${now.shelf.name} saved in the drawing, but the library copy failed: ${error?.message || error}`);
    }
    buildChrome();
    return true;
  };

  // ── THE PANE: THE DETAILS, AND THE CARD OF THE ONE BEING DRAWN ────────────
  //
  // In place of the LEVELS / LAYERS list (model/05 buildLevelsPanel hands
  // over here on a details file). The DETAILS BOARD -- thumbnails, search,
  // favourites, drag to sort -- is step 3; until then this list is the way
  // between details.
  const el = (tag, props = {}, ...kids) => {
    const node = document.createElement(tag);
    Object.entries(props).forEach(([key, value]) => {
      if (key === 'data') Object.entries(value).forEach(([k, v]) => { node.dataset[k] = v; });
      else if (key in node) node[key] = value;
      else node.setAttribute(key, value);
    });
    kids.flat().forEach(kid => node.append(kid));
    return node;
  };
  const buildDetailsPanel = panel => {
    if (!panel || !drawing) return;
    const list = shelves();
    const activeId = activeShelfId();
    const head = el('div', { className: 'lv-head' },
      el('div', { className: 'lv-head-title', textContent: 'Details' }),
      el('button', { type: 'button', className: 'lv-add', textContent: '+ DETAIL',
        title: 'Add a detail: a new framed detail window', data: { addDetail: '' },
        onclick: event => { event.stopPropagation(); addDetail(); } }));
    const lib = el('div', { className: 'dl-library', data: { detailsLibraryName: '' },
      title: 'The library this file is. SAVE DETAIL keeps a copy of it in this browser under this name.' },
    `LIBRARY: ${libraryName()}`);
    panel.append(head, lib);

    list.forEach((shelf, i) => {
      const card = detailCardOf(shelf);
      const row = el('button', { type: 'button', className: 'lv-layer dl-row',
        data: { detail: String(shelf.id) },
        title: `${shelf.name} — ${card.category} · ${card.kind === 'typ' ? 'TYP.' : 'SPECIAL'}. Double-click to rename.` });
      row.append(el('span', { className: 'dl-num', textContent: String(i + 1) }),
        el('span', { className: 'dl-name', textContent: shelf.name || `DETAIL ${shelf.id}` }),
        el('span', { className: 'dl-cat', textContent: card.category }));
      if (Number(shelf.id) === activeId && boneyardActive) row.toggleAttribute('data-active', true);
      row.addEventListener('click', event => {
        event.stopPropagation();
        if (row.querySelector('input')) return;
        if (Number(shelf.id) === activeId && boneyardActive) return;
        enterDetail(shelf.id);
      });
      row.addEventListener('dblclick', event => {
        event.stopPropagation();
        renameShelf(row, Number(shelf.id));
      });
      panel.append(row);
    });

    const now = activeDetail();
    if (!now) return;
    const { card, shelf } = now;
    const box = el('div', { className: 'dl-card', data: { detailCard: String(shelf.id) } });
    const field = (label, control) => el('label', { className: 'dl-field' },
      el('span', { className: 'dl-label', textContent: label }), control);

    // CATEGORY: typed or picked. The three starters, plus every category the
    // library already uses -- typing a new one IS + CATEGORY.
    const known = [...new Set([...window.DraftDrawingFormat.DETAIL_CATEGORIES,
      ...list.map(sh => detailCardOf(sh).category)])];
    const listId = 'dl-categories';
    const cat = el('input', { type: 'text', value: card.category, data: { detailCategory: '' },
      title: 'FOUNDATION, FRAMING, SITE — or type a new category' });
    cat.setAttribute('list', listId);
    const datalist = el('datalist', { id: listId }, known.map(c => el('option', { value: c })));
    cat.addEventListener('change', () => writeCard({ category: cat.value }, `Category: ${cat.value.trim().toUpperCase()}.`));

    const kindRow = el('div', { className: 'dl-chips' }, ['typ', 'special'].map(kind =>
      el('button', { type: 'button', className: 'lv-add dl-chip', textContent: kind === 'typ' ? 'TYP.' : 'SPECIAL',
        data: { detailKind: kind }, 'aria-pressed': String(card.kind === kind),
        onclick: () => writeCard({ kind }) })));

    // THE FRAME, in feet and inches as every length on this page is typed.
    const frameBox = (key, label) => {
      const input = el('input', { type: 'text', value: feetText(card[key]), data: { detailFrame: key },
        title: `Frame ${label}: feet and inches, e.g. 4' or 2'-6"` });
      input.addEventListener('change', () => {
        const read = window.DraftFormatters.parseArchitecturalLength(input.value);
        if (!read.ok || read.inches <= 0) { input.value = feetText(card[key]); sayOnStrip(read.error || 'Type a frame size such as 4\' or 2\'-6".'); return; }
        writeCard({ [key]: read.inches / 12 });
        fit(false, 0.8);
        paint();
      });
      return input;
    };
    const frameRow = el('div', { className: 'dl-frame' }, frameBox('frameW', 'width'),
      el('span', { textContent: 'x' }), frameBox('frameH', 'height'));

    const scale = el('select', { data: { detailScale: '' }, title: 'The scale the detail is drawn at, and lands on a sheet at' },
      window.DraftDrawingFormat.DETAIL_SCALES.map(s => el('option', { value: String(s), textContent: scaleLabel(s), selected: s === card.scale })));
    scale.addEventListener('change', () => writeCard({ scale: Number(scale.value) }, `Scale: ${scaleLabel(Number(scale.value))}.`));

    const tags = el('input', { type: 'text', value: card.tags.join(', '), data: { detailTags: '' },
      placeholder: 'basement, egress', title: 'Words to find it by, separated by commas' });
    tags.addEventListener('change', () => writeCard({ tags: tags.value }));

    const note = el('textarea', { rows: 3, value: card.note, data: { detailNote: '' },
      placeholder: 'When to use this detail', title: 'A short note kept on the detail\'s card' });
    note.addEventListener('change', () => writeCard({ note: note.value }));

    const saveBtn = el('button', { type: 'button', className: 'lv-add dl-save', textContent: 'SAVE DETAIL',
      data: { saveDetail: '' }, title: 'Save the drawing in this browser and keep a copy of the library for house files (free)',
      onclick: event => { event.stopPropagation(); saveDetail(); } });
    const status = el('div', { className: 'dl-status', data: { detailStatus: '' } },
      card.changed ? `CHANGED ${card.changed}` : 'NOT SAVED AS A DETAIL YET',
      detailsStoredAt ? ` · LIBRARY COPY ${detailsStoredAt.toTimeString().slice(0, 5)}` : '');

    box.append(
      el('div', { className: 'lv-head-title dl-card-title', textContent: `Detail card — ${shelf.name}` }),
      field('CATEGORY', cat), datalist,
      field('KIND', kindRow),
      field('FRAME', frameRow),
      field('SCALE', scale),
      field('TAGS', tags),
      field('NOTE', note),
      saveBtn, status);
    panel.append(box);
    syncDetailsKeys();
  };

  // THE SITE PLAN KEY at the foot of the BUILD keys is not a roster tool, so
  // the availability walk does not reach it: it is put down here.
  const syncDetailsKeys = () => {
    document.querySelectorAll('[data-site-plan-key]').forEach(btn => {
      btn.disabled = isDetailsFile();
    });
  };

  // THIS PART LOADS AFTER THE BOOT HAS STARTED: a details file already up
  // when it arrives is drawn again now that its painters exist.
  if (isDetailsFile()) {
    boneyardActive = true;
    refreshToolAvailability();
    buildChrome();
    fit(false, 0.8);
    paint();
  }
