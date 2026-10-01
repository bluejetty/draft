// SHELL BARS -- the markup every page of the shop wears.
//
// THE OTHER HALF OF shell-bars.css. That file made Movie's guarantee true of
// the STYLING -- "it will guarantee to be same style if i change one all will
// change right" -- and this one makes it true of the MARKUP. Sharing one
// without the other leaves a page free to grow a different bar that happens
// to be painted the same.
//
// WHO WEARS THEM: MODEL, PROJECT, Construction Layout, SPECS, and REAL ESTATE
// PLANS and ESTIMATES when they exist. Two of those are not built yet and are
// designed for anyway, because the cost of a new page taking the shell has to
// stay at two tags and a mount call.
//
// MOUNTED IN PLACE, SYNCHRONOUSLY, and that is the whole trick. Each call
// writes its markup where the calling <script> stands, so the DOM is built at
// the same point in parse order the inline markup occupied. Nothing races,
// nothing flashes, and the 243 spec files that reach for these 61 data-*
// hooks find them exactly when they find them today. A module that mounted on
// DOMContentLoaded would have been a behaviour change wearing a refactor's
// clothes.
//
// WHAT THE PAGE SUPPLIES AND WHAT THIS OWNS. The bar owns the FURNITURE; the
// page owns what the furniture DOES. The seam showed up in three places at
// once and it is the same seam each time:
//
//   the BONE      one button, four verbs. MODEL builds the house from the
//                 outline, PROJECT builds the chosen type, Construction
//                 Layout and REAL ESTATE print a plan or make a PDF, and
//                 ESTIMATES may not want one at all ("everything should
//                 update automatically there"). So `bone: false` mounts the
//                 bar without it, and the press is the page's.
//   the SKIN      applySkin() on MODEL does five things and THREE of them are
//                 MODEL's -- paintBonePress, paintSignBoard, paint. The
//                 switch, the aria-pressed marking and the localStorage write
//                 are the bar's; what to repaint afterwards is the page's.
//   the INSTRUMENTS  mounted only by pages that draw. Movie: Construction
//                 Layout wants them, "we may need to draw sometimes";
//                 PROJECT and SPECS do not.
//
// THE PAGE ROW IS DATA, NOT MARKUP, and that is a change from what it
// replaced. It was six hand-written entries in MODEL.html, which meant the
// map of the job lived on one page and every other page would have needed its
// own copy with a different chip marked "you are here". PAGES below is that
// list once. Adding REAL ESTATE PLANS is a line of data and every bar in the
// shop gains it.

if (!window.DraftShellBars) {
(() => {

  // THE MAP OF THE JOB, in Movie's order (15 Sep), and it already names all
  // six pages he has asked for. Two are DOWN rather than absent, which is the
  // row's oldest rule: "the row is the map of the job, and a map with two
  // towns missing teaches the drafter a shape that is wrong." Each says what
  // it will be when it is built.
  //
  // `row` is which end of the bottom bar it sits at. The real-estate pages stay
  // LEFT with MODEL (Movie, 15 Sep) because they are drawings OF the model
  // rather than a sheet off it -- the marketing plan, not a set the site
  // builds from. Which held when there was one of them and holds for both: on
  // 27 Sep it split into EXT. FINISH, where the house is clad, and REAL ESTATE
  // PLAN, where the plans are laid out for a listing.
  const PAGES = Object.freeze([
    Object.freeze({ id: 'project', row: 'page', label: 'PROJECT',
      href: './PROJECT.html', extra: ' data-project-corner-bl',
      title: 'The project: every drawing in this job',
      here: 'The project \u2014 you are here' }),
    Object.freeze({ id: 'model', row: 'page', label: 'MODEL',
      href: './MODEL.html',
      title: 'The model: where the house is drawn',
      here: 'The model \u2014 you are here' }),
    // BUILT, 27 Sep, so the chip is a door rather than a grey seat. It was
    // DOWN from the day this table was written -- the row's oldest rule is
    // that it is the map of the job and a map with two towns missing teaches
    // a shape that is wrong -- and this is the other half of that promise
    // being kept: the page arrived and the row cost one line.
    //
    // AND IT BECAME TWO TOWNS THE SAME DAY. The page that arrived carried the
    // elevations, the finishes on them, and a tab holding a blank real-estate
    // sheet. Movie, looking at it: *"i should change the name of this from
    // REAL ESTATE PLAN - make another area on the bottom left menes between
    // 'MODEL' right here and 'REAL ESTATE PLAN' insert tab -> 'EXT. FINISH'
    // and make this area that name"*, then *"the REAL ESTATE PLAN area will be
    // similar to the CONSTRUCTION layout but we will present the drawings in a
    // different way"*.
    //
    // WHICH IS TWO JOBS AND NOT ONE. Cladding a house is a thing you DO to the
    // model; a real-estate plan is a SHEET the model prints onto, and its
    // neighbour in that trade is Construction Layout rather than the elevation
    // workspace. So the chip split in two and the order is his: EXT. FINISH
    // between MODEL and REAL ESTATE PLAN.
    Object.freeze({ id: 'ext-finish', row: 'page', label: 'EXT. FINISH',
      href: './EXTFINISH.html',
      title: 'EXT. FINISH \u2014 the elevations, and the finishes on them',
      here: 'The exterior finishes \u2014 you are here' }),
    Object.freeze({ id: 'real-estate', row: 'page', label: 'REAL ESTATE PLAN',
      href: './REALESTATEPLAN.html',
      title: 'REAL ESTATE PLAN \u2014 the plans laid out the way a listing shows them',
      here: 'The real estate plan \u2014 you are here' }),
    Object.freeze({ id: 'construction', row: 'sheet', label: 'CONSTRUCTION LAYOUT',
      href: './LAYOUT.html',
      title: 'The construction layout: the sheet that goes to site',
      here: 'The construction layout \u2014 you are here' }),
    Object.freeze({ id: 'specs', row: 'sheet', label: 'SPECIFICATIONS',
      href: './SPECS.html',
      title: 'The specifications for this house',
      here: 'The specifications \u2014 you are here' }),
    Object.freeze({ id: 'estimates', row: 'sheet', label: 'ESTIMATES',
      href: null,
      title: 'ESTIMATES \u2014 quantities and costs off this model, not built yet' }),
  ]);

  // A chip is a LINK to a page you can go to, a SPAN for the one you are on,
  // and a DISABLED BUTTON for one that does not exist yet. Three elements
  // rather than three classes, because that is what each thing IS -- and it
  // is the shape the row already had.
  const chip = (entry, current) => {
    const attrs = `data-page="${entry.id}"${entry.extra || ''}`;
    if (entry.id === current) {
      return `  <span ${attrs} aria-current="page"\n`
        + `    title="${entry.here || entry.title}">${entry.label}</span>`;
    }
    if (!entry.href) {
      return `  <button type="button" ${attrs} disabled\n`
        + `    title="${entry.title}">${entry.label}</button>`;
    }
    return `  <a ${attrs} href="${entry.href}"\n`
      + `    title="${entry.title}">${entry.label}</a>`;
  };
  const rowOf = (which, current) => PAGES.filter(p => p.row === which)
    .map(p => chip(p, current)).join('\n');

  // THE COUNT USED TO STAND HERE, to the left of STATUS READOUT (Movie, 19
  // Sep: "lets put it on lower left (2nd row from bottom to the left of
  // 'STATUS READOUT'"). It went down one row on 25 Sep -- see FOOTLANE -- so
  // this row is the readout tab alone again, which is what it was before the
  // count had anywhere to live.
  const READOUT = `<div id="lower-left" data-lower-left>
  <button id="readout-tab" type="button" data-readout-tab
    aria-expanded="false" aria-controls="readout"
    title="The page's own counts: what is drawn on this level, and what the drawing holds">STATUS READOUT</button>
</div>
<div id="readout" hidden>
  <!-- THE COUNTS GO IN THEIR OWN SPAN so the close button survives them: the
       readout is rewritten by innerHTML on every paint, and a child of the
       panel itself would be wiped by the first repaint after it opened. -->
  <span id="readout-text">loading…</span>
  <button id="readout-close" type="button" data-readout-close
    aria-label="Close the status readout" title="Close">×</button>
</div>`;
  const TOPHEAD = `<div id="strip" data-instrument-strip>
  <!-- THE SETTINGS CORNER, first on the bar: the two profile pages. SETTINGS
       and STANDARDS are PAGES on this side of the shop (SETTINGS.html,
       STANDARDS.html), where MODEL.dc.html opens them as dialogs -- the page
       row already teaches that a place you go is a link, and a modal that
       only links onward would be a door in front of a door. -->
  <div id="settings-corner" data-settings-corner>
    <div id="settings-stack">
      <a data-page="settings" href="./SETTINGS.html"
        title="Keyboard and layer settings">SETTINGS</a>
      <a data-page="standards" href="./STANDARDS.html"
        title="Company standard layers, names and print rules">STANDARDS</a>
    </div>
  </div>
  <!-- UNITS, THE SECOND STACK (Movie, 15 Sep): "put IMPERIAL (and then under a
       second button) METRIC - and shade in the one being used".

       THIS REPLACES A DC RULING RATHER THAN IGNORING IT. MODEL.dc.html
       (:435-442) made units ONE button naming the unit in force because its
       two stacked buttons, at a 44px touch target, OVERLAPPED -- METRIC ate
       every tap aimed at IMPERIAL. The failure was the hit boxes, not the
       stacking: these two are the settings stack's own 9px rows, the shape
       already standing beside them without that fault. What kept the ruling
       honest was a measurement, so what replaces it carries one --
       model-html-shell's "a tap aimed at a stacked button lands on that
       button" sends a tap at each button's own CENTRE COORDINATE and asserts
       the boxes never overlap, which is the exact check the old corner would
       have failed. It measures all three of the bar's stacks, the settings
       rows this argument leans on included.

       THIS CITATION WAS WRONG WHEN THE STACK SHIPPED. It named
       model-html-topbar, which is about house families and holds no hit test
       of any kind, so the ruling was overturned on the strength of a
       measurement nobody had taken. The check named here exists and is
       mutation-gated by proto/units-stack-mutants.js -- a claim of coverage
       is the one kind of comment that can be checked by reading it. -->
  <div id="units-corner" data-units-corner data-switch-home>
    <div class="stack">
      <button type="button" data-units="imperial" aria-pressed="true"
        title="Read this drawing in feet and inches">IMPERIAL</button>
      <button type="button" data-units="metric" aria-pressed="false"
        title="Read this drawing in metres">METRIC</button>
    </div>
  </div>
<!-- THE MODE CORNER (§7b): WHAT THE DRAWING IS. Carried whole out of the foot
     strip -- same buttons, same data-* attributes, same listeners. TOY still
     means cardinal, square and whole-foot and DRAFTING is still one-way; a
     control that changed meaning because it changed corner would be the
     re-scope §7b forbids. -->
<div id="mode-corner" data-mode-corner data-switch-home>
  <!-- HOW THE SHEET IS LOOKED AT, BACK BESIDE THE UNITS. Movie, 17 Sep: "put
       NIGHT DAY up beside IMPERIAL METRIC (and change the style to match the
       IMPERIAL METRIC (UP DOWN not SIDE SIDE), and put the RUFF / ROUGH to the
       left of NIGHT DAY before the last one which will be TOY DRAFTING", then
       "make them the same style as up top style".
    
       SO THE BAR NOW READS AS FOUR STACKED PAIRS: units, finish, mode, board.
       They were sent downstairs on 15 Sep on the argument that a switch is not
       an instrument -- which is still true, and is now answered by the shape
       instead of the distance: four pairs built to one pattern read as one
       family of "which way am I looking at this", and the strip's instruments
       are chips, not stacks. Nothing about what they DO moved; same data-*
       attributes, same listeners, same aria-pressed shading.
    
       THE ORDER IS HIS, LEFT TO RIGHT: IMPERIAL/METRIC (already there), then
       RUFF/ROUGH, then NIGHT/DAY, and TOY/DRAFTING last. -->
  <span class="set stack" data-theme-switch>
    <button type="button" data-theme="ruff" aria-pressed="false">RUFF</button>
    <button type="button" data-theme="rough" aria-pressed="false">ROUGH</button>
  </span>
  <span class="set stack" data-mode-switch>
    <button type="button" data-skin-mode="night" aria-pressed="false">NIGHT</button>
    <button type="button" data-skin-mode="day" aria-pressed="false">DAY</button>
  </span>
  <span class="set stack" data-board-switch>
    <!-- NO title HERE. These two are set from script below, and a static one
         would be overwritten -- which is exactly what happened when this
         markup was given titles first: they read correctly in the file and
         never reached the page. The wording, and the check that holds it to
         the truth, live with the assignment. -->
    <button type="button" data-board="toy" aria-pressed="false">TOY</button>
    <button type="button" data-board="drafting" aria-pressed="false">DRAFTING</button>
  </span>
</div>
<!-- RUFF/ROUGH AND NIGHT/DAY CAME BACK (Movie, 17 Sep) and now stand in the
     mode corner above, stacked like the units and the board. They went down
     on 15 Sep because a switch is not an instrument; that is still true, and
     the strip still carries instruments only -- what changed is that the
     argument is now made by the SHAPE. Four stacked pairs in one corner, all
     built to the unit rows, read as one family; a chip on the strip reads as
     a tool. Distance was the cruder way to say the same thing, and it cost
     the two switches their kinship with TOY/DRAFTING, which is the control
     they are most like. -->
  <div class="grow"></div>`;
  const INSTRUMENTS = `  <div id="strip-center" data-strip-center>
   <span class="strip-half strip-half-left">
    <span class="chip dormant" data-mode-compass title="COMPASS — not built on this page yet">
      <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true">
        <path d="M8 2 L3.5 13.5 M8 2 L12.5 13.5"></path>
        <circle cx="8" cy="2.5" r="1.2" stroke-width="0.9"></circle>
        <path d="M4.5 11 A7 7 0 0 0 11.5 11" stroke-width="0.9"></path>
      </svg>
    </span>
    <span class="chip dormant" data-mode-triangle title="TRIANGLE set square — not built on this page yet">
      <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true">
        <path d="M2.5 13.5 L13.5 13.5 L2.5 2.5 Z"></path>
        <path d="M5 11.5 L8.5 11.5 L5 8 Z" stroke-width="0.9"></path>
      </svg>
    </span>
    <!-- THE ICON IS UNTOUCHED. Movie, 5 Sep, looking at this exact drawing:
         "the icon looks nice keep that for sure". A curved ferrule over four
         bristles, the same two paths it has had since it was dimmed in. Only
         the colour moves between empty and loaded, and the load's name sits
         beside it -- so the brush always says what it is about to do before
         the drafter does it, which is the whole defence against the usual
         armed-tool surprise. -->
    <button type="button" id="strip-brush" class="chip" data-mode-brush
      title="DRAFTING BRUSH — press a thing to pick its properties up, then press another of the same kind to give them to it">
      <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true">
        <path d="M2.5 8.5 Q8 5 13.5 8.5 L13.5 10.5 Q8 7 2.5 10.5 Z"></path>
        <path d="M4 10.7 V12.6 M6.5 9.6 V11.8 M9.5 9.6 V11.8 M12 10.7 V12.6" stroke-width="0.9"></path>
      </svg>
      <span id="strip-brush-load" class="num" data-brush-load></span>
    </button>

    <button type="button" id="strip-ruler" class="chip" data-mode-ruler
      title="RULER — measure between two points without drawing anything">
      <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true">
        <rect x="1.5" y="6" width="13" height="5"></rect>
        <path d="M4.5 6 V8.2 M7.5 6 V8.2 M10.5 6 V8.2 M13 6 V8.2" stroke-width="0.9"></path>
      </svg>
    </button>

    <span id="strip-len" class="num" data-model-len></span>
    <span id="strip-ang" class="num" data-model-ang></span>

    <span id="strip-length-box">
      <span>LENGTH</span>
      <input id="frozen-length" data-frozen-length type="text" disabled
        placeholder="—" aria-label="Frozen length" autocomplete="off" />
    </span>
   </span>

    <!-- THE CENTRE LINE (Movie, 16 Sep): "a dividing line between the length
         and angle box and center that line perfectly (centered on the bone
         below)". It is the sheet's spine -- the two halves of the bar are
         equal grid columns, so the rule stands on the window's centre line
         and the bone stands on the same one. Decoration, not a control, so
         it carries no label and no press. -->
    <span id="strip-divide" aria-hidden="true"></span>

   <span class="strip-half strip-half-right">

    <!-- THE ANGLE BOX IS THE LENGTH BOX'S TWIN, and deliberately so: a
         drafter who can type 12'-6" should be able to type 30° for the same
         reason, and one instrument reading a number the drafter cannot set is
         half a tool. It lives beside the protractor because the protractor is
         where the number is read. -->
    <span id="strip-angle-box">
      <input id="frozen-angle" data-frozen-angle type="text" disabled
        placeholder="—" aria-label="Frozen angle" autocomplete="off" />
      <span>ANGLE</span>
    </span>

    <span class="chip" data-mode-protractor title="PROTRACTOR — reads the angle of the run in hand">
      <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true">
        <path d="M2 12.5 A6 6 0 0 1 14 12.5 Z"></path>
        <path d="M8 12.5 L11.6 8.3" stroke-width="0.9"></path>
        <path d="M4.2 9.9 L5.1 10.8 M8 6.5 V7.9 M11.8 9.9 L10.9 10.8" stroke-width="0.9"></path>
      </svg>
      <span id="strip-protractor-angle" data-protractor-angle>—</span>
    </span>

    <button type="button" id="strip-tsquare" class="chip" data-mode-tsquare
      title="T-SQUARE — holds the wall being drawn square to the sheet">
      <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true">
        <path d="M1 3 H15"></path>
        <path d="M8 3 V15"></path>
        <path d="M8 6.5 H10.5 M8 9.5 H10.5 M8 12.5 H10.5" stroke-width="0.9"></path>
      </svg>
    </button>

    <!-- A SQUARE TILE WITH 1' IN IT. Movie, 20 Sep: "you know that toy 'to
         the foot' thing, we should make a features that can turn that on and
         off. maybe just a square tile that has a 1' in it for the dashboard
         light".

         THE SWITCH WAS ALREADY HERE and he did not know it, which is the
         whole report. footOn, its store and the guard that keeps it off TOY
         have all worked since the FOOT LIGHT order landed -- what nobody
         could read was the GLYPH, a scale triangle that says "mountain" to
         anyone who has not been told. A control whose picture does not name
         it is a control that is not there.

         DRAWN IN PATHS, not <text>, because every other chip in this strip is
         paths and an 8px glyph rendered as type goes soft at the sizes the
         strip actually runs at. The square is the tile, the upright with its
         flag is the 1, and the tick is the foot mark. -->
    <button type="button" id="strip-scale" class="chip" data-mode-scale
      title="FOOT — every point and every drag lands on the whole foot">
      <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true">
        <rect x="1.5" y="1.5" width="13" height="13" rx="1"></rect>
        <path d="M6.6 4.8 V11.2" stroke-width="1.2"></path>
        <path d="M5.1 6.1 L6.6 4.8" stroke-width="1.2"></path>
        <path d="M9.7 4.8 L10.6 7.1" stroke-width="1.1"></path>
      </svg>
    </button>
    <!-- ── TURN THE HOUSE A QUARTER ──────────────────────────────────────
         Movie, 27 Sep: "can we add a HOUSE ROTATE function (maybe in
         instruments panel top on the right side. make a little monopoly style
         house with a rotation around around the outside of it. Make it rotate
         the actual model space so the E1 E2 etc all rotate. make the rotations
         90degrees don't allow in between", and on why: "this will allow them
         to rotate a house 90 degress depending on length of house so it fits
         on the layout pages nicer".

         ONE BUTTON, NOT TWO. Four presses is back where you started, so a
         second button turning the other way saves at most one press and costs
         a permanent second control on a strip that is already full. If he
         wants the other way round it is one line.

         DRAWN IN PATHS like every other chip here: a gable and a box, which
         is the monopoly house, and three quarters of a ring with a head on it
         going clockwise -- the way the press turns. An arrow that went the
         other way would be a control lying about itself. -->
    <button type="button" id="strip-rotate" class="chip" data-mode-rotate
      title="TURN THE HOUSE — a quarter turn clockwise; the elevations turn with it and E1 stays the front">
      <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true">
        <path d="M4.6 9.2 L8 6.3 L11.4 9.2"></path>
        <path d="M5.8 9.2 V12.3 H10.2 V9.2"></path>
        <path d="M2.7 7.6 A6.3 6.3 0 0 1 13.3 7.6" stroke-width="1"></path>
        <path d="M11.9 6.2 L13.5 7.8 L11.9 9" stroke-width="1"></path>
      </svg>
    </button>
    <span class="chip dormant" data-mode-shield title="ERASING SHIELD — not built on this page yet">
      <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true">
        <rect x="2.5" y="3.5" width="11" height="9" rx="1"></rect>
        <circle cx="6" cy="6.5" r="0.9" stroke-width="0.9"></circle>
        <path d="M9 9.5 H12" stroke-width="0.9"></path>
        <path d="M9.5 6 L11.5 7.5" stroke-width="0.9"></path>
      </svg>
    </span>
   </span>
  </div>`;
  const TOPTAIL = `
  <div class="grow"></div>
<!-- THE FILE ROW (§1): WHAT THE FILE IS. NEW · OPEN · SAVE · SAVE AS · the
     extension, after MODEL.dc.html:573-590. SAVE carries the status word
     itself -- see the stylesheet note. The picker chooses what the GENERATED
     NAME ends in and nothing else: every one of the four is plain JSON, which
     is why OPEN takes all four without asking which it was given. -->
<div id="file-row" data-file-row>
  <button id="file-new" type="button" data-file-new title="Start an empty drawing">NEW</button>
  <button id="file-open" type="button" data-file-open title="Open a drawing file">OPEN</button>
  <input id="file-input" type="file" data-file-input hidden
    accept=".json,.draft,.model,.plan,application/json" />
  <!-- SAVE MOVED OUT OF THE TOP-LEFT BAR, not out of the shell: the right tab
       once landed on top of this button and every spec that pressed SAVE
       timed out, so where it sits is measured, not chosen. The pairwise
       chrome check is what keeps it that way. -->
  <button id="save" type="button" data-model-save data-save-status disabled>SAVE</button>
  <button id="file-save-as" type="button" data-file-save-as disabled
    title="Save, and download a copy under a name you pick">SAVE AS</button>
  <select id="file-ext" data-file-ext aria-label="File extension for the saved copy">
    <option value="draft" selected>.draft</option>
    <option value="json">.json</option>
    <option value="model">.model</option>
    <option value="plan">.plan</option>
  </select>
</div>
<!-- PRINTSCREEN, and it is NOT a print of the drawing. There is no print path
     on this page on purpose: a sheet's scale and title block live on the
     layout, and a second renderer here would be a second thing the city could
     be handed. What this makes is a PRESENTATION -- three screen grabs for a
     client to look at -- and every page says NOT TO SCALE above the logo so it
     can never be walked into a builder's office as a drawing.

     IN THE TOP-RIGHT CORNER, RIGHT OF THE FILE ROW (Movie, 16 Sep: "move the
     PRINTSCREEN BUTTON fully to the RIGHT in upper corner to RIGHT of the save
     stuff"). It started left of the instruments, which put a button that makes
     PAPER in among the ones that measure -- and paper is what the file row is
     about. So it ends the file row rather than beginning the instruments. -->
  <button type="button" id="printscreen" data-printscreen
    title="Three pages to show a client — this view, the whole plan, and the views rail. Not to scale.">PRINTSCREEN</button>
</div>`;
  const BOTHEAD = `<div id="house-strip" data-house-strip>
<!-- THE PAGE ROW (§7b), now a TENANT OF THE BOTTOM BAR rather than a bar of
     its own (Movie, 15 Sep: "move the PROJECT, MODEL, LAYOUT, SPECS etc down
     to the darker bar"). The pages in the order Movie listed them -- seven
     now, since EXT. FINISH and REAL ESTATE PLAN split on 27 Sep. SIX EXIST.
     ESTIMATES does not, and it is DOWN rather than absent for the same reason
     a dormant chip is on the strip: the row is the map of the job, and a map
     with a town missing teaches the drafter a shape that is wrong. It says
     what it will be when it is built.

     INSIDE the strip, not floating above it, because two fixed bars stacked
     a few pixels apart is the arrangement that put the build bar on SAVE. A
     flex child cannot leave its parent. -->`;
  const BOTMIDDLE = `  <div class="grow"></div>
  <!-- THE MIDDLE PAIR (Movie, 15 Sep): "2 buttons, the DRIVE-THRU MENU, and
       the BONE". Exactly two, because the sign rises over this spot and
       covers whatever is here -- anything else standing between them would
       go under the board with them and be unreachable mid-order. The build
       families went up onto the board itself; they ARE the menu. -->
  <div id="dt-bar" data-drivethru-bar>
    <!-- ONE PRESS IN THE MIDDLE (Movie, 16 Sep): "in bottom center lets
         remove the two house buttons and keep the BONE button just go to the
         drivethru". The drive-thru press and the OUTLINE press were two ways
         to the same board, and the bone is the third -- so the bone is the
         one that stays, and a drafter who wants to draw the outline himself
         reaches for the OUTLINE command rather than a second button under the
         board. It stands on the sheet's centre line, the same axis the
         instrument rule above it stands on. -->
    <button id="bone" type="button" data-bone-press aria-controls="drivethru"
      aria-expanded="false"
      title="Gruff's drive-thru: pick a house type, then build it"><img
        data-bone-art
        src="./assets/bone-red.png"
        alt="" /><span id="bone-balance" data-bone-balance
        aria-hidden="true"></span><span class="said">BONE</span></button>
    <!-- ONE DELETE FOR EVERYTHING SELECTED (§7a), where there were two verbs
         for one of the types. It rides with the pair rather than with the
         places, because it is a verb. -->
    <!-- UNDO, ON SCREEN (audit C4). Ctrl+Z was the only way back, and an
         iPad has no Ctrl key. A verb, so it rides with DELETE. -->
    <button id="undo" type="button" data-undo hidden
      title="Undo the last change (Ctrl+Z)">UNDO</button>
    <button id="delete" type="button" data-delete hidden
      title="Delete what is selected">DELETE</button>
  <!-- COPY AND PASTE ACROSS WORKSPACES. Movie, 14 Sep: "copy and paste stuff
       in there that won't show on the plan (to save for later / reference)".
       What is held survives a change of level or shelf -- that outliving is
       the one genuinely new thing in the boneyard order, since DC's own copy
       is a single gesture inside one workspace.

       BESIDE DELETE, and they were NOT when this branch rebased. Resolving the
       MODEL.html conflict by hand put them after the drive-thru sign's frame
       but still INSIDE #drivethru -- so they inherited a shut modal's
       \`visibility:hidden\` and sat at y=1303, off the bottom of the sheet.
       Their \`hidden\` PROPERTY was false the whole time, which is why nothing
       reading the property noticed; model-boneyard caught it because it asks
       for real visibility, and it is the only reason this did not ship.

       HIDDEN WHEN THEY HAVE NOTHING TO DO, like DELETE beside them: a verb
       that looks live and does nothing is worse than a gap. -->
  <button id="copy" type="button" data-copy hidden
    title="Copy what is selected — paste it on any level or shelf">COPY</button>
  <button id="paste" type="button" data-paste hidden
    title="Paste the copy here, on whatever level or shelf is showing">PASTE</button>
  </div>
  <div class="grow"></div>`;
  // THE LOWEST ROW (Movie, 25 Sep): "move the '# VISITS' and the DATE/TIME
  // down below PROJECT / MODEL / REAL ESTATE / BONE / CONSTRUCTION / SPECTS /
  // etc. on the lowest row (where it will be covered with http:/addressess
  // (won't matter if these 2 items are covered from time to time".
  //
  // THE ROW HE IS ASKING FOR ALREADY EXISTED AS EMPTY SPACE. --browser-lane
  // is the 24px hem at the foot of this bar, held clear so a browser's link
  // preview lands on the bar's own panel colour instead of on a nav chip --
  // and with nothing in it the bar reads as one row of chips with a band of
  // dead paint under it. His two quiet readings are exactly what a lane like
  // that is for: a count and a clock are the only things on the page a
  // drafter can afford to have covered for as long as his pointer sits on a
  // link, which is the licence the parenthesis gives.
  //
  // ABSOLUTE, BECAUSE THE LANE IS PADDING. #house-strip is a flex row and the
  // lane is its padding-bottom, so a flex child cannot reach it; `bottom:0`
  // on an absolutely positioned child resolves against the PADDING box, which
  // puts this exactly on the lane. #dt-bar's comment in shell-bars.css
  // records the same fact from the other side -- it is the reason that one
  // says `bottom:var(--browser-lane)` rather than `bottom:0`.
  //
  // TWO NAMED SLOTS AND NO PAGE NAMES. The count's home moved here out of
  // #lower-left, so every page carrying this bar gets it in the lane without
  // the module learning which page it is on; the note beside it is for
  // whatever a page has to say quietly at the foot, and MODEL fills it with
  // the clock. A page that wants the count somewhere else still gets its way,
  // because traffic-counter.js takes the FIRST [data-visit-counter-home] in
  // the document and a page's own markup is parsed before it calls this --
  // which is how Construction Layout keeps the count on its own strip.
  const FOOTLANE = `  <div id="foot-lane" data-foot-lane>
    <span data-visit-counter-home></span>
    <span data-foot-note></span>
  </div>`;
  const BOTTAIL = FOOTLANE + `
</div>`;

  // ── THE CLOCK IS THE BAR'S, NOT THE DRAWING PAGE'S ────────────────
  //
  // Movie, 20 Sep, asking for it: *"can you put in there the current time and
  // date of where the person is (timezonewise)"*. It was written into
  // MODEL.html, which was the only page that had a corner for it then. On
  // 27 Sep, on the new Real Estate page: *"i just noticed the date time doesn't
  // show on the bottom right on this page"*.
  //
  // WHICH IS THE SOCKET-WITHOUT-THE-LAMP FAILURE AGAIN, and this file already
  // carries the note recording the first one: `[data-visit-counter-home]` went
  // into the lane with the CSS to hide it while empty, and MODEL -- the page
  // the whole change was for -- never loaded the module that fills it. A slot
  // every page gets and one page fills is a slot that is empty on every page
  // somebody adds later, and nothing goes red for it, because an empty slot is
  // `display:none` by design.
  //
  // SO IT MOUNTS ITSELF FROM HERE. FOOTLANE's own comment argues for exactly
  // this and stopped one tenant short: *"TWO NAMED SLOTS AND NO PAGE NAMES"*,
  // and then named MODEL as the page that fills the note. The clock is the
  // same on every page carrying this bar, so it belongs beside the skin switch
  // in the list of things that are the BAR'S and not the page's.
  //
  // A PAGE CAN STILL HAVE THE SLOT FOR SOMETHING ELSE: this fills
  // [data-foot-note] only if nothing is in it, so a page that writes its own
  // quiet reading at the foot keeps it.
  //
  // TO THE MINUTE, NOT THE SECOND -- drawing-format.js ruled on this for the
  // save name, and a seconds field in the corner of a page somebody draws on
  // all day is motion where the drawing should be the only thing moving.
  const mountClock = () => {
    const slot = document.querySelector('[data-foot-note]');
    if (!slot || slot.firstChild) return;
    const el = document.createElement('div');
    el.id = 'clock';
    el.setAttribute('data-local-clock', '');
    slot.appendChild(el);

    let day, clock;
    try {
      day = new Intl.DateTimeFormat(undefined,
        { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
      clock = new Intl.DateTimeFormat(undefined,
        { hour: 'numeric', minute: '2-digit', timeZoneName: 'short' });
    } catch (error) {
      // FAIL SILENT, the visit counter's bargain at the other end of the lane.
      // A browser that cannot format a date leaves the slot empty, `:empty`
      // takes it out of the row, and the page is otherwise whole.
      return;
    }

    const write = () => {
      const now = new Date();
      el.textContent = day.format(now) + ' \u00b7 ' + clock.format(now);
    };
    // THE TICK IS AIMED AT THE MINUTE, not set to 60 seconds from now. A timer
    // counting sixty from whenever it last ran drifts later every hour and
    // eventually turns over half a minute after the minute does; this re-reads
    // the clock every tick, so it also writes the right time on the first tick
    // after a laptop wakes from lunch rather than counting on from its doze.
    // 250ms INSIDE the new minute rather than on its edge: a timer firing a
    // hair early would rewrite the minute that is ending and show it twice.
    const tick = () => {
      write();
      setTimeout(tick, 60000 - (Date.now() % 60000) + 250);
    };
    tick();
    // A BACKGROUND TAB'S TIMERS ARE THROTTLED, so the first thing a returning
    // drafter would read is however stale the throttle left it.
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) write();
    });
  };
  const FILEGUARD = `<div id="file-guard" data-file-guard hidden>
  <div class="promote-card">
    <p data-file-guard-text>This drawing has unsaved edits.</p>
    <div class="promote-row">
      <button type="button" data-guard-save>Save first</button>
      <button type="button" data-guard-discard>Discard</button>
      <button type="button" data-guard-cancel>Cancel</button>
    </div>
  </div>
</div>`;
  const SAVEAS = `<div id="save-as" data-save-as hidden>
  <div class="promote-card">
    <p>Save a copy as</p>
    <input id="save-as-name" data-save-as-name type="text" spellcheck="false"
      autocomplete="off" aria-label="File name" />
    <div class="promote-row">
      <button type="button" data-save-as-go>Save</button>
      <button type="button" data-save-as-cancel>Cancel</button>
    </div>
  </div>
</div>`;

  // WHERE THE MARKUP LANDS. document.currentScript inside these functions is
  // the INLINE script that called them -- the module's own tag finished
  // executing long before -- so `beforebegin` puts the bar exactly where the
  // page asked for it, mid-parse.
  const put = markup => {
    const at = document.currentScript;
    if (!at) throw new Error('DraftShellBars: mount from an inline <script>, '
      + 'not from a deferred or async one -- the bar has to land where it is '
      + 'called, mid-parse, or the page it lands in is not the page the specs '
      + 'measured.');
    at.insertAdjacentHTML('beforebegin', markup);
  };

  // ── THE VERBS A PAGE DOES NOT HANDLE, SAID OUT LOUD ───────────────────
  //
  // THE SEAM AT THE TOP OF THIS FILE HAD ONE SIDE MISSING. "The bar owns the
  // FURNITURE; the page owns what the furniture DOES" is true, and the file
  // row, PRINTSCREEN, the units pair, TOY/DRAFTING and the instrument chips
  // are all furniture -- so six pages mount them and ONE page does anything
  // with most of them. On the other five they looked exactly as live as they
  // do on MODEL: full ink, a hover border, a pointer cursor, and nothing at
  // the end of the press.
  //
  // Movie, 28 Sep, on what the fix is: *"a page that doesn't handle a button
  // shows it disabled, with a note saying why, instead of looking live and
  // doing nothing."*
  //
  // WHICH TWO PAGES HAD ALREADY WORKED OUT FOR THEMSELVES, and that is the
  // reason this belongs here rather than on a page. PROJECT greyed four file
  // buttons and Construction Layout greyed six plus the units and the board,
  // each with its own copy of the loop, its own wording, and its own idea of
  // which controls counted -- and between them they still left METRIC dead on
  // PROJECT, the board dead on four pages, and five instrument chips dead on
  // EXT. FINISH and REAL ESTATE PLAN. Two copies of a rule is how the third
  // page gets none. The good sentences those two wrote are kept below, as the
  // per-page entries; what is gone is the two loops.
  //
  // IT IS A DECLARATION, NOT A DETECTION. There is no way to ask a button
  // whether anybody is listening to it, and a bar that guessed would be wrong
  // in the dangerous direction -- greying a control that works. So a page is
  // taken at its word: IMPLEMENTS names the verbs it wires, everything else on
  // its bar stands down, and a page that names nothing gets a bar of honest
  // grey. THAT IS THE RIGHT DEFAULT FOR A PAGE NOBODY HAS WRITTEN YET, which
  // is the same argument the page row makes for keeping ESTIMATES greyed: a
  // new page arrives saying "not here yet" about everything and turns verbs on
  // as it earns them, rather than arriving with a row of lies.
  //
  // NOT UNIT CONVERSION. Greying METRIC is not a decision about metres; it is
  // the page admitting it has none. The day a page reads in metres it adds
  // 'units' to its line here and the button comes back.
  const VERBS = Object.freeze({
    'file-new': Object.freeze({ sel: '#file-new' }),
    'file-open': Object.freeze({ sel: '#file-open' }),
    save: Object.freeze({ sel: '#save' }),
    'file-save-as': Object.freeze({ sel: '#file-save-as' }),
    'file-ext': Object.freeze({ sel: '#file-ext' }),
    printscreen: Object.freeze({ sel: '#printscreen' }),
    units: Object.freeze({ sel: '#units-corner button[data-units]' }),
    board: Object.freeze({ sel: '[data-mode-corner] button[data-board]' }),

    // THE INSTRUMENTS STAND DOWN BY CLASS AS WELL AS BY PROPERTY, and the
    // reasons are Construction Layout's, which found both of them the hard
    // way. A CHIP IS NOT ALWAYS A BUTTON -- brush, ruler, T-square, scale and
    // TURN THE HOUSE are, and compass, triangle and the erasing shield are
    // SPANS, where setting .disabled is silently ignored. So `.dormant` is
    // what every chip gets and the property goes where it means something.
    // AND THREE OF THEM SHIP DORMANT ALREADY, with "not built on this page
    // yet" in the markup above: their titles say something truer than this
    // could, so they keep them.
    instruments: Object.freeze({
      sel: '#strip-center .chip',
      down: (el, why) => {
        const already = el.classList.contains('dormant');
        el.classList.add('dormant');
        if ('disabled' in el) el.disabled = true;
        if (!already) el.title = why;
      },
    }),
  });

  // WHAT EACH PAGE WIRES, and every entry here is a line somebody can check
  // against the page: MODEL's file row at its own newDrawing/openDrawing/
  // openSaveAs, PROJECT's SAVE at its save('Project saved.'), EXT. FINISH's
  // NEW at the `?new=1` hand-off it makes to MODEL. A page missing from this
  // table gets everything greyed, which is the right answer for one that has
  // not said otherwise.
  const IMPLEMENTS = Object.freeze({
    model: Object.freeze(['file-new', 'file-open', 'save', 'file-save-as',
      'file-ext', 'printscreen', 'units', 'board', 'instruments']),
    project: Object.freeze(['save']),
    'ext-finish': Object.freeze(['file-new']),
    construction: Object.freeze([]),
    specs: Object.freeze([]),
    'real-estate': Object.freeze([]),
  });

  // THE NOTE THE BUTTON CARRIES. `default` says where the verb DOES live, so
  // the answer is one hover away rather than in this file; a page with a
  // better reason than "not here" overrides it by id, and the three overrides
  // below are the sentences PROJECT and Construction Layout had already
  // written for their own copies.
  const WHY = Object.freeze({
    'file-new': Object.freeze({
      default: 'NEW — start an empty drawing in the MODEL space' }),
    'file-open': Object.freeze({
      default: 'OPEN — open a drawing in the MODEL space' }),
    save: Object.freeze({
      default: 'SAVE — nothing on this page is held back unsaved',
      // Not "not yet": this page writes the layout record on every change,
      // through _persistLayout's queue, so there is no moment when a drafter
      // here has unsaved work to press a button about.
      construction: 'SAVE — this page writes every change as you make it; '
        + 'the word at the foot says where that stands',
      // The same shape: the finishes are merged back into the drawing as they
      // are set, which is why the word at the foot reads "Saved with the
      // drawing" rather than offering a button.
      'ext-finish': 'SAVE — the finishes are written into the drawing as '
        + 'you set them; the word at the foot says where that stands' }),
    'file-save-as': Object.freeze({
      default: 'SAVE AS — a copy under a name you pick is saved in the '
        + 'MODEL space' }),
    'file-ext': Object.freeze({
      default: 'The saved copy is named, and its extension picked, in the '
        + 'MODEL space' }),
    printscreen: Object.freeze({
      default: 'PRINTSCREEN — the pages to show a client are made in the '
        + 'MODEL space',
      // THE ONE THAT WILL COME BACK. This is the page that makes printable
      // sheets, so it is the page where the button most obviously belongs --
      // but which sheet, at what size, with the titleblock filled from where,
      // are questions, and wiring it under cover of a bar change would be
      // answering them by accident.
      construction: 'PRINTSCREEN — printing a sheet is not wired yet' }),
    units: Object.freeze({
      default: 'IMPERIAL and METRIC are set where the house is drawn, in the '
        + 'MODEL space',
      // Not "not yet" either: a construction sheet is scaled in ARCHITECTURAL
      // scales, imperial all the way down, so METRIC here would need a second
      // scale ladder rather than a conversion.
      construction: 'The construction sheet reads in architectural scales, '
        + 'which are imperial — see the VIEWPORT SCALE list' }),
    board: Object.freeze({
      default: 'TOY and DRAFTING are set where the house is drawn, in the '
        + 'MODEL space' }),
    instruments: Object.freeze({
      default: 'Drawing instruments live in the MODEL space' }),
  });

  // BOTH HALVES OF THE BAR, AND EITHER ORDER. MODEL mounts the bottom bar
  // first and the top bar 90 lines later; the other five do it the other way
  // round. So the page's name is remembered as it arrives and the greying runs
  // on whichever call completes the pair -- a stand-down keyed off one of them
  // alone would have skipped the whole top bar on MODEL or on everyone else.
  //
  // MID-PARSE, BEFORE THE PAGE WIRES ANYTHING, which is safe in the one
  // direction that matters: this only ever DISABLES, and only verbs the page
  // has not claimed, so a page turning its own button on afterwards -- as
  // PROJECT does with SAVE, which ships disabled in the markup -- still wins.
  let mountedTop = false;
  let mountedPage;
  const standDown = () => {
    if (!mountedTop || !mountedPage) return;
    const wired = IMPLEMENTS[mountedPage] || [];
    Object.entries(VERBS).forEach(([verb, def]) => {
      if (wired.includes(verb)) return;
      const why = WHY[verb][mountedPage] || WHY[verb].default;
      document.querySelectorAll(def.sel).forEach(el => {
        if (def.down) { def.down(el, why); return; }
        el.disabled = true;
        el.title = why;
      });
    });
  };

  window.DraftShellBars = Object.freeze({
    PAGES,

    // opts.instruments  mount #strip-center (LENGTH, ANGLE, the chips).
    //                   Drawing pages only; defaults OFF, so a page that does
    //                   not draw gets the right bar by saying nothing.
    topBar: (opts = {}) => {
      put(TOPHEAD + '\n'
        + (opts.instruments ? INSTRUMENTS + '\n' : '')
        + TOPTAIL);
      mountedTop = true;
      standDown();
    },

    // opts.page   which chip reads "you are here". A page that passes nothing
    //             gets a row of links and no current mark, which is wrong but
    //             visibly wrong rather than quietly.
    // opts.bone   false mounts the bottom bar WITHOUT the bone and its
    //             drive-thru press. ESTIMATES may want this.
    bottomBar: (opts = {}) => {
      put(BOTHEAD + '\n'
        + '<div id="page-row" data-page-row>\n' + rowOf('page', opts.page) + '\n</div>\n'
        + (opts.bone === false ? '  <div class="grow"></div>\n' : BOTMIDDLE + '\n')
        + '  <div id="sheet-row" data-sheet-row>\n' + rowOf('sheet', opts.page) + '\n  </div>\n'
        + BOTTAIL);
      // AFTER the markup, because the slot it fills arrives with it. `put`
      // inserts mid-parse, so the lane is in the document by the next line.
      mountClock();
      // THE PAGE'S NAME ARRIVES HERE AND NOWHERE ELSE, which is why the
      // greying is keyed off the pair rather than off the top bar alone -- see
      // standDown above. It is `opts.page` unchanged: the chip that reads "you
      // are here" and the verbs this page can keep a promise about are the same
      // question asked twice.
      mountedPage = opts.page;
      standDown();
    },

    readout: () => put(READOUT),

    // counterSlot() CAME OFF HERE on 25 Sep. It existed to give a page with
    // no counts the count's home without the STATUS READOUT tab beside it --
    // an #lower-left holding one span -- and the span moved into the bar's own
    // foot lane, so the function was an empty row mounted by two pages for a
    // tenant that is no longer in it. Both callers dropped the line with it;
    // bottomBar() now brings the home along, which is one fewer thing a new
    // page has to know to remember.

    // ---- the behaviour that is the BAR'S and not the page's ----------------
    //
    // ONLY TWO THINGS MOVED, and the ones that did not are worth naming so
    // nobody assumes this is the whole wiring.
    //
    // THE SKIN SWITCH moved because it is the same on every page and PROJECT,
    // SPECS and Construction Layout would each have needed a copy. What it
    // does here is exactly the shared half of MODEL's applySkin(): apply the
    // palette, mark the pressed button, remember the choice. What it does NOT
    // do is repaint -- paintBonePress, paintSignBoard and paint are the
    // drawing page's, and a bar that called them would be a bar that knows
    // what a drawing is.
    //
    // UNITS DID NOT MOVE, deliberately. The buttons are the bar's but the
    // EFFECT is entirely the drawing's -- drawing.units, markDirty, paint --
    // and the shared part is three lines that mark aria-pressed. Moving it
    // would have bought a callback and saved nothing, which is a refactor
    // paying rent to look tidy.
    //
    // THE BONE DID NOT MOVE for a stronger reason: one button, four verbs.
    // MODEL builds the house, PROJECT builds the chosen type, Construction
    // Layout and REAL ESTATE print, and ESTIMATES may want no bone at all.
    // The bar hands over the button; the page says what pressing it means.

    // THE HOME IS AN ATTRIBUTE, NOT A LIST OF IDS, carried over from
    // MODEL.html with the note it earned there: the switches were split
    // across the strip and the bottom bar and then moved back, two moves and
    // not one line of wiring in between, because `#mode-corner, #house-strip`
    // would have gone stale on the first of them. It fails SILENTLY when it
    // does -- the switch simply never wired -- which is why it is not a list.
    switchSet: attr =>
      [...document.querySelectorAll(`[data-switch-home] button[${attr}]`)],

    markSwitch: (buttons, prop, value) => buttons.forEach(b =>
      b.setAttribute('aria-pressed', String(b.dataset[prop] === value))),

    // Returns the skin, and calls onSkin AFTERWARDS so the page repaints into
    // a palette that is already applied rather than one that is half on.
    //
    // opts.key     the localStorage key. MERGED, never replaced: the board
    //              seed shares it, and a skin write that rebuilt the object
    //              dropped it once already.
    // opts.onSkin  what the page does about it. Optional -- a page with
    //              nothing to repaint passes nothing.
    wireSkin: (opts = {}) => {
      const key = opts.key || 'draft-skin';
      const S = window.DraftShellBars;
      const themeButtons = S.switchSet('data-theme');
      const modeButtons = S.switchSet('data-skin-mode');
      let { theme, mode } = opts;
      const apply = () => {
        const skin = window.DraftPalette.apply(document, theme, mode);
        S.markSwitch(themeButtons, 'theme', theme);
        S.markSwitch(modeButtons, 'skinMode', mode);
        // THE BAR REPAINTS ITS OWN FURNITURE FIRST. The bone's picture is the
        // bar's, so no page has to remember to ask -- which is exactly what
        // PROJECT did not remember, and why it wore a red bone on ROUGH.
        S.paintBone(theme);
        try {
          const keep = JSON.parse(localStorage.getItem(key) || '{}');
          localStorage.setItem(key, JSON.stringify({ ...keep, theme, mode }));
        } catch { /* a private window refusing storage is not a reason to refuse the skin */ }
        if (opts.onSkin) opts.onSkin(skin, theme, mode);
        return skin;
      };
      themeButtons.forEach(b => b.addEventListener('click',
        () => { theme = b.dataset.theme; apply(); }));
      modeButtons.forEach(b => b.addEventListener('click',
        () => { mode = b.dataset.skinMode; apply(); }));
      return { apply, setTheme: t => { theme = t; }, setMode: m => { mode = m; } };
    },

    // THE BONE'S ARTWORK IS THE BAR'S; ITS PRESS IS THE PAGE'S. This split
    // was not obvious until PROJECT wore the bar and the bone came up RED on
    // a ROUGH skin -- the artwork swap lived in MODEL's paintBonePress, so
    // the page that owned the table got the house and the page that did not
    // got a red bone on a blue board. Movie's rule is the opposite: "yes
    // exactly the style is different but the bone and house are the same
    // button."
    //
    // So the TABLE lives here, once, and every page that mounts the bone gets
    // the right picture without owning a copy. What a press DOES is still the
    // page's, and still four different things.
    BONE_ART: Object.freeze({
      ruff: Object.freeze({ src: './assets/bone-red.png', lit: null,
        label: 'BONE', balanceTop: '74%' }),
      rough: Object.freeze({ src: './assets/house-blue-off.png',
        lit: './assets/house-blue-on.png', label: 'HOUSE', balanceTop: '50%' }),
    }),

    // Paints every [data-bone-art] image for the theme in force. MODEL has
    // TWO -- the foot bone and the drive-thru sign's copy -- and they are two
    // BUTTONS with their own lit state, which is why the glow is read off the
    // image's own button rather than from a page-wide flag.
    paintBone: theme => {
      const art = window.DraftShellBars.BONE_ART[theme];
      if (!art) {
        console.warn(`shell-bars: no bone artwork for theme "${theme}"; `
          + 'leaving it as it is.');
        return;
      }
      document.querySelectorAll('[data-bone-art]').forEach(img => {
        const press = img.closest('button');
        const wanted = (art.lit && press && press.hasAttribute('data-lit'))
          ? art.lit : art.src;
        // ONLY ON A CHANGE. Assigning the src it already has is a no-op in
        // every browser this is tested in, but this runs on every NIGHT/DAY
        // press and on both edges of the glow, and a needless assignment is a
        // needless decode.
        const next = new URL(wanted, location.href).href;
        if (img.src !== next) img.src = next;
        // THE SPOKEN NAME MOVES WITH THE PICTURE, and only where there is one
        // to move: one image carries the press's only label, the other is
        // decorative beside a visually hidden span, so an empty alt stays
        // empty and a spoken one is rewritten.
        if (img.alt) img.alt = `${art.label} — build it`;
      });
      document.querySelectorAll('#bone .said').forEach(el => {
        el.textContent = art.label;
      });
      // The number follows the picture it is drawn on -- low in the red on
      // the bone, in the middle of the outline on the house.
      const balance = document.getElementById('bone-balance');
      if (balance) balance.style.top = art.balanceTop;
    },

    // A PULL-OUT RAIL: the tab, the panel, and the toggle between them.
    //
    // Movie asked for one on PROJECT -- "the PROJECT INFO area with the drop
    // zone should be on the first tab top left" -- and the rail's STYLING
    // already moved into shell-bars.css, so this is the markup and the one
    // behaviour that goes with it.
    //
    // MODEL IS NOT POINTED AT THIS, deliberately. Its rails carry two sides,
    // a pane switcher and two different collapse rules, and its setRail()
    // ends in syncShell() and paint() -- a drawing page's business. Re-routing
    // that would be a behaviour change to the page people draw on, dressed up
    // as a refactor, and today has already shown what a 1px difference there
    // costs. The two share a stylesheet now; converging the wiring is its own
    // job with its own proof.
    //
    // THE STATE LIVES IN THE URL, which is MODEL's rule and worth keeping:
    // what the drafter has open survives a reload and can be sent to someone
    // else. ?left=1 means open, absent means shut.
    //
    // opts.side      'left' or 'right'.
    // opts.label     the word down the tab.
    // opts.title     the tab's tooltip.
    // opts.html      what goes in the panel -- the page's own, always.
    // opts.onToggle  optional; a page with something to repaint says so.
    rail: (opts = {}) => {
      const side = opts.side === 'right' ? 'right' : 'left';
      const label = opts.label || 'INFO';
      put(`<button class="rail-tab" id="${side}-tab" type="button"\n`
        + `  aria-expanded="false" aria-controls="${side}-rail"\n`
        + `  title="${opts.title || label}">${label}</button>\n`
        + `<aside id="${side}-rail" hidden>${opts.html || ''}</aside>`);
      const tab = document.getElementById(`${side}-tab`);
      const panel = document.getElementById(`${side}-rail`);
      const params = () => new URLSearchParams(location.search);
      const show = open => {
        panel.hidden = !open;
        tab.setAttribute('aria-expanded', String(open));
        const p = params();
        if (open) p.set(side, '1'); else p.delete(side);
        const q = p.toString();
        history.replaceState(null, '', location.pathname + (q ? '?' + q : ''));
        if (opts.onToggle) opts.onToggle(open);
      };
      tab.addEventListener('click', () => show(panel.hidden));
      // OPENS ON LOAD IF THE URL SAYS SO, which is what putting it in the URL
      // was for. A link that says ?left=1 and opens shut is a link that lied.
      if (params().get(side) === '1') show(true);
      return show;
    },

    // THE TAB IS THE ONLY THING THAT MOVES THE PANEL. Nothing else opens or
    // shuts it -- not a level change, not a save -- so the state on screen is
    // the drafter's own last decision and never a surprise mid-gesture.
    wireReadout: () => {
      const panel = document.getElementById('readout');
      const tab = document.getElementById('readout-tab');
      const show = open => {
        panel.hidden = !open;
        tab.setAttribute('aria-expanded', String(open));
      };
      tab.addEventListener('click', () => show(true));
      document.getElementById('readout-close')
        .addEventListener('click', () => show(false));
      return show;
    },

    // THE TWO FILE QUESTIONS, mounted separately because they are NOT
    // adjacent in the page they came from -- a comment block explaining SAVE
    // AS sits between them, and joining them would have moved that comment
    // away from what it explains.
    fileGuard: () => put(FILEGUARD),
    saveAs: () => put(SAVEAS),
  });
})();
}
