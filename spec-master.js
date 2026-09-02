// THE OFFICE MASTER SPECIFICATION — the written half of a drawing set, as data.
//
// Every entry is a numbered section the trades already read by number, which is
// why this is a list of sections rather than four typed pages: the numbering is
// a construction convention first, and the app gets its addressing for free off
// the same numbers. A drawing can later say "this house has piles" and pull
// 3-A in by id; nothing here needs re-laying-out for that to work.
//
// Transcribed from the office's own spec pages, with three deliberate changes:
//   - No names, no company, no phone number, no city. Wherever the text pointed
//     at a person it now points at a ROLE (the designer, the contractor), and
//     wherever it named a place it is a BLANK the job fills in. A master that
//     carries one project's people gets pasted into the next project's set.
//   - `verify: true` marks a section whose numbers belong to a job, not to the
//     office — pile schedules, bearing capacities, climate zone. The page shows
//     those as needing a per-project answer instead of letting a previous
//     project's numbers ride along unread.
//   - Spelling only. Where the source read MUNICIPLE, CANDIAN, PREFORATED,
//     DRAINGAGE, SEPERATION, PROFFESSIONAL, POLYETHE, COVERGE, EXTENTED,
//     ANCOR, MANFACTURERS, PERMENENT, OMMISSIONS, ENTRACE or IAC-for-IAW, it
//     now reads correctly. Nothing else was reworded.
//
// One substantive correction is flagged rather than made silently — see 8-B.
if (!window.DraftSpecMaster) {
(() => {

  // A section body is plain text: lines as the drafter wrote them. The page
  // flows them into columns, so a line break here is a line break on paper.
  // `kind` tells the page how to set it:
  //   'notes'  — the default, one line per line
  //   'terms'  — two columns of TERM — MEANING (the abbreviations table)
  //   'table'  — rows of cells separated by ' | '
  //   'legend' — symbol name per line, drawn with the electric symbol painter
  const DIVISIONS = [
    { no: 1,  title: 'GENERAL NOTES' },
    { no: 2,  title: 'SITEWORK' },
    { no: 3,  title: 'CONCRETE' },
    { no: 4,  title: 'MASONRY' },
    { no: 5,  title: 'STRUCTURAL STEEL' },
    { no: 6,  title: 'WOOD CONSTRUCTION' },
    { no: 7,  title: 'THERMAL & MOISTURE PROTECTION' },
    { no: 8,  title: 'DOORS & WINDOWS' },
    { no: 9,  title: 'FINISHES' },
    { no: 10, title: 'FIREPLACE' },
    { no: 11, title: 'EQUIPMENT' },
    { no: 12, title: 'BUILT-IN CABINETS' },
    { no: 13, title: 'FIRE & HEALTH PROTECTION' },
    { no: 14, title: 'PLUMBING' },
    { no: 15, title: 'MECHANICAL' },
    { no: 16, title: 'ELECTRICAL & COMMUNICATIONS' },
  ];

  const SECTIONS = [

    // ---------------------------------------------------------------- 1
    {
      id: '1-A', div: 1, title: 'ABBREVIATIONS', kind: 'terms',
      body: [
        'ADJ — ADJUSTABLE',
        'AUTO — AUTOMATIC',
        'BOT — BOTTOM',
        'CGSB — CANADIAN GENERAL STANDARDS BOARD',
        'CONC — CONCRETE',
        'CONT — CONTINUOUS',
        'DIAG — DIAGONAL',
        'DP — DEEP',
        'EA — EACH',
        'ELEC — ELECTRIC PANEL',
        "ENG'D — ENGINEERED",
        'EW — EACH WAY',
        'EXIST — EXISTING',
        'EXT — EXTERIOR',
        'FG — FIRE GUARD',
        'FL — FLOOR',
        'FRR — FIRE RESISTANCE RATING',
        'GALV — GALVANIZED',
        'GF — GAS FURNACE',
        'GYP — GYPSUM',
        'HORIZ — HORIZONTAL',
        'HR — HOUR',
        'HS — HIGH STRENGTH',
        'HT — HEIGHT',
        'HVAC — HEATING / VENTILATION / AIR CONDITIONING SYSTEM',
        'HWH — HOT WATER HEATER',
        'IAW — IN ACCORDANCE WITH',
        'ICF — INSULATED CONCRETE FORM',
        'INSUL — INSULATION',
        'INT — INTERIOR',
        'LBS — POUNDS',
        'LSL — LAMINATED STRAND LUMBER',
        'LVL — LAMINATED VENEER LUMBER',
        'MAX — MAXIMUM',
        'MECH — MECHANICAL',
        'MED — MEDIUM',
        'MFR — MANUFACTURER',
        'MID — MIDDLE',
        'MIN — MINIMUM',
        'MPa — MEGAPASCAL',
        'NBCC — NATIONAL BUILDING CODE OF CANADA',
        'OC — ON CENTRE',
        'O/H — OVERHEAD',
        'OSB — ORIENTED STRAND BOARD',
        'OWJ — OPEN WEB JOISTS',
        'P.ENG — PROFESSIONAL ENGINEER',
        'PFM — PRE-FINISHED METAL',
        'POLY — POLYETHYLENE',
        'PT — PRESSURE TREATED',
        'PVC — POLYVINYL CHLORIDE',
        'REINF — REINFORCED',
        'REQ — REQUIRED',
        'SEP — SEPARATION',
        'SIM — SIMILAR',
        'SPECS — SPECIFICATIONS',
        'SPF — SPRUCE PINE FIR',
        'SQFT — SQUARE FEET',
        'SQM — SQUARE METRES',
        'T&G — TONGUE & GROOVE',
        'TYP — TYPICAL',
        'VAC — VACUUM',
        'VB — VAPOUR BARRIER',
        'VERT — VERTICAL',
        'W/ — WITH',
        '',
        'METRIC CONVERSION IS SHOWN IN MM AFTER IMPERIAL DIMENSION.',
      ].join('\n'),
    },
    {
      id: '1-B', div: 1, title: 'RESPONSIBILITIES ASSUMED BY THE CONTRACTOR',
      body: [
        '1 – VERIFY SUITABILITY OF DRAWINGS FOR CONSTRUCTION; REPORT ERRORS OR',
        'OMISSIONS TO THE ATTENTION OF THE DESIGNER PRIOR TO CONSTRUCTION. IF YOU',
        'NEED CLARIFICATION ABOUT ANYTHING ON THE PLANS PLEASE CONTACT THE',
        'DESIGNER AND A REPLY WILL FOLLOW AS SOON AS POSSIBLE.',
        '',
        '2 – ENSURE CONSTRUCTION METHODS APPLIED MEET OR EXCEED THE STANDARDS SET',
        'FORTH IN THE NATIONAL BUILDING CODE OF CANADA AND LOCAL MUNICIPAL BYLAWS',
        'APPLICABLE AT THE TIME OF CONSTRUCTION.',
        '',
        '3 – SITE SAFETY, SECURITY & WASTE REMOVAL.',
      ].join('\n'),
    },

    // ---------------------------------------------------------------- 2
    {
      id: '2-A', div: 2, title: 'EXCAVATION',
      body: [
        '- SURVEYOR TO VERIFY ALL DIMENSIONS & EASEMENT LOCATIONS PRIOR TO',
        'EXCAVATION & REPORT DISCREPANCIES TO THE DESIGNER.',
        '- ALL FOOTINGS SHALL BE CAST UPON UNDISTURBED SOIL. OVEREXCAVATION MUST BE',
        'FILLED WITH CONC.',
      ].join('\n'),
    },
    {
      id: '2-B', div: 2, title: 'FOUNDATION DRAINAGE',
      body: [
        '- PERIMETER FOOTING DRAINAGE TILE:',
        'FILTER FABRIC COVERS MIN 6" CRUSHED STONE ON',
        '4" PERFORATED DRAINAGE TILE FULL PERIMETER OF FOOTING.',
        '',
        '* INSULATE FOOTING PERIMETER FOR FROST HEAVE PROTECTION WHERE GRADE IS',
        "LESS THAN 5'-0\" FROM BASE OF FOOTING, WITH 4' WIDE BY 2\" RIGID INSUL.",
        '',
        '- INSTALL 4" PVC CHANNEL IN FOOTING & TIE WEEPING TILE INTO RADON TRAP &',
        'SUMP PIT.',
        '- PLASTIC SUMP PIT MIN 2\'-0" FROM ANY FOOTING. INSTALL MECH AUTO PUMP W/',
        '30" COVER, POWER SUPPLY & DISCHARGE LINE.',
      ].join('\n'),
    },
    {
      id: '2-C', div: 2, title: 'FENCES & DECKS',
      body: [
        'DECK CONSTRUCTION',
        'PT SPF 1x6" DECKING SCREWED TO',
        'PT SPF 2x10" (38x254) JOISTS 16" (406) OC',
        'W/ BRIDGING MIN 6\'-10" (2100) OC RESTING ON',
        '3-PLY 2x10" (38x235) SPF BEAM ON',
        '2x6 COLUMN FASTENED IN POST SUPPORT EMBEDDED IN TOP OF PILE.',
        '',
        'GUARDS FOR DECKS',
        'ARE PERMITTED TO BE MIN 2\'-11 1/2" (900) IN HEIGHT WHERE THE WALKING',
        'SURFACE OF THE DECK IS NOT MORE THAN 70-1/2" (1800) ABOVE FINISHED GROUND',
        'LEVEL.',
        'EXT DECKS MORE THAN 70-1/2" (1800) IN HEIGHT MUST HAVE A GUARD AT MIN 42"',
        '(1070).',
        'EXT DECKS LESS THAN 23-1/2" (600) IN HEIGHT DO NOT REQ A GUARD.',
        'SECURE EXT DOORS LEADING TO DECK UNTIL DECK & GUARDRAIL IS FULLY',
        'CONSTRUCTED.',
        '',
        '- ALL OPEN RAILS MUST HAVE NO MORE THAN 4" (100) SPACE BETWEEN VERT',
        'MEMBERS.',
        '- PROVIDE SAFETY GLASS FOR GUARDS WHERE APPLICABLE.',
      ].join('\n'),
    },

    // ---------------------------------------------------------------- 3
    {
      id: '3-A', div: 3, title: 'PILES', verify: true,
      body: [
        'CONCRETE PILE SCHEDULE',
        'MARK | PILE SIZE AND REINFORCING | PILE LOAD (kPa) FACTORED',
        'P1 | 10" DIA x 14\' LONG, 2-15M x 16\' VERTICAL | 5.0',
        'P2 | 12" DIA x 15\' LONG, 2-15M x 17\' VERTICAL | 15.0',
        'P3 | 12" DIA x 20\' LONG, 2-15M x 22\' VERTICAL | 30.0',
        '',
        '* VERTICAL REINFORCING LENGTH INCLUDES EXTENSION INTO GRADE BEAM.',
        '',
        'THE CAST IN PLACE CONCRETE PILE DESIGN IS BASED ON THE ASSUMPTION THAT THE',
        'SOIL IS COHESIVE (CLAY OR TILL) AND HAS A MINIMUM SKIN FRICTION CAPACITY OF',
        '20 kPa. IF THE CONTRACTOR OBSERVES A SOIL THAT IS COHESIONLESS (SAND OR',
        'SILT) CONCRETE PILES MAY NOT BE APPROPRIATE.',
        'IF THE PILES ARE PLACED IN FILL MATERIAL MORE THAN 6\'-0" IN DEPTH, THE PILE',
        'SHOULD BE LENGTHENED BY THE FILL DEPTH GREATER THAN 6\'-0". IF WATER SEEPAGE',
        'IS ENCOUNTERED DURING DRILLING, CASING SHOULD BE USED TO KEEP PILE HOLES',
        'OPEN AND DRY DURING THE PLACEMENT OF THE CONCRETE. AS CASING IS EXTRACTED,',
        'CONCRETE IN CASING MUST HAVE ADEQUATE HEAD TO DISPLACE ALL WATER IN THE',
        'ANNULAR SPACE.',
        '',
        'STEEL SCREW PILE OPTIONAL',
        'STEEL SCREW PILES MAY BE USED AS ALTERNATE PILE FOUNDATION.',
        '- SCREW PILE DESIGN TO BE COMPLETED & SEALED BY A PROFESSIONAL ENGINEER',
        'REGISTERED IN THE PROVINCE OF CONSTRUCTION TO RESIST THE FACTORED LOADS',
        'NOTED ON THE DRAWING, BASED ON BEARING ON THE HELIX AND SKIN FRICTION ON',
        'THE SHAFT WHERE APPROPRIATE. TORQUE REQUIRED TO INSTALL IS NOT ACCEPTABLE',
        'AS THE BASIS OF DESIGN.',
        '- PILES SHALL BE DESIGNED SO AS NOT TO BE AFFECTED BY FROST.',
        "- REINFORCE WITH 2-15M x 4' LONG EMBEDDED IN CONCRETE FILLED SCREW PILE,",
        'EXTEND TO TOP BARS OF GRADE BEAM (MAX 28").',
        '- SCREW PILE DESIGN TO BE SUBMITTED TO ENGINEER.',
      ].join('\n'),
    },
    {
      id: '3-B', div: 3, title: 'GRADE BEAM',
      body: [
        '- GRADE BEAM CONCRETE SHALL ATTAIN A 28 DAY COMPRESSIVE STRENGTH OF 25 MPa',
        'USING SULFATE RESISTANT CEMENT, TYPE 50/HS.',
        '- FORM 4" x 12" x 1" DP KEY IN THE FOUNDATION TO ACCOMMODATE GRADE BEAM.',
        'DOWEL GRADE BEAM TO FOUNDATION WALL W/ MIN 48" LONG DOWELS W/ SIZE &',
        'SPACING TO MATCH HORIZ REINF IN GRADE BEAM. EPOXY FILL HOLE IF DRILLING IS',
        'REQ.',
        '',
        'GARAGE GRADE BEAM TYP',
        '8" x 36" ICF 6" CORE CONC W/ 4" POLYSTYRENE VOID FORM UNDER, BETWEEN PILES',
        'REINF W/ HORIZ 1-15M, TOP AND BOT',
        'REBAR COVERAGE 1 1/4" MIN, 2" MAX',
        'CORNER BARS OR EXTENDED REBAR AROUND CORNERS',
        'ANCHORING: ANCHOR BOLTS: 2x6" (38x140) PT SPF SILL PLATE W/ GASKET',
        'FASTENED TO 1/2"\u00f8 ANCHORS 4\' OC CAST INTO TOP OF CONCRETE, 4" MIN EMBED.',
      ].join('\n'),
    },
    {
      id: '3-C', div: 3, title: 'FOOTINGS', verify: true,
      body: [
        '* FOOTINGS HAVE BEEN DESIGNED FOR AN ASSUMED BEARING CAPACITY OF 75 kPa.',
        '- FOOTING CONC SHALL ATTAIN A 28 DAY COMPRESSIVE STRENGTH OF 20 MPa USING',
        'SULFATE RESISTANT CEMENT, TYPE 50/HS.',
        '- INSTALL 4" PVC CHANNEL IN FOOTING FOR WEEPING TILE TO TIE INTO THE SUMP',
        'PIT.',
        '',
        'PERIMETER FOOTING TYP',
        '24" x 8" (609x203) DP',
        'CONC REINF W/',
        'HORIZ 2-15M CONT LONG DIRECTION,',
        'AND 10M CROSS BARS AT 4\'-0" OC',
        '',
        'PAD FOOTING TYP',
        '36x36x8" DP',
        'REINF W/ 15M @ 10" OC E/W MIN 3" FROM BOTTOM',
        '3"\u00f8 (76\u00f8) ADJ STEEL TELEPOST',
      ].join('\n'),
    },
    {
      id: '3-D', div: 3, title: 'FOUNDATION WALL',
      body: [
        '- FOUNDATION WALL CONCRETE SHALL ATTAIN A 28 DAY COMPRESSIVE STRENGTH OF',
        'MIN 20 MPa USING SULFATE RESISTANT CEMENT, TYPE 50/HS.',
        '- DRILL HOLES MIN 6" DP IN EXISTING CONC, EPOXY FILL HOLES & INSERT 15M',
        "REBAR DOWEL BARS SPACED 4' (1200) OC. FASTEN TO NEW CONC REBAR.",
        '- VERIFY SIZE OF BEAM POCKETS WITH FLOOR SUPPLIER.',
        '- REBAR COVERAGE 1 1/4" MIN, 2" MAX.',
        '- BEND REBAR AT CORNERS.',
        '',
        'NOTE: FOUNDATION WALLS HAVE BEEN DESIGNED ASSUMING CONTINUOUS LATERAL',
        'SUPPORT IS PROVIDED AT THE TOP AND BOTTOM OF THE WALLS. CONTRACTOR AND',
        'SUPPLIER TO ENSURE THAT THE FLOOR STRUCTURE PROVIDES ADEQUATE LATERAL',
        'SUPPORT AS PER PART 9 OF THE NBCC.',
        '',
        '4\'-6" DP ICF 6" CORE WALL TYP',
        'REINF W/',
        'HORIZ: 2-10M TOP, MID & BOT,',
        'VERT: 1-15M 24" OC INSIDE FACE.',
        '- ANCHORING: 1/2" ANCHOR BOLTS AT 24" OC, 8" EMBED, TYP.',
        'PT SILL PLATE ON TOP',
      ].join('\n'),
    },
    {
      id: '3-E', div: 3, title: 'SLAB',
      body: [
        'BASEMENT SLAB TYP',
        'SHALL ATTAIN A 28 DAY COMPRESSIVE STRENGTH OF 25 MPa USING SULFATE',
        'RESISTANT CEMENT, TYPE 50. APPLY JOINT SEALANT TO PROVIDE CONTINUOUS SEAL',
        'BETWEEN SLAB AT PERIMETER & ALL PENETRATIONS.',
        '3" (76) CONC SLAB REINF W/',
        '10M @ 16" (408) OC E.W. ON',
        '6 MIL CGSB POLY VB ON',
        'MIN 6" (150) CRUSHED STONE.',
        '',
        'GARAGE SLAB TYP',
        'SHALL ATTAIN A 28 DAY COMPRESSIVE STRENGTH OF 32 MPa USING SULFATE',
        'RESISTANT CEMENT, TYPE 50/HS.',
        'SLOPE TO GARAGE DOOR MIN 1/8" : 12" – 4" BACK TO FRONT',
        '4" (102) CONC SLAB REINF W/',
        '10M 16" (408) OC EW ON',
        'MIN 6" (150) CRUSHED STONE',
      ].join('\n'),
    },

    // ---------------------------------------------------------------- 4, 5
    { id: '4-A', div: 4, title: 'MASONRY', body: 'N/A' },
    {
      id: '5-A', div: 5, title: 'STRUCTURAL STEEL',
      body: [
        '3" DIA STEEL ADJUSTABLE POSTS SUPPORT BASEMENT BEAMS, OR BUILT UP WOOD',
        'COLUMNS THAT SUPPORT FULL BEAM WIDTH CAN ALSO BE USED.',
      ].join('\n'),
    },

    // ---------------------------------------------------------------- 6
    {
      id: '6-0', div: 6, title: 'WOOD CONSTRUCTION — GENERAL',
      body: [
        '- ROOF TRUSS, PRE-ENGINEERED BEAMS & FLOOR JOISTS',
        '* ENGINEERED BY MANUFACTURER OR AS NOTED ON DRAWING WITH CONVENTIONAL',
        'LUMBER. * PROFESSIONAL ENGINEER MUST BE LICENSED TO PRACTICE IN THE',
        'PROVINCE OF CONSTRUCTION.',
        '- PT WOOD USED IN CASES WHERE WOOD FRAMING COMES IN CONTACT WITH CONCRETE',
        'AND WHERE WOOD FRAMING IS LESS THAN 6" ABOVE FINISHED GRADE.',
        '- ALL OTHER WOOD USED IS TO BE SPF #2 OR BETTER.',
      ].join('\n'),
    },
    {
      id: '6-A', div: 6, title: 'ROOF CONSTRUCTION',
      body: [
        'C1 ROOF TYP',
        'FIBREGLASS SHINGLES STYLE SELECTED BY OWNER – INSTALLED IAW',
        "MANUFACTURER'S SPECIFICATIONS.",
        '7/16" (11) OSB SHEATHING "H" CLIP SEAMS',
        'ENGINEERED ROOF TRUSS SYSTEM',
        '1x4" (21x89) TRUSS BRACING',
        '18" - 24" DP (R50-70) BLOWN INSULATION FLAT CEILINGS',
        '2 LAYERS R20 BATT ON VAULTED CEILINGS',
        '6 mil CGSB POLY VB',
        '1/2" (13) GYP CEILING FINISH',
      ].join('\n'),
    },
    {
      id: '6-B', div: 6, title: 'FLOOR CONSTRUCTION',
      body: [
        '- INSTALL BLOCKING IN FLOOR TO SUPPORT FULL WIDTH OF COLUMNS.',
        '',
        'C2 MAIN FLOOR TJI',
        'FINISH FLOORING (CONFIRM W/ OWNER)',
        '3/8" (9) OSB UNDERLAYMENT BOARD',
        '3/4" (19) T&G SUBFLOOR',
        'ENGINEERED TJI (11 7/8")',
        '1/2" (13) GYP CEILING FINISH',
      ].join('\n'),
    },
    {
      id: '6-C', div: 6, title: 'WALL CONSTRUCTION',
      body: [
        '- SIZE WIDTH OF BUILT UP WOOD COLUMNS TO SUPPORT FULL WIDTH OF BEAM.',
        '- LINTELS OVER OPENINGS WIDER THAN 6\'-0" REQ ENGINEERED LVL BY MFR.',
        '- LINTELS OVER OPENINGS UP TO 6\'-0" REQ 2-PLY 2x10 SPF LINTEL.',
        '',
        'C3 EXT WALL TYP',
        'FINISH SELECTED BY OWNER – VINYL SIDING',
        'AIR BARRIER (HOUSE WRAP)',
        '3/8" OSB SHEATHING',
        '2x6 SPF 24" OC',
        'R20 BATT INSULATION',
        '6 MIL CGSB POLYETHYLENE VB',
        '1/2" GYP WALL FINISH',
        '',
        'C4 INT WALL TYP',
        '1/2" (13) GYP',
        '2x4 SPF 24" OC',
        '1/2" (13) GYP',
        '* INSTALL 2x4 BRACING IN KITCHEN WALL TO ANCHOR UPPER CABINETS.',
        '',
        'C4B BASEMENT EXT WALL FRAMING TYP',
        'LEAVE 1/2" AIR SPACE BETWEEN WOOD STUD AND CONC',
        'PT SPF BOTTOM PLATE BOLTED TO SLAB',
        '3" SPRAY FOAM INSUL R21',
        '2x4 SPF 24" OC',
        '1/2" (13) GYP',
      ].join('\n'),
    },
    {
      id: '6-D', div: 6, title: 'TALL WALL NOTES',
      body: [
        'TALL WALLS TO BE FULL HEIGHT 1 3/4 x 5 1/2 (2.0E) LVL STUDS AT 16 INCHES ON',
        'CENTRE FRAMED TO THE UNDERSIDE OF THE ROOF TRUSSES. INTERMEDIATE WALL STUDS',
        'TO BE SPRUCE PINE FIR NO. 2 STUDS AT 16 INCHES ON CENTRE FRAMED TO THE',
        'UNDERSIDE OF ROOF TRUSSES.',
        'PROVIDE BUILT UP WOOD STUD COLUMNS ON EACH SIDE OF OPENINGS AS INDICATED ON',
        'THE DRAWINGS. ATTACH EACH PLY OF BUILT UP WOOD COLUMNS WITH 2 ROWS OF',
        '3 1/4 INCH NAILS AT 8 INCHES ON CENTRE. FIRST ROW OF NAILS TO BE LOCATED',
        '3 INCHES FROM TOP AND BOTTOM OF STUD.',
        'TOP AND BOTTOM WALL PLATES TO MATCH WIDTH OF STUD SIZE.',
        'INSTALL 3 - 3 1/4 INCH END NAILS TO EACH STUD AND EACH PLY OF BUILT UP',
        'COLUMN FROM TOP AND BOTTOM PLATES.',
        'PROVIDE BUILT UP WOOD BEAMS OVER EACH OPENING AS INDICATED ON THE DRAWINGS.',
        'ATTACH EACH PLY OF THE BUILT UP WOOD BEAM WITH 2 ROWS OF 3 1/4 INCH NAILS',
        'AT 12 INCHES ON CENTRE. INSTALL MATCHING WALL STUD PLATES ON TOP AND BOTTOM',
        'OF BEAM WHERE INDICATED ON THE DRAWINGS. THE ENDS OF THE BEAM, TOP AND',
        'BOTTOM, TO BE SECURED TO THE BUILT UP WOOD COLUMNS WITH A35 ANCHORS.',
        'INSTALL 2x6 HORIZONTAL BLOCKING AT 4\'-0" ON CENTRE VERTICAL SPACING.',
        'EACH ROOF TRUSS SUPPORTED BY THE TALL WALL INCLUDING BUILT UP STUDS AT',
        'OPENINGS SHALL BE ANCHORED TO THE TOP OF THE TALL WALL WITH L50 ANCHOR',
        'ALONG THE TRUSS PLUS H2.5 HOLD DOWN ANCHOR.',
        'BOTTOM PLATE OF THE TALL WALL SHALL BE ANCHORED TO EACH FLOOR JOIST WITH',
        '3 - 3 1/4 INCH NAILS.',
      ].join('\n'),
    },
    {
      id: '6-E', div: 6, title: 'WOOD COLUMN SCHEDULE', kind: 'table', verify: true,
      body: [
        'MARK | BUILD-UP',
        'WC1 | 3-PLY 2x6 SPF NO.2 (2 FULL HT + 1 CRIPPLE)',
        'WC2 | 3-PLY BUILT-UP COLUMN: 2 - 1 3/4" x 5.5 (2.0E) FULL HT + 1 - 2x6 SPF CRIPPLE',
        'WC3 | 4-PLY BUILT-UP COLUMN: 3 - 1 3/4" x 5.5 (2.0E) FULL HT + 1 - 2x6 SPF CRIPPLE',
        'WC4 | 5-PLY BUILT-UP COLUMN: 4 - 1 3/4" x 5.5 (2.0E) FULL HT + 1 - 2x6 SPF CRIPPLE',
      ].join('\n'),
    },
    {
      id: '6-F', div: 6, title: 'WOOD BEAM SCHEDULE', kind: 'table', verify: true,
      body: [
        'MARK | BUILD-UP',
        'WB1 | 2-PLY 2x10 SPF NO 2',
        'WB2 | 3-PLY 2x10 SPF NO 2',
        'WB3 | 2-PLY 2x10 SPF NO 2',
        'WB4 | 2-PLY 2x10 SPF NO 2',
        'WB5 | 2-PLY 2x10 SPF NO 2',
        'WH1 | 2x6 SPF HORIZONTAL',
      ].join('\n'),
    },

    // ---------------------------------------------------------------- 7
    {
      id: '7-A', div: 7, title: 'DAMP PROOFING',
      body: [
        '- DAMP PROOFING APPLIED TO EXTERIOR FOUNDATION WALL & FOOTING TO FINISH',
        'GRADE.',
        '- DAMP PROOFING IS NOT REQUIRED ON THE INTERIOR FOUNDATION WALL IF AN',
        'INSULATED WALL AND VAPOUR BARRIER ARE INSTALLED.',
      ].join('\n'),
    },
    {
      id: '7-B', div: 7, title: 'ROOF',
      body: [
        '- ROOF SHINGLES & EAVE PROTECTION:',
        '   - ASPHALT / FIBREGLASS SHINGLES STYLE SELECTED BY OWNER.',
        "   - INSTALLED IAW MANUFACTURER'S SPECIFICATIONS.",
        '   - NO 25 GLASS BASE SHEET OR BETTER PRODUCT EAVE PROTECTION, 4" HEAD AND',
        '     END LAP MIN.',
        '   - COVER REMAINING EXPOSED ROOF DECK WITH 1 PLY UNDERLAYMENT MIN 2" HEAD',
        '     LAP AND 4" END LAP PARALLEL TO EAVE PROTECTION.',
        '- ROOF VENTILATION',
        '   - 1/300 ATTIC VENTING REQ.',
        '   - CARDBOARD INSUL STOP TO ALLOW MIN 2" SOFFIT VENTILATION FULL PERIMETER',
        '     OF ROOF.',
        '- PFM FASCIA, VENTED SOFFIT, DRIP EDGE, GUTTER & DOWNSPOUTS.',
      ].join('\n'),
    },
    {
      id: '7-C', div: 7, title: 'VAPOUR BARRIER & FUME BARRIER',
      body: [
        '- DARK DASHED LINE REPRESENTS 6 mil CGSB VB. LAP & SEAL ALL JOINTS &',
        'PENETRATIONS.',
        '- EFFECTIVE FUME BARRIER & 5/8" FG INSTALLED BETWEEN THE ATTACHED GARAGE AND',
        'INT OF THE HOME. THE DOOR FROM HOUSE TO GARAGE SHALL BE INSTALLED WITH',
        'WEATHER-STRIPPING AND AUTOMATIC DOOR CLOSER.',
      ].join('\n'),
    },
    {
      id: '7-D', div: 7, title: 'INSULATION',
      body: [
        '- INSUL FLOOR JOIST CAVITY AT EXT WALL WITH 2 LAYERS R20 BATT INSUL & 6 MIL',
        'VAPOUR BARRIER INSTALLED ON WARM SIDE.',
        '',
        'CEILING INSUL TYP',
        'FLAT CEILING: 18" - 24" DP (R50-70) BLOWN INSULATION',
        '6 mil CGSB POLY VB',
        '',
        'EXT WALL INSUL TYP',
        'AIR BARRIER (HOUSE WRAP)',
        'R20 BATT INSULATION',
        '6 MIL CGSB POLYETHYLENE VB',
        '',
        'BASEMENT WALL INSUL AT FOUNDATION TYP',
        '5.25" RIGID INSULATION',
        '',
        'FLOOR RIM JOISTS TYP',
        '2 x R20 BATT',
        '',
        'GARAGE CEILING / 2ND FLOOR OVER GARAGE',
        'SPRAY FOAM 3"',
      ].join('\n'),
    },
    {
      // The source numbered this 7-D as well, alongside INSULATION. Renumbered
      // so a note can be cited unambiguously; nothing else about it changed.
      id: '7-E', div: 7, title: 'INSULATION – ENERGY CODE COMPLIANCE', verify: true,
      body: [
        'CLIMATE ZONE: ______   (VERIFY FOR THE PROJECT LOCATION)',
        '',
        '* HRV REQUIRED',
      ].join('\n'),
    },
    {
      id: '7-F', div: 7, title: 'EXTERIOR CLADDING — STUCCO (IF USED)',
      body: [
        '- APPLY A LAYER OF STUCCO WRAP LAPPED MIN 6" AND TAPED.',
        '- APPLY A LAYER OF STANDARD AIR BARRIER HOUSE WRAP.',
        '- APPLY SELF FURRING METAL LATH OR ADHESIVE BASE COAT. (KEEP DRY & ALLOW TO',
        'CURE FOR 1 MONTH PRIOR TO FINISH STUCCO APPLICATION.)',
        '- APPLY 3/8" - 3/4" PORTLAND CEMENT OR SYNTHETIC STUCCO SYSTEM.',
        '',
        '- PFM SOFFITS, FASCIA, GUTTERS & DOWNSPOUTS.',
        "- INSTALL NON-VENTED PFM SOFFITS ON ALL EAVES THAT ARE WITHIN 4' FROM",
        'PROPERTY LINE; INSTALL VENTED PFM SOFFITS ON ALL OTHER EAVES.',
      ].join('\n'),
    },

    // ---------------------------------------------------------------- 8
    {
      id: '8-A', div: 8, title: 'DOORS & FINISH HARDWARE',
      body: [
        '- ALL EXTERIOR DOORS TO HAVE DEADBOLTS & WEATHERSTRIPPING.',
        '- SECURE EXTERIOR DOORS LEADING TO DECK UNTIL DECK & GUARDRAIL IS FULLY',
        'CONSTRUCTED.',
        '- DOORS FROM GARAGE TO HOUSE W/ SELF CLOSURE DEVICE & WEATHERSTRIPPING.',
      ].join('\n'),
    },
    {
      id: '8-B', div: 8, title: 'WINDOWS', verify: true,
      body: [
        '- ALL BEDROOMS MUST HAVE AN OPENABLE WINDOW OR EXTERIOR DOOR WITH AN',
        'UNOBSTRUCTED OPENING OF NOT LESS THAN 3.77 SQFT (0.35 SQM), WITH NO',
        'DIMENSION LESS THAN 15" (380). NBC 9.9.10.1.',
        '- AWNING OPENINGS DO NOT MEET THE ESCAPE EGRESS REQ.',
        '- REMOVABLE SCREENS INSTALLED ON ALL OPENING WINDOWS.',
        '',
        '- THE SUPPLIER SHALL CONFIRM THE CLEAR OPENING OF THE SPECIFIED UNIT MEETS',
        'THIS REQUIREMENT. THE CLEAR OPENING IS THE HOLE A PERSON PASSES THROUGH,',
        'NOT THE UNIT SIZE AND NOT THE ROUGH OPENING.',
        '- THE FRAMER SHALL VERIFY ALL ROUGH OPENING SIZES AGAINST A CONFIRMED WINDOW',
        'AND DOOR ORDER PRIOR TO FRAMING.',
      ].join('\n'),
      // Kept as a flagged correction rather than a silent one: the source read
      // "A MAX TOTAL UNOBSTRUCTED OPENING OF NO MORE THAN 3.75 SQFT (0.35SQM)".
      // NBC 9.9.10.1. sets 0.35 m² as a MINIMUM, so the note as written asked
      // for the opposite of the code. Written here as a minimum.
      note: 'Reads MINIMUM 0.35 m²; the source sheet said maximum. NBC 9.9.10.1. sets it as a minimum.',
    },

    // ---------------------------------------------------------------- 9
    {
      id: '9-A', div: 9, title: 'INTERIOR FINISH',
      body: [
        '- PAINT, FLOORING FINISH & MILLWORK SELECTED BY OWNER.',
        '- INT GUARDRAILS AT 3\'-6" (1070) HT, INT HANDRAILS AT 3\'-0" (900) HT.',
        '- ALL RAILS MUST HAVE NO MORE THAN 4" (100) SPACE BETWEEN VERT MEMBERS.',
        '- PROVIDE SAFETY GLASS AROUND TUB & SHOWER ENCLOSURES, ENTRANCE SIDELIGHTS',
        'AND GUARDS WHERE APPLICABLE.',
        '- BATHROOM MIRROR & TOWEL BAR INSTALLED IN ALL BATHROOMS.',
        '- WINDOW DRESSINGS SELECTED BY OWNER.',
      ].join('\n'),
    },
    {
      id: '9-B', div: 9, title: 'EXTERIOR FINISH',
      body: [
        '- ACRYLIC PARGING FROM 6" BELOW FINISHED GRADE TO TOP OF FOUNDATION WALL.',
        '- EXT WALL FINISH STYLE SELECTED BY OWNER.',
      ].join('\n'),
    },

    // ---------------------------------------------------------------- 10-14
    {
      id: '10-A', div: 10, title: 'FIREPLACE',
      body: 'OPTIONAL FIREPLACE SELECTED BY OWNER – NATURAL GAS FIREPLACE W/ 3/4 HR FRR.',
    },
    { id: '11-A', div: 11, title: 'GARAGE', body: 'O/H DOOR OPENER.' },
    { id: '11-B', div: 11, title: 'UTILITY', body: 'WASHER & DRYER SELECTED BY OWNER.' },
    { id: '11-C', div: 11, title: 'KITCHEN', body: 'FRIDGE, STOVE & DISHWASHER SELECTED BY OWNER.' },
    { id: '12-A', div: 12, title: 'BUILT-IN CABINETS', body: '- CABINETS SELECTED BY OWNER.' },
    {
      id: '13-A', div: 13, title: 'FIRE & HEALTH PROTECTION',
      body: [
        '- SMOKE ALARMS INSTALLED IN NOTED LOCATIONS BY PERMANENT CONNECTION TO AN',
        'ELECTRICAL CIRCUIT AND SHALL HAVE NO DISCONNECT SWITCH BETWEEN THE',
        'OVERCURRENT DEVICE AND THE SMOKE ALARM.',
        '- CARBON MONOXIDE DETECTORS INSTALLED AT LOCATION OF SMOKE ALARMS.',
        '- EFFECTIVE FUME BARRIER & 1/2" FG INSTALLED ON GARAGE SIDE OF SHARED EXT',
        'HOUSE WALL, CONT W/ MUD & TAPED JOINTS.',
        '- DOOR FROM HOUSE TO GARAGE SHALL HAVE WEATHER-STRIPPING AND AUTOMATIC DOOR',
        'CLOSER.',
        '- RADON TRAP INSTALLED IN FOUNDATION DRAINAGE / SUMP SYSTEM.',
      ].join('\n'),
    },
    {
      id: '14-A', div: 14, title: 'PLUMBING',
      body: '- ROUGH-IN PLUMBING FOR BASEMENT BATHROOM. VERIFY LOCATION WITH OWNER.',
    },

    // ---------------------------------------------------------------- 15
    {
      id: '15-A', div: 15, title: 'HEATING',
      body: [
        '- FURNACE TYPE & HWH TYPE SELECTED BY OWNER.',
        'OPTIONAL - INSTALL IN-FLOOR RADIANT HEAT PIPING IN BASEMENT SLAB – VERIFY',
        'FLOOR AREAS WITH OWNER PRIOR TO CONSTRUCTION.',
      ].join('\n'),
    },
    {
      id: '15-B', div: 15, title: 'VENTILATION',
      body: [
        '- HVAC DESIGNED BY SUPPLIER / INSTALLER.',
        '- EXHAUST FAN IN EA WC AND ABOVE THE STOVE. DUCTING TO OUTSIDE OR TO HEAT',
        'RECOVERY UNIT.',
      ].join('\n'),
    },
    // The source ran 15-A, 15-B, then 15-3 and 15-4. Lettered to match the rest.
    {
      id: '15-C', div: 15, title: 'AIR CONDITIONING',
      body: '- CENTRAL AIR CONDITIONING – VERIFY INSTALLATION WITH OWNER.',
    },
    {
      id: '15-D', div: 15, title: 'CENTRAL VACUUM',
      body: '- CENTRAL VAC – VERIFY INSTALLATION WITH OWNER.',
    },

    // ---------------------------------------------------------------- 16
    {
      id: '16-A', div: 16, title: 'ELECTRICIAN',
      body: [
        'LICENSED ELECTRICIAN TO VERIFY ELECTRICAL PLAN WITH OWNER PRIOR TO',
        'INSTALLATION.',
      ].join('\n'),
    },
    {
      // Drawn, not typed: the ids are the electric-symbol painter's own kinds,
      // so the legend on the spec page and the symbols on the electrical plan
      // can never drift apart. A symbol the painter cannot draw yet prints as
      // an empty cell rather than a stand-in, because a legend that shows the
      // wrong mark is worse than one that shows none.
      id: '16-B', div: 16, title: 'ELECTRICAL SYMBOLS', kind: 'legend',
      body: [
        'tel-cable-lan | TEL/CABLE/LAN JACK',
        'tel | TEL JACK',
        'cable | CABLE JACK',
        'lan | LAN JACK',
        'outlet-220 | 220V AC POWER OUTLET',
        'outlet-110 | 110V AC POWER OUTLET',
        'switch | SWITCH',
        'vent-fan-light | VENT FAN / LIGHT',
        'vent-fan | VENT FAN',
        'undercabinet | LED UNDERCABINET LIGHT',
        'recessed | RECESSED LIGHT',
        'wall-light | WALL MOUNTED LIGHT',
        'ceiling-light | CEILING MOUNTED LIGHT',
        'switch-wire | SWITCH / LIGHT WIRE',
      ].join('\n'),
    },
  ];

  const divisionTitle = no => (DIVISIONS.find(d => d.no === no) || {}).title || '';

  // A frozen copy: the master is the office's, and a page that edits a project
  // must never write through to it.
  const sections = () => SECTIONS.map(section => ({
    id: section.id,
    div: section.div,
    divTitle: divisionTitle(section.div),
    title: section.title,
    kind: section.kind || 'notes',
    body: section.body,
    verify: section.verify === true,
    note: section.note || null,
  }));

  // Rows of a 'terms', 'table' or 'legend' body. A row splits on '|' or on an
  // em dash, so the abbreviations read as ADJ — ADJUSTABLE in the source and
  // still arrive here as two cells. A line with neither is a single cell — a
  // heading or a blank — and the page sets it across the row.
  const rows = body => String(body || '').split('\n').map(line => {
    const trimmed = line.trim();
    if (!trimmed) return [''];
    const cells = (trimmed.includes('|') ? trimmed.split('|') : trimmed.split(' — '))
      .map(cell => cell.trim());
    return cells.length > 1 ? cells : [trimmed];
  });

  window.DraftSpecMaster = { DIVISIONS, sections, divisionTitle, rows };
})();
}
