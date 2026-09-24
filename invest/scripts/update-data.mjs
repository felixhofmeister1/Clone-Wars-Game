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
 * Sources: Yahoo Finance (stocks, ETFs, indices, futures, FX, rates; fetched
 * by fetch_yahoo.py through yfinance), CoinGecko (crypto + NFTs), FRED with
 * official fallbacks (BLS, NY Fed, Freddie Mac, U.S. Treasury) for the
 * economy, U.S. Treasury (yield curve), CNN (stock fear & greed) and
 * alternative.me (crypto fear & greed).
 *
 * Modes:
 *   node update-data.mjs --list-symbols out.json   write the Yahoo symbol list
 *   node update-data.mjs --yahoo yahoo.json        merge everything and write data/
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

// ------------------------------------------------------------------ history
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
    if (cgFails >= 4) break;
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
    if (cgFails >= 4) break;
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
// FRED series the app understands. `keep` = observations kept (0 = weekly sampling of a daily series, -1 = full history).
const FRED = [
  ['CPIAUCSL', 'm', -1], ['CPILFESL', 'm', 150], ['PCEPILFE', 'm', 150], ['UNRATE', 'm', 150], ['PAYEMS', 'm', 150],
  ['DFEDTARU', 'd', 0], ['DFEDTARL', 'd', 0], ['A191RL1Q225SBEA', 'q', 60], ['MORTGAGE30US', 'w', 280],
  ['DGS10', 'd', 0], ['DGS2', 'd', 0], ['DGS3MO', 'd', 0], ['T10Y2Y', 'd', 0], ['CSUSHPINSA', 'm', 150],
  ['UMCSENT', 'm', 150], ['GASREGW', 'w', 280], ['BAMLH0A0HYM2', 'd', 0], ['M2SL', 'm', 150], ['RSAFS', 'm', 150],
  ['ICSA', 'w', 280], ['MSPUS', 'q', 60], ['VIXCLS', 'd', 0]
];

// Keep the last observation of each week for the last six years (plus the latest value).
function weekly(rows) {
  const cutoff = new Date(NOW.getTime() - 6 * 365 * 86400000).toISOString().slice(0, 10);
  const wk = new Map();
  for (const [d, v] of rows) if (d >= cutoff) wk.set(Math.floor((Date.parse(d) / 86400000 + 3) / 7), [d, v]);
  const data = [...wk.values()];
  if (rows.length && data.length && data[data.length - 1][0] !== rows[rows.length - 1][0]) data.push(rows[rows.length - 1]);
  return data;
}
function shapeSeries(rows, freq, keep) {
  let data = rows;
  if (freq === 'd') data = weekly(rows);
  else if (keep > 0) data = rows.slice(-keep);
  return data.map(([d, v]) => [d, sig(v, 6)]);
}

async function runFred() {
  const out = {};
  const from = new Date(NOW.getTime() - 13 * 365 * 86400000).toISOString().slice(0, 10);
  let fails = 0;
  await pool(FRED, 2, async ([id, freq, keep]) => {
    if (fails >= 3) return;
    try {
      const start = keep === -1 ? '1947-01-01' : from;
      const csv = await http(`https://fred.stlouisfed.org/graph/fredgraph.csv?id=${id}&cosd=${start}`, { type: 'text', retries: 1, timeout: 45000 });
      const rows = csv.trim().split(/\r?\n/).slice(1).map((l) => l.split(',')).filter((r) => r[1] && r[1] !== '.' && isNum(Number(r[1]))).map((r) => [r[0], Number(r[1])]);
      if (rows.length) { out[id] = shapeSeries(rows, freq, keep); fails = 0; }
    } catch (e) {
      fails++;
      status.notes.push(`FRED ${id}: ${e.message}`);
    }
  });
  log(`fred: ${Object.keys(out).length}/${FRED.length}`);
  return out;
}

// Official fallbacks used when FRED is unreachable. Each fills the FRED id it stands in for.
async function fredFallbacks(have, treasuryRows) {
  const out = {};
  const missing = (id) => !have[id];
  // U.S. Treasury daily par yields -> DGS3MO, DGS2, DGS10, T10Y2Y
  if (treasuryRows && treasuryRows.length) {
    const col = (name) => treasuryRows.map((r) => [r.date, r.m[name]]).filter((x) => isNum(x[1])).sort((a, b) => (a[0] < b[0] ? -1 : 1));
    if (missing('DGS10')) out.DGS10 = shapeSeries(col('10 Yr'), 'd');
    if (missing('DGS2')) out.DGS2 = shapeSeries(col('2 Yr'), 'd');
    if (missing('DGS3MO')) out.DGS3MO = shapeSeries(col('3 Mo'), 'd');
    if (missing('T10Y2Y')) {
      const s = treasuryRows.filter((r) => isNum(r.m['10 Yr']) && isNum(r.m['2 Yr'])).map((r) => [r.date, sig(r.m['10 Yr'] - r.m['2 Yr'], 4)]).sort((a, b) => (a[0] < b[0] ? -1 : 1));
      out.T10Y2Y = shapeSeries(s, 'd');
    }
  }
  // New York Fed: effective fed funds rate with the FOMC target range
  if (missing('DFEDTARU') || missing('DFEDTARL')) {
    try {
      const j = await http('https://markets.newyorkfed.org/api/rates/unsecured/effr/last/1600.json', { retries: 2 });
      const rows = (j.refRates || []).filter((r) => isNum(r.targetRateTo)).map((r) => [r.effectiveDate, r.targetRateFrom, r.targetRateTo]).sort((a, b) => (a[0] < b[0] ? -1 : 1));
      if (rows.length) {
        out.DFEDTARU = shapeSeries(rows.map((r) => [r[0], r[2]]), 'd');
        out.DFEDTARL = shapeSeries(rows.map((r) => [r[0], r[1]]), 'd');
      }
    } catch (e) { status.notes.push('NY Fed EFFR: ' + e.message); }
  }
  // Freddie Mac Primary Mortgage Market Survey
  if (missing('MORTGAGE30US')) {
    try {
      const csv = await http('https://www.freddiemac.com/pmms/docs/PMMS_history.csv', { type: 'text', retries: 2 });
      const lines = csv.trim().split(/\r?\n/);
      const head = lines[0].toLowerCase().split(',');
      const di = head.findIndex((h) => h.includes('date'));
      const vi = head.findIndex((h) => h.trim() === 'pmms30');
      const rows = lines.slice(1).map((l) => l.split(',')).map((r) => {
        const d = r[di];
        const [m, dd, y] = d.includes('/') ? d.split('/') : [null, null, null];
        const iso = m ? `${y.length === 2 ? '20' + y : y}-${m.padStart(2, '0')}-${dd.padStart(2, '0')}` : d;
        return [iso, Number(r[vi])];
      }).filter((r) => isNum(r[1]) && /^\d{4}-\d{2}-\d{2}$/.test(r[0])).sort((a, b) => (a[0] < b[0] ? -1 : 1));
      if (rows.length) out.MORTGAGE30US = shapeSeries(rows, 'w', 280);
    } catch (e) { status.notes.push('Freddie Mac PMMS: ' + e.message); }
  }
  // Bureau of Labor Statistics public API (no key; 10 years per request)
  const bls = { CPIAUCSL: 'CUSR0000SA0', CPILFESL: 'CUSR0000SA0L1E', UNRATE: 'LNS14000000', PAYEMS: 'CES0000000001' };
  const want = Object.keys(bls).filter(missing);
  if (want.length) {
    try {
      const y = NOW.getUTCFullYear();
      const res = await fetch('https://api.bls.gov/publicAPI/v1/timeseries/data/', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'User-Agent': UA },
        body: JSON.stringify({ seriesid: want.map((k) => bls[k]), startyear: String(y - 9), endyear: String(y) }),
        signal: AbortSignal.timeout(30000)
      });
      const j = await res.json();
      for (const series of j?.Results?.series || []) {
        const fredId = Object.keys(bls).find((k) => bls[k] === series.seriesID);
        const rows = (series.data || []).filter((d) => /^M\d\d$/.test(d.period) && d.period !== 'M13' && isNum(Number(d.value)))
          .map((d) => [`${d.year}-${d.period.slice(1)}-01`, Number(d.value)]).sort((a, b) => (a[0] < b[0] ? -1 : 1));
        if (fredId && rows.length) out[fredId] = shapeSeries(rows, 'm', 150);
      }
    } catch (e) { status.notes.push('BLS: ' + e.message); }
  }
  return out;
}

// U.S. Treasury daily par yield curve, several years (also feeds the rate fallbacks above).
async function runTreasury(years = 6) {
  const y0 = NOW.getUTCFullYear();
  const toISO = (mdY) => { const [m, d, y] = mdY.split('/'); return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`; };
  const rows = [];
  let tenors = null;
  for (let y = y0; y > y0 - years; y--) {
    try {
      const url = `https://home.treasury.gov/resource-center/data-chart-center/interest-rates/daily-treasury-rates.csv/${y}/all?type=daily_treasury_yield_curve&field_tdr_date_value=${y}&page&_format=csv`;
      const csv = await http(url, { type: 'text', retries: 2 });
      const lines = csv.trim().split(/\r?\n/);
      const head = lines[0].split(',').map((h) => h.replace(/"/g, '').trim());
      if (!tenors && lines.length > 1) tenors = head.slice(1);
      for (const l of lines.slice(1)) {
        const r = l.split(',').map((x) => x.replace(/"/g, '').trim());
        if (!r[0] || !r[0].includes('/')) continue;
        const m = {};
        head.slice(1).forEach((h, i) => { const v = Number(r[i + 1]); if (r[i + 1] !== '' && isNum(v)) m[h] = v; });
        rows.push({ date: toISO(r[0]), m });
      }
    } catch (e) { status.notes.push(`Treasury ${y}: ${e.message}`); }
  }
  if (!rows.length || !tenors) { status.sources.curve = { ok: false }; return { rows: [], curve: null }; }
  rows.sort((a, b) => (a.date < b.date ? 1 : -1));
  const latest = rows[0];
  const pick = (daysAgo) => {
    const target = new Date(Date.parse(latest.date) - daysAgo * 86400000).toISOString().slice(0, 10);
    return rows.find((r) => r.date <= target) || null;
  };
  const asRow = (r) => r && { date: r.date, v: tenors.map((t) => (isNum(r.m[t]) ? r.m[t] : null)) };
  status.sources.curve = { ok: true, date: latest.date, days: rows.length };
  log(`treasury: ${rows.length} days, latest ${latest.date}`);
  return { rows, curve: { tenors, latest: asRow(latest), m1: asRow(pick(30)), y1: asRow(pick(365)), y2: asRow(pick(730)) } };
}

// ------------------------------------------------------------------ main
const args = process.argv.slice(2);
const hoursSinceHistory = await lastHistoryRun();
const doHistory = FORCE || hoursSinceHistory > 22 || (NOW.getUTCHours() >= 21 && hoursSinceHistory > 3);

if (args[0] === '--list-symbols') {
  const list = yahooAssets.map((a) => ({ id: a.id, y: ySym(a) }));
  const profiles = doHistory || !prevProfiles.p ? CATALOG.assets.filter((a) => a.c === 'stock' || a.c === 'etf').map((a) => a.id) : [];
  await fs.writeFile(args[1], JSON.stringify({ history: doHistory, profiles, symbols: list }));
  log(`symbol list: ${list.length} symbols, history ${doHistory}, profiles ${profiles.length}`);
  process.exit(0);
}

let Y = {};
if (args[0] === '--yahoo') {
  try { Y = JSON.parse(await fs.readFile(args[1], 'utf8')); } catch (e) { log('no yahoo file:', e.message); }
}
const yq = Y.quotes || {};
const yd = Y.intraday || {};
log(`history refresh: ${doHistory} (last ${isNum(hoursSinceHistory) ? hoursSinceHistory.toFixed(1) + 'h ago' : 'never'}); yahoo quotes in file: ${Object.keys(yq).length}`);

const quotes = {};
for (const a of yahooAssets) {
  const q = yq[a.id];
  if (!q || !isNum(q.p)) { status.missing.push(a.id); continue; }
  if (yd[a.id]) q.d = yd[a.id];
  if (!isNum(q.pc) && q.d && isNum(q.d.pc)) q.pc = q.d.pc;
  quotes[a.id] = q;
}
status.sources.yahoo = { ok: Object.keys(quotes).length, total: yahooAssets.length, intraday: Object.keys(yd).length, seconds: Y.seconds };

let histWritten = 0;
for (const [id, h] of Object.entries(Y.hist || {})) {
  if (!h || (!h.y?.length && !h.f?.length)) continue;
  await writeHistory(id, { asOf: NOW.toISOString(), src: 'Yahoo Finance', w: h.w || [], y: h.y || [], f: h.f || [], m: h.m || [] });
  histWritten++;
}
if (Y.history) status.sources.history = { ok: histWritten, total: yahooAssets.length };
log(`history files written from yahoo: ${histWritten}`);

const crypto = await runCrypto();
const sentiment = await runSentiment();

let historyAt = prevMarket?.status?.historyAt;
if (Y.history && histWritten > yahooAssets.length * 0.5) historyAt = NOW.toISOString();
if (doHistory) await runCryptoHistory(crypto.list || prevMarket.crypto?.list);

let nft = null;
if (doHistory || !prevMarket.nft) nft = await runNFTs();

let fred = null;
let curve = null;
if (doHistory || !prevMacro.fred) {
  const tr = await runTreasury(6);
  curve = tr.curve;
  fred = await runFred();
  Object.assign(fred, await fredFallbacks(fred, tr.rows));
  status.sources.fred = { ok: Object.keys(fred).length, total: FRED.length };
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

if (Object.keys(quotes).length === 0 && !crypto.list?.length) {
  console.error('No fresh data at all this run; leaving files untouched.');
  process.exit(1);
}

await writeGlobal(path.join(DATA, 'market.js'), 'INVEST_MARKET', market, { oneLinePerKeyOf: ['q'] });
if (fred || curve) {
  await writeGlobal(path.join(DATA, 'macro.js'), 'INVEST_MACRO', {
    updated: NOW.toISOString(),
    fred: { ...(prevMacro.fred || {}), ...(fred || {}) },
    curve: curve || prevMacro.curve || null
  }, { oneLinePerKeyOf: ['fred'] });
}
const profiles = Y.profiles || {};
if (Object.keys(profiles).length) {
  const merged = { ...(prevProfiles.p || {}), ...profiles };
  await writeGlobal(path.join(DATA, 'profiles.js'), 'INVEST_PROFILES', { updated: NOW.toISOString(), p: merged }, { oneLinePerKeyOf: ['p'] });
}
log('done', JSON.stringify(market.status.sources));
