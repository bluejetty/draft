#!/usr/bin/env node
// THE PORTRAIT INTERSTITIAL, OFFLINE (board #310).
//
// The ruling is landscape on every working screen, and the file is honest
// that the web platform will not hard-lock orientation outside fullscreen:
// the guarantee is a cover over the whole working surface, not a lock. So
// what has to be true is small, and all of it is testable without a browser
// if the window and document are stood up as recording fakes:
//
//   THE GATE IS A COARSE POINTER, NOT AN ASPECT RATIO. A drafter dragging a
//   desktop window tall must never see this. That is the one failure mode
//   nobody would report as a bug -- they would just think the app is broken
//   -- and it is a single `&&` away at all times.
//
//   BOTH WAYS UP ARE BLOCKED, and both landscape directions pass. Upside
//   down portrait is still portrait.
//
//   THE COVER COMES BACK OFF. A guard that attaches and never detaches turns
//   a rotated tablet into a dead page, and the flag the rest of the app reads
//   (body.dataset.orientationBlocked) has to follow it both ways.
//
//   THE LOCK ATTEMPT IS QUIET. Outside fullscreen it rejects on every browser
//   that implements it. A rejection that reaches the console teaches drafters
//   to ignore the console, and an unhandled rejection is worse. Both the
//   throwing and the rejecting forms are fed in here.
//
// The browser spec proves the panel paints. This proves the decisions.
//
// Run: node proto/orientation-guard-harness.js
//      node proto/orientation-guard-harness.js --mutate
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

// ── A DOM JUST BIG ENOUGH ──────────────────────────────────────────────
function makeNode(tag) {
  const node = {
    tagName: tag.toUpperCase(),
    attributes: {},
    style: { cssText: '' },
    dataset: {},
    children: [],
    parent: null,
    innerHTML: '',
    hidden: undefined,
    removals: 0,
    setAttribute(key, value) { this.attributes[key] = String(value); },
    getAttribute(key) { return key in this.attributes ? this.attributes[key] : null; },
    appendChild(child) { child.parent = this; this.children.push(child); return child; },
    remove() {
      this.removals += 1;
      if (this.parent) {
        this.parent.children = this.parent.children.filter(c => c !== this);
        this.parent = null;
      }
    },
    get isConnected() {
      let node2 = this;
      while (node2.parent) node2 = node2.parent;
      return node2.isRoot === true;
    },
  };
  return node;
}

// opts: { coarse, w, h, noBody, readyState, lock: 'ok'|'reject'|'throw'|'absent'|'not-a-function' }
function stand(opts = {}) {
  const body = makeNode('body');
  body.isRoot = true;
  const log = { locks: [], unhandled: [], listeners: [], docListeners: [], errors: [] };
  const doc = {
    readyState: opts.readyState || 'complete',
    body: opts.noBody ? null : body,
    createElement: tag => makeNode(tag),
    addEventListener: (type, fn) => log.docListeners.push({ type, fn }),
  };
  const win = {
    innerWidth: opts.w === undefined ? 1024 : opts.w,
    innerHeight: opts.h === undefined ? 768 : opts.h,
    document: doc,
    addEventListener: (type, fn) => log.listeners.push({ type, fn }),
    matchMedia: opts.noMatchMedia ? undefined
      : query => ({ matches: query === '(pointer: coarse)' ? !!opts.coarse : false, media: query }),
  };
  const orientation = {};
  if (opts.lock !== 'absent') {
    orientation.lock = opts.lock === 'not-a-function' ? 'landscape' : (which => {
      log.locks.push(which);
      if (opts.lock === 'throw') throw new Error('not permitted here');
      if (opts.lock === 'reject') {
        // A rejection nobody attaches a handler to is an unhandled rejection
        // in a real browser, which is how this failure would actually show.
        const pending = { handled: false };
        log.unhandled.push(pending);
        return { catch: handler => { pending.handled = true; handler(new Error('rejected')); return { then() {} }; } };
      }
      return { catch: () => ({}) };
    });
  }
  win.screen = { orientation };
  const sandbox = {
    window: win, document: doc, screen: win.screen,
    console: { log: () => {}, warn: m => log.errors.push(m), error: m => log.errors.push(m) },
    Object, Array, String, Number, Math, JSON, Boolean,
  };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(readSubject('orientation-guard.js'), sandbox, { filename: 'orientation-guard.js' });
  const guard = win.DraftOrientationGuard;
  if (!guard) throw new Error('orientation-guard.js did not publish DraftOrientationGuard');
  const fire = type => {
    log.listeners.filter(entry => entry.type === type).forEach(entry => entry.fn());
  };
  const fireDoc = type => {
    log.docListeners.filter(entry => entry.type === type).forEach(entry => entry.fn());
  };
  const cover = () => body.children.find(child => 'data-orientation-guard' in child.attributes) || null;
  return { win, doc, body, guard, log, fire, fireDoc, cover };
}

const TABLET_PORTRAIT = { coarse: true, w: 820, h: 1180 };
const TABLET_LANDSCAPE = { coarse: true, w: 1180, h: 820 };
const DESKTOP_TALL = { coarse: false, w: 700, h: 1200 };

let passed = 0;
let failures = [];
const check = (label, condition, detail) => {
  if (condition) { passed += 1; return; }
  failures.push(detail ? `${label} — ${detail}` : label);
};

function runChecks() {
  passed = 0; failures = [];

  // ── THE GATE ─────────────────────────────────────────────────────────
  check('a tablet held upright is blocked', stand(TABLET_PORTRAIT).guard.shouldBlock() === true);
  check('the same tablet turned is not', stand(TABLET_LANDSCAPE).guard.shouldBlock() === false);
  check('A DESKTOP WINDOW DRAGGED TALL IS NEVER BLOCKED',
    stand(DESKTOP_TALL).guard.shouldBlock() === false,
    'the gate is a coarse pointer, not the aspect ratio — this one nobody would report');
  check('a coarse pointer alone is not enough',
    stand({ coarse: true, w: 1180, h: 820 }).guard.shouldBlock() === false);
  check('portrait alone is not enough',
    stand({ coarse: false, w: 820, h: 1180 }).guard.shouldBlock() === false);
  check('an exactly square screen is not portrait',
    stand({ coarse: true, w: 900, h: 900 }).guard.shouldBlock() === false,
    'one pixel either way should not decide, and equal is the honest landscape case');
  check('one pixel taller than wide IS portrait',
    stand({ coarse: true, w: 900, h: 901 }).guard.shouldBlock() === true);
  check('the two halves of the gate are readable on their own',
    stand(TABLET_PORTRAIT).guard.isCoarse() === true
      && stand(DESKTOP_TALL).guard.isCoarse() === false
      && stand(TABLET_PORTRAIT).guard.isPortrait() === true
      && stand(TABLET_LANDSCAPE).guard.isPortrait() === false);
  check('the coarse test asks the pointer question and no other',
    stand({ coarse: false, w: 820, h: 1180 }).guard.isCoarse() === false);
  check('a browser with no matchMedia is treated as fine-pointered, not blocked',
    stand({ noMatchMedia: true, w: 820, h: 1180 }).guard.shouldBlock() === false);
  check('the guard is published frozen',
    Object.isFrozen(stand(TABLET_LANDSCAPE).guard));

  // ── THE COVER ────────────────────────────────────────────────────────
  const blocked = stand(TABLET_PORTRAIT);
  const cover = blocked.cover();
  check('a blocked tablet is covered', cover !== null);
  check('the cover is announced to a screen reader as a dialog',
    cover && cover.getAttribute('role') === 'alertdialog'
      && /landscape/i.test(cover.getAttribute('aria-label') || ''));
  check('the cover is over everything and takes the whole surface',
    cover && /position:fixed/.test(cover.style.cssText) && /inset:0/.test(cover.style.cssText)
      && /z-index:99999/.test(cover.style.cssText),
    'anything beneath it that stays touchable is a page laying out in portrait');
  check('the cover swallows touch rather than passing it through',
    cover && /touch-action:none/.test(cover.style.cssText));
  check('the cover says what to do about it',
    cover && /Turn your device/i.test(cover.innerHTML) && /landscape/i.test(cover.innerHTML));
  check('the rest of the app is told, in the flag it reads',
    blocked.body.dataset.orientationBlocked === '1');

  const free = stand(TABLET_LANDSCAPE);
  check('a landscape tablet is not covered', free.cover() === null);
  check('and the flag says so rather than being left unset',
    free.body.dataset.orientationBlocked === '0',
    'an unset flag reads the same as blocked to anything testing for the string');

  // ── AND BACK OFF AGAIN ───────────────────────────────────────────────
  const turned = stand(TABLET_PORTRAIT);
  check('precondition: covered while upright', turned.cover() !== null);
  turned.win.innerWidth = 1180; turned.win.innerHeight = 820;
  turned.fire('resize');
  check('TURNING THE TABLET TAKES THE COVER BACK OFF', turned.cover() === null,
    'a guard that only attaches turns a rotated tablet into a dead page');
  check('and clears the flag with it', turned.body.dataset.orientationBlocked === '0');
  turned.win.innerWidth = 820; turned.win.innerHeight = 1180;
  turned.fire('orientationchange');
  check('turning it back covers it again', turned.cover() !== null
    && turned.body.dataset.orientationBlocked === '1');
  check('the second cover is the first one, not a fresh pile of panels',
    turned.body.children.length === 1,
    'rebuilding per rotation leaves a stack of dead dialogs in the body');
  turned.fire('resize');
  check('a resize that changes nothing changes nothing',
    turned.body.children.length === 1 && turned.body.dataset.orientationBlocked === '1');

  check('the guard listens for both the resize and the rotation',
    ['resize', 'orientationchange'].every(type =>
      turned.log.listeners.some(entry => entry.type === type)),
    'orientationchange alone misses a split-screen resize; resize alone misses some tablets');

  // ── STARTING UP ──────────────────────────────────────────────────────
  const early = stand({ ...TABLET_PORTRAIT, readyState: 'loading' });
  check('nothing is attached before the document is ready', early.cover() === null);
  check('the guard waits on DOMContentLoaded when it loads early',
    early.log.docListeners.some(entry => entry.type === 'DOMContentLoaded'));
  early.fireDoc('DOMContentLoaded');
  check('and covers the page as soon as the document arrives', early.cover() !== null);
  check('a document with no body yet does not throw and attaches nothing',
    stand({ ...TABLET_PORTRAIT, noBody: true }).log.errors.length === 0);

  // ── THE LOCK, TAKEN AS A BONUS AND NEVER AS A COMPLAINT ──────────────
  const asked = stand(TABLET_PORTRAIT);
  check('the real lock is asked for where it exists',
    asked.log.locks.join() === 'landscape',
    "'landscape' allows both landscape-primary and landscape-secondary, which is the ruling");
  const rejected = stand({ ...TABLET_PORTRAIT, lock: 'reject' });
  check('a lock that rejects is caught and stays quiet',
    rejected.log.errors.length === 0,
    'outside fullscreen this rejects on every browser that implements it');
  check('and the rejection is HANDLED, not left to surface as an unhandled one',
    rejected.log.unhandled.length === 1 && rejected.log.unhandled.every(p => p.handled),
    'an unhandled rejection on every tablet load is worse than the log line it replaces');
  check('a lock that throws outright does not stop the cover going up',
    stand({ ...TABLET_PORTRAIT, lock: 'throw' }).cover() !== null);
  check('a browser with no orientation lock at all is fine',
    stand({ ...TABLET_PORTRAIT, lock: 'absent' }).cover() !== null);
  check('something that is not a function where the lock should be is fine',
    stand({ ...TABLET_PORTRAIT, lock: 'not-a-function' }).cover() !== null);
  check('the lock is attempted on a landscape tablet too, not only when blocked',
    stand(TABLET_LANDSCAPE).log.locks.length === 1,
    'the bonus is worth having before the drafter turns the device the wrong way');

  // ── APPLY IS PUBLIC AND IDEMPOTENT ───────────────────────────────────
  const manual = stand(TABLET_LANDSCAPE);
  manual.win.innerWidth = 820; manual.win.innerHeight = 1180;
  manual.guard.apply();
  check('apply() is the public way to re-decide', manual.cover() !== null);
  manual.guard.apply(); manual.guard.apply();
  check('calling it again does not pile up covers', manual.body.children.length === 1);
  manual.win.innerWidth = 1180; manual.win.innerHeight = 820;
  manual.guard.apply(); manual.guard.apply();
  check('and removing twice is not an error',
    manual.cover() === null && manual.body.dataset.orientationBlocked === '0');
}

if (!MUTATE) {
  runChecks();
  console.log(`\norientation guard harness: ${passed} checks passed, ${failures.length} failed`);
  if (failures.length) {
    failures.forEach(line => console.log(`  ✘ ${line}`));
    process.exit(1);
  }
  process.exit(0);
}

// ── MUTATIONS ───────────────────────────────────────────────────────────
const MUTATIONS = [
  ['the gate becomes the aspect ratio, so a tall desktop window is covered',
    'orientation-guard.js',
    c => c.replace('const shouldBlock = () => isCoarse() && isPortrait();',
      'const shouldBlock = () => isPortrait();')],

  ['a coarse pointer alone blocks, so every tablet is covered in landscape',
    'orientation-guard.js',
    c => c.replace('const shouldBlock = () => isCoarse() && isPortrait();',
      'const shouldBlock = () => isCoarse();')],

  ['either half is enough', 'orientation-guard.js',
    c => c.replace('const shouldBlock = () => isCoarse() && isPortrait();',
      'const shouldBlock = () => isCoarse() || isPortrait();')],

  ['portrait is measured the wrong way round', 'orientation-guard.js',
    c => c.replace('const isPortrait = () => window.innerHeight > window.innerWidth;',
      'const isPortrait = () => window.innerHeight < window.innerWidth;')],

  ['a square screen counts as portrait', 'orientation-guard.js',
    c => c.replace('window.innerHeight > window.innerWidth', 'window.innerHeight >= window.innerWidth')],

  ['the pointer question becomes a hover question', 'orientation-guard.js',
    c => c.replace("window.matchMedia('(pointer: coarse)')", "window.matchMedia('(hover: hover)')")],

  ['a browser without matchMedia is treated as a tablet', 'orientation-guard.js',
    c => c.replace('!!(window.matchMedia && window.matchMedia(', '!!(!window.matchMedia || window.matchMedia(')],

  ['the cover goes up but never comes back off', 'orientation-guard.js',
    c => c.replace('      if (panel && panel.isConnected) panel.remove();\n', '')],

  ['the flag is set when blocked and left alone otherwise', 'orientation-guard.js',
    c => c.replace("      body.dataset.orientationBlocked = '0';", '')],

  ['the flag is set the wrong way round', 'orientation-guard.js',
    c => c.replace("      body.dataset.orientationBlocked = '1';", "      body.dataset.orientationBlocked = '0';")],

  ['a fresh panel is built for every rotation', 'orientation-guard.js',
    c => c.replace('    if (panel) return panel;\n', '')],

  ['the panel is built but never attached', 'orientation-guard.js',
    c => c.replace('      if (!node.isConnected) body.appendChild(node);', '')],

  ['the panel is attached again on every apply', 'orientation-guard.js',
    c => c.replace('if (!node.isConnected) body.appendChild(node);', 'body.appendChild(node);')],

  ['the cover stops being fixed over everything', 'orientation-guard.js',
    c => c.replace("'position:fixed', 'inset:0', 'z-index:99999'", "'position:static', 'inset:auto', 'z-index:1'")],

  ['the cover lets touches through to the page beneath', 'orientation-guard.js',
    c => c.replace("'user-select:none', 'touch-action:none',", "'user-select:none',")],

  ['the cover stops announcing itself as a dialog', 'orientation-guard.js',
    c => c.replace("panel.setAttribute('role', 'alertdialog');", '')],

  ['the cover loses the label that says what to do', 'orientation-guard.js',
    c => c.replace("panel.setAttribute('aria-label', 'Turn your device to landscape');", '')],

  ['the guard stops listening for a plain resize', 'orientation-guard.js',
    c => c.replace("window.addEventListener('resize', apply);\n", '')],

  ['the guard stops listening for the rotation', 'orientation-guard.js',
    c => c.replace("window.addEventListener('orientationchange', apply);\n", '')],

  ['a page still loading is decided immediately and never again', 'orientation-guard.js',
    c => c.replace("  if (document.readyState === 'loading') {\n    document.addEventListener('DOMContentLoaded', start);\n  } else {\n    start();\n  }",
      '  start();')],

  ['a document with no body is not noticed', 'orientation-guard.js',
    c => c.replace('    if (!body) return;\n', '')],

  ['the lock is asked for a single direction, against the ruling', 'orientation-guard.js',
    c => c.replace("screen.orientation.lock('landscape')", "screen.orientation.lock('landscape-primary')")],

  ['a rejected lock is left unhandled', 'orientation-guard.js',
    c => c.replace("        if (result && typeof result.catch === 'function') result.catch(() => {});", '')],

  // NOT A ROW, MEASURED. Loosening `typeof lock === 'function'` to a plain
  // truth test is unobservable: the whole attempt sits inside the try/catch
  // that exists because this call rejects or throws on most browsers, so
  // calling a non-function lands in the same catch as a refused lock and
  // the interstitial goes up either way. It becomes a real row only if the
  // attempt is ever moved out of that try, which the throwing-lock row below
  // is there to stop.

  ['a throwing lock takes the interstitial down with it', 'orientation-guard.js',
    c => c.replace('  function start() {\n    apply();\n    tryLock();\n  }',
      '  function start() {\n    tryLockRaw();\n    apply();\n  }\n  function tryLockRaw() {\n    const lock = window.screen && screen.orientation && screen.orientation.lock;\n    if (typeof lock === \'function\') screen.orientation.lock(\'landscape\');\n  }')],
];

let caught = 0;
for (const [name, file, fn] of MUTATIONS) {
  const before = fs.readFileSync(path.join(ROOT, file), 'utf8');
  if (fn(before) === before) {
    console.log(`  ANCHOR MISSED  ${name}  (the edit changed nothing in ${file} -- re-aim it)`);
    continue;
  }
  EDIT = { file, fn };
  let red = false;
  try { runChecks(); red = failures.length > 0; }
  catch (err) { red = true; }
  EDIT = null;
  if (red) caught += 1;
  else console.log(`  SURVIVED  ${name}`);
}
console.log(`orientation-guard-harness: ${caught}/${MUTATIONS.length} mutations caught`);
process.exit(caught === MUTATIONS.length ? 0 : 1);
