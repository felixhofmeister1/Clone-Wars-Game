/* Graphing calculator (Desmos-style) and scientific calculator.
   Includes a small math parser with implicit multiplication, user functions,
   sliders, inequalities, implicit curves, points, and points of interest
   (zeros, extrema, intersections) you can hover or tap. */
(function () {
  'use strict';
  const SAT = window.SAT, U = SAT.util, h = U.h;

  /* ============================================================ parser */
  const FUNCS = {
    sin: 1, cos: 1, tan: 1, sec: 1, csc: 1, cot: 1, asin: 1, acos: 1, atan: 1, arcsin: 1, arccos: 1, arctan: 1,
    sinh: 1, cosh: 1, tanh: 1, sqrt: 1, cbrt: 1, abs: 1, ln: 1, log: 1, exp: 1, floor: 1, ceil: 1, round: 1, sign: 1,
    min: 2, max: 2, mod: 2, nthroot: 2,
  };
  const NAMES = Object.keys(FUNCS).concat(['pi', 'theta', 'ans']).sort((a, b) => b.length - a.length);

  function tokenize(src) {
    const s = String(src).replace(/−/g, '-').replace(/[×·]/g, '*').replace(/÷/g, '/').replace(/≤/g, '<=').replace(/≥/g, '>=')
      .replace(/π/g, 'pi').replace(/θ/g, 'theta').replace(/√/g, 'sqrt').replace(/\*\*/g, '^').replace(/\s+/g, '');
    const out = [];
    let i = 0;
    while (i < s.length) {
      const rest = s.slice(i);
      let m = /^(\d+\.?\d*|\.\d+)(e[+-]?\d+)?/.exec(rest);
      if (m && !(m[2] && /[a-z]/i.test(rest[m[0].length]))) { out.push({ t: 'num', v: parseFloat(m[0]) }); i += m[0].length; continue; }
      if (m) { out.push({ t: 'num', v: parseFloat(m[1]) }); i += m[1].length; continue; }
      if (/[a-z]/i.test(s[i])) {
        const name = NAMES.find((n) => rest.toLowerCase().startsWith(n));
        if (name) { out.push({ t: FUNCS[name] ? 'fn' : 'id', v: name }); i += name.length; continue; }
        out.push({ t: 'id', v: s[i] }); i++; continue;
      }
      m = /^(<=|>=|<|>|=)/.exec(rest);
      if (m) { out.push({ t: 'rel', v: m[0] }); i += m[0].length; continue; }
      if ('+-*/^(),!|[]{}'.includes(s[i])) {
        const c = s[i] === '[' || s[i] === '{' ? '(' : s[i] === ']' || s[i] === '}' ? ')' : s[i];
        out.push({ t: 'op', v: c }); i++; continue;
      }
      throw new Error('Unexpected "' + s[i] + '"');
    }
    return out;
  }

  function parse(src) {
    const toks = tokenize(src);
    let p = 0, absDepth = 0;
    const peek = () => toks[p], next = () => toks[p++];
    const isOp = (v) => peek() && peek().t === 'op' && peek().v === v;
    const expect = (v) => { if (!isOp(v)) throw new Error('Expected "' + v + '"'); p++; };
    const startsPrimary = (t) => t && (t.t === 'num' || t.t === 'id' || t.t === 'fn' || (t.t === 'op' && (t.v === '(' || (t.v === '|' && absDepth === 0))));

    function expr() { return sum(); }
    function sum() {
      let a = product();
      while (peek() && peek().t === 'op' && (peek().v === '+' || peek().v === '-')) { const op = next().v; a = { k: 'bin', op, a, b: product() }; }
      return a;
    }
    function product() {
      let a = unary();
      for (;;) {
        const t = peek();
        if (t && t.t === 'op' && (t.v === '*' || t.v === '/')) { next(); a = { k: 'bin', op: t.v, a, b: unary() }; }
        else if (startsPrimary(t)) a = { k: 'bin', op: '*', a, b: power() };
        else break;
      }
      return a;
    }
    function unary() {
      if (isOp('-')) { next(); return { k: 'neg', a: unary() }; }
      if (isOp('+')) { next(); return unary(); }
      return power();
    }
    function power() {
      const base = postfix();
      if (isOp('^')) { next(); return { k: 'bin', op: '^', a: base, b: unary() }; }
      return base;
    }
    function postfix() {
      let a = primary();
      while (isOp('!')) { next(); a = { k: 'fact', a }; }
      return a;
    }
    function primary() {
      const t = next();
      if (!t) throw new Error('Incomplete expression');
      if (t.t === 'num') return { k: 'num', v: t.v };
      if (t.t === 'id') {
        if (t.v === 'pi') return { k: 'num', v: Math.PI };
        // user function call like f(x)
        if (/^[a-z]$/i.test(t.v) && isOp('(') && !['x', 'y', 'e'].includes(t.v)) {
          const save = p; next();
          try { const args = [expr()]; while (isOp(',')) { next(); args.push(expr()); } expect(')'); return { k: 'ucall', name: t.v, args }; }
          catch (e) { p = save; }
        }
        return { k: 'var', name: t.v };
      }
      if (t.t === 'fn') {
        let args;
        if (isOp('(')) { next(); args = [expr()]; while (isOp(',')) { next(); args.push(expr()); } expect(')'); }
        else if (isOp('^') && ['sin', 'cos', 'tan'].includes(t.v)) { // sin^2(x)
          next(); const pw = unary(); expect('('); const inner = expr(); expect(')');
          return { k: 'bin', op: '^', a: { k: 'call', fn: t.v, args: [inner] }, b: pw };
        }
        else args = [power()];
        return { k: 'call', fn: t.v, args };
      }
      if (t.t === 'op' && t.v === '(') {
        const first = expr();
        if (isOp(',')) { const items = [first]; while (isOp(',')) { next(); items.push(expr()); } expect(')'); return { k: 'tuple', items }; }
        expect(')'); return first;
      }
      if (t.t === 'op' && t.v === '|') { absDepth++; const inner = expr(); expect('|'); absDepth--; return { k: 'call', fn: 'abs', args: [inner] }; }
      throw new Error('Unexpected "' + t.v + '"');
    }

    // split on a top-level relation
    let rel = null, relIdx = -1, depth = 0;
    toks.forEach((t, i) => {
      if (t.t === 'op' && t.v === '(') depth++;
      if (t.t === 'op' && t.v === ')') depth--;
      if (t.t === 'rel' && depth === 0 && relIdx < 0) { rel = t.v; relIdx = i; }
    });
    if (relIdx >= 0) {
      const lhsToks = toks.slice(0, relIdx), rhsToks = toks.slice(relIdx + 1);
      const sub = (tt) => { const saveT = toks.splice(0, toks.length, ...tt); p = 0; const e = expr(); if (p < toks.length) throw new Error('Unexpected "' + toks[p].v + '"'); toks.splice(0, toks.length, ...saveT); return e; };
      const L = sub(lhsToks), R = sub(rhsToks);
      return { k: 'rel', op: rel, a: L, b: R, ltoks: lhsToks };
    }
    const e = expr();
    if (p < toks.length) throw new Error('Unexpected "' + toks[p].v + '"');
    return e;
  }

  function fact(n) { if (n < 0 || !Number.isInteger(n)) return gamma(n + 1); let r = 1; for (let i = 2; i <= n; i++) r *= i; return r; }
  function gamma(z) { // Lanczos
    if (z < 0.5) return Math.PI / (Math.sin(Math.PI * z) * gamma(1 - z));
    z -= 1; const g = 7, c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
    let x = c[0]; for (let i = 1; i < g + 2; i++) x += c[i] / (z + i);
    const t = z + g + 0.5; return Math.sqrt(2 * Math.PI) * Math.pow(t, z + 0.5) * Math.exp(-t) * x;
  }

  /* Compile an AST to a closure over a scope {vars, funcs, deg}. */
  function compile(node) {
    switch (node.k) {
      case 'num': { const v = node.v; return () => v; }
      case 'var': {
        const n = node.name;
        return (s) => {
          if (n in s.vars) return s.vars[n];
          if (n === 'e') return Math.E;
          if (n === 'theta') return s.vars.theta;
          throw new Error('Undefined: ' + n);
        };
      }
      case 'neg': { const a = compile(node.a); return (s) => -a(s); }
      case 'fact': { const a = compile(node.a); return (s) => fact(a(s)); }
      case 'bin': {
        const a = compile(node.a), b = compile(node.b);
        switch (node.op) {
          case '+': return (s) => a(s) + b(s);
          case '-': return (s) => a(s) - b(s);
          case '*': return (s) => a(s) * b(s);
          case '/': return (s) => a(s) / b(s);
          case '^': return (s) => { const x = a(s), y = b(s); if (x < 0 && !Number.isInteger(y)) { const inv = 1 / y; if (Number.isInteger(inv) && inv % 2) return -Math.pow(-x, y); } return Math.pow(x, y); };
        }
        break;
      }
      case 'tuple': { const f = node.items.map(compile); return (s) => f.map((g) => g(s)); }
      case 'ucall': {
        const args = node.args.map(compile), name = node.name;
        return (s) => {
          const f = s.funcs[name];
          if (!f) { if (name in s.vars && args.length === 1) return s.vars[name] * args[0](s); throw new Error('Undefined function: ' + name); }
          if (s.depth > 50) throw new Error('Too much recursion');
          const vars = Object.assign({}, s.vars);
          f.params.forEach((pn, i) => (vars[pn] = args[i] ? args[i](s) : NaN));
          return f.body({ vars, funcs: s.funcs, deg: s.deg, depth: (s.depth || 0) + 1 });
        };
      }
      case 'call': {
        const args = node.args.map(compile), fn = node.fn;
        const toR = (s, v) => (s.deg ? (v * Math.PI) / 180 : v), fromR = (s, v) => (s.deg ? (v * 180) / Math.PI : v);
        const one = (f) => (s) => f(args[0](s), s);
        switch (fn) {
          case 'sin': return one((v, s) => Math.sin(toR(s, v)));
          case 'cos': return one((v, s) => Math.cos(toR(s, v)));
          case 'tan': return one((v, s) => Math.tan(toR(s, v)));
          case 'sec': return one((v, s) => 1 / Math.cos(toR(s, v)));
          case 'csc': return one((v, s) => 1 / Math.sin(toR(s, v)));
          case 'cot': return one((v, s) => 1 / Math.tan(toR(s, v)));
          case 'asin': case 'arcsin': return one((v, s) => fromR(s, Math.asin(v)));
          case 'acos': case 'arccos': return one((v, s) => fromR(s, Math.acos(v)));
          case 'atan': case 'arctan': return one((v, s) => fromR(s, Math.atan(v)));
          case 'sinh': return one(Math.sinh); case 'cosh': return one(Math.cosh); case 'tanh': return one(Math.tanh);
          case 'sqrt': return one(Math.sqrt); case 'cbrt': return one(Math.cbrt); case 'abs': return one(Math.abs);
          case 'ln': return one(Math.log);
          case 'log': return args.length > 1 ? (s) => Math.log(args[1](s)) / Math.log(args[0](s)) : one(Math.log10);
          case 'exp': return one(Math.exp); case 'floor': return one(Math.floor); case 'ceil': return one(Math.ceil);
          case 'round': return one(Math.round); case 'sign': return one(Math.sign);
          case 'min': return (s) => Math.min(...args.map((a) => a(s)));
          case 'max': return (s) => Math.max(...args.map((a) => a(s)));
          case 'mod': return (s) => { const a = args[0](s), b = args[1](s); return ((a % b) + b) % b; };
          case 'nthroot': return (s) => { const n = args[0](s), v = args[1](s); return v < 0 && n % 2 ? -Math.pow(-v, 1 / n) : Math.pow(v, 1 / n); };
        }
        break;
      }
    }
    throw new Error('Cannot evaluate');
  }

  function freeVars(node, out) {
    out = out || new Set();
    if (!node) return out;
    if (node.k === 'var') out.add(node.name);
    ['a', 'b'].forEach((k) => node[k] && freeVars(node[k], out));
    (node.args || node.items || []).forEach((n) => freeVars(n, out));
    return out;
  }
  function usesCalls(node, out) {
    out = out || new Set();
    if (!node) return out;
    if (node.k === 'ucall') out.add(node.name);
    ['a', 'b'].forEach((k) => node[k] && usesCalls(node[k], out));
    (node.args || node.items || []).forEach((n) => usesCalls(n, out));
    return out;
  }

  /* Decimal -> fraction string via continued fractions. */
  function toFraction(x, maxDen) {
    maxDen = maxDen || 10000;
    if (!isFinite(x)) return null;
    const sign = x < 0 ? -1 : 1; x = Math.abs(x);
    let h1 = 1, h0 = 0, k1 = 0, k0 = 1, b = x;
    for (let i = 0; i < 40; i++) {
      const a = Math.floor(b), h2 = a * h1 + h0, k2 = a * k1 + k0;
      if (k2 > maxDen) break;
      h0 = h1; h1 = h2; k0 = k1; k1 = k2;
      if (Math.abs(x - h1 / k1) < 1e-10) break;
      b = 1 / (b - a);
    }
    if (Math.abs(x - h1 / k1) > 1e-9) return null;
    return (sign < 0 ? '-' : '') + h1 + (k1 === 1 ? '' : '/' + k1);
  }
  const fmtNum = (v) => {
    if (!isFinite(v)) return isNaN(v) ? 'undefined' : v > 0 ? '∞' : '-∞';
    if (Math.abs(v) < 1e-12) return '0';
    if (Math.abs(v) >= 1e10 || Math.abs(v) < 1e-6) return v.toExponential(6).replace(/\.?0+e/, 'e');
    return String(Math.round(v * 1e10) / 1e10);
  };

  SAT.calcCore = { parse, compile, toFraction, fmtNum, freeVars };

  /* ============================================================ graphing */
  const COLORS = ['#c74440', '#2d70b3', '#388c46', '#6042a6', '#fa7e19', '#000000'];

  function buildGraph(body, api) {
    const saved = SAT.store.get('calc.exprs', null);
    let exprs = (saved && saved.length ? saved : [{ text: '' }]).map((e, i) => ({ text: e.text, color: COLORS[i % COLORS.length], hidden: !!e.hidden }));
    let deg = !!SAT.store.get('calc.deg', false);
    const view = { cx: 0, cy: 0, scale: 32 };
    const listEl = h('div.gc-list');
    const canvas = h('canvas.gc-canvas');
    const tip = h('div.gc-tip.hidden');
    const zoomIn = h('button.icon-btn', { title: 'Zoom in', html: U.icon('plus') });
    const zoomOut = h('button.icon-btn', { title: 'Zoom out', html: U.icon('minus') });
    const home = h('button.icon-btn', { title: 'Default view', html: U.icon('home') });
    const degBtn = h('button.chip-btn', { title: 'Angle mode', text: deg ? 'DEG' : 'RAD' });
    const plot = h('div.gc-plot', canvas, tip, h('div.gc-zoom', zoomIn, zoomOut, home, degBtn));
    const addBtn = h('button.btn.btn-sm', { html: U.icon('plus') + ' Add expression' });
    const clearBtn = h('button.btn.btn-sm.btn-ghost', { html: U.icon('trash') + ' Clear' });
    const side = h('div.gc-side', listEl, h('div.gc-actions', addBtn, clearBtn), h('p.gc-help', { html: 'Try <code>y=2x+1</code>, <code>x^2-4</code>, <code>f(x)=3x-5</code>, <code>a=2</code> (slider), <code>y&lt;x+3</code>, <code>x^2+y^2=25</code>, <code>(2,3)</code>, or <code>sqrt(50)</code>. Tap gray points to see coordinates.' }));
    body.appendChild(h('div.gc', side, plot));
    let parsed = [], pois = [], hoverPt = null;

    function saveExprs() { SAT.store.set('calc.exprs', exprs.map((e) => ({ text: e.text, hidden: e.hidden }))); }

    function analyze() {
      const funcs = {}, vars = {};
      parsed = exprs.map((e) => {
        const r = { e, kind: 'empty', err: null };
        if (!e.text.trim()) return r;
        try {
          const ast = parse(e.text);
          r.ast = ast;
          if (ast.k === 'rel') {
            const lt = ast.ltoks;
            if (ast.op === '=' && lt.length >= 4 && lt[0].t === 'id' && lt[1].v === '(' && lt[lt.length - 1].v === ')' && /^[a-z]$/i.test(lt[0].v) && !['x', 'y'].includes(lt[0].v)) {
              const params = lt.slice(2, -1).filter((t) => t.t === 'id').map((t) => t.v);
              r.kind = 'fdef'; r.name = lt[0].v; r.params = params; r.body = compile(ast.b);
              funcs[r.name] = { params, body: r.body };
            } else if (ast.op === '=' && ast.a.k === 'var' && !['x', 'y'].includes(ast.a.name) && !freeVars(ast.b).has('x') && !freeVars(ast.b).has('y')) {
              r.kind = 'vardef'; r.name = ast.a.name; r.fn = compile(ast.b);
            } else if (ast.a.k === 'var' && ast.a.name === 'y' && !freeVars(ast.b).has('y')) {
              r.kind = 'explicit'; r.op = ast.op; r.fn = compile(ast.b);
            } else if (ast.a.k === 'var' && ast.a.name === 'x' && !freeVars(ast.b).has('x') && !freeVars(ast.b).has('y')) {
              r.kind = 'vline'; r.op = ast.op; r.fn = compile(ast.b);
            } else {
              const fa = compile(ast.a), fb = compile(ast.b);
              const fv = new Set([...freeVars(ast.a), ...freeVars(ast.b)]);
              r.kind = fv.has('y') ? 'implicit' : 'xsolve'; r.op = ast.op;
              r.F = (s) => fa(s) - fb(s);
            }
          } else if (ast.k === 'tuple') {
            r.kind = 'point'; r.fn = compile(ast);
          } else {
            const fv = freeVars(ast);
            if (fv.has('x') || [...usesCalls(ast)].length && fv.has('x')) { r.kind = 'explicit'; r.op = '='; r.fn = compile(ast); }
            else if (fv.has('y')) { r.kind = 'error'; r.err = 'Add an equals sign, like y = …'; }
            else { r.kind = 'value'; r.fn = compile(ast); }
          }
        } catch (err) { r.kind = 'error'; r.err = err.message; }
        return r;
      });
      // resolve variable definitions (allow chains)
      for (let pass = 0; pass < 3; pass++) parsed.forEach((r) => { if (r.kind === 'vardef') { try { vars[r.name] = r.fn({ vars, funcs, deg }); } catch (e) { /* later pass */ } } });
      const scope = { vars, funcs, deg };
      parsed.forEach((r) => {
        r.scope = scope;
        if (['explicit', 'value', 'point', 'vline', 'implicit', 'xsolve'].includes(r.kind)) {
          // detect missing variables for slider suggestions
          const fv = freeVars(r.ast.k === 'rel' ? { k: 'x', a: r.ast.a, b: r.ast.b } : r.ast);
          const missing = [...fv].filter((v) => !['x', 'y', 'e', 'theta'].includes(v) && !(v in vars));
          if (missing.length) { r.missing = missing; r.kind = 'error'; r.err = 'Undefined: ' + missing.join(', '); }
        }
        if (r.kind === 'fdef') r.plot = r.params.length === 1 && r.params[0] === 'x';
      });
    }

    function evalAt(r, x) {
      try {
        if (r.kind === 'fdef') { const vars = Object.assign({}, r.scope.vars, { x }); return r.body({ vars, funcs: r.scope.funcs, deg }); }
        return r.fn({ vars: Object.assign({}, r.scope.vars, { x }), funcs: r.scope.funcs, deg });
      } catch (e) { return NaN; }
    }
    const curves = () => parsed.filter((r) => !r.e.hidden && ((r.kind === 'explicit') || (r.kind === 'fdef' && r.plot)));

    /* --------------------------------------------------------- list UI */
    function renderList() {
      listEl.innerHTML = '';
      exprs.forEach((e, i) => {
        const r = parsed[i] || {};
        const input = h('input.gc-input', { type: 'text', value: e.text, spellcheck: 'false', autocomplete: 'off', 'aria-label': 'Expression ' + (i + 1), placeholder: i === 0 ? 'Type an expression' : '' });
        const swatch = h('button.gc-swatch' + (e.hidden ? '.off' : ''), { title: e.hidden ? 'Show' : 'Hide', style: { '--c': e.color } });
        const del = h('button.icon-btn.gc-del', { title: 'Delete', html: U.icon('x') });
        const out = h('div.gc-out');
        const row = h('div.gc-row', h('div.gc-row-main', swatch, input, del), out);
        input.addEventListener('input', () => { e.text = input.value; refresh(false); fillOut(i, out); });
        input.addEventListener('keydown', (ev) => {
          if (ev.key === 'Enter') { ev.preventDefault(); if (i === exprs.length - 1) { exprs.push({ text: '', color: COLORS[exprs.length % COLORS.length] }); refresh(true); } const ins = U.$$('.gc-input', listEl); (ins[i + 1] || ins[i]).focus(); }
          if (ev.key === 'Backspace' && !input.value && exprs.length > 1) { ev.preventDefault(); exprs.splice(i, 1); refresh(true); const ins = U.$$('.gc-input', listEl); (ins[Math.max(0, i - 1)]).focus(); }
        });
        swatch.addEventListener('click', () => { e.hidden = !e.hidden; refresh(true); });
        del.addEventListener('click', () => { exprs.splice(i, 1); if (!exprs.length) exprs.push({ text: '', color: COLORS[0] }); refresh(true); });
        listEl.appendChild(row);
        fillOut(i, out);
      });
    }
    function fillOut(i, out) {
      const r = parsed[i];
      out.innerHTML = '';
      if (!r) return;
      if (r.kind === 'error') {
        out.appendChild(h('span.gc-err', r.err));
        (r.missing || []).forEach((v) => {
          const b = h('button.chip-btn', { text: 'add slider: ' + v });
          b.addEventListener('click', () => { exprs.splice(i, 0, { text: v + '=1', color: COLORS[exprs.length % COLORS.length] }); refresh(true); });
          out.appendChild(b);
        });
      } else if (r.kind === 'value') {
        let v; try { v = r.fn(r.scope); } catch (e) { v = NaN; }
        const fr = Number.isInteger(v) ? null : toFraction(v, 1000);
        out.appendChild(h('span.gc-val', '= ' + fmtNum(v) + (fr && fr.includes('/') ? '  (' + fr + ')' : '')));
      } else if (r.kind === 'vardef') {
        const cur = r.scope.vars[r.name];
        const lo = Math.min(-10, Math.floor(cur)), hi = Math.max(10, Math.ceil(cur));
        const slider = h('input.gc-slider', { type: 'range', min: lo, max: hi, step: 0.1, value: cur, 'aria-label': 'Slider for ' + r.name });
        const lbl = h('span.gc-val', r.name + ' = ' + fmtNum(cur));
        slider.addEventListener('input', () => {
          exprs[i].text = r.name + '=' + slider.value;
          lbl.textContent = r.name + ' = ' + slider.value;
          const inp = U.$$('.gc-input', listEl)[i]; if (inp) inp.value = exprs[i].text;
          refresh(false);
        });
        out.appendChild(slider); out.appendChild(lbl);
      } else if (r.kind === 'xsolve') {
        const sols = solveX(r);
        out.appendChild(h('span.gc-val', sols.length ? 'x = ' + sols.map(fmtNum).join(', ') : (r.op === '=' ? 'no solution in view' : 'region shaded')));
      }
    }

    function refresh(rebuild) {
      analyze(); saveExprs();
      if (rebuild) renderList();
      draw();
    }

    /* -------------------------------------------------------- drawing */
    let W = 0, H = 0, dpr = 1;
    const ctx = canvas.getContext('2d');
    const X = (x) => W / 2 + (x - view.cx) * view.scale, Y = (y) => H / 2 - (y - view.cy) * view.scale;
    const ix = (px) => view.cx + (px - W / 2) / view.scale, iy = (py) => view.cy - (py - H / 2) / view.scale;
    function resize() {
      const r = plot.getBoundingClientRect();
      dpr = window.devicePixelRatio || 1; W = Math.max(50, r.width); H = Math.max(50, r.height);
      canvas.width = W * dpr; canvas.height = H * dpr; canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
      draw();
    }
    function niceStep(px) { const raw = px / view.scale, p = Math.pow(10, Math.floor(Math.log10(raw))), f = raw / p; return (f < 1.5 ? 1 : f < 3.5 ? 2 : f < 7.5 ? 5 : 10) * p; }

    function solveX(r) {
      const xs = [], x0 = ix(0), x1 = ix(W), N = 800;
      const F = (x) => { try { return r.F({ vars: Object.assign({}, r.scope.vars, { x }), funcs: r.scope.funcs, deg }); } catch (e) { return NaN; } };
      let prev = F(x0);
      for (let i = 1; i <= N; i++) {
        const x = x0 + ((x1 - x0) * i) / N, v = F(x);
        if (Math.abs(v) < 1e-12) xs.push(x);
        else if (isFinite(prev) && isFinite(v) && prev * v < 0) { const root = bisect(F, x - (x1 - x0) / N, x); if (root != null) xs.push(root); }
        prev = v;
      }
      return dedupe(xs);
    }
    function bisect(f, a, b) {
      let fa = f(a), fb = f(b);
      if (!isFinite(fa) || !isFinite(fb) || fa * fb > 0) return null;
      for (let i = 0; i < 60; i++) { const m = (a + b) / 2, fm = f(m); if (fa * fm <= 0) { b = m; fb = fm; } else { a = m; fa = fm; } }
      const m = (a + b) / 2;
      return Math.abs(f(m)) < 1e-6 * Math.max(1, Math.abs(m)) + 1e-6 ? m : null; // reject asymptote sign flips
    }
    const dedupe = (xs) => xs.filter((x, i) => xs.findIndex((y) => Math.abs(y - x) < 1e-6 * Math.max(1, Math.abs(x))) === i).map((x) => (Math.abs(x - Math.round(x)) < 1e-9 ? Math.round(x) : x));

    function draw() {
      if (!W) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const css = getComputedStyle(body);
      const bg = css.getPropertyValue('--gc-bg').trim() || '#fff', gridC = css.getPropertyValue('--gc-grid').trim() || '#e6e6e6', axisC = css.getPropertyValue('--gc-axis').trim() || '#555', txtC = css.getPropertyValue('--gc-text').trim() || '#333';
      ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
      const step = niceStep(90), minor = step / 5;
      ctx.lineWidth = 1;
      ctx.strokeStyle = gridC; ctx.globalAlpha = 0.45; gridLines(minor); ctx.globalAlpha = 1; gridLines(step);
      ctx.strokeStyle = axisC; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(0, Y(0)); ctx.lineTo(W, Y(0)); ctx.moveTo(X(0), 0); ctx.lineTo(X(0), H); ctx.stroke();
      ctx.fillStyle = txtC; ctx.font = '11px system-ui, sans-serif';
      const lx = U.clamp(X(0), 4, W - 30), ly = U.clamp(Y(0), 12, H - 4);
      for (let v = Math.ceil(ix(0) / step) * step; v <= ix(W); v += step) if (Math.abs(v) > step / 2) { ctx.textAlign = 'center'; ctx.fillText(fmtNum(+v.toPrecision(10)), X(v), ly + 13 > H ? ly - 4 : ly + 13); }
      for (let v = Math.ceil(iy(H) / step) * step; v <= iy(0); v += step) if (Math.abs(v) > step / 2) { ctx.textAlign = 'right'; ctx.fillText(fmtNum(+v.toPrecision(10)), lx - 4 < 20 ? lx + 30 : lx - 4, Y(v) + 4); }

      pois = [];
      parsed.forEach((r) => {
        if (r.e.hidden) return;
        ctx.strokeStyle = r.e.color; ctx.fillStyle = r.e.color; ctx.lineWidth = 2.5;
        if (r.kind === 'explicit' || (r.kind === 'fdef' && r.plot)) drawExplicit(r);
        else if (r.kind === 'vline') drawVline(r);
        else if (r.kind === 'implicit') drawImplicit(r);
        else if (r.kind === 'xsolve') solveX(r).forEach((x) => { ctx.setLineDash([6, 4]); ctx.beginPath(); ctx.moveTo(X(x), 0); ctx.lineTo(X(x), H); ctx.stroke(); ctx.setLineDash([]); pois.push({ x, y: 0, label: 'x = ' + fmtNum(x) }); });
        else if (r.kind === 'point') drawPoint(r);
      });
      findPOIs();
      pois.forEach((p) => { ctx.fillStyle = '#8a8a8a'; ctx.beginPath(); ctx.arc(X(p.x), Y(p.y), 3.5, 0, 7); ctx.fill(); });
      if (hoverPt) {
        ctx.fillStyle = hoverPt.color || '#333'; ctx.beginPath(); ctx.arc(X(hoverPt.x), Y(hoverPt.y), 5, 0, 7); ctx.fill();
      }
    }
    function gridLines(st) {
      ctx.beginPath();
      for (let v = Math.ceil(ix(0) / st) * st; v <= ix(W); v += st) { const px = Math.round(X(v)) + 0.5; ctx.moveTo(px, 0); ctx.lineTo(px, H); }
      for (let v = Math.ceil(iy(H) / st) * st; v <= iy(0); v += st) { const py = Math.round(Y(v)) + 0.5; ctx.moveTo(0, py); ctx.lineTo(W, py); }
      ctx.stroke();
    }
    function drawExplicit(r) {
      const pts = [];
      for (let px = 0; px <= W; px += 1) { const x = ix(px); pts.push([px, evalAt(r, x)]); }
      const strict = r.op === '<' || r.op === '>';
      if (r.op && r.op !== '=') {
        ctx.save(); ctx.globalAlpha = 0.18; ctx.beginPath();
        const edge = r.op[0] === '<' ? H : 0;
        ctx.moveTo(0, edge);
        pts.forEach(([px, y]) => ctx.lineTo(px, isFinite(y) ? U.clamp(Y(y), -10, H + 10) : edge));
        ctx.lineTo(W, edge); ctx.closePath(); ctx.fill(); ctx.restore();
      }
      if (strict) ctx.setLineDash([8, 6]);
      ctx.beginPath();
      let pen = false, prevY = null;
      pts.forEach(([px, y]) => {
        const py = Y(y);
        if (!isFinite(y) || Math.abs(py) > 1e5 || (prevY != null && Math.abs(py - prevY) > H * 2)) { pen = false; prevY = isFinite(y) ? py : null; return; }
        if (pen) ctx.lineTo(px, py); else ctx.moveTo(px, py);
        pen = true; prevY = py;
      });
      ctx.stroke(); ctx.setLineDash([]);
    }
    function drawVline(r) {
      let c; try { c = r.fn(r.scope); } catch (e) { return; }
      if (r.op !== '=') { ctx.save(); ctx.globalAlpha = 0.18; if (r.op[0] === '<') ctx.fillRect(0, 0, X(c), H); else ctx.fillRect(X(c), 0, W - X(c), H); ctx.restore(); }
      if (r.op === '<' || r.op === '>') ctx.setLineDash([8, 6]);
      ctx.beginPath(); ctx.moveTo(X(c), 0); ctx.lineTo(X(c), H); ctx.stroke(); ctx.setLineDash([]);
    }
    function drawImplicit(r) {
      const cell = 5, nx = Math.ceil(W / cell) + 1, ny = Math.ceil(H / cell) + 1, v = new Float64Array(nx * ny);
      const sc = { vars: Object.assign({}, r.scope.vars), funcs: r.scope.funcs, deg };
      for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { sc.vars.x = ix(i * cell); sc.vars.y = iy(j * cell); let f; try { f = r.F(sc); } catch (e) { f = NaN; } v[j * nx + i] = f; }
      if (r.op !== '=') {
        ctx.save(); ctx.globalAlpha = 0.18;
        const want = r.op[0] === '<' ? (f) => f < 0 : (f) => f > 0;
        for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) if (want(v[j * nx + i])) ctx.fillRect(i * cell, j * cell, cell, cell);
        ctx.restore();
      }
      if (r.op === '<' || r.op === '>') ctx.setLineDash([6, 5]);
      ctx.beginPath();
      const lerp = (a, b) => a / (a - b);
      for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
        const a = v[j * nx + i], b = v[j * nx + i + 1], c = v[(j + 1) * nx + i + 1], d = v[(j + 1) * nx + i];
        if (![a, b, c, d].every(isFinite)) continue;
        const e = [];
        if ((a < 0) !== (b < 0)) e.push([i + lerp(a, b), j]);
        if ((b < 0) !== (c < 0)) e.push([i + 1, j + lerp(b, c)]);
        if ((d < 0) !== (c < 0)) e.push([i + lerp(d, c), j + 1]);
        if ((a < 0) !== (d < 0)) e.push([i, j + lerp(a, d)]);
        if (Math.max(Math.abs(a), Math.abs(b), Math.abs(c), Math.abs(d)) > 1e6) continue;
        for (let k = 0; k + 1 < e.length; k += 2) { ctx.moveTo(e[k][0] * cell, e[k][1] * cell); ctx.lineTo(e[k + 1][0] * cell, e[k + 1][1] * cell); }
      }
      ctx.stroke(); ctx.setLineDash([]);
    }
    function drawPoint(r) {
      let p; try { p = r.fn(r.scope); } catch (e) { return; }
      if (p.length !== 2) return;
      ctx.beginPath(); ctx.arc(X(p[0]), Y(p[1]), 5, 0, 7); ctx.fill();
      ctx.font = '12px system-ui, sans-serif'; ctx.textAlign = 'left';
      ctx.fillText('(' + fmtNum(p[0]) + ', ' + fmtNum(p[1]) + ')', X(p[0]) + 8, Y(p[1]) - 8);
    }
    function findPOIs() {
      const cs = curves(), x0 = ix(0), x1 = ix(W), N = 600, dx = (x1 - x0) / N;
      cs.forEach((r) => {
        if (r.op && r.op !== '=' && r.kind === 'explicit') return;
        const f = (x) => evalAt(r, x);
        let prev = f(x0), prevD = null;
        const y0 = f(0);
        if (isFinite(y0) && 0 >= x0 && 0 <= x1) pois.push({ x: 0, y: y0, label: 'y-intercept' });
        for (let i = 1; i <= N; i++) {
          const x = x0 + dx * i, v = f(x);
          if (isFinite(prev) && isFinite(v)) {
            if (prev === 0) pois.push({ x: x - dx, y: 0 });
            else if (prev * v < 0) { const rt = bisect(f, x - dx, x); if (rt != null) pois.push({ x: rt, y: 0 }); }
            const d = v - prev;
            if (prevD != null && prevD * d < 0 && Math.abs(d) < view.scale * 50) {
              // refine extremum by golden-section search
              let a = x - 2 * dx, b = x, isMax = prevD > 0;
              for (let k = 0; k < 50; k++) { const m1 = a + (b - a) * 0.382, m2 = a + (b - a) * 0.618; if ((f(m1) < f(m2)) === isMax) a = m1; else b = m2; }
              const xm = (a + b) / 2, ym = f(xm);
              if (isFinite(ym)) pois.push({ x: xm, y: ym });
            }
            prevD = d;
          } else prevD = null;
          prev = v;
        }
      });
      for (let i = 0; i < cs.length; i++) for (let j = i + 1; j < cs.length; j++) {
        const f = (x) => evalAt(cs[i], x) - evalAt(cs[j], x);
        let prev = f(x0);
        for (let k = 1; k <= N; k++) {
          const x = x0 + dx * k, v = f(x);
          if (isFinite(prev) && isFinite(v) && prev * v <= 0 && !(prev === 0 && v === 0)) { const rt = prev === 0 ? x - dx : bisect(f, x - dx, x); if (rt != null) pois.push({ x: rt, y: evalAt(cs[i], rt), label: 'intersection' }); }
          prev = v;
        }
      }
    }

    /* ----------------------------------------------------- interaction */
    let drag = null, pinch = null;
    const pos = (e) => { const r = canvas.getBoundingClientRect(); const p = e.touches ? e.touches[0] : e; return [p.clientX - r.left, p.clientY - r.top]; };
    function showTip(px, py) {
      let best = null, bd = 12;
      pois.forEach((p) => { const d = Math.hypot(X(p.x) - px, Y(p.y) - py); if (d < bd) { bd = d; best = p; } });
      if (!best) {
        curves().forEach((r) => { const y = evalAt(r, ix(px)); if (isFinite(y) && Math.abs(Y(y) - py) < 14) best = { x: ix(px), y, color: r.e.color, trace: true }; });
      }
      hoverPt = best;
      if (best) {
        tip.textContent = '(' + fmtNum(+best.x.toPrecision(best.trace ? 5 : 10)) + ', ' + fmtNum(+best.y.toPrecision(best.trace ? 5 : 10)) + ')' + (best.label ? '  ' + best.label : '');
        tip.style.left = U.clamp(X(best.x) + 10, 4, W - 160) + 'px'; tip.style.top = U.clamp(Y(best.y) - 30, 4, H - 30) + 'px';
        tip.classList.remove('hidden');
      } else tip.classList.add('hidden');
      draw();
    }
    canvas.addEventListener('mousedown', (e) => { drag = { p: pos(e), cx: view.cx, cy: view.cy, moved: false }; });
    canvas.addEventListener('mousemove', (e) => {
      const p = pos(e);
      if (drag) {
        const dx = p[0] - drag.p[0], dy = p[1] - drag.p[1];
        if (Math.abs(dx) + Math.abs(dy) > 3) drag.moved = true;
        view.cx = drag.cx - dx / view.scale; view.cy = drag.cy + dy / view.scale; draw();
      } else showTip(p[0], p[1]);
    });
    window.addEventListener('mouseup', () => { drag = null; });
    canvas.addEventListener('mouseleave', () => { hoverPt = null; tip.classList.add('hidden'); draw(); });
    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const [px, py] = pos(e), wx = ix(px), wy = iy(py), k = Math.exp(-e.deltaY * 0.0015);
      view.scale = U.clamp(view.scale * k, 0.5, 5000);
      view.cx = wx - (px - W / 2) / view.scale; view.cy = wy + (py - H / 2) / view.scale; draw();
    }, { passive: false });
    canvas.addEventListener('touchstart', (e) => {
      if (e.touches.length === 2) { const [a, b] = e.touches; pinch = { d: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY), s: view.scale }; drag = null; }
      else { drag = { p: pos(e), cx: view.cx, cy: view.cy, moved: false }; }
    }, { passive: true });
    canvas.addEventListener('touchmove', (e) => {
      if (pinch && e.touches.length === 2) { const [a, b] = e.touches; view.scale = U.clamp(pinch.s * Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY) / pinch.d, 0.5, 5000); draw(); e.preventDefault(); return; }
      if (drag) { const p = pos(e), dx = p[0] - drag.p[0], dy = p[1] - drag.p[1]; if (Math.abs(dx) + Math.abs(dy) > 4) drag.moved = true; view.cx = drag.cx - dx / view.scale; view.cy = drag.cy + dy / view.scale; draw(); e.preventDefault(); }
    }, { passive: false });
    canvas.addEventListener('touchend', (e) => {
      if (drag && !drag.moved) { showTip(drag.p[0], drag.p[1]); }
      drag = null; if (e.touches.length < 2) pinch = null;
    });
    zoomIn.addEventListener('click', () => { view.scale = Math.min(5000, view.scale * 1.5); draw(); });
    zoomOut.addEventListener('click', () => { view.scale = Math.max(0.5, view.scale / 1.5); draw(); });
    home.addEventListener('click', () => { view.cx = 0; view.cy = 0; view.scale = 32; draw(); });
    degBtn.addEventListener('click', () => { deg = !deg; degBtn.textContent = deg ? 'DEG' : 'RAD'; SAT.store.set('calc.deg', deg); refresh(true); });
    addBtn.addEventListener('click', () => { exprs.push({ text: '', color: COLORS[exprs.length % COLORS.length] }); refresh(true); U.$$('.gc-input', listEl).pop().focus(); });
    clearBtn.addEventListener('click', () => { exprs = [{ text: '', color: COLORS[0] }]; refresh(true); });

    const ro = window.ResizeObserver ? new ResizeObserver(() => resize()) : null;
    if (ro) ro.observe(plot); else window.addEventListener('resize', resize);
    refresh(true);
    setTimeout(resize, 30);
    api.addExpression = (t) => { if (exprs.length === 1 && !exprs[0].text) exprs[0].text = t; else exprs.push({ text: t, color: COLORS[exprs.length % COLORS.length] }); refresh(true); };
    return () => { if (ro) ro.disconnect(); };
  }

  /* ========================================================= scientific */
  function buildScientific(body) {
    let deg = !!SAT.store.get('sci.deg', true), ans = 0;
    const hist = SAT.store.get('sci.hist', []) || [];
    const input = h('input.sci-input', { type: 'text', placeholder: '0', spellcheck: 'false', autocomplete: 'off', 'aria-label': 'Calculator input' });
    const result = h('div.sci-result', '0');
    const histEl = h('div.sci-hist');
    const modeBtn = h('button.chip-btn', { text: deg ? 'DEG' : 'RAD' });
    const keys = [
      ['sin(', 'cos(', 'tan(', 'π', 'e'], ['asin(', 'acos(', 'atan(', '√(', '^'], ['x²', 'ln(', 'log(', '(', ')'],
      ['7', '8', '9', '÷', '⌫'], ['4', '5', '6', '×', 'AC'], ['1', '2', '3', '−', '→ a/b'], ['0', '.', 'ans', '+', '='],
    ];
    const pad = h('div.sci-pad');
    keys.forEach((row) => row.forEach((k) => {
      const b = h('button.sci-key' + (/^[0-9.]$/.test(k) ? '.num' : k === '=' ? '.eq' : ''), { type: 'button', text: k });
      b.addEventListener('click', () => press(k));
      pad.appendChild(b);
    }));
    body.appendChild(h('div.sci', h('div.sci-top', modeBtn, h('span.spacer'), h('span.muted.small', 'Enter to evaluate')), h('div.sci-display', input, result), pad, histEl));
    const insert = (t) => { const s = input.selectionStart ?? input.value.length, e = input.selectionEnd ?? input.value.length; input.value = input.value.slice(0, s) + t + input.value.slice(e); input.focus(); input.setSelectionRange(s + t.length, s + t.length); live(); };
    function evaluate(src) {
      const ast = parse(src);
      if (ast.k === 'rel') throw new Error('Use the graphing calculator for equations');
      return compile(ast)({ vars: { ans }, funcs: {}, deg });
    }
    function live() { try { const v = evaluate(input.value); result.textContent = '= ' + fmtNum(v); result.classList.remove('err'); } catch (e) { result.textContent = input.value ? '…' : '0'; } }
    function commit() {
      if (!input.value.trim()) return;
      try {
        const v = evaluate(input.value); ans = v;
        hist.unshift({ e: input.value, v: fmtNum(v) }); hist.splice(20);
        SAT.store.set('sci.hist', hist); renderHist();
        result.textContent = '= ' + fmtNum(v); input.value = fmtNum(v); result.classList.remove('err');
      } catch (e) { result.textContent = e.message; result.classList.add('err'); }
    }
    function press(k) {
      if (k === '=') return commit();
      if (k === 'AC') { input.value = ''; result.textContent = '0'; return input.focus(); }
      if (k === '⌫') { const s = input.selectionStart || input.value.length; input.value = input.value.slice(0, s - 1) + input.value.slice(s); input.focus(); input.setSelectionRange(s - 1, s - 1); return live(); }
      if (k === '→ a/b') { try { const v = evaluate(input.value || String(ans)); const fr = toFraction(v); result.textContent = fr ? '= ' + fr : 'No simple fraction'; } catch (e) { result.textContent = e.message; } return; }
      const map = { 'x²': '^2', '÷': '/', '×': '*', '−': '-', '√(': 'sqrt(', 'π': 'π' };
      insert(map[k] || k);
    }
    function renderHist() {
      histEl.innerHTML = hist.length ? '' : '<p class="muted small">History appears here.</p>';
      hist.forEach((x) => { const b = h('button.sci-h', h('span', x.e), h('b', '= ' + x.v)); b.addEventListener('click', () => insert(x.v)); histEl.appendChild(b); });
    }
    input.addEventListener('input', live);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); commit(); } });
    modeBtn.addEventListener('click', () => { deg = !deg; modeBtn.textContent = deg ? 'DEG' : 'RAD'; SAT.store.set('sci.deg', deg); live(); });
    renderHist();
    setTimeout(() => input.focus(), 50);
  }

  /* ============================================================ window */
  SAT.tools.calc = {
    title: 'Calculator', icon: 'calc', w: 760, h: 520,
    build(body, api) {
      let mode = SAT.store.get('calc.mode', 'graph'), cleanup = null;
      const tabG = h('button.tab' + (mode === 'graph' ? '.on' : ''), { html: U.icon('graph') + ' Graphing' });
      const tabS = h('button.tab' + (mode === 'sci' ? '.on' : ''), { html: U.icon('calc') + ' Scientific' });
      const host = h('div.calc-host');
      body.appendChild(h('div.tabs', tabG, tabS));
      body.appendChild(host);
      function show(m) {
        mode = m; SAT.store.set('calc.mode', m);
        tabG.classList.toggle('on', m === 'graph'); tabS.classList.toggle('on', m === 'sci');
        if (cleanup) cleanup(); host.innerHTML = ''; cleanup = null;
        if (m === 'graph') cleanup = buildGraph(host, api); else buildScientific(host);
      }
      tabG.addEventListener('click', () => show('graph'));
      tabS.addEventListener('click', () => show('sci'));
      api.onClose = () => { if (cleanup) cleanup(); };
      api.onArg = (t) => { if (mode !== 'graph') show('graph'); if (api.addExpression) api.addExpression(t); };
      show(mode);
    },
  };
})();
