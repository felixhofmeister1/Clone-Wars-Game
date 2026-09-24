/* =============================================================================
 * flightplan.js — Route building for the FMS: runway geometry & ILS, a
 * departure fix, great-circle en-route waypoints, a straight-in (or downwind)
 * arrival onto the ILS with Airbus-style CIxx / FFxx / RWxx fixes, top of
 * descent, the managed descent profile and fuel planning.
 * ========================================================================== */
(function (root) {
  'use strict';
  const Geo = root.Geo || (typeof require !== 'undefined' ? require('./geo.js') : null);
  const { NM, FT, D2R, R2D, KT } = Geo;
  const GS_ANGLE = 3.0;
  const FT_PER_NM = Math.tan(GS_ANGLE * D2R) * NM / FT; // ≈ 318 ft/nm
  const DECEL_NM = 12;   // level deceleration segment before the arrival

  /* ------------------------------------------------------------- runways */
  function hash(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

  /** Full geometry of one runway direction (the end you land on / take off from). */
  function runwayEnd(airport, endId) {
    for (const rw of airport.runways) {
      for (let k = 0; k < 2; k++) {
        if (rw.ends[k].id !== endId) continue;
        const e = rw.ends[k], f = rw.ends[1 - k];
        const hdg = Geo.bearing(e.lat, e.lon, f.lat, f.lon);
        const length = Geo.distance(e.lat, e.lon, f.lat, f.lon);
        const thr = e.disp ? Geo.destination(e.lat, e.lon, hdg, e.disp) : { lat: e.lat, lon: e.lon };
        const elev = (isFinite(e.elev) ? e.elev : airport.elev) * FT;
        const elevFar = (isFinite(f.elev) ? f.elev : airport.elev) * FT;
        const mv = Geo.magvar(airport.lat, airport.lon);
        const gpi = Geo.destination(thr.lat, thr.lon, hdg, 300);
        const loc = Geo.destination(f.lat, f.lon, hdg, 300);
        const h = hash(airport.icao + endId);
        const freq = 108.1 + ((h % 20) * 0.2) + (h % 2 ? 0.05 : 0);
        return {
          airport, id: endId, rw, lat: e.lat, lon: e.lon, thr, far: { lat: f.lat, lon: f.lon, id: f.id },
          hdg, magHdg: Geo.wrap360(hdg - mv), length, width: rw.width, elev, elevFar, disp: e.disp || 0,
          ils: {
            ident: 'I' + (airport.iata || airport.icao.slice(1)).slice(0, 3),
            freq: Math.round(freq * 100) / 100, course: Geo.wrap360(hdg - mv), trueCourse: hdg,
            gpi, loc, angle: GS_ANGLE, elev,
          },
        };
      }
    }
    return null;
  }

  /** Runway directions sorted by headwind for a surface wind (from dir, kt). */
  function bestRunways(airport, windDir = 0, windKt = 0) {
    const out = [];
    for (const rw of airport.runways) for (const e of rw.ends) {
      const r = runwayEnd(airport, e.id);
      const head = windKt * Math.cos((windDir - r.hdg) * D2R);
      out.push({ id: e.id, head, length: r.length, score: head * 30 + r.length / 100 });
    }
    return out.sort((a, b) => b.score - a.score);
  }

  /* --------------------------------------------------------- waypoint names */
  const CONS = 'BDFGKLMNPRSTVZ', VOW = 'AEIOU';
  function fixName(lat, lon) {
    let h = hash(`${lat.toFixed(3)},${lon.toFixed(3)}`);
    let s = '';
    for (let i = 0; i < 5; i++) {
      const set = i % 2 ? VOW : CONS;
      s += set[h % set.length]; h = Math.floor(h / set.length) ^ (h << 3);
      h >>>= 0;
    }
    return s;
  }

  /* ----------------------------------------------------------- the plan */
  function roundAlt(ft, step = 100) { return Math.round(ft / step) * step; }

  function build(o) {
    const dep = o.dep, arr = o.arr;
    const dRw = runwayEnd(dep, o.depRwy), aRw = runwayEnd(arr, o.arrRwy);
    const cruiseFt = o.cruiseFt || 37000;
    const wps = [];
    const add = (ident, lat, lon, extra = {}) => wps.push(Object.assign({ ident, lat, lon, alt: null }, extra));

    // Departure: runway, then a departure fix 8 nm out on the runway track.
    add(`RW${dRw.id}`, dRw.lat, dRw.lon, { kind: 'rwy-dep', alt: dRw.elev / FT });
    const depFix = Geo.destination(dRw.lat, dRw.lon, dRw.hdg, dRw.length + 8 * NM);
    add(fixName(depFix.lat, depFix.lon), depFix.lat, depFix.lon, { kind: 'sid', altCstr: roundAlt(dRw.elev / FT + 3000, 1000), cstrType: 'above' });

    // Arrival geometry (along-track x toward landing direction, y to the right).
    const thr = aRw.thr, crs = aRw.hdg;
    const at = (x, y) => {
      const p = Geo.destination(thr.lat, thr.lon, crs, x * NM);
      return y ? Geo.destination(p.lat, p.lon, crs + 90, y * NM) : p;
    };
    const elevFt = aRw.elev / FT;
    const ffDist = 3000 / FT_PER_NM;        // 3000 ft AAL on the glideslope ≈ 9.4 nm
    const ciAltFt = roundAlt(elevFt + 4000);
    const ff = at(-ffDist, 0);

    // En-route: great circle from the departure fix to the arrival entry.
    const last = wps[wps.length - 1];
    const inbound = Geo.bearing(last.lat, last.lon, thr.lat, thr.lon);
    const opposite = Math.abs(Geo.wrap180(inbound - crs)) > 100;
    let ci = at(-18, 0);
    let entry = ci;
    let arrivalPts = [];
    if (opposite) {
      // Arriving against the landing direction: downwind on the near side, base, then
      // a 15° intercept of the localizer.
      const side = Geo.wrap180(inbound - crs) > 0 ? -1 : 1;
      const d1 = at(6, 9 * side), d2 = at(-14, 9 * side);
      ci = at(-17, 2 * side);
      arrivalPts = [
        { ident: fixName(d1.lat, d1.lon), ...d1, alt: null, kind: 'star', altCstr: roundAlt(elevFt + 5000), cstrType: 'at' },
        { ident: fixName(d2.lat, d2.lon), ...d2, alt: null, kind: 'star', altCstr: roundAlt(elevFt + 4000), cstrType: 'at' },
      ];
      entry = d1;
    }
    const enrDist = Geo.distance(last.lat, last.lon, entry.lat, entry.lon);
    const n = Math.max(0, Math.round(enrDist / (420 * 1000)));
    for (let i = 1; i <= n; i++) {
      const p = Geo.intermediate(last.lat, last.lon, entry.lat, entry.lon, i / (n + 1));
      add(fixName(p.lat, p.lon), p.lat, p.lon, { kind: 'enr' });
    }
    for (const p of arrivalPts) wps.push(p);
    add(`CI${aRw.id}`, ci.lat, ci.lon, { kind: 'app', altCstr: ciAltFt, cstrType: 'above' });
    add(`FF${aRw.id}`, ff.lat, ff.lon, { kind: 'ff', altCstr: roundAlt(elevFt + 3000), cstrType: 'at' });
    add(`RW${aRw.id}`, thr.lat, thr.lon, { kind: 'rwy-arr', alt: elevFt + 50 });

    const plan = { dep, arr, depRwy: dRw, arrRwy: aRw, cruiseFt, wps, fromDir: opposite };
    computeDistances(plan);
    return plan;
  }

  function computeDistances(plan) {
    let d = 0;
    plan.wps[0].dist = 0;
    for (let i = 1; i < plan.wps.length; i++) {
      const a = plan.wps[i - 1], b = plan.wps[i];
      d += Geo.distance(a.lat, a.lon, b.lat, b.lon);
      b.dist = d;
      b.course = Geo.bearing(a.lat, a.lon, b.lat, b.lon);
    }
    plan.total = d;
    const ciIdx = plan.wps.findIndex((w) => w.kind === 'app');
    plan.ciIdx = ciIdx;
    const firstArr = plan.wps.findIndex((w) => w.kind === 'star' || w.kind === 'app');
    plan.firstArrIdx = firstArr;
    // Top of descent: 3° path from cruise down to the first arrival constraint, reached
    // DECEL_NM before that fix so there is a level segment to slow down and configure.
    const aw = plan.wps[firstArr];
    const descentNm = (plan.cruiseFt - aw.altCstr) / FT_PER_NM + DECEL_NM;
    plan.todDist = Math.max(0, aw.dist - descentNm * NM);
    plan.decelDist = Math.max(0, aw.dist - DECEL_NM * NM);
    const tc = (plan.cruiseFt - plan.depRwy.elev / FT) / 2200 * 250 * NM / 60; // rough climb distance
    plan.tocDist = Math.min(plan.todDist, 5 * NM + tc * 0.9);
  }

  /** Along-route distance flown to the current position given the active leg index. */
  function progress(plan, lat, lon, activeIdx) {
    const i = Math.max(1, Math.min(activeIdx, plan.wps.length - 1));
    const a = plan.wps[i - 1], b = plan.wps[i];
    const ti = Geo.trackInfo(lat, lon, a.lat, a.lon, b.lat, b.lon);
    const along = Math.max(0, Math.min(ti.legLen, ti.atk));
    return { flown: a.dist + along, toGo: plan.total - (a.dist + along), toNext: Math.max(0, ti.legLen - ti.atk), xtk: ti.xtk, course: ti.course, legLen: ti.legLen };
  }

  /**
   * Managed descent profile: altitude (ft) the aircraft should be at with
   * `flown` metres along the route — 3° path down to each arrival constraint.
   */
  function profileAlt(plan, flown) {
    let alt = plan.cruiseFt;
    for (let i = plan.firstArrIdx; i < plan.wps.length; i++) {
      const w = plan.wps[i];
      const cst = w.altCstr ?? w.alt;
      if (cst == null) continue;
      const decel = i === plan.firstArrIdx ? DECEL_NM : 0;
      const a = cst + Math.max(0, (w.dist - flown) / NM - decel) * FT_PER_NM;
      alt = Math.min(alt, a);
    }
    return alt;
  }

  /** A visual-circuit style re-approach after a go-around (keeps the same ILS). */
  function missedApproach(plan, lat, lon) {
    const aRw = plan.arrRwy, thr = aRw.thr, crs = aRw.hdg;
    const at = (x, y) => { const p = Geo.destination(thr.lat, thr.lon, crs, x * NM); return y ? Geo.destination(p.lat, p.lon, crs + 90, y * NM) : p; };
    const elevFt = aRw.elev / FT;
    const side = -1;
    const pts = [
      { ...at(aRw.length / NM + 4, 0), altCstr: roundAlt(elevFt + 3000), kind: 'miss' },
      { ...at(aRw.length / NM + 5, 8 * side), altCstr: roundAlt(elevFt + 3000), kind: 'miss' },
      { ...at(-12, 8 * side), altCstr: roundAlt(elevFt + 3000), kind: 'star', cstrType: 'at' },
    ].map((p) => Object.assign({ ident: fixName(p.lat, p.lon), alt: null, cstrType: 'at' }, p));
    const tail = plan.wps.slice(plan.ciIdx);
    tail[0] = Object.assign({}, tail[0], { altCstr: roundAlt(elevFt + 3000) });
    plan.wps = [{ ident: 'GA', lat, lon, alt: null, kind: 'ga' }, ...pts, ...tail];
    computeDistances(plan);
    plan.todDist = 0; plan.tocDist = 0;
    return plan;
  }

  /* ------------------------------------------------------------ fuel plan */
  /**
   * Block fuel (kg) for a distance: trip burn at ~5.8 t/h (A330-900 at M.82)
   * plus 5 % contingency, 30 min final reserve, alternate and taxi.
   */
  function fuelPlan(distM, zfw) {
    const hours = distM / (470 * KT * 3600) + 0.35;
    const wf = zfw / 170000;
    const trip = hours * 5750 * (0.75 + 0.25 * wf) + 1800;
    const cont = 0.05 * trip, finalRes = 2900, alternate = 4200, taxi = 600;
    const block = Math.round((trip + cont + finalRes + alternate + taxi) / 100) * 100;
    return { trip: Math.round(trip), cont: Math.round(cont), finalRes, alternate, taxi, block, hours };
  }

  function cruiseLevelFor(distM) {
    if (distM < 500e3) return 29000;
    if (distM < 1200e3) return 35000;
    if (distM < 4000e3) return 37000;
    return 37000;
  }

  const FlightPlan = { runwayEnd, bestRunways, build, progress, profileAlt, missedApproach, fuelPlan, cruiseLevelFor, fixName, GS_ANGLE, FT_PER_NM, computeDistances };
  if (typeof module !== 'undefined' && module.exports) module.exports = FlightPlan;
  else root.FlightPlan = FlightPlan;
})(typeof window !== 'undefined' ? window : globalThis);
