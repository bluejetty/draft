// ROUGH DRAFTER'S FAVOURITE LINKS, read by LINKS.html (Movie, 19 Oct): "put
// a link to useful other programs on my entry page maybe in the REFERENCE
// side, put INTERNET LINKS -- as a link that will go into a new page with
// basically ROUGHDRAFTER Favorite links. put this link in there as the first
// one" -- the DXF to DWG converter he had just asked about.
//
// THE SAME SHAPE AS codes-catalog.js, so the two pages render one way. One
// entry per link: `group` is the heading it lists under; `kind` is the small
// tag in front of it (TOOL, LINK, PDF ...); `url` is where it lives; `note`
// says what it is for and anything a drafter should know before pressing it.
// New entries go at the end of their group; the first entry stays first.
window.DraftLinksCatalog = [
  {
    group: 'File converters',
    kind: 'TOOL',
    title: 'DXF to DWG converter (pdfaid)',
    url: 'https://pdfaid.com/dxf-to-dwg',
    note: 'Turns a DXF exported from Rough Drafter into a DWG for AutoCAD. Pick an older DWG version '
      + '(2013) for the widest reach. It is an upload to someone else’s server, so keep a client’s '
      + 'private drawing off it; for those the free ODA File Converter does the same job on your own machine.',
  },
];
