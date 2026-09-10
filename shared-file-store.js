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
function updateRecords(bucket, mutate, { ifRev = null } = {}) {
  return withDb(db => new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
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
};
}
