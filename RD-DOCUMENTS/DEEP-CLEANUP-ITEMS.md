# DEEP-CLEANUP ITEMS

Things deliberately left for a deep clean rather than done in passing. Started
2 Sep 2026, from a light tidy that kept turning up heavier work.

Each item says what, why it was left, and what it risks. **Nothing here is
urgent** — that is the point of the list. It exists so the work is remembered
instead of rediscovered, and so whoever does it starts with the traps already
mapped.

**How to do one of these, and it is Movie's rule:** take a backup of the whole
repository first, then do the work, then prove it still works. In that order.

Take it with `git bundle`, not a zip. A zip holds the files as they are today;
a bundle is one file holding every branch, tag and commit, and it restores with
`git clone`. On 2 Sep a zip would not have covered the day's actual near-miss —
229 branches deleted, one of them holding 19 commits nobody else had.

**Unshallow first.** The agent containers clone shallow, and a bundle made in
one is truncated at the cutoff *while still reporting* `The bundle records a
complete history` — `verify` cannot see past a boundary it believes is the
beginning. It fails at restore instead, which is the worst moment to find out.

```
git rev-parse --is-shallow-repository   # if true, do not bundle yet
git fetch --unshallow origin
git bundle create rough-drafter-$(date +%Y%m%d).bundle --all
git clone <that file> /tmp/restoretest  # the only proof that counts
```

Two health readings taken while writing this, worth knowing before anyone
starts "improving" things:

- **Zero `TODO`, `FIXME` or `HACK` comments in the entire codebase.** Not one.
  This project writes down its reasoning and finishes its thoughts; it does not
  leave markers for later. Do not be the first.
- **784 tests over 140 files, green.** Any cleanup that cannot stay green is
  not a cleanup.

---

## Cheap and safe — do these first

### 1. Delete merged remote branches — **DONE 2 Sep 2026**

229 branches down to 7, nothing lost. Left here for the trap, which cost a
branch and nearly cost nineteen commits.

`git branch --merged` listed only 118 of the 229 as merged. The cause is in
item 15, and it is not what item 15 originally said: the container held a
**shallow clone**, so most merge bases were invisible and long-merged branches
read as tens of commits ahead. **Unshallow before judging any branch**, and
until you have, read the PR badge on GitHub's branches page instead.

One branch — `claude/rough-drafter-audit-2bv0hh`, 19 commits — was deleted
mid-sweep on a merged-looking reading and restored from a local object at
`ce29ded`. That recovery was luck. The bundle rule above is so the next one
is not.

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

### 9. Two pages nothing points at

`Notepad.dc.html` and `SaveBox.dc.html` sit at root, are **linked from no
page**, and are **used by no test**. Nothing in the repository references
either.

They may be reachable by typing the URL, they may be dev scratchpads, or they
may be dead. Find out before deciding — an orphan page that someone uses by
bookmark is not an orphan.

If they are dead, deleting them is worth more than any file move: two fewer
things at root, and two fewer pages a newcomer has to work out.

Checked at the same time, so it is written down rather than re-derived:
`first-run.js` is also loaded by nothing, but **that one is deliberate** — the
ceremony module is unwired on purpose and says so in
`IMPORTANT-WORK-ORDERS/TOY-MODE.md`. Do not "clean it up".

And a caution, from getting it wrong while checking: `orientation-guard.js`
looks unreferenced to a grep for `"./orientation-guard.js"` and is in fact
loaded by three pages, because its script tag has no `./` prefix. **Match on
the filename, not on the path**, or the sweep will report live modules as dead.

### 10. `framing` already means two things

Structural framing (`MODEL.dc.html:8666`, *"Structure lives with the framing —
FLOOR or FOUNDATION"*) and UI panes (`:9981`, `:10124`, *"locked framing"* in
the STAIR workspace). Mildly muddy. Renaming the UI sense would be clearer;
whether it is worth the diff is a judgement.

### 11. The 26 MB of PDFs

`RD-DOCUMENTS/BUILDING-CODES/` is 26 MB of the 54 MB working tree, and 25.7 MB
of blob across all history. **Deleting them does not
shrink the repo** — git keeps the blobs, so every clone still pays. Only a
history rewrite recovers it, which means force-pushing over shared branches
and is ruled out by `BRANCHING.md` for good reasons.

Recommended: **leave them.** 29 MB is not a large repository, and this is the
one deletion where "I will remove it later" does not give what you expect.

### 12. `REFACTOR-PLAN.md` steps 5 and 6

Read the plan before proposing further extraction from `MODEL.dc.html`. Steps
1–4 are **done**. Step 5 (the vertex pool) is marked *"late, if ever"*; step 6
(tool state machines and keyboard) is marked **deliberately not** — *"these
are the component"*.

The plan's own rule also applies to timing: *"an extraction must not land under
an in-flight feature that touches the same region."* TOY MODE is that feature.

### 13. Six "coming soon" promises in the UI

Six places tell the user something is coming. At least one stopped being true
when the turtle landed. Worth an audit: each should either still be true or be
removed.

### 14. The entry coach shows once, ever

`draft-entry-coach-seen` in `localStorage`. It makes the sequence
unreviewable without clearing site data — which is how it came to look like the
feature had vanished from the site on 2 Sep. A "show me again" switch is wanted
regardless of how the entry sequence question lands.

---

### 15. A shallow clone reads exactly like a rewritten history

Found while trying to judge which old branches were safe to delete. **This
entry said the opposite for most of a day** — that `main` had been squashed or
filtered — and that reading was wrong. It is left in, corrected, because the
wrong version was convincing, and the way it fell apart is the useful part.

The agent containers clone **shallow**. `.git/shallow` held three boundary
commits. Everything older than them is simply absent, and git does not
announce this — it answers every question as though the cutoff were the
beginning of time.

```
                        shallow      real
main's own log            453         782
all refs                  680*        809
```
<sub>*Gilligan's container, truncated at a different depth. Three of us read three
different numbers off the same repository.</sub>

What that produced, all of it looking like separate problems:

- **`git branch --merged` under-reports.** A merged branch's merge base is
  older than the cutoff, so git cannot see the shared history and counts the
  branch as tens of commits ahead. This is what nearly cost the audit branch.
- **Commit subjects go missing.** `main` appeared not to contain *"BUILD HOUSE:
  one click generates the starter shell from the outline"*. It does, at
  `7697162`, below the cutoff.
- **GitHub disagrees with git, and GitHub is right** — not because it reads
  merge records instead of ancestry, but because it has the whole history and
  the container does not.

**The fix is two commands and about three seconds:**

```
git rev-parse --is-shallow-repository
git fetch --unshallow origin
```

#### How the wrong version survived as long as it did

Each proof was real evidence pointing at the wrong cause, which is the only
kind that is dangerous.

- *"453 commits against the repository's 755."* Both numbers were measured, and
  they do disagree — because one was a shallow log and the other was
  `git count-objects`, which counts loose objects, not commits. Two units, one
  comparison.
- *"`main` lacks the BUILD HOUSE commit."* True of what the container could
  see. False of the repository.
- *"`claude/new-session-1wmbue` is a byte-identical duplicate of `e66d412` —
  same `git patch-id`."* This one had **no left-hand side at all**. That branch
  tip was a *merge* commit, and `git diff-tree -p` emits nothing for a merge
  without `-m`; it produced zero bytes, so no patch-id was ever computed for
  it. The single id that came back, `0494df74`, was `e66d412`'s own — matched
  against itself. And `e66d412` is a plain ancestor of `main`, which needs no
  rewrite to explain.

The pattern worth keeping: **a story that explains three anomalies at once is
not thereby true.** A shallow clone explains all three too, and it is the
duller explanation, which is the one that was right. What broke it was not
more reasoning — it was trying to restore the backup and watching it fail.

### 16. `draft-entry-coach-seen` cannot be renamed, and the name will lie

A persisted key, like the two in item 7, but with a sharper edge: **127 of the
137 spec files depend on it.**

`tests/helpers.js` seeds it as ALREADY SEEN on every `openModel` call, and says
why:

> THE ENTRY COACH scrims the app a second after a first-ever open, and every
> spec runs on a fresh profile -- so without this every one of them would find
> its tools behind a tint.

So a rename, or a change to what reads it, does not fail one test. It puts a
full-screen scrim in front of 127 spec files at once and the suite goes red
across the board. `entry-coach.spec.js` is the single spec that opts back in
and exercises the real path.

The user-facing half is worse than the test half. It is a key on every real
drafter's machine: rename it and everybody who has already built their first
house is shown the first-house sequence again, as though they had never been
here.

**And the name is going to lie.** When the first-house work lands there is no
coach any more -- no arrows, no text -- and the flag will be named after a
thing that no longer exists. Rename it anyway and you break both halves above.
Leave the name, and put a comment at each of the four sites saying the name is
historical.

Four sites: `MODEL.dc.html:13304` and `:13336`, `tests/entry-coach.spec.js`,
`tests/helpers.js:64`.

---

### 17. `dc-runtime`'s source does not exist anywhere you can reach

**Stop looking. It has been looked for.**

`support.js` says it is generated from `dc-runtime/src/*.ts` and rebuilt with
`bun run build`. That source is in **none** of the three repositories:

| | |
|---|---|
| `bluejetty/draft` | no `dc-runtime/`, no `parse.ts`, `compile.ts`, `logic.ts`, `boot.ts` |
| `bluejetty/roughdrafter` | same, and it is an hourly mirror of draft anyway |
| `bluejetty/pdf` | same -- and this is the original Replit project |

`support.js` is **byte-identical in all three** (`md5 951ae391`), and nothing
anywhere references `dc-runtime` except that file's own header comment. Two web
searches for `dc-runtime`, `DCLogic`, `.dc.html`, `x-dc` and `StreamableLogic`
found no public trace of any of them.

And the toolchains disagree: `.replit` declares `stack = "PNPM_WORKSPACE"` on
nodejs-24, while `support.js` was built with **bun**. It was not built in that
project. It was dropped in as compiled output.

**So it is Replit's runtime, not ours** -- their internal component system,
injected into projects that use `.dc.html`. That explains the missing licence,
the missing copyright, the missing author and the missing public presence, all
of which looked alarming and are simply what an internal tool looks like from
outside.

Nothing to do. It has needed zero changes in 810 commits, and `support.js` is
readable rather than minified (35 characters a line, 60 comments intact, 80
named functions) if it ever does. This entry exists so that nobody spends
another afternoon searching for a folder that was never theirs.

See `IMPORTANT-WORK-ORDERS/PLAN-new-app.md` for what happens instead: nothing
new gets built on DC, and the day the last `.dc.html` in this repository is
deleted, `support.js` and React go with it -- 2,049 lines and 138 KB, because
nothing else uses them.

**One caveat on that finish line**, found by Gilligan: `pdf.bluejetty.ca` is a
separate site, from `bluejetty/pdf`, running twenty-odd `.dc.html` pages of its
own. Deleting draft's four ends DC *here*. It is not a statement about
everything bluejetty runs.

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
