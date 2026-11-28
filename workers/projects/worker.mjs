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
// A FOLDER FOR EACH HOUSE (jb, 28 Nov 2026: "can we arrange a FILE for each
// house project i mean a folder for each project", "i can store zips and
// also have a viewer area in there for them"). In the bucket:
//   projects/NAME/drawing        the house itself, what /viewer/NAME opens
//                                and what MODEL's SAVE ONLINE replaces
//   projects/NAME/files/FILE     anything else for that house: zips, PDFs,
//                                photos, for the customer to download
// A project uploaded before folders (projects/NAME, one loose file) still
// opens; its next save moves it into the folder.
//
// WHAT IT ANSWERS
//   GET    /p/NAME        the house drawing, to anyone (a link is meant to be shared)
//   PUT    /p/NAME        save the drawing (password) -- saving again replaces it
//   DELETE /p/NAME        remove the whole folder (password)
//   GET    /f/NAME        what is in the folder: the drawing and the files, to anyone
//   GET    /f/NAME/FILE   one file from the folder, as a download, to anyone
//   PUT    /f/NAME/FILE   add or replace a file in the folder (password)
//   DELETE /f/NAME/FILE   remove one file (password)
//   GET    /list          every project: name, size, when, file name, files (password)
//   GET    /check         is this password right? (password)
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

// Where things sit in the bucket (see the folder note at the top).
const legacyKeyOf = name => `projects/${name}`;
const drawingKeyOf = name => `projects/${name}/drawing`;
const filesPrefixOf = name => `projects/${name}/files/`;
// A file name in a folder: letters, digits, spaces, dots, dashes, brackets
// and underscores, up to 120, no leading dot. Capitals are kept.
const cleanFileName = raw => {
  const n = String(raw || '').replace(/[^\w.\- ()]+/g, '').replace(/^[.\s]+/, '').trim().slice(0, 120);
  return n || null;
};
const contentTypeOf = fileName => {
  const ext = (/\.([a-z0-9]+)$/i.exec(fileName) || [])[1];
  return ({
    zip: 'application/zip', pdf: 'application/pdf', png: 'image/png', jpg: 'image/jpeg',
    jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif', txt: 'text/plain; charset=utf-8',
    draft: 'application/json', json: 'application/json', dxf: 'application/dxf',
    glb: 'model/gltf-binary', obj: 'text/plain; charset=utf-8', stl: 'model/stl',
  })[String(ext || '').toLowerCase()] || 'application/octet-stream';
};
// The drawing: in the folder, or the loose file from before folders.
const getDrawing = async (env, name) =>
  (await env.PROJECTS.get(drawingKeyOf(name))) || (await env.PROJECTS.get(legacyKeyOf(name)));
const headDrawing = async (env, name) =>
  (await env.PROJECTS.head(drawingKeyOf(name))) || (await env.PROJECTS.head(legacyKeyOf(name)));
// Every key under a prefix, page by page.
const listAll = async (env, prefix) => {
  const out = [];
  let cursor;
  do {
    const page = await env.PROJECTS.list({ prefix, cursor, include: ['customMetadata'] });
    out.push(...page.objects);
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);
  return out;
};
const whenOf = o => (o.customMetadata && o.customMetadata.uploadedAt) || (o.uploaded ? new Date(o.uploaded).toISOString() : '');
const readBody = async request => {
  const said = Number(request.headers.get('Content-Length'));
  if (Number.isFinite(said) && said > MAX_BYTES) return null;
  const bytes = new Uint8Array(await request.arrayBuffer());
  return bytes.length > MAX_BYTES ? null : bytes;
};

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
    'Access-Control-Allow-Headers': 'Authorization, Content-Type, X-File-Name, X-Saved-From',
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
    const isGetFile = request.method === 'GET' && (path.startsWith('/p/') || path.startsWith('/f/'));
    const headers = cors(request, env, isGetFile);

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(request, env, false) });
    if (!env || !env.PROJECTS) return json({ error: 'The PROJECTS bucket is not connected to this worker.' }, 500, headers);

    if (path.startsWith('/p/')) {
      const name = cleanName(decodeURIComponent(path.slice(3)));
      if (!name) return json({ error: 'Names are letters, numbers and dashes.' }, 400, headers);

      if (request.method === 'GET') {
        const obj = await getDrawing(env, name);
        if (!obj) return json({ error: `No project called ${name}.` }, 404, headers);
        const meta = obj.customMetadata || {};
        return new Response(obj.body, {
          status: 200,
          headers: {
            ...headers,
            'Content-Type': (obj.httpMetadata && obj.httpMetadata.contentType) || 'application/octet-stream',
            'X-File-Name': meta.fileName || `${name}.draft`,
            'X-Uploaded': meta.uploadedAt || '',
            // A replaced drawing shows on the next open or refresh: the
            // browser asks again every time (MODEL's SAVE ONLINE is "live").
            'Cache-Control': 'no-cache',
          },
        });
      }

      if (!(await passwordOk(request, env))) return json({ error: 'Wrong password.' }, 401, headers);

      if (request.method === 'PUT') {
        const bytes = await readBody(request);
        if (!bytes) return json({ error: 'Files can be up to 25 MB.' }, 413, headers);
        const kind = kindOf(bytes);
        if (!kind) return json({ error: 'That is not a .draft or a SAVE AS ZIP.' }, 415, headers);
        const fileName = cleanFileName(request.headers.get('X-File-Name')) || `${name}.${kind}`;
        const uploadedAt = new Date().toISOString();
        const savedFrom = String(request.headers.get('X-Saved-From') || 'upload').replace(/[^\w-]/g, '').slice(0, 20);
        await env.PROJECTS.put(drawingKeyOf(name), bytes, {
          httpMetadata: { contentType: kind === 'zip' ? 'application/zip' : 'application/json' },
          customMetadata: { fileName, uploadedAt, savedFrom },
        });
        // The loose file from before folders is now the folder's drawing.
        await env.PROJECTS.delete(legacyKeyOf(name));
        return json({ ok: true, name, size: bytes.length, fileName, uploadedAt }, 200, headers);
      }

      if (request.method === 'DELETE') {
        const keys = (await listAll(env, `projects/${name}/`)).map(o => o.key);
        keys.push(legacyKeyOf(name));
        for (let i = 0; i < keys.length; i += 1000) await env.PROJECTS.delete(keys.slice(i, i + 1000));
        return json({ ok: true, name }, 200, headers);
      }
      return json({ error: 'Not allowed.' }, 405, headers);
    }

    if (path.startsWith('/f/')) {
      const [rawName, ...rest] = path.slice(3).split('/');
      const name = cleanName(decodeURIComponent(rawName || ''));
      if (!name) return json({ error: 'Names are letters, numbers and dashes.' }, 400, headers);

      // THE FOLDER: the drawing and every file, open to anyone with the link.
      if (!rest.length) {
        if (request.method !== 'GET') return json({ error: 'Not allowed.' }, 405, headers);
        const drawing = await headDrawing(env, name);
        const files = (await listAll(env, filesPrefixOf(name))).map(o => ({
          fileName: o.key.slice(filesPrefixOf(name).length),
          size: o.size,
          uploadedAt: whenOf(o),
        })).sort((a, b) => a.fileName.localeCompare(b.fileName));
        if (!drawing && !files.length) return json({ error: `No project called ${name}.` }, 404, headers);
        return json({
          name,
          drawing: drawing ? {
            fileName: (drawing.customMetadata && drawing.customMetadata.fileName) || `${name}.draft`,
            size: drawing.size,
            uploadedAt: whenOf(drawing),
          } : null,
          files,
        }, 200, headers);
      }

      const fileName = cleanFileName(decodeURIComponent(rest.join('/')));
      if (!fileName) return json({ error: 'That is not a file name.' }, 400, headers);
      const fileKey = filesPrefixOf(name) + fileName;

      if (request.method === 'GET') {
        const obj = await env.PROJECTS.get(fileKey);
        if (!obj) return json({ error: `No file called ${fileName} in ${name}.` }, 404, headers);
        return new Response(obj.body, {
          status: 200,
          headers: {
            ...headers,
            'Content-Type': (obj.httpMetadata && obj.httpMetadata.contentType) || contentTypeOf(fileName),
            'Content-Disposition': `attachment; filename="${fileName.replace(/"/g, '')}"`,
            'X-File-Name': fileName,
            'X-Uploaded': whenOf(obj),
            'Cache-Control': 'no-cache',
          },
        });
      }

      if (!(await passwordOk(request, env))) return json({ error: 'Wrong password.' }, 401, headers);

      if (request.method === 'PUT') {
        const bytes = await readBody(request);
        if (!bytes) return json({ error: 'Files can be up to 25 MB.' }, 413, headers);
        if (!bytes.length) return json({ error: 'That file is empty.' }, 400, headers);
        const uploadedAt = new Date().toISOString();
        await env.PROJECTS.put(fileKey, bytes, {
          httpMetadata: { contentType: contentTypeOf(fileName) },
          customMetadata: { uploadedAt },
        });
        return json({ ok: true, name, fileName, size: bytes.length, uploadedAt }, 200, headers);
      }

      if (request.method === 'DELETE') {
        await env.PROJECTS.delete(fileKey);
        return json({ ok: true, name, fileName }, 200, headers);
      }
      return json({ error: 'Not allowed.' }, 405, headers);
    }

    if (path === '/check' && request.method === 'GET') {
      if (!(await passwordOk(request, env))) return json({ error: 'Wrong password.' }, 401, headers);
      return json({ ok: true }, 200, headers);
    }

    // EVERY PROJECT, one row per folder: the drawing's size, date and file
    // name (what the viewer's PROJECTS list and MODEL's OPEN ONLINE show),
    // and how many other files the folder holds.
    if (path === '/list' && request.method === 'GET') {
      if (!(await passwordOk(request, env))) return json({ error: 'Wrong password.' }, 401, headers);
      const byName = new Map();
      const row = name => {
        if (!byName.has(name)) byName.set(name, { name, size: 0, uploadedAt: '', fileName: '', files: 0, hasDrawing: false });
        return byName.get(name);
      };
      for (const o of await listAll(env, 'projects/')) {
        const rest = o.key.slice('projects/'.length);
        const slash = rest.indexOf('/');
        const name = slash < 0 ? rest : rest.slice(0, slash);
        const tail = slash < 0 ? '' : rest.slice(slash + 1);
        const r = row(name);
        if (tail === '' || tail === 'drawing') {
          // The folder's drawing wins over a loose file of the same name.
          if (r.hasDrawing && tail === '') continue;
          r.hasDrawing = tail === 'drawing' || r.hasDrawing;
          r.size = o.size;
          r.uploadedAt = whenOf(o);
          r.fileName = (o.customMetadata && o.customMetadata.fileName) || '';
        } else if (tail.startsWith('files/')) {
          r.files += 1;
        }
      }
      const out = [...byName.values()].map(({ hasDrawing, ...r }) => r);
      out.sort((a, b) => String(b.uploadedAt).localeCompare(String(a.uploadedAt)));
      return json({ projects: out }, 200, headers);
    }

    return json({ error: 'Nothing here. Try /p/NAME or /f/NAME.' }, 404, headers);
  },
};
