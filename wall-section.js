// THE TYPICAL WALL SECTION ON A SHEET, AND THE THREE DETAILS CUT FROM IT
// (jb, 9 Nov). PROJECT has drawn the house's wall section since September --
// project-page.js's buildWallSection, off the level cards, the foundation,
// the roof and the exterior wall type -- and nothing printed it. This module
// reads the SAME numbers off the saved drawing that PROJECT reads off its
// live state, hands them to the same builder, and paints the result into a
// LAYOUT viewport at an architect's scale with the callouts a section wears.
//
// jb, 9 Nov: "so the wall section is basically taken from the PROJECT
// information right" -- yes, and only from there. Change the pitch, the
// pour or the joists on PROJECT and the sheet redraws; nothing is stored
// for the sheet's own sake.
//
// THE DETAILS ARE WINDOWS ONTO THE ONE DRAWING, not drawings of their own.
// jb: "when i do details i usually show where the exterior walls meet the
// floor, and where it meets the roof and also the footing". So EAVE, FLOOR
// and FOOTING are each a rectangle in the section's own feet, painted from
// the same parts at a bigger scale. They cannot disagree with the section,
// because they are it.
//
// WHAT THIS DERIVATION MIRRORS is PROJECT.html's detailValues(): each rule
// below names the line of PROJECT it copies, so the next drift is findable.
// A split (bilevel) draws its stored stack without the wood fill wall that
// PROJECT's band 2 adds from the section table -- a known limit, stated in
// the PR rather than papered over.
if (!window.DraftWallSection) {
(() => {
  // PROJECT.html: `const ROOF_FASCIA_IN = 5.5;` and `const HOUSE_CUT_FT = 5;`
  const ROOF_FASCIA_IN = 5.5;
  const HOUSE_CUT_FT = 5;
  const DEFAULT_FOOTING_WIDTH_IN = 20;
  const ICF_FOOTING_WIDTH_IN = 24;

  const positive = (value, fallback) => {
    const n = Number(value);
    return Number.isFinite(n) && n > 0 ? n : fallback;
  };

  // ── THE VALUES, OFF THE SAVED DRAWING ─────────────────────────────────
  // Null when there is no house to section: no floor level in the file.
  const wallSectionValues = saved => {
    if (!saved || typeof saved !== 'object') return null;
    const format = window.DraftDrawingFormat;
    const LA = window.DraftLevelAssembly;
    const WT = window.DraftWallTypes;
    const PP = window.DraftProjectPage;
    if (!format || !LA || !WT || !PP) return null;
    const wallType = id => WT.WALL_TYPES.find(type => type.id === id) || null;
    const levels = format.levels(saved.levels);
    // PROJECT: floorLevels = levels not FOUNDATION / ROOF / SITE, by elev.
    const floorLevels = levels.filter(level => ![1, 7, 8].includes(level.id))
      .sort((a, b) => a.elev - b.elev);
    if (!floorLevels.length) return null;
    const buildType = format.buildType(saved.buildType);
    // PROJECT: oneStorey() -- a bungalow draws its main floor alone.
    const drawnFloors = buildType === 'bungalow' ? floorLevels.slice(0, 1) : floorLevels;
    const assemblies = saved.levelAssemblies && typeof saved.levelAssemblies === 'object'
      ? saved.levelAssemblies : {};
    const assembly = levelId => LA.normaliseLevelAssembly(assemblies[levelId], LA.levelRole(levelId));
    const activeWallType = wallType(saved.activeWallType) ? saved.activeWallType : 'stud_2x6';
    // PROJECT: floorWallType -- a floor's own override, else the house's.
    const floorWallType = levelId => {
      const override = assembly(levelId).wallType;
      return WT.EXTERIOR_WALL_TYPE_IDS.includes(override) && wallType(override) ? override : activeWallType;
    };
    // PROJECT: fdnWallType -- the FOUNDATION assembly's choice, else the
    // drawn foundation walls, else 8" concrete.
    const fdnWallType = (() => {
      const choice = assembly(1).wallType;
      if (WT.FOUNDATION_WALL_TYPE_IDS.includes(choice) && wallType(choice)) return choice;
      const wall = (Array.isArray(saved.walls) ? saved.walls : []).find(candidate =>
        candidate?.view === 'foundation' && wallType(candidate?.wallType)
        && WT.FOUNDATION_WALL_TYPE_IDS.includes(candidate.wallType));
      return wall ? wall.wallType : 'concrete_8';
    })();
    const gradeBeam = assembly(1).foundationKind === 'gradebeam';
    const fdnIsIcf = !gradeBeam && fdnWallType.startsWith('icf');
    const attachmentIn = positive(saved.foundationAttachmentIn, PP.SILL_PLATE_IN);
    const attachment = fdnIsIcf ? 'sill' : (saved.foundationAttachment === 'ladder' ? 'ladder' : 'sill');
    const ladderIn = PP.ladderDepthIn(saved.foundationLadderIn);
    const roofPitch = positive(saved.roofPitch, 4);
    const roofOverhang = positive(saved.roofOverhang, 2);
    const heelIn = saved.roofHeelIn != null && Number.isFinite(Number(saved.roofHeelIn))
      ? Number(saved.roofHeelIn) : PP.roofHeelIn(ROOF_FASCIA_IN, roofOverhang, roofPitch);
    // PROJECT: houseSillFt / attachedOffsetFt / derivedGradeOffsetFt.
    const main = assembly(floorLevels[0].id);
    const houseSillFt = -(main.joistDepthIn + main.sheathingIn) / 12;
    const zone = format.zoneHeights(saved.zoneHeights);
    const garageFoundation = saved.sectionTable?.rows?.attachedGarage?.garageFoundation || 'gradebeam';
    const attachedOffsetFt = zone.zones?.attachedGarage?.offsetFt
      ?? (PP.SPLIT_TYPES.includes(buildType) || garageFoundation === 'gradebeam'
        ? houseSillFt : houseSillFt - PP.GARAGE_SILL_BELOW_HOUSE_FT);
    const gradeOffsetFt = zone.gradeOffsetFt
      ?? (attachedOffsetFt - houseSillFt - PP.GRADE_BELOW_CONCRETE_IN / 12);
    const fdn = assembly(1);
    return {
      buildType,
      cutDepthFt: HOUSE_CUT_FT,
      floors: drawnFloors.map(level => {
        const asm = assembly(level.id);
        return { id: level.id, name: level.name, wallHeightFt: asm.wallHeightFt,
          joistDepthIn: asm.joistDepthIn, sheathingIn: asm.sheathingIn, framing: asm.framing,
          wallIn: wallType(floorWallType(level.id)).totalIn, wallType: floorWallType(level.id) };
      }),
      foundation: {
        // PROJECT: housePourFt -- the stored height is the bearing line,
        // plate included; the section draws the plate as its own band.
        wallHeightFt: fdn.wallHeightFt - attachmentIn / 12,
        thicknessIn: gradeBeam ? PP.GRADE_BEAM_THICKNESS_IN : wallType(fdnWallType).totalIn,
        wallType: gradeBeam ? 'gradebeam' : fdnWallType,
        slabIn: fdn.slabThicknessIn,
        footingWidthIn: fdn.footingWidthIn ?? (fdnIsIcf ? ICF_FOOTING_WIDTH_IN : DEFAULT_FOOTING_WIDTH_IN),
        footingDepthIn: fdn.footingDepthIn,
        gradeOffsetFt,
        attachment,
        attachmentIn,
        ladderIn,
        foundationKind: fdn.foundationKind,
      },
      roof: { pitch: roofPitch, overhangFt: roofOverhang, fasciaIn: ROOF_FASCIA_IN, heelIn },
      wallThicknessIn: wallType(activeWallType).totalIn,
    };
  };

  // ── THE WORDS ON THE SECTION ───────────────────────────────────────────
  // Short, the way a drafter letters a section; each stands at the anchor
  // PROJECT puts its input box on, so the two pages point at the same spot.
  const ftIn = feet => window.DraftFormatters.formatArchitecturalInches(feet * 12);
  const inches = value => window.DraftFormatters.formatInchesOnly(value);
  const lumber = depthIn => ({ 3.5: '2x4', 5.5: '2x6', 7.25: '2x8', 9.25: '2x10', 11.25: '2x12' })[depthIn] || `${inches(depthIn)}`;
  const wallWord = (typeId, totalIn) => {
    if (typeId === 'gradebeam') return 'GRADE BEAM';
    if (/^stud_/.test(typeId)) return `${lumber(totalIn)} STUDS @ 16" O.C.`;
    if (/^icf/.test(typeId)) return `${inches(totalIn)} ICF`;
    if (typeId === 'concrete_8') return '8" CONC. WALL';
    if (typeId === 'pt_wood_fdn') return '2x8 PT WOOD FDN';
    if (typeId === 'guardrail') return 'GUARDRAIL';
    return `${inches(totalIn)} WALL`;
  };
  const labelsFor = (values, anchors) => {
    const labels = [];
    const put = (anchor, text, align = 'center', dx = 0, dy = 0) => {
      if (!anchor || !text) return;
      labels.push({ x: anchor.x + dx, y: anchor.y + dy, text, align });
    };
    const { roof, foundation: fdn } = values;
    // THE PITCH OVER THE EAVE, where the eave detail sees it too.
    put({ x: -roof.overhangFt / 2, y: anchors.fascia.y + roof.fasciaIn / 24 + (roof.overhangFt / 2) * (roof.pitch / 12) + 0.55 }, `${roof.pitch}:12`);
    put(anchors.overhang, `${ftIn(roof.overhangFt)} O/H`);
    put(anchors.fascia, `${lumber(roof.fasciaIn)} FASCIA`, 'right', -0.1);
    put(anchors.heel, `${inches(roof.heelIn)} HEEL`, 'left', 0.2);
    const cut = values.cutDepthFt;
    values.floors.forEach((level, index) => {
      // TWO LINES ON THE WALL -- what it is, then how tall -- so neither
      // runs out through the break line at 1/4".
      put(anchors[`wallHeight-${level.id}`], wallWord(level.wallType, level.wallIn), 'left', 0, 0.45);
      put(anchors[`wallHeight-${level.id}`], `${ftIn(level.wallHeightFt)} WALL`, 'left', 0, -0.45);
      // THE FLOOR, in the band: joists on the band, sheathing just over it.
      const floor = anchors[`floor-${level.id}`];
      if (floor) {
        put({ x: cut * 0.5, y: floor.y }, `${inches(level.joistDepthIn)} JOISTS`);
        put({ x: cut * 0.5, y: floor.y + level.joistDepthIn / 24 + 0.4 }, `${inches(level.sheathingIn)} SHTG`);
      }
      if (index === 0 && level.framing === 'balloon') put(anchors[`sheathing-${level.id}`], 'BALLOON FRAMED', 'left', 0.6, -0.9);
    });
    if (anchors.attachment) {
      put(anchors.attachment, fdn.attachment === 'ladder'
        ? `${inches(fdn.ladderIn)} PT LADDER` : `${inches(fdn.attachmentIn)} SILL PLATE`, 'left', fdn.thicknessIn / 24 + 0.9, -0.3);
    }
    put(anchors.fdnHeight, wallWord(fdn.wallType, fdn.thicknessIn), 'left', 0, 0.45);
    put(anchors.fdnHeight, `${ftIn(fdn.wallHeightFt)} HIGH`, 'left', 0, -0.45);
    if (anchors.footingWidth) put(anchors.footingWidth, `${inches(fdn.footingWidthIn)} x ${inches(fdn.footingDepthIn)} CONC. FOOTING`);
    put(anchors.housePile, 'PILE', 'center');
    put(anchors.houseVoidForm, 'VOID FORM', 'center', 0, -0.45);
    put(anchors.slab, `${inches(fdn.slabIn)} CONC. SLAB`);
    // GRADE is lettered by the painter at the window's own edge, since the
    // dashed line runs the width of whatever window it is seen through.
    return labels;
  };

  // ── THE SECTION AND ITS THREE WINDOWS, IN FEET ────────────────────────
  // y is elevation, up; x runs into the house from the outside face at 0.
  // 4 1/2 ft wide by 3 1/2 ft tall: room for a callout beside the wall, and
  // at 3/4" = 1'-0" the three stack down 11x17's short side; 1" on ARCH D.
  const DETAIL_W_FT = 4.5;
  const DETAIL_H_FT = 3.5;
  // Air to the left of the fascia for its callout.
  const LEFT_AIR_FT = 2.4;
  const buildWallSection = saved => {
    const values = wallSectionValues(saved);
    if (!values) return null;
    const PP = window.DraftProjectPage;
    const section = PP.buildWallSection(values);
    const { anchors, extents } = section;
    const fasciaFt = values.roof.fasciaIn / 12;
    // PROJECT's roofTruss: heel anchor stands fascia/2 + 0.8 above the eave.
    const eaveY = anchors.heel.y - fasciaFt / 2 - 0.8;
    const main = values.floors[0];
    const mainDepthFt = (main.framing === 'balloon' ? main.sheathingIn : main.joistDepthIn + main.sheathingIn) / 12;
    const fdnTop = -mainDepthFt;
    const concTop = fdnTop - values.foundation.attachmentIn / 12;
    const fdnBot = concTop - values.foundation.wallHeightFt;
    const footD = values.foundation.footingDepthIn / 12;
    const overhang = values.roof.overhangFt;
    const windows = {
      wallsection: { ...extents, minX: -overhang - LEFT_AIR_FT },
      eave: { minX: -overhang - 1.0, maxX: -overhang - 1.0 + DETAIL_W_FT,
        minY: eaveY - 1.1, maxY: eaveY - 1.1 + DETAIL_H_FT },
      floor: { minX: -1.4, maxX: -1.4 + DETAIL_W_FT,
        minY: concTop - 1.3, maxY: concTop - 1.3 + DETAIL_H_FT },
      footing: { minX: -1.5, maxX: -1.5 + DETAIL_W_FT,
        minY: fdnBot - footD - 0.8, maxY: fdnBot - footD - 0.8 + DETAIL_H_FT },
    };
    return { values, section, labels: labelsFor(values, anchors), windows };
  };

  const DETAIL_TITLES = Object.freeze({
    wallsection: 'TYP. WALL SECTION', eave: 'EAVE DETAIL', floor: 'FLOOR DETAIL', footing: 'FOOTING DETAIL',
  });
  const DETAIL_IDS = Object.freeze(Object.keys(DETAIL_TITLES));

  // ── THE PAINTER ────────────────────────────────────────────────────────
  // `window` is one of the rectangles above, in feet; it is laid into the
  // box at (x, y) px, `pxPerFt` to the foot, and clipped to it. `inkScale`
  // is paper units -- 1 at print, so lettering and line weights hold their
  // size on paper however the sheet is zoomed, the rule the plan painter
  // has kept since 11 Oct. Parts are PROJECT's own kinds: line, rect,
  // hatch, dashed, grade, break.
  const paintWallSection = (ctx, built, win, box, { pxPerFt, inkScale = 1, color = '#1d1f20', labels = true } = {}) => {
    const X = x => box.x + (x - win.minX) * pxPerFt;
    const Y = y => box.y + (win.maxY - y) * pxPerFt;
    const w = (win.maxX - win.minX) * pxPerFt, h = (win.maxY - win.minY) * pxPerFt;
    ctx.save();
    ctx.beginPath();
    ctx.rect(box.x, box.y, w, h);
    ctx.clip();
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineJoin = 'miter';
    ctx.lineCap = 'butt';
    const weight = value => Math.max(0.3, (value || 1.5) * 0.55 * inkScale);
    built.section.parts.forEach(part => {
      ctx.lineWidth = weight(part.weight);
      if (part.kind === 'line') {
        ctx.beginPath(); ctx.moveTo(X(part.x1), Y(part.y1)); ctx.lineTo(X(part.x2), Y(part.y2)); ctx.stroke();
      } else if (part.kind === 'rect') {
        ctx.strokeRect(X(part.x), Y(part.y + part.h), part.w * pxPerFt, part.h * pxPerFt);
      } else if (part.kind === 'hatch') {
        // CUT CONCRETE, at a paper pitch: 1/12" between diagonals on the
        // printed sheet, whatever the scale, so a pile reads as hatched at
        // 1/2" and at 1".
        const x0 = X(part.x), y0 = Y(part.y + part.h);
        const bw = part.w * pxPerFt, bh = part.h * pxPerFt;
        const pitch = Math.max(2, 6 * inkScale);
        ctx.save();
        ctx.beginPath(); ctx.rect(x0, y0, bw, bh); ctx.clip();
        ctx.lineWidth = weight(0.75);
        ctx.beginPath();
        for (let d = -bh; d < bw + bh; d += pitch) {
          ctx.moveTo(x0 + d, y0 + bh);
          ctx.lineTo(x0 + d + bh, y0);
        }
        ctx.stroke();
        ctx.restore();
      } else if (part.kind === 'dashed') {
        ctx.save();
        ctx.setLineDash([3 * inkScale, 3 * inkScale]);
        ctx.lineWidth = weight(1);
        ctx.beginPath(); ctx.moveTo(X(part.x1), Y(part.y1)); ctx.lineTo(X(part.x2), Y(part.y2)); ctx.stroke();
        ctx.restore();
      } else if (part.kind === 'grade') {
        ctx.save();
        ctx.setLineDash([4 * inkScale, 3 * inkScale]);
        ctx.lineWidth = weight(1);
        ctx.beginPath(); ctx.moveTo(box.x, Y(part.y)); ctx.lineTo(box.x + w, Y(part.y)); ctx.stroke();
        ctx.restore();
        // THE WORD UNDER THE LINE, at the left end (Movie, 17 Sep, on
        // PROJECT: "add the word (GRADE) just under the grade line on one of
        // the sides, lets go left side"), when the line is in the window.
        if (labels && part.y > win.minY && part.y < win.maxY) {
          ctx.save();
          ctx.font = `600 ${7 * inkScale}px 'Barlow Condensed', sans-serif`;
          ctx.textAlign = 'left';
          ctx.textBaseline = 'top';
          ctx.fillText('GRADE', box.x + 4 * inkScale, Y(part.y) + 2 * inkScale);
          ctx.restore();
        }
      } else if (part.kind === 'break') {
        const midY = (part.y1 + part.y2) / 2;
        ctx.lineWidth = weight(1);
        ctx.beginPath();
        ctx.moveTo(X(part.x), Y(part.y1));
        ctx.lineTo(X(part.x), Y(midY - 0.3));
        ctx.lineTo(X(part.x + 0.3), Y(midY - 0.1));
        ctx.lineTo(X(part.x - 0.3), Y(midY + 0.1));
        ctx.lineTo(X(part.x), Y(midY + 0.3));
        ctx.lineTo(X(part.x), Y(part.y2));
        ctx.stroke();
      }
    });
    if (labels) {
      // 7 pt lettering on paper: 7/72 of an inch, at 72 px to the inch.
      ctx.font = `600 ${7 * inkScale}px 'Barlow Condensed', sans-serif`;
      ctx.textBaseline = 'middle';
      built.labels.forEach(label => {
        const x = X(label.x), y = Y(label.y);
        if (x < box.x - 2 || x > box.x + w + 2 || y < box.y || y > box.y + h) return;
        ctx.textAlign = label.align;
        ctx.fillText(label.text, x, y);
      });
    }
    ctx.restore();
  };

  window.DraftWallSection = Object.freeze({
    ROOF_FASCIA_IN, HOUSE_CUT_FT, DETAIL_TITLES, DETAIL_IDS, DETAIL_W_FT, DETAIL_H_FT,
    wallSectionValues, buildWallSection, labelsFor, paintWallSection,
  });
})();
}
