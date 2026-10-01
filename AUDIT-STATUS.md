# AUDIT-STATUS.md — where every audit finding stands

Checked 1 Oct against `main` @ `2e558f5` (the audit was written at `75a3cd6`,
29 Aug). Each finding was re-read against today's code; the browser repros in
`audit-repros/` were re-run (31 pass, 3 fail — see the end).

**One thing changed under the whole audit:** the front door (`index.html`) now
opens `MODEL.html`, the rewrite. The audit was written against `MODEL.dc.html`,
and most fixes landed there and in the shared modules. Where a status differs
between the two pages it says so.

Legend: ✅ fixed · 🟡 partly fixed · ❌ open · ⚪ left as is on purpose (ruled) ·
❓ waits on an owner decision. Size: S = an hour or two, M = a day, L = more.

## Totals

| file | ✅ | 🟡 | ❌ | ⚪ |
|---|---|---|---|---|
| AUDIT-CRITICAL (16) | 9 | 4 | 2 | 1 |
| AUDIT-FULL (numbered findings) | 18 | 9 | 12 | 1 |
| AUDIT-PERF (actionable items) | 3 | 2 | 2 | — |
| AUDIT-QUESTIONS (17) | 13 answered | | 4 unanswered | |

## AUDIT-CRITICAL

| ID | finding | status | what's left | size |
|---|---|---|---|---|
| C1 | dimension strings don't add up | ✅ | — repro r10b: 0 of 400 strings drift | |
| C2 | no touch input | 🟡 | done on `MODEL.dc.html`; `MODEL.html` and LAYOUT have no pinch-zoom | M |
| C3 | LAYOUT overwrites MODEL's work | ✅ | — repro r1 passes | |
| C4 | undo only on the keyboard | 🟡 | `MODEL.html` has Ctrl+Z only: no redo, no on-screen UNDO/REDO | S |
| C5 | section floor band crosses the garage | ✅ | — (repro r13's pixel scan is stale; the drawing is right) | |
| C6 | rounding drops the roof from sections | ✅ | — repros r20–r25 pass | |
| M1 | overlay drawn at 1× | ⚪ | ruled deliberate (Q6) | |
| M2 | Google Fonts blocks startup | ✅ | — fonts self-hosted | |
| M3 | a placed viewport's scale can't change | ❌❓ | needs Q4 | S |
| M4 | `num()` turns null into 0 | ✅ | — repro r7 passes | |
| M5 | deleting a level orphans its things | ✅ | — repro r6 passes | |
| M6 | `offsetOutline` breaks on spikes and duplicate points | ❌❓ | still loses the overhang at a duplicated corner; spike/bowtie policy unruled | M |
| M7 | jog dimension lands where no wall stands | ✅ | — | |
| M8 | LAYOUT can't be used by touch | 🟡 | no pinch-zoom; deleting a viewport is keyboard-only | S–M |
| M9 | elevation recomputed every frame | 🟡 | 2× faster; the full-size view still has no cache | M |
| M10 | LAYOUT loses work when a save fails | ✅ | — | |

## AUDIT-FULL

| ID | finding | status | what's left | size |
|---|---|---|---|---|
| 1.1 | file store write not atomic | ✅ | | |
| 1.5 | two MODEL tabs overwrite each other | ✅ | | |
| 1.6 | endless bones in private browsing | ⚪ | by design | |
| 2.1 | duplicate level ids | 🟡 | `drawing-format.js` `levels()` still doesn't dedupe | S |
| 2.2 | fixtures left out of id recovery | ❌ | add `_fixtures` to the id spread | S |
| 2.3 | zero-length walls accepted | ✅ | | |
| 2.4 | ids near MAX_SAFE_INTEGER | ❌ | nit: reject unsafe ids | S |
| 3.1 | short partials dropped | ✅ | | |
| 3.2 | `wallBounds` pads a full wall each side | ❌ | nit: pad by reference line, or fix the comment | S |
| 3.3 | metric prints mm against an inch model | ✅ | | |
| 3.4 | `-0'-0"` printed | ❌ | nit: no sign on a zero | S |
| 3b.1 | garage counted in the area total | ✅ | | |
| 3b.2 | overlapping floors counted twice | ❌ | warn on overlap | M |
| 4.1 | level ids 3/5/7 hard-coded | ❌ | ~13 literals to replace with named lookups | M |
| 4.1b | "the PLAN plan" | ❌ | nit: wording | S |
| 4.2 | ADD LEVEL uses `window.prompt` | ❌ | in-app dialog + strict number parse | M |
| 5.1 | controls under 44px | 🟡 | touch-size spec runs on `MODEL.dc.html` only | M |
| 5.2 | iPad smart quotes break typed lengths | ❌ | `12’-6”` still refused — two `.replace` calls | S |
| 5.3 | status line cut off | 🟡 | `MODEL.html` fine; `.dc` only | S |
| 5.4 | buttons say "(ENTER)" on an iPad | 🟡 | `MODEL.html` fine; `.dc` only | S |
| 5.5 | tool palette pushes the canvas | ✅ | | |
| 5.6 | views painted under the cards | ✅ | | |
| 5.7 | no favicon | ✅ | | |
| 5b.2 | bone press mid-tour skips the stair | 🟡 | only reachable with the tour turned back on | S |
| 6.1 | no error containment in paint | 🟡 | `MODEL.html` fine; `.dc` only | S |
| 7.1 | font stall timeouts | ✅ | | |
| 7.2 | suite never runs real defaults | ✅ | | |
| 7.2b | auto-dims test title | ✅ | | |
| 7.3a,c,e,f,g,h | missing focused tests | ✅ | | |
| 7.3b | layout-plan scale math untested | 🟡 | add a harness check | S–M |
| 7.3d | load failure paths untested | 🟡 | seed a too-new / garbage file | S |
| 7.4 | fixed sleeps in tests (894) | ❌ | low; incremental | L |
| 8.1 | third-party request on every page | 🟡❓ | fonts gone, but a GoatCounter visit counter now pings on every page | decision |
| **8.2** | **markup from a drawing file reaches the page** | ❌ | **new since the audit: a level name, cut name or error text can inject script from a shared `.draft` file** (`MODEL.html` readout and notices, `EXTFINISH.html` roof list) | **S** |
| 8.4 | PDF scan caps width only | ❌ | cap the long side + null-check the blob | S |

## AUDIT-PERF

| item | status | what's left | size |
|---|---|---|---|
| §1 12.5 s font stall | ✅ | | |
| §2 elevation frame cost | 🟡 | cache the full-size silhouette | M |
| §2b every edit repaints every thumbnail | 🟡 | per-cut cache | M |
| §3 one 270 ms frame at 300 walls | ❌ | never profiled | S |
| §6 jspdf / pdf-lib unused | ✅ | removed | |
| §6 three.js + pdf.js on every open | ✅ on `MODEL.html` | `.dc` only | |
| §6 oversized PNGs | ❌ | several toolbar images are ~1 MB; re-encode | S |

## Questions still open

| Q | plain question |
|---|---|
| Q4 | Once a drawing is placed on a sheet, should you be able to change its scale? |
| Q7 | When sheets print, sharp vector lines or a high-resolution picture of the screen? |
| Q10 | Should the guided tour start by itself? (it's parked off today) |
| Q13 | Should a new user start with only 3 free bones, then one an hour? |
| 8.1 | Keep the GoatCounter visit counter, make it opt-in, or remove it? |
| M6 | A self-crossing or spiked outline: refuse it, warn, or allow it? |
| Q3 (leftover) | Is one dimension line covering two walls up to 2" apart OK? |
| `.dc` | Is `MODEL.dc.html` being retired? Several 🟡 rows only matter if it stays. |

## The repros, re-run

31 pass, 3 fail, and none of the three is a live defect:
- **r10b** crashes printing its "worst case" — there isn't one (0 of 400 strings drift). C1 fixed.
- **r12** fails at a button name that is now ambiguous (two DETACHED GARAGE buttons). Stale selector.
- **r13** fails its pixel scan: the scan picks up the floor-label text and the
  garage ceiling line. The section itself draws the floor bands stopping at the
  house wall with the garage on a slab — C5 fixed.
