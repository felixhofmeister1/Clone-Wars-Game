/* Test runner: delivers an exam module by module like the Digital SAT app.
   Timed modules, adaptive Module 2 routing, question navigator, Check Your
   Work page, 10-minute break, tools, save & resume, and final scoring. */
(function () {
  'use strict';
  const SAT = window.SAT, U = SAT.util, h = U.h;
  const KEY = 'run';
  let S = null, timer = null, qctl = null, root = null, lastSave = 0;

  const secName = (s) => (s === 'rw' ? 'Reading and Writing' : 'Math');
  const mod = () => S.exam.modules[S.mi];
  const mstate = () => S.mods[S.mi];
  const qAt = (i) => SAT.resolveQ(mstate().qs[i]);
  const save = () => { SAT.store.set(KEY, S); lastSave = Date.now(); };

  function sectionNumber(m) { return S.exam.sections.indexOf(m.section) + 1; }

  function buildModule(i) {
    const m = S.exam.modules[i];
    if (S.mods[i]) return;
    let level = m.level;
    if (!level) {
      const prevIdx = S.exam.modules.findIndex((x) => x.section === m.section && x.num === 1);
      const prev = S.mods[prevIdx];
      const qs = prev.qs.map(SAT.resolveQ);
      const correct = qs.filter((q, k) => SAT.tests.isCorrect(q, prev.ans[k])).length;
      level = SAT.tests.route(correct, qs.length);
    }
    const qs = SAT.tests.questionsFor(S.exam, { section: m.section, level });
    S.mods[i] = { level, qs: qs.map(SAT.refQ), ans: qs.map(() => null), flags: qs.map(() => false), elim: qs.map(() => []), hl: qs.map(() => null), timeLeft: m.time, visited: [0] };
  }

  /* ------------------------------------------------------------ public */
  function start(exam) {
    S = { exam, mi: 0, qi: 0, phase: 'q', mods: [], hideTimer: false, started: Date.now(), breakLeft: SAT.tests.BREAK_TIME };
    buildModule(0);
    save();
    SAT.router.go('/test/run');
  }
  function saved() { return SAT.store.get(KEY, null); }
  function discard() { SAT.store.del(KEY); S = null; }

  function mount(container) {
    S = saved();
    if (!S) { SAT.router.go('/tests', true); return; }
    root = container;
    root.innerHTML = '';
    render();
    clearInterval(timer);
    timer = setInterval(tick, 1000);
    document.addEventListener('keydown', onKey);
    SAT.router.cleanup = unmount;
  }
  function unmount() {
    clearInterval(timer);
    document.removeEventListener('keydown', onKey);
    if (S) save();
    SAT.lineReader.off();
    SAT.win.closeAll();
    U.closePopover();
  }

  /* ------------------------------------------------------------ timing */
  function tick() {
    if (!S || document.hidden) return;
    if (S.phase === 'break') {
      S.breakLeft = Math.max(0, S.breakLeft - 1);
      const el = U.$('#break-clock'); if (el) el.textContent = U.fmtTime(S.breakLeft);
      if (S.breakLeft <= 0) resumeFromBreak();
    } else if (S.phase === 'q' || S.phase === 'review') {
      const m = mstate();
      m.timeLeft = Math.max(0, m.timeLeft - 1);
      const el = U.$('#rn-clock');
      if (el) { el.textContent = U.fmtTime(m.timeLeft); el.parentElement.classList.toggle('low', m.timeLeft <= 300); }
      if (m.timeLeft === 300) { U.toast('5 minutes remaining in this module.', 'warn', 4000); if (S.hideTimer) { S.hideTimer = false; renderTop(); } }
      if (m.timeLeft <= 0) { U.toast('Time’s up for this module.', 'warn'); finishModule(); return; }
    }
    if (Date.now() - lastSave > 5000) save();
  }

  /* ------------------------------------------------------------ render */
  let topEl, mainEl, botEl;
  function render() {
    root.innerHTML = '';
    const z = SAT.settings.get('zoom') || 1;
    const wrap = h('div.runner', { style: { '--q-scale': z } });
    topEl = h('header.rn-top'); mainEl = h('main.rn-main'); botEl = h('footer.rn-bottom');
    wrap.appendChild(topEl); wrap.appendChild(h('div.rn-dash', { 'aria-hidden': 'true' })); wrap.appendChild(mainEl); wrap.appendChild(botEl);
    root.appendChild(wrap);
    if (S.phase === 'break') return renderBreak();
    renderTop();
    if (S.phase === 'review') renderReview(); else renderQuestion();
    renderBottom();
  }

  function renderTop() {
    const m = mod(), ms = mstate();
    topEl.innerHTML = '';
    const dirBtn = h('button.link-btn', { html: 'Directions ' + U.icon('chevD') });
    dirBtn.addEventListener('click', () => showDirections(dirBtn));
    const left = h('div.rn-left', h('div.rn-title', 'Section ' + sectionNumber(m) + ', Module ' + m.num + ': ' + secName(m.section)), dirBtn);
    const clock = h('span#rn-clock', U.fmtTime(ms.timeLeft));
    const hide = h('button.chip-btn', { text: S.hideTimer ? 'Show' : 'Hide' });
    hide.addEventListener('click', () => { S.hideTimer = !S.hideTimer; renderTop(); });
    const timerBox = h('div.rn-timer' + (S.hideTimer ? '.hidden-time' : '') + (ms.timeLeft <= 300 ? '.low' : ''), S.hideTimer ? h('span', { html: U.icon('clock') }) : clock, hide);
    const tools = h('div.rn-tools');
    const tbtn = (ic, label, fn, id) => { const b = h('button.rn-tool' + (id && SAT.win.isOpen(id) ? '.on' : ''), { type: 'button', html: U.icon(ic) + '<span>' + label + '</span>' }); b.addEventListener('click', () => { fn(b); setTimeout(() => b.classList.toggle('on', !!(id && SAT.win.isOpen(id))), 0); }); return b; };
    if (m.section === 'rw') tools.appendChild(tbtn('marker', 'Highlights & Notes', (b) => showNotes(b)));
    if (m.section === 'math') {
      tools.appendChild(tbtn('calc', 'Calculator', () => SAT.toggleTool('calc'), 'calc'));
      tools.appendChild(tbtn('doc', 'Reference', () => SAT.toggleTool('ref'), 'ref'));
    }
    if (SAT.settings.get('testDict') !== false) tools.appendChild(tbtn('dict', 'Dictionary', () => SAT.toggleTool('dict'), 'dict'));
    tools.appendChild(tbtn('pen', 'Scratch', () => SAT.toggleTool('pad'), 'pad'));
    tools.appendChild(tbtn('more', 'More', (b) => showMore(b)));
    topEl.appendChild(left); topEl.appendChild(timerBox); topEl.appendChild(tools);
  }

  function renderQuestion() {
    const ms = mstate(), i = S.qi, q = qAt(i);
    mainEl.innerHTML = '';
    const host = h('div.rn-q');
    mainEl.appendChild(host);
    qctl = SAT.qview.render(host, q, {
      number: i + 1, mode: 'test', eliminator: !!S.elimOn,
      state: { answer: ms.ans[i], flag: ms.flags[i], elim: ms.elim[i], hl: ms.hl[i] },
      onEliminator: (on) => { S.elimOn = on; },
      onChange: (st) => {
        ms.ans[i] = st.answer; ms.flags[i] = st.flag; ms.elim[i] = st.elim; ms.hl[i] = st.hl;
        updateNavLabel();
      },
    });
    if (!ms.visited.includes(i)) ms.visited.push(i);
  }

  function renderBottom() {
    const ms = mstate();
    botEl.innerHTML = '';
    const name = h('div.rn-name', SAT.settings.get('name') || 'Student');
    const nav = h('button.rn-nav', { type: 'button', 'aria-haspopup': 'dialog' });
    nav.addEventListener('click', () => showNavigator(nav));
    const back = h('button.btn', { text: 'Back' });
    const next = h('button.btn.btn-primary', { text: 'Next' });
    back.disabled = S.phase === 'q' && S.qi === 0;
    back.addEventListener('click', () => { if (S.phase === 'review') { S.phase = 'q'; S.qi = ms.qs.length - 1; } else S.qi--; refresh(); });
    next.addEventListener('click', () => {
      if (S.phase === 'review') return confirmFinishModule();
      if (S.qi < ms.qs.length - 1) S.qi++; else S.phase = 'review';
      refresh();
    });
    botEl.appendChild(name); botEl.appendChild(nav); botEl.appendChild(h('div.rn-btns', back, next));
    updateNavLabel();
  }
  function updateNavLabel() {
    const nav = U.$('.rn-nav', botEl);
    if (!nav) return;
    const ms = mstate();
    nav.innerHTML = S.phase === 'review' ? 'Check Your Work ' + U.icon('chevU') : 'Question ' + (S.qi + 1) + ' of ' + ms.qs.length + ' ' + U.icon('chevU');
  }
  function refresh() { U.closePopover(); save(); if (S.phase === 'review') renderReview(); else renderQuestion(); renderBottom(); mainEl.scrollTop = 0; }

  function gridButtons(onPick, current) {
    const ms = mstate();
    const grid = h('div.q-grid');
    ms.qs.forEach((_, i) => {
      const answered = ms.ans[i] != null && ms.ans[i] !== '';
      const b = h('button.q-cell' + (answered ? '.answered' : '.unanswered') + (ms.flags[i] ? '.flagged' : '') + (i === current ? '.current' : ''), { type: 'button', 'aria-label': 'Question ' + (i + 1) + (answered ? ', answered' : ', unanswered') + (ms.flags[i] ? ', marked for review' : '') },
        h('span', String(i + 1)), ms.flags[i] ? h('i.q-flag', { html: U.icon('flag') }) : null, i === current ? h('i.q-pin', { html: U.icon('pin') }) : null);
      b.addEventListener('click', () => onPick(i));
      grid.appendChild(b);
    });
    return grid;
  }
  const legend = () => h('div.q-legend', h('span', h('i.lg.current', { html: U.icon('pin') }), 'Current'), h('span', h('i.lg.unanswered'), 'Unanswered'), h('span', h('i.lg.flagged', { html: U.icon('flag') }), 'For Review'));

  function showNavigator(anchor) {
    const m = mod();
    const box = h('div.nav-pop',
      h('div.nav-pop-head', h('b', 'Section ' + sectionNumber(m) + ', Module ' + m.num + ': ' + secName(m.section) + ' Questions')),
      legend(),
      gridButtons((i) => { S.phase = 'q'; S.qi = i; refresh(); }, S.phase === 'q' ? S.qi : -1));
    const rev = h('button.btn.btn-outline', { text: 'Go to Review Page' });
    rev.addEventListener('click', () => { S.phase = 'review'; refresh(); });
    box.appendChild(h('div.center', rev));
    U.popover(anchor, box, { placement: 'top', cls: 'nav-popover' });
  }

  function renderReview() {
    const ms = mstate(), m = mod();
    mainEl.innerHTML = '';
    const unanswered = ms.ans.filter((a) => a == null || a === '').length, flagged = ms.flags.filter(Boolean).length;
    mainEl.appendChild(h('div.rn-review',
      h('h2', 'Check Your Work'),
      h('p', 'On test day, you won’t be able to move on to the next module until time expires. For these practice tests, you can select ', h('b', 'Next'), ' when you’re ready to move on.'),
      h('div.card.review-card',
        h('div.review-head', h('b', 'Section ' + sectionNumber(m) + ', Module ' + m.num + ': ' + secName(m.section) + ' Questions'), legend()),
        gridButtons((i) => { S.phase = 'q'; S.qi = i; refresh(); }, -1),
        h('p.muted.small', unanswered ? unanswered + ' unanswered' : 'All questions answered', flagged ? ' · ' + flagged + ' marked for review' : ''))));
  }

  function confirmFinishModule() {
    const ms = mstate();
    const un = ms.ans.filter((a) => a == null || a === '').length;
    const last = S.mi === S.exam.modules.length - 1;
    U.confirm(last ? 'Submit your test?' : 'Move to the next module?',
      (un ? '<b>You have ' + U.plural(un, 'unanswered question') + '.</b> ' : '') + (last ? 'Your answers will be scored and you’ll see your results.' : 'You won’t be able to return to this module.'),
      last ? 'Submit' : 'Next Module').then((ok) => { if (ok) finishModule(); });
  }

  function finishModule() {
    U.closePopover(); SAT.win.closeAll(); SAT.lineReader.off();
    if (S.mi >= S.exam.modules.length - 1) return finishExam();
    const wasBreak = S.mi === S.exam.breakAfter;
    S.mi++; S.qi = 0; S.phase = wasBreak ? 'break' : 'q';
    buildModule(S.mi);
    save();
    render();
    if (!wasBreak) U.toast('Module ' + mod().num + ' of ' + secName(mod().section) + ' has started.');
  }

  /* ----------------------------------------------------------- break */
  function renderBreak() {
    const resume = h('button.btn.btn-primary.btn-lg', { text: 'Resume Testing' });
    resume.addEventListener('click', resumeFromBreak);
    root.querySelector('.runner').innerHTML = '';
    root.querySelector('.runner').appendChild(h('div.rn-break',
      h('div.card.break-card',
        h('p.muted', 'Remaining Break Time:'),
        h('div.break-clock#break-clock', U.fmtTime(S.breakLeft)),
        resume),
      h('div.break-info',
        h('h2', 'Practice Test Break'),
        h('p', 'You can resume this practice test as soon as you’re ready to move on. On test day, you’ll wait until the clock counts down.'),
        h('h3', 'Take a Break: Do Not Close Your Device'),
        h('p', 'After the break, the Math section begins. You’ll have the calculator and reference sheet available for every Math question.'),
        h('ul', h('li', 'Stretch, drink some water, and rest your eyes.'), h('li', 'Don’t review your Reading and Writing answers; that section is complete.')))));
  }
  function resumeFromBreak() { S.phase = 'q'; S.breakLeft = 0; save(); render(); U.toast('Math, Module 1 has started.'); }

  /* ---------------------------------------------------------- finish */
  function finishExam() {
    clearInterval(timer);
    const modules = S.exam.modules.map((m, i) => {
      const ms = S.mods[i], qs = ms.qs.map(SAT.resolveQ);
      const correct = qs.map((q, k) => SAT.tests.isCorrect(q, ms.ans[k]));
      qs.forEach((q, k) => SAT.stats.record(q, correct[k], 0));
      return { section: m.section, num: m.num, level: ms.level, qs: ms.qs, ans: ms.ans, correct, time: m.time - ms.timeLeft };
    });
    const secScore = (sec) => {
      const ms = modules.filter((m) => m.section === sec);
      if (!ms.length) return null;
      const c = ms.reduce((a, m) => a + m.correct.filter(Boolean).length, 0), t = ms.reduce((a, m) => a + m.qs.length, 0);
      const hard = (ms.find((m) => m.num === 2) || {}).level === 'hard';
      return SAT.tests.sectionScore(c, t, hard);
    };
    const rw = secScore('rw'), math = secScore('math');
    const entry = {
      id: U.uid(), testId: S.exam.testId, kind: S.exam.kind, title: S.exam.title, date: Date.now(),
      rw, math, total: rw != null && math != null ? rw + math : null, modules,
    };
    const hist = SAT.store.get('history', []);
    hist.unshift(entry);
    SAT.store.set('history', hist.slice(0, 40));
    discard();
    SAT.router.go('/results/' + entry.id);
  }

  /* ------------------------------------------------------- popovers */
  function showDirections(anchor) {
    const m = mod();
    const html = m.section === 'rw'
      ? '<h3>Reading and Writing directions</h3><p>The questions in this section address a number of important reading and writing skills. Each question includes one or more passages, which may include a table or graph. Read each passage and question carefully, and then choose the best answer to the question based on the passage(s).</p><p>All questions in this section are multiple-choice with four answer choices. Each question has a single best answer.</p>'
      : '<h3>Math directions</h3><p>The questions in this section address a number of important math skills. Use of a calculator is permitted for all questions. A reference sheet, calculator, and these directions can be accessed throughout the test.</p><p><b>Unless otherwise indicated:</b></p><ul><li>All variables and expressions represent real numbers.</li><li>Figures provided are drawn to scale.</li><li>All figures lie in a plane.</li><li>The domain of a given function <i>f</i> is the set of all real numbers <i>x</i> for which <i>f(x)</i> is a real number.</li></ul><p>For <b>multiple-choice questions</b>, solve each problem and choose the correct answer from the choices provided. For <b>student-produced response questions</b>, solve each problem and enter your answer following the directions shown with the question.</p>';
    const box = h('div.dir-pop', { html });
    const close = h('button.btn.btn-primary', { text: 'Close' });
    close.addEventListener('click', U.closePopover);
    box.appendChild(h('div.right', close));
    U.popover(anchor, box, { cls: 'wide-pop' });
  }
  function showNotes(anchor) {
    const pe = qctl && qctl.passageEl;
    const notes = pe ? SAT.annotate.notesIn(pe) : [];
    const box = h('div.notes-pop', h('h3', 'Highlights & Notes'),
      h('p.small', 'Select any text in the passage to highlight it (yellow, blue, or pink), underline it, or add a note. Select a highlight again to change or remove it. Double-click a word to see its definition.'),
      notes.length ? h('ul.note-list', ...notes.map((n) => h('li', h('b', '“' + n.text + '”'), h('div', n.note)))) : h('p.muted.small', 'No notes on this passage yet.'));
    U.popover(anchor, box);
  }
  function showMore(anchor) {
    const z = SAT.settings.get('zoom') || 1;
    const item = (ic, label, fn) => { const b = h('button.menu-item', { html: U.icon(ic) + '<span>' + label + '</span>' }); b.addEventListener('click', () => { U.closePopover(); fn(); }); return b; };
    const box = h('div.menu',
      item('line', (SAT.lineReader.isOn() ? 'Hide' : 'Show') + ' Line Reader', () => SAT.lineReader.toggle()),
      item('zoom', 'Zoom In (' + Math.round(z * 100) + '%)', () => setZoom(Math.min(1.6, z + 0.1))),
      item('minus', 'Zoom Out', () => setZoom(Math.max(0.8, z - 0.1))),
      item('timer', 'Study Timer', () => SAT.openTool('timer')),
      item('dict', 'Dictionary', () => SAT.openTool('dict')),
      item('info', 'Keyboard Shortcuts', showShortcuts),
      item('download', 'Save and Exit', () => { save(); SAT.router.go('/tests'); U.toast('Progress saved. Resume any time from the Tests page.'); }),
      item('trash', 'Quit Without Saving', () => U.confirm('Quit this test?', 'Your answers for this attempt will be discarded.', 'Quit', true).then((ok) => { if (ok) { discard(); SAT.router.go('/tests'); } })));
    U.popover(anchor, box);
  }
  function setZoom(z) { SAT.settings.set('zoom', Math.round(z * 10) / 10); const r = U.$('.runner'); if (r) r.style.setProperty('--q-scale', SAT.settings.get('zoom')); }
  function showShortcuts() {
    U.modal({ title: 'Keyboard shortcuts', body: '<table class="kbd-table"><tr><td><kbd>A</kbd>–<kbd>D</kbd></td><td>Select an answer choice</td></tr><tr><td><kbd>Alt</kbd>+<kbd>→</kbd> / <kbd>Alt</kbd>+<kbd>←</kbd></td><td>Next / previous question</td></tr><tr><td><kbd>Alt</kbd>+<kbd>F</kbd></td><td>Mark for review</td></tr><tr><td><kbd>Alt</kbd>+<kbd>C</kbd></td><td>Calculator (Math)</td></tr><tr><td><kbd>Alt</kbd>+<kbd>R</kbd></td><td>Reference sheet (Math)</td></tr><tr><td><kbd>Alt</kbd>+<kbd>↑</kbd>/<kbd>↓</kbd></td><td>Move the line reader</td></tr></table>', actions: [{ label: 'Close', primary: true }] });
  }

  function onKey(e) {
    if (!S || S.phase === 'break') return;
    const tag = (e.target.tagName || '').toLowerCase();
    const typing = tag === 'input' || tag === 'textarea' || e.target.isContentEditable;
    if (e.altKey && e.key === 'ArrowRight') { e.preventDefault(); U.$('.rn-btns .btn-primary').click(); return; }
    if (e.altKey && e.key === 'ArrowLeft') { e.preventDefault(); const b = U.$('.rn-btns .btn'); if (!b.disabled) b.click(); return; }
    if (e.altKey && (e.key === 'f' || e.key === 'F')) { e.preventDefault(); const f = U.$('.flag-btn'); if (f) f.click(); return; }
    if (e.altKey && (e.key === 'c' || e.key === 'C') && mod().section === 'math') { e.preventDefault(); SAT.toggleTool('calc'); return; }
    if (e.altKey && (e.key === 'r' || e.key === 'R') && mod().section === 'math') { e.preventDefault(); SAT.toggleTool('ref'); return; }
    if (typing || e.ctrlKey || e.metaKey || e.altKey || S.phase !== 'q') return;
    const k = e.key.toLowerCase();
    if ('abcd'.includes(k) && k.length === 1) { const c = U.$$('.rn-main .choice')['abcd'.indexOf(k)]; if (c) c.click(); }
  }

  SAT.runner = { start, saved, discard, mount };
})();
