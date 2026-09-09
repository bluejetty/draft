// BOARD #347 — the hit thresholds are named, and these are their values.
//
// A TRIPWIRE, NOT COVERAGE. Board #347 turned ten bare pixel literals in
// MODEL.dc.html's hit tests into eight named constants without changing one of
// them. The point of the naming was legibility; the point of THIS file is that
// the next change to a number is a deliberate, visible diff on a named line
// rather than a literal edited in passing. Retune a threshold and this goes
// red until someone updates the pin on purpose.
//
// WHY IT READS THE SOURCE. The constants are script-scope `const` declarations,
// so they are not properties of `window` and no page.evaluate can see them.
// Exposing them would be a code change, and this sweep changes nothing but
// names — so the pin reads the file, which is also the artefact a retune edits.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const SOURCE = fs.readFileSync(
  path.join(__dirname, '..', 'MODEL.dc.html'), 'utf8');

// name -> the value board #347 preserved, and the site(s) it was lifted from.
const PINNED = {
  // One Select click, three targets: nearest segment, dimension string, and
  // the locked S-FOOTING that exists only to explain a refusal at the same
  // reach. Moving one without the others makes the explanation untrue.
  SELECT_CLICK_PX: 14,
  // The roof editor's own pick. Equal to SELECT_CLICK_PX by coincidence of
  // value, not of meaning.
  ROOF_EDGE_HIT_PX: 14,
  // Picked inside the SAME _selectAt click as the three above, at a tighter
  // reach. Board #347 preserved the difference rather than resolving it.
  OUTLINE_EDGE_HIT_PX: 12,
  LINE_HIT_PX: 12,
  BONEYARD_MARK_HIT_PX: 12,
  // The host-wall ladder: how far each tool reaches for the wall it keys to.
  FIXTURE_WALL_PICK_PX: 30,
  STAIR_OPENING_WALL_PICK_PX: 24,
  FENESTRATION_WALL_PICK_PX: 18,
};

test.describe('board #347 — hit threshold pins', () => {
  test('every named hit threshold still holds the value it was named with',
    async () => {
      const found = {};
      Object.keys(PINNED).forEach(name => {
        const m = SOURCE.match(new RegExp(`^const ${name} = (\\d+);`, 'm'));
        expect(m, `${name} must be declared once, at top level`).not.toBeNull();
        found[name] = Number(m[1]);
      });
      // Compared as one object so a retune reports WHICH threshold moved and to
      // what, instead of stopping at the first name in alphabetical order.
      expect(found).toEqual(PINNED);
    });

  test('the hit tests use the names, not the numbers', async () => {
    // The literals these replaced were written as an inlined worldPerPixel:
    // `(this._orthoHalfH * 2) / h * N`. Any left in that form is a hit test the
    // sweep missed, or a new one added since without a name.
    //
    // FOUR ARE EXPECTED and are not hit thresholds: two flatten an arc that is
    // within ~4px of straight, and two ask whether the cursor CENTRE is on a
    // line (split it) or beside it (bend it). A fifth, `fpx * 19`, offsets a
    // dimension label. None answers "how close must the pointer be to grab
    // this", which is the only question board #347 renamed.
    const bare = SOURCE.split('\n')
      .map((line, i) => ({ line: line.trim(), n: i + 1 }))
      .filter(({ line }) => /\(this\._orthoHalfH \* 2\) \/ h \* \d+|\bfpx \* \d+/.test(line));

    expect(bare.map(b => `${b.n}: ${b.line}`).join('\n')).toMatch(/^(?:[^\n]*\n?){5}$/);
    bare.forEach(({ line, n }) => {
      expect(line, `line ${n} keeps a bare pixel literal — if it is a hit `
        + 'threshold it needs a name; if it is not, say so here')
        .toMatch(/\* 4;|\* 4\)|\* 19;/);
    });
  });
});
