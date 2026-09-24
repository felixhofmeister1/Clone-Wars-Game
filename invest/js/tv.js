/*
 * TradingView embeds (free public widgets, no key): advanced chart, heatmaps,
 * news timeline, economic calendar, technical-analysis gauge, financials.
 * They load only when the user opens them, since each one is an iframe.
 */
(function () {
  'use strict';
  const App = (window.App = window.App || {});
  const TV = (App.TV = {});
  const base = 'https://s3.tradingview.com/external-embedding/embed-widget-';

  const theme = () => (document.documentElement.dataset.theme === 'light' ? 'light' : 'dark');
  const bg = () => (theme() === 'light' ? 'rgba(255,255,255,1)' : 'rgba(0,0,0,1)');

  TV.embed = (host, widget, config, height) => {
    host.innerHTML = '';
    host.classList.add('tv-host');
    if (height) host.style.height = height + 'px';
    const wrap = document.createElement('div');
    wrap.className = 'tradingview-widget-container';
    wrap.style.height = '100%';
    wrap.style.width = '100%';
    const inner = document.createElement('div');
    inner.className = 'tradingview-widget-container__widget';
    inner.style.height = '100%';
    wrap.appendChild(inner);
    const s = document.createElement('script');
    s.type = 'text/javascript';
    s.async = true;
    s.src = base + widget + '.js';
    s.innerHTML = JSON.stringify(Object.assign({ locale: 'en', colorTheme: theme(), isTransparent: true, width: '100%', height: '100%' }, config));
    s.onerror = () => { host.innerHTML = '<div class="chart-empty">TradingView could not be loaded (offline or blocked).</div>'; };
    wrap.appendChild(s);
    host.appendChild(wrap);
  };

  TV.advanced = (host, symbol, opts = {}) => TV.embed(host, 'advanced-chart', {
    autosize: true, symbol, interval: opts.interval || 'D', timezone: 'Etc/UTC', theme: theme(), style: '1',
    backgroundColor: bg(), gridColor: theme() === 'light' ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.06)',
    allow_symbol_change: true, calendar: false, hide_volume: false, support_host: 'https://www.tradingview.com'
  });

  TV.overview = (host, symbol, name, dir) => {
    const up = dir !== 'down';
    const line = up ? 'rgba(48,209,88,1)' : 'rgba(255,69,58,1)';
    TV.embed(host, 'symbol-overview', {
      symbols: [[name || symbol, symbol + '|1D']], chartOnly: false, autosize: true, showVolume: false, showMA: false,
      hideDateRanges: false, hideMarketStatus: false, hideSymbolLogo: true, scalePosition: 'right', scaleMode: 'Normal',
      fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", Inter, sans-serif', fontSize: '10', noTimeScale: false,
      valuesTracking: '1', changeMode: 'price-and-percent', chartType: 'area', lineWidth: 2, lineType: 0,
      dateRanges: ['1d|1', '1m|30', '3m|60', '12m|1D', '60m|1W', 'all|1M'],
      lineColor: line, topColor: line.replace(',1)', ',0.22)'), bottomColor: line.replace(',1)', ',0)'), backgroundColor: bg()
    });
  };

  TV.stockHeatmap = (host, source) => TV.embed(host, 'stock-heatmap', {
    exchanges: [], dataSource: source || 'SPX500', grouping: 'sector', blockSize: 'market_cap_basic', blockColor: 'change',
    hasTopBar: false, isDataSetEnabled: false, isZoomEnabled: true, hasSymbolTooltip: true, isMonoSize: false
  });
  TV.cryptoHeatmap = (host) => TV.embed(host, 'crypto-coins-heatmap', {
    dataSource: 'Crypto', blockSize: 'market_cap_calc', blockColor: '24h_close_change|5', hasTopBar: false,
    isDataSetEnabled: false, isZoomEnabled: true, hasSymbolTooltip: true, isMonoSize: false
  });
  TV.etfHeatmap = (host) => TV.embed(host, 'etf-heatmap', {
    dataSource: 'AllUSEtf', blockSize: 'aum', blockColor: 'change', grouping: 'asset_class', hasTopBar: false,
    isDataSetEnabled: false, isZoomEnabled: true, hasSymbolTooltip: true, isMonoSize: false
  });
  TV.news = (host, symbol) => TV.embed(host, 'timeline', symbol ? { feedMode: 'symbol', symbol, displayMode: 'regular' } : { feedMode: 'all_symbols', displayMode: 'regular' });
  TV.calendar = (host) => TV.embed(host, 'events', { importanceFilter: '0,1', countryFilter: 'us,eu,gb,jp,cn,de,ca' });
  TV.technicals = (host, symbol) => TV.embed(host, 'technical-analysis', { interval: '1D', symbol, showIntervalTabs: true, displayMode: 'single' });
  TV.financials = (host, symbol) => TV.embed(host, 'financials', { symbol, displayMode: 'regular' });
  TV.profile = (host, symbol) => TV.embed(host, 'symbol-profile', { symbol });

  // Best-guess TradingView symbol for an asset.
  TV.symbol = (a, q) => {
    if (!a) return null;
    if (a.tv) return a.tv;
    if (a.c === 'stock' || a.c === 'etf') {
      const x = (q && q.xc) || '';
      const pre = /^(NMS|NGM|NCM|NAS)$/.test(x) ? 'NASDAQ:' : /^(NYQ|NYS)$/.test(x) ? 'NYSE:' : /^(PCX|ASE)$/.test(x) ? 'AMEX:' : /^BTS$/.test(x) ? 'CBOE:' : '';
      return pre + a.id.replace('-', '.');
    }
    return null;
  };
})();
