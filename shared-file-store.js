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

function readRecords(bucket) {
  return withDb(db => new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get(bucket);
    req.onsuccess = () => resolve(Array.isArray(req.result) ? req.result : []);
    req.onerror = () => reject(req.error);
  }));
}

function writeRecords(bucket, records) {
  return withDb(db => new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(records, bucket);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  }));
}

async function addSharedFile(file, bucket) {
  bucket = bucket || DEFAULT_BUCKET;
  const records = await readRecords(bucket);
  records.push({ name: file.name, type: file.type, blob: file });
  await writeRecords(bucket, records);
}

async function saveSharedFiles(files, bucket) {
  bucket = bucket || DEFAULT_BUCKET;
  await writeRecords(bucket, files.map((f) => ({ name: f.name, type: f.type, blob: f })));
}

async function loadSharedFiles(bucket) {
  bucket = bucket || DEFAULT_BUCKET;
  const records = await readRecords(bucket);
  return records.map((r) => new File([r.blob], r.name, { type: r.type }));
}

// Back-compat single-file helpers (used by earlier pages).
async function saveSharedFile(file, bucket) { await saveSharedFiles([file], bucket); }
async function loadSharedFile(bucket) {
  const files = await loadSharedFiles(bucket);
  return files[0] || null;
}

async function clearSharedFiles(bucket) { await writeRecords(bucket || DEFAULT_BUCKET, []); }
async function clearSharedFile(bucket) { await clearSharedFiles(bucket); }

window.SharedFileStore = {
  addSharedFile, saveSharedFiles, loadSharedFiles, clearSharedFiles,
  saveSharedFile, loadSharedFile, clearSharedFile,
};
}
