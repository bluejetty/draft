// LEVEL LOCK — the second tier of grouping (board #315).
//
//   items      -> an ASSEMBLY  (one floor, rigid: `groups`)
//   assemblies -> a LEVEL LOCK (across floors: this)
//
// A lock joins assemblies that must hold the same PLAN position on different
// storeys. Per-floor properties -- heights, which storey a wall stands on --
// stay per-floor: a lock says "the same place on the plan", not "the same
// storey", which is the whole point of it spanning them.
//
// Its first customer is the dealt washroom, whose 2x6 wet wall carries every
// supply in the room: stack that wall floor to floor and the drain runs
// straight down. Nothing here knows what a washroom is, which is what the
// order meant by building it general.
//
// ── WHY THIS IS A MODULE AND NOT PAGE CODE ───────────────────────────────
// MODEL.dc.html exposes no handle to its component, so a rule living there
// can only be reached through a gesture -- and the gesture that moves a
// rigid assembly does not exist yet (MODEL.dc.html:10514 refuses the node
// drag for a fixed group). Rules in here are reachable from node and pinned
// by proto/level-lock-harness.js; the page keeps only the part that owns the
// real point objects.
if (!window.DraftLevelLock) {
(() => {
  // The lock a group belongs to, or null. A group belongs to at most one:
  // two locks over the same assembly would each claim its delta and the
  // second would double the first.
  const lockFor = (locks, groupId) =>
    (locks || []).find(lock => (lock?.members || []).includes(groupId)) || null;

  // The OTHER members. The mover owns its own move -- the caller has already
  // applied it -- so including it here would move it twice, which reads on
  // screen as an assembly sliding at double speed.
  const siblingIds = (locks, groupId) => {
    const lock = lockFor(locks, groupId);
    return lock ? lock.members.filter(id => id !== groupId) : [];
  };

  // A LOCK OF ONE IS NOT A LOCK. Two members are the fewest that can
  // disagree, so a shorter one can never do anything -- and a lock that can
  // never do anything reads, in the file and on screen, exactly like a lock
  // that works. Refused at creation as well as on load, so a caller cannot
  // make what a reload would drop.
  const makeLock = (id, name, groupIds) => {
    const members = [...new Set((groupIds || []).filter(Boolean))];
    if (!id || members.length < 2) return null;
    return { id: String(id), name: String(name || 'LEVEL LOCK').toUpperCase(), members };
  };

  // BREAKING IS AN EXPLICIT ACT. A drag never breaks a lock and neither does
  // distance -- the same principle as storey detachment in the BONE model.
  // If the drafter has not said so, the lock holds however far apart the
  // assemblies end up.
  //
  // It REMOVES rather than marks: a broken lock and no lock behave
  // identically, and one of them is a state to carry, migrate and get wrong.
  const breakLock = (locks, lockId) => (locks || []).filter(lock => lock?.id !== lockId);

  // EVERY POINT ONCE, and this is the one that bites. A corner shared by two
  // walls of the same assembly is ONE object in the vertex pool, so walking
  // items and moving their points would move that corner twice and tear the
  // assembly apart at its own corners. A Set is identity-based, which is
  // exactly the instrument the problem asks for.
  const uniquePoints = (items) => {
    const points = new Set();
    (items || []).forEach(item => {
      if (!item) return;
      (item.points || [item.start, item.end]).filter(Boolean).forEach(p => points.add(p));
      if (item.point) points.add(item.point);
    });
    return [...points];
  };

  // Plan only: x and z. y is the storey and a lock never touches it.
  const translate = (points, dx, dz) => {
    (points || []).forEach(point => { point.x += dx; point.z += dz; });
    return (points || []).length;
  };

  window.DraftLevelLock = Object.freeze({
    lockFor, siblingIds, makeLock, breakLock, uniquePoints, translate,
  });
})();
}
