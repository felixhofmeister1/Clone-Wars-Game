/* =============================================================================
 * model.js — Procedural Airbus A330-900neo.
 *
 * Model axes: x forward, y up, z right (metres, origin at the CG — the same
 * point the flight model uses; body axes are x fwd, y right, z down).
 * Built from lofted airfoil sections: fuselage with nose and tail cone,
 * belly fairing, swept wings with dihedral, washout and sharklets, Trent 7000
 * nacelles with translating reverser cowls and spinning fans, pylons,
 * tailplane and fin. Moving parts are hinged on their real hinge lines:
 * slats, Fowler flaps, spoilers, two ailerons per side, elevators, trimmable
 * horizontal stabiliser, rudder, retracting main (inward) and nose (forward)
 * gear with oleo compression, steering and rolling wheels. Lights: nav,
 * strobes, beacons, landing/taxi, logo.
 * ========================================================================== */
(function () {
  'use strict';
  const D2R = Math.PI / 180;
  const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
  const lerp = (a, b, t) => a + (b - a) * t;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

  /* ------------------------------------------------------------ fuselage */
  // Stations: x, radius, centre height
  const FUSE = [
    [27.62, 0.02, -0.56], [27.45, 0.45, -0.52], [27.2, 0.8, -0.47], [26.8, 1.18, -0.39], [26.3, 1.56, -0.3],
    [25.7, 1.92, -0.2], [25.0, 2.24, -0.11], [24.2, 2.5, -0.05], [23.2, 2.68, -0.01], [22.0, 2.78, 0], [20.5, 2.82, 0],
    [-15.0, 2.82, 0], [-17.5, 2.77, 0.1], [-20.0, 2.63, 0.27], [-22.5, 2.4, 0.48], [-25.0, 2.1, 0.73],
    [-27.5, 1.76, 0.98], [-30.0, 1.38, 1.23], [-32.0, 1.02, 1.42], [-33.6, 0.64, 1.58], [-34.6, 0.3, 1.68], [-35.0, 0.08, 1.72],
  ];
  function fuseAt(x) {
    const S = FUSE;
    if (x >= S[0][0]) return [S[0][1], S[0][2]];
    for (let i = 0; i < S.length - 1; i++) {
      const a = S[i], b = S[i + 1];
      if (x <= a[0] && x >= b[0]) {
        // Cubic Hermite with finite-difference tangents for smooth curvature
        const t = (a[0] - x) / (a[0] - b[0]);
        const p = (k) => {
          const m0 = i > 0 ? (S[i + 1][k] - S[i - 1][k]) / (S[i - 1][0] - S[i + 1][0]) * (a[0] - b[0]) : b[k] - a[k];
          const m1 = i < S.length - 2 ? (S[i + 2][k] - S[i][k]) / (S[i][0] - S[i + 2][0]) * (a[0] - b[0]) : b[k] - a[k];
          const t2 = t * t, t3 = t2 * t;
          return (2 * t3 - 3 * t2 + 1) * a[k] + (t3 - 2 * t2 + t) * m0 + (-2 * t3 + 3 * t2) * b[k] + (t3 - t2) * m1;
        };
        return [Math.max(0.01, p(1)), p(2)];
      }
    }
    const l = S[S.length - 1];
    return [l[1], l[2]];
  }
  const NOSE_X = 27.62, TAIL_X = -35.0, FUSE_LEN = NOSE_X - TAIL_X;

  function fuselageGeometry(segs = 48) {
    const xs = [];
    for (let x = NOSE_X; x > 20; x -= 0.12) xs.push(x);
    for (let x = 20; x > -15; x -= 1.0) xs.push(x);
    for (let x = -15; x > TAIL_X; x -= 0.25) xs.push(x);
    xs.push(TAIL_X);
    const pos = [], uv = [], idx = [];
    for (let i = 0; i < xs.length; i++) {
      const x = xs[i];
      const [r, yc] = fuseAt(x);
      for (let j = 0; j <= segs; j++) {
        const phi = (j / segs) * Math.PI * 2;       // 0 = top, pi/2 = right, pi = bottom, 3pi/2 = left
        pos.push(x, yc + r * Math.cos(phi), r * Math.sin(phi));
        uv.push((NOSE_X - x) / FUSE_LEN, j / segs);
      }
    }
    const n = segs + 1;
    for (let i = 0; i < xs.length - 1; i++) for (let j = 0; j < segs; j++) {
      const a = i * n + j, b = a + 1, c = a + n, d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  }

  /* ------------------------------------------------------------- airfoils */
  /** Points of a cambered airfoil between chord fractions [xa, xb]: upper xb->xa, lower xa->xb. */
  function airfoil(t, camber, xa = 0, xb = 1, n = 12) {
    const yt = (x) => 5 * t * (0.2969 * Math.sqrt(x) - 0.126 * x - 0.3516 * x * x + 0.2843 * x ** 3 - 0.1036 * x ** 4);
    const yc = (x) => (x < 0.4 ? (camber / 0.16) * (0.8 * x - x * x) : (camber / 0.36) * (0.2 + 0.8 * x - x * x));
    const xsU = [];
    for (let i = 0; i <= n; i++) {
      const f = i / n;
      xsU.push(xa + (xb - xa) * (xa === 0 ? (1 - Math.cos((f * Math.PI) / 2)) : f));
    }
    const up = xsU.slice().reverse().map((x) => [x, yc(x) + yt(x)]);
    const lo = xsU.slice(xa === 0 ? 1 : 0).map((x) => [x, yc(x) - yt(x) * 0.8]);
    return up.concat(lo);
  }

  /** Loft through rings of equal length (arrays of Vector3). */
  function loft(rings, { capStart = true, capEnd = true, uvFn = null } = {}) {
    const m = rings[0].length;
    const pos = [], uv = [], idx = [];
    rings.forEach((ring, i) => ring.forEach((p, j) => {
      pos.push(p.x, p.y, p.z);
      if (uvFn) { const u = uvFn(p, i, j); uv.push(u[0], u[1]); } else uv.push(j / (m - 1), i / (rings.length - 1));
    }));
    for (let i = 0; i < rings.length - 1; i++) for (let j = 0; j < m; j++) {
      const j2 = (j + 1) % m;
      const a = i * m + j, b = i * m + j2, c = (i + 1) * m + j, d = (i + 1) * m + j2;
      idx.push(a, c, b, b, c, d);
    }
    const cap = (ring, offset, flip) => {
      const cIdx = pos.length / 3;
      const cen = ring.reduce((s, p) => s.add(p), V3(0, 0, 0)).multiplyScalar(1 / m);
      pos.push(cen.x, cen.y, cen.z); uv.push(0.5, 0.5);
      for (let j = 0; j < m; j++) {
        const a = offset + j, b = offset + ((j + 1) % m);
        if (flip) idx.push(cIdx, b, a); else idx.push(cIdx, a, b);
      }
    };
    if (capStart) cap(rings[0], 0, false);
    if (capEnd) cap(rings[rings.length - 1], (rings.length - 1) * m, true);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  }

  /* ----------------------------------------------------------------- wing */
  const WING = {
    zRoot: 2.4, zKink: 9.8, zTip: 31.0,
    leX: (z) => 5.2 - (z - 2.4) * Math.tan(31.5 * D2R),
    leY: (z) => -1.75 + (z - 2.4) * Math.tan(5.4 * D2R),
    teX: (z) => (z <= 9.8 ? lerp(-8.2, -8.7, (z - 2.4) / 7.4) : lerp(-8.7, -14.68, (z - 9.8) / 21.2)),
    thick: (z) => (z <= 9.8 ? lerp(0.15, 0.12, (z - 2.4) / 7.4) : lerp(0.12, 0.10, (z - 9.8) / 21.2)),
    twist: (z) => (z <= 9.8 ? lerp(3, 1, (z - 2.4) / 7.4) : lerp(1, -2, (z - 9.8) / 21.2)),
  };
  WING.chord = (z) => WING.leX(z) - WING.teX(z);
  /** A wing section ring in model space for side s (+1 right, -1 left). */
  function wingRing(z, s, xa, xb, n = 10) {
    const le = V3(WING.leX(z), WING.leY(z), s * z), c = WING.chord(z), tw = WING.twist(z) * D2R;
    const ct = Math.cos(tw), st = Math.sin(tw);
    // Chord-line coordinates rotated nose-up by the local incidence about the leading edge.
    return airfoil(WING.thick(z), 0.02, xa, xb, n).map(([ax, ay]) => {
      const px = -ax * c, py = ay * c;
      return V3(le.x + px * ct - py * st, le.y + px * st + py * ct, le.z);
    });
  }
  /** Point on the wing chord line (fraction f) at span z, with a vertical offset. */
  function wingPoint(z, s, f, dy = 0) {
    const c = WING.chord(z), tw = WING.twist(z) * D2R;
    return V3(WING.leX(z) - f * c * Math.cos(tw), WING.leY(z) - f * c * Math.sin(tw) + dy, s * z);
  }

  /** Hinged surface: group placed on the hinge line, child `rot` rotates about local X. */
  function hinged(geometry, material, p0, p1, up = V3(0, 1, 0)) {
    const ax = p1.clone().sub(p0).normalize();
    const y = up.clone().sub(ax.clone().multiplyScalar(up.dot(ax))).normalize();
    const zz = ax.clone().cross(y);
    const m = new THREE.Matrix4().makeBasis(ax, y, zz).setPosition(p0);
    geometry.applyMatrix4(m.clone().invert());
    const base = new THREE.Group();
    base.matrix.copy(m); base.matrixAutoUpdate = false;
    const rot = new THREE.Group();
    const mesh = new THREE.Mesh(geometry, material);
    rot.add(mesh); base.add(rot);
    return { base, rot, mesh };
  }

  /* ---------------------------------------------------------------- model */
  class AircraftModel {
    constructor(liveryId = 'island', opts = {}) {
      this.hi = !opts.lowQuality;
      this.root = new THREE.Group();
      this.root.name = 'A330-900';
      this.root.matrixAutoUpdate = false;
      this.parts = {};
      this.surfaces = [];
      this.wheels = [];
      this.fanAngle = 0;
      this.t = 0;
      this.mats = {
        wing: new THREE.MeshStandardMaterial({ color: 0xd6d9dd, roughness: 0.42, metalness: 0.18 }),
        device: new THREE.MeshStandardMaterial({ color: 0xc9cdd2, roughness: 0.45, metalness: 0.15 }),
        fairing: new THREE.MeshStandardMaterial({ color: 0xc3c7cc, roughness: 0.5, metalness: 0.1 }),
        grey: new THREE.MeshStandardMaterial({ color: 0x8f949a, roughness: 0.5, metalness: 0.35 }),
        dark: new THREE.MeshStandardMaterial({ color: 0x2a2d31, roughness: 0.6, metalness: 0.3 }),
        metal: new THREE.MeshStandardMaterial({ color: 0xbfc4ca, roughness: 0.22, metalness: 0.85 }),
        tyre: new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.9, metalness: 0 }),
        hub: new THREE.MeshStandardMaterial({ color: 0xa4a8ad, roughness: 0.35, metalness: 0.6 }),
        strut: new THREE.MeshStandardMaterial({ color: 0xdadcdf, roughness: 0.35, metalness: 0.45 }),
        chrome: new THREE.MeshStandardMaterial({ color: 0xe8eaec, roughness: 0.12, metalness: 1.0 }),
        fan: new THREE.MeshStandardMaterial({ color: 0x3a3e44, roughness: 0.35, metalness: 0.7 }),
        fuse: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.36, metalness: 0.06 }),
        fin: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.36, metalness: 0.06 }),
        nacelle: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.36, metalness: 0.08 }),
      };
      this.build();
      this.setLivery(liveryId);
    }

    build() {
      const R = this.root, M = this.mats;
      // Fuselage
      const fuse = new THREE.Mesh(fuselageGeometry(this.hi ? 56 : 36), M.fuse);
      R.add(fuse); this.parts.fuselage = fuse;
      // Belly (wing-to-body) fairing
      const bf = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 16), M.fairing);
      bf.scale.set(12.5, 1.45, 3.25); bf.position.set(-1.8, -1.72, 0);
      R.add(bf);

      for (const s of [1, -1]) this.buildWing(s);
      this.buildTail();
      for (const s of [1, -1]) this.buildEngine(s);
      this.buildGear();
      this.buildLights();
      // Antennas & details
      const ant = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.35, 0.05), M.grey);
      ant.position.set(10, 2.95, 0); R.add(ant);
      const ant2 = ant.clone(); ant2.position.set(-6, 2.95, 0); R.add(ant2);
      R.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } });
    }

    buildWing(s) {
      const R = this.root, M = this.mats;
      const side = s > 0 ? 'R' : 'L';
      const zs = [2.4, 3.2, 5.0, 7.0, 9.8, 12.5, 15.5, 18.5, 21.6, 23.7, 25.7, 27.8, 29.6, 30.4, 31.0];
      const XA = 0.13, XB = 0.74;
      // Main box (between slats and trailing-edge devices)
      const main = zs.map((z) => wingRing(z, s, XA, XB, 10));
      R.add(new THREE.Mesh(loft(s > 0 ? main : main.map((r) => r.slice().reverse())), M.wing));
      // Fixed leading edge at root and tip, fixed trailing edge at root and tip
      const fixedLE = (za, zb) => loft([za, zb].map((z) => wingRing(z, s, 0, XA + 0.005, 8)).map((r) => (s > 0 ? r : r.slice().reverse())));
      R.add(new THREE.Mesh(fixedLE(2.4, 3.8), M.wing));
      R.add(new THREE.Mesh(fixedLE(30.0, 31.0), M.wing));
      const fixedTE = (za, zb) => loft([za, zb].map((z) => wingRing(z, s, XB - 0.005, 1, 6)).map((r) => (s > 0 ? r : r.slice().reverse())));
      R.add(new THREE.Mesh(fixedTE(2.4, 3.2), M.wing));
      R.add(new THREE.Mesh(fixedTE(29.6, 31.0), M.wing));

      // Sharklet: continues the tip section and curves up
      const sk = [
        [31.0, 0.95, WING.leX(31.0), 2.35, 0], [31.5, 1.2, -12.72, 2.1, 20], [31.85, 1.75, -13.12, 1.8, 48],
        [32.02, 2.6, -13.7, 1.45, 72], [32.08, 3.7, -14.4, 1.08, 84], [32.1, 4.55, -14.95, 0.78, 87],
      ].map(([z, y, lx, c, cant]) => {
        const tdir = V3(0, Math.cos(cant * D2R), -s * Math.sin(cant * D2R));
        return airfoil(0.10, 0.02, 0, 1, 8).map(([ax, ay]) => V3(lx - ax * c, y, s * z).add(tdir.clone().multiplyScalar(ay * c)));
      });
      R.add(new THREE.Mesh(loft(s > 0 ? sk : sk.map((r) => r.slice().reverse())), M.wing));

      // Slats (7 per side, simplified to 3 moving panels)
      for (const [za, zb] of [[3.8, 9.4], [10.2, 19.5], [19.7, 30.0]]) {
        const rings = [za, (za + zb) / 2, zb].map((z) => wingRing(z, s, 0, XA, 8));
        const geo = loft(s > 0 ? rings : rings.map((r) => r.slice().reverse()));
        const h = hinged(geo, M.device, wingPoint(za, s, 0.18, -0.55), wingPoint(zb, s, 0.18, -0.55));
        R.add(h.base);
        this.surfaces.push({ kind: 'slat', s, rot: h.rot });
      }
      // Trailing-edge devices: inboard flap, outboard flap, inner & outer aileron
      const te = [['flap', 3.2, 9.8], ['flap', 10.0, 21.6], ['aileronIn', 21.8, 25.6], ['aileronOut', 25.8, 29.6]];
      for (const [kind, za, zb] of te) {
        const rings = [za, (za + zb) / 2, zb].map((z) => wingRing(z, s, XB, 1, 6));
        const geo = loft(s > 0 ? rings : rings.map((r) => r.slice().reverse()));
        const drop = kind === 'flap' ? -0.75 : -0.02;
        const hf = kind === 'flap' ? 0.7 : 0.745;
        const h = hinged(geo, M.device, wingPoint(za, s, hf, drop), wingPoint(zb, s, hf, drop));
        R.add(h.base);
        this.surfaces.push({ kind, s, rot: h.rot });
      }
      // Spoilers: 6 panels on the upper surface ahead of the flaps
      const spz = [[4.6, 7.2], [7.4, 9.6], [10.3, 12.9], [13.1, 15.7], [15.9, 18.5], [18.7, 21.3]];
      spz.forEach(([za, zb], i) => {
        const up = (z, f) => {
          const af = airfoil(WING.thick(z), 0.02, 0, 1, 40);
          const pt = af.slice(0, 41).reduce((best, p) => (Math.abs(p[0] - f) < Math.abs(best[0] - f) ? p : best));
          const c = WING.chord(z);
          return V3(WING.leX(z) - f * c, WING.leY(z) + pt[1] * c + 0.02, s * z);
        };
        const p = [up(za, 0.6), up(zb, 0.6), up(zb, 0.745), up(za, 0.745)];
        const g = new THREE.BufferGeometry().setFromPoints([p[0], p[1], p[2], p[0], p[2], p[3]]);
        g.computeVertexNormals();
        const h = hinged(g, new THREE.MeshStandardMaterial({ color: 0xcbd0d5, roughness: 0.45, metalness: 0.15, side: THREE.DoubleSide }), p[0], p[1]);
        R.add(h.base);
        this.surfaces.push({ kind: 'spoiler', s, rot: h.rot, i });
      });
      // Flap track fairings
      for (const z of [6.5, 12.8, 16.8, 20.6]) {
        const f = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), M.fairing);
        const p = wingPoint(z, s, 0.82, -0.35);
        f.scale.set(2.6 + WING.chord(z) * 0.12, 0.34, 0.3);
        f.position.copy(p);
        R.add(f);
      }
      // Wing-root landing lights (lens)
      const lens = new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 6), new THREE.MeshBasicMaterial({ color: 0xfff6d0 }));
      lens.position.set(WING.leX(3.9) - 0.1, WING.leY(3.9) - 0.1, s * 3.9);
      R.add(lens);
      this.parts['landingLens' + side] = lens;
    }

    buildTail() {
      const R = this.root, M = this.mats;
      // Horizontal stabiliser (trimmable) — both halves in one group pivoting on the THS jack line
      const ths = new THREE.Group();
      ths.position.set(-28.4, 1.2, 0);
      R.add(ths);
      this.parts.ths = ths;
      const hs = {
        leX: (z) => -24.2 - (z - 1.2) * Math.tan(34 * D2R), leY: (z) => 1.05 + (z - 1.2) * Math.tan(6 * D2R),
        chord: (z) => lerp(6.4, 2.2, (z - 1.2) / 8.5),
      };
      const hsRing = (z, s, xa, xb) => airfoil(0.11, 0, xa, xb, 8).map(([ax, ay]) => {
        const c = hs.chord(z);
        return V3(hs.leX(z) - ax * c + 28.4, hs.leY(z) + ay * c - 1.2, s * z);
      });
      for (const s of [1, -1]) {
        const zs = [1.2, 3, 5, 7.5, 9.7];
        const main = zs.map((z) => hsRing(z, s, 0, 0.7));
        ths.add(new THREE.Mesh(loft(s > 0 ? main : main.map((r) => r.slice().reverse())), M.wing));
        const el = [1.8, 5.5, 9.3].map((z) => hsRing(z, s, 0.7, 1));
        const geo = loft(s > 0 ? el : el.map((r) => r.slice().reverse()));
        const hp = (z) => { const c = hs.chord(z); return V3(hs.leX(z) - 0.71 * c + 28.4, hs.leY(z) - 1.2, s * z); };
        const h = hinged(geo, M.device, hp(1.8), hp(9.3));
        ths.add(h.base);
        this.surfaces.push({ kind: 'elevator', s, rot: h.rot });
        // Tip fill
        const tipRing = hsRing(9.7, s, 0.7, 1);
        const tipG = loft([hsRing(9.3, s, 0.7, 1), tipRing].map((r) => (s > 0 ? r : r.slice().reverse())));
        ths.add(new THREE.Mesh(tipG, M.wing));
      }
      // Fin
      const fin = {
        leX: (y) => -22.3 - (y - 2.3) * Math.tan(42 * D2R), chord: (y) => lerp(9.6, 3.6, (y - 2.3) / 9.2),
      };
      // Ring order reversed so faces point outward (thickness is along z here).
      const finRing = (y, xa, xb) => airfoil(0.11, 0, xa, xb, 10).map(([ax, ay]) => V3(fin.leX(y) - ax * fin.chord(y), y, ay * fin.chord(y))).reverse();
      const box = { x0: -34.5, x1: -21.5, y0: 2.3, y1: 11.6, logoX: -28.9, logoY: 6.3 };
      this.finBox = box;
      // Same (x, y) -> same texel on both sides: seen from the right the texture is mirrored,
      // so the condor signet faces forward on both sides, as on the real aircraft.
      const uvFn = (p) => [1 - (p.x - box.x0) / (box.x1 - box.x0), (p.y - box.y0) / (box.y1 - box.y0)];
      const ys = [1.0, 2.3, 4.5, 7.0, 9.5, 11.5];
      const finMain = loft(ys.map((y) => finRing(y, 0, 0.68)), { uvFn });
      const finMesh = new THREE.Mesh(finMain, M.fin);
      R.add(finMesh);
      this.parts.fin = finMesh;
      const rud = loft([1.4, 6.5, 11.3].map((y) => finRing(y, 0.68, 1)), { uvFn });
      const rp = (y) => V3(fin.leX(y) - 0.69 * fin.chord(y), y, 0);
      const h = hinged(rud, M.fin, rp(1.4), rp(11.3), V3(-1, 0, 0));
      R.add(h.base);
      this.surfaces.push({ kind: 'rudder', s: 1, rot: h.rot });
      // Dorsal fin fillet and tail cone APU exhaust
      const apu = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.4, 12, 1, true), M.dark);
      apu.rotation.z = Math.PI / 2; apu.position.set(-35.05, 1.72, 0);
      R.add(apu);
    }

    buildEngine(s) {
      const R = this.root, M = this.mats;
      const eng = new THREE.Group();
      eng.position.set(8.3, -2.3, s * 9.4);
      R.add(eng);
      const lathe = (pts, mat, segs = 40) => {
        // Profile = [distance aft of the inlet, radius]; lathe axis Y is turned onto model -X.
        const g = new THREE.LatheGeometry(pts.map(([x, r]) => new THREE.Vector2(r, x)), segs);
        g.rotateZ(Math.PI / 2);
        const P = g.attributes.position, U = g.attributes.uv;
        for (let i = 0; i < P.count; i++) U.setY(i, -P.getX(i) / 4.75); // stripes in metres
        return new THREE.Mesh(g, mat);
      };
      // Outer fan cowl (striped) — from the inlet lip to the start of the translating cowl
      const lip = lathe([[0.25, 1.36], [0.05, 1.44], [0, 1.52], [0.06, 1.6], [0.25, 1.66]], M.metal);
      eng.add(lip);
      const cowl = lathe([[0.25, 1.66], [0.8, 1.73], [1.6, 1.75], [2.6, 1.72], [3.4, 1.64]], M.nacelle);
      eng.add(cowl);
      // Translating (reverser) cowl
      const trans = lathe([[3.4, 1.64], [3.9, 1.57], [4.4, 1.46], [4.75, 1.36]], M.nacelle);
      eng.add(trans);
      // Inner duct
      const duct = lathe([[0.26, 1.34], [0.6, 1.38], [1.2, 1.42], [4.7, 1.3]], new THREE.MeshStandardMaterial({ color: 0x2a2d31, roughness: 0.6, metalness: 0.3, side: THREE.DoubleSide }));
      eng.add(duct);
      // Core cowl & exhaust plug
      const core = lathe([[3.9, 0.95], [4.6, 1.02], [5.4, 0.9], [6.1, 0.74]], M.grey);
      eng.add(core);
      const plug = lathe([[6.0, 0.55], [6.5, 0.45], [7.0, 0.22], [7.25, 0.02]], M.dark);
      eng.add(plug);
      // Fan & spinner
      const fan = new THREE.Group(); fan.position.set(-0.9, 0, 0); eng.add(fan);
      const blades = new THREE.Mesh(new THREE.CylinderGeometry(1.36, 1.36, 0.12, 22, 1, false), M.fan);
      blades.rotation.z = Math.PI / 2; fan.add(blades);
      for (let i = 0; i < 20; i++) {
        const b = new THREE.Mesh(new THREE.BoxGeometry(0.05, 1.05, 0.22), M.metal);
        b.position.set(0.07, 0, 0);
        const holder = new THREE.Group(); holder.rotation.x = (i / 20) * Math.PI * 2;
        b.position.y = 0.72; b.rotation.y = 0.5;
        holder.add(b); fan.add(holder);
      }
      const spinner = lathe([[-0.5, 0.02], [-0.3, 0.26], [0, 0.42], [0.1, 0.45]], new THREE.MeshStandardMaterial({ color: 0xe9ebee, roughness: 0.3, metalness: 0.5 }));
      fan.add(spinner);
      const swirl = new THREE.Mesh(new THREE.PlaneGeometry(0.07, 0.3), new THREE.MeshBasicMaterial({ color: 0x111111, side: THREE.DoubleSide }));
      swirl.position.set(0.16, 0.3, 0); swirl.rotation.y = Math.PI / 2; fan.add(swirl);
      // Pylon (side profile extruded across), engine-local: x forward from the inlet, y up
      const shape = new THREE.Shape();
      shape.moveTo(-1.2, 1.55); shape.lineTo(-4.5, 1.95); shape.lineTo(-7.2, 2.1); shape.lineTo(-10.2, 1.45);
      shape.lineTo(-9.0, 0.85); shape.lineTo(-6.2, 0.75); shape.lineTo(-4.7, 1.3); shape.lineTo(-1.2, 1.5); shape.closePath();
      const pg = new THREE.ExtrudeGeometry(shape, { depth: 0.5, bevelEnabled: true, bevelSize: 0.1, bevelThickness: 0.1, bevelSegments: 2 });
      pg.translate(0, 0, -0.25);
      eng.add(new THREE.Mesh(pg, M.fairing));
      this.parts['engine' + (s > 0 ? 'R' : 'L')] = { eng, fan, trans, s };
    }

    buildGear() {
      const R = this.root, M = this.mats;
      const wheel = (radius, width) => {
        const g = new THREE.Group();
        const tyre = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, width, 26, 1), M.tyre);
        tyre.rotation.x = Math.PI / 2; g.add(tyre);
        const hub = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.55, radius * 0.55, width + 0.02, 16, 1), M.hub);
        hub.rotation.x = Math.PI / 2; g.add(hub);
        const nut = new THREE.Mesh(new THREE.BoxGeometry(radius * 0.8, 0.06, width + 0.04), M.dark);
        g.add(nut);
        return g;
      };
      // Main gear (per side)
      this.mainGear = [];
      for (const s of [1, -1]) {
        const pivot = new THREE.Group(); pivot.position.set(-1.9, -1.25, s * 4.95); R.add(pivot);
        const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.24, 2.9, 14), M.strut);
        upper.position.set(-0.35, -1.45, s * 0.35); upper.rotation.x = s * 0.12; pivot.add(upper);
        const brace = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 2.7, 8), M.strut);
        brace.position.set(-0.35, -1.2, -s * 0.95); brace.rotation.x = -s * 0.75; pivot.add(brace);
        const door = new THREE.Mesh(new THREE.BoxGeometry(1.4, 2.6, 0.05), M.fuse);
        door.position.set(-0.35, -1.35, s * 0.62); door.rotation.x = s * 0.12; pivot.add(door);
        const slide = new THREE.Group(); slide.position.set(-0.7, -3.0, s * 0.4); pivot.add(slide);
        const piston = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 1.0, 12), M.chrome);
        piston.position.y = -0.3; slide.add(piston);
        const bogie = new THREE.Group(); bogie.position.set(0, -0.65, 0); slide.add(bogie);
        const beam = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.22, 0.26), M.strut); bogie.add(beam);
        for (const ax of [-0.99, 0.99]) {
          const axle = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 1.9, 8), M.strut);
          axle.rotation.x = Math.PI / 2; axle.position.x = ax; bogie.add(axle);
          for (const wz of [-0.72, 0.72]) {
            const w = wheel(0.685, 0.5); w.position.set(ax, 0, wz); bogie.add(w);
            this.wheels.push({ obj: w, r: 0.685 });
          }
        }
        this.mainGear.push({ s, pivot, slide, bogie });
      }
      // Nose gear
      const np = new THREE.Group(); np.position.set(22.9, -1.7, 0); R.add(np);
      const nUpper = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.18, 2.3, 12), M.strut);
      nUpper.position.y = -1.1; np.add(nUpper);
      const nSlide = new THREE.Group(); nSlide.position.y = -2.3; np.add(nSlide);
      const nSteer = new THREE.Group(); nSlide.add(nSteer);
      const nPiston = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.9, 10), M.chrome);
      nPiston.position.y = -0.3; nSteer.add(nPiston);
      const nAxle = new THREE.Group(); nAxle.position.set(-0.25, -0.98, 0); nSteer.add(nAxle);
      const nA = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 1.0, 8), M.strut); nA.rotation.x = Math.PI / 2; nAxle.add(nA);
      for (const wz of [-0.45, 0.45]) { const w = wheel(0.56, 0.36); w.position.z = wz; nAxle.add(w); this.wheels.push({ obj: w, r: 0.56 }); }
      const taxiLight = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), new THREE.MeshBasicMaterial({ color: 0xfff4d6 }));
      taxiLight.position.set(0.25, -0.2, 0); nSteer.add(taxiLight);
      this.noseGear = { pivot: np, slide: nSlide, steer: nSteer };
    }

    buildLights() {
      // Glow sprites driven per frame: [x,y,z, r,g,b, size]
      this.lightDefs = [
        { id: 'navL', p: [-13.3, 0.98, -31.25], c: [1, 0.1, 0.08], size: 1.2 },
        { id: 'navR', p: [-13.3, 0.98, 31.25], c: [0.1, 1, 0.3], size: 1.2 },
        { id: 'navT', p: [-35.1, 1.72, 0], c: [1, 1, 1], size: 1.0 },
        { id: 'strobeL', p: [-13.6, 0.98, -31.3], c: [1, 1, 1], size: 3.4 },
        { id: 'strobeR', p: [-13.6, 0.98, 31.3], c: [1, 1, 1], size: 3.4 },
        { id: 'strobeT', p: [-35.2, 1.72, 0], c: [1, 1, 1], size: 3.0 },
        { id: 'beaconT', p: [-2, 2.9, 0], c: [1, 0.12, 0.05], size: 2.0 },
        { id: 'beaconB', p: [1, -3.15, 0], c: [1, 0.12, 0.05], size: 2.0 },
        { id: 'landL', p: [WING.leX(3.9) + 0.1, WING.leY(3.9) - 0.1, -3.9], c: [1, 0.97, 0.88], size: 4.5 },
        { id: 'landR', p: [WING.leX(3.9) + 0.1, WING.leY(3.9) - 0.1, 3.9], c: [1, 0.97, 0.88], size: 4.5 },
        { id: 'taxi', p: [23.3, -3.9, 0], c: [1, 0.96, 0.85], size: 3.0 },
      ];
      const n = this.lightDefs.length;
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(this.lightDefs.flatMap((d) => d.p), 3));
      g.setAttribute('color', new THREE.Float32BufferAttribute(new Array(n * 3).fill(0), 3));
      g.setAttribute('size', new THREE.Float32BufferAttribute(this.lightDefs.map((d) => d.size), 1));
      this.lightUniforms = { pxScale: { value: 900 }, night: { value: 0 } };
      const mat = new THREE.ShaderMaterial({
        uniforms: this.lightUniforms, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
        vertexShader: `attribute vec3 color; attribute float size; uniform float pxScale, night; varying vec3 vC; varying float vA;
          #include <common>
          #include <logdepthbuf_pars_vertex>
          void main(){ vec4 mv = modelViewMatrix*vec4(position,1.0); gl_Position = projectionMatrix*mv;
            float d = max(-mv.z, 1.0); float px = size*pxScale/d; gl_PointSize = clamp(px*(0.5+1.2*night), 2.0, 64.0);
            vA = clamp(px*0.4+0.5,0.0,1.0)*mix(0.55,1.0,night); vC = color;
            #include <logdepthbuf_vertex>
          }`,
        fragmentShader: `varying vec3 vC; varying float vA;
          #include <logdepthbuf_pars_fragment>
          void main(){
            #include <logdepthbuf_fragment>
            float r = length(gl_PointCoord-0.5)*2.0; float c = smoothstep(1.0,0.0,r); float a = (pow(c,4.0)+0.3*c*c)*vA;
            if (a < 0.004 || dot(vC,vC) < 0.001) discard; gl_FragColor = vec4(vC*a, a); }`,
      });
      this.lightPoints = new THREE.Points(g, mat);
      this.lightPoints.frustumCulled = false;
      this.lightPoints.renderOrder = 8;
      this.root.add(this.lightPoints);
    }

    async setLivery(id) {
      const liv = Liveries.LIVERIES.find((l) => l.id === id) || Liveries.LIVERIES[0];
      this.livery = liv;
      try { if (document.fonts && document.fonts.load) await document.fonts.load(`800 64px ${Liveries.WORDMARK_FONT}`); } catch (e) { /* fallback font */ }
      const circumference = 2 * Math.PI * 2.82;
      const phiWin = Math.acos(0.35 / 2.82) / (2 * Math.PI);
      const fc = Liveries.fuselageCanvas(liv, { length: FUSE_LEN, noseX: NOSE_X, circumference, windowV: [1 - phiWin, phiWin] }, this.hi);
      const setMap = (mat, canvas) => {
        if (mat.map) mat.map.dispose();
        const t = new THREE.CanvasTexture(canvas);
        t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
        mat.map = t; mat.needsUpdate = true;
      };
      setMap(this.mats.fuse, fc);
      setMap(this.mats.fin, Liveries.finCanvas(liv, this.finBox));
      setMap(this.mats.nacelle, Liveries.nacelleCanvas(liv, 4.75));
      this.mats.fin.emissive.setRGB(1, 1, 1);
      this.mats.fin.emissiveMap = this.mats.fin.map;
      this.mats.fin.emissiveIntensity = 0;
      this.mats.fin.needsUpdate = true;
      this.liveryReady = true;
    }

    /**
     * Animate from the flight model state.
     * @param ac      FDM.Aircraft
     * @param lights  {nav, beacon, strobe, landing, taxi, logo}
     */
    update(ac, dt, lights = {}, night = 0) {
      this.t += dt;
      const D = D2R;
      for (const sf of this.surfaces) {
        let a = 0;
        switch (sf.kind) {
          case 'slat': a = -sf.s * (ac.slat * D) * 0.9; break;
          case 'flap': a = sf.s * ac.flap * D * 0.9; break;
          case 'aileronIn': case 'aileronOut': {
            const droop = ac.flap > 1 ? 5 * D * (ac.flap / 32) : 0; // aileron droop with flaps
            a = -ac.ail + sf.s * droop; break;
          }
          case 'spoiler': {
            const roll = sf.i >= 2 ? Math.max(0, sf.s * ac.ail) * 1.4 : 0; // roll spoilers on the down-going wing
            const sb = ac.spoilerSB * (sf.i >= 1 && sf.i <= 4 ? 30 * D : 0);
            const gs = ac.groundSpoiler * 50 * D;
            a = -sf.s * Math.min(50 * D, Math.max(roll, sb, gs));
            break;
          }
          case 'elevator': a = -sf.s * ac.elev; break;
          case 'rudder': a = -ac.rud; break;
        }
        sf.rot.rotation.x = a;
      }
      this.parts.ths.rotation.z = -ac.ths;
      // Engines: fan speed from N1, reverser translation
      for (const k of ['engineL', 'engineR']) {
        const e = this.parts[k];
        const eng = ac.engines[k === 'engineL' ? 0 : 1];
        const rpm = (eng.n1 / 100) * 2800;
        e.fan.rotation.x += (rpm / 60) * Math.PI * 2 * dt * (e.s > 0 ? 1 : -1) * 0.08;
        e.trans.position.x = -(eng.rev || 0) * 0.55;
      }
      // Gear: retraction, oleo compression, steering, wheel spin
      const up = 1 - ac.gearPos;
      const comp = ac.gearComp || [0, 0, 0];
      for (const mg of this.mainGear) {
        mg.pivot.rotation.x = mg.s * up * 88 * D;
        mg.slide.position.y = -3.0 + clamp(comp[mg.s > 0 ? 2 : 1] || 0, 0, 0.55);
        mg.bogie.rotation.z = ac.wowMain ? 0 : 0.2; // bogie rests toes-up in flight
      }
      const ng = this.noseGear;
      ng.pivot.rotation.z = up * 96 * D;
      ng.slide.position.y = -2.3 + clamp(comp[0] || 0, 0, 0.45);
      ng.steer.rotation.y = -ac.steer;
      const spin = ac.onGround ? ac.gs : Math.max(0, (this.lastSpin || 0) - dt * 4);
      this.lastSpin = spin;
      for (const w of this.wheels) w.obj.rotation.z -= (spin / w.r) * dt;

      // Lights
      const col = this.lightPoints.geometry.attributes.color;
      const t = this.t;
      const strobeOn = lights.strobe && ((t % 1.0) < 0.05 || ((t % 1.0) > 0.12 && (t % 1.0) < 0.17));
      const beaconOn = lights.beacon && (t % 1.1) < 0.12;
      this.lightDefs.forEach((d, i) => {
        let on = false;
        if (d.id.startsWith('nav')) on = lights.nav;
        else if (d.id.startsWith('strobe')) on = strobeOn;
        else if (d.id.startsWith('beacon')) on = beaconOn;
        else if (d.id.startsWith('land')) on = lights.landing && ac.gearPos > 0.5;
        else if (d.id === 'taxi') on = lights.taxi && ac.gearPos > 0.95;
        col.setXYZ(i, ...(on ? d.c : [0, 0, 0]));
      });
      col.needsUpdate = true;
      this.lightUniforms.night.value = night;
      // Logo lights wash the fin at night
      this.mats.fin.emissiveIntensity = lights.logo ? night * 0.35 : 0;
    }

    setPixelScale(pxScale) { this.lightUniforms.pxScale.value = pxScale; }
    setExteriorVisible(v) { for (const c of this.root.children) if (c !== this.lightPoints) c.visible = v; }
  }

  /* --------------------------------------------------------- ground shadow */
  function makeShadow() {
    const tex = new THREE.CanvasTexture(Liveries.shadowCanvas());
    const geo = new THREE.PlaneGeometry(67, 67);
    // Canvas up -> model +x (nose), canvas right -> model +z (right wing), normal +y.
    geo.applyMatrix4(new THREE.Matrix4().makeBasis(V3(0, 0, 1), V3(1, 0, 0), V3(0, 1, 0)));
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0x000000, alphaMap: tex, transparent: true, depthWrite: false, opacity: 0.5 }));
    m.renderOrder = 2;
    m.matrixAutoUpdate = false;
    return m;
  }

  window.A330Model = { AircraftModel, makeShadow, NOSE_X, TAIL_X };
})();
