// THE PROJECTS WORKER (workers/projects/worker.mjs), run here against a
// bucket kept in memory. jb pastes that file into Cloudflare by hand and the
// cloud test container cannot reach workers.dev, so this is the only place
// its rules are checked before they go live: anyone may read a project,
// only the password may write, list or delete, names are cleaned the same
// way the viewer cleans them, and only a .draft or a SAVE AS ZIP up to 25 MB
// is taken.
//
// Run: node proto/projects-worker-harness.js
require('./harness-args.js').noFlags();
const path = require('path');
const { pathToFileURL } = require('url');

let ran = 0, failed = 0;
const check = (label, got, want) => {
  ran += 1;
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) { failed += 1; console.log(`  FAIL ${label}\n       got  ${JSON.stringify(got)}\n       want ${JSON.stringify(want)}`); }
  else console.log(`  ok   ${label}`);
};

// An R2 bucket as far as the worker uses one.
function fakeBucket() {
  const items = new Map();
  return {
    items,
    async get(key) {
      const it = items.get(key);
      if (!it) return null;
      return { body: it.bytes, httpMetadata: it.httpMetadata, customMetadata: it.customMetadata, size: it.bytes.length };
    },
    async put(key, bytes, opts) {
      items.set(key, { bytes: new Uint8Array(bytes), httpMetadata: opts.httpMetadata, customMetadata: opts.customMetadata });
    },
    async delete(key) { items.delete(key); },
    async list({ prefix }) {
      const objects = [...items.entries()].filter(([k]) => k.startsWith(prefix))
        .map(([key, it]) => ({ key, size: it.bytes.length, customMetadata: it.customMetadata, uploaded: new Date() }));
      return { objects, truncated: false };
    },
  };
}

(async () => {
  const worker = (await import(pathToFileURL(path.join(__dirname, '..', 'workers', 'projects', 'worker.mjs')).href)).default;
  const env = { PROJECTS: fakeBucket(), UPLOAD_PASSWORD: 'hunter2-long' };
  const BASE = 'https://roughdrafter-projects.example.workers.dev';
  const call = async (method, p, { pw, body, headers = {}, origin = 'https://roughdrafter.com' } = {}) => {
    const h = { Origin: origin, ...headers };
    if (pw) h.Authorization = `Bearer ${pw}`;
    const res = await worker.fetch(new Request(BASE + p, { method, headers: h, body }), env);
    const type = res.headers.get('Content-Type') || '';
    const data = type.includes('json') && !(method === 'GET' && p.startsWith('/p/') && res.status === 200) ? await res.json() : new Uint8Array(await res.arrayBuffer());
    return { status: res.status, data, res };
  };
  const DRAFT = JSON.stringify({ version: 1, walls: [] });

  let r = await call('PUT', '/p/smith-house', { body: DRAFT });
  check('no password: an upload is refused', r.status, 401);
  r = await call('PUT', '/p/smith-house', { pw: 'guess', body: DRAFT });
  check('a wrong password: refused', r.status, 401);
  check('and nothing was saved', env.PROJECTS.items.size, 0);

  r = await call('PUT', '/p/Smith-House', { pw: 'hunter2-long', body: DRAFT, headers: { 'X-File-Name': 'SMITH HOUSE.draft' } });
  check('the password saves it', r.status, 200);
  check('under the name in small letters', r.data.name, 'smith-house');
  check('keeping the file name', r.data.fileName, 'SMITH HOUSE.draft');

  r = await call('GET', '/p/SMITH-HOUSE', { origin: 'https://somewhere-else.example' });
  check('anyone can open it, capitals or not', r.status, 200);
  check('the file comes back byte for byte', Buffer.from(r.data).toString(), DRAFT);
  check('to any site', r.res.headers.get('Access-Control-Allow-Origin'), '*');
  check('a .draft goes out as JSON', r.res.headers.get('Content-Type'), 'application/json');

  r = await call('GET', '/p/jones');
  check('a name nobody uploaded: 404', r.status, 404);
  r = await call('GET', '/p/bad_name!');
  check('a name with other characters: 400', r.status, 400);
  r = await call('PUT', '/p/-dash-first', { pw: 'hunter2-long', body: DRAFT });
  check('a name may not start with a dash', r.status, 400);

  const zip = new Uint8Array([0x50, 0x4b, 3, 4, 0, 0, 0, 0]);
  r = await call('PUT', '/p/timberhouse', { pw: 'hunter2-long', body: zip });
  check('a SAVE AS ZIP is taken', r.status, 200);
  r = await call('GET', '/p/timberhouse');
  check('and goes out as a zip', r.res.headers.get('Content-Type'), 'application/zip');
  r = await call('PUT', '/p/picture', { pw: 'hunter2-long', body: new Uint8Array([0xff, 0xd8, 0xff, 0xe0]) });
  check('a picture is not a project', r.status, 415);
  r = await call('PUT', '/p/huge', { pw: 'hunter2-long', body: new Uint8Array(25 * 1024 * 1024 + 1).fill(0x20) });
  check('over 25 MB is refused', r.status, 413);

  r = await call('PUT', '/p/smith-house', { pw: 'hunter2-long', body: JSON.stringify({ version: 2 }) });
  r = await call('GET', '/p/smith-house');
  check('the same name again replaces it', Buffer.from(r.data).toString(), JSON.stringify({ version: 2 }));

  r = await call('GET', '/list');
  check('the list wants the password', r.status, 401);
  r = await call('GET', '/list', { pw: 'hunter2-long' });
  check('with it, every project is listed', r.data.projects.map(p => p.name).sort(), ['smith-house', 'timberhouse']);
  r = await call('GET', '/check', { pw: 'hunter2-long' });
  check('/check says yes to the password', r.status, 200);
  r = await call('GET', '/check', { pw: 'nope' });
  check('/check says no to anything else', r.status, 401);

  r = await call('DELETE', '/p/timberhouse');
  check('no password: delete refused', r.status, 401);
  r = await call('DELETE', '/p/timberhouse', { pw: 'hunter2-long' });
  check('the password deletes it', r.status, 200);
  r = await call('GET', '/p/timberhouse');
  check('and it is gone', r.status, 404);

  r = await call('OPTIONS', '/list', { origin: 'https://ruffdrafter.com' });
  check('ruffdrafter.com may ask', r.res.headers.get('Access-Control-Allow-Origin'), 'https://ruffdrafter.com');
  r = await call('OPTIONS', '/list', { origin: 'https://evil.example' });
  check('another site may not', r.res.headers.get('Access-Control-Allow-Origin'), null);

  const bare = { PROJECTS: fakeBucket() };
  r = await worker.fetch(new Request(`${BASE}/check`, { headers: { Authorization: 'Bearer ' } }), bare);
  check('no password set in Cloudflare: nobody gets in, not even with a blank one', r.status, 401);

  console.log(failed ? `\n  ${failed} of ${ran} checks FAILED\n` : `\n  ${ran} checks passed\n`);
  process.exit(failed ? 1 : 0);
})();
