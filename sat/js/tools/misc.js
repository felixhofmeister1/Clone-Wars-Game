/* Smaller tools: study timer (countdown, stopwatch, Pomodoro), score
   estimator, and the line reader accessibility tool. */
(function () {
  'use strict';
  const SAT = window.SAT, U = SAT.util, h = U.h;

  function beep() {
    try {
      const A = window.AudioContext || window.webkitAudioContext, ctx = new A();
      [0, 0.25, 0.5].forEach((t) => {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.frequency.value = 880; o.connect(g); g.connect(ctx.destination);
        g.gain.setValueAtTime(0.0001, ctx.currentTime + t); g.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + t + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + t + 0.2);
        o.start(ctx.currentTime + t); o.stop(ctx.currentTime + t + 0.22);
      });
    } catch (e) { /* audio unavailable */ }
  }

  /* ---------------------------------------------------------------- timer */
  SAT.tools.timer = {
    title: 'Study Timer', icon: 'timer', w: 340, h: 420,
    build(body, api) {
      let mode = 'down', total = 25 * 60, left = total, elapsed = 0, running = false, tick = null, last = 0;
      const disp = h('div.timer-disp', U.fmtTime(left));
      const label = h('div.muted.center.small', 'Focus');
      const start = h('button.btn.btn-primary', { html: U.icon('play') + ' Start' });
      const reset = h('button.btn', { html: U.icon('refresh') + ' Reset' });
      const presets = [['Pomodoro 25', 25, 'Focus'], ['Break 5', 5, 'Break'], ['R&W module 32', 32, 'Reading and Writing module'], ['Math module 35', 35, 'Math module'], ['10-min break', 10, 'Test break']];
      const pre = h('div.timer-presets');
      presets.forEach(([t, m, l]) => { const b = h('button.chip-btn', { text: t }); b.addEventListener('click', () => { stop(); mode = 'down'; total = left = m * 60; label.textContent = l; paint(); }); pre.appendChild(b); });
      const sw = h('button.chip-btn', { text: 'Stopwatch' });
      sw.addEventListener('click', () => { stop(); mode = 'up'; elapsed = 0; label.textContent = 'Stopwatch'; paint(); });
      pre.appendChild(sw);
      const custom = h('input.input.input-sm', { type: 'number', min: 1, max: 180, placeholder: 'Custom minutes', 'aria-label': 'Custom minutes' });
      custom.addEventListener('change', () => { const m = +custom.value; if (m > 0) { stop(); mode = 'down'; total = left = m * 60; label.textContent = m + '-minute timer'; paint(); } });
      body.appendChild(h('div.timer', label, disp, h('div.timer-actions', start, reset), pre, custom));
      function paint() {
        disp.textContent = U.fmtTime(mode === 'down' ? left : elapsed);
        disp.classList.toggle('low', mode === 'down' && left <= 60 && left > 0);
        start.innerHTML = running ? U.icon('pause') + ' Pause' : U.icon('play') + ' Start';
      }
      function loop() {
        const now = Date.now(), dt = (now - last) / 1000; last = now;
        if (mode === 'down') { left = Math.max(0, left - dt); if (left <= 0) { stop(); beep(); U.toast('⏰ ' + label.textContent + ' timer finished'); } }
        else elapsed += dt;
        paint();
      }
      function stop() { running = false; clearInterval(tick); paint(); }
      start.addEventListener('click', () => { if (running) return stop(); if (mode === 'down' && left <= 0) left = total; running = true; last = Date.now(); tick = setInterval(loop, 250); paint(); });
      reset.addEventListener('click', () => { stop(); left = total; elapsed = 0; paint(); });
      api.onClose = () => clearInterval(tick);
      paint();
    },
  };

  /* ------------------------------------------------------ score estimator */
  SAT.tools.score = {
    title: 'Score Estimator', icon: 'trophy', w: 380, h: 520,
    build(body) {
      const mk = (label, max) => { const i = h('input.input.input-sm', { type: 'number', min: 0, max, value: Math.round(max * 0.7), 'aria-label': label }); return [i, h('label.score-row', h('span', label), i, h('span.muted.small', '/ ' + max))]; };
      const [rw1, r1] = mk('R&W Module 1 correct', 27), [rw2, r2] = mk('R&W Module 2 correct', 27), [m1, r3] = mk('Math Module 1 correct', 22), [m2, r4] = mk('Math Module 2 correct', 22);
      const out = h('div.score-out');
      body.appendChild(h('div.score-est', h('p.muted.small', 'Enter how many questions you answered correctly in each module. Module 2 difficulty is set by your Module 1 result, just like the real adaptive test.'), r1, r2, r3, r4, out));
      function calc() {
        const v = (i, max) => U.clamp(+i.value || 0, 0, max);
        const a = v(rw1, 27), b = v(rw2, 27), c = v(m1, 22), d = v(m2, 22);
        const rwHard = SAT.tests.route(a, 27) === 'hard', mHard = SAT.tests.route(c, 22) === 'hard';
        const rw = SAT.tests.sectionScore(a + b, 54, rwHard), math = SAT.tests.sectionScore(c + d, 44, mHard);
        out.innerHTML = '<div class="score-total"><span>' + (rw + math) + '</span><small>Estimated total</small></div>' +
          '<div class="score-split"><div><b>' + rw + '</b><small>Reading &amp; Writing</small><em>' + (rwHard ? 'Harder' : 'Easier') + ' Module 2</em></div><div><b>' + math + '</b><small>Math</small><em>' + (mHard ? 'Harder' : 'Easier') + ' Module 2</em></div></div>' +
          '<p class="muted small">Estimates only. The real SAT uses item response theory, so exact scores depend on which questions you miss.</p>';
      }
      [rw1, rw2, m1, m2].forEach((i) => i.addEventListener('input', calc));
      calc();
    },
  };

  /* ---------------------------------------------------------- line reader */
  let reader = null;
  SAT.lineReader = {
    toggle() {
      if (reader) { reader.el.remove(); window.removeEventListener('mousemove', reader.move); window.removeEventListener('keydown', reader.key); window.removeEventListener('touchmove', reader.move); reader = null; return false; }
      const band = h('div.line-band');
      const el = h('div.line-reader', { 'aria-hidden': 'true' }, band);
      let y = window.innerHeight / 2, bh = 64;
      const place = () => { band.style.top = (y - bh / 2) + 'px'; band.style.height = bh + 'px'; };
      const move = (e) => { const p = e.touches ? e.touches[0] : e; y = p.clientY; place(); };
      const key = (e) => {
        if (!e.altKey) return;
        if (e.key === 'ArrowDown') { y += 24; place(); e.preventDefault(); }
        if (e.key === 'ArrowUp') { y -= 24; place(); e.preventDefault(); }
        if (e.key === '=' || e.key === '+') { bh = Math.min(200, bh + 16); place(); }
        if (e.key === '-') { bh = Math.max(28, bh - 16); place(); }
      };
      window.addEventListener('mousemove', move); window.addEventListener('touchmove', move, { passive: true }); window.addEventListener('keydown', key);
      document.body.appendChild(el); place();
      reader = { el, move, key };
      U.toast('Line reader on. Move the pointer to position it; Alt+↑/↓ moves it and Alt+/− resizes it.');
      return true;
    },
    isOn: () => !!reader,
    off() { if (reader) SAT.lineReader.toggle(); },
  };
})();
