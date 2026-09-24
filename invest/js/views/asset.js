/* Asset detail page: price, interactive chart, statistics, profile, actions. */
(function () {
  'use strict';
  const App = (window.App = window.App || {});
  const U = App.U;
  const UI = App.UI;
  const esc = U.esc;
  App.views = App.views || {};

  const lastRange = {};
  const RANGE_LABEL = { '1D': 'today', '1W': 'past week', '1M': 'past month', '3M': 'past 3 months', '6M': 'past 6 months', YTD: 'year to date', '1Y': 'past year', '5Y': 'past 5 years', MAX: 'all time' };

  function rangesFor(a) {
    if (a.c === 'crypto') return a.y ? App.D.RANGES : ['1D', '1W', '1M', '3M', '6M', 'YTD', '1Y'];
    return App.D.RANGES;
  }

  function timeLine(a, q) {
    if (!q) return '';
    const bits = [UI.badge(q.srcKind)];
    const t = q.t;
    if (q.srcKind === 'live') bits.push(`<span>${esc(q.src)} · ${U.fmtDate(t || Date.now(), { hour: 'numeric', minute: '2-digit', second: '2-digit' })}</span>`);
    else if (q.srcKind === 'snapshot') bits.push(`<span>${esc(q.src)}${q.note ? ' (' + esc(q.note) + ')' : ''} · ${U.dateLong(t)}</span>`);
    else if (U.isNum(t)) {
      const closed = q.ms && q.ms !== 'REGULAR';
      bits.push(`<span>${closed && (a.c === 'stock' || a.c === 'etf' || a.c === 'index') ? 'At close · ' : 'As of '}${U.dateTimeET(t)} · ${esc(q.src)}</span>`);
    }
    return bits.join('');
  }

  function extHours(a, q) {
    if (!q || !(a.c === 'stock' || a.c === 'etf')) return '';
    const cur = App.D.cur(a, q);
    if (U.isNum(q.pp) && q.ms && q.ms !== 'REGULAR' && q.ms !== 'PRE') return `<div class="post">After hours: <b>${U.price(q.pp, a.c, cur)}</b> <span class="${U.dir(q.ppc)}">${U.pct(q.ppc)}</span></div>`;
    if (U.isNum(q.pre) && q.ms === 'PRE') return `<div class="post">Pre-market: <b>${U.price(q.pre, a.c, cur)}</b> <span class="${U.dir(q.prec)}">${U.pct(q.prec)}</span></div>`;
    return '';
  }

  // ------------------------------------------------------------- statistics
  function statsRows(a, q, prof) {
    const cur = App.D.cur(a, q);
    const P = (x) => (U.isNum(x) ? U.price(x, a.c, cur) : null);
    const rows = [];
    const add = (k, v) => { if (v !== null && v !== undefined && v !== '' && v !== '—') rows.push([k, v]); };
    if (!q) return rows;
    if (a.c === 'crypto') {
      add('Market cap', U.isNum(q.mc) ? U.compact(q.mc, 'USD') : null);
      add('Rank', q.r ? '#' + q.r : null);
      add('Fully diluted value', U.isNum(q.fdv) ? U.compact(q.fdv, 'USD') : null);
      add('24h volume', U.isNum(q.v) ? U.compact(q.v, 'USD') : null);
      add('24h high', P(q.h));
      add('24h low', P(q.l));
      add('Circulating supply', U.isNum(q.cs) ? U.compact(q.cs) + ' ' + esc(a.s) : null);
      add('Total supply', U.isNum(q.ts) ? U.compact(q.ts) : null);
      add('Max supply', U.isNum(q.mx) ? U.compact(q.mx) : q.cs ? '∞ (no cap)' : null);
      add('All-time high', U.isNum(q.ath) ? `${P(q.ath)} <small class="muted">${q.athd ? U.fmtDate(Date.parse(q.athd), { month: 'short', year: 'numeric' }) : ''}</small>` : null);
      add('From all-time high', U.isNum(q.athp) ? `<span class="${U.dir(q.athp)}">${U.pct(q.athp)}</span>` : null);
      add('All-time low', U.isNum(q.atl) ? `${P(q.atl)} <small class="muted">${q.atld ? U.fmtDate(Date.parse(q.atld), { month: 'short', year: 'numeric' }) : ''}</small>` : null);
      add('1h change', U.isNum(q.c1h) ? `<span class="${U.dir(q.c1h)}">${U.pct(q.c1h)}</span>` : null);
      add('7d change', U.isNum(q.c7d) ? `<span class="${U.dir(q.c7d)}">${U.pct(q.c7d)}</span>` : null);
      add('30d change', U.isNum(q.c30d) ? `<span class="${U.dir(q.c30d)}">${U.pct(q.c30d)}</span>` : null);
      add('1y change', U.isNum(q.c1y) ? `<span class="${U.dir(q.c1y)}">${U.pct(q.c1y)}</span>` : null);
      return rows;
    }
    add('Open', P(q.o));
    add('High', P(q.h));
    add('Low', P(q.l));
    add('Previous close', P(q.pc));
    if (a.c !== 'index' && a.c !== 'fx' && a.c !== 'rate') {
      add('Volume', U.isNum(q.v) ? U.compact(q.v) : null);
      add('Avg. volume (3M)', U.isNum(q.av) ? U.compact(q.av) : null);
    }
    add('Market cap', U.isNum(q.mc) ? U.compact(q.mc, cur) : null);
    add('P/E ratio', U.isNum(q.pe) ? U.fmtN(q.pe, 2) : null);
    add('Forward P/E', U.isNum(q.fpe) ? U.fmtN(q.fpe, 2) : null);
    add('EPS (TTM)', U.isNum(q.eps) ? U.money(q.eps, cur) : null);
    add('Dividend yield', U.isNum(q.dy) && q.dy > 0 ? U.pctPlain(q.dy) : null);
    add('Annual dividend', U.isNum(q.dr) && q.dr > 0 ? U.money(q.dr, cur) : null);
    add('Beta (5Y)', prof && U.isNum(prof.beta) ? U.fmtN(prof.beta, 2) : null);
    add('Price / book', U.isNum(q.pb) ? U.fmtN(q.pb, 2) : null);
    add('Shares outstanding', U.isNum(q.so) ? U.compact(q.so) : null);
    add('52-week high', P(q.h52));
    add('52-week low', P(q.l52));
    add('50-day average', P(q.ma50));
    add('200-day average', P(q.ma200));
    if (a.c === 'etf') {
      const er = U.isNum(q.er) ? q.er : prof && U.isNum(prof.er) ? prof.er : null;
      add('Expense ratio', U.isNum(er) ? U.pctPlain(er, 2) : null);
      const aum = U.isNum(q.na) ? q.na : prof && prof.aum;
      add('Net assets', U.isNum(aum) ? U.compact(aum, 'USD') : null);
      add('Distribution yield', prof && U.isNum(prof.yld) ? U.pctPlain(prof.yld) : null);
      add('YTD return (NAV)', U.isNum(q.ytd) ? `<span class="${U.dir(q.ytd)}">${U.pct(q.ytd)}</span>` : null);
      add('Category', prof && prof.cat ? esc(prof.cat) : null);
      add('Fund family', prof && prof.fam ? esc(prof.fam) : null);
      add('Inception', prof && U.isNum(prof.inc) ? U.dateLong(prof.inc * 1000) : null);
    }
    const earn = (prof && prof.earn) || q.earn;
    if (a.c === 'stock' && U.isNum(earn) && earn * 1000 > Date.now() - 86400000 * 2) add('Next earnings', U.dateLong(earn * 1000));
    if (prof && U.isNum(prof.exd)) add('Ex-dividend date', U.dateLong(prof.exd * 1000));
    if (a.unit) add('Unit', esc(a.unit));
    if (q.ex) add('Exchange', esc(q.ex));
    if (cur && cur !== 'USD') add('Currency', esc(cur));
    return rows;
  }

  function aboutBlock(a, q, prof) {
    const text = (prof && prof.sum) || a.d || '';
    const facts = [];
    if (prof) {
      if (prof.sec) facts.push(['Sector', esc(prof.sec)]);
      if (prof.ind) facts.push(['Industry', esc(prof.ind)]);
      if (prof.ceo) facts.push([/chief executive|ceo/i.test(prof.ceot || '') ? 'CEO' : 'Leader', esc(prof.ceo)]);
      if (U.isNum(prof.emp)) facts.push(['Employees', U.int(prof.emp)]);
      if (prof.city || prof.cty) facts.push(['Headquarters', esc([prof.city, prof.st, prof.cty].filter(Boolean).join(', '))]);
      if (prof.web) facts.push(['Website', `<a href="${esc(prof.web)}" target="_blank" rel="noopener">${esc(prof.web.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, ''))}</a>`]);
    } else if (a.dom) {
      facts.push(['Website', `<a href="https://${esc(a.dom)}" target="_blank" rel="noopener">${esc(a.dom)}</a>`]);
    }
    if (a.g && a.c !== 'index') facts.push(['Category', esc(a.g)]);
    return `<p class="about clamp" data-clamp>${esc(text)}</p>${text.length > 320 ? '<button class="more-link" data-act="more">More</button>' : ''}${facts.length ? UI.kv(facts) : ''}${prof && prof.sum ? '<div class="src">Profile: Yahoo Finance</div>' : ''}`;
  }

  function analystBlock(a, q, prof) {
    if (!prof || !prof.tgt || !q || !U.isNum(q.p)) return '';
    const t = prof.tgt;
    const cur = App.D.cur(a, q);
    const rec = prof.rec ? prof.rec.replace(/_/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase()) : null;
    const up = U.isNum(t.m) ? ((t.m - q.p) / q.p) * 100 : null;
    return UI.section('Analyst Forecasts', `<div class="tile">
      <div class="split"><div><div class="stat-k">Consensus</div><div class="stat-v">${esc(rec || '—')}</div>${U.isNum(prof.recm) ? `<div class="stat-s">Mean score ${U.fmtN(prof.recm, 2)} on a 1 (strong buy) to 5 (sell) scale</div>` : ''}</div>
      <div style="text-align:right"><div class="stat-k">Mean target</div><div class="stat-v">${U.price(t.m, a.c, cur)}</div><div class="stat-s ${U.dir(up)}">${U.pct(up)} vs now</div></div></div>
      ${App.Chart.rangeBar(Math.min(t.l, q.p), Math.max(t.h, q.p), q.p, { fmt: (v) => U.price(v, a.c, cur), mid: t.m, midLabel: 'mean' })}
      <div class="stat-s">${U.isNum(t.n) ? t.n + ' analysts · ' : ''}Low ${U.price(t.l, a.c, cur)} · High ${U.price(t.h, a.c, cur)} · Dot = current price</div>
      <div class="src">Wall Street estimates via Yahoo Finance. Targets are opinions, not predictions you can rely on.</div></div>`);
  }

  function financialsBlock(a, prof) {
    if (!prof || !(U.isNum(prof.rev) || U.isNum(prof.gm))) return '';
    const rows = [
      U.isNum(prof.rev) && ['Revenue (TTM)', U.compact(prof.rev, 'USD')],
      U.isNum(prof.revg) && ['Revenue growth (YoY)', `<span class="${U.dir(prof.revg)}">${U.pct(prof.revg * 100)}</span>`],
      U.isNum(prof.gm) && ['Gross margin', U.pctPlain(prof.gm * 100, 1)],
      U.isNum(prof.om) && ['Operating margin', U.pctPlain(prof.om * 100, 1)],
      U.isNum(prof.pm) && ['Profit margin', U.pctPlain(prof.pm * 100, 1)],
      U.isNum(prof.roe) && ['Return on equity', U.pctPlain(prof.roe * 100, 1)],
      U.isNum(prof.fcf) && ['Free cash flow', U.compact(prof.fcf, 'USD')],
      U.isNum(prof.cash) && ['Cash', U.compact(prof.cash, 'USD')],
      U.isNum(prof.debt) && ['Debt', U.compact(prof.debt, 'USD')],
      U.isNum(prof.ev) && ['Enterprise value', U.compact(prof.ev, 'USD')],
      U.isNum(prof.eve) && ['EV / EBITDA', U.fmtN(prof.eve, 1)],
      U.isNum(prof.inst) && ['Held by institutions', U.pctPlain(prof.inst * 100, 1)],
      U.isNum(prof.sp) && ['Short interest (% float)', U.pctPlain(prof.sp * 100, 1)]
    ].filter(Boolean);
    return rows.length ? UI.section('Financials', UI.kv(rows) + '<div class="src">Latest reported figures via Yahoo Finance; values are in the company\'s reporting currency.</div>') : '';
  }

  function holdingsBlock(prof) {
    if (!prof || !(prof.hold || prof.sw)) return '';
    let html = '';
    if (prof.hold && prof.hold.length) {
      html += UI.section('Top Holdings', `<div class="list">${prof.hold.map(([s, n, p]) => {
        const id = s && window.CATALOG.byId[s] ? s : null;
        const inner = `<span class="r-main"><span class="r-sym">${esc(s || n)}</span><span class="r-name">${esc(n)}</span></span><span class="r-right"><span class="r-price">${U.pctPlain((p || 0) * 100)}</span></span>`;
        return id ? `<a class="row" href="#/a/${encodeURIComponent(id)}">${inner}</a>` : `<div class="row">${inner}</div>`;
      }).join('')}</div>`);
    }
    if (prof.sw && prof.sw.length) {
      const names = { realestate: 'Real estate', consumer_cyclical: 'Consumer cyclical', basic_materials: 'Materials', consumer_defensive: 'Consumer defensive', technology: 'Technology', communication_services: 'Communication', financial_services: 'Financials', utilities: 'Utilities', industrials: 'Industrials', energy: 'Energy', healthcare: 'Health care' };
      const rows = prof.sw.slice().sort((x, y) => y[1] - x[1]);
      const max = rows[0][1];
      html += UI.section('Sector Weights', `<div class="recs">${rows.map(([k, v]) => `<div class="rec"><div class="rec-h"><span class="rec-t"><b>${esc(names[k] || k)}</b></span><span class="rec-p">${U.pctPlain(v * 100, 1)}</span></div><div class="rec-bar"><i style="width:${((v / max) * 100).toFixed(1)}%"></i></div></div>`).join('')}</div>`);
    }
    return html;
  }

  function positionBlock(id, a, q) {
    const S = App.S;
    const lots = S.state.holdings.filter((h) => h.asset === id);
    const pp = S.paper().pos[id];
    if (!lots.length && !pp) return '';
    const cur = App.D.cur(a, q);
    let html = '';
    if (lots.length) {
      const qty = lots.reduce((s, h) => s + h.qty, 0);
      const cost = lots.reduce((s, h) => s + h.qty * (h.cost || 0), 0);
      const val = q && U.isNum(q.p) ? qty * q.p : null;
      const gain = U.isNum(val) ? val - cost : null;
      html += `<div class="tile"><div class="stat-k">Your holdings</div><div class="split"><div class="stat-v">${U.isNum(val) ? U.money(val, cur) : '—'}</div><div class="${U.dir(gain)}" style="font-weight:600">${U.isNum(gain) ? U.signed(gain, null, cur) + (cost ? ' (' + U.pct((gain / cost) * 100) + ')' : '') : ''}</div></div><div class="stat-s">${U.fmtN(qty, 0, 8)} ${esc(a.s)} · avg cost ${U.money(cost / qty, cur)} · ${lots.length} lot${lots.length > 1 ? 's' : ''}</div></div>`;
    }
    if (pp) {
      const val = q && U.isNum(q.p) ? pp.qty * q.p : null;
      const gain = U.isNum(val) ? val - pp.qty * pp.cost : null;
      html += `<div class="tile mt"><div class="stat-k">Paper trading position</div><div class="split"><div class="stat-v">${U.isNum(val) ? U.money(val, cur) : '—'}</div><div class="${U.dir(gain)}" style="font-weight:600">${U.isNum(gain) ? U.signed(gain, null, cur) + ' (' + U.pct((gain / (pp.qty * pp.cost)) * 100) + ')' : ''}</div></div><div class="stat-s">${U.fmtN(pp.qty, 0, 8)} ${esc(a.s)} · avg ${U.money(pp.cost, cur)}</div></div>`;
    }
    return UI.section('Your Position', html);
  }

  function related(a) {
    const D = App.D;
    let list = window.CATALOG.assets.filter((x) => x.c === a.c && x.g === a.g && x.id !== a.id);
    if (list.length < 3) list = window.CATALOG.assets.filter((x) => x.c === a.c && x.id !== a.id);
    list = list.slice(0, 6).map((x) => x.id);
    return list.length ? UI.section('Related', `<div class="list">${list.map((id) => UI.row(id, { logo: a.c === 'stock' || a.c === 'crypto' })).join('')}</div>`, { more: '#/explore/' + (a.c === 'rate' ? 'rate' : a.c) }) : '';
  }

  // ------------------------------------------------------------- NFT page
  function nftBody(id, a, q) {
    const n = q || {};
    const bars = [['24h', n.chp], ['7 days', n.c7d], ['30 days', n.c30d], ['1 year', n.c1y]].filter((r) => U.isNum(r[1])).map(([label, value]) => ({ label, value }));
    return `
      ${UI.section('Floor Price Change (USD)', bars.length ? App.Chart.divBars(bars) : '<div class="empty small"><p>Change history unavailable.</p></div>', { sub: 'CoinGecko publishes floor history only on paid plans, so this shows period changes instead of a chart.' })}
      ${UI.section('Statistics', UI.kv([
        ['Floor price', U.isNum(n.p) ? `Ξ ${U.fmtN(n.p, 3, 4)}` : '—'],
        ['Floor price (USD)', U.isNum(n.pu) ? U.money(n.pu) : '—'],
        ['Market cap', U.isNum(n.mc) ? U.compact(n.mc, 'USD') : '—'],
        ['24h volume', U.isNum(n.v) ? U.compact(n.v, 'USD') : '—'],
        ['24h sales', U.isNum(n.sales) ? U.int(n.sales) : '—'],
        ['Avg. sale (24h)', U.isNum(n.avg) ? `Ξ ${U.fmtN(n.avg, 3, 4)}` : '—'],
        ['Owners', U.isNum(n.holders) ? U.int(n.holders) : '—'],
        ['Supply', U.isNum(n.supply) ? U.int(n.supply) : '—'],
        ['All-time high floor', U.isNum(n.ath) ? `Ξ ${U.fmtN(n.ath, 2, 3)}${n.athd ? ' · ' + U.fmtDate(Date.parse(n.athd), { month: 'short', year: 'numeric' }) : ''}` : '—'],
        ['Blockchain', esc(n.chain || a.chain || '—')]
      ]))}
      ${UI.section('About', `<p class="about">${esc(a.d || (App.D.nftLive[id] && App.D.nftLive[id].desc) || '')}</p>
        ${UI.kv([
          (n.contract || a.contract) && ['Contract', `<a href="https://etherscan.io/address/${esc(n.contract || a.contract)}" target="_blank" rel="noopener">${esc((n.contract || a.contract).slice(0, 8) + '…' + (n.contract || a.contract).slice(-6))}</a>`],
          n.web && ['Website', `<a href="${esc(n.web)}" target="_blank" rel="noopener">${esc(n.web.replace(/^https?:\/\/(www\.)?/, ''))}</a>`],
          ['CoinGecko', `<a href="https://www.coingecko.com/en/nft/${esc(id.slice(2))}" target="_blank" rel="noopener">View collection</a>`]
        ])}`)}
      <div class="note">${U.icon('info')}<span>${esc(window.CONTENT.guides.nft.ret)}</span></div>`;
  }

  // ------------------------------------------------------------- main view
  App.views.asset = {
    render(el, id) {
      const D = App.D;
      const a = D.asset(id);
      this.id = id;
      this.el = el;
      if (!a) {
        el.innerHTML = UI.header('Not found', { back: true }) + UI.empty('search', 'Asset not found', 'It may not be loaded yet. Try again in a moment, or search for it.');
        this.title = 'Not found';
        return;
      }
      this.title = a.s;
      D.focus = id;
      if (D.status.finnhub === 'live' || App.S.settings.finnhubKey) D.syncFinnhub();
      App.S.pushRecent(id);
      const q = D.quote(id);
      const watched = App.S.inAnyList(id);
      const isNft = a.c === 'nft';
      const tvSym = App.TV.symbol(a, q);
      const range = lastRange[id] || (a.c === 'crypto' ? '1D' : '1D');
      this.range = range;
      this.compare = null;

      el.innerHTML = `
        ${UI.header(a.s, {
          back: true, large: false, small: a.s,
          actions: `<button class="icon-btn ${watched ? 'on' : ''}" data-act="watch" aria-label="${watched ? 'Remove from' : 'Add to'} watchlist">${U.icon(watched ? 'starFill' : 'star')}</button><button class="icon-btn" data-act="share" aria-label="Share">${U.icon('share')}</button>`
        })}
        <div class="a-head">${UI.logo(a, q, 44)}<div class="a-titles"><div class="a-sym">${esc(a.s)}</div><div class="a-name">${esc(a.n)}${a.c !== 'custom' ? ` · ${esc(UI.clsLabel(a.c))}` : ''}</div></div></div>
        <div class="hero">
          <div class="hero-p" data-hero="p" data-q="${esc(id)}" data-f="p">${UI.priceText(id, q)}</div>
          ${isNft && q && U.isNum(q.pu) ? `<div class="hero-c muted">${U.money(q.pu)} floor</div>` : ''}
          <div class="hero-c ${U.dir(q && q.chp)}" data-hero="c" ${isNft ? '' : `data-q="${esc(id)}" data-f="chg"`}>${q ? (isNft ? U.pct(q.chp) + ' (24h)' : UI.chgText(id, q)) : '—'}</div>
          <div class="hero-t" data-hero="t">${timeLine(a, q)}</div>
          ${extHours(a, q)}
        </div>
        ${isNft || a.c === 'custom' ? '' : `
          <div class="ranges">${UI.seg('range', rangesFor(a).map((r) => [r, r]), range, 'plain')}</div>
          <div class="chart-wrap"><div id="chart"></div></div>
          <div class="chart-src"><span data-part="rsum"></span><span data-part="csrc"></span></div>`}
        ${a.c === 'custom' ? `<div class="btn-row"><button class="btn primary" data-act="cvalue">${U.icon('edit')} Update value</button><button class="btn secondary" data-act="cremove">${U.icon('trash')} Remove</button></div><p class="about mt">A manually tracked asset in your portfolio (${esc(a.g)}). Its value is your own estimate.</p>` : `<div class="actions">
          <button class="act ${watched ? 'on' : ''}" data-act="watch">${U.icon(watched ? 'starFill' : 'star')}<span>${watched ? 'Watching' : 'Watch'}</span></button>
          ${isNft ? `<button class="act" data-act="hold">${U.icon('portfolio')}<span>Holding</span></button>` : `<button class="act" data-act="trade">${U.icon('swap')}<span>Trade</span></button>`}
          <button class="act" data-act="alert">${U.icon('bell')}<span>Alert</span></button>
          ${tvSym ? `<button class="act" data-act="pro">${U.icon('candle')}<span>Pro chart</span></button>` : `<button class="act" data-act="hold">${U.icon('portfolio')}<span>Holding</span></button>`}
        </div>`}
        <div data-part="position">${positionBlock(id, a, q)}</div>
        ${isNft ? nftBody(id, a, q) : a.c === 'custom' ? '' : `
          ${`<div class="split mt"><button class="btn secondary sm" data-act="compare">${U.icon('compare')} Compare</button>${tvSym && a.c !== 'crypto' ? '' : ''}<button class="btn secondary sm" data-act="hold">${U.icon('plus')} Add to portfolio</button></div>`}
          <div data-part="perf"></div>
          ${UI.section('Key Statistics', '<div data-part="stats"></div><div data-part="ranges52"></div>')}
          <div data-part="analyst"></div>
          ${UI.section('About', '<div data-part="about"></div>')}
          <div data-part="fin"></div>
          <div data-part="holdings"></div>
          ${tvSym ? UI.section('Technical Analysis', `<div id="tv-ta"><button class="tv-load" data-act="ta">${U.icon('gauge')}<span><b>Load technical rating</b><span>Buy/sell summary from moving averages and oscillators (TradingView)</span></span></button></div>`) : ''}
          ${tvSym ? UI.section('News', `<div id="tv-news"><button class="tv-load" data-act="news">${U.icon('news')}<span><b>Load headlines for ${esc(a.s)}</b><span>Live news from TradingView</span></span></button></div>`) : ''}
          ${related(a)}`}
        <p class="footer-note">Data: ${esc(q ? q.src : 'unavailable')}${q && q.srcKind === 'pipeline' ? ' (delayed; refreshed by the app\'s data job several times a day)' : ''}. Not investment advice.</p>
      `;

      this.fillStatic();
      if (!isNft && a.c !== 'custom') this.drawChart();
      if (a.c === 'stock' || a.c === 'etf') D.loadProfiles().then(() => this.fillStatic());
      if (a.c === 'crypto') this.loadCoinDetail(a);
      if (isNft && !D.nftLive[id]) D.fetchNft(id).then((ok) => { if (ok && this.id === id) this.render(el, id); });

      el.onclick = (e) => this.onClick(e); // assigned, not added: render() can run again on the same element
    },

    fillStatic() {
      const D = App.D;
      const el = this.el;
      const id = this.id;
      const a = D.asset(id);
      const q = D.quote(id);
      const prof = D.profile(id);
      const set = (k, html) => { const n = el.querySelector(`[data-part="${k}"]`); if (n) n.innerHTML = html; };
      if (a.c === 'nft' || a.c === 'custom') return;
      const rows = statsRows(a, q, prof);
      set('stats', rows.length ? `<div class="kv k3">${rows.map(([k, v]) => `<div class="kv-row"><span>${esc(k)}</span><b>${v}</b></div>`).join('')}</div>` : '<p class="muted">No statistics available.</p>');
      const cur = D.cur(a, q);
      let rb = '';
      if (q && U.isNum(q.l) && U.isNum(q.h) && U.isNum(q.p)) rb += `<div class="mt"><div class="stat-k">${a.c === 'crypto' ? '24-hour range' : "Today's range"}</div>${App.Chart.rangeBar(Math.min(q.l, q.p), Math.max(q.h, q.p), q.p, { fmt: (v) => U.price(v, a.c, cur) })}</div>`;
      if (q && U.isNum(q.l52) && U.isNum(q.h52) && U.isNum(q.p)) rb += `<div class="mt"><div class="stat-k">52-week range</div>${App.Chart.rangeBar(Math.min(q.l52, q.p), Math.max(q.h52, q.p), q.p, { fmt: (v) => U.price(v, a.c, cur) })}</div>`;
      set('ranges52', rb);
      set('about', a.c === 'crypto' && this.coin ? aboutCrypto(a, this.coin) : aboutBlock(a, q, prof));
      set('analyst', a.c === 'stock' ? analystBlock(a, q, prof) : '');
      set('fin', a.c === 'stock' ? financialsBlock(a, prof) : '');
      set('holdings', a.c === 'etf' ? holdingsBlock(prof) : '');
      D.performance(id).then((p) => {
        if (!p || this.id !== id) return;
        const keys = ['1W', '1M', '3M', '6M', 'YTD', '1Y', '5Y', 'MAX'].filter((k) => U.isNum(p[k]));
        set('perf', keys.length ? UI.section('Performance', `<div class="perf">${keys.map((k) => `<div><span>${k === 'MAX' ? 'Since ' + U.fmtDate(p.since, { year: 'numeric' }) : k}</span><b class="${U.dir(p[k])}">${U.pct(p[k], Math.abs(p[k]) >= 1000 ? 0 : 1)}</b></div>`).join('')}</div><div class="src">Price change only (excludes dividends).</div>`) : '');
      });
    },

    async loadCoinDetail(a) {
      const info = await App.D.fetchCoinDetail(a.cg);
      if (info && this.id === a.id) { this.coin = info; this.fillStatic(); }
    },

    async drawChart(range) {
      const D = App.D;
      const el = this.el;
      const id = this.id;
      const a = D.asset(id);
      if (range) { this.range = range; lastRange[id] = range; }
      range = this.range;
      const host = el.querySelector('#chart');
      if (!host) return;
      if (!host.firstChild) host.innerHTML = '<div class="skel" style="height:230px;margin-top:10px"></div>';
      const token = (this.token = Math.random());
      let s = null;
      try { s = await D.series(id, range); } catch (e) { s = null; }
      if (token !== this.token || this.id !== id) return;
      const rsum = el.querySelector('[data-part="rsum"]');
      const csrc = el.querySelector('[data-part="csrc"]');
      if (this.chart) this.chart.destroy();
      if (this.compare) return this.drawCompare(s);
      if (!s) {
        const tvSym = App.TV.symbol(a, D.quote(id));
        if (tvSym) {
          host.style.height = '300px';
          App.TV.overview(host, tvSym, a.s, U.dir(D.quote(id) && D.quote(id).chp));
          rsum.textContent = '';
          csrc.textContent = 'Live chart: TradingView';
        } else {
          host.innerHTML = '<div class="chart-empty">Chart data for this range is not available yet.</div>';
          rsum.textContent = '';
          csrc.textContent = '';
        }
        return;
      }
      host.style.height = '';
      const q = D.quote(id);
      const cur = D.cur(a, q);
      const pts = s.pts;
      const ref = range === '1D' && U.isNum(s.pc) ? s.pc : pts[0][1];
      const last = pts[pts.length - 1][1];
      const ch = last - ref;
      const chp = ref ? (ch / ref) * 100 : 0;
      rsum.innerHTML = `<span class="${U.dir(ch)}">${U.signed(ch, a.c, cur)} (${U.pct(chp)})</span> ${esc(RANGE_LABEL[range] || '')}`;
      csrc.textContent = s.src ? s.src : '';
      const hero = {
        p: el.querySelector('[data-hero="p"]'),
        c: el.querySelector('[data-hero="c"]'),
        t: el.querySelector('[data-hero="t"]')
      };
      const saved = {};
      this.chart = App.Chart.price(host, {
        pts, pc: range === '1D' ? s.pc : undefined, s: s.s, e: s.e, intraday: !!s.intraday, height: 250,
        live: q && q.srcKind === 'live' && range === '1D',
        label: `${a.s} price, ${RANGE_LABEL[range] || range}`,
        fmtAxis: (v) => (a.c === 'rate' ? U.fmtN(v, 2) + '%' : Math.abs(v) >= 1000 ? U.fmtN(v, 0) : U.fmtN(v, U.priceDigits(v, a.c), U.priceDigits(v, a.c))),
        onScrub: (info) => {
          if (!info) {
            if (saved.p !== undefined) {
              hero.p.innerHTML = saved.p; hero.c.innerHTML = saved.c; hero.c.className = saved.cc; hero.t.innerHTML = saved.t;
              hero.p.dataset.q = id; hero.c.dataset.q = id;
              delete saved.p;
              App.UI.refreshAllLive();
            }
            return;
          }
          if (saved.p === undefined) { saved.p = hero.p.innerHTML; saved.c = hero.c.innerHTML; saved.cc = hero.c.className; saved.t = hero.t.innerHTML; delete hero.p.dataset.q; delete hero.c.dataset.q; }
          if (info.point) {
            const [t, v] = info.point;
            const d = v - ref;
            hero.p.textContent = U.price(v, a.c, cur);
            hero.c.textContent = `${U.signed(d, a.c, cur)} (${U.pct(ref ? (d / ref) * 100 : 0)})`;
            hero.c.className = 'hero-c ' + U.dir(d);
            hero.t.textContent = s.intraday ? U.fmtDate(t, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : U.fmtDate(t, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
          } else if (info.range) {
            const [p1, p2] = info.range;
            const d = p2[1] - p1[1];
            hero.p.textContent = U.signed(d, a.c, cur);
            hero.c.textContent = U.pct(p1[1] ? (d / p1[1]) * 100 : 0);
            hero.c.className = 'hero-c ' + U.dir(d);
            const f = (t) => (s.intraday ? U.fmtDate(t, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : U.dateLong(t));
            hero.t.textContent = `${f(p1[0])} → ${f(p2[0])}`;
          }
        }
      });
    },

    async drawCompare(base) {
      const D = App.D;
      const el = this.el;
      const host = el.querySelector('#chart');
      const other = this.compare;
      const b = D.asset(other);
      const a = D.asset(this.id);
      let s2 = null;
      try { s2 = await D.series(other, this.range); } catch (e) { s2 = null; }
      if (!base || !s2) { host.innerHTML = '<div class="chart-empty">Comparison data is not available for this range.</div>'; return; }
      const norm = (pts) => { const b0 = pts[0][1]; return pts.map(([t, v]) => [t, ((v - b0) / b0) * 100]); };
      const t0 = Math.max(base.pts[0][0], s2.pts[0][0]);
      const cut = (pts) => { const i = pts.findIndex((p) => p[0] >= t0); return pts.slice(Math.max(0, i - 1)); };
      App.Chart.multi(host, [
        { name: a.s, color: App.Chart.series(0), pts: norm(cut(base.pts)) },
        { name: b.s, color: App.Chart.series(1), pts: norm(cut(s2.pts)) }
      ], { height: 250, fmtY: (v) => U.pct(v, 1), fmtX: (t) => U.fmtDate(t, base.intraday ? { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' } : { month: 'short', day: 'numeric', year: 'numeric' }), zero: true, label: `${a.s} vs ${b.s}` });
      el.querySelector('[data-part="rsum"]').innerHTML = `Comparing % change with <b>${esc(b.s)}</b> <button class="more-link" data-act="uncompare">Clear</button>`;
    },

    onClick(e) {
      const D = App.D;
      const id = this.id;
      const a = D.asset(id);
      const segBtn = e.target.closest('[data-seg="range"] [data-v]');
      if (segBtn) {
        segBtn.parentNode.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b === segBtn));
        this.drawChart(segBtn.dataset.v);
        return;
      }
      const act = e.target.closest('[data-act]');
      if (!act) return;
      const k = act.dataset.act;
      if (k === 'watch') {
        const on = App.S.toggleWatch(id);
        U.haptic();
        UI.toast(on ? `Added ${a.s} to ${App.S.list().name}` : `Removed ${a.s} from ${App.S.list().name}`, on ? 'starFill' : 'star');
        this.el.querySelectorAll('[data-act="watch"]').forEach((b) => {
          b.classList.toggle('on', App.S.inAnyList(id));
          b.innerHTML = b.classList.contains('act') ? `${U.icon(App.S.inAnyList(id) ? 'starFill' : 'star')}<span>${App.S.inAnyList(id) ? 'Watching' : 'Watch'}</span>` : U.icon(App.S.inAnyList(id) ? 'starFill' : 'star');
        });
      } else if (k === 'share') {
        const q = D.quote(id);
        const text = `${a.n} (${a.s}) ${UI.priceText(id, q)} ${q ? U.pct(q.chp) : ''}`;
        const url = location.href;
        if (navigator.share) navigator.share({ title: a.n, text, url }).catch(() => {});
        else U.copy(text + ' ' + url).then((ok) => UI.toast(ok ? 'Link copied' : 'Could not copy', 'copy'));
      } else if (k === 'trade') {
        App.views.trade(id);
      } else if (k === 'hold') {
        App.views.addHolding(id);
      } else if (k === 'alert') {
        App.views.addAlert(id);
      } else if (k === 'pro') {
        const sym = App.TV.symbol(a, D.quote(id));
        const s = UI.sheet({ title: `${a.s} · Pro chart`, wide: true, full: true, body: '<div class="tv-host" id="tv-adv"></div><div class="src">Interactive chart by TradingView: candlesticks, indicators and drawing tools. You can change the symbol inside the chart.</div>' });
        App.TV.advanced(s.body.querySelector('#tv-adv'), sym);
      } else if (k === 'ta') {
        const host = this.el.querySelector('#tv-ta');
        host.style.height = '440px';
        App.TV.technicals(host, App.TV.symbol(a, D.quote(id)));
      } else if (k === 'news') {
        const host = this.el.querySelector('#tv-news');
        host.style.height = '520px';
        App.TV.news(host, App.TV.symbol(a, D.quote(id)));
      } else if (k === 'more') {
        const p = this.el.querySelector('[data-clamp]');
        p.classList.toggle('clamp');
        act.textContent = p.classList.contains('clamp') ? 'More' : 'Less';
      } else if (k === 'compare') {
        UI.picker({
          title: 'Compare with',
          popular: ['^GSPC', '^IXIC', 'c:bitcoin', 'GC=F', 'VOO', 'QQQ', 'AAPL', 'NVDA', 'MSFT', 'TLT'],
          filter: (x) => x.id !== id && x.c !== 'nft' && x.c !== 'custom',
          onPick: (other) => {
            this.compare = other;
            if (this.range === '1D') {
              this.range = '1Y';
              this.el.querySelectorAll('[data-seg="range"] button').forEach((b) => b.classList.toggle('on', b.dataset.v === '1Y'));
            }
            this.drawChart();
          }
        });
      } else if (k === 'cvalue') {
        const c = App.S.state.custom[id];
        UI.prompt('Update value', [{ name: 'value', label: `Current value (${c.cur})`, type: 'number', step: 'any', value: c.value }]).then((r) => { if (r && U.isNum(r.value)) { App.S.updateCustom(id, { value: r.value }); this.render(this.el, id); } });
      } else if (k === 'cremove') {
        UI.confirm('Remove ' + a.n + '?', 'It will be removed from your portfolio.', 'Remove', true).then((ok) => { if (ok) { App.S.removeCustom(id); location.hash = '#/portfolio'; } });
      } else if (k === 'uncompare') {
        this.compare = null;
        this.drawChart();
      }
    },

    refresh() {
      const D = App.D;
      const id = this.id;
      const a = D.asset(id);
      if (!a || !this.el) return;
      const q = D.quote(id);
      const t = this.el.querySelector('[data-hero="t"]');
      const hp = this.el.querySelector('[data-hero="p"]');
      if (t && (!hp || hp.dataset.q !== undefined)) t.innerHTML = timeLine(a, q); // not while scrubbing
      const pos = this.el.querySelector('[data-part="position"]');
      if (pos) pos.innerHTML = positionBlock(id, a, q);
      if (a.c !== 'nft') this.fillStatic();
    },

    onLive(ids) {
      if (!ids.includes(this.id) || this.range !== '1D' || this.compare) return;
      const now = Date.now();
      if (this.lastRedraw && now - this.lastRedraw < 20000) return;
      this.lastRedraw = now;
      const hero = this.el && this.el.querySelector('[data-hero="p"]');
      if (hero && hero.dataset.q === undefined) return; // user is scrubbing
      const t = this.el.querySelector('[data-hero="t"]');
      if (t) t.innerHTML = timeLine(App.D.asset(this.id), App.D.quote(this.id));
      this.drawChart();
    },

    leave() { App.D.focus = null; if (this.chart) this.chart.destroy(); this.el = null; }
  };

  function aboutCrypto(a, coin) {
    const facts = [];
    if (coin.genesis) facts.push(['Launched', U.dateLong(Date.parse(coin.genesis))]);
    if (coin.algo) facts.push(['Consensus / hashing', esc(coin.algo)]);
    if (coin.cats && coin.cats.length) facts.push(['Categories', esc(coin.cats.join(', '))]);
    if (coin.web) facts.push(['Website', `<a href="${esc(coin.web)}" target="_blank" rel="noopener">${esc(coin.web.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, ''))}</a>`]);
    const text = a.d || coin.desc;
    return `<p class="about clamp" data-clamp>${esc(text)}</p>${text && text.length > 320 ? '<button class="more-link" data-act="more">More</button>' : ''}${facts.length ? UI.kv(facts) : ''}<div class="src">Details: CoinGecko</div>`;
  }
})();
