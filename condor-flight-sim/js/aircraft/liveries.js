/* =============================================================================
 * liveries.js — Condor's 2022 "stripes" livery family: vertical stripes in
 * one of five colours (Sunshine, Passion, Sea, Island, Beach) alternating with
 * white, the compact black lowercase "condor" wordmark, and the condor
 * signet in a circle on the fin. Textures are painted onto canvases.
 *
 * Fuselage texture layout: x = nose (0) -> tail (1), y = angle around the
 * fuselage (see model.js): the left side is upright around y = 0.25, the right
 * side is rotated 180° around y = 0.75 so the text reads correctly from
 * outside on both sides.
 * ========================================================================== */
(function () {
  'use strict';

  const LIVERIES = [
    { id: 'island', name: 'Island', color: '#2fa66a', reg: 'D-ANRA', desc: 'Green stripes' },
    { id: 'sunshine', name: 'Sunshine', color: '#f7b71d', reg: 'D-ANRB', desc: 'Yellow stripes' },
    { id: 'passion', name: 'Passion', color: '#e2363c', reg: 'D-ANRC', desc: 'Red stripes' },
    { id: 'sea', name: 'Sea', color: '#1e8fd8', reg: 'D-ANRD', desc: 'Blue stripes' },
    { id: 'beach', name: 'Beach', color: '#d9bd92', reg: 'D-ANRE', desc: 'Sand stripes' },
  ];

  const WORDMARK_FONT = '"Barlow Condensed", "Arial Narrow", "Helvetica Neue", Arial, sans-serif';
  const STRIPE = 0.40; // metres per coloured stripe (same width of white in between)

  /** Vertical stripes across a canvas region covering `metres` of length. */
  function paintStripes(g, x0, x1, y0, y1, metres, color, phase = 0) {
    const pxPerM = (x1 - x0) / metres;
    g.fillStyle = '#fbfbf8';
    g.fillRect(x0, y0, x1 - x0, y1 - y0);
    g.fillStyle = color;
    const w = STRIPE * pxPerM;
    for (let x = x0 - ((phase * pxPerM) % (2 * w)); x < x1; x += 2 * w) g.fillRect(Math.max(x0, x), y0, Math.min(w, x1 - x), y1 - y0);
  }

  /** The condor signet: circle with a stylised condor (head and spread wing). */
  function drawSignet(g, cx, cy, r, ink = '#1b1b1b') {
    g.save();
    g.translate(cx, cy);
    g.fillStyle = '#ffffff';
    g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2); g.fill();
    g.lineWidth = r * 0.07; g.strokeStyle = ink;
    g.beginPath(); g.arc(0, 0, r * 0.9, 0, Math.PI * 2); g.stroke();
    g.fillStyle = ink;
    const s = r / 100;
    // Wing: a sweeping crescent with finger feathers
    g.beginPath();
    g.moveTo(-70 * s, 22 * s);
    g.bezierCurveTo(-40 * s, -40 * s, 25 * s, -62 * s, 72 * s, -30 * s);
    g.lineTo(58 * s, -22 * s); g.lineTo(66 * s, -12 * s); g.lineTo(50 * s, -8 * s); g.lineTo(56 * s, 2 * s); g.lineTo(38 * s, 2 * s);
    g.bezierCurveTo(10 * s, -20 * s, -30 * s, -8 * s, -70 * s, 22 * s);
    g.fill();
    // Head & neck with the characteristic hooked beak
    g.beginPath();
    g.moveTo(-18 * s, 8 * s);
    g.bezierCurveTo(-34 * s, 20 * s, -46 * s, 40 * s, -40 * s, 58 * s);
    g.lineTo(-30 * s, 60 * s);
    g.bezierCurveTo(-30 * s, 46 * s, -20 * s, 34 * s, -4 * s, 30 * s);
    g.bezierCurveTo(6 * s, 28 * s, 10 * s, 36 * s, 4 * s, 44 * s);
    g.lineTo(16 * s, 38 * s);
    g.bezierCurveTo(20 * s, 24 * s, 10 * s, 14 * s, -18 * s, 8 * s);
    g.fill();
    // Neck ruff
    g.lineWidth = r * 0.05;
    g.beginPath(); g.moveTo(-40 * s, 30 * s); g.quadraticCurveTo(-24 * s, 20 * s, -8 * s, 22 * s); g.stroke();
    g.restore();
  }

  function wordmark(g, x, y, h, color = '#141414', rotate = false) {
    g.save();
    g.translate(x, y);
    if (rotate) g.rotate(Math.PI);
    g.fillStyle = color;
    g.font = `800 ${h}px ${WORDMARK_FONT}`;
    g.textAlign = 'center'; g.textBaseline = 'alphabetic';
    g.scale(1, 1);
    g.fillText('condor', 0, h * 0.34);
    g.restore();
  }

  /**
   * Fuselage texture. `geo` gives the metres mapping from model.js:
   * {length, noseX, circumference, windowV:[left,right], stations(x)->u}
   */
  function fuselageCanvas(liv, geo, hi = true) {
    const W = hi ? 4096 : 2048, H = hi ? 1024 : 512;
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d');
    const X = (xm) => ((geo.noseX - xm) / geo.length) * W;         // model x (m) -> canvas x
    const Y = (v) => (1 - v) * H;                                     // texture v -> canvas y
    const pxPerM = W / geo.length;
    paintStripes(g, 0, W, 0, H, geo.length, liv.color, 0.2);
    // Radome: white
    g.fillStyle = '#fbfbf8';
    g.fillRect(0, 0, X(25.7), H);
    // Belly between the wings (wing-to-body fairing is grey in model.js) keeps stripes.

    // ---- cockpit windows: front windscreen, sliding window, aft side window (both sides)
    // Angles are degrees from the top of the fuselage; left side v = 1 - phi/360, right v = phi/360.
    const cockpit = [
      [[25.55, 22], [24.75, 16], [24.75, 60], [25.55, 57]],
      [[24.62, 61], [23.78, 60], [23.78, 77], [24.62, 76]],
      [[23.66, 62], [23.02, 63], [23.02, 74], [23.66, 75]],
    ];
    for (const side of ['L', 'R']) {
      const vOf = (phi) => (side === 'L' ? 1 - phi / 360 : phi / 360);
      for (const poly of cockpit) {
        const grad = g.createLinearGradient(X(poly[0][0]), 0, X(poly[1][0]), 0);
        grad.addColorStop(0, '#0b1016'); grad.addColorStop(1, '#1d2733');
        g.fillStyle = grad;
        g.beginPath();
        poly.forEach(([xm, phi], i) => (i ? g.lineTo(X(xm), Y(vOf(phi))) : g.moveTo(X(xm), Y(vOf(phi)))));
        g.closePath(); g.fill();
        g.strokeStyle = 'rgba(60,60,60,0.8)'; g.lineWidth = 3; g.stroke();
      }
    }

    // ---- passenger windows & doors
    const winH = 0.36 * (H / geo.circumference), winW = 0.25 * pxPerM;
    const doors = [20.9, 12.7, -9.4, -24.6];
    const nearDoor = (xm) => doors.some((d) => Math.abs(xm - d) < 1.4);
    for (const side of ['L', 'R']) {
      const vc = geo.windowV[side === 'L' ? 0 : 1];
      const yc = Y(vc);
      for (let xm = 19.3; xm > -25.8; xm -= 0.533) {
        if (nearDoor(xm) || (xm < 2.2 && xm > 0.2)) continue;
        const x = X(xm);
        g.fillStyle = 'rgba(18,24,32,0.95)';
        roundRect(g, x - winW / 2, yc - winH / 2, winW, winH, winW * 0.45); g.fill();
        g.fillStyle = 'rgba(90,110,130,0.35)';
        roundRect(g, x - winW / 2 + 2, yc - winH / 2 + 2, winW * 0.45, winH * 0.5, winW * 0.3); g.fill();
      }
      // Door outlines
      g.strokeStyle = 'rgba(40,40,40,0.55)'; g.lineWidth = Math.max(1.5, pxPerM * 0.03);
      const dh = 1.93 * (H / geo.circumference), dw = 1.07 * pxPerM;
      for (const d of doors) {
        roundRect(g, X(d) - dw / 2, yc - dh * 0.62, dw, dh, dw * 0.18); g.stroke();
        g.fillStyle = 'rgba(18,24,32,0.9)';
        roundRect(g, X(d) - winW / 2, yc - winH * 0.9, winW, winH * 0.8, winW * 0.4); g.fill();
      }
      // Wordmark: big black lowercase "condor" on the forward upper fuselage
      const vText = side === 'L' ? 0.75 + 0.088 : 0.25 - 0.088;
      const hText = 2.3 * (H / geo.circumference);
      const xText = X(15.2);
      g.save();
      g.translate(xText, Y(vText));
      g.scale(pxPerM / (H / geo.circumference), 1);
      wordmark(g, 0, 0, hText, '#141414', side === 'R');
      g.restore();
      // Registration near the tail, above the windows line
      g.save();
      g.translate(X(-27.3), Y(side === 'L' ? 0.75 + 0.03 : 0.25 - 0.03));
      if (side === 'R') g.rotate(Math.PI);
      g.scale(pxPerM / (H / geo.circumference), 1);
      g.font = `700 ${0.55 * (H / geo.circumference)}px ${WORDMARK_FONT}`;
      g.fillStyle = '#1a1a1a'; g.textAlign = 'center';
      g.fillText(liv.reg, 0, 0);
      g.restore();
    }
    // Panel line hints
    g.strokeStyle = 'rgba(0,0,0,0.08)'; g.lineWidth = 1;
    for (let xm = 20; xm > -30; xm -= 2.1) { g.beginPath(); g.moveTo(X(xm), 0); g.lineTo(X(xm), H); g.stroke(); }
    return c;
  }

  function roundRect(g, x, y, w, h, r) {
    r = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
    g.beginPath();
    g.moveTo(x + r, y); g.lineTo(x + w - r, y); g.quadraticCurveTo(x + w, y, x + w, y + r);
    g.lineTo(x + w, y + h - r); g.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    g.lineTo(x + r, y + h); g.quadraticCurveTo(x, y + h, x, y + h - r);
    g.lineTo(x, y + r); g.quadraticCurveTo(x, y, x + r, y); g.closePath();
  }

  /** Fin texture: u = model x mapped over [x0,x1], v = height over [y0,y1]. */
  function finCanvas(liv, box) {
    const S = 1024;
    const c = document.createElement('canvas'); c.width = S; c.height = S;
    const g = c.getContext('2d');
    const metres = box.x1 - box.x0;
    paintStripes(g, 0, S, 0, S, metres, liv.color, 0.1);
    // Signet: centred in the fin, about 3.6 m across
    const cx = (1 - (box.logoX - box.x0) / metres) * S, cy = (1 - (box.logoY - box.y0) / (box.y1 - box.y0)) * S;
    const r = (1.9 / metres) * S;
    g.save(); g.translate(cx, cy); g.scale(1, metres / (box.y1 - box.y0)); drawSignet(g, 0, 0, r); g.restore();
    return c;
  }

  /** Engine nacelle texture (u around, v along the nacelle from inlet to exhaust). */
  function nacelleCanvas(liv, lengthM) {
    const c = document.createElement('canvas'); c.width = 256; c.height = 512;
    const g = c.getContext('2d');
    g.fillStyle = '#fbfbf8'; g.fillRect(0, 0, 256, 512);
    g.fillStyle = liv.color;
    const pxPerM = 512 / lengthM, w = STRIPE * pxPerM;
    for (let y = 0; y < 512; y += 2 * w) g.fillRect(0, y, 256, w);
    return c;
  }

  /** Top-down silhouette used for the ground shadow. */
  function shadowCanvas() {
    const c = document.createElement('canvas'); c.width = 256; c.height = 256;
    const g = c.getContext('2d');
    g.fillStyle = '#000'; g.fillRect(0, 0, 256, 256);   // used as an alpha map: white = shadow
    g.filter = 'blur(3px)';
    g.fillStyle = '#fff';
    const X = (m) => 128 + m * 3.8, Z = (m) => 128 - m * 3.8; // model z right -> canvas x ; model x fwd -> canvas up
    // fuselage
    g.beginPath(); g.ellipse(128, 128 - 1.5 * 3.8, 2.9 * 3.8, 31 * 3.8, 0, 0, Math.PI * 2); g.fill();
    // wings
    g.beginPath(); g.moveTo(X(-2.8), Z(4.5)); g.lineTo(X(-31.5), Z(-12.8)); g.lineTo(X(-31.5), Z(-15.4)); g.lineTo(X(-9.5), Z(-6.5)); g.lineTo(X(-2.8), Z(-8.5)); g.closePath(); g.fill();
    g.beginPath(); g.moveTo(X(2.8), Z(4.5)); g.lineTo(X(31.5), Z(-12.8)); g.lineTo(X(31.5), Z(-15.4)); g.lineTo(X(9.5), Z(-6.5)); g.lineTo(X(2.8), Z(-8.5)); g.closePath(); g.fill();
    // tailplane
    g.beginPath(); g.moveTo(X(-1.4), Z(-24.5)); g.lineTo(X(-9.7), Z(-31)); g.lineTo(X(-9.7), Z(-33)); g.lineTo(X(-1.4), Z(-31.5)); g.closePath(); g.fill();
    g.beginPath(); g.moveTo(X(1.4), Z(-24.5)); g.lineTo(X(9.7), Z(-31)); g.lineTo(X(9.7), Z(-33)); g.lineTo(X(1.4), Z(-31.5)); g.closePath(); g.fill();
    return c;
  }

  window.Liveries = { LIVERIES, fuselageCanvas, finCanvas, nacelleCanvas, shadowCanvas, drawSignet, WORDMARK_FONT };
})();
