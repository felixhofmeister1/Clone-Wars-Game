const Geo = require('../js/sim/geo.js'); global.Geo = Geo;
const FDM = require('../js/sim/fdm.js');
const { KT, FT, R2D } = Geo;
for (const stick of [0.4, 0.55, 0.7, 1.0]) {
  const ac = new FDM.Aircraft({ groundHeight: () => 111 });
  ac.reset({ lat: 50.045101, lon: 8.586979, heading: 249.6, onGround: true, fuel: 60000, payload: 33000, flapLever: 1, spoilersArmed: true });
  const c = ac.controls; c.throttle = 0.8;
  let t = 0, tR = null, maxP = 0, liftP = null, liftT = null, strike = false, maxRate = 0;
  for (; t < 70; t += 1 / 120) {
    if (ac.cas / KT > 150 && tR === null) tR = t;
    if (tR !== null) c.pitch = ac.pitch * R2D < 12.5 ? stick : Math.max(-0.3, (12.5 - ac.pitch * R2D) * 0.1);
    ac.step(1 / 120);
    if (tR !== null) maxRate = Math.max(maxRate, ac.qr * R2D);
    if (!ac.wowMain && liftP === null && tR) { liftP = ac.pitch * R2D; liftT = t - tR; }
    maxP = Math.max(maxP, ac.pitch * R2D);
    if (ac.tailStrike) strike = true;
  }
  console.log(`stick ${stick}: max pitch rate ${maxRate.toFixed(1)}°/s, liftoff after ${liftT?.toFixed(1)}s at ${liftP?.toFixed(1)}°, max pitch ${maxP.toFixed(1)}, tailstrike ${strike}, alt ${(ac.ra/FT).toFixed(0)} ft cas ${(ac.cas/KT).toFixed(0)}`);
}
