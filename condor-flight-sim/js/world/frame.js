/* =============================================================================
 * frame.js — The render frame. Every frame the origin moves to the point on
 * the earth's surface below the aircraft; three.js axes there are
 * x = east, y = up, z = south. Objects are anchored in ECEF and placed through
 * this frame with double-precision maths, so the GPU only ever sees small
 * numbers (no jitter from Frankfurt to Johannesburg).
 * ========================================================================== */
(function () {
  'use strict';
  class WorldFrame {
    constructor() { this.O = [0, 0, 0]; this.R = [1, 0, 0, 0, 1, 0, 0, 0, 1]; this.lat = 0; this.lon = 0; }
    setOrigin(lat, lon) {
      this.lat = lat; this.lon = lon;
      this.O = Geo.llaToEcef(lat, lon, 0);
      const b = Geo.localBasis(lat, lon);
      // Rows: east, up, south (ECEF -> render)
      this.R = [b.east[0], b.east[1], b.east[2], b.up[0], b.up[1], b.up[2], -b.north[0], -b.north[1], -b.north[2]];
    }
    /** ECEF direction -> render direction. */
    dir(v, out = new THREE.Vector3()) {
      const R = this.R;
      return out.set(R[0] * v[0] + R[1] * v[1] + R[2] * v[2], R[3] * v[0] + R[4] * v[1] + R[5] * v[2], R[6] * v[0] + R[7] * v[1] + R[8] * v[2]);
    }
    /** ECEF point -> render point. */
    point(p, out = new THREE.Vector3()) {
      return this.dir([p[0] - this.O[0], p[1] - this.O[1], p[2] - this.O[2]], out);
    }
    /**
     * Set obj.matrix so that its local axes map to ECEF by `basis` (row-major
     * 3x3, columns = local axes in ECEF; null = identity) at ECEF `pos`.
     */
    placeEcef(obj, pos, basis) {
      const R = this.R;
      const d0 = pos[0] - this.O[0], d1 = pos[1] - this.O[1], d2 = pos[2] - this.O[2];
      const tx = R[0] * d0 + R[1] * d1 + R[2] * d2, ty = R[3] * d0 + R[4] * d1 + R[5] * d2, tz = R[6] * d0 + R[7] * d1 + R[8] * d2;
      let m;
      if (!basis) m = R;
      else {
        m = new Array(9);
        for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) m[i * 3 + j] = R[i * 3] * basis[j] + R[i * 3 + 1] * basis[3 + j] + R[i * 3 + 2] * basis[6 + j];
      }
      obj.matrix.set(m[0], m[1], m[2], tx, m[3], m[4], m[5], ty, m[6], m[7], m[8], tz, 0, 0, 0, 1);
      obj.matrixWorldNeedsUpdate = true;
    }
  }
  /** ENU basis at a lat/lon as a render-style local frame (x east, y up, z south) in ECEF. */
  WorldFrame.enuBasis = function (lat, lon) {
    const b = Geo.localBasis(lat, lon);
    return [b.east[0], b.up[0], -b.north[0], b.east[1], b.up[1], -b.north[1], b.east[2], b.up[2], -b.north[2]];
  };
  window.WorldFrame = WorldFrame;
})();
