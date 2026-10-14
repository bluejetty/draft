// THE CODES CATALOG, read by CODES.html (Movie, 12 Oct): "we will start
// cataloging building code, municipal bylaws etc pdfs and links to anything we
// research and obtain information from".
//
// ONE ENTRY PER SOURCE. `group` is the heading it lists under; `kind` is the
// small tag in front of it (PDF, LINK, TABLE, BYLAW ...); `url` is where it
// lives -- a web address, or a file kept in assets/codes/ for a PDF we hold
// ourselves; `note` says what we took from it. New entries go at the end of
// their group.
window.DraftCodesCatalog = [
  {
    group: 'Span tables',
    kind: 'LINK',
    title: 'Wooden floor truss span chart (HomeTrix)',
    url: 'https://hometrix.com/floortrussspan.html',
    note: 'Generic open-web floor truss spans at 19.2" o.c., 40 psf live / 10 psf dead, L/480 — the starting point of our OWJ table.',
  },
  {
    group: 'Span tables',
    kind: 'LINK',
    title: 'Wood floor truss span tables for residential construction',
    url: 'https://minimaldomesticity.com/wood-floor-truss-span-tables-residential-construction/',
    note: 'The same 19.2" o.c. figures, with the basis stated.',
  },
  {
    group: 'Span tables',
    kind: 'LINK',
    title: 'OpenJoist span tables',
    url: 'http://www.openjoist.com/spans.html',
    note: 'Manufacturer open-web joist spans by depth and chord size.',
  },
  {
    group: 'Span tables',
    kind: 'LINK',
    title: 'Open Joist TRIFORCE span table',
    url: 'https://www.openjoisttriforce.com/open-joist-span-table/',
    note: 'Manufacturer open-web joist spans by live load, dead load and spacing.',
  },
  {
    group: 'Span tables',
    kind: 'PDF',
    title: 'TRIFORCE open web joist brochure (Tricon, Canada)',
    url: 'https://tricontruss.ca/Resources/triforce-open-web-joist-brochure.pdf',
    note: 'Canadian brochure; deflection checked at L/360 and L/480.',
  },
  {
    group: 'Span tables',
    kind: 'PDF',
    title: 'RedBuilt open-web guide (Canada)',
    url: 'https://www.redbuilt.com/wp-content/uploads/2020/08/RedBuilt_Open-Web_Guide_Canada.pdf',
    note: 'Floor resistance tables by depth and span, with Canadian vibration criteria marked.',
  },

  // ── THE CODE ITSELF, AND THE EDITIONS BEFORE IT ────────────────────────
  //
  // Movie, 14 Oct, after the entry page's right-hand column had taken four
  // editions and their source lines: "might need to make a seperate page for
  // BUILDING CODE links and just have link from the the ENTRY page". This IS
  // that page -- it is called Building Codes & Span Tables and the entry page
  // has linked it since the ring was built, so the shelf moves into the
  // catalog it was always going to outgrow the column into, and the entry
  // keeps the one link it already had.
  //
  // OUR OWN COPY FIRST where he has uploaded one: a `url` that is a path is a
  // file in this repo, and the editions he has not uploaded point at the
  // publisher's record instead -- a link to a file that is not there is worse
  // than a link to the record that is.
  {
    group: 'National Building Code of Canada',
    kind: 'PDF',
    title: 'NBC 2020 — the code in force',
    url: 'RD-DOCUMENTS/BUILDING-CODES/CanadaNBC2020.pdf',
    note: 'Our copy. Published as NR24-28-2020 at publications.gc.ca/collections/collection_2022/cnrc-nrc/NR24-28-2020-eng.pdf.',
  },
  {
    group: 'National Building Code of Canada',
    kind: 'PDF',
    title: 'NBC 2020 — Section 9 illustrated',
    url: 'RD-DOCUMENTS/BUILDING-CODES/CanadaNBC2020Sec9Illustrated.pdf',
    note: 'Our copy. Part 9 drawn out — housing and small buildings, which is what this app builds.',
  },
  {
    group: 'National Building Code of Canada',
    kind: 'PDF',
    title: 'NBC 2025 — the edition coming',
    url: 'RD-DOCUMENTS/BUILDING-CODES/Canada-NBC-NR24-28-2025-eng.pdf',
    note: 'Our copy. Published, but not in force until a province adopts it — Movie, 14 Oct: "i don\'t think it is \'active\' yes still needs to pass legistlation". Published as NR24-28-2025.',
  },
  {
    group: 'National Building Code of Canada',
    kind: 'PDF',
    title: 'NBC 2015',
    url: 'RD-DOCUMENTS/BUILDING-CODES/2015NBC-V2_National_Building_Code.pdf',
    note: 'Our copy. Record: nrc-publications.canada.ca id c8876272-9028-4358-9b42-6974ba258d99.',
  },
  {
    group: 'National Building Code of Canada',
    kind: 'LINK',
    title: 'NBC 2010',
    url: 'https://nrc-publications.canada.ca/eng/view/ft/?id=cbd245df-bc91-4033-a538-fb20fcf536a1&dp=4&dsl=en',
    note: 'NRC publication record. For reading a set drawn to the code of its day.',
  },
  {
    group: 'National Building Code of Canada',
    kind: 'LINK',
    title: 'NBC 2005',
    url: 'https://nrc-publications.canada.ca/eng/view/ft/?id=2623b771-c768-4b67-a2df-0d5895011263&dsl=en',
    note: 'NRC publication record.',
  },
  {
    group: 'National Building Code of Canada',
    kind: 'LINK',
    title: 'NBC 1995',
    url: 'https://nrc-publications.canada.ca/eng/view/ft/?id=a6edb19d-6a71-44f7-84a9-bd9ed46a065d&dsl=en',
    note: 'NRC publication record.',
  },
  {
    group: 'References',
    kind: 'PDF',
    title: 'Canadian Wood-Frame House Construction (CMHC)',
    url: 'RD-DOCUMENTS/REF/CMHC-House-Construction-NH17-3-2013-eng.pdf',
    note: 'Our copy. CMHC NH17-3-2013, published at publications.gc.ca/collections/collection_2014/schl-cmhc/NH17-3-2013-eng.pdf.',
  },
];
