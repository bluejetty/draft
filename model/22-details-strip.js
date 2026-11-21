// MODEL.html's page script, part 22: the DETAILS strip -- a details library
// loaded into a house's own file, beside the SHELVES tab.
//
// jb, 20 Nov 2026: "ok i need to fix something it isn't working as i
// planned.. i need a little area in ther main model house area like the
// SHELFS to load all the details into" -- "to load a DETAILS.draft file
// within a house drawing" -- "a little area where you can search through
// them too". The plan he passed the same evening ("lets try it sir"):
//
//   - a DETAILS tab on the foot lane, RIGHT of the bone, after SAVE SHELF;
//     a press opens a panel above it;
//   - LOAD DETAILS FILE links one library to the house (one at a time, his
//     19 Nov ruling), from this browser's libraries or off the computer;
//   - a search box (name, tags, note) and category chips over a grid of
//     squares, one per detail;
//   - a press on a square is a bigger look at it, with PUT ON SHEET (LAYOUT,
//     ready to place) and EDIT (the library opened at that detail, and BACK
//     TO HOUSE from there);
//   - the camera's snapshots wait in the same panel, and ADD TO DETAILS files
//     one straight into the linked library -- no trip to the library's file
//     just to pick a picture up;
//   - THE HOUSE KEEPS A COPY of the library it links (`drawing.linkedDetails`
//     = { name, copiedAt, drawing }), so the squares are there on a computer
//     that has no library, and RELOAD brings the copy up to date.
//
// THE LIBRARY ITSELF LIVES IN THIS BROWSER'S `details-libraries` store
// (SAVE DETAIL puts it there, model/21), under `<LIBRARY NAME>.draft`. That
// copy is the one ADD TO DETAILS writes into and EDIT opens; the .draft on
// the computer is the backup SAVE AS writes, as for every drawing.

  const STRIP_LIBRARY_BUCKET = 'details-libraries';
  // THE HOUSE WAITING while its library is edited (EDIT), one at a time.
  const HOUSE_WAITING_BUCKET = 'details-house-waiting';
  const HOUSE_WAITING_FILE = 'house.draft';
  const STRIP_ALL = 'ALL';

  let detailsStripOpen = stored.detailsStrip === true;
  const stripView = { search: '', category: STRIP_ALL, looking: null, snapshots: false };
  // SAVE DETAILS FILE's box: open or not, what is typed, and its last word.
  const fileBox = { open: false, name: '', to: '', say: '', kind: '' };
  let stripLibraries;          // undefined = not read yet; [] = none in this browser
  let stripLibrariesLoading = false;
  let stripPicking = false;    // the LOAD list is showing
  let stripSnapshots = [];
  let houseWaiting = null;     // { libraryName, at } while a house waits on EDIT

  // ── THE LIBRARY A HOUSE HOLDS ─────────────────────────────────────────────
  const libraryFileName = libDrawing => `${String(libDrawing?.detailsLibrary || 'DETAILS-LIBRARY')
    .trim().toUpperCase().replace(/[^A-Z0-9 _-]+/g, '').slice(0, 60) || 'DETAILS-LIBRARY'}.draft`;
  const linkedDetails = () => {
    const raw = drawing?.linkedDetails;
    if (!raw || typeof raw !== 'object') return null;
    const F = window.DraftDrawingFormat;
    const lib = F.layoutSourceDrawing(raw.drawing);
    if (!lib || F.standalone(lib.standalone) !== 'details') return null;
    return { name: String(raw.name || libraryFileName(lib)), copiedAt: raw.copiedAt || null, drawing: lib };
  };
  // A details library read out of a file's text, or null when it is not one.
  const readLibraryText = text => {
    const F = window.DraftDrawingFormat;
    let parsed;
    try { parsed = JSON.parse(text); } catch { return null; }
    if (!F.checkEnvelope(parsed).ok) return null;
    const lib = F.layoutSourceDrawing(parsed);
    return lib && F.standalone(lib.standalone) === 'details' ? lib : null;
  };
  // ITS DETAILS, in the library's own order: the shelves that carry a card.
  const libraryDetails = lib => {
    const F = window.DraftDrawingFormat;
    if (!lib) return [];
    return F.boneyardShelves(lib.drawing.boneyardShelves)
      .filter(shelf => shelf.detail)
      .map((shelf, i) => ({ shelf, card: F.detailCard(shelf.detail), number: i + 1 }));
  };
  const detailMatches = ({ shelf, card }) => {
    if (stripView.category !== STRIP_ALL && card.category !== stripView.category) return false;
    const q = stripView.search.trim().toLowerCase();
    if (!q) return true;
    const words = [shelf.name || '', card.category, card.note, ...card.tags,
      card.kind === 'typ' ? 'typ' : 'special'].join(' ').toLowerCase();
    return q.split(/\s+/).every(word => words.includes(word));
  };

  // LINK ONE: the copy goes into the house, replacing whatever was linked.
  // Linking is the file's (it is saved), so it marks the drawing dirty.
  const linkLibrary = (name, lib, say) => {
    if (!drawing || !lib) return;
    drawing.linkedDetails = { name, copiedAt: new Date().toISOString(), drawing: lib };
    stripPicking = false;
    stripView.looking = null;
    markDirty();
    buildDetailsStrip();
    sayOnStrip(say || `${name} is loaded into this house: ${libraryDetails(linkedDetails()).length} details.`);
  };

  const readStripLibraries = async () => {
    if (stripLibrariesLoading) return;
    stripLibrariesLoading = true;
    const list = [];
    try {
      const files = await window.SharedFileStore.loadSharedFiles(STRIP_LIBRARY_BUCKET);
      for (const file of files || []) {
        const lib = readLibraryText(await file.text());
        if (lib) list.push({ name: file.name, drawing: lib });
      }
    } catch (error) {
      console.warn('draft: details libraries could not be read', error);
    }
    stripLibraries = list.sort((a, b) => a.name.localeCompare(b.name));
    stripLibrariesLoading = false;
    buildDetailsStrip();
  };
  // The library as this browser keeps it now, or null.
  const storedLibrary = async name => {
    try {
      const file = await window.SharedFileStore.loadNamedFile(name, STRIP_LIBRARY_BUCKET);
      return file ? readLibraryText(await file.text()) : null;
    } catch { return null; }
  };

  // RELOAD: the house's copy swapped for the library as this browser keeps
  // it now.
  const reloadLinkedDetails = async () => {
    const now = linkedDetails();
    if (!now) return false;
    const lib = await storedLibrary(now.name);
    if (!lib) {
      sayOnStrip(`${now.name} is not in this browser's details libraries. LOAD DETAILS FILE picks it off the computer.`);
      return false;
    }
    linkLibrary(now.name, lib, `${now.name} reloaded: ${libraryDetails({ drawing: lib }).length} details.`);
    return true;
  };

  // OFF THE COMPUTER: read, kept in this browser's libraries too (so EDIT and
  // ADD TO DETAILS have it to work on), and linked.
  let stripFileInput = null;
  const loadLibraryFromComputer = () => {
    if (!stripFileInput) {
      stripFileInput = document.createElement('input');
      stripFileInput.type = 'file';
      stripFileInput.accept = '.draft,.json,application/json';
      stripFileInput.hidden = true;
      stripFileInput.dataset.detailsStripFile = '';
      stripFileInput.addEventListener('change', async () => {
        const file = stripFileInput.files && stripFileInput.files[0];
        stripFileInput.value = '';
        if (!file) return;
        const text = await file.text();
        const lib = readLibraryText(text);
        if (!lib) {
          sayOnStrip(`${file.name} is not a details library. A DETAILS.draft is started with DRAW DETAILS LIBRARY.`);
          return;
        }
        const name = libraryFileName(lib);
        try {
          await window.SharedFileStore.saveNamedFile(
            new File([JSON.stringify(lib)], name, { type: 'application/json' }), STRIP_LIBRARY_BUCKET);
        } catch (error) { console.warn('draft: the library could not be kept in this browser', error); }
        stripLibraries = undefined;
        linkLibrary(name, lib, `${file.name} is loaded into this house as ${name}: ${libraryDetails({ drawing: lib }).length} details.`);
      });
      document.body.append(stripFileInput);
    }
    stripFileInput.click();
  };

  // ── A SMALL DRAWING OF A DETAIL ───────────────────────────────────────────
  //
  // Its frame dashed, and what is drawn on its shelf -- lines, shape edges,
  // a dot for each note -- fitted to the square, in the page's ink.
  const paintLibraryDetail = (screen, lib, shelf, card) => {
    const ratio = window.devicePixelRatio || 1;
    const cw = screen.clientWidth || 70, ch = screen.clientHeight || 56;
    screen.width = Math.round(cw * ratio);
    screen.height = Math.round(ch * ratio);
    const g = screen.getContext('2d');
    g.setTransform(ratio, 0, 0, ratio, 0, 0);
    g.clearRect(0, 0, cw, ch);
    const level = -Number(shelf.id);
    const W = Math.max(card.frameW, 0.25), H = Math.max(card.frameH, 0.25);
    const k = Math.min((cw - 6) / W, (ch - 6) / H);
    const X = x => cw / 2 + x * k, Y = z => ch / 2 + z * k;
    const ink = skin['draw-note'] || '#333';
    g.strokeStyle = skin['draw-selected'] || ink;
    g.lineWidth = 0.75;
    g.setLineDash([3, 2]);
    g.strokeRect(X(-W / 2), Y(-H / 2), W * k, H * k);
    g.setLineDash([]);
    g.strokeStyle = ink;
    g.fillStyle = ink;
    g.beginPath();
    let count = 0;
    (Array.isArray(lib.lines) ? lib.lines : []).forEach(line => {
      if (Number(line?.levelId) !== level || !line.start || !line.end) return;
      g.moveTo(X(line.start.x), Y(line.start.z));
      g.lineTo(X(line.end.x), Y(line.end.z));
      count += 1;
    });
    (Array.isArray(lib.shapes) ? lib.shapes : []).forEach(shape => {
      const pts = Array.isArray(shape?.points) ? shape.points : [];
      if (Number(shape?.levelId) !== level || pts.length < 2) return;
      pts.forEach((p, i) => (i ? g.lineTo(X(p.x), Y(p.z)) : g.moveTo(X(p.x), Y(p.z))));
      g.closePath();
      count += 1;
    });
    g.stroke();
    (Array.isArray(lib.notes) ? lib.notes : []).forEach(note => {
      const at = note?.text || note?.anchor;
      if (Number(note?.levelId) !== level || !at) return;
      g.fillRect(X(at.x) - 1, Y(at.z) - 1, 2, 2);
      count += 1;
    });
    screen.dataset.detailThumbMarks = String(count);
  };

  // ── PUT ON SHEET, EDIT ────────────────────────────────────────────────────
  //
  // PUT ON SHEET: saved first (free), then LAYOUT, which brings the house's
  // copy in as its library and holds the detail ready for a click on the
  // sheet (LAYOUT.html `placeDetail`).
  const putDetailOnSheet = async shelfId => {
    if (!linkedDetails()) return false;
    const ok = await save();
    if (!ok) {
      sayOnStrip('The house could not be saved, so LAYOUT would not see this detail. Press SAVE, then try again.');
      return false;
    }
    window.location.href = `./LAYOUT.html?placeDetail=${encodeURIComponent(String(shelfId))}`;
    return true;
  };

  // EDIT: THE HOUSE WAITS, AS IT STANDS -- unsaved edits and all -- in its
  // own corner of this browser, and the library opens at the detail. Its
  // BACK TO HOUSE press keeps the library and brings the house back.
  const editLinkedDetail = async shelfId => {
    const now = linkedDetails();
    if (!now || !drawing) return false;
    const lib = (await storedLibrary(now.name)) || now.drawing;
    const houseText = JSON.stringify(serializeDrawing({ trim: false }));
    try {
      await window.SharedFileStore.saveNamedFile(new File([JSON.stringify({
        libraryName: now.name, at: new Date().toISOString(), house: JSON.parse(houseText),
      })], HOUSE_WAITING_FILE, { type: 'application/json' }), HOUSE_WAITING_BUCKET);
    } catch (error) {
      sayOnStrip(`The house could not be put aside: ${error?.message || error}. Nothing was opened.`);
      return false;
    }
    houseWaiting = { libraryName: now.name };
    detailsStripOpen = false;
    keepLight('detailsStrip', false);
    const libFile = new File([JSON.stringify(lib)], now.name, { type: 'application/json' });
    if (!(await adoptAndShow(libFile))) return false;
    if (shelfId != null && libraryDetails({ drawing: lib }).some(d => Number(d.shelf.id) === Number(shelfId))) {
      openDetailFromBoard(Number(shelfId));
    }
    // THE LIBRARY IS THE DRAWING NOW, so SAVE keeps it where SAVE keeps any
    // drawing; BACK TO HOUSE puts the house back there.
    await save();
    buildChrome();
    sayOnStrip(`${now.name} is open — edit the detail, then BACK TO HOUSE (top of the DETAILS pane) keeps it and brings the house back.`);
    return true;
  };

  // BACK TO HOUSE: the library kept in this browser's libraries (as SAVE
  // DETAIL keeps it), the house adopted again, and its copy of the library
  // brought up to date from what was just kept.
  const backToHouse = async () => {
    let waiting = null;
    try {
      const file = await window.SharedFileStore.loadNamedFile(HOUSE_WAITING_FILE, HOUSE_WAITING_BUCKET);
      waiting = file ? JSON.parse(await file.text()) : null;
    } catch { waiting = null; }
    if (!waiting?.house) {
      houseWaiting = null;
      buildChrome();
      sayOnStrip('No house is waiting. OPEN brings one in.');
      return false;
    }
    let keptName = null;
    if (drawing?.standalone === 'details') {
      try { keptName = await storeLibrary(); } catch (error) {
        sayOnStrip(`The library could not be kept: ${error?.message || error}. The house is still waiting.`);
        return false;
      }
    }
    const libAfter = keptName ? await storedLibrary(keptName) : null;
    const houseFile = new File([JSON.stringify(waiting.house)], 'house.draft', { type: 'application/json' });
    if (!(await adoptAndShow(houseFile))) return false;
    try { await window.SharedFileStore.removeNamedFile(HOUSE_WAITING_FILE, HOUSE_WAITING_BUCKET); } catch { /* left: harmless */ }
    houseWaiting = null;
    const linkedName = drawing?.linkedDetails?.name;
    if (libAfter && (!linkedName || linkedName === keptName)) {
      drawing.linkedDetails = { name: keptName, copiedAt: new Date().toISOString(), drawing: libAfter };
    }
    detailsStripOpen = true;
    keepLight('detailsStrip', true);
    await save();
    buildChrome();
    paint();
    sayOnStrip(`Back in the house. ${keptName || 'The library'} is kept in this browser and this house's copy is up to date.`);
    return true;
  };
  const readHouseWaiting = async () => {
    try {
      const file = await window.SharedFileStore.loadNamedFile(HOUSE_WAITING_FILE, HOUSE_WAITING_BUCKET);
      const rec = file ? JSON.parse(await file.text()) : null;
      houseWaiting = rec?.house ? { libraryName: rec.libraryName || '' } : null;
    } catch { houseWaiting = null; }
    buildChrome();
  };
  // THE BUTTON THE LIBRARY'S PANE WEARS while a house waits (model/21).
  const backToHouseButton = () => {
    if (!houseWaiting) return null;
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'lv-add dl-back-house';
    b.textContent = '◂ BACK TO HOUSE';
    b.title = 'Keep this library in this browser and go back to the house you were drawing';
    b.dataset.backToHouse = '';
    b.addEventListener('click', event => { event.stopPropagation(); backToHouse(); });
    return b;
  };

  // ── SNAPSHOTS INTO THE LIBRARY ────────────────────────────────────────────
  //
  // ADD TO DETAILS does in the library's stored copy what USE does in an open
  // library (model/21 addDetailFromSnapshot): a new detail named for the
  // view, framed to the box, the picture's lines and words on it as its own,
  // on the SNAPSHOT layer. The house's copy follows.
  const snapshotIntoLibrary = (lib, rec) => {
    const F = window.DraftDrawingFormat;
    const geo = window.DraftDxfReader.parse(rec.dxf, { segments: true });
    const list = F.boneyardShelves(lib.boneyardShelves);
    const id = Math.max(Number.isInteger(lib.nextBoneyardShelfId) ? lib.nextBoneyardShelfId : 1,
      ...list.map(s => Number(s.id) + 1), 2);
    const taken = new Set(list.map(sh => String(sh.name || '').toUpperCase()));
    const base = String(rec.name || 'SNAPSHOT').trim() || 'SNAPSHOT';
    let name = base;
    for (let n = 2; taken.has(name.toUpperCase()); n += 1) name = `${base} ${n}`;
    const over = ft => Math.ceil(Number(ft) * 48 - 1e-6) / 48;
    const last = list.filter(sh => sh.detail).slice(-1)[0];
    const card = F.detailCard({
      ...(last ? { category: F.detailCard(last.detail).category } : {}),
      frameW: over(rec.widthFt), frameH: over(rec.heightFt),
      note: `From a snapshot of ${rec.cut || 'a view'}${rec.from ? ` in ${rec.from}` : ''}, `
        + `taken ${String(rec.takenAt || '').slice(0, 10)}.`,
    });
    lib.boneyardShelves = [...list, { id, name, detail: card }];
    lib.nextBoneyardShelfId = id + 1;
    const toWorld = ([x, y]) => ({ x: x / 12, z: -y / 12 });
    let nextItem = Number.isInteger(lib.nextDrawingItemId) ? lib.nextDrawingItemId : 1;
    const made = window.DraftDxfReader.piecesToLines(geo.segments, toWorld).map(seg => ({
      id: `line-${nextItem++}`,
      start: seg.start, end: seg.end, levelId: -id, view: 'plan', layer: 'SNAPSHOT',
      importedFrom: rec.name, ...(seg.bulge ? { bulge: seg.bulge } : {}),
    }));
    lib.nextDrawingItemId = nextItem;
    lib.lines = [...(Array.isArray(lib.lines) ? lib.lines : []), ...made];
    let noteId = (Array.isArray(lib.notes) ? lib.notes : []).reduce((top, n) => Math.max(top, Number(n.id) || 0), 0);
    const lettered = (geo.texts || []).filter(t => t.lines.join('').trim() && Number(t.h) > 0).map(t => {
      const p = toWorld([t.x, t.y]);
      return {
        id: (noteId += 1), anchor: p, text: { ...p }, levelId: -id, view: 'plan',
        body: t.lines.map(line => line.trimEnd()).join('\n').trim(), end: 'none',
        fill: false, fillOpacity: 0.85, outline: false, bullnose: 0,
        heightFt: t.h / 12, rot: Number(t.rot) || 0,
        align: t.align || 'left', baseline: t.baseline || 'alphabetic', layer: 'A-ANNO-NOTE',
      };
    });
    lib.notes = [...(Array.isArray(lib.notes) ? lib.notes : []), ...lettered];
    return { id, name, lines: made.length, notes: lettered.length };
  };
  const addSnapshotToLinked = async rec => {
    const now = linkedDetails();
    if (!now) { sayOnStrip('Load a DETAILS file first: the snapshot goes into it as a new detail.'); return false; }
    const lib = JSON.parse(JSON.stringify((await storedLibrary(now.name)) || now.drawing));
    let made;
    try { made = snapshotIntoLibrary(lib, rec); } catch (error) {
      sayOnStrip(`That snapshot could not be read: ${error?.message || 'not a picture this can open'}.`);
      return false;
    }
    try {
      await window.SharedFileStore.saveNamedFile(
        new File([JSON.stringify(lib)], now.name, { type: 'application/json' }), STRIP_LIBRARY_BUCKET);
    } catch (error) {
      sayOnStrip(`${now.name} could not be written: ${error?.message || error}.`);
      return false;
    }
    stripView.snapshots = false;
    linkLibrary(now.name, lib, `${made.name} — a new detail in ${now.name}: ${made.lines} line${made.lines === 1 ? '' : 's'}`
      + `${made.notes ? ` and ${made.notes} note${made.notes === 1 ? '' : 's'}` : ''}. EDIT draws on it.`);
    stripView.looking = made.id;
    buildDetailsStrip();
    return true;
  };
  let stripSnapshotsWatched = false;
  const watchStripSnapshots = () => {
    const DS = window.DraftDetailSnapshot;
    if (stripSnapshotsWatched || !DS || !window.SharedFileStore) return;
    stripSnapshotsWatched = true;
    const refresh = async () => {
      try { stripSnapshots = await DS.list(); } catch { stripSnapshots = []; }
      buildDetailsStrip();
    };
    window.SharedFileStore.onBucketChanged(DS.BUCKET, refresh);
    window.SharedFileStore.onBucketChanged(HOUSE_WAITING_BUCKET, readHouseWaiting);
    refresh();
    readHouseWaiting();
  };

  // ── SAVE DETAILS FILE ─────────────────────────────────────────────────────
  //
  // jb, 21 Nov 2026: "when i'm in a house plan can i save the DETAIL.draft
  // file seperately (and allow rename and send to email address)". The plan
  // he passed ("looks good Proceed Sir"): a SAVE DETAILS FILE press on this
  // panel saves the loaded library on its own, with a name box, to the
  // computer or by email, through the same mail as the house's BACKUP FILE,
  // at the house's prices -- SAVE AS to the computer 1 bone (refused short),
  // the email 1 bone -- each PAID ONCE IT HAS GONE, so a cancelled picker or
  // a failed send costs nothing.
  //
  // WHAT IS SAVED is the library as this browser keeps it (the copy EDIT and
  // ADD TO DETAILS write), else the house's own copy. A NEW NAME is the
  // file's name AND the library's name inside it, so the renamed file opens
  // (or LOADs into a house) under the name it was given. The house's link and
  // this browser's library are left as they are.
  const fileStem = text => String(text || '').trim()
    .replace(/\.(draft|json)$/i, '').replace(/[\\/:*?"<>|]+/g, '').trim().slice(0, 60);
  const detailsFileText = async stem => {
    const now = linkedDetails();
    if (!now) return null;
    const lib = JSON.parse(JSON.stringify((await storedLibrary(now.name)) || now.drawing));
    if (stem) lib.detailsLibrary = stem;
    return JSON.stringify(lib);
  };
  const fileToll = key => Number(window.DraftBoneWallet?.COSTS?.[key]) || 0;
  const bonesHeldNow = () => (window.DraftBoneWallet ? window.DraftBoneWallet.read().balance : Infinity);
  const tollWord = n => (window.DraftBoneWallet ? window.DraftBoneWallet.bonesWord(n) : `${n} bones`);
  const spendToll = key => {
    if (!window.DraftBoneWallet || !fileToll(key)) return;
    window.DraftBoneWallet.spend(fileToll(key));
    window.dispatchEvent(new CustomEvent('draft-bones-changed'));
  };
  const fileSay = (text, kind = '') => {
    fileBox.say = text;
    fileBox.kind = kind;
    const line = document.querySelector('[data-details-file-say]');
    if (line) { line.textContent = text; line.dataset.kind = kind; }
  };
  // TO THIS COMPUTER: the picker straight from the press (the gesture is
  // spent by the first await), then the file, then the bone.
  const saveDetailsFileToComputer = async () => {
    const stem = fileStem(fileBox.name);
    if (!stem) { fileSay('Type a name for the file.', 'error'); return false; }
    const toll = fileToll('saveToComputer');
    if (bonesHeldNow() < toll) {
      fileSay(`Saving to the computer costs ${tollWord(toll)} and you have ${bonesHeldNow()}. A free bone drips in every hour.`, 'error');
      return false;
    }
    const name = `${stem}.draft`;
    const handle = await pickSaveTarget(name);
    if (handle === 'cancelled') return false;
    try {
      const text = await detailsFileText(stem);
      if (!text) { fileSay('Load a DETAILS file first.', 'error'); return false; }
      await downloadDrawing(text, name, handle);
    } catch (error) {
      fileSay(`${name} could not be written: ${error?.message || error}. No bone spent.`, 'error');
      return false;
    }
    spendToll('saveToComputer');
    fileSay(`${(handle && handle.name) || name} saved on this computer.`, 'ok');
    return true;
  };
  // EMAIL IT: the same mail as the house's BACKUP FILE (backup-email.js).
  const emailDetailsFile = async () => {
    const mail = window.DraftBackupEmail;
    const stem = fileStem(fileBox.name);
    if (!stem) { fileSay('Type a name for the file.', 'error'); return false; }
    if (!mail?.sendFile) { fileSay('Email is not available on this page.', 'error'); return false; }
    if (!mail.validAddress(fileBox.to)) { fileSay('Enter a valid email address.', 'error'); return false; }
    const toll = fileToll('emailBackup');
    if (bonesHeldNow() < toll) {
      fileSay(`The email costs ${tollWord(toll)} and you have ${bonesHeldNow()}. A free bone drips in every hour.`, 'error');
      return false;
    }
    const name = `${stem}.draft`;
    const go = document.querySelector('[data-details-file-email]');
    if (go) go.disabled = true;
    try {
      const text = await detailsFileText(stem);
      if (!text) { fileSay('Load a DETAILS file first.', 'error'); return false; }
      const parts = await mail.sendFile({ to: fileBox.to, name, progress: fileSay,
        blob: new Blob([text], { type: 'application/json' }) });
      spendToll('emailBackup');
      fileSay(parts > 1
        ? `${name} sent to ${fileBox.to.trim()} in ${parts} emails. Open the .001 with 7-Zip or WinRAR to put them back together.`
        : `${name} sent to ${fileBox.to.trim()}.`, 'ok');
      return true;
    } catch (error) {
      fileSay(`Could not send (${error?.message || error}). No bone spent.`, 'error');
      return false;
    } finally {
      if (go) go.disabled = false;
    }
  };
  const detailsFileBox = lib => {
    const box = stripEl('div', { className: 'ds-file', data: { detailsFileBox: '' } });
    const nameBox = stripEl('input', { type: 'text', className: 'ds-search', value: fileBox.name,
      placeholder: 'FILE NAME', spellcheck: false, data: { detailsFileName: '' } });
    nameBox.addEventListener('input', () => { fileBox.name = nameBox.value; });
    nameBox.addEventListener('keydown', event => {
      if (event.key === 'Enter') { event.preventDefault(); saveDetailsFileToComputer(); }
    });
    const toBox = stripEl('input', { type: 'email', className: 'ds-search', value: fileBox.to,
      placeholder: 'you@example.com', spellcheck: false, data: { detailsFileTo: '' } });
    toBox.addEventListener('input', () => { fileBox.to = toBox.value; });
    toBox.addEventListener('keydown', event => {
      if (event.key === 'Enter') { event.preventDefault(); emailDetailsFile(); }
    });
    const held = bonesHeldNow();
    const pc = fileToll('saveToComputer'), em = fileToll('emailBackup');
    box.append(
      stripEl('div', { className: 'ds-sub', textContent: `SAVE ${lib.name.replace(/\.draft$/i, '')} ON ITS OWN — type a new name to rename the copy` }),
      stripEl('div', { className: 'ds-file-row' }, nameBox, stripEl('span', { className: 'ds-sub', textContent: '.draft' })),
      stripButton('SAVE TO COMPUTER', 'Save the details file on this computer', { detailsFileSave: '' },
        () => saveDetailsFileToComputer(), 'wide'),
      stripEl('div', { className: 'ds-file-row' }, toBox,
        stripButton('EMAIL IT', 'Email the details file to this address', { detailsFileEmail: '' }, () => emailDetailsFile())),
      stripEl('div', { className: 'ds-sub', data: { detailsFileToll: '' }, textContent: window.DraftBoneWallet
        ? `Computer ${tollWord(pc)}, email ${tollWord(em)} (you have ${held}).` : '' }),
      stripEl('div', { className: 'ds-file-say', data: { detailsFileSay: '', kind: fileBox.kind }, textContent: fileBox.say }));
    return box;
  };
  window.addEventListener('draft-bones-changed', () => {
    const line = document.querySelector('[data-details-file-toll]');
    if (line && window.DraftBoneWallet) {
      line.textContent = `Computer ${tollWord(fileToll('saveToComputer'))}, email ${tollWord(fileToll('emailBackup'))} (you have ${bonesHeldNow()}).`;
    }
  });

  // ── THE TAB AND THE PANEL ─────────────────────────────────────────────────
  const stripEl = (tag, props = {}, ...kids) => {
    const node = document.createElement(tag);
    Object.entries(props).forEach(([key, value]) => {
      if (key === 'data') Object.entries(value).forEach(([k, v]) => { node.dataset[k] = v; });
      else if (key in node) node[key] = value;
      else node.setAttribute(key, value);
    });
    kids.flat().forEach(kid => kid != null && node.append(kid));
    return node;
  };
  const stripButton = (label, title, data, run, extra = '') => stripEl('button', {
    type: 'button', className: `ds-btn ${extra}`.trim(), textContent: label, title, data,
    onclick: event => { event.stopPropagation(); run(); },
  });

  const buildDetailsStrip = () => {
    const bar = document.getElementById('dt-bar');
    if (!bar) return;
    watchStripSnapshots();
    let strip = document.getElementById('details-strip');
    if (!strip) {
      strip = stripEl('div', { id: 'details-strip', data: { detailsStrip: '' } });
      const panel = stripEl('div', { id: 'details-panel', data: { detailsPanel: '' } });
      // A press inside the panel is the panel's, never the sheet's.
      ['pointerdown', 'mousedown', 'wheel', 'dblclick'].forEach(kind =>
        panel.addEventListener(kind, event => event.stopPropagation()));
      panel.addEventListener('keydown', event => event.stopPropagation());
      const tab = stripEl('button', { type: 'button', id: 'details-tab', data: { detailsTab: '' } });
      tab.addEventListener('click', () => {
        detailsStripOpen = !detailsStripOpen;
        keepLight('detailsStrip', detailsStripOpen);
        buildDetailsStrip();
      });
      strip.append(panel, tab);
      bar.append(strip);
    }
    // A HOUSE'S STRIP: not on a details library (its pane is its details)
    // and not before there is a drawing.
    const isLibrary = drawing?.standalone === 'details';
    strip.hidden = !drawing || isLibrary;
    const lib = linkedDetails();
    const tab = strip.querySelector('#details-tab');
    const waiting = stripSnapshots.length;
    tab.textContent = `DETAILS${lib ? ` (${libraryDetails(lib).length})` : ''} ${detailsStripOpen ? '▾' : '▴'}`;
    tab.title = detailsStripOpen ? 'Put the details away' : 'The details library loaded into this house';
    tab.toggleAttribute('data-waiting', waiting > 0);
    strip.dataset.open = String(detailsStripOpen);
    const panel = strip.querySelector('#details-panel');
    panel.hidden = !detailsStripOpen || strip.hidden;
    if (panel.hidden) return;
    const keepFocus = document.activeElement?.dataset?.detailsSearch !== undefined;
    // A NAME OR ADDRESS BEING TYPED keeps its place across a rebuild too.
    const typing = ['detailsFileName', 'detailsFileTo'].find(key => document.activeElement?.dataset?.[key] !== undefined);
    const typingCaret = typing ? document.activeElement.selectionStart : null;
    const caret = keepFocus ? document.activeElement.selectionStart : null;
    const scroll = panel.querySelector('[data-details-grid]')?.scrollTop || 0;
    panel.textContent = '';

    // THE HEAD: what is loaded, and the presses that change it.
    panel.append(stripEl('div', { className: 'ds-head' },
      stripEl('div', { className: 'ds-title', data: { detailsLinked: lib ? lib.name : '' },
        textContent: lib ? `DETAILS — ${lib.name}` : 'DETAILS — none loaded' }),
      stripButton(lib ? 'CHANGE' : 'LOAD DETAILS FILE', 'Load a DETAILS.draft into this house',
        { detailsLoad: '' }, () => { stripPicking = !stripPicking; stripLibraries = undefined; buildDetailsStrip(); }),
      lib ? stripButton('RELOAD', `Bring ${lib.name} up to date from this browser's copy`,
        { detailsReload: '' }, () => reloadLinkedDetails()) : null));
    if (lib?.copiedAt) {
      panel.append(stripEl('div', { className: 'ds-sub' },
        `Copy kept in this house ${String(lib.copiedAt).slice(0, 16).replace('T', ' ')}`));
    }
    if (lib) {
      const fileKey = stripButton('SAVE DETAILS FILE', `Save ${lib.name} on its own: rename it, put it on the computer or email it`,
        { detailsFile: '' }, () => {
          fileBox.open = !fileBox.open;
          if (fileBox.open) {
            fileBox.name = lib.name.replace(/\.draft$/i, '');
            fileBox.to = fileBox.to || window.DraftBackupEmail?.lastAddress?.() || '';
            fileBox.say = ''; fileBox.kind = '';
          }
          buildDetailsStrip();
        });
      fileKey.setAttribute('aria-pressed', String(fileBox.open));
      panel.append(fileKey);
      if (fileBox.open) {
        panel.append(detailsFileBox(lib));
        const again = typing && panel.querySelector(`[data-${typing === 'detailsFileName' ? 'details-file-name' : 'details-file-to'}]`);
        if (again) {
          again.focus();
          try { if (typingCaret != null) again.setSelectionRange(typingCaret, typingCaret); } catch { /* email boxes refuse a caret */ }
        }
      }
    }

    // LOAD: the libraries this browser keeps, and the computer.
    if (stripPicking || !lib) {
      const pick = stripEl('div', { className: 'ds-pick', data: { detailsPick: '' } });
      if (stripLibraries === undefined) {
        pick.append(stripEl('div', { className: 'ds-sub', textContent: 'Looking in this browser…' }));
        readStripLibraries();
      } else if (!stripLibraries.length) {
        pick.append(stripEl('div', { className: 'ds-sub',
          textContent: 'No details library in this browser yet. Pick a DETAILS.draft off the computer.' }));
      }
      (stripLibraries || []).forEach(item => pick.append(stripButton(
        `USE ${item.name.replace(/\.draft$/i, '')}`, `Load ${item.name} into this house`,
        { detailsUse: item.name }, () => linkLibrary(item.name, item.drawing), 'wide')));
      pick.append(stripButton('FROM THE COMPUTER…', 'Pick a DETAILS.draft file', { detailsFromComputer: '' },
        () => loadLibraryFromComputer(), 'wide'));
      panel.append(pick);
    }

    // SNAPSHOTS WAITING: the camera's pictures, each ADD TO DETAILS or X.
    const DS = window.DraftDetailSnapshot;
    const snapKey = stripButton(`SNAPSHOTS (${waiting})`,
      'Pictures taken with DETAIL SNAPSHOT on an elevation or section, waiting to become details',
      { detailsSnapshots: String(waiting) }, () => { stripView.snapshots = !stripView.snapshots; buildDetailsStrip(); },
      waiting ? 'waiting' : '');
    panel.append(snapKey);
    if (stripView.snapshots) {
      const tray = stripEl('div', { className: 'ds-tray', data: { detailsTray: '' } });
      if (!waiting) {
        tray.append(stripEl('div', { className: 'ds-sub', textContent:
          'No snapshots waiting. On an elevation or a section press DETAIL SNAPSHOT (the square with a circle) and drag a box.' }));
      }
      [...stripSnapshots].reverse().forEach(rec => {
        const thumb = stripEl('canvas', { className: 'ds-tray-thumb' });
        tray.append(stripEl('div', { className: 'ds-tray-row', data: { detailsSnapshot: rec.id } },
          thumb,
          stripEl('span', { className: 'ds-name', textContent: rec.name }),
          stripButton('ADD TO DETAILS', lib ? `Make a new detail in ${lib.name} from this snapshot` : 'Load a DETAILS file first',
            { detailsSnapshotAdd: rec.id }, () => addSnapshotToLinked(rec)),
          stripButton('X', 'Throw this snapshot away', { detailsSnapshotDrop: rec.id }, async () => {
            try { await DS.remove(rec.id); } catch (error) { console.warn('draft: snapshot not removed', error); }
          })));
        if (typeof paintSnapshotThumb === 'function') requestAnimationFrame(() => paintSnapshotThumb(thumb, rec));
      });
      panel.append(tray);
    }
    if (!lib) return;

    const all = libraryDetails(lib);
    // ONE DETAIL, LOOKED AT: bigger, its card, and the two presses.
    const looking = stripView.looking != null ? all.find(d => Number(d.shelf.id) === Number(stripView.looking)) : null;
    if (looking) {
      const { shelf, card, number } = looking;
      const big = stripEl('canvas', { className: 'ds-look-pic' });
      panel.append(stripEl('div', { className: 'ds-look', data: { detailsLook: String(shelf.id) } },
        stripButton('◂ ALL DETAILS', 'Back to every detail', { detailsLookBack: '' },
          () => { stripView.looking = null; buildDetailsStrip(); }),
        big,
        stripEl('div', { className: 'ds-look-name', textContent: `${number}  ${shelf.name || `DETAIL ${shelf.id}`}` }),
        stripEl('div', { className: 'ds-sub', textContent:
          `${card.category} · ${card.kind === 'typ' ? 'TYP.' : 'SPECIAL'} · ${scaleLabel(card.scale)} · `
          + `${feetText(card.frameW)} x ${feetText(card.frameH)}` }),
        card.tags.length ? stripEl('div', { className: 'ds-sub', textContent: `TAGS: ${card.tags.join(', ')}` }) : null,
        card.note ? stripEl('div', { className: 'ds-note', textContent: card.note }) : null,
        stripEl('div', { className: 'ds-look-presses' },
          stripButton('PUT ON SHEET', 'Save, go to LAYOUT and click the sheet where this detail goes',
            { detailsPut: String(shelf.id) }, () => putDetailOnSheet(shelf.id)),
          stripButton('EDIT', `Open ${lib.name} at this detail; BACK TO HOUSE brings you back here`,
            { detailsEdit: String(shelf.id) }, () => editLinkedDetail(shelf.id)))));
      requestAnimationFrame(() => paintLibraryDetail(big, lib.drawing, shelf, card));
      return;
    }

    // SEARCH AND THE CATEGORIES.
    const search = stripEl('input', { type: 'search', className: 'ds-search', value: stripView.search,
      placeholder: 'SEARCH DETAILS (name, tag, note)', data: { detailsSearch: '' } });
    search.addEventListener('input', () => { stripView.search = search.value; buildDetailsStrip(); });
    panel.append(search);
    const cats = [STRIP_ALL, ...new Set([...window.DraftDrawingFormat.DETAIL_CATEGORIES,
      ...all.map(d => d.card.category)])];
    panel.append(stripEl('div', { className: 'ds-chips' }, cats.map(cat => {
      const n = cat === STRIP_ALL ? all.length : all.filter(d => d.card.category === cat).length;
      const chip = stripButton(`${cat} ${n}`, `Show ${cat === STRIP_ALL ? 'every detail' : cat}`,
        { detailsCategory: cat }, () => { stripView.category = cat; buildDetailsStrip(); });
      chip.setAttribute('aria-pressed', String(stripView.category === cat));
      return chip;
    })));

    // THE SQUARES.
    const shown = all.filter(detailMatches);
    const grid = stripEl('div', { className: 'ds-grid', data: { detailsGrid: '' } });
    if (!shown.length) {
      grid.append(stripEl('div', { className: 'ds-sub', textContent: all.length
        ? 'No detail matches.' : `${lib.name} has no details yet.` }));
    }
    shown.forEach(({ shelf, card, number }) => {
      const pic = stripEl('canvas');
      const square = stripEl('button', { type: 'button', className: 'ds-square',
        title: `${number} ${shelf.name} — ${card.category}${card.tags.length ? ` · ${card.tags.join(', ')}` : ''}`,
        data: { detailsSquare: String(shelf.id) } },
      pic, stripEl('span', { className: 'ds-square-name', textContent: shelf.name || `DETAIL ${shelf.id}` }));
      square.addEventListener('click', event => {
        event.stopPropagation();
        stripView.looking = shelf.id;
        buildDetailsStrip();
      });
      grid.append(square);
      requestAnimationFrame(() => paintLibraryDetail(pic, lib.drawing, shelf, card));
    });
    panel.append(grid, stripEl('div', { className: 'ds-sub ds-foot',
      textContent: `${all.length} detail${all.length === 1 ? '' : 's'} · ${shown.length} shown · press one to look, put it on a sheet or edit it` }));
    grid.scrollTop = scroll;
    if (keepFocus) {
      search.focus();
      if (caret != null) search.setSelectionRange(caret, caret);
    }
  };
