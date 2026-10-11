// RoughDrafter DXF converter -- the page.
//
// Copyright (c) 2026 bluejetty.
// This file is part of the RoughDrafter DXF converter, which is free software:
// you can redistribute it and/or modify it under the terms of the GNU General
// Public License as published by the Free Software Foundation, either version
// 3 of the License, or (at your option) any later version. See LICENSE.txt.
//
// Files in, one row each; each row converts in worker.js and offers its DXF.
// When a drop has finished, one question: open it in RoughDrafter? A yes
// leaves the DXF in this browser's IndexedDB (HANDOFF below) and sends the
// tab to MODEL, which picks it up into TRACE. That file is the whole
// conversation between the two programs.

const $ = sel => document.querySelector(sel);
const drop = $('[data-drop]');
const fileInput = $('[data-file]');
const list = $('[data-list]');
const rowsEl = $('[data-rows]');
const countEl = $('[data-count]');
const allBtn = $('[data-all]');
const warming = $('[data-warming]');
const ask = $('[data-ask]');

// ── THE HANDOFF TO ROUGHDRAFTER ─────────────────────────────────────────────
// Same origin, so the browser lets MODEL read what this page leaves. One
// slot: a newer handoff replaces an older one. MODEL deletes it on reading.
export const HANDOFF = Object.freeze({ db: 'rd-dxf-handoff', store: 'files', key: 'pending' });
const handoff = record => new Promise((resolve, reject) => {
  const open = indexedDB.open(HANDOFF.db, 1);
  open.onupgradeneeded = () => open.result.createObjectStore(HANDOFF.store);
  open.onerror = () => reject(open.error);
  open.onsuccess = () => {
    const tx = open.result.transaction(HANDOFF.store, 'readwrite');
    tx.objectStore(HANDOFF.store).put(record, HANDOFF.key);
    tx.oncomplete = () => { open.result.close(); resolve(); };
    tx.onerror = () => reject(tx.error);
  };
});

const NEVER_KEY = 'rd-dxf-never-ask';
const neverAsk = () => { try { return localStorage.getItem(NEVER_KEY) === '1'; } catch { return false; } };
const setNeverAsk = on => { try { on ? localStorage.setItem(NEVER_KEY, '1') : localStorage.removeItem(NEVER_KEY); } catch { /* private window */ } };

// ── THE WORKER ──────────────────────────────────────────────────────────────
let worker = null;
const pending = new Map();
let nextId = 1;
const convert = (name, bytes) => {
  if (!worker) {
    worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
    worker.onmessage = ({ data }) => {
      const done = pending.get(data.id);
      pending.delete(data.id);
      if (done) done(data);
    };
    worker.onerror = event => {
      console.error('dxf converter: worker failed', event);
      pending.forEach(done => done({ ok: false, error: 'the converter could not start in this browser' }));
      pending.clear();
      worker = null;
    };
  }
  const id = nextId++;
  return new Promise(resolve => {
    pending.set(id, resolve);
    worker.postMessage({ id, name, bytes }, [bytes]);
  });
};

// ── DRAWING A PREVIEW ───────────────────────────────────────────────────────
function drawPreview(canvas, preview) {
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#0d0f10';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!preview) return;
  const [x0, y0, x1, y1] = preview.box;
  const w = Math.max(x1 - x0, 1e-9);
  const h = Math.max(y1 - y0, 1e-9);
  const pad = 0.08;
  const s = Math.min(canvas.width * (1 - 2 * pad) / w, canvas.height * (1 - 2 * pad) / h);
  const ox = (canvas.width - w * s) / 2;
  const oy = (canvas.height - h * s) / 2;
  ctx.strokeStyle = '#e7e5e2';
  ctx.lineWidth = Math.max(1, canvas.width / 400);
  ctx.beginPath();
  for (const run of preview.runs) {
    for (let i = 0; i < run.length; i += 2) {
      const X = ox + (run[i] - x0) * s;
      const Y = canvas.height - (oy + (run[i + 1] - y0) * s);
      if (i === 0) ctx.moveTo(X, Y); else ctx.lineTo(X, Y);
    }
  }
  ctx.stroke();
}

// ── DOWNLOADS ───────────────────────────────────────────────────────────────
const dxfName = name => name.replace(/\.dwg$/i, '') + '.dxf';
const save = (blob, name) => {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 30000);
};

// A STORED ZIP: no compression, just the files one after another. DXF is text
// and would shrink, but a stored zip is a page of code and opens anywhere.
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
const crc32 = bytes => {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i += 1) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
export function zip(files) {
  const enc = new TextEncoder();
  const parts = [];
  const central = [];
  let offset = 0;
  const used = new Set();
  for (const file of files) {
    let name = file.name;
    for (let n = 2; used.has(name.toLowerCase()); n += 1) name = file.name.replace(/(\.[^.]*)?$/, ` (${n})$1`);
    used.add(name.toLowerCase());
    const nameBytes = enc.encode(name);
    const data = file.bytes;
    const crc = crc32(data);
    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true); local.setUint16(4, 20, true); local.setUint16(6, 0x0800, true);
    local.setUint32(14, crc, true); local.setUint32(18, data.length, true); local.setUint32(22, data.length, true);
    local.setUint16(26, nameBytes.length, true);
    parts.push(local.buffer, nameBytes, data);
    const cd = new DataView(new ArrayBuffer(46));
    cd.setUint32(0, 0x02014b50, true); cd.setUint16(4, 20, true); cd.setUint16(6, 20, true); cd.setUint16(8, 0x0800, true);
    cd.setUint32(16, crc, true); cd.setUint32(20, data.length, true); cd.setUint32(24, data.length, true);
    cd.setUint16(28, nameBytes.length, true); cd.setUint32(42, offset, true);
    central.push(cd.buffer, nameBytes);
    offset += 30 + nameBytes.length + data.length;
  }
  const cdSize = central.reduce((n, p) => n + p.byteLength, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true);
  end.setUint32(12, cdSize, true); end.setUint32(16, offset, true);
  return new Blob([...parts, ...central, end.buffer], { type: 'application/zip' });
}

// ── ROWS ────────────────────────────────────────────────────────────────────
const items = [];
const syncHeader = () => {
  list.hidden = items.length === 0;
  countEl.textContent = `${items.length} FILE${items.length === 1 ? '' : 'S'}`;
  allBtn.hidden = items.filter(it => it.dxf).length < 2;
};

function addRow(file) {
  const row = document.createElement('div');
  row.className = 'row';
  row.dataset.row = file.name;
  row.innerHTML = `<canvas class="th" width="184" height="124"></canvas>
    <div><div class="nm"></div><div class="meta">Converting…</div><div class="bar"><i></i></div></div>
    <div class="act"></div>`;
  row.querySelector('.nm').textContent = file.name;
  drawPreview(row.querySelector('canvas'), null);
  rowsEl.append(row);
  const item = { name: file.name, row, dxf: null, preview: null };
  items.push(item);
  syncHeader();
  return item;
}

function finishRow(item, result) {
  const meta = item.row.querySelector('.meta');
  item.row.querySelector('.bar').remove();
  const act = item.row.querySelector('.act');
  if (!result.ok) {
    item.row.dataset.state = 'failed';
    meta.className = 'meta warn';
    meta.textContent = `⚠ Could not convert: ${result.error}. Ask the sender to “Save As” DXF, or an older DWG.`;
    return;
  }
  item.dxf = result.dxf;
  item.preview = result.preview;
  item.info = result.info;
  item.row.dataset.state = 'done';
  drawPreview(item.row.querySelector('canvas'), result.preview);
  const bits = [result.info.version];
  if (result.info.entities != null) bits.push(`${result.info.entities.toLocaleString()} pieces`);
  if (result.info.layers != null) bits.push(`${result.info.layers} layers`);
  meta.innerHTML = '<span class="ok">✓ Converted</span> · ';
  meta.append(bits.join(' · '));
  const dl = document.createElement('button');
  dl.type = 'button';
  dl.textContent = 'DOWNLOAD DXF';
  dl.dataset.download = '';
  dl.onclick = () => save(new Blob([item.dxf], { type: 'application/dxf' }), dxfName(item.name));
  const open = document.createElement('button');
  open.type = 'button';
  open.className = 'open';
  open.textContent = 'OPEN IN ROUGHDRAFTER';
  open.dataset.openRow = '';
  open.onclick = () => openInRoughDrafter(item);
  act.append(dl, open);
  syncHeader();
}

async function openInRoughDrafter(item) {
  try {
    await handoff({ name: dxfName(item.name), dxf: item.dxf, at: Date.now() });
  } catch (error) {
    alert(`This browser would not pass the drawing across (${error?.message || error}). Download the DXF and open it in TRACE instead.`);
    return;
  }
  location.href = new URL('../MODEL.html?trace=handoff', location.href).href;
}

// ── THE QUESTION, once a drop has finished ──────────────────────────────────
function askAbout(done) {
  if (!done.length) return;
  // Everything converted is also saved, whichever way they answer.
  if (done.length === 1) save(new Blob([done[0].dxf], { type: 'application/dxf' }), dxfName(done[0].name));
  else save(zip(done.map(it => ({ name: dxfName(it.name), bytes: it.dxf }))), 'converted-dxf.zip');
  if (neverAsk()) return;
  const first = done[0];
  $('[data-ask-file]').textContent = done.length === 1
    ? `${first.name} → ${dxfName(first.name)}${first.info?.layers != null ? ` · ${first.info.layers} layers` : ''}`
    : `${done.length} files converted · opening ${first.name}`;
  drawPreview($('[data-ask-preview]'), first.preview);
  $('[data-ask-never]').checked = false;
  ask.hidden = false;
  $('[data-ask-yes]').focus();
  $('[data-ask-yes]').onclick = () => { ask.hidden = true; openInRoughDrafter(first); };
  $('[data-ask-no]').onclick = () => {
    if ($('[data-ask-never]').checked) setNeverAsk(true);
    ask.hidden = true;
  };
}
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && !ask.hidden) ask.hidden = true;
});

// ── TAKING FILES IN ─────────────────────────────────────────────────────────
async function takeFiles(fileList) {
  const files = [...fileList].filter(f => f.size > 0);
  if (!files.length) return;
  warming.hidden = worker != null;
  const batch = [];
  await Promise.all(files.map(async file => {
    const item = addRow(file);
    if (!/\.dwg$/i.test(file.name)) {
      finishRow(item, { ok: false, error: 'only .dwg files can be converted here so far' });
      return;
    }
    const bytes = await file.arrayBuffer();
    const result = await convert(file.name, bytes);
    warming.hidden = true;
    finishRow(item, result);
    if (result.ok) batch.push(item);
  }));
  warming.hidden = true;
  // In the order they were dropped, not the order they finished.
  askAbout(items.filter(it => batch.includes(it)));
}

drop.addEventListener('click', () => fileInput.click());
drop.addEventListener('keydown', event => {
  if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); fileInput.click(); }
});
$('[data-choose]').addEventListener('click', event => { event.stopPropagation(); fileInput.click(); });
fileInput.addEventListener('change', () => { takeFiles(fileInput.files); fileInput.value = ''; });
['dragenter', 'dragover'].forEach(type => drop.addEventListener(type, event => {
  event.preventDefault();
  drop.classList.add('over');
}));
['dragleave', 'drop'].forEach(type => drop.addEventListener(type, () => drop.classList.remove('over')));
drop.addEventListener('drop', event => {
  event.preventDefault();
  takeFiles(event.dataTransfer.files);
});
// A file dropped anywhere else on the page would make the browser open it.
window.addEventListener('dragover', event => event.preventDefault());
window.addEventListener('drop', event => {
  event.preventDefault();
  if (!drop.contains(event.target)) takeFiles(event.dataTransfer.files);
});
allBtn.addEventListener('click', () => {
  const done = items.filter(it => it.dxf);
  save(zip(done.map(it => ({ name: dxfName(it.name), bytes: it.dxf }))), 'converted-dxf.zip');
});
