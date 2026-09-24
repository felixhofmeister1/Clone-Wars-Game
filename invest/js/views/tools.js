/* Calculators. Where real data helps (DCA backtest, inflation, mortgage rate) the tools use it. */
(function () {
  'use strict';
  const App = (window.App = window.App || {});
  const U = App.U;
  const UI = App.UI;
  const esc = U.esc;
  App.views = App.views || {};

  const $ = (x, d = 0) => U.money(x, App.S.settings.baseCur || 'USD', d);
  const latestFred = (id) => {
    const s = App.D.macro && App.D.macro.fred && App.D.macro.fred[id];
    return s && s.length ? s[s.length - 1][1] : null;
  };
  const cpiYoY = () => {
    const s = App.D.macro && App.D.macro.fred && App.D.macro.fred.CPIAUCSL;
    if (!s || s.length < 13) return null;
    const last = s[s.length - 1];
    const prev = s.find((x) => x[0].slice(0, 7) === String(Number(last[0].slice(0, 4)) - 1) + last[0].slice(4, 7));
    return prev ? ((last[1] - prev[1]) / prev[1]) * 100 : null;
  };

  function amortize(P, rate, years) {
    const r = rate / 100 / 12;
    const n = years * 12;
    const pmt = r ? (P * r) / (1 - Math.pow(1 + r, -n)) : P / n;
    let bal = P;
    const yearly = [];
    let yi = 0;
    let yp = 0;
    for (let m = 1; m <= n; m++) {
      const int = bal * r;
      const prin = pmt - int;
      bal -= prin;
      yi += int;
      yp += prin;
      if (m % 12 === 0) { yearly.push({ y: m / 12, i: yi, p: yp, bal: Math.max(0, bal) }); yi = 0; yp = 0; }
    }
    return { pmt, yearly, total: pmt * n };
  }

  const TOOLS = [
    {
      id: 'compound', n: 'Compound interest', sub: 'How savings grow with regular contributions', icon: 'calc',
      fields: () => [
        { k: 'init', label: 'Starting amount', value: 10000 }, { k: 'monthly', label: 'Monthly contribution', value: 500 },
        { k: 'rate', label: 'Annual return (%)', value: 7, step: 0.1 }, { k: 'years', label: 'Years', value: 30 },
        { k: 'infl', label: 'Inflation (%)', value: +(cpiYoY() || 3).toFixed(1), step: 0.1 }
      ],
      calc(v) {
        const r = Math.pow(1 + v.rate / 100, 1 / 12) - 1;
        let bal = v.init;
        let contrib = v.init;
        const cats = [];
        const cs = [];
        const gs = [];
        for (let y = 1; y <= Math.min(80, Math.round(v.years)); y++) {
          for (let m = 0; m < 12; m++) { bal = bal * (1 + r) + v.monthly; contrib += v.monthly; }
          cats.push(String(y));
          cs.push(contrib);
          gs.push(bal - contrib);
        }
        const real = bal / Math.pow(1 + v.infl / 100, v.years);
        return {
          out: [['Future value', $(bal)], ['You contribute', $(contrib)], ['Growth', $(bal - contrib)], ["In today's money", $(real), `at ${U.fmtN(v.infl, 1)}% inflation`]],
          chart: (h) => App.Chart.columns(h, cats, [{ name: 'Contributions', color: App.Chart.series(0), values: cs }, { name: 'Growth', color: App.Chart.series(2), values: gs }], { fmtY: (x) => U.compact(x, 'USD'), label: 'Balance by year' }),
          note: 'Assumes contributions at the end of each month and a constant return. Real returns vary year to year.'
        };
      }
    },
    {
      id: 'dca', n: 'DCA backtest', sub: 'What regular investing would have returned, using real prices', icon: 'compare', async: true,
      fields: () => [
        { k: 'asset', label: 'Asset', type: 'asset', value: 'VOO' }, { k: 'amt', label: 'Amount per month', value: 200 },
        { k: 'years', label: 'Starting years ago', type: 'select', value: '5', options: [['1', '1 year'], ['3', '3 years'], ['5', '5 years'], ['10', '10 years'], ['20', '20 years']] }
      ],
      async calc(v) {
        const D = App.D;
        const a = D.asset(v.asset);
        if (!a) return { out: [['Asset', 'Pick an asset']] };
        const h = await D.loadHistory(v.asset);
        const q = D.quote(v.asset);
        const yrs = Number(v.years);
        let pts = [];
        if (h) {
          const src = yrs > 5 ? h.m : yrs > 1 ? (h.f && h.f.length ? h.f : h.y) : h.y;
          pts = (src || []).map(([d, c]) => [d * 86400000, c]);
        }
        if (pts.length < 4 && a.c === 'crypto') { const s = await D.series(v.asset, '1Y'); if (s) pts = s.pts; }
        if (pts.length < 4 || !q || !U.isNum(q.p)) return { out: [['Data', 'No price history available for this asset yet']] };
        const start = Date.now() - yrs * 365.25 * 86400000;
        if (pts[0][0] > start + 45 * 86400000) return { out: [['Data', `History for ${a.s} starts ${U.dateLong(pts[0][0])}; choose a shorter period`]] };
        let units = 0;
        let invested = 0;
        const inv = [];
        const val = [];
        const priceAt = (t) => { let p = null; for (const x of pts) { if (x[0] <= t) p = x[1]; else break; } return p; };
        const firstPrice = priceAt(start) || pts[0][1];
        for (let t = start, i = 0; t <= Date.now(); t += 30.4375 * 86400000, i++) {
          const p = priceAt(t);
          if (!p) continue;
          units += v.amt / p;
          invested += v.amt;
          inv.push([t, invested]);
          val.push([t, units * p]);
        }
        const value = units * q.p;
        val.push([Date.now(), value]);
        inv.push([Date.now(), invested]);
        const lump = (invested / firstPrice) * q.p;
        return {
          out: [['Invested', $(invested)], ['Value today', $(value)], ['Gain', `<span class="${U.dir(value - invested)}">${U.signed(value - invested, null, 'USD')} (${U.pct(((value - invested) / invested) * 100)})</span>`], ['Lump sum instead', $(lump), 'all at the start']],
          chart: (host) => App.Chart.multi(host, [{ name: 'Portfolio value', color: App.Chart.series(0), pts: val }, { name: 'Money invested', color: App.Chart.series(1), pts: inv, dash: true }], { fmtY: (x) => U.compact(x, 'USD'), fmtX: (t) => U.dateLong(t), height: 230, label: 'DCA value over time' }),
          note: `Buys ${$(v.amt)} of ${a.s} every month at the closing price in the app's history data (${esc(h ? h.src : 'CoinGecko')}), valued at today's price of ${UI.priceText(v.asset, q)}. Excludes dividends, fees and taxes. Past results do not predict future returns.`
        };
      }
    },
    {
      id: 'retire', n: 'Retirement & FIRE', sub: 'When could you stop working?', icon: 'target',
      fields: () => [
        { k: 'age', label: 'Current age', value: 30 }, { k: 'retire', label: 'Target retirement age', value: 60 },
        { k: 'saved', label: 'Saved so far', value: 50000 }, { k: 'monthly', label: 'Monthly saving', value: 1000 },
        { k: 'spend', label: 'Yearly spending in retirement', value: 60000 }, { k: 'rate', label: 'Return before inflation (%)', value: 7, step: 0.1 },
        { k: 'infl', label: 'Inflation (%)', value: 3, step: 0.1 }, { k: 'wr', label: 'Withdrawal rate (%)', value: 4, step: 0.1 }
      ],
      calc(v) {
        const real = (1 + v.rate / 100) / (1 + v.infl / 100) - 1;
        const rm = Math.pow(1 + real, 1 / 12) - 1;
        const target = v.spend / (v.wr / 100);
        let bal = v.saved;
        let fiAge = null;
        const cats = [];
        const vals = [];
        for (let age = v.age; age <= Math.max(v.retire, v.age + 1) + 5 && age <= 100; age++) {
          cats.push(String(age));
          vals.push(bal);
          if (fiAge === null && bal >= target) fiAge = age;
          for (let m = 0; m < 12; m++) bal = bal * (1 + rm) + (age < v.retire ? v.monthly : 0);
        }
        const atRet = vals[Math.max(0, Math.round(v.retire - v.age))];
        return {
          out: [['Target ("FI number")', $(target), `${U.fmtN(v.spend, 0)} ÷ ${U.fmtN(v.wr, 1)}%`], ['At retirement age', $(atRet), "in today's money"], ['Sustainable income', $(atRet * (v.wr / 100)), 'per year'], ['Financially independent', fiAge !== null ? 'Age ' + fiAge : 'Not by ' + cats[cats.length - 1]]],
          chart: (h) => App.Chart.columns(h, cats, [{ name: "Savings (today's money)", color: App.Chart.series(0), values: vals }], { fmtY: (x) => U.compact(x, 'USD'), label: 'Savings by age' }),
          note: 'Uses real (after-inflation) returns so every number is in today\'s money. The 4% rule comes from US historical studies of 30-year retirements; lower rates are safer for longer ones.'
        };
      }
    },
    {
      id: 'mortgage', n: 'Mortgage', sub: 'Monthly payment and total interest', icon: 'home',
      fields: () => [
        { k: 'price', label: 'Home price', value: 429100 }, { k: 'down', label: 'Down payment (%)', value: 20, step: 0.5 },
        { k: 'rate', label: 'Interest rate (%)', value: +(latestFred('MORTGAGE30US') || 6.95).toFixed(2), step: 0.01 },
        { k: 'years', label: 'Term (years)', type: 'select', value: '30', options: [['30', '30 years'], ['20', '20 years'], ['15', '15 years'], ['10', '10 years']] },
        { k: 'tax', label: 'Property tax (%/yr)', value: 1.1, step: 0.05 }, { k: 'ins', label: 'Insurance ($/yr)', value: 2000 }
      ],
      calc(v) {
        const loan = v.price * (1 - v.down / 100);
        const am = amortize(loan, v.rate, Number(v.years));
        const extra = (v.price * v.tax) / 100 / 12 + v.ins / 12;
        return {
          out: [['Principal & interest', $(am.pmt, 2), 'per month'], ['With tax & insurance', $(am.pmt + extra, 2), 'per month'], ['Loan amount', $(loan)], ['Total interest', $(am.total - loan)]],
          chart: (h) => App.Chart.columns(h, am.yearly.map((x) => String(x.y)), [{ name: 'Principal', color: App.Chart.series(0), values: am.yearly.map((x) => x.p) }, { name: 'Interest', color: App.Chart.series(1), values: am.yearly.map((x) => x.i) }], { fmtY: (x) => U.compact(x, 'USD'), label: 'Payments by year' }),
          table: `<table class="tbl"><tr><th>Year</th><th>Principal</th><th>Interest</th><th>Balance</th></tr>${am.yearly.map((x) => `<tr><td>${x.y}</td><td>${$(x.p)}</td><td>${$(x.i)}</td><td>${$(x.bal)}</td></tr>`).join('')}</table>`,
          note: `Default rate is the latest Freddie Mac 30-year average${latestFred('MORTGAGE30US') ? '' : ' (6.95%, Sep 17, 2026)'}; default price is the US median existing-home price for August 2026 ($429,100, NAR).`
        };
      }
    },
    {
      id: 'inflation', n: 'Inflation', sub: 'What money from one year is worth in another (CPI)', icon: 'cash',
      fields: () => [{ k: 'amt', label: 'Amount', value: 100 }, { k: 'from', label: 'From year', value: 2000 }, { k: 'to', label: 'To year', value: new Date().getUTCFullYear() }],
      async calc(v) {
        await App.D.loadMacro();
        const s = App.D.macro && App.D.macro.fred && App.D.macro.fred.CPIAUCSL;
        if (!s || s.length < 24) return { out: [['Data', 'CPI data has not loaded yet']] };
        const avg = {};
        s.forEach(([d, x]) => { const y = d.slice(0, 4); (avg[y] = avg[y] || []).push(x); });
        const yv = (y) => { const a = avg[String(Math.round(y))]; return a ? a.reduce((p, c) => p + c, 0) / a.length : null; };
        const f = yv(v.from);
        const t = yv(v.to);
        const first = Object.keys(avg)[0];
        if (!f || !t) return { out: [['Range', `CPI data covers ${first}–${Object.keys(avg).pop()}`]] };
        const res = (v.amt * t) / f;
        const yrs = Math.abs(v.to - v.from) || 1;
        return {
          out: [['Equivalent value', $(res, 2)], ['Cumulative inflation', U.pct(((t - f) / f) * 100, 1)], ['Average per year', U.pct((Math.pow(t / f, 1 / yrs) - 1) * 100 * Math.sign(v.to - v.from || 1), 2)]],
          note: `Uses annual averages of the seasonally adjusted CPI-U (FRED series CPIAUCSL, ${first} onward; the current year is year-to-date).`
        };
      }
    },
    {
      id: 'fees', n: 'Fee impact', sub: 'What a higher expense ratio costs over time', icon: 'filter',
      fields: () => [{ k: 'amt', label: 'Investment', value: 100000 }, { k: 'rate', label: 'Return before fees (%)', value: 7, step: 0.1 }, { k: 'years', label: 'Years', value: 30 }, { k: 'f1', label: 'Low fee (%)', value: 0.03, step: 0.01 }, { k: 'f2', label: 'High fee (%)', value: 1, step: 0.01 }],
      calc(v) {
        const a = [];
        const b = [];
        for (let y = 0; y <= v.years; y++) { a.push([y, v.amt * Math.pow(1 + (v.rate - v.f1) / 100, y)]); b.push([y, v.amt * Math.pow(1 + (v.rate - v.f2) / 100, y)]); }
        const A = a[a.length - 1][1];
        const B = b[b.length - 1][1];
        return {
          out: [[`At ${v.f1}% fee`, $(A)], [`At ${v.f2}% fee`, $(B)], ['Cost of higher fee', $(A - B)], ['Share of wealth lost', U.pctPlain(((A - B) / A) * 100, 1)]],
          chart: (h) => App.Chart.multi(h, [{ name: `${v.f1}% fee`, color: App.Chart.series(0), pts: a }, { name: `${v.f2}% fee`, color: App.Chart.series(1), pts: b }], { fmtY: (x) => U.compact(x, 'USD'), fmtX: (x) => 'Year ' + x, xLabels: a.filter((p, i) => i % 5 === 0).map(([x]) => [x, String(x)]), label: 'Growth with different fees' })
        };
      }
    },
    {
      id: 'dividend', n: 'Dividend income', sub: 'Income from a dividend portfolio over time', icon: 'coin',
      fields: () => [{ k: 'amt', label: 'Investment', value: 50000 }, { k: 'yld', label: 'Dividend yield (%)', value: 3.5, step: 0.1 }, { k: 'dg', label: 'Dividend growth (%/yr)', value: 6, step: 0.1 }, { k: 'pg', label: 'Price growth (%/yr)', value: 4, step: 0.1 }, { k: 'years', label: 'Years', value: 20 }, { k: 'drip', label: 'Reinvest dividends', type: 'select', value: 'yes', options: [['yes', 'Yes'], ['no', 'No']] }],
      calc(v) {
        let shares = 1;
        let price = v.amt;
        let dps = v.amt * (v.yld / 100);
        let total = 0;
        const cats = [];
        const inc = [];
        for (let y = 1; y <= Math.min(60, v.years); y++) {
          const income = shares * dps;
          total += income;
          if (v.drip === 'yes') shares += income / price;
          price *= 1 + v.pg / 100;
          dps *= 1 + v.dg / 100;
          cats.push(String(y));
          inc.push(income);
        }
        return {
          out: [['Income in final year', $(inc[inc.length - 1])], ['Total dividends', $(total)], ['Portfolio value', $(shares * price)], ['Yield on cost (final)', U.pctPlain((inc[inc.length - 1] / v.amt) * 100, 1)]],
          chart: (h) => App.Chart.columns(h, cats, [{ name: 'Dividend income', color: App.Chart.series(2), values: inc }], { fmtY: (x) => U.compact(x, 'USD'), label: 'Dividend income by year' })
        };
      }
    },
    {
      id: 'savings', n: 'Savings goal', sub: 'How much to save each month', icon: 'target',
      fields: () => [{ k: 'goal', label: 'Goal', value: 50000 }, { k: 'have', label: 'Already saved', value: 5000 }, { k: 'years', label: 'Years', value: 5 }, { k: 'rate', label: 'Interest / return (%)', value: 4, step: 0.1 }],
      calc(v) {
        const r = v.rate / 100 / 12;
        const n = v.years * 12;
        const fvHave = v.have * Math.pow(1 + r, n);
        const need = Math.max(0, v.goal - fvHave);
        const pmt = r ? (need * r) / (Math.pow(1 + r, n) - 1) : need / n;
        return { out: [['Save each month', $(pmt, 2)], ['Total you put in', $(pmt * n + v.have)], ['Interest earned', $(v.goal - pmt * n - v.have)], ['Months', U.int(n)]], note: 'High-yield savings accounts paid up to about 4.2% APY in September 2026 (CNBC Select).' };
      }
    },
    {
      id: 'rule72', n: 'Rule of 72', sub: 'How long until money doubles', icon: 'sparkle',
      fields: () => [{ k: 'rate', label: 'Annual return (%)', value: 7, step: 0.1 }],
      calc(v) {
        const exact = Math.log(2) / Math.log(1 + v.rate / 100);
        return { out: [['Rule of 72', U.fmtN(72 / v.rate, 1) + ' years'], ['Exact', U.fmtN(exact, 1) + ' years'], ['10× takes', U.fmtN(Math.log(10) / Math.log(1 + v.rate / 100), 1) + ' years']], note: 'Divide 72 by the annual rate to estimate doubling time. It is most accurate for rates between 6% and 10%.' };
      }
    },
    {
      id: 'cagr', n: 'CAGR', sub: 'Annual growth rate between two values', icon: 'stock',
      fields: () => [{ k: 'a', label: 'Starting value', value: 1000 }, { k: 'b', label: 'Ending value', value: 2500 }, { k: 'years', label: 'Years', value: 8, step: 0.1 }],
      calc(v) { const c = (Math.pow(v.b / v.a, 1 / v.years) - 1) * 100; return { out: [['CAGR', U.pct(c)], ['Total return', U.pct(((v.b - v.a) / v.a) * 100)], ['Multiple', U.fmtN(v.b / v.a, 2) + '×']] }; }
    },
    {
      id: 'position', n: 'Position size', sub: 'How much to buy for a given risk', icon: 'gauge',
      fields: () => [{ k: 'acct', label: 'Account size', value: 25000 }, { k: 'risk', label: 'Risk per trade (%)', value: 1, step: 0.1 }, { k: 'entry', label: 'Entry price', value: 100, step: 0.01 }, { k: 'stop', label: 'Stop-loss price', value: 92, step: 0.01 }],
      calc(v) {
        const riskAmt = (v.acct * v.risk) / 100;
        const per = Math.abs(v.entry - v.stop);
        const sh = per ? riskAmt / per : 0;
        return { out: [['Shares', U.fmtN(Math.floor(sh), 0)], ['Position value', $(Math.floor(sh) * v.entry)], ['Max loss at stop', $(Math.floor(sh) * per)], ['Share of account', U.pctPlain(((Math.floor(sh) * v.entry) / v.acct) * 100, 1)]], note: 'A stop order can fill below the stop price in a fast market (gap risk).' };
      }
    },
    {
      id: 'profit', n: 'Trade profit', sub: 'Gain, return and break-even for a trade', icon: 'swap',
      fields: () => [{ k: 'buy', label: 'Buy price', value: 100, step: 0.01 }, { k: 'sell', label: 'Sell price', value: 118, step: 0.01 }, { k: 'qty', label: 'Quantity', value: 50, step: 'any' }, { k: 'fees', label: 'Total fees', value: 0, step: 0.01 }],
      calc(v) {
        const pl = (v.sell - v.buy) * v.qty - v.fees;
        return { out: [['Profit / loss', `<span class="${U.dir(pl)}">${U.signed(pl, null, 'USD')}</span>`], ['Return', U.pct((pl / (v.buy * v.qty)) * 100)], ['Break-even price', $(v.buy + v.fees / v.qty, 2)]] };
      }
    },
    {
      id: 'crypto', n: 'Crypto converter', sub: 'Convert between coins and currencies at live prices', icon: 'crypto',
      fields: () => [{ k: 'amt', label: 'Amount', value: 1, step: 'any' }, { k: 'coin', label: 'Coin', type: 'select', value: 'bitcoin', options: App.D.cg.list.slice(0, 100).map((c) => [c.id, `${c.s} · ${c.n}`]) }, { k: 'cur', label: 'Currency', type: 'select', value: 'USD', options: ['USD', 'EUR', 'GBP', 'CHF', 'JPY', 'CAD', 'AUD', 'INR'].map((x) => [x, x]) }],
      calc(v) {
        const q = App.D.quote('c:' + v.coin);
        if (!q || !U.isNum(q.p)) return { out: [['Price', 'Unavailable']] };
        const usd = v.amt * q.p;
        const conv = App.D.fromUSD(usd, v.cur);
        return { out: [['Value', U.money(conv, v.cur, conv >= 1 ? 2 : 6)], ['1 ' + (App.D.asset('c:' + v.coin) || {}).s, U.money(App.D.fromUSD(q.p, v.cur), v.cur, q.p >= 1 ? 2 : 6)], ['24h change', `<span class="${U.dir(q.chp)}">${U.pct(q.chp)}</span>`]], note: `${q.src} price${q.t ? ' · ' + U.ago(q.t) : ''}. Exchange rates: ${App.D.fxSrc}.` };
      }
    }
  ];

  App.views.tools = {
    title: 'Calculators',
    render(el, id) {
      if (!id) {
        this.title = 'Calculators';
        el.innerHTML = `${UI.header('Calculators', { back: true, backLabel: 'More' })}
          <div class="group">${TOOLS.map((t) => `<a class="gitem" href="#/more/tools/${t.id}"><span class="gi-icon">${U.icon(t.icon)}</span><span class="gi-main"><span class="gi-t">${esc(t.n)}</span><span class="gi-s">${esc(t.sub)}</span></span>${U.icon('chevR', 'chev')}</a>`).join('')}</div>`;
        return;
      }
      const t = TOOLS.find((x) => x.id === id);
      if (!t) { el.innerHTML = UI.header('Not found', { back: true }); return; }
      this.title = t.n;
      const fields = t.fields();
      const vals = {};
      fields.forEach((f) => { vals[f.k] = f.value; });
      const fieldHTML = (f) => {
        if (f.type === 'select') return `<label class="field"><span>${esc(f.label)}</span><select data-k="${f.k}">${f.options.map(([v, l]) => `<option value="${esc(v)}" ${String(v) === String(f.value) ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></label>`;
        if (f.type === 'asset') return `<label class="field"><span>${esc(f.label)}</span><button type="button" class="btn secondary" data-pick="${f.k}" style="justify-content:flex-start">${esc((App.D.asset(f.value) || {}).s || f.value)} · change</button></label>`;
        return `<label class="field"><span>${esc(f.label)}</span><input type="number" inputmode="decimal" step="${f.step || 'any'}" data-k="${f.k}" value="${esc(f.value)}"></label>`;
      };
      el.innerHTML = `${UI.header(t.n, { back: true, backLabel: 'Calculators', sub: esc(t.sub) })}
        <form class="tool-form" onsubmit="return false">${fields.map(fieldHTML).join('')}</form>
        <div class="tool-out" data-part="out"></div>
        <div data-part="chart" class="chart-wrap" style="min-height:0"></div>
        <div data-part="table" class="table-wrap"></div>
        <p class="src" data-part="note"></p>
        <p class="footer-note">Estimates for illustration only; not financial advice.</p>`;
      let token = 0;
      const run = async () => {
        const my = ++token;
        el.querySelectorAll('[data-k]').forEach((i) => { vals[i.dataset.k] = i.tagName === 'SELECT' ? i.value : parseFloat(i.value) || 0; });
        let r;
        try { r = await t.calc(Object.assign({}, vals)); } catch (e) { r = { out: [['Error', esc(e.message)]] }; }
        if (my !== token) return;
        el.querySelector('[data-part="out"]').innerHTML = r.out.map(([k, v, s]) => UI.stat(k, v, s ? esc(s) : '')).join('');
        const ch = el.querySelector('[data-part="chart"]');
        if (r.chart) { ch.style.minHeight = '230px'; r.chart(ch); } else { ch.innerHTML = ''; ch.style.minHeight = '0'; }
        el.querySelector('[data-part="table"]').innerHTML = r.table || '';
        el.querySelector('[data-part="note"]').innerHTML = r.note || '';
      };
      el.addEventListener('input', U.debounce(run, 150));
      el.addEventListener('change', run);
      el.addEventListener('click', (e) => {
        const b = e.target.closest('[data-pick]');
        if (!b) return;
        UI.picker({ title: 'Choose asset', filter: (a) => a.c !== 'nft' && a.c !== 'custom' && a.c !== 'rate', popular: ['VOO', 'QQQ', 'c:bitcoin', 'c:ethereum', 'AAPL', 'NVDA', 'GLD', 'SCHD', 'VT', 'MSFT'], onPick: (id2) => { vals[b.dataset.pick] = id2; fields.find((f) => f.k === b.dataset.pick).value = id2; b.textContent = ((App.D.asset(id2) || {}).s || id2) + ' · change'; run(); } });
      });
      run();
    }
  };
})();
