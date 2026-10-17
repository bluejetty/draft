// TITLEBLOCK (boards #285/#286): the company strip on a LAYOUT sheet.
// Pure: a canvas context, the strip's pixel box, and the sheet's information
// in — ink out. The primary composition is the vertical strip down the
// RIGHT edge (the CLAY sheet layout): north-arrow corner on SITE PLAN
// sheets, rotated project words, REVISION / DATE / SCALE / DRAFT BY rows,
// the company mark, and the big sheet number at the bottom. The original
// bottom band stays in the registry as each company's BAND alternate. A new
// company is a STYLES entry, not a new painter. Titleblocks are an 11×17
// feature — the letter sheet keeps its plain placeholder strip.
if (!window.DraftTitleblock) {
(() => {
  // ── TWO CHOICES, NOT ONE ─────────────────────────────────────────────────
  //
  // Movie, 14 Oct: "oh ya my TB has rounded corner - we should put a button up
  // beside TITLEBLOCK title to the right of it and put in the CURRENT TB style
  // (lets call first one SQUARE 01) when the user clicks on it a scroll menu
  // with other options opens up and they can change it) and then that TB will
  // accept the LOGO which will be a new area below TITLBLOCK new title 'LOGO'
  // and beside it to the right a scrolling selection once they click on it ,
  // but it shows the CURRENT logo (RD default)".
  //
  // THE OLD LIST ANSWERED TWO QUESTIONS WITH ONE PRESS. There were four
  // styles -- BLUEJETTY, ROUGH DRAFTER and a BAND of each -- and each one
  // carried both a FRAME (where the block sits, whether its corners are
  // round) and a MARK (whose logo and name are in it). So a drafter who
  // wanted the rounded frame got BLUEJETTY's logo with it, and a company
  // uploading its own mark could only ever have the square strip. Four
  // entries for 2x2, and no way to say the third thing an uploaded logo
  // needs: this mark, in THAT frame.
  //
  // SO THEY ARE TWO LISTS NOW, and a style is composed from one of each.
  // Nothing downstream changed: `draw` still takes the same flat object, and
  // compose() is the only thing that builds one.
  // THE FRAMES, NAMED BY HIM (14 Oct): "TBs so far : LSQUARE01 , LBAND01 ,
  // LROUND01 (use L for landscape orientation and P for portrait", then "make
  // sets that will fit on the different sizes for each of those" and "sizes
  // 8.5x11 and 11X17 only ones we need now".
  //
  // SO IT IS A SET PER SHEET: three shapes (square strip, bottom band, round
  // strip) for each sheet this shop prints -- 11x17 and 8.5x11 at first,
  // and since 17 Oct the two D sheets, 24x36 (ARCH D, his North Point set)
  // and 22x34 (ANSI D) -- each way up. Twenty-four frames, and a drafter
  // sees three: the picker is filtered to the sheet in front of him, which
  // is what keeps his list the exact three he wrote down. The LETTER is the
  // orientation, the NUMBER is the paper -- 01 is 11x17, 02 is 8.5x11, 03
  // is 24x36, 04 is 22x34 -- and neither has to be remembered, because the
  // wrong ones are never offered.
  //
  // EACH SET CARRIES ITS OWN WIDTHS, which is the whole reason a set per
  // sheet exists rather than one frame stretched over all four. A 1.15" strip
  // is 6.8% of a 17" sheet and 13.5% of an 8.5" one: the same block eats
  // twice the drawing on letter. The letter sets are cut back to 0.95" and
  // their band to 1.2" -- narrower than scale alone would give (0.74"),
  // because a titleblock still has to letter REVISION / DATE / SCALE at a
  // size a client can read. Judgement, not arithmetic, and said out loud here
  // so the next person changing it knows which it is.
  //
  // A PORTRAIT STRIP IS THE SHORT EDGE NOW: 11" of height on a portrait
  // 11x17 against 16" landscape, so the same cells have less room and the
  // strip is widened a little to get it back.
  //
  // THE D SHEETS GET A WIDER BLOCK, for the same reason the letter sheets
  // got a narrower one. A 1.15" strip on a 36" sheet is 3.2% of it, and the
  // lettering in it would be the one thing on a D sheet still sized for a
  // ledger: a 2" strip and a 2.25" band are what a D-size titleblock is
  // drawn at in practice, and the corner radius grows with the sheet. The
  // same judgement, not arithmetic.
  const frame = (id, paper, orientation, shape, extra) => Object.freeze({
    id, label: id, paper, orientation, shape, ...extra,
  });
  const STRIP = Object.freeze({ wide: 1.15, letter: 0.95, portrait: 1.3, portraitLetter: 1.05,
    d: 2, portraitD: 2.2 });
  const BAND = Object.freeze({ wide: 1.5, letter: 1.2, d: 2.25 });
  const ROUND_IN = 0.35;
  const ROUND_D_IN = 0.5;
  const FRAMES = Object.freeze([
    // ── 11x17 LANDSCAPE, the three he listed. LSQUARE01 is the shape ROUGH
    //    DRAFTER has always worn, so a drawing that never chose opens on it;
    //    LROUND01 is the one he is using ("my TB has rounded corner"), which
    //    was BLUEJETTY's -- a 0.35" sheet-border radius and no divider under
    //    the north-arrow cell.
    frame('LSQUARE01', '11x17', 'landscape', 'square',
      { placement: 'right', stripWIn: STRIP.wide, cornerRadiusIn: 0, arrowDivider: true }),
    frame('LBAND01', '11x17', 'landscape', 'band',
      { placement: 'bottom', bandHIn: BAND.wide }),
    frame('LROUND01', '11x17', 'landscape', 'round',
      { placement: 'right', stripWIn: STRIP.wide, cornerRadiusIn: ROUND_IN, arrowDivider: false }),
    // ── 11x17 PORTRAIT
    frame('PSQUARE01', '11x17', 'portrait', 'square',
      { placement: 'right', stripWIn: STRIP.portrait, cornerRadiusIn: 0, arrowDivider: true }),
    frame('PBAND01', '11x17', 'portrait', 'band',
      { placement: 'bottom', bandHIn: BAND.wide }),
    frame('PROUND01', '11x17', 'portrait', 'round',
      { placement: 'right', stripWIn: STRIP.portrait, cornerRadiusIn: ROUND_IN, arrowDivider: false }),
    // ── 8.5x11 LANDSCAPE
    frame('LSQUARE02', '8.5x11', 'landscape', 'square',
      { placement: 'right', stripWIn: STRIP.letter, cornerRadiusIn: 0, arrowDivider: true }),
    frame('LBAND02', '8.5x11', 'landscape', 'band',
      { placement: 'bottom', bandHIn: BAND.letter }),
    frame('LROUND02', '8.5x11', 'landscape', 'round',
      { placement: 'right', stripWIn: STRIP.letter, cornerRadiusIn: ROUND_IN, arrowDivider: false }),
    // ── 8.5x11 PORTRAIT
    frame('PSQUARE02', '8.5x11', 'portrait', 'square',
      { placement: 'right', stripWIn: STRIP.portraitLetter, cornerRadiusIn: 0, arrowDivider: true }),
    frame('PBAND02', '8.5x11', 'portrait', 'band',
      { placement: 'bottom', bandHIn: BAND.letter }),
    frame('PROUND02', '8.5x11', 'portrait', 'round',
      { placement: 'right', stripWIn: STRIP.portraitLetter, cornerRadiusIn: ROUND_IN, arrowDivider: false }),
    // ── THE D SHEETS (17 Oct): 03 is 24x36, 04 is 22x34, the same three
    //    shapes each way up, at the D block's widths.
    ...[['03', '24x36'], ['04', '22x34']].flatMap(([n, paper]) => [
      frame(`LSQUARE${n}`, paper, 'landscape', 'square',
        { placement: 'right', stripWIn: STRIP.d, cornerRadiusIn: 0, arrowDivider: true }),
      frame(`LBAND${n}`, paper, 'landscape', 'band',
        { placement: 'bottom', bandHIn: BAND.d }),
      frame(`LROUND${n}`, paper, 'landscape', 'round',
        { placement: 'right', stripWIn: STRIP.d, cornerRadiusIn: ROUND_D_IN, arrowDivider: false }),
      frame(`PSQUARE${n}`, paper, 'portrait', 'square',
        { placement: 'right', stripWIn: STRIP.portraitD, cornerRadiusIn: 0, arrowDivider: true }),
      frame(`PBAND${n}`, paper, 'portrait', 'band',
        { placement: 'bottom', bandHIn: BAND.d }),
      frame(`PROUND${n}`, paper, 'portrait', 'round',
        { placement: 'right', stripWIn: STRIP.portraitD, cornerRadiusIn: ROUND_D_IN, arrowDivider: false }),
    ]),
  ]);

  // THE THREE THAT FIT THE SHEET IN FRONT OF HIM. An unknown paper or
  // orientation answers the 11x17 landscape set rather than an empty list: a
  // picker with nothing in it reads as broken, and that set is the one every
  // drawing before this change was drawn with.
  const framesFor = (paper, orientation) => {
    const fit = FRAMES.filter(f => f.paper === paper && f.orientation === orientation);
    return Object.freeze(fit.length ? fit
      : FRAMES.filter(f => f.paper === '11x17' && f.orientation === 'landscape'));
  };

  // THE SAME SHAPE ON ANOTHER SHEET. Changing paper or turning the page must
  // not silently move a drafter from his rounded strip to a square one, so
  // the shape is what is kept and the sheet is what is re-asked.
  const frameOnSheet = (frameId, paper, orientation) => {
    const shape = FRAMES.find(f => f.id === frameId)?.shape;
    const set = framesFor(paper, orientation);
    return (set.find(f => f.shape === shape) || set[0]).id;
  };

  // THE MARKS THAT SHIP. An uploaded logo joins them, below.
  const MARKS = Object.freeze([
    // ROUGH DRAFTER IS THE DEFAULT -- "it shows the CURRENT logo (RD
    // default)" -- and is first for that reason.
    Object.freeze({
      id: 'roughdrafter', label: 'ROUGH DRAFTER', company: 'ROUGH DRAFTER',
      logoSrc: './assets/rough-drafter-logo.png',
      // LOGO ONLY, because the logo IS the wordmark (Movie, 21 Sep: "take off
      // the ROUGH DRAFTER text in the logo area and increase the logo size (it
      // has the ROUGH DRAFTER already on it)"). assets/rough-drafter-logo.png
      // is a rolled blueprint with ROUGH DRAFTER set across it in letters
      // taller than anything else in the cell, so the wordmark underneath was
      // the company name printed twice, half an inch apart.
      logoOnly: true,
    }),
    Object.freeze({
      id: 'bluejetty', label: 'BLUEJETTY', company: 'BLUEJETTY',
      logoSrc: './assets/bluejetty.png', logoOnly: true,
    }),
  ]);

  // ── A COMPANY'S OWN LOGO, UPLOADED ───────────────────────────────────────
  //
  // Movie, 14 Oct: "for the LOGO - i set it up temporary with te BLUEJETTY
  // logo as an option for everyone, but it should only be for ME (my
  // company)... I'd like to make a section at the top of COMPANY STANDARDS,
  // where they can upload a logo which will be placed on the drawings (if
  // they choose it)... (allow them to upload multiple logos for each COMPANY
  // STANDARDS area".
  //
  // AN UPLOADED LOGO IS A STYLE, which is the whole of the design: the file's
  // own note says "a new company is a STYLES entry, not a new painter", and
  // that is as true of a logo somebody uploads as of one shipped in assets/.
  // So the painter is not touched at all -- `logoSrc` becomes a data URL
  // instead of a path, and everything downstream (the picker, LAYOUT's image
  // preload, drawRight) already knows what to do with a style.
  //
  // RIGHT PLACEMENT AND LOGO ONLY, because that is the arrangement a mark
  // nobody here has seen can be trusted in: the strip gives it a tall cell of
  // its own, and `logoOnly` lets it fill ~75% of that cell rather than
  // sharing with a wordmark this app would have to invent. A drafter who
  // wants their name in letters puts it in the logo.
  //
  // PREFIXED ids, so an uploaded logo can never collide with a built-in style
  // -- `logo:` is not a character a STYLES id uses -- and so a sheet set that
  // names one can be told apart from one naming BLUEJETTY without a lookup.
  const LOGO_ID_PREFIX = 'logo:';
  // WHAT A BROWSER WILL HOLD. Each package lives in localStorage, which gives
  // a site a few MB in total, and a standards file is emailed around -- so
  // these are the two numbers that keep a logo from quietly costing somebody
  // their saved drawings. STANDARDS.html downscales on the way in; this is
  // the backstop for a file that arrives from anywhere else.
  const MAX_LOGOS = 8;
  const MAX_LOGO_BYTES = 400 * 1024;

  // AN UPLOADED LOGO IS A MARK, and a mark says nothing about the frame it
  // goes in -- that is the point of the split. It carried a `placement` for
  // one day, before the frames existed to own that question.
  const logoMark = logo => Object.freeze({
    id: `${LOGO_ID_PREFIX}${logo.id}`,
    label: logo.label,
    company: logo.label,
    logoSrc: logo.dataUrl,
    // THE MARK FILLS ITS CELL on the strip, so a wordmark under it would be
    // the company name twice; the BAND letters its name in a cell of its own
    // and ignores this. See the note in drawRight.
    logoOnly: true,
    uploaded: true,
  });

  // WHAT SURVIVES COMING OFF DISK. A standards package is a file a drafter
  // can edit, mail and re-import, so nothing in it is trusted: a logo needs
  // an id, a name and a data URL that really is an image, or it is not a
  // logo. ONLY `data:image/` -- an http(s) src would make a printed sheet
  // depend on a server being up, and a `javascript:` one would make it worse.
  const normaliseCompanyLogos = list => {
    if (!Array.isArray(list)) return [];
    const seen = new Set();
    return list.reduce((out, entry) => {
      if (out.length >= MAX_LOGOS || !entry || typeof entry !== 'object') return out;
      const id = String(entry.id || '').trim().slice(0, 40);
      const dataUrl = typeof entry.dataUrl === 'string' ? entry.dataUrl : '';
      if (!id || seen.has(id)) return out;
      if (!/^data:image\/(png|jpeg|gif|webp|svg\+xml);/i.test(dataUrl)) return out;
      if (dataUrl.length > MAX_LOGO_BYTES) return out;
      seen.add(id);
      out.push(Object.freeze({
        id,
        label: (String(entry.label || '').trim() || 'COMPANY LOGO').slice(0, 40).toUpperCase(),
        dataUrl,
        // THE SLOT NUMBER, KEPT APART FROM THE NAME. Movie, 14 Oct: "allow
        // them to remane COMPANY 01 if they would like ... next one will
        // still be named COMPANY 02 etc". Counting the COMPANY nn labels
        // would make the numbering collapse the moment one is renamed --
        // rename 01 to BLUEJETTY and the next upload would be 01 again. The
        // label is the drafter's; this is the app's.
        seq: Number.isFinite(Number(entry.seq)) && Number(entry.seq) > 0
          ? Math.floor(Number(entry.seq)) : 0,
      }));
      return out;
    }, []);
  };

  // THE WHOLE MARK LIST: what ships, then what this office uploaded. The
  // shipped two first, because they are what every drawing opens on; an
  // office's own marks read as additions rather than a replacement.
  const marksFor = logos => Object.freeze([
    ...MARKS,
    ...normaliseCompanyLogos(logos).map(logoMark),
  ]);

  const frameById = id => FRAMES.find(frame => frame.id === id) || null;
  const markById = (id, logos) => marksFor(logos).find(mark => mark.id === id) || null;

  // ── ONE FRAME AND ONE MARK MAKE A STYLE ──────────────────────────────────
  // Everything downstream still takes the one flat object it always did; this
  // is the only place one is built. An unknown frame or mark answers null,
  // the same way the old styleById did, so a sheet naming something that no
  // longer exists falls back rather than printing somebody else's name.
  const compose = (frameId, markId, logos) => {
    const fr = frameById(frameId);
    const mark = markById(markId, logos);
    if (!fr || !mark) return null;
    const frame = fr;
    return Object.freeze({
      id: `${frame.id}/${mark.id}`,
      frameId: frame.id,
      markId: mark.id,
      label: `${frame.label} · ${mark.label}`,
      company: mark.company,
      logoSrc: mark.logoSrc,
      placement: frame.placement,
      cornerRadiusIn: frame.cornerRadiusIn ?? CORNER_RADIUS_IN,
      arrowDivider: frame.arrowDivider,
      // THE BLOCK'S OWN SIZE RIDES WITH IT, so the sheet painter asks the
      // style how wide the strip is rather than reaching for one constant
      // that was only ever right for 11x17. STRIP_W_IN / BAND_H_IN stay as
      // the fallback for a caller that has no style yet.
      stripWIn: frame.stripWIn ?? STRIP_W_IN,
      bandHIn: frame.bandHIn ?? BAND_H_IN,
      logoOnly: mark.logoOnly !== false,
      uploaded: mark.uploaded === true,
    });
  };

  // ── WHAT A DRAWING SAVED BEFORE THE SPLIT ────────────────────────────────
  // Four ids were in the field, each carrying both answers, plus `logo:<id>`
  // for an uploaded one. Every drawing and every settings package holds one.
  // Read here rather than migrated in place: a drawing opened read-only, or
  // one that is never saved again, still has to come up wearing what it was
  // given.
  const LEGACY = Object.freeze({
    bluejetty: Object.freeze({ frame: 'LROUND01', mark: 'bluejetty' }),
    roughdrafter: Object.freeze({ frame: 'LSQUARE01', mark: 'roughdrafter' }),
    'bluejetty-band': Object.freeze({ frame: 'LBAND01', mark: 'bluejetty' }),
    'roughdrafter-band': Object.freeze({ frame: 'LBAND01', mark: 'roughdrafter' }),
  });
  // THE PAIR A SAVED id MEANS. A `frame/mark` id reads as itself, one of the
  // four old names reads through the table, and an uploaded logo's own id --
  // which used to BE the whole answer -- takes the square strip it had.
  const pickFrom = id => {
    const text = String(id || '');
    if (text.includes('/')) {
      const [frame, mark] = text.split('/');
      return { frame, mark };
    }
    if (LEGACY[text]) return { ...LEGACY[text] };
    // A BARE FRAME id IS A FRAME. The drawing record keeps the frame and the
    // mark in two fields, so what arrives here is usually just the frame --
    // and reading it as "nothing I know" put every reload back on LSQUARE01,
    // which is how a drafter's rounded block kept squaring itself overnight.
    if (FRAMES.some(f => f.id === text)) return { frame: text, mark: MARKS[0].id };
    if (text.startsWith(LOGO_ID_PREFIX)) return { frame: 'LSQUARE01', mark: text };
    return { frame: FRAMES[0].id, mark: MARKS[0].id };
  };

  // THE OLD DOOR, STILL OPEN. Every caller that holds one saved id and wants
  // a style to draw with asks this; it is pickFrom and compose in one line.
  const styleById = (id, logos) => {
    const pick = pickFrom(id);
    return compose(pick.frame, pick.mark, logos);
  };

  const INK = '#1d1f20';
  const FAINT = 'rgba(29,31,32,0.55)';

  // Strip width (right placement) and band height (bottom placement) in
  // paper inches. Each right-placement style carries its own sheet-border
  // corner radius (BLUEJETTY quite rounded, ROUGH DRAFTER square);
  // CORNER_RADIUS_IN stays as the fallback.
  const STRIP_W_IN = 1.15;
  const BAND_H_IN = 1.5;
  const CORNER_RADIUS_IN = 0.35;

  // THE CELL THE COMPANY MARK STANDS IN, as fractions of the strip's height.
  // PUBLISHED because the logo crop on COMPANY STANDARDS previews into it: it
  // renders the real strip through `draw` and then enlarges this band of it,
  // which is the part a drafter is actually judging a crop by. Recomputing
  // 0.78/0.92 on that page would be a second copy of the arithmetic, and a
  // second copy is how the preview comes to show a cell the sheet does not
  // have. drawRight reads these same two numbers.
  const MARK_CELL = Object.freeze({ top: 0.78, bottom: 0.92 });

  // Cell widths of the bottom band as fractions of the strip: identity,
  // project, drafter, date + scale, sheet number.
  const CELLS = [0.2, 0.34, 0.2, 0.14, 0.12];

  const fit = (ctx, text, maxPx, basePx, family, weight = 600) => {
    let size = basePx;
    ctx.font = `${weight} ${size}px ${family}`;
    while (size > 6 && ctx.measureText(text).width > maxPx) {
      size -= 1;
      ctx.font = `${weight} ${size}px ${family}`;
    }
    return size;
  };

  // The north arrow: a circle with the needle flying up the sheet and its
  // letter beside it. SITE PLAN sheets only — info.northArrow gates it.
  const drawNorthArrow = (ctx, cx, cy, r) => {
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
    const tail = r * 0.72;
    ctx.beginPath();
    ctx.moveTo(cx, cy + tail);
    ctx.lineTo(cx, cy - tail * 0.35);
    ctx.stroke();
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.moveTo(cx, cy - tail);
    ctx.lineTo(cx - r * 0.22, cy - tail * 0.3);
    ctx.lineTo(cx + r * 0.22, cy - tail * 0.3);
    ctx.closePath();
    ctx.fill();
    ctx.font = `600 ${Math.max(6, r * 0.55)}px 'Barlow Condensed', sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('N', cx + r * 0.3, cy + r * 0.4);
  };

  // The vertical strip (CLAY sheet positions), top to bottom: north-arrow
  // corner (SITE PLAN only), the rotated project title, the rotated
  // address + owner block, the horizontal record rows, the company mark,
  // and the sheet number. The sheet border owns the outer edge; the strip
  // draws its left rail and the section dividers.
  const drawRight = (ctx, box, style, info, logo) => {
    const { x, y, w, h } = box;
    const condensed = "'Barlow Condensed', sans-serif";
    const plain = "'Barlow', sans-serif";
    const pad = w * 0.1;

    ctx.save();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x, y + h);
    ctx.stroke();

    // Section bottoms as fractions of the strip height.
    const arrowB = y + h * 0.12;
    const titleB = y + h * 0.44;
    const wordsB = y + h * 0.62;
    const rowsB = y + h * MARK_CELL.top;
    const markB = y + h * MARK_CELL.bottom;
    const divider = yy => {
      ctx.lineWidth = 0.75;
      ctx.beginPath();
      ctx.moveTo(x, yy);
      ctx.lineTo(x + w, yy);
      ctx.stroke();
    };

    // North-arrow corner — inked when the sheet flies it (the LAYOUT toggle;
    // site plans by convention), and the cell holds its place on every sheet
    // so the composition never shifts.
    // BOTH NORTHS when the drawing has set one (north.js): construction north
    // dark, true north grey beside it (Movie, 1 Oct). A drawing that never
    // set one keeps the plain arrow straight up the sheet.
    if (info.northArrow) {
      const cx = x + w / 2, cy = y + (arrowB - y) / 2, r = Math.min(w, arrowB - y) * 0.34;
      if (info.north && window.DraftNorth) {
        window.DraftNorth.drawPair(ctx, cx, cy, r, info.north, { cnColor: INK, tnColor: '#8c9196' });
      } else {
        drawNorthArrow(ctx, cx, cy, r);
      }
    }
    if (style.arrowDivider !== false) divider(arrowB);

    // Rotated words climbing the strip. Reading up the sheet, text starts at
    // the section bottom (left-justified in the turned frame) so every rotated
    // line shares the same start line.
    const rot = (text, tx, sectionTop, sectionBottom, basePx, weight, family, color) => {
      if (!text) return;
      const maxPx = (sectionBottom - sectionTop) - pad * 2;
      const size = fit(ctx, text, maxPx, basePx, family, weight);
      ctx.save();
      ctx.translate(tx, sectionBottom - pad);
      ctx.rotate(-Math.PI / 2);
      ctx.fillStyle = color;
      ctx.font = `${weight} ${size}px ${family}`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, 0, 0);
      ctx.restore();
    };

    // The title reads as two stacked lines: the PROJECT on top, the page
    // title underneath (turn the sheet and they read as line one / line two).
    rot(info.projectName || 'NEW HOME', x + w * 0.32, arrowB, titleB, w * 0.3, 400, condensed, INK);
    rot(info.pageTitle || '', x + w * 0.68, arrowB, titleB, w * 0.22, 400, condensed, FAINT);
    divider(titleB);

    // Rotated address + owner: label column against the rail, words beside.
    rot('BUILDING ADDRESS', x + w * 0.22, titleB, wordsB, w * 0.13, 600, condensed, FAINT);
    rot(info.address, x + w * 0.4, titleB, wordsB, w * 0.14, 400, plain, INK);
    rot('BUILDING OWNER', x + w * 0.64, titleB, wordsB, w * 0.13, 600, condensed, FAINT);
    rot(info.owner, x + w * 0.82, titleB, wordsB, w * 0.14, 400, plain, INK);
    divider(wordsB);

    // The record rows, horizontal: REVISION / DATE / SCALE / DRAFT BY.
    const rows = [
      ['REVISION', info.revision || '—'],
      ['DATE', info.date],
      ['SCALE', info.scale],
      ['DRAFT BY', info.drafterName],
    ];
    const rowH = (rowsB - wordsB) / rows.length;
    rows.forEach(([labelText, value], i) => {
      const top = wordsB + rowH * i;
      if (i) {
        ctx.strokeStyle = INK;
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(x, top);
        ctx.lineTo(x + w, top);
        ctx.stroke();
      }
      ctx.fillStyle = FAINT;
      ctx.font = `600 ${Math.max(6, w * 0.13)}px ${condensed}`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(labelText, x + pad, top + rowH * 0.1);
      if (value) {
        const size = fit(ctx, value, w - pad * 2, w * 0.14, plain, 400);
        ctx.fillStyle = INK;
        ctx.font = `400 ${size}px ${plain}`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'bottom';
        ctx.fillText(value, x + pad, top + rowH * 0.94);
      }
    });
    divider(rowsB);

    // The company mark: logo over the name, drafter's phone underneath. A
    // logoOnly style skips the wordmark — its logo carries the name and
    // fills ~75% of the cell instead.
    const markH = markB - rowsB;
    let markY = rowsB + markH * 0.12;
    // ANY CANVAS-IMAGE SOURCE, not only an <img>. `drawImage` has always
    // taken a canvas; this read did not -- it asked for `naturalWidth`, which
    // only an <img> has, so a canvas passed in here drew nothing at all. The
    // logo crop on COMPANY STANDARDS previews from a canvas, because turning
    // the crop into a data URL on every drag is a round trip per frame for a
    // picture the painter can read directly.
    const logoW0 = logo && (logo.naturalWidth || logo.width);
    const logoH0 = logo && (logo.naturalHeight || logo.height);
    if (logo && logo.complete !== false && logoW0 && logoH0) {
      const share = style.logoOnly ? 0.75 : 0.42;
      let logoW = w * (style.logoOnly ? 0.75 : 1) - (style.logoOnly ? 0 : pad * 2);
      let logoH = logoW * (logoH0 / logoW0);
      if (logoH > markH * share) {
        logoH = markH * share;
        logoW = logoH * (logoW0 / logoH0);
      }
      ctx.drawImage(logo, x + (w - logoW) / 2, markY, logoW, logoH);
      markY += logoH + markH * 0.06;
    }
    if (!style.logoOnly) {
      const companyPx = fit(ctx, style.company, w - pad * 2, markH * 0.18, condensed);
      ctx.fillStyle = INK;
      ctx.font = `600 ${companyPx}px ${condensed}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(style.company, x + w / 2, markY);
      markY += companyPx * 1.35;
    }
    if (info.drafterPhone) {
      const phonePx = fit(ctx, info.drafterPhone, w - pad * 2, w * 0.13, plain, 400);
      ctx.fillStyle = FAINT;
      ctx.font = `400 ${phonePx}px ${plain}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(info.drafterPhone, x + w / 2, markY);
    }
    divider(markB);

    // The sheet number carries the bottom cell.
    ctx.fillStyle = FAINT;
    ctx.font = `600 ${Math.max(6, w * 0.13)}px ${condensed}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('SHEET', x + pad, markB + pad * 0.5);
    ctx.fillStyle = INK;
    ctx.font = `600 ${(y + h - markB) * 0.52}px ${condensed}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(info.sheet || '1', x + w / 2, markB + (y + h - markB) * 0.58);

    ctx.restore();
  };

  // The original bottom band — kept as each company's BAND alternate.
  const drawBottom = (ctx, box, style, info, logo) => {
    const { x, y, w, h } = box;
    const condensed = "'Barlow Condensed', sans-serif";
    const plain = "'Barlow', sans-serif";
    const labelPx = Math.max(6, h * 0.09);
    const pad = h * 0.08;

    ctx.save();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.25;
    ctx.strokeRect(x, y, w, h);

    // Cell dividers
    let cx = x;
    const cells = CELLS.map(fraction => {
      const cell = { x: cx, w: w * fraction };
      cx += cell.w;
      return cell;
    });
    ctx.lineWidth = 0.75;
    cells.slice(0, -1).forEach(cell => {
      ctx.beginPath();
      ctx.moveTo(cell.x + cell.w, y);
      ctx.lineTo(cell.x + cell.w, y + h);
      ctx.stroke();
    });

    const label = (cell, text) => {
      ctx.fillStyle = FAINT;
      ctx.font = `600 ${labelPx}px ${condensed}`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(text, cell.x + pad, y + pad);
    };
    const lines = (cell, rows, basePx) => {
      const maxW = cell.w - pad * 2;
      let ty = y + pad + labelPx * 1.5;
      rows.filter(Boolean).forEach(row => {
        const size = fit(ctx, row, maxW, basePx, plain);
        ctx.fillStyle = INK;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText(row, cell.x + pad, ty);
        ty += size * 1.3;
      });
    };

    // Identity cell: logo beside the company name, stacked when narrow.
    const idCell = cells[0];
    const logoH = h * 0.5;
    let textX = idCell.x + pad;
    if (logo && logo.complete && logo.naturalWidth) {
      const logoW = logoH * (logo.naturalWidth / logo.naturalHeight);
      const drawW = Math.min(logoW, idCell.w - pad * 2);
      ctx.drawImage(logo, idCell.x + pad, y + (h - logoH) / 2, drawW, logoH);
      textX = idCell.x + pad + drawW + pad;
    }
    const companyPx = fit(ctx, style.company, idCell.x + idCell.w - pad - textX, h * 0.18, condensed);
    ctx.fillStyle = INK;
    ctx.font = `600 ${companyPx}px ${condensed}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(style.company, textX, y + h / 2);

    // Project cell
    label(cells[1], 'PROJECT');
    lines(cells[1], [info.projectName, info.owner, info.address], h * 0.14);

    // Drafter cell
    label(cells[2], 'DRAWN BY');
    lines(cells[2], [info.drafterName, info.drafterPhone], h * 0.14);

    // Date + scale cell
    label(cells[3], 'DATE · SCALE');
    lines(cells[3], [info.date, info.scale], h * 0.13);

    // Sheet cell: the number carries the cell.
    const sheetCell = cells[4];
    label(sheetCell, 'SHEET');
    ctx.fillStyle = INK;
    ctx.font = `600 ${h * 0.42}px ${condensed}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(info.sheet || '1', sheetCell.x + sheetCell.w / 2, y + h * 0.58);

    ctx.restore();
  };

  // Draw the strip into box {x, y, w, h} (screen pixels). `info` carries the
  // sheet's words; `logo` is an already-loaded HTMLImageElement or null.
  const draw = (ctx, box, style, info, logo) => {
    if (style.placement === 'right') drawRight(ctx, box, style, info, logo);
    else drawBottom(ctx, box, style, info, logo);
  };

  window.DraftTitleblock = Object.freeze({
    FRAMES,
    MARKS,
    framesFor,
    frameById,
    frameOnSheet,
    marksFor,
    markById,
    compose,
    pickFrom,
    styleById,
    logoMark,
    normaliseCompanyLogos,
    LOGO_ID_PREFIX,
    MAX_LOGOS,
    MAX_LOGO_BYTES,
    draw,
    STRIP_W_IN,
    BAND_H_IN,
    CORNER_RADIUS_IN,
    MARK_CELL,
  });
})();
}
