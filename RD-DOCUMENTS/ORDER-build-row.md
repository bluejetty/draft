# WORK ORDER — the build row loses the rabbit and re-sorts

**Movie, 6 Sep 2026**, from the live app. **Scheduled PRE-TIER 3**, and Movie
said so: this lands before the Write Tier starts.

Small and self-contained. It belongs to MODEL.dc.html — the drafting page — so
it touches nothing the MODEL.html tiers are building and cannot collide with
them.

**Why it goes first rather than later.** The Write Tier is where MODEL.html
learns to save, and its whole acceptance is a deep-compare between what the old
page writes and what the new one writes. Every change to the old page during
that work is another thing that has to be equal on both sides. This one moves
no geometry and stores no key, so it is free today and merely noise later. Do
it while it is free.

## The ruling

> *"i think i'm going to remove the rabbit function because making 4 at a time
> is too much basically one at a time is impressive enough. then i will locate
> the turtle on the left and the bone on the right with the house types in
> between. the garage buttons would move to the left of the bone. and no more
> rabbit"*

## The rabbit is not built, which makes this cheap

`MODEL.dc.html:13150` says it in the code's own words:

    // TURTLE and RABBIT are assistance levels -- how much the app does for you.
    // RABBIT is not built. TURTLE is, and only inside TOY MODE

Pressing RABBIT sets a drawing message — *"RABBIT pace is coming soon"* — and
does nothing else. So this cancels a planned feature rather than removing
working code. No migration, no persisted key, no drawing affected.

**One thing to keep straight.** The rabbit was never about making four of
anything. Both animals are ASSISTANCE LEVELS: turtle is the guided pace that
explains each step, rabbit was to be the opposite — staying out of the way once
you know the moves. If "four at a time" names a behaviour that actually exists,
it is somewhere else and removing the rabbit will not touch it. Worth
confirming before this is called done.

## The row, before and after

    now      turtle · BUNGALOW 2 STOREY BILEVEL MOD-BILEVEL · bone · garage · rabbit
    after    turtle · BUNGALOW 2 STOREY BILEVEL MOD-BILEVEL · garage · bone

So: the garage cluster and the bone swap, and the rabbit goes.

## What it touches

| | |
|---|---|
| `MODEL.dc.html:428-429` | the RABBIT button and its `<img>` |
| `MODEL.dc.html:21695` | `onSelectRabbit` in the render props |
| `MODEL.dc.html:13154-13161` | `_pressAssistLevel` collapses to turtle-only |
| `MODEL.dc.html:376-381` | the row comment SAYS turtle and rabbit *"bookend the row permanently"*. That intent dies here and the comment must say the new one, not be deleted |
| the build cluster order | garage buttons move left of the bone |
| `assets/btn-rabbit.png` | orphaned. Leave it or remove it, but say which and why |
| specs | anything pressing `[data-select-rabbit]` |

## Notes for whoever takes it

- **The comment is not decoration.** It explains why the two animals are NOT
  wrapped in `hasHouseMaster` like SPLIT and ATTACHED, and why they wear no
  lamp filter — they are assistance levels, not things that can exist in the
  drawing. That reasoning still applies to the turtle alone and should survive
  the edit rather than being cut with the rabbit.
- **The turtle stays**, and it still only does anything inside TOY MODE.
  Outside it, it shows its own "coming soon" message. Not in scope here, but
  worth knowing the left bookend is half-built too.
- **Show the row before committing.** It is a product change and Movie reads
  the drawing, not the diff.
