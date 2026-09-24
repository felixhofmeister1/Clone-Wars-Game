/*
 * Asset universe for the Invest app.
 *
 * Only stable facts live here (what a company does, where it is based, which
 * symbol it trades under). Prices, market caps, ratios, CEOs and anything else
 * that changes comes from the data pipeline (invest/scripts/update-data.mjs)
 * or from live APIs at runtime, never from this file.
 *
 * Field key:
 *   id   unique id; for exchange-traded assets it is the Yahoo Finance symbol
 *   s    display ticker          n   display name
 *   c    asset class id          g   group / sector
 *   d    one-paragraph description
 *   dom  company website domain (used for the logo)
 *   tv   TradingView symbol for the "Pro chart" (omitted when unsure)
 *   y    Yahoo symbol when it differs from id (crypto)
 *   cg   CoinGecko id (crypto)   cb  Coinbase product for live ticks
 *   cur  trading currency when not USD
 *   t    tags used by class pages (e.g. "reit", "ipo26", "metal")
 */
(function (root) {
  'use strict';

  const A = [];
  const add = (c, g, id, s, n, d, extra) => A.push(Object.assign({ id, s, n, c, g, d }, extra || {}));

  // ---------------------------------------------------------------- Indices
  const idx = (id, s, n, d, tv, extra) => add('index', 'Index', id, s, n, d, Object.assign({ tv }, extra || {}));
  idx('^GSPC', 'SPX', 'S&P 500', 'Market-cap-weighted index of 500 leading US companies, maintained by S&P Dow Jones Indices. The most widely used benchmark for US large-cap stocks.', 'FOREXCOM:SPXUSD', { t: ['us', 'major'] });
  idx('^IXIC', 'COMP', 'Nasdaq Composite', 'Market-cap-weighted index of nearly all common stocks listed on the Nasdaq Stock Market, heavily tilted toward technology.', 'NASDAQ:IXIC', { t: ['us', 'major'] });
  idx('^DJI', 'DJI', 'Dow Jones Industrial Average', 'Price-weighted index of 30 large, well-known US companies. Created in 1896, it is one of the oldest stock indices.', 'FOREXCOM:DJI', { t: ['us', 'major'] });
  idx('^RUT', 'RUT', 'Russell 2000', 'Index of roughly 2,000 small-cap US companies, the standard gauge for US small caps.', null, { t: ['us', 'major'] });
  idx('^NDX', 'NDX', 'Nasdaq-100', 'The 100 largest non-financial companies listed on Nasdaq. Tracked by the QQQ and QQQM ETFs.', 'FOREXCOM:NSXUSD', { t: ['us'] });
  idx('^VIX', 'VIX', 'Cboe Volatility Index', 'The market\'s expectation of S&P 500 volatility over the next 30 days, derived from option prices. Often called the "fear gauge"; readings above 30 signal stress.', 'TVC:VIX', { t: ['us', 'major'] });
  idx('^FTSE', 'UKX', 'FTSE 100', 'The 100 largest companies listed on the London Stock Exchange.', 'FOREXCOM:UKXGBP', { cur: 'GBP', t: ['europe'] });
  idx('^GDAXI', 'DAX', 'DAX', 'Germany\'s 40 largest companies on the Frankfurt Stock Exchange (a total-return index).', 'INDEX:DEU40', { cur: 'EUR', t: ['europe'] });
  idx('^FCHI', 'CAC', 'CAC 40', 'The 40 most significant stocks on Euronext Paris.', 'TVC:CAC40', { cur: 'EUR', t: ['europe'] });
  idx('^STOXX50E', 'SX5E', 'Euro Stoxx 50', 'Blue-chip index of 50 leading companies in the eurozone.', 'TVC:SX5E', { cur: 'EUR', t: ['europe'] });
  idx('^N225', 'NKY', 'Nikkei 225', 'Price-weighted index of 225 large companies on the Tokyo Stock Exchange.', 'INDEX:NKY', { cur: 'JPY', t: ['asia'] });
  idx('^HSI', 'HSI', 'Hang Seng Index', 'The main index of the Hong Kong stock market.', 'TVC:HSI', { cur: 'HKD', t: ['asia'] });
  idx('000001.SS', 'SHCOMP', 'Shanghai Composite', 'All A-shares and B-shares listed on the Shanghai Stock Exchange.', 'SSE:000001', { cur: 'CNY', t: ['asia'] });
  idx('^NSEI', 'NIFTY', 'Nifty 50', 'Fifty of the largest companies on India\'s National Stock Exchange.', 'NSE:NIFTY', { cur: 'INR', t: ['asia'] });
  idx('^BSESN', 'SENSEX', 'BSE Sensex', 'Thirty large, actively traded companies on the Bombay Stock Exchange.', 'BSE:SENSEX', { cur: 'INR', t: ['asia'] });
  idx('^KS11', 'KOSPI', 'KOSPI', 'Composite index of all common stocks on the Korea Exchange.', null, { cur: 'KRW', t: ['asia'] });
  idx('^TWII', 'TAIEX', 'Taiwan Weighted', 'Capitalization-weighted index of stocks on the Taiwan Stock Exchange, dominated by TSMC.', 'TWSE:TAIEX', { cur: 'TWD', t: ['asia'] });
  idx('^AXJO', 'XJO', 'S&P/ASX 200', 'The 200 largest companies on the Australian Securities Exchange.', 'ASX:XJO', { cur: 'AUD', t: ['asia'] });
  idx('^GSPTSE', 'TSX', 'S&P/TSX Composite', 'The benchmark index of the Toronto Stock Exchange.', 'TSX:TSX', { cur: 'CAD', t: ['americas'] });
  idx('^BVSP', 'IBOV', 'Ibovespa', 'The benchmark index of Brazil\'s B3 exchange.', 'BMFBOVESPA:IBOV', { cur: 'BRL', t: ['americas'] });

  // ----------------------------------------------------------------- Stocks
  const st = (g, id, n, dom, d, extra) => add('stock', g, id, id, n, d, Object.assign({ dom }, extra || {}));

  // Technology
  st('Technology', 'AAPL', 'Apple', 'apple.com', 'Designs the iPhone, Mac, iPad, Apple Watch and AirPods, and runs a fast-growing services business (App Store, iCloud, Apple Music, Apple Pay). Based in Cupertino, California.');
  st('Technology', 'MSFT', 'Microsoft', 'microsoft.com', 'Makes Windows and Microsoft 365, runs the Azure cloud platform, and owns LinkedIn, GitHub and Xbox. Based in Redmond, Washington.');
  st('Technology', 'NVDA', 'Nvidia', 'nvidia.com', 'Designs GPUs and full data-center systems that power most AI training and inference, plus the CUDA software platform. Also serves gaming, professional graphics and automotive. Based in Santa Clara, California.');
  st('Technology', 'GOOGL', 'Alphabet (Class A)', 'abc.xyz', 'Parent of Google Search, YouTube, Android, Chrome and Google Cloud, plus "Other Bets" such as Waymo. Class A shares carry voting rights; GOOG (Class C) does not. Based in Mountain View, California.');
  st('Technology', 'AMZN', 'Amazon', 'amazon.com', 'Runs the world\'s largest online store and Amazon Web Services (AWS), the largest cloud platform, along with a large advertising business and Prime Video. Based in Seattle.');
  st('Technology', 'META', 'Meta Platforms', 'meta.com', 'Owns Facebook, Instagram, WhatsApp, Messenger and Threads, and builds VR headsets and AI glasses through Reality Labs. Nearly all revenue comes from advertising. Based in Menlo Park, California.');
  st('Technology', 'AVGO', 'Broadcom', 'broadcom.com', 'Semiconductor and infrastructure-software company: custom AI accelerators and networking chips for hyperscalers, plus VMware virtualization software. Based in Palo Alto, California.');
  st('Technology', 'TSLA', 'Tesla', 'tesla.com', 'Makes electric vehicles and Megapack/Powerwall energy storage, and is developing self-driving robotaxis and humanoid robots. Based in Austin, Texas.', { g: 'Consumer' });
  st('Technology', 'ORCL', 'Oracle', 'oracle.com', 'Enterprise database and applications vendor that has become a major builder of AI cloud data centers (Oracle Cloud Infrastructure). Based in Austin, Texas.');
  st('Technology', 'AMD', 'Advanced Micro Devices', 'amd.com', 'Designs Ryzen and EPYC processors, Radeon graphics and Instinct AI accelerators, plus Xilinx FPGAs. Based in Santa Clara, California.');
  st('Technology', 'PLTR', 'Palantir Technologies', 'palantir.com', 'Sells data-integration and AI platforms (Gotham, Foundry, AIP) to governments and large companies. Based in Denver, Colorado.');
  st('Technology', 'CRM', 'Salesforce', 'salesforce.com', 'The largest customer-relationship-management (CRM) software company; also owns Slack, Tableau and MuleSoft and sells Agentforce AI agents. Based in San Francisco.');
  st('Technology', 'ADBE', 'Adobe', 'adobe.com', 'Makes Photoshop, Illustrator, Premiere Pro, Acrobat and the Firefly generative-AI models, sold mostly by subscription. Based in San Jose, California.');
  st('Technology', 'CSCO', 'Cisco Systems', 'cisco.com', 'Largest maker of enterprise networking equipment, with security, collaboration (Webex) and observability (Splunk) software. Based in San Jose, California.');
  st('Technology', 'IBM', 'IBM', 'ibm.com', 'Hybrid-cloud software (Red Hat), consulting, mainframes, the watsonx AI platform and quantum-computing research. Based in Armonk, New York.');
  st('Technology', 'INTC', 'Intel', 'intel.com', 'Designs and manufactures x86 processors and is building a contract chip-manufacturing (foundry) business. The US government became a major shareholder in 2025. Based in Santa Clara, California.');
  st('Technology', 'QCOM', 'Qualcomm', 'qualcomm.com', 'Designs Snapdragon processors and modems for smartphones, PCs, cars and IoT devices, and licenses wireless patents. Based in San Diego.');
  st('Technology', 'TXN', 'Texas Instruments', 'ti.com', 'The largest maker of analog chips and a major supplier of embedded processors, manufactured in its own fabs. Based in Dallas.');
  st('Technology', 'MU', 'Micron Technology', 'micron.com', 'One of three major makers of DRAM memory, including the high-bandwidth memory (HBM) used in AI accelerators, plus NAND flash. Based in Boise, Idaho.');
  st('Technology', 'AMAT', 'Applied Materials', 'appliedmaterials.com', 'The largest supplier of semiconductor manufacturing equipment (deposition, etch, inspection). Based in Santa Clara, California.');
  st('Technology', 'LRCX', 'Lam Research', 'lamresearch.com', 'Supplies wafer-fabrication equipment, especially etch and deposition tools used for memory and advanced logic. Based in Fremont, California.');
  st('Technology', 'KLAC', 'KLA', 'kla.com', 'Leader in process-control and inspection equipment that chipmakers use to find defects. Based in Milpitas, California.');
  st('Technology', 'ARM', 'Arm Holdings', 'arm.com', 'Licenses the Arm processor architecture used in almost every smartphone and a growing share of servers and PCs. Majority-owned by SoftBank. Based in Cambridge, UK.');
  st('Technology', 'ANET', 'Arista Networks', 'arista.com', 'Builds high-speed Ethernet switches and software for cloud and AI data centers. Based in Santa Clara, California.');
  st('Technology', 'NOW', 'ServiceNow', 'servicenow.com', 'Cloud platform that automates IT, HR and customer-service workflows inside large organizations. Based in Santa Clara, California.');
  st('Technology', 'INTU', 'Intuit', 'intuit.com', 'Owns TurboTax, QuickBooks, Credit Karma and Mailchimp. Based in Mountain View, California.');
  st('Technology', 'UBER', 'Uber Technologies', 'uber.com', 'Ride-hailing and Uber Eats delivery platform operating in about 70 countries, increasingly partnering with robotaxi developers. Based in San Francisco.');
  st('Technology', 'SHOP', 'Shopify', 'shopify.com', 'Software that lets millions of merchants run online and in-person stores, plus payments and logistics. Based in Ottawa, Canada.');
  st('Technology', 'SNOW', 'Snowflake', 'snowflake.com', 'Cloud data platform for storing, analyzing and sharing data and building AI applications. Based in Bozeman, Montana.');
  st('Technology', 'CRWD', 'CrowdStrike', 'crowdstrike.com', 'Cloud-native cybersecurity company whose Falcon platform protects endpoints, cloud workloads and identities. Based in Austin, Texas.');
  st('Technology', 'PANW', 'Palo Alto Networks', 'paloaltonetworks.com', 'One of the largest cybersecurity companies: next-generation firewalls, secure access (SASE) and the Cortex security-operations platform. Based in Santa Clara, California.');
  st('Technology', 'NET', 'Cloudflare', 'cloudflare.com', 'Runs a global edge network that speeds up and protects websites, APIs and corporate networks. Based in San Francisco.');
  st('Technology', 'DDOG', 'Datadog', 'datadoghq.com', 'Monitoring and security platform that lets engineering teams observe cloud applications and infrastructure. Based in New York.');
  st('Technology', 'APP', 'AppLovin', 'applovin.com', 'Mobile and e-commerce advertising platform powered by its AXON machine-learning engine. Based in Palo Alto, California.');
  st('Technology', 'DELL', 'Dell Technologies', 'dell.com', 'Sells PCs, servers (including AI servers built on Nvidia GPUs) and storage. Based in Round Rock, Texas.');
  st('Technology', 'MRVL', 'Marvell Technology', 'marvell.com', 'Designs data-infrastructure chips: custom AI accelerators, optical interconnect and networking silicon. Based in Santa Clara, California.');
  st('Technology', 'TSM', 'TSMC (ADR)', 'tsmc.com', 'Taiwan Semiconductor Manufacturing is the world\'s largest contract chipmaker and produces the most advanced chips for Apple, Nvidia, AMD and others. This is the US-listed ADR. Based in Hsinchu, Taiwan.', { t: ['intl'] });
  st('Technology', 'ASML', 'ASML Holding (ADR)', 'asml.com', 'The only maker of extreme-ultraviolet (EUV) lithography machines, essential for producing leading-edge chips. Based in Veldhoven, Netherlands.', { t: ['intl'] });
  st('Technology', 'SAP', 'SAP (ADR)', 'sap.com', 'Europe\'s largest software company, best known for ERP systems that run the finances and supply chains of large enterprises. Based in Walldorf, Germany.', { t: ['intl'] });
  st('Technology', 'CRWV', 'CoreWeave', 'coreweave.com', 'Specialized cloud provider renting large clusters of Nvidia GPUs for AI training and inference. Went public on Nasdaq in March 2025. Based in Livingston, New Jersey.', { t: ['ipo'] });
  st('Technology', 'CBRS', 'Cerebras Systems', 'cerebras.ai', 'Builds wafer-scale AI processors and sells AI inference as a cloud service. IPO on Nasdaq on May 14, 2026 at $185 per share, raising $5.55 billion. Based in Sunnyvale, California.', { t: ['ipo', 'ipo26'] });
  st('Technology', 'FIG', 'Figma', 'figma.com', 'Collaborative, browser-based design and prototyping software. Listed on the NYSE in July 2025. Based in San Francisco.', { t: ['ipo'] });
  st('Technology', 'IONQ', 'IonQ', 'ionq.com', 'Develops trapped-ion quantum computers and quantum networking. Based in College Park, Maryland.');
  st('Technology', 'NBIS', 'Nebius Group', 'nebius.com', 'AI-infrastructure cloud company renting GPU capacity, spun out of Yandex\'s international businesses. Based in Amsterdam.');

  // Space
  st('Industrials', 'SPCX', 'SpaceX', 'spacex.com', 'Builds and launches Falcon 9 and Starship rockets and operates the Starlink satellite-internet network. Acquired xAI (the Grok AI models and the X social platform) in an all-stock deal in February 2026. Listed on Nasdaq on June 12, 2026 at $135 per share in the largest IPO ever. Based in Starbase, Texas.', { t: ['ipo', 'ipo26'] });

  // Communication & media
  st('Communication', 'NFLX', 'Netflix', 'netflix.com', 'The largest subscription video-streaming service, with ad-supported and ad-free plans in over 190 countries. Based in Los Gatos, California.');
  st('Communication', 'DIS', 'Walt Disney', 'thewaltdisneycompany.com', 'Theme parks and cruises, film studios (Disney, Pixar, Marvel, Lucasfilm), ESPN and the Disney+ and Hulu streaming services. Based in Burbank, California.');
  st('Communication', 'CMCSA', 'Comcast', 'corporate.comcast.com', 'Xfinity broadband and wireless, NBCUniversal, Universal theme parks and Peacock. Based in Philadelphia.');
  st('Communication', 'T', 'AT&T', 'att.com', 'Largest US telecom by revenue: wireless service and a fast-growing fiber broadband network. Based in Dallas.');
  st('Communication', 'VZ', 'Verizon', 'verizon.com', 'US wireless and broadband carrier. Based in New York.');
  st('Communication', 'TMUS', 'T-Mobile US', 't-mobile.com', 'US wireless carrier, majority-owned by Deutsche Telekom. Based in Bellevue, Washington.');
  st('Communication', 'SPOT', 'Spotify', 'spotify.com', 'The largest music-streaming service, also offering podcasts and audiobooks. Based in Stockholm; listed on the NYSE.', { t: ['intl'] });
  st('Communication', 'RDDT', 'Reddit', 'reddit.com', 'Network of community forums, monetized through advertising and data-licensing deals with AI companies. Based in San Francisco.');
  st('Communication', 'RBLX', 'Roblox', 'roblox.com', 'Platform where users create and play games, popular with children and teens. Based in San Mateo, California.');

  // Fintech & crypto-linked
  st('Financials', 'PYPL', 'PayPal', 'paypal.com', 'Digital-payments company behind PayPal, Venmo and Braintree. Based in San Jose, California.');
  st('Financials', 'XYZ', 'Block', 'block.xyz', 'Parent of Square (merchant payments), Cash App and Afterpay; ticker changed from SQ to XYZ in January 2025. Based in Oakland, California.');
  st('Financials', 'COIN', 'Coinbase Global', 'coinbase.com', 'The largest US cryptocurrency exchange and a major custodian for spot bitcoin and ether ETFs. Joined the S&P 500 in May 2025.', { t: ['crypto'] });
  st('Financials', 'HOOD', 'Robinhood Markets', 'robinhood.com', 'Commission-free brokerage app for stocks, options and crypto. Based in Menlo Park, California.', { t: ['crypto'] });
  st('Financials', 'MSTR', 'Strategy', 'strategy.com', 'Formerly MicroStrategy (renamed in February 2025). Holds the largest corporate bitcoin treasury, funded by stock and preferred-share issuance, alongside an enterprise-analytics software business. Based in Tysons Corner, Virginia.', { t: ['crypto'] });
  st('Financials', 'CRCL', 'Circle Internet Group', 'circle.com', 'Issuer of the USDC stablecoin; earns most revenue from interest on USDC reserves. Listed on the NYSE in June 2025. Based in New York.', { t: ['crypto', 'ipo'] });
  st('Financials', 'SOFI', 'SoFi Technologies', 'sofi.com', 'Online bank offering loans, deposits, investing and a technology platform for other banks. Based in San Francisco.');

  // Financials
  st('Financials', 'BRK-B', 'Berkshire Hathaway (Class B)', 'berkshirehathaway.com', 'Conglomerate built by Warren Buffett: GEICO and other insurers, BNSF Railway, energy utilities, dozens of operating businesses and a large stock portfolio. Greg Abel succeeded Buffett as CEO at the start of 2026. Based in Omaha, Nebraska.', { s: 'BRK.B', tv: 'NYSE:BRK.B' });
  st('Financials', 'JPM', 'JPMorgan Chase', 'jpmorganchase.com', 'The largest US bank by assets: consumer banking (Chase), investment banking, markets and asset management. Based in New York.');
  st('Financials', 'V', 'Visa', 'visa.com', 'Operates the world\'s largest card-payments network; it does not lend money itself. Based in San Francisco.');
  st('Financials', 'MA', 'Mastercard', 'mastercard.com', 'Global card-payments network and payment-services company. Based in Purchase, New York.');
  st('Financials', 'BAC', 'Bank of America', 'bankofamerica.com', 'Second-largest US bank: consumer banking, Merrill wealth management and investment banking. Based in Charlotte, North Carolina.');
  st('Financials', 'WFC', 'Wells Fargo', 'wellsfargo.com', 'Large US consumer and commercial bank. Based in San Francisco.');
  st('Financials', 'GS', 'Goldman Sachs', 'goldmansachs.com', 'Investment bank and asset manager: advisory, underwriting, trading and wealth management. Based in New York.');
  st('Financials', 'MS', 'Morgan Stanley', 'morganstanley.com', 'Investment bank with one of the largest wealth-management businesses (including E*Trade). Based in New York.');
  st('Financials', 'C', 'Citigroup', 'citigroup.com', 'Global bank with services, markets, banking, wealth and US cards businesses. Based in New York.');
  st('Financials', 'AXP', 'American Express', 'americanexpress.com', 'Card issuer and payments network focused on affluent consumers and businesses. Based in New York.');
  st('Financials', 'BLK', 'BlackRock', 'blackrock.com', 'The world\'s largest asset manager and sponsor of iShares ETFs, including the IBIT bitcoin fund. Based in New York.');
  st('Financials', 'SCHW', 'Charles Schwab', 'schwab.com', 'One of the largest US brokerages and custodians for independent advisers. Based in Westlake, Texas.');
  st('Financials', 'SPGI', 'S&P Global', 'spglobal.com', 'Credit ratings, market data and indices (it co-owns S&P Dow Jones Indices, which runs the S&P 500). Based in New York.');
  st('Financials', 'BX', 'Blackstone', 'blackstone.com', 'The largest alternative-asset manager: real estate, private equity, private credit and hedge-fund solutions. Based in New York.', { t: ['alt'] });
  st('Financials', 'KKR', 'KKR & Co.', 'kkr.com', 'Global investment firm in private equity, infrastructure, credit and insurance (Global Atlantic). Based in New York.', { t: ['alt'] });
  st('Financials', 'APO', 'Apollo Global Management', 'apollo.com', 'Alternative-asset manager known for private credit, with the Athene retirement-services insurer. Based in New York.', { t: ['alt'] });
  st('Financials', 'ARCC', 'Ares Capital', 'arescapitalcorp.com', 'The largest publicly traded business development company (BDC): it lends to mid-sized private companies and pays out most income as dividends.', { t: ['alt'] });
  st('Financials', 'HSBC', 'HSBC Holdings (ADR)', 'hsbc.com', 'One of Europe\'s largest banks, earning most of its profit in Asia. Based in London.', { t: ['intl'] });
  st('Financials', 'RY', 'Royal Bank of Canada', 'rbc.com', 'Canada\'s largest bank by market value. Based in Toronto; also listed on the NYSE.', { t: ['intl'] });

  // Healthcare
  st('Healthcare', 'LLY', 'Eli Lilly', 'lilly.com', 'Pharmaceutical company whose GLP-1 medicines for diabetes and obesity (Mounjaro, Zepbound) made it the most valuable healthcare company. Based in Indianapolis.');
  st('Healthcare', 'UNH', 'UnitedHealth Group', 'unitedhealthgroup.com', 'Largest US health insurer (UnitedHealthcare) plus the Optum health-services, pharmacy-benefits and data businesses. Based in Minnetonka, Minnesota.');
  st('Healthcare', 'JNJ', 'Johnson & Johnson', 'jnj.com', 'Pharmaceuticals (oncology, immunology, neuroscience) and medical devices; spun off its consumer-health unit as Kenvue in 2023. Based in New Brunswick, New Jersey.');
  st('Healthcare', 'ABBV', 'AbbVie', 'abbvie.com', 'Biopharma company whose immunology drugs Skyrizi and Rinvoq have replaced Humira as growth drivers. Based in North Chicago, Illinois.');
  st('Healthcare', 'MRK', 'Merck & Co.', 'merck.com', 'Pharmaceutical company best known for the cancer immunotherapy Keytruda and for vaccines such as Gardasil. Based in Rahway, New Jersey.');
  st('Healthcare', 'PFE', 'Pfizer', 'pfizer.com', 'Global pharmaceutical company (vaccines, oncology, internal medicine). Based in New York.');
  st('Healthcare', 'TMO', 'Thermo Fisher Scientific', 'thermofisher.com', 'The largest supplier of laboratory instruments, reagents and services to pharma and research labs. Based in Waltham, Massachusetts.');
  st('Healthcare', 'ABT', 'Abbott Laboratories', 'abbott.com', 'Medical devices (including FreeStyle Libre glucose monitors), diagnostics, nutrition and generic drugs. Based in Abbott Park, Illinois.');
  st('Healthcare', 'ISRG', 'Intuitive Surgical', 'intuitive.com', 'Maker of the da Vinci robotic surgical systems; most revenue comes from recurring instruments and service. Based in Sunnyvale, California.');
  st('Healthcare', 'AMGN', 'Amgen', 'amgen.com', 'One of the largest biotechnology companies (bone, cardiovascular, oncology and rare-disease drugs). Based in Thousand Oaks, California.');
  st('Healthcare', 'GILD', 'Gilead Sciences', 'gilead.com', 'Biopharma company that leads in HIV treatment and prevention. Based in Foster City, California.');
  st('Healthcare', 'VRTX', 'Vertex Pharmaceuticals', 'vrtx.com', 'Makes the leading treatments for cystic fibrosis and is expanding into pain and gene-editing therapies. Based in Boston.');
  st('Healthcare', 'NVO', 'Novo Nordisk (ADR)', 'novonordisk.com', 'Danish maker of the GLP-1 drugs Ozempic and Wegovy and a long-time leader in insulin. Based in Bagsvaerd, Denmark.', { t: ['intl'] });
  st('Healthcare', 'AZN', 'AstraZeneca', 'astrazeneca.com', 'Anglo-Swedish pharmaceutical company focused on oncology, rare diseases and cardiovascular medicine. Based in Cambridge, UK.', { t: ['intl'] });
  st('Healthcare', 'NVS', 'Novartis (ADR)', 'novartis.com', 'Swiss pharmaceutical company focused on innovative medicines after spinning off Sandoz in 2023. Based in Basel.', { t: ['intl'] });

  // Consumer
  st('Consumer', 'WMT', 'Walmart', 'walmart.com', 'The world\'s largest retailer by revenue, plus Sam\'s Club, e-commerce and a growing advertising business. Moved its listing from the NYSE to Nasdaq in December 2025. Based in Bentonville, Arkansas.');
  st('Consumer', 'COST', 'Costco Wholesale', 'costco.com', 'Membership warehouse clubs selling bulk goods at thin margins; membership fees drive much of its profit. Based in Issaquah, Washington.');
  st('Consumer', 'PG', 'Procter & Gamble', 'pg.com', 'Household and personal-care brands such as Tide, Pampers, Gillette and Crest. Based in Cincinnati.');
  st('Consumer', 'KO', 'Coca-Cola', 'coca-colacompany.com', 'The largest beverage company, selling Coca-Cola and hundreds of other drink brands through bottling partners. Based in Atlanta.');
  st('Consumer', 'PEP', 'PepsiCo', 'pepsico.com', 'Snacks (Frito-Lay, Quaker) and beverages (Pepsi, Gatorade). Based in Purchase, New York.');
  st('Consumer', 'MCD', 'McDonald\'s', 'mcdonalds.com', 'The largest restaurant chain by revenue; about 95% of restaurants are franchised, making it largely a real-estate and royalty business. Based in Chicago.');
  st('Consumer', 'NKE', 'Nike', 'nike.com', 'The largest athletic footwear and apparel company, including Jordan and Converse. Based in Beaverton, Oregon.');
  st('Consumer', 'SBUX', 'Starbucks', 'starbucks.com', 'The largest coffeehouse chain, with major markets in the US and China. Based in Seattle.');
  st('Consumer', 'HD', 'Home Depot', 'homedepot.com', 'The largest home-improvement retailer, serving DIY customers and professional contractors. Based in Atlanta.');
  st('Consumer', 'LOW', 'Lowe\'s', 'lowes.com', 'Second-largest US home-improvement retailer. Based in Mooresville, North Carolina.');
  st('Consumer', 'TGT', 'Target', 'target.com', 'US discount retailer of general merchandise and groceries. Based in Minneapolis.');
  st('Consumer', 'PM', 'Philip Morris International', 'pmi.com', 'Sells Marlboro outside the US and smoke-free products such as IQOS heated tobacco and ZYN nicotine pouches. Based in Stamford, Connecticut.');
  st('Consumer', 'CMG', 'Chipotle Mexican Grill', 'chipotle.com', 'Fast-casual burrito chain that owns and operates its restaurants rather than franchising. Based in Newport Beach, California.');
  st('Consumer', 'BKNG', 'Booking Holdings', 'bookingholdings.com', 'Online travel company behind Booking.com, Priceline, Agoda, KAYAK and OpenTable. Based in Norwalk, Connecticut.');
  st('Consumer', 'ABNB', 'Airbnb', 'airbnb.com', 'Marketplace for short-term home rentals and experiences. Based in San Francisco.');
  st('Consumer', 'DASH', 'DoorDash', 'doordash.com', 'The largest US food-delivery platform, also owner of Wolt. Based in San Francisco.');
  st('Consumer', 'RACE', 'Ferrari', 'ferrari.com', 'Luxury sports-car maker that deliberately limits production to protect pricing. Based in Maranello, Italy; listed in New York and Milan.', { t: ['intl', 'collect'] });
  st('Consumer', 'MELI', 'MercadoLibre', 'mercadolibre.com', 'Latin America\'s largest e-commerce marketplace and fintech (Mercado Pago). Based in Montevideo, Uruguay.', { t: ['intl'] });
  st('Consumer', 'BABA', 'Alibaba Group (ADR)', 'alibabagroup.com', 'China\'s largest e-commerce group (Taobao, Tmall) and cloud provider. Based in Hangzhou.', { t: ['intl'] });
  st('Consumer', 'PDD', 'PDD Holdings', 'pddholdings.com', 'Owner of Pinduoduo in China and the Temu marketplace abroad. Headquartered in Dublin, Ireland.', { t: ['intl'] });
  st('Consumer', 'SONY', 'Sony Group (ADR)', 'sony.com', 'PlayStation, music, movies, image sensors and financial services. Based in Tokyo.', { t: ['intl'] });
  st('Consumer', 'TM', 'Toyota Motor (ADR)', 'global.toyota', 'The world\'s best-selling carmaker and leader in hybrid vehicles. Based in Toyota City, Japan.', { t: ['intl'] });
  st('Consumer', 'F', 'Ford Motor', 'ford.com', 'US automaker known for the F-Series pickup trucks. Based in Dearborn, Michigan.');
  st('Consumer', 'GM', 'General Motors', 'gm.com', 'Largest US automaker by sales (Chevrolet, GMC, Cadillac, Buick). Based in Detroit.');
  st('Consumer', 'RIVN', 'Rivian Automotive', 'rivian.com', 'Electric trucks, SUVs and delivery vans, with a software joint venture with Volkswagen. Based in Irvine, California.');
  st('Consumer', 'EBAY', 'eBay', 'ebay.com', 'Online marketplace that has become a major venue for trading cards and collectibles. Based in San Jose, California.', { t: ['collect'] });
  st('Consumer', 'UL', 'Unilever (ADR)', 'unilever.com', 'Consumer-goods group (Dove, Hellmann\'s, Axe); spun off its ice-cream business in 2025. Based in London.', { t: ['intl'] });

  // Energy, industrials, materials, utilities
  st('Energy', 'XOM', 'Exxon Mobil', 'exxonmobil.com', 'The largest US oil and gas company, integrated from production to refining and chemicals. Based in Spring, Texas.');
  st('Energy', 'CVX', 'Chevron', 'chevron.com', 'Integrated oil major; acquired Hess in 2025 for its stake in Guyana\'s oil fields. Based in Houston.');
  st('Energy', 'COP', 'ConocoPhillips', 'conocophillips.com', 'The largest US independent oil and gas producer. Based in Houston.');
  st('Energy', 'SHEL', 'Shell (ADR)', 'shell.com', 'Integrated oil and gas major and the world\'s largest LNG trader. Based in London.', { t: ['intl'] });
  st('Energy', 'FRVO', 'Fervo Energy', 'fervoenergy.com', 'Develops enhanced geothermal power plants using horizontal-drilling techniques from the oil industry. IPO on Nasdaq on May 13, 2026 at $27 per share, the largest clean-energy IPO on record. Based in Houston.', { t: ['ipo', 'ipo26'] });
  st('Energy', 'CCJ', 'Cameco', 'cameco.com', 'One of the largest uranium producers, with a stake in Westinghouse. Based in Saskatoon, Canada.', { t: ['intl'] });
  st('Energy', 'OKLO', 'Oklo', 'oklo.com', 'Developing small advanced fission power plants (the Aurora powerhouse); pre-revenue. Based in Santa Clara, California.');
  st('Industrials', 'GE', 'GE Aerospace', 'geaerospace.com', 'Jet engines for commercial and military aircraft (including CFM LEAP engines via a joint venture with Safran). Based in Cincinnati.');
  st('Industrials', 'GEV', 'GE Vernova', 'gevernova.com', 'Gas turbines, grid equipment and wind turbines; spun off from General Electric in 2024 and a key supplier to power-hungry data centers. Based in Cambridge, Massachusetts.');
  st('Industrials', 'CAT', 'Caterpillar', 'caterpillar.com', 'The largest maker of construction and mining equipment, engines and power generators. Based in Irving, Texas.');
  st('Industrials', 'BA', 'Boeing', 'boeing.com', 'Commercial airplanes (737, 787), defense and space systems. Based in Arlington, Virginia.');
  st('Industrials', 'LMT', 'Lockheed Martin', 'lockheedmartin.com', 'The largest defense contractor (F-35 fighter, missiles, space systems). Based in Bethesda, Maryland.');
  st('Industrials', 'RTX', 'RTX', 'rtx.com', 'Aerospace and defense group made up of Collins Aerospace, Pratt & Whitney and Raytheon. Based in Arlington, Virginia.');
  st('Industrials', 'NOC', 'Northrop Grumman', 'northropgrumman.com', 'Defense contractor behind the B-21 bomber, space systems and missile defense. Based in Falls Church, Virginia.');
  st('Industrials', 'HON', 'Honeywell', 'honeywell.com', 'Industrial conglomerate (aerospace, building automation, industrial automation) that is splitting into separate companies. Based in Charlotte, North Carolina.');
  st('Industrials', 'UPS', 'United Parcel Service', 'ups.com', 'Global package delivery and logistics. Based in Atlanta.');
  st('Industrials', 'DE', 'Deere & Company', 'deere.com', 'The largest maker of farm equipment (John Deere tractors and combines) and a major construction-equipment maker. Based in Moline, Illinois.');
  st('Industrials', 'UNP', 'Union Pacific', 'up.com', 'Largest US freight railroad, operating in the western two-thirds of the country. Based in Omaha, Nebraska.');
  st('Utilities', 'NEE', 'NextEra Energy', 'nexteraenergy.com', 'Owner of Florida Power & Light and the world\'s largest generator of wind and solar power. Based in Juno Beach, Florida.');
  st('Utilities', 'VST', 'Vistra', 'vistracorp.com', 'Power producer with nuclear, gas and retail-electricity businesses, benefiting from data-center demand. Based in Irving, Texas.');
  st('Utilities', 'CEG', 'Constellation Energy', 'constellationenergy.com', 'Operates the largest fleet of US nuclear power plants and sells carbon-free power to data centers. Based in Baltimore.');
  st('Utilities', 'SO', 'Southern Company', 'southerncompany.com', 'Electric and gas utility serving the Southeast US; completed the Vogtle nuclear expansion. Based in Atlanta.');
  st('Materials', 'LIN', 'Linde', 'linde.com', 'The largest industrial-gases company (oxygen, nitrogen, hydrogen). Based in Woking, UK.');
  st('Materials', 'NEM', 'Newmont', 'newmont.com', 'The world\'s largest gold miner. Based in Denver.', { t: ['metal'] });
  st('Materials', 'FCX', 'Freeport-McMoRan', 'fcx.com', 'One of the largest copper miners, also producing gold and molybdenum. Based in Phoenix.', { t: ['metal'] });
  st('Materials', 'BHP', 'BHP Group (ADR)', 'bhp.com', 'The world\'s largest mining company by market value (iron ore, copper, potash). Based in Melbourne.', { t: ['intl', 'metal'] });
  st('Materials', 'RIO', 'Rio Tinto (ADR)', 'riotinto.com', 'Global miner of iron ore, aluminum, copper and lithium. Based in London.', { t: ['intl', 'metal'] });

  // International local listings (quoted in local currency)
  const intl = (id, s, n, cur, dom, tv, g, d) => add('stock', g, id, s, n, d, { cur, dom, tv, t: ['intl', 'local'] });
  intl('2222.SR', '2222', 'Saudi Aramco', 'SAR', 'aramco.com', 'TADAWUL:2222', 'Energy', 'Saudi Arabia\'s state-controlled oil company, the world\'s largest crude producer. Listed on the Saudi Exchange (Tadawul).');
  intl('005930.KS', '005930', 'Samsung Electronics', 'KRW', 'samsung.com', 'KRX:005930', 'Technology', 'One of the largest memory-chip makers and a top smartphone and TV maker. Listed on the Korea Exchange.');
  intl('0700.HK', '0700', 'Tencent Holdings', 'HKD', 'tencent.com', 'HKEX:700', 'Communication', 'Owner of WeChat and the world\'s largest video-game publisher by revenue. Listed in Hong Kong.');
  intl('1810.HK', '1810', 'Xiaomi', 'HKD', 'mi.com', 'HKEX:1810', 'Technology', 'Smartphones, consumer electronics and, since 2024, electric cars. Listed in Hong Kong.');
  intl('MC.PA', 'MC', 'LVMH', 'EUR', 'lvmh.com', 'EURONEXT:MC', 'Consumer', 'The largest luxury-goods group: Louis Vuitton, Dior, Tiffany, Moet Hennessy and Sephora. Listed on Euronext Paris.');
  intl('RMS.PA', 'RMS', 'Hermes International', 'EUR', 'hermes.com', 'EURONEXT:RMS', 'Consumer', 'Family-controlled luxury house whose Birkin and Kelly bags trade above retail on the resale market. Listed on Euronext Paris.');
  intl('OR.PA', 'OR', 'L\'Oreal', 'EUR', 'loreal.com', 'EURONEXT:OR', 'Consumer', 'The largest cosmetics company. Listed on Euronext Paris.');
  intl('SIE.DE', 'SIE', 'Siemens', 'EUR', 'siemens.com', 'XETR:SIE', 'Industrials', 'Industrial automation, smart infrastructure, rail and industrial software. Listed in Frankfurt.');
  intl('NESN.SW', 'NESN', 'Nestle', 'CHF', 'nestle.com', 'SIX:NESN', 'Consumer', 'The largest food company (Nescafe, KitKat, Purina). Listed on the SIX Swiss Exchange.');
  intl('ROG.SW', 'ROG', 'Roche Holding', 'CHF', 'roche.com', 'SIX:ROG', 'Healthcare', 'Pharmaceuticals and the largest in-vitro diagnostics business. Listed on the SIX Swiss Exchange.');
  intl('CFR.SW', 'CFR', 'Richemont', 'CHF', 'richemont.com', 'SIX:CFR', 'Consumer', 'Luxury group behind Cartier, Van Cleef & Arpels and watchmakers such as Vacheron Constantin, IWC and Jaeger-LeCoultre.');
  intl('UHR.SW', 'UHR', 'Swatch Group', 'CHF', 'swatchgroup.com', 'SIX:UHR', 'Consumer', 'Swiss watch group owning Omega, Breguet, Blancpain, Longines, Tissot and Swatch.');
  intl('9984.T', '9984', 'SoftBank Group', 'JPY', 'group.softbank', 'TSE:9984', 'Technology', 'Japanese technology investor that controls Arm and is a large investor in OpenAI. Listed in Tokyo.');
  intl('RELIANCE.NS', 'RELIANCE', 'Reliance Industries', 'INR', 'ril.com', 'NSE:RELIANCE', 'Energy', 'India\'s largest company by market value: refining, telecom (Jio) and retail. Listed on the NSE.');
  intl('600519.SS', '600519', 'Kweichow Moutai', 'CNY', 'moutaichina.com', 'SSE:600519', 'Consumer', 'Maker of Moutai baijiu, China\'s most prestigious liquor. Listed in Shanghai.');
  intl('300750.SZ', '300750', 'CATL', 'CNY', 'catl.com', 'SZSE:300750', 'Industrials', 'Contemporary Amperex Technology, the world\'s largest EV-battery maker. Listed in Shenzhen (also in Hong Kong since 2025).');
  intl('ITX.MC', 'ITX', 'Inditex', 'EUR', 'inditex.com', 'BME:ITX', 'Consumer', 'The largest fashion retailer, owner of Zara. Listed in Madrid.');
  intl('CBA.AX', 'CBA', 'Commonwealth Bank of Australia', 'AUD', 'commbank.com.au', 'ASX:CBA', 'Financials', 'Australia\'s largest bank. Listed on the ASX.');

  // Real estate (REITs, homebuilders, property tech, farmland, timber)
  const re = (id, n, dom, d, tags) => st('Real Estate', id, n, dom, d, { t: ['reit'].concat(tags || []) });
  re('PLD', 'Prologis', 'prologis.com', 'The largest owner of logistics warehouses worldwide.');
  re('AMT', 'American Tower', 'americantower.com', 'Owns cell towers and data centers that it leases to wireless carriers.');
  re('EQIX', 'Equinix', 'equinix.com', 'The largest operator of colocation data centers.');
  re('WELL', 'Welltower', 'welltower.com', 'Owns senior-housing and healthcare properties.');
  re('O', 'Realty Income', 'realtyincome.com', 'Net-lease REIT that owns thousands of single-tenant commercial properties and pays a monthly dividend.');
  re('SPG', 'Simon Property Group', 'simon.com', 'The largest US owner of shopping malls and premium outlets.');
  re('PSA', 'Public Storage', 'publicstorage.com', 'The largest owner of self-storage facilities.');
  re('DLR', 'Digital Realty', 'digitalrealty.com', 'Owns data centers leased to cloud and AI companies.');
  re('VICI', 'VICI Properties', 'viciproperties.com', 'Owns casino and entertainment properties such as Caesars Palace, leased on long-term triple-net leases.');
  re('AVB', 'AvalonBay Communities', 'avaloncommunities.com', 'Owns apartment communities in coastal US metro areas.');
  re('INVH', 'Invitation Homes', 'invitationhomes.com', 'The largest owner of single-family rental homes in the US.');
  st('Real Estate', 'DHI', 'D.R. Horton', 'drhorton.com', 'The largest US homebuilder by volume.', { t: ['housing'] });
  st('Real Estate', 'LEN', 'Lennar', 'lennar.com', 'Second-largest US homebuilder.', { t: ['housing'] });
  st('Real Estate', 'Z', 'Zillow Group', 'zillow.com', 'The most-visited US real-estate website, earning revenue from agent advertising, rentals and mortgages.', { t: ['housing'] });
  st('Real Estate', 'FPI', 'Farmland Partners', 'farmlandpartners.com', 'REIT that owns farmland leased to farmers across the US.', { t: ['reit', 'farm', 'alt'] });
  st('Real Estate', 'LAND', 'Gladstone Land', 'gladstoneland.com', 'REIT that owns farmland for fresh produce, nuts and other permanent crops; pays monthly distributions.', { t: ['reit', 'farm', 'alt'] });
  st('Real Estate', 'WY', 'Weyerhaeuser', 'weyerhaeuser.com', 'One of the largest private owners of timberland in North America, organized as a REIT.', { t: ['reit', 'timber', 'alt'] });
  st('Real Estate', 'RYN', 'Rayonier', 'rayonier.com', 'Timberland REIT with forests in the US South and Pacific Northwest.', { t: ['reit', 'timber', 'alt'] });
  st('Financials', 'HGTY', 'Hagerty', 'hagerty.com', 'Insurance and marketplace for collector cars; publishes the Hagerty classic-car valuation guides.', { t: ['collect'] });

  // ------------------------------------------------------------------- ETFs
  const etf = (g, id, n, d, tags) => add('etf', g, id, id, n, d, { t: tags || [] });
  etf('US equity', 'SPY', 'SPDR S&P 500 ETF Trust', 'The first US ETF (1993) and the most traded; tracks the S&P 500.');
  etf('US equity', 'VOO', 'Vanguard S&P 500 ETF', 'Low-cost Vanguard fund tracking the S&P 500.');
  etf('US equity', 'IVV', 'iShares Core S&P 500 ETF', 'BlackRock\'s low-cost fund tracking the S&P 500.');
  etf('US equity', 'VTI', 'Vanguard Total Stock Market ETF', 'Holds essentially the entire US stock market, large to micro cap.');
  etf('US equity', 'QQQ', 'Invesco QQQ Trust', 'Tracks the Nasdaq-100: the 100 largest non-financial Nasdaq companies.');
  etf('US equity', 'QQQM', 'Invesco NASDAQ 100 ETF', 'Lower-cost sibling of QQQ tracking the same Nasdaq-100 index.');
  etf('US equity', 'DIA', 'SPDR Dow Jones Industrial Average ETF', 'Tracks the 30-stock Dow Jones Industrial Average.');
  etf('US equity', 'IWM', 'iShares Russell 2000 ETF', 'Tracks the Russell 2000 small-cap index.');
  etf('US equity', 'RSP', 'Invesco S&P 500 Equal Weight ETF', 'Holds all S&P 500 stocks in equal weights, reducing concentration in the largest companies.');
  etf('International', 'VT', 'Vanguard Total World Stock ETF', 'One fund holding thousands of stocks from developed and emerging markets worldwide.');
  etf('International', 'VXUS', 'Vanguard Total International Stock ETF', 'All major non-US stock markets, developed and emerging.');
  etf('International', 'VEA', 'Vanguard FTSE Developed Markets ETF', 'Stocks from developed markets outside the US (Europe, Japan, Canada, Australia).');
  etf('International', 'VWO', 'Vanguard FTSE Emerging Markets ETF', 'Stocks from emerging markets such as China, India, Taiwan and Brazil.');
  etf('International', 'EFA', 'iShares MSCI EAFE ETF', 'Large and mid caps in Europe, Australasia and the Far East.');
  etf('International', 'EEM', 'iShares MSCI Emerging Markets ETF', 'Large and mid caps in emerging markets.');
  etf('International', 'EWJ', 'iShares MSCI Japan ETF', 'Large and mid-cap Japanese stocks.');
  etf('International', 'INDA', 'iShares MSCI India ETF', 'Large and mid-cap Indian stocks.');
  etf('International', 'FXI', 'iShares China Large-Cap ETF', 'The 50 largest Chinese companies listed in Hong Kong.');
  etf('International', 'KWEB', 'KraneShares CSI China Internet ETF', 'Chinese internet companies such as Tencent, Alibaba, PDD and Meituan.');
  etf('International', 'EWZ', 'iShares MSCI Brazil ETF', 'Large and mid-cap Brazilian stocks.');
  etf('Dividend & income', 'SCHD', 'Schwab U.S. Dividend Equity ETF', 'US companies with long dividend records and strong financial ratios.', ['income']);
  etf('Dividend & income', 'VIG', 'Vanguard Dividend Appreciation ETF', 'US companies that have raised dividends for at least 10 consecutive years.', ['income']);
  etf('Dividend & income', 'VYM', 'Vanguard High Dividend Yield ETF', 'US stocks with above-average dividend yields.', ['income']);
  etf('Dividend & income', 'DGRO', 'iShares Core Dividend Growth ETF', 'US companies with a history of consistently growing dividends.', ['income']);
  etf('Dividend & income', 'JEPI', 'JPMorgan Equity Premium Income ETF', 'Low-volatility US stocks plus option premiums (via equity-linked notes) paid out monthly; trades upside for income.', ['income']);
  etf('Dividend & income', 'JEPQ', 'JPMorgan Nasdaq Equity Premium Income ETF', 'Nasdaq-100 stocks plus option premiums paid out monthly.', ['income']);
  etf('Bonds', 'BND', 'Vanguard Total Bond Market ETF', 'The whole US investment-grade bond market: Treasuries, mortgage-backed and corporate bonds.', ['bond']);
  etf('Bonds', 'AGG', 'iShares Core U.S. Aggregate Bond ETF', 'Tracks the Bloomberg US Aggregate, the standard US bond benchmark.', ['bond']);
  etf('Bonds', 'TLT', 'iShares 20+ Year Treasury Bond ETF', 'Long-term US Treasury bonds; very sensitive to interest-rate changes.', ['bond']);
  etf('Bonds', 'IEF', 'iShares 7-10 Year Treasury Bond ETF', 'Intermediate-term US Treasury bonds.', ['bond']);
  etf('Bonds', 'SHY', 'iShares 1-3 Year Treasury Bond ETF', 'Short-term US Treasury notes with low rate sensitivity.', ['bond']);
  etf('Bonds', 'SGOV', 'iShares 0-3 Month Treasury Bond ETF', 'Treasury bills maturing within three months; behaves like a cash account that pays the T-bill rate.', ['bond', 'cash']);
  etf('Bonds', 'BIL', 'SPDR Bloomberg 1-3 Month T-Bill ETF', 'Treasury bills maturing in one to three months.', ['bond', 'cash']);
  etf('Bonds', 'TIP', 'iShares TIPS Bond ETF', 'Treasury Inflation-Protected Securities, whose principal rises with CPI.', ['bond']);
  etf('Bonds', 'LQD', 'iShares iBoxx $ Investment Grade Corporate Bond ETF', 'Investment-grade US corporate bonds.', ['bond']);
  etf('Bonds', 'HYG', 'iShares iBoxx $ High Yield Corporate Bond ETF', 'High-yield ("junk") US corporate bonds: higher income, higher default risk.', ['bond']);
  etf('Bonds', 'MUB', 'iShares National Muni Bond ETF', 'Investment-grade US municipal bonds whose interest is generally exempt from federal income tax.', ['bond']);
  etf('Bonds', 'EMB', 'iShares J.P. Morgan USD Emerging Markets Bond ETF', 'Dollar-denominated government bonds from emerging markets.', ['bond']);
  etf('Commodities', 'GLD', 'SPDR Gold Shares', 'Backed by physical gold bars held in a London vault; the largest gold ETF.', ['metal']);
  etf('Commodities', 'IAU', 'iShares Gold Trust', 'Physically backed gold ETF with a lower fee than GLD.', ['metal']);
  etf('Commodities', 'SLV', 'iShares Silver Trust', 'Backed by physical silver.', ['metal']);
  etf('Commodities', 'GDX', 'VanEck Gold Miners ETF', 'Stocks of gold-mining companies, which tend to amplify moves in the gold price.', ['metal']);
  etf('Commodities', 'PPLT', 'abrdn Physical Platinum Shares ETF', 'Backed by physical platinum.', ['metal']);
  etf('Commodities', 'USO', 'United States Oil Fund', 'Holds WTI crude-oil futures; returns can differ from spot oil because of futures roll costs.', ['energy']);
  etf('Commodities', 'UNG', 'United States Natural Gas Fund', 'Holds natural-gas futures; roll costs have historically been large.', ['energy']);
  etf('Commodities', 'DBC', 'Invesco DB Commodity Index Tracking Fund', 'Diversified basket of energy, metals and agricultural futures.');
  etf('Commodities', 'URA', 'Global X Uranium ETF', 'Uranium miners and nuclear-component companies.', ['energy']);
  etf('Real estate', 'VNQ', 'Vanguard Real Estate ETF', 'Broad basket of US REITs.', ['reit']);
  etf('Real estate', 'SCHH', 'Schwab U.S. REIT ETF', 'Low-cost basket of US REITs.', ['reit']);
  etf('Sectors', 'XLK', 'Technology Select Sector SPDR', 'Technology stocks in the S&P 500.', ['sector']);
  etf('Sectors', 'XLF', 'Financial Select Sector SPDR', 'Financial stocks in the S&P 500.', ['sector']);
  etf('Sectors', 'XLV', 'Health Care Select Sector SPDR', 'Healthcare stocks in the S&P 500.', ['sector']);
  etf('Sectors', 'XLY', 'Consumer Discretionary Select Sector SPDR', 'Consumer-discretionary stocks in the S&P 500 (Amazon, Tesla, Home Depot).', ['sector']);
  etf('Sectors', 'XLC', 'Communication Services Select Sector SPDR', 'Communication-services stocks in the S&P 500 (Meta, Alphabet, Netflix).', ['sector']);
  etf('Sectors', 'XLI', 'Industrial Select Sector SPDR', 'Industrial stocks in the S&P 500.', ['sector']);
  etf('Sectors', 'XLP', 'Consumer Staples Select Sector SPDR', 'Consumer-staples stocks in the S&P 500.', ['sector']);
  etf('Sectors', 'XLE', 'Energy Select Sector SPDR', 'Energy stocks in the S&P 500.', ['sector']);
  etf('Sectors', 'XLU', 'Utilities Select Sector SPDR', 'Utility stocks in the S&P 500.', ['sector']);
  etf('Sectors', 'XLB', 'Materials Select Sector SPDR', 'Materials stocks in the S&P 500.', ['sector']);
  etf('Sectors', 'XLRE', 'Real Estate Select Sector SPDR', 'Real-estate stocks and REITs in the S&P 500.', ['sector', 'reit']);
  etf('Thematic', 'SMH', 'VanEck Semiconductor ETF', 'The 25 largest US-listed semiconductor companies.');
  etf('Thematic', 'SOXX', 'iShares Semiconductor ETF', 'US-listed semiconductor companies.');
  etf('Thematic', 'IGV', 'iShares Expanded Tech-Software Sector ETF', 'North American software companies.');
  etf('Thematic', 'XBI', 'SPDR S&P Biotech ETF', 'Equal-weighted US biotechnology stocks.');
  etf('Thematic', 'ITA', 'iShares U.S. Aerospace & Defense ETF', 'US aerospace and defense manufacturers.');
  etf('Thematic', 'ARKK', 'ARK Innovation ETF', 'Actively managed fund betting on "disruptive innovation" companies; very volatile.');
  etf('Thematic', 'ICLN', 'iShares Global Clean Energy ETF', 'Solar, wind and other clean-energy companies worldwide.');
  etf('Thematic', 'KRBN', 'KraneShares Global Carbon Strategy ETF', 'Carbon-allowance futures from cap-and-trade programs (EU, California, RGGI and others).', ['alt']);
  etf('Thematic', 'WOOD', 'iShares Global Timber & Forestry ETF', 'Timber REITs, forest-products and paper companies.', ['alt', 'timber']);
  etf('Thematic', 'BIZD', 'VanEck BDC Income ETF', 'Business development companies that lend to private mid-sized firms (private credit).', ['alt']);
  etf('Crypto', 'IBIT', 'iShares Bitcoin Trust ETF', 'Spot bitcoin ETF from BlackRock, launched January 2024; the largest bitcoin fund.', ['crypto']);
  etf('Crypto', 'FBTC', 'Fidelity Wise Origin Bitcoin Fund', 'Spot bitcoin ETF from Fidelity.', ['crypto']);
  etf('Crypto', 'GBTC', 'Grayscale Bitcoin Trust ETF', 'The oldest bitcoin fund, converted to a spot ETF in January 2024; charges a higher fee than newer rivals.', ['crypto']);
  etf('Crypto', 'ETHA', 'iShares Ethereum Trust ETF', 'Spot ether ETF from BlackRock, launched July 2024.', ['crypto']);
  etf('Crypto', 'BITO', 'ProShares Bitcoin Strategy ETF', 'Holds bitcoin futures rather than bitcoin; the first US bitcoin-linked ETF (2021).', ['crypto']);
  etf('Leveraged & inverse', 'TQQQ', 'ProShares UltraPro QQQ', 'Seeks 3x the daily return of the Nasdaq-100. Daily resetting causes decay in choppy markets; built for short-term trading.', ['lev']);
  etf('Leveraged & inverse', 'SQQQ', 'ProShares UltraPro Short QQQ', 'Seeks -3x the daily return of the Nasdaq-100. Loses value over time in most conditions; for short-term trading only.', ['lev']);
  etf('Leveraged & inverse', 'SOXL', 'Direxion Daily Semiconductor Bull 3X', 'Seeks 3x the daily return of a semiconductor index; extremely volatile.', ['lev']);

  // ------------------------------------------------------------ Commodities
  const cm = (g, id, s, n, unit, tv, d, tags) => add('commodity', g, id, s, n, d, { unit, tv, t: tags || [] });
  cm('Precious metals', 'GC=F', 'GOLD', 'Gold', 'USD per troy ounce', 'COMEX:GC1!', 'Front-month COMEX gold futures. Gold is held by central banks and investors as a store of value and hedge against inflation and currency debasement.', ['metal']);
  cm('Precious metals', 'SI=F', 'SILVER', 'Silver', 'USD per troy ounce', 'COMEX:SI1!', 'Front-month COMEX silver futures. More than half of silver demand is industrial (solar panels, electronics), so it is more volatile than gold.', ['metal']);
  cm('Precious metals', 'PL=F', 'PLAT', 'Platinum', 'USD per troy ounce', 'NYMEX:PL1!', 'NYMEX platinum futures. Used in catalytic converters, jewelry and hydrogen fuel cells; mined mostly in South Africa.', ['metal']);
  cm('Precious metals', 'PA=F', 'PALL', 'Palladium', 'USD per troy ounce', 'NYMEX:PA1!', 'NYMEX palladium futures. Mainly used in gasoline-car catalytic converters; Russia and South Africa dominate supply.', ['metal']);
  cm('Industrial metals', 'HG=F', 'COPPER', 'Copper', 'USD per pound', 'COMEX:HG1!', 'COMEX copper futures. Essential for power grids, EVs and data centers; often called "Dr. Copper" for tracking the economy.', ['metal']);
  cm('Industrial metals', 'ALI=F', 'ALUM', 'Aluminum', 'USD per metric ton', 'COMEX:ALI1!', 'COMEX aluminum futures. Lightweight metal used in vehicles, packaging and construction.', ['metal']);
  cm('Energy', 'CL=F', 'WTI', 'Crude Oil (WTI)', 'USD per barrel', 'NYMEX:CL1!', 'West Texas Intermediate crude futures on NYMEX, the US oil benchmark, delivered at Cushing, Oklahoma.', ['energy']);
  cm('Energy', 'BZ=F', 'BRENT', 'Brent Crude', 'USD per barrel', 'TVC:UKOIL', 'Brent crude futures, the international benchmark for about two-thirds of the world\'s oil.', ['energy']);
  cm('Energy', 'NG=F', 'NATGAS', 'Natural Gas (Henry Hub)', 'USD per MMBtu', 'NYMEX:NG1!', 'NYMEX natural-gas futures priced at Henry Hub, Louisiana. Heavily driven by weather and LNG exports.', ['energy']);
  cm('Energy', 'RB=F', 'RBOB', 'Gasoline (RBOB)', 'USD per gallon', 'NYMEX:RB1!', 'NYMEX reformulated gasoline futures (New York Harbor), which drive US pump prices.', ['energy']);
  cm('Energy', 'HO=F', 'HEATOIL', 'Heating Oil / Diesel', 'USD per gallon', 'NYMEX:HO1!', 'NYMEX ultra-low-sulfur diesel futures (New York Harbor).', ['energy']);
  cm('Agriculture', 'ZC=F', 'CORN', 'Corn', 'US cents per bushel', 'CBOT:ZC1!', 'CBOT corn futures. The US is the largest producer; used for feed, ethanol and food.', ['ag']);
  cm('Agriculture', 'ZW=F', 'WHEAT', 'Wheat (Chicago SRW)', 'US cents per bushel', 'CBOT:ZW1!', 'CBOT soft red winter wheat futures.', ['ag']);
  cm('Agriculture', 'ZS=F', 'SOY', 'Soybeans', 'US cents per bushel', 'CBOT:ZS1!', 'CBOT soybean futures. China is by far the largest importer, so trade policy moves prices.', ['ag']);
  cm('Agriculture', 'KC=F', 'COFFEE', 'Coffee (Arabica)', 'US cents per pound', 'ICEUS:KC1!', 'ICE arabica coffee futures. Brazil and Colombia are key producers.', ['ag']);
  cm('Agriculture', 'CC=F', 'COCOA', 'Cocoa', 'USD per metric ton', 'ICEUS:CC1!', 'ICE New York cocoa futures. Supply is concentrated in Ivory Coast and Ghana.', ['ag']);
  cm('Agriculture', 'SB=F', 'SUGAR', 'Sugar #11', 'US cents per pound', 'ICEUS:SB1!', 'ICE raw-sugar futures, the world benchmark.', ['ag']);
  cm('Agriculture', 'CT=F', 'COTTON', 'Cotton #2', 'US cents per pound', 'ICEUS:CT1!', 'ICE cotton futures.', ['ag']);
  cm('Agriculture', 'OJ=F', 'OJ', 'Orange Juice', 'US cents per pound', 'ICEUS:OJ1!', 'ICE frozen concentrated orange juice futures; a thinly traded, weather-driven market.', ['ag']);
  cm('Livestock', 'LE=F', 'CATTLE', 'Live Cattle', 'US cents per pound', 'CME:LE1!', 'CME live-cattle futures.', ['ag']);
  cm('Livestock', 'HE=F', 'HOGS', 'Lean Hogs', 'US cents per pound', 'CME:HE1!', 'CME lean-hog futures.', ['ag']);
  cm('Agriculture', 'LBR=F', 'LUMBER', 'Lumber', 'USD per 1,000 board feet', 'CME:LBR1!', 'CME lumber futures; closely tied to US housing construction.', ['ag']);

  // ------------------------------------------------------------ Currencies
  const fx = (g, id, s, n, tv, d) => add('fx', g, id, s, n, d, { tv });
  fx('Index', 'DX-Y.NYB', 'DXY', 'US Dollar Index', 'TVC:DXY', 'The dollar against six major currencies, weighted heavily toward the euro (57.6%). Above 100 means the dollar is stronger than the 1973 base.');
  fx('Majors', 'EURUSD=X', 'EUR/USD', 'Euro / US Dollar', 'FX:EURUSD', 'The most traded currency pair. Price is dollars per euro.');
  fx('Majors', 'JPY=X', 'USD/JPY', 'US Dollar / Japanese Yen', 'FX:USDJPY', 'Yen per dollar. Sensitive to the gap between US and Japanese interest rates.');
  fx('Majors', 'GBPUSD=X', 'GBP/USD', 'British Pound / US Dollar', 'FX:GBPUSD', 'Dollars per pound ("cable").');
  fx('Majors', 'CHF=X', 'USD/CHF', 'US Dollar / Swiss Franc', 'FX:USDCHF', 'Francs per dollar; the franc is a traditional safe haven.');
  fx('Majors', 'AUDUSD=X', 'AUD/USD', 'Australian Dollar / US Dollar', 'FX:AUDUSD', 'Dollars per Aussie dollar; tracks commodity prices and China\'s economy.');
  fx('Majors', 'CAD=X', 'USD/CAD', 'US Dollar / Canadian Dollar', 'FX:USDCAD', 'Canadian dollars per US dollar ("loonie"); linked to oil prices.');
  fx('Majors', 'NZDUSD=X', 'NZD/USD', 'New Zealand Dollar / US Dollar', 'FX:NZDUSD', 'Dollars per kiwi.');
  fx('Crosses', 'EURGBP=X', 'EUR/GBP', 'Euro / British Pound', 'FX:EURGBP', 'Pounds per euro.');
  fx('Crosses', 'EURJPY=X', 'EUR/JPY', 'Euro / Japanese Yen', 'FX:EURJPY', 'Yen per euro.');
  fx('Crosses', 'EURCHF=X', 'EUR/CHF', 'Euro / Swiss Franc', 'FX:EURCHF', 'Francs per euro.');
  fx('Crosses', 'GBPJPY=X', 'GBP/JPY', 'British Pound / Japanese Yen', 'FX:GBPJPY', 'Yen per pound; a volatile cross.');
  fx('Emerging & Asia', 'CNY=X', 'USD/CNY', 'US Dollar / Chinese Yuan', 'FX_IDC:USDCNY', 'Onshore yuan per dollar, managed around a daily fixing by the People\'s Bank of China.');
  fx('Emerging & Asia', 'HKD=X', 'USD/HKD', 'US Dollar / Hong Kong Dollar', 'FX_IDC:USDHKD', 'Pegged within a 7.75-7.85 band since 2005.');
  fx('Emerging & Asia', 'SGD=X', 'USD/SGD', 'US Dollar / Singapore Dollar', 'FX_IDC:USDSGD', 'Singapore dollars per US dollar.');
  fx('Emerging & Asia', 'INR=X', 'USD/INR', 'US Dollar / Indian Rupee', 'FX_IDC:USDINR', 'Rupees per dollar.');
  fx('Emerging & Asia', 'KRW=X', 'USD/KRW', 'US Dollar / South Korean Won', 'FX_IDC:USDKRW', 'Won per dollar.');
  fx('Emerging & Asia', 'MXN=X', 'USD/MXN', 'US Dollar / Mexican Peso', 'FX:USDMXN', 'Pesos per dollar.');
  fx('Emerging & Asia', 'BRL=X', 'USD/BRL', 'US Dollar / Brazilian Real', 'FX_IDC:USDBRL', 'Reais per dollar.');
  fx('Emerging & Asia', 'ZAR=X', 'USD/ZAR', 'US Dollar / South African Rand', 'FX:USDZAR', 'Rand per dollar.');
  fx('Emerging & Asia', 'TRY=X', 'USD/TRY', 'US Dollar / Turkish Lira', 'FX:USDTRY', 'Lira per dollar; the lira has lost most of its value over the past decade because of high inflation.');
  fx('Crosses', 'SEK=X', 'USD/SEK', 'US Dollar / Swedish Krona', 'FX:USDSEK', 'Kronor per dollar.');
  fx('Crosses', 'NOK=X', 'USD/NOK', 'US Dollar / Norwegian Krone', 'FX:USDNOK', 'Kroner per dollar; linked to oil.');

  // -------------------------------------------------------------- Rates
  const rt = (id, s, n, tv, d) => add('rate', 'US Treasury yields', id, s, n, d, { tv, unit: '%' });
  rt('^IRX', 'US3M', '13-Week Treasury Bill', 'TVC:US03MY', 'Yield on 3-month US Treasury bills, closely tied to the Fed\'s policy rate; roughly what cash in T-bills or money-market funds earns.');
  rt('^FVX', 'US5Y', '5-Year Treasury Note', 'TVC:US05Y', 'Yield on the 5-year Treasury note.');
  rt('^TNX', 'US10Y', '10-Year Treasury Note', 'TVC:US10Y', 'Yield on the 10-year Treasury note, the benchmark for mortgages and for valuing stocks.');
  rt('^TYX', 'US30Y', '30-Year Treasury Bond', 'TVC:US30Y', 'Yield on the 30-year Treasury bond.');

  // ---------------------------------------------------------------- Crypto
  // y: Yahoo symbol used by the pipeline for multi-year history (only where the symbol is unambiguous).
  const cr = (g, cg, s, n, d, extra) => add('crypto', g, 'c:' + cg, s, n, d, Object.assign({ cg }, extra || {}));
  cr('Layer 1', 'bitcoin', 'BTC', 'Bitcoin', 'The first cryptocurrency (2009), created by the pseudonymous Satoshi Nakamoto. Supply is capped at 21 million coins; new coins are issued to proof-of-work miners and the issuance rate halves roughly every four years (most recently in April 2024).', { y: 'BTC-USD', cb: 'BTC-USD', tv: 'COINBASE:BTCUSD' });
  cr('Layer 1', 'ethereum', 'ETH', 'Ethereum', 'Programmable blockchain that runs smart contracts and hosts most DeFi, stablecoins and NFTs. Moved to proof-of-stake in 2022 ("the Merge"); ether pays transaction fees and staking rewards.', { y: 'ETH-USD', cb: 'ETH-USD', tv: 'COINBASE:ETHUSD' });
  cr('Stablecoin', 'tether', 'USDT', 'Tether', 'The largest stablecoin, designed to hold a 1:1 value with the US dollar and backed mainly by Treasury bills. Issued by Tether, based in El Salvador.', { tv: 'BINANCE:USDTUSD' });
  cr('Layer 1', 'ripple', 'XRP', 'XRP', 'Native token of the XRP Ledger, designed for fast cross-border payments; closely associated with Ripple Labs, whose SEC lawsuit ended in 2025.', { y: 'XRP-USD', cb: 'XRP-USD', tv: 'BINANCE:XRPUSDT' });
  cr('Layer 1', 'binancecoin', 'BNB', 'BNB', 'Token of the BNB Chain and the Binance exchange ecosystem, used for fees and trading discounts.', { y: 'BNB-USD', tv: 'BINANCE:BNBUSDT' });
  cr('Layer 1', 'solana', 'SOL', 'Solana', 'High-throughput proof-of-stake blockchain popular for trading, payments, memecoins and consumer apps.', { y: 'SOL-USD', cb: 'SOL-USD', tv: 'COINBASE:SOLUSD' });
  cr('Stablecoin', 'usd-coin', 'USDC', 'USD Coin', 'Dollar-pegged stablecoin issued by Circle (NYSE: CRCL), backed by cash and short-term Treasuries.', { tv: 'COINBASE:USDCUSD' });
  cr('Layer 1', 'tron', 'TRX', 'TRON', 'Blockchain widely used to move USDT stablecoins cheaply, especially in emerging markets.', { y: 'TRX-USD', tv: 'BINANCE:TRXUSDT' });
  cr('Meme', 'dogecoin', 'DOGE', 'Dogecoin', 'Proof-of-work coin started as a joke in 2013; has no supply cap and is popularized by Elon Musk.', { y: 'DOGE-USD', cb: 'DOGE-USD', tv: 'BINANCE:DOGEUSDT' });
  cr('Layer 1', 'cardano', 'ADA', 'Cardano', 'Proof-of-stake blockchain developed with a research-first approach, founded by Ethereum co-founder Charles Hoskinson.', { y: 'ADA-USD', cb: 'ADA-USD', tv: 'BINANCE:ADAUSDT' });
  cr('DeFi', 'hyperliquid', 'HYPE', 'Hyperliquid', 'Token of Hyperliquid, a high-performance blockchain built around an on-chain perpetual-futures exchange.', { tv: 'BYBIT:HYPEUSDT' });
  cr('Infrastructure', 'chainlink', 'LINK', 'Chainlink', 'Oracle network that feeds real-world data (prices, reserves) into smart contracts.', { y: 'LINK-USD', cb: 'LINK-USD', tv: 'BINANCE:LINKUSDT' });
  cr('Layer 1', 'stellar', 'XLM', 'Stellar', 'Payments network for issuing and moving tokenized money across borders.', { y: 'XLM-USD', cb: 'XLM-USD', tv: 'BINANCE:XLMUSDT' });
  cr('Layer 1', 'sui', 'SUI', 'Sui', 'High-performance layer-1 blockchain created by former Meta engineers (Mysten Labs).', { cb: 'SUI-USD', tv: 'BINANCE:SUIUSDT' });
  cr('Layer 1', 'bitcoin-cash', 'BCH', 'Bitcoin Cash', 'Fork of Bitcoin (2017) with larger blocks for cheaper payments.', { y: 'BCH-USD', cb: 'BCH-USD', tv: 'COINBASE:BCHUSD' });
  cr('Layer 1', 'avalanche-2', 'AVAX', 'Avalanche', 'Smart-contract platform that lets projects launch their own interoperable chains.', { y: 'AVAX-USD', cb: 'AVAX-USD', tv: 'BINANCE:AVAXUSDT' });
  cr('Layer 1', 'hedera-hashgraph', 'HBAR', 'Hedera', 'Public ledger governed by a council of large companies, using the hashgraph consensus algorithm.', { y: 'HBAR-USD', cb: 'HBAR-USD', tv: 'BINANCE:HBARUSDT' });
  cr('Layer 1', 'litecoin', 'LTC', 'Litecoin', 'One of the oldest cryptocurrencies (2011), a faster, lighter variant of Bitcoin.', { y: 'LTC-USD', cb: 'LTC-USD', tv: 'COINBASE:LTCUSD' });
  cr('Layer 1', 'the-open-network', 'TON', 'Toncoin', 'Blockchain integrated with the Telegram messaging app.', { tv: 'OKX:TONUSDT' });
  cr('Meme', 'shiba-inu', 'SHIB', 'Shiba Inu', 'Dog-themed meme token on Ethereum.', { y: 'SHIB-USD', cb: 'SHIB-USD', tv: 'BINANCE:SHIBUSDT' });
  cr('Layer 1', 'polkadot', 'DOT', 'Polkadot', 'Network that connects multiple specialized blockchains, founded by Ethereum co-founder Gavin Wood.', { y: 'DOT-USD', cb: 'DOT-USD', tv: 'BINANCE:DOTUSDT' });
  cr('Privacy', 'monero', 'XMR', 'Monero', 'Privacy-focused cryptocurrency that hides senders, receivers and amounts by default; delisted by many exchanges.', { y: 'XMR-USD', tv: 'KRAKEN:XMRUSD' });
  cr('DeFi', 'uniswap', 'UNI', 'Uniswap', 'Governance token of Uniswap, the largest decentralized exchange.', { cb: 'UNI-USD', tv: 'BINANCE:UNIUSDT' });
  cr('Meme', 'pepe', 'PEPE', 'Pepe', 'Frog-themed meme token on Ethereum launched in 2023.', { cb: 'PEPE-USD', tv: 'BINANCE:PEPEUSDT' });
  cr('DeFi', 'aave', 'AAVE', 'Aave', 'Token of Aave, the largest decentralized lending protocol.', { cb: 'AAVE-USD', tv: 'BINANCE:AAVEUSDT' });
  cr('Layer 1', 'near', 'NEAR', 'NEAR Protocol', 'Sharded proof-of-stake blockchain focused on usability and AI agents.', { cb: 'NEAR-USD', tv: 'BINANCE:NEARUSDT' });
  cr('Stablecoin', 'ethena-usde', 'USDe', 'Ethena USDe', 'Synthetic dollar that holds crypto while shorting perpetual futures to stay near $1 ("delta-neutral"); carries different risks than reserve-backed stablecoins.');
  cr('Layer 1', 'internet-computer', 'ICP', 'Internet Computer', 'Blockchain that aims to host full web applications on-chain, developed by the DFINITY Foundation.', { cb: 'ICP-USD', tv: 'BINANCE:ICPUSDT' });
  cr('Layer 1', 'aptos', 'APT', 'Aptos', 'Layer-1 blockchain using the Move language, founded by former Meta Diem engineers.', { cb: 'APT-USD', tv: 'BINANCE:APTUSDT' });
  cr('RWA', 'ondo-finance', 'ONDO', 'Ondo', 'Token of Ondo Finance, which issues tokenized Treasuries and tokenized US stocks.', { cb: 'ONDO-USD', tv: 'BINANCE:ONDOUSDT' });
  cr('Layer 1', 'ethereum-classic', 'ETC', 'Ethereum Classic', 'The original Ethereum chain that continued after the 2016 DAO fork; still proof-of-work.', { y: 'ETC-USD', cb: 'ETC-USD', tv: 'BINANCE:ETCUSDT' });
  cr('AI', 'bittensor', 'TAO', 'Bittensor', 'Decentralized network that rewards contributors of machine-learning models and compute.', { tv: 'BINANCE:TAOUSDT' });
  cr('AI', 'render-token', 'RENDER', 'Render', 'Marketplace for distributed GPU rendering and AI compute.', { tv: 'BINANCE:RENDERUSDT' });
  cr('Layer 2', 'arbitrum', 'ARB', 'Arbitrum', 'Governance token of Arbitrum, the largest Ethereum layer-2 rollup.', { cb: 'ARB-USD', tv: 'BINANCE:ARBUSDT' });
  cr('Layer 1', 'cosmos', 'ATOM', 'Cosmos Hub', 'Hub of the Cosmos ecosystem of interoperable blockchains.', { y: 'ATOM-USD', cb: 'ATOM-USD', tv: 'BINANCE:ATOMUSDT' });
  cr('Infrastructure', 'filecoin', 'FIL', 'Filecoin', 'Decentralized file-storage network.', { y: 'FIL-USD', cb: 'FIL-USD', tv: 'BINANCE:FILUSDT' });
  cr('Layer 1', 'algorand', 'ALGO', 'Algorand', 'Pure proof-of-stake blockchain founded by MIT professor Silvio Micali.', { y: 'ALGO-USD', cb: 'ALGO-USD', tv: 'BINANCE:ALGOUSDT' });
  cr('Layer 1', 'kaspa', 'KAS', 'Kaspa', 'Proof-of-work coin using a "blockDAG" structure for fast blocks.', { tv: 'MEXC:KASUSDT' });
  cr('Gold token', 'pax-gold', 'PAXG', 'PAX Gold', 'Each token represents one fine troy ounce of a London Good Delivery gold bar held by Paxos.', { cb: 'PAXG-USD', tv: 'BINANCE:PAXGUSDT', t: ['metal'] });
  cr('Gold token', 'tether-gold', 'XAUT', 'Tether Gold', 'Each token represents one troy ounce of physical gold held in Switzerland by Tether.', { t: ['metal'] });
  cr('Meme', 'official-trump', 'TRUMP', 'Official Trump', 'Memecoin on Solana launched in January 2025 and promoted by Donald Trump; insiders hold most of the supply.');
  cr('Meme', 'bonk', 'BONK', 'Bonk', 'Dog-themed community memecoin on Solana.', { cb: 'BONK-USD', tv: 'BINANCE:BONKUSDT' });
  cr('Layer 2', 'polygon-ecosystem-token', 'POL', 'Polygon', 'Token of Polygon (formerly MATIC), a network of Ethereum scaling chains.', { cb: 'POL-USD', tv: 'BINANCE:POLUSDT' });
  cr('DeFi', 'ethena', 'ENA', 'Ethena', 'Governance token of the Ethena protocol that issues USDe.', { tv: 'BINANCE:ENAUSDT' });
  cr('NFT-linked', 'pudgy-penguins', 'PENGU', 'Pudgy Penguins', 'Fungible token of the Pudgy Penguins NFT brand, launched on Solana in December 2024.', { tv: 'BINANCE:PENGUUSDT' });
  cr('AI', 'worldcoin-wld', 'WLD', 'Worldcoin', 'Token of World, a digital-identity project co-founded by Sam Altman that verifies humans by iris scan.', { tv: 'BINANCE:WLDUSDT' });

  // ------------------------------------------------------------------ NFTs
  // Ethereum contract addresses; the pipeline asks CoinGecko for floor price, volume and holders.
  const nft = (slug, n, contract, d) => add('nft', 'Ethereum', 'n:' + slug, n, n, d, { contract, chain: 'ethereum' });
  nft('cryptopunks', 'CryptoPunks', '0xb47e3cd837ddf8e4c57f05d70ab865de6e193bbb', '10,000 pixel-art characters released for free by Larva Labs in 2017, among the first NFTs on Ethereum. Now owned by the non-profit Infinite Node Foundation (acquired from Yuga Labs in 2025).');
  nft('bored-ape-yacht-club', 'Bored Ape Yacht Club', '0xbc4ca0eda7647a8ab7c2061c2e118a18a936f13d', '10,000 ape avatars from Yuga Labs (2021) that double as membership in a club; the defining NFT of the 2021 boom.');
  nft('pudgy-penguins', 'Pudgy Penguins', '0xbd3531da5cf5857e7cfaa92426877b022e612cf8', '8,888 penguin avatars (2021) grown into a consumer brand with toys sold at major retailers and the PENGU token.');
  nft('mutant-ape-yacht-club', 'Mutant Ape Yacht Club', '0x60e4d786628fea6478f785a6d7e704777c86a7c6', 'Roughly 19,400 "mutated" apes airdropped to BAYC holders via serum in 2021.');
  nft('azuki', 'Azuki', '0xed5af388653567af2f388e6224dc7c4b3241c544', '10,000 anime-style avatars from Chiru Labs (2022).');
  nft('milady-maker', 'Milady Maker', '0x5af0d9827e0c53e4799bb226655a1de152a425a5', '10,000 "neochibi" avatars (2021) with a strong internet-subculture following.');
  nft('lil-pudgys', 'Lil Pudgys', '0x524cab2ec69124574082676e6f654a18df49a048', '22,222 companion collection to Pudgy Penguins.');
  nft('chromie-squiggle-by-snowfro', 'Chromie Squiggle', '0x059edd72cd353df5106d2b9cc5ab83a52287ac3a', 'Generative-art series by Art Blocks founder Erick Calderon (Snowfro), the first Art Blocks project (2020).');
  nft('autoglyphs', 'Autoglyphs', '0xd4e4078ca3495de5b1d4db434bebc5a986197782', 'The first "on-chain" generative art on Ethereum (2019) by Larva Labs: 512 glyphs generated entirely by the smart contract.');
  nft('doodles-official', 'Doodles', '0x8a90cab2b38dba80c64b7734e58ee1db38b8992e', '10,000 colorful hand-drawn characters by Burnt Toast (2021).');
  nft('moonbirds', 'Moonbirds', '0x23581767a106ae21c074b2276d25e5c3e136a68b', '10,000 pixel owls (2022) that can be "nested" (staked); now run by Orange Cap Games.');
  nft('meebits', 'Meebits', '0x7bd29408f11d2bfc23c34f18275bbf23bb716bc7', '20,000 3D voxel characters from Larva Labs (2021).');
  nft('clonex', 'CLONE X', '0x49cf6f5d44e70224e2e23fdcdd2c053f30ada28b', '20,000 3D avatars by RTFKT and Takashi Murakami (2021). Nike, which bought RTFKT, wound the studio down at the start of 2025.');
  nft('otherdeed-for-otherside', 'Otherdeed for Otherside', '0x34d85c9cdeb23fa97cb08333b511ac86e1c4e258', 'Virtual land plots in Yuga Labs\' Otherside metaverse (2022).');
  nft('world-of-women-nft', 'World of Women', '0xe785e82358879f061bc3dcac6f0444462d4b5330', '10,000 portraits of women by artist Yam Karkai (2021).');
  nft('cool-cats-nft', 'Cool Cats', '0x1a92f7381b9f03921564a437210bb9396471050c', '9,999 blue cat avatars (2021).');

  // ------------------------------------------------------------- Classes
  const classes = [
    { id: 'stock', n: 'Stocks', sub: 'Ownership in public companies', icon: 'stock' },
    { id: 'etf', n: 'ETFs & Funds', sub: 'Baskets in a single trade', icon: 'etf' },
    { id: 'crypto', n: 'Crypto', sub: 'Bitcoin, Ethereum and the top 100', icon: 'crypto' },
    { id: 'nft', n: 'NFTs', sub: 'Collections and floor prices', icon: 'nft' },
    { id: 'index', n: 'Indices', sub: 'Market benchmarks worldwide', icon: 'index' },
    { id: 'commodity', n: 'Commodities', sub: 'Metals, energy, crops', icon: 'commodity' },
    { id: 'fx', n: 'Currencies', sub: 'Forex majors and emerging', icon: 'fx' },
    { id: 'rate', n: 'Bonds & Rates', sub: 'Treasuries, yields, bond funds', icon: 'bond' },
    { id: 'realestate', n: 'Real Estate', sub: 'REITs, housing, farmland', icon: 'home' },
    { id: 'art', n: 'Art', sub: 'Auctions, records, how to invest', icon: 'art' },
    { id: 'collectible', n: 'Collectibles', sub: 'Watches, wine, cars, cards', icon: 'collect' },
    { id: 'private', n: 'Private Markets', sub: 'Pre-IPO giants and 2026 IPOs', icon: 'private' },
    { id: 'cash', n: 'Cash & Savings', sub: 'Savings, T-bills, I bonds, CDs', icon: 'cash' },
    { id: 'alt', n: 'Alternatives', sub: 'Private credit, royalties, carbon', icon: 'alt' }
  ];

  const byId = {};
  A.forEach((a) => { byId[a.id] = a; });

  root.CATALOG = { assets: A, byId, classes };
})(typeof window !== 'undefined' ? window : globalThis);
