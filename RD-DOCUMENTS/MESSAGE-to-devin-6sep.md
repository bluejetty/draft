# TO DEVIN — three asks, and one question about the repo

**From Skipper, 6 Sep 2026, forwarded by Movie.** Nothing here is urgent enough
to wake you for; it is what will be waiting.

---

## FIRST, THE QUESTION: is it safe for you to come in?

**Short answer: yes for reading, and one file to watch if you write.**

`main` is quiet. Nothing of Gilligan's is open or running — his last two, #316
and #317, are merged. Nothing of mine is open as a PR.

**But I have 19 commits on `claude/new-session-od1p8t` that are pushed and NOT
merged**, and they touch 29 files. If you write to any of these before they
land, we collide:

| | |
|---|---|
| `MODEL.dc.html` | **the big one** — the build row is now a menu, and the half-levels are new |
| `project-page.js` | one comment block only |
| `tests/helpers.js` + 18 spec files | every `data-select-build` click goes through a new `pickBuild()` |
| 4 files in `RD-DOCUMENTS/` | boards and orders |

**`drawing-format.js` is untouched by me**, which matters for the first ask
below.

So: read anything; if you want to WRITE to `MODEL.dc.html` or the specs, say so
and I will get my branch merged first. Movie merges everything himself.

---

## ASK 1 — RULE ON `autoDimFirstOffsetFt`. THIS IS THE ONLY THING BLOCKING THE
## WRITE TIER

Four of the five pre-tier-3 items are done (`RD-DOCUMENTS/PRE-TIER3.md`). This
is the fifth, and it is a persisted-key decision on shared ground, which is
exactly why neither agent should just make it.

**What is wrong.** The bone keeps `autoDimFirstOffsetFt` for the session and
never writes it. So a drafter changes the first dimension offset, saves, and
the viewer draws a different gap than the page they saved from. It is the
derive/store divergence class: a value one page holds and another derives.

**What I would do, and want your word on:**

    autoDimFirstOffsetFt: positive(raw.autoDimFirstOffsetFt, null)
    // null means derive 1.5

The `stored ?? derived()` contract, same shape as ROOF HEEL. Readers normalise,
writers never invent, null means derive.

**WHY IT WANTS TO BE NOW AND NOT LATER.** Your Write Tier acceptance is a
deep-compare: the old page saves a drawing, the new page saves the same
drawing, every key matches. A persisted key added DURING that work is a key the
new serializer is chasing while it is being written. Added today it is one line
in a normaliser and one round-trip spec.

**What I need from you:** yes, no, or a different shape. If yes, say whether
you want me to write it or you will.

> **RULED, 6 Sep: YES as proposed, Skipper implements, before W0.** Done in
> this branch -- `drawing-format.js` gains the normaliser and
> `AUTO_DIM_FIRST_OFFSET_FT`, MODEL.dc.html's state defaults to null, every
> reader goes through one derive, and the serializer and loader carry the key.
> `persisted-format.spec.js` pins null-means-derive, the round trip, and that a
> hand-edited impossible value normalises back to null.

## ASK 2 — A NUMBER AND A RULING FOR THE BUILD-TYPE BOARD

`RD-DOCUMENTS/BOARD-build-type-options.md`. It was Movie's 5 Sep idea and it
grew a great deal today: the build row becomes **three families with one
submenu each**, and every entry is a whole house rather than a question.

    BUNGALOW   1 STOREY / +GARAGE / 2 STOREY / +GARAGE / +ROOM OVER
    BILEVEL    BILEVEL / +GARAGE / MODIFIED BILEVEL (1.5 STOREY)
    DETACHED   THICKENED EDGE / GRADE BEAM / FROST WALL

**It changes no persisted key** — `buildType` still stores one of the same four
values, and the garage is an instruction to BUILD HOUSE rather than a stored
label, because a garage is an outline carrying `garage: true` and the drawing
stays the record.

**It is BUILT on my branch**, which I know is backwards for a board that has no
number. Movie asked for the row and I built it; the board records the design.
If you rule differently, the code moves — better now than after it merges.

**What I need from you:** a board number, and a look at the tree in that file.

> **RULED, 6 Sep: board #333, menu revision approved**, storey-over-garage
> derived, no new key. Recorded on the board.

## ASK 3 — THE TIER-2 REVIEW, WHICH IS THE GATE

**Tier 2 is complete.** Underlays landed in `8b1a991` and that was the last
painter. **MODEL.html calls 13 of `render-2d.js`'s 17 exports** — Devin's count,
and he is right; mine said 14 of 16 with two deferred. Verified: 17 exports (16
painters plus `strokeSegPath2D`), 13 called, and THREE painters deferred rather
than two — `drawCutPreview2D`, `drawBoneyardMark2D` and `drawStairNotes2D`. The
third is in `SPEC-model-html-tiers.md:430` as tier 3, serving the STAIR
workspace, which is a drafting surface rather than a plan; I had simply not
counted it. All three paint gesture state rather than saved content.

Your tier-2 review is what the Write Tier opens from, so it is the gate whether
or not ask 1 is settled.

**One thing worth knowing before you read it.** The test of a finished
extraction is not that a painter moved into `render-2d.js` — it is that its
`env` is reachable too. That is what the whole tier turned on.

---

## AND ONE THING I AM NOT ASKING YOU TO RULE ON, ONLY TO KNOW

Three separate findings today want the same mechanism, and none of them is a
bug in the ordinary sense:

1. A stair's rise re-derives when a level height changes; nothing re-checks
   that the stair still FITS its opening cut.
2. An engineer deepening the joists over a garage drops the door head; past
   27 7/8" a 7'-0" overhead door stops fitting, and the page draws it happily.
3. Pressing BUNGALOW on a drawing that has a built OVER GARAGE leaves the
   drawing saying one thing and the lamp another.

**In all three the geometry correctly does not move** — board #313 says
software never moves geometry, only a drafter's press may — **and in all three
the page says nothing.** Silence reads as agreement. One press-and-flag
mechanism would serve all three. It wants an owner; it does not gate anything.

---

## THE STATE OF THE DAY, IN ONE PARAGRAPH

The suite's 90-second budget turned out to be the cause of the "flaky" MODEL
specs — *it was never a race, it was a queue* — and #314 raised it to the 180
that was measured. Six other things found today were **prose that had stopped
matching**: four stale comments, and two citations pointing at things that do
not exist. One of the citations was mine, in a merged document, and a second
agent had already built on it. Gilligan's rule from it is the transferable
part: **an emptiness assertion needs a companion that the population is not
empty** — because that one can be grepped for, and "a check whose broken state
looks like its passing state" cannot.
