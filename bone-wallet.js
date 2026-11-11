// The FREE-BONE wallet (board #261, Phase 1) — the bone economy's first
// working piece. Every new browser starts with a few free bones, one more
// drips in every hour up to a ceiling, and pressing the red BUILD HOUSE
// bone spends one. Pure logic + localStorage, no DOM, no component state.
//
// HONOR SYSTEM, BY DESIGN: this is localStorage — incognito or a new
// browser is a fresh wallet, and anyone with devtools can edit the number.
// That is fine and intentional for the free testing phase; the office
// refill line while play-testing is simply
//   localStorage.setItem('draft-bone-wallet',
//     JSON.stringify({ balance: 99, lastDripAt: Date.now(), createdAt: Date.now() }))
// Real enforcement arrives with the server-side ledger (#52). Do not add
// obfuscation or anti-tamper here — it would only complicate the tuning.
if (!window.DraftBoneWallet) {
(() => {
  const SEED_BONES = 3;                 // new-browser grant
  const DRIP_MS = 60 * 60 * 1000;       // one bone per hour
  const DRIP_CAP = 10;                  // free wallet ceiling
  // THE 25-BONE CEILING (jb, 11 Nov 2026: "go into the notepad and type
  // 25BONES on the first line, as long as it's typed in there first line
  // they get 25 BONES max"): the same hourly drip, a ceiling of 25 for as
  // long as the first line of the NOTES pad (page 1, kept in localStorage
  // under the pad's own key by model/04, and in the .draft) reads 25BONES.
  // Take the line off and the ceiling is 10 again -- bones already above
  // it are kept (at or above the cap the clock parks; nothing is taken),
  // the drip just waits until a spend brings the wallet under 10.
  const BIG_CAP = 25;
  const BONES_CODE = '25BONES';
  const NOTES_KEY = 'draft.notepad';
  const capNow = () => {
    try {
      const first = String(localStorage.getItem(NOTES_KEY) || '').split('\n')[0];
      return first.trim().toUpperCase() === BONES_CODE ? BIG_CAP : DRIP_CAP;
    } catch { return DRIP_CAP; }
  };
  // The spend registry — the growth point: elevation re-deals (#253)
  // register here later.
  // A BACKUP FILE BY EMAIL was 3 (Movie, 30 Oct: "charge them 3 bones per
  // email backup ... to slow them down a bit"). jb, 11 Nov 2026: "make a
  // save 1 bone and make the email save an additional bone" -- SAVE AS to
  // this computer is 1 (model/17-boot-save.js, LAYOUT.html; refused at 0,
  // jb's ruling, while the plain SAVE to this browser stays free) and the
  // BACKUP FILE email that follows it is 1 more (backup-email.js, spent only
  // once the mail has gone).
  // LAYOUT'S TWO PRINT PRESSES (board #168; jb, 11 Nov 2026: "make it 3
  // bones to print a PDF", "lets make a PDF 5 bones", then "make paper print
  // cost 2 bone"): PRINT, the browser's print window, is 2; SAVE PDF, the
  // file this page writes itself (pdf-writer.js), is 5. Each is taken once
  // the sheets are drawn and the window opens or the file is down, refused
  // at fewer.
  // SAVE DXF (AUTOCAD) is 15 (jb, 11 Nov 2026: "lets make it 5 bones to
  // convert to DXF" -- "no wait, lets make it 15"), taken as the ZIP goes
  // to the downloads folder. Above DRIP_CAP, so the free drip alone never
  // reaches it: a DXF waits on a bought wallet (the server ledger, #52).
  const COSTS = Object.freeze({
    buildHouse: 1, saveToComputer: 1, emailBackup: 1, printPackage: 2, savePdf: 5, saveDxf: 15,
  });
  const STORAGE_KEY = 'draft-bone-wallet';

  // A stored wallet the code can trust: numbers coerced, a missing or
  // mangled record reseeds, and a lastDripAt in the FUTURE (clock set
  // back, restored VM) clamps to now so it can never freeze the faucet.
  const normalise = (raw, now) => {
    const stored = raw && typeof raw === 'object' ? raw : null;
    const balance = Number(stored?.balance);
    const lastDripAt = Number(stored?.lastDripAt);
    const createdAt = Number(stored?.createdAt);
    if (!stored || !Number.isFinite(balance) || !Number.isFinite(lastDripAt)) {
      return { balance: SEED_BONES, lastDripAt: now, createdAt: now };
    }
    return {
      balance: Math.max(0, Math.floor(balance)),
      lastDripAt: Math.min(lastDripAt, now),
      createdAt: Number.isFinite(createdAt) ? createdAt : now,
    };
  };

  // The hourly drip, pure. AT or above the cap the clock PARKS — elapsed
  // time is discarded (lastDripAt rides now), so a spend from the cap
  // starts a fresh hour toward the next bone and nothing banks above the
  // ceiling. BELOW the cap, whole hours grant and the fraction carries in
  // lastDripAt — no fractional loss, no double grants across reloads.
  const applyDrip = (state, now, cap = capNow()) => {
    let { balance, lastDripAt, createdAt } = state;
    if (lastDripAt > now) lastDripAt = now;
    if (balance >= cap) return { balance, lastDripAt: now, createdAt };
    const whole = Math.floor((now - lastDripAt) / DRIP_MS);
    if (whole <= 0) return { balance, lastDripAt, createdAt };
    const grant = Math.min(whole, cap - balance);
    balance += grant;
    lastDripAt = balance >= cap ? now : lastDripAt + whole * DRIP_MS;
    return { balance, lastDripAt, createdAt };
  };

  const store = state => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
    catch { /* storage unavailable — the wallet lives for the session */ }
  };

  const loadRaw = () => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)); }
    catch { return null; }
  };

  // The wallet after the drip, persisted when anything changed (a first
  // run seeds and writes). nextDripMs is the wait for the next free bone —
  // null at the cap, where no bone is coming. cap is the ceiling in force
  // (10, or 25 with the code on the NOTES pad).
  const read = (now = Date.now(), cap = capNow()) => {
    const raw = loadRaw();
    const before = normalise(raw, now);
    const state = applyDrip(before, now, cap);
    if (!raw || state.balance !== before.balance || state.lastDripAt !== before.lastDripAt) {
      store(state);
    }
    return {
      ...state,
      cap,
      nextDripMs: state.balance >= cap ? null : Math.max(0, state.lastDripAt + DRIP_MS - now),
    };
  };

  // Spend n bones: true and decremented when the wallet covers it, false
  // untouched otherwise — never negative. Storage is re-read here so two
  // open tabs can't both spend the same last bone off a stale copy.
  const spend = (n, now = Date.now(), cap = capNow()) => {
    const count = Number(n);
    if (!Number.isFinite(count) || count <= 0) return false;
    const state = applyDrip(normalise(loadRaw(), now), now, cap);
    if (state.balance < count) { store(state); return false; }
    store({ ...state, balance: state.balance - count });
    return true;
  };

  // "1 bone" / "3 bones" -- one spelling for every card that names a price.
  const bonesWord = n => `${n} bone${Number(n) === 1 ? '' : 's'}`;

  window.DraftBoneWallet = Object.freeze({
    SEED_BONES,
    DRIP_MS,
    DRIP_CAP,
    BIG_CAP,
    BONES_CODE,
    cap: capNow,
    COSTS,
    STORAGE_KEY,
    normalise,
    applyDrip,
    read,
    spend,
    bonesWord,
  });
})();
}
