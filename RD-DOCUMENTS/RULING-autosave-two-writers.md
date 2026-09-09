# RULING — autosave, and two pages writing one file

Ruled by Kevin, 8 Sep, on the order that asked whether `MODEL.html` should
autosave. Written into the repository 9 Sep, which is late: **rung 1 shipped
before this file existed** (`8992ad9`, 8 Sep), so for a day the repo held a
fix whose reasoning could only be read in a commit message and whose remaining
rungs could not be read at all. That is the failure this file ends, and it is
the reason tier 3d's first job is a document rather than code
(`SPEC-model-html-tiers.md`).

Where the ruling has been overtaken by measurement since 8 Sep, the original
stands with the correction beside it and dated — this is a ruling with a
history, not a clean sheet.

Measured against the pages as they were on 8 Sep. Line numbers here are
re-checked against the tree at the time of writing; if they have drifted,
trust the names.

---

## 0. What was found before anything was ruled

Three writers, three different disciplines:

| Page | When it writes | What it sends | On a stale refusal |
| --- | --- | --- | --- |
| `MODEL.dc.html` | every mutation (`_markUnsaved`, :6417) | its whole in-memory copy | re-reads, retries ×3 (`_writeDrawingToStore`, :6376) |
| `MODEL.html` | on a SAVE press (:1894) | its whole loaded-and-normalised copy | refuses, tells the drafter to reload (:1916) |
| `LAYOUT.dc.html` | on a sheet edit | re-reads first, then `{...base, layout}` (:995-1007) | re-reads and retries |

LAYOUT is the safe one, for a reason worth naming: **it holds no revision
across the session.** It reads immediately before it writes, merges its one
key onto whatever is really there, and its `ifRev` comes from a read a
millisecond earlier. Its window is microseconds wide and its key is
exclusively its own. That is why the old page's merge rule survived so long:
*the only other writer it had ever met owned one key.*

`MODEL.html` is not that. It owns `walls`, `outlines`, `stairs` — the same
keys. And the old page's merge rule, stated as code, was "everything except
`layout` and `specs` is mine, and mine is the current one".

The failing sequence needed no new feature and no race:

1. Old page loads at rev 7 and keeps that revision for the session.
2. Drafter switches to `MODEL.html`, moves a corner, presses SAVE. Clean write
   at `ifRev: 7`. Store is rev 8 and holds the moved corner.
3. Back in the still-open old tab, the drafter nudges anything at all — a
   layer toggle, another wall, an undo. All of it funnels through
   `_markUnsaved`.
4. The write goes at `ifRev: 7`, is correctly refused, and the merge path then
   keeps its own stale walls and writes again at rev 8.
5. `SAVED`. The moved corner is gone. No error, no banner.

That is PR #178's rule — *the store must not eat work* — failing on the merge
path built to honour it, and it is audit C3 in the mirror: C3 is a write with
no `ifRev` eating work; this was a write **with** `ifRev` eating work, because
the retry re-asserted stale data over the refusal. **The revision caught the
collision and the merge threw the catch away.**

A second, milder one running the other way: `MODEL.html`'s `storeRev` is set
at load and advanced only by its own successful save. Nothing refreshes it. So
one sheet edit in LAYOUT — an entirely legitimate write to a key `MODEL.html`
does not touch — refuses every save from the modern page until it is reloaded,
and reloading is what costs the drafter the corner they have not saved. On the
iPad, where all three pages sit in tabs, that is not an edge case.

---

## 1. Should `MODEL.html` autosave?

**Not yet, and not for the reason the button suggests.**

**Autosave per mutation, like the old page.** Its virtue there is real:
`_markUnsaved` means there is never a closed tab with work in it, which is why
the old page never needed a `beforeunload` guard and `MODEL.html` did. But
autosave on this page *today* would not create the clobber above — it would
industrialise it. Every drag becomes a rev bump, every bump a refusal in the
old page, every refusal a merge. Faster autosave, faster loss.

**Explicit SAVE, as today.** Its real virtue is not conflict avoidance — it is
that **there is no undo across reload.** The old page's history is in-memory;
nothing in `drawing-format.js` persists it. The store holds exactly one
recoverable state, and a deliberate press is the only thing that decides which
state that is. A drafter who autosaves a mistake and closes the tab has no way
back. The press is a commit point, and this product has nothing else that is
one.

**Debounce / idle.** Inherits the worst of both: still a write the drafter did
not ask for, still no undo behind it, and it removes the commit point without
removing the conflict. Rejected as the primary mechanism.

**On-hide is not debounce**, and it was the honest gap: `beforeunload` is the
one piece of the page whose own comment admits it is unproven — the suite runs
one engine, `returnValue` is untested by construction, and the drafter is
"often on an iPad, often closes tabs without ceremony."

> **CORRECTED 9 SEP BY MEASUREMENT.** The hide-save was ruled here as the fix
> for that gap. A probe run in desktop Chrome (see `TTL-MEASUREMENT-MEMO`,
> returned with the probe) found that **a `pagehide` IndexedDB write did not
> land on a tab reload**, with no memory pressure at all; it landed on tab
> close. So a hide-time write is a best-effort extra, **not** a mechanism
> anything may depend on — and specifically, a lease release on hide cannot be
> the thing that keeps the file safe. Rung 4 keeps its place, with that
> demotion written into it. The press remains the only commit.

**RULING: `MODEL.html` keeps the explicit SAVE press as its only commit point,
and gains a best-effort save on `pagehide`/`visibilitychange`-hidden that
writes only when it can write cleanly and otherwise leaves the page visibly
unsaved; timed or per-edit autosave does not land until `MODEL.html` is the
sole model writer.**

Tests that would catch its absence: a hidden tab's moved corner is in the
store when the next page reads it (mutation: delete both listeners — fails); a
drag with no press and no hide writes nothing (mutation: fire the hide-save on
a timer — fails); a hidden tab without the lease does not write and stays
UNSAVED.

---

## 2. Two pages, one file

**Last-writer-wins with reload prompts (the de facto behaviour before rung 1).**
It was not last-writer-wins; it was *stale-writer-wins*, which is strictly
worse. Rejected as an end state — and fixing it was worth more than everything
else in this document, which is why it went first.

**Object-level merge. Wrong**, and precisely why matters, because "merge the
walls" sounds reasonable and the store already merges:

- *Nothing stable to merge on.* JSON cannot say "these two walls end at the
  same point", only "at points that happen to be equal"; the corner pool is
  rebuilt from coordinates on every load. A merger would have to re-identify
  every corner across two independent re-poolings.
- *The keys are not independent.* `srcId`/`offX`/`offZ` link a wall corner to
  a BONEYARD master point; auto-dimension ends carry `srcId`; room claims
  reference walls; `body` must never splice across a boundary. **A merged
  drawing can be a drawing no page could ever have written, and
  `drawing-format.js` would not reject it**, because every collection
  validates fine on its own.
- *The actual case has no answer.* Two tabs moved the same corner to two
  places. No rule picks one. A merge that picks silently is the eat again with
  more machinery.

**Broadcast / live-reload.** Keep it — but it is the conflict *preventer*, not
the resolver, and it is the cheapest thing here. The drafter is rarely editing
in two pages at once; they are editing in one with the other sitting open from
ten minutes ago. A clean page that hears "the bucket moved to rev 9" and
re-reads is never stale, so it never has anything to eat with. It also retires
section 0's second bug. It cannot be the whole answer: a **dirty** page must
not live-reload, or it discards the drafter's work to avoid discarding
someone else's.

**Edit lease. This is the ruling.** A single-writer claim on the model keys,
one page at a time, everyone else read-only with a banner and a TAKE OVER
press.

- It matches what the drafter already believes — nobody expects two drafting
  windows on one file to both be live.
- It is the only option that protects work *before* it is written. `ifRev`
  catches a collision when it is already too late to do anything good; a lease
  means the collision does not happen.
- It is small: a claim, a heartbeat, an expiry, a banner, a gate in front of
  two write paths.

Failure modes, named, because a lease that is not honest about them is a
lock-up waiting to happen:

- *The holder dies.* Tab closed without ceremony, page discarded. The lease
  must expire on a TTL with a heartbeat, or the drawing is bricked.
  Non-negotiable.
- *The holder is frozen, not dead.* Timers stop, the lease expires, and the
  drafter returns to the tab they were working in to find it read-only
  underneath them with dirty edits in it. **The sharpest edge in the design.**
  Survivable only if a page that loses its lease while dirty (a) never
  discards its edits, (b) says so plainly, and (c) can ask for the lease back.
- *TAKE OVER with two dirty pages.* The loser is refused, not eaten: its copy
  stays in memory, dirty, with a banner, and its route out is to reload
  (losing its edits knowingly) or take the lease back and save (losing the
  other's, knowingly). Someone loses work here; the ruling is only that they
  must **choose** to.
- *The lease bumps the revision.* If it lives in the bucket's records, every
  heartbeat is a rev bump and every bump a stale refusal elsewhere — the
  design would generate the exact storm it exists to prevent. Hence its own
  key, pinned by a test.
- *LAYOUT blocked out of its own page.* The lease is **scoped to the model
  keys**. LAYOUT keeps its present discipline, needs no lease, and must not be
  asked for one.
- *LAYOUT still bumps the rev under a dirty `MODEL.html`.* Legitimately. So
  `MODEL.html` adopts rung 1's narrowed merge: retry only when the difference
  is confined to `layout`/`specs`; otherwise refuse and say so.

> **REINFORCED 9 SEP BY MEASUREMENT.** The probe watched ~250 heartbeats and
> the data revision stayed at 0 throughout — the own-key property this design
> rests on, now observed rather than assumed.

**RULING: a named edit lease on the model keys is the resolver — one writer at
a time, others read-only with a banner and an explicit TAKE OVER — backed by a
change broadcast that live-reloads only clean pages; object-level merge is
rejected outright, and stale-writer-wins is a defect to be removed, not a
policy.**

---

## 3. What the store must grow

Everything below is additive. No existing signature changes, no existing
caller must adopt anything, and `if (!window.SharedFileStore)` stays a valid
guard. Semantics, not code.

### 3.1 The lease

```
claimLease(bucket, scope, holderId, { ttlMs }) -> { ok, holderId, until, generation }
renewLease(bucket, scope, holderId, { ttlMs }) -> { ok, until, generation }
releaseLease(bucket, scope, holderId)          -> void
readLease (bucket, scope)                      -> { holderId, until, generation } | null
```

- **Stored under its own key, `${bucket}::lease:${scope}` — never in the
  records array, never touching `${bucket}::rev`** (`shared-file-store.js:75`).
  The load-bearing detail of the whole design.
- `scope` is a string; MODEL uses `model`, LAYOUT uses none. It exists so
  "the model keys" is a thing the store can name.
- `claimLease` grants if unheld, expired (`until <= now`), or already this
  holder — which makes claim and renew the same operation and removes a race.
  Otherwise it refuses, returning the current holder so the caller can say
  *who* has it. Grant and refusal happen in one transaction, the same
  read-modify-write discipline `addSharedFile` already uses.
- `generation` increments on every **change of holder**, never on renewal. A
  page compares the generation it was granted against the store's: if it
  differs, it was taken over, even if it has since been given back.
- `until` is `Date.now() + ttlMs`, written by the claimant. One origin, one
  device, one clock — skew is not a hazard here and needs no machinery.

### 3.2 The write gate

```
saveSharedFile(file, bucket, { ifRev, lease: { scope, holderId, generation } })
```

- With `lease` present, the write is refused — `LeaseError`, `error.lease =
  true`, carrying the current holder — unless that holder still holds that
  scope at that generation. Checked in the same transaction as `ifRev`, before
  the mutate.
- **`ifRev` still applies and is still required.** The lease prevents the
  collision; `ifRev` catches the case where prevention failed. A page that
  drops `ifRev` because it holds a lease has reintroduced audit C3.
- Omitting `lease` is exactly today's behaviour, so LAYOUT and any
  unconverted page keep working.

### 3.3 The broadcast

```
onBucketChanged(bucket, listener) -> unsubscribe
   listener({ bucket, rev, writerId })
```

- Posted **after** the transaction commits — from `oncomplete`, not from the
  `onsuccess` that queued the puts — so a listener that reads on the message
  finds the committed state.
- `writerId` is a per-page-instance id so a page can ignore its own writes.
  That is the whole of "who wrote last"; there is no per-key author map,
  because a per-key author map is object-level merge wearing a hat.
- `BroadcastChannel` keyed on the database name, no fallback: a browser
  without it does not live-reload, which degrades to today.

### 3.4 What the store must NOT grow

No history, no per-key ownership table, no merge helper, no server. A store
that knows how to merge drawings is the old page's mistake at a new address.

Tests, each with its mutation:

- *a claim and ten renewals do not change the bucket's revision.* **Mutation:
  store the lease as a record in the bucket. Fails.** The single most
  important test in the design.
- *a write with a lease held by someone else is refused and the bucket is
  unchanged.* Mutation: check the lease after the mutate — fails on contents.
- *an expired lease is claimable and the old holder's generation is dead* —
  the first holder's write is refused even though its `ifRev` is current.
  Mutation: never expire; mutation: reuse the generation on takeover.
- *the broadcast fires after commit, carries the new rev, and a page ignores
  its own.* Mutation: post before the put — fails.

**RULING: the store grows a named, own-keyed lease with TTL, heartbeat and
takeover generation, an optional `lease` guard on the write beside the
existing `ifRev`, and a post-commit change broadcast carrying rev and writer —
and nothing else.**

---

## 4. The rungs

Ordered by what stops losing work soonest, not by what completes the design
soonest.

**Rung 1 — turn the eat into a refusal. LANDED, `8992ad9`, 8 Sep.**
One condition on the old page's existing merge branch: if the difference
against the copy this page last wrote or loaded is confined to `layout`/`specs`,
merge and retry as before; if any model key differs, write nothing, stay
dirty, and tell the drafter. No store change, no lease, no new concepts.

Two things the implementation decided that this ruling did not, both right and
both worth keeping in front of whoever writes the next rung:

- **The comparison is of the persisted forms with `layout`/`specs` stripped
  and keys sorted.** Nothing in the format fixes key order, and the cost of
  being wrong is asymmetric: a false conflict means the drafter cannot save at
  all, which is worse than the bug being fixed. The spec proves it — the
  LAYOUT writer reorders every key while changing only `layout`.
- **The baseline is read from the written file, not re-serialised from state**
  (`_storeBaseline`, `MODEL.dc.html:6136`), and that choice is labelled in the
  code as untestable rather than left looking checked.

**Rung 2 — the broadcast, both pages.** `onBucketChanged`; a clean page
re-reads and repaints, a dirty page does not (it may show a quiet "changed
elsewhere" note). This is also what lets a clean `MODEL.html` refresh its
`storeRev`, retiring section 0's second bug.
Test: *a clean second page picks up the first page's write without a reload; a
dirty second page does not and keeps its edit.* Mutation: reload regardless of
dirty — the second half fails, and that mutation is itself a work-eating bug,
which is the right thing for a test to stand in front of.

**Rung 3 — the lease.** Store additions from section 3; both model pages claim
on load, heartbeat while alive, release on hide; the loser goes read-only with
a banner naming the holder and a TAKE OVER press. **The lease is theatre
unless the old page respects it**, so the two conversions land together or not
at all — a slice converting only `MODEL.html` should not be merged.

> **AMENDED 9 SEP BY MEASUREMENT.** Rung 3 must ship with a **resume path**:
> an expired lease re-claimed by the *same generation* is granted silently,
> and only a changed generation shows the takeover banner. The probe produced
> a 22.6-second freeze (SIGSTOP on the renderer, since desktop Chrome never
> froze a backgrounded tab on its own — 82s hidden, ticking throughout): lease
> dead 7.6s, generation unchanged, silent re-claim, no banner, which is the
> behaviour a drafter must get. And because the `pagehide` write is
> unreliable, **release-on-hide is best-effort and the TTL is the real
> backstop** — the design may not lean on the release.
> This also settles the sequencing question the memo was written to answer:
> the resume path is correct under every measurement outcome, so **rung 3 does
> not wait on the iPad numbers.** The constant is tuned afterwards.

Tests: second page opens read-only; the old page's autosave cannot land while
the modern page holds the lease (mutation: drop the gate in `_markUnsaved` —
fails, and this is the test that would have caught section 0 in the first
place); an abandoned lease expires and the survivor takes over; a taken-over
dirty page is refused, not eaten; **a frozen-then-resumed holder re-claims
without a banner** (mutation: bump the generation on any re-claim — fails).

**Rung 4 — hide-save, after rung 3.** It depends on the lease for its "write
only if clean to do so" condition. Best-effort by measurement (section 1's
correction): it closes the tab-closed hole, it does not replace the press, and
no other rung may assume it ran.

**Rung 5 — autosave, and only when `MODEL.html` is the sole model writer.**
When the old page no longer writes, the lease has one holder by construction,
the refusal storm has no second party, and debounce-on-idle becomes a plain
question about undo rather than about concurrency. Revisit then, with the
persisted-history question answered first.

**Never:** object-level merge; a per-key author map; a sync server; a page
that writes to model keys without both `ifRev` and the lease.

**RULING: narrow the old page's merge to a refusal first, broadcast second,
lease third with both model pages converted in the same slice and a resume
path in it, hide-save fourth, and autosave only once `MODEL.html` is the last
writer standing.**

---

## What this ruling did not decide

- **The TTL and heartbeat numbers.** 15s / 5s is the shape to start from, but
  the iPad decides it. Unmeasured as of 9 Sep: desktop Chrome never froze a
  background tab, so the interesting end of the range is still unrun. It does
  not block rung 3 (see the amendment above).
- **Whether a lease survives its holder's reload.** A holder id in
  `sessionStorage` would carry it across F5 and avoid a self-lockout during
  the TTL. Probably right; not proven free of a worse case (a restored id
  claiming a lease the drafter meant to give up).
- **Persisted undo history.** Section 1's case for the press rests on there
  being exactly one recoverable state; persisting the history would change the
  autosave question completely, and it is a format change under
  `RULES-persisted-keys`. It belongs to rung 5.
- **The SPECS page.** `specs` is passed through by everyone here. If it writes
  like LAYOUT (one key, read immediately before write) it needs nothing; if it
  holds a session-long revision like the old page, it has section 0's bug too.
  Unmeasured, so unruled.
- **Banner and takeover wording**, and whether a read-only page hides SAVE or
  disables it. Someone who watches drafters should pick it.
- **Multiple devices.** IndexedDB is per-origin per-device and there is no
  backend; two iPads are two drawings. Out of scope by the no-server rule,
  said out loud so nobody reads the lease as solving it.
- **What a read-only page should do with a drafter who edits anyway.** Refuse
  the gesture, or let them edit locally and offer the takeover at save time?
  The second is friendlier and much larger.
