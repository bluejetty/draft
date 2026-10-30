// SAVE BACKUP FILE TO EMAIL (Movie, 30 Oct).
//
// "when the SAVE a DRAFT file it asks them -SEND BACKUP TO EMAIL?, or if they
// save a PDF ask them the same question" -- the popup says "SAVE BACKUP FILE
// TO EMAIL" and the copy is called a BACKUP FILE -- and "make them save
// locally and only offer the email save if they save locally ... i don't want
// the email thing to be abused". So there is no EMAIL button anywhere: the
// offer comes up only after a file has gone to this computer (SAVE AS, or a
// PRINT package the browser could have saved as a PDF), and a browser may
// send at most SENDS_PER_HOUR of them. And each one costs BONES (Movie, 30
// Oct: "charge them 3 bones per email backup") from the bone wallet --
// spent once the mail has gone, so a failed send costs nothing.
//
// THE MAIL GOES THROUGH THE SAME WORKER AS invoice.bluejetty.ca's book: a
// POST of { app, email, filename, dataUrl } to bluejetty-mail. The Resend key
// lives in the worker and nowhere here.
//
// A BIG FILE GOES IN PIECES. Resend takes 40 MB a message, counted AFTER the
// attachment is base64'd (a third bigger), so a part is at most PART_BYTES of
// raw file. Anything bigger is zipped first (deflated where the browser can);
// a zip still too big is cut into name.zip.001, .002 ... -- one email each,
// put back together by 7-Zip or WinRAR opening the .001.
(() => {
  const ENDPOINT = 'https://bluejetty-mail.bluejetty.workers.dev';
  const APP = 'bluejetty';
  const PART_BYTES = 25 * 1024 * 1024;
  const SENDS_PER_HOUR = 5;
  const ADDRESS_KEY = 'draft-backup-email';
  const SENT_KEY = 'draft-backup-email-sent';
  const wallet = () => window.DraftBoneWallet || null;
  const cost = () => Number(wallet()?.COSTS?.emailBackup) || 3;
  const bonesHeld = () => (wallet() ? wallet().read().balance : 0);

  const store = {
    get: key => { try { return localStorage.getItem(key); } catch { return null; } },
    set: (key, value) => { try { localStorage.setItem(key, value); } catch { /* private window */ } },
  };
  const validAddress = text => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(text || '').trim());

  // ── THE HOURLY ALLOWANCE, per browser ─────────────────────────────────
  const sentTimes = (now = Date.now()) => {
    let list = [];
    try { list = JSON.parse(store.get(SENT_KEY) || '[]'); } catch { list = []; }
    return (Array.isArray(list) ? list : []).filter(t => Number.isFinite(t) && now - t < 3600e3);
  };
  const allowance = (now = Date.now()) => SENDS_PER_HOUR - sentTimes(now).length;
  const noteSent = (count, now = Date.now()) => {
    store.set(SENT_KEY, JSON.stringify([...sentTimes(now), ...Array(count).fill(now)]));
  };

  // ── A ZIP OF ONE FILE ─────────────────────────────────────────────────
  const CRC = (() => {
    const t = new Uint32Array(256);
    for (let i = 0; i < 256; i += 1) {
      let c = i;
      for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[i] = c >>> 0;
    }
    return t;
  })();
  const crc32 = bytes => {
    let c = 0xffffffff;
    for (let i = 0; i < bytes.length; i += 1) c = CRC[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const deflateRaw = async bytes => {
    if (typeof CompressionStream === 'undefined') return null;
    try {
      const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate-raw'));
      return new Uint8Array(await new Response(stream).arrayBuffer());
    } catch { return null; }
  };
  const zipOne = async (name, bytes) => {
    const packed = await deflateRaw(bytes);
    const deflated = packed && packed.length < bytes.length;
    const data = deflated ? packed : bytes;
    const method = deflated ? 8 : 0;
    const nameBytes = new TextEncoder().encode(name);
    const crc = crc32(bytes);
    const u16 = v => [v & 0xff, (v >>> 8) & 0xff];
    const u32 = v => [v & 0xff, (v >>> 8) & 0xff, (v >>> 16) & 0xff, (v >>> 24) & 0xff];
    const local = Uint8Array.from([...u32(0x04034b50), ...u16(20), ...u16(0x0800), ...u16(method), ...u16(0), ...u16(0x21),
      ...u32(crc), ...u32(data.length), ...u32(bytes.length), ...u16(nameBytes.length), ...u16(0)]);
    const central = Uint8Array.from([...u32(0x02014b50), ...u16(20), ...u16(20), ...u16(0x0800), ...u16(method), ...u16(0),
      ...u16(0x21), ...u32(crc), ...u32(data.length), ...u32(bytes.length), ...u16(nameBytes.length), ...u16(0), ...u16(0),
      ...u16(0), ...u16(0), ...u32(0), ...u32(0)]);
    const centralSize = central.length + nameBytes.length;
    const end = Uint8Array.from([...u32(0x06054b50), ...u16(0), ...u16(0), ...u16(1), ...u16(1),
      ...u32(centralSize), ...u32(local.length + nameBytes.length + data.length), ...u16(0)]);
    return new Blob([local, nameBytes, data, central, nameBytes, end], { type: 'application/zip' });
  };

  // ── WHAT GOES OUT: the file, its zip, or the zip in numbered parts ────
  const piecesOf = async (name, blob) => {
    if (blob.size <= PART_BYTES) return [{ filename: name, blob }];
    const zip = await zipOne(name, new Uint8Array(await blob.arrayBuffer()));
    const zipName = `${name}.zip`;
    if (zip.size <= PART_BYTES) return [{ filename: zipName, blob: zip }];
    const parts = [];
    for (let at = 0, n = 1; at < zip.size; at += PART_BYTES, n += 1) {
      parts.push({ filename: `${zipName}.${String(n).padStart(3, '0')}`, blob: zip.slice(at, at + PART_BYTES) });
    }
    return parts;
  };
  const asDataUrl = blob => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
  const post = async (to, piece) => {
    const res = await fetch(ENDPOINT, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ app: APP, email: to, filename: piece.filename, dataUrl: await asDataUrl(piece.blob) }),
    });
    if (!res.ok) throw new Error(`the mail server replied ${res.status}`);
  };

  // ── THE POPUP ─────────────────────────────────────────────────────────
  const CSS = `
  .bk-scrim{position:fixed;inset:0;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;z-index:100000}
  .bk-card{background:#fff;color:#1d1f20;width:min(380px,calc(100vw - 32px));padding:18px 18px 14px;border-radius:4px;
    box-shadow:0 8px 28px rgba(0,0,0,.35);font-family:'Barlow Condensed',system-ui,sans-serif}
  .bk-card h2{margin:0 0 6px;font-size:18px;letter-spacing:.5px;font-weight:700}
  .bk-card p{margin:0 0 10px;font-size:13px;line-height:1.35;color:#4b4f52}
  .bk-card input[type=email]{width:100%;box-sizing:border-box;padding:7px 8px;font:inherit;font-size:14px;border:1px solid #9aa0a4}
  .bk-row{display:flex;gap:8px;justify-content:flex-end;margin-top:12px}
  .bk-row button{font:inherit;font-weight:700;letter-spacing:.5px;padding:7px 14px;border:1px solid #2f5b85;background:#fff;color:#2f5b85;cursor:pointer}
  .bk-row button[data-bk-send]{background:#2f5b85;color:#fff}
  .bk-row button:disabled{opacity:.5;cursor:default}
  .bk-status{min-height:16px;margin-top:8px;font-size:13px}
  .bk-status[data-kind=error]{color:#c62828}
  .bk-status[data-kind=ok]{color:#2e7d32}`;
  const ensureStyle = () => {
    if (document.getElementById('bk-style')) return;
    const style = document.createElement('style');
    style.id = 'bk-style';
    style.textContent = CSS;
    document.head.appendChild(style);
  };
  const MB = bytes => `${(bytes / 1024 / 1024).toFixed(1)} MB`;

  // `blob` is the file just saved; without one (a PDF the browser saved where
  // this page cannot see it) SEND asks for it with a file picker first.
  const open = ({ name = '', blob = null, what = 'file', accept = '' } = {}) => {
    if (!document.body) return null;
    document.querySelector('[data-backup-email]')?.remove();
    ensureStyle();
    const scrim = document.createElement('div');
    scrim.className = 'bk-scrim';
    scrim.dataset.backupEmail = '';
    scrim.innerHTML = `<div class="bk-card" role="dialog" aria-modal="true" aria-labelledby="bk-title">
      <h2 id="bk-title">SAVE BACKUP FILE TO EMAIL</h2>
      <p data-bk-what></p>
      <input type="email" data-bk-to placeholder="you@example.com" aria-label="Email address">
      <div class="bk-status" data-bk-status></div>
      <div class="bk-row">
        <button type="button" data-bk-skip>NO THANKS</button>
        <button type="button" data-bk-send>SEND</button>
      </div></div>`;
    const whatLine = scrim.querySelector('[data-bk-what]');
    whatLine.textContent = (blob
      ? `Saved on this computer: ${name} (${MB(blob.size)}). Also email a BACKUP FILE copy to:`
      : `Saved your ${what} on this computer? Email it as a BACKUP FILE too -- SEND asks you to pick the file you saved.`)
      + ` It costs ${cost()} bones (you have ${bonesHeld()}).`;
    const to = scrim.querySelector('[data-bk-to]');
    to.value = store.get(ADDRESS_KEY) || '';
    const status = scrim.querySelector('[data-bk-status]');
    const sendBtn = scrim.querySelector('[data-bk-send]');
    const skipBtn = scrim.querySelector('[data-bk-skip]');
    const say = (text, kind = '') => { status.textContent = text; status.dataset.kind = kind; };
    const close = () => scrim.remove();
    skipBtn.addEventListener('click', close);
    scrim.addEventListener('click', event => { if (event.target === scrim) close(); });
    scrim.addEventListener('keydown', event => {
      if (event.key === 'Escape') { event.preventDefault(); close(); }
      if (event.key === 'Enter' && event.target === to) { event.preventDefault(); sendBtn.click(); }
    });
    const pick = () => new Promise(resolve => {
      const input = document.createElement('input');
      input.type = 'file';
      if (accept) input.accept = accept;
      input.addEventListener('change', () => resolve(input.files && input.files[0] ? input.files[0] : null), { once: true });
      input.click();
    });
    sendBtn.addEventListener('click', async () => {
      const address = to.value.trim();
      if (!validAddress(address)) { say('Enter a valid email address.', 'error'); to.focus(); return; }
      if (!wallet() || bonesHeld() < cost()) {
        say(`A BACKUP FILE email costs ${cost()} bones and you have ${bonesHeld()}. A free bone drips in every hour.`, 'error');
        return;
      }
      let file = blob, fileName = name;
      if (!file) {
        const picked = await pick();
        if (!picked) { say('No file picked -- nothing sent.', 'error'); return; }
        file = picked; fileName = picked.name;
      }
      sendBtn.disabled = true; skipBtn.disabled = true;
      try {
        say('Getting the BACKUP FILE ready…');
        const pieces = await piecesOf(fileName, file);
        if (pieces.length > allowance()) {
          say(`That is ${pieces.length} emails and this browser has ${Math.max(0, allowance())} left this hour. Try again later.`, 'error');
          sendBtn.disabled = false; skipBtn.disabled = false;
          return;
        }
        store.set(ADDRESS_KEY, address);
        for (let i = 0; i < pieces.length; i += 1) {
          say(pieces.length > 1 ? `Sending PART ${i + 1} OF ${pieces.length}…` : 'Sending…');
          await post(address, pieces[i]);
          noteSent(1);
        }
        // PAID ONCE IT HAS GONE: one backup, however many parts it took.
        wallet().spend(cost());
        say(pieces.length > 1
          ? `Sent to ${address} in ${pieces.length} emails. Open the .001 with 7-Zip or WinRAR to put them back together.`
          : `BACKUP FILE sent to ${address}.`, 'ok');
        window.dispatchEvent(new CustomEvent('draft-bones-changed'));
        skipBtn.disabled = false;
        skipBtn.textContent = 'CLOSE';
      } catch (error) {
        say(`Could not send (${error.message || error}). Your saved file is still on this computer.`, 'error');
        sendBtn.disabled = false; skipBtn.disabled = false;
      }
    });
    document.body.appendChild(scrim);
    to.focus();
    if (to.value) to.select();
    return scrim;
  };

  window.DraftBackupEmail = Object.freeze({
    offer: ({ name, blob }) => open({ name, blob }),
    offerPicked: ({ what = 'PDF', accept = '.pdf,application/pdf' } = {}) => open({ what, accept }),
    piecesOf, zipOne, crc32, allowance, noteSent,
    ENDPOINT, APP, PART_BYTES, SENDS_PER_HOUR,
  });
})();
