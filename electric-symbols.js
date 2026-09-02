// Electric symbols — the outlet family.
//
// One mark, drawn once and reused: the wall outlet, the floor outlet and the
// ceiling outlet are the same circle-and-two-lines. The boxed pair add a square
// around it, and are told apart only by their label (`FLR` / `CEIL`), so the
// label is drawn by the same function that draws the mark and cannot be
// forgotten by a caller.
//
// Everything is drawn around an origin at the centre of the circle, in the
// device's own frame: +y points away from the mounting surface, so a wall
// device rotates by the wall angle and a floor/ceiling device draws upright.
// Sizes are in paper points at 1:1, scaled by `size` — the circle's diameter —
// so the whole family stays the same size as the wall outlet by construction.

const RED = '#d0021b';

// Proportions of the mark, as fractions of the circle's diameter.
const STEM = 0.62;   // how far the two lines run past the circle
const GAP = 0.34;    // spacing between them, centre to centre
const BOX = 1.9;     // side of the square around the boxed outlets
const LABEL = 0.62;  // label cap height

// The shared mark: a circle with two parallel lines running out of it. Drawn
// at the origin, lines running in +y.
const outletMark = (ctx, size) => {
  const r = size / 2;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.stroke();
  // The two lines run from the circle outward, not through it: they start where
  // they meet the circle, so the mark reads as a receptacle rather than a
  // crossed-out circle at small scale.
  const half = (GAP * size) / 2;
  const start = Math.sqrt(Math.max(0, r * r - half * half));
  const end = r + STEM * size;
  ctx.beginPath();
  ctx.moveTo(-half, start); ctx.lineTo(-half, end);
  ctx.moveTo(half, start); ctx.lineTo(half, end);
  ctx.stroke();
};

// The label that carries the whole distinction between the two boxed outlets.
// Placed clear of the square on the side with the most room; never scaled below
// a legible floor, because an unlabelled square is a box the builder guesses at.
const MIN_LABEL_PX = 7;
const outletLabel = (ctx, size, text, side) => {
  const h = Math.max(MIN_LABEL_PX, LABEL * size);
  ctx.save();
  ctx.font = `${h}px ui-monospace, monospace`;
  ctx.textBaseline = 'middle';
  const off = (BOX * size) / 2 + h;
  if (side === 'below') {
    ctx.textAlign = 'center'; ctx.fillText(text, 0, off);
  } else if (side === 'above') {
    ctx.textAlign = 'center'; ctx.fillText(text, 0, -off);
  } else if (side === 'left') {
    ctx.textAlign = 'right'; ctx.fillText(text, -off, 0);
  } else {
    ctx.textAlign = 'left'; ctx.fillText(text, off, 0);
  }
  ctx.restore();
};

// The wall outlet: the mark on its own, lines running into the room.
const wallOutlet = (ctx, size) => outletMark(ctx, size);

// Floor and ceiling outlets: the same mark, a square around it, and the label.
// `side` is where the label sits — 'above' | 'below' | 'left' | 'right'.
const boxedOutlet = (ctx, size, text, side = 'below') => {
  // The square is centred on the placement point; the mark is nudged up inside
  // it so the circle and its two lines sit centred in the box rather than
  // hanging out of the bottom of it.
  const s = BOX * size;
  ctx.strokeRect(-s / 2, -s / 2, s, s);
  ctx.save();
  ctx.translate(0, -(STEM * size) / 2);
  outletMark(ctx, size);
  ctx.restore();
  outletLabel(ctx, size, text, side);
};

const floorOutlet = (ctx, size, side) => boxedOutlet(ctx, size, 'FLR', side);
const ceilingOutlet = (ctx, size, side) => boxedOutlet(ctx, size, 'CEIL', side);

// Draws one device at a point, rotated into its host's frame. `rotation` is the
// angle the +y axis is turned by: 0 for a floor or ceiling device, the wall's
// inward normal for a wall device.
const drawDevice = (ctx, draw, x, y, size, rotation = 0) => {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);
  ctx.strokeStyle = RED;
  ctx.fillStyle = RED;
  ctx.lineWidth = Math.max(1, size * 0.09);
  ctx.lineCap = 'round';
  draw(ctx, size);
  ctx.restore();
};

const DraftElectricSymbols = Object.freeze({
  RED,
  outletMark,
  wallOutlet,
  floorOutlet,
  ceilingOutlet,
  boxedOutlet,
  drawDevice,
});

if (typeof window !== 'undefined') window.DraftElectricSymbols = DraftElectricSymbols;
if (typeof module !== 'undefined') module.exports = DraftElectricSymbols;
