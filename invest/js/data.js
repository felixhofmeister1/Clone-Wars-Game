/*
 * Data layer.
 *
 * Sources, in order of freshness:
 *   1. Live feeds in the browser: Coinbase WebSocket (crypto ticks), CoinGecko
 *      (crypto list, charts, NFT floors), Finnhub (stock trades, needs a free
 *      key), Frankfurter (FX), alternative.me (crypto fear & greed).
 *   2. Pipeline files in invest/data (refreshed several times a day by GitHub
 *      Actions), either bundled next to the app or fetched from GitHub when the
 *      copy on GitHub is newer.
 *   3. Dated research snapshot in content.js, only if nothing else loaded.
 */
(function () {
  'use strict';
  const App = (window.App = window.App || {});
  const U = App.U;
  const CAT = window.CATALOG;
  const CONTENT = window.CONTENT;

  const REPO = 'felixhofmeister1/Clone-Wars-Game';
  const BRANCHES = ['claude/star-wars-fps-game-q54mi0', 'claude/trusting-ramanujan-liz6r2', 'gh-pages', 'main'];
  const CG_BASE = 'https://api.coingecko.com/api/v3';

  const listeners = new Set();
  const D = (App.D = {
    M: window.INVEST_MARKET || null,
    macro: window.INVEST_MACRO || null,
    profiles: window.INVEST_PROFILES || null,
    hist: {},
    cg: { list: [], byId: {}, global: null, trending: [], t: 0, src: 'none' },
    nftLive: {},
    live: {},
    dirty: new Set(),
    fx: { USD: 1 },
    fxSrc: 'none',
    remote: null, // {base, updated, branch}
    status: { coingecko: 'idle', coinbase: 'off', finnhub: 'off', remote: 'idle' }
  });

  D.on = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
  let emitTimer = null;
  D.emit = (what) => {
    clearTimeout(emitTimer);
    emitTimer = setTimeout(() => listeners.forEach((fn) => { try { fn(what); } catch (e) { console.error(e); } }), 60);
  };

  // --------------------------------------------------------------- helpers
  const isNum = U.isNum;
  const cgUrl = (path) => {
    const key = App.S.settings.cgKey;
    return CG_BASE + path + (key ? (path.includes('?') ? '&' : '?') + 'x_cg_demo_api_key=' + encodeURIComponent(key) : '');
  };
  async function getJSON(url, { timeout = 15000 } = {}) {
    const ctl = new AbortController();
    const id = setTimeout(() => ctl.abort(), timeout);
    try {
      const r = await fetch(url, { signal: ctl.signal });
      if (!r.ok) { const e = new Error('HTTP ' + r.status); e.status = r.status; throw e; }
      return await r.json();
    } finally { clearTimeout(id); }
  }
  function parseDataFile(text) {
    const i = text.indexOf('\n{');
    const j = text.lastIndexOf('}');
    if (i < 0 || j < 0) return null;
    return JSON.parse(text.slice(i + 1, j + 1));
  }

  // --------------------------------------------------------------- assets
  const extra = {}; // non-catalog assets discovered at runtime (crypto top 100, NFTs)
  D.asset = (id) => {
    if (!id) return null;
    if (CAT.byId[id]) return CAT.byId[id];
    if (extra[id]) return extra[id];
    if (id.startsWith('x:')) {
      const c = App.S.state.custom[id];
      return c ? { id, s: c.name.slice(0, 12), n: c.name, c: 'custom', g: c.cls || 'Custom', cur: c.cur || 'USD', custom: true } : null;
    }
    if (id.startsWith('c:')) {
      const r = D.cg.byId[id.slice(2)];
      if (r) return (extra[id] = { id, s: r.s, n: r.n, c: 'crypto', g: 'Crypto', cg: r.id, img: r.img });
    }
    if (id.startsWith('n:')) {
      const n = D.M && D.M.nft && D.M.nft.c && D.M.nft.c[id];
      if (n) return (extra[id] = { id, s: n.n, n: n.n, c: 'nft', g: n.chain || 'NFT', img: n.img });
    }
    return null;
  };
  D.allAssets = () => {
    const out = CAT.assets.slice();
    D.cg.list.forEach((r) => { const id = 'c:' + r.id; if (!CAT.byId[id]) { const a = D.asset(id); if (a) out.push(a); } });
    if (D.M && D.M.nft && D.M.nft.c) Object.keys(D.M.nft.c).forEach((id) => { if (id.startsWith('n:') && !CAT.byId[id]) { const a = D.asset(id); if (a) out.push(a); } });
    return out;
  };
  D.byClass = (cls) => D.allAssets().filter((a) => a.c === cls);
  D.tagged = (tag) => CAT.assets.filter((a) => a.t && a.t.includes(tag));
  D.cur = (a, q) => (q && q.cur) || a.cur || (a.c === 'rate' || a.c === 'index' || a.c === 'fx' ? null : 'USD');

  // --------------------------------------------------------------- quotes
  function cgIndex(list, src, t) {
    if (!list || !list.length) return;
    D.cg.list = list;
    D.cg.byId = {};
    list.forEach((r) => { D.cg.byId[r.id] = r; });
    D.cg.src = src;
    D.cg.t = t || Date.now();
  }

  function fromMarket(id) {
    const q = D.M && D.M.q && D.M.q[id];
    if (!q) return null;
    return Object.assign({}, q, { t: isNum(q.t) ? q.t * 1000 : undefined, src: 'Yahoo Finance', srcKind: 'pipeline' });
  }

  function cryptoQuote(a) {
    const r = D.cg.byId[a.cg];
    const y = fromMarket(a.id);
    let q = null;
    if (r) {
      q = {
        p: r.p, ch: r.ch, chp: r.chp, pc: isNum(r.p) && isNum(r.ch) ? r.p - r.ch : undefined, h: r.h, l: r.l, v: r.v, mc: r.mc, fdv: r.fdv,
        c1h: r.c1h, c7d: r.c7d, c30d: r.c30d, c1y: r.c1y, cs: r.cs, ts: r.ts, mx: r.mx, ath: r.ath, athp: r.athp, athd: r.athd, atl: r.atl, atld: r.atld,
        r: r.r, img: r.img, sp: r.sp, cur: 'USD', t: U.isoToMs(r.t), src: 'CoinGecko', srcKind: D.cg.src === 'live' ? 'live' : 'pipeline'
      };
      if (y && y.d) q.d = y.d;
      if (y && isNum(y.h52)) { q.h52 = y.h52; q.l52 = y.l52; }
    } else if (y) {
      q = y;
    }
    const L = D.live[a.id];
    if (L && q && (!q.t || L.t >= q.t - 5000)) {
      q = Object.assign({}, q, { p: L.p, t: L.t, src: L.src, srcKind: 'live' });
      if (isNum(L.o24) && L.o24) { q.pc = L.o24; q.ch = L.p - L.o24; q.chp = ((L.p - L.o24) / L.o24) * 100; }
      if (isNum(L.h)) q.h = L.h;
      if (isNum(L.l)) q.l = L.l;
      if (isNum(q.cs)) q.mc = L.p * q.cs;
    }
    return q;
  }

  function nftQuote(id) {
    const n = D.nftLive[id] || (D.M && D.M.nft && D.M.nft.c && D.M.nft.c[id]);
    if (!n) return null;
    return {
      p: n.fp, pu: n.fpu, cur: n.cur || 'ETH', chp: isNum(n.chpn) ? n.chpn : n.chp, chpu: n.chp, mc: n.mc, v: n.v, vn: n.vn,
      c7d: n.c7d, c30d: n.c30d, c1y: n.c1y, holders: n.holders, supply: n.supply, sales: n.sales, avg: n.avg,
      ath: n.ath, athu: n.athu, athd: n.athd, img: n.img, web: n.web, chain: n.chain, contract: n.contract,
      t: n.tLive || (D.M && D.M.nft && U.isoToMs(D.M.nft.t)), src: 'CoinGecko', srcKind: n.tLive ? 'live' : 'pipeline'
    };
  }

  D.quote = (id) => {
    const a = D.asset(id);
    if (!a) return null;
    if (a.c === 'crypto') return cryptoQuote(a);
    if (a.c === 'nft') return nftQuote(id);
    if (a.c === 'custom') {
      const c = App.S.state.custom[id];
      return c ? { p: c.value, cur: c.cur || 'USD', t: c.updated, src: 'Your estimate', srcKind: 'manual' } : null;
    }
    let q = fromMarket(id);
    const L = D.live[id];
    if (L) {
      const base = q || {};
      const pc = isNum(L.pc) ? L.pc : base.pc;
      q = Object.assign({}, base, { p: L.p, t: L.t, src: L.src, srcKind: 'live' });
      if (isNum(pc)) { q.pc = pc; q.ch = L.p - pc; q.chp = pc ? ((L.p - pc) / pc) * 100 : undefined; }
      ['o', 'h', 'l'].forEach((k) => { if (isNum(L[k])) q[k] = L[k]; });
    }
    if (!q && CONTENT.snap.q[id]) {
      const s = CONTENT.snap.q[id];
      q = { p: s.p, ch: s.ch, chp: s.chp, t: Date.parse(CONTENT.snap.date + 'T20:00:00Z'), src: s.src.n, srcKind: 'snapshot', note: s.note };
    }
    return q;
  };

  // Change value to show in pills/lists, honoring the user's display mode.
  D.pillText = (id, q, mode) => {
    const a = D.asset(id);
    if (!q) return '—';
    mode = mode || App.S.settings.changeMode;
    if (mode === 'mcap' && isNum(q.mc)) return U.compact(q.mc, a && a.c === 'nft' ? 'USD' : D.cur(a, q));
    if (mode === 'abs' && isNum(q.ch)) return U.signed(q.ch, a && a.c, D.cur(a, q));
    return U.pct(q.chp);
  };

  // --------------------------------------------------------------- FX
  function buildFx() {
    const fx = { USD: 1 };
    const q = (id) => { const x = D.M && D.M.q && D.M.q[id]; return x && isNum(x.p) ? x.p : null; };
    const direct = { EUR: 'EURUSD=X', GBP: 'GBPUSD=X', AUD: 'AUDUSD=X', NZD: 'NZDUSD=X' };
    const inverse = { JPY: 'JPY=X', CHF: 'CHF=X', CAD: 'CAD=X', CNY: 'CNY=X', HKD: 'HKD=X', SGD: 'SGD=X', INR: 'INR=X', KRW: 'KRW=X', MXN: 'MXN=X', BRL: 'BRL=X', ZAR: 'ZAR=X', TRY: 'TRY=X', SEK: 'SEK=X', NOK: 'NOK=X' };
    Object.entries(direct).forEach(([c, id]) => { const v = q(id); if (v) fx[c] = v; });
    Object.entries(inverse).forEach(([c, id]) => { const v = q(id); if (v) fx[c] = 1 / v; });
    fx.SAR = 1 / 3.75; // riyal is pegged at 3.75 per dollar
    if (Object.keys(fx).length > 5) { D.fx = fx; D.fxSrc = 'Yahoo Finance'; }
  }
  async function frankfurter() {
    if (D.fxSrc === 'Yahoo Finance' && Object.keys(D.fx).length > 10) return;
    for (const base of ['https://api.frankfurter.dev/v1/latest?base=USD', 'https://api.frankfurter.app/latest?from=USD']) {
      try {
        const j = await getJSON(base);
        const fx = Object.assign({}, D.fx, { USD: 1 });
        Object.entries(j.rates || {}).forEach(([c, v]) => { if (isNum(v) && v) fx[c] = 1 / v; });
        fx.SAR = 1 / 3.75;
        D.fx = fx;
        D.fxSrc = 'European Central Bank via Frankfurter (' + j.date + ')';
        D.emit('fx');
        return;
      } catch (e) { /* try next */ }
    }
  }
  D.toUSD = (x, cur) => (!isNum(x) ? NaN : !cur || cur === 'USD' ? x : D.fx[cur] ? x * D.fx[cur] : NaN);
  D.fromUSD = (x, cur) => (!isNum(x) ? NaN : !cur || cur === 'USD' ? x : D.fx[cur] ? x / D.fx[cur] : NaN);
  D.convert = (x, from, to) => D.fromUSD(D.toUSD(x, from), to);

  // --------------------------------------------------------------- data files
  const loadedFromRemote = {};
  async function remoteText(file) {
    if (!D.remote) throw new Error('no remote');
    const r = await fetch(D.remote.base + file + '?t=' + Math.floor(Date.now() / 300000), { cache: 'no-store' });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.text();
  }

  D.loadHistory = async (id) => {
    if (D.hist[id] !== undefined) return D.hist[id];
    const file = 'history/' + U.fileSafe(id) + '.js';
    const tryLocal = async () => {
      await U.loadScript('data/' + file + '?v=' + ((D.M && D.M.status && D.M.status.historyAt) || ''));
      const h = window.INVEST_HIST && window.INVEST_HIST[id];
      if (!h) throw new Error('empty');
      return h;
    };
    const tryRemote = async () => parseDataFile(await remoteText(file));
    const order = D.remote && D.remote.preferred ? [tryRemote, tryLocal] : [tryLocal, tryRemote];
    for (const fn of order) {
      try { const h = await fn(); if (h) { D.hist[id] = h; return h; } } catch (e) { /* next */ }
    }
    D.hist[id] = null;
    return null;
  };

  async function loadGlobalFile(file, name) {
    if (window[name]) return window[name];
    const tryLocal = async () => { await U.loadScript('data/' + file + '?v=' + ((D.M && D.M.updated) || '')); if (!window[name]) throw new Error('empty'); return window[name]; };
    const tryRemote = async () => { const j = parseDataFile(await remoteText(file)); if (!j) throw new Error('parse'); window[name] = j; loadedFromRemote[file] = true; return j; };
    const order = D.remote && D.remote.preferred ? [tryRemote, tryLocal] : [tryLocal, tryRemote];
    for (const fn of order) { try { return await fn(); } catch (e) { /* next */ } }
    return null;
  }
  D.loadProfiles = async () => (D.profiles = D.profiles || (await loadGlobalFile('profiles.js', 'INVEST_PROFILES')));
  D.loadMacro = async () => (D.macro = D.macro || (await loadGlobalFile('macro.js', 'INVEST_MACRO')));
  D.profile = (id) => (D.profiles && D.profiles.p && D.profiles.p[id]) || null;

  // Look for a newer copy of the pipeline data on GitHub (useful when this copy
  // of the app is hosted from a branch that the scheduled job does not update).
  async function checkRemote() {
    if (!App.S.settings.remoteData) return;
    D.status.remote = 'checking';
    const branches = BRANCHES.slice();
    try {
      let def = null;
      try { def = JSON.parse(localStorage.getItem('invest.defbranch') || 'null'); } catch (e) { /* ignore */ }
      if (!def || Date.now() - def.t > 86400000) {
        const j = await getJSON('https://api.github.com/repos/' + REPO, { timeout: 8000 });
        def = { b: j.default_branch, t: Date.now() };
        try { localStorage.setItem('invest.defbranch', JSON.stringify(def)); } catch (e) { /* ignore */ }
      }
      if (def && def.b && !branches.includes(def.b)) branches.unshift(def.b);
    } catch (e) { /* API rate limit or offline */ }
    const results = await Promise.all(branches.map(async (b) => {
      const base = `https://raw.githubusercontent.com/${REPO}/${b}/invest/data/`;
      try {
        const r = await fetch(base + 'market.js?t=' + Math.floor(Date.now() / 120000), { cache: 'no-store' });
        if (!r.ok) return null;
        const j = parseDataFile(await r.text());
        return j && j.updated ? { base, branch: b, data: j, updated: Date.parse(j.updated) } : null;
      } catch (e) { return null; }
    }));
    const best = results.filter(Boolean).sort((a, b) => b.updated - a.updated)[0];
    const localT = D.M && D.M.updated ? Date.parse(D.M.updated) : 0;
    if (best) {
      D.remote = { base: best.base, branch: best.branch, updated: best.updated, preferred: best.updated > localT + 60000 };
      if (D.remote.preferred) {
        D.M = best.data;
        D.hist = {};
        window.INVEST_HIST = {};
        if (D.macro && !loadedFromRemote['macro.js']) { D.macro = null; window.INVEST_MACRO = null; }
        if (D.profiles && !loadedFromRemote['profiles.js']) { D.profiles = null; window.INVEST_PROFILES = null; }
        ingestMarket();
        D.emit('market');
      }
      D.status.remote = 'ok';
    } else {
      D.status.remote = 'none';
    }
  }

  function ingestMarket() {
    if (!D.M) return;
    if (D.cg.src !== 'live' && D.M.crypto && D.M.crypto.list && D.M.crypto.list.length) cgIndex(D.M.crypto.list, 'pipeline', U.isoToMs(D.M.crypto.t));
    if (D.M.crypto) { D.cg.global = D.cg.global || D.M.crypto.global; D.cg.trending = D.M.crypto.trending || []; }
    buildFx();
  }

  D.dataAge = () => (D.M && D.M.updated ? Date.now() - Date.parse(D.M.updated) : Infinity);

  // --------------------------------------------------------------- series
  const DAY = 86400000;
  const RANGES = (D.RANGES = ['1D', '1W', '1M', '3M', '6M', 'YTD', '1Y', '5Y', 'MAX']);
  const cgChartCache = {};
  async function cgChart(cg, days) {
    const k = cg + ':' + days;
    const c = cgChartCache[k];
    if (c && Date.now() - c.t < 120000) return c.v;
    const j = await getJSON(cgUrl(`/coins/${encodeURIComponent(cg)}/market_chart?vs_currency=usd&days=${days}`));
    const v = (j.prices || []).filter((p) => isNum(p[1]));
    cgChartCache[k] = { t: Date.now(), v };
    return v;
  }

  const toPts = (arr, unit) => (arr || []).map(([t, v]) => [t * unit, v]);
  function appendLive(pts, q) {
    if (!q || !isNum(q.p) || !pts.length) return pts;
    const last = pts[pts.length - 1];
    const t = isNum(q.t) ? q.t : Date.now();
    if (t > last[0] + 60000) return pts.concat([[t, q.p]]);
    const out = pts.slice();
    out[out.length - 1] = [last[0], q.p];
    return out;
  }

  D.series = async (id, range) => {
    const a = D.asset(id);
    if (!a || a.c === 'nft' || a.c === 'custom') return null;
    const q = D.quote(id);
    const isCrypto = a.c === 'crypto';
    const live = isCrypto && App.S.settings.liveCrypto;

    if (range === '1D') {
      if (live) {
        try {
          const pts = await cgChart(a.cg, 1);
          if (pts.length > 5) {
            const last = pts[pts.length - 1][0];
            return { pts: appendLive(pts, q), pc: pts[0][1], s: last - DAY, e: last, src: 'CoinGecko', intraday: true };
          }
        } catch (e) { /* fall back */ }
      }
      if (q && q.d && q.d.c && q.d.c.length > 1) {
        const d = q.d;
        let pts = d.c.map((v, k) => [(d.s + k * d.n) * 1000, v]);
        if (q.srcKind === 'live') pts = appendLive(pts, q);
        return { pts, pc: isNum(d.pc) ? d.pc : q.pc, s: d.s * 1000, e: Math.max(d.e * 1000, pts[pts.length - 1][0]), src: 'Yahoo Finance', intraday: true };
      }
      if (isCrypto && q && q.sp && q.sp.length > 8) {
        const n = q.sp.length;
        const step = (7 * DAY) / (n - 1);
        const end = q.t || Date.now();
        const all = q.sp.map((v, i) => [end - (n - 1 - i) * step, v]);
        const pts = all.filter((p) => p[0] >= end - DAY);
        return { pts: appendLive(pts, q), pc: pts[0][1], s: end - DAY, e: end, src: 'CoinGecko', intraday: true };
      }
      return null;
    }

    if (range === '1W') {
      if (live) {
        try { const pts = await cgChart(a.cg, 7); if (pts.length > 5) return { pts: appendLive(pts, q), src: 'CoinGecko', intraday: true }; } catch (e) { /* fall back */ }
      }
      const h = await D.loadHistory(id);
      if (h && h.w && h.w.length > 3) return { pts: appendLive(toPts(h.w, 60000), q), src: h.src, intraday: true };
      if (isCrypto && q && q.sp && q.sp.length > 8) {
        const n = q.sp.length;
        const step = (7 * DAY) / (n - 1);
        const end = q.t || Date.now();
        return { pts: appendLive(q.sp.map((v, i) => [end - (n - 1 - i) * step, v]), q), src: 'CoinGecko', intraday: true };
      }
      return null;
    }

    const h = await D.loadHistory(id);
    let daily = h && h.y && h.y.length ? toPts(h.y, DAY) : null;
    let src = h && h.src;
    if ((!daily || daily.length < 20) && isCrypto) {
      try { const pts = await cgChart(a.cg, 365); if (pts.length > 20) { daily = pts; src = 'CoinGecko'; } } catch (e) { /* none */ }
    }
    const now = Date.now();
    const since = (ms) => (daily ? daily.filter((p) => p[0] >= now - ms) : null);
    let pts = null;
    switch (range) {
      case '1M': pts = since(31 * DAY); break;
      case '3M': pts = since(92 * DAY); break;
      case '6M': pts = since(183 * DAY); break;
      case 'YTD': {
        const y = new Date().getUTCFullYear();
        const start = Date.UTC(y, 0, 1);
        pts = daily ? daily.filter((p) => p[0] >= start) : null;
        // include the last close of the previous year as the baseline
        if (daily && pts) { const prev = daily.filter((p) => p[0] < start); if (prev.length) pts = [prev[prev.length - 1]].concat(pts); }
        break;
      }
      case '1Y': pts = daily; break;
      case '5Y': pts = h && h.f && h.f.length ? toPts(h.f, DAY) : daily; break;
      case 'MAX': pts = h && h.m && h.m.length > 24 ? toPts(h.m, DAY) : h && h.f && h.f.length ? toPts(h.f, DAY) : daily; break;
      default: pts = daily;
    }
    if (!pts || pts.length < 2) return null;
    return { pts: appendLive(pts, q), src };
  };

  // Returns over standard periods, computed from history.
  D.performance = async (id) => {
    const h = await D.loadHistory(id);
    const q = D.quote(id);
    if (!q || !isNum(q.p)) return null;
    const out = {};
    const y = h && h.y ? toPts(h.y, DAY) : [];
    const f = h && h.f ? toPts(h.f, DAY) : [];
    const m = h && h.m ? toPts(h.m, DAY) : [];
    const at = (arr, ms) => {
      const target = Date.now() - ms;
      let best = null;
      for (const p of arr) { if (p[0] <= target) best = p; else break; }
      return best ? best[1] : null;
    };
    const ret = (base) => (isNum(base) && base ? ((q.p - base) / base) * 100 : undefined);
    if (y.length) {
      out['1W'] = ret(at(y, 7 * DAY));
      out['1M'] = ret(at(y, 30 * DAY));
      out['3M'] = ret(at(y, 91 * DAY));
      out['6M'] = ret(at(y, 182 * DAY));
      const start = Date.UTC(new Date().getUTCFullYear(), 0, 1);
      const prev = y.filter((p) => p[0] < start);
      out.YTD = ret(prev.length ? prev[prev.length - 1][1] : undefined);
      out['1Y'] = ret(y[0][1]);
    }
    if (f.length) out['5Y'] = ret(f[0][1]);
    if (m.length > 12) { out.MAX = ret(m[0][1]); out.since = m[0][0]; }
    return out;
  };

  // --------------------------------------------------------------- live: CoinGecko
  let cgTimer = null;
  let cgBackoff = 90000;
  async function pollCoinGecko() {
    clearTimeout(cgTimer);
    if (!App.S.settings.liveCrypto) return;
    if (document.hidden) { cgTimer = setTimeout(pollCoinGecko, 30000); return; }
    D.status.coingecko = 'loading';
    try {
      const j = await getJSON(cgUrl('/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=100&page=1&sparkline=true&price_change_percentage=1h,24h,7d,30d,1y'));
      const list = j.map((c) => ({
        id: c.id, s: (c.symbol || '').toUpperCase(), n: c.name, img: c.image, r: c.market_cap_rank,
        p: c.current_price, mc: c.market_cap, fdv: c.fully_diluted_valuation, v: c.total_volume, h: c.high_24h, l: c.low_24h,
        ch: c.price_change_24h, chp: c.price_change_percentage_24h, c1h: c.price_change_percentage_1h_in_currency,
        c7d: c.price_change_percentage_7d_in_currency, c30d: c.price_change_percentage_30d_in_currency, c1y: c.price_change_percentage_1y_in_currency,
        cs: c.circulating_supply, ts: c.total_supply, mx: c.max_supply, ath: c.ath, athp: c.ath_change_percentage, athd: c.ath_date,
        atl: c.atl, atld: c.atl_date, t: c.last_updated, sp: c.sparkline_in_7d && c.sparkline_in_7d.price
      }));
      cgIndex(list, 'live', Date.now());
      list.forEach((r) => D.dirty.add('c:' + r.id));
      D.status.coingecko = 'live';
      cgBackoff = 90000;
      D.emit('crypto');
    } catch (e) {
      D.status.coingecko = e.status === 429 ? 'rate-limited' : 'unavailable';
      cgBackoff = Math.min(cgBackoff * 2, 600000);
    }
    cgTimer = setTimeout(pollCoinGecko, cgBackoff);
    if (!D.cg.global || D.cg.globalLive !== true) {
      try {
        const g = (await getJSON(cgUrl('/global'))).data;
        D.cg.global = { mc: g.total_market_cap.usd, v: g.total_volume.usd, chp: g.market_cap_change_percentage_24h_usd, btcd: g.market_cap_percentage.btc, ethd: g.market_cap_percentage.eth, coins: g.active_cryptocurrencies, t: g.updated_at };
        D.cg.globalLive = true;
      } catch (e) { /* keep pipeline value */ }
    }
  }

  D.fetchNft = async (id) => {
    const slug = id.slice(2);
    try {
      const n = await getJSON(cgUrl('/nfts/' + encodeURIComponent(slug)));
      D.nftLive[id] = {
        fp: n.floor_price && n.floor_price.native_currency, fpu: n.floor_price && n.floor_price.usd, cur: n.native_currency_symbol,
        chp: n.floor_price_in_usd_24h_percentage_change, chpn: n.floor_price_24h_percentage_change && n.floor_price_24h_percentage_change.native_currency,
        mc: n.market_cap && n.market_cap.usd, v: n.volume_24h && n.volume_24h.usd, vn: n.volume_24h && n.volume_24h.native_currency,
        c7d: n.floor_price_7d_percentage_change && n.floor_price_7d_percentage_change.usd, c30d: n.floor_price_30d_percentage_change && n.floor_price_30d_percentage_change.usd,
        c1y: n.floor_price_1y_percentage_change && n.floor_price_1y_percentage_change.usd, holders: n.number_of_unique_addresses, supply: n.total_supply,
        sales: n.one_day_sales, avg: n.one_day_average_sale_price, ath: n.ath && n.ath.native_currency, athu: n.ath && n.ath.usd,
        athd: n.ath_date && n.ath_date.native_currency, img: n.image && n.image.small, web: n.links && n.links.homepage, chain: n.asset_platform_id,
        contract: n.contract_address, n: n.name, desc: n.description, tLive: Date.now()
      };
      D.emit('nft');
      return true;
    } catch (e) { return false; }
  };

  D.fetchCoinDetail = async (cg) => {
    try {
      const j = await getJSON(cgUrl(`/coins/${encodeURIComponent(cg)}?localization=false&tickers=false&market_data=false&community_data=false&developer_data=false&sparkline=false`));
      return {
        desc: j.description && j.description.en ? j.description.en.replace(/<[^>]+>/g, '').split(/\r?\n\r?\n/)[0].slice(0, 1200) : '',
        web: j.links && j.links.homepage && j.links.homepage.find(Boolean),
        genesis: j.genesis_date, algo: j.hashing_algorithm, cats: (j.categories || []).filter(Boolean).slice(0, 5)
      };
    } catch (e) { return null; }
  };

  // --------------------------------------------------------------- live: Coinbase ticks
  let cbWs = null;
  let cbRetry = 2000;
  let cbHiddenSince = 0;
  const cbProducts = CAT.assets.filter((a) => a.cb).map((a) => [a.cb, a.id]);
  const cbMap = new Map(cbProducts);
  function connectCoinbase() {
    if (!App.S.settings.liveCrypto || cbWs || typeof WebSocket === 'undefined') return;
    try { cbWs = new WebSocket('wss://ws-feed.exchange.coinbase.com'); } catch (e) { cbWs = null; return; }
    D.status.coinbase = 'connecting';
    cbWs.onopen = () => {
      D.status.coinbase = 'live';
      cbRetry = 2000;
      cbProducts.forEach(([p]) => cbWs.send(JSON.stringify({ type: 'subscribe', product_ids: [p], channels: ['ticker'] })));
    };
    cbWs.onmessage = (ev) => {
      let m;
      try { m = JSON.parse(ev.data); } catch (e) { return; }
      if (m.type !== 'ticker') return;
      const id = cbMap.get(m.product_id);
      if (!id) return;
      const p = parseFloat(m.price);
      if (!isNum(p)) return;
      const prev = D.live[id];
      D.live[id] = { p, o24: parseFloat(m.open_24h), h: parseFloat(m.high_24h), l: parseFloat(m.low_24h), t: m.time ? Date.parse(m.time) : Date.now(), src: 'Coinbase', prev: prev ? prev.p : null };
      D.dirty.add(id);
    };
    cbWs.onclose = () => {
      cbWs = null;
      D.status.coinbase = 'reconnecting';
      if (App.S.settings.liveCrypto && !document.hidden) setTimeout(connectCoinbase, (cbRetry = Math.min(cbRetry * 2, 60000)));
    };
    cbWs.onerror = () => { try { cbWs.close(); } catch (e) { /* ignore */ } };
  }
  function disconnectCoinbase() { if (cbWs) { const w = cbWs; cbWs = null; w.onclose = null; try { w.close(); } catch (e) { /* ignore */ } } D.status.coinbase = 'off'; }

  // --------------------------------------------------------------- live: Finnhub (optional key)
  let fhWs = null;
  let fhSubs = new Set();
  const fhRestDone = {};
  const isUS = (a) => a && (a.c === 'stock' || a.c === 'etf') && !(a.t && a.t.includes('local'));
  D.finnhubSymbols = () => {
    const ids = new Set();
    App.S.state.watchlists.forEach((w) => w.items.forEach((i) => ids.add(i)));
    App.S.state.holdings.forEach((h) => ids.add(h.asset));
    Object.keys(App.S.paper().pos).forEach((i) => ids.add(i));
    if (D.focus) ids.add(D.focus);
    return [...ids].filter((i) => isUS(D.asset(i))).slice(0, 50);
  };
  const fhSym = (id) => id.replace('-', '.');
  async function finnhubRest(id) {
    const key = App.S.settings.finnhubKey;
    if (!key || (fhRestDone[id] && Date.now() - fhRestDone[id] < 60000)) return;
    fhRestDone[id] = Date.now();
    try {
      const j = await getJSON(`https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(fhSym(id))}&token=${encodeURIComponent(key)}`);
      if (isNum(j.c) && j.c > 0) {
        const cur = D.live[id];
        const t = j.t ? j.t * 1000 : Date.now();
        if (!cur || t >= cur.t) D.live[id] = { p: j.c, pc: j.pc, o: j.o, h: j.h, l: j.l, t, src: 'Finnhub', prev: cur ? cur.p : null };
        else Object.assign(cur, { pc: j.pc, o: j.o, h: j.h, l: j.l });
        D.dirty.add(id);
        D.status.finnhub = 'live';
      }
    } catch (e) { D.status.finnhub = e.status === 401 ? 'invalid key' : 'unavailable'; }
  }
  D.syncFinnhub = () => {
    const key = App.S.settings.finnhubKey;
    if (!key) { if (fhWs) { try { fhWs.close(); } catch (e) { /* ignore */ } fhWs = null; } D.status.finnhub = 'off'; return; }
    const want = new Set(D.finnhubSymbols());
    want.forEach((id, i) => setTimeout(() => finnhubRest(id), i * 1100));
    if (!fhWs) {
      try { fhWs = new WebSocket('wss://ws.finnhub.io?token=' + encodeURIComponent(key)); } catch (e) { return; }
      fhSubs = new Set();
      fhWs.onopen = () => { D.status.finnhub = 'live'; D.syncFinnhub(); };
      fhWs.onmessage = (ev) => {
        let m;
        try { m = JSON.parse(ev.data); } catch (e) { return; }
        if (m.type !== 'trade' || !m.data) return;
        m.data.forEach((tr) => {
          const id = tr.s.replace('.', '-');
          const cur = D.live[id] || {};
          if (!cur.t || tr.t >= cur.t) D.live[id] = Object.assign({}, cur, { p: tr.p, t: tr.t, src: 'Finnhub', prev: cur.p });
          D.dirty.add(id);
        });
      };
      fhWs.onclose = () => { fhWs = null; fhSubs = new Set(); if (App.S.settings.finnhubKey) setTimeout(D.syncFinnhub, 15000); };
      return;
    }
    if (fhWs.readyState !== 1) return;
    want.forEach((id) => { if (!fhSubs.has(id)) { fhWs.send(JSON.stringify({ type: 'subscribe', symbol: fhSym(id) })); fhSubs.add(id); } });
    fhSubs.forEach((id) => { if (!want.has(id)) { fhWs.send(JSON.stringify({ type: 'unsubscribe', symbol: fhSym(id) })); fhSubs.delete(id); } });
  };

  // --------------------------------------------------------------- sentiment
  D.fng = () => (D.M && D.M.fng) || {};
  async function liveCryptoFng() {
    if (D.M && D.M.fng && D.M.fng.crypto && Date.now() - D.M.fng.crypto.t * 1000 < 36 * 3600000) return;
    try {
      const j = await getJSON('https://api.alternative.me/fng/?limit=31');
      const d = j.data || [];
      if (!d.length) return;
      D.M = D.M || {};
      D.M.fng = D.M.fng || {};
      const prev = D.M.fng.crypto || {};
      D.M.fng.crypto = Object.assign({}, prev, { v: +d[0].value, c: d[0].value_classification, t: +d[0].timestamp, d1: d[1] && +d[1].value, w1: d[7] && +d[7].value, m1: d[30] && +d[30].value });
      D.emit('fng');
    } catch (e) { /* optional */ }
  }

  // --------------------------------------------------------------- alerts
  D.checkAlerts = () => {
    const S = App.S;
    let changed = false;
    S.state.alerts.forEach((al) => {
      if (al.fired) return;
      const q = D.quote(al.asset);
      if (!q || !isNum(q.p)) return;
      const hit = al.op === 'above' ? q.p >= al.price : q.p <= al.price;
      if (!hit) return;
      al.fired = Date.now();
      changed = true;
      const a = D.asset(al.asset);
      const msg = `${a ? a.s : al.asset} is ${al.op} ${U.price(al.price, a && a.c, D.cur(a, q))} (now ${U.price(q.p, a && a.c, D.cur(a, q))})`;
      if (App.UI) App.UI.toast(msg, 'bell');
      try { if (window.Notification && Notification.permission === 'granted') new Notification('Price alert', { body: msg, icon: 'icons/icon-192.png' }); } catch (e) { /* ignore */ }
    });
    if (changed) S.save();
  };

  // --------------------------------------------------------------- boot
  D.boot = () => {
    ingestMarket();
    if (!D.M) D.status.remote = 'no local data';
    if (App.S.settings.liveCrypto) { pollCoinGecko(); connectCoinbase(); }
    frankfurter();
    liveCryptoFng();
    D.syncFinnhub();
    checkRemote().then(() => { if (!D.M) D.emit('market'); });
    // Pick up redeployed data files every 10 minutes.
    setInterval(async () => {
      if (document.hidden) return;
      try {
        const before = D.M && D.M.updated;
        const r = await fetch('data/market.js?t=' + Date.now(), { cache: 'no-store' });
        if (r.ok) {
          const j = parseDataFile(await r.text());
          if (j && j.updated && j.updated !== before && (!D.M || Date.parse(j.updated) > Date.parse(D.M.updated || 0))) { D.M = j; D.hist = {}; ingestMarket(); D.emit('market'); }
        }
      } catch (e) { /* file:// or offline */ }
      checkRemote();
    }, 600000);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) { cbHiddenSince = Date.now(); setTimeout(() => { if (document.hidden && Date.now() - cbHiddenSince >= 290000) disconnectCoinbase(); }, 300000); }
      else { if (App.S.settings.liveCrypto) { connectCoinbase(); pollCoinGecko(); } }
    });
  };

  D.setLiveCrypto = (on) => {
    App.S.set('liveCrypto', on);
    if (on) { pollCoinGecko(); connectCoinbase(); } else { clearTimeout(cgTimer); disconnectCoinbase(); D.status.coingecko = 'off'; }
  };
  D.refreshNow = async () => {
    await Promise.all([pollCoinGecko(), checkRemote()]);
    D.syncFinnhub();
    D.emit('market');
  };

  D.sourcesSummary = () => {
    const out = [];
    if (D.M && D.M.updated) out.push({ k: 'Market data file', v: U.dateTimeET(Date.parse(D.M.updated)), d: (D.remote && D.remote.preferred ? 'GitHub (' + D.remote.branch + ')' : 'Bundled with the app') + ' · Yahoo Finance, CoinGecko, FRED, U.S. Treasury, CNN, alternative.me' });
    else out.push({ k: 'Market data file', v: 'Not available', d: 'Showing the dated research snapshot where possible' });
    out.push({ k: 'Crypto list', v: D.cg.src === 'live' ? 'Live · ' + U.ago(D.cg.t) : D.cg.src === 'pipeline' ? 'From data file' : 'Unavailable', d: 'CoinGecko ' + (D.status.coingecko || '') });
    out.push({ k: 'Crypto ticks', v: D.status.coinbase, d: 'Coinbase Exchange WebSocket' });
    out.push({ k: 'Stock ticks', v: D.status.finnhub, d: App.S.settings.finnhubKey ? 'Finnhub (your key)' : 'Add a free Finnhub key in Settings for real-time US stock prices' });
    out.push({ k: 'Currency rates', v: D.fxSrc });
    return out;
  };
})();
