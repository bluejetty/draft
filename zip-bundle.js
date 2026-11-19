// SAVE AS ZIP (jb, 19 Nov 2026): "a save function to save a zip file that
// has the main file in the main directory and subfolders for all the
// hologram files etc.. logos title blocks anything added to it", "so user
// can save 1 zip file with everything in there". Five bones (jb).
//
// A SMALL ZIP WRITER AND READER, no library and no build step. The browser
// does the squeezing itself (CompressionStream 'deflate-raw', the same
// DEFLATE a zip uses); a browser without it writes the files STORED, which
// every unzip still opens. The reader takes both, so a zip the drafter
// unzipped and zipped again with Windows or a Mac opens too.
//
// THE BUNDLE (bundleEntries / readBundle) is what goes in it:
//   <name>.draft            the full drawing, opens on its own as it always has
//   holograms/<file>.draft  each hologram's own file, to open or edit alone
//   underlays/<file>        the photos, PDFs and DXFs under the plan, as they came in
//   logos/<logo>.png        the uploaded logo the titleblock wears
//   logos/<name>.draft.standards  this office's standards, logos and all
//   notes/<name> NOTES.txt  every page of the NOTES pad with something on it
//   details/                ready for the DETAILS library
(function () {
  'use strict';

  // ── CRC-32, the check a zip carries for every file ───────────────────
  const CRC_TABLE = (() => {
    const table = new Uint32Array(256);
    for (let n = 0; n < 256; n += 1) {
      let c = n;
      for (let k = 0; k < 8; k += 1) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      table[n] = c >>> 0;
    }
    return table;
  })();
  const crc32 = bytes => {
    let c = 0xFFFFFFFF;
    for (let i = 0; i < bytes.length; i += 1) c = CRC_TABLE[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  };

  const utf8 = text => new TextEncoder().encode(String(text));
  const asBytes = async data => {
    if (data instanceof Uint8Array) return data;
    if (data instanceof ArrayBuffer) return new Uint8Array(data);
    if (data && typeof data.arrayBuffer === 'function') return new Uint8Array(await data.arrayBuffer());
    return utf8(data == null ? '' : data);
  };
  const streamThrough = async (bytes, stream) => {
    const out = new Blob([bytes]).stream().pipeThrough(stream);
    return new Uint8Array(await new Response(out).arrayBuffer());
  };
  const canDeflate = () => typeof CompressionStream === 'function';
  const deflate = async bytes => {
    try { return await streamThrough(bytes, new CompressionStream('deflate-raw')); } catch { return null; }
  };
  const inflate = bytes => streamThrough(bytes, new DecompressionStream('deflate-raw'));

  // DOS time and date, which is what a zip header holds.
  const dosStamp = (when = new Date()) => ({
    time: ((when.getHours() & 31) << 11) | ((when.getMinutes() & 63) << 5) | ((when.getSeconds() / 2) & 31),
    date: (((Math.max(1980, when.getFullYear()) - 1980) & 127) << 9) | (((when.getMonth() + 1) & 15) << 5) | (when.getDate() & 31),
  });

  // entries: [{ name: 'folder/file.ext', data: string | Uint8Array | Blob }];
  // a name ending in '/' is a folder of its own. Returns a Blob.
  const writeZip = async (entries, { when = new Date() } = {}) => {
    const { time, date } = dosStamp(when);
    const parts = [];
    const central = [];
    let offset = 0;
    for (const entry of entries) {
      const name = utf8(entry.name);
      const folder = /\/$/.test(entry.name);
      const raw = folder ? new Uint8Array(0) : await asBytes(entry.data);
      const crc = crc32(raw);
      let method = 0;
      let body = raw;
      if (!folder && raw.length > 64 && canDeflate()) {
        const squeezed = await deflate(raw);
        if (squeezed && squeezed.length < raw.length) { method = 8; body = squeezed; }
      }
      const local = new DataView(new ArrayBuffer(30));
      local.setUint32(0, 0x04034b50, true);
      local.setUint16(4, 20, true);
      local.setUint16(6, 0x0800, true); // names are UTF-8
      local.setUint16(8, method, true);
      local.setUint16(10, time, true);
      local.setUint16(12, date, true);
      local.setUint32(14, crc, true);
      local.setUint32(18, body.length, true);
      local.setUint32(22, raw.length, true);
      local.setUint16(26, name.length, true);
      local.setUint16(28, 0, true);
      parts.push(new Uint8Array(local.buffer), name, body);

      const head = new DataView(new ArrayBuffer(46));
      head.setUint32(0, 0x02014b50, true);
      head.setUint16(4, 20, true);
      head.setUint16(6, 20, true);
      head.setUint16(8, 0x0800, true);
      head.setUint16(10, method, true);
      head.setUint16(12, time, true);
      head.setUint16(14, date, true);
      head.setUint32(16, crc, true);
      head.setUint32(20, body.length, true);
      head.setUint32(24, raw.length, true);
      head.setUint16(28, name.length, true);
      head.setUint32(38, folder ? 0x10 : 0, true);
      head.setUint32(42, offset, true);
      central.push(new Uint8Array(head.buffer), name);
      offset += 30 + name.length + body.length;
    }
    const centralSize = central.reduce((sum, part) => sum + part.length, 0);
    const end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true);
    end.setUint16(8, entries.length, true);
    end.setUint16(10, entries.length, true);
    end.setUint32(12, centralSize, true);
    end.setUint32(16, offset, true);
    return new Blob([...parts, ...central, new Uint8Array(end.buffer)], { type: 'application/zip' });
  };

  const looksLikeZip = async file => {
    if (!file) return false;
    if (/\.zip$/i.test(file.name || '')) return true;
    try {
      const head = new Uint8Array(await file.slice(0, 4).arrayBuffer());
      return head[0] === 0x50 && head[1] === 0x4b && head[2] === 0x03 && head[3] === 0x04;
    } catch { return false; }
  };

  // Returns [{ name, bytes }] for every file (folders left out). Reads the
  // central directory, so sizes written after the data (bit 3) are fine.
  const readZip = async blob => {
    const bytes = await asBytes(blob);
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    let endAt = -1;
    for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 22 - 65535); i -= 1) {
      if (view.getUint32(i, true) === 0x06054b50) { endAt = i; break; }
    }
    if (endAt < 0) throw new Error('This is not a zip file the page can read.');
    const count = view.getUint16(endAt + 10, true);
    let at = view.getUint32(endAt + 16, true);
    const decoder = new TextDecoder();
    const out = [];
    for (let n = 0; n < count; n += 1) {
      if (view.getUint32(at, true) !== 0x02014b50) throw new Error('The zip\'s file list is damaged.');
      const method = view.getUint16(at + 10, true);
      const packedSize = view.getUint32(at + 20, true);
      const nameLen = view.getUint16(at + 28, true);
      const extraLen = view.getUint16(at + 30, true);
      const commentLen = view.getUint16(at + 32, true);
      const localAt = view.getUint32(at + 42, true);
      const name = decoder.decode(bytes.subarray(at + 46, at + 46 + nameLen));
      at += 46 + nameLen + extraLen + commentLen;
      if (/\/$/.test(name)) continue;
      const dataAt = localAt + 30 + view.getUint16(localAt + 26, true) + view.getUint16(localAt + 28, true);
      const body = bytes.subarray(dataAt, dataAt + packedSize);
      if (method === 0) out.push({ name, bytes: body });
      else if (method === 8) out.push({ name, bytes: await inflate(body) });
      // Any other squeeze (or a locked zip) is passed over, not guessed at.
    }
    return out;
  };

  // ── WHAT GOES IN, AND WHERE ──────────────────────────────────────────

  // A name a folder on Windows or a Mac will take.
  const safeName = (text, fallback = 'FILE') => {
    const clean = String(text || '').replace(/[\\/:*?"<>|\u0000-\u001f]+/g, ' ').replace(/\s+/g, ' ').trim();
    return clean.slice(0, 80) || fallback;
  };
  const uniqueIn = taken => name => {
    if (!taken.has(name.toLowerCase())) { taken.add(name.toLowerCase()); return name; }
    const dot = name.lastIndexOf('.');
    const stem = dot > 0 ? name.slice(0, dot) : name;
    const ext = dot > 0 ? name.slice(dot) : '';
    for (let n = 2; ; n += 1) {
      const next = `${stem} (${n})${ext}`;
      if (!taken.has(next.toLowerCase())) { taken.add(next.toLowerCase()); return next; }
    }
  };
  const EXT_BY_TYPE = {
    'image/png': '.png', 'image/jpeg': '.jpg', 'image/webp': '.webp', 'image/gif': '.gif',
    'image/bmp': '.bmp', 'image/svg+xml': '.svg', 'application/pdf': '.pdf',
  };
  const extFor = (type, kind) => EXT_BY_TYPE[String(type || '').toLowerCase()]
    || (kind === 'dxf' ? '.dxf' : kind === 'pdf' ? '.pdf' : '');
  const dataUrlBytes = url => {
    const match = /^data:([^;,]*)(;base64)?,(.*)$/s.exec(String(url || ''));
    if (!match) return null;
    if (!match[2]) return { type: match[1], bytes: utf8(decodeURIComponent(match[3])) };
    const bin = atob(match[3]);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
    return { type: match[1], bytes };
  };

  // EVERY HOLOGRAM FILE ONCE, its own holograms too, however many copies of
  // it sit on the plan: the same source twice is one file.
  const hologramFiles = drawing => {
    const seen = new Set();
    const out = [];
    const walk = (list, depth) => (Array.isArray(list) ? list : []).forEach(holo => {
      const source = holo && holo.source;
      if (!source || typeof source !== 'object') return;
      const text = JSON.stringify(source);
      if (!seen.has(text)) { seen.add(text); out.push({ name: holo.name || 'HOLOGRAM', text }); }
      if (depth < 4) walk(source.holograms, depth + 1);
    });
    walk(drawing && drawing.holograms, 0);
    return out;
  };

  // THE UPLOADED LOGOS THE DRAWING NAMES (titleblockMark 'logo:<id>').
  const LOGO_PREFIX = 'logo:';
  const namedLogoIds = drawing => {
    const mark = drawing && drawing.layout && drawing.layout.titleblockMark;
    return typeof mark === 'string' && mark.startsWith(LOGO_PREFIX) ? [mark.slice(LOGO_PREFIX.length)] : [];
  };

  // drawingText: the .draft exactly as SAVE AS writes it (underlays packed).
  // underlayFile(u) -> Promise<Blob|null>, standards: the active standards
  // package or null, notes: the pad as text.
  const bundleEntries = async ({ baseName, drawingText, drawing, underlayFile, standards, notes }) => {
    const base = safeName(baseName, 'DRAWING');
    const entries = [{ name: `${base}.draft`, data: drawingText }];
    const report = { holograms: 0, underlays: 0, logos: 0, notes: false };

    const holoNames = uniqueIn(new Set());
    hologramFiles(drawing).forEach(file => {
      entries.push({ name: `holograms/${holoNames(`${safeName(file.name, 'HOLOGRAM')}.draft`)}`, data: file.text });
      report.holograms += 1;
    });

    const underNames = uniqueIn(new Set());
    for (const u of (drawing && Array.isArray(drawing.underlays) ? drawing.underlays : [])) {
      let blob = null;
      try { blob = underlayFile ? await underlayFile(u) : null; } catch { blob = null; }
      if (!blob) continue;
      let name = safeName(u.name, `UNDERLAY ${u.id}`);
      if (!/\.[a-z0-9]{2,4}$/i.test(name)) name += extFor(blob.type, u.kind);
      entries.push({ name: `underlays/${underNames(name)}`, data: blob });
      report.underlays += 1;
    }

    const logos = (standards && standards.content && standards.content.model
      && Array.isArray(standards.content.model.companyLogos)) ? standards.content.model.companyLogos : [];
    const logoNames = uniqueIn(new Set());
    namedLogoIds(drawing).forEach(id => {
      const logo = logos.find(entry => entry && entry.id === id);
      const decoded = logo && dataUrlBytes(logo.dataUrl);
      if (!decoded) return;
      entries.push({ name: `logos/${logoNames(`${safeName(logo.label, 'LOGO')}${extFor(decoded.type) || '.png'}`)}`, data: decoded.bytes });
      report.logos += 1;
    });
    if (standards) {
      entries.push({ name: `logos/${safeName(standards.name, 'STANDARDS')}.draft.standards`, data: JSON.stringify(standards, null, 2) });
    }

    if (notes && String(notes).trim()) {
      entries.push({ name: `notes/${base} NOTES.txt`, data: String(notes) });
      report.notes = true;
    }
    entries.push({ name: 'details/', data: '' });
    return { entries, report };
  };

  // OPENING A BUNDLE: the .draft at the top (the first one, if somebody put
  // two there), and the standards package beside the logos.
  const readBundle = async file => {
    const files = await readZip(file);
    const top = files.filter(f => !f.name.includes('/') && /\.(draft|json|model|plan)$/i.test(f.name));
    const main = top[0] || files.find(f => /\.(draft|json)$/i.test(f.name) && !/^holograms\//i.test(f.name));
    if (!main) throw new Error('The zip has no drawing (.draft) at its top.');
    const decoder = new TextDecoder();
    const standardsFile = files.find(f => /\.standards$/i.test(f.name));
    let standards = null;
    if (standardsFile) {
      try { standards = JSON.parse(decoder.decode(standardsFile.bytes)); } catch { standards = null; }
    }
    return {
      drawingFile: new File([main.bytes], main.name.split('/').pop(), { type: 'application/json' }),
      standards,
      names: files.map(f => f.name),
    };
  };

  // THE LOGO COMES HOME: a logo the drawing names that this browser's
  // standards do not hold is added to them (8 at most, as STANDARDS allows).
  // Nothing else in this browser's standards is touched.
  const MAX_LOGOS = 8;
  const MAX_LOGO_CHARS = 400 * 1024;
  const restoreLogos = (drawing, bundled, manager) => {
    if (!manager || !bundled) return { added: 0, full: false };
    const theirs = bundled.content && bundled.content.model && Array.isArray(bundled.content.model.companyLogos)
      ? bundled.content.model.companyLogos : [];
    const active = manager.getActive('standards');
    const mine = active && active.content && active.content.model && Array.isArray(active.content.model.companyLogos)
      ? active.content.model.companyLogos : [];
    const wanted = namedLogoIds(drawing)
      .filter(id => !mine.some(logo => logo && logo.id === id))
      .map(id => theirs.find(logo => logo && logo.id === id))
      .filter(logo => logo && typeof logo.dataUrl === 'string'
        && /^data:image\/(png|jpeg|gif|webp|svg\+xml);/i.test(logo.dataUrl) && logo.dataUrl.length <= MAX_LOGO_CHARS);
    if (!wanted.length) return { added: 0, full: false };
    const room = Math.max(0, MAX_LOGOS - mine.length);
    const adding = wanted.slice(0, room);
    if (adding.length) {
      const content = (active && active.content) || {};
      manager.saveActive(manager.createPackage('standards', (active && active.name) || manager.defaultName(),
        { ...content, model: { ...(content.model || {}), companyLogos: [...mine, ...adding] } }));
    }
    return { added: adding.length, full: adding.length < wanted.length };
  };

  window.DraftZipBundle = Object.freeze({
    crc32, writeZip, readZip, looksLikeZip, bundleEntries, readBundle, restoreLogos, safeName,
  });
})();
