# RULING — a plan holds ONE building, and the site plan is what they share

**Movie, 23 Sep 2026:**

> *"right now you can only build 1 HOUSE and 1 GARAGE per plan (autobuild).
> i'd like to make it only 1 BUILDING (house or garage) it will be easier and
> make more sense to have seperate plan sets for each and they can both share
> the same site plan"*

Status: **RULED, HELD.** Movie, same conversation: *"that isn't part of this so
we can hold that change for later."* Recorded now because it is cheaper to
know about than to rediscover, and because two things in the tree already
point at it.

---

## The rule, in one line

**ONE BUILDING PER PLAN SET.** A house with an ATTACHED garage is still one
building. A DETACHED garage is a second building, so it gets its own plan set,
and the two are tied together by the SITE plan rather than by sharing a
drawing.

## It makes the tree smaller, not bigger

**`garage-site.js` exists to answer a question this ruling deletes.** Its own
header:

> *"A detached garage stands BESIDE what is already built, never on top of it:
> east of everything drawn, one yard-gap clear, with its door wall on…"*

That rule only has work to do when a garage and a house share one drawing.
With one building per plan there is nothing already built to stand beside, and
the garage stands where the SITE plan puts it. Eighty lines, one harness, and
a placement rule that nobody has to keep true — all candidates to go.

## And the expensive piece was inserted a month ago, for this

`siteRegistration` — `{ x, z, angleRad }`, or null — is already a persisted
key: normalised on load in `MODEL.dc.html`, round-tripped through save, pinned
in `tests/persisted-format.spec.js` and exercised by
`tests/registration-grid.spec.js`.

`BOARD-site-registration.md` says why it went in before anything read it:

> *"It is here now because it is the one piece that gets expensive later."*

This ruling is the case it was inserted for. Two plan sets, one lot: each
building carries its own registration onto the site, and neither needs to know
where the other is. **The format is already shaped to receive this.**

## What it does NOT change

- **An attached garage stays attached.** `bungalow-garage`, `twoStorey-garage`,
  `twoStorey-over` and `bilevel-garage` are all one building, and the tie, the
  shared wall and the garage roof drop are all unaffected.
- **The premade designs.** They deal one building each already.

## Not decided

1. **What happens to drawings that already hold both?** They exist. A load
   that split one into two plan sets is a migration; a load that refused it
   would be a broken drawing. `RULES-persisted-keys.md` is the governing file
   and its rule is that old drawings open forever.
2. **Does the SITE plan become its own document, or a view every plan set
   carries?** That decides whether "share the same site plan" is one file or a
   copy in each.
3. **Sequencing.** It does not touch the PROJECT page restyle, so the two can
   run in either order.

## AND IT IS NOT A SMALL CHANGE, measured 23 Sep

Movie asked whether it could be done straight away if it were easy. It is not,
and the reason is not the sixteen spec files that build a house and mention a
detached garage.

**THIS APP HAS ONE DRAWING, NOT PLAN SETS.** One bucket, `'model-drawing'`.
So *"seperate plan sets for each"* is not a rule to flip — it is a capability
the app does not have yet: more than one document, a way to move between them,
and a migration for every existing drawing that already holds both buildings.

The RULE is easy to state. The MACHINERY is a project. Those are different
sentences and this file keeps them apart on purpose, because a ruling that
reads as cheap is one somebody starts on a Friday.
