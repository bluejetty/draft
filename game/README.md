# game/ — TOY, the game

**Movie, 27 Oct 2026:**

> *"i am thinking of changing things and not having TOY MODE. i was thinking
> of using this program to create a 2nd program with only TOY MODE , and make
> a very simplistic GAME version of this programs"*
>
> *"and then if they create a house in the TOY MODE 'game' they can bring it
> over to this program and do more detailed work if they want"*

A separate program in its own folder, served at `/game/`. It loads the shared
pieces it needs from one folder up (`../wall-types.js`,
`../drawing-format.js`), the way `neighborhood/` does, and MODEL loads nothing
from here.

## Step 1 (this folder today)

- **WALL**: click, click, click. Every wall is square and a whole foot long,
  and every corner is on the 1' grid, so the grid is the snap. Pressing the
  run's start closes it; Esc, Enter, a double-click or a right-click ends it.
- **UNDO** (Ctrl+Z), **CLEAR**, right-drag to pan, the wheel to zoom.
- **SAVE .draft** writes MODEL's own format: a blank MODEL drawing (its five
  levels) with these walls on MAIN FL as centre-line 2x6, and the board
  written `toy`. **OPEN** in MODEL reads it like any other drawing.
- **OPEN** here reads MAIN FL's plan walls back from a `.draft`, and says how
  many it left behind.
- The browser keeps the house between visits as a convenience; the `.draft`
  file is its real home.

## Next steps

See the split plan: bones and unfinished runs, the 6" interior grid, wall
moves with the room, overhang and beam checks, BREAK / MOVE, cabinets in 6"
steps and the garage joining itself move here; then the game's own tools and
look; then TOY comes out of MODEL.

## Moving it to its own website later

Copy this folder and the shared files it loads with `../` alongside it. The
bridge to MODEL is the `.draft` file, which works across any two sites.

Spec: `tests/toy-game.spec.js` · gate: `proto/toy-game-mutants.js`.
