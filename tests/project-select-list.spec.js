// THE OPEN DROPDOWN IS A PLATFORM WIDGET, AND IT HAD NO COLOUR.
//
// Movie, 28 Sep, with the FDN TYPE list open on NIGHT: "the menu should be
// darker grey or the text should be darker (if background in this selection
// menu remains white)". The closed control was skinned; the list that drops
// out of it came up OS-white with the page's own pale ink on it.
//
// THE LIST CANNOT BE SCREENSHOT. It is drawn by the browser outside the page,
// so a page screenshot shows nothing and a pixel check would pass on a bug.
// What IS in the page is the rule the browser reads, so that is what this
// asserts: every option on the page carries the chip surface the control
// itself wears, in both skins, with ink the page already pairs with it.
const { test, expect } = require('@playwright/test');

const rgb = css => (css.match(/\d+(\.\d+)?/g) || []).slice(0, 3).map(Number);
const same = (a, b) => a.length === 3 && b.length === 3
  && a.every((v, i) => Math.abs(v - b[i]) < 2);

// WCAG relative luminance, so "readable" is measured rather than eyeballed.
const contrast = (fg, bg) => {
  const lum = c => {
    const f = c.map(v => {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * f[0] + 0.7152 * f[1] + 0.0722 * f[2];
  };
  const a = lum(fg), b = lum(bg);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
};

const readOptions = page => page.evaluate(() => {
  const chip = getComputedStyle(document.documentElement)
    .getPropertyValue('--surface-chip').trim();
  const out = [];
  document.querySelectorAll('select').forEach(select => {
    select.querySelectorAll('option').forEach(option => {
      const s = getComputedStyle(option);
      out.push({
        background: s.backgroundColor,
        color: s.color,
        // A DISABLED ROW IS MEANT TO BE MUTED, so it is reported and not
        // measured: the top bar's file-extension list greys its options and
        // that is the control saying they cannot be picked.
        off: option.disabled || select.disabled,
      });
    });
  });
  // The chip as the browser resolves it, so the comparison is rgb to rgb.
  const probe = document.createElement('span');
  probe.style.backgroundColor = chip;
  document.body.appendChild(probe);
  const resolved = getComputedStyle(probe).backgroundColor;
  probe.remove();
  return { out, chip: resolved };
});

for (const mode of ['night', 'day']) {
  test(`every option on PROJECT carries the page's own surface on ${mode}`,
    async ({ page }) => {
      await page.goto('/PROJECT.html?type=detached');
      await expect(page.locator('#detached-canvas')).toBeVisible();
      if (mode === 'day') {
        await page.locator('[data-mode-switch] [data-skin-mode="day"]').click();
        await page.waitForTimeout(400);
      }

      const { out, chip } = await readOptions(page);
      // The page has selects, or this asserts nothing: FDN TYPE, ATTACHMENT
      // and the wall types are all lists.
      expect(out.length).toBeGreaterThan(3);

      const want = rgb(chip);
      for (const { background, color, off } of out) {
        expect(same(rgb(background), want)).toBe(true);
        // AND THE TEXT ON IT IS READABLE, which is the fault he reported --
        // pale ink on a white list, not a missing declaration.
        if (!off) expect(contrast(rgb(color), want)).toBeGreaterThan(4.5);
      }
      // The muted rows are not the whole page, or the line above is a pass
      // bought by skipping everything.
      expect(out.filter(o => !o.off).length).toBeGreaterThan(3);
    });
}
