#!/usr/bin/env node
// THE VISIT COUNTER, OFF THE WIRE.
//
// This is the ONE module in the app that speaks to another company's server,
// which is why tests/no-third-party.spec.js knows its name. Two things about
// it are worth a harness and neither can be asked in a browser test without
// actually reporting a hit:
//
//   IT MUST STAY SILENT FROM A DESK. localhost, 127.0.0.1, [::1] and a file:
//   page report nothing at all. A regression here does not break a page --
//   it quietly inflates a public number with every test run, and the only
//   way to notice is to read the dashboard.
//
//   IT MUST NOT COST THE PAGE ANYTHING. A blocked route, an offline desk, a
//   404 from the counter host: the page is complete and the label simply
//   never appears. So every failure path here is a path where the correct
//   behaviour is NOTHING VISIBLE, and "nothing visible" is exactly what a
//   broken module also looks like from a screenshot.
//
// The module is an IIFE with no exports: it runs on load and writes to the
// DOM. So the subject here is a fake page -- a document, a location, an
// Image, a fetch and a clock -- and what is read back is what it did to
// them. The clock is hand-driven, so the retry ladder is examined a rung at
// a time rather than waited out.
//
// Run: node proto/traffic-counter-harness.js
//      node proto/traffic-counter-harness.js --mutate
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const MUTATE = require('./harness-args.js').mutationMode();

let EDIT = null;
const readSubject = name => {
  const text = fs.readFileSync(path.join(ROOT, name), 'utf8');
  return EDIT && EDIT.file === name ? EDIT.fn(text) : text;
};

// ── A PAGE SMALL ENOUGH TO HOLD IN THE HAND ────────────────────────────
function makeElement(tag, doc) {
  const el = {
    tagName: String(tag).toUpperCase(),
    attrs: {},
    children: [],
    parent: null,
    id: '',
    href: '', target: '', rel: '', title: '', textContent: '',
    style: { cssText: '' },
    setAttribute(name, value) { this.attrs[name] = String(value); if (name === 'id') this.id = String(value); },
    getAttribute(name) { return Object.prototype.hasOwnProperty.call(this.attrs, name) ? this.attrs[name] : null; },
    hasAttribute(name) { return Object.prototype.hasOwnProperty.call(this.attrs, name); },
    appendChild(child) { child.parent = this; this.children.push(child); doc.all.push(child); return child; },
    insertAdjacentElement(where, child) {
      child.parent = this.parent;
      child.placedBy = where;
      child.placedNextTo = this;
      if (this.parent) {
        const at = this.parent.children.indexOf(this);
        this.parent.children.splice(where === 'afterend' ? at + 1 : at, 0, child);
      }
      doc.all.push(child);
      return child;
    },
    closest(selector) {
      let node = this;
      while (node) {
        if (matches(node, selector)) return node;
        node = node.parent;
      }
      return null;
    },
  };
  return el;
}

function matches(el, selector) {
  if (selector.startsWith('#')) return el.id === selector.slice(1);
  if (selector.startsWith('[')) return el.hasAttribute(selector.slice(1, -1));
  return el.tagName === selector.toUpperCase();
}

// scene: { host, path, home, corner, cornerInPageRow, strip, readyState }
function makePage(scene) {
  const doc = { all: [] };
  const body = makeElement('body', doc);
  body.id = 'body';
  doc.all.push(body);

  const add = (parent, tag, setup) => {
    const el = makeElement(tag, doc);
    if (setup) setup(el);
    parent.appendChild(el);
    return el;
  };

  let pageRow = null;
  if (scene.strip) {
    const strip = add(body, 'div', el => el.setAttribute('id', 'house-strip'));
    pageRow = add(strip, 'div', el => el.setAttribute('id', 'page-row'));
  }
  if (scene.home) add(body, 'span', el => el.setAttribute('data-visit-counter-home', ''));
  if (scene.corner) {
    const parent = scene.cornerInPageRow && pageRow ? pageRow : body;
    add(parent, 'a', el => el.setAttribute('data-project-corner-bl', ''));
  }

  const document = {
    all: doc.all,
    body,
    readyState: scene.readyState || 'complete',
    querySelector(selector) { return doc.all.find(el => matches(el, selector)) || null; },
    getElementById(id) { return doc.all.find(el => el.id === id) || null; },
    createElement(tag) { return makeElement(tag, doc); },
  };
  return { doc, document, body };
}

// ── RUNNING IT ─────────────────────────────────────────────────────────
// `answer` decides what the counter host says: an object is a JSON body, the
// string 'down' is a non-ok response, 'blocked' is a rejected fetch.
function run(scene, answer) {
  const images = [];
  const fetches = [];
  const timers = [];
  const created = [];
  const page = makePage(scene);

  const location = {
    hostname: 'hostname' in scene ? scene.hostname : 'roughdrafter.ca',
    pathname: 'pathname' in scene ? scene.pathname : '/MODEL.html',
    protocol: scene.protocol || 'https:',
  };

  class FakeImage {
    constructor(w, h) { this.width = w; this.height = h; images.push(this); }
  }

  let settle = null;
  const fetchPromise = new Promise(resolve => { settle = resolve; });
  // ── WHETHER A FAILURE WAS CAUGHT IS THE WHOLE POINT HERE ─────────────
  //
  // "The page owes nothing when the host is unreachable" means the rejected
  // read ENDS somewhere. Dropped, it becomes an unhandled rejection -- a
  // console error on every load behind a blocker -- and the page looks
  // identical, so no reading of the DOM can tell the two apart. The chain
  // is therefore wrapped, and the wrapper remembers whether anyone ever
  // reached for the failure.
  const wire = { caught: false, jsonReads: 0 };
  const track = promise => ({
    then(onValue) { return track(promise.then(onValue)); },
    catch(onError) { wire.caught = true; return track(promise.catch(onError)); },
  });
  const sandbox = {
    console, Math, Number, String, Object, Array, JSON, Date, Promise, Error,
    location,
    document: page.document,
    Image: FakeImage,
    encodeURIComponent,
    setTimeout: (fn, ms) => { timers.push({ fn, ms }); return timers.length; },
    clearTimeout() {},
    fetch: (url) => { fetches.push(url); return track(fetchPromise); },
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(readSubject('traffic-counter.js'), sandbox, { filename: 'traffic-counter.js' });

  const body = () => { wire.jsonReads += 1; return Promise.resolve(answer); };
  if (answer === 'blocked') settle(Promise.reject(new Error('blocked')));
  else if (answer === 'down') settle({ ok: false, json: body });
  else settle({ ok: true, json: body });

  const tick = () => {
    const due = timers.splice(0, timers.length);
    due.forEach(timer => timer.fn());
    return due.length;
  };
  // A RUNG IS: LET THE PROMISES SETTLE, THEN FIRE WHATEVER TIMER IS DUE.
  // The count read is two chained thens over a fetch and a json(), so the
  // first rung has no timer waiting yet -- stopping at the first empty tick
  // would end the ladder before the module had reached it.
  const flush = async () => {
    for (let i = 0; i < 6; i += 1) await Promise.resolve();
  };
  const drain = async (rungs = 30) => {
    for (let i = 0; i < rungs; i += 1) {
      await flush();
      tick();
    }
    await flush();
  };
  const label = () => page.document.querySelector('[data-traffic-counter]');
  return { page, images, fetches, timers, created, wire, tick, flush, drain, label, location };
}

const BASE = 'https://roughdrafter.goatcounter.com';

let passed = 0;
let failures = [];
const check = (label, condition, detail) => {
  if (condition) { passed += 1; return; }
  failures.push(detail ? `${label} — ${detail}` : label);
};

async function runChecks() {
  passed = 0; failures = [];

  // ── THE DESK IS SILENT ────────────────────────────────────────────────
  for (const host of ['localhost', '127.0.0.1', '[::1]', '']) {
    const quiet = run({ hostname: host, corner: true });
    await quiet.drain();
    check(`a page served from ${host || 'nowhere (file:)'} reports nothing`,
      quiet.images.length === 0 && quiet.fetches.length === 0 && quiet.label() === null,
      'every test run and every dev reload would otherwise land in a public count');
  }

  // ── THE HIT ───────────────────────────────────────────────────────────
  const live = run({ corner: true }, { count: 12 });
  await live.drain();
  check('a served page reports exactly one hit', live.images.length === 1);
  check('the hit names the page it was served from',
    live.images[0].src === `${BASE}/count?p=${encodeURIComponent('/MODEL.html')}&rnd=${/rnd=(\d+)/.exec(live.images[0].src)[1]}`,
    live.images[0].src);
  check('the hit carries a cache-buster so a proxy cannot swallow the second visit',
    /[?&]rnd=\d{10,}/.test(live.images[0].src));
  check('the hit is a 1x1 image, not a script',
    live.images[0].width === 1 && live.images[0].height === 1,
    'an image cannot run code on the page; this is the whole reason the module is allowed');
  check('nothing else is loaded from the counter host',
    !live.page.doc.all.some(el => el.tagName === 'SCRIPT'),
    'tests/no-third-party.spec.js is the other half of this');
  const slashy = run({ pathname: '/a page/with spaces.html', corner: true }, { count: 1 });
  await slashy.drain();
  check('a path with spaces is encoded rather than breaking the query',
    slashy.images[0].src.includes(encodeURIComponent('/a page/with spaces.html')));
  const rootless = run({ pathname: '', corner: true }, { count: 1 });
  await rootless.drain();
  check('a page with no path reports the root',
    rootless.images[0].src.includes(encodeURIComponent('/')));

  // ── THE COUNT ─────────────────────────────────────────────────────────
  check('the count is read for THIS page, not the whole site',
    live.fetches.length === 1 && live.fetches[0] === `${BASE}/counter/${'/MODEL.html'}.json`,
    live.fetches[0]);
  check('the label says what the number means',
    live.label() && live.label().textContent === '12 VISITS',
    live.label() ? live.label().textContent : 'no label');
  check('the label is a link to the open dashboard',
    live.label().href === BASE && live.label().target === '_blank');
  check('the link cannot reach back into the page that opened it',
    live.label().rel === 'noopener',
    'target=_blank without noopener hands window.opener to the other company');
  check('the label is findable by the mark the specs look for',
    live.label().hasAttribute('data-traffic-counter'));
  check('the label says what it is on hover', /visits/i.test(live.label().title));
  const spaced = run({ corner: true }, { count: ' 1042 ' });
  await spaced.drain();
  check('a number that arrives padded is trimmed',
    spaced.label().textContent === '1042 VISITS', spaced.label().textContent);

  // ── NOTHING IS OWED WHEN THE HOST IS NOT THERE ────────────────────────
  const blocked = run({ corner: true }, 'blocked');
  await blocked.drain();
  check('a blocked or offline route leaves the page complete and unmarked',
    blocked.label() === null && blocked.images.length === 1,
    'the hit is fire-and-forget; only the count read can fail visibly');
  check('AND THE FAILURE IS CAUGHT, NOT DROPPED',
    blocked.wire.caught,
    'an uncaught read logs an unhandled rejection on every load behind a blocker');
  const downish = run({ corner: true }, 'down');
  await downish.drain();
  check('a non-ok response prints no label', downish.label() === null);
  check('and its body is never even read',
    downish.wire.jsonReads === 0,
    'a 404 from the host is an error page, and parsing it as a count is how a wrong number reaches the corner');
  const empty = run({ corner: true }, null);
  await empty.drain();
  check('a body with no count in it prints no label', empty.label() === null);
  const zero = run({ corner: true }, { count: 0 });
  await zero.drain();
  check('a page nobody has visited prints no label rather than 0 VISITS',
    zero.label() === null);

  // ── WHERE IT LANDS ────────────────────────────────────────────────────
  const homed = run({ home: true, strip: true }, { count: 7 });
  await homed.drain();
  const home = homed.page.document.querySelector('[data-visit-counter-home]');
  check('A NAMED HOME MEANS INSIDE IT',
    homed.label() && homed.label().parent === home,
    'the slot exists to be filled; inserting beside it would put the count outside the row');
  check('a count in a named home is laid out to sit in a row',
    /inline-flex/.test(homed.label().style.cssText)
      && /flex-shrink:\s*0/.test(homed.label().style.cssText));

  const cornered = run({ corner: true }, { count: 7 });
  await cornered.drain();
  const corner = cornered.page.document.querySelector('[data-project-corner-bl]');
  check('THE PROJECT CORNER MEANS AFTER IT',
    cornered.label() && cornered.label().placedNextTo === corner
      && cornered.label().placedBy === 'afterend',
    'the corner is a link the count stands beside, not a slot it goes into');

  const inRow = run({ corner: true, cornerInPageRow: true, strip: true }, { count: 7 });
  await inRow.drain();
  check('A CORNER LINK THAT IS NO LONGER A CORNER IS NOT A HOME',
    inRow.label() === null,
    'the shared bars made it a chip in the page row, and the count read as a seventh page');

  const barredHomeless = run({ strip: true }, { count: 7 });
  await barredHomeless.drain();
  check('a page with a bottom bar and no named home gets no count at all',
    barredHomeless.label() === null,
    'the floating corner sits at bottom:8px, which is inside the bar');

  const floating = run({}, { count: 7 });
  await floating.drain();
  check('a bar-less page still gets its count, floating in the corner',
    floating.label() !== null
      && /position:\s*fixed/.test(floating.label().style.cssText)
      && /left:\s*12px/.test(floating.label().style.cssText)
      && /bottom:\s*8px/.test(floating.label().style.cssText));
  check('the floating count is the seven bar-less pages, unchanged',
    floating.label().parent === floating.page.body);

  const dcLike = run({ corner: true, strip: false }, { count: 7 });
  await dcLike.drain();
  check('THE OLD PAGE KEEPS ITS COUNT EXACTLY WHERE IT WAS',
    dcLike.label() && dcLike.label().placedNextTo
      === dcLike.page.document.querySelector('[data-project-corner-bl]'),
    'MODEL.dc.html has no named home and its corner IS a corner; deleting the fallback lost it');

  // ── THE INK ───────────────────────────────────────────────────────────
  const css = floating.label().style.cssText;
  check('the ink asks the page first',
    css.includes('color:var(--ink-quiet,'),
    'a literal here paints 1.00:1 against MODEL\'s night page -- the count in the colour of the page');
  check('and the literal is the fallback for the pages with no palette',
    /var\(--ink-quiet,\s*rgba\(29,31,32,0\.45\)\)/.test(css),
    'seven pages define no --role properties at all and must stay byte-for-byte what they were');
  check('the label is set small and quiet, not as body text',
    /font-size:\s*10px/.test(css) && /white-space:\s*nowrap/.test(css)
      && /text-decoration:\s*none/.test(css));

  // ── THE LADDER ────────────────────────────────────────────────────────
  const slow = run({ readyState: 'loading' }, { count: 3 });
  await slow.flush();
  check('a page still loading does not get a floating count immediately',
    slow.label() === null && slow.timers.length === 1,
    'the framework-rendered strip may still be on its way');
  // The strip arrives late, exactly as it does on the live page.
  const late = slow.page.document.createElement('span');
  late.setAttribute('data-visit-counter-home', '');
  slow.page.body.appendChild(late);
  await slow.drain();
  check('and when the home arrives a beat later, the count goes into it',
    slow.label() && slow.label().parent === late);

  const never = run({ readyState: 'loading' }, { count: 3 });
  await never.drain(40);
  check('a home that never arrives is given a bounded number of beats, then the corner',
    never.label() !== null && /position:\s*fixed/.test(never.label().style.cssText),
    'an unbounded wait is a timer left running on every page for the life of the tab');
  check('and the ladder stops rather than ticking forever',
    never.timers.length === 0, `${never.timers.length} timers still pending`);
  check('the ladder is ten beats, not one and not a hundred',
    never.images.length === 1 && never.fetches.length === 1,
    'the hit and the read happen once whatever the ladder does');

  // ── ONE VOICE, ONCE ───────────────────────────────────────────────────
  const once = run({ corner: true }, { count: 9 });
  await once.drain();
  check('the page ends with exactly one count on it',
    once.page.doc.all.filter(el => el.hasAttribute('data-traffic-counter')).length === 1);
  check('and it spoke off-site exactly twice: one hit, one read',
    once.images.length === 1 && once.fetches.length === 1,
    'every extra request here is a number the dashboard over-reports');
}

// ── MEASURED, NOT A ROW ─────────────────────────────────────────────────
//
// `var beacon = new Image(1, 1)` -> `new Image()`: the counter host reads the
// request, not the element, so the 1x1 never leaves the page and no check
// here can see the difference. It is kept in the source because a 1x1 is
// what a beacon is, and because an Image with no size is the one a future
// reader tries to style. The row would only ever print SURVIVED.

if (!MUTATE) {
  runChecks().then(() => {
    console.log(`\ntraffic counter harness: ${passed} checks passed, ${failures.length} failed`);
    if (failures.length) {
      failures.forEach(line => console.log(`  ✘ ${line}`));
      process.exit(1);
    }
    process.exit(0);
  });
} else {
  const MUTATIONS = [
    ['a dev desk reports its hits to the public count', 'traffic-counter.js',
      c => c.replace("if (!host || host === 'localhost' || host === '127.0.0.1' || host === '[::1]') return;", '')],

    ['only the name localhost is spared, so 127.0.0.1 reports', 'traffic-counter.js',
      c => c.replace("host === '127.0.0.1' || host === '[::1]'", "host === '127.0.0.1x' || host === '[::1]x'")],

    ['a file: page with no hostname reports', 'traffic-counter.js',
      c => c.replace('if (!host ||', 'if (false ||')],

    ['every page reports as the site root', 'traffic-counter.js',
      c => c.replace("var path = location.pathname || '/';", "var path = '/';")],

    ['a page with no path reports an empty one', 'traffic-counter.js',
      c => c.replace("var path = location.pathname || '/';", 'var path = location.pathname;')],

    ['the path is sent raw, so a space breaks the query', 'traffic-counter.js',
      c => c.replace("'/count?p=' + encodeURIComponent(path)", "'/count?p=' + path")],

    ['the hit is cacheable, so a proxy swallows every visit after the first', 'traffic-counter.js',
      c => c.replace("+ '&rnd=' + Date.now()", '')],

    ['the count is read for the site rather than the page', 'traffic-counter.js',
      c => c.replace("fetch(base + '/counter/' + path + '.json')", "fetch(base + '/counter.json')")],

    ['a non-ok response is read as a count anyway', 'traffic-counter.js',
      c => c.replace('return res.ok ? res.json() : null;', 'return res.json();')],

    ['a blocked route throws instead of leaving the page alone', 'traffic-counter.js',
      c => c.replace(".catch(function () { /* blocked or offline — the page owes nothing */ });", ';')],

    ['a page nobody has visited prints 0 VISITS', 'traffic-counter.js',
      c => c.replace('if (data && data.count)', 'if (data)')],

    ['the number is printed with whatever whitespace arrived', 'traffic-counter.js',
      c => c.replace("String(data.count).trim() + ' VISITS'", "String(data.count) + ' VISITS'")],

    ['the count is printed as a bare number with no word', 'traffic-counter.js',
      c => c.replace("+ ' VISITS'", '')],

    ['the link hands window.opener to the counter host', 'traffic-counter.js',
      c => c.replace("el.rel = 'noopener';", '')],

    ['the label is no longer findable by the specs', 'traffic-counter.js',
      c => c.replace("el.setAttribute('data-traffic-counter', '');", '')],

    ['a named home gets the count beside it instead of inside it', 'traffic-counter.js',
      c => c.replace("if (anchor.hasAttribute('data-visit-counter-home')) anchor.appendChild(el);\n      else anchor.insertAdjacentElement('afterend', el);",
        "      anchor.insertAdjacentElement('afterend', el);")],

    ['the PROJECT corner gets the count inside the link', 'traffic-counter.js',
      c => c.replace("if (anchor.hasAttribute('data-visit-counter-home')) anchor.appendChild(el);\n      else anchor.insertAdjacentElement('afterend', el);",
        '      anchor.appendChild(el);')],

    ['the corner fallback is taken even when the link sits in the page row', 'traffic-counter.js',
      c => c.replace("return (corner && !corner.closest('#page-row')) ? corner : null;", 'return corner || null;')],

    ['the corner fallback is dropped outright, and the old page loses its count', 'traffic-counter.js',
      c => c.replace("var corner = document.querySelector('[data-project-corner-bl]');\n    return (corner && !corner.closest('#page-row')) ? corner : null;",
        '    return null;')],

    ['a named home is ignored in favour of the corner', 'traffic-counter.js',
      c => c.replace("var named = document.querySelector('[data-visit-counter-home]');\n    if (named) return named;", '')],

    ['a page with a bottom bar gets the count floated over its page row', 'traffic-counter.js',
      c => c.replace('if (barredButHomeless()) return;', '')],

    ['the bar test looks at the wrong thing, so bar-less pages lose the count', 'traffic-counter.js',
      c => c.replace("return !homeOf() && !!document.getElementById('house-strip');", 'return !homeOf();')],

    ['the floating count is positioned in the document flow', 'traffic-counter.js',
      c => c.replace("position:fixed; left:12px; bottom:8px;", 'position:static;')],

    ['the ink stops asking the page and paints the literal', 'traffic-counter.js',
      c => c.replace('color:var(--ink-quiet, rgba(29,31,32,0.45));', 'color:rgba(29,31,32,0.45);')],

    ['the fallback ink is dropped, so the seven plain pages lose the colour', 'traffic-counter.js',
      c => c.replace('var(--ink-quiet, rgba(29,31,32,0.45))', 'var(--ink-quiet)')],

    ['the label is set at body size', 'traffic-counter.js',
      c => c.replace('font-size:10px;', 'font-size:16px;')],

    ['the label is allowed to wrap mid-count', 'traffic-counter.js',
      c => c.replace(' white-space:nowrap;', '')],

    ['the ladder gives up at once, before the strip can arrive', 'traffic-counter.js',
      c => c.replace('if (data && data.count) show(String(data.count).trim() + \' VISITS\', 10);',
        "if (data && data.count) show(String(data.count).trim() + ' VISITS', 0);")],

    ['the ladder never gives up', 'traffic-counter.js',
      c => c.replace('if (homeOf() || tries <= 0 || document.readyState !== \'loading\') {',
        "if (homeOf() || document.readyState !== 'loading') {")],

    ['a page still loading is not waited for at all', 'traffic-counter.js',
      c => c.replace("if (homeOf() || tries <= 0 || document.readyState !== 'loading') {", 'if (true) {')],

    ['the retry does not count down, so it runs forever', 'traffic-counter.js',
      c => c.replace('setTimeout(function () { show(label, tries - 1); }, 300);',
        'setTimeout(function () { show(label, tries); }, 300);')],

    ['the count is mounted on every rung of the ladder', 'traffic-counter.js',
      c => c.replace('      if (document.body) return mount(label);\n    }',
        '      if (document.body) mount(label);\n    }')],
  ];

  (async () => {
    let caught = 0;
    for (const [name, file, fn] of MUTATIONS) {
      const before = fs.readFileSync(path.join(ROOT, file), 'utf8');
      if (fn(before) === before) {
        console.log(`  ANCHOR MISSED  ${name}  (the edit changed nothing in ${file} -- re-aim it)`);
        continue;
      }
      EDIT = { file, fn };
      let red = false;
      try { await runChecks(); red = failures.length > 0; }
      catch (err) { red = true; }
      EDIT = null;
      if (red) caught += 1;
      else console.log(`  SURVIVED  ${name}`);
    }
    console.log(`traffic-counter-harness: ${caught}/${MUTATIONS.length} mutations caught`);
    process.exit(caught === MUTATIONS.length ? 0 : 1);
  })();
}
