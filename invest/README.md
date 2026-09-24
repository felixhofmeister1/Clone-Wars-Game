# Invest

An Apple-style investing app for the browser (installable on iPhone, Android and desktop) that
puts everything you can invest in into one place: stocks from around the world, ETFs and funds,
indices, bonds and interest rates, commodities, currencies, crypto, NFTs, real estate, art,
collectibles, private companies, cash and alternatives.

The interface is black, white and grey; color is used only for data (gains, losses and chart
series). Dark and light themes both follow the system setting.

## Run it

No build step. Serve the folder with any static server and open it:

```bash
cd invest
python3 -m http.server 8000     # then open http://localhost:8000
```

Opening `index.html` straight from the file system also works. To use it like a native app,
open it on your phone and choose **Add to Home Screen**.

## What's inside

| Tab | Features |
|-----|----------|
| **Markets** | Market status and world exchange clocks, ticker tape, major indices, movers, sector performance, commodities / rates / FX, crypto market and fear & greed gauges, economic snapshot, researched "what's moving markets" brief with sources, live heatmaps and headlines (TradingView) |
| **Explore** | Every asset class with its own page: filters, sorting, a plain-English guide (risk, liquidity, costs, US taxes). Art, collectibles, private markets, cash and alternatives have researched pages with records, market data and ways to invest |
| **Asset pages** | Live or delayed price with its source and time, interactive chart (1D to MAX; drag to scrub, click-drag or two fingers to measure a range), compare against any other asset, key statistics, 52-week and daily ranges, performance, company or fund profile, analyst targets, financials, ETF holdings and sector weights, crypto supply and all-time highs, NFT floors, technical rating and news, pro candlestick chart |
| **Watchlist** | Multiple lists, drag to reorder, sorting, sparklines, tap a pill to switch between % change, price change and market value |
| **Portfolio** | Track holdings of anything (including assets without a ticker), allocation donut, performance of current holdings, CSV / JSON export and restore; a $100,000 paper-trading account with market and limit orders at real prices |
| **More** | Economy dashboard (FRED, BLS, Treasury, NY Fed, Freddie Mac) and yield curve, 13 calculators (compound interest, DCA backtest on real history, retirement / FIRE, mortgage, CPI inflation, fee impact, dividends, savings goal, rule of 72, CAGR, position size, trade profit, crypto converter), guides, a glossary, price alerts, calendar, settings and a data-sources page |

Keyboard: `/` or `⌘K` search, `1`–`5` switch tabs, `Esc` closes sheets or goes back.

## Where the data comes from

Nothing in the app is invented. Every price and statistic shows its source and time.

* **Scheduled data job** – [`.github/workflows/invest-data.yml`](../.github/workflows/invest-data.yml)
  runs [`scripts/fetch_yahoo.py`](scripts/fetch_yahoo.py) and
  [`scripts/update-data.mjs`](scripts/update-data.mjs) three times each weekday and once a day on
  weekends. It writes `data/market.js` (quotes, intraday lines, crypto, NFTs, sentiment),
  `data/history/*.js` (5-day, 1-year, 5-year and full history), `data/profiles.js` (company and
  fund profiles) and `data/macro.js` (economy and the Treasury yield curve), then commits them.
  Sources: Yahoo Finance (through `yfinance`), CoinGecko, FRED with official fallbacks (BLS, U.S.
  Treasury, New York Fed, Freddie Mac), CNN Fear & Greed and alternative.me.
* **Live in the browser** – CoinGecko (top 100 crypto every 90 s), the Coinbase Exchange WebSocket
  (tick-by-tick crypto), Frankfurter / ECB exchange rates, and optionally Finnhub for real-time US
  stock trades (add a free key in Settings).
* **Newest copy from GitHub** – if the copy of the app you are using has older data files, it
  fetches the most recent `market.js` committed by the data job from GitHub.
* **Research** – [`js/content.js`](js/content.js) holds the dated brief, art market figures and
  auction records, collectibles, private-company valuations, cash rates, retirement limits and
  guides, each with a link to its source (checked September 21–24, 2026).

Run the data job yourself from the **Actions** tab ("Invest market data" → Run workflow). Scheduled
runs only happen on the repository's default branch. To stop the updates, disable that workflow.
Optional: add a repository secret `COINGECKO_DEMO_KEY` to raise CoinGecko rate limits.

## Files

```
index.html               App shell (sidebar on desktop, tab bar on phones)
css/app.css              Design system: tokens for dark/light, lists, pills, sheets, charts
js/catalog.js            The asset universe (symbols and stable facts only)
js/content.js            Researched, sourced content and guides
js/util.js               Formatting, time zones, market hours and holidays, icons
js/store.js              Local storage: watchlists, holdings, paper account, alerts, settings
js/data.js               Data layer: pipeline files, live feeds, quotes, chart series, FX
js/charts.js             SVG charts: price chart, sparkline, donut, bars, gauge, multi-line
js/tv.js                 TradingView embeds (pro chart, heatmaps, news, calendar)
js/ui.js                 Components: rows, pills, sheets, search, live ticker
js/views/*.js            Screens
js/app.js                Router, theme, navigation and boot
sw.js, manifest.webmanifest, icons/   Installable app and offline support
scripts/                 Data pipeline
data/                    Generated market data (committed by the workflow)
```

## Disclaimer

For information and education only. Not investment, tax or legal advice, and not a broker.
Market data can be delayed or wrong; check prices with your broker before trading.
