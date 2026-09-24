/* SVG figure and chart builders shared by math questions, R&W data
   questions, and the progress pages. All strokes/fills use CSS classes so
   every theme can recolor them. */
(function () {
  'use strict';
  const SAT = window.SAT;
  const esc = SAT.util.esc;
  const F = (SAT.fig = {});
  const n1 = (v) => Math.round(v * 10) / 10;

  F.svg = (w, h, inner, cls, label) =>
    '<svg class="fig ' + (cls || '') + '" viewBox="0 0 ' + w + ' ' + h + '" role="img"' +
    (label ? ' aria-label="' + esc(label) + '"' : '') + ' style="max-width:' + w + 'px">' + inner + '</svg>';

  const text = (x, y, s, o) => {
    o = o || {};
    return '<text x="' + n1(x) + '" y="' + n1(y) + '" class="' + (o.cls || 'fig-t') + '" text-anchor="' + (o.anchor || 'middle') + '"' +
      (o.rot ? ' transform="rotate(' + o.rot + ' ' + n1(x) + ' ' + n1(y) + ')"' : '') + ' dominant-baseline="middle">' + s + '</text>';
  };
  F.text = text;
  const line = (a, b, cls) => '<line x1="' + n1(a[0]) + '" y1="' + n1(a[1]) + '" x2="' + n1(b[0]) + '" y2="' + n1(b[1]) + '" class="' + (cls || 'fig-l') + '"/>';
  F.line = line;
  const poly = (pts, cls) => '<polygon points="' + pts.map((p) => n1(p[0]) + ',' + n1(p[1])).join(' ') + '" class="' + (cls || 'fig-shape') + '"/>';
  const unit = (a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1; return [dx / L, dy / L]; };

  /* Italic variable labels like "x°" render nicer with tspans. */
  const lab = (s) => String(s).replace(/([a-z])(?![a-z])/g, '<tspan class="fig-var">$1</tspan>');

  /* Triangle: pts = three [x,y]; vlabels = vertex names; sides[i] = label of
     side pts[i]->pts[i+1]; angles[i] = label drawn inside at vertex i. */
  F.triangle = function (o) {
    const p = o.pts, c = [(p[0][0] + p[1][0] + p[2][0]) / 3, (p[0][1] + p[1][1] + p[2][1]) / 3];
    let s = poly(p);
    if (o.right != null) {
      const v = p[o.right], a = unit(v, p[(o.right + 1) % 3]), b = unit(v, p[(o.right + 2) % 3]), k = 13;
      s += '<polyline class="fig-l thin" points="' + [[v[0] + a[0] * k, v[1] + a[1] * k], [v[0] + a[0] * k + b[0] * k, v[1] + a[1] * k + b[1] * k], [v[0] + b[0] * k, v[1] + b[1] * k]].map((q) => n1(q[0]) + ',' + n1(q[1])).join(' ') + '"/>';
    }
    (o.vlabels || []).forEach((L, i) => {
      if (!L) return;
      const d = unit(c, p[i]);
      s += text(p[i][0] + d[0] * 16, p[i][1] + d[1] * 16, lab(L), { cls: 'fig-t fig-vl' });
    });
    (o.sides || []).forEach((L, i) => {
      if (!L) return;
      const a = p[i], b = p[(i + 1) % 3], m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      let nx = -(b[1] - a[1]), ny = b[0] - a[0];
      const Ln = Math.hypot(nx, ny); nx /= Ln; ny /= Ln;
      if ((m[0] - c[0]) * nx + (m[1] - c[1]) * ny < 0) { nx = -nx; ny = -ny; }
      s += text(m[0] + nx * 15, m[1] + ny * 15, lab(L));
    });
    (o.angles || []).forEach((L, i) => {
      if (!L) return;
      const d = unit(p[i], c);
      s += text(p[i][0] + d[0] * 30, p[i][1] + d[1] * 30, lab(L), { cls: 'fig-t small' });
    });
    return F.svg(o.w || 300, o.h || 220, s + (o.extra || ''), 'fig-geo', 'Triangle figure') + (o.note === false ? '' : '<div class="fig-note">Note: Figure not drawn to scale.</div>');
  };

  /* Two parallel lines cut by a transversal; labels keyed by position:
     'a1'..'a4' at the upper intersection (TL, TR, BR, BL), 'b1'..'b4' lower. */
  F.parallel = function (o) {
    const W = 320, H = 220, y1 = 70, y2 = 150;
    const tx1 = 110, tx2 = 200; // transversal crosses line1 at tx1, line2 at tx2
    const slope = (tx2 - tx1) / (y2 - y1);
    const top = [tx1 - slope * (y1 - 12), 12], bot = [tx2 + slope * (H - 12 - y2), H - 12];
    let s = line([20, y1], [W - 20, y1]) + line([20, y2], [W - 20, y2]) + line(top, bot);
    s += text(W - 12, y1 - 10, lab(o.l1 || 'ℓ'), { cls: 'fig-t fig-vl', anchor: 'end' }) + text(W - 12, y2 - 10, lab(o.l2 || 'm'), { cls: 'fig-t fig-vl', anchor: 'end' });
    const pos = (cx, cy, k) => ({ 1: [cx - 26, cy - 14], 2: [cx + 26, cy - 14], 3: [cx + 26, cy + 14], 4: [cx - 26, cy + 14] }[k]);
    Object.keys(o.labels || {}).forEach((key) => {
      const cx = key[0] === 'a' ? tx1 : tx2, cy = key[0] === 'a' ? y1 : y2;
      const q = pos(cx, cy, +key[1]);
      s += text(q[0], q[1], lab(o.labels[key]), { cls: 'fig-t small' });
    });
    return F.svg(W, H, s, 'fig-geo', 'Parallel lines cut by a transversal') + '<div class="fig-note">Note: Figure not drawn to scale. Lines ' + (o.l1 || 'ℓ') + ' and ' + (o.l2 || 'm') + ' are parallel.</div>';
  };

  /* Circle with center O and optional central angle / radius labels. */
  F.circle = function (o) {
    const W = 240, H = 220, cx = 120, cy = 110, r = 85;
    let s = '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" class="fig-shape"/><circle cx="' + cx + '" cy="' + cy + '" r="2.5" class="fig-dot"/>';
    s += text(cx - 10, cy + 12, lab(o.center || 'O'), { cls: 'fig-t fig-vl' });
    if (o.angle != null) {
      const a0 = -Math.PI / 2 + 0.35, a1 = a0 + (o.angleDraw || o.angle) * Math.PI / 180;
      const A = [cx + r * Math.cos(a0), cy + r * Math.sin(a0)], B = [cx + r * Math.cos(a1), cy + r * Math.sin(a1)];
      if (o.sector) s += '<path class="fig-fill" d="M' + cx + ',' + cy + ' L' + n1(A[0]) + ',' + n1(A[1]) + ' A' + r + ',' + r + ' 0 ' + ((o.angleDraw || o.angle) > 180 ? 1 : 0) + ' 1 ' + n1(B[0]) + ',' + n1(B[1]) + ' Z"/>';
      s += line([cx, cy], A) + line([cx, cy], B);
      s += text(A[0] + (A[0] - cx) * 0.14, A[1] + (A[1] - cy) * 0.14, lab(o.pA || 'A'), { cls: 'fig-t fig-vl' });
      s += text(B[0] + (B[0] - cx) * 0.14, B[1] + (B[1] - cy) * 0.14, lab(o.pB || 'B'), { cls: 'fig-t fig-vl' });
      const am = (a0 + a1) / 2;
      if (o.angleLabel) s += text(cx + 28 * Math.cos(am), cy + 28 * Math.sin(am), lab(o.angleLabel), { cls: 'fig-t small' });
      if (o.rLabel) s += text((cx + A[0]) / 2 - 10, (cy + A[1]) / 2, lab(o.rLabel), { cls: 'fig-t small' });
    } else if (o.rLabel) {
      s += line([cx, cy], [cx + r, cy]) + text(cx + r / 2, cy - 10, lab(o.rLabel), { cls: 'fig-t small' });
    }
    return F.svg(W, H, s, 'fig-geo', 'Circle figure') + (o.note === false ? '' : '<div class="fig-note">Note: Figure not drawn to scale.</div>');
  };

  /* Rectangular prism / cylinder / cone sketches with dimension labels. */
  F.prism = function (o) {
    const s = '<polygon class="fig-shape" points="40,80 190,80 190,180 40,180"/>' +
      '<polygon class="fig-shape" points="40,80 90,40 240,40 190,80"/><polygon class="fig-shape" points="190,80 240,40 240,140 190,180"/>' +
      '<polyline class="fig-l dash" points="40,180 90,140 240,140"/><line class="fig-l dash" x1="90" y1="40" x2="90" y2="140"/>' +
      text(115, 195, lab(o.l || '')) + text(228, 172, lab(o.w || ''), { anchor: 'start' }) + text(26, 130, lab(o.h || ''), { anchor: 'end' });
    return F.svg(270, 210, s, 'fig-geo', 'Rectangular prism');
  };
  F.cylinder = function (o) {
    const s = '<ellipse class="fig-shape" cx="120" cy="50" rx="70" ry="18"/>' +
      '<path class="fig-shape" d="M50,50 V170 A70,18 0 0 0 190,170 V50" />' +
      '<path class="fig-l dash" d="M50,170 A70,18 0 0 1 190,170"/>' +
      '<line class="fig-l thin" x1="120" y1="50" x2="190" y2="50"/><circle class="fig-dot" cx="120" cy="50" r="2.5"/>' +
      text(155, 38, lab(o.r || '')) + text(204, 112, lab(o.h || ''), { anchor: 'start' }) + '<line class="fig-l thin dash" x1="198" y1="50" x2="198" y2="170"/>';
    return F.svg(250, 205, s, 'fig-geo', 'Cylinder');
  };
  F.cone = function (o) {
    const s = '<path class="fig-shape" d="M120,20 L50,170 A70,18 0 0 0 190,170 Z"/>' +
      '<path class="fig-l dash" d="M50,170 A70,18 0 0 1 190,170"/>' +
      '<line class="fig-l thin dash" x1="120" y1="20" x2="120" y2="170"/><line class="fig-l thin" x1="120" y1="170" x2="190" y2="170"/>' +
      text(155, 158, lab(o.r || '')) + text(130, 100, lab(o.h || ''), { anchor: 'start' });
    return F.svg(240, 200, s, 'fig-geo', 'Cone');
  };

  /* ------------------------------------------------------------ charts */
  function niceStep(range, target) {
    const raw = range / (target || 5), p = Math.pow(10, Math.floor(Math.log10(raw))), f = raw / p;
    return (f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10) * p;
  }
  F.niceStep = niceStep;
  const fmt = (v) => (Math.abs(v) >= 1000 ? v.toLocaleString('en-US') : String(+v.toFixed(4)));

  /* Axes frame used by scatter/line/coordinate plots. */
  function frame(o) {
    const W = o.w || 360, H = o.h || 260, L = o.padL || 52, R = 16, T = o.title ? 30 : 14, B = o.xlabel ? 48 : 30;
    const X = (v) => L + ((v - o.x0) / (o.x1 - o.x0)) * (W - L - R);
    const Y = (v) => H - B - ((v - o.y0) / (o.y1 - o.y0)) * (H - T - B);
    let s = '';
    if (o.title) s += text(W / 2, 14, esc(o.title), { cls: 'fig-t fig-title' });
    const xs = o.xstep || niceStep(o.x1 - o.x0), ys = o.ystep || niceStep(o.y1 - o.y0);
    if (!o.noX) for (let v = Math.ceil(o.x0 / xs) * xs; v <= o.x1 + 1e-9; v += xs) {
      s += line([X(v), T], [X(v), H - B], 'fig-grid') + text(X(v), H - B + 13, fmt(v), { cls: 'fig-t tick' });
    }
    for (let v = Math.ceil(o.y0 / ys) * ys; v <= o.y1 + 1e-9; v += ys) {
      s += line([L, Y(v)], [W - R, Y(v)], 'fig-grid') + text(L - 6, Y(v), fmt(v), { cls: 'fig-t tick', anchor: 'end' });
    }
    s += line([L, H - B], [W - R, H - B], 'fig-axis') + line([L, T], [L, H - B], 'fig-axis');
    if (o.xlabel) s += text((L + W - R) / 2, H - 12, esc(o.xlabel), { cls: 'fig-t axl' });
    if (o.ylabel) s += text(13, (T + H - B) / 2, esc(o.ylabel), { cls: 'fig-t axl', rot: -90 });
    return { s, X, Y, W, H, L, R, T, B };
  }

  F.scatter = function (o) {
    const f = frame(o);
    let s = f.s;
    if (o.fit) {
      const [m, b] = o.fit, xa = o.x0, xb = o.x1;
      let pts = [];
      if (o.fitFn) { for (let i = 0; i <= 60; i++) { const x = xa + (i / 60) * (xb - xa), y = o.fitFn(x); if (y >= o.y0 && y <= o.y1) pts.push([f.X(x), f.Y(y)]); } }
      else pts = [[f.X(xa), f.Y(m * xa + b)], [f.X(xb), f.Y(m * xb + b)]];
      if (pts.length > 1) s += '<clipPath id="clip' + (o.id || 'sc') + '"><rect x="' + f.L + '" y="' + f.T + '" width="' + (f.W - f.L - f.R) + '" height="' + (f.H - f.T - f.B) + '"/></clipPath><polyline clip-path="url(#clip' + (o.id || 'sc') + ')" class="fig-fit" points="' + pts.map((p) => n1(p[0]) + ',' + n1(p[1])).join(' ') + '"/>';
    }
    o.points.forEach((p) => { s += '<circle class="fig-pt" cx="' + n1(f.X(p[0])) + '" cy="' + n1(f.Y(p[1])) + '" r="4"/>'; });
    return F.svg(f.W, f.H, s, 'fig-chart', o.title || 'Scatterplot');
  };

  /* Coordinate plane with graphs: fns [{f, cls}], points [[x,y,label]]. */
  F.plane = function (o) {
    const W = o.w || 280, H = o.h || 280, pad = 14;
    const X = (v) => pad + ((v - o.x0) / (o.x1 - o.x0)) * (W - 2 * pad);
    const Y = (v) => H - pad - ((v - o.y0) / (o.y1 - o.y0)) * (H - 2 * pad);
    let s = '';
    const st = o.step || 1, lb = o.labelEvery || 0;
    for (let v = Math.ceil(o.x0 / st) * st; v <= o.x1; v += st) s += line([X(v), pad], [X(v), H - pad], 'fig-grid');
    for (let v = Math.ceil(o.y0 / st) * st; v <= o.y1; v += st) s += line([pad, Y(v)], [W - pad, Y(v)], 'fig-grid');
    s += line([X(0), pad], [X(0), H - pad], 'fig-axis') + line([pad, Y(0)], [W - pad, Y(0)], 'fig-axis');
    s += text(W - pad + 2, Y(0) - 9, '<tspan class="fig-var">x</tspan>', { anchor: 'end' }) + text(X(0) + 10, pad + 2, '<tspan class="fig-var">y</tspan>');
    if (lb) {
      for (let v = Math.ceil(o.x0 / lb) * lb; v <= o.x1; v += lb) if (v) s += text(X(v), Y(0) + 11, fmt(v), { cls: 'fig-t tick' });
      for (let v = Math.ceil(o.y0 / lb) * lb; v <= o.y1; v += lb) if (v) s += text(X(0) - 5, Y(v), fmt(v), { cls: 'fig-t tick', anchor: 'end' });
      s += text(X(0) - 6, Y(0) + 10, 'O', { cls: 'fig-t tick', anchor: 'end' });
    }
    (o.fns || []).forEach((g) => {
      let d = '', pen = false;
      for (let i = 0; i <= 240; i++) {
        const x = o.x0 + (i / 240) * (o.x1 - o.x0), y = g.f(x);
        if (!isFinite(y) || y < o.y0 - 1 || y > o.y1 + 1) { pen = false; continue; }
        d += (pen ? 'L' : 'M') + n1(X(x)) + ',' + n1(Y(y)); pen = true;
      }
      s += '<path class="fig-curve ' + (g.cls || '') + '" d="' + d + '"/>';
    });
    (o.points || []).forEach((p) => {
      s += '<circle class="fig-pt" cx="' + n1(X(p[0])) + '" cy="' + n1(Y(p[1])) + '" r="3.5"/>';
      if (p[2]) s += text(X(p[0]) + 8, Y(p[1]) - 10, p[2], { cls: 'fig-t small', anchor: 'start' });
    });
    return F.svg(W, H, '<clipPath id="pc"><rect x="' + pad + '" y="' + pad + '" width="' + (W - 2 * pad) + '" height="' + (H - 2 * pad) + '"/></clipPath><g clip-path="url(#pc)">' + s + '</g>', 'fig-plane', 'Graph in the xy-plane');
  };

  /* Bar chart: cats [...], series [{name, vals}], optional ylabel/title. */
  F.bars = function (o) {
    const all = o.series.flatMap((s) => s.vals);
    const y1 = o.ymax || Math.max(...all) * 1.1, y0 = 0;
    const f = frame({ w: o.w || 380, h: o.h || 270, x0: 0, x1: 1, y0, y1, noX: true, ystep: o.ystep, ylabel: o.ylabel, xlabel: o.xlabel, title: o.title, padL: 56 });
    let s = f.s;
    const n = o.cats.length, k = o.series.length, slot = (f.W - f.L - f.R) / n, bw = Math.min(34, (slot * 0.7) / k);
    o.cats.forEach((c, i) => {
      const cx = f.L + slot * (i + 0.5);
      o.series.forEach((ser, j) => {
        const v = ser.vals[i], x = cx - (k * bw) / 2 + j * bw, y = f.Y(v);
        s += '<rect class="fig-bar s' + (j + 1) + '" x="' + n1(x) + '" y="' + n1(y) + '" width="' + n1(bw - 2) + '" height="' + n1(f.Y(0) - y) + '"/>';
        if (o.values) s += text(x + bw / 2 - 1, y - 8, fmt(v), { cls: 'fig-t tick' });
      });
      s += text(cx, f.H - f.B + 14, esc(c), { cls: 'fig-t tick' });
    });
    s += legend(o.series, f);
    return F.svg(f.W, f.H + (k > 1 ? 18 : 0), s, 'fig-chart', o.title || 'Bar chart');
  };

  F.lines = function (o) {
    const xs = o.x, all = o.series.flatMap((s) => s.vals);
    const y0 = o.ymin != null ? o.ymin : 0, y1 = o.ymax || Math.max(...all) * 1.1;
    const f = frame({ w: o.w || 380, h: o.h || 270, x0: o.x0 != null ? o.x0 : xs[0], x1: o.x1 != null ? o.x1 : xs[xs.length - 1], y0, y1, xstep: o.xstep, ystep: o.ystep, ylabel: o.ylabel, xlabel: o.xlabel, title: o.title });
    let s = f.s;
    o.series.forEach((ser, j) => {
      s += '<polyline class="fig-series s' + (j + 1) + '" points="' + xs.map((x, i) => n1(f.X(x)) + ',' + n1(f.Y(ser.vals[i]))).join(' ') + '"/>';
      xs.forEach((x, i) => { s += '<circle class="fig-mark s' + (j + 1) + '" cx="' + n1(f.X(x)) + '" cy="' + n1(f.Y(ser.vals[i])) + '" r="3.5"/>'; });
    });
    s += legend(o.series, f);
    return F.svg(f.W, f.H + (o.series.length > 1 ? 18 : 0), s, 'fig-chart', o.title || 'Line graph');
  };

  function legend(series, f) {
    if (series.length < 2) return '';
    let s = '', x = f.L;
    series.forEach((ser, j) => {
      s += '<rect class="fig-bar s' + (j + 1) + '" x="' + x + '" y="' + (f.H + 4) + '" width="12" height="12"/>' + text(x + 17, f.H + 10, esc(ser.name), { cls: 'fig-t tick', anchor: 'start' });
      x += 30 + ser.name.length * 6.6;
    });
    return s;
  }

  /* Dot plot for one-variable data: counts keyed by value. */
  F.dotplot = function (o) {
    const vals = Object.keys(o.counts).map(Number).sort((a, b) => a - b);
    const lo = o.min != null ? o.min : vals[0], hi = o.max != null ? o.max : vals[vals.length - 1];
    const W = 360, maxc = Math.max(...vals.map((v) => o.counts[v])), H = 60 + maxc * 16;
    const X = (v) => 30 + ((v - lo) / (hi - lo || 1)) * (W - 60);
    let s = line([20, H - 30], [W - 20, H - 30], 'fig-axis');
    for (let v = lo; v <= hi; v++) s += line([X(v), H - 34], [X(v), H - 26], 'fig-axis') + text(X(v), H - 14, v, { cls: 'fig-t tick' });
    vals.forEach((v) => { for (let i = 0; i < o.counts[v]; i++) s += '<circle class="fig-pt" cx="' + n1(X(v)) + '" cy="' + (H - 42 - i * 16) + '" r="6"/>'; });
    if (o.xlabel) s += text(W / 2, H - 1, esc(o.xlabel), { cls: 'fig-t axl' });
    return F.svg(W, H + 6, s, 'fig-chart', 'Dot plot');
  };

  /* HTML data table: {title, cols:[...], rows:[[...]]} */
  F.table = function (o) {
    let h = '<div class="data-table-wrap"><table class="data-table">';
    if (o.title) h += '<caption>' + o.title + '</caption>';
    h += '<thead><tr>' + o.cols.map((c) => '<th>' + c + '</th>').join('') + '</tr></thead><tbody>';
    o.rows.forEach((r) => { h += '<tr>' + r.map((c, i) => (i === 0 && o.rowHeads !== false ? '<th scope="row">' + c + '</th>' : '<td>' + c + '</td>')).join('') + '</tr>'; });
    return h + '</tbody></table></div>';
  };

  /* Sparkline / score trend for the progress page. */
  F.trend = function (vals, o) {
    o = o || {};
    if (!vals.length) return '';
    const W = o.w || 520, H = o.h || 180;
    const y0 = o.y0 != null ? o.y0 : 400, y1 = o.y1 != null ? o.y1 : 1600;
    const f = frame({ w: W, h: H, x0: 1, x1: Math.max(2, vals.length), y0, y1, xstep: 1, ystep: o.ystep || 200, xlabel: o.xlabel, padL: 46 });
    let s = f.s;
    s += '<polyline class="fig-series s1" points="' + vals.map((v, i) => n1(f.X(i + 1)) + ',' + n1(f.Y(v))).join(' ') + '"/>';
    vals.forEach((v, i) => { s += '<circle class="fig-mark s1" cx="' + n1(f.X(i + 1)) + '" cy="' + n1(f.Y(v)) + '" r="4"/>'; });
    return F.svg(W, H, s, 'fig-chart', 'Score trend');
  };
})();
