/* Floating tool windows: draggable, resizable, remembered positions.
   On narrow screens they dock as bottom sheets. Tools register themselves in
   SAT.tools and open with SAT.openTool(id). */
(function () {
  'use strict';
  const SAT = window.SAT, U = SAT.util, h = U.h;
  const open = {};
  let z = 50;

  SAT.tools = {};
  const narrow = () => window.innerWidth < 720;

  function place(win, id, o) {
    const pos = (SAT.store.get('winpos', {}) || {})[id];
    const W = window.innerWidth, H = window.innerHeight;
    const w = U.clamp((pos && pos.w) || o.w || 420, 280, W - 16), hh = U.clamp((pos && pos.h) || o.h || 480, 200, H - 80);
    const x = U.clamp(pos ? pos.x : W - w - 24 - Object.keys(open).length * 24, 8, W - w - 8);
    const y = U.clamp(pos ? pos.y : 80 + Object.keys(open).length * 24, 56, H - 120);
    Object.assign(win.style, { left: x + 'px', top: y + 'px', width: w + 'px', height: hh + 'px' });
  }
  function save(id, win) {
    const all = SAT.store.get('winpos', {}) || {};
    all[id] = { x: win.offsetLeft, y: win.offsetTop, w: win.offsetWidth, h: win.offsetHeight };
    SAT.store.set('winpos', all);
  }

  function makeDraggable(win, handle, id) {
    let sx, sy, ox, oy, active = false;
    const down = (e) => {
      if (narrow() || e.target.closest('button')) return;
      const p = e.touches ? e.touches[0] : e;
      active = true; sx = p.clientX; sy = p.clientY; ox = win.offsetLeft; oy = win.offsetTop;
      win.classList.add('dragging'); e.preventDefault();
    };
    const move = (e) => {
      if (!active) return;
      const p = e.touches ? e.touches[0] : e;
      win.style.left = U.clamp(ox + p.clientX - sx, -win.offsetWidth + 80, window.innerWidth - 80) + 'px';
      win.style.top = U.clamp(oy + p.clientY - sy, 0, window.innerHeight - 40) + 'px';
    };
    const up = () => { if (active) { active = false; win.classList.remove('dragging'); save(id, win); } };
    handle.addEventListener('mousedown', down);
    handle.addEventListener('touchstart', down, { passive: false });
    window.addEventListener('mousemove', move);
    window.addEventListener('touchmove', move, { passive: true });
    window.addEventListener('mouseup', up);
    window.addEventListener('touchend', up);
    return () => {
      window.removeEventListener('mousemove', move); window.removeEventListener('touchmove', move);
      window.removeEventListener('mouseup', up); window.removeEventListener('touchend', up);
    };
  }
  function makeResizable(win, grip, id, onResize) {
    let sx, sy, ow, oh, active = false;
    grip.addEventListener('mousedown', (e) => { active = true; sx = e.clientX; sy = e.clientY; ow = win.offsetWidth; oh = win.offsetHeight; e.preventDefault(); e.stopPropagation(); });
    const move = (e) => {
      if (!active) return;
      win.style.width = Math.max(280, ow + e.clientX - sx) + 'px';
      win.style.height = Math.max(200, oh + e.clientY - sy) + 'px';
      if (onResize) onResize();
    };
    const up = () => { if (active) { active = false; save(id, win); if (onResize) onResize(); } };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
    return () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); };
  }

  SAT.win = {
    open(id, o) {
      if (open[id]) { SAT.win.focus(id); return open[id]; }
      const body = h('div.win-body');
      const closeBtn = h('button.icon-btn', { title: 'Close', 'aria-label': 'Close ' + o.title, html: U.icon('x') });
      const head = h('div.win-head', h('span.win-ic', { html: U.icon(o.icon || 'tool') }), h('span.win-title', o.title), h('span.spacer'), ...(o.headButtons || []), closeBtn);
      const grip = h('div.win-grip', { 'aria-hidden': 'true' });
      const win = h('div.win.card', { role: 'dialog', 'aria-label': o.title, dataset: { id } }, head, body, grip);
      U.$('#windows').appendChild(win);
      place(win, id, o);
      const api = { id, el: win, body, onResize: null, close: () => SAT.win.close(id) };
      const offs = [makeDraggable(win, head, id), makeResizable(win, grip, id, () => api.onResize && api.onResize())];
      api.cleanup = () => offs.forEach((f) => f());
      closeBtn.addEventListener('click', () => SAT.win.close(id));
      win.addEventListener('mousedown', () => SAT.win.focus(id));
      open[id] = api;
      SAT.win.focus(id);
      if (o.build) o.build(body, api);
      requestAnimationFrame(() => win.classList.add('in'));
      SAT.bus.emit('win', { id, open: true });
      return api;
    },
    close(id) {
      const w = open[id];
      if (!w) return;
      if (w.onClose) w.onClose();
      w.cleanup();
      w.el.remove();
      delete open[id];
      SAT.bus.emit('win', { id, open: false });
    },
    toggle(id, o) { if (open[id]) SAT.win.close(id); else SAT.win.open(id, o); },
    focus(id) { if (open[id]) open[id].el.style.zIndex = ++z; },
    isOpen: (id) => !!open[id],
    closeAll() { Object.keys(open).forEach(SAT.win.close); },
  };

  SAT.openTool = (id, arg) => {
    const t = SAT.tools[id];
    if (!t) return;
    const w = SAT.win.open(id, { title: t.title, icon: t.icon, w: t.w, h: t.h, build: t.build });
    if (arg != null && w.onArg) w.onArg(arg);
    return w;
  };
  SAT.toggleTool = (id) => { if (SAT.win.isOpen(id)) SAT.win.close(id); else SAT.openTool(id); };
})();
