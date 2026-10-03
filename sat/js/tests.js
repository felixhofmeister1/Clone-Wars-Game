/* Full-length adaptive tests: module assembly (R&W from authored sets, Math
   from seeded generators), adaptive routing, scoring, and progress stats. */
(function () {
  'use strict';
  const SAT = window.SAT, U = SAT.util, G = SAT.mathgen;

  const RW_TIME = 32 * 60, MATH_TIME = 35 * 60, BREAK_TIME = 10 * 60;
  const ROUTE_THRESHOLD = 0.6; // share of module 1 correct needed for the harder module 2

  const TESTS = [
    { id: 't1', name: 'Practice Test 1', blurb: 'Full-length adaptive Digital SAT: 98 questions, 2 hours 14 minutes.' },
    { id: 't2', name: 'Practice Test 2', blurb: 'A second full-length adaptive test with all-new questions.' },
  ];

  /* ------------------------------------------------------------ math */
  const MATH_GROUPS = {
    alg: ['lin1', 'linf', 'lin2', 'sys', 'ineq'],
    adv: ['nlf', 'nle', 'eqv'],
    psda: ['rat', 'pct', 'one', 'two', 'prob', 'smp', 'stc'],
    geo: ['av', 'lat', 'rtt', 'cir'],
  };
  const MIX = { m1: { E: 7, M: 8, H: 7 }, easy: { E: 10, M: 9, H: 3 }, hard: { E: 3, M: 8, H: 11 } };
  const SPR_SLOTS = [3, 8, 12, 15, 18, 21];
  const RANK = { E: 0, M: 1, H: 2 };

  function mathModule(seedKey, level) {
    const r = U.rng(seedKey);
    const skills = []
      .concat(MATH_GROUPS.alg, r.sample(MATH_GROUPS.alg, 3))
      .concat(['nlf', 'nlf', 'nle', 'nle', 'eqv', 'eqv'], r.sample(MATH_GROUPS.adv, 2))
      .concat(r.sample(MATH_GROUPS.psda, 3), r.sample(MATH_GROUPS.geo, 3));
    const mix = MIX[level];
    const diffs = [].concat(Array(mix.E).fill('E'), Array(mix.M).fill('M'), Array(mix.H).fill('H'));
    const slots = r.shuffle(skills).map((s, i) => ({ skill: s, diff: diffs[i] }));
    // Order by difficulty (E -> M -> H) as on the real test, shuffled within each band.
    const ordered = [];
    ['E', 'M', 'H'].forEach((d) => ordered.push(...r.shuffle(slots.filter((x) => x.diff === d))));
    return ordered.map((slot, i) => {
      const want = SPR_SLOTS.includes(i) ? 'spr' : 'mc';
      let q = null;
      for (let t = 0; t < 16; t++) {
        q = G.make(slot.skill, slot.diff, U.hash(seedKey + '|' + i + '|' + t), want);
        if (q.type === want) break;
      }
      return q;
    });
  }

  /* ------------------------------------------------------------- R&W */
  function rwModule(testId, key) {
    const set = testId + (key === 'm1' ? 'm1' : key === 'easy' ? 'm2e' : 'm2h');
    return SAT.bank.set(set);
  }

  /* An "exam" describes what the runner should deliver. */
  function buildExam(testId, sections) {
    const meta = TESTS.find((t) => t.id === testId);
    const mods = [];
    if (sections.includes('rw')) {
      mods.push({ section: 'rw', num: 1, level: 'm1', time: RW_TIME });
      mods.push({ section: 'rw', num: 2, level: null, time: RW_TIME });
    }
    if (sections.includes('math')) {
      mods.push({ section: 'math', num: 1, level: 'm1', time: MATH_TIME });
      mods.push({ section: 'math', num: 2, level: null, time: MATH_TIME });
    }
    return {
      id: U.uid(), testId, kind: sections.length === 2 ? 'full' : 'section', sections,
      title: meta ? meta.name : 'Practice Test', modules: mods,
      breakAfter: sections.length === 2 ? 1 : -1,
    };
  }
  function freshMathExam() {
    const seed = 'fresh-' + Date.now();
    return {
      id: U.uid(), testId: 'fm', seed, kind: 'math-fresh', sections: ['math'], title: 'Fresh Math Section',
      modules: [{ section: 'math', num: 1, level: 'm1', time: MATH_TIME }, { section: 'math', num: 2, level: null, time: MATH_TIME }],
      breakAfter: -1,
    };
  }

  function questionsFor(exam, mod) {
    if (mod.section === 'rw') return rwModule(exam.testId, mod.level);
    const seed = (exam.seed || exam.testId) + '-math-' + mod.level;
    return mathModule(seed, mod.level);
  }

  /* ------------------------------------------------------------ scoring */
  const UPPER = [[0, 200], [0.1, 270], [0.2, 340], [0.3, 400], [0.4, 450], [0.5, 500], [0.6, 550], [0.7, 600], [0.8, 660], [0.9, 720], [0.95, 760], [1, 800]];
  const LOWER = [[0, 200], [0.1, 240], [0.2, 290], [0.3, 340], [0.4, 380], [0.5, 420], [0.6, 460], [0.7, 500], [0.8, 540], [0.9, 580], [1, 620]];
  function interp(tbl, x) {
    for (let i = 1; i < tbl.length; i++) {
      if (x <= tbl[i][0]) {
        const [x0, y0] = tbl[i - 1], [x1, y1] = tbl[i];
        return y0 + ((x - x0) / (x1 - x0)) * (y1 - y0);
      }
    }
    return tbl[tbl.length - 1][1];
  }
  function sectionScore(correct, total, hardPath) {
    if (!total) return null;
    const raw = interp(hardPath ? UPPER : LOWER, correct / total);
    return U.clamp(Math.round(raw / 10) * 10, 200, 800);
  }

  function isCorrect(q, ans) {
    if (ans == null || ans === '') return false;
    if (q.type === 'spr') return G.checkSpr(ans, q);
    return ans === q.answer;
  }

  /* --------------------------------------------------------------- stats */
  const Stats = {
    record(q, correct, seconds) {
      const st = SAT.store.get('stats', {});
      const s = (st[q.skill] = st[q.skill] || { E: { a: 0, c: 0 }, M: { a: 0, c: 0 }, H: { a: 0, c: 0 }, recent: [], time: 0 });
      s[q.diff].a++; if (correct) s[q.diff].c++;
      s.recent = (s.recent || []).concat(correct ? 1 : 0).slice(-20);
      s.time = (s.time || 0) + (seconds || 0);
      SAT.store.set('stats', st);
      const act = SAT.store.get('activity', {}), day = U.today();
      act[day] = (act[day] || 0) + 1;
      SAT.store.set('activity', act);
      if (!correct) {
        const mis = SAT.store.get('mistakes', []);
        if (!mis.some((m) => m.id === q.id)) {
          mis.unshift({ id: q.id, at: Date.now(), q: SAT.refQ(q) });
          SAT.store.set('mistakes', mis.slice(0, 300));
        }
      }
    },
    skill(id) {
      const s = (SAT.store.get('stats', {}) || {})[id];
      if (!s) return { a: 0, c: 0, pct: null, mastery: 0 };
      const a = s.E.a + s.M.a + s.H.a, c = s.E.c + s.M.c + s.H.c;
      const w = s.E.a + 1.5 * s.M.a + 2 * s.H.a, wc = s.E.c + 1.5 * s.M.c + 2 * s.H.c;
      const pct = a ? Math.round((100 * c) / a) : null;
      const weighted = w ? wc / w : 0;
      const mastery = a < 3 ? 0 : weighted >= 0.85 && a >= 12 ? 4 : weighted >= 0.7 ? 3 : weighted >= 0.5 ? 2 : 1;
      return { a, c, pct, mastery, weighted, raw: s };
    },
    streak() {
      const act = SAT.store.get('activity', {});
      let n = 0; const d = new Date();
      if (!act[U.today(d)]) d.setDate(d.getDate() - 1);
      while (act[U.today(d)]) { n++; d.setDate(d.getDate() - 1); }
      return n;
    },
    today: () => (SAT.store.get('activity', {})[U.today()] || 0),
    /* Estimate section scores from recent test results or practice accuracy. */
    estimate() {
      const hist = (SAT.store.get('history', []) || []).filter((h) => h.kind === 'full');
      if (hist.length) {
        const h = hist[0];
        return { rw: h.rw, math: h.math, total: h.total, source: 'Latest full test (' + h.title + ')' };
      }
      const sec = (secId) => {
        let w = 0, wc = 0;
        SAT.skills.ofSection(secId).forEach((sk) => { const s = Stats.skill(sk.id); if (s.a) { w += s.a; wc += s.weighted * s.a; } });
        if (w < 10) return null;
        return U.clamp(Math.round((200 + 600 * Math.pow(wc / w, 1.1)) / 10) * 10, 200, 800);
      };
      const rw = sec('rw'), math = sec('math');
      return { rw, math, total: rw && math ? rw + math : null, source: 'Estimated from practice accuracy' };
    },
  };

  SAT.tests = {
    list: TESTS, RW_TIME, MATH_TIME, BREAK_TIME, ROUTE_THRESHOLD,
    available: (id) => SAT.bank.hasSet(id + 'm1') && SAT.bank.hasSet(id + 'm2e') && SAT.bank.hasSet(id + 'm2h'),
    buildExam, freshMathExam, questionsFor, mathModule, sectionScore, isCorrect,
    route(correct, total) { return total && correct / total >= ROUTE_THRESHOLD ? 'hard' : 'easy'; },
  };
  SAT.stats = Stats;
})();
