# SPEC — the bars are the site's shell, not MODEL's chrome

**Movie, 23 Sep 2026**, across about fifteen messages. Gathered here because
the brief GREW while it was being answered, and the growth is the point: what
began as "give PROJECT the same bars" ended as "every page wears these."

Status: **stylesheet EXTRACTED and proved; markup and behaviour NOT YET.**

---

## How the question arrived

It started as a choice between two ways of giving PROJECT.html the bars, and
Movie picked the harder one on the right grounds:

> *"i think extract to shared module sounds like a good idea whats your
> opinion? we have time to do it now"*
>
> *"it will guarantee to be same style if i change one all will change
> right"*
>
> *"less future issues more streamline"* · *"less code probably too"* ·
> *"less duplication of code"*

**The second line is the whole specification.** Sharing markup guarantees
nothing on its own — if each page keeps its own copy of the styling, changing
one changes one. So the stylesheet had to move, and `shell-bars.css` is the
repo's first shared stylesheet.

---

## Who wears the bars

Then the list grew, in his words, message by message:

> *"i will check the other areas like Construction Layout, Specifications, i
> think i'd like the top and bottom bars there too"*
>
> *"yes put those top and bottom bars in the Construction layout (with the
> LENGTH, ANGLE and other instruments on Construction layout we may need to
> draw sometimes but i will make a more limited drawing tool for it later"*
>
> *"and put them in SPECS page"*
>
> *"once i make REAL ESATATE PLANS and the ESTIMATES will need those in there
> too"* — *"(top and bottom bars in the REAL ESTATE PLANS and ESTIMATES"*

| page | bars | instruments | BONE | what the BONE does |
|---|---|---|---|---|
| MODEL | yes | yes | yes | builds the house from the outline |
| PROJECT | yes | no | yes | builds the chosen type |
| Construction Layout | yes | **yes** | yes | **print a plan / make a PDF** |
| SPECS | yes | no | — | — |
| REAL ESTATE PLANS | yes | — | yes | **print a plan / make a PDF** |
| ESTIMATES | yes | **no** | **probably not** | — |

Two of those pages do not exist yet. They are in the table because the shell
has to be cheap for them when they do: **two tags and a mount call**, not a
paste.

---

## Three rulings that fall out of the table

### 1. The instruments are not MODEL's

They were left behind on the first cut, on the reasoning that PROJECT does not
draw. Movie corrected it the same hour — Construction Layout wants them,
because *"we may need to draw sometimes"*. So `#strip-center` belongs to every
**drawing** page, and it went into the shared sheet.

A page that does not draw simply never mounts the markup. **A rule with
nothing to match costs nothing**, which is why this is one file rather than
two and a note about which pages link which.

### 2. The bar owns the BUTTON; the page owns the VERB

> *"the real estate layout and the construction layouts will have the
> BONE/HOUSE but will use it to 'PRINT' a plan or make a PDF"*
>
> *"perhaps in the ESTIMATES not sure if the BONE will be needed (everything
> should update automatically there"*

So one press means four different things, and on one page means nothing at
all. `shell-bars.js` must take the verb **from the page** and mount cleanly
with no bone. The wallet states — lit, broke, the balance — are the bar's,
because they are about the bone; what a press *does* is not.

### 3. SPECS goes last, because it is two jobs

> *"of if specs will take longer leave it for last"*

`SPECS.html` carries **zero palette roles and 56 hardcoded colours**, and does
not load `palette.js` at all. It is a white page with dark ink on every skin.
Bolt a palette-aware bar onto it and the mismatch becomes the first thing you
see. So SPECS is bars **and** a recolour, in one pass, after the others.

`SETTINGS.html` (70 hardcoded colours) and `STANDARDS.html` (43) are in the
same state, and both are linked **from the top-left corner of the very bar
being shared**.

---

## What the extraction cost, honestly

**The bar CSS was not a block.** 84 rule sites naming bar selectors, scattered
from line 107 to line 1566, interleaved with the drawing's own styling through
the whole 1,560-line style block. Extracting meant walking those sites and
deciding each one.

**And the cascade is load-bearing.** Moving a rule moves it in the cascade.
MODEL.html already has same-specificity collisions that silently kill rules —
see the defect below — so reading the source could not answer whether the move
changed anything.

**So the acceptance instrument was the browser's own answer.**
`getComputedStyle` over every property of all **1,704 elements** in the bars,
across four skins and three widths, before and after: **765,324 values, zero
differences**. The instrument was watched failing — one pixel off `--strip-h`
moves 5,636 of them — because a check that passes while measuring nothing is
worse than no check.

---

## A defect found on the way, and NOT fixed here

`MODEL.html`'s `@media (max-width: 1500px)` block is **two-thirds dead**.

```
 line 434   @media (max-width:1500px) { #strip-len:not(:empty) { min-width:66px } }
 line 462                               #strip-len:not(:empty) { min-width:74px }
```

Same specificity, and the unconditional rule comes **later**, so it wins at
every width. `#frozen-length` is killed the same way by line 468. Measured in
a browser at 1400px: the box is 96px, where the rule says 72px.

What it cost: the narrow-screen shrink Movie asked for by name —
*"there is a big blank spot where it should say LENGTH"*, the box giving up
width — **has never once fired**. Only the `gap:6px` survives.

It is left alone deliberately. It sits in the instrument rules, it is
pre-existing, and fixing it would change behaviour in the same commit that
claims to change none. **Two lines, whenever Movie wants it.**

---

## What guards this

`proto/shared-shell-harness.js` — ten checks, and the one that matters is
*"no page re-styles what the shared sheet owns"*. The guarantee is not a
property of the code; it is a property of **nobody ever pasting the rules
back**, and that is a cheap mistake to make.

It scans pages off the disk rather than keeping a roster, so REAL ESTATE PLANS
and ESTIMATES are covered the day they are made.

`proto/shared-shell-mutants.js` is why any of that is believable: seven ways
the shell could come apart, each one watched killing the harness. Mutant #5 —
a page pasting a bar rule back into its own `<style>` — is not hypothetical.
It is what already happened to `.card`, `.field` and five more between
PROJECT.html and SPECS.html before anything was shared.
