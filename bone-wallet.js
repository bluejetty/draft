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
  // The spend registry — the growth point: elevation re-deals (#253) and
  // LAYOUT printing (#168, 3 bones) register here later. Phase 1 wires
  // ONLY the BUILD HOUSE press.
  const COSTS = Object.freeze({ buildHouse: 1 });
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
  const applyDrip = (state, now) => {
    let { balance, lastDripAt, createdAt } = state;
    if (lastDripAt > now) lastDripAt = now;
    if (balance >= DRIP_CAP) return { balance, lastDripAt: now, createdAt };
    const whole = Math.floor((now - lastDripAt) / DRIP_MS);
    if (whole <= 0) return { balance, lastDripAt, createdAt };
    const grant = Math.min(whole, DRIP_CAP - balance);
    balance += grant;
    lastDripAt = balance >= DRIP_CAP ? now : lastDripAt + whole * DRIP_MS;
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
  // null at the cap, where no bone is coming.
  const read = (now = Date.now()) => {
    const raw = loadRaw();
    const before = normalise(raw, now);
    const state = applyDrip(before, now);
    if (!raw || state.balance !== before.balance || state.lastDripAt !== before.lastDripAt) {
      store(state);
    }
    return {
      ...state,
      nextDripMs: state.balance >= DRIP_CAP ? null : Math.max(0, state.lastDripAt + DRIP_MS - now),
    };
  };

  // Spend n bones: true and decremented when the wallet covers it, false
  // untouched otherwise — never negative. Storage is re-read here so two
  // open tabs can't both spend the same last bone off a stale copy.
  const spend = (n, now = Date.now()) => {
    const count = Number(n);
    if (!Number.isFinite(count) || count <= 0) return false;
    const state = applyDrip(normalise(loadRaw(), now), now);
    if (state.balance < count) { store(state); return false; }
    store({ ...state, balance: state.balance - count });
    return true;
  };

  window.DraftBoneWallet = Object.freeze({
    SEED_BONES,
    DRIP_MS,
    DRIP_CAP,
    COSTS,
    STORAGE_KEY,
    normalise,
    applyDrip,
    read,
    spend,
  });
})();
}
