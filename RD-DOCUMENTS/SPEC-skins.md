# SPEC — skins

Two brands, two light modes, four dashboards. Written 3 Sep from Movie's
ruling; **no code exists yet.** This note exists so that when the skins get
designed, the app is already shaped to receive them.

Movie's brief, verbatim in substance:

> I will need a night and day dashboards, and we will need 2 kinds — the
> RUFF DRAFTER (night/day) and the ROUGH DRAFTER (night/day). Ruff Drafter dog
> theme, Rough Drafter professional drafter theme. **4 total.**
>
> The Rough Drafter version we will change mainly through logos and colors but
> leave the bone terminology in some places will be ok.
>
> We can design them later, right — just need to insert the possibility now.

That last sentence is the whole job. **Insert the possibility. Design later.**

---

## 1 · The shape: two axes, not four skins

| | **night** | **day** |
| --- | --- | --- |
| **RUFF DRAFTER** (dog) | 1 | 2 |
| **ROUGH DRAFTER** (drafter) | 3 | 4 |

Four dashboards, but **two settings**, not one setting with four values:

```
theme: 'ruff' | 'rough'     — brand: logos, wordmark, accent hues, some copy
mode:  'night' | 'day'      — surface luminance: what is dark and what is light
```

Two axes because they are independent and will stay independent. A fifth brand
or a third mode costs one row or one column, not four new files. One enum of
four values costs a rewrite the first time either axis grows.

The night skin is already decided by taste: **black background, white and grey
lines, light grey floor** (Movie, 2 Sep). Day is its inverse, not a separate
design. Everything else is open.

---

## 2 · What was measured, before designing anything

Counts from `MODEL.dc.html` on 3 Sep. These are the reason the palette is a
**JavaScript module**, not a stylesheet.

| | count | distinct |
| --- | --- | --- |
| Hex colour literals, whole file | **743** | 68 |
| …of those, inside the `<style>` block | **59** | 14 |
| …of those, in JavaScript and markup | **684** | 61 |
| `rgba()` / `hsla()` calls | 493 | — |
| Inline `style="…#…"` attributes | 174 | — |
| `ctx.fillStyle` / `strokeStyle = '#…'` | 52 | — |
| **CSS custom properties defined** | **0** | — |
| Gradients or texture images | **0** | — |

`MODEL.html` (the new page) carries 15 literals, 10 distinct. `render-2d.js`
carries 8, `cut-view.js` 10.

**The finding that decides the design: 92% of the colour in MODEL is set from
JavaScript, not CSS.** A palette built as CSS custom properties alone would
reach 59 of 743 literals and leave the canvas — the actual drawing — unskinned.

> **Measurement trap, recorded so nobody repeats it.** A naive
> `grep -o '#[0-9a-fA-F]\{3,8\}'` returns 875, not 743. The extra 132 are board
> and PR numbers in comments — `#304`, `#198`, `#275` are valid three-digit
> hex. Filter `^#[0-9]\{3\}$` out. An earlier estimate in conversation said
> "235 flat backgrounds, ~42 named colours"; both numbers were wrong and are
> superseded by the table above.

---

## 3 · `palette.js` — one source, two consumers

A pure `window.DraftPalette` module in the house style (`if (!window.X)` guard,
IIFE, frozen export, runnable under `proto/*-harness.js`).

```js
window.DraftPalette = Object.freeze({
  ROLES,                       // the role names, frozen — the contract
  resolve(theme, mode),        // -> { role: '#rrggbb', … } for the painters
  toCSS(theme, mode),          // -> '--ink-primary: #…; …' for the stylesheet
});
```

Two consumers, one table:

- **CSS** — `toCSS()` writes the custom properties onto `:root` at boot. The
  `<style>` block's 59 literals become `var(--…)` and never change again.
- **Canvas** — `resolve()` returns a plain object the painters read. This is
  the 684. It arrives through the `env` argument `render-2d.js` already
  accepts, so the painters need a lookup, not a rewrite.

Colours never move between the two by hand. That is the whole point of the
module: a role has one definition, and both the panel and the drawing get it
from the same place.

---

## 4 · Roles, not colours

The palette is named by **what a thing is**, never by what colour it happens to
be — `--ink-dimension`, not `--white`. In day mode `--ink-dimension` is dark;
a token called `--white` would be a lie in half the skins.

Five families, and the count of distinct colours already in use (68) is the
upper bound on how many roles are needed — most of the 68 are near-duplicates
of each other and will collapse.

- **Surface** — page, panel, tray, button face, button armed, overlay scrim.
- **Ink** — primary, secondary, dimension text, warning, disabled.
- **Drawing** — grid minor, grid major, wall fill, wall line, floor, roof,
  stair, cut line, fixture, room tag.
- **State** — armed, selected, hover, error, under-minimum.
- **Brand** — accent, accent ink, logo ground. **These are the ones that
  actually differ between RUFF and ROUGH.**

Movie, 2 Sep: *"the texts and numbers will change, we will make them more
visible."* Ink is therefore its own family with its own contrast rule, not a
by-product of picking surfaces. Whatever contrast minimum gets chosen, it is
checked in `palette.js` under node — a skin that fails legibility should fail a
test, not a squint.

---

## 5 · Surfaces shaped so textures stay possible

Movie asked about *"changing the textures or colors of the dashboard
surfaces."* There are **zero** gradients and zero texture images in the app
today; every surface is a flat fill.

The cost of keeping textures possible is one extra token per surface, spent
now:

```css
.panel {
  background-color: var(--surface-panel);
  background-image: var(--surface-panel-tex, none);
}
```

Two properties, not the `background:` shorthand — the shorthand's layer list
parses differently with and without an image, and there is no reason to find
that out later. A skin that defines no `-tex` token renders exactly the flat
fill it renders today. A skin that defines one gets a texture with no code
change anywhere.

**Do this for the surface family only.** Ink and drawing roles are never
textured, and giving them the extra token is 40 dead lines.

---

## 6 · The bone terminology stays — in the code, permanently

Movie's ruling covers the visible half: Rough Drafter changes logos and
colours, and bone terminology surviving in places is fine.

The invisible half is not a choice at all. These are **persisted keys in every
saved drawing**:

```
boneyard  boneyardActive  boneyardLevelId
boneyardMarkGeometry  boneyardMarkPlacement
boneyardOutlines  boneyardShelves
```

Renaming any of them breaks every drawing a customer has saved. Standing rule:
**old drawings must keep opening.** So:

- **Internals stay dog-named forever**, under both themes. `boneyardShelves` is
  a storage key, not a word anyone reads.
- **Only user-visible strings are themed**, and only where a theme actually
  wants a different word.
- 560 dog-flavoured references exist in `MODEL.dc.html`. Almost all are
  internal. The themed set is small and should be listed explicitly when the
  skins are designed — a lookup of maybe a dozen strings, not a sweep.

If a rename ever does become worth it, it is a `drawing-format.js` migration
with an old-drawing test, on its own board, not a side effect of a skin.

---

## 7 · Order of work

1. **This note.** Done.
2. **`palette.js` + `MODEL.html`.** The new page has 15 literals. Tokenise it,
   prove both themes and both modes resolve, prove the CSS emission matches the
   JS resolution for every role. Small, self-contained, and it makes the module
   real before anything depends on it.
3. **Before tier 2 of `MODEL.html`.** Tier 2 builds dashboard chrome; chrome
   built against literals is chrome that gets rewritten.
4. **Painters, when tier 2 needs them to paint.** `render-2d.js` takes `env`
   already. Threading the palette through is shared-code work and waits until
   there is a caller.
5. **`MODEL.dc.html`'s 684 literals.** Its own job, its own session, after the
   skins are actually designed. **Not** part of inserting the possibility.

Steps 1–3 are hours. Step 5 is not, and conflating them is how "insert the
possibility now" turns into a week.

---

## 8 · Movie's brand direction, 3 Sep — recorded, not built

Given in conversation while looking at tier 1 on the live site. **No code
implements any of this yet**, by Movie's own call: *"I'll leave that stuff for
later, but make sure we can change it around easy."*

- **RUFF DRAFTER — red and white.**
- **ROUGH DRAFTER — blue and light grey.**
- **Gold on the length numbers**, and only there. *"They draw the eye nicely...
  but not anything else."* So the gold is a **functional** role, not a brand
  one — it means *this value is live*, and it does not change when the logo
  does.

Two measurements taken at the same time, because both constrain what can
actually be picked later.

**No single red clears WCAG AA on both grounds.** Contrast against the night
and day page colours:

| | on `#1d1f20` | on `#f2f2f3` |
| --- | --- | --- |
| `#c0392b` (already in the repo) | **3.04** | 4.86 |
| `#ef5350` | 4.75 | **3.12** |

That is arithmetic, not a bad palette: a mid-luminance colour cannot contrast
strongly with both black and white. **A brand colour is therefore a PAIR — a
lighter red on night, a deeper red on day** — which is what `THEME_OVERRIDES`
being keyed by mode already allows. Blue behaves the same way.

**And gold is a dark-ground colour.** `#f0b429` measures **8.88 on night** —
which is why it looks as good as it does on screen — and **1.67 on day**, which
is illegible. To survive into the day skin it has to deepen to roughly
`#8a6207` (4.90), still recognisably gold but closer to bronze. Movie, seeing
the numbers: *"you're right, it's no good on white."*

---

## 9 · What is deliberately not decided here

- The actual colours of any of the four skins.
- The logos and wordmarks.
- Which visible strings differ between RUFF and ROUGH.
- Whether the setting is per-device or travels in the profile package.
- Whether day or night is the default.

All of them are design decisions, and none changes the structure above. That is
the test of whether this note did its job.

**How a colour actually gets changed**, so that "easy" is a procedure rather
than a promise:

1. Edit the value in `BASE` or `THEME_OVERRIDES` in `palette.js`. Nowhere else.
2. Run `node proto/palette-harness.js`. It reports in about a second whether
   the new value is still legible on the ground it sits on.
3. Done. The stylesheet and the canvas painters both read that one table, so
   the chrome and the drawing move together and neither can drift from the
   other.
