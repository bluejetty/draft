# STAIR PLACEMENT DATABASE — Compiled from 9 research reports
### Rough Drafter keeper document · compiled 2026-08-29
### Feeds: stair-rules.js (future), build-house.js auto-place engine (#163/#260), #246 placement rework, #230 guided flow

---

## 0. PROVENANCE — read this first

Nine independent AI research syntheses, all answering the same prompt
(`/home/ubuntu/research-prompt-stair-layouts.md`):

| # | Source | Raw file | Size | Character |
|---|--------|----------|------|-----------|
| 1 | QWEN | raw-stairs-qwen.txt | 92 ln | Compact, confident single numbers |
| 2 | Mistral | raw-stairs-mistral.txt | 1003 ln | Longest, detailed framing rules |
| 3 | Claude Jr | raw-stairs-claudejr.txt | 510 ln | Careful framing language |
| 4 | Gemini 2 | raw-stairs-gemini.txt | 525 ln | OUTLIER on frequencies (U-shape #1) |
| 5 | Perplexity | raw-stairs-perplexity.txt | 678 ln | Ranges, explicitly labels values as inferred priors |
| 6 | GPT | raw-stairs-gpt.txt | 909 ln | Best engine architecture (3-layer model, scoring) |
| 7 | Kimi | raw-stairs-kimi.txt | 538 ln | Adds dogleg archetype, cost data |
| 8 | Grok | raw-stairs-grok.txt | 691 ln | Explicitly states shares are synthesized; stair-instance vs house distinction |
| 9 | DeepSeek | raw-stairs-deepseek.txt | 361 ln | Precise production dimensions; one claim corrected by user (§5) |

**CRITICAL CAVEAT:** every percentage in this document is a model-synthesized
estimate, NOT a measured census. Grok says it plainly: *"Shares below are
synthesized estimates (no public census of North American plan catalogs
exists)."* Perplexity: *"frequency shares and layout conventions are inferred
from typical North American production housing and code guides."* Treat all
shares as **priors / tie-breakers**, never as hard constraints. Code-derived
dimensions (IRC/NBC) must be verified against the actual code text before any
jurisdictional validation layer ships (§9 checklist).

Source categories the reports claim to draw on (claimed, not proven):
IRC (2021), NBC Canada (2020), Ontario BC, BC BC, Architectural Graphic
Standards, Time-Saver Standards, ICC commentary, CMHC wood-frame guidance,
builder catalogs (Lennar, D.R. Horton, Pulte, Toll Brothers, David Weekley,
Mattamy, Brookfield, Minto, Meritage, Jayman, Morrison, Lindal, Viceroy),
plan services (Houseplans.com, America's Best, Frank Betts, Drummond,
The Plan Collection).

---

## 1. STAIR SHAPE FREQUENCY — all nine, side by side

| Shape | QWEN | Mistral | Claude Jr | Gemini 2 | Perplexity | GPT | Kimi | Grok | DeepSeek |
|---|---|---|---|---|---|---|---|---|---|
| Straight | 45 | 38 | ~45 | (lower) | 45–55 | 35–45 | 35 | 30–40 | 50 |
| L-shape | 30 | 32 | ~30 | (2nd tier) | 25–35 | 25–35 | 28 | 25–35 | 30 |
| U / switchback | 15 | 18 | ~15 | **42 — #1** | 10–15 | 15–25 | 20 | 15–25 | 15 |
| Winders (L/U var.) | 5 | 7 | ~6 | — | 5–10 | 5–10 | 8 | 8–15 | 4 |
| Straight w/ mid-landing (dogleg) | — | — | — | — | 2–3 | — | **8 (own row)** | 2–5 | — |
| Spiral | <5 (combined) | 3 | <1 | — | <1 | 1–3 | 3 | <1 | <1 |
| Curved | (combined) | 2 | ~2 | — | 1–2 | — | 5 | <2 | <1 |
| Bifurcated | — | — | — | — | <1 | <1–2 | 1 | ≪1 | — |

**Consensus bands (ENGINE PRIORS — store these, not single numbers):**

| Shape | Prior band | Confidence | Notes |
|---|---|---|---|
| Straight | 35–50% | HIGH (8 of 9 rank it #1) | DeepSeek highest (50), Kimi/GPT/Grok lowest (~35) |
| L-shape | 25–35% | HIGH (all 9 rank it #2 or close) | Tightest agreement of any row |
| U / switchback | 15–25% | MEDIUM | Gemini's 42% #1 ranking is a 9-source outlier — recorded, not averaged in |
| Winders | 4–10% | MEDIUM | All agree: declining in new production, code-fussy |
| Dogleg (straight + mid-landing) | 2–8% | LOW | Only Kimi separates it; others fold into straight or L |
| Spiral | ≤3% | HIGH | Never primary stair in production |
| Curved | ≤2–5% | MEDIUM | Custom/luxury only |
| Bifurcated | <1% | HIGH | Exceptional custom case — exclude from auto-place |

**Grok's structural note (keep):** shares are of *stair instances*, not houses —
one house can carry two stairs of different shapes (main + basement).

**Selection drivers (converged across sources):**
- Straight: available run ≥ ~11' along a wall/hall; QWEN: run > 10'-6" and hall ≥ 3'-6".
- L: square-ish foyer, run doesn't fit straight, or to break the door-to-bedrooms sightline.
- U: narrow house (< ~24' wide), square footprints, compact vertical shaft, best stacker.
- Winders: last resort where a rectangular landing won't fit (renos, tight plans).

---

## 2. PLACEMENT RULES — consensus, with dissent noted

Frequency vocabulary (Perplexity's calibration, adopted):
**always** = design/code necessity · **usually** ≈ 60–90% · **sometimes** ≈ 10–40%.

### 2.1 Entry relationship
1. Main stair sits within ~10–15 ft of the front entry along the circulation path (Perplexity; echoed by all). — *usually*
2. Beside/adjacent to the foyer, NOT directly facing the door swing (QWEN: "immediately left or right of the foyer"; GPT scores "beside, rather than directly facing, front entry" +12). — *usually*
3. Bottom landing keeps ≥ 3'-0" from the door swing arc; 4'-6' preferred when facing the door (QWEN, Perplexity). — *always (code-ish) / preferred*
4. Split-entry/bi-level: stair directly behind the front door with the entry landing at mid-level — the defining feature. — *always for that type*
5. EXCEPTION — bungalows: the only stair is the basement stair; it goes near kitchen/mudroom/garage entry, NOT the formal foyer (QWEN, Perplexity, DeepSeek agree). — *usually*

### 2.2 Circulation / hall
6. Bottom landing opens into the main hall/circulation spine; stair width ≈ hall width (Perplexity). — *usually*
7. Top landing opens into (or IS) the upper hall; upper hall grows off the top landing (all sources; Grok explicit). — *usually→always*
8. Central-hall plans: stair is the terminus or origin of the hall, hall runs perpendicular to the flight (QWEN). — *usually*

### 2.3 Wall relationship
9. Hug interior walls, not exterior walls (insulation, window conflicts, stringer bearing) — QWEN "rarely hugs an exterior wall", Perplexity rule 3. — *usually*
   - **Our #246 rule already encodes the limit: opening may reach only to 5.5" (actual wall thickness) from the outside wall.**
10. L-stairs hug two perpendicular walls; U-stairs hug three (QWEN). — *usually*

### 2.4 Stacking (basement under main)
11. Basement stair stacks under the main stair. Claimed rates: QWEN 85% (straight) / 60% (L) / 90% (U); Kimi default-yes 70%; Mistral ~100% ("always" tone); Perplexity/Grok "usually". — *usually; store prior 0.7–0.9*
12. **TERMINOLOGY TO RESOLVE before coding:** "stacking" variously means (a) exact vertical footprint overlap sharing one rough opening, (b) same shaft/structural bay, (c) parallel-offset nearby. Sources don't distinguish. Engine should model (a) as the bonus case and (b) as partial credit. — *flagged in §9*
13. Break stacking only when a beam/ceiling-height conflict exists below (QWEN's L-shape note). — *sometimes*

### 2.5 Garage / mudroom
14. Primary stair stays near the front entry even when a garage-side secondary circulation loop exists (QWEN). — *usually*
15. Stair must not block the garage→kitchen path; prefer the stair opposite the foyer from the garage door (QWEN decision tree). — *usually*
16. Garage-first entries (mudroom plans): basement stair often lands near the mudroom/drop zone (multiple sources). — *sometimes→usually*

### 2.6 Landings
17. Landing depth ≥ stair width, min 36" (code, all sources). Production 3'-6" typical (DeepSeek).
18. U-stairs: intermediate landing ≥ 36" × full double-width box (min ~6'-0" wide shaft, QWEN).
19. Split-entry landing ≥ 4'-0" deep (door swings + coats, QWEN).

### 2.7 Storey-type variations
| Type | Rule |
|---|---|
| Bungalow | Basement stair only; utility placement (kitchen/mudroom/garage hall); straight preferred, over/beside the mid-span beam (DeepSeek) |
| Two-storey | Full ruleset above; foyer-adjacent main stair + stacked basement stair |
| Bi-level / split-entry | Straight up + straight down from entry landing; behind front door |
| Split-level | Short U/switchback runs navigating half-storeys (QWEN) |

---

## 3. STRUCTURAL / FRAMING — the joist-direction disagreement (PRESERVED, not averaged)

### 3.1 The two camps, as written
**"Parallel to joists" camp** — Claude Jr ("long dimension runs parallel to the
floor joist span, header joists doubled/tripled at each end"), Gemini (~90%),
GPT ("often"), Kimi (90%, "run direction PARALLEL to floor joists"),
Grok ("Prefer the long axis of the stairwell parallel to floor joists").
Logic: the well then trims only 1–2 joists; short headers.

**"Perpendicular to joists" camp** — QWEN ("always"), Mistral, Perplexity
(rule 5 "always"). Logic: headers land on bearing walls/beam.

**DeepSeek splits it:** ~60% perpendicular / 40% parallel.

### 3.2 Resolution (user + geometry, 2026-08-29)
The camps are largely describing the SAME favorable layout with opposite
vocabulary: joists usually span the short way onto the long mid-span beam, so
**a stair parallel to the beam = opening long-axis perpendicular to joists** —
and the beam gives those headers their bearing.

**USER'S DRAFTING RULE (engine default, labeled heuristic):**
> Prefer stair alignment **parallel to the governing beam** when the beam can
> receive/support the relevant header or landing condition.
Supporting echoes: Grok "park the stair beside the girder and bear headers on
it — never cut it"; Kimi "stair runs parallel to beam, beam at landing";
DeepSeek "highest-frequency placement runs perpendicular to the main mid-span
beam of the house… stair always over or beside the beam" (bungalow);
Gemini "long side abuts the beam". Matches our planned #246 beam-edge magnet
(soft pull to beam edge, typ 2" from beam centre; beam may move for the stair).

**USER'S CORRECTION (2026-08-29) — supersedes DeepSeek:**
> "parallel to joists doesn't req bearing wall only double header"
A well running parallel to joists is framed with doubled trimmers along its
long sides and short doubled headers at each end carrying the few cut tails;
trimmers span bearing-to-bearing like any joist. **No bearing wall below is
inherently required.** DeepSeek's bearing-wall-under-stringer claim conflated
opening framing with stair load support (and stringers normally hang off the
header anyway). Whether ADDITIONAL bearing is needed depends on actual spans,
loads, beam location, stringer support, and landing conditions — geometry
decides, not a slogan.

### 3.3 Engine consequences
- Do NOT store one boolean `parallelToJoists`. Keep separate fields:
  `travelDirection, stringerDirection, joistSpanDirection,
  roughOpeningLongDirection, headerDirection, trimmerDirection,
  beamDirection, bearingWallReferences`.
- Hard rule (all sources): **never cut the mid-span beam/girder with the well.**
- Soft preferences (scored, not forced): beside-the-beam alignment (primary,
  user's rule); joist-friendly opening orientation (secondary).
- Claude Jr's escape hatch (keep): with engineered I-joists/trusses the opening
  is designed at truss-design stage and placement is freer.

---

## 4. DIMENSIONS — production values, US/Canada kept separate

### 4.1 Production defaults (converged; DeepSeek most precise, others agree within range)
| Dimension | Production common | Range seen | IRC min (claimed) | NBC min (claimed) |
|---|---|---|---|---|
| Width (clear) | 42" (36" economy) | 36–48" | 36" | 34"–36" (860mm) |
| Riser | 7 1/2" | 7–7 3/4" | 7 3/4" max | 7 7/8" (200mm) max |
| Tread run | 10–10 1/2" | 9 1/2–11" | 10" min | 10" (255mm) min |
| Nosing | 1"–1 1/4" | 3/4–1 1/2" | 3/4–1 1/4" | max 1" typical |
| Headroom | 6'-10" | 6'-8"–7'+ | 6'-8" | **6'-10 1/2" (2050–2100mm)** |
| Landing depth | 3'-6" | 36" min | 36" | 36" (900mm) |

**Key US/Canada differences (all sources agree on direction):**
- NBC headroom is stricter (2100mm ≈ 6'-10.5" vs IRC 80") → Canadian stairs run slightly longer or use lower risers.
- NBC riser max slightly more generous (7 7/8" vs 7 3/4"), tread rules metric.
- NBC handrail graspability/continuity rules can eat usable width.
- **VERIFY exact section numbers against real code text before shipping validation (§9).**

### 4.2 Total run by floor-to-floor (straight run, no landings)
| Floor-to-floor | Risers | Treads | Run (DeepSeek exact) | Others' range |
|---|---|---|---|---|
| 8' nominal (~8'-1 1/8" actual) | 14 | 13 | 11'-4 1/2" | 10'-6"–11'-6" |
| 9' nominal | 16 | 15 | 13'-1 1/2" | 12'-0"–13'-6" |
| 10' nominal | 17–18 | 16–17 | 14'-0" | 13'-6"–15'-0" |

(QWEN's runs are shorter because it quotes runs including landing integration
differently — keep DeepSeek's riser math as the geometric baseline and verify
with our own stair tool's math, which already does riser math from level heights.)

### 4.3 Rough opening
- Straight-run opening length ~10'-6"–14' depending on floor height and headroom (QWEN, DeepSeek).
- Grok's formula (VERIFY before coding): `well_length ≈ (headroom + floor_thickness) × total_run / total_rise` plus finish/trimmer allowances.
- Our #72 board already plans headroom-driven opening length — this formula belongs there.

---

## 5. DECISION TREE — merged (QWEN's structure + everyone's refinements)

Inputs: `footprint {square, rect, long-rect, narrow<24', L, T, U}`,
`storeys {bungalow, two, bi-level/split}`, `entry {center, side, corner, rear, garage-first}`,
`garage {attached, detached, none}`, `floorToFloor`, `beamLines`, `joistDirection`.

```
IF bungalow:
    basement stair only → utility zone (kitchen/mudroom/garage hall)
    straight preferred, over/beside mid-span beam, stacking N/A
IF bi-level / split-entry:
    straight up + down from entry landing behind front door (landing ≥ 4' deep)
IF two-storey:
    IF narrow (<24'): try U centered/rear → else L on side wall
    ELSE by entry:
        center entry: straight beside foyer (L/R) → L if foyer < ~8'×8'
        side entry:  straight parallel to entry wall into central hall
    garage attached: keep stair clear of garage→kitchen path
    basement stair: stack under main unless beam/height conflict below
SHAPE FALLBACK LADDER (all sources): straight → L → U → winders (last resort)
```

**Candidate scoring (GPT's architecture, adopted as engine plan):**
Layer 1 planning priors → Layer 2 geometric feasibility (hard reject) →
Layer 3 jurisdictional validation (hard reject, separate US/Canada packs).
GPT's example weights (HEURISTIC SUGGESTIONS, not validated constants):
envelope fit: reject-if-false · code: reject-if-false ·
connects to central circulation +20 · beside (not facing) front entry +12 ·
stacks with basement stair +10 · joist-friendly +8 · terminates at bearing/beam +8 ·
mid-span transfer beam/post in circulation −20.

---

## 6. PLACEMENT ORDER — the dotted-stair-first sequence (USER'S DESIGN, 2026-08-29)

Resolves the stair↔room chicken-and-egg ("might depend on where you want top
step/landing and bottom step landing… maybe dotted stairs before the rooms"):

```
1. Place a PROVISIONAL (dotted) stair from room-independent anchors:
   entry position, beam/support lines, floor-to-floor rise, stacking guess.
2. Bottom landing anchors foyer/mudroom circulation.
3. Top landing anchors the upper hall spine.
4. Room program arranges around those anchors (#198/#275).
5. Re-score the stair after rooms: keep / fold to L or U / offset / reject.
6. Convert accepted candidate from dotted to firm geometry.
```
Two-pass, one direction each way — explainable, deterministic. Matches the
guided tour (#230) where stairs are already their own step.

---

## 7. DISAGREEMENT LEDGER (do not lose these)

| Topic | Split | Status |
|---|---|---|
| U-shape share | Gemini 42% #1 vs everyone else 10–25% #3 | Gemini treated as outlier; band 15–25 |
| Stacking rate | 60–100% claimed | Stored as 0.7–0.9 prior; terminology unresolved (§2.4.12) |
| Joist orientation | 5 parallel vs 3 perpendicular vs DeepSeek 60/40 | Resolved via beam-frame reinterpretation + user rule (§3.2) |
| Bearing wall under parallel-to-joists stringer | DeepSeek claims required | **CORRECTED by user: double header/trimmers suffice; not inherent** |
| Dogleg as own archetype | Only Kimi | Kept as sub-variant of straight |
| Run length per floor height | QWEN shorter than DeepSeek | Use our own riser math; research as sanity check |
| NBC min width | 34" vs 36" vs 860mm | VERIFY against NBC text |

---

## 8. ENGINE FIELD SCHEMA (proposed for stair-rules.js)

```
shape: {id, priorBand: [lo, hi], confidence, footprintReqs, fallbackRank}
placement: {hardConstraints[], softPreferences[{rule, weight, source, confidence}],
            penalties[], tieBreakers[]}
dimensions: {us: {...}, ca: {...}, production: {...}}   // never blended
directions: {travel, stringer, joistSpan, roughOpeningLong,
             header, trimmer, beam, bearingRefs[]}
provenance per rule: {sources[], confidence: HIGH|MED|LOW, verified: false}
```
All research values ship `verified: false` until §9 runs.

---

## 9. VERIFICATION CHECKLIST — before any of this becomes shipped validation

- [ ] Verify IRC section numbers + values (R311.7) against the actual 2021 text.
- [ ] Verify NBC 9.8 values (riser/tread/width/headroom in mm) against actual code.
- [ ] Provincial/state amendments (OBC, BCBC) parameterized separately.
- [ ] Determine whether ANY percentage came from a counted sample (assume no).
- [ ] Resolve "stacking" definition (§2.4.12) for the bonus scoring.
- [ ] Validate Grok's rough-opening formula against real stair geometry + our stair tool.
- [ ] Confirm framing terminology (header/trimmer/stringer bearing) with a framing reference.
- [ ] Keep US and Canada packs parameterized — never blended values.
- [ ] Unit tests against generated footprints once stair-rules.js exists.

---

## 10. STATUS

Research compile complete — 9/9 sources reconciled. No repository code written
or modified for this task (per instruction). Next implementation step (when
authorized): stair-rules.js data file + build-house.js auto-place rework
(#246/#260), sized as one work-order slice. Room research folds in later using
this same structure.
