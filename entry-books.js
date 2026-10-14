// THE BOOK SHELF ON THE ENTRY PAGE'S LEFT-HAND COLUMN.
//
// Movie, 14 Oct, drawn over the page in GIMP (a red box down the left) and
// then said: "i'd like the left column to be EBAY links to recommended
// ARCHITECTURAL books I will send you links and make sure you get my partner
// info for affiliate commissions", "RED area - EBAY book links", and -- once
// the first two had arrived -- "can you keep adding them to a list and once i
// fill up the column, just randomly show them each time show different ones
// from the list".
//
// SO THIS FILE IS THE LIST, AND NOTHING ELSE. The page asks it for as many as
// its column holds and draws them; adding a book is one entry here and no
// other edit anywhere. That is the whole reason it is a module rather than
// markup: he is going to keep sending links.
//
// THE URL IS STORED EXACTLY AS HE SENDS IT. Every one of these carries his
// eBay Partner Network tracking -- campid, customid, toolid, mkrid, mkevt --
// and a URL rebuilt from parts here would be a second copy of his partner
// details to go stale, or, worse, a link that pays nobody. Nothing in this
// file parses or rewrites a link; the page prints the href it is given.
if (!window.DraftEntryBooks) {
(() => {
  // `title` is what the cell says and `by` rides under it. Both are short on
  // purpose: a ring cell is about a logo-half wide and a wrapped third line
  // pushes the row out of its square.
  const BOOKS = Object.freeze([
    Object.freeze({
      title: 'ARCHITECTURAL GRAPHICS',
      by: 'Ching',
      href: 'https://www.ebay.ca/sch/i.html?_nkw=Architectural+Graphics+by+Ching%2C+Francis+D.+K.&_sacat=0&_from=R40&_trksid=p2332490.m570.l1313&mkcid=1&mkrid=706-53473-19255-0&siteid=2&campid=5339133571&customid=rough&toolid=10001&mkevt=1',
    }),
    Object.freeze({
      title: 'BUILDING CONSTRUCTION ILLUSTRATED',
      by: 'Ching',
      href: 'https://www.ebay.ca/sch/i.html?_nkw=Building+Construction+Illustrated+-+Paperback%2C+by+Ching+Francis+D.+&_sacat=0&_from=R40&_trksid=p2334524.m570.l1313&_odkw=ching+book+details+architectural&_osacat=0&mkcid=1&mkrid=706-53473-19255-0&siteid=2&campid=5339133571&customid=rough&toolid=10001&mkevt=1',
    }),
    // A SEARCH RATHER THAN ONE EDITION, which is what his links are: eBay
    // stock turns over, and a link to a single listing is a dead link by next
    // month. `by` is left off where the search is the subject rather than an
    // author's title.
    Object.freeze({
      title: 'FRANK LLOYD WRIGHT',
      by: 'Residential construction',
      href: 'https://www.ebay.ca/sch/i.html?_nkw=frank+llyoud+wright+residential+construction&_sacat=0&_from=R40&_trksid=p2334524.m570.l1313&_odkw=Building+Construction+Illustrated+-+Paperback%2C+by+Ching+Francis+D.+&_osacat=0&mkcid=1&mkrid=706-53473-19255-0&siteid=2&campid=5339133571&customid=rough&toolid=10001&mkevt=1',
    }),
    Object.freeze({
      title: 'CANADIAN WOOD-FRAME HOUSE CONSTRUCTION',
      by: 'CMHC',
      href: 'https://www.ebay.ca/sch/i.html?_nkw=CANADIAN+WOOD+FRAME+HOUSE+CONSTRUCTION++CMHC&_sacat=0&_from=R40&_trksid=m570.l1313&_odkw=Canada+CMHC++Residential+Construction&_osacat=0&mkcid=1&mkrid=706-53473-19255-0&siteid=2&campid=5339133571&customid=rough&toolid=10001&mkevt=1',
    }),
  ]);

  // ── WHICH OF THEM THIS VISIT SHOWS ───────────────────────────────────────
  //
  // "once i fill up the column, just randomly show them each time show
  // different ones from the list". So: a shuffle, cut to the column's length.
  //
  // WITHOUT REPEATS, which is the half of "different ones" that a naive
  // `list[random()]` per cell gets wrong -- two cells showing the same book is
  // exactly what he is asking not to see.
  //
  // AND IT IS STABLE WHILE THE LIST IS SHORT: fewer books than cells means
  // every book is shown, in the order they were added, with no shuffle at all.
  // A list of two that reordered itself on every load would look like a bug
  // rather than a rotation, and the rotation is only worth anything once the
  // list outgrows the column -- which is what he said.
  //
  // `rng` IS A PARAMETER so the harness can hand it a counter and get a known
  // answer back. The page passes nothing and gets Math.random.
  const pickBooks = (count, { rng = Math.random, list = BOOKS } = {}) => {
    const want = Math.max(0, Math.floor(Number(count) || 0));
    const all = Array.isArray(list) ? list.filter(Boolean) : [];
    if (!want) return [];
    if (all.length <= want) return all.slice();
    // Fisher-Yates over a copy, then the first `want`. Shuffling the whole
    // list rather than drawing one at a time is what keeps it repeat-free by
    // construction instead of by a retry loop.
    const pool = all.slice();
    for (let i = pool.length - 1; i > 0; i -= 1) {
      const j = Math.floor(rng() * (i + 1));
      const swap = pool[i]; pool[i] = pool[j]; pool[j] = swap;
    }
    return pool.slice(0, want);
  };

  window.DraftEntryBooks = Object.freeze({ BOOKS, pickBooks });
})();
}
