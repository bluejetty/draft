# BOARD — SAVE AS should let the drafter choose a folder

**Movie, 20 Sep 2026**, with the dialog open on `draft.bluejetty.ca`:

> *"also for later: when the user selects 'Save As' it should allow them to
> select a folder to save in"*

Status: **RECORDED, NOT BUILT**, at his instruction. The facts below were
cheap to take while the page was open; none of it is a design.

---

## What it does today

`#save-as` is a card on the page — a text field pre-filled with
`generatedFileName()` and a Save / Cancel row (`MODEL.html:2239`). Pressing
Save runs `downloadDrawing`:

    const file = new File([contents], name, { type: 'application/json' });
    const url = URL.createObjectURL(file);
    const link = document.createElement('a');
    link.href = url;
    link.download = file.name;
    link.click();

That is a **download**, so the browser's own download directory decides where
it lands. The drafter names the file and the browser chooses the folder, which
is exactly the half Movie is asking to swap.

The name itself is settled and is not part of this board:
`drawing-format.js`'s `drawingFileName` makes `20260920T2006.draft` — local
time to the minute, deliberately, because "two saves inside one minute are the
same drafting minute".

## What choosing a folder actually requires

**`window.showSaveFilePicker`** — the File System Access API. It opens the
platform's real save dialog, returns a handle, and the page writes through it.
It is the only way a web page can put a file somewhere the user picked.

**AND IT IS NOT EVERYWHERE, which is the whole cost of this board.** It is
Chromium-only: Chrome, Edge, Brave, Opera. **Firefox and Safari do not
implement it.** So this cannot replace `downloadDrawing`; it has to sit in
front of it, with the current path as the fallback on any browser that lacks
it. Two ways to save, both of which have to keep working and keep being
tested.

Two further constraints worth knowing before it is scoped:

- **Secure context and a user gesture.** The picker must be called from the
  click that opened it, so an `await` between the press and the call can lose
  the gesture and the dialog never opens.
- **Cancel is an exception, not a value.** The picker throws `AbortError` when
  the drafter backs out, and a Save that reads a cancel as a failure would put
  a scary notice on screen for a normal press.

## What has to be decided

1. **Does the page's own card stay?** With a real picker the platform dialog
   already takes a name, so the card would be asking for something twice.
   Keeping it for the fallback and skipping it where the picker exists means
   the same button behaves differently on two browsers — which may be right,
   and is a decision rather than an accident.
2. **Is the handle remembered?** The API allows keeping a handle so the next
   save goes to the same place without asking. That is closer to what a
   drafter expects from SAVE AS in a desktop drafting tool, and it is storage
   of a different kind than anything the app keeps today.
3. **What the specs drive.** Playwright cannot operate a native file dialog.
   The fallback path is testable as it is now; the picker path would need the
   API stubbed, which is a test that proves the page CALLS it rather than that
   the file lands.
