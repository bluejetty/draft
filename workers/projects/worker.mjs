// ROUGH 3D PROJECTS -- the Cloudflare Worker behind roughdrafter.com/viewer/NAME.
//
// jb, 28 Nov 2026: "a filename directory where i can put the file for a
// project and a user can type in https://roughdrafter.com/viewer/PROJECT_NAME
// and it will open their file directly in the viewer", and "drop files into
// the REPO directly from the website", kept "kindof 'secret' so only i can
// upload". The files live in a Cloudflare R2 bucket, not in the repo, so an
// upload is live the second it lands and never waits on a site rebuild.
//
// THIS FILE IS NOT RUN BY THE SITE. jb pastes it into the Cloudflare
// dashboard (Workers & Pages -> roughdrafter-projects -> Edit code); the
// steps are in README.md beside it. It is kept in the repo so it is never
// lost the way the mail worker's code was. Change it here first, then paste.
//
// WHAT IT ANSWERS
//   GET    /p/NAME   the project's file, to anyone (a link is meant to be shared)
//   PUT    /p/NAME   save a file under NAME (password)  -- same name replaces it
//   DELETE /p/NAME   remove it (password)
//   GET    /list     every project: name, size, when, file name (password)
//   GET    /check    is this password right? (password)
// The password is the secret UPLOAD_PASSWORD, sent as "Authorization: Bearer ...".
//
// The bucket is bound as PROJECTS. Names are letters, digits and dashes,
// capitals not counted (jb, 28 Nov 2026), up to 64. Files up to 25 MB
// (jb: "i think that should be enough"), a .draft (JSON) or a SAVE AS ZIP.

const MAX_BYTES = 25 * 1024 * 1024;
const NAME = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/;
const SITES = [
  'https://roughdrafter.com', 'https://www.roughdrafter.com',
  'https://ruffdrafter.com', 'https://www.ruffdrafter.com',
];

const cleanName = raw => {
  const name = String(raw || '').trim().toLowerCase();
  return NAME.test(name) ? name : null;
};

const keyOf = name => `projects/${name}`;

// Who may call the password routes from a browser: the two sites, any
// extra origin listed in the ALLOWED_ORIGINS variable (comma separated),
// and a page on this computer for testing. GET /p/NAME is open to all.
const allowedOrigin = (origin, env) => {
  if (!origin) return null;
  const extra = String((env && env.ALLOWED_ORIGINS) || '').split(',').map(s => s.trim()).filter(Boolean);
  if (SITES.includes(origin) || extra.includes(origin)) return origin;
  if (/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return origin;
  return null;
};

const cors = (request, env, open) => {
  const origin = request.headers.get('Origin');
  const allow = open ? '*' : allowedOrigin(origin, env);
  const h = {
    'Access-Control-Allow-Methods': 'GET, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type, X-File-Name',
    'Access-Control-Expose-Headers': 'X-File-Name, X-Uploaded',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
  if (allow) h['Access-Control-Allow-Origin'] = allow;
  return h;
};

const json = (body, status, headers) => new Response(JSON.stringify(body), {
  status, headers: { ...headers, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});

// The password check, in the same time whatever is typed: both sides are
// hashed first, then every byte compared.
async function passwordOk(request, env) {
  const want = String((env && env.UPLOAD_PASSWORD) || '');
  if (!want) return false;
  const got = (request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  const enc = new TextEncoder();
  const [a, b] = await Promise.all([got, want].map(s => crypto.subtle.digest('SHA-256', enc.encode(s))));
  const x = new Uint8Array(a), y = new Uint8Array(b);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}

// A .draft is JSON (starts with '{' after any spaces); a SAVE AS ZIP starts PK.
const kindOf = bytes => {
  if (bytes.length >= 2 && bytes[0] === 0x50 && bytes[1] === 0x4b) return 'zip';
  for (let i = 0; i < Math.min(bytes.length, 64); i++) {
    const c = bytes[i];
    if (c === 0x20 || c === 0x09 || c === 0x0a || c === 0x0d || c === 0xef || c === 0xbb || c === 0xbf) continue;
    return c === 0x7b ? 'draft' : null;
  }
  return null;
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, '');
    const isGetFile = request.method === 'GET' && path.startsWith('/p/');
    const headers = cors(request, env, isGetFile);

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(request, env, false) });
    if (!env || !env.PROJECTS) return json({ error: 'The PROJECTS bucket is not connected to this worker.' }, 500, headers);

    if (path.startsWith('/p/')) {
      const name = cleanName(decodeURIComponent(path.slice(3)));
      if (!name) return json({ error: 'Names are letters, numbers and dashes.' }, 400, headers);

      if (request.method === 'GET') {
        const obj = await env.PROJECTS.get(keyOf(name));
        if (!obj) return json({ error: `No project called ${name}.` }, 404, headers);
        const meta = obj.customMetadata || {};
        return new Response(obj.body, {
          status: 200,
          headers: {
            ...headers,
            'Content-Type': (obj.httpMetadata && obj.httpMetadata.contentType) || 'application/octet-stream',
            'X-File-Name': meta.fileName || `${name}.draft`,
            'X-Uploaded': meta.uploadedAt || '',
            // A replaced file shows within the minute.
            'Cache-Control': 'public, max-age=60',
          },
        });
      }

      if (!(await passwordOk(request, env))) return json({ error: 'Wrong password.' }, 401, headers);

      if (request.method === 'PUT') {
        const said = Number(request.headers.get('Content-Length'));
        if (Number.isFinite(said) && said > MAX_BYTES) return json({ error: 'Files can be up to 25 MB.' }, 413, headers);
        const bytes = new Uint8Array(await request.arrayBuffer());
        if (bytes.length > MAX_BYTES) return json({ error: 'Files can be up to 25 MB.' }, 413, headers);
        const kind = kindOf(bytes);
        if (!kind) return json({ error: 'That is not a .draft or a SAVE AS ZIP.' }, 415, headers);
        const fileName = String(request.headers.get('X-File-Name') || `${name}.${kind}`).replace(/[^\w.\- ()]+/g, '').slice(0, 120) || `${name}.${kind}`;
        const uploadedAt = new Date().toISOString();
        await env.PROJECTS.put(keyOf(name), bytes, {
          httpMetadata: { contentType: kind === 'zip' ? 'application/zip' : 'application/json' },
          customMetadata: { fileName, uploadedAt },
        });
        return json({ ok: true, name, size: bytes.length, fileName, uploadedAt }, 200, headers);
      }

      if (request.method === 'DELETE') {
        await env.PROJECTS.delete(keyOf(name));
        return json({ ok: true, name }, 200, headers);
      }
      return json({ error: 'Not allowed.' }, 405, headers);
    }

    if (path === '/check' && request.method === 'GET') {
      if (!(await passwordOk(request, env))) return json({ error: 'Wrong password.' }, 401, headers);
      return json({ ok: true }, 200, headers);
    }

    if (path === '/list' && request.method === 'GET') {
      if (!(await passwordOk(request, env))) return json({ error: 'Wrong password.' }, 401, headers);
      const out = [];
      let cursor;
      do {
        const page = await env.PROJECTS.list({ prefix: 'projects/', cursor, include: ['customMetadata'] });
        page.objects.forEach(o => out.push({
          name: o.key.slice('projects/'.length),
          size: o.size,
          uploadedAt: (o.customMetadata && o.customMetadata.uploadedAt) || (o.uploaded ? new Date(o.uploaded).toISOString() : ''),
          fileName: (o.customMetadata && o.customMetadata.fileName) || '',
        }));
        cursor = page.truncated ? page.cursor : undefined;
      } while (cursor);
      out.sort((a, b) => String(b.uploadedAt).localeCompare(String(a.uploadedAt)));
      return json({ projects: out }, 200, headers);
    }

    return json({ error: 'Nothing here. Try /p/NAME.' }, 404, headers);
  },
};
