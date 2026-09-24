/* =============================================================================
 * ui.js — Flight planner (Condor network, runways, livery, load, weather,
 * time, settings), relief route map, flight summary (distance, block time,
 * block fuel, weights, V-speeds), help, pause and landing report screens.
 * ========================================================================== */
(function () {
  'use strict';
  const { NM, FT, KT, D2R, R2D, clamp } = Geo;
  const $ = (id) => document.getElementById(id);
  const AIRPORTS = window.CONDOR_AIRPORTS;
  const BY = new Map(AIRPORTS.map((a) => [a.icao, a]));
  const REGIONS = [
    ['DE', 'Germany — Condor bases'], ['EU', 'Europe & Mediterranean'], ['NA', 'North America'],
    ['CA', 'Caribbean & Central America'], ['AF', 'Africa'], ['AS', 'Middle East & Asia'], ['IO', 'Indian Ocean'],
  ];
  const FEATURED = [
    ['EDDF', 'FAOR'], ['EDDF', 'KJFK'], ['EDDF', 'VTBS'], ['EDDF', 'MMUN'], ['EDDF', 'FIMP'], ['EDDF', 'KSEA'],
    ['EDDF', 'PANC'], ['EDDF', 'FACT'], ['EDDM', 'GCTS'], ['EDDL', 'LPMA'], ['EDDF', 'LEPA'], ['EDDF', 'CYVR'],
  ];
  const PAX_KG = 100, CARGO = 4500;

  function hms(hours) { const h = Math.floor(hours), m = Math.round((hours - h) * 60); return `${h}:${String(m).padStart(2, '0')}`; }

  /* ----------------------------------------------------------- weather */
  function makeWeather(kind, dep, arr, seed = Date.now()) {
    let s = seed % 2147483647 || 1;
    const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    const bestDir = (ap) => {
      const rw = ap.runways[0];
      return Geo.bearing(rw.ends[0].lat, rw.ends[0].lon, rw.ends[1].lat, rw.ends[1].lon) + (rnd() < 0.5 ? 180 : 0);
    };
    const surf = (ap) => {
      const d = bestDir(ap);
      switch (kind) {
        case 'calm': return { dir: d, kt: 0, gust: 0 };
        case 'light': return { dir: Geo.wrap360(d + (rnd() - 0.5) * 60), kt: 5 + rnd() * 6, gust: 0 };
        case 'cross': return { dir: Geo.wrap360(d + (rnd() < 0.5 ? 75 : -75)), kt: 15, gust: 4 };
        default: return { dir: Geo.wrap360(d + (rnd() - 0.5) * 70), kt: 20, gust: 12 };
      }
    };
    const w = { kind, dep: surf(dep), arr: surf(arr), turb: kind === 'gusty' ? 1 : kind === 'cross' ? 0.5 : 0.15, phase: rnd() * 100, cloudTurb: 0 };
    // Cumulus layer: coverage, base above the local airport elevation, thickness
    w.clouds = {
      calm: { cover: 0.08, baseAgl: 5500 * FT, depth: 700 }, light: { cover: 0.28, baseAgl: 4500 * FT, depth: 900 },
      cross: { cover: 0.45, baseAgl: 3500 * FT, depth: 1100 }, gusty: { cover: 0.62, baseAgl: 2600 * FT, depth: 1400 },
    }[kind] || { cover: 0.2, baseAgl: 4000 * FT, depth: 900 };
    w.cloudBase = (lat, lon) => {
      const near = Geo.distance(lat, lon, dep.lat, dep.lon) < Geo.distance(lat, lon, arr.lat, arr.lon) ? dep : arr;
      return w.clouds.baseAgl + near.elev * FT;
    };
    w.isaDev = (lat) => clamp(15 - Math.abs(lat) * 0.38, -6, 14);
    // Wind aloft by latitude: westerlies/jet in mid-latitudes, trade-wind easterlies in the tropics.
    w.aloft = (lat) => {
      const al = Math.abs(lat);
      if (al < 22) return { dir: 80, kt: 18 + al * 0.5 };
      return { dir: 265, kt: 30 + 70 * Math.exp(-(((al - 42) / 14) ** 2)) };
    };
    w.fn = (altM, lat, lon, t) => {
      const dDep = Geo.distance(lat, lon, dep.lat, dep.lon), dArr = Geo.distance(lat, lon, arr.lat, arr.lon);
      const sw = dDep < dArr ? w.dep : w.arr;
      const elev = (dDep < dArr ? dep.elev : arr.elev) * FT;
      const agl = Math.max(0, altM - elev);
      const al = w.aloft(lat);
      const f = clamp(agl / 9500, 0, 1) ** 0.8;
      const vec = (dir, kt) => [-kt * KT * Math.cos(dir * D2R), -kt * KT * Math.sin(dir * D2R)]; // air-mass velocity (N, E)
      const a = vec(sw.dir, sw.kt * (0.75 + 0.25 * clamp(agl / 300, 0, 1))), b = vec(al.dir, al.kt * clamp(altM / 11000, 0.25, 1));
      let n = a[0] + (b[0] - a[0]) * f, e = a[1] + (b[1] - a[1]) * f;
      // Gusts & turbulence (smooth pseudo-random)
      const k = w.phase + t;
      const low = clamp(1 - agl / 1500, 0, 1);
      const gust = sw.gust * KT * low * (0.5 + 0.5 * Math.sin(k * 0.37) * Math.sin(k * 0.13 + 1.1));
      const mag = Math.hypot(n, e) || 1;
      n += (n / mag) * gust; e += (e / mag) * gust;
      const tb = w.turb * (0.6 * low + 0.25) + w.cloudTurb * 1.6;
      n += tb * (Math.sin(k * 1.7) + Math.sin(k * 2.9 + 2)) * 0.6;
      e += tb * (Math.sin(k * 1.3 + 1) + Math.sin(k * 3.7)) * 0.6;
      const dn = tb * (Math.sin(k * 2.3 + 0.5) + 0.6 * Math.sin(k * 4.1)) * 0.5 * (0.3 + low);
      return [n, e, dn];
    };
    return w;
  }

  /* ----------------------------------------------------------- the UI */
  class UI {
    constructor() {
      this.worldMap = null;
      this.cfg = null;
      this.onChange = () => {};
      this.onFly = () => {};
      this.seed = Date.now();
    }

    initPlanner(saved) {
      const dep = $('sel-dep'), arr = $('sel-arr');
      const fill = (sel, filterBase) => {
        sel.innerHTML = '';
        for (const [rid, rname] of REGIONS) {
          const og = document.createElement('optgroup'); og.label = rname;
          for (const a of AIRPORTS.filter((x) => x.region === rid)) {
            if (filterBase && !a.base && rid !== 'DE') { /* all airports can be departures */ }
            const o = document.createElement('option'); o.value = a.icao; o.textContent = `${a.city} (${a.iata})`;
            og.appendChild(o);
          }
          sel.appendChild(og);
        }
      };
      fill(dep, true); fill(arr, false);
      dep.value = saved?.dep || 'EDDF'; arr.value = saved?.arr || 'FAOR';
      // Cruise levels
      const fl = $('sel-fl');
      for (let f = 290; f <= 410; f += 20) { const o = document.createElement('option'); o.value = f * 100; o.textContent = `FL${f}`; fl.appendChild(o); }
      for (let f = 300; f <= 400; f += 20) { const o = document.createElement('option'); o.value = f * 100; o.textContent = `FL${f}`; fl.appendChild(o); }
      [...fl.options].sort((a, b) => a.value - b.value).forEach((o) => fl.appendChild(o));
      fl.insertBefore(new Option('Auto (optimum)', 'auto'), fl.firstChild);
      fl.value = 'auto';
      // Featured routes
      const feat = $('featured');
      for (const [d, a] of FEATURED) {
        const b = document.createElement('button');
        b.textContent = `${BY.get(d).iata} → ${BY.get(a).iata}`;
        b.title = `${BY.get(d).city} → ${BY.get(a).city}`;
        b.onclick = () => { dep.value = d; arr.value = a; this.routeChanged(); };
        feat.appendChild(b);
      }
      // Liveries
      const lv = $('liveries');
      for (const l of Liveries.LIVERIES) {
        const b = document.createElement('button');
        b.className = 'liv'; b.dataset.id = l.id;
        b.innerHTML = `<div class="sw" style="background:repeating-linear-gradient(90deg, ${l.color} 0 6px, #fbfbf8 6px 12px)"></div>${l.name}<small>${l.reg}</small>`;
        b.onclick = () => { this.livery = l.id; this.markLivery(); this.onChange('livery'); };
        lv.appendChild(b);
      }
      this.livery = saved?.livery || 'island';
      this.markLivery();
      if (saved) {
        for (const [id, key] of [['sel-start', 'start'], ['sel-time', 'time'], ['sel-wx', 'wx'], ['sel-imagery', 'imagery'], ['sel-quality', 'quality'], ['sel-controls', 'controls'], ['sel-law', 'law']]) if (saved[key]) $(id).value = saved[key];
        if (saved.pax != null) $('in-pax').value = saved.pax;
        if (saved.sens) $('in-sens').value = saved.sens;
        if (saved.vol != null) $('in-vol').value = saved.vol;
        if (saved.voice != null) $('chk-voice').checked = saved.voice;
      }
      dep.onchange = arr.onchange = () => this.routeChanged();
      $('sel-deprwy').onchange = $('sel-arrrwy').onchange = () => this.update();
      $('in-pax').oninput = () => this.update();
      $('sel-fl').onchange = () => this.update();
      $('sel-wx').onchange = () => { this.seed = Date.now(); this.routeChanged(); };
      $('sel-start').onchange = () => this.update();
      $('btn-fly').onclick = () => this.onFly(this.config());
      this.loadWorldMap();
      this.routeChanged();
      this.buildHelp();
    }

    markLivery() {
      const l = Liveries.LIVERIES.find((x) => x.id === this.livery);
      document.querySelectorAll('.liv').forEach((b) => b.classList.toggle('sel', b.dataset.id === this.livery));
      document.documentElement.style.setProperty('--liv', l.color);
    }

    routeChanged() {
      const dep = BY.get($('sel-dep').value), arr = BY.get($('sel-arr').value);
      this.weather = makeWeather($('sel-wx').value, dep, arr, this.seed);
      const fillRw = (sel, ap, wind) => {
        sel.innerHTML = '';
        const best = FlightPlan.bestRunways(ap, wind.dir, wind.kt);
        for (const r of best) {
          const o = document.createElement('option');
          o.value = r.id;
          o.textContent = `${r.id} — ${Math.round(r.length)} m${Math.abs(r.head) > 0.5 ? ` · ${r.head >= 0 ? 'head' : 'tail'}wind ${Math.abs(Math.round(r.head))} kt` : ''}`;
          sel.appendChild(o);
        }
        sel.value = best[0].id;
      };
      fillRw($('sel-deprwy'), dep, this.weather.dep);
      fillRw($('sel-arrrwy'), arr, this.weather.arr);
      this.update();
      this.onChange('route');
    }

    config() {
      const dep = BY.get($('sel-dep').value), arr = BY.get($('sel-arr').value);
      const dist = Geo.distance(dep.lat, dep.lon, arr.lat, arr.lon) * 1.04;
      const flSel = $('sel-fl').value;
      const pax = +$('in-pax').value;
      let payload = pax * PAX_KG + CARGO;
      const zfw = FDM.A339.oew + payload;
      const fuel = FlightPlan.fuelPlan(dist, zfw);
      let block = Math.min(fuel.block, FDM.A339.maxFuel);
      let tow = zfw + block - fuel.taxi;
      let limited = false;
      if (tow > FDM.A339.mtow) { payload -= tow - FDM.A339.mtow; limited = true; tow = FDM.A339.mtow; }
      const cruiseFt = flSel === 'auto' ? optimumFL(dist, tow) : +flSel;
      return {
        dep: dep.icao, arr: arr.icao, depRwy: $('sel-deprwy').value, arrRwy: $('sel-arrrwy').value,
        livery: this.livery, pax, payload: Math.max(0, payload), fuel: block - fuel.taxi, fuelPlan: fuel, tow, limited,
        cruiseFt, start: $('sel-start').value, time: $('sel-time').value, wx: $('sel-wx').value, weather: this.weather,
        imagery: $('sel-imagery').value, quality: $('sel-quality').value, controls: $('sel-controls').value, law: $('sel-law').value,
        sens: +$('in-sens').value, vol: +$('in-vol').value, voice: $('chk-voice').checked, invThr: $('chk-invthr').checked,
        autoRudder: $('chk-autocoord').checked, dist,
      };
    }

    update() {
      const c = this.config();
      const dep = BY.get(c.dep), arr = BY.get(c.arr);
      $('fly-route').textContent = `${dep.iata} → ${arr.iata}`;
      const depR = FlightPlan.runwayEnd(dep, c.depRwy), arrR = FlightPlan.runwayEnd(arr, c.arrRwy);
      // Take-off speeds (CONF 1+F)
      const vs = FDM.vs1g(2, c.tow) / KT;
      const v2 = Math.max(Math.round(vs * 1.13), 125);
      const lw = c.tow - c.fuelPlan.trip;
      const vapp = Math.round((1.23 * FDM.vs1g(5, lw)) / KT + 5);
      const todReq = 1500 + Math.max(0, c.tow - 150000) * 0.022 + dep.elev * 0.12;
      const shortRwy = depR.length < todReq;
      const same = c.dep === c.arr;
      const range = c.dist / NM > 7200;
      const cells = [
        ['Distance', `${Math.round(c.dist / NM)} NM`], ['Block time', hms(c.fuelPlan.hours + 0.3)], ['Cruise', `FL${Math.round(c.cruiseFt / 100)}`],
        ['Block fuel', `${(c.fuel / 1000).toFixed(1)} t`, range], ['Take-off wt', `${(c.tow / 1000).toFixed(1)} t`, c.limited], ['Landing wt', `${(lw / 1000).toFixed(1)} t`, lw > FDM.A339.mlw],
        ['V1 / VR / V2', `${v2 - 8}/${v2 - 4}/${v2}`], ['VAPP', `${vapp} kt`], ['ILS', `${arrR.ils.ident} ${arrR.ils.freq.toFixed(2)}`],
        ['Dep wind', `${Math.round(this.weather.dep.dir)}°/${Math.round(this.weather.dep.kt)}${this.weather.dep.gust ? 'G' + Math.round(this.weather.dep.kt + this.weather.dep.gust) : ''} kt`], ['Arr wind', `${Math.round(this.weather.arr.dir)}°/${Math.round(this.weather.arr.kt)} kt`], ['Runway', `${depR.id} · ${Math.round(depR.length)} m`, shortRwy],
      ];
      $('summary').innerHTML = cells.map(([k, v, w]) => `<div class="${w ? 'warn' : ''}"><span>${k}</span><b>${v}</b></div>`).join('');
      let hint = 'Keyboard · mouse · gamepad / joystick · touch';
      if (same) hint = 'Pick a different destination';
      else if (range) hint = '⚠ Beyond the A330-900 range — fuel is capped at 111 t';
      else if (c.limited) hint = '⚠ Payload reduced to stay within the 251 t MTOW';
      else if (shortRwy) hint = '⚠ Short runway for this weight — use TOGA';
      $('menu-hint').textContent = hint;
      $('btn-fly').disabled = same;
      this.drawRouteMap($('route-map'), dep, arr);
      this.cfg = c;
    }

    /* --------------------------------------------------- relief world map */
    loadWorldMap() {
      const Z = 2, N = 1 << Z, S = 256;
      const c = document.createElement('canvas'); c.width = N * S; c.height = N * S;
      const g = c.getContext('2d');
      g.fillStyle = '#123a5a'; g.fillRect(0, 0, c.width, c.height);
      let left = N * N;
      for (let x = 0; x < N; x++) for (let y = 0; y < N; y++) {
        const img = new Image(); img.crossOrigin = 'anonymous';
        img.onload = () => {
          const t = document.createElement('canvas'); t.width = t.height = S;
          const tg = t.getContext('2d'); tg.drawImage(img, 0, 0);
          const px = tg.getImageData(0, 0, S, S), d = px.data;
          for (let i = 0; i < S * S; i++) {
            const h = d[i * 4] * 256 + d[i * 4 + 1] + d[i * 4 + 2] / 256 - 32768;
            let r, gg, b;
            if (h <= 0) { const k = clamp(-h / 6000, 0, 1); r = 30 - k * 18; gg = 78 - k * 40; b = 118 - k * 50; }
            else {
              // Hypsometric tint: green lowlands -> tan hills -> brown mountains -> snow
              const k = clamp(h / 5000, 0, 1);
              if (k < 0.3) { const q = k / 0.3; r = 86 + q * 70; gg = 126 + q * 20; b = 72 + q * 20; }
              else if (k < 0.7) { const q = (k - 0.3) / 0.4; r = 156 - q * 30; gg = 146 - q * 46; b = 92 - q * 22; }
              else { const q = (k - 0.7) / 0.3; r = 126 + q * 110; gg = 100 + q * 130; b = 70 + q * 160; }
            }
            d[i * 4] = r; d[i * 4 + 1] = gg; d[i * 4 + 2] = b; d[i * 4 + 3] = 255;
          }
          tg.putImageData(px, 0, 0);
          g.drawImage(t, x * S, y * S);
          if (--left === 0 || left % 4 === 0) { this.worldMap = c; this.update(); }
        };
        img.onerror = () => { if (--left === 0) this.worldMap = this.worldMap || null; };
        img.src = `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${Z}/${x}/${y}.png`;
      }
      this.worldMap = c;
    }

    /** Draw the world map zoomed to the route (or any lat/lon box) on a canvas. */
    drawRouteMap(cv, dep, arr, live = null) {
      const g = cv.getContext('2d');
      const W = cv.width, H = cv.height;
      const pts = [];
      for (let i = 0; i <= 64; i++) pts.push(Geo.intermediate(dep.lat, dep.lon, arr.lat, arr.lon, i / 64));
      const mx = (lon) => (lon + 180) / 360, my = (lat) => Geo.latToTileY(clamp(lat, -84, 84), 0);
      let x0 = Math.min(...pts.map((p) => mx(p.lon))), x1 = Math.max(...pts.map((p) => mx(p.lon)));
      let y0 = Math.min(...pts.map((p) => my(p.lat))), y1 = Math.max(...pts.map((p) => my(p.lat)));
      const padX = Math.max(0.04, (x1 - x0) * 0.25), padY = Math.max(0.04, (y1 - y0) * 0.25);
      x0 -= padX; x1 += padX; y0 -= padY; y1 += padY;
      // Keep the canvas aspect
      const aspect = W / H;
      if ((x1 - x0) / (y1 - y0) < aspect) { const c = (x0 + x1) / 2, w = (y1 - y0) * aspect; x0 = c - w / 2; x1 = c + w / 2; }
      else { const c = (y0 + y1) / 2, h = (x1 - x0) / aspect; y0 = c - h / 2; y1 = c + h / 2; }
      const X = (lon) => ((mx(lon) - x0) / (x1 - x0)) * W, Y = (lat) => ((my(lat) - y0) / (y1 - y0)) * H;
      g.fillStyle = '#123a5a'; g.fillRect(0, 0, W, H);
      if (this.worldMap) {
        const M = this.worldMap;
        g.imageSmoothingEnabled = true;
        g.drawImage(M, x0 * M.width, y0 * M.height, (x1 - x0) * M.width, (y1 - y0) * M.height, 0, 0, W, H);
      }
      // Graticule
      g.strokeStyle = 'rgba(255,255,255,0.12)'; g.lineWidth = 1;
      for (let lon = -180; lon <= 180; lon += 15) { g.beginPath(); g.moveTo(X(lon), 0); g.lineTo(X(lon), H); g.stroke(); }
      for (let lat = -75; lat <= 75; lat += 15) { g.beginPath(); g.moveTo(0, Y(lat)); g.lineTo(W, Y(lat)); g.stroke(); }
      // Network airports
      for (const a of AIRPORTS) {
        const x = X(a.lon), y = Y(a.lat);
        if (x < -10 || x > W + 10 || y < -10 || y > H + 10) continue;
        g.fillStyle = a.base ? '#ffffff' : 'rgba(255,255,255,0.55)';
        g.beginPath(); g.arc(x, y, a.base ? 3 : 2.2, 0, Math.PI * 2); g.fill();
      }
      // Route
      const liv = getComputedStyle(document.documentElement).getPropertyValue('--liv').trim() || '#2fa66a';
      g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 6; g.lineCap = 'round';
      g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(X(p.lon), Y(p.lat)) : g.moveTo(X(p.lon), Y(p.lat)))); g.stroke();
      g.strokeStyle = liv; g.lineWidth = 3.5; g.setLineDash([12, 7]);
      g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(X(p.lon), Y(p.lat)) : g.moveTo(X(p.lon), Y(p.lat)))); g.stroke();
      g.setLineDash([]);
      for (const [a, label] of [[dep, dep.iata], [arr, arr.iata]]) {
        const x = X(a.lon), y = Y(a.lat);
        g.fillStyle = '#fff'; g.strokeStyle = '#111'; g.lineWidth = 2;
        g.beginPath(); g.arc(x, y, 6, 0, Math.PI * 2); g.fill(); g.stroke();
        g.font = '700 17px "Barlow Condensed", sans-serif'; g.fillStyle = '#fff'; g.strokeStyle = 'rgba(0,0,0,0.7)'; g.lineWidth = 4;
        g.strokeText(`${label} · ${a.city}`, x + 10, y - 9); g.fillText(`${label} · ${a.city}`, x + 10, y - 9);
      }
      if (live) {
        const x = X(live.lon), y = Y(live.lat);
        g.save(); g.translate(x, y); g.rotate(live.hdg * D2R);
        g.fillStyle = '#ffd21f'; g.strokeStyle = '#000'; g.lineWidth = 1.5;
        g.beginPath(); g.moveTo(0, -11); g.lineTo(3, -3); g.lineTo(11, 2); g.lineTo(3, 2); g.lineTo(2, 8); g.lineTo(5, 11); g.lineTo(-5, 11); g.lineTo(-2, 8); g.lineTo(-3, 2); g.lineTo(-11, 2); g.lineTo(-3, -3); g.closePath(); g.fill(); g.stroke();
        g.restore();
      }
    }

    buildHelp() {
      $('help-grid').innerHTML = window.KEY_BINDINGS.map(([title, rows]) =>
        `<div><h4>${title}</h4>${rows.map(([k, d]) => `<div class="b"><kbd>${k}</kbd><span>${d}</span></div>`).join('')}</div>`).join('');
    }

    showReport(r) {
      $('rep-kicker').textContent = r.crashed ? 'ACCIDENT' : 'LANDED';
      $('rep-title').textContent = r.title;
      $('rep-grade').textContent = r.grade;
      $('rep-stats').innerHTML = r.stats.map(([k, v]) => `<div><span>${k}</span><b>${v}</b></div>`).join('');
      $('rep-note').textContent = r.note || '';
      $('btn-nextleg').textContent = r.crashed ? 'Try again' : 'Fly the return leg';
      $('btn-continue').classList.toggle('hidden', !!r.crashed);
      $('report').classList.remove('hidden');
    }
  }

  function optimumFL(distM, tow) {
    const nm = distM / NM;
    if (nm < 300) return 25000;
    if (nm < 700) return 33000;
    // Heavy long-haul starts lower (step-climb territory)
    if (tow > 235000) return 35000;
    if (tow > 215000) return 37000;
    return 39000;
  }

  window.SimUI = UI;
  window.makeWeather = makeWeather;
})();
