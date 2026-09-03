// Length formatting and parsing shared by the Model Space.
// Everything here is pure — strings and numbers in, strings and numbers out:
// no state, no DOM, no THREE. The ARCHITECTURAL functions snap to the
// sixteenth-inch grid they print, so a parse → format round trip is stable.
//
// The metric side lives here too. It arrived late because the module was
// imperial-only and nothing had asked it for metres: a page wiring the
// dimension painter has to answer env.label, and that answer is
// units-dependent, so a formatter module that cannot print metres sends every
// caller back to the page it was extracted from.
if (!window.DraftFormatters) {
(() => {
  const SIXTEENTH_IN = 1 / 16;

  function _reduceFraction(n, d) {
    const gcd = (a, b) => b ? gcd(b, a % b) : a;
    const factor = gcd(n, d);
    return [n / factor, d / factor];
  }

  function formatArchitecturalInches(totalInches) {
    if (!Number.isFinite(totalInches)) return '';
    const negative = totalInches < 0;
    const sixteenths = Math.round(Math.abs(totalInches) / SIXTEENTH_IN);
    const wholeInches = Math.floor(sixteenths / 16);
    const numerator = sixteenths % 16;
    const feet = Math.floor(wholeInches / 12);
    const inches = wholeInches % 12;
    let result = `${negative ? '-' : ''}${feet}'-${inches}`;
    if (numerator) {
      const [n, d] = _reduceFraction(numerator, 16);
      result += ` ${n}/${d}`;
    }
    return result + '"';
  }

  // Inch-scale assembly values (joist depth, spacing, sheathing) read naturally
  // as plain inches: 11 7/8", 16", 3/4".
  function formatInchesOnly(totalInches) {
    if (!Number.isFinite(totalInches)) return '';
    const negative = totalInches < 0;
    const sixteenths = Math.round(Math.abs(totalInches) / SIXTEENTH_IN);
    const wholeInches = Math.floor(sixteenths / 16);
    const numerator = sixteenths % 16;
    let body = '';
    if (wholeInches || !numerator) body = String(wholeInches);
    if (numerator) {
      const [n, d] = _reduceFraction(numerator, 16);
      body += body ? ` ${n}/${d}` : `${n}/${d}`;
    }
    return `${negative ? '-' : ''}${body}"`;
  }

  // Metres, to the millimetre. A metric drawing's grid IS the millimetre
  // (board NEW-5), so three decimals is the whole precision of the system --
  // not a display choice that could be widened later without changing what
  // the drawing means.
  //
  // NO Number.isFinite GUARD, deliberately, and not an oversight. Its
  // neighbours above return '' for a non-finite input and consistency argued
  // for matching them -- but this function arrived by being MOVED out of
  // MODEL.dc.html, and a move that changes behaviour is not a move. The old
  // _metric printed 'NaN m'.
  //
  // The question is real and belongs to all three, not to this one: '' is
  // silent, and a dimension that prints nothing looks like a dimension that
  // is not there, while 'NaN m' tells a drafter something is wrong. Whether
  // it can happen at all is half-answered: drawing-format.js rejects
  // non-finite coordinates on load (num() at :14 returns null and the entity
  // lands in `skipped`), so a LOADED drawing cannot reach here with a NaN.
  // The live readouts during a drag are computed in memory and were not
  // traced. Half a proof is not the unreachability argument, so the loud
  // behaviour stays until someone rules on all three together.
  function formatMetres(feet) {
    return (feet * 0.3048).toFixed(3) + ' m';
  }

  function normalizeArchitecturalInches(totalInches) {
    return Math.round(totalInches / SIXTEENTH_IN) * SIXTEENTH_IN;
  }

  function architecturalLengthResult(inches) {
    return { ok: true, inches: normalizeArchitecturalInches(inches) };
  }

  function parseInchesComponent(value) {
    const text = String(value || '').trim()
      .replace(/(?:inches|inch|in)\.?$/i, '')
      .replace(/"$/g, '')
      .trim();
    if (!text) return { ok: true, inches: 0 };
    let match = text.match(/^(\d+(?:\.\d+)?)\s+(\d+)\s*\/\s*(\d+)$/);
    if (match) {
      const denominator = Number(match[3]);
      if (!denominator) return { ok: false, error: 'The fraction denominator cannot be zero.' };
      return { ok: true, inches: Number(match[1]) + Number(match[2]) / denominator };
    }
    match = text.match(/^(\d+)\s*\/\s*(\d+)$/);
    if (match) {
      const denominator = Number(match[2]);
      if (!denominator) return { ok: false, error: 'The fraction denominator cannot be zero.' };
      return { ok: true, inches: Number(match[1]) / denominator };
    }
    if (/^\d+(?:\.\d+)?$/.test(text)) return { ok: true, inches: Number(text) };
    return { ok: false, error: 'Use inches such as 4, 4 1/16, or 4.5.' };
  }

  function parseArchitecturalLength(value) {
    const raw = String(value ?? '').trim();
    if (!raw) return { ok: false, error: 'Enter a dimension such as 8-1 1/8.' };
    if (/^[+-]?0(?:\.0+)?$/.test(raw)) return architecturalLengthResult(0);

    let match = raw.match(/^([+-]?\d+(?:\.\d+)?)\s*(?:'|ft)\s*(.*)$/i);
    if (match) {
      const feetValue = Number(match[1]);
      const inchesText = match[2].replace(/^-/, '').trim();
      const parsedInches = parseInchesComponent(inchesText);
      if (!parsedInches.ok) return parsedInches;
      const sign = match[1].startsWith('-') ? -1 : 1;
      return architecturalLengthResult(sign * (Math.abs(feetValue) * 12 + parsedInches.inches));
    }

    match = raw.match(/^([+-]?\d+)\s*-\s*(.+)$/);
    if (match) {
      const parsedInches = parseInchesComponent(match[2]);
      if (!parsedInches.ok) return parsedInches;
      const feetValue = Number(match[1]);
      const sign = match[1].startsWith('-') ? -1 : 1;
      return architecturalLengthResult(sign * (Math.abs(feetValue) * 12 + parsedInches.inches));
    }

    if (/(?:inches|inch|in)\.?$|"$/.test(raw)) {
      const sign = raw.startsWith('-') ? -1 : 1;
      const parsed = parseInchesComponent(raw.replace(/^[+-]/, ''));
      return parsed.ok ? architecturalLengthResult(sign * parsed.inches) : parsed;
    }

    if (/^[+-]?\d+(?:\.\d+)?$/.test(raw)) {
      return architecturalLengthResult(Number(raw) * 12);
    }

    return { ok: false, error: `Use 15 for feet, or specify inches as 0-5 or 5".` };
  }

  // Joist depth, spacing, and sheathing are inch-scale values, so a bare number
  // or fraction reads as inches; anything with feet marks parses architecturally.
  function parseAssemblyInches(value) {
    const component = parseInchesComponent(String(value ?? '').trim());
    if (component.ok && component.inches > 0) return architecturalLengthResult(component.inches);
    return parseArchitecturalLength(value);
  }

  window.DraftFormatters = {
    formatArchitecturalInches,
    formatInchesOnly,
    formatMetres,
    parseArchitecturalLength,
    parseAssemblyInches,
  };
})();
}
