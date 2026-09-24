/* Router, navigation chrome, theme and boot. */
(function () {
  'use strict';
  const App = (window.App = window.App || {});
  const U = App.U;
  const UI = App.UI;
  const V = App.views;

  // ------------------------------------------------------------- theme
  const mqLight = window.matchMedia ? window.matchMedia('(prefers-color-scheme: light)') : null;
  App.applyTheme = () => {
    const s = App.S.settings;
    const theme = s.theme === 'system' ? (mqLight && mqLight.matches ? 'light' : 'dark') : s.theme;
    document.documentElement.dataset.theme = theme;
    document.documentElement.classList.toggle('reduce-motion', !!s.reduceMotion);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', theme === 'light' ? '#ffffff' : '#000000');
  };
  if (mqLight && mqLight.addEventListener) mqLight.addEventListener('change', () => { if (App.S.settings.theme === 'system') { App.applyTheme(); rerender(); } });

  // ------------------------------------------------------------- routes
  const ROUTES = [
    [/^$/, 'markets', 'markets'],
    [/^markets$/, 'markets', 'markets'],
    [/^brief$/, 'brief', 'markets'],
    [/^explore$/, 'explore', 'explore'],
    [/^explore\/([a-z]+)$/, 'cls', 'explore'],
    [/^a\/(.+)$/, 'asset', null],
    [/^watchlist$/, 'watchlist', 'watchlist'],
    [/^portfolio$/, 'portfolio', 'portfolio'],
    [/^more$/, 'more', 'more'],
    [/^more\/tools(?:\/([a-z0-9]+))?$/, 'tools', 'more'],
    [/^more\/learn(?:\/([a-z0-9]+))?$/, 'learn', 'more'],
    [/^more\/glossary$/, 'glossary', 'more'],
    [/^more\/economy$/, 'economy', 'more'],
    [/^more\/calendar$/, 'calendar', 'more'],
    [/^more\/alerts$/, 'alerts', 'more'],
    [/^more\/settings$/, 'settings', 'more'],
    [/^more\/data$/, 'data', 'more'],
    [/^more\/about$/, 'about', 'more']
  ];
  const TABS = [['markets', 'Markets', 'markets'], ['explore', 'Explore', 'explore'], ['watchlist', 'Watchlist', 'star'], ['portfolio', 'Portfolio', 'portfolio'], ['more', 'More', 'more']];
  const TOP = new Set(['markets', 'explore', 'watchlist', 'portfolio', 'more']);
  let activeTab = 'markets';
  const scrolls = {};
  const stack = [];

  function parse(hash) {
    const path = decodeURI(hash.replace(/^#\/?/, '')).replace(/\/$/, '');
    for (const [re, view, tab] of ROUTES) {
      const m = path.match(re);
      if (m) return { view, tab, args: m.slice(1).map((x) => (x === undefined ? undefined : decodeURIComponent(x))), path };
    }
    return { view: 'markets', tab: 'markets', args: [], path: 'markets' };
  }

  function chrome() {
    const tabs = TABS.map(([id, label, icon]) => `<a class="tab ${activeTab === id ? 'on' : ''}" href="#/${id}" aria-label="${label}" ${activeTab === id ? 'aria-current="page"' : ''}>${U.icon(icon)}<span>${label}</span></a>`).join('');
    document.getElementById('tabbar').innerHTML = tabs;
    const side = document.getElementById('side-nav');
    if (side) side.innerHTML = TABS.map(([id, label, icon]) => `<a class="side-item ${activeTab === id ? 'on' : ''}" href="#/${id}">${U.icon(icon)}<span>${label}</span></a>`).join('');
    const foot = document.getElementById('side-foot');
    if (foot) {
      const M = App.D.M;
      foot.innerHTML = `${M && M.updated ? 'Data updated ' + U.dateTimeET(Date.parse(M.updated)) : 'Research snapshot · Sep 23, 2026'}<br>${App.D.cg.src === 'live' ? 'Crypto live · ' : ''}<a href="#/more/data">Sources</a> · Not investment advice`;
    }
  }

  App.route = () => {
    const r = parse(location.hash);
    const main = document.getElementById('main');
    const key = r.path;
    if (App.current) {
      scrolls[App.current.key] = window.scrollY;
      if (App.current.view && App.current.view.leave) App.current.view.leave();
    }
    const back = stack.length >= 2 && stack[stack.length - 2] === key;
    if (back) stack.pop(); else stack.push(key);
    if (stack.length > 50) stack.shift();
    if (r.tab) activeTab = r.tab;
    const view = V[r.view];
    const el = document.createElement('div');
    el.className = 'view' + (!back && !TOP.has(r.view) ? ' push' : '');
    main.innerHTML = '';
    main.appendChild(el);
    App.current = { view, el, key, args: r.args, name: r.view };
    try {
      view.render(el, ...r.args);
    } catch (e) {
      console.error(e);
      el.innerHTML = UI.header('Something went wrong', { back: true }) + UI.empty('info', 'This page could not be shown', U.esc(e.message));
    }
    document.title = (view.title && r.view !== 'markets' ? view.title + ' · ' : '') + 'Invest';
    chrome();
    window.scrollTo(0, back && scrolls[key] ? scrolls[key] : 0);
    onScroll();
  };

  function rerender() { if (App.current) App.route(); }

  // ------------------------------------------------------------- nav behaviour
  function onScroll() {
    const nav = document.querySelector('#main .nav');
    if (nav) nav.classList.toggle('compact', window.scrollY > 36);
  }
  window.addEventListener('scroll', onScroll, { passive: true });

  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act="back"]');
    if (!b) return;
    e.preventDefault();
    if (stack.length > 1) history.back();
    else {
      const r = parse(location.hash);
      location.hash = '#/' + (r.tab || activeTab || 'markets');
    }
  });
  document.addEventListener('keydown', (e) => {
    const typing = /INPUT|TEXTAREA|SELECT/.test((e.target && e.target.tagName) || '');
    if ((e.key === 'k' && (e.metaKey || e.ctrlKey)) || (e.key === '/' && !typing)) { e.preventDefault(); UI.search(); return; }
    if (e.key === 'Escape') { if (!UI.closeTop() && stack.length > 1 && !typing) history.back(); return; }
    if (!typing && !e.metaKey && !e.ctrlKey && !e.altKey && /^[1-5]$/.test(e.key) && !document.querySelector('.sheet-wrap.on')) location.hash = '#/' + TABS[+e.key - 1][0];
  });

  // ------------------------------------------------------------- data hooks
  let refreshTimer = null;
  App.D.on(() => {
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(() => {
      const c = App.current;
      if (c && c.view && c.view.refresh && !document.querySelector('.sheet-wrap.on')) {
        const y = window.scrollY;
        try { c.view.refresh(c.el, ...c.args); } catch (e) { console.error(e); }
        window.scrollTo(0, y);
      }
      UI.refreshAllLive();
      chrome();
    }, 400);
  });
  App.onLive = (ids) => {
    const c = App.current;
    if (c && c.view && c.view.onLive) c.view.onLive(ids);
    if (App.checkPaperOrders) App.checkPaperOrders();
  };
  App.S.on(() => { /* settings or lists changed; views re-read state when they render */ });

  // ------------------------------------------------------------- boot
  function boot() {
    App.applyTheme();
    App.D.boot();
    UI.startTicker();
    window.addEventListener('hashchange', App.route);
    App.route();
    document.getElementById('side-search').addEventListener('click', () => UI.search());
    // Keep clocks and market-status labels current.
    setInterval(() => {
      const c = App.current;
      if (!c || document.hidden) return;
      if (c.name === 'markets' && c.view.refresh) {
        const box = c.el.querySelector('[data-part="clocks"]');
        const st = c.el.querySelector('.mstatus');
        if (st) { const mk = U.usMarket(); st.innerHTML = `<i class="status-dot ${mk.open ? 'open' : ''}"></i> ${U.esc(mk.label)}`; }
        if (box) c.view.refresh(c.el);
      }
    }, 60000);
    if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
