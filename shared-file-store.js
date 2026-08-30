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
    tx.oncomplete = () => (failure ? reject(failure) : resolve(nextRev));
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
};
}
