const Geo = require('../js/sim/geo.js'); global.Geo = Geo;
const { AIRPORTS, MAGVAR } = require('../js/data/airports.js'); Geo.setMagvarGrid(MAGVAR);
const FP = require('../js/sim/flightplan.js');
const ap = (c) => AIRPORTS.find((a) => a.icao === c);
for (const [d, dr, a, ar] of [['EDDF','25C','FAOR','03L'], ['EDDF','07C','FAOR','21R'], ['EDDF','25C','LEPA','24L'], ['EDDF','25C','KJFK','22L']]) {
  const p = FP.build({ dep: ap(d), depRwy: dr, arr: ap(a), arrRwy: ar, cruiseFt: 37000 });
  console.log(d, '->', a, (p.total/1852).toFixed(0), 'nm', 'TOD at', (p.todDist/1852).toFixed(0), 'nm; ILS', p.arrRwy.ils.ident, p.arrRwy.ils.freq, 'crs', p.arrRwy.ils.course.toFixed(0), 'opp', p.fromDir);
  console.log('  ' + p.wps.map(w => `${w.ident}${w.altCstr? '/'+w.altCstr:''}(${(w.dist/1852).toFixed(0)})`).join(' '));
  const f = FP.fuelPlan(p.total, 165000); console.log('  fuel', f);
}
