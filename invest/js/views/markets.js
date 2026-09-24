/* Markets (home) tab. */
(function () {
  'use strict';
  const App = (window.App = window.App || {});
  const U = App.U;
  const UI = App.UI;
  const esc = U.esc;
  App.views = App.views || {};

  const TAPE = ['^GSPC', '^IXIC', '^DJI', '^RUT', '^VIX', '^TNX', 'GC=F', 'SI=F', 'CL=F', 'BZ=F', 'NG=F', 'HG=F', 'DX-Y.NYB', 'EURUSD=X', 'JPY=X', 'c:bitcoin', 'c:ethereum', 'c:solana', 'c:ripple', 'NVDA', 'AAPL', 'MSFT', 'SPCX', 'TSLA'];
  const INDICES = ['^GSPC', '^IXIC', '^DJI', '^RUT', '^NDX', '^VIX', '^FTSE', '^GDAXI', '^N225', '^HSI'];
  const SECTORS = [['XLK', 'Technology'], ['XLC', 'Communication'], ['XLY', 'Consumer Disc.'], ['XLF', 'Financials'], ['XLV', 'Health Care'], ['XLI', 'Industrials'], ['XLP', 'Consumer Staples'], ['XLE', 'Energy'], ['XLU', 'Utilities'], ['XLB', 'Materials'], ['XLRE', 'Real Estate']];
  const MACRO_ROWS = ['GC=F', 'SI=F', 'CL=F', 'BZ=F', 'NG=F', 'HG=F', '^TNX', 'DX-Y.NYB', 'EURUSD=X', 'JPY=X'];
  let moverMode = 'gain';
  let heatMode = 'stocks';

  function freshness() {
    const D = App.D;
    const bits = [];
    if (D.M && D.M.updated) bits.push(`Prices ${U.dateTimeET(Date.parse(D.M.updated))}`);
    else bits.push('Research snapshot · Sep 23, 2026 close');
    if (D.cg.src === 'live') bits.push('crypto live');
    if (D.status.finnhub === 'live') bits.push('stocks live');
    const live = D.cg.src === 'live' || D.status.coinbase === 'live' || D.status.finnhub === 'live';
    return `<a class="fresh" href="#/more/data">${UI.badge(live ? 'live' : D.M ? 'pipeline' : 'snapshot')} <span>${esc(bits.join(' · '))}</span></a>`;
  }

  function tape() {
    const items = TAPE.map((id) => {
      const a = App.D.asset(id);
      const q = App.D.quote(id);
      if (!a || !q || !U.isNum(q.p)) return '';
      return `<a class="tape-item" href="#/a/${encodeURIComponent(id)}"><span class="t-s">${esc(a.s)}</span><span class="t-p" data-q="${esc(id)}" data-f="p">${UI.priceText(id, q)}</span><span class="${U.dir(q.chp)}" data-q="${esc(id)}" data-f="chp">${U.pct(q.chp)}</span></a>`;
    }).join('');
    if (!items) return '';
    return `<div class="tape" aria-label="Ticker tape"><div class="tape-inner">${items}${items}</div></div>`;
  }

  function indexCards() {
    return `<div class="hscroll">${INDICES.map((id) => {
      const a = App.D.asset(id);
      const q = App.D.quote(id);
      if (!a) return '';
      return `<a class="icard" href="#/a/${encodeURIComponent(id)}"><span class="ic-name">${esc(a.n)}</span><span class="ic-p" data-q="${esc(id)}" data-f="p">${q ? UI.priceText(id, q) : '—'}</span><span class="ic-c ${U.dir(q && q.chp)}" data-q="${esc(id)}" data-f="chg">${UI.chgText(id, q)}</span>${UI.sparkFor(id, q, { w: 138, h: 34, fill: true })}</a>`;
    }).join('')}</div>`;
  }

  function movers() {
    const D = App.D;
    const pool = window.CATALOG.assets.filter((a) => a.c === 'stock' && !(a.t && a.t.includes('local'))).map((a) => [a, D.quote(a.id)]).filter(([, q]) => q && U.isNum(q.chp));
    if (!pool.length) return '<div class="empty small"><p>Mover data appears once the market data file has loaded.</p></div>';
    let list;
    if (moverMode === 'gain') list = pool.sort((x, y) => y[1].chp - x[1].chp);
    else if (moverMode === 'lose') list = pool.sort((x, y) => x[1].chp - y[1].chp);
    else list = pool.filter(([, q]) => U.isNum(q.v) && U.isNum(q.p)).sort((x, y) => y[1].v * y[1].p - x[1].v * x[1].p);
    return `<div class="list">${list.slice(0, 7).map(([a]) => UI.row(a.id)).join('')}</div>`;
  }

  function sectors() {
    const rows = SECTORS.map(([id, label]) => { const q = App.D.quote(id); return { id: '#/a/' + id, label, value: q ? q.chp : null }; }).filter((r) => U.isNum(r.value));
    if (!rows.length) return '<div class="empty small"><p>Sector data appears once the market data file has loaded.</p></div>';
    rows.sort((a, b) => b.value - a.value);
    return App.Chart.divBars(rows) + '<div class="src">Daily change of the Select Sector SPDR ETFs, which hold the S&P 500 stocks in each sector.</div>';
  }

  function cryptoBlock() {
    const D = App.D;
    const g = D.cg.global;
    const f = D.fng().crypto;
    const top = D.cg.list.slice(0, 6).map((r) => 'c:' + r.id);
    const tiles = [
      g ? UI.stat('Crypto market cap', U.compact(g.mc, 'USD'), `<span class="${U.dir(g.chp)}">${U.pct(g.chp)}</span> 24h`) : '',
      g ? UI.stat('Bitcoin dominance', U.pctPlain(g.btcd, 1), `Ethereum ${U.pctPlain(g.ethd, 1)}`) : '',
      f ? UI.stat('Crypto fear & greed', String(f.v), esc(f.c)) : ''
    ].join('');
    return (tiles ? `<div class="tiles">${tiles}</div>` : '') + (top.length ? `<div class="list mt">${top.map((id, i) => UI.row(id, { logo: true, rank: i + 1 })).join('')}</div>` : '<div class="empty small"><p>Loading crypto prices…</p></div>');
  }

  function macroRows() {
    return `<div class="list">${MACRO_ROWS.map((id) => UI.row(id)).join('')}</div>`;
  }

  function gaugeTile(f, title, src) {
    if (!f || !U.isNum(f.v)) return '';
    const h = [['Yesterday', f.d1], ['Week', f.w1], ['Month', f.m1], ['Year', f.y1]].filter((x) => U.isNum(x[1])).map(([k, v]) => `<span>${k} <b>${v}</b></span>`).join('');
    return `<div class="tile gtile"><div class="stat-k">${esc(title)}</div>${App.Chart.gauge(f.v, { label: title })}<div class="g-v">${f.v}</div><div class="g-c">${esc(String(f.c || '').replace(/\b\w/g, (m) => m.toUpperCase()))}</div><div class="g-hist">${h}</div><div class="src">${esc(src)}</div></div>`;
  }
  function sentiment() {
    const f = App.D.fng();
    const html = gaugeTile(f.stocks, 'Stocks: Fear & Greed', 'CNN Business Fear & Greed Index') + gaugeTile(f.crypto, 'Crypto: Fear & Greed', 'alternative.me Crypto Fear & Greed Index');
    return html ? `<div class="tiles">${html}</div>` : '<div class="empty small"><p>Sentiment gauges load with the market data file.</p></div>';
  }

  function clocks() {
    return `<div class="clocks">${U.EXCHANGES.map((ex) => {
      const s = U.exchangeStatus(ex);
      return `<div class="clock"><i class="status-dot ${s.open ? 'open' : ''}"></i><b>${esc(ex.n)}</b><span>${esc(s.local)} · ${s.open ? 'Open' : s.holiday ? 'Holiday' : 'Closed'}</span></div>`;
    }).join('')}</div><div class="src">Regular sessions in local time. NYSE holidays through 2027 are included; other exchanges' holidays are not.</div>`;
  }

  function economy() {
    const M = window.CONTENT.macro;
    const mac = App.D.macro;
    const tiles = M.slice(0, 6).map((m) => {
      const live = mac && mac.fred && m.fred ? App.views.econValue(m.fred) : null;
      return `<a class="stat" href="#/more/economy"><div class="stat-k">${esc(m.k)}</div><div class="stat-v">${live ? live.v : esc(m.v)}</div><div class="stat-s">${live ? live.d : esc(m.d)}</div></a>`;
    }).join('');
    return `<div class="tiles">${tiles}</div>`;
  }

  function briefBlock(n) {
    const B = window.CONTENT.brief;
    return `<div class="brief">${B.items.slice(0, n).map((it) => `<article class="bitem"><h3>${esc(it.h)}</h3><p>${esc(it.t)}</p>${UI.src(it.src)}</article>`).join('')}</div>`;
  }

  function classTiles() {
    const D = App.D;
    return `<div class="tiles t4">${window.CATALOG.classes.map((c) => `<a class="tile class-tile" href="#/explore/${c.id}">${U.icon(c.icon)}<h3>${esc(c.n)}</h3><p>${esc(c.sub)}</p></a>`).join('')}</div>`;
  }

  const parts = { fresh: freshness, tape, indices: indexCards, movers, sectors, crypto: cryptoBlock, macro: macroRows, sentiment, clocks, economy };

  App.views.markets = {
    title: 'Markets',
    render(el) {
      const mk = U.usMarket();
      const date = U.fmtDate(Date.now(), { weekday: 'long', month: 'long', day: 'numeric' });
      el.innerHTML = `
        ${UI.header('Markets', {
          sub: `<span>${esc(date)}</span><span class="mstatus"><i class="status-dot ${mk.open ? 'open' : ''}"></i> ${esc(mk.label)}</span>`,
          actions: `<button class="icon-btn" data-act="refresh" aria-label="Refresh">${U.icon('refresh')}</button><button class="icon-btn only-mobile" data-act="search" aria-label="Search">${U.icon('search')}</button>`
        })}
        <div data-part="fresh" class="fresh-line"></div>
        <div data-part="tape"></div>
        ${UI.section('Indices', '<div data-part="indices"></div>', { more: '#/explore/index' })}
        <div class="cols">
          ${UI.section('Movers', UI.seg('movers', [['gain', 'Gainers'], ['lose', 'Losers'], ['active', 'Most Active']], moverMode) + '<div data-part="movers" class="mt"></div>', { sub: 'Among the large and popular US-listed stocks in this app' })}
          ${UI.section('Top Stories', briefBlock(3) + '<a class="btn secondary full mt" href="#/brief">All stories and sources</a>', { sub: 'Researched brief for ' + U.fmtDate(Date.parse(window.CONTENT.brief.date + 'T12:00:00Z'), { month: 'long', day: 'numeric', year: 'numeric' }) })}
        </div>
        <div class="cols">
          ${UI.section('Sectors Today', '<div data-part="sectors"></div>', { more: '#/explore/etf' })}
          ${UI.section('Commodities, Rates & FX', '<div data-part="macro"></div>', { more: '#/explore/commodity' })}
        </div>
        ${UI.section('Crypto', '<div data-part="crypto"></div>', { more: '#/explore/crypto' })}
        ${UI.section('Economy', '<div data-part="economy"></div>', { more: '#/more/economy', moreLabel: 'Dashboard' })}
        ${UI.section('Sentiment', '<div data-part="sentiment"></div>')}
        ${UI.section('Heatmaps', UI.seg('heat', [['stocks', 'S&P 500'], ['crypto', 'Crypto'], ['etf', 'ETFs']], heatMode) + `<div class="mt" id="heat-host"><button class="tv-load" data-act="heat">${U.icon('heat')}<span><b>Load live heatmap</b><span>Interactive TradingView map, sized by market value and colored by today's change</span></span></button></div>`)}
        ${UI.section('World Markets', '<div data-part="clocks"></div>')}
        ${UI.section('Headlines', `<div id="news-host"><button class="tv-load" data-act="news">${U.icon('news')}<span><b>Load live headlines</b><span>Market news feed from TradingView</span></span></button></div>`)}
        ${UI.section('Explore', classTiles())}
        <p class="footer-note">Information only, not investment advice. Prices can be delayed; each screen shows its source and time. Markets data: Yahoo Finance, CoinGecko, Coinbase, FRED, U.S. Treasury, CNN, alternative.me, TradingView. <a href="#/more/data">Data sources</a></p>
      `;
      this.refresh(el);
      App.D.loadMacro().then(() => { const box = el.querySelector('[data-part="economy"]'); if (box) box.innerHTML = economy(); });
      el.addEventListener('click', (e) => {
        const seg = e.target.closest('[data-seg] [data-v]');
        if (seg) {
          const name = seg.closest('[data-seg]').dataset.seg;
          seg.parentNode.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b === seg));
          if (name === 'movers') { moverMode = seg.dataset.v; el.querySelector('[data-part="movers"]').innerHTML = movers(); }
          if (name === 'heat') { heatMode = seg.dataset.v; const host = el.querySelector('#heat-host'); if (host.querySelector('.tradingview-widget-container')) loadHeat(host); }
          return;
        }
        const act = e.target.closest('[data-act]');
        if (!act) return;
        if (act.dataset.act === 'heat') loadHeat(el.querySelector('#heat-host'));
        if (act.dataset.act === 'news') { const nh = el.querySelector('#news-host'); nh.style.height = '600px'; App.TV.news(nh, null); }
        if (act.dataset.act === 'refresh') { App.D.refreshNow(); UI.toast('Refreshing data', 'refresh'); }
        if (act.dataset.act === 'search') UI.search();
      });
    },
    refresh(el) {
      Object.entries(parts).forEach(([k, fn]) => {
        const box = el.querySelector(`[data-part="${k}"]`);
        if (box) { try { box.innerHTML = fn(); } catch (e) { console.error(k, e); } }
      });
    }
  };

  function loadHeat(host) {
    host.style.height = '520px';
    if (heatMode === 'crypto') App.TV.cryptoHeatmap(host);
    else if (heatMode === 'etf') App.TV.etfHeatmap(host);
    else App.TV.stockHeatmap(host, 'SPX500');
  }

  // Full brief page
  App.views.brief = {
    title: 'Top Stories',
    render(el) {
      const B = window.CONTENT.brief;
      el.innerHTML = `${UI.header('Top Stories', { back: true, backLabel: 'Markets', sub: esc('Researched from news reports and official releases · ' + U.fmtDate(Date.parse(B.date + 'T12:00:00Z'), { month: 'long', day: 'numeric', year: 'numeric' })) })}
        ${briefBlock(99)}
        ${UI.section('Upcoming', `<div class="list">${window.CONTENT.calendar.map((c) => `<div class="row"><span class="r-main"><span class="r-sym">${esc(c.h)}</span><span class="r-name">${esc(c.t)}</span></span><span class="r-right"><span class="r-price">${U.fmtDate(Date.parse(c.d + 'T12:00:00Z'), { month: 'short', day: 'numeric' })}</span></span></div>`).join('')}</div>`)}
        <p class="footer-note">These summaries were written from the linked sources. Numbers are as reported on the dates shown; live prices elsewhere in the app update automatically.</p>`;
    }
  };
})();
