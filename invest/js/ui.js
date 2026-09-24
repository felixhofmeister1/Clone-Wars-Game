/* Shared UI components: rows, pills, sheets, toasts, search, pickers, live ticker. */
(function () {
  'use strict';
  const App = (window.App = window.App || {});
  const U = App.U;
  const UI = (App.UI = {});
  const esc = U.esc;

  // ------------------------------------------------------------- basics
  UI.logo = (a, q, size = 36) => {
    if (!a) return '';
    const img = (q && q.img) || a.img;
    const letters = esc((a.s || a.n || '?').replace(/[^A-Za-z0-9]/g, '').slice(0, a.c === 'crypto' ? 4 : 3) || '•');
    if (img) return `<span class="logo" style="width:${size}px;height:${size}px"><img src="${esc(img)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.parentNode.classList.add('fallback');this.remove()"><b>${letters}</b></span>`;
    if (a.dom) return `<span class="logo" style="width:${size}px;height:${size}px"><img src="https://www.google.com/s2/favicons?domain=${esc(a.dom)}&sz=64" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.parentNode.classList.add('fallback');this.remove()"><b>${letters}</b></span>`;
    return `<span class="logo fallback" style="width:${size}px;height:${size}px"><b>${letters}</b></span>`;
  };

  UI.pill = (id, q, extraCls = '') => {
    const dir = q ? U.dir(q.chp) : 'flat';
    return `<button class="pill ${dir} ${extraCls}" data-q="${esc(id)}" data-f="pill" aria-label="Change">${esc(App.D.pillText(id, q))}</button>`;
  };

  // "+1.23 (+0.45%)", or just the percent when the absolute change is unknown.
  UI.chgText = (id, q) => {
    if (!q) return '—';
    const a = App.D.asset(id);
    return U.isNum(q.ch) ? `${U.signed(q.ch, a && a.c, App.D.cur(a || {}, q))} (${U.pct(q.chp)})` : U.pct(q.chp);
  };

  UI.priceText = (id, q) => {
    const a = App.D.asset(id);
    if (!q || !U.isNum(q.p)) return '—';
    if (a && a.c === 'nft') return (q.cur === 'ETH' || !q.cur ? 'Ξ ' : q.cur + ' ') + U.fmtN(q.p, q.p >= 10 ? 2 : 3, q.p >= 10 ? 2 : 4);
    return U.price(q.p, a && a.c, App.D.cur(a, q));
  };

  UI.sparkFor = (id, q, o = {}) => {
    if (!q) return U.isNum(o.w) ? `<svg class="spark" width="${o.w}" height="${o.h || 28}"></svg>` : '';
    if (q.d && q.d.c && q.d.c.length > 1) {
      const slots = Math.round((q.d.e - q.d.s) / q.d.n) + 1;
      return App.Chart.spark(q.d.c, Object.assign({ pc: q.d.pc, slots: Math.max(slots, q.d.c.length) }, o));
    }
    if (q.sp && q.sp.length > 8) {
      const day = Math.max(6, Math.round(q.sp.length / 7));
      const v = q.sp.slice(-day);
      return App.Chart.spark(v, Object.assign({ pc: v[0] }, o));
    }
    return `<svg class="spark" width="${o.w || 64}" height="${o.h || 28}"></svg>`;
  };

  UI.row = (id, o = {}) => {
    const D = App.D;
    const a = D.asset(id);
    if (!a) return '';
    const q = D.quote(id);
    const sub = o.sub !== undefined ? o.sub : a.n;
    const rank = o.rank ? `<span class="r-rank">${o.rank}</span>` : '';
    const logo = o.logo ? UI.logo(a, q, 34) : '';
    return `<a class="row arow${o.logo ? ' with-logo' : ''}" href="#/a/${encodeURIComponent(id)}" data-id="${esc(id)}">
      ${rank}${logo}
      <span class="r-main"><span class="r-sym">${esc(o.title || a.s)}</span><span class="r-name">${esc(sub)}</span></span>
      ${o.spark === false ? '' : `<span class="r-spark">${UI.sparkFor(id, q, { w: 60, h: 28 })}</span>`}
      <span class="r-right"><span class="r-price" data-q="${esc(id)}" data-f="p">${UI.priceText(id, q)}</span>${UI.pill(id, q)}</span>
    </a>`;
  };

  UI.header = (title, o = {}) => `
    <header class="nav${o.back ? ' has-back' : ''}${o.large === false ? ' always' : ''}">
      <div class="nav-bar">
        <div class="nav-left">${o.back ? `<button class="nav-back" data-act="back">${U.icon('chevL')}<span>${esc(o.backLabel || 'Back')}</span></button>` : o.left || ''}</div>
        <div class="nav-title">${esc(o.small || title)}</div>
        <div class="nav-actions">${o.actions || ''}</div>
      </div>
    </header>
    ${o.large === false ? '' : `<div class="large"><h1>${esc(title)}</h1>${o.sub ? `<div class="nav-sub">${o.sub}</div>` : ''}</div>`}`;

  UI.section = (title, body, o = {}) => `
    <section class="sec ${o.cls || ''}" ${o.id ? `id="${o.id}"` : ''}>
      ${title ? `<div class="sec-h"><h2>${esc(title)}</h2>${o.more ? `<a class="sec-more" href="${o.more}">${esc(o.moreLabel || 'See All')}</a>` : ''}${o.right || ''}</div>` : ''}
      ${o.sub ? `<p class="sec-sub">${o.sub}</p>` : ''}
      ${body}
    </section>`;

  UI.seg = (name, options, active, cls = '') => `<div class="seg ${cls}" role="tablist" data-seg="${esc(name)}">${options.map(([v, label]) => `<button role="tab" class="${v === active ? 'on' : ''}" data-v="${esc(v)}" aria-selected="${v === active}">${esc(label)}</button>`).join('')}</div>`;
  UI.chips = (name, options, active) => `<div class="chips" data-seg="${esc(name)}">${options.map(([v, label]) => `<button class="chip ${v === active ? 'on' : ''}" data-v="${esc(v)}">${esc(label)}</button>`).join('')}</div>`;

  UI.stat = (k, v, sub, cls = '') => `<div class="stat ${cls}"><div class="stat-k">${esc(k)}</div><div class="stat-v">${v}</div>${sub ? `<div class="stat-s">${sub}</div>` : ''}</div>`;
  UI.kv = (rows) => `<div class="kv">${rows.filter(Boolean).map(([k, v]) => `<div class="kv-row"><span>${esc(k)}</span><b>${v}</b></div>`).join('')}</div>`;
  UI.src = (list, prefix = 'Source') => {
    const arr = (Array.isArray(list) ? list : [list]).filter(Boolean);
    if (!arr.length) return '';
    return `<div class="src">${esc(prefix)}${arr.length > 1 ? 's' : ''}: ${arr.map((s) => (s.u ? `<a href="${esc(s.u)}" target="_blank" rel="noopener">${esc(s.n)}</a>` : esc(s.n))).join(' · ')}</div>`;
  };
  UI.empty = (icon, title, sub, action) => `<div class="empty">${U.icon(icon, 'big')}<h3>${esc(title)}</h3>${sub ? `<p>${sub}</p>` : ''}${action || ''}</div>`;
  UI.badge = (kind) => {
    const map = { live: ['Live', 'live'], pipeline: ['Delayed', 'delayed'], snapshot: ['Snapshot', 'snap'], manual: ['Manual', 'snap'] };
    const m = map[kind] || map.pipeline;
    return `<span class="badge ${m[1]}">${m[1] === 'live' ? '<i class="dotlive"></i>' : ''}${m[0]}</span>`;
  };
  UI.risk = (n) => `<span class="risk" aria-label="Risk ${n} of 5">${[1, 2, 3, 4, 5].map((i) => `<i class="${i <= n ? 'on' : ''}"></i>`).join('')}</span>`;

  // ------------------------------------------------------------- toast
  let toastTimer;
  UI.toast = (msg, icon = 'check') => {
    let t = document.getElementById('toast');
    if (!t) { t = document.createElement('div'); t.id = 'toast'; t.setAttribute('role', 'status'); document.body.appendChild(t); }
    t.innerHTML = `${U.icon(icon)}<span>${esc(msg)}</span>`;
    t.classList.add('on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('on'), 2600);
  };

  // ------------------------------------------------------------- sheets
  const stack = [];
  UI.sheet = (o) => {
    const wrap = document.createElement('div');
    wrap.className = 'sheet-wrap' + (o.full ? ' full' : '') + (o.wide ? ' wide' : '');
    wrap.innerHTML = `<div class="sheet-bg" data-close></div>
      <div class="sheet" role="dialog" aria-modal="true" aria-label="${esc(o.title || 'Dialog')}">
        <div class="sheet-grab"></div>
        <div class="sheet-h">${o.left || '<span></span>'}<h3>${esc(o.title || '')}</h3><button class="icon-btn" data-close aria-label="Close">${U.icon('x')}</button></div>
        <div class="sheet-body"></div>
      </div>`;
    const body = wrap.querySelector('.sheet-body');
    if (typeof o.body === 'string') body.innerHTML = o.body; else if (o.body) body.appendChild(o.body);
    document.body.appendChild(wrap);
    document.body.classList.add('noscroll');
    requestAnimationFrame(() => wrap.classList.add('on'));
    const ctl = {
      el: wrap,
      body,
      close() {
        if (ctl.closed) return;
        ctl.closed = true;
        wrap.classList.remove('on');
        const i = stack.indexOf(ctl);
        if (i >= 0) stack.splice(i, 1);
        if (!stack.length) document.body.classList.remove('noscroll');
        setTimeout(() => wrap.remove(), 280);
        if (o.onClose) o.onClose();
      }
    };
    wrap.addEventListener('click', (e) => { if (e.target.closest('[data-close]')) ctl.close(); });
    // swipe down to dismiss on touch devices
    const sheet = wrap.querySelector('.sheet');
    let y0 = null;
    sheet.addEventListener('touchstart', (e) => { if (body.scrollTop <= 0 && e.target.closest('.sheet-h, .sheet-grab')) y0 = e.touches[0].clientY; }, { passive: true });
    sheet.addEventListener('touchmove', (e) => { if (y0 === null) return; const dy = Math.max(0, e.touches[0].clientY - y0); sheet.style.transform = `translateY(${dy}px)`; }, { passive: true });
    sheet.addEventListener('touchend', (e) => { if (y0 === null) return; const dy = e.changedTouches[0].clientY - y0; sheet.style.transform = ''; y0 = null; if (dy > 110) ctl.close(); });
    stack.push(ctl);
    if (o.onOpen) o.onOpen(ctl);
    return ctl;
  };
  UI.closeTop = () => { const s = stack[stack.length - 1]; if (s) { s.close(); return true; } return false; };

  UI.confirm = (title, message, ok = 'OK', destructive = false) => new Promise((resolve) => {
    let done = false;
    const s = UI.sheet({
      title,
      body: `<p class="dialog-msg">${esc(message)}</p><div class="btn-row"><button class="btn secondary" data-v="0">Cancel</button><button class="btn ${destructive ? 'danger' : 'primary'}" data-v="1">${esc(ok)}</button></div>`,
      onClose: () => { if (!done) resolve(false); }
    });
    s.body.addEventListener('click', (e) => { const b = e.target.closest('[data-v]'); if (!b) return; done = true; resolve(b.dataset.v === '1'); s.close(); });
  });

  UI.prompt = (title, fields, okLabel = 'Save') => new Promise((resolve) => {
    let done = false;
    const html = `<form class="form">${fields.map((f) => `<label class="field"><span>${esc(f.label)}</span>${f.type === 'select'
      ? `<select name="${esc(f.name)}">${f.options.map(([v, l]) => `<option value="${esc(v)}" ${v === f.value ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>`
      : `<input name="${esc(f.name)}" type="${f.type || 'text'}" ${f.step ? `step="${f.step}"` : ''} inputmode="${f.type === 'number' ? 'decimal' : 'text'}" value="${esc(f.value === undefined ? '' : f.value)}" placeholder="${esc(f.placeholder || '')}" ${f.required ? 'required' : ''}>`}</label>`).join('')}
      <div class="btn-row"><button type="button" class="btn secondary" data-cancel>Cancel</button><button class="btn primary" type="submit">${esc(okLabel)}</button></div></form>`;
    const s = UI.sheet({ title, body: html, onClose: () => { if (!done) resolve(null); } });
    const form = s.body.querySelector('form');
    const first = form.querySelector('input');
    if (first) setTimeout(() => first.focus(), 250);
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const out = {};
      fields.forEach((f) => { const v = form.elements[f.name].value; out[f.name] = f.type === 'number' ? parseFloat(v) : v; });
      done = true;
      resolve(out);
      s.close();
    });
    form.querySelector('[data-cancel]').addEventListener('click', () => s.close());
  });

  // ------------------------------------------------------------- search
  function score(a, q) {
    const s = (a.s || '').toLowerCase();
    const n = (a.n || '').toLowerCase();
    if (s === q) return 100;
    if (n === q) return 95;
    if (s.startsWith(q)) return 80 - s.length;
    if (n.startsWith(q)) return 70;
    if (n.split(/[\s(]/).some((w) => w.startsWith(q))) return 55;
    if (s.includes(q)) return 40;
    if (n.includes(q)) return 30;
    if ((a.g || '').toLowerCase().includes(q)) return 10;
    return 0;
  }
  UI.searchAssets = (query, filter) => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return App.D.allAssets().filter((a) => !filter || filter(a)).map((a) => [score(a, q), a]).filter((x) => x[0] > 0).sort((x, y) => y[0] - x[0]).slice(0, 40).map((x) => x[1]);
  };
  const CLS_LABEL = { stock: 'Stock', etf: 'ETF', crypto: 'Crypto', nft: 'NFT', index: 'Index', commodity: 'Commodity', fx: 'Currency', rate: 'Yield', custom: 'Custom' };
  UI.clsLabel = (c) => CLS_LABEL[c] || c;

  function resultRow(a) {
    const q = App.D.quote(a.id);
    return `<button class="row srow" data-pick="${esc(a.id)}">${UI.logo(a, q, 32)}<span class="r-main"><span class="r-sym">${esc(a.s)} <em class="tag">${esc(UI.clsLabel(a.c))}</em></span><span class="r-name">${esc(a.n)}</span></span><span class="r-right"><span class="r-price">${UI.priceText(a.id, q)}</span><span class="r-chg ${U.dir(q && q.chp)}">${q ? U.pct(q.chp) : ''}</span></span></button>`;
  }

  UI.picker = (o) => {
    const s = UI.sheet({
      title: o.title || 'Search',
      full: true,
      body: `<div class="search-box">${U.icon('search')}<input type="search" placeholder="${esc(o.placeholder || 'Stocks, crypto, ETFs, NFTs, gold…')}" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="search"></div><div class="search-res"></div>`
    });
    const input = s.body.querySelector('input');
    const res = s.body.querySelector('.search-res');
    const render = () => {
      const val = input.value;
      if (!val.trim()) {
        const recent = App.S.state.recent.map((id) => App.D.asset(id)).filter(Boolean).filter((a) => !o.filter || o.filter(a));
        const popular = (o.popular || ['AAPL', 'NVDA', 'SPCX', 'c:bitcoin', 'c:ethereum', 'VOO', 'QQQ', 'GC=F', 'TSLA', 'MSFT', 'c:solana', 'IBIT']).map((id) => App.D.asset(id)).filter(Boolean).filter((a) => !o.filter || o.filter(a));
        res.innerHTML = (recent.length ? `<div class="list-h">Recent</div><div class="list">${recent.slice(0, 6).map(resultRow).join('')}</div>` : '') + `<div class="list-h">Popular</div><div class="list">${popular.map(resultRow).join('')}</div>` + (o.extra || '');
        return;
      }
      const found = UI.searchAssets(val, o.filter);
      res.innerHTML = found.length ? `<div class="list">${found.map(resultRow).join('')}</div>` : `<div class="empty small"><p>No results for “${esc(val)}”.</p></div>`;
    };
    input.addEventListener('input', U.debounce(render, 80));
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { const b = res.querySelector('[data-pick]'); if (b) b.click(); } });
    res.addEventListener('click', (e) => {
      const b = e.target.closest('[data-pick]');
      if (b) { s.close(); o.onPick(b.dataset.pick); return; }
      const c = e.target.closest('[data-extra]');
      if (c && o.onExtra) { s.close(); o.onExtra(c.dataset.extra); }
    });
    render();
    setTimeout(() => input.focus(), 260);
    return s;
  };

  UI.search = () => UI.picker({
    title: 'Search',
    onPick: (id) => { App.S.pushRecent(id); location.hash = '#/a/' + encodeURIComponent(id); }
  });

  // ------------------------------------------------------------- live ticker
  function applyTo(id) {
    const D = App.D;
    const q = D.quote(id);
    if (!q) return;
    const nodes = document.querySelectorAll(`[data-q="${id.replace(/"/g, '\\"')}"]`);
    nodes.forEach((n) => {
      const f = n.dataset.f;
      if (f === 'p') {
        const txt = UI.priceText(id, q);
        if (n.textContent !== txt) {
          const old = parseFloat(n.dataset.last);
          n.textContent = txt;
          if (U.isNum(old) && U.isNum(q.p) && old !== q.p && !App.S.settings.reduceMotion) {
            n.classList.remove('flash-up', 'flash-down');
            void n.offsetWidth;
            n.classList.add(q.p > old ? 'flash-up' : 'flash-down');
          }
        }
        n.dataset.last = q.p;
      } else if (f === 'pill') {
        n.textContent = D.pillText(id, q);
        n.classList.remove('up', 'down', 'flat');
        n.classList.add(U.dir(q.chp));
      } else if (f === 'chp') {
        n.textContent = U.pct(q.chp);
        n.className = n.className.replace(/\b(up|down|flat)\b/g, '').trim() + ' ' + U.dir(q.chp);
      } else if (f === 'chg') {
        n.textContent = UI.chgText(id, q);
        n.className = n.className.replace(/\b(up|down|flat)\b/g, '').trim() + ' ' + U.dir(q.chp);
      }
    });
  }
  UI.refreshAllLive = () => {
    const ids = new Set();
    document.querySelectorAll('[data-q]').forEach((n) => ids.add(n.dataset.q));
    ids.forEach(applyTo);
  };
  let tickCount = 0;
  UI.startTicker = () => {
    setInterval(() => {
      const D = App.D;
      if (D.dirty.size) {
        const ids = [...D.dirty];
        D.dirty.clear();
        ids.forEach(applyTo);
        if (App.onLive) App.onLive(ids);
      }
      if (++tickCount % 5 === 0) D.checkAlerts();
    }, 1000);
  };

  // Pill tap cycles %, $ and market cap, like the Stocks app.
  document.addEventListener('click', (e) => {
    const p = e.target.closest('.pill[data-f="pill"]');
    if (!p) return;
    e.preventDefault();
    e.stopPropagation();
    const order = ['pct', 'abs', 'mcap'];
    const cur = App.S.settings.changeMode;
    App.S.set('changeMode', order[(order.indexOf(cur) + 1) % order.length]);
    UI.refreshAllLive();
    U.haptic();
  }, true);
})();
