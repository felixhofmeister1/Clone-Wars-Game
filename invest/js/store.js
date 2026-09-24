/* Local persistence: watchlists, holdings, paper trading, alerts, settings. */
(function () {
  'use strict';
  const App = (window.App = window.App || {});
  const KEY = 'invest.v1';
  const listeners = new Set();

  const DEFAULT = () => ({
    settings: {
      theme: 'system', // system | dark | light
      changeMode: 'pct', // pct | abs | mcap
      baseCur: 'USD',
      liveCrypto: true,
      remoteData: true,
      finnhubKey: '',
      cgKey: '',
      reduceMotion: false,
      hideBalances: false
    },
    watchlists: [
      { id: 'main', name: 'My Watchlist', items: ['^GSPC', '^IXIC', '^DJI', 'AAPL', 'NVDA', 'MSFT', 'SPCX', 'c:bitcoin', 'c:ethereum', 'GC=F', 'CL=F', '^TNX'] }
    ],
    activeList: 'main',
    holdings: [], // {id, asset, qty, cost, date, note, cur}
    custom: {}, // id -> {name, value, cur, cls, note, updated}
    paper: null, // created on first use
    alerts: [], // {id, asset, op: 'above'|'below', price, created, fired}
    recent: [],
    seen: {}
  });

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return DEFAULT();
      const s = JSON.parse(raw);
      const d = DEFAULT();
      s.settings = Object.assign(d.settings, s.settings || {});
      for (const k of Object.keys(d)) if (s[k] === undefined) s[k] = d[k];
      if (!Array.isArray(s.watchlists) || !s.watchlists.length) s.watchlists = d.watchlists;
      return s;
    } catch (e) {
      return DEFAULT();
    }
  }

  const state = load();
  let saveTimer = null;
  function save() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* storage full or blocked */ }
    }, 50);
    listeners.forEach((fn) => { try { fn(state); } catch (e) { console.error(e); } });
  }

  const S = (App.S = {
    state,
    save,
    on: (fn) => { listeners.add(fn); return () => listeners.delete(fn); },
    get settings() { return state.settings; },
    set(key, value) { state.settings[key] = value; save(); },

    // ---------------------------------------------------------- watchlists
    list() { return state.watchlists.find((w) => w.id === state.activeList) || state.watchlists[0]; },
    inAnyList(id) { return state.watchlists.some((w) => w.items.includes(id)); },
    inList(id, listId) { const w = state.watchlists.find((x) => x.id === (listId || state.activeList)); return !!w && w.items.includes(id); },
    toggleWatch(id, listId) {
      const w = state.watchlists.find((x) => x.id === (listId || state.activeList)) || state.watchlists[0];
      const i = w.items.indexOf(id);
      if (i >= 0) w.items.splice(i, 1); else w.items.push(id);
      save();
      return i < 0;
    },
    addList(name) {
      const w = { id: App.U.uid(), name: name || 'New List', items: [] };
      state.watchlists.push(w);
      state.activeList = w.id;
      save();
      return w;
    },
    renameList(id, name) { const w = state.watchlists.find((x) => x.id === id); if (w) { w.name = name; save(); } },
    deleteList(id) {
      if (state.watchlists.length <= 1) return;
      state.watchlists = state.watchlists.filter((w) => w.id !== id);
      if (state.activeList === id) state.activeList = state.watchlists[0].id;
      save();
    },
    setActiveList(id) { state.activeList = id; save(); },
    reorder(id, from, to) {
      const w = state.watchlists.find((x) => x.id === id);
      if (!w) return;
      const [it] = w.items.splice(from, 1);
      w.items.splice(to, 0, it);
      save();
    },

    // ---------------------------------------------------------- holdings
    addHolding(h) { state.holdings.push(Object.assign({ id: App.U.uid(), date: new Date().toISOString().slice(0, 10) }, h)); save(); },
    updateHolding(id, patch) { const h = state.holdings.find((x) => x.id === id); if (h) { Object.assign(h, patch); save(); } },
    removeHolding(id) { state.holdings = state.holdings.filter((x) => x.id !== id); save(); },
    addCustom(c) { const id = 'x:' + App.U.uid(); state.custom[id] = Object.assign({ updated: Date.now() }, c); save(); return id; },
    updateCustom(id, patch) { if (state.custom[id]) { Object.assign(state.custom[id], patch, { updated: Date.now() }); save(); } },
    removeCustom(id) { delete state.custom[id]; state.holdings = state.holdings.filter((h) => h.asset !== id); save(); },

    // ---------------------------------------------------------- paper trading
    paper() {
      if (!state.paper) state.paper = { start: 100000, cash: 100000, pos: {}, orders: [], created: Date.now() };
      return state.paper;
    },
    resetPaper(amount) { state.paper = { start: amount || 100000, cash: amount || 100000, pos: {}, orders: [], created: Date.now() }; save(); },
    paperTrade(asset, side, qty, price, meta) {
      const p = S.paper();
      // `meta.usd` is the order value in dollars when the asset trades in another currency.
      const cost = meta && typeof meta.usd === 'number' && isFinite(meta.usd) ? meta.usd : qty * price;
      const pos = p.pos[asset] || { qty: 0, cost: 0 };
      if (side === 'buy') {
        if (cost > p.cash + 1e-9) throw new Error('Not enough buying power');
        pos.cost = (pos.cost * pos.qty + qty * price) / (pos.qty + qty);
        pos.qty += qty;
        p.cash -= cost;
      } else {
        if (qty > pos.qty + 1e-9) throw new Error('You only own ' + App.U.fmtN(pos.qty, 0, 6));
        pos.qty -= qty;
        p.cash += cost;
        if (pos.qty < 1e-9) { pos.qty = 0; pos.cost = 0; }
      }
      if (pos.qty > 0) p.pos[asset] = pos; else delete p.pos[asset];
      p.orders.unshift(Object.assign({ id: App.U.uid(), t: Date.now(), asset, side, qty, price }, meta && meta.limit ? { limit: meta.limit } : {}));
      if (p.orders.length > 500) p.orders.length = 500;
      save();
    },

    // ---------------------------------------------------------- alerts
    addAlert(a) { state.alerts.push(Object.assign({ id: App.U.uid(), created: Date.now(), fired: null }, a)); save(); },
    removeAlert(id) { state.alerts = state.alerts.filter((a) => a.id !== id); save(); },

    // ---------------------------------------------------------- misc
    pushRecent(id) {
      state.recent = [id].concat(state.recent.filter((x) => x !== id)).slice(0, 12);
      save();
    },
    exportJSON() {
      return JSON.stringify({ app: 'invest', v: 1, exported: new Date().toISOString(), data: state }, null, 2);
    },
    importJSON(text) {
      const j = JSON.parse(text);
      const d = j && j.data ? j.data : j;
      if (!d || typeof d !== 'object' || !Array.isArray(d.watchlists)) throw new Error('Not an Invest backup file');
      Object.keys(state).forEach((k) => delete state[k]);
      Object.assign(state, DEFAULT(), d);
      save();
    },
    resetAll() {
      Object.keys(state).forEach((k) => delete state[k]);
      Object.assign(state, DEFAULT());
      save();
    }
  });
})();
