/* Problem-Solving and Data Analysis generators: ratios and units,
   percentages, one- and two-variable data, probability, sampling, and
   evaluating statistical claims. */
(function () {
  'use strict';
  const SAT = window.SAT, G = SAT.mathgen, F = SAT.fig;
  const m = G.m, nt = G.nt, P = G.P, add = G.add;
  const isInt = (v) => Math.abs(v - Math.round(v)) < 1e-9;
  const nw = G.nw;
  const sum = (a) => a.reduce((x, y) => x + y, 0);
  const median = (a) => { const s = a.slice().sort((x, y) => x - y), n = s.length; return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2; };
  const fracChoice = (n, d) => ({ v: n / d, tex: G.ftex(n, d), fr: [n, d] });
  const pl = (s) => s.replace(/^prefers /, 'prefer ').replace(/^is /, 'are ').replace(/^was /, 'were ').replace(/^lives /, 'live ').replace(/^owns /, 'own ').replace(/^does not /, 'do not ');

  /* ================================================ rat: ratios/rates */
  const rateCtx = [
    { who: 'A car traveling at a constant speed', verb: 'travels', fut: 'travel', amt: 'miles', per: 'hours', rates: [45, 50, 55, 60, 64, 65] },
    { who: 'A printer working at a constant rate', verb: 'prints', fut: 'print', amt: 'pages', per: 'minutes', rates: [12, 15, 18, 24, 30] },
    { who: 'A faucet running at a constant rate', verb: 'releases', fut: 'release', amt: 'gallons of water', per: 'minutes', rates: [2, 3, 4, 5, 6] },
    { who: 'A bakery machine working at a constant rate', verb: 'bakes', fut: 'bake', amt: 'cookies', per: 'minutes', rates: [40, 45, 60, 75] },
  ];
  add('rat', 'E', (r) => {
    const c = r.pick(rateCtx), rate = r.pick(c.rates), t1 = r.int(2, 6); let t2 = r.int(3, 12); if (t2 === t1) t2 += 2;
    const a1 = rate * t1, ans = rate * t2;
    return {
      stem: c.who + ' ' + c.verb + ' ' + nw(a1) + ' ' + c.amt + ' in ' + t1 + ' ' + c.per + '. At this rate, how many ' + c.amt + ' will it ' + c.fut + ' in ' + t2 + ' ' + c.per + '?',
      ...G.mcNum(r, ans, [
        { v: a1 + (t2 - t1), why: 'This adds the difference in time instead of scaling by the rate.' },
        { v: a1 * t2, why: 'This multiplies the total amount by ' + t2 + ' instead of the rate per ' + c.per.slice(0, -1) + '.' },
        { v: rate * (t2 - 1), why: 'This uses ' + (t2 - 1) + ' ' + c.per + ' instead of ' + t2 + '.' },
      ]),
      num: ans,
      explanation: P('Unit rate: ' + m('\\frac{' + nt(a1) + '}{' + t1 + '} = ' + rate) + ' ' + c.amt + ' per ' + c.per.slice(0, -1) + '.', 'In ' + t2 + ' ' + c.per + ': ' + m(rate + '\\times ' + t2 + ' = ' + nt(ans)) + ' ' + c.amt + '.'),
    };
  });

  add('rat', 'E', (r) => {
    const c = r.pick([['flour', 'sugar', 'cups'], ['blue paint', 'white paint', 'liters'], ['sand', 'cement', 'pounds'], ['boys', 'girls', null]]);
    const a = r.int(2, 7); let b = r.int(1, 6); if (G.gcd(a, b) !== 1 || a === b) { b = a + 1; }
    const k = r.int(2, 9), A = a * k, B = b * k;
    const unit = c[2] ? ' ' + c[2] + ' of' : '';
    const stem = c[2] ? 'In a mixture, the ratio of ' + c[0] + ' to ' + c[1] + ' is ' + a + ' to ' + b + '. If ' + A + unit + ' ' + c[0] + ' are used, how many' + (c[2] ? ' ' + c[2] + ' of' : '') + ' ' + c[1] + ' are needed?'
      : 'In a club, the ratio of boys to girls is ' + a + ' to ' + b + '. If there are ' + A + ' boys in the club, how many girls are in the club?';
    return {
      stem,
      ...G.mcNum(r, B, [
        isInt((A * a) / b) ? { v: (A * a) / b, why: 'This sets up the proportion upside down.' } : { v: A + (b - a), why: 'This adds the difference between the ratio terms instead of scaling.' },
        { v: A + B, why: 'This is the total of both quantities.' },
        { v: A - (a - b), why: 'This subtracts the difference in the ratio terms instead of scaling.' },
      ]),
      num: B,
      explanation: P('Set up a proportion: ' + m('\\frac{' + a + '}{' + b + '} = \\frac{' + A + '}{x}') + '.', 'Cross-multiply: ' + m(a + 'x = ' + b * A) + ', so ' + m('x = ' + B) + '. (Or notice that ' + A + ' is ' + k + ' times ' + a + ', so the answer is ' + k + ' times ' + b + '.)'),
    };
  });

  add('rat', 'M', (r) => {
    const ppm = r.pick([12, 15, 18, 20, 24, 25, 30, 40]), hrs = r.pick([1.5, 2, 2.5, 3, 4]);
    if (!isInt(ppm * 60 * hrs)) return G.gens.rat.M[0](r);
    const pages = ppm * 60 * hrs;
    return {
      stem: 'A printer prints ' + ppm + ' pages per minute. At this rate, how many hours will it take the printer to print ' + nw(pages) + ' pages?',
      ...G.mcNum(r, hrs, [
        { v: pages / ppm, why: 'This is the number of <i>minutes</i>, not hours.' },
        { v: G.clean(pages / ppm / 100), why: 'There are 60 minutes in an hour, not 100.' },
        { v: G.clean(hrs * 2), why: 'Recheck the division: ' + m(nt(pages) + '\\div' + ppm + ' = ' + nt(pages / ppm)) + ' minutes.' },
      ], { step: 0.5 }),
      num: hrs,
      explanation: P('Time in minutes: ' + m('\\frac{' + nt(pages) + '\\text{ pages}}{' + ppm + '\\text{ pages per minute}} = ' + nt(pages / ppm)) + ' minutes.', 'Convert to hours: ' + m('\\frac{' + nt(pages / ppm) + '}{60} = ' + hrs) + ' hours.'),
    };
  });

  add('rat', 'M', (r) => {
    const scale = r.pick([10, 20, 25, 40, 50]), inches = r.pick([1.5, 2.5, 3, 3.5, 4.5, 6, 7.5]);
    const ans = scale * inches;
    return {
      stem: 'On a map, 1 inch represents ' + scale + ' miles. Two towns are ' + inches + ' inches apart on the map. What is the actual distance, in miles, between the two towns?',
      ...G.mcNum(r, ans, [
        { v: G.clean(scale / inches), why: 'This divides instead of multiplying.' },
        { v: scale + inches, why: 'This adds the scale and the map distance.' },
        { v: scale * Math.floor(inches), why: 'This ignores the fractional part of the map distance.' },
      ], { step: 5 }),
      num: ans,
      explanation: P('Each inch on the map represents ' + scale + ' miles, so ' + m(inches + '\\text{ in}\\times ' + scale + '\\,\\frac{\\text{mi}}{\\text{in}} = ' + nt(ans)) + ' miles.'),
    };
  });

  add('rat', 'M', (r) => {
    const yards = r.int(8, 60), askSq = r.bool(0.7);
    if (askSq) {
      return {
        stem: 'The floor of a room has an area of ' + yards + ' square yards. What is the area of the floor, in square feet? (1 yard = 3 feet)',
        ...G.mcNum(r, yards * 9, [
          { v: yards * 3, why: 'This converts yards to feet only once. A square yard is 3 feet by 3 feet, which is 9 square feet.' },
          { v: G.clean(yards / 3), why: 'This divides by 3 instead of multiplying by 9.' },
          { v: yards * 6, why: 'A square yard contains ' + m('3\\times3 = 9') + ' square feet, not 6.' },
        ]),
        num: yards * 9,
        explanation: P('One square yard is a square 3 feet on each side, so ' + m('1\\text{ yd}^2 = 3\\times3 = 9\\text{ ft}^2') + '.', 'So ' + m(yards + '\\text{ yd}^2 = ' + yards + '\\times 9 = ' + yards * 9 + '\\text{ ft}^2') + '.'),
      };
    }
    return {
      stem: 'A rectangular garden is ' + yards + ' yards long. What is its length in inches? (1 yard = 3 feet and 1 foot = 12 inches)',
      ...G.mcNum(r, yards * 36, [
        { v: yards * 12, why: 'This treats a yard as 12 inches.' },
        { v: yards * 3, why: 'This is the length in feet.' },
        { v: yards * 15, why: 'This adds 3 and 12 instead of multiplying them.' },
      ]),
      num: yards * 36,
      explanation: P(m(yards + '\\text{ yd}\\times 3\\,\\frac{\\text{ft}}{\\text{yd}}\\times 12\\,\\frac{\\text{in}}{\\text{ft}} = ' + yards * 36 + '\\text{ in}') + '.'),
    };
  });

  add('rat', 'H', (r) => {
    const pairs = [[88, 60], [44, 30], [22, 15], [66, 45], [110, 75], [132, 90]];
    const [fps, mph] = r.pick(pairs), toFps = r.bool();
    if (toFps) {
      return {
        stem: 'A train travels at a constant speed of ' + mph + ' miles per hour. What is the train’s speed, in feet per second? (1 mile = 5,280 feet)',
        ...G.mcNum(r, fps, [
          { v: G.clean((mph * 5280) / 60), why: 'This converts hours to minutes but not to seconds.' },
          { v: G.clean(mph * 60 / 5280 * 3600) === fps ? fps * 2 : G.clean((mph * 3600) / 5280), why: 'This multiplies and divides by the conversion factors in the wrong places.' },
          { v: Math.round(mph * 1.5), why: 'This estimates instead of converting both units.' },
        ]),
        num: fps,
        explanation: P('Convert miles to feet and hours to seconds: ' + m(mph + '\\,\\frac{\\text{mi}}{\\text{hr}}\\times\\frac{5{,}280\\text{ ft}}{1\\text{ mi}}\\times\\frac{1\\text{ hr}}{3{,}600\\text{ s}} = \\frac{' + mph + '\\times5{,}280}{3{,}600} = ' + fps) + ' feet per second.'),
      };
    }
    return {
      stem: 'A cyclist rides at a constant speed of ' + fps + ' feet per second. What is the cyclist’s speed, in miles per hour? (1 mile = 5,280 feet)',
      ...G.mcNum(r, mph, [
        { v: G.clean((fps * 60) / 5280 * 100) / 100 === mph ? mph * 2 : G.clean(Math.round((fps * 60 * 100) / 5280) / 100), why: 'This converts seconds to minutes but not to hours.' },
        { v: G.clean(Math.round((fps * 5280) / 3600 * 10) / 10), why: 'This multiplies by 5,280 instead of dividing by it.' },
        { v: fps, why: 'This leaves the speed unconverted.' },
      ]),
      num: mph,
      explanation: P(m(fps + '\\,\\frac{\\text{ft}}{\\text{s}}\\times\\frac{3{,}600\\text{ s}}{1\\text{ hr}}\\times\\frac{1\\text{ mi}}{5{,}280\\text{ ft}} = \\frac{' + fps + '\\times3{,}600}{5{,}280} = ' + mph) + ' miles per hour.'),
    };
  });

  add('rat', 'H', (r) => {
    const dens = r.pick([2.7, 7.8, 8.9, 11.3, 19.3]), e = r.pick([10, 20]);
    const vol = e * e * e, kg = G.clean((dens * vol) / 1000);
    return {
      stem: 'A solid cube made of a certain metal has edges of length ' + e + ' centimeters. The metal has a density of ' + dens + ' grams per cubic centimeter. What is the mass of the cube, in kilograms? (1 kilogram = 1,000 grams)',
      ...G.mcNum(r, kg, [
        { v: G.clean(dens * vol), why: 'This is the mass in grams; divide by 1,000 to convert to kilograms.' },
        { v: G.clean((dens * e * e) / 1000), why: 'This uses the area of one face instead of the volume of the cube.' },
        { v: G.clean((dens * e * 3) / 1000 * 100) / 100 || kg + 1, why: 'This multiplies the edge length by 3 instead of cubing it.' },
      ], { step: 0.1 }),
      num: kg,
      explanation: P('Volume: ' + m(e + '^3 = ' + nt(vol) + '\\text{ cm}^3') + '.', 'Mass: ' + m(nt(vol) + '\\times ' + dens + ' = ' + nt(G.clean(dens * vol)) + '\\text{ g}') + '.', 'Convert: ' + m('\\frac{' + nt(G.clean(dens * vol)) + '}{1{,}000} = ' + kg + '\\text{ kg}') + '.'),
    };
  });

  add('rat', 'H', (r) => {
    const a = r.pick([8, 10, 12, 15, 20]), bpm = r.pick([5, 6, 10, 15, 18]), T = r.pick([20, 30, 40, 45, 60, 90]);
    const bph = bpm * 60, total = (a + bpm) * T;
    return {
      stem: 'Pump A removes water from a flooded basement at a rate of ' + a + ' gallons per minute. Pump B removes water at a rate of ' + nw(bph) + ' gallons per hour. If both pumps run at the same time, how many minutes will it take them to remove ' + nw(total) + ' gallons of water?',
      ...G.mcNum(r, T, [
        { v: G.clean(Math.round((total / (a + bph)) * 100) / 100), why: 'This adds a rate in gallons per minute to a rate in gallons per hour without converting.' },
        { v: G.clean(total / a), why: 'This uses only pump A’s rate.' },
        { v: G.clean((total / (a + bpm)) * 2) , why: 'Check the combined rate: ' + m(a + ' + ' + bpm + ' = ' + (a + bpm)) + ' gallons per minute.' },
      ]),
      num: T,
      explanation: P('Convert pump B’s rate: ' + m('\\frac{' + nt(bph) + '}{60} = ' + bpm) + ' gallons per minute.', 'Combined rate: ' + m(a + ' + ' + bpm + ' = ' + (a + bpm)) + ' gallons per minute.', 'Time: ' + m('\\frac{' + nt(total) + '}{' + (a + bpm) + '} = ' + T) + ' minutes.'),
    };
  });

  /* ================================================== pct: percentages */
  add('pct', 'E', (r) => {
    const p = r.pick([5, 10, 12, 15, 20, 25, 30, 35, 40, 45, 60, 75, 80]), n = r.pick([40, 60, 80, 120, 140, 160, 200, 240, 250, 300, 360, 400, 480, 500]);
    const ans = G.clean((p * n) / 100);
    return {
      stem: 'What is ' + p + '% of ' + n + '?',
      ...G.mcNum(r, ans, [
        { v: G.clean(n / p), why: 'This divides ' + n + ' by ' + p + ' instead of multiplying by ' + m(p / 100) + '.' },
        { v: G.clean(n - ans), why: 'This is ' + (100 - p) + '% of ' + n + ', the amount that remains.' },
        { v: G.clean((p * n) / 10), why: 'This multiplies by ' + m(p / 10) + ' instead of ' + m(p / 100) + '.' },
      ]),
      num: ans,
      explanation: P(p + '% means ' + m('\\frac{' + p + '}{100}') + ', so ' + m(p / 100 + '\\times ' + n + ' = ' + nt(ans)) + '.'),
    };
  });

  add('pct', 'E', (r) => {
    const b = r.pick([20, 25, 40, 50, 80, 120, 160, 200, 250, 400]), p = r.pick([5, 10, 15, 20, 30, 35, 40, 45, 60, 75, 80, 90]);
    const a = (p * b) / 100;
    if (!isInt(a)) return G.gens.pct.E[0](r);
    const ctx = r.pick([
      (B, A) => 'Of the ' + B + ' students in a school band, ' + A + ' play a brass instrument. What percent of the students in the band play a brass instrument?',
      (B, A) => 'Of the ' + B + ' trees in a park, ' + A + ' are oaks. What percent of the trees in the park are oaks?',
      (B, A) => 'Of the ' + B + ' emails a person received this week, ' + A + ' were marked as spam. What percent of the emails were marked as spam?',
    ]);
    return {
      stem: ctx(b, a),
      ...G.mcNum(r, p, [
        isInt((b / a) * 100) && (b / a) * 100 !== p ? { v: (b / a) * 100, why: 'This divides the total by the part instead of the part by the total.' } : { v: 100 - p, why: 'This is the percent that do <i>not</i> fit the description.' },
        { v: a, why: 'This is the count, not the percent.' },
        { v: 100 - p, why: 'This is the percent that do <i>not</i> fit the description.' },
      ]),
      num: p,
      explanation: P('Percent = ' + m('\\frac{\\text{part}}{\\text{whole}}\\times 100 = \\frac{' + a + '}{' + b + '}\\times 100 = ' + p) + '%.'),
    };
  });

  add('pct', 'M', (r) => {
    const P0 = r.pick([40, 50, 60, 80, 120, 150, 200, 250]), up = r.pick([10, 20, 25, 30, 50]), down = r.pick([10, 20, 25, 40]);
    const ans = G.clean(P0 * (1 + up / 100) * (1 - down / 100));
    return {
      stem: 'The price of a jacket was ' + G.money(P0) + '. The price was increased by ' + up + '%, and then the new price was decreased by ' + down + '%. What is the final price of the jacket, in dollars?',
      ...G.mcNum(r, ans, [
        { v: G.clean(P0 * (1 + (up - down) / 100)), why: 'This combines the percents into a single ' + (up - down) + '% change, but the second percent applies to the <i>new</i> price.' },
        { v: G.clean(P0 * (1 + up / 100)), why: 'This is the price after the increase only.' },
        { v: G.clean(P0 * (1 - down / 100)), why: 'This applies only the decrease.' },
      ]),
      num: ans,
      explanation: P('After the increase: ' + m(nt(P0) + '(1 + ' + up / 100 + ') = ' + nt(G.clean(P0 * (1 + up / 100)))) + '.', 'After the decrease: ' + m(nt(G.clean(P0 * (1 + up / 100))) + '(1 - ' + down / 100 + ') = ' + nt(ans)) + '.', 'Successive percent changes multiply; they do not simply add.'),
    };
  });

  add('pct', 'M', (r) => {
    const d = r.pick([10, 15, 20, 25, 30, 40]), O = r.pick([20, 40, 60, 80, 120, 160, 200]);
    const S = G.clean(O * (1 - d / 100));
    return {
      stem: 'During a sale, every item in a store is discounted by ' + d + '%. The sale price of a pair of shoes is ' + G.money(S) + '. What was the original price, in dollars, of the shoes?',
      ...G.mcNum(r, O, [
        { v: G.clean(S * (1 + d / 100)), why: 'This increases the sale price by ' + d + '%, but the discount was ' + d + '% of the <i>original</i> price.' },
        { v: G.clean(S + d), why: 'This adds ' + d + ' dollars instead of undoing a ' + d + '% discount.' },
        { v: G.clean(S * (1 - d / 100)), why: 'This discounts the sale price again.' },
      ]),
      num: O,
      explanation: P('A ' + d + '% discount leaves ' + (100 - d) + '% of the original price: ' + m((1 - d / 100) + 'x = ' + nt(S)) + '.', 'So ' + m('x = \\frac{' + nt(S) + '}{' + (1 - d / 100) + '} = ' + nt(O)) + '.'),
    };
  });

  add('pct', 'M', (r) => {
    const A = r.pick([40, 50, 60, 80, 120, 150, 200, 250, 400]), p = r.pick([10, 15, 20, 25, 30, 40, 50, 60, 75]);
    const inc = r.bool(0.6), B = inc ? A * (1 + p / 100) : A * (1 - p / 100);
    if (!isInt(B)) return G.gens.pct.M[0](r);
    return {
      stem: 'The number of members in a hiking club ' + (inc ? 'increased' : 'decreased') + ' from ' + A + ' to ' + B + '. By what percent did the number of members ' + (inc ? 'increase' : 'decrease') + '?',
      ...G.mcNum(r, p, [
        { v: Math.abs(B - A), why: 'This is the change in the number of members, not the percent change.' },
        isInt((Math.abs(B - A) / B) * 100) ? { v: (Math.abs(B - A) / B) * 100, why: 'This divides the change by the new value instead of the original value.' } : { v: G.clean(Math.round((Math.abs(B - A) / B) * 1000) / 10), why: 'This divides the change by the new value instead of the original value.' },
        { v: G.clean((B / A) * 100), why: 'This is the new value as a percent of the original, not the percent change.' },
      ]),
      num: p,
      explanation: P('Percent change = ' + m('\\frac{\\text{change}}{\\text{original}}\\times 100 = \\frac{' + Math.abs(B - A) + '}{' + A + '}\\times 100 = ' + p) + '%.'),
    };
  });

  add('pct', 'H', (r) => {
    const combos = [[40, 25], [20, 25], [50, 20], [25, 20], [60, 25], [10, 10], [30, 20], [50, 40], [20, 50], [80, 25]];
    const [p, q] = r.pick(combos), ans = G.clean((1 + p / 100) * (1 - q / 100) * 100);
    return {
      stem: 'The value of ' + m('A') + ' is ' + p + '% greater than the value of ' + m('B') + ', and the value of ' + m('B') + ' is ' + q + '% less than the value of ' + m('C') + '. The value of ' + m('A') + ' is what percent of the value of ' + m('C') + '?',
      ...G.mcNum(r, ans, [
        { v: 100 + p - q, why: 'This adds and subtracts the percents, but they apply to different base values and must be multiplied.' },
        { v: G.clean((1 + p / 100) * (1 + q / 100) * 100), why: 'This treats ' + m('B') + ' as ' + q + '% <i>greater</i> than ' + m('C') + '.' },
        { v: p + q, why: 'This adds the two percents.' },
      ]),
      num: ans,
      explanation: P(m('A = ' + (1 + p / 100) + 'B') + ' and ' + m('B = ' + (1 - q / 100) + 'C') + '.', 'Substitute: ' + m('A = ' + (1 + p / 100) + '(' + (1 - q / 100) + 'C) = ' + G.clean((1 + p / 100) * (1 - q / 100)) + 'C') + '.', 'So ' + m('A') + ' is ' + ans + '% of ' + m('C') + '.'),
    };
  });

  add('pct', 'H', (r) => {
    const p = r.pick([20, 25, 30, 40, 60, 75]), q = r.pick([15, 30, 45, 50, 60, 90]), Y = r.pick([40, 60, 80, 120, 200]);
    const x = (q * Y) / p;
    if (!isInt(x) || p === q) return G.gens.pct.E[0](r);
    return {
      stem: 'If ' + p + '% of ' + m('x') + ' is equal to ' + q + '% of ' + Y + ', what is the value of ' + m('x') + '?',
      ...G.mcNum(r, x, [
        isInt((p * Y) / q) ? { v: (p * Y) / q, why: 'This swaps the two percents.' } : { v: G.clean(Math.round((p * Y) / q * 10) / 10), why: 'This swaps the two percents.' },
        { v: G.clean((q * Y) / 100), why: 'This is ' + q + '% of ' + Y + ', not ' + m('x') + '.' },
        { v: Y + q - p, why: 'This adjusts ' + Y + ' by the difference in percents.' },
      ]),
      num: x,
      explanation: P('Write the equation: ' + m(p / 100 + 'x = ' + q / 100 + '(' + Y + ') = ' + G.clean((q * Y) / 100)) + '.', 'Divide by ' + m(p / 100) + ': ' + m('x = ' + nt(x)) + '.'),
    };
  });

  add('pct', 'H', (r) => {
    const p = r.pick([10, 20, 25, 30, 40, 50]);
    const ans = G.clean((p * p) / 100);
    return {
      stem: 'The population of a town increased by ' + p + '% from 2010 to 2015 and then decreased by ' + p + '% from 2015 to 2020. The population in 2020 was what percent less than the population in 2010?',
      ...G.mcNum(r, ans, [
        { v: 0, why: 'A ' + p + '% decrease of the larger 2015 population removes more people than the ' + p + '% increase added.' },
        { v: p, why: 'This is the size of each individual change, not the overall change.' },
        { v: 2 * p, why: 'This adds the two changes.' },
      ]),
      num: ans,
      explanation: P('Let the 2010 population be ' + m('x') + '. In 2015 it was ' + m((1 + p / 100) + 'x') + ', and in 2020 it was ' + m((1 + p / 100) + '(' + (1 - p / 100) + ')x = ' + G.clean((1 + p / 100) * (1 - p / 100)) + 'x') + '.',
        'That is ' + G.clean((1 + p / 100) * (1 - p / 100) * 100) + '% of the 2010 population, which is ' + ans + '% less.'),
    };
  });

  /* ============================================= one: one-variable data */
  add('one', 'E', (r) => {
    const n = r.pick([5, 6, 7]);
    let vals, mean;
    for (let i = 0; i < 100; i++) { vals = Array.from({ length: n }, () => r.int(2, 30)); mean = sum(vals) / n; if (isInt(mean)) break; }
    if (!isInt(mean)) { vals = [4, 8, 10, 12, 16]; mean = 10; }
    const med = median(vals);
    return {
      stem: 'What is the mean of the data set ' + m(vals.join(',\\ ')) + '?',
      ...G.mcNum(r, mean, [
        med !== mean ? { v: med, why: 'This is the median of the data set.' } : null,
        { v: sum(vals), why: 'This is the sum of the values; divide by the number of values, ' + n + '.' },
        { v: Math.max(...vals) - Math.min(...vals), why: 'This is the range of the data set.' },
      ].filter(Boolean)),
      num: mean,
      explanation: P('Mean = ' + m('\\frac{\\text{sum}}{\\text{count}} = \\frac{' + vals.join(' + ') + '}{' + n + '} = \\frac{' + sum(vals) + '}{' + n + '} = ' + mean) + '.'),
    };
  });

  add('one', 'E', (r) => {
    const n = r.pick([7, 8, 9]), vals = Array.from({ length: n }, () => r.int(1, 40));
    const med = median(vals), sorted = vals.slice().sort((a, b) => a - b);
    const mid = n % 2 ? sorted[(n - 1) / 2] : null;
    return {
      stem: 'What is the median of the data set ' + m(vals.join(',\\ ')) + '?',
      ...G.mcNum(r, med, [
        { v: n % 2 ? vals[(n - 1) / 2] : (vals[n / 2 - 1] + vals[n / 2]) / 2, why: 'This is the middle of the list as written; the values must be put in order first.' },
        { v: G.clean(Math.round((sum(vals) / n) * 10) / 10), why: 'This is (about) the mean of the data set.' },
        { v: sorted[n - 1] - sorted[0], why: 'This is the range of the data set.' },
      ], { step: 0.5 }),
      num: med,
      explanation: P('Order the values: ' + m(sorted.join(',\\ ')) + '.', n % 2 ? 'With ' + n + ' values, the median is the ' + (n + 1) / 2 + 'th value: ' + m(mid) + '.' : 'With ' + n + ' values, the median is the mean of the ' + n / 2 + 'th and ' + (n / 2 + 1) + 'th values: ' + m('\\frac{' + sorted[n / 2 - 1] + ' + ' + sorted[n / 2] + '}{2} = ' + nt(med)) + '.'),
    };
  });

  add('one', 'M', (r) => {
    const vals = [], start = r.int(0, 3), k = r.pick([4, 5]);
    for (let i = 0; i < k; i++) vals.push(start + i);
    const freqs = vals.map(() => r.int(1, 8));
    const N = sum(freqs), data = [];
    vals.forEach((v, i) => { for (let j = 0; j < freqs[i]; j++) data.push(v); });
    const med = median(data), askMean = r.bool(0.4), meanV = sum(data) / N;
    if (askMean && !isInt(meanV * 10)) return G.gens.one.M[0](r);
    const ctx = r.pick(['number of pets owned by each student in a class', 'number of books each member of a reading club read last month', 'number of siblings of each person in a survey']);
    const table = F.table({ cols: ['Value', 'Frequency'], rows: vals.map((v, i) => [v, freqs[i]]), rowHeads: false });
    const ans = askMean ? G.clean(meanV) : med;
    return {
      stem: 'The frequency table summarizes the ' + ctx + '. What is the ' + (askMean ? 'mean' : 'median') + ' of the data?',
      figure: table,
      ...G.mcNum(r, ans, askMean ? [
        { v: G.clean(sum(vals) / vals.length), why: 'This averages the distinct values without accounting for how often each occurs.' },
        { v: med, why: 'This is the median of the data.' },
        { v: G.clean(N / vals.length), why: 'This averages the frequencies.' },
      ] : [
        { v: vals[freqs.indexOf(Math.max(...freqs))] === med ? G.clean(median(vals)) : vals[freqs.indexOf(Math.max(...freqs))], why: 'This is the most frequent value (the mode), not necessarily the median.' },
        { v: G.clean(median(vals)), why: 'This is the median of the distinct values, ignoring the frequencies.' },
        { v: G.clean(median(freqs)), why: 'This is the median of the frequencies.' },
      ], { step: 0.5 }),
      num: ans,
      explanation: askMean
        ? P('Multiply each value by its frequency and add: ' + m(vals.map((v, i) => v + '(' + freqs[i] + ')').join(' + ') + ' = ' + sum(data)) + '.', 'Divide by the total frequency, ' + N + ': ' + m('\\frac{' + sum(data) + '}{' + N + '} = ' + nt(ans)) + '.')
        : P('There are ' + m(N) + ' data values in all.', N % 2 ? 'The median is the ' + (N + 1) / 2 + 'th value in order. Counting through the table, that value is ' + m(med) + '.' : 'The median is the mean of the ' + N / 2 + 'th and ' + (N / 2 + 1) + 'th values in order. Counting through the table, those are ' + m(data[N / 2 - 1]) + ' and ' + m(data[N / 2]) + ', so the median is ' + m(nt(med)) + '.'),
    };
  });

  add('one', 'M', (r) => {
    let vals, before, after, big;
    for (let i = 0; i < 200; i++) {
      vals = Array.from({ length: 7 }, () => r.int(10, 30)).sort((a, b) => a - b);
      big = r.int(70, 99); vals[6] = big;
      before = median(vals); after = median(vals.slice(0, 6));
      if (r.bool() ? after === before : after < before) break;
    }
    const sameMed = after === before;
    const choices = ['Both the mean and the median will decrease.', 'The mean will decrease, but the median will stay the same.', 'The median will decrease, but the mean will stay the same.', 'Neither the mean nor the median will change.'];
    const ans = sameMed ? 1 : 0;
    const shown = r.shuffle(vals.slice());
    return {
      stem: 'A data set consists of the values ' + m(shown.join(',\\ ')) + '. If the value ' + m(big) + ' is removed from the data set, which statement about the mean and median of the remaining values is true?',
      choices, answer: ans,
      notes: choices.map((_, i) => (i === ans ? null : i === 2 || i === 3 ? 'Removing a value far above the mean always lowers the mean.' : sameMed ? 'The two middle values of the remaining six are equal to the original median, so the median does not change.' : 'The median changes from ' + before + ' to ' + after + '.')),
      explanation: P(m(big) + ' is much greater than the other values (an outlier), so removing it lowers the mean.', 'Median before: the 4th of 7 ordered values, ' + m(before) + '. Median after: the mean of the 3rd and 4th of 6 ordered values, ' + m(nt(after)) + '.', sameMed ? 'The median stays the same.' : 'The median decreases from ' + before + ' to ' + nt(after) + '.'),
    };
  });

  add('one', 'M', (r) => {
    const add5 = r.bool(), k = add5 ? r.pick([3, 5, 10, 12]) : r.pick([2, 3]);
    const choices = add5 ? [
      'The mean of B is ' + k + ' greater than the mean of A, and the standard deviations are equal.',
      'The means are equal, and the standard deviation of B is ' + k + ' greater than that of A.',
      'The mean of B is ' + k + ' greater than the mean of A, and the standard deviation of B is ' + k + ' greater than that of A.',
      'The means and the standard deviations are both equal.',
    ] : [
      'The mean of B is ' + k + ' times the mean of A, and the standard deviation of B is ' + k + ' times the standard deviation of A.',
      'The mean of B is ' + k + ' times the mean of A, and the standard deviations are equal.',
      'The means are equal, and the standard deviation of B is ' + k + ' times the standard deviation of A.',
      'The mean of B is ' + k + ' greater than the mean of A, and the standard deviations are equal.',
    ];
    const order = r.shuffle([0, 1, 2, 3]);
    return {
      stem: 'Data set B is created by ' + (add5 ? 'adding ' + k + ' to' : 'multiplying') + ' each value in data set A' + (add5 ? '' : ' by ' + k) + '. Which statement correctly compares the two data sets?',
      choices: order.map((i) => choices[i]),
      answer: order.indexOf(0),
      notes: order.map((i) => (i === 0 ? null : add5 ? 'Adding a constant shifts every value, so the mean shifts by that constant, but the spread (standard deviation) does not change.' : 'Multiplying every value by a constant multiplies both the center and the spread by that constant.')),
      explanation: P(add5 ? 'Adding ' + k + ' to every value moves the whole distribution ' + k + ' units to the right. The center moves (the mean increases by ' + k + '), but the distances between values do not change, so the standard deviation is unchanged.'
        : 'Multiplying every value by ' + k + ' stretches the distribution. The mean is multiplied by ' + k + ', and every distance from the mean is multiplied by ' + k + ', so the standard deviation is also multiplied by ' + k + '.'),
    };
  });

  add('one', 'M', (r) => {
    const counts = {}, lo = r.int(0, 2), hi = lo + r.int(4, 6);
    for (let v = lo; v <= hi; v++) counts[v] = r.int(0, 5);
    counts[lo + 1] = Math.max(1, counts[lo + 1]);
    const data = []; Object.keys(counts).map(Number).sort((a, b) => a - b).forEach((v) => { for (let j = 0; j < counts[v]; j++) data.push(v); });
    if (data.length < 5) return G.gens.one.M[0](r);
    const med = median(data);
    const fig = F.dotplot({ counts, min: lo, max: hi, xlabel: 'Number of hours of volunteer work' });
    return {
      stem: 'The dot plot shows the number of hours of volunteer work completed last week by each member of a club. What is the median number of hours?',
      figure: fig,
      ...G.mcNum(r, med, [
        { v: G.clean((lo + hi) / 2), why: 'This is the middle of the number line, not the middle of the data.' },
        { v: G.clean(Math.round((sum(data) / data.length) * 10) / 10), why: 'This is (about) the mean.' },
        { v: Number(Object.keys(counts).find((k) => counts[k] === Math.max(...Object.values(counts)))), why: 'This is the mode (the tallest stack of dots).' },
      ], { step: 0.5 }),
      num: med,
      explanation: P('There are ' + m(data.length) + ' dots. In order, the values are ' + m(data.join(',\\ ')) + '.', data.length % 2 ? 'The median is the ' + (data.length + 1) / 2 + 'th value: ' + m(nt(med)) + '.' : 'The median is the mean of the ' + data.length / 2 + 'th and ' + (data.length / 2 + 1) + 'th values: ' + m(nt(med)) + '.'),
    };
  });

  add('one', 'H', (r) => {
    const n = r.int(6, 12), m1 = r.int(12, 40), m2 = m1 + r.pick([-3, -2, -1, 1, 2]);
    const removed = n * m1 - (n - 1) * m2;
    if (removed <= 0) return G.gens.one.H[0](r);
    return {
      stem: 'The mean of ' + n + ' numbers is ' + m1 + '. When one of the numbers is removed, the mean of the remaining ' + (n - 1) + ' numbers is ' + m2 + '. What number was removed?',
      ...G.mcNum(r, removed, [
        { v: Math.abs(m1 - m2), why: 'This is the change in the mean, not the removed number.' },
        { v: n * (m1 - m2) + m2 === removed ? removed + n : n * Math.abs(m1 - m2), why: 'This multiplies the change in the mean by ' + n + ' but ignores the remaining sum.' },
        { v: m1, why: 'Removing a number equal to the mean would not change the mean.' },
      ]),
      num: removed,
      explanation: P('Sum of all ' + n + ' numbers: ' + m(n + '\\times ' + m1 + ' = ' + n * m1) + '.', 'Sum of the remaining ' + (n - 1) + ' numbers: ' + m((n - 1) + '\\times ' + m2 + ' = ' + (n - 1) * m2) + '.', 'The removed number is the difference: ' + m(n * m1 + ' - ' + (n - 1) * m2 + ' = ' + removed) + '.'),
    };
  });

  add('one', 'H', (r) => {
    let n1, n2, a, b, comb;
    for (let i = 0; i < 300; i++) {
      n1 = r.int(10, 30); n2 = r.int(10, 30); a = r.int(70, 95); b = r.int(70, 95);
      comb = (n1 * a + n2 * b) / (n1 + n2);
      if (a !== b && n1 !== n2 && isInt(comb * 10)) break;
    }
    comb = G.clean(comb);
    return {
      stem: 'In a science course, the mean score on a test for the ' + n1 + ' students in Section 1 was ' + a + '. The mean score for the ' + n2 + ' students in Section 2 was ' + b + '. What was the mean score for all ' + (n1 + n2) + ' students?',
      ...G.mcNum(r, comb, [
        { v: G.clean((a + b) / 2), why: 'This averages the two means, but the sections have different numbers of students, so the larger section counts more.' },
        { v: G.clean(Math.round(((n2 * a + n1 * b) / (n1 + n2)) * 10) / 10), why: 'This weights each mean by the size of the <i>other</i> section.' },
        { v: Math.max(a, b), why: 'This is the higher of the two section means.' },
      ], { step: 0.5 }),
      num: comb,
      explanation: P('Total points: ' + m(n1 + '(' + a + ') + ' + n2 + '(' + b + ') = ' + (n1 * a + n2 * b)) + '.', 'Mean: ' + m('\\frac{' + (n1 * a + n2 * b) + '}{' + (n1 + n2) + '} = ' + nt(comb)) + '.'),
    };
  });

  add('one', 'H', (r) => {
    const c = r.int(20, 40), tight = [c - 2, c - 1, c, c, c + 1, c + 2], wide = [c - 9, c - 5, c, c, c + 5, c + 9];
    const kind = r.pick(['AB', 'BA', 'EQ']);
    const A = kind === 'BA' ? wide : tight, B = kind === 'AB' ? wide : kind === 'BA' ? tight : tight.map((v) => v + 6);
    const choices = ['The standard deviation of data set A is greater.', 'The standard deviation of data set B is greater.', 'The standard deviations are equal.', 'The relationship cannot be determined from the information given.'];
    const ans = kind === 'AB' ? 1 : kind === 'BA' ? 0 : 2;
    return {
      stem: 'Data set A: ' + m(r.shuffle(A).join(',\\ ')) + '<br>Data set B: ' + m(r.shuffle(B).join(',\\ ')) + '<br>Which statement correctly compares the standard deviations of the two data sets?',
      choices, answer: ans,
      notes: choices.map((_, i) => (i === ans ? null : i === 3 ? 'Both data sets are given in full, so their spreads can be compared.' : 'Compare how far the values are from each set’s mean.')),
      explanation: P('Standard deviation measures how spread out values are from the mean.', kind === 'EQ' ? 'Data set B is data set A with 6 added to every value. Shifting all values by the same amount does not change their spread, so the standard deviations are equal.'
        : 'Both sets have a mean of ' + c + ', but the values in data set ' + (kind === 'AB' ? 'B' : 'A') + ' are farther from the mean, so data set ' + (kind === 'AB' ? 'B' : 'A') + ' has the greater standard deviation.'),
    };
  });

  /* ============================================= two: two-variable data */
  const fitCtx = [
    { x: 'Hours studied', y: 'Test score', xs: 'the number of hours a student studied', ys: 'the student’s test score', unitY: 'points', m: [3, 4, 5, 6], b: [52, 55, 58, 60], xr: [0, 8] },
    { x: 'Temperature (°F)', y: 'Iced drinks sold', xs: 'the daily high temperature, in degrees Fahrenheit', ys: 'the number of iced drinks a café sold that day', unitY: 'drinks', m: [2, 3, 4], b: [-80, -100, -120], xr: [60, 95] },
    { x: 'Age of tree (years)', y: 'Height (feet)', xs: 'the age of a tree, in years', ys: 'the tree’s height, in feet', unitY: 'feet', m: [1.5, 2, 2.5], b: [2, 4, 5], xr: [2, 16] },
  ];
  function scatterFor(r, c, mm, b) {
    const pts = [];
    for (let i = 0; i < 10; i++) {
      const x = G.clean(c.xr[0] + ((c.xr[1] - c.xr[0]) * (i + 0.5)) / 10 + (r() - 0.5));
      pts.push([x, G.clean(mm * x + b + (r() - 0.5) * (c.xr[1] - c.xr[0]) * mm * 0.18)]);
    }
    const ys = pts.map((p) => p[1]);
    const y0 = Math.max(0, Math.floor(Math.min(...ys) / 10) * 10 - 10), y1 = Math.ceil(Math.max(...ys) / 10) * 10 + 10;
    return F.scatter({ points: pts, fit: [mm, b], x0: c.xr[0], x1: c.xr[1], y0, y1, xlabel: c.x, ylabel: c.y, id: 'f' + Math.floor(r() * 1e6) });
  }
  add('two', 'E', (r) => {
    const c = r.pick(fitCtx), mm = r.pick(c.m), b = r.pick(c.b);
    const x = r.int(Math.ceil(c.xr[0] + 1), Math.floor(c.xr[1] - 1)), ans = G.clean(mm * x + b);
    return {
      stem: 'The scatterplot shows the relationship between ' + c.xs + ' and ' + c.ys + ' for 10 observations. The line of best fit is also shown, and an equation of the line is ' + m('y = ' + G.lin(mm, b)) + '. Based on the line of best fit, what is the predicted value of ' + m('y') + ' when ' + m('x = ' + x) + '?',
      figure: scatterFor(r, c, mm, b),
      ...G.mcNum(r, ans, [
        { v: G.clean(mm * x), why: 'This omits the ' + m('y') + '-intercept, ' + m(nt(b)) + '.' },
        { v: G.clean(mm * x - b), why: 'This uses the wrong sign for the ' + m('y') + '-intercept.' },
        { v: G.clean(mm + x + b), why: 'This adds the slope to ' + m('x') + ' instead of multiplying.' },
      ], { step: Number.isInteger(mm) ? 1 : 0.5 }),
      num: ans,
      explanation: P('Substitute ' + m('x = ' + x) + ' into the equation of the line: ' + m('y = ' + nt(mm) + '(' + x + ')' + G.sgn(b) + ' = ' + nt(ans)) + '.'),
    };
  });

  add('two', 'M', (r) => {
    const c = r.pick(fitCtx), mm = r.pick(c.m), b = r.pick(c.b), askSlope = r.bool(0.7);
    const perX = c.xs.replace(/^the number of hours a student studied$/, 'additional hour studied').replace(/^the daily high temperature, in degrees Fahrenheit$/, 'increase of 1 degree Fahrenheit in the daily high temperature').replace(/^the age of a tree, in years$/, 'additional year of age');
    if (askSlope) {
      return {
        stem: 'A line of best fit for data about ' + c.xs + ', ' + m('x') + ', and ' + c.ys + ', ' + m('y') + ', is ' + m('y = ' + G.lin(mm, b)) + '. Which of the following is the best interpretation of ' + m(nt(mm)) + ' in this context?',
        ...G.mcText(r, 'For each ' + perX + ', the predicted value of ' + c.ys.replace(/^the /, 'the ') + ' increases by ' + nt(mm) + ' ' + c.unitY + '.', [
          { t: 'The predicted value of ' + c.ys + ' when ' + m('x = 0') + ' is ' + nt(mm) + ' ' + c.unitY + '.', why: 'That describes the ' + m('y') + '-intercept, ' + m(nt(b)) + '.' },
          { t: 'For each increase of ' + nt(mm) + ' in ' + c.xs + ', the predicted value of ' + c.ys + ' increases by 1 ' + c.unitY.replace(/s$/, '') + '.', why: 'This reverses the roles of ' + m('x') + ' and ' + m('y') + ' in the slope.' },
          { t: 'Every observation increases by exactly ' + nt(mm) + ' ' + c.unitY + '.', why: 'A line of best fit describes a predicted trend, not exact values for every observation.' },
        ]),
        explanation: P('The slope of a line of best fit is the predicted change in ' + m('y') + ' for each increase of 1 in ' + m('x') + '. Here, for each ' + perX + ', ' + c.ys + ' is predicted to increase by ' + nt(mm) + ' ' + c.unitY + '.'),
      };
    }
    return {
      stem: 'A line of best fit for data about ' + c.xs + ', ' + m('x') + ', and ' + c.ys + ', ' + m('y') + ', is ' + m('y = ' + G.lin(mm, b)) + '. What is the predicted value of ' + m('y') + ' when ' + m('x = 0') + '?',
      ...G.mcNum(r, b, [
        { v: mm, why: 'This is the slope, the predicted change in ' + m('y') + ' per unit of ' + m('x') + '.' },
        { v: -b, why: 'This has the wrong sign.' },
        { v: G.clean(mm + b), why: 'This is the predicted value when ' + m('x = 1') + '.' },
      ]),
      num: b,
      explanation: P('When ' + m('x = 0') + ', ' + m('y = ' + nt(mm) + '(0)' + G.sgn(b) + ' = ' + nt(b)) + '. This is the ' + m('y') + '-intercept of the line of best fit.'),
    };
  });

  add('two', 'M', (r) => {
    const mm = r.pick([-3, -2, -1.5, -1, 1, 1.5, 2, 3]), b = r.int(2, 8) * (mm < 0 ? 3 : 1);
    const pts = [];
    for (let i = 0; i < 10; i++) { const x = i + 0.5 + (r() - 0.5) * 0.6; pts.push([G.clean(x), G.clean(mm * x + b + (r() - 0.5) * 3)]); }
    const ys = pts.map((p) => p[1]).concat([b, mm * 10 + b]);
    const y0 = Math.floor(Math.min(0, ...ys) / 5) * 5, y1 = Math.ceil(Math.max(...ys) / 5) * 5 + 5;
    const fig = F.scatter({ points: pts, x0: 0, x1: 10, y0, y1, xlabel: 'x', ylabel: 'y' });
    return {
      stem: 'Which of the following equations best models the data shown in the scatterplot?',
      figure: fig,
      ...G.mcText(r, 'y = ' + G.lin(mm, b), [
        { t: 'y = ' + G.lin(-mm, b), why: 'The data ' + (mm > 0 ? 'increase' : 'decrease') + ' from left to right, so the slope must be ' + (mm > 0 ? 'positive' : 'negative') + '.' },
        { t: 'y = ' + G.lin(mm, -b), why: 'The data suggest a ' + m('y') + '-intercept near ' + m(nt(b)) + ', not ' + m(nt(-b)) + '.' },
        { t: 'y = ' + G.lin(-mm, -b), why: 'Both the slope and the ' + m('y') + '-intercept have the wrong sign.' },
      ], { math: true }),
      explanation: P('The points trend ' + (mm > 0 ? 'upward' : 'downward') + ', so the slope is ' + (mm > 0 ? 'positive' : 'negative') + '. Extending the trend back to ' + m('x = 0') + ' gives a ' + m('y') + '-value near ' + m(nt(b)) + '.', 'Only ' + m('y = ' + G.lin(mm, b)) + ' has both features.'),
    };
  });

  add('two', 'H', (r) => {
    const a = r.pick([2, 3, 4, 5, 10]), bse = r.pick([2, 3, 4]), xs = [0, 1, 2, 3];
    const ys = xs.map((x) => a * Math.pow(bse, x));
    const table = F.table({ cols: [m('x'), m('y')], rows: xs.map((x, i) => [m(x), m(nt(ys[i]))]), rowHeads: false });
    const d1 = ys[1] - ys[0];
    return {
      stem: 'The table shows four values of ' + m('x') + ' and their corresponding values of ' + m('y') + '. Which equation could represent the relationship between ' + m('x') + ' and ' + m('y') + '?',
      figure: table,
      ...G.mcText(r, 'y = ' + a + '(' + bse + ')^x', [
        { t: 'y = ' + G.lin(d1, a), why: 'This linear equation fits the first two rows only; ' + m('y') + ' is multiplied by ' + bse + ' each time, not increased by a constant amount.' },
        a !== bse ? { t: 'y = ' + bse + '(' + a + ')^x', why: 'This swaps the initial value and the growth factor; at ' + m('x = 0') + ' it gives ' + m('y = ' + bse) + '.' }
          : { t: 'y = ' + a * bse + '(' + bse + ')^x', why: 'This uses the value of ' + m('y') + ' at ' + m('x = 1') + ' as the initial value; at ' + m('x = 0') + ' it gives ' + m('y = ' + a * bse) + '.' },
        { t: 'y = ' + a + 'x^' + bse, why: 'At ' + m('x = 0') + ' this gives ' + m('y = 0') + ', not ' + m(a) + '.' },
      ], { math: true }),
      explanation: P('Each time ' + m('x') + ' increases by 1, ' + m('y') + ' is multiplied by ' + m(bse) + ' (for example, ' + m(nt(ys[2]) + '\\div' + nt(ys[1]) + ' = ' + bse) + '). A constant multiplier means an exponential relationship.',
        'At ' + m('x = 0') + ', ' + m('y = ' + a) + ', so the initial value is ' + m(a) + ': ' + m('y = ' + a + '(' + bse + ')^x') + '.'),
    };
  });

  add('two', 'H', (r) => {
    const c = r.pick(fitCtx), mm = r.pick(c.m), b = r.pick(c.b);
    const x = r.int(Math.ceil(c.xr[0] + 1), Math.floor(c.xr[1] - 1)), pred = G.clean(mm * x + b);
    const resid = r.pick([-6, -5, -4, -3, 3, 4, 5, 6, 7, 8]), actual = G.clean(pred + resid);
    return {
      stem: 'For a set of data, ' + m('x') + ' represents ' + c.xs + ' and ' + m('y') + ' represents ' + c.ys + '. The line of best fit for the data is ' + m('y = ' + G.lin(mm, b)) + '. One observation in the data set is ' + m('(' + x + ', ' + nt(actual) + ')') + '. What is the difference between the actual value of ' + m('y') + ' for this observation and the value predicted by the line of best fit (actual minus predicted)?',
      ...G.mcNum(r, resid, [
        { v: -resid, why: 'This is predicted minus actual.' },
        { v: pred, why: 'This is the predicted value, not the difference.' },
        { v: G.clean(actual - mm * x), why: 'This omits the ' + m('y') + '-intercept from the prediction.' },
      ], { allowNeg: true }),
      num: resid,
      explanation: P('Predicted value at ' + m('x = ' + x) + ': ' + m(nt(mm) + '(' + x + ')' + G.sgn(b) + ' = ' + nt(pred)) + '.', 'Actual minus predicted: ' + m(nt(actual) + ' - ' + G.paren(pred) + ' = ' + nt(resid)) + '. (This difference is called the <i>residual</i>.)'),
    };
  });

  /* ================================================ prob: probability */
  add('prob', 'E', (r) => {
    const cnt = [r.int(3, 12), r.int(3, 12), r.int(3, 12)], names = ['red', 'blue', 'green'], i = r.int(0, 2), N = sum(cnt);
    return {
      stem: 'A bag contains ' + cnt[0] + ' red marbles, ' + cnt[1] + ' blue marbles, and ' + cnt[2] + ' green marbles. If one marble is selected at random, what is the probability that it is ' + names[i] + '?',
      ...G.mcNum(r, fracChoice(cnt[i], N), [
        { ...fracChoice(cnt[i], N - cnt[i]), why: 'This divides by the number of marbles that are <i>not</i> ' + names[i] + ' instead of the total.' },
        { ...fracChoice(N - cnt[i], N), why: 'This is the probability that the marble is <i>not</i> ' + names[i] + '.' },
        { ...fracChoice(1, 3), why: 'The three colors are not equally likely because the counts differ.' },
        { ...fracChoice(1, cnt[i]), why: 'This divides 1 by the number of ' + names[i] + ' marbles.' },
        { ...fracChoice(cnt[i], N + cnt[i]), why: 'This adds the ' + names[i] + ' marbles to the total a second time.' },
      ]),
      num: cnt[i] / N,
      explanation: P('Probability = ' + m('\\frac{\\text{favorable outcomes}}{\\text{total outcomes}} = \\frac{' + cnt[i] + '}{' + N + '}' + (G.gcd(cnt[i], N) > 1 ? ' = ' + G.ftex(cnt[i], N) : '')) + '.'),
    };
  });

  const twoWay = [
    { title: 'Class preference by grade', rows: ['Grade 10', 'Grade 11', 'Grade 12'], cols: ['Online', 'In-person'], who: 'student', rowNoun: (x) => 'is in ' + x.toLowerCase(), colNoun: (c) => 'prefers ' + c.toLowerCase() + ' classes' },
    { title: 'Plant growth by fertilizer', rows: ['Fertilizer A', 'Fertilizer B'], cols: ['Flowered', 'Did not flower'], who: 'plant', rowNoun: (x) => 'was given ' + x.replace('Fertilizer', 'fertilizer'), colNoun: (c) => c === 'Flowered' ? 'flowered' : 'did not flower' },
    { title: 'Payment method by age group', rows: ['Under 30', '30 to 50', 'Over 50'], cols: ['Card', 'Cash'], who: 'customer', rowNoun: (x) => 'is ' + (x === 'Under 30' ? 'under 30 years old' : x === 'Over 50' ? 'over 50 years old' : '30 to 50 years old'), colNoun: (c) => 'paid with ' + c.toLowerCase() },
    { title: 'Pet ownership by neighborhood', rows: ['Northside', 'Southside'], cols: ['Owns a dog', 'Does not own a dog'], who: 'resident', rowNoun: (x) => 'lives in ' + x, colNoun: (c) => c === 'Owns a dog' ? 'owns a dog' : 'does not own a dog' },
  ];
  function makeTable(r, c) {
    const cells = c.rows.map(() => c.cols.map(() => r.int(8, 60)));
    const rt = cells.map((row) => sum(row)), ct = c.cols.map((_, j) => sum(cells.map((row) => row[j]))), T = sum(rt);
    const html = F.table({ title: c.title, cols: [''].concat(c.cols, ['Total']), rows: c.rows.map((rw, i) => [rw].concat(cells[i], [rt[i]])).concat([['Total'].concat(ct, [T])]) });
    return { cells, rt, ct, T, html };
  }
  add('prob', 'E', (r) => {
    const c = r.pick(twoWay), t = makeTable(r, c), j = r.int(0, c.cols.length - 1);
    return {
      stem: 'The table summarizes data about ' + t.T + ' ' + c.who + 's. If one of these ' + c.who + 's is selected at random, what is the probability that the ' + c.who + ' ' + c.colNoun(c.cols[j]) + '?',
      figure: t.html,
      ...G.mcNum(r, fracChoice(t.ct[j], t.T), [
        { ...fracChoice(t.ct[1 - j], t.T), why: 'This is the probability of the other column.' },
        { ...fracChoice(t.ct[j], t.ct[1 - j]), why: 'This compares the two columns instead of dividing by the total.' },
        { ...fracChoice(t.cells[0][j], t.T), why: 'This uses only the first row.' },
      ]),
      num: t.ct[j] / t.T,
      explanation: P('Of all ' + t.T + ' ' + c.who + 's, ' + t.ct[j] + ' ' + pl(c.colNoun(c.cols[j])) + ' (the column total).', 'Probability: ' + m('\\frac{' + t.ct[j] + '}{' + t.T + '}' + (G.gcd(t.ct[j], t.T) > 1 ? ' = ' + G.ftex(t.ct[j], t.T) : '')) + '.'),
    };
  });

  add('prob', 'M', (r) => {
    const c = r.pick(twoWay), t = makeTable(r, c), i = r.int(0, c.rows.length - 1), j = r.int(0, c.cols.length - 1);
    return {
      stem: 'The table summarizes data about ' + t.T + ' ' + c.who + 's. If a ' + c.who + ' who ' + c.rowNoun(c.rows[i]) + ' is selected at random, what is the probability that the ' + c.who + ' ' + c.colNoun(c.cols[j]) + '?',
      figure: t.html,
      ...G.mcNum(r, fracChoice(t.cells[i][j], t.rt[i]), [
        { ...fracChoice(t.cells[i][j], t.T), why: 'This divides by the total number of ' + c.who + 's, but the question is limited to those who ' + pl(c.rowNoun(c.rows[i])) + '.' },
        { ...fracChoice(t.cells[i][j], t.ct[j]), why: 'This divides by the column total, which answers a different conditional question.' },
        { ...fracChoice(t.rt[i] - t.cells[i][j], t.rt[i]), why: 'This is the probability of the other column within the same row.' },
      ]),
      num: t.cells[i][j] / t.rt[i],
      explanation: P('The condition limits the group to the ' + t.rt[i] + ' ' + c.who + 's in the row "' + c.rows[i] + '".', 'Of those, ' + t.cells[i][j] + ' ' + pl(c.colNoun(c.cols[j])) + '. Probability: ' + m('\\frac{' + t.cells[i][j] + '}{' + t.rt[i] + '}' + (G.gcd(t.cells[i][j], t.rt[i]) > 1 ? ' = ' + G.ftex(t.cells[i][j], t.rt[i]) : '')) + '.'),
    };
  });

  add('prob', 'M', (r) => {
    const c = r.pick(twoWay), t = makeTable(r, c), i = r.int(0, c.rows.length - 1), j = r.int(0, c.cols.length - 1);
    return {
      stem: 'The table summarizes data about ' + t.T + ' ' + c.who + 's. If one of these ' + c.who + 's is selected at random, what is the probability that the ' + c.who + ' ' + c.rowNoun(c.rows[i]) + ' <i>and</i> ' + c.colNoun(c.cols[j]) + '?',
      figure: t.html,
      ...G.mcNum(r, fracChoice(t.cells[i][j], t.T), [
        { ...fracChoice(t.cells[i][j], t.rt[i]), why: 'This is a conditional probability (given the row), not the probability of both.' },
        { ...fracChoice(t.rt[i] + t.ct[j] - t.cells[i][j], t.T), why: 'This is the probability of one <i>or</i> the other.' },
        { ...fracChoice(t.cells[i][j], t.ct[j]), why: 'This divides by the column total.' },
      ]),
      num: t.cells[i][j] / t.T,
      explanation: P('The ' + c.who + 's who satisfy both conditions are in the cell for row "' + c.rows[i] + '" and column "' + c.cols[j] + '": ' + t.cells[i][j] + '.', 'Probability: ' + m('\\frac{' + t.cells[i][j] + '}{' + t.T + '}' + (G.gcd(t.cells[i][j], t.T) > 1 ? ' = ' + G.ftex(t.cells[i][j], t.T) : '')) + '.'),
    };
  });

  add('prob', 'H', (r) => {
    const c = r.pick(twoWay), t = makeTable(r, c), i = r.int(0, c.rows.length - 1), j = r.int(0, c.cols.length - 1);
    return {
      stem: 'The table summarizes data about ' + t.T + ' ' + c.who + 's. If a ' + c.who + ' who ' + c.colNoun(c.cols[j]) + ' is selected at random, what is the probability that the ' + c.who + ' ' + c.rowNoun(c.rows[i]) + '?',
      figure: t.html,
      ...G.mcNum(r, fracChoice(t.cells[i][j], t.ct[j]), [
        { ...fracChoice(t.cells[i][j], t.rt[i]), why: 'This reverses the condition: it divides by the row total instead of the column total.' },
        { ...fracChoice(t.cells[i][j], t.T), why: 'This divides by the total, ignoring the condition.' },
        { ...fracChoice(t.rt[i], t.T), why: 'This is the probability of the row for all ' + c.who + 's.' },
      ]),
      num: t.cells[i][j] / t.ct[j],
      explanation: P('The condition ("' + c.colNoun(c.cols[j]) + '") restricts the group to the column total: ' + t.ct[j] + ' ' + c.who + 's.', 'Of those, ' + t.cells[i][j] + ' ' + pl(c.rowNoun(c.rows[i])) + '. Probability: ' + m('\\frac{' + t.cells[i][j] + '}{' + t.ct[j] + '}' + (G.gcd(t.cells[i][j], t.ct[j]) > 1 ? ' = ' + G.ftex(t.cells[i][j], t.ct[j]) : '')) + '.'),
    };
  });

  add('prob', 'H', (r) => {
    const c = r.pick(twoWay.filter((x) => x.rows.length === 3)), t = makeTable(r, c), j = r.int(0, 1), i = r.int(0, 2);
    const notRowTotal = t.T - t.rt[i], notRowCol = t.ct[j] - t.cells[i][j];
    return {
      stem: 'The table summarizes data about ' + t.T + ' ' + c.who + 's. If a ' + c.who + ' who does <i>not</i> fall in the row "' + c.rows[i] + '" is selected at random, what is the probability that the ' + c.who + ' ' + c.colNoun(c.cols[j]) + '?',
      figure: t.html,
      ...G.mcNum(r, fracChoice(notRowCol, notRowTotal), [
        { ...fracChoice(t.ct[j], t.T), why: 'This ignores the condition.' },
        { ...fracChoice(notRowCol, t.T), why: 'This divides by the total instead of by the number of ' + c.who + 's outside that row.' },
        { ...fracChoice(t.cells[i][j], t.rt[i]), why: 'This uses the excluded row itself.' },
      ]),
      num: notRowCol / notRowTotal,
      explanation: P('The ' + c.who + 's outside the row "' + c.rows[i] + '" number ' + m(t.T + ' - ' + t.rt[i] + ' = ' + notRowTotal) + '.', 'Of those, ' + m(t.ct[j] + ' - ' + t.cells[i][j] + ' = ' + notRowCol) + ' ' + pl(c.colNoun(c.cols[j])) + '. Probability: ' + m('\\frac{' + notRowCol + '}{' + notRowTotal + '}' + (G.gcd(notRowCol, notRowTotal) > 1 ? ' = ' + G.ftex(notRowCol, notRowTotal) : '')) + '.'),
    };
  });

  /* ================================= smp: sample statistics and MOE */
  add('smp', 'E', (r) => {
    const n = r.pick([50, 80, 100, 120, 150, 200, 250]), N = r.pick([1200, 1500, 2000, 2400, 3000, 4000, 5000]);
    let k = r.int(Math.round(n * 0.15), Math.round(n * 0.7));
    while (!isInt((k / n) * N)) k++;
    const ans = (k / n) * N;
    const ctx = r.pick([
      { s: 'students at a high school', pop: 'students at the school', act: 'said they would attend a spring concert', act2: 'would attend the concert' },
      { s: 'residents of a town', pop: 'residents of the town', act: 'said they support building a new library', act2: 'support building the library' },
      { s: 'employees of a company', pop: 'employees of the company', act: 'said they bike to work at least once a week', act2: 'bike to work at least once a week' },
    ]);
    const body = 'A random sample of ' + n + ' ' + ctx.s + ' was surveyed, and ' + k + ' of them ' + ctx.act + '. There are ' + nw(N) + ' ' + ctx.pop + ' in all. Based on the survey, ';
    return {
      stem: body + 'which of the following is the best estimate of the number of ' + ctx.pop + ' who ' + ctx.act2 + '?',
      sprStem: body + 'what is the best estimate of the number of ' + ctx.pop + ' who ' + ctx.act2 + '?',
      ...G.mcNum(r, ans, [
        { v: k, why: 'This is the number in the sample, not an estimate for the whole population.' },
        { v: N - ans, why: 'This estimates the number who would <i>not</i> say so.' },
        { v: G.clean(k * (N / 100)), why: 'This treats ' + k + ' as a percent, but it is a count out of ' + n + '.' },
      ].filter((d) => d.v !== ans)),
      num: ans,
      explanation: P('In the sample, ' + m('\\frac{' + k + '}{' + n + '} = ' + G.clean((k / n) * 100) + '\\%') + ' ' + ctx.act + '.', 'Apply this proportion to the population: ' + m(G.clean(k / n) + '\\times ' + nt(N) + ' = ' + nt(ans)) + '.'),
    };
  });

  add('smp', 'M', (r) => {
    const est = G.clean(r.int(120, 480) / 10), moe = G.clean(r.int(6, 25) / 10);
    const ctx = r.pick([['the mean number of hours per week that students at a university spend on homework', 'hours'], ['the mean commute time, in minutes, for workers in a city', 'minutes'], ['the mean number of books read last year by adults in a county', 'books']]);
    const lo = G.clean(est - moe), hi = G.clean(est + moe);
    return {
      stem: 'Based on a random sample, a researcher estimated ' + ctx[0] + ' to be ' + est + ', with an associated margin of error of ' + moe + '. Which of the following is the most appropriate conclusion?',
      ...G.mcText(r, 'It is plausible that ' + ctx[0] + ' is between ' + lo + ' and ' + hi + '.', [
        { t: ctx[0].charAt(0).toUpperCase() + ctx[0].slice(1) + ' is exactly ' + est + '.', why: 'A sample gives an estimate; the true mean is not known exactly.' },
        { t: 'Every individual in the population has a value between ' + lo + ' and ' + hi + '.', why: 'The margin of error describes the uncertainty in the estimate of the <i>mean</i>, not the range of individual values.' },
        { t: 'It is plausible that ' + ctx[0] + ' is between ' + G.clean(est - 2 * moe) + ' and ' + G.clean(est + 2 * moe) + ', but not between ' + lo + ' and ' + hi + '.', why: 'The plausible interval is the estimate plus or minus the margin of error: ' + lo + ' to ' + hi + '.' },
      ]),
      explanation: P('A margin of error creates an interval of plausible values for the population mean: estimate ' + m('\\pm') + ' margin of error, which is ' + m(est + ' \\pm ' + moe) + ', or ' + lo + ' to ' + hi + '.', 'It does not tell us the exact population mean, and it says nothing about individual values.'),
    };
  });

  add('smp', 'M', (r) => {
    const place = r.pick(['Lincoln High School', 'Riverside Middle School', 'Oakdale Community College']), n = r.pick([100, 150, 200, 300]);
    const topic = r.pick(['how much time they spend reading for fun', 'whether they would use a new tutoring center', 'how they usually travel to campus']);
    return {
      stem: 'A researcher selected ' + n + ' students at random from all students at ' + place + ' and asked them ' + topic + '. To which population can the results of the survey be most appropriately generalized?',
      ...G.mcText(r, 'All students at ' + place, [
        { t: 'Only the ' + n + ' students who were surveyed', why: 'Because the sample was selected at random from the school, the results can be generalized beyond the sample to the whole school.' },
        { t: 'All students in the state', why: 'Only students at ' + place + ' could have been selected, so the sample doesn’t represent students elsewhere.' },
        { t: 'All students in the country who are the same age', why: 'The sample came from one school only.' },
      ]),
      explanation: P('Results from a random sample can be generalized to the population the sample was drawn from — here, all students at ' + place + ' — but not to larger populations that had no chance of being selected.'),
    };
  });

  add('smp', 'H', (r) => {
    const n1 = r.pick([100, 200, 300]), n2 = n1 * r.pick([3, 4, 5]);
    const ctx = r.pick(['the proportion of voters in a city who support a new park', 'the mean height of adult sunflowers in a field', 'the proportion of households in a county with a home garden']);
    return {
      stem: 'Two researchers each estimate ' + ctx + '. Researcher A uses a random sample of ' + n1 + ', and Researcher B uses a random sample of ' + nw(n2) + ' from the same population. Both use the same method to calculate a margin of error. Which statement is most likely true?',
      ...G.mcText(r, 'Researcher B’s estimate has a smaller margin of error.', [
        { t: 'Researcher A’s estimate has a smaller margin of error.', why: 'Smaller samples produce more variable estimates, so they have larger margins of error.' },
        { t: 'The two estimates have the same margin of error because the samples come from the same population.', why: 'The margin of error depends on sample size, not just on the population.' },
        { t: 'Researcher B’s estimate must be exactly equal to the true population value.', why: 'Even a large random sample produces an estimate with some uncertainty.' },
      ]),
      explanation: P('For the same population and method, a larger random sample gives a more precise estimate, so its margin of error is smaller.', 'Researcher B’s sample (' + nw(n2) + ') is larger than Researcher A’s (' + n1 + ').'),
    };
  });

  add('smp', 'H', (r) => {
    const p = r.int(30, 60), moe = r.pick([2, 3, 4]), N = r.pick([8000, 12000, 20000, 25000]);
    const inside = r.int(p - moe + 1, p + moe - 1), ans = (inside / 100) * N;
    return {
      stem: 'A survey of a random sample of residents in a city estimated that ' + p + '% of residents recycle regularly, with a margin of error of ' + moe + ' percentage points. The city has ' + nw(N) + ' residents. Which of the following is a plausible number of residents in the city who recycle regularly?',
      ...G.mcNum(r, ans, [
        { v: ((p + moe + 3) / 100) * N, why: 'This is ' + (p + moe + 3) + '% of the population, which is outside the interval from ' + (p - moe) + '% to ' + (p + moe) + '%.' },
        { v: ((p - moe - 4) / 100) * N, why: 'This is ' + (p - moe - 4) + '% of the population, which is below the plausible interval.' },
        { v: (moe / 100) * N, why: 'This applies the margin of error as if it were the estimate.' },
      ], { fmt: (v) => G.nt(v), reject: (v) => v !== ans && v >= ((p - moe) / 100) * N && v <= ((p + moe) / 100) * N }),
      explanation: P('Plausible percents are ' + m(p + '\\% \\pm ' + moe + '\\%') + ', or ' + (p - moe) + '% to ' + (p + moe) + '%.', 'In numbers of residents: ' + m(G.clean((p - moe) / 100) + '\\times ' + nt(N) + ' = ' + nt(((p - moe) / 100) * N)) + ' to ' + m(G.clean((p + moe) / 100) + '\\times ' + nt(N) + ' = ' + nt(((p + moe) / 100) * N)) + '.', 'Only ' + m(nt(ans)) + ' falls in this range.'),
    };
  });

  /* ====================================== stc: evaluating statistical claims */
  const studies = [
    { pop: 'adults in Clearwater', x: 'drank more coffee', y: 'reported sleeping fewer hours', xVar: 'coffee consumption', yVar: 'hours of sleep', cause: 'Drinking more coffee causes', effect: 'to sleep fewer hours' },
    { pop: 'students at Maple High School', x: 'spent more time on social media', y: 'had lower average grades', xVar: 'time spent on social media', yVar: 'grades', cause: 'Spending more time on social media causes', effect: 'to have lower grades' },
    { pop: 'residents of Harbor County', x: 'walked more each day', y: 'reported better moods', xVar: 'daily walking', yVar: 'mood', cause: 'Walking more each day causes', effect: 'to have better moods' },
  ];
  add('stc', 'E', (r) => {
    const s = r.pick(studies), n = r.pick([300, 400, 500, 800]);
    return {
      stem: 'Researchers selected a random sample of ' + n + ' ' + s.pop + '. They found that those who ' + s.x + ' ' + s.y + '. Which of the following conclusions is best supported by the study?',
      ...G.mcText(r, 'There is an association between ' + s.xVar + ' and ' + s.yVar + ' among ' + s.pop + '.', [
        { t: s.cause + ' ' + s.pop + ' ' + s.effect + '.', why: 'This was an observational study with no random assignment, so it cannot show cause and effect.' },
        { t: 'There is an association between ' + s.xVar + ' and ' + s.yVar + ' among all people in the country.', why: 'The sample was drawn only from ' + s.pop + ', so the results can’t be generalized to everyone in the country.' },
        { t: s.cause + ' all people in the country ' + s.effect + '.', why: 'This claims both causation and an overly broad population.' },
      ]),
      explanation: P('<b>Random sampling</b> lets us generalize to the population sampled (' + s.pop + '). <b>Random assignment</b> to treatments is required to conclude cause and effect.', 'This study used a random sample but did not assign treatments, so it supports only an association among ' + s.pop + '.'),
    };
  });

  const experiments = [
    { who: 'volunteers', thing: 'a new study app', the: 'the app', use: 'use', ctrl: 'did not use the app', out: 'scored higher on a vocabulary test', better: 'higher vocabulary test scores', cause: 'Using the app causes an increase in vocabulary test scores', gen: 'all students in the country' },
    { who: 'volunteers', thing: 'a daily 20-minute meditation routine', the: 'the meditation routine', use: 'follow', ctrl: 'did not meditate', out: 'reported lower stress levels', better: 'lower stress levels', cause: 'The meditation routine causes lower stress levels', gen: 'all adults in the country' },
    { who: 'tomato plants from a single greenhouse', thing: 'a new fertilizer', the: 'the fertilizer', use: 'receive', ctrl: 'received no fertilizer', out: 'produced more tomatoes', better: 'greater tomato production', cause: 'The fertilizer causes tomato plants to produce more tomatoes', gen: 'all tomato plants everywhere' },
  ];
  add('stc', 'M', (r) => {
    const e = r.pick(experiments), n = r.pick([60, 80, 120, 200]);
    return {
      stem: 'A researcher ' + (e.who === 'volunteers' ? 'recruited ' : 'selected ') + n + ' ' + e.who + ' and randomly assigned half of them to ' + e.use + ' ' + e.thing + ' for eight weeks; the other half ' + e.ctrl + '. At the end of the study, the group assigned to ' + e.the + ' ' + e.out + '. Which conclusion is most appropriate?',
      ...G.mcText(r, e.cause + ' for ' + e.who.replace('volunteers', 'people') + ' similar to those in the study.', [
        { t: e.cause + ' for ' + e.gen + '.', why: 'The participants were not a random sample of ' + e.gen + ', so the results can’t be generalized that broadly.' },
        { t: 'There is an association between ' + e.the + ' and ' + e.better + ', but no conclusion about cause and effect can be made.', why: 'Because treatments were <i>randomly assigned</i>, a cause-and-effect conclusion is appropriate for the participants.' },
        { t: 'No conclusion can be made because the participants were not randomly selected.', why: 'Random assignment still allows a causal conclusion about the participants and similar individuals; it is only generalization to a broader population that is limited.' },
      ]),
      explanation: P('Random <b>assignment</b> to groups supports a cause-and-effect conclusion.', 'But the ' + e.who + ' were not randomly <b>selected</b> from a larger population, so the conclusion should be limited to ' + e.who.replace('volunteers', 'people') + ' similar to those in the study.'),
    };
  });

  add('stc', 'M', (r) => {
    const s = r.pick(studies);
    return {
      stem: 'A website invited its visitors to take an online survey, and 1,200 visitors responded. The responses showed that visitors who ' + s.x + ' ' + s.y + '. Which of the following is the most appropriate conclusion?',
      ...G.mcText(r, 'An association between ' + s.xVar + ' and ' + s.yVar + ' was observed among the people who responded, but it may not represent any larger population.', [
        { t: s.cause + ' people ' + s.effect + '.', why: 'Nothing was randomly assigned, so the survey cannot show cause and effect.' },
        { t: 'The results can be generalized to all visitors of the website.', why: 'The respondents chose to participate (a self-selected sample), so they may differ from other visitors.' },
        { t: 'The results can be generalized to ' + s.pop + '.', why: 'The respondents were website visitors who chose to respond, not a random sample of ' + s.pop + '.' },
      ]),
      explanation: P('This is a <b>self-selected</b> (voluntary response) sample: people chose whether to respond, so the sample may not represent any larger group.', 'There was also no random assignment, so only an association among the respondents can be described.'),
    };
  });

  add('stc', 'H', (r) => {
    const e = r.pick(experiments.slice(0, 2)), n = r.pick([400, 600, 1000]);
    const P0 = r.pick([['adults in a state', 'adults in the state'], ['students at a large university', 'students at the university']]), pop = P0[1];
    const did = e.use === 'use' ? 'Using ' + e.the : 'Following ' + e.the;
    return {
      stem: 'A researcher selected a random sample of ' + nw(n) + ' ' + P0[0] + ' and then randomly assigned each person in the sample either to ' + e.use + ' ' + e.thing + ' or not to. After eight weeks, the people assigned to ' + e.the + ' ' + e.out.replace('scored higher', 'had scored higher').replace(/^reported lower/, 'had reported lower') + ' than the others. Which conclusion is best supported by the design of the study?',
      ...G.mcText(r, did + ' causes ' + e.better + ' for ' + pop + ' in general.', [
        { t: did + ' causes ' + e.better + ', but only for the ' + nw(n) + ' people in the study.', why: 'Because the participants were a random sample of ' + pop + ', the conclusion can be generalized to that population.' },
        { t: 'There is only an association, because the study was observational.', why: 'The researcher randomly assigned treatments, so this was an experiment, not an observational study.' },
        { t: did + ' causes ' + e.better + ' for everyone in the world.', why: 'The sample was drawn only from ' + pop + '.' },
      ]),
      explanation: P('This design has both features: a <b>random sample</b> from ' + pop + ' (so results generalize to that population) and <b>random assignment</b> to treatments (so a cause-and-effect conclusion is supported).'),
    };
  });

  add('stc', 'H', (r) => {
    const s = r.pick(studies), n = r.pick([150, 250, 400]);
    return {
      stem: 'In a study, ' + n + ' ' + s.pop + ' who volunteered were asked about their habits. The researchers found that those who ' + s.x + ' ' + s.y + '. Which of the following, if true, would most weaken the claim that the relationship observed is causal?',
      ...G.mcText(r, 'The people who ' + s.x + ' also differed from the others in several other habits that could affect ' + s.yVar + '.', [
        { t: 'The study included more than 100 participants.', why: 'Sample size does not address whether other variables explain the relationship.' },
        { t: 'The same relationship was observed in a similar study.', why: 'This would strengthen, not weaken, the observed association.' },
        { t: 'The participants answered the questions honestly.', why: 'Honest answers would make the data more reliable, not weaker.' },
      ]),
      explanation: P('In an observational study, a <b>confounding variable</b> — another difference between the groups — could explain the relationship. Evidence that the groups differ in other relevant ways weakens a causal claim.'),
    };
  });
})();
