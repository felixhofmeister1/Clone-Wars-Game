/* More tab: tools, learning, economy, calendar, alerts, settings, data sources. */
(function () {
  'use strict';
  const App = (window.App = window.App || {});
  const U = App.U;
  const UI = App.UI;
  const esc = U.esc;
  App.views = App.views || {};
  const C = () => window.CONTENT;

  // ------------------------------------------------------------- economy helpers
  const ECON = [
    { id: 'DFEDTARU', k: 'Fed funds target', unit: '%', desc: 'Upper bound of the Federal Reserve\'s target range for the overnight federal funds rate.', fmt: 'range' },
    { id: 'CPIAUCSL', k: 'CPI inflation', unit: '%', desc: 'Consumer Price Index for all urban consumers, change from a year earlier.', yoy: true },
    { id: 'CPILFESL', k: 'Core CPI', unit: '%', desc: 'CPI excluding food and energy, change from a year earlier.', yoy: true },
    { id: 'PCEPILFE', k: 'Core PCE inflation', unit: '%', desc: 'The Fed\'s preferred inflation gauge (personal consumption expenditures excluding food and energy), change from a year earlier.', yoy: true },
    { id: 'UNRATE', k: 'Unemployment rate', unit: '%', desc: 'Share of the labor force that is jobless and looking for work.' },
    { id: 'PAYEMS', k: 'Jobs added', unit: 'K', desc: 'Monthly change in nonfarm payroll employment, in thousands.', diff: true },
    { id: 'A191RL1Q225SBEA', k: 'Real GDP growth', unit: '%', desc: 'Quarterly growth of inflation-adjusted GDP, at an annual rate.' },
    { id: 'DGS10', k: '10-year Treasury', unit: '%', desc: 'Market yield on 10-year US Treasury notes.' },
    { id: 'DGS2', k: '2-year Treasury', unit: '%', desc: 'Market yield on 2-year US Treasury notes, which tracks expectations for Fed policy.' },
    { id: 'T10Y2Y', k: '10Y minus 2Y spread', unit: 'pts', desc: 'Difference between 10-year and 2-year yields. Below zero ("inverted") has preceded most US recessions.' },
    { id: 'MORTGAGE30US', k: '30-year mortgage', unit: '%', desc: 'Freddie Mac\'s weekly average rate on a 30-year fixed mortgage.' },
    { id: 'CSUSHPINSA', k: 'Home prices', unit: '%', desc: 'S&P CoreLogic Case-Shiller US National Home Price Index, change from a year earlier.', yoy: true },
    { id: 'UMCSENT', k: 'Consumer sentiment', unit: '', desc: 'University of Michigan index of consumer sentiment (1966 = 100).' },
    { id: 'RSAFS', k: 'Retail sales', unit: '%', desc: 'Advance retail and food-service sales, change from a year earlier.', yoy: true },
    { id: 'ICSA', k: 'Jobless claims', unit: 'K', desc: 'Initial weekly claims for unemployment insurance, in thousands.', scale: 0.001 },
    { id: 'GASREGW', k: 'Gasoline price', unit: '$', desc: 'US regular gasoline, average retail price per gallon.' },
    { id: 'BAMLH0A0HYM2', k: 'High-yield spread', unit: 'pts', desc: 'Extra yield on junk bonds over Treasuries (ICE BofA index). Rises when investors fear defaults.' },
    { id: 'M2SL', k: 'Money supply (M2)', unit: '%', desc: 'M2 money stock, change from a year earlier.', yoy: true },
    { id: 'VIXCLS', k: 'VIX', unit: '', desc: 'Cboe Volatility Index close.' }
  ];

  function econSeries(def) {
    const M = App.D.macro;
    const raw = M && M.fred && M.fred[def.id];
    if (!raw || !raw.length) return null;
    let pts = raw.map(([d, v]) => [Date.parse(d + 'T12:00:00Z'), v]);
    if (def.yoy) {
      const byMonth = new Map(pts.map(([t, v]) => [new Date(t).toISOString().slice(0, 7), v]));
      pts = pts.map(([t, v]) => {
        const d = new Date(t);
        d.setUTCFullYear(d.getUTCFullYear() - 1);
        const prev = byMonth.get(d.toISOString().slice(0, 7));
        return [t, prev ? ((v - prev) / prev) * 100 : null];
      }).filter((p) => U.isNum(p[1]));
    }
    if (def.diff) pts = pts.slice(1).map(([t, v], i) => [t, v - pts[i][1]]);
    if (def.scale) pts = pts.map(([t, v]) => [t, v * def.scale]);
    return pts;
  }
  function fmtEcon(def, v) {
    if (!U.isNum(v)) return '—';
    if (def.unit === '%') return U.fmtN(v, 2) + '%';
    if (def.unit === 'K') return (v > 0 && def.diff ? '+' : '') + U.fmtN(v, 0) + 'K';
    if (def.unit === '$') return '$' + U.fmtN(v, 2);
    if (def.unit === 'pts') return U.fmtN(v, 2);
    return U.fmtN(v, 1);
  }
  const monthly = (def) => ['CPIAUCSL', 'CPILFESL', 'PCEPILFE', 'UNRATE', 'PAYEMS', 'CSUSHPINSA', 'UMCSENT', 'RSAFS', 'M2SL'].includes(def.id);
  App.views.econValue = (id) => {
    const def = ECON.find((d) => d.id === id);
    if (!def) return null;
    const pts = econSeries(def);
    if (!pts || !pts.length) return null;
    const [t, v] = pts[pts.length - 1];
    let val = fmtEcon(def, v);
    if (def.fmt === 'range') {
      const lo = econSeries({ id: 'DFEDTARL' });
      if (lo && lo.length) val = `${U.fmtN(lo[lo.length - 1][1], 2)}%–${U.fmtN(v, 2)}%`;
    }
    const d = monthly(def) ? U.fmtDate(t, { month: 'short', year: 'numeric' }) : def.id === 'A191RL1Q225SBEA' ? 'Q' + (Math.floor(new Date(t).getUTCMonth() / 3) + 1) + ' ' + new Date(t).getUTCFullYear() : U.dateLong(t);
    return { v: val, d: d + ' · official data', t, raw: v };
  };

  App.views.drawCurve = (host, srcEl) => {
    const M = App.D.macro;
    const c = M && M.curve;
    if (!host) return;
    if (!c || !c.latest) { host.innerHTML = '<div class="chart-empty">The yield curve loads with the economic data file.</div>'; return; }
    const xs = c.tenors.map((t, i) => [i, t.replace(' Month', 'M').replace(' Mo', 'M').replace(' Yr', 'Y')]);
    const mk = (row, name, i, dash) => row && { name: `${name} (${U.fmtDate(Date.parse(row.date + 'T12:00:00Z'), { month: 'short', day: 'numeric', year: 'numeric' })})`, color: App.Chart.series(i), dash, pts: row.v.map((v, k) => [k, v]).filter((p) => U.isNum(p[1])) };
    const series = [mk(c.latest, 'Latest', 0), mk(c.m1, '1 month ago', 1), mk(c.y1, '1 year ago', 2)].filter(Boolean);
    App.Chart.multi(host, series, { xLabels: xs, fmtY: (v) => U.fmtN(v, 2) + '%', dots: true, height: 230, label: 'US Treasury yield curve', fmtX: (x) => c.tenors[x] });
    if (srcEl) srcEl.innerHTML = `Daily par yield curve rates, U.S. Department of the Treasury. Latest: ${esc(c.latest.date)}.`;
  };

  // ------------------------------------------------------------- More menu
  App.views.more = {
    title: 'More',
    render(el) {
      const standalone = window.matchMedia && window.matchMedia('(display-mode: standalone)').matches;
      const item = (href, icon, t, s, v) => `<a class="gitem" href="${href}"><span class="gi-icon">${U.icon(icon)}</span><span class="gi-main"><span class="gi-t">${esc(t)}</span>${s ? `<span class="gi-s">${esc(s)}</span>` : ''}</span>${v ? `<span class="gi-v">${v}</span>` : ''}${U.icon('chevR', 'chev')}</a>`;
      const alerts = App.S.state.alerts.filter((a) => !a.fired).length;
      el.innerHTML = `
        ${UI.header('More')}
        ${!standalone ? `<div class="note">${U.icon('download')}<span><b>Install as an app:</b> on iPhone open this page in Safari, tap Share, then “Add to Home Screen”. On desktop Chrome or Edge use the install icon in the address bar.</span></div>` : ''}
        <div class="list-h">Tools</div>
        <div class="group">
          ${item('#/more/tools', 'calc', 'Calculators', 'Compound interest, DCA backtest, retirement, mortgage and more')}
          ${item('#/more/economy', 'gauge', 'Economy', 'Inflation, jobs, rates, yield curve')}
          ${item('#/more/calendar', 'cal', 'Calendar', 'Fed meetings and economic releases')}
          ${item('#/brief', 'news', 'Top stories', 'What is moving markets, with sources')}
        </div>
        <div class="list-h">Learn</div>
        <div class="group">
          ${item('#/more/learn', 'book', 'Guides', 'Investing basics, orders, bonds, crypto safety, taxes')}
          ${item('#/more/glossary', 'list', 'Glossary', C().glossary.length + ' terms explained')}
        </div>
        <div class="list-h">You</div>
        <div class="group">
          ${item('#/more/alerts', 'bell', 'Price alerts', 'Get notified when a price crosses a level', alerts ? String(alerts) : '')}
          ${item('#/watchlist', 'star', 'Watchlists', App.S.state.watchlists.length + ' list' + (App.S.state.watchlists.length > 1 ? 's' : ''))}
          ${item('#/portfolio', 'portfolio', 'Portfolio & paper trading')}
        </div>
        <div class="list-h">App</div>
        <div class="group">
          ${item('#/more/settings', 'gear', 'Settings', 'Appearance, currency, live data, API keys')}
          ${item('#/more/data', 'info', 'Data sources & status', 'Where every number comes from')}
          ${item('#/more/about', 'sparkle', 'About Invest')}
        </div>
        <p class="footer-note">Invest is an information tool, not a broker or financial adviser. Nothing here is a recommendation to buy or sell anything.</p>`;
    }
  };

  // ------------------------------------------------------------- economy dashboard
  App.views.economy = {
    title: 'Economy',
    render(el) {
      this.el = el;
      el.innerHTML = `${UI.header('Economy', { back: true, backLabel: 'More', sub: 'Official US data from FRED, BLS, the Treasury, the New York Fed and Freddie Mac' })}
        <div data-part="tiles"><div class="skel" style="height:300px"></div></div>
        ${UI.section('Yield Curve', '<div id="curve" class="chart-wrap" style="min-height:230px"></div><div class="src" id="curve-src"></div>')}
        ${UI.section('Latest Researched Readings', `<div class="tiles">${C().macro.map((m) => UI.stat(m.k, esc(m.v), esc(m.d))).join('')}</div>${UI.src([...new Set(C().macro.map((m) => m.src))])}`, { sub: 'From official releases and news reports as of September 24, 2026' })}`;
      App.D.loadMacro().then(() => this.fill());
    },
    fill() {
      const el = this.el;
      if (!el) return;
      const M = App.D.macro;
      const box = el.querySelector('[data-part="tiles"]');
      if (!M || !M.fred) { box.innerHTML = '<div class="note">' + U.icon('info') + '<span>The economic data file has not been generated yet. The researched readings below are current as of September 24, 2026.</span></div>'; App.views.drawCurve(el.querySelector('#curve'), el.querySelector('#curve-src')); return; }
      box.innerHTML = `<div class="tiles t4">${ECON.map((def) => {
        const pts = econSeries(def);
        if (!pts || !pts.length) return '';
        const v = App.views.econValue(def.id);
        const tail = pts.slice(-36).map((p) => p[1]);
        return `<button class="tile econ" data-econ="${def.id}"><div class="stat-k">${esc(def.k)}</div><div class="stat-v">${v.v}</div><div class="stat-s">${esc(v.d.replace(' · official data', ''))}</div>${App.Chart.spark(tail, { w: 140, h: 30, dir: 'flat' })}</button>`;
      }).join('')}</div><div class="src">Updated ${esc(U.dateTimeET(Date.parse(M.updated)))}. Tap a tile for its history.</div>`;
      App.views.drawCurve(el.querySelector('#curve'), el.querySelector('#curve-src'));
      box.onclick = (e) => {
        const b = e.target.closest('[data-econ]');
        if (!b) return;
        const def = ECON.find((d) => d.id === b.dataset.econ);
        const pts = econSeries(def);
        const s = UI.sheet({ title: def.k, wide: false, body: `<p class="about">${esc(def.desc)}</p><div id="econ-chart" class="chart-wrap"></div><div class="src">Series ${esc(def.id)} · <a href="https://fred.stlouisfed.org/series/${esc(def.id)}" target="_blank" rel="noopener">View on FRED</a></div>` });
        App.Chart.price(s.body.querySelector('#econ-chart'), { pts, height: 240, color: App.Chart.series(0), label: def.k, fmtAxis: (v) => fmtEcon(def, v) });
      };
    },
    refresh() { this.fill(); }
  };

  // ------------------------------------------------------------- calendar
  App.views.calendar = {
    title: 'Calendar',
    render(el) {
      el.innerHTML = `${UI.header('Calendar', { back: true, backLabel: 'More' })}
        ${UI.section('Key Dates', `<div class="list">${C().calendar.map((c) => `<div class="row"><span class="r-main"><span class="r-sym" style="font-size:16px">${esc(c.h)}</span><span class="r-name" style="white-space:normal">${esc(c.t)}</span></span><span class="r-right"><span class="r-price">${U.fmtDate(Date.parse(c.d + 'T12:00:00Z'), { month: 'short', day: 'numeric' })}</span><span class="r-chg flat">${Date.parse(c.d + 'T23:59:59Z') < Date.now() ? 'Past' : U.fmtDate(Date.parse(c.d + 'T12:00:00Z'), { weekday: 'short' })}</span></span></div>`).join('')}</div>${UI.src([C().S.fedCal, C().S.ibond])}`)}
        ${UI.section('Economic Calendar', `<div id="tv-cal"><button class="tv-load" data-act="cal">${U.icon('cal')}<span><b>Load live economic calendar</b><span>Upcoming releases with forecasts and actuals, from TradingView</span></span></button></div>`)}
        ${UI.section('US Market Holidays', `<div class="kv">${[['Thanksgiving', 'Thu, Nov 26, 2026'], ['Day after Thanksgiving', 'Fri, Nov 27, 2026 · closes 1:00 PM ET'], ['Christmas Eve', 'Thu, Dec 24, 2026 · closes 1:00 PM ET'], ['Christmas', 'Fri, Dec 25, 2026'], ['New Year\'s Day', 'Fri, Jan 1, 2027'], ['Martin Luther King Jr. Day', 'Mon, Jan 18, 2027'], ['Washington\'s Birthday', 'Mon, Feb 15, 2027'], ['Good Friday', 'Fri, Mar 26, 2027']].map(([k, v]) => `<div class="kv-row"><span>${k}</span><b>${v}</b></div>`).join('')}</div><div class="src">NYSE and Nasdaq schedule.</div>`)}`;
      el.addEventListener('click', (e) => {
        if (e.target.closest('[data-act="cal"]')) { const h = el.querySelector('#tv-cal'); h.style.height = '620px'; App.TV.calendar(h); }
      });
    }
  };

  // ------------------------------------------------------------- learn & glossary
  App.views.learn = {
    title: 'Guides',
    render(el, id) {
      const L = C().learn;
      if (id) {
        const art = L.find((x) => x.id === id);
        if (!art) { el.innerHTML = UI.header('Not found', { back: true }); return; }
        this.title = art.h;
        el.innerHTML = `${UI.header(art.h, { back: true, backLabel: 'Guides', sub: esc(art.sub) })}<div class="article">${art.body.map(([h, p]) => `<h3>${esc(h)}</h3><p>${esc(p)}</p>`).join('')}</div><p class="footer-note">General education, not personal financial, legal or tax advice.</p>`;
        return;
      }
      this.title = 'Guides';
      el.innerHTML = `${UI.header('Guides', { back: true, backLabel: 'More' })}
        <div class="group">${L.map((x) => `<a class="gitem" href="#/more/learn/${x.id}"><span class="gi-icon">${U.icon('book')}</span><span class="gi-main"><span class="gi-t">${esc(x.h)}</span><span class="gi-s">${esc(x.sub)}</span></span>${U.icon('chevR', 'chev')}</a>`).join('')}</div>
        <div class="list-h">Asset class guides</div>
        <div class="group">${window.CATALOG.classes.map((c) => `<a class="gitem" href="#/explore/${c.id}"><span class="gi-icon">${U.icon(c.icon)}</span><span class="gi-main"><span class="gi-t">${esc(c.n)}</span><span class="gi-s">${esc(c.sub)}</span></span>${U.icon('chevR', 'chev')}</a>`).join('')}</div>`;
    }
  };

  App.views.glossary = {
    title: 'Glossary',
    render(el) {
      const G = C().glossary;
      el.innerHTML = `${UI.header('Glossary', { back: true, backLabel: 'More' })}
        <div class="search-box">${U.icon('search')}<input type="search" placeholder="Search ${G.length} terms" data-k="q"></div>
        <div data-part="list" class="mt"></div>`;
      const draw = (q) => {
        const f = q ? G.filter(([t, d]) => (t + ' ' + d).toLowerCase().includes(q.toLowerCase())) : G;
        let letter = '';
        el.querySelector('[data-part="list"]').innerHTML = f.map(([t, d]) => {
          const L = /[a-z]/i.test(t[0]) ? t[0].toUpperCase() : '#';
          const head = L !== letter ? `<div class="list-h">${(letter = L)}</div>` : '';
          return `${head}<div class="kv-row" style="display:block"><b style="display:block;text-align:left">${esc(t)}</b><span style="display:block;margin-top:2px">${esc(d)}</span></div>`;
        }).join('') || '<div class="empty small"><p>No matching terms.</p></div>';
      };
      draw('');
      el.querySelector('[data-k="q"]').addEventListener('input', (e) => draw(e.target.value));
    }
  };

  // ------------------------------------------------------------- alerts
  App.views.alerts = {
    title: 'Price Alerts',
    render(el) {
      this.el = el;
      const S = App.S;
      const perm = window.Notification ? Notification.permission : 'unsupported';
      el.innerHTML = `${UI.header('Price Alerts', { back: true, backLabel: 'More', actions: `<button class="icon-btn" data-act="add" aria-label="New alert">${U.icon('plus')}</button>` })}
        ${perm !== 'granted' && perm !== 'unsupported' ? `<div class="note">${U.icon('bell')}<span>Allow notifications to be alerted while the app is open in the background. <button class="more-link" data-act="perm">Allow</button></span></div>` : ''}
        <div class="note">${U.icon('info')}<span>Alerts are checked on this device whenever the app has fresh prices (live for crypto; each data refresh for stocks). They cannot wake the app when it is closed.</span></div>
        ${S.state.alerts.length ? `<div class="list">${S.state.alerts.slice().reverse().map((al) => {
          const a = App.D.asset(al.asset);
          const q = App.D.quote(al.asset);
          return `<div class="row"><span class="r-main"><span class="r-sym">${esc(a ? a.s : al.asset)} ${al.op} ${U.price(al.price, a && a.c, App.D.cur(a || {}, q))}</span><span class="r-name">${al.fired ? 'Triggered ' + U.ago(al.fired) : 'Now ' + UI.priceText(al.asset, q)}</span></span><button class="icon-btn" data-del="${esc(al.id)}" aria-label="Delete">${U.icon('trash')}</button></div>`;
        }).join('')}</div>` : UI.empty('bell', 'No alerts', 'Open any asset and tap Alert, or add one here.')}`;
      el.onclick = (e) => {
        const d = e.target.closest('[data-del]');
        if (d) { S.removeAlert(d.dataset.del); this.render(el); return; }
        const a = e.target.closest('[data-act]');
        if (!a) return;
        if (a.dataset.act === 'perm') Notification.requestPermission().then(() => this.render(el));
        if (a.dataset.act === 'add') UI.picker({ title: 'Alert for', filter: (x) => x.c !== 'custom', onPick: (id) => App.views.addAlert(id).then(() => this.render(el)) });
      };
    },
    refresh() { if (this.el) this.render(this.el); }
  };

  // ------------------------------------------------------------- settings
  App.views.settings = {
    title: 'Settings',
    render(el) {
      const S = App.S;
      const st = S.settings;
      const toggle = (key, label, sub) => `<label class="gitem"><span class="gi-main"><span class="gi-t">${esc(label)}</span>${sub ? `<span class="gi-s">${esc(sub)}</span>` : ''}</span><span class="switch"><input type="checkbox" data-set="${key}" ${st[key] ? 'checked' : ''}><span></span></span></label>`;
      const curs = ['USD', 'EUR', 'GBP', 'CHF', 'JPY', 'CAD', 'AUD', 'CNY', 'HKD', 'INR', 'SGD', 'SEK', 'NOK', 'MXN', 'BRL', 'KRW', 'ZAR'];
      el.innerHTML = `${UI.header('Settings', { back: true, backLabel: 'More' })}
        <div class="list-h">Appearance</div>
        <div class="group"><div class="gitem"><span class="gi-main"><span class="gi-t">Theme</span></span>${UI.seg('theme', [['system', 'Auto'], ['dark', 'Dark'], ['light', 'Light']], st.theme)}</div>
          <div class="gitem"><span class="gi-main"><span class="gi-t">Change pills show</span></span>${UI.seg('changeMode', [['pct', '%'], ['abs', 'Price'], ['mcap', 'Mkt cap']], st.changeMode)}</div>
          ${toggle('reduceMotion', 'Reduce motion', 'Stops the ticker tape and price flashes')}
          ${toggle('hideBalances', 'Hide balances', 'Masks portfolio values')}</div>
        <div class="list-h">Portfolio</div>
        <div class="group"><label class="gitem"><span class="gi-main"><span class="gi-t">Base currency</span><span class="gi-s">Portfolio totals are converted to this currency</span></span><select data-set="baseCur" class="inline-select">${curs.map((c) => `<option ${c === st.baseCur ? 'selected' : ''}>${c}</option>`).join('')}</select></label></div>
        <div class="list-h">Live data</div>
        <div class="group">
          ${toggle('liveCrypto', 'Live crypto prices', 'CoinGecko every 90 seconds plus Coinbase tick-by-tick')}
          ${toggle('remoteData', 'Fetch newest data from GitHub', 'Uses the latest market data committed by the scheduled job')}
        </div>
        <div class="group-foot">Real-time US stock prices need a free API key from <a href="https://finnhub.io/register" target="_blank" rel="noopener">finnhub.io</a>. A free CoinGecko “Demo” key raises crypto rate limits. Keys are stored only in this browser and sent only to those services.</div>
        <div class="group">
          <label class="gitem"><span class="gi-main"><span class="gi-t">Finnhub API key</span><span class="gi-s">${esc(App.D.status.finnhub)}</span></span><input class="inline-input" type="password" autocomplete="off" data-key="finnhubKey" value="${esc(st.finnhubKey)}" placeholder="Paste key"></label>
          <label class="gitem"><span class="gi-main"><span class="gi-t">CoinGecko Demo key</span><span class="gi-s">Optional</span></span><input class="inline-input" type="password" autocomplete="off" data-key="cgKey" value="${esc(st.cgKey)}" placeholder="Paste key"></label>
        </div>
        <div class="list-h">Your data</div>
        <div class="group">
          <button class="gitem" data-act="export">${U.icon('download')}<span class="gi-main"><span class="gi-t">Export or restore</span></span>${U.icon('chevR', 'chev')}</button>
          <button class="gitem" data-act="resetpaper"><span class="gi-main"><span class="gi-t">Reset paper trading</span></span></button>
          <button class="gitem" data-act="resetall"><span class="gi-main"><span class="gi-t down">Erase all app data</span></span></button>
        </div>
        <div class="group-foot">Watchlists, holdings, alerts and settings are saved in this browser's local storage. Nothing is uploaded.</div>`;
      el.addEventListener('click', async (e) => {
        const seg = e.target.closest('[data-seg] [data-v]');
        if (seg) {
          const key = seg.closest('[data-seg]').dataset.seg;
          seg.parentNode.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b === seg));
          S.set(key, seg.dataset.v);
          if (key === 'theme') App.applyTheme();
          return;
        }
        const act = e.target.closest('[data-act]');
        if (!act) return;
        if (act.dataset.act === 'export') App.views.exportSheet();
        if (act.dataset.act === 'resetpaper' && (await UI.confirm('Reset paper trading?', 'Your simulated positions and order history will be cleared.', 'Reset', true))) { S.resetPaper(100000); UI.toast('Paper account reset'); }
        if (act.dataset.act === 'resetall' && (await UI.confirm('Erase all data?', 'Watchlists, holdings, paper trades, alerts and settings will be deleted from this device.', 'Erase', true))) { S.resetAll(); App.applyTheme(); UI.toast('All data erased'); location.hash = '#/markets'; }
      });
      el.addEventListener('change', (e) => {
        const t = e.target;
        if (t.dataset.set) {
          const key = t.dataset.set;
          const val = t.type === 'checkbox' ? t.checked : t.value;
          if (key === 'liveCrypto') App.D.setLiveCrypto(val); else S.set(key, val);
          if (key === 'reduceMotion') App.applyTheme();
          if (key === 'remoteData' && val) App.D.refreshNow();
        }
        if (t.dataset.key) {
          S.set(t.dataset.key, t.value.trim());
          if (t.dataset.key === 'finnhubKey') { App.D.syncFinnhub(); UI.toast(t.value.trim() ? 'Finnhub key saved' : 'Finnhub key removed'); }
          else UI.toast('Saved');
        }
      });
    }
  };

  // ------------------------------------------------------------- data sources
  App.views.data = {
    title: 'Data Sources',
    render(el) {
      this.el = el;
      const D = App.D;
      const M = D.M;
      const st = M && M.status;
      const srcRows = D.sourcesSummary().map((r) => `<div class="gitem"><span class="gi-main"><span class="gi-t">${esc(r.k)}</span>${r.d ? `<span class="gi-s">${esc(r.d)}</span>` : ''}</span><span class="gi-v">${esc(r.v || '')}</span></div>`).join('');
      const job = st ? Object.entries(st.sources || {}).map(([k, v]) => `<div class="kv-row"><span>${esc(k)}</span><b>${esc(typeof v === 'object' ? Object.entries(v).map(([a, b]) => a + ': ' + b).join(', ') : String(v))}</b></div>`).join('') : '';
      el.innerHTML = `${UI.header('Data Sources', { back: true, backLabel: 'More', actions: `<button class="icon-btn" data-act="refresh" aria-label="Refresh">${U.icon('refresh')}</button>` })}
        <div class="group">${srcRows}</div>
        ${st ? UI.section('Last data job', `<div class="kv">${job}</div>${st.missing && st.missing.length ? `<div class="src">No fresh quote this run (previous values kept): ${esc(st.missing.slice(0, 40).join(', '))}${st.missing.length > 40 ? '…' : ''}</div>` : ''}<div class="src">Started ${esc(U.dateTimeET(Date.parse(st.started)))} · took ${esc(String(st.seconds || '?'))} s · history refreshed ${st.historyAt ? esc(U.dateTimeET(Date.parse(st.historyAt))) : 'never'}</div>`) : ''}
        ${UI.section('Where the numbers come from', `<div class="article">
          <p><b>Stocks, ETFs, indices, futures, currencies and yields:</b> Yahoo Finance, fetched by a scheduled GitHub Actions job (invest/scripts) several times each weekday and committed to this repository. These prices are delayed; each asset page shows the time. Add a free Finnhub key in Settings for real-time US stock prices.</p>
          <p><b>Crypto:</b> CoinGecko (top 100 coins, refreshed every 90 seconds in the app) and the Coinbase Exchange WebSocket (tick-by-tick prices for major coins).</p>
          <p><b>NFTs:</b> CoinGecko NFT floor prices, market value, volume and owners.</p>
          <p><b>Economy:</b> FRED (Federal Reserve Bank of St. Louis), with the U.S. Treasury, Bureau of Labor Statistics, Federal Reserve Bank of New York and Freddie Mac as fallbacks.</p>
          <p><b>Sentiment:</b> CNN Business Fear &amp; Greed Index and the alternative.me Crypto Fear &amp; Greed Index.</p>
          <p><b>Exchange rates:</b> Yahoo Finance, with European Central Bank reference rates via Frankfurter as a fallback.</p>
          <p><b>Charts &amp; widgets:</b> native charts use the data above. The optional Pro chart, heatmaps, headlines, technical ratings and economic calendar are embedded from TradingView.</p>
          <p><b>Research content:</b> art, collectibles, private markets, cash rates, the market brief and guides were written from the sources linked beside each figure, checked in the week of September 21-24, 2026.</p>
        </div>`)}
        <p class="footer-note">Data is provided for information only and may be delayed or contain errors. Verify prices with your broker before trading.</p>`;
      el.onclick = (e) => { if (e.target.closest('[data-act="refresh"]')) { D.refreshNow().then(() => this.render(el)); UI.toast('Refreshing', 'refresh'); } };
    },
    refresh() { if (this.el) this.render(this.el); }
  };

  App.views.about = {
    title: 'About',
    render(el) {
      el.innerHTML = `${UI.header('About Invest', { back: true, backLabel: 'More' })}
        <div class="article">
          <p>Invest brings every kind of investment into one app: stocks and ETFs from around the world, indices, bonds and interest rates, commodities, currencies, crypto, NFTs, real estate, art, collectibles, private companies, cash and alternatives.</p>
          <h3>What you can do</h3>
          <ul>
            <li>Follow ${window.CATALOG.assets.length}+ assets plus the top 100 cryptocurrencies with interactive charts (drag to scrub, use two fingers or click-drag to measure a range).</li>
            <li>Track everything you own, including things without a ticker, and see your allocation and performance.</li>
            <li>Practice with a $100,000 paper-trading account using real prices, including limit orders.</li>
            <li>Set price alerts, build multiple watchlists, compare assets and open pro charts.</li>
            <li>Use calculators backed by real historical data, and read guides and a glossary.</li>
          </ul>
          <h3>Privacy</h3>
          <p>There is no account and no server. Your data stays in your browser. The app contacts only the public data services listed under Data Sources.</p>
          <h3>Disclaimer</h3>
          <p>This app is for information and education. It is not investment, tax or legal advice, and it is not a broker. Past performance does not predict future results. All investments can lose value.</p>
        </div>`;
    }
  };
})();
