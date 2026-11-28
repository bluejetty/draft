// THE VIEWER'S NOTEPAD -- the drafter's pad, in the 3D viewer.
//
// jb, 28 Nov 2026: "can we add the blue/yello NOTEPAD tab to the ROUGH 3d
// and i could have the code in there like i do with the Bones", then "when
// it open make it look and act like the other one (yellow or blue) keep the
// text allow save as text etc. maybe even calculator too". It is the same
// pad, not a second one:
//
//   NOTES -- five pages kept under the drafter's own keys
//            (model/04-levels-notes-bars.js storeNotes), so a line typed here
//            shows on the drafter's NOTES tab on this site and the other way
//            round. Codes are whole lines on lines 1 to 5 of page 1
//            (bone-wallet.js padHas): 25BONES for the wallet, 3DBONES for the
//            PROJECTS button (projects.js).
//   CALC  -- the drafter's construction calculator (../calc-engine.js), its
//            five tapes and lines kept under the drafter's `draft.calc`, in
//            the drafter's shape.
//   TXT   -- SAVE AS TXT / OPEN TXT in the drafter's file format ("ROUGH-
//            DRAFTER NOTEPAD", "=== NOTES PAGE n ===", "=== CALC PAGE n
//            ==="), so either program opens the other's. TURTLE tables kept
//            in this browser are written too and left alone on open: the
//            TURTLE tab draws, so it stays in the drafter.
(function () {
  'use strict';
  if (window.DraftViewerPad) return;

  const $ = id => document.getElementById(id);
  const PAGES = 5;
  const MAX = 15000;
  const KEY = 'draft.notepad';          // page 1, the one bone-wallet.js reads
  const PAGES_KEY = 'draft.notepad.pages';
  const PAGE_KEY = 'draft.notepad.page';
  const CALC_KEY = 'draft.calc';
  const TURTLE_KEY = 'draft.turtle';
  const HEAD = 'ROUGH-DRAFTER NOTEPAD';

  const blank = () => Array.from({ length: PAGES }, () => '');
  const stored = () => {
    const pages = blank();
    try {
      const all = JSON.parse(localStorage.getItem(PAGES_KEY) || '[]');
      if (Array.isArray(all)) all.slice(0, PAGES).forEach((t, i) => { pages[i] = String(t == null ? '' : t).slice(0, MAX); });
      pages[0] = String(localStorage.getItem(KEY) || '').slice(0, MAX);
    } catch (e) { /* nothing kept */ }
    return pages;
  };
  // Written exactly as the drafter writes them, so either page reads both.
  const store = (pages, at) => {
    try {
      if (pages[0]) localStorage.setItem(KEY, pages[0]); else localStorage.removeItem(KEY);
      if (pages.slice(1).some(Boolean)) localStorage.setItem(PAGES_KEY, JSON.stringify(pages));
      else localStorage.removeItem(PAGES_KEY);
      localStorage.setItem(PAGE_KEY, String(at));
    } catch (e) { /* private window: the pad lives for this visit */ }
  };

  // ── THE CALCULATOR'S STORE, the drafter's shape ─────────────────────────
  const calcStored = () => {
    const pages = Array.from({ length: PAGES }, () => []);
    const lines = blank();
    let metric = false, page = 0;
    try {
      const v = JSON.parse(localStorage.getItem(CALC_KEY) || '{}');
      if (Array.isArray(v.tape)) pages[0] = v.tape.slice(-60);
      (Array.isArray(v.pages) ? v.pages : []).slice(0, PAGES).forEach((t, i) => { if (Array.isArray(t)) pages[i] = t.slice(-60); });
      (Array.isArray(v.lines) ? v.lines : []).slice(0, PAGES).forEach((t, i) => { lines[i] = String(t == null ? '' : t).slice(0, 200); });
      metric = v.metric === true;
      page = Math.min(PAGES - 1, Math.max(0, Number(v.page) || 0));
    } catch (e) { /* nothing kept */ }
    return { pages, lines, metric, page };
  };
  const calcStore = c => {
    try {
      localStorage.setItem(CALC_KEY, JSON.stringify({ tape: c.pages[0], pages: c.pages, lines: c.lines, metric: c.metric, page: c.page }));
    } catch (e) { /* this visit only */ }
  };

  let pages = blank();
  let at = 0;
  let calc = calcStored();
  let tab = 'notes';

  // ── NOTES ──────────────────────────────────────────────────────────────
  // The page keys follow the tab showing, as the drafter's do: five pads,
  // five calculators.
  function show() {
    const text = $('pad-text');
    if (text.value !== pages[at]) text.value = pages[at];
    const page = tab === 'calc' ? calc.page : at;
    $('pad-page-said').textContent = `PAGE ${page + 1} OF ${PAGES}`;
    $('pad-split').hidden = tab === 'notes';
    $('pad-split').textContent = `NOTES · PAGE ${at + 1}`;
    document.querySelectorAll('[data-pad-page]').forEach(b => {
      const i = Number(b.dataset.padPage) - 1;
      b.setAttribute('aria-pressed', String(i === page));
      const written = tab === 'calc' ? Boolean(calc.pages[i].length || calc.lines[i]) : Boolean(pages[i]);
      b.toggleAttribute('data-written', written);
    });
  }

  // Anything that reads a code hears about it (the wallet's ceiling, the
  // PROJECTS button).
  const changed = () => {
    window.dispatchEvent(new Event('draft-pad-changed'));
    window.dispatchEvent(new Event('draft-bones-changed'));
  };
  const setPages = (next, page) => {
    pages = next;
    if (page != null) at = page;
    store(pages, at);
    show();
    changed();
  };

  // ── CALC ───────────────────────────────────────────────────────────────
  const C = () => window.DraftCalc;
  const line = () => $('calc-line');
  const work = () => C().work(line().value, { metric: calc.metric });
  function showAnswer() {
    const out = document.querySelector('[data-calc-answer]');
    out.textContent = '';
    out.removeAttribute('data-bad');
    if (!line().value.trim() || !C()) return null;
    const r = work();
    if (!r.ok) { out.textContent = r.why; out.setAttribute('data-bad', ''); return r; }
    out.append(r.main);
    if (r.alt.length) { const sm = document.createElement('small'); sm.textContent = r.alt.join('   '); out.append(sm); }
    return r;
  }
  function drawTape() {
    const tape = document.querySelector('[data-calc-tape]');
    tape.textContent = '';
    calc.pages[calc.page].forEach(row => {
      const div = document.createElement('div');
      div.className = 'calc-row';
      div.dataset.calcRow = '';
      const ex = document.createElement('span'); ex.className = 'ex'; ex.textContent = row.line;
      const an = document.createElement('span'); an.className = 'an'; an.textContent = row.main;
      div.append(ex, an);
      div.title = 'Work on from this answer';
      div.addEventListener('click', () => { line().value = row.reuse || row.main; showAnswer(); keepCalc(); line().focus(); });
      tape.append(div);
    });
    tape.scrollTop = tape.scrollHeight;
  }
  // An answer as a line the calculator reads back, as the drafter writes it.
  const reusable = r => (r.dim === 2 ? (calc.metric ? `${(r.v / (C().FT_PER_M ** 2)).toFixed(4)} sqm` : `${r.v.toFixed(4)} sqft`)
    : r.dim === 1 ? C().feetInches(r.v, 16).replace('-', ' ') : String(+r.v.toFixed(6)));
  const keepCalc = () => { calc.lines[calc.page] = line().value; calcStore(calc); };
  function equals() {
    const r = showAnswer();
    if (!r || !r.ok) return;
    calc.pages[calc.page] = calc.pages[calc.page].concat({ line: line().value.trim(), main: r.main, reuse: reusable(r) }).slice(-60);
    line().value = reusable(r);
    keepCalc();
    drawTape();
    show();
    line().select();
  }
  const syncUnits = () => { document.querySelector('[data-calc-do="units"]').textContent = calc.metric ? 'METRIC' : 'FT-IN'; };
  function calcTurnTo(i) {
    keepCalc();
    calc.page = Math.min(PAGES - 1, Math.max(0, i));
    line().value = calc.lines[calc.page] || '';
    calcStore(calc);
    drawTape();
    showAnswer();
    show();
  }

  function showTab(which) {
    tab = which === 'calc' ? 'calc' : 'notes';
    document.querySelectorAll('[data-pad-tab]').forEach(b => b.setAttribute('aria-selected', String(b.dataset.padTab === tab)));
    document.querySelector('[data-calc]').hidden = tab !== 'calc';
    $('pad-clear').hidden = tab !== 'notes';
    if (tab === 'calc') { calc = calcStored(); line().value = calc.lines[calc.page] || ''; syncUnits(); drawTape(); showAnswer(); }
    show();
    if (tab === 'calc') line().focus();
  }

  // ── THE WHOLE PAD AS ONE TEXT FILE, the drafter's format ───────────────
  function turtleStored() {
    try {
      const v = JSON.parse(localStorage.getItem(TURTLE_KEY) || '[]');
      if (Array.isArray(v) && v.every(pg => pg && Array.isArray(pg.rows))) return v.slice(0, PAGES);
      if (Array.isArray(v) && v.every(Array.isArray)) return v.slice(0, PAGES).map(rows => ({ rows, kind: 'lines' }));
    } catch (e) { /* none */ }
    return [];
  }
  function asText() {
    const parts = [HEAD];
    pages.forEach((t, i) => { if (t) parts.push(`=== NOTES PAGE ${i + 1} ===\n${t}`); });
    calc.pages.forEach((tape, i) => {
      const l = calc.lines[i] || '';
      if (!tape.length && !l) return;
      parts.push(`=== CALC PAGE ${i + 1} ===\n${[...tape.map(r => `${r.line} = ${r.main}`), ...(l ? [l] : [])].join('\n')}`);
    });
    turtleStored().forEach((pg, i) => {
      const rows = (pg.rows || []).filter(r => r && (r.dir || r.dist));
      if (!rows.length) return;
      const kind = String(pg.kind || 'lines').toUpperCase();
      parts.push(`=== TURTLE PAGE ${i + 1} (${kind}) ===\n${rows.map(r => `${r.dir}\t${r.dist}`).join('\n')}`);
    });
    return parts.join('\n\n') + '\n';
  }
  // A file with no headings at all is notes for page 1, so a plain .txt
  // opens too. TURTLE pages in it are for the drafter: left as they are.
  function fromText(text) {
    const src = String(text == null ? '' : text).replace(/\r/g, '');
    const re = /^=== (NOTES|CALC|TURTLE) PAGE ([1-5])(?: \(([A-Z /]+)\))? ===$/gm;
    const heads = [];
    let m;
    while ((m = re.exec(src))) heads.push({ tab: m[1], page: Number(m[2]) - 1, at: m.index, end: m.index + m[0].length });
    const out = { notes: blank(), calc: Array.from({ length: PAGES }, () => ({ tape: [], line: '' })) };
    if (!heads.length) { out.notes[0] = src.replace(new RegExp(`^${HEAD}\\n*`), '').slice(0, MAX); return out; }
    heads.forEach((h, k) => {
      const body = src.slice(h.end + 1, k + 1 < heads.length ? heads[k + 1].at : src.length).replace(/\n+$/, '');
      if (h.tab === 'NOTES') out.notes[h.page] = body.slice(0, MAX);
      else if (h.tab === 'CALC' && C()) {
        body.split('\n').filter(Boolean).forEach(l => {
          const eq = l.lastIndexOf(' = ');
          if (eq > 0) {
            const ln = l.slice(0, eq).trim();
            const r = C().work(ln, { metric: calc.metric });
            if (r.ok) out.calc[h.page].tape.push({ line: ln, main: r.main, reuse: reusable(r) });
          } else out.calc[h.page].line = l.trim().slice(0, 200);
        });
      }
    });
    return out;
  }
  function openText(text) {
    const read = fromText(text);
    read.calc.forEach((pg, i) => { calc.pages[i] = pg.tape.slice(-60); calc.lines[i] = pg.line; });
    calcStore(calc);
    if (tab === 'calc') { line().value = calc.lines[calc.page] || ''; drawTape(); showAnswer(); }
    setPages(read.notes);
  }
  async function saveText() {
    const V = window.DraftViewer;
    const base = (V && V.state && V.state.name ? V.state.name : 'ROUGH 3D').replace(/\.[^.]+$/, '');
    const file = { name: `${base} NOTES.txt`, mime: 'text/plain', blob: new Blob([asText()], { type: 'text/plain' }) };
    try {
      if (V && V.writeOut) { await V.writeOut(file); return; }
    } catch (e) { /* fall through to a plain download */ }
    const url = URL.createObjectURL(file.blob);
    const a = document.createElement('a');
    a.href = url; a.download = file.name; a.hidden = true;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }

  function open(on) {
    const want = on == null ? $('pad').hidden : !!on;
    $('pad').hidden = !want;
    $('pad-tab').classList.toggle('lit', want);
    $('pad-tab').setAttribute('aria-expanded', String(want));
    if (want) {
      pages = stored();
      calc = calcStored();
      showTab(tab);
      if (tab === 'notes') $('pad-text').focus();
    }
  }

  function boot() {
    if (!$('pad')) return;
    pages = stored();
    try { at = Math.min(PAGES - 1, Math.max(0, Number(localStorage.getItem(PAGE_KEY)) || 0)); } catch (e) { at = 0; }
    $('pad-text').maxLength = MAX;
    // The split strip that names the notes page under the calculator.
    const split = document.querySelector('[data-pad-split-label]');
    if (split) split.id = 'pad-split';
    show();
    $('pad-tab').addEventListener('click', () => open());
    $('pad-close').addEventListener('click', () => open(false));
    $('pad-text').addEventListener('input', e => {
      pages[at] = e.target.value;
      store(pages, at);
      show();
      if (at === 0) changed();
    });
    // The 3D page's keys (W, F, the arrows) stay off the pad's lines.
    ['pad-text', 'calc-line'].forEach(id => $(id).addEventListener('keydown', e => e.stopPropagation()));
    $('pad-clear').addEventListener('click', () => {
      pages[at] = '';
      store(pages, at);
      show();
      if (at === 0) changed();
    });
    document.querySelectorAll('[data-pad-page]').forEach(b => b.addEventListener('click', () => {
      const i = Number(b.dataset.padPage) - 1;
      if (tab === 'calc') { calcTurnTo(i); return; }
      at = i;
      store(pages, at);
      show();
    }));
    document.querySelectorAll('[data-pad-tab]').forEach(b => b.addEventListener('click', () => showTab(b.dataset.padTab)));
    // The calculator's keys and its line, as the drafter's.
    document.querySelectorAll('#pad [data-calc-key]').forEach(b => b.addEventListener('click', () => {
      const L = line(), s = L.selectionStart == null ? L.value.length : L.selectionStart, t = L.selectionEnd == null ? s : L.selectionEnd;
      L.value = L.value.slice(0, s) + b.dataset.calcKey + L.value.slice(t);
      const caret = s + b.dataset.calcKey.length;
      L.focus();
      L.setSelectionRange(caret, caret);
      showAnswer();
      keepCalc();
    }));
    document.querySelectorAll('#pad [data-calc-do]').forEach(b => b.addEventListener('click', () => {
      const what = b.dataset.calcDo;
      if (what === 'equals') equals();
      else if (what === 'clear') { line().value = ''; showAnswer(); keepCalc(); }
      else if (what === 'back') { line().value = line().value.replace(/\s*\S\s*$/, ''); showAnswer(); keepCalc(); }
      else if (what === 'units') { calc.metric = !calc.metric; calcStore(calc); syncUnits(); showAnswer(); }
      else if (what === 'notes') {
        const r = showAnswer();
        if (!r || !r.ok) return;
        const said = `${line().value.trim()} = ${r.main}`;
        const next = pages.slice();
        next[at] = next[at] ? `${next[at].replace(/\s*$/, '')}\n${said}` : said;
        setPages(next);
      }
      if (what !== 'notes') line().focus();
    }));
    line().addEventListener('input', () => { showAnswer(); keepCalc(); });
    line().addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); equals(); }
      if (e.key === 'Escape') line().blur();
    });
    $('pad-save-txt').addEventListener('click', () => { saveText(); });
    $('pad-open-txt').addEventListener('click', () => { $('pad-open-file').value = ''; $('pad-open-file').click(); });
    $('pad-open-file').addEventListener('change', async () => {
      const f = $('pad-open-file').files && $('pad-open-file').files[0];
      if (!f) return;
      openText(await f.text());
      if (window.DraftViewer && window.DraftViewer.setStatus) window.DraftViewer.setStatus(`${f.name} opened onto the pad.`);
    });
    // Typed in the drafter in another tab: shows here.
    window.addEventListener('storage', e => {
      if (e.key === CALC_KEY && tab === 'calc' && document.activeElement !== line()) { calc = calcStored(); line().value = calc.lines[calc.page] || ''; drawTape(); showAnswer(); show(); }
      if (e.key !== KEY && e.key !== PAGES_KEY && e.key !== null) return;
      pages = stored();
      show();
      changed();
    });
  }

  window.DraftViewerPad = Object.freeze({ open, showTab, asText, openText, pages: () => pages.slice() });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
