/* =============================================================================
 * geo.js — Spherical-earth geodesy shared by the flight model, the FMS and the
 * renderer: lat/lon <-> ECEF, local NED/ENU frames, great-circle navigation,
 * magnetic variation and Web-Mercator tile maths.
 *
 * Angles are degrees at the API boundary, radians inside. Distances in metres.
 * Runs in the browser (window.Geo) and in Node (module.exports) for tests.
 * ========================================================================== */
(function (root) {
  'use strict';

  const R = 6371008.8;             // mean earth radius (m)
  const D2R = Math.PI / 180;
  const R2D = 180 / Math.PI;
  const NM = 1852;                 // metres per nautical mile
  const FT = 0.3048;               // metres per foot
  const KT = NM / 3600;            // m/s per knot

  const wrap360 = (d) => ((d % 360) + 360) % 360;
  const wrap180 = (d) => { d = wrap360(d); return d > 180 ? d - 360 : d; };
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

  /** Geodetic (deg, deg, m above sphere) -> ECEF [x, y, z]. */
  function llaToEcef(lat, lon, h = 0, out = [0, 0, 0]) {
    const la = lat * D2R, lo = lon * D2R, r = R + h;
    const cl = Math.cos(la);
    out[0] = r * cl * Math.cos(lo);
    out[1] = r * cl * Math.sin(lo);
    out[2] = r * Math.sin(la);
    return out;
  }

  /** ECEF -> {lat, lon, h}. */
  function ecefToLla(p) {
    const x = p[0], y = p[1], z = p[2];
    const r = Math.sqrt(x * x + y * y + z * z);
    return { lat: Math.asin(z / r) * R2D, lon: Math.atan2(y, x) * R2D, h: r - R };
  }

  /** Local frame at (lat, lon): unit vectors north, east, up in ECEF. */
  function localBasis(lat, lon) {
    const la = lat * D2R, lo = lon * D2R;
    const sla = Math.sin(la), cla = Math.cos(la), slo = Math.sin(lo), clo = Math.cos(lo);
    return {
      north: [-sla * clo, -sla * slo, cla],
      east: [-slo, clo, 0],
      up: [cla * clo, cla * slo, sla],
    };
  }

  /** Great-circle distance (m). */
  function distance(lat1, lon1, lat2, lon2) {
    const p1 = lat1 * D2R, p2 = lat2 * D2R, dp = p2 - p1, dl = (lon2 - lon1) * D2R;
    const a = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
  }

  /** Initial true bearing from point 1 to point 2 (deg). */
  function bearing(lat1, lon1, lat2, lon2) {
    const p1 = lat1 * D2R, p2 = lat2 * D2R, dl = (lon2 - lon1) * D2R;
    const y = Math.sin(dl) * Math.cos(p2);
    const x = Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dl);
    return wrap360(Math.atan2(y, x) * R2D);
  }

  /** Point at distance d (m) along true bearing brg (deg). */
  function destination(lat, lon, brg, d) {
    const p1 = lat * D2R, l1 = lon * D2R, b = brg * D2R, dr = d / R;
    const p2 = Math.asin(Math.sin(p1) * Math.cos(dr) + Math.cos(p1) * Math.sin(dr) * Math.cos(b));
    const l2 = l1 + Math.atan2(Math.sin(b) * Math.sin(dr) * Math.cos(p1), Math.cos(dr) - Math.sin(p1) * Math.sin(p2));
    return { lat: p2 * R2D, lon: wrap180(l2 * R2D) };
  }

  /** Point at fraction f along the great circle from 1 to 2. */
  function intermediate(lat1, lon1, lat2, lon2, f) {
    const d = distance(lat1, lon1, lat2, lon2) / R;
    if (d < 1e-9) return { lat: lat1, lon: lon1 };
    const a = Math.sin((1 - f) * d) / Math.sin(d), b = Math.sin(f * d) / Math.sin(d);
    const p1 = lat1 * D2R, l1 = lon1 * D2R, p2 = lat2 * D2R, l2 = lon2 * D2R;
    const x = a * Math.cos(p1) * Math.cos(l1) + b * Math.cos(p2) * Math.cos(l2);
    const y = a * Math.cos(p1) * Math.sin(l1) + b * Math.cos(p2) * Math.sin(l2);
    const z = a * Math.sin(p1) + b * Math.sin(p2);
    return { lat: Math.atan2(z, Math.sqrt(x * x + y * y)) * R2D, lon: Math.atan2(y, x) * R2D };
  }

  /**
   * Position relative to the great circle A->B: cross-track distance (m, +right
   * of track), along-track distance from A (m), and the course of the great
   * circle at the abeam point (deg).
   */
  function trackInfo(lat, lon, aLat, aLon, bLat, bLon) {
    const d13 = distance(aLat, aLon, lat, lon) / R;
    const t13 = bearing(aLat, aLon, lat, lon) * D2R;
    const t12 = bearing(aLat, aLon, bLat, bLon) * D2R;
    const xt = Math.asin(clamp(Math.sin(d13) * Math.sin(t13 - t12), -1, 1));
    const at = Math.acos(clamp(Math.cos(d13) / Math.cos(xt), -1, 1)) * Math.sign(Math.cos(t13 - t12) || 1);
    const legLen = distance(aLat, aLon, bLat, bLon);
    const f = legLen > 1 ? clamp((at * R) / legLen, 0, 1) : 1;
    const p = intermediate(aLat, aLon, bLat, bLon, f);
    const course = f >= 1 ? wrap360(bearing(bLat, bLon, aLat, aLon) + 180) : bearing(p.lat, p.lon, bLat, bLon);
    return { xtk: xt * R, atk: at * R, legLen, course };
  }

  /* ---------------------------------------------------------------- magvar */
  let MAGVAR = null;
  function setMagvarGrid(grid) { MAGVAR = grid; }
  /** Magnetic variation (deg, east positive): magnetic = true - variation. */
  function magvar(lat, lon) {
    if (!MAGVAR) return 0;
    const x = (wrap180(lon) + 180) / 5, y = (clamp(lat, -90, 90) + 90) / 5;
    const j = Math.min(71, Math.floor(x)), i = Math.min(35, Math.floor(y));
    const fx = x - j, fy = y - i;
    const g = (a, b) => MAGVAR[a * 73 + b];
    return g(i, j) * (1 - fx) * (1 - fy) + g(i, j + 1) * fx * (1 - fy) + g(i + 1, j) * (1 - fx) * fy + g(i + 1, j + 1) * fx * fy;
  }

  /* ------------------------------------------------------------ Web Mercator */
  const MAX_LAT = 85.0511287798;
  const lonToTileX = (lon, z) => ((lon + 180) / 360) * (1 << z);
  const latToTileY = (lat, z) => {
    const s = Math.sin(clamp(lat, -MAX_LAT, MAX_LAT) * D2R);
    return (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * (1 << z);
  };
  const tileXToLon = (x, z) => (x / (1 << z)) * 360 - 180;
  const tileYToLat = (y, z) => {
    const n = Math.PI - (2 * Math.PI * y) / (1 << z);
    return R2D * Math.atan(Math.sinh(n));
  };

  const Geo = {
    R, D2R, R2D, NM, FT, KT, wrap360, wrap180, clamp,
    llaToEcef, ecefToLla, localBasis, distance, bearing, destination, intermediate, trackInfo,
    setMagvarGrid, magvar, MAX_LAT, lonToTileX, latToTileY, tileXToLon, tileYToLat,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = Geo;
  else root.Geo = Geo;
})(typeof window !== 'undefined' ? window : globalThis);
