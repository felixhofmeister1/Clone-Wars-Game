/* Math reference sheet (the formulas provided on the Digital SAT) plus a
   second tab of formulas students are expected to know. */
(function () {
  'use strict';
  const SAT = window.SAT, U = SAT.util, h = U.h;
  const T = (x) => U.tex(x);
  const svg = (inner, w, hh) => '<svg class="fig fig-geo ref-fig" viewBox="0 0 ' + (w || 120) + ' ' + (hh || 90) + '" aria-hidden="true">' + inner + '</svg>';
  const t = (x, y, s, a) => '<text class="fig-t small" x="' + x + '" y="' + y + '" text-anchor="' + (a || 'middle') + '" dominant-baseline="middle"><tspan class="fig-var">' + s + '</tspan></text>';

  const official = [
    { fig: svg('<circle class="fig-shape" cx="60" cy="45" r="32"/><line class="fig-l" x1="60" y1="45" x2="92" y2="45"/><circle class="fig-dot" cx="60" cy="45" r="2"/>' + t(76, 37, 'r')), f: ['A = \\pi r^2', 'C = 2\\pi r'] },
    { fig: svg('<rect class="fig-shape" x="18" y="22" width="84" height="46"/>' + t(60, 80, 'ℓ') + t(110, 45, 'w')), f: ['A = \\ell w'] },
    { fig: svg('<polygon class="fig-shape" points="14,72 106,72 42,18"/><line class="fig-l dash" x1="42" y1="18" x2="42" y2="72"/>' + t(60, 84, 'b') + t(48, 48, 'h', 'start')), f: ['A = \\tfrac{1}{2}bh'] },
    { fig: svg('<polygon class="fig-shape" points="20,72 100,72 20,18"/><polyline class="fig-l thin" points="20,62 30,62 30,72"/>' + t(60, 84, 'a') + t(10, 45, 'b') + t(66, 38, 'c')), f: ['c^2 = a^2 + b^2'] },
    { fig: svg('<polygon class="fig-shape" points="20,76 104,76 20,20"/><polyline class="fig-l thin" points="20,66 30,66 30,76"/>' + t(62, 86, 'x√3') + t(10, 48, 'x') + t(70, 40, '2x') + t(94, 68, '30°') + t(28, 30, '60°', 'start'), 120, 96), f: ['\\text{Special right triangles}'] },
    { fig: svg('<polygon class="fig-shape" points="20,76 84,76 20,20"/><polyline class="fig-l thin" points="20,66 30,66 30,76"/>' + t(52, 86, 's') + t(10, 48, 's') + t(62, 40, 's√2', 'start') + t(72, 68, '45°') + t(28, 32, '45°', 'start'), 120, 96), f: [] },
    { fig: svg('<polygon class="fig-shape" points="14,40 74,40 74,76 14,76"/><polygon class="fig-shape" points="14,40 36,22 96,22 74,40"/><polygon class="fig-shape" points="74,40 96,22 96,58 74,76"/>' + t(44, 86, 'ℓ') + t(90, 72, 'w', 'start') + t(6, 58, 'h')), f: ['V = \\ell wh'] },
    { fig: svg('<ellipse class="fig-shape" cx="60" cy="22" rx="30" ry="9"/><path class="fig-shape" d="M30,22 V68 A30,9 0 0 0 90,68 V22"/><line class="fig-l thin" x1="60" y1="22" x2="90" y2="22"/>' + t(75, 14, 'r') + t(100, 46, 'h', 'start')), f: ['V = \\pi r^2 h'] },
    { fig: svg('<circle class="fig-shape" cx="60" cy="45" r="32"/><ellipse class="fig-l dash" cx="60" cy="45" rx="32" ry="9"/><line class="fig-l" x1="60" y1="45" x2="92" y2="45"/>' + t(76, 38, 'r')), f: ['V = \\tfrac{4}{3}\\pi r^3'] },
    { fig: svg('<path class="fig-shape" d="M60,10 L30,72 A30,9 0 0 0 90,72 Z"/><line class="fig-l dash" x1="60" y1="10" x2="60" y2="72"/><line class="fig-l thin" x1="60" y1="72" x2="90" y2="72"/>' + t(75, 64, 'r') + t(66, 42, 'h', 'start')), f: ['V = \\tfrac{1}{3}\\pi r^2 h'] },
    { fig: svg('<polygon class="fig-shape" points="60,10 20,64 70,78"/><polygon class="fig-shape" points="60,10 70,78 100,58"/><polyline class="fig-l dash" points="20,64 50,46 100,58"/><line class="fig-l dash" x1="60" y1="10" x2="58" y2="60"/>' + t(44, 80, 'ℓ') + t(92, 74, 'w', 'start') + t(64, 36, 'h', 'start')), f: ['V = \\tfrac{1}{3}\\ell wh'] },
  ];

  const extra = [
    ['Slope of a line through two points', 'm = \\dfrac{y_2 - y_1}{x_2 - x_1}'],
    ['Slope-intercept and point-slope form', 'y = mx + b \\qquad y - y_1 = m(x - x_1)'],
    ['Parallel and perpendicular slopes', 'm_1 = m_2 \\qquad m_1 \\cdot m_2 = -1'],
    ['Quadratic formula', 'x = \\dfrac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}'],
    ['Discriminant', 'b^2 - 4ac > 0: \\text{two},\\ = 0: \\text{one},\\ < 0: \\text{no real solutions}'],
    ['Vertex of a parabola', 'x = -\\dfrac{b}{2a}, \\qquad y = a(x - h)^2 + k \\text{ has vertex } (h, k)'],
    ['Sum and product of roots', 'r_1 + r_2 = -\\dfrac{b}{a}, \\qquad r_1 r_2 = \\dfrac{c}{a}'],
    ['Exponential growth and decay', 'y = a(1 \\pm r)^t'],
    ['Percent change', '\\dfrac{\\text{new} - \\text{original}}{\\text{original}} \\times 100\\%'],
    ['Distance and midpoint', 'd = \\sqrt{(x_2 - x_1)^2 + (y_2 - y_1)^2}, \\quad M = \\left(\\tfrac{x_1 + x_2}{2}, \\tfrac{y_1 + y_2}{2}\\right)'],
    ['Circle in the xy-plane', '(x - h)^2 + (y - k)^2 = r^2'],
    ['Arc length and sector area (degrees)', 's = \\dfrac{\\theta}{360}\\cdot 2\\pi r, \\qquad A = \\dfrac{\\theta}{360}\\cdot \\pi r^2'],
    ['Radians', '180^\\circ = \\pi \\text{ rad}, \\qquad s = r\\theta'],
    ['SOH-CAH-TOA', '\\sin\\theta = \\tfrac{\\text{opp}}{\\text{hyp}},\\ \\cos\\theta = \\tfrac{\\text{adj}}{\\text{hyp}},\\ \\tan\\theta = \\tfrac{\\text{opp}}{\\text{adj}}'],
    ['Complementary angles', '\\sin x^\\circ = \\cos(90^\\circ - x^\\circ)'],
    ['Exponent rules', 'a^m a^n = a^{m+n},\\ (a^m)^n = a^{mn},\\ a^{\\frac{m}{n}} = \\sqrt[n]{a^m}'],
    ['Mean', '\\bar{x} = \\dfrac{\\text{sum of values}}{\\text{number of values}}'],
  ];

  SAT.tools.ref = {
    title: 'Reference Sheet', icon: 'doc', w: 480, h: 600,
    build(body) {
      const tabA = h('button.tab.on', { text: 'Official sheet' }), tabB = h('button.tab', { text: 'Formulas to know' });
      const host = h('div.ref-host');
      body.appendChild(h('div.tabs', tabA, tabB)); body.appendChild(host);
      const showA = () => {
        tabA.classList.add('on'); tabB.classList.remove('on');
        host.innerHTML = '<div class="ref-grid">' + official.map((o) => '<div class="ref-item">' + o.fig + '<div class="ref-f">' + o.f.map(T).join('<br>') + '</div></div>').join('') + '</div>' +
          '<ul class="ref-facts"><li>The number of degrees of arc in a circle is 360.</li><li>The number of radians of arc in a circle is ' + T('2\\pi') + '.</li><li>The sum of the measures in degrees of the angles of a triangle is 180.</li></ul>';
      };
      const showB = () => {
        tabB.classList.add('on'); tabA.classList.remove('on');
        host.innerHTML = '<p class="muted small">These are <b>not</b> given on the test — worth memorizing.</p><dl class="ref-extra">' + extra.map((x) => '<dt>' + x[0] + '</dt><dd>' + U.tex(x[1], true) + '</dd>').join('') + '</dl>';
      };
      tabA.addEventListener('click', showA); tabB.addEventListener('click', showB);
      showA();
    },
  };
})();
