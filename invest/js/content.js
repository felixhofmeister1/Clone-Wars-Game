/*
 * Researched, dated content for the Invest app.
 *
 * Everything with a number in it here was checked against the source listed
 * beside it (news reports, official releases, industry reports) in the week of
 * September 21-24, 2026. Live prices do NOT come from this file: they come from
 * invest/data/*.js (the scheduled pipeline) or live APIs. The `snap` block is
 * only a last-resort fallback shown with its date when no data file is present.
 */
(function (root) {
  'use strict';

  const S = {
    fedSep: { n: 'CNBC, Sep 16 2026', u: 'https://www.cnbc.com/2026/09/16/fed-rate-decision-september-2026.html' },
    fedCal: { n: 'Federal Reserve FOMC calendar', u: 'https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm' },
    warsh: { n: 'Federal Reserve, May 15 2026', u: 'https://www.federalreserve.gov/newsevents/pressreleases/other20260515a.htm' },
    street: { n: 'TheStreet, Sep 23 2026', u: 'https://www.thestreet.com/stock-market-today/stock-market-today-dow-jones-sp-500-nasdaq-updates-sept-23-2026' },
    cnnBonds: { n: 'CNN Business, Sep 23 2026', u: 'https://www.cnn.com/2026/09/23/investing/us-bond-market-fed' },
    fool27: { n: 'Motley Fool, Aug 26 2026', u: 'https://www.fool.com/investing/2026/08/26/the-sp-500-has-hit-27-record-highs-in-2026-heres-w/' },
    cpi: { n: 'CNBC, Sep 11 2026', u: 'https://www.cnbc.com/2026/09/11/cpi-inflation-report-august-2026.html' },
    jobs: { n: 'CNBC, Sep 4 2026', u: 'https://www.cnbc.com/2026/09/04/jobs-report-august-2026.html' },
    gdp: { n: 'BEA, Aug 26 2026', u: 'https://www.bea.gov/news/2026/gdp-second-estimate-and-corporate-profits-2nd-quarter-2026' },
    oil: { n: 'Trading Economics', u: 'https://tradingeconomics.com/commodity/brent-crude-oil' },
    iranWar: { n: 'Wikipedia: 2026 Iran war', u: 'https://en.wikipedia.org/wiki/2026_Iran_war' },
    iranTalks: { n: 'The National, Sep 23 2026', u: 'https://www.thenationalnews.com/news/mena/2026/09/23/iran-us-meeting-new-york/' },
    xi: { n: 'CNBC, Sep 21 2026', u: 'https://www.cnbc.com/2026/09/21/trump-xi-china-summit-trade-tariffs.html' },
    xiTariff: { n: 'Bloomberg, Sep 17 2026', u: 'https://www.bloomberg.com/news/articles/2026-09-17/us-said-to-delay-excess-capacity-tariffs-until-after-xi-summit' },
    spacex: { n: 'CNBC, Jun 12 2026', u: 'https://www.cnbc.com/2026/06/12/spacex-ipo-spcx-live-updates.html' },
    spacexAI: { n: 'Wikipedia: xAI', u: 'https://en.wikipedia.org/wiki/XAI_(company)' },
    cerebras: { n: 'CNBC, May 14 2026', u: 'https://www.cnbc.com/2026/05/14/cerebras-cbrs-stock-trade-nasdaq-ipo.html' },
    fervo: { n: 'Fervo Energy press release', u: 'https://fervoenergy.com/fervo-energy-announces-pricing-of-its-upsized-initial-public-offering/' },
    ipoQ2: { n: 'Dealroom (Renaissance Capital data)', u: 'https://dealroom.net/blog/upcoming-recent-ipos' },
    btc: { n: 'Fortune, Sep 23 2026', u: 'https://fortune.com/article/price-of-bitcoin-09-23-2026/' },
    btcAth: { n: 'Yahoo Finance', u: 'https://finance.yahoo.com/news/bitcoin-price-surges-time-high-053751894.html' },
    clarity: { n: 'DeFi Rate CLARITY Act tracker', u: 'https://defirate.com/clarity-act-fact-sheet/' },
    genius: { n: 'Latham & Watkins crypto policy tracker', u: 'https://www.lw.com/en/us-crypto-policy-tracker/legislative-developments' },
    gold: { n: 'USAGOLD, Sep 23 2026', u: 'https://www.usagold.com/daily-precious-metals-market-report-september-23-2026/' },
    fx: { n: 'FOREX.com, Sep 23 2026', u: 'https://www.forex.com/en-us/news-and-analysis/euro-short-term-outlook-eur-usd-selloff-nears-critical-yearly-support-9-23-2026/' },
    mortgage: { n: 'Freddie Mac PMMS, Sep 17 2026', u: 'https://www.globenewswire.com/news-release/2026/09/17/3364253/0/en/mortgage-rates-average-6-95.html' },
    nar: { n: 'NAR, Sep 10 2026', u: 'https://www.globenewswire.com/news-release/2026/09/10/3359670/0/en/nar-existing-home-sales-report-shows-2-0-decrease-in-august.html' },
    irs: { n: 'IRS', u: 'https://www.irs.gov/newsroom/401k-limit-increases-to-24500-for-2026-ira-limit-increases-to-7500' },
    ibond: { n: 'TreasuryDirect, May 1 2026', u: 'https://www.treasurydirect.gov/news/2026/release-05-01-rates/' },
    hysa: { n: 'CNBC Select, Sep 2026', u: 'https://www.cnbc.com/select/best-high-yield-savings-accounts/' },
    artBasel: { n: 'Art Basel & UBS Art Market Report 2026', u: 'https://www.artbasel.com/stories/the-art-basel-and-ubs-global-art-market-report-2026?lang=en' },
    klimt: { n: 'Sotheby\'s, Nov 2025', u: 'https://www.sothebys.com/en/articles/the-new-york-sales-november-2025-breuer-results' },
    may26: { n: 'Artnet News, May 2026', u: 'https://news.artnet.com/market/christies-1-1-billion-sales-by-the-numbers-2774455' },
    robb: { n: 'Robb Report, 2026', u: 'https://robbreport.com/shelter/art-collectibles/lists/most-expensive-art-auctions-1238379022/' },
    kf: { n: 'Knight Frank Wealth Report 2026', u: 'https://www.knightfrank.com/research/article/2026/4/knight-frank-luxury-investment-index-luxury-holds-steady' },
    livex: { n: 'Liv-ex, Q1 2026', u: 'https://www.liv-ex.com/the-fine-wine-market-in-q1-2026/' },
    pikachu: { n: 'CNN, Feb 16 2026', u: 'https://www.cnn.com/2026/02/16/americas/pokemon-card-logan-paul-record-auction-intl-hnk' },
    superman: { n: 'Heritage Auctions, Nov 2025', u: 'https://comics.ha.com/heritage-auctions-press-releases-and-news/-superman-no.-1-leaps-to-9.12-million-at-heritage-becomes-most-expensive-comic-ever-sold.s?releaseId=5346' },
    nftApr: { n: 'CoinDesk, Apr 27 2026', u: 'https://www.coindesk.com/markets/2026/04/27/pudgy-penguins-bayc-rally-masks-a-shrinking-nft-market-as-volumes-and-users-fall' },
    anthropic: { n: 'TechCrunch, May 28 2026', u: 'https://techcrunch.com/2026/05/28/anthropic-raises-65-billion-nears-1t-valuation-ahead-of-ipo/' },
    openai: { n: 'SmartAsset (OpenAI IPO tracker)', u: 'https://smartasset.com/investing/openai-stock-ipo' },
    ipoWatch: { n: 'U.S. News, IPOs 2026', u: 'https://money.usnews.com/investing/articles/new-and-upcoming-ipos-in-2026' }
  };

  // ----------------------------------------------------------- Market brief
  const brief = {
    date: '2026-09-24',
    title: 'What is moving markets',
    items: [
      {
        h: 'The Fed hiked for the first time since 2023',
        t: 'On September 16 the FOMC voted 12-0 to raise the federal funds target range by a quarter point to 3.75%-4.00%, saying inflation "remains elevated" as oil prices climbed. Its projections left room for another increase this year. Kevin Warsh has chaired the Fed since May 22, when he succeeded Jerome Powell. The next decisions are due October 28 and December 9.',
        src: [S.fedSep, S.warsh, S.fedCal]
      },
      {
        h: 'Treasury yields are at 19-year highs',
        t: 'The 10-year yield jumped 15 basis points to 5.11% on September 23, its highest level since 2007; the 30-year reached 5.4% and the 5-year crossed 5% for the first time since 2007. The average 30-year mortgage rate rose to 6.95% in Freddie Mac\'s September 17 survey.',
        src: [S.cnnBonds, S.street, S.mortgage]
      },
      {
        h: 'Stocks pulled back from record territory',
        t: 'The S&P 500 fell 0.75% to 7,706.03 on September 23, the Nasdaq Composite lost 1.13% to 26,936.04 and the Dow dropped 352 points to 51,511.59. The S&P 500 had set 27 record closes in 2026 through late August.',
        src: [S.street, S.fool27]
      },
      {
        h: 'An oil shock from the Iran war',
        t: 'Fighting that began with US and Israeli strikes on February 28 has restricted traffic through the Strait of Hormuz; the IEA calls it the largest supply disruption in the history of the oil market. Brent settled at $101.61 and WTI at $92.71 on September 23. At the UN this week Iran proposed a regional ceasefire of up to 60 days and a phased reopening of Hormuz.',
        src: [S.oil, S.iranWar, S.iranTalks]
      },
      {
        h: 'Inflation is stuck at 3.4%',
        t: 'Consumer prices rose 3.4% from a year earlier in August, driven by gasoline (+27.4%). Core inflation, which excludes food and energy, slowed to 2.4%, the lowest since March 2021. Employers added 162,000 jobs in August with unemployment at 4.1%, and GDP grew at a 1.5% annual rate in the second quarter.',
        src: [S.cpi, S.jobs, S.gdp]
      },
      {
        h: 'Trump and Xi meet in Washington',
        t: 'Xi Jinping arrived on September 23 for a one-day summit on the 24th covering trade, AI, critical minerals, the Iran war and Taiwan. The US held back a planned "excess capacity" tariff report until after the meeting, and a reciprocal tariff-cut framework worth about $30 billion was reported to be under discussion.',
        src: [S.xi, S.xiTariff]
      },
      {
        h: 'The year of the mega-IPO',
        t: 'SpaceX listed on Nasdaq as SPCX on June 12 at $135 a share, raising about $75 billion, the largest IPO ever. Cerebras (CBRS) and Fervo Energy (FRVO) debuted in May. The second quarter was the biggest on record for US IPO proceeds ($104.8 billion). OpenAI and Anthropic have both filed confidentially for listings.',
        src: [S.spacex, S.cerebras, S.fervo, S.ipoQ2]
      },
      {
        h: 'Crypto is recovering, but far below its peak',
        t: 'Bitcoin traded around $84,000-$86,000 on September 23, about a third below its October 6, 2025 record near $126,000, and roughly $26,000 lower than a year earlier. In Washington, the CLARITY Act for crypto market structure stalled on September 15 when a Senate cloture vote failed 49-50.',
        src: [S.btc, S.btcAth, S.clarity]
      },
      {
        h: 'Gold holds above $4,000; the dollar is firm',
        t: 'Gold slipped to about $4,300 an ounce and silver to about $65 on September 23 as the hawkish Fed lifted the dollar. The US Dollar Index was near 100.6, EUR/USD about 1.145 and USD/JPY about 157.5.',
        src: [S.gold, S.fx]
      }
    ]
  };

  // --------------------------------------------- Economy snapshot (fallback)
  const macro = [
    { k: 'Fed funds target', v: '3.75%-4.00%', d: 'Raised 0.25 pt on Sep 16, 2026', fred: 'DFEDTARU', src: S.fedSep },
    { k: 'CPI inflation', v: '3.4%', d: 'August 2026, year over year', fred: 'CPIAUCSL', src: S.cpi },
    { k: 'Core CPI', v: '2.4%', d: 'August 2026, lowest since March 2021', fred: 'CPILFESL', src: S.cpi },
    { k: 'Unemployment', v: '4.1%', d: 'August 2026', fred: 'UNRATE', src: S.jobs },
    { k: 'Payrolls', v: '+162K', d: 'Jobs added in August 2026', fred: 'PAYEMS', src: S.jobs },
    { k: 'Real GDP growth', v: '1.5%', d: 'Q2 2026, annualized (2nd estimate)', fred: 'A191RL1Q225SBEA', src: S.gdp },
    { k: '10-year Treasury', v: '5.11%', d: 'Sep 23, 2026, highest since 2007', fred: 'DGS10', src: S.cnnBonds },
    { k: '30-year mortgage', v: '6.95%', d: 'Freddie Mac, Sep 17, 2026', fred: 'MORTGAGE30US', src: S.mortgage },
    { k: 'Median home price', v: '$429,100', d: 'Existing homes, August 2026 (+1.6% y/y)', src: S.nar }
  ];

  // Last-resort quotes (Sep 23, 2026 close unless noted), used only when no data file is available.
  const snap = {
    date: '2026-09-23',
    q: {
      '^GSPC': { p: 7706.03, chp: -0.75, src: S.street },
      '^IXIC': { p: 26936.04, chp: -1.13, src: S.street },
      '^DJI': { p: 51511.59, ch: -352.10, chp: -0.68, src: S.street },
      '^TNX': { p: 5.11, src: S.cnnBonds },
      '^TYX': { p: 5.40, src: S.cnnBonds },
      'CL=F': { p: 92.71, chp: 2.42, src: S.oil },
      'BZ=F': { p: 101.61, chp: 2.37, src: S.oil },
      'GC=F': { p: 4304.11, src: S.gold, note: 'spot' },
      'SI=F': { p: 65.06, src: S.gold, note: 'spot' },
      'EURUSD=X': { p: 1.1446, src: S.fx },
      'JPY=X': { p: 157.5, src: S.fx },
      'DX-Y.NYB': { p: 100.6, src: S.fx },
      'c:bitcoin': { p: 84353, src: S.btc },
      'SPCX': { p: 148.36, src: S.spacex, note: 'Sep 23 price reported by Investing.com' }
    }
  };

  const calendar = [
    { d: '2026-09-24', h: 'Trump-Xi summit, Washington', t: 'Trade, tariffs, AI, critical minerals, Iran and Taiwan on the agenda.', src: S.xi },
    { d: '2026-10-28', h: 'FOMC rate decision', t: 'Two-day meeting Oct 27-28; statement at 2:00 PM ET.', src: S.fedCal },
    { d: '2026-11-01', h: 'New I bond rate', t: 'TreasuryDirect announces the November 2026 - April 2027 rate around this date.', src: S.ibond },
    { d: '2026-12-09', h: 'FOMC decision + projections', t: 'Final meeting of 2026 (Dec 8-9), with a new dot plot.', src: S.fedCal }
  ];

  // ---------------------------------------------------------------- Guides
  // risk: 1 (lowest) - 5 (highest); liq: how quickly you can sell at a fair price
  const guides = {
    stock: {
      intro: 'A share of stock is a small piece of ownership in a company. You profit when the company grows and its share price rises, and many companies also pay dividends out of profits.',
      risk: 4, liq: 'Very high (seconds, during market hours)', min: 'Price of one share, or $1 with fractional shares',
      ret: 'US stocks returned about 10% a year on average since 1926 including dividends (about 7% after inflation), with frequent drops of 20% or more along the way.',
      how: ['Open a brokerage account (Fidelity, Schwab, Vanguard, Robinhood and others offer $0 commissions on US stocks).', 'Search the ticker, choose a market order (fills now at the current price) or a limit order (fills only at your price or better).', 'Consider owning many companies at once through an index fund rather than a few individual stocks.'],
      pros: ['Highest long-run returns of the major asset classes', 'Instant liquidity and low costs', 'Dividends can provide income'],
      cons: ['Individual companies can fall 90% or go bankrupt', 'Bear markets can cut prices in half and take years to recover', 'Easy to overtrade'],
      costs: 'Usually $0 commissions at major US brokers; watch bid-ask spreads on small stocks and foreign-transaction fees on international shares.',
      tax: 'In the US, gains on shares held over one year are taxed at long-term capital-gains rates (0%, 15% or 20%); under a year, as ordinary income. Qualified dividends get the lower rates.'
    },
    etf: {
      intro: 'An exchange-traded fund holds a basket of assets (stocks, bonds, gold, bitcoin) and trades on an exchange like a single stock. Index ETFs simply track a benchmark such as the S&P 500 at very low cost.',
      risk: 3, liq: 'Very high', min: 'One share, or $1 with fractional shares',
      ret: 'An index ETF earns the return of its index minus a small fee. Broad US stock ETFs have matched the market\'s roughly 10% long-run average; bond and cash ETFs earn far less but fluctuate less.',
      how: ['Pick the exposure you want (total market, S&P 500, international, bonds).', 'Compare expense ratios; broad index funds can cost 0.03% a year or less.', 'Buy through any brokerage and hold; reinvest distributions automatically if your broker allows.'],
      pros: ['Instant diversification', 'Very low fees for index funds', 'Tax-efficient compared with most mutual funds'],
      cons: ['Niche, leveraged and inverse ETFs can behave very differently from what their names suggest', 'Thematic funds often launch near a theme\'s peak'],
      costs: 'Expense ratio (annual %), deducted from the fund\'s value. Leveraged funds often charge 0.8%-1% and lose value in choppy markets.',
      tax: 'Same capital-gains rules as stocks. Bond-fund interest is taxed as ordinary income; municipal-bond fund interest is generally federally tax-free.'
    },
    crypto: {
      intro: 'Cryptocurrencies are digital assets secured by public blockchains. Bitcoin aims to be scarce digital money; Ethereum and similar networks run programmable applications; stablecoins track the dollar.',
      risk: 5, liq: 'High for large coins (trades 24/7); poor for small tokens', min: 'A few dollars',
      ret: 'Extremely volatile. Bitcoin has fallen more than 70% from a peak several times (including 2018 and 2022) and was about a third below its October 2025 record in September 2026. Most smaller tokens have lost nearly all of their value over time.',
      how: ['Buy through a regulated exchange (Coinbase, Kraken and others) or a brokerage, or get exposure through spot bitcoin and ether ETFs such as IBIT and ETHA.', 'For self-custody, use a hardware wallet and never share your seed phrase with anyone.', 'Size positions so a 50%-80% drop would not change your life.'],
      pros: ['24/7 global market', 'Bitcoin\'s supply is fixed at 21 million', 'Spot ETFs make it easy to hold in a regular or retirement account'],
      cons: ['Huge drawdowns', 'Hacks, scams and exchange failures (FTX, 2022)', 'Regulation still being written: the CLARITY Act stalled in the Senate in September 2026'],
      costs: 'Exchange fees and spreads (often 0.1%-1.5%, more on "simple" buy buttons), network fees, and ETF expense ratios of about 0.15%-0.25% for the large spot bitcoin funds.',
      tax: 'The IRS treats crypto as property: selling, swapping or spending it is a taxable event. Brokers report sales on Form 1099-DA starting with 2025 transactions.'
    },
    nft: {
      intro: 'Non-fungible tokens are unique blockchain tokens, usually representing digital art, profile-picture collections or in-game items. Prices are quoted as a collection\'s "floor", the cheapest item listed for sale.',
      risk: 5, liq: 'Low: a sale depends on finding a buyer for your specific item', min: 'The floor price of a collection',
      ret: 'The market peaked in 2021-2022 and most collections have lost 90% or more since. In 2026 activity kept shrinking (global NFT sales fell from $304 million in February to about $175 million in April) even as a few blue chips such as Pudgy Penguins rose.',
      how: ['Use a self-custody wallet and a major marketplace (OpenSea, Magic Eden, Blur).', 'Check the contract address and collection verification before buying.', 'Treat it as collecting, not investing: buy only what you like at a price you can lose.'],
      pros: ['Verifiable ownership and provenance', 'Some collections carry brand or cultural value'],
      cons: ['Thin, speculative markets and wash trading', 'Floor prices can collapse quickly', 'Royalties and marketplace fees', 'Phishing and wallet-drainer scams'],
      costs: 'Marketplace fees (often 0.5%-2.5%), optional creator royalties and blockchain gas fees.',
      tax: 'The IRS treats NFTs as property and may treat some as collectibles taxed at up to 28% on long-term gains.',
      srcNote: S.nftApr
    },
    index: {
      intro: 'An index measures a group of securities, for example the 500 large US companies in the S&P 500. You cannot buy an index directly, but you can buy a fund that tracks it.',
      risk: 3, liq: 'Via ETFs and index funds: very high', min: 'One share of a tracking ETF',
      ret: 'Index returns are the market\'s return. Index funds beat most actively managed funds over long periods because their costs are lower.',
      how: ['Pick a tracking fund: S&P 500 (VOO, IVV, SPY), Nasdaq-100 (QQQ, QQQM), total US market (VTI), world (VT).', 'Buy regularly and hold.'],
      pros: ['Broad diversification', 'Very low cost'], cons: ['You get the market\'s losses too', 'Cap-weighted indexes can become concentrated in a few giants'],
      costs: 'The tracking fund\'s expense ratio.', tax: 'See ETFs.'
    },
    commodity: {
      intro: 'Commodities are raw materials: metals, energy and crops. Prices are set in futures markets and driven by supply shocks, weather, the dollar and the business cycle.',
      risk: 4, liq: 'High through futures and ETFs; physical metal costs more to buy and sell', min: 'One ETF share; futures contracts are large',
      ret: 'Over long periods commodities have roughly kept pace with inflation, with long booms and busts. Gold has compounded at a high-single-digit annual rate since the US ended gold convertibility in 1971, when it was $35 an ounce.',
      how: ['Gold and silver: physically backed ETFs (GLD, IAU, SLV) or coins and bars from reputable dealers.', 'Oil, gas and grains: futures-based funds (USO, UNG, DBC) - read how "roll yield" affects returns.', 'Producers: miners and energy companies give leveraged exposure to prices.'],
      pros: ['Can hedge inflation and geopolitical shocks (as in 2026\'s oil spike)', 'Low correlation with stocks at times'],
      cons: ['No earnings or dividends', 'Futures roll costs can erode returns', 'Very volatile'],
      costs: 'ETF expense ratios (0.25%-0.9%), futures commissions, or dealer premiums of several percent on physical coins and bars.',
      tax: 'In the US, physically backed precious-metal ETFs and bullion are taxed as collectibles (up to 28% long-term). Futures follow the 60/40 rule.'
    },
    fx: {
      intro: 'Currencies trade in pairs. EUR/USD = 1.15 means one euro costs 1.15 dollars. Exchange rates respond to interest-rate differences, growth, trade balances and risk appetite.',
      risk: 4, liq: 'The deepest market in the world ($7.5 trillion a day in the BIS 2022 survey)', min: 'Small with a broker; spot travel money has wide spreads',
      ret: 'Currencies have no long-run expected return of their own; returns come from interest-rate differentials and price moves.',
      how: ['Most investors get currency exposure indirectly through international stocks and bonds.', 'Currency-hedged ETFs remove it; FX brokers offer direct (often leveraged) trading.'],
      pros: ['Diversifies a home-currency portfolio', 'Trades 24 hours on weekdays'], cons: ['Leverage makes retail FX trading very risky', 'Moves are hard to predict'],
      costs: 'Spreads, swap/rollover interest on leveraged positions.', tax: 'Complex; depends on the product (spot, futures, ETF). Consult a tax professional.'
    },
    rate: {
      intro: 'A bond is a loan to a government or company that pays interest and returns your principal at maturity. When interest rates rise, existing bond prices fall; the longer the maturity, the bigger the drop.',
      risk: 2, liq: 'High for Treasuries and bond ETFs', min: '$100 at TreasuryDirect; one share of a bond ETF',
      ret: 'US government bonds returned about 5%-6% a year since 1926; Treasury bills about 3%. With 10-year yields above 5% in September 2026, starting yields are the highest since 2007.',
      how: ['Treasuries: TreasuryDirect.gov or a brokerage (bills, notes, bonds, TIPS).', 'Funds: BND or AGG for the total market, SGOV or BIL for T-bills, TLT for long bonds, TIP for inflation protection.', 'Match maturity to when you need the money.'],
      pros: ['Predictable income', 'Treasuries are backed by the US government', 'Often rise when stocks crash (not always, e.g. 2022)'],
      cons: ['Long bonds can fall sharply when rates rise (TLT lost about 31% in 2022)', 'Inflation erodes fixed payments', 'Corporate bonds can default'],
      costs: 'Bond ETF expense ratios as low as 0.03%; buying individual Treasuries at auction is free at TreasuryDirect.',
      tax: 'Treasury interest is exempt from state and local income tax; municipal bond interest is generally exempt from federal tax.'
    }
  };

  // ------------------------------------------------------------ Real estate
  const realestate = {
    intro: 'Real estate earns rent and can appreciate. You can own it directly (a home or rental), through REITs that trade like stocks, or through private funds and crowdfunding platforms.',
    risk: 3,
    stats: [
      { k: 'Median existing-home price', v: '$429,100', d: 'August 2026, up 1.6% from a year earlier and the 38th straight annual gain', src: S.nar },
      { k: 'Existing-home sales', v: '3.98 million', d: 'Annual rate in August 2026, down 2.0% from July', src: S.nar },
      { k: 'Homes for sale', v: '1.62 million', d: 'Inventory in August 2026', src: S.nar },
      { k: '30-year mortgage rate', v: '6.95%', d: 'Freddie Mac average, Sep 17, 2026 - about a 20-month high', src: S.mortgage }
    ],
    ways: [
      ['REITs', 'Real-estate investment trusts own property and must pay out at least 90% of taxable income as dividends. Buy individual REITs or a fund such as VNQ.'],
      ['Your home', 'Builds equity as you pay down the mortgage; transaction costs (commissions, closing, moving) are typically 6%-10% of the price.'],
      ['Rental property', 'Income from rent minus mortgage, taxes, insurance, repairs and vacancies. Leverage magnifies gains and losses.'],
      ['Crowdfunding & private funds', 'Platforms pool money for properties or loans; usually illiquid for years and fees vary widely.'],
      ['Farmland & timber', 'Land that produces crops or wood; accessible through REITs such as FPI, LAND, WY and RYN.']
    ],
    metrics: [
      ['Cap rate', 'Net operating income / property price. A $500,000 building earning $30,000 net has a 6% cap rate.'],
      ['Cash-on-cash return', 'Annual pre-tax cash flow / cash you invested (down payment + costs).'],
      ['1% rule', 'A rough screen: monthly rent at least 1% of the purchase price. Rarely met in expensive markets.'],
      ['1031 exchange', 'US rule that lets investors defer capital-gains tax by reinvesting sale proceeds into another investment property.']
    ]
  };

  // -------------------------------------------------------------------- Art
  const art = {
    intro: 'Fine art is a real asset with no income, high transaction costs and a market dominated by a small number of very expensive works. Returns vary enormously by artist and period, and most works resell for less than their buyers paid after costs.',
    risk: 5,
    stats: [
      { k: 'Global art sales, 2025', v: '$59.6 billion', d: 'Up 4%, the first increase after two years of decline', src: S.artBasel },
      { k: 'Dealer sales', v: '$34.8 billion', d: 'Up 2% in 2025', src: S.artBasel },
      { k: 'Public auction sales', v: '$20.7 billion', d: 'Up 9% in 2025', src: S.artBasel },
      { k: 'May 2026 New York auctions', v: '$2.5 billion', d: 'Sotheby\'s, Christie\'s and Phillips, versus $1.3 billion in May 2025', src: S.may26 }
    ],
    records: [
      ['Salvator Mundi', 'Leonardo da Vinci (attributed)', 450.3, 'Christie\'s New York', 'Nov 2017'],
      ['Portrait of Elisabeth Lederer', 'Gustav Klimt', 236.4, 'Sotheby\'s New York', 'Nov 2025'],
      ['Shot Sage Blue Marilyn', 'Andy Warhol', 195.0, 'Christie\'s New York', 'May 2022'],
      ['Number 7A, 1948', 'Jackson Pollock', 181.2, 'Christie\'s New York', 'May 2026'],
      ['Les Femmes d\'Alger (Version "O")', 'Pablo Picasso', 179.4, 'Christie\'s New York', 'May 2015'],
      ['Nu couche', 'Amedeo Modigliani', 170.4, 'Christie\'s New York', 'Nov 2015'],
      ['Nu couche (sur le cote gauche)', 'Amedeo Modigliani', 157.2, 'Sotheby\'s New York', 'May 2018'],
      ['Les Poseuses, Ensemble (Petite version)', 'Georges Seurat', 149.2, 'Christie\'s New York', 'Nov 2022'],
      ['Three Studies of Lucian Freud', 'Francis Bacon', 142.4, 'Christie\'s New York', 'Nov 2013'],
      ['L\'homme au doigt (sculpture)', 'Alberto Giacometti', 141.3, 'Christie\'s New York', 'May 2015']
    ],
    recordsNote: 'Prices in millions of US dollars including buyer\'s premium, not adjusted for inflation.',
    recent: [
      { h: 'Klimt sets a modern-art record', t: 'Portrait of Elisabeth Lederer (1914-16) sold for $236.4 million at Sotheby\'s on November 18, 2025, from the collection of Leonard A. Lauder, making it the second most expensive artwork ever sold at auction.', src: S.klimt },
      { h: 'Pollock triples his record', t: 'Number 7A, 1948 sold for $181.2 million at Christie\'s New York in May 2026 from the S.I. Newhouse collection, the top lot of the year so far. Christie\'s realized more than $1.1 billion across two evening sales.', src: S.may26 },
      { h: 'Luxury holds steady', t: 'Knight Frank\'s Luxury Investment Index slipped just 0.4% in 2025 after falls of 2.7% in 2024 and 3.3% in 2023. Impressionist art was the strongest category (+13.6%).', src: S.kf }
    ],
    ways: [
      ['Galleries (primary market)', 'Buy new work directly from living artists\' dealers. Prices are set by the gallery; resale may be restricted.'],
      ['Auctions (secondary market)', 'Sotheby\'s, Christie\'s, Phillips, Bonhams, Heritage and many regional houses. Prices are public, but buyers pay a premium on top of the hammer price.'],
      ['Prints and editions', 'Signed, numbered editions by established artists cost far less than unique works and are easier to resell.'],
      ['Fractional platforms', 'Companies such as Masterworks sell SEC-qualified shares in individual paintings, charging annual and profit-share fees. Shares are illiquid.'],
      ['Art-market stocks', 'The big auction houses are privately owned, so there is no pure-play listed stock.']
    ],
    costs: 'Buyer\'s premiums at the major auction houses are tiered and commonly exceed 20% at lower price levels; sellers also pay commissions. Add insurance, storage, framing, shipping and authentication. A round trip can cost 30% or more.',
    tax: 'In the US, long-term gains on art are taxed as collectibles at up to 28%, plus state tax. Donating appreciated art to a museum can be deductible at fair market value, subject to rules.',
    risks: ['Illiquid: a sale can take months', 'Attribution, forgery and title risk', 'Values depend on taste and a small number of buyers', 'No income while you own it']
  };

  // ----------------------------------------------------------- Collectibles
  const collectibles = {
    intro: 'Collectibles are "passion assets": watches, wine, whisky, classic cars, trading cards, coins, handbags, comics and more. The best examples can appreciate strongly, but prices depend on condition, authenticity and fashion, and selling is slow and costly.',
    risk: 5,
    index: { k: 'Knight Frank Luxury Investment Index', v: '-0.4%', d: '2025, after -2.7% in 2024 and -3.3% in 2023', src: S.kf },
    cats: [
      {
        n: 'Watches', icon: 'watch',
        t: 'Rolex, Patek Philippe and Audemars Piguet dominate the resale market. Prices fell sharply from the 2022 peak and then stabilized; watches rose 5.1% in Knight Frank\'s 2025 index, led by Patek Philippe Nautilus and Aquanaut models.',
        how: 'Buy from authorized dealers or reputable resellers with authentication; keep box and papers. Chrono24, WatchBox and auction houses are the main secondary venues.',
        src: S.kf, stocks: ['CFR.SW', 'UHR.SW']
      },
      {
        n: 'Fine wine', icon: 'wine',
        t: 'The Liv-ex Fine Wine 100 fell close to 30% from its 2022 high before finding a floor in mid-2025. It then posted six consecutive monthly gains into early 2026, led by Italian wines, Champagne and older Bordeaux; the broader Liv-ex 1000 was roughly flat by June 2026.',
        how: 'Buy "in bond" (stored in a bonded warehouse, avoiding duty and VAT until delivery) through established merchants; provenance and storage conditions drive value.',
        src: S.livex
      },
      {
        n: 'Whisky', icon: 'whisky',
        t: 'Rare Scotch soared through 2022 and has corrected since as speculative cask and bottle buying unwound. The auction record is The Macallan 1926 (Valerio Adami label), which sold for GBP 2.1 million at Sotheby\'s London in November 2023.',
        how: 'Casks are especially risky: prices are opaque and some cask brokers have been fraudulent. Stick to known auction houses and distillery releases.'
      },
      {
        n: 'Classic cars', icon: 'car',
        t: 'The record is the 1955 Mercedes-Benz 300 SLR Uhlenhaut Coupe, sold privately through RM Sotheby\'s for EUR 135 million in May 2022. Values of mainstream classics have softened, while rare "halo" models remain in demand.',
        how: 'Use specialist inspections and marque experts; budget for storage, insurance and maintenance. Hagerty publishes valuation guides.',
        stocks: ['RACE', 'HGTY']
      },
      {
        n: 'Trading cards', icon: 'card',
        t: 'A PSA 10 Pikachu Illustrator card sold by Logan Paul fetched $16,492,000 at Goldin in February 2026, the most ever paid for any trading card; he had bought it in 2021 for $5.275 million. Grading (PSA, BGS, CGC, SGC) largely determines value.',
        how: 'Buy graded cards from reputable auction houses and marketplaces; population reports show how many exist at each grade.',
        src: S.pikachu, stocks: ['EBAY']
      },
      {
        n: 'Comics', icon: 'comic',
        t: 'A Superman #1 (1939) graded CGC 9.0, found in a California attic, sold for $9.12 million at Heritage on November 20, 2025, the most ever paid for a comic book, beating a $6 million Action Comics #1 from April 2024.',
        how: 'Golden Age keys in high grades are the blue chips; CGC grading and restoration disclosure are essential.',
        src: S.superman
      },
      {
        n: 'Handbags', icon: 'bag',
        t: 'Hermes Birkin and Kelly bags often resell above retail because supply is tightly controlled. The original Birkin made for Jane Birkin sold for EUR 8.6 million at Sotheby\'s Paris in July 2025, a record for a handbag.',
        how: 'Condition, color, leather and hardware drive prices; authenticate through the auction house or an expert.',
        stocks: ['RMS.PA', 'MC.PA']
      },
      {
        n: 'Coins & stamps', icon: 'coin',
        t: 'The 1933 Double Eagle gold coin sold for $18.9 million and the British Guiana One-Cent Magenta stamp for $8.3 million, both at Sotheby\'s in June 2021. Bullion coins trade near the metal price; numismatic coins depend on rarity and grade (PCGS, NGC).',
        how: 'Separate bullion (buy near spot from large dealers) from rare coins (buy graded coins from specialists).'
      },
      {
        n: 'Sports memorabilia', icon: 'trophy',
        t: 'Babe Ruth\'s "called shot" 1932 World Series jersey sold for $24.12 million at Heritage in August 2024, a record for sports memorabilia.',
        how: 'Photo-matching and letters of authenticity from recognized services are critical.'
      },
      {
        n: 'Rare books & manuscripts', icon: 'book',
        t: 'The Codex Sassoon, one of the oldest near-complete Hebrew Bibles, sold for $38.1 million at Sotheby\'s New York in May 2023, the most ever for a book or manuscript at auction.',
        how: 'First editions, signed copies and condition matter; buy from ABAA/ILAB members or major houses.'
      },
      {
        n: 'Colored diamonds & jewelry', icon: 'gem',
        t: 'The 59.60-carat Pink Star diamond sold for $71.2 million at Sotheby\'s Hong Kong in April 2017, the auction record for a gemstone.',
        how: 'Only exceptional, certified (GIA) stones have held value; retail jewelry typically resells far below its purchase price.'
      }
    ],
    costs: 'Expect buyer\'s and seller\'s premiums, authentication and grading fees, insurance, and specialist storage (climate-controlled for wine, cards and comics). Dealer spreads are wide.',
    tax: 'US long-term gains on collectibles are taxed at up to 28%. Collectibles cannot be held in an IRA (US-minted gold and silver coins and certain bullion are exceptions).'
  };

  // --------------------------------------------------------- Private markets
  const priv = {
    intro: 'The most valuable startups now stay private for many years. Most investors can only reach them through funds, secondary platforms or the IPO itself. Valuations below are from the latest reported funding rounds or share sales, not live prices.',
    companies: [
      { n: 'Anthropic', v: 965e9, d: 'May 2026', t: 'AI lab behind the Claude models. Raised $65 billion in a Series H round at a $965 billion post-money valuation; reportedly filed a confidential draft IPO registration in June 2026.', src: S.anthropic },
      { n: 'OpenAI', v: 852e9, d: 'Mar 2026', t: 'Maker of ChatGPT. Closed a $122 billion round at an $852 billion post-money valuation on March 31, 2026, and filed confidentially for an IPO; its CFO told staff in August it will be public in 2027 or sooner.', src: S.openai },
      { n: 'ByteDance', v: null, d: '2026', t: 'Owner of TikTok and Douyin. Secondary-market valuation estimates range from roughly $330 billion to $480 billion depending on the source and date.', src: S.ipoWatch },
      { n: 'Stripe', v: 159e9, d: 'Feb 2026', t: 'Online payments infrastructure. Valued at $159 billion in a February 2026 employee tender offer; no IPO timeline confirmed.', src: S.ipoWatch },
      { n: 'Databricks', v: 134e9, d: 'Late 2025', t: 'Data and AI platform. Raised more than $4 billion at a $134 billion valuation (Series L).', src: S.ipoWatch },
      { n: 'Revolut', v: 75e9, d: '2025', t: 'European digital bank with tens of millions of customers, valued at $75 billion in a secondary share sale.', src: S.ipoWatch }
    ],
    ipos2026: [
      { s: 'SPCX', n: 'SpaceX', d: 'Jun 12, 2026', t: 'Priced at $135; closed its first day at $160.95 (+19%). Raised about $75 billion, the largest IPO in history. Acquired xAI in February 2026.', src: S.spacex },
      { s: 'CBRS', n: 'Cerebras Systems', d: 'May 14, 2026', t: 'Priced at $185 and raised $5.55 billion; rose about 68% on day one.', src: S.cerebras },
      { s: 'FRVO', n: 'Fervo Energy', d: 'May 13, 2026', t: 'Priced at $27 and raised $1.89 billion, the largest clean-energy IPO on record; closed day one at $36.54.', src: S.fervo }
    ],
    pipeline: 'Reported IPO candidates include Anthropic, OpenAI, Databricks, Discord (confidential filing, January 2026) and Kraken (confidential filing, November 2025).',
    ways: [
      ['Buy at or after the IPO', 'Most brokers let you request IPO shares; allocations for hot deals are small. You can always buy once trading starts.'],
      ['Secondary marketplaces', 'Platforms such as Forge Global, EquityZen and Hiive match accredited investors with employees selling shares. Minimums are high and trades can take weeks.'],
      ['Funds and listed vehicles', 'Some interval funds, closed-end funds and ETFs hold stakes in late-stage private companies; check fees and how holdings are valued.'],
      ['Listed parents and backers', 'Public companies with stakes in private firms, such as SoftBank (OpenAI), Amazon and Alphabet (Anthropic).']
    ],
    risks: ['Valuations are set in negotiated rounds, not by a market, and often include investor protections that ordinary shares lack', 'Shares are illiquid and transfer-restricted', 'Lock-ups usually stop insiders selling for about six months after an IPO']
  };

  // ----------------------------------------------------------- Cash & savings
  const cash = {
    intro: 'Cash is for safety and liquidity: emergency funds and money you need within a few years. Yields rose again after the Fed\'s September 2026 hike.',
    options: [
      { n: 'High-yield savings', v: 'up to ~4.2% APY', d: 'Top online banks, September 2026; the national average is far lower. FDIC-insured to $250,000 per depositor, per bank, per ownership category.', src: S.hysa },
      { n: 'Treasury bills', v: 'live', live: '^IRX', d: 'Short-term US government debt (4 to 52 weeks), bought at TreasuryDirect or a broker, or via T-bill ETFs such as SGOV and BIL. Exempt from state and local income tax.' },
      { n: 'Series I savings bonds', v: '4.26%', d: 'Rate for bonds bought May-October 2026: 0.90% fixed plus an inflation component. Up to $10,000 per person per year at TreasuryDirect; must be held at least 12 months, and you lose 3 months of interest if redeemed within 5 years.', src: S.ibond },
      { n: 'Money market funds', v: 'near T-bill rates', d: 'Funds holding T-bills, repos and short-term debt; yields move with the Fed. Not FDIC-insured, but government money funds have a strong safety record.' },
      { n: 'Certificates of deposit', v: 'varies', d: 'Lock in a rate for a fixed term (3 months to 5 years) with a penalty for early withdrawal. Brokered CDs can be sold before maturity at market prices.' },
      { n: 'TIPS', v: 'real yield', d: 'Treasury Inflation-Protected Securities: principal adjusts with CPI, and the yield is quoted above inflation.' }
    ],
    retirement: {
      h: '2026 retirement contribution limits (US)',
      rows: [['401(k), 403(b), 457, TSP', '$24,500'], ['Catch-up, age 50+', '$8,000'], ['Catch-up, ages 60-63', '$11,250'], ['IRA (Traditional or Roth)', '$7,500'], ['IRA catch-up, age 50+', '$1,100']],
      src: S.irs
    },
    rules: ['Keep 3-6 months of essential expenses in an emergency fund before investing for the long term.', 'Money you need within about 3 years generally belongs in cash or short-term bonds, not stocks.', 'Brokerage accounts are protected by SIPC up to $500,000 (including $250,000 cash) if the broker fails; SIPC does not protect against market losses.']
  };

  // ------------------------------------------------------------ Alternatives
  const alt = {
    intro: 'Alternatives are investments outside public stocks, bonds and cash. Many were once limited to institutions and the wealthy; listed vehicles now make several of them accessible, usually with higher fees and less liquidity.',
    items: [
      { n: 'Private credit', t: 'Loans to mid-sized private companies, often floating-rate. Accessible through business development companies (BDCs) such as Ares Capital (ARCC) or the BIZD ETF, and through interval funds.', stocks: ['ARCC', 'BIZD', 'APO', 'BX'] },
      { n: 'Private equity & venture', t: 'Buying whole companies or startup stakes, usually through funds with 10-year lives and minimums for accredited investors. Listed managers such as Blackstone, KKR and Apollo earn fees from these funds.', stocks: ['BX', 'KKR', 'APO'] },
      { n: 'Farmland', t: 'Earns crop or cash rent plus land appreciation, with low correlation to stocks. Public options: Farmland Partners (FPI) and Gladstone Land (LAND).', stocks: ['FPI', 'LAND'] },
      { n: 'Timberland', t: 'Trees grow regardless of markets; returns come from timber sales and land. Weyerhaeuser (WY), Rayonier (RYN) and the WOOD ETF.', stocks: ['WY', 'RYN', 'WOOD'] },
      { n: 'Carbon credits', t: 'Cap-and-trade allowances (EU, California, RGGI) whose prices depend on climate policy. KRBN holds a basket of carbon futures.', stocks: ['KRBN'] },
      { n: 'Infrastructure', t: 'Toll roads, pipelines, towers and data centers with long-term contracted cash flows. Listed via REITs such as AMT, EQIX and DLR and via utilities.', stocks: ['AMT', 'EQIX', 'DLR', 'NEE'] },
      { n: 'Royalties', t: 'Rights to a share of revenue from music catalogs, films, drug patents or mines. Sold through specialist marketplaces and funds; pricing is opaque.' },
      { n: 'Peer-to-peer & real-estate debt', t: 'Lending to individuals or property projects through online platforms. Returns look high until defaults arrive; money is usually locked up.' },
      { n: 'Prediction markets', t: 'Contracts that pay out based on real-world events (elections, rates, sports) on platforms such as Kalshi. They are closer to speculation than investing: the expected return before fees is roughly zero.' },
      { n: 'Hedge funds', t: 'Actively managed pools using leverage, short selling and derivatives. Typically limited to accredited investors, with fees that historically averaged "2 and 20".' }
    ]
  };

  // ------------------------------------------------------------------ Learn
  const learn = [
    {
      id: 'basics', h: 'Investing 101', sub: 'The ideas that matter most',
      body: [
        ['Start with the order of operations', 'Pay off high-interest debt, build an emergency fund, capture any employer 401(k) match, then invest for the long term. Investing money you might need next year forces you to sell at bad times.'],
        ['Compounding does the heavy lifting', '$500 a month invested at 7% a year grows to about $856,000 after 35 years, of which only $210,000 is money you put in. Starting ten years later (25 years of saving) leaves you with about $392,000.'],
        ['Diversify', 'Owning thousands of companies across countries through index funds removes the risk that one company\'s collapse sinks your plan. Diversification is the closest thing to a free lunch in finance.'],
        ['Keep costs low', 'A 1% annual fee sounds small but consumes roughly a quarter of your ending wealth over 30 years. Broad index funds cost as little as 0.03%.'],
        ['Match risk to time horizon', 'Stocks have delivered the highest returns but can fall 50% in a crisis. Money needed within a few years belongs in cash or short-term bonds.'],
        ['Automate and stay invested', 'Regular automatic contributions (dollar-cost averaging) remove the temptation to time the market. Missing a handful of the best days historically cut long-term returns sharply, and those days often come right after the worst ones.'],
        ['Rebalance', 'Once or twice a year, trim what has grown beyond its target weight and add to what has lagged. It keeps your risk level where you chose it.']
      ]
    },
    {
      id: 'orders', h: 'Placing orders', sub: 'Market, limit, stop and more',
      body: [
        ['Market order', 'Buys or sells immediately at the best available price. Fine for large, liquid stocks and ETFs during market hours; risky in thin markets or at the open.'],
        ['Limit order', 'Executes only at your price or better. A buy limit at $100 fills at $100 or less; it may never fill.'],
        ['Stop order', 'Becomes a market order once the price hits your stop. Used to limit losses, but in a fast drop it can fill well below the stop.'],
        ['Stop-limit order', 'Becomes a limit order at the stop price, avoiding bad fills but risking no fill at all.'],
        ['Trailing stop', 'A stop that moves up with the price by a set amount or percentage.'],
        ['Time in force', '"Day" orders expire at the close; "GTC" (good-til-canceled) orders stay open, usually up to 60-90 days.'],
        ['Extended hours', 'Pre-market (from 4:00 AM ET) and after-hours (to 8:00 PM ET) sessions have fewer buyers and sellers and wider spreads; most brokers accept only limit orders then.']
      ]
    },
    {
      id: 'quote', h: 'Reading a quote', sub: 'What every number on a stock page means',
      body: [
        ['Price and change', 'The last trade, and how far it moved since the previous close in dollars and percent.'],
        ['Bid / ask', 'The highest price a buyer will pay and the lowest a seller will accept. The gap (spread) is a hidden trading cost.'],
        ['Volume', 'Shares traded today. Compare with average volume to spot unusual activity.'],
        ['Market cap', 'Share price times shares outstanding: what the market values the whole company at.'],
        ['P/E ratio', 'Price divided by the last 12 months\' earnings per share. A P/E of 25 means investors pay $25 for each $1 of annual profit. Forward P/E uses expected earnings.'],
        ['EPS', 'Earnings per share: net income divided by shares outstanding.'],
        ['Dividend yield', 'Annual dividends per share divided by the share price.'],
        ['Beta', 'How much a stock tends to move with the market. 1.0 moves in line; 1.5 is 50% more volatile; below 1 is steadier.'],
        ['52-week range', 'The lowest and highest prices over the past year.']
      ]
    },
    {
      id: 'bonds', h: 'Bonds and interest rates', sub: 'Why prices fall when yields rise',
      body: [
        ['Price and yield move opposite', 'If you own a bond paying 3% and new bonds pay 5%, nobody pays full price for yours, so its price falls until its yield matches the market.'],
        ['Duration', 'A bond fund\'s duration estimates how much its price moves for a 1-point change in rates. A duration of 17 (long Treasuries) means about a 17% drop if rates rise 1 point.'],
        ['The yield curve', 'Plots yields from short to long maturities. Normally long rates are higher; an "inverted" curve (short above long) has preceded many recessions.'],
        ['Credit risk', 'Corporate and "high-yield" bonds pay more than Treasuries to compensate for the chance of default. The extra yield is the credit spread.'],
        ['Real yield', 'The yield after inflation. TIPS quote it directly.']
      ]
    },
    {
      id: 'cryptosafety', h: 'Crypto safety', sub: 'Protect yourself from the most common losses',
      body: [
        ['Not your keys, not your coins', 'On an exchange you hold an IOU. Exchanges have failed (Mt. Gox 2014, FTX 2022). Move long-term holdings to a wallet you control, or use a regulated ETF.'],
        ['Guard the seed phrase', 'The 12 or 24 recovery words are your money. Write them on paper or metal, never type them into a website, and never share them. No real support agent will ever ask for them.'],
        ['Scams to know', 'Fake "support" accounts, romance and "pig-butchering" investment scams, airdrop links that drain wallets, and guaranteed-return schemes.'],
        ['Stablecoins are not bank deposits', 'Reserve-backed stablecoins (USDC, USDT) aim to hold $1, but they are not FDIC-insured. The US GENIUS Act of July 2025 set federal reserve and disclosure rules for payment stablecoins.']
      ]
    },
    {
      id: 'options', h: 'Options 101', sub: 'Calls, puts and why most buyers lose',
      body: [
        ['Call option', 'The right to buy 100 shares at a set strike price before expiration. Profits if the stock rises above the strike plus the premium paid.'],
        ['Put option', 'The right to sell 100 shares at the strike. Gains if the stock falls; often used as insurance.'],
        ['Time decay', 'Options lose value as expiration approaches if the stock does not move. Most short-dated options expire worthless.'],
        ['Implied volatility', 'The market\'s expectation of future movement, baked into the option price. It often collapses after earnings ("IV crush").'],
        ['Covered calls', 'Selling calls against shares you own earns income but caps your upside, the strategy behind funds like JEPI and JEPQ.']
      ]
    },
    {
      id: 'taxes', h: 'Taxes (US basics)', sub: 'General information, not tax advice',
      body: [
        ['Long vs short term', 'Assets held more than one year qualify for long-term capital-gains rates of 0%, 15% or 20%. Gains within a year are taxed as ordinary income.'],
        ['Collectibles', 'Art, coins, precious-metal ETFs and similar assets face a maximum 28% rate on long-term gains.'],
        ['Tax-advantaged accounts', '401(k)s and Traditional IRAs defer tax until withdrawal; Roth accounts are funded with after-tax money and grow tax-free. 2026 limits: $24,500 for a 401(k) and $7,500 for an IRA.'],
        ['Tax-loss harvesting', 'Selling investments at a loss offsets gains and up to $3,000 of ordinary income a year. The wash-sale rule disallows the loss if you buy a substantially identical security within 30 days before or after.'],
        ['Crypto', 'Treated as property: each sale, swap or purchase with crypto is a taxable event.']
      ]
    },
    {
      id: 'allocation', h: 'Sample allocations', sub: 'Illustrations, not recommendations',
      body: [
        ['Three-fund portfolio', 'US total market (VTI), international (VXUS) and US bonds (BND). A 30-year-old might hold 60/30/10; someone near retirement might hold 30/20/50.'],
        ['Target-date funds', 'One fund that holds a stock/bond mix and becomes more conservative as its target year approaches.'],
        ['Satellite positions', 'Many investors keep speculative assets (individual stocks, crypto, collectibles) to a small slice, such as 5%-10% of the portfolio, so a total loss is survivable.']
      ]
    }
  ];

  // --------------------------------------------------------------- Glossary
  const glossary = [
    ['52-week high/low', 'The highest and lowest prices over the last year.'],
    ['Accredited investor', 'US investor meeting income ($200,000; $300,000 with a spouse) or net-worth ($1 million excluding a primary home) tests, or holding certain licenses; allowed into private offerings.'],
    ['ADR', 'American Depositary Receipt: a US-traded certificate representing shares of a foreign company.'],
    ['All-time high (ATH)', 'The highest price an asset has ever traded at.'],
    ['Alpha', 'Return above what a benchmark or risk model predicts.'],
    ['Altcoin', 'Any cryptocurrency other than bitcoin.'],
    ['Annualized return', 'The yearly rate that compounds to the total return over a period (CAGR).'],
    ['APY', 'Annual percentage yield: interest including compounding.'],
    ['Ask', 'The lowest price a seller will accept.'],
    ['Asset allocation', 'How a portfolio is split among stocks, bonds, cash and other assets.'],
    ['AUM', 'Assets under management: the total value a fund or manager oversees.'],
    ['Basis point (bp)', 'One hundredth of a percentage point: 0.25% = 25 bp.'],
    ['Bear market', 'A decline of 20% or more from a recent high.'],
    ['Beta', 'Sensitivity of an asset to market moves; the market has a beta of 1.'],
    ['Bid', 'The highest price a buyer will pay.'],
    ['Blockchain', 'A shared, append-only ledger maintained by a network of computers.'],
    ['Blue chip', 'A large, established, financially sound company - or a top NFT collection.'],
    ['Bond', 'A loan to a government or company that pays interest and returns principal at maturity.'],
    ['Book value', 'Assets minus liabilities as recorded on the balance sheet.'],
    ['Broker', 'A firm that executes trades for you and holds your investments.'],
    ['Bull market', 'A sustained rise in prices, commonly 20%+ from a low.'],
    ['Buyer\'s premium', 'Fee added to the hammer price at auction.'],
    ['CAGR', 'Compound annual growth rate.'],
    ['Capital gain', 'Profit from selling an asset for more than you paid.'],
    ['Cap rate', 'Net operating income divided by a property\'s price.'],
    ['CD', 'Certificate of deposit: a bank deposit locked for a fixed term at a fixed rate.'],
    ['Circulating supply', 'Coins currently available on the market.'],
    ['Cold wallet', 'A crypto wallet kept offline, such as a hardware device.'],
    ['Commodity', 'A raw material traded in standardized form, such as oil, gold or wheat.'],
    ['Compound interest', 'Earning returns on previous returns.'],
    ['Contango', 'When later-dated futures cost more than near-dated ones; causes losses for funds that roll futures.'],
    ['Correction', 'A decline of 10%-20% from a recent high.'],
    ['Coupon', 'A bond\'s annual interest payment as a percentage of face value.'],
    ['CPI', 'Consumer Price Index: the main US inflation measure.'],
    ['Custody', 'Safekeeping of assets by a broker, bank or yourself.'],
    ['Day order', 'An order that expires if not filled by the end of the trading day.'],
    ['DeFi', 'Decentralized finance: lending, trading and other services run by smart contracts.'],
    ['Diversification', 'Spreading money across many investments to reduce risk.'],
    ['Dividend', 'A cash payment from a company\'s profits to shareholders.'],
    ['Dividend yield', 'Annual dividends divided by price.'],
    ['Dollar-cost averaging', 'Investing a fixed amount at regular intervals regardless of price.'],
    ['Drawdown', 'The decline from a peak to a later low.'],
    ['Duration', 'A bond\'s price sensitivity to interest-rate changes, in years.'],
    ['Earnings per share (EPS)', 'Net income divided by shares outstanding.'],
    ['EBITDA', 'Earnings before interest, taxes, depreciation and amortization.'],
    ['Emerging markets', 'Developing economies such as India, Brazil and Indonesia.'],
    ['ETF', 'Exchange-traded fund: a basket of assets trading like a single stock.'],
    ['Ex-dividend date', 'Buy before this date to receive the next dividend.'],
    ['Expense ratio', 'A fund\'s annual cost as a percentage of assets.'],
    ['Fed funds rate', 'The overnight rate banks charge each other, targeted by the Federal Reserve.'],
    ['Fiduciary', 'An adviser legally required to act in your best interest.'],
    ['Float', 'Shares available for public trading.'],
    ['Floor price', 'The lowest listed price of any item in an NFT collection.'],
    ['FOMC', 'Federal Open Market Committee: the Fed body that sets interest-rate policy.'],
    ['Forward P/E', 'Price divided by expected earnings over the next 12 months.'],
    ['Fractional shares', 'Owning less than one full share.'],
    ['Fully diluted valuation (FDV)', 'A token\'s price times its maximum or total supply.'],
    ['Futures', 'Contracts to buy or sell an asset at a set price on a future date.'],
    ['Gas fee', 'Payment to process a transaction on a blockchain such as Ethereum.'],
    ['Growth stock', 'A company expected to grow faster than average, often at a high valuation.'],
    ['Halving', 'The roughly four-yearly cut in new bitcoin issuance.'],
    ['Hedge', 'An investment made to offset potential losses in another.'],
    ['Index fund', 'A fund that tracks a market index.'],
    ['Inflation', 'The general rise in prices, which reduces purchasing power.'],
    ['IPO', 'Initial public offering: a company\'s first sale of shares to the public.'],
    ['IRA', 'Individual Retirement Account (Traditional or Roth).'],
    ['Leverage', 'Using borrowed money or derivatives to magnify exposure.'],
    ['Limit order', 'An order to trade only at a specified price or better.'],
    ['Liquidity', 'How quickly an asset can be sold without moving its price.'],
    ['Lock-up period', 'Time after an IPO when insiders cannot sell.'],
    ['Margin', 'Borrowing from a broker to buy securities.'],
    ['Market cap', 'Share price times shares outstanding.'],
    ['Market order', 'An order to trade immediately at the best available price.'],
    ['Maturity', 'The date a bond repays its principal.'],
    ['Memecoin', 'A token driven mainly by internet culture and hype rather than utility.'],
    ['Money market fund', 'A fund holding very short-term, high-quality debt.'],
    ['Municipal bond', 'Debt issued by a US state or local government, often tax-exempt.'],
    ['Mutual fund', 'A pooled fund priced once a day at its net asset value.'],
    ['NAV', 'Net asset value: a fund\'s assets minus liabilities, per share.'],
    ['NFT', 'Non-fungible token: a unique token recording ownership on a blockchain.'],
    ['Options', 'Contracts giving the right to buy (call) or sell (put) at a set price.'],
    ['P/B ratio', 'Price divided by book value per share.'],
    ['P/E ratio', 'Price divided by earnings per share.'],
    ['Passive investing', 'Tracking an index instead of picking investments.'],
    ['Portfolio', 'All of your investments together.'],
    ['Pre-market', 'Trading before the regular session opens.'],
    ['Principal', 'The original amount invested or lent.'],
    ['Proof of stake', 'A blockchain security method where validators lock up coins.'],
    ['Proof of work', 'A blockchain security method where miners spend computing power.'],
    ['Real return', 'Return after subtracting inflation.'],
    ['Rebalancing', 'Restoring a portfolio to its target weights.'],
    ['Recession', 'A significant, widespread decline in economic activity.'],
    ['REIT', 'Real-estate investment trust: a company that owns property and pays out most income.'],
    ['Risk tolerance', 'How much volatility and loss you can accept.'],
    ['Roth IRA', 'Retirement account funded with after-tax money; qualified withdrawals are tax-free.'],
    ['S&P 500', 'Index of 500 leading US companies.'],
    ['Secondary market', 'Where investors trade existing securities among themselves.'],
    ['Seed phrase', 'The 12 or 24 words that restore a crypto wallet.'],
    ['Sharpe ratio', 'Excess return per unit of volatility.'],
    ['Short selling', 'Selling borrowed shares, hoping to buy them back cheaper.'],
    ['SIPC', 'Protects brokerage customers up to $500,000 if a member broker fails.'],
    ['Slippage', 'The difference between the expected and actual execution price.'],
    ['Spread', 'The gap between bid and ask, or between two yields.'],
    ['Stablecoin', 'A token designed to hold a steady value, usually $1.'],
    ['Stock split', 'Dividing each share into several, lowering the price per share without changing value.'],
    ['Stop-loss', 'An order to sell if the price falls to a set level.'],
    ['T-bill', 'US Treasury security maturing in one year or less.'],
    ['Target-date fund', 'A fund that grows more conservative as its target year approaches.'],
    ['Ticker', 'The short symbol identifying a security.'],
    ['TIPS', 'Treasury Inflation-Protected Securities.'],
    ['Total return', 'Price change plus dividends or interest.'],
    ['Treasury', 'Debt issued by the US government.'],
    ['Value stock', 'A company trading at a low price relative to earnings or assets.'],
    ['VIX', 'Index of expected S&P 500 volatility over the next 30 days.'],
    ['Volatility', 'How much and how quickly prices move.'],
    ['Volume', 'The number of shares or contracts traded.'],
    ['Wash sale', 'Buying a substantially identical security within 30 days of selling it at a loss; the loss is disallowed for tax.'],
    ['Yield', 'Income as a percentage of price.'],
    ['Yield curve', 'Yields plotted across maturities.']
  ];

  root.CONTENT = { S, brief, macro, snap, calendar, guides, realestate, art, collectibles, priv, cash, alt, learn, glossary };
})(typeof window !== 'undefined' ? window : globalThis);
