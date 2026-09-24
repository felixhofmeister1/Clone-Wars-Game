/* SAT Studio core: DOM helpers, seeded random numbers, storage, routing,
   modals, popovers, toasts, icons and math rendering. Everything hangs off
   window.SAT so the app runs from file:// without a build step. */
(function () {
  'use strict';
  const SAT = (window.SAT = window.SAT || {});
  const U = (SAT.util = {});

  /* ------------------------------------------------------------- DOM */
  U.$ = (sel, root) => (root || document).querySelector(sel);
  U.$$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  // h('div.card#x', {onclick, html, style...}, child, child...)
  U.h = function (spec, attrs, ...kids) {
    const m = /^([a-z0-9-]+)?((?:[.#][\w-]+)*)$/i.exec(spec) || [];
    const el = document.createElement(m[1] || 'div');
    (m[2] || '').replace(/([.#])([\w-]+)/g, (_, t, v) => {
      if (t === '.') el.classList.add(v); else el.id = v;
    });
    if (attrs && (typeof attrs !== 'object' || attrs instanceof Node || Array.isArray(attrs))) {
      kids.unshift(attrs); attrs = null;
    }
    if (attrs) {
      for (const k in attrs) {
        const v = attrs[k];
        if (v == null || v === false) continue;
        if (k === 'html') el.innerHTML = v;
        else if (k === 'text') el.textContent = v;
        else if (k === 'class') el.className += (el.className ? ' ' : '') + v;
        else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
        else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
        else if (k === 'dataset') Object.assign(el.dataset, v);
        else el.setAttribute(k, v === true ? '' : v);
      }
    }
    for (const kid of kids.flat(Infinity)) {
      if (kid == null || kid === false) continue;
      el.appendChild(kid instanceof Node ? kid : document.createTextNode(String(kid)));
    }
    return el;
  };
  U.frag = (html) => { const t = document.createElement('template'); t.innerHTML = html; return t.content; };
  U.esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /* ------------------------------------------------------ numbers/time */
  U.clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  U.pct = (a, b) => (b ? Math.round((100 * a) / b) : 0);
  U.fmtTime = (s) => {
    s = Math.max(0, Math.round(s));
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = s % 60;
    return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(ss).padStart(2, '0');
  };
  U.today = (d) => {
    d = d || new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  };
  U.uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  U.debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
  U.plural = (n, w, ws) => n + ' ' + (n === 1 ? w : ws || w + 's');

  /* ------------------------------------------------------ seeded random */
  U.hash = function (str) { // cyrb53-lite -> 32-bit
    let h1 = 0xdeadbeef ^ 0, h2 = 0x41c6ce57 ^ 0;
    str = String(str);
    for (let i = 0; i < str.length; i++) {
      const ch = str.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761); h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    return (h1 >>> 0);
  };
  U.rng = function (seed) { // mulberry32
    let a = (typeof seed === 'number' ? seed : U.hash(seed)) >>> 0;
    const r = function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    r.int = (lo, hi) => lo + Math.floor(r() * (hi - lo + 1));
    r.pick = (arr) => arr[Math.floor(r() * arr.length)];
    r.bool = (p) => r() < (p == null ? 0.5 : p);
    r.shuffle = (arr) => {
      const a2 = arr.slice();
      for (let i = a2.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a2[i], a2[j]] = [a2[j], a2[i]]; }
      return a2;
    };
    r.sample = (arr, n) => r.shuffle(arr).slice(0, n);
    return r;
  };
  U.random = U.rng(Date.now() ^ (Math.random() * 1e9));

  /* ------------------------------------------------------------ storage */
  const PREFIX = 'satstudio.v1.';
  const memory = {};
  SAT.store = {
    get(k, d) {
      try {
        const v = localStorage.getItem(PREFIX + k);
        if (v != null) return JSON.parse(v);
      } catch (e) { if (k in memory) return memory[k]; }
      return k in memory ? memory[k] : d;
    },
    set(k, v) {
      memory[k] = v;
      try { localStorage.setItem(PREFIX + k, JSON.stringify(v)); return true; } catch (e) { return false; }
    },
    del(k) { delete memory[k]; try { localStorage.removeItem(PREFIX + k); } catch (e) { /* ignore */ } },
    all() {
      const out = {};
      try {
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && k.startsWith(PREFIX)) out[k.slice(PREFIX.length)] = JSON.parse(localStorage.getItem(k));
        }
      } catch (e) { Object.assign(out, memory); }
      return out;
    },
    clear() {
      Object.keys(memory).forEach((k) => delete memory[k]);
      try {
        Object.keys(localStorage).filter((k) => k.startsWith(PREFIX)).forEach((k) => localStorage.removeItem(k));
      } catch (e) { /* ignore */ }
    },
  };

  /* --------------------------------------------------------------- bus */
  const handlers = {};
  SAT.bus = {
    on(ev, fn) { (handlers[ev] = handlers[ev] || []).push(fn); return () => SAT.bus.off(ev, fn); },
    off(ev, fn) { handlers[ev] = (handlers[ev] || []).filter((f) => f !== fn); },
    emit(ev, data) { (handlers[ev] || []).slice().forEach((f) => { try { f(data); } catch (e) { console.error(e); } }); },
  };

  /* ------------------------------------------------------------ router */
  SAT.router = {
    routes: [],
    cleanup: null,
    current: null,
    on(pattern, handler, opts) {
      const keys = [];
      const re = new RegExp('^' + pattern.replace(/:(\w+)/g, (_, k) => { keys.push(k); return '([^/]+)'; }) + '/?$');
      this.routes.push({ re, keys, handler, opts: opts || {} });
    },
    go(path, replace) {
      const h = '#' + path;
      if (location.hash === h) this.resolve();
      else if (replace) { history.replaceState(null, '', h); this.resolve(); }
      else location.hash = h;
    },
    resolve() {
      const raw = location.hash.slice(1) || '/home';
      const [path, qs] = raw.split('?');
      const query = {};
      (qs || '').split('&').filter(Boolean).forEach((p) => {
        const [k, v] = p.split('=');
        query[decodeURIComponent(k)] = decodeURIComponent(v || '');
      });
      for (const r of this.routes) {
        const m = r.re.exec(path);
        if (!m) continue;
        const params = {};
        r.keys.forEach((k, i) => (params[k] = decodeURIComponent(m[i + 1])));
        if (this.cleanup) { try { this.cleanup(); } catch (e) { console.error(e); } this.cleanup = null; }
        this.current = { path, params, query, opts: r.opts };
        document.body.classList.toggle('immersive', !!r.opts.immersive);
        SAT.bus.emit('route', this.current);
        r.handler(params, query);
        return;
      }
      this.go('/home', true);
    },
    start() {
      window.addEventListener('hashchange', () => this.resolve());
      this.resolve();
    },
  };

  /* ------------------------------------------------------------- icons */
  const ICONS = {
    home: '<path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/>',
    clipboard: '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V2.5h6V4"/><path d="M9 10h6M9 14h6M9 18h4"/>',
    target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.2"/>',
    book: '<path d="M2 5h7a3 3 0 0 1 3 3v12a2.5 2.5 0 0 0-2.5-2.5H2z"/><path d="M22 5h-7a3 3 0 0 0-3 3v12a2.5 2.5 0 0 1 2.5-2.5H22z"/>',
    tool: '<rect x="3" y="3" width="7.5" height="7.5" rx="1.8"/><rect x="13.5" y="3" width="7.5" height="7.5" rx="1.8"/><rect x="3" y="13.5" width="7.5" height="7.5" rx="1.8"/><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.8"/>',
    chart: '<path d="M4 20V11M10 20V5M16 20v-7M21 20H3"/>',
    gear: '<circle cx="12" cy="12" r="3.2"/><path d="M12 2.5v3M12 18.5v3M4.6 4.6l2.1 2.1M17.3 17.3l2.1 2.1M2.5 12h3M18.5 12h3M4.6 19.4l2.1-2.1M17.3 6.7l2.1-2.1"/>',
    palette: '<path d="M12 3a9 9 0 1 0 0 18c1.2 0 2-.8 2-1.8 0-.5-.2-.9-.5-1.2-.3-.3-.5-.7-.5-1.2 0-1 .8-1.8 1.8-1.8H17a4 4 0 0 0 4-4c0-4.4-4-8-9-8z"/><circle cx="7.5" cy="11" r="1.1"/><circle cx="10" cy="7" r="1.1"/><circle cx="15" cy="7.5" r="1.1"/>',
    calc: '<rect x="5" y="2.5" width="14" height="19" rx="2"/><rect x="8" y="5.5" width="8" height="4" rx=".5"/><path d="M8.5 13h.01M12 13h.01M15.5 13h.01M8.5 17h.01M12 17h.01M15.5 17h.01"/>',
    dict: '<path d="M5 3h12a2 2 0 0 1 2 2v16H7a2 2 0 0 1-2-2z"/><path d="M5 19a2 2 0 0 1 2-2h12"/><path d="M9.5 13.5l2.5-6.5 2.5 6.5M10.3 11.5h3.4"/>',
    doc: '<path d="M6 3h9l4 4v14H6z"/><path d="M15 3v4h4"/><path d="M9 12h6M9 16h4"/>',
    pen: '<path d="M4 20l4-1 11-11-3-3L5 16z"/><path d="M14 6l3 3"/>',
    flag: '<path d="M5 21V4"/><path d="M5 4h12l-2.5 4L17 12H5"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    eyeoff: '<path d="M3 3l18 18"/><path d="M10.6 6.1A10 10 0 0 1 12 6c6.5 0 10 6 10 6a17 17 0 0 1-3.2 3.9M6.1 7.6C3.6 9.3 2 12 2 12s3.5 6 10 6a9.6 9.6 0 0 0 4-.9"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>',
    check: '<path d="M4 12.5l5 5L20 6.5"/>',
    chevL: '<path d="M15 5l-7 7 7 7"/>',
    chevR: '<path d="M9 5l7 7-7 7"/>',
    chevD: '<path d="M5 9l7 7 7-7"/>',
    chevU: '<path d="M5 15l7-7 7 7"/>',
    more: '<circle cx="12" cy="5" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="12" cy="19" r="1.2"/>',
    marker: '<path d="M9 15l-4.5 4.5H10l2-2"/><path d="M8.2 13.8L15 3.5l5.2 3.3-6.8 10.3z"/><path d="M8.2 13.8l3.6 2.5"/>',
    note: '<path d="M5 3h14v12l-6 6H5z"/><path d="M13 21v-6h6"/>',
    line: '<rect x="2.5" y="9" width="19" height="6" rx="1"/><path d="M3 4.5h18M3 19.5h18"/>',
    fire: '<path d="M12 22c4 0 7-3 7-7.2 0-4.8-4.5-6.6-5.2-11.8C11 4.6 9.8 7.5 10 10c-1-.6-2-1.8-2.2-3.6C6 8.2 5 11 5 14.8 5 19 8 22 12 22z"/>',
    star: '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>',
    play: '<path d="M7 4.5l12.5 7.5L7 19.5z"/>',
    pause: '<path d="M8 5v14M16 5v14"/>',
    refresh: '<path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4v7h-7"/>',
    trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14"/>',
    download: '<path d="M12 3v12M7 10l5 5 5-5M4 20h16"/>',
    upload: '<path d="M12 21V9M7 14l5-5 5 5M4 4h16"/>',
    bulb: '<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-4 10.5c.7.7 1 1.5 1 2.5h6c0-1 .3-1.8 1-2.5A6 6 0 0 0 12 3z"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="M20.5 20.5L16 16"/>',
    bolt: '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>',
    grid: '<path d="M4 4h4v4H4zM10 4h4v4h-4zM16 4h4v4h-4zM4 10h4v4H4zM10 10h4v4h-4zM16 10h4v4h-4zM4 16h4v4H4zM10 16h4v4h-4zM16 16h4v4h-4z"/>',
    pin: '<path d="M12 22s7-6.2 7-12a7 7 0 0 0-14 0c0 5.8 7 12 7 12z"/><circle cx="12" cy="10" r="2.5"/>',
    volume: '<path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    timer: '<circle cx="12" cy="13.5" r="7.5"/><path d="M12 13.5V9.5M9.5 2.5h5M19 6.5l-1.5 1.5"/>',
    layers: '<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/>',
    expand: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
    minus: '<path d="M5 12h14"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5h.01"/>',
    trophy: '<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M7 6H4v2a3 3 0 0 0 3 3M17 6h3v2a3 3 0 0 1-3 3"/>',
    sparkle: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z"/>',
    undo: '<path d="M9 14L4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
    eraser: '<path d="M20 20H9L4 15l10-10 7 7-7 7"/><path d="M8.5 10.5l6 6"/>',
    graph: '<path d="M3 3v18h18"/><path d="M6 16c3-9 6-9 8-5s3 3 6-4"/>',
    sigma: '<path d="M18 5H6l6 7-6 7h12"/>',
    cards: '<rect x="3" y="6" width="13" height="15" rx="2"/><path d="M8 3h11a2 2 0 0 1 2 2v12"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
    list: '<path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01"/>',
    zoom: '<circle cx="11" cy="11" r="7"/><path d="M20.5 20.5L16 16M8 11h6M11 8v6"/>',
  };
  U.icon = (name, cls) => '<svg class="ic ' + (cls || '') + '" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + (ICONS[name] || ICONS.info) + '</svg>';
  U.hydrateIcons = (root) => U.$$('i[data-icon]', root).forEach((i) => { i.outerHTML = U.icon(i.dataset.icon); });

  /* -------------------------------------------------------------- math */
  U.renderMath = function (el) {
    if (!el || !window.renderMathInElement) return;
    try {
      window.renderMathInElement(el, {
        delimiters: [
          { left: '\\[', right: '\\]', display: true },
          { left: '\\(', right: '\\)', display: false },
        ],
        throwOnError: false,
        ignoredClasses: ['no-math'],
      });
    } catch (e) { console.warn('math render', e); }
  };
  U.tex = function (src, display) {
    if (!window.katex) return U.esc(src);
    try { return window.katex.renderToString(src, { throwOnError: false, displayMode: !!display }); } catch (e) { return U.esc(src); }
  };

  /* ------------------------------------------------------------ toasts */
  U.toast = function (msg, kind, ms) {
    const t = U.h('div.toast' + (kind ? '.toast-' + kind : ''), { role: 'status', html: msg });
    U.$('#toasts').appendChild(t);
    requestAnimationFrame(() => t.classList.add('in'));
    setTimeout(() => { t.classList.remove('in'); setTimeout(() => t.remove(), 300); }, ms || 2600);
  };

  /* ------------------------------------------------------------ modals */
  const modalStack = [];
  U.modal = function (o) {
    const root = U.$('#overlay-root');
    const actions = U.h('div.modal-actions');
    const body = U.h('div.modal-body');
    if (o.body instanceof Node) body.appendChild(o.body); else body.innerHTML = o.body || '';
    const box = U.h('div.modal.card' + (o.wide ? '.modal-wide' : '') + (o.cls ? '.' + o.cls : ''), { role: 'dialog', 'aria-modal': 'true', 'aria-label': o.title || 'Dialog' },
      o.title ? U.h('div.modal-head', U.h('h2', { html: o.title }),
        o.noClose ? null : U.h('button.icon-btn.modal-x', { 'aria-label': 'Close', html: U.icon('x'), onclick: () => close(null) })) : null,
      body, actions);
    const wrap = U.h('div.modal-wrap', box);
    let resolveFn;
    const done = new Promise((r) => (resolveFn = r));
    function close(v) {
      if (!wrap.isConnected) return;
      wrap.classList.remove('in');
      setTimeout(() => wrap.remove(), 180);
      modalStack.splice(modalStack.indexOf(api), 1);
      if (o.onClose) o.onClose(v);
      resolveFn(v);
    }
    (o.actions || []).forEach((a) => {
      actions.appendChild(U.h('button.btn' + (a.primary ? '.btn-primary' : '') + (a.danger ? '.btn-danger' : ''), {
        html: a.label,
        onclick: () => { const r = a.onClick ? a.onClick(api) : a.value; if (r !== false) close(a.value !== undefined ? a.value : r); },
      }));
    });
    if (!o.actions || !o.actions.length) actions.remove();
    wrap.addEventListener('mousedown', (e) => { if (e.target === wrap && !o.noClose) close(null); });
    root.appendChild(wrap);
    requestAnimationFrame(() => wrap.classList.add('in'));
    U.renderMath(body);
    const api = { el: box, body, close, done };
    modalStack.push(api);
    const f = box.querySelector('input,button.btn-primary,button');
    if (f) setTimeout(() => f.focus(), 30);
    return api;
  };
  U.confirm = (title, msg, okLabel, danger) => U.modal({
    title, body: '<p>' + msg + '</p>',
    actions: [{ label: 'Cancel', value: false }, { label: okLabel || 'OK', value: true, primary: !danger, danger: !!danger }],
  }).done.then((v) => !!v);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modalStack.length) { modalStack[modalStack.length - 1].close(null); e.stopPropagation(); }
  }, true);

  /* ---------------------------------------------------------- popovers */
  let openPop = null;
  U.popover = function (anchor, content, o) {
    o = o || {};
    U.closePopover();
    const pop = U.h('div.popover.card' + (o.cls ? '.' + o.cls : ''));
    if (content instanceof Node) pop.appendChild(content); else pop.innerHTML = content;
    U.$('#overlay-root').appendChild(pop);
    const place = () => {
      const r = anchor.getBoundingClientRect();
      const pw = pop.offsetWidth, ph = pop.offsetHeight;
      let left = r.left + r.width / 2 - pw / 2;
      left = U.clamp(left, 8, window.innerWidth - pw - 8);
      let top = o.placement === 'top' ? r.top - ph - 10 : r.bottom + 10;
      if (top + ph > window.innerHeight - 8) top = r.top - ph - 10;
      if (top < 8) top = r.bottom + 10;
      pop.style.left = left + 'px'; pop.style.top = Math.max(8, top) + 'px';
    };
    place();
    const onDoc = (e) => { if (!pop.contains(e.target) && !anchor.contains(e.target)) U.closePopover(); };
    setTimeout(() => document.addEventListener('mousedown', onDoc), 0);
    const onKey = (e) => { if (e.key === 'Escape') U.closePopover(); };
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', place);
    openPop = { pop, off: () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey); window.removeEventListener('resize', place); if (o.onClose) o.onClose(); } };
    U.renderMath(pop);
    return pop;
  };
  U.closePopover = function () {
    if (!openPop) return;
    openPop.off(); openPop.pop.remove(); openPop = null;
  };

  /* --------------------------------------------------- small widgets */
  U.ring = function (value, max, label, size) {
    size = size || 110;
    const r = size / 2 - 9, c = 2 * Math.PI * r, f = max ? U.clamp(value / max, 0, 1) : 0;
    return '<div class="ring" style="width:' + size + 'px;height:' + size + 'px">' +
      '<svg viewBox="0 0 ' + size + ' ' + size + '"><circle class="ring-track" cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + r + '"/>' +
      '<circle class="ring-fill" cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + r + '" stroke-dasharray="' + (c * f).toFixed(1) + ' ' + c.toFixed(1) + '" transform="rotate(-90 ' + size / 2 + ' ' + size / 2 + ')"/></svg>' +
      '<div class="ring-label">' + label + '</div></div>';
  };
  U.bar = (p, cls) => '<div class="pbar ' + (cls || '') + '"><div style="width:' + U.clamp(p, 0, 100) + '%"></div></div>';
  U.letter = (i) => 'ABCDEFGH'[i];
})();
