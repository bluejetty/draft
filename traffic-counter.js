// TRAFFIC COUNTER — the one deliberate off-site voice in the app (see
// tests/no-third-party.spec.js). Each page load reports one hit to the
// GoatCounter service, and the page wears its running visit count in the
// lower-left corner — to the right of the PROJECT button where a strip has
// one. The numbers are public: the label links to the open dashboard.
//
// Fail-silent by design: the hit and the count read are async, off the
// critical path, and a blocked or offline route to the counter host leaves
// the page complete — the label simply never appears. Local serving
// (localhost, 127.0.0.1, file:) reports nothing at all, so the test suite
// and a dev desk never inflate the numbers or speak off-site.
(function () {
  'use strict';

  // GoatCounter site code — the counts live at https://<SITE>.goatcounter.com
  var SITE = 'roughdrafter';

  var host = location.hostname;
  if (!host || host === 'localhost' || host === '127.0.0.1' || host === '[::1]') return;

  var path = location.pathname || '/';
  var base = 'https://' + SITE + '.goatcounter.com';

  // Report the hit: a plain image request, no third-party script runs here.
  var beacon = new Image(1, 1);
  beacon.src = base + '/count?p=' + encodeURIComponent(path) + '&rnd=' + Date.now();

  // WHERE A PAGE WANTS IT, IF IT SAYS. Every page but one is happy with the
  // corner beside PROJECT; MODEL.html is not, because its lower left is two
  // bars deep and the count belongs on the instruments row rather than on
  // the row of page links (Movie, 19 Sep: "lets put it on lower left (2nd row
  // from bottom to the left of 'STATUS READOUT'"). A page that names a home
  // gets it, and the module learns no page names -- which is the difference
  // between this and an `if (MODEL.html)` here.
  //
  // NAMED HOME MEANS INSIDE IT; the PROJECT corner means AFTER it. That is
  // not an inconsistency: the corner is a link the count stands beside, and
  // a named home is an empty slot that exists to be filled.
  //
  // THE PROJECT-CORNER FALLBACK STILL APPLIES -- BUT ONLY WHILE THE LINK IS
  // STILL A CORNER. Movie, 23 Sep: "the 12 visits shouldn't be mixed into the
  // views listings." The anchor was written when [data-project-corner-bl] was
  // a lone link in the bottom-left; the shared bars made it a chip in the
  // PAGE ROW, and the count landed between PROJECT and MODEL, reading as a
  // seventh page. The rule two paragraphs up said so all along -- the count
  // belongs on the instruments row, not on the row of page links.
  //
  // SO THE TEST IS WHERE THE LINK LIVES, not which page it is on. Deleting
  // the fallback outright was the first attempt and it was too broad:
  // MODEL.dc.html has no named home and its corner link IS a corner, so that
  // page would have lost its count to the floating fallback. The condition
  // keeps the old page exactly as it was and fixes the new ones, without
  // either of them being named here.
  var homeOf = function () {
    var named = document.querySelector('[data-visit-counter-home]');
    if (named) return named;
    var corner = document.querySelector('[data-project-corner-bl]');
    return (corner && !corner.closest('#page-row')) ? corner : null;
  };

  // A PAGE WITH A BOTTOM BAR BUT NO NAMED HOME GETS NO COUNT. The floating
  // corner below sits at bottom:8px, which is inside the bar -- so the
  // alternative to this is a count printed over the page row. Those pages
  // have a place for it (the readout slot in #lower-left) and can mount one
  // the day they want it; until then the count stays in model space, which is
  // what was asked for. The seven bar-less pages are untouched.
  var barredButHomeless = function () {
    return !homeOf() && !!document.getElementById('house-strip');
  };

  var mount = function (label) {
    if (barredButHomeless()) return;
    var anchor = homeOf();
    var el = document.createElement('a');
    el.setAttribute('data-traffic-counter', '');
    el.href = base;
    el.target = '_blank';
    el.rel = 'noopener';
    el.title = 'Page visits — the full public count lives here';
    el.textContent = label;
    // THE INK ASKS THE PAGE FIRST, and the literal is only the fallback.
    //
    // rgba(29,31,32,0.45) is 45% of #1d1f20, which is INK FOR A WHITE PAGE.
    // Seven of the eight pages that carry this module are white and it is
    // right on all of them. MODEL.html is not: it loads palette.js, it
    // defaults to the NIGHT skin, and --surface-page there is #1d1f20 -- the
    // same colour. Composited, that is a contrast ratio of 1.00:1. Not dim,
    // not low-contrast: the count would paint in exactly the colour of the
    // page behind it and be invisible, on the one page the whole named-slot
    // change was made for. Measured on the day skin too, where the literal
    // gives 2.75:1 against #f2f2f3 -- under the 4.5:1 small text wants, so
    // that one was quietly wrong as well.
    //
    // --ink-quiet IS THE TOKEN FOR EXACTLY THIS -- palette.js:37 calls it
    // "hints and captions, deliberately below the fold" -- and it is repainted
    // for whichever skin is in force: 5.08:1 on night, 4.82:1 on day.
    //
    // THE FALLBACK IS NOT A LEFTOVER. Only MODEL.html defines the token; the
    // other seven pages have no palette.js and no --role custom properties at
    // all, so `var(--ink-quiet, ...)` resolves to the literal there and those
    // pages are byte-for-byte what they were. That is the whole reason this is
    // a var() with a fallback rather than a second colour to keep in step.
    var common = 'font-family:\'Barlow Condensed\',system-ui,sans-serif; font-size:10px; font-weight:600; letter-spacing:0.06em; color:var(--ink-quiet, rgba(29,31,32,0.45)); text-decoration:none; white-space:nowrap;';
    if (anchor) {
      el.style.cssText = common + ' display:inline-flex; align-items:center; height:20px; padding:0 6px; flex-shrink:0;';
      if (anchor.hasAttribute('data-visit-counter-home')) anchor.appendChild(el);
      else anchor.insertAdjacentElement('afterend', el);
    } else {
      el.style.cssText = common + ' position:fixed; left:12px; bottom:8px; z-index:40;';
      document.body.appendChild(el);
    }
  };

  // Read the public count for this page. The PROJECT anchor lives inside a
  // framework-rendered strip that may arrive after load, so give it a few
  // beats before settling for the fixed corner.
  var show = function (label, tries) {
    if (homeOf() || tries <= 0 || document.readyState !== 'loading') {
      if (document.body) return mount(label);
    }
    setTimeout(function () { show(label, tries - 1); }, 300);
  };

  fetch(base + '/counter/' + path + '.json')
    .then(function (res) { return res.ok ? res.json() : null; })
    .then(function (data) {
      if (data && data.count) show(String(data.count).trim() + ' VISITS', 10);
    })
    .catch(function () { /* blocked or offline — the page owes nothing */ });
})();
