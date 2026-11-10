#!/usr/bin/env node
// THE DEPLOY STAMP, read back off the real site (jb, 10 Nov: an old cached
// MODEL.html ran against new scripts and "H is not defined" came up on every
// load).
//
// WHAT IT CHECKS. tools/stamp-build.js is run against a copy of this repo,
// and every page of the copy is read back:
//   - every dashboard carries <meta name="draft-build"> and loads build-id.js
//     FIRST, before any other script, because the comparison has to run
//     before a mismatched script can trip;
//   - every local .js and .css address in every page carries ?v=<build>, and
//     nothing else does: no page-to-page link, no image, no CDN address;
//   - build-id.js in the copy says the build, and the one in the repo still
//     says 'dev', because the repo is never stamped in place;
//   - the stamp refuses an id it could not put in a URL, and refuses to stamp
//     the repo over itself.
// A page added to the site without the two head lines fails here, which is
// the point: the next dashboard gets the guard by construction, not memory.
//
// Run: node proto/stamp-build-harness.js
const fs = require('fs');
const os = require('os');
const path = require('path');
require('./harness-args.js').noFlags();

const ROOT = path.join(__dirname, '..');
const stamp = require(path.join(ROOT, 'tools', 'stamp-build.js'));

const failures = [];
const check = (ok, what) => { if (!ok) failures.push(what); console.log(`${ok ? 'ok  ' : 'FAIL'}  ${what}`); };

const BUILD = 'a1b2c3d4e5f6';
const out = fs.mkdtempSync(path.join(os.tmpdir(), 'draft-stamp-'));
const report = stamp.stampSite(BUILD, ROOT, out);

// ── EVERY DASHBOARD, GUARDED ────────────────────────────────────────────
// A dashboard is a page a drafter opens by name. DXF/*.html are the DXF
// notes and get their links stamped but carry no guard; they load nothing
// that could mismatch.
const dashboards = report.map(r => r.file).filter(f => !f.startsWith('DXF/'));
check(dashboards.length >= 17, `${dashboards.length} dashboards stamped (17 known)`);
for (const file of dashboards) {
  const html = fs.readFileSync(path.join(out, file), 'utf8');
  const metaAt = html.search(/<meta name="draft-build" content="a1b2c3d4e5f6">/);
  const firstScript = html.search(/<script\b/);
  const idScript = html.search(/<script src="(?:\.\.\/|\.\/)build-id\.js\?v=a1b2c3d4e5f6"><\/script>/);
  check(metaAt > 0, `${file}: carries the build meta`);
  check(idScript > 0 && idScript === firstScript, `${file}: build-id.js is the first script`);
  check(metaAt < idScript, `${file}: the meta comes before build-id.js`);
}

// ── EVERY LOCAL SCRIPT AND STYLE, AND NOTHING ELSE ─────────────────────
const tagsOf = html => [...html.matchAll(/<(?:script|link)\b[^>]*\b(?:src|href)="([^"]*)"/g)].map(m => m[1]);
for (const row of report) {
  const html = fs.readFileSync(path.join(out, row.file), 'utf8');
  const bare = tagsOf(html).filter(v => /\.(?:js|css)$/i.test(v) && !/^(?:[a-z]+:|\/\/)/i.test(v));
  check(bare.length === 0, `${row.file}: no local script or style left unstamped${bare.length ? ` (${bare.join(', ')})` : ''}`);
  const strays = [...html.matchAll(/(?:src|href)="([^"]*\?v=a1b2c3d4e5f6)"/g)].map(m => m[1])
    .filter(v => !/\.(?:js|css)\?v=/i.test(v));
  check(strays.length === 0, `${row.file}: nothing but scripts and styles stamped${strays.length ? ` (${strays.join(', ')})` : ''}`);
  check(row.links > 0, `${row.file}: ${row.links} addresses stamped`);
}
{
  const model = fs.readFileSync(path.join(out, 'MODEL.html'), 'utf8');
  check(/href="favicon\.svg"/.test(model), 'MODEL.html: the favicon is not stamped');
  check(/src="\.\/model\/13-suites-trim-follow\.js\?v=a1b2c3d4e5f6"/.test(model), 'MODEL.html: a script in model/ is stamped');
  const index = fs.readFileSync(path.join(out, 'index.html'), 'utf8');
  check(!/MODEL\.html\?v=/.test(index), 'index.html: links to other pages are not stamped');
}

// ── A CDN ADDRESS, A QUERY, A HASH: LEFT ALONE ─────────────────────────
{
  const { html, links } = stamp.stampHtml(
    '<script src="https://cdn.example/x.js"></script><script src="//cdn.example/y.js"></script>'
    + '<script src="./z.js?x=1"></script><link href="./w.css#top"><img src="a.png"><script src="model/q.js"></script>', BUILD);
  check(links === 1 && /src="model\/q\.js\?v=a1b2c3d4e5f6"/.test(html), 'stampHtml: only the bare local address is stamped');
  check(/cdn\.example\/x\.js"/.test(html) && /cdn\.example\/y\.js"/.test(html), 'stampHtml: CDN addresses untouched');
  check(/z\.js\?x=1"/.test(html) && /w\.css#top"/.test(html), 'stampHtml: an address with a query or hash is untouched');
}

// ── build-id.js SAYS THE BUILD IN THE COPY, 'dev' IN THE REPO ──────────
check(/const BUILD = 'a1b2c3d4e5f6';/.test(fs.readFileSync(path.join(out, 'build-id.js'), 'utf8')), 'copy: build-id.js carries the build');
check(/const BUILD = 'dev'; \/\/ STAMPED ON DEPLOY/.test(fs.readFileSync(path.join(ROOT, 'build-id.js'), 'utf8')), "repo: build-id.js still says 'dev'");
check(/content="dev"/.test(fs.readFileSync(path.join(ROOT, 'MODEL.html'), 'utf8')), "repo: MODEL.html still says 'dev'");
check(!fs.existsSync(path.join(out, '.git')) && !fs.existsSync(path.join(out, 'node_modules')), 'copy: .git and node_modules left behind');
check(fs.existsSync(path.join(out, 'CNAME')), 'copy: CNAME travels with the site');

// ── REFUSALS ────────────────────────────────────────────────────────────
const refuses = fn => { try { fn(); return false; } catch { return true; } };
check(refuses(() => stamp.stampSite('bad id/with space', ROOT, out)), 'refuses a build id that cannot sit in a URL');
check(refuses(() => stamp.stampSite(BUILD, ROOT, ROOT)), 'refuses to stamp the repo over itself');
check(refuses(() => stamp.stampBuildId("const BUILD = 'x';", BUILD)), 'refuses a build-id.js without its STAMPED ON DEPLOY line');

fs.rmSync(out, { recursive: true, force: true });
console.log(`\n${failures.length ? `${failures.length} FAILED` : 'all checks passed'}`);
process.exit(failures.length ? 1 : 0);
