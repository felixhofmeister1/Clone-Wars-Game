/* Algebra generators: linear equations in one variable, linear functions,
   linear equations in two variables, systems, and inequalities. */
(function () {
  'use strict';
  const SAT = window.SAT, G = SAT.mathgen, F = SAT.fig;
  const m = G.m, nt = G.nt, P = G.P, add = G.add;
  const nonzero = (r, a, b) => { let v = 0; while (v === 0) v = r.int(a, b); return v; };
  const moveConst = (b) => (b > 0 ? 'Subtract ' + m(nt(b)) + ' from each side' : 'Add ' + m(nt(-b)) + ' to each side');
  const isInt = (v) => Math.abs(v - Math.round(v)) < 1e-9;
  const intOr = (v, why) => (isInt(v) ? { v: Math.round(v), why } : null);

  /* ================================================ lin1: one variable */
  add('lin1', 'E', (r) => {
    const a = r.int(2, 9), x = r.pick([-5, -4, -3, -2, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    const b = nonzero(r, -18, 18), c = a * x + b;
    return {
      stem: 'If ' + m(G.lin(a, b) + ' = ' + nt(c)) + ', what is the value of ' + m('x') + '?',
      ...G.mcNum(r, x, [
        intOr((c + b) / a, 'This value comes from moving the constant ' + m(nt(b)) + ' to the other side without changing its sign.'),
        { v: c - b, why: 'This is the value of ' + m(a + 'x') + ', not ' + m('x') + '. Divide by ' + m(a) + ' to finish.' },
        { v: -x, why: 'This has the wrong sign; substitute it back into the equation to check.' },
      ]),
      num: x,
      explanation: P(moveConst(b) + ': ' + m(a + 'x = ' + nt(c - b)) + '.', 'Divide each side by ' + m(a) + ': ' + m('x = ' + nt(x)) + '.',
        'Check: ' + m(a + '(' + nt(x) + ')' + G.sgn(b) + ' = ' + nt(c)) + ' ✓'),
    };
  });

  const feeContexts = [
    { s: (F, R) => 'A plumber charges a one-time service fee of ' + G.money(F) + ' plus ' + G.money(R) + ' for each hour of work.', q: 'how many hours did the plumber work', u: 'hours' },
    { s: (F, R) => 'A bike rental shop charges ' + G.money(F) + ' to rent a bike plus ' + G.money(R) + ' for each hour the bike is rented.', q: 'for how many hours was the bike rented', u: 'hours' },
    { s: (F, R) => 'A gym charges a one-time sign-up fee of ' + G.money(F) + ' and a membership fee of ' + G.money(R) + ' per month.', q: 'for how many months has the member belonged to the gym', u: 'months' },
    { s: (F, R) => 'A moving company charges a flat fee of ' + G.money(F) + ' plus ' + G.money(R) + ' per hour for each move.', q: 'how many hours did the move take', u: 'hours' },
  ];
  add('lin1', 'E', (r) => {
    const c = r.pick(feeContexts), F0 = r.pick([40, 45, 50, 60, 75, 80, 90]), R = r.pick([25, 30, 35, 40, 45, 55, 60, 65]), h = r.int(2, 9);
    const T = F0 + R * h, naive = Math.round(T / R);
    return {
      stem: c.s(F0, R) + ' If the total charge was ' + G.money(T) + ', ' + c.q + '?',
      ...G.mcNum(r, h, [
        naive !== h ? { v: naive, why: 'This ignores the fixed fee of ' + G.money(F0) + ' and divides the whole total by ' + G.money(R) + '.' } : null,
        { v: h + 1, why: 'Multiply this by ' + G.money(R) + ' and add the fee: the total would be ' + G.money(F0 + R * (h + 1)) + ', not ' + G.money(T) + '.' },
        { v: h - 1, why: 'This gives a total of ' + G.money(F0 + R * (h - 1)) + ', which is too small.' },
      ].filter(Boolean)),
      num: h,
      explanation: P('Let ' + m('n') + ' be the number of ' + c.u + '. The total charge is the fixed fee plus the rate times ' + m('n') + ':',
        G.M(nt(F0) + ' + ' + nt(R) + 'n = ' + nt(T)),
        'Subtract ' + m(nt(F0)) + ' from each side: ' + m(nt(R) + 'n = ' + nt(T - F0)) + '. Divide by ' + m(nt(R)) + ': ' + m('n = ' + h) + '.'),
    };
  });

  add('lin1', 'M', (r) => {
    const a = r.int(2, 6), b = nonzero(r, -9, 9), p = r.int(2, 5);
    let x = r.int(-6, 10); if (a * x + b === 0) x += 1;
    const v = a * x + b;
    return {
      stem: 'If ' + m(G.lin(p * a, p * b) + ' = ' + nt(p * v)) + ', what is the value of ' + m(G.lin(a, b)) + '?',
      ...G.mcNum(r, v, [
        { v: x, why: 'This is the value of ' + m('x') + ', not the value of ' + m(G.lin(a, b)) + '.' },
        { v: p * v, why: 'This is the value of the entire left side, ' + m(G.lin(p * a, p * b)) + '.' },
        { v: -v, why: 'This has the wrong sign.' },
      ]),
      num: v,
      explanation: P('Notice that the left side is a multiple of the expression you want: ' + m(G.lin(p * a, p * b) + ' = ' + p + '(' + G.lin(a, b) + ')') + '.',
        'So ' + m(p + '(' + G.lin(a, b) + ') = ' + nt(p * v)) + '. Divide each side by ' + m(p) + ': ' + m(G.lin(a, b) + ' = ' + nt(v)) + '.',
        '(You could also solve for ' + m('x') + ' first — ' + m('x = ' + nt(x)) + ' — and substitute, but spotting the factor is faster.)'),
    };
  });

  add('lin1', 'M', (r) => {
    const x = r.int(-8, 10), a = r.int(2, 9);
    let c = r.int(-6, 9); while (c === a || c === 0) c = r.int(-6, 9);
    const b = r.int(-12, 12), d = (a - c) * x + b;
    const wrong = [
      a + c !== 0 ? intOr((d - b) / (a + c), 'This comes from adding ' + m(G.lin(c, 0)) + ' to both sides instead of subtracting it.') : null,
      intOr((d + b) / (a - c), 'This comes from a sign error when moving the constant ' + m(nt(b)) + '.'),
      { v: -x, why: 'This has the wrong sign.' },
    ].filter(Boolean);
    return {
      stem: 'What value of ' + m('x') + ' satisfies the equation ' + m(G.lin(a, b) + ' = ' + G.lin(c, d)) + '?',
      ...G.mcNum(r, x, wrong),
      num: x,
      explanation: P((c > 0 ? 'Subtract ' + m(G.lin(c, 0)) + ' from' : 'Add ' + m(G.lin(-c, 0)) + ' to') + ' each side to collect the ' + m('x') + '-terms: ' + m(G.lin(a - c, b) + ' = ' + nt(d)) + '.',
        (b !== 0 ? moveConst(b) + ': ' : '') + m(G.lin(a - c, 0) + ' = ' + nt(d - b)) + '.',
        'Divide by ' + m(nt(a - c)) + ': ' + m('x = ' + nt(x)) + '.'),
    };
  });

  add('lin1', 'M', (r) => {
    const pairs = [[2, 3], [2, 5], [3, 4], [3, 5], [2, 7], [4, 5], [3, 7], [5, 6], [4, 7], [5, 8]];
    const [p, q] = r.pick(pairs), k = r.int(1, 6), b = nonzero(r, -9, 9);
    const c = p * k, x = q * k - b;
    return {
      stem: G.M('\\frac{' + p + '}{' + q + '}(' + G.xm(-b) + ') = ' + c) + 'What value of ' + m('x') + ' is the solution to the given equation?',
      ...G.mcNum(r, x, [
        { v: q * k + b, why: 'This comes from adding ' + m(nt(b)) + ' instead of subtracting it in the last step.' },
        intOr((c * p) / q - b, 'This comes from multiplying by ' + m('\\frac{' + p + '}{' + q + '}') + ' instead of by its reciprocal.'),
        { v: q * k, why: 'This is the value of ' + m(G.xm(-b)) + ', not of ' + m('x') + '.' },
      ].filter(Boolean)),
      num: x,
      explanation: P('Multiply each side by the reciprocal ' + m('\\frac{' + q + '}{' + p + '}') + ': ' + m(G.xm(-b) + ' = ' + c + '\\cdot\\frac{' + q + '}{' + p + '} = ' + q * k) + '.',
        moveConst(b) + ': ' + m('x = ' + nt(x)) + '.'),
    };
  });

  add('lin1', 'H', (r) => {
    const u = r.int(2, 7), v = r.int(2, 9), p = r.int(1, 6);
    let s = r.int(-20, 30); if (s === (u + v) * p) s += 1;
    const k = u + v;
    return {
      stem: G.M('k(x + ' + p + ') - ' + u + 'x = ' + v + 'x' + G.sgn(s)) + 'In the given equation, ' + m('k') + ' is a constant. If the equation has no solution, what is the value of ' + m('k') + '?',
      ...G.mcNum(r, k, [
        { v: v - u, why: 'This comes from subtracting ' + m(u) + ' instead of adding it when solving ' + m('k - ' + u + ' = ' + v) + '.' },
        { v: v, why: 'This ignores the ' + m('-' + u + 'x') + ' term on the left side.' },
        { v: k + p, why: 'This value makes the ' + m('x') + '-coefficients unequal, so the equation would have exactly one solution.' },
      ]),
      num: k,
      explanation: P('Distribute and collect the ' + m('x') + '-terms on the left: ' + m('(k - ' + u + ')x + ' + p + 'k = ' + v + 'x' + G.sgn(s)) + '.',
        'A linear equation has <b>no solution</b> when the ' + m('x') + '-coefficients on each side are equal but the constant terms are different.',
        'So ' + m('k - ' + u + ' = ' + v) + ', which gives ' + m('k = ' + k) + '. Check the constants: ' + m(p + 'k = ' + p * k) + ' and ' + m(nt(s)) + ' are different, so there is indeed no solution.'),
    };
  });

  add('lin1', 'H', (r) => {
    const u = r.int(1, 5), v = u + r.int(2, 8), p = r.int(2, 7);
    const a = v - u, b = -a * p;
    return {
      stem: G.M('a(x - ' + p + ')' + G.term(u, 'x', false) + ' = ' + v + 'x + b') + 'In the given equation, ' + m('a') + ' and ' + m('b') + ' are constants. If the equation has infinitely many solutions, what is the value of ' + m('b') + '?',
      ...G.mcNum(r, b, [
        { v: -b, why: 'This has the wrong sign: the constant on the left is ' + m('-' + p + 'a') + '.' },
        { v: -(v + u) * p, why: 'This uses ' + m('a = ' + (v + u)) + ', which comes from adding ' + m(u) + ' instead of subtracting it.' },
        { v: a, why: 'This is the value of ' + m('a') + ', not ' + m('b') + '.' },
      ]),
      num: b,
      explanation: P('Distribute: ' + m('ax - ' + p + 'a' + G.term(u, 'x', false) + ' = ' + v + 'x + b') + ', so ' + m('(a + ' + u + ')x - ' + p + 'a = ' + v + 'x + b') + '.',
        'An equation has <b>infinitely many solutions</b> when both sides are identical: the ' + m('x') + '-coefficients match and the constants match.',
        m('a + ' + u + ' = ' + v) + ' gives ' + m('a = ' + a) + '. Then ' + m('b = -' + p + 'a = -' + p + '(' + a + ') = ' + b) + '.'),
    };
  });

  const literal = [
    { ctx: 'The formula ' + m('F = \\frac{9}{5}C + 32') + ' converts a temperature ' + m('C') + ', in degrees Celsius, to a temperature ' + m('F') + ', in degrees Fahrenheit.', target: 'C', given: 'F',
      ok: 'C = \\frac{5}{9}(F - 32)', wrong: [['C = \\frac{5}{9}F - 32', 'This subtracts 32 after scaling, but 32 must be subtracted before multiplying by ' + m('\\frac{5}{9}') + '.'], ['C = \\frac{9}{5}(F - 32)', 'This multiplies by ' + m('\\frac{9}{5}') + ' instead of by its reciprocal.'], ['C = \\frac{5F - 32}{9}', 'This does not multiply 32 by 5.']],
      steps: 'Subtract 32 from each side: ' + m('F - 32 = \\frac{9}{5}C') + '. Multiply each side by ' + m('\\frac{5}{9}') + ': ' + m('C = \\frac{5}{9}(F - 32)') + '.' },
    { ctx: 'The formula ' + m('v = u + at') + ' gives the final velocity ' + m('v') + ' of an object with initial velocity ' + m('u') + ' and constant acceleration ' + m('a') + ' after time ' + m('t') + '.', target: 'a', given: 'v, u, and t',
      ok: 'a = \\frac{v - u}{t}', wrong: [['a = \\frac{v + u}{t}', 'This adds ' + m('u') + ' instead of subtracting it.'], ['a = \\frac{v}{t} - u', 'This divides only ' + m('v') + ' by ' + m('t') + '.'], ['a = t(v - u)', 'This multiplies by ' + m('t') + ' instead of dividing.']],
      steps: 'Subtract ' + m('u') + ': ' + m('v - u = at') + '. Divide by ' + m('t') + ': ' + m('a = \\frac{v - u}{t}') + '.' },
    { ctx: 'The perimeter ' + m('P') + ' of a rectangle with length ' + m('L') + ' and width ' + m('W') + ' is given by ' + m('P = 2L + 2W') + '.', target: 'W', given: 'P and L',
      ok: 'W = \\frac{P - 2L}{2}', wrong: [['W = P - 2L', 'This forgets to divide by 2.'], ['W = \\frac{P - L}{2}', 'This subtracts ' + m('L') + ' instead of ' + m('2L') + '.'], ['W = \\frac{P}{2} - 2L', 'This divides only ' + m('P') + ' by 2.']],
      steps: 'Subtract ' + m('2L') + ': ' + m('P - 2L = 2W') + '. Divide by 2: ' + m('W = \\frac{P - 2L}{2}') + '.' },
    { ctx: 'The area ' + m('A') + ' of a triangle with base ' + m('b') + ' and height ' + m('h') + ' is given by ' + m('A = \\frac{1}{2}bh') + '.', target: 'h', given: 'A and b',
      ok: 'h = \\frac{2A}{b}', wrong: [['h = \\frac{A}{2b}', 'This divides by 2 instead of multiplying by 2.'], ['h = 2Ab', 'This multiplies by ' + m('b') + ' instead of dividing.'], ['h = \\frac{b}{2A}', 'This is the reciprocal of the correct expression.']],
      steps: 'Multiply each side by 2: ' + m('2A = bh') + '. Divide by ' + m('b') + ': ' + m('h = \\frac{2A}{b}') + '.' },
    { ctx: 'The sum ' + m('S') + ' of an arithmetic sequence with ' + m('n') + ' terms, first term ' + m('a') + ', and last term ' + m('\\ell') + ' is ' + m('S = \\frac{n}{2}(a + \\ell)') + '.', target: '\\ell', given: 'S, n, and a',
      ok: '\\ell = \\frac{2S}{n} - a', wrong: [['\\ell = \\frac{2S}{n} + a', 'This adds ' + m('a') + ' instead of subtracting it.'], ['\\ell = \\frac{S}{2n} - a', 'This divides by ' + m('2n') + ' instead of multiplying by ' + m('\\frac{2}{n}') + '.'], ['\\ell = \\frac{2S - a}{n}', 'This subtracts ' + m('a') + ' before dividing by ' + m('n') + '.']],
      steps: 'Multiply each side by ' + m('\\frac{2}{n}') + ': ' + m('\\frac{2S}{n} = a + \\ell') + '. Subtract ' + m('a') + ': ' + m('\\ell = \\frac{2S}{n} - a') + '.' },
  ];
  add('lin1', 'H', (r) => {
    const L = r.pick(literal);
    return {
      stem: L.ctx + ' Which equation correctly expresses ' + m(L.target) + ' in terms of ' + (L.given.length < 3 ? m(L.given) : L.given.replace(/\b([a-zA-Z])\b/g, (x) => m(x))) + '?',
      ...G.mcText(r, L.ok, L.wrong.map((w) => ({ t: w[0], why: w[1] })), { math: true }),
      explanation: P('Isolate ' + m(L.target) + ' by undoing operations in reverse order.', L.steps),
    };
  });

  /* ============================================== linf: linear functions */
  add('linf', 'E', (r) => {
    const a = r.pick([-5, -4, -3, -2, 2, 3, 4, 5, 6, 7, 8]), b = r.int(-12, 12), k = r.pick([-5, -4, -3, -2, 2, 3, 4, 5, 6]);
    const v = a * k + b;
    return {
      stem: 'The function ' + m('f') + ' is defined by ' + m('f(x) = ' + G.lin(a, b)) + '. What is the value of ' + m('f(' + k + ')') + '?',
      ...G.mcNum(r, v, [
        b !== 0 ? { v: a * k - b, why: 'This uses the wrong sign for the constant term ' + m(nt(b)) + '.' } : null,
        { v: a * (k + b), why: 'This multiplies ' + m(nt(a)) + ' by ' + m('(' + k + G.sgn(b) + ')') + ' instead of by ' + m(k) + ' alone.' },
        intOr((k - b) / a, 'This is the value of ' + m('x') + ' for which ' + m('f(x) = ' + k) + ', not ' + m('f(' + k + ')') + '.'),
      ].filter(Boolean)),
      num: v,
      explanation: P('Substitute ' + m(k) + ' for ' + m('x') + ': ' + m('f(' + k + ') = ' + nt(a) + '(' + k + ')' + G.sgn(b) + ' = ' + nt(a * k) + G.sgn(b) + ' = ' + nt(v)) + '.'),
    };
  });

  const interp = [
    { fn: (s, i) => 'C(h) = ' + s + 'h + ' + i, S: [12, 15, 18, 22, 25], I: [20, 30, 35, 40, 45], name: 'C(h)', desc: 'gives the total cost, in dollars, to rent a kayak for ' + m('h') + ' hours, including a one-time insurance fee.',
      slope: 'The cost, in dollars, per hour to rent a kayak', icpt: 'The one-time insurance fee, in dollars', wrong: ['The total cost, in dollars, to rent a kayak for 1 hour', 'The number of hours the kayak is rented'] },
    { fn: (s, i) => 'W(t) = ' + i + ' - ' + s + 't', S: [3, 4, 5, 6, 8], I: [120, 150, 180, 200, 240], name: 'W(t)', desc: 'gives the amount of water, in gallons, remaining in a tank ' + m('t') + ' minutes after a drain was opened.',
      slope: 'The number of gallons of water that drain from the tank each minute', icpt: 'The number of gallons of water in the tank when the drain was opened', wrong: ['The number of minutes it takes the tank to empty', 'The number of gallons remaining after 1 minute'] },
    { fn: (s, i) => 'H(w) = ' + i + ' + ' + s + 'w', S: [2, 3, 4, 5], I: [6, 8, 10, 12, 15], name: 'H(w)', desc: 'models the height, in centimeters, of a sunflower ' + m('w') + ' weeks after a student began measuring it.',
      slope: 'The number of centimeters the sunflower grows each week', icpt: 'The height, in centimeters, of the sunflower when the student began measuring it', wrong: ['The height, in centimeters, of the sunflower after 1 week', 'The number of weeks the student measured the sunflower'] },
    { fn: (s, i) => 'P(n) = ' + s + 'n - ' + i, S: [9, 12, 14, 16, 18], I: [150, 180, 210, 240], name: 'P(n)', desc: 'models a bakery’s daily profit, in dollars, from selling ' + m('n') + ' cakes.',
      slope: 'The profit, in dollars, the bakery earns for each cake sold', icpt: 'The bakery’s fixed daily costs, in dollars', wrong: ['The number of cakes the bakery must sell to make a profit', 'The bakery’s total daily profit, in dollars'] },
  ];
  add('linf', 'E', (r) => {
    const c = r.pick(interp), s = r.pick(c.S), i = r.pick(c.I), askSlope = r.bool();
    const num = askSlope ? s : i;
    const ok = askSlope ? c.slope : c.icpt, other = askSlope ? c.icpt : c.slope;
    return {
      stem: 'The function ' + m(c.fn(s, i)) + ' ' + c.desc + ' What is the best interpretation of ' + m(num) + ' in this context?',
      ...G.mcText(r, ok, [{ t: other, why: 'This describes the other number in the function.' }, { t: c.wrong[0], why: 'This is not a constant term or rate in the function.' }, { t: c.wrong[1], why: 'This is not what ' + m(num) + ' represents.' }]),
      explanation: P(askSlope ? 'In a linear function, the coefficient of the variable is the <b>rate of change</b>: how much the output changes when the input increases by 1. Here, ' + m(num) + ' is that rate, so it represents: ' + ok.toLowerCase() + '.'
        : 'The constant term is the output when the input is 0 (or, for a subtracted constant, a fixed amount that does not depend on the input). Here, ' + m(num) + ' represents: ' + ok.toLowerCase() + '.'),
    };
  });

  add('linf', 'M', (r) => {
    const mm = nonzero(r, -6, 6), b = r.int(-10, 10);
    const a1 = r.int(-4, 2), a2 = a1 + r.int(1, 4);
    let a3 = r.int(-6, 8); while (a3 === a1 || a3 === a2) a3++;
    const f = (x) => mm * x + b, v = f(a3);
    return {
      stem: 'For the linear function ' + m('f') + ', ' + m('f(' + a1 + ') = ' + f(a1)) + ' and ' + m('f(' + a2 + ') = ' + f(a2)) + '. What is the value of ' + m('f(' + a3 + ')') + '?',
      ...G.mcNum(r, v, [
        { v: -mm * a3 + b, why: 'This uses the wrong sign for the slope.' },
        { v: mm * a3, why: 'This omits the ' + m('y') + '-intercept, ' + m(nt(b)) + '.' },
        { v: f(a2) + mm, why: 'This adds the slope only once to ' + m('f(' + a2 + ')') + '.' },
      ]),
      num: v,
      explanation: P('Slope: ' + m('\\frac{' + nt(f(a2)) + ' - ' + G.paren(f(a1)) + '}{' + a2 + ' - ' + G.paren(a1) + '} = \\frac{' + nt(f(a2) - f(a1)) + '}{' + (a2 - a1) + '} = ' + nt(mm)) + '.',
        'So ' + m('f(x) = ' + nt(mm) + 'x + b') + '. Using ' + m('f(' + a1 + ') = ' + f(a1)) + ': ' + m(nt(f(a1)) + ' = ' + nt(mm) + '(' + a1 + ') + b') + ', so ' + m('b = ' + nt(b)) + '.',
        'Then ' + m('f(' + a3 + ') = ' + nt(mm) + '(' + a3 + ')' + G.sgn(b) + ' = ' + nt(v)) + '.'),
    };
  });

  add('linf', 'M', (r) => {
    const mm = r.pick([-4, -3, -2, -1, 2, 3, 4, 5]), b = nonzero(r, -9, 9), s = r.int(-2, 2), t = r.pick([1, 2]);
    const xs = [s, s + t, s + 2 * t];
    const table = F.table({ cols: [m('x'), m('f(x)')], rows: xs.map((x) => [m(nt(x)), m(nt(mm * x + b))]), rowHeads: false });
    const ok = 'f(x) = ' + G.lin(mm, b);
    const cands = [
      { t: 'f(x) = ' + G.lin(b, mm), why: 'This swaps the slope and the ' + m('y') + '-intercept.' },
      { t: 'f(x) = ' + G.lin(mm, -b), why: 'This has the wrong sign for the ' + m('y') + '-intercept.' },
      t === 2 ? { t: 'f(x) = ' + G.lin(mm * 2, b - mm * s), why: 'This uses the change in ' + m('f(x)') + ' between rows as the slope without dividing by the change in ' + m('x') + '.' } : { t: 'f(x) = ' + G.lin(-mm, b + 2 * mm * s), why: 'This uses the wrong sign for the slope.' },
      { t: 'f(x) = ' + G.lin(mm + 1, b), why: 'This slope does not match the table.' },
      { t: 'f(x) = ' + G.lin(mm, b + 2), why: 'This ' + m('y') + '-intercept does not match the table.' },
      { t: 'f(x) = ' + G.lin(-mm, -b), why: 'Both the slope and the ' + m('y') + '-intercept have the wrong sign.' },
    ].filter((c, i, arr) => c.t !== ok && arr.findIndex((z) => z.t === c.t) === i);
    return {
      stem: 'The table shows three values of ' + m('x') + ' and their corresponding values of ' + m('f(x)') + ' for the linear function ' + m('f') + '. Which equation defines ' + m('f') + '?',
      figure: table,
      ...G.mcText(r, ok, cands.slice(0, 3), { math: true }),
      explanation: P('Each time ' + m('x') + ' increases by ' + m(t) + ', ' + m('f(x)') + ' changes by ' + m(nt(mm * t)) + ', so the slope is ' + m('\\frac{' + nt(mm * t) + '}{' + t + '} = ' + nt(mm)) + '.',
        'Using the point ' + m('(' + s + ', ' + nt(mm * s + b) + ')') + ': ' + m(nt(mm * s + b) + ' = ' + nt(mm) + '(' + s + ') + b') + ', so ' + m('b = ' + nt(b)) + '. Therefore ' + m(ok) + '.'),
    };
  });

  add('linf', 'M', (r) => {
    const slopes = [[-3, 1], [-2, 1], [-1, 1], [-1, 2], [1, 2], [1, 1], [2, 1], [3, 1], [2, 3], [-2, 3]];
    const [mn, md] = r.pick(slopes), b = r.int(-3, 3);
    const f = (x) => (mn / md) * x + b;
    const pts = [];
    for (let x = -6; x <= 6; x++) if (isInt(f(x)) && Math.abs(f(x)) <= 6) pts.push([x, f(x)]);
    const fig = F.plane({ x0: -7, x1: 7, y0: -7, y1: 7, fns: [{ f }], labelEvery: 2, points: pts.slice(0, 1).concat(pts.slice(-1)) });
    const ok = 'f(x) = ' + G.flin(mn, md, b);
    const cands = [
      { t: 'f(x) = ' + G.flin(-mn, md, b), why: 'This line has the wrong direction: the graph ' + (mn > 0 ? 'rises' : 'falls') + ' from left to right.' },
      b !== 0 ? { t: 'f(x) = ' + G.flin(mn, md, -b), why: 'This has the wrong ' + m('y') + '-intercept; the graph crosses the ' + m('y') + '-axis at ' + m('(0, ' + b + ')') + '.' } : { t: 'f(x) = ' + G.flin(mn, md, 2), why: 'The graph passes through the origin, so the ' + m('y') + '-intercept is 0.' },
      Math.abs(mn) !== md ? { t: 'f(x) = ' + G.flin(md * Math.sign(mn), Math.abs(mn), b), why: 'This uses run over rise instead of rise over run.' } : { t: 'f(x) = ' + G.flin(2 * mn, md, b), why: 'This slope is too steep.' },
    ];
    return {
      stem: 'The graph of the linear function ' + m('f') + ' is shown. Which equation defines ' + m('f') + '?',
      figure: fig,
      ...G.mcText(r, ok, cands, { math: true }),
      explanation: P('The graph crosses the ' + m('y') + '-axis at ' + m('(0, ' + b + ')') + ', so the ' + m('y') + '-intercept is ' + m(b) + '.',
        'Pick two points on the line, such as ' + m('(' + pts[0][0] + ', ' + pts[0][1] + ')') + ' and ' + m('(' + pts[pts.length - 1][0] + ', ' + pts[pts.length - 1][1] + ')') + '. Slope ' + m('= \\frac{\\text{rise}}{\\text{run}} = ' + G.ftex(mn, md)) + '.',
        'So ' + m(ok) + '.'),
    };
  });

  add('linf', 'H', (r) => {
    const mm = nonzero(r, -5, 6), b = r.int(-9, 9), h = nonzero(r, -5, 5), k = nonzero(r, -8, 8);
    const v = -mm * h + b + k;
    return {
      stem: 'The function ' + m('f') + ' is defined by ' + m('f(x) = ' + G.lin(mm, b)) + '. The function ' + m('g') + ' is defined by ' + m('g(x) = f(' + G.xm(h) + ')' + G.sgn(k)) + '. What is the ' + m('y') + '-coordinate of the ' + m('y') + '-intercept of the graph of ' + m('y = g(x)') + ' in the ' + m('xy') + '-plane?',
      ...G.mcNum(r, v, [
        { v: mm * h + b + k, why: 'This evaluates ' + m('f(' + h + ')') + ' instead of ' + m('f(' + (-h) + ')') + '.' },
        { v: b + k, why: 'This ignores the horizontal shift inside ' + m('f') + '.' },
        { v: -mm * h + b - k, why: 'This subtracts ' + m(nt(k)) + ' instead of adding it.' },
      ]),
      num: v,
      explanation: P('The ' + m('y') + '-intercept occurs at ' + m('x = 0') + ': ' + m('g(0) = f(0' + G.sgn(-h) + ')' + G.sgn(k) + ' = f(' + (-h) + ')' + G.sgn(k)) + '.',
        m('f(' + (-h) + ') = ' + nt(mm) + '(' + (-h) + ')' + G.sgn(b) + ' = ' + nt(-mm * h + b)) + ', so ' + m('g(0) = ' + nt(-mm * h + b) + G.sgn(k) + ' = ' + nt(v)) + '.'),
    };
  });

  add('linf', 'H', (r) => {
    const ctx = r.pick([
      { what: 'A candle burns down at a constant rate.', st: (t, v) => 'After ' + t + ' hours of burning, the candle is ' + G.nw(v) + ' centimeters tall', q: 'the height of the candle, in centimeters, before it began burning', unit: 'centimeters', t: 'hours', rates: [0.5, 1, 1.5, 2, 2.5] },
      { what: 'Water drains from a tank at a constant rate.', st: (t, v) => t + ' minutes after the drain is opened, the tank holds ' + G.nw(v) + ' gallons', q: 'the number of gallons of water in the tank when it began draining', unit: 'gallons', t: 'minutes', rates: [2, 3, 4, 5, 6] },
      { what: 'A phone battery loses charge at a constant rate while a video plays.', st: (t, v) => t + ' hours after the video starts, the battery is at ' + G.nw(v) + ' percent', q: 'the battery’s charge, as a percent, when the video began', unit: 'percent', t: 'hours', rates: [4, 5, 6, 8, 10] },
    ]);
    const rate = r.pick(ctx.rates), even = !isInt(rate);
    let t1 = r.int(1, 4), t2 = t1 + r.int(2, 5);
    if (even) { t1 *= 2; t2 = t1 + 2 * r.int(1, 3); }
    const H0 = ctx.unit === 'percent' ? r.int(Math.ceil(rate * t2) + 10, 100) : Math.ceil(rate * t2) + r.int(4, 30);
    const h1 = H0 - rate * t1, h2 = H0 - rate * t2;
    return {
      stem: ctx.what + ' ' + ctx.st(t1, h1) + ', and ' + ctx.st(t2, h2).replace(/^After/, 'after') + '. Based on a linear model, what was ' + ctx.q + '?',
      ...G.mcNum(r, H0, [
        { v: h1 + rate, why: 'This adds back only one ' + ctx.t.slice(0, -1) + '’s worth of change.' },
        { v: h1 - rate * t1, why: 'This subtracts the change instead of adding it back.' },
        { v: h1 + (h1 - h2), why: 'This adds the change between the two measurements, which covers ' + (t2 - t1) + ' ' + ctx.t + ', not ' + t1 + '.' },
      ], { step: isInt(rate) ? 1 : 0.5 }),
      num: H0,
      explanation: P('Rate of change: ' + m('\\frac{' + nt(h2) + ' - ' + nt(h1) + '}{' + t2 + ' - ' + t1 + '} = ' + nt(-rate)) + ' ' + ctx.unit + ' per ' + ctx.t.slice(0, -1) + '.',
        'Work backward ' + t1 + ' ' + ctx.t + ' from the first measurement: ' + m(nt(h1) + ' + ' + nt(rate) + '(' + t1 + ') = ' + nt(H0)) + '.'),
    };
  });

  add('linf', 'H', (r) => {
    const mm = nonzero(r, -6, 7), b = r.int(-10, 10), p = r.int(3, 8), q = p - r.pick([1, 2, 3]);
    let k = r.int(-4, 9); if (k === 0) k = 5;
    const D = mm * (p - q), v = mm * k + b;
    return {
      stem: 'For the linear function ' + m('f') + ', ' + m('f(' + p + ') - f(' + q + ') = ' + nt(D)) + ' and ' + m('f(0) = ' + nt(b)) + '. What is the value of ' + m('f(' + k + ')') + '?',
      ...G.mcNum(r, v, [
        { v: D * k + b, why: 'This uses ' + m(nt(D)) + ' as the slope, but that difference covers ' + (p - q) + ' units of ' + m('x') + '.' },
        { v: mm * k - b, why: 'This subtracts the ' + m('y') + '-intercept.' },
        { v: mm * k, why: 'This omits the ' + m('y') + '-intercept.' },
      ]),
      num: v,
      explanation: P('For a linear function, ' + m('f(' + p + ') - f(' + q + ')') + ' equals the slope times ' + m(p + ' - ' + q + ' = ' + (p - q)) + '. So the slope is ' + m('\\frac{' + nt(D) + '}{' + (p - q) + '} = ' + nt(mm)) + '.',
        m('f(0) = ' + nt(b)) + ' is the ' + m('y') + '-intercept, so ' + m('f(x) = ' + G.lin(mm, b)) + ' and ' + m('f(' + k + ') = ' + nt(v)) + '.'),
    };
  });

  /* ======================================== lin2: lines in the plane */
  add('lin2', 'E', (r) => {
    const mm = r.pick([-4, -3, -2, 2, 3, 4, 5]), b = nonzero(r, -8, 8), x0 = r.pick([-3, -2, -1, 1, 2, 3, 4]);
    const y0 = mm * x0 + b;
    const pt = (a, c) => '(' + nt(a) + ', ' + nt(c) + ')';
    const cands = [
      { t: pt(x0, mm * x0 - b), why: 'Substituting ' + m('x = ' + x0) + ' gives ' + m('y = ' + nt(y0)) + ', not ' + m(nt(mm * x0 - b)) + '.' },
      { t: pt(x0, y0 + 1), why: 'Substituting ' + m('x = ' + x0) + ' gives ' + m('y = ' + nt(y0)) + '.' },
      { t: pt(y0, x0), why: 'This reverses the coordinates.' },
      { t: pt(x0 + 1, y0 - mm), why: 'For ' + m('x = ' + (x0 + 1)) + ', the line gives ' + m('y = ' + nt(y0 + mm)) + '.' },
    ].filter((c) => c.t !== pt(x0, y0));
    return {
      stem: 'Which point lies on the line defined by ' + m('y = ' + G.lin(mm, b)) + ' in the ' + m('xy') + '-plane?',
      ...G.mcText(r, pt(x0, y0), cands.slice(0, 3), { math: true }),
      explanation: P('A point lies on the line if its coordinates make the equation true. For ' + m(pt(x0, y0)) + ': ' + m(nt(mm) + '(' + x0 + ')' + G.sgn(b) + ' = ' + nt(y0)) + ' ✓'),
    };
  });

  add('lin2', 'E', (r) => {
    const mm = r.pick([-5, -4, -3, -2, 2, 3, 4, 6]); let b = nonzero(r, -9, 9); if (b === mm || b === -mm) b += 1; if (b === 0) b = 7;
    return {
      stem: 'A line in the ' + m('xy') + '-plane has a slope of ' + m(nt(mm)) + ' and passes through the point ' + m('(0, ' + nt(b) + ')') + '. Which equation defines the line?',
      ...G.mcText(r, 'y = ' + G.lin(mm, b), [
        { t: 'y = ' + G.lin(b, mm), why: 'This swaps the slope and the ' + m('y') + '-intercept.' },
        { t: 'y = ' + G.lin(mm, -b), why: 'This has the wrong ' + m('y') + '-intercept.' },
        { t: 'y = ' + G.lin(-mm, b), why: 'This has the wrong slope.' },
      ], { math: true }),
      explanation: P('In slope-intercept form ' + m('y = mx + b') + ', ' + m('m') + ' is the slope and ' + m('(0, b)') + ' is the ' + m('y') + '-intercept. So the line is ' + m('y = ' + G.lin(mm, b)) + '.'),
    };
  });

  add('lin2', 'M', (r) => {
    const a = nonzero(r, -9, 9); let b = r.pick([-7, -5, -4, -3, -2, 2, 3, 4, 5, 6, 7, 8]); if (Math.abs(a) === Math.abs(b)) b = b > 0 ? b + 1 : b - 1;
    const c = r.int(-20, 24);
    const [n, d] = G.frac(-a, b);
    return {
      stem: 'What is the slope of the graph of ' + m(G.lin(a, 0) + G.term(b, 'y', false) + ' = ' + nt(c)) + ' in the ' + m('xy') + '-plane?',
      ...G.mcNum(r, { v: n / d, tex: G.ftex(n, d) }, [
        { v: a / b, tex: G.ftex(a, b), why: 'This forgets the negative sign that comes from moving ' + m(G.lin(a, 0)) + ' to the other side.' },
        { v: -b / a, tex: G.ftex(-b, a), why: 'This is the negative reciprocal of the slope (the slope of a perpendicular line).' },
        { v: c / b, tex: G.ftex(c, b), why: 'This is the ' + m('y') + '-coordinate of the ' + m('y') + '-intercept, not the slope.' },
      ]),
      num: n / d, numShow: G.showNum(n / d),
      explanation: P('Solve for ' + m('y') + ': ' + m(G.term(b, 'y', true) + ' = ' + G.lin(-a, c)) + ', so ' + m('y = ' + G.flin(-a, b, 0) + G.fterm(c, b, '', false)) + '.',
        'The slope is the coefficient of ' + m('x') + ': ' + m(G.ftex(n, d)) + '. (Shortcut: for ' + m('Ax + By = C') + ', the slope is ' + m('-\\frac{A}{B}') + '.)'),
    };
  });

  add('lin2', 'M', (r) => {
    const mm = nonzero(r, -5, 5), b = r.int(-10, 10), x1 = r.int(-5, 3), x2 = x1 + r.int(1, 5);
    const y1 = mm * x1 + b, y2 = mm * x2 + b;
    return {
      stem: 'A line in the ' + m('xy') + '-plane passes through the points ' + m('(' + x1 + ', ' + y1 + ')') + ' and ' + m('(' + x2 + ', ' + y2 + ')') + '. What is the ' + m('y') + '-coordinate of the ' + m('y') + '-intercept of the line?',
      ...G.mcNum(r, b, [
        { v: y1 + mm * x1, why: 'This comes from a sign error when solving ' + m(y1 + ' = ' + nt(mm) + '(' + x1 + ') + b') + '.' },
        { v: mm, why: 'This is the slope of the line.' },
        { v: -b, why: 'This has the wrong sign.' },
      ]),
      num: b,
      explanation: P('Slope: ' + m('\\frac{' + y2 + ' - ' + G.paren(y1) + '}{' + x2 + ' - ' + G.paren(x1) + '} = ' + nt(mm)) + '.',
        'Substitute a point into ' + m('y = ' + nt(mm) + 'x + b') + ': ' + m(y1 + ' = ' + nt(mm) + '(' + x1 + ') + b = ' + nt(mm * x1) + ' + b') + ', so ' + m('b = ' + nt(b)) + '.'),
    };
  });

  add('lin2', 'M', (r) => {
    const items = r.pick([['pens', 'notebooks'], ['bagels', 'muffins'], ['postcards', 'posters'], ['granola bars', 'sandwiches']]);
    const p = r.pick([2, 3, 4, 5]); let q = r.pick([3, 5, 6, 7, 8, 9]); if (q === p) q += 1;
    const x = r.int(2, 12), n = r.int(1, 8), T = p * x + q * n;
    return {
      stem: 'A store sells ' + items[0] + ' for ' + G.money(p) + ' each and ' + items[1] + ' for ' + G.money(q) + ' each. The equation ' + m(p + 'x + ' + q + 'y = ' + T) + ' represents buying ' + m('x') + ' ' + items[0] + ' and ' + m('y') + ' ' + items[1] + ' for a total of ' + G.money(T) + '. If ' + n + ' ' + (n === 1 ? items[1].replace(/s$/, '') : items[1]) + ' were bought, how many ' + items[0] + ' were bought?',
      ...G.mcNum(r, x, [
        intOr((T - p * n) / q, 'This substitutes ' + m(n) + ' for ' + m('x') + ' instead of ' + m('y') + '.'),
        { v: Math.floor(T / p), why: 'This ignores the cost of the ' + items[1] + '.' },
        { v: T - q * n, why: 'This is the amount spent on ' + items[0] + ', in dollars, not the number bought.' },
      ].filter(Boolean)),
      num: x,
      explanation: P('Substitute ' + m('y = ' + n) + ': ' + m(p + 'x + ' + q + '(' + n + ') = ' + T) + ', so ' + m(p + 'x = ' + (T - q * n)) + ' and ' + m('x = ' + x) + '.'),
    };
  });

  add('lin2', 'M', (r) => {
    const a = r.pick([2, 3, 4, 5, 6]), b = r.pick([2, 3, 4, 5, 6, 8]), k = r.int(1, 4), c = a * b * k;
    const p = c / a, q = c / b;
    return {
      stem: 'The graph of ' + m(a + 'x + ' + b + 'y = ' + c) + ' in the ' + m('xy') + '-plane has an ' + m('x') + '-intercept at ' + m('(p, 0)') + ' and a ' + m('y') + '-intercept at ' + m('(0, q)') + '. What is the value of ' + m('p + q') + '?',
      ...G.mcNum(r, p + q, [
        { v: a + b, why: 'This adds the coefficients rather than finding the intercepts.' },
        p !== q ? { v: 2 * p, why: 'This uses the ' + m('x') + '-intercept twice.' } : null,
        p !== q ? { v: Math.abs(p - q), why: 'This subtracts the intercepts instead of adding them.' } : null,
        { v: c, why: 'This is the constant in the equation, not the sum of the intercepts.' },
      ].filter(Boolean)),
      num: p + q,
      explanation: P('At the ' + m('x') + '-intercept, ' + m('y = 0') + ': ' + m(a + 'p = ' + c) + ', so ' + m('p = ' + p) + '.', 'At the ' + m('y') + '-intercept, ' + m('x = 0') + ': ' + m(b + 'q = ' + c) + ', so ' + m('q = ' + q) + '.', 'So ' + m('p + q = ' + (p + q)) + '.'),
    };
  });

  add('lin2', 'H', (r) => {
    const opts = [[1, 2], [2, 3], [3, 2], [1, 3], [3, 4], [2, 5], [4, 3], [2, 1], [3, 1], [-1, 2], [-2, 3], [-3, 2]];
    const [p, q] = r.pick(opts), c = r.int(-6, 6);
    const x0 = p * r.pick([-3, -2, -1, 1, 2, 3]), y0 = r.int(-6, 8);
    const b = y0 + (q / p) * x0;
    return {
      stem: 'Line ' + m('k') + ' is defined by ' + m('y = ' + G.flin(p, q, c)) + '. Line ' + m('j') + ' is perpendicular to line ' + m('k') + ' and passes through the point ' + m('(' + x0 + ', ' + y0 + ')') + '. What is the ' + m('y') + '-coordinate of the ' + m('y') + '-intercept of line ' + m('j') + '?',
      ...G.mcNum(r, b, [
        { v: y0 - (q / p) * x0, why: 'This comes from a sign error when solving for the intercept.' },
        intOr(y0 - (p / q) * x0, 'This uses the slope of line ' + m('k') + '; that would give a parallel line, not a perpendicular one.'),
        { v: c, why: 'This is the ' + m('y') + '-intercept of line ' + m('k') + '.' },
      ].filter(Boolean)),
      num: b,
      explanation: P('Perpendicular lines have slopes that are negative reciprocals. The slope of ' + m('k') + ' is ' + m(G.ftex(p, q)) + ', so the slope of ' + m('j') + ' is ' + m(G.ftex(-q, p)) + '.',
        'Write ' + m('j') + ' as ' + m('y = ' + G.flin(-q, p, 0) + ' + b') + ' and substitute ' + m('(' + x0 + ', ' + y0 + ')') + ': ' + m(y0 + ' = ' + G.ftex(-q, p) + '(' + x0 + ') + b = ' + nt((-q / p) * x0) + ' + b') + '.',
        'So ' + m('b = ' + nt(b)) + '.'),
    };
  });

  add('lin2', 'H', (r) => {
    const a = r.pick([2, 3, 4, 5]); let b = r.pick([-5, -3, -2, 2, 3, 5, 7]); if (Math.abs(b) === a) b += 1;
    const x0 = r.int(-4, 5), y0 = r.int(-4, 5);
    const c2 = a * x0 + b * y0; let c = c2 + nonzero(r, -9, 9);
    const eq = (A, B, C) => G.lin(A, 0) + G.term(B, 'y', false) + ' = ' + nt(C);
    return {
      stem: 'In the ' + m('xy') + '-plane, line ' + m('\\ell') + ' is defined by ' + m(eq(a, b, c)) + '. Line ' + m('n') + ' is parallel to line ' + m('\\ell') + ' and passes through the point ' + m('(' + x0 + ', ' + y0 + ')') + '. Which equation defines line ' + m('n') + '?',
      ...G.mcText(r, eq(a, b, c2), [
        { t: eq(b, a, b * x0 + a * y0), why: 'Swapping the coefficients changes the slope, so this line is not parallel to ' + m('\\ell') + '.' },
        { t: eq(a, -b, a * x0 - b * y0), why: 'Changing the sign of the ' + m('y') + '-coefficient changes the slope.' },
        { t: eq(a, b, c), why: 'This is line ' + m('\\ell') + ' itself, which does not pass through ' + m('(' + x0 + ', ' + y0 + ')') + '.' },
      ], { math: true }),
      explanation: P('Parallel lines have the same slope, so line ' + m('n') + ' has the form ' + m(G.lin(a, 0) + G.term(b, 'y', false) + ' = C') + ' with the same coefficients.',
        'Substitute the point: ' + m('C = ' + a + '(' + x0 + ')' + G.sgn(b) + '(' + y0 + ') = ' + nt(c2)) + '. So line ' + m('n') + ' is ' + m(eq(a, b, c2)) + '.'),
    };
  });

  /* ============================================ sys: linear systems */
  add('sys', 'E', (r) => {
    const x = r.int(2, 14), y = r.int(-4, x - 1), s = x + y, d = x - y, askX = r.bool();
    const ans = askX ? x : y;
    return {
      stem: G.sys(['x + y = ' + s, 'x - y = ' + d]) + 'If ' + m('(x, y)') + ' is the solution to the given system, what is the value of ' + m(askX ? 'x' : 'y') + '?',
      ...G.mcNum(r, ans, [
        { v: askX ? y : x, why: 'This is the value of ' + m(askX ? 'y' : 'x') + '.' },
        { v: askX ? s + d : s - d, why: 'This forgets to divide by 2 after combining the equations.' },
        { v: askX ? s : d, why: 'This is the value of ' + m(askX ? 'x + y' : 'x - y') + '.' },
      ]),
      num: ans,
      explanation: P('Add the equations to eliminate ' + m('y') + ': ' + m('2x = ' + (s + d)) + ', so ' + m('x = ' + x) + '.', 'Substitute into ' + m('x + y = ' + s) + ': ' + m('y = ' + s + ' - ' + x + ' = ' + y) + '.'),
    };
  });

  add('sys', 'E', (r) => {
    const a = r.pick([-3, -2, 2, 3, 4]); let c = r.pick([-4, -1, 1, 5, 6]); if (c === a) c = -a;
    const x0 = r.pick([-3, -2, -1, 1, 2, 3, 4]), b = r.int(-6, 6), y0 = a * x0 + b, d = y0 - c * x0;
    const pt = (u, v) => '(' + nt(u) + ', ' + nt(v) + ')';
    const cands = [
      x0 !== y0 ? { t: pt(y0, x0), why: 'This reverses the coordinates.' } : null,
      { t: pt(-x0, a * -x0 + b), why: 'This point is on the first line only.' },
      { t: pt(x0, c * x0 + b), why: 'This mixes the slope of one line with the intercept of the other.' },
      { t: pt(x0 + 1, y0 + a), why: 'This point is on the first line only.' },
    ].filter((z) => z && z.t !== pt(x0, y0));
    return {
      stem: G.sys(['y = ' + G.lin(a, b), 'y = ' + G.lin(c, d)]) + 'What is the solution ' + m('(x, y)') + ' to the given system of equations?',
      ...G.mcText(r, pt(x0, y0), cands.slice(0, 3), { math: true }),
      explanation: P('Set the expressions for ' + m('y') + ' equal: ' + m(G.lin(a, b) + ' = ' + G.lin(c, d)) + '.',
        'Then ' + m(G.lin(a - c, 0) + ' = ' + nt(d - b)) + ', so ' + m('x = ' + x0) + '. Substitute: ' + m('y = ' + nt(a) + '(' + x0 + ')' + G.sgn(b) + ' = ' + nt(y0)) + '.'),
    };
  });

  add('sys', 'M', (r) => {
    const ctx = r.pick([
      { intro: 'A theater sold adult tickets for $A each and student tickets for $S each.', A: [10, 12, 14, 15, 18], S: [5, 6, 7, 8], n1: 'adult tickets', n2: 'student tickets', tot: 'tickets were sold' },
      { intro: 'A florist sold roses for $A each and tulips for $S each.', A: [4, 5, 6], S: [2, 3], n1: 'roses', n2: 'tulips', tot: 'flowers were sold' },
      { intro: 'A school fundraiser sold large candles for $A each and small candles for $S each.', A: [12, 15, 18, 20], S: [6, 8, 9], n1: 'large candles', n2: 'small candles', tot: 'candles were sold' },
    ]);
    const A = r.pick(ctx.A), S = r.pick(ctx.S), a = r.int(10, 60), s = r.int(10, 70), N = a + s, R = A * a + S * s;
    const askA = r.bool(), ans = askA ? a : s;
    return {
      stem: ctx.intro.replace('$A', () => G.money(A)).replace('$S', () => G.money(S)) + ' In all, ' + N + ' ' + ctx.tot + ' for a total of ' + G.money(R) + '. How many ' + (askA ? ctx.n1 : ctx.n2) + ' were sold?',
      ...G.mcNum(r, ans, [
        { v: askA ? s : a, why: 'This is the number of ' + (askA ? ctx.n2 : ctx.n1) + '.' },
        { v: Math.round(N / 2), why: 'This assumes equal numbers of each item were sold.' },
        intOr((R - S * N) / (A + S), 'This comes from adding the prices instead of subtracting them when eliminating a variable.'),
      ].filter(Boolean)),
      num: ans,
      explanation: P('Let ' + m('a') + ' = number of ' + ctx.n1 + ' and ' + m('s') + ' = number of ' + ctx.n2 + '.', G.sys(['a + s = ' + N, A + 'a + ' + S + 's = ' + R]),
        'Substitute ' + m('s = ' + N + ' - a') + ': ' + m(A + 'a + ' + S + '(' + N + ' - a) = ' + R) + ', so ' + m((A - S) + 'a = ' + (R - S * N)) + ' and ' + m('a = ' + a) + '. Then ' + m('s = ' + s) + '.'),
    };
  });

  add('sys', 'M', (r) => {
    const a = r.int(2, 7); let b = r.int(1, 6); if (b === a) b += 1;
    const x = r.int(-3, 8), y = r.int(-3, 8), p = a * x + b * y, q = b * x + a * y, sum = r.bool();
    const ans = sum ? x + y : x - y;
    return {
      stem: G.sys([G.lin(a, 0) + G.term(b, 'y', false) + ' = ' + p, G.lin(b, 0) + G.term(a, 'y', false) + ' = ' + q]) + 'If ' + m('(x, y)') + ' is the solution to the given system, what is the value of ' + m(sum ? 'x + y' : 'x - y') + '?',
      ...G.mcNum(r, ans, [
        { v: sum ? p + q : p - q, why: 'This forgets to divide by ' + m(sum ? a + b : a - b) + '.' },
        { v: x, why: 'This is the value of ' + m('x') + ' alone.' },
        { v: sum ? x - y : x + y, why: 'This is the value of ' + m(sum ? 'x - y' : 'x + y') + '.' },
      ]),
      num: ans,
      explanation: P((sum ? 'Add' : 'Subtract') + ' the two equations: ' + m((sum ? G.lin(a + b, 0) + G.term(a + b, 'y', false) : G.lin(a - b, 0) + G.term(b - a, 'y', false)) + ' = ' + nt(sum ? p + q : p - q)) + '.',
        'Factor: ' + m((sum ? a + b : a - b) + '(' + (sum ? 'x + y' : 'x - y') + ') = ' + nt(sum ? p + q : p - q)) + ', so ' + m((sum ? 'x + y' : 'x - y') + ' = ' + nt(ans)) + '.',
        'Looking for a combination of the equations is much faster than solving for each variable.'),
    };
  });

  add('sys', 'M', (r) => {
    const mm = r.pick([-3, -2, 2, 3, 4]), c = r.int(-6, 6), x0 = r.int(-3, 6), y0 = mm * x0 + c;
    const a = r.pick([1, 2, 3, 4, 5]), b = r.pick([1, 2, 3, -2, -1]); const k = a * x0 + b * y0;
    if (a + b * mm === 0) return G.gens.sys.M[0](r);
    const askY = r.bool(), ans = askY ? y0 : x0;
    return {
      stem: G.sys(['y = ' + G.lin(mm, c), G.lin(a, 0) + G.term(b, 'y', false) + ' = ' + nt(k)]) + 'The solution to the given system of equations is ' + m('(x, y)') + '. What is the value of ' + m(askY ? 'y' : 'x') + '?',
      ...G.mcNum(r, ans, [
        { v: askY ? x0 : y0, why: 'This is the value of ' + m(askY ? 'x' : 'y') + '.' },
        { v: -ans, why: 'This has the wrong sign.' },
        { v: ans + 2, why: 'Substitute back into both equations to check; this value does not work.' },
      ]),
      num: ans,
      explanation: P('Substitute ' + m(G.lin(mm, c)) + ' for ' + m('y') + ' in the second equation: ' + m(G.lin(a, 0) + (b === 1 ? ' + ' : b === -1 ? ' - ' : G.sgn(b)) + '(' + G.lin(mm, c) + ') = ' + nt(k)) + '.',
        'Simplify: ' + m(G.lin(a + b * mm, b * c) + ' = ' + nt(k)) + ', so ' + m('x = ' + x0) + '. Then ' + m('y = ' + nt(mm) + '(' + x0 + ')' + G.sgn(c) + ' = ' + nt(y0)) + '.'),
    };
  });

  add('sys', 'H', (r) => {
    const t = r.pick([2, 3, 4]), a = r.pick([2, 3, 4, 5, -2, -3]); let b = r.pick([1, 2, 3, 5, 7]); if (Math.abs(b) === Math.abs(a)) b += 1;
    const c1 = r.int(1, 15); let c2 = r.int(1, 40); if (c2 === t * c1) c2 += 1;
    return {
      stem: G.sys(['kx' + G.term(b, 'y', false) + ' = ' + c1, G.lin(t * a, 0) + G.term(t * b, 'y', false) + ' = ' + c2]) + 'In the given system of equations, ' + m('k') + ' is a constant. If the system has no solution, what is the value of ' + m('k') + '?',
      ...G.mcNum(r, a, [
        { v: t * a, why: 'This makes the ' + m('x') + '-coefficients equal, but the ' + m('y') + '-coefficients are not equal, so the lines would intersect.' },
        { v: -a, why: 'This has the wrong sign.' },
        { v: b, why: 'This makes the ' + m('x') + '- and ' + m('y') + '-coefficients of the first equation equal, which is not the condition for no solution.' },
      ]),
      num: a,
      explanation: P('A system of two linear equations has <b>no solution</b> when the lines are parallel and distinct: the coefficients are proportional but the constants are not.',
        'The ' + m('y') + '-coefficients are ' + m(b) + ' and ' + m(t * b) + ', a ratio of ' + m('1 : ' + t) + '. So the ' + m('x') + '-coefficients must have the same ratio: ' + m(t + 'k = ' + t * a) + ', so ' + m('k = ' + a) + '.',
        'Check: ' + m(t + '\\cdot' + c1 + ' = ' + t * c1 + ' \\ne ' + c2) + ', so the lines are distinct and the system has no solution.'),
    };
  });

  add('sys', 'H', (r) => {
    const ratios = [[3, 2], [2, 1], [1, 2], [3, 1], [5, 2], [2, 3], [4, 3]];
    const [p, q] = r.pick(ratios); // eq2 = (p/q) * eq1
    const B1 = q * r.int(1, 4), A2 = p * r.int(1, 5), C1 = q * r.int(1, 6);
    const a = (A2 * q) / p, B2 = (B1 * p) / q, bb = (C1 * p) / q;
    return {
      stem: G.sys(['ax' + G.term(B1, 'y', false) + ' = ' + C1, G.lin(A2, 0) + G.term(B2, 'y', false) + ' = b']) + 'In the given system of equations, ' + m('a') + ' and ' + m('b') + ' are constants. If the system has infinitely many solutions, what is the value of ' + m('a + b') + '?',
      ...G.mcNum(r, a + bb, [
        { v: A2 + C1, why: 'This assumes ' + m('a') + ' and ' + m('b') + ' match the other equation’s numbers directly, but the equations are multiples of each other, not identical.' },
        { v: a, why: 'This is the value of ' + m('a') + ' only.' },
        { v: bb, why: 'This is the value of ' + m('b') + ' only.' },
      ]),
      num: a + bb,
      explanation: P('Infinitely many solutions means the two equations describe the same line, so one equation is a constant multiple of the other.',
        'Compare the ' + m('y') + '-coefficients: ' + m('\\frac{' + B2 + '}{' + B1 + '} = ' + G.ftex(p, q)) + '. So the second equation is ' + m(G.ftex(p, q)) + ' times the first.',
        m(G.ftex(p, q) + 'a = ' + A2) + ' gives ' + m('a = ' + nt(a)) + ', and ' + m('b = ' + G.ftex(p, q) + '\\cdot' + C1 + ' = ' + nt(bb)) + '. So ' + m('a + b = ' + nt(a + bb)) + '.'),
    };
  });

  add('sys', 'H', (r) => {
    const pcts = [10, 15, 20, 25, 30, 40, 50, 60];
    let p1, p2, p, V, x;
    for (let tries = 0; tries < 200; tries++) {
      p1 = r.pick(pcts); p2 = r.pick(pcts.filter((v) => v > p1)); if (!p2) continue;
      p = r.pick(pcts.filter((v) => v > p1 && v < p2)); if (!p) continue;
      V = r.pick([10, 12, 20, 24, 30, 40, 50, 60]);
      x = (V * (p2 - p)) / (p2 - p1);
      if (isInt(x)) break;
    }
    if (!isInt(x) || !p) { p1 = 10; p2 = 30; p = 25; V = 20; x = 5; }
    return {
      stem: 'A chemist mixes a ' + p1 + '% saline solution with a ' + p2 + '% saline solution to make ' + V + ' liters of a ' + p + '% saline solution. How many liters of the ' + p1 + '% solution does the chemist use?',
      ...G.mcNum(r, x, [
        { v: V - x, why: 'This is the amount of the ' + p2 + '% solution.' },
        { v: V / 2, why: 'This assumes equal amounts of each solution, which would give a ' + (p1 + p2) / 2 + '% mixture.' },
        { v: G.clean((V * p) / 100), why: 'This is the number of liters of pure salt in the final mixture, not the amount of the ' + p1 + '% solution.' },
      ]),
      num: x,
      explanation: P('Let ' + m('x') + ' = liters of ' + p1 + '% solution and ' + m('y') + ' = liters of ' + p2 + '% solution.',
        G.sys(['x + y = ' + V, (p1 / 100) + 'x + ' + (p2 / 100) + 'y = ' + (p / 100) + '(' + V + ')']),
        'Substitute ' + m('y = ' + V + ' - x') + ': ' + m((p1 / 100) + 'x + ' + (p2 / 100) + '(' + V + ' - x) = ' + G.clean((p * V) / 100)) + ', so ' + m(G.clean((p2 - p1) / 100) + 'x = ' + G.clean(((p2 - p) * V) / 100)) + ' and ' + m('x = ' + x) + '.'),
    };
  });

  /* ======================================= ineq: linear inequalities */
  add('ineq', 'E', (r) => {
    const a = r.int(2, 8), t = nonzero(r, -6, 9), b = nonzero(r, -15, 15), c = a * t + b;
    const op = r.pick(['\\le', '\\ge', '<', '>']);
    const flip = { '\\le': '\\ge', '\\ge': '\\le', '<': '>', '>': '<' };
    const wrongT = (c + b) / a;
    const cands = [
      { t: 'x ' + flip[op] + ' ' + nt(t), why: 'This reverses the inequality. Dividing by a positive number does not change its direction.' },
      isInt(wrongT) && wrongT !== t ? { t: 'x ' + op + ' ' + nt(wrongT), why: 'This comes from a sign error when moving ' + m(nt(b)) + '.' } : { t: 'x ' + op + ' ' + nt(c - b), why: 'This forgets to divide by ' + m(a) + '.' },
      isInt(wrongT) && wrongT !== t ? { t: 'x ' + flip[op] + ' ' + nt(wrongT), why: 'This reverses the inequality and makes a sign error.' } : { t: 'x ' + flip[op] + ' ' + nt(c - b), why: 'This reverses the inequality and forgets to divide.' },
    ];
    return {
      stem: 'Which of the following describes all solutions to the inequality ' + m(G.lin(a, b) + ' ' + op + ' ' + nt(c)) + '?',
      ...G.mcText(r, 'x ' + op + ' ' + nt(t), cands, { math: true }),
      explanation: P(moveConst(b) + ': ' + m(a + 'x ' + op + ' ' + nt(c - b)) + '.', 'Divide by ' + m(a) + ' (positive, so the inequality keeps its direction): ' + m('x ' + op + ' ' + nt(t)) + '.'),
    };
  });

  add('ineq', 'E', (r) => {
    const ctx = r.pick([
      { s: (W, D, B) => 'An elevator can safely carry at most ' + G.nw(W) + ' pounds. A worker who weighs ' + D + ' pounds loads ' + m('n') + ' boxes that each weigh ' + B + ' pounds into the elevator and rides with them.', W: [1500, 2000, 2500], D: [160, 175, 190, 210], B: [40, 45, 50, 60], q: 'the number of boxes, ' + m('n') + ', that the worker can safely take' },
      { s: (W, D, B) => 'Jada has a gift card worth ' + G.money(W) + '. She pays a shipping fee of ' + G.money(D) + ' and buys ' + m('n') + ' shirts that cost ' + G.money(B) + ' each.', W: [100, 120, 150, 200], D: [6, 8, 9, 12], B: [14, 18, 22, 25], q: 'the number of shirts, ' + m('n') + ', Jada can buy without spending more than the value of the gift card' },
      { s: (W, D, B) => 'A small truck can carry at most ' + G.nw(W) + ' kilograms. The driver’s equipment weighs ' + D + ' kilograms, and each crate of apples weighs ' + B + ' kilograms.', W: [800, 1000, 1200], D: [60, 75, 90], B: [18, 20, 24, 25], q: 'the number of crates, ' + m('n') + ', the truck can carry along with the equipment' },
    ]);
    const W = r.pick(ctx.W), D = r.pick(ctx.D), B = r.pick(ctx.B);
    return {
      stem: ctx.s(W, D, B) + ' Which inequality represents ' + ctx.q + '?',
      ...G.mcText(r, nt(D) + ' + ' + B + 'n \\le ' + nt(W), [
        { t: nt(D) + ' + ' + B + 'n \\ge ' + nt(W), why: 'The total must be <i>at most</i> the limit, so the inequality should be ' + m('\\le') + '.' },
        { t: B + 'n \\le ' + nt(D) + ' + ' + nt(W), why: 'This adds ' + m(nt(D)) + ' to the limit instead of to the total being carried.' },
        { t: nt(D) + 'n + ' + B + ' \\le ' + nt(W), why: 'This multiplies the wrong quantity by ' + m('n') + '.' },
      ], { math: true }),
      explanation: P('The total is the fixed amount ' + m(nt(D)) + ' plus ' + m(B) + ' for each of the ' + m('n') + ' items: ' + m(nt(D) + ' + ' + B + 'n') + '.', '"At most" means less than or equal to, so ' + m(nt(D) + ' + ' + B + 'n \\le ' + nt(W)) + '.'),
    };
  });

  add('ineq', 'M', (r) => {
    const T = r.pick([40, 50, 60, 75, 80, 100]), Fee = r.pick([8, 10, 12, 15, 18]), s = r.pick([3, 4, 6, 7, 9]);
    const exact = (T - Fee) / s, ans = Math.floor(exact);
    const who = r.pick(['Ana', 'Marcus', 'Priya', 'Diego', 'Keiko']);
    return {
      stem: who + ' has ' + G.money(T) + ' to spend at a fair. Admission costs ' + G.money(Fee) + ', and each ride ticket costs ' + G.money(s) + '. What is the maximum number of ride tickets ' + who + ' can buy after paying admission?',
      ...G.mcNum(r, ans, [
        !isInt(exact) ? { v: Math.ceil(exact), why: 'Rounding up would cost ' + G.money(Fee + s * Math.ceil(exact)) + ', which is more than ' + G.money(T) + '.' } : { v: ans + 1, why: 'This would cost more than ' + G.money(T) + '.' },
        { v: Math.floor(T / s), why: 'This ignores the admission cost.' },
        { v: ans - 1, why: 'This is not the maximum; one more ticket is still affordable.' },
      ]),
      num: ans,
      explanation: P('Let ' + m('n') + ' = number of tickets: ' + m(Fee + ' + ' + s + 'n \\le ' + T) + ', so ' + m(s + 'n \\le ' + (T - Fee)) + ' and ' + m('n \\le ' + (isInt(exact) ? exact : G.ftex(T - Fee, s) + ' \\approx ' + exact.toFixed(2))) + '.',
        'The number of tickets must be a whole number, so the maximum is ' + m(ans) + '.'),
    };
  });

  add('ineq', 'M', (r) => {
    const m1 = r.pick([-2, -1, 1, 2, 3]), b1 = r.int(-3, 2), m2 = r.pick([-3, -2, -1, 0, 1]), b2 = b1 + r.int(4, 8);
    const s1 = r.pick(['<', '\\le']), s2 = r.pick(['>', '\\ge']);
    const ok1 = (x, y) => (s2 === '>' ? y > m1 * x + b1 : y >= m1 * x + b1);
    const ok2 = (x, y) => (s1 === '<' ? y < m2 * x + b2 : y <= m2 * x + b2);
    const good = [], bad = [];
    for (let x = -5; x <= 5; x++) for (let y = -8; y <= 12; y++) {
      if (ok1(x, y) && ok2(x, y)) good.push([x, y]);
      else if (Math.abs(y - (m1 * x + b1)) <= 4 || Math.abs(y - (m2 * x + b2)) <= 4) bad.push([x, y]);
    }
    const g = r.pick(good), bads = r.sample(bad, 3);
    const pt = (p) => '(' + p[0] + ', ' + p[1] + ')';
    const reason = (p) => (!ok1(p[0], p[1]) ? 'It does not satisfy ' + m('y ' + s2 + ' ' + G.lin(m1, b1)) + ': ' + m(p[1] + ' ' + (s2 === '>' ? '\\not>' : '\\not\\ge') + ' ' + nt(m1 * p[0] + b1)) + '.'
      : 'It does not satisfy ' + m('y ' + s1 + ' ' + G.lin(m2, b2)) + ': ' + m(p[1] + ' ' + (s1 === '<' ? '\\not<' : '\\not\\le') + ' ' + nt(m2 * p[0] + b2)) + '.');
    return {
      stem: G.sys(['y ' + s2 + ' ' + G.lin(m1, b1), 'y ' + s1 + ' ' + G.lin(m2, b2)]) + 'Which point ' + m('(x, y)') + ' is a solution to the given system of inequalities?',
      ...G.mcText(r, pt(g), bads.map((p) => ({ t: pt(p), why: reason(p) })), { math: true }),
      explanation: P('Test each point in <i>both</i> inequalities. For ' + m(pt(g)) + ': ' + m(g[1] + ' ' + s2 + ' ' + nt(m1 * g[0] + b1)) + ' ✓ and ' + m(g[1] + ' ' + s1 + ' ' + nt(m2 * g[0] + b2)) + ' ✓.'),
    };
  });

  add('ineq', 'M', (r) => {
    const n = r.pick([3, 4]), goal = r.pick([80, 82, 85, 88, 90]);
    let scores, need;
    for (let i = 0; i < 100; i++) {
      scores = Array.from({ length: n }, () => r.int(70, 98));
      need = goal * (n + 1) - scores.reduce((a, b) => a + b, 0);
      if (need >= 60 && need <= 100) break;
    }
    const sum = scores.reduce((a, b) => a + b, 0);
    return {
      stem: 'A student’s scores on the first ' + n + ' tests of a course are ' + scores.join(', ') + '. What is the minimum score the student needs on test ' + (n + 1) + ' so that the mean of all ' + (n + 1) + ' scores is at least ' + goal + '?',
      ...G.mcNum(r, need, [
        { v: goal, why: 'Scoring exactly the goal would only work if the other scores already averaged ' + goal + '.' },
        { v: Math.round(sum / n), why: 'This is (about) the mean of the first ' + n + ' scores, not the score needed.' },
        { v: need + 2, why: 'This score works, but it is not the minimum.' },
        { v: need - 3, why: 'This would make the mean less than ' + goal + '.' },
      ]),
      num: need,
      explanation: P('For the mean to be at least ' + goal + ': ' + m('\\frac{' + sum + ' + x}{' + (n + 1) + '} \\ge ' + goal) + '.', 'Multiply by ' + (n + 1) + ': ' + m(sum + ' + x \\ge ' + goal * (n + 1)) + ', so ' + m('x \\ge ' + need) + '.'),
    };
  });

  add('ineq', 'H', (r) => {
    const k = r.pick([2, 3, 4, 5]), c = nonzero(r, -9, 9), L = r.int(-4, 6), U = L + r.int(2, 5);
    const p = k * L + c, q = k * U + c, mid = (L + U) / 2;
    return {
      stem: 'If ' + m(nt(p) + ' < ' + G.lin(k, c) + ' < ' + nt(q)) + ', what is one possible value of ' + m('x') + '?',
      ...G.mcNum(r, Math.floor(mid) === L ? L + 1 : Math.floor(mid), [
        { v: L, why: 'The inequality is strict, so ' + m('x') + ' cannot equal ' + m(L) + '.' },
        { v: U + 1, why: 'This is greater than the upper bound, ' + m(U) + '.' },
        { v: L - 2, why: 'This is less than the lower bound, ' + m(L) + '.' },
      ]),
      num: mid, range: [L, U, false, false], numShow: 'Any number greater than ' + L + ' and less than ' + U + ' (for example, ' + G.showNum(mid).split(',')[0] + ')',
      explanation: P(moveConst(c).replace('each side', 'every part') + ' of the compound inequality: ' + m(nt(p - c) + ' < ' + k + 'x < ' + nt(q - c)) + '.', 'Divide every part by ' + m(k) + ': ' + m(L + ' < x < ' + U) + '. Any value strictly between ' + m(L) + ' and ' + m(U) + ' works.'),
    };
  });

  add('ineq', 'H', (r) => {
    const a = r.pick([12, 15, 18, 20]), b = r.pick([9, 10, 11, 13]), E = r.pick([300, 360, 400, 450]), Hh = r.pick([25, 30, 32, 35]);
    const who = r.pick(['Sam', 'Leila', 'Tomas', 'Ruth']);
    return {
      stem: who + ' earns ' + G.money(a) + ' per hour tutoring and ' + G.money(b) + ' per hour working at a café. ' + who + ' wants to earn at least ' + G.money(E) + ' per week but can work at most ' + Hh + ' hours per week. If ' + m('x') + ' is the number of hours tutoring and ' + m('y') + ' is the number of hours at the café, which system of inequalities represents this situation?',
      ...G.mcText(r, '\\begin{aligned}' + a + 'x + ' + b + 'y &\\ge ' + E + '\\\\ x + y &\\le ' + Hh + '\\end{aligned}', [
        { t: '\\begin{aligned}' + a + 'x + ' + b + 'y &\\le ' + E + '\\\\ x + y &\\le ' + Hh + '\\end{aligned}', why: '"At least" ' + G.money(E) + ' means earnings must be greater than or equal to ' + E + '.' },
        { t: '\\begin{aligned}' + a + 'x + ' + b + 'y &\\ge ' + E + '\\\\ x + y &\\ge ' + Hh + '\\end{aligned}', why: '"At most" ' + Hh + ' hours means the total hours must be less than or equal to ' + Hh + '.' },
        { t: '\\begin{aligned}' + b + 'x + ' + a + 'y &\\ge ' + E + '\\\\ x + y &\\le ' + Hh + '\\end{aligned}', why: 'This swaps the hourly rates: ' + m('x') + ' is tutoring hours, which pay ' + G.money(a) + '.' },
      ], { math: true }),
      explanation: P('Earnings: ' + m(a + 'x + ' + b + 'y') + ' must be <i>at least</i> ' + E + ', so ' + m(a + 'x + ' + b + 'y \\ge ' + E) + '.', 'Hours: ' + m('x + y') + ' must be <i>at most</i> ' + Hh + ', so ' + m('x + y \\le ' + Hh) + '.'),
    };
  });
})();
