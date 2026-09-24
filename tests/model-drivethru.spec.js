// GRUFF'S DRIVE-THRU on MODEL.html — the foot's bone and the sign.
//
// Movie, 15 Sep put two buttons and later an OUTLINE press in the middle of
// the foot; Movie, 16 Sep took them back out: "remove the two house buttons
// and keep the BONE button just go to the drivethru". So the BONE is the one
// press under the board now — it calls the sign up, and the drafter who
// wants to trace his own outline uses the OUTLINE command instead of a
// second button.
//
// WHAT THIS SUITE IS FOR, and it is not the picture. A menu that rises is
// easy to eyeball and easy to get subtly wrong in the two ways that cost
// something later:
//
//   - THE SIGN IS A WINDOW, NOT AN EDIT. Opening it to look at the board and
//     shutting it again must leave the drawing byte-identical. A popup that
//     marks a file dirty teaches the drafter to ignore the unsaved guard,
//     and then the guard is worth nothing on the day it matters.
//   - THE SECOND BONE IS THE SAME BONE. Two presses with one verb between
//     them; the moment the post's bone grows its own build path, the premade
//     designs get written twice and diverge. It fires the seam, or it is a
//     decoration.
//
// The board's cover is asserted in geometry rather than by eye, because
// covering the press that called it is the requirement and a sign that stops
// an inch short reads as a bug in the bar, not in the sign.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const REPRO = JSON.parse(fs.readFileSync(
  path.join(__dirname, '..', 'proto', 'repro-garage-house.draft'), 'utf8'));

// MODEL.html, reached the way every other MODEL.html spec reaches it: through
// openModel for its init scripts -- the seeded wallet, the parked features,
// the coach already seen -- and then a navigation to the page under test.
// THE SAME FIXTURE WITH NO BUILDING IN IT, for the checks that need an
// ORDER to reach the seam. ONE BUILDING PER DRAFT FILE (Movie, 24 Sep) means
// a press on a file that already holds a house does not build: it offers to
// save and start clean, which is model-one-building.spec.js's subject. The
// board, the tiles, the sign and every refusal above the cap behave the same
// either way, so only the tests that watch onOrder fire take this one.
//
// THE OUTLINES ARE WHAT MAKE A FILE FULL -- building-bodies.js counts bodies,
// and walls are not bodies -- so dropping them is the whole difference.
const NO_BUILDING = { ...REPRO, outlines: [] };

async function openWithNoBuilding(page) {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, saved }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(saved)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, saved: NO_BUILDING });
  await page.goto('/MODEL.html?mode=night');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
}

async function openPage(page) {
  await h.openModel(page, { webgl: false });
  // A DRAWING IN THE STORE, because MODEL.html reads the shared file and an
  // empty store gives "no drawing saved" -- a page with no drawing has no
  // build bar to put on the board.
  await page.evaluate(async ({ bucket, saved }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(saved)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, saved: REPRO });
  await page.goto('/MODEL.html?mode=night');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
}

// The rectangles, in page pixels, of the press the board must cover.
const boxes = async page => ({
  bone: await page.locator('#bone').boundingBox(),
  sign: await page.locator('#dt-frame').boundingBox(),
});

test('the foot bar: PROJECT and MODEL left, the bone in the middle, the sheets right',
  async ({ page }) => {
    await openPage(page);

    // THE THREE GROUPS IN ORDER, read off the bar itself. Asserted by group
    // rather than by one flat list because the arrangement IS the ruling --
    // the sheets went right so the middle could be two presses wide.
    expect(await page.locator('#page-row > *').evaluateAll(els => els.map(
      el => (el.textContent || '').trim().replace(/\s+/g, ' '))),
    'the foot\'s left end is the project, the page you are on, and the '
    + 'marketing plan that is a drawing of it')
      // AND RUFF/ROUGH WENT BACK UP (Movie, 17 Sep). It came down here on
      // 15 Sep and spent two days at the end of this group; the bottom bar is
      // pages and sheets again, with no switch on it at either end.
      .toEqual(['PROJECT', 'MODEL', 'REAL ESTATE LAYOUT']);

    expect(await page.locator('#sheet-row > *').evaluateAll(els => els.map(
      el => (el.textContent || '').trim().replace(/\s+/g, ' '))),
    'the sheets belong at the far right, in reading order')
      // NIGHT/DAY went up with it, so this group is the sheets alone.
      .toEqual(['CONSTRUCTION LAYOUT', 'SPECIFICATIONS', 'ESTIMATES']);

    // WHERE THEY WENT, asserted here rather than left implied. A pair that
    // vanished from the bottom bar and reached nowhere would pass both
    // assertions above, and the switch would simply be gone.
    //
    // THE ORDER IS THE RULING (Movie, 17 Sep): "put NIGHT DAY up beside
    // IMPERIAL METRIC ... and put the RUFF / ROUGH to the left of NIGHT DAY
    // before the last one which will be TOY DRAFTING". Read off the bar
    // left to right, the units included, because the units are the pair the
    // other three were told to match.
    expect(await page.locator('#units-corner, #mode-corner > .set')
      .evaluateAll(els => els.map(
        el => (el.textContent || '').trim().replace(/\s+/g, ' '))),
    'the four stacked pairs, in the order he gave them')
      .toEqual(['IMPERIAL METRIC', 'RUFF ROUGH', 'NIGHT DAY', 'TOY DRAFTING']);

    // The middle is the bone and nothing else (Movie, 16 Sep) -- DELETE,
    // COPY and PASTE live here too but are hidden until something is
    // selected, which is the shell's rule and not this suite's business.
    //
    // READ BY NAME, NOT BY EVERY CHARACTER ON IT. The press wears the bone
    // WALLET now (board #261, brought over 19 Sep), so its textContent is the
    // balance and then its name -- "5BONE" -- and a flat text read would fail
    // here for a number that is supposed to be there. The claim was never
    // about the characters: it is that the middle of the foot holds ONE
    // press. So each child answers with its spoken name where it has one.
    expect(await page.locator('#dt-bar > *:not([hidden])').evaluateAll(els => els.map(
      el => ((el.querySelector('.said') || el).textContent || '')
        .trim().replace(/\s+/g, ' '))),
    'the middle of the foot is the bone alone')
      .toEqual(['BONE']);

    // AND THE PAGES THAT ARE NOT BUILT ARE STILL DOWN. Moving a chip between
    // groups must not have quietly lit it.
    await expect(page.locator('#page-row [data-page="real-estate"]')).toBeDisabled();
    await expect(page.locator('#sheet-row [data-page="estimates"]')).toBeDisabled();
  });

// THE QUIET WAY OUT TO THE CONSTRUCTION DETAILS. Movie, 19 Sep: "on the
// bottom of the drivethru menu area (where display area is) we should put a
// button to the PROJECT area that says 'CLICK HERE TO GO OVER THE
// CONSTRUCTION DETAILS / SECTIONS FOR YOUR PROJECT'", then, before anything
// was built: "make it smaller text like don't draw attention to it, it will
// just be there for people who want to use it".
//
// QUIET IS THE REQUIREMENT, so quiet is what is measured -- smaller AND
// dimmer than the line it sits under, read off the computed style rather
// than trusted to a stylesheet nobody re-reads. A second call to action
// beside the bone would compete with the one thing this board is for.
test('the drive-thru offers the construction details without competing with the bone',
  async ({ page }) => {
    await openPage(page);
    await h.openDriveThru(page);

    const link = page.locator('#dt-project');
    await expect(link).toBeVisible();
    await expect(link).toHaveText(/CONSTRUCTION DETAILS/);
    // A PLACE YOU GO IS A LINK, the rule the page row at the foot already
    // teaches. A button that navigated would be a third control on this page
    // pretending to be a press when it is a door.
    await expect(link).toHaveAttribute('href', './PROJECT.html');

    const read = sel => page.locator(sel).evaluate(el => {
      const css = getComputedStyle(el);
      return { size: parseFloat(css.fontSize), opacity: parseFloat(css.opacity),
        events: css.pointerEvents };
    });
    const note = await read('#dt-note');
    const out = await read('#dt-project');
    expect(out.size, `the way out is ${out.size}px against the note's `
      + `${note.size}px -- it was asked to be smaller`).toBeLessThan(note.size);
    expect(out.opacity, 'and dimmer, so it does not read as the next step')
      .toBeLessThan(note.opacity);

    // THE SCREEN IS pointer-events:none so the board behind it stays a
    // picture. This line has to take its press back, and it is the only
    // thing in there that does.
    expect(out.events).toBe('auto');
    expect((await read('#dt-screen')).events).toBe('none');
  });

// ── THE DOG'S TEXT STAYS ON HIS BOARD ────────────────────────────────────
//
// Movie, 20 Sep, with a screenshot of the sign: "the text is coming off the
// top board". The way out to PROJECT had grown the screen a third line and
// the band on the 17 Sep art could not hold three -- so the drafter's own
// sentence ran off the bottom edge of the picture, clipped by an `overflow:
// hidden` that had been doing its job silently since the art before that.
//
// AND THE BUG IS INVISIBLE TO EVERY CHECK THAT READS TEXT. `toHaveText` and
// `toBeVisible` both pass on a line the box has cut in half: the node is in
// the DOM, it has a rectangle, and the string is exactly right. The only way
// to see it is to ask the box whether its contents fit, which is what
// scrollHeight against clientHeight is.
test('nothing the dog says falls off the bottom of his board',
  async ({ page }) => {
    await openPage(page);
    await h.openDriveThru(page);
    const fit = await page.locator('#dt-screen').evaluate(el => {
      const kids = [...el.children].map(k => {
        const r = k.getBoundingClientRect();
        return { id: k.id, bottom: r.bottom, right: r.right };
      });
      const box = el.getBoundingClientRect();
      return { scroll: el.scrollHeight, client: el.clientHeight,
        bottom: box.bottom, right: box.right, kids };
    });
    expect(fit.scroll,
      `the screen holds ${fit.scroll}px of text in ${fit.client}px of band`)
      .toBeLessThanOrEqual(fit.client);
    // AND EACH LINE INSIDE IT, because a flex column that centres its
    // children can push the first one out of the top while the total still
    // fits -- a different failure with the same screenshot.
    for (const kid of fit.kids) {
      expect(kid.bottom, `${kid.id} ends below the band`)
        .toBeLessThanOrEqual(fit.bottom + 0.5);
      expect(kid.right, `${kid.id} runs past the right of the band`)
        .toBeLessThanOrEqual(fit.right + 0.5);
    }
  });

// ── AND THE ZONES ARE STILL ON THE PICTURE THEY WERE MEASURED OFF ────────
//
// EVERY ZONE IS A PERCENTAGE OF THE ART, which makes the art and the CSS two
// halves of one fact -- and a fact in two places drifts. Movie has redrawn
// this board three times now, and the last one changed its SHAPE: 2000x1550
// landscape where the one before was 1020x1500 portrait. Percentages carried
// across that put the dog's speech on the shelf.
//
// SO THE CHECK ASKS THE IMAGE. Each zone's own corners are converted into
// pixels of the board file and read: the screen and the shelf must land on
// the black panels drawn for them, and the bone on the bare face of the post.
// It fails the moment either half moves without the other, and it names which
// zone.
//
// THE BONE'S HALF CHANGED SHAPE ON 20 Sep and the block over that check says
// why: the art painted a disc there, #dt-bone's own image stood on top of it,
// and a drafter saw two buttons. The disc came off the board, so there is no
// panel left to line the press up with -- and what replaced that measurement
// is the reason it was worth making, which is that the press is on the post.
test('the screen and the shelf sit on the panels drawn for them, the bone on a bare post',
  async ({ page }) => {
    await openPage(page);
    await h.openDriveThru(page);
    const verdict = await page.evaluate(async () => {
      const board = document.querySelector('#dt-board');
      await board.decode();
      const W = board.naturalWidth, H = board.naturalHeight;
      const c = document.createElement('canvas');
      c.width = W; c.height = H;
      c.getContext('2d').drawImage(board, 0, 0);
      const d = c.getContext('2d').getImageData(0, 0, W, H).data;
      const at = (x, y) => {
        const i = ((Math.round(y) * W) + Math.round(x)) * 4;
        return [d[i], d[i + 1], d[i + 2], d[i + 3]];
      };
      const frame = document.querySelector('#dt-frame').getBoundingClientRect();
      // The board fills the frame, so a zone's rectangle IS a rectangle of the
      // image: the same fractions, whatever size the sign is drawn at.
      const inImage = sel => {
        const r = document.querySelector(sel).getBoundingClientRect();
        return { x: (r.x - frame.x) / frame.width * W, y: (r.y - frame.y) / frame.height * H,
          w: r.width / frame.width * W, h: r.height / frame.height * H };
      };
      const dark = px => px[3] > 200 && px[0] < 60 && px[1] < 60 && px[2] < 60;
      // RED-DOMINANT RATHER THAN BRIGHT RED. This was written to FIND the
      // painted disc and is kept to make sure one never comes back: the disc
      // was a lit dome with the white bone across the middle of it, so its
      // centre pixel was a shaded 52,0,0 -- dark enough that a "bright red"
      // test calls it black, and red enough that no part of the black panel
      // could be mistaken for it. A repaint that puts any of that back under
      // the press is what this now catches.
      const red = px => px[3] > 200 && px[0] > 40
        && px[0] > px[1] * 2 + 20 && px[0] > px[2] * 2 + 20;
      // THE POST'S FACE: opaque, neutral, and neither the black panels above
      // it nor the dark air off the edge of the art. Measured on the board as
      // 143,143,143 under the press and 144-149 either side of it, so the
      // window is wide enough to survive a re-render of the same metal and
      // narrow enough that a press hanging off the board fails.
      const grey = px => px[3] > 200 && px[0] > 90 && px[0] < 210
        && Math.abs(px[0] - px[1]) < 12 && Math.abs(px[1] - px[2]) < 12;

      // ── THE PANEL THE ZONE IS STANDING ON, MEASURED ────────────────────
      //
      // TWO DRAFTS OF THIS CHECK WERE WRONG IN OPPOSITE DIRECTIONS, which is
      // worth recording because both looked right. The first only sampled
      // INWARD, and three mutants walked through it: the old portrait board's
      // figures for the shelf and the bone are strict SUBSETS of the panels
      // on this art, so every inward sample landed on black and the check
      // agreed while the cards sat in the middle of a strip twice their size.
      // The second sampled outward too and failed the real board -- it cannot
      // tell a deliberate one-percent inset from a wrong number, and the
      // frame between the band and the shelf is dark anyway.
      //
      // So the panel is MEASURED rather than probed: flood out from the
      // zone's own centre over pixels that match, and take what that region
      // actually spans. Then the question is the one worth asking -- is this
      // zone the same rectangle as the thing it is drawn on -- and the answer
      // has a number in it either way.
      //
      // SEEDED FROM FIVE POINTS, NOT FROM THE CENTRE. The disc has the white
      // bone drawn across its middle, and the exact centre of the button lands
      // on that glyph's edge -- so a single centre seed found nothing red at
      // all and the check reported the button was off the disc while it was
      // sitting exactly on it. The glyph also cuts the red into pieces, so the
      // five floods share one visited map and their extents are UNIONED: what
      // is wanted is how far the panel reaches, not how far one piece of it
      // does.
      //
      // THE DISC HAS SINCE COME OFF THE ART (below), so the five seeds now
      // serve only the two black panels -- which have cards and lettering
      // drawn on them and would break a single centre seed the same way.
      // Kept as the reason rather than trimmed to the case that is left:
      // the next panel with something painted across it needs this.
      const regionOf = (r, ok) => {
        const STEP = 2;
        const gw = Math.ceil(W / STEP), gh = Math.ceil(H / STEP);
        const seen = new Uint8Array(gw * gh);
        let x0 = 1e9, x1 = -1, y0 = 1e9, y1 = -1, found = false;
        const seeds = [[0.5, 0.5], [0.5, 0.15], [0.5, 0.85], [0.15, 0.5], [0.85, 0.5]];
        seeds.forEach(([fx, fy]) => {
          const gx = Math.round((r.x + r.w * fx) / STEP);
          const gy = Math.round((r.y + r.h * fy) / STEP);
          if (gx < 0 || gy < 0 || gx >= gw || gy >= gh) return;
          const k0 = gy * gw + gx;
          if (seen[k0] || !ok(at(gx * STEP, gy * STEP))) { seen[k0] = 1; return; }
          found = true;
          const stack = [k0];
          seen[k0] = 1;
          while (stack.length) {
            const k = stack.pop();
            const x = k % gw, y = (k - x) / gw;
            if (x < x0) x0 = x; if (x > x1) x1 = x;
            if (y < y0) y0 = y; if (y > y1) y1 = y;
            const push = (nx, ny) => {
              if (nx < 0 || ny < 0 || nx >= gw || ny >= gh) return;
              const j = ny * gw + nx;
              if (seen[j]) return;
              seen[j] = 1;
              if (ok(at(nx * STEP, ny * STEP))) stack.push(j);
            };
            push(x + 1, y); push(x - 1, y); push(x, y + 1); push(x, y - 1);
          }
        });
        if (!found) return null;
        return { x: x0 * STEP, y: y0 * STEP, w: (x1 - x0) * STEP, h: (y1 - y0) * STEP };
      };

      // TWO PERCENT OF THE BOARD, which is the slack the zones are written
      // with on purpose: the shelf is inset about a percent so a card does
      // not stand on its bevel. The portrait board's own figures are three to
      // twenty times that far out, so there is no question which side of this
      // line a stale number falls.
      const TOLX = W * 0.02, TOLY = H * 0.02;
      const out = [];
      const check = (sel, ok, what) => {
        const r = inImage(sel);
        const p = regionOf(r, ok);
        if (!p) { out.push(`${sel} centre is not on ${what} at all`); return; }
        const say = (name, a, b, tol) => {
          if (Math.abs(a - b) > tol) {
            out.push(`${sel} ${name} is ${Math.round(a)}, ${what} is ${Math.round(b)}`);
          }
        };
        say('left', r.x, p.x, TOLX);
        say('right', r.x + r.w, p.x + p.w, TOLX);
        say('top', r.y, p.y, TOLY);
        say('bottom', r.y + r.h, p.y + p.h, TOLY);
      };
      check('#dt-screen', dark, 'the dog-s black band');
      check('#dt-tiles', dark, 'the black shelf');

      // ── AND THE BONE STANDS ON A BARE POST ─────────────────────────────
      //
      // THE ART USED TO PAINT THE DISC AND #dt-bone STOOD ON TOP OF IT, which
      // is two buttons in one place and reads as two buttons. Movie, 20 Sep:
      // "there were 2 buttons showing so i deleted it from the drive thru
      // (keep the actual button in that spot)". The painted one came off the
      // artwork; the press did not move by a pixel.
      //
      // SO THERE IS NO LONGER A PANEL TO MEASURE THIS ZONE AGAINST, and the
      // claim splits into the two halves that outlive the art:
      //
      //   NOTHING RED UNDER IT   the painted twin is gone and must not come
      //                          back -- the failure the change was made for,
      //                          and the one a redrawn board would bring back
      //   THE POST UNDER IT      the press is on the post's face and not off
      //                          the board, which is the half the old check
      //                          was really buying with the disc
      //
      // A MARGIN, because a disc put back slightly off centre is the same
      // defect as one put back exactly. 1.5% of the board each way: the only
      // red left on this art is the speaker plate, and it starts 42px below
      // the press, so this reaches for it and stops clear.
      const bone = inImage('#dt-bone');
      const MX = W * 0.015, MY = H * 0.015;
      let painted = 0;
      for (let y = bone.y - MY; y <= bone.y + bone.h + MY; y += 2) {
        for (let x = bone.x - MX; x <= bone.x + bone.w + MX; x += 2) {
          if (x < 0 || y < 0 || x >= W || y >= H) continue;
          if (red(at(x, y))) painted += 1;
        }
      }
      if (painted) {
        out.push(`the art paints ${painted} red samples under #dt-bone -- `
          + 'the disc is back, and that is two buttons again');
      }
      // FIVE POINTS AND THE CORNERS PULLED IN A WHISKER. The press is a
      // circle in a square box, so its exact corner pixel is the most
      // fragile sample on it; 8% in is still well outside the disc art the
      // button itself draws and safely inside the box being checked.
      [[0.5, 0.5], [0.08, 0.08], [0.92, 0.08], [0.08, 0.92], [0.92, 0.92]]
        .forEach(([fx, fy]) => {
          const px = at(bone.x + bone.w * fx, bone.y + bone.h * fy);
          if (!grey(px)) {
            out.push(`#dt-bone at (${fx}, ${fy}) of itself is over `
              + `rgba(${px.join(',')}), which is not the post's face`);
          }
        });

      // ── AND THE PICTURE IS NOT STRETCHED ───────────────────────────────
      //
      // A SEPARATE FACT, and everything above is blind to it on purpose: the
      // zones are fractions of the FRAME and the image fills the frame, so a
      // wrong --dt-aspect distorts both together and every measurement still
      // agrees. What it breaks is the drawing -- a sign squashed to two
      // thirds of its width -- which nothing else here can see.
      const drawn = frame.width / frame.height;
      const real = W / H;
      if (Math.abs(drawn - real) > 0.01) {
        out.push(`the frame is drawn at ${drawn.toFixed(3)} and the art is ${real.toFixed(3)}`);
      }
      return { out, size: `${W}x${H}` };
    });
    expect(verdict.out,
      `zones off the ${verdict.size} board art`).toEqual([]);
  });

test('the sign rises from the foot and covers the bone', async ({ page }) => {
  await openPage(page);
  await expect(page.locator('#drivethru')).toHaveAttribute('data-shut', '');

  const down = await boxes(page);
  expect(down.sign.y, 'the sign is parked below the foot until it is called')
    .toBeGreaterThan(down.bone.y);

  await h.openDriveThru(page);
  const up = await boxes(page);

  // COVERS THE PRESS that called it, which was the requirement when the
  // middle held three presses and stays the requirement at one. Read as
  // containment of the bone's rectangle in the board's, so a sign that
  // rises but stops short of the bone fails here rather than in a squint.
  expect(up.bone.y >= up.sign.y
    && up.bone.y + up.bone.height <= up.sign.y + up.sign.height
    && up.bone.x >= up.sign.x
    && up.bone.x + up.bone.width <= up.sign.x + up.sign.width,
  'the board left BONE showing underneath it').toBe(true);

  // And it goes back down, leaving the foot as it was.
  await page.locator('[data-drivethru-close]').click();
  await expect(page.locator('#drivethru')).toHaveAttribute('data-shut', '');
  await expect(page.locator('#bone')).toHaveAttribute('aria-expanded', 'false');
});

test('the board carries the office\'s house types and its own bone',
  async ({ page }) => {
    await openPage(page);
    await h.openDriveThru(page);

    // THE TYPES ARE build-menu.js's TYPES, not a list painted on a board.
    // The sign is the build bar with a face; if it ever holds its own copy
    // of the menu, the two pages start disagreeing about what the office
    // builds, which is the duplication the module was lifted out to end.
    const fromModule = await page.evaluate(() =>
      window.DraftBuildMenu.BUILD_MENU.map(f => f.label));
    expect(await page.locator('#dt-tiles [data-build-family]').allTextContents(),
      'the board\'s tiles are not the module\'s families')
      .toEqual(fromModule);

    // Every home type Movie put on the board is reachable: the families plus
    // the entries underneath them. One basic example per type is the content
    // question and it belongs to build-menu.js; that they are all ORDERABLE
    // from the window is this suite's.
    for (const family of fromModule) {
      await page.locator(`#dt-tiles [data-build-family]`)
        .filter({ hasText: new RegExp(`^${family}$`) }).click();
      await expect(page.locator('#dt-tiles [data-build-entry]').first()).toBeVisible();
    }

    await expect(page.locator('#dt-bone')).toBeVisible();
  });

test('the dog talks the drafter through it, and says what was ordered',
  async ({ page }) => {
    await openPage(page);
    await h.openDriveThru(page);

    // GRUFF SPEAKS BEFORE HE IS SPOKEN TO. An empty screen on a board that
    // exists to guide is the whole feature missing.
    await expect(page.locator('[data-drivethru-line]')).not.toBeEmpty();

    await page.locator('#dt-tiles [data-build-family="bungalow"]').click();
    // The sign names the family it has just opened, so the screen and the
    // tiles cannot be showing two different things.
    await expect(page.locator('[data-drivethru-line]')).toContainText('BUNGALOW');

    const entry = page.locator('#dt-tiles [data-build-entry]').first();
    const ordered = (await entry.textContent()).trim();
    await entry.click();
    await expect(page.locator('[data-drivethru-line]')).toContainText(ordered);
  });

test('opening the window and shutting it again is not an edit', async ({ page }) => {
  await openPage(page);

  // THE FILE BEFORE, and the guard's own opinion of it.
  // SAVE is also the status word on this page (`data-save-status`), so the
  // guard's opinion is readable without a helper: the word plus the dirty
  // mark it wears.
  const clean = () => page.evaluate(() => {
    const save = document.getElementById('save');
    return `${save.textContent.trim()}|${save.className}`;
  });
  const before = await clean();

  await h.openDriveThru(page);
  await page.locator('#dt-tiles [data-build-family="bungalow"]').click();
  await page.locator('[data-drivethru-close]').click();
  await expect(page.locator('#drivethru')).toHaveAttribute('data-shut', '');

  // LOOKING IS NOT EDITING. Raising the board, opening a family to read what
  // is under it and dropping the board again touches no geometry and no
  // stored field -- so the unsaved guard must still say exactly what it said
  // before the drafter pulled up to the window.
  expect(await clean(), 'opening the drive-thru dirtied the drawing')
    .toBe(before);
});

test('the post\'s bone orders off the menu; the foot\'s builds what was drawn',
  async ({ page }) => {
    await openPage(page);
    await h.openDriveThru(page);

    // TWO BONES, TWO VERBS. Movie, 15 Sep: "the bone on the drivethru menu
    // will auto build the house that is provided for their selection... the
    // bone on the screen will be for if they draw their own OUTLINE".
    //
    // This suite used to assert the opposite -- one seam, two presses -- and
    // it was wrong about the feature, not about the code. Wired together,
    // the premade designs would land under a drafter who had traced his own
    // walls and pressed the bone beneath them, wiping the thing he drew. The
    // separation is the whole safety of the arrangement, so it is checked in
    // both directions: each press fires its own seam and NOT the other's.
    const tile = await h.undesignedTile(page);
    test.skip(!tile, 'every tile on the board now has a design');
    const seen = await page.evaluate(async tile => {
      const built = [];
      const ordered = [];
      window.ModelBuild.onBuild(p => built.push(p?.entry?.id ?? 'null'));
      window.ModelBuild.onOrder(p => ordered.push(p?.entry?.id ?? 'null'));
      document.querySelector(`#dt-tiles [data-build-family="${tile.family}"]`).click();
      await new Promise(r => setTimeout(r, 60));
      // AN UNDESIGNED TILE, DELIBERATELY, and asked for rather than named:
      // this test is about the PLUMBING -- each press firing its own seam and
      // not the other's -- and a tile WITH a design makes the board refuse the
      // order on this fixture, which already has houses. A refusal is the
      // right answer to that press and the wrong thing to measure here.
      //
      // It said `twoStorey` until 2 STOREY got a design, and `bungalow`
      // before that. The name was never the point.
      document.querySelector(`#dt-tiles [data-build-entry="${tile.entry}"]`).click();
      await new Promise(r => setTimeout(r, 60));
      const chosen = window.ModelBuild.chosen()?.entry?.id ?? 'null';
      document.getElementById('dt-bone').click();
      const afterPost = { built: built.length, ordered: ordered.length };
      // The foot's bone is under the board and disabled while the sign is
      // up; its verb is for a drafter standing at the drawing, so the board
      // is dropped before it is pressed.
      document.getElementById('dt-close').click();
      document.getElementById('bone').click();
      const afterFoot = { built: built.length, ordered: ordered.length };
      // AND THEN THE CARD'S OWN ANSWER, which is where the foot's verb went.
      document.querySelector('[data-build-choice-build]').click();
      await new Promise(r => setTimeout(r, 60));
      return { built, ordered, chosen, afterPost, afterFoot };
    }, tile);

    expect(seen.ordered[0], 'the sign\'s bone did not order the chosen design')
      .toBe(seen.chosen);
    expect(seen.afterPost.built,
      'the sign\'s bone reached the outline seam, which is the other bone\'s')
      .toBe(0);

    // THE FOOT'S BONE FIRES NEITHER SEAM NOW. Movie, 19 Sep: "on 1st press go
    // to drivethru questions and on 2nd always offer choice between drivetrhu
    // or house build". With a type already picked, that press ASKS -- so the
    // separation this test exists for is unchanged and the foot's verb simply
    // moved one press later, onto the card.
    expect(seen.afterFoot, 'the foot\'s press built something instead of asking')
      .toEqual(seen.afterPost);

    // AND THE CARD'S BUILD IS THE FOOT'S VERB: the drafter's own outline
    // first. Nothing was traced on this fixture, so it falls through to the
    // order -- which is the one place the two seams meet, and it meets them
    // in the safe direction. The hazard the separation guards against is a
    // premade design landing UNDER traced walls; here the traced walls win
    // and the design is the fallback.
    expect(seen.built, 'the card\'s BUILD did not reach the outline seam')
      .toEqual([seen.chosen]);
  });

// THE OUTLINE BUTTON RETIRED (Movie, 16 Sep): "i will add the OUTLINE part
// later in a different way (or they can just press the OUTLINE command
// normally)". The outline ROUND still exists in the page's `round` state —
// what left was its button, so the suite that pressed it left with it.

test('every tile is on the shelf and says its own name, card or no card',
  async ({ page }) => {
    // THE WIDTH THE SPILL HAPPENED AT. The cards are sized in vw, so a
    // narrow window shrinks them out of trouble and the check would pass on
    // a board it never looked at.
    await page.setViewportSize({ width: 1440, height: 900 });
    await openPage(page);
    await h.openDriveThru(page);
    // The submenu that spilled: BUNGALOW opens five entries under three
    // families, which is the widest the shelf ever gets.
    await page.locator('#dt-tiles [data-build-family="bungalow"]').click();
    await expect(page.locator('#dt-tiles [data-build-entry]').first())
      .toBeVisible();

    // THE SHELF, not the whole board: the black strip is where the orders
    // are printed, and a tile on the post or over Gruff's face is as lost as
    // one off the frame.
    const shelf = await page.locator('#dt-tiles').boundingBox();
    const tiles = page.locator('#dt-tiles button');
    const count = await tiles.count();
    expect(count, 'the board went empty').toBeGreaterThan(5);

    for (let i = 0; i < count; i += 1) {
      const tile = tiles.nth(i);
      const label = (await tile.textContent() || '').trim();

      // A TILE WEARING ART STILL SAYS ITS NAME. Movie's cards carry their own
      // lettering, so the words are clipped out of sight -- but a button
      // whose only name is a picture is a button a screen reader cannot read
      // and a check cannot find.
      expect(label, `a tile ${i} with no name`).not.toBe('');

      // ON THE BOARD, not past it. The card was sized at 62px and the open
      // submenu hung below the frame, where the drafter could see an order
      // and not press it.
      const box = await tile.boundingBox();
      expect(box.y + box.height,
        `the ${label} tile hangs off the bottom of the shelf`)
        .toBeLessThanOrEqual(shelf.y + shelf.height + 1);
      expect(box.y, `the ${label} tile rides up off the shelf`)
        .toBeGreaterThanOrEqual(shelf.y - 1);
      expect(box.x, `the ${label} tile hangs off the side of the shelf`)
        .toBeGreaterThanOrEqual(shelf.x - 1);
    }
  });

// THE CARDS ARE SQUARE AND ALL ONE SIZE. Movie, 24 Sep, third and final word
// on it: "these should all be the same size (a little bigger than the bottom
// ones) the top ones are a bit too big and they would look better matching
// sizes i think".
//
// THIS TEST HAS ASKED THREE DIFFERENT THINGS IN A DAY, which is worth leaving
// on the record rather than tidying away: first that the families were bigger
// with the submenu SHUT than open (true while both rows shared one 120px
// ceiling), then that the top row was half again the bottom, and now that they
// match. Each was right when it was written and each was replaced after he
// looked at the board. The check is equality now -- the one shape none of the
// earlier rules would have satisfied.
//
// MEASURED AS A RELATIONSHIP, not as pixels. A card's height tracks the board
// below its cap, so a fixed expectation would pin the test to one viewport.
//
// THE SAME 1440 THE SPILL HAPPENED AT, for the reason the test above says: the
// cards are sized off the board, so a narrow window shrinks them out of
// trouble and the check would pass on a board it never looked at.
test('the cards are square, every row the same size, and all of them on the shelf',
  async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openPage(page);
    await h.openDriveThru(page);
    const families = page.locator('#dt-tiles [data-build-family]');
    await expect(families.first()).toBeVisible();
    expect(await families.count(), 'the board went empty').toBe(3);

    await page.locator('#dt-tiles [data-build-family="bungalow"]').click();
    await expect(page.locator('#dt-tiles [data-build-entry]').first()).toBeVisible();

    const shelf = await page.locator('#dt-tiles').boundingBox();
    const art = async locator => {
      const box = await locator.locator('img').boundingBox();
      return box;
    };
    const top = await art(families.first());
    const bottom = await art(page.locator('#dt-tiles [data-build-entry]').first());

    // SQUARE, which is the ask a stretched card would fail while still being
    // the right height.
    expect(Math.abs(top.width - top.height),
      `a top card is ${top.width}x${top.height}`).toBeLessThanOrEqual(1);
    expect(Math.abs(bottom.width - bottom.height),
      `a bottom card is ${bottom.width}x${bottom.height}`).toBeLessThanOrEqual(1);

    // THE SAME SIZE, which is a change from what this asked an hour ago.
    // Movie, 24 Sep, after looking at the board: "these should all be the
    // same size ... the top ones are a bit too big and they would look better
    // matching sizes i think". It measured a 1.5-to-1.1 ratio before that, and
    // a 120px shared ceiling before THAT -- so the assertion is equality now,
    // which is the one shape none of the three earlier rules would satisfy.
    expect(Math.abs(top.height - bottom.height),
      `top ${top.height} against bottom ${bottom.height}`).toBeLessThanOrEqual(1);

    // AND BOTH ROWS STILL CLEAR THE SHELF, which is what caps them. This is
    // the check the sizes were chosen against: 2.6 rows plus a gap inside
    // 294px.
    const entries = page.locator('#dt-tiles [data-build-entry]');
    const last = await entries.nth(await entries.count() - 1).boundingBox();
    expect(last.y + last.height,
      'the submenu hangs off the bottom of the shelf')
      .toBeLessThanOrEqual(shelf.y + shelf.height + 1);
  });

test('the board is a picture with live cards on it, and nothing else takes a press',
  async ({ page }) => {
    // AN OVERLAY THAT SWALLOWS PRESSES HAS COST THIS PROJECT TWICE, and
    // gruff-drivethru.spec.js opens on that sentence for the other board. This
    // one earned the same check the hard way: the shelf was declared
    // `#dt-tiles > * { pointer-events:auto }`, and `> *` is #build-bar -- a
    // flex COLUMN, not a control, spanning the shelf corner to corner. So the
    // gaps between cards, and the strip of shelf either side of them, took
    // presses meant for the sheet underneath and gave the drafter nothing.
    //
    // THE CARDS THEMSELVES ARE A DIFFERENT QUESTION and are asked about at
    // the end: a card is a control, and a press on one is the card's. What is
    // wrong above is the GROUND they stand on answering for them.
    await page.setViewportSize({ width: 1440, height: 900 });
    await openPage(page);
    await h.openDriveThru(page);
    await page.locator('#dt-tiles [data-build-family="bungalow"]').click();
    await expect(page.locator('#dt-tiles [data-build-entry]').first())
      .toBeVisible();

    // WHAT THE BROWSER SAYS IS ON TOP, which is the crispest statement of
    // "this zone is decorative" there is -- and it reads the same rule the
    // press would.
    const at = (x, y) => page.evaluate(({ cx, cy }) => {
      const el = document.elementFromPoint(cx, cy);
      if (!el) return 'none';
      if (el.closest('#dt-tiles button')) return 'card';
      if (el.closest('#dt-close')) return 'close';
      if (el.closest('#drivethru')) return `board:${el.id || el.tagName}`;
      if (el.id === 'plan') return 'sheet';
      return `other:${el.id || el.tagName}`;
    }, { cx: x, cy: y });

    const board = await page.locator('#dt-frame').boundingBox();
    const shelf = await page.locator('#dt-tiles').boundingBox();
    const bar = await page.locator('#build-bar').boundingBox();

    // THE ART ITSELF: the frame down the side of the screen, and the band
    // between the screen and the shelf. Both are paint, and a press on paint
    // belongs to the sheet. The very TOP of the board is not asked about --
    // the instrument strip is fixed over it, and that one is real chrome.
    expect(await at(board.x + 6, board.y + board.height * 0.25),
      'the board frame took a press').toBe('sheet');
    expect(await at(board.x + board.width / 2, shelf.y - 8),
      'the band above the shelf took a press').toBe('sheet');

    // THE SHELF EITHER SIDE OF THE CARD ROW -- which is the exact ground the
    // old rule lost. #build-bar is the shelf's full width by design (it is
    // what centres the rows on it), so this point is inside the container and
    // outside every card: under the old rule it was the container's, and the
    // sheet never heard it.
    const card = await page.locator('#dt-tiles button').first().boundingBox();
    expect(card.x, 'the cards reach the edge of the bar, so this proves nothing')
      .toBeGreaterThan(bar.x + 8);
    expect(await at(bar.x + 3, card.y + card.height / 2),
      'the shelf beside the cards took a press').toBe('sheet');
    expect(shelf.width, 'the bar stopped spanning the shelf')
      .toBeGreaterThanOrEqual(bar.width - 1);

    // AND THE CARDS DO TAKE THEIRS. Everything above is only worth having if
    // the controls still work, which is the half a careless fix for this
    // breaks: pointer-events:none on the container and nothing put back.
    expect(await at(card.x + card.width / 2, card.y + card.height / 2),
      'a card went decorative with the shelf').toBe('card');
    const close = await page.locator('#dt-close').boundingBox();
    expect(await at(close.x + close.width / 2, close.y + close.height / 2),
      'the close cross went decorative').toBe('close');
  });

test('the bone lights first, and the sign follows it up',
  async ({ page }) => {
    await openPage(page);
    const press = page.locator('#bone');
    const sign = page.locator('#drivethru');

    // MOVIE, 15 Sep: "change the button to light up for about 2 seconds
    // before the drivethru menu appears". The light is the acknowledgement
    // -- a press that does nothing visible for two seconds reads as a dead
    // button, and the drafter presses it again.
    await press.click();
    await expect(press).toHaveAttribute('data-lit', '');
    await expect(sign, 'the sign came up without the button lighting first')
      .toHaveAttribute('data-shut', '');

    // A SECOND PRESS MID-GLOW IS NOT A SECOND ORDER.
    await press.click();
    await expect(press).toHaveAttribute('data-lit', '');

    await expect(sign).not.toHaveAttribute('data-shut', '', { timeout: 5000 });
    // AND IT STAYS LIT NOW, which is the reverse of what this line used to
    // say. It read "the light goes out once the board is up; a button still
    // glowing under an open sign is a button that looks like it is still
    // working" -- and on 17 Sep Movie asked for exactly that: "when the
    // blueprint is showing the blue house button should be light and when it
    // goes down unlit".
    //
    // THE OLD WORRY IS ANSWERED RATHER THAN OVERRULED. It is still working:
    // ROUGH's sheet rides above the bar and leaves this press standing, and
    // it is the press that builds what you picked off the board. RUFF's sign
    // covers it, so there the light is under the board and nobody reads it
    // either way.
    await expect(press).toHaveAttribute('data-lit', '');

    // And out when the board goes down, which is the edge that carries the
    // meaning now.
    await page.locator('[data-drivethru-close]').click();
    await expect(sign).toHaveAttribute('data-shut', '');
    await expect(press).not.toHaveAttribute('data-lit', '');
  });

// ── ARRIVING THROUGH THE FRONT DOOR ──────────────────────────────────────
// Movie, 15 Sep: "when they enter into the model area from the front entry
// screen the drivethru should pop up after about 2 seconds."
//
// THE FLAG IS THE POINT OF THESE TWO. A board that rises on arrival and a
// board that rises on every load look identical the first time and differ
// every time after, on a drafter who is mid-drawing -- which is the version
// that costs a press. So both halves are asserted: it rises from the entry
// screen, and it stays down on a plain load and on the reload after.
test('coming in from the front screen, the board rises by itself',
  async ({ page }) => {
    await h.openModel(page, { webgl: false });
    await page.evaluate(async ({ bucket, saved }) => {
      await window.SharedFileStore.saveSharedFile(
        new File([JSON.stringify(saved)], 'drawing.json', { type: 'application/json' }), bucket);
    }, { bucket: BUCKET, saved: REPRO });

    await page.goto('/MODEL.html?from=entry');
    await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });

    // Same two seconds as the press: the bone glows first, then the board.
    await expect(page.locator('#bone')).toHaveAttribute('data-lit', '');
    await expect(page.locator('#drivethru'))
      .not.toHaveAttribute('data-shut', '', { timeout: 5000 });

    // THE FLAG IS SPENT AS IT IS READ, so the reload lands in the drawing.
    expect(new URL(page.url()).searchParams.get('from'),
      'the arrival flag stayed in the address and will fire again on reload')
      .toBe(null);
    await page.reload();
    await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
    await page.waitForTimeout(3000);
    await expect(page.locator('#drivethru'),
      'the board rose again on a reload, over a drafter already at work')
      .toHaveAttribute('data-shut', '');
  });

test('a hand on the page inside the two seconds calls the board off',
  async ({ page }) => {
    await h.openModel(page, { webgl: false });
    await page.evaluate(async ({ bucket, saved }) => {
      await window.SharedFileStore.saveSharedFile(
        new File([JSON.stringify(saved)], 'drawing.json', { type: 'application/json' }), bucket);
    }, { bucket: BUCKET, saved: REPRO });

    await page.goto('/MODEL.html?from=entry');
    await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
    await expect(page.locator('#bone')).toHaveAttribute('data-lit', '');

    // Someone who starts drawing inside the glow has said what they came
    // for; the board rising over them would take the press they were making.
    await page.mouse.click(400, 300);
    await page.waitForTimeout(3000);
    await expect(page.locator('#drivethru'),
      'the board came up over a drafter who had already started')
      .toHaveAttribute('data-shut', '');
    await expect(page.locator('#bone')).not.toHaveAttribute('data-lit', '');
  });

// ── THE BONE WITH NOTHING BEHIND IT ──────────────────────────────────────
// Movie, 15 Sep: "what happens if they are in model area and they press the
// bone if no outline?" then "take them to the full house flow (not the
// outline flow) if there isn't a house and detached garage already... it
// will do nothing once both house and garage both made."
//
// It used to be nothing at all -- the seam fired with a null choice and the
// screen said not one word, which reads as a dead bone.
test('the bone with nothing chosen opens the house round, not the outline one',
  async ({ page }) => {
    await openPage(page);

    const fired = await page.evaluate(() => {
      const seen = [];
      window.ModelBuild.onBuild(p => seen.push(p));
      document.getElementById('bone').click();
      return seen.length;
    });
    // THE EMPTY PRESS REACHES NO SEAM AT ALL NOW, and that is the ruling
    // rather than a regression. Movie, 19 Sep: "on 1st press go to drivethru
    // questions". It used to call the build seam first and open the board
    // only when that served nothing; a press that cannot build should not be
    // asking the geometry side whether it can. What the press DOES is
    // asserted below -- the board, and the reason.
    expect(fired, 'the first press asked the build seam instead of opening the board')
      .toBe(0);

    await expect(page.locator('#drivethru'))
      .not.toHaveAttribute('data-shut', '', { timeout: 5000 });
    await expect(page.locator('[data-drivethru-line]')).toContainText('NOTHING TO BUILD');

    // THE HOUSE ROUND, NEVER THE OUTLINE ROUND. A drafter who pressed the
    // bone asked for a house, not for a drawing lesson -- and the round is
    // invisible until the bone on the post is pressed, so it is read off
    // the seam rather than off the board.
    const tile2 = await h.undesignedTile(page);
    test.skip(!tile2, 'every tile on the board now has a design');
    const round = await page.evaluate(async tile => {
      const seen = [];
      window.ModelBuild.onOrder(p => seen.push(p?.round ?? 'none'));
      document.querySelector(`#dt-tiles [data-build-family="${tile.family}"]`).click();
      await new Promise(r => setTimeout(r, 60));
      // An undesigned tile again, for the same reason as the seam test above:
      // the ROUND is what this measures, and a designed tile is refused on
      // this fixture before the order is ever fired.
      document.querySelector(`#dt-tiles [data-build-entry="${tile.entry}"]`).click();
      await new Promise(r => setTimeout(r, 60));
      document.getElementById('dt-bone').click();
      return seen;
    }, tile2);
    expect(round, 'the bone sent the drafter down the guided trace he did not ask for')
      .toEqual(['menu']);

    // AND THE REFUSAL IS SPENT, not stuck on the board behind the choice
    // that answers it.
    await expect(page.locator('[data-drivethru-line]')).not.toContainText('NOTHING TO BUILD');
  });

test('with a building already standing, the board still rises',
  async ({ page }) => {
    // THIS TEST SAID THE OPPOSITE UNTIL 24 SEP, and the reversal is the rule
    // rather than a change of mind about the board. It read "with a house and
    // a detached garage already standing, the bone does nothing": the cap was
    // one house AND one detached garage, both standing meant nothing was left
    // to build EVER, and Movie's rule for the bone was "it will do nothing
    // once both house and garage both made". A board rising over a spent
    // project wasted the press it had just taken.
    //
    // ONE BUILDING PER DRAFT FILE gives "full" a different meaning: not
    // "nothing left to build" but "this file has its building". The drafter
    // can still have another in a file of its own, so the press is no longer
    // spent -- it leads to the offer to save this drawing and start clean.
    // A board that would not open would put that offer behind a dead button
    // and give him no way to find out why.
    //
    // WHAT THE PRESS THEN DOES is model-one-building.spec.js's subject. What
    // is checked here is only the board's half: it opens, and the bone stays
    // live to be pressed again.
    await h.openModel(page, { webgl: false });
    const full = JSON.parse(JSON.stringify(REPRO));
    // The fixture's garage is ATTACHED, which is part of the house and does
    // not spend the detached slot -- so the drawing is completed here by
    // detaching the garage master, the way the shelf records it.
    full.boneyardOutlines.find(m => m.garage).detached = true;
    await page.evaluate(async ({ bucket, saved }) => {
      await window.SharedFileStore.saveSharedFile(
        new File([JSON.stringify(saved)], 'drawing.json', { type: 'application/json' }), bucket);
    }, { bucket: BUCKET, saved: full });
    await page.goto('/MODEL.html?mode=night');
    await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });

    await page.locator('#bone').click();
    await expect(page.locator('#drivethru'),
      'the board stayed shut, so the offer is behind a dead button')
      .not.toHaveAttribute('data-shut', '');
    await expect(page.locator('#build-families button').first()).toBeVisible();
  });

// ── HOW BIG IS THE GARAGE ────────────────────────────────────────────────
// Movie, 15 Sep: "we could make a detached garage and even allow them to
// enter the size give them choices 16x24 24x26 25x25 (or 4th option allow
// them to enter ___FT X ___FT)".
//
// THE SIZE ROW IS ON THE SIGN, NOT A SECOND SUBMENU. The board is "only 1
// submenu each" (Movie, 6 Sep), and the fourth option is two fields, which
// a tile cannot carry.
const openGarage = async page => {
  await h.openDriveThru(page);
  await page.locator('#dt-tiles [data-build-family="detachedGarage"]').click();
  await page.locator('#dt-tiles [data-build-entry="detached-thickened"]').click();
};

// THE BOARD STOPPED ASKING HOW BIG on 24 Sep -- Movie: "for DETACHED GARAGE
// lets make DEFAULT size now 24X24 (don't offer a size for now)" ... "for the
// Drive Thru Menu" ... "default size could be 24x26 if that size is done
// already". Every garage it builds is now the shelf's own 24x26.
//
// THE QUESTION IS WITHDRAWN, NOT DELETED, and so are these checks. The row,
// the three tiles, the typed fourth option and the refusal that guards an
// empty one all still exist and all still work; ?sizes=ask puts them back in
// front of the drafter so the five checks below go on measuring them. The day
// the question returns, they say whether it still holds -- which is the whole
// reason for not deleting them.
const ASK_SIZES = '&sizes=ask';
const openPageAsking = async page => {
  await openPage(page);
  await page.goto('/MODEL.html?mode=night' + ASK_SIZES);
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
};
const openAskingWithNoBuilding = async page => {
  await openWithNoBuilding(page);
  await page.goto('/MODEL.html?mode=night' + ASK_SIZES);
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
};

// AND THE DEFAULT IS WHAT AN UNASKED DRAFTER GETS. This is the new path and
// the one a drafter actually walks: two presses, no third question, and a
// garage on the sheet.
// THE CARDS ARE THE BOARD'S WORDS AS MUCH AS THE LABELS ARE, and they can
// disagree with them silently: a tile whose picture says one thing under a
// label saying another throws nothing, breaks nothing, and reads as finished.
// That is exactly what the bungalow ENTRY did -- it borrowed the FAMILY's
// card, so the submenu opened BUNGALOW beneath its own label reading 1 STOREY
// (Movie, 24 Sep: "the 2nd lvl down should say 1 STOREY - (not BUNGALOW)" and
// "one on top should stay BUNGALOW").
//
// ONE ID IS TWO TILES, which is the whole reason it happened: `bungalow` is a
// family AND its first entry, so one table could not hand them different
// cards. Checked here rather than left to the eye, because the next family to
// share a name with one of its entries fails the same way and just as quietly.
test('the bungalow family and its 1 STOREY entry wear different cards',
  async ({ page }) => {
    await openPage(page);
    await h.openDriveThru(page);
    const src = sel => page.locator(`${sel} img`).getAttribute('src');

    const family = await src('[data-build-family="bungalow"]');
    await page.locator('#dt-tiles [data-build-family="bungalow"]').click();
    const entry = await src('[data-build-entry="bungalow"]');

    expect(family, 'the family tile stopped saying BUNGALOW')
      .toContain('house-bungalow');
    expect(entry, 'the entry tile is not the 1 STOREY card').toContain('1storey');
    expect(entry, 'the entry borrowed the family-s card again').not.toBe(family);
  });

// AND EVERY CARD ON THE BOARD RESOLVES. A path with a typo -- the .jpg among
// the .jpegs is one keystroke from it -- leaves a tile with no picture and no
// error, which the fallback used to hide by printing the label instead. It no
// longer does, because the tile has a card; it just has a blank one.
test('no tile on the board is wearing a card that does not load',
  async ({ page }) => {
    await openPage(page);
    await h.openDriveThru(page);
    // WALKED OFF THE MODULE, not off a list written out here. The first draft
    // of this named 'twoStorey' as a family and sat three minutes waiting for
    // a tile that has never existed -- it is an ENTRY under bungalow. Asking
    // build-menu.js means the sweep covers whatever the board actually has,
    // including the families added after this was written.
    const families = await page.evaluate(() =>
      window.DraftBuildMenu.BUILD_MENU.map(f => f.id));
    expect(families.length, 'the board has no families to sweep')
      .toBeGreaterThan(0);
    for (const family of families) {
      await page.locator(`#dt-tiles [data-build-family="${family}"]`).click();
      await page.waitForTimeout(250);
    }
    const broken = await page.evaluate(() => [...document.querySelectorAll('#dt-tiles img')]
      .filter(img => img.complete && img.naturalWidth === 0)
      .map(img => img.getAttribute('src')));
    expect(broken, 'a tile is wearing a card that 404s').toEqual([]);
  });

// THE PRESS HAS TO ASK, and on ROUGH nothing did. data-ready -- MODEL's
// "this order can be placed" -- reached only the SIGN's bone, and ROUGH has
// no sign bone at all, so a drafter with a house chosen sat looking at a full
// board with nothing on screen telling him what to press. Movie, 24 Sep:
// "when the 'BONE' is pulse glowing the 'HOUSE' should be 'pulse glowing' but
// doesn't so user is confused if it doesn't do this".
//
// ASKED OF THE COMPUTED ANIMATION, not of the attribute. The attribute only
// says MODEL tried; the animation says the stylesheet answered -- and ROUGH
// deliberately switches OFF the filter glow the foot press wears on RUFF
// (its lit state is a painted file, not a filter), which is exactly how a
// theme ends up silently unable to ask.
for (const theme of ['ruff', 'rough']) {
  test(`${theme}: the foot press pulses once the order can be placed`,
    async ({ page }) => {
      await openWithNoBuilding(page);
      await page.goto(`/MODEL.html?mode=day&theme=${theme}`);
      await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });

      const anim = () => page.locator('#bone img')
        .evaluate(el => getComputedStyle(el).animationName);
      expect(await anim(), 'the press was asking before anything was chosen')
        .toBe('none');

      await h.openDriveThru(page);
      await page.locator('#dt-tiles [data-build-family="bungalow"]').click();
      await page.locator('#dt-tiles [data-build-entry="twoStorey-garage"]').click();
      await page.waitForTimeout(400);

      await expect(page.locator('#bone'),
        'MODEL never told the foot press the order was ready')
        .toHaveAttribute('data-ready', '');
      expect(await anim(), `${theme} left the press silent -- nothing asks for it`)
        .not.toBe('none');
    });
}

// AND THE SHEET KEEPS OFF THE PRESS. Movie, 24 Sep: "make the 'BLUEPRINT'
// backdrop about 90% that size so there will be a little space between the
// 'BLUEPRINT' and the HOUSE BUTTON ... always leave a few pixels gap at least
// but more prefered". Measured as a gap rather than as a width, because what
// he asked for is the clearance; the 90% is how it was got.
test('rough: the sheet leaves the house press clear', async ({ page }) => {
  await openWithNoBuilding(page);
  await page.goto('/MODEL.html?mode=day&theme=rough');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  await h.openDriveThru(page);

  const sheet = await page.locator('#dt-frame').boundingBox();
  const press = await page.locator('#bone').boundingBox();
  const gap = press.y - (sheet.y + sheet.height);
  expect(gap, `the sheet is sitting ${Math.round(-gap)}px over the house press`)
    .toBeGreaterThan(0);
  expect(gap, 'the clearance is back to a few pixels, which is what he asked to fix')
    .toBeGreaterThanOrEqual(20);
});

test('an unasked garage carries the default size to the seam', async ({ page }) => {
  await openWithNoBuilding(page);
  await openGarage(page);
  await expect(page.locator('#build-sizes'),
    'the board asked how big when it was told not to').toBeHidden();

  const ordered = await page.evaluate(() => {
    const seen = [];
    window.ModelBuild.onOrder(order => seen.push(order.size));
    document.getElementById('dt-bone').click();
    return seen;
  });
  expect(ordered.length, 'the order never reached the seam').toBe(1);
  expect({ w: ordered[0]?.widthFt, d: ordered[0]?.depthFt },
    'the default that rode the order is not the one build-menu.js names')
    .toEqual({ w: 24, d: 26 });
});

test('the detached garage is asked how big, and the house never is',
  async ({ page }) => {
    await openPageAsking(page);
    await openGarage(page);

    await expect(page.locator('#build-sizes')).toBeVisible();
    await expect(page.locator('#size-stock button'))
      .toHaveText(["16' x 24'", "24' x 26'", "25' x 25'", 'OTHER']);
    // AND GRUFF ASKS RATHER THAN PROMISING. Saying "press the bone and
    // I'll build it" with the size still open promises what the bone is
    // about to refuse.
    await expect(page.locator('[data-drivethru-line]')).toContainText('HOW BIG');

    // A HOUSE'S SIZE ARRIVES WITH ITS PREMADE DESIGN, so the row goes away
    // again -- a bungalow asked for its dimensions would be the drive-thru
    // asking a question the catalogue already answered.
    await page.locator('#dt-tiles [data-build-family="bungalow"]').click();
    await page.locator('#dt-tiles [data-build-entry="bungalow"]').click();
    await expect(page.locator('#build-sizes')).toBeHidden();
  });

test('a stock size rides the order to the seam', async ({ page }) => {
  await openAskingWithNoBuilding(page);
  await openGarage(page);
  await page.locator('#size-stock [data-build-size="24x26"]').click();
  await expect(page.locator('[data-drivethru-line]')).toContainText("24' x 26'");

  const ordered = await page.evaluate(() => {
    const seen = [];
    window.ModelBuild.onOrder(order => seen.push(order.size));
    document.getElementById('dt-bone').click();
    return seen;
  });
  expect(ordered.length, 'the order never reached the seam').toBe(1);
  expect({ w: ordered[0]?.widthFt, d: ordered[0]?.depthFt },
    'the size the drafter pressed is not the size that was ordered')
    .toEqual({ w: 24, d: 26 });
});

test('the fourth option is two fields, and they are checked before the bone',
  async ({ page }) => {
    await openAskingWithNoBuilding(page);
    await openGarage(page);
    await page.locator('#size-stock [data-build-size="custom"]').click();
    await expect(page.locator('#size-custom')).toBeVisible();

    // A GARAGE WITH NO SIZE IS NOT AN ORDER. The size is the whole design
    // of a box, so the bone refuses out loud rather than firing a seam
    // with nothing in it -- and this is the half that would rot silently,
    // because an empty field reads as 0 to anything that only asks "is it
    // a number".
    let fired = await page.evaluate(() => {
      const seen = [];
      window.ModelBuild.onOrder(order => seen.push(order));
      document.getElementById('dt-bone').click();
      return seen.length;
    });
    expect(fired, 'a garage with no size was ordered anyway').toBe(0);
    await expect(page.locator('[data-drivethru-line]')).toContainText('HOW BIG');

    // AND A SLIPPED FINGER IS NOT A BUILDING either: 4ft parks nothing.
    await page.locator('#size-w').fill('4');
    await page.locator('#size-d').fill('900');
    fired = await page.evaluate(() => {
      const seen = [];
      window.ModelBuild.onOrder(order => seen.push(order));
      document.getElementById('dt-bone').click();
      return seen.length;
    });
    expect(fired, 'a 4ft by 900ft garage was ordered').toBe(0);

    await page.locator('#size-w').fill('18');
    await page.locator('#size-d').fill('22');
    await expect(page.locator('[data-drivethru-line]')).toContainText("18' x 22'");
    const ordered = await page.evaluate(() => {
      const seen = [];
      window.ModelBuild.onOrder(order => seen.push(order.size));
      document.getElementById('dt-bone').click();
      return seen;
    });
    expect({ w: ordered[0]?.widthFt, d: ordered[0]?.depthFt, own: ordered[0]?.custom },
      'the typed pair did not reach the seam as a size')
      .toEqual({ w: 18, d: 22, own: true });
  });

test('a size does not follow the drafter onto the next thing he picks',
  async ({ page }) => {
    await openPageAsking(page);
    await openGarage(page);
    await page.locator('#size-stock [data-build-size="16x24"]').click();
    await expect(page.locator('[data-drivethru-line]')).toContainText("16' x 24'");

    // PRESSING A DIFFERENT FOUNDATION IS A NEW QUESTION. Carrying the last
    // answer across would build a 16x24 for a drafter who never saw the
    // size asked on the tile he actually pressed.
    //
    // STRAIGHT ONTO THE SECOND TILE, where this used to press the family
    // again first. A choice shut the submenu until 24 Sep, so getting back to
    // its siblings meant re-opening it; the submenu stays up now (Movie: "do
    // not change the page"), so that press would TOGGLE IT SHUT and the tile
    // this test reaches for would not be there. The flow it describes is the
    // shorter one a drafter now takes.
    await expect(page.locator('#dt-tiles [data-build-entry="detached-frostwall"]'))
      .toBeVisible();
    await page.locator('#dt-tiles [data-build-entry="detached-frostwall"]').click();
    await expect(page.locator('[data-drivethru-line]')).toContainText('HOW BIG');
    await expect(page.locator('#size-stock [data-build-size="16x24"]'))
      .not.toHaveClass(/chosen/);
  });

// ── THE SHEET, WHICH CARRIES NO DOG ───────────────────────────────────────
//
// Movie, 17 Sep, on ROUGH: "in the ROUGH version it isn't going to show the
// dog", and "no dog will ask questions they will just see the selections".
// Hiding Gruff took his BONE with him, and his bone is the order -- so on the
// sheet a type could be chosen, sized, and never ordered. Movie, 18 Sep:
// "when i press the BLUE HOUSE it doesn't build the garage in ROUGH mode, but
// in RUFF mode the bone button works".
//
// THE TWO HALVES ARE TESTED APART because they broke apart: the ORDER had
// nowhere to be closed, and the REFUSAL had nowhere to be spoken. Fixing
// either alone leaves a press that still does nothing, or one that does
// nothing and cannot say why.
const openRoughGarage = async page => {
  // ASKING, like the other size checks: every test through here presses the
  // bone with the question OPEN and reads what answers -- a refusal on the
  // page's own line, the foot bone closing the order. With the question
  // withdrawn the default answers it first and there is nothing to read.
  await page.goto('/MODEL.html?mode=night&theme=rough' + ASK_SIZES);
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  // THE DOG IS GONE, and both halves of him. This is the precondition rather
  // than a second test of the stylesheet: everything below is only meaningful
  // because there is no bone on the board to press and no screen to read.
  await h.openDriveThru(page);
  await expect(page.locator('#dt-bone')).toBeHidden();
  await expect(page.locator('#dt-screen')).toBeHidden();
  await page.locator('#dt-tiles [data-build-family="detachedGarage"]').click();
  await page.locator('#dt-tiles [data-build-entry="detached-thickened"]').click();
};

test('with no bone on the board, the press that raised it closes the order',
  async ({ page }) => {
    await openWithNoBuilding(page);
    await openRoughGarage(page);
    await page.locator('#size-stock [data-build-size="16x24"]').click();

    // THE FOOT'S PRESS, not the board's -- there is no board's. It is the same
    // button that opened the board, and while the board is up it is the order.
    const ordered = await page.evaluate(() => {
      const seen = [];
      window.ModelBuild.onOrder(order => seen.push(order));
      document.getElementById('bone').click();
      return seen.map(o => ({ entry: o.entry?.id, w: o.size?.widthFt, d: o.size?.depthFt }));
    });
    expect(ordered.length, 'the press never reached the order seam').toBe(1);
    expect(ordered[0], 'the order carried a different thing than was pressed')
      .toEqual({ entry: 'detached-thickened', w: 16, d: 24 });
  });

test('with no dog to say it, a refusal goes on the page-s own line',
  async ({ page }) => {
    await openPage(page);
    await openRoughGarage(page);

    // NO SIZE PRESSED, which is the refusal the board asks for most. On RUFF
    // Gruff says it on his screen; here the screen is not on the page at all.
    const fired = await page.evaluate(() => {
      let seen = 0;
      window.ModelBuild.onOrder(() => { seen += 1; });
      document.getElementById('bone').click();
      return seen;
    });
    expect(fired, 'a garage with no size was ordered anyway').toBe(0);

    // BOTH HALVES SPOKEN. The shout is what is wrong and the note is what to
    // do about it, and a drafter reading one line needs both.
    await expect(page.locator('#strip-message')).toContainText('HOW BIG');
    await expect(page.locator('#strip-message')).toContainText('size off the shelf');
  });

test('the dog keeps his own bone, and his own voice, where he is on the board',
  async ({ page }) => {
    // ASKING, like its ROUGH twin above: what this measures is WHERE the
    // refusal lands, so there has to be a refusal to land. With the size
    // question withdrawn the default answers first and nothing is refused.
    await openPageAsking(page);
    await h.openDriveThru(page);
    await expect(page.locator('#dt-bone')).toBeVisible();
    await page.locator('#dt-tiles [data-build-family="detachedGarage"]').click();
    await page.locator('#dt-tiles [data-build-entry="detached-thickened"]').click();

    // RUFF IS UNTOUCHED BY THE FIX ABOVE, and that is the half worth guarding:
    // the foot's press is covered by the sign here, and the refusal belongs on
    // Gruff's screen rather than on the page's line.
    const fired = await page.evaluate(() => {
      let seen = 0;
      window.ModelBuild.onOrder(() => { seen += 1; });
      document.getElementById('dt-bone').click();
      return seen;
    });
    expect(fired, 'a garage with no size was ordered anyway').toBe(0);
    await expect(page.locator('[data-drivethru-line]')).toContainText('HOW BIG');
    await expect(page.locator('#strip-message')).not.toContainText('HOW BIG');
  });
