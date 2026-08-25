# Branching notes — through the 3D phase

Current practice, plus the staging shape proposed for 3D work. Short on
purpose: the rules that matter are the ones about what merges, not what
branches are called.

## How it works today

- **`main` is the deployed branch.** GitHub Pages serves it directly —
  there is no build step, so every merge to `main` is live immediately.
- Work happens on **feature branches**, one per batch (recent history:
  `devin/<timestamp>-<slug>`), merged to `main` by pull request.
- **The gate is the test suite**: the full Playwright suite (360 tests as
  of PR #81) green before merge. Tests land in the same PR as the
  behaviour they pin.
- **No force-pushing and no amending after push** on shared branches —
  no history rewriting. Fix forward with a new commit.
- Small PRs — one coherent batch per PR, reviewable in one sitting.

## For the 3D phase

3D work will have stretches where the model space is mid-surgery. The
plan:

- **`main` stays 2D-stable and deployable** at all times. Nothing merges
  to `main` that degrades the shipped 2D experience — the 360-strong 2D
  test baseline is the floor, and it only grows.
- **`3d-dev` is the integration branch** for the 3D track. Feature
  branches for 3D steps target `3d-dev`; it absorbs churn, and merges to
  `main` only at milestones that hold the full (2D + 3D) suite green.
- 2D fixes and the remaining 2D features (#116 among them) keep targeting
  `main` directly on feature branches, as today. `3d-dev` merges `main`
  forward regularly so the tracks never drift far.
- No `staging` branch unless deployment needs one: Pages serves `main`,
  and a preview of `3d-dev` can be a second Pages project or a local
  server. Add a third branch only when something actually deploys from
  it.

## Rules that survive any branch layout

1. Full suite green before merge — no exceptions, no "will fix in the
   next PR".
2. Old drawings open forever: any format change is additive with
   defaults (see ARCHITECTURE.md, drawing-format.js).
3. No structural reorganisation of MODEL.dc.html until #116 lands; the
   file split is its own reviewed change, never smuggled into a feature
   PR.
4. `npm audit --force` is banned — it upgrades across breaking versions.
   Audit fixes are deliberate, pinned, and tested.
