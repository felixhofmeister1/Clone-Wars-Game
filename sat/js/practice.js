/* Practice sessions: pick skills and difficulty, answer with instant
   feedback (or at the end), adaptive difficulty, optional timing, and a
   summary with full explanations. */
(function () {
  'use strict';
  const SAT = window.SAT, U = SAT.util, h = U.h, G = SAT.mathgen;
  const KEY = 'practice.session';
  const PACE = { rw: 71, math: 95 }; // seconds per question on the real test
  let P = null, qctl = null, clock = null, root = null;

  const seen = () => new Set(SAT.store.get('seen', []));
  function markSeen(id) { const s = SAT.store.get('seen', []); if (!s.includes(id)) { s.push(id); SAT.store.set('seen', s.slice(-2000)); } }

  function pickQuestion(skill, diff, used) {
    const sk = SAT.skills.byId[skill];
    if (sk.section === 'math') {
      const fmt = U.random.bool(0.3) ? 'spr' : 'mc';
      return G.random(skill, diff, fmt);
    }
    let pool = SAT.bank.rwPool(skill, diff).filter((q) => !used.has(q.id));
    if (!pool.length) pool = SAT.bank.rwPool(skill, 'X').filter((q) => !used.has(q.id));
    if (!pool.length) return null;
    const s = seen(), fresh = pool.filter((q) => !s.has(q.id));
    return U.random.pick(fresh.length ? fresh : pool);
  }

  /* cfg: { title, skills[], diff: E|M|H|X|A, count, timed, feedback: 'instant'|'end', list?: [question refs] } */
  function start(cfg) {
    P = { cfg, items: [], i: 0, level: cfg.diff === 'A' ? 'M' : null, started: Date.now(), done: false };
    if (cfg.list) P.items = cfg.list.map((ref) => ({ q: ref, ans: null, checked: false, time: 0 }));
    SAT.store.set(KEY, P);
    SAT.router.go('/practice/run');
  }
  function current() { return P.items[P.i]; }
  function ensureItem() {
    if (P.items[P.i] || P.cfg.list) return !!P.items[P.i];
    const used = new Set(P.items.map((x) => SAT.resolveQ(x.q).id));
    const skills = P.cfg.skills;
    for (let t = 0; t < 12; t++) {
      const skill = skills[(P.i + t) % skills.length];
      const shuffled = skills.length > 1 ? U.random.pick(skills) : skill;
      const d = P.cfg.diff === 'A' ? P.level : P.cfg.diff === 'X' ? U.random.pick(['E', 'M', 'H']) : P.cfg.diff;
      const q = pickQuestion(t === 0 ? shuffled : skill, d, used);
      if (q) { P.items.push({ q: SAT.refQ(q), ans: null, checked: false, time: 0 }); return true; }
    }
    return false;
  }

  function mount(container) {
    P = P || SAT.store.get(KEY, null);
    if (!P) { SAT.router.go('/practice', true); return; }
    root = container;
    if (P.done) return renderSummary();
    if (!ensureItem()) { U.toast('No more questions are available for this selection.'); return finish(); }
    render();
    clearInterval(clock);
    clock = setInterval(tick, 1000);
    SAT.router.cleanup = () => { clearInterval(clock); SAT.store.set(KEY, P); SAT.win.closeAll(); };
  }

  function tick() {
    if (!P || P.done || document.hidden) return;
    const it = current();
    if (it && !it.checked) it.time = (it.time || 0) + 1;
    const el = U.$('#pr-clock');
    if (!el) return;
    if (P.cfg.timed) {
      const budget = P.cfg.count * paceOf(), used = P.items.reduce((a, x) => a + (x.time || 0), 0), left = Math.max(0, budget - used);
      el.textContent = U.fmtTime(left);
      el.parentElement.classList.toggle('low', left < 60);
      if (left <= 0) { U.toast('Time’s up!', 'warn'); finish(); }
    } else el.textContent = U.fmtTime(it ? it.time : 0);
  }
  const paceOf = () => { const secs = P.cfg.skills.map((s) => PACE[SAT.skills.byId[s].section]); return Math.round(secs.reduce((a, b) => a + b, 0) / secs.length); };

  function render() {
    const it = current(), q = SAT.resolveQ(it.q), total = P.cfg.list ? P.items.length : P.cfg.count;
    root.innerHTML = '';
    const isMath = q.section === 'math';
    const endBtn = h('button.btn.btn-ghost.btn-sm', { html: U.icon('x') + ' End' });
    endBtn.addEventListener('click', () => U.confirm('End this practice set?', 'You’ll see a summary of the questions you’ve answered.', 'End set').then((ok) => ok && finish()));
    const tool = (ic, label, id) => { const b = h('button.rn-tool', { type: 'button', html: U.icon(ic) + '<span>' + label + '</span>' }); b.addEventListener('click', () => SAT.toggleTool(id)); return b; };
    const sk = SAT.skills.byId[q.skill];
    const top = h('header.pr-top',
      h('div.pr-title', h('b', P.cfg.title || sk.name), h('span.muted.small', sk.name + ' · ' + SAT.skills.diffs[q.diff])),
      h('div.pr-progress', h('span', (P.i + 1) + ' / ' + total), U.frag(U.bar(((P.i) / total) * 100))),
      h('div.rn-timer', h('span', { html: U.icon('clock') }), h('span#pr-clock', '0:00')),
      h('div.rn-tools', isMath ? tool('calc', 'Calculator', 'calc') : null, isMath ? tool('doc', 'Reference', 'ref') : null, tool('dict', 'Dictionary', 'dict'), tool('pen', 'Scratch', 'pad')),
      endBtn);
    const main = h('main.pr-main');
    const qhost = h('div.pr-q');
    main.appendChild(qhost);
    const check = h('button.btn.btn-primary', { text: P.cfg.feedback === 'end' ? (P.i + 1 >= total ? 'Finish' : 'Next') : 'Check answer' });
    const skip = h('button.btn.btn-ghost', { text: 'Skip' });
    const prev = h('button.btn', { text: 'Back' });
    prev.disabled = P.i === 0;
    const bottom = h('footer.pr-bottom', prev, h('span.spacer'), it.checked || P.cfg.feedback === 'end' ? null : skip, check);
    root.appendChild(h('div.practice', { style: { '--q-scale': SAT.settings.get('zoom') || 1 } }, top, main, bottom));

    qctl = SAT.qview.render(qhost, q, {
      number: P.i + 1, mode: 'practice', eliminator: !!P.elimOn, reveal: it.checked, locked: it.checked,
      state: { answer: it.ans, elim: it.elim || [], flag: it.flag, hl: it.hl },
      onEliminator: (on) => { P.elimOn = on; },
      onChange: (st) => { it.ans = st.answer; it.elim = st.elim; it.flag = st.flag; it.hl = st.hl; },
    });
    if (it.checked) { check.textContent = P.i + 1 >= total ? 'See summary' : 'Next question'; }

    check.addEventListener('click', () => {
      if (P.cfg.feedback !== 'end' && !it.checked) {
        if (it.ans == null || it.ans === '') { U.toast('Choose or enter an answer first (or select Skip).'); return; }
        grade(it); qctl.reveal();
        check.textContent = P.i + 1 >= total ? 'See summary' : 'Next question';
        skip.remove();
        const ok = SAT.tests.isCorrect(q, it.ans);
        if (ok && SAT.settings.get('confetti') !== false) celebrate();
        return;
      }
      next();
    });
    skip.addEventListener('click', () => {
      it.ans = null; qctl.state.answer = null; grade(it); qctl.reveal();
      check.textContent = P.i + 1 >= total ? 'See summary' : 'Next question'; skip.remove();
    });
    prev.addEventListener('click', () => { P.i--; SAT.store.set(KEY, P); render(); });
    tick();
  }

  function grade(it, silent) {
    it.checked = !silent;
    const q = SAT.resolveQ(it.q), ok = SAT.tests.isCorrect(q, it.ans);
    it.correct = ok;
    if (!it.recorded) { SAT.stats.record(q, ok, it.time); markSeen(q.id); it.recorded = true; }
    if (P.cfg.diff === 'A') P.level = ok ? (P.level === 'E' ? 'M' : 'H') : (P.level === 'H' ? 'M' : 'E');
    SAT.store.set(KEY, P);
  }
  function next() {
    const total = P.cfg.list ? P.items.length : P.cfg.count;
    if (P.i + 1 >= total) return finish();
    P.i++;
    if (!ensureItem()) { U.toast('No more questions are available for this selection.'); return finish(); }
    SAT.store.set(KEY, P);
    render();
    root.scrollTop = 0; window.scrollTo(0, 0);
  }
  function finish() {
    clearInterval(clock);
    P.items.forEach((it) => { if (!it.recorded && it.ans != null && it.ans !== '') grade(it, true); });
    P.done = true;
    const log = SAT.store.get('practiceLog', []);
    const answered = P.items.filter((x) => x.recorded);
    log.unshift({ date: Date.now(), title: P.cfg.title, n: answered.length, c: answered.filter((x) => x.correct).length });
    SAT.store.set('practiceLog', log.slice(0, 100));
    SAT.store.set(KEY, P);
    renderSummary();
  }

  function renderSummary() {
    clearInterval(clock);
    const items = P.items.filter((x) => x.recorded);
    const c = items.filter((x) => x.correct).length, n = items.length;
    const time = items.reduce((a, x) => a + (x.time || 0), 0);
    root.innerHTML = '';
    const bySkill = {};
    items.forEach((it) => { const q = SAT.resolveQ(it.q); const b = (bySkill[q.skill] = bySkill[q.skill] || { a: 0, c: 0 }); b.a++; if (it.correct) b.c++; });
    const list = h('div.sum-list');
    P.items.forEach((it, i) => {
      const q = SAT.resolveQ(it.q);
      const row = h('button.sum-row' + (it.correct ? '.ok' : it.recorded ? '.bad' : '.skip'), { type: 'button' },
        h('span.sum-ic', { html: U.icon(it.correct ? 'check' : it.recorded ? 'x' : 'minus') }),
        h('span.sum-n', 'Q' + (i + 1)), h('span.sum-sk', SAT.skills.byId[q.skill].name), h('span.pill.diff-' + q.diff, SAT.skills.diffs[q.diff]), h('span.muted.small', U.fmtTime(it.time || 0)));
      row.addEventListener('click', () => reviewItem(i));
      list.appendChild(row);
    });
    const again = h('button.btn.btn-primary', { html: U.icon('refresh') + ' New set, same settings' });
    again.addEventListener('click', () => { const cfg = Object.assign({}, P.cfg); delete cfg.list; P = null; start(cfg); });
    const wrongs = P.items.filter((x) => x.recorded && !x.correct);
    const retry = h('button.btn', { html: U.icon('undo') + ' Retry missed questions (' + wrongs.length + ')' });
    retry.disabled = !wrongs.length;
    retry.addEventListener('click', () => { const list2 = wrongs.map((x) => x.q); P = null; start({ title: 'Retry missed questions', skills: [], list: list2, count: list2.length, feedback: 'instant' }); });
    const back = h('a.btn.btn-ghost', { href: '#/practice', text: 'Back to practice' });
    root.appendChild(h('div.page.summary',
      h('div.card.sum-hero',
        h('div', { html: U.ring(c, n || 1, '<b>' + U.pct(c, n) + '%</b><small>' + c + ' of ' + n + '</small>', 132) }),
        h('div.sum-stats', h('h1', P.cfg.title || 'Practice summary'),
          h('p', U.plural(n, 'question') + ' answered · ' + U.fmtTime(time) + ' total · ' + (n ? U.fmtTime(time / n) : '0:00') + ' per question'),
          h('div.sum-skills', ...Object.keys(bySkill).map((k) => h('div.sum-skill', h('span', SAT.skills.byId[k].name), U.frag(U.bar(U.pct(bySkill[k].c, bySkill[k].a))), h('b', bySkill[k].c + '/' + bySkill[k].a)))),
          h('div.btn-row', again, retry, back))),
      h('h2', 'Review questions'), list));
  }

  function reviewItem(i) {
    const it = P.items[i], q = SAT.resolveQ(it.q);
    const host = h('div.review-q');
    const close = h('button.btn', { html: U.icon('chevL') + ' Back to summary' });
    const prevB = h('button.btn', { text: 'Previous' }), nextB = h('button.btn', { text: 'Next' });
    prevB.disabled = i === 0; nextB.disabled = i === P.items.length - 1;
    root.innerHTML = '';
    root.appendChild(h('div.page.review-page', h('div.btn-row', close, h('span.spacer'), prevB, nextB), host));
    SAT.qview.render(host, q, { number: i + 1, mode: 'review', reveal: true, state: { answer: it.ans, hl: it.hl } });
    close.addEventListener('click', renderSummary);
    prevB.addEventListener('click', () => reviewItem(i - 1));
    nextB.addEventListener('click', () => reviewItem(i + 1));
    window.scrollTo(0, 0);
  }

  function celebrate() {
    const box = h('div.burst', { 'aria-hidden': 'true' });
    for (let i = 0; i < 18; i++) box.appendChild(h('i', { style: { '--a': (i * 20) + 'deg', '--d': (40 + Math.random() * 50) + 'px', '--c': 'var(--c' + ((i % 6) + 1) + ')' } }));
    const btn = U.$('.pr-bottom .btn-primary');
    if (btn) { const r = btn.getBoundingClientRect(); box.style.left = r.left + r.width / 2 + 'px'; box.style.top = r.top + 'px'; }
    document.body.appendChild(box);
    setTimeout(() => box.remove(), 900);
  }

  SAT.practice = {
    start, mount,
    hasSession: () => { const s = SAT.store.get(KEY, null); return s && !s.done ? s : null; },
    discard: () => { SAT.store.del(KEY); P = null; },
    reset: () => { P = null; },
  };
})();
