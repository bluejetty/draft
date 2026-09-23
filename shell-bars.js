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
  // `row` is which end of the bottom bar it sits at. REAL ESTATE LAYOUT stays
  // LEFT with MODEL (Movie, 15 Sep) because it is a drawing OF the model
  // rather than a sheet off it -- the marketing plan, not a set the site
  // builds from.
  const PAGES = Object.freeze([
    Object.freeze({ id: 'project', row: 'page', label: 'PROJECT',
      href: './PROJECT.html', extra: ' data-project-corner-bl',
      title: 'The project: every drawing in this job',
      here: 'The project \u2014 you are here' }),
    Object.freeze({ id: 'model', row: 'page', label: 'MODEL',
      href: './MODEL.html',
      title: 'The model: where the house is drawn',
      here: 'The model \u2014 you are here' }),
    Object.freeze({ id: 'real-estate', row: 'page', label: 'REAL ESTATE LAYOUT',
      href: null,
      title: 'REAL ESTATE LAYOUT \u2014 the marketing floor plan, not built yet' }),
    Object.freeze({ id: 'construction', row: 'sheet', label: 'CONSTRUCTION LAYOUT',
      href: './LAYOUT.dc.html',
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

  const READOUT = `<div id="lower-left" data-lower-left>
  <span data-visit-counter-home></span>
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
     to the darker bar"). Same six pages in the order Movie listed them. Four
     exist. REAL ESTATE LAYOUT and ESTIMATES do not, and they are DOWN rather
     than absent for the same reason a dormant chip is on the strip: the row
     is the map of the job, and a map with two towns missing teaches the
     drafter a shape that is wrong. Each says what it will be when it is
     built.

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
  const BOTTAIL = `</div>`;
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

  window.DraftShellBars = Object.freeze({
    PAGES,

    // opts.instruments  mount #strip-center (LENGTH, ANGLE, the chips).
    //                   Drawing pages only; defaults OFF, so a page that does
    //                   not draw gets the right bar by saying nothing.
    topBar: (opts = {}) => put(TOPHEAD + '\n'
      + (opts.instruments ? INSTRUMENTS + '\n' : '')
      + TOPTAIL),

    // opts.page   which chip reads "you are here". A page that passes nothing
    //             gets a row of links and no current mark, which is wrong but
    //             visibly wrong rather than quietly.
    // opts.bone   false mounts the bottom bar WITHOUT the bone and its
    //             drive-thru press. ESTIMATES may want this.
    bottomBar: (opts = {}) => put(BOTHEAD + '\n'
      + '<div id="page-row" data-page-row>\n' + rowOf('page', opts.page) + '\n</div>\n'
      + (opts.bone === false ? '  <div class="grow"></div>\n' : BOTMIDDLE + '\n')
      + '  <div id="sheet-row" data-sheet-row>\n' + rowOf('sheet', opts.page) + '\n  </div>\n'
      + BOTTAIL),

    readout: () => put(READOUT),

    // THE COUNT'S SLOT WITHOUT THE READOUT, for pages that have a visit count
    // to show and nothing to count on the drawing.
    //
    // Movie, 23 Sep: "i'd prefer just 1 row on bottom bar, and place the 12
    // views above it (or could we make 1 upper row that has completely
    // transparent background? that would work if possible)". It already is
    // one: #lower-left is fixed at --readout-bottom, which is the bar's own
    // height plus 12px, and it paints no background at all. So the answer to
    // "if possible" is that the slot he was describing has been there since
    // the readout moved to the foot -- this page just never mounted it.
    //
    // WHY NOT JUST CALL readout(). Because that brings the STATUS READOUT tab,
    // and a tab that opens an empty panel is a dead control on a page with no
    // counts. This is the same slot with only the tenant that has something
    // to say.
    counterSlot: () => put('<div id="lower-left" data-lower-left>\n'
      + '  <span data-visit-counter-home></span>\n'
      + '</div>'),

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
