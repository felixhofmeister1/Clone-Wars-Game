/* Page views: dashboard, tests, results & review, practice picker, learn,
   tools, progress, and settings. Each view renders into #view. */
(function () {
  'use strict';
  const SAT = window.SAT, U = SAT.util, h = U.h, SK = SAT.skills;
  const V = (SAT.views = {});
  const view = () => U.$('#view');
  const page = (cls, ...kids) => { const p = h('div.page' + (cls ? '.' + cls : ''), ...kids); view().innerHTML = ''; view().appendChild(p); U.renderMath(p); window.scrollTo(0, 0); return p; };
  const card = (cls, ...kids) => h('section.card' + (cls ? '.' + cls : ''), ...kids);
  const icon = (n) => U.frag(U.icon(n));
  const masteryDots = (m) => h('span.mastery', { title: ['Not started', 'Needs work', 'Developing', 'Proficient', 'Mastered'][m] }, ...[1, 2, 3, 4].map((i) => h('i' + (i <= m ? '.on' : ''))));
  const greet = () => { const hr = new Date().getHours(); return hr < 12 ? 'Good morning' : hr < 18 ? 'Good afternoon' : 'Good evening'; };
  const DIFF_OPTS = [['E', 'Easy'], ['M', 'Medium'], ['H', 'Hard'], ['X', 'Mixed'], ['A', 'Adaptive']];

  /* ============================================================== HOME */
  V.home = function () {
    const st = SAT.settings.all(), est = SAT.stats.estimate();
    const name = st.name ? ', ' + st.name : '';
    const run = SAT.runner.saved(), sess = SAT.practice.hasSession();

    const hero = card('b-hero.hero',
      h('div.hero-text', h('p.eyebrow', greet() + name), h('h1', 'Your Digital SAT studio'),
        h('p.muted', 'Adaptive full-length tests, practice for every skill, explanations for every answer, and the tools you’ll use on test day.'),
        h('div.btn-row', h('a.btn.btn-primary.btn-lg', { href: '#/tests' }, icon('clipboard'), ' Take a practice test'), h('a.btn.btn-lg', { href: '#/practice' }, icon('target'), ' Practice skills'))),
      h('div.hero-score',
        h('div.big-score', h('span', est.total ? String(est.total) : '—'), h('small', 'of 1600')),
        h('div.split-score', h('div', h('b', est.rw || '—'), h('small', 'Reading & Writing')), h('div', h('b', est.math || '—'), h('small', 'Math'))),
        h('p.muted.small', est.total ? est.source : 'Take a practice test or answer a few practice sets to see your estimated score.')));

    let cont;
    if (run) {
      const m = run.exam.modules[run.mi];
      cont = card('b-wide.continue', h('p.eyebrow', 'Continue'), h('h2', run.exam.title), h('p.muted', run.phase === 'break' ? 'On break before Math' : (m.section === 'rw' ? 'Reading and Writing' : 'Math') + ', Module ' + m.num + ' · ' + U.fmtTime(run.mods[run.mi].timeLeft) + ' left'),
        h('div.btn-row', h('a.btn.btn-primary', { href: '#/test/run' }, icon('play'), ' Resume test')));
    } else if (sess) {
      cont = card('b-wide.continue', h('p.eyebrow', 'Continue'), h('h2', sess.cfg.title || 'Practice set'), h('p.muted', 'Question ' + (sess.i + 1) + ' of ' + (sess.cfg.list ? sess.cfg.list.length : sess.cfg.count)),
        h('div.btn-row', h('a.btn.btn-primary', { href: '#/practice/run' }, icon('play'), ' Resume practice')));
    } else {
      const quick = h('button.btn.btn-primary', { html: U.icon('bolt') + ' Quick 10' });
      quick.addEventListener('click', () => SAT.practice.start({ title: 'Quick 10: mixed skills', skills: SK.list.map((s) => s.id), diff: 'X', count: 10, feedback: 'instant' }));
      cont = card('b-wide.continue', h('p.eyebrow', 'Jump in'), h('h2', 'A quick mixed set'), h('p.muted', 'Ten questions across Reading & Writing and Math with instant explanations.'), h('div.btn-row', quick, h('a.btn', { href: '#/learn' }, icon('book'), ' Browse lessons')));
    }

    const today = SAT.stats.today(), goal = st.dailyGoal || 20;
    const goalCard = card('b-sm.goal', h('p.eyebrow', 'Today'), h('div', { html: U.ring(today, goal, '<b>' + today + '</b><small>of ' + goal + '</small>', 104) }), h('p.muted.small.center', today >= goal ? 'Daily goal reached 🎉' : (goal - today) + ' to reach your goal'));
    const streak = SAT.stats.streak();
    const streakCard = card('b-sm.streak', h('p.eyebrow', 'Streak'), h('div.streak-num', icon('fire'), h('span', String(streak))), h('p.muted.small', streak === 1 ? 'day in a row' : 'days in a row'));

    const scored = SK.list.map((s) => Object.assign({ s }, SAT.stats.skill(s.id))).filter((x) => x.a >= 3).sort((a, b) => a.weighted - b.weighted).slice(0, 3);
    const weakList = h('div.weak-list');
    (scored.length ? scored : SK.list.filter((s) => !SAT.stats.skill(s.id).a).slice(0, 3).map((s) => ({ s, pct: null }))).forEach((x) => {
      const b = h('button.btn.btn-sm', { text: 'Practice' });
      b.addEventListener('click', () => quickSkill(x.s.id));
      weakList.appendChild(h('div.weak-row', h('div', h('b', x.s.name), h('div.muted.small', x.s.section === 'rw' ? 'Reading & Writing' : 'Math', x.pct != null ? ' · ' + x.pct + '% correct' : ' · not started')), b));
    });
    const weakCard = card('b-wide.weak', h('div.card-head', h('p.eyebrow', scored.length ? 'Focus areas' : 'Start here'), h('a.link', { href: '#/progress' }, 'All skills →')), weakList);

    const w = SAT.dict.wordOfDay();
    const wordCard = card('b-sm.word', h('p.eyebrow', 'Word of the day'), w ? h('div', h('h3', w[0]), h('p.muted.small', h('i', w[1]), ' — ' + w[2])) : null,
      h('button.link-btn', { onclick: () => SAT.openTool('dict', w && w[0]) }, 'Open dictionary →'));

    const toolBtn = (id, ic, label) => h('button.tool-chip', { type: 'button', onclick: () => SAT.openTool(id) }, icon(ic), h('span', label));
    const toolsCard = card('b-wide.tools-card', h('p.eyebrow', 'Tools'), h('div.tool-chips', toolBtn('calc', 'calc', 'Calculator'), toolBtn('dict', 'dict', 'Dictionary'), toolBtn('ref', 'doc', 'Reference'), toolBtn('pad', 'pen', 'Scratchpad'), toolBtn('timer', 'timer', 'Timer'), toolBtn('score', 'trophy', 'Score estimator')));

    let dateCard;
    if (st.testDate) {
      const days = Math.ceil((new Date(st.testDate + 'T08:00') - new Date()) / 864e5);
      dateCard = card('b-sm.countdown', h('p.eyebrow', 'Test day'), h('div.count-num', days >= 0 ? String(days) : '✓'), h('p.muted.small', days > 0 ? 'days to go · ' + new Date(st.testDate + 'T08:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : days === 0 ? 'Test day — good luck!' : 'Test date passed'));
    } else dateCard = card('b-sm.countdown', h('p.eyebrow', 'Test day'), h('p', 'Set your test date to see a countdown.'), h('a.link', { href: '#/settings' }, 'Set date →'));

    const domBars = h('div.dom-bars');
    SK.domains.forEach((d) => {
      let a = 0, c = 0; d.skills.forEach((s) => { const x = SAT.stats.skill(s); a += x.a; c += x.c; });
      domBars.appendChild(h('div.dom-bar', h('span', d.name), U.frag(U.bar(a ? U.pct(c, a) : 0, 'c' + d.color)), h('b', a ? U.pct(c, a) + '%' : '—')));
    });
    const domCard = card('b-tall.domains', h('p.eyebrow', 'Accuracy by domain'), domBars);

    const hist = (SAT.store.get('history', []) || []).filter((x) => x.total).slice(0, 8).reverse();
    const trendCard = card('b-wide.trend', h('div.card-head', h('p.eyebrow', 'Test scores'), h('a.link', { href: '#/tests' }, 'Tests →')),
      hist.length ? h('div', { html: SAT.fig.trend(hist.map((x) => x.total), { w: 520, h: 170, xlabel: 'Attempt' }) }) : h('p.muted', 'Your full-length test scores will appear here.'));

    page('home', h('div.bento', hero, cont, goalCard, streakCard, weakCard, domCard, wordCard, dateCard, trendCard, toolsCard));
  };

  function quickSkill(id, diff) {
    const s = SK.byId[id];
    SAT.practice.start({ title: s.name, skills: [id], diff: diff || 'A', count: 10, feedback: 'instant' });
  }
  V.quickSkill = quickSkill;

  /* ============================================================= TESTS */
  V.tests = function () {
    const run = SAT.runner.saved();
    const kids = [h('div.page-head', h('h1', 'Practice tests'), h('p.muted', 'Full-length, adaptive, and timed like the real Digital SAT: two Reading and Writing modules (27 questions, 32 minutes each), a 10-minute break, then two Math modules (22 questions, 35 minutes each). Module 2 is harder or easier depending on how you do in Module 1.'))];
    if (run) {
      const resume = h('a.btn.btn-primary', { href: '#/test/run' }, icon('play'), ' Resume');
      const quit = h('button.btn.btn-ghost', { text: 'Discard' });
      quit.addEventListener('click', () => U.confirm('Discard this attempt?', 'Your answers will be lost.', 'Discard', true).then((ok) => { if (ok) { SAT.runner.discard(); V.tests(); } }));
      kids.push(card('resume-card', h('div', h('p.eyebrow', 'In progress'), h('h2', run.exam.title), h('p.muted', 'Started ' + new Date(run.started).toLocaleString())), h('div.btn-row', resume, quit)));
    }
    const grid = h('div.test-grid');
    SAT.tests.list.forEach((t) => {
      const ok = SAT.tests.available(t.id);
      const done = (SAT.store.get('history', []) || []).filter((x) => x.testId === t.id);
      const startBtn = (label, secs, primary) => {
        const b = h('button.btn' + (primary ? '.btn-primary' : ''), { text: label });
        b.disabled = !ok;
        b.addEventListener('click', () => startTest(t.id, secs));
        return b;
      };
      grid.appendChild(card('test-card',
        h('div.test-badge', icon('clipboard')),
        h('h2', t.name), h('p.muted', t.blurb),
        h('ul.test-facts', h('li', '98 questions'), h('li', '2 h 14 min'), h('li', 'Adaptive modules'), h('li', 'Estimated 400–1600 score')),
        done.length ? h('p.small', 'Best score: ', h('b', String(Math.max(...done.map((x) => x.total || 0)) || '—')), ' · ' + U.plural(done.length, 'attempt')) : null,
        ok ? null : h('p.small.warn-text', 'This test’s questions are still loading.'),
        h('div.btn-row', startBtn('Start full test', ['rw', 'math'], true), startBtn('Reading & Writing only', ['rw']), startBtn('Math only', ['math']))));
    });
    const fresh = h('button.btn.btn-primary', { html: U.icon('sparkle') + ' Generate a new Math section' });
    fresh.addEventListener('click', () => confirmStart(SAT.tests.freshMathExam()));
    grid.appendChild(card('test-card.fresh',
      h('div.test-badge', icon('sigma')), h('h2', 'Fresh Math Section'),
      h('p.muted', 'A brand-new adaptive Math section generated just for you: 44 questions in two 35-minute modules, with grid-in questions and full explanations. Unlimited retakes.'),
      h('ul.test-facts', h('li', '44 questions'), h('li', '70 min'), h('li', 'New every time')),
      h('div.btn-row', fresh)));
    kids.push(grid);

    const hist = SAT.store.get('history', []) || [];
    if (hist.length) {
      const tb = h('table.table');
      tb.appendChild(h('thead', h('tr', h('th', 'Test'), h('th', 'Date'), h('th', 'R&W'), h('th', 'Math'), h('th', 'Total'), h('th', ''))));
      const body = h('tbody');
      hist.forEach((x) => body.appendChild(h('tr', h('td', x.title), h('td', new Date(x.date).toLocaleDateString()), h('td', x.rw || '—'), h('td', x.math || '—'), h('td', h('b', x.total || '—')), h('td', h('a.link', { href: '#/results/' + x.id }, 'Report →')))));
      tb.appendChild(body);
      kids.push(card('', h('h2', 'Score history'), h('div.table-wrap', tb)));
    }
    page('tests', ...kids);
  };

  function startTest(testId, secs) { confirmStart(SAT.tests.buildExam(testId, secs)); }
  function confirmStart(exam) {
    if (SAT.runner.saved()) {
      U.confirm('Replace your test in progress?', 'Starting a new test discards your unfinished attempt.', 'Start new test', true).then((ok) => { if (ok) { SAT.runner.discard(); showStart(exam); } });
    } else showStart(exam);
  }
  function showStart(exam) {
    const mods = exam.modules.map((m) => '<li>' + (m.section === 'rw' ? 'Reading and Writing' : 'Math') + ', Module ' + m.num + ' — ' + (m.section === 'rw' ? '27 questions' : '22 questions') + ', ' + Math.round(m.time / 60) + ' minutes</li>').join('');
    U.modal({
      title: exam.title,
      body: '<p>You’re about to start. Here’s the plan:</p><ul>' + mods + '</ul>' + (exam.breakAfter >= 0 ? '<p>You’ll get a 10-minute break between sections.</p>' : '') +
        '<p class="muted small">Tools: annotation and line reader for every question; calculator and reference sheet for Math. Your progress saves automatically, so you can leave and resume later.</p>',
      actions: [{ label: 'Not yet', value: false }, { label: 'Begin', primary: true, value: true }],
    }).done.then((ok) => { if (ok) SAT.runner.start(exam); });
  }

  /* =========================================================== RESULTS */
  V.results = function (p) {
    const entry = (SAT.store.get('history', []) || []).find((x) => x.id === p.id);
    if (!entry) return page('', h('p', 'Result not found.'), h('a.btn', { href: '#/tests' }, 'Back to tests'));
    const secs = ['rw', 'math'].filter((s) => entry.modules.some((m) => m.section === s));
    const scoreBox = (label, v, lo, hi) => h('div.score-box', h('small', label), h('b', v != null ? String(v) : '—'), h('div.range', h('span', String(lo)), h('div.range-bar', h('i', { style: { left: v != null ? U.pct(v - lo, hi - lo) + '%' : '0%' } })), h('span', String(hi))));
    const head = card('result-hero',
      h('div', h('p.eyebrow', new Date(entry.date).toLocaleString()), h('h1', entry.title), h('p.muted', 'Estimated scores based on your answers and module difficulty.')),
      h('div.result-scores', entry.total != null ? scoreBox('Total score', entry.total, 400, 1600) : null, secs.includes('rw') ? scoreBox('Reading and Writing', entry.rw, 200, 800) : null, secs.includes('math') ? scoreBox('Math', entry.math, 200, 800) : null));

    const modCards = h('div.mod-grid');
    entry.modules.forEach((m, mi) => {
      const c = m.correct.filter(Boolean).length;
      const cells = h('div.q-grid.small');
      m.qs.forEach((ref, qi) => cells.appendChild(h('a.q-cell' + (m.correct[qi] ? '.right' : m.ans[qi] == null || m.ans[qi] === '' ? '.blank' : '.wrong'), { href: '#/review/' + entry.id + '/' + mi + '/' + qi, title: 'Question ' + (qi + 1) }, h('span', String(qi + 1)))));
      modCards.appendChild(card('mod-card', h('div.card-head', h('h3', (m.section === 'rw' ? 'Reading and Writing' : 'Math') + ' · Module ' + m.num), h('span.pill', m.num === 2 ? (m.level === 'hard' ? 'Harder module' : 'Easier module') : 'Routing module')),
        h('p', h('b', c + ' / ' + m.qs.length), ' correct · ', U.fmtTime(m.time), ' used'), cells));
    });

    const dom = h('div.dom-report');
    secs.forEach((sec) => {
      SK.domainsOf(sec).forEach((d) => {
        let a = 0, c = 0; const perSkill = {};
        entry.modules.filter((m) => m.section === sec).forEach((m) => m.qs.forEach((ref, i) => { const q = SAT.resolveQ(ref); if (!q || SK.byId[q.skill].domain !== d.id) return; a++; if (m.correct[i]) c++; const ps = (perSkill[q.skill] = perSkill[q.skill] || { a: 0, c: 0 }); ps.a++; if (m.correct[i]) ps.c++; }));
        if (!a) return;
        dom.appendChild(h('div.dom-item', h('div.dom-top', h('b', d.name), h('span', c + '/' + a)), U.frag(U.bar(U.pct(c, a), 'c' + d.color)),
          h('div.dom-skills', ...Object.keys(perSkill).map((k) => h('span.pill' + (perSkill[k].c === perSkill[k].a ? '.ok' : ''), SK.byId[k].name + ' ' + perSkill[k].c + '/' + perSkill[k].a)))));
      });
    });
    const wrong = [];
    entry.modules.forEach((m) => m.qs.forEach((ref, i) => { if (!m.correct[i]) wrong.push(ref); }));
    const practiceWrong = h('button.btn.btn-primary', { html: U.icon('undo') + ' Practice the ' + wrong.length + ' questions I missed' });
    practiceWrong.disabled = !wrong.length;
    practiceWrong.addEventListener('click', () => SAT.practice.start({ title: 'Missed questions: ' + entry.title, skills: [], list: wrong, count: wrong.length, feedback: 'instant' }));
    page('results', head, h('div.btn-row', practiceWrong, h('a.btn', { href: '#/tests' }, 'Back to tests')),
      h('h2', 'Performance by domain'), card('', dom),
      h('h2', 'Module details'), h('p.muted', 'Select any question number to review it with a full explanation.'), modCards);
  };

  V.review = function (p) {
    const entry = (SAT.store.get('history', []) || []).find((x) => x.id === p.id);
    if (!entry) return V.tests();
    const mi = +p.m, qi = +p.q, m = entry.modules[mi];
    if (!m) return V.results(p);
    const q = SAT.resolveQ(m.qs[qi]);
    const host = h('div.review-q');
    const nav = (d) => { let a = mi, b = qi + d; if (b < 0) { a--; if (a < 0) return null; b = entry.modules[a].qs.length - 1; } if (b >= entry.modules[a].qs.length) { a++; b = 0; if (a >= entry.modules.length) return null; } return '#/review/' + p.id + '/' + a + '/' + b; };
    const prev = nav(-1), next = nav(1);
    page('review-page',
      h('div.btn-row', h('a.btn', { href: '#/results/' + p.id }, icon('chevL'), ' Score report'), h('span.spacer'),
        h('span.muted', (m.section === 'rw' ? 'R&W' : 'Math') + ' Module ' + m.num + ' · Question ' + (qi + 1)),
        prev ? h('a.btn', { href: prev }, 'Previous') : null, next ? h('a.btn', { href: next }, 'Next') : null),
      host);
    if (!q) { host.appendChild(h('p', 'This question is no longer available.')); return; }
    SAT.qview.render(host, q, { number: qi + 1, mode: 'review', reveal: true, state: { answer: m.ans[qi] } });
  };

  /* ========================================================= PRACTICE */
  V.practice = function () {
    const cfg = Object.assign({ diff: 'A', count: 10, feedback: 'instant', timed: false, sec: 'rw' }, SAT.store.get('practice.cfg', {}));
    const saveCfg = () => SAT.store.set('practice.cfg', cfg);
    const selected = new Set();
    const seg = (opts, key, onchange) => {
      const g = h('div.seg', { role: 'radiogroup' });
      opts.forEach(([v, l]) => { const b = h('button' + (cfg[key] === v ? '.on' : ''), { type: 'button', role: 'radio', 'aria-checked': String(cfg[key] === v), text: l }); b.addEventListener('click', () => { cfg[key] = v; saveCfg(); U.$$('button', g).forEach((x) => { x.classList.toggle('on', x === b); x.setAttribute('aria-checked', String(x === b)); }); if (onchange) onchange(); }); g.appendChild(b); });
      return g;
    };
    const timed = h('input', { type: 'checkbox' }); timed.checked = cfg.timed;
    timed.addEventListener('change', () => { cfg.timed = timed.checked; saveCfg(); });
    const startSel = h('button.btn.btn-primary', { text: 'Start custom set' });
    const updateSel = () => { startSel.textContent = selected.size ? 'Start set with ' + U.plural(selected.size, 'skill') : 'Select skills below'; startSel.disabled = !selected.size; };
    startSel.addEventListener('click', () => { const ids = Array.from(selected); SAT.practice.start({ title: ids.length === 1 ? SK.byId[ids[0]].name : 'Custom set: ' + ids.length + ' skills', skills: ids, diff: cfg.diff, count: cfg.count, feedback: cfg.feedback, timed: cfg.timed }); });
    const config = card('practice-config',
      h('div.cfg-row', h('label', 'Difficulty'), seg(DIFF_OPTS, 'diff')),
      h('div.cfg-row', h('label', 'Questions'), seg([[5, '5'], [10, '10'], [15, '15'], [20, '20'], [27, '27']], 'count')),
      h('div.cfg-row', h('label', 'Feedback'), seg([['instant', 'After each question'], ['end', 'At the end']], 'feedback')),
      h('div.cfg-row', h('label', 'Timing'), h('label.switch', timed, h('span'), ' Timed at test pace (71 s R&W, 95 s Math)')),
      h('div.cfg-row', h('span.muted.small', 'Tip: Adaptive starts at Medium, then moves up after a correct answer and down after a miss.'), h('span.spacer'), startSel));

    const mistakes = SAT.store.get('mistakes', []) || [];
    const quick = (ic, title, desc, fn, disabled) => { const b = h('button.tile', { type: 'button', disabled: !!disabled }, h('span.tile-ic', { html: U.icon(ic) }), h('b', title), h('span.muted.small', desc)); b.addEventListener('click', fn); return b; };
    const quicks = h('div.quick-tiles',
      quick('bolt', 'Quick 10', 'Mixed skills from both sections', () => SAT.practice.start({ title: 'Quick 10: mixed skills', skills: SK.list.map((s) => s.id), diff: 'X', count: 10, feedback: 'instant' })),
      quick('target', 'Weak spots', 'Your lowest-accuracy skills', () => {
        const w = SK.list.map((s) => Object.assign({ id: s.id }, SAT.stats.skill(s.id))).filter((x) => x.a).sort((a, b) => a.weighted - b.weighted).slice(0, 4).map((x) => x.id);
        if (!w.length) { U.toast('Answer a few questions first so we can find your weak spots.'); return; }
        SAT.practice.start({ title: 'Weak spots', skills: w, diff: 'A', count: cfg.count, feedback: 'instant' });
      }),
      quick('undo', 'Mistakes review', mistakes.length ? U.plural(mistakes.length, 'question') + ' to revisit' : 'No mistakes yet', () => SAT.practice.start({ title: 'Mistakes review', skills: [], list: mistakes.slice(0, 20).map((m) => m.q), count: Math.min(20, mistakes.length), feedback: 'instant' }), !mistakes.length),
      quick('sigma', 'Math sprint', 'Unlimited generated Math questions', () => SAT.practice.start({ title: 'Math sprint', skills: SK.ofSection('math').map((s) => s.id), diff: cfg.diff, count: 20, feedback: 'instant', timed: cfg.timed })),
      quick('book', 'Reading & Writing mix', 'Every R&W question type', () => SAT.practice.start({ title: 'Reading & Writing mix', skills: SK.ofSection('rw').map((s) => s.id), diff: cfg.diff, count: cfg.count, feedback: cfg.feedback })));

    const secTabs = h('div.tabs.big-tabs');
    const domHost = h('div.domain-list');
    const showSec = (sec) => {
      cfg.sec = sec; saveCfg();
      U.$$('button', secTabs).forEach((b) => b.classList.toggle('on', b.dataset.sec === sec));
      domHost.innerHTML = '';
      SK.domainsOf(sec).forEach((d) => {
        const rows = d.skills.map((sid) => {
          const s = SK.byId[sid], st = SAT.stats.skill(sid);
          const cb = h('input', { type: 'checkbox', 'aria-label': 'Select ' + s.name });
          cb.checked = selected.has(sid);
          cb.addEventListener('change', () => { if (cb.checked) selected.add(sid); else selected.delete(sid); updateSel(); });
          const go = h('button.btn.btn-sm.btn-primary', { html: 'Practice ' + U.icon('chevR') });
          go.addEventListener('click', () => SAT.practice.start({ title: s.name, skills: [sid], diff: cfg.diff, count: cfg.count, feedback: cfg.feedback, timed: cfg.timed }));
          const pool = s.section === 'rw' ? SAT.bank.rwPool(sid, 'X').length + ' questions' : 'Unlimited';
          return h('div.skill-row', h('label.skill-check', cb), h('div.skill-info', h('b', s.name), h('span.muted.small', s.desc)),
            h('div.skill-meta', masteryDots(st.mastery), h('span.small', st.a ? st.pct + '% · ' + st.a + ' done' : pool)),
            h('div.skill-btns', h('a.btn.btn-sm.btn-ghost', { href: '#/learn/' + sid }, 'Learn'), go));
        });
        const all = h('button.link-btn.small', { text: 'Select all' });
        all.addEventListener('click', () => { d.skills.forEach((x) => selected.add(x)); showSec(sec); updateSel(); });
        domHost.appendChild(card('domain-card.dc' + d.color, h('div.card-head', h('div', h('h3', d.name), h('span.muted.small', d.weight)), all), h('p.muted.small', d.desc), ...rows));
      });
    };
    [['rw', 'Reading & Writing', 'book'], ['math', 'Math', 'sigma']].forEach(([id, l, ic]) => { const b = h('button.tab', { dataset: { sec: id }, html: U.icon(ic) + ' ' + l }); b.addEventListener('click', () => showSec(id)); secTabs.appendChild(b); });
    const sess = SAT.practice.hasSession();
    page('practice',
      h('div.page-head', h('h1', 'Practice'), h('p.muted', 'Practice every domain and subdomain at the difficulty you choose. Every question has a full explanation, including why each wrong answer is wrong.')),
      sess ? card('resume-card', h('div', h('p.eyebrow', 'In progress'), h('h2', sess.cfg.title || 'Practice set')), h('div.btn-row', h('a.btn.btn-primary', { href: '#/practice/run' }, icon('play'), ' Resume'), h('button.btn.btn-ghost', { text: 'Discard', onclick: () => { SAT.practice.discard(); V.practice(); } }))) : null,
      quicks, config, secTabs, domHost);
    showSec(cfg.sec);
    updateSel();
  };

  /* ============================================================ LEARN */
  V.learn = function () {
    const sec = (id, title) => h('section.learn-sec', h('h2', title), h('div.learn-grid', ...SK.domainsOf(id).map((d) => card('learn-domain.dc' + d.color, h('h3', d.name), h('p.muted.small', d.weight + ' · ' + d.desc),
      h('ul.learn-links', ...d.skills.map((s) => h('li', h('a', { href: '#/learn/' + s }, SK.byId[s].name, ' ', h('span.muted.small', '→')))))))));
    const L = SAT.lessons || {};
    page('learn',
      h('div.page-head', h('h1', 'Learn'), h('p.muted', 'Short lessons for every tested skill: what the questions look like, the rules and formulas you need, step-by-step strategies, common traps, and worked examples.')),
      L._overview ? card('overview', { html: L._overview }) : null,
      sec('rw', 'Reading and Writing'), sec('math', 'Math'));
  };

  V.lesson = function (p) {
    const s = SK.byId[p.skill];
    if (!s) return V.learn();
    const L = (SAT.lessons || {})[s.id] || {};
    const list = (arr) => h('ul', ...(arr || []).map((x) => h('li', { html: x })));
    const sample = h('div.sample-host');
    const sampleBtn = h('button.btn', { html: U.icon('sparkle') + ' Show a sample question' });
    sampleBtn.addEventListener('click', () => {
      const q = s.section === 'math' ? SAT.mathgen.random(s.id, 'M') : U.random.pick(SAT.bank.rwPool(s.id, 'X'));
      if (!q) return;
      sample.innerHTML = '';
      const ctl = SAT.qview.render(sample, q, { number: 'Ex', mode: 'practice' });
      const reveal = h('button.btn.btn-primary', { text: 'Check answer' });
      reveal.addEventListener('click', () => { ctl.reveal(); reveal.remove(); });
      sample.appendChild(h('div.btn-row', reveal));
      sampleBtn.innerHTML = U.icon('refresh') + ' Another sample';
    });
    const d = SK.domainById[s.domain];
    const go = (diff, label) => { const b = h('button.btn' + (diff === 'A' ? '.btn-primary' : ''), { text: label }); b.addEventListener('click', () => quickSkill(s.id, diff)); return b; };
    page('lesson',
      h('p.crumbs', h('a', { href: '#/learn' }, 'Learn'), ' / ', d.name),
      h('div.page-head', h('h1', s.name), h('p.muted', s.desc)),
      h('div.btn-row', go('A', 'Practice (adaptive)'), go('E', 'Easy'), go('M', 'Medium'), go('H', 'Hard')),
      h('div.lesson-grid',
        L.what ? card('lesson-card', h('h2', icon('info'), ' What it tests'), h('div', { html: L.what })) : null,
        L.looks ? card('lesson-card', h('h2', icon('eye'), ' What the questions look like'), h('div', { html: L.looks })) : null,
        L.steps ? card('lesson-card', h('h2', icon('list'), ' Strategy, step by step'), h('ol', ...L.steps.map((x) => h('li', { html: x })))) : null,
        L.rules ? card('lesson-card', h('h2', icon('doc'), ' Rules & formulas'), list(L.rules)) : null,
        L.traps ? card('lesson-card', h('h2', icon('flag'), ' Common traps'), list(L.traps)) : null,
        L.example ? card('lesson-card.wide', h('h2', icon('bulb'), ' Worked example'), h('div', { html: L.example })) : null),
      card('', h('div.card-head', h('h2', 'Try one'), sampleBtn), sample));
  };

  /* ============================================================ TOOLS */
  V.tools = function () {
    const t = (id, ic, name, desc, extra) => { const b = h('button.tool-tile', { type: 'button' }, h('span.tile-ic', { html: U.icon(ic) }), h('b', name), h('span.muted.small', desc), extra ? h('span.pill', extra) : null); b.addEventListener('click', () => SAT.openTool(id)); return b; };
    const info = (ic, name, desc) => h('div.tool-tile.static', h('span.tile-ic', { html: U.icon(ic) }), h('b', name), h('span.muted.small', desc), h('span.pill', 'In tests & practice'));
    const lr = h('button.tool-tile', { type: 'button' }, h('span.tile-ic', { html: U.icon('line') }), h('b', 'Line Reader'), h('span.muted.small', 'A focus band that follows your pointer to help you track lines of text.'), h('span.pill', 'Toggle'));
    lr.addEventListener('click', () => SAT.lineReader.toggle());
    page('tools',
      h('div.page-head', h('h1', 'Tools'), h('p.muted', 'Everything opens in a floating window you can drag and resize, so you can use it next to a question. Most tools also appear in the test and practice toolbars.')),
      h('div.tool-grid',
        t('calc', 'calc', 'Graphing Calculator', 'Graph equations, inequalities, circles, and points; sliders; tap to see intercepts and intersections. Scientific mode included.', 'Like Desmos'),
        t('ref', 'doc', 'Reference Sheet', 'The official SAT formula sheet, plus the formulas you’re expected to know.'),
        t('dict', 'dict', 'Dictionary & Vocabulary', 'Look up any word, browse ' + (SAT.vocab || []).length + ' SAT words, save words, and study flashcards.'),
        t('pad', 'pen', 'Scratchpad', 'Draw and work problems out by hand, or type notes.'),
        t('timer', 'timer', 'Study Timer', 'Countdown, stopwatch, Pomodoro, and module-length presets.'),
        t('score', 'trophy', 'Score Estimator', 'Turn module raw scores into estimated section and total scores.'),
        lr,
        info('marker', 'Highlights & Notes', 'Select passage text to highlight it in three colors, underline it, or attach a note.'),
        info('flag', 'Mark for Review', 'Flag questions to revisit; flags show in the question navigator.'),
        info('x', 'Answer Eliminator', 'Cross out choices you’ve ruled out with the ABC button.'),
        info('zoom', 'Zoom', 'Make question text larger or smaller from the More menu.'),
        info('search', 'Tap-to-define', 'Double-click any word in a passage to see its definition.')));
  };

  /* ========================================================= PROGRESS */
  V.progress = function () {
    const st = SAT.store.get('stats', {}) || {};
    let a = 0, c = 0, t = 0;
    Object.values(st).forEach((s) => { ['E', 'M', 'H'].forEach((d) => { a += s[d].a; c += s[d].c; }); t += s.time || 0; });
    const tile = (label, value, ic) => card('stat-tile', h('span.tile-ic', { html: U.icon(ic) }), h('b', value), h('span.muted.small', label));
    const hist = (SAT.store.get('history', []) || []).filter((x) => x.total).slice(0, 12).reverse();
    const act = SAT.store.get('activity', {}) || {};
    const heat = h('div.heatmap', { 'aria-label': 'Questions answered per day, last 12 weeks' });
    const d0 = new Date(); d0.setDate(d0.getDate() - 83);
    for (let i = 0; i < 84; i++) {
      const d = new Date(d0); d.setDate(d0.getDate() + i);
      const n = act[U.today(d)] || 0;
      heat.appendChild(h('i', { title: d.toDateString() + ': ' + n, dataset: { l: String(n === 0 ? 0 : n < 10 ? 1 : n < 25 ? 2 : n < 50 ? 3 : 4) } }));
    }
    const skillTables = ['rw', 'math'].map((sec) => {
      const tb = h('table.table.skill-table');
      tb.appendChild(h('thead', h('tr', h('th', 'Skill'), h('th', 'Mastery'), h('th', 'Easy'), h('th', 'Medium'), h('th', 'Hard'), h('th', 'Overall'), h('th', ''))));
      const body = h('tbody');
      SK.ofSection(sec).forEach((s) => {
        const x = SAT.stats.skill(s.id), r = x.raw;
        const cell = (d) => h('td.small', r && r[d].a ? r[d].c + '/' + r[d].a : '—');
        const b = h('button.btn.btn-sm', { text: 'Practice' }); b.addEventListener('click', () => quickSkill(s.id));
        body.appendChild(h('tr', h('td', h('a', { href: '#/learn/' + s.id }, s.name)), h('td', masteryDots(x.mastery)), cell('E'), cell('M'), cell('H'), h('td', x.a ? h('div.inline-bar', U.frag(U.bar(x.pct)), h('b', x.pct + '%')) : '—'), h('td', b)));
      });
      tb.appendChild(body);
      return card('', h('h2', sec === 'rw' ? 'Reading and Writing skills' : 'Math skills'), h('div.table-wrap', tb));
    });
    const mistakes = SAT.store.get('mistakes', []) || [];
    const clearM = h('button.btn.btn-ghost.btn-sm', { text: 'Clear list' });
    clearM.addEventListener('click', () => U.confirm('Clear your mistakes list?', 'This does not affect your stats.', 'Clear').then((ok) => { if (ok) { SAT.store.set('mistakes', []); V.progress(); } }));
    const revM = h('button.btn.btn-primary.btn-sm', { text: 'Review as practice' });
    revM.disabled = !mistakes.length;
    revM.addEventListener('click', () => SAT.practice.start({ title: 'Mistakes review', skills: [], list: mistakes.slice(0, 20).map((m) => m.q), count: Math.min(20, mistakes.length), feedback: 'instant' }));
    const byskill = {};
    mistakes.forEach((m) => { const q = SAT.resolveQ(m.q); if (q) byskill[q.skill] = (byskill[q.skill] || 0) + 1; });
    page('progress',
      h('div.page-head', h('h1', 'Progress'), h('p.muted', 'Everything is saved in this browser. Export a backup from Settings.')),
      h('div.stat-row', tile('Questions answered', String(a), 'check'), tile('Accuracy', a ? U.pct(c, a) + '%' : '—', 'target'), tile('Day streak', String(SAT.stats.streak()), 'fire'), tile('Practice time', U.fmtTime(t), 'clock'), tile('Tests taken', String((SAT.store.get('history', []) || []).length), 'clipboard')),
      h('div.two-col',
        card('', h('h2', 'Score trend'), hist.length ? h('div', { html: SAT.fig.trend(hist.map((x) => x.total), { w: 560, h: 200, xlabel: 'Full-length test attempt' }) }) : h('p.muted', 'Complete a full-length test to start your score trend.')),
        card('', h('h2', 'Activity'), heat, h('div.heat-legend.small.muted', 'Less ', ...[0, 1, 2, 3, 4].map((l) => h('i', { dataset: { l: String(l) } })), ' More'))),
      ...skillTables,
      card('', h('div.card-head', h('h2', 'Mistakes to revisit (' + mistakes.length + ')'), h('div.btn-row', revM, clearM)),
        mistakes.length ? h('div.pill-row', ...Object.keys(byskill).map((k) => h('span.pill', SK.byId[k].name + ' × ' + byskill[k]))) : h('p.muted', 'Questions you miss are collected here automatically.')));
  };

  /* ========================================================= SETTINGS */
  V.settings = function () {
    const st = SAT.settings.all();
    const gallery = h('div.theme-gallery');
    SAT.themes.list.forEach((t) => {
      const prev = h('div.theme-prev', { dataset: { theme: t.id }, 'aria-hidden': 'true' },
        h('div.tp-bar'), h('div.tp-body', h('div.tp-card', h('i'), h('i.short')), h('div.tp-card.alt', h('i'), h('span.tp-btn'))));
      const b = h('button.theme-card' + (st.theme === t.id ? '.on' : ''), { type: 'button', 'aria-pressed': String(st.theme === t.id) }, prev,
        h('div.theme-meta', h('b', t.name), h('span.muted.small', t.desc)), h('div.theme-sw', ...t.sw.map((c) => h('i', { style: { background: c } }))));
      b.addEventListener('click', () => { SAT.themes.apply(t.id); U.$$('.theme-card', gallery).forEach((x) => { x.classList.toggle('on', x === b); x.setAttribute('aria-pressed', String(x === b)); }); });
      gallery.appendChild(b);
    });
    const field = (label, input, hint) => h('label.field', h('span', label), input, hint ? h('small.muted', hint) : null);
    const name = h('input.input', { type: 'text', value: st.name || '', placeholder: 'Your name', maxlength: 40 });
    name.addEventListener('change', () => SAT.settings.set('name', name.value.trim()));
    const date = h('input.input', { type: 'date', value: st.testDate || '' });
    date.addEventListener('change', () => SAT.settings.set('testDate', date.value));
    const goal = h('input.input', { type: 'number', min: 5, max: 200, value: st.dailyGoal });
    goal.addEventListener('change', () => SAT.settings.set('dailyGoal', U.clamp(+goal.value || 20, 5, 200)));
    const toggle = (key, label, hint) => { const cb = h('input', { type: 'checkbox' }); cb.checked = st[key] !== false; cb.addEventListener('change', () => { SAT.settings.set(key, cb.checked); if (key === 'motion') SAT.themes.apply(SAT.settings.get('theme')); }); return h('label.switch-row', h('span.switch', cb, h('span')), h('div', h('b', label), hint ? h('small.muted', hint) : null)); };
    const zoom = h('input', { type: 'range', min: 0.8, max: 1.6, step: 0.1, value: st.zoom || 1 });
    const zlab = h('span', Math.round((st.zoom || 1) * 100) + '%');
    zoom.addEventListener('input', () => { SAT.settings.set('zoom', +zoom.value); zlab.textContent = Math.round(zoom.value * 100) + '%'; });

    const exp = h('button.btn', { html: U.icon('download') + ' Export backup' });
    exp.addEventListener('click', () => {
      const blob = new Blob([JSON.stringify(SAT.store.all(), null, 1)], { type: 'application/json' });
      const a = h('a', { href: URL.createObjectURL(blob), download: 'sat-studio-backup-' + U.today() + '.json' });
      document.body.appendChild(a); a.click(); a.remove();
    });
    const file = h('input', { type: 'file', accept: 'application/json', style: { display: 'none' } });
    const imp = h('button.btn', { html: U.icon('upload') + ' Import backup' });
    imp.addEventListener('click', () => file.click());
    file.addEventListener('change', async () => {
      try { const data = JSON.parse(await file.files[0].text()); Object.keys(data).forEach((k) => SAT.store.set(k, data[k])); U.toast('Backup imported.'); SAT.themes.apply(SAT.settings.get('theme')); V.settings(); }
      catch (e) { U.toast('That file isn’t a valid backup.', 'bad'); }
    });
    const reset = h('button.btn.btn-danger', { html: U.icon('trash') + ' Reset all data' });
    reset.addEventListener('click', () => U.confirm('Reset everything?', 'This deletes your stats, test history, saved words, and settings from this browser.', 'Reset', true).then((ok) => { if (ok) { SAT.store.clear(); SAT.themes.apply('frutiger-aero'); U.toast('All data cleared.'); SAT.router.go('/home'); } }));

    page('settings',
      h('div.page-head', h('h1', 'Settings')),
      card('', h('h2', 'Style'), h('p.muted', 'Pick any of the 15 styles. Your choice is saved and applies everywhere, including tests.'), gallery, toggle('motion', 'Background animations', 'Turn off for less motion or better battery life.')),
      h('div.two-col',
        card('', h('h2', 'Profile'), field('Name', name, 'Shown on the test screen.'), field('SAT test date', date, 'Adds a countdown to your dashboard.'), field('Daily question goal', goal)),
        card('', h('h2', 'Test & practice options'), toggle('testDict', 'Dictionary during full tests', 'The real SAT has no dictionary; turn this off for strict realism.'), toggle('dblLookup', 'Double-click to define', 'Double-click a word in a passage to see its definition.'), toggle('confetti', 'Celebrate correct answers'),
          h('label.field', h('span', 'Question text size'), h('div.inline', zoom, zlab)))),
      card('', h('h2', 'Your data'), h('p.muted', 'Progress is stored only in this browser (localStorage). Export a backup to move it to another device.'), h('div.btn-row', exp, imp, file, reset)),
      card('about', h('h2', 'About SAT Studio'),
        h('p', 'SAT Studio contains ' + SAT.bank.count() + ' original Reading and Writing questions and generates unlimited Math questions across all ' + SK.ofSection('math').length + ' Math skills, following the published Digital SAT specifications (domains, question types, timing, and adaptive modules).'),
        h('p.muted.small', 'All passages and questions are original practice material. Some studies, people, and places in passages are fictional or simplified for practice. Scores are estimates. SAT® is a trademark registered by the College Board, which is not affiliated with and does not endorse this app. Math typesetting by KaTeX (MIT license). Online definitions from the Free Dictionary API.')));
  };
})();
