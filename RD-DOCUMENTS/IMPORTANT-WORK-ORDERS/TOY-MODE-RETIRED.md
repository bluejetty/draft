# TOY MODE — retired 9 Nov 2026

TOY MODE, its board (`toy` / `drafting`), the mode-corner lamp, promotion on a
typed number, bones and the bone card, `toy-constraints.js`, `toy-context.js`,
the `game/` split and the three TOY work orders that lived here (TOY-MODE.md,
SPEC-toy-mode-constraints.md, GILLIGAN-TOY-BONES-WORKORDER.md) are all gone.

jb's ruling: *"completely remove TOY MODE from our project it causes more
problems, we can have those features like TSQUARE and 1FT engaged so that it
will be kindof like toy mode, but he can turn it off easy."*

What stands in its place:

- **T-SQUARE** and the **1 FT** light start ON in a fresh browser.
- One press on either chip turns it off; the page remembers the choice per
  browser (`draft-skin` in localStorage: `tsquare`, `footLight`).
- A typed length is always honoured, whatever the lights say.

Spec: `tests/lights-on-by-default.spec.js`. HANDOVER.md §0 has the detail.
The history is in git before this date if it is ever wanted again.
