/* Geometry and Trigonometry generators: area and volume; lines, angles,
   and triangles; right triangles and trigonometry; circles. */
(function () {
  'use strict';
  const SAT = window.SAT, G = SAT.mathgen, F = SAT.fig;
  const m = G.m, nt = G.nt, P = G.P, add = G.add;
  const isInt = (v) => Math.abs(v - Math.round(v)) < 1e-9;
  const piC = (k, why) => ({ v: k, tex: G.pi(k), why }); // choice expressed as k*pi

  /* ================================================ av: area and volume */
  add('av', 'E', (r) => {
    const L = r.int(4, 20); let W = r.int(2, 15); if (W === L) W += 1;
    const A = L * W, per = 2 * (L + W);
    return {
      stem: 'A rectangle has an area of ' + A + ' square centimeters and a length of ' + L + ' centimeters. What is the perimeter, in centimeters, of the rectangle?',
      ...G.mcNum(r, per, [
        { v: L + W, why: 'This adds the length and width once; the perimeter includes each side twice.' },
        { v: W, why: 'This is the width of the rectangle.' },
        { v: 2 * L + W, why: 'This counts the width only once.' },
      ]),
      num: per,
      explanation: P('Width: ' + m('\\frac{' + A + '}{' + L + '} = ' + W) + ' centimeters.', 'Perimeter: ' + m('2(' + L + ') + 2(' + W + ') = ' + per) + ' centimeters.'),
    };
  });

  add('av', 'E', (r) => {
    const l = r.int(3, 12), w = r.int(2, 9), h = r.int(2, 10), V = l * w * h;
    return {
      stem: 'The rectangular prism shown has a length of ' + l + ' inches, a width of ' + w + ' inches, and a height of ' + h + ' inches. What is the volume, in cubic inches, of the prism?',
      figure: F.prism({ l: l + ' in', w: w + ' in', h: h + ' in' }),
      ...G.mcNum(r, V, [
        { v: l + w + h, why: 'This adds the dimensions instead of multiplying them.' },
        { v: 2 * (l * w + l * h + w * h), why: 'This is the surface area, not the volume.' },
        { v: l * w, why: 'This is the area of the base only.' },
      ]),
      num: V,
      explanation: P('Volume of a rectangular prism: ' + m('V = \\ell wh = ' + l + '\\times' + w + '\\times' + h + ' = ' + V) + ' cubic inches.'),
    };
  });

  add('av', 'M', (r) => {
    const rad = r.int(2, 9), h = r.int(3, 12), k = rad * rad * h;
    return {
      stem: 'A right circular cylinder has a radius of ' + rad + ' meters and a height of ' + h + ' meters. The volume of the cylinder is ' + m('k\\pi') + ' cubic meters. What is the value of ' + m('k') + '?',
      figure: F.cylinder({ r: String(rad), h: String(h) }),
      ...G.mcNum(r, k, [
        { v: 2 * rad * h, why: 'This uses ' + m('2rh') + ' (part of the lateral area formula) instead of ' + m('r^2h') + '.' },
        { v: rad * h, why: 'This forgets to square the radius.' },
        { v: 4 * rad * rad * h, why: 'This uses the diameter instead of the radius.' },
      ]),
      num: k,
      explanation: P('Volume of a cylinder: ' + m('V = \\pi r^2 h = \\pi(' + rad + ')^2(' + h + ') = ' + k + '\\pi') + '.', 'So ' + m('k = ' + k) + '.'),
    };
  });

  add('av', 'M', (r) => {
    const s = r.int(3, 15), askArea = r.bool();
    if (askArea) {
      return {
        stem: 'A square has a perimeter of ' + 4 * s + ' units. What is the area, in square units, of the square?',
        ...G.mcNum(r, s * s, [
          { v: 4 * s, why: 'This is the perimeter.' },
          { v: s, why: 'This is the side length.' },
          { v: 16 * s * s, why: 'This squares the perimeter instead of the side length.' },
        ]),
        num: s * s,
        explanation: P('Side length: ' + m('\\frac{' + 4 * s + '}{4} = ' + s) + '. Area: ' + m(s + '^2 = ' + s * s) + ' square units.'),
      };
    }
    return {
      stem: 'A cube has a surface area of ' + 6 * s * s + ' square feet. What is the volume, in cubic feet, of the cube?',
      ...G.mcNum(r, s * s * s, [
        { v: s * s, why: 'This is the area of one face.' },
        { v: 6 * s * s * s, why: 'This multiplies the volume by 6.' },
        { v: s, why: 'This is the edge length.' },
      ]),
      num: s * s * s,
      explanation: P('A cube has 6 congruent square faces, so each face has area ' + m('\\frac{' + 6 * s * s + '}{6} = ' + s * s) + ' and the edge length is ' + m('\\sqrt{' + s * s + '} = ' + s) + '.', 'Volume: ' + m(s + '^3 = ' + s * s * s) + ' cubic feet.'),
    };
  });

  add('av', 'M', (r) => {
    const b1 = r.int(4, 12), b2 = b1 + 2 * r.int(1, 5), h = r.int(3, 10), A = ((b1 + b2) * h) / 2;
    const tri = r.bool(0.45);
    if (tri) {
      const b = r.int(4, 18), hh = r.int(3, 14);
      const At = (b * hh) / 2;
      return {
        stem: 'A triangle has a base of ' + b + ' centimeters and a height of ' + hh + ' centimeters. What is the area, in square centimeters, of the triangle?',
        ...G.mcNum(r, At, [
          { v: b * hh, why: 'This forgets the factor of ' + m('\\frac{1}{2}') + '.' },
          { v: b + hh, why: 'This adds the base and height.' },
          { v: G.clean((b * hh) / 4), why: 'This divides by 4 instead of 2.' },
        ], { step: 0.5 }),
        num: At,
        explanation: P('Area of a triangle: ' + m('A = \\frac{1}{2}bh = \\frac{1}{2}(' + b + ')(' + hh + ') = ' + nt(At)) + ' square centimeters.'),
      };
    }
    return {
      stem: 'A trapezoid has parallel sides of lengths ' + b1 + ' and ' + b2 + ' inches and a height of ' + h + ' inches. What is the area, in square inches, of the trapezoid?',
      ...G.mcNum(r, A, [
        { v: (b1 + b2) * h, why: 'This forgets to divide by 2.' },
        { v: b1 * b2 * h / 2, why: 'This multiplies the bases instead of adding them.' },
        { v: b2 * h, why: 'This treats the figure as a rectangle using the longer base.' },
      ], { step: 0.5 }),
      num: A,
      explanation: P('Area of a trapezoid: ' + m('A = \\frac{1}{2}(b_1 + b_2)h = \\frac{1}{2}(' + b1 + ' + ' + b2 + ')(' + h + ') = ' + nt(A)) + ' square inches.'),
    };
  });

  add('av', 'H', (r) => {
    const k = r.pick([2, 3, 4, 5]), shape = r.pick(['cube', 'sphere', 'cylinder']), dim = r.bool();
    const what = shape === 'cube' ? 'each edge of a cube' : shape === 'sphere' ? 'the radius of a sphere' : 'both the radius and the height of a right circular cylinder';
    const ans = dim ? k * k * k : k * k;
    return {
      stem: 'If ' + what + ' ' + (shape === 'cylinder' ? 'are' : 'is') + ' multiplied by ' + k + ', the ' + (dim ? 'volume' : 'surface area') + ' of the ' + shape + ' is multiplied by what number?',
      ...G.mcNum(r, ans, [
        { v: k, why: 'Lengths scale by ' + k + ', but ' + (dim ? 'volume' : 'area') + ' scales by ' + m(k + '^' + (dim ? 3 : 2)) + '.' },
        { v: dim ? k * k : k * k * k, why: dim ? 'This is how area scales, not volume.' : 'This is how volume scales, not surface area.' },
        { v: dim ? 3 * k : 2 * k, why: 'Scaling multiplies, it does not add: use ' + m(k + '^' + (dim ? 3 : 2)) + '.' },
      ]),
      num: ans,
      explanation: P('When every length of a solid is multiplied by ' + m('k') + ', areas are multiplied by ' + m('k^2') + ' and volumes by ' + m('k^3') + '.', 'Here ' + m('k = ' + k) + ', so the ' + (dim ? 'volume' : 'surface area') + ' is multiplied by ' + m(k + '^' + (dim ? 3 : 2) + ' = ' + ans) + '.'),
    };
  });

  add('av', 'H', (r) => {
    const rad = r.pick([3, 6, 9, 12]), V = (4 / 3) * rad * rad * rad, askR = r.bool(0.6);
    if (askR) {
      return {
        stem: 'A sphere has a volume of ' + m(G.pi(V)) + ' cubic units. What is the radius, in units, of the sphere?',
        ...G.mcNum(r, rad, [
          { v: rad * 2, why: 'This is the diameter.' },
          { v: G.clean(Math.round(Math.sqrt(V) * 100) / 100), why: 'This takes a square root of the volume coefficient without dividing by ' + m('\\frac{4}{3}') + ' or using a cube root.' },
          { v: G.clean(Math.round(Math.cbrt(V) * 100) / 100), why: 'This forgets to divide by ' + m('\\frac{4}{3}') + ' before taking the cube root.' },
        ]),
        num: rad,
        explanation: P(m('V = \\frac{4}{3}\\pi r^3') + ', so ' + m('\\frac{4}{3}\\pi r^3 = ' + G.pi(V)) + '.', 'Divide by ' + m('\\frac{4}{3}\\pi') + ': ' + m('r^3 = ' + V * 3 / 4) + '. Take the cube root: ' + m('r = ' + rad) + '.'),
      };
    }
    const rr = r.int(2, 9), h = 3 * r.int(1, 5), k = (rr * rr * h) / 3;
    return {
      stem: 'A right circular cone has a radius of ' + rr + ' centimeters and a height of ' + h + ' centimeters. The volume of the cone is ' + m('k\\pi') + ' cubic centimeters. What is the value of ' + m('k') + '?',
      figure: F.cone({ r: String(rr), h: String(h) }),
      ...G.mcNum(r, k, [
        { v: rr * rr * h, why: 'This is the volume of a cylinder with the same radius and height; a cone is ' + m('\\frac{1}{3}') + ' of that.' },
        { v: (rr * h) / 3, why: 'This forgets to square the radius.' },
        { v: G.clean((rr * rr * h) / 2), why: 'The cone formula uses ' + m('\\frac{1}{3}') + ', not ' + m('\\frac{1}{2}') + '.' },
      ]),
      num: k,
      explanation: P('Volume of a cone: ' + m('V = \\frac{1}{3}\\pi r^2 h = \\frac{1}{3}\\pi(' + rr + ')^2(' + h + ') = ' + k + '\\pi') + '. So ' + m('k = ' + k) + '.'),
    };
  });

  add('av', 'H', (r) => {
    const s = r.int(4, 12), rr = r.pick([1, 2, 3]);
    if (2 * rr >= s) return G.gens.av.M[0](r);
    const k = s * s, piPart = rr * rr;
    return {
      stem: 'A square metal plate has sides of length ' + s + ' inches. A circular hole with a radius of ' + rr + ' inch' + (rr === 1 ? '' : 'es') + ' is cut out of the plate. Which expression represents the area, in square inches, of the remaining metal?',
      ...G.mcText(r, k + ' - ' + (piPart === 1 ? '' : piPart) + '\\pi', [
        { t: k + ' - ' + 2 * rr + '\\pi', why: 'This subtracts the circumference of the hole, not its area.' },
        { t: k + ' - ' + (4 * piPart) + '\\pi', why: 'This uses the diameter in place of the radius.' },
        { t: 4 * s + ' - ' + (piPart === 1 ? '' : piPart) + '\\pi', why: 'This uses the perimeter of the square instead of its area.' },
        { t: k + ' - ' + (rr === 1 ? 2 : rr) + '\\pi', why: 'This forgets to square the radius.' },
        { t: k + ' + ' + (piPart === 1 ? '' : piPart) + '\\pi', why: 'This adds the area of the hole instead of subtracting it.' },
      ].filter((w, i, a) => w.t !== k + ' - ' + (piPart === 1 ? '' : piPart) + '\\pi' && a.findIndex((z) => z.t === w.t) === i).slice(0, 3), { math: true }),
      explanation: P('Area of the square: ' + m(s + '^2 = ' + k) + '. Area of the hole: ' + m('\\pi(' + rr + ')^2 = ' + (piPart === 1 ? '' : piPart) + '\\pi') + '.', 'Remaining area: ' + m(k + ' - ' + (piPart === 1 ? '' : piPart) + '\\pi') + ' square inches.'),
    };
  });

  /* ============================================ lat: lines, angles, triangles */
  add('lat', 'E', (r) => {
    // The transversal leans so positions 1 and 3 are drawn acute and 2 and 4 obtuse; keep labels consistent.
    const pos = r.pick(['a1', 'a2']), acute = r.int(35, 80), a = pos === 'a1' ? acute : 180 - acute;
    const ask = r.pick(['b1', 'b2', 'b3', 'b4', 'a3', 'a4']);
    // Angles at each intersection: 1=TL, 2=TR, 3=BR, 4=BL. With the transversal leaning right,
    // positions 1 & 3 are equal, 2 & 4 are equal; corresponding positions match across lines.
    const val = (p) => (Number(p[1]) % 2 === Number(pos[1]) % 2 ? a : 180 - a);
    const ans = val(ask);
    const labels = {}; labels[pos] = a + '°'; labels[ask] = 'x°';
    return {
      stem: 'In the figure, line ' + m('\\ell') + ' is parallel to line ' + m('m') + '. What is the value of ' + m('x') + '?',
      figure: F.parallel({ labels }),
      ...G.mcNum(r, ans, [
        { v: 180 - ans, why: 'This is the measure of the ' + (ans === a ? 'supplementary' : 'equal') + ' angle; check which angles are congruent and which are supplementary.' },
        { v: 90 - (a % 90), why: 'The angles are not complementary.' },
        { v: 360 - a, why: 'Angles around a point sum to 360°, but ' + m('x') + ' is not the rest of a full turn.' },
      ]),
      num: ans,
      explanation: P('When parallel lines are cut by a transversal, the acute angles are all congruent and the obtuse angles are all congruent; any acute angle and any obtuse angle are supplementary.',
        ans === a ? 'The angle marked ' + m('x°') + ' matches the ' + a + '° angle (vertical, corresponding, or alternate angles), so ' + m('x = ' + a) + '.' : 'The angle marked ' + m('x°') + ' is supplementary to the ' + a + '° angle, so ' + m('x = 180 - ' + a + ' = ' + ans) + '.'),
    };
  });

  add('lat', 'E', (r) => {
    const A = r.int(25, 80), B = r.int(25, 170 - A - 5), C = 180 - A - B;
    const pts = [[40, 190], [260, 190], [40 + r.int(60, 160), 40]];
    return {
      stem: 'In triangle ' + m('ABC') + ', the measure of angle ' + m('A') + ' is ' + A + '° and the measure of angle ' + m('B') + ' is ' + B + '°. What is the measure, in degrees, of angle ' + m('C') + '?',
      figure: F.triangle({ pts, vlabels: ['A', 'B', 'C'], angles: [A + '°', B + '°', ''] }),
      ...G.mcNum(r, C, [
        { v: 360 - A - B, why: 'The angles of a triangle sum to 180°, not 360°.' },
        { v: A + B, why: 'This is the exterior angle at ' + m('C') + ', not the interior angle.' },
        { v: 90 - Math.abs(A - B) > 0 ? 90 - Math.abs(A - B) : C + 10, why: 'Triangle ' + m('ABC') + ' is not given as a right triangle.' },
      ]),
      num: C,
      explanation: P('The interior angles of a triangle sum to 180°: ' + m('180 - ' + A + ' - ' + B + ' = ' + C) + '.'),
    };
  });

  add('lat', 'M', (r) => {
    let a, b, c, d, x;
    for (let i = 0; i < 300; i++) {
      x = r.int(8, 30); a = r.int(2, 6); b = r.int(-20, 30); c = r.int(1, 5); if (c === a) continue;
      d = 180 - (a * x + b) - c * x;
      if (a * x + b > 20 && a * x + b < 160 && Math.abs(d) <= 60) break;
    }
    const e1 = G.lin(a, b), e2 = G.lin(c, d);
    return {
      stem: 'Two angles form a linear pair (they are adjacent and together form a straight line). Their measures are ' + m('(' + e1 + ')°') + ' and ' + m('(' + e2 + ')°') + '. What is the value of ' + m('x') + '?',
      ...G.mcNum(r, x, [
        isInt((90 - b - d) / (a + c)) ? { v: (90 - b - d) / (a + c), why: 'This treats the angles as complementary (sum 90°); a linear pair sums to 180°.' } : { v: x + 3, why: 'Substitute back: the two angles would not sum to 180°.' },
        isInt((b - d) / (c - a)) && (b - d) / (c - a) !== x ? { v: (b - d) / (c - a), why: 'This sets the angles equal to each other, but a linear pair is supplementary.' } : { v: x - 2, why: 'Substitute back: the two angles would not sum to 180°.' },
        { v: a * x + b, why: 'This is the measure of one of the angles, not the value of ' + m('x') + '.' },
      ]),
      num: x,
      explanation: P('Angles in a linear pair are supplementary: ' + m('(' + e1 + ') + (' + e2 + ') = 180') + '.', 'Combine like terms: ' + m(G.lin(a + c, b + d) + ' = 180') + ', so ' + m(G.lin(a + c, 0) + ' = ' + (180 - b - d)) + ' and ' + m('x = ' + x) + '.'),
    };
  });

  add('lat', 'M', (r) => {
    const vertex = r.bool();
    if (vertex) {
      const V = 2 * r.int(10, 60), base = (180 - V) / 2;
      return {
        stem: 'In isosceles triangle ' + m('PQR') + ', ' + m('PQ = PR') + ' and the measure of angle ' + m('P') + ' is ' + V + '°. What is the measure, in degrees, of angle ' + m('Q') + '?',
        ...G.mcNum(r, base, [
          { v: 180 - V, why: 'This is the sum of the two base angles; each base angle is half of it.' },
          { v: V, why: 'Angle ' + m('Q') + ' is a base angle, which is not equal to the vertex angle ' + m('P') + '.' },
          { v: 90 - V / 2 === base ? base + 10 : 90 - V / 2, why: 'Check the angle sum: the three angles must total 180°.' },
        ]),
        num: base,
        explanation: P('Because ' + m('PQ = PR') + ', the angles opposite those sides are equal: ' + m('\\angle Q = \\angle R') + '.', m('\\angle Q = \\frac{180 - ' + V + '}{2} = ' + base) + ' degrees.'),
      };
    }
    const base = r.int(20, 80), V = 180 - 2 * base;
    return {
      stem: 'In isosceles triangle ' + m('PQR') + ', ' + m('PQ = PR') + ' and the measure of angle ' + m('Q') + ' is ' + base + '°. What is the measure, in degrees, of angle ' + m('P') + '?',
      ...G.mcNum(r, V, [
        { v: 180 - base, why: 'This subtracts only one base angle from 180°.' },
        { v: base, why: 'This is the measure of the other base angle, ' + m('\\angle R') + '.' },
        { v: 90 - base > 0 ? 90 - base : V + 10, why: 'The triangle is not a right triangle.' },
      ]),
      num: V,
      explanation: P('Base angles of an isosceles triangle are equal, so ' + m('\\angle R = \\angle Q = ' + base) + '°.', m('\\angle P = 180 - 2(' + base + ') = ' + V) + ' degrees.'),
    };
  });

  add('lat', 'H', (r) => {
    const AD = r.int(2, 9), DB = r.int(2, 9), DE = r.int(3, 12);
    const BC = G.clean((DE * (AD + DB)) / AD);
    if (!isInt(BC * 10) || BC > 99) return G.gens.lat.E[1](r);
    const pts = [[150, 25], [30, 200], [290, 200]], t = AD / (AD + DB);
    const D = [pts[0][0] + (pts[1][0] - pts[0][0]) * t, pts[0][1] + (pts[1][1] - pts[0][1]) * t];
    const E = [pts[0][0] + (pts[2][0] - pts[0][0]) * t, pts[0][1] + (pts[2][1] - pts[0][1]) * t];
    const extra = F.line(D, E) + F.text(D[0] - 12, D[1], 'D', { cls: 'fig-t fig-vl' }) + F.text(E[0] + 12, E[1], 'E', { cls: 'fig-t fig-vl' });
    return {
      stem: 'In the figure, point ' + m('D') + ' lies on ' + m('\\overline{AB}') + ', point ' + m('E') + ' lies on ' + m('\\overline{AC}') + ', and ' + m('\\overline{DE}') + ' is parallel to ' + m('\\overline{BC}') + '. If ' + m('AD = ' + AD) + ', ' + m('DB = ' + DB) + ', and ' + m('DE = ' + DE) + ', what is the length of ' + m('\\overline{BC}') + '?',
      figure: F.triangle({ pts, vlabels: ['A', 'B', 'C'], extra }),
      ...G.mcNum(r, BC, [
        { v: G.clean(Math.round(((DE * DB) / AD) * 100) / 100), why: 'This uses ' + m('DB') + ' instead of the whole side ' + m('AB = AD + DB') + '.' },
        { v: DE + DB, why: 'Similar triangles scale lengths by a factor; they don’t add a constant.' },
        { v: G.clean(Math.round(((DE * AD) / (AD + DB)) * 100) / 100), why: 'This sets up the proportion upside down.' },
      ], { step: 0.5 }),
      num: BC,
      explanation: P('Because ' + m('\\overline{DE}\\parallel\\overline{BC}') + ', triangle ' + m('ADE') + ' is similar to triangle ' + m('ABC') + ' (corresponding angles are equal).',
        'Corresponding sides are proportional: ' + m('\\frac{BC}{DE} = \\frac{AB}{AD} = \\frac{' + AD + ' + ' + DB + '}{' + AD + '} = \\frac{' + (AD + DB) + '}{' + AD + '}') + '.',
        'So ' + m('BC = ' + DE + '\\cdot\\frac{' + (AD + DB) + '}{' + AD + '} = ' + nt(BC)) + '.'),
    };
  });

  add('lat', 'H', (r) => {
    const A = r.int(30, 80), B = r.int(30, 150 - A);
    const ext = A + B;
    const pts = [[40, 190], [230, 190], [40 + r.int(50, 150), 50]];
    const extra = F.line([230, 190], [305, 190]) + F.text(262, 178, 'x°', { cls: 'fig-t small' });
    return {
      stem: 'In the figure, side ' + m('\\overline{BC}') + ' of triangle ' + m('ABC') + ' is extended to form an exterior angle at ' + m('C') + ' with measure ' + m('x°') + '. If the measure of angle ' + m('A') + ' is ' + A + '° and the measure of angle ' + m('B') + ' is ' + B + '°, what is the value of ' + m('x') + '?',
      figure: F.triangle({ pts: [pts[2], pts[0], pts[1]], vlabels: ['A', 'B', 'C'], angles: [A + '°', B + '°', ''], extra }),
      ...G.mcNum(r, ext, [
        { v: 180 - ext, why: 'This is the interior angle at ' + m('C') + ', which is supplementary to the exterior angle.' },
        { v: 180 - A, why: 'The exterior angle equals the sum of the two remote interior angles, not ' + m('180 - A') + '.' },
        { v: 360 - ext, why: 'This subtracts from 360° instead of adding the remote interior angles.' },
      ]),
      num: ext,
      explanation: P('The interior angle at ' + m('C') + ' is ' + m('180 - ' + A + ' - ' + B + ' = ' + (180 - ext)) + '°, and it forms a linear pair with the exterior angle.', 'So ' + m('x = 180 - ' + (180 - ext) + ' = ' + ext) + '. (Shortcut: an exterior angle equals the sum of the two remote interior angles: ' + m(A + ' + ' + B + ' = ' + ext) + '.)'),
    };
  });

  add('lat', 'H', (r) => {
    const k = r.pick([1.5, 2, 2.5, 3, 4]), a = r.int(3, 9), b = r.int(4, 11), c = r.int(Math.max(a, b) - Math.min(a, b) + 1, a + b - 1);
    const which = r.int(0, 2), sides = [a, b, c], names = [['AB', 'DE'], ['BC', 'EF'], ['AC', 'DF']];
    const known = (which + 1) % 3, ans = G.clean(sides[which] * k);
    return {
      stem: 'Triangle ' + m('ABC') + ' is similar to triangle ' + m('DEF') + ', where ' + m('A') + ', ' + m('B') + ', and ' + m('C') + ' correspond to ' + m('D') + ', ' + m('E') + ', and ' + m('F') + ', respectively. If ' + m(names[known][0] + ' = ' + sides[known]) + ', ' + m(names[known][1] + ' = ' + nt(G.clean(sides[known] * k))) + ', and ' + m(names[which][0] + ' = ' + sides[which]) + ', what is the length of ' + m('\\overline{' + names[which][1] + '}') + '?',
      ...G.mcNum(r, ans, [
        { v: G.clean(Math.round((sides[which] / k) * 100) / 100), why: 'This divides by the scale factor instead of multiplying.' },
        { v: G.clean(sides[which] + sides[known] * k - sides[known]), why: 'This adds the difference between corresponding sides instead of multiplying by the scale factor.' },
        { v: G.clean(sides[known] * k), why: 'This is the length of ' + m('\\overline{' + names[known][1] + '}') + '.' },
      ], { step: 0.5 }),
      num: ans,
      explanation: P('Scale factor from ' + m('ABC') + ' to ' + m('DEF') + ': ' + m('\\frac{' + names[known][1] + '}{' + names[known][0] + '} = \\frac{' + nt(G.clean(sides[known] * k)) + '}{' + sides[known] + '} = ' + k) + '.', 'So ' + m(names[which][1] + ' = ' + k + '\\times ' + sides[which] + ' = ' + nt(ans)) + '.'),
    };
  });

  /* ======================================= rtt: right triangles and trig */
  const triples = [[3, 4, 5], [5, 12, 13], [8, 15, 17], [7, 24, 25], [20, 21, 29], [9, 40, 41]];
  add('rtt', 'E', (r) => {
    const t = r.pick(triples.slice(0, 4)), k = r.pick([1, 1, 2, 3]), a = t[0] * k, b = t[1] * k, c = t[2] * k;
    const askHyp = r.bool(0.6);
    const pts = [[40, 190], [40, 50], [260, 190]];
    if (askHyp) {
      return {
        stem: 'A right triangle has legs of lengths ' + a + ' and ' + b + '. What is the length of the hypotenuse?',
        figure: F.triangle({ pts, right: 0, sides: [String(a), '', String(b)], note: true }),
        ...G.mcNum(r, c, [
          { v: a + b, why: 'This adds the legs; the Pythagorean theorem adds their squares.' },
          { v: a * a + b * b, why: 'This is ' + m('c^2') + '; take the square root.' },
          { v: b + 1 === c ? c + 2 : b + 1, why: 'Check with the Pythagorean theorem: ' + m(a + '^2 + ' + b + '^2 = ' + (a * a + b * b)) + '.' },
        ]),
        num: c,
        explanation: P('Pythagorean theorem: ' + m('c^2 = ' + a + '^2 + ' + b + '^2 = ' + a * a + ' + ' + b * b + ' = ' + c * c) + '.', 'So ' + m('c = \\sqrt{' + c * c + '} = ' + c) + '.'),
      };
    }
    return {
      stem: 'A right triangle has a hypotenuse of length ' + c + ' and one leg of length ' + a + '. What is the length of the other leg?',
      figure: F.triangle({ pts, right: 0, sides: [String(a), String(c), ''], note: true }),
      ...G.mcNum(r, b, [
        { v: c - a, why: 'This subtracts the lengths; the Pythagorean theorem subtracts their squares.' },
        { v: G.clean(Math.round(Math.sqrt(c * c + a * a) * 100) / 100), why: 'This adds the squares, treating ' + c + ' as a leg.' },
        { v: c * c - a * a, why: 'This is ' + m('b^2') + '; take the square root.' },
      ]),
      num: b,
      explanation: P(m(a + '^2 + b^2 = ' + c + '^2') + ', so ' + m('b^2 = ' + c * c + ' - ' + a * a + ' = ' + b * b) + ' and ' + m('b = ' + b) + '.'),
    };
  });

  add('rtt', 'M', (r) => {
    const t = r.pick(triples), fn = r.pick(['sin', 'cos', 'tan']), at = r.pick(['A', 'B']);
    // right angle at C; side a = BC (opposite A), b = AC (opposite B), c = AB
    const a = t[0], b = t[1], c = t[2];
    const opp = at === 'A' ? a : b, adj = at === 'A' ? b : a;
    const val = fn === 'sin' ? [opp, c] : fn === 'cos' ? [adj, c] : [opp, adj];
    const pts = [[40, 190], [270, 190], [270, 50]]; // A, C? arrange: A bottom-left, C bottom-right (right angle), B top-right
    const fig = F.triangle({ pts: [pts[0], pts[1], pts[2]], vlabels: ['A', 'C', 'B'], right: 1, sides: [String(b), String(a), String(c)] });
    return {
      stem: 'In right triangle ' + m('ABC') + ', angle ' + m('C') + ' is a right angle, ' + m('AB = ' + c) + ', ' + m('BC = ' + a) + ', and ' + m('AC = ' + b) + '. What is the value of ' + m('\\' + fn + ' ' + at) + '?',
      figure: fig,
      ...G.mcNum(r, { v: val[0] / val[1], tex: G.ftex(val[0], val[1]), fr: val }, [
        { v: fn === 'sin' ? adj / c : opp / c, tex: fn === 'sin' ? G.ftex(adj, c) : G.ftex(opp, c), why: 'This is ' + m('\\' + (fn === 'sin' ? 'cos' : 'sin') + ' ' + at) + '.' },
        { v: fn === 'tan' ? adj / opp : opp / adj, tex: fn === 'tan' ? G.ftex(adj, opp) : G.ftex(opp, adj), why: fn === 'tan' ? 'This is adjacent over opposite, the reciprocal of the tangent.' : 'This is ' + m('\\tan ' + at) + '.' },
        { v: val[1] / val[0], tex: G.ftex(val[1], val[0]), why: 'This is the reciprocal of the correct ratio.' },
      ]),
      explanation: P('Relative to angle ' + m(at) + ': the opposite side is ' + m(at === 'A' ? 'BC = ' + a : 'AC = ' + b) + ', the adjacent side is ' + m(at === 'A' ? 'AC = ' + b : 'BC = ' + a) + ', and the hypotenuse is ' + m('AB = ' + c) + '.',
        'SOH-CAH-TOA: ' + m('\\' + fn + ' ' + at + ' = \\frac{\\text{' + (fn === 'sin' ? 'opposite' : fn === 'cos' ? 'adjacent' : 'opposite') + '}}{\\text{' + (fn === 'tan' ? 'adjacent' : 'hypotenuse') + '}} = ' + G.ftex(val[0], val[1])) + '.'),
    };
  });

  add('rtt', 'M', (r) => {
    const x = r.int(10, 80), variant = r.bool();
    if (variant) {
      return {
        stem: 'In a right triangle, the two acute angles have measures ' + m('x°') + ' and ' + m('y°') + '. If ' + m('\\sin(x°) = k') + ', what is ' + m('\\cos(y°)') + '?',
        ...G.mcText(r, 'k', [
          { t: '1 - k', why: 'Sine and cosine of complementary angles are equal, not complementary.' },
          { t: '\\frac{1}{k}', why: 'This is the reciprocal; ' + m('\\cos(y°)') + ' equals ' + m('\\sin(x°)') + ' itself.' },
          { t: '-k', why: 'Trig ratios of acute angles are positive.' },
        ], { math: true }),
        explanation: P('The acute angles of a right triangle are complementary: ' + m('x + y = 90') + '.', 'The side opposite angle ' + m('x') + ' is adjacent to angle ' + m('y') + ', so ' + m('\\sin(x°) = \\cos(y°) = k') + '.'),
      };
    }
    return {
      stem: 'If ' + m('\\sin(x°) = \\cos(' + x + '°)') + ' and ' + m('0 < x < 90') + ', what is the value of ' + m('x') + '?',
      ...G.mcNum(r, 90 - x, [
        { v: x, why: m('\\sin(' + x + '°) = \\cos(' + x + '°)') + ' only when the angle is 45°.' },
        { v: 180 - x, why: 'The complementary relationship uses 90°, not 180°.' },
        { v: 90 + x > 179 ? 45 : 90 + x, why: 'This value is not between 0 and 90.' },
      ]),
      num: 90 - x,
      explanation: P('For complementary angles, ' + m('\\sin(\\theta) = \\cos(90° - \\theta)') + '.', 'So ' + m('x = 90 - ' + x + ' = ' + (90 - x)) + '.'),
    };
  });

  add('rtt', 'H', (r) => {
    const k = r.int(2, 10), kind = r.pick(['306090', '454590']);
    if (kind === '306090') {
      const hyp = 2 * k, askLong = r.bool();
      return {
        stem: 'In right triangle ' + m('RST') + ', the measure of angle ' + m('S') + ' is 90°, the measure of angle ' + m('R') + ' is 30°, and the length of the hypotenuse ' + m('\\overline{RT}') + ' is ' + hyp + '. What is the length of ' + m(askLong ? '\\overline{RS}' : '\\overline{ST}') + '?',
        ...G.mcText(r, askLong ? k + '\\sqrt{3}' : String(k), askLong ? [
          { t: String(k), why: 'This is the shorter leg, opposite the 30° angle.' },
          { t: k + '\\sqrt{2}', why: 'The ' + m('\\sqrt{2}') + ' ratio belongs to 45°-45°-90° triangles.' },
          { t: 2 * k + '\\sqrt{3}', why: 'The longer leg is ' + m('\\sqrt{3}') + ' times the <i>shorter leg</i>, not the hypotenuse.' },
        ] : [
          { t: k + '\\sqrt{3}', why: 'This is the longer leg, opposite the 60° angle.' },
          { t: k + '\\sqrt{2}', why: 'The ' + m('\\sqrt{2}') + ' ratio belongs to 45°-45°-90° triangles.' },
          { t: String(2 * k), why: 'This is the hypotenuse.' },
        ], { math: true }),
        explanation: P('In a 30°-60°-90° triangle the sides are in the ratio ' + m('1 : \\sqrt{3} : 2') + ' (short leg : long leg : hypotenuse).', 'The hypotenuse is ' + hyp + ', so the short leg (opposite 30°, which is ' + m('\\overline{ST}') + ') is ' + m(k) + ' and the long leg (' + m('\\overline{RS}') + ') is ' + m(k + '\\sqrt{3}') + '.'),
      };
    }
    const askHyp = r.bool();
    return {
      stem: askHyp ? 'An isosceles right triangle has legs of length ' + k + '. What is the length of the hypotenuse?' : 'An isosceles right triangle has a hypotenuse of length ' + m(k + '\\sqrt{2}') + '. What is the area of the triangle?',
      ...(askHyp ? G.mcText(r, k + '\\sqrt{2}', [
        { t: String(2 * k), why: 'This adds the legs; use the Pythagorean theorem or the ' + m('1 : 1 : \\sqrt{2}') + ' ratio.' },
        { t: k + '\\sqrt{3}', why: 'The ' + m('\\sqrt{3}') + ' ratio belongs to 30°-60°-90° triangles.' },
        { t: String(2 * k * k), why: 'This is ' + m('c^2') + ', not ' + m('c') + '.' },
      ], { math: true }) : G.mcNum(r, (k * k) / 2, [
        { v: k * k, why: 'This forgets the ' + m('\\frac{1}{2}') + ' in the triangle area formula.' },
        { v: k * k * 2, why: 'This uses the hypotenuse as a leg.' },
        { v: G.clean((k * k) / 4), why: 'This divides by 2 twice.' },
      ], { step: 0.5 })),
      num: askHyp ? null : (k * k) / 2,
      explanation: askHyp ? P('In a 45°-45°-90° triangle the sides are in the ratio ' + m('1 : 1 : \\sqrt{2}') + '.', 'So the hypotenuse is ' + m(k + '\\sqrt{2}') + '.')
        : P('In a 45°-45°-90° triangle, the hypotenuse is ' + m('\\sqrt{2}') + ' times a leg, so each leg is ' + m(k) + '.', 'Area: ' + m('\\frac{1}{2}(' + k + ')(' + k + ') = ' + nt((k * k) / 2)) + '.'),
    };
  });

  add('rtt', 'H', (r) => {
    const t = r.pick(triples), fn = r.pick(['tan', 'cos']);
    const [a, b, c] = t;
    const ans = fn === 'tan' ? [a, b] : [b, c];
    return {
      stem: 'In a right triangle, one of the acute angles has measure ' + m('\\theta') + ', and ' + m('\\sin\\theta = \\frac{' + a + '}{' + c + '}') + '. What is the value of ' + m('\\' + fn + '\\theta') + '?',
      ...G.mcNum(r, { v: ans[0] / ans[1], tex: G.ftex(ans[0], ans[1]), fr: ans }, fn === 'tan' ? [
        { v: b / a, tex: G.ftex(b, a), why: 'This is adjacent over opposite, the reciprocal of ' + m('\\tan\\theta') + '.' },
        { v: b / c, tex: G.ftex(b, c), why: 'This is ' + m('\\cos\\theta') + '.' },
        { v: a / c, tex: G.ftex(a, c), why: 'This is ' + m('\\sin\\theta') + ' itself.' },
      ] : [
        { v: a / b, tex: G.ftex(a, b), why: 'This is ' + m('\\tan\\theta') + '.' },
        { v: c / b, tex: G.ftex(c, b), why: 'This is the reciprocal of ' + m('\\cos\\theta') + '.' },
        { v: a / c, tex: G.ftex(a, c), why: 'This is ' + m('\\sin\\theta') + ' itself.' },
      ]),
      num: ans[0] / ans[1],
      explanation: P('Draw a right triangle with the side opposite ' + m('\\theta') + ' equal to ' + a + ' and hypotenuse ' + c + '.', 'The adjacent side is ' + m('\\sqrt{' + c + '^2 - ' + a + '^2} = \\sqrt{' + (c * c - a * a) + '} = ' + b) + '.',
        m('\\' + fn + '\\theta = \\frac{\\text{' + (fn === 'tan' ? 'opposite' : 'adjacent') + '}}{\\text{' + (fn === 'tan' ? 'adjacent' : 'hypotenuse') + '}} = ' + G.ftex(ans[0], ans[1])) + '.'),
    };
  });

  add('rtt', 'H', (r) => {
    const degs = [30, 45, 60, 120, 135, 150, 210, 225, 240, 270, 300, 315, 330];
    const d = r.pick(degs), [n, den] = G.frac(d, 180);
    const tex = (nn, dd) => { [nn, dd] = G.frac(nn, dd); return (dd === 1 ? (nn === 1 ? '' : nn) + '\\pi' : '\\frac{' + (nn === 1 ? '' : nn) + '\\pi}{' + dd + '}'); };
    const toRad = r.bool(0.65);
    if (toRad) {
      return {
        stem: 'What is the measure, in radians, of an angle of ' + d + '°?',
        ...G.mcText(r, tex(n, den), [
          { t: tex(den, n), why: 'This inverts the conversion factor ' + m('\\frac{\\pi}{180}') + '.' },
          { t: tex(d, 360), why: 'This uses 360° instead of 180° for ' + m('\\pi') + ' radians.' },
          { t: tex(2 * d, 180), why: 'This doubles the correct value.' },
        ].filter((w) => w.t !== tex(n, den)), { math: true }),
        explanation: P('Multiply by ' + m('\\frac{\\pi}{180}') + ': ' + m(d + '\\cdot\\frac{\\pi}{180} = ' + tex(n, den)) + ' radians.'),
      };
    }
    return {
      stem: 'An angle measures ' + m(tex(n, den)) + ' radians. What is the measure of the angle, in degrees?',
      ...G.mcNum(r, d, [
        { v: G.clean(Math.round(((d / 180) * 100)) / 100), why: 'This divides by 180 instead of multiplying.' },
        { v: d / 2, why: 'This uses 90° for ' + m('\\pi') + ' radians instead of 180°.' },
        { v: d * 2, why: 'This uses 360° for ' + m('\\pi') + ' radians instead of 180°.' },
      ]),
      num: d,
      explanation: P(m('\\pi') + ' radians equals 180°, so multiply by ' + m('\\frac{180}{\\pi}') + ': ' + m(tex(n, den) + '\\cdot\\frac{180}{\\pi} = ' + d) + ' degrees.'),
    };
  });

  /* ============================================================ circles */
  add('cir', 'E', (r) => {
    const rad = r.int(2, 15), askC = r.bool(), givenD = r.bool();
    const ans = askC ? 2 * rad : rad * rad;
    return {
      stem: 'A circle has a ' + (givenD ? 'diameter of ' + 2 * rad : 'radius of ' + rad) + ' centimeters. What is the ' + (askC ? 'circumference' : 'area') + ' of the circle, in ' + (askC ? 'centimeters' : 'square centimeters') + '?',
      ...G.mcNum(r, { v: ans, tex: G.pi(ans) }, askC ? [
        piC(rad, 'This uses ' + m('\\pi r') + ' instead of ' + m('2\\pi r') + '.'),
        piC(rad * rad, 'This is the area, not the circumference.'),
        piC(4 * rad, 'This uses the diameter in place of the radius in ' + m('2\\pi r') + '.'),
      ] : [
        piC(2 * rad, 'This is the circumference, not the area.'),
        piC(4 * rad * rad, 'This uses the diameter in place of the radius.'),
        piC(rad, 'This forgets to square the radius.'),
      ]),
      num: null,
      explanation: P((givenD ? 'The radius is half the diameter: ' + m(2 * rad + '\\div 2 = ' + rad) + '. ' : '') + (askC ? 'Circumference: ' + m('C = 2\\pi r = 2\\pi(' + rad + ') = ' + G.pi(ans)) : 'Area: ' + m('A = \\pi r^2 = \\pi(' + rad + ')^2 = ' + G.pi(ans))) + '.'),
    };
  });

  add('cir', 'E', (r) => {
    const rad = r.int(2, 12), k = rad * rad;
    return {
      stem: 'The area of a circle is ' + m(G.pi(k)) + ' square inches. What is the diameter, in inches, of the circle?',
      ...G.mcNum(r, 2 * rad, [
        { v: rad, why: 'This is the radius.' },
        { v: k, why: 'This is ' + m('r^2') + '.' },
        { v: 2 * k, why: 'This doubles ' + m('r^2') + ' instead of ' + m('r') + '.' },
      ]),
      num: 2 * rad,
      explanation: P(m('\\pi r^2 = ' + G.pi(k)) + ', so ' + m('r^2 = ' + k) + ' and ' + m('r = ' + rad) + '.', 'The diameter is ' + m('2r = ' + 2 * rad) + ' inches.'),
    };
  });

  add('cir', 'M', (r) => {
    const angs = [30, 40, 45, 60, 72, 80, 90, 120, 135, 150, 240], ang = r.pick(angs), rad = r.pick([3, 4, 5, 6, 8, 9, 10, 12, 15, 18]);
    const [n, d] = G.frac(ang * 2 * rad, 360);
    const arcTex = (nn, dd) => { [nn, dd] = G.frac(nn, dd); return dd === 1 ? G.pi(nn) : '\\frac{' + (nn === 1 ? '' : nn) + '\\pi}{' + dd + '}'; };
    const sector = r.bool(0.45);
    if (sector) {
      const [sn, sd] = G.frac(ang * rad * rad, 360);
      return {
        stem: 'A circle has a radius of ' + rad + ' units. What is the area, in square units, of a sector of the circle with a central angle of ' + ang + '°?',
        figure: F.circle({ angle: ang, sector: true, angleLabel: ang + '°', rLabel: String(rad) }),
        ...G.mcText(r, arcTex(sn, sd), [
          { t: arcTex(n, d), why: 'This is the arc length, not the sector area.' },
          { t: arcTex(ang * rad, 360), why: 'This forgets to square the radius.' },
          { t: G.pi(rad * rad), why: 'This is the area of the whole circle.' },
          { t: arcTex(ang * 4 * rad * rad, 360), why: 'This uses the diameter in place of the radius.' },
        ].filter((w, i, a) => w.t !== arcTex(sn, sd) && a.findIndex((z) => z.t === w.t) === i), { math: true }),
        explanation: P('A sector is a fraction ' + m('\\frac{' + ang + '}{360}') + ' of the circle.', 'Area: ' + m('\\frac{' + ang + '}{360}\\cdot\\pi(' + rad + ')^2 = ' + arcTex(sn, sd)) + ' square units.'),
      };
    }
    return {
      stem: 'A circle has a radius of ' + rad + ' units. What is the length, in units, of an arc of the circle with a central angle of ' + ang + '°?',
      figure: F.circle({ angle: ang, angleLabel: ang + '°', rLabel: String(rad) }),
      ...G.mcText(r, arcTex(n, d), [
        { t: arcTex(ang * rad * rad, 360), why: 'This is the sector area, not the arc length.' },
        { t: arcTex(ang * rad, 360), why: 'This uses ' + m('\\pi r') + ' instead of the circumference ' + m('2\\pi r') + '.' },
        { t: G.pi(2 * rad), why: 'This is the circumference of the whole circle.' },
        { t: arcTex(ang * 4 * rad, 360), why: 'This uses the diameter in place of the radius.' },
      ].filter((w, i, a) => w.t !== arcTex(n, d) && a.findIndex((z) => z.t === w.t) === i), { math: true }),
      explanation: P('An arc is a fraction ' + m('\\frac{' + ang + '}{360}') + ' of the circumference ' + m('2\\pi r = ' + G.pi(2 * rad)) + '.', 'Arc length: ' + m('\\frac{' + ang + '}{360}\\cdot ' + G.pi(2 * rad) + ' = ' + arcTex(n, d)) + ' units.'),
    };
  });

  add('cir', 'M', (r) => {
    const h = r.int(-6, 6), k = r.int(-6, 6), rad = r.int(2, 9);
    const eq = '(' + G.xm(h) + ')^2 + (' + G.xm(k).replace('x', 'y') + ')^2 = ' + rad * rad;
    const askR = r.bool();
    if (askR) {
      return {
        stem: 'The equation of a circle in the ' + m('xy') + '-plane is ' + m(eq) + '. What is the radius of the circle?',
        ...G.mcNum(r, rad, [
          { v: rad * rad, why: 'This is ' + m('r^2') + '; take the square root.' },
          { v: 2 * rad, why: 'This is the diameter.' },
          { v: G.clean(rad * rad / 2), why: 'The radius is the square root of the right side, not half of it.' },
        ]),
        num: rad,
        explanation: P('The standard form of a circle is ' + m('(x - h)^2 + (y - k)^2 = r^2') + '. Here ' + m('r^2 = ' + rad * rad) + ', so ' + m('r = ' + rad) + '.'),
      };
    }
    const pt = (a, b) => '(' + a + ', ' + b + ')';
    return {
      stem: 'The equation of a circle in the ' + m('xy') + '-plane is ' + m(eq) + '. What are the coordinates of the center of the circle?',
      ...G.mcText(r, pt(h, k), [
        { t: pt(-h, -k), why: 'The signs in the equation are the opposite of the center’s coordinates: ' + m('(x - h)') + ' means the center has ' + m('x') + '-coordinate ' + m('h') + '.' },
        { t: pt(h, -k), why: 'The ' + m('y') + '-coordinate has the wrong sign.' },
        { t: pt(-h, k), why: 'The ' + m('x') + '-coordinate has the wrong sign.' },
        { t: pt(k, h), why: 'This reverses the coordinates.' },
        { t: pt(h + rad, k), why: 'This point is on the circle, ' + rad + ' units from the center; it is not the center.' },
        { t: pt(h, k + rad), why: 'This point is on the circle, ' + rad + ' units from the center; it is not the center.' },
        { t: pt(h - rad, k), why: 'This point is on the circle, ' + rad + ' units from the center; it is not the center.' },
      ].filter((w, i, a) => w.t !== pt(h, k) && a.findIndex((z) => z.t === w.t) === i).slice(0, 3), { math: true }),
      explanation: P('In ' + m('(x - h)^2 + (y - k)^2 = r^2') + ', the center is ' + m('(h, k)') + '.', 'Here the center is ' + m(pt(h, k)) + ' and the radius is ' + m(rad) + '.'),
    };
  });

  add('cir', 'H', (r) => {
    const h = r.int(-7, 7), k = r.int(-7, 7), rad = r.int(2, 10);
    const D = -2 * h, E = -2 * k, Fc = h * h + k * k - rad * rad;
    const lhs = 'x^2 + y^2' + (D ? G.term(D, 'x', false) : '') + (E ? G.term(E, 'y', false) : '');
    const rhs = -Fc;
    return {
      stem: 'The equation ' + m(lhs + ' = ' + nt(rhs)) + ' defines a circle in the ' + m('xy') + '-plane. What is the radius of the circle?',
      ...G.mcNum(r, rad, [
        { v: G.clean(Math.round(Math.sqrt(Math.abs(rhs)) * 100) / 100) === rad ? rad * rad : G.clean(Math.round(Math.sqrt(Math.abs(rhs)) * 100) / 100), why: 'This takes the square root of the constant without completing the square.' },
        { v: rad * rad, why: 'This is ' + m('r^2') + '.' },
        { v: 2 * rad, why: 'This is the diameter.' },
      ]),
      num: rad,
      explanation: P('Complete the square for ' + m('x') + ' and ' + m('y') + ': add ' + m(h * h) + ' and ' + m(k * k) + ' to both sides.',
        m('(' + G.xm(h) + ')^2 + (' + G.xm(k).replace('x', 'y') + ')^2 = ' + nt(rhs) + ' + ' + h * h + ' + ' + k * k + ' = ' + rad * rad) + '.',
        'So ' + m('r^2 = ' + rad * rad) + ' and ' + m('r = ' + rad) + '.'),
    };
  });

  add('cir', 'H', (r) => {
    const rad = r.int(2, 12), [n, d] = r.pick([[1, 2], [1, 3], [2, 3], [3, 4], [5, 6], [1, 4], [1, 6], [4, 3], [3, 2]]);
    const s = G.clean((rad * n) / d);
    if (!isInt(s * 10)) return G.gens.cir.H[0](r);
    const sTex = (nn, dd) => { [nn, dd] = G.frac(nn, dd); return dd === 1 ? (nn === 1 ? '\\pi' : nn + '\\pi') : '\\frac{' + (nn === 1 ? '' : nn) + '\\pi}{' + dd + '}'; };
    return {
      stem: 'In a circle with a radius of ' + rad + ' centimeters, an arc has a length of ' + m(sTex(rad * n, d)) + ' centimeters. What is the measure, in radians, of the central angle that intercepts the arc?',
      ...G.mcText(r, sTex(n, d), [
        { t: sTex(rad * rad * n, d), why: 'This multiplies by the radius instead of dividing.' },
        { t: sTex(n, 2 * d), why: 'This divides by the diameter instead of the radius.' },
        { t: G.pi(1) === sTex(n, d) ? '2\\pi' : sTex(2 * n, d), why: 'This doubles the angle; the formula is ' + m('\\theta = \\frac{s}{r}') + '.' },
      ].filter((w, i, a) => w.t !== sTex(n, d) && a.findIndex((z) => z.t === w.t) === i), { math: true }),
      explanation: P('For an angle in radians, arc length is ' + m('s = r\\theta') + ', so ' + m('\\theta = \\frac{s}{r}') + '.', m('\\theta = \\frac{' + sTex(rad * n, d) + '}{' + rad + '} = ' + sTex(n, d)) + ' radians.'),
    };
  });

  add('cir', 'H', (r) => {
    const h = r.int(-5, 5), k = r.int(-5, 5), t = r.pick([[3, 4, 5], [6, 8, 10], [5, 12, 13], [0, 5, 5], [8, 6, 10]]);
    const sx = r.pick([1, -1]), sy = r.pick([1, -1]);
    const on = [h + sx * t[0], k + sy * t[1]], rad = t[2];
    const pt = (p) => '(' + p[0] + ', ' + p[1] + ')';
    const cand = [
      { p: [h + rad, k + rad], why: 'Its distance from the center is ' + m(rad + '\\sqrt{2}') + ', not ' + m(rad) + '.' },
      { p: [h + sx * t[0], k - sy * t[1] + (t[1] ? 0 : 1) + 1], why: 'Its distance from the center is not ' + m(rad) + '.' },
      { p: [-h + sx * t[0], -k + sy * t[1]], why: 'This uses the wrong signs for the center.' },
      { p: [h + t[0] + 1, k + t[1] + 1], why: 'Its distance from the center is not ' + m(rad) + '.' },
    ].filter((c) => Math.abs(Math.hypot(c.p[0] - h, c.p[1] - k) - rad) > 1e-9);
    const uniq = []; cand.forEach((c) => { if (!uniq.some((u) => pt(u.p) === pt(c.p)) && pt(c.p) !== pt(on)) uniq.push(c); });
    const eq = '(' + G.xm(h) + ')^2 + (' + G.xm(k).replace('x', 'y') + ')^2 = ' + rad * rad;
    return {
      stem: 'Which point lies on the circle defined by ' + m(eq) + ' in the ' + m('xy') + '-plane?',
      ...G.mcText(r, pt(on), uniq.slice(0, 3).map((c) => ({ t: pt(c.p), why: c.why })), { math: true }),
      explanation: P('The circle has center ' + m('(' + h + ', ' + k + ')') + ' and radius ' + m(rad) + '. A point lies on the circle if it satisfies the equation.',
        'For ' + m(pt(on)) + ': ' + m('(' + on[0] + G.sgn(-h) + ')^2 + (' + on[1] + G.sgn(-k) + ')^2 = ' + t[0] * t[0] + ' + ' + t[1] * t[1] + ' = ' + rad * rad) + ' ✓'),
    };
  });
})();
