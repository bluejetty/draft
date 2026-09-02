# TOY MODE — status report

Written 2 Sep 2026 by Skipper. Covers the turtle path from step 0 to where it
stands tonight, what is proven and by what, and what is still unanswered.

Every number below was run or read out of the code while writing this. Where
something is a reading rather than a fact, it says so.

---

## What TOY MODE is

A capability layer over the same model and the same file — not a second
application. A beginner on an iPad moves a wall and the house stays legal,
because the mode cannot show them an invalid house. Everything it refuses, it
refuses out loud and in the room's own words.

Three claims hold the design up, and all three are Movie's rulings rather than
inventions:

- **It stops dead and the blocker says why. Never elastic.** Rubber-banding is
  the one option that is wrong rather than merely weaker: it puts a refused
  position on screen in a mode whose whole claim is that it cannot, and on a
  touchscreen a wall that stretches reads as *push harder*.
- **The toy never changes what it did not create.** A wall sitting at −1.386'
  moves a whole foot from where it sits; it does not snap to the nearest foot.
  Old drawings keep opening, unchanged.
- **A wall has a bone, but bones weld into groups.** Walls meeting end to end
  are one bone and move together, so a room boundary can never be left with a
  gap in it. A partition that Ts into the middle of a wall is a singleton and
  flexes alone.

---

## Where it stands

| step | | state |
|---|---|---|
| 0 | the rulings | 1–3 ruled, 4 moot, **5 outstanding** |
| 1 | `allowedMove`, the constraint function | ✅ merged (#222) |
| 2 | grip tabs | ✅ merged (#227) |
| 3 | the turtle | ✅ merged (#231) |
| — | the closet (not in the original path) | ✅ merged (#229) |
| 4 | the iPad interaction set | 🔨 in progress — `skipper/toy-nudge` |
| 5 | TOY MODE as a capability layer, and the switch | not started |
| 6 | the dashboard | not started |

Ruling 4 — *does BONE LOCK default on?* — is **moot rather than answered.** The
tap-and-arrows design removes the need for a lock: a direction that is not
permitted is simply not offered, so there is nothing to lock against. Recorded
here so nobody spends an hour answering a question that stopped existing.

Ruling 5 — *is detachment per storey or per wall?* — is still open and is the
only ruling blocking anything.

---

## What is built, and what proves it

The rule lives in node. The browser does the wiring and nothing else, which is
why every rule was proved once and never re-argued in a painter.

| module | lines | harness | what it owns |
|---|---:|---:|---|
| `toy-constraints.js` | 468 | **55** | every decision: rounding, welds, exterior limits, minimum rooms, openings, cantilever bands, refusal codes |
| `toy-context.js` | 199 | **33** | every measurement: gathering the house into the shape `allowedMove` reads |
| `closets.js` | 356 | **41** | the closet as an object — its size, its door, where it may stand |
| `turtle.js` | 149 | **25** | two verbs, the walk, and which side the inside is on |
| `first-run.js` | 151 | **22** | the ceremony's shape. Wired into nothing yet |
| | **1,323** | **176** | |

On top of that, **21 Playwright specs** pin the commit layer — 9 for grip
tabs, 5 for closets, 7 for the turtle. Eight of the nine grip-tab specs fail
without the MODEL commit; the ninth asserts an ordinary drafting session has
no tabs anywhere, which is a guard rather than a proof.

The full suite is **784 tests in 140 files**, green on `6d0a9d4`.

### The seam that matters

`toy-constraints.js` contains no closet reasoning and never learns what a
closet is. It asks — `clearanceFor(object, config)` — and `closets.js`
answers, from the *proposed* configuration rather than the current one. With
no callback supplied nothing is asked and nothing can refuse, which is the
honest state while a rule has no number yet. The day a second kind of object
needs clearance, it implements the same call.

---

## Measurements that contradicted the work order

The standing instruction on this project is that the diagnosis in a work order
is a reading, not a fact. Four times it paid.

- **`minSide` did not hold for the shapes TOY MODE can produce.** A 20×20 room
  with a 16×16 bite has four-foot legs, and the bounding box called it 20 ft
  and passed it as a legal bedroom at 126 sq ft. Movie's later ruling —
  *rooms are always rectangles and a closet is an object placed in one* —
  superseded the problem rather than fixing it, so the neck measurement is
  deleted rather than deferred.
- **Area was being derived as `clearWidth × clearDepth`** where MODEL already
  measured the real thing off the room's own loop. The toy now reads MODEL's
  number, so the two cannot disagree about the same room on the same drawing.
- **The verdict reported the *furthest* refusal rather than the binding one.**
  Drag a wall five feet into a room and the area minimum fails out at the
  finger, while the thing that actually held you at one foot was the closet
  behind you — and the old code named the area. Found by the seam test, the
  first case with two rules refusing at two different distances.
- **The bedroom detector is circular.** The only fixture that marks a room as a
  BEDROOM is a closet, so a room is not recognised as a bedroom until it
  already has the thing auto-placement exists to give it. Reported rather than
  worked around: working around it would mean guessing which unnamed rooms are
  bedrooms and carpeting a house with wardrobes. A spec pins that it does
  **not** guess.

---

## The structure numbers, settled 2 Sep

Two numbers were being confused for each other. They are different
measurements and both are correct.

- **19'-0" — maximum joist span between beams.** `build-house.js:73`,
  `beamAtFt = 19`, from board #230 marked "answers confirmed". Inside the
  house a beam is a *response to too much span*: nothing until the short span
  exceeds 19, then one beam down the long axis, two at third points past 38,
  columns splitting each run at `maxSpanFt = 12`.
- **20'-0" — maximum reach outward.** Outside, beams are the only thing
  holding the floor up, so supports are required from 4'-6" out regardless of
  distance — and they sit closer than interior columns, because a pile carries
  the storey above as well.

```
0'-0" .. 2'-0"     free cantilever, nothing under it
2'-0" .. 4'-6"     bump the foundation out; NOT a legal overhang
4'-6" .. 8'-0"     first pile line and its beam
        + 10'-0"   second pile line, so 18'-0" to the outer beam
        + 2'-0"    joists overhanging the outer beam
= 20'-0"           maximum floor edge
```

The remembered "18 ft" was right — it is the distance to the outer beam, and
it falls out as 8 + 10. Neither number was wrong; they were answers to
different questions.

---

## Next: step 4, the iPad interaction set

Movie's design, in his words: *"they are on the iPad, they want to move an
EXTERIOR wall. First let's get them to click the wall, it will glow so they
know they can move it, and maybe arrows to point directions. For EXT let's go
6" increment."* And: *"real easy style."*

Two things make this smaller than it looks:

- **6" is exactly the half-foot the rounding rule already permits** before
  inches are ever allowed. It is not an exception carved out for the iPad; it
  is the finest step the toy was always allowed to take.
- **The arrows refuse by not being offered.** A direction that would break a
  rule has no arrow. Nothing to explain, nothing to lock, no error to word —
  which is what made the bone-lock ruling unnecessary.

`skipper/toy-nudge` carries the rule half already: a per-wall `stepFt` so an
exterior wall moves 6" where everything else moves a foot, and the beam
threshold read from the generator rather than restated. Harness is at **69**
checks, up from 55. What is missing is the on-screen half — tap, glow, arrows,
6" a press — and a spec.

---

## Open, and deliberately not invented

1. **Ruling 5 — detachment per storey or per wall.** The only ruling blocking
   a step.
2. **The default house size.** The bone cannot yet build from nothing: zone
   words are resolved against an outline (`gruff-interview.js:391`), outlines
   are only created by a user tracing one (`MODEL.dc.html:11123`), and the
   width bands live in a `spec-toy-dashboard.md` that does not exist in this
   repo. Picking a house size is the same class of decision as `bearing` and
   `cantileverFt`, which were deliberately left unfabricated.
3. **The first coached bone press.** Movie has ruled it should build a whole
   house from nothing — which the drive-thru manual already promises — but it
   is blocked on (2).
4. **The entry coach shows once ever, per browser.** `draft-entry-coach-seen`
   in localStorage. It makes the sequence unreviewable without clearing site
   data; a "show me again" switch is wanted either way.

## Not in this path, on purpose

**RABBIT** — four plans per press. It reuses the same constraint set as the
generator's input, which is the argument for having built step 1 properly, but
it is a separate route. **The real-estate / concept-plan area** dresses a
chosen plan; separate job. **Gruff** is a teacher, not a mode — do not couple
them.

---

## One thing to protect

The door into the mode is a query flag, `?toy=1`, and it is **temporary**. The
real switch is step 5 and gets built once, properly, alongside the dashboard.
It is written here so that nobody finds the flag, assumes it is the design, and
builds against it.
