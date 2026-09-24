// Temporary: checks which public data sources answer from GitHub Actions runners.
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';
const tests = [
  ['stooq quote', 'https://stooq.com/q/l/?s=aapl.us,^spx,gc.f,eurusd,10usy.b&f=sd2t2ohlcvn&h&e=csv'],
  ['stooq hist', 'https://stooq.com/q/d/l/?s=aapl.us&i=d'],
  ['cnbc quote', 'https://quote.cnbc.com/quote-html-webservice/restQuote/symbolType/symbol?symbols=AAPL|.SPX|@GC.1|EUR=|US10Y|.VIX&requestMethod=itv&noform=1&partnerId=2&fund=1&exthrs=1&output=json&events=1'],
  ['cnbc chart 1Y', 'https://ts-api.cnbc.com/harmony/app/charts/1Y.json?symbol=AAPL'],
  ['cnbc chart 1D', 'https://ts-api.cnbc.com/harmony/app/charts/1D.json?symbol=.SPX'],
  ['nasdaq info', 'https://api.nasdaq.com/api/quote/AAPL/info?assetclass=stocks', { Accept: 'application/json', Origin: 'https://www.nasdaq.com', Referer: 'https://www.nasdaq.com/' }],
  ['nasdaq hist', 'https://api.nasdaq.com/api/quote/AAPL/historical?assetclass=stocks&fromdate=2025-09-24&limit=400&todate=2026-09-24', { Accept: 'application/json', Origin: 'https://www.nasdaq.com', Referer: 'https://www.nasdaq.com/' }],
  ['yahoo chart q1', 'https://query1.finance.yahoo.com/v8/finance/chart/AAPL?range=1d&interval=5m'],
  ['yahoo chart q2', 'https://query2.finance.yahoo.com/v8/finance/chart/AAPL?range=1d&interval=5m'],
  ['fred', 'https://fred.stlouisfed.org/graph/fredgraph.csv?id=UNRATE&cosd=2025-01-01'],
  ['treasury', 'https://home.treasury.gov/resource-center/data-chart-center/interest-rates/daily-treasury-rates.csv/2026/all?type=daily_treasury_yield_curve&field_tdr_date_value=2026&page&_format=csv'],
  ['cnn fng', 'https://production.dataviz.cnn.io/index/fearandgreed/graphdata/2026-09-24', { Referer: 'https://www.cnn.com/', Origin: 'https://www.cnn.com' }],
  ['alt.me', 'https://api.alternative.me/fng/?limit=2'],
  ['cg nft contract', 'https://api.coingecko.com/api/v3/nfts/ethereum/contract/0xbd3531da5cf5857e7cfaa92426877b022e612cf8'],
  ['cg nft list', 'https://api.coingecko.com/api/v3/nfts/list?order=market_cap_usd_desc&per_page=5&page=1'],
  ['frankfurter', 'https://api.frankfurter.dev/v1/latest?base=USD']
];
for (const [name, url, h] of tests) {
  const t0 = Date.now();
  try {
    const r = await fetch(url, { headers: { 'User-Agent': UA, Accept: '*/*', ...(h || {}) }, signal: AbortSignal.timeout(20000) });
    const txt = await r.text();
    console.log(`${name.padEnd(16)} ${r.status} ${Date.now() - t0}ms len=${txt.length} :: ${txt.slice(0, 260).replace(/\s+/g, ' ')}`);
  } catch (e) {
    console.log(`${name.padEnd(16)} ERR ${e.message} ${e.cause ? e.cause.code || e.cause.message : ''}`);
  }
  await new Promise((r) => setTimeout(r, 1500));
}
