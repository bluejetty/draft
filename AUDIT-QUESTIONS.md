# AUDIT-QUESTIONS.md — intent questions I could not settle from the code

Things that look wrong but may be deliberate, and things that look deliberate but
may be accidents. Answering these is cheaper than my guessing; a wrong guess adds
noise to the backlog.

---

**Q1 — Is the iPad a shipping target now, or a stated future one?**
Nothing in the app listens to touch or pointer events (C2). That is not a bug you
introduce; it is a layer that was never written. If the plan is "desktop now,
touch in the print/3D milestone", C2 and C4 are roadmap items and my ranking is
wrong. If beginners on iPads are meant to use it this quarter, they are the top
two items. Which is it?

**Q2 — Should committed geometry snap to the 1/16" grid?**
Typed lengths are snapped (`normalizeArchitecturalInches`, `formatters.js:48`)
but traced points are stored raw (`_pointForStorage`, `MODEL.dc.html:2359`), so a
finger-traced house is 21'-8 7/8" *displayed* and 260.87…" *stored*. Snapping on
commit would fix C1 outright and would give beginners round houses. It would also
mean the drawing silently moves a point by up to 1/32" behind the drafter's back.
Was raw storage a decision, or just what happened?

> **Ruled, and since amended.** Committed geometry snaps to the project's own
> increment (board NEW-5). The follow-on ruling — that a units toggle is
> display-only and any re-snap is a separate deliberate command — was **amended
> on 3 Sep**: the toggle itself now re-snaps. See
> `RD-DOCUMENTS/BOARD-units-round-trip.md` for the measurements that changed it
> and the reasoning. Loading a drawing still moves nothing, in either mode.


**Q3 — Is a 2" dimension fabrication acceptable on a permit set?**
`AUTO_DIM_JOG_MERGE_FT = 2/12` merges near-coincident corners into one strung
coordinate, and an *interior* cluster is replaced by the arithmetic mean of its
members (`auto-dims.js:99-103`), i.e. a coordinate where no wall stands, up to 1"
from either. The intent — "a slightly off-square outline gets straight strings
instead of a pile of inch-scale jogs" — is clearly stated and clearly reasonable
for drafting. Is it also acceptable to an inspector measuring the sheet? (Note
separately that the comment says "merged into the neighbouring corner" while the
code averages; whichever behaviour is intended, one of the two is wrong.)

**Q4 — Is the LAYOUT viewport's scale meant to be fixed at placement?**
`_setScale` only writes `activeScale` (`LAYOUT.dc.html:795`); nothing rescales a
placed viewport and there is no per-viewport scale control. Delete-and-re-add is
the only path. Is that the intended model (a viewport is immutable, place a new
one), or was the "apply to selection" branch never written? The answer changes M3
from a bug to a missing affordance plus a lying status bar.

**Q5 — What is the story for two open tabs?**
The first-run notice tells users to close other tabs "for optimal performance",
which reads as a performance hint. But two tabs is also the mechanism by which
LAYOUT destroys MODEL's work (C3) and by which two MODEL tabs overwrite each
other. Is single-tab an enforced constraint (in which case: enforce it, with a
lock, and say why), or an unstated assumption?

**Q6 — Is the overlay's 1× rasterisation a deliberate performance trade?**
`MODEL.dc.html:5723` sizes the 2D overlay in CSS pixels while the WebGL canvas
gets `min(devicePixelRatio, 2)` and the view-rail thumbnails are explicitly drawn
at 2× "for crisp lines". Three different DPI decisions in one file suggests the
overlay was measured and deliberately left at 1× — or that it was written first
and never revisited. Which?

**Q7 — Where does the print milestone take its pixels from?**
If printing rasterises the same overlay canvas, the sheet is 96 dpi ink and M1
becomes a paper defect rather than a screen one. If printing re-renders into a
print-resolution canvas (or emits vectors via the vendored jsPDF / pdf-lib, both
of which are in `vendor/` but unreferenced by any page I read), M1 stays a screen
issue. Which way is it going? That decides M1's severity.

**Q8 — Are `jspdf` and `pdf-lib` in `vendor/` dead weight or staged work?**
889 KB of PDF-writing libraries are vendored and, as far as I can find, loaded by
nothing. If they are staged for the print milestone, fine. If they are leftovers,
they are 889 KB in the repo and a maintenance signal.

**Q9 — Should a deleted level take its openings and stairs with it?**
`_deleteLevel` filters ten collections and skips five (M5). The skip could be
deliberate ("if you re-add the level, your windows come back") — except level ids
are never reused, so nothing can come back, and the orphans instead trigger a
"your drawing was incomplete" warning on the next load. I assume oversight, but
if there is an undo-shaped reason for keeping them, say so and the fix changes to
"drop them at save time" instead.

**Q10 — Is the tour meant to start itself?**
Closing a house outline on a level fires the FOUNDATION-DONE card with no prior
opt-in (`tests/helpers.js:210-227` documents it as the normal path). To a first
timer it reads as an error dialog interrupting the trace. Deliberate escort, or
should it announce itself first?

**Q11 — What is the BONEYARD for, from the user's side?**
It appears in the level rail after a build, the master lives there, and the pitch
calls it central — but nothing in the UI ever sends a beginner there or explains
why they would go. Is it meant to be user-facing at all, or is it storage that
happens to be visible?

**Q12 — Is `SHAPE` ("CAPTURE WALL OUTLINE") supposed to be distinguishable from the HOUSE trace?**
A beginner reads "capture wall outline", draws the house outline with it, presses
the bone, and is told to press HOUSE first (first-contact §00:10). The two are
genuinely different objects and the error message is good. Is the collision in
naming known and accepted, or is SHAPE meant for something narrower that its
label oversells?

**Q13 — Should the free wallet gate exploration?**
Three bones, one per build, one per hour after that. My audit ran out in fifteen
minutes of ordinary poking. For a paying-customer beta that is the point; for a
first-time beginner who mis-traces twice, the third mistake costs them an hour.
Is 3 the number you want for a *new* browser, or is the seed meant to be higher
and the drip the throttle?

**Q14 — `pdf-img-mgr-shared` holds the user's drawing. Intentional?**
The IndexedDB database that stores every drawing is named after the PDF-underlay
tool it was borrowed from (`shared-file-store.js:3`). It works. But it means a
future "clear the PDF cache" feature, or any code that deletes that database by
name, deletes the user's house. Is renaming it worth a migration, or is the name
considered load-bearing history?

**Q15 — Do the helper seeds reflect a plan to change the defaults?**
`boneReveal: false` and `suggestStairs: false` are seeded for nearly every spec
so legacy tests do not see them (`tests/helpers.js:29-52`). That is either
temporary scaffolding until the specs are updated, or an admission that the
defaults are too intrusive to test against. Which — because if it is the former,
the combination coverage gap (AUDIT-FULL §7.2) has an owner and a date.

**Q16 — Should the garage be inside the AREAS total?**
`areas.js` tracks `garageSqFt` per level and then includes it in `netSqFt` and in
the building total; only the per-level row says "incl. garage". Most permit
applications want floor area *excluding* the garage, reported separately. Is the
current total the number the drafter is meant to copy onto the application, or
should the total exclude the garage and the dialog show it as its own line?

**Q17 — Is a bone press that overrides the tour meant to skip the stair silently?**
A mid-tour bone press builds both storeys and no stair, and the message lists
what it built without mentioning what it skipped (AUDIT-FULL §5b.2). Deliberate
("you overrode the escort, you own it") or an omission in the message?
