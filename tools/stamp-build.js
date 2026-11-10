#!/usr/bin/env node
// STAMP THE SITE FOR DEPLOY -- tie every page to the scripts it was written for.
//
// Run by .github/workflows/pages.yml on every push to main:
//   node tools/stamp-build.js <build-id> <site-root> <out-dir>
// It copies the site into <out-dir> and, in every dashboard there, puts the
// build id into <meta name="draft-build">, onto every LOCAL script and style
// address (./palette.js -> ./palette.js?v=<id>), and into build-id.js. The
// repo itself is never edited, so there is no stamp to keep current by hand,
// no CI check nagging for one, and no line every pull request fights over.
// Locally and under the tests everything stays 'dev' and build-id.js is quiet.
//
// WHAT IS STAMPED. src= and href= whose value is a relative path ending in
// .js or .css -- './x.js', 'x.js', '../vendor/fonts.css', 'model/01-skin-view.js'.
// Not touched: anything with a scheme or a leading '//' (a CDN), anything that
// already carries a query or a hash, and anything that is not a script or a
// stylesheet (images, .draft files, pages linked to one another -- a page
// link with a stamp would be a bookmark that goes stale).
//
// WHAT IS A DASHBOARD. Every .html at the site root and one folder down. The
// .dc.html pages count too: support.js reads them back over fetch(), and a
// stamped address inside is still a valid address.
//
// Checked by proto/stamp-build-harness.js, which stamps a copy of the real
// site and reads every page back.
const fs = require('fs');
const path = require('path');

const SKIP_DIRS = new Set(['.git', '.github', 'node_modules', 'test-results', 'playwright-report']);
const STAMP_ME = /^(?!\/\/)(?![a-z][a-z0-9+.-]*:)[^?#]*\.(?:js|css)$/i;
const ATTR = /\b(src|href)=(["'])([^"']*)\2/g;

function stampHtml(html, build) {
  let metas = 0;
  let out = html.replace(/<meta\s+name=(["'])draft-build\1\s+content=(["'])[^"']*\2/gi, (m, q1, q2) => {
    metas += 1;
    return `<meta name=${q1}draft-build${q1} content=${q2}${build}${q2}`;
  });
  let links = 0;
  out = out.replace(ATTR, (m, attr, q, value) => {
    if (!STAMP_ME.test(value)) return m;
    links += 1;
    return `${attr}=${q}${value}?v=${build}${q}`;
  });
  return { html: out, metas, links };
}

function stampBuildId(js, build) {
  const line = /const BUILD = 'dev'; \/\/ STAMPED ON DEPLOY/;
  if (!line.test(js)) throw new Error('build-id.js has lost its STAMPED ON DEPLOY line');
  return js.replace(line, `const BUILD = '${build}'; // STAMPED ON DEPLOY`);
}

function copyTree(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const src = path.join(from, entry.name);
    const dst = path.join(to, entry.name);
    if (entry.isDirectory()) copyTree(src, dst);
    else if (entry.isFile()) fs.copyFileSync(src, dst);
  }
}

function dashboards(root) {
  const found = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (entry.isFile() && /\.html$/i.test(entry.name)) found.push(path.join(root, entry.name));
    else if (entry.isDirectory() && !SKIP_DIRS.has(entry.name)) {
      for (const inner of fs.readdirSync(path.join(root, entry.name), { withFileTypes: true })) {
        if (inner.isFile() && /\.html$/i.test(inner.name)) found.push(path.join(root, entry.name, inner.name));
      }
    }
  }
  return found.sort();
}

function stampSite(build, siteRoot, outDir) {
  if (!/^[A-Za-z0-9._-]{1,64}$/.test(build)) throw new Error(`build id "${build}" must be letters, digits, . _ - only`);
  if (path.resolve(outDir) === path.resolve(siteRoot)) throw new Error('out-dir must differ from site-root: the repo is never stamped in place');
  fs.rmSync(outDir, { recursive: true, force: true });
  copyTree(siteRoot, outDir);
  const report = [];
  for (const file of dashboards(outDir)) {
    const { html, metas, links } = stampHtml(fs.readFileSync(file, 'utf8'), build);
    fs.writeFileSync(file, html);
    report.push({ file: path.relative(outDir, file), metas, links });
  }
  const idFile = path.join(outDir, 'build-id.js');
  fs.writeFileSync(idFile, stampBuildId(fs.readFileSync(idFile, 'utf8'), build));
  return report;
}

module.exports = { stampHtml, stampBuildId, stampSite, dashboards, STAMP_ME };

if (require.main === module) {
  const [build, siteRoot, outDir] = process.argv.slice(2);
  if (!build || !siteRoot || !outDir) {
    console.error('usage: node tools/stamp-build.js <build-id> <site-root> <out-dir>');
    process.exit(2);
  }
  const report = stampSite(build, siteRoot, outDir);
  for (const row of report) console.log(`${row.file.padEnd(28)} meta ${row.metas}  links ${row.links}`);
  console.log(`stamped ${report.length} pages with build ${build} into ${outDir}`);
}
