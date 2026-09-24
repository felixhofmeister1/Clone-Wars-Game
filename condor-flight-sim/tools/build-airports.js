#!/usr/bin/env node
/* =============================================================================
 * build-airports.js — Generates js/data/airports.js from the OurAirports
 * public-domain dataset (https://ourairports.com/data/).
 *
 *   git clone --depth 1 https://github.com/davidmegginson/ourairports-data /tmp/oa
 *   node tools/build-airports.js /tmp/oa
 *
 * Only the Condor network below is exported, with every hard-surface runway
 * that has surveyed threshold coordinates.
 * ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');

// ICAO, display city, region, base?
// Regions: DE Germany (bases), EU Europe & Mediterranean, NA North America,
// CA Caribbean & Central America, AF Africa, AS Middle East & Asia, IO Indian Ocean.
const NETWORK = [
  ['EDDF', 'Frankfurt', 'DE', true], ['EDDM', 'Munich', 'DE', true], ['EDDL', 'Düsseldorf', 'DE', true],
  ['EDDH', 'Hamburg', 'DE', true], ['EDDB', 'Berlin', 'DE', true], ['EDDS', 'Stuttgart', 'DE', true],
  ['EDDP', 'Leipzig/Halle', 'DE', true], ['EDDV', 'Hannover', 'DE', true], ['EDDN', 'Nuremberg', 'DE', true],

  ['LEPA', 'Palma de Mallorca', 'EU'], ['LEIB', 'Ibiza', 'EU'], ['LEMH', 'Menorca', 'EU'],
  ['LEMG', 'Málaga', 'EU'], ['GCLP', 'Gran Canaria', 'EU'], ['GCTS', 'Tenerife South', 'EU'],
  ['GCRR', 'Lanzarote', 'EU'], ['GCFV', 'Fuerteventura', 'EU'], ['GCLA', 'La Palma', 'EU'],
  ['LPMA', 'Madeira (Funchal)', 'EU'], ['LPFR', 'Faro', 'EU'], ['LGIR', 'Heraklion', 'EU'],
  ['LGRP', 'Rhodes', 'EU'], ['LGKO', 'Kos', 'EU'], ['LGKR', 'Corfu', 'EU'], ['LGSA', 'Chania', 'EU'],
  ['LGZA', 'Zakynthos', 'EU'], ['LTAI', 'Antalya', 'EU'], ['LTBS', 'Dalaman', 'EU'],
  ['LTFE', 'Bodrum', 'EU'], ['LTBJ', 'Izmir', 'EU'], ['LCLK', 'Larnaca', 'EU'], ['LCPH', 'Paphos', 'EU'],
  ['LIEO', 'Olbia', 'EU'], ['LICC', 'Catania', 'EU'], ['LIPZ', 'Venice', 'EU'], ['LDSP', 'Split', 'EU'],
  ['LDDU', 'Dubrovnik', 'EU'], ['LMML', 'Malta', 'EU'], ['GMAD', 'Agadir', 'EU'],
  ['GMMX', 'Marrakesh', 'EU'], ['DTTJ', 'Djerba', 'EU'], ['DTNH', 'Enfidha', 'EU'],
  ['HEGN', 'Hurghada', 'EU'], ['HEMA', 'Marsa Alam', 'EU'], ['HESH', 'Sharm el-Sheikh', 'EU'],

  ['KJFK', 'New York JFK', 'NA'], ['KBOS', 'Boston', 'NA'], ['KBWI', 'Baltimore', 'NA'],
  ['KPIT', 'Pittsburgh', 'NA'], ['KMSP', 'Minneapolis', 'NA'], ['KSEA', 'Seattle', 'NA'],
  ['KPDX', 'Portland', 'NA'], ['KSFO', 'San Francisco', 'NA'], ['KLAX', 'Los Angeles', 'NA'],
  ['KLAS', 'Las Vegas', 'NA'], ['KPHX', 'Phoenix', 'NA'], ['KSAT', 'San Antonio', 'NA'],
  ['PANC', 'Anchorage', 'NA'], ['PAFA', 'Fairbanks', 'NA'], ['CYYZ', 'Toronto', 'NA'],
  ['CYVR', 'Vancouver', 'NA'], ['CYYC', 'Calgary', 'NA'], ['CYHZ', 'Halifax', 'NA'],

  ['MMUN', 'Cancún', 'CA'], ['MDPC', 'Punta Cana', 'CA'], ['MDPP', 'Puerto Plata', 'CA'],
  ['MKJS', 'Montego Bay', 'CA'], ['MUHG', 'Holguín', 'CA'], ['MUVR', 'Varadero', 'CA'],
  ['MUHA', 'Havana', 'CA'], ['TBPB', 'Barbados', 'CA'], ['TTCP', 'Tobago', 'CA'],
  ['TGPY', 'Grenada', 'CA'], ['TLPL', 'St. Lucia', 'CA'], ['TAPA', 'Antigua', 'CA'],
  ['MPTO', 'Panama City', 'CA'], ['MROC', 'San José (Costa Rica)', 'CA'], ['MRLB', 'Liberia (Costa Rica)', 'CA'],

  ['FAOR', 'Johannesburg', 'AF'], ['FACT', 'Cape Town', 'AF'], ['FYWH', 'Windhoek', 'AF'],
  ['HKMO', 'Mombasa', 'AF'], ['HTZA', 'Zanzibar', 'AF'], ['HTKJ', 'Kilimanjaro', 'AF'],

  ['OMDB', 'Dubai', 'AS'], ['VTBS', 'Bangkok', 'AS'], ['VCBI', 'Colombo', 'AS'],

  ['FIMP', 'Mauritius', 'IO'], ['FSIA', 'Seychelles (Mahé)', 'IO'], ['VRMM', 'Malé (Maldives)', 'IO'],
];

const HARD = /^(ASP|ASPH|CON|CONC|PEM|BIT|ASPH-CONC|ASP-CON|ASPH\/CONC|CONC\/ASPH|PAVED|BITUMINOUS|CONCRETE|ASPHALT|ASP\/CON|ASPH-G|BIT-CON|GRE)/i;

function parseCSV(text) {
  const rows = [];
  let row = [], field = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else q = false; }
      else field += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (c !== '\r') field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  const head = rows.shift();
  return rows.map((r) => Object.fromEntries(head.map((h, i) => [h, r[i]])));
}

const src = process.argv[2] || '/tmp/oa';
const airports = parseCSV(fs.readFileSync(path.join(src, 'airports.csv'), 'utf8'));
const runways = parseCSV(fs.readFileSync(path.join(src, 'runways.csv'), 'utf8'));
const byIdent = new Map(airports.map((a) => [a.ident, a]));
const r6 = (v) => Math.round(parseFloat(v) * 1e6) / 1e6;
const FT = 0.3048;

const out = [];
for (const [icao, city, region, base] of NETWORK) {
  const a = byIdent.get(icao);
  if (!a) { console.error('missing airport', icao); continue; }
  const rws = runways
    .filter((r) => r.airport_ident === icao && r.closed !== '1' && r.le_latitude_deg && r.he_latitude_deg)
    .filter((r) => HARD.test(r.surface || 'ASP') && parseFloat(r.length_ft) >= 6000)
    .map((r) => ({
      length: Math.round(parseFloat(r.length_ft) * FT),
      width: Math.max(30, Math.round((parseFloat(r.width_ft) || 148) * FT)),
      ends: [
        { id: r.le_ident, lat: r6(r.le_latitude_deg), lon: r6(r.le_longitude_deg),
          elev: parseFloat(r.le_elevation_ft || a.elevation_ft || 0), disp: Math.round((parseFloat(r.le_displaced_threshold_ft) || 0) * FT) },
        { id: r.he_ident, lat: r6(r.he_latitude_deg), lon: r6(r.he_longitude_deg),
          elev: parseFloat(r.he_elevation_ft || a.elevation_ft || 0), disp: Math.round((parseFloat(r.he_displaced_threshold_ft) || 0) * FT) },
      ],
    }))
    .sort((x, y) => y.length - x.length);
  if (!rws.length) { console.error('no usable runway', icao); continue; }
  out.push({
    icao, iata: a.iata_code, name: a.name, city, country: a.iso_country, region, base: !!base,
    lat: r6(a.latitude_deg), lon: r6(a.longitude_deg), elev: parseFloat(a.elevation_ft || 0), runways: rws,
  });
}

// Magnetic variation grid (5° cells, east positive) averaged from navaid records,
// with empty cells filled from their neighbours so the runtime can interpolate.
const navaids = parseCSV(fs.readFileSync(path.join(src, 'navaids.csv'), 'utf8'));
const NLAT = 37, NLON = 73; // nodes at -90..90, -180..180
const sum = new Float64Array(NLAT * NLON), cnt = new Float64Array(NLAT * NLON);
for (const n of navaids) {
  const v = parseFloat(n.magnetic_variation_deg), la = parseFloat(n.latitude_deg), lo = parseFloat(n.longitude_deg);
  if (!isFinite(v) || !isFinite(la) || !isFinite(lo) || Math.abs(v) > 60) continue;
  const i = Math.round((la + 90) / 5), j = Math.round((lo + 180) / 5);
  sum[i * NLON + j] += v; cnt[i * NLON + j] += 1;
}
let grid = Array.from(sum, (s, k) => (cnt[k] ? s / cnt[k] : null));
for (let pass = 0; pass < 200 && grid.some((g) => g === null); pass++) {
  const next = grid.slice();
  for (let i = 0; i < NLAT; i++) for (let j = 0; j < NLON; j++) {
    if (grid[i * NLON + j] !== null) continue;
    let s = 0, c = 0;
    for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) {
      const ii = i + di, jj = (j + dj + NLON) % NLON;
      if (ii < 0 || ii >= NLAT) continue;
      const g = grid[ii * NLON + jj];
      if (g !== null) { s += g; c++; }
    }
    if (c) next[i * NLON + j] = s / c;
  }
  grid = next;
}
grid = grid.map((g) => Math.round((g ?? 0) * 10) / 10);

const js = `/* Generated by tools/build-airports.js from OurAirports data (public domain).
 * Condor network: bases and destinations with surveyed runway thresholds.
 * Elevations in feet, lengths/widths in metres, displaced thresholds in metres. */
(function (root) {
  const AIRPORTS = ${JSON.stringify(out)};
  // Magnetic variation (deg, east +) on a 5° lat/lon node grid: 37 rows (-90..90) x 73 cols (-180..180).
  const MAGVAR = ${JSON.stringify(grid)};
  if (typeof module !== 'undefined' && module.exports) module.exports = { AIRPORTS, MAGVAR };
  else { root.CONDOR_AIRPORTS = AIRPORTS; root.CONDOR_MAGVAR = MAGVAR; }
})(typeof window !== 'undefined' ? window : globalThis);
`;
const dest = path.join(__dirname, '..', 'js', 'data', 'airports.js');
fs.writeFileSync(dest, js);
console.log(`wrote ${out.length} airports, ${out.reduce((s, a) => s + a.runways.length, 0)} runways → ${dest} (${js.length} bytes)`);
