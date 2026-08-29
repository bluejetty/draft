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
  const STYLES = Object.freeze([
    Object.freeze({
      id: 'bluejetty',
      label: 'BLUEJETTY',
      company: 'BLUEJETTY',
      logoSrc: './assets/bluejetty.png',
      placement: 'right',
      cornerRadiusIn: 0.35,
      logoOnly: true,
      arrowDivider: false,
    }),
    Object.freeze({
      id: 'roughdrafter',
      label: 'ROUGH DRAFTER',
      company: 'ROUGH DRAFTER',
      logoSrc: './assets/rough-drafter-logo.png',
      placement: 'right',
      cornerRadiusIn: 0,
      logoOnly: false,
      arrowDivider: true,
    }),
    Object.freeze({
      id: 'bluejetty-band',
      label: 'BLUEJETTY · BAND',
      company: 'BLUEJETTY',
      logoSrc: './assets/bluejetty.png',
      placement: 'bottom',
    }),
    Object.freeze({
      id: 'roughdrafter-band',
      label: 'ROUGH DRAFTER · BAND',
      company: 'ROUGH DRAFTER',
      logoSrc: './assets/rough-drafter-logo.png',
      placement: 'bottom',
    }),
  ]);

  const styleById = id => STYLES.find(style => style.id === id) || null;

  const INK = '#1d1f20';
  const FAINT = 'rgba(29,31,32,0.55)';

  // Strip width (right placement) and band height (bottom placement) in
  // paper inches. Each right-placement style carries its own sheet-border
  // corner radius (BLUEJETTY quite rounded, ROUGH DRAFTER square);
  // CORNER_RADIUS_IN stays as the fallback.
  const STRIP_W_IN = 1.15;
  const BAND_H_IN = 1.5;
  const CORNER_RADIUS_IN = 0.35;

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
    const rowsB = y + h * 0.78;
    const markB = y + h * 0.92;
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
    if (info.northArrow) {
      drawNorthArrow(ctx, x + w / 2, y + (arrowB - y) / 2, Math.min(w, arrowB - y) * 0.34);
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
    if (logo && logo.complete && logo.naturalWidth) {
      const share = style.logoOnly ? 0.75 : 0.42;
      let logoW = w * (style.logoOnly ? 0.75 : 1) - (style.logoOnly ? 0 : pad * 2);
      let logoH = logoW * (logo.naturalHeight / logo.naturalWidth);
      if (logoH > markH * share) {
        logoH = markH * share;
        logoW = logoH * (logo.naturalWidth / logo.naturalHeight);
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
    STYLES,
    styleById,
    draw,
    STRIP_W_IN,
    BAND_H_IN,
    CORNER_RADIUS_IN,
  });
})();
}
