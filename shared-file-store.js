// Per-tool file storage (IndexedDB) so a dropped file survives navigating away and back to the SAME tool page.
if (!window.SharedFileStore) {
const DB_NAME = 'pdf-img-mgr-shared';
const STORE = 'files';
const DEFAULT_BUCKET = 'active';

// One connection is shared by every call; it is dropped whenever the handle stops
// being usable (another page upgrades or deletes the database, or the browser
// closes it) so the next call opens a fresh one.
let dbPromise = null;

function openDb() {
  if (dbPromise) return dbPromise;
  const pending = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => { req.result.createObjectStore(STORE); };
    req.onsuccess = () => {
      const db = req.result;
      db.onversionchange = () => { forget(pending); db.close(); };
      db.onclose = () => forget(pending);
      resolve(db);
    };
    // BLOCKED IS NEITHER SUCCESS NOR ERROR, which is why it needs its own line
    // and why its absence was invisible. While an open is blocked -- a
    // deleteDatabase still pending, or another connection holding the old
    // version -- the request just sits there: onsuccess does not fire and
    // neither does onerror.
    //
    // THE HANG IS PERMANENT, NOT A STALL. `pending` is cached in dbPromise
    // above, and forget() is only reachable from onsuccess, onerror,
    // onversionchange and onclose. A promise that never settles reaches none
    // of them, so dbPromise is never cleared and EVERY later loadSharedFile on
    // that page awaits the same dead promise. The page does not recover; it is
    // finished.
    //
    // Rejecting hands it to withDb, which forgets this promise and opens a
    // fresh one -- one automatic retry, by the path that was already there.
    req.onblocked = () => {
      forget(pending);
      reject(new Error(`draft: indexedDB open blocked — another connection or a `
        + `pending deleteDatabase still holds ${DB_NAME}`));
    };
    req.onerror = () => { forget(pending); reject(req.error); };
  });
  dbPromise = pending;
  return pending;
}

function forget(pending) {
  if (dbPromise === pending) dbPromise = null;
}

async function withDb(run) {
  const pending = openDb();
  try {
    return await run(await pending);
  } catch (error) {
    forget(pending);
    if (dbPromise) throw error;
    return run(await openDb());
  }
}

// Every bucket carries a revision, stored under its own key and bumped in the
// SAME transaction as the records — so a revision and the records read with it
// always describe one state of the bucket.
//
// It exists because a whole-bucket write is how this store has always worked:
// two pages that each hold a copy of the model drawing (MODEL and LAYOUT both
// do) write their whole copy back, and the second one silently erases what the
// first one did. The revision turns that from silent into refused: pass the
// revision you read as `ifRev`, and a write that would land on top of someone
// else's throws StaleWriteError instead. The caller re-reads, merges its own
// keys onto what is really there now, and writes again.
const revKey = bucket => `${bucket}::rev`;

class StaleWriteError extends Error {
  constructor(bucket, expected, actual) {
    super(`${bucket} changed underneath this write (expected revision ${expected}, found ${actual})`);
    this.name = 'StaleWriteError';
    this.stale = true;
    this.expectedRev = expected;
    this.actualRev = actual;
  }
}

// ── the edit lease ───────────────────────────────────────────────────────────
// The RESOLVER (RULING-autosave-two-writers.md §2). The broadcast prevents a
// clean page from going stale; this is what happens when two pages are both
// being edited, and it is the only thing in the design that protects work
// BEFORE it is written. `ifRev` catches a collision when it is already too late
// to do anything good — the drafter has made the edit, pressed the thing, and
// now learns they cannot have it. A lease means the second page never let them
// start.
//
// It does not make concurrent editing safe. It makes concurrent editing
// REFUSED, visibly, with the loser's work intact.
//
// IN ITS OWN KEY, NEVER IN THE RECORDS ARRAY AND NEVER TOUCHING `${bucket}::rev`.
// This is the load-bearing detail of the whole design: a lease that lives in the
// records makes every heartbeat a revision bump and every bump a stale refusal
// somewhere else, so the mechanism would generate precisely the storm it exists
// to prevent. The ruling pins it with a test and calls that test the most
// important one in the design.
//
// `scope` exists so that "the model keys" is a thing the store can name: MODEL
// uses `model`, LAYOUT uses none and must never be asked for one.
const leaseKey = (bucket, scope) => `${bucket}::lease:${scope}`;

// PROVISIONAL, PENDING THE iPAD MEASUREMENT. 15s / heartbeat TTL/4 is the shape
// the ruling starts from and explicitly does not decide; the resume path below
// is correct under every measurement outcome, so the constant is tuned
// afterwards rather than waited on. Nothing may test the specific value —
// `ttlMs` is a per-call argument so a test drives a real expiry in milliseconds.
const LEASE_TTL_MS = 15000;
const LEASE_HEARTBEAT_MS = LEASE_TTL_MS / 4;

// THE HOLDER ID SURVIVES THIS TAB'S OWN RELOAD, and it has to.
//
// MEASURED, not assumed: claim the lease, reload the tab, read the lease back.
// The record comes back byte-identical — same holder, same `until`, same
// generation — because the `pagehide` release does not land on a reload, which
// is what the ruling's own probe found and why §3.4 forbids depending on it. The
// reloaded page then arrives with a fresh `writerId`, fails to match the holder,
// and sits READ-ONLY IN ITS OWN DRAWING for the rest of the TTL. On the old page
// that gates autosave off for the same window. A drafter pressing F5 is not an
// edge case.
//
// `sessionStorage` is per-tab and dies with the tab, so: it survives F5, it is
// never shared with a second tab, and a closed tab's lease still expires on the
// TTL exactly as designed.
//
// KNOWN HOLE, STATED RATHER THAN LEFT TO BE FOUND: Chrome COPIES sessionStorage
// into a duplicated tab. Duplicate a drafting tab and both copies present the
// same holder id, so each is granted the lease as "already this holder" and both
// believe they hold it — the one case where this mechanism is silently off. It
// is not closable from here without a liveness ping between pages, which is a
// new message shape and belongs to whoever argues for it. Reload is constant and
// duplicating a drafting tab is rare, so the trade is taken deliberately.
//
// The ruling left this open (§6, "whether a lease survives its holder's reload")
// and warned that a restored id could claim a lease the drafter meant to give
// up. It cannot: `claimLease` still refuses a LIVE foreign holder, so a restored
// id can only ever reclaim something nobody else is holding. It removes the
// self-lockout without buying any power to steal.
const LEASE_HOLDER_KEY = 'draft-lease-holder';
let leaseHolder = null;
function leaseHolderId() {
  if (leaseHolder) return leaseHolder;
  try {
    const kept = sessionStorage.getItem(LEASE_HOLDER_KEY);
    if (kept) { leaseHolder = kept; return leaseHolder; }
  } catch (error) { /* private windows and blocked site data both throw */ }
  // Falls back to the per-page-instance id, which is the pre-reload behaviour:
  // no worse than not having it.
  leaseHolder = writerId;
  try { sessionStorage.setItem(LEASE_HOLDER_KEY, leaseHolder); } catch (error) { /* as above */ }
  return leaseHolder;
}

class LeaseError extends Error {
  constructor(bucket, scope, held) {
    super(held
      ? `${bucket} is being edited in another tab (${scope} is held by ${held.holderId})`
      : `${bucket}: the ${scope} lease is no longer held by this page`);
    this.name = 'LeaseError';
    this.lease = true;
    this.scope = scope;
    this.holderId = held ? held.holderId : null;
    this.generation = held ? held.generation : 0;
  }
}

// A lease record that has not expired. An expired one is kept rather than
// deleted — see releaseLease — so `generation` never goes backwards, and this is
// the one place that decides "held" means "held right now".
const liveLease = (record, now) =>
  (record && typeof record === 'object' && Number(record.until) > now) ? record : null;

// Grant if unheld, expired, or ALREADY THIS HOLDER — which makes claim and renew
// one operation and removes a race (§3.1). Otherwise refuse, naming the current
// holder so a banner can say WHO has it rather than that somebody does. Grant
// and refusal happen in one transaction, the read-modify-write discipline
// `updateRecords` already uses.
//
// NOT ANNOUNCED on the rung-2 broadcast. `announce()` carries a DATA revision
// and a lease operation has none; if pages ever need to hear about lease
// changes that is a different message shape and it needs its own argument.
function claimLease(bucket, scope, holderId, { ttlMs = LEASE_TTL_MS, takeover = false } = {}) {
  return withDb(db => new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    const key = leaseKey(bucket, scope);
    const req = tx.objectStore(STORE).get(key);
    let outcome = null;
    tx.oncomplete = () => resolve(outcome);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('lease claim aborted'));
    req.onsuccess = () => {
      const now = Date.now();
      const current = (req.result && typeof req.result === 'object') ? req.result : null;
      const held = liveLease(current, now);
      // TAKE OVER SEIZES A LIVE LEASE, and it is the only thing that may. The
      // ruling requires the press (§2) and gives claimLease no way to force one,
      // so it is a NAMED ARGUMENT rather than a second function: a takeover is a
      // deliberate act by a person who has read a banner, and it must never be
      // something a heartbeat can do by accident. The generation bumps as for any
      // change of holder, which is exactly how the loser finds out.
      if (held && held.holderId !== holderId && !takeover) {
        // A REFUSAL WRITES NOTHING. Not the lease, and certainly not the
        // records: a page that asked and was told no has changed nothing.
        outcome = {
          ok: false, holderId: held.holderId,
          until: Number(held.until), generation: Number(held.generation) || 1,
        };
        return;
      }
      // THE GENERATION MOVES ONLY ON A CHANGE OF HOLDER, never on a renewal —
      // and that is what makes the resume path (§3.4) possible. A page that
      // froze, whose lease expired with NOBODY taking it, re-claims here at the
      // generation it already had: nothing happened, so it has nothing to tell
      // the drafter about. Bump it on every re-claim and every woken tab
      // announces a takeover that never occurred.
      const mine = current && current.holderId === holderId;
      const generation = mine
        ? (Number(current.generation) || 1)
        : (Number(current && current.generation) || 0) + 1;
      const next = { holderId, until: now + ttlMs, generation };
      tx.objectStore(STORE).put(next, key);
      outcome = { ok: true, ...next };
    };
  }));
}

// The same operation, by §3.1, and therefore the same code: two implementations
// of "keep holding it" are two things that can disagree about what holding it
// means.
function renewLease(bucket, scope, holderId, options) {
  return claimLease(bucket, scope, holderId, options);
}

// Best effort, and NOTHING MAY DEPEND ON IT HAVING RUN (§3.4): the probe found a
// `pagehide` IndexedDB write fail to land on a tab reload with no memory
// pressure at all. The TTL is the real backstop.
//
// Expired rather than deleted, so the record keeps its generation. Delete it and
// the next holder starts at generation 1 again, and a generation that can repeat
// is a generation a stale page can match.
function releaseLease(bucket, scope, holderId) {
  return withDb(db => new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    const key = leaseKey(bucket, scope);
    const req = tx.objectStore(STORE).get(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('lease release aborted'));
    req.onsuccess = () => {
      const current = (req.result && typeof req.result === 'object') ? req.result : null;
      // ONLY THE HOLDER MAY RELEASE IT. A page that lost the lease and then ran
      // its own hide handler must not hand away the lease somebody else is
      // holding.
      if (!current || current.holderId !== holderId) return;
      tx.objectStore(STORE).put({ ...current, until: 0 }, key);
    };
  }));
}

// Who holds it right now, or null. An expired lease reads as null: it is an
// absent drafter, not a held lease — and not, to a banner, a free one either.
function readLease(bucket, scope) {
  return withDb(db => new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get(leaseKey(bucket, scope));
    tx.oncomplete = () => {
      const held = liveLease(req.result, Date.now());
      resolve(held ? {
        holderId: held.holderId,
        until: Number(held.until),
        generation: Number(held.generation) || 1,
      } : null);
    };
    tx.onerror = () => reject(tx.error);
  }));
}

// ── the change broadcast ─────────────────────────────────────────────────────
// A page that hears "this bucket is now rev 9" and re-reads is never stale, so
// it never has anything to overwrite. That is what this is for: it is a
// PREVENTER of the refusals in RULING-autosave-two-writers.md §0, not a
// resolver of concurrent edits, and it must not be described as one.
//
// ONE ID PER PAGE INSTANCE, and that is the whole of "who wrote last". A
// listener compares it against `writerId` below to ignore the writes its own
// page made. There is no per-key author map: the ruling rejects one by name
// (§3.3), because a per-key author map is object-level merge wearing a hat.
const writerId = `w-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

const bucketListeners = new Map();
let channel;

// KEYED ON THE DATABASE NAME, WITH NO FALLBACK. A browser without
// BroadcastChannel does not live-reload and degrades to exactly today's
// behaviour, which is a working page. A localStorage-event shim would be a
// second delivery path with second-class ordering, and §3.3 rules it out.
function bucketChannel() {
  if (channel !== undefined) return channel;
  channel = (typeof BroadcastChannel === 'function') ? new BroadcastChannel(DB_NAME) : null;
  if (channel) channel.onmessage = event => deliver(event.data);
  return channel;
}

function deliver(change) {
  if (!change || typeof change.bucket !== 'string') return;
  const listeners = bucketListeners.get(change.bucket);
  if (!listeners) return;
  // A COPY, because a listener is allowed to unsubscribe itself: mutating the
  // set being walked would silently skip the listener after it.
  [...listeners].forEach(listener => {
    // One listener that throws must not stop the next one hearing about a
    // change it may be holding stale data against.
    try { listener(change); } catch (error) {
      console.error('draft: an onBucketChanged listener failed', error);
    }
  });
}

// Announce a change that has COMMITTED. Called from tx.oncomplete and nowhere
// else — see the note at the call site, which is the one thing in this module
// most likely to be got wrong silently.
function announce(bucket, rev) {
  const change = { bucket, rev, writerId };
  const live = bucketChannel();
  if (live) {
    try { live.postMessage(change); } catch (error) {
      console.warn('draft: could not broadcast a bucket change', error);
    }
  }
  // THE WRITER'S OWN PAGE HEARS IT TOO. BroadcastChannel deliberately does not
  // echo to the object that posted, so without this line "this bucket changed"
  // would mean something different to a subscriber depending on which page did
  // the writing — and a page with two subscribers would have one of them miss
  // its own page's writes. Own writes are ignored by COMPARING writerId, which
  // is a decision the subscriber makes and can be seen making, rather than by
  // never being told.
  //
  // Queued, not called inline, so every listener runs after this write has
  // resolved for its caller whichever page it came from.
  setTimeout(() => deliver(change), 0);
}

// Hear about committed changes to one bucket. Returns the unsubscribe.
function onBucketChanged(bucket, listener) {
  const key = bucket || DEFAULT_BUCKET;
  bucketChannel();
  if (!bucketListeners.has(key)) bucketListeners.set(key, new Set());
  const listeners = bucketListeners.get(key);
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (!listeners.size) bucketListeners.delete(key);
  };
}

// One readwrite transaction: read the bucket, hand it to `mutate`, store what
// comes back, bump the revision. `mutate` must be SYNCHRONOUS — an IndexedDB
// transaction commits as soon as the microtask queue drains with no request
// pending, so an `await` inside it (reading a blob's text, say) would kill the
// transaction under you. Anything that needs a blob's CONTENTS belongs outside
// the transaction, guarded by `ifRev`.
function updateRecords(bucket, mutate, { ifRev = null, lease = null } = {}) {
  return withDb(db => new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    // Issued BEFORE the records read, so its result is in hand by the time that
    // one's onsuccess runs: requests on one transaction fire in the order they
    // were made. Same reason `revReq` is where it is.
    const leaseReq = lease ? store.get(leaseKey(bucket, lease.scope)) : null;
    const revReq = store.get(revKey(bucket));
    const recordsReq = store.get(bucket);
    let nextRev = null;
    let failure = null;
    // ANNOUNCED FROM oncomplete, NEVER FROM THE onsuccess BELOW. That handler
    // QUEUES the puts; it does not commit them. A listener woken by a message
    // posted from there is entitled to read the bucket and find the state that
    // was there BEFORE the write — and the failure mode is a clean page
    // re-reading the old drawing and calling itself current. `oncomplete` is
    // the only point at which the records and the revision are both real, and
    // it already has `nextRev` in hand.
    //
    // It is also the only point that has ruled out an abort: a refused write
    // (ifRev) and a throwing `mutate` both land on onabort, so neither
    // announces a revision that does not exist.
    tx.oncomplete = () => {
      if (failure) { reject(failure); return; }
      announce(bucket, nextRev);
      resolve(nextRev);
    };
    tx.onerror = () => reject(failure || tx.error);
    tx.onabort = () => reject(failure || tx.error || new Error('write aborted'));
    recordsReq.onsuccess = () => {
      const current = Array.isArray(recordsReq.result) ? recordsReq.result : [];
      const rev = Number(revReq.result) || 0;
      // THE LEASE IS CHECKED FIRST, and BEFORE THE MUTATE. Before the mutate
      // because a check after it has already let the caller's function run over
      // the real records, and the test for this asserts the CONTENTS rather than
      // the error. First because a page that does not hold the lease should be
      // told that, not handed a StaleWriteError that sends it down a merge and
      // retry path which cannot succeed however many times it runs.
      //
      // AND `ifRev` STILL APPLIES BELOW. The lease prevents the collision;
      // `ifRev` catches the case where prevention failed. A page that dropped
      // `ifRev` because it holds a lease would have reintroduced audit C3.
      if (lease) {
        const held = liveLease(leaseReq.result, Date.now());
        const ours = held && held.holderId === lease.holderId
          && Number(held.generation) === Number(lease.generation);
        if (!ours) {
          failure = new LeaseError(bucket, lease.scope, held);
          tx.abort();
          return;
        }
      }
      if (ifRev !== null && rev !== ifRev) {
        failure = new StaleWriteError(bucket, ifRev, rev);
        tx.abort();
        return;
      }
      let next;
      try { next = mutate(current); } catch (error) { failure = error; tx.abort(); return; }
      nextRev = rev + 1;
      store.put(next, bucket);
      store.put(nextRev, revKey(bucket));
    };
  }));
}

// Records and the revision that goes with them, read together.
function readBucket(bucket) {
  return withDb(db => new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const store = tx.objectStore(STORE);
    const recordsReq = store.get(bucket);
    const revReq = store.get(revKey(bucket));
    tx.oncomplete = () => resolve({
      records: Array.isArray(recordsReq.result) ? recordsReq.result : [],
      rev: Number(revReq.result) || 0,
    });
    tx.onerror = () => reject(tx.error);
  }));
}

function readRecords(bucket) {
  return readBucket(bucket).then(state => state.records);
}

function writeRecords(bucket, records, options) {
  return updateRecords(bucket, () => records, options);
}

const asRecord = file => ({ name: file.name, type: file.type, blob: file });

async function addSharedFile(file, bucket) {
  // Read-modify-write inside ONE transaction: read it outside and two tabs
  // adding a file at the same moment keep only the second one's.
  await updateRecords(bucket || DEFAULT_BUCKET, records => [...records, asRecord(file)]);
}

async function saveSharedFiles(files, bucket, options) {
  return writeRecords(bucket || DEFAULT_BUCKET, files.map(asRecord), options);
}

async function loadSharedFiles(bucket) {
  const records = await readRecords(bucket || DEFAULT_BUCKET);
  return records.map((r) => new File([r.blob], r.name, { type: r.type }));
}

// The single file plus the revision to hand back as `ifRev` on the next write.
async function loadSharedFileAt(bucket) {
  const { records, rev } = await readBucket(bucket || DEFAULT_BUCKET);
  const record = records[0];
  return {
    file: record ? new File([record.blob], record.name, { type: record.type }) : null,
    rev,
  };
}

// Back-compat single-file helpers (used by earlier pages).
// Returns the bucket's new revision — hand it back as `ifRev` next time to
// have a write refused rather than land on top of someone else's.
async function saveSharedFile(file, bucket, options) { return saveSharedFiles([file], bucket, options); }
async function loadSharedFile(bucket) {
  const files = await loadSharedFiles(bucket);
  return files[0] || null;
}

async function clearSharedFiles(bucket) { await writeRecords(bucket || DEFAULT_BUCKET, []); }
async function clearSharedFile(bucket) { await clearSharedFiles(bucket); }

// Named-record helpers: one bucket holds many files addressed by unique name
// (used for underlay binaries, which live outside the drawing JSON).
async function saveNamedFile(file, bucket) {
  // One transaction, as above: the underlay bucket holds every underlay in the
  // drawing, and a read-then-write would drop whichever one another page added
  // in between.
  await updateRecords(bucket || DEFAULT_BUCKET, records =>
    [...records.filter((r) => r.name !== file.name), asRecord(file)]);
}

async function loadNamedFile(name, bucket) {
  bucket = bucket || DEFAULT_BUCKET;
  const record = (await readRecords(bucket)).find((r) => r.name === name);
  return record ? new File([record.blob], record.name, { type: record.type }) : null;
}

async function removeNamedFile(name, bucket) {
  await updateRecords(bucket || DEFAULT_BUCKET, records =>
    records.filter((r) => r.name !== name));
}

window.SharedFileStore = {
  addSharedFile, saveSharedFiles, loadSharedFiles, clearSharedFiles,
  saveSharedFile, loadSharedFile, loadSharedFileAt, clearSharedFile,
  saveNamedFile, loadNamedFile, removeNamedFile,
  readBucket, StaleWriteError,
  onBucketChanged, writerId,
  claimLease, renewLease, releaseLease, readLease, LeaseError, leaseHolderId,
  LEASE_TTL_MS, LEASE_HEARTBEAT_MS,
};
}
