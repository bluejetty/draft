// THE TOOL KEYS' FACES (Movie, 27 Oct): "on the BUILD buttons can you draw
// little icons for each. do the best you can and i will refine later.. also
// for the DRAFTING keys. don't put text in the box except the letter, just an
// icon and command letter, and when the user scolls over the tool name should
// be first 'WALL - press W to draw a wall.' something like that to explain the
// KEY, and what it does".
//
// ONE SMALL DRAWING PER TOOL, line work on a 24 grid in currentColor, so a key
// takes the skin's ink and the accent when armed exactly as its letter does.
// `does` is the rest of the tooltip's sentence, said the same way whether the
// tool has a letter or not.
//
// No DOM, no page state: the column asks for a face and a sentence and builds
// the key itself.
if (!window.DraftToolIcons) {
(() => {
  const ICONS = Object.freeze({
    select: '<path d="M6 3v15l4-4 3 7 2.4-1-3-6.8H18z" />',
    extend: '<path d="M3 12h11" /><path d="M14 12h5" stroke-dasharray="1.6 1.8" />'
      + '<path d="M16 9l3 3-3 3" /><path d="M21 4v16" />',
    copy: '<rect x="4" y="4" width="11" height="11" rx="1" />'
      + '<rect x="9" y="9" width="11" height="11" rx="1" />',
    trim: '<path d="M14 3v18" /><path d="M3 12h11" /><path d="M14 12h7" stroke-dasharray="1.6 1.8" />'
      + '<path d="M17 7l3 3m0-3l-3 3" />',
    move: '<path d="M12 3v18M3 12h18" /><path d="M9 6l3-3 3 3M9 18l3 3 3-3M6 9l-3 3 3 3M18 9l3 3-3 3" />',
    stretch: '<path d="M4 8h9v12H4z" stroke-dasharray="2 1.6" /><path d="M4 8h9" />'
      + '<path d="M13 14h7" /><path d="M17 11l3 3-3 3" />',
    line: '<path d="M5 19L19 5" /><circle cx="5" cy="19" r="1.8" /><circle cx="19" cy="5" r="1.8" />',
    shape: '<path d="M12 3l8 6-3 11H7L4 9z" />',
    dimension: '<path d="M4 6v12M20 6v12" /><path d="M4 12h16" />'
      + '<path d="M6.5 14.5l-3-5M22.5 14.5l-3-5" />',
    annotation: '<path d="M4 20l6-6" /><path d="M4 20l1-3.4L7.4 19z" />'
      + '<path d="M11 6h9M11 10h9M11 14h6" />',
    roomtag: '<rect x="3" y="6" width="18" height="12" rx="2" /><path d="M7 10.5h10M7 14h6" />',
    cut: '<path d="M12 2v20" stroke-dasharray="3 2" /><circle cx="12" cy="12" r="4" />'
      + '<path d="M12 8v8" /><path d="M16 12l3-2v4z" />',
    assembly: '<rect x="4" y="4" width="7" height="7" /><rect x="13" y="4" width="7" height="7" />'
      + '<rect x="4" y="13" width="16" height="7" /><path d="M2 2h20v20H2z" stroke-dasharray="2 1.6" />',
    multiple: '<rect x="3" y="8" width="5" height="8" /><rect x="10" y="8" width="5" height="8" />'
      + '<rect x="17" y="8" width="5" height="8" stroke-dasharray="1.6 1.4" />',
    wall: '<path d="M3 8h18M3 16h18" /><path d="M5 16l8-8M11 16l8-8M17 16l4-4M3 12l4-4" stroke-width="1" />',
    fenestration: '<path d="M2 18h6M20 18h2" /><path d="M8 18V6" /><path d="M8 6a12 12 0 0 1 12 12" stroke-dasharray="2 1.6" />',
    floor: '<path d="M3 17l5-10h13l-5 10z" /><path d="M7.5 17l5-10M12 17l5-10" stroke-width="1" />',
    roof: '<path d="M2 18L12 6l10 12z" /><path d="M12 6v12" stroke-width="1" />',
    dormer: '<path d="M2 20L12 4l10 16z" /><path d="M9 20v-5l3-3 3 3v5" />',
    column: '<rect x="6" y="6" width="12" height="12" /><path d="M6 6l12 12M18 6L6 18" />',
    beam: '<rect x="2" y="9" width="4" height="6" /><rect x="18" y="9" width="4" height="6" />'
      + '<path d="M6 12h12" stroke-dasharray="3 1.8" />',
    stair: '<path d="M3 21h5v-5h4v-5h4V6h5" /><path d="M3 21V16" stroke-width="1" />',
    fixture: '<rect x="7" y="3" width="10" height="5" rx="1" /><ellipse cx="12" cy="14.5" rx="5" ry="6.5" />',
  });

  // THE REST OF THE TOOLTIP: "WALL — press W to draw a wall."
  const DOES = Object.freeze({
    select: 'pick items',
    extend: 'run a line or wall on to the next one',
    copy: 'copy what is picked',
    trim: 'cut a line or wall back to the one it crosses',
    move: 'move what is picked',
    stretch: 'stretch what a box crosses',
    line: 'draw a line',
    shape: 'draw a filled shape',
    dimension: 'dimension',
    annotation: 'write a note',
    roomtag: 'place a room tag',
    cut: 'cut a section',
    assembly: 'make the picked items one assembly',
    multiple: 'make copies in a row (coming soon)',
    wall: 'draw a wall',
    fenestration: 'place a door or window',
    floor: 'draw a floor',
    roof: 'draw a roof',
    dormer: 'add a dormer',
    column: 'place a column',
    beam: 'place a beam',
    stair: 'place a stair',
    fixture: 'place a fixture',
    outline: 'trace the house outline',
  });

  const svg = id => (ICONS[id]
    ? `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6" `
      + `stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[id]}</svg>`
    : '');

  // "WALL — press W to draw a wall." / "ROOM TAG — place a room tag."
  const title = (name, key, id) => {
    const does = DOES[id] || '';
    const head = String(name).toUpperCase();
    if (!does) return head;
    return key ? `${head} — press ${key} to ${does}.`
      : `${head} — ${does.charAt(0).toUpperCase()}${does.slice(1)}.`;
  };

  window.DraftToolIcons = Object.freeze({ ICONS, DOES, svg, title });
})();
}
