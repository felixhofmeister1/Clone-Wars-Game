const Geo = require('../js/sim/geo.js'); global.Geo = Geo;
const FDM = require('../js/sim/fdm.js');
const { KT, FT, R2D, D2R } = Geo;
const ac = new FDM.Aircraft({ groundHeight: () => 111, surface: () => 'runway' });
// FRA 25C threshold, heading ~249.6
ac.reset({ lat: 50.045101, lon: 8.586979, heading: 249.6, onGround: true, fuel: 60000, payload: 33000, flapLever: 1, spoilersArmed: true, autobrake: 3 });
console.log('mass', ac.mass, 'conf', ac.conf, 'VS 1+F', (FDM.vs1g(2, ac.mass)/KT).toFixed(0));
const c = ac.controls;
const dt = 1/120;
let t = 0, rotated = false;
function log() {
  console.log(`t=${t.toFixed(1)} cas=${(ac.cas/KT).toFixed(0)} gs=${(ac.gs/KT).toFixed(0)} ra=${(ac.ra/FT).toFixed(0)}ft vs=${(ac.vs/FT*60).toFixed(0)} pitch=${(ac.pitch*R2D).toFixed(1)} roll=${(ac.roll*R2D).toFixed(1)} hdg=${Geo.wrap360(ac.heading*R2D).toFixed(1)} alpha=${(ac.alpha*R2D).toFixed(1)} nz=${ac.nz.toFixed(2)} elev=${(ac.elev*R2D).toFixed(1)} ths=${(ac.ths*R2D).toFixed(2)} n1=${ac.engines[0].n1.toFixed(0)} wow=${ac.wow.map(Number).join('')} fb=${ac.flightBlend.toFixed(2)} ev=${ac.events.map(e=>e.type).join(',')}`);
  ac.events.length = 0;
}
c.throttle = 0.8; // FLX
for (; t < 120; t += dt) {
  const cas = ac.cas / KT;
  if (cas > 150 && ac.wowMain && !rotated) { c.pitch = 0.6; }
  if (!ac.wowMain && ac.ra > 3) { rotated = true; }
  if (rotated) {
    // Follow SRS-ish: pitch to 15°, then release
    const err = 15 - ac.pitch * R2D;
    c.pitch = Math.max(-1, Math.min(1, err * 0.08));
  }
  if (rotated && ac.ra / FT > 50) c.gearDown = false;
  ac.step(dt);
  if (ac.crashed) { console.log('CRASH', ac.crashed); break; }
  if (Math.abs(t % 2) < dt) log();
}
log();
