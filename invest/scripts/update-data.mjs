#!/usr/bin/env node
/*
 * Market-data pipeline for the Invest app.
 *
 * Runs in GitHub Actions (see .github/workflows/invest-data.yml), pulls real
 * data from public sources and writes plain JS files the app loads with
 * <script> tags (so it also works when opened from the file system):
 *
 *   data/market.js           quotes for every catalog asset, 1-day intraday line,
 *                            top-100 crypto, NFT floors, fear & greed gauges
 *   data/macro.js            FRED economic series + US Treasury yield curve
 *   data/profiles.js         company / fund profiles, analyst targets, holdings
 *   data/history/<sym>.js    5-day, 1-year, 5-year and max price history
 *
 * Sources: Yahoo Finance (stocks, ETFs, indices, futures, FX, rates),
 * CoinGecko (crypto + NFTs), FRED (economy), U.S. Treasury (yield curve),
 * CNN (stock fear & greed), alternative.me (crypto fear & greed).
 *
 * Every source is optional: when one fails, the previous values are kept
 * and the failure is recorded in `status` so the app can show it.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA = path.join(ROOT, 'data');
const HIST = path.join(DATA, 'history');
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';
const FORCE = process.env.FORCE_HISTORY === '1';
const CG_KEY = process.env.COINGECKO_DEMO_KEY || '';
const started = Date.now();
const NOW = new Date();

const status = { started: NOW.toISOString(), sources: {}, missing: [], notes: [] };
const log = (...a) => console.log(`[${((Date.now() - started) / 1000).toFixed(1)}s]`, ...a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ------------------------------------------------------------------ helpers
const isNum = (x) => typeof x === 'number' && Number.isFinite(x);
const raw = (v) => (v && typeof v === 'object' && 'raw' in v ? v.raw : v);
const sig = (x, p = 7) => (isNum(x) ? Number(x.toPrecision(p)) : undefined);
const int = (x) => (isNum(raw(x)) ? Math.round(raw(x)) : undefined);
const num = (x, p = 7) => sig(raw(x), p);
function clean(o) {
  for (const k of Object.keys(o)) if (o[k] === undefined || o[k] === null || o[k] === '' || (typeof o[k] === 'number' && !Number.isFinite(o[k]))) delete o[k];
  return o;
}
const fileSafe = (id) => id.replace(/[^A-Za-z0-9.-]/g, '_');

async function http(url, { headers = {}, type = 'json', retries = 3, timeout = 25000, slow429 = 2000 } = {}) {
  let last;
  for (let i = 0; i <= retries; i++) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': UA, Accept: type === 'json' ? 'application/json,text/plain,*/*' : '*/*', ...headers },
        signal: AbortSignal.timeout(timeout),
        redirect: 'follow'
      });
      if (res.status === 429 || res.status >= 500) {
        last = new Error(`HTTP ${res.status} ${url.slice(0, 90)}`);
        const ra = Number(res.headers.get('retry-after'));
        await sleep(isNum(ra) && ra > 0 ? Math.min(ra, 90) * 1000 : slow429 * 2 ** i);
        continue;
      }
      if (!res.ok) {
        const e = new Error(`HTTP ${res.status} ${url.slice(0, 90)}`);
        e.status = res.status;
        e.fatal = true;
        throw e;
      }
      return type === 'json' ? await res.json() : await res.text();
    } catch (e) {
      if (e.fatal) throw e;
      last = e;
      await sleep(800 * 2 ** i);
    }
  }
  throw last;
}

async function pool(items, n, fn) {
  const out = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (next < items.length) {
      const k = next++;
      try { out[k] = await fn(items[k], k); } catch (e) { out[k] = { error: e }; }
    }
  }));
  return out;
}

async function readJsFile(file, marker) {
  try {
    const txt = await fs.readFile(file, 'utf8');
    const i = txt.indexOf(marker);
    if (i < 0) return null;
    const start = txt.indexOf('{', i);
    const end = txt.lastIndexOf('}');
    return JSON.parse(txt.slice(start, end + 1));
  } catch { return null; }
}

// Writes `window.NAME = {...};` with one top-level key per line so git diffs
// (and the repository history) stay small between runs.
async function writeGlobal(file, name, obj, { oneLinePerKeyOf = [] } = {}) {
  const lines = [];
  for (const [k, v] of Object.entries(obj)) {
    if (oneLinePerKeyOf.includes(k) && v && typeof v === 'object' && !Array.isArray(v)) {
      const inner = Object.entries(v).map(([ik, iv]) => `${JSON.stringify(ik)}:${JSON.stringify(iv)}`);
      lines.push(`${JSON.stringify(k)}:{\n${inner.join(',\n')}\n}`);
    } else if (oneLinePerKeyOf.includes(k) && Array.isArray(v)) {
      lines.push(`${JSON.stringify(k)}:[\n${v.map((x) => JSON.stringify(x)).join(',\n')}\n]`);
    } else {
      lines.push(`${JSON.stringify(k)}:${JSON.stringify(v)}`);
    }
  }
  const body = `/* Generated by invest/scripts/update-data.mjs. Do not edit by hand. */\nwindow.${name} =\n{\n${lines.join(',\n')}\n};\n`;
  await fs.writeFile(file + '.tmp', body);
  await fs.rename(file + '.tmp', file);
}

// ------------------------------------------------------------------ catalog
const catalogCode = await fs.readFile(path.join(ROOT, 'js', 'catalog.js'), 'utf8');
const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(catalogCode, sandbox);
const CATALOG = sandbox.window.CATALOG;
const LIMIT = Number(process.env.LIMIT || 0); // for quick local test runs
const yahooAssets = CATALOG.assets.filter((a) => ['index', 'stock', 'etf', 'commodity', 'fx', 'rate'].includes(a.c) || (a.c === 'crypto' && a.y)).slice(0, LIMIT || undefined);
const ySym = (a) => a.y || a.id;
log(`catalog: ${CATALOG.assets.length} assets, ${yahooAssets.length} priced via Yahoo`);

await fs.mkdir(HIST, { recursive: true });
const prevMarket = (await readJsFile(path.join(DATA, 'market.js'), 'INVEST_MARKET')) || {};
const prevMacro = (await readJsFile(path.join(DATA, 'macro.js'), 'INVEST_MACRO')) || {};
const prevProfiles = (await readJsFile(path.join(DATA, 'profiles.js'), 'INVEST_PROFILES')) || {};

// ------------------------------------------------------------------ Yahoo
const Y = { cookie: '', crumb: '' };
async function yahooSession() {
  for (const url of ['https://fc.yahoo.com/', 'https://finance.yahoo.com/', 'https://login.yahoo.com/']) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'text/html' }, redirect: 'manual', signal: AbortSignal.timeout(15000) });
      const set = typeof res.headers.getSetCookie === 'function' ? res.headers.getSetCookie() : [];
      const cookie = set.map((c) => c.split(';')[0]).filter(Boolean).join('; ');
      if (!cookie) continue;
      for (const host of ['query2', 'query1']) {
        const r = await fetch(`https://${host}.finance.yahoo.com/v1/test/getcrumb`, { headers: { 'User-Agent': UA, Cookie: cookie }, signal: AbortSignal.timeout(15000) });
        const crumb = (await r.text()).trim();
        if (r.ok && crumb && crumb.length < 40 && !/[<\s{]/.test(crumb)) {
          Y.cookie = cookie;
          Y.crumb = crumb;
          log('yahoo: session ok via', url);
          return true;
        }
      }
    } catch (e) {
      log('yahoo session attempt failed', url, e.message);
    }
  }
  log('yahoo: no crumb, continuing with chart endpoint only');
  return false;
}

async function yahooQuotes(symbols) {
  const out = {};
  if (!Y.crumb) return out;
  for (let i = 0; i < symbols.length; i += 60) {
    const batch = symbols.slice(i, i + 60);
    const host = i % 120 === 0 ? 'query2' : 'query1';
    const url = `https://${host}.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(batch.join(','))}&crumb=${encodeURIComponent(Y.crumb)}&formatted=false&lang=en-US&region=US`;
    try {
      const j = await http(url, { headers: { Cookie: Y.cookie } });
      for (const q of j?.quoteResponse?.result || []) out[q.symbol] = q;
    } catch (e) {
      log('yahoo v7 batch failed:', e.message);
    }
    await sleep(350);
  }
  return out;
}

let chartCalls = 0;
async function yahooChart(sym, range, interval) {
  chartCalls++;
  const host = chartCalls % 2 ? 'query1' : 'query2';
  const url = `https://${host}.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?range=${range}&interval=${interval}&includePrePost=false`;
  const j = await http(url, { headers: Y.cookie ? { Cookie: Y.cookie } : {}, retries: 3 });
  const r = j?.chart?.result?.[0];
  if (!r) throw new Error(`no chart for ${sym}`);
  return r;
}

function points(r) {
  const ts = r.timestamp || [];
  const cl = r.indicators?.quote?.[0]?.close || [];
  const out = [];
  for (let i = 0; i < ts.length; i++) if (isNum(cl[i])) out.push([ts[i], cl[i]]);
  return out;
}

// 1-day intraday line on a fixed time grid: {s: start, e: end, n: step seconds, pc: previous close, c: [...]}
function intraday(r) {
  const pts = points(r);
  if (pts.length < 2) return undefined;
  const m = r.meta || {};
  const reg = m.currentTradingPeriod?.regular || {};
  const first = pts[0][0];
  const last = pts[pts.length - 1][0];
  let s = isNum(reg.start) ? Math.min(reg.start, first) : first;
  let e = isNum(reg.end) ? Math.max(reg.end, last) : last;
  if (e - s > 26 * 3600) s = Math.max(first, e - 24 * 3600);
  const n = e - s <= 9 * 3600 ? 600 : 1800;
  const slots = Math.floor((last - s) / n) + 1;
  const c = new Array(slots).fill(null);
  for (const [t, v] of pts) {
    const k = Math.round((t - s) / n);
    if (k >= 0 && k < slots) c[k] = v;
  }
  for (let k = 0; k < slots; k++) if (c[k] === null) c[k] = k ? c[k - 1] : pts[0][1];
  c[slots - 1] = pts[pts.length - 1][1];
  return { s, e, n, pc: num(m.chartPreviousClose ?? m.previousClose), c: c.map((v) => sig(v, 6)) };
}

function quoteFromV7(q) {
  const dy = isNum(q.dividendYield) ? q.dividendYield : isNum(q.trailingAnnualDividendYield) ? q.trailingAnnualDividendYield * 100 : undefined;
  return clean({
    p: num(q.regularMarketPrice), ch: num(q.regularMarketChange, 6), chp: num(q.regularMarketChangePercent, 5),
    pc: num(q.regularMarketPreviousClose), o: num(q.regularMarketOpen), h: num(q.regularMarketDayHigh), l: num(q.regularMarketDayLow),
    v: int(q.regularMarketVolume), av: int(q.averageDailyVolume3Month), mc: int(q.marketCap),
    h52: num(q.fiftyTwoWeekHigh), l52: num(q.fiftyTwoWeekLow),
    pe: num(q.trailingPE, 5), fpe: num(q.forwardPE, 5), eps: num(q.epsTrailingTwelveMonths, 5), feps: num(q.epsForward, 5),
    dy: num(dy, 4), dr: num(q.dividendRate ?? q.trailingAnnualDividendRate, 5), so: int(q.sharesOutstanding), pb: num(q.priceToBook, 5),
    ma50: num(q.fiftyDayAverage), ma200: num(q.twoHundredDayAverage),
    ytd: num(q.ytdReturn, 5), na: int(q.netAssets), er: num(q.netExpenseRatio, 4),
    ms: q.marketState, t: int(q.regularMarketTime),
    pp: num(q.postMarketPrice), ppc: num(q.postMarketChangePercent, 5), ppt: int(q.postMarketTime),
    pre: num(q.preMarketPrice), prec: num(q.preMarketChangePercent, 5),
    cur: q.currency, ex: q.fullExchangeName || q.exchange, xc: q.exchange, qt: q.quoteType,
    name: q.longName || q.shortName,
    earn: int(q.earningsTimestampStart ?? q.earningsTimestamp),
    src: 'yahoo'
  });
}

function quoteFromMeta(meta, prevClose) {
  const p = num(meta.regularMarketPrice);
  const pc = num(prevClose ?? meta.chartPreviousClose ?? meta.previousClose);
  return clean({
    p, pc, ch: isNum(p) && isNum(pc) ? sig(p - pc, 6) : undefined, chp: isNum(p) && isNum(pc) && pc ? sig(((p - pc) / pc) * 100, 5) : undefined,
    h: num(meta.regularMarketDayHigh), l: num(meta.regularMarketDayLow), v: int(meta.regularMarketVolume),
    h52: num(meta.fiftyTwoWeekHigh), l52: num(meta.fiftyTwoWeekLow),
    t: int(meta.regularMarketTime), cur: meta.currency, ex: meta.fullExchangeName || meta.exchangeName, qt: meta.instrumentType,
    name: meta.longName || meta.shortName, src: 'yahoo-chart'
  });
}

async function runYahoo() {
  const syms = yahooAssets.map(ySym);
  await yahooSession();
  const v7 = await yahooQuotes(syms);
  log(`yahoo v7 quotes: ${Object.keys(v7).length}/${syms.length}`);

  const quotes = {};
  const results = await pool(yahooAssets, 5, async (a) => {
    const sym = ySym(a);
    let r = null;
    try { r = await yahooChart(sym, '1d', '5m'); } catch (e) { /* fall through */ }
    const q = v7[sym] ? quoteFromV7(v7[sym]) : r ? quoteFromMeta(r.meta) : null;
    if (!q || !isNum(q.p)) return { id: a.id, ok: false };
    if (r) {
      const d = intraday(r);
      if (d) q.d = d;
      if (!isNum(q.pc) && d && isNum(d.pc)) q.pc = d.pc;
    }
    quotes[a.id] = q;
    return { id: a.id, ok: true };
  });
  const ok = results.filter((x) => x && x.ok).length;
  status.sources.yahoo = { ok, total: yahooAssets.length, v7: Object.keys(v7).length, crumb: !!Y.crumb };
  for (const x of results) if (!x || !x.ok) status.missing.push(x?.id || '?');
  log(`yahoo quotes ok: ${ok}/${yahooAssets.length}`);
  return quotes;
}

// ------------------------------------------------------------------ history
async function histAge(id) {
  try {
    const st = await fs.stat(path.join(HIST, fileSafe(id) + '.js'));
    return (Date.now() - st.mtimeMs) / 3600000;
  } catch { return Infinity; }
}

async function lastHistoryRun() {
  const t = Date.parse(prevMarket?.status?.historyAt || '');
  return isNum(t) ? (Date.now() - t) / 3600000 : Infinity;
}

const day = (t) => Math.floor(t / 86400);
function thin(arr, max) {
  if (arr.length <= max) return arr;
  const step = arr.length / max;
  const out = [];
  for (let i = 0; i < max; i++) out.push(arr[Math.floor(i * step)]);
  out[out.length - 1] = arr[arr.length - 1];
  return out;
}

async function writeHistory(id, h) {
  const series = (arr) => (arr && arr.length ? `[\n${arr.map((p) => JSON.stringify(p)).join(',\n')}\n]` : '[]');
  const body = `/* Generated by invest/scripts/update-data.mjs */\n(window.INVEST_HIST = window.INVEST_HIST || {})[${JSON.stringify(id)}] =\n{"id":${JSON.stringify(id)},"asOf":${JSON.stringify(h.asOf)},"src":${JSON.stringify(h.src)},\n"w":${series(h.w)},\n"y":${series(h.y)},\n"f":${series(h.f)},\n"m":${series(h.m)}\n};\n`;
  await fs.writeFile(path.join(HIST, fileSafe(id) + '.js'), body);
}

async function runYahooHistory() {
  let done = 0;
  const res = await pool(yahooAssets, 4, async (a) => {
    const sym = ySym(a);
    const get = async (range, interval) => { try { return points(await yahooChart(sym, range, interval)); } catch { return []; } };
    const w = await get('5d', '30m');
    const y = await get('1y', '1d');
    const f = await get('5y', '1wk');
    const m = await get('max', '1mo');
    if (!y.length && !f.length) return false;
    await writeHistory(a.id, {
      asOf: NOW.toISOString(),
      src: 'Yahoo Finance',
      w: thin(w.map(([t, c]) => [Math.round(t / 60), sig(c, 6)]), 130),
      y: y.map(([t, c]) => [day(t), sig(c, 6)]),
      f: f.map(([t, c]) => [day(t), sig(c, 6)]),
      m: m.map(([t, c]) => [day(t), sig(c, 6)])
    });
    done++;
    return true;
  });
  status.sources.history = { ok: done, total: yahooAssets.length };
  log(`history files written: ${done}/${yahooAssets.length}`);
  return res;
}

// ------------------------------------------------------------------ profiles
async function runProfiles() {
  if (!Y.crumb) { log('profiles skipped (no crumb)'); return null; }
  const assets = CATALOG.assets.filter((a) => a.c === 'stock' || a.c === 'etf');
  const out = {};
  const modules = 'assetProfile,summaryDetail,defaultKeyStatistics,financialData,calendarEvents,fundProfile,topHoldings';
  await pool(assets, 4, async (a) => {
    const url = `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(a.id)}?modules=${modules}&crumb=${encodeURIComponent(Y.crumb)}&lang=en-US&region=US`;
    let r;
    try { r = (await http(url, { headers: { Cookie: Y.cookie }, retries: 2 }))?.quoteSummary?.result?.[0]; } catch { return; }
    if (!r) return;
    const ap = r.assetProfile || {};
    const sd = r.summaryDetail || {};
    const ks = r.defaultKeyStatistics || {};
    const fd = r.financialData || {};
    const ce = r.calendarEvents || {};
    const fp = r.fundProfile || {};
    const th = r.topHoldings || {};
    const ceo = (ap.companyOfficers || []).find((o) => /chief executive|\bceo\b/i.test(o.title || ''));
    const sum = (ap.longBusinessSummary || '').trim();
    const earnDates = (ce.earnings?.earningsDate || []).map(raw).filter(isNum);
    out[a.id] = clean({
      sum: sum.length > 1400 ? sum.slice(0, sum.lastIndexOf('. ', 1400) + 1) || sum.slice(0, 1400) : sum,
      sec: ap.sector, ind: ap.industry, emp: int(ap.fullTimeEmployees), web: ap.website,
      city: ap.city, st: ap.state, cty: ap.country,
      ceo: ceo ? ceo.name : undefined, ceot: ceo ? ceo.title : undefined,
      beta: num(sd.beta ?? ks.beta, 4),
      tgt: isNum(raw(fd.targetMeanPrice)) ? clean({ m: num(fd.targetMeanPrice), h: num(fd.targetHighPrice), l: num(fd.targetLowPrice), md: num(fd.targetMedianPrice), n: int(fd.numberOfAnalystOpinions) }) : undefined,
      rec: fd.recommendationKey && fd.recommendationKey !== 'none' ? fd.recommendationKey : undefined, recm: num(fd.recommendationMean, 3),
      rev: int(fd.totalRevenue), revg: num(fd.revenueGrowth, 4), eg: num(fd.earningsGrowth, 4),
      gm: num(fd.grossMargins, 4), om: num(fd.operatingMargins, 4), pm: num(fd.profitMargins, 4), roe: num(fd.returnOnEquity, 4),
      cash: int(fd.totalCash), debt: int(fd.totalDebt), fcf: int(fd.freeCashflow), ebitda: int(fd.ebitda),
      ev: int(ks.enterpriseValue), evr: num(ks.enterpriseToRevenue, 4), eve: num(ks.enterpriseToEbitda, 4), peg: num(ks.pegRatio ?? ks.trailingPegRatio, 4),
      fl: int(ks.floatShares), sp: num(ks.shortPercentOfFloat, 4), ins: num(ks.heldPercentInsiders, 4), inst: num(ks.heldPercentInstitutions, 4),
      earn: earnDates.length ? earnDates[0] : undefined, exd: int(ce.exDividendDate), divd: int(ce.dividendDate),
      er: num(fp.feesExpensesInvestment?.annualReportExpenseRatio ?? ks.annualReportExpenseRatio, 4),
      fam: fp.family || undefined, cat: fp.categoryName || ks.category || undefined,
      inc: int(ks.fundInceptionDate), aum: int(sd.totalAssets ?? ks.totalAssets), yld: num(sd.yield ?? ks.yield, 4),
      hold: (th.holdings || []).slice(0, 10).map((h) => [h.symbol || '', h.holdingName || '', num(h.holdingPercent, 4)]),
      sw: (th.sectorWeightings || []).map((o) => { const k = Object.keys(o)[0]; return [k, num(o[k], 4)]; }).filter((x) => x[1] > 0)
    });
    if (out[a.id].hold && !out[a.id].hold.length) delete out[a.id].hold;
    if (out[a.id].sw && !out[a.id].sw.length) delete out[a.id].sw;
    await sleep(120);
  });
  status.sources.profiles = { ok: Object.keys(out).length, total: assets.length };
  log(`profiles: ${Object.keys(out).length}/${assets.length}`);
  return out;
}

// ------------------------------------------------------------------ CoinGecko
const CG = 'https://api.coingecko.com/api/v3';
const cgHeaders = CG_KEY ? { 'x-cg-demo-api-key': CG_KEY } : {};
let cgFails = 0;
async function cg(p) {
  if (cgFails >= 4) throw new Error('CoinGecko skipped after repeated failures');
  try {
    const j = await http(CG + p, { headers: cgHeaders, retries: 3, slow429: 10000 });
    cgFails = 0;
    return j;
  } catch (e) {
    cgFails++;
    throw e;
  }
}

async function runCrypto() {
  const out = {};
  try {
    const list = await cg('/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=100&page=1&sparkline=true&price_change_percentage=1h,24h,7d,30d,1y');
    out.list = list.map((c) => clean({
      id: c.id, s: (c.symbol || '').toUpperCase(), n: c.name, img: c.image, r: c.market_cap_rank,
      p: num(c.current_price), mc: int(c.market_cap), fdv: int(c.fully_diluted_valuation), v: int(c.total_volume),
      h: num(c.high_24h), l: num(c.low_24h), ch: num(c.price_change_24h, 6), chp: num(c.price_change_percentage_24h, 5),
      c1h: num(c.price_change_percentage_1h_in_currency, 4), c7d: num(c.price_change_percentage_7d_in_currency, 4),
      c30d: num(c.price_change_percentage_30d_in_currency, 4), c1y: num(c.price_change_percentage_1y_in_currency, 4),
      cs: int(c.circulating_supply), ts: int(c.total_supply), mx: int(c.max_supply),
      ath: num(c.ath), athp: num(c.ath_change_percentage, 4), athd: c.ath_date, atl: num(c.atl), atld: c.atl_date,
      t: c.last_updated, sp: thin((c.sparkline_in_7d?.price || []).filter(isNum), 56).map((v) => sig(v, 6))
    }));
    log(`coingecko markets: ${out.list.length}`);
  } catch (e) {
    log('coingecko markets failed:', e.message);
    status.notes.push('CoinGecko markets: ' + e.message);
  }
  await sleep(2500);
  try {
    const g = (await cg('/global'))?.data || {};
    out.global = clean({
      mc: int(g.total_market_cap?.usd), v: int(g.total_volume?.usd), chp: num(g.market_cap_change_percentage_24h_usd, 4),
      btcd: num(g.market_cap_percentage?.btc, 4), ethd: num(g.market_cap_percentage?.eth, 4), coins: g.active_cryptocurrencies, t: g.updated_at
    });
  } catch (e) { log('coingecko global failed:', e.message); }
  await sleep(2500);
  try {
    const tr = await cg('/search/trending');
    out.trending = (tr.coins || []).slice(0, 10).map(({ item }) => clean({ id: item.id, s: item.symbol, n: item.name, img: item.small, r: item.market_cap_rank, chp: num(item.data?.price_change_percentage_24h?.usd, 4), p: num(item.data?.price, 6) }));
  } catch (e) { log('coingecko trending failed:', e.message); }
  status.sources.coingecko = { coins: out.list?.length || 0, global: !!out.global };
  return out;
}

async function runNFTs() {
  const out = {};
  const want = CATALOG.assets.filter((a) => a.c === 'nft');
  const shape = (n) => clean({
    id: n.id, n: n.name, s: n.symbol, chain: n.asset_platform_id, contract: n.contract_address, img: n.image?.small || n.image?.small_2x,
    cur: n.native_currency_symbol || n.native_currency, fp: num(n.floor_price?.native_currency, 5), fpu: num(n.floor_price?.usd),
    mc: int(n.market_cap?.usd), mcn: num(n.market_cap?.native_currency, 6), v: int(n.volume_24h?.usd), vn: num(n.volume_24h?.native_currency, 6),
    chp: num(n.floor_price_in_usd_24h_percentage_change, 4), chpn: num(n.floor_price_24h_percentage_change?.native_currency, 4),
    c7d: num(n.floor_price_7d_percentage_change?.usd, 4), c30d: num(n.floor_price_30d_percentage_change?.usd, 4), c1y: num(n.floor_price_1y_percentage_change?.usd, 4),
    holders: int(n.number_of_unique_addresses), supply: int(n.total_supply), sales: int(n.one_day_sales), avg: num(n.one_day_average_sale_price, 5),
    ath: num(n.ath?.native_currency, 5), athu: num(n.ath?.usd), athd: n.ath_date?.native_currency || n.ath_date?.usd,
    web: n.links?.homepage
  });
  for (const a of want) {
    try {
      const n = await cg(`/nfts/${a.chain}/contract/${a.contract}`);
      out[a.id] = shape(n);
    } catch (e) {
      status.notes.push(`NFT ${a.n}: ${e.message}`);
    }
    await sleep(CG_KEY ? 1200 : 4000);
  }
  // Largest collections by market cap across all chains (Solana, Bitcoin, ...)
  try {
    const top = await cg('/nfts/list?order=market_cap_usd_desc&per_page=30&page=1');
    const have = new Set(Object.values(out).map((x) => x.id));
    out._top = top.map((t) => t.id);
    for (const t of top.slice(0, 24)) {
      if (have.has(t.id)) continue;
      await sleep(CG_KEY ? 1200 : 4000);
      try { out['n:' + t.id] = shape(await cg('/nfts/' + t.id)); } catch (e) { /* skip */ }
    }
  } catch (e) { log('nft list failed:', e.message); }
  status.sources.nft = { ok: Object.keys(out).filter((k) => k !== '_top').length };
  log(`nfts: ${status.sources.nft.ok}`);
  return out;
}

async function runCryptoHistory(cryptoList) {
  // Coins without an unambiguous Yahoo symbol: use CoinGecko (public API keeps 365 days).
  const coins = CATALOG.assets.filter((a) => a.c === 'crypto' && !a.y);
  const rank = new Map((cryptoList || []).map((c) => [c.id, c.r || 999]));
  coins.sort((a, b) => (rank.get(a.cg) || 999) - (rank.get(b.cg) || 999));
  let ok = 0;
  for (const a of coins.slice(0, 30)) {
    try {
      const y = await cg(`/coins/${a.cg}/market_chart?vs_currency=usd&days=365&interval=daily`);
      await sleep(CG_KEY ? 1500 : 5000);
      const w = await cg(`/coins/${a.cg}/market_chart?vs_currency=usd&days=7`);
      await writeHistory(a.id, {
        asOf: NOW.toISOString(), src: 'CoinGecko',
        w: thin((w.prices || []).map(([t, c]) => [Math.round(t / 60000), sig(c, 6)]), 130),
        y: (y.prices || []).map(([t, c]) => [day(t / 1000), sig(c, 6)]),
        f: [], m: []
      });
      ok++;
    } catch (e) { status.notes.push(`history ${a.s}: ${e.message}`); }
    await sleep(CG_KEY ? 1500 : 5000);
  }
  status.sources.cryptoHistory = { ok, total: Math.min(30, coins.length) };
}

// ------------------------------------------------------------------ sentiment
async function runSentiment() {
  const out = {};
  try {
    const j = await http('https://api.alternative.me/fng/?limit=400');
    const d = (j.data || []).map((x) => [Number(x.timestamp), Number(x.value), x.value_classification]);
    if (d.length) {
      out.crypto = { v: d[0][1], c: d[0][2], t: d[0][0], d1: d[1]?.[1], w1: d[7]?.[1], m1: d[30]?.[1], y1: d[365]?.[1], h: thin(d.slice(0, 365).reverse().map(([t, v]) => [day(t), v]), 120) };
    }
  } catch (e) { log('alternative.me failed:', e.message); }
  try {
    const date = NOW.toISOString().slice(0, 10);
    const j = await http(`https://production.dataviz.cnn.io/index/fearandgreed/graphdata/${date}`, { headers: { Referer: 'https://www.cnn.com/', Origin: 'https://www.cnn.com' } });
    const f = j.fear_and_greed || {};
    const hist = (j.fear_and_greed_historical?.data || []).map((x) => [day(x.x / 1000), Math.round(x.y)]);
    if (isNum(f.score)) out.stocks = { v: Math.round(f.score), c: f.rating, t: f.timestamp, d1: Math.round(f.previous_close), w1: Math.round(f.previous_1_week), m1: Math.round(f.previous_1_month), y1: Math.round(f.previous_1_year), h: thin(hist, 120) };
  } catch (e) { log('cnn fear & greed failed:', e.message); }
  status.sources.sentiment = { crypto: !!out.crypto, stocks: !!out.stocks };
  return out;
}

// ------------------------------------------------------------------ macro
const FRED = [
  // id, frequency hint, how many observations to keep
  ['CPIAUCSL', 'm', 150], ['CPILFESL', 'm', 150], ['PCEPILFE', 'm', 150], ['UNRATE', 'm', 150], ['PAYEMS', 'm', 150],
  ['DFEDTARU', 'd', 0], ['DFEDTARL', 'd', 0], ['A191RL1Q225SBEA', 'q', 60], ['MORTGAGE30US', 'w', 280],
  ['DGS10', 'd', 0], ['DGS2', 'd', 0], ['DGS3MO', 'd', 0], ['T10Y2Y', 'd', 0], ['CSUSHPINSA', 'm', 150],
  ['UMCSENT', 'm', 150], ['GASREGW', 'w', 280], ['BAMLH0A0HYM2', 'd', 0], ['M2SL', 'm', 150], ['RSAFS', 'm', 150],
  ['ICSA', 'w', 280], ['MSPUS', 'q', 60], ['VIXCLS', 'd', 0]
];

async function runFred() {
  const out = {};
  const from = new Date(NOW.getTime() - 13 * 365 * 86400000).toISOString().slice(0, 10);
  await pool(FRED, 3, async ([id, freq, keep]) => {
    try {
      const csv = await http(`https://fred.stlouisfed.org/graph/fredgraph.csv?id=${id}&cosd=${from}`, { type: 'text', retries: 2 });
      const rows = csv.trim().split(/\r?\n/).slice(1).map((l) => l.split(',')).filter((r) => r[1] && r[1] !== '.' && isNum(Number(r[1]))).map((r) => [r[0], Number(r[1])]);
      let data = rows;
      if (freq === 'd') {
        // Weekly sampling (last observation of each ISO week) for the last 6 years, plus the latest daily value.
        const cutoff = new Date(NOW.getTime() - 6 * 365 * 86400000).toISOString().slice(0, 10);
        const wk = new Map();
        for (const [d, v] of rows) if (d >= cutoff) { const t = Date.parse(d); wk.set(Math.floor((t / 86400000 + 3) / 7), [d, v]); }
        data = [...wk.values()];
        if (rows.length && data[data.length - 1][0] !== rows[rows.length - 1][0]) data.push(rows[rows.length - 1]);
      } else if (keep) {
        data = rows.slice(-keep);
      }
      if (data.length) out[id] = data.map(([d, v]) => [d, sig(v, 6)]);
    } catch (e) { status.notes.push(`FRED ${id}: ${e.message}`); }
  });
  status.sources.fred = { ok: Object.keys(out).length, total: FRED.length };
  log(`fred: ${Object.keys(out).length}/${FRED.length}`);
  return out;
}

async function runCurve() {
  const year = NOW.getUTCFullYear();
  const get = async (y) => {
    const url = `https://home.treasury.gov/resource-center/data-chart-center/interest-rates/daily-treasury-rates.csv/${y}/all?type=daily_treasury_yield_curve&field_tdr_date_value=${y}&page&_format=csv`;
    const csv = await http(url, { type: 'text', retries: 2 });
    const lines = csv.trim().split(/\r?\n/);
    const head = lines[0].split(',').map((h) => h.replace(/"/g, '').trim());
    const rows = lines.slice(1).map((l) => l.split(',').map((x) => x.replace(/"/g, '').trim())).filter((r) => r[0] && r[0].includes('/'));
    return { head, rows };
  };
  try {
    let cur = null;
    let prev = null;
    try { cur = await get(year); } catch { /* early January: current year may be empty */ }
    try { prev = await get(year - 1); } catch { /* optional */ }
    const base = cur && cur.rows.length ? cur : prev;
    if (!base) throw new Error('no treasury data');
    const tenors = base.head.slice(1);
    const toISO = (mdY) => { const [m, d, y] = mdY.split('/'); return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`; };
    const align = (r, head) => ({ date: toISO(r[0]), v: tenors.map((t) => { const i = head.indexOf(t); const x = i > 0 ? r[i] : ''; return x === '' || x === undefined || !isNum(Number(x)) ? null : Number(x); }) });
    const all = [];
    if (cur) all.push(...cur.rows.map((r) => align(r, cur.head)));
    if (prev) all.push(...prev.rows.map((r) => align(r, prev.head)));
    all.sort((a, b) => (a.date < b.date ? 1 : -1));
    const latest = all[0];
    const pick = (daysAgo) => {
      const target = new Date(Date.parse(latest.date) - daysAgo * 86400000).toISOString().slice(0, 10);
      return all.find((r) => r.date <= target) || null;
    };
    status.sources.curve = { ok: true, date: latest.date };
    return { tenors, latest, m1: pick(30), y1: pick(365) };
  } catch (e) {
    log('treasury curve failed:', e.message);
    status.sources.curve = { ok: false };
    return null;
  }
}

// ------------------------------------------------------------------ main
const hoursSinceHistory = await lastHistoryRun();
const doHistory = FORCE || hoursSinceHistory > 22 || (NOW.getUTCHours() >= 21 && hoursSinceHistory > 3);
log(`history refresh: ${doHistory} (last ${isNum(hoursSinceHistory) ? hoursSinceHistory.toFixed(1) + 'h ago' : 'never'})`);

const quotes = await runYahoo();
const crypto = await runCrypto();
const sentiment = await runSentiment();

let historyAt = prevMarket?.status?.historyAt;
if (doHistory) {
  await runYahooHistory();
  await runCryptoHistory(crypto.list || prevMarket.crypto?.list);
  historyAt = NOW.toISOString();
}

let nft = null;
if (doHistory || !prevMarket.nft) nft = await runNFTs();

let profiles = null;
if (doHistory || !prevProfiles.p) profiles = await runProfiles();

let fred = null;
let curve = null;
if (doHistory || !prevMacro.fred) {
  fred = await runFred();
  curve = await runCurve();
}

// Merge with the previous run so a partial failure never erases good data.
const mergedQuotes = {};
for (const a of yahooAssets) {
  const q = quotes[a.id] || prevMarket.q?.[a.id];
  if (q) mergedQuotes[a.id] = q;
}
const market = {
  v: 1,
  updated: NOW.toISOString(),
  status: { ...status, historyAt, finished: new Date().toISOString(), seconds: Math.round((Date.now() - started) / 1000) },
  q: mergedQuotes,
  crypto: {
    list: crypto.list?.length ? crypto.list : prevMarket.crypto?.list || [],
    global: crypto.global || prevMarket.crypto?.global || null,
    trending: crypto.trending?.length ? crypto.trending : prevMarket.crypto?.trending || [],
    t: crypto.list?.length ? NOW.toISOString() : prevMarket.crypto?.t || null
  },
  nft: nft && Object.keys(nft).length > 2 ? { t: NOW.toISOString(), c: nft } : prevMarket.nft || null,
  fng: { crypto: sentiment.crypto || prevMarket.fng?.crypto || null, stocks: sentiment.stocks || prevMarket.fng?.stocks || null }
};

if (Object.keys(mergedQuotes).length === 0 && !market.crypto.list.length) {
  console.error('No data at all this run; leaving files untouched.');
  process.exit(1);
}

await writeGlobal(path.join(DATA, 'market.js'), 'INVEST_MARKET', market, { oneLinePerKeyOf: ['q'] });
if (fred || curve) {
  await writeGlobal(path.join(DATA, 'macro.js'), 'INVEST_MACRO', {
    updated: NOW.toISOString(),
    fred: fred && Object.keys(fred).length ? fred : prevMacro.fred || {},
    curve: curve || prevMacro.curve || null
  }, { oneLinePerKeyOf: ['fred'] });
}
if (profiles && Object.keys(profiles).length) {
  const merged = { ...(prevProfiles.p || {}), ...profiles };
  await writeGlobal(path.join(DATA, 'profiles.js'), 'INVEST_PROFILES', { updated: NOW.toISOString(), p: merged }, { oneLinePerKeyOf: ['p'] });
}
log('done', JSON.stringify(market.status.sources));
