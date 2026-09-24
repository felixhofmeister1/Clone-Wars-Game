// Full scripted flight with a "virtual pilot" doing what a Condor crew would do.
const Geo = require('../js/sim/geo.js'); global.Geo = Geo;
const { AIRPORTS, MAGVAR } = require('../js/data/airports.js'); Geo.setMagvarGrid(MAGVAR);
const FDM = require('../js/sim/fdm.js'); global.FDM = FDM;
const FP = require('../js/sim/flightplan.js'); global.FlightPlan = FP;
const AF = require('../js/sim/autoflight.js');
const { KT, FT, R2D, D2R, NM } = Geo;
const ap = (c) => AIRPORTS.find((a) => a.icao === c);
const [,, DEP = 'EDDF', DR = '25C', ARR = 'LEPA', AR = '24L', CRZ = '35000', MODE = 'auto'] = process.argv;
const plan = FP.build({ dep: ap(DEP), depRwy: DR, arr: ap(ARR), arrRwy: AR, cruiseFt: +CRZ });
const depElev = plan.depRwy.elev, arrElev = plan.arrRwy.elev;
// Simple terrain: departure elevation near departure, arrival elevation near arrival, else sea level.
const env = {
  groundHeight: (lat, lon) => {
    const d1 = Geo.distance(lat, lon, plan.depRwy.lat, plan.depRwy.lon), d2 = Geo.distance(lat, lon, plan.arrRwy.thr.lat, plan.arrRwy.thr.lon);
    if (d1 < 20000) return depElev; if (d2 < 20000) return arrElev; return Math.min(depElev, arrElev, 0);
  },
  surface: () => 'runway',
  wind: () => [0, 0, 0],
};
const ac = new FDM.Aircraft(env);
const fuel = FP.fuelPlan(plan.total, 165000).block;
ac.reset({ lat: plan.depRwy.lat, lon: plan.depRwy.lon, heading: plan.depRwy.hdg, onGround: true, fuel, payload: 33000, flapLever: 1, spoilersArmed: true, autobrake: 3 });
// move 100 m down the runway from the threshold
const fm = new AF.FMGC(ac, plan);
const c = ac.controls;
let t = 0; const dt = 1 / 60;
let lastLog = -999;
const log = (tag = '') => {
  const ils = fm.ils;
  console.log(`${(t/60).toFixed(1).padStart(6)}m ${fm.phase.padEnd(9)} ${fm.athrMode.padEnd(10)} ${fm.vert.padEnd(7)} ${fm.lat.padEnd(7)} alt=${(ac.alt/FT).toFixed(0).padStart(6)} ra=${(ac.ra/FT).toFixed(0).padStart(6)} cas=${(ac.cas/KT).toFixed(0)}/${fm.lastTarget?.toFixed(0)} M${ac.mach.toFixed(3)} vs=${(ac.vs/FT*60).toFixed(0).padStart(6)} pit=${(ac.pitch*R2D).toFixed(1)} rol=${(ac.roll*R2D).toFixed(1)} trk=${Geo.wrap360(ac.track*R2D).toFixed(0)} n1=${ac.engines[0].n1.toFixed(0)} conf=${ac.P.confs[ac.conf].name} fuel=${(ac.fuel/1000).toFixed(1)} wp=${plan.wps[fm.active]?.ident} xtk=${fm.prog? (fm.prog.xtk).toFixed(0):''} ${ils && ils.inRange ? `loc=${ils.locDots.toFixed(2)} gs=${ils.gsDots.toFixed(2)}`:''} ${tag}`);
};
const events = [];
let rotated = false, apOn = false, todDone = false, apprArmed = false, landed = false, stopT = null;
const manualLanding = MODE === 'manual';
for (; t < 13 * 3600; t += dt) {
  const cas = ac.cas / KT, raFt = ac.ra / FT;
  // ---- pilot
  if (t < 1) { c.throttle = 0.8; }
  if (ac.wowMain && !rotated && cas >= fm.perf.vr) rotated = true;
  if (rotated && !apOn) {
    if (ac.wowMain) c.pitch = ac.pitch * R2D < 12 ? 0.62 : 0.2;
    else c.pitch = fm.fdPitch != null ? Math.max(-0.6, Math.min(0.6, fm.fdPitch * 0.05)) : 0;
    c.roll = fm.fdRoll != null ? Math.max(-0.5, Math.min(0.5, fm.fdRoll * 0.04)) : 0;
  }
  if (fm.phase === 'takeoff' && !ac.wowMain && ac.vs > 2 && raFt > 50) c.gearDown = false;
  if (fm.lvrClb) c.throttle = 0.6;
  if (!apOn && raFt > 1200 && !ac.wowMain) { fm.fcuAction('ap1'); apOn = fm.fcu.ap1; c.pitch = 0; c.roll = 0; }
  const cs = fm.charSpeeds();
  if (fm.phase === 'climb' || fm.phase === 'takeoff') {
    if (ac.conf >= 1 && cas > cs.s + 5 && !ac.wowMain && raFt > 1500) c.flapLever = 0;
  }
  if (fm.phase === 'cruise' && fm.todAnnounced && !todDone) { todDone = true; fm.fcuAction('altTurn', (plan.wps.find(w => w.kind === 'ff').altCstr - fm.fcu.alt)); fm.fcuAction('altPush'); }
  if (fm.phase === 'approach' || fm.phase === 'descent') {
    const dThr = fm.prog ? fm.prog.toGo / NM : 99;
    if (!apprArmed && dThr < 30) { fm.fcuAction('appr'); apprArmed = true; }
    if (fm.moreDrag || (fm.phase === 'approach' && cas > fm.lastTarget + 15 && !fm.vert.startsWith('G/S'))) c.speedbrake = 1; else c.speedbrake = 0;
    if (fm.phase === 'approach') {
      if (c.flapLever === 0 && cas < 235 && dThr < 35) c.flapLever = 1;
      if (c.flapLever === 1 && cas < 192 && dThr < 25) c.flapLever = 2;
      if (c.flapLever === 2 && cas < 182 && (fm.vert.startsWith('G/S') || dThr < 13)) { c.gearDown = true; c.spoilersArmed = true; c.autobrake = 2; c.flapLever = 3; }
      if (c.flapLever === 3 && cas < 176 && ac.gearPos > 0.99 && dThr < 10) { c.flapLever = 4; c.speedbrake = 0; }
    }
  }
  if (manualLanding && apOn && raFt < 700 && fm.vert.startsWith('G/S') && !ac.wowMain) { fm.fcuAction('ap1'); apOn = false; }
  if (manualLanding && !apOn && !ac.wowMain && fm.phase === 'approach' && raFt < 700) {
    // hand-flown: follow FD until 30 ft, then flare
    c.pitch = fm.fdPitch != null ? Math.max(-0.4, Math.min(0.4, fm.fdPitch * 0.05)) : 0;
    c.roll = fm.fdRoll != null ? Math.max(-0.4, Math.min(0.4, fm.fdRoll * 0.04)) : 0;
    if (raFt < 32) c.pitch = 0.28;
  }
  if (!ac.wowMain && raFt < 25 && fm.phase === 'approach' && (fm.retard || manualLanding && raFt < 20)) c.throttle = 0;
  if (ac.wowMain && fm.phase === 'done' || (ac.wowMain && fm.vert === 'ROLL OUT')) {
    if (!landed) { landed = true; }
    c.pitch = 0;
    if (ac.gs > 70 * KT && ac.groundTime > 1.5) c.throttle = -0.7; else if (ac.gs < 70 * KT) c.throttle = 0;
    if (ac.gs < 2 && stopT === null) stopT = t;
  }
  // ---- sim
  fm.update(dt);
  ac.update(dt);
  for (const e of fm.events) { if (['mode'].includes(e.type)) continue; events.push(`${(t/60).toFixed(1)}m ${e.type} ${e.text||e.phase||e.reason||e.wp||''}`); if (!['sequence','callout'].includes(e.type)) log('<< ' + e.type + ' ' + (e.text||e.phase||e.reason||'')); }
  fm.events.length = 0;
  for (const e of ac.events) { if (e.type === 'touchdown') log(`TOUCHDOWN vs=${e.vs.toFixed(0)}fpm g=${e.gMax.toFixed(2)} pitch=${e.pitch.toFixed(1)}`); if (e.type === 'crash') log('CRASH ' + e.reason); if (e.type==='tailStrike') log('TAILSTRIKE'); }
  ac.events.length = 0;
  if (ac.crashed) break;
  const interval = ac.alt / FT < 3000 + arrElev / FT || fm.phase === 'takeoff' || fm.phase === 'approach' ? 10 : 300;
  if (t - lastLog >= interval) { lastLog = t; log(); }
  if (stopT !== null && t - stopT > 3) break;
}
log('END');
if (landed) {
  const d = Geo.trackInfo(ac.lat, ac.lon, plan.arrRwy.thr.lat, plan.arrRwy.thr.lon, plan.arrRwy.far.lat, plan.arrRwy.far.lon);
  console.log('stopped', d.atk.toFixed(0), 'm past threshold, centerline offset', d.xtk.toFixed(1), 'm');
}
console.log(events.filter(e=>/callout|gpws/.test(e)).join(' | '));
