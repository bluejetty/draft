// FINISH THICKNESS AND TEXTURE -- the section both pages show (jb, 27 Nov 2026).
//
// jb: *"add a section in the OBJ PROP to allow the user to change the
// thickness and texture. but place the textures and thicknesses to
// appropriate thickness and texture"*. One builder, two homes: the EXT.
// FINISH panel for the picked wall, and MODEL's OBJ / PROP when a wall is
// picked there. Both write the same record (drawing.finishSettings, see
// wall-types.js finishSettingRecord), so a change made on one is what the
// other shows.
//
// WHAT IS SHOWN IS THE ROW AS THE HOUSE HAS IT, with the catalogue default
// beside every box, so a drafter who typed 3 5/8 into a brick can see it was
// 4 5/8 and put it back with DEFAULTS. A box left at its default stores
// nothing: the record keeps departures and only departures.
//
// THICKNESS is how far the finish stands out off the sheathing. TEXTURE is
// the pattern's own sizes (the brick, the lap, the board and batten), which
// the elevation hatch and the 3D surface both draw from, plus whether the 3D
// view paints it at all.
(function () {
  'use strict';
  if (window.DraftFinishSettingsPanel) return;

  const inchesSaid = n => {
    const F = window.DraftFormatters;
    return F && F.formatInchesOnly ? F.formatInchesOnly(n) : `${n}"`;
  };
  const readInches = text => {
    const F = window.DraftFormatters;
    if (F && F.parseInches) {
      const r = F.parseInches(text);
      return r.ok ? r.inches : NaN;
    }
    return Number(text);
  };

  // opts: {
  //   ids: finish ids to show (the picked wall's, base first),
  //   settings: the drawing's finishSettings object (or null),
  //   onChange(id, record | null): the page stores it, repaints, saves,
  //   inputClass, titleClass: the page's own classes for a box and a heading,
  //   say(text): where a refusal is explained (optional),
  // }
  // THE LAYOUT, once per page: rows of a word and a box. Colours are the
  // page's own (it inherits them); a page may dress it further.
  const dress = () => {
    if (document.getElementById('finish-settings-style')) return;
    const st = document.createElement('style');
    st.id = 'finish-settings-style';
    st.textContent = `
      .finish-settings { margin-top: 12px; display: flex; flex-direction: column; gap: 6px; }
      .finish-set { border: 1px solid rgba(127,127,127,.45); padding: 6px; display: flex; flex-direction: column; gap: 4px; }
      .finish-set-name { font-size: 11px; letter-spacing: .07em; font-weight: 600; }
      .finish-set-row { display: grid; grid-template-columns: 1fr 76px; align-items: center; gap: 2px 6px;
        font-size: 10px; letter-spacing: .06em; }
      .finish-set-row input[type="text"] { width: 100%; box-sizing: border-box; }
      .finish-set-default { grid-column: 2; font-size: 9px; opacity: .7; }
      .finish-set-tick { display: flex; gap: 6px; cursor: pointer; }
      .finish-settings-note { font-size: 10px; opacity: .75; line-height: 1.4; }`;
    document.head.append(st);
  };

  function node(opts) {
    dress();
    const WT = window.DraftWallTypes;
    const box = document.createElement('div');
    box.className = 'finish-settings';
    box.dataset.finishSettings = '';
    if (!WT || !WT.stockFinishById) return box;
    const head = document.createElement('div');
    head.className = opts.titleClass || 'finish-settings-title';
    head.textContent = 'FINISH THICKNESS & TEXTURE';
    box.append(head);
    const ids = (opts.ids || []).filter((id, i, all) => all.indexOf(id) === i);
    ids.forEach(id => box.append(oneFinish(WT, id, opts)));
    const note = document.createElement('div');
    note.className = 'finish-settings-note';
    note.textContent = 'Every wall in this house with that finish follows. It stands out from the wall, so the framing and dimensions stay where they are.';
    box.append(note);
    return box;
  }

  function oneFinish(WT, id, opts) {
    const stock = WT.stockFinishById(id);
    const now = WT.finishById(id);
    const rec = (WT.finishSettingRecord(stock.id, opts.settings && opts.settings[stock.id])) || {};
    const wrap = document.createElement('div');
    wrap.className = 'finish-set';
    wrap.dataset.finishSet = stock.id;
    const name = document.createElement('div');
    name.className = 'finish-set-name';
    name.textContent = stock.label.toUpperCase();
    wrap.append(name);

    const write = patch => {
      const next = { ...rec, params: { ...(rec.params || {}) } };
      Object.entries(patch).forEach(([k, v]) => {
        if (k === 'params') Object.assign(next.params, v);
        else if (v === null) delete next[k];
        else next[k] = v;
      });
      opts.onChange(stock.id, WT.finishSettingRecord(stock.id, next));
    };
    const field = (label, value, dflt, attr, onValue, max) => {
      const row = document.createElement('label');
      row.className = 'finish-set-row';
      const word = document.createElement('span');
      word.textContent = label;
      const input = document.createElement('input');
      input.type = 'text';
      input.inputMode = 'decimal';
      input.className = opts.inputClass || 'finish-set-field';
      input.setAttribute(attr[0], attr[1]);
      input.value = inchesSaid(value);
      input.title = `Inches (4 5/8, 4-5/8 or 4.625). Default ${inchesSaid(dflt)}.`;
      const was = document.createElement('small');
      was.className = 'finish-set-default';
      was.textContent = Math.abs(value - dflt) > 1e-6 ? `default ${inchesSaid(dflt)}` : 'default';
      input.addEventListener('change', () => {
        const n = readInches(input.value);
        if (!Number.isFinite(n) || n < 0 || n > max || (attr[0] !== 'data-fin-thick' && n <= 0)) {
          if (opts.say) opts.say(`${label}: use inches between ${attr[0] === 'data-fin-thick' ? 0 : 'just over 0'} and ${inchesSaid(max)}.`);
          input.value = inchesSaid(value);
          return;
        }
        onValue(n);
      });
      row.append(word, input, was);
      return row;
    };

    wrap.append(field('THICKNESS', now.thicknessIn, stock.thicknessIn, ['data-fin-thick', ''],
      n => write({ thicknessIn: n }), WT.FINISH_THICKNESS_MAX_IN));

    if (stock.pattern && stock.pattern !== 'none') {
      const tex = document.createElement('label');
      tex.className = 'finish-set-row finish-set-tick';
      const tick = document.createElement('input');
      tick.type = 'checkbox';
      tick.dataset.finTexture = '';
      tick.checked = now.texture !== false;
      tick.addEventListener('change', () => write({ texture: tick.checked ? null : false }));
      const word = document.createElement('span');
      word.textContent = 'TEXTURE IN 3D';
      tex.append(tick, word);
      wrap.append(tex);
    }
    (stock.params || []).forEach(p => {
      const cur = (now.params || []).find(q => q.key === p.key);
      wrap.append(field(p.label.toUpperCase(), cur ? cur.in : p.in, p.in, ['data-fin-param', p.key],
        n => write({ params: { [p.key]: n } }), WT.FINISH_PARAM_MAX_IN));
    });

    if (Object.keys(rec).length) {
      const reset = document.createElement('button');
      reset.type = 'button';
      reset.className = opts.buttonClass || 'finish-set-reset';
      reset.dataset.finReset = '';
      reset.textContent = 'DEFAULTS';
      reset.title = `Put ${stock.label} back to ${inchesSaid(stock.thicknessIn)} and its own sizes`;
      reset.addEventListener('click', () => opts.onChange(stock.id, null));
      wrap.append(reset);
    }
    return wrap;
  }

  // A page's write: put one finish's record on the drawing's object (made on
  // the first edit, never before), IN PLACE so wall-types.js, which holds it
  // by reference, reads it on the next paint.
  function store(drawing, id, record) {
    if (!drawing) return;
    if (!drawing.finishSettings || typeof drawing.finishSettings !== 'object') {
      if (!record) return;
      drawing.finishSettings = {};
    }
    if (record) drawing.finishSettings[id] = record;
    else delete drawing.finishSettings[id];
    if (window.DraftWallTypes && window.DraftWallTypes.adoptFinishSettings) {
      window.DraftWallTypes.adoptFinishSettings(drawing);
    }
  }

  window.DraftFinishSettingsPanel = Object.freeze({ node, store });
})();
