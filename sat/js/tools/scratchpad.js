/* Scratchpad: freehand drawing (pen, highlighter, eraser, undo) and a
   plain-text notes tab. Works with mouse, pen, and touch. */
(function () {
  'use strict';
  const SAT = window.SAT, U = SAT.util, h = U.h;
  const PENS = ['#1f2937', '#2563eb', '#dc2626', '#16a34a', '#9333ea'];

  SAT.tools.pad = {
    title: 'Scratchpad', icon: 'pen', w: 560, h: 480,
    build(body, api) {
      const tabDraw = h('button.tab.on', { text: 'Draw' }), tabNote = h('button.tab', { text: 'Notes' });
      const host = h('div.pad-host');
      body.appendChild(h('div.tabs', tabDraw, tabNote)); body.appendChild(host);
      let strokes = SAT.store.get('pad.strokes', []) || [], color = PENS[0], size = 3, tool = 'pen';
      let canvas, ctx, ro;

      function redraw() {
        if (!ctx) return;
        const dpr = window.devicePixelRatio || 1;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        strokes.forEach((s) => {
          ctx.globalCompositeOperation = s.tool === 'eraser' ? 'destination-out' : 'source-over';
          ctx.globalAlpha = s.tool === 'marker' ? 0.35 : 1;
          ctx.strokeStyle = s.color; ctx.lineWidth = s.size; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
          ctx.beginPath();
          s.pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
          if (s.pts.length === 1) ctx.lineTo(s.pts[0][0] + 0.1, s.pts[0][1]);
          ctx.stroke();
        });
        ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
      }
      function size2() {
        const r = canvas.parentElement.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
        canvas.width = r.width * dpr; canvas.height = r.height * dpr;
        canvas.style.width = r.width + 'px'; canvas.style.height = r.height + 'px';
        redraw();
      }
      function showDraw() {
        tabDraw.classList.add('on'); tabNote.classList.remove('on'); host.innerHTML = '';
        const tools = h('div.pad-tools');
        const mk = (name, ic, title) => { const b = h('button.icon-btn' + (tool === name ? '.on' : ''), { title, html: U.icon(ic) }); b.addEventListener('click', () => { tool = name; U.$$('.pad-tools .icon-btn', host).forEach((x) => x.classList.remove('on')); b.classList.add('on'); }); return b; };
        tools.appendChild(mk('pen', 'pen', 'Pen'));
        tools.appendChild(mk('marker', 'marker', 'Highlighter'));
        tools.appendChild(mk('eraser', 'eraser', 'Eraser'));
        PENS.forEach((c) => { const b = h('button.swatch' + (c === color ? '.on' : ''), { title: 'Color', style: { background: c } }); b.addEventListener('click', () => { color = c; U.$$('.swatch', tools).forEach((x) => x.classList.remove('on')); b.classList.add('on'); if (tool === 'eraser') tool = 'pen'; }); tools.appendChild(b); });
        const sz = h('input', { type: 'range', min: 1, max: 14, value: size, title: 'Size', 'aria-label': 'Brush size' });
        sz.addEventListener('input', () => (size = +sz.value));
        const undo = h('button.icon-btn', { title: 'Undo', html: U.icon('undo') });
        const clear = h('button.icon-btn', { title: 'Clear all', html: U.icon('trash') });
        undo.addEventListener('click', () => { strokes.pop(); SAT.store.set('pad.strokes', strokes); redraw(); });
        clear.addEventListener('click', () => { strokes = []; SAT.store.set('pad.strokes', strokes); redraw(); });
        tools.appendChild(sz); tools.appendChild(h('span.spacer')); tools.appendChild(undo); tools.appendChild(clear);
        canvas = h('canvas.pad-canvas', { 'aria-label': 'Drawing area' });
        const wrap = h('div.pad-wrap', canvas);
        host.appendChild(tools); host.appendChild(wrap);
        ctx = canvas.getContext('2d');
        let cur = null;
        const pt = (e) => { const r = canvas.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
        canvas.addEventListener('pointerdown', (e) => { canvas.setPointerCapture(e.pointerId); cur = { tool, color, size: tool === 'eraser' ? size * 4 : tool === 'marker' ? size * 4 : size, pts: [pt(e)] }; strokes.push(cur); redraw(); });
        canvas.addEventListener('pointermove', (e) => { if (!cur) return; cur.pts.push(pt(e)); redraw(); });
        const end = () => { if (cur) { cur = null; SAT.store.set('pad.strokes', strokes.slice(-300)); } };
        canvas.addEventListener('pointerup', end); canvas.addEventListener('pointercancel', end);
        if (ro) ro.disconnect();
        ro = window.ResizeObserver ? new ResizeObserver(size2) : null;
        if (ro) ro.observe(wrap);
        setTimeout(size2, 20);
      }
      function showNotes() {
        tabNote.classList.add('on'); tabDraw.classList.remove('on'); host.innerHTML = '';
        if (ro) { ro.disconnect(); ro = null; } ctx = null;
        const ta = h('textarea.pad-notes', { placeholder: 'Type notes, set up equations, list what you know…', 'aria-label': 'Notes' });
        ta.value = SAT.store.get('pad.notes', '');
        ta.addEventListener('input', U.debounce(() => SAT.store.set('pad.notes', ta.value), 300));
        host.appendChild(ta); setTimeout(() => ta.focus(), 30);
      }
      tabDraw.addEventListener('click', showDraw); tabNote.addEventListener('click', showNotes);
      api.onClose = () => { if (ro) ro.disconnect(); };
      showDraw();
    },
  };
})();
