/* Advanced Math generators: nonlinear functions, nonlinear equations and
   systems, and equivalent expressions. */
(function () {
  'use strict';
  const SAT = window.SAT, G = SAT.mathgen, F = SAT.fig;
  const m = G.m, nt = G.nt, P = G.P, add = G.add;
  const nonzero = (r, a, b) => { let v = 0; while (v === 0) v = r.int(a, b); return v; };
  const isInt = (v) => Math.abs(v - Math.round(v)) < 1e-9;
  const sq = (h) => '(' + G.xm(h) + ')^2'; // (x - h)^2
  const vform = (a, h, k) => (a === 1 ? '' : a === -1 ? '-' : nt(a)) + sq(h) + (k === 0 ? '' : G.sgn(k));

  /* ============================================ nlf: nonlinear functions */
  add('nlf', 'E', (r) => {
    const a = r.pick([1, 2, 3, -1, -2]), b = r.int(-6, 6), c = r.int(-9, 9), k = r.pick([-3, -2, -1, 2, 3, 4]);
    const v = a * k * k + b * k + c;
    return {
      stem: 'The function ' + m('f') + ' is defined by ' + m('f(x) = ' + G.poly([a, b, c])) + '. What is the value of ' + m('f(' + k + ')') + '?',
      ...G.mcNum(r, v, [
        k < 0 ? { v: -a * k * k + b * k + c, why: 'This treats ' + m('(' + k + ')^2') + ' as negative; the square of a negative number is positive.' } : { v: a * 2 * k + b * k + c, why: 'This multiplies ' + m(k) + ' by 2 instead of squaring it.' },
        { v: (a * k) * (a * k) + b * k + c, why: 'This squares the coefficient ' + m(nt(a)) + ' along with ' + m(k) + '.' },
        { v: a * k * k + b * k - c, why: 'This uses the wrong sign for the constant term.' },
      ]),
      num: v,
      explanation: P('Substitute ' + m(k) + ' for ' + m('x') + ': ' + m('f(' + k + ') = ' + (a === 1 ? '' : a === -1 ? '-' : nt(a)) + '(' + k + ')^2' + (b ? G.sgn(b) + '(' + k + ')' : '') + (c ? G.sgn(c) : '')) + '.',
        m('= ' + nt(a * k * k) + (b ? G.sgn(b * k) : '') + (c ? G.sgn(c) : '') + ' = ' + nt(v)) + '.'),
    };
  });

  add('nlf', 'E', (r) => {
    const grow = r.bool(), pct = grow ? r.pick([2, 3, 4, 5, 6, 8]) : r.pick([10, 12, 15, 20, 25]);
    const base = grow ? 1 + pct / 100 : 1 - pct / 100;
    const ctx = grow ? r.pick([
      { f: 'P(t)', A: r.pick([4000, 12000, 25000, 60000]), d: 'models the population of a town ' + m('t') + ' years after 2015', init: 'The population of the town in 2015', rate: 'The increase in the population each year', later: 'The population of the town ' + m('t') + ' years after 2015' },
      { f: 'B(t)', A: r.pick([500, 800, 1200, 2500]), d: 'models the balance, in dollars, of a savings account ' + m('t') + ' years after it was opened', init: 'The amount of money, in dollars, deposited when the account was opened', rate: 'The amount of interest, in dollars, earned each year', later: 'The balance, in dollars, after ' + m('t') + ' years' },
    ]) : r.pick([
      { f: 'V(t)', A: r.pick([18000, 24000, 30000]), d: 'models the value, in dollars, of a car ' + m('t') + ' years after it was purchased', init: 'The purchase price, in dollars, of the car', rate: 'The amount, in dollars, the car loses in value each year', later: 'The value, in dollars, of the car after ' + m('t') + ' years' },
      { f: 'M(t)', A: r.pick([200, 400, 640]), d: 'models the mass, in milligrams, of a medication remaining in a patient’s body ' + m('t') + ' hours after a dose', init: 'The mass, in milligrams, of the dose', rate: 'The mass, in milligrams, removed each hour', later: 'The mass, in milligrams, remaining after ' + m('t') + ' hours' },
    ]);
    const askPct = r.bool();
    const fn = ctx.f + ' = ' + nt(ctx.A) + '(' + base + ')^{t}';
    if (askPct) {
      const ok = pct + '%';
      return {
        stem: 'The function ' + m(fn) + ' ' + ctx.d + '. By what percent does the quantity ' + (grow ? 'increase' : 'decrease') + ' each ' + (ctx.f === 'M(t)' ? 'hour' : 'year') + '?',
        ...G.mcText(r, ok, [
          { t: (grow ? Math.round(base * 100) : Math.round(base * 100)) + '%', why: 'This is the percent of the quantity that <i>remains</i> or is carried forward each period, not the percent change.' },
          { t: (pct / 100) + '%', why: 'The decimal ' + (pct / 100) + ' corresponds to ' + pct + '%, not ' + (pct / 100) + '%.' },
          { t: (pct * 10) + '%', why: 'This misreads the decimal ' + base + '.' },
        ], { keepOrder: false }),
        explanation: P('An exponential model ' + m('A(1 \\pm r)^t') + ' changes by ' + m('r') + ' each period. Here the base is ' + m(base) + ' = ' + m('1 ' + (grow ? '+' : '-') + ' ' + pct / 100) + ', so the quantity ' + (grow ? 'increases' : 'decreases') + ' by ' + m(pct / 100) + ', or ' + pct + '%, each period.'),
      };
    }
    return {
      stem: 'The function ' + m(fn) + ' ' + ctx.d + '. What is the best interpretation of ' + m(nt(ctx.A)) + ' in this context?',
      ...G.mcText(r, ctx.init, [{ t: ctx.rate, why: 'The yearly change is not constant in an exponential model; ' + m(nt(ctx.A)) + ' is the starting amount.' }, { t: ctx.later, why: 'That is ' + m(ctx.f) + ' itself, which depends on ' + m('t') + '.' }, { t: 'The percent ' + (grow ? 'increase' : 'decrease') + ' each period', why: 'The percent change comes from the base, ' + m(base) + '.' }]),
      explanation: P('When ' + m('t = 0') + ', ' + m(ctx.f.replace('t', '0') + ' = ' + nt(ctx.A) + '(' + base + ')^0 = ' + nt(ctx.A)) + '. So ' + m(nt(ctx.A)) + ' is the initial value: ' + ctx.init.charAt(0).toLowerCase() + ctx.init.slice(1) + '.'),
    };
  });

  add('nlf', 'M', (r) => {
    const a = r.pick([1, 2, 3, -1, -2, -3]), h = nonzero(r, -6, 6), k = nonzero(r, -12, 12), askY = r.bool();
    const kind = a > 0 ? 'minimum' : 'maximum';
    const ans = askY ? k : h;
    return {
      stem: 'The function ' + m('f') + ' is defined by ' + m('f(x) = ' + vform(a, h, k)) + '. ' + (askY ? 'What is the ' + kind + ' value of ' + m('f(x)') + '?' : 'For what value of ' + m('x') + ' does ' + m('f(x)') + ' reach its ' + kind + '?'),
      ...G.mcNum(r, ans, [
        { v: askY ? h : k, why: askY ? 'This is the ' + m('x') + '-value where the ' + kind + ' occurs, not the ' + kind + ' value.' : 'This is the ' + kind + ' value of ' + m('f') + ', not the ' + m('x') + '-value where it occurs.' },
        { v: -ans, why: askY ? 'This has the wrong sign.' : 'In ' + m('(x - h)^2') + ', the vertex is at ' + m('x = h') + ', so the sign of the number in the parentheses is reversed.' },
        { v: askY ? a + k : a * h, why: 'The coefficient ' + m(nt(a)) + ' affects the width and direction of the parabola, not the location of the vertex.' },
      ]),
      num: ans,
      explanation: P('The function is in vertex form ' + m('f(x) = a(x - h)^2 + k') + ', whose vertex is ' + m('(h, k)') + '. Here the vertex is ' + m('(' + h + ', ' + k + ')') + '.',
        'Because ' + m('a = ' + a) + (a > 0 ? ' is positive, the parabola opens upward, so the vertex is a minimum.' : ' is negative, the parabola opens downward, so the vertex is a maximum.'),
        (askY ? 'The ' + kind + ' value of ' + m('f(x)') + ' is ' + m(k) : 'The ' + kind + ' occurs at ' + m('x = ' + h)) + '.'),
    };
  });

  add('nlf', 'M', (r) => {
    const half = r.bool(0.35);
    if (half) {
      const M0 = r.pick([80, 120, 200, 400]), d = r.pick([3, 5, 8, 12]);
      return {
        stem: 'A sample of a radioactive substance has a mass of ' + M0 + ' grams. The mass of the sample is halved every ' + d + ' years. Which function gives the mass, in grams, of the sample ' + m('t') + ' years from now?',
        ...G.mcText(r, 'M(t) = ' + M0 + '\\left(\\frac{1}{2}\\right)^{\\frac{t}{' + d + '}}', [
          { t: 'M(t) = ' + M0 + '\\left(\\frac{1}{2}\\right)^{' + d + 't}', why: 'This halves the mass ' + d + ' times every year.' },
          { t: 'M(t) = ' + M0 + '\\left(\\frac{1}{2}\\right)^{t}', why: 'This halves the mass every year, not every ' + d + ' years.' },
          { t: 'M(t) = ' + M0 + ' - \\frac{' + M0 + '}{2}t', why: 'This is a linear model, but the mass decreases by a constant <i>factor</i>, not a constant amount.' },
        ], { math: true }),
        explanation: P('The mass is multiplied by ' + m('\\frac{1}{2}') + ' once every ' + d + ' years. After ' + m('t') + ' years, that has happened ' + m('\\frac{t}{' + d + '}') + ' times.', 'So ' + m('M(t) = ' + M0 + '\\left(\\frac{1}{2}\\right)^{\\frac{t}{' + d + '}}') + '.'),
      };
    }
    const N = r.pick([50, 100, 250, 400, 600]), d = r.pick([2, 3, 4, 6]), f = r.pick([2, 3]);
    const word = f === 2 ? 'doubles' : 'triples';
    return {
      stem: 'A biologist starts a culture with ' + N + ' bacteria. The number of bacteria ' + word + ' every ' + d + ' hours. Which function gives the number of bacteria ' + m('t') + ' hours after the culture was started?',
      ...G.mcText(r, 'B(t) = ' + N + '(' + f + ')^{\\frac{t}{' + d + '}}', [
        { t: 'B(t) = ' + N + '(' + f + ')^{' + d + 't}', why: 'This multiplies by ' + f + ' a total of ' + d + ' times every hour.' },
        { t: 'B(t) = ' + N + '(' + f + ')^{t}', why: 'This ' + word + ' the number every hour, not every ' + d + ' hours.' },
        d !== f ? { t: 'B(t) = ' + N + '(' + d + ')^{\\frac{t}{' + f + '}}', why: 'This swaps the growth factor and the time period.' }
          : { t: 'B(t) = ' + N + ' + ' + N * (f - 1) + '\\left(\\frac{t}{' + d + '}\\right)', why: 'This is a linear model: it adds the same number of bacteria each period instead of multiplying by ' + f + '.' },
      ], { math: true }),
      explanation: P('The number is multiplied by ' + m(f) + ' once every ' + d + ' hours, which happens ' + m('\\frac{t}{' + d + '}') + ' times in ' + m('t') + ' hours.', 'So ' + m('B(t) = ' + N + '(' + f + ')^{\\frac{t}{' + d + '}}') + '. Check: ' + m('B(' + d + ') = ' + N + '(' + f + ')^1 = ' + N * f) + ' ✓'),
    };
  });

  add('nlf', 'M', (r) => {
    const p = nonzero(r, -7, 9); let q = nonzero(r, -7, 9); if (q === p) q = p + 2;
    const a = r.pick([1, 1, 2, -1, 3]), askSum = r.bool();
    const fx = (a === 1 ? '' : a === -1 ? '-' : nt(a)) + '(' + G.xm(p) + ')(' + G.xm(q) + ')';
    if (askSum) {
      return {
        stem: 'The function ' + m('f') + ' is defined by ' + m('f(x) = ' + fx) + '. What is the sum of the ' + m('x') + '-coordinates of the ' + m('x') + '-intercepts of the graph of ' + m('y = f(x)') + '?',
        ...G.mcNum(r, p + q, [
          { v: -(p + q), why: 'This uses the numbers in the factors without changing their signs; ' + m('x - c = 0') + ' gives ' + m('x = c') + '.' },
          { v: p * q, why: 'This is the product of the zeros, not their sum.' },
          { v: a * p * q, why: 'This is the ' + m('y') + '-intercept of the graph.' },
        ]),
        num: p + q,
        explanation: P('The ' + m('x') + '-intercepts occur where ' + m('f(x) = 0') + '. By the zero product property, ' + m(G.xm(p) + ' = 0') + ' or ' + m(G.xm(q) + ' = 0') + ', so ' + m('x = ' + p) + ' or ' + m('x = ' + q) + '.',
          'The sum is ' + m(p + G.sgn(q) + ' = ' + (p + q)) + '.'),
      };
    }
    const yi = a * p * q;
    return {
      stem: 'The function ' + m('f') + ' is defined by ' + m('f(x) = ' + fx) + '. What is the ' + m('y') + '-coordinate of the ' + m('y') + '-intercept of the graph of ' + m('y = f(x)') + '?',
      ...G.mcNum(r, yi, [
        { v: -yi, why: 'This has the wrong sign; substitute ' + m('x = 0') + ' carefully: ' + m('(' + G.xm(p).replace('x', '0') + ')(' + G.xm(q).replace('x', '0') + ')') + '.' },
        { v: p + q, why: 'This is the sum of the zeros.' },
        a !== 1 ? { v: p * q, why: 'This forgets to multiply by ' + m(nt(a)) + '.' } : { v: -(p + q), why: 'This is the negative of the sum of the zeros.' },
      ]),
      num: yi,
      explanation: P('The ' + m('y') + '-intercept is ' + m('f(0)') + ': ' + m('f(0) = ' + (a === 1 ? '' : a === -1 ? '-' : nt(a)) + '(0' + G.sgn(-p) + ')(0' + G.sgn(-q) + ') = ' + nt(yi)) + '.'),
    };
  });

  add('nlf', 'M', (r) => {
    const h = nonzero(r, -4, 4), k = nonzero(r, -4, 4), a = r.pick([1, -1]);
    const f = (x) => a * (x - h) * (x - h) + k;
    const fig = F.plane({ x0: -7, x1: 7, y0: -7, y1: 7, fns: [{ f }], labelEvery: 2, points: [[h, k]] });
    return {
      stem: 'The graph of ' + m('y = f(x)') + ' is shown, where ' + m('f') + ' is a quadratic function. Which equation could define ' + m('f') + '?',
      figure: fig,
      ...G.mcText(r, 'f(x) = ' + vform(a, h, k), [
        { t: 'f(x) = ' + vform(a, -h, k), why: 'This shifts the graph in the wrong horizontal direction; its vertex would be at ' + m('(' + -h + ', ' + k + ')') + '.' },
        { t: 'f(x) = ' + vform(a, h, -k), why: 'This graph’s vertex would be at ' + m('(' + h + ', ' + -k + ')') + '.' },
        { t: 'f(x) = ' + vform(-a, h, k), why: 'This parabola opens ' + (a > 0 ? 'downward' : 'upward') + ', but the graph opens ' + (a > 0 ? 'upward' : 'downward') + '.' },
      ], { math: true }),
      explanation: P('The vertex of the graph is ' + m('(' + h + ', ' + k + ')') + ' and the parabola opens ' + (a > 0 ? 'upward' : 'downward') + '.',
        'A parabola with vertex ' + m('(h, k)') + ' can be written ' + m('f(x) = a(x - h)^2 + k') + ', with ' + m('a') + (a > 0 ? ' positive' : ' negative') + '. So ' + m('f(x) = ' + vform(a, h, k)) + ' matches the graph.'),
    };
  });

  add('nlf', 'H', (r) => {
    const r1 = nonzero(r, -6, 6); let r2 = nonzero(r, -6, 6); if (r2 === r1) r2 = -r1 || 3;
    const a = r.pick([1, 2, 3, -1, -2]), c = a * r1 * r2;
    let k = r.int(-4, 7); if (k === r1 || k === r2 || k === 0) k = Math.max(r1, r2) + 1;
    const v = a * (k - r1) * (k - r2);
    return {
      stem: 'A quadratic function ' + m('f') + ' has zeros at ' + m('x = ' + r1) + ' and ' + m('x = ' + r2) + ', and ' + m('f(0) = ' + nt(c)) + '. What is the value of ' + m('f(' + k + ')') + '?',
      ...G.mcNum(r, v, [
        a !== 1 ? { v: (k - r1) * (k - r2), why: 'This assumes the leading coefficient is 1; use ' + m('f(0) = ' + nt(c)) + ' to find it.' } : { v: 2 * v || 5, why: 'Check the leading coefficient using ' + m('f(0)') + '.' },
        { v: a * (k + r1) * (k + r2), why: 'This writes the factors as ' + m('(' + G.xm(-r1) + ')') + ' and ' + m('(' + G.xm(-r2) + ')') + ', which would give zeros at ' + m(-r1) + ' and ' + m(-r2) + '.' },
        { v: c, why: 'This is ' + m('f(0)') + ', not ' + m('f(' + k + ')') + '.' },
      ]),
      num: v,
      explanation: P('A quadratic with zeros ' + m(r1) + ' and ' + m(r2) + ' has the form ' + m('f(x) = a(' + G.xm(r1) + ')(' + G.xm(r2) + ')') + '.',
        'Use ' + m('f(0) = ' + nt(c)) + ': ' + m('a(' + (-r1) + ')(' + (-r2) + ') = ' + nt(c)) + ', so ' + m(nt(r1 * r2) + 'a = ' + nt(c)) + ' and ' + m('a = ' + a) + '.',
        'Then ' + m('f(' + k + ') = ' + nt(a) + '(' + k + G.sgn(-r1) + ')(' + k + G.sgn(-r2) + ') = ' + nt(a) + '(' + (k - r1) + ')(' + (k - r2) + ') = ' + nt(v)) + '.'),
    };
  });

  add('nlf', 'H', (r) => {
    const A = r.pick([2, 3, 4, 5, 6]), b = r.pick([2, 3, 4, 5]), n = r.pick([3, 4]);
    const v = A * Math.pow(b, n);
    if (v > 99999) return G.gens.nlf.H[0](r);
    return {
      stem: 'The function ' + m('f') + ' is defined by ' + m('f(x) = a(b)^x') + ', where ' + m('a') + ' and ' + m('b') + ' are positive constants. If ' + m('f(0) = ' + A) + ' and ' + m('f(2) = ' + nt(A * b * b)) + ', what is the value of ' + m('f(' + n + ')') + '?',
      ...G.mcNum(r, v, [
        { v: A * b * b * 2, why: 'This doubles ' + m('f(2)') + ' instead of multiplying by the base ' + m('b = ' + b) + ' each step.' },
        { v: A * Math.pow(b, n - 1), why: 'This multiplies by the base one too few times.' },
        { v: A * b * n, why: 'This treats the function as if it grew by a constant amount.' },
      ]),
      num: v,
      explanation: P(m('f(0) = a(b)^0 = a') + ', so ' + m('a = ' + A) + '.', m('f(2) = ' + A + 'b^2 = ' + nt(A * b * b)) + ', so ' + m('b^2 = ' + b * b) + ' and, since ' + m('b') + ' is positive, ' + m('b = ' + b) + '.',
        'Then ' + m('f(' + n + ') = ' + A + '(' + b + ')^' + n + ' = ' + A + '(' + Math.pow(b, n) + ') = ' + nt(v)) + '.'),
    };
  });

  add('nlf', 'H', (r) => {
    const a = r.pick([1, 1, 2, -1, -2, 3]), h = nonzero(r, -6, 6), k = r.int(-15, 15);
    const b = -2 * a * h, c = a * h * h + k, askY = r.bool(0.6);
    const kind = a > 0 ? 'minimum' : 'maximum', ans = askY ? k : h;
    return {
      stem: 'The function ' + m('f') + ' is defined by ' + m('f(x) = ' + G.poly([a, b, c])) + '. ' + (askY ? 'What is the ' + kind + ' value of ' + m('f(x)') + '?' : 'What is the ' + m('x') + '-coordinate of the vertex of the graph of ' + m('y = f(x)') + '?'),
      ...G.mcNum(r, ans, [
        { v: askY ? h : -h, why: askY ? 'This is the ' + m('x') + '-coordinate of the vertex, not the ' + kind + ' value.' : 'This forgets the negative sign in ' + m('-\\frac{b}{2a}') + '.' },
        { v: askY ? c : k, why: askY ? 'This is ' + m('f(0)') + ', the ' + m('y') + '-intercept.' : 'This is the ' + kind + ' value, not the ' + m('x') + '-coordinate of the vertex.' },
        { v: askY ? -k : b, why: askY ? 'This has the wrong sign.' : 'This is the coefficient of ' + m('x') + '.' },
      ]),
      num: ans,
      explanation: P('The ' + m('x') + '-coordinate of the vertex is ' + m('-\\frac{b}{2a} = -\\frac{' + nt(b) + '}{2(' + a + ')} = ' + h) + '.',
        askY ? 'Because ' + m('a = ' + a + (a > 0 ? ' > 0' : ' < 0')) + ', the vertex is a ' + kind + '. Its value is ' + m('f(' + h + ') = ' + (a === 1 ? '' : a === -1 ? '-' : nt(a)) + '(' + h + ')^2' + G.sgn(b) + '(' + h + ')' + (c ? G.sgn(c) : '') + ' = ' + nt(k)) + '.'
          : 'You can also complete the square: ' + m('f(x) = ' + vform(a, h, k)) + ', so the vertex is ' + m('(' + h + ', ' + k + ')') + '.'),
    };
  });

  add('nlf', 'H', (r) => {
    const h = nonzero(r, -5, 5), k = nonzero(r, -6, 6), p = nonzero(r, -4, 4), q = nonzero(r, -5, 5);
    const pt = (x, y) => '(' + x + ', ' + y + ')';
    const ans = pt(h - p, k - q);
    const cand = [
      { t: pt(h + p, k - q), why: 'Replacing ' + m('x') + ' with ' + m('x' + G.sgn(p)) + ' shifts the graph ' + (p > 0 ? 'left' : 'right') + ', not ' + (p > 0 ? 'right' : 'left') + '.' },
      { t: pt(h - p, k + q), why: 'The ' + m(G.sgn(-q).trim()) + ' outside the function shifts the graph ' + (q > 0 ? 'down, not up' : 'up, not down') + '.' },
      { t: pt(h + p, k + q), why: 'Both shifts are in the wrong direction.' },
      { t: pt(h, k), why: 'This is the vertex of ' + m('f') + ', not of ' + m('g') + '.' },
    ].filter((c) => c.t !== ans);
    return {
      stem: 'The function ' + m('f') + ' is defined by ' + m('f(x) = ' + vform(1, h, k)) + '. The function ' + m('g') + ' is defined by ' + m('g(x) = f(x' + G.sgn(p) + ')' + G.sgn(-q)) + '. What is the vertex of the graph of ' + m('y = g(x)') + '?',
      ...G.mcText(r, ans, cand.slice(0, 3), { math: true }),
      explanation: P('The vertex of ' + m('f') + ' is ' + m(pt(h, k)) + '.', m('f(x' + G.sgn(p) + ')') + ' shifts the graph ' + Math.abs(p) + ' unit' + (Math.abs(p) === 1 ? '' : 's') + ' ' + (p > 0 ? 'left' : 'right') + ', and ' + m(G.sgn(-q).trim()) + ' shifts it ' + Math.abs(q) + ' unit' + (Math.abs(q) === 1 ? '' : 's') + ' ' + (q > 0 ? 'down' : 'up') + '.',
        'So the vertex of ' + m('g') + ' is ' + m(pt(h - p, k - q)) + '.'),
    };
  });

  add('nlf', 'H', (r) => {
    const pct = r.pick([10, 20, 25, 30, 40]), n = r.pick([2, 3, 4, 5]);
    const base = (100 - pct) / 100;
    const c = r.pick([
      { V: r.pick([12000, 20000, 45000]), t: 'years', s: (V) => 'A company buys a machine for ' + G.money(V) + '. The machine\u2019s value decreases by ' + pct + '% every ' + n + ' years.', q: 'the value, in dollars, of the machine ' + m('t') + ' years after it is bought' },
      { V: r.pick([4000, 6500, 9000]), t: 'years', s: (V) => 'A lake contains ' + G.nw(V) + ' fish. Because of overfishing, the number of fish decreases by ' + pct + '% every ' + n + ' years.', q: 'the number of fish in the lake ' + m('t') + ' years from now' },
      { V: r.pick([400, 500, 800]), t: 'hours', s: (V) => 'A patient receives a ' + V + '-milligram dose of a medication. The amount of the medication in the patient\u2019s body decreases by ' + pct + '% every ' + n + ' hours.', q: 'the amount, in milligrams, of the medication remaining ' + m('t') + ' hours after the dose' },
    ]);
    const V = c.V, one = c.t.slice(0, -1);
    return {
      stem: c.s(V) + ' Which expression gives ' + c.q + '?',
      ...G.mcText(r, nt(V) + '(' + base + ')^{\\frac{t}{' + n + '}}', [
        { t: nt(V) + '(' + base + ')^{' + n + 't}', why: 'This applies the decrease ' + n + ' times every ' + one + '.' },
        { t: nt(V) + '(' + pct / 100 + ')^{\\frac{t}{' + n + '}}', why: 'Each period the quantity keeps ' + (100 - pct) + '% of its value, so the factor is ' + m(base) + ', not ' + m(pct / 100) + '.' },
        { t: nt(V) + '(' + base + ')^{t}', why: 'This applies a ' + pct + '% decrease every ' + one + ' instead of every ' + n + ' ' + c.t + '.' },
      ], { math: true }),
      explanation: P('A ' + pct + '% decrease means the quantity is multiplied by ' + m('1 - ' + pct / 100 + ' = ' + base) + ' each period.', 'Each period is ' + n + ' ' + c.t + ', so in ' + m('t') + ' ' + c.t + ' there are ' + m('\\frac{t}{' + n + '}') + ' periods: ' + m(nt(V) + '(' + base + ')^{\\frac{t}{' + n + '}}') + '.'),
    };
  });

  /* ======================================= nle: nonlinear equations */
  add('nle', 'E', (r) => {
    const h = nonzero(r, -6, 8), s = r.int(2, 9), s1 = h + s, s2 = h - s;
    return {
      stem: G.M(sq(h) + ' = ' + s * s) + 'Which of the following is a solution to the given equation?',
      sprStem: G.M(sq(h) + ' = ' + s * s) + 'What is one solution to the given equation?',
      ...G.mcNum(r, s1, [
        { v: -h + s === s2 ? s * s + h : -h + s, why: 'This uses the wrong sign for ' + m(nt(h)) + ' when solving ' + m(G.xm(h) + ' = \\pm ' + s) + '.' },
        { v: s * s + h, why: 'This forgets to take the square root of ' + m(s * s) + '.' },
        { v: s, why: 'This is a solution to ' + m('x^2 = ' + s * s) + ', not to the given equation.' },
      ], { reject: (v) => v === s2 }),
      num: s1, numAlt: [s2], numShow: s1 + ' or ' + s2,
      explanation: P('Take the square root of each side: ' + m(G.xm(h) + ' = ' + s) + ' or ' + m(G.xm(h) + ' = -' + s) + '.', 'So ' + m('x = ' + s1) + ' or ' + m('x = ' + s2) + '. Only ' + m(s1) + ' appears among the choices.'),
    };
  });

  add('nle', 'E', (r) => {
    const a = r.pick([2, 3, 4, 5]), x = r.int(2, 9), c = a * x * x;
    return {
      stem: 'If ' + m(a + 'x^2 = ' + c) + ', which of the following is a possible value of ' + m('x') + '?',
      sprStem: 'If ' + m(a + 'x^2 = ' + c) + ', what is one possible value of ' + m('x') + '?',
      ...G.mcNum(r, x, [
        { v: x * x, why: 'This is the value of ' + m('x^2') + '.' },
        isInt(c / (2 * a)) && c / (2 * a) !== x ? { v: c / (2 * a), why: 'This divides by 2 instead of taking the square root.' } : { v: x * 2, why: 'This doubles ' + m('x') + ' instead of squaring it when checking.' },
        { v: c / a + a, why: 'This does not isolate ' + m('x^2') + ' correctly.' },
      ], { reject: (v) => v === -x }),
      num: x, numAlt: [-x], numShow: x + ' or ' + -x,
      explanation: P('Divide by ' + m(a) + ': ' + m('x^2 = ' + x * x) + '. Take the square root: ' + m('x = ' + x) + ' or ' + m('x = -' + x) + '.'),
    };
  });

  add('nle', 'M', (r) => {
    const p = r.int(1, 9); let n = r.int(1, 9); if (n === p) n += 1;
    const b = n - p, c = -n * p;
    return {
      stem: 'What is the positive solution to the equation ' + m(G.poly([1, b, c]) + ' = 0') + '?',
      ...G.mcNum(r, p, [
        { v: n, why: 'The solutions are ' + m(p) + ' and ' + m(-n) + '; this drops the negative sign of the other solution.' },
        { v: p * n, why: 'This is the absolute value of the constant term, not a solution.' },
        { v: Math.abs(b) || p + 1, why: 'This is the (absolute value of the) coefficient of ' + m('x') + '.' },
      ]),
      num: p,
      explanation: P('Factor: find two numbers that multiply to ' + m(nt(c)) + ' and add to ' + m(nt(b)) + ': ' + m(p === n ? '' : nt(-p)) + ' and ' + m(nt(n)) + '.',
        m('(x - ' + p + ')(x + ' + n + ') = 0') + ', so ' + m('x = ' + p) + ' or ' + m('x = -' + n) + '. The positive solution is ' + m(p) + '.'),
    };
  });

  add('nle', 'M', (r) => {
    const r1 = r.int(-5, 5); let r2 = r.int(-5, 6); if (r2 === r1) r2 = r1 + 3;
    const mm = r.pick([-3, -2, -1, 1, 2, 3]), d = r.int(-6, 6);
    const b = mm - (r1 + r2), c = d + r1 * r2;
    const cands = [-r1, -r2, r1 + r2, r1 * r2, r1 - 1, r1 + 1, r1 + 2, r1 - 2, r1 + 3].filter((v) => v !== r1 && v !== r2);
    const uniq = Array.from(new Set(cands));
    return {
      stem: G.sys(['y = ' + G.poly([1, b, c]), 'y = ' + G.lin(mm, d)]) + 'If ' + m('(x, y)') + ' is a solution to the given system of equations, which of the following could be the value of ' + m('x') + '?',
      sprStem: G.sys(['y = ' + G.poly([1, b, c]), 'y = ' + G.lin(mm, d)]) + 'If ' + m('(x, y)') + ' is a solution to the given system of equations, what is one possible value of ' + m('x') + '?',
      ...G.mcNum(r, r1, uniq.slice(0, 3).map((v) => ({ v, why: 'Substituting this value into both equations gives different values of ' + m('y') + '.' })), { reject: (v) => v === r2 }),
      num: r1, numAlt: [r2], numShow: r1 + ' or ' + r2,
      explanation: P('Set the two expressions for ' + m('y') + ' equal: ' + m(G.poly([1, b, c]) + ' = ' + G.lin(mm, d)) + '.',
        'Collect terms: ' + m(G.poly([1, b - mm, c - d]) + ' = 0') + ', which factors as ' + m('(' + G.xm(r1) + ')(' + G.xm(r2) + ') = 0') + '.',
        'So ' + m('x = ' + r1) + ' or ' + m('x = ' + r2) + '.'),
    };
  });

  add('nle', 'M', (r) => {
    const kind = r.pick([0, 1, 2]);
    let a, b, c;
    if (kind === 1) { const t = nonzero(r, -5, 5), s = r.pick([1, 2, 3]); a = s * s; b = -2 * s * t; c = t * t; }
    else if (kind === 2) { a = r.pick([1, 2, 3]); b = r.int(-9, 9); c = r.int(-9, 9); while (b * b - 4 * a * c <= 0) c -= 3; }
    else { a = r.pick([1, 2, 3]); b = r.int(-4, 4); c = r.int(1, 9); while (b * b - 4 * a * c >= 0) c += 2; }
    const D = b * b - 4 * a * c;
    const names = ['Zero', 'Exactly one', 'Exactly two', 'Infinitely many'];
    const why = ['The discriminant is ' + (D < 0 ? 'negative' : D === 0 ? 'zero' : 'positive') + ', so there ' + (D === 0 ? 'is exactly one real solution.' : D > 0 ? 'are two real solutions.' : 'are no real solutions.')];
    return {
      stem: 'How many distinct real solutions does the equation ' + m(G.poly([a, b, c]) + ' = 0') + ' have?',
      choices: names,
      answer: kind,
      notes: names.map((_, i) => (i === kind ? null : i === 3 ? 'A quadratic equation that is not an identity cannot have infinitely many solutions.' : why[0])),
      explanation: P('Use the discriminant ' + m('b^2 - 4ac') + ': ' + m('(' + b + ')^2 - 4(' + a + ')(' + c + ') = ' + b * b + ' - ' + G.paren(4 * a * c) + ' = ' + D) + '.',
        'A positive discriminant means two real solutions, zero means exactly one, and negative means none. Here the discriminant is ' + (D > 0 ? 'positive' : D === 0 ? 'zero' : 'negative') + ', so the answer is: ' + names[kind].toLowerCase() + '.'),
    };
  });

  add('nle', 'H', (r) => {
    const variant = r.int(0, 2);
    if (variant === 0) { // unknown constant term
      const a = r.pick([1, 2, 3, 4]), t = nonzero(r, -6, 6), b = 2 * a * t, c = a * t * t;
      return {
        stem: 'In the equation ' + m(G.poly([a, b, 0]).replace(/ ?$/, '') + ' + c = 0') + ', ' + m('c') + ' is a constant. If the equation has exactly one real solution, what is the value of ' + m('c') + '?',
        ...G.mcNum(r, c, [
          { v: b * b, why: 'This is ' + m('b^2') + '; set ' + m('b^2 - 4ac') + ' equal to 0 and solve for ' + m('c') + '.' },
          { v: b * b / 2, why: 'This divides ' + m('b^2') + ' by 2 instead of by ' + m('4a') + '.' },
          { v: -c, why: 'This has the wrong sign.' },
        ]),
        num: c,
        explanation: P('A quadratic has exactly one real solution when its discriminant is 0: ' + m('b^2 - 4ac = 0') + '.', m('(' + b + ')^2 - 4(' + a + ')c = 0') + ', so ' + m(b * b + ' = ' + 4 * a + 'c') + ' and ' + m('c = ' + c) + '.'),
      };
    }
    if (variant === 1) { // unknown b, positive
      const s = r.int(2, 9), bb = 2 * s;
      return {
        stem: 'In the equation ' + m('x^2 + bx + ' + s * s + ' = 0') + ', ' + m('b') + ' is a positive constant. If the equation has exactly one real solution, what is the value of ' + m('b') + '?',
        ...G.mcNum(r, bb, [
          { v: s, why: 'This is the square root of the constant term; the discriminant condition gives ' + m('b = 2\\sqrt{' + s * s + '}') + '.' },
          { v: s * s, why: 'This is the constant term.' },
          { v: 4 * s * s, why: 'This is ' + m('b^2') + ', not ' + m('b') + '.' },
        ]),
        num: bb,
        explanation: P('Exactly one real solution means ' + m('b^2 - 4(1)(' + s * s + ') = 0') + ', so ' + m('b^2 = ' + 4 * s * s) + ' and ' + m('b = \\pm' + bb) + '. Since ' + m('b') + ' is positive, ' + m('b = ' + bb) + '.',
          'Check: ' + m('x^2 + ' + bb + 'x + ' + s * s + ' = (x + ' + s + ')^2') + ', which is zero only at ' + m('x = -' + s) + '.'),
      };
    }
    // no real solutions: which c
    const a = r.pick([1, 2, 3]), b = r.pick([-8, -6, -4, 4, 6, 8, 10]);
    const crit = (b * b) / (4 * a);
    const good = Math.floor(crit) + r.int(1, 6);
    const bad = r.shuffle([Math.floor(crit) - r.int(1, 4), -r.int(1, 9), 0, Math.floor(crit) === crit ? crit : Math.floor(crit) - 5, Math.floor(crit) - 7, -10 - r.int(0, 5)]).filter((v) => v <= crit);
    return {
      stem: 'In the equation ' + m(G.poly([a, b, 0]).trim() + ' + c = 0') + ', ' + m('c') + ' is a constant. For which of the following values of ' + m('c') + ' does the equation have no real solutions?',
      ...G.mcNum(r, good, Array.from(new Set(bad)).map((v) => ({ v, why: 'With ' + m('c = ' + v) + ', the discriminant is ' + m(b * b + ' - ' + G.paren(4 * a * v) + ' = ' + (b * b - 4 * a * v)) + ', which is not negative, so there is at least one real solution.' })), { reject: (v) => v > crit && v !== good }),
      explanation: P('No real solutions means the discriminant is negative: ' + m('(' + b + ')^2 - 4(' + a + ')c < 0') + ', so ' + m(b * b + ' < ' + 4 * a + 'c') + ' and ' + m('c > ' + G.ftex(b * b, 4 * a)) + '.',
        'Of the choices, only ' + m(good) + ' is greater than ' + m(G.ftex(b * b, 4 * a)) + '.'),
    };
  });

  add('nle', 'H', (r) => {
    const a = r.pick([2, 3, 4, 5, 6]), b = nonzero(r, -15, 15), askSum = r.bool(0.6);
    let c = nonzero(r, -12, 12); while (b * b - 4 * a * c <= 0) c -= 3;
    const [sn, sd] = G.frac(-b, a), [pn, pd] = G.frac(c, a);
    const ans = askSum ? -b / a : c / a;
    return {
      stem: 'What is the ' + (askSum ? 'sum' : 'product') + ' of the solutions to ' + m(G.poly([a, b, c]) + ' = 0') + '?',
      ...G.mcNum(r, { v: ans, tex: askSum ? G.ftex(sn, sd) : G.ftex(pn, pd) }, [
        { v: askSum ? b / a : -c / a, tex: askSum ? G.ftex(b, a) : G.ftex(-c, a), why: 'This has the wrong sign.' },
        { v: askSum ? c / a : -b / a, tex: askSum ? G.ftex(c, a) : G.ftex(-b, a), why: 'This is the ' + (askSum ? 'product' : 'sum') + ' of the solutions.' },
        { v: askSum ? -b : c, tex: nt(askSum ? -b : c), why: 'This forgets to divide by the leading coefficient, ' + m(a) + '.' },
      ]),
      num: ans,
      explanation: P('For ' + m('ax^2 + bx + c = 0') + ', the sum of the solutions is ' + m('-\\frac{b}{a}') + ' and the product is ' + m('\\frac{c}{a}') + '.',
        'Here ' + m('a = ' + a) + ', ' + m('b = ' + b) + ', ' + m('c = ' + c) + ', so the ' + (askSum ? 'sum' : 'product') + ' is ' + m((askSum ? '-\\frac{' + b + '}{' + a + '}' : '\\frac{' + c + '}{' + a + '}') + ' = ' + (askSum ? G.ftex(sn, sd) : G.ftex(pn, pd))) + '.',
        'You don’t need the quadratic formula; the solutions themselves are not integers here.'),
    };
  });

  add('nle', 'H', (r) => {
    const b = r.int(-3, 5), s = b + r.int(2, 6), a = (s - b) * (s - b) - s, e = 2 * b + 1 - s;
    const set = (arr) => (arr.length ? '\\{' + arr.join(', ') + '\\}' : '\\{\\,\\}');
    const lhs = '\\sqrt{' + G.xm(-a) + '} = ' + G.xm(b);
    return {
      stem: G.M(lhs) + 'What is the solution set of the given equation?',
      sprStem: G.M(lhs) + 'What is the solution to the given equation?',
      ...G.mcText(r, set([s]), [
        { t: set([e]), why: 'Check ' + m('x = ' + e) + ': the right side is ' + m(e + G.sgn(-b) + ' = ' + (e - b)) + ', which is negative, but a square root cannot be negative. It is extraneous.' },
        { t: set([Math.min(s, e), Math.max(s, e)]), why: 'Squaring both sides can introduce an extraneous solution; ' + m(e) + ' does not satisfy the original equation.' },
        { t: set([]), why: m(s) + ' does satisfy the equation: ' + m('\\sqrt{' + (s + a) + '} = ' + (s - b)) + '.' },
      ], { math: true }),
      num: s,
      explanation: P('Square both sides: ' + m(G.xm(-a) + ' = (' + G.xm(b) + ')^2 = ' + G.poly([1, -2 * b, b * b])) + '.',
        'Rearrange: ' + m(G.poly([1, -2 * b - 1, b * b - a]) + ' = 0') + ', which factors as ' + m('(' + G.xm(s) + ')(' + G.xm(e) + ') = 0') + '.',
        'Check both in the original equation. ' + m('x = ' + s) + ': ' + m('\\sqrt{' + (s + a) + '} = ' + (s - b)) + ' ✓. ' + m('x = ' + e) + ': ' + m('\\sqrt{' + (e + a) + '} = ' + Math.abs(e - b)) + ' but the right side is ' + m(e - b) + ' ✗.',
        'So the only solution is ' + m(s) + '.'),
    };
  });

  add('nle', 'H', (r) => {
    let a, b, p, q, x;
    for (let i = 0; i < 200; i++) {
      a = r.int(2, 9); b = r.int(1, 9); if (a === b) continue;
      p = r.int(-6, 6); q = r.int(-6, 6);
      x = -(b * p + a * q) / (a - b);
      if (isInt(x) && x !== p && x !== -q && Math.abs(x) <= 30) break;
    }
    if (!isInt(x)) { a = 3; b = 1; p = 1; q = 1; x = -2; }
    return {
      stem: G.M('\\frac{' + a + '}{' + G.xm(p) + '} = \\frac{' + b + '}{' + G.xm(-q) + '}') + 'What value of ' + m('x') + ' is the solution to the given equation?',
      ...G.mcNum(r, x, [
        { v: -x, why: 'This has the wrong sign.' },
        isInt((b * p + a * q) / (a + b)) ? { v: (b * p + a * q) / (a + b), why: 'This comes from a sign error while cross-multiplying.' } : { v: x + 2, why: 'Substitute this value back into the equation: the two sides are not equal.' },
        { v: p, why: 'This value makes the first denominator 0, so it cannot be a solution.' },
      ]),
      num: x,
      explanation: P('Cross-multiply: ' + m(a + '(' + G.xm(-q) + ') = ' + b + '(' + G.xm(p) + ')') + '.',
        'Distribute: ' + m(G.lin(a, a * q) + ' = ' + G.lin(b, -b * p)) + '. Collect terms: ' + m(G.lin(a - b, 0) + ' = ' + nt(-b * p - a * q)) + ', so ' + m('x = ' + nt(x)) + '.',
        'This value doesn’t make either denominator zero, so it is a valid solution.'),
    };
  });

  /* ==================================== eqv: equivalent expressions */
  add('eqv', 'E', (r) => {
    const a1 = r.int(2, 9), b1 = r.int(-9, 9), c1 = r.int(-9, 9), a2 = r.int(1, 6), b2 = nonzero(r, -8, 8), c2 = nonzero(r, -9, 9);
    const ok = G.poly([a1 - a2, b1 - b2, c1 - c2]);
    const cands = [
      { t: G.poly([a1 + a2, b1 + b2, c1 + c2]), why: 'This adds the polynomials instead of subtracting.' },
      { t: G.poly([a1 - a2, b1 + b2, c1 + c2]), why: 'This subtracts only the first term of the second polynomial; the negative must be distributed to every term.' },
      { t: G.poly([a1 - a2, b1 - b2, c1 + c2]), why: 'This forgets to distribute the negative to the constant term.' },
      { t: G.poly([a1 - a2, b1 + b2, c1 - c2]), why: 'This forgets to distribute the negative to the ' + m('x') + '-term.' },
    ].filter((c, i, arr) => c.t !== ok && arr.findIndex((z) => z.t === c.t) === i);
    return {
      stem: 'Which expression is equivalent to ' + m('(' + G.poly([a1, b1, c1]) + ') - (' + G.poly([a2, b2, c2]) + ')') + '?',
      ...G.mcText(r, ok, cands.slice(0, 3), { math: true }),
      explanation: P('Distribute the negative sign to every term in the second polynomial: ' + m(G.poly([a1, b1, c1]) + G.term(-a2, 'x^2', false) + G.term(-b2, 'x', false) + (c2 ? G.sgn(-c2) : '')) + '.',
        'Combine like terms: ' + m(ok) + '.'),
    };
  });

  add('eqv', 'E', (r) => {
    const k = r.pick([2, 3, 4, 5, -2, -3]), a = r.int(2, 6), b = nonzero(r, -9, 9);
    const ok = G.poly([k * a, k * b, 0]);
    return {
      stem: 'Which expression is equivalent to ' + m(nt(k) + 'x(' + G.lin(a, b) + ')') + '?',
      ...G.mcText(r, ok, [
        { t: G.poly([k * a, 0, b]), why: 'This distributes ' + m(nt(k) + 'x') + ' to the first term only.' },
        { t: G.poly([k * a, 0, k * b]), why: 'This multiplies ' + m(nt(b)) + ' by ' + m(nt(k)) + ' but not by ' + m('x') + '.' },
        { t: G.poly([k * a, k * b]), why: 'This forgets that ' + m('x\\cdot x = x^2') + '.' },
      ], { math: true }),
      explanation: P('Distribute ' + m(nt(k) + 'x') + ' to each term: ' + m(nt(k) + 'x\\cdot ' + a + 'x = ' + nt(k * a) + 'x^2') + ' and ' + m(nt(k) + 'x\\cdot ' + G.paren(b) + ' = ' + nt(k * b) + 'x') + '.', 'So the expression is equivalent to ' + m(ok) + '.'),
    };
  });

  add('eqv', 'M', (r) => {
    const a = r.pick([1, 2, 3, 4]), b = nonzero(r, -7, 7), c = r.pick([1, 2, 3, 5]), d = nonzero(r, -7, 7);
    const ok = G.poly([a * c, a * d + b * c, b * d]);
    const cands = [
      { t: G.poly([a * c, 0, b * d]), why: 'This omits the middle terms ' + m(G.lin(a * d, 0)) + ' and ' + m(G.lin(b * c, 0)) + ' that come from the "outer" and "inner" products.' },
      { t: G.poly([a * c, -(a * d + b * c), b * d]), why: 'This has the wrong sign on the ' + m('x') + '-term.' },
      { t: G.poly([a * c, a * d + b * c, -b * d]), why: 'This has the wrong sign on the constant term.' },
      { t: G.poly([a * c, a * b + c * d, b * d]), why: 'This multiplies the wrong pairs of terms for the ' + m('x') + '-term.' },
      { t: G.poly([a * c, a * d + b * c, b + d]), why: 'This adds the constant terms instead of multiplying them.' },
      { t: G.poly([a + c, a * d + b * c, b * d]), why: 'This adds the ' + m('x') + '-coefficients instead of multiplying them for the ' + m('x^2') + '-term.' },
      { t: G.poly([a * c, a * d - b * c, b * d]), why: 'This makes a sign error in one of the two middle products.' },
      { t: G.poly([a * c, b * c - a * d, b * d]), why: 'This makes a sign error in one of the two middle products.' },
    ].filter((z, i, arr) => z.t !== ok && arr.findIndex((y) => y.t === z.t) === i);
    return {
      stem: 'Which expression is equivalent to ' + m('(' + G.lin(a, b) + ')(' + G.lin(c, d) + ')') + '?',
      ...G.mcText(r, ok, cands.slice(0, 3), { math: true }),
      explanation: P('Multiply each term in the first binomial by each term in the second (FOIL):',
        m(G.lin(a, 0) + '\\cdot ' + G.lin(c, 0) + ' = ' + G.poly([a * c, 0, 0]) + ',\\quad ' + G.lin(a, 0) + '\\cdot ' + G.paren(d) + ' = ' + G.lin(a * d, 0) + ',\\quad ' + G.paren(b) + '\\cdot ' + G.lin(c, 0) + ' = ' + G.lin(b * c, 0) + ',\\quad ' + G.paren(b) + '\\cdot ' + G.paren(d) + ' = ' + nt(b * d)),
        'Combine like terms: ' + m(ok) + '.'),
    };
  });

  add('eqv', 'M', (r) => {
    if (r.bool()) {
      let a, b, c;
      do { a = r.int(2, 5); b = r.int(2, 4); c = r.int(1, 6); } while (new Set([a * b + c, a + b + c, a * b * c, a * (b + c)]).size < 4);
      const ok = 'x^{' + (a * b + c) + '}';
      return {
        stem: 'Which expression is equivalent to ' + m('(x^{' + a + '})^{' + b + '}\\cdot x^{' + c + '}') + '?',
        ...G.mcText(r, ok, [
          { t: 'x^{' + (a + b + c) + '}', why: 'This adds the exponents ' + m(a) + ' and ' + m(b) + '; raising a power to a power multiplies exponents.' },
          { t: 'x^{' + a * b * c + '}', why: 'This multiplies all three exponents; multiplying powers with the same base adds exponents.' },
          { t: 'x^{' + (a * (b + c)) + '}', why: 'This applies the outer exponent to ' + m('x^{' + c + '}') + ' as well.' },
        ].filter((z) => z.t !== ok), { math: true }),
        explanation: P('Power of a power: ' + m('(x^{' + a + '})^{' + b + '} = x^{' + a + '\\cdot' + b + '} = x^{' + a * b + '}') + '.', 'Product of powers: ' + m('x^{' + a * b + '}\\cdot x^{' + c + '} = x^{' + a * b + ' + ' + c + '} = ' + ok) + '.'),
      };
    }
    const pairs = [[2, 3], [3, 4], [2, 5], [3, 5], [4, 3], [5, 2], [3, 2], [5, 3]];
    const pw = (e) => (e === 1 ? 'x' : 'x^{' + e + '}');
    const [p, q] = r.pick(pairs);
    const root = (q === 2 ? '\\sqrt{' : '\\sqrt[' + q + ']{') + (p === 1 ? 'x' : 'x^{' + p + '}') + '}';
    return {
      stem: 'For ' + m('x > 0') + ', which expression is equivalent to ' + m(root) + '?',
      ...G.mcText(r, 'x^{\\frac{' + p + '}{' + q + '}}', [
        { t: 'x^{\\frac{' + q + '}{' + p + '}}', why: 'This inverts the fraction: the index of the root goes in the denominator.' },
        { t: pw(p - q), why: 'A root is not a subtraction of exponents.' },
        { t: pw(p * q), why: 'Taking a root divides the exponent; it does not multiply it.' },
      ], { math: true }),
      explanation: P('A root can be written as a fractional exponent: ' + m('\\sqrt[n]{x^m} = x^{\\frac{m}{n}}') + '.', 'So ' + m(root + ' = x^{\\frac{' + p + '}{' + q + '}}') + '.'),
    };
  });

  add('eqv', 'M', (r) => {
    const r1 = nonzero(r, -7, 7); let r2 = nonzero(r, -7, 7); if (r2 === r1 || r2 === -r1) r2 = r1 > 0 ? -(r1 + 1) : r1 + 8;
    if (r2 === 0 || r2 === r1 || r2 === -r1) r2 = 9;
    const ok = G.xm(r1);
    const roots = [r1, r2];
    const cand = [
      { v: -r1, why: 'If ' + m('x' + G.sgn(r1)) + ' were a factor, then ' + m('x = ' + -r1) + ' would make the expression 0, but it does not.' },
      { v: -r2, why: 'This factor has the wrong sign.' },
      { v: r1 * r2, why: 'This uses the constant term, which is the product of the zeros, not a zero.' },
      { v: r1 + r2, why: 'This uses the sum of the zeros.' },
      { v: r1 + 1, why: 'Substituting ' + m('x = ' + (r1 + 1)) + ' does not make the expression 0.' },
      { v: r2 - 1, why: 'Substituting ' + m('x = ' + (r2 - 1)) + ' does not make the expression 0.' },
      ...[2, -2, 3, -3, 4].map((k) => ({ v: r1 + k, why: 'Substituting ' + m('x = ' + (r1 + k)) + ' does not make the expression 0.' })),
    ].filter((c, i, arr) => !roots.includes(c.v) && c.v !== 0 && arr.findIndex((z) => z.v === c.v) === i);
    return {
      stem: 'Which of the following is a factor of ' + m(G.poly([1, -(r1 + r2), r1 * r2])) + '?',
      ...G.mcText(r, ok, cand.slice(0, 3).map((c) => ({ t: G.xm(c.v), why: c.why })), { math: true }),
      explanation: P('Find two numbers whose product is ' + m(nt(r1 * r2)) + ' and whose sum is ' + m(nt(-(r1 + r2))) + ': ' + m(nt(-r1)) + ' and ' + m(nt(-r2)) + '.',
        'So ' + m(G.poly([1, -(r1 + r2), r1 * r2]) + ' = (' + G.xm(r1) + ')(' + G.xm(r2) + ')') + ', and ' + m(ok) + ' is a factor.'),
    };
  });

  add('eqv', 'H', (r) => {
    const a = nonzero(r, -6, 6); let b = nonzero(r, -6, 6); if (b === a) b = a + 3; if (b === 0) b = 7;
    const diff = r.bool(0.4);
    const den = '(' + G.xm(-a) + ')(' + G.xm(-b) + ')';
    const expr = '\\frac{1}{' + G.xm(-a) + '} ' + (diff ? '-' : '+') + ' \\frac{1}{' + G.xm(-b) + '}';
    const ok = diff ? '\\frac{' + (b - a) + '}{' + den + '}' : '\\frac{' + G.lin(2, a + b) + '}{' + den + '}';
    return {
      stem: 'Which expression is equivalent to ' + m(expr) + ', for ' + m('x \\ne ' + -a) + ' and ' + m('x \\ne ' + -b) + '?',
      ...G.mcText(r, ok, diff ? [
        { t: '\\frac{' + (a - b) + '}{' + den + '}', why: 'This subtracts in the wrong order: the numerator is ' + m('(' + G.xm(-b) + ') - (' + G.xm(-a) + ')') + '.' },
        { t: '\\frac{' + (b - a) + '}{' + G.lin(2, a + b) + '}', why: 'This uses the sum of the denominators instead of their product as the common denominator.' },
        { t: '\\frac{' + G.lin(2, a + b) + '}{' + den + '}', why: 'This is the sum of the fractions, not the difference.' },
        { t: '\\frac{1}{' + den + '}', why: 'The numerators do not simply combine to 1; subtract ' + m(G.xm(-a)) + ' from ' + m(G.xm(-b)) + '.' },
      ].filter((z, i, arr) => z.t !== ok && arr.findIndex((y) => y.t === z.t) === i).slice(0, 3) : [
        { t: '\\frac{2}{' + G.lin(2, a + b) + '}', why: 'Fractions cannot be added by adding numerators and denominators separately.' },
        { t: '\\frac{2}{' + den + '}', why: 'Each numerator must be multiplied by the other fraction’s denominator before adding.' },
        { t: '\\frac{' + (a + b === 2 || a + b === 0 ? '2x' : a + b) + '}{' + den + '}', why: 'This drops ' + (a + b === 2 || a + b === 0 ? 'the constant terms' : 'the ' + m('x') + '-terms') + ' from the numerator.' },
        { t: '\\frac{1}{' + den + '}', why: 'The numerators must be rewritten over the common denominator before adding.' },
      ].filter((z, i, arr) => z.t !== ok && arr.findIndex((y) => y.t === z.t) === i).slice(0, 3), { math: true }),
      explanation: P('Use the common denominator ' + m(den) + ':',
        m('\\frac{' + G.xm(-b) + '}{' + den + '} ' + (diff ? '-' : '+') + ' \\frac{' + G.xm(-a) + '}{' + den + '} = ' + ok) + '.'),
    };
  });

  add('eqv', 'H', (r) => {
    const kind = r.int(0, 1);
    if (kind === 0) {
      const s = r.pick([1, 2, 3]), s2 = s * s, s4 = s2 * s2;
      return {
        stem: 'Which of the following is equivalent to ' + m('x^4 - ' + s4) + '?',
        ...G.mcText(r, '(x^2 + ' + s2 + ')(x + ' + s + ')(x - ' + s + ')', [
          { t: '(x^2 - ' + s2 + ')^2', why: 'This expands to ' + m('x^4 - ' + 2 * s2 + 'x^2 + ' + s4) + '.' },
          { t: '(x - ' + s + ')^4', why: 'This expands to a polynomial with ' + m('x^3') + ', ' + m('x^2') + ', and ' + m('x') + ' terms.' },
          { t: '(x^2 + ' + s2 + ')^2', why: 'This expands to ' + m('x^4 + ' + 2 * s2 + 'x^2 + ' + s4) + '.' },
        ], { math: true }),
        explanation: P('Use the difference of squares twice: ' + m('x^4 - ' + s4 + ' = (x^2)^2 - ' + s2 + '^2 = (x^2 + ' + s2 + ')(x^2 - ' + s2 + ')') + '.',
          'Then ' + m('x^2 - ' + s2 + ' = (x + ' + s + ')(x - ' + s + ')') + '. So the expression equals ' + m('(x^2 + ' + s2 + ')(x + ' + s + ')(x - ' + s + ')') + '. (' + m('x^2 + ' + s2) + ' does not factor over the real numbers.)'),
      };
    }
    const p = r.pick([2, 3, 4, 5]); let q = r.pick([1, 3, 5, 7]); if (q === p) q = 7;
    const A = p * p, B = q * q, Bs = B === 1 ? '' : B;
    return {
      stem: 'Which of the following is equivalent to ' + m(A + 'x^2 - ' + Bs + 'y^2') + '?',
      ...G.mcText(r, '(' + p + 'x + ' + (q === 1 ? '' : q) + 'y)(' + p + 'x - ' + (q === 1 ? '' : q) + 'y)', [
        { t: '(' + p + 'x - ' + (q === 1 ? '' : q) + 'y)^2', why: 'This expands to ' + m(A + 'x^2 - ' + 2 * p * q + 'xy + ' + Bs + 'y^2') + '.' },
        { t: '(' + A + 'x + ' + Bs + 'y)(x - y)', why: 'This expands to ' + m(A + 'x^2' + G.term(B - A, 'xy', false) + ' - ' + Bs + 'y^2') + ', which has an ' + m('xy') + '-term.' },
        { t: '(' + p + 'x + ' + (q === 1 ? '' : q) + 'y)^2', why: 'This expands to ' + m(A + 'x^2 + ' + 2 * p * q + 'xy + ' + Bs + 'y^2') + '.' },
      ], { math: true }),
      explanation: P('The expression is a difference of squares: ' + m(A + 'x^2 - ' + Bs + 'y^2 = (' + p + 'x)^2 - (' + (q === 1 ? '' : q) + 'y)^2') + '.', 'Using ' + m('a^2 - b^2 = (a + b)(a - b)') + ', it equals ' + m('(' + p + 'x + ' + (q === 1 ? '' : q) + 'y)(' + p + 'x - ' + (q === 1 ? '' : q) + 'y)') + '.'),
    };
  });

  add('eqv', 'H', (r) => {
    const a = r.pick([1, 2, -1, 3]), b = r.int(-5, 5), c = r.int(-6, 6), d = r.int(-9, 9), k = nonzero(r, -3, 3);
    const v = a * k * k * k + b * k * k + c * k + d;
    return {
      stem: 'The polynomial ' + m('p') + ' is defined by ' + m('p(x) = ' + G.poly([a, b, c, d])) + '. What is the remainder when ' + m('p(x)') + ' is divided by ' + m(G.xm(k)) + '?',
      ...G.mcNum(r, v, [
        { v: a * -k * k * k + b * k * k - c * k + d, why: 'This evaluates ' + m('p(' + -k + ')') + ' instead of ' + m('p(' + k + ')') + '; dividing by ' + m(G.xm(k)) + ' corresponds to ' + m('x = ' + k) + '.' },
        { v: d, why: 'This is the constant term, ' + m('p(0)') + '.' },
        { v: v + k, why: 'Recompute ' + m('p(' + k + ')') + ' carefully.' },
      ]),
      num: v,
      explanation: P('By the Remainder Theorem, the remainder when ' + m('p(x)') + ' is divided by ' + m('x - c') + ' is ' + m('p(c)') + '.',
        'Here ' + m('c = ' + k) + ': ' + m('p(' + k + ') = ' + [a ? (a === 1 ? '' : a === -1 ? '-' : nt(a)) + '(' + k + ')^3' : '', b ? G.sgn(b) + '(' + k + ')^2' : '', c ? G.sgn(c) + '(' + k + ')' : '', d ? G.sgn(d) : ''].join('').replace(/^ \+ /, '').replace(/^ - /, '-') + ' = ' + nt(v)) + '.'),
    };
  });

  add('eqv', 'H', (r) => {
    const a = r.int(2, 9), c = nonzero(r, -6, 6), b = r.int(-20, 25), k = b - a * c;
    if (k === 0) return G.gens.eqv.H[0](r);
    return {
      stem: 'The expression ' + m('\\frac{' + G.lin(a, b) + '}{' + G.xm(-c) + '}') + ' is equivalent to ' + m(a + ' + \\frac{k}{' + G.xm(-c) + '}') + ', where ' + m('k') + ' is a constant and ' + m('x \\ne ' + -c) + '. What is the value of ' + m('k') + '?',
      ...G.mcNum(r, k, [
        { v: b + a * c, why: 'This adds ' + m(a + '\\cdot' + G.paren(c)) + ' instead of subtracting it.' },
        { v: b, why: 'This ignores the part of the numerator absorbed by the whole-number term ' + m(a) + '.' },
        { v: -a * c, why: 'This is only the amount subtracted from ' + m(nt(b)) + '.' },
      ]),
      num: k,
      explanation: P('Write ' + m(a) + ' with the common denominator: ' + m(a + ' = \\frac{' + a + '(' + G.xm(-c) + ')}{' + G.xm(-c) + '} = \\frac{' + G.lin(a, a * c) + '}{' + G.xm(-c) + '}') + '.',
        'So ' + m(a + ' + \\frac{k}{' + G.xm(-c) + '} = \\frac{' + G.lin(a, a * c) + ' + k}{' + G.xm(-c) + '}') + '. Matching numerators: ' + m(nt(a * c) + ' + k = ' + nt(b)) + ', so ' + m('k = ' + nt(k)) + '.'),
    };
  });

  add('eqv', 'H', (r) => {
    const h = nonzero(r, -8, 8), c = r.int(-20, 60), b = 2 * h, k = c - h * h;
    return {
      stem: 'The expression ' + m(G.poly([1, b, c])) + ' can be rewritten as ' + m('(x + h)^2 + k') + ', where ' + m('h') + ' and ' + m('k') + ' are constants. What is the value of ' + m('k') + '?',
      ...G.mcNum(r, k, [
        { v: c + h * h, why: 'This adds ' + m('h^2') + ' instead of subtracting it.' },
        { v: c - b * b, why: 'This subtracts ' + m('b^2') + ' instead of ' + m('\\left(\\frac{b}{2}\\right)^2') + '.' },
        { v: h, why: 'This is the value of ' + m('h') + '.' },
      ]),
      num: k,
      explanation: P('Expand: ' + m('(x + h)^2 + k = x^2 + 2hx + h^2 + k') + '. Matching the ' + m('x') + '-terms, ' + m('2h = ' + b) + ', so ' + m('h = ' + h) + '.',
        'Matching constants: ' + m('h^2 + k = ' + c) + ', so ' + m('k = ' + c + ' - ' + h * h + ' = ' + k) + '.'),
    };
  });
})();
