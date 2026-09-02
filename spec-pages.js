// Flowing the specification into columns and pages.
//
// A spec page is three columns of text on 11 x 8.5 landscape, and the thing
// that makes it read well is where the breaks land. The rule the office sheets
// follow, and the one this implements: FILL the columns, then break. Breaking
// at a section start instead leaves a quarter-empty page and a spec twice as
// long as it needs to be.
//
// Pure: measured heights in, an assignment of items to columns out. No DOM, so
// the flow can be tested without rendering anything. The page measures once,
// calls this, and paints.
if (!window.DraftSpecPages) {
(() => {

  // items: [{ key, h, keepWithNext }]
  //   h            — measured height in px
  //   keepWithNext — a heading: it must not be the last thing in a column, and
  //                  it must keep at least KEEP_LINES of what follows with it.
  //                  A heading alone at the foot of a column is a lie about
  //                  where the section starts.
  // Returns pages: [[column, column, column], ...] of item keys.
  const KEEP_LINES = 2;

  const flow = (items, columnHeight, columnsPerPage = 3) => {
    const pages = [];
    let page = [];
    let column = [];
    let used = 0;

    const closeColumn = () => {
      page.push(column);
      column = [];
      used = 0;
      if (page.length >= columnsPerPage) { pages.push(page); page = []; }
    };

    for (let i = 0; i < items.length; i += 1) {
      const item = items[i];
      // A heading drags its first lines along: measure the block it must not
      // be separated from, and move the whole block if it does not fit.
      // Headings run in twos — a division rule immediately followed by the
      // first section heading under it — so the run is walked to its end
      // before the lines are counted. Stopping at the first heading was the
      // bug: the division rule fitted, the section heading did not, and the
      // rule printed at the foot of a column with its division on the next.
      let block = item.h;
      if (item.keepWithNext) {
        let k = i + 1;
        while (items[k] && items[k].keepWithNext) { block += items[k].h; k += 1; }
        for (let n = 0; n < KEEP_LINES && items[k + n]; n += 1) block += items[k + n].h;
      }
      // A single item taller than a whole column cannot be moved anywhere that
      // helps — it goes where it is and overflows rather than emptying a
      // column ahead of itself and overflowing there instead.
      const tooTall = item.h > columnHeight;
      if (!tooTall && used > 0 && used + block > columnHeight) closeColumn();
      column.push(item.key);
      used += item.h;
      if (used >= columnHeight) closeColumn();
    }

    if (column.length) page.push(column);
    if (page.length) {
      while (page.length < columnsPerPage) page.push([]);
      pages.push(page);
    }
    return pages;
  };

  window.DraftSpecPages = { flow, KEEP_LINES };
})();
}
