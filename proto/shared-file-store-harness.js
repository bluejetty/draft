#!/usr/bin/env node
// SHARED FILE STORE — the revision, the edit lease and the change broadcast,
// driven against a fake IndexedDB with the clock in this file's hand.
//
// WHY IT EXISTS. Devin's audit, 28 Sep: this module holds every drawing the
// two pages share and had no harness. It is not untested -- model-edit-lease
// and stale-merge-refusal drive it through a browser -- but a browser test
// cannot make a lease expire without waiting for it, cannot make an open
// arrive BLOCKED, and cannot say which of two refusals came first. Those are
// the three things RULING-autosave-two-writers.md is actually about.
//
// THE CLOCK IS AN ARGUMENT HERE. `Date.now` in the sandbox is this file's
// `NOW`, so a TTL expires by moving a number rather than by sleeping. Nothing
// below asserts the shipped 15s constant: the ruling calls it provisional and
// says explicitly that nothing may test the value, so every case passes its
// own `ttlMs`.
//
// THE FAKE STORE IS NOT A MOCK OF THE CALLS. It is a small IndexedDB with the
// two behaviours the module's correctness rests on: requests on one
// transaction fire IN THE ORDER THEY WERE MADE, and an abort rolls the whole
// transaction back. A stub that merely records "put was called" would go green
// on a read-modify-write split across two transactions, which is the bug this
// module keeps being edited to avoid.
//
// Run: node proto/shared-file-store-harness.js
//      node proto/shared-file-store-harness.js --mutate
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const MUTATE = require('./harness-args.js').mutationMode();

let EDIT = null;
const readSubject = name => {
  const text = fs.readFileSync(path.join(ROOT, name), 'utf8');
  return EDIT && EDIT.file === name ? EDIT.fn(text) : text;
};

// ── THE FAKE INDEXEDDB ──────────────────────────────────────────────────
//
// `blockOpens` makes the next open arrive as onblocked, which is the state a
// pending deleteDatabase leaves a page in and the one that used to hang it
// forever.
function fakeIndexedDb(world) {
  const data = new Map();
  world.data = data;
  const open = () => {
    const req = { onsuccess: null, onerror: null, onupgradeneeded: null, onblocked: null };
    world.tick(() => {
      if (world.blockOpens) { if (req.onblocked) req.onblocked(); return; }
      world.opens += 1;
      const db = {
        close() {}, onversionchange: null, onclose: null,
        createObjectStore() { world.created += 1; },
        transaction(_store, mode) { return makeTx(data, world, mode === 'readwrite'); },
      };
      req.result = db;
      // Only the first open of a database upgrades it.
      if (world.created === 0 && req.onupgradeneeded) req.onupgradeneeded();
      if (req.onsuccess) req.onsuccess();
    });
    return req;
  };
  return { open };
}

function makeTx(data, world, writable) {
  const queue = [];
  const staged = new Map();
  let aborted = false;
  let draining = false;
  const tx = {
    error: null, oncomplete: null, onerror: null, onabort: null,
    abort() { aborted = true; },
    objectStore() {
      return {
        get(key) {
          const req = { onsuccess: null, result: undefined };
          queue.push(() => {
            req.result = staged.has(key) ? staged.get(key) : data.get(key);
            if (req.onsuccess) req.onsuccess();
          });
          return req;
        },
        put(value, key) {
          const req = { onsuccess: null };
          // STAGED, NOT WRITTEN. A transaction that aborts must leave the
          // store as it found it -- the whole point of doing the read, the
          // mutate and the write inside one.
          queue.push(() => { staged.set(key, value); if (req.onsuccess) req.onsuccess(); });
          return req;
        },
      };
    },
  };
  // Drains as a task, so the caller has finished queueing its requests before
  // the first one fires -- and a handler may queue more, as updateRecords does.
  world.tick(function drain() {
    if (draining) return;
    draining = true;
    while (queue.length && !aborted) queue.shift()();
    draining = false;
    if (aborted) { if (tx.onabort) tx.onabort(); return; }
    if (writable) staged.forEach((value, key) => data.set(key, value));
    if (tx.oncomplete) tx.oncomplete();
  });
  return tx;
}

// ── THE SANDBOX ─────────────────────────────────────────────────────────
function loadStore() {
  const tasks = [];
  const world = {
    now: 1000000, opens: 0, created: 0, blockOpens: false, session: new Map(),
    sessionThrows: false,
    tick: fn => tasks.push(fn),
  };
  const win = {};
  const sandbox = {
    window: win, Math, Number, String, Object, Array, JSON, Map, Set, Boolean,
    Promise, Error, Symbol, RegExp, isFinite, parseFloat, parseInt,
    console: { warn: () => {}, error: m => world.errors.push(String(m)), log: () => {} },
    Date: { now: () => world.now },
    setTimeout: fn => { tasks.push(fn); return 0; },
    indexedDB: fakeIndexedDb(world),
    sessionStorage: {
      getItem: key => {
        if (world.sessionThrows) throw new Error('site data blocked');
        return world.session.has(key) ? world.session.get(key) : null;
      },
      setItem: (key, value) => {
        if (world.sessionThrows) throw new Error('site data blocked');
        world.session.set(key, value);
      },
    },
  };
  world.errors = [];
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(readSubject('shared-file-store.js'), sandbox,
    { filename: 'shared-file-store.js' });
  if (!win.SharedFileStore) throw new Error('shared-file-store.js published nothing');
  // Nothing in the module is truly async: every await lands on a promise this
  // file's own tasks settle. `settle` runs them until the queue is empty, so a
  // case reads like straight-line code.
  const turn = async n => { for (let i = 0; i < n; i += 1) await Promise.resolve(); };
  const settle = async () => {
    for (let i = 0; i < 5000; i += 1) {
      if (!tasks.length) {
        // A settled promise can queue the next task several turns later --
        // withDb's one retry is three links of chain -- so an empty queue is
        // only really empty after the microtasks have run out too.
        await turn(20);
        if (!tasks.length) return;
      }
      tasks.shift()();
      await turn(5);
    }
  };
  const run = async promise => {
    let value, error, done = false;
    promise.then(v => { value = v; done = true; }, e => { error = e; done = true; });
    await settle();
    if (!done) return { hung: true };
    return { value, error };
  };
  return { S: win.SharedFileStore, world, run };
}

let passed = 0;
let failures = [];
const check = (label, condition, detail) => {
  if (condition) { passed += 1; return; }
  failures.push(detail ? `${label} — ${detail}` : label);
};

const BUCKET = 'model';
const SCOPE = 'model';

async function runChecks() {
  passed = 0; failures = [];
  const { S, world, run } = loadStore();

  // ── THE REVISION AND THE RECORDS ARE ONE STATE ───────────────────────
  const first = await run(S.saveSharedFiles([{ name: 'a.draft', type: 'text/plain' }], BUCKET));
  check('a write comes back with the revision it landed at', first.value === 1,
    `got ${JSON.stringify(first.value)}${first.error ? ` / ${first.error.message}` : ''}`);
  const read1 = await run(S.readBucket(BUCKET));
  check('the bucket reads back its records and that revision together',
    read1.value && read1.value.rev === 1 && read1.value.records.length === 1,
    JSON.stringify(read1.value));

  // ifRev: THE REFUSAL, AND THAT IT LEAVES NOTHING BEHIND.
  const stale = await run(S.saveSharedFiles(
    [{ name: 'b.draft', type: 'text/plain' }], BUCKET, { ifRev: 0 }));
  check('a write onto someone else-s revision is refused',
    stale.error && stale.error.name === 'StaleWriteError',
    stale.error ? stale.error.name : `resolved with ${stale.value}`);
  check('the refusal names both revisions so the caller can merge',
    stale.error && stale.error.expectedRev === 0 && stale.error.actualRev === 1);
  const afterStale = await run(S.readBucket(BUCKET));
  check('a refused write changes neither the records nor the revision',
    afterStale.value.rev === 1 && afterStale.value.records[0].name === 'a.draft',
    JSON.stringify(afterStale.value));
  const good = await run(S.saveSharedFiles(
    [{ name: 'b.draft', type: 'text/plain' }], BUCKET, { ifRev: 1 }));
  check('a write on the revision it read goes through', good.value === 2);

  // ── THE LEASE ────────────────────────────────────────────────────────
  const beforeLease = (await run(S.readBucket(BUCKET))).value.rev;
  const claim = await run(S.claimLease(BUCKET, SCOPE, 'holder-a', { ttlMs: 1000 }));
  check('an unheld lease is granted', claim.value && claim.value.ok === true,
    JSON.stringify(claim.value));
  check('the first holder is generation 1', claim.value.generation === 1);

  const refused = await run(S.claimLease(BUCKET, SCOPE, 'holder-b', { ttlMs: 1000 }));
  check('a live lease is refused to anybody else', refused.value.ok === false);
  check('the refusal names WHO holds it, not that somebody does',
    refused.value.holderId === 'holder-a');

  // RENEWAL IS THE SAME OPERATION AND MOVES NOTHING. A heartbeat that bumped
  // the generation would announce a takeover that never happened to every
  // page watching, once every few seconds.
  world.now += 100;
  const renewed = await run(S.renewLease(BUCKET, SCOPE, 'holder-a', { ttlMs: 1000 }));
  check('the holder renewing is granted', renewed.value.ok === true);
  check('a renewal does not move the generation', renewed.value.generation === 1);
  check('a renewal does move the expiry', renewed.value.until > claim.value.until);

  // THE HEARTBEAT MUST NOT TOUCH THE DATA. The ruling calls this the most
  // important test in the design: a lease living in the records would make
  // every heartbeat a revision bump, and every bump a stale refusal
  // somewhere else -- the mechanism generating the storm it exists to stop.
  const afterLease = await run(S.readBucket(BUCKET));
  check('claiming and renewing a lease does not bump the bucket revision',
    afterLease.value.rev === beforeLease,
    `rev moved ${beforeLease} -> ${afterLease.value.rev}`);
  check('the lease is not in the records array',
    afterLease.value.records.every(r => r && r.name !== undefined),
    JSON.stringify(afterLease.value.records));

  // EXPIRY. Nobody took it, so the page that froze comes back at the
  // generation it already had and has nothing to tell the drafter about.
  world.now += 5000;
  check('an expired lease reads as free', (await run(S.readLease(BUCKET, SCOPE))).value === null);
  const reclaim = await run(S.claimLease(BUCKET, SCOPE, 'holder-a', { ttlMs: 1000 }));
  check('the frozen page re-claims its own expired lease',
    reclaim.value.ok === true && reclaim.value.generation === 1,
    `generation ${reclaim.value.generation}`);

  world.now += 5000;
  const taken = await run(S.claimLease(BUCKET, SCOPE, 'holder-b', { ttlMs: 1000 }));
  check('a NEW holder of an expired lease bumps the generation',
    taken.value.ok === true && taken.value.generation === 2,
    `generation ${taken.value.generation}`);

  // TAKEOVER is the only thing that may seize a live lease, and only because
  // a person read a banner and pressed it.
  const seized = await run(S.claimLease(BUCKET, SCOPE, 'holder-c',
    { ttlMs: 1000, takeover: true }));
  check('a takeover seizes a LIVE lease', seized.value.ok === true);
  check('a takeover bumps the generation, which is how the loser finds out',
    seized.value.generation === 3, `generation ${seized.value.generation}`);

  // RELEASE. Only the holder may, and the record is expired rather than
  // deleted so the generation can never repeat.
  await run(S.releaseLease(BUCKET, SCOPE, 'holder-a'));
  check('a page that lost the lease cannot release the one somebody else holds',
    (await run(S.readLease(BUCKET, SCOPE))).value !== null);
  await run(S.releaseLease(BUCKET, SCOPE, 'holder-c'));
  check('the holder releasing it frees it',
    (await run(S.readLease(BUCKET, SCOPE))).value === null);
  const afterRelease = await run(S.claimLease(BUCKET, SCOPE, 'holder-d', { ttlMs: 1000 }));
  check('a released lease keeps its generation, so the next holder cannot repeat one',
    afterRelease.value.generation === 4, `generation ${afterRelease.value.generation}`);

  // ── THE LEASE GATES THE WRITE, BEFORE THE MUTATE AND BEFORE ifRev ────
  const held = { scope: SCOPE, holderId: 'holder-d', generation: afterRelease.value.generation };
  const withLease = await run(S.saveSharedFiles(
    [{ name: 'c.draft', type: 'text/plain' }], BUCKET, { lease: held }));
  check('the holder writes', withLease.value === beforeLease + 1,
    JSON.stringify(withLease));
  const heldRev = withLease.value;

  const notHeld = await run(new Promise((resolve, reject) => {
    // updateRecords is reached through writeRecords; the mutate is this one,
    // and it must never run for a page that does not hold the lease.
    S.saveSharedFiles([{ name: 'd.draft', type: 'text/plain' }], BUCKET, {
      lease: { scope: SCOPE, holderId: 'holder-e', generation: 4 },
    }).then(resolve, reject);
  }));
  check('a page that does not hold the lease is refused',
    notHeld.error && notHeld.error.name === 'LeaseError',
    notHeld.error ? notHeld.error.name : `resolved with ${notHeld.value}`);
  check('the refusal names the scope and the holder',
    notHeld.error.scope === SCOPE && notHeld.error.holderId === 'holder-d');
  const afterRefusal = await run(S.readBucket(BUCKET));
  check('a lease refusal leaves the records alone',
    afterRefusal.value.rev === heldRev && afterRefusal.value.records[0].name === 'c.draft',
    JSON.stringify(afterRefusal.value));

  // A STALE GENERATION IS NOT THE LEASE. Same holder id, older generation:
  // the lease changed hands and came back, and this page slept through it.
  const oldGen = await run(S.saveSharedFiles([{ name: 'e.draft', type: 'text/plain' }], BUCKET,
    { lease: { scope: SCOPE, holderId: 'holder-d', generation: 1 } }));
  check('the generation is checked, not just the holder id',
    oldGen.error && oldGen.error.name === 'LeaseError',
    oldGen.error ? oldGen.error.name : `resolved with ${oldGen.value}`);

  // BOTH WRONG AT ONCE: the lease answer comes first, because a page without
  // the lease sent down the merge-and-retry path cannot ever succeed.
  const both = await run(S.saveSharedFiles([{ name: 'f.draft', type: 'text/plain' }], BUCKET,
    { ifRev: 0, lease: { scope: SCOPE, holderId: 'holder-e', generation: 9 } }));
  check('a page with neither the lease nor the revision is told about the LEASE',
    both.error && both.error.name === 'LeaseError',
    both.error ? both.error.name : 'no error');

  // ── THE BROADCAST ────────────────────────────────────────────────────
  const heard = [];
  const off = S.onBucketChanged(BUCKET, change => heard.push(change));
  await run(S.saveSharedFiles([{ name: 'g.draft', type: 'text/plain' }], BUCKET, { lease: held }));
  check('the writer-s own page hears its own write', heard.length === 1,
    `heard ${heard.length}`);
  check('the message carries the revision that is now really in the store',
    heard[0] && heard[0].rev === (await run(S.readBucket(BUCKET))).value.rev,
    JSON.stringify(heard[0]));
  check('the message says who wrote, so a page can ignore itself',
    heard[0] && heard[0].writerId === S.writerId);

  // ANNOUNCED FROM oncomplete, NEVER FROM THE HANDLER THAT QUEUES THE PUTS:
  // a listener woken early reads the state from BEFORE the write and calls
  // itself current. Proved by reading the store from inside the listener.
  let seenAtDelivery = null;
  const off2 = S.onBucketChanged(BUCKET, () => {
    seenAtDelivery = world.data.get(BUCKET).map(r => r.name).join(',');
  });
  await run(S.saveSharedFiles([{ name: 'h.draft', type: 'text/plain' }], BUCKET, { lease: held }));
  check('a listener reading the bucket sees the write it was told about',
    seenAtDelivery === 'h.draft', `it saw ${seenAtDelivery}`);
  off2();

  const before = heard.length;
  await run(S.saveSharedFiles([{ name: 'i.draft', type: 'text/plain' }], BUCKET, { ifRev: 0 }));
  check('a refused write announces nothing', heard.length === before,
    `${heard.length - before} messages for a write that never landed`);

  // ONE LISTENER THAT THROWS MUST NOT SILENCE THE NEXT.
  const after = [];
  const offBad = S.onBucketChanged(BUCKET, () => { throw new Error('listener blew up'); });
  const offGood = S.onBucketChanged(BUCKET, c => after.push(c));
  await run(S.saveSharedFiles([{ name: 'j.draft', type: 'text/plain' }], BUCKET, { lease: held }));
  check('a listener that throws does not stop the one after it', after.length === 1,
    `the surviving listener heard ${after.length}`);
  offBad(); offGood();

  off();
  const quiet = heard.length;
  await run(S.saveSharedFiles([{ name: 'k.draft', type: 'text/plain' }], BUCKET, { lease: held }));
  check('unsubscribing stops the messages', heard.length === quiet);

  // ── A BLOCKED OPEN IS NOT A HANG ─────────────────────────────────────
  //
  // onblocked fires when neither onsuccess nor onerror will: a pending
  // deleteDatabase, or another connection on the old version. Left unhandled
  // the promise never settles, it stays cached, and EVERY later call on that
  // page awaits the same dead promise. The page is finished, silently.
  const blocked = loadStore();
  blocked.world.blockOpens = true;
  const hung = await blocked.run(blocked.S.readBucket(BUCKET));
  check('an open that arrives BLOCKED settles rather than hanging forever',
    !hung.hung, 'the promise never settled -- this is the permanent page hang');
  check('and it says what is holding the database',
    hung.error && /blocked/i.test(hung.error.message),
    hung.error ? hung.error.message : 'resolved');
  blocked.world.blockOpens = false;
  const recovered = await blocked.run(blocked.S.readBucket(BUCKET));
  check('the next call opens a fresh connection and works',
    recovered.value && recovered.value.rev === 0,
    JSON.stringify(recovered.value || recovered.error && recovered.error.message));

  // ── THE HOLDER ID SURVIVES F5 ────────────────────────────────────────
  const tab = loadStore();
  const id1 = tab.S.leaseHolderId();
  check('the holder id is kept where a reload can find it',
    tab.world.session.get('draft-lease-holder') === id1);
  const reloaded = loadStore();
  reloaded.world.session = tab.world.session;
  check('a reloaded tab presents the same holder id, so it is not locked out of its own drawing',
    reloaded.S.leaseHolderId() === id1,
    `${reloaded.S.leaseHolderId()} vs ${id1}`);
  const blockedData = loadStore();
  blockedData.world.sessionThrows = true;
  check('a private window, where session storage throws, still gets an id',
    typeof blockedData.S.leaseHolderId() === 'string'
      && blockedData.S.leaseHolderId().length > 0);

  // ── THE NAMED-RECORD HELPERS ─────────────────────────────────────────
  const named = loadStore();
  await named.run(named.S.saveNamedFile({ name: 'scan-1.png', type: 'image/png' }, 'underlay'));
  await named.run(named.S.saveNamedFile({ name: 'scan-2.png', type: 'image/png' }, 'underlay'));
  await named.run(named.S.saveNamedFile({ name: 'scan-1.png', type: 'image/png' }, 'underlay'));
  const all = await named.run(named.S.readBucket('underlay'));
  check('a named file replaces its own name and keeps the others',
    all.value.records.length === 2, JSON.stringify(all.value.records.map(r => r.name)));
  await named.run(named.S.removeNamedFile('scan-1.png', 'underlay'));
  const left = await named.run(named.S.readBucket('underlay'));
  check('removing one named file leaves the rest',
    left.value.records.length === 1 && left.value.records[0].name === 'scan-2.png');
}

async function main() {
  if (!MUTATE) {
    await runChecks();
    failures.forEach(f => console.log(`  FAIL  ${f}`));
    console.log(failures.length
      ? `shared-file-store-harness: ${failures.length} FAILED of ${passed + failures.length}`
      : `shared-file-store-harness: ${passed} checks pass`);
    process.exit(failures.length ? 1 : 0);
  }

  // ── MUTATIONS ─────────────────────────────────────────────────────────
  const MUTATIONS = [
    ['the revision is bumped in its own transaction, after the records',
      'shared-file-store.js', c => c.replace('      store.put(nextRev, revKey(bucket));', '')],

    ['ifRev is read but never enforced', 'shared-file-store.js',
      c => c.replace('if (ifRev !== null && rev !== ifRev) {', 'if (false) {')],

    ['the stale refusal forgets which revision was found', 'shared-file-store.js',
      c => c.replace('this.actualRev = actual;', 'this.actualRev = expected;')],

    ['a live lease is granted to whoever asks', 'shared-file-store.js',
      c => c.replace('if (held && held.holderId !== holderId && !takeover) {', 'if (false) {')],

    ['a takeover is not needed to seize a live lease', 'shared-file-store.js',
      c => c.replace('if (held && held.holderId !== holderId && !takeover) {',
        'if (held && held.holderId !== holderId && takeover) {')],

    ['an expired lease still refuses the next page', 'shared-file-store.js',
      c => c.replace('const held = liveLease(current, now);', 'const held = current;')],

    ['every renewal bumps the generation', 'shared-file-store.js',
      c => c.replace('const mine = current && current.holderId === holderId;',
        'const mine = false;')],

    ['a new holder inherits the generation instead of moving it',
      'shared-file-store.js', c => c.replace(
        ': (Number(current && current.generation) || 0) + 1;',
        ': (Number(current && current.generation) || 0);')],

    ['the lease is stored in the records, where a heartbeat is a revision bump',
      'shared-file-store.js', c => c.replace(
        'const leaseKey = (bucket, scope) => `${bucket}::lease:${scope}`;',
        'const leaseKey = bucket => bucket;')],

    ['a lease that expired is deleted, so generations start again at 1',
      'shared-file-store.js', c => c.replace(
        'tx.objectStore(STORE).put({ ...current, until: 0 }, key);',
        'tx.objectStore(STORE).put({ holderId: null, until: 0, generation: 0 }, key);')],

    ['any page may release the lease', 'shared-file-store.js',
      c => c.replace("if (!current || current.holderId !== holderId) return;", '')],

    ['readLease reports an expired lease as held', 'shared-file-store.js',
      c => c.replace('const held = liveLease(req.result, Date.now());',
        'const held = req.result;')],

    ['the write checks only the holder id, not the generation',
      'shared-file-store.js', c => c.replace(
        '        const ours = held && held.holderId === lease.holderId\n          && Number(held.generation) === Number(lease.generation);',
        '        const ours = held && held.holderId === lease.holderId;')],

    ['the revision is checked before the lease', 'shared-file-store.js',
      c => c.replace('      if (lease) {', '      if (ifRev !== null && rev !== ifRev) {\n        failure = new StaleWriteError(bucket, ifRev, rev);\n        tx.abort();\n        return;\n      }\n      if (lease) {')],

    // Announced from the handler instead of from oncomplete: the handler runs
    // BEFORE the checks have had their say, so a write that is about to be
    // refused tells every page it landed.
    ['the change is announced when the write is attempted, not when it lands',
      'shared-file-store.js', c => c.replace(
        '    tx.oncomplete = () => {\n      if (failure) { reject(failure); return; }\n      announce(bucket, nextRev);',
        '    tx.oncomplete = () => {\n      if (failure) { reject(failure); return; }')
        .replace('      const rev = Number(revReq.result) || 0;',
          '      const rev = Number(revReq.result) || 0;\n      announce(bucket, rev + 1);')],

    ['the writer-s own page is never told about its own writes',
      'shared-file-store.js', c => c.replace('  setTimeout(() => deliver(change), 0);', '')],

    ['the message does not say who wrote it', 'shared-file-store.js',
      c => c.replace('const change = { bucket, rev, writerId };', 'const change = { bucket, rev };')],

    ['one listener throwing stops the rest hearing', 'shared-file-store.js',
      c => c.replace("    try { listener(change); } catch (error) {", '    if (true) { listener(change); } else {')],

    ['unsubscribing does not unsubscribe', 'shared-file-store.js',
      c => c.replace('    listeners.delete(listener);', '')],

    ['a blocked open is left to hang', 'shared-file-store.js',
      c => c.replace(/    req\.onblocked = \(\) => \{[\s\S]*?\n    \};\n/, '')],

    ['the holder id is not kept for the reload', 'shared-file-store.js',
      c => c.replace("  try { sessionStorage.setItem(LEASE_HOLDER_KEY, leaseHolder); } catch (error) { /* as above */ }", '')],

    ['a named file is appended rather than replacing its own name',
      'shared-file-store.js', c => c.replace(
        '    [...records.filter((r) => r.name !== file.name), asRecord(file)]);',
        '    [...records, asRecord(file)]);')],
  ];

  let caught = 0;
  for (const [name, file, fn] of MUTATIONS) {
    const before = fs.readFileSync(path.join(ROOT, file), 'utf8');
    if (fn(before) === before) {
      console.log(`  ANCHOR MISSED  ${name}  (the edit changed nothing in ${file} -- re-aim it)`);
      continue;
    }
    EDIT = { file, fn };
    let red = false;
    try { await runChecks(); red = failures.length > 0; }
    catch (err) { red = true; }
    EDIT = null;
    if (red) caught += 1;
    else console.log(`  SURVIVED  ${name}`);
  }
  console.log(`shared-file-store-harness: ${caught}/${MUTATIONS.length} mutations caught`);
  process.exit(caught === MUTATIONS.length ? 0 : 1);
}

main();
