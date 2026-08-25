// The architectural length formatters are pure (formatters.js), so they are
// exercised directly rather than through the drafting UI. The contract under
// test: values live on a sixteenth-inch grid, bare numbers read as FEET in
// drafting inputs but as INCHES in assembly inputs, and parse ⇄ format round
// trips are stable on that grid.
const { test, expect } = require('@playwright/test');

test.beforeEach(async ({ page }) => {
  await page.goto('/MODEL.dc.html');
  await page.waitForFunction(() => !!window.DraftFormatters);
});

test('formatArchitecturalInches prints feet-inches-sixteenths', async ({ page }) => {
  const results = await page.evaluate(() => {
    const f = window.DraftFormatters;
    return {
      zero: f.formatArchitecturalInches(0),
      wholeFeet: f.formatArchitecturalInches(96),
      mixed: f.formatArchitecturalInches(97.125),
      inchesOnly: f.formatArchitecturalInches(5),
      fractionReduces: f.formatArchitecturalInches(0.5),
      negative: f.formatArchitecturalInches(-30),
      notFinite: f.formatArchitecturalInches(NaN),
    };
  });
  expect(results.zero).toBe(`0'-0"`);
  expect(results.wholeFeet).toBe(`8'-0"`);
  expect(results.mixed).toBe(`8'-1 1/8"`);
  expect(results.inchesOnly).toBe(`0'-5"`);
  // 8/16 prints as the reduced fraction, not 8/16.
  expect(results.fractionReduces).toBe(`0'-0 1/2"`);
  expect(results.negative).toBe(`-2'-6"`);
  expect(results.notFinite).toBe('');
});

test('formatInchesOnly prints assembly values as plain inches', async ({ page }) => {
  const results = await page.evaluate(() => {
    const f = window.DraftFormatters;
    return {
      joist: f.formatInchesOnly(11.875),
      spacing: f.formatInchesOnly(16),
      sheathing: f.formatInchesOnly(0.75),
      zero: f.formatInchesOnly(0),
      mixed: f.formatInchesOnly(4.5),
    };
  });
  expect(results.joist).toBe(`11 7/8"`);
  expect(results.spacing).toBe(`16"`);
  // A pure fraction drops the leading zero: 3/4", not 0 3/4".
  expect(results.sheathing).toBe(`3/4"`);
  expect(results.zero).toBe(`0"`);
  expect(results.mixed).toBe(`4 1/2"`);
});

test('parseArchitecturalLength reads the drafting grammar; bare numbers are feet', async ({ page }) => {
  const results = await page.evaluate(() => {
    const f = window.DraftFormatters;
    return {
      bareFeet: f.parseArchitecturalLength('15'),
      feetDashInches: f.parseArchitecturalLength('8-1 1/8'),
      feetMarkInches: f.parseArchitecturalLength(`8' 3`),
      ftWord: f.parseArchitecturalLength('8ft 3'),
      inchesMark: f.parseArchitecturalLength('5"'),
      inchesWord: f.parseArchitecturalLength('5 in'),
      fractionInches: f.parseArchitecturalLength('4 1/16"'),
      zero: f.parseArchitecturalLength('0'),
      negative: f.parseArchitecturalLength(`-2'-6"`),
    };
  });
  expect(results.bareFeet).toEqual({ ok: true, inches: 180 });
  expect(results.feetDashInches).toEqual({ ok: true, inches: 97.125 });
  expect(results.feetMarkInches).toEqual({ ok: true, inches: 99 });
  expect(results.ftWord).toEqual({ ok: true, inches: 99 });
  expect(results.inchesMark).toEqual({ ok: true, inches: 5 });
  expect(results.inchesWord).toEqual({ ok: true, inches: 5 });
  expect(results.fractionInches).toEqual({ ok: true, inches: 4.0625 });
  expect(results.zero).toEqual({ ok: true, inches: 0 });
  expect(results.negative).toEqual({ ok: true, inches: -30 });
});

test('bad input is refused with a message, never NaN', async ({ page }) => {
  const results = await page.evaluate(() => {
    const f = window.DraftFormatters;
    return {
      empty: f.parseArchitecturalLength(''),
      words: f.parseArchitecturalLength('about eight feet'),
      zeroDenominator: f.parseArchitecturalLength('1/0"'),
      assemblyWords: f.parseAssemblyInches('thick'),
    };
  });
  expect(results.empty.ok).toBe(false);
  expect(results.empty.error).toBeTruthy();
  expect(results.words.ok).toBe(false);
  expect(results.zeroDenominator.ok).toBe(false);
  expect(results.assemblyWords.ok).toBe(false);
});

test('parseAssemblyInches reads bare numbers as inches, not feet', async ({ page }) => {
  const results = await page.evaluate(() => {
    const f = window.DraftFormatters;
    return {
      spacing: f.parseAssemblyInches('16'),
      sheathing: f.parseAssemblyInches('3/4'),
      joist: f.parseAssemblyInches('11 7/8'),
      feetMarked: f.parseAssemblyInches(`1'-4`),
      zeroFallsThrough: f.parseAssemblyInches('0'),
    };
  });
  expect(results.spacing).toEqual({ ok: true, inches: 16 });
  expect(results.sheathing).toEqual({ ok: true, inches: 0.75 });
  expect(results.joist).toEqual({ ok: true, inches: 11.875 });
  // Anything with feet marks still parses architecturally.
  expect(results.feetMarked).toEqual({ ok: true, inches: 16 });
  expect(results.zeroFallsThrough).toEqual({ ok: true, inches: 0 });
});

test('values snap to the sixteenth grid and round trips are stable', async ({ page }) => {
  const results = await page.evaluate(() => {
    const f = window.DraftFormatters;
    // 5.03" is off-grid; the parser lands it on the nearest sixteenth.
    const offGrid = f.parseArchitecturalLength('5.03"');
    // parse(format(x)) must return exactly x for on-grid values…
    const values = [0, 5, 96, 97.125, 11.875, 0.0625, -30, 143.9375];
    const roundTrips = values.map(inches => {
      const printed = f.formatArchitecturalInches(inches);
      const back = f.parseArchitecturalLength(printed);
      return { inches, printed, back };
    });
    // …and format(parse(s)) must reprint canonical strings unchanged.
    const strings = [`8'-1 1/8"`, `0'-0"`, `-2'-6"`, `11'-11 15/16"`];
    const reprints = strings.map(text =>
      f.formatArchitecturalInches(f.parseArchitecturalLength(text).inches));
    return { offGrid, roundTrips, reprints, strings };
  });
  expect(results.offGrid).toEqual({ ok: true, inches: 5 });
  results.roundTrips.forEach(({ inches, printed, back }) => {
    expect(back.ok, `${printed} should parse`).toBe(true);
    expect(back.inches, `round trip of ${inches} via ${printed}`).toBe(inches);
  });
  expect(results.reprints).toEqual(results.strings);
});
