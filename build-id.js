// THE BUILD STAMP, and the one reload it buys (jb, 10 Nov).
//
// WHAT WENT WRONG. "i can't do anything this keeps poping up": ROUGH-DRAFTER
// HIT A PROBLEM on every load of roughdrafter.com, "H is not defined
// (model/13-suites-trim-follow.js:2875)". Main loaded clean. The browser had
// kept an OLD MODEL.html -- it still showed the TOY chip #949 took out -- and
// ran it against the NEW scripts. A script tripped on a part of the page that
// no longer existed, its names never got defined, and everything after it
// fell over. A page and its scripts are separate files, and nothing tied them
// together; GitHub Pages caches each one for about ten minutes on its own
// clock, and a browser keeps a page as long as it likes.
//
// THE TIE. On deploy, tools/stamp-build.js writes the commit id into every
// dashboard (<meta name="draft-build">), onto every local script and style
// link (?v=<id>), and into the line below. A page therefore names the exact
// scripts it was written for, and a new page can never pick up an old script
// from a cache, because the address is new. In the repo, and on a desk or
// under the tests, the id is 'dev' on both sides and this file does nothing.
//
// THE RELOAD. The ten-minute window at GitHub Pages cannot be closed from
// here: right after a merge, one edge can still hand out the old page while
// another hands out the new scripts. So this file -- the first script every
// dashboard loads -- compares its own stamp with the page's, and when they
// disagree it fetches the page again under a fresh address, ONCE. The same
// retry is offered to error-report.js for a crash during boot on the live
// site, because a mix the stamps did not catch (an old copy of THIS file
// beside new scripts) still shows up as a boot fault. One retry, then the
// card: a genuine crash reloads once and is then reported as before.
//
// NO LOOP. The retry is remembered in sessionStorage for RETRY_HOLD_MS; a
// page that is still mismatched after a fresh fetch is served that way by
// the host and carries on (the stamps make that rare, not impossible).
(() => {
  'use strict';
  const BUILD = 'dev'; // STAMPED ON DEPLOY -- tools/stamp-build.js rewrites this line
  const PARAM = 'draft-fresh';
  const RETRY_KEY = 'draft-build-retried';
  const RETRY_HOLD_MS = 60e3;
  const BOOT_WINDOW_MS = 20e3;
  const started = Date.now();

  const meta = document.querySelector('meta[name="draft-build"]');
  const page = meta ? String(meta.getAttribute('content') || 'dev') : 'dev';
  const live = BUILD !== 'dev' || page !== 'dev';

  const store = {
    get: () => { try { return sessionStorage.getItem(RETRY_KEY); } catch { return null; } },
    set: value => { try { sessionStorage.setItem(RETRY_KEY, value); } catch { /* private window */ } },
  };
  const retriedLately = () => {
    const at = Number(store.get() || 0);
    return Number.isFinite(at) && Date.now() - at < RETRY_HOLD_MS;
  };

  // A fresh address: the same page, with ?draft-fresh=<id> added. The query
  // changes the cache key in the browser AND at the host's edge, so the copy
  // that comes back is the one on main. The param is dropped from the address
  // bar on the next load, below, so it is never bookmarked or shared.
  const freshUrl = () => {
    const url = new URL(location.href);
    url.searchParams.set(PARAM, `${Date.now().toString(36)}`);
    return url.href;
  };
  let reloading = false;
  const retryFresh = why => {
    if (reloading) return true;
    if (!live || retriedLately()) return false;
    store.set(String(Date.now()));
    reloading = true;
    try { console.warn(`BUILD: ${why}; fetching a fresh copy of this page`); } catch { /* no console */ }
    location.replace(freshUrl());
    return true;
  };

  // The retry param has done its job once the page is here; take it off.
  try {
    if (new URLSearchParams(location.search).has(PARAM)) {
      const url = new URL(location.href);
      url.searchParams.delete(PARAM);
      history.replaceState(history.state, '', url.pathname + url.search + url.hash);
    }
  } catch { /* file:// or a locked history */ }

  window.DraftBuild = Object.freeze({
    id: BUILD,
    page,
    live,
    matches: BUILD === page,
    // error-report.js asks this before opening the card for a fault that
    // arrives while the page is still booting on the live site.
    booting: () => Date.now() - started < BOOT_WINDOW_MS,
    reloading: () => reloading,
    retryFresh,
  });

  if (BUILD !== page) retryFresh(`page is build ${page}, scripts are build ${BUILD}`);
})();
