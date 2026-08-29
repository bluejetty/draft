// TITLEBLOCK (board #285): the company strip along the bottom of a LAYOUT
// sheet. Pure: a canvas context, the strip's pixel box, and the sheet's
// information in — ink out. The picker offers one block per company
// (BLUEJETTY and ROUGH DRAFTER for now); both share the same cell layout and
// differ in the identity cell, so a new company is a STYLES entry, not a new
// painter. Titleblocks are an 11×17 feature — the letter sheet keeps its
// plain placeholder strip.
if (!window.DraftTitleblock) {
(() => {
  const STYLES = Object.freeze([
    Object.freeze({
      id: 'bluejetty',
      label: 'BLUEJETTY',
      company: 'BLUEJETTY',
      logoSrc: './assets/bluejetty.png',
    }),
    Object.freeze({
      id: 'roughdrafter',
      label: 'ROUGH DRAFTER',
      company: 'ROUGH DRAFTER',
      logoSrc: './assets/rough-drafter-logo.png',
    }),
  ]);

  const styleById = id => STYLES.find(style => style.id === id) || null;

  const INK = '#1d1f20';
  const FAINT = 'rgba(29,31,32,0.55)';

  // Cell widths as fractions of the strip: identity, project, drafter,
  // date + scale, sheet number.
  const CELLS = [0.2, 0.34, 0.2, 0.14, 0.12];

  const fit = (ctx, text, maxPx, basePx, family) => {
    let size = basePx;
    ctx.font = `600 ${size}px ${family}`;
    while (size > 6 && ctx.measureText(text).width > maxPx) {
      size -= 1;
      ctx.font = `600 ${size}px ${family}`;
    }
    return size;
  };

  // Draw the strip into box {x, y, w, h} (screen pixels). `info` carries the
  // sheet's words; `logo` is an already-loaded HTMLImageElement or null.
  const draw = (ctx, box, style, info, logo) => {
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

  window.DraftTitleblock = Object.freeze({ STYLES, styleById, draw });
})();
}
