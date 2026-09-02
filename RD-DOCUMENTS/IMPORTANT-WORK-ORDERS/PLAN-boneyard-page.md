# PLAN — the BONEYARD page

The first page built the new way. It is also a page we want anyway, which is
the whole reason it goes first: nothing is migrated, nothing is redone, and if
the pattern turns out to be wrong we have still shipped a feature.

Read `HOW-THE-BONEYARD-WORKS.md` first — this plan builds what that document
describes and does not restate it.

---

## The one decision, and it is to decide nothing new

**No new framework.** The page is built exactly like `STANDARDS.html`.

Five pages already work this way — `index`, `PROJECT`, `SPECS`, `STANDARDS`,
`SETTINGS`, 2,597 lines of them, in production. Plain HTML, `<script src>` tags
in the head, one inline `<style>`, and every piece of thinking in a
`window.Draft*` module. There is nothing to learn and nothing new to depend on.

That answers "as similar as possible" better than any framework choice would.
The comparison that mattered was never DC against React; it was DC against
**the pages you already have that do not use DC**.

### What that buys, concretely

| | |
|---|---|
| **Same origin** | `localStorage` and IndexedDB are per-domain. The boneyard must read the drawing MODEL saves; on the same site it simply can. |
| **Free deploy** | `roughdrafter.com` rsyncs from `draft` main hourly. A new page at root ships with no new pipeline. |
| **Shared modules** | `drawing-format.js` and friends are *referenced*, not copied. They cannot drift. |
| **No one-file rule** | The 20,007-line constraint is a DC rule. It does not apply here. |

### Where it lives

`BONEYARD.html`, at the repository root, beside every other page. Not in a
subfolder — the sync copies the root, every other page is there, and matching
them is the point. No `.dc.` in the name.

---

## What is copied, what is shared, what is new

**Shared — referenced, never duplicated:**

```
drawing-format.js     the saved format, so we read the same drawing MODEL wrote
geometry-2d.js        geometry
profile-manager.js    standards and profiles
shared-file-store.js  the cross-page store
formatters.js         feet and inches
```

**Page furniture, copied from `STANDARDS.html` as-is:**

```
vendor/fonts.css      self-hosted type — do not reintroduce a font CDN
orientation-guard.js  landscape on working screens
traffic-counter.js    every page has it
the <style> block     Barlow, #f5f5f4, #1d1f20, #5980a6, the 52px topbar
```

**Already vendored, nothing to install:**

```
vendor/three-0.128.0.min.js
vendor/three-orbitcontrols-0.128.0.js
```

**New — three modules, all pure, all node-testable, none touching the DOM:**

```
wireframe-model.js    the master wireframe: levels, outlines, what sits above what
wireframe-iso.js      project the stack to 2D lines for one fixed viewing angle
wireframe-move.js     the movement rules — propagation and the cantilever ladder
```

Built in the `room-grow.js` mould, because that is what makes a node harness
possible: `if (!window.X)` guard, IIFE, tunables named at the top, frozen
export. Each gets a `proto/*-harness.js` that runs in node without a browser.

---

## Nothing comes over unexamined

**This is the rule that makes the whole thing worth doing.**

Movie's framing, and it is the right one: **it is moving house.** Every box gets
opened as it is carried, and it is kept or tossed right then. Nobody empties the
whole house onto the lawn to sort it — that is why a "two week deep clean" of
22,467 lines never starts. Carrying one module on the day the new page needs it
is a job that finishes.

Every module listed above is *good* code. It is also code written under a
deadline, against a board, with decisions taken in the moment and never
revisited because it worked. Copying it across unread would build the same app
with a different chassis, and there would be no point.

So: **before any module is referenced by the new page, it gets read and signed
off.** Not rewritten by reflex — read, and one of three verdicts:

| verdict | what happens |
|---|---|
| **Right as it is** | reference it, note that it was reviewed, move on |
| **Right but unclear** | improve the comment or the naming, in its own commit, on the old app where it still lives |
| **Wrong** | fix it properly — and the fix lands in the *old* app first, because that is where it is running today |

That third row matters. A fix found this way is a fix for the live site, not
just for the new page. The review pays twice.

The same gate applies to anything moved later, and to the design language
copied out of `STANDARDS.html`. Six "coming soon" promises and a duplicated
`framing` are already on the deep-clean list precisely because nobody looked
before carrying them forward.

**And it fixes the timing problem.** Reviewing 22,467 lines of MODEL in one
sitting is not a job anyone finishes. Reviewing one module on the day it is
needed is. The new page paces its own cleanup, and every piece arrives having
been looked at properly.

---

## The steps

One PR each. Suite green at every one. The site works after every one.
Stop after any step and nothing is half-built.

### 1. The shell

`BONEYARD.html` — topbar, two empty panes side by side, the shared `<script>`
tags, the copied style block. It loads, it looks like the rest of the site, it
does nothing.

*Proves:* the page exists, deploys, and the pattern holds. **Half a day.**

### 2. `wireframe-model.js`

Read the saved drawing's master outlines into a level stack: which levels
exist, each one's outline, which sits above which. Pure — a saved drawing in,
a structure out.

*Proves:* the new page can read what MODEL writes. **This is the step that
validates the whole plan**, and it is second on purpose. **1–2 days.**

### 3. `wireframe-iso.js`

Given the stack and one of N fixed camera angles, return the lines to draw.
Pure geometry, no canvas. Rotation steps to the next angle rather than
sweeping — the document is explicit that this is deliberate and simpler.

*Proves:* the maths, in node, before any pixel is drawn. **2–3 days.**

### 4. Draw the left window

Canvas, render the lines, arrow buttons step the angle. One colour per level.
Read-only — nothing can be changed yet.

*First time you see it.* **2–3 days.**

### 5. The right window, and the join

2D plan of the selected level. Clicking a coloured level in the 3D view
switches the right window to it. Still read-only.

*Proves:* the two windows agree. **2–3 days.**

### 6. `wireframe-move.js`

The movement rules from `HOW-THE-BONEYARD-WORKS.md`: outward push carries
everything above and eats overhang; inward brings everything with it; the
cantilever ladder walked backwards; the dead band. Pure, with a harness.

**This is the real work.** It is the part with genuine design content, it is
where the rules get tested against cases before any UI exists, and it should
be the step that takes longest. **1–2 weeks.**

### 7. Wire moving up

Drag in the 2D window, rules decide, both windows update. The consequence
appears on the 3D view as it happens — which the document is firm about:
the point is that a floor visibly gets shorter, not that a dialog says it will.

**3–5 days.**

---

## What this plan deliberately does not do

- **It does not touch MODEL.** MODEL keeps its own boneyard shelf strip, working
  as it does today, for as long as it takes. Nothing is removed until the new
  page does the job better.
- **It does not migrate LAYOUT.** That work stays where it is.
- **It does not commit to replacing anything.** If the boneyard page comes out
  well, replacing more becomes a decision made with evidence. If it comes out
  badly, we have a boneyard page and have lost nothing.
- **It adds no dependency.** Three.js is already vendored. Nothing else is needed.

## The rule that keeps it clean

`BRANCHING.md` rule 5 — **new logic starts in a module** — is why the layout
work survived this conversation intact, and it is the rule that makes this page
worth building. Every one of the three new modules is pure, node-testable, and
would survive being moved to any other page or framework.

That is the actual difference between the new page and the old one. Not the
framework. The discipline, applied from line one instead of retrofitted.
