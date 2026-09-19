# A roof bears on the top of the LEVEL LIST, not on the walls under it

Movie, 19 Sep, on a bungalow's elevation: *"the roof is real messed on this
one"*. He is right, and it is not the roof builder — it is `bearing`.

Parked deliberately: *"we will fix that eventually... just note it for
something to keep in mind we will look at it fully later."* This note exists so
nobody has to re-derive it.

## Measured

From his own drawing, kept as `proto/repro-bungalow-garage-roofs.draft`
(1 STOREY + GARAGE, pressed at the drive-thru, `buildType: bungalow`):

```
floor levels in the stack   MAIN FL wallTop 8.09   2ND FL wallTop 17.24
stack.bearing                                                    17.240
house roof bears at                                              17.240
garage roof bears at                                              8.094
top of the MAIN FL walls                                          8.000
walls on 2ND FL                                                        0
```

The house roof floats **9.15 ft** above the walls holding it up, over a level
with nothing standing on it.

## Why

`cut-view.js`'s `sectionLevelStack` ends with

```js
bearing: stack[stack.length - 1].wallTop,
```

and the stack comes from `env.floorLevels()`, which keeps a level because it
has a floor layer view — never because anything was built there. The default
stack always carries 2ND FL. So **every bungalow on both pages has drawn its
roof a storey high**, and always has.

## Why it went unseen

Nothing correctly placed stood beside it. A garage roof carries
`plateHeightFt` and bears on its own storey, so until the garage got a roof
(PR #435) there was no second roof in the elevation to disagree with. One
floating roof alone reads as "how it draws"; two roofs nine feet apart do not.

## The shape of the fix

Choose `bearing` from the **occupied** floor levels rather than the last one
in the list:

```js
const standing = stack.filter(level => hasWalls(level.id));
const top = standing.length ? standing[standing.length - 1] : stack[stack.length - 1];
// ... bearing: top.wallTop
```

Two properties make it safe on a painter that draws every elevation and
section on both pages:

- **It needs no nineteenth accessor.** `env.walls()` is already in the
  eighteen — all three env builders have it (`MODEL.html:3648`,
  `MODEL.dc.html:10113`, `proto/elevation-harness.js:172`).
- **It is a no-op wherever the top floor is occupied**, and where NO level is
  occupied it falls back to today's answer. The number moves only in exactly
  the broken case.

`levelWallTopFt` cannot serve as the emptiness test: it answers
`DEFAULT_WALL_TOP_FT` for a level with no walls, so it cannot tell "empty"
from "ordinary".

## The checks it wants

Written and seen to fail (`bearing 17.240 vs the occupied storey's 8.094`),
then withdrawn so CI stays green while this is parked. They belong in
`proto/elevation-harness.js`, as a pair:

1. On this fixture, `bearing` equals the **occupied** storey's wall top, and
   the house roof and the garage roof bear together.
2. On `repro-garage-house.draft`, whose top floor level IS occupied, `bearing`
   is still the top of the stack — **unmoved**.

The second is what keeps the first honest: a fix that simply lowered every
bearing would satisfy the first alone.

Guard the fixture's reach before trusting it — that its stack has more than
one floor level, that its top one is empty, and that a lower one is not.
Every check above is about an empty top storey, and on a fixture that grew
walls up there they would all pass while measuring nothing.
