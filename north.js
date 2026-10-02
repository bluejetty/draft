// THE TWO NORTHS: construction north and true north.
//
// Movie, 1 Oct: "it needs 2 North arrows actually one MAIN arrow (construction
// North 90degree north) and a 2nd one that can be adjusted by degree moving
// left or right of the north arrow (thats the TRUE north)", "make the TRUE
// north arrow slightly greyer, not as dark as the CONSTRUCTION north arrow",
// and "they click on it and a box pops up with both true north on left and
// construction north on right" -- construction north by 90, true north by 1.
// And the same button on the layout page: "make those 2 buttons match ... and
// what they do".
//
// THE RECORD is `{ cn, tn }`: cn the quarter turns construction north stands
// clockwise of straight up the plan (0..3), tn the whole degrees true north
// stands right (+) or left (-) of construction north (-179..180). It is saved
// on the drawing's layout record, the one key both MODEL and the Construction
// Layout may write, so either page's change is the other's.
//
// Plain data in, canvas or DOM out; no page state.
if (!window.DraftNorth) {
(() => {
  const wrapDeg = deg => {
    const d = ((Math.round(Number(deg) || 0) + 180) % 360 + 360) % 360 - 180;
    return d === -180 ? 180 : d;
  };
  const normalise = raw => ({
    cn: ((Math.round(Number(raw?.cn) || 0) % 4) + 4) % 4,
    tn: wrapDeg(raw?.tn),
  });
  const cnDeg = north => normalise(north).cn * 90;
  const tnDeg = north => { const n = normalise(north); return n.cn * 90 + n.tn; };
  const tnLabel = north => {
    const t = normalise(north).tn;
    return t === 0 ? '0°' : `${Math.abs(t)}° ${t > 0 ? 'R' : 'L'}`;
  };

  // ONE NEEDLE: a line from the centre out to an arrowhead, turned clockwise
  // from straight up by `deg`, with its letter just past the tip.
  const needle = (ctx, cx, cy, r, deg, color, letter, width, letterAt = 1.3) => {
    const a = deg * Math.PI / 180;
    const ux = Math.sin(a), uy = -Math.cos(a);
    const px = -uy, py = ux;
    const tip = { x: cx + ux * r, y: cy + uy * r };
    const base = { x: cx + ux * r * 0.55, y: cy + uy * r * 0.55 };
    ctx.save();
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(cx - ux * r * 0.6, cy - uy * r * 0.6);
    ctx.lineTo(base.x, base.y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(tip.x, tip.y);
    ctx.lineTo(base.x + px * r * 0.2, base.y + py * r * 0.2);
    ctx.lineTo(base.x - px * r * 0.2, base.y - py * r * 0.2);
    ctx.closePath();
    ctx.fill();
    ctx.font = `600 ${Math.max(9, r * 0.5)}px 'Barlow Condensed', sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(letter, cx + ux * r * letterAt, cy + uy * r * letterAt);
    ctx.restore();
  };

  // BOTH ARROWS, true north first so construction north sits on top of it:
  // CN dark and heavier (the main one), TN grey and lighter.
  const drawPair = (ctx, cx, cy, r, north, { cnColor = '#1d1f20', tnColor = '#8c9196' } = {}) => {
    const n = normalise(north);
    ctx.save();
    ctx.strokeStyle = cnColor;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.62, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    // THE LETTERS AT TWO RADII, so two needles a few degrees apart do not
    // stack their labels: TN just past its own tip, CN further out.
    if (n.tn !== 0) needle(ctx, cx, cy, r * 0.85, tnDeg(n), tnColor, 'TN', 1, 1.28);
    needle(ctx, cx, cy, r, cnDeg(n), cnColor, n.tn !== 0 ? 'CN' : 'N', 1.5, 1.55);
  };

  // The button's face: the N arrow pointing the way construction north is set.
  const iconSvg = (north, size = 18) => {
    const deg = cnDeg(north);
    return `<svg width="${size}" height="${size}" viewBox="0 0 16 16" fill="none" stroke="currentColor"`
      + ` stroke-width="1.3" aria-hidden="true"><g transform="rotate(${deg} 8 8)">`
      + '<path d="M8 13 V5"></path><path d="M8 2 L10.4 6.2 L5.6 6.2 Z" fill="currentColor"></path>'
      + '</g><text x="12.6" y="14.6" font-size="5" fill="currentColor" stroke="none"'
      + ' font-family="Barlow Condensed, sans-serif">N</text></svg>';
  };

  // ── THE POPUP: TRUE NORTH on the left, CONSTRUCTION NORTH on the right ──
  // Each with its arrow, its value and a ◀ ▶ pair: true north a degree a
  // press, construction north a quarter. `onChange(next)` hands the page the
  // new record; the page saves it and calls `update(next)` if it stays open.
  let open = null;
  const closePopup = () => {
    if (!open) return;
    open.el.remove();
    document.removeEventListener('pointerdown', open.outside, true);
    document.removeEventListener('keydown', open.key, true);
    open = null;
  };
  const openPopup = (anchor, north, onChange) => {
    if (open) { closePopup(); return null; }
    let state = normalise(north);
    const el = document.createElement('div');
    el.dataset.northPopup = '';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-label', 'North');
    el.style.cssText = 'position:fixed; z-index:60; display:flex; gap:14px; padding:10px 12px;'
      + ' border-radius:6px; border:1px solid var(--edge-panel,#555);'
      + ' background: var(--surface-panel,#222); color: var(--ink-primary,#eee);'
      + " font-family: var(--font-ui,'Barlow Condensed',sans-serif); font-size:11px;"
      + ' font-weight:600; letter-spacing:0.06em; box-shadow:0 4px 18px rgba(0,0,0,0.35);';
    const column = (key, title, step, stepLabel) => {
      const col = document.createElement('div');
      col.style.cssText = 'display:flex; flex-direction:column; align-items:center; gap:6px;';
      const head = document.createElement('div');
      head.textContent = title;
      const canvas = document.createElement('canvas');
      canvas.width = 84; canvas.height = 84;
      canvas.dataset.northArrow = key;
      const row = document.createElement('div');
      row.style.cssText = 'display:flex; align-items:center; gap:6px;';
      const button = (dir, glyph) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.dataset.north = `${key}-${dir}`;
        b.textContent = glyph;
        b.title = `${title}: ${dir === 'left' ? '-' : '+'}${stepLabel}`;
        b.style.cssText = 'font:inherit; padding:2px 8px; border-radius:4px; cursor:pointer;'
          + ' border:1px solid var(--edge-panel,#555); background:transparent; color:inherit;';
        b.addEventListener('click', () => {
          const sign = dir === 'left' ? -1 : 1;
          state = normalise(key === 'cn'
            ? { ...state, cn: state.cn + sign * step }
            : { ...state, tn: state.tn + sign * step });
          paint();
          onChange(state);
        });
        return b;
      };
      const value = document.createElement('span');
      value.dataset.northValue = key;
      value.style.cssText = 'min-width:44px; text-align:center;';
      row.append(button('left', '◀'), value, button('right', '▶'));
      col.append(head, canvas, row);
      return { col, canvas, value };
    };
    const tn = column('tn', 'TRUE NORTH', 1, '1°');
    const cn = column('cn', 'CONSTRUCTION NORTH', 1, '90°');
    el.append(tn.col, cn.col);
    const paint = () => {
      tn.value.textContent = tnLabel(state);
      cn.value.textContent = `${cnDeg(state)}°`;
      [[tn.canvas, tnDeg(state), '#8c9196', 'TN'], [cn.canvas, cnDeg(state), 'currentColor', 'N']]
        .forEach(([canvas, deg, color, letter]) => {
          const ctx = canvas.getContext('2d');
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          const ink = color === 'currentColor' ? getComputedStyle(el).color : color;
          needle(ctx, 42, 46, 26, deg, ink, letter, 2);
        });
    };
    document.body.append(el);
    const box = anchor.getBoundingClientRect();
    const w = el.offsetWidth, h = el.offsetHeight;
    el.style.left = `${Math.max(8, Math.min(window.innerWidth - w - 8, box.left + box.width / 2 - w / 2))}px`;
    el.style.top = `${Math.max(8, box.top - h - 8)}px`;
    paint();
    const outside = e => { if (!el.contains(e.target) && !anchor.contains(e.target)) closePopup(); };
    const key = e => { if (e.key === 'Escape') { e.stopPropagation(); closePopup(); } };
    document.addEventListener('pointerdown', outside, true);
    document.addEventListener('keydown', key, true);
    open = { el, outside, key };
    return el;
  };

  window.DraftNorth = Object.freeze({
    normalise, cnDeg, tnDeg, tnLabel, drawPair, iconSvg, openPopup, closePopup,
  });
})();
}
