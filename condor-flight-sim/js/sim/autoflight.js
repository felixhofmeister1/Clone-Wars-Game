/* =============================================================================
 * autoflight.js — Flight Management & Guidance (FMGC) for the A330:
 *   FCU (speed/heading/altitude/vertical speed knobs, AP1/AP2, A/THR, LOC,
 *   APPR, FD), flight phases, managed speeds (V1/VR/V2, green dot, S, F,
 *   VAPP, 250 kt below FL100, ECON Mach), flight-director guidance and the
 *   autopilot / autothrust modes shown on the Flight Mode Annunciator:
 *
 *   A/THR: MAN TOGA · MAN FLX · THR CLB · THR IDLE · SPEED · MACH · A.FLOOR · TOGA LK · LVR CLB
 *   Vert : SRS · CLB · OP CLB · ALT* · ALT · ALT CRZ · DES · OP DES · V/S · G/S* · G/S · LAND · FLARE · ROLL OUT
 *   Lat  : RWY · RWY TRK · NAV · HDG · LOC* · LOC · GA TRK
 *
 * Also the flight warning computer (FWC) callouts: radio-altitude callouts,
 * RETARD, MINIMUM, GPWS modes, stall, overspeed, take-off config warnings.
 * ========================================================================== */
(function (root) {
  'use strict';
  const Geo = root.Geo || (typeof require !== 'undefined' ? require('./geo.js') : null);
  const FDM = root.FDM || (typeof require !== 'undefined' ? require('./fdm.js') : null);
  const FP = root.FlightPlan || (typeof require !== 'undefined' ? require('./flightplan.js') : null);
  const { D2R, R2D, KT, FT, NM, clamp, wrap180, wrap360 } = Geo;
  const G = 9.80665;
  const lerp = (a, b, t) => a + (b - a) * t;

  class FMGC {
    constructor(ac, plan) {
      this.ac = ac;
      this.events = [];
      this.fcu = {
        spd: 160, mach: 0.82, spdManaged: true, spdIsMach: false,
        hdg: 0, hdgManaged: true, alt: 5000, vs: 0, vsActive: false,
        ap1: false, ap2: false, athr: false, fd: true, loc: false, appr: false,
        baroStd: false, qnh: 1013,
      };
      this.setPlan(plan);
    }

    setPlan(plan) {
      this.plan = plan;
      this.active = 1;
      this.phase = 'preflight';
      this.vert = ''; this.lat = ''; this.vertArmed = []; this.latArmed = [];
      this.athrMode = ''; this.athrArmed = false; this.athrActive = false;
      this.togaLk = false; this.lvrClb = false; this.flexTo = false;
      this.exF = 0; this.athrI = 0.5; this.casF = 0; this.accF = 0;
      this.trkHold = null; this.retard = false; this.minimums = null;
      this.callouts = new Set(); this.lastRaFt = 99999;
      this.messages = []; this.tod = false; this.todAnnounced = false;
      this.decel = false;
      if (plan) {
        this.fcu.hdg = Math.round(plan.depRwy.magHdg);
        this.fcu.alt = plan.cruiseFt;
        this.depElevFt = plan.depRwy.elev / FT;
        this.arrElevFt = plan.arrRwy.elev / FT;
        this.minimums = Math.round(this.arrElevFt + 200);
        this.accAltFt = this.depElevFt + 1500;
        this.thrRedAltFt = this.depElevFt + 1500;
      }
      this.computeTakeoffSpeeds();
    }

    emit(type, data = {}) { this.events.push(Object.assign({ type }, data)); }

    /* ------------------------------------------------------------ speeds */
    computeTakeoffSpeeds() {
      const m = this.ac.mass;
      const conf = this.ac.conf || 2;
      const vs = FDM.vs1g(Math.max(conf, 1), m) / KT;
      const v2 = Math.max(Math.round(vs * 1.13), 125);
      this.perf = { v2, vr: v2 - 4, v1: v2 - 8, flex: this.ac.flexTemp, toConf: this.ac.P.confs[conf].name };
      this.updateApproachSpeeds();
    }
    updateApproachSpeeds() {
      const m = this.ac.mass;
      const vlsFull = 1.23 * FDM.vs1g(5, m) / KT;
      const windCorr = this.headwindArr ? clamp(this.headwindArr / 3, 5, 15) : 5;
      this.perf.vapp = Math.round(vlsFull + windCorr);
      this.perf.vls = vlsFull;
    }
    /** Characteristic speeds (CAS kt) for the current weight. */
    charSpeeds() {
      const ac = this.ac, m = ac.mass;
      const vs = (i) => FDM.vs1g(i, m) / KT;
      const conf = ac.conf;
      const vlsFactor = ac.wowMain || ac.airTime < 20 ? 1.13 : 1.23;
      const vls = vlsFactor * vs(conf) * (conf === 0 ? 1.04 : 1);
      return {
        vls,
        gd: Math.round(1.28 * vs(0) + 18),        // green dot (best L/D, clean)
        s: Math.round(1.25 * vs(1)),              // min slats retraction
        f: Math.round(1.26 * vs(3)),              // min flaps retraction
        vfe: ac.P.confs[conf].vfe,
        vfeNext: conf < 5 ? ac.P.confs[Math.min(5, conf === 1 ? 3 : conf + 1)].vfe : null,
        vaprot: this.vFromAlpha(ac.aProt), vamax: this.vFromAlpha(ac.aMax),
        vmax: Math.min(ac.P.vmo, conf ? ac.P.confs[conf].vfe : 999, ac.gearPos > 0.02 ? ac.P.vle : 999, this.machToCas(ac.P.mmo)),
      };
    }
    vFromAlpha(alpha) {
      const ac = this.ac, A = ac.P.aero;
      const fa = FDM.flapAero(ac.slat, ac.flap);
      const CL = Math.min(A.CL0 + fa.dCL0 + A.CLa * alpha, A.CLmax + fa.dCLmax);
      return Math.sqrt((2 * ac.mass * G) / (1.225 * ac.P.S * Math.max(0.3, CL))) / KT;
    }
    machToCas(M) {
      const atm = this.ac.atm;
      return FDM.tasToCas(M * atm.a, atm) / KT;
    }
    casToMach(cas) { const atm = this.ac.atm; return FDM.casToTas(cas * KT, atm) / atm.a; }

    /** Managed speed target (CAS kt) and whether it is Mach-referenced. */
    managedSpeed() {
      const ac = this.ac, cs = this.charSpeeds();
      const altFt = ac.alt / FT;
      let v, mach = null;
      switch (this.phase) {
        case 'preflight': case 'takeoff': v = this.perf.v2 + 10; break;
        case 'climb':
          if (altFt < this.depElevFt + 10000 && altFt < 10000 + this.depElevFt) v = 250;
          else { v = 300; mach = 0.80; }
          if (ac.conf >= 2) v = Math.min(v, cs.vfe - 5, Math.max(cs.f + 10, 200));
          else if (ac.conf === 1) v = Math.min(v, cs.vfe - 5);
          break;
        case 'cruise': v = 300; mach = 0.82; break;
        case 'descent': v = altFt < this.arrElevFt + 10500 ? 250 : 300; mach = 0.80; break;
        case 'approach': case 'goaround': case 'done': {
          const c = ac.conf;
          v = c === 0 ? cs.gd : c === 1 ? cs.s : c <= 4 ? (c === 4 && this.landConf3 ? this.perf.vapp : cs.f) : this.perf.vapp;
          if (this.phase === 'goaround') v = Math.max(v, this.perf.vapp);
          break;
        }
        default: v = 250;
      }
      if (mach) {
        const vm = this.machToCas(mach);
        if (vm < v) { v = vm; this.spdMachRef = mach; } else this.spdMachRef = null;
      } else this.spdMachRef = null;
      v = Math.min(v, cs.vmax - 5);
      if (!ac.wowMain) v = Math.max(v, cs.vls + (this.phase === 'approach' ? 0 : 5));
      return v;
    }

    targetSpeed() {
      if (this.fcu.spdManaged) return this.managedSpeed();
      this.spdMachRef = this.fcu.spdIsMach ? this.fcu.mach : null;
      return this.fcu.spdIsMach ? this.machToCas(this.fcu.mach) : this.fcu.spd;
    }

    /* ------------------------------------------------------ FCU actions */
    fcuAction(what, value) {
      const f = this.fcu, ac = this.ac;
      switch (what) {
        case 'spdTurn':
          if (f.spdManaged) { f.spdManaged = false; this.syncSelectedSpeed(); }
          if (f.spdIsMach) f.mach = clamp(Math.round((f.mach + value * 0.01) * 100) / 100, 0.10, 0.86);
          else f.spd = clamp(Math.round(f.spd + value), 100, 340);
          break;
        case 'spdPush': f.spdManaged = true; break;
        case 'spdPull': if (f.spdManaged) { f.spdManaged = false; this.syncSelectedSpeed(); } break;
        case 'spdMach':
          f.spdIsMach = !f.spdIsMach;
          if (f.spdIsMach) f.mach = Math.round(this.casToMach(f.spd) * 100) / 100; else f.spd = Math.round(this.machToCas(f.mach));
          break;
        case 'hdgTurn': f.hdg = wrap360(Math.round(f.hdg + value)); if (this.lat === 'HDG') f.hdgManaged = false; break;
        case 'hdgPull':
          f.hdgManaged = false;
          if (!ac.wowMain) { this.setLat('HDG'); this.latArmed = this.latArmed.filter((m) => m !== 'NAV'); }
          break;
        case 'hdgPush':
          f.hdgManaged = true;
          if (this.plan) { if (ac.wowMain) this.armLat('NAV'); else this.setLat('NAV'); }
          break;
        case 'altTurn': f.alt = clamp(Math.round((f.alt + value) / 100) * 100, 100, 43000); break;
        case 'altPush': this.engageVertical(true); break;
        case 'altPull': this.engageVertical(false); break;
        case 'vsTurn':
          if (!f.vsActive) { f.vs = Math.round(ac.vs / FT * 60 / 100) * 100; }
          f.vs = clamp(f.vs + value, -6000, 6000); f.vsActive = true;
          if (!ac.wowMain) this.setVert('V/S');
          break;
        case 'vsPush': f.vs = 0; f.vsActive = true; if (!ac.wowMain) this.setVert('V/S'); break;
        case 'vsPull': f.vs = Math.round(ac.vs / FT * 60 / 100) * 100; f.vsActive = true; if (!ac.wowMain) this.setVert('V/S'); break;
        case 'ap1': case 'ap2': this.toggleAp(what); break;
        case 'apOff': if (f.ap1 || f.ap2) this.disconnectAp('button'); break;
        case 'athr': this.toggleAthr(); break;
        case 'athrOff': if (this.athrArmed || this.athrActive) this.disconnectAthr('button'); break;
        case 'fd': f.fd = !f.fd; break;
        case 'loc': this.toggleLoc(); break;
        case 'appr': this.toggleAppr(); break;
        case 'std': f.baroStd = !f.baroStd; break;
        case 'altStep': f.alt = clamp(f.alt + value, 100, 43000); break;
      }
    }
    syncSelectedSpeed() {
      const v = this.lastTarget || this.ac.cas / KT;
      if (this.spdMachRef) { this.fcu.spdIsMach = true; this.fcu.mach = Math.round(this.spdMachRef * 100) / 100; }
      else { this.fcu.spdIsMach = false; this.fcu.spd = Math.round(v); }
    }
    engageVertical(managed) {
      const ac = this.ac, f = this.fcu;
      if (ac.wowMain) return;
      const altFt = ac.alt / FT;
      const diff = f.alt - altFt;
      f.vsActive = false;
      if (Math.abs(diff) < 60) { this.setVert('ALT'); return; }
      if (diff > 0) this.setVert(managed && this.plan ? 'CLB' : 'OP CLB');
      else {
        this.setVert(managed && this.plan ? 'DES' : 'OP DES');
        if (this.phase === 'cruise' || this.phase === 'climb') this.setPhase('descent');
      }
    }
    toggleAp(which) {
      const f = this.fcu, ac = this.ac;
      if (f[which]) { this.disconnectAp('button'); return; }
      if (ac.wowMain || ac.ra / FT < 100 || ac.airTime < 5) { this.emit('message', { text: 'AP ENGAGE INHIBITED ON GROUND / BELOW 100 FT', level: 'caution' }); return; }
      f[which] = true;
      if (!this.lat) this.setLat('HDG'), (f.hdg = Math.round(wrap360(ac.heading * R2D - Geo.magvar(ac.lat, ac.lon))));
      if (!this.vert) { f.vs = Math.round(ac.vs / FT * 60 / 100) * 100; this.setVert('V/S'); }
      this.emit('apEngage', { which });
    }
    disconnectAp(reason) {
      const f = this.fcu;
      if (!(f.ap1 || f.ap2)) return;
      f.ap1 = f.ap2 = false;
      this.emit('apDisconnect', { reason });
    }
    toggleAthr() {
      if (this.athrArmed || this.athrActive) { this.disconnectAthr('button'); return; }
      this.athrArmed = true;
      this.fcu.athr = true;
    }
    disconnectAthr(reason) {
      if (!this.athrArmed && !this.athrActive && !this.togaLk) return;
      const wasActive = this.athrActive;
      this.athrArmed = false; this.athrActive = false; this.fcu.athr = false; this.togaLk = false;
      this.ac.athr.alphaFloor = false;
      this.emit('athrDisconnect', { reason, wasActive });
    }
    toggleLoc() {
      if (this.latArmed.includes('LOC') || this.lat.startsWith('LOC')) {
        this.latArmed = this.latArmed.filter((m) => m !== 'LOC');
        if (this.lat.startsWith('LOC')) this.setLat('HDG'), (this.fcu.hdg = Math.round(this.magHeading()));
        this.fcu.loc = false;
      } else { this.armLat('LOC'); this.fcu.loc = true; }
    }
    toggleAppr() {
      if (this.fcu.appr) {
        this.fcu.appr = false;
        this.latArmed = this.latArmed.filter((m) => m !== 'LOC');
        this.vertArmed = this.vertArmed.filter((m) => m !== 'G/S');
        if (this.vert.startsWith('G/S')) { this.fcu.vs = 0; this.setVert('V/S'); }
        if (this.lat.startsWith('LOC')) { this.setLat('HDG'); this.fcu.hdg = Math.round(this.magHeading()); }
      } else {
        this.fcu.appr = true;
        if (!this.lat.startsWith('LOC')) this.armLat('LOC');
        if (!this.vert.startsWith('G/S')) this.armVert('G/S');
        if (this.phase === 'descent' || this.phase === 'cruise') this.setPhase('approach');
      }
    }
    magHeading() { return wrap360(this.ac.heading * R2D - Geo.magvar(this.ac.lat, this.ac.lon)); }

    setLat(m) { if (this.lat !== m) { this.lat = m; this.emit('mode', { lat: m }); } this.latArmed = this.latArmed.filter((x) => x !== m && !(m === 'LOC' && x === 'LOC')); }
    setVert(m) { if (this.vert !== m) { this.vert = m; this.emit('mode', { vert: m }); } this.vertArmed = this.vertArmed.filter((x) => x !== m); }
    armLat(m) { if (!this.latArmed.includes(m)) this.latArmed.push(m); }
    armVert(m) { if (!this.vertArmed.includes(m)) this.vertArmed.push(m); }
    setPhase(p) { if (this.phase !== p) { this.phase = p; this.emit('phase', { phase: p }); } }

    /* ------------------------------------------------------- guidance */
    /** Flight-path angle that makes the speed converge to `vt` CAS (speed on elevator). */
    speedOnElevator(vt) {
      const ac = this.ac;
      const tasT = FDM.casToTas(vt * KT, ac.atm);
      const err = tasT - ac.tas;
      const aT = clamp(0.1 * err - 0.3 * this.accF, -0.6, 0.6);
      const sinG = clamp(this.exF - aT / G, -0.3, 0.33);
      return Math.asin(sinG);
    }
    vsToGamma(vsMs) { return Math.asin(clamp(vsMs / Math.max(this.ac.tas, 30), -0.5, 0.5)); }

    ilsDeviation() {
      if (!this.plan) return null;
      const ac = this.ac, rw = this.plan.arrRwy, ils = rw.ils;
      const dLoc = Geo.distance(ac.lat, ac.lon, ils.loc.lat, ils.loc.lon);
      const ti = Geo.trackInfo(ac.lat, ac.lon, rw.thr.lat, rw.thr.lon, rw.far.lat, rw.far.lon);
      const locDev = Math.atan2(ti.xtk, dLoc) * R2D; // + = aircraft right of centreline
      const gpi = Geo.trackInfo(ac.lat, ac.lon, rw.thr.lat, rw.thr.lon, rw.far.lat, rw.far.lon);
      const dGpi = 300 - gpi.atk;                    // distance to GPI along the course (m)
      const hAnt = ac.alt - 3 - rw.elev;             // G/S antenna ~3 m below the CG
      const gsDev = dGpi > 1 ? Math.atan2(hAnt, dGpi) * R2D - ils.angle : 5; // + = above
      const inRange = dLoc < 30 * NM && Math.abs(locDev) < 35 && gpi.atk < rw.length;
      const facing = Math.abs(wrap180(ac.heading * R2D - rw.hdg)) < 90;
      return {
        locDev, gsDev, locDots: clamp(-locDev / 1.0, -2.5, 2.5), gsDots: clamp(-gsDev / 0.35, -2.5, 2.5),
        xtk: ti.xtk, dThr: -gpi.atk, dGpi, hAboveGs: hAnt - dGpi * Math.tan(ils.angle * D2R),
        inRange, locValid: inRange && facing && Math.abs(locDev) < 10, gsValid: inRange && facing && dGpi > 250 && Math.abs(gsDev) < 1.5 && Math.abs(locDev) < 8,
        dme: dLoc / NM, ident: ils.ident, freq: ils.freq, course: ils.course,
      };
    }

    /* =============================================================== update */
    update(dt) {
      const ac = this.ac, f = this.fcu, c = ac.controls;
      if (ac.crashed) return;
      const altFt = ac.alt / FT, raFt = ac.ra / FT, casKt = ac.cas / KT;
      // Filters
      this.exF = lerp(this.exF, ac.excess || 0, clamp(dt * 1.5, 0, 1));
      const acc = (ac.tas - (this.prevTas ?? ac.tas)) / Math.max(dt, 1e-4);
      this.prevTas = ac.tas;
      this.accF = lerp(this.accF, acc, clamp(dt * 2, 0, 1));
      const casAcc = (casKt - (this.prevCas ?? casKt)) / Math.max(dt, 1e-4);
      this.prevCas = casKt;
      this.casAccF = lerp(this.casAccF || 0, casAcc, clamp(dt * 2, 0, 1));

      // FDM-side AP disconnect requests (sidestick override)
      for (const e of ac.events) if (e.type === 'apDisconnect' && !e.handled) { e.handled = true; this.disconnectAp('sidestick'); }

      this.apprTimer = (this.apprTimer || 0) + dt;
      if (this.apprTimer > 2 && !ac.wowMain) { this.apprTimer = 0; this.updateApproachSpeeds(); }
      const ils = this.ilsDeviation();
      this.ils = ils;
      const plan = this.plan;
      let prog = null;
      if (plan) {
        this.sequence();
        prog = FP.progress(plan, ac.lat, ac.lon, this.active);
      }
      this.prog = prog;

      /* ---------------- phase logic */
      const lever = c.throttle;
      const toThrust = lever >= 0.78;
      if (ac.wowMain && (this.phase === 'preflight' || this.phase === 'done') && toThrust && casKt < 80) {
        this.setPhase('takeoff');
        this.flexTo = lever < 0.95;
        if (f.fd) { this.setVert('SRS'); this.setLat('RWY'); if (plan) { this.armLat('NAV'); } this.vertArmed = ['CLB']; }
        this.athrArmed = true; f.athr = true;
        this.computeTakeoffSpeeds();
        this.emit('takeoffPower', { flex: this.flexTo });
      }
      if (this.phase === 'takeoff' && ac.wowMain && lever < 0.05 && casKt > 40) {
        this.emit('rejectedTakeoff', {}); this.setPhase('done');
      }
      if (this.phase === 'takeoff' && !ac.wowMain && altFt > this.accAltFt) {
        this.setPhase('climb');
        if (this.vert === 'SRS') { if (plan && f.alt > altFt + 100) this.setVert('CLB'); else this.setVert(f.alt > altFt ? 'OP CLB' : 'ALT'); }
      }
      if (this.phase === 'climb' && Math.abs(altFt - f.alt) < 100 && f.alt >= (plan ? plan.cruiseFt - 50 : 99999)) this.setPhase('cruise');
      if (this.phase === 'climb' && this.vert === 'ALT' && plan && f.alt >= plan.cruiseFt - 50) this.setPhase('cruise');
      if ((this.phase === 'cruise' || this.phase === 'climb') && (this.vert === 'DES' || this.vert === 'OP DES' || (this.vert === 'V/S' && f.vs < -500 && f.alt < altFt - 2000))) this.setPhase('descent');
      if (plan && prog && (this.phase === 'descent' || this.phase === 'cruise') && prog.flown > plan.decelDist && altFt < plan.cruiseFt - 2000) { this.setPhase('approach'); this.emit('message', { text: 'DECELERATE — approach phase active', level: 'info' }); }
      if ((this.phase === 'descent' || this.phase === 'cruise') && ac.controls.flapLever > 0) this.setPhase('approach');
      if (plan && prog && !this.todAnnounced && this.phase === 'cruise' && prog.flown > plan.todDist) { this.todAnnounced = true; this.emit('tod', {}); }
      // Go-around: TOGA in flight with flaps extended
      if (!ac.wowMain && toThrust && lever > 0.95 && (this.phase === 'approach' || this.phase === 'descent') && ac.controls.flapLever > 0 && raFt < 3000) {
        this.setPhase('goaround');
        this.setVert('SRS'); this.setLat('GA TRK'); this.trkHold = ac.track * R2D;
        this.vertArmed = ['CLB']; this.latArmed = plan ? ['NAV'] : [];
        f.appr = false; f.loc = false;
        if (f.alt < altFt + 500) f.alt = Math.round((this.arrElevFt + 3000) / 100) * 100;
        if (plan) { FP.missedApproach(plan, ac.lat, ac.lon); this.active = 1; }
        this.athrArmed = true; f.athr = true;
        this.retard = false;
        this.emit('goAround', {});
      }
      if (this.phase === 'goaround' && altFt > this.arrElevFt + 1500 && this.vert === 'SRS') { this.setVert(f.alt > altFt + 100 ? 'OP CLB' : 'ALT'); }
      if (this.phase === 'goaround' && this.vert.startsWith('ALT')) this.setPhase('approach');
      if (ac.wowMain && ac.airTime === 0 && this.phase === 'approach' && ac.groundTime > 2) this.setPhase('done');
      if (ac.wowMain && this.phase !== 'preflight' && this.phase !== 'takeoff' && this.phase !== 'done' && ac.groundTime > 1) this.setPhase('done');

      /* ---------------- lateral modes */
      if (!ac.wowMain) {
        if (this.lat === 'RWY' && raFt > 30) {
          if (this.latArmed.includes('NAV')) this.setLat('NAV');
          else { this.setLat('RWY TRK'); this.trkHold = ac.track * R2D; }
        }
        if (this.latArmed.includes('NAV') && (this.lat === 'RWY TRK' || this.lat === 'GA TRK') && raFt > 30 && plan) this.setLat('NAV');
        if (this.latArmed.includes('LOC') && ils && ils.locValid && Math.abs(ils.locDots) < 1.8) {
          const closing = Math.abs(wrap180(ac.track * R2D - plan.arrRwy.hdg)) < 110;
          if (closing) this.setLat('LOC*');
        }
        if (this.lat === 'LOC*' && ils && Math.abs(ils.locDots) < 0.15 && Math.abs(wrap180(ac.track * R2D - plan.arrRwy.hdg)) < 8) this.setLat('LOC');
        if (this.lat.startsWith('LOC') && ils && !ils.locValid && raFt > 400) { this.setLat('HDG'); f.hdg = Math.round(this.magHeading()); this.emit('message', { text: 'LOC LOST', level: 'caution' }); }
      }
      /* ---------------- vertical modes */
      if (!ac.wowMain) {
        const altErr = f.alt - altFt;
        const vsFpm = ac.vs / FT * 60;
        const capturing = ['CLB', 'OP CLB', 'DES', 'OP DES', 'V/S'].includes(this.vert);
        if (capturing) {
          const toward = (this.vert.includes('CLB') && altErr > -50) || (this.vert.includes('DES') && altErr < 50) || (this.vert === 'V/S' && Math.sign(altErr) === Math.sign(f.vs || -1));
          if (toward && Math.abs(altErr) < Math.max(100, Math.abs(vsFpm) * 0.2)) this.setVert('ALT*');
          if (this.vert === 'V/S' && f.vs === 0) { /* hold */ }
        }
        if (this.vert === 'ALT*' && Math.abs(altErr) < 20 && Math.abs(vsFpm) < 150) this.setVert(plan && Math.abs(f.alt - plan.cruiseFt) < 60 && this.phase !== 'descent' && this.phase !== 'approach' ? 'ALT CRZ' : 'ALT');
        if ((this.vert === 'ALT' || this.vert === 'ALT CRZ') && Math.abs(altErr) > 250 && this.vert !== 'G/S') { /* new FCU altitude: stays in ALT until the knob is pushed/pulled */ }
        if (this.vertArmed.includes('G/S') && ils && ils.gsValid && this.lat.startsWith('LOC') && ils.gsDots > -1.2 && ils.gsDots < 0.35) this.setVert('G/S*');
        if (this.vert === 'G/S*' && ils && Math.abs(ils.gsDots) < 0.2) this.setVert('G/S');
        if ((this.vert === 'G/S*' || this.vert === 'G/S') && (!ils || (!ils.gsValid && raFt > 150))) {
          f.vs = 0; f.vsActive = true; this.setVert('V/S'); this.emit('message', { text: 'G/S LOST', level: 'caution' });
        }
        // Autoland
        const apOn = f.ap1 || f.ap2;
        if (apOn && this.vert === 'G/S' && this.lat === 'LOC' && raFt < 400) { this.setVert('LAND'); this.setLat('LAND'); }
        if (this.vert === 'LAND' && raFt < 50) { this.setVert('FLARE'); this.setLat('FLARE'); }
        if ((this.vert === 'LAND' || this.vert === 'FLARE') && !apOn) { this.setVert('G/S'); this.setLat('LOC'); }
      } else if (this.vert === 'FLARE' || this.vert === 'LAND') {
        this.setVert('ROLL OUT'); this.setLat('ROLL OUT');
      }
      if (this.vert === 'ROLL OUT' && ac.gs < 15 * KT) { this.disconnectAp('rollout complete'); }

      /* ---------------- guidance computation */
      let gammaCmd = null, phiCmd = null, yawCmd = 0;
      const tgt = this.targetSpeed();
      this.lastTarget = tgt;
      const V = Math.max(ac.tas, 40);
      const vsNow = ac.vs;
      switch (this.vert) {
        case 'SRS': {
          const vt = this.phase === 'goaround' ? Math.max(this.perf.vapp, Math.min(casKt, this.perf.vapp + 25)) : Math.max(this.perf.v2 + 10, Math.min(casKt, this.perf.v2 + 15));
          let g = this.speedOnElevator(vt);
          if (ac.wowMain) g = 12 * D2R;
          const th = clamp(g + ac.alpha, 0, 18 * D2R);
          gammaCmd = Math.max(th - ac.alpha, this.vsToGamma(120 * FT / 60));
          break;
        }
        case 'CLB': case 'OP CLB':
          gammaCmd = Math.max(this.speedOnElevator(tgt), this.vsToGamma(300 * FT / 60));
          break;
        case 'OP DES':
          gammaCmd = Math.min(this.speedOnElevator(tgt), this.vsToGamma(-800 * FT / 60));
          break;
        case 'DES': {
          const pAlt = plan && prog ? FP.profileAlt(plan, prog.flown) : f.alt;
          this.profileErrFt = altFt - pAlt;
          let vsCmd = -ac.gs * Math.tan(3 * D2R) - (this.profileErrFt * FT) / 30;
          vsCmd = clamp(vsCmd, -4000 * FT / 60, -300 * FT / 60);
          if (this.profileErrFt < -300) vsCmd = Math.max(vsCmd, -1000 * FT / 60); // below path: shallow
          gammaCmd = Math.max(this.vsToGamma(vsCmd), this.speedOnElevator(tgt + 10));
          this.moreDrag = this.profileErrFt > 400 && this.athrMode !== 'SPEED' && ac.spoilerSB < 0.3;
          break;
        }
        case 'ALT*': {
          const altErr = (f.alt - altFt) * FT;
          const vsCmd = clamp(altErr / 10, -Math.max(Math.abs(vsNow), 2), Math.max(Math.abs(vsNow), 2));
          gammaCmd = this.vsToGamma(vsCmd);
          break;
        }
        case 'ALT': case 'ALT CRZ': {
          const altErr = (f.alt - altFt) * FT;
          gammaCmd = this.vsToGamma(clamp(altErr * 0.12, -5, 5));
          break;
        }
        case 'V/S':
          gammaCmd = this.vsToGamma(f.vs * FT / 60);
          break;
        case 'G/S*': case 'G/S': case 'LAND': {
          if (ils) {
            let vsCmd = -ac.gs * Math.tan(3 * D2R) - ils.hAboveGs / (this.vert === 'G/S*' ? 10 : 7);
            // Never climb to meet the beam: below it, hold level and let it come down to us.
            vsCmd = clamp(vsCmd, -2000 * FT / 60, this.vert === 'G/S*' ? 0 : 300 * FT / 60);
            gammaCmd = this.vsToGamma(vsCmd);
          }
          break;
        }
        case 'FLARE': {
          const vsCmd = -(0.4 + ac.ra * 0.2);
          gammaCmd = this.vsToGamma(Math.max(vsCmd, -ac.gs * Math.tan(3.2 * D2R)));
          break;
        }
        default: break;
      }

      const trk = ac.track * R2D, hdgT = ac.heading * R2D;
      const bankLimit = V > 150 ? 25 : 25;
      switch (this.lat) {
        case 'RWY': case 'ROLL OUT':
          if (ils) {
            const corr = clamp(-ils.xtk * 0.04, -1, 1);
            yawCmd = clamp(corr * 0.6 - wrap180(hdgT - plan.arrRwy.hdg) * 0.05, -0.6, 0.6);
          }
          phiCmd = 0;
          if (this.lat === 'RWY' && plan) {
            const rw = plan.depRwy;
            const ti = Geo.trackInfo(ac.lat, ac.lon, rw.lat, rw.lon, rw.far.lat, rw.far.lon);
            this.rwyDev = ti.xtk;
            yawCmd = 0;
          }
          break;
        case 'RWY TRK': case 'GA TRK':
          phiCmd = clamp(2.0 * wrap180((this.trkHold ?? trk) - trk), -bankLimit, bankLimit);
          break;
        case 'HDG': {
          const mh = this.magHeading();
          phiCmd = clamp(2.0 * wrap180(f.hdg - mh), -bankLimit, bankLimit);
          break;
        }
        case 'NAV':
          if (prog) {
            const trkCmd = prog.course - clamp(Math.atan2(prog.xtk, Math.max(2500, ac.gs * 40)) * R2D, -45, 45);
            phiCmd = clamp(2.2 * wrap180(trkCmd - trk), -bankLimit, bankLimit);
          }
          break;
        case 'LOC*': case 'LOC': case 'LAND': case 'FLARE': {
          if (ils) {
            const crs = plan.arrRwy.hdg;
            const trkCmd = crs - clamp(Math.atan2(ils.xtk, Math.max(1200, ac.gs * 22)) * R2D, -35, 35);
            phiCmd = clamp(2.5 * wrap180(trkCmd - trk), -bankLimit, bankLimit);
            if (this.lat === 'FLARE') { phiCmd = clamp(phiCmd, -3, 3); yawCmd = clamp(-wrap180(hdgT - crs) * 0.08, -0.4, 0.4); }
          }
          break;
        }
        default: break;
      }

      /* ---------------- FD & AP outputs */
      this.fdPitch = gammaCmd != null ? clamp((gammaCmd - ac.gamma) * R2D * 1.5, -12, 12) : null;
      this.fdRoll = phiCmd != null ? clamp(phiCmd - ac.roll * R2D, -30, 30) : null;
      if (ac.wowMain && this.vert === 'SRS') this.fdPitch = null;
      const apOn = f.ap1 || f.ap2;
      ac.ap.engaged = apOn;
      if (apOn) {
        if (gammaCmd != null) {
          const maxGd = ((this.vert === 'FLARE' ? 0.3 : 0.12) * G) / V;
          const k = this.vert === 'FLARE' ? 1.2 : this.vert.startsWith('ALT') ? 0.8 : 0.6;
          ac.ap.gammaDot = clamp(k * (gammaCmd - ac.gamma), -maxGd, maxGd);
        } else ac.ap.gammaDot = 0;
        if (phiCmd != null) ac.ap.pCmd = clamp(0.5 * (phiCmd * D2R - ac.roll), -5 * D2R, 5 * D2R);
        else ac.ap.pCmd = clamp(-0.5 * ac.roll, -5 * D2R, 5 * D2R);
        ac.ap.yaw = yawCmd;
        if (ac.wowMain) { ac.ap.gammaDot = null; ac.ap.pCmd = null; }
      } else { ac.ap.gammaDot = null; ac.ap.pCmd = null; ac.ap.yaw = 0; }

      /* ---------------- autothrust */
      this.updateAthr(dt, tgt, lever, altFt, raFt);

      /* ---------------- FWC: callouts & warnings */
      this.fwc(dt, raFt, casKt, altFt);
      this.lastRaFt = raFt;
    }

    sequence() {
      const ac = this.ac, plan = this.plan;
      if (!plan) return;
      if (this.active >= plan.wps.length) this.active = plan.wps.length - 1;
      // Skip to the leg we are on: advance while the next waypoint is already behind us.
      for (let guard = 0; guard < 5 && this.active < plan.wps.length - 1; guard++) {
        const a = plan.wps[this.active - 1], b = plan.wps[this.active], nx = plan.wps[this.active + 1];
        const ti = Geo.trackInfo(ac.lat, ac.lon, a.lat, a.lon, b.lat, b.lon);
        const remain = ti.legLen - ti.atk;
        const dCrs = Math.abs(wrap180(nx.course - ti.course));
        const V = Math.max(ac.gs, 60);
        const radius = (V * V) / (G * Math.tan(25 * D2R));
        const antic = Math.min(radius * Math.tan(Math.min(dCrs, 120) * D2R / 2), 12 * NM);
        if (remain < Math.max(antic, 200) && !(ac.wowMain)) { this.active++; this.emit('sequence', { wp: b.ident }); }
        else break;
      }
    }

    updateAthr(dt, tgt, lever, altFt, raFt) {
      const ac = this.ac, f = this.fcu;
      const inClRange = lever > 0.02 && lever <= 0.62;
      // Alpha floor
      if (!ac.wowMain && ac.alpha > ac.aFloor && raFt > 100 && this.athrArmed !== null) {
        if (!ac.athr.alphaFloor) { ac.athr.alphaFloor = true; this.togaLk = false; this.emit('alphaFloor', {}); }
        this.athrArmed = true; f.athr = true;
      }
      if (ac.athr.alphaFloor && ac.alpha < ac.aProt - 2 * D2R) { ac.athr.alphaFloor = false; this.togaLk = true; }
      // Levers to idle disconnect A/THR (on ground or during the flare)
      if (this.athrActive && lever <= 0.02 && (ac.wowMain || raFt < 50)) this.disconnectAthr('levers idle');
      if ((this.athrArmed || this.athrActive) && ac.wowMain && lever <= 0.02 && this.phase === 'done') this.disconnectAthr('levers idle');
      // Activation
      if (this.athrArmed && inClRange && !ac.wowMain) this.athrActive = true;
      if (this.athrActive && !inClRange && !ac.athr.alphaFloor) { this.athrActive = false; }
      // LVR CLB flashing after thrust reduction altitude
      this.lvrClb = (this.phase === 'takeoff' || this.phase === 'climb' || this.phase === 'goaround') && !ac.wowMain && lever > 0.7 && altFt > (this.phase === 'goaround' ? this.arrElevFt + 1500 : this.thrRedAltFt) && this.athrArmed;
      if (this.lvrClb && !this.lvrClbTold) { this.lvrClbTold = true; this.emit('lvrClb', {}); }

      let mode = '';
      let cmd = this.athrI;
      if (ac.athr.alphaFloor) mode = 'A.FLOOR';
      else if (this.togaLk) mode = 'TOGA LK';
      else if (lever > 0.95 && (this.athrArmed || this.phase === 'takeoff')) mode = 'MAN TOGA';
      else if (lever > 0.7 && (this.athrArmed || this.phase === 'takeoff')) mode = this.flexTo && ac.airTime < 600 ? `MAN FLX ${Math.round(ac.flexTemp)}` : 'MAN MCT';
      else if (this.athrActive) {
        const thrustModes = { 'CLB': 'THR CLB', 'OP CLB': 'THR CLB', 'SRS': 'THR CLB', 'OP DES': 'THR IDLE' };
        if (thrustModes[this.vert]) {
          mode = thrustModes[this.vert];
          cmd = mode === 'THR CLB' ? 1 : 0;
          this.athrI = cmd;
        } else if (this.vert === 'FLARE' && raFt < 30) {
          mode = 'THR IDLE'; cmd = 0; this.athrI = 0;
          if (!this.retard) { this.retard = true; this.emit('callout', { text: 'RETARD' }); }
        } else {
          mode = this.spdMachRef ? 'MACH' : 'SPEED';
          const err = tgt - ac.cas / KT;
          this.athrI = clamp(this.athrI + (0.012 * err - 0.03 * this.casAccF) * dt, 0, 1);
          cmd = clamp(this.athrI + 0.03 * err - 0.12 * this.casAccF, 0, 1);
          if (this.vert === 'DES' && cmd < 0.02) mode = 'THR IDLE';
        }
        if (lever < 0.58 && mode !== 'THR IDLE') mode = 'THR LVR';
      } else if (inClRange && !ac.wowMain) mode = '';
      this.athrMode = mode;
      ac.athr.active = this.athrActive && !this.togaLk;
      ac.athr.cmd = cmd;
      if (this.togaLk) { ac.athr.alphaFloor = false; ac.athr.active = false; }
    }

    /* ---------------------------------------------- flight warning computer */
    fwc(dt, raFt, casKt, altFt) {
      const ac = this.ac, c = ac.controls, co = this.callouts;
      const say = (text, key = text) => { if (!co.has(key)) { co.add(key); this.emit('callout', { text }); } };
      // Take-off roll callouts by the pilot monitoring
      if (this.phase === 'takeoff' && ac.wowMain) {
        if (casKt > 60 && ac.engines[0].n > 0.75) say('Thrust set');
        if (casKt >= 100) say('One hundred knots');
        if (casKt >= this.perf.v1) say('V1');
        if (casKt >= this.perf.vr) say('Rotate');
      }
      if (this.phase !== 'takeoff' && this.phase !== 'preflight') ['Thrust set', 'One hundred knots', 'V1', 'Rotate'].forEach((k) => co.delete(k));
      if (!ac.wowMain && ac.vs > 1 && raFt > 30 && raFt < 400 && (this.phase === 'takeoff' || this.phase === 'goaround')) say('Positive climb');
      // Take-off configuration warning
      if (ac.wowMain && c.throttle > 0.75 && casKt < 80) {
        let msg = null;
        if (ac.conf === 0 || ac.conf > 4) msg = 'CONFIG FLAPS NOT IN T.O CONFIG';
        else if (c.parkingBrake) msg = 'CONFIG PARK BRK ON';
        else if (c.speedbrake > 0.05) msg = 'CONFIG SPD BRK NOT RETRACTED';
        else if (ac.ths * R2D < -1 || ac.ths * R2D > 6) msg = 'CONFIG PITCH TRIM NOT IN T.O RANGE';
        if (msg) say('CONFIG', 'cfg' + msg), (this.configWarning = msg);
        else this.configWarning = null;
      } else if (ac.wowMain && casKt < 5) { this.configWarning = null; co.forEach((k) => { if (k.startsWith('cfg')) co.delete(k); }); }

      // Radio altitude callouts on approach
      const descending = ac.vs < -0.5 && !ac.wowMain;
      if (descending && (this.phase === 'approach' || this.phase === 'descent') ) {
        for (const [h, text] of [[2500, 'Twenty five hundred'], [1000, 'One thousand'], [500, 'Five hundred'], [400, 'Four hundred'], [300, 'Three hundred'], [200, 'Two hundred'], [100, 'One hundred'], [50, 'Fifty'], [40, 'Forty'], [30, 'Thirty'], [20, 'Twenty'], [10, 'Ten'], [5, 'Five']]) {
          if (this.lastRaFt > h && raFt <= h) say(text, 'ra' + h);
        }
        const mda = this.minimums;
        if (mda && this.lastAlt > mda + 100 && altFt <= mda + 100) say('One hundred above', 'hundredabove');
        if (mda && this.lastAlt > mda && altFt <= mda) say('Minimum', 'minimum');
        if (!this.retard && raFt < 20 && raFt > 3 && c.throttle > 0.05 && !(this.fcu.ap1 || this.fcu.ap2)) { this.retard = true; this.emit('callout', { text: 'RETARD' }); }
        if (this.retard && raFt < 22 && raFt > 2 && c.throttle > 0.05 && (this.retardRepeat = (this.retardRepeat || 0) + dt) > 1.2) { this.retardRepeat = 0; this.emit('callout', { text: 'RETARD' }); }
      }
      if (raFt > 3000 || this.phase === 'goaround') { co.forEach((k) => { if (k.startsWith('ra') || k === 'minimum' || k === 'hundredabove') co.delete(k); }); this.retard = false; }
      this.lastAlt = altFt;

      // GPWS
      const vsFpm = ac.vs / FT * 60;
      let gpws = null;
      if (!ac.wowMain && raFt < 2450 && raFt > 30) {
        const sinkLimit = 1000 + raFt * 1.6;
        if (-vsFpm > sinkLimit * 1.35) gpws = 'PULL UP';
        else if (-vsFpm > sinkLimit) gpws = 'SINK RATE';
        else if (raFt < 500 && ac.gearPos < 0.5 && casKt < 190 && descending) gpws = 'TOO LOW GEAR';
        else if (raFt < 245 && ac.conf < 4 && casKt < 159 && descending && ac.gearPos > 0.5) gpws = 'TOO LOW FLAPS';
        else if (this.ils && this.ils.gsValid && this.ils.gsDots < -1.3 && raFt < 1000 && descending && ac.gearPos > 0.5 && (this.vert.startsWith('G/S') || this.fcu.appr || this.phase === 'approach')) gpws = 'GLIDESLOPE';
        else if (Math.abs(ac.roll * R2D) > 35 + Math.min(10, raFt / 100)) gpws = 'BANK ANGLE';
        else if (raFt < 1500 && descending && this.phase !== 'approach' && this.phase !== 'descent' && this.phase !== 'goaround' && ac.gearPos < 0.5 && -vsFpm > 1500) gpws = 'TERRAIN';
      }
      if (gpws) { this.gpwsTimer = (this.gpwsTimer || 0) - dt; if (this.gpwsTimer <= 0 || gpws !== this.gpws) { this.emit('gpws', { text: gpws }); this.gpwsTimer = 2.2; } }
      this.gpws = gpws;
      // Stall & overspeed
      const stall = !ac.wowMain && (ac.alpha > ac.aStall - 0.5 * D2R || (c.law === 'direct' && ac.alpha > ac.aProt + 1 * D2R));
      if (stall) { this.stallT = (this.stallT || 0) - dt; if (this.stallT <= 0) { this.emit('stall', {}); this.stallT = 1.6; } } else this.stallT = 0;
      this.stallWarn = stall;
      const cs = this.cs = this.charSpeeds();
      const over = !ac.wowMain && casKt > cs.vmax + 4;
      if (over && !this.overspeedWarn) this.emit('overspeed', { vmax: cs.vmax });
      this.overspeedWarn = over;
    }
  }

  const Autoflight = { FMGC };
  if (typeof module !== 'undefined' && module.exports) module.exports = Autoflight;
  else root.Autoflight = Autoflight;
})(typeof window !== 'undefined' ? window : globalThis);
