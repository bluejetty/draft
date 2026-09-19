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
  var homeOf = function () {
    return document.querySelector('[data-visit-counter-home]')
      || document.querySelector('[data-project-corner-bl]');
  };

  var mount = function (label) {
    var anchor = homeOf();
    var el = document.createElement('a');
    el.setAttribute('data-traffic-counter', '');
    el.href = base;
    el.target = '_blank';
    el.rel = 'noopener';
    el.title = 'Page visits — the full public count lives here';
    el.textContent = label;
    var common = 'font-family:\'Barlow Condensed\',system-ui,sans-serif; font-size:10px; font-weight:600; letter-spacing:0.06em; color:rgba(29,31,32,0.45); text-decoration:none; white-space:nowrap;';
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
