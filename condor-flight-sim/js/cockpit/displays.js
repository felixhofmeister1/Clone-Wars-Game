/* =============================================================================
 * displays.js — A330 glass cockpit, drawn on canvases every frame:
 *   PFD  primary flight display (FMA, speed tape with VLS/α-prot/α-max/VMAX,
 *        attitude with FD bars, altitude & V/S tapes, heading, ILS scales)
 *   ND   navigation display (ARC / ROSE NAV, route, TOD, runway, wind)
 *   EWD  engine & warning display (N1/EGT, N2, FF, FOB, S/F, memos, warnings)
 *   SD   system display (WHEEL / CRUISE pages + permanent data)
 *   FCU  flight control unit, EFIS panels (with click/scroll hit regions)
 * The same canvases are used as textures in the 3D cockpit and as 2D panels.
 * ========================================================================== */
(function () {
  'use strict';
  const { D2R, R2D, KT, FT, NM, clamp, wrap180, wrap360 } = Geo;
  const COL = {
    green: '#1fe35a', cyan: '#2ddcff', magenta: '#ff52ff', amber: '#ffab1f', yellow: '#fff01f', white: '#f2f2f2',
    red: '#ff3434', sky: '#2385d8', ground: '#8b5a2b', grey: '#9aa0a6', tape: '#4a4f55', bg: '#040507',
  };
  const MONO = '"B612 Mono", "Consolas", "Menlo", monospace';
  const SANS = '"B612", "Arial", sans-serif';
  const font = (px, mono = true, weight = 400) => `${weight} ${px}px ${mono ? MONO : SANS}`;

  function mkCanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
  function txt(g, s, x, y, color, px = 18, align = 'center', base = 'middle', mono = true) {
    g.fillStyle = color; g.font = font(px, mono); g.textAlign = align; g.textBaseline = base; g.fillText(s, x, y);
  }
  function line(g, x1, y1, x2, y2, color, w = 2) { g.strokeStyle = color; g.lineWidth = w; g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke(); }
  function rrect(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
  const pad = (n, w) => String(Math.max(0, Math.round(n))).padStart(w, '0');
  const blink = () => (performance.now() % 1000) < 600;

  /* ================================================================== PFD */
  function drawPFD(g, S) {
    const { ac, fm } = S;
    const W = 512;
    g.fillStyle = COL.bg; g.fillRect(0, 0, W, W);
    const cx = 256, cy = 238;
    const ppd = 5.6; // pixels per degree of pitch
    const pitch = ac.pitch * R2D, roll = ac.roll * R2D;

    // ---------- attitude
    g.save();
    rrect(g, 142, 108, 228, 262, 18); g.clip();
    g.translate(cx, cy);
    g.rotate(-roll * D2R);
    const hy = pitch * ppd;
    g.fillStyle = COL.sky; g.fillRect(-400, -800 + hy, 800, 800);
    g.fillStyle = COL.ground; g.fillRect(-400, hy, 800, 800);
    line(g, -400, hy, 400, hy, COL.white, 2);
    g.lineWidth = 2; g.strokeStyle = COL.white; g.fillStyle = COL.white;
    for (let p = -30; p <= 30; p += 2.5) {
      if (p === 0) continue;
      const y = hy - p * ppd;
      if (Math.abs(y) > 150) continue;
      const w = p % 10 === 0 ? 46 : p % 5 === 0 ? 24 : 12;
      line(g, -w, y, w, y, COL.white, 2);
      if (p % 10 === 0) { txt(g, String(Math.abs(p)), -w - 14, y, COL.white, 15); txt(g, String(Math.abs(p)), w + 14, y, COL.white, 15); }
    }
    // Pitch attitude protection marks (green '=')
    for (const p of [30, -15]) { const y = hy - p * ppd; if (Math.abs(y) < 150) { line(g, -80, y - 3, -64, y - 3, COL.green, 2); line(g, -80, y + 3, -64, y + 3, COL.green, 2); line(g, 64, y - 3, 80, y - 3, COL.green, 2); line(g, 64, y + 3, 80, y + 3, COL.green, 2); } }
    g.restore();

    // Bank scale (fixed) and roll index
    g.save(); g.translate(cx, cy);
    g.strokeStyle = COL.white; g.lineWidth = 2;
    g.beginPath(); g.arc(0, 0, 122, (-90 - 45) * D2R, (-90 + 45) * D2R); g.stroke();
    for (const b of [-45, -30, -20, -10, 10, 20, 30, 45]) {
      const a = (-90 + b) * D2R, l = Math.abs(b) >= 30 ? 14 : 9;
      line(g, Math.cos(a) * 122, Math.sin(a) * 122, Math.cos(a) * (122 + l), Math.sin(a) * (122 + l), COL.white, 2);
    }
    for (const b of [-67, 67]) { const a = (-90 + b) * D2R; g.save(); g.rotate(a + Math.PI / 2); line(g, -4, -128, -4, -118, COL.green, 2); line(g, 4, -128, 4, -118, COL.green, 2); g.restore(); }
    // zero index
    g.fillStyle = COL.yellow; g.beginPath(); g.moveTo(0, -122); g.lineTo(-8, -136); g.lineTo(8, -136); g.closePath(); g.fill();
    // roll index + sideslip
    g.rotate(-roll * D2R);
    g.fillStyle = COL.yellow;
    g.beginPath(); g.moveTo(0, -120); g.lineTo(-9, -105); g.lineTo(9, -105); g.closePath(); g.fill();
    const beta = clamp(-ac.beta * R2D * 3, -12, 12);
    g.fillStyle = Math.abs(ac.beta * R2D) > 4 && !ac.onGround ? COL.amber : COL.yellow;
    g.fillRect(-9 + beta, -103, 18, 5);
    g.restore();

    // Aircraft symbol
    g.fillStyle = '#000'; g.strokeStyle = COL.yellow; g.lineWidth = 3;
    const wing = (sx) => { g.beginPath(); g.moveTo(cx + sx * 90, cy - 4); g.lineTo(cx + sx * 44, cy - 4); g.lineTo(cx + sx * 44, cy + 14); g.lineTo(cx + sx * 36, cy + 14); g.lineTo(cx + sx * 36, cy + 4); g.lineTo(cx + sx * 90, cy + 4); g.closePath(); g.fill(); g.stroke(); };
    wing(-1); wing(1);
    g.fillRect(cx - 5, cy - 5, 10, 10); g.strokeRect(cx - 5, cy - 5, 10, 10);

    // Flight director bars (green)
    if (fm.fcu.fd && (fm.fdPitch != null || fm.fdRoll != null) && !ac.crashed) {
      g.strokeStyle = COL.green; g.lineWidth = 3;
      if (fm.fdPitch != null) { const y = cy - clamp(fm.fdPitch, -20, 20) * ppd; line(g, cx - 70, y, cx + 70, y, COL.green, 3); }
      if (fm.fdRoll != null) { const x = cx + clamp(fm.fdRoll, -30, 30) * 2.6; line(g, x, cy - 70, x, cy + 70, COL.green, 3); }
    }

    // ---------- ILS deviation scales (magenta diamonds)
    const ils = fm.ils;
    const lsShown = S.efis.ls || fm.fcu.appr || fm.lat.startsWith('LOC') || fm.lat === 'LAND' || fm.lat === 'FLARE';
    if (lsShown && ils) {
      g.strokeStyle = COL.white; g.lineWidth = 2;
      for (const d of [-2, -1, 1, 2]) { g.beginPath(); g.arc(cx + d * 36, 378, 3.5, 0, Math.PI * 2); g.stroke(); g.beginPath(); g.arc(386, cy + d * 36, 3.5, 0, Math.PI * 2); g.stroke(); }
      line(g, cx, 370, cx, 386, COL.yellow, 3); line(g, 378, cy, 394, cy, COL.yellow, 3);
      if (ils.inRange) {
        const dia = (x, y, horiz) => { g.fillStyle = COL.magenta; g.beginPath(); if (horiz) { g.moveTo(x - 10, y); g.lineTo(x, y - 7); g.lineTo(x + 10, y); g.lineTo(x, y + 7); } else { g.moveTo(x, y - 10); g.lineTo(x + 7, y); g.lineTo(x, y + 10); g.lineTo(x - 7, y); } g.closePath(); g.fill(); };
        dia(cx - clamp(ils.locDots, -2.3, 2.3) * 36, 378, true);
        if (ils.gsValid || Math.abs(ils.gsDots) < 2.4) dia(386, cy - clamp(ils.gsDots, -2.3, 2.3) * 36, false);
        txt(g, ils.ident, 8, 440, COL.magenta, 15, 'left'); txt(g, ils.freq.toFixed(2), 8, 458, COL.magenta, 15, 'left');
        txt(g, `${ils.dme.toFixed(1)}NM`, 8, 476, COL.magenta, 15, 'left');
      }
    }

    // ---------- radio altitude
    const raFt = ac.ra / FT;
    if (raFt < 2500 && !ac.wowMain) {
      const v = raFt < 50 ? Math.round(raFt) : raFt < 500 ? Math.round(raFt / 5) * 5 : Math.round(raFt / 10) * 10;
      const dh = fm.minimums ? fm.minimums - fm.arrElevFt : 200;
      txt(g, String(Math.max(0, v)), cx, 352, raFt < dh + 0 ? COL.amber : COL.green, 24);
    }

    // ---------- speed tape
    const cas = ac.cas / KT;
    const sx0 = 36, sx1 = 108, sy0 = 100, sy1 = 376, ppk = 3.3;
    g.save(); g.beginPath(); g.rect(sx0, sy0, sx1 - sx0 + 20, sy1 - sy0); g.clip();
    g.fillStyle = COL.tape; g.fillRect(sx0, sy0, sx1 - sx0, sy1 - sy0);
    const yOf = (v) => cy - (v - Math.max(30, cas)) * ppk;
    const vmin = Math.max(30, cas) - 45, vmax = Math.max(30, cas) + 45;
    for (let v = Math.ceil(vmin / 10) * 10; v <= vmax; v += 10) {
      if (v < 30) continue;
      const y = yOf(v);
      line(g, sx1 - 12, y, sx1, y, COL.white, 2);
      if (v % 20 === 0) txt(g, pad(v, 3), sx1 - 16, y, COL.white, 17, 'right');
    }
    const cs = fm.cs || fm.charSpeeds();
    if (!ac.wowMain && ac.airTime > 10) {
      // VLS (amber), alpha-prot (black/amber), alpha-max (red)
      g.fillStyle = COL.amber; g.fillRect(sx1 - 3, yOf(cs.vls), 3, Math.max(0, yOf(cs.vaprot) - yOf(cs.vls)));
      for (let v = cs.vaprot; v > cs.vamax; v -= 4) { g.fillStyle = Math.floor(v / 4) % 2 ? COL.amber : '#000'; g.fillRect(sx1 - 6, yOf(v), 6, 4 * ppk); }
      g.fillStyle = COL.red; g.fillRect(sx1 - 7, yOf(cs.vamax), 7, sy1 - yOf(cs.vamax) + 10);
    }
    // VMAX barber pole
    for (let v = cs.vmax; v < vmax + 10; v += 4) { g.fillStyle = Math.floor(v / 4) % 2 ? COL.red : '#000'; g.fillRect(sx1 - 6, yOf(v + 4), 6, 4 * ppk); }
    // Characteristic speeds
    if (fm.phase === 'preflight' || (fm.phase === 'takeoff' && ac.wowMain)) {
      txt(g, '1', sx1 + 8, yOf(fm.perf.v1), COL.cyan, 16);
      g.fillStyle = COL.cyan; g.beginPath(); g.arc(sx1 + 4, yOf(fm.perf.vr), 4, 0, Math.PI * 2); g.fill();
    } else if (!ac.wowMain) {
      if (ac.conf === 0) { g.strokeStyle = COL.green; g.lineWidth = 2.5; g.beginPath(); g.arc(sx1 + 5, yOf(cs.gd), 5, 0, Math.PI * 2); g.stroke(); }
      if (ac.conf === 1 || ac.conf === 2) txt(g, 'S', sx1 + 8, yOf(cs.s), COL.green, 16);
      if (ac.conf === 3 || ac.conf === 4) txt(g, 'F', sx1 + 8, yOf(cs.f), COL.green, 16);
      if (cs.vfeNext) { line(g, sx1 - 2, yOf(cs.vfeNext) - 2, sx1 + 8, yOf(cs.vfeNext) - 2, COL.amber, 2); line(g, sx1 - 2, yOf(cs.vfeNext) + 2, sx1 + 8, yOf(cs.vfeNext) + 2, COL.amber, 2); }
    }
    // Target speed
    const tgt = fm.lastTarget || cas;
    const tcol = fm.fcu.spdManaged ? COL.magenta : COL.cyan;
    const ty = yOf(tgt);
    if (ty < sy0 + 4) txt(g, String(Math.round(tgt)), sx1 - 30, sy0 + 10, tcol, 17);
    else if (ty > sy1 - 4) txt(g, String(Math.round(tgt)), sx1 - 30, sy1 - 10, tcol, 17);
    else { g.fillStyle = tcol; g.beginPath(); g.moveTo(sx1 + 2, ty); g.lineTo(sx1 + 16, ty - 8); g.lineTo(sx1 + 16, ty + 8); g.closePath(); g.fill(); }
    // Speed trend (10 s)
    const trend = (fm.casAccF || 0) * 10;
    if (Math.abs(trend) > 2 && !ac.wowMain) {
      const y2 = yOf(cas + trend);
      line(g, sx1 - 24, cy, sx1 - 24, y2, COL.yellow, 2.5);
      g.fillStyle = COL.yellow; g.beginPath(); g.moveTo(sx1 - 24, y2); g.lineTo(sx1 - 30, y2 + Math.sign(trend) * 9); g.lineTo(sx1 - 18, y2 + Math.sign(trend) * 9); g.closePath(); g.fill();
    }
    g.restore();
    // Speed reference (yellow)
    line(g, sx0 - 6, cy, sx1 + 12, cy, COL.yellow, 4);
    g.fillStyle = COL.yellow; g.beginPath(); g.moveTo(sx1 + 4, cy); g.lineTo(sx1 + 16, cy - 7); g.lineTo(sx1 + 16, cy + 7); g.closePath(); g.fill();
    if (ac.mach > 0.5) txt(g, '.' + String(Math.round(ac.mach * 1000)).padStart(3, '0').slice(0, 3), 70, 400, COL.green, 20);

    // ---------- altitude tape
    const altFt = ac.alt / FT;
    const ax0 = 404, ax1 = 462, ppf = 0.24;
    g.save(); g.beginPath(); g.rect(ax0 - 10, sy0, ax1 - ax0 + 16, sy1 - sy0); g.clip();
    g.fillStyle = COL.tape; g.fillRect(ax0, sy0, ax1 - ax0, sy1 - sy0);
    const aY = (a) => cy - (a - altFt) * ppf;
    for (let a = Math.ceil((altFt - 650) / 100) * 100; a <= altFt + 650; a += 100) {
      const y = aY(a);
      line(g, ax0, y, ax0 + (a % 500 === 0 ? 12 : 7), y, COL.white, 2);
      if (a % 500 === 0) txt(g, pad(Math.abs(a) / 100, 3), ax0 + 16, y, COL.white, 17, 'left');
    }
    // Ground reference ribbon
    const gndFt = (ac.alt - ac.ra) / FT;
    if (altFt - gndFt < 650) { g.fillStyle = COL.red; g.fillRect(ax0 - 8, aY(gndFt), 8, sy1 - aY(gndFt) + 20); }
    // Selected altitude
    const sel = fm.fcu.alt;
    const selCol = ['CLB', 'DES', 'ALT CST'].includes(fm.vert) ? COL.magenta : COL.cyan;
    const sy = aY(sel);
    if (sy > sy0 + 10 && sy < sy1 - 10) { g.strokeStyle = selCol; g.lineWidth = 2; g.strokeRect(ax0 + 1, sy - 16, ax1 - ax0 - 2, 32); }
    g.restore();
    if (sy <= sy0 + 10) txt(g, String(sel), (ax0 + ax1) / 2, sy0 - 12, selCol, 17);
    else if (sy >= sy1 - 10) txt(g, String(sel), (ax0 + ax1) / 2, sy1 + 12, selCol, 17);
    // Altitude readout box with rolling tens
    g.fillStyle = '#000'; g.fillRect(ax0 - 4, cy - 20, 70, 40);
    g.strokeStyle = COL.yellow; g.lineWidth = 2; g.strokeRect(ax0 - 4, cy - 20, 70, 40);
    const hundreds = Math.floor(Math.abs(altFt) / 100);
    const tens = Math.abs(altFt) % 100;
    txt(g, (altFt < 0 ? '-' : '') + String(hundreds).padStart(3, ' '), ax0 + 38, cy, COL.green, 24, 'right');
    g.save(); g.beginPath(); g.rect(ax0 + 38, cy - 19, 26, 38); g.clip();
    const t20 = Math.floor(tens / 20) * 20, frac = (tens - t20) / 20;
    for (let k = -1; k <= 1; k++) {
      const v = (t20 + k * 20 + 100) % 100;
      txt(g, pad(v, 2), ax0 + 51, cy + frac * 22 - k * 22, COL.green, 17);
    }
    g.restore();
    // Baro
    txt(g, fm.fcu.baroStd ? 'STD' : `QNH ${fm.fcu.qnh}`, 432, 400, COL.cyan, 17);
    if (fm.fcu.baroStd) { g.strokeStyle = COL.yellow; g.lineWidth = 1.5; g.strokeRect(410, 389, 44, 22); }

    // ---------- vertical speed
    const vsFpm = ac.vs / FT * 60;
    const vx = 482;
    g.fillStyle = COL.tape; g.beginPath(); g.moveTo(vx - 12, sy0 + 20); g.lineTo(vx + 14, sy0 + 50); g.lineTo(vx + 14, sy1 - 50); g.lineTo(vx - 12, sy1 - 20); g.closePath(); g.fill();
    const vsY = (v) => { const a = Math.abs(v), sgn = -Math.sign(v); const d = a <= 1000 ? a * 0.055 : a <= 2000 ? 55 + (a - 1000) * 0.035 : 90 + Math.min(4000, a - 2000) * 0.009; return cy + sgn * d; };
    for (const v of [-6000, -2000, -1000, -500, 500, 1000, 2000, 6000]) line(g, vx - 12, vsY(v), vx - 4, vsY(v), COL.white, 2);
    for (const v of [-6, -2, -1, 1, 2, 6]) txt(g, String(Math.abs(v)), vx - 20, vsY(v * 1000), COL.white, 13);
    const vsCol = Math.abs(vsFpm) > 6000 || (raFt < 1000 && vsFpm < -1200 && !ac.wowMain) ? COL.amber : COL.green;
    line(g, vx + 16, cy, vx - 8, vsY(vsFpm), vsCol, 3);
    if (Math.abs(vsFpm) > 200) {
      const y = vsY(vsFpm) + (vsFpm > 0 ? -12 : 12);
      g.fillStyle = '#000'; g.fillRect(vx - 10, y - 9, 26, 18);
      txt(g, pad(Math.abs(vsFpm) / 100, 2), vx + 3, y, vsCol, 15);
    }

    // ---------- heading tape
    const hdgM = wrap360(ac.heading * R2D - Geo.magvar(ac.lat, ac.lon));
    const trkM = wrap360(ac.track * R2D - Geo.magvar(ac.lat, ac.lon));
    const hx0 = 150, hx1 = 362, hyy = 424, pph = 7.2;
    g.save(); g.beginPath(); g.rect(hx0, hyy - 20, hx1 - hx0, 46); g.clip();
    g.fillStyle = COL.tape; g.fillRect(hx0, hyy - 20, hx1 - hx0, 40);
    for (let h = Math.floor(hdgM / 5) * 5 - 20; h <= hdgM + 20; h += 5) {
      const x = cx + wrap180(h - hdgM) * pph;
      line(g, x, hyy - 20, x, hyy - 20 + (h % 10 === 0 ? 10 : 6), COL.white, 2);
      if (h % 10 === 0) { const lbl = pad(wrap360(h) / 10, 2) === '36' ? '36' : pad(wrap360(h) / 10 % 36, 2); txt(g, lbl === '00' ? '36' : lbl, x, hyy + 4, COL.white, h % 30 === 0 ? 18 : 14); }
    }
    // Track diamond
    if (ac.gs > 20 * KT) { const tx = cx + wrap180(trkM - hdgM) * pph; g.strokeStyle = COL.green; g.lineWidth = 2; g.beginPath(); g.moveTo(tx, hyy - 20); g.lineTo(tx + 6, hyy - 13); g.lineTo(tx, hyy - 6); g.lineTo(tx - 6, hyy - 13); g.closePath(); g.stroke(); }
    // Selected heading
    if (!fm.fcu.hdgManaged || fm.lat === 'HDG') { const sx = cx + clamp(wrap180(fm.fcu.hdg - hdgM) * pph, -104, 104); g.fillStyle = COL.cyan; g.beginPath(); g.moveTo(sx, hyy - 20); g.lineTo(sx - 7, hyy - 32 + 12 - 12); g.lineTo(sx + 7, hyy - 20 - 0); g.closePath(); g.fill(); g.fillRect(sx - 1, hyy - 20, 2, 10); }
    // ILS course
    if (lsShown && ils) { const ix = cx + wrap180(ils.course - hdgM) * pph; if (Math.abs(ix - cx) < 104) { line(g, ix, hyy - 20, ix, hyy + 6, COL.magenta, 3); } }
    g.restore();
    line(g, cx, hyy - 28, cx, hyy - 12, COL.yellow, 4);

    // ---------- FMA
    drawFMA(g, S);
    // ---------- warnings on PFD
    if (fm.stallWarn) txt(g, 'STALL', cx, 290, blink() ? COL.red : COL.bg, 30);
    if (fm.overspeedWarn) txt(g, 'OVERSPEED', cx, 290, blink() ? COL.red : COL.bg, 26);
    if (ac.crashed) { g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillRect(0, 0, W, W); txt(g, 'INOP', cx, cy, COL.red, 40); }
  }

  function drawFMA(g, S) {
    const { ac, fm } = S;
    const cols = [0, 104, 206, 306, 410, 512];
    g.fillStyle = COL.bg; g.fillRect(0, 0, 512, 76);
    for (let i = 1; i < 5; i++) line(g, cols[i], 6, cols[i], 70, COL.grey, 1.5);
    line(g, 0, 76, 512, 76, COL.grey, 1);
    const cx = (i) => (cols[i] + cols[i + 1]) / 2;
    const boxed = (s, i, row, color) => { const y = 16 + row * 22; txt(g, s, cx(i), y, color, 16); if (fm.modeBox?.[s] && performance.now() - fm.modeBox[s] < 10000) { g.strokeStyle = COL.white; g.lineWidth = 1.5; const w = g.measureText(s).width + 10; g.strokeRect(cx(i) - w / 2, y - 10, w, 20); } };
    // Col 1: A/THR
    if (fm.athrMode) {
      const lvr = fm.lvrClb;
      if (lvr) { if (blink()) txt(g, 'LVR CLB', cx(0), 38, COL.white, 16); }
      else if (fm.athrMode.startsWith('MAN')) { const parts = fm.athrMode.split(' '); txt(g, parts[0], cx(0), 16, COL.white, 16); txt(g, parts.slice(1).join(' '), cx(0), 38, COL.cyan, 16); g.strokeStyle = COL.white; g.strokeRect(cols[0] + 8, 5, 88, 44); }
      else boxed(fm.athrMode, 0, 0, fm.athrMode === 'A.FLOOR' || fm.athrMode === 'TOGA LK' ? COL.green : COL.green);
      if (fm.athrMode === 'A.FLOOR' || fm.athrMode === 'TOGA LK') { g.strokeStyle = COL.amber; g.strokeRect(cols[0] + 8, 5, 88, 24); }
    }
    // Col 2: vertical
    if (fm.vert) boxed(fm.vert, 1, 0, COL.green);
    if (fm.vertArmed.length) txt(g, fm.vertArmed.join(' '), cx(1), 38, COL.cyan, 15);
    // Col 3: lateral
    if (fm.lat) boxed(fm.lat, 2, 0, COL.green);
    if (fm.latArmed.length) txt(g, fm.latArmed.join(' '), cx(2), 38, COL.cyan, 15);
    // Row 3 messages
    let msg = null, mcol = COL.white;
    if (fm.moreDrag) msg = 'MORE DRAG';
    else if (fm.phase === 'approach' && fm.vert === 'DES' && !fm.decelShown) msg = 'DECELERATE';
    else if (ac.controls.law === 'direct' && !ac.wowMain) { msg = 'USE MAN PITCH TRIM'; mcol = COL.amber; }
    if (msg) txt(g, msg, (cols[1] + cols[3]) / 2, 62, mcol, 15);
    // Col 4: approach capability & minimums
    if (fm.fcu.appr || fm.vert.startsWith('G/S') || fm.vert === 'LAND' || fm.vert === 'FLARE') {
      const dual = fm.fcu.ap1 && fm.fcu.ap2;
      txt(g, fm.fcu.ap1 || fm.fcu.ap2 ? 'CAT 3' : 'CAT 1', cx(3), 16, COL.white, 15);
      txt(g, dual ? 'DUAL' : fm.fcu.ap1 || fm.fcu.ap2 ? 'SINGLE' : '', cx(3), 38, COL.white, 15);
      txt(g, `DH ${Math.round((fm.minimums || 200) - fm.arrElevFt)}`, cx(3), 60, COL.cyan, 14);
    }
    // Col 5: engagement status
    const ap = fm.fcu.ap1 && fm.fcu.ap2 ? 'AP1+2' : fm.fcu.ap1 ? 'AP1' : fm.fcu.ap2 ? 'AP2' : '';
    if (ap) txt(g, ap, cx(4), 16, COL.white, 16);
    if (fm.fcu.fd) txt(g, '1 FD 2', cx(4), 38, COL.white, 16);
    if (fm.athrActive) txt(g, 'A/THR', cx(4), 60, COL.white, 16);
    else if (fm.athrArmed) txt(g, 'A/THR', cx(4), 60, COL.cyan, 16);
  }

  /* =================================================================== ND */
  function drawND(g, S) {
    const { ac, fm, plan, efis } = S;
    const W = 512;
    g.fillStyle = COL.bg; g.fillRect(0, 0, W, W);
    const rose = efis.ndMode === 'ROSE';
    const cx = 256, cy = rose ? 262 : 424;
    const R = rose ? 180 : 330;
    const rangeNm = efis.range;
    const ppn = R / rangeNm;
    const mv = Geo.magvar(ac.lat, ac.lon);
    const hdgT = ac.heading * R2D, hdgM = wrap360(hdgT - mv), trkT = ac.track * R2D;
    const toXY = (lat, lon) => {
      const d = Geo.distance(ac.lat, ac.lon, lat, lon) / NM;
      const b = Geo.bearing(ac.lat, ac.lon, lat, lon);
      const a = (b - hdgT) * D2R;
      return [cx + Math.sin(a) * d * ppn, cy - Math.cos(a) * d * ppn, d];
    };

    // Clip to the display area
    g.save();
    g.beginPath(); g.rect(0, 60, W, W - 110); g.clip();

    // Range rings
    g.strokeStyle = COL.white; g.lineWidth = 1.5; g.setLineDash([6, 8]);
    for (const f of rose ? [0.5] : [0.25, 0.5, 0.75]) { g.beginPath(); g.arc(cx, cy, R * f, 0, Math.PI * 2); g.stroke(); }
    g.setLineDash([]);
    txt(g, String(rangeNm / (rose ? 2 : 2)), cx - R * 0.5 * 0.72 - 14, cy - R * 0.5 * 0.72, COL.cyan, 14);

    // Route
    if (plan) {
      const wps = plan.wps;
      const pts = wps.map((w) => toXY(w.lat, w.lon));
      g.lineWidth = 2.5;
      for (let i = Math.max(1, fm.active - 1); i < wps.length; i++) {
        const a = i === fm.active ? [cx, cy] : pts[i - 1], b = pts[i];
        if (i < fm.active) continue;
        // Long legs: draw as great-circle polyline
        const A = i === fm.active ? { lat: ac.lat, lon: ac.lon } : wps[i - 1], B = wps[i];
        const len = Geo.distance(A.lat, A.lon, B.lat, B.lon) / NM;
        const n = Math.min(24, Math.max(1, Math.ceil(len / (rangeNm * 0.25))));
        g.strokeStyle = i === fm.active ? COL.green : COL.green;
        g.beginPath();
        for (let k = 0; k <= n; k++) {
          const p = Geo.intermediate(A.lat, A.lon, B.lat, B.lon, k / n);
          const [x, y] = toXY(p.lat, p.lon);
          if (k === 0) g.moveTo(x, y); else g.lineTo(x, y);
        }
        g.stroke();
      }
      // Waypoints
      for (let i = fm.active; i < wps.length; i++) {
        const [x, y, d] = pts[i];
        if (d > rangeNm * 1.6) continue;
        const w = wps[i];
        const isRwy = w.kind === 'rwy-arr';
        g.strokeStyle = i === fm.active ? COL.white : COL.green; g.lineWidth = 2;
        if (!isRwy) { g.beginPath(); g.moveTo(x, y - 7); g.lineTo(x + 7, y); g.lineTo(x, y + 7); g.lineTo(x - 7, y); g.closePath(); g.stroke(); }
        txt(g, w.ident, x + 12, y - 2, i === fm.active ? COL.white : COL.green, 14, 'left');
        if (w.altCstr && i >= fm.active) txt(g, (w.cstrType === 'above' ? '+' : '') + w.altCstr, x + 12, y + 14, COL.magenta, 12, 'left');
      }
      // Destination runway
      const rw = plan.arrRwy;
      const [tx, ty, td] = toXY(rw.thr.lat, rw.thr.lon);
      if (td < rangeNm * 1.5) {
        const [fx, fy] = toXY(rw.far.lat, rw.far.lon);
        const dx = fx - tx, dy = fy - ty, l = Math.hypot(dx, dy) || 1, nx = -dy / l * 3, ny = dx / l * 3;
        g.strokeStyle = COL.white; g.lineWidth = 2;
        g.beginPath(); g.moveTo(tx + nx, ty + ny); g.lineTo(fx + nx, fy + ny); g.lineTo(fx - nx, fy - ny); g.lineTo(tx - nx, ty - ny); g.closePath(); g.stroke();
        g.setLineDash([10, 8]); line(g, tx, ty, tx - dx / l * 9 * NM / 1852 * ppn, ty - dy / l * 9 * ppn, COL.white, 1.5); g.setLineDash([]);
        txt(g, `${plan.arr.icao}${rw.id}`, tx + 14, ty + 14, COL.white, 13, 'left');
      }
      // TOD pseudo waypoint
      if (fm.phase === 'climb' || fm.phase === 'cruise') {
        const p = pointAlong(plan, plan.todDist);
        if (p) { const [x, y, d] = toXY(p.lat, p.lon); if (d < rangeNm * 1.3) { g.strokeStyle = COL.magenta; g.lineWidth = 2.5; g.beginPath(); g.moveTo(x - 10, y - 8); g.lineTo(x + 4, y - 8); g.lineTo(x + 10, y); g.stroke(); line(g, x + 10, y, x + 3, y - 2, COL.magenta, 2.5); txt(g, 'T/D', x + 12, y - 12, COL.magenta, 12, 'left'); } }
      }
      // Airports
      for (const ap of [plan.dep, plan.arr]) {
        const [x, y, d] = toXY(ap.lat, ap.lon);
        if (d > rangeNm * 1.4 || d < 3) continue;
        g.strokeStyle = COL.magenta; g.lineWidth = 2;
        for (let k = 0; k < 4; k++) { const a = k * Math.PI / 4; line(g, x - Math.cos(a) * 8, y - Math.sin(a) * 8, x + Math.cos(a) * 8, y + Math.sin(a) * 8, COL.magenta, 2); }
        txt(g, ap.icao, x + 12, y + 2, COL.magenta, 13, 'left');
      }
    }
    g.restore();

    // Compass
    g.save(); g.translate(cx, cy);
    g.strokeStyle = COL.white; g.lineWidth = 2;
    if (rose) { g.beginPath(); g.arc(0, 0, R, 0, Math.PI * 2); g.stroke(); }
    else { g.beginPath(); g.arc(0, 0, R, (-90 - 50) * D2R, (-90 + 50) * D2R); g.stroke(); }
    for (let h = 0; h < 360; h += 5) {
      const rel = wrap180(h - hdgM);
      if (!rose && Math.abs(rel) > 50) continue;
      const a = (rel - 90) * D2R, l = h % 10 === 0 ? 12 : 6;
      line(g, Math.cos(a) * R, Math.sin(a) * R, Math.cos(a) * (R - l), Math.sin(a) * (R - l), COL.white, 2);
      if (h % 30 === 0 || (!rose && h % 10 === 0)) {
        g.save(); g.rotate(rel * D2R); txt(g, String(h / 10), 0, -R - 14, COL.white, h % 30 === 0 ? 18 : 14); g.restore();
      }
    }
    // Selected heading (cyan) and ILS course (magenta)
    if (!fm.fcu.hdgManaged || fm.lat === 'HDG') { g.save(); g.rotate(wrap180(fm.fcu.hdg - hdgM) * D2R); g.fillStyle = COL.cyan; g.beginPath(); g.moveTo(0, -R); g.lineTo(-7, -R - 14); g.lineTo(7, -R - 14); g.closePath(); g.fill(); g.restore(); }
    const ils = fm.ils;
    if ((S.efis.ls || fm.fcu.appr || fm.lat.startsWith('LOC')) && ils) {
      g.save(); g.rotate(wrap180(ils.course - hdgM) * D2R);
      line(g, 0, -R + 8, 0, -R * 0.35, COL.magenta, 3); line(g, 0, R * 0.35, 0, R - 8, COL.magenta, 3);
      if (ils.inRange) { const dev = clamp(-ils.locDots, -2.2, 2.2) * 22; line(g, dev, -R * 0.3, dev, R * 0.3, COL.magenta, 3); }
      g.restore();
    }
    // Track diamond
    if (ac.gs > 20 * KT) { g.save(); g.rotate(wrap180(trkT - hdgT) * D2R); g.strokeStyle = COL.green; g.lineWidth = 2; g.beginPath(); g.moveTo(0, -R + 2); g.lineTo(6, -R + 11); g.lineTo(0, -R + 20); g.lineTo(-6, -R + 11); g.closePath(); g.stroke(); g.restore(); }
    g.restore();
    // Lubber line & aircraft symbol
    line(g, cx, cy - R - 26, cx, cy - R + 4, COL.yellow, 4);
    g.strokeStyle = COL.yellow; g.lineWidth = 4;
    line(g, cx, cy - 18, cx, cy + 22, COL.yellow, 4); line(g, cx - 22, cy - 2, cx + 22, cy - 2, COL.yellow, 4); line(g, cx - 9, cy + 18, cx + 9, cy + 18, COL.yellow, 4);

    // Header data
    const tasKt = ac.tas / KT, gsKt = ac.gs / KT;
    txt(g, 'GS', 8, 18, COL.white, 15, 'left'); txt(g, String(Math.round(gsKt)), 36, 18, COL.green, 18, 'left');
    txt(g, 'TAS', 88, 18, COL.white, 15, 'left'); txt(g, String(Math.round(tasKt)), 124, 18, COL.green, 18, 'left');
    const w = ac.windNED || [0, 0, 0];
    const wspd = Math.hypot(w[0], w[1]) / KT;
    if (wspd > 2 && !ac.wowMain) {
      const wdir = wrap360(Math.atan2(-w[1], -w[0]) * R2D - mv);
      txt(g, `${pad(wdir, 3)}/${Math.round(wspd)}`, 8, 40, COL.green, 16, 'left');
      g.save(); g.translate(28, 70); g.rotate((wdir + 180 - hdgM) * D2R); line(g, 0, -12, 0, 12, COL.green, 2.5); line(g, 0, 12, -5, 5, COL.green, 2.5); line(g, 0, 12, 5, 5, COL.green, 2.5); g.restore();
    }
    if (plan && plan.wps[fm.active]) {
      const wp = plan.wps[fm.active];
      const d = Geo.distance(ac.lat, ac.lon, wp.lat, wp.lon) / NM;
      const brg = wrap360(Geo.bearing(ac.lat, ac.lon, wp.lat, wp.lon) - mv);
      txt(g, wp.ident, 380, 18, COL.white, 17, 'left');
      txt(g, `${pad(brg, 3)}°`, 470, 18, COL.green, 16, 'left');
      txt(g, d < 20 ? d.toFixed(1) : String(Math.round(d)), 450, 40, COL.green, 17, 'right'); txt(g, 'NM', 456, 40, COL.cyan, 14, 'left');
      const eta = new Date(S.utc.getTime() + (d / Math.max(gsKt, 60)) * 3600e3);
      txt(g, `${pad(eta.getUTCHours(), 2)}:${pad(eta.getUTCMinutes(), 2)}`, 500, 62, COL.green, 16, 'right');
    }
    if (ils && (fm.fcu.appr || S.efis.ls || fm.phase === 'approach')) {
      txt(g, `ILS ${ils.freq.toFixed(2)}`, 8, 470, COL.magenta, 15, 'left'); txt(g, `CRS ${pad(ils.course, 3)}°`, 8, 490, COL.magenta, 15, 'left');
      txt(g, ils.ident, 130, 470, COL.magenta, 15, 'left');
    }
    txt(g, rose ? 'ROSE NAV' : 'ARC', 504, 490, COL.white, 13, 'right');
    txt(g, `${rangeNm} NM`, 504, 470, COL.cyan, 13, 'right');
    if (fm.gpws) { txt(g, fm.gpws === 'PULL UP' || fm.gpws === 'TERRAIN' ? 'PULL UP' : '', 256, 470, COL.red, 22); }
  }

  function pointAlong(plan, dist) {
    const w = plan.wps;
    for (let i = 1; i < w.length; i++) {
      if (w[i].dist >= dist) {
        const a = w[i - 1], b = w[i];
        const f = (dist - a.dist) / Math.max(1, b.dist - a.dist);
        return Geo.intermediate(a.lat, a.lon, b.lat, b.lon, clamp(f, 0, 1));
      }
    }
    return null;
  }

  /* ================================================================== EWD */
  function gauge(g, x, y, r, frac, digits, color, limitFrac, cmdFrac) {
    const a0 = 200 * D2R, a1 = -20 * D2R; // canvas angles (clockwise from +x), sweep 220°
    const ang = (f) => Math.PI - a0 + (a0 - a1) * f; // f 0..1
    g.strokeStyle = COL.white; g.lineWidth = 2.5;
    g.beginPath(); g.arc(x, y, r, Math.PI - a0, Math.PI - a0 + (a0 - a1) * 1.0); g.stroke();
    for (let k = 0; k <= 10; k++) { const a = ang(k / 10); line(g, x + Math.cos(a) * r, y + Math.sin(a) * r, x + Math.cos(a) * (r - (k % 2 ? 5 : 9)), y + Math.sin(a) * (r - (k % 2 ? 5 : 9)), COL.white, 2); }
    if (limitFrac != null) { const a = ang(limitFrac); line(g, x + Math.cos(a) * (r - 2), y + Math.sin(a) * (r - 2), x + Math.cos(a) * (r + 10), y + Math.sin(a) * (r + 10), COL.amber, 3); }
    if (cmdFrac != null) { const a = ang(cmdFrac); g.strokeStyle = COL.cyan; g.lineWidth = 2; g.beginPath(); g.arc(x + Math.cos(a) * (r + 8), y + Math.sin(a) * (r + 8), 4, 0, Math.PI * 2); g.stroke(); }
    const a = ang(clamp(frac, 0, 1.05));
    line(g, x, y, x + Math.cos(a) * (r - 4), y + Math.sin(a) * (r - 4), color, 3.5);
    g.fillStyle = '#000'; g.fillRect(x - 6, y - 2, 70, 30);
    g.strokeStyle = COL.grey; g.lineWidth = 1.5; g.strokeRect(x - 4, y, 66, 26);
    txt(g, digits, x + 58, y + 14, color, 20, 'right');
  }

  function drawEWD(g, S) {
    const { ac, fm } = S;
    g.fillStyle = COL.bg; g.fillRect(0, 0, 512, 512);
    const r = ac.ratings || {};
    // Thrust limit
    const lever = ac.controls.throttle;
    let lim = 'CLB', limN1 = 89.5;
    if (lever > 0.95) { lim = 'TOGA'; limN1 = 95.0; } else if (lever > 0.7) { lim = fm.flexTo && ac.airTime < 600 ? 'FLX' : 'MCT'; limN1 = fm.flexTo ? 21 + 74 * Math.sqrt(clamp(((r.flx || 0) - ac.idleThrust) / Math.max(1, (r.toga || 1) - ac.idleThrust), 0, 1)) : 93.5; }
    else if (!ac.wowMain) { lim = 'CLB'; limN1 = 21 + 74 * Math.sqrt(0.87); }
    txt(g, lim, 380, 22, COL.cyan, 18, 'left');
    txt(g, limN1.toFixed(1), 470, 22, COL.green, 18, 'left'); txt(g, '%', 506, 22, COL.cyan, 14, 'left');
    if (lim === 'FLX') txt(g, `${Math.round(ac.flexTemp)}°C`, 470, 44, COL.green, 16, 'left');
    ac.engines.forEach((e, i) => {
      const x = i ? 300 : 110;
      txt(g, 'N1', x + 36, 150, COL.white, 14); txt(g, '%', x + 36, 166, COL.cyan, 12);
      gauge(g, x, 110, 60, e.n1 / 110, e.n1.toFixed(1), ac.fuel > 0 ? COL.green : COL.amber, limN1 / 110, lever > 0 ? (21 + 74 * Math.sqrt(clamp(lever, 0, 1))) / 110 : null);
      gauge(g, x, 230, 46, clamp((e.egt - 0) / 1100, 0, 1), String(Math.round(e.egt)), e.egt > 950 ? COL.amber : COL.green, 950 / 1100, null);
      txt(g, 'EGT', x + 36, 268, COL.white, 14); txt(g, '°C', x + 36, 284, COL.cyan, 12);
      txt(g, e.n2.toFixed(1), x + 30, 312, COL.green, 20, 'right'); txt(g, 'N2', x + 64, 312, COL.white, 13, 'left');
      txt(g, String(Math.round(e.ff * 3600 / 10) * 10), x + 30, 340, COL.green, 20, 'right'); txt(g, 'FF', x + 64, 340, COL.white, 13, 'left');
      if (e.rev > 0.05) { g.fillStyle = e.rev > 0.95 ? COL.green : COL.amber; g.font = font(16); txt(g, 'REV', x + 14, 70, e.rev > 0.95 ? COL.green : COL.amber, 16); }
    });
    txt(g, 'KG/H', 256, 340, COL.cyan, 12);
    // FOB
    txt(g, 'FOB :', 12, 380, COL.white, 16, 'left'); txt(g, String(Math.round(ac.fuel / 10) * 10), 150, 380, COL.green, 20, 'right'); txt(g, 'KG', 156, 380, COL.cyan, 13, 'left');
    // Slats/flaps
    const sfx = 360, sfy = 372;
    txt(g, 'S', sfx - 70, sfy - 16, COL.white, 14); txt(g, 'F', sfx + 76, sfy - 16, COL.white, 14);
    g.fillStyle = COL.white; g.beginPath(); g.moveTo(sfx - 16, sfy - 6); g.lineTo(sfx + 16, sfy - 6); g.lineTo(sfx + 20, sfy + 2); g.lineTo(sfx - 20, sfy + 2); g.closePath(); g.fill();
    const slF = ac.slat / 23, flF = ac.flap / 32;
    for (let k = 1; k <= 3; k++) { g.fillStyle = COL.white; g.beginPath(); g.arc(sfx - 26 - k * 15, sfy + k * 6, 2.5, 0, Math.PI * 2); g.fill(); g.beginPath(); g.arc(sfx + 26 + k * 18, sfy + k * 7, 2.5, 0, Math.PI * 2); g.fill(); }
    const moving = Math.abs(ac.slat - ac.P.confs[ac.conf].slat) > 0.2 || Math.abs(ac.flap - ac.P.confs[ac.conf].flap) > 0.2;
    const sfCol = moving ? COL.cyan : COL.green;
    line(g, sfx - 22, sfy, sfx - 22 - slF * 50, sfy + slF * 20, sfCol, 5);
    line(g, sfx + 22, sfy, sfx + 22 + flF * 60, sfy + flF * 24, sfCol, 5);
    txt(g, ac.conf ? ac.P.confs[ac.conf].name : '0', sfx, sfy + 30, sfCol, 18);
    // Memo / warnings
    line(g, 0, 404, 512, 404, COL.grey, 1.5);
    const warnings = [];
    if (fm.configWarning) warnings.push([fm.configWarning, COL.red]);
    if (fm.stallWarn) warnings.push(['STALL', COL.red]);
    if (fm.overspeedWarn) warnings.push([`OVERSPEED  VMAX ${Math.round(fm.cs?.vmax || 0)}`, COL.red]);
    if (ac.fuel < 3000) warnings.push(['FUEL LO LEVEL', COL.amber]);
    if (!ac.wowMain && ac.spoilerSB > 0.1 && (ac.controls.throttle > 0.62 || ac.conf >= 4)) warnings.push(['SPEED BRAKES STILL OUT', COL.amber]);
    if (fm.apOffWarn && performance.now() - fm.apOffWarn < 5000) warnings.push(['AUTO FLT AP OFF', COL.red]);
    if (fm.athrOffWarn && performance.now() - fm.athrOffWarn < 5000) warnings.push(['AUTO FLT A/THR OFF', COL.amber]);
    let y = 422;
    if (warnings.length) {
      for (const [w, c] of warnings.slice(0, 4)) { txt(g, w, 12, y, c, 16, 'left'); y += 21; }
    } else {
      const memo = [];
      const onGndTo = ac.wowMain && (fm.phase === 'preflight' || fm.phase === 'takeoff');
      const ldg = !ac.wowMain && ac.ra / FT < 2000 && (fm.phase === 'approach' || ac.gearPos > 0.5) && fm.phase !== 'takeoff';
      if (onGndTo) {
        memo.push(['T.O', 'AUTO BRK', 'MAX', ac.controls.autobrake === 3]);
        memo.push(['', 'SIGNS', 'ON', true]);
        memo.push(['', 'SPLRS', 'ARM', ac.controls.spoilersArmed]);
        memo.push(['', 'FLAPS', 'T.O', ac.conf >= 1 && ac.conf <= 4]);
        memo.push(['', 'T.O CONFIG', 'NORM', !fm.configWarning]);
      } else if (ldg) {
        memo.push(['LDG', 'LDG GEAR', 'DN', ac.gearPos > 0.99]);
        memo.push(['', 'SIGNS', 'ON', true]);
        memo.push(['', 'SPLRS', 'ARM', ac.controls.spoilersArmed]);
        memo.push(['', 'FLAPS', 'FULL', ac.conf === 5]);
      }
      for (const [h, a, b, ok] of memo) {
        if (h) txt(g, h, 12, y, COL.white, 15, 'left');
        if (ok) txt(g, `${a} ${b}`, 58, y, COL.green, 15, 'left');
        else txt(g, `${a} ${'.'.repeat(Math.max(2, 14 - a.length))}${b}`, 58, y, COL.cyan, 15, 'left');
        y += 19;
      }
    }
    // Right memo column
    const rm = [];
    if (ac.controls.parkingBrake) rm.push(['PARK BRK', COL.green]);
    if (ac.spoilerSB > 0.05) rm.push(['SPEED BRK', ac.controls.throttle > 0.62 ? COL.amber : COL.green]);
    if (ac.controls.autobrake) rm.push([`AUTO BRK ${['', 'LO', 'MED', 'MAX'][ac.controls.autobrake]}`, COL.green]);
    if (ac.controls.spoilersArmed && !(ac.wowMain && fm.phase === 'preflight')) rm.push(['GND SPLRS ARMED', COL.green]);
    if (fm.phase === 'takeoff' && ac.wowMain && ac.cas / KT > 80) rm.push(['T.O INHIBIT', COL.magenta]);
    if (!ac.wowMain && ac.ra / FT < 800 && fm.phase === 'approach') rm.push(['LDG INHIBIT', COL.magenta]);
    if (S.lightsSt && S.lightsSt.seatbelts) rm.push(['SEAT BELTS', COL.green]);
    let yr = 422;
    for (const [m, c] of rm.slice(0, 5)) { txt(g, m, 330, yr, c, 15, 'left'); yr += 19; }
  }

  /* =================================================================== SD */
  function drawSD(g, S) {
    const { ac, fm } = S;
    g.fillStyle = COL.bg; g.fillRect(0, 0, 512, 512);
    const wheel = ac.gearPos > 0.02 && (ac.ra / FT < 16000 || ac.wowMain);
    txt(g, wheel ? 'WHEEL' : 'CRUISE', 256, 22, COL.white, 20);
    line(g, 196, 36, 316, 36, COL.white, 1.5);
    if (wheel) {
      // Gear indications: two green triangles per gear when down & locked
      const gearBox = (x, y, label) => {
        const locked = ac.gearPos > 0.99, transit = ac.gearPos > 0.01 && !locked;
        for (const dx of [-14, 14]) {
          g.fillStyle = locked ? COL.green : transit ? COL.red : '#000';
          g.strokeStyle = locked ? COL.green : COL.red; g.lineWidth = 2;
          g.beginPath(); g.moveTo(x + dx - 11, y - 8); g.lineTo(x + dx + 11, y - 8); g.lineTo(x + dx, y + 10); g.closePath();
          if (locked || transit) g.fill(); else g.stroke();
        }
        txt(g, label, x, y + 26, COL.white, 13);
      };
      gearBox(256, 90, 'NOSE'); gearBox(140, 180, 'L'); gearBox(372, 180, 'R');
      // Spoilers
      txt(g, 'SPLR', 256, 250, COL.white, 14);
      for (let i = 0; i < 6; i++) {
        const up = Math.max(ac.groundSpoiler, ac.spoilerSB * (i >= 1 && i <= 4 ? 1 : 0), i >= 2 ? Math.abs(ac.ail) / 0.44 : 0) > 0.1;
        for (const s of [-1, 1]) {
          const x = 256 + s * (40 + i * 22);
          g.strokeStyle = COL.green; g.lineWidth = 2;
          line(g, x - 8, 280, x + 8, 280, COL.green, 2);
          if (up) { g.fillStyle = COL.green; g.beginPath(); g.moveTo(x, 262); g.lineTo(x - 6, 272); g.lineTo(x + 6, 272); g.closePath(); g.fill(); }
        }
      }
      // Brakes
      txt(g, 'BRAKES', 256, 330, COL.white, 14);
      S.brakeTemp = S.brakeTemp || [60, 60, 60, 60, 60, 60, 60, 60];
      for (let i = 0; i < 8; i++) {
        const side = i < 4 ? 0 : 1;
        const bt = S.brakeTemp[i];
        const x = side ? 330 + (i - 4) * 38 : 70 + i * 38;
        txt(g, String(Math.round(bt / 5) * 5), x, 360, bt > 300 ? COL.amber : COL.green, 15);
        txt(g, String(i + 1), x, 382, COL.white, 12);
      }
      txt(g, '°C', 256, 360, COL.cyan, 12);
      if (ac.controls.autobrake) txt(g, `AUTO BRK ${['', 'LO', 'MED', 'MAX'][ac.controls.autobrake]}`, 256, 410, ac.autobrakeActive ? COL.green : COL.cyan, 16);
    } else {
      txt(g, 'ENG', 60, 70, COL.white, 16, 'left');
      const used = Math.max(0, (S.fuelStart || ac.fuel) - ac.fuel);
      txt(g, 'F.USED', 256, 70, COL.white, 14); txt(g, `${Math.round(used / 10) * 10}`, 256, 94, COL.green, 20); txt(g, 'KG', 300, 94, COL.cyan, 12, 'left');
      txt(g, 'OIL', 256, 130, COL.white, 14);
      txt(g, '17.5', 150, 130, COL.green, 18); txt(g, '17.8', 362, 130, COL.green, 18);
      txt(g, 'VIB N1', 256, 166, COL.white, 13); txt(g, '0.3', 150, 166, COL.green, 16); txt(g, '0.2', 362, 166, COL.green, 16);
      line(g, 20, 200, 492, 200, COL.grey, 1);
      txt(g, 'AIR', 60, 226, COL.white, 16, 'left');
      const cabAlt = Math.min(8000, Math.max(0, ac.alt / FT * 0.2 - 200));
      txt(g, 'CAB ALT', 330, 250, COL.white, 14, 'left'); txt(g, `${Math.round(cabAlt / 50) * 50} FT`, 480, 250, COL.green, 16, 'right');
      txt(g, 'ΔP', 330, 276, COL.white, 14, 'left'); txt(g, `${(Math.min(8.6, Math.max(0, (ac.alt / FT) * 0.00024))).toFixed(1)} PSI`, 480, 276, COL.green, 16, 'right');
      txt(g, 'CKPT 22°  FWD 23°  AFT 23°', 256, 330, COL.green, 15);
    }
    // Permanent data
    line(g, 0, 444, 512, 444, COL.grey, 1.5);
    const tat = ac.atm.T - 273.15 + (ac.tas * ac.tas) / 2010;
    txt(g, `TAT ${tat >= 0 ? '+' : ''}${Math.round(tat)} °C`, 12, 466, COL.green, 15, 'left');
    txt(g, `SAT ${Math.round(ac.atm.T - 273.15)} °C`, 12, 490, COL.green, 15, 'left');
    const u = S.utc;
    txt(g, `${pad(u.getUTCHours(), 2)} H ${pad(u.getUTCMinutes(), 2)}`, 256, 478, COL.green, 18);
    txt(g, `GW ${Math.round(ac.mass / 100) * 100} KG`, 500, 466, COL.green, 15, 'right');
    txt(g, `CG 29.5 %`, 500, 490, COL.green, 15, 'right');
  }

  /* ================================================================== FCU */
  // Hit regions are in canvas pixels: {id, x, y, w, h, kind: 'knob'|'button'}
  const FCU_W = 1024, FCU_H = 220;
  const FCU_REGIONS = [
    { id: 'spd', x: 70, y: 110, w: 110, h: 100, kind: 'knob', label: 'SPD' },
    { id: 'spdMach', x: 190, y: 120, w: 60, h: 40, kind: 'button', label: 'SPD/MACH' },
    { id: 'hdg', x: 290, y: 110, w: 110, h: 100, kind: 'knob', label: 'HDG' },
    { id: 'loc', x: 410, y: 150, w: 60, h: 40, kind: 'button', label: 'LOC' },
    { id: 'ap1', x: 478, y: 30, w: 64, h: 42, kind: 'button', label: 'AP1' },
    { id: 'ap2', x: 552, y: 30, w: 64, h: 42, kind: 'button', label: 'AP2' },
    { id: 'athr', x: 515, y: 90, w: 64, h: 42, kind: 'button', label: 'A/THR' },
    { id: 'alt', x: 640, y: 110, w: 120, h: 100, kind: 'knob', label: 'ALT' },
    { id: 'exped', x: 770, y: 150, w: 60, h: 40, kind: 'button', label: 'EXPED' },
    { id: 'vs', x: 840, y: 110, w: 110, h: 100, kind: 'knob', label: 'V/S' },
    { id: 'appr', x: 955, y: 150, w: 60, h: 40, kind: 'button', label: 'APPR' },
  ];
  function drawFCU(g, S) {
    const { fm } = S;
    const f = fm.fcu;
    g.fillStyle = '#39424c'; g.fillRect(0, 0, FCU_W, FCU_H);
    g.fillStyle = '#2f373f'; g.fillRect(8, 8, FCU_W - 16, FCU_H - 16);
    const lcd = (x, y, w, h) => { g.fillStyle = '#0b0d0e'; rrect(g, x, y, w, h, 6); g.fill(); };
    const amberTxt = (s, x, y, px = 34, align = 'center') => txt(g, s, x, y, '#ff9d2a', px, align, 'middle', true);
    const dot = (x, y, on) => { if (on) { g.fillStyle = '#ffb347'; g.beginPath(); g.arc(x, y, 6, 0, Math.PI * 2); g.fill(); } };
    // SPD/MACH
    lcd(40, 20, 190, 76);
    txt(g, f.spdIsMach ? 'MACH' : 'SPD', 70, 36, '#ff9d2a', 15, 'center');
    if (f.spdManaged) { amberTxt('---', 118, 66); dot(190, 66, true); }
    else amberTxt(f.spdIsMach ? f.mach.toFixed(2) : String(Math.round(f.spd)), 130, 66);
    // HDG
    lcd(260, 20, 190, 76);
    txt(g, 'HDG', 290, 36, '#ff9d2a', 15); txt(g, 'LAT', 420, 36, '#ff9d2a', 15);
    if (f.hdgManaged && fm.lat !== 'HDG') { amberTxt('---', 340, 66); dot(410, 66, true); }
    else amberTxt(pad(f.hdg, 3), 350, 66);
    // ALT
    lcd(620, 20, 180, 76);
    txt(g, 'ALT', 660, 36, '#ff9d2a', 15); txt(g, 'LVL/CH', 752, 36, '#ff9d2a', 13);
    amberTxt(String(f.alt).padStart(5, '0'), 700, 66);
    dot(785, 66, ['CLB', 'DES'].includes(fm.vert));
    // V/S
    lcd(820, 20, 180, 76);
    txt(g, 'V/S', 860, 36, '#ff9d2a', 15);
    if (fm.vert === 'V/S') amberTxt(`${f.vs >= 0 ? '+' : '-'}${pad(Math.abs(f.vs) / 100, 2)}oo`, 910, 66);
    else amberTxt('-----', 910, 66);
    // Knobs and buttons
    for (const r of FCU_REGIONS) {
      if (r.kind === 'knob') {
        const cx = r.x + r.w / 2, cy = r.y + r.h / 2 + 4;
        const grd = g.createRadialGradient(cx - 10, cy - 10, 4, cx, cy, 40);
        grd.addColorStop(0, '#6b737c'); grd.addColorStop(1, '#1d2226');
        g.fillStyle = grd; g.beginPath(); g.arc(cx, cy, 38, 0, Math.PI * 2); g.fill();
        g.strokeStyle = '#11151a'; g.lineWidth = 3; g.stroke();
        for (let k = 0; k < 24; k++) { const a = (k / 24) * Math.PI * 2; line(g, cx + Math.cos(a) * 32, cy + Math.sin(a) * 32, cx + Math.cos(a) * 38, cy + Math.sin(a) * 38, '#0e1114', 2); }
      } else {
        const active = (r.id === 'ap1' && f.ap1) || (r.id === 'ap2' && f.ap2) || (r.id === 'athr' && (fm.athrArmed || fm.athrActive)) ||
          (r.id === 'loc' && (fm.latArmed.includes('LOC') || fm.lat.startsWith('LOC')) && !f.appr) || (r.id === 'appr' && f.appr);
        g.fillStyle = '#20262c'; rrect(g, r.x, r.y, r.w, r.h, 5); g.fill();
        g.strokeStyle = '#7d8790'; g.lineWidth = 2; g.stroke();
        txt(g, r.label, r.x + r.w / 2, r.y + r.h / 2 + 6, '#e8e8e8', r.label.length > 5 ? 11 : 14, 'center', 'middle', false);
        g.fillStyle = active ? '#3cff6e' : '#0f3a1c'; g.fillRect(r.x + 12, r.y + 5, r.w - 24, 5);
      }
    }
  }

  // EFIS control panel (per side) — 512 x 200
  const EFIS_REGIONS = [
    { id: 'fd', x: 20, y: 120, w: 70, h: 56, kind: 'button', label: 'FD' },
    { id: 'ls', x: 100, y: 120, w: 70, h: 56, kind: 'button', label: 'LS' },
    { id: 'baro', x: 20, y: 18, w: 150, h: 90, kind: 'knob', label: 'BARO' },
    { id: 'ndMode', x: 220, y: 30, w: 130, h: 150, kind: 'knob', label: 'MODE' },
    { id: 'ndRange', x: 370, y: 30, w: 130, h: 150, kind: 'knob', label: 'RANGE' },
  ];
  function drawEFIS(g, S) {
    const { fm, efis } = S;
    g.fillStyle = '#39424c'; g.fillRect(0, 0, 512, 200);
    g.fillStyle = '#0b0d0e'; rrect(g, 30, 22, 130, 40, 5); g.fill();
    txt(g, fm.fcu.baroStd ? 'Std' : String(fm.fcu.qnh), 95, 43, '#ff9d2a', 26);
    txt(g, 'PULL STD', 95, 90, '#e8e8e8', 12, 'center', 'middle', false);
    for (const r of EFIS_REGIONS) {
      if (r.kind === 'button') {
        const active = (r.id === 'fd' && fm.fcu.fd) || (r.id === 'ls' && efis.ls);
        g.fillStyle = '#20262c'; rrect(g, r.x, r.y, r.w, r.h, 5); g.fill(); g.strokeStyle = '#7d8790'; g.lineWidth = 2; g.stroke();
        txt(g, r.label, r.x + r.w / 2, r.y + r.h / 2 + 6, '#e8e8e8', 16, 'center', 'middle', false);
        g.fillStyle = active ? '#3cff6e' : '#0f3a1c'; g.fillRect(r.x + 14, r.y + 6, r.w - 28, 5);
      } else if (r.id !== 'baro') {
        const cx = r.x + r.w / 2, cy = r.y + 86;
        g.fillStyle = '#1d2226'; g.beginPath(); g.arc(cx, cy, 34, 0, Math.PI * 2); g.fill(); g.strokeStyle = '#0e1114'; g.lineWidth = 3; g.stroke();
        const opts = r.id === 'ndMode' ? ['ROSE', 'ARC'] : [10, 20, 40, 80, 160, 320, 640];
        const cur = r.id === 'ndMode' ? opts.indexOf(efis.ndMode) : opts.indexOf(efis.range);
        opts.forEach((o, i) => {
          const a = (-150 + (i * 300) / Math.max(1, opts.length - 1)) * D2R - Math.PI / 2 + Math.PI / 2;
          const ax = cx + Math.sin(a) * 52, ay = cy - Math.cos(a) * 52;
          txt(g, String(o), ax, ay, i === cur ? '#ffffff' : '#9aa3ab', 11, 'center', 'middle', false);
        });
        const a = (-150 + (cur * 300) / Math.max(1, opts.length - 1)) * D2R;
        line(g, cx, cy, cx + Math.sin(a) * 30, cy - Math.cos(a) * 30, '#ffffff', 4);
        txt(g, r.label, cx, r.y + 12, '#e8e8e8', 12, 'center', 'middle', false);
      }
    }
  }

  /* ================================================================ MCDU */
  function drawMCDU(g, S) {
    const { ac, fm, plan } = S;
    g.fillStyle = '#050607'; g.fillRect(0, 0, 512, 400);
    if (!plan) return;
    const page = S.mcduPage || 'FPLN';
    const row = (i) => 44 + i * 26;
    if (page === 'FPLN') {
      txt(g, `FROM`, 20, 18, COL.white, 14, 'left');
      txt(g, `${plan.dep.icao}-${plan.arr.icao}`, 256, 18, COL.white, 18);
      const gsKt = Math.max(ac.gs / KT, 250);
      let i = 0;
      const prog = fm.prog;
      for (let k = Math.max(0, fm.active - 1); k < plan.wps.length && i < 12; k++, i++) {
        const w = plan.wps[k];
        const distTo = prog ? Math.max(0, w.dist - prog.flown) / NM : 0;
        const eta = new Date(S.utc.getTime() + (distTo / gsKt) * 3600e3);
        const c = k === fm.active ? COL.white : COL.green;
        txt(g, w.ident, 16, row(i), c, 17, 'left');
        txt(g, `${pad(eta.getUTCHours(), 2)}${pad(eta.getUTCMinutes(), 2)}`, 230, row(i), COL.green, 15, 'center');
        const alt = w.altCstr ? (w.cstrType === 'above' ? '+' : '') + w.altCstr : k < plan.firstArrIdx ? `FL${Math.round(plan.cruiseFt / 100)}` : '-----';
        txt(g, alt, 496, row(i), w.altCstr ? COL.magenta : COL.green, 15, 'right');
        if (k > 0) txt(g, `${Math.round((w.dist - plan.wps[k - 1].dist) / NM)}NM`, 330, row(i) - 11, COL.white, 11, 'center');
      }
      const toGo = prog ? prog.toGo / NM : plan.total / NM;
      txt(g, `DEST  ${plan.arr.icao}${plan.arrRwy.id}   ${Math.round(toGo)}NM   EFOB ${(Math.max(0, ac.fuel - toGo / Math.max(gsKt, 250) * 5800) / 1000).toFixed(1)}`, 16, 380, COL.white, 14, 'left');
    } else {
      txt(g, 'PROG', 256, 18, COL.white, 18);
      txt(g, `CRZ FL${Math.round(plan.cruiseFt / 100)}   OPT FL${Math.round(Math.min(410, 330 + (230000 - ac.mass) / 10000 * 10) / 10) * 10}`, 20, row(0), COL.green, 16, 'left');
      txt(g, `PHASE ${fm.phase.toUpperCase()}`, 20, row(2), COL.cyan, 16, 'left');
      txt(g, `V1 ${fm.perf.v1}  VR ${fm.perf.vr}  V2 ${fm.perf.v2}`, 20, row(4), COL.cyan, 16, 'left');
      txt(g, `VAPP ${fm.perf.vapp}  VLS ${Math.round(fm.perf.vls || 0)}`, 20, row(5), COL.cyan, 16, 'left');
      txt(g, `FLX TEMP ${Math.round(ac.flexTemp)}°`, 20, row(6), COL.cyan, 16, 'left');
    }
  }

  /* ================================================================ class */
  class Avionics {
    constructor() {
      this.canvases = {
        pfd: mkCanvas(512, 512), nd: mkCanvas(512, 512), ewd: mkCanvas(512, 512), sd: mkCanvas(512, 512),
        fcu: mkCanvas(FCU_W, FCU_H), efis: mkCanvas(512, 200), mcdu: mkCanvas(512, 400),
      };
      this.ctx = {};
      for (const [k, c] of Object.entries(this.canvases)) this.ctx[k] = c.getContext('2d');
      this.efis = { ls: false, ndMode: 'ARC', range: 40 };
      this.textures = {};
      this.brakeTemp = [60, 60, 60, 60, 60, 60, 60, 60];
      this.mcduPage = 'FPLN';
      this.t = 0;
    }
    texture(name) {
      if (!this.textures[name]) {
        const t = new THREE.CanvasTexture(this.canvases[name]);
        t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
        this.textures[name] = t;
      }
      return this.textures[name];
    }
    /** Redraw. `which` limits the set (e.g. only visible ones). */
    draw(S, dt, which = ['pfd', 'nd', 'ewd', 'sd', 'fcu', 'efis', 'mcdu']) {
      this.t += dt;
      S.efis = this.efis; S.brakeTemp = this.brakeTemp; S.mcduPage = this.mcduPage;
      // Brake temperatures from braking energy
      const ac = S.ac;
      for (let i = 0; i < 8; i++) {
        const b = ac.brakeCmd ? ac.brakeCmd[i < 4 ? 0 : 1] : 0;
        const heat = ac.onGround ? b * ac.gs * 0.9 : 0;
        this.brakeTemp[i] += (heat - (this.brakeTemp[i] - 40) * (ac.onGround ? 0.004 : 0.012)) * dt;
      }
      for (const k of which) {
        const g = this.ctx[k];
        try {
          if (k === 'pfd') drawPFD(g, S);
          else if (k === 'nd') drawND(g, S);
          else if (k === 'ewd') drawEWD(g, S);
          else if (k === 'sd') drawSD(g, S);
          else if (k === 'fcu') drawFCU(g, S);
          else if (k === 'efis') drawEFIS(g, S);
          else if (k === 'mcdu') drawMCDU(g, S);
        } catch (e) { if (!this.warned) { console.error('display', k, e); this.warned = true; } }
        if (this.textures[k]) this.textures[k].needsUpdate = true;
      }
    }
    /** Hit test on a panel in canvas pixel coordinates. */
    hit(panel, x, y) {
      const regions = panel === 'fcu' ? FCU_REGIONS : panel === 'efis' ? EFIS_REGIONS : [];
      return regions.find((r) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) || null;
    }
  }

  window.Avionics = Avionics;
  window.AvionicsColors = COL;
})();
