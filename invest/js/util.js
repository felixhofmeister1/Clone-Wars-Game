/* Shared helpers: formatting, DOM, time zones, market hours, icons. */
(function () {
  'use strict';
  const App = (window.App = window.App || {});
  const U = (App.U = {});

  // ------------------------------------------------------------ numbers
  const isNum = (U.isNum = (x) => typeof x === 'number' && Number.isFinite(x));
  const nf = {};
  const fmtN = (U.fmtN = (x, min = 2, max = min) => {
    const k = min + ':' + max;
    if (!nf[k]) nf[k] = new Intl.NumberFormat('en-US', { minimumFractionDigits: min, maximumFractionDigits: max });
    return nf[k].format(x);
  });

  // Decimals appropriate for a price of this size / asset class.
  U.priceDigits = (p, cls) => {
    const a = Math.abs(p);
    if (cls === 'fx') return a >= 20 ? 2 : 4;
    if (cls === 'rate') return 2;
    if (a === 0) return 2;
    if (a >= 1) return 2;
    if (a >= 0.1) return 4;
    if (a >= 0.001) return 5;
    return Math.min(10, 2 - Math.floor(Math.log10(a)) + 2);
  };

  U.price = (p, cls, cur) => {
    if (!isNum(p)) return '—';
    const d = U.priceDigits(p, cls);
    const s = fmtN(p, d, d);
    if (cls === 'rate') return s + '%';
    const sym = U.curSym(cur);
    return sym ? sym + s : s;
  };

  const CUR = { USD: '$', EUR: '€', GBP: '£', JPY: '¥', CNY: '¥', HKD: 'HK$', CHF: 'CHF ', CAD: 'C$', AUD: 'A$', INR: '₹', KRW: '₩', SAR: 'SAR ', BRL: 'R$', TWD: 'NT$', SEK: 'kr ', NOK: 'kr ', MXN: 'MX$', SGD: 'S$', ZAR: 'R ', ETH: 'Ξ', GBp: 'GBp ' };
  U.curSym = (cur) => (cur === undefined || cur === null ? '' : CUR[cur] !== undefined ? CUR[cur] : cur + ' ');

  U.money = (x, cur = 'USD', digits) => {
    if (!isNum(x)) return '—';
    const d = digits !== undefined ? digits : Math.abs(x) >= 1 || x === 0 ? 2 : U.priceDigits(x);
    return (x < 0 ? '-' : '') + U.curSym(cur) + fmtN(Math.abs(x), d, d);
  };

  U.compact = (x, cur) => {
    if (!isNum(x)) return '—';
    const a = Math.abs(x);
    const sgn = x < 0 ? '-' : '';
    const sym = cur ? U.curSym(cur) : '';
    const f = (v, s) => sgn + sym + (v >= 100 ? fmtN(v, 0, 1) : v >= 10 ? fmtN(v, 1, 2) : fmtN(v, 2, 2)) + s;
    if (a >= 1e12) return f(a / 1e12, 'T');
    if (a >= 1e9) return f(a / 1e9, 'B');
    if (a >= 1e6) return f(a / 1e6, 'M');
    if (a >= 1e4) return f(a / 1e3, 'K');
    if (a === 0) return sym + '0';
    return sgn + sym + fmtN(a, a >= 100 ? 0 : 2, a >= 100 ? 0 : 2);
  };

  U.int = (x) => (isNum(x) ? fmtN(Math.round(x), 0, 0) : '—');
  U.pct = (x, digits = 2, sign = true) => (isNum(x) ? (sign && x > 0 ? '+' : x < 0 ? '−' : '') + fmtN(Math.abs(x), digits, digits) + '%' : '—');
  U.pctPlain = (x, digits = 2) => (isNum(x) ? fmtN(x, digits, digits) + '%' : '—');
  U.signed = (x, cls, cur) => {
    if (!isNum(x)) return '—';
    const d = cls === 'rate' ? 2 : U.priceDigits(x, cls);
    return (x > 0 ? '+' : x < 0 ? '−' : '') + (cls === 'rate' || cls === 'index' || cls === 'fx' ? '' : U.curSym(cur)) + fmtN(Math.abs(x), d, d);
  };
  U.dir = (x) => (!isNum(x) || x === 0 ? 'flat' : x > 0 ? 'up' : 'down');

  // ------------------------------------------------------------ time
  const dtf = {};
  U.fmtDate = (t, opts = { month: 'short', day: 'numeric' }, tz) => {
    if (!isNum(t)) return '—';
    const k = JSON.stringify(opts) + (tz || '');
    if (!dtf[k]) dtf[k] = new Intl.DateTimeFormat('en-US', Object.assign({}, opts, tz ? { timeZone: tz } : {}));
    return dtf[k].format(new Date(t));
  };
  U.dateLong = (t) => U.fmtDate(t, { month: 'short', day: 'numeric', year: 'numeric' });
  U.timeET = (t) => U.fmtDate(t, { hour: 'numeric', minute: '2-digit' }, 'America/New_York') + ' ET';
  U.dateTimeET = (t) => U.fmtDate(t, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }, 'America/New_York') + ' ET';
  U.ago = (t) => {
    if (!isNum(t)) return '';
    const s = Math.round((Date.now() - t) / 1000);
    if (s < 45) return 'just now';
    if (s < 90) return '1 min ago';
    if (s < 3600) return Math.round(s / 60) + ' min ago';
    if (s < 5400) return '1 hr ago';
    if (s < 86400) return Math.round(s / 3600) + ' hr ago';
    const d = Math.round(s / 86400);
    return d === 1 ? 'yesterday' : d + ' days ago';
  };
  U.isoToMs = (iso) => (iso ? Date.parse(iso) : NaN);

  // Wall-clock parts in a time zone.
  const zfmt = {};
  U.zoned = (tz, t = Date.now()) => {
    if (!zfmt[tz]) zfmt[tz] = new Intl.DateTimeFormat('en-US', { timeZone: tz, hour12: false, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', weekday: 'short' });
    const parts = zfmt[tz].formatToParts(new Date(t));
    const o = {};
    parts.forEach((p) => { o[p.type] = p.value; });
    return { y: +o.year, m: +o.month, d: +o.day, h: +o.hour % 24, min: +o.minute, wd: o.weekday, ymd: `${o.year}-${o.month}-${o.day}` };
  };

  // ------------------------------------------------------------ market hours
  // NYSE full-day holidays and 1:00 PM early closes (published NYSE calendar rules).
  const NYSE_HOLIDAYS = new Set([
    '2026-01-01', '2026-01-19', '2026-02-16', '2026-04-03', '2026-05-25', '2026-06-19', '2026-07-03', '2026-09-07', '2026-11-26', '2026-12-25',
    '2027-01-01', '2027-01-18', '2027-02-15', '2027-03-26', '2027-05-31', '2027-06-18', '2027-07-05', '2027-09-06', '2027-11-25', '2027-12-24'
  ]);
  const NYSE_EARLY = new Set(['2026-11-27', '2026-12-24', '2027-11-26']);
  const EXCHANGES = [
    { id: 'NYSE', n: 'New York', tz: 'America/New_York', open: [[570, 960]], hol: NYSE_HOLIDAYS, early: NYSE_EARLY },
    { id: 'TSX', n: 'Toronto', tz: 'America/Toronto', open: [[570, 960]] },
    { id: 'B3', n: 'São Paulo', tz: 'America/Sao_Paulo', open: [[600, 1020]] },
    { id: 'LSE', n: 'London', tz: 'Europe/London', open: [[480, 990]] },
    { id: 'XETRA', n: 'Frankfurt', tz: 'Europe/Berlin', open: [[540, 1050]] },
    { id: 'EPA', n: 'Paris', tz: 'Europe/Paris', open: [[540, 1050]] },
    { id: 'SIX', n: 'Zurich', tz: 'Europe/Zurich', open: [[540, 1050]] },
    { id: 'TADAWUL', n: 'Riyadh', tz: 'Asia/Riyadh', open: [[600, 900]], days: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu'] },
    { id: 'NSE', n: 'Mumbai', tz: 'Asia/Kolkata', open: [[555, 930]] },
    { id: 'SSE', n: 'Shanghai', tz: 'Asia/Shanghai', open: [[570, 690], [780, 900]] },
    { id: 'HKEX', n: 'Hong Kong', tz: 'Asia/Hong_Kong', open: [[570, 720], [780, 960]] },
    { id: 'TSE', n: 'Tokyo', tz: 'Asia/Tokyo', open: [[540, 690], [750, 930]] },
    { id: 'KRX', n: 'Seoul', tz: 'Asia/Seoul', open: [[540, 930]] },
    { id: 'ASX', n: 'Sydney', tz: 'Australia/Sydney', open: [[600, 960]] }
  ];
  U.EXCHANGES = EXCHANGES;

  U.exchangeStatus = (ex, t = Date.now()) => {
    const z = U.zoned(ex.tz, t);
    const mins = z.h * 60 + z.min;
    const days = ex.days || ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
    const holiday = ex.hol && ex.hol.has(z.ymd);
    let sessions = ex.open;
    if (ex.early && ex.early.has(z.ymd)) sessions = [[sessions[0][0], 780]];
    const tradingDay = days.includes(z.wd) && !holiday;
    let open = false;
    let closesIn = null;
    let opensIn = null;
    if (tradingDay) {
      for (const [a, b] of sessions) {
        if (mins >= a && mins < b) { open = true; closesIn = b - mins; break; }
        if (mins < a && opensIn === null) opensIn = a - mins;
      }
    }
    const local = U.fmtDate(t, { hour: 'numeric', minute: '2-digit' }, ex.tz);
    return { open, holiday, tradingDay, closesIn, opensIn, local, wd: z.wd, early: ex.early && ex.early.has(z.ymd) };
  };

  // Next NYSE open as a timestamp (searches up to 10 days ahead).
  U.nextNyseOpen = (t = Date.now()) => {
    const ex = EXCHANGES[0];
    for (let i = 0; i < 10 * 96; i++) {
      const tt = t + i * 15 * 60000;
      const s = U.exchangeStatus(ex, tt);
      if (s.open) return tt - ((U.zoned(ex.tz, tt).min % 15) * 60000);
    }
    return null;
  };

  U.usMarket = (t = Date.now()) => {
    const ex = EXCHANGES[0];
    const s = U.exchangeStatus(ex, t);
    const z = U.zoned(ex.tz, t);
    const mins = z.h * 60 + z.min;
    let label;
    let state;
    if (s.open) {
      state = 'open';
      const h = Math.floor(s.closesIn / 60);
      const m = s.closesIn % 60;
      label = `Market open · closes in ${h ? h + 'h ' : ''}${m}m`;
    } else if (s.tradingDay && mins >= 240 && mins < 570) {
      state = 'pre';
      label = 'Pre-market · opens 9:30 AM ET';
    } else if (s.tradingDay && mins >= 960 && mins < 1200) {
      state = 'post';
      label = 'After hours · closed at ' + (s.early ? '1:00' : '4:00') + ' PM ET';
    } else {
      state = 'closed';
      const nx = U.nextNyseOpen(t);
      label = s.holiday ? 'Market closed for holiday' : 'Market closed';
      if (nx) label += ' · opens ' + U.fmtDate(nx, { weekday: 'short', hour: 'numeric', minute: '2-digit' }, 'America/New_York') + ' ET';
    }
    return { state, label, open: s.open };
  };

  // ------------------------------------------------------------ DOM
  U.$ = (sel, root = document) => root.querySelector(sel);
  U.$$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  U.esc = (s) => String(s === undefined || s === null ? '' : s).replace(/[&<>"']/g, (c) => ESC[c]);
  U.h = (html) => {
    const t = document.createElement('template');
    t.innerHTML = html.trim();
    return t.content.firstElementChild;
  };
  U.debounce = (fn, ms) => {
    let id;
    return (...a) => { clearTimeout(id); id = setTimeout(() => fn(...a), ms); };
  };
  U.uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
  U.clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  U.loadScript = (src) => new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => { s.remove(); reject(new Error('load ' + src)); };
    document.head.appendChild(s);
  });
  U.fileSafe = (id) => id.replace(/[^A-Za-z0-9.-]/g, '_');
  U.haptic = () => { try { if (navigator.vibrate) navigator.vibrate(8); } catch (e) { /* ignore */ } };
  U.copy = async (text) => {
    try { await navigator.clipboard.writeText(text); return true; } catch (e) { return false; }
  };

  // ------------------------------------------------------------ icons
  // Line icons drawn on a 24px grid in the spirit of SF Symbols.
  const P = {
    markets: '<path d="M3 17l5-5 4 4 8-9"/><path d="M15 7h5v5"/>',
    explore: '<rect x="3.5" y="3.5" width="7" height="7" rx="2"/><rect x="13.5" y="3.5" width="7" height="7" rx="2"/><rect x="3.5" y="13.5" width="7" height="7" rx="2"/><rect x="13.5" y="13.5" width="7" height="7" rx="2"/>',
    star: '<path d="M12 3.5l2.6 5.3 5.9.9-4.25 4.1 1 5.8L12 16.9l-5.25 2.7 1-5.8L3.5 9.7l5.9-.9z"/>',
    starFill: '<path fill="currentColor" d="M12 3.5l2.6 5.3 5.9.9-4.25 4.1 1 5.8L12 16.9l-5.25 2.7 1-5.8L3.5 9.7l5.9-.9z"/>',
    portfolio: '<rect x="3" y="7" width="18" height="13" rx="2.5"/><path d="M8.5 7V5.5A1.5 1.5 0 0 1 10 4h4a1.5 1.5 0 0 1 1.5 1.5V7"/><path d="M3 12.5h18"/>',
    more: '<circle cx="12" cy="12" r="9"/><circle cx="8" cy="12" r=".9" fill="currentColor"/><circle cx="12" cy="12" r=".9" fill="currentColor"/><circle cx="16" cy="12" r=".9" fill="currentColor"/>',
    search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5L20 20"/>',
    chevR: '<path d="M9 5l7 7-7 7"/>',
    chevL: '<path d="M15 5l-7 7 7 7"/>',
    chevD: '<path d="M5 9l7 7 7-7"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
    bell: '<path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5.5M12 7.6v.1"/>',
    share: '<path d="M12 3v12M8 7l4-4 4 4"/><path d="M6 11H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1"/>',
    trash: '<path d="M4 7h16M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13"/>',
    edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>',
    grip: '<path d="M5 9h14M5 15h14"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/>',
    globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.7 3.8 5.7 3.8 9S14.5 18.3 12 21c-2.5-2.7-3.8-5.7-3.8-9S9.5 5.7 12 3z"/>',
    stock: '<path d="M4 19V5M4 19h16"/><path d="M7 15l4-4 3 3 5-6"/>',
    etf: '<circle cx="12" cy="12" r="8.5"/><path d="M12 3.5V12l6 6"/>',
    crypto: '<circle cx="12" cy="12" r="9"/><path d="M9.5 7.5h4a2 2 0 0 1 0 4h-4zm0 4h4.5a2.2 2.2 0 0 1 0 4.5H9.5zM9.5 7.5v9M11 6v1.5M11 16.5V18M13 6v1.5M13 16.5V18"/>',
    nft: '<rect x="3.5" y="4.5" width="17" height="15" rx="2.5"/><circle cx="9" cy="10" r="1.8"/><path d="M4 17l4.5-4 3.5 3 3-2.5 5 4"/>',
    index: '<path d="M4 20h16"/><rect x="5.5" y="11" width="3" height="6" rx=".8"/><rect x="10.5" y="7" width="3" height="10" rx=".8"/><rect x="15.5" y="4" width="3" height="13" rx=".8"/>',
    commodity: '<path d="M4 17.5l2.5-6h11l2.5 6z"/><path d="M8 11.5l2-5h4l2 5"/>',
    fx: '<path d="M4 8h13l-3-3M20 16H7l3 3"/>',
    bond: '<path d="M3.5 9L12 4.5 20.5 9"/><path d="M5.5 10v7M9.8 10v7M14.2 10v7M18.5 10v7M3.5 19.5h17"/>',
    home: '<path d="M4 11l8-6.5 8 6.5"/><path d="M6 10v10h12V10"/><path d="M10 20v-5h4v5"/>',
    art: '<path d="M12 3.5a8.5 8.5 0 1 0 0 17c1.4 0 1.8-1 1.3-2-.6-1.2.2-2.5 1.6-2.5H17a3.5 3.5 0 0 0 3.5-3.5c0-5-3.8-9-8.5-9z"/><circle cx="7.8" cy="11" r="1"/><circle cx="10" cy="7.3" r="1"/><circle cx="14.4" cy="7.3" r="1"/>',
    collect: '<circle cx="12" cy="12" r="5"/><path d="M9.5 3.5h5l.8 3.5M9.5 20.5h5l.8-3.5M8.7 7L9.5 3.5M8.7 17l.8 3.5"/><path d="M12 10v2.2l1.3 1.3"/>',
    private: '<rect x="5" y="10.5" width="14" height="10" rx="2.2"/><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5"/>',
    cash: '<rect x="2.5" y="6.5" width="19" height="11" rx="2"/><circle cx="12" cy="12" r="2.6"/><path d="M6 9.5v5M18 9.5v5"/>',
    alt: '<path d="M12 20.5c-4.5-2.2-7-6-7-10.5 3.4-.4 5.7.5 7 2.7 1.3-2.2 3.6-3.1 7-2.7 0 4.5-2.5 8.3-7 10.5z"/><path d="M12 12.7v7.8M12 12.7C12 8.5 10 5.5 7.5 3.5"/>',
    pie: '<path d="M12 3.5v8.5h8.5A8.5 8.5 0 1 1 12 3.5z"/><path d="M15 3.8A8.5 8.5 0 0 1 20.2 9H15z"/>',
    calc: '<rect x="5" y="3" width="14" height="18" rx="2.5"/><path d="M8 7h8M8 11.5h.01M12 11.5h.01M16 11.5h.01M8 15h.01M12 15h.01M16 15v2.5M8 18.5h.01M12 18.5h.01"/>',
    book: '<path d="M12 6.5C10 5 7.5 4.5 4 4.8v13.5c3.5-.3 6 .2 8 1.7 2-1.5 4.5-2 8-1.7V4.8c-3.5-.3-6 .2-8 1.7zM12 6.5V20"/>',
    news: '<rect x="3.5" y="4.5" width="14" height="15" rx="2"/><path d="M17.5 8.5h3v9a2 2 0 0 1-2 2M7 8.5h7M7 12h7M7 15.5h4"/>',
    cal: '<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
    gauge: '<path d="M4 17a8 8 0 1 1 16 0"/><path d="M12 17l4-5"/>',
    bolt: '<path d="M13 3L5 13.5h6L10 21l8-10.5h-6z"/>',
    refresh: '<path d="M20 12a8 8 0 1 1-2.3-5.6M20 4v5h-5"/>',
    copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>',
    sparkle: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 16l.7 1.8 1.8.7-1.8.7L19 21l-.7-1.8-1.8-.7 1.8-.7z"/>',
    heat: '<rect x="3.5" y="3.5" width="9" height="10" rx="1.5"/><rect x="13.5" y="3.5" width="7" height="6" rx="1.5"/><rect x="13.5" y="10.5" width="7" height="10" rx="1.5"/><rect x="3.5" y="14.5" width="9" height="6" rx="1.5"/>',
    compare: '<path d="M4 17l5-6 4 3 7-8"/><path d="M4 13l5 3 4-6 7 2" opacity=".55"/>',
    candle: '<path d="M7 3v4M7 17v4M17 5v3M17 16v3"/><rect x="5" y="7" width="4" height="10" rx="1"/><rect x="15" y="8" width="4" height="8" rx="1"/>',
    wallet: '<path d="M4 7.5A2.5 2.5 0 0 1 6.5 5H18v3"/><rect x="4" y="8" width="16" height="11" rx="2.5"/><path d="M16 13.5h.01"/>',
    download: '<path d="M12 4v11M7.5 10.5L12 15l4.5-4.5M5 19.5h14"/>',
    upload: '<path d="M12 15V4M7.5 8.5L12 4l4.5 4.5M5 19.5h14"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M4.6 4.6l1.4 1.4M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4L6 18M18 6l1.4-1.4"/>',
    moon: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
    external: '<path d="M14 4h6v6M20 4l-9 9"/><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
    lightning: '<path d="M13 2.5L4.5 13h6.5l-1 8.5L18.5 11H12z"/>',
    watch: '<rect x="7" y="7" width="10" height="10" rx="3"/><path d="M9 7l.7-3.5h4.6L15 7M9 17l.7 3.5h4.6L15 17M12 10v2l1.5 1"/>',
    wine: '<path d="M8 3.5h8c.5 4 0 8-4 8.5-4-.5-4.5-4.5-4-8.5zM12 12v8M8.5 20.5h7"/>',
    whisky: '<path d="M6 5h12l-1.3 14a1.8 1.8 0 0 1-1.8 1.5H9.1A1.8 1.8 0 0 1 7.3 19z"/><path d="M6.6 11h10.8"/>',
    car: '<path d="M5 16.5V12l2-5h10l2 5v4.5"/><path d="M3.5 12.5h17v4h-17z"/><circle cx="7.5" cy="17.5" r="1.5"/><circle cx="16.5" cy="17.5" r="1.5"/>',
    card: '<rect x="6" y="3" width="12" height="18" rx="2"/><path d="M9.5 8.5h5M9.5 12h5"/>',
    comic: '<path d="M5 4.5h14v12H10l-4 3.5v-3.5H5z"/><path d="M9 9h6M9 12h4"/>',
    bag: '<path d="M5 8.5h14l-1 11.5H6z"/><path d="M9 8.5V7a3 3 0 0 1 6 0v1.5"/>',
    coin: '<ellipse cx="12" cy="7.5" rx="7" ry="3"/><path d="M5 7.5v4.5c0 1.7 3.1 3 7 3s7-1.3 7-3V7.5M5 12v4.5c0 1.7 3.1 3 7 3s7-1.3 7-3V12"/>',
    trophy: '<path d="M8 4h8v5a4 4 0 0 1-8 0zM8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8.5 20h7M9.5 17h5v3h-5z"/>',
    gem: '<path d="M7 4h10l3.5 5L12 20.5 3.5 9z"/><path d="M3.5 9h17M9.5 4L8 9l4 11.5L16 9l-1.5-5"/>',
    list: '<path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01"/>',
    filter: '<path d="M4 6h16M7 12h10M10 18h4"/>',
    eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>',
    target: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r=".8" fill="currentColor"/>',
    arrowUp: '<path d="M12 19V5M6 11l6-6 6 6"/>',
    arrowDown: '<path d="M12 5v14M6 13l6 6 6-6"/>',
    swap: '<path d="M7 4v16M3.5 16.5L7 20l3.5-3.5M17 20V4M13.5 7.5L17 4l3.5 3.5"/>'
  };
  U.icon = (name, cls = '') => `<svg class="ic ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[name] || P.info}</svg>`;
})();
