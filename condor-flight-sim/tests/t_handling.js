const Geo = require('../js/sim/geo.js'); global.Geo = Geo;
const FDM = require('../js/sim/fdm.js');
const { KT, FT, R2D, D2R } = Geo;
function mk(alt, ias, flap) {
  const ac = new FDM.Aircraft({ groundHeight: () => 0 });
  ac.reset({ lat: 50, lon: 8, heading: 90, onGround: false, alt: alt * FT, tas: 200, fuel: 40000, payload: 30000 });
  ac.trimFlight({ lat: 50, lon: 8, heading: 90, alt: alt * FT, ias, gamma: 0, flapLever: flap, gearDown: flap >= 3 });
  return ac;
}
const run = (ac, sec, fn) => { for (let t = 0; t < sec; t += 1/120) { fn && fn(t); ac.step(1/120); } };
for (const [alt, ias, flap] of [[35000, 270, 0], [10000, 250, 0], [3000, 150, 4]]) {
  let ac = mk(alt, ias, flap);
  const a0 = ac.alt, v0 = ac.cas / KT;
  run(ac, 30);
  console.log(`\n== ${alt} ft ${ias} kt flap ${flap}: hands-off 30s: dAlt=${((ac.alt-a0)/FT).toFixed(0)} ft dV=${(ac.cas/KT-v0).toFixed(1)} kt pitch=${(ac.pitch*R2D).toFixed(1)} ths=${(ac.ths*R2D).toFixed(1)} elev=${(ac.elev*R2D).toFixed(1)} thr=${ac.controls.throttle.toFixed(2)}`);
  ac = mk(alt, ias, flap);
  let maxP = 0; run(ac, 3, () => { ac.controls.roll = 1; maxP = Math.max(maxP, ac.p * R2D); });
  const b1 = ac.roll * R2D; ac.controls.roll = 0; const a1 = ac.alt;
  run(ac, 10); const b2 = ac.roll * R2D;
  console.log(`  full right stick 3s: max roll rate ${maxP.toFixed(1)}°/s, bank ${b1.toFixed(1)} -> 10s after release ${b2.toFixed(1)} (alt change ${((ac.alt-a1)/FT).toFixed(0)} ft), beta ${(ac.beta*R2D).toFixed(2)}`);
  ac = mk(alt, ias, flap);
  run(ac, 1.5, () => { ac.controls.roll = 1; }); ac.controls.roll = 0; const a2 = ac.alt; run(ac, 2); const bRel = ac.roll*R2D; run(ac, 28); console.log("   bank 2s after release", bRel.toFixed(1));
  console.log(`  ~22° bank released: after 30s bank ${(ac.roll*R2D).toFixed(1)} alt change ${((ac.alt-a2)/FT).toFixed(0)} ft, hdg ${(ac.heading*R2D).toFixed(0)} beta ${(ac.beta*R2D).toFixed(2)}`);
  ac = mk(alt, ias, flap);
  let maxNz = 0, maxQ = 0;
  run(ac, 3, () => { ac.controls.pitch = 0.5; maxNz = Math.max(maxNz, ac.nz); maxQ = Math.max(maxQ, ac.qr * R2D); });
  ac.controls.pitch = 0; const g1 = ac.gamma * R2D; run(ac, 10); const g2 = ac.gamma * R2D;
  console.log(`  half pull 3s: max nz ${maxNz.toFixed(2)} max q ${maxQ.toFixed(1)}°/s, FPA ${g1.toFixed(1)} -> 10s after release ${g2.toFixed(1)}`);
  ac = mk(alt, ias, flap);
  let maxA = 0, maxTh = 0; maxNz = 0;
  run(ac, 12, () => { ac.controls.pitch = 1; maxA = Math.max(maxA, ac.alpha * R2D); maxTh = Math.max(maxTh, ac.pitch * R2D); maxNz = Math.max(maxNz, ac.nz); });
  console.log(`  full pull 12s: max nz ${maxNz.toFixed(2)} max alpha ${maxA.toFixed(1)} (prot ${(ac.aProt*R2D).toFixed(1)}, max ${(ac.aMax*R2D).toFixed(1)}) max pitch ${maxTh.toFixed(1)} alphaProt=${ac.alphaProt} cas=${(ac.cas/KT).toFixed(0)} crash=${ac.crashed}`);
  ac = mk(alt, ias, flap); ac.controls.throttle = 0;
  maxA = 0; run(ac, 60, () => { ac.controls.pitch = 0; maxA = Math.max(maxA, ac.alpha * R2D); });
  console.log(`  idle, hands off 60s (speed decays): alpha ${maxA.toFixed(1)} cas ${(ac.cas/KT).toFixed(0)} alphaProt=${ac.alphaProt} vs ${(ac.vs/FT*60).toFixed(0)}`);
}
