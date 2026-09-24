/*
 * SVG charts: interactive price chart (crosshair + range selection), sparklines,
 * donut, diverging bars, multi-series lines, stacked columns and a gauge.
 * Colors come from CSS custom properties so light and dark themes each use
 * their own validated steps.
 */
(function () {
  'use strict';
  const App = (window.App = window.App || {});
  const U = App.U;
  const C = (App.Chart = {});
  const NS = 'http://www.w3.org/2000/svg';

  const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  C.color = (dir) => (dir === 'up' ? css('--up-line') : dir === 'down' ? css('--down-line') : css('--label2'));
  C.series = (i) => css('--c' + ((i % 8) + 1));

  function niceStep(range, count) {
    const raw = range / Math.max(1, count);
    const mag = Math.pow(10, Math.floor(Math.log10(raw)));
    const n = raw / mag;
    const step = n >= 5 ? 10 : n >= 2 ? 5 : n >= 1 ? 2 : 1;
    return step * mag;
  }
  function ticks(min, max, count) {
    if (!(max > min)) return [min];
    const step = niceStep(max - min, count);
    const out = [];
    for (let v = Math.ceil(min / step) * step; v <= max + step * 1e-9; v += step) out.push(+v.toPrecision(12));
    return out;
  }
  C.ticks = ticks;

  function el(tag, attrs, parent) {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }

  function timeTicks(t0, t1, intraday, width) {
    const span = t1 - t0;
    const maxTicks = Math.max(2, Math.floor(width / 70));
    const out = [];
    const H = 3600000;
    const D = 86400000;
    if (intraday && span <= 1.6 * D) {
      const steps = [H, 2 * H, 3 * H, 4 * H, 6 * H];
      const step = steps.find((s) => span / s <= maxTicks) || 6 * H;
      const tz = 'America/New_York';
      let t = Math.ceil(t0 / step) * step;
      for (; t <= t1; t += step) out.push([t, U.fmtDate(t, { hour: 'numeric' }, span > 20 * H ? undefined : tz)]);
      return out;
    }
    if (span <= 10 * D) {
      let t = new Date(t0);
      t.setHours(0, 0, 0, 0);
      t = t.getTime() + D;
      const every = Math.ceil(span / D / maxTicks);
      for (let i = 0; t <= t1; t += D, i++) if (i % every === 0) out.push([t, U.fmtDate(t, { weekday: 'short' })]);
      return out;
    }
    if (span <= 400 * D) {
      const d = new Date(t0);
      d.setDate(1);
      d.setHours(0, 0, 0, 0);
      const months = Math.max(1, Math.ceil(span / (30 * D) / maxTicks));
      for (d.setMonth(d.getMonth() + 1); d.getTime() <= t1; d.setMonth(d.getMonth() + months)) out.push([d.getTime(), U.fmtDate(d.getTime(), { month: 'short' })]);
      return out;
    }
    const years = Math.max(1, Math.ceil(span / (365.25 * D) / maxTicks));
    const d = new Date(t0);
    const y0 = d.getFullYear() + 1;
    for (let y = Math.ceil(y0 / years) * years; ; y += years) {
      const t = new Date(y, 0, 1).getTime();
      if (t > t1) break;
      out.push([t, String(y)]);
    }
    return out;
  }

  // ------------------------------------------------------------------ price chart
  // opts: pts [[t, v]], pc, s, e, intraday, height, fmt(v), onScrub(info|null), live
  C.price = (host, opts) => {
    host.innerHTML = '';
    host.classList.add('chart-host');
    const pts = (opts.pts || []).filter((p) => U.isNum(p[1]));
    if (pts.length < 2) {
      host.innerHTML = '<div class="chart-empty">No chart data for this range</div>';
      return { destroy() {} };
    }
    const height = opts.height || 240;
    let width = host.clientWidth || 340;
    const padT = 18;
    const padB = opts.axis === false ? 4 : 24;
    const padR = opts.axis === false ? 0 : 52;
    const padL = 0;
    const first = pts[0][1];
    const last = pts[pts.length - 1][1];
    const ref = U.isNum(opts.pc) ? opts.pc : first;
    const dir = last > ref ? 'up' : last < ref ? 'down' : 'flat';
    const color = opts.color || C.color(dir);
    const t0 = U.isNum(opts.s) ? Math.min(opts.s, pts[0][0]) : pts[0][0];
    const t1 = U.isNum(opts.e) ? Math.max(opts.e, pts[pts.length - 1][0]) : pts[pts.length - 1][0];
    let lo = Infinity;
    let hi = -Infinity;
    pts.forEach((p) => { if (p[1] < lo) lo = p[1]; if (p[1] > hi) hi = p[1]; });
    if (U.isNum(opts.pc)) { lo = Math.min(lo, opts.pc); hi = Math.max(hi, opts.pc); }
    if (hi === lo) { hi += Math.abs(hi) * 0.01 || 1; lo -= Math.abs(lo) * 0.01 || 1; }
    const pad = (hi - lo) * 0.08;
    lo -= pad;
    hi += pad;

    const svg = el('svg', { class: 'chart', role: 'img', 'aria-label': opts.label || 'Price chart' });
    host.appendChild(svg);
    const gid = 'g' + Math.random().toString(36).slice(2, 8);

    let X;
    let Y;
    let plotW;
    const H = height - padT - padB;
    function layout() {
      width = host.clientWidth || width;
      plotW = width - padL - padR;
      X = (t) => padL + ((t - t0) / (t1 - t0 || 1)) * plotW;
      Y = (v) => padT + (1 - (v - lo) / (hi - lo)) * H;
    }

    let cross;
    let dot;
    let selRect;
    let vLabel;
    function draw() {
      layout();
      svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
      svg.setAttribute('width', width);
      svg.setAttribute('height', height);
      svg.innerHTML = '';
      const defs = el('defs', {}, svg);
      const g = el('linearGradient', { id: gid, x1: 0, x2: 0, y1: 0, y2: 1 }, defs);
      el('stop', { offset: '0%', 'stop-color': color, 'stop-opacity': 0.22 }, g);
      el('stop', { offset: '100%', 'stop-color': color, 'stop-opacity': 0 }, g);

      if (opts.axis !== false) {
        ticks(lo, hi, 4).forEach((v) => {
          const y = Y(v);
          if (y < padT - 2 || y > padT + H + 2) return;
          el('line', { x1: padL, x2: padL + plotW, y1: y, y2: y, class: 'grid' }, svg);
          const tx = el('text', { x: width - 4, y: y + 4, class: 'axis', 'text-anchor': 'end' }, svg);
          tx.textContent = opts.fmtAxis ? opts.fmtAxis(v) : U.fmtN(v, Math.abs(hi - lo) < 5 ? 2 : 0, Math.abs(hi - lo) < 0.5 ? 4 : Math.abs(hi - lo) < 5 ? 2 : 0);
        });
        timeTicks(t0, t1, opts.intraday, plotW).forEach(([t, label]) => {
          const x = X(t);
          if (x < padL + 12 || x > padL + plotW - 12) return;
          el('line', { x1: x, x2: x, y1: padT + H, y2: padT + H + 4, class: 'tick' }, svg);
          const tx = el('text', { x, y: height - 6, class: 'axis', 'text-anchor': 'middle' }, svg);
          tx.textContent = label;
        });
      }
      if (U.isNum(opts.pc)) el('line', { x1: padL, x2: padL + plotW, y1: Y(opts.pc), y2: Y(opts.pc), class: 'baseline' }, svg);

      let d = '';
      pts.forEach((p, i) => { d += (i ? 'L' : 'M') + X(p[0]).toFixed(1) + ',' + Y(p[1]).toFixed(1); });
      const lastX = X(pts[pts.length - 1][0]);
      el('path', { d: d + `L${lastX.toFixed(1)},${padT + H}L${X(pts[0][0]).toFixed(1)},${padT + H}Z`, fill: `url(#${gid})`, stroke: 'none' }, svg);
      el('path', { d, fill: 'none', stroke: color, 'stroke-width': 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round', class: 'line' }, svg);
      const endY = Y(last);
      if (opts.live) el('circle', { cx: lastX, cy: endY, r: 4, fill: color, class: 'pulse' }, svg);
      el('circle', { cx: lastX, cy: endY, r: 4, fill: color, stroke: css('--card'), 'stroke-width': 2 }, svg);

      selRect = el('rect', { x: 0, y: padT, width: 0, height: H, class: 'sel', visibility: 'hidden' }, svg);
      cross = el('line', { x1: 0, x2: 0, y1: padT - 6, y2: padT + H, class: 'cross', visibility: 'hidden' }, svg);
      dot = el('circle', { r: 5, fill: color, stroke: css('--card'), 'stroke-width': 2, visibility: 'hidden' }, svg);
      vLabel = el('text', { x: 0, y: 11, class: 'axis cross-label', 'text-anchor': 'middle', visibility: 'hidden' }, svg);
    }
    draw();

    // ---------------------------------------------------------- interaction
    const nearest = (x) => {
      let best = 0;
      let bd = Infinity;
      for (let i = 0; i < pts.length; i++) {
        const dd = Math.abs(X(pts[i][0]) - x);
        if (dd < bd) { bd = dd; best = i; }
      }
      return best;
    };
    const localX = (ev) => {
      const r = svg.getBoundingClientRect();
      return ((ev.clientX - r.left) / r.width) * width;
    };
    const pointers = new Map();
    let dragStart = null;
    function showPoint(i) {
      const p = pts[i];
      const x = X(p[0]);
      cross.setAttribute('x1', x);
      cross.setAttribute('x2', x);
      cross.setAttribute('visibility', 'visible');
      dot.setAttribute('cx', x);
      dot.setAttribute('cy', Y(p[1]));
      dot.setAttribute('visibility', 'visible');
      vLabel.setAttribute('x', U.clamp(x, 40, width - padR - 30));
      vLabel.textContent = opts.intraday ? U.fmtDate(p[0], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : U.fmtDate(p[0], { month: 'short', day: 'numeric', year: 'numeric' });
      vLabel.setAttribute('visibility', 'visible');
    }
    function hide() {
      [cross, dot, vLabel, selRect].forEach((n) => n && n.setAttribute('visibility', 'hidden'));
      if (opts.onScrub) opts.onScrub(null);
    }
    function showRange(i, j) {
      if (i > j) [i, j] = [j, i];
      const a = pts[i];
      const b = pts[j];
      selRect.setAttribute('x', X(a[0]));
      selRect.setAttribute('width', Math.max(1, X(b[0]) - X(a[0])));
      selRect.setAttribute('visibility', 'visible');
      cross.setAttribute('visibility', 'hidden');
      dot.setAttribute('visibility', 'hidden');
      vLabel.setAttribute('x', U.clamp((X(a[0]) + X(b[0])) / 2, 60, width - padR - 50));
      vLabel.textContent = (opts.intraday ? U.fmtDate(a[0], { hour: 'numeric', minute: '2-digit' }) : U.fmtDate(a[0], { month: 'short', day: 'numeric', year: '2-digit' })) + ' – ' + (opts.intraday ? U.fmtDate(b[0], { hour: 'numeric', minute: '2-digit' }) : U.fmtDate(b[0], { month: 'short', day: 'numeric', year: '2-digit' }));
      vLabel.setAttribute('visibility', 'visible');
      if (opts.onScrub) opts.onScrub({ range: [a, b] });
    }
    function onMove(ev) {
      if (ev.pointerType === 'mouse' && ev.buttons === 0 && !pointers.size) {
        const i = nearest(localX(ev));
        showPoint(i);
        if (opts.onScrub) opts.onScrub({ point: pts[i], ref });
        return;
      }
      if (!pointers.has(ev.pointerId)) return;
      pointers.set(ev.pointerId, localX(ev));
      const xs = [...pointers.values()];
      if (xs.length >= 2) { showRange(nearest(xs[0]), nearest(xs[1])); return; }
      if (dragStart !== null && ev.pointerType === 'mouse' && Math.abs(xs[0] - dragStart) > 6) { showRange(nearest(dragStart), nearest(xs[0])); return; }
      const i = nearest(xs[0]);
      showPoint(i);
      if (opts.onScrub) opts.onScrub({ point: pts[i], ref });
    }
    if (opts.interactive !== false) {
      svg.addEventListener('pointerdown', (ev) => {
        pointers.set(ev.pointerId, localX(ev));
        if (pointers.size === 1) dragStart = localX(ev);
        try { svg.setPointerCapture(ev.pointerId); } catch (e) { /* ignore */ }
        onMove(ev);
      });
      svg.addEventListener('pointermove', onMove);
      const end = (ev) => {
        pointers.delete(ev.pointerId);
        if (!pointers.size) { dragStart = null; if (ev.pointerType !== 'mouse' || ev.type === 'pointerleave') hide(); }
      };
      svg.addEventListener('pointerup', (ev) => { end(ev); if (ev.pointerType === 'mouse') { const i = nearest(localX(ev)); showPoint(i); if (opts.onScrub) opts.onScrub({ point: pts[i], ref }); } });
      svg.addEventListener('pointercancel', end);
      svg.addEventListener('pointerleave', (ev) => { if (ev.pointerType === 'mouse') { pointers.clear(); dragStart = null; hide(); } });
    }
    const ro = new ResizeObserver(() => { if (Math.abs((host.clientWidth || width) - width) > 2) draw(); });
    ro.observe(host);
    return { destroy() { ro.disconnect(); }, dir, color };
  };

  // ------------------------------------------------------------------ sparkline (string)
  C.spark = (values, o = {}) => {
    const v = (values || []).filter(U.isNum);
    const w = o.w || 64;
    const h = o.h || 28;
    if (v.length < 2) return `<svg class="spark" width="${w}" height="${h}"></svg>`;
    let lo = Math.min(...v);
    let hi = Math.max(...v);
    if (U.isNum(o.pc)) { lo = Math.min(lo, o.pc); hi = Math.max(hi, o.pc); }
    if (hi === lo) { hi += 1; lo -= 1; }
    const n = o.slots && o.slots > v.length ? o.slots : v.length;
    const x = (i) => 1 + (i / (n - 1)) * (w - 2);
    const y = (val) => 2 + (1 - (val - lo) / (hi - lo)) * (h - 4);
    const ref = U.isNum(o.pc) ? o.pc : v[0];
    const dir = o.dir || (v[v.length - 1] > ref ? 'up' : v[v.length - 1] < ref ? 'down' : 'flat');
    let d = '';
    v.forEach((val, i) => { d += (i ? 'L' : 'M') + x(i).toFixed(1) + ',' + y(val).toFixed(1); });
    const base = U.isNum(o.pc) ? `<line x1="0" x2="${w}" y1="${y(o.pc).toFixed(1)}" y2="${y(o.pc).toFixed(1)}" class="spark-base"/>` : '';
    const fill = o.fill ? `<path d="${d}L${x(v.length - 1).toFixed(1)},${h}L${x(0).toFixed(1)},${h}Z" class="spark-fill ${dir}"/>` : '';
    return `<svg class="spark" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" aria-hidden="true">${base}${fill}<path d="${d}" class="spark-line ${dir}"/></svg>`;
  };

  // ------------------------------------------------------------------ donut
  // segs: [{label, value, color, id}]; returns an element with a legend.
  C.donut = (host, segs, o = {}) => {
    const total = segs.reduce((s, x) => s + Math.max(0, x.value), 0);
    const size = o.size || 200;
    const th = o.thickness || 26;
    const r = size / 2 - th / 2 - 2;
    const cx = size / 2;
    const cy = size / 2;
    const gap = segs.length > 1 ? 0.018 : 0;
    let a0 = -Math.PI / 2;
    const arcs = segs.map((s, i) => {
      const frac = total ? Math.max(0, s.value) / total : 0;
      const a1 = a0 + frac * Math.PI * 2;
      const start = a0 + (frac > gap * 2 ? gap : 0);
      const end = a1 - (frac > gap * 2 ? gap : 0);
      a0 = a1;
      const large = end - start > Math.PI ? 1 : 0;
      const p = (a) => [cx + r * Math.cos(a), cy + r * Math.sin(a)];
      const [x0, y0] = p(start);
      const [x1, y1] = p(end);
      const d = frac >= 0.999 ? `M${cx},${cy - r}A${r},${r} 0 1 1 ${cx - 0.01},${cy - r}` : `M${x0.toFixed(2)},${y0.toFixed(2)}A${r},${r} 0 ${large} 1 ${x1.toFixed(2)},${y1.toFixed(2)}`;
      return `<path d="${d}" stroke="${s.color}" stroke-width="${th}" fill="none" data-i="${i}" class="arc"><title>${U.esc(s.label)}: ${U.pctPlain(frac * 100, 1)}</title></path>`;
    });
    const center = o.center ? `<text x="${cx}" y="${cy - 4}" text-anchor="middle" class="donut-t">${U.esc(o.center.t)}</text><text x="${cx}" y="${cy + 16}" text-anchor="middle" class="donut-s">${U.esc(o.center.s || '')}</text>` : '';
    const legend = segs.map((s, i) => `<div class="leg-row" data-i="${i}"><span class="sw" style="background:${s.color}"></span><span class="leg-l">${U.esc(s.label)}</span><span class="leg-v">${o.fmt ? o.fmt(s.value) : ''}</span><span class="leg-p">${U.pctPlain(total ? (s.value / total) * 100 : 0, 1)}</span></div>`).join('');
    host.innerHTML = `<div class="donut"><svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" role="img" aria-label="${U.esc(o.label || 'Allocation')}">${arcs.join('')}${center}</svg><div class="legend">${legend}</div></div>`;
    const svg = host.querySelector('svg');
    const hl = (i) => {
      host.querySelectorAll('.arc').forEach((p) => p.classList.toggle('dim', i !== null && +p.dataset.i !== i));
      host.querySelectorAll('.leg-row').forEach((p) => p.classList.toggle('on', i !== null && +p.dataset.i === i));
    };
    host.addEventListener('pointerover', (e) => { const t = e.target.closest('[data-i]'); hl(t ? +t.dataset.i : null); });
    host.addEventListener('pointerleave', () => hl(null));
    if (o.onClick) host.addEventListener('click', (e) => { const t = e.target.closest('[data-i]'); if (t) o.onClick(segs[+t.dataset.i]); });
    return svg;
  };

  // ------------------------------------------------------------------ diverging bars (HTML)
  C.divBars = (rows, o = {}) => {
    const max = Math.max(0.01, ...rows.map((r) => Math.abs(r.value || 0)));
    return `<div class="dbars">${rows.map((r) => {
      const v = r.value;
      const w = U.isNum(v) ? (Math.abs(v) / max) * 50 : 0;
      const dir = U.dir(v);
      return `<div class="dbar-row" ${r.id ? `data-go="${U.esc(r.id)}"` : ''}><span class="dbar-l">${U.esc(r.label)}</span><span class="dbar-track"><span class="dbar-mid"></span><span class="dbar ${dir}" style="${v >= 0 ? 'left:50%' : 'right:50%'};width:${w.toFixed(2)}%"></span></span><span class="dbar-v ${dir}">${o.fmt ? o.fmt(v) : U.pct(v)}</span></div>`;
    }).join('')}</div>`;
  };

  // ------------------------------------------------------------------ gauge
  C.gauge = (value, o = {}) => {
    const w = o.w || 180;
    const h = w * 0.58;
    const cx = w / 2;
    const cy = h - 6;
    const r = w / 2 - 14;
    const segs = [[0, 25, '--g1'], [25, 45, '--g2'], [45, 55, '--g3'], [55, 75, '--g4'], [75, 100, '--g5']];
    const ang = (v) => Math.PI * (1 - v / 100);
    const pt = (v, rr) => [cx + rr * Math.cos(ang(v)), cy - rr * Math.sin(ang(v))];
    const arcs = segs.map(([a, b, c]) => {
      const [x0, y0] = pt(a + 0.8, r);
      const [x1, y1] = pt(b - 0.8, r);
      return `<path d="M${x0.toFixed(1)},${y0.toFixed(1)}A${r},${r} 0 0 1 ${x1.toFixed(1)},${y1.toFixed(1)}" stroke="var(${c})" stroke-width="12" fill="none" stroke-linecap="butt"/>`;
    }).join('');
    const v = U.clamp(U.isNum(value) ? value : 50, 0, 100);
    const [nx, ny] = pt(v, r - 18);
    return `<svg class="gauge" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="${U.esc(o.label || 'Gauge')}: ${U.isNum(value) ? value : 'n/a'}">${arcs}<line x1="${cx}" y1="${cy}" x2="${nx.toFixed(1)}" y2="${ny.toFixed(1)}" class="needle"/><circle cx="${cx}" cy="${cy}" r="5" class="needle-hub"/></svg>`;
  };

  // ------------------------------------------------------------------ multi-series lines
  // series: [{name, color, pts: [[x, y]]}], o: {xLabels: [[x, label]], fmtY, fmtX, height}
  C.multi = (host, series, o = {}) => {
    host.innerHTML = '';
    host.classList.add('chart-host');
    const height = o.height || 220;
    const padT = 10;
    const padB = 24;
    const padR = 46;
    const svg = el('svg', { class: 'chart', role: 'img', 'aria-label': o.label || 'Chart' });
    host.appendChild(svg);
    const tip = document.createElement('div');
    tip.className = 'chart-tip';
    host.appendChild(tip);
    const all = series.flatMap((s) => s.pts.filter((p) => U.isNum(p[1])));
    if (!all.length) { host.innerHTML = '<div class="chart-empty">No data</div>'; return; }
    let x0 = Math.min(...all.map((p) => p[0]));
    let x1 = Math.max(...all.map((p) => p[0]));
    let lo = Math.min(...all.map((p) => p[1]));
    let hi = Math.max(...all.map((p) => p[1]));
    if (o.zero) { lo = Math.min(0, lo); hi = Math.max(0, hi); }
    const pad = (hi - lo) * 0.1 || 1;
    lo -= pad;
    hi += pad;
    let width;
    let X;
    let Y;
    const H = height - padT - padB;
    function draw() {
      width = host.clientWidth || 340;
      X = (x) => ((x - x0) / (x1 - x0 || 1)) * (width - padR - 8) + 4;
      Y = (y) => padT + (1 - (y - lo) / (hi - lo)) * H;
      svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
      svg.setAttribute('width', width);
      svg.setAttribute('height', height);
      svg.innerHTML = '';
      ticks(lo, hi, 4).forEach((v) => {
        const y = Y(v);
        if (y < padT - 1 || y > padT + H + 1) return;
        el('line', { x1: 0, x2: width - padR, y1: y, y2: y, class: v === 0 && o.zero ? 'baseline' : 'grid' }, svg);
        el('text', { x: width - 4, y: y + 4, class: 'axis', 'text-anchor': 'end' }, svg).textContent = o.fmtY ? o.fmtY(v) : U.fmtN(v, 0, 2);
      });
      const xl = o.xLabels || timeTicks(x0, x1, false, width - padR);
      const every = Math.max(1, Math.ceil(xl.length / Math.max(2, Math.floor((width - padR) / 46))));
      xl.forEach(([x, label], i) => {
        if (i % every) return;
        el('text', { x: U.clamp(X(x), 12, width - padR - 10), y: height - 6, class: 'axis', 'text-anchor': 'middle' }, svg).textContent = label;
      });
      series.forEach((s) => {
        const p = s.pts.filter((q) => U.isNum(q[1]));
        if (!p.length) return;
        let d = '';
        p.forEach((q, i) => { d += (i ? 'L' : 'M') + X(q[0]).toFixed(1) + ',' + Y(q[1]).toFixed(1); });
        el('path', { d, fill: 'none', stroke: s.color, 'stroke-width': 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round', 'stroke-dasharray': s.dash ? '4 4' : 'none' }, svg);
        if (o.dots) p.forEach((q) => el('circle', { cx: X(q[0]), cy: Y(q[1]), r: 3.5, fill: s.color, stroke: css('--card'), 'stroke-width': 2 }, svg));
      });
      const cross = el('line', { x1: 0, x2: 0, y1: padT, y2: padT + H, class: 'cross', visibility: 'hidden' }, svg);
      svg.onpointermove = (ev) => {
        const r = svg.getBoundingClientRect();
        const lx = ((ev.clientX - r.left) / r.width) * width;
        const xs = [...new Set(all.map((p) => p[0]))].sort((a, b) => a - b);
        let best = xs[0];
        xs.forEach((x) => { if (Math.abs(X(x) - lx) < Math.abs(X(best) - lx)) best = x; });
        cross.setAttribute('x1', X(best));
        cross.setAttribute('x2', X(best));
        cross.setAttribute('visibility', 'visible');
        const rows = series.map((s) => {
          const p = s.pts.find((q) => q[0] === best) || s.pts.reduce((a, q) => (Math.abs(q[0] - best) < Math.abs(a[0] - best) ? q : a), s.pts[0]);
          return `<div class="tip-row"><span class="sw" style="background:${s.color}"></span><span>${U.esc(s.name)}</span><b>${p && U.isNum(p[1]) ? (o.fmtY ? o.fmtY(p[1]) : U.fmtN(p[1], 2)) : '—'}</b></div>`;
        }).join('');
        const lab = o.fmtX ? o.fmtX(best) : (xl.find((q) => q[0] === best) || [0, ''])[1];
        tip.innerHTML = `<div class="tip-h">${U.esc(lab)}</div>${rows}`;
        tip.style.display = 'block';
        const tx = (X(best) / width) * r.width;
        tip.style.left = U.clamp(tx + 12, 0, r.width - tip.offsetWidth) + 'px';
        tip.style.top = '4px';
      };
      svg.onpointerleave = () => { cross.setAttribute('visibility', 'hidden'); tip.style.display = 'none'; };
    }
    draw();
    const ro = new ResizeObserver(() => draw());
    ro.observe(host);
    if (o.legend !== false && series.length > 1) {
      const lg = document.createElement('div');
      lg.className = 'chart-legend';
      lg.innerHTML = series.map((s) => `<span><i class="sw${s.dash ? ' dash' : ''}" style="background:${s.color}"></i>${U.esc(s.name)}</span>`).join('');
      host.appendChild(lg);
    }
  };

  // ------------------------------------------------------------------ stacked columns
  // cats: [label], series: [{name, color, values: []}]
  C.columns = (host, cats, series, o = {}) => {
    host.innerHTML = '';
    host.classList.add('chart-host');
    const height = o.height || 220;
    const padT = 10;
    const padB = 22;
    const padR = 50;
    const totals = cats.map((_, i) => series.reduce((s, x) => s + Math.max(0, x.values[i] || 0), 0));
    const hi = Math.max(...totals) * 1.08 || 1;
    const svg = el('svg', { class: 'chart', role: 'img', 'aria-label': o.label || 'Columns' });
    host.appendChild(svg);
    const tip = document.createElement('div');
    tip.className = 'chart-tip';
    host.appendChild(tip);
    function draw() {
      const width = host.clientWidth || 340;
      const H = height - padT - padB;
      const band = (width - padR) / cats.length;
      const bw = Math.min(24, band * 0.7);
      svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
      svg.setAttribute('width', width);
      svg.setAttribute('height', height);
      svg.innerHTML = '';
      const Y = (v) => padT + (1 - v / hi) * H;
      ticks(0, hi, 4).forEach((v) => {
        el('line', { x1: 0, x2: width - padR, y1: Y(v), y2: Y(v), class: v === 0 ? 'baseline-solid' : 'grid' }, svg);
        el('text', { x: width - 4, y: Y(v) + 4, class: 'axis', 'text-anchor': 'end' }, svg).textContent = o.fmtY ? o.fmtY(v) : U.compact(v);
      });
      const every = Math.max(1, Math.ceil(cats.length / Math.floor((width - padR) / 36)));
      cats.forEach((c, i) => {
        const x = i * band + (band - bw) / 2;
        let acc = 0;
        series.forEach((s, si) => {
          const v = Math.max(0, s.values[i] || 0);
          if (!v) return;
          const y0 = Y(acc);
          const y1 = Y(acc + v);
          const top = si === series.length - 1 || series.slice(si + 1).every((t) => !(t.values[i] > 0));
          const hgt = Math.max(0, y0 - y1 - (acc > 0 ? 2 : 0));
          const r = top ? Math.min(4, hgt / 2, bw / 2) : 0;
          const yy = y1;
          const d = `M${x},${yy + hgt}V${yy + r}Q${x},${yy} ${x + r},${yy}H${x + bw - r}Q${x + bw},${yy} ${x + bw},${yy + r}V${yy + hgt}Z`;
          el('path', { d, fill: s.color, 'data-i': i }, svg);
          acc += v;
        });
        if (i % every === 0) el('text', { x: x + bw / 2, y: height - 6, class: 'axis', 'text-anchor': 'middle' }, svg).textContent = c;
        const hit = el('rect', { x: i * band, y: padT, width: band, height: H, fill: 'transparent', 'data-i': i }, svg);
        hit.addEventListener('pointerenter', () => {
          tip.innerHTML = `<div class="tip-h">${U.esc(c)}</div>` + series.map((s) => `<div class="tip-row"><span class="sw" style="background:${s.color}"></span><span>${U.esc(s.name)}</span><b>${o.fmtY ? o.fmtY(s.values[i] || 0) : U.compact(s.values[i] || 0)}</b></div>`).join('') + (series.length > 1 ? `<div class="tip-row"><span class="sw" style="background:transparent"></span><span>Total</span><b>${o.fmtY ? o.fmtY(totals[i]) : U.compact(totals[i])}</b></div>` : '');
          tip.style.display = 'block';
          const r = svg.getBoundingClientRect();
          tip.style.left = U.clamp(((i * band + band) / width) * r.width + 6, 0, r.width - tip.offsetWidth) + 'px';
          tip.style.top = '4px';
        });
      });
      svg.onpointerleave = () => { tip.style.display = 'none'; };
    }
    draw();
    const ro = new ResizeObserver(() => draw());
    ro.observe(host);
    if (series.length > 1) {
      const lg = document.createElement('div');
      lg.className = 'chart-legend';
      lg.innerHTML = series.map((s) => `<span><i class="sw" style="background:${s.color}"></i>${U.esc(s.name)}</span>`).join('');
      host.appendChild(lg);
    }
  };

  // Range bar (e.g. 52-week range, analyst targets) as HTML.
  C.rangeBar = (lo, hi, cur, o = {}) => {
    if (!U.isNum(lo) || !U.isNum(hi) || hi <= lo) return '';
    const pos = U.clamp(((cur - lo) / (hi - lo)) * 100, 0, 100);
    const mid = U.isNum(o.mid) ? U.clamp(((o.mid - lo) / (hi - lo)) * 100, 0, 100) : null;
    return `<div class="rbar"><div class="rbar-track">${mid !== null ? `<span class="rbar-mid" style="left:${mid}%"></span>` : ''}<span class="rbar-dot" style="left:${pos}%"></span></div><div class="rbar-labels"><span>${o.fmt ? o.fmt(lo) : lo}</span>${o.midLabel ? `<span class="rbar-ml">${o.midLabel}</span>` : ''}<span>${o.fmt ? o.fmt(hi) : hi}</span></div></div>`;
  };
})();
