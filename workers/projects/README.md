# ROUGH 3D PROJECTS: Cloudflare setup

This folder holds the code for the small Cloudflare program ("Worker") that keeps
your project files for links like `roughdrafter.com/viewer/smith-house`.
The website cannot keep files by itself, so the files live in Cloudflare storage
("R2"), and this Worker hands them out to anyone with the link and only lets
**your password** add, replace or delete them.

You set this up once, by hand, in your Cloudflare account. About 10 minutes.

## 1. Make the storage bucket

1. Log in at <https://dash.cloudflare.com>.
2. In the left menu open **R2 Object Storage**. If it asks, turn R2 on
   (the free tier is 10 GB; Cloudflare may want a card on file, you are not
   charged inside the free tier).
3. Press **Create bucket**. Name it `roughdrafter-projects`, leave the rest,
   press **Create bucket**.

## 2. Make the Worker

1. Left menu: **Workers & Pages** → **Create** → **Create Worker**
   (pick "Start with Hello World").
2. Name it `roughdrafter-projects` and press **Deploy**.
3. Press **Edit code**. Delete everything in the editor, paste in the whole of
   [`worker.mjs`](worker.mjs) from this folder, and press **Deploy**.

## 3. Connect the bucket and set your password

On the Worker's page, open **Settings**:

1. **Bindings** → **Add** → **R2 bucket**.
   Variable name: `PROJECTS` (capitals, exactly). Bucket: `roughdrafter-projects`.
   Save / Deploy.
2. **Variables and Secrets** → **Add**. Type: **Secret**.
   Name: `UPLOAD_PASSWORD`. Value: your upload password (make it long, it is the
   real lock). Save / Deploy.

## 4. Check the address

The Worker's address shows on its page, like
`https://roughdrafter-projects.bluejetty.workers.dev`.
Open `<that address>/p/test` in a browser: it should say
`{"error":"No project called test."}`. That means it is working.

The viewer is set to `https://roughdrafter-projects.bluejetty.workers.dev`
(`PROJECTS_API` at the top of `viewer/projects.js`). If yours is different,
send it over and it gets changed there.

## 5. Your first upload

1. Open `roughdrafter.com/viewer/`.
2. Open the blue (or yellow) NOTEPAD tab and type `3DBONES` on any of the first
   five lines of page 1.
3. A **PROJECTS** button appears in the top bar. Press it, type your password
   once (tick "remember on this computer"), pick a `.draft` or SAVE AS ZIP,
   name it, press **UPLOAD**, and copy the link.

## Notes

- Anyone with a link can open that project. Names are letters, numbers and
  dashes; capitals do not count (`Smith-House` = `smith-house`).
- Same name again replaces the file. Files up to 25 MB.
- To change the password later: Settings → Variables and Secrets → edit
  `UPLOAD_PASSWORD`. Every computer then asks for the new one.
- If you ever change `worker.mjs` in the repo, paste it into the dashboard
  again (step 2.3); Cloudflare does not read the repo.
