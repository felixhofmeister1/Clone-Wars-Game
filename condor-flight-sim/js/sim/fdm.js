/* =============================================================================
 * fdm.js — Six-degree-of-freedom flight model of the Airbus A330-900neo
 * (Rolls-Royce Trent 7000) with the Airbus fly-by-wire NORMAL LAW.
 *
 *  • Rigid body on a spherical earth: position/velocity in ECEF, attitude as a
 *    body->ECEF quaternion, so great-circle flights and curvature are exact.
 *  • Body axes: x forward, y right, z down (aerospace convention).
 *  • Aerodynamics: lift/drag/side force + pitch/roll/yaw moments from
 *    stability derivatives, flap/slat configurations, gear, spoilers, stall,
 *    ground effect and transonic drag rise.
 *  • Engines: thrust lapse with altitude and Mach, spool dynamics, thrust
 *    lever detents (IDLE / CL / FLX-MCT / TOGA), reversers, fuel burn.
 *  • Landing gear: oleo spring-dampers, tyre friction, brakes, autobrake,
 *    nose-wheel steering, ground spoilers.
 *  • Flight control computer: ground law (direct), flight law (sidestick =
 *    load-factor demand, neutral stick holds flight path, auto-trim THS;
 *    sidestick roll = roll-rate demand, neutral holds bank up to 33°), flare
 *    law, and protections (pitch attitude, angle of attack, high speed, bank).
 *
 * The model is pure JS (no three.js) so it can be exercised headlessly in Node.
 * ========================================================================== */
(function (root) {
  'use strict';

  const Geo = root.Geo || (typeof require !== 'undefined' ? require('./geo.js') : null);
  const { D2R, R2D, KT, FT, clamp } = Geo;
  const G0 = 9.80665;

  /* ------------------------------------------------------------ vector maths */
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const len = (a) => Math.sqrt(dot(a, a));
  const scale = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
  const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const norm = (a) => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
  const lerp = (a, b, t) => a + (b - a) * t;
  const approach = (v, target, rate) => (v < target ? Math.min(target, v + rate) : Math.max(target, v - rate));
  const smoothSign = (v, w) => Math.tanh(v / w);

  // Quaternion [w, x, y, z]
  function qMul(a, b) {
    return [
      a[0] * b[0] - a[1] * b[1] - a[2] * b[2] - a[3] * b[3],
      a[0] * b[1] + a[1] * b[0] + a[2] * b[3] - a[3] * b[2],
      a[0] * b[2] - a[1] * b[3] + a[2] * b[0] + a[3] * b[1],
      a[0] * b[3] + a[1] * b[2] - a[2] * b[1] + a[3] * b[0],
    ];
  }
  function qNorm(q) { const l = Math.hypot(q[0], q[1], q[2], q[3]); return [q[0] / l, q[1] / l, q[2] / l, q[3] / l]; }
  /** Rotation matrix (row-major 3x3 as 9-array) of quaternion: v_world = M * v_body. */
  function qToMat(q) {
    const [w, x, y, z] = q;
    return [
      1 - 2 * (y * y + z * z), 2 * (x * y - w * z), 2 * (x * z + w * y),
      2 * (x * y + w * z), 1 - 2 * (x * x + z * z), 2 * (y * z - w * x),
      2 * (x * z - w * y), 2 * (y * z + w * x), 1 - 2 * (x * x + y * y),
    ];
  }
  function matToQ(m) {
    const tr = m[0] + m[4] + m[8];
    let w, x, y, z;
    if (tr > 0) {
      const s = Math.sqrt(tr + 1) * 2;
      w = 0.25 * s; x = (m[7] - m[5]) / s; y = (m[2] - m[6]) / s; z = (m[3] - m[1]) / s;
    } else if (m[0] > m[4] && m[0] > m[8]) {
      const s = Math.sqrt(1 + m[0] - m[4] - m[8]) * 2;
      w = (m[7] - m[5]) / s; x = 0.25 * s; y = (m[1] + m[3]) / s; z = (m[2] + m[6]) / s;
    } else if (m[4] > m[8]) {
      const s = Math.sqrt(1 + m[4] - m[0] - m[8]) * 2;
      w = (m[2] - m[6]) / s; x = (m[1] + m[3]) / s; y = 0.25 * s; z = (m[5] + m[7]) / s;
    } else {
      const s = Math.sqrt(1 + m[8] - m[0] - m[4]) * 2;
      w = (m[3] - m[1]) / s; x = (m[2] + m[6]) / s; y = (m[5] + m[7]) / s; z = 0.25 * s;
    }
    return qNorm([w, x, y, z]);
  }
  const mulMV = (m, v) => [m[0] * v[0] + m[1] * v[1] + m[2] * v[2], m[3] * v[0] + m[4] * v[1] + m[5] * v[2], m[6] * v[0] + m[7] * v[1] + m[8] * v[2]];
  const mulMtV = (m, v) => [m[0] * v[0] + m[3] * v[1] + m[6] * v[2], m[1] * v[0] + m[4] * v[1] + m[7] * v[2], m[2] * v[0] + m[5] * v[1] + m[8] * v[2]];

  /* ------------------------------------------------------------- atmosphere */
  const P0 = 101325, T0 = 288.15, RHO0 = 1.225, A0 = 340.294, RGAS = 287.05287;
  /** ISA (+ temperature deviation) at geometric altitude h (m). */
  function atmosphere(h, isaDev = 0) {
    const hc = clamp(h, -500, 25000);
    let Tstd, P;
    if (hc < 11000) { Tstd = T0 - 0.0065 * hc; P = P0 * Math.pow(Tstd / T0, 5.25588); }
    else { Tstd = 216.65; P = 22632.06 * Math.exp(-G0 * (hc - 11000) / (RGAS * Tstd)); }
    const T = Tstd + isaDev;
    const rho = P / (RGAS * T);
    return { T, P, rho, a: Math.sqrt(1.4 * RGAS * T), sigma: rho / RHO0 };
  }
  /** Calibrated airspeed from true airspeed. */
  function tasToCas(tas, atm) {
    const M = tas / atm.a;
    const qc = atm.P * (Math.pow(1 + 0.2 * M * M, 3.5) - 1);
    return A0 * Math.sqrt(5 * (Math.pow(qc / P0 + 1, 2 / 7) - 1));
  }
  function casToTas(cas, atm) {
    const qc = P0 * (Math.pow(1 + 0.2 * (cas / A0) ** 2, 3.5) - 1);
    const M = Math.sqrt(5 * (Math.pow(qc / atm.P + 1, 2 / 7) - 1));
    return M * atm.a;
  }

  /* ------------------------------------------------------ A330-900 data */
  const A339 = {
    type: 'A330-941', S: 465, b: 64.0, c: 7.26,
    oew: 132000, mtow: 251000, mlw: 191000, mzfw: 181000, maxFuel: 111000,
    inertiaRef: 200000, inertia: [1.25e7, 2.35e7, 3.45e7],
    vmo: 330, mmo: 0.86, vle: 250, vlo: 250,
    thrustStatic: 324000, // Trent 7000, per engine (N)
    engines: [[4.2, -9.4, 2.3], [4.2, 9.4, 2.3]],
    // Landing gear contact points (uncompressed), body frame about the CG.
    gear: [
      { name: 'nose', p: [22.8, 0, 5.55], k: 1.3e6, c: 1.8e5, stroke: 0.45, steer: true, mu: 0.8 },
      { name: 'left', p: [-2.6, -5.35, 5.6], k: 3.6e6, c: 7.0e5, stroke: 0.55, brake: true, mu: 0.8 },
      { name: 'right', p: [-2.6, 5.35, 5.6], k: 3.6e6, c: 7.0e5, stroke: 0.55, brake: true, mu: 0.8 },
    ],
    // Hard points that must never touch the ground.
    contacts: [
      { name: 'tail', p: [-26.5, 0, 0.87], kind: 'tail' },
      { name: 'aft body', p: [-33.5, 0, -0.9], kind: 'body' },
      { name: 'nose', p: [26.5, 0, 2.6], kind: 'body' },
      { name: 'belly', p: [-2.0, 0, 2.9], kind: 'body' },
      { name: 'left engine', p: [4.2, -9.4, 3.95], kind: 'pod' },
      { name: 'right engine', p: [4.2, 9.4, 3.95], kind: 'pod' },
      { name: 'left wingtip', p: [-13.5, -31.8, -1.1], kind: 'wing' },
      { name: 'right wingtip', p: [-13.5, 31.8, -1.1], kind: 'wing' },
    ],
    // Flap lever positions 0,1,2,3,FULL -> configurations (1 gives 1+F on take-off).
    confs: [
      { name: '0', slat: 0, flap: 0, vfe: 999 },
      { name: '1', slat: 16, flap: 0, vfe: 240 },
      { name: '1+F', slat: 16, flap: 8, vfe: 215 },
      { name: '2', slat: 20, flap: 14, vfe: 196 },
      { name: '3', slat: 23, flap: 22, vfe: 186 },
      { name: 'FULL', slat: 23, flap: 32, vfe: 180 },
    ],
    aero: {
      CL0: 0.22, CLa: 5.3, CLq: 5.0, CLde: -0.25, CLmax: 1.12,
      CD0: 0.0165, k: 0.043, CDgear: 0.018,
      Cm0: 0.02, Cma: -1.2, Cmq: -32, Cmad: -8, Cmde: 0.6, Cmih: 1.3, CmFlap: -0.08,
      Clb: -0.10, Clp: -0.45, Clr: 0.10, Clda: 0.12, Cldr: -0.01,
      Cnb: 0.12, Cnr: -0.22, Cnp: -0.03, Cnda: -0.006, Cndr: 0.075,
      CYb: -0.9, CYdr: -0.2,
    },
    elevUp: 30 * D2R, elevDown: 15 * D2R, ailMax: 25 * D2R, rudMax: 31.6 * D2R,
    thsMin: -3 * D2R, thsMax: 14 * D2R, steerMax: 72 * D2R,
  };

  /** Aerodynamic increments for actual slat / flap angles (deg). */
  function flapAero(slat, flap) {
    const s = slat / 23, f = flap / 32;
    return {
      dCL0: 0.46 * f,
      dCLmax: 0.40 * Math.pow(Math.max(0, s), 0.6) + 0.012 * flap,
      dCD0: 0.0004 * slat + 0.00095 * flap + 0.00001 * flap * flap,
      dCm: A339.aero.CmFlap * f,
    };
  }

  /** 1-g stall speed (CAS, m/s) for a configuration index and mass. */
  function vs1g(confIdx, mass) {
    const c = A339.confs[confIdx];
    const fa = flapAero(c.slat, c.flap);
    return Math.sqrt((2 * mass * G0) / (RHO0 * A339.S * (A339.aero.CLmax + fa.dCLmax)));
  }

  /* ================================================================ Aircraft */
  class Aircraft {
    constructor(env = {}) {
      this.P = A339;
      this.env = Object.assign({
        groundHeight: () => 0,          // (lat, lon) -> metres MSL
        wind: () => [0, 0, 0],          // (altM, lat, lon, t) -> [north, east, down] m/s air movement
        isaDev: 0,
        surface: () => 'runway',        // (lat, lon) -> 'runway' | 'grass' | 'water'
      }, env);
      this.controls = {
        pitch: 0, roll: 0, yaw: 0,       // sidestick (pull +, right +), pedals (right +)
        tiller: null,                    // optional separate tiller (-1..1)
        throttle: 0,                     // -1 max rev .. 0 idle .. 0.6 CL .. 0.8 FLX/MCT .. 1 TOGA
        brakeL: 0, brakeR: 0, parkingBrake: false,
        flapLever: 0, speedbrake: 0, spoilersArmed: false,
        gearDown: true, autobrake: 0,    // 0 off, 1 LO, 2 MED, 3 MAX
        law: 'normal',                   // 'normal' | 'direct'
      };
      // Autoflight demand interface (written by the FMGC each step).
      this.ap = { engaged: false, gammaDot: null, pCmd: null, yaw: 0, flare: false };
      this.athr = { active: false, cmd: 0, alphaFloor: false };
      this.events = [];
      this.reset({ lat: 0, lon: 0, heading: 0, onGround: true });
    }

    /* ------------------------------------------------------------------ reset */
    reset(o) {
      const P = this.P;
      this.t = 0;
      this.fuel = o.fuel ?? 40000;
      this.payload = o.payload ?? 30000;
      this.flexTemp = o.flexTemp ?? 55;
      this.crashed = null;
      this.events.length = 0;
      this.maxNz = 1; this.nz = 1; this.touchdown = null; this.airTime = 0; this.groundTime = 0;
      this.tailStrike = false; this.stallWarn = false; this.overspeed = false;

      const c = this.controls;
      c.pitch = c.roll = c.yaw = 0; c.brakeL = c.brakeR = 0;
      c.flapLever = o.flapLever ?? 0; c.speedbrake = 0; c.spoilersArmed = !!o.spoilersArmed;
      c.gearDown = o.gearDown ?? true; c.throttle = 0; c.parkingBrake = !!o.parkingBrake;
      c.autobrake = o.autobrake ?? 0;

      // Surface states
      this.conf = this.confFromLever(c.flapLever, !!o.onGround, 0);
      const cf = P.confs[this.conf];
      this.slat = cf.slat; this.flap = cf.flap;
      this.gearPos = c.gearDown ? 1 : 0;
      this.elev = 0; this.ail = 0; this.rud = 0; this.steer = 0;
      this.ths = (o.ths ?? 2.5) * D2R;
      this.spoilerSB = 0; this.groundSpoiler = 0;
      this.brakeCmd = [0, 0]; this.autobrakeActive = false; this.autobrakeTimer = 0;
      this.engines = [0, 1].map(() => ({ n: 0, rev: 0, thrust: 0, n1: 21, n2: 60, egt: 450, ff: 0, running: true }));

      // FCC state
      this.flightBlend = o.onGround ? 0 : 1;
      this.pitchI = (P.aero.Cmih / P.aero.Cmde) * this.ths;
      this.gammaT = 0; this.gammaHoldTimer = 0; this.phiHold = 0;
      this.alphaProt = false; this.flareMode = false; this.flareT = 0; this.thetaMem = 0;
      this.highSpeedProt = false;

      const hdg = o.heading || 0;
      const gnd = this.env.groundHeight(o.lat, o.lon);
      this.lastGround = gnd;
      let alt;
      let pitchDeg = o.pitch ?? 0;
      if (o.onGround) {
        // Rest on compressed oleos: mains ~0.30 m, nose ~0.19 m.
        alt = gnd + 5.30;
        pitchDeg = Math.atan2((5.55 - 0.19) - (5.6 - 0.30), 22.8 + 2.6) * R2D;
      } else {
        alt = o.alt;
      }
      this.pos = Geo.llaToEcef(o.lat, o.lon, alt);
      this.setAttitude(o.lat, o.lon, hdg, pitchDeg, o.roll || 0);
      this.omega = [0, 0, 0];
      const b = Geo.localBasis(o.lat, o.lon);
      const spd = o.onGround ? 0 : (o.tas ?? 130);
      const gamma = (o.gamma ?? 0) * D2R;
      const dir = add(add(scale(b.north, Math.cos(hdg * D2R) * Math.cos(gamma)), scale(b.east, Math.sin(hdg * D2R) * Math.cos(gamma))), scale(b.up, Math.sin(gamma)));
      this.vel = scale(dir, spd);
      this.prevVel = this.vel.slice();
      this.derive(0);
      this.onGround = !!o.onGround;
      this.wow = [!!o.onGround, !!o.onGround, !!o.onGround];
      this.wowMain = !!o.onGround;
    }

    setAttitude(lat, lon, hdgDeg, pitchDeg, rollDeg) {
      const b = Geo.localBasis(lat, lon);
      const ps = hdgDeg * D2R, th = pitchDeg * D2R, ph = rollDeg * D2R;
      // Body->NED (ZYX Euler)
      const cps = Math.cos(ps), sps = Math.sin(ps), cth = Math.cos(th), sth = Math.sin(th), cph = Math.cos(ph), sph = Math.sin(ph);
      const Rbn = [
        cth * cps, sph * sth * cps - cph * sps, cph * sth * cps + sph * sps,
        cth * sps, sph * sth * sps + cph * cps, cph * sth * sps - sph * cps,
        -sth, sph * cth, cph * cth,
      ];
      // NED->ECEF columns: north, east, down
      const d = scale(b.up, -1);
      const Rne = [b.north[0], b.east[0], d[0], b.north[1], b.east[1], d[1], b.north[2], b.east[2], d[2]];
      const M = new Array(9);
      for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) M[i * 3 + j] = Rne[i * 3] * Rbn[j] + Rne[i * 3 + 1] * Rbn[3 + j] + Rne[i * 3 + 2] * Rbn[6 + j];
      this.q = matToQ(M);
    }

    confFromLever(lever, onGround, cas) {
      if (lever === 0) return 0;
      if (lever === 1) {
        // 1+F on the ground / below 200 kt when coming from 1+F; 1 (slats only) otherwise.
        if (onGround) return 2;
        if (this.conf === 2 && cas < 200) return 2;
        if (this.conf >= 3 && cas < 200) return 2;
        return 1;
      }
      return lever + 1; // 2 -> conf 2 (idx 3), 3 -> idx 4, FULL(4) -> idx 5
    }

    get mass() { return this.P.oew + this.payload + this.fuel; }

    /* ------------------------------------------------------ derived state */
    derive(dt) {
      const lla = Geo.ecefToLla(this.pos);
      this.lat = lla.lat; this.lon = lla.lon; this.alt = lla.h;
      const b = Geo.localBasis(lla.lat, lla.lon);
      this.basis = b;
      const M = qToMat(this.q);
      this.M = M;
      // Body axes in ECEF
      const xb = [M[0], M[3], M[6]], yb = [M[1], M[4], M[7]], zb = [M[2], M[5], M[8]];
      // Euler angles relative to local NED
      const xn = [dot(xb, b.north), dot(xb, b.east), -dot(xb, b.up)];
      const yn_d = -dot(yb, b.up), zn_d = -dot(zb, b.up);
      this.pitch = Math.asin(clamp(-xn[2], -1, 1));
      this.roll = Math.atan2(yn_d, zn_d);
      this.heading = Math.atan2(xn[1], xn[0]);
      // Velocities
      const vN = dot(this.vel, b.north), vE = dot(this.vel, b.east), vU = dot(this.vel, b.up);
      this.vN = vN; this.vE = vE; this.vs = vU;
      this.gs = Math.hypot(vN, vE);
      this.track = Math.atan2(vE, vN);
      this.gamma = Math.atan2(vU, Math.max(this.gs, 0.1));
      // Air data
      const wind = this.env.wind(this.alt, this.lat, this.lon, this.t) || [0, 0, 0];
      this.windNED = wind;
      const windE = add(add(scale(b.north, wind[0]), scale(b.east, wind[1])), scale(b.up, -wind[2]));
      const vair = sub(this.vel, windE);
      const vb = mulMtV(M, vair);
      this.vb = vb;
      const V = len(vb);
      this.tas = V;
      this.atm = atmosphere(this.alt, this.env.isaDev);
      this.mach = V / this.atm.a;
      this.cas = tasToCas(V, this.atm);
      this.qbar = 0.5 * this.atm.rho * V * V;
      this.alpha = V > 1 ? Math.atan2(vb[2], vb[0]) : 0;
      this.beta = V > 1 ? Math.asin(clamp(vb[1] / V, -1, 1)) : 0;
      // Body rates
      this.p = this.omega[0]; this.qr = this.omega[1]; this.r = this.omega[2];
      // Ground & radio altitude
      if (dt === 0 || this.alt - this.lastGround < 3000 || (this.t % 0.5) < dt) this.lastGround = this.env.groundHeight(this.lat, this.lon);
      this.ground = this.lastGround;
      const mainZ = this.P.gear[1].p;
      const hMain = this.alt - this.ground - (mainZ[2] * Math.cos(this.pitch) * Math.cos(this.roll) - mainZ[0] * Math.sin(this.pitch));
      this.ra = hMain + 0.30;
      this.agl = this.alt - this.ground;
    }

    /* ---------------------------------------------------------- systems */
    systems(dt) {
      const P = this.P, c = this.controls, casKt = this.cas / KT;
      // Flaps / slats
      const target = this.confFromLever(c.flapLever, this.wowMain, casKt);
      this.conf = target;
      const cf = P.confs[target];
      this.slat = approach(this.slat, cf.slat, 1.3 * dt);
      this.flap = approach(this.flap, cf.flap, 1.4 * dt);
      // Gear (no retraction with weight on wheels)
      const gearTarget = c.gearDown || this.wowMain ? 1 : 0;
      if (this.wowMain && !c.gearDown) c.gearDown = true;
      this.gearPos = approach(this.gearPos, gearTarget, dt / 11);
      // Speedbrakes (inhibited in CONF FULL and in alpha protection)
      const sbAllowed = this.conf < 5 && !this.alphaProt && !this.athr.alphaFloor;
      this.spoilerSB = approach(this.spoilerSB, sbAllowed ? clamp(c.speedbrake, 0, 1) : 0, dt / 2.5);
      // Ground spoilers: extend when armed with idle/reverse above ~40 kt (landing or
      // rejected take-off), or when reverse is selected; they stay out until disarmed
      // or thrust is advanced.
      const idleOrRev = c.throttle <= 0.05;
      const revSel = c.throttle < -0.02;
      if (!this.wowMain || c.throttle > 0.1 || (!c.spoilersArmed && !revSel)) this.gsLatch = false;
      else if ((c.spoilersArmed && idleOrRev && this.gs > 20) || (revSel && this.gs > 20)) this.gsLatch = true;
      this.groundSpoiler = approach(this.groundSpoiler, this.gsLatch ? 1 : 0, dt / 1.2);

      // Engines
      const T0 = P.thrustStatic;
      const M = this.mach, sig = this.atm.sigma;
      const toga = T0 * Math.pow(sig, 0.9) * (1 - 0.55 * M + 0.35 * M * M) * (1 - Math.max(0, this.env.isaDev - 15) * 0.008);
      const idle = T0 * (0.025 * Math.pow(sig, 0.9) * (1 - 1.1 * M));
      this.togaThrust = toga; this.idleThrust = idle;
      const clb = 0.89 * toga, mct = 0.95 * toga;
      const flx = this.wowMain || this.airTime < 300 ? toga * clamp(1 - (this.flexTemp - 30) * 0.0045, 0.75, 1) : mct;
      this.ratings = { toga, clb, mct, flx };
      const lever = c.throttle;
      let manual;
      if (lever <= 0) manual = idle;
      else if (lever <= 0.6) manual = idle + (clb - idle) * (lever / 0.6);
      else if (lever <= 0.8) manual = clb + (flx - clb) * ((lever - 0.6) / 0.2);
      else manual = flx + (toga - flx) * ((lever - 0.8) / 0.2);
      let demand = manual;
      if (this.athr.alphaFloor) demand = toga;
      else if (this.athr.active && lever > 0.02 && lever <= 0.61) demand = idle + clamp(this.athr.cmd, 0, 1) * (Math.min(manual, clb) - idle);
      const nTarget = clamp((demand - idle) / Math.max(1, toga - idle), 0, 1);
      for (const e of this.engines) {
        if (!e.running || this.fuel <= 0) { e.n = approach(e.n, -0.6, dt * 0.2); e.thrust = 0; e.ff = 0; e.n1 = Math.max(0, 21 + 35 * e.n); continue; }
        // Reverser
        const revT = revSel && this.wowMain ? 1 : 0;
        e.rev = approach(e.rev, revT, dt / 1.8);
        let nt = nTarget;
        if (e.rev > 0.05 || revSel) nt = e.rev > 0.95 ? clamp(-lever, 0, 1) * 0.75 : 0;
        const accel = 0.08 + 0.25 * Math.max(0, e.n);
        const dn = clamp((nt - e.n) * 3, -0.35, accel);
        e.n = clamp(e.n + dn * dt, 0, 1);
        const gross = idle + (toga - idle) * e.n;
        if (e.rev > 0.05) {
          const revMax = 0.22 * T0 * Math.pow(sig, 0.9);
          e.thrust = lerp(gross, -(0.05 * T0 + (revMax - 0.05 * T0) * (e.n / 0.75)), e.rev);
        } else e.thrust = gross;
        e.n1 = 21 + 74 * Math.sqrt(e.n);
        e.n2 = 60 + 38 * Math.pow(e.n, 0.6);
        e.egt = 460 + 470 * Math.pow(e.n, 1.3) + this.env.isaDev * 1.5;
        const tsfc = (0.275 + 0.245 * M) * 2.833e-5; // kg/(N s)
        e.ff = Math.max(250 / 3600, tsfc * Math.max(0, Math.abs(e.thrust)));
      }
      this.fuel = Math.max(0, this.fuel - (this.engines[0].ff + this.engines[1].ff) * dt);

      // Brakes & autobrake
      let bl = c.brakeL, br = c.brakeR;
      if (c.parkingBrake) { bl = br = 1; }
      if (Math.max(c.brakeL, c.brakeR) > 0.55 && this.autobrakeActive) { this.autobrakeActive = false; c.autobrake = 0; this.emit('autobrake', { state: 'disarmed' }); }
      if (c.autobrake && this.wowMain && this.groundSpoiler > 0.5) {
        this.autobrakeTimer += dt;
        const delay = c.autobrake === 1 ? 4 : c.autobrake === 2 ? 2 : 0;
        if (this.autobrakeTimer > delay) this.autobrakeActive = true;
      } else if (!this.wowMain) { this.autobrakeTimer = 0; this.autobrakeActive = false; }
      if (this.autobrakeActive && c.throttle > 0.05 && c.autobrake) { this.autobrakeActive = false; }
      const decelNow = ((this.prevGs ?? this.gs) - this.gs) / Math.max(dt, 1e-4);
      this.prevGs = this.gs;
      this.decel = lerp(this.decel || 0, decelNow, Math.min(1, dt * 5));
      if (this.autobrakeActive) {
        const targetDecel = [0, 1.7, 3.0, 6.0][c.autobrake];
        this.abCmd = clamp((this.abCmd || 0) + (targetDecel - this.decel) * 0.5 * dt, 0, 1);
        if (c.autobrake === 3) this.abCmd = 1;
        if (this.gs < 1) this.abCmd = Math.max(this.abCmd, 0.3);
        bl = Math.max(bl, this.abCmd); br = Math.max(br, this.abCmd);
      } else this.abCmd = 0;
      this.brakeCmd[0] = approach(this.brakeCmd[0], bl, dt * 4);
      this.brakeCmd[1] = approach(this.brakeCmd[1], br, dt * 4);
    }

    /* ------------------------------------------- flight control computer */
    fcc(dt) {
      const P = this.P, A = P.aero, c = this.controls, ap = this.ap;
      const V = Math.max(this.tas, 45);
      const casKt = this.cas / KT;
      const flapsOut = c.flapLever > 0;
      const ratio = A.Cmih / A.Cmde;
      const air = !this.wowMain;
      const direct = c.law === 'direct';

      // Instinctive AP disconnect by sidestick input.
      if (ap.engaged && (Math.abs(c.pitch) > 0.45 || Math.abs(c.roll) > 0.45)) this.emit('apDisconnect', { reason: 'sidestick' });

      // Ground <-> flight law blending.
      if (air) this.flightBlend = Math.min(1, this.flightBlend + dt / 5);
      else if (this.groundTime > 0.3) this.flightBlend = Math.max(0, this.flightBlend - dt / 1.2);
      const fb = direct ? 0 : this.flightBlend;

      // ---------- ground/direct pitch
      // Direct law on the ground: progressive stick shaping, full aft = 30° elevator.
      const sh = Math.sign(c.pitch) * Math.pow(Math.abs(c.pitch), 1.4);
      const eGround = sh >= 0 ? sh * P.elevUp : sh * P.elevDown;
      // ---------- flight pitch law
      let eFlight = eGround;
      const aStall = (A.CLmax + flapAero(this.slat, this.flap).dCLmax - (A.CL0 + flapAero(this.slat, this.flap).dCL0)) / A.CLa;
      this.aStall = aStall;
      this.aProt = aStall - 3.2 * D2R;
      this.aFloor = aStall - 2.2 * D2R;
      this.aMax = aStall - 1.2 * D2R;
      if (fb > 0) {
        const phi = this.roll, cphi = Math.max(0.35, Math.cos(phi)), g = G0;
        const cg = Math.cos(this.gamma);
        const phiC = clamp(phi, -33 * D2R, 33 * D2R);
        const pilotPitch = Math.abs(c.pitch) > 0.03;
        const nzMax = flapsOut ? 2.0 : 2.5, nzMin = flapsOut ? 0 : -1;
        // Load-factor demand
        let dnz;
        if (ap.engaged && ap.gammaDot != null && !pilotPitch) dnz = (ap.gammaDot * V) / g / cphi;
        else dnz = c.pitch >= 0 ? c.pitch * (nzMax - 1) : c.pitch * (1 - nzMin);
        let nzCmd = clamp(dnz + cg / Math.cos(phiC), nzMin, nzMax);
        let qCmd = (g / V) * (nzCmd - cg * Math.cos(phi));
        // Load-factor feedback (C*-like): the aircraft follows the nz demand, so after
        // releasing the stick the flight path stops curving instead of the attitude freezing.
        if (air && this.nz != null) qCmd += (1.1 * g / V) * clamp(nzCmd - this.nz, -1, 1);
        // Flight-path hold with neutral stick (auto-trim keeps the path as speed changes).
        const holding = !pilotPitch && !(ap.engaged && ap.gammaDot != null) && Math.abs(phi) <= 33 * D2R && !this.alphaProt;
        if (holding) {
          this.gammaHoldTimer += dt;
          if (this.gammaHoldTimer < 0.6) this.gammaT = this.gamma;
          else qCmd += (0.35 * (this.gammaT - this.gamma)) / cphi;
        } else { this.gammaHoldTimer = 0; this.gammaT = this.gamma; }

        // Flare law (manual landing): attitude memorised at 50 ft, eased 2° nose down from 30 ft.
        const raFt = this.ra / FT;
        if (!this.flareMode && air && c.gearDown && raFt < 50 && this.vs < 0 && this.flightBlend > 0.99 && flapsOut) {
          this.flareMode = true; this.thetaMem = this.pitch; this.flareT = 0;
        }
        if (this.flareMode && (raFt > 70 || c.throttle > 0.7)) this.flareMode = false;
        if (this.flareMode && !(ap.engaged && ap.gammaDot != null)) {
          if (raFt < 30) this.flareT += dt;
          const thRef = this.thetaMem - Math.min(2, (2 * this.flareT) / 8) * D2R;
          const thCmd = thRef + c.pitch * (c.pitch > 0 ? 9 : 6) * D2R;
          qCmd = 1.1 * (thCmd - this.pitch);
        }

        // Protections
        const thMax = (flapsOut && this.conf >= 5 ? 25 : 30) * D2R, thMin = -15 * D2R;
        qCmd = Math.min(qCmd, 0.5 * (thMax - this.pitch));
        qCmd = Math.max(qCmd, 0.5 * (thMin - this.pitch));
        if (!this.alphaProt && this.alpha > this.aProt && air && this.flightBlend > 0.9) { this.alphaProt = true; this.emit('alphaProt', {}); }
        if (this.alphaProt && (c.pitch < -0.4 || (this.alpha < this.aProt - 1.5 * D2R && c.pitch <= 0.05))) this.alphaProt = false;
        if (this.alphaProt) {
          const aCmd = this.aProt + Math.max(0, c.pitch) * (this.aMax - this.aProt);
          qCmd = Math.min(qCmd, 1.0 * (aCmd - this.alpha));
        }
        qCmd = Math.min(qCmd, 1.0 * (this.aMax - this.alpha) + 0.02);
        // High-speed protection (VMO+6 / MMO+0.01): nose-up bias.
        const over = Math.max(casKt - (P.vmo + 4), (this.mach - (P.mmo + 0.006)) * 600);
        this.highSpeedProt = over > 0;
        if (over > 0) qCmd = Math.max(qCmd, Math.min(0.05, over * 0.004));

        // Pitch-rate inner loop with auto-trim (THS integrator).
        const eff = Math.max(0.12, (this.qbar * P.S * P.c * A.Cmde) / this.inertia[1]);
        const Kq = clamp(2.4 / eff, 0.4, 14);
        const eq = qCmd - this.qr;
        const freeze = this.alphaProt || Math.abs(phi) > 33 * D2R || this.flareMode || !air;
        let total = Kq * eq + this.pitchI;
        const eCur = total - ratio * this.ths;
        const sat = (eCur > P.elevUp && eq > 0) || (eCur < -P.elevDown && eq < 0);
        if (!freeze && !sat) this.pitchI += Kq * 0.9 * eq * dt;
        this.pitchI = clamp(this.pitchI, ratio * P.thsMin - P.elevDown, ratio * P.thsMax + P.elevUp);
        total = Kq * eq + this.pitchI;
        const thsTarget = clamp(this.pitchI / ratio, P.thsMin, P.thsMax);
        if (!freeze) this.ths = approach(this.ths, thsTarget, 1.0 * D2R * dt);
        eFlight = total - ratio * this.ths;
        this.qCmd = qCmd;
      } else {
        this.pitchI = ratio * this.ths; // bumpless transfer at lift-off
        this.rollI = 0;
        this.gammaT = this.gamma; this.flareMode = false; this.alphaProt = false;
        // Pitch trim on ground: the THS keeps its take-off setting until lift-off, then auto-resets after landing.
        if (!air && this.gs < 40 && this.groundTime > 5) this.ths = approach(this.ths, 2.5 * D2R, 0.5 * D2R * dt);
      }
      const eCmd = lerp(eGround, eFlight, fb);
      this.elev = approach(this.elev, clamp(eCmd, -P.elevDown, P.elevUp), 45 * D2R * dt);

      // ---------- roll
      const aGround = c.roll * P.ailMax;
      let aFlight = aGround;
      if (fb > 0) {
        const phi = this.roll;
        const pilotRoll = Math.abs(c.roll) > 0.03;
        let pCmd;
        const lim = this.alphaProt || this.highSpeedProt ? 45 * D2R : 67 * D2R;
        if (ap.engaged && ap.pCmd != null && !pilotRoll) { pCmd = ap.pCmd; this.phiHold = phi; }
        else if (pilotRoll) {
          pCmd = c.roll * 15 * D2R;
          this.phiHold = phi;
          if (Math.abs(phi) > 33 * D2R) pCmd -= 0.44 * (Math.abs(phi) - 33 * D2R) * Math.sign(phi);
        } else {
          const hold = this.alphaProt || this.highSpeedProt ? 0 : clamp(this.phiHold, -33 * D2R, 33 * D2R);
          this.phiHold = hold;
          pCmd = clamp(0.9 * (hold - phi), -7 * D2R, 7 * D2R);
        }
        if (phi > lim) pCmd = Math.min(pCmd, 1.5 * (lim - phi));
        if (phi < -lim) pCmd = Math.max(pCmd, 1.5 * (-lim - phi));
        if (!air) pCmd = c.roll * 15 * D2R;
        const Vr = Math.max(V, 40);
        const effR = Math.max(0.05, (this.qbar * P.S * P.b * A.Clda) / this.inertia[0]);
        const dampR = (-this.qbar * P.S * P.b * A.Clp * (P.b / (2 * Vr))) / this.inertia[0];
        const ep = pCmd - this.p;
        if (air && Math.abs(this.ail) < P.ailMax * 0.95) this.rollI = clamp((this.rollI || 0) + (1.5 / effR) * ep * dt, -0.15, 0.15);
        aFlight = (pCmd * dampR) / effR + (3.2 / effR) * ep + (this.rollI || 0);
        this.pCmd = pCmd;
      }
      this.ail = approach(this.ail, clamp(lerp(aGround, aFlight, fb), -P.ailMax, P.ailMax), 55 * D2R * dt);

      // ---------- yaw: pedals + yaw damper / turn coordination
      const pedal = clamp(c.yaw + (ap.engaged ? ap.yaw || 0 : 0), -1, 1);
      const rudLimit = casKt < 160 ? P.rudMax : Math.max(4 * D2R, P.rudMax * Math.pow(160 / casKt, 2.4));
      let rCmd = pedal * rudLimit;
      if (fb > 0 && air) {
        const effY = Math.max(0.03, (this.qbar * P.S * P.b * A.Cndr) / this.inertia[2]);
        const rCoord = (G0 * Math.sin(this.roll) * Math.cos(this.pitch)) / V;
        const kyd = clamp(1.4 / effY, 0.3, 8);
        rCmd += fb * (kyd * (rCoord - this.r) + 1.2 * this.beta);
      }
      this.rud = approach(this.rud, clamp(rCmd, -rudLimit, rudLimit), 40 * D2R * dt);
      // Nose-wheel steering: tiller authority fades with speed, pedals give +/-6°.
      const gsKt = this.gs / KT;
      const tillerIn = c.tiller != null ? c.tiller : pedal;
      const tillerMax = P.steerMax * clamp(1 - (gsKt - 20) / 50, 0, 1);
      const steerCmd = clamp(tillerIn * Math.max(tillerMax, 6 * D2R), -P.steerMax, P.steerMax);
      this.steer = approach(this.steer, steerCmd, 30 * D2R * dt);
    }

    /* ----------------------------------------------------------- forces */
    forces() {
      const P = this.P, A = P.aero;
      const M = this.M, b = this.basis;
      const V = this.tas, Vd = Math.max(V, 20);
      const qS = this.qbar * P.S;
      const fa = flapAero(this.slat, this.flap);
      const alpha = this.alpha;

      // ---- lift with soft stall
      const CL0 = A.CL0 + fa.dCL0;
      const CLmax = A.CLmax + fa.dCLmax;
      const aStall = (CLmax - CL0) / A.CLa;
      const qhat = (this.qr * P.c) / (2 * Vd);
      let CLlin = CL0 + A.CLa * alpha;
      let CL;
      if (alpha <= aStall) {
        const knee = 0.86 * CLmax;
        CL = CLlin < knee ? CLlin : knee + (CLmax - knee) * Math.tanh((CLlin - knee) / (CLmax - knee));
      } else {
        const over = alpha - aStall;
        CL = Math.max(0.6 * CLmax + 0.3 * Math.sin(2 * alpha), CLmax - 2.2 * over);
      }
      if (alpha < -0.2) CL = Math.max(CL, -0.9);
      CL += A.CLq * qhat + A.CLde * (this.elev + (A.Cmih / A.Cmde) * this.ths) * 0.3;
      // Spoilers: speedbrakes and lift dumpers
      const sp = Math.max(this.spoilerSB * 0.55, this.groundSpoiler);
      CL -= sp * (0.18 + 0.55 * this.groundSpoiler) * Math.max(0, CL0 + A.CLa * Math.max(alpha, 0)) * 0.5;
      // Ground effect
      const hb = clamp(this.ra / P.b, 0.02, 2);
      const ge = hb < 1 ? 1 + 0.08 * (1 - hb) : 1;
      CL *= ge;
      const kge = hb < 1 ? (256 * hb * hb) / (1 + 256 * hb * hb) : 1;

      // ---- drag
      const Mach = this.mach;
      const wave = Mach > 0.77 ? 10 * (Mach - 0.77) ** 3 + (Mach > 0.86 ? 2.5 * (Mach - 0.86) ** 2 : 0) : 0;
      const stallDrag = alpha > aStall ? 0.9 * (alpha - aStall) : 0;
      const CD = A.CD0 + fa.dCD0 + A.CDgear * this.gearPos + A.k * kge * CL * CL + wave + stallDrag +
        this.spoilerSB * 0.028 + this.groundSpoiler * 0.07 + Math.abs(this.beta) * 0.25;

      // ---- side force
      const CY = A.CYb * this.beta + A.CYdr * this.rud;

      // ---- moments
      const phat = (this.p * P.b) / (2 * Vd), rhat = (this.r * P.b) / (2 * Vd);
      const adot = this.alphaDot || 0;
      let Cm = A.Cm0 + A.Cma * alpha + A.Cmq * qhat + A.Cmad * ((adot * P.c) / (2 * Vd)) +
        A.Cmde * this.elev + A.Cmih * this.ths + fa.dCm + this.gearPos * 0.004 - this.spoilerSB * 0.01;
      if (alpha > aStall) Cm -= 0.9 * (alpha - aStall); // stall pitch break
      const Cl = A.Clb * this.beta + A.Clp * phat + A.Clr * rhat + A.Clda * this.ail + A.Cldr * this.rud;
      const Cn = A.Cnb * this.beta + A.Cnr * rhat + A.Cnp * phat + A.Cnda * this.ail + A.Cndr * this.rud;
      this.CL = CL; this.CD = CD;

      // Aerodynamic force in body axes
      const F = [0, 0, 0], Mo = [0, 0, 0];
      if (V > 0.5) {
        const vh = scale(this.vb, 1 / V);
        const liftDir = norm(cross([0, 1, 0], vh));
        const Lf = qS * CL, Df = qS * CD, Yf = qS * CY;
        for (let i = 0; i < 3; i++) F[i] += -Df * vh[i] + Lf * liftDir[i];
        F[1] += Yf;
        Mo[0] += qS * P.b * Cl; Mo[1] += qS * P.c * Cm; Mo[2] += qS * P.b * Cn;
      }
      // Buffet near the stall / overspeed (small random pitch+roll moments)
      if (alpha > this.aProt + 0.03 || this.mach > P.mmo + 0.01) {
        Mo[0] += (Math.random() - 0.5) * qS * P.b * 0.004;
        Mo[1] += (Math.random() - 0.5) * qS * P.c * 0.01;
      }

      // ---- thrust
      for (let i = 0; i < 2; i++) {
        const T = this.engines[i].thrust;
        const r = P.engines[i];
        F[0] += T;
        Mo[1] += r[2] * T;   // M_y = z*Fx - x*Fz
        Mo[2] += -r[1] * T;  // M_z = x*Fy - y*Fx
      }

      // ---- landing gear & hard points
      let Fe = [0, 0, 0];
      const up = b.up;
      const gnd = this.ground;
      const wow = [false, false, false];
      let gearLoad = 0;
      const surface = this.env.surface(this.lat, this.lon);
      const muRoll = surface === 'grass' ? 0.06 : 0.015;
      const muBrakeMax = surface === 'grass' ? 0.25 : this.env.wet ? 0.28 : 0.45;
      for (let i = 0; i < 3; i++) {
        const g = P.gear[i];
        if (this.gearPos < 0.98) continue;
        const pw = mulMV(M, g.p);
        const h = this.alt + dot(pw, up) - gnd; // height of wheel bottom (sphere-local approximation)
        if (h >= 0) continue;
        let comp = -h;
        wow[i] = true;
        const vP = add(this.vel, mulMV(M, cross(this.omega, g.p)));
        const vUp = dot(vP, up);
        // Oleo: gas spring + orifice damping that builds up over the first few cm of stroke.
        let Fn = g.k * comp - g.c * vUp * Math.min(1, comp / 0.12);
        if (comp > g.stroke) Fn += g.k * 12 * (comp - g.stroke);
        Fn = Math.max(0, Fn);
        gearLoad += Fn;
        // Wheel heading
        let fwdB = [1, 0, 0];
        if (g.steer) fwdB = [Math.cos(this.steer), Math.sin(this.steer), 0];
        let fwd = mulMV(M, fwdB);
        fwd = norm(sub(fwd, scale(up, dot(fwd, up))));
        const side = cross(up, fwd); // left
        const vL = dot(vP, fwd), vS = dot(vP, side);
        let mu = muRoll;
        if (g.brake) mu += muBrakeMax * this.brakeCmd[i === 1 ? 0 : 1];
        const FL = -Fn * mu * smoothSign(vL, 0.25);
        const FS = -Fn * g.mu * Math.tanh(vS / Math.max(0.25, 0.12 * Math.abs(vL)));
        const Fg = add(add(scale(up, Fn), scale(fwd, FL)), scale(side, FS));
        Fe = add(Fe, Fg);
        const Fb = mulMtV(M, Fg);
        const mom = cross(g.p, Fb);
        Mo[0] += mom[0]; Mo[1] += mom[1]; Mo[2] += mom[2];
      }
      // Hard points: tail strike, pods, wingtips, belly
      for (const hp of P.contacts) {
        const pw = mulMV(M, hp.p);
        const h = this.alt + dot(pw, up) - gnd;
        if (h >= 0) continue;
        const comp = -h;
        const vP = add(this.vel, mulMV(M, cross(this.omega, hp.p)));
        let Fn = Math.max(0, 4e6 * comp - 8e5 * dot(vP, up));
        const vh = sub(vP, scale(up, dot(vP, up)));
        const vhl = len(vh);
        const Ff = vhl > 0.01 ? scale(vh, (-0.5 * Fn) / Math.max(vhl, 0.5)) : [0, 0, 0];
        const Fg = add(scale(up, Fn), Ff);
        Fe = add(Fe, Fg);
        const mom = cross(hp.p, mulMtV(M, Fg));
        Mo[0] += mom[0]; Mo[1] += mom[1]; Mo[2] += mom[2];
        if (hp.kind === 'tail') {
          if (!this.tailStrike) { this.tailStrike = true; this.emit('tailStrike', {}); }
          if (comp > 0.6) this.crash('Tail strike — aft fuselage destroyed');
        } else if (hp.kind === 'pod') this.crash('Engine pod strike');
        else if (hp.kind === 'wing') this.crash('Wingtip struck the ground');
        else if (this.gearPos < 0.98) this.crash(this.gearPos < 0.05 ? 'Gear-up landing' : 'Gear not locked down');
        else this.crash('Fuselage impact');
      }
      this.wow = wow;
      this.gearLoad = gearLoad;
      return { Fb: F, Fe, Mo };
    }

    /* ------------------------------------------------------------- events */
    emit(type, data) { this.events.push(Object.assign({ type, t: this.t }, data)); }
    crash(reason) {
      if (this.crashed) return;
      this.crashed = reason;
      this.emit('crash', { reason });
    }

    get inertia() {
      const k = this.mass / this.P.inertiaRef;
      return this.P.inertia.map((v) => v * (0.35 + 0.65 * k));
    }

    /* --------------------------------------------------------------- step */
    step(dt) {
      if (this.crashed) return;
      this.t += dt;
      this.derive(dt);
      this.systems(dt);
      this.fcc(dt);
      const { Fb, Fe, Mo } = this.forces();
      const m = this.mass;
      const M = this.M;
      const up = this.basis.up;
      // Specific force for load-factor measurement (non-gravitational)
      const Fnon = add(mulMV(M, Fb), Fe);
      const fsB = mulMtV(M, scale(Fnon, 1 / m));
      this.nz = -fsB[2] / G0;
      this.nx = fsB[0] / G0;
      // Longitudinal excess (thrust - drag) / weight along the flight path, for the autoflight.
      if (this.tas > 1) {
        const vhE = norm(this.vel);
        const aeroThrust = mulMV(M, Fb);
        this.excess = dot(aeroThrust, vhE) / (m * G0);
      } else this.excess = 0;

      // Translational
      const r = Geo.R + this.alt;
      const g = G0 * (Geo.R / r) ** 2;
      const acc = add(scale(Fnon, 1 / m), scale(up, -g));
      this.prevVel = this.vel.slice();
      this.vel = add(this.vel, scale(acc, dt));
      this.pos = add(this.pos, scale(this.vel, dt));

      // Rotational (principal axes)
      const I = this.inertia, w = this.omega;
      const Iw = [I[0] * w[0], I[1] * w[1], I[2] * w[2]];
      const gyro = cross(w, Iw);
      const wdot = [(Mo[0] - gyro[0]) / I[0], (Mo[1] - gyro[1]) / I[1], (Mo[2] - gyro[2]) / I[2]];
      this.omega = [w[0] + wdot[0] * dt, w[1] + wdot[1] * dt, w[2] + wdot[2] * dt];
      const o = this.omega;
      const ang = len(o) * dt;
      if (ang > 1e-12) {
        const ax = scale(o, 1 / len(o));
        const s = Math.sin(ang / 2);
        this.q = qNorm(qMul(this.q, [Math.cos(ang / 2), ax[0] * s, ax[1] * s, ax[2] * s]));
      }
      const aPrev = this.alpha;
      // Ground/air transitions and touchdown statistics
      const wowMain = this.wow[1] || this.wow[2];
      if (wowMain && !this.wowMain) {
        if (this.airTime > 3) {
          this.touchdown = {
            vs: this.lastAirVs / FT * 60, // fpm (negative = descending)
            ias: this.cas / KT, pitch: this.pitch * R2D, roll: this.roll * R2D,
            lat: this.lat, lon: this.lon, t: this.t, gMax: this.nz, crab: Geo.wrap180((this.heading - this.track) * R2D),
          };
          this.emit('touchdown', this.touchdown);
          const fpm = -this.touchdown.vs;
          if (fpm > 1500) this.crash(`Landing gear collapsed (${Math.round(fpm)} fpm touchdown)`);
          else if (Math.abs(this.roll) > 14 * D2R) this.crash('Wing struck the runway on touchdown');
        }
        this.airTime = 0;
      }
      if (!wowMain && this.wowMain && this.gs > 30) this.emit('liftoff', {});
      if (wowMain) { this.groundTime += dt; this.airTime = 0; } else { this.airTime += dt; this.groundTime = 0; this.lastAirVs = this.vs; }
      if (this.touchdown && this.t - this.touchdown.t < 1.0) this.touchdown.gMax = Math.max(this.touchdown.gMax, this.nz);
      this.wowMain = wowMain;
      this.onGround = wowMain || this.wow[0];
      this.derive(dt);
      this.alphaDot = (this.alpha - aPrev) / dt;
      // Terrain / water impact while airborne without gear contact
      if (!this.onGround && this.alt - this.ground < 1.5 && this.gearPos < 0.98) this.crash(this.gearPos < 0.05 ? 'Gear-up landing' : 'Gear not locked down');
      if (this.env.surface(this.lat, this.lon) === 'water' && this.onGround) this.crash('Ditched in the water');
      if (this.onGround && this.env.surface(this.lat, this.lon) !== 'runway' && this.gs > 60 * KT && this.airTime === 0 && this.groundTime > 0.2) {
        this.offRunway = (this.offRunway || 0) + dt;
        if (this.offRunway > 1.5) this.crash('Ran off the runway at high speed');
      } else this.offRunway = 0;
      if (this.cas / KT > this.P.vmo + 60 || this.mach > 0.97) this.crash('Airframe overstressed (overspeed)');
      if (this.nz > 3.8 || this.nz < -2) this.crash('Airframe overstressed (g-load)');
    }

    /** Advance by dt seconds using fixed sub-steps. */
    update(dt, maxStep = 1 / 120) {
      const n = Math.max(1, Math.ceil(dt / maxStep - 1e-9));
      const h = dt / n;
      for (let i = 0; i < n; i++) this.step(h);
    }

    /* ------------------------------------------------------------- trim */
    /** Put the aircraft in trimmed flight at the current position/heading. */
    trimFlight(o) {
      const P = this.P, A = P.aero;
      const c = this.controls;
      c.flapLever = o.flapLever ?? 0; c.gearDown = !!o.gearDown; c.spoilersArmed = !!o.spoilersArmed;
      this.conf = o.conf ?? (c.flapLever === 1 ? 1 : c.flapLever ? c.flapLever + 1 : 0);
      const cf = P.confs[this.conf];
      this.slat = cf.slat; this.flap = cf.flap; this.gearPos = c.gearDown ? 1 : 0;
      const atm = atmosphere(o.alt, this.env.isaDev);
      const tas = casToTas(o.ias * KT, atm);
      const gamma = (o.gamma || 0) * D2R;
      const m = this.mass, fa = flapAero(this.slat, this.flap);
      const qbar = 0.5 * atm.rho * tas * tas;
      const CLreq = (m * G0 * Math.cos(gamma)) / (qbar * P.S);
      const alpha = (CLreq - A.CL0 - fa.dCL0) / A.CLa;
      const Mach = tas / atm.a;
      const wave = Mach > 0.77 ? 10 * (Mach - 0.77) ** 3 : 0;
      const CD = A.CD0 + fa.dCD0 + A.CDgear * this.gearPos + A.k * CLreq * CLreq + wave;
      const Treq = qbar * P.S * CD + m * G0 * Math.sin(gamma);
      // Pitch trim: total elevator such that Cm = 0, carried by the THS.
      const Cm = A.Cm0 + A.Cma * alpha + fa.dCm + this.gearPos * 0.004;
      const ratio = A.Cmih / A.Cmde;
      this.ths = clamp(-Cm / A.Cmih, P.thsMin, P.thsMax);
      this.elev = (-Cm - A.Cmih * this.ths) / A.Cmde;
      this.pitchI = this.elev + ratio * this.ths;
      this.pos = Geo.llaToEcef(o.lat, o.lon, o.alt);
      this.setAttitude(o.lat, o.lon, o.heading, (alpha + gamma) * R2D, 0);
      const b = Geo.localBasis(o.lat, o.lon), h = o.heading * D2R;
      this.vel = add(add(scale(b.north, tas * Math.cos(h) * Math.cos(gamma)), scale(b.east, tas * Math.sin(h) * Math.cos(gamma))), scale(b.up, tas * Math.sin(gamma)));
      // Remove wind so the air-relative speed is as requested
      const w = this.env.wind(o.alt, o.lat, o.lon, this.t) || [0, 0, 0];
      this.vel = add(this.vel, add(add(scale(b.north, w[0]), scale(b.east, w[1])), scale(b.up, -w[2])));
      this.prevVel = this.vel.slice();
      this.omega = [0, 0, 0];
      this.flightBlend = 1; this.airTime = 60; this.groundTime = 0;
      this.wowMain = false; this.onGround = false; this.wow = [false, false, false];
      this.lastGround = this.env.groundHeight(o.lat, o.lon);
      this.derive(0);
      const idle = this.P.thrustStatic * 0.025 * Math.pow(atm.sigma, 0.9) * (1 - 1.1 * Mach);
      const toga = this.P.thrustStatic * Math.pow(atm.sigma, 0.9) * (1 - 0.55 * Mach + 0.35 * Mach * Mach);
      const n = clamp((Treq / 2 - idle) / (toga - idle), 0, 1);
      for (const e of this.engines) { e.n = n; e.thrust = Treq / 2; e.rev = 0; }
      // Manual thrust lever position that gives the trim thrust (0..CL range).
      const clb = 0.89 * toga;
      c.throttle = clamp((0.6 * (Treq / 2 - idle)) / Math.max(1, clb - idle), 0.01, 0.6);
      this.gammaT = gamma; this.phiHold = 0;
      return { alpha: alpha * R2D, thrust: Treq, n };
    }
  }

  const FDM = { Aircraft, A339, atmosphere, tasToCas, casToTas, vs1g, flapAero, G0, qToMat, mulMV, mulMtV, dot, cross, norm };
  if (typeof module !== 'undefined' && module.exports) module.exports = FDM;
  else root.FDM = FDM;
})(typeof window !== 'undefined' ? window : globalThis);
