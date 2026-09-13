# RULING — the chrome shell has no lower bar

**Devin, 12 Sep, recorded at his instruction.** The chrome-shell work order
asked for four edges: two sidebars, a top bar, and a lower bar carrying "the
dc page's readout, save state, and level/view controls". **The lower bar is
withdrawn.** It is not deferred and not a later rung; it should not be built
from that description at all.

## Why: the premise was false, and a spec already said so

The order's reason for the lower bar was that `MODEL.dc.html` puts those
things along the bottom and `MODEL.html` scatters equivalents. It does not.

| claim in the order | what `tests/bottom-strip.spec.js` asserts |
|---|---|
| the readout is a strip along the bottom | `:82` — **"the Replit-era readouts are gone from both drawing pages"**: `[data-model-sx]` and `[data-model-sy]` have count 0, and the strip contains no `MAIN FL / PLAN` |
| save state is down there | `:102` — **"the SAVED light sits beside SAVE in the top bar"**, and the test pins its position beside the SAVE button |
| level/view controls are down there | the same `:82` check — no level or view readout anywhere in the strip |

What the dc bottom strip actually holds is an **instrument cluster**: PROJECT
in all four corners, the ruler / LENGTH / T-square / protractor group
dead-centre, and three dormant chips each side. Board #259 retired the status
line deliberately, and that spec exists to keep it retired.

So "carry across what the old page puts there" would have produced a tool
cluster, not a status bar — and building the status bar the order described
would have **resurrected the thing #259 removed**, on a page whose `#readout`
is already its one instrument under the keep-adding-never-prune rule.

## What this does not forbid

A bottom edge may still earn its place later. Devin's condition: **it arrives
with a named need, not with a shape copied from the old page.** Something
specific must want to live along the bottom, and the case gets made then.

## Status

Not built. The other four items of that order — both sidebars, the view rail
moving into the right panel, the properties slot, and the top bar — are built.
