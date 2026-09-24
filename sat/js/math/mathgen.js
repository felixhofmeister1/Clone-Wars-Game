/* Math question engine: registry of seeded generators plus helpers for
   formatting TeX, building answer choices with explained distractors, and
   checking student-produced responses (grid-ins) the way the SAT does. */
(function () {
  'use strict';
  const SAT = window.SAT, U = SAT.util;
  const G = (SAT.mathgen = { gens: {} });

  G.add = function (skill, diff, fn) {
    const g = (G.gens[skill] = G.gens[skill] || { E: [], M: [], H: [] });
    g[diff].push(fn);
  };

  /* --------------------------------------------------------- numbers */
  G.gcd = (a, b) => { a = Math.abs(a); b = Math.abs(b); while (b) [a, b] = [b, a % b]; return a || 1; };
  G.frac = (n, d) => { if (d < 0) { n = -n; d = -d; } const g = G.gcd(n, d); return [n / g, d / g]; };
  // Pretty number: trims float noise, groups thousands with {,} inside TeX.
  G.clean = (x) => { const r = Math.round(x * 1e6) / 1e6; return Object.is(r, -0) ? 0 : r; };
  G.nt = (x) => {
    x = G.clean(x);
    const neg = x < 0, a = Math.abs(x);
    let [i, f] = String(a).split('.');
    if (i.length > 3) i = i.replace(/\B(?=(\d{3})+(?!\d))/g, '{,}');
    return (neg ? '-' : '') + i + (f ? '.' + f : '');
  };
  G.nw = (x) => { x = G.clean(x); return Math.abs(x) >= 1000 ? x.toLocaleString('en-US', { maximumFractionDigits: 6 }) : String(x); }; // plain text
  G.ftex = (n, d) => {
    [n, d] = G.frac(n, d);
    if (d === 1) return G.nt(n);
    return (n < 0 ? '-' : '') + '\\frac{' + Math.abs(n) + '}{' + d + '}';
  };
  G.fstr = (n, d) => { [n, d] = G.frac(n, d); return d === 1 ? String(n) : n + '/' + d; };
  G.fval = (n, d) => n / d;

  /* ------------------------------------------------------------- TeX */
  // '<' and '>' become \\lt / \\gt so math can be injected with innerHTML safely.
  const safe = (s) => String(s).replace(/</g, '\\lt ').replace(/>/g, '\\gt ');
  G.safeTex = safe;
  G.m = (s) => '\\(' + safe(s) + '\\)';
  G.M = (s) => '\\[' + safe(s) + '\\]';
  // term(3,'x',true) -> "3x"; term(-1,'x',false) -> "- x"
  G.term = function (c, v, first) {
    if (c === 0) return '';
    const a = Math.abs(c), body = (a === 1 && v ? '' : G.nt(a)) + (v || '');
    if (first) return (c < 0 ? '-' : '') + body;
    return (c < 0 ? ' - ' : ' + ') + body;
  };
  // poly([a,b,c],'x') -> "ax^2 + bx + c"
  G.poly = function (coefs, v) {
    v = v || 'x';
    const n = coefs.length - 1;
    let s = '', first = true;
    coefs.forEach((c, i) => {
      const p = n - i;
      if (c === 0) return;
      const vv = p === 0 ? '' : p === 1 ? v : v + '^{' + p + '}';
      s += G.term(c, vv, first); first = false;
    });
    return s || '0';
  };
  G.lin = (m, b, v) => G.poly([m, b], v || 'x');
  // Fraction-coefficient term: fterm(-1,2,'x',true) -> "-\\frac{1}{2}x"
  G.fterm = function (n, d, v, first) {
    [n, d] = G.frac(n, d);
    if (n === 0) return '';
    const a = Math.abs(n);
    const body = (d === 1 ? (a === 1 && v ? '' : String(a)) : '\\frac{' + a + '}{' + d + '}') + (v || '');
    if (first) return (n < 0 ? '-' : '') + body;
    return (n < 0 ? ' - ' : ' + ') + body;
  };
  // (mn/md)x + b with a fractional slope
  G.flin = function (mn, md, b, v) {
    const t = G.fterm(mn, md, v || 'x', true);
    if (!t) return G.nt(b);
    return t + (b === 0 ? '' : G.sgn(b));
  };
  // System of equations as an aligned display block
  G.sys = (rows) => '\\[\\begin{aligned}' + rows.map((row) => safe(row.replace(/(<|>|\\le|\\ge|=)/, '&$1'))).join('\\\\') + '\\end{aligned}\\]';
  G.money = (x) => '$' + (Number.isInteger(G.clean(x)) ? G.clean(x).toLocaleString('en-US') : x.toFixed(2));
  G.P = (...a) => a.map((x) => '<p>' + x + '</p>').join('');
  G.sgn = (n) => (n < 0 ? ' - ' + G.nt(-n) : ' + ' + G.nt(n)); // "+ 5" / "- 5"
  G.paren = (n) => (n < 0 ? '(' + G.nt(n) + ')' : G.nt(n));
  G.xm = (h) => (h === 0 ? 'x' : 'x' + G.sgn(-h)); // (x - h) body
  G.pi = (k) => (k === 1 ? '\\pi' : G.nt(k) + '\\pi');

  /* ---------------------------------------------------- answer choices */
  /* Numeric multiple choice. `correct` and distractors are numbers or
     {v, tex, why}. Values are de-duplicated, padded to four, and sorted
     ascending (the SAT's convention for numeric choices). */
  G.mcNum = function (r, correct, distractors, o) {
    o = o || {};
    const fmt = o.fmt || ((v) => G.nt(v));
    const norm = (d) => (typeof d === 'number' ? { v: d } : d);
    // Distractors never show long float tails: round to 2 decimals unless given as TeX.
    const tidy = (d) => (d && !d.tex && isFinite(d.v) && Math.abs(d.v * 1000 - Math.round(d.v * 1000)) > 1e-6 ? Object.assign({}, d, { v: Math.round(d.v * 100) / 100 }) : d);
    const c = norm(correct);
    // o.reject(v) -> true for values that must never appear (e.g. other correct answers)
    const bad = o.reject || (() => false);
    const out = [c], seen = (v) => out.some((x) => Math.abs(x.v - v) < 1e-9);
    distractors.map(norm).map(tidy).forEach((d) => {
      if (out.length < 4 && d && isFinite(d.v) && !seen(d.v) && !bad(d.v) && (o.allowNeg !== false || d.v >= 0 || c.v < 0)) out.push(d);
    });
    // Fraction answers ({v, tex, fr:[n,d]}) are padded with nearby fractions over the same denominator.
    if (c.fr) {
      const [fn, fd] = c.fr;
      for (let k = 1; out.length < 4 && k < 40; k++) {
        for (const nn of [fn + k, fn - k]) {
          if (out.length < 4 && nn > 0 && !seen(nn / fd) && !bad(nn / fd)) out.push({ v: nn / fd, tex: G.ftex(nn, fd) });
        }
      }
    }
    const step = o.step || (Number.isInteger(c.v) ? 1 : 0.5);
    let k = 1;
    while (out.length < 4 && k < 80) {
      for (const cand of r.bool() ? [c.v + step * k, c.v - step * k] : [c.v - step * k, c.v + step * k]) {
        if (out.length < 4 && !seen(cand) && !bad(cand) && (c.v < 0 || cand >= 0 || o.allowNeg)) out.push({ v: G.clean(cand) });
      }
      k++;
    }
    const arr = o.noSort ? r.shuffle(out) : out.slice().sort((a, b) => a.v - b.v);
    return {
      choices: arr.map((x) => G.m(x.tex || fmt(x.v))),
      answer: arr.indexOf(c),
      notes: arr.map((x) => (x === c ? null : x.why || null)),
    };
  };
  /* Text / expression choices: correct + wrongs [{t, why}] or strings. */
  G.mcText = function (r, correct, wrongs, o) {
    o = o || {};
    const norm = (w) => (typeof w === 'string' ? { t: w } : w);
    const all = [{ t: correct, ok: true }].concat(wrongs.map(norm));
    const uniq = [];
    all.forEach((a) => { if (!uniq.some((u) => u.t === a.t)) uniq.push(a); });
    const arr = o.keepOrder ? uniq.slice(0, 4) : r.shuffle(uniq.slice(0, 4));
    return {
      choices: arr.map((x) => (o.math ? G.m(x.t) : x.t)),
      answer: arr.findIndex((x) => x.ok),
      notes: arr.map((x) => (x.ok ? null : x.why || null)),
    };
  };

  /* --------------------------------------------------------- assembly */
  G.make = function (skill, diff, seed, fmt) {
    const set = G.gens[skill] && G.gens[skill][diff];
    if (!set || !set.length) throw new Error('No generator for ' + skill + '/' + diff);
    const r = U.rng(seed);
    const vi = Math.floor(r() * set.length);
    const out = set[vi](r, { fmt });
    const spr = fmt === 'spr' && out.num != null;
    const q = {
      id: ['m', skill, diff, vi, seed, spr ? 's' : 'c'].join('|'),
      section: 'math', skill, diff,
      type: spr ? 'spr' : 'mc',
      stem: spr && out.sprStem ? out.sprStem : out.stem,
      figure: out.figure || '',
      explanation: out.explanation || '',
    };
    if (spr) {
      q.answer = out.num;
      if (out.numAlt) q.answers = [out.num].concat(out.numAlt);
      if (out.range) q.range = out.range;
      q.answerShow = out.numShow || G.showNum(out.num);
    } else {
      q.choices = out.choices; q.answer = out.answer;
      const notes = (out.notes || []).map((w, i) => (w ? '<li><b>Choice ' + U.letter(i) + '</b> is incorrect. ' + w + '</li>' : '')).join('');
      if (notes) q.explanation += '<ul class="why-wrong">' + notes + '</ul>';
    }
    if (!spr && out.num != null) q.sprCapable = true;
    return q;
  };
  G.fromId = function (id) {
    const p = id.split('|');
    return G.make(p[1], p[2], +p[4], p[5] === 's' ? 'spr' : 'mc');
  };
  G.random = (skill, diff, fmt) => G.make(skill, diff, Math.floor(Math.random() * 2147483647), fmt);
  G.skillsWithGens = () => Object.keys(G.gens);

  /* Accepted-answer text for a numeric response, e.g. "2/3, .6666, .6667, 0.666, 0.667". */
  G.showNum = function (v) {
    if (Number.isInteger(G.clean(v))) return String(G.clean(v));
    const a = Math.abs(v), sg = v < 0 ? '-' : '', out = [];
    for (let d = 2; d <= 1000; d++) {
      const n = Math.round(a * d);
      if (Math.abs(n / d - a) < 1e-7) { if ((n + '/' + d).length <= 5) out.push(sg + n + '/' + d); break; }
    }
    const s = String(G.clean(a));
    if (s.length <= 5) {
      out.push(sg + s);
      if (s.startsWith('0.')) out.push(sg + s.slice(1));
    } else {
      const fixed = (d, round) => { const f = Math.pow(10, d), x = (round ? Math.round(a * f) : Math.trunc(a * f)) / f; return x.toFixed(d); };
      const forms = [];
      if (a < 1) {
        forms.push(fixed(4, false).slice(1), fixed(4, true).slice(1), fixed(3, false), fixed(3, true));
      } else {
        const d = 5 - String(Math.trunc(a)).length - 1;
        if (d > 0) forms.push(fixed(d, false), fixed(d, true));
      }
      forms.forEach((f) => out.push(sg + f));
    }
    return Array.from(new Set(out)).join(', ');
  };

  /* SAT grid-in rules: fractions or decimals, max 5 characters (6 with a
     leading minus). A decimal that doesn't fit must fill the whole box and
     may be rounded or truncated. Mixed numbers are not accepted. */
  G.parseSpr = function (s) {
    s = String(s || '').trim();
    if (/^-?\d+\/\d+$/.test(s)) {
      const [a, b] = s.replace('-', '').split('/').map(Number);
      if (!b) return null;
      return { v: (s[0] === '-' ? -1 : 1) * a / b, frac: true };
    }
    if (/^-?(\d+\.?\d*|\.\d+)$/.test(s)) {
      const decs = s.includes('.') ? s.split('.')[1].length : 0;
      return { v: parseFloat(s), dec: true, decs, len: s.replace('-', '').length };
    }
    return null;
  };
  G.checkSpr = function (input, q) {
    const p = G.parseSpr(input);
    if (!p) return false;
    if (q.range) {
      const [lo, hi, li, hiI] = q.range;
      const okLo = li ? p.v >= lo - 1e-9 : p.v > lo + 1e-12, okHi = hiI ? p.v <= hi + 1e-9 : p.v < hi - 1e-12;
      if (okLo && okHi) return true;
    }
    const targets = q.answers || (q.answer != null && typeof q.answer === 'number' ? [q.answer] : []);
    for (const t of targets) {
      if (Math.abs(p.v - t) < 1e-9) return true;
      if (p.dec && p.decs > 0 && p.len >= 5) {
        const f = Math.pow(10, p.decs), tr = Math.trunc(t * f) / f, ro = Math.round(t * f) / f;
        if (Math.abs(p.v - tr) < 1e-9 || Math.abs(p.v - ro) < 1e-9) return true;
      }
    }
    return false;
  };
})();
