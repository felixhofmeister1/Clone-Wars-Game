/* Portfolio tab (holdings tracker + paper trading), trade ticket, holding and alert sheets. */
(function () {
  'use strict';
  const App = (window.App = window.App || {});
  const U = App.U;
  const UI = App.UI;
  const esc = U.esc;
  App.views = App.views || {};

  let mode = 'hold';
  let allocBy = 'class';
  let perfRange = '1Y';
  const CLASS_NAME = { stock: 'Stocks', etf: 'ETFs & funds', crypto: 'Crypto', nft: 'NFTs', index: 'Indices', commodity: 'Commodities', fx: 'Currencies', rate: 'Bonds', custom: 'Other' };

  const base = () => App.S.settings.baseCur || 'USD';
  const hide = () => App.S.settings.hideBalances;
  const money = (x) => (hide() ? '••••' : U.money(x, base()));

  // ------------------------------------------------------------- valuation
  function positions() {
    const D = App.D;
    const S = App.S;
    const by = {};
    S.state.holdings.forEach((h) => {
      const p = (by[h.asset] = by[h.asset] || { asset: h.asset, qty: 0, cost: 0, lots: [] });
      p.qty += h.qty;
      p.cost += h.qty * (h.cost || 0);
      p.lots.push(h);
    });
    return Object.values(by).map((p) => {
      const a = D.asset(p.asset);
      const q = D.quote(p.asset);
      const cur = a && a.c === 'nft' ? 'ETH' : D.cur(a || {}, q) || 'USD';
      const price = q && U.isNum(q.p) ? q.p : null;
      const valLocal = price !== null ? price * p.qty : null;
      const conv = (x) => (cur === 'ETH' ? D.convert(x * (App.D.quote('c:ethereum') || {}).p, 'USD', base()) : D.convert(x, cur, base()));
      const value = valLocal !== null ? conv(valLocal) : null;
      const costB = conv(p.cost);
      const dayCh = q && U.isNum(q.ch) && a.c !== 'nft' ? conv(q.ch * p.qty) : q && U.isNum(q.chp) && value !== null ? (value * q.chp) / (100 + q.chp) : 0;
      return Object.assign(p, { a, q, cur, price, value, costB, dayCh, gain: value !== null && costB ? value - costB : null });
    }).filter((p) => p.a);
  }

  function totals(list) {
    const t = { value: 0, cost: 0, day: 0, missing: 0 };
    list.forEach((p) => {
      if (U.isNum(p.value)) t.value += p.value; else t.missing++;
      if (U.isNum(p.costB)) t.cost += p.costB;
      if (U.isNum(p.dayCh)) t.day += p.dayCh;
    });
    t.gain = t.value - t.cost;
    return t;
  }

  // Value of today's holdings over past dates, using each asset's daily closes.
  async function historyValue(list, range) {
    const D = App.D;
    const DAY = 86400000;
    const days = { '1M': 31, '3M': 92, '6M': 183, '1Y': 366 }[range] || 366;
    const since = Date.now() - days * DAY;
    const series = [];
    for (const p of list) {
      if (!p.a || p.a.c === 'custom' || p.a.c === 'nft') continue;
      const s = await D.series(p.asset, '1Y');
      if (s && s.pts && s.pts.length > 5) series.push({ p, pts: s.pts.filter((x) => x[0] >= since - 7 * DAY) });
    }
    if (!series.length) return null;
    const dates = new Set();
    series.forEach((s) => s.pts.forEach((x) => { if (x[0] >= since) dates.add(Math.floor(x[0] / DAY)); }));
    const sortedDays = [...dates].sort((a, b) => a - b);
    const out = sortedDays.map((d) => {
      let sum = 0;
      series.forEach(({ p, pts }) => {
        let v = null;
        for (const x of pts) { if (Math.floor(x[0] / DAY) <= d) v = x[1]; else break; }
        if (v !== null) sum += p.cur === 'ETH' ? 0 : D.convert(v * p.qty, p.cur, base());
      });
      return [d * DAY + DAY / 2, sum];
    });
    return { pts: out.filter((x) => x[1] > 0), covered: series.length };
  }

  // ------------------------------------------------------------- holdings mode
  function holdingsHTML() {
    const list = positions();
    if (!list.length) {
      return UI.empty('portfolio', 'Track everything you own', 'Add stocks, funds, crypto, NFTs, or anything else — a home, a watch, a painting, private shares — to see your net worth and allocation in one place. Everything stays on this device.', `<div class="btn-row" style="max-width:420px;margin:0 auto"><button class="btn primary" data-act="add">${U.icon('plus')} Add investment</button><button class="btn secondary" data-act="custom">Add other asset</button></div>`);
    }
    const t = totals(list);
    const dayPct = t.value - t.day ? (t.day / (t.value - t.day)) * 100 : 0;
    const gainPct = t.cost ? (t.gain / t.cost) * 100 : 0;
    list.sort((a, b) => (b.value || 0) - (a.value || 0));
    return `
      <div class="hero">
        <div class="stat-k">Total value · ${esc(base())}</div>
        <div class="hero-total">${money(t.value)}</div>
        <div class="hero-c"><span class="${U.dir(t.day)}">${hide() ? '' : U.signed(t.day, null, base())} (${U.pct(dayPct)})</span><span class="muted">today</span></div>
        <div class="hero-c"><span class="${U.dir(t.gain)}">${hide() ? '' : U.signed(t.gain, null, base())} (${U.pct(gainPct)})</span><span class="muted">total gain</span></div>
        ${t.missing ? `<div class="hero-t">${t.missing} holding${t.missing > 1 ? 's' : ''} without a current price are excluded.</div>` : ''}
      </div>
      <div class="btn-row"><button class="btn primary" data-act="add">${U.icon('plus')} Add</button><button class="btn secondary" data-act="custom">Other asset</button><button class="btn secondary" data-act="io">${U.icon('download')} Export</button></div>
      ${UI.section('Performance', UI.seg('perf', [['1M', '1M'], ['3M', '3M'], ['6M', '6M'], ['1Y', '1Y']], perfRange, 'plain') + '<div id="pchart" class="chart-wrap" style="min-height:200px"></div><div class="src" id="pnote"></div>')}
      ${UI.section('Allocation', UI.seg('alloc', [['class', 'By asset class'], ['asset', 'By holding']], allocBy) + '<div id="alloc" class="mt"></div>')}
      ${UI.section('Holdings', `<div class="list">${list.map((p) => `<a class="row arow pos-row" href="#/a/${encodeURIComponent(p.asset)}">
          ${UI.logo(p.a, p.q, 34)}
          <span class="r-main"><span class="r-sym">${esc(p.a.s)}</span><span class="r-name"><span class="qty">${U.fmtN(p.qty, 0, 6)}</span>${U.isNum(p.price) ? ` × ${UI.priceText(p.asset, p.q)}` : ''}</span></span>
          <span class="r-right"><span class="r-price">${U.isNum(p.value) ? money(p.value) : '—'}</span><span class="pill ${U.dir(p.gain)}">${U.isNum(p.gain) && p.costB ? U.pct((p.gain / p.costB) * 100) : '—'}</span></span>
        </a>`).join('')}</div>`, { sub: 'Pill = total gain since purchase. Tap a holding for details; edit lots from its page or below.' })}
      <button class="btn secondary full" data-act="lots">${U.icon('edit')} Edit lots</button>`;
  }

  function drawAlloc(el) {
    const host = el.querySelector('#alloc');
    if (!host) return;
    const list = positions().filter((p) => U.isNum(p.value) && p.value > 0);
    let segs;
    if (allocBy === 'class') {
      const by = {};
      list.forEach((p) => { const k = p.a.c === 'custom' ? (App.S.state.custom[p.asset] || {}).cls || 'Other' : CLASS_NAME[p.a.c] || p.a.c; by[k] = (by[k] || 0) + p.value; });
      segs = Object.entries(by).sort((a, b) => b[1] - a[1]).map(([label, value]) => ({ label, value }));
    } else {
      segs = list.slice().sort((a, b) => b.value - a.value).map((p) => ({ label: p.a.s, value: p.value, id: p.asset }));
    }
    if (segs.length > 8) {
      const rest = segs.slice(7).reduce((s, x) => s + x.value, 0);
      segs = segs.slice(0, 7).concat([{ label: 'Other', value: rest }]);
    }
    segs.forEach((s, i) => { s.color = App.Chart.series(i); });
    const total = segs.reduce((s, x) => s + x.value, 0);
    App.Chart.donut(host, segs, { size: 188, thickness: 24, fmt: (v) => money(v), center: { t: hide() ? '••••' : U.compact(total, base()), s: 'total' }, onClick: (s) => { if (s.id) location.hash = '#/a/' + encodeURIComponent(s.id); } });
  }

  async function drawPerf(el) {
    const host = el.querySelector('#pchart');
    const note = el.querySelector('#pnote');
    if (!host) return;
    host.innerHTML = '<div class="skel" style="height:190px"></div>';
    const list = positions();
    const r = await historyValue(list, perfRange);
    if (!r || r.pts.length < 3) { host.innerHTML = '<div class="chart-empty">Performance appears once price history has loaded for your holdings.</div>'; note.textContent = ''; return; }
    App.Chart.price(host, { pts: r.pts, height: 200, label: 'Portfolio value', fmtAxis: (v) => (hide() ? '' : U.compact(v)) });
    const tracked = list.filter((p) => p.a.c !== 'custom' && p.a.c !== 'nft').length;
    note.textContent = `Value of your current holdings at past closing prices (${r.covered} of ${tracked} priced holdings have history), converted at today's exchange rates. It ignores when you actually bought or sold.`;
  }

  // ------------------------------------------------------------- paper trading
  function paperHTML() {
    const D = App.D;
    const P = App.S.paper();
    let posVal = 0;
    let day = 0;
    const rows = Object.entries(P.pos).map(([id, pos]) => {
      const a = D.asset(id);
      const q = D.quote(id);
      const cur = D.cur(a || {}, q) || 'USD';
      const v = q && U.isNum(q.p) ? D.convert(q.p * pos.qty, cur, 'USD') : null;
      if (U.isNum(v)) posVal += v;
      if (q && U.isNum(q.ch)) day += D.convert(q.ch * pos.qty, cur, 'USD') || 0;
      const g = U.isNum(v) ? v - D.convert(pos.cost * pos.qty, cur, 'USD') : null;
      return { id, a, q, pos, v, g, cost: D.convert(pos.cost * pos.qty, cur, 'USD') };
    }).filter((r) => r.a);
    const total = P.cash + posVal;
    const ret = total - P.start;
    const open = (P.open || []).filter((o) => !o.done);
    return `
      <div class="hero">
        <div class="stat-k">Paper account value · USD</div>
        <div class="hero-total">${U.money(total)}</div>
        <div class="hero-c"><span class="${U.dir(ret)}">${U.signed(ret, null, 'USD')} (${U.pct((ret / P.start) * 100)})</span><span class="muted">since ${U.dateLong(P.created)}</span></div>
        <div class="hero-c"><span class="${U.dir(day)}">${U.signed(day, null, 'USD')}</span><span class="muted">today</span></div>
      </div>
      <div class="tiles">${UI.stat('Buying power', U.money(P.cash))}${UI.stat('Invested', U.money(posVal))}</div>
      <div class="btn-row"><button class="btn primary" data-act="ptrade">${U.icon('swap')} Trade</button><button class="btn secondary" data-act="preset">${U.icon('refresh')} Reset</button></div>
      <div class="note">${U.icon('info')}<span>Paper trading uses real market prices with virtual money, so you can practice without risk. Orders fill at the latest price the app has (live for crypto, delayed for stocks unless you add a Finnhub key). Fees, taxes and slippage are not simulated.</span></div>
      ${UI.section('Positions', rows.length ? `<div class="list">${rows.map((r) => `<a class="row arow" href="#/a/${encodeURIComponent(r.id)}">${UI.logo(r.a, r.q, 34)}<span class="r-main"><span class="r-sym">${esc(r.a.s)}</span><span class="r-name">${U.fmtN(r.pos.qty, 0, 6)} @ ${U.money(r.pos.cost, D.cur(r.a, r.q))}</span></span><span class="r-right"><span class="r-price">${U.money(r.v)}</span><span class="pill ${U.dir(r.g)}">${U.isNum(r.g) && r.cost ? U.pct((r.g / r.cost) * 100) : '—'}</span></span></a>`).join('')}</div>` : '<div class="empty small"><p>No positions yet. Tap Trade to place your first order.</p></div>')}
      ${open.length ? UI.section('Open Orders', `<div class="list">${open.map((o) => { const a = D.asset(o.asset); return `<div class="row"><span class="r-main"><span class="r-sym">${o.side === 'buy' ? 'Buy' : 'Sell'} ${esc(a ? a.s : o.asset)}</span><span class="r-name">${U.fmtN(o.qty, 0, 6)} · limit ${U.money(o.limit, D.cur(a || {}, D.quote(o.asset)))} · ${U.ago(o.t)}</span></span><button class="btn secondary sm" data-act="cancel" data-id="${esc(o.id)}">Cancel</button></div>`; }).join('')}</div>`) : ''}
      ${UI.section('History', P.orders.length ? `<div class="list">${P.orders.slice(0, 40).map((o) => { const a = D.asset(o.asset); return `<div class="row"><span class="r-main"><span class="r-sym"><span class="${o.side === 'buy' ? 'up' : 'down'}">${o.side === 'buy' ? 'Bought' : 'Sold'}</span> ${esc(a ? a.s : o.asset)}</span><span class="r-name">${U.fmtN(o.qty, 0, 6)} @ ${U.money(o.price, D.cur(a || {}, D.quote(o.asset)))}${o.limit ? ' (limit)' : ''} · ${U.fmtDate(o.t, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</span></span><span class="r-right"><span class="r-price">${U.money(o.qty * o.price, D.cur(a || {}, D.quote(o.asset)))}</span></span></div>`; }).join('')}</div>` : '<div class="empty small"><p>Filled orders will appear here.</p></div>')}`;
  }

  // Limit orders are checked against incoming prices.
  App.checkPaperOrders = () => {
    const S = App.S;
    const P = S.state.paper;
    if (!P || !P.open || !P.open.length) return;
    let changed = false;
    P.open.forEach((o) => {
      if (o.done) return;
      const q = App.D.quote(o.asset);
      if (!q || !U.isNum(q.p)) return;
      const hit = o.side === 'buy' ? q.p <= o.limit : q.p >= o.limit;
      if (!hit) return;
      try {
        const a = App.D.asset(o.asset);
        S.paperTrade(o.asset, o.side, o.qty, q.p, { limit: o.limit, usd: App.D.convert(o.qty * q.p, App.D.cur(a || {}, q) || 'USD', 'USD') });
        o.done = Date.now();
        changed = true;
        UI.toast(`Limit order filled: ${o.side} ${U.fmtN(o.qty, 0, 6)} ${(App.D.asset(o.asset) || {}).s}`, 'check');
      } catch (e) { o.done = Date.now(); o.err = e.message; changed = true; }
    });
    if (changed) { P.open = P.open.filter((o) => !o.done); S.save(); }
  };

  App.views.portfolio = {
    title: 'Portfolio',
    render(el) {
      this.el = el;
      el.innerHTML = `
        ${UI.header('Portfolio', {
          sub: 'Stored privately on this device',
          actions: `<button class="icon-btn ${hide() ? 'on' : ''}" data-act="hide" aria-label="Hide balances">${U.icon('eye')}</button>`
        })}
        ${UI.seg('mode', [['hold', 'My Holdings'], ['paper', 'Paper Trading']], mode)}
        <div data-part="body" class="mt"></div>`;
      this.drawBody();
      el.onclick = (e) => this.onClick(e);
    },
    drawBody() {
      const el = this.el;
      const body = el.querySelector('[data-part="body"]');
      body.innerHTML = mode === 'hold' ? holdingsHTML() : paperHTML();
      if (mode === 'hold') { drawAlloc(el); drawPerf(el); }
    },
    async onClick(e) {
      const seg = e.target.closest('[data-seg] [data-v]');
      if (seg) {
        const name = seg.closest('[data-seg]').dataset.seg;
        seg.parentNode.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b === seg));
        if (name === 'mode') { mode = seg.dataset.v; this.drawBody(); }
        if (name === 'alloc') { allocBy = seg.dataset.v; drawAlloc(this.el); }
        if (name === 'perf') { perfRange = seg.dataset.v; drawPerf(this.el); }
        return;
      }
      const act = e.target.closest('[data-act]');
      if (!act) return;
      const k = act.dataset.act;
      const S = App.S;
      if (k === 'hide') { S.set('hideBalances', !hide()); this.render(this.el); }
      else if (k === 'add') UI.picker({ title: 'Add investment', onPick: (id) => App.views.addHolding(id, () => this.drawBody()) });
      else if (k === 'custom') App.views.addCustom(() => this.drawBody());
      else if (k === 'lots') App.views.editLots(() => this.drawBody());
      else if (k === 'io') App.views.exportSheet();
      else if (k === 'ptrade') UI.picker({ title: 'Trade', onPick: (id) => App.views.trade(id, 'buy', () => this.drawBody()) });
      else if (k === 'preset') {
        const r = await UI.prompt('Reset paper account', [{ name: 'amt', label: 'Starting cash (USD)', type: 'number', value: 100000 }], 'Reset');
        if (r && r.amt > 0) { S.resetPaper(r.amt); this.drawBody(); UI.toast('Paper account reset'); }
      } else if (k === 'cancel') {
        const P = S.paper();
        P.open = (P.open || []).filter((o) => o.id !== act.dataset.id);
        S.save();
        this.drawBody();
      }
    },
    refresh() { if (this.el) this.drawBody(); }
  };

  // ------------------------------------------------------------- trade ticket
  App.views.trade = (id, side = 'buy', onDone) => {
    const D = App.D;
    const a = D.asset(id);
    if (!a || a.c === 'nft' || a.c === 'custom') { UI.toast('This asset cannot be paper traded'); return; }
    if (a.c === 'index' || a.c === 'rate') { UI.toast('Indices and yields cannot be bought directly; try a fund that tracks them.', 'info'); return; }
    const S = App.S;
    let unit = 'qty';
    let otype = 'market';
    const cur = () => D.cur(a, D.quote(id)) || 'USD';
    const s = UI.sheet({
      title: 'Paper trade · ' + a.s,
      body: `<div class="order-ticket">
        ${UI.seg('side', [['buy', 'Buy'], ['sell', 'Sell']], side)}
        <div class="split mt"><span class="muted">Price</span><b data-k="price"></b></div>
        <div class="mt">${UI.seg('unit', [['qty', a.c === 'crypto' ? 'Coins' : a.c === 'fx' ? 'Units' : 'Shares'], ['cash', 'Dollars']], unit, 'plain')}</div>
        <input class="big-input" data-k="amt" type="number" inputmode="decimal" placeholder="0" min="0" step="any" aria-label="Amount">
        <div class="ticket-sub" data-k="conv"></div>
        <div class="mt">${UI.seg('otype', [['market', 'Market'], ['limit', 'Limit']], otype, 'plain')}</div>
        <label class="field mt hide" data-k="limitbox"><span>Limit price</span><input type="number" inputmode="decimal" step="any" data-k="limit"></label>
        <div class="order-sum kv" data-k="sum"></div>
        <div class="note" data-k="warn" style="display:none"></div>
        <button class="btn full mt" data-k="go">Review</button>
      </div>`
    });
    const g = (k) => s.body.querySelector(`[data-k="${k}"]`);
    const P = S.paper();
    const upd = () => {
      const q = D.quote(id);
      const price = q && U.isNum(q.p) ? q.p : null;
      g('price').innerHTML = price ? `${UI.priceText(id, q)} ${UI.badge(q.srcKind)}` : 'Unavailable';
      const amt = parseFloat(g('amt').value) || 0;
      const lim = parseFloat(g('limit').value);
      const px = otype === 'limit' && lim > 0 ? lim : price;
      const qty = unit === 'qty' ? amt : px ? amt / px : 0;
      const costLocal = qty * (px || 0);
      const costUSD = D.convert(costLocal, cur(), 'USD');
      g('conv').textContent = unit === 'qty' ? (px ? `≈ ${U.money(costLocal, cur())}` : '') : (px ? `≈ ${U.fmtN(qty, 0, 6)} ${a.s}` : '');
      const own = (P.pos[id] || {}).qty || 0;
      g('sum').innerHTML = [
        ['Order', `${side === 'buy' ? 'Buy' : 'Sell'} ${U.fmtN(qty, 0, 6)} ${esc(a.s)}`],
        ['Estimated ' + (side === 'buy' ? 'cost' : 'proceeds'), U.money(costLocal, cur()) + (cur() !== 'USD' && U.isNum(costUSD) ? ` (${U.money(costUSD)})` : '')],
        ['Buying power', U.money(P.cash)],
        ['You own', `${U.fmtN(own, 0, 6)} ${esc(a.s)}`]
      ].map(([k, v]) => `<div class="kv-row"><span>${k}</span><b>${v}</b></div>`).join('');
      const warn = [];
      const mk = U.usMarket();
      if ((a.c === 'stock' || a.c === 'etf') && !(a.t && a.t.includes('local')) && !mk.open && otype === 'market') warn.push('The US market is closed; the simulated order fills at the last available price.');
      if (q && q.srcKind !== 'live' && otype === 'market') warn.push('Price is delayed (' + (q.t ? U.dateTimeET(q.t) : 'time unknown') + ').');
      if (side === 'buy' && U.isNum(costUSD) && costUSD > P.cash) warn.push('Not enough buying power.');
      if (side === 'sell' && qty > own + 1e-9) warn.push(`You only own ${U.fmtN(own, 0, 6)} ${a.s}.`);
      g('warn').style.display = warn.length ? 'flex' : 'none';
      g('warn').innerHTML = U.icon('info') + '<span>' + warn.map(esc).join(' ') + '</span>';
      const bad = !(qty > 0) || !px || (side === 'buy' && costUSD > P.cash + 1e-6) || (side === 'sell' && qty > own + 1e-9);
      const go = g('go');
      go.disabled = bad;
      go.className = 'btn full mt ' + (side === 'buy' ? 'buy' : 'sell');
      go.textContent = otype === 'limit' ? `Place limit ${side}` : `${side === 'buy' ? 'Buy' : 'Sell'} ${a.s}`;
      return { qty, px, costUSD };
    };
    s.body.addEventListener('click', (e) => {
      const b = e.target.closest('[data-seg] [data-v]');
      if (b) {
        const name = b.closest('[data-seg]').dataset.seg;
        b.parentNode.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b));
        if (name === 'side') side = b.dataset.v;
        if (name === 'unit') unit = b.dataset.v;
        if (name === 'otype') { otype = b.dataset.v; g('limitbox').classList.toggle('hide', otype !== 'limit'); if (otype === 'limit' && !g('limit').value) { const q = D.quote(id); if (q && q.p) g('limit').value = +q.p.toPrecision(6); } }
        upd();
        return;
      }
      if (e.target.closest('[data-k="go"]')) {
        const { qty, px } = upd();
        if (!(qty > 0) || !px) return;
        try {
          if (otype === 'limit') {
            P.open = P.open || [];
            P.open.push({ id: U.uid(), asset: id, side, qty, limit: px, t: Date.now() });
            S.save();
            UI.toast('Limit order placed');
          } else {
            S.paperTrade(id, side, qty, px, { usd: D.convert(qty * px, cur(), 'USD') });
            UI.toast(`${side === 'buy' ? 'Bought' : 'Sold'} ${U.fmtN(qty, 0, 6)} ${a.s} at ${U.price(px, a.c, cur())}`);
          }
          U.haptic();
          s.close();
          if (onDone) onDone();
          if (App.current && App.current.refresh) App.current.refresh(App.current.el);
        } catch (err) { UI.toast(err.message, 'info'); }
      }
    });
    s.body.addEventListener('input', upd);
    upd();
    setTimeout(() => g('amt').focus(), 280);
  };

  // ------------------------------------------------------------- holdings sheets
  App.views.addHolding = async (id, onDone) => {
    const D = App.D;
    const a = D.asset(id);
    if (!a) return;
    const q = D.quote(id);
    const curLabel = a.c === 'nft' ? 'ETH' : D.cur(a, q) || 'USD';
    const r = await UI.prompt('Add ' + a.s, [
      { name: 'qty', label: a.c === 'crypto' ? 'Amount (coins)' : a.c === 'nft' ? 'Number of NFTs' : 'Quantity', type: 'number', step: 'any', required: true },
      { name: 'cost', label: `Average cost per unit (${curLabel})`, type: 'number', step: 'any', value: q && U.isNum(q.p) ? +q.p.toPrecision(6) : '' },
      { name: 'date', label: 'Purchase date', type: 'date', value: new Date().toISOString().slice(0, 10) },
      { name: 'note', label: 'Note (optional)', placeholder: 'e.g. Roth IRA' }
    ], 'Add');
    if (!r || !(r.qty > 0)) return;
    App.S.addHolding({ asset: id, qty: r.qty, cost: U.isNum(r.cost) ? r.cost : 0, date: r.date, note: r.note });
    UI.toast(`Added ${U.fmtN(r.qty, 0, 6)} ${a.s} to your portfolio`);
    App.D.syncFinnhub();
    if (onDone) onDone();
  };

  App.views.addCustom = async (onDone) => {
    const r = await UI.prompt('Add other asset', [
      { name: 'name', label: 'Name', placeholder: 'e.g. Rolex Submariner, apartment, Series A shares', required: true },
      { name: 'cls', label: 'Category', type: 'select', value: 'Collectibles', options: ['Real estate', 'Art', 'Collectibles', 'Private company', 'Cash', 'Bonds', 'Vehicle', 'Other'].map((x) => [x, x]) },
      { name: 'value', label: 'Current value (total)', type: 'number', step: 'any', required: true },
      { name: 'cost', label: 'What you paid (total, optional)', type: 'number', step: 'any' },
      { name: 'cur', label: 'Currency', type: 'select', value: App.S.settings.baseCur || 'USD', options: ['USD', 'EUR', 'GBP', 'CHF', 'JPY', 'CAD', 'AUD', 'CNY', 'HKD', 'INR', 'SGD', 'SEK', 'NOK'].map((x) => [x, x]) }
    ], 'Add');
    if (!r || !r.name || !(r.value >= 0)) return;
    const id = App.S.addCustom({ name: r.name.trim(), cls: r.cls, value: r.value, cur: r.cur });
    App.S.addHolding({ asset: id, qty: 1, cost: U.isNum(r.cost) ? r.cost : r.value });
    UI.toast('Added ' + r.name.trim());
    if (onDone) onDone();
  };

  App.views.editLots = (onDone) => {
    const S = App.S;
    const D = App.D;
    const draw = () => S.state.holdings.length ? `<div class="list">${S.state.holdings.map((h) => {
      const a = D.asset(h.asset);
      const custom = h.asset.startsWith('x:');
      return `<div class="row"><span class="r-main"><span class="r-sym">${esc(a ? a.s : h.asset)}</span><span class="r-name">${custom ? 'Value ' + U.money((S.state.custom[h.asset] || {}).value, (S.state.custom[h.asset] || {}).cur) : U.fmtN(h.qty, 0, 6) + ' @ ' + U.fmtN(h.cost || 0, 2, 6)}${h.date ? ' · ' + esc(h.date) : ''}${h.note ? ' · ' + esc(h.note) : ''}</span></span><button class="icon-btn" data-edit="${esc(h.id)}" aria-label="Edit">${U.icon('edit')}</button><button class="icon-btn" data-del="${esc(h.id)}" aria-label="Delete">${U.icon('trash')}</button></div>`;
    }).join('')}</div>` : '<div class="empty small"><p>No lots.</p></div>';
    const s = UI.sheet({ title: 'Edit lots', full: true, body: draw(), onClose: onDone });
    s.body.addEventListener('click', async (e) => {
      const del = e.target.closest('[data-del]');
      const ed = e.target.closest('[data-edit]');
      if (del) {
        const h = S.state.holdings.find((x) => x.id === del.dataset.del);
        if (h && h.asset.startsWith('x:')) S.removeCustom(h.asset); else S.removeHolding(del.dataset.del);
        s.body.innerHTML = draw();
      } else if (ed) {
        const h = S.state.holdings.find((x) => x.id === ed.dataset.edit);
        if (!h) return;
        if (h.asset.startsWith('x:')) {
          const c = S.state.custom[h.asset];
          const r = await UI.prompt('Update value', [{ name: 'value', label: `Current value (${c.cur})`, type: 'number', step: 'any', value: c.value }]);
          if (r && U.isNum(r.value)) S.updateCustom(h.asset, { value: r.value });
        } else {
          const r = await UI.prompt('Edit lot', [
            { name: 'qty', label: 'Quantity', type: 'number', step: 'any', value: h.qty },
            { name: 'cost', label: 'Cost per unit', type: 'number', step: 'any', value: h.cost },
            { name: 'date', label: 'Date', type: 'date', value: h.date },
            { name: 'note', label: 'Note', value: h.note || '' }
          ]);
          if (r && r.qty > 0) S.updateHolding(h.id, { qty: r.qty, cost: U.isNum(r.cost) ? r.cost : h.cost, date: r.date, note: r.note });
        }
        s.body.innerHTML = draw();
      }
    });
  };

  App.views.exportSheet = () => {
    const S = App.S;
    const s = UI.sheet({
      title: 'Export & import',
      body: `<div class="group">
        <button class="gitem" data-x="csv">${U.icon('download')}<span class="gi-main"><span class="gi-t">Holdings as CSV</span><span class="gi-s">Open in Excel, Numbers or Google Sheets</span></span></button>
        <button class="gitem" data-x="json">${U.icon('download')}<span class="gi-main"><span class="gi-t">Full backup (JSON)</span><span class="gi-s">Watchlists, holdings, paper account, alerts and settings</span></span></button>
        <label class="gitem" style="cursor:pointer">${U.icon('upload')}<span class="gi-main"><span class="gi-t">Restore from backup</span><span class="gi-s">Replaces the data on this device</span></span><input type="file" accept="application/json,.json" hidden data-x="import"></label>
      </div>`
    });
    const dl = (name, text, type) => {
      const blob = new Blob([text], { type });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = name;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
    };
    s.body.addEventListener('click', (e) => {
      const b = e.target.closest('button[data-x]');
      if (!b) return;
      const stamp = new Date().toISOString().slice(0, 10);
      if (b.dataset.x === 'json') dl(`invest-backup-${stamp}.json`, S.exportJSON(), 'application/json');
      if (b.dataset.x === 'csv') {
        const rows = [['Symbol', 'Name', 'Quantity', 'Cost per unit', 'Currency', 'Date', 'Price', 'Value', 'Note']];
        S.state.holdings.forEach((h) => {
          const a = App.D.asset(h.asset);
          const q = App.D.quote(h.asset);
          const cur = a && a.c === 'nft' ? 'ETH' : App.D.cur(a || {}, q) || 'USD';
          rows.push([a ? a.s : h.asset, a ? a.n : '', h.qty, h.cost || '', cur, h.date || '', q && U.isNum(q.p) ? q.p : '', q && U.isNum(q.p) ? q.p * h.qty : '', h.note || '']);
        });
        dl(`invest-holdings-${stamp}.csv`, rows.map((r) => r.map((x) => `"${String(x).replace(/"/g, '""')}"`).join(',')).join('\n'), 'text/csv');
      }
    });
    s.body.querySelector('[data-x="import"]').addEventListener('change', async (e) => {
      const f = e.target.files[0];
      if (!f) return;
      try {
        const text = await f.text();
        if (!(await UI.confirm('Restore backup?', 'This replaces the watchlists, holdings and settings on this device.', 'Restore', true))) return;
        S.importJSON(text);
        UI.toast('Backup restored');
        s.close();
        App.route();
      } catch (err) { UI.toast('Could not read that file: ' + err.message, 'info'); }
    });
  };

  // ------------------------------------------------------------- alerts
  App.views.addAlert = async (id) => {
    const D = App.D;
    const a = D.asset(id);
    const q = D.quote(id);
    if (!a || !q || !U.isNum(q.p)) { UI.toast('No price available for alerts'); return; }
    const r = await UI.prompt('Price alert · ' + a.s, [
      { name: 'op', label: 'When the price is', type: 'select', value: 'above', options: [['above', 'At or above'], ['below', 'At or below']] },
      { name: 'price', label: `Price (${D.cur(a, q) || ''} now ${UI.priceText(id, q)})`, type: 'number', step: 'any', value: +(q.p * 1.05).toPrecision(5) }
    ], 'Create alert');
    if (!r || !U.isNum(r.price)) return;
    App.S.addAlert({ asset: id, op: r.op, price: r.price });
    UI.toast(`Alert set: ${a.s} ${r.op} ${U.price(r.price, a.c, D.cur(a, q))}`, 'bell');
    try { if (window.Notification && Notification.permission === 'default') Notification.requestPermission(); } catch (e) { /* ignore */ }
  };
})();
