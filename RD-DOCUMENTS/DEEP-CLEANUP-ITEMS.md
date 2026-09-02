# DEEP-CLEANUP ITEMS

Things deliberately left for a deep clean rather than done in passing. Started
2 Sep 2026, from a light tidy that kept turning up heavier work.

Each item says what, why it was left, and what it risks. **Nothing here is
urgent** — that is the point of the list. It exists so the work is remembered
instead of rediscovered, and so whoever does it starts with the traps already
mapped.

Two health readings taken while writing this, worth knowing before anyone
starts "improving" things:

- **Zero `TODO`, `FIXME` or `HACK` comments in the entire codebase.** Not one.
  This project writes down its reasoning and finishes its thoughts; it does not
  leave markers for later. Do not be the first.
- **784 tests over 140 files, green.** Any cleanup that cannot stay green is
  not a cleanup.

---

## Cheap and safe — do these first

### 1. Delete merged remote branches

**118 branches** on the remote are already merged into `main` and were never
deleted. They make `git branch -r` unreadable and hide the handful that are
actually live.

Safe by definition: a merged branch's commits are in `main`. Keep any branch
that is *not* merged, obviously, and check before each delete rather than
scripting it blind.

### 2. `SPEC-*.md` → `RULES-*.md`

`SPEC-electric-plan.md` and `SPEC-toy-mode-constraints.md` describe how the
*program* should behave. `SPECIFICATIONS/` is the written half of a *drawing
set*. They share a word and no meaning, and a tidy-by-filename merges them.

Nothing in the product is called a rule, so the word is free. See
`DEFINITIONS.md`.

**Risk:** links. Verify every one afterwards — the README move on 2 Sep broke
two links precisely because the check looked for code loading a document and
not for markdown pointing at one.

### 3. The prose renames

- **"a wall's bone"** (TOY MODE) → **weld group**. Already the real name.
- **"the toilet's node"** → **object placement**. Movie's ruling; nodes are
  for lines.
- **"frame"** on its own → **wireframe**, qualified: MASTER WIREFRAME, MAIN
  FLOOR WIREFRAME.

Comments and documents only. No behaviour, no risk.

### 4. `paper-rules.md` does not exist

Cited in three places as though it does:

```
MODEL.dc.html:1685
MODEL.dc.html:22214
tests/rail-order.spec.js:6
```

Either write the document or drop the citation. **Movie's call** — a comment
pointing at a missing file is worse than none, because someone will go looking.

---

## Worth real time

### 5. Shard the CI suite

The suite is **54 minutes**, serial by design (`workers: 1`,
`fullyParallel: false`, because every spec shares one origin and one drawing
store). It killed two runs on 2 Sep by exceeding a 55-minute job timeout; the
timeout is now 90, which is headroom and not a fix.

`--shard=i/N` is the right shape: each shard gets its own runner and therefore
its own origin, which is exactly what `workers: 1` protects. **Four shards,
roughly fourteen minutes each.** Nothing about the serial constraint has to
change.

Best value on this list — it makes every later job cheaper, and it touches one
file (`.github/workflows/test.yml`) so it cannot conflict with feature work.

### 6. A spec that pins the saved format's key names

Twenty spec files read `saved.boneyardOutlines` and would fail if the
persisted key were renamed — but they guard it **by accident**, testing
garages and build links and happening to name it. The guard disappears the day
someone rewrites `garage.spec.js`.

One short spec asserting the format's key names *on purpose*, with a header
saying why, turns an accident into a guarantee. Cheap, and it protects item 7.

### 7. `_boneyardOutlines` → `_masterWireframe`

**In memory only.** `boneyardOutlines` and `boneyardShelves` are persisted
keys (`drawing-format.js:561` and `:979`, serialized at `MODEL.dc.html:3025`).
Renaming those breaks every drawing ever saved, against the standing rule that
old drawings open forever.

The rename stops at the serializer, with a comment at the seam saying the two
names differ deliberately.

Do it while already in that code for another reason. On its own it is a large
diff that changes no behaviour — poor value, and poor timing right before
somebody starts reading the file.

### 8. Drop the `.dc.` from the page filenames

Movie's, and the reason is plain: `MODEL.dc.html` is an odd thing to type and
an odd thing to explain. Four files carry it — `MODEL`, `LAYOUT`, `Notepad`,
`SaveBox`.

Measured before writing this down:

```
4    files named *.dc.html
53   files reference those names
93   occurrences across .js, .html, .dc.html and .md
```

**The framework does not need the extension.** `data-dc-tpl`,
`data-dc-script`, `data-dc-canvas` and `DCLogic` are attribute and class
names, unrelated to what the file is called; they stay exactly as they are.
Nothing in the loader keys off `.dc.html` — the only references in `.js` are
in comments.

**The real cost is that these are live public URLs.** `MODEL.dc.html` is the
app. Renaming it breaks every bookmark, every link anyone has shared, and
anything pointing at it from outside this repository — and GitHub Pages will
serve a 404 rather than anything helpful.

Doable, and the shape is known:

1. Rename the four files, `git mv`, so history follows.
2. Repoint all 93 occurrences, including the entry page's own links and every
   `page.goto` in the suite.
3. **Leave a stub at each old name** — a one-line HTML redirect to the new
   one. Old bookmarks keep working, and the stubs can be deleted in a year
   once nothing asks for them.
4. Full suite green before merge; the suite navigates to these pages
   constantly, so it will find anything missed.

Not hard, but not a five-minute job either, and step 3 is the part that stops
it hurting someone.

---

## Judgement calls — not obviously worth doing

### 9. `framing` already means two things

Structural framing (`MODEL.dc.html:8666`, *"Structure lives with the framing —
FLOOR or FOUNDATION"*) and UI panes (`:9981`, `:10124`, *"locked framing"* in
the STAIR workspace). Mildly muddy. Renaming the UI sense would be clearer;
whether it is worth the diff is a judgement.

### 10. The 26 MB of PDFs

`BUILDING-CODES/` is 26 MB of the repository's 29. **Deleting them does not
shrink the repo** — git keeps the blobs, so every clone still pays. Only a
history rewrite recovers it, which means force-pushing over shared branches
and is ruled out by `BRANCHING.md` for good reasons.

Recommended: **leave them.** 29 MB is not a large repository, and this is the
one deletion where "I will remove it later" does not give what you expect.

### 11. `REFACTOR-PLAN.md` steps 5 and 6

Read the plan before proposing further extraction from `MODEL.dc.html`. Steps
1–4 are **done**. Step 5 (the vertex pool) is marked *"late, if ever"*; step 6
(tool state machines and keyboard) is marked **deliberately not** — *"these
are the component"*.

The plan's own rule also applies to timing: *"an extraction must not land under
an in-flight feature that touches the same region."* TOY MODE is that feature.

### 12. Six "coming soon" promises in the UI

Six places tell the user something is coming. At least one stopped being true
when the turtle landed. Worth an audit: each should either still be true or be
removed.

### 13. The entry coach shows once, ever

`draft-entry-coach-seen` in `localStorage`. It makes the sequence
unreviewable without clearing site data — which is how it came to look like the
feature had vanished from the site on 2 Sep. A "show me again" switch is wanted
regardless of how the entry sequence question lands.

---

## Not cleanup. Please do not.

- **Do not strip the comments from `MODEL.dc.html`.** The comments carry the
  reasoning, and the file is trustworthy *because* of them. A stale one is
  worth fixing; the density is not a problem to solve. Shortening that file by
  deleting its prose would make it worse while making it smaller.
- **Do not rename persisted keys.** See item 7.
- **Do not move `.js`, `.html` or `.dc.html` out of the root.** GitHub Pages
  serves the root directly with no build step. Anything at root is live.
- **Do not add `TODO` comments.** See the top of this file.
