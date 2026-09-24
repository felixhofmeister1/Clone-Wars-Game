/* Explore tab and one page per asset class. */
(function () {
  'use strict';
  const App = (window.App = window.App || {});
  const U = App.U;
  const UI = App.UI;
  const esc = U.esc;
  App.views = App.views || {};
  const CAT = window.CATALOG;
  const C = () => window.CONTENT;

  const state = {}; // per-class filter and sort
  const st = (cls) => (state[cls] = state[cls] || { g: 'All', sort: 'mc' });

  function usdCap(a) {
    const q = App.D.quote(a.id);
    if (!q || !U.isNum(q.mc)) return -1;
    const v = App.D.toUSD(q.mc, App.D.cur(a, q));
    return U.isNum(v) ? v : q.mc;
  }
  function sortAssets(list, mode) {
    const D = App.D;
    const val = (a, f) => { const q = D.quote(a.id); return q && U.isNum(q[f]) ? q[f] : -Infinity; };
    const arr = list.slice();
    if (mode === 'mc') arr.sort((a, b) => usdCap(b) - usdCap(a));
    else if (mode === 'gain') arr.sort((a, b) => val(b, 'chp') - val(a, 'chp'));
    else if (mode === 'lose') arr.sort((a, b) => { const x = val(a, 'chp'); const y = val(b, 'chp'); return (x === -Infinity ? Infinity : x) - (y === -Infinity ? Infinity : y); });
    else if (mode === 'name') arr.sort((a, b) => a.n.localeCompare(b.n));
    return arr;
  }
  const sortSeg = (cls, mode) => UI.seg('sort:' + cls, [['mc', 'Value'], ['gain', 'Gainers'], ['lose', 'Losers'], ['name', 'A–Z']], mode, 'plain');

  // ------------------------------------------------------------- guide card
  function guide(key) {
    const g = C().guides[key];
    if (!g) return '';
    const list = (arr) => `<ul>${arr.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>`;
    return UI.section('How it works', `
      <div class="tile">
        <p class="about" style="margin:0 0 10px">${esc(g.intro)}</p>
        ${UI.kv([['Risk', UI.risk(g.risk)], ['Liquidity', esc(g.liq)], ['Minimum', esc(g.min)]])}
        <p class="about" style="margin:12px 0 0">${esc(g.ret)}</p>
        <details class="mt"><summary class="more-link">How to invest, costs and taxes</summary>
          <div class="article">
            <h3>How to invest</h3>${list(g.how)}
            <div class="pc-grid"><div><h4>Pros</h4>${list(g.pros)}</div><div><h4>Cons</h4>${list(g.cons)}</div></div>
            <h3>Costs</h3><p>${esc(g.costs)}</p>
            <h3>Taxes (US)</h3><p>${esc(g.tax)}</p>
          </div>
        </details>
        ${g.srcNote ? UI.src(g.srcNote) : ''}
      </div>`);
  }

  function rowsHTML(ids, o) { return ids.length ? `<div class="list">${ids.map((id, i) => UI.row(id, Object.assign({}, o, o && o.rankFrom ? { rank: i + 1 } : {}))).join('')}</div>` : '<div class="empty small"><p>Nothing here yet.</p></div>'; }

  // ------------------------------------------------------------- Explore tab
  App.views.explore = {
    title: 'Explore',
    render(el) {
      const D = App.D;
      const spx = D.quote('^GSPC');
      const g = D.cg.global;
      const hint = { stock: spx && `<span class="${U.dir(spx.chp)}">S&P ${U.pct(spx.chp)}</span>`, crypto: g && `<span class="${U.dir(g.chp)}">${U.pct(g.chp)}</span>` };
      const ipos = C().priv.ipos2026.map((x) => x.s);
      const trending = (D.cg.trending || []).slice(0, 8);
      el.innerHTML = `
        ${UI.header('Explore', { sub: 'Everything you can invest in, in one place' })}
        <button class="search-box full" data-act="search" style="width:100%;border:0;text-align:left">${U.icon('search')}<span class="muted">Search stocks, ETFs, crypto, NFTs, gold…</span></button>
        ${UI.section('', `<div class="tiles t4">${CAT.classes.map((c) => `<a class="tile class-tile" href="#/explore/${c.id}">${U.icon(c.icon)}${hint[c.id] ? `<span class="ct-v">${hint[c.id]}</span>` : ''}<h3>${esc(c.n)}</h3><p>${esc(c.sub)}</p></a>`).join('')}</div>`)}
        <div class="cols">
          ${UI.section('2026 IPOs', rowsHTML(ipos, {}), { more: '#/explore/private' })}
          ${UI.section('Popular ETFs', rowsHTML(['VOO', 'QQQ', 'VTI', 'SCHD', 'IBIT', 'GLD', 'BND'], {}), { more: '#/explore/etf' })}
        </div>
        ${trending.length ? UI.section('Trending on CoinGecko', `<div class="chips">${trending.map((t) => `<a class="chip" href="#/a/c:${esc(t.id)}">${esc(t.s)} <span class="${U.dir(t.chp)}">${U.isNum(t.chp) ? U.pct(t.chp, 1) : ''}</span></a>`).join('')}</div>`) : ''}
        ${UI.section('Largest Companies', rowsHTML(sortAssets(CAT.assets.filter((a) => a.c === 'stock'), 'mc').slice(0, 10).map((a) => a.id), { logo: true }), { more: '#/explore/stock' })}
      `;
      el.querySelector('[data-act="search"]').addEventListener('click', () => UI.search());
    }
  };

  // ------------------------------------------------------------- generic list class pages
  const GROUPS = {
    stock: () => ['All', 'Technology', 'Communication', 'Consumer', 'Financials', 'Healthcare', 'Industrials', 'Energy', 'Utilities', 'Materials', 'Real Estate', 'International', 'IPOs'],
    etf: () => ['All'].concat([...new Set(CAT.assets.filter((a) => a.c === 'etf').map((a) => a.g))]),
    index: () => ['All', 'US', 'Europe', 'Asia', 'Americas'],
    commodity: () => ['All', 'Precious metals', 'Energy', 'Industrial metals', 'Agriculture', 'Livestock'],
    fx: () => ['All', 'Majors', 'Crosses', 'Emerging & Asia', 'Index'],
    crypto: () => ['Top 100'].concat([...new Set(CAT.assets.filter((a) => a.c === 'crypto').map((a) => a.g))])
  };
  function filterGroup(cls, g) {
    const all = App.D.byClass(cls);
    if (g === 'All' || g === 'Top 100') return all;
    if (cls === 'stock') {
      if (g === 'International') return all.filter((a) => a.t && a.t.includes('intl'));
      if (g === 'IPOs') return all.filter((a) => a.t && a.t.includes('ipo'));
      return all.filter((a) => a.g === g);
    }
    if (cls === 'index') {
      const map = { US: 'us', Europe: 'europe', Asia: 'asia', Americas: 'americas' };
      return all.filter((a) => a.t && a.t.includes(map[g]));
    }
    return all.filter((a) => a.g === g);
  }

  function listPage(el, cls, extraTop = '', extraBottom = '') {
    const s = st(cls);
    const groups = GROUPS[cls]();
    if (!groups.includes(s.g)) s.g = groups[0];
    const meta = CAT.classes.find((c) => c.id === cls);
    const draw = () => {
      let list = filterGroup(cls, s.g);
      if (cls === 'crypto') {
        const rank = (a) => { const q = App.D.quote(a.id); return q && q.r ? q.r : 9999; };
        list = s.sort === 'mc' ? list.slice().sort((a, b) => rank(a) - rank(b)) : sortAssets(list, s.sort);
        if (s.g === 'Top 100') list = list.filter((a) => { const q = App.D.quote(a.id); return q && q.r; });
      } else {
        list = sortAssets(list, s.sort);
      }
      const logo = cls === 'crypto' || cls === 'stock';
      el.querySelector('[data-part="list"]').innerHTML = rowsHTML(list.map((a) => a.id), { logo, rank: undefined, rankFrom: cls === 'crypto' && s.sort === 'mc' });
    };
    el.innerHTML = `
      ${UI.header(meta.n, { back: true, backLabel: 'Explore', sub: esc(meta.sub) })}
      ${extraTop}
      ${UI.chips('group', groups.map((g) => [g, g]), s.g)}
      <div class="split mt">${sortSeg(cls, s.sort)}</div>
      <div data-part="list" class="mt"></div>
      ${extraBottom}
      ${guide(cls)}
      <p class="footer-note">Prices from Yahoo Finance and CoinGecko via the app's data pipeline, with live crypto from CoinGecko and Coinbase. Delayed data is labeled on each asset page.</p>`;
    draw();
    el.addEventListener('click', (e) => {
      const b = e.target.closest('[data-seg] [data-v]');
      if (!b) return;
      const name = b.closest('[data-seg]').dataset.seg;
      b.parentNode.querySelectorAll('[data-v]').forEach((x) => x.classList.toggle('on', x === b));
      if (name === 'group') s.g = b.dataset.v;
      if (name.startsWith('sort:')) s.sort = b.dataset.v;
      draw();
    });
    return draw;
  }

  // ------------------------------------------------------------- specific pages
  function cryptoTop() {
    const D = App.D;
    const g = D.cg.global;
    const f = D.fng().crypto;
    const tiles = [
      g && UI.stat('Market cap', U.compact(g.mc, 'USD'), `<span class="${U.dir(g.chp)}">${U.pct(g.chp)}</span> in 24h`),
      g && UI.stat('24h volume', U.compact(g.v, 'USD')),
      g && UI.stat('BTC dominance', U.pctPlain(g.btcd, 1), 'ETH ' + U.pctPlain(g.ethd, 1)),
      f && UI.stat('Fear & greed', String(f.v), esc(f.c))
    ].filter(Boolean).join('');
    return (tiles ? `<div class="tiles t4">${tiles}</div>` : '') + `<div class="note">${U.icon('info')}<span>Bitcoin's record is about $126,000 (October 6, 2025). The crypto page updates live from CoinGecko, with tick-by-tick prices from Coinbase for major coins.</span></div>`;
  }

  function fxConverter() {
    const curs = ['USD', 'EUR', 'GBP', 'JPY', 'CHF', 'CAD', 'AUD', 'CNY', 'HKD', 'SGD', 'INR', 'KRW', 'MXN', 'BRL', 'ZAR', 'SEK', 'NOK', 'TRY', 'NZD'];
    const opt = (sel) => curs.map((c) => `<option ${c === sel ? 'selected' : ''}>${c}</option>`).join('');
    return `<div class="tile" id="fxconv"><div class="field-row"><label class="field"><span>Amount</span><input type="number" inputmode="decimal" value="1000" data-k="amt"></label><label class="field"><span>&nbsp;</span><button class="btn secondary" data-k="swap" type="button">${U.icon('swap')} Swap</button></label></div>
      <div class="field-row mt"><label class="field"><span>From</span><select data-k="from">${opt('USD')}</select></label><label class="field"><span>To</span><select data-k="to">${opt('EUR')}</select></label></div>
      <div class="hero-p mt" data-k="out" style="font-size:32px">—</div><div class="src" data-k="src"></div></div>`;
  }
  function wireFx(el) {
    const box = el.querySelector('#fxconv');
    if (!box) return;
    const g = (k) => box.querySelector(`[data-k="${k}"]`);
    const calc = () => {
      const amt = parseFloat(g('amt').value);
      const out = App.D.convert(amt, g('from').value, g('to').value);
      g('out').textContent = U.isNum(out) ? U.money(out, g('to').value, out >= 100 ? 2 : 4) : 'Rate unavailable';
      const rate = App.D.convert(1, g('from').value, g('to').value);
      g('src').textContent = U.isNum(rate) ? `1 ${g('from').value} = ${U.fmtN(rate, 4, 6)} ${g('to').value} · ${App.D.fxSrc}` : '';
    };
    box.addEventListener('input', calc);
    box.addEventListener('change', calc);
    g('swap').addEventListener('click', () => { const a = g('from').value; g('from').value = g('to').value; g('to').value = a; calc(); });
    calc();
  }

  function nftPage(el) {
    const D = App.D;
    const n = D.M && D.M.nft && D.M.nft.c ? D.M.nft.c : {};
    const catIds = CAT.assets.filter((a) => a.c === 'nft').map((a) => a.id);
    const ids = [...new Set(catIds.concat(Object.keys(n).filter((k) => k.startsWith('n:'))))];
    ids.sort((a, b) => ((n[b] && n[b].mc) || 0) - ((n[a] && n[a].mc) || 0));
    const g = C().guides.nft;
    el.innerHTML = `
      ${UI.header('NFTs', { back: true, backLabel: 'Explore', sub: 'Collections ranked by market value (floor price × supply)' })}
      <div class="note">${U.icon('info')}<span>${esc(g.ret)}</span></div>
      ${UI.src(g.srcNote)}
      ${UI.section('Collections', `<div class="list">${ids.map((id, i) => UI.row(id, { logo: true, rank: i + 1, sub: (() => { const x = n[id]; return x ? `${U.compact(x.mc, 'USD')} · ${x.holders ? U.int(x.holders) + ' owners' : (x.chain || '')}` : 'Floor price loads on the collection page'; })() , spark: false })).join('')}</div>`, { sub: D.M && D.M.nft ? 'Floor prices from CoinGecko · ' + U.dateTimeET(Date.parse(D.M.nft.t)) : 'Floor prices load from CoinGecko' })}
      ${guide('nft')}`;
  }

  function ratesPage(el) {
    const bonds = CAT.assets.filter((a) => a.c === 'etf' && a.g === 'Bonds').map((a) => a.id);
    el.innerHTML = `
      ${UI.header('Bonds & Rates', { back: true, backLabel: 'Explore', sub: 'US Treasury yields, the yield curve and bond funds' })}
      ${UI.section('Treasury Yields', rowsHTML(['^IRX', '^FVX', '^TNX', '^TYX'], {}), { sub: 'Yields in percent. Bond prices move opposite to yields.' })}
      ${UI.section('Yield Curve', '<div id="curve" class="chart-wrap" style="min-height:240px"></div><div class="src" id="curve-src"></div>')}
      ${UI.section('Key Rates', '<div class="tiles" id="keyrates"></div>')}
      ${UI.section('Bond Funds', rowsHTML(bonds, {}))}
      ${guide('rate')}`;
    App.views.drawCurve(el.querySelector('#curve'), el.querySelector('#curve-src'));
    const kr = el.querySelector('#keyrates');
    const M = C().macro;
    const pick = ['Fed funds target', '10-year Treasury', '30-year mortgage', 'CPI inflation'];
    const draw = () => {
      kr.innerHTML = M.filter((m) => pick.includes(m.k)).map((m) => {
        const live = App.D.macro && m.fred ? App.views.econValue(m.fred) : null;
        return UI.stat(m.k, live ? live.v : esc(m.v), live ? live.d : esc(m.d));
      }).join('');
    };
    draw();
    App.D.loadMacro().then(() => { draw(); App.views.drawCurve(el.querySelector('#curve'), el.querySelector('#curve-src')); });
  }

  function reitPage(el) {
    const R = C().realestate;
    const reits = CAT.assets.filter((a) => a.t && a.t.includes('reit') && a.c === 'stock' && !a.t.includes('farm') && !a.t.includes('timber')).map((a) => a.id);
    const funds = CAT.assets.filter((a) => a.c === 'etf' && a.t && a.t.includes('reit')).map((a) => a.id);
    const housing = CAT.assets.filter((a) => a.t && a.t.includes('housing')).map((a) => a.id);
    const land = CAT.assets.filter((a) => a.t && (a.t.includes('farm') || a.t.includes('timber')) && a.c === 'stock').map((a) => a.id);
    el.innerHTML = `
      ${UI.header('Real Estate', { back: true, backLabel: 'Explore', sub: 'Housing market, REITs, homebuilders, farmland and timber' })}
      <p class="about">${esc(R.intro)}</p>
      ${UI.section('US Housing Market', `<div class="tiles t4">${R.stats.map((s) => UI.stat(s.k, esc(s.v), esc(s.d))).join('')}</div>${UI.src(R.stats.map((s) => s.src).filter((v, i, a) => a.indexOf(v) === i))}`)}
      <div class="cols">
        ${UI.section('REITs', rowsHTML(sortAssets(reits.map((id) => App.D.asset(id)), 'mc').map((a) => a.id), { logo: true }))}
        <div>${UI.section('REIT Funds', rowsHTML(funds, {}))}${UI.section('Homebuilders & Property Tech', rowsHTML(housing, { logo: true }))}${UI.section('Farmland & Timber', rowsHTML(land, { logo: true }))}</div>
      </div>
      ${UI.section('Ways to Invest', `<div class="list">${R.ways.map(([k, v]) => `<div class="row"><span class="r-main"><span class="r-sym" style="font-size:16px">${esc(k)}</span><span class="r-name" style="white-space:normal">${esc(v)}</span></span></div>`).join('')}</div>`)}
      ${UI.section('Numbers Investors Use', UI.kv(R.metrics.map(([k, v]) => [k, `<span style="font-weight:400;color:var(--label2)">${esc(v)}</span>`])))}
      <a class="btn secondary full mt" href="#/more/tools/mortgage">${U.icon('calc')} Mortgage calculator</a>`;
  }

  function artPage(el) {
    const A = C().art;
    const max = A.records[0][2];
    el.innerHTML = `
      ${UI.header('Art', { back: true, backLabel: 'Explore', sub: 'The market, the records and how people invest in it' })}
      <p class="about">${esc(A.intro)} ${UI.risk(A.risk)}</p>
      ${UI.section('Market Size', `<div class="tiles t4">${A.stats.map((s) => UI.stat(s.k, esc(s.v), esc(s.d))).join('')}</div>${UI.src([...new Set(A.stats.map((s) => s.src))])}`)}
      ${UI.section('Latest', A.recent.map((r) => `<article class="bitem mt"><h3>${esc(r.h)}</h3><p>${esc(r.t)}</p>${UI.src(r.src)}</article>`).join(''))}
      ${UI.section('Most Expensive Artworks Sold at Auction', `<div class="dbars recs">${A.records.map(([t, who, p, house, when], i) => `<div class="rec"><div class="rec-h"><span class="rec-i">${i + 1}</span><span class="rec-t"><b>${esc(t)}</b><span>${esc(who)} · ${esc(house)} · ${esc(when)}</span></span><span class="rec-p">$${U.fmtN(p, 1, 1)}M</span></div><div class="rec-bar"><i style="width:${((p / max) * 100).toFixed(1)}%"></i></div></div>`).join('')}</div><div class="src">${esc(A.recordsNote)} Sources: ${UI.src([window.CONTENT.S.klimt, window.CONTENT.S.may26, window.CONTENT.S.robb], 'Recent').replace(/^<div class="src">|<\/div>$/g, '')}</div>`)}
      ${UI.section('How to Invest in Art', `<div class="list">${A.ways.map(([k, v]) => `<div class="row"><span class="r-main"><span class="r-sym" style="font-size:16px">${esc(k)}</span><span class="r-name" style="white-space:normal">${esc(v)}</span></span></div>`).join('')}</div>`)}
      ${UI.section('Costs, Taxes & Risks', `<div class="article"><p>${esc(A.costs)}</p><p>${esc(A.tax)}</p><ul>${A.risks.map((r) => `<li>${esc(r)}</li>`).join('')}</ul></div>`)}
      ${UI.section('Related Public Companies', rowsHTML(['MC.PA', 'RMS.PA', 'CFR.SW'], { logo: true }), { sub: 'Luxury groups whose clients are also the top art and collectibles buyers.' })}
      <p class="footer-note">Art has no ticker or live price. Values above are auction results and industry estimates from the linked reports.</p>`;
  }

  function collectPage(el) {
    const K = C().collectibles;
    el.innerHTML = `
      ${UI.header('Collectibles', { back: true, backLabel: 'Explore', sub: 'Watches, wine, cars, cards, comics, coins and more' })}
      <p class="about">${esc(K.intro)} ${UI.risk(K.risk)}</p>
      ${UI.section('', `<div class="tiles">${UI.stat(K.index.k, esc(K.index.v), esc(K.index.d))}</div>${UI.src(K.index.src)}`)}
      ${UI.section('Categories', `<div class="brief">${K.cats.map((c) => `<article class="bitem"><div class="split"><h3>${U.icon(c.icon)} ${esc(c.n)}</h3></div><p>${esc(c.t)}</p><details class="mt"><summary class="more-link">How to buy</summary><p class="about" style="margin-top:6px">${esc(c.how)}</p></details>${c.stocks ? `<div class="list mt">${c.stocks.map((id) => UI.row(id, { logo: true })).join('')}</div>` : ''}${c.src ? UI.src(c.src) : ''}</article>`).join('')}</div>`)}
      ${UI.section('Costs & Taxes', `<div class="article"><p>${esc(K.costs)}</p><p>${esc(K.tax)}</p></div>`)}`;
  }

  function privatePage(el) {
    const P = C().priv;
    const vals = P.companies.filter((c) => c.v);
    const max = Math.max(...vals.map((c) => c.v));
    el.innerHTML = `
      ${UI.header('Private Markets', { back: true, backLabel: 'Explore', sub: 'The biggest private companies and the 2026 IPO class' })}
      <p class="about">${esc(P.intro)}</p>
      ${UI.section('2026 IPOs', `<div class="list">${P.ipos2026.map((x) => {
        const q = App.D.quote(x.s);
        const ipoPrice = { SPCX: 135, CBRS: 185, FRVO: 27 }[x.s];
        const since = q && U.isNum(q.p) && ipoPrice ? ((q.p - ipoPrice) / ipoPrice) * 100 : null;
        return `<a class="row arow" href="#/a/${x.s}"><span class="r-main"><span class="r-sym">${esc(x.n)} <em class="tag">${esc(x.s)}</em></span><span class="r-name" style="white-space:normal">${esc(x.d)} · ${esc(x.t)}</span></span><span class="r-right"><span class="r-price" data-q="${x.s}" data-f="p">${q ? UI.priceText(x.s, q) : '—'}</span><span class="r-chg ${U.dir(since)}">${U.isNum(since) ? U.pct(since) + ' vs IPO' : ''}</span></span></a>`;
      }).join('')}</div>${UI.src(P.ipos2026.map((x) => x.src))}`)}
      ${UI.section('Most Valuable Private Companies', `<div class="recs">${P.companies.map((c) => `<div class="rec"><div class="rec-h"><span class="rec-t"><b>${esc(c.n)}</b><span>${esc(c.t)}</span></span><span class="rec-p">${c.v ? U.compact(c.v, 'USD') : 'n/a'}<small>${esc(c.d)}</small></span></div>${c.v ? `<div class="rec-bar"><i style="width:${((c.v / max) * 100).toFixed(1)}%"></i></div>` : ''}${UI.src(c.src)}</div>`).join('')}</div>`, { sub: 'Last reported post-money valuation or secondary-sale price' })}
      ${UI.section('IPO Pipeline', `<p class="about">${esc(P.pipeline)}</p>`)}
      ${UI.section('How to Get Exposure', `<div class="list">${P.ways.map(([k, v]) => `<div class="row"><span class="r-main"><span class="r-sym" style="font-size:16px">${esc(k)}</span><span class="r-name" style="white-space:normal">${esc(v)}</span></span></div>`).join('')}</div>`)}
      ${UI.section('Risks', `<div class="article"><ul>${P.risks.map((r) => `<li>${esc(r)}</li>`).join('')}</ul></div>`)}
      ${UI.section('Listed Backers', rowsHTML(['9984.T', 'AMZN', 'GOOGL', 'MSFT'], { logo: true }), { sub: 'Public companies with large stakes in leading private AI labs' })}`;
  }

  function cashPage(el) {
    const K = C().cash;
    const irx = App.D.quote('^IRX');
    el.innerHTML = `
      ${UI.header('Cash & Savings', { back: true, backLabel: 'Explore', sub: 'Where to keep money safe and still earn interest' })}
      <p class="about">${esc(K.intro)}</p>
      ${UI.section('Options', `<div class="list">${K.options.map((o) => `<div class="row"><span class="r-main"><span class="r-sym" style="font-size:16px">${esc(o.n)}</span><span class="r-name" style="white-space:normal">${esc(o.d)}</span>${o.src ? UI.src(o.src) : ''}</span><span class="r-right"><span class="r-price">${o.live && irx ? U.pctPlain(irx.p) : esc(o.v)}</span>${o.live && irx ? '<span class="r-chg flat">13-week yield</span>' : ''}</span></div>`).join('')}</div>`)}
      ${UI.section('Cash-Like Funds', rowsHTML(['SGOV', 'BIL', 'SHY'], {}))}
      ${UI.section(K.retirement.h, `<div class="tile">${UI.kv(K.retirement.rows.map(([k, v]) => [k, v]))}${UI.src(K.retirement.src)}</div>`)}
      ${UI.section('Rules of Thumb', `<div class="article"><ul>${K.rules.map((r) => `<li>${esc(r)}</li>`).join('')}</ul></div>`)}
      <div class="btn-row"><a class="btn secondary" href="#/more/tools/savings">${U.icon('calc')} Savings goal</a><a class="btn secondary" href="#/more/tools/compound">${U.icon('calc')} Compound interest</a></div>`;
  }

  function altPage(el) {
    const A = C().alt;
    el.innerHTML = `
      ${UI.header('Alternatives', { back: true, backLabel: 'Explore', sub: 'Beyond stocks, bonds and cash' })}
      <p class="about">${esc(A.intro)}</p>
      <div class="brief mt">${A.items.map((it) => `<article class="bitem"><h3>${esc(it.n)}</h3><p>${esc(it.t)}</p>${it.stocks ? `<div class="list mt">${it.stocks.map((id) => UI.row(id)).join('')}</div>` : ''}</article>`).join('')}</div>`;
  }

  // ------------------------------------------------------------- router entry
  App.views.cls = {
    render(el, cls) {
      this.cls = cls;
      const meta = CAT.classes.find((c) => c.id === cls);
      this.title = meta ? meta.n : 'Explore';
      this.redraw = null;
      if (cls === 'crypto') this.redraw = listPage(el, 'crypto', cryptoTop());
      else if (cls === 'fx') { this.redraw = listPage(el, 'fx', UI.section('Converter', fxConverter())); wireFx(el); }
      else if (cls === 'nft') nftPage(el);
      else if (cls === 'rate') ratesPage(el);
      else if (cls === 'realestate') reitPage(el);
      else if (cls === 'art') artPage(el);
      else if (cls === 'collectible') collectPage(el);
      else if (cls === 'private') privatePage(el);
      else if (cls === 'cash') cashPage(el);
      else if (cls === 'alt') altPage(el);
      else if (GROUPS[cls]) this.redraw = listPage(el, cls, cls === 'commodity' ? '<div class="note">' + U.icon('info') + '<span>Prices are front-month futures contracts, the benchmark most news reports quote. ETFs that hold these commodities are listed under ETFs &amp; Funds → Commodities.</span></div>' : '');
      else el.innerHTML = UI.header('Not found', { back: true }) + UI.empty('explore', 'Unknown category');
    },
    refresh(el) {
      if (this.redraw) this.redraw();
      else if (['nft', 'private', 'cash'].includes(this.cls)) this.render(el, this.cls);
    }
  };
})();
