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
// notes". The plan he approved the same day ("go for it") is five steps:
// step 2 is this file kind and the DETAIL window, step 3 the DETAILS BOARD
// (the second half of this file). Details on LAYOUT sheets and MAKE DETAIL
// from a section come after it.
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
    if (now) writeCardOf(now.shelf.id, patch, say);
  };
  const writeCardOf = (shelfId, patch, say = null) => {
    const shelf = storedShelf(shelfId);
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

  // ── A DETAIL FROM A SNAPSHOT ───────────────────────────────────────────────
  //
  // jb, 20 Nov 2026: "take a 'snapshot' of the elevation or section and have
  // it pop up in the DETAIL area as a new detail" -- "(that can be further
  // edited - not a window that shows what exists there, but takes a snapshot
  // and copies the lines over so they can be edited and new details added
  // too" -- "it will only be used to get information for drawing the details
  // which will be stand alone files".
  //
  // THE CAMERA IS IN THE HOUSE'S FILE AND THE DETAIL IS IN THIS ONE, so the
  // picture waits in a tray in the browser's store (detail-snapshot.js) and
  // is picked up here: SNAPSHOTS in the pane's head lists what is waiting,
  // each with a small drawing of itself, and USE makes a detail of one.
  //
  // WHAT USE DOES. A new detail, named for the view the picture was taken of,
  // with its frame set to the box that was dragged; and the picture's lines
  // drawn in it as this file's OWN LINES -- "copies the lines over so they
  // can be edited". Full size, centred in the frame as they were centred in
  // the box, each on the layer SNAPSHOT so they can be told from what is
  // drawn over them. Its words come as notes. Nothing links back to the
  // house: a picture does not update, which is what he asked of it.
  //
  // NOT ONE ASSEMBLY, where TRACE's EDITABLE makes one. A DXF dropped on a
  // plan has to be dragged into place and so moves as one; these land where
  // they belong and are there to be worked on a line at a time.
  //
  // THE PICTURE STAYS IN THE TRAY after it is used -- a second detail can
  // start from the same one -- until its X is pressed or the tray, which
  // holds two dozen, lets it go.
  let snapshotTray = [];
  let snapshotTrayOpen = false;
  const readSnapshotTray = async () => {
    const DS = window.DraftDetailSnapshot;
    if (!DS) return snapshotTray;
    try { snapshotTray = await DS.list(); } catch (error) {
      console.warn('draft: the snapshot tray could not be read', error);
      snapshotTray = [];
    }
    return snapshotTray;
  };
  // A NAME NOT ALREADY ON A DETAIL: 'S1 SNAPSHOT', then 'S1 SNAPSHOT 2'.
  const freeDetailName = base => {
    const taken = new Set(shelves().map(sh => String(sh.name || '').toUpperCase()));
    if (!taken.has(base.toUpperCase())) return base;
    let n = 2;
    while (taken.has(`${base} ${n}`.toUpperCase())) n += 1;
    return `${base} ${n}`;
  };
  // The frame is kept to the quarter inch (drawing-format.js); rounded UP,
  // so the line that ran to the edge of the box is inside it.
  const frameOver = ft => Math.ceil(Number(ft) * 48 - 1e-6) / 48;
  const addDetailFromSnapshot = rec => {
    if (!drawing || !rec) return false;
    let geo;
    try {
      geo = window.DraftDxfReader.parse(rec.dxf, { segments: true });
    } catch (error) {
      sayOnStrip(`That snapshot could not be read: ${error?.message || 'not a picture this can open'}.`);
      return false;
    }
    addDetail();
    const id = activeShelfId();
    const shelf = storedShelf(id);
    if (!shelf) return false;
    shelf.name = freeDetailName(String(rec.name || 'SNAPSHOT').trim() || 'SNAPSHOT');
    shelf.detail = window.DraftDrawingFormat.detailCard({
      ...detailCardOf(shelf),
      frameW: frameOver(rec.widthFt), frameH: frameOver(rec.heightFt),
      note: `From a snapshot of ${rec.cut || 'a view'}${rec.from ? ` in ${rec.from}` : ''}, `
        + `taken ${String(rec.takenAt || '').slice(0, 10)}.`,
    });
    // INCHES, Y UP, FROM THE BOX'S CENTRE, which is how the camera files it:
    // feet on this sheet, z down, from the frame's centre.
    const toWorld = ([x, y]) => ({ x: x / 12, z: -y / 12 });
    const { levelId, viewId } = onActiveLevel();
    const lineView = lineHomeView(viewId);
    drawing.lines = drawing.lines || [];
    const made = window.DraftDxfReader.piecesToLines(geo.segments, toWorld).map(seg => ({
      id: newDrawingItemId('line'),
      start: seg.start, end: seg.end,
      levelId, view: lineView,
      layer: 'SNAPSHOT',
      importedFrom: rec.name,
      ...(seg.bulge ? { bulge: seg.bulge } : {}),
    }));
    made.forEach(line => drawing.lines.push(line));
    drawing.notes = drawing.notes || [];
    let noteId = drawing.notes.reduce((top, n) => Math.max(top, Number(n.id) || 0), 0);
    const lettered = (geo.texts || []).filter(t => t.lines.join('').trim() && Number(t.h) > 0).map(t => {
      const p = toWorld([t.x, t.y]);
      return {
        id: (noteId += 1), anchor: p, text: { ...p }, levelId, view: lineView,
        body: t.lines.map(line => line.trimEnd()).join('\n').trim(), end: 'none',
        fill: false, fillOpacity: 0.85, outline: false, bullnose: 0,
        heightFt: t.h / 12, rot: Number(t.rot) || 0,
        align: t.align || 'left', baseline: t.baseline || 'alphabetic',
        layer: 'A-ANNO-NOTE',
      };
    });
    lettered.forEach(note => drawing.notes.push(note));
    undoStack.push({ kind: 'built', walls: [], outlines: [], list: null, openings: [],
      items: [...made.map(item => ({ list: drawing.lines, item })),
        ...lettered.map(item => ({ list: drawing.notes, item }))] });
    snapshotTrayOpen = false;
    markDirty();
    // INTO THE DETAIL'S WINDOW, as the board's own + DETAIL goes: a library
    // opens on its board, and a detail made behind the board is not seen.
    closeDetailsBoard();
    buildChrome();
    fit(false, 0.8);
    paint();
    if (typeof updateReadout === 'function') updateReadout();
    sayOnStrip(`${shelf.name} — a new detail from the snapshot: ${made.length.toLocaleString()} line${made.length === 1 ? '' : 's'}`
      + `${lettered.length ? ` and ${lettered.length} note${lettered.length === 1 ? '' : 's'}` : ''}, yours to edit. `
      + 'Draw over them, change them, delete what you do not want.');
    return true;
  };
  // A SMALL DRAWING OF THE PICTURE, so three snapshots of S1 can be told
  // apart: its lines fitted to the chip, in the page's ink.
  const paintSnapshotThumb = (screen, rec) => {
    let geo;
    try { geo = window.DraftDxfReader.parse(rec.dxf, { segments: true }); } catch { return; }
    const W = Math.max(rec.widthFt * 12, 1), H = Math.max(rec.heightFt * 12, 1);
    const ratio = window.devicePixelRatio || 1;
    const cw = screen.clientWidth || 56, ch = screen.clientHeight || 42;
    screen.width = Math.round(cw * ratio);
    screen.height = Math.round(ch * ratio);
    const g = screen.getContext('2d');
    g.setTransform(ratio, 0, 0, ratio, 0, 0);
    g.clearRect(0, 0, cw, ch);
    const k = Math.min((cw - 4) / W, (ch - 4) / H);
    const X = x => cw / 2 + x * k, Y = y => ch / 2 - y * k;
    g.strokeStyle = skin['draw-note'] || '#333';
    g.lineWidth = 0.75;
    g.beginPath();
    geo.segments.forEach(s => { g.moveTo(X(s.a[0]), Y(s.a[1])); g.lineTo(X(s.b[0]), Y(s.b[1])); });
    g.stroke();
    screen.dataset.snapshotThumbLines = String(geo.segments.length);
  };
  const buildSnapshotTray = () => {
    const DS = window.DraftDetailSnapshot;
    const box = el('div', { className: 'dl-tray', data: { snapshotTray: '' } });
    if (!snapshotTray.length) {
      box.append(el('div', { className: 'dl-status', data: { snapshotTrayEmpty: '' } },
        'No snapshots waiting. In a house\'s file, open an elevation or a section, press the DETAIL SNAPSHOT key '
        + '(the square with a circle in it) and drag a box round the part you want.'));
      return box;
    }
    // THE NEWEST FIRST: the one he just took is the one he came here for.
    [...snapshotTray].reverse().forEach(rec => {
      const thumb = el('canvas', { className: 'dl-tray-thumb', data: { snapshotThumb: rec.id } });
      const size = `${feetText(rec.widthFt)} x ${feetText(rec.heightFt)}`;
      const row = el('div', { className: 'dl-tray-row', data: { snapshot: rec.id },
        title: `${rec.name} — ${size}, ${rec.lines} lines, taken ${String(rec.takenAt || '').slice(0, 16).replace('T', ' ')}` },
      thumb,
      el('div', { className: 'dl-tray-what' },
        el('span', { className: 'dl-name', textContent: rec.name }),
        el('span', { className: 'dl-cat', textContent: size })),
      el('button', { type: 'button', className: 'lv-add', textContent: 'USE',
        title: 'Make a new detail from this snapshot: its lines, yours to edit', data: { snapshotUse: rec.id },
        onclick: event => { event.stopPropagation(); addDetailFromSnapshot(rec); } }),
      el('button', { type: 'button', className: 'lv-add', textContent: 'X',
        title: 'Throw this snapshot away', data: { snapshotDrop: rec.id },
        onclick: async event => {
          event.stopPropagation();
          try { await DS.remove(rec.id); } catch (error) { console.warn('draft: snapshot not removed', error); }
          await readSnapshotTray();
          buildChrome();
          sayOnStrip(`${rec.name} thrown away. ${snapshotTray.length} left in the tray.`);
        } }));
      box.append(row);
      // Painted once it is in the page and has a size to be painted at.
      requestAnimationFrame(() => paintSnapshotThumb(thumb, rec));
    });
    return box;
  };
  // THE TRAY IS READ WHEN A DETAILS FILE COMES UP, and again whenever it
  // changes -- the camera is usually in another tab, and a picture taken
  // there should be waiting here without a reload.
  let snapshotTrayWatched = false;
  const watchSnapshotTray = () => {
    const DS = window.DraftDetailSnapshot;
    if (snapshotTrayWatched || !DS || !window.SharedFileStore) return;
    snapshotTrayWatched = true;
    const refresh = async () => {
      const before = snapshotTray.map(r => r.id).join();
      await readSnapshotTray();
      if (isDetailsFile() && snapshotTray.map(r => r.id).join() !== before) buildChrome();
    };
    window.SharedFileStore.onBucketChanged(DS.BUCKET, refresh);
    refresh();
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
  // over here on a details file). The DETAILS BOARD below is where details
  // are found and arranged; this list is the quick way between them while
  // drawing, and its BOARD button goes back to the board.
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
      el('button', { type: 'button', className: 'lv-add', textContent: 'BOARD',
        title: 'Back to the DETAILS BOARD: every detail as a card', data: { openBoard: '' },
        onclick: event => { event.stopPropagation(); openDetailsBoard(); } }),
      el('button', { type: 'button', className: 'lv-add', textContent: '+ DETAIL',
        title: 'Add a detail: a new framed detail window', data: { addDetail: '' },
        onclick: event => { event.stopPropagation(); addDetail(); } }));
    const lib = el('div', { className: 'dl-library', data: { detailsLibraryName: '' },
      title: 'The library this file is. SAVE DETAIL keeps a copy of it in this browser under this name.' },
    `LIBRARY: ${libraryName()}`);
    // SNAPSHOTS: what the camera has left waiting (jb, 20 Nov 2026). On its
    // own line under the head, with the count on its face, so a picture taken
    // a minute ago in the house's file is seen to have arrived.
    watchSnapshotTray();
    const trayKey = el('button', { type: 'button', className: 'lv-add dl-tray-key',
      textContent: `SNAPSHOTS (${snapshotTray.length})`,
      title: 'Pictures taken with DETAIL SNAPSHOT on an elevation or section, waiting to be made into details',
      data: { openSnapshots: '', snapshotCount: String(snapshotTray.length) },
      'aria-expanded': String(snapshotTrayOpen),
      onclick: event => { event.stopPropagation(); snapshotTrayOpen = !snapshotTrayOpen; buildChrome(); } });
    if (snapshotTray.length) trayKey.toggleAttribute('data-waiting', true);
    panel.append(head, lib, trayKey);
    if (snapshotTrayOpen) panel.append(buildSnapshotTray());

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

    syncDetailsBoard();
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

  // ══ THE DETAILS BOARD (step 3 of jb's plan, 19 Nov 2026) ══════════════════
  //
  // "i'd like a database type organization system so that they can be
  // arranged easily": every detail of the library as a card, over the
  // drawing area, in place of the plan. The plan's mockup is followed: the
  // CATEGORIES down the LEFT of the board, search and buttons across the
  // top, the cards filling the rest, the picked one outlined in the accent.
  //
  //   - A CARD is a detail's thumbnail (its frame and what is drawn in it,
  //     by the plan's own painters), its number, name, category, TYP. or
  //     SPECIAL, scale and tags, and a star for FAVOURITES.
  //   - CLICK picks a card; DOUBLE-CLICK opens its DETAIL window. The window's
  //     BOARD button comes back to the same category, search and scroll.
  //   - SORT is by hand: drag a card onto another and the library's order is
  //     saved (the order of the shelves, so the bubble numbers follow it). A
  //     card dropped on a category on the left moves to that category. NAME
  //     and LAST CHANGED only show the cards in another order.
  //   - RIGHT-CLICK a card: OPEN, RENAME, FAVOURITE, TYP. / SPECIAL, MOVE TO a
  //     category, DELETE (pressed twice).
  //   - + CATEGORY adds one to the rail, kept in the file even while empty.
  //
  // Every edit is the file's, and every one but DELETE is one UNDO.
  const DB_ALL = 'ALL';
  const DB_FAVOURITES = 'FAVOURITES';
  const DB_SORTS = [['hand', 'BY HAND'], ['name', 'NAME'], ['changed', 'LAST CHANGED']];
  let boardOpen = false;
  let boardNode = null;
  let boardMenu = null;
  // WHERE THE DRAFTER WAS ON THE BOARD, so BOARD from a detail comes back to
  // it: the category, the search, TYP. / SPECIAL, the sort, the scroll and
  // the picked card.
  const boardView = { category: DB_ALL, search: '', kind: 'all', sort: 'hand', scroll: 0, picked: null };
  let boardDrag = null;

  const boardCategories = () => {
    const F = window.DraftDrawingFormat;
    const own = Array.isArray(drawing?.detailCategories) ? drawing.detailCategories : [];
    return [...new Set([...F.DETAIL_CATEGORIES, ...own.map(c => String(c || '').trim().toUpperCase()).filter(Boolean),
      ...shelves().map(sh => detailCardOf(sh).category)])];
  };
  // THE CARDS THE BOARD SHOWS, with each one's place in the library (the
  // bubble's number), filtered and ordered the way the board is set.
  const boardCards = () => {
    const q = boardView.search.trim().toLowerCase();
    const rows = shelves().map((shelf, i) => ({ shelf, card: detailCardOf(shelf), number: i + 1 }));
    const shown = rows.filter(({ shelf, card }) => {
      if (boardView.category === DB_FAVOURITES && !card.favourite) return false;
      if (boardView.category !== DB_ALL && boardView.category !== DB_FAVOURITES
        && card.category !== boardView.category) return false;
      if (boardView.kind !== 'all' && card.kind !== boardView.kind) return false;
      if (!q) return true;
      const words = [shelf.name, card.category, card.note, ...card.tags].join(' ').toLowerCase();
      return q.split(/\s+/).every(w => words.includes(w));
    });
    if (boardView.sort === 'name') shown.sort((a, b) => String(a.shelf.name).localeCompare(String(b.shelf.name)));
    if (boardView.sort === 'changed') shown.sort((a, b) => String(b.card.changed || '').localeCompare(String(a.card.changed || '')));
    return shown;
  };

  // A DETAIL IN MINIATURE, by the painters that draw it full size -- the
  // swap paintPlanThumb (model/05) makes, framed on the detail's frame
  // rather than on what is drawn, so an empty detail is an empty frame.
  const paintDetailThumb = (screen, shelf) => {
    const card = detailCardOf(shelf);
    const savedCtx = ctx, savedW = cssW, savedH = cssH, savedDpr = dpr;
    const savedView = { cx: view.cx, cz: view.cz, scale: view.scale };
    try {
      thumbTarget = { levelId: -Number(shelf.id), viewId: null };
      ctx = screen.getContext('2d');
      dpr = 2; cssW = screen.width / dpr; cssH = screen.height / dpr;
      ctx.save();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, cssW, cssH);
      view.cx = 0; view.cz = 0;
      view.scale = Math.min((cssW - 12) / card.frameW, (cssH - 12) / card.frameH);
      paintShapes(); paintLines(); paintNotes(); paintDimensions();
      const r = detailFrameRect(card);
      const a = toS({ x: r.x0, z: r.z0 });
      const b = toS({ x: r.x1, z: r.z1 });
      ctx.strokeStyle = skin['draw-selected'] || skin['draw-note'] || '#888';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 3]);
      ctx.strokeRect(a.x, a.y, b.x - a.x, b.y - a.y);
      ctx.restore();
    } finally {
      ctx = savedCtx; cssW = savedW; cssH = savedH; dpr = savedDpr;
      view.cx = savedView.cx; view.cz = savedView.cz; view.scale = savedView.scale;
      thumbTarget = null;
    }
  };

  // THE BOARD COVERS THE DRAWING AREA and nothing else: between the left
  // tabs and the right pane, under the top bar and over the foot lane.
  const placeBoard = () => {
    if (!boardNode || boardNode.hidden) return;
    const box = canvas.getBoundingClientRect();
    const rect = sel => {
      const node = document.querySelector(sel);
      if (!node || node.hidden) return null;
      const r = node.getBoundingClientRect();
      return r.width > 0 && r.height > 0 ? r : null;
    };
    const top = Math.max(box.top, (rect('#save')?.bottom || 0) + 10);
    // THE RAILS AND THEIR TABS, open or shut, on whichever side they stand.
    let left = box.left + 8, right = box.right - 8;
    const mid = box.left + box.width / 2;
    document.querySelectorAll('#left-rail, #right-rail, .rail-tab').forEach(node => {
      if (node.hidden || node.closest('[hidden]')) return;
      const r = node.getBoundingClientRect();
      if (!(r.width > 0 && r.height > 0)) return;
      if (r.right < mid) left = Math.max(left, r.right + 8);
      else if (r.left > mid) right = Math.min(right, r.left - 8);
    });
    const strip = rect('#house-strip');
    const bottom = Math.min(box.bottom, strip ? strip.top : box.bottom) - 8;
    Object.assign(boardNode.style, { left: `${left}px`, top: `${top}px`,
      width: `${Math.max(240, right - left)}px`, height: `${Math.max(200, bottom - top)}px` });
  };

  const closeBoardMenu = () => { if (boardMenu) boardMenu.hidden = true; };
  const openBoardMenu = (shelfId, x, y) => {
    const shelf = shelves().find(sh => Number(sh.id) === Number(shelfId));
    if (!shelf) return;
    const card = detailCardOf(shelf);
    if (!boardMenu) {
      boardMenu = el('div', { id: 'details-board-menu', data: { boardMenu: '' } });
      boardMenu.hidden = true;
      document.body.append(boardMenu);
      document.addEventListener('pointerdown', event => {
        if (boardMenu && !boardMenu.hidden && !boardMenu.contains(event.target)) closeBoardMenu();
      }, true);
    }
    const item = (label, key, act, extra = {}) => el('button', { type: 'button', textContent: label,
      data: { boardAct: key }, ...extra,
      onclick: event => { event.stopPropagation(); act(event.currentTarget); } });
    boardMenu.textContent = '';
    boardMenu.append(
      item('OPEN', 'open', () => { closeBoardMenu(); openDetailFromBoard(shelf.id); }),
      item('RENAME', 'rename', () => {
        closeBoardMenu();
        const name = boardNode?.querySelector(`[data-board-card="${shelf.id}"] .db-name`);
        if (name) renameShelf(name, Number(shelf.id));
      }),
      item(card.favourite ? 'UNFAVOURITE' : 'FAVOURITE', 'favourite', () => {
        closeBoardMenu();
        writeCardOf(shelf.id, { favourite: !card.favourite },
          `${shelf.name} ${card.favourite ? 'is no longer a favourite' : 'is a favourite'}.`);
      }),
      item(card.kind === 'typ' ? 'MAKE SPECIAL' : 'MAKE TYP.', 'kind', () => {
        closeBoardMenu();
        const kind = card.kind === 'typ' ? 'special' : 'typ';
        writeCardOf(shelf.id, { kind }, `${shelf.name} is ${kind === 'typ' ? 'TYP.' : 'SPECIAL'} now.`);
      }),
      el('div', { className: 'line-menu-rule' }),
      el('div', { className: 'db-menu-label', textContent: 'MOVE TO' }),
      ...boardCategories().map(c => item(c, `move:${c}`, () => {
        closeBoardMenu();
        writeCardOf(shelf.id, { category: c }, `${shelf.name} moved to ${c}.`);
      }, { disabled: c === card.category })),
      el('div', { className: 'line-menu-rule' }),
      // DELETE TAKES TWO PRESSES: closing a shelf takes its drawing with it
      // and the history with it (closeShelf, model/05), so it is not an
      // UNDO away.
      item('DELETE', 'delete', btn => {
        if (btn.dataset.armed !== undefined) {
          closeBoardMenu();
          if (boardView.picked === Number(shelf.id)) boardView.picked = null;
          closeShelf(Number(shelf.id));
          boneyardActive = true;
          syncDetailsBoard();
          return;
        }
        btn.dataset.armed = '';
        btn.textContent = 'DELETE? PRESS AGAIN';
      }));
    boardMenu.hidden = false;
    const r = boardMenu.getBoundingClientRect();
    boardMenu.style.left = `${Math.min(x, window.innerWidth - r.width - 6)}px`;
    boardMenu.style.top = `${Math.min(y, window.innerHeight - r.height - 6)}px`;
  };

  // A CARD DRAGGED ONTO A CARD takes its place in the library, before it or
  // after it by which half it lands on. One UNDO, as TO FRONT / TO BACK is.
  const moveDetail = (fromId, toId, after) => {
    if (Number(fromId) === Number(toId) || !drawing) return false;
    drawing.boneyardShelves = shelves();
    const list = drawing.boneyardShelves;
    const before = list.slice();
    const from = list.findIndex(sh => Number(sh.id) === Number(fromId));
    if (from < 0) return false;
    const [moving] = list.splice(from, 1);
    let to = list.findIndex(sh => Number(sh.id) === Number(toId));
    if (to < 0) { list.splice(from, 0, moving); return false; }
    if (after) to += 1;
    list.splice(to, 0, moving);
    undoStack.push({ kind: 'reorder', lists: [{ list, before }] });
    markDirty();
    sayOnStrip(`${moving.name} is detail ${to + 1} now.`);
    buildChrome();
    paint();
    return true;
  };

  const openDetailFromBoard = shelfId => {
    boardView.picked = Number(shelfId);
    closeDetailsBoard();
    enterDetail(shelfId);
  };

  const addCategory = () => {
    const rail = boardNode?.querySelector('[data-board-rail]');
    if (!rail || rail.querySelector('[data-board-new-category]')) return;
    const box = el('input', { type: 'text', placeholder: 'NEW CATEGORY', data: { boardNewCategory: '' } });
    rail.querySelector('[data-board-add-category]')?.before(box);
    box.focus();
    let done = false;
    const finish = keep => {
      if (done) return;
      done = true;
      const name = box.value.trim().toUpperCase().slice(0, 40);
      if (keep && name && !boardCategories().includes(name)) {
        drawing.detailCategories = [...(Array.isArray(drawing.detailCategories) ? drawing.detailCategories : []), name];
        boardView.category = name;
        markDirty();
        sayOnStrip(`${name} added. Drag a card onto it, or MOVE TO on a card's menu.`);
      }
      syncDetailsBoard();
    };
    box.addEventListener('keydown', event => {
      event.stopPropagation();
      if (event.key === 'Enter') finish(true);
      if (event.key === 'Escape') finish(false);
    });
    box.addEventListener('blur', () => finish(true));
  };

  const buildBoard = () => {
    if (!boardNode) {
      boardNode = el('section', { id: 'details-board', data: { detailsBoard: '' } });
      boardNode.hidden = true;
      document.body.append(boardNode);
      window.addEventListener('resize', placeBoard);
    }
    const keepScroll = boardNode.querySelector('[data-board-grid]')?.scrollTop;
    if (keepScroll != null) boardView.scroll = keepScroll;
    boardNode.textContent = '';
    const all = shelves();
    const cats = boardCategories();
    if (![DB_ALL, DB_FAVOURITES, ...cats].includes(boardView.category)) boardView.category = DB_ALL;

    // THE RAIL: ALL, FAVOURITES, then each category, with how many each holds.
    const count = c => all.filter(sh => {
      const card = detailCardOf(sh);
      return c === DB_ALL || (c === DB_FAVOURITES ? card.favourite : card.category === c);
    }).length;
    const railButton = c => {
      const btn = el('button', { type: 'button', className: 'db-cat', data: { boardCategory: c },
        'aria-pressed': String(boardView.category === c),
        onclick: () => { boardView.category = c; boardView.scroll = 0; syncDetailsBoard(); } },
      el('span', { textContent: c === DB_FAVOURITES ? '★ FAVOURITES' : c }),
      el('span', { className: 'db-count', textContent: String(count(c)) }));
      // A CARD DROPPED ON A CATEGORY MOVES TO IT (not on ALL or FAVOURITES,
      // which are not categories a card has).
      if (c !== DB_ALL && c !== DB_FAVOURITES) {
        btn.addEventListener('dragover', event => { if (boardDrag != null) { event.preventDefault(); btn.dataset.dropOn = ''; } });
        btn.addEventListener('dragleave', () => { delete btn.dataset.dropOn; });
        btn.addEventListener('drop', event => {
          event.preventDefault();
          delete btn.dataset.dropOn;
          const id = boardDrag;
          boardDrag = null;
          const shelf = all.find(sh => Number(sh.id) === Number(id));
          if (shelf) writeCardOf(id, { category: c }, `${shelf.name} moved to ${c}.`);
        });
      }
      return btn;
    };
    const rail = el('div', { className: 'db-rail', data: { boardRail: '' } },
      el('div', { className: 'db-rail-title', textContent: 'CATEGORIES' }),
      railButton(DB_ALL), railButton(DB_FAVOURITES),
      el('div', { className: 'line-menu-rule' }),
      cats.map(railButton),
      el('button', { type: 'button', className: 'db-add-category', textContent: '+ CATEGORY',
        data: { boardAddCategory: '' }, onclick: addCategory }));

    // THE TOP: the library's name, search, TYP. / SPECIAL, sort, + DETAIL, SAVE.
    const search = el('input', { type: 'search', value: boardView.search, placeholder: 'SEARCH NAME, TAG, NOTE',
      data: { boardSearch: '' } });
    search.addEventListener('input', () => {
      boardView.search = search.value;
      fillGrid();
    });
    search.addEventListener('keydown', event => event.stopPropagation());
    const kinds = el('div', { className: 'dl-chips' }, [['all', 'ALL'], ['typ', 'TYP.'], ['special', 'SPECIAL']]
      .map(([kind, label]) => el('button', { type: 'button', className: 'lv-add dl-chip', textContent: label,
        data: { boardKind: kind }, 'aria-pressed': String(boardView.kind === kind),
        onclick: () => { boardView.kind = kind; syncDetailsBoard(); } })));
    const sort = el('select', { data: { boardSort: '' }, title: 'BY HAND is the library\'s own order: drag a card to change it' },
      DB_SORTS.map(([key, label]) => el('option', { value: key, textContent: `SORT: ${label}`, selected: boardView.sort === key })));
    sort.addEventListener('change', () => { boardView.sort = sort.value; syncDetailsBoard(); });
    const top = el('div', { className: 'db-top' },
      el('div', { className: 'db-title' }, el('strong', { textContent: 'DETAILS BOARD' }),
        el('span', { textContent: ` LIBRARY: ${libraryName()}` })),
      search, kinds, sort,
      el('button', { type: 'button', className: 'lv-add db-btn', textContent: '+ DETAIL', data: { boardAdd: '' },
        title: 'A new framed detail in the category on view',
        onclick: () => {
          const c = boardView.category;
          addDetail();
          if (c !== DB_ALL && c !== DB_FAVOURITES) writeCard({ category: c });
          closeDetailsBoard();
        } }),
      el('button', { type: 'button', className: 'lv-add db-btn', textContent: 'SAVE LIBRARY', data: { boardSave: '' },
        title: 'Save the drawing in this browser and keep a copy of the library for house files (free)',
        onclick: () => { saveLibrary(); } }));
    const grid = el('div', { className: 'db-grid', data: { boardGrid: '' } });
    const foot = el('div', { className: 'db-foot', data: { boardFoot: '' } });
    boardNode.append(rail, el('div', { className: 'db-main' }, top, grid, foot));

    const fillGrid = () => {
      grid.textContent = '';
      const shown = boardCards();
      foot.textContent = `${all.length} DETAIL${all.length === 1 ? '' : 'S'} · ${shown.length} SHOWN`
        + ' · DOUBLE-CLICK TO OPEN · DRAG TO SORT · RIGHT-CLICK FOR MORE';
      if (!shown.length) {
        grid.append(el('div', { className: 'db-empty', textContent: all.length
          ? 'No detail matches. Clear the search or pick ALL.' : 'No details yet. + DETAIL starts one.' }));
        return;
      }
      shown.forEach(({ shelf, card, number }) => {
        const id = Number(shelf.id);
        const screen = el('canvas', { className: 'db-thumb', width: 360, height: 280 });
        const star = el('button', { type: 'button', className: 'db-star', textContent: card.favourite ? '★' : '☆',
          data: { boardFavourite: String(id) }, 'aria-pressed': String(!!card.favourite),
          title: card.favourite ? 'A favourite: press to take it off' : 'Make it a favourite',
          onclick: event => {
            event.stopPropagation();
            writeCardOf(id, { favourite: !card.favourite });
          } });
        const node = el('div', { className: 'db-card', data: { boardCard: String(id) }, draggable: true, tabIndex: 0,
          title: `${shelf.name}${card.note ? ` — ${card.note}` : ''}` },
        screen,
        el('div', { className: 'db-meta' },
          el('div', { className: 'db-line' }, el('span', { className: 'db-num', textContent: String(number) }),
            el('span', { className: 'db-name', textContent: shelf.name || `DETAIL ${id}` }), star),
          el('div', { className: 'db-sub', textContent:
            `${card.category} · ${card.kind === 'typ' ? 'TYP.' : 'SPECIAL'} · ${scaleLabel(card.scale)}` }),
          card.tags.length ? el('div', { className: 'db-tags', textContent: card.tags.join(', ') }) : ''));
        if (boardView.picked === id) node.dataset.picked = '';
        node.addEventListener('click', () => {
          boardView.picked = id;
          grid.querySelectorAll('[data-picked]').forEach(n => delete n.dataset.picked);
          node.dataset.picked = '';
        });
        node.addEventListener('dblclick', event => {
          if (event.target.closest('input, .db-star')) return;
          openDetailFromBoard(id);
        });
        node.addEventListener('keydown', event => {
          if (event.key === 'Enter' && !event.target.closest('input')) { event.stopPropagation(); openDetailFromBoard(id); }
        });
        node.addEventListener('contextmenu', event => {
          event.preventDefault();
          boardView.picked = id;
          openBoardMenu(id, event.clientX, event.clientY);
        });
        node.addEventListener('dragstart', event => {
          boardDrag = id;
          event.dataTransfer.effectAllowed = 'move';
          event.dataTransfer.setData('text/plain', String(id));
          node.dataset.dragging = '';
        });
        node.addEventListener('dragend', () => { boardDrag = null; delete node.dataset.dragging; });
        node.addEventListener('dragover', event => {
          if (boardDrag == null || boardDrag === id) return;
          event.preventDefault();
          const r = node.getBoundingClientRect();
          node.dataset.dropSide = event.clientX > r.left + r.width / 2 ? 'after' : 'before';
        });
        node.addEventListener('dragleave', () => { delete node.dataset.dropSide; });
        node.addEventListener('drop', event => {
          event.preventDefault();
          const after = node.dataset.dropSide === 'after';
          delete node.dataset.dropSide;
          const from = boardDrag;
          boardDrag = null;
          if (from == null) return;
          // BY HAND ONLY: under NAME or LAST CHANGED the cards are not in
          // the library's order, so a drop there would land somewhere the
          // drafter cannot see.
          if (boardView.sort !== 'hand') {
            sayOnStrip('Cards drag into place under SORT: BY HAND only.');
            return;
          }
          moveDetail(from, id, after);
        });
        grid.append(node);
        try { paintDetailThumb(screen, shelf); } catch (error) { console.warn('draft: detail thumbnail failed', error); }
      });
      grid.scrollTop = boardView.scroll;
    };
    fillGrid();
  };

  const saveLibrary = async () => {
    const ok = await save();
    if (!ok) return false;
    try {
      const stored = await storeLibrary();
      sayOnStrip(`The library is saved — into ${stored} in this browser. SAVE AS keeps a copy on the computer.`);
    } catch (error) {
      console.warn('draft: details library copy failed', error);
      sayOnStrip(`Saved in the drawing, but the library copy failed: ${error?.message || error}`);
    }
    syncDetailsBoard();
    return true;
  };

  // THE ONE PLACE THE BOARD IS SHOWN OR PUT AWAY, called from every rebuild
  // (buildDetailsPanel) so it never shows a card the file no longer has.
  const syncDetailsBoard = () => {
    const show = boardOpen && isDetailsFile();
    if (!show) {
      if (boardNode && !boardNode.hidden) {
        const grid = boardNode.querySelector('[data-board-grid]');
        if (grid) boardView.scroll = grid.scrollTop;
        boardNode.hidden = true;
      }
      closeBoardMenu();
      return;
    }
    buildBoard();
    boardNode.hidden = false;
    placeBoard();
    const grid = boardNode.querySelector('[data-board-grid]');
    if (grid) grid.scrollTop = boardView.scroll;
  };
  const openDetailsBoard = () => {
    if (!isDetailsFile()) return;
    boardOpen = true;
    // A HALF-DRAWN LINE DOES NOT WAIT UNDER THE BOARD.
    drawStart = null;
    syncDetailsBoard();
  };
  const closeDetailsBoard = () => {
    boardOpen = false;
    syncDetailsBoard();
  };
  // A FILE OPENED (model/17 adoptFile): a library opens on its board, any
  // other file puts the board away.
  const settleDetailsBoardOnOpen = () => {
    boardOpen = isDetailsFile();
    if (!boardOpen) syncDetailsBoard();
  };

  // THIS PART LOADS AFTER THE BOOT HAS STARTED: a details file already up
  // when it arrives is drawn again now that its painters exist.
  if (isDetailsFile()) {
    boneyardActive = true;
    boardOpen = true;
    refreshToolAvailability();
    buildChrome();
    fit(false, 0.8);
    paint();
  }
